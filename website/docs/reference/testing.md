---
title: Tests and quality
sidebar_position: 6
---

PVE Panel has an automated test suite that runs on GitHub for every change.
Releases are only published when it passes.

## What is tested

| Layer | What | Where |
|---|---|---|
| **Unit** | 2FA codes against the RFC 6238 test vectors, encryption of secrets (incl. tamper detection), single sign-on account rules and MFA detection, version comparison, guest agent handling (stalls, lost results) | `test/unit/` |
| **API** | The real panel process against a simulated Proxmox: sign-in, separate portals, 2FA setup/replay/recovery codes, ownership (404 for foreign servers), creating Linux and Windows servers, private networks, plan limits incl. pending resizes, reinstall (MAC kept, snapshots erased), resize, delete, email settings, invitations, VPN, Tailscale, deleting customers | `test/api/` |
| **Passkeys** | Registration and sign-in with a software authenticator (`test/support/soft-authenticator.mjs`); phishing origin, missing user verification, forged signature, replayed counter, reused challenge, re-authentication for adding passkeys | `test/api/passkeys.test.mjs` |
| **Expiry** | Customer rules and server dates, reminders (once, not too early), stop at expiry, self-extension, final notice, deletion after the grace period, servers you assigned kept, paused deletions, no deletion without an email warning | `test/api/expiry.test.mjs` |
| **Browser** | Playwright with Chromium: sign-in, overview, server page, creating a server through the form, admin views, passkeys with Chromium's virtual authenticator | `test/e2e/` |

The simulated Proxmox (`test/support/mock-pve.mjs`) answers the API calls the panel
uses — VMs, templates, clones, tasks, SDN, firewall, snapshots, guest agent including
Windows setup and Tailscale, the WireGuard gateway. Each test file starts its own
isolated environment (simulated Proxmox, optional mail server, panel process, temporary
database) on free ports, so files run in parallel.

:::note Simulated, not real
The tests prove that the panel behaves correctly against the Proxmox API **as the
simulation models it**. They don't replace checking your real environment — see
[Security model](../security/security-model.md) and validate isolation with two test
customers before going live.
:::

## On GitHub

| Workflow | When | What |
|---|---|---|
| **Tests** | pull requests, branches other than `main` | unit + API tests on Node 22 and 24, browser tests |
| **Docker image** | `main`, release tags | runs the same tests first; builds and publishes the image only if they pass |
| **CodeQL** | `main`, pull requests, weekly | code scanning for security issues (Security → Code scanning) |
| **Documentation** | changes in `website/` | builds this site, fails on broken links |

If browser tests fail, the run keeps the Playwright report (screenshots, traces) as a
downloadable artifact for 14 days.

## Running tests locally

```bash
npm install
npm test                 # unit + API tests (about 2–4 minutes)
npm run test:unit        # only unit tests (seconds)
npm run test:api
npm run test:coverage    # coverage summary of src/ (see note below)

npx playwright install chromium   # once
npm run test:e2e         # browser tests
```

The coverage summary only counts code running inside the test process. API tests run the
panel as a separate process, so the code they exercise isn't counted there; real coverage
is higher than the number shown.

The tests never read your `.env`; they use their own temporary settings, ports and
database. Set `MOCK_PVE_DEBUG=1` to see every call the panel makes to the simulated
Proxmox.

## Writing a test

API tests start a stack and use sessions that keep cookies like a browser:

```js
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startStack } from '../support/stack.mjs';

let stack;
before(async () => { stack = await startStack(); });
after(async () => { await stack?.stop(); });

test('a customer sees only their own servers', async () => {
  const lena = await stack.customerWith('lena@example.com');
  assert.deepEqual((await lena.get('/api/vms')).json, []);
});
```

Helpers in `test/support/stack.mjs`: `adminSession()`, `customerWith(email, { limits })`,
`offerTemplates()`, `serverSettled(session, vmid)`, `agentReady(vmid)`, `totp(key)`,
and `stack.mock.control('/__lose/<vmid>/1')` to simulate guest agent problems.
