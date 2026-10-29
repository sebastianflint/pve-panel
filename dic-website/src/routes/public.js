'use strict';
const express = require('express');
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const { db, LIVE, settings } = require('../db');
const { csrfToken, csrfCheck } = require('../lib/auth');
const U = require('../lib/util');
const mail = require('../lib/mail');
const i18n = require('../i18n');

const router = express.Router();
const NEWS_KEYS = { korporat: 'Korporat', kegiatan: 'Kegiatan', informasi: 'Informasi' };
const PER_PAGE = 9;

// ---- locals umum ----
router.use((req, res, next) => {
  const lang = req.lang || 'id';
  Object.assign(res.locals, i18n.locals(lang));
  const { __ } = res.locals;
  const CAT_NEWS = Object.fromEntries(Object.entries(NEWS_KEYS).map(([k, v]) => [k, __(v)]));
  const st = settings();
  // pengaturan dua bahasa: st.<nama> berisi nilai sesuai bahasa aktif (fallback ke Indonesia)
  const stl = { ...st };
  if (lang === 'en') for (const k of Object.keys(st)) if (k.endsWith('_en') && st[k]) stl[k.slice(0, -3)] = st[k];
  const preview = !!(req.user && req.query.preview);
  const live = (extra = '') => (preview ? `1=1 ${extra}` : `${LIVE} ${extra}`);
  res.locals.st = stl; res.locals.live = live; res.locals.toEn = i18n.toEn; res.locals.preview = preview;
  res.locals.baseUrl = config.baseUrl;
  res.locals.U = U; res.locals.CAT_NEWS = CAT_NEWS; res.locals.NEWS_KEYS = NEWS_KEYS;
  res.locals.navLines = db.prepare(`SELECT slug, title, title_en, category FROM business_lines WHERE ${live()} ORDER BY CASE category WHEN 'utama' THEN 0 ELSE 1 END, sort, id`).all();
  res.locals.footerOffices = db.prepare(`SELECT * FROM offices WHERE ${live()} ORDER BY CASE type WHEN 'pusat' THEN 0 ELSE 1 END, sort, id`).all();
  res.locals.meta = { title: '', description: stl.tagline || '', image: '/img/og-default.jpg', type: 'website', path: req.path, noindex: st.launch_ready !== '1' || preview };
  next();
});
const one = (sql, ...a) => db.prepare(sql).get(...a);
const all = (sql, ...a) => db.prepare(sql).all(...a);
const likeEsc = (s) => '%' + s.replace(/[\\%_]/g, (c) => '\\' + c) + '%';

router.get('/', (req, res) => {
  const L = res.locals.live;
  res.render('public/home', {
    slides: all(`SELECT * FROM hero_slides WHERE ${L()} ORDER BY sort, id`),
    highlights: all(`SELECT * FROM highlights WHERE ${L()} ORDER BY sort, id`),
    lines: all(`SELECT * FROM business_lines WHERE ${L("AND category='utama'")} ORDER BY sort, id`),
    projects: all(`SELECT * FROM projects WHERE ${L('AND featured=1')} ORDER BY sort, id DESC LIMIT 3`),
    posts: all(`SELECT * FROM posts WHERE ${L()} ORDER BY published_at DESC, id DESC LIMIT 3`),
    doc: one(`SELECT * FROM documents WHERE ${L('AND gated=0')} ORDER BY id DESC LIMIT 1`),
    sectors: U.lines(res.locals.st.sectors),
    meta: { ...res.locals.meta, title: '', description: res.locals.st.tagline },
  });
});

router.get('/tentang', (req, res) => {
  const L = res.locals.live;
  res.render('public/about', {
    roadmap: all(`SELECT * FROM roadmap WHERE ${L()} ORDER BY year, id`),
    projects: all(`SELECT * FROM projects WHERE ${L()} ORDER BY sort, id DESC`),
    misi: U.lines(res.locals.st.misi),
    meta: { ...res.locals.meta, title: res.locals.__('Tentang Kami'), description: U.excerpt(res.locals.st.about_intro) },
  });
});

