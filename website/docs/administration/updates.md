---
title: Versions, releases and updates
sidebar_position: 3
---

The admin interface shows the running version in the top bar (a dot means a newer
release exists) and details under **About**: version, commit, build date, uptime,
update status and how to update. Signed-in customers see the version number in
the sidebar and on their Account page (nothing else, and not on the sign-in page);
`SHOW_VERSION_TO_CUSTOMERS=false` hides it from them.

The version comes from the **Git tag** and is stamped into the image by the
workflow, so there's nothing to edit by hand:

- **Release:** from the project folder, with everything committed:
  ```powershell
  npm version patch      # 1.0.0 -> 1.0.1  (fixes)
  npm version minor      # 1.0.1 -> 1.1.0  (new features)
  npm version major      # 1.1.0 -> 2.0.0  (breaking changes)
  git push --follow-tags
  ```
  `npm version` raises the version in `package.json`, commits that and creates
  the tag `v1.0.1`. The push starts the workflow: it builds the image as `1.0.1`
  (plus `1.0`, `1` and `latest`) and creates a **GitHub Release** with release notes
  generated from the commits. The workflow refuses a tag that doesn't match
  `package.json`, so the two can't drift apart.
- **Everyday pushes** to `main` without a tag build a development version, e.g.
  `1.0.1-dev.a1b2c3d`, published as `edge` (shown as "Development build" in About).
  They never replace `latest`, which always points to the newest release.
- **First release:** `package.json` starts at `1.0.0`; publish it once with
  `git tag -a v1.0.0 -m "v1.0.0"` and `git push --follow-tags`. From then on use
  `npm version`.
- **Update check:** About asks GitHub for the latest release (cached 6 hours,
  "Check for updates now" forces it). It needs outbound access to
  `api.github.com`; for a private repository it can't see releases.
  `UPDATE_CHECK=false` turns it off.
- **Which image to run:** `latest` is the newest release. `1.0` follows only `1.0.x`
  fixes, `1.0.0` is fully pinned, and `edge` is the newest development build from
  `main` (for testing). Releasing an *older* line later (e.g. `1.3.1` after `1.4.0`)
  would also move `latest`; pin a version if you maintain several lines.
