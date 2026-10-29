'use strict';
// Ikon garis (stroke) sederhana, 24x24. Mengikuti gaya ikon garis pada company profile.
const P = {
  clipboard: '<path d="M9 4h6v3H9z"/><path d="M7 5.5H5.5v15h13v-15H17"/><path d="M8.5 12h7M8.5 16h5"/>',
  checklist: '<path d="M4 6l1.5 1.5L8 5M4 12l1.5 1.5L8 11M4 18l1.5 1.5L8 17"/><path d="M11 6.5h9M11 12.5h9M11 18.5h9"/>',
  truck: '<path d="M2.5 6.5h11v9h-11zM13.5 9.5h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
  building: '<path d="M4 20.5h16M6 20.5v-14l7-3v17M13 9.5l5 2v9"/><path d="M9 9h1M9 12.5h1M9 16h1"/>',
  pickaxe: '<path d="M4 8c3-4 11-4 16 0M12 6.5V20.5"/><path d="M9 20.5h6"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8"/>',
  handshake: '<path d="M3 12l4-4 4 1 3-2 4 3 3 2-5 6-3-1-3 2-4-3z"/>',
  shield: '<path d="M12 3l7 3v5.5c0 4.5-3 7.8-7 9.5-4-1.7-7-5-7-9.5V6z"/><path d="M9 12l2.2 2.2L15.5 10"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 12.5l9 5 9-5M3 16.5l9 5 9-5"/>',
  leaf: '<path d="M5 19c0-8 5-14 14-14 0 9-6 14-14 14z"/><path d="M5 19c3-4 6-7 10-9"/>',
  spark: '<path d="M12 3c.8 5 4 8.2 9 9-5 .8-8.2 4-9 9-.8-5-4-8.2-9-9 5-.8 8.2-4 9-9z"/>',
  pin: '<path d="M12 21s7-6 7-11.5A7 7 0 0 0 5 9.5C5 15 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  mail: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3.5 7l8.5 6 8.5-6"/>',
  phone: '<path d="M6 3.5h3l1.5 4-2 1.5a11 11 0 0 0 6.5 6.5l1.5-2 4 1.5v3a2 2 0 0 1-2 2A16 16 0 0 1 4 5.5a2 2 0 0 1 2-2z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  download: '<path d="M12 4v11M7.5 11l4.5 4.5 4.5-4.5M5 20h14"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  whatsapp: '<path d="M4 20l1.2-4.2A8 8 0 1 1 8.3 18.8z"/><path d="M9.5 9c.5 2.5 2.500 4.500 5 5l1-1.200-1.800-1-1 .8c-.9-.4-1.600-1.100-2-2l.8-1-1-1.800z"/>',
};
module.exports = (name, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || P.spark}</svg>`;