router.get('/lini-bisnis', (req, res) => {
  const L = res.locals.live;
  res.render('public/lines', {
    utama: all(`SELECT * FROM business_lines WHERE ${L("AND category='utama'")} ORDER BY sort, id`),
    tambahan: all(`SELECT * FROM business_lines WHERE ${L("AND category='tambahan'")} ORDER BY sort, id`),
    meta: { ...res.locals.meta, title: res.locals.__('Lini Bisnis'), description: res.locals.__('Lini bisnis PT Dahana Investama Corp: konstruksi, angkutan dan logistik, persewaan dan jasa pendukung, serta perdagangan.') },
  });
});
router.get('/lini-bisnis/:slug', (req, res, next) => {
  const L = res.locals.live;
  const line = one(`SELECT * FROM business_lines WHERE slug=? AND ${L()}`, req.params.slug);
  if (!line) return next();
  res.render('public/line', {
    line, items: U.lines(res.locals.c(line, 'items')),
    others: all(`SELECT slug,title,icon FROM business_lines WHERE ${L('AND id<>?')} ORDER BY sort,id LIMIT 4`, line.id),
    meta: { ...res.locals.meta, title: res.locals.c(line, 'title'), description: res.locals.c(line, 'summary') || U.excerpt(res.locals.c(line, 'body')), image: line.image || '/img/og-default.jpg' },
  });
});

router.get('/berita', (req, res) => {
  const L = res.locals.live;
  const cat = NEWS_KEYS[req.query.kategori] ? req.query.kategori : '';
  const page = Math.max(1, parseInt(req.query.hal, 10) || 1);
  const where = L(cat ? 'AND category=?' : '');
  const args = cat ? [cat] : [];
  const total = one(`SELECT COUNT(*) n FROM posts WHERE ${where}`, ...args).n;
  const posts = all(`SELECT * FROM posts WHERE ${where} ORDER BY published_at DESC, id DESC LIMIT ? OFFSET ?`, ...args, PER_PAGE, (page - 1) * PER_PAGE);
  res.render('public/news', { posts, cat, page, pages: Math.max(1, Math.ceil(total / PER_PAGE)), total, meta: { ...res.locals.meta, title: res.locals.__('Berita'), description: res.locals.__('Berita dan informasi terbaru PT Dahana Investama Corp.') } });
});
router.get('/berita/:slug', (req, res, next) => {
  const L = res.locals.live;
  const post = one(`SELECT * FROM posts WHERE slug=? AND ${L()}`, req.params.slug);
  if (!post) return next();
  res.render('public/post', {
    post, related: all(`SELECT * FROM posts WHERE ${L('AND id<>?')} ORDER BY (category=?) DESC, published_at DESC LIMIT 3`, post.id, post.category),
    meta: { ...res.locals.meta, title: res.locals.c(post, 'title'), description: res.locals.c(post, 'excerpt') || U.excerpt(res.locals.c(post, 'body')), image: post.image || '/img/og-default.jpg', type: 'article', published: post.published_at },
  });
});

router.get('/cari', (req, res) => {
  const L = res.locals.live; const q = U.text(req.query.q).slice(0, 80);
  let posts = [], lines = [], pages = [];
  if (q.length >= 2) {
    const k = likeEsc(q);
    posts = all(`SELECT * FROM posts WHERE ${L("AND (title LIKE ? ESCAPE '\\' OR excerpt LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\' OR title_en LIKE ? ESCAPE '\\' OR excerpt_en LIKE ? ESCAPE '\\' OR body_en LIKE ? ESCAPE '\\')")} ORDER BY published_at DESC LIMIT 30`, k, k, k, k, k, k);
    lines = all(`SELECT * FROM business_lines WHERE ${L("AND (title LIKE ? ESCAPE '\\' OR summary LIKE ? ESCAPE '\\' OR items LIKE ? ESCAPE '\\' OR title_en LIKE ? ESCAPE '\\' OR summary_en LIKE ? ESCAPE '\\' OR items_en LIKE ? ESCAPE '\\')")} LIMIT 20`, k, k, k, k, k, k);
    pages = all(`SELECT * FROM pages WHERE ${L("AND (title LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\' OR title_en LIKE ? ESCAPE '\\' OR body_en LIKE ? ESCAPE '\\')")} LIMIT 10`, k, k, k, k);
  }
  res.render('public/search', { q, posts, lines, pages, meta: { ...res.locals.meta, title: res.locals.__('Pencarian'), noindex: true } });
});

// ---- Kontak ----
const contactLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 6, standardHeaders: true, legacyHeaders: false,
  handler: (req, res) => res.status(429).render('public/error', { title: res.locals.__('Terlalu banyak permintaan'), message: res.locals.__('Anda telah mengirim terlalu banyak pesan. Silakan coba lagi nanti atau hubungi kami melalui email/telepon.'), code: 429, meta: { ...res.locals.meta, noindex: true } }) });

