'use strict';
// Simulasi end-to-end di sandbox: menjalankan instance sandbox terisolasi lalu memainkan perjalanan
// pengunjung (ID dan EN), editor, reviewer, dan admin dengan browser sungguhan, termasuk cek keamanan dan aksesibilitas.
// Hasil: <out>/report.md, <out>/report.json, dan screenshot. Exit code 1 bila ada langkah gagal.
//   node scripts/simulate.js [--out sandbox-report] [--port 3199] [--shots-only]
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

let chromium, AxeBuilder;
try { ({ chromium } = require('playwright')); } catch (e) { console.error('Paket playwright belum terpasang: npm ci && npx playwright install chromium'); process.exit(2); }
try { AxeBuilder = require('@axe-core/playwright').AxeBuilder || require('@axe-core/playwright').default; } catch (e) { AxeBuilder = null; }

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > -1 ? process.argv[i + 1] : d; };
const OUT = path.resolve(arg('out', 'sandbox-report'));
const PORT = arg('port', '3199');
const SHOTS_ONLY = process.argv.includes('--shots-only');
const CLEAN = process.argv.includes('--clean'); // tanpa ribbon sandbox, untuk bahan mockup
const BASE = `http://127.0.0.1:${PORT}`;
const C = { admin: ['admin@sandbox.local', 'Sandbox-Admin-123!'], reviewer: ['reviewer@sandbox.local', 'Sandbox-Reviewer-123!'], editor: ['editor@sandbox.local', 'Sandbox-Editor-123!'] };
fs.mkdirSync(path.join(OUT, 'screens'), { recursive: true });

const results = []; const a11y = []; const consoleErrors = [];
const shot = async (page, name, full = true) => page.screenshot({ path: path.join(OUT, 'screens', name + '.png'), fullPage: full });

async function step(group, name, fn) {
  const t = Date.now();
  try { await fn(); results.push({ group, name, ok: true, ms: Date.now() - t }); console.log(`  ok   ${group} :: ${name}`); }
  catch (e) { results.push({ group, name, ok: false, ms: Date.now() - t, error: String(e.message).split('\n')[0] }); console.log(`  FAIL ${group} :: ${name} -> ${String(e.message).split('\n')[0]}`); }
}
const expect = (c, msg) => { if (!c) throw new Error(msg); };

async function waitReady() {
  for (let i = 0; i < 60; i++) { try { const r = await fetch(BASE + '/robots.txt'); if (r.ok) return; } catch (e) { /* belum siap */ } await new Promise((r) => setTimeout(r, 500)); }
  throw new Error('Server sandbox tidak siap');
}
async function login(page, who) {
  await page.goto(BASE + '/admin/login');
  await page.fill('[name=email]', C[who][0]); await page.fill('[name=password]', C[who][1]);
  await Promise.all([page.waitForURL(BASE + '/admin'), page.click('button.primary')]);
}
async function axe(page, path_) {
  if (!AxeBuilder) return;
  await page.goto(BASE + path_, { waitUntil: 'networkidle' });
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  for (const v of r.violations) a11y.push({ path: path_, id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help, target: String(v.nodes[0].target).slice(0, 80) });
}

