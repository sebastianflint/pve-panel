// Containers (LXC) created from container images ("CT Templates" in Proxmox,
// e.g. local:vztmpl/debian-13-standard_13.6-1_amd64.tar.zst).
//
// Unlike VM templates nothing is cloned: Proxmox builds a new container from the
// image file. Containers are always UNPRIVILEGED (root in the container is not
// root on the host). Sign-in is root with a password and/or SSH keys; there is no
// cloud-init and no guest agent.

import { db } from './db.js';
import { pve, clusterGuests } from './pve.js';

const CACHE_MS = 60_000;
let imageCache = { at: 0, images: null };

/** Nodes of the cluster (falls back to the nodes that run guests). */
async function nodes() {
  try {
    const list = await pve.get('/nodes');
    const online = list.filter((n) => n.status !== 'offline').map((n) => n.node);
    if (online.length) return online.sort();
  } catch { /* no rights to list nodes */ }
  return [...new Set([...(await clusterGuests()).values()].map((g) => g.node))].sort();
}

/** "debian-13-standard_13.6-1_amd64.tar.zst" from a volume ID. */
export const imageFile = (volid) => String(volid).split('/').pop();

/**
 * Every container image on every node: [{ volid, node, file, size, ctime, shared }].
 * Images on shared storage (NFS, CephFS…) are listed once.
 */
export async function containerImages({ force = false } = {}) {
  if (!force && imageCache.images && Date.now() - imageCache.at < CACHE_MS) return imageCache.images;
  const seen = new Map();
  for (const node of await nodes()) {
    let storages = [];
    try {
      storages = await pve.get(`/nodes/${encodeURIComponent(node)}/storage`, { content: 'vztmpl', enabled: 1 });
    } catch { continue; }
    for (const st of storages) {
      let items = [];
      try {
        items = await pve.get(`/nodes/${encodeURIComponent(node)}/storage/${encodeURIComponent(st.storage)}/content`, { content: 'vztmpl' });
      } catch { continue; }
      for (const it of items) {
        const shared = !!Number(st.shared);
        const key = shared ? it.volid : `${node}|${it.volid}`;
        if (seen.has(key)) continue;
        seen.set(key, { volid: it.volid, node, file: imageFile(it.volid), size: Number(it.size) || null, ctime: Number(it.ctime) || null, shared });
      }
    }
  }
  imageCache = { at: Date.now(), images: [...seen.values()].sort((a, b) => a.file.localeCompare(b.file) || a.node.localeCompare(b.node)) };
  return imageCache.images;
}

export function forgetImageCache() {
  imageCache = { at: 0, images: null };
}

/** Storages that can hold container disks, per node: { node: ['local-lvm', …] }. */
export async function containerStorages() {
  const out = {};
  for (const node of await nodes()) {
    try {
      const list = await pve.get(`/nodes/${encodeURIComponent(node)}/storage`, { content: 'rootdir', enabled: 1 });
      out[node] = list.map((s) => s.storage).sort();
    } catch {
      out[node] = [];
    }
  }
  return out;
}

/** Is the image of this offered row still there? */
function stillThere(row, images) {
  return images.some((i) => i.volid === row.volid && (i.shared || i.node === row.node));
}

/** Container images offered to customers, in the same shape as VM templates. */
export async function offeredContainerTemplates() {
  const rows = db.prepare('SELECT * FROM ct_templates ORDER BY label').all();
  if (!rows.length) return [];
  const images = await containerImages();
  return rows.filter((r) => stillThere(r, images)).map((r) => ({
    id: `ct-${r.id}`,
    name: r.label,
    kind: 'container',
    setup: 'container',
    minDiskGb: r.min_disk_gb,
    defaultUser: 'root',
    os: 'l26',
  }));
}

export const containerRow = (templateId) => {
  const m = /^ct-(\d+)$/.exec(String(templateId));
  return m ? db.prepare('SELECT * FROM ct_templates WHERE id = ?').get(Number(m[1])) : null;
};

/** MAC address of a container's first network card (kept across a reinstall). */
export const containerMac = (net0) => /(?:^|,)hwaddr=([0-9A-Fa-f]{2}(?::[0-9A-Fa-f]{2}){5})/.exec(net0 ?? '')?.[1] ?? null;

/**
 * Parameters for POST /nodes/{node}/lxc. `net` is the customer's network or null.
 */
export function containerParams({ vmid, row, spec, net, pool, mac = null }) {
  const nic = [
    'name=eth0',
    `bridge=${net ? net.vnet : row.bridge}`,
    ...(mac ? [`hwaddr=${mac}`] : []),
    'ip=dhcp',
    ...(net ? ['firewall=1'] : []),
  ].join(',');
  const params = {
    vmid,
    ostemplate: row.volid,
    hostname: spec.hostname,
    cores: spec.cores,
    memory: spec.memoryMb,
    swap: Math.min(spec.memoryMb, 512),
    rootfs: `${row.storage}:${spec.diskGb}`,
    net0: nic,
    unprivileged: 1,
    pool,
    onboot: 0,
  };
  if (row.nesting) params.features = 'nesting=1';
  if (spec.password) params.password = spec.password;
  if (spec.sshKeys?.trim()) params['ssh-public-keys'] = `${spec.sshKeys.trim()}\n`;
  return params;
}

/** IPv4/IPv6 addresses of a running container (from Proxmox, no agent needed). */
export async function containerIps(path) {
  try {
    const list = await pve.get(`${path}/interfaces`);
    const ips = [];
    for (const i of list ?? []) {
      if (i.name === 'lo') continue;
      for (const a of [i.inet, i.inet6, ...(i['ip-addresses'] ?? []).map((x) => x['ip-address'])]) {
        const ip = String(a ?? '').split('/')[0];
        if (!ip || ip.startsWith('127.') || ip === '::1' || ip.toLowerCase().startsWith('fe80')) continue;
        if (!ips.includes(ip)) ips.push(ip);
      }
    }
    return ips;
  } catch {
    return null;
  }
}