function renderContact(req, res, extra = {}) {
  const L = res.locals.live;
  req.session.formStart = req.session.formStart || Date.now();
  res.render('public/contact', {
    offices: all(`SELECT * FROM offices WHERE ${L()} ORDER BY CASE type WHEN 'pusat' THEN 0 ELSE 1 END, sort, id`),
    cats: Object.fromEntries(Object.entries(mail.CATEGORIES).map(([k, v]) => [k, res.locals.__(v)])), values: {}, errors: {}, sent: req.query.terkirim === '1', ...extra,
    meta: { ...res.locals.meta, title: res.locals.__('Kontak'), description: res.locals.__('Hubungi PT Dahana Investama Corp untuk kerja sama bisnis dan informasi lini bisnis.') },
  });
}
router.get('/kontak', (req, res) => renderContact(req, res));
router.post('/kontak', contactLimiter, express.urlencoded({ extended: false, limit: '20kb' }), csrfCheck, (req, res) => {
  const b = req.body;
  const { __, u } = res.locals;
  if (b.website) return res.redirect(u('/kontak') + '?terkirim=1'); // honeypot: bot dibuat seolah berhasil
  const v = { name: U.text(b.name).slice(0, 100), org: U.text(b.org).slice(0, 120), email: U.text(b.email).slice(0, 120), phone: U.text(b.phone).slice(0, 30),
    category: mail.CATEGORIES[b.category] ? b.category : '', message: U.text(b.message).slice(0, 4000), consent: b.consent ? 1 : 0 };
  const errors = {};
  if (!v.name) errors.name = __('Nama wajib diisi.');
  if (!v.org) errors.org = __('Instansi wajib diisi.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(v.email)) errors.email = __('Email tidak valid.');
  if (v.phone && !/^[+\d][\d\s\-()]{5,}$/.test(v.phone)) errors.phone = __('Format telepon tidak valid.');
  if (!v.category) errors.category = __('Pilih kategori keperluan.');
  if (v.message.length < 10) errors.message = __('Pesan minimal 10 karakter.');
  if (!v.consent) errors.consent = __('Persetujuan pemrosesan data diperlukan.');
  const started = req.session.formStart || 0;
  if (!started || Date.now() - started < 3000) errors.message = errors.message || __('Formulir terkirim terlalu cepat. Silakan coba lagi.');
  if (Object.keys(errors).length) return renderContact(req, res.status(422), { values: v, errors });
  const info = db.prepare('INSERT INTO submissions(name,org,email,phone,category,message,consent,ip_hash,lang) VALUES(?,?,?,?,?,?,?,?,?)')
    .run(v.name, v.org, v.email, v.phone, v.category, v.message, 1, U.hashIp(req.ip), req.lang || 'id');
  const row = db.prepare('SELECT * FROM submissions WHERE id=?').get(info.lastInsertRowid);
  delete req.session.formStart;
  res.redirect(u('/kontak') + '?terkirim=1');
  // Email dikirim di latar belakang; kegagalan ditandai di CMS agar PIC dapat mengirim ulang
  mail.notifySubmission(row).then((r) => {
    db.prepare('UPDATE submissions SET email_status=?, email_error=? WHERE id=?').run(r.status, r.error || null, row.id);
    return mail.autoresponse(row);
  }).catch((e) => console.error('[mail]', e.message));
});

// ---- Unduhan ----
router.get('/unduhan', (req, res) => {
  const L = res.locals.live;
  res.render('public/downloads', { docs: all(`SELECT * FROM documents WHERE ${L()} ORDER BY id DESC`), meta: { ...res.locals.meta, title: res.locals.__('Unduhan') } });
});
const docOr404 = (req, res) => one(`SELECT * FROM documents WHERE id=? AND ${res.locals.live()}`, req.params.id);
router.get('/unduhan/:id', (req, res, next) => {
  const doc = docOr404(req, res); if (!doc) return next();
  if (!doc.gated) return res.redirect(res.locals.u(`/unduh/${doc.id}`));
  res.render('public/download-gate', { doc, errors: {}, values: {}, meta: { ...res.locals.meta, title: res.locals.c(doc, 'title'), noindex: true } });
});
router.post('/unduhan/:id', express.urlencoded({ extended: false, limit: '10kb' }), csrfCheck, (req, res, next) => {
  const doc = docOr404(req, res); if (!doc) return next();
  const { __ } = res.locals;
  const v = { name: U.text(req.body.name).slice(0, 100), org: U.text(req.body.org).slice(0, 120), email: U.text(req.body.email).slice(0, 120) };
  const errors = {};
  if (!v.name) errors.name = __('Nama wajib diisi.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(v.email)) errors.email = __('Email tidak valid.');
  if (!req.body.consent) errors.consent = __('Persetujuan diperlukan.');
  if (Object.keys(errors).length) return res.status(422).render('public/download-gate', { doc, errors, values: v, meta: { ...res.locals.meta, title: res.locals.c(doc, 'title'), noindex: true } });
  const t = U.token(16);
  db.prepare('INSERT INTO download_requests(document_id,name,org,email,token) VALUES(?,?,?,?,?)').run(doc.id, v.name, v.org, v.email, t);
  res.redirect(res.locals.u(`/unduh/${doc.id}`) + `?t=${t}`);
});
router.get('/unduh/:id', (req, res, next) => {
  const doc = docOr404(req, res); if (!doc || !doc.file) return next();
  if (doc.gated) {
    const ok = one("SELECT 1 FROM download_requests WHERE token=? AND document_id=? AND created_at > datetime('now','-1 day')", String(req.query.t || ''), doc.id);
    if (!ok && !req.user) return res.redirect(res.locals.u(`/unduhan/${doc.id}`));
  }
  const file = path.join(config.uploadDir, path.basename(doc.file));
  if (!fs.existsSync(file)) return next();
  if (!res.locals.preview) db.prepare('UPDATE documents SET downloads=downloads+1 WHERE id=?').run(doc.id);
  res.download(file, U.slug(doc.title) + (req.lang === 'en' ? '-en' : '') + path.extname(file));
});

// ---- Halaman statis ----
router.get('/kebijakan-privasi', (req, res, next) => { req.params.slug = 'kebijakan-privasi'; staticPage(req, res, next); });
router.get('/halaman/:slug', (req, res, next) => staticPage(req, res, next));
function staticPage(req, res, next) {
  const page = one(`SELECT * FROM pages WHERE slug=? AND ${res.locals.live()}`, req.params.slug);
  if (!page) return next();
  res.render('public/page', { page, meta: { ...res.locals.meta, title: res.locals.c(page, 'title'), description: res.locals.c(page, 'meta_description') || res.locals.c(page, 'summary') || U.excerpt(res.locals.c(page, 'body')) } });
}

// ---- SEO ----
router.get('/robots.txt', (req, res) => {
  const ready = settings().launch_ready === '1';
  res.type('text/plain').send(ready ? `User-agent: *\nDisallow: /admin\nDisallow: /cari\nSitemap: ${config.baseUrl}/sitemap.xml\n` : 'User-agent: *\nDisallow: /\n');
});
router.get('/sitemap.xml', (req, res) => {
  const L = res.locals.live; const urls = [['/', 1], ['/tentang', 0.8], ['/lini-bisnis', 0.9], ['/berita', 0.7], ['/kontak', 0.8], ['/unduhan', 0.4]];
  for (const r of all(`SELECT slug FROM business_lines WHERE ${L()}`)) urls.push(['/lini-bisnis/' + r.slug, 0.7]);
  for (const r of all(`SELECT slug,published_at d FROM posts WHERE ${L()}`)) urls.push(['/berita/' + r.slug, 0.6, r.d]);
  for (const r of all(`SELECT slug FROM pages WHERE ${L()}`)) urls.push([r.slug === 'kebijakan-privasi' ? '/kebijakan-privasi' : '/halaman/' + r.slug, 0.3]);
  const link = (l, href) => `<xhtml:link rel="alternate" hreflang="${l}" href="${U.esc(config.baseUrl + href)}"/>`;
  const entry = (loc, p, d, id, en) => `<url><loc>${U.esc(config.baseUrl + loc)}</loc>${link('id', id)}${link('en', en)}${d ? `<lastmod>${U.esc(d)}</lastmod>` : ''}<priority>${p}</priority></url>`;
  const body = urls.flatMap(([u, p, d]) => [entry(u, p, d, u, i18n.toEn(u)), entry(i18n.toEn(u), p, d, u, i18n.toEn(u))]);
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${body.join('\n')}\n</urlset>`);
});

module.exports = router;
