# LXC root password recovery (CasaRiccardo fork)

This opt-in feature adds **Reset root password** to the customer's server Overview.
It works only for running, unlocked, unprivileged LXC containers on the configured
node. The customer must own the server in the panel. Virtual machines are not
supported by this implementation. Existing files and SSH keys are retained;
changing a password does not change the guest's SSH password-login policy.

Proxmox VE 9.2 has no LXC password-reset API. Install the root-owned Python helper
`scripts/ct-password-reset-helper.py` as `/usr/local/sbin/pve-panel-ct-password-reset`
on the Proxmox node. Create `/etc/pve-panel/ct-password-reset.json`, owned by root
and mode 600, containing `{"pool":"customers"}` with your actual allowed pool.
Keep the configuration directory root-only, and the helper executable owned by root.

Generate a dedicated Ed25519 key for this operation. On the Proxmox node, authorize
its public key with all of these restrictions (replace the source address):

```
restrict,from="PANEL_SOURCE_IP",command="/usr/local/sbin/pve-panel-ct-password-reset" ssh-ed25519 PUBLIC_KEY
```

Do not reuse the panel's API token or an unrestricted management SSH key. Store
the private key as a read-only container secret available only to the panel user.
Pin the Proxmox SSH host key in a separate known_hosts secret, verified using an
already trusted management channel. The image needs the OpenSSH client.

Configure the panel:

```
CT_PASSWORD_RESET_ENABLED=true
CT_PASSWORD_RESET_NODE=proxmox-node-name
CT_PASSWORD_RESET_HOST=proxmox-address
CT_PASSWORD_RESET_KEY_FILE=/run/secrets/ct-reset-key
CT_PASSWORD_RESET_KNOWN_HOSTS_FILE=/run/secrets/ct-reset-known-hosts
```

The forced command accepts only `reset-root-password-v1`, with a bounded JSON
request on stdin. It independently verifies local-node LXC membership in the allowed
pool, unprivileged mode, running state and absence of locks. It runs only `pct exec
VMID -- /usr/sbin/chpasswd`, supplies the fixed root account and password via stdin,
and returns fixed result codes. There is no general command-execution API. No
password is stored in the panel database, arguments, environment or audit event.
SSH forwarding and PTYs are denied by the key restrictions. An additional per-CT
lock and request rate limit guard concurrent/repeated changes. Only a generic
failure is returned if the helper or guest command fails.

Back up the panel database/configuration, authorized_keys and helper configuration
before installing. To disable, set `CT_PASSWORD_RESET_ENABLED=false`, remove the
dedicated authorized-key entry and restart the panel. Other SSH keys stay untouched.

Verification: Node unit/API tests, Playwright form checks and Python helper tests
(`python3 -m unittest discover -s test/helper`). Test the forced-command restrictions
and actual password recovery on a disposable CT before enabling customer access.
