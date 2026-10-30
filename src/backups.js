// Backups for customers, stored on a Proxmox Backup Server (or any backup
// storage) through the Proxmox VE API — the panel never talks to PBS directly
// and never holds PBS credentials.
//
//   back up now ─┐                       ┌─ restore (optionally back up first,
//   schedule ────┴─ queue ─ vzdump ─ PBS ─┤   stop, restore, re-isolate, start)
//                                         └─ browse files ─ download a file/folder
//
// Privacy: customers only see backups of their server made AFTER it became
// theirs (vms.assigned_at), so a reused VM ID or a reassigned server never shows
// someone else's backups. Customers may delete only backups made through the
// panel; backups your own Proxmox backup jobs make are shown and restorable.

import { db, audit } from './db.js';
import { config } from './config.js';
import { pve, clusterGuests, guestPath, waitTask, invalidateGuestCache, PveError } from './pve.js';
import { networkOf, ensureIsolation } from './network.js';
import { limitsOf, usageOf, diskTotalGb } from './provision.js';
import { activeRun as activeWindowsUpdate } from './winupdate.js';

const KEY = 'backups';
export const DEFAULT_SETTINGS = {
  enabled: false,
  storage: '',             // Proxmox storage ID, e.g. "pbs"
  maxPerServer: 5,         // backups made through the panel, per server
  schedules: true,         // customers may set up automatic backups
  keepAfterDelete: false,  // keep panel-made backups when their server is deleted
};
const PARALLEL = Math.max(1, Number(process.env.BACKUP_PARALLEL) || 2);
const TASK_TIMEOUT = 12 * 3600_000;
const ROOT = Buffer.from('/').toString('base64');

export class BackupError extends Error {
  constructor(status, message) {
    super(message);
    this.statusCode = status;
    this.expose = true;
  }
}

// ---- Settings -----------------------------------------------------------------------

export function backupSettings() {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(KEY);
  return { ...DEFAULT_SETTINGS, ...(row ? JSON.parse(row.value) : {}) };
}

export function saveBackupSettings(input) {
  const next = backupSettings();
  for (const k of ['enabled', 'schedules', 'keepAfterDelete']) if (typeof input[k] === 'boolean') next[k] = input[k];
  if (typeof input.storage === 'string') next.storage = input.storage.trim();
  if (Number.isInteger(input.maxPerServer)) next.maxPerServer = input.maxPerServer;
  if (next.enabled && !next.storage) throw new BackupError(400, 'Choose the storage for backups');
  db.prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(KEY, JSON.stringify(next));
  storageCache.clear();
  return next;
}

/** Panel-made backups allowed per server for this customer (0 = none). */
export function maxBackupsFor(userId) {
  const s = backupSettings();
  const own = db.prepare('SELECT max_backups FROM users WHERE id = ?').get(userId)?.max_backups;
  return own ?? s.maxPerServer;
}

export function backupsAvailableFor(userId) {
  const s = backupSettings();
  return s.enabled && !!s.storage && maxBackupsFor(userId) > 0;
}

/** Storages that can hold backups, per node (for the admin settings). */
export async function backupStorages() {
  const nodes = [...new Set([...(await clusterGuests(true)).values()].map((g) => g.node))];
  const found = new Map();
  for (const node of nodes) {
    try {
      for (const st of await pve.get(`/nodes/${encodeURIComponent(node)}/storage`, { content: 'backup', enabled: 1 })) {
        if (!found.has(st.storage)) found.set(st.storage, { id: st.storage, type: st.type ?? null, nodes: [] });
        found.get(st.storage).nodes.push(node);
      }
    } catch { /* node offline or no rights: the setup check reports it */ }
  }
  return [...found.values()].sort((a, b) => a.id.localeCompare(b.id));
}

