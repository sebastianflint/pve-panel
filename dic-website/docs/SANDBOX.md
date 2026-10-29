# Sandbox dan Simulasi

Klasifikasi: **RESTRICTED**. Sandbox adalah instance terisolasi untuk mencoba, mensimulasikan, dan menguji website tanpa menyentuh data produksi.

## 1. Apa yang dimaksud sandbox

| Sifat | Keterangan |
|---|---|
| Terisolasi | Database dan uploads di folder sementara, hilang saat dihentikan |
| Data demo | Semua konten seed ditayangkan (termasuk butir yang di produksi menunggu izin DIC), ditambah 3 artikel contoh, dokumen via form, dan 2 pesan masuk |
| Akun per peran | Admin, Reviewer, Editor dengan password demo (di bawah) |
| Email ditangkap | Tanpa SMTP, email notifikasi dan autoresponse tampil di `/admin/outbox` |
| Ditandai | Ribbon "SANDBOX" di atas halaman publik dan `noindex` |

> Kredensial sandbox hanya untuk data demo. Jangan memakai password ini di lingkungan lain.

| Peran | Email | Password |
|---|---|---|
| Admin | `admin@sandbox.local` | `Sandbox-Admin-123!` |
| Reviewer/Publisher | `reviewer@sandbox.local` | `Sandbox-Reviewer-123!` |
| Editor | `editor@sandbox.local` | `Sandbox-Editor-123!` |

## 2. Cara menjalankan

**Lokal (Node.js 22+):**

```bash
npm ci
npm run sandbox          # http://localhost:3100 , CMS di /admin
```

**Docker:**

```bash
docker compose -f docker-compose.sandbox.yml up --build
```

**GitHub Codespaces:** buka repo, pilih *Code, Codespaces, Create codespace*. `.devcontainer` menjalankan `npm ci` dan `npm run sandbox` otomatis, port 3100 diteruskan dan dibuka di browser.

**GitHub Actions:** workflow **Sandbox** (tab Actions, *Run workflow*, atau otomatis pada pull request yang mengubah kode). Hasil: ringkasan di tab Summary, artifact `sandbox-report` (laporan dan screenshot) dan `lighthouse-report`.

## 3. Simulasi otomatis

```bash
npx playwright install chromium
npm run simulate                      # laporan di sandbox-report/report.md
npm run simulate -- --out hasil --port 3200
npm run simulate -- --clean --shots-only   # screenshot tanpa ribbon, untuk mockup
```

Skrip menjalankan sandbox sendiri di port 3199, memainkan skenario dengan browser Chromium, lalu menulis laporan. Exit code 1 bila ada langkah gagal, pelanggaran aksesibilitas critical/serious, atau error console tak terduga.

| Grup | Skenario yang disimulasikan |
|---|---|
| Pengunjung ID | Membuka 8 halaman, pencarian, carousel, kirim form kontak, unduh Company Profile, dokumen via form meminta data, halaman 404 |
| Pengunjung EN | Switcher ID ke EN, 5 halaman English, tidak ada teks UI Indonesia, kirim form English |
| Mobile (390 px) | Menu hamburger, tidak ada scroll horizontal, kontak English |
| Keamanan | CMS tertutup tanpa login, POST tanpa CSRF ditolak, header CSP, XSS pada form tidak dieksekusi di CMS |
| Editor | Membuat berita ID+EN, hanya bisa kirim review, tidak bisa membuka Pengaturan |
| Reviewer | Berita belum tayang lalu ditayangkan, tampil di situs publik ID dan EN |
| Admin | Pesan ID dan EN masuk, export CSV, outbox memuat autoresponse dua bahasa, log audit |
| Aksesibilitas | axe-core (WCAG 2 A/AA) pada 7 halaman |

Tes unit-level end-to-end (`npm test`) berjalan tanpa browser dan lebih cepat; simulasi melengkapinya dengan browser sungguhan.

## 4. Lighthouse

Workflow **Sandbox** menjalankan Lighthouse pada 6 halaman, mobile dan desktop, terhadap sandbox yang diizinkan diindeks (`SANDBOX_INDEXABLE=1`, hanya untuk audit). Ambang lulus: Performance 90 desktop dan 85 mobile (target sheet 03), Accessibility 95, SEO 90.

## 5. Membaca hasil dan menindaklanjuti

1. Buka `report.md`: setiap langkah berstatus LULUS atau GAGAL beserta pesan.
2. Untuk kegagalan UI, lihat screenshot di `screens/` (nama sesuai halaman).
3. Temuan axe memuat halaman, aturan, dampak, dan contoh elemen. Perbaiki sebelum merge.
4. Jalankan ulang simulasi sampai bersih, lalu lanjut ke UAT bersama DIC ([GO-LIVE-CHECKLIST.md](GO-LIVE-CHECKLIST.md)).

## 6. Batasan

Sandbox tidak menguji SMTP sungguhan, DNS/TLS, proxy, backup/restore, dan beban tinggi. Hal tersebut diverifikasi pada staging atau produksi mengikuti [INSTALL.md](INSTALL.md) dan [OPERATIONS.md](OPERATIONS.md).
