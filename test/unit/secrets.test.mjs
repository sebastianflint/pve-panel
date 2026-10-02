import '../support/unit-env.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seal, open } from '../../src/secrets.js';

test('round-trips a secret', () => {
  assert.equal(open('smtp-password', seal('smtp-password', 'mail-secret ✓')), 'mail-secret ✓');
});

test('ciphertext differs every time and does not contain the plaintext', () => {
  const a = seal('p', 'hunter2-hunter2');
  const b = seal('p', 'hunter2-hunter2');
  assert.notEqual(a, b);
  assert.ok(!a.includes('hunter2'));
  assert.match(a, /^v1:/);
});

test('a secret sealed for one purpose cannot be opened for another', () => {
  assert.throws(() => open('totp-secret', seal('smtp-password', 'x')));
});

test('tampering is detected', () => {
  const [v, iv, tag, ct] = seal('p', 'value').split(':');
  const flipped = Buffer.from(ct, 'base64');
  flipped[0] ^= 1;
  assert.throws(() => open('p', [v, iv, tag, flipped.toString('base64')].join(':')));
});
