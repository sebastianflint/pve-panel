---
title: UGREEN NAS (UGOS Pro)
sidebar_position: 4
---

UGOS Pro's Docker app runs Compose projects from a folder on the NAS; no terminal
is needed for the normal setup. (DXP models; the DH2300 has no Docker support.)

**Easiest with GitHub:** if you use the [prebuilt image](prebuilt-image.md), upload only
`deploy/docker-compose.yml` (as `docker-compose.yml`) and your `.env`
into `/volume1/docker/pve-panel` and do steps 3 to 5 below;
nothing is built on the NAS. The steps below describe building on the NAS instead.

1. **Prepare `.env` on your PC:** copy `example.env` to `.env` and fill in the
   Proxmox settings and `JWT_SECRET`. For the first start add
   `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD` (at least 12 characters):
   the panel creates that administrator on first start if no accounts exist.
   While testing over plain `http://<nas-ip>:3000`, set `COOKIE_SECURE=false`.
2. **Upload:** in the UGOS **Files** app, open the `docker` shared folder, create a
   folder `pve-panel` and upload the project into it: `Dockerfile`,
   `docker-compose.yml`, `Caddyfile`, `package.json`, `package-lock.json`, `.env`
   and the folders `src`, `web`, `scripts`, `docs`. Don't upload `node_modules`.
   Check that `.env` really arrived as `.env` (not `.env.txt`).
3. **Deploy:** open the **Docker** app, go to **Project**, click **Create**, name it
   `pve-panel` and choose `/volume1/docker/pve-panel` as the path. The existing
   `docker-compose.yml` is used; start the deployment. The first build downloads
   the Node image and dependencies and takes a few minutes. The container should
   then show as running and, after about 20 seconds, healthy.
4. **Sign in** at `http://<nas-ip>:3000` (customer panel) with the initial admin,
   then remove `INITIAL_ADMIN_PASSWORD` from `.env` on the NAS.
5. **Let the NAS reach Proxmox:** add the NAS's IP to the `management` IPSet on
   Proxmox (see [host firewall](../networking/customer-networks.md)), otherwise the panel can't call the
   Proxmox API on port 8006.

**Admin interface on the NAS:** by default it's published only on the NAS itself
(`127.0.0.1:3001`). Either enable SSH on the NAS (Control Panel, Terminal) and
open a tunnel from your PC, `ssh -L 3001:127.0.0.1:3001 <user>@<nas-ip>`, then
browse to `http://localhost:3001`; or, in `docker-compose.yml`, replace that line
with the commented alternative using the NAS's LAN IP (never forward it on your
router).

**If the Project wizard doesn't build the image** (older UGOS versions only run
ready-made images), build it once over SSH and then manage it in the Docker app:

```bash
cd /volume1/docker/pve-panel
sudo docker compose up -d --build
```

**Updating:** upload the new files over the old ones (keep `.env`), then rebuild
the project in the Docker app (or `sudo docker compose up -d --build`). Data stays
in the `panel-data` volume. For backups:
`sudo docker compose exec panel npm run db:backup`, then
`sudo docker compose cp panel:/app/data/backups /volume1/docker/pve-panel/backups`.

**Ports:** 3000 and 3001 are normally free on UGOS. The optional Caddy/HTTPS
profile needs ports 80 and 443; if UGOS or another app already uses them, keep
the panel on 3000 behind your existing reverse proxy instead.
