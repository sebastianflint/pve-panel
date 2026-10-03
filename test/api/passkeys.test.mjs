// Passkeys: registration, sign-in, 2FA interplay, and attacks (phishing origin,
// no user verification, replayed counter, forged signature, reused challenge).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { startStack, Session, totp } from '../support/stack.mjs';
import { SoftAuthenticator } from '../support/soft-authenticator.mjs';

let stack;
let base;      // customer portal by name (passkeys need a domain; localhost counts)
let phone;     // the customer's authenticator
const atLocalhost = (url) => url.replace('127.0.0.1', 'localhost');

async function signedIn(email, password = 'another-long-password') {
  const s = new Session(base);
  const r = await s.post('/api/auth/login', { email, password });
  assert.equal(r.status, 200, r.text);
  return s;
}
async function register(session, auth, name = 'Laptop') {
  const o = await session.post('/api/account/passkeys/options', {});
  assert.equal(o.status, 200, o.text);
  return session.post('/api/account/passkeys', { key: o.json.key, response: auth.create(o.json.options), name });
}
async function passkeySignIn(session, auth, how = {}) {
  const o = await session.post('/api/auth/passkey/options');
  assert.equal(o.status, 200, o.text);
  return session.post('/api/auth/passkey/verify', { key: o.json.key, response: auth.get(o.json.options, how) });
}

before(async () => {
  stack = await startStack();
  base = atLocalhost(stack.customerUrl);
  phone = new SoftAuthenticator(base);
  const a = await stack.adminSession();
  await a.post('/api/admin/users', { email: 'lena@example.com', password: 'another-long-password' });
});
after(async () => { await stack?.stop(); });

test('offered on a domain name (localhost), not on a bare IP address', async () => {
  assert.equal((await new Session(base).get('/api/auth/options')).json.passkeys, true);
  assert.equal((await stack.customer().get('/api/auth/options')).json.passkeys, false);
  assert.equal((await stack.customer().post('/api/auth/passkey/options')).status, 400);
});

test('registers a passkey and signs in with it, without email or password', async () => {
  const lena = await signedIn('lena@example.com');
  const added = await register(lena, phone, 'Laptop');
  assert.equal(added.status, 201, added.text);
  const list = (await lena.get('/api/account/passkeys')).json.passkeys;
  assert.deepEqual(list.map((p) => [p.name, p.domain]), [['Laptop', 'localhost']]);

  const fresh = new Session(base);
  const r = await passkeySignIn(fresh, phone);
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.email, 'lena@example.com');
  assert.equal((await fresh.get('/api/vms')).status, 200);
  assert.ok((await fresh.get('/api/account/passkeys')).json.passkeys[0].lastUsedAt, 'last use recorded');
});

test('a phishing site (other origin) gets nothing', async () => {
  const r = await passkeySignIn(new Session(base), phone, { origin: 'https://panel-login.example.net' });
  assert.equal(r.status, 401);
});

test('user verification (fingerprint/PIN) is required', async () => {
  const r = await passkeySignIn(new Session(base), phone, { userVerified: false });
  assert.equal(r.status, 401);
});

test('a forged signature and a replayed counter are refused', async () => {
  assert.equal((await passkeySignIn(new Session(base), phone, { breakSignature: true })).status, 401);
  // counter going backwards = a cloned authenticator
  assert.equal((await passkeySignIn(new Session(base), phone, { counter: 0 })).status, 401);
  // a correct sign-in still works afterwards
  assert.equal((await passkeySignIn(new Session(base), phone)).status, 200);
});

test('a challenge works once', async () => {
  const s = new Session(base);
  const o = (await s.post('/api/auth/passkey/options')).json;
  const response = phone.get(o.options);
  assert.equal((await s.post('/api/auth/passkey/verify', { key: o.key, response })).status, 200);
  assert.equal((await s.post('/api/auth/passkey/verify', { key: o.key, response })).status, 401);
});

test('an unknown passkey is refused', async () => {
  const stranger = new SoftAuthenticator(base);
  const s = new Session(base);
  const o = (await s.post('/api/auth/passkey/options')).json;
  stranger.create({ rp: { id: 'localhost' }, user: { id: 'x' }, challenge: 'x' });
  assert.equal((await s.post('/api/auth/passkey/verify', { key: o.key, response: stranger.get(o.options) })).status, 401);
});

test("a customer's passkey doesn't open the admin portal", async () => {
  const admin = new Session(atLocalhost(stack.adminUrl));
  const o = (await admin.post('/api/auth/passkey/options')).json;
  const response = phone.get(o.options, { origin: atLocalhost(stack.adminUrl) });
  assert.equal((await admin.post('/api/auth/passkey/verify', { key: o.key, response })).status, 401);
});

test('adding a passkey with an older session needs the password', async () => {
  const lena = await signedIn('lena@example.com');
  // a session token issued 30 minutes ago (same signing key as the test panel)
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const iat = Math.floor(Date.now() / 1000) - 1800;
  const unsigned = `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc({ sub: lena.userId ?? 2, scope: 'customer', iat, exp: iat + 7200 })}`;
  const sig = crypto.createHmac('sha256', 'test-secret-test-secret-test-secret').update(unsigned).digest('base64url');
  lena.cookies.set('panel_session', `${unsigned}.${sig}`);
  const me = await lena.get('/api/auth/me');
  assert.equal(me.status, 200, 'old session still valid');
  const old = await lena.post('/api/account/passkeys/options', {});
  assert.equal(old.status, 403);
  assert.equal(old.json.needPassword, true);
  assert.equal((await lena.post('/api/account/passkeys/options', { password: 'wrong-password-123' })).status, 403);
  assert.equal((await lena.post('/api/account/passkeys/options', { password: 'another-long-password' })).status, 200);
});

test('a passkey satisfies required 2FA (no code step)', async () => {
  const a = await stack.adminSession();
  await a.post('/api/admin/users', { email: 'mfa@example.com', password: 'another-long-password', requireTotp: true });
  const s = new Session(base);
  await s.post('/api/auth/login', { email: 'mfa@example.com', password: 'another-long-password' });
  const key = (await s.post('/api/auth/2fa/setup')).json.key;
  await s.post('/api/auth/2fa/activate', { code: totp(key) });
  const key2 = new SoftAuthenticator(base);
  assert.equal((await register(s, key2, 'Phone')).status, 201);

  const r = await passkeySignIn(new Session(base), key2);
  assert.equal(r.status, 200, 'signed in directly');
  assert.equal(r.json.twoFactor, undefined);
});

test('removing passkeys (own, or by the admin) ends their use', async () => {
  const lena = await signedIn('lena@example.com');
  const [p] = (await lena.get('/api/account/passkeys')).json.passkeys;
  assert.equal((await lena.del(`/api/account/passkeys/${encodeURIComponent(p.id)}`)).status, 204);
  assert.equal((await passkeySignIn(new Session(base), phone).catch(() => ({ status: 401 }))).status, 401);

  // the admin removes all passkeys of another user (lost phone)
  const a = await stack.adminSession();
  const users = (await a.get('/api/admin/users')).json;
  const mfa = users.find((u) => u.email === 'mfa@example.com');
  assert.equal(mfa.passkeyCount, 1);
  await a.patch(`/api/admin/users/${mfa.id}`, { removePasskeys: true });
  assert.equal((await a.get('/api/admin/users')).json.find((u) => u.email === 'mfa@example.com').passkeyCount, 0);
});
