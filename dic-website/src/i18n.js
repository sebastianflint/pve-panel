'use strict';
// Dua bahasa: Indonesia (root) dan English (/en). Teks sumber di kode adalah Bahasa Indonesia;
// kamus EN memetakan teks sumber ke terjemahannya. Istilah English tetap tidak diterjemahkan pada teks Indonesia.
const EN = {
  // navigasi dan umum
  'Beranda': 'Home', 'Tentang Kami': 'About Us', 'Lini Bisnis': 'Business Lines', 'Berita': 'News', 'Kontak': 'Contact',
  'Unduhan': 'Downloads', 'Hubungi Kami': 'Contact Us', 'Cari di website': 'Search site', 'Cari': 'Search',
  'Lewati ke konten': 'Skip to content', 'Navigasi utama': 'Main navigation', 'Buka menu': 'Open menu', 'Tutup menu': 'Close menu',
  'Bahasa': 'Language', 'Pengadaan Barang dan Jasa': 'Procurement of Goods and Services',
  'Mode pratinjau: konten yang belum tayang ikut ditampilkan.': 'Preview mode: unpublished content is shown.', 'Kembali ke CMS': 'Back to CMS',
  'Sorotan': 'Highlights', 'Slide': 'Slide', 'Jeda slide': 'Pause slide', 'Putar slide': 'Play slide',
  'Tautan': 'Links', 'Peta Situs': 'Sitemap', 'Kebijakan Privasi': 'Privacy Policy', 'Hak cipta dilindungi.': 'All rights reserved.',
  'adalah penyedia layanan pengadaan barang dan jasa untuk sektor pertambangan, konstruksi, dan perdagangan umum.': 'is a provider of procurement of goods and services for the mining, construction, and general trading sectors.',
  'Cabang:': 'Branches:', 'Persetujuan cookie': 'Cookie consent', 'Selengkapnya': 'Learn more', 'Setuju': 'Accept', 'Tolak': 'Decline',
  'Semua': 'All', 'Halaman': 'Pages', 'Breadcrumb': 'Breadcrumb',
  // beranda
  'Sektor yang kami layani': 'Sectors we serve', 'Tentang DIC': 'About DIC', 'Mitra pengadaan barang dan jasa yang terpercaya': 'A trusted partner for procurement of goods and services',
  'Kenali Kami': 'Get to Know Us', 'Unduh Company Profile': 'Download Company Profile', 'Keunggulan': 'Strengths', 'Mengapa bermitra dengan DIC': 'Why partner with DIC',
  'Layanan untuk kebutuhan industri Anda': 'Services for your industrial needs', 'Semua lini bisnis': 'All business lines',
  'Rekam Jejak': 'Track Record', 'Proyek yang pernah kami kerjakan': 'Projects we have delivered', 'Informasi terbaru': 'Latest updates', 'Semua berita': 'All news',
  'Belum ada berita.': 'No news yet.', 'Butuh mitra pengadaan, logistik, atau konstruksi?': 'Need a partner for procurement, logistics, or construction?',
  'Sampaikan kebutuhan Anda. Tim kami menindaklanjuti dalam': 'Tell us what you need. Our team follows up within',
  'Tim lapangan DIC dengan perlengkapan K3': 'DIC field team in safety (K3) gear',
  // tentang
  'Profil Perusahaan': 'Company Profile', 'Visi': 'Vision', 'Misi': 'Mission', 'Roadmap Bisnis': 'Business Roadmap', 'Perjalanan dan rencana pertumbuhan': 'Our journey and growth plan',
  'Jejak langkah dan pencapaian': 'Milestones and achievements', 'Data per': 'Data as of', 'Kantor': 'Offices', 'Lokasi kami': 'Our locations',
  'Terealisasi': 'Achieved', 'Rencana': 'Planned', 'Kantor Pusat': 'Head Office', 'Cabang': 'Branch', 'Kapal dan muatan karung di pelabuhan': 'Vessel and bagged cargo at the port',
  // lini bisnis
  'Empat lini utama yang saling melengkapi dalam satu mitra.': 'Four core business lines that complement each other in a single partner.',
  'Informasi lini bisnis segera tersedia.': 'Business line information is coming soon.', 'Lini Bisnis Tambahan': 'Additional Business Lines',
  'Selain lini utama, kami aktif berkontribusi dalam': 'Beyond our core lines, we also actively contribute to', 'Cakupan layanan': 'Scope of services',
  'Tanya tentang layanan ini': 'Ask about this service', 'Lini bisnis lainnya': 'Other business lines', 'Rencana ekspansi': 'Planned expansion', 'Melalui mitra': 'Through partners',
  // berita, pencarian
  'Belum ada berita pada kategori ini.': 'No news in this category yet.', 'Berita lainnya': 'More news', 'Semua berita ': 'All news',
  'Daftar berita': 'News list', 'Lini utama': 'Core business lines', 'Kantor dan kontak langsung': 'Offices and direct contact',
  'Pencarian': 'Search', 'Kata kunci': 'Keyword', 'Cari berita, lini bisnis...': 'Search news, business lines...', 'Masukkan minimal 2 karakter.': 'Enter at least 2 characters.',
  'Tidak ada hasil untuk': 'No results for', 'hasil untuk': 'results for', 'Foto:': 'Photo:',
  // unduhan
  'Dokumen resmi perusahaan.': 'Official company documents.', 'Belum ada dokumen yang tersedia.': 'No documents are available yet.', 'Unduh': 'Download', 'Unduh dokumen': 'Download document',
  'Versi': 'Version', 'berlaku': 'effective', 'Isi data berikut untuk mengunduh dokumen. Data hanya dipakai sesuai': 'Please fill in the details below to download the document. Your data is used only in accordance with the',
  'Nama': 'Name', 'Instansi': 'Organization', 'Email': 'Email', 'Saya menyetujui pemrosesan data sesuai Kebijakan Privasi.': 'I agree to the processing of my data in accordance with the Privacy Policy.',
  // kontak
  'Sampaikan kebutuhan atau pertanyaan Anda. Kami menindaklanjuti dalam': 'Send us your needs or questions. We follow up within',
  'Pesan terkirim.': 'Message sent.', 'Nama *': 'Name *', 'Instansi *': 'Organization *', 'Email *': 'Email *', 'Telepon (opsional)': 'Phone (optional)', 'Keperluan *': 'Purpose *',
  'Pilih keperluan': 'Select a purpose', 'Pesan *': 'Message *', 'Kirim Pesan': 'Send Message', 'Lihat di peta': 'View on map', 'Kontak langsung': 'Direct contact',
  'Saya menyetujui data ini diproses sesuai': 'I agree to this data being processed in accordance with the', 'Peta kantor pusat': 'Head office map', 'Website': 'Website',
  // error
  'Kembali ke Beranda': 'Back to Home', 'Halaman tidak ditemukan': 'Page not found', 'Halaman yang Anda cari tidak tersedia atau telah dipindahkan.': 'The page you are looking for is unavailable or has been moved.',
  'Terjadi kesalahan': 'Something went wrong', 'Terjadi kesalahan pada server. Silakan coba lagi.': 'A server error occurred. Please try again.',
  'Terlalu banyak permintaan': 'Too many requests', 'Anda telah mengirim terlalu banyak pesan. Silakan coba lagi nanti atau hubungi kami melalui email/telepon.': 'You have sent too many messages. Please try again later or contact us by email or phone.',
  'Sesi tidak valid': 'Invalid session', 'Token keamanan tidak valid atau kedaluwarsa. Muat ulang halaman dan coba lagi.': 'The security token is invalid or has expired. Reload the page and try again.',
  // validasi form
  'Nama wajib diisi.': 'Name is required.', 'Instansi wajib diisi.': 'Organization is required.', 'Email tidak valid.': 'Invalid email address.', 'Format telepon tidak valid.': 'Invalid phone number format.',
  'Pilih kategori keperluan.': 'Select a purpose.', 'Pesan minimal 10 karakter.': 'The message must be at least 10 characters.', 'Persetujuan pemrosesan data diperlukan.': 'Consent to data processing is required.',
  'Formulir terkirim terlalu cepat. Silakan coba lagi.': 'The form was submitted too quickly. Please try again.', 'Persetujuan diperlukan.': 'Consent is required.',
  // kategori
  'Korporat': 'Corporate', 'Kegiatan': 'Activities', 'Informasi': 'Information',
  'Kerja sama bisnis': 'Business partnership', 'Informasi lini bisnis': 'Business line information', 'Media / Humas': 'Media / Public Relations', 'Lainnya': 'Other',
  // meta
  'Lini bisnis PT Dahana Investama Corp: konstruksi, angkutan dan logistik, persewaan dan jasa pendukung, serta perdagangan.': 'Business lines of PT Dahana Investama Corp: construction, transportation and logistics, rental and support services, and trading.',
  'Berita dan informasi terbaru PT Dahana Investama Corp.': 'Latest news and updates from PT Dahana Investama Corp.',
  'Hubungi PT Dahana Investama Corp untuk kerja sama bisnis dan informasi lini bisnis.': 'Contact PT Dahana Investama Corp for business partnerships and business line information.',
  // email
  'Pesan Anda telah kami terima - PT Dahana Investama Corp': 'We have received your message - PT Dahana Investama Corp',
  'Yth.': 'Dear', 'Hormat kami,': 'Kind regards,',
};

