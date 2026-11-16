import crypto from 'node:crypto';
import WebSocket from 'ws';
import { db, audit } from '../db.js';
import { config } from '../config.js';
import { pve, locateGuest, guestPath, authHeader, tlsOptions } from '../pve.js';
import { bridgeTerminal } from '../terminal-proxy.js';

const ownedByUser = db.prepare('SELECT * FROM vms WHERE vmid = ? AND user_id = ?');

// One-time console sessions. A session is created by the POST route and
// consumed by the first websocket connection that presents its id.
const sessions = new Map();
const SESSION_TTL_MS = 30_000;

setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions) if (s.expires < now) sessions.delete(id);
}, 10_000).unref();

export default async function consoleRoutes(app) {
  // Step 1: select the native text terminal for CTs, VNC for virtual machines.
  app.post('/api/vms/:vmid/console', {
    preHandler: app.authenticate,
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const vmid = Number(req.params.vmid);
    const row = Number.isInteger(vmid) ? ownedByUser.get(vmid, req.account.id) : null;
    if (!row) return reply.code(404).send({ error: 'Server not found' });
    if (row.state !== 'ready') return reply.code(409).send({ error: 'This server is not ready yet' });
    const guest = await locateGuest(vmid);
    if (guest.status !== 'running') {
      return reply.code(409).send({ error: 'Start the server to open its console' });
    }

    const type = guest.type === 'lxc' ? 'terminal' : 'vnc';
    const proxy = type === 'terminal'
      ? await pve.post(`${guestPath(guest)}/termproxy`)
      : await pve.post(`${guestPath(guest)}/vncproxy`, { websocket: 1 });
    const id = crypto.randomBytes(24).toString('base64url');
    sessions.set(id, {
      userId: req.account.id,
      guest,
      type,
      port: proxy.port,
      ticket: proxy.ticket,
      user: proxy.user,
      expires: Date.now() + SESSION_TTL_MS,
    });
    audit(req, vmid, 'console_open');
    reply.header('Cache-Control', 'no-store');

    // noVNC uses the Proxmox ticket as the VNC password.
    return { session: id, type, ...(type === 'vnc' ? { password: proxy.ticket } : {}), name: guest.name };
  });

  // Step 2: browser websocket <-> Proxmox vncwebsocket
  app.get('/api/console/:session', {
    websocket: true,
    preHandler: [app.authenticate, async (req, reply) => {
      if (!req.headers.origin) return;
      try {
        const origin = new URL(req.headers.origin);
        if (['http:', 'https:'].includes(origin.protocol) && origin.host === req.headers.host) return;
      } catch { /* reject malformed origins */ }
      return reply.code(403).send({ error: 'Console origin is not allowed' });
    }],
  }, (client, req) => {
    const s = sessions.get(req.params.session);
    const row = s ? ownedByUser.get(s.guest.vmid, req.account.id) : null;

    if (!s || s.userId !== req.account.id || s.expires < Date.now() || !row || row.state !== 'ready') {
      client.close(4001, 'Console session expired');
      return;
    }
    sessions.delete(req.params.session);

    const upstreamUrl = new URL(`${config.pve.url}${'/api2/json'}${guestPath(s.guest)}/vncwebsocket`);
    upstreamUrl.protocol = upstreamUrl.protocol === 'http:' ? 'ws:' : 'wss:';
    upstreamUrl.searchParams.set('port', String(s.port));
    upstreamUrl.searchParams.set('vncticket', s.ticket);

    const upstream = new WebSocket(upstreamUrl, ['binary'], {
      headers: { Authorization: authHeader },
      ...tlsOptions,
      handshakeTimeout: 10_000,
      maxPayload: s.type === 'terminal' ? 1024 * 1024 : 16 * 1024 * 1024,
    });
    if (s.type === 'terminal') {
      bridgeTerminal(client, upstream, { user: s.user, ticket: s.ticket });
      return;
    }

    // Anything the browser sends before Proxmox is ready is queued.
    const queue = [];
    let queuedBytes = 0;
    client.on('message', (data, isBinary) => {
      if (upstream.readyState === WebSocket.OPEN) upstream.send(data, { binary: isBinary });
      else {
        queuedBytes += data.length;
        if (queuedBytes > 1024 * 1024) return client.close(1009, 'Too much pending console input');
        queue.push([data, isBinary]);
      }
    });

    upstream.on('open', () => {
      for (const [data, isBinary] of queue) upstream.send(data, { binary: isBinary });
      queue.length = 0;
    });
    upstream.on('message', (data, isBinary) => {
      if (client.readyState === WebSocket.OPEN) client.send(data, { binary: isBinary });
    });

    const closeBoth = () => {
      if (client.readyState === WebSocket.OPEN) client.close();
      if (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING) {
        upstream.terminate();
      }
    };
    upstream.on('close', closeBoth);
    upstream.on('error', () => {
      req.log.warn({ vmid: s.guest.vmid }, 'console upstream connection failed');
      closeBoth();
    });
    client.on('close', closeBoth);
    client.on('error', closeBoth);
  });
}
