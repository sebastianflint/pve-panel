const vmid = Number(new URLSearchParams(location.search).get('vmid'));
const title = document.getElementById('console-title');
const led = document.getElementById('console-led');
const cad = document.getElementById('cad');
const paste = document.getElementById('paste');
const copy = document.getElementById('copy');
const reconnect = document.getElementById('reconnect');
const screen = document.getElementById('screen');
let rfb, terminal, socket, observer;
let generation = 0;

function setState(text, cls = '') {
  title.textContent = text;
  led.className = `led ${cls}`;
}
function release() {
  observer?.disconnect(); observer = null;
  socket?.close(); socket = null;
  terminal?.dispose(); terminal = null;
  rfb?.disconnect(); rfb = null;
  screen.replaceChildren();
}
function disconnected(text, id) {
  if (id !== generation) return;
  setState(text);
  cad.disabled = paste.disabled = copy.disabled = true;
  reconnect.disabled = false;
  if (terminal) terminal.options.disableStdin = true;
}

async function connect() {
  const id = ++generation;
  release();
  reconnect.disabled = true;
  cad.disabled = paste.disabled = copy.disabled = true;
  setState('Connecting…', 'busy');
  try {
    const res = await fetch(`/api/vms/${vmid}/console`, { method: 'POST', credentials: 'same-origin', cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (id !== generation) return;
    if (!res.ok) return disconnected(data.error || 'Could not open the console', id);
    document.title = `Console – ${data.name || vmid}`;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${proto}://${location.host}/api/console/${data.session}`;
    if (data.type === 'terminal') await connectTerminal(data, url, id);
    else await connectVnc(data, url, id);
  } catch {
    disconnected('Could not connect. Use Reconnect to try again.', id);
  }
}

async function connectTerminal(data, url, id) {
  const [{ Terminal }, { FitAddon }] = await Promise.all([
    import('/vendor/xterm/lib/xterm.mjs'), import('/vendor/xterm-fit/addon-fit.mjs'),
  ]);
  if (id !== generation) return;
  screen.className = 'terminal-screen';
  cad.hidden = true; copy.hidden = false; paste.textContent = 'Paste';
  const term = terminal = new Terminal({
    cursorBlink: true, fontSize: 15, fontFamily: 'Consolas, "Liberation Mono", monospace',
    scrollback: 10000, disableStdin: true, screenReaderMode: true,
    theme: { background: '#111827', foreground: '#e5e7eb', cursor: '#e5e7eb' },
  });
  const fit = new FitAddon(); term.loadAddon(fit); term.open(screen);
  const ws = socket = new WebSocket(url); ws.binaryType = 'arraybuffer';
  let ready = false;
  function send(message) { if (ready && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message)); }
  function resize() {
    if (id !== generation) return;
    fit.fit();
    send({ type: 'resize', cols: Math.min(500, term.cols), rows: Math.min(300, term.rows) });
  }
  term.onResize(({ cols, rows }) => send({ type: 'resize', cols: Math.min(500, cols), rows: Math.min(300, rows) }));
  term.onData((text) => {
    const chars = Array.from(text);
    for (let i = 0; i < chars.length; i += 4096) send({ type: 'input', data: chars.slice(i, i + 4096).join('') });
  });
  term.onBinary((text) => send({ type: 'input', data: text, binary: true }));
  term.onSelectionChange(() => { if (id === generation) copy.disabled = !term.hasSelection(); });
  term.attachCustomKeyEventHandler((event) => {
    if (event.type === 'keydown' && (event.ctrlKey || event.metaKey) && event.shiftKey) {
      if (event.code === 'KeyC') { copySelection(); return false; }
      if (event.code === 'KeyV') { pasteClipboard(); return false; }
    }
    return true;
  });
  ws.onmessage = ({ data: message }) => {
    if (id !== generation) return;
    if (typeof message === 'string') {
      let control;
      try { control = JSON.parse(message); } catch { ws.close(); return; }
      if (control.type !== 'ready') { ws.close(); return; }
      ready = true; term.options.disableStdin = false;
      setState(data.name || `CT ${vmid}`, 'running');
      paste.disabled = !navigator.clipboard?.readText;
      reconnect.disabled = false;
      requestAnimationFrame(() => { if (id === generation) { resize(); term.focus(); } });
    } else term.write(new Uint8Array(message));
  };
  ws.onclose = () => disconnected('Disconnected. Use Reconnect to open the terminal again.', id);
  ws.onerror = () => disconnected('Terminal connection failed. Use Reconnect to try again.', id);
  observer = new ResizeObserver(resize); observer.observe(screen);
}

async function connectVnc(data, url, id) {
  const { default: RFB } = await import('/novnc/core/rfb.js');
  if (id !== generation) return;
  screen.className = ''; cad.hidden = false; copy.hidden = true; paste.textContent = 'Type clipboard';
  const connection = rfb = new RFB(screen, url, { credentials: { password: data.password } });
  connection.scaleViewport = true; connection.resizeSession = false;
  connection.addEventListener('connect', () => {
    if (id !== generation) return;
    setState(data.name || `Server ${vmid}`, 'running');
    cad.disabled = false; paste.disabled = !navigator.clipboard?.readText; reconnect.disabled = false;
    connection.focus();
  });
  connection.addEventListener('disconnect', () => disconnected('Disconnected. Use Reconnect to try again.', id));
  connection.addEventListener('credentialsrequired', () => connection.sendCredentials({ password: data.password }));
}

async function copySelection() {
  if (!terminal?.hasSelection()) return;
  try { await navigator.clipboard.writeText(terminal.getSelection()); }
  catch { setState('Clipboard access was denied. Allow it in your browser.'); }
  terminal?.focus();
}
async function pasteClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    if (terminal) { terminal.paste(text); terminal.focus(); }
    else if (rfb) {
      for (const ch of text.slice(0, 2000)) {
        const cp = ch.codePointAt(0);
        rfb.sendKey(ch === '\n' ? 0xff0d : cp < 0x100 ? cp : 0x01000000 + cp);
      }
      rfb.focus();
    }
  } catch { setState('Clipboard access was denied. Allow it in your browser.'); }
}
cad.addEventListener('click', () => rfb?.sendCtrlAltDel());
paste.addEventListener('click', pasteClipboard);
copy.addEventListener('click', copySelection);
reconnect.addEventListener('click', connect);
document.getElementById('fullscreen').addEventListener('click', () => document.documentElement.requestFullscreen?.());
window.addEventListener('beforeunload', () => { generation++; release(); });
connect();
