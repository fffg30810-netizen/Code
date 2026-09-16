#!/usr/bin/env node
// Aggiorna public/bosses.json in base ai file presenti:
//   - per ogni boss, se esiste public/models/<id>.glb imposta `model`, altrimenti lo rimuove
//     (l'app userà il segnaposto procedurale)
//   - idem per public/usdz/<id>.usdz (Quick Look iOS)
//   - stampa le clip di animazione trovate nei GLB, così puoi verificare la mappatura `clips`
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = join(root, 'public', 'bosses.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

for (const boss of manifest.bosses) {
  const glb = join(root, 'public', 'models', `${boss.id}.glb`);
  const usdz = join(root, 'public', 'usdz', `${boss.id}.usdz`);
  if (existsSync(glb)) {
    boss.model = `models/${boss.id}.glb`;
    try {
      const doc = await io.read(glb);
      const anims = doc.getRoot().listAnimations().map((a) => a.getName());
      const tris = doc.getRoot().listMeshes().reduce((n, m) => n + m.listPrimitives().reduce((k, p) => k + (p.getIndices() ? p.getIndices().getCount() / 3 : p.getAttribute('POSITION').getCount() / 3), 0), 0);
      console.log(`✓ ${boss.id}: ${Math.round(tris).toLocaleString()} triangoli, clip: ${anims.length ? anims.join(', ') : '(nessuna!)'}`);
      if (!anims.length) console.warn(`  ⚠ nessuna animazione: il boss resterà statico. Rigga e anima il modello (vedi prompts/README.md).`);
    } catch (e) { console.warn(`  ⚠ impossibile leggere ${glb}: ${e.message}`); }
  } else {
    delete boss.model;
    console.log(`· ${boss.id}: nessun GLB → segnaposto procedurale`);
  }
  if (existsSync(usdz)) boss.usdz = `usdz/${boss.id}.usdz`; else delete boss.usdz;
}
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`\nManifest aggiornato: ${manifestPath}`);
