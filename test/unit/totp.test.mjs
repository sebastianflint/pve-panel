import '../support/unit-env.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { hotp, checkCode, base32Encode, base32Decode } from '../../src/totp.js';
import { totp as independentTotp } from '../support/stack.mjs';

const RFC_KEY = Buffer.from('12345678901234567890');

test('codes match the RFC 6238 SHA-1 test vectors', () => {
  const vectors = [[59, '94287082'], [1111111109, '07081804'], [1111111111, '14050471'],
    [1234567890, '89005924'], [2000000000, '69279037'], [20000000000, '65353130']];
  for (const [t, full] of vectors) assert.equal(hotp(RFC_KEY, Math.floor(t / 30)), full.slice(2), `time ${t}`);
});

test('base32 encodes the RFC key correctly and round-trips random data', () => {
  assert.equal(base32Encode(RFC_KEY), 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
  for (let n = 1; n < 64; n += 1) {
    const b = crypto.randomBytes(n);
    assert.deepEqual(base32Decode(base32Encode(b)), b);
  }
});

test('agrees with an independent TOTP implementation', () => {
  const key = crypto.randomBytes(20);
  const now = Date.now();
  const step = Math.floor(now / 30_000);
  assert.equal(hotp(key, step), independentTotp(base32Encode(key), 0, now));
});

test('accepts one step of clock drift either way, nothing more', () => {
  const now = 1111111111 * 1000;
  const step = Math.floor(now / 30_000);
  for (const d of [-1, 0, 1]) assert.equal(checkCode(RFC_KEY, hotp(RFC_KEY, step + d), -1, now), step + d);
  assert.equal(checkCode(RFC_KEY, hotp(RFC_KEY, step + 2), -1, now), null);
  assert.equal(checkCode(RFC_KEY, hotp(RFC_KEY, step - 2), -1, now), null);
});

test('refuses replayed codes (steps at or before the last used one)', () => {
  const now = 1111111111 * 1000;
  const step = Math.floor(now / 30_000);
  assert.equal(checkCode(RFC_KEY, hotp(RFC_KEY, step), step, now), null);
  assert.equal(checkCode(RFC_KEY, hotp(RFC_KEY, step + 1), step, now), step + 1);
});

test('rejects malformed input', () => {
  for (const bad of ['', '12345', '1234567', 'abcdef', null, undefined]) {
    assert.equal(checkCode(RFC_KEY, bad, -1), null, String(bad));
  }
});