// Storage type per node (PBS = file restore possible), cached for 5 minutes
const storageCache = new Map();
async function storageType(node, storage) {
  const key = `${node}/${storage}`;
  const hit = storageCache.get(key);
  if (hit && Date.now() - hit.at < 300_000) return hit.type;
  let type = null;
  try {
    const list = await pve.get(`/nodes/${encodeURIComponent(node)}/storage`, { content: 'backup' });
    type = list.find((s) => s.storage === storage)?.type ?? null;
  } catch { /* unknown */ }
  storageCache.set(key, { at: Date.now(), type });
  return type;
}

// ---- Listing (with the ownership filter) ------------------------------------------------

const madeByPanel = db.prepare('SELECT * FROM backups WHERE vmid = ? AND user_id = ? AND storage = ?');
const contentPath = (node, storage) => `/nodes/${encodeURIComponent(node)}/storage/${encodeURIComponent(storage)}/content`;

/**
 * Backups of this server the customer may see, newest first. Also forgets
 * panel records of backups that were removed in Proxmox/PBS meanwhile.
 */
export async function visibleBackups(row, guest) {
  const s = backupSettings();
  if (!s.storage) return [];
  const items = await pve.get(contentPath(guest.node, s.storage), { content: 'backup', vmid: row.vmid });
  const since = Math.floor(Date.parse(row.assigned_at ?? new Date().toISOString()) / 1000);
  // only records on the storage in use: switching storages forgets nothing
  const own = new Map(madeByPanel.all(row.vmid, row.user_id, s.storage).map((b) => [b.volid, b]));
  const present = new Set(items.map((i) => i.volid));
  for (const volid of own.keys()) {
    if (!present.has(volid)) db.prepare('DELETE FROM backups WHERE volid = ?').run(volid);
  }
  return items
    .filter((i) => Number(i.vmid) === row.vmid && (own.has(i.volid) || Number(i.ctime) >= since))
    .map((i) => {
      const mine = own.get(i.volid);
      return {
        id: i.volid,
        time: new Date(Number(i.ctime) * 1000).toISOString(),
        size: Number(i.size) || null,
        kind: mine?.kind ?? 'provider',
        deletable: !!mine && !i.protected,
        protected: !!i.protected,
        verified: i.verification?.state ?? null,      // ok | failed | null
        encrypted: !!i.encrypted,
      };
    })
    .sort((a, b) => b.time.localeCompare(a.time));
}

async function requireVisible(row, guest, volid) {
  const list = await visibleBackups(row, guest);
  const b = list.find((x) => x.id === volid);
  if (!b) throw new BackupError(404, 'Backup not found');
  return b;
}

// ---- What the customer's Backups tab shows ----------------------------------------------

const lastJob = db.prepare('SELECT * FROM backup_jobs WHERE vmid = ? AND user_id = ? ORDER BY id DESC LIMIT 1');
const activeJobFor = db.prepare("SELECT * FROM backup_jobs WHERE vmid = ? AND state IN ('queued', 'running') ORDER BY id LIMIT 1");

function presentJob(j) {
  if (!j) return null;
  return {
    id: j.id, action: j.action, kind: j.kind, state: j.state, step: j.step, error: j.error,
    volid: j.volid, startedAt: j.started_at, finishedAt: j.finished_at,
  };
}

function presentSchedule(s) {
  if (!s) return null;
  return {
    frequency: s.frequency, weekday: s.weekday, hour: s.hour, minute: s.minute, keep: s.keep,
    nextRunAt: s.next_run_at, lastRunAt: s.last_run_at, lastError: s.last_error,
  };
}

