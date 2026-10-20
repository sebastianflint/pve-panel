// Setup check: finds missing Proxmox rights, broken templates, isolation and
// firewall problems, and emails administrators only about NEW problems.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { startStack, waitFor, sleep } from '../support/stack.mjs';

let stack;
let admin;
let dbh;
const run = async () => {
  const r = await admin.post('/api/admin/setup-check/run');
  assert.equal(r.status, 200, r.text);
  return r.json.result;
};
const find = (result, id) => result.checks.find((c) => c.id === id);

before(async () => {
  stack = await startStack({ env: { SETUP_CHECK_HOURS: '0' } }); // tests run it themselves
  dbh = new DatabaseSync(path.join(stack.dir, 'panel.db'));
  admin = await stack.adminSession();
});
after(async () => { dbh?.close(); await stack?.stop(); });

test('only for signed-in administrators', async () => {
  assert.equal((await stack.admin().get('/api/admin/setup-check')).status, 401);
  assert.equal((await stack.admin().post('/api/admin/setup-check/run')).status, 401);
  assert.equal((await stack.customer().get('/api/admin/setup-check')).status, 404); // not on the customer server
});

test('a fresh setup: connection, rights and security basics', async () => {
  const before = (await admin.get('/api/admin/setup-check')).json;
  assert.equal(before.result, null);
  assert.ok(before.groups.length >= 8);

  const r = await run();
  assert.equal(find(r, 'pve:reach').status, 'ok');
  assert.match(find(r, 'pve:reach').title, /Proxmox VE 9\.0\.6/);
  assert.equal(find(r, 'pve:clock').status, 'ok');
  assert.equal(find(r, 'perm:/pool/customers').status, 'ok');
  assert.equal(find(r, 'perm:/sdn').status, 'ok');
  assert.equal(find(r, 'perm:/vms/150').status, 'ok', 'VPN gateway rights');
  assert.equal(find(r, 'net:zone').status, 'info', 'zone is created with the first server');
  assert.equal(find(r, 'net:dcfw').status, 'ok');
  assert.equal(find(r, 'vpn:gateway').status, 'ok');
  assert.equal(find(r, 'mail:on').status, 'info');
  assert.equal(find(r, 'sec:jwt').status, 'ok');
  assert.equal(find(r, 'sec:cookie').status, 'warn', 'COOKIE_SECURE=false in tests');
  assert.equal(find(r, 'sec:initial').status, 'warn', 'INITIAL_ADMIN_PASSWORD still set');
  assert.equal(find(r, 'sec:admin2fa').status, 'warn');
  assert.equal(find(r, 'sec:admin').status, 'ok');
  assert.equal(r.summary.error, 0, JSON.stringify(r.checks.filter((c) => c.status === 'error')));
  // stored: the tab shows it without running again
  const again = (await admin.get('/api/admin/setup-check')).json;
  assert.equal(again.result.at, r.at);
  // and the run is in the activity log
  const log = (await admin.get('/api/admin/audit?limit=5')).json;
  assert.ok(log.some((a) => a.action === 'admin_setup_check'));
});

test('templates: missing cloud-init drive and guest agent, low storage', async () => {
  await stack.offerTemplates();
  await admin.put('/api/admin/templates/9001', { label: 'Ubuntu 24.04' }); // no agent, no cloud-init drive
  let r = await run();
  assert.equal(find(r, 'tpl:9000').status, 'ok');
  assert.equal(find(r, 'tpl:9100').status, 'ok');
  const bad = find(r, 'tpl:9001');
  assert.equal(bad.status, 'error');
  assert.match(bad.detail, /no cloud-init drive/);
  assert.match(bad.detail, /guest agent is off/);
  assert.ok(bad.fix.commands.includes('qm set 9001 --agent enabled=1'));
  assert.ok(bad.fix.commands.some((c) => /qm set 9001 --ide2 VMStorage:cloudinit/.test(c)));
  // rights for creating servers are checked once templates are offered
  assert.equal(find(r, 'perm:/vms/9000').status, 'ok');
  assert.equal(find(r, 'perm:/storage/VMStorage').status, 'ok');

  stack.mock.storageStatus.VMStorage.avail = 4 * 2 ** 30;
  r = await run();
  assert.equal(find(r, 'tpl:9000').status, 'warn');
  assert.match(find(r, 'tpl:9000').detail, /only 4 GB free of 500 GB/);
  stack.mock.storageStatus.VMStorage.avail = 300 * 2 ** 30;
  await admin.del('/api/admin/templates/9001');
});

test('missing privileges are named, with the command that adds them', async () => {
  const pool = stack.mock.perms['/pool/customers'];
  stack.mock.perms['/pool/customers'] = pool.filter((p) => !['VM.Config.Disk', 'VM.GuestAgent.Unrestricted'].includes(p));
  stack.mock.perms['/vms/9100'] = ['VM.Audit'];
  try {
    const r = await run();
    const p = find(r, 'perm:/pool/customers');
    assert.equal(p.status, 'error');
    assert.match(p.detail, /VM\.Config\.Disk/);
    assert.match(p.detail, /VM\.GuestAgent\.Unrestricted/);
    assert.match(p.detail, /Windows setup/);
    assert.ok(p.fix.commands.some((c) => c.includes('--privs "VM.Config.Disk VM.GuestAgent.Unrestricted"')));
    assert.ok(p.fix.commands.some((c) => c === 'pveum acl modify /pool/customers --users panel@pve --roles PanelCustomer'));
    const t = find(r, 'perm:/vms/9100');
    assert.equal(t.status, 'error');
    assert.match(t.detail, /VM\.Clone/);
  } finally {
    stack.mock.perms['/pool/customers'] = pool;
    stack.mock.perms['/vms/9100'] = ['VM.Audit', 'VM.Clone'];
  }
});

