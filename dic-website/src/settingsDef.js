'use strict';
// Pengaturan situs yang dapat diubah Admin. `group` mengelompokkan form.
const defs = [
  { group: 'Identitas', name: 'site_name', label: 'Nama perusahaan', type: 'text', default: 'PT Dahana Investama Corp' },
  { group: 'Identitas', name: 'site_short', label: 'Singkatan merek', type: 'text', default: 'DIC' },
  { group: 'Identitas', name: 'tagline', label: 'Kalimat posisi (hero, meta description)', type: 'textarea', default: 'Mitra pengadaan barang dan jasa untuk sektor pertambangan, konstruksi, dan industri, dengan keahlian khusus pada logistik dan pengelolaan bahan peledak.', help: 'Usulan SINUX, wajib disetujui Direksi (A#4).' },
  { group: 'Identitas', name: 'about_intro', label: 'Deskripsi perusahaan', type: 'textarea', rows: 5, default: 'PT Dahana Investama Corp. adalah penyedia layanan pengadaan barang dan jasa yang berdedikasi untuk memberikan solusi terbaik, terpercaya, dan inovatif. Kami hadir untuk mendorong kemandirian dan menciptakan nilai keberlanjutan bagi setiap klien serta mitra strategis kami.' },
  { group: 'Identitas', name: 'sectors', label: 'Sektor yang dilayani (satu per baris)', type: 'textarea', default: 'Pertambangan\nKonstruksi\nPerdagangan Umum' },
  { group: 'Identitas', name: 'visi', label: 'Visi', type: 'textarea', default: 'Menjadi perusahaan penyedia layanan pengadaan barang dan jasa terbaik dan terpercaya dalam memberikan solusi menuju kemandirian dan keberlanjutan.' },
  { group: 'Identitas', name: 'misi', label: 'Misi (satu butir per baris)', type: 'textarea', rows: 8, default: 'Memberikan layanan profesional dan berkualitas tinggi yang berfokus pada kebutuhan klien dan hasil yang berkelanjutan.\nMengembangkan solusi inovatif yang mendorong kemandirian individu, komunitas, dan organisasi.\nMenjalin kemitraan strategis dengan berbagai pihak untuk memperluas dampak positif layanan kami.\nMeningkatkan kapasitas internal melalui pelatihan berkelanjutan dan pengembangan sumber daya manusia yang unggul.\nMengutamakan integritas, tanggung jawab sosial, dan keberlanjutan dalam setiap aspek operasional perusahaan.' },
  { group: 'Identitas', name: 'roadmap_intro', label: 'Pengantar roadmap', type: 'text', default: 'Kami memiliki rencana pertumbuhan yang terukur untuk menjadi pemimpin pasar di masa depan.' },
  { group: 'Kontak publik', name: 'public_email', label: 'Email resmi (tayang)', type: 'text', default: 'dahanainvestama.dic@gmail.com', help: 'Ganti ke alamat @dic.id setelah mailbox siap (A#27).' },
  { group: 'Kontak publik', name: 'public_phone', label: 'Telepon / WhatsApp bisnis', type: 'text', default: '+62 812-1928-786' },
  { group: 'Kontak publik', name: 'whatsapp_number', label: 'Nomor WhatsApp (format internasional tanpa +)', type: 'text', default: '628121928786' },
  { group: 'Kontak publik', name: 'service_hours', label: 'Jam layanan', type: 'text', default: 'Senin - Jumat, 08.00 - 17.00 WIB' },
  { group: 'Kontak publik', name: 'response_target', label: 'Target respons', type: 'text', default: '2 hari kerja' },
  { group: 'Kontak publik', name: 'map_embed_url', label: 'URL embed Google Maps (kantor pusat)', type: 'text', help: 'Hanya URL yang diawali https://www.google.com/maps/embed' },
  { group: 'Form dan email', name: 'notify_to', label: 'Email tujuan inquiry', type: 'text', help: 'Boleh beberapa alamat dipisah koma.' },
  { group: 'Form dan email', name: 'notify_cc', label: 'CC inquiry', type: 'text' },
  { group: 'Form dan email', name: 'autoresponse_enabled', label: 'Kirim autoresponse ke pengirim', type: 'bool', default: '1' },
  { group: 'Form dan email', name: 'autoresponse_body', label: 'Isi autoresponse', type: 'textarea', default: 'Terima kasih telah menghubungi PT Dahana Investama Corp. Pesan Anda sudah kami terima dan akan ditindaklanjuti oleh tim kami dalam 2 hari kerja.' },
  { group: 'Form dan email', name: 'success_message', label: 'Pesan sukses di halaman', type: 'textarea', default: 'Terima kasih. Pesan Anda sudah kami terima dan akan ditindaklanjuti dalam 2 hari kerja.' },
  { group: 'Form dan email', name: 'retention_months', label: 'Masa simpan pesan masuk (bulan)', type: 'number', default: '12', help: 'Pesan lebih lama dihapus otomatis. Kebijakan final mengikuti persetujuan DIC/Legal (A#10).' },
  { group: 'Pengukuran dan SEO', name: 'ga_id', label: 'Google Analytics Measurement ID', type: 'text', help: 'Contoh G-XXXXXXXXXX. Dimuat hanya setelah pengunjung menyetujui cookie.' },
  { group: 'Pengukuran dan SEO', name: 'gsc_verification', label: 'Kode verifikasi Search Console', type: 'text' },
  { group: 'Pengukuran dan SEO', name: 'launch_ready', label: 'Situs siap tayang (izinkan mesin pencari mengindeks)', type: 'bool', default: '0', help: 'Biarkan nonaktif sampai seluruh konten dan izin publikasi disetujui DIC. Saat nonaktif situs mengirim noindex.' },
  { group: 'Halaman Privasi', name: 'cookie_notice', label: 'Teks banner cookie', type: 'textarea', default: 'Kami memakai cookie analitik untuk memahami penggunaan website. Anda dapat menolak tanpa mengurangi akses ke konten.' },
];