export async function backupInfo(row, guest) {
  const s = backupSettings();
  const max = maxBackupsFor(row.user_id);
  if (!backupsAvailableFor(row.user_id)) return { available: false, enabled: s.enabled };
  const type = await storageType(guest.node, s.storage);
  let backups = [];
  let error = null;
  try {
    backups = await visibleBackups(row, guest);
  } catch (err) {
    error = err instanceof PveError ? `The backup storage can't be read right now (${err.message}).` : err.message;
  }
  const schedule = db.prepare('SELECT * FROM backup_schedules WHERE vmid = ?').get(row.vmid);
  return {
    available: true,
    max,
    used: backups.filter((b) => b.kind !== 'provider').length,
    fileRestore: type === 'pbs',
    restore: guest.type === 'qemu',
    schedulesAllowed: s.schedules,
    schedule: s.schedules ? presentSchedule(schedule) : null,
    job: presentJob(activeJobFor.get(row.vmid) ?? lastJob.get(row.vmid, row.user_id)),
    backups,
    error,
  };
}

// ---- Starting backups and restores ----------------------------------------------------

function busyCheck(vmid) {
  if (activeJobFor.get(vmid)) throw new BackupError(409, 'A backup or restore of this server is already running. Wait until it has finished.');
}

function insertJob(row, action, kind, options = null) {
  busyCheck(row.vmid); // again, right before queuing: no await between this check and the insert
  const r = db.prepare(`
    INSERT INTO backup_jobs (vmid, user_id, action, kind, options, state, step)
    VALUES (?, ?, ?, ?, ?, 'queued', 'Waiting for other backups to finish')
  `).run(row.vmid, row.user_id, action, kind, options ? JSON.stringify(options) : null);
  const id = Number(r.lastInsertRowid);
  enqueue(id);
  return presentJob(db.prepare('SELECT * FROM backup_jobs WHERE id = ?').get(id));
}

export async function startBackup(req, row, guest) {
  if (!backupsAvailableFor(row.user_id)) throw new BackupError(403, 'Backups are not available for your account');
  busyCheck(row.vmid);
  const list = await visibleBackups(row, guest);
  const max = maxBackupsFor(row.user_id);
  const used = list.filter((b) => b.kind !== 'provider').length;
  if (used >= max) {
    throw new BackupError(409, `You have ${used} of ${max} backups for this server. Delete one to make a new backup.`);
  }
  audit(req, row.vmid, 'backup_create');
  return insertJob(row, 'backup', 'manual');
}

/** Parses "key: value" lines of a backed-up VM config (stops at the snapshot sections). */
function parseConfig(text) {
  const cfg = {};
  for (const line of String(text ?? '').split('\n')) {
    if (line.startsWith('[')) break;
    const m = /^([a-z0-9_-]+):\s*(.*)$/i.exec(line.trim());
    if (m) cfg[m[1]] = m[2];
  }
  return cfg;
}

export async function startRestore(req, row, guest, { volid, backupFirst = true, start = null }) {
  if (!backupsAvailableFor(row.user_id)) throw new BackupError(403, 'Backups are not available for your account');
  if (guest.type !== 'qemu') throw new BackupError(400, 'Restoring containers is not supported here. Ask your provider.');
  busyCheck(row.vmid);
  if (activeWindowsUpdate(row.vmid)) throw new BackupError(409, 'Windows updates are being installed. Restore after they have finished.');
  await requireVisible(row, guest, volid);

  // Within the plan: the restored size replaces the current one
  if (row.created_by_customer) {
    const [backupCfg, currentCfg] = await Promise.all([
      pve.get(`/nodes/${encodeURIComponent(guest.node)}/vzdump/extractconfig`, { volume: volid }).then(parseConfig),
      pve.get(`${guestPath(guest)}/config`),
    ]);
    const size = (c) => ({
      cores: (Number(c.cores) || 1) * (Number(c.sockets) || 1), memoryMb: Number(c.memory) || 512, diskGb: diskTotalGb(c),
    });
    const account = db.prepare('SELECT * FROM users WHERE id = ?').get(row.user_id);
    if (account?.can_create) {
      const limits = limitsOf(account);
      const usage = await usageOf(row.user_id);
      const [b, cur] = [size(backupCfg), size(currentCfg)];
      const over = [];
      if (usage.cores - cur.cores + b.cores > limits.cores) over.push('CPU cores');
      if (usage.memoryMb - cur.memoryMb + b.memoryMb > limits.memoryMb) over.push('memory');
      if (usage.diskGb - cur.diskGb + b.diskGb > limits.diskGb) over.push('disk');
      if (over.length) {
        throw new BackupError(409, `This backup is from a larger server (${b.cores} cores, ${b.memoryMb / 1024} GB memory, `
          + `${b.diskGb} GB disk) and doesn't fit your plan (${over.join(', ')}).`);
      }
    }
  }

  if (backupFirst) {
    const used = (await visibleBackups(row, guest)).filter((b) => b.kind !== 'provider').length;
    if (used >= maxBackupsFor(row.user_id)) {
      throw new BackupError(409, 'No room for a backup of the current state: delete a backup first, or restore without one.');
    }
  }
  const wasRunning = guest.status === 'running';
  audit(req, row.vmid, 'backup_restore_started', { backup: volid, backupFirst });
  return insertJob(row, 'restore', null, { volid, backupFirst: !!backupFirst, start: start ?? wasRunning });
}

