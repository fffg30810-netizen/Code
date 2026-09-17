// Dimostrazione visiva delle mosse: evoca i tre boss, forza una mossa alla volta
// e fotografa il momento in cui il colpo è attivo. Serve a verificare che
// telegrafi, scie ed effetti speciali si vedano davvero.
import { createServer } from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const outDir = join(root, 'tests', 'output', 'mosse');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.webmanifest': 'application/manifest+json' };
await mkdir(outDir, { recursive: true });

const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = normalize(join(dist, p));
  if (!file.startsWith(dist)) { res.writeHead(403); return res.end(); }
  const s = await stat(file).catch(() => null);
  if (!s || !s.isFile()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
  res.end(await readFile(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 140)); });

await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.__elden && window.__elden.app.manifest, null, { timeout: 20000 });
await page.click('#btn-preview');
await page.waitForFunction(() => window.__elden.state().mode === 'preview', null, { timeout: 15000 });

await page.evaluate(async () => {
  const { app, spawn } = window.__elden;
  const a = await spawn('malenia', -0.3, 0, 0.3);
  const b = await spawn('radahn', 0.3, 0, 0.36);
  const c = await spawn('margit', 0, 0.3, 0.3);
  a.yaw = Math.PI / 2; b.yaw = -Math.PI / 2; c.yaw = Math.PI;
  app.setTimeScale(1);
  app.fight.start(app.bosses, 7);
  app.fight.active = false;              // niente IA: comandiamo noi le mosse
  app.bosses.forEach((x) => { x.fight.state = 'idle'; x.play('idle'); });
});

const SHOTS = [
  ['malenia', 'waterfowl', 'Danza dei Trampolieri'],
  ['malenia', 'aeonia', 'Scarlet Aeonia'],
  ['radahn', 'meteor', 'Grido del Chiamastelle'],
  ['radahn', 'gravityPull', 'Attrazione gravitazionale'],
  ['radahn', 'doubleSweep', 'Doppia spazzata'],
  ['margit', 'goldenHammer', 'Martello di luce'],
  ['margit', 'daggerThrow', 'Pugnale dorato'],
  ['margit', 'leapStrike', 'Balzo del presagio'],
];

for (const [boss, move, label] of SHOTS) {
  const info = await page.evaluate(([b, m]) => {
    const app = window.__elden.app;
    app.fight.active = true;
    const r = window.__elden.forceMove(b, m);
    app.fight.active = false;
    return r;
  }, [boss, move]);
  // avanza manualmente il combattimento fino a metà finestra attiva
  const until = info.windup + info.active * 0.92;   // vicino all'impatto
  await page.evaluate((sec) => new Promise((res) => {
    const app = window.__elden.app;
    app.fight.active = true;
    const t0 = performance.now();
    const tick = () => {
      if ((performance.now() - t0) / 1000 >= sec) { app.fight.active = false; res(); }
      else requestAnimationFrame(tick);
    };
    tick();
  }), until);
  await page.screenshot({ path: join(outDir, `${boss}-${move}.png`) });
  console.log(`✓ ${label.padEnd(30)} (${boss})`);
  await page.evaluate(() => {
    const app = window.__elden.app;
    app.bosses.forEach((b) => { b.fight.state = 'idle'; b.fight.move = null; b.play('idle'); b.hp = b.maxHp; b.hpBar.set(1); b.alive = true; });
  });
  await page.waitForTimeout(500);
}

const real = errors.filter((e) => !/fonts\.g|favicon/.test(e));
console.log(real.length ? `✗ ${real.length} errori: ${real.slice(0,3).join(' | ')}` : '✓ nessun errore in console');
await browser.close();
server.close();
