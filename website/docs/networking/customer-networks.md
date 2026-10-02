---
title: Customer networks and isolation
sidebar_position: 1
---

With `CUSTOMER_NETWORKS=true`, each customer who creates a server gets their own
private network: an SDN VNet (`cu0001`, `cu0002`, …) with a `/24` subnet from
`CUSTOMER_NET_PREFIX`, a gateway, DHCP, and NAT to the internet. All servers the
customer creates join it. Servers you assign manually are not changed.

```
customer 1 ──▶ cu0001  10.100.1.0/24 ─┐
customer 2 ──▶ cu0002  10.100.2.0/24 ─┼─ NAT (SNAT on the host) ─▶ internet
                                      ┘
```

The host routes between VNets, so isolation is done with the Proxmox VM firewall,
which the panel configures on every server it creates:

- drop incoming traffic from other customer networks (`10.100.0.0/16`),
- allow the customer's own subnet,
- IP filter + MAC filter: the server can only use addresses of its own subnet,
  so changing the IP inside the VM doesn't get around the rules.
- **Outgoing:** allow the customer's own network and own VPN devices, then block
  every internal range (`CUSTOMER_BLOCKED_NETS`, default all private ranges:
  `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `100.64.0.0/10`,
  `169.254.0.0/16`). Without this, the host would route and NAT customer
  traffic into your LAN and any private network behind it. The public internet
  stays reachable. If `CUSTOMER_NET_DNS` is an internal server, DNS to it is
  allowed automatically.

When the panel starts, it checks every customer-created server and adds any of
these rules that are missing, so servers created before a rule existed are
brought up to date by restarting the panel.

One-time host setup:

```bash
# 1. dnsmasq for SDN DHCP (Proxmox runs its own instances per zone)
apt install dnsmasq
systemctl disable --now dnsmasq

# 2. Rights for the panel to create VNets/subnets and apply SDN changes
pveum role add PanelNetwork --privs "SDN.Allocate SDN.Audit SDN.Use"
pveum acl modify /sdn --users panel@pve --roles PanelNetwork

# 3. Let customers' DHCP requests reach the host. No --source on purpose:
#    a server asking for an address doesn't have one yet, so its request comes
#    from 0.0.0.0 and a source filter would block it (Windows then shows a
#    169.254.x.x address). The only DHCP server on the host is the SDN one.
pvesh create /cluster/firewall/rules --type in --action ACCEPT --proto udp \
  --dport 67 --enable 1 --comment "DHCP for customer networks"

# 4. Allow ping to the host. The Proxmox firewall does NOT allow ping by default,
#    not even from the host's own subnet. Without a source, ping is allowed from
#    everywhere, including customers pinging their gateway (useful for their own
#    troubleshooting, and it exposes no service). Add --source to restrict it.
pvesh create /cluster/firewall/rules --type in --action ACCEPT --macro Ping \
  --enable 1 --comment "Ping to the host"
```

5. **Allow your own access first.** With the firewall on, Proxmox only allows the
   web UI (8006), SSH and console ports from the host's *own* subnet
   (`local_network`) plus the `management` IPSet. If you manage Proxmox from
   another subnet, or the panel runs on a machine outside the host's subnet,
   add them **before** enabling the firewall, or you lock yourself (and the
   panel) out:

   ```bash
   pvesh create /cluster/firewall/ipset --name management --comment "Admin access"
   pvesh create /cluster/firewall/ipset/management --cidr 192.168.50.0/24   # admin subnet
   pvesh create /cluster/firewall/ipset/management --cidr 192.168.60.10/32  # panel host
   pve-firewall localnet   # shows what will be allowed
   ```

6. **Enable the datacenter firewall** (Datacenter → Firewall → Options → Firewall: Yes,
   or `pvesh set /cluster/firewall/options --enable 1`). Without it, the VM firewall
   rules above are not enforced and customers are **not** isolated. Keep an
   IPMI/console session open and test web UI and SSH from your admin subnet in a
   new session before closing it. If you get locked out, run
   `pvesh set /cluster/firewall/options --enable 0` from the console.

   With the host firewall on, customers also can't reach the host's own services
   through their gateway address.

The panel creates the SDN zone (`SDN_ZONE`, type simple, DHCP dnsmasq) on first
use. Each VNet's alias is the customer's user name, e.g. `lena (example.com)` for
lena@example.com, so you can tell networks apart in the Proxmox UI; existing
VNets get their alias updated when the panel starts. Applying SDN changes applies *all* pending SDN changes, including any you
started in the web UI.

**If servers get no address** (Windows shows `169.254.x.x`, Linux has no IPv4),
watch DHCP on the host while the server asks for an address:
`tcpdump -ni cu0001 port 67 or port 68`. Requests without replies point to the
host (DHCP firewall rule above, `systemctl status 'dnsmasq@*'`); no requests at
all point to the VM (bridge in Hardware → Network Device, adapter enabled).

**Test the outgoing block once:** from a customer server, reaching your LAN
(e.g. `ping 192.168.1.1` or the Proxmox UI at `https://192.168.1.105:8006`) must
fail, while `ping 1.1.1.1` works.

**Test the isolation once** with two test customers: from a server in customer
A's network, `ping 1.1.1.1` should work and pinging customer B's server should not.

Customer servers have private addresses only. They can reach the internet, but
nothing can reach them from outside except through the panel's console, or
through the VPN described next.