export async function deleteBackup(req, row, guest, volid) {
  const b = await requireVisible(row, guest, volid);
  if (!b.deletable) {
    throw new BackupError(403, b.protected ? 'This backup is protected.' : 'This backup was made by your provider and can\'t be deleted here.');
  }
  busyCheck(row.vmid);
  await removeVolume(guest.node, backupSettings().storage, volid);
  audit(req, row.vmid, 'backup_delete', { backup: volid });
}

async function removeVolume(node, storage, volid) {
  const upid = await pve.del(`${contentPath(node, storage)}/${encodeURIComponent(volid)}`);
  await waitTask(node, upid, 600_000);
  db.prepare('DELETE FROM backups WHERE volid = ?').run(volid);
}

// ---- Schedules -------------------------------------------------------------------------

/** Next run (UTC) after `from` for a daily/weekly schedule. */
export function nextRun(s, from = Date.now()) {
  const d = new Date(from);
  let t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), s.hour, s.minute);
  if (s.frequency === 'weekly') {
    while (new Date(t).getUTCDay() !== s.weekday || t <= from) t += 86_400_000;
  } else if (t <= from) {
    t += 86_400_000;
  }
  return new Date(t).toISOString();
}

export function setSchedule(req, row, input) {
  const s = backupSettings();
  if (!backupsAvailableFor(row.user_id) || !s.schedules) throw new BackupError(403, 'Automatic backups are not available for your account');
  if (input.frequency === 'off') {
    db.prepare('DELETE FROM backup_schedules WHERE vmid = ?').run(row.vmid);
    audit(req, row.vmid, 'backup_schedule', { frequency: 'off' });
    return null;
  }
  const max = maxBackupsFor(row.user_id);
  if (input.keep > max) throw new BackupError(400, `Keep at most ${max} backups`);
  if (input.frequency === 'weekly' && !Number.isInteger(input.weekday)) throw new BackupError(400, 'Choose the day of the week');
  const sched = {
    frequency: input.frequency, weekday: input.frequency === 'weekly' ? input.weekday : null,
    hour: input.hour, minute: input.minute, keep: input.keep,
  };
  db.prepare(`
    INSERT INTO backup_schedules (vmid, user_id, frequency, weekday, hour, minute, keep, next_run_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(vmid) DO UPDATE SET user_id = excluded.user_id, frequency = excluded.frequency, weekday = excluded.weekday,
      hour = excluded.hour, minute = excluded.minute, keep = excluded.keep, next_run_at = excluded.next_run_at, last_error = NULL
  `).run(row.vmid, row.user_id, sched.frequency, sched.weekday, sched.hour, sched.minute, sched.keep, nextRun(sched));
  audit(req, row.vmid, 'backup_schedule', sched);
  return presentSchedule(db.prepare('SELECT * FROM backup_schedules WHERE vmid = ?').get(row.vmid));
}

