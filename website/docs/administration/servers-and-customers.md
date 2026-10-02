---
title: Servers and customers
sidebar_position: 1
---

**Managing customer servers:** in the Servers tab, every server assigned to a
customer has buttons to start, shut down, restart, force stop and delete it.
Deleting stops the server if needed and removes it with its disks and snapshots
(type the server ID to confirm). Unassigned servers, templates and the VPN gateway
can't be controlled or deleted from the panel.

**Deleting a customer** removes everything that belongs to them, in the
background: their servers are stopped and deleted, their VPN devices removed from
the gateway, their private VNet and subnet deleted from Proxmox (SDN applied),
and finally the account. The dialog lists what will be deleted and asks for the
customer's email. Tick "Keep the servers you assigned" to only unassign servers
you gave them; servers they created are always deleted. The customer can't sign
in once deletion starts. If a step fails, the Customers tab shows the reason;
click Retry, which reopens the dialog with the current situation. Every step is
safe to repeat.

**Servers that are no longer the customer's but still in their network** (for
example a server you reassigned to yourself) keep the VNet in use, and Proxmox
can't remove a network that's in use. The dialog lists them and preselects **Keep
the private network**: the customer is deleted, the VNet stays for those servers,
and its address range isn't given to anyone else. Alternatively move the server
out first (Hardware, Network Device, another bridge). If you move it, also remove
the panel's firewall entries from it (Firewall: the `ipfilter-net0` IP set and
the rules starting with "panel:"), since they pin it to the customer's subnet. The CLI
commands still work if you prefer scripts:

```bash
npm run user:create -- admin@example.com 'a-long-password' --admin
npm run user:create -- customer@example.com 'another-long-password'
npm run vm:assign -- 101 customer@example.com "Web server"
```

`vm:assign` looks the guest up in the cluster, so it detects VM vs container
automatically.
