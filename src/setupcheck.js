// Setup check for administrators: is Proxmox prepared the way the enabled
// features need it? Every check only READS (Proxmox API GETs, plus "wg show" on
// the VPN gateway); nothing is changed. Each result says what is wrong and how
// to fix it, usually with the exact command.
//
// Status per check: ok | warn | error | info | skipped (couldn't be checked,
// e.g. the token may not read that part; the result says which right helps).
// Runs on demand (admin interface) and automatically (SETUP_CHECK_HOURS, default
// 24); administrators get an email when a run finds problems that are new.

import dns from 'node:dns/promises';
import fs from 'node:fs';
import path from 'node:path';
import { db } from './db.js';
import { config } from './config.js';
import { pve, probe, clusterGuests, guestPath, bootDiskKey, diskSizeGb } from './pve.js';
import { allNetworks } from './network.js';
import { adminOverview } from './vpn.js';
import { updatesEnabled } from './winupdate.js';
import { versionInfo, updateStatus } from './version.js';
import { emailConfigured, sendMail, setupCheckMessage } from './mail.js';
import { backupSettings, backupStorages } from './backups.js';

export const GROUPS = [
  ['proxmox', 'Proxmox connection'],
  ['permissions', 'Permissions of the API token'],
  ['servers', 'Customer servers'],
  ['templates', 'Templates'],
  ['network', 'Customer networks'],
  ['remote', 'Remote access'],
  ['backups', 'Backups'],
  ['email', 'Email'],
  ['security', 'Security'],
  ['maintenance', 'Updates and backups'],
];

const GB = 2 ** 30;
const PROBLEM = ['error', 'warn'];
const tokenUser = () => config.pve.tokenId.split('!')[0];

// ---- Settings and the stored last result --------------------------------------------

function readKey(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? JSON.parse(row.value) : null;
}
function writeKey(key, value) {
  db.prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(key, JSON.stringify(value));
}

export function setupCheckSettings() {
  const s = readKey('setupcheck') ?? {};
  return { notify: s.notify !== false };
}
export function saveSetupCheckSettings({ notify }) {
  const s = readKey('setupcheck') ?? {};
  if (typeof notify === 'boolean') s.notify = notify;
  writeKey('setupcheck', s);
  return setupCheckSettings();
}

/** The last result (or null), with the settings. */
export function lastSetupCheck() {
  return readKey('setupcheck_result');
}

// ---- Helpers -------------------------------------------------------------------------

/** Collects checks; `fix` = { text, commands: [] } */
function collector() {
  const checks = [];
  const add = (group, id, status, title, detail = '', fix = null) => {
    checks.push({ group, id, status, title, detail, fix });
  };
  return { checks, add };
}

const timeout = (ms, what) => new Promise((_, reject) => {
  setTimeout(() => reject(new Error(`${what} took longer than ${ms / 1000} s`)), ms).unref();
});

/** Effective privileges of the token at a path ({} when it has none). */
async function privilegesAt(p) {
  const r = await pve.get('/access/permissions', { path: p });
  return r?.[p] ?? {};
}

const isForbidden = (err) => err?.statusCode === 403;

function aclFix(p, missing, role = 'PanelCustomer') {
  return {
    text: `Add the missing privileges to the role ${tokenUser()} has on ${p} (here called ${role}), or give it that role `
      + 'on the path. If the API token has privilege separation, use --tokens with the token ID instead of --users.',
    commands: [
      `pveum role modify ${role} --append 1 --privs "${missing.join(' ')}"`,
      `pveum acl modify ${p} --users ${tokenUser()} --roles ${role}`,
    ],
  };
}

// ---- The checks ----------------------------------------------------------------------

async function checkProxmox(c, ctx) {
  const r = await probe('/version');
  if (!r.ok) {
    if (r.status === 401) {
      c.add('proxmox', 'pve:reach', 'error', 'Proxmox rejects the API token',
        'Proxmox answered 401: the token ID or secret is wrong, the token was deleted or has expired.', {
          text: 'Check PVE_TOKEN_ID (user@realm!tokenname) and PVE_TOKEN_SECRET, or create a new token and restart the panel.',
          commands: [`pveum user token add ${tokenUser()} panel --privsep 0`],
        });
    } else if (r.status) {
      c.add('proxmox', 'pve:reach', 'error', 'Proxmox answers with an error', `HTTP ${r.status}: ${r.message}`);
    } else {
      const tls = /CERT|SELF_SIGNED|UNABLE_TO|ERR_TLS|HOSTNAME|ALTNAME/i.test(r.error);
      c.add('proxmox', 'pve:reach', 'error', 'Proxmox is not reachable', `${config.pve.url}: ${r.error}`, tls
        ? {
          text: 'The certificate of Proxmox is not trusted. Give the panel the CA that signed it (on a Proxmox node: '
            + '/etc/pve/pve-root-ca.pem) and set PVE_CA_FILE, or use a trusted certificate. If the host name differs from '
            + 'the certificate, use the name the certificate was issued for in PVE_URL.',
          commands: ['scp root@<proxmox-node>:/etc/pve/pve-root-ca.pem ./certs/pve-root-ca.pem', 'PVE_CA_FILE=/app/certs/pve-root-ca.pem'],
        }
        : { text: 'Check PVE_URL (https://host:8006), DNS, and that a firewall lets the panel reach port 8006.' });
    }
    ctx.reachable = false;
    return;
  }
  ctx.reachable = true;
  const version = String(r.data?.version ?? '');
  ctx.major = Number(version.split('.')[0]) || 0;
  c.add('proxmox', 'pve:reach', 'ok', `Connected to Proxmox VE ${version}`, `Answer in ${r.ms} ms.`);
  if (ctx.major && ctx.major < 8) {
    c.add('proxmox', 'pve:version', 'warn', `Proxmox VE ${version} is older than the supported versions`,
      'The panel is built and tested for Proxmox VE 8 and 9.', { text: 'Upgrade Proxmox VE.' });
  }

  if (!config.pve.verifyTls) {
    c.add('proxmox', 'pve:tls', 'warn', 'The Proxmox certificate is not verified',
      'PVE_VERIFY_TLS=false: someone in the network path could pose as Proxmox and receive the API token.', {
        text: 'Copy the Proxmox CA to the panel, set PVE_CA_FILE and remove PVE_VERIFY_TLS=false.',
        commands: ['scp root@<proxmox-node>:/etc/pve/pve-root-ca.pem ./certs/pve-root-ca.pem', 'PVE_CA_FILE=/app/certs/pve-root-ca.pem'],
      });
  } else {
    c.add('proxmox', 'pve:tls', 'ok', 'The Proxmox certificate is verified');
  }

  const theirs = Date.parse(r.date ?? '');
  if (Number.isFinite(theirs)) {
    const skew = Math.round((Date.now() - r.ms / 2 - theirs) / 1000);
    if (Math.abs(skew) > 60) {
      c.add('proxmox', 'pve:clock', 'warn', `The panel's clock differs from Proxmox by ${Math.abs(skew)} seconds`,
        'One of the two clocks is wrong. With a wrong panel clock, two-factor codes are rejected and expiry steps run at the wrong time.', {
          text: 'Turn on time synchronisation (NTP) on the panel host and on the Proxmox nodes.',
          commands: ['timedatectl set-ntp true', 'timedatectl status'],
        });
    } else {
      c.add('proxmox', 'pve:clock', 'ok', 'The clocks of the panel and Proxmox agree');
    }
  }
}

