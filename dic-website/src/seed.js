'use strict';
// Seed konten awal dari DIC Company Profile 03b dan Website Assessment v1.0.
// Idempotent: hanya mengisi tabel yang masih kosong. Butir yang berstatus "review" belum
// divalidasi/izin publikasinya (lihat sheet 00 Profil DIC dan README) sehingga tidak tayang.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const config = require('./config');
const { db, setSetting, settings } = require('./db');
const settingsDef = require('./settingsDef');
const U = require('./lib/util');

function ins(table, o) {
  const k = Object.keys(o);
  return db.prepare(`INSERT INTO ${table}(${k.join(',')}) VALUES(${k.map((x) => '@' + x).join(',')})`).run(o).lastInsertRowid;
}
const empty = (t) => db.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n === 0;

function seed() {
  const st = settings();
  for (const d of settingsDef) if (st[d.name] === undefined && d.default !== undefined) setSetting(d.name, d.default);
  if (!settings().notify_to) setSetting('notify_to', config.admin.email || '');

  if (empty('users')) {
    const email = config.admin.email || 'admin@dic.id';
    let pw = config.admin.password; let generated = false;
    if (!pw) { pw = crypto.randomBytes(9).toString('base64url'); generated = true; }
    ins('users', { name: 'Administrator', email, password_hash: bcrypt.hashSync(pw, 12), role: 'admin', can_submissions: 1, must_change: 1 });
    console.log(`[seed] Admin dibuat: ${email}` + (generated ? `  password sementara: ${pw}  (WAJIB diganti saat login)` : ''));
  }

  if (empty('hero_slides')) {
    ins('hero_slides', { title: 'Mitra Pengadaan Barang dan Jasa untuk Industri', subtitle: st.tagline || settingsDef.find((d) => d.name === 'tagline').default, image: '/img/hero-kapal.jpg', cta_label: 'Lihat Lini Bisnis', cta_url: '/lini-bisnis', sort: 1, status: 'published' });
    ins('hero_slides', { title: 'Konstruksi dan Infrastruktur Industri', subtitle: 'Pengerjaan proyek infrastruktur dengan standar tinggi, mulai dari bangunan sipil hingga infrastruktur pertambangan.', image: '/img/tim-lapangan.jpg', cta_label: 'Konstruksi', cta_url: '/lini-bisnis/konstruksi', sort: 2, status: 'published' });
    ins('hero_slides', { title: 'Angkutan dan Logistik Terpadu', subtitle: 'Layanan pengangkutan barang umum dan khusus melalui jalur darat, laut, dan udara.', image: '/img/bongkar-muat.jpg', cta_label: 'Angkutan dan Logistik', cta_url: '/lini-bisnis/angkutan-logistik', sort: 3, status: 'published' });
  }

  if (empty('highlights')) {
    ins('highlights', { title: 'Rekam jejak gudang bahan peledak', body: 'Penyediaan fasilitas gudang bahan peledak (handak) di tiga kabupaten di Sumatera Selatan pada 2024.', icon: 'shield', sort: 1, status: 'review' }); // butuh izin publikasi (A#19)
    ins('highlights', { title: 'Angkutan barang khusus dan berbahaya', body: 'Kapabilitas angkutan handak dan non-handak (logistik berbahaya) untuk kebutuhan industri.', icon: 'truck', sort: 2, status: 'published' });
    ins('highlights', { title: 'Layanan terintegrasi', body: 'Pengadaan, sewa alat, logistik, dan konstruksi dalam satu mitra untuk menyederhanakan koordinasi proyek.', icon: 'layers', sort: 3, status: 'published' });
  }

  if (empty('business_lines')) {
    const L = (o) => ins('business_lines', { category: 'utama', realisasi: 'aktif', status: 'published', ...o });
    L({ slug: 'konstruksi', title: 'Konstruksi', icon: 'building', image: '/img/tim-lapangan.jpg', sort: 1, summary: 'Pengerjaan proyek infrastruktur dengan standar tinggi.', items: 'Bangunan sipil (jalan, jembatan, dll)\nGedung hunian dan perkantoran\nInfrastruktur minyak, gas bumi, dan pertambangan', body: '<p>Kami mengerjakan proyek infrastruktur dengan standar tinggi untuk kebutuhan industri, perkantoran, dan sektor energi serta pertambangan.</p>' });
    L({ slug: 'angkutan-logistik', title: 'Angkutan dan Logistik', icon: 'truck', image: '/img/bongkar-muat.jpg', sort: 2, summary: 'Layanan pengangkutan barang umum dan khusus dengan jangkauan luas.', items: 'Darat: angkutan jalan rel dan bermotor untuk barang khusus/berbahaya\nLaut: angkutan dalam dan luar negeri (barang umum/khusus/pelayaran rakyat)\nUdara: angkutan kargo niaga berjadwal maupun tidak berjadwal', body: '<p>Layanan pengangkutan barang umum dan khusus melalui moda darat, laut, dan udara.</p>' });
    L({ slug: 'persewaan-jasa-pendukung', title: 'Persewaan dan Jasa Pendukung', icon: 'checklist', image: '/img/alat-berat.jpg', sort: 3, summary: 'Solusi manajemen aset dan sumber daya.', items: 'Rental perlengkapan pendukung tambang\nSewa guna usaha mobil, bus, dan truk\nPenyediaan tenaga kerja (outsourcing), jasa keamanan, dan kebersihan industri\nAgen perjalanan dan manajemen fasilitas terpadu', body: '<p>Solusi manajemen aset dan sumber daya untuk mendukung operasional industri dan pertambangan.</p>' });
    L({ slug: 'perdagangan', title: 'Perdagangan (Trading)', icon: 'clipboard', image: '/img/lini-bisnis.jpg', sort: 4, summary: 'Perdagangan besar dan eceran untuk berbagai kebutuhan industri.', items: 'Penyediaan bahan baku/pembantu produksi\nAlat laboratorium, farmasi, dan kedokteran\nLogam, bijih logam, serta bahan dan barang kimia (termasuk bahan berbahaya)\nReparasi dan perawatan kendaraan bermotor', body: '<p>Kami melayani perdagangan besar dan eceran untuk berbagai kebutuhan industri.</p>' });
    // Lini tambahan: status aktif/rencana belum dikonfirmasi (A#18), wording handak perlu izin (A#19)
    L({ slug: 'pertambangan-penggalian', title: 'Pertambangan dan Penggalian', category: 'tambahan', icon: 'pickaxe', image: '/img/alat-berat.jpg', sort: 5, status: 'review', summary: 'Pertambangan batubara, bijih logam mulia, serta penggalian material konstruksi.', items: 'Pertambangan batubara\nBijih logam mulia\nPenggalian material konstruksi (batu kapur, kerikil, sirtu)' });
    L({ slug: 'industri-pengolahan', title: 'Industri Pengolahan', category: 'tambahan', icon: 'gear', sort: 6, status: 'review', summary: 'Spesialisasi dalam sektor industri bahan peledak.', items: 'Industri bahan peledak' });
  }

  if (empty('roadmap')) {
    const R = (year, title, kind, status) => ins('roadmap', { year, title, kind, status });
    R(2021, 'Penjajakan Bisnis & Fondasi Perusahaan', 'realisasi', 'published');
    R(2022, 'Pengembangan Bisnis Penyewaan Alat & Supporting Production Material', 'realisasi', 'published');
    R(2023, 'Pengembangan Bisnis Jasa Angkutan Bahan Peledak', 'realisasi', 'published');
    R(2024, 'Pengembangan Bisnis Pengelolaan Lahan (Subang)', 'realisasi', 'published');
    R(2025, 'Pengembangan Bisnis Badan Usaha Bahan Peledak (Handak)', 'realisasi', 'review'); // tayang bila izin terbit (A#19, A#20)
    R(2026, 'Ekspansi ke Jasa Pengeboran (Drilling Services)', 'rencana', 'review');
    R(2027, 'Ekspansi ke Layanan Loading & Hauling', 'rencana', 'review');
  }

  if (empty('projects')) {
    ins('projects', { slug: 'gudang-handak-sumatera-selatan-2024', title: 'Penyediaan Fasilitas Gudang Bahan Peledak (Handak)', service: 'Penyediaan fasilitas gudang', period: '2024', location_public: 'Musi Rawas, Muara Enim, dan Musi Banyuasin, Sumatera Selatan', summary: 'Penyediaan fasilitas gudang bahan peledak di tiga kabupaten di Sumatera Selatan pada tahun 2024 dalam rangka mendukung proyek strategis nasional.', image: '/img/tim-lapangan.jpg', source: 'DIC Company Profile 03b, hal. 10', featured: 1, sort: 1, status: 'review' });
  }

  if (empty('offices')) {
    ins('offices', { name: 'Kantor Pusat', type: 'pusat', address: 'Menara MTH Lt. 15\nJl. Letjen M.T. Haryono Kav. 23, Kec. Tebet\nJakarta Selatan 12820', phone: '+62 812-1928-786', email: 'dahanainvestama.dic@gmail.com', sort: 1, status: 'published' });
    ins('offices', { name: 'Kantor Cabang Subang', type: 'cabang', address: 'Jl. Raya Subang - Cikamurang Km. 12, Kec. Cibogo\nKab. Subang 41285, Jawa Barat, Indonesia', sort: 2, status: 'published' });
    ins('offices', { name: 'Kantor Cabang Samarinda', type: 'cabang', address: 'Perumahan Villa Tamara, Cluster Andalusia\nJl. A. Wahab Syahrani Blok KK2 No. 7, Kec. Gunung Kelua\nSamarinda Ulu, Kota Samarinda, Kalimantan Timur', sort: 3, status: 'review' }); // konfirmasi layak tayang (alamat perumahan)
  }

  if (empty('documents')) {
    const src = path.join(config.root, 'seed', 'company-profile.pdf');
    let file = null;
    if (fs.existsSync(src)) { file = 'company-profile-dic.pdf'; fs.copyFileSync(src, path.join(config.uploadDir, file)); file = '/uploads/' + file; }
    ins('documents', { title: 'Company Profile PT Dahana Investama Corp', description: 'Profil perusahaan, visi dan misi, roadmap bisnis, serta lini bisnis.', file, version: '03b (Februari 2026)', lang: 'id', effective_date: '2026-02-04', gated: 0, status: file ? 'published' : 'draft' });
  }

  if (empty('pages')) {
    ins('pages', { slug: 'kebijakan-privasi', title: 'Kebijakan Privasi', summary: 'Cara PT Dahana Investama Corp memproses data pribadi yang Anda berikan melalui website.', meta_description: 'Kebijakan privasi website dic.id', status: 'published', body: `
<p><strong>Catatan:</strong> naskah ini adalah draf awal dan wajib ditinjau serta disetujui Legal DIC sebelum situs dinyatakan siap tayang.</p>
<h2>Data yang kami kumpulkan</h2>
<p>Melalui formulir kontak kami meminta nama, instansi, alamat email, nomor telepon (opsional), kategori keperluan, dan isi pesan. Untuk dokumen tertentu yang diunduh melalui formulir, kami meminta nama, instansi, dan email.</p>
<h2>Tujuan penggunaan</h2>
<p>Data digunakan hanya untuk menanggapi pertanyaan Anda, menindaklanjuti permintaan informasi bisnis, dan mengirim balasan otomatis. Data tidak dijual atau dibagikan kepada pihak ketiga di luar kebutuhan penanganan permintaan tersebut.</p>
<h2>Penyimpanan dan keamanan</h2>
<p>Pesan disimpan pada sistem pengelolaan konten dengan akses terbatas pada petugas yang ditunjuk dan dihapus otomatis setelah 12 bulan. Kami menerapkan pengamanan teknis yang wajar untuk melindungi data tersebut.</p>
<h2>Cookie dan analitik</h2>
<p>Website memuat cookie sesi yang diperlukan agar formulir berfungsi. Cookie analitik hanya dipasang setelah Anda menyetujuinya melalui banner cookie, dan Anda dapat menolaknya tanpa mengurangi akses ke konten.</p>
<h2>Hak Anda</h2>
<p>Anda dapat meminta akses, perbaikan, atau penghapusan data pribadi Anda sesuai peraturan pelindungan data pribadi yang berlaku di Indonesia dengan menghubungi kami melalui halaman Kontak.</p>
<h2>Perubahan kebijakan</h2>
<p>Kebijakan ini dapat diperbarui sewaktu-waktu. Versi terbaru selalu ditampilkan pada halaman ini.</p>` });
  }

  if (empty('posts')) {
    const today = new Date().toISOString().slice(0, 10);
    ins('posts', { slug: 'mengenal-pt-dahana-investama-corp', title: 'Mengenal PT Dahana Investama Corp', category: 'korporat', published_at: today, status: 'published', excerpt: 'Penyedia layanan pengadaan barang dan jasa untuk sektor pertambangan, konstruksi, dan perdagangan umum.', image: '/img/tim-lapangan.jpg', caption: 'Tim lapangan DIC.', photo_credit: 'Dokumentasi DIC', body: `<p>PT Dahana Investama Corp (DIC) adalah penyedia layanan pengadaan barang dan jasa yang berdedikasi untuk memberikan solusi yang terpercaya dan inovatif. Kami hadir untuk mendorong kemandirian dan menciptakan nilai keberlanjutan bagi setiap klien serta mitra strategis.</p><p>Dengan menjunjung tinggi profesionalisme dan integritas, DIC terus memperluas jangkauan layanan di berbagai sektor industri, mulai dari pertambangan, konstruksi, hingga perdagangan umum.</p>` });
    ins('posts', { slug: 'empat-lini-bisnis-utama-dic', title: 'Empat Lini Bisnis Utama DIC', category: 'informasi', published_at: today, status: 'published', excerpt: 'Konstruksi, angkutan dan logistik, persewaan dan jasa pendukung, serta perdagangan.', image: '/img/bongkar-muat.jpg', caption: 'Kegiatan bongkar muat.', photo_credit: 'Dokumentasi DIC', body: `<p>DIC menjalankan empat lini bisnis utama: <strong>konstruksi</strong>, <strong>angkutan dan logistik</strong>, <strong>persewaan dan jasa pendukung</strong>, serta <strong>perdagangan</strong>. Setiap lini dirancang untuk saling melengkapi sehingga klien dapat bekerja sama dengan satu mitra untuk berbagai kebutuhan proyek.</p><p>Informasi lengkap setiap lini dapat dilihat pada halaman Lini Bisnis.</p>` });
  }
  console.log('[seed] selesai.');
}
if (require.main === module) seed();
module.exports = seed;
