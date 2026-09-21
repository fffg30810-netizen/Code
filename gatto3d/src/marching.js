// Marching cubes con condivisione dei vertici lungo gli spigoli e normali analitiche
// (gradiente del campo di distanza). Usa le tabelle standard esportate da three.js.
import { edgeTable, triTable } from 'three/addons/objects/MarchingCubes.js';

// Per ogni spigolo del cubo: [dx, dy, dz] dell'angolo "inferiore" e asse (0=x, 1=y, 2=z)
const EDGE_DEF = [
  [0, 0, 0, 0], [1, 0, 0, 1], [0, 1, 0, 0], [0, 0, 0, 1],
  [0, 0, 1, 0], [1, 0, 1, 1], [0, 1, 1, 0], [0, 0, 1, 1],
  [0, 0, 0, 2], [1, 0, 0, 2], [1, 1, 0, 2], [0, 1, 0, 2],
];
const CORNER = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];

/**
 * @param {(x:number,y:number,z:number)=>number} sdf  campo di distanza (negativo dentro)
 * @param {{x,y,z}} min  angolo minimo del dominio
 * @param {{x,y,z}} max  angolo massimo del dominio
 * @param {number} cell  dimensione della cella (cm)
 * @param {(frac:number)=>void} [onProgress]
 */
export function marchingCubes(sdf, min, max, cell, onProgress) {
  const nx = Math.ceil((max.x - min.x) / cell) + 1;
  const ny = Math.ceil((max.y - min.y) / cell) + 1;
  const nz = Math.ceil((max.z - min.z) / cell) + 1;
  const n = nx * ny * nz;
  const field = new Float32Array(n);
  const idx = (x, y, z) => x + nx * (y + ny * z);

  // 1) Campionamento del campo
  for (let z = 0; z < nz; z++) {
    const pz = min.z + z * cell;
    for (let y = 0; y < ny; y++) {
      const py = min.y + y * cell;
      let o = idx(0, y, z);
      for (let x = 0; x < nx; x++, o++) field[o] = sdf(min.x + x * cell, py, pz);
    }
    if (onProgress && (z & 7) === 0) onProgress(0.6 * (z / nz));
  }

  // 2) Estrazione
  const ex = new Int32Array(n).fill(-1), ey = new Int32Array(n).fill(-1), ez = new Int32Array(n).fill(-1);
  const edgeArr = [ex, ey, ez];
  const positions = [];
  const indices = [];
  const vert = new Int32Array(12);
  const gp = (x, y, z) => [min.x + x * cell, min.y + y * cell, min.z + z * cell];

  for (let z = 0; z < nz - 1; z++) {
    for (let y = 0; y < ny - 1; y++) {
      for (let x = 0; x < nx - 1; x++) {
        let cubeindex = 0;
        for (let c = 0; c < 8; c++) {
          const cc = CORNER[c];
          if (field[idx(x + cc[0], y + cc[1], z + cc[2])] > 0) cubeindex |= 1 << c; // fuori
        }
        const bits = edgeTable[cubeindex];
        if (bits === 0) continue;
        for (let e = 0; e < 12; e++) {
          if (!(bits & (1 << e))) continue;
          const ed = EDGE_DEF[e];
          const ax = x + ed[0], ay = y + ed[1], az = z + ed[2];
          const a = idx(ax, ay, az);
          const arr = edgeArr[ed[3]];
          let vi = arr[a];
          if (vi < 0) {
            const bx = ax + (ed[3] === 0 ? 1 : 0), by = ay + (ed[3] === 1 ? 1 : 0), bz = az + (ed[3] === 2 ? 1 : 0);
            const s1 = field[a], s2 = field[idx(bx, by, bz)];
            let mu = s1 / (s1 - s2);
            if (!isFinite(mu)) mu = 0.5;
            mu = mu < 0 ? 0 : mu > 1 ? 1 : mu;
            const p1 = gp(ax, ay, az), p2 = gp(bx, by, bz);
            vi = positions.length / 3;
            positions.push(p1[0] + (p2[0] - p1[0]) * mu, p1[1] + (p2[1] - p1[1]) * mu, p1[2] + (p2[2] - p1[2]) * mu);
            arr[a] = vi;
          }
          vert[e] = vi;
        }
        const base = cubeindex * 16;
        for (let i = 0; triTable[base + i] !== -1; i += 3) {
          indices.push(vert[triTable[base + i]], vert[triTable[base + i + 1]], vert[triTable[base + i + 2]]);
        }
      }
    }
    if (onProgress && (z & 7) === 0) onProgress(0.6 + 0.3 * (z / nz));
  }

  // 3) Normali analitiche dal gradiente del campo
  const pos = new Float32Array(positions);
  const nor = new Float32Array(pos.length);
  const eps = cell * 0.5;
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i], y = pos[i + 1], z = pos[i + 2];
    let gx = sdf(x + eps, y, z) - sdf(x - eps, y, z);
    let gy = sdf(x, y + eps, z) - sdf(x, y - eps, z);
    let gz = sdf(x, y, z + eps) - sdf(x, y, z - eps);
    const l = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1;
    nor[i] = gx / l; nor[i + 1] = gy / l; nor[i + 2] = gz / l;
  }
  if (onProgress) onProgress(1);
  return { positions: pos, normals: nor, indices: new Uint32Array(indices) };
}

// Lisciatura laplaciana leggera (mantiene il volume grazie al fattore piccolo)
export function laplacianSmooth(positions, indices, iterations = 1, factor = 0.5) {
  const nv = positions.length / 3;
  const nb = new Array(nv);
  for (let i = 0; i < nv; i++) nb[i] = [];
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i], b = indices[i + 1], c = indices[i + 2];
    nb[a].push(b, c); nb[b].push(a, c); nb[c].push(a, b);
  }
  let src = positions;
  for (let it = 0; it < iterations; it++) {
    const dst = new Float32Array(src.length);
    for (let i = 0; i < nv; i++) {
      const list = nb[i];
      if (list.length === 0) { dst[i * 3] = src[i * 3]; dst[i * 3 + 1] = src[i * 3 + 1]; dst[i * 3 + 2] = src[i * 3 + 2]; continue; }
      let sx = 0, sy = 0, sz = 0;
      for (const j of list) { sx += src[j * 3]; sy += src[j * 3 + 1]; sz += src[j * 3 + 2]; }
      const k = 1 / list.length;
      dst[i * 3] = src[i * 3] + (sx * k - src[i * 3]) * factor;
      dst[i * 3 + 1] = src[i * 3 + 1] + (sy * k - src[i * 3 + 1]) * factor;
      dst[i * 3 + 2] = src[i * 3 + 2] + (sz * k - src[i * 3 + 2]) * factor;
    }
    src = dst;
  }
  return src;
}

// Normali dal gradiente del campo in posizioni arbitrarie (dopo lisciatura)
export function sdfNormals(sdf, positions, eps) {
  const nor = new Float32Array(positions.length);
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i], y = positions[i + 1], z = positions[i + 2];
    const gx = sdf(x + eps, y, z) - sdf(x - eps, y, z);
    const gy = sdf(x, y + eps, z) - sdf(x, y - eps, z);
    const gz = sdf(x, y, z + eps) - sdf(x, y, z - eps);
    const l = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1;
    nor[i] = gx / l; nor[i + 1] = gy / l; nor[i + 2] = gz / l;
  }
  return nor;
}