/** What the enabled features need, per path: [{ path, label, privs: [[priv, why]], role }] */
async function requirements(ctx) {
  const v9 = ctx.major >= 9;
  const agentAudit = v9 ? 'VM.GuestAgent.Audit' : 'VM.Monitor';
  const agentExec = v9 ? 'VM.GuestAgent.Unrestricted' : 'VM.Monitor';
  const pool = `/pool/${config.pve.pool}`;
  const reqs = [];
  const poolPrivs = [
    ['VM.Audit', 'see servers'], ['VM.PowerMgmt', 'start and stop'], ['VM.Console', 'browser console'],
    ['VM.Snapshot', 'snapshots'], ['VM.Snapshot.Rollback', 'restore snapshots'],
    [agentAudit, 'show IP addresses (guest agent)', 'warn'],
  ];
  if (ctx.creating) {
    for (const p of ['VM.Allocate', 'VM.Config.CPU', 'VM.Config.Memory', 'VM.Config.Disk', 'VM.Config.Cloudinit',
      'VM.Config.Options', 'VM.Config.Network']) poolPrivs.push([p, 'create servers']);
  }
  const execNeeds = [];
  if (ctx.windowsTemplates) execNeeds.push('Windows setup');
  if (config.tailscale.enabled) execNeeds.push('Tailscale');
  if (ctx.windowsServers && updatesEnabled()) execNeeds.push('Windows updates');
  if (execNeeds.length) poolPrivs.push([agentExec, execNeeds.join(', ')]);
  const backups = backupSettings();
  if (backups.enabled && backups.storage) {
    poolPrivs.push(['VM.Backup', 'back up and restore']);
    // Proxmox checks the restored configuration against these
    for (const p of ['VM.Config.CPU', 'VM.Config.Memory', 'VM.Config.Disk', 'VM.Config.Network', 'VM.Config.Options',
      'VM.Config.HWType', 'VM.Config.CDROM', 'VM.Config.Cloudinit']) {
      if (!poolPrivs.some(([x]) => x === p)) poolPrivs.push([p, 'restore backups']);
    }
    reqs.push({ path: `/storage/${backups.storage}`, label: `Backup storage ${backups.storage}`, role: 'PanelBackup',
      privs: [['Datastore.AllocateSpace', 'store backups'], ['Datastore.Audit', 'list backups']] });
  }
  reqs.push({ path: pool, label: `Customer pool ${config.pve.pool}`, privs: poolPrivs });

  for (const t of ctx.templates) {
    reqs.push({ path: `/vms/${t.vmid}`, label: `Template ${t.vmid} (${t.label})`, privs: [['VM.Audit', 'see it'], ['VM.Clone', 'clone it']] });
  }
  for (const st of ctx.storages) {
    reqs.push({ path: `/storage/${st}`, label: `Storage ${st}`, privs: [['Datastore.AllocateSpace', 'create disks'], ['Datastore.Audit', 'show free space', 'warn']] });
  }
  if (config.network.enabled) {
    reqs.push({ path: '/sdn', label: 'SDN (customer networks)', role: 'PanelNetwork', privs: [['SDN.Audit', 'read networks'], ['SDN.Allocate', 'create networks']] });
    reqs.push({ path: `/sdn/zones/${config.network.zone}`, label: `SDN zone ${config.network.zone}`, role: 'PanelNetwork', privs: [['SDN.Use', 'connect servers']] });
  }
  if (config.vpn.enabled) {
    reqs.push({ path: `/vms/${config.vpn.gatewayVmid}`, label: `VPN gateway ${config.vpn.gatewayVmid}`, role: 'PanelGateway',
      privs: [['VM.Audit', 'find it'], [agentExec, 'configure WireGuard']] });
  }
  return reqs;
}

