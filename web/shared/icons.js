// Small hand-drawn icon set (24x24, stroke-based, currentColor) shared by both
// interfaces. Icons are decorative (aria-hidden); buttons carry their own text.

const paths = {
  overview: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  shield: '<path d="M12 3l7 3v5.5c0 4.2-2.9 7.9-7 9-4.1-1.1-7-4.8-7-9V6z"/><path d="M9 12l2 2 4-4"/>',
  server: '<rect x="3.5" y="4" width="17" height="7" rx="2"/><rect x="3.5" y="13" width="17" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  power: '<path d="M12 3v8"/><path d="M6.3 6.8a8 8 0 1 0 11.4 0"/>',
  restart: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  terminal: '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="M7 9.5l3 2.5-3 2.5M12.5 15h4.5"/>',
  camera: '<path d="M4 8.5A2.5 2.5 0 0 1 6.5 6H8l1.5-2h5L16 6h1.5A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z"/><circle cx="12" cy="12.5" r="3.5"/>',
  chart: '<path d="M4 19h16"/><path d="M6 15l4-5 3.5 3L19 6"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5"/>',
  download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
  logout: '<path d="M14 4.5h4.5v15H14"/><path d="M10 8l-4 4 4 4M6 12h9.5"/>',
  back: '<path d="M14.5 6l-6 6 6 6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  users: '<circle cx="9" cy="8.5" r="3.5"/><path d="M3 19.5c.8-3.3 3.2-5 6-5s5.2 1.7 6 5"/><path d="M15.5 5.2a3.5 3.5 0 0 1 0 6.6M17.5 14.8c1.8.6 3 2.2 3.5 4.7"/>',
  layers: '<path d="M12 4l8.5 4.5L12 13 3.5 8.5z"/><path d="M3.5 12.5L12 17l8.5-4.5"/>',
  archive: '<rect x="3.5" y="4" width="17" height="4.5" rx="1.2"/><path d="M5 8.5v10a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5v-10M10 12.5h4"/>',
  folder: '<path d="M3.5 7.5A2 2 0 0 1 5.5 5.5h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
  file: '<path d="M6.5 3.5h7l4 4v13h-11z"/><path d="M13.5 3.5v4h4"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2"/>',
  list: '<path d="M8 6.5h12M8 12h12M8 17.5h12M4 6.5h.01M4 12h.01M4 17.5h.01"/>',
  cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/><path d="M9.5 3v3M14.5 3v3M9.5 18v3M14.5 18v3M3 9.5h3M3 14.5h3M18 9.5h3M18 14.5h3"/>',
  memory: '<rect x="3" y="7" width="18" height="10" rx="1.8"/><path d="M7 10.5v3M10.5 10.5v3M14 10.5v3M17.5 10.5v3M6 17v2.5M18 17v2.5"/>',
  disk: '<ellipse cx="12" cy="6" rx="7.5" ry="2.8"/><path d="M4.5 6v12c0 1.6 3.4 2.8 7.5 2.8s7.5-1.2 7.5-2.8V6M4.5 12c0 1.6 3.4 2.8 7.5 2.8s7.5-1.2 7.5-2.8"/>',
  hash: '<path d="M9.5 4L8 20M16 4l-1.5 16M4.5 9h15M4 15h15"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.4 3.5 5.3 3.5 8.5s-1.1 6.1-3.5 8.5c-2.4-2.4-3.5-5.3-3.5-8.5S9.6 5.9 12 3.5z"/>',
  user: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c1-3.6 3.9-5.5 7.5-5.5s6.5 1.9 7.5 5.5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3.5l1.6 2.3 2.7-.6.6 2.7 2.3 1.6-1.2 2.5 1.2 2.5-2.3 1.6-.6 2.7-2.7-.6L12 20.5l-1.6-2.3-2.7.6-.6-2.7-2.3-1.6L6 12 4.8 9.5l2.3-1.6.6-2.7 2.7.6z"/>',
  check: '<circle cx="12" cy="12" r="8.5"/><path d="M8.3 12.3l2.5 2.5 5-5.3"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8h.01"/>',
  mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="M4 7l8 6 8-6"/>',
  palette: '<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.3-1.1-1.6-1.1-2.7 0-1 .8-1.6 1.8-1.6h2.1a3.9 3.9 0 0 0 3.9-3.9C20.5 6.6 16.7 3.5 12 3.5z"/><path d="M7.5 12h.01M9.5 8h.01M14.5 8h.01"/>',
  pulse: '<path d="M3 12h4l2.5-6 4 12 2.5-6H21"/>',
  network: '<rect x="9" y="3.5" width="6" height="5" rx="1.2"/><rect x="3" y="15.5" width="6" height="5" rx="1.2"/><rect x="15" y="15.5" width="6" height="5" rx="1.2"/><path d="M12 8.5v3.5M6 15.5V12h12v3.5"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  // OS glyphs: neutral shapes, not vendor logos
  linux: '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="M7 10l2.5 2L7 14M11.5 14.5H16"/>',
  windows: '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="M3 9h18M6 6.8h.01M8.5 6.8h.01"/>',
};

export function icon(name, { size = 18, cls = '' } = {}) {
  return `<svg class="icon ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.server}</svg>`;
}

// Own icon files from the branding folder, set by applyBrand(): { windows: url, … }
let customOsIcons = {};
export const customOsIcon = (os) => customOsIcons[os] ?? null;

/** OS glyph for a server: 'windows' | 'linux' | anything else = generic server. */
export function osIcon(os, size = 20) {
  const own = customOsIcon(os);
  if (own) return `<img class="os-glyph os-img" src="${own}" width="${size}" height="${size}" alt="">`;
  return icon(os === 'windows' ? 'windows' : os === 'linux' ? 'linux' : 'server', { size, cls: 'os-glyph' });
}

/** Brand mark: a hub with three connected nodes, the product's network motif. */
export function brandMark(size = 28) {
  return `<svg class="brand-mark" width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true">
    <path d="M16 16L7 8M16 16l10-4M16 16l-3 11" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".55"/>
    <circle cx="16" cy="16" r="5" fill="var(--signal)"/>
    <circle cx="7" cy="8" r="3" fill="currentColor"/>
    <circle cx="26" cy="12" r="3" fill="currentColor"/>
    <circle cx="13" cy="27" r="3" fill="currentColor"/>
  </svg>`;
}

// Color scheme: apply the last known one immediately (no flash of the default
// colors), then whatever the server says. Set by an admin for everyone.
const SCHEME_KEY = 'pve-panel.scheme';
export function applyScheme(id) {
  if (!id) return;
  document.documentElement.dataset.scheme = id;
  try { localStorage.setItem(SCHEME_KEY, id); } catch { /* storage unavailable */ }
}
try { const remembered = localStorage.getItem(SCHEME_KEY); if (remembered) document.documentElement.dataset.scheme = remembered; } catch { /* ignore */ }

/** Fetches the product name and applies it to the page (title + [data-brand]). */
export async function applyBrand(suffix = '') {
  let name = 'PVE Panel';
  try {
    const r = await fetch('/api/brand');
    if (r.ok) {
      const b = await r.json();
      name = b.name || name;
      customOsIcons = b.osIcons ?? {};
      applyScheme(b.scheme);
    }
  } catch { /* keep default */ }
  document.querySelectorAll('[data-brand]').forEach((el) => { el.textContent = name; });
  document.title = suffix ? `${suffix} – ${name}` : name;
  return name;
}
