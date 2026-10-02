---
title: Reinstall
sidebar_position: 3
---

On a server's page, customers find **Reinstall** next to "Delete server" (for
servers they created themselves, when self-service is enabled). They choose an
image (by default the current one; images needing more disk than the server has
are disabled), new sign-in details, and confirm by typing the server name.

What happens: the server is stopped and deleted in Proxmox, the image is cloned
again **under the same VM ID**, and the usual setup runs (cloud-init, or the Windows
steps). Kept: name, ID, cores, memory, disk size, and the **MAC address** of the
first network card, so the customer network's DHCP normally gives the same IP
again. The VM firewall and isolation rules are applied anew. Erased: the disk
content and all snapshots; a Tailscale connection must be made again.

The panel keeps the ID reserved while it's briefly free in Proxmox (new servers
skip IDs the panel knows). If a reinstall fails, the server shows "setup failed"
with the reason and can be reinstalled again; the MAC address is remembered in
the panel's own record even if the VM was already removed. Customers can't
reinstall servers you assigned to them.