async function checkPermissions(c, ctx) {
  if (config.pve.tokenId.startsWith('root@pam')) {
    c.add('permissions', 'perm:root', 'warn', 'The panel uses a token of root@pam',
      'A leaked token could do anything in Proxmox. The panel only needs a few rights on its pool.', {
        text: 'Create a dedicated user with a limited role (see the documentation, Prepare Proxmox VE) and switch PVE_TOKEN_ID/PVE_TOKEN_SECRET to its token.',
        commands: [`pveum user add panel@pve --comment "PVE Panel"`, 'pveum user token add panel@pve panel --privsep 0'],
      });
  }
  try {
    const top = await privilegesAt('/');
    const admin = ['Permissions.Modify', 'Sys.Modify', 'User.Modify', 'Sys.PowerMgmt'].filter((p) => p in top);
    if (admin.length) {
      c.add('permissions', 'perm:broad', 'warn', 'The token has administrator rights on the whole datacenter',
        `It holds ${admin.join(', ')} on /. The panel needs none of them.`, {
          text: `Remove the broad role from ${tokenUser()} on / and grant only the paths listed in this check.`,
          commands: [`pveum acl delete / --users ${tokenUser()} --roles <role>`],
        });
    }
  } catch (err) {
    if (!isForbidden(err)) throw err;
  }

  for (const r of await requirements(ctx)) {
    let have;
    try {
      have = await privilegesAt(r.path);
    } catch (err) {
      c.add('permissions', `perm:${r.path}`, 'skipped', `${r.label}: couldn't read the permissions`, err.message);
      continue;
    }
    const missing = r.privs.filter(([p]) => !(p in have));
    const hard = missing.filter(([, , level]) => level !== 'warn');
    if (!missing.length) {
      c.add('permissions', `perm:${r.path}`, 'ok', `${r.label}: all needed rights`, r.path);
      continue;
    }
    const names = [...new Set(missing.map(([p]) => p))];
    const why = [...new Set(missing.map(([, w]) => w))].join(', ');
    c.add('permissions', `perm:${r.path}`, hard.length ? 'error' : 'warn',
      `${r.label}: ${names.length} right${names.length > 1 ? 's' : ''} missing`,
      `Missing on ${r.path}: ${names.join(', ')} (needed to ${why}).`, aclFix(r.path, names, r.role));
  }
}

async function checkServers(c, ctx) {
  const rows = db.prepare(`
    SELECT v.vmid, v.label, v.created_by_customer, u.email FROM vms v JOIN users u ON u.id = v.user_id
    WHERE v.state = 'ready' AND u.deleting = 0 ORDER BY v.vmid`).all();
  if (!rows.length) {
    c.add('servers', 'srv:none', 'info', 'No servers assigned yet', 'Assign a server under Servers, or let customers create them.');
    return;
  }
  const missing = rows.filter((r) => !ctx.guests.has(r.vmid));
  const list = (xs) => xs.slice(0, 12).map((r) => `${r.vmid}${r.label ? ` (${r.label})` : ''} – ${r.email}`).join('; ')
    + (xs.length > 12 ? `; and ${xs.length - 12} more` : '');
  if (missing.length) {
    c.add('servers', 'srv:missing', 'error', `${missing.length} assigned server${missing.length > 1 ? 's are' : ' is'} not visible in Proxmox`,
      `${list(missing)}. They were deleted in Proxmox, or the token has no rights on them (not in the pool ${config.pve.pool}?).`, {
        text: `Add them to the pool, or remove the assignment under Servers if they were deleted.`,
        commands: [`pveum pool modify ${config.pve.pool} --vms ${missing.map((r) => r.vmid).join(',')}`],
      });
  }

  // What counts is the token's rights on each server (wherever they come from).
  // Proxmox only reveals a server's pool with Pool.Audit, which the panel doesn't
  // need, so a missing pool field says nothing.
  const NEEDED = ['VM.Audit', 'VM.PowerMgmt', 'VM.Console', 'VM.Snapshot'];
  const visible = rows.filter((r) => ctx.guests.has(r.vmid));
  const lacking = [];
  for (const r of visible) {
    try {
      const have = await privilegesAt(`/vms/${r.vmid}`);
      const miss = NEEDED.filter((p) => !(p in have));
      if (miss.length) lacking.push({ ...r, miss });
    } catch { /* unreadable: reported by the permission checks */ }
  }
  if (lacking.length) {
    const names = [...new Set(lacking.flatMap((r) => r.miss))];
    c.add('servers', 'srv:rights', 'error', `The panel lacks rights on ${lacking.length} assigned server${lacking.length > 1 ? 's' : ''}`,
      `${list(lacking)}. Missing: ${names.join(', ')}. Customers can't control ${lacking.length > 1 ? 'these servers' : 'this server'}.`, {
        text: `Put them into the pool ${config.pve.pool}, so the panel's pool rights cover them.`,
        commands: [`pveum pool modify ${config.pve.pool} --vms ${lacking.map((r) => r.vmid).join(',')}`],
      });
  }
  // Only when Proxmox does show the pool (the token has Pool.Audit there)
  const outside = visible.filter((r) => !lacking.some((l) => l.vmid === r.vmid)
    && ctx.guests.get(r.vmid).pool && ctx.guests.get(r.vmid).pool !== config.pve.pool);
  if (outside.length) {
    c.add('servers', 'srv:pool', 'warn', `${outside.length} assigned server${outside.length > 1 ? 's are' : ' is'} outside the pool ${config.pve.pool}`,
      `${outside.map((r) => `${r.vmid} in ${ctx.guests.get(r.vmid).pool}`).join('; ')}. They work because the token has rights on them some other way.`, {
        text: 'Move them into the pool, so the panel\'s pool rights cover them.',
        commands: [`pveum pool modify ${config.pve.pool} --vms ${outside.map((r) => r.vmid).join(',')}`],
      });
  }
  if (!missing.length && !lacking.length && !outside.length) {
    c.add('servers', 'srv:ok', 'ok', `The panel has the needed rights on all ${rows.length} assigned servers`);
  }
}

