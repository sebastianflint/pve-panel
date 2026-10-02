// Admin: email settings, invitations, VPN devices, server actions, deleting customers.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { startStack, waitFor } from '../support/stack.mjs';

let stack;
let admin;
const emailSettings = (password) => ({
  host: '127.0.0.1', port: stack.smtp.port, security: 'none', username: 'panel', password,
  fromName: 'PVE Panel', fromAddress: 'panel@example.com', panelUrl: stack.customerUrl,
});

before(async () => {
  stack = await startStack({ mail: true });
  admin = await stack.adminSession();
});
after(async () => { await stack?.stop(); });

test('email: a wrong SMTP password is reported; the stored password is encrypted and never returned', async () => {
  await admin.put('/api/admin/settings/email', emailSettings('wrong'));
  const fail = await admin.post('/api/admin/settings/email/test', { to: 'admin@example.com' });
  assert.equal(fail.status, 502);
  assert.match(fail.json.error, /535/);

  await admin.put('/api/admin/settings/email', emailSettings('mail-secret'));
  assert.equal((await admin.post('/api/admin/settings/email/test', { to: 'admin@example.com' })).status, 200);
  await waitFor(() => stack.smtp.messages.length === 1, { what: 'test mail' });

  const shown = (await admin.get('/api/admin/settings/email')).json;
  assert.equal(shown.hasPassword, true);
  assert.equal(JSON.stringify(shown).includes('mail-secret'), false);
  const files = fs.readdirSync(stack.dir).filter((f) => f.startsWith('panel.db'));
  const raw = files.map((f) => fs.readFileSync(path.join(stack.dir, f))).map((b) => b.toString('latin1')).join('');
  assert.equal(raw.includes('mail-secret'), false, 'no plaintext in the database files');
});

test('invitation: one-time link, own password, old links die on resend', async () => {
  const created = await admin.post('/api/admin/users', { email: 'mia@example.com', invite: true, requireTotp: true });
  assert.equal(created.status, 201, created.text);
  assert.equal(created.json.invited, true);
  const mail = await waitFor(() => stack.smtp.messages.find((m) => m.to === 'mia@example.com'), { what: 'invitation' });
  assert.match(mail.text, /two-factor/i);
  const token = /#invite=([A-Za-z0-9_-]+)/.exec(mail.text)[1];

  const c = stack.customer();
  assert.equal((await c.post('/api/auth/login', { email: 'mia@example.com', password: 'anything-at-all' })).status, 401);
  assert.equal((await c.post('/api/invite/check', { token })).json.valid, true);
  assert.equal((await c.post('/api/invite/accept', { token, password: 'a-good-long-passphrase' })).status, 200);
  assert.equal((await c.post('/api/invite/check', { token })).json.valid, false, 'used up');
  assert.deepEqual((await c.post('/api/auth/login', { email: 'mia@example.com', password: 'a-good-long-passphrase' })).json,
    { twoFactor: 'setup' });

  // resend for another user: the first link stops working
  const noah = await admin.post('/api/admin/users', { email: 'noah@example.com', invite: true });
  const first = /#invite=([A-Za-z0-9_-]+)/.exec((await waitFor(() => stack.smtp.messages.find((m) => m.to === 'noah@example.com'))).text)[1];
  await admin.post(`/api/admin/users/${noah.json.id}/invite`);
  const mails = await waitFor(() => { const m = stack.smtp.messages.filter((x) => x.to === 'noah@example.com'); return m.length === 2 && m; });
  const second = /#invite=([A-Za-z0-9_-]+)/.exec(mails[1].text)[1];
  assert.equal((await c.post('/api/invite/check', { token: first })).json.valid, false);
  assert.equal((await c.post('/api/invite/check', { token: second })).json.valid, true);
});

let leaving;      // customer with a server, network and VPN device (deleted in the last test)
let leavingVm;

test('VPN: a device gets a config and lands on the gateway', async () => {
  await stack.offerTemplates();
  leaving = await stack.customerWith('leaving@example.com', { limits: {} });
  assert.equal((await leaving.post('/api/vpn/devices', { name: 'Laptop' })).status, 409, 'needs a private network first');
  leavingVm = (await leaving.post('/api/vms', { hostname: 'app', templateId: 9000, cores: 1, memoryMb: 1024, diskGb: 10, username: 'u', password: 'supersecret-123' })).json.vmid;
  assert.equal((await stack.serverSettled(leaving, leavingVm)).state, 'ready');
  const r = await leaving.post('/api/vpn/devices', { name: 'Laptop' });
  assert.equal(r.status, 201, r.text);
  assert.match(r.json.config, /\[Interface\][\s\S]*PrivateKey[\s\S]*\[Peer\]/);
  await waitFor(() => /\[Peer\]/.test(stack.mock.gwFiles['/etc/wireguard/panel-peers.conf'] ?? ''), { what: 'gateway peer' });
});

test('admin server actions: assigned servers yes, the VPN gateway never', async () => {
  const lena = await stack.customerWith('actions@example.com');
  await admin.put('/api/admin/vms/101', { userId: lena.userId });
  assert.equal((await admin.post('/api/admin/vms/101/power/start')).status, 200);
  await admin.put('/api/admin/vms/150', { userId: lena.userId });
  assert.equal((await admin.post('/api/admin/vms/150/power/stop')).status, 403);
  assert.equal((await admin.del('/api/admin/vms/150/server')).status, 403);
  await admin.del('/api/admin/vms/150');
});

test('deleting a customer removes servers, VPN devices, the private network and the account', async () => {
  await admin.put('/api/admin/vms/102', { userId: leaving.userId });
  const plan = (await admin.get(`/api/admin/users/${leaving.userId}/deletion-plan`)).json;
  assert.deepEqual(plan.servers.map((s) => s.vmid).sort(), [102, leavingVm].sort());
  assert.equal(plan.vpnDevices, 1);
  assert.equal(plan.network.vnet, 'cu0001');

  assert.equal((await admin.del(`/api/admin/users/${leaving.userId}`)).status, 202);
  await waitFor(async () => !(await admin.get('/api/admin/users')).json.some((u) => u.id === leaving.userId),
    { timeout: 60_000, what: 'customer deleted' });
  assert.equal(stack.mock.vms.has(102), false, 'assigned server destroyed');
  assert.equal(stack.mock.vms.has(leavingVm), false, 'own server destroyed');
  assert.equal(stack.mock.sdn.vnets.some((v) => v.vnet === 'cu0001'), false, 'VNet removed');
  assert.equal(/\[Peer\]/.test(stack.mock.gwFiles['/etc/wireguard/panel-peers.conf'] ?? ''), false, 'VPN peer removed');
  assert.equal((await leaving.get('/api/vms')).status, 401, 'session no longer valid');
});
