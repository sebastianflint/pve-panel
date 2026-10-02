---
title: Command line
sidebar_position: 5
---

Helper commands, run in the project folder (or inside the container with
`docker compose exec panel …`).

| Command | Purpose |
|---|---|
| `npm run user:create -- <email> <password> [--admin] [--require-2fa]` | Create a user |
| `npm run vm:assign -- <vmid> <email> [label]` | Assign an existing VM or container |
| `npm run user:reset-2fa -- <email>` | Remove 2FA from an account (lost phone, locked-out admin) |
| `npm run db:backup [-- <file>]` | Consistent copy of the database while the panel runs |
| `npm start` / `npm run dev` | Start the panel (dev: restart on changes) |

Releases (maintainers):

```bash
npm version patch|minor|major
git push --follow-tags
```
