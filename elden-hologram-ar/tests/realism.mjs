// Verifica le aggiunte di realismo: ombra di contatto, scia dell'arma,
// contraccolpo, atterramento, luce presa dalla stanza e innesto "fotocamera"
// sui materiali. Salva screenshot in tests/output/realism-*.png.
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
const page = await browser.newPage({ viewport: { width: 1000, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console.error: ${m.text()} @ ${(m.location() && m.location().url) || ''}`); });

const fail = (msg) => { console.error(`✗ ${msg}`); errors.forEach((e) => console.error('  ', e)); process.exitCode = 1; };
const ok = (msg) => console.log(`✓ ${msg}`);

try {
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__elden && window.__elden.app.manifest, null, { timeout: 15000 });
  await page.click('#btn-preview');
  await page.waitForFunction(() => window.__elden.state().mode === 'preview', null, { timeout: 10000 });

  // Due boss come mesh statiche: è il percorso dei modelli generati da immagine.
  await page.evaluate(async () => {
    const e = window.__elden;
    e.app.setTimeScale(1);
    await e.spawnRigid('malenia', -0.22, 0, 0.3);
    await e.spawnRigid('radahn', 0.22, 0, 0.3);
  });
  await page.waitForTimeout(600);

  // --- 1) ombra di contatto -------------------------------------------------
  const shadow = await page.evaluate(() => window.__elden.app.bosses.map((b) => ({
    id: b.def.id,
    hasShadow: !!(b.contact && b.contact.mesh.parent === b.root),
    visible: b.contact.mesh.visible,
    y: b.contact.mesh.position.y,
    scale: b.contact.mesh.scale.x,
    opacity: b.contact.mesh.material.opacity,
  })));
  if (!shadow.length || !shadow.every((s) => s.hasShadow && s.visible && s.y < 0.01 && s.scale > 0.1 && s.opacity > 0.05)) {
    throw new Error(`ombra di contatto assente o malposta: ${JSON.stringify(shadow)}`);
  }
  ok(`ombra di contatto sotto ${shadow.length} boss (raggio ${shadow[0].scale.toFixed(2)}, opacità ${shadow[0].opacity.toFixed(2)})`);

  // l'ombra si allarga e si schiarisce quando il corpo salta
  const lift = await page.evaluate(async () => {
    const b = window.__elden.app.bosses[0];
    const before = { s: b.contact.mesh.scale.x, o: b.contact.mesh.material.opacity };
    b.contact.update(0.5, 1);
    return { before, after: { s: b.contact.mesh.scale.x, o: b.contact.mesh.material.opacity } };
  });
  if (!(lift.after.s > lift.before.s && lift.after.o < lift.before.o)) {
    throw new Error(`l'ombra non reagisce al salto: ${JSON.stringify(lift)}`);
  }
  ok('ombra che si allarga e schiarisce quando il boss si stacca da terra');

  // --- 2) materiali "ripresi dalla fotocamera" -------------------------------
  const match = await page.evaluate(() => {
    const b = window.__elden.app.bosses[0];
    const mats = [];
    for (const m of b.originalMaterials.values()) (Array.isArray(m) ? m : [m]).forEach((x) => x && mats.push(!!x.userData.cameraMatch));
    const before = b.matchUniforms.uGrain.value;
    window.__elden.app.applyRoomLight({ ambient: new window.__elden.THREE.Color(1, 0.9, 0.8), luminance: 0.05, exposure: 0.6, sunDir: new window.__elden.THREE.Vector3(0.3, 1, 0.4), environment: null });
    return { patched: mats, dark: b.matchUniforms.uGrain.value, before, shadowStrength: window.__elden.app.shadowStrength, hemi: window.__elden.app.hemi.intensity };
  });
  if (!match.patched.length || !match.patched.every(Boolean)) throw new Error('innesto fotocamera non applicato ai materiali');
  if (!(match.dark > match.before)) throw new Error(`grana non aumentata al buio: ${match.before} → ${match.dark}`);
  if (!(match.shadowStrength < 0.6)) throw new Error(`ombra non attenuata in stanza buia: ${match.shadowStrength}`);
  ok(`materiali agganciati alla fotocamera (grana ${match.before.toFixed(3)} → ${match.dark.toFixed(3)} al buio, ombra ${match.shadowStrength.toFixed(2)})`);
  await page.evaluate(() => window.__elden.app.applyRoomLight(null));

  // --- 3) scia dell'arma ------------------------------------------------------
  const trail = await page.evaluate(async () => {
    const e = window.__elden;
    // il container renderizza a pochi fps: si concede tempo di parete generoso e
    // si rilancia la mossa finché la finestra attiva non viene osservata
    const seen = { drawn: 0, samples: 0, visible: false, frames: 0, emitted: 0 };
    const t0 = performance.now();
    let nextForce = 0;
    while (performance.now() - t0 < 25000) {
      const b = e.app.bosses.find((x) => x.def.id === 'malenia');
      if (performance.now() > nextForce && b.fight.state !== 'active' && b.trail.samples.length === 0) {
        try { e.forceMove('malenia', 'cleave'); } catch { /* già in corso */ }
        nextForce = performance.now() + 4000;
      }
      await new Promise((r) => requestAnimationFrame(r));
      seen.frames++;
      if (b.trail.emitting) seen.emitted++;
      seen.drawn = Math.max(seen.drawn, b.trail.mesh.geometry.drawRange.count);
      seen.samples = Math.max(seen.samples, b.trail.samples.length);
      seen.visible = seen.visible || b.trail.mesh.visible;
      if (seen.drawn > 0 && seen.visible) break;
    }
    return seen;
  });
  if (!(trail.drawn > 0 && trail.samples >= 2 && trail.visible)) throw new Error(`scia dell'arma non disegnata: ${JSON.stringify(trail)}`);
  ok(`scia dell'arma: ${trail.samples} campioni, ${trail.drawn} indici disegnati`);
  await page.screenshot({ path: join(outDir, 'realism-01-trail.png') });
  // le prove seguenti vogliono i corpi fermi: il combattimento li sposterebbe
  await page.evaluate(() => window.__elden.app.stopFight());
  await page.waitForTimeout(200);

  // --- 4) contraccolpo --------------------------------------------------------
  const knock = await page.evaluate(async () => {
    const e = window.__elden;
    const t = e.app.bosses.find((x) => x.def.id === 'radahn');
    const before = t.root.position.clone();
    t.applyImpulse(1, 0, 0.6 * t.height);
    const v0 = Math.hypot(t.vel.x, t.vel.z);
    const t0 = performance.now();
    while (performance.now() - t0 < 1500) await new Promise((r) => requestAnimationFrame(r));
    return { moved: t.root.position.distanceTo(before), v0, vEnd: Math.hypot(t.vel.x, t.vel.z) };
  });
  if (!(knock.moved > 0.005)) throw new Error(`il contraccolpo non sposta il corpo: ${JSON.stringify(knock)}`);
  if (!(knock.vEnd < knock.v0 * 0.2)) throw new Error(`il contraccolpo non si smorza: ${JSON.stringify(knock)}`);
  ok(`contraccolpo: spinta ${knock.v0.toFixed(2)} m/s, spostamento ${(knock.moved * 100).toFixed(1)} cm, poi si ferma`);

  // --- 5) atterramento e rialzata ---------------------------------------------
  const down = await page.evaluate(async () => {
    const e = window.__elden;
    const v = e.app.bosses.find((x) => x.def.id === 'radahn');
    const a = e.app.bosses.find((x) => x.def.id === 'malenia');
    const hasAnim = v.hasAnimation('knockdown');
    v.hitFrom(a.root.position, 'knockdown');
    v.fight.state = 'down';
    v.fight.downTimer = 2.1;
    const poses = [];
    const t0 = performance.now();
    while (performance.now() - t0 < 2600) {
      await new Promise((r) => requestAnimationFrame(r));
      poses.push({ y: v.animator._pose.y, pitch: v.animator._pose.pitch });
    }
    const lowest = Math.min(...poses.map((p) => p.y));
    const maxTilt = Math.max(...poses.map((p) => Math.abs(p.pitch)));
    return { hasAnim, lowest, maxTilt, last: poses[poses.length - 1], state: v.fight.state, frames: poses.length };
  });
  if (!down.hasAnim) throw new Error('animazione di atterramento assente');
  // il perno è ai piedi: coricarsi è quasi tutta rotazione, più un piccolo assestamento
  if (!(down.lowest < -0.02 && down.maxTilt > 1.2)) throw new Error(`il corpo non va a terra: ${JSON.stringify(down)}`);
  ok(`atterramento: il corpo ruota di ${(down.maxTilt * 57.3).toFixed(0)}° e si assesta di ${down.lowest.toFixed(3)}`);
  await page.screenshot({ path: join(outDir, 'realism-02-knockdown.png') });

  // --- 6) reazione orientata al colpo ------------------------------------------
  const dirs = await page.evaluate(() => {
    const e = window.__elden;
    const THREE = e.THREE;
    const v = e.app.bosses.find((x) => x.def.id === 'radahn');
    v.yaw = 0;                       // guarda verso +Z
    const out = {};
    v.hitFrom(new THREE.Vector3(v.root.position.x, 0, v.root.position.z + 1), null);  // colpo da davanti
    out.front = { ...v.animator.hitDir };
    v.hitFrom(new THREE.Vector3(v.root.position.x, 0, v.root.position.z - 1), null);  // da dietro
    out.back = { ...v.animator.hitDir };
    v.hitFrom(new THREE.Vector3(v.root.position.x + 1, 0, v.root.position.z), null);  // da destra
    out.right = { ...v.animator.hitDir };
    return out;
  });
  if (!(dirs.front.f < -0.9 && dirs.back.f > 0.9 && dirs.right.r < -0.9)) {
    throw new Error(`direzione del colpo sbagliata: ${JSON.stringify(dirs)}`);
  }
  ok('reazione orientata: davanti, dietro e di lato danno tre direzioni distinte');

  // --- 7) passi ------------------------------------------------------------------
  const steps = await page.evaluate(async () => {
    const b = window.__elden.app.bosses[0];
    b.play('walk', { fade: 0 });
    let count = 0;
    const t0 = performance.now();
    while (performance.now() - t0 < 2500) {
      await new Promise((r) => requestAnimationFrame(r));
      if (b.animator.footfall) count++;
    }
    return count;
  });
  if (!(steps > 0)) throw new Error('nessun passo rilevato durante la camminata');
  ok(`passi rilevati durante la camminata: ${steps}`);

  // --- 8) varietà dei colpi ---------------------------------------------------------
  const variety = await page.evaluate(() => {
    const e = window.__elden;
    const b = e.app.bosses.find((x) => x.def.id === 'malenia');
    const other = e.app.bosses.find((x) => x !== b);
    const f = e.app.fight;
    if (!f.active) f.start(e.app.bosses, 3);
    const move = b.moveset.moves.find((m) => m.id === 'cleave');
    const motions = {}, mirrors = {}, windups = [];
    for (let i = 0; i < 40; i++) {
      f._startMove(b, other, move);
      motions[b.fight.motion] = (motions[b.fight.motion] || 0) + 1;
      mirrors[String(b.fight.mirror)] = (mirrors[String(b.fight.mirror)] || 0) + 1;
      windups.push(+b.fight.timing.windup.toFixed(5));
    }
    const sounds = ['swing', 'hit', 'impactHeavy', 'guard'].filter((n) => typeof e.app.sfx[n] === 'function');
    let threw = null;
    try { e.app.sfx.hit(1.3, 'blunt'); e.app.sfx.swing('spin', 1.4); } catch (err) { threw = err.message; }
    return {
      motions, mirrors, uniqueWindups: new Set(windups).size,
      impact: move.impact, variants: move.variants, sounds, threw,
      nominalWindup: move.windup, minW: Math.min(...windups), maxW: Math.max(...windups),
    };
  });
  const motionKinds = Object.keys(variety.motions);
  if (motionKinds.length < 3) throw new Error(`poche varianti di movimento: ${JSON.stringify(variety.motions)}`);
  if (!(variety.mirrors.true > 0 && variety.mirrors.false > 0)) throw new Error(`specchiatura non usata: ${JSON.stringify(variety.mirrors)}`);
  if (variety.uniqueWindups < 30) throw new Error(`tempi ripetuti: solo ${variety.uniqueWindups} preparazioni diverse su 40`);
  if (variety.impact !== 'slash') throw new Error(`famiglia d'impatto mancante: ${variety.impact}`);
  if (variety.threw) throw new Error(`suoni non chiamabili: ${variety.threw}`);
  ok(`varietà dei colpi: ${motionKinds.length} archi diversi (${motionKinds.join(', ')}), specchiati ${variety.mirrors.true}/40, preparazione ${variety.minW.toFixed(2)}–${variety.maxW.toFixed(2)} s (nominale ${variety.nominalWindup})`);

  const families = await page.evaluate(() => {
    const e = window.__elden;
    const out = {};
    for (const b of e.app.bosses) {
      for (const m of b.moveset.moves.concat(b.moveset.phase2)) {
        if (m.kind === 'evade') continue;
        out[`${b.def.id}:${m.id}`] = m.impact;
      }
    }
    return out;
  });
  const missing = Object.entries(families).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) throw new Error(`mosse senza famiglia d'impatto: ${missing.join(', ')}`);
  const kinds = [...new Set(Object.values(families))];
  ok(`famiglie d'impatto assegnate a ${Object.keys(families).length} mosse: ${kinds.join(', ')}`);
  // --- 9) colpi trattenuti e finte ---------------------------------------------------
  const tempo = await page.evaluate(() => {
    const e = window.__elden;
    const f = e.app.fight;
    const b = e.app.bosses.find((x) => x.def.id === 'malenia');
    const other = e.app.bosses.find((x) => x !== b);
    if (!f.active) f.start(e.app.bosses, 5);
    const move = b.moveset.moves.find((m) => m.kind === 'melee');

    // colpi trattenuti: qualche esecuzione su tante, non tutte e non nessuna
    const holds = [];
    for (let i = 0; i < 80; i++) { f._startMove(b, other, move); holds.push(!!b.fight.timing.hold); }
    const held = holds.filter(Boolean).length;
    const heldWindup = (() => {
      for (let i = 0; i < 200; i++) { f._startMove(b, other, move); if (b.fight.timing.hold) return b.fight.timing.windup; }
      return 0;
    })();

    // finte: con la probabilità a 1 la preparazione deve spegnersi a metà
    const savedHook = f.hooks.onFeint;
    const savedChance = b.moveset.traits.feintChance;
    b.moveset.traits.feintChance = 1;
    let feints = 0;
    f.hooks.onFeint = () => { feints++; };
    let armed = 0;
    for (let i = 0; i < 40 && !armed; i++) { f._startMove(b, other, move); armed = b.fight.feintAt; }
    const firstMotion = b.fight.motion;
    const alive = e.app.bosses.filter((x) => x.alive);
    for (let i = 0; i < 60 && !feints; i++) f._updateFighter(b, alive, 0.03);
    const afterMotion = b.fight.motion;
    f.hooks.onFeint = savedHook;
    b.moveset.traits.feintChance = savedChance;
    return { held, total: holds.length, heldWindup, nominal: move.windup, armed, feints, firstMotion, afterMotion, state: b.fight.state };
  });
  if (!(tempo.held > 4 && tempo.held < tempo.total * 0.6)) throw new Error(`colpi trattenuti fuori misura: ${tempo.held}/${tempo.total}`);
  if (!(tempo.heldWindup > tempo.nominal * 1.3)) throw new Error(`il colpo trattenuto non dura di più: ${tempo.heldWindup} vs ${tempo.nominal}`);
  ok(`colpi trattenuti: ${tempo.held}/${tempo.total} esecuzioni, preparazione ${tempo.heldWindup.toFixed(2)} s contro ${tempo.nominal} s`);
  if (!tempo.armed) throw new Error('finta mai innescata');
  if (!tempo.feints) throw new Error(`finta innescata ma mai eseguita (stato ${tempo.state})`);
  ok(`finte: preparazione interrotta a ${tempo.armed.toFixed(2)} s e colpo cambiato (${tempo.firstMotion} → ${tempo.afterMotion})`);
  await page.evaluate(() => window.__elden.app.stopFight());

  // --- 10) tutto insieme: uno scontro intero ---------------------------------------
  await page.evaluate(() => {
    const e = window.__elden;
    e.app.resetFight();
    e.app.setTimeScale(2);
    e.app.startFight(7);
  });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: join(outDir, 'realism-03-fight.png') });
  await page.waitForFunction(() => window.__elden.state().fight.winner !== null, null, { timeout: 120000 });
  const final = await page.evaluate(() => window.__elden.state());
  if (final.bosses.filter((b) => b.alive).length !== 1) throw new Error('scontro senza vincitore unico');
  ok(`scontro completo con tutte le aggiunte: vince ${final.fight.winner}`);
  await page.screenshot({ path: join(outDir, 'realism-04-victory.png') });

  const relevant = errors.filter((e) => !/favicon|fonts\.g|net::ERR_|\/models\/.*\.glb/i.test(e));
  if (relevant.length) fail(`${relevant.length} errori in console`);
  else ok('nessun errore in console');
} catch (e) {
  fail(e.stack || e.message);
} finally {
  await browser.close();
  server.close();
}
