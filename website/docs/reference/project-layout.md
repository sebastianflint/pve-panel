---
title: Project layout
sidebar_position: 3
---

```
src/
  server.js          customer + admin servers, security headers, error handling
  config.js          environment variables
  db.js              SQLite schema (users, vms, tasks, audit_log)
  pve.js             Proxmox API client and node lookup
  auth.js            sign-in, session cookie, auth guards
  routes/vms.js      customer API: list, detail, power, graphs, snapshots, tasks
  routes/console.js  VNC ticket + websocket proxy to Proxmox
  routes/admin.js    admin API: users, limits, assignments, templates, audit log
  provision.js       server creation/deletion jobs and quota checks
  network.js         per-customer SDN networks and VM firewall isolation
  windows.js         Windows setup through the QEMU guest agent
  cleanup.js         admin deletion of servers and complete customer deletion
  tailscale.js       Tailscale install/connect/status/disconnect via the guest agent
  totp.js            two-factor authentication: codes, encrypted secrets, recovery codes
  oidc.js            single sign-on: discovery, PKCE/PAR, token checks, account linking
  version.js         running version (build stamps) and the GitHub release check
  vpn.js             central WireGuard gateway: devices, keys, gateway sync
  agent.js           running commands in VMs through the guest agent
docs/
  windows/unattend.xml     sysprep answer file for Windows templates
  vpn/setup-gateway.sh     one-time setup of the WireGuard gateway VM
web/
  customer/          customer panel (served on PORT); netmap.js draws the network map
  admin/             admin interface (served on ADMIN_PORT)
  shared/            styles, icons (icons.js) and helpers used by both
scripts/             user:create, vm:assign, user:reset-2fa and db:backup CLI helpers
Dockerfile, docker-compose.yml, Caddyfile   container setup (optional HTTPS via Caddy)
deploy/docker-compose.yml                    run the prebuilt image from ghcr.io
.github/                                     image build workflow, Dependabot
```

Tests live in `test/` (unit, API and browser tests with a simulated Proxmox) — see
[Tests and quality](testing.md). The documentation website is in `website/`.