test('customer isolation: datacenter firewall, VM firewall, panel rules', async () => {
  const lena = await stack.customerWith('lena@example.com', { limits: {} });
  const c = await lena.post('/api/vms', { hostname: 'iso01', templateId: 9000, cores: 1, memoryMb: 1024, diskGb: 10, username: 'u', password: 'supersecret-123' });
  assert.equal(c.status, 202, c.text);
  const vmid = c.json.vmid;
  assert.equal((await stack.serverSettled(lena, vmid)).state, 'ready');

  let r = await run();
  assert.equal(find(r, 'net:zone').status, 'ok');
  assert.equal(find(r, 'net:vnets').status, 'ok');
  assert.equal(find(r, 'net:isolation').status, 'ok');
  assert.equal(find(r, 'srv:ok').status, 'ok', 'the new server is in the pool');

  stack.mock.vms.get(vmid).fwOptions.enable = '0';
  stack.mock.cluster.firewall.enable = 0;
  r = await run();
  const iso = find(r, 'net:isolation');
  assert.equal(iso.status, 'error');
  assert.match(iso.detail, new RegExp(`${vmid}: VM firewall off`));
  const dc = find(r, 'net:dcfw');
  assert.equal(dc.status, 'error');
  assert.match(dc.title, /NOT isolated/);
  assert.ok(dc.fix.commands.at(-1).includes('--enable 1'));

  // Without Sys.Audit on / the firewall can't be read: "not checked", with the optional grant
  stack.mock.perms['/'] = [];
  r = await run();
  assert.equal(find(r, 'net:dcfw').status, 'skipped');
  assert.ok(find(r, 'net:dcfw').fix.commands.some((x) => x.includes('PanelAudit')));
  stack.mock.perms['/'] = ['Sys.Audit'];
  stack.mock.cluster.firewall.enable = 1;
  stack.mock.vms.get(vmid).fwOptions.enable = 1;
});

test('assigned servers that are gone or outside the pool', async () => {
  const lena = dbh.prepare("SELECT id FROM users WHERE email = 'lena@example.com'").get().id;
  dbh.prepare("INSERT INTO vms (vmid, user_id, label) VALUES (777, ?, 'ghost')").run(lena);
  dbh.prepare("INSERT INTO vms (vmid, user_id, label) VALUES (102, ?, 'elsewhere')").run(lena);
  stack.mock.vms.get(102).pool = 'other';
  try {
    const r = await run();
    const gone = find(r, 'srv:missing');
    assert.equal(gone.status, 'error');
    assert.match(gone.detail, /777 \(ghost\)/);
    assert.ok(gone.fix.commands.includes('pveum pool modify customers --vms 777'));
    const outside = find(r, 'srv:pool');
    assert.equal(outside.status, 'warn');
    assert.match(outside.detail, /102 \(elsewhere\)/);
  } finally {
    dbh.prepare('DELETE FROM vms WHERE vmid IN (777, 102)').run();
    stack.mock.vms.get(102).pool = 'customers';
  }
});

test('email alerts can be switched off', async () => {
  const r = await admin.put('/api/admin/setup-check/settings', { notify: false });
  assert.equal(r.status, 200);
  assert.equal(r.json.notify, false);
  assert.equal((await admin.get('/api/admin/setup-check')).json.settings.notify, false);
  assert.equal((await admin.put('/api/admin/setup-check/settings', { notify: 'yes' })).status, 400);
  await admin.put('/api/admin/setup-check/settings', { notify: true });
});

test('automatic runs email administrators only about new problems', { timeout: 90_000 }, async () => {
  const auto = await startStack({ mail: true, env: { SETUP_CHECK_HOURS: '0.001', SETUP_CHECK_FIRST_SECONDS: '1' } }); // every 3.6 s
  try {
    const a = await auto.adminSession();
    // the first automatic run records the problems that already exist (no email set up yet)
    await waitFor(async () => (await a.get('/api/admin/setup-check')).json.result?.automatic, { what: 'the first automatic run' });
    await a.put('/api/admin/settings/email', {
      host: '127.0.0.1', port: auto.smtp.port, security: 'none', username: 'panel', password: 'mail-secret',
      fromName: 'PVE Panel', fromAddress: 'panel@example.com', panelUrl: auto.customerUrl,
    });
    await sleep(8000);
    assert.equal(auto.smtp.messages.length, 0, 'known problems are not emailed again');

    auto.mock.cluster.firewall.enable = 0; // a new problem
    const mail = await waitFor(() => auto.smtp.messages.find((m) => /setup check found 1 new problem/.test(m.subject)),
      { timeout: 20_000, what: 'the setup check email' });
    assert.equal(mail.to, 'admin@example.com');
    assert.match(mail.text, /datacenter firewall is off/);
    assert.doesNotMatch(mail.text, /INITIAL_ADMIN_PASSWORD/, 'only the new problem');
    await sleep(8000);
    assert.equal(auto.smtp.messages.length, 1, 'emailed once, not on every run');
  } finally {
    await auto.stop();
  }
});
