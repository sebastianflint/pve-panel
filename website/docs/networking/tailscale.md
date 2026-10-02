---
title: Tailscale
sidebar_position: 3
---

With `TAILSCALE_ENABLED=true`, every server page gets a **Remote access** tab where
customers connect the server to **their own** Tailscale account (tailnet). You
operate nothing: the customer creates an auth key in their Tailscale admin console
(Settings, Keys), pastes it, and chooses:

- **Just this server:** the server joins their tailnet and is reachable by its
  Tailscale name or `100.x` address.
- **Gateway to my private network** (Linux only): the server also advertises the
  customer's `10.100.N.0/24`, so all their servers are reachable. The customer
  approves the route once in Tailscale (Machines, the server, Edit route settings);
  the panel shows this step until it's done.

The panel installs Tailscale inside the server through the QEMU guest agent
(Linux: Tailscale's install script; Windows: the official MSI), connects it with
the key and shows the live status (connected, address, name, route approval).
Customers can disconnect again, which logs the server out of their tailnet.

- **Security:** the auth key reaches the server over the guest agent's input
  channel, sits in a root/SYSTEM-only file only while `tailscale up` runs, and is
  deleted right after. It never appears on a command line and is never stored in
  the panel. Isolation stays intact: Tailscale only connects outward (allowed by
  the egress rules), and a gateway forwards traffic with its own address in the
  customer's subnet, so other customers and your internal networks stay blocked.
- **Requirements:** the QEMU guest agent installed in the server and enabled in its
  Proxmox options (also for Linux templates now; most cloud images don't include
  it), `curl` on Linux, and outbound internet access (already there via NAT).
- **Deleting a server** doesn't remove it from the customer's tailnet; it simply
  shows as offline there until the customer removes it in their Tailscale console.

The admin interface's VPN tab lists which customer servers are connected to
Tailscale and in which mode. The panel doesn't see or manage customers' Tailscale
accounts.
