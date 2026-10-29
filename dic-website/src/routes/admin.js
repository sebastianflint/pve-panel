'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const { db, settings, setSetting, audit } = require('../db');
const { resources, STATUS } = require('../resources');
const settingsDef = require('../settingsDef');
const { upload, isImage } = require('../lib/upload');
const { ROLES, requireLogin, requireRole, can, csrfToken, csrfCheck } = require('../lib/auth');
const U = require('../lib/util');
const mail = require('../lib/mail');

const router = express.Router();
const ip = (req) => req.ip;

router.use((req, res, next) => {
  res.locals.csrf = csrfToken(req);
  res.locals.ROLES = ROLES; res.locals.STATUS = STATUS; res.locals.resources = resources;
  res.locals.can = (min) => can(req.user, min);
  res.locals.canSubs = !!req.user && (req.user.role === 'admin' || !!req.user.can_submissions);
  res.locals.flash = req.session && req.session.flash; if (req.session) delete req.session.flash;
  res.locals.U = U; res.locals.nav = req.path;
  res.set('Cache-Control', 'no-store');
  next();
});
const flash = (req, type, msg) => { req.session.flash = { type, msg }; };

// Urutan: parse body (urlencoded atau multipart), lalu cek CSRF (token ada di body)
const formParsers = [
  (req, res, next) => (req.is('multipart/form-data') ? next() : express.urlencoded({ extended: false, limit: '1mb' })(req, res, next)),
  (req, res, next) => (req.is('multipart/form-data') ? upload.any()(req, res, (e) => {
    if (e) { flash(req, 'error', e.message); return res.redirect(req.get('referer') || '/admin'); }
    next();
  }) : next()),
  csrfCheck,
];

