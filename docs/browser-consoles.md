# Browser consoles

LXC containers use xterm.js and Proxmox's native `termproxy` endpoint. Virtual
machines keep noVNC and `vncproxy` for their graphical screen. No SSH service,
password collection or additional host helper is needed for a CT terminal.
The existing `VM.Console` permission on the service pool covers both paths.

The panel authenticates the customer, verifies current ownership and running
state, and issues a random one-use session valid for 30 seconds. It checks
ownership again when the authenticated WebSocket redeems that session. Browser
origins, when present, must match the panel host. Proxmox terminal tickets and
service usernames remain server-side. They are never sent to the browser or
included in connection-error logs. VNC retains its existing browser RFB password
because that handshake is handled by noVNC.

The terminal bridge authenticates upstream and waits for the `OK` acknowledgement
before forwarding input. It uses the documented termproxy byte-length input,
resize and keepalive frames. UTF-8 and binary terminal input are supported, with
bounded input queues and output buffers. Socket closure and reconnect release the
upstream connection. The terminal uses the CT's existing console/login mode;
this feature does not enable passwordless guest login or change any credentials.

The browser provides selection/copy, native terminal paste, automatic rows/columns,
full screen and reconnect. `Ctrl+Shift+C` copies the terminal selection and
`Ctrl+Shift+V` pastes when the browser grants clipboard access. Plain `Ctrl+C`
retains its terminal interrupt behavior.

The browser libraries are pinned npm dependencies and served locally. No terminal
session data or keystrokes are persisted by the panel. Proxmox/guest-side logging
and shell history keep their normal behavior.

Protocol reference: https://github.com/proxmox/pve-xtermjs#readme
