'use strict';
// Gambar responsif: varian WebP <nama>-<lebar>.webp dibuat dengan sharp (saat upload dan lewat scripts/make-variants.js).
// imgAttrs() hanya memakai varian yang benar-benar ada di disk, sehingga file lama tetap tampil normal.
const fs = require('fs');
const path = require('path');
const config = require('../config');

const WIDTHS = [480, 800, 1280, 1920];
const cache = new Map();
const resolve = (url) => (url.startsWith('/uploads/') ? path.join(config.uploadDir, path.basename(url)) : path.join(config.root, 'public', url.replace(/^\//, '')));

function info(url) {
  if (cache.has(url)) return cache.get(url);
  let out = { variants: [], w: 0, h: 0 };
  try {
    const file = resolve(url);
    const base = file.replace(/\.[a-z]+$/i, '');
    const meta = JSON.parse(fs.readFileSync(base + '.json', 'utf8'));
    out = { w: meta.w, h: meta.h, variants: WIDTHS.filter((w) => fs.existsSync(`${base}-${w}.webp`)) };
  } catch (e) { /* tanpa varian */ }
  if (process.env.NODE_ENV === 'production') cache.set(url, out);
  return out;
}
// Mengembalikan string atribut: src, srcset, sizes, width, height
function imgAttrs(url, sizes = '100vw') {
  const esc = (s) => String(s).replace(/"/g, '&quot;');
  const { variants, w, h } = info(url);
  const stem = url.replace(/\.[a-z]+$/i, '');
  let a = `src="${esc(url)}"`;
  if (variants.length) a += ` srcset="${variants.map((v) => `${esc(stem)}-${v}.webp ${v}w`).join(', ')}" sizes="${esc(sizes)}"`;
  if (w && h) a += ` width="${w}" height="${h}"`;
  return a;
}

// Membuat varian untuk satu file gambar (dipakai upload dan skrip). Aman dipanggil berulang.
async function makeVariants(file) {
  const sharp = require('sharp');
  const base = file.replace(/\.[a-z]+$/i, '');
  const meta = await sharp(file).metadata();
  for (const w of WIDTHS) {
    if (w >= meta.width && w !== WIDTHS[0]) continue;
    await sharp(file).rotate().resize({ width: Math.min(w, meta.width), withoutEnlargement: true }).webp({ quality: 76 }).toFile(`${base}-${w}.webp`);
  }
  fs.writeFileSync(base + '.json', JSON.stringify({ w: meta.width, h: meta.height }));
}
module.exports = { imgAttrs, makeVariants, WIDTHS };
