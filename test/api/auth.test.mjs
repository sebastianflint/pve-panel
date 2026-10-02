// Sign-in, separate portals, sessions, 2FA (required setup, codes, replay, recovery codes)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startStack, Session, totp, ADMIN, sleep } from '../support/stack.mjs';

let stack;
before(async () => { stack = await startStack(); });
after(async () => { await stack?.stop(); });

test('wrong password is refused with a generic message; the right one signs in', async () => {
  const s = stack.admin();
  const bad = await s.post('/api/auth/login', { email: ADMIN.email, password: 'wrong-password-123' });
  assert.equal(bad.status, 401);
  assert.equal(bad.json.error, 'Email or password is incorrect');
  const ok = await s.post('/api/auth/login', ADMIN);
  assert.equal(ok.status, 200);
  assert.equal((await s.get('/api/auth/me')).json.email, ADMIN.email);
});

test('customers cannot sign in on the admin port, and sessions do not cross portals', async () => {
  const c = await stack.customerWith('portal@example.com');
  const onAdmin = await stack.admin().post('/api/auth/login', { email: 'portal@example.com', password: 'another-long-password' });
  assert.equal(onAdmin.status, 401, 'same answer as a wrong password');

  const borrowed = new Session(stack.adminUrl);
  borrowed.cookies = new Map(c.cookies);          // customer cookie sent to the admin port
  assert.equal((await borrowed.get('/api/admin/users')).status, 401);

  const a = await stack.adminSession();
  const reversed = new Session(stack.customerUrl);
  reversed.cookies = new Map(a.cookies);          // admin cookie sent to the customer port
  assert.equal((await reversed.get('/api/vms')).status, 401);
});

test('the customer port has no admin routes at all', async () => {
  const c = await stack.customerWith('noadmin@example.com');
  assert.equal((await c.get('/api/admin/users')).status, 404);
});

test('sign-out ends the session', async () => {
  const c = await stack.customerWith('logout@example.com');
  assert.equal((await c.get('/api/vms')).status, 200);
  await c.post('/api/auth/logout');
  assert.equal((await c.get('/api/vms')).status, 401);
});

test('security headers are set', async () => {
  const r = await stack.customer().get('/');
  assert.match(r.headers.get('content-security-policy') ?? '', /default-src 'self'/);
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
});

test('required 2FA: set up at first sign-in, then codes; replay and reused recovery codes are refused', async () => {
  const a = await stack.adminSession();
  const created = await a.post('/api/admin/users', { email: 'mfa@example.com', password: 'another-long-password', requireTotp: true });
  assert.equal(created.status, 201);

  const c = stack.customer();
  const step1 = await c.post('/api/auth/login', { email: 'mfa@example.com', password: 'another-long-password' });
  assert.deepEqual(step1.json, { twoFactor: 'setup' });
  assert.equal((await c.get('/api/vms')).status, 401, 'no access before 2FA is set up');

  const setup = await c.post('/api/auth/2fa/setup');
  assert.match(setup.json.qrSvg, /<svg/);
  const key = setup.json.key;
  assert.equal((await c.post('/api/auth/2fa/activate', { code: '000000' })).status, 400);
  const activated = await c.post('/api/auth/2fa/activate', { code: totp(key) });
  assert.equal(activated.status, 200);
  assert.equal(activated.json.recoveryCodes.length, 10);
  assert.equal((await c.get('/api/vms')).status, 200);
  const [recovery] = activated.json.recoveryCodes;

  // next sign-in: code step; the code used for activation can't be replayed
  await c.post('/api/auth/logout');
  assert.deepEqual((await c.post('/api/auth/login', { email: 'mfa@example.com', password: 'another-long-password' })).json, { twoFactor: 'verify' });
  assert.equal((await c.post('/api/auth/2fa/verify', { code: totp(key) })).status, 401, 'replay refused');
  assert.equal((await c.post('/api/auth/2fa/verify', { code: totp(key, 1) })).status, 200, 'next code accepted');

  // recovery code works exactly once
  for (const expected of [200, 401]) {
    await c.post('/api/auth/logout');
    await c.post('/api/auth/login', { email: 'mfa@example.com', password: 'another-long-password' });
    assert.equal((await c.post('/api/auth/2fa/verify', { code: recovery })).status, expected);
  }

  // a user with required 2FA cannot switch it off
  await sleep(10);
  await c.post('/api/auth/login', { email: 'mfa@example.com', password: 'another-long-password' });
  await c.post('/api/auth/2fa/verify', { code: activated.json.recoveryCodes[1] });
  const off = await c.post('/api/account/2fa/disable', { code: activated.json.recoveryCodes[2] });
  assert.equal(off.status, 403);
});