async function schedulerTick(log) {
  const s = backupSettings();
  const due = db.prepare(`
    SELECT b.*, v.state AS vm_state, v.user_id AS owner FROM backup_schedules b JOIN vms v ON v.vmid = b.vmid
    WHERE b.next_run_at <= ?`).all(new Date().toISOString());
  for (const sch of due) {
    const advance = (error = null) => db.prepare('UPDATE backup_schedules SET next_run_at = ?, last_run_at = ?, last_error = COALESCE(?, last_error) WHERE vmid = ?')
      .run(nextRun(sch), new Date().toISOString(), error, sch.vmid);
    if (sch.owner !== sch.user_id) { db.prepare('DELETE FROM backup_schedules WHERE vmid = ?').run(sch.vmid); continue; }
    if (!s.schedules || !backupsAvailableFor(sch.user_id) || sch.vm_state !== 'ready') { advance(); continue; }
    if (activeJobFor.get(sch.vmid)) { advance('Skipped: another backup or restore was running'); continue; }
    advance();
    const row = db.prepare('SELECT * FROM vms WHERE vmid = ?').get(sch.vmid);
    insertJob(row, 'backup', 'scheduled');
    log?.info(`Scheduled backup of ${sch.vmid} queued`);
  }
}

// ---- The job runner ---------------------------------------------------------------------

const queue = [];
let active = 0;
let logger = null;

function enqueue(id) {
  queue.push(id);
  pump();
}
function pump() {
  while (active < PARALLEL && queue.length) {
    const id = queue.shift();
    active += 1;
    runJob(id).catch((err) => logger?.warn(`Backup job ${id}: ${err.message}`)).finally(() => { active -= 1; pump(); });
  }
}

