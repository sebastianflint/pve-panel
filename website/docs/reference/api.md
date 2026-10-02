---
title: API
sidebar_position: 2
---

Customer endpoints (session required):

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/vms` | List own servers with live status |
| GET | `/api/vms/:vmid` | Detail: specs, status, guest-agent IPs |
| POST | `/api/vms/:vmid/power/:action` | `start`, `shutdown`, `reboot`, `stop` |
| GET | `/api/vms/:vmid/rrd?timeframe=hour` | Usage graphs (`hour`, `day`, `week`, `month`) |
| GET/POST | `/api/vms/:vmid/snapshots` | List / create (limited by `MAX_SNAPSHOTS`) |
| POST | `/api/vms/:vmid/snapshots/:name/rollback` | Roll back |
| DELETE | `/api/vms/:vmid/snapshots/:name` | Delete |
| POST | `/api/vms/:vmid/console` | Create a one-time console session |
| GET (ws) | `/api/console/:session` | Console websocket |
| GET | `/api/tasks/:upid` | Progress of a task this user started |
| GET | `/api/account` | Whether the user may create servers, limits and usage |
| GET | `/api/templates` | Images the user can create servers from |
| POST | `/api/vms` | Create a server (runs in the background) |
| DELETE | `/api/vms/:vmid` | Delete a server the customer created (must be stopped) |
| GET | `/api/vpn` | VPN status and the customer's devices |
| POST | `/api/vpn/devices` | Add a device; returns the config and QR code (only time the key is shown) |
| DELETE | `/api/vpn/devices/:id` | Remove a device |
| GET/POST/DELETE | `/api/vms/:vmid/tailscale` | Tailscale status / connect (auth key, mode, name) / disconnect |
| POST | `/api/auth/2fa/verify`, `/api/auth/2fa/setup`, `/api/auth/2fa/activate` | Second sign-in step: code, or forced setup |
| GET/POST | `/api/account/2fa`, `…/setup`, `…/activate`, `…/disable`, `…/recovery-codes` | Manage your own 2FA |

Admin endpoints (admin port, admin session required): `GET/POST /api/admin/users`,
`PATCH/DELETE /api/admin/users/:id`, `GET /api/admin/vms`,
`PUT/DELETE /api/admin/vms/:vmid`, `POST /api/admin/vms/:vmid/power/:action`,
`DELETE /api/admin/vms/:vmid/server`, `GET /api/admin/users/:id/deletion-plan`,
`GET /api/admin/tasks/:upid`, `GET /api/admin/templates`,
`PUT/DELETE /api/admin/templates/:vmid`, `GET /api/admin/vpn`,
`DELETE /api/admin/vpn/devices/:id`, `POST /api/admin/vpn/sync`, `GET /api/admin/audit`.
