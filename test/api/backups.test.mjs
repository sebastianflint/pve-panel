// Backups with a (simulated) Proxmox Backup Server: back up, limits, schedules
// with rotation, restore (plan check, re-isolation), file restore, deletion with
// the server — and that nobody sees backups that aren't theirs.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { startStack, waitFor } from '../support/stack.mjs';

let stack;
let admin;
let lena;
let tom;
let vmid;
let dbh;
const b64 = (s) => Buffer.from(s).toString('base64');
const info = async (s = lena, id = vmid) => (await s.get(`/api/vms/${id}/backups`)).json;
const jobDone = (afterId = 0, s = lena, id = vmid) => waitFor(async () => {
  const j = (await info(s, id)).job;
  return j && j.id > afterId && ['done', 'failed'].includes(j.state) ? j : null;
}, { timeout: 60_000, interval: 300, what: 'the backup job' });
const backupNow = async () => {
  const r = await lena.post(`/api/vms/${vmid}/backups`);
  assert.equal(r.status, 202, r.text);
  const j = await jobDone(r.json.id - 1);
  assert.equal(j.state, 'done', j.error);
  return j.volid;
};
/** A backup "made by the provider" (a Proxmox backup job), at a given time. */
const providerBackup = (vm, ctime) => {
  const stamp = new Date(ctime * 1000).toISOString().replace(/\.\d+Z$/, 'Z');
  const volid = `pbs:backup/vm/${vm}/${stamp}`;
  stack.mock.backups.set(volid, { volid, storage: 'pbs', vmid: vm, ctime, size: 1000, notes: 'nightly', protected: 0,
    cfg: { ...stack.mock.vms.get(vm).cfg }, fwRules: [], fwOptions: {} });
  return volid;
};

before(async () => {
  stack = await startStack({ env: { SETUP_CHECK_HOURS: '0', BACKUP_TICK_SECONDS: '1' } });
  dbh = new DatabaseSync(path.join(stack.dir, 'panel.db'));
  admin = await stack.adminSession();
  await stack.offerTemplates();
  lena = await stack.customerWith('lena@example.com', { limits: {} });
  tom = await stack.customerWith('tom@example.com', { limits: {} });
  const r = await lena.post('/api/vms', { hostname: 'web01', templateId: 9000, cores: 2, memoryMb: 2048, diskGb: 20, username: 'u', password: 'supersecret-123' });
  assert.equal(r.status, 202, r.text);
  vmid = r.json.vmid;
  assert.equal((await stack.serverSettled(lena, vmid)).state, 'ready');
});
after(async () => { dbh?.close(); await stack?.stop(); });

test('off until an administrator chooses a storage', async () => {
  assert.equal((await lena.get('/api/account')).json.backups, false);
  assert.equal((await info()).available, false);
  assert.equal((await lena.post(`/api/vms/${vmid}/backups`)).status, 403);

  const s = (await admin.get('/api/admin/settings/backups')).json;
  assert.deepEqual(s.storages.map((x) => [x.id, x.type]), [['local', 'dir'], ['pbs', 'pbs']]);
  assert.equal((await admin.put('/api/admin/settings/backups', { enabled: true })).status, 400, 'storage required');
  const ok = await admin.put('/api/admin/settings/backups', { enabled: true, storage: 'pbs', maxPerServer: 3 });
  assert.equal(ok.status, 200, ok.text);
  assert.equal((await lena.get('/api/account')).json.backups, true);
  const i = await info();
  assert.equal(i.available, true);
  assert.equal(i.fileRestore, true);
  assert.deepEqual([i.max, i.used, i.backups.length], [3, 0, 0]);
});

