# Keamanan

## Melaporkan kerentanan
Kirim laporan ke PIC TI DIC melalui jalur privat (bukan issue publik). Sertakan langkah reproduksi, dampak, dan versi (commit). Target respons awal 2 hari kerja.

## Kontrol yang diterapkan
| Area | Kontrol |
|---|---|
| Autentikasi | bcrypt (cost 12), password minimal 12 karakter, wajib ganti saat login pertama, rate limit login (10 percobaan per 15 menit per IP), sesi diinvalidasi saat password atau peran berubah |
| Sesi | Cookie bertanda tangan, `httpOnly`, `sameSite=lax`, `secure` pada HTTPS, masa berlaku 8 jam |
| CSRF | Token per sesi pada semua POST (CMS dan form publik) |
| Otorisasi | Peran Editor, Reviewer/Publisher, Admin; pesan masuk hanya untuk PIC yang ditandai |
| Input | Teks polos disaring, HTML editor disaring dengan allowlist (sanitize-html), query SQL terparameter, CSV dinetralkan dari formula injection |
| Upload | Allowlist ekstensi, batas ukuran, nama acak, dokumen "via form" tidak dapat diakses langsung |
| Header | CSP, `X-Content-Type-Options`, HSTS (production, HTTPS), `Referrer-Policy` melalui Helmet |
| Anti-abuse | Honeypot, waktu minimum pengisian, rate limit form (6 per jam per IP) |
| Privasi | Analytics hanya setelah persetujuan cookie, IP pengirim disimpan sebagai hash, pesan dihapus otomatis setelah masa simpan |
| Audit | Log aktivitas CMS (login, perubahan konten, status, export) |
| Supply chain | Dependabot, `npm audit` di CI, CodeQL |

## Yang menjadi tanggung jawab deployment
HTTPS di reverse proxy, `SESSION_SECRET` acak, firewall, backup terenkripsi di luar server, mailbox resmi untuk SMTP, patching OS. Lihat [docs/INSTALL.md](docs/INSTALL.md) dan [docs/OPERATIONS.md](docs/OPERATIONS.md).
