// A Windows server end to end: OOBE wait, password set and verified, DHCP, rename.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startStack } from '../support/stack.mjs';

let stack;
let lena;
before(async () => {
  stack = await startStack();
  await stack.offerTemplates();
  lena = await stack.customerWith('lena@example.com', { limits: {} });
});
after(async () => { await stack?.stop(); });

test('refuses weak Windows passwords and long computer names', async () => {
  const base = { templateId: 9100, cores: 2, memoryMb: 4096, diskGb: 60 };
  assert.equal((await lena.post('/api/vms', { ...base, hostname: 'win', password: 'alllowercaseletters' })).status, 400);
  assert.equal((await lena.post('/api/vms', { ...base, hostname: 'a-very-long-windows-name', password: 'Winter-Sun-2026!x' })).status, 400);
});

test('creates a Windows server', { timeout: 120_000 }, async () => {
  const r = await lena.post('/api/vms', { templateId: 9100, cores: 2, memoryMb: 4096, diskGb: 60, hostname: 'win-office', password: 'Winter-Sun-2026!x' });
  assert.equal(r.status, 202, r.text);
  const v = await stack.serverSettled(lena, r.json.vmid, 110_000);
  assert.equal(v.state, 'ready', v.error);
  assert.equal(v.os, 'windows');
  assert.match(stack.mock.vms.get(r.json.vmid).cfg.net0, /^e1000=/, 'NIC model from the template');
});
