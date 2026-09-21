// Viewer 3D di Artù: scena, pelliccia a strati, occhi, baffi, controlli orbitali, viste, qualità,
// esportazione GLB e foto. La geometria è incorporata nella pagina (vedi geometry-pack.js).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { unpackMeshes } from './geometry-pack.js';
import { createFurMaterials, createLightUniforms } from './fur-material.js';
import { createEyeMaterial } from './eye-material.js';
import { HEAD, EYES, EYE_R, whiskerCurves } from './cat-shape.js';
import { bakeEyeTexture } from './eye-look.js';

const params = new URLSearchParams(location.search);
const SNAP = params.get('snap') === '1';
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && innerWidth < 900);
const QUALITY = { leggera: 12, media: 24, alta: 36, ultra: 56 };
const VIEWS = {
  fronte: { pos: [0, 19, 64], target: [0, 13.5, 2] },
  trequarti: { pos: [42, 25, 50], target: [0, 13.5, 1] },
  profilo: { pos: [64, 15, 3], target: [0, 13, 0] },
  retro: { pos: [0, 21, -64], target: [0, 13, 0] },
  alto: { pos: [0.5, 78, 6], target: [0, 10, 0] },
  muso: { pos: [4, 23.5, 25], target: [0, 21.3, 6] },
};

const $ = (id) => document.getElementById(id);
const setStatus = (msg) => { const el = $('status'); if (el) el.textContent = msg; };

function loadGeometry() {
  const b64 = $('artu-geo').textContent.trim();
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return unpackMeshes(bytes);
}

// ------------------------------------------------------------ scena
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: SNAP });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, +(params.get('pr') || 2)));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, 1, 800);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 10;
controls.maxDistance = 170;
controls.autoRotateSpeed = 0.9;
controls.autoRotate = !SNAP && !reduceMotion && params.get('auto') !== '0';

scene.add(new THREE.HemisphereLight(0xdfe6f0, 0x8a7a6a, 1.2));
const sun = new THREE.DirectionalLight(0xfff2e0, 2.2);
sun.position.set(30, 60, 45);
scene.add(sun);

const cat = new THREE.Group();
scene.add(cat);

const lights = createLightUniforms();
const mats = createFurMaterials(lights);
const meshes = loadGeometry();
const parts = [];
for (const m of meshes) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(m.positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(m.colors, 3, true));
  geo.setAttribute('aFur', new THREE.BufferAttribute(m.fur, 1));
  geo.setIndex(new THREE.BufferAttribute(m.indices, 1));
  const skin = new THREE.Mesh(geo, mats.skin);
  skin.frustumCulled = false;
  cat.add(skin);
  parts.push({ data: m, geo, skin, shells: null });
}

let layers = +(params.get('layers')) || (isMobile ? 16 : QUALITY.alta);
function buildShells(n) {
  layers = n;
  for (const p of parts) {
    if (p.shells) { cat.remove(p.shells); p.shells.geometry.dispose(); p.shells = null; }
    if (n <= 0) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', p.geo.attributes.position);
    g.setAttribute('normal', p.geo.attributes.normal);
    g.setAttribute('aColor', p.geo.attributes.aColor);
    g.setAttribute('aFur', p.geo.attributes.aFur);
    g.setIndex(p.geo.index);
    const layerArr = new Float32Array(n);
    for (let i = 0; i < n; i++) layerArr[i] = (i + 1) / n;
    g.setAttribute('aLayer', new THREE.InstancedBufferAttribute(layerArr, 1));
    const mesh = new THREE.InstancedMesh(g, mats.shell, n);
    mesh.frustumCulled = false;
    cat.add(mesh);
    p.shells = mesh;
  }
}
buildShells(layers);

// occhi
const eyeGeo = new THREE.SphereGeometry(EYE_R, 64, 40);
const eyeMat = createEyeMaterial(lights);
for (const e of EYES) {
  const eye = new THREE.Mesh(eyeGeo, eyeMat);
  eye.position.set(HEAD.x + e.x, HEAD.y + e.y, HEAD.z + e.z);
  eye.lookAt(eye.position.x + e.gx * 10, eye.position.y + e.gy * 10, eye.position.z + e.gz * 10);
  cat.add(eye);
}

// baffi
const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const whiskGeo = mergeGeometries(whiskerCurves().map((w) => new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(v3(w.p0), v3(w.p1), v3(w.p2)), 12, w.r, 5, false)));
whiskGeo.translate(HEAD.x, HEAD.y, HEAD.z);
const whiskMat = new THREE.MeshBasicMaterial({ color: 0xe4d9c8 });
cat.add(new THREE.Mesh(whiskGeo, whiskMat));

