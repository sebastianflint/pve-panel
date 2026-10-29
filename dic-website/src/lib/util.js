'use strict';
const crypto = require('crypto');
const sanitizeHtml = require('sanitize-html');
const slugify = require('slugify');

const RICH = {
  allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote', 'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr'],
  allowedAttributes: { a: ['href', 'title', 'target', 'rel'] },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  transformTags: { a: (tag, attribs) => ({ tagName: 'a', attribs: { ...attribs, rel: 'noopener noreferrer' } }) },
};
const clean = (html) => sanitizeHtml(html || '', RICH);
// Teks polos: tag dibuang, entitas dikembalikan; output selalu di-escape oleh EJS (<%= %>)
const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const text = (s) => decode(sanitizeHtml(String(s ?? ''), { allowedTags: [], allowedAttributes: {} })).trim();
const slug = (s) => slugify(String(s || ''), { lower: true, strict: true, locale: 'id' }).slice(0, 90) || 'item';
const token = (n = 24) => crypto.randomBytes(n).toString('hex');
const hashIp = (ip) => crypto.createHash('sha256').update(String(ip) + '|dic-salt').digest('hex').slice(0, 24);

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
function dateId(v) {
  if (!v) return '';
  const d = new Date(String(v).includes('T') || String(v).includes(' ') ? String(v).replace(' ', 'T') + (String(v).endsWith('Z') ? '' : 'Z') : v + 'T00:00:00Z');
  if (isNaN(d)) return String(v);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
const stripTags = (h) => sanitizeHtml(h || '', { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, ' ').trim();
const excerpt = (h, n = 160) => { const t = stripTags(h); return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t; };
const lines = (s) => String(s || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
const safeUrl = (u) => (/^(https?:\/\/|\/(?!\/))/i.test(u || '') ? u : '');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// datetime-local (WIB, UTC+7) <-> UTC string di database
function wibToUtc(v) { if (!v) return null; const d = new Date(v + ':00+07:00'); return isNaN(d) ? null : d.toISOString().slice(0, 19).replace('T', ' '); }
function utcToWib(v) { if (!v) return ''; const d = new Date(v.replace(' ', 'T') + 'Z'); return isNaN(d) ? '' : new Date(d.getTime() + 7 * 3600e3).toISOString().slice(0, 16); }
module.exports = { clean, text, slug, token, hashIp, dateId, excerpt, stripTags, lines, safeUrl, esc, wibToUtc, utcToWib };
