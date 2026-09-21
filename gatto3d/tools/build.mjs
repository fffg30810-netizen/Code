// Costruisce il viewer: bundle esbuild (IIFE) + geometria base64 dentro il template della pagina.
// Produce dist/index.html (documento completo, apribile anche da file://) e dist/artifact.html
// (frammento per la pubblicazione come artifact, senza pulsanti di download).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const result = await esbuild.build({
  entryPoints: [path.join(ROOT, 'src', 'main.js')],
  bundle: true, format: 'iife', minify: true, target: ['es2020'], write: false, legalComments: 'none', charset: 'utf8',
});
let js = result.outputFiles[0].text;
if (/<\/script/i.test(js)) throw new Error('Il bundle contiene "</script>": servirebbe un escape');
const geo = fs.readFileSync(path.join(ROOT, 'build', 'geometry.bin')).toString('base64');
const tpl = fs.readFileSync(path.join(ROOT, 'src', 'page.html'), 'utf8');
const render = (flavor) => tpl.replace('__FLAVOR__', flavor).replace('__GEO_B64__', () => geo).replace('__BUNDLE__', () => js);

fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
const artifact = render('artifact');
fs.writeFileSync(path.join(ROOT, 'dist', 'artifact.html'), artifact);

const local = render('local');
const [headPart, bodyPart] = local.split('<!--BODY-->');
const full = `<!doctype html>\n<html lang="it">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${headPart}</head>\n<body>${bodyPart}</body>\n</html>\n`;
fs.writeFileSync(path.join(ROOT, 'dist', 'index.html'), full);
console.log(`bundle ${(js.length / 1024).toFixed(0)} KB · geometria base64 ${(geo.length / 1048576).toFixed(2)} MB · index.html ${(full.length / 1048576).toFixed(2)} MB`);
