// Container images (LXC CT templates): offering them, creating unprivileged
// containers in the customer's network, quota, resize, reinstall, backups,
// deletion — and what containers don't do (Tailscale, VM images on reinstall).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startStack, waitFor } from '../support/stack.mjs';

const DEBIAN = 'local:vztmpl/debian-13-standard_13.6-1_amd64.tar.zst';
let stack;
let admin;
let lena;
let ctId;      // "ct-<n>" offered to customers
let vmid;      // lena's container
const KEY = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGtestkeytestkeytestkeytestkeytestkey lena@laptop';
const create = (body) => lena.post('/api/vms', {
  hostname: 'ct01', templateId: ctId, cores: 1, memoryMb: 1024, diskGb: 8, password: 'supersecret-123', ...body,
});

before(async () => {
  stack = await startStack({ env: { SETUP_CHECK_HOURS: '0' } });
  admin = await stack.adminSession();
  await stack.offerTemplates();
  lena = await stack.customerWith('lena@example.com', { limits: {} });
});
after(async () => { await stack?.stop(); });

test('admin: every container image in the cluster, and the storages for container disks', async () => {
  const t = (await admin.get('/api/admin/templates')).json;
  assert.deepEqual(t.containers.map((c) => [c.file, c.node, c.offered]), [
    ['alpine-3.22-default_20250617_amd64.tar.xz', 'pve1', false],
    ['debian-13-standard_13.6-1_amd64.tar.zst', 'pve1', false],
  ]);
  assert.deepEqual(t.containerStorages.pve1, ['VMStorage', 'local-lvm']);
  assert.equal((await lena.get('/api/templates')).json.some((x) => x.kind === 'container'), false);

  // validation: image and storage must exist
  assert.equal((await admin.put('/api/admin/ct-templates', { volid: 'local:vztmpl/nope.tar.zst', node: 'pve1', label: 'X', storage: 'local-lvm' })).status, 400);
  const badStorage = await admin.put('/api/admin/ct-templates', { volid: DEBIAN, node: 'pve1', label: 'X', storage: 'local' });
  assert.equal(badStorage.status, 400);
  assert.match(badStorage.json.error, /can't hold containers/);
  assert.equal((await admin.put('/api/admin/ct-templates', { volid: 'local:iso/x.iso', node: 'pve1', label: 'X', storage: 'local-lvm' })).status, 400);

  const r = await admin.put('/api/admin/ct-templates', { volid: DEBIAN, node: 'pve1', label: 'Debian 13 (container)', storage: 'local-lvm', minDiskGb: 4 });
  assert.equal(r.status, 200, r.text);
  ctId = `ct-${r.json.id}`;
  const after2 = (await admin.get('/api/admin/templates')).json.containers.find((c) => c.volid === DEBIAN);
  assert.equal(after2.offered, true);
  assert.equal(after2.label, 'Debian 13 (container)');
});

test('customers see it next to the VM templates', async () => {
  const list = (await lena.get('/api/templates')).json;
  assert.deepEqual(list.map((t) => [t.name, t.kind]).sort(), [
    ['Debian 12', 'vm'], ['Debian 13 (container)', 'container'], ['Windows Server 2022', 'vm'],
  ]);
  const ct = list.find((t) => t.kind === 'container');
  assert.deepEqual([ct.id, ct.setup, ct.defaultUser, ct.minDiskGb], [ctId, 'container', 'root', 4]);
});

test('validation: sign-in, disk size, unknown images', async () => {
  const noLogin = await create({ password: undefined });
  assert.equal(noLogin.status, 400);
  assert.match(noLogin.json.error, /password or add an SSH key/);
  assert.equal((await create({ diskGb: 2 })).status, 400);
  assert.equal((await create({ templateId: 'ct-999' })).status, 400);
  assert.equal((await create({ templateId: 'ct-abc' })).status, 400);
  assert.equal((await create({ templateId: 'local:vztmpl/x' })).status, 400);
});

test('creates an unprivileged container in the customer\'s network', { timeout: 60_000 }, async () => {
  const r = await create({ sshKeys: KEY, username: 'ignored' });
  assert.equal(r.status, 202, r.text);
  vmid = r.json.vmid;
  const ready = await stack.serverSettled(lena, vmid);
  assert.equal(ready.state, 'ready', ready.error);
  assert.equal(ready.type, 'lxc');
  assert.equal(ready.os, 'linux');

  const call = stack.mock.ctCreates.find((c) => Number(c.vmid) === vmid);
  assert.equal(call.ostemplate, DEBIAN);
  assert.equal(call.unprivileged, '1', 'never a privileged container');
  assert.equal(call.features, 'nesting=1');
  assert.equal(call.rootfs, 'local-lvm:8');
  assert.equal(call.pool, 'customers');
  assert.equal(call.password, 'supersecret-123');
  assert.equal(call['ssh-public-keys'], `${KEY}\n`, 'keys passed as plain text (not URL-encoded like for VMs)');
  assert.match(call.net0, /^name=eth0,bridge=cu0001,ip=dhcp,firewall=1$/);

  const ct = stack.mock.vms.get(vmid);
  assert.equal(ct.status, 'running');
  assert.ok(ct.fwRules.some((x) => x.comment === 'panel: allow own network'), 'isolated like a VM');
  assert.equal(Number(ct.fwOptions.enable), 1);
  const detail = (await lena.get(`/api/vms/${vmid}`)).json;
  assert.deepEqual(detail.ips, ['10.100.1.123'], 'addresses without a guest agent');
  assert.equal(detail.templateId, ctId);
  assert.equal(detail.diskGb, 8);

  // its disk counts against the plan
  const usage = (await lena.get('/api/account')).json.usage;
  assert.deepEqual([usage.servers, usage.cores, usage.memoryMb, usage.diskGb], [1, 1, 1024, 8]);
  const log = (await admin.get('/api/admin/audit?limit=10')).json;
  assert.ok(log.some((a) => a.action === 'server_created' && a.vmid === vmid));
});

test('resize: CPU and memory apply right away, the disk grows', async () => {
  const r = await lena.post(`/api/vms/${vmid}/resize`, { cores: 2, memoryMb: 2048, diskGb: 12, restart: true });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.pendingRestart, false);
  assert.equal(r.json.restartTask, null, 'no restart needed for a container');
  const cfg = stack.mock.vms.get(vmid).cfg;
  assert.deepEqual([cfg.cores, cfg.memory], ['2', '2048']);
  assert.match(cfg.rootfs, /size=12G/);
});

