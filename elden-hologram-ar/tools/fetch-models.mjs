#!/usr/bin/env node
// Scarica in locale i modelli dei boss indicati nel manifest con un URL remoto, così l'app
// funziona anche offline e non dipende da un CDN esterno.
//   npm run fetch-models            scarica tutti i modelli remoti in public/models/
//   npm run fetch-models -- malenia radahn      solo alcuni boss
//   npm run fetch-models -- --keep-remote       scarica ma lascia gli URL nel manifest
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = join(root, 'public', 'bosses.json');
const modelsDir = join(root, 'public', 'models');
const args = process.argv.slice(2);
const keepRemote = args.includes('--keep-remote');
const only = args.filter((a) => !a.startsWith('--'));

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
await mkdir(modelsDir, { recursive: true });

let changed = 0, failed = 0;
for (const boss of manifest.bosses) {
  const url = boss.model;
  if (!url || !/^https?:\/\//.test(url)) continue;
  if (only.length && !only.includes(boss.id)) continue;
  const dest = join(modelsDir, `${boss.id}.glb`);
  if (existsSync(dest)) { console.log(`· ${boss.id}: già presente, salto`); continue; }
  process.stdout.write(`↓ ${boss.id} … `);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(dest, buf);
    console.log(`${(buf.length / 1048576).toFixed(1)} MB → public/models/${boss.id}.glb`);
    if (!keepRemote) { boss.modelRemote = url; boss.model = `models/${boss.id}.glb`; changed++; }
  } catch (e) {
    console.log(`errore: ${e.message}`);
    failed++;
  }
}
if (changed) {
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`\nManifest aggiornato: ${changed} boss ora puntano ai file locali.`);
}
if (failed) { console.error(`\n${failed} download falliti.`); process.exitCode = 1; }
if (!changed && !failed) console.log('Niente da scaricare.');
