'use strict';
const nodemailer = require('nodemailer');
const config = require('../config');
const { settings } = require('../db');
const { esc } = require('./util');
const i18n = require('../i18n');

let transport = null;
// Mode sandbox tanpa SMTP: email ditangkap di memori agar alur form dapat diuji end-to-end
const outbox = [];
const sandboxCapture = () => process.env.SANDBOX === '1' && !config.smtp.host;
const configured = () => !!config.smtp.host;
function getTransport() {
  if (!transport && configured()) {
    transport = nodemailer.createTransport({
      host: config.smtp.host, port: config.smtp.port, secure: config.smtp.secure,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
    });
  }
  return transport;
}

// Mengembalikan { status: 'sent'|'failed'|'not_configured', error }
async function send({ to, cc, replyTo, subject, html, text }) {
  if (sandboxCapture()) { outbox.unshift({ at: new Date().toISOString(), to, cc, subject, text: text || '' }); outbox.length = Math.min(outbox.length, 100); return { status: 'sent' }; }
  const t = getTransport();
  if (!t) return { status: 'not_configured', error: 'SMTP belum dikonfigurasi' };
  if (!to) return { status: 'failed', error: 'Alamat tujuan notifikasi belum diisi di Pengaturan' };
  try {
    await t.sendMail({ from: config.smtp.from, to, cc: cc || undefined, replyTo, subject, html, text });
    return { status: 'sent' };
  } catch (e) {
    return { status: 'failed', error: String(e.message || e).slice(0, 300) };
  }
}

const CATEGORIES = {
  kerja_sama: 'Kerja sama bisnis', info_lini: 'Informasi lini bisnis', media: 'Media / Humas', lainnya: 'Lainnya',
};

async function notifySubmission(s) {
  const st = settings();
  const html = `<h3>Pesan baru dari website dic.id</h3>
<table cellpadding="6" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">
<tr><td><b>Nama</b></td><td>${esc(s.name)}</td></tr><tr><td><b>Instansi</b></td><td>${esc(s.org)}</td></tr>
<tr><td><b>Email</b></td><td>${esc(s.email)}</td></tr><tr><td><b>Telepon</b></td><td>${esc(s.phone || '-')}</td></tr>
<tr><td><b>Keperluan</b></td><td>${esc(CATEGORIES[s.category] || s.category)}</td></tr>
<tr><td valign="top"><b>Pesan</b></td><td>${esc(s.message).replace(/\n/g, '<br>')}</td></tr></table>
<p style="color:#666;font-size:12px">Dikirim ${esc(s.created_at)} UTC. Data juga tersimpan di CMS (Pesan Masuk).</p>`;
  return send({
    to: st.notify_to, cc: st.notify_cc, replyTo: s.email,
    subject: `[Website DIC] ${CATEGORIES[s.category] || s.category} dari ${s.name}`,
    html, text: `${s.name} (${s.org}) <${s.email}>\n${s.message}`,
  });
}

async function autoresponse(s) {
  const st = settings();
  if (st.autoresponse_enabled === '0') return { status: 'skipped' };
  const en = s.lang === 'en';
  const raw = (en && st.autoresponse_body_en) || st.autoresponse_body || 'Terima kasih telah menghubungi kami. Pesan Anda sudah kami terima dan akan ditindaklanjuti.';
  const __ = i18n.locals(s.lang).__;
  return send({
    to: s.email, subject: __('Pesan Anda telah kami terima - PT Dahana Investama Corp'),
    html: `<p>${__('Yth.')} ${esc(s.name)},</p><p>${esc(raw).replace(/\n/g, '<br>')}</p><p>${__('Hormat kami,')}<br>PT Dahana Investama Corp</p>`,
    text: `${__('Yth.')} ${s.name},\n\n${raw}\n\n${__('Hormat kami,')}\nPT Dahana Investama Corp`,
  });
}
module.exports = { outbox, send, configured, notifySubmission, autoresponse, CATEGORIES };