test('reinstall: from a container image only, keeps the MAC address', { timeout: 60_000 }, async () => {
  const toVm = await lena.post(`/api/vms/${vmid}/reinstall`, { templateId: 9000, username: 'u', password: 'supersecret-123' });
  assert.equal(toVm.status, 400);
  assert.match(toVm.json.error, /container image/);
  const mac = /hwaddr=([^,]+)/.exec(stack.mock.vms.get(vmid).cfg.net0)[1];
  const r = await lena.post(`/api/vms/${vmid}/reinstall`, { templateId: ctId, password: 'another-secret-456' });
  assert.equal(r.status, 202, r.text);
  const done = await waitFor(async () => {
    const v = (await lena.get('/api/vms')).json.find((x) => x.vmid === vmid);
    return v?.state === 'ready' && stack.mock.ctCreates.filter((c) => Number(c.vmid) === vmid).length === 2 ? v : null;
  }, { timeout: 40_000, what: 'the reinstall' });
  assert.equal(done.state, 'ready');
  const again = stack.mock.ctCreates.filter((c) => Number(c.vmid) === vmid).at(-1);
  assert.match(again.net0, new RegExp(`hwaddr=${mac}`));
  assert.equal(again.rootfs, 'local-lvm:12', 'same size as before');
  assert.equal(again.password, 'another-secret-456');
});

test('backups: back up and restore a container', { timeout: 90_000 }, async () => {
  await admin.put('/api/admin/settings/backups', { enabled: true, storage: 'pbs', maxPerServer: 3 });
  const b = await lena.post(`/api/vms/${vmid}/backups`);
  assert.equal(b.status, 202, b.text);
  const job = async (afterId) => waitFor(async () => {
    const j = (await lena.get(`/api/vms/${vmid}/backups`)).json.job;
    return j && j.id > afterId && ['done', 'failed'].includes(j.state) ? j : null;
  }, { timeout: 40_000, what: 'the job' });
  const made = await job(b.json.id - 1);
  assert.equal(made.state, 'done', made.error);
  assert.equal((await lena.get(`/api/vms/${vmid}/backups`)).json.restore, true);

  const r = await lena.post(`/api/vms/${vmid}/backups/restore`, { id: made.volid, backupFirst: false });
  assert.equal(r.status, 202, r.text);
  const restored = await job(r.json.id - 1);
  assert.equal(restored.state, 'done', restored.error);
  const ct = stack.mock.vms.get(vmid);
  assert.equal(ct.restoredFrom, made.volid);
  assert.equal(ct.restoreStorage, 'local-lvm', 'restored to the storage the container is on');
  assert.equal(ct.status, 'running');
});

test('no Tailscale through the panel for containers', async () => {
  const r = await lena.post(`/api/vms/${vmid}/tailscale`, { authKey: 'tskey-auth-abc123-XYZ', mode: 'server', hostname: 'ct01' });
  assert.equal(r.status, 400);
  assert.match(r.json.error, /needs a VM/);
});

test('setup check: offered images, and a missing image file', async () => {
  let r = (await admin.post('/api/admin/setup-check/run')).json.result;
  const id = ctId.slice(3);
  assert.equal(r.checks.find((c) => c.id === `ct:${id}`).status, 'ok');
  assert.equal(r.checks.find((c) => c.id === '/storage/local' || c.id === 'perm:/storage/local').status, 'ok', 'image storage readable');
  stack.mock.ctImages.delete(DEBIAN);
  r = (await admin.post('/api/admin/setup-check/run')).json.result;
  const gone = r.checks.find((c) => c.id === `ct:${id}`);
  assert.equal(gone.status, 'error');
  assert.match(gone.detail, /debian-13-standard_13\.6-1_amd64\.tar\.zst no longer exists on pve1/);
  assert.equal((await lena.get('/api/templates')).json.some((t) => t.kind === 'container'), false, 'not offered while the file is gone');
  stack.mock.ctImages.add(DEBIAN);
});

test('delete the container', { timeout: 30_000 }, async () => {
  await lena.post(`/api/vms/${vmid}/power/stop`);
  await waitFor(() => stack.mock.vms.get(vmid).status === 'stopped', { what: 'the container to stop' });
  const r = await lena.del(`/api/vms/${vmid}`);
  assert.equal(r.status, 202, r.text);
  await waitFor(() => !stack.mock.vms.has(vmid), { what: 'the container to be destroyed' });
  assert.ok(stack.mock.destroyed.some((d) => d.startsWith(`DELETE ${vmid}`)));
});

test('withdraw the image', async () => {
  const r = await admin.del(`/api/admin/ct-templates/${ctId.slice(3)}`);
  assert.equal(r.status, 204);
  assert.equal((await lena.get('/api/templates')).json.some((t) => t.kind === 'container'), false);
});
