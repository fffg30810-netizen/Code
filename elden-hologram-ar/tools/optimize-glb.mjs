#!/usr/bin/env node
// Ottimizza i GLB per il telefono con @gltf-transform/cli:
//   - dedup/prune/weld, ricampionamento animazioni
//   - texture ridimensionate (default 2048) e compresse in WebP
//   - geometria compressa con Meshopt (decodificata dall'app)
// Uso:  npm run optimize -- input.glb [output.glb] [--size 2048] [--draco]
//       npm run optimize -- --all        (ottimizza tutti i .glb in public/models/raw → public/models)
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (name, def) => { const i = args.indexOf(name); if (i < 0) return def; const v = args[i + 1]; args.splice(i, 2); return v ?? true; };
const size = Number(flag('--size', 2048));
const draco = !!flag('--draco', false);
const all = args.includes('--all');
const bin = join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'gltf-transform.cmd' : 'gltf-transform');

function optimize(input, output) {
  mkdirSync(dirname(output), { recursive: true });
  const cmd = [
    'optimize', input, output,
    '--compress', draco ? 'draco' : 'meshopt',
    '--texture-compress', 'webp',
    '--texture-size', String(size),
    '--simplify', 'false',
  ];
  console.log(`\n▶ ${basename(input)} → ${output}`);
  const r = spawnSync(bin, cmd, { stdio: 'inherit' });
  if (r.status !== 0) { console.error(`✗ ottimizzazione fallita per ${input}`); process.exitCode = 1; }
}

if (all) {
  const rawDir = join(root, 'public', 'models', 'raw');
  if (!existsSync(rawDir)) { console.error(`Cartella ${rawDir} non trovata. Metti lì i GLB grezzi.`); process.exit(1); }
  for (const f of readdirSync(rawDir).filter((f) => /\.glb$/i.test(f))) optimize(join(rawDir, f), join(root, 'public', 'models', f.toLowerCase()));
} else {
  const [input, output] = args.filter((a) => !a.startsWith('--'));
  if (!input) { console.error('Uso: npm run optimize -- input.glb [output.glb] [--size 2048] [--draco] | --all'); process.exit(1); }
  optimize(input, output || join(root, 'public', 'models', basename(input).toLowerCase()));
}
