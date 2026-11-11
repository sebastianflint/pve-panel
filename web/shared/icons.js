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

// Own logo from the branding folder (remembered, so it shows without a flash of the default)
const LOGO_KEY = 'pve-panel.logo';
const LOGO_URL = /^\/branding\/logo\.(svg|png|webp)$/;
let customLogo = null;
try { const l = localStorage.getItem(LOGO_KEY); if (LOGO_URL.test(l ?? '')) customLogo = l; } catch { /* ignore */ }

/** Brand mark: the PVE Panel logo ("PV" with a server and a check). The letter takes
 *  the surrounding text color, so it fits every color scheme, light and dark; an own
 *  logo from the branding folder replaces it. */
const MARK = {
  p: 'M25.8 449.0C12.0 448.8 8.9 448.6 7.4 447.9C4.8 446.7 3.9 445.1 3.9 441.4C3.8 438.1 5.4 433.9 12.3 419.0C18.5 405.6 21.2 399.5 23.3 394.8C24.4 392.0 26.6 387.3 28.0 384.2C29.4 381.2 31.3 377.1 32.2 375.0C33.1 372.9 34.7 369.6 35.6 367.5C36.6 365.4 38.1 362.1 39.0 360.0C39.9 357.9 41.5 354.3 42.6 352.0C45.9 345.2 50.4 335.3 53.5 328.0C55.1 324.3 57.6 318.8 59.0 315.8C60.4 312.7 62.5 308.3 63.5 306.0C67.4 297.2 78.0 273.8 85.2 258.0C86.4 255.4 88.2 251.4 89.3 249.1C91.5 244.3 93.2 242.6 97.2 241.1C99.9 240.0 100.4 240.0 207.3 239.8C320.9 239.6 317.2 239.7 325.1 237.5C326.2 237.2 327.7 236.8 328.7 236.6C329.6 236.3 330.9 235.8 331.5 235.4C332.2 235.0 333.3 234.4 333.9 234.3C337.1 233.3 345.9 226.5 350.0 221.8C353.6 217.8 357.6 211.3 361.4 203.3C371.1 183.5 375.4 173.7 376.7 168.3C377.4 165.8 378.4 162.3 378.9 160.5C383.1 147.3 382.7 129.7 377.7 114.7C370.6 93.2 352.9 79.1 329.0 76.0C322.4 75.2 128.2 75.4 122.5 76.2C107.6 78.5 97.3 82.1 76.0 92.6C66.5 97.2 58.1 101.6 57.2 102.2C55.6 103.5 47.4 108.3 44.2 109.9C43.0 110.5 39.4 113.0 36.1 115.5C27.7 121.8 27.5 121.6 32.0 110.5C35.0 103.2 39.7 90.9 40.5 88.5C41.0 87.0 42.4 83.5 43.6 80.8C44.8 78.0 46.3 74.4 47.0 72.8C47.6 71.1 49.2 67.0 50.5 63.8C51.9 60.5 54.2 54.5 55.8 50.5C57.3 46.5 59.3 41.5 60.2 39.2C61.2 37.0 63.2 32.0 64.8 28.0C70.1 14.4 72.6 10.8 78.8 7.8C84.7 4.9 76.9 5.0 217.5 5.0C356.5 5.0 351.6 4.9 365.2 7.5C380.4 10.3 393.2 15.3 405.3 23.2C416.9 30.8 429.8 43.6 436.7 54.5C438.0 56.6 439.5 58.8 440.0 59.5C441.2 61.3 447.9 76.2 448.5 78.4C448.7 79.4 449.2 81.2 449.5 82.2C449.8 83.3 450.4 85.5 450.7 87.0C451.1 88.5 451.7 90.8 452.0 92.0C452.3 93.2 452.8 95.5 453.0 97.0C453.3 98.5 453.7 101.1 454.0 102.8C455.5 111.7 455.7 124.1 454.5 133.2C451.4 155.7 449.0 162.6 434.1 192.8C431.3 198.5 416.9 226.8 414.8 230.8C413.6 232.9 409.2 241.5 405.0 249.8C395.9 267.7 392.5 273.0 386.2 279.5C375.0 291.1 357.3 299.3 337.2 302.3C327.7 303.7 299.5 304.3 221.8 304.7C187.1 304.9 164.0 305.2 163.5 305.5C162.5 306.0 162.1 306.9 158.0 316.0C156.6 319.2 155.0 322.6 154.5 323.6C153.9 324.6 153.5 325.7 153.5 325.9C153.5 326.2 152.7 328.1 151.8 330.1C149.2 335.6 147.5 339.6 147.5 340.0C147.5 340.2 146.7 342.2 145.7 344.3C144.7 346.5 143.4 349.4 142.7 350.8C142.0 352.3 141.5 353.6 141.5 353.7C141.5 353.9 140.6 355.9 139.6 358.1C138.5 360.4 136.7 364.4 135.5 367.0C134.3 369.6 132.7 373.3 131.8 375.2C130.9 377.2 129.6 380.0 128.9 381.5C128.1 383.0 127.0 385.7 126.3 387.5C125.7 389.3 124.3 392.6 123.3 394.8C122.2 396.9 120.5 400.8 119.5 403.2C114.8 414.3 103.3 438.6 101.4 441.4C100.6 442.6 98.6 444.5 96.9 445.5C92.0 448.7 90.1 448.9 67.0 449.0C55.9 449.0 45.7 449.1 44.5 449.2C43.3 449.3 34.8 449.2 25.8 449.0Z',
  unit: 'M125.4 223.9C120.0 222.7 114.4 218.2 111.7 213.0L110.2 210.2L110.2 195.0L110.2 179.8L111.6 177.0C113.4 173.3 118.1 168.8 121.8 167.2C123.7 166.4 126.2 165.8 129.0 165.5C135.7 164.9 318.0 164.9 322.7 165.5C330.6 166.6 336.2 170.5 339.5 177.2L341.2 180.6L341.4 193.2C341.6 203.8 341.5 206.3 340.8 209.0C338.8 216.7 333.7 221.7 325.6 223.8C323.1 224.4 310.7 224.5 225.0 224.4C171.2 224.4 126.4 224.2 125.4 223.9ZM175.2 152.0L125.2 151.8L121.8 150.1C115.5 146.8 111.0 140.9 110.3 134.8C110.1 133.4 110.2 126.8 110.4 120.2C110.7 110.1 110.9 107.9 111.6 106.8C112.1 106.1 112.5 105.3 112.5 104.9C112.5 103.8 116.0 99.1 117.9 97.7C121.5 94.9 125.4 93.3 128.4 93.4C130.0 93.4 131.7 93.4 132.2 93.3C132.8 93.3 176.6 93.3 229.5 93.3L325.8 93.2L329.6 95.1C334.2 97.3 337.3 100.3 339.3 104.4C340.6 106.9 340.8 108.0 341.1 113.8C341.9 129.7 341.5 136.6 339.4 140.7C337.0 145.6 332.2 149.7 327.2 151.4C324.4 152.3 272.7 152.5 175.2 152.0Z',
  orange: 'M293.2 447.1C285.5 444.9 283.2 442.3 275.5 428.0C269.0 415.8 254.3 388.1 249.5 379.0C246.8 373.9 242.7 366.1 240.3 361.8C237.9 357.4 234.0 350.0 231.7 345.5C229.4 341.0 226.6 335.7 225.5 333.8C220.9 326.0 218.0 319.8 218.6 319.2C219.0 318.6 228.3 318.5 268.8 318.5L318.4 318.5L320.0 320.5C321.4 322.2 323.9 326.9 332.8 344.0C334.5 347.2 338.5 354.7 341.7 360.8C345.0 366.8 348.6 373.8 349.9 376.2C355.0 386.4 357.2 389.5 359.2 388.7C360.1 388.4 362.9 383.4 369.5 370.8C376.8 356.7 378.4 353.6 387.4 336.0C392.2 326.5 398.5 314.1 401.5 308.5C404.5 302.9 408.4 295.1 410.4 291.2C415.7 280.6 430.0 252.5 441.2 230.5C456.0 201.7 466.8 180.6 474.5 165.2C489.3 135.7 491.8 131.9 498.0 128.7C503.6 125.9 503.7 125.9 541.8 125.9C575.9 125.9 576.9 125.9 579.1 126.9C580.4 127.5 581.8 128.5 582.3 129.3C583.5 131.0 583.4 135.0 582.2 137.7C581.3 140.0 571.3 158.8 562.3 175.5C558.9 181.7 554.5 189.9 552.5 193.8C550.5 197.6 548.4 201.7 547.7 202.8C547.1 203.8 545.5 206.9 544.1 209.5C541.1 215.3 538.7 219.7 532.7 230.8C530.2 235.4 524.2 246.8 519.4 256.0C514.6 265.2 508.9 276.0 506.7 280.0C500.9 290.9 487.6 316.1 481.8 327.2C477.1 336.1 470.1 349.3 466.0 357.0C464.0 360.7 459.2 369.8 455.4 377.2C451.5 384.7 448.0 391.3 447.6 392.0C447.2 392.7 444.3 398.1 441.2 404.0C427.8 429.8 425.0 435.0 423.1 437.9C420.8 441.2 417.0 444.4 413.7 445.8C408.5 448.0 409.6 448.0 351.5 448.0C300.5 447.9 296.0 447.9 293.2 447.1ZM265.8 133.5C255.5 133.2 254.6 133.0 251.9 130.2C246.4 124.4 249.3 114.6 257.1 112.5C258.3 112.2 268.7 112.0 286.4 112.1L313.8 112.2L316.1 113.6C318.6 115.1 319.9 117.1 321.0 120.9C322.1 125.2 319.5 130.4 315.2 132.6C312.8 133.7 312.7 133.7 294.0 133.7C283.7 133.7 271.0 133.6 265.8 133.5Z',
  led: 'M256.8 205.7C250.1 204.0 246.9 196.1 250.4 189.8C251.5 187.7 252.3 187.0 254.9 185.6L258.1 184.0L285.2 184.0L312.2 184.0L314.8 185.2C322.9 189.0 323.5 200.3 315.7 204.8L313.4 206.2L286.1 206.2C268.6 206.2 258.1 206.1 256.8 205.7Z',
  dots: 'M142.6 205.1C136.3 202.9 133.4 196.8 136.0 191.0C138.0 186.7 140.9 184.8 145.8 184.9C149.9 184.9 153.6 187.1 155.4 190.8C159.3 198.7 151.1 208.0 142.6 205.1ZM178.6 205.1C174.0 203.5 171.5 200.0 171.5 195.2C171.5 183.9 187.4 180.7 191.7 191.1C194.2 197.0 191.1 203.4 184.9 205.2C181.7 206.2 181.8 206.2 178.6 205.1ZM142.6 132.7C138.6 131.5 135.0 126.9 135.0 123.0C135.0 120.6 137.0 116.5 138.9 114.9C145.0 109.8 154.7 113.6 156.2 121.5C157.0 126.0 153.5 131.4 148.7 132.8C145.9 133.6 145.4 133.6 142.6 132.7ZM178.6 132.6C175.3 131.4 174.2 130.4 172.7 127.2C170.1 121.8 172.2 116.2 177.8 113.5C181.7 111.6 187.8 113.0 190.5 116.3C191.9 118.1 193.1 122.6 192.7 124.3C191.1 131.1 184.9 134.8 178.6 132.6Z',
};
let markId = 0;
export function brandMark(size = 28) {
  if (customLogo) return `<img class="brand-mark brand-logo" src="${customLogo}" height="${size}" alt="">`;
  const id = `bm${markId += 1}`;
  return `<svg class="brand-mark" width="${Math.round(size * 1.2936)}" height="${size}" viewBox="0 0 586 453" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff9a0a"/><stop offset="1" stop-color="#f45f00"/></linearGradient></defs>
    <path class="bm-p" d="${MARK.p}"/><path class="bm-unit" d="${MARK.unit}"/>
    <path fill="url(#${id})" d="${MARK.orange}"/><path fill="#3dd15a" d="${MARK.led}"/><path fill="#f2f5f9" d="${MARK.dots}"/>
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

/** Switches the brand marks on the page (and the browser tab icon) to the own logo, or back. */
function applyLogo(url) {
  const changed = url !== customLogo;
  customLogo = url;
  try { if (url) localStorage.setItem(LOGO_KEY, url); else localStorage.removeItem(LOGO_KEY); } catch { /* ignore */ }
  if (url) document.querySelectorAll('link[rel="icon"]').forEach((l) => { l.href = url; l.removeAttribute('type'); l.removeAttribute('sizes'); });
  if (!changed) return;
  document.querySelectorAll('[data-brand-mark]').forEach((el) => {
    const size = Number(el.firstElementChild?.getAttribute('height'));
    if (size) el.innerHTML = brandMark(size);
  });
}

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
      applyLogo(LOGO_URL.test(b.logo ?? '') ? b.logo : null);
    }
  } catch { /* keep default */ }
  document.querySelectorAll('[data-brand]').forEach((el) => { el.textContent = name; });
  document.title = suffix ? `${suffix} – ${name}` : name;
  return name;
}