test('back up now: runs in the background, one at a time, within the limit', async () => {
  const first = await lena.post(`/api/vms/${vmid}/backups`);
  assert.equal(first.status, 202);
  assert.equal((await lena.post(`/api/vms/${vmid}/backups`)).status, 409, 'second one while running');
  const j = await jobDone(first.json.id - 1);
  assert.equal(j.state, 'done', j.error);
  const i = await info();
  assert.equal(i.backups.length, 1);
  assert.equal(i.backups[0].id, j.volid);
  assert.equal(i.backups[0].kind, 'manual');
  assert.equal(i.backups[0].deletable, true);
  assert.match(stack.mock.backups.get(j.volid).notes, /PVE Panel: web01 \(manual\)/);

  // per-customer limit (admin): 1 → no room for another
  await admin.patch(`/api/admin/users/${lena.userId}`, { maxBackups: 1 });
  const full = await lena.post(`/api/vms/${vmid}/backups`);
  assert.equal(full.status, 409);
  assert.match(full.json.error, /1 of 1 backups/);
  await admin.patch(`/api/admin/users/${lena.userId}`, { maxBackups: 0 });
  assert.equal((await lena.get('/api/account')).json.backups, false, '0 = no backups for this customer');
  await admin.patch(`/api/admin/users/${lena.userId}`, { maxBackups: null });
  assert.equal((await info()).max, 3, 'back to the default');
});

test('only own backups: other customers, older owners and provider backups', async () => {
  // another customer can't even ask
  assert.equal((await tom.get(`/api/vms/${vmid}/backups`)).status, 404);

  const assignedAt = Date.parse(dbh.prepare('SELECT assigned_at FROM vms WHERE vmid = ?').get(vmid).assigned_at) / 1000;
  const older = providerBackup(vmid, assignedAt - 86_400);          // e.g. a previous server with this VM ID
  const nightly = providerBackup(vmid, Math.floor(Date.now() / 1000) - 5); // a Proxmox backup job, after assignment
  let i = await info();
  assert.ok(!i.backups.some((b) => b.id === older), 'backups from before the server was hers are hidden');
  const n = i.backups.find((b) => b.id === nightly);
  assert.equal(n.kind, 'provider');
  assert.equal(n.deletable, false);
  const del = await lena.req('DELETE', `/api/vms/${vmid}/backups?id=${encodeURIComponent(nightly)}`);
  assert.equal(del.status, 403);
  assert.ok(stack.mock.backups.has(nightly));
  assert.equal(i.used, 1, 'provider backups don\'t count against her limit');

  // reassigned to tom: he sees nothing from before, she loses access
  const own = i.backups.find((b) => b.kind === 'manual').id;
  await admin.put(`/api/admin/vms/${vmid}`, { userId: tom.userId });
  assert.equal((await lena.get(`/api/vms/${vmid}/backups`)).status, 404);
  const t = await info(tom);
  assert.deepEqual(t.backups, [], JSON.stringify(t.backups));
  // and back: her own panel backups are hers again, the provider's older ones are not
  await admin.put(`/api/admin/vms/${vmid}`, { userId: lena.userId });
  i = await info();
  assert.deepEqual(i.backups.map((b) => b.id), [own]);
  stack.mock.backups.delete(older);
  stack.mock.backups.delete(nightly);
});

