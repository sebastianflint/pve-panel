---
title: Docker Compose
sidebar_position: 2
---

The project includes a `Dockerfile`, a `docker-compose.yml` and a `Caddyfile`.
The image is small and pure JavaScript, so it builds the same on amd64 and arm64.
It runs as an unprivileged user, has a health check, and stops cleanly within
milliseconds on `docker stop`.

```bash
cp example.env .env            # fill in PVE_*, JWT_SECRET, … as usual
docker compose up -d --build

# first administrator (and all other helper commands) inside the container
docker compose exec panel npm run user:create -- admin@example.com 'a-long-password' --admin
```

- **Ports:** the customer panel on `3000`, the admin interface only on
  `127.0.0.1:3001` of the Docker host (SSH tunnel as before). The container itself
  listens on all interfaces; the compose file keeps the admin port local.
  `HOST`, `ADMIN_HOST` and `DB_PATH` are set by the compose file, whatever `.env` says.
- **Data:** the database lives in the `panel-data` volume. Back it up while the
  panel runs with `docker compose exec panel npm run db:backup` (writes a
  consistent copy to `/app/data/backups/`), then copy it out:
  `docker compose cp panel:/app/data/backups ./backups`.
- **HTTPS with automatic certificates:** set `PANEL_DOMAIN=panel.example.com` in
  `.env` (DNS pointing at this host, ports 80 and 443 reachable) and start with
  `docker compose --profile https up -d --build`. Caddy gets and renews a Let's
  Encrypt certificate and forwards to the panel, including the console's
  WebSockets. Set `COOKIE_SECURE=true` and `PANEL_PUBLIC_URL=https://panel.example.com`,
  and remove the `3000:3000` line so the panel is only reachable through Caddy.
- **Proxmox CA:** mount your `pve-root-ca.pem` (see the commented line in
  `docker-compose.yml`) and set `PVE_CA_FILE=/app/certs/pve-root-ca.pem`.
- **Updating:** `docker compose up -d --build` after replacing the files; the
  database is migrated at start, the volume keeps everything.
- **Networking:** the container needs outbound access to the Proxmox API (8006)
  and, for single sign-on, to your identity provider. The panel host's clock
  (which containers share) must be right for 2FA codes.