async function checkTemplates(c, ctx) {
  if (!ctx.templates.length) {
    c.add('templates', 'tpl:none', ctx.canCreateUsers ? 'warn' : 'info', 'No templates offered',
      ctx.canCreateUsers ? 'Some customers may create servers, but there is nothing to choose from.' : 'Customers can only use servers you assign.',
      ctx.canCreateUsers ? { text: 'Offer a template under Templates.' } : null);
    return;
  }
  const storageFree = new Map();
  for (const t of ctx.templates) {
    const name = `Template ${t.vmid} (${t.label})`;
    const g = ctx.guests.get(t.vmid);
    if (!g || !g.template) {
      c.add('templates', `tpl:${t.vmid}`, 'error', `${name} is offered but not available`,
        g ? 'The VM is no longer a template.' : 'It was deleted in Proxmox, or the token can\'t see it.',
        { text: 'Withdraw it under Templates, or restore it in Proxmox.' });
      continue;
    }
    let cfg;
    try {
      cfg = await pve.get(`/nodes/${encodeURIComponent(g.node)}/qemu/${t.vmid}/config`);
    } catch (err) {
      c.add('templates', `tpl:${t.vmid}`, 'skipped', `${name}: couldn't read its configuration`, err.message);
      continue;
    }
    const problems = [];
    const commands = [];
    const agentOn = /^(1|enabled=1)\b/.test(String(cfg.agent ?? ''));
    const windows = t.setup === 'windows';
    if (!agentOn) {
      problems.push({ level: windows ? 'error' : 'warn',
        text: windows ? 'the guest agent is off: Windows servers can\'t be set up' : 'the guest agent is off: no IP addresses, Tailscale or quick readiness checks' });
      commands.push(`qm set ${t.vmid} --agent enabled=1`);
    }
    if (!windows && !Object.values(cfg).some((v) => /cloudinit/.test(String(v)))) {
      problems.push({ level: 'error', text: 'no cloud-init drive: host name, user, password and SSH keys aren\'t applied' });
      commands.push(`qm set ${t.vmid} --ide2 ${String(cfg[bootDiskKey(cfg)] ?? 'local-lvm:').split(':')[0]}:cloudinit`);
    }
    if (windows && cfg.ostype && !/^w/.test(cfg.ostype)) {
      problems.push({ level: 'warn', text: `it's set up as Windows, but its OS type is ${cfg.ostype}` });
    }
    // Storage for the clone and its free space
    const disk = cfg[bootDiskKey(cfg)];
    const storage = t.storage || String(disk ?? '').split(':')[0];
    const needGb = Math.ceil(diskSizeGb(disk)) || 1;
    if (storage) {
      const key = `${g.node}/${storage}`;
      if (!storageFree.has(key)) {
        storageFree.set(key, await pve.get(`/nodes/${encodeURIComponent(g.node)}/storage/${encodeURIComponent(storage)}/status`)
          .then((s) => ({ s }), (err) => ({ err })));
      }
      const { s, err } = storageFree.get(key);
      if (err && !isForbidden(err)) {
        problems.push({ level: 'error', text: `the storage ${storage} for new disks isn't available on ${g.node} (${err.message})` });
      } else if (s) {
        const free = (s.avail ?? 0) / GB;
        const total = (s.total ?? 0) / GB;
        if (s.active === 0) problems.push({ level: 'error', text: `the storage ${storage} is not active` });
        else if (free < needGb * 2 || (total && free / total < 0.1)) {
          problems.push({ level: 'warn', text: `the storage ${storage} has only ${free.toFixed(0)} GB free of ${total.toFixed(0)} GB` });
        }
      }
    }
    if (!problems.length) {
      c.add('templates', `tpl:${t.vmid}`, 'ok', `${name} is ready`,
        `${windows ? 'Windows (guest agent)' : 'cloud-init'}, ${needGb} GB disk${storage ? ` on ${storage}` : ''}.`);
    } else {
      const status = problems.some((p) => p.level === 'error') ? 'error' : 'warn';
      c.add('templates', `tpl:${t.vmid}`, status, `${name}: ${problems.length} problem${problems.length > 1 ? 's' : ''}`,
        problems.map((p) => p.text).join('; ') + '.',
        commands.length ? { text: 'On a Proxmox node (a template can be changed without booting it):', commands } : null);
    }
  }
}

