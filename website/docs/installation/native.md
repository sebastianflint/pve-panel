---
title: Install without Docker
sidebar_position: 5
---

Requires Node.js 22.13 or newer (it uses Node's built-in `node:sqlite`, so there is nothing to compile).

:::warning Keep Node.js patched
Use the newest patch release of Node.js 22 or 24 (at least **22.23.4** or **24.22.1**,
which fix CVE-2026-111497 in the bundled Brotli decoder and further security issues).
The Docker image already contains a fixed version.
:::

```bash
npm install
cp example.env .env     # then fill in PVE_URL, PVE_TOKEN_ID, PVE_TOKEN_SECRET, JWT_SECRET
```

Create the first administrator on the command line:

```bash
npm run user:create -- admin@example.com 'a-long-password' --admin
```

Then open the admin interface on port 3001 to add customers, assign servers,
offer templates, set limits, reset passwords and read the activity log.



```bash
npm start          # production
npm run dev        # restarts on file changes
```

For local testing over plain http, set `COOKIE_SECURE=false`, otherwise the browser
won't store the session cookie.
