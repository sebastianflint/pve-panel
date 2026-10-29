'use strict';
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('./config');

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
fs.mkdirSync(config.uploadDir, { recursive: true });

const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Kolom workflow bersama: status (draft|review|published), publish_at (jadwal tayang)
const WF = `status TEXT NOT NULL DEFAULT 'draft',
  publish_at TEXT,
  updated_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))`;

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'editor',
  can_submissions INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1,
  must_change INTEGER NOT NULL DEFAULT 0, session_version INTEGER NOT NULL DEFAULT 1,
  last_login TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS pages (
  id INTEGER PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, summary TEXT, body TEXT,
  meta_description TEXT, ${WF});
CREATE TABLE IF NOT EXISTS hero_slides (
  id INTEGER PRIMARY KEY, title TEXT NOT NULL, subtitle TEXT, image TEXT, cta_label TEXT, cta_url TEXT,
  sort INTEGER NOT NULL DEFAULT 0, ${WF});
CREATE TABLE IF NOT EXISTS highlights (
  id INTEGER PRIMARY KEY, title TEXT NOT NULL, body TEXT, icon TEXT, sort INTEGER NOT NULL DEFAULT 0, ${WF});
CREATE TABLE IF NOT EXISTS business_lines (
  id INTEGER PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'utama',
  summary TEXT, items TEXT, body TEXT, icon TEXT, image TEXT, realisasi TEXT NOT NULL DEFAULT 'aktif',
  sort INTEGER NOT NULL DEFAULT 0, ${WF});
CREATE TABLE IF NOT EXISTS roadmap (
  id INTEGER PRIMARY KEY, year INTEGER NOT NULL, title TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'realisasi',
  note TEXT, ${WF});
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, service TEXT, period TEXT,
  location_public TEXT, summary TEXT, image TEXT, as_of TEXT, source TEXT, approved_by TEXT,
  featured INTEGER NOT NULL DEFAULT 0, sort INTEGER NOT NULL DEFAULT 0, ${WF});
CREATE TABLE IF NOT EXISTS offices (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'cabang', address TEXT,
  phone TEXT, email TEXT, map_url TEXT, sort INTEGER NOT NULL DEFAULT 0, ${WF});
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, excerpt TEXT, body TEXT,
  category TEXT NOT NULL DEFAULT 'korporat', image TEXT, caption TEXT, photo_credit TEXT,
  published_at TEXT, author_id INTEGER, ${WF});
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY, title TEXT NOT NULL, description TEXT, file TEXT, version TEXT, lang TEXT DEFAULT 'id',
  effective_date TEXT, gated INTEGER NOT NULL DEFAULT 0, downloads INTEGER NOT NULL DEFAULT 0, ${WF});
CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, org TEXT, email TEXT NOT NULL, phone TEXT,
  category TEXT NOT NULL, message TEXT NOT NULL, consent INTEGER NOT NULL DEFAULT 0,
  email_status TEXT NOT NULL DEFAULT 'pending', email_error TEXT,
  handled INTEGER NOT NULL DEFAULT 0, note TEXT, ip_hash TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS download_requests (
  id INTEGER PRIMARY KEY, document_id INTEGER NOT NULL, name TEXT, org TEXT, email TEXT, token TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY, filename TEXT NOT NULL, original TEXT, mime TEXT, size INTEGER, alt TEXT,
  uploaded_by INTEGER, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY, user_id INTEGER, user_name TEXT, action TEXT NOT NULL, entity TEXT, entity_id INTEGER,
  detail TEXT, ip TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS idx_posts_pub ON posts(status, published_at);
CREATE INDEX IF NOT EXISTS idx_sub_created ON submissions(created_at);
`);

// Migrasi ringan: kolom English (<nama>_en) untuk konten CMS dan kolom lang pada submissions
(function migrate() {
  const { resources } = require('./resources');
  const has = (t, c) => db.prepare(`PRAGMA table_info(${t})`).all().some((x) => x.name === c);
  for (const r of Object.values(resources)) for (const f of r.trFields || []) if (!has(r.table, f + '_en')) db.exec(`ALTER TABLE ${r.table} ADD COLUMN ${f}_en TEXT`);
  if (!has('submissions', 'lang')) db.exec("ALTER TABLE submissions ADD COLUMN lang TEXT NOT NULL DEFAULT 'id'");
})();

// Kondisi tayang publik: status published dan jadwal sudah lewat
const LIVE = `status = 'published' AND (publish_at IS NULL OR publish_at <= datetime('now'))`;

const settingsCache = { at: 0, data: {} };
function settings() {
  if (Date.now() - settingsCache.at > 2000) {
    const o = {};
    for (const r of db.prepare('SELECT key, value FROM settings').all()) o[r.key] = r.value;
    settingsCache.data = o; settingsCache.at = Date.now();
  }
  return settingsCache.data;
}
function setSetting(key, value) {
  db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, value ?? '');
  settingsCache.at = 0;
}

function audit(user, action, entity, entityId, detail, ip) {
  db.prepare('INSERT INTO audit_log(user_id,user_name,action,entity,entity_id,detail,ip) VALUES(?,?,?,?,?,?,?)')
    .run(user ? user.id : null, user ? user.name : null, action, entity || null, entityId || null, detail || null, ip || null);
}

module.exports = { db, LIVE, settings, setSetting, audit };
