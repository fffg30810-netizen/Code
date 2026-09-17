// Caricamento del manifest e dei modelli (glTF/GLB con Draco, KTX2, Meshopt),
// con fallback automatico ai segnaposto procedurali.
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { buildProceduralBoss } from './ProceduralBoss.js';
import { autoRig } from './AutoRig.js';

export async function loadManifest(url = 'bosses.json') {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Manifest non trovato: ${url} (${res.status})`);
  const json = await res.json();
  if (!Array.isArray(json.bosses)) throw new Error('Manifest non valido: manca `bosses`');
  json.defaults = json.defaults || {};
  return json;
}

const TEXTURE_SLOTS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap'];

export class BossLoader {
  constructor(renderer, { basePath = './' } = {}) {
    this.renderer = renderer;
    this.basePath = basePath;
    this.gltf = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath(`${basePath}decoders/draco/`);
    this.gltf.setDRACOLoader(draco);
    const ktx2 = new KTX2Loader();
    ktx2.setTranscoderPath(`${basePath}decoders/basis/`);
    try { ktx2.detectSupport(renderer); } catch { /* renderer senza supporto: ignora */ }
    this.gltf.setKTX2Loader(ktx2);
    this.gltf.setMeshoptDecoder(MeshoptDecoder);
    this.cache = new Map();
    this.maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
  }

  loadAsset(def) {
    if (!this.cache.has(def.id)) this.cache.set(def.id, this._load(def));
    return this.cache.get(def.id);
  }

  /** Risolve il percorso del modello: assoluto (http) o relativo alla base dell'app. */
  _modelUrl(def) {
    const m = def.model;
    if (!m) return null;
    return /^(https?:)?\/\//.test(m) || m.startsWith('data:') ? m : `${this.basePath}${m}`;
  }

  async _load(def) {
    const url = this._modelUrl(def);
    if (url) {
      try {
        const gltf = await this.gltf.loadAsync(url);
        gltf.scene.traverse((o) => {
          if (!o.isMesh) return;
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) for (const slot of TEXTURE_SLOTS) if (m && m[slot]) m[slot].anisotropy = this.maxAnisotropy;
        });

        // I modelli senza scheletro vengono riggati qui, una volta per boss: le
        // istanze successive clonano lo scheletro invece di ricalcolare i pesi.
        const clips = gltf.animations || [];
        let skinned = false;
        gltf.scene.traverse((o) => { if (o.isSkinnedMesh) skinned = true; });
        if (!clips.length && !skinned && def.autoRig !== false) {
          const t0 = performance.now();
          try {
            if (autoRig(gltf.scene)) console.info(`[BossLoader] ${def.id}: rigging automatico in ${Math.round(performance.now() - t0)} ms`);
          } catch (e) {
            console.warn(`[BossLoader] rigging automatico non riuscito per ${def.id}:`, e && e.message);
          }
        }
        return { scene: gltf.scene, clips, hitTimes: {}, procedural: false };
      } catch (e) {
        console.warn(`[BossLoader] "${url}" non disponibile (${e && e.message ? e.message : e}); uso il segnaposto procedurale per ${def.id}.`);
      }
    }
    return { procedural: true };
  }

  /** Restituisce una nuova istanza (clone) del boss: {object, clips, hitTimes, procedural}. */
  async instantiate(def) {
    const asset = await this.loadAsset(def);
    if (asset.procedural) {
      const b = buildProceduralBoss(def.procedural || {});
      return { object: b.object, clips: b.clips, hitTimes: b.hitTimes, procedural: true };
    }
    return { object: skeletonClone(asset.scene), clips: asset.clips, hitTimes: asset.hitTimes, procedural: false };
  }
}
