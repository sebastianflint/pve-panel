import '../support/unit-env.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareVersions } from '../../src/version.js';

test('compares versions numerically, not as text', () => {
  assert.equal(compareVersions('1.10.0', '1.9.9'), 1);
  assert.equal(compareVersions('1.0.1', '1.1.0'), -1);
  assert.equal(compareVersions('v2.0.0', '1.99.99'), 1);
  assert.equal(compareVersions('1.4.0', '1.4.0'), 0);
});

test('a development build counts as its base version', () => {
  assert.equal(compareVersions('1.4.0', '1.4.0-dev.acbbe56'), 0);
  assert.equal(compareVersions('1.4.1', '1.4.0-dev.acbbe56'), 1);
});
