---
title: How server creation works
sidebar_position: 4
---

1. The customer picks an image, size, hostname and sign-in details.
2. The panel checks their limits (counting all their servers), reserves the next
   free VMID and starts a full clone into the `customers` pool.
3. In the background it sets CPU, memory and cloud-init (user, password, SSH keys,
   network), grows the boot disk to the chosen size and starts the server.
4. The customer sees "Setting up…" until it's ready, or "Setup failed" with the
   reason and a button to remove it.

A customer can only create one server at a time. If the panel restarts during
setup, that server is marked failed; the customer (or you) can remove it.
Customers can delete servers they created, but not servers you assigned to them.
