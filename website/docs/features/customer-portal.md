---
title: Customer portal
sidebar_position: 1
---

What customers see and can do after signing in.

## Overview and network map

The overview shows the customer's private network as an interactive map: servers, their
state, and VPN access. Below it, the server list with live CPU and memory use.

![Customer dashboard](/customer-dashboard.png)

## Server page

![Server details](/server-details.png)

- **Power:** start, shut down, restart, force stop
- **Overview:** server ID, operating system (Windows / Linux recognised), CPU, memory,
  disk, IP addresses (with the QEMU guest agent) and usage graphs for an hour up to a month
- **Snapshots:** create (optionally including RAM), roll back, delete — up to the
  configured maximum
- **Console:** a browser console through the panel; sessions are single-use and short-lived
- **Remote access:** connect the server to the customer's own Tailscale account
  ([Tailscale](../networking/tailscale.md))
- **Change size / Reinstall / Delete** for servers the customer created
  ([Resize](resize.md), [Reinstall](reinstall.md))

## Creating servers

When you enable self-service for a customer, **New server** creates servers from the
templates you offer, within the customer's plan (servers, CPU cores, memory, disk).
Linux servers are set up with cloud-init, Windows servers through the QEMU guest agent;
progress is shown live. See [How server creation works](../reference/server-creation.md).

![Provisioning](/provisioning.png)

## VPN access

With the WireGuard gateway enabled, customers add devices (laptop, phone), download the
configuration or scan a QR code, and reach their private network — and only that.
See [WireGuard VPN](../networking/wireguard-vpn.md).

## Account

Customers manage their two-factor authentication and see the panel version under
**Account** (the email at the bottom of the sidebar).
