'use strict';
// Pemeriksaan sintaks cepat: semua file JS di src/ dan scripts/, serta kompilasi semua template EJS.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ejs = require('ejs');
const root = path.join(__dirname, '..');
let bad = 0;
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
for (const f of [...walk(path.join(root, 'src')), ...walk(path.join(root, 'scripts')), ...walk(path.join(root, 'public/js'))].filter((x) => x.endsWith('.js'))) {
  try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); } catch (e) { bad++; console.error('JS  ', path.relative(root, f), String(e.stderr).split('\n')[0]); }
}
for (const f of walk(path.join(root, 'views')).filter((x) => x.endsWith('.ejs'))) {
  try { ejs.compile(fs.readFileSync(f, 'utf8'), { filename: f }); } catch (e) { bad++; console.error('EJS ', path.relative(root, f), e.message.split('\n')[0]); }
}
console.log(bad ? `${bad} file bermasalah` : 'Sintaks JS dan template EJS OK');
process.exit(bad ? 1 : 0);
