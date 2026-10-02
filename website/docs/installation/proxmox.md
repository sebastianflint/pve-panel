---
title: Prepare Proxmox VE
sidebar_position: 1
---

Run on any cluster node. This creates a dedicated user with only the rights the
panel needs, scoped to a pool that holds customer servers.

```bash
pveum user add panel@pve --comment "Customer panel"

# PVE 9 names. On PVE 8 use VM.Monitor instead of VM.GuestAgent.Audit.
pveum role add PanelCustomer --privs "VM.Audit VM.PowerMgmt VM.Console VM.Snapshot VM.Snapshot.Rollback VM.GuestAgent.Audit"

pveum pool add customers
pveum acl modify /pool/customers --users panel@pve --roles PanelCustomer

# --privsep 0: the token inherits exactly the user's permissions
pveum user token add panel@pve panel --privsep 0
```

Copy the token secret shown at the end. Then put each customer server into the pool:

```bash
pveum pool modify customers --vms 101,102
```

Servers outside the pool are invisible to the panel even if someone assigns them by
mistake, which is a useful second safety net.

### Extra permissions if customers may create servers

Skip this if you only assign servers yourself.

```bash
# Rights to clone, configure (CPU, RAM, cloud-init, disk size) and delete VMs
pveum role modify PanelCustomer --append 1 \
  --privs "VM.Allocate VM.Clone VM.Config.CPU VM.Config.Memory VM.Config.Disk VM.Config.Cloudinit VM.Config.Options VM.Config.Network Datastore.AllocateSpace Datastore.Audit"

# Windows templates (password + computer name through the guest agent)
pveum role modify PanelCustomer --append 1 --privs "VM.GuestAgent.Unrestricted"

# Templates customers can pick from live in their own pool
pveum pool add templates
pveum pool modify templates --vms 9000,9001
pveum acl modify /pool/templates --users panel@pve --roles PanelCustomer

# Storage that new disks are created on
pveum acl modify /storage/VMStorage --users panel@pve --roles PanelCustomer
```

If Proxmox rejects a step with a permission error, the message names the missing
privilege; add it to the role the same way.

New servers are placed into the `customers` pool (`PVE_POOL`), so the panel's
normal permissions cover them automatically.
