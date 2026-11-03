---
title: Prepare Proxmox VE
sidebar_position: 1
---

Run these commands on any cluster node. They create a dedicated user with only the
rights the panel needs. Start with **the basics**, then add the sections for the
features you use. The [Setup check](../administration/setup-check) in the admin
interface checks exactly these rights and shows the command for anything missing.

## Overview

| Feature | Path in Proxmox | Role (privileges) |
|---|---|---|
| **Basics** (always) | `/pool/customers` | PanelCustomer: `VM.Audit VM.PowerMgmt VM.Console VM.Snapshot VM.Snapshot.Rollback` + guest agent read¹ |
| Customers create servers | `/pool/customers` | + `VM.Allocate VM.Config.CPU VM.Config.Memory VM.Config.Disk VM.Config.Cloudinit VM.Config.Options VM.Config.Network` |
| | `/pool/templates` | PanelCustomer (needs `VM.Audit VM.Clone`) |
| | `/storage/<disk storage>` | PanelCustomer (needs `Datastore.AllocateSpace Datastore.Audit`) |
| Windows templates, Tailscale, Windows updates | `/pool/customers` | + guest agent commands² |
| Customer networks (`CUSTOMER_NETWORKS=true`) | `/sdn` (covers `/sdn/zones/<zone>`) | PanelNetwork: `SDN.Audit SDN.Allocate SDN.Use` |
| WireGuard VPN (`VPN_ENABLED=true`) | `/vms/<gateway VMID>` | PanelGateway: `VM.Audit` + guest agent commands² |
| Backups | `/pool/customers` | + `VM.Backup VM.Config.HWType VM.Config.CDROM` (and the `VM.Config.*` of "create servers") |
| | `/storage/<backup storage>` | PanelBackup: `Datastore.AllocateSpace Datastore.Audit` |
| Setup check sees the datacenter firewall (optional) | `/` (not inherited) | PanelAudit: `Sys.Audit` |

¹ Proxmox VE 9: `VM.GuestAgent.Audit` · Proxmox VE 8: `VM.Monitor`
² Proxmox VE 9: `VM.GuestAgent.Unrestricted` · Proxmox VE 8: `VM.Monitor`

The privilege names changed in Proxmox VE 9 (`VM.Monitor` was split into
`VM.GuestAgent.*`). The commands below use the PVE 9 names; on PVE 8 replace both
`VM.GuestAgent.Audit` and `VM.GuestAgent.Unrestricted` with `VM.Monitor`.

## The basics

```bash
pveum user add panel@pve --comment "PVE Panel"

pveum role add PanelCustomer --privs "VM.Audit VM.PowerMgmt VM.Console VM.Snapshot VM.Snapshot.Rollback VM.GuestAgent.Audit"

pveum pool add customers
pveum acl modify /pool/customers --users panel@pve --roles PanelCustomer

# --privsep 0: the token has exactly the user's rights
pveum user token add panel@pve panel --privsep 0
```

Copy the token secret shown at the end (`PVE_TOKEN_ID=panel@pve!panel`,
`PVE_TOKEN_SECRET=…`). Then put each server you want to assign into the pool:

```bash
pveum pool modify customers --vms 101,102
```

Servers outside the pool are invisible to the panel even if someone assigns them by
mistake, which is a useful second safety net.

:::note Token with privilege separation
If you create the token with `--privsep 1`, the token doesn't inherit the user's
rights: give every `pveum acl modify` below to the token instead, with
`--tokens 'panel@pve!panel'` in place of `--users panel@pve`.
:::

## Customers create servers

Skip this if you only assign servers yourself.

```bash
# Clone and configure servers (CPU, memory, disk size, cloud-init, network)
pveum role modify PanelCustomer --append 1 \
  --privs "VM.Allocate VM.Clone VM.Config.CPU VM.Config.Memory VM.Config.Disk VM.Config.Cloudinit VM.Config.Options VM.Config.Network Datastore.AllocateSpace Datastore.Audit"

# The templates customers can choose from live in their own pool
pveum pool add templates
pveum pool modify templates --vms 9000,9001
pveum acl modify /pool/templates --users panel@pve --roles PanelCustomer

# The storage new disks are created on
pveum acl modify /storage/VMStorage --users panel@pve --roles PanelCustomer
```

