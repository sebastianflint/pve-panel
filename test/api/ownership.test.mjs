// Customers see and control only their own servers; everything else is 404.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startStack, waitFor } from '../support/stack.mjs';

let stack;
let lena;
let tom;
before(async () => {
  stack = await startStack();
  lena = await stack.customerWith('lena@example.com');
  tom = await stack.customerWith('tom@example.com');
  const a = await stack.adminSession();
  assert.equal((await a.put('/api/admin/vms/101', { userId: lena.userId, label: 'Lena web' })).status, 200);
});
after(async () => { await stack?.stop(); });

test('a customer sees only servers assigned to them', async () => {
  assert.deepEqual((await lena.get('/api/vms')).json.map((v) => v.vmid), [101]);
  assert.deepEqual((await tom.get('/api/vms')).json, []);
});

test("another customer's server answers 404 everywhere, like a server that doesn't exist", async () => {
  const probes = [
    ['get', '/api/vms/101'],
    ['post', '/api/vms/101/power/start'],
    ['get', '/api/vms/101/snapshots'],
    ['post', '/api/vms/101/snapshots', { name: 'x' }],
    ['post', '/api/vms/101/console'],
    ['get', '/api/vms/101/tailscale'],
    ['post', '/api/vms/101/resize', { cores: 4 }],
    ['post', '/api/vms/101/reinstall', { templateId: 9000 }],
  ];
  for (const [m, p, b] of probes) {
    const r = await tom[m](p, b);
    assert.equal(r.status, 404, `${m.toUpperCase()} ${p}`);
  }
  assert.equal((await lena.get('/api/vms/99999')).status, 404);
  assert.equal((await lena.get('/api/vms/102')).status, 404, 'unassigned server');
});

test('the owner can control the server and take snapshots', async () => {
  assert.equal((await lena.post('/api/vms/101/power/start')).status, 200);
  await waitFor(async () => (await lena.get('/api/vms/101')).json?.status === 'running', { what: 'server running' });
  assert.equal((await lena.post('/api/vms/101/snapshots', { name: 'before_update' })).status, 200);
  await waitFor(async () => (await lena.get('/api/vms/101/snapshots')).json?.some((s) => s.name === 'before_update'), { what: 'snapshot' });
});

test('servers assigned by the admin cannot be deleted, reinstalled or resized by the customer', async () => {
  assert.equal((await lena.del('/api/vms/101')).status, 403);
  assert.equal((await lena.post('/api/vms/101/reinstall', { templateId: 9000, username: 'ops', password: 'a-long-password-1' })).status, 403);
  assert.equal((await lena.post('/api/vms/101/resize', { cores: 4 })).status, 403);
});
