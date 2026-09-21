// Scrittore GLB (glTF 2.0 binario) essenziale: maglie con posizioni, normali, colori per vertice,
// UV, indici, materiali PBR, texture PNG incorporate, nodi con trasformazioni.
const align4 = (n) => (n + 3) & ~3;
const COMPONENT = { Float32Array: 5126, Uint32Array: 5125, Uint16Array: 5123, Uint8Array: 5121 };

export class GLBBuilder {
  constructor(generator = 'artu-3d') {
    this.json = {
      asset: { version: '2.0', generator }, scene: 0, scenes: [{ nodes: [] }],
      nodes: [], meshes: [], materials: [], accessors: [], bufferViews: [], buffers: [{ byteLength: 0 }],
      images: [], textures: [], samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }],
    };
    this.parts = []; this.byteLength = 0;
  }
  _view(typed, target) {
    const bytes = new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength);
    const offset = this.byteLength;
    this.parts.push({ bytes, offset });
    this.byteLength = align4(offset + bytes.byteLength);
    const bv = { buffer: 0, byteOffset: offset, byteLength: bytes.byteLength };
    if (target) bv.target = target;
    this.json.bufferViews.push(bv);
    return this.json.bufferViews.length - 1;
  }
  _accessor(typed, type, opts = {}) {
    const comps = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[type];
    const acc = { bufferView: this._view(typed, opts.target), componentType: COMPONENT[typed.constructor.name], count: typed.length / comps, type };
    if (opts.normalized) acc.normalized = true;
    if (opts.minmax) {
      const min = new Array(comps).fill(Infinity), max = new Array(comps).fill(-Infinity);
      for (let i = 0; i < typed.length; i++) { const c = i % comps; if (typed[i] < min[c]) min[c] = typed[i]; if (typed[i] > max[c]) max[c] = typed[i]; }
      acc.min = min; acc.max = max;
    }
    this.json.accessors.push(acc);
    return this.json.accessors.length - 1;
  }
  addMaterial(mat) { this.json.materials.push(mat); return this.json.materials.length - 1; }
  addTexturePNG(png) {
    const bv = this._view(png);
    this.json.images.push({ bufferView: bv, mimeType: 'image/png' });
    this.json.textures.push({ sampler: 0, source: this.json.images.length - 1 });
    return this.json.textures.length - 1;
  }
  addMesh(name, { positions, normals, colors, uvs, indices }, material) {
    const attributes = { POSITION: this._accessor(positions, 'VEC3', { minmax: true, target: 34962 }) };
    if (normals) attributes.NORMAL = this._accessor(normals, 'VEC3', { target: 34962 });
    if (colors) attributes.COLOR_0 = this._accessor(colors, 'VEC4', { normalized: true, target: 34962 });
    if (uvs) attributes.TEXCOORD_0 = this._accessor(uvs, 'VEC2', { target: 34962 });
    const prim = { attributes, mode: 4 };
    if (indices) prim.indices = this._accessor(indices, 'SCALAR', { target: 34963 });
    if (material !== undefined) prim.material = material;
    this.json.meshes.push({ name, primitives: [prim] });
    return this.json.meshes.length - 1;
  }
  addNode(name, { mesh, translation, rotation, scale, children, root = true }) {
    const node = { name };
    if (mesh !== undefined) node.mesh = mesh;
    if (translation) node.translation = translation;
    if (rotation) node.rotation = rotation;
    if (scale) node.scale = scale;
    if (children) node.children = children;
    this.json.nodes.push(node);
    const idx = this.json.nodes.length - 1;
    if (root) this.json.scenes[0].nodes.push(idx);
    return idx;
  }
  build() {
    this.json.buffers[0].byteLength = this.byteLength;
    const bin = Buffer.alloc(this.byteLength);
    for (const p of this.parts) bin.set(p.bytes, p.offset);
    let jsonBuf = Buffer.from(JSON.stringify(this.json), 'utf8');
    const pad = align4(jsonBuf.length) - jsonBuf.length;
    if (pad) jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc(pad, 0x20)]);
    const total = 12 + 8 + jsonBuf.length + 8 + bin.length;
    const out = Buffer.alloc(total);
    out.write('glTF', 0, 'ascii'); out.writeUInt32LE(2, 4); out.writeUInt32LE(total, 8);
    out.writeUInt32LE(jsonBuf.length, 12); out.write('JSON', 16, 'ascii'); jsonBuf.copy(out, 20);
    const o = 20 + jsonBuf.length;
    out.writeUInt32LE(bin.length, o); out.write('BIN\0', o + 4, 'ascii'); bin.copy(out, o + 8);
    return out;
  }
}
