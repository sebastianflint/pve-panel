# Go-Live Checklist dic.id

Klasifikasi: **RESTRICTED**. Checklist ini menjembatani hasil Website Assessment v1.0 (sheet 00 sampai 03) dengan kesiapan teknis. Situs tetap `noindex` sampai seluruh butir di bawah disetujui dan pengaturan **Situs siap tayang** diaktifkan.

## 1. Prasyarat dari DIC

| # | Butir | Referensi | PIC | Status |
|---|---|---|---|---|
| 1 | Logo vektor resmi dan versi yang berlaku (teal-hijau-emas atau biru-oranye) | A#11, Aset #1 | Humas | ☐ |
| 2 | Kode warna resmi atau brand guideline (kode saat ini hasil sampling PDF) | A#11, Aset #2 | Humas | ☐ |
| 3 | Company Profile final dan versi yang boleh diunduh | Aset #3 | Humas, Direksi | ☐ |
| 4 | Nama legal, hubungan dengan PT DAHANA, alamat dan lantai kantor pusat, pin peta | A#17 | Corp. Secretary | ☐ |
| 5 | Email resmi @dic.id dan nomor bisnis (bukan pribadi), jam layanan | A#8, A#27 | TI, Humas | ☐ |
| 6 | Foto asli resolusi tinggi dan izin pakai | A#13, Aset #5-6 | Humas | ☐ |
| 7 | 3 sampai 5 artikel berita awal beserta kredit foto | A#22, Aset #10 | Humas | ☐ |
| 8 | Kalimat posisi dan 2 sampai 3 pembeda yang dapat dibuktikan | A#4 | Direksi | ☐ |
| 9 | Privacy notice dan kebijakan cookie disetujui Legal | A#29, Aset #14 | Legal | ☐ |
| 10 | Pemegang domain dan DNS, jadwal cutover | A#26 | TI | ☐ |
| 11 | Terjemahan English ditinjau DIC | A#16 | Humas, Direksi | ☐ |

## 2. Konten yang menunggu validasi dan izin

Butir berikut berstatus **Menunggu review** pada seed dan tidak tayang di produksi. Reviewer menayangkan hanya setelah persetujuan tertulis.

| Butir | Alasan ditahan | Referensi | Syarat tayang |
|---|---|---|---|
| Pembeda "Rekam jejak gudang bahan peledak" | Izin publikasi dan detail lokasi | A#19 | Persetujuan Direksi dan Legal |
| Proyek Gudang Handak 2024 (Musi Rawas, Muara Enim, Musi Banyuasin) | Izin klien, batas detail lokasi | A#19 | Isi Sumber, Tanggal as-of, Pemberi izin (guard CMS) |
| Roadmap 2025 (badan usaha Handak) | Izin badan usaha harus sudah terbit | A#19, A#20 | Bukti izin terbit, label Terealisasi |
| Roadmap 2026 (Drilling Services), 2027 (Loading & Hauling) | Rencana, bukan layanan tersedia | A#20 | Persetujuan Direksi, label Rencana |
| Lini tambahan Pertambangan dan Penggalian | Status aktif atau rencana belum jelas | A#18 | Konfirmasi status, bukti izin |
| Lini tambahan Industri Pengolahan (bahan peledak) | Wording sensitif | A#19 | Persetujuan Direksi dan Legal |
| Kantor Cabang Samarinda | Alamat di kompleks perumahan | sheet 00 no. 26 | Konfirmasi layak tayang publik |
| Klaim izin dan sertifikasi per lini (konstruksi, outsourcing, jasa keamanan, moda laut/udara via mitra) | Butuh bukti | A#18 | Dokumen izin, status "Melalui mitra" bila perlu |

## 3. Kesiapan teknis

| Butir | Verifikasi | Status |
|---|---|---|
| CI hijau (test Node 22, Docker smoke test) | Tab Actions | ☐ |
| Workflow Sandbox lulus (simulasi persona, axe, Lighthouse) | Artifact `sandbox-report` | ☐ |
| HTTPS aktif, redirect HTTP ke HTTPS, HSTS | `curl -sI` | ☐ |
| SMTP berfungsi: notifikasi ke PIC dan autoresponse (ID dan EN) | Uji form, cek Pesan masuk dan inbox | ☐ |
| Password admin awal diganti, akun per peran dibuat | CMS, Pengguna | ☐ |
| Backup harian berjalan dan restore berhasil diuji | `deploy/backup.sh`, `restore.sh` | ☐ |
| Google Analytics dan Search Console diatur dengan pemilik akun DIC (opsional) | Pengaturan situs | ☐ |
| Monitoring ketersediaan aktif | Monitor eksternal | ☐ |

## 4. Hasil Lighthouse (sandbox, 29 Okt 2026)

