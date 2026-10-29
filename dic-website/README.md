# dic.id

Website company profile dan CMS untuk **PT Dahana Investama Corp (DIC)**, dibangun dengan Node.js (Express, EJS, SQLite).
Dua bahasa (Indonesia di `/`, English di `/en`), CMS dengan workflow review, form kontak dengan inbox, dan sandbox untuk simulasi.

Klasifikasi dokumen: **RESTRICTED**. Referensi tata letak: pertamina.com. Identitas visual: DIC Company Profile 03b.

## Mulai cepat

| Tujuan | Perintah | Hasil |
|---|---|---|
| Mencoba semua fitur dengan data demo | `npm ci && npm run sandbox` | http://localhost:3100, akun per peran dicetak di terminal |
| Simulasi otomatis (persona, keamanan, aksesibilitas) | `npx playwright install chromium && npm run simulate` | `sandbox-report/report.md` dan screenshot |
| Menjalankan tes | `npm test` | 6 tes end-to-end dengan database sementara |
| Pengembangan lokal | `cp example.env .env && npm run seed && npm run dev` | http://localhost:3000, CMS di `/admin` |
| Produksi dengan Docker | `docker compose up -d --build` | lihat [docs/INSTALL.md](docs/INSTALL.md) |

## Dokumentasi

| Dokumen | Isi |
|---|---|
| [docs/INSTALL.md](docs/INSTALL.md) | Prasyarat, instalasi Docker dan native, HTTPS, konfigurasi, verifikasi, upgrade, rollback, troubleshooting |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | HLD dan LLD: komponen, alur request, data model, keamanan, bahasa, topologi deployment |
| [docs/OPERATIONS.md](docs/OPERATIONS.md) | Runbook harian sampai bulanan, user management, backup, patching, penanganan insiden |
| [docs/SANDBOX.md](docs/SANDBOX.md) | Sandbox lokal, Docker, Codespaces, dan GitHub Actions; cakupan simulasi |
| [docs/GO-LIVE-CHECKLIST.md](docs/GO-LIVE-CHECKLIST.md) | Konten yang menunggu validasi DIC, UAT, cutover, sign-off, hasil Lighthouse |
| [docs/design/DESIGN.md](docs/design/DESIGN.md) dan [mockup.html](docs/design/mockup.html) | Design system dan papan mockup |
| [SECURITY.md](SECURITY.md) | Kontrol keamanan dan cara melaporkan kerentanan |

## Struktur repo

```
src/            server, routes (public, admin), CMS resources, i18n, mail, seed, sandbox
views/          template EJS (public, admin, partials)
public/         CSS, JS, gambar (dengan varian responsif WebP)
seed/           company-profile.pdf untuk konten awal
scripts/        simulate.js (simulasi), check-syntax.js, make-variants.js
test/           tes end-to-end (node:test)
deploy/         Caddyfile, nginx.conf, systemd unit, backup.sh, restore.sh
docs/           dokumentasi dan mockup
.github/        workflow CI, Sandbox, CodeQL, Dependabot
```

## Status konten

Konten awal berasal dari company profile dan statusnya masih **belum divalidasi DIC**. Butir yang disyaratkan assessment menunggu izin
(roadmap 2025 sampai 2027, proyek handak, lini Pertambangan dan Industri Pengolahan, Kantor Samarinda) tidak tayang di produksi.
Situs mengirim `noindex` sampai pengaturan **Situs siap tayang** diaktifkan. Detail di [docs/GO-LIVE-CHECKLIST.md](docs/GO-LIVE-CHECKLIST.md).
