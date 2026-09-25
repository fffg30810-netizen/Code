// Checks that the GLSL ray tracer agrees with the JavaScript reference in
// src/physics.js (which tests/physics.test.mjs validates against analytic
// results). Needs Playwright with a Chromium build; WebGL runs on SwiftShader.
//
//   node tools/build.mjs && node tests/gpu-crosscheck.mjs
//
// The page's debug mode writes each ray's fate and sky direction into the
// half-float buffer instead of a colour; the same rays are then traced in JS.
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const require = createRequire(import.meta.url);
const K = require('../src/physics.js');
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  try {
    ({ chromium } = createRequire(path.join(process.execPath, '../../lib/node_modules/'))('playwright'));
  } catch {
    console.log('skipped: Playwright is not installed');
    process.exit(0);
  }
}

const page = pathToFileURL(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../index.html')).href;
const views = [
  { a: 0.9, r: 26, th: 84, ph: 0, yaw: 0, pitch: 0, name: 'outside, near the disk plane' },
  { a: 0.9, r: 1.0, th: 84, ph: 30, yaw: 0, pitch: 0, name: 'inside the horizon, looking inward' },
  { a: 0.9, r: 1.0, th: 60, ph: 0, yaw: 180, pitch: 10, name: 'inside the horizon, looking outward' },
  { a: 0.5, r: 6, th: 20, ph: 0, yaw: 20, pitch: -15, name: 'close, from high latitude' },
  { a: 0.0, r: 0.4, th: 84, ph: 0, yaw: 90, pitch: 0, name: 'Schwarzschild interior' },
];

const deg = Math.PI / 180;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let failures = 0;
for (const v of views) {
  const tab = await browser.newPage({ viewport: { width: 160, height: 100 } });
  await tab.goto(`${page}?test&debug=1&sky=64&q=high&a=${v.a}&r=${v.r}&th=${v.th}&ph=${v.ph}&yaw=${v.yaw}&pitch=${v.pitch}`);
  await tab.waitForFunction(() => window.__bhReady || window.__bhError, null, { timeout: 180000 });
  await tab.waitForTimeout(2500);
  const pix = [];
  for (let j = 3; j < 100; j += 12) for (let i = 5; i < 160; i += 16) pix.push([i, j]);
  const out = await tab.evaluate((p) => window.__bh.raw(p), pix);
  const cam = K.cameraFrame(v.a, v.r, v.th * deg, v.yaw * deg, v.pitch * deg);
  const errs = [];
  let fateMismatch = 0;
  out.px.forEach(([d0, d1, d2, tag], idx) => {
    const [i, j] = pix[idx];
    const x = (((i + 0.5) / out.w) * 2 - 1) * out.tan[0];
    const y = (((j + 0.5) / out.h) * 2 - 1) * out.tan[1];
    const t = K.trace(v.a, v.r, v.th * deg, K.pixelMomentum(cam, x, y), { k: 0.09, maxSteps: 380, ph: v.ph * deg });
    const fateGL = Math.floor(tag + 1e-4);
    if (fateGL === 3) return; // stopped on the opaque disk: no sky direction to compare
    const fateJS = t.fate === 'sky' ? 1 : t.fate === 'hole' ? 2 : 0;
    if (fateGL !== fateJS) { fateMismatch++; return; }
    if (fateJS !== 1) return;
    const L = Math.hypot(d0, d1, d2), g = [d0 / L, d1 / L, d2 / L], q = t.dir;
    const cr = Math.hypot(g[1] * q[2] - g[2] * q[1], g[2] * q[0] - g[0] * q[2], g[0] * q[1] - g[1] * q[0]);
    errs.push((Math.atan2(cr, g[0] * q[0] + g[1] * q[1] + g[2] * q[2]) * 180) / Math.PI);
  });
  errs.sort((p, q) => p - q);
  const median = errs.length ? errs[errs.length >> 1] : 0;
  // Float32 against float64: rays that graze the photon orbit may diverge, so judge the median.
  const ok = fateMismatch === 0 && median < 0.05;
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${v.name}: fate mismatches ${fateMismatch}, sky direction median ${median.toFixed(4)}°, worst ${(errs[errs.length - 1] ?? 0).toFixed(3)}° over ${errs.length} rays`);
  await tab.close();
}
await browser.close();
console.log(failures ? `\n${failures} view(s) FAILED` : '\nGLSL and JavaScript agree');
process.exit(failures ? 1 : 0);