// Pengaturan yang tampil dua bahasa: sisipkan versi English (name_en) tepat setelah versi Indonesia.
const EN_DEFAULT = {
  tagline: 'A partner for procurement of goods and services in the mining, construction, and industrial sectors, with specialist expertise in logistics and explosives management.',
  about_intro: 'PT Dahana Investama Corp. is a provider of procurement of goods and services, dedicated to delivering the best, most trusted, and innovative solutions. We are here to foster self-reliance and create sustainable value for every client and strategic partner.',
  sectors: 'Mining\nConstruction\nGeneral Trading',
  visi: 'To be the best and most trusted provider of procurement of goods and services, delivering solutions towards self-reliance and sustainability.',
  misi: 'Deliver professional, high-quality services focused on client needs and sustainable results.\nDevelop innovative solutions that foster the self-reliance of individuals, communities, and organizations.\nBuild strategic partnerships with various parties to widen the positive impact of our services.\nStrengthen internal capacity through continuous training and the development of outstanding human resources.\nUphold integrity, social responsibility, and sustainability in every aspect of the company operations.',
  roadmap_intro: 'We have a measured growth plan to become a market leader in the future.',
  service_hours: 'Monday - Friday, 08:00 - 17:00 WIB (UTC+7)', response_target: '2 business days',
  autoresponse_body: 'Thank you for contacting PT Dahana Investama Corp. We have received your message and our team will follow up within 2 business days.',
  success_message: 'Thank you. We have received your message and will follow up within 2 business days.',
  cookie_notice: 'We use analytics cookies to understand how the website is used. You may decline without affecting your access to the content.',
};
const out = [];
for (const d of defs) {
  out.push(d);
  if (EN_DEFAULT[d.name] !== undefined) out.push({ ...d, name: d.name + '_en', label: d.label.replace(/\s*\(.*\)$/, '') + ' (English)', group: d.group, default: EN_DEFAULT[d.name], help: undefined });
}
module.exports = out;