New servers are placed into the `customers` pool (`PVE_POOL`), so the panel's
normal rights cover them automatically.

## Guest agent commands: Windows, Tailscale, Windows updates

Needed when you offer **Windows templates** (password and computer name are set
through the guest agent), when **Tailscale** is on (`TAILSCALE_ENABLED=true`), or for
**Windows updates** through the panel:

```bash
# Proxmox VE 9
pveum role modify PanelCustomer --append 1 --privs "VM.GuestAgent.Unrestricted"
# Proxmox VE 8: VM.Monitor (already in the role if you used it for the basics)
```

This lets the panel run commands inside the customer servers through the guest agent.
Keep the API token secret.

## Customer networks (SDN)

With `CUSTOMER_NETWORKS=true` the panel creates the SDN zone, one VNet and subnet per
customer, and applies the SDN configuration:

```bash
pveum role add PanelNetwork --privs "SDN.Audit SDN.Allocate SDN.Use"
pveum acl modify /sdn --users panel@pve --roles PanelNetwork
```

One rule on `/sdn` is enough: it is inherited by the zone (`/sdn/zones/panel`, from
`SDN_ZONE`) and every customer VNet in it. That's why the setup check shows two lines
for it:

| Setup check line | Needs | Used for |
|---|---|---|
| SDN (customer networks) — `/sdn` | `SDN.Audit SDN.Allocate` | read, create and apply networks |
| SDN zone panel — `/sdn/zones/panel` | `SDN.Use` | connect servers to their VNet |

Customer networks also need **host settings** — dnsmasq, a DHCP and a ping rule, and
the **datacenter firewall switched on** (without it, customers are not isolated). Follow
the steps in [Customer networks and isolation](../networking/customer-networks).

## WireGuard VPN gateway

With `VPN_ENABLED=true`, the panel configures WireGuard on the gateway VM through the
guest agent (replace `150` with its VMID, `VPN_GATEWAY_VMID`):

```bash
# Proxmox VE 9 (on PVE 8: "VM.Audit VM.Monitor")
pveum role add PanelGateway --privs "VM.Audit VM.GuestAgent.Unrestricted"
pveum acl modify /vms/150 --users panel@pve --roles PanelGateway
```

The gateway stays outside the customer pool, so customers can never see or control it.
Setting up the gateway itself: [WireGuard VPN](../networking/wireguard-vpn).

## Backups

Only if customers should make and restore backups (see [Backups](../features/backups)).
Replace `pbs` with the name of your backup storage:

```bash
pveum role modify PanelCustomer --append 1 --privs "VM.Backup VM.Config.HWType VM.Config.CDROM"

# Only if customers DON'T create servers (otherwise you already have these):
# a restore writes the backed-up configuration, and Proxmox checks these rights for it
pveum role modify PanelCustomer --append 1 \
  --privs "VM.Config.CPU VM.Config.Memory VM.Config.Disk VM.Config.Network VM.Config.Options VM.Config.Cloudinit"

pveum role add PanelBackup --privs "Datastore.AllocateSpace Datastore.Audit"
pveum acl modify /storage/pbs --users panel@pve --roles PanelBackup
```

A restore also creates the server's disks again, so the panel needs
`Datastore.AllocateSpace` on the storage the server's disks are on (already the case if
customers create servers).

## Optional: let the setup check see the firewall

Customer isolation only works while the **datacenter firewall** is on. Reading that
setting needs `Sys.Audit` on `/`, which the panel doesn't otherwise need, so without it
the setup check shows *Not checked* there. This right is read-only, and with
`--propagate 0` it applies to `/` only, not to anything below it:

```bash
pveum role add PanelAudit --privs "Sys.Audit"
pveum acl modify / --users panel@pve --roles PanelAudit --propagate 0
```

## Check it

Open **Setup check** in the admin interface. Every right listed above that a feature you
use needs is checked there, with the exact command for anything missing. If Proxmox
rejects an action with a permission error, the message names the missing privilege; add
it to the role the same way (`pveum role modify <role> --append 1 --privs "<privilege>"`).

To see what the panel's user has right now:

```bash
pveum user permissions panel@pve
```
