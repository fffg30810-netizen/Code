// Da che parte guardano i modelli? Si evoca un boss con yaw 0 e lo si inquadra
// dai quattro lati: quello in cui si vede la faccia è il fronte del modello.
import { createServer } from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { extname, join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const outDir = join(root, 'tests', 'output', 'fronte');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.webmanifest': 'application/manifest+json' };
await mkdir(outDir, { recursive: true });
const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = normalize(join(dist, p));
  const s = await stat(f).catch(() => null);
  if (!s || !s.isFile()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' });
  res.end(await readFile(f));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 560, height: 620 } });
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.__elden && window.__elden.app.manifest, null, { timeout: 20000 });
await page.click('#btn-preview');
await page.waitForFunction(() => window.__elden.state().mode === 'preview', null, { timeout: 15000 });

const boss = process.argv[2] || 'malenia';
await page.evaluate(async (id) => {
  const { app, spawn } = window.__elden;
  const b = await spawn(id, 0, 0, 0.4);
  b.yaw = 0;                       // nessuna rotazione: si guarda il modello com'è
  app.modes.preview.controls.enabled = false;
}, boss);

const ANGLES = [['+Z', 0], ['+X', Math.PI / 2], ['-Z', Math.PI], ['-X', -Math.PI / 2]];
for (const [label, a] of ANGLES) {
  await page.evaluate((ang) => {
    const app = window.__elden.app;
    const d = 0.75;
    app.camera.position.set(Math.sin(ang) * d, 0.3, Math.cos(ang) * d);
    app.camera.lookAt(0, 0.2, 0);
  }, a);
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(outDir, `${boss}-${label}.png`) });
  console.log('✓ camera su', label);
}
await browser.close();
server.close();