async function checkNetworks(c, ctx) {
  if (!config.network.enabled) {
    c.add('network', 'net:off', 'info', 'Customer networks are off',
      'Servers keep the network of their template; customers are not isolated from each other by the panel. Set CUSTOMER_NETWORKS=true to give every customer an isolated network.');
    return;
  }
  const nets = allNetworks();
  const zones = await pve.get('/cluster/sdn/zones');
  const zone = zones.find((z) => z.zone === config.network.zone);
  if (!zone) {
    c.add('network', 'net:zone', nets.length ? 'error' : 'info', `SDN zone ${config.network.zone} ${nets.length ? 'is missing' : 'doesn\'t exist yet'}`,
      nets.length ? 'Customers have networks, but their zone is gone.' : 'It is created automatically with the first customer server.',
      nets.length ? { text: 'Restore the zone (Datacenter, SDN, Zones) or check SDN_ZONE.' } : null);
  } else {
    const issues = [];
    if (zone.type && zone.type !== 'simple') issues.push(`its type is ${zone.type}, the panel expects simple`);
    if (zone.dhcp !== undefined && zone.dhcp !== 'dnsmasq') issues.push('DHCP is not enabled (dhcp=dnsmasq): servers get no address');
    c.add('network', 'net:zone', issues.length ? 'warn' : 'ok', `SDN zone ${config.network.zone}${issues.length ? ': check its settings' : ' exists'}`,
      issues.join('; '), issues.length ? {
        text: 'DHCP also needs dnsmasq installed on every node (its default service off).',
        commands: [`pvesh set /cluster/sdn/zones/${config.network.zone} --dhcp dnsmasq --ipam pve`, 'apt install dnsmasq && systemctl disable --now dnsmasq', 'pvesh set /cluster/sdn'],
      } : null);
  }

  const vnets = await pve.get('/cluster/sdn/vnets', { pending: 1 });
  const names = new Set(vnets.map((v) => v.vnet));
  const gone = nets.filter((n) => !names.has(n.vnet));
  if (gone.length) {
    c.add('network', 'net:vnets', 'error', `${gone.length} customer network${gone.length > 1 ? 's are' : ' is'} missing in Proxmox`,
      gone.map((n) => `${n.vnet} (${n.email ?? 'no customer'})`).join(', ') + '. Servers of these customers have no network.',
      { text: 'Restore the VNets in Datacenter, SDN, or delete and recreate the affected customers\' servers.' });
  } else if (nets.length) {
    c.add('network', 'net:vnets', 'ok', `All ${nets.length} customer networks exist`);
  }
  const pending = vnets.filter((v) => v.state); // new | changed | deleted, until applied
  if (pending.length) {
    c.add('network', 'net:pending', 'warn', 'There are SDN changes that were not applied',
      `${pending.map((v) => `${v.vnet} (${v.state})`).join(', ')}. Until they're applied, Proxmox runs the old network configuration.`,
      { text: 'Apply them in Datacenter, SDN (Apply), or:', commands: ['pvesh set /cluster/sdn'] });
  }

  // The datacenter firewall: without it, no VM firewall rule (= isolation) is active
  try {
    const fw = await pve.get('/cluster/firewall/options');
    if (Number(fw?.enable) === 1) {
      c.add('network', 'net:dcfw', 'ok', 'The datacenter firewall is on');
    } else {
      c.add('network', 'net:dcfw', 'error', 'The datacenter firewall is off: customers are NOT isolated',
        'The panel isolates customers with VM firewall rules, and Proxmox only applies them while the datacenter firewall is on.', {
          text: 'First allow your management access (otherwise you can lock yourself out: the default for incoming traffic is DROP), then switch it on (Datacenter, Firewall, Options).',
          commands: [
            'pvesh create /cluster/firewall/rules --type in --action ACCEPT --source <your-admin-network> --dport 8006 --proto tcp --enable 1',
            'pvesh create /cluster/firewall/rules --type in --action ACCEPT --source <your-admin-network> --dport 22 --proto tcp --enable 1',
            'pvesh set /cluster/firewall/options --enable 1',
          ],
        });
    }
  } catch (err) {
    if (!isForbidden(err)) throw err;
    c.add('network', 'net:dcfw', 'skipped', 'Couldn\'t check the datacenter firewall',
      'Reading it needs Sys.Audit on /, which the panel doesn\'t otherwise need. Customer isolation only works while it is on.', {
        text: 'Optional, read-only: give the panel Sys.Audit on / (not inherited), so this check can see it.',
        commands: ['pveum role add PanelAudit --privs "Sys.Audit"', `pveum acl modify / --users ${tokenUser()} --roles PanelAudit --propagate 0`],
      });
  }

  // Every customer-created server: NIC firewall flag, VM firewall on, panel rules present
  const rows = db.prepare(`
    SELECT v.vmid, n.vnet FROM vms v JOIN networks n ON n.user_id = v.user_id
    WHERE v.created_by_customer = 1 AND v.state = 'ready'`).all();
  const broken = [];
  let checked = 0;
  for (const row of rows) {
    const g = ctx.guests.get(row.vmid);
    if (!g) continue;
    try {
      const p = guestPath(g);
      const [cfg, opts, rules] = await Promise.all([
        pve.get(`${p}/config`), pve.get(`${p}/firewall/options`), pve.get(`${p}/firewall/rules`),
      ]);
      const why = [];
      const nic = Object.entries(cfg).find(([k, v]) => /^net\d+$/.test(k) && new RegExp(`bridge=${row.vnet}(,|$)`).test(String(v)));
      if (!nic) why.push(`not connected to ${row.vnet}`);
      else if (!/(^|,)firewall=1(,|$)/.test(String(nic[1]))) why.push('firewall flag off on the network card');
      if (Number(opts?.enable) !== 1) why.push('VM firewall off');
      if (!rules.some((r) => r.comment === 'panel: allow own network')) why.push('panel rules missing');
      if (why.length) broken.push(`${row.vmid}: ${why.join(', ')}`);
      checked += 1;
    } catch {
      // unreadable: the permission check already reports why
    }
  }
  if (broken.length) {
    c.add('network', 'net:isolation', 'error', `${broken.length} customer server${broken.length > 1 ? 's are' : ' is'} not isolated`,
      broken.join('; ') + '.', {
        text: 'In Proxmox, for each server: Firewall, Options, Firewall = Yes; Hardware, Network Device, Firewall checked. '
          + 'Missing panel rules are added again when the panel restarts.',
        commands: ['pvesh set /nodes/<node>/qemu/<vmid>/firewall/options --enable 1'],
      });
  } else if (checked) {
    c.add('network', 'net:isolation', 'ok', `All ${checked} customer-created servers are isolated`, 'Firewall on, panel rules present.');
  }
}

