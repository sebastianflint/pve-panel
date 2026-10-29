'use strict';
const express = require('express');
const helmet = require('helmet');
const cookieSession = require('cookie-session');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const { db, settings } = require('./db');
const { loadUser, csrfToken } = require('./lib/auth');
const icon = require('./lib/icons');
const U = require('./lib/util');

if (config.isProd && config.sessionSecret.length < 32) {
  console.error('SESSION_SECRET wajib diisi (min. 32 karakter) pada production.'); process.exit(1);
}

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(config.root, 'views'));
app.set('trust proxy', config.trustProxy ? 1 : false);
app.disable('x-powered-by');

app.use((req, res, next) => {
  const ga = settings().ga_id;
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'script-src': ["'self'", ...(ga ? ['https://www.googletagmanager.com'] : [])],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:', ...(ga ? ['https://www.google-analytics.com', 'https://www.googletagmanager.com'] : [])],
        'connect-src': ["'self'", ...(ga ? ['https://*.google-analytics.com', 'https://*.analytics.google.com'] : [])],
        'frame-src': ['https://www.google.com'],
        'form-action': ["'self'"],
        'upgrade-insecure-requests': config.isProd ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'same-site' },
  })(req, res, next);
});

app.use(cookieSession({
  name: 'dic.sid', keys: [config.sessionSecret || 'dev-only-secret-change-me'],
  httpOnly: true, sameSite: 'lax', secure: config.isProd && config.baseUrl.startsWith('https'), maxAge: 8 * 3600 * 1000,
}));
// cookie-session lama tidak memiliki regenerate/save; sediakan shim agar library lain tidak error
app.use((req, res, next) => {
  if (req.session && !req.session.regenerate) { req.session.regenerate = (cb) => cb(); req.session.save = (cb) => cb && cb(); }
  next();
});
app.use(loadUser);
app.use((req, res, next) => {
  res.locals.icon = icon;
  res.locals.csrfInput = () => `<input type="hidden" name="_csrf" value="${csrfToken(req)}">`;
  res.locals.asset = (p) => p + '?v=' + (app.locals.assetVersion || '1');
  next();
});

const day = config.isProd ? '7d' : 0;
app.use('/css', express.static(path.join(config.root, 'public/css'), { maxAge: day }));
app.use('/js', express.static(path.join(config.root, 'public/js'), { maxAge: day }));
app.use('/img', express.static(path.join(config.root, 'public/img'), { maxAge: '30d' }));
app.use('/vendor/quill', express.static(path.join(config.root, 'node_modules/quill/dist'), { maxAge: '30d' }));
app.use('/vendor/inter', express.static(path.join(config.root, 'node_modules/@fontsource-variable/inter'), { maxAge: '30d' }));

// File unggahan. Dokumen "via form" atau belum tayang tidak dapat diakses langsung oleh publik.
app.get('/uploads/:name', (req, res, next) => {
  const name = path.basename(req.params.name);
  const file = path.join(config.uploadDir, name);
  if (!fs.existsSync(file)) return next();
  if (!req.user) {
    const d = db.prepare("SELECT gated, status, publish_at FROM documents WHERE file=?").get('/uploads/' + name);
    const live = d && d.status === 'published' && (!d.publish_at || d.publish_at <= new Date().toISOString().slice(0, 19).replace('T', ' '));
    if (d && (d.gated || !live)) return next();
  }
  res.set('Cache-Control', 'public, max-age=86400');
  if (!/\.(jpe?g|png|webp|gif)$/i.test(name)) res.set('Content-Disposition', 'attachment');
  res.sendFile(file);
});

app.use('/admin', require('./routes/admin'));
app.use('/', require('./routes/public'));

app.use((req, res) => {
  res.status(404).render('public/error', { title: 'Halaman tidak ditemukan', message: 'Halaman yang Anda cari tidak tersedia atau telah dipindahkan.', code: 404, st: settings(), navLines: [], footerOffices: [], U, meta: { title: 'Tidak ditemukan', description: '', noindex: true, path: req.path, image: '/img/og-default.jpg' }, preview: false, lang: 'id', baseUrl: config.baseUrl });
});
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[error]', err);
  if (res.headersSent) return;
  const admin = req.path.startsWith('/admin');
  res.status(500).render(admin ? 'admin/error' : 'public/error', { title: 'Terjadi kesalahan', message: 'Terjadi kesalahan pada server. Silakan coba lagi.', code: 500, st: settings(), navLines: [], footerOffices: [], U, meta: { title: 'Kesalahan', description: '', noindex: true, path: req.path, image: '/img/og-default.jpg' }, preview: false, lang: 'id', baseUrl: config.baseUrl });
});

// Retensi pesan masuk (Assessment A#10): hapus pesan lebih lama dari masa simpan, dicek tiap jam
function purge() {
  const months = Math.max(1, parseInt(settings().retention_months, 10) || 12);
  const r = db.prepare(`DELETE FROM submissions WHERE created_at < datetime('now', ?)`).run(`-${months} months`);
  db.prepare(`DELETE FROM download_requests WHERE created_at < datetime('now', ?)`).run(`-${months} months`);
  if (r.changes) console.log(`[retensi] ${r.changes} pesan dihapus (> ${months} bulan)`);
}
if (require.main === module) {
  purge(); setInterval(purge, 3600e3).unref();
  app.listen(config.port, () => console.log(`DIC website berjalan di ${config.baseUrl} (port ${config.port})`));
}
module.exports = { app, purge };
