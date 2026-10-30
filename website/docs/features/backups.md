---
title: Backups
sidebar_position: 6
---

Customers back up their servers, restore them, and — with a **Proxmox Backup Server**
(PBS) — browse a backup and download single files, all from the **Backups** tab of the
server page.

![Backups tab](/backups.png)

## What customers can do

| Action | What happens |
|---|---|
| **Back up now** | A full backup of the server while it keeps running (snapshot mode). Runs in the background; the tab shows the progress. |
| **Automatic backups** | Every day or every week at a time of their choice (in their own time zone). They choose how many automatic backups to keep; older ones are deleted. Backups they make themselves are never deleted automatically. |
| **Browse files** | Opens a backup like a folder: download a single file, or a whole folder as `.zip`. The server isn't touched. *Needs a Proxmox Backup Server.* |
| **Restore** | Replaces the whole server with the backup. By default the current state is backed up first, so a restore can be undone. The server is stopped for the restore and started again afterwards if it was running. |
| **Delete** | Removes a backup they made. |

![Browsing the files in a backup](/backup-files.png)

## Setting it up

### 1. A backup storage

Any Proxmox storage with the content **"VZDump backup file"** works. A **Proxmox Backup
Server** is recommended: it deduplicates (daily backups cost little space), verifies
backups, and is required for browsing files.

Add the PBS as a storage in Proxmox (Datacenter → Storage → Add → Proxmox Backup Server)
on all nodes that run customer servers. The panel uses this storage through the
Proxmox API; it never needs the backup server's credentials.

### 2. Rights for the panel

```bash
# Back up and restore the servers in the pool
pveum role modify PanelCustomer --append 1 --privs "VM.Backup"

# Restoring writes the backed-up configuration: Proxmox checks these rights for it
pveum role modify PanelCustomer --append 1 \
  --privs "VM.Config.CPU VM.Config.Memory VM.Config.Disk VM.Config.Network VM.Config.Options VM.Config.HWType VM.Config.CDROM VM.Config.Cloudinit"

# The backup storage (here called "pbs")
pveum role add PanelBackup --privs "Datastore.AllocateSpace Datastore.Audit"
pveum acl modify /storage/pbs --users panel@pve --roles PanelBackup
```

A restore also creates the server's disks again, so the panel needs
`Datastore.AllocateSpace` on the storage the server's disks are on. If customers create
servers, that's already the case.

The [Setup check](../administration/setup-check) shows which of these rights are missing.

### 3. Switch it on

**Settings → Backups** in the admin interface:

| Setting | Meaning |
|---|---|
| Allow customers to make and restore backups | On/off for everyone |
| Backup storage | The storage from step 1 |
| Backups per server | How many backups a customer may keep per server (made by them or automatic). Per customer under **Customers → Limits** (0 = no backups for that customer). |
| Automatic backups | Customers may set up daily/weekly backups |
| Keep backups of deleted servers | Off (default): the panel's backups of a server are deleted together with the server — also when it's deleted after [expiry](../administration/expiry) |

## Privacy: who sees which backup

- A customer only sees backups of **their own** servers.
- Only backups made **since the server became theirs**: when a VM ID is reused, or a
  server is assigned to another customer, earlier backups stay hidden. (After updating
  to the version with backups, this also applies to backups made before the update,
  unless the panel knows when the server was created or assigned.)
- Backups made by **your own Proxmox backup jobs** are shown to the customer (marked
  *By your provider*) and can be restored, but not deleted by them.
- Every file download is recorded in the **Activity** log.

## Good to know

- Backups don't count against the customer's disk quota. A restore does check the plan:
  a backup of a larger server can't be restored if it doesn't fit.
- Restoring replaces the server including its snapshots. The panel puts the network
  isolation rules back afterwards, even if the backup is older than them.
- At most two backups run at the same time (`BACKUP_PARALLEL` in `.env`); others wait.
  Jobs survive a restart of the panel.
- The first **Browse files** on a backup takes up to a minute: Proxmox starts a small
  helper VM to read it.
- Restoring is supported for VMs, not for containers (LXC).
