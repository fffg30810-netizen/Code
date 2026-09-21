// Screenshot del viewer da più angolazioni con Chromium headless (rendering software) ed
// esportazione del GLB dal browser, per verificare il risultato senza aprire la pagina a mano.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, process.env.SNAP_DIR || 'screenshots');
const views = (process.env.VIEWS || 'trequarti,fronte,profilo,retro,alto,muso').split(',');
const layers = +(process.env.LAYERS || 24);
const width = +(process.env.W || 1100), height = +(process.env.H || 800);
fs.mkdirSync(OUT, { recursive: true });

const { server, port } = await startServer(path.join(ROOT, 'dist'));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1, colorScheme: process.env.DARK ? 'dark' : 'light', ignoreHTTPSErrors: true });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[browser]', m.type(), m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
const t0 = Date.now();
await page.goto(`http://127.0.0.1:${port}/index.html?snap=1&layers=${layers}&pr=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__artu && window.__artu.isReady, null, { timeout: 300000 });
console.log(`pronto in ${((Date.now() - t0) / 1000).toFixed(1)} s, triangoli base: ${await page.evaluate(() => window.__artu.triangles)}`);
for (const v of views) {
  const t = Date.now();
  await page.evaluate((v) => { window.__artu.setView(v, true); window.__artu.render(); }, v);
  await page.screenshot({ path: path.join(OUT, `${v}.png`) });
  console.log(`${v}.png (${((Date.now() - t) / 1000).toFixed(1)} s)`);
}
if (process.env.EXPORT_GLB) {
  const b64 = await page.evaluate(() => window.__artu.exportGLB());
  fs.writeFileSync(process.env.EXPORT_GLB, Buffer.from(b64, 'base64'));
  console.log(`GLB dal browser: ${process.env.EXPORT_GLB}`);
}
await browser.close();
server.close();
