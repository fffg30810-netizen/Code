// Formato binario compatto per la geometria incorporata nel viewer.
// Layout: "ARTU" | u32 lunghezza header | header JSON | blob (allineati a 4 byte)
// Posizioni Int16 (0,01 cm), normali Int8, colori sRGB Uint8, pelo Uint8 (0..6,4 cm), indici Uint32.
export const POS_SCALE = 0.01;
export const FUR_SCALE = 6.4 / 255;

function align4(n) { return (n + 3) & ~3; }

export function packMeshes(meshes) {
  const enc = new TextEncoder();
  const blobs = [];
  const header = { meshes: [] };
  let offset = 0;
  const push = (typed) => {
    const bytes = new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength);
    const entry = { offset, length: bytes.byteLength };
    blobs.push({ bytes, offset });
    offset = align4(offset + bytes.byteLength);
    return entry;
  };
  for (const m of meshes) {
    const nv = m.positions.length / 3;
    const pos = new Int16Array(nv * 3);
    for (let i = 0; i < nv * 3; i++) pos[i] = Math.round(m.positions[i] / POS_SCALE);
    const nor = new Int8Array(nv * 3);
    for (let i = 0; i < nv * 3; i++) nor[i] = Math.round(Math.max(-1, Math.min(1, m.normals[i])) * 127);
    const col = new Uint8Array(nv * 3);
    for (let i = 0; i < nv * 3; i++) col[i] = Math.round(Math.max(0, Math.min(1, m.colors[i])) * 255);
    const fur = new Uint8Array(nv);
    for (let i = 0; i < nv; i++) fur[i] = Math.round(Math.max(0, Math.min(6.4, m.fur[i])) / FUR_SCALE);
    header.meshes.push({
      name: m.name, vertexCount: nv, indexCount: m.indices.length,
      positions: push(pos), normals: push(nor), colors: push(col), fur: push(fur), indices: push(m.indices),
    });
  }
  const headerBytes = enc.encode(JSON.stringify(header));
  const headerLen = align4(headerBytes.length);
  const total = 8 + headerLen + offset;
  const out = new Uint8Array(total);
  out.set([0x41, 0x52, 0x54, 0x55], 0); // "ARTU"
  new DataView(out.buffer).setUint32(4, headerLen, true);
  out.fill(0x20, 8, 8 + headerLen); // riempimento con spazi (JSON valido)
  out.set(headerBytes, 8);
  for (const b of blobs) out.set(b.bytes, 8 + headerLen + b.offset);
  return out;
}

export function unpackMeshes(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) !== 'ARTU') throw new Error('Formato geometria non valido');
  const headerLen = dv.getUint32(4, true);
  const header = JSON.parse(new TextDecoder().decode(bytes.subarray(8, 8 + headerLen)).replace(/\0+$/, '').trim());
  const base = bytes.byteOffset + 8 + headerLen;
  const view = (entry, Ctor) => new Ctor(bytes.buffer, base + entry.offset, entry.length / Ctor.BYTES_PER_ELEMENT);
  return header.meshes.map((m) => {
    const nv = m.vertexCount;
    const posQ = view(m.positions, Int16Array), norQ = view(m.normals, Int8Array);
    const positions = new Float32Array(nv * 3), normals = new Float32Array(nv * 3);
    for (let i = 0; i < nv * 3; i++) { positions[i] = posQ[i] * POS_SCALE; normals[i] = norQ[i] / 127; }
    const furQ = view(m.fur, Uint8Array);
    const fur = new Float32Array(nv);
    for (let i = 0; i < nv; i++) fur[i] = furQ[i] * FUR_SCALE;
    return {
      name: m.name, positions, normals, fur,
      colors: new Uint8Array(view(m.colors, Uint8Array)),          // sRGB
      indices: new Uint32Array(view(m.indices, Uint32Array)),
    };
  });
}
