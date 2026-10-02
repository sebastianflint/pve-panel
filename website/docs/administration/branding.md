---
title: Branding
sidebar_position: 4
---

**Product name:** set `PANEL_NAME` in `.env` (default `PVE Panel`) and restart. It
appears on both sign-in pages, in the sidebar and in browser tabs.

**Own OS icons:** the panel shows neutral glyphs for Windows and Linux servers. To
use your own icons instead, put `os-windows.svg` and/or `os-linux.svg` (or `.png` /
`.webp`) into the branding folder: `BRANDING_DIR`, default `data/branding/` next to
the database. With Docker, mount a folder and set `BRANDING_DIR` (see
`docker-compose.yml`). Only these file names are served, with a strict sandbox
policy. Make sure you're allowed to use the images you put there.
