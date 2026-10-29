# Website dan CMS dic.id (PT Dahana Investama Corp)

Website company profile dengan CMS, dibangun di Node.js (Express, EJS, SQLite). Struktur dan alur mengikuti
*Website Assessment dan Requirements v1.0* serta *DIC Company Profile 03b*. Referensi tata letak: pertamina.com
(top bar utilitas, menu dengan submenu, hero carousel, kartu lini bisnis, berita, footer multi-kolom, pencarian).
Warna dan motif mengikuti compro DIC (teal `#4DC2A9`, kuning-oranye `#F9A70D`, hijau tua `#305E3F`, font Inter).

Klasifikasi: **RESTRICTED** (berisi rencana implementasi internal).

## Menjalankan

```bash
cp example.env .env          # isi SESSION_SECRET, SMTP_*, ADMIN_*
npm install
npm run seed                 # membuat admin pertama dan konten awal dari compro (idempotent)
npm start                    # http://localhost:3000, CMS di /admin
npm test                     # tes end-to-end (database sementara)
```

Docker: `docker compose up -d --build` (data di volume `dic-data`). Letakkan Caddy/Nginx HTTPS di depan port 3000 dan set `TRUST_PROXY=1`.
Backup: salin `DB_PATH` (SQLite, gunakan `sqlite3 dic.db ".backup out.db"`) dan folder `UPLOAD_DIR`.

## Sitemap (Assessment A#5)

`/` Beranda, `/tentang` (profil, visi dan misi, roadmap, rekam jejak, kantor), `/lini-bisnis` dan `/lini-bisnis/:slug`,
`/berita` dan `/berita/:slug` (kategori, halaman), `/kontak`, plus `/cari`, `/unduhan`, `/kebijakan-privasi`, `/sitemap.xml`, `/robots.txt`.
Bahasa Indonesia saat launch; English fase berikut (A#16).

## CMS

| Peran | Hak |
|---|---|
| Editor | Membuat dan mengubah konten, mengirim ke review. Tidak dapat menayangkan. Mengubah konten yang sudah tayang mengembalikannya ke antrean review. |
| Reviewer / Publisher | Semua hak Editor, menayangkan, menarik, menghapus, menjadwalkan tayang. |
| Admin | Semua hak di atas, pengaturan situs, pengguna, log aktivitas, pesan masuk. |

Alur: Draft, Menunggu review, Tayang (opsional jadwal tayang WIB). Pratinjau memakai `?preview=1` (khusus pengguna login).
Akses CMS bukan izin publikasi (A#15): persetujuan dicatat DIC melalui email, perubahan status dicatat di Log aktivitas.

Modul: Hero Beranda, Pembeda, Lini Bisnis (label aktif/mitra/rencana), Roadmap (label Terealisasi/Rencana),
Rekam Jejak (tidak dapat ditayangkan tanpa sumber, tanggal as-of, dan pemberi izin, A#19), Kantor, Berita, Dokumen Unduhan
(langsung atau via form), Halaman Statis, Pustaka media, Pesan masuk, Pengaturan, Pengguna, Log aktivitas.

### Form kontak dan data (A#8, A#9, A#10, A#27)
Field: nama, instansi, email, telepon (opsional), kategori, pesan, persetujuan privasi. Disimpan di CMS (akses PIC yang ditandai),
dikirim ke email tujuan (+CC) dan autoresponse ke pengirim. Bila email gagal, status ditandai dan dapat dikirim ulang.
Export CSV, hapus manual, hapus otomatis setelah N bulan (default 12). Perlindungan: CSRF, honeypot, waktu minimum, rate limit.

### Analitik dan SEO (A#28)
Google Analytics dimuat hanya setelah pengunjung menyetujui banner cookie. Event: `cta_hero`, `cta_hubungi_kami`, `click_email`,
`click_whatsapp`, `submit_contact`, `download_*`. Metadata, Open Graph, JSON-LD (Organization, NewsArticle), `sitemap.xml`.
Selama pengaturan **Situs siap tayang** nonaktif, situs mengirim `noindex` dan `robots.txt` melarang semua crawler.

## Konten awal dan status validasi

Konten seed berasal dari compro dan sheet *00 Profil DIC* (seluruhnya masih "Belum divalidasi" oleh DIC).
Butir yang disyaratkan assessment menunggu izin **tidak tayang** (status Menunggu review) sampai disetujui:

| Butir | Alasan | Referensi |
|---|---|---|
| Pembeda "Rekam jejak gudang bahan peledak" dan proyek Gudang Handak 2024 | Detail lokasi dan izin klien | A#19 |
| Roadmap 2025 (badan usaha handak), 2026, 2027 | Izin terbit dan label realisasi/rencana | A#19, A#20 |
| Lini tambahan Pertambangan dan Industri Pengolahan | Status aktif/rencana, wording handak | A#18, A#19 |
| Kantor Cabang Samarinda | Alamat di kompleks perumahan | sheet 00 no. 26 |

Placeholder yang wajib diganti sebelum launch: logo (saat ini dipotong dari PDF compro, minta vektor resmi, A#11),
email resmi `@dic.id` (saat ini Gmail dari compro, A#27), pin peta, foto asli dan izin (A#13), naskah privasi (disetujui Legal, A#29),
dua artikel berita awal (sebaiknya 3-5 artikel dari Humas, A#22). Foto di `public/img` berasal dari compro; foto resepsionis
bermerek pihak ketiga sengaja tidak dipakai (A#21).

## Keamanan

Password bcrypt (min. 12 karakter, wajib ganti saat login pertama), rate limit login, sesi cookie bertanda tangan (`httpOnly`, `sameSite`, `secure`),
CSRF di semua POST, CSP via Helmet, HTML dari editor disaring (sanitize-html), upload dibatasi tipe/ukuran dan nama acak, dokumen "via form"
tidak dapat diakses langsung, CSV dinetralkan dari formula injection, log audit. `SESSION_SECRET` wajib pada production.

## Batasan yang diketahui

- SQLite untuk satu instance; untuk HA/replika pindahkan ke PostgreSQL.
- Tidak ada riwayat revisi per konten (hanya log aktivitas). Editor yang mengubah konten tayang membuatnya offline sampai direview.
- Mesin pencari memakai `LIKE`, cukup untuk volume konten kecil.
- Target Lighthouse (90/85) belum diukur; metode uji disepakati saat UAT (sheet 03).
