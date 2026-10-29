'use strict';
// Terjemahan English untuk konten seed. Hanya mengisi kolom *_en yang masih kosong (tidak menimpa suntingan CMS).
const { db } = require('./db');

const EN = {
  hero_slides: { key: 'sort', rows: {
    1: { title: 'A Procurement Partner for Industry', subtitle: 'A partner for procurement of goods and services in the mining, construction, and industrial sectors, with specialist expertise in logistics and explosives management.', cta_label: 'View Business Lines' },
    2: { title: 'Construction and Industrial Infrastructure', subtitle: 'Infrastructure projects delivered to high standards, from civil works to mining infrastructure.', cta_label: 'Construction' },
    3: { title: 'Integrated Transportation and Logistics', subtitle: 'Transportation of general and special cargo by land, sea, and air.', cta_label: 'Transportation and Logistics' },
  } },
  highlights: { key: 'sort', rows: {
    1: { title: 'Explosives storage facility track record', body: 'Delivery of explosives (handak) storage facilities across three regencies in South Sumatra in 2024.' },
    2: { title: 'Special and hazardous cargo transportation', body: 'Transportation capability for explosives and non-explosives cargo (hazardous logistics) for industrial needs.' },
    3: { title: 'Integrated services', body: 'Procurement, equipment rental, logistics, and construction in one partner, simplifying project coordination.' },
  } },
  business_lines: { key: 'slug', rows: {
    konstruksi: { title: 'Construction', summary: 'Infrastructure projects delivered to high standards.', items: 'Civil works (roads, bridges, and more)\nResidential and office buildings\nOil, gas, and mining infrastructure', body: '<p>We deliver infrastructure projects to high standards for industrial and office needs, as well as for the energy and mining sectors.</p>' },
    'angkutan-logistik': { title: 'Transportation and Logistics', summary: 'Transportation of general and special cargo with broad reach.', items: 'Land: rail and motorized transport for special and hazardous cargo\nSea: domestic and international transport (general, special, and traditional shipping cargo)\nAir: scheduled and non-scheduled commercial cargo', body: '<p>Transportation of general and special cargo by land, sea, and air.</p>' },
    'persewaan-jasa-pendukung': { title: 'Rental and Support Services', summary: 'Asset and resource management solutions.', items: 'Rental of mining support equipment\nCar, bus, and truck leasing\nManpower supply (outsourcing), security, and industrial cleaning services\nTravel agency and integrated facility management', body: '<p>Asset and resource management solutions that support industrial and mining operations.</p>' },
    perdagangan: { title: 'Trading', summary: 'Wholesale and retail trade for a wide range of industrial needs.', items: 'Raw and auxiliary production materials\nLaboratory, pharmaceutical, and medical equipment\nMetals, metal ores, and chemical materials and goods (including hazardous materials)\nMotor vehicle repair and maintenance', body: '<p>We provide wholesale and retail trade for a wide range of industrial needs.</p>' },
    'pertambangan-penggalian': { title: 'Mining and Quarrying', summary: 'Coal mining, precious metal ores, and quarrying of construction materials.', items: 'Coal mining\nPrecious metal ores\nQuarrying of construction materials (limestone, gravel, and sirtu)' },
    'industri-pengolahan': { title: 'Manufacturing', summary: 'Specialization in the explosives industry.', items: 'Explosives industry' },
  } },
  roadmap: { key: 'year', rows: {
    2021: { title: 'Business Exploration and Company Foundation' }, 2022: { title: 'Development of Equipment Rental and Supporting Production Material Business' },
    2023: { title: 'Development of Explosives Transportation Services' }, 2024: { title: 'Development of Land Management Business (Subang)' },
    2025: { title: 'Development of the Explosives (Handak) Business Entity' }, 2026: { title: 'Expansion into Drilling Services' }, 2027: { title: 'Expansion into Loading & Hauling Services' },
  } },
  projects: { key: 'slug', rows: { 'gudang-handak-sumatera-selatan-2024': {
    title: 'Provision of Explosives (Handak) Storage Facilities', service: 'Storage facility provision', location_public: 'Musi Rawas, Muara Enim, and Musi Banyuasin, South Sumatra',
    summary: 'Delivery of explosives storage facilities in three regencies in South Sumatra in 2024, in support of a national strategic project.' } } },
  offices: { key: 'name', rows: { 'Kantor Pusat': { name: 'Head Office' }, 'Kantor Cabang Subang': { name: 'Subang Branch Office' }, 'Kantor Cabang Samarinda': { name: 'Samarinda Branch Office' } } },
  documents: { key: 'id', rows: { 1: { title: 'PT Dahana Investama Corp Company Profile', description: 'Company profile, vision and mission, business roadmap, and business lines.' } } },
  posts: { key: 'slug', rows: {
    'mengenal-pt-dahana-investama-corp': { title: 'Get to Know PT Dahana Investama Corp', excerpt: 'A provider of procurement of goods and services for the mining, construction, and general trading sectors.', caption: 'The DIC field team.',
      body: '<p>PT Dahana Investama Corp (DIC) is a provider of procurement of goods and services dedicated to delivering trusted and innovative solutions. We are here to foster self-reliance and create sustainable value for every client and strategic partner.</p><p>Upholding professionalism and integrity, DIC continues to widen its services across industrial sectors, from mining and construction to general trading.</p>' },
    'empat-lini-bisnis-utama-dic': { title: 'DIC Four Core Business Lines', excerpt: 'Construction, transportation and logistics, rental and support services, and trading.', caption: 'Loading and unloading activity.',
      body: '<p>DIC operates four core business lines: <strong>construction</strong>, <strong>transportation and logistics</strong>, <strong>rental and support services</strong>, and <strong>trading</strong>. Each line is designed to complement the others so that clients can work with a single partner for a wide range of project needs.</p><p>Full details of each line are available on the Business Lines page.</p>' },
  } },
  pages: { key: 'slug', rows: { 'kebijakan-privasi': {
    title: 'Privacy Policy', summary: 'How PT Dahana Investama Corp processes the personal data you provide through this website.', meta_description: 'Privacy policy of the dic.id website',
    body: `<p><strong>Note:</strong> this text is an initial draft and must be reviewed and approved by DIC Legal before the website is declared ready for launch.</p>
<h2>Data we collect</h2><p>Through the contact form we ask for your name, organization, email address, phone number (optional), purpose category, and message. For documents downloaded through a form, we ask for your name, organization, and email.</p>
<h2>How we use data</h2><p>Data is used only to respond to your enquiry, follow up on business information requests, and send an automatic acknowledgement. Data is not sold or shared with third parties beyond what is needed to handle that request.</p>
<h2>Storage and security</h2><p>Messages are stored in the content management system with access limited to designated staff and are automatically deleted after 12 months. We apply reasonable technical safeguards to protect this data.</p>
<h2>Cookies and analytics</h2><p>The website uses session cookies required for forms to work. Analytics cookies are set only after you consent through the cookie banner, and you may decline without affecting your access to the content.</p>
<h2>Your rights</h2><p>You may request access to, correction of, or deletion of your personal data in accordance with applicable personal data protection regulations in Indonesia by contacting us through the Contact page.</p>
<h2>Changes to this policy</h2><p>This policy may be updated from time to time. The latest version is always shown on this page.</p>` } } },
};

module.exports = function seedEnglish() {
  let n = 0;
  for (const [table, def] of Object.entries(EN)) {
    for (const [k, vals] of Object.entries(def.rows)) {
      for (const [col, v] of Object.entries(vals)) {
        n += db.prepare(`UPDATE ${table} SET ${col}_en=? WHERE ${def.key}=? AND (${col}_en IS NULL OR ${col}_en='')`).run(v, k).changes;
      }
    }
  }
  return n;
};
