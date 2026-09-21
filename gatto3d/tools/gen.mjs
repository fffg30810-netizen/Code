// Genera la geometria di Artù: marching cubes su due domini (testa fine, corpo), attributi
// (pelo, colore), pacchetto binario per il viewer e file GLB esportabile.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { marchingCubes, laplacianSmooth, sdfNormals } from '../src/marching.js';
import { headMeshSDF, bodyMeshSDF, HEAD_BOX, BODY_BOX, furLength, catColor, HEAD, EYES, EYE_R, whiskerCurves } from '../src/cat-shape.js';
import { packMeshes } from '../src/geometry-pack.js';
import { bakeEyeTexture } from '../src/eye-look.js';
import { GLBBuilder } from './glb-writer.mjs';
import { encodePNG } from './png.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HEAD_CELL = +(process.env.HEAD_CELL || 0.13);
const BODY_CELL = +(process.env.BODY_CELL || 0.26);

function buildMesh(name, sdf, box, cell, smoothIter, smoothFactor) {
  const t0 = Date.now();
  const mc = marchingCubes(sdf, box.min, box.max, cell);
  const positions = smoothIter > 0 ? laplacianSmooth(mc.positions, mc.indices, smoothIter, smoothFactor) : mc.positions;
  const normals = sdfNormals(sdf, positions, cell * 0.5);
  const nv = positions.length / 3;
  const colors = new Float32Array(nv * 3);
  const fur = new Float32Array(nv);
  for (let i = 0; i < nv; i++) {
    const x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
    const c = catColor(x, y, z, normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]);
    colors[i * 3] = c[0]; colors[i * 3 + 1] = c[1]; colors[i * 3 + 2] = c[2];
    fur[i] = furLength(x, y, z);
  }
  console.log(`${name}: ${nv} vertici, ${mc.indices.length / 3} triangoli, cella ${cell} cm, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  return { name, positions, normals, colors, fur, indices: mc.indices };
}

const head = buildMesh('testa', headMeshSDF, HEAD_BOX, HEAD_CELL, 1, 0.3);
const body = buildMesh('corpo', bodyMeshSDF, BODY_BOX, BODY_CELL, 2, 0.4);

// ---- pacchetto per il viewer
fs.mkdirSync(path.join(ROOT, 'build'), { recursive: true });
const packed = packMeshes([head, body]);
fs.writeFileSync(path.join(ROOT, 'build', 'geometry.bin'), packed);
console.log(`geometry.bin: ${(packed.length / 1048576).toFixed(2)} MB`);

// ---- GLB
const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const glb = new GLBBuilder('Artù 3D — modello procedurale');
const furMat = glb.addMaterial({ name: 'pelo', pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 0.95 } });
const meshNodes = [];
for (const m of [head, body]) {
  const nv = m.positions.length / 3;
  const col = new Uint8Array(nv * 4);
  for (let i = 0; i < nv; i++) {
    col[i * 4] = Math.round(srgbToLinear(m.colors[i * 3]) * 255);
    col[i * 4 + 1] = Math.round(srgbToLinear(m.colors[i * 3 + 1]) * 255);
    col[i * 4 + 2] = Math.round(srgbToLinear(m.colors[i * 3 + 2]) * 255);
    col[i * 4 + 3] = 255;
  }
  const mesh = glb.addMesh(m.name, { positions: m.positions, normals: m.normals, colors: col, indices: m.indices }, furMat);
  meshNodes.push(glb.addNode(m.name, { mesh, root: false }));
}
// occhi con texture
const tex = glb.addTexturePNG(encodePNG(512, 256, bakeEyeTexture(512, 256)));
const eyeMat = glb.addMaterial({ name: 'occhio', pbrMetallicRoughness: { baseColorTexture: { index: tex }, metallicFactor: 0, roughnessFactor: 0.12 } });
const sphere = new THREE.SphereGeometry(EYE_R, 64, 40);
const eyeMesh = glb.addMesh('occhio', {
  positions: sphere.attributes.position.array, normals: sphere.attributes.normal.array,
  uvs: sphere.attributes.uv.array, indices: new Uint16Array(sphere.index.array),
}, eyeMat);
for (const e of EYES) {
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(e.gx, e.gy, e.gz));
  meshNodes.push(glb.addNode(e.s < 0 ? 'occhio destro' : 'occhio sinistro', {
    mesh: eyeMesh, translation: [HEAD.x + e.x, HEAD.y + e.y, HEAD.z + e.z], rotation: [q.x, q.y, q.z, q.w], root: false,
  }));
}
// baffi
const tubes = whiskerCurves().map((w) => {
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(...w.p0), new THREE.Vector3(...w.p1), new THREE.Vector3(...w.p2));
  return new THREE.TubeGeometry(curve, 10, w.r, 5, false);
});
const whisk = mergeGeometries(tubes, false);
whisk.translate(HEAD.x, HEAD.y, HEAD.z);
const whiskMat = glb.addMaterial({ name: 'baffi', pbrMetallicRoughness: { baseColorFactor: [0.93, 0.88, 0.78, 1], metallicFactor: 0, roughnessFactor: 0.5 } });
const whiskMesh = glb.addMesh('baffi', {
  positions: whisk.attributes.position.array, normals: whisk.attributes.normal.array, indices: new Uint32Array(whisk.index.array),
}, whiskMat);
meshNodes.push(glb.addNode('baffi', { mesh: whiskMesh, root: false }));
glb.addNode('Artù', { children: meshNodes, scale: [0.01, 0.01, 0.01] });
fs.mkdirSync(path.join(ROOT, 'export'), { recursive: true });
const glbBuf = glb.build();
fs.writeFileSync(path.join(ROOT, 'export', 'artu-persiano.glb'), glbBuf);
console.log(`artu-persiano.glb: ${(glbBuf.length / 1048576).toFixed(2)} MB`);
