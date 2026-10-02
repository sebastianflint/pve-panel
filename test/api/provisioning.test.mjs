// Self-service: create (Linux), private network, plan limits, reinstall, resize, delete.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startStack, waitFor } from '../support/stack.mjs';

let stack;
let lena;
const LIMITS = { maxServers: 3, maxCores: 8, maxMemoryMb: 16384, maxDiskGb: 200 };
const linux = (hostname, extra = {}) => ({
  hostname, templateId: 9000, cores: 2, memoryMb: 2048, diskGb: 20, username: 'lena', password: 'supersecret-123', ...extra,
});
const cfg = (vmid) => stack.mock.vms.get(vmid)?.cfg;
const macOf = (vmid) => /=([0-9A-F:]{17})/i.exec(cfg(vmid)?.net0 ?? '')?.[1];
let web;   // vmid of the first server
let db;    // vmid of the second

before(async () => {
  stack = await startStack();
  await stack.offerTemplates();
  lena = await stack.customerWith('lena@example.com', { limits: LIMITS });
});
after(async () => { await stack?.stop(); });

test('creates a Linux server in its own private network', async () => {
  const r = await lena.post('/api/vms', linux('web-shop'));
  assert.equal(r.status, 202, r.text);
  web = r.json.vmid;
  const v = await stack.serverSettled(lena, web);
  assert.equal(v.state, 'ready', v.error);

  const vnet = stack.mock.sdn.vnets.find((n) => n.vnet === 'cu0001');
  assert.ok(vnet, 'VNet created');
  assert.equal(vnet.alias, 'lena (example.com)', 'alias carries the customer name');
  assert.match(cfg(web).net0, /bridge=cu0001/);
  assert.match(cfg(web).net0, /firewall=1/);
  assert.equal(cfg(web).ciuser, 'lena');
});

test('refuses servers beyond the plan', async () => {
  const r = await lena.post('/api/vms', linux('too-big', { cores: 16 }));
  assert.equal(r.status, 409);
  assert.match(r.json.error, /plan|limit|exceed/i);
});

test('resize: CPU/memory wait for a restart, and pending changes count toward the plan', async () => {
  const second = await lena.post('/api/vms', linux('db01'));
  db = second.json.vmid;
  assert.equal((await stack.serverSettled(lena, db)).state, 'ready');
  await lena.post(`/api/vms/${web}/power/start`);
  await waitFor(async () => (await lena.get(`/api/vms/${web}`)).json?.status === 'running', { what: 'web-shop running' });

  // 12 GB pending on web-shop (still running with 2 GB)
  const r = await lena.post(`/api/vms/${web}/resize`, { memoryMb: 12288, restart: false });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.pendingRestart, true);
  const detail = (await lena.get(`/api/vms/${web}`)).json;
  assert.equal(detail.memoryMb, 2048, 'still running with the old size');
  assert.deepEqual(detail.pendingSize, { cores: 2, memoryMb: 12288 });

  // plan: 16 GB - 12 GB (web-shop, pending) = 4 GB for db01 at most
  const loophole = await lena.post(`/api/vms/${db}/resize`, { memoryMb: 8192 });
  assert.equal(loophole.status, 409, 'pending memory must count');
  assert.match(loophole.json.error, /at most 4\.0 GB/);

  // a restart from the panel applies it
  await lena.post(`/api/vms/${web}/power/reboot`);
  await waitFor(async () => (await lena.get(`/api/vms/${web}`)).json?.pendingSize === null, { what: 'pending applied' });
  assert.equal((await lena.get(`/api/vms/${web}`)).json.memoryMb, 12288);
});

test('resize: disks only grow', async () => {
  assert.equal((await lena.post(`/api/vms/${db}/resize`, { diskGb: 10 })).status, 400);
  const r = await lena.post(`/api/vms/${db}/resize`, { diskGb: 30 });
  assert.equal(r.status, 200, r.text);
  assert.match(cfg(db).scsi0, /size=30G/);
});

test('reinstall keeps ID, size and MAC address, erases snapshots, re-applies isolation', async () => {
  await lena.post(`/api/vms/${db}/snapshots`, { name: 'before_reinstall' });
  await waitFor(async () => (await lena.get(`/api/vms/${db}/snapshots`)).json?.length, { what: 'snapshot' });
  const mac = macOf(db);

  const r = await lena.post(`/api/vms/${db}/reinstall`, { templateId: 9000, username: 'ops', password: 'a-brand-new-password' });
  assert.equal(r.status, 202, r.text);
  const v = await stack.serverSettled(lena, db);
  assert.equal(v.state, 'ready', v.error);
  assert.equal(macOf(db), mac, 'same MAC, so DHCP gives the same address');
  assert.equal(cfg(db).ciuser, 'ops', 'new sign-in');
  assert.match(cfg(db).scsi0, /size=30G/, 'size kept');
  assert.deepEqual((await lena.get(`/api/vms/${db}/snapshots`)).json, []);
  assert.ok(stack.mock.destroyed.some((d) => d.startsWith(`DELETE ${db}`)));
});

test('reinstall refuses an image that does not fit the disk', async () => {
  const r = await lena.post(`/api/vms/${db}/reinstall`, { templateId: 9100, password: 'Winter-Sun-2026!x' });
  assert.equal(r.status, 400);
  assert.match(r.json.error, /at least 40 GB/);
});

test('deletes a self-created server', async () => {
  await lena.post(`/api/vms/${db}/power/stop`);
  await waitFor(async () => (await lena.get(`/api/vms/${db}`)).json?.status === 'stopped', { what: 'stopped' });
  assert.equal((await lena.del(`/api/vms/${db}`)).status, 202);
  await waitFor(async () => !(await lena.get('/api/vms')).json.some((v) => v.vmid === db), { what: 'server gone' });
  assert.equal(stack.mock.vms.has(db), false);
});
