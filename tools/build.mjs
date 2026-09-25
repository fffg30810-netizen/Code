// Build the single-file page from src/.
//   node tools/build.mjs                 -> index.html (standalone document)
//   node tools/build.mjs --artifact out  -> also writes the body-only version for claude.ai Artifacts
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const js = ['src/physics.js', 'src/shaders.js', 'src/app.js'].map(read).join('\n');
if (js.includes('</script')) throw new Error('inline script would terminate early');
// Replacer functions: the sources contain "$'" and friends, which String.replace would expand.
const page = read('src/template.html')
  .replace('/*@STYLE@*/', () => read('src/style.css'))
  .replace('<!--@SCIENCE@-->', () => read('src/science.html'))
  .replace('/*@SCRIPTS@*/', () => js);

const split = page.indexOf('<div id="app">');
const head = page.slice(0, split).trim();
const body = page.slice(split).trim();
const description = 'Buco nero di Kerr ray-tracciato in tempo reale nel browser: lente gravitazionale, anello fotonico, disco con Doppler e redshift, e un tuffo fino all’orizzonte interno.';

const full = `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="theme-color" content="#000000">
<meta name="description" content="${description}">
${head}
</head>
<body>
${body}
</body>
</html>
`;
fs.writeFileSync(path.join(root, 'index.html'), full);
console.log(`index.html: ${(full.length / 1024).toFixed(1)} KiB`);

const i = process.argv.indexOf('--artifact');
if (i > 0 && process.argv[i + 1]) {
  fs.writeFileSync(process.argv[i + 1], page);
  console.log(`${process.argv[i + 1]}: ${(page.length / 1024).toFixed(1)} KiB`);
}