async function checkRemote(c) {
  if (config.vpn.enabled) {
    const { status } = await Promise.race([adminOverview(), timeout(60_000, 'The VPN gateway')]);
    if (status.reachable) {
      c.add('remote', 'vpn:gateway', 'ok', `WireGuard gateway ${config.vpn.gatewayVmid} answers`, `Customers connect to ${config.vpn.endpoint}.`);
    } else {
      c.add('remote', 'vpn:gateway', 'error', `WireGuard gateway ${config.vpn.gatewayVmid} doesn't answer`, status.error ?? '', {
        text: 'Check that the gateway VM runs, its guest agent is enabled and running, and WireGuard was set up with docs/vpn/setup-gateway.sh.',
        commands: [`qm guest cmd ${config.vpn.gatewayVmid} ping`, `qm guest exec ${config.vpn.gatewayVmid} -- wg show wg0`],
      });
    }
    const host = config.vpn.endpoint.split(':')[0];
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
      try {
        await Promise.race([dns.lookup(host), timeout(5000, 'DNS')]);
        c.add('remote', 'vpn:endpoint', 'ok', `${host} resolves`, 'Make sure UDP port ' + config.vpn.endpoint.split(':')[1] + ' is forwarded to the gateway.');
      } catch {
        c.add('remote', 'vpn:endpoint', 'warn', `VPN_ENDPOINT ${host} doesn't resolve here`,
          'Customer devices can\'t connect if the name doesn\'t resolve for them either.', { text: 'Create the DNS record, or use the public IP address in VPN_ENDPOINT.' });
      }
    }
  } else {
    c.add('remote', 'vpn:off', 'info', 'WireGuard VPN is off', 'Set VPN_ENABLED=true to give customers VPN access to their network.');
  }
  if (!config.tailscale.enabled) c.add('remote', 'ts:off', 'info', 'Tailscale is off');
}

async function checkBackups(c) {
  const s = backupSettings();
  if (!s.enabled) {
    c.add('backups', 'bak:off', 'info', 'Backups for customers are off', 'Switch them on under Settings, Backups (needs a backup storage, ideally a Proxmox Backup Server).');
    return;
  }
  const storages = await backupStorages();
  const st = storages.find((x) => x.id === s.storage);
  if (!st) {
    c.add('backups', 'bak:storage', 'error', `The backup storage ${s.storage} isn't available`,
      'It doesn\'t exist, isn\'t enabled, doesn\'t allow the content "backup", or the token can\'t see it. Customers can\'t make or restore backups.', {
        text: 'Check the storage in Datacenter, Storage, and give the panel its rights there:',
        commands: [
          'pveum role add PanelBackup --privs "Datastore.AllocateSpace Datastore.Audit"',
          `pveum acl modify /storage/${s.storage} --users ${config.pve.tokenId.split('!')[0]} --roles PanelBackup`,
        ],
      });
    return;
  }
  const nodes = [...new Set([...(await clusterGuests()).values()].map((g) => g.node))];
  const missingOn = nodes.filter((n) => !st.nodes.includes(n));
  if (missingOn.length) {
    c.add('backups', 'bak:storage', 'warn', `The backup storage ${s.storage} is missing on ${missingOn.join(', ')}`,
      'Servers on these nodes can\'t be backed up.', { text: 'Make the storage available on all nodes (Datacenter, Storage, Edit, Nodes).' });
  } else {
    c.add('backups', 'bak:storage', 'ok', `Backups go to ${s.storage}${st.type === 'pbs' ? ' (Proxmox Backup Server)' : ''}`,
      `Up to ${s.maxPerServer} backups per server${s.schedules ? ', automatic backups allowed' : ''}.`);
  }
  if (st.type !== 'pbs') {
    c.add('backups', 'bak:files', 'info', 'Restoring single files needs a Proxmox Backup Server',
      `${s.storage} is a ${st.type ?? 'non-PBS'} storage: customers can back up and restore whole servers, but not browse files in a backup.`);
  }
}

function checkEmail(c) {
  if (emailConfigured()) {
    c.add('email', 'mail:on', 'ok', 'Email is set up', 'Use "Send test email" under Settings to test delivery.');
    return;
  }
  const expiring = db.prepare('SELECT COUNT(*) AS n FROM users WHERE expiry_mode IS NOT NULL AND deleting = 0').get().n;
  if (expiring) {
    c.add('email', 'mail:on', 'warn', 'Email is not set up, but servers expire',
      `${expiring} customer${expiring > 1 ? 's have' : ' has'} expiring servers. Without email they get no reminders, and expired servers are never deleted (customers must be warned first).`,
      { text: 'Set up email under Settings.' });
  } else {
    c.add('email', 'mail:on', 'info', 'Email is not set up', 'Needed for invitations, expiry reminders and setup check alerts. Set it up under Settings.');
  }
}