test('browse and download files from a backup', async () => {
  const volid = (await info()).backups[0].id;
  const list = async (p) => (await lena.get(`/api/vms/${vmid}/backups/files?id=${encodeURIComponent(volid)}${p ? `&path=${encodeURIComponent(p)}` : ''}`));
  const root = await list();
  assert.equal(root.status, 200, root.text);
  assert.deepEqual(root.json.map((e) => [e.name, e.type]), [['drive-scsi0.img.fidx', 'folder']]);
  const top = (await list(root.json[0].path)).json;
  assert.deepEqual(top.map((e) => e.name), ['etc', 'var']);
  const www = (await list(b64('/drive-scsi0.img.fidx/var/www'))).json;
  assert.deepEqual(www.map((e) => [e.name, e.type]), [['uploads', 'folder'], ['index.php', 'file']], 'folders first');

  const file = await lena.get(`/api/vms/${vmid}/backups/download?id=${encodeURIComponent(volid)}&path=${encodeURIComponent(www[1].path)}`);
  assert.equal(file.status, 200);
  assert.match(file.text, new RegExp(`backup of ${vmid}`));
  assert.match(file.headers.get('content-disposition'), /attachment; filename="index\.php"/);
  const folder = await lena.get(`/api/vms/${vmid}/backups/download?id=${encodeURIComponent(volid)}&path=${encodeURIComponent(www[0].path)}&folder=1`);
  assert.equal(folder.status, 200);
  assert.ok(folder.text.startsWith('PK'));
  assert.match(folder.headers.get('content-disposition'), /filename="uploads\.zip"/);
  const log = (await admin.get('/api/admin/audit?limit=5')).json;
  assert.ok(log.some((a) => a.action === 'backup_file_download'));

  // validation and ownership
  assert.equal((await list('../../etc')).status, 400, 'paths are opaque base64 from a listing');
  assert.equal((await lena.get(`/api/vms/${vmid}/backups/files?id=${encodeURIComponent('pbs:backup/vm/102/2026-01-01T00:00:00Z')}`)).status, 404);
  assert.equal((await tom.get(`/api/vms/${vmid}/backups/files?id=${encodeURIComponent(volid)}`)).status, 404);

  // not a Proxmox Backup Server: whole-server backups only
  await admin.put('/api/admin/settings/backups', { storage: 'local' });
  assert.equal((await info()).fileRestore, false);
  await admin.put('/api/admin/settings/backups', { storage: 'pbs' });
});

test('restore: backs up the current state, restores, re-isolates and starts again', { timeout: 90_000 }, async () => {
  const before = (await info()).backups;
  const volid = before[0].id;
  const vm = stack.mock.vms.get(vmid);
  // the backup is "older than today's rules": no firewall rules in it
  stack.mock.backups.get(volid).fwRules = [];
  vm.cfg.description = 'changed after the backup';
  assert.equal(vm.status, 'running');

  const r = await lena.post(`/api/vms/${vmid}/backups/restore`, { id: volid, backupFirst: true });
  assert.equal(r.status, 202, r.text);
  const j = await jobDone(r.json.id - 1);
  assert.equal(j.state, 'done', j.error);
  assert.equal(vm.restoredFrom, volid);
  assert.equal(vm.cfg.description, undefined, 'configuration from the backup');
  assert.equal(vm.status, 'running', 'started again because it was running');
  assert.ok(vm.fwRules.some((x) => x.comment === 'panel: allow own network'), 'isolation rules put back');
  assert.ok(vm.fwRules.some((x) => x.comment === 'panel: egress allow own network'));
  assert.equal(Number(vm.fwOptions.enable), 1);
  const after = (await info()).backups;
  assert.equal(after.length, before.length + 1);
  assert.equal(after[0].kind, 'before-restore');
  const log = (await admin.get('/api/admin/audit?limit=20')).json.map((a) => a.action);
  assert.ok(log.includes('backup_restored'));
});

