// Copia i decoder Draco / Basis(KTX2) di three.js in public/decoders così l'app
// funziona anche offline / in LAN senza CDN. Eseguito automaticamente al postinstall.
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const threeLibs = join(root, 'node_modules', 'three', 'examples', 'jsm', 'libs');
const out = join(root, 'public', 'decoders');

if (!existsSync(threeLibs)) {
  console.warn('[copy-decoders] three.js non trovato in node_modules, salto.');
  process.exit(0);
}
mkdirSync(out, { recursive: true });
cpSync(join(threeLibs, 'draco', 'gltf'), join(out, 'draco'), { recursive: true });
cpSync(join(threeLibs, 'basis'), join(out, 'basis'), { recursive: true });
console.log('[copy-decoders] decoder copiati in public/decoders');