function checkSecurity(c, ctx) {
  const secret = config.jwtSecret;
  if (secret.length < 32 || /change-?me|replace-?(me|with)|^(secret|password|example)/i.test(secret)) {
    c.add('security', 'sec:jwt', 'error', 'JWT_SECRET is weak',
      'It signs every session and protects the stored 2FA and SMTP secrets. A guessable value lets anyone forge a sign-in.', {
        text: 'Set a long random value and restart. Everyone has to sign in again; stored two-factor and SMTP secrets must be set up again.',
        commands: ['openssl rand -base64 48'],
      });
  } else {
    c.add('security', 'sec:jwt', 'ok', 'JWT_SECRET is long and random-looking');
  }

  const publicUrls = Object.values(config.oidc.publicUrl).filter(Boolean);
  const localOnly = (u) => /^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(u);
  if (!config.cookieSecure) {
    c.add('security', 'sec:cookie', publicUrls.length && publicUrls.every(localOnly) ? 'info' : 'warn', 'Session cookies are also sent over plain http',
      'COOKIE_SECURE=false is meant for testing without https.', { text: 'Serve the panel over https (e.g. with the Caddy profile) and remove COOKIE_SECURE=false.' });
  } else {
    c.add('security', 'sec:cookie', 'ok', 'Session cookies are only sent over https');
  }

  const inContainer = process.env.PANEL_IN_CONTAINER === '1';
  const loopback = ['127.0.0.1', '::1', 'localhost'].includes(config.adminHost);
  const ip = String(ctx.requestIp ?? '').replace(/^::ffff:/, '');
  const privateIp = (a) => /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|::1$|f[cd]|fe80)/i.test(a);
  if (ip && !privateIp(ip)) {
    c.add('security', 'sec:admin', 'error', 'The admin interface is reachable from the internet',
      `This check was opened from the public address ${ip}.`, {
        text: 'Publish port 3001 only on 127.0.0.1 and use an SSH tunnel or VPN.',
        commands: ['ports: ["127.0.0.1:3001:3001"]', 'ssh -L 3001:127.0.0.1:3001 you@panel-host'],
      });
  } else if (!loopback && !inContainer) {
    c.add('security', 'sec:admin', 'warn', `The admin interface listens on ${config.adminHost}`,
      'Anyone who can reach that address gets the sign-in page of the administration.', { text: 'Use ADMIN_HOST=127.0.0.1 with an SSH tunnel, or restrict it with a firewall/VPN.' });
  } else {
    c.add('security', 'sec:admin', 'ok', 'The admin interface is not exposed', inContainer ? 'Inside a container: make sure port 3001 is only published on 127.0.0.1 of the host.' : '');
  }

  // A passkey doesn't stop a stolen password from being used: only 2FA (or no password sign-in) does
  const admins = config.auth.password.admin ? db.prepare(`
    SELECT email FROM users WHERE is_admin = 1 AND deleting = 0 AND totp_enabled = 0 AND password_set = 1`).all() : [];
  if (admins.length) {
    c.add('security', 'sec:admin2fa', 'warn', `${admins.length} administrator${admins.length > 1 ? 's' : ''} can sign in with a password alone`,
      admins.map((a) => a.email).join(', ') + '.', {
        text: 'Set up two-factor authentication under Your account, and require it for administrators (Customers, 2FA). '
          + 'With single sign-on, you can also switch password sign-in off for the admin interface (PASSWORD_LOGIN_ADMIN=false).',
      });
  } else {
    c.add('security', 'sec:admin2fa', 'ok', config.auth.password.admin
      ? 'All administrators use two-factor authentication' : 'Administrators sign in with single sign-on only');
  }

  if (process.env.INITIAL_ADMIN_PASSWORD) {
    c.add('security', 'sec:initial', 'warn', 'INITIAL_ADMIN_PASSWORD is still set',
      'It was only needed to create the first administrator, and anyone who can read the environment sees it.',
      { text: 'Remove INITIAL_ADMIN_PASSWORD from .env / stack.env and redeploy.' });
  }

  if (config.passkeys.enabled) {
    const url = config.oidc.publicUrl.customer;
    if (!url) {
      c.add('security', 'sec:passkeys', 'info', 'PANEL_PUBLIC_URL is not set',
        'Passkeys are tied to the address the browser used. Set the public address so they keep working when the panel is reached under another name.',
        { text: 'Set PANEL_PUBLIC_URL=https://panel.example.com' });
    } else if (!/^https:\/\//.test(url) && !localOnly(url)) {
      c.add('security', 'sec:passkeys', 'warn', 'Passkeys can\'t work on this address', `${url} is not https; browsers only allow passkeys over https.`,
        { text: 'Serve the panel over https and update PANEL_PUBLIC_URL.' });
    }
  }
}

async function checkMaintenance(c) {
  const u = await updateStatus();
  if (u.updateAvailable) {
    c.add('maintenance', 'upd:version', 'warn', `Version ${u.latest.version} is available`, `Running ${versionInfo.version}. See the About tab for how to update.`);
  } else if (u.checked && u.latest) {
    c.add('maintenance', 'upd:version', 'ok', `Running the latest release (${versionInfo.version})`);
  } else {
    c.add('maintenance', 'upd:version', 'info', `Running ${versionInfo.version}`, u.reason ? `Couldn't check for updates: ${u.reason}.` : '');
  }

  const dir = path.join(path.dirname(path.resolve(config.dbPath)), 'backups');
  let newest = 0;
  try {
    for (const f of fs.readdirSync(dir)) if (f.endsWith('.db')) newest = Math.max(newest, fs.statSync(path.join(dir, f)).mtimeMs);
  } catch { /* no backups folder */ }
  const days = newest ? Math.floor((Date.now() - newest) / 86_400_000) : null;
  if (days === null || days > 7) {
    c.add('maintenance', 'bak:db', 'info', days === null ? 'No database backup found' : `The newest database backup is ${days} days old`,
      'Only backups written with npm run db:backup next to the database are seen here; your own volume backups count just as well.',
      { text: 'Back up the database regularly, e.g. daily with cron:', commands: ['docker compose exec panel npm run db:backup'] });
  } else {
    c.add('maintenance', 'bak:db', 'ok', `Database backed up ${days === 0 ? 'today' : `${days} day${days > 1 ? 's' : ''} ago`}`);
  }
}