const PATHS = { tentang: 'about', 'lini-bisnis': 'business-lines', berita: 'news', kontak: 'contact', unduhan: 'downloads', unduh: 'download', cari: 'search', 'kebijakan-privasi': 'privacy-policy', halaman: 'page' };
const PATHS_REV = Object.fromEntries(Object.entries(PATHS).map(([k, v]) => [v, k]));
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

// '/tentang?x=1' -> '/en/about?x=1'
function toEn(p) { const m = /^\/([^/?#]*)(.*)$/.exec(p); if (!m) return '/en'; const seg = PATHS[m[1]] || m[1]; return '/en' + (seg || m[2] ? '/' + seg : '') + m[2]; }
// '/about/x' (tanpa prefix /en) -> '/tentang/x'
function enToId(p) { const m = /^\/([^/?#]*)(.*)$/.exec(p); if (!m) return '/'; return '/' + (PATHS_REV[m[1]] || m[1]) + m[2]; }

function locals(lang) {
  const en = lang === 'en';
  const __ = (s) => (en ? (EN[s] ?? s) : s);
  return {
    lang, __,
    u: (p) => (en ? toEn(p === '/' ? '/' : p) : p),
    // pilih kolom bahasa: row.title_en bila ada, kembali ke row.title
    c: (row, f) => (en && row && row[f + '_en'] && String(row[f + '_en']).trim() ? row[f + '_en'] : row ? row[f] : ''),
    dateL: (v) => {
      if (!v) return '';
      const s = String(v); const d = new Date(/[T ]/.test(s) ? s.replace(' ', 'T') + (s.endsWith('Z') ? '' : 'Z') : s + 'T00:00:00Z');
      if (isNaN(d)) return s;
      const M = en ? MONTHS_EN : MONTHS_ID;
      return en ? `${M[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}` : `${d.getUTCDate()} ${M[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
    },
  };
}
const langOf = (req) => (/^\/en(\/|$|\?)/.test(req.originalUrl) ? 'en' : 'id');
module.exports = { EN, locals, toEn, enToId, PATHS, PATHS_REV, langOf };
