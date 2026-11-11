// Branding: the built-in logo and icons, and an own logo / own OS icons from the
// branding folder — served only by their fixed names, in a script-free sandbox.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startStack } from '../support/stack.mjs';

let stack;
let dir;
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>';

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pve-panel-branding-'));
  stack = await startStack({ env: { SETUP_CHECK_HOURS: '0', BRANDING_DIR: dir, PANEL_NAME: 'Acme Cloud' } });
});
after(async () => {
  await stack?.stop();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('built-in logo and browser icons on both portals', async () => {
  for (const base of [stack.customerUrl, stack.adminUrl]) {
    const brand = await (await fetch(`${base}/api/brand`)).json();
    assert.equal(brand.name, 'Acme Cloud');
    assert.equal(brand.logo, null, 'no own logo yet');
    for (const [file, type] of [['favicon.svg', /svg/], ['favicon.ico', /icon/], ['apple-touch-icon.png', /png/]]) {
      const r = await fetch(`${base}/shared/${file}`);
      assert.equal(r.status, 200, file);
      assert.match(r.headers.get('content-type'), type);
    }
    const html = await (await fetch(base)).text();
    assert.match(html, /rel="icon" href="\/shared\/favicon\.svg"/);
    assert.match(html, /rel="apple-touch-icon"/);
  }
});

test('an own logo in the branding folder replaces the built-in one', async () => {
  fs.writeFileSync(path.join(dir, 'logo.svg'), SVG);
  fs.writeFileSync(path.join(dir, 'os-linux.svg'), SVG);
  fs.writeFileSync(path.join(dir, 'secret.txt'), 'nope');
  fs.writeFileSync(path.join(dir, 'logo.html'), '<script>alert(1)</script>');
  for (const base of [stack.customerUrl, stack.adminUrl]) {
    const brand = await (await fetch(`${base}/api/brand`)).json();
    assert.equal(brand.logo, '/branding/logo.svg');
    assert.deepEqual(brand.osIcons, { linux: '/branding/os-linux.svg' });

    const logo = await fetch(`${base}/branding/logo.svg`);
    assert.equal(logo.status, 200);
    assert.match(logo.headers.get('content-security-policy'), /default-src 'none'.*sandbox/, 'no scripts, even in an SVG');
    assert.equal((await fetch(`${base}/branding/secret.txt`)).status, 404, 'only the fixed names are served');
    assert.equal((await fetch(`${base}/branding/logo.html`)).status, 404);
  }
});
