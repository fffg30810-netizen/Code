// Smoke test headless (Playwright + Chromium con SwiftShader): carica la build, entra in
// "Anteprima 3D", evoca due boss, avvia il combattimento e verifica che ci sia un vincitore
// senza errori in console. Salva screenshot in tests/output/.
import { createServer } from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const outDir = process.env.SMOKE_OUT || join(root, 'tests', 'output');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.glb': 'model/gltf-binary', '.png': 'image/png' };

if (!existsSync(join(dist, 'index.html'))) { console.error('dist/ mancante: esegui `npm run build` prima del test'); process.exit(1); }
await mkdir(outDir, { recursive: true });

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = normalize(join(dist, p));
    if (!file.startsWith(dist)) { res.writeHead(403); return res.end(); }
    const s = await stat(file).catch(() => null);
    if (!s || !s.isFile()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(await readFile(file));
  } catch (e) { res.writeHead(500); res.end(String(e)); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/`;

const executablePath = process.env.CHROMIUM_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 1200 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console.error: ${m.text()} @ ${(m.location() && m.location().url) || ''}`); });

const fail = (msg) => { console.error(`✗ ${msg}`); errors.forEach((e) => console.error('  ', e)); process.exitCode = 1; };
const ok = (msg) => console.log(`✓ ${msg}`);

try {
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__elden && window.__elden.app.manifest, null, { timeout: 15000 });
  ok('pagina caricata e manifest letto');
  await page.screenshot({ path: join(outDir, '01-entry.png') });

  await page.click('#btn-preview');
  await page.waitForFunction(() => window.__elden.state().mode === 'preview', null, { timeout: 10000 });
  ok('modalità Anteprima 3D avviata');

  const seedFight = await page.evaluate(async () => {
    const { app, spawn } = window.__elden;
    app.setStyle('realistic');
    const a = await spawn('malenia', -0.28, 0.05, 0.3);
    const b = await spawn('radahn', 0.3, -0.05, 0.36);
    a.yaw = Math.PI / 2; b.yaw = -Math.PI / 2;
    return window.__elden.state();
  });
  if (seedFight.bosses.length !== 2) throw new Error('evocazione fallita');
  ok(`evocati: ${seedFight.bosses.map((b) => `${b.id}(${b.procedural ? 'procedurale' : 'glb'})`).join(', ')}`);
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(outDir, '02-placed.png') });

  // tap sul tavolo: deve evocare un terzo boss (percorso gesti)
  const before = seedFight.bosses.length;
  await page.evaluate(() => { window.__elden.app.setSelectedDef(window.__elden.defs().find((d) => d.id === 'margit')); });
  await page.mouse.click(450, 780);
  await page.waitForFunction((n) => window.__elden.state().bosses.length > n, before, { timeout: 8000 });
  ok('tap sul tavolo → evocazione via gesti');
  await page.waitForTimeout(1300);
  await page.screenshot({ path: join(outDir, '03-summoned.png') });

  // stile ologramma
  await page.evaluate(() => window.__elden.app.setStyle('spirit'));
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(outDir, '04-hologram.png') });
  await page.evaluate(() => window.__elden.app.setStyle('realistic'));

  // combattimento accelerato
  await page.evaluate(() => { window.__elden.app.setTimeScale(6); window.__elden.app.startFight(1234); });
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(outDir, '05-fight.png') });
  await page.waitForFunction(() => window.__elden.state().fight.winner !== null, null, { timeout: 90000 });
  const final = await page.evaluate(() => window.__elden.state());
  ok(`vincitore: ${final.fight.winner} dopo ${final.fight.elapsed.toFixed(1)} s (tempo di gioco)`);
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(outDir, '06-victory.png') });

  const alive = final.bosses.filter((b) => b.alive).length;
  if (alive !== 1) throw new Error(`attesi 1 vivo, trovati ${alive}`);
  if (!final.bosses.every((b) => Number.isFinite(b.pos[0]) && Number.isFinite(b.pos[2]))) throw new Error('posizioni non finite');

  // reset + rimozione
  await page.evaluate(() => { window.__elden.app.resetFight(); window.__elden.app.remove(window.__elden.app.bosses[0]); });
  const after = await page.evaluate(() => window.__elden.state());
  if (after.bosses.length !== final.bosses.length - 1) throw new Error('rimozione fallita');
  if (!after.bosses.every((b) => b.alive && b.hp > 0)) throw new Error('reset fallito');
  ok('reset e rimozione funzionano');

  // Modelli 3D reali: se la rete li raggiunge, verifica che vengano caricati davvero
  // (qui si salta quando il CDN non è raggiungibile, es. in ambienti isolati).
  const remoteIds = await page.evaluate(() => window.__elden.defs().filter((d) => /^https?:/.test(d.model || '')).map((d) => d.id));
  if (remoteIds.length) {
    const first = remoteIds[0];
    const loaded = await page.evaluate(async (id) => {
      const app = window.__elden.app;
      app.clearBosses();
      try { await window.__elden.spawn(id, 0, 0, 0.3); } catch (e) { return { error: String(e.message || e) }; }
      const b = app.bosses[0];
      return b ? { procedural: b.procedural, rigid: b.rigid, meshes: b.meshes.length } : { error: 'nessun boss' };
    }, first);
    if (loaded.error || loaded.procedural) {
      console.log(`· modelli remoti non raggiungibili (${loaded.error || 'fallback ai segnaposto'}): test saltato`);
    } else {
      ok(`modello 3D reale caricato: ${first} (${loaded.meshes} mesh, ${loaded.rigid ? 'animazione rigida' : 'clip proprie'})`);
      await page.waitForTimeout(700);
      await page.screenshot({ path: join(outDir, '09-modello-reale.png') });
    }
    await page.evaluate(() => window.__elden.app.clearBosses());
  }

  // percorso "mesh statica": animazione a corpo rigido (modelli generati da immagine)
  await page.evaluate(() => { window.__elden.app.clearBosses(); window.__elden.app.setTimeScale(4); });
  const rigid = await page.evaluate(async () => {
    const a = await window.__elden.spawnRigid('maliketh', -0.22, 0, 0.3);
    const b = await window.__elden.spawnRigid('godfrey', 0.24, 0, 0.32);
    a.yaw = Math.PI / 2; b.yaw = -Math.PI / 2;
    window.__elden.app.startFight(77);
    return window.__elden.state();
  });
  if (!rigid.bosses.every((b) => b.rigid)) throw new Error('animatore rigido non attivo');
  ok('modelli senza scheletro: animazione a corpo rigido attiva');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(outDir, '07-rigid.png') });
  await page.waitForFunction(() => window.__elden.state().fight.winner !== null, null, { timeout: 90000 });
  const rigidFinal = await page.evaluate(() => window.__elden.state());
  if (rigidFinal.bosses.filter((b) => b.alive).length !== 1) throw new Error('combattimento rigido senza vincitore unico');
  ok(`combattimento con mesh statiche: vince ${rigidFinal.fight.winner}`);
  await page.screenshot({ path: join(outDir, '08-rigid-victory.png') });

  await page.evaluate(() => window.__elden.app.stopMode());
  await page.waitForFunction(() => window.__elden.state().mode === null, null, { timeout: 5000 });
  ok('uscita dalla modalità');

  const relevant = errors.filter((e) => !/favicon|fonts\.g|net::ERR_|\/models\/.*\.glb/i.test(e));
  if (relevant.length) fail(`${relevant.length} errori in console`);
  else ok('nessun errore in console');
} catch (e) {
  fail(e.stack || e.message);
} finally {
  await browser.close();
  server.close();
}
