// Verifica del rigging automatico: carica i modelli veri, controlla che diventino
// SkinnedMesh e li fotografa in pose diverse (riposo, passo, carica, colpo).
import { createServer } from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { extname, join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const outDir = join(root, 'tests', 'output', 'rig');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.webmanifest': 'application/manifest+json' };
await mkdir(outDir, { recursive: true });
const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = normalize(join(dist, p));
  const s = await stat(file).catch(() => null);
  if (!s || !s.isFile()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
  res.end(await readFile(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 760, height: 760 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });

await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.__elden && window.__elden.app.manifest, null, { timeout: 20000 });
await page.click('#btn-preview');
await page.waitForFunction(() => window.__elden.state().mode === 'preview', null, { timeout: 15000 });

const info = await page.evaluate(async () => {
  const { app, spawn } = window.__elden;
  const b = await spawn('malenia', 0, 0, 0.42);
  b.yaw = 0.45;
  // inquadratura ravvicinata sul boss
  const c = app.modes.preview.controls;
  c.target.set(0, 0.2, 0);
  app.camera.position.set(0.55, 0.32, 0.72);
  c.update();
  let skinned = 0, bones = 0;
  b.model.traverse((o) => { if (o.isSkinnedMesh) skinned++; if (o.isBone) bones++; });
  return { rigged: !!b.rig, skeletal: b.skeletal, skinned, bones, meshes: b.meshes.length };
});
console.log('rigging:', JSON.stringify(info));

const POSES = [
  ['riposo', { kind: 'loop', name: 'idle', t: 0.4 }],
  ['passo', { kind: 'loop', name: 'walk', t: 0.25 }],
  ['carica-fendente', { kind: 'move', name: 'slash', phase: 'windup', k: 0.95 }],
  ['colpo-fendente', { kind: 'move', name: 'slash', phase: 'active', k: 0.8 }],
  ['carica-sopra-testa', { kind: 'move', name: 'overhead', phase: 'windup', k: 0.95 }],
  ['colpo-sopra-testa', { kind: 'move', name: 'overhead', phase: 'active', k: 0.9 }],
  ['raffica', { kind: 'move', name: 'flurry', phase: 'active', k: 0.35 }],
  ['ruggito', { kind: 'oneshot', name: 'phase2', t: 0.6 }],
];
for (const [label, spec] of POSES) {
  // Il tempo dell'animazione viene forzato: qui il rendering è software e a
  // pochi fotogrammi al secondo non arriverebbe mai al fotogramma giusto.
  await page.evaluate((sp) => {
    const b = window.__elden.app.bosses[0];
    const an = b.animator;
    const W = 0.6, A = 0.4, R = 0.5;
    if (sp.kind === 'loop') { b.play(sp.name, { fade: 0 }); an.loop.time = sp.t * an.loop.anim.duration; }
    else if (sp.kind === 'oneshot') { b.play(sp.name, { loop: false, fade: 0 }); an.oneshot.time = sp.t; }
    else {
      an.playMove(sp.name, { windup: W, active: A, recovery: R, fade: 0 });
      an.move.time = sp.phase === 'windup' ? W * sp.k : sp.phase === 'active' ? W + A * sp.k : W + A + R * sp.k;
    }
    // Ogni update fa avanzare il tempo dell'animazione: per fotografare un istante
    // preciso lo si rimette al valore voluto prima di ogni passo di smorzamento.
    const freeze = sp.kind === 'move'
      ? (sp.phase === 'windup' ? W * sp.k : sp.phase === 'active' ? W + A * sp.k : W + A + R * sp.k)
      : null;
    for (let i = 0; i < 40; i++) {
      if (freeze != null && an.move) an.move.time = freeze;
      if (sp.kind === 'loop' && an.loop) an.loop.time = sp.t * an.loop.anim.duration;
      if (sp.kind === 'oneshot' && an.oneshot) an.oneshot.time = sp.t;
      an.update(0.03);
    }
    if (freeze != null && an.move) an.move.time = freeze;
    if (sp.kind === 'loop' && an.loop) an.loop.time = sp.t * an.loop.anim.duration;
    if (sp.kind === 'oneshot' && an.oneshot) an.oneshot.time = sp.t;
    an.update(0.0001);
    window.__freezeAnim = () => {
      if (freeze != null && an.move) an.move.time = freeze;
      if (sp.kind === 'loop' && an.loop) an.loop.time = sp.t * an.loop.anim.duration;
      if (sp.kind === 'oneshot' && an.oneshot) an.oneshot.time = sp.t;
    };
  }, spec);
  // l'app continua ad aggiornare: si ribadisce l'istante fino allo scatto
  for (let i = 0; i < 6; i++) { await page.evaluate(() => window.__freezeAnim && window.__freezeAnim()); await page.waitForTimeout(120); }
  await page.evaluate(() => window.__freezeAnim && window.__freezeAnim());
  await page.screenshot({ path: join(outDir, `${label}.png`) });
  console.log('✓', label);
}

const real = errors.filter((e) => !/fonts\.g|favicon|CERT/.test(e));
console.log(real.length ? `✗ errori: ${real.slice(0, 3).join(' | ')}` : '✓ nessun errore');
await browser.close();
server.close();