test('restore is refused when the backup doesn\'t fit the plan, or isn\'t hers', async () => {
  const volid = (await info()).backups.at(-1).id;
  stack.mock.backups.get(volid).cfg.cores = 64;
  const r = await lena.post(`/api/vms/${vmid}/backups/restore`, { id: volid, backupFirst: false });
  assert.equal(r.status, 409);
  assert.match(r.json.error, /64 cores.*doesn't fit your plan \(CPU cores\)/);
  stack.mock.backups.get(volid).cfg.cores = 2;
  assert.equal((await lena.post(`/api/vms/${vmid}/backups/restore`, { id: 'pbs:backup/vm/102/2026-01-01T00:00:00Z' })).status, 404);
  assert.equal((await lena.post(`/api/vms/${vmid}/backups/restore`, { id: 'not a volume' })).status, 400);
});

test('delete a backup', async () => {
  const b = (await info()).backups.find((x) => x.kind === 'before-restore');
  const r = await lena.req('DELETE', `/api/vms/${vmid}/backups?id=${encodeURIComponent(b.id)}`);
  assert.equal(r.status, 204, r.text);
  assert.ok(!stack.mock.backups.has(b.id));
  assert.ok(!(await info()).backups.some((x) => x.id === b.id));
});

test('automatic backups keep only the newest ones', { timeout: 90_000 }, async () => {
  assert.equal((await lena.put(`/api/vms/${vmid}/backups/schedule`, { frequency: 'daily', hour: 3, minute: 0, keep: 9 })).status, 400, 'more than allowed');
  assert.equal((await lena.put(`/api/vms/${vmid}/backups/schedule`, { frequency: 'weekly', hour: 3, minute: 0, keep: 1 })).status, 400, 'weekday missing');
  const r = await lena.put(`/api/vms/${vmid}/backups/schedule`, { frequency: 'daily', hour: 3, minute: 30, keep: 1 });
  assert.equal(r.status, 200, r.text);
  assert.match(r.json.schedule.nextRunAt, /T03:30:00\.000Z$/);

  const due = () => dbh.prepare("UPDATE backup_schedules SET next_run_at = '2000-01-01T00:00:00.000Z' WHERE vmid = ?").run(vmid);
  const scheduled = async () => (await info()).backups.filter((b) => b.kind === 'scheduled');
  due();
  const first = await waitFor(async () => { const s = await scheduled(); return s.length === 1 ? s : null; }, { timeout: 30_000, what: 'the first automatic backup' });
  assert.match((await info()).schedule.nextRunAt, /T03:30:00\.000Z$/, 'next run moved on');
  await new Promise((res) => setTimeout(res, 1100)); // a new second for the next backup
  due();
  const second = await waitFor(async () => { const s = await scheduled(); return s.length === 1 && s[0].id !== first[0].id ? s : null; },
    { timeout: 30_000, what: 'the second automatic backup and rotation' });
  assert.ok(!stack.mock.backups.has(first[0].id), 'the older automatic backup was removed (keep 1)');
  assert.ok((await info()).backups.some((b) => b.kind === 'manual'), 'manual backups are never rotated');
  assert.ok(second);

  assert.equal((await lena.put(`/api/vms/${vmid}/backups/schedule`, { frequency: 'off' })).json.schedule, null);
  assert.equal((await info()).schedule, null);
  await admin.put('/api/admin/settings/backups', { schedules: false });
  assert.equal((await lena.put(`/api/vms/${vmid}/backups/schedule`, { frequency: 'daily', hour: 1, minute: 0, keep: 1 })).status, 403);
  await admin.put('/api/admin/settings/backups', { schedules: true });
});

test('setup check: backup storage and rights', async () => {
  let r = (await admin.post('/api/admin/setup-check/run')).json.result;
  const find = (id) => r.checks.find((c) => c.id === id);
  assert.equal(find('bak:storage').status, 'ok');
  assert.match(find('bak:storage').title, /Proxmox Backup Server/);
  assert.equal(find('perm:/storage/pbs').status, 'ok');
  const pool = stack.mock.perms['/pool/customers'];
  stack.mock.perms['/pool/customers'] = pool.filter((p) => p !== 'VM.Backup');
  r = (await admin.post('/api/admin/setup-check/run')).json.result;
  assert.equal(find('perm:/pool/customers').status, 'error');
  assert.match(find('perm:/pool/customers').detail, /VM\.Backup/);
  stack.mock.perms['/pool/customers'] = pool;
});

test('deleting the server removes its panel backups', { timeout: 60_000 }, async () => {
  const own = (await info()).backups.filter((b) => b.kind !== 'provider').map((b) => b.id);
  assert.ok(own.length >= 1);
  await lena.post(`/api/vms/${vmid}/power/stop`);
  await waitFor(() => stack.mock.vms.get(vmid).status === 'stopped', { what: 'the server to stop' });
  const r = await lena.del(`/api/vms/${vmid}`);
  assert.equal(r.status, 202, r.text);
  await waitFor(() => own.every((id) => !stack.mock.backups.has(id))
    && dbh.prepare('SELECT COUNT(*) AS n FROM backups WHERE vmid = ?').get(vmid).n === 0, { timeout: 30_000, what: 'the backups to be removed' });
});