// ombra morbida a terra
function makeShadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(256, 256, 30, 256, 256, 250);
  g.addColorStop(0, 'rgba(45,28,15,0.5)');
  g.addColorStop(0.5, 'rgba(45,28,15,0.22)');
  g.addColorStop(1, 'rgba(45,28,15,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const ground = new THREE.Mesh(new THREE.PlaneGeometry(66, 66), new THREE.MeshBasicMaterial({ map: makeShadowTexture(), transparent: true, depthWrite: false, toneMapped: false }));
ground.rotation.x = -Math.PI / 2;
ground.position.set(2.0, 0.04, -1.5);
ground.scale.set(1.0, 1.12, 1);
scene.add(ground);

// ------------------------------------------------------------ camera e viste
let camAnim = null;
function setView(name, instant = false) {
  const v = VIEWS[name];
  if (!v) return;
  const to = v3(v.pos), tTo = v3(v.target);
  if (instant || reduceMotion || SNAP) {
    camera.position.copy(to); controls.target.copy(tTo); controls.update();
    return;
  }
  camAnim = { from: camera.position.clone(), to, tFrom: controls.target.clone(), tTo, t0: performance.now(), dur: 750 };
  document.querySelectorAll('[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
}
setView(params.get('view') || 'trequarti', true);

function resize() {
  const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

function render() { renderer.render(scene, camera); }
let autoPausedUntil = 0;
const breathing = !reduceMotion && !SNAP;
function frame(now) {
  if (!SNAP) requestAnimationFrame(frame);
  if (camAnim) {
    let k = Math.min(1, (now - camAnim.t0) / camAnim.dur);
    k = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    camera.position.lerpVectors(camAnim.from, camAnim.to, k);
    controls.target.lerpVectors(camAnim.tFrom, camAnim.tTo, k);
    if (k >= 1) camAnim = null;
  }
  controls.autoRotate = autoWanted && now > autoPausedUntil && !camAnim;
  controls.update();
  if (breathing) cat.scale.y = 1 + 0.004 * Math.sin(now * 0.0017);
  render();
}
let autoWanted = controls.autoRotate;
controls.addEventListener('start', () => { autoPausedUntil = Infinity; camAnim = null; });
controls.addEventListener('end', () => { autoPausedUntil = performance.now() + 3500; });

// ------------------------------------------------------------ esportazione
function bakedEyeTexture() {
  const w = 512, h = 256;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.putImageData(new ImageData(new Uint8ClampedArray(bakeEyeTexture(w, h).buffer), w, h), 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.flipY = false;
  return t;
}
const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
async function exportGLB() {
  const root = new THREE.Group();
  root.name = 'Artù';
  root.scale.setScalar(0.01);
  for (const p of parts) {
    const m = p.data, nv = m.positions.length / 3;
    const col = new Float32Array(nv * 3);
    for (let i = 0; i < nv * 3; i++) col[i] = srgbToLinear(m.colors[i] / 255);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(m.positions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(new THREE.BufferAttribute(m.indices, 1));
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }));
    mesh.name = m.name;
    root.add(mesh);
  }
  const eyeStd = new THREE.MeshStandardMaterial({ map: bakedEyeTexture(), roughness: 0.12, metalness: 0 });
  for (const e of EYES) {
    const eye = new THREE.Mesh(eyeGeo, eyeStd);
    eye.name = e.s < 0 ? 'occhio destro' : 'occhio sinistro';
    eye.position.set(HEAD.x + e.x, HEAD.y + e.y, HEAD.z + e.z);
    eye.lookAt(eye.position.x + e.gx * 10, eye.position.y + e.gy * 10, eye.position.z + e.gz * 10);
    root.add(eye);
  }
  const wm = new THREE.Mesh(whiskGeo, new THREE.MeshStandardMaterial({ color: 0xf1e8d6, roughness: 0.5 }));
  wm.name = 'baffi';
  root.add(wm);
  const exporter = new GLTFExporter();
  return exporter.parseAsync(root, { binary: true });
}
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}

// ------------------------------------------------------------ interfaccia
document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
const qSel = $('quality');
if (qSel) {
  const current = Object.entries(QUALITY).find(([, n]) => n === layers);
  if (current) qSel.value = current[0];
  qSel.addEventListener('change', () => buildShells(QUALITY[qSel.value] ?? 24));
}
const furlen = $('furlen');
if (furlen) furlen.addEventListener('input', () => { mats.uniforms.uFurScale.value = furlen.value / 100; });
const autorot = $('autorot');
if (autorot) {
  autorot.checked = controls.autoRotate;
  autorot.addEventListener('change', () => { autoWanted = autorot.checked; autoPausedUntil = 0; });
}
const btnGlb = $('btn-glb');
if (btnGlb) btnGlb.addEventListener('click', async () => {
  btnGlb.disabled = true; btnGlb.textContent = 'Preparo il GLB…';
  try { download(new Blob([await exportGLB()], { type: 'model/gltf-binary' }), 'artu-persiano.glb'); }
  finally { btnGlb.disabled = false; btnGlb.textContent = 'Scarica GLB'; }
});
const btnPng = $('btn-png');
if (btnPng) btnPng.addEventListener('click', () => {
  render();
  canvas.toBlob((blob) => blob && download(blob, 'artu-3d.png'), 'image/png');
});

// ------------------------------------------------------------ avvio
window.__artu = {
  isReady: false,
  setView, render,
  setLayers: buildShells,
  triangles: parts.reduce((s, p) => s + p.geo.index.count / 3, 0),
  exportGLB: async () => {
    const bytes = new Uint8Array(await exportGLB());
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  },
};
setStatus('Pettino il pelo…');
requestAnimationFrame(() => {
  render(); // compila gli shader
  const ov = $('overlay');
  if (ov) ov.hidden = true;
  window.__artu.isReady = true;
  if (!SNAP) requestAnimationFrame(frame);
});
