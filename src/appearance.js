// Color schemes, chosen by an administrator (Settings → Appearance) and applied
// to the admin interface, the customer portal, both sign-in pages and emails.
// Each scheme has a light and a dark variant (the panel follows the device's
// light/dark setting); contrast is at least 4.5:1 for text (WCAG AA).
// The colors themselves live in web/shared/styles.css ([data-scheme="…"]).

import { db } from './db.js';

export const SCHEMES = [
  { id: 'harbor', name: 'Harbor', description: 'Signal blue on slate — the original look', accent: '#3558e6', side: '#172230' },
  { id: 'forest', name: 'Forest', description: 'Calm green on deep pine', accent: '#1d7350', side: '#132a20' },
  { id: 'ember', name: 'Ember', description: 'Warm orange on dark brown', accent: '#b9400f', side: '#2a1c15' },
  { id: 'orchid', name: 'Orchid', description: 'Violet on aubergine', accent: '#7339e0', side: '#221836' },
  { id: 'graphite', name: 'Graphite', description: 'Neutral graphite with teal', accent: '#0d7068', side: '#202427' },
];
export const DEFAULT_SCHEME = 'harbor';
const KEY = 'appearance';

export function currentScheme() {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(KEY);
  const id = row ? JSON.parse(row.value).scheme : null;
  return SCHEMES.some((s) => s.id === id) ? id : DEFAULT_SCHEME;
}

export function setScheme(id) {
  if (!SCHEMES.some((s) => s.id === id)) {
    throw Object.assign(new Error('Unknown color scheme'), { statusCode: 400, expose: true });
  }
  db.prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(KEY, JSON.stringify({ scheme: id }));
  return id;
}

/** Colors for emails (light variant). */
export function schemeColors() {
  const s = SCHEMES.find((x) => x.id === currentScheme());
  return { accent: s.accent, side: s.side };
}
