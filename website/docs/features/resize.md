---
title: Resize
sidebar_position: 4
---

Customers change CPU cores, memory and disk of servers they created themselves
under **Change size…** on the server page, within their plan. The form shows how
much this server may use: the plan minus everything else the customer uses.

- **CPU and memory** are written to the VM configuration immediately. On a running
  server Proxmox keeps them *pending* until the panel restarts the server (a
  restart inside the guest doesn't apply them). "Restart the server now" does that
  right away; otherwise the server page shows "Size change waiting for a restart"
  with a restart button.
- **Plan usage** is calculated from each server's configuration, which includes
  pending values, so pending increases on several servers can't add up beyond the
  plan. The "New server" form uses the same numbers.
- **Disks only grow** (Proxmox can't shrink them) and are enlarged immediately,
  also while running. Linux cloud images grow the root partition at the next boot
  (cloud-init). For Windows, the panel extends drive `C:` through the guest agent
  while the server runs; if a partition (usually Recovery) sits behind `C:`, the
  customer is told to extend it in Disk Management. Some storage types refuse to
  enlarge disks that have snapshots; the Proxmox message is shown then.
- Windows servers need at least 2 GB of memory. Each resize is logged with the
  sizes before and after.