const setJob = (id, fields) => {
  const keys = Object.keys(fields);
  db.prepare(`UPDATE backup_jobs SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).run(...keys.map((k) => fields[k]), id);
};

async function locate(vmid) {
  const guest = (await clusterGuests(true)).get(vmid);
  if (!guest) throw new Error('The server no longer exists in Proxmox');
  return guest;
}

/** Runs vzdump and records the new backup; returns its volume ID. */
async function backupNow(job, guest, kind, resumeUpid = null) {
  const s = backupSettings();
  const startedSec = Math.floor(Date.parse(job.started_at) / 1000) - 60;
  let upid = resumeUpid;
  if (!upid) {
    setJob(job.id, { state: 'running', step: kind === 'before-restore' ? 'Backing up the current state' : 'Backing up', node: guest.node });
    upid = await pve.post(`/nodes/${encodeURIComponent(guest.node)}/vzdump`, {
      vmid: guest.vmid, storage: s.storage, mode: 'snapshot', remove: 0,
      'notes-template': `PVE Panel: {{guestname}} (${kind})`,
    });
    setJob(job.id, { upid });
  }
  await waitTask(guest.node, upid, TASK_TIMEOUT);
  const known = new Set(db.prepare('SELECT volid FROM backups').all().map((b) => b.volid));
  const items = await pve.get(contentPath(guest.node, s.storage), { content: 'backup', vmid: guest.vmid });
  const fresh = items.filter((i) => Number(i.vmid) === guest.vmid && Number(i.ctime) >= startedSec && !known.has(i.volid))
    .sort((a, b) => Number(b.ctime) - Number(a.ctime))[0];
  if (!fresh) throw new Error('The backup finished, but it can\'t be found on the backup storage');
  db.prepare('INSERT OR IGNORE INTO backups (volid, vmid, user_id, storage, kind) VALUES (?, ?, ?, ?, ?)')
    .run(fresh.volid, guest.vmid, job.user_id, s.storage, kind);
  return fresh.volid;
}

/** Scheduled backups: keep only the newest N automatic ones. */
async function rotate(job, guest) {
  const sch = db.prepare('SELECT keep FROM backup_schedules WHERE vmid = ?').get(job.vmid);
  if (!sch) return;
  const s = backupSettings();
  const auto = db.prepare("SELECT volid FROM backups WHERE vmid = ? AND user_id = ? AND storage = ? AND kind = 'scheduled' ORDER BY created_at DESC, volid DESC")
    .all(job.vmid, job.user_id, s.storage);
  for (const old of auto.slice(sch.keep)) {
    try { await removeVolume(guest.node, s.storage, old.volid); } catch (err) { logger?.warn(`Rotating ${old.volid}: ${err.message}`); }
  }
}

async function runJob(id, { resume = false } = {}) {
  let job = db.prepare('SELECT * FROM backup_jobs WHERE id = ?').get(id);
  if (!job || !['queued', 'running'].includes(job.state)) return;
  const actor = { account: { id: job.user_id }, ip: 'backup' };
  try {
    const guest = await locate(job.vmid);
    if (job.action === 'backup') {
      const volid = await backupNow(job, guest, job.kind, resume ? job.upid : null);
      if (job.kind === 'scheduled') {
        await rotate(job, guest);
        db.prepare('UPDATE backup_schedules SET last_error = NULL WHERE vmid = ?').run(job.vmid);
      }
      setJob(id, { state: 'done', step: null, volid, finished_at: new Date().toISOString() });
      audit(actor, job.vmid, 'backup_created', { backup: volid, kind: job.kind });
      return;
    }

    // restore
    const opt = JSON.parse(job.options);
    const path = guestPath(guest);
    if (!(resume && job.step === 'Restoring' && job.upid)) {
      if (opt.backupFirst) {
        await backupNow(job, guest, 'before-restore');
        job = db.prepare('SELECT * FROM backup_jobs WHERE id = ?').get(id);
      }
      const live = await pve.get(`${path}/status/current`);
      if (live.status !== 'stopped') {
        setJob(id, { state: 'running', step: 'Stopping the server' });
        await waitTask(guest.node, await pve.post(`${path}/status/stop`), 600_000);
      }
      setJob(id, { state: 'running', step: 'Restoring', node: guest.node });
      // force=1 replaces the existing server (disks included); its pool membership,
      // permissions and VM ID stay. unique is off, so the MAC address stays too.
      const upid = await pve.post(`/nodes/${encodeURIComponent(guest.node)}/qemu`, { vmid: job.vmid, archive: opt.volid, force: 1 });
      setJob(id, { upid });
      job.upid = upid;
    }
    await waitTask(guest.node, job.upid, TASK_TIMEOUT);
    invalidateGuestCache();

    // The backup may be older than today's isolation rules: put them back
    const net = config.network.enabled ? networkOf(job.user_id) : null;
    if (net) {
      const cfg = await pve.get(`${path}/config`);
      const inNet = Object.entries(cfg).some(([k, v]) => /^net\d+$/.test(k) && new RegExp(`bridge=${net.vnet}(,|$)`).test(String(v)));
      if (inNet) {
        setJob(id, { step: 'Securing the network' });
        await ensureIsolation(path, net);
      }
    }
    if (opt.start) {
      setJob(id, { step: 'Starting the server' });
      await waitTask(guest.node, await pve.post(`${path}/status/start`), 600_000);
    }
    setJob(id, { state: 'done', step: null, finished_at: new Date().toISOString() });
    audit(actor, job.vmid, 'backup_restored', { backup: opt.volid });
  } catch (err) {
    const message = String(err.message || err).slice(0, 500);
    setJob(id, { state: 'failed', step: null, error: message, finished_at: new Date().toISOString() });
    if (job.kind === 'scheduled') db.prepare('UPDATE backup_schedules SET last_error = ? WHERE vmid = ?').run(message, job.vmid);
    audit(actor, job.vmid, job.action === 'restore' ? 'backup_restore_failed' : 'backup_failed', { error: message });
  }
}

/** After a restart: queued jobs run again, running ones are followed until their Proxmox task ends. */
function resumeJobs(log) {
  const open = db.prepare("SELECT * FROM backup_jobs WHERE state IN ('queued', 'running') ORDER BY id").all();
  for (const j of open) {
    if (j.state === 'queued') { enqueue(j.id); continue; }
    if (j.upid && (j.action === 'backup' || j.step === 'Restoring')) {
      active += 1;
      runJob(j.id, { resume: true }).finally(() => { active -= 1; pump(); });
    } else {
      setJob(j.id, { state: 'failed', step: null, error: 'Interrupted because the panel restarted. Check the server and try again.', finished_at: new Date().toISOString() });
    }
  }
  if (open.length) log.info(`Backups: ${open.length} job(s) resumed after the restart`);
}

export function startBackupScheduler(log) {
  logger = log;
  resumeJobs(log);
  const every = Math.max(1, Number(process.env.BACKUP_TICK_SECONDS) || 60) * 1000;
  setInterval(() => schedulerTick(log).catch((err) => log.warn(`Backup schedule: ${err.message}`)), every).unref();
}

// ---- File restore (PBS only) --------------------------------------------------------------

const TYPES = { d: 'folder', v: 'folder', f: 'file', l: 'link', h: 'file' };

/** Entries of a folder inside a backup. `path` is the opaque value from a previous listing. */
export async function listFiles(row, guest, volid, path) {
  const s = backupSettings();
  if (await storageType(guest.node, s.storage) !== 'pbs') throw new BackupError(400, 'Browsing files needs a Proxmox Backup Server');
  await requireVisible(row, guest, volid);
  const entries = await pve.get(`/nodes/${encodeURIComponent(guest.node)}/storage/${encodeURIComponent(s.storage)}/file-restore/list`, {
    volume: volid, filepath: path || ROOT,
  });
  return (entries ?? []).map((e) => ({
    name: String(e.text ?? ''),
    path: e.filepath,
    type: TYPES[e.type] ?? 'other',
    size: e.size ?? null,
    mtime: e.mtime ?? null,
  })).sort((a, b) => (a.type === 'folder' ? 0 : 1) - (b.type === 'folder' ? 0 : 1) || a.name.localeCompare(b.name));
}

/** Streams one file (or a folder as .zip) out of a backup. */
export async function downloadFile(row, guest, volid, path, isFolder) {
  const s = backupSettings();
  if (await storageType(guest.node, s.storage) !== 'pbs') throw new BackupError(400, 'Browsing files needs a Proxmox Backup Server');
  await requireVisible(row, guest, volid);
  const res = await pve.stream(`/nodes/${encodeURIComponent(guest.node)}/storage/${encodeURIComponent(s.storage)}/file-restore/download`, {
    volume: volid, filepath: path,
  });
  const raw = Buffer.from(path, 'base64').toString('utf8');
  const base = (raw.split('/').filter(Boolean).pop() || 'backup').replace(/[^\w.\- ]+/g, '_').slice(0, 120);
  return { res, filename: isFolder ? `${base}.zip` : base };
}

// ---- When a server is deleted -----------------------------------------------------------

/** Removes the panel-made backups of a deleted server (unless the admin keeps them). */
export async function forgetServerBackups(vmid, node, log) {
  db.prepare('DELETE FROM backup_schedules WHERE vmid = ?').run(vmid);
  const s = backupSettings();
  const rows = db.prepare('SELECT * FROM backups WHERE vmid = ?').all(vmid);
  if (s.keepAfterDelete || !rows.length || !node) {
    db.prepare('DELETE FROM backups WHERE vmid = ?').run(vmid);
    return 0;
  }
  let removed = 0;
  for (const b of rows) {
    try {
      await removeVolume(node, b.storage, b.volid);
      removed += 1;
    } catch (err) {
      log?.warn?.(`Backup ${b.volid} of deleted server ${vmid} not removed: ${err.message}`);
      db.prepare('DELETE FROM backups WHERE volid = ?').run(b.volid);
    }
  }
  return removed;
}