// ---------- Login ----------
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false,
  handler: (req, res) => res.status(429).render('admin/login', { title: 'Masuk', error: 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.' }) });

router.get('/login', (req, res) => {
  if (req.user) return res.redirect('/admin');
  res.render('admin/login', { title: 'Masuk', error: null });
});
router.post('/login', loginLimiter, express.urlencoded({ extended: false }), csrfCheck, (req, res) => {
  const email = String(req.body.email || '').trim();
  const u = db.prepare('SELECT * FROM users WHERE email=? AND active=1').get(email);
  const ok = u && bcrypt.compareSync(String(req.body.password || ''), u.password_hash);
  if (!ok) {
    audit(null, 'login_gagal', 'user', null, email.slice(0, 80), ip(req));
    return res.status(401).render('admin/login', { title: 'Masuk', error: 'Email atau password salah.' });
  }
  req.session = { uid: u.id, sv: u.session_version, csrf: csrfToken(req) }; // sesi baru
  db.prepare("UPDATE users SET last_login=datetime('now') WHERE id=?").run(u.id);
  audit(u, 'login', 'user', u.id, null, ip(req));
  res.redirect(u.must_change ? '/admin/akun?wajib=1' : '/admin');
});
router.post('/logout', formParsers, (req, res) => {
  audit(req.user, 'logout', 'user', req.user && req.user.id, null, ip(req));
  req.session = null; res.redirect('/admin/login');
});

router.use(requireLogin);

// ---------- Dashboard ----------
router.get('/', (req, res) => {
  const pending = [];
  for (const [key, r] of Object.entries(resources)) {
    for (const row of db.prepare(`SELECT id, ${r.cols[0][0]} AS t, updated_at FROM ${r.table} WHERE status='review' ORDER BY updated_at DESC LIMIT 20`).all())
      pending.push({ key, label: r.label, ...row });
  }
  const st = settings();
  const subs = res.locals.canSubs ? {
    unhandled: db.prepare('SELECT COUNT(*) n FROM submissions WHERE handled=0').get().n,
    failed: db.prepare("SELECT COUNT(*) n FROM submissions WHERE email_status IN ('failed','not_configured')").get().n,
  } : null;
  const checklist = [
    ['Email SMTP dikonfigurasi', mail.configured()],
    ['Email tujuan inquiry diisi', !!st.notify_to],
    ['Situs ditandai siap tayang', st.launch_ready === '1'],
    ['Google Analytics diatur (opsional)', !!st.ga_id],
    ['Password admin awal sudah diganti', !req.user.must_change],
  ];
  res.render('admin/dashboard', { title: 'Dashboard', pending, subs, checklist, launchReady: st.launch_ready === '1' });
});

// ---------- Akun ----------
router.get('/akun', (req, res) => res.render('admin/account', { title: 'Akun saya', forced: !!req.query.wajib }));
router.post('/akun', formParsers, (req, res) => {
  const { name, current, password, password2 } = req.body;
  if (name) db.prepare('UPDATE users SET name=? WHERE id=?').run(U.text(name).slice(0, 80), req.user.id);
  if (password) {
    if (!bcrypt.compareSync(String(current || ''), req.user.password_hash)) { flash(req, 'error', 'Password saat ini salah.'); return res.redirect('/admin/akun'); }
    if (password !== password2) { flash(req, 'error', 'Konfirmasi password tidak sama.'); return res.redirect('/admin/akun'); }
    if (String(password).length < 12) { flash(req, 'error', 'Password minimal 12 karakter.'); return res.redirect('/admin/akun'); }
    db.prepare('UPDATE users SET password_hash=?, must_change=0, session_version=session_version+1 WHERE id=?').run(bcrypt.hashSync(password, 12), req.user.id);
    audit(req.user, 'ganti_password', 'user', req.user.id, null, ip(req));
    req.session.sv = db.prepare('SELECT session_version v FROM users WHERE id=?').get(req.user.id).v;
  }
  flash(req, 'ok', 'Akun diperbarui.'); res.redirect('/admin');
});

// ---------- CRUD generik ----------
function getRes(req, res, next) {
  const r = resources[req.params.res];
  if (!r) return res.status(404).render('admin/error', { title: 'Tidak ditemukan', message: 'Modul tidak ada.' });
  req.r = r; res.locals.r = r; res.locals.rkey = req.params.res; next();
}
const nowUtc = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const isLive = (row) => row.status === 'published' && (!row.publish_at || row.publish_at <= nowUtc());
const mediaImages = () => db.prepare('SELECT * FROM media ORDER BY id DESC LIMIT 200').all().filter((m) => isImage(m.filename));
function recordMedia(req, file) {
  db.prepare('INSERT INTO media(filename,original,mime,size,uploaded_by) VALUES(?,?,?,?,?)').run(file.filename, file.originalname.slice(0, 120), file.mimetype, file.size, req.user.id);
}

router.get('/c/:res', getRes, (req, res) => {
  const rows = db.prepare(`SELECT * FROM ${req.r.table} ORDER BY ${req.r.order}`).all();
  res.render('admin/list', { title: req.r.label, rows, isLive });
});
router.get('/c/:res/baru', getRes, (req, res) => {
  const row = {}; for (const f of req.r.fields) if (f.default !== undefined) row[f.name] = f.default;
  if (req.params.res === 'berita') row.published_at = new Date().toISOString().slice(0, 10);
  res.render('admin/form', { title: 'Tambah ' + req.r.singular, row, isNew: true, media: mediaImages() });
});
router.get('/c/:res/:id', getRes, (req, res) => {
  const row = db.prepare(`SELECT * FROM ${req.r.table} WHERE id=?`).get(req.params.id);
  if (!row) return res.status(404).render('admin/error', { title: 'Tidak ditemukan', message: 'Data tidak ada.' });
  res.render('admin/form', { title: 'Ubah ' + req.r.singular, row, isNew: false, media: mediaImages() });
});

function save(req, res) {
  const r = req.r; const isNew = !req.params.id;
  const old = isNew ? null : db.prepare(`SELECT * FROM ${r.table} WHERE id=?`).get(req.params.id);
  if (!isNew && !old) return res.status(404).render('admin/error', { title: 'Tidak ditemukan', message: 'Data tidak ada.' });
  const data = {}; const errors = [];
  const files = {}; for (const f of req.files || []) files[f.fieldname] = f;
  for (const f of r.fields) {
    let v = req.body[f.name];
    if (f.type === 'richtext') v = U.clean(v);
    else if (f.type === 'bool') v = req.body[f.name] ? 1 : 0;
    else if (f.type === 'number') { v = v === '' || v == null ? null : parseInt(v, 10); if (Number.isNaN(v)) v = null; }
    else if (f.type === 'image' || f.type === 'file') {
      v = old ? old[f.name] : null;
      if (files[f.name]) { v = '/uploads/' + files[f.name].filename; recordMedia(req, files[f.name]); }
      else if (req.body[f.name + '__existing']) { const m = db.prepare('SELECT filename FROM media WHERE filename=?').get(req.body[f.name + '__existing']); if (m) v = '/uploads/' + m.filename; }
      else if (req.body['_remove_' + f.name]) v = null;
    } else if (f.type === 'select') {
      v = (f.options.find((o) => o.value === v) || f.options[0]).value;
    } else if (f.type === 'textarea') {
      v = String(v ?? '').replace(/\r\n/g, '\n').trim(); v = U.text(v).replace(/&amp;/g, '&');
    } else v = U.text(v).replace(/&amp;/g, '&');
    if (typeof v === 'string' && f.max) v = v.slice(0, f.max);
    if (f.required && (v === '' || v == null)) errors.push(`${f.label} wajib diisi.`);
    data[f.name] = v;
  }
  const action = ['draft', 'review', 'publish'].includes(req.body.action) ? req.body.action : 'draft';
  let status = action === 'publish' ? 'published' : action;
  const isPub = can(req.user, 'reviewer');
  if (!isPub) { if (status === 'published') status = 'review'; if (old && old.status === 'published') status = 'review'; }
  if (status === 'published' && r.guard) { const g = r.guard(data); if (g) errors.push(g); }
  const publishAt = U.wibToUtc(req.body.publish_at);
  if (errors.length) {
    return res.status(422).render('admin/form', { title: isNew ? 'Tambah ' + r.singular : 'Ubah ' + r.singular, row: { ...(old || {}), ...data, publish_at: publishAt }, isNew, media: mediaImages(), flash: { type: 'error', msg: errors.join(' ') } });
  }
  if (r.slugFrom && (isNew || !old.slug)) {
    const base = U.slug(req.body.slug || data[r.slugFrom]); let s = base, i = 2;
    while (db.prepare(`SELECT 1 FROM ${r.table} WHERE slug=? AND id<>?`).get(s, old ? old.id : 0)) s = base + '-' + i++;
    data.slug = s;
  }
  if (req.params.res === 'berita' && !data.published_at) data.published_at = new Date().toISOString().slice(0, 10);
  const cols = Object.keys(data);
  if (isNew) {
    const info = db.prepare(`INSERT INTO ${r.table}(${cols.join(',')},status,publish_at,updated_by) VALUES(${cols.map(() => '?').join(',')},?,?,?)`).run(...cols.map((c) => data[c]), status, publishAt, req.user.id);
    if (req.params.res === 'berita') db.prepare('UPDATE posts SET author_id=? WHERE id=?').run(req.user.id, info.lastInsertRowid);
    audit(req.user, 'buat', req.params.res, info.lastInsertRowid, data[r.cols[0][0]], ip(req));
    flash(req, 'ok', `Tersimpan (${STATUS[status]}).`);
    return res.redirect(`/admin/c/${req.params.res}/${info.lastInsertRowid}`);
  }
  db.prepare(`UPDATE ${r.table} SET ${cols.map((c) => c + '=?').join(',')}, status=?, publish_at=?, updated_by=?, updated_at=datetime('now') WHERE id=?`).run(...cols.map((c) => data[c]), status, publishAt, req.user.id, old.id);
  audit(req.user, 'ubah', req.params.res, old.id, `${data[r.cols[0][0]]} -> ${status}`, ip(req));
  let msg = `Tersimpan (${STATUS[status]}).`;
  if (!isPub && old.status === 'published') msg = 'Perubahan tersimpan dan menunggu review Reviewer/Publisher sebelum tayang kembali.';
  flash(req, 'ok', msg);
  res.redirect(`/admin/c/${req.params.res}/${old.id}`);
}
router.post('/c/:res/baru', getRes, formParsers, save);
router.post('/c/:res/:id', getRes, formParsers, save);

router.post('/c/:res/:id/status', getRes, formParsers, requireRole('reviewer'), (req, res) => {
  const to = req.body.to;
  const row = db.prepare(`SELECT * FROM ${req.r.table} WHERE id=?`).get(req.params.id);
  if (!STATUS[to] || !row) return res.redirect(`/admin/c/${req.params.res}`);
  if (to === 'published' && req.r.guard) { const g = req.r.guard(row); if (g) { flash(req, 'error', g); return res.redirect(`/admin/c/${req.params.res}`); } }
  db.prepare(`UPDATE ${req.r.table} SET status=?, updated_by=?, updated_at=datetime('now') WHERE id=?`).run(to, req.user.id, row.id);
  audit(req.user, 'status', req.params.res, row.id, `${row.status} -> ${to}`, ip(req));
  flash(req, 'ok', 'Status diubah menjadi ' + STATUS[to] + '.');
  res.redirect(`/admin/c/${req.params.res}`);
});
router.post('/c/:res/:id/hapus', getRes, formParsers, (req, res) => {
  const row = db.prepare(`SELECT * FROM ${req.r.table} WHERE id=?`).get(req.params.id);
  if (row && (can(req.user, 'reviewer') || row.status === 'draft')) {
    db.prepare(`DELETE FROM ${req.r.table} WHERE id=?`).run(row.id);
    audit(req.user, 'hapus', req.params.res, row.id, String(row[req.r.cols[0][0]]), ip(req));
    flash(req, 'ok', 'Data dihapus.');
  } else flash(req, 'error', 'Editor hanya dapat menghapus draft.');
  res.redirect(`/admin/c/${req.params.res}`);
});

// ---------- Pengaturan (Admin) ----------
router.get('/pengaturan', requireRole('admin'), (req, res) => {
  const st = settings(); const groups = {};
  for (const d of settingsDef) (groups[d.group] = groups[d.group] || []).push({ ...d, value: st[d.name] ?? d.default ?? '' });
  res.render('admin/settings', { title: 'Pengaturan situs', groups, logo: st.logo || '/img/logo.png', smtp: mail.configured() });
});
router.post('/pengaturan', requireRole('admin'), formParsers, (req, res) => {
  for (const d of settingsDef) {
    let v = req.body[d.name];
    v = d.type === 'bool' ? (v ? '1' : '0') : U.text(v).replace(/&amp;/g, '&');
    if (d.name === 'map_embed_url' && v && !/^https:\/\/www\.google\.com\/maps\/embed/.test(v)) { flash(req, 'error', 'URL embed peta harus diawali https://www.google.com/maps/embed'); return res.redirect('/admin/pengaturan'); }
    if (d.name === 'ga_id' && v && !/^G-[A-Z0-9]{4,15}$/.test(v)) { flash(req, 'error', 'Format Measurement ID tidak valid (contoh G-ABC123XYZ).'); return res.redirect('/admin/pengaturan'); }
    if (d.name === 'retention_months') v = String(Math.max(1, parseInt(v, 10) || 12));
    setSetting(d.name, v);
  }
  const lf = (req.files || []).find((f) => f.fieldname === 'logo');
  if (lf && isImage(lf.filename)) { recordMedia(req, lf); setSetting('logo', '/uploads/' + lf.filename); }
  audit(req.user, 'ubah', 'pengaturan', null, 'pengaturan situs', ip(req));
  flash(req, 'ok', 'Pengaturan disimpan.'); res.redirect('/admin/pengaturan');
});

// ---------- Pengguna (Admin) ----------
const allUsers = () => db.prepare('SELECT * FROM users ORDER BY id').all();
router.get('/pengguna', requireRole('admin'), (req, res) => res.render('admin/users', { title: 'Pengguna', users: allUsers(), edit: null }));
router.get('/pengguna/:id', requireRole('admin'), (req, res) => res.render('admin/users', { title: 'Pengguna', users: allUsers(), edit: db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id) }));
router.post('/pengguna', requireRole('admin'), formParsers, (req, res) => {
  const b = req.body; const id = parseInt(b.id, 10) || 0;
  const role = ROLES[b.role] ? b.role : 'editor';
  const email = U.text(b.email).toLowerCase(); const name = U.text(b.name).slice(0, 80);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !name) { flash(req, 'error', 'Nama dan email valid wajib diisi.'); return res.redirect('/admin/pengguna'); }
  try {
    if (id) {
      if (id === req.user.id && (role !== 'admin' || !b.active)) { flash(req, 'error', 'Anda tidak dapat menurunkan atau menonaktifkan akun sendiri.'); return res.redirect('/admin/pengguna'); }
      if (b.password && b.password.length < 12) { flash(req, 'error', 'Password minimal 12 karakter.'); return res.redirect('/admin/pengguna/' + id); }
      db.prepare('UPDATE users SET name=?, email=?, role=?, can_submissions=?, active=?, session_version=session_version+1 WHERE id=?').run(name, email, role, b.can_submissions ? 1 : 0, b.active ? 1 : 0, id);
      if (b.password) db.prepare('UPDATE users SET password_hash=?, must_change=1 WHERE id=?').run(bcrypt.hashSync(b.password, 12), id);
      if (id === req.user.id) req.session.sv = db.prepare('SELECT session_version v FROM users WHERE id=?').get(id).v;
      audit(req.user, 'ubah', 'pengguna', id, email, ip(req));
    } else {
      if (!b.password || b.password.length < 12) { flash(req, 'error', 'Password awal minimal 12 karakter.'); return res.redirect('/admin/pengguna'); }
      const info = db.prepare('INSERT INTO users(name,email,password_hash,role,can_submissions,must_change) VALUES(?,?,?,?,?,1)').run(name, email, bcrypt.hashSync(b.password, 12), role, b.can_submissions ? 1 : 0);
      audit(req.user, 'buat', 'pengguna', info.lastInsertRowid, email, ip(req));
    }
    flash(req, 'ok', 'Pengguna disimpan. Pengguna wajib mengganti password saat login pertama.');
  } catch (e) { flash(req, 'error', 'Email sudah terdaftar.'); }
  res.redirect('/admin/pengguna');
});

