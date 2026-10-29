'use strict';
// Sandbox: instance terisolasi dengan database sementara, data demo, akun per peran, dan email ditangkap di memori.
// Tidak menyentuh data produksi. Pakai: npm run sandbox  (http://localhost:3100)
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.SANDBOX = '1';
const dir = process.env.SANDBOX_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'dic-sandbox-'));
fs.mkdirSync(dir, { recursive: true });
process.env.DB_PATH = path.join(dir, 'sandbox.db');
process.env.UPLOAD_DIR = path.join(dir, 'uploads');
process.env.PORT = process.env.PORT || '3100';
process.env.BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT}`;
process.env.NODE_ENV = 'development';
process.env.ADMIN_EMAIL = 'admin@sandbox.local';
process.env.ADMIN_PASSWORD = 'Sandbox-Admin-123!';

const bcrypt = require('bcryptjs');
const config = require('./config');
const { db, setSetting } = require('./db');
require('./seed')();

const CREDS = [
  ['admin@sandbox.local', 'Sandbox-Admin-123!', 'admin', 'Admin Sandbox', 1],
  ['reviewer@sandbox.local', 'Sandbox-Reviewer-123!', 'reviewer', 'Reviewer Sandbox', 0],
  ['editor@sandbox.local', 'Sandbox-Editor-123!', 'editor', 'Editor Sandbox', 0],
];
for (const [email, pw, role, name, subs] of CREDS) {
  const u = db.prepare('SELECT id FROM users WHERE email=?').get(email);
  if (u) db.prepare('UPDATE users SET password_hash=?, must_change=0 WHERE id=?').run(bcrypt.hashSync(pw, 4), u.id);
  else db.prepare('INSERT INTO users(name,email,password_hash,role,can_submissions,must_change) VALUES(?,?,?,?,?,0)').run(name, email, bcrypt.hashSync(pw, 4), role, subs);
}

// Semua konten seed ditayangkan agar seluruh layout dapat disimulasikan (di produksi butir ini menunggu izin DIC)
for (const t of ['hero_slides', 'highlights', 'business_lines', 'roadmap', 'projects', 'offices', 'posts', 'documents', 'pages']) db.prepare(`UPDATE ${t} SET status='published' WHERE status<>'published'`).run();
db.prepare("UPDATE projects SET approved_by='SANDBOX (data demo)', as_of='2026-10-01' WHERE approved_by IS NULL OR approved_by=''").run();
if (process.env.SANDBOX_INDEXABLE === '1') setSetting('launch_ready', '1'); // hanya untuk audit Lighthouse/SEO lokal
setSetting('notify_to', 'pic@sandbox.local'); setSetting('map_embed_url', '');

if (db.prepare("SELECT COUNT(*) n FROM posts WHERE slug LIKE 'contoh-%'").get().n === 0) {
  const P = (slug, title, title_en, cat, img, d) => db.prepare("INSERT INTO posts(slug,title,title_en,category,published_at,status,excerpt,excerpt_en,body,body_en,image,photo_credit) VALUES(?,?,?,?,?,'published',?,?,?,?,?,?)")
    .run(slug, title, title_en, cat, d, 'Artikel contoh untuk simulasi tata letak berita.', 'Sample article to simulate the news layout.', '<p>Ini adalah artikel contoh untuk sandbox. Ganti dengan berita resmi dari Humas DIC.</p>', '<p>This is a sample article for the sandbox. Replace it with official news from DIC Corporate Communication.</p>', img, 'Dokumentasi DIC');
  P('contoh-kegiatan-lapangan', 'Contoh: Kegiatan Lapangan Tim DIC', 'Sample: DIC Field Team Activity', 'kegiatan', '/img/bongkar-muat.jpg', '2026-10-20');
  P('contoh-informasi-layanan', 'Contoh: Informasi Layanan Rental & Support', 'Sample: Rental & Support Service Information', 'informasi', '/img/alat-berat.jpg', '2026-10-12');
  P('contoh-berita-korporat', 'Contoh: Berita Korporat DIC', 'Sample: DIC Corporate News', 'korporat', '/img/lini-bisnis.jpg', '2026-10-05');
}
const pdf = db.prepare('SELECT file FROM documents WHERE id=1').get();
if (pdf && !db.prepare("SELECT 1 FROM documents WHERE title LIKE 'Press Kit%'").get()) {
  db.prepare("INSERT INTO documents(title,title_en,description,description_en,file,version,lang,gated,status) VALUES('Press Kit DIC (contoh, via form)','DIC Press Kit (sample, via form)','Contoh dokumen yang diunduh melalui form.','Sample document downloaded through a form.',?, 'demo', 'id', 1, 'published')").run(pdf.file);
}
if (db.prepare('SELECT COUNT(*) n FROM submissions').get().n === 0) {
  const S = (n, o, e, c, m, l) => db.prepare("INSERT INTO submissions(name,org,email,category,message,consent,email_status,lang) VALUES(?,?,?,?,?,1,'sent',?)").run(n, o, e, c, m, l);
  S('Budi Santoso', 'PT Contoh Tambang', 'budi@contoh.example', 'kerja_sama', 'Kami membutuhkan layanan Transportation dan Loading & Hauling untuk site di Kalimantan Timur.', 'id');
  S('Jane Miller', 'Sample Mining Ltd', 'jane@sample.example', 'info_lini', 'Could you share details on your Rental & Support services for mining equipment?', 'en');
}

if (require.main === module) {
  const { app } = require('./server');
  app.listen(config.port, () => {
    console.log(`\nDIC SANDBOX berjalan di ${config.baseUrl}  (data: ${dir})\n`);
    console.log('Akun (CMS di /admin):');
    for (const [e, p, r] of CREDS) console.log(`  ${r.padEnd(9)} ${e}  /  ${p}`);
    console.log('\nEmail form ditangkap di /admin/outbox. Tekan Ctrl+C untuk berhenti.\n');
  });
}
module.exports = { dir, CREDS };
