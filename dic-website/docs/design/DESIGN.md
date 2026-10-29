# Design System dic.id

Klasifikasi: **RESTRICTED**. Papan visual lengkap: [mockup.html](mockup.html) (buka di browser; gambar di `screens/`). Mockup dihasilkan dari sandbox dengan `npm run simulate -- --clean --shots-only`, sehingga selalu dapat diperbarui dari kode.

## Referensi dan adaptasi

Struktur mengacu pada pertamina.com (top bar utilitas dengan pilihan bahasa, menu utama lima item, kartu bisnis, media dan informasi, footer multi-kolom dengan alamat dan email). Identitas visual dari DIC Company Profile 03b. Kode warna adalah hasil sampling visual, bukan brand guideline (A#11).

## Token

| Token | Nilai | Pemakaian | Kontras di atas putih |
|---|---|---|---|
| `--green` | `#305E3F` | Tombol utama, teks aksen | 7,5:1 |
| `--teal` | `#4DC2A9` | Dekorasi, ikon, garis (bukan teks) | 2,2:1 |
| `--teal-d` | `#1F7A67` | Tautan, eyebrow | 5,2:1 |
| `--orange` | `#F9A70D` | CTA di atas foto, penanda | teks gelap 9,1:1 |
| `--ink` | `#1C2B24` | Teks | 14,8:1 |
| `--tint` | `#F2F8F5` | Latar seksi selang-seling | - |
| `--grad` | teal ke kuning-oranye | Banner CTA, kartu Visi, bentuk dekoratif | - |

Mode gelap otomatis (`prefers-color-scheme`). Font **Inter** (SIL OFL) dilayani dari server sendiri. Radius kartu 18 px, tombol pill. Motif lengkung dan daun dari compro untuk ikon lini bisnis dan penutup.

## Pola halaman

| Halaman | Blok |
|---|---|
| Beranda | Hero carousel (maks. 3), strip sektor, tentang, keunggulan, 4 lini, rekam jejak, berita, banner CTA |
| Tentang | Profil, Visi (kartu gradasi), Misi (5 butir), timeline roadmap dengan label, rekam jejak, kantor |
| Lini Bisnis | 4 lini utama berfoto, lini tambahan terpisah, detail per lini |
| Berita | Filter kategori, kartu, pagination, detail dengan kredit foto |
| Kontak | Form, kantor pusat dan cabang, kontak langsung, WhatsApp, peta opsional |

## Aksesibilitas dan responsif

Target WCAG 2.1 AA (diuji axe-core dan Lighthouse, skor Accessibility 100), skip link, fokus terlihat, `prefers-reduced-motion`, target sentuh minimal 44 px, tanpa scroll horizontal pada 390 px.

## Memperbarui mockup

```bash
npx playwright install chromium
npm run simulate -- --clean --shots-only --out /tmp/shots
# konversi screenshot ke WebP lalu salin ke docs/design/screens/ (lihat daftar nama di mockup.html)
```
