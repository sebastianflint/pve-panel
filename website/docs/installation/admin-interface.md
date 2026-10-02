---
title: Reaching the admin interface
sidebar_position: 6
---

By default the admin server listens on `127.0.0.1:3001` only. From your own
machine, open an SSH tunnel and browse to http://localhost:3001:

```bash
ssh -L 3001:127.0.0.1:3001 you@panel-host
```

To reach it over a VPN or internal network instead, set `ADMIN_HOST` to that
interface's address (or `0.0.0.0`) and restrict the port with a firewall. The
panel logs a warning at startup when the admin server isn't local-only.
