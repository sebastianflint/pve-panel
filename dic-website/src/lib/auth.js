'use strict';
const crypto = require('crypto');
const { db } = require('../db');

const ROLES = { admin: 'Admin', editor: 'Editor', reviewer: 'Reviewer / Publisher' };
const rank = { editor: 1, reviewer: 2, admin: 3 };

function loadUser(req, res, next) {
  req.user = null;
  const s = req.session;
  if (s && s.uid) {
    const u = db.prepare('SELECT * FROM users WHERE id=? AND active=1').get(s.uid);
    if (u && u.session_version === s.sv) req.user = u; else req.session = null;
  }
  res.locals.user = req.user;
  next();
}
const requireLogin = (req, res, next) => {
  if (!req.user) return res.redirect('/admin/login');
  if (req.user.must_change && !req.path.startsWith('/akun') && req.path !== '/logout') return res.redirect('/admin/akun?wajib=1');
  next();
};
const requireRole = (min) => (req, res, next) =>
  (req.user && rank[req.user.role] >= rank[min]) ? next() : res.status(403).render('admin/error', { title: 'Akses ditolak', message: 'Peran Anda tidak memiliki akses ke halaman ini.' });
const can = (user, min) => !!user && rank[user.role] >= rank[min];

// CSRF: token per sesi, diperiksa pada semua POST (termasuk form publik)
function csrfToken(req) {
  if (!req.session) req.session = {};
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString('hex');
  return req.session.csrf;
}
function csrfCheck(req, res, next) {
  const sent = (req.body && req.body._csrf) || req.get('x-csrf-token') || '';
  const real = req.session && req.session.csrf;
  if (!real || sent.length !== real.length || !crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(real))) {
    return res.status(403).render(req.originalUrl.startsWith('/admin') ? 'admin/error' : 'public/error', {
      title: res.locals.__ ? res.locals.__('Sesi tidak valid') : 'Sesi tidak valid', message: res.locals.__ ? res.locals.__('Token keamanan tidak valid atau kedaluwarsa. Muat ulang halaman dan coba lagi.') : 'Token keamanan tidak valid atau kedaluwarsa. Muat ulang halaman dan coba lagi.', code: 403,
    });
  }
  next();
}
module.exports = { ROLES, loadUser, requireLogin, requireRole, can, csrfToken, csrfCheck };
