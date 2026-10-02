---
title: Security model
sidebar_position: 1
---

- **Ownership:** `ownedGuest()` in `routes/vms.js` is the single gate for every
  per-server route. Add new per-server routes through it.
- **Node lookup:** the node is resolved from `/cluster/resources` on each request,
  so live migration doesn't break anything.
- **Tasks:** users can only poll task IDs recorded in the `tasks` table for them.
- **Console:** console sessions are single-use, expire after 30 seconds, and are
  bound to the user who created them.
- **Sessions:** httpOnly, `SameSite=Strict` JWT cookie; the user is re-read from the
  database on every request so deleted accounts lose access immediately.
- **Rate limits** on sign-in, power actions, snapshots and console.
- **Audit log** of every sign-in and action, readable at `/api/admin/audit`.
