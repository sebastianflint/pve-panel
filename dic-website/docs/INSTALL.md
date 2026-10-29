# Panduan Instalasi dic.id

Klasifikasi: **RESTRICTED**. Ditujukan untuk engineer/implementator. Ikuti urutan langkah, jalankan verifikasi di setiap tahap, dan jangan lanjut bila verifikasi gagal.

## 1. Ruang lingkup dan prasyarat

| Item | Spesifikasi |
|---|---|
| OS | Ubuntu 22.04 atau 24.04 LTS (x86_64) |
| Resource minimum | 1 vCPU, 1 GB RAM, 10 GB disk (SSD) |
| Software | Docker Engine 24+ dengan Compose v2 (jalur A), atau Node.js 22 LTS atau lebih baru (jalur B) |
| Jaringan | Port 80 dan 443 terbuka dari Internet, port 3000 hanya `127.0.0.1` |
| DNS | Record A/AAAA `dic.id` dan `www.dic.id` mengarah ke server (dikelola TI DIC, Assessment A#26) |
| Email | Mailbox resmi @dic.id dan kredensial SMTP untuk notifikasi form (A#27) |
| Akses | User non-root dengan sudo, akses SSH key |

**Pilihan jalur:** A (Docker Compose) direkomendasikan karena runtime konsisten dan rollback sederhana. B (native systemd) dipakai bila Docker tidak diizinkan.

Prinsip eksekusi: **backup sebelum mengubah**, ubah bertahap, verifikasi di setiap langkah. Pada instalasi baru tidak ada data yang dikorbankan, tetapi untuk upgrade lihat bagian 8.

## 2. Persiapan server

```bash
# Update dan paket dasar
sudo apt-get update && sudo apt-get -y upgrade
sudo apt-get install -y git curl ufw ca-certificates openssl

# Firewall: hanya SSH, HTTP, HTTPS
sudo ufw allow OpenSSH && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw --force enable
sudo ufw status
```

Verifikasi: `ufw status` menampilkan hanya 22, 80, 443.

## 3. Ambil kode

```bash
sudo mkdir -p /opt/dic.id && sudo chown "$USER":"$USER" /opt/dic.id
git clone https://github.com/hawaianblue21/dic.id /opt/dic.id
cd /opt/dic.id && git log --oneline -1
```

## 4. Konfigurasi `.env`

```bash
cd /opt/dic.id
cp example.env .env
# Isi nilai acak dan password admin awal
sed -i "s|^SESSION_SECRET=.*|SESSION_SECRET=$(openssl rand -hex 32)|" .env
sed -i "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=$(openssl rand -base64 18 | tr -d '=+/')|" .env
chmod 600 .env
nano .env   # isi BASE_URL, SMTP_*, MAIL_FROM, ADMIN_EMAIL
```

| Variabel | Wajib | Keterangan |
|---|---|---|
| `NODE_ENV` | ya | `production` |
| `BASE_URL` | ya | `https://dic.id`, dipakai untuk canonical, sitemap, Open Graph |
| `SESSION_SECRET` | ya | Acak minimal 32 karakter. Aplikasi menolak start tanpa ini |
| `TRUST_PROXY` | ya | `1` bila di belakang Caddy/Nginx |
| `DB_PATH`, `UPLOAD_DIR` | tidak | Default `./data/dic.db` dan `./uploads` (Docker: `/data/...`) |
| `MAX_UPLOAD_MB` | tidak | Default 10 |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | disarankan | Tanpa SMTP, pesan tetap tersimpan di CMS tetapi email tidak terkirim |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | saat seed pertama | Akun admin awal; wajib ganti password saat login pertama |

Catat `ADMIN_PASSWORD` di password manager, lalu hapus nilainya dari `.env` setelah login pertama dan penggantian password.

## 5A. Jalur A: Docker Compose

```bash
cd /opt/dic.id
docker compose up -d --build
docker compose ps
docker compose logs --tail=30 dic-web
```

Verifikasi:

```bash
curl -fsS http://127.0.0.1:3000/robots.txt         # harus mengembalikan "Disallow: /" sebelum launch
docker compose exec dic-web node -e "console.log('node', process.version)"
```

Data tersimpan di volume `dic-data` (`/data/dic.db` dan `/data/uploads`).

## 5B. Jalur B: Native dengan systemd

```bash
# Node.js 22 LTS (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs build-essential

sudo useradd --system --home /opt/dic.id --shell /usr/sbin/nologin dic
cd /opt/dic.id && npm ci --omit=dev
mkdir -p data uploads && sudo chown -R dic:dic /opt/dic.id

sudo cp deploy/dic-web.service /etc/systemd/system/dic-web.service
sudo systemctl daemon-reload && sudo systemctl enable --now dic-web
systemctl status dic-web --no-pager && journalctl -u dic-web -n 30 --no-pager
```

Verifikasi: `curl -fsS http://127.0.0.1:3000/robots.txt`.

## 6. Reverse proxy HTTPS

**Caddy (direkomendasikan, TLS otomatis):**

```bash
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update && sudo apt-get install -y caddy

sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak     # backup konfigurasi lama
sudo cp /opt/dic.id/deploy/Caddyfile /etc/caddy/Caddyfile
sudo mkdir -p /var/log/caddy && sudo chown caddy:caddy /var/log/caddy
sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy
```

Alternatif Nginx tersedia di `deploy/nginx.conf` (gunakan certbot untuk sertifikat). DNS harus sudah mengarah ke server sebelum langkah ini agar penerbitan sertifikat berhasil.

Verifikasi:

```bash
curl -sI https://dic.id | head -5                 # HTTP/2 200, ada strict-transport-security
curl -sI http://dic.id | head -3                  # 301 ke https
curl -s https://dic.id/robots.txt                 # Disallow: / (belum launch)
```

## 7. Konfigurasi awal di CMS

1. Buka `https://dic.id/admin`, login dengan `ADMIN_EMAIL` dan `ADMIN_PASSWORD`, lalu ganti password (min. 12 karakter).
2. **Pengguna**: buat akun Editor, Reviewer/Publisher, dan tandai PIC inquiry dengan "Boleh melihat pesan masuk" (usulan: 1 admin TI, 2 editor, 1 reviewer/publisher dari Humas, Assessment A#24).
3. **Pengaturan situs**: isi email tujuan inquiry, CC, kontak publik, jam layanan, masa simpan pesan, dan versi English tiap teks.
4. Unggah **logo resmi** (Pengaturan situs, bagian Logo) setelah diterima dari DIC.
5. Uji alur form: kirim pesan dari halaman Kontak (ID dan EN). Verifikasi pesan muncul di **Pesan masuk**, email notifikasi diterima PIC, dan autoresponse diterima pengirim.
6. Ganti hasil seed dengan konten final sesuai [docs/GO-LIVE-CHECKLIST.md](GO-LIVE-CHECKLIST.md).
7. Aktifkan **Situs siap tayang** hanya setelah seluruh checklist go-live disetujui.

## 8. Verifikasi pasca-instalasi

```bash
BASE=https://dic.id
for p in / /en /tentang /en/about /lini-bisnis /berita /kontak /en/contact /unduh/1 /sitemap.xml; do
  printf "%-16s %s\n" "$p" "$(curl -s -o /dev/null -w '%{http_code}' $BASE$p)"
done
curl -s -o /dev/null -w "admin tanpa login: %{http_code}\n" $BASE/admin   # harus 302
```

Semua harus 200 kecuali `/admin` (302). Jalankan juga workflow **Sandbox** di GitHub Actions terhadap versi yang sama (lihat [SANDBOX.md](SANDBOX.md)).

## 9. Backup, upgrade, dan rollback

**Backup (otomatis harian):**

```bash
sudo mkdir -p /var/backups/dic && sudo chown "$USER" /var/backups/dic
# native:
/opt/dic.id/deploy/backup.sh
# docker:
MODE=docker CONTAINER=$(docker compose -f /opt/dic.id/docker-compose.yml ps -q dic-web) /opt/dic.id/deploy/backup.sh
# jadwal harian 02:15
( crontab -l 2>/dev/null; echo "15 2 * * * /opt/dic.id/deploy/backup.sh >> /var/log/dic-backup.log 2>&1" ) | crontab -
```

Salin arsip ke penyimpanan di luar server (object storage atau NAS) dan uji restore minimal setiap kuartal.

**Upgrade (selalu backup dulu):**

```bash
cd /opt/dic.id
./deploy/backup.sh                                  # 1. backup
git fetch origin && git log --oneline HEAD..origin/main   # 2. tinjau perubahan
git pull --ff-only origin main                      # 3. ambil versi baru
docker compose up -d --build                        # 4a. Docker
# atau: npm ci --omit=dev && sudo systemctl restart dic-web   # 4b. native
curl -fsS http://127.0.0.1:3000/robots.txt && docker compose logs --tail=20 dic-web   # 5. verifikasi
```

**Rollback:**

```bash
cd /opt/dic.id
git checkout <commit-sebelumnya>                    # versi kode sebelumnya
docker compose up -d --build                        # atau: sudo systemctl restart dic-web
# bila data terdampak, hentikan aplikasi lalu:
./deploy/restore.sh /var/backups/dic/dic-YYYYMMDD-HHMMSS.tar.gz
```

`restore.sh` membuat salinan pengaman data saat ini di `data/pre-restore-*` sebelum menimpa.

## 10. Troubleshooting

| Gejala | Penyebab umum | Tindakan |
|---|---|---|
| Aplikasi berhenti dengan "SESSION_SECRET wajib" | `.env` belum terisi | Isi `SESSION_SECRET`, restart |
| Login berhasil lalu langsung logout | `BASE_URL` https tetapi akses via http, atau `TRUST_PROXY` salah | Pastikan akses lewat HTTPS dan `TRUST_PROXY=1` di belakang proxy |
| Pesan tersimpan tetapi email tidak terkirim | SMTP kosong atau salah | Cek `/admin/pesan?f=gagal`, perbaiki `SMTP_*`, gunakan "Kirim ulang notifikasi" |
| Upload gagal | Ukuran melebihi `MAX_UPLOAD_MB` atau batas proxy | Samakan `MAX_UPLOAD_MB` dengan `client_max_body_size`/`request_body` |
| Gambar baru tidak memiliki varian responsif | Proses `sharp` gagal | Lihat log `[img]`; gambar tetap tampil dalam ukuran asli |
| `better-sqlite3`/`sharp` gagal dipasang (native) | Toolchain tidak ada | `sudo apt-get install -y build-essential python3`, ulangi `npm ci` |
| Sertifikat TLS tidak terbit | DNS belum mengarah atau port 80 tertutup | Periksa A record dan firewall, lihat `journalctl -u caddy` |
| Halaman tidak muncul di Google | `noindex` aktif | Aktifkan "Situs siap tayang" setelah checklist go-live |
