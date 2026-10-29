# Runbook Operasi dic.id

Klasifikasi: **RESTRICTED**. Untuk PIC TI dan Humas DIC serta engineer yang mengelola layanan. Batas dukungan, SLA, dan masa pendampingan mengikuti SOW (sheet 03), bukan dokumen ini.

## 1. Pembagian tanggung jawab

| Peran | Pelaku | Tugas utama |
|---|---|---|
| Content owner | Humas DIC (editor, reviewer/publisher) | Menulis, mereview, menayangkan konten; menindaklanjuti inquiry dalam 2 hari kerja |
| Approver publikasi | Direksi, Legal DIC | Menyetujui proyek, roadmap, kutipan, privacy notice; persetujuan dicatat lewat email (A#15) |
| Admin teknis | TI DIC / SINUX sesuai kontrak | Pengguna, pengaturan, backup, patching, monitoring |

Akses CMS bukan izin publikasi. Konten sensitif (bahan peledak, lokasi proyek, klaim izin) hanya ditayangkan setelah persetujuan tertulis.

## 2. Rutinitas

| Frekuensi | Tugas | Pelaku | Cara |
|---|---|---|---|
| Harian kerja | Tindak lanjuti pesan masuk (target 2 hari kerja) | PIC inquiry | CMS, Pesan masuk; tandai "Sudah ditangani" |
| Harian kerja | Periksa pesan dengan email gagal | PIC inquiry | `/admin/pesan?f=gagal`, "Kirim ulang notifikasi" |
| Harian | Backup otomatis | Cron | `deploy/backup.sh`, cek `/var/log/dic-backup.log` |
| Mingguan | Review antrean konten | Reviewer | Dashboard, "Menunggu review" |
| Mingguan | Tinjau pull request Dependabot, jalankan workflow CI dan Sandbox | Admin teknis | GitHub |
| Bulanan | `npm audit`, patch OS, restart terjadwal | Admin teknis | Lihat bagian 5 |
| Bulanan | Tinjau Log aktivitas dan daftar pengguna aktif | Admin | CMS, Log aktivitas dan Pengguna |
| Kuartalan | Uji restore backup ke server uji | Admin teknis | `deploy/restore.sh` |

## 3. Proses konten

1. Editor membuat konten ID dan field "(English)", lalu **Kirim untuk review**.
2. Reviewer memeriksa melalui **Pratinjau**, memastikan fakta, izin, dan label Terealisasi/Rencana, lalu **Simpan dan tayangkan** (atau jadwalkan tayang, zona WIB).
3. Perubahan oleh Editor pada konten yang sudah tayang mengembalikannya ke antrean review sampai disetujui kembali.
4. Versi English bersifat opsional per field: bila kosong, halaman English menampilkan versi Indonesia sampai field English diisi.

Aturan: jangan menayangkan klaim "terbaik" tanpa bukti (A#4), jangan menampilkan rencana sebagai layanan tersedia (A#18, A#20), jangan menampilkan wajah atau merek pihak ketiga tanpa izin (A#13, A#21).

## 4. User management

| Kebutuhan | Langkah |
|---|---|
| Pengguna baru | Admin, Pengguna, isi nama, email, peran, password awal min. 12 karakter. Pengguna wajib ganti password saat login pertama |
| Beri akses pesan masuk | Centang "Boleh melihat pesan masuk" (hanya PIC inquiry) |
| Lupa password | Admin mengatur password baru (pengguna wajib menggantinya lagi) |
| Karyawan keluar | Nonaktifkan akun (bukan hapus) agar jejak audit tetap ada; sesi aktif otomatis tidak valid |
| Tinjauan akses | Bulanan: cocokkan daftar pengguna aktif dengan Humas dan TI |

## 5. Patching dan pemeliharaan

```bash
cd /opt/dic.id
./deploy/backup.sh                                 # 1. backup dulu
npm audit --omit=dev                               # 2. temuan kerentanan
git pull --ff-only origin main && docker compose up -d --build     # 3. terapkan (atau npm ci + systemctl restart)
curl -fsS http://127.0.0.1:3000/robots.txt         # 4. verifikasi
```

Terapkan patch keamanan tingkat high/critical dalam 7 hari, lainnya pada jadwal bulanan. Pada perubahan besar, jalankan workflow **Sandbox** di cabang yang sama sebelum merge.

## 5a. Retensi data

Pesan masuk dan permintaan unduhan dihapus otomatis setelah masa simpan (Pengaturan situs, default 12 bulan; dicek setiap jam). Untuk menghapus data seseorang atas permintaan, hapus pesan di CMS (Pesan masuk, Hapus) dan catat permintaan tersebut. Backup lama yang memuat data tersebut dihapus sesuai kebijakan retensi backup (`KEEP_DAYS`).

## 6. Monitoring

| Hal | Cara |
|---|---|
| Ketersediaan | Monitor eksternal ke `https://dic.id/robots.txt` setiap 1 menit (UptimeRobot atau sistem monitoring DIC) |
| Health container | `docker compose ps` (status healthy), healthcheck memanggil `/robots.txt` |
| Log aplikasi | `docker compose logs -f dic-web` atau `journalctl -u dic-web -f`; baris berawalan `[error]`, `[mail]`, `[img]`, `[retensi]` |
| Disk | Peringatan di 80%: periksa `uploads` dan backup |
| Sertifikat TLS | Caddy memperbarui otomatis; alarm bila masa berlaku < 14 hari |

## 7. Penanganan insiden

| Gejala | Periksa | Tindakan |
|---|---|---|
| Situs tidak dapat dibuka | `docker compose ps`, `curl 127.0.0.1:3000/robots.txt`, `systemctl status caddy` | Restart layanan yang mati; jika gagal setelah update, rollback (INSTALL bagian 9) |
| HTTP 500 pada halaman tertentu | Log `[error]` dengan nama template | Perbaiki data konten bermasalah di CMS atau rollback versi |
| Form tidak sampai ke PIC | `/admin/pesan?f=gagal`, kredensial SMTP, kuota mailbox | Perbaiki SMTP, kirim ulang notifikasi; pesan tidak hilang karena tersimpan di CMS |
| Spam form | Rate limit dan honeypot aktif; lihat lonjakan pesan | Hapus pesan spam, turunkan limit di `src/routes/public.js`, pertimbangkan CAPTCHA |
| Dugaan akun CMS disusupi | Log aktivitas, login tak dikenal | Nonaktifkan akun, reset password semua admin, ganti `SESSION_SECRET` (semua sesi keluar), tinjau perubahan konten |
| Konten salah tayang | Dashboard, Log aktivitas | **Tarik** konten ke draft (efek langsung), perbaiki, tayangkan ulang |
| Disk penuh | `df -h`, ukuran `uploads` dan backup | Hapus backup lama, perbesar volume |
| Data rusak | Backup terakhir | Restore dengan `deploy/restore.sh`, verifikasi, laporkan |

Setiap insiden dicatat: waktu, dampak, penyebab, tindakan, pencegahan.

## 8. Checklist rilis

- [ ] CI hijau (test, Docker smoke test) dan workflow Sandbox lulus pada commit yang sama
- [ ] Backup terbaru ada dan checksum valid
- [ ] Catatan perubahan dan dampak ke konten sudah dikomunikasikan ke Humas
- [ ] Teks baru tersedia ID dan EN
- [ ] Setelah deploy: 10 URL kunci 200, form kontak diuji ID dan EN, email PIC diterima
- [ ] Rencana rollback tersedia (commit sebelumnya dan backup)

## 9. Rotasi kredensial

| Kredensial | Frekuensi | Cara |
|---|---|---|
| `SESSION_SECRET` | 12 bulan atau saat dugaan kebocoran | Ganti di `.env`, restart (semua sesi keluar) |
| Password SMTP | Sesuai kebijakan mailbox | Ubah `SMTP_PASS`, restart, uji kirim ulang notifikasi |
| Password admin | 90 hari | Menu Akun saya |
