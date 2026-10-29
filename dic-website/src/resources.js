'use strict';
// Definisi resource CMS. Satu definisi menghasilkan daftar, form, validasi, dan workflow di admin.
const ICONS = ['clipboard', 'checklist', 'truck', 'building', 'pickaxe', 'gear', 'handshake', 'shield', 'layers', 'leaf', 'spark', 'pin'];
const opt = (o) => Object.entries(o).map(([value, label]) => ({ value, label }));

const resources = {
  slides: {
    table: 'hero_slides', label: 'Hero Beranda', singular: 'slide', wf: true, order: 'sort ASC, id ASC',
    cols: [['title', 'Judul'], ['sort', 'Urutan']],
    fields: [
      { name: 'title', label: 'Judul', type: 'text', required: true, max: 120 },
      { name: 'subtitle', label: 'Sub-judul', type: 'textarea', max: 260, help: 'Hindari klaim superlatif ("terbaik") tanpa bukti (Assessment A#4).' },
      { name: 'image', label: 'Gambar latar (lanskap, min. 1600 px)', type: 'image' },
      { name: 'cta_label', label: 'Teks tombol', type: 'text', max: 40 },
      { name: 'cta_url', label: 'Tautan tombol', type: 'text', max: 200, help: 'Contoh: /lini-bisnis' },
      { name: 'sort', label: 'Urutan', type: 'number', default: 10 },
    ],
  },
  highlights: {
    table: 'highlights', label: 'Pembeda / Keunggulan', singular: 'keunggulan', wf: true, order: 'sort ASC, id ASC',
    cols: [['title', 'Judul'], ['sort', 'Urutan']],
    fields: [
      { name: 'title', label: 'Judul', type: 'text', required: true, max: 100 },
      { name: 'body', label: 'Uraian', type: 'textarea', max: 400 },
      { name: 'icon', label: 'Ikon', type: 'select', options: opt(Object.fromEntries(ICONS.map((i) => [i, i]))) },
      { name: 'sort', label: 'Urutan', type: 'number', default: 10 },
    ],
  },
  'lini-bisnis': {
    table: 'business_lines', label: 'Lini Bisnis', singular: 'lini bisnis', wf: true, order: "CASE category WHEN 'utama' THEN 0 ELSE 1 END, sort ASC, id ASC", slugFrom: 'title',
    publicPath: (r) => '/lini-bisnis/' + r.slug,
    cols: [['title', 'Lini'], ['category', 'Kategori'], ['realisasi', 'Realisasi']],
    fields: [
      { name: 'title', label: 'Nama lini', type: 'text', required: true, max: 120 },
      { name: 'category', label: 'Kategori', type: 'select', options: opt({ utama: 'Lini utama', tambahan: 'Lini tambahan' }) },
      { name: 'realisasi', label: 'Status layanan', type: 'select', options: opt({ aktif: 'Aktif / tersedia', mitra: 'Melalui mitra', rencana: 'Rencana ekspansi' }), help: 'Bedakan layanan tersedia dari rencana (Assessment A#18).' },
      { name: 'summary', label: 'Ringkasan', type: 'textarea', max: 300 },
      { name: 'items', label: 'Cakupan layanan (satu butir per baris)', type: 'textarea', rows: 6 },
      { name: 'body', label: 'Uraian lengkap', type: 'richtext' },
      { name: 'icon', label: 'Ikon', type: 'select', options: opt(Object.fromEntries(ICONS.map((i) => [i, i]))) },
      { name: 'image', label: 'Foto lini bisnis', type: 'image' },
      { name: 'sort', label: 'Urutan', type: 'number', default: 10 },
    ],
  },
  roadmap: {
    table: 'roadmap', label: 'Roadmap Bisnis', singular: 'milestone', wf: true, order: 'year ASC, id ASC',
    cols: [['year', 'Tahun'], ['title', 'Milestone'], ['kind', 'Label']],
    fields: [
      { name: 'year', label: 'Tahun', type: 'number', required: true },
      { name: 'title', label: 'Milestone', type: 'text', required: true, max: 160 },
      { name: 'kind', label: 'Label', type: 'select', options: opt({ realisasi: 'Terealisasi', rencana: 'Rencana' }), help: 'Butir yang belum terealisasi wajib berlabel Rencana.' },
      { name: 'note', label: 'Catatan internal (tidak tayang)', type: 'textarea', max: 300 },
    ],
  },
  proyek: {
    table: 'projects', label: 'Rekam Jejak / Proyek', singular: 'proyek', wf: true, order: 'sort ASC, id DESC', slugFrom: 'title',
    cols: [['title', 'Proyek'], ['period', 'Periode'], ['approved_by', 'Pemberi izin']],
    guard: (d) => (!d.approved_by || !d.source || !d.as_of) ? 'Proyek hanya dapat ditayangkan bila Sumber, Tanggal as-of, dan Pemberi izin publikasi terisi (Assessment A#19).' : null,
    fields: [
      { name: 'title', label: 'Nama proyek', type: 'text', required: true, max: 160 },
      { name: 'service', label: 'Layanan', type: 'text', max: 120 },
      { name: 'period', label: 'Periode', type: 'text', max: 60 },
      { name: 'location_public', label: 'Lokasi (batas detail yang boleh tayang)', type: 'text', max: 200 },
      { name: 'summary', label: 'Ringkasan', type: 'textarea', max: 500 },
      { name: 'image', label: 'Foto', type: 'image' },
      { name: 'as_of', label: 'Tanggal as-of data', type: 'date' },
      { name: 'source', label: 'Sumber data', type: 'text', max: 160 },
      { name: 'approved_by', label: 'Pemberi izin publikasi', type: 'text', max: 120, help: 'Wajib sebelum tayang. Contoh: Direksi DIC dan pihak klien.' },
      { name: 'featured', label: 'Sorot di Beranda', type: 'bool' },
      { name: 'sort', label: 'Urutan', type: 'number', default: 10 },
    ],
  },
  kantor: {
    table: 'offices', label: 'Kantor', singular: 'kantor', wf: true, order: "CASE type WHEN 'pusat' THEN 0 ELSE 1 END, sort ASC, id ASC",
    cols: [['name', 'Kantor'], ['type', 'Jenis']],
    fields: [
      { name: 'name', label: 'Nama kantor', type: 'text', required: true, max: 100 },
      { name: 'type', label: 'Jenis', type: 'select', options: opt({ pusat: 'Kantor pusat', cabang: 'Kantor cabang' }) },
      { name: 'address', label: 'Alamat', type: 'textarea', required: true, rows: 4 },
      { name: 'phone', label: 'Telepon', type: 'text', max: 40 },
      { name: 'email', label: 'Email', type: 'text', max: 120 },
      { name: 'map_url', label: 'Tautan Google Maps', type: 'text', max: 400 },
      { name: 'sort', label: 'Urutan', type: 'number', default: 10 },
    ],
  },
  berita: {
    table: 'posts', label: 'Berita', singular: 'berita', wf: true, order: 'COALESCE(published_at, created_at) DESC, id DESC', slugFrom: 'title',
    publicPath: (r) => '/berita/' + r.slug,
    cols: [['title', 'Judul'], ['category', 'Kategori'], ['published_at', 'Tanggal']],
    fields: [
      { name: 'title', label: 'Judul', type: 'text', required: true, max: 160 },
      { name: 'category', label: 'Kategori', type: 'select', options: opt({ korporat: 'Korporat', kegiatan: 'Kegiatan', informasi: 'Informasi' }) },
      { name: 'excerpt', label: 'Ringkasan (untuk daftar dan SEO)', type: 'textarea', max: 300 },
      { name: 'body', label: 'Isi berita', type: 'richtext', required: true },
      { name: 'image', label: 'Foto utama', type: 'image' },
      { name: 'caption', label: 'Caption foto', type: 'text', max: 200 },
      { name: 'photo_credit', label: 'Kredit foto', type: 'text', max: 100 },
      { name: 'published_at', label: 'Tanggal berita', type: 'date' },
    ],
  },
  dokumen: {
    table: 'documents', label: 'Dokumen Unduhan', singular: 'dokumen', wf: true, order: 'id DESC',
    cols: [['title', 'Dokumen'], ['version', 'Versi'], ['gated', 'Via form'], ['downloads', 'Unduhan']],
    fields: [
      { name: 'title', label: 'Judul dokumen', type: 'text', required: true, max: 140 },
      { name: 'description', label: 'Deskripsi', type: 'textarea', max: 300 },
      { name: 'file', label: 'File (PDF/DOCX/PPTX)', type: 'file', required: true },
      { name: 'version', label: 'Versi', type: 'text', max: 40 },
      { name: 'lang', label: 'Bahasa', type: 'select', options: opt({ id: 'Indonesia', en: 'English' }) },
      { name: 'effective_date', label: 'Tanggal berlaku', type: 'date' },
      { name: 'gated', label: 'Unduh melalui form (tracking)', type: 'bool', help: 'Aktif untuk press kit/logo yang perlu dicatat peminatnya.' },
    ],
  },
  halaman: {
    table: 'pages', label: 'Halaman Statis', singular: 'halaman', wf: true, order: 'id ASC', slugFrom: 'title', noCreateSlug: false,
    publicPath: (r) => '/halaman/' + r.slug,
    cols: [['title', 'Halaman'], ['slug', 'Slug']],
    fields: [
      { name: 'title', label: 'Judul', type: 'text', required: true, max: 140 },
      { name: 'summary', label: 'Ringkasan', type: 'textarea', max: 300 },
      { name: 'body', label: 'Isi', type: 'richtext' },
      { name: 'meta_description', label: 'Meta description (SEO)', type: 'textarea', max: 170 },
    ],
  },
};

const STATUS = { draft: 'Draft', review: 'Menunggu review', published: 'Tayang' };
module.exports = { resources, STATUS, ICONS };
