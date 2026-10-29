'use strict';
// Tes end-to-end dengan database dan folder upload sementara.
const os = require('os');
const fs = require('fs');
const path = require('path');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dic-test-'));
process.env.DB_PATH = path.join(tmp, 'test.db');
process.env.UPLOAD_DIR = path.join(tmp, 'uploads');
process.env.ADMIN_EMAIL = 'admin@test.local';
process.env.ADMIN_PASSWORD = 'password-sementara-123';
process.env.BASE_URL = 'http://127.0.0.1';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
require('../src/seed')();
const { app } = require('../src/server');
const { db } = require('../src/db');

let base; let server;
test.before(async () => { server = http.createServer(app); await new Promise((r) => server.listen(0, '127.0.0.1', r)); base = 'http://127.0.0.1:' + server.address().port; });
test.after(() => { server.closeAllConnections(); server.close(); fs.rmSync(tmp, { recursive: true, force: true }); });

class Client {
  constructor() { this.jar = {}; }
  async req(url, opt = {}) {
    const headers = { ...(opt.headers || {}), cookie: Object.entries(this.jar).map(([k, v]) => `${k}=${v}`).join('; ') };
    const r = await fetch(base + url, { redirect: 'manual', ...opt, headers });
    for (const c of r.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); this.jar[kv.slice(0, i)] = kv.slice(i + 1); }
    return r;
  }
  async text(url, opt) { const r = await this.req(url, opt); return { r, t: await r.text() }; }
  async csrf(url) { const { t } = await this.text(url); return /name="_csrf" value="([a-f0-9]+)"/.exec(t)[1]; }
  async post(url, fields, from) {
    const _csrf = await this.csrf(from || url);
    return this.req(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ _csrf, ...fields }) });
  }
  async login(email, password) {
    const r = await this.post('/admin/login', { email, password }, '/admin/login');
    return r;
  }
}

test('halaman publik hanya menampilkan konten yang tayang', async () => {
  const c = new Client();
  const home = await c.text('/');
  assert.equal(home.r.status, 200);
  assert.match(home.t, /Mitra Pengadaan Barang dan Jasa/);
  assert.match(home.t, /noindex/, 'noindex selama launch_ready=0');
  assert.equal((await c.req('/lini-bisnis/industri-pengolahan')).status, 404, 'lini berstatus review tidak tayang');
  const about = await c.text('/tentang');
  assert.doesNotMatch(about.t, /Drilling Services/, 'roadmap 2026 belum disetujui');
  assert.match(about.t, /Penjajakan Bisnis/);
  assert.match((await c.text('/robots.txt')).t, /Disallow: \//);
});

test('login admin, ganti password wajib, dan CSRF', async () => {
  const c = new Client();
  const bad = await c.req('/admin/login', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'email=a&password=b' });
  assert.equal(bad.status, 403, 'POST tanpa CSRF ditolak');
  const wrong = await c.login('admin@test.local', 'salah');
  assert.equal(wrong.status, 401);
  const ok = await c.login('admin@test.local', 'password-sementara-123');
  assert.equal(ok.status, 302); assert.match(ok.headers.get('location'), /akun\?wajib=1/);
  assert.match(await (await c.req('/admin/c/berita')).headers.get('location'), /akun/);
  const ch = await c.post('/admin/akun', { name: 'Admin', current: 'password-sementara-123', password: 'password-baru-1234', password2: 'password-baru-1234' }, '/admin/akun');
  assert.equal(ch.status, 302);
  assert.equal((await c.req('/admin/c/berita')).status, 200);
});