// ---------- Pesan masuk ----------
const needSubs = (req, res, next) => (res.locals.canSubs ? next() : res.status(403).render('admin/error', { title: 'Akses ditolak', message: 'Akses pesan masuk dibatasi untuk PIC yang ditunjuk (Assessment A#10).' }));
router.get('/pesan', needSubs, (req, res) => {
  const f = req.query.f; const where = f === 'baru' ? 'WHERE handled=0' : f === 'gagal' ? "WHERE email_status IN ('failed','not_configured')" : '';
  res.render('admin/submissions', { title: 'Pesan masuk', rows: db.prepare(`SELECT * FROM submissions ${where} ORDER BY id DESC LIMIT 500`).all(), f: f || '', cats: mail.CATEGORIES, mailOk: mail.configured() });
});
router.get('/pesan/export.csv', needSubs, (req, res) => {
  const q = (v) => '"' + String(v ?? '').replace(/^([=+\-@\t\r])/, "'$1").replace(/"/g, '""') + '"';
  const rows = db.prepare('SELECT * FROM submissions ORDER BY id DESC').all();
  const out = ['ID,Waktu (UTC),Nama,Instansi,Email,Telepon,Keperluan,Pesan,Status email,Ditangani,Catatan'];
  for (const s of rows) out.push([s.id, s.created_at, s.name, s.org, s.email, s.phone, mail.CATEGORIES[s.category] || s.category, s.message, s.email_status, s.handled ? 'Ya' : 'Belum', s.note].map(q).join(','));
  audit(req.user, 'export', 'pesan', null, rows.length + ' baris', ip(req));
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="pesan-dic.csv"' });
  res.send('﻿' + out.join('\r\n'));
});
router.get('/pesan/:id', needSubs, (req, res) => {
  const s = db.prepare('SELECT * FROM submissions WHERE id=?').get(req.params.id);
  if (!s) return res.redirect('/admin/pesan');
  res.render('admin/submission', { title: 'Pesan #' + s.id, s, cats: mail.CATEGORIES });
});
router.post('/pesan/:id', needSubs, formParsers, async (req, res) => {
  const s = db.prepare('SELECT * FROM submissions WHERE id=?').get(req.params.id);
  if (!s) return res.redirect('/admin/pesan');
  const a = req.body.action;
  if (a === 'hapus') { db.prepare('DELETE FROM submissions WHERE id=?').run(s.id); audit(req.user, 'hapus', 'pesan', s.id, null, ip(req)); flash(req, 'ok', 'Pesan dihapus.'); return res.redirect('/admin/pesan'); }
  if (a === 'kirim_ulang') {
    const r = await mail.notifySubmission(s);
    db.prepare('UPDATE submissions SET email_status=?, email_error=? WHERE id=?').run(r.status, r.error || null, s.id);
    flash(req, r.status === 'sent' ? 'ok' : 'error', r.status === 'sent' ? 'Notifikasi terkirim.' : 'Gagal: ' + r.error);
    return res.redirect('/admin/pesan/' + s.id);
  }
  db.prepare('UPDATE submissions SET handled=?, note=? WHERE id=?').run(req.body.handled ? 1 : 0, U.text(req.body.note).slice(0, 1000), s.id);
  audit(req.user, 'ubah', 'pesan', s.id, null, ip(req));
  flash(req, 'ok', 'Disimpan.'); res.redirect('/admin/pesan/' + s.id);
});

// ---------- Media ----------
router.get('/media', (req, res) => res.render('admin/media', { title: 'Pustaka media', items: db.prepare('SELECT * FROM media ORDER BY id DESC LIMIT 300').all(), isImage }));
router.post('/media', formParsers, (req, res) => {
  for (const f of req.files || []) recordMedia(req, f);
  if ((req.files || []).length) { audit(req.user, 'upload', 'media', null, req.files.map((f) => f.originalname).join(', '), ip(req)); flash(req, 'ok', 'File diunggah.'); }
  res.redirect('/admin/media');
});
router.post('/media/:id/alt', formParsers, (req, res) => { db.prepare('UPDATE media SET alt=? WHERE id=?').run(U.text(req.body.alt).slice(0, 200), req.params.id); res.redirect('/admin/media'); });
router.post('/media/:id/hapus', formParsers, requireRole('reviewer'), (req, res) => {
  const m = db.prepare('SELECT * FROM media WHERE id=?').get(req.params.id);
  if (m) {
    db.prepare('DELETE FROM media WHERE id=?').run(m.id);
    fs.rm(path.join(config.uploadDir, path.basename(m.filename)), { force: true }, () => {});
    audit(req.user, 'hapus', 'media', m.id, m.original, ip(req));
  }
  res.redirect('/admin/media');
});

// ---------- Audit ----------
router.get('/audit', requireRole('admin'), (req, res) => res.render('admin/audit', { title: 'Log aktivitas', rows: db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 300').all() }));

module.exports = router;
