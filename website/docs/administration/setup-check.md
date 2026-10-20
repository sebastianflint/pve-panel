---
title: Setup check
sidebar_position: 6
---

The **Setup check** tab in the admin interface checks whether Proxmox and the panel
are prepared the way your enabled features need it. Every finding explains what is
wrong and how to fix it — usually with the exact command to run on a Proxmox node.

It is the quickest way to answer "why does creating a server fail?" or "are my
customers really isolated?" — and worth running after every change in Proxmox.

## What it checks

Only what you use is checked: rights for creating servers only when templates are
offered, SDN only with `CUSTOMER_NETWORKS=true`, the gateway only with `VPN_ENABLED=true`.

| Group | Checks |
|---|---|
| **Proxmox connection** | Proxmox is reachable and accepts the token (a TLS error points to `PVE_CA_FILE`), the Proxmox version, whether the certificate is verified, and whether the clocks agree (a wrong clock breaks two-factor codes). |
| **Permissions of the API token** | The token's effective rights on the customer pool, every offered template, the storage new disks go to, `/sdn` and the SDN zone, and the VPN gateway VM. Uses the right privilege names for Proxmox VE 8 (`VM.Monitor`) and 9 (`VM.GuestAgent.*`). Also warns when the panel uses a `root@pam` token or one with administrator rights on the whole datacenter. |
| **Customer servers** | Every assigned server still exists in Proxmox and sits in the pool (`PVE_POOL`). |
| **Templates** | Every offered template is still a template, has the guest agent enabled, has a cloud-init drive (Linux), and its target storage is active with enough free space. |
| **Customer networks** | The SDN zone exists with DHCP, every customer VNet exists, no SDN changes are waiting to be applied, the **datacenter firewall is on**, and every customer-created server is isolated (network card firewall flag, VM firewall on, panel rules present). |
| **Remote access** | The WireGuard gateway answers through the guest agent, and `VPN_ENDPOINT` resolves. |
| **Email** | Email is set up where features rely on it (e.g. expiring servers are never deleted without a warning email). |
| **Security** | `JWT_SECRET` is strong, cookies are https-only, the admin interface isn't reachable from the internet, administrators can't sign in with a password alone, `INITIAL_ADMIN_PASSWORD` was removed, passkeys can work on `PANEL_PUBLIC_URL`. |
| **Updates and backups** | A newer release is available; how old the newest `npm run db:backup` is. |

Each result is one of:

| Mark | Meaning |
|---|---|
| ✓ OK | set up correctly |
| ✕ Error | something doesn't work, or customers aren't protected |
| ! Warning | works, but is risky or will fail in some cases |
| *i* Note | for your information (e.g. "WireGuard VPN is off") |
| – Not checked | the panel can't see this part; the result says which (read-only) right would let it |

## Read-only

The setup check never changes anything. It only reads from the Proxmox API, plus
`wg show` on the VPN gateway. The commands under **How to fix** are for you to run.

## The datacenter firewall needs one optional right

Customer isolation only works while the **datacenter firewall** is on. Reading that
setting needs `Sys.Audit` on `/`, which the panel doesn't otherwise need, so by
default this check shows *Not checked*. To let it see the firewall, give the panel
this read-only right (not inherited by anything below `/`):

```bash
pveum role add PanelAudit --privs "Sys.Audit"
pveum acl modify / --users panel@pve --roles PanelAudit --propagate 0
```

:::warning Before switching the datacenter firewall on
Its default for incoming traffic is DROP. Allow your management access first (port
8006 and SSH from your admin network), or you can lock yourself out of Proxmox.
:::

## Automatic checks and email alerts

The check also runs **automatically**: a minute after the panel starts, then every
24 hours. When an automatic run finds a problem that wasn't there before (or got
worse, from warning to error), every administrator gets **one email** listing only
the new problems. Problems that stay are not emailed again; one that is fixed and
comes back later is.

- needs [email](./email-invitations) to be set up
- switch the emails off with *Email administrators about new problems* on the tab
- change the interval in `.env`; `0` runs the check only when you open the tab

```bash
SETUP_CHECK_HOURS=24
```

The tab shows the number of open errors and warnings, so problems are visible even
without email. Each manual run is recorded in the activity log.