// ---- Running -------------------------------------------------------------------------

let running = null;

/**
 * Runs all checks (one run at a time; a second caller gets the same run).
 * `requestIp`: address the admin interface was opened from (for the exposure check).
 */
export function runSetupCheck(options = {}) {
  if (!running) running = runOnce(options).finally(() => { running = null; });
  return running;
}

async function runOnce({ requestIp = null, automatic = false, log } = {}) {
  const started = Date.now();
  const c = collector();
  const ctx = { requestIp };
  const step = async (group, fn) => {
    try {
      await Promise.race([fn(c, ctx), timeout(90_000, 'This check')]);
    } catch (err) {
      c.add(group, `${group}:failed`, 'skipped', 'This part couldn\'t be checked', err.message);
    }
  };

  await step('proxmox', checkProxmox);
  if (ctx.reachable) {
    ctx.guests = await clusterGuests(true).catch(() => new Map());
    ctx.templates = db.prepare('SELECT * FROM templates ORDER BY vmid').all();
    ctx.windowsTemplates = ctx.templates.some((t) => t.setup === 'windows');
    ctx.canCreateUsers = db.prepare('SELECT COUNT(*) AS n FROM users WHERE can_create = 1 AND deleting = 0').get().n > 0;
    ctx.creating = ctx.templates.length > 0 || ctx.canCreateUsers;
    ctx.windowsServers = db.prepare("SELECT COUNT(*) AS n FROM vms WHERE ostype LIKE 'win%'").get().n > 0;
    ctx.storages = [...new Set(ctx.templates.map((t) => {
      if (t.storage) return t.storage;
      return null;
    }).filter(Boolean))];
    // templates without their own target storage clone to the template's disk storage
    for (const t of ctx.templates.filter((x) => !x.storage)) {
      const g = ctx.guests.get(t.vmid);
      if (!g) continue;
      try {
        const cfg = await pve.get(`/nodes/${encodeURIComponent(g.node)}/qemu/${t.vmid}/config`);
        const st = String(cfg[bootDiskKey(cfg)] ?? '').split(':')[0];
        if (st && !ctx.storages.includes(st)) ctx.storages.push(st);
      } catch { /* reported by the template check */ }
    }
    await step('permissions', checkPermissions);
    await step('servers', checkServers);
    await step('templates', checkTemplates);
    await step('network', checkNetworks);
  }
  await step('remote', checkRemote);
  if (ctx.reachable) await step('backups', checkBackups);
  await step('email', checkEmail);
  await step('security', checkSecurity);
  await step('maintenance', checkMaintenance);

  const order = new Map(GROUPS.map(([g], i) => [g, i]));
  const checks = c.checks.sort((a, b) => order.get(a.group) - order.get(b.group));
  const summary = { ok: 0, warn: 0, error: 0, info: 0, skipped: 0 };
  for (const ch of checks) summary[ch.status] += 1;
  const result = {
    at: new Date().toISOString(), durationMs: Date.now() - started, automatic, summary, checks,
  };
  writeKey('setupcheck_result', result);
  await notifyNewProblems(result, { automatic, log });
  return result;
}

/** Emails administrators about problems that weren't there (or not this bad) before. */
async function notifyNewProblems(result, { automatic, log }) {
  const s = readKey('setupcheck') ?? {};
  const known = new Set(s.known ?? []);
  const problems = result.checks.filter((ch) => PROBLEM.includes(ch.status));
  const keys = problems.map((ch) => `${ch.id}:${ch.status}`);
  const fresh = problems.filter((ch) => !known.has(`${ch.id}:${ch.status}`));
  writeKey('setupcheck', { ...s, known: keys });
  // Problems found by a run an admin started are already on their screen
  if (!automatic || !fresh.length) return;
  log?.warn(`Setup check: ${fresh.length} new problem(s): ${fresh.map((f) => f.title).join('; ')}`);
  if (s.notify === false || !emailConfigured()) return;
  const admins = db.prepare('SELECT email FROM users WHERE is_admin = 1 AND deleting = 0').all();
  for (const a of admins) {
    await sendMail({ to: a.email, ...setupCheckMessage({ fresh, total: problems.length }) })
      .catch((err) => log?.warn(`Setup check email to ${a.email} failed: ${err.message}`));
  }
}

/**
 * Automatic runs: shortly after start, then every SETUP_CHECK_HOURS (default 24;
 * 0 = only when an administrator runs it).
 */
export function startSetupCheckScheduler(log) {
  const hours = Number(process.env.SETUP_CHECK_HOURS ?? 24);
  if (!(hours > 0)) {
    log.info('Automatic setup checks are off (SETUP_CHECK_HOURS=0)');
    return;
  }
  const tick = async () => {
    try {
      const r = await runSetupCheck({ automatic: true, log });
      if (r.summary.error || r.summary.warn) {
        log.info(`Setup check: ${r.summary.error} error(s), ${r.summary.warn} warning(s); see Setup check in the admin interface`);
      }
    } catch (err) {
      log.warn(`Setup check failed: ${err.message}`);
    }
  };
  const first = Number(process.env.SETUP_CHECK_FIRST_SECONDS ?? 60) * 1000;
  setTimeout(tick, first).unref();
  setInterval(tick, Math.max(0.001, hours) * 3600_000).unref();
}
