'use strict';
// Membuat varian responsif (WebP) untuk gambar di public/img. Jalankan ulang bila menambah foto baru:
//   node scripts/make-variants.js [folder]
const fs = require('fs');
const path = require('path');
const { makeVariants } = require('../src/lib/img');
const dir = path.resolve(process.argv[2] || path.join(__dirname, '..', 'public', 'img'));
(async () => {
  for (const f of fs.readdirSync(dir).filter((x) => /\.(jpe?g|png)$/i.test(x) && !/-\d+\./.test(x) && !/^(logo|favicon|og-default)/.test(x))) {
    await makeVariants(path.join(dir, f)); console.log('varian:', f);
  }
})();