(async () => {
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'src', 'sandbox.js')], { env: { ...process.env, PORT, BASE_URL: BASE, ...(CLEAN ? { SANDBOX_BANNER: '0' } : {}) }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', () => {}); child.stderr.on('data', (d) => process.stderr.write(d));
  let browser;
  try {
    await waitReady();
    browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
    const ctx = () => browser.newContext({ viewport: { width: 1366, height: 800 }, locale: 'id-ID' });
    const watch = (page) => { page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) consoleErrors.push(`${page.url()} ${m.text()}`); }); page.on('pageerror', (e) => consoleErrors.push(`${page.url()} ${e}`)); };

    console.log('Simulasi sandbox dimulai');
    // ---- Pengunjung Indonesia ----
    let c = await ctx(); let p = await c.newPage(); watch(p);
    for (const [n, u] of [['id-home', '/'], ['id-tentang', '/tentang'], ['id-lini-bisnis', '/lini-bisnis'], ['id-lini-detail', '/lini-bisnis/angkutan-logistik'], ['id-berita', '/berita'], ['id-berita-detail', '/berita/mengenal-pt-dahana-investama-corp'], ['id-kontak', '/kontak'], ['id-unduhan', '/unduhan']]) {
      await step('Pengunjung ID', `buka ${u}`, async () => { const r = await p.goto(BASE + u, { waitUntil: 'networkidle' }); expect(r.status() === 200, `status ${r.status()}`); await shot(p, n); });
    }
    await step('Pengunjung ID', 'pencarian menemukan lini bisnis', async () => {
      await p.goto(BASE + '/'); await p.fill('.search input', 'logistik'); await p.press('.search input', 'Enter'); await p.waitForURL(/cari/);
      expect((await p.textContent('main')).toLowerCase().includes('logistik'), 'hasil tidak memuat kata kunci');
    });
    await step('Pengunjung ID', 'hero carousel berpindah slide', async () => {
      await p.goto(BASE + '/'); await p.click('.dot:nth-child(2)'); await p.waitForTimeout(300);
      expect(await p.locator('.slide.active h1, .slide.active .h1').first().textContent() !== '', 'slide kosong');
    });
    await step('Pengunjung ID', 'kirim form kontak', async () => {
      await p.goto(BASE + '/kontak'); await p.waitForTimeout(3200);
      await p.fill('#c-name', 'Pengunjung Simulasi'); await p.fill('#c-org', 'PT Simulasi'); await p.fill('#c-email', 'sim@contoh.example');
      await p.selectOption('#c-cat', 'kerja_sama'); await p.fill('#c-msg', 'Pesan simulasi dari persona pengunjung Indonesia.'); await p.check('[name=consent]');
      await Promise.all([p.waitForURL(/terkirim=1/), p.click('#contact-form button')]);
      expect(await p.locator('.alert.ok').count() === 1, 'pesan sukses tidak tampil'); await shot(p, 'id-kontak-sukses', false);
    });
    await step('Pengunjung ID', 'unduh Company Profile langsung', async () => {
      const [dl] = await Promise.all([p.waitForEvent('download'), p.goto(BASE + '/unduh/1').catch(() => {})]);
      expect(/pdf$/i.test(dl.suggestedFilename()), 'bukan PDF');
    });
    await step('Pengunjung ID', 'dokumen via form meminta data dulu', async () => {
      await p.goto(BASE + '/unduhan'); const href = await p.locator('a[data-event=download_form]').first().getAttribute('href');
      await p.goto(BASE + href); expect(await p.locator('form input[name=email]').count() === 1, 'form tidak muncul');
    });
    await step('Pengunjung ID', '404 ramah pengguna', async () => { const r = await p.goto(BASE + '/tidak-ada'); expect(r.status() === 404 && (await p.textContent('h1')).includes('tidak ditemukan'), '404 tidak sesuai'); });
    await c.close();

    // ---- Pengunjung English ----
    c = await browser.newContext({ viewport: { width: 1366, height: 800 }, locale: 'en-US' }); p = await c.newPage(); watch(p);
    await step('Pengunjung EN', 'switcher ID ke EN', async () => {
      await p.goto(BASE + '/tentang'); await p.click('.lang a[hreflang=en]'); await p.waitForURL(/\/en\/about/);
      expect((await p.getAttribute('html', 'lang')) === 'en', 'lang bukan en'); await shot(p, 'en-about');
    });
    for (const [n, u] of [['en-home', '/en'], ['en-business-lines', '/en/business-lines'], ['en-news', '/en/news'], ['en-contact', '/en/contact']]) {
      await step('Pengunjung EN', `buka ${u}`, async () => { const r = await p.goto(BASE + u, { waitUntil: 'networkidle' }); expect(r.status() === 200, `status ${r.status()}`); await shot(p, n); });
    }
    await step('Pengunjung EN', 'tidak ada teks UI Indonesia', async () => {
      await p.goto(BASE + '/en'); const t = await p.textContent('body');
      for (const w of ['Hubungi Kami', 'Tentang Kami', 'Selengkapnya', 'Beranda']) expect(!t.includes(w), `ditemukan "${w}"`);
    });
    await step('Pengunjung EN', 'kirim form kontak English', async () => {
      await p.goto(BASE + '/en/contact'); await p.waitForTimeout(3200);
      await p.fill('#c-name', 'Simulation Visitor'); await p.fill('#c-org', 'Simulation Ltd'); await p.fill('#c-email', 'sim-en@example.com');
      await p.selectOption('#c-cat', 'info_lini'); await p.fill('#c-msg', 'Message from the English visitor persona in the sandbox.'); await p.check('[name=consent]');
      await Promise.all([p.waitForURL(/terkirim=1/), p.click('#contact-form button')]);
      expect((await p.textContent('.alert.ok')).includes('Message sent'), 'pesan sukses English tidak tampil');
    });
    await c.close();

    // ---- Mobile ----
    c = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); p = await c.newPage(); watch(p);
    await step('Mobile', 'menu hamburger dan tanpa scroll horizontal', async () => {
      await p.goto(BASE + '/', { waitUntil: 'networkidle' }); await shot(p, 'm-id-home');
      const ov = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); expect(ov <= 1, `overflow horizontal ${ov}px`);
      await p.click('.nav-toggle'); expect(await p.locator('#menu.open').count() === 1, 'menu tidak terbuka'); await shot(p, 'm-id-menu', false);
    });
    await step('Mobile', 'halaman kontak dan English nyaman di ponsel', async () => {
      await p.goto(BASE + '/en/contact', { waitUntil: 'networkidle' }); await shot(p, 'm-en-contact');
      const ov = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); expect(ov <= 1, `overflow horizontal ${ov}px`);
    });
    await c.close();

    // ---- Keamanan ----
    await step('Keamanan', 'CMS tertutup tanpa login', async () => { const r = await fetch(BASE + '/admin', { redirect: 'manual' }); expect(r.status === 302, `status ${r.status}`); });
    await step('Keamanan', 'POST tanpa CSRF ditolak', async () => { const r = await fetch(BASE + '/kontak', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'name=x' }); expect(r.status === 403, `status ${r.status}`); });
    await step('Keamanan', 'header keamanan dan CSP aktif', async () => { const r = await fetch(BASE + '/'); expect(r.headers.get('content-security-policy') && r.headers.get('x-content-type-options') === 'nosniff', 'header kurang'); });
    await step('Keamanan', 'file dokumen via form tidak bisa diakses langsung', async () => {
      const r = await fetch(BASE + '/uploads/company-profile-dic.pdf'); expect(r.status === 200, 'dokumen langsung (non-gated) seharusnya terbuka');
      const gated = await (await fetch(BASE + '/en/downloads')).text(); expect(/data-event="download_form"/.test(gated), 'dokumen via form tidak ditandai');
    });
    await step('Keamanan', 'XSS pada form kontak tidak dieksekusi di CMS', async () => {
      const cx = await ctx(); const pg = await cx.newPage(); let alerted = false; pg.on('dialog', (d) => { alerted = true; d.dismiss(); });
      await pg.goto(BASE + '/kontak'); await pg.waitForTimeout(3200);
      await pg.fill('#c-name', 'Eve "><img src=x onerror=alert(1)>'); await pg.fill('#c-org', 'PT <script>alert(1)</script> Uji'); await pg.fill('#c-email', 'xss@contoh.example');
      await pg.selectOption('#c-cat', 'lainnya'); await pg.fill('#c-msg', '"><svg onload=alert(1)> uji XSS pada pesan'); await pg.check('[name=consent]');
      await Promise.all([pg.waitForURL(/terkirim=1/), pg.click('#contact-form button')]);
      await login(pg, 'admin'); await pg.goto(BASE + '/admin/pesan'); await pg.waitForTimeout(500); await pg.locator('table a').first().click(); await pg.waitForTimeout(500);
      expect(!alerted, 'script dieksekusi'); expect(await pg.locator('main svg[onload], main img[onerror], main script').count() === 0, 'tag berbahaya dirender'); await cx.close();
    });

    // ---- Workflow CMS ----
    const title = 'Berita Simulasi ' + Date.now();
    let slug = '';
    await step('Editor', 'login, buat berita, kirim untuk review (tidak bisa tayang)', async () => {
      const cx = await ctx(); const pg = await cx.newPage(); watch(pg); await login(pg, 'editor'); await shot(pg, 'cms-editor-dashboard', false);
      await pg.goto(BASE + '/admin/c/berita/baru'); await pg.waitForSelector('.ql-editor');
      await pg.fill('[name=title]', title); await pg.fill('[name=title_en]', 'Simulation News'); await pg.click('.ql-editor'); await pg.keyboard.type('Isi berita simulasi dari persona Editor.');
      await shot(pg, 'cms-berita-form');
      expect(await pg.locator('button[value=publish]').count() === 0, 'Editor melihat tombol tayangkan');
      await pg.click('button[value=review]'); await pg.waitForURL(/berita\/\d+/);
      expect((await pg.textContent('.badge')).includes('Menunggu review'), 'status bukan review');
      await pg.goto(BASE + '/admin/pengaturan'); expect((await pg.textContent('body')).includes('Akses ditolak'), 'Editor dapat membuka Pengaturan');
      await cx.close();
    });
    await step('Reviewer', 'berita belum tayang, lalu ditayangkan reviewer', async () => {
      const pub = await (await ctx()).newPage();
      const cx = await ctx(); const pg = await cx.newPage(); watch(pg); await login(pg, 'reviewer'); await shot(pg, 'cms-reviewer-dashboard', false);
      await pg.goto(BASE + '/admin/c/berita'); const row = pg.locator('tr', { hasText: title });
      const href = await row.locator('a').first().getAttribute('href'); expect(!!href, 'berita tidak ada di daftar');
      await Promise.all([pg.waitForURL(/\/admin\/c\/berita$/), row.locator('button:has-text("Tayangkan")').click()]);
      await pg.goto(BASE + '/berita'); expect((await pg.textContent('main')).includes(title), 'berita tidak tayang di situs publik');
      slug = (await pg.locator('a', { hasText: title }).first().getAttribute('href')).split('/').pop(); await shot(pg, 'cms-berita-tayang', false);
      const r = await pub.goto(BASE + '/berita/' + slug); expect(r.status() === 200, 'publik tidak bisa membuka berita');
      const en = await pub.goto(BASE + '/en/news/' + slug); expect(en.status() === 200 && (await pub.textContent('h1')).includes('Simulation News'), 'versi English tidak tampil');
      await cx.close();
    });
    await step('Admin', 'pesan masuk memuat ID dan EN, export CSV, outbox email', async () => {
      const cx = await ctx(); const pg = await cx.newPage(); watch(pg); await login(pg, 'admin');
      await pg.goto(BASE + '/admin/pesan'); const t = await pg.textContent('main');
      expect(t.includes('Pengunjung Simulasi') && t.includes('Simulation Visitor'), 'pesan ID/EN tidak lengkap'); await shot(pg, 'cms-pesan', false);
      const csv = await (await cx.request.get(BASE + '/admin/pesan/export.csv')).text(); expect(csv.includes('Simulation Visitor'), 'CSV tidak memuat pesan');
      await pg.goto(BASE + '/admin/outbox'); const o = await pg.textContent('main');
      expect(o.includes('We have received your message') && o.includes('Pesan Anda telah kami terima'), 'autoresponse dwibahasa tidak ada di outbox'); await shot(pg, 'cms-outbox', false);
      await pg.goto(BASE + '/admin/pengaturan'); await shot(pg, 'cms-pengaturan');
      await pg.goto(BASE + '/admin/audit'); expect((await pg.textContent('main')).includes('login'), 'log audit kosong');
      await cx.close();
    });

    // ---- Aksesibilitas (axe, WCAG 2 A/AA) ----
    if (!SHOTS_ONLY) {
      const cx = await ctx(); const pg = await cx.newPage();
      for (const u of ['/', '/tentang', '/lini-bisnis', '/berita', '/kontak', '/en', '/en/contact']) await step('Aksesibilitas', `axe ${u}`, async () => { await axe(pg, u); });
      await cx.close();
    }
  } catch (e) {
    results.push({ group: 'Sistem', name: 'sandbox', ok: false, ms: 0, error: String(e.message) });
  } finally {
    if (browser) await browser.close();
    child.kill();
  }

  const failed = results.filter((r) => r.ok === false);
  const serious = a11y.filter((v) => ['critical', 'serious'].includes(v.impact));
  const md = [`# Laporan Simulasi Sandbox DIC`, '', `Waktu: ${new Date().toISOString()}`, '', `**Hasil: ${results.length - failed.length}/${results.length} langkah lulus.** Pelanggaran aksesibilitas critical/serious: ${serious.length}. Error console: ${consoleErrors.length}.`, '',
    '| Grup | Langkah | Status | ms |', '|---|---|---|---|', ...results.map((r) => `| ${r.group} | ${r.name} | ${r.ok ? 'LULUS' : 'GAGAL: ' + r.error} | ${r.ms} |`), ''];
  if (a11y.length) md.push('## Temuan aksesibilitas (axe, WCAG 2 A/AA)', '', '| Halaman | Aturan | Dampak | Elemen | Contoh elemen | Keterangan |', '|---|---|---|---|---|---|', ...a11y.map((v) => `| ${v.path} | ${v.id} | ${v.impact} | ${v.nodes} | \`${v.target}\` | ${v.help} |`), '');
  if (consoleErrors.length) md.push('## Error console', '', ...consoleErrors.map((e) => `- ${e}`), '');
  fs.writeFileSync(path.join(OUT, 'report.md'), md.join('\n'));
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ results, a11y, consoleErrors }, null, 2));
  console.log(`\n${results.length - failed.length}/${results.length} langkah lulus. a11y serious/critical: ${serious.length}. console error: ${consoleErrors.length}. Laporan: ${OUT}/report.md`);
  process.exit(failed.length || serious.length || consoleErrors.length ? 1 : 0);
})();
