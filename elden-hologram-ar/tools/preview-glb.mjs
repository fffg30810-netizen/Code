#!/usr/bin/env node
// Renderizza un GLB da 3 angolazioni in un PNG di contatto, per controllare a colpo d'occhio
// com'è venuto un modello. Funziona in locale e nella sandbox di generazione.
//   node tools/preview-glb.mjs <file.glb|url> [out.png] [--size 420]
import { createServer } from 'node:http';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const sizeArg = process.argv.indexOf('--size');
const SIZE = sizeArg > -1 ? Number(process.argv[sizeArg + 1]) : 420;
const input = args[0];
const out = args[1] || 'preview.png';
if (!input) { console.error('Uso: node tools/preview-glb.mjs <file.glb|url> [out.png]'); process.exit(1); }

const isUrl = /^https?:\/\//.test(input);
const dir = isUrl ? await mkdtemp(join(tmpdir(), 'glb-')) : dirname(resolve(input));
const name = isUrl ? 'model.glb' : basename(input);
if (isUrl) {
  const res = await fetch(input);
  if (!res.ok) { console.error(`download fallito: ${res.status}`); process.exit(1); }
  await writeFile(join(dir, name), Buffer.from(await res.arrayBuffer()));
} else if (!existsSync(input)) { console.error(`file non trovato: ${input}`); process.exit(1); }

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;background:#14120e;overflow:hidden}canvas{display:block}
</style></head><body><script type="importmap">
{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.module.js",
"three/addons/":"https://cdn.jsdelivr.net/npm/three@0.186.0/examples/jsm/"}}
</script><script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
const W=${SIZE}, VIEWS=[0, Math.PI*0.5, Math.PI];
const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setSize(W*VIEWS.length, W*1.3, false);
renderer.setScissorTest(true);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x14120e);
const pmrem=new THREE.PMREMGenerator(renderer);
scene.environment=pmrem.fromScene(new RoomEnvironment(),0.04).texture;
scene.add(new THREE.HemisphereLight(0xfff3e0,0x3a2e1e,0.8));
const sun=new THREE.DirectionalLight(0xffffff,2.2); sun.position.set(2,4,3); scene.add(sun);
const cam=new THREE.PerspectiveCamera(35, 1/1.3, 0.01, 100);
const info={};
new GLTFLoader().load('./${name}', (gltf)=>{
  const root=gltf.scene;
  const box=new THREE.Box3().setFromObject(root);
  const size=box.getSize(new THREE.Vector3()), c=box.getCenter(new THREE.Vector3());
  const h=Math.max(size.y,1e-3);
  root.scale.setScalar(1/h);
  root.position.set(-c.x/h, -box.min.y/h, -c.z/h);
  scene.add(root);
  let tris=0, meshes=0, skinned=0, mats=new Set(), texes=new Set();
  root.traverse(o=>{ if(o.isMesh){ meshes++; if(o.isSkinnedMesh) skinned++;
    const g=o.geometry; tris += g.index? g.index.count/3 : g.attributes.position.count/3;
    (Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{ if(!m) return; mats.add(m.uuid);
      ['map','normalMap','roughnessMap','metalnessMap','emissiveMap'].forEach(k=>{ if(m[k]) texes.add(m[k].uuid); }); });
  }});
  Object.assign(info,{ triangles:Math.round(tris), meshes, skinned, materials:mats.size, textures:texes.size,
    animations:gltf.animations.map(a=>a.name), sizeRatio:{x:+(size.x/h).toFixed(2), y:1, z:+(size.z/h).toFixed(2)} });
  const grid=new THREE.GridHelper(2,20,0xd9b654,0x4a3f22);
  grid.material.transparent=true; grid.material.opacity=0.35; scene.add(grid);
  VIEWS.forEach((a,i)=>{
    const d=2.0;
    cam.position.set(Math.sin(a)*d, 0.75, Math.cos(a)*d);
    cam.lookAt(0,0.5,0);
    renderer.setViewport(i*W,0,W,W*1.3);
    renderer.setScissor(i*W,0,W,W*1.3);
    renderer.render(scene,cam);
  });
  window.__info=info; window.__done=true;
}, undefined, (e)=>{ window.__error=String(e); window.__done=true; });
</script></body></html>`;
await writeFile(join(dir, '__preview.html'), html);

const server = createServer(async (req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\//, '') || '__preview.html';
  try {
    const buf = await readFile(join(dir, p));
    res.writeHead(200, { 'Content-Type': p.endsWith('.html') ? 'text/html' : 'model/gltf-binary' });
    res.end(buf);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/__preview.html`;

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined),
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: SIZE * 3, height: Math.round(SIZE * 1.3) } });
page.on('pageerror', (e) => console.error('pageerror:', e.message));
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.__done === true, null, { timeout: 90000 });
const err = await page.evaluate(() => window.__error);
if (err) { console.error('errore di caricamento:', err); process.exitCode = 1; }
else console.log(JSON.stringify(await page.evaluate(() => window.__info)));
await page.screenshot({ path: out });
await browser.close();
server.close();
console.log(`preview: ${out}`);
