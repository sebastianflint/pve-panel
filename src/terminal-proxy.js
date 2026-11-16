import WebSocket from 'ws';

const MAX_INPUT = 64 * 1024;
const MAX_PENDING = 256 * 1024;
const MAX_OUTPUT = 4 * 1024 * 1024;

// Proxmox termproxy protocol: authenticate, await "OK", then framed input and
// resize messages. The browser never receives the Proxmox user or ticket.
export function bridgeTerminal(client, upstream, { user, ticket }) {
  let ready = false;
  let ended = false;
  let authentication = Buffer.alloc(0);
  let pendingBytes = 0;
  const pending = [];
  let ping;
  const timeout = setTimeout(() => close(1011, 'Terminal connection timed out'), 10_000);
  timeout.unref();

  function close(code = 1000, reason = '') {
    if (ended) return;
    ended = true;
    clearTimeout(timeout);
    clearInterval(ping);
    pending.length = 0;
    if (client.readyState === WebSocket.OPEN) client.close(code, reason);
    if (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING) upstream.terminate();
  }

  function send(frame) {
    if (ready && upstream.readyState === WebSocket.OPEN) {
      if (upstream.bufferedAmount > MAX_PENDING) return close(1013, 'Terminal input is busy');
      upstream.send(frame);
    } else {
      pendingBytes += Buffer.byteLength(frame);
      if (pendingBytes > MAX_PENDING) return close(1009, 'Too much pending terminal input');
      pending.push(frame);
    }
  }

  client.on('message', (data, binary) => {
    if (ended) return;
    if (binary || data.length > MAX_INPUT) return close(binary ? 1003 : 1009, 'Invalid terminal input');
    let message;
    try { message = JSON.parse(data.toString()); } catch { return close(1008, 'Invalid terminal message'); }
    if (message?.type === 'input' && typeof message.data === 'string') {
      const body = Buffer.from(message.data, message.binary === true ? 'latin1' : 'utf8');
      if (body.length > MAX_INPUT) return close(1009, 'Terminal input is too large');
      send(Buffer.concat([Buffer.from(`0:${body.length}:`), body]));
    } else if (message?.type === 'resize' && Number.isInteger(message.cols) && Number.isInteger(message.rows)
        && message.cols >= 2 && message.cols <= 500 && message.rows >= 1 && message.rows <= 300) {
      send(`1:${message.cols}:${message.rows}:`);
    } else {
      close(1008, 'Invalid terminal message');
    }
  });

  upstream.on('open', () => upstream.send(`${user}:${ticket}\n`));
  upstream.on('message', (data) => {
    if (ended || client.readyState !== WebSocket.OPEN) return;
    let output = Buffer.from(data);
    if (!ready) {
      authentication = Buffer.concat([authentication, output]);
      if (authentication.length < 2) return;
      if (authentication[0] !== 79 || authentication[1] !== 75) return close(1011, 'Terminal authentication failed');
      output = authentication.subarray(2);
      authentication = Buffer.alloc(0);
      ready = true;
      clearTimeout(timeout);
      client.send(JSON.stringify({ type: 'ready' }));
      for (const frame of pending) upstream.send(frame);
      pending.length = 0;
      pendingBytes = 0;
      ping = setInterval(() => {
        if (upstream.readyState === WebSocket.OPEN) upstream.send('2');
      }, 30_000);
      ping.unref();
    }
    if (client.bufferedAmount > MAX_OUTPUT) return close(1013, 'Terminal output is busy');
    if (output.length) client.send(output, { binary: true });
  });
  upstream.on('close', () => close());
  upstream.on('error', () => close(1011, 'Terminal connection failed'));
  client.on('close', () => close());
  client.on('error', () => close());
}