test('workflow: editor tidak bisa menayangkan, reviewer bisa; jadwal tayang', async () => {
  const admin = new Client();
  await admin.login('admin@test.local', 'password-baru-1234'); // password sudah diganti pada tes sebelumnya
  await admin.post('/admin/pengguna', { name: 'Ed', email: 'ed@test.local', role: 'editor', password: 'editor-password-1', active: '1' }, '/admin/pengguna');
  await admin.post('/admin/pengguna', { name: 'Rev', email: 'rev@test.local', role: 'reviewer', password: 'reviewer-password-1', active: '1' }, '/admin/pengguna');

  const ed = new Client();
  await ed.login('ed@test.local', 'editor-password-1');
  await ed.post('/admin/akun', { name: 'Ed', current: 'editor-password-1', password: 'editor-password-2', password2: 'editor-password-2' }, '/admin/akun');
  const r1 = await ed.post('/admin/c/berita/baru', { title: 'Tes Berita <script>x</script>', category: 'kegiatan', excerpt: 'ringkas', body: '<p>Isi <img src=x onerror=alert(1)></p><script>bad()</script>', action: 'publish' }, '/admin/c/berita/baru');
  assert.equal(r1.status, 302);
  const post = db.prepare("SELECT * FROM posts WHERE slug LIKE 'tes-berita%'").get();
  assert.equal(post.status, 'review', 'editor yang memilih publish tetap masuk review');
  assert.doesNotMatch(post.body, /script|onerror/);
  assert.equal((await ed.req('/berita/' + post.slug)).status, 404);
  assert.equal((await ed.req('/admin/pengaturan')).status, 403);
  assert.equal((await ed.post(`/admin/c/berita/${post.id}/status`, { to: 'published' }, '/admin/c/berita')).status, 403);

  const rev = new Client();
  await rev.login('rev@test.local', 'reviewer-password-1');
  await rev.post('/admin/akun', { name: 'Rev', current: 'reviewer-password-1', password: 'reviewer-password-2', password2: 'reviewer-password-2' }, '/admin/akun');
  await rev.post(`/admin/c/berita/${post.id}/status`, { to: 'published' }, '/admin/c/berita');
  const pub = new Client();
  assert.equal((await pub.req('/berita/' + post.slug)).status, 200);
  // editor mengubah konten tayang: kembali ke review
  await ed.post(`/admin/c/berita/${post.id}`, { title: 'Tes Berita Revisi', category: 'kegiatan', body: '<p>baru</p>', action: 'draft' }, `/admin/c/berita/${post.id}`);
  assert.equal(db.prepare('SELECT status FROM posts WHERE id=?').get(post.id).status, 'review');
  // jadwal tayang di masa depan menyembunyikan konten
  await rev.post(`/admin/c/berita/${post.id}`, { title: 'Terjadwal', category: 'kegiatan', body: '<p>x</p>', action: 'publish', publish_at: '2099-01-01T08:00' }, `/admin/c/berita/${post.id}`);
  assert.equal((await pub.req('/berita/' + post.slug)).status, 404);
  assert.equal((await rev.req(`/berita/${post.slug}?preview=1`)).status, 200, 'pratinjau untuk pengguna login');
  assert.equal((await pub.req(`/berita/${post.slug}?preview=1`)).status, 404, 'pratinjau tidak untuk publik');
  // guard proyek: perlu pemberi izin
  const pr = await rev.post('/admin/c/proyek/baru', { title: 'Proyek X', action: 'publish' }, '/admin/c/proyek/baru');
  assert.equal(pr.status, 422);
});

