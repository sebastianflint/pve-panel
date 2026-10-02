import '../support/unit-env.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../../src/db.js';
import { idpUsedMfa, resolveAccount } from '../../src/oidc.js';

const ISS = 'https://id.example.com';
const addUser = (email, isAdmin = 0) => Number(db.prepare(
  "INSERT INTO users (email, password_hash, is_admin) VALUES (?, 'x', ?)").run(email, isAdmin).lastInsertRowid);

test('multi-factor rule (amr): mfa, two methods or a hardware key', () => {
  assert.equal(idpUsedMfa({ amr: ['pwd'] }), false);
  assert.equal(idpUsedMfa({ amr: ['otp'] }), false);
  assert.equal(idpUsedMfa({ amr: [] }), false);
  assert.equal(idpUsedMfa({}), false);
  assert.equal(idpUsedMfa({ amr: ['pwd', 'mfa'] }), true);
  assert.equal(idpUsedMfa({ amr: ['pwd', 'otp'] }), true);
  assert.equal(idpUsedMfa({ amr: ['hwk'] }), true);
});

test('first sign-in links by verified email, later ones by issuer + subject', () => {
  const id = addUser('lena@example.com');
  const first = resolveAccount({ iss: ISS, sub: 'sub-lena', email: 'Lena@Example.com', email_verified: true }, { adminOnly: false });
  assert.equal(first.user.id, id);
  assert.equal(first.linked, true);
  // email changed at the provider: the stable link still finds the account
  const again = resolveAccount({ iss: ISS, sub: 'sub-lena', email: 'lena.new@example.com', email_verified: true }, { adminOnly: false });
  assert.equal(again.user.id, id);
  assert.equal(again.linked, false);
});

test('refuses unverified email, unknown users, other identities and non-admins on the admin port', () => {
  addUser('bob@example.com');
  assert.throws(() => resolveAccount({ iss: ISS, sub: 'b1', email: 'bob@example.com', email_verified: false }, { adminOnly: false }),
    (e) => e.code === 'email_unverified');
  assert.throws(() => resolveAccount({ iss: ISS, sub: 'x', email: 'nobody@example.com', email_verified: true }, { adminOnly: false }),
    (e) => e.code === 'not_found');
  resolveAccount({ iss: ISS, sub: 'b1', email: 'bob@example.com', email_verified: true }, { adminOnly: false });
  assert.throws(() => resolveAccount({ iss: ISS, sub: 'someone-else', email: 'bob@example.com', email_verified: true }, { adminOnly: false }),
    (e) => e.code === 'linked_other');
  assert.throws(() => resolveAccount({ iss: ISS, sub: 'b1', email: 'bob@example.com', email_verified: true }, { adminOnly: true }),
    (e) => e.code === 'not_admin');
});