Lighthouse 13.6.0, Chromium headless, profil mobile (throttling default) dan desktop. Ambang sheet 03: Performance 90 desktop dan 85 mobile. Pengukuran pada sandbox lokal (tanpa latensi jaringan dan CDN); ukur ulang pada staging/produksi saat UAT.

| Halaman | Perf mobile | LCP mobile | Perf desktop | LCP desktop | A11y | Best Practices | SEO |
|---|---|---|---|---|---|---|---|
| / (Beranda) | 97 | 2.6 s | 100 | 0.7 s | 100 | 100 | 100 |
| /tentang | 100 | 1.1 s | 100 | 0.4 s | 100 | 100 | 100 |
| /lini-bisnis | 100 | 1.9 s | 100 | 0.4 s | 100 | 100 | 100 |
| /berita | 99 | 2.0 s | 100 | 0.4 s | 100 | 100 | 100 |
| /kontak | 100 | 1.1 s | 100 | 0.3 s | 100 | 100 | 100 |
| /en | 98 | 2.3 s | 100 | 0.8 s | 100 | 100 | 100 |

Perbaikan yang dilakukan dari hasil awal: gambar hero dilayani dalam varian WebP responsif (Performance mobile beranda 70 menjadi 97), dimensi gambar eksplisit (CLS), perbaikan struktur heading dan label tombol (Accessibility 98 menjadi 100). Skor SEO 100 diukur dengan indexing diaktifkan khusus pada sandbox (`SANDBOX_INDEXABLE=1`).

## 5. UAT (sheet 03)

Kriteria blocker: **form tidak sampai ke PIC** atau **konten salah**. Semua skenario dijalankan di desktop dan ponsel, browser utama (Chrome, Edge, Safari, Firefox), oleh PIC UAT DIC bersama SINUX. Skenario otomatis ada di [SANDBOX.md](SANDBOX.md); UAT manual melengkapi dengan data produksi.

| # | Skenario | Hasil yang diharapkan | Lulus |
|---|---|---|---|
| U1 | Kirim form kontak (ID) | Pesan sukses, pesan di CMS, email PIC diterima, autoresponse Indonesia diterima | ☐ |
| U2 | Kirim form kontak (EN) | Hal yang sama dengan teks English | ☐ |
| U3 | Navigasi semua menu, switcher ID/EN pada setiap halaman | Tidak ada tautan rusak, halaman setara terbuka | ☐ |
| U4 | Pencarian kata kunci layanan dan berita | Hasil relevan | ☐ |
| U5 | Unduh Company Profile (langsung) dan dokumen via form | File benar dan versi terbaru | ☐ |
| U6 | Editor membuat berita, Reviewer menayangkan | Tayang di ID dan EN sesuai jadwal | ☐ |
| U7 | Editor mengubah konten tayang | Kembali ke review, tidak tayang sampai disetujui | ☐ |
| U8 | Export CSV pesan oleh PIC; akun non-PIC tidak melihat Pesan masuk | Sesuai peran | ☐ |
| U9 | Periksa semua fakta: alamat, telepon, email, visi dan misi, lini, roadmap | Sesuai dokumen resmi, tidak ada butir yang belum disetujui | ☐ |
| U10 | Tampilan ponsel: menu, form, tombol, keterbacaan | Nyaman, tanpa scroll horizontal | ☐ |

## 6. Cutover dan rollback

| Langkah | Tindakan | Verifikasi |
|---|---|---|
| T-7 hari | Turunkan TTL DNS ke 300 detik; backup website lama (jika ada) | TTL berlaku |
| T-1 hari | Freeze konten, UAT lulus, persetujuan launch Direksi (satu jalur) | Sign-off tertulis |
| T-0 | Aktifkan **Situs siap tayang**; arahkan DNS A/AAAA ke server baru; set Google Search Console dan kirim `sitemap.xml` | `curl` 10 URL kunci, `robots.txt` memuat Sitemap |
| T+1 jam | Uji form ID dan EN, cek Pesan masuk dan email | Pesan diterima PIC |
| T+1 hari | Tinjau log error, ketersediaan, dan Search Console | Tidak ada error baru |
| Rollback | Nonaktifkan **Situs siap tayang**; kembalikan DNS ke tujuan sebelumnya (TTL 300 detik); bila akibat rilis kode, `git checkout` commit sebelumnya dan restore backup | Situs lama kembali melayani |

## 7. Sign-off

| Peran | Nama | Tanggal | Tanda tangan/persetujuan email |
|---|---|---|---|
| Direksi DIC (approver akhir desain dan konten) | | | |
| Humas DIC (koordinator) | | | |
| Legal DIC (privasi dan publikasi) | | | |
| TI DIC (domain, email, infrastruktur) | | | |
| SINUX (implementator) | | | |
