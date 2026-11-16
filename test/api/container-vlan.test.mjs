import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startStack, waitFor } from '../support/stack.mjs';

const DEBIAN = 'local:vztmpl/debian-13-standard_13.6-1_amd64.tar.zst';
const image = { volid: DEBIAN, node: 'pve1', label: 'Tagged Debian', storage: 'local-lvm', bridge: 'vmbr0' };
let stack, admin, customer, templateId, vmid;
before(async () => {
  stack = await startStack({ env: { CUSTOMER_NETWORKS: 'false', VPN_ENABLED: 'false', SETUP_CHECK_HOURS: '0' } });
  admin = await stack.adminSession();
  customer = await stack.customerWith('vlan@example.com', { limits: {} });
});
after(async () => { await stack?.stop(); });
const offered = async () => (await admin.get('/api/admin/templates')).json.containers.find(c => c.volid === DEBIAN);

test('only admins may set an optional VLAN; invalid tags and bridge injection are rejected', async () => {
  assert.equal((await customer.put('/api/admin/ct-templates', { ...image, vlanTag: 901 })).status, 404);
  for (const vlanTag of [0, -1, 4095, 1.5, '901,ip=192.168.1.2/24']) {
    assert.equal((await admin.put('/api/admin/ct-templates', { ...image, vlanTag })).status, 400);
  }
  assert.equal((await admin.put('/api/admin/ct-templates', { ...image, bridge: 'vmbr0,tag=901' })).status, 400);
  assert.equal((await admin.put('/api/admin/ct-templates', image)).status, 200);
  assert.equal((await offered()).vlanTag, null);
  for (const vlanTag of [1, 4094, 901]) {
    assert.equal((await admin.put('/api/admin/ct-templates', { ...image, vlanTag })).status, 200);
    assert.equal((await offered()).vlanTag, vlanTag);
  }
  assert.equal((await admin.put('/api/admin/ct-templates', image)).status, 200);
  assert.equal((await offered()).vlanTag, 901, 'older clients omitting the field cannot remove isolation');
  templateId = `ct-${(await offered()).id}`;
});

test('creation and reinstall use the configured VLAN and disk storage', { timeout: 90000 }, async () => {
  const r = await customer.post('/api/vms', { hostname: 'tagged01', templateId, cores: 1, memoryMb: 1024, diskGb: 8, password: 'supersecret-123' });
  assert.equal(r.status, 202, r.text);
  vmid = r.json.vmid;
  const ready = await stack.serverSettled(customer, vmid);
  assert.equal(ready.state, 'ready', ready.error);
  const call = stack.mock.ctCreates.find(c => Number(c.vmid) === vmid);
  assert.equal(call.net0, 'name=eth0,bridge=vmbr0,tag=901,ip=dhcp,firewall=1');
  assert.equal(call.rootfs, 'local-lvm:8');
  const mac = /hwaddr=([^,]+)/.exec(stack.mock.vms.get(vmid).cfg.net0)[1];
  const reinstall = await customer.post(`/api/vms/${vmid}/reinstall`, { templateId, password: 'another-secret-456' });
  assert.equal(reinstall.status, 202, reinstall.text);
  await waitFor(async () => {
    const v = (await customer.get('/api/vms')).json.find(v => v.vmid === vmid);
    return v?.state === 'ready' && stack.mock.ctCreates.filter(c => Number(c.vmid) === vmid).length === 2;
  }, { timeout: 40000, what: 'tagged reinstall' });
  const again = stack.mock.ctCreates.filter(c => Number(c.vmid) === vmid).at(-1);
  assert.equal(again.net0, `name=eth0,bridge=vmbr0,tag=901,hwaddr=${mac},ip=dhcp,firewall=1`);
  assert.equal(again.rootfs, 'local-lvm:8');
});

test('clearing the VLAN is persisted and new untagged containers retain legacy behavior', { timeout: 60000 }, async () => {
  assert.equal((await admin.put('/api/admin/ct-templates', { ...image, vlanTag: null })).status, 200);
  assert.equal((await offered()).vlanTag, null);
  const r = await customer.post('/api/vms', { hostname: 'untagged01', templateId, cores: 1, memoryMb: 1024, diskGb: 8, password: 'supersecret-123' });
  assert.equal(r.status, 202, r.text);
  assert.equal((await stack.serverSettled(customer, r.json.vmid)).state, 'ready');
  assert.equal(stack.mock.ctCreates.find(c => Number(c.vmid) === r.json.vmid).net0, 'name=eth0,bridge=vmbr0,ip=dhcp');
  assert.match(stack.mock.vms.get(vmid).cfg.net0, /tag=901/, 'changing the image does not move existing containers');
});