test('form kontak: validasi, honeypot, simpan, CSV aman, retensi', async () => {
  const c = new Client();
  await c.text('/kontak');
  await new Promise((r) => setTimeout(r, 3100));
  const bad = await c.post('/kontak', { name: '', org: '', email: 'x', category: '', message: 'pendek' }, '/kontak');
  assert.equal(bad.status, 422);
  const good = await c.post('/kontak', { name: '=HYPERLINK("x")', org: 'PT Uji', email: 'uji@example.com', category: 'kerja_sama', message: 'Kami ingin kerja sama logistik.', consent: '1' }, '/kontak');
  assert.equal(good.status, 302);
  const row = db.prepare('SELECT * FROM submissions').get();
  assert.ok(row); assert.equal(row.org, 'PT Uji');
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(db.prepare('SELECT email_status FROM submissions').get().email_status, 'not_configured');
  // honeypot
  const hp = await c.post('/kontak', { website: 'spam', name: 'bot' }, '/kontak');
  assert.equal(hp.status, 302); assert.equal(db.prepare('SELECT COUNT(*) n FROM submissions').get().n, 1);
  // admin export
  const a = new Client();
  await a.login('admin@test.local', 'password-baru-1234');
  const csv = await a.text('/admin/pesan/export.csv');
  assert.match(csv.t, /"'=HYPERLINK/, 'formula injection dinetralkan');
  assert.equal((await new Client().req('/admin/pesan')).status, 302);
  // retensi
  db.prepare("UPDATE submissions SET created_at=datetime('now','-13 months')").run();
  require('../src/server').purge();
  assert.equal(db.prepare('SELECT COUNT(*) n FROM submissions').get().n, 0);
});

test('dokumen: unduhan langsung dan via form', async () => {
  const c = new Client();
  const direct = await c.req('/unduh/1');
  assert.equal(direct.status, 200); assert.match(direct.headers.get('content-type'), /pdf/);
  db.prepare('UPDATE documents SET gated=1 WHERE id=1').run();
  assert.equal((await c.req('/unduh/1')).status, 302, 'tanpa token diarahkan ke form');
  assert.equal((await c.req('/uploads/company-profile-dic.pdf')).status, 404, 'file gated tidak bisa diakses langsung');
  const r = await c.post('/unduhan/1', { name: 'Budi', org: 'X', email: 'b@example.com', consent: '1' }, '/unduhan/1');
  assert.equal(r.status, 302);
  assert.equal((await c.req(r.headers.get('location'))).status, 200);
});

test('bilingual: halaman English, switcher, hreflang, dan form berbahasa English', async () => {
  const c = new Client();
  const en = await c.text('/en');
  assert.equal(en.r.status, 200);
  assert.match(en.t, /<html lang="en">/);
  assert.match(en.t, /A Procurement Partner for Industry/);
  assert.match(en.t, /href="\/en\/business-lines\/konstruksi"/, 'tautan memakai path English');
  assert.match(en.t, /hreflang="id" href="http:\/\/127\.0\.0\.1"/);
  assert.doesNotMatch(en.t, /Hubungi Kami|Tentang Kami|Selengkapnya/, 'tidak ada UI Indonesia di halaman EN');
  const id = await c.text('/');
  assert.match(id.t, /<html lang="id">/);
  assert.match(id.t, /href="\/en" hreflang="en"/, 'switcher ke EN');
  const about = await c.text('/en/about');
  assert.match(about.t, /Business Roadmap/); assert.match(about.t, /Achieved/);
  assert.match(about.t, /href="\/tentang" hreflang="id"/, 'switcher kembali ke path Indonesia');
  const line = await c.text('/en/business-lines/angkutan-logistik');
  assert.match(line.t, /Transportation and Logistics/); assert.match(line.t, /Air: scheduled and non-scheduled/);
  assert.match((await c.text('/en/news/mengenal-pt-dahana-investama-corp')).t, /Get to Know PT Dahana/);
  assert.match((await c.text('/en/search?q=cargo')).t, /Transportation and Logistics/, 'pencarian mencakup konten English');
  assert.match((await c.text('/sitemap.xml')).t, /hreflang="en" href="http:\/\/127\.0\.0\.1\/en\/business-lines\/konstruksi"/);
  const nf = await c.text('/en/nope'); assert.equal(nf.r.status, 404); assert.match(nf.t, /Page not found/);

  // form English: pesan validasi dan kolom lang tersimpan
  await c.text('/en/contact');
  await new Promise((r) => setTimeout(r, 3100));
  const bad = await c.post('/en/contact', { name: '', org: '', email: 'x', category: '', message: 'short' }, '/en/contact');
  assert.equal(bad.status, 422);
  const badHtml = await bad.text(); assert.match(badHtml, /Name is required\./);
  const ok = await c.post('/en/contact', { name: 'Jane', org: 'Acme', email: 'jane@example.com', category: 'info_lini', message: 'We would like to know more about logistics.', consent: '1' }, '/en/contact');
  assert.equal(ok.status, 302); assert.equal(ok.headers.get('location'), '/en/contact?terkirim=1');
  assert.equal(db.prepare("SELECT lang FROM submissions WHERE email='jane@example.com'").get().lang, 'en');
  assert.match((await c.text('/en/contact?terkirim=1')).t, /Message sent\./);
});
