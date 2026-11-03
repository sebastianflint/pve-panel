---
title: Templates and container images
sidebar_position: 1
---

**Linux templates (cloud-init):** a cloud-init drive and a cloud image that runs
cloud-init (for example the official Debian or Ubuntu cloud images). Install
`qemu-guest-agent` if customers should see IP addresses. In the admin interface,
set the template's setup to "Cloud-init (Linux)".

**Windows templates (guest agent, no cloud-init needed):**

The template must boot straight to the login screen after cloning, without any
setup questions. That's what the sysprep answer file does; the project ships one
in [`docs/windows/unattend.xml`](https://github.com/sebastianflint/pve-panel/blob/main/docs/windows/unattend.xml) that answers every
welcome (OOBE) screen: license terms, product key, region and keyboard, and the
Administrator password.

1. Install Windows, the VirtIO drivers and the QEMU guest agent (both on the
   virtio-win ISO). Enable **Options → QEMU Guest Agent** on the VM.
2. Configure what every customer should get (updates, time zone, software).
   Set the network adapter to **DHCP** (no static IP, gateway or DNS). Windows
   ties IP settings to the adapter's PCI slot, not its MAC address, so clones
   would otherwise inherit the template's static settings. The panel switches
   adapters to DHCP anyway, but a clean template avoids surprises.
3. Copy `docs/windows/unattend.xml` into the VM and edit the lines marked
   `CHANGE`:
   - **Product key:** the key for your licensing. For KMS, Microsoft publishes
     the client setup keys (GVLK) per edition ("KMS client activation and
     product keys"); for SPLA or MAK, use the key from your agreement. This line
     answers the "enter product key" screen; if the image already has a key,
     the line can go.
   - **Language, keyboard, time zone:** `UILanguage` must be a language that's
     installed in the image.
   - **Temporary Administrator password:** only used until the panel sets the
     customer's password.
4. Run sysprep with it:
   ```
   copy unattend.xml C:\Windows\System32\Sysprep\unattend.xml
   C:\Windows\System32\Sysprep\sysprep.exe /generalize /oobe /shutdown /unattend:C:\Windows\System32\Sysprep\unattend.xml
   ```
5. When the VM has shut down, convert it to a template **without booting it
   again**. Booting it would run the welcome screens and use up the sysprep.

**Test the template before offering it:** clone it by hand, start the clone and
watch the console. It must end at the login screen without asking anything.

**Fixing a template that stops at the welcome screens:** a sysprep'd template
can't be edited in place. Make a full clone, start it, click through the welcome
screens once, put the corrected `unattend.xml` in place, run step 4 again, and
make that VM your new template (then point the panel's template list at it).

In the admin interface set the template's setup to "Guest agent (Windows)".
After cloning, the panel starts the VM, waits until Windows reports its setup as
complete (registry `ImageState`), sets the Administrator password, renames the
computer to the customer's hostname and reboots. The password is verified inside
Windows after setting it and again after the reboot; if the guest agent's
password call didn't take effect, the panel sets it a second way (`Set-LocalUser`).
A server is never marked ready while the template's temporary password still works. Expect 10–20 minutes. Customers
must use a password Windows accepts (three of: lowercase, uppercase, numbers,
symbols); the panel checks this before starting.

With customer networks enabled, the panel then switches every network adapter
to DHCP (removing static addresses, gateways and DNS servers left over from the
template) and waits until Windows has an address in the customer's subnet. If
none arrives within 3 minutes, creation fails with the addresses it found,
which usually points to DHCP being blocked (see the host firewall rules).

If Windows still stops at a welcome screen, the panel notices: after 15 minutes
at those screens (`WINDOWS_OOBE_TIMEOUT_MINUTES`) creation fails with a message
saying so, instead of the customer waiting for the full 45 minutes. A server
that's already waiting there can be rescued by finishing the screens in its
console; the panel then carries on by itself.

The guest agent lets the panel run commands as SYSTEM inside customer VMs, which
is why `VM.GuestAgent.Unrestricted` is needed. Keep the API token secret.

Keep template disks small; customers choose the final size and the panel grows
the disk after cloning. Servers are full clones on the template's node.

For TLS, either give Proxmox a trusted certificate or copy `/etc/pve/pve-root-ca.pem`
to the panel host and set `PVE_CA_FILE`. Avoid `PVE_VERIFY_TLS=false` outside development.

## Container images (LXC)

Besides VM templates, customers can create **containers** from the container images
Proxmox downloads (the *CT Templates* of a storage, e.g. Debian, Ubuntu, Alpine).
Nothing has to be prepared: the panel builds each container straight from the image file.

![Creating a container](/container-create.png)

**Offer an image**

1. In Proxmox, download an image: *node → local → CT Templates → Templates*
   (e.g. `debian-13-standard`). It appears in the panel's **Templates** tab under
   *Container images (LXC)*, with the node and storage it is on.
2. Tick **Offered**, give it a name customers recognise, choose the **Disk storage**
   (a storage with the content *Container*, e.g. `local-lvm`) and the minimum disk
   size, and **Save**.

Customers now see it in *New server*, marked **Container**.

**What customers get**

| | |
|---|---|
| Type | an **unprivileged** container (root inside is not root on the host); the panel never creates privileged containers |
| Sign-in | `root` with the password and/or SSH keys entered in the form |
| Network | the customer's private network, isolated like a VM (firewall, IP and MAC filter). With customer networks off: the bridge set per image (default `vmbr0`) |
| Size | CPU cores, memory (plus up to 512 MB swap) and disk from the form, counted against the plan like a VM |
| Nesting | on by default: systemd in current distributions (Debian 12+, Ubuntu 24.04+) needs it. For unprivileged containers the panel's `VM.Allocate` right is enough |

Resize, reinstall (with a container image; the MAC address and so usually the IP
address stay), snapshots, the browser console, backups and restores work like for VMs.
Changes to CPU and memory apply to a running container right away.

**Not for containers:** Windows, own kernel modules, Tailscale and Windows updates
through the panel (both need the QEMU guest agent; customers can install Tailscale in
a container themselves if you allow `/dev/net/tun`), and a snapshot with RAM.

**Images on a node's local storage** exist only on that node, so containers from them
are created there. Images on shared storage (NFS, CephFS) can be used on every node.

**Rights:** besides the rights for creating servers, the panel needs `Datastore.Audit`
on the storage the image is on (e.g. `/storage/local`) and `Datastore.AllocateSpace`
on the disk storage — see [Prepare Proxmox VE](../installation/proxmox). The
[Setup check](../administration/setup-check) shows a missing right, and an offered
image whose file was deleted in Proxmox.

