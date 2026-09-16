import * as THREE from 'three';
import { App } from './app/App.js';
import { HUD } from './ui/HUD.js';

const canvas = document.getElementById('scene');
const app = new App({ canvas });
const hud = new HUD(app);

app.init().catch((e) => {
  console.error(e);
  hud.toast(`Errore nel caricamento dei boss: ${e.message || e}`);
});

// API di debug/test (usata dallo smoke test Playwright e utile dalla console)
window.__elden = {
  app,
  hud,
  THREE,
  defs: () => (app.manifest ? app.manifest.bosses : []),
  spawn: (id, x = 0, z = 0, height) => {
    const def = app.manifest.bosses.find((b) => b.id === id);
    if (!def) throw new Error(`boss sconosciuto: ${id}`);
    const y = app.mode && app.mode.groundY != null ? app.mode.groundY : 0;
    return app.spawn(def, new THREE.Vector3(x, y, z), { height, summon: false });
  },
  // Evoca un boss forzando il percorso "mesh statica" (nessuna clip): serve a testare
  // l'animazione a corpo rigido usata dai modelli generati da immagine.
  spawnRigid: async (id, x = 0, z = 0, height) => {
    const def = app.manifest.bosses.find((b) => b.id === id);
    if (!def) throw new Error(`boss sconosciuto: ${id}`);
    const y = app.mode && app.mode.groundY != null ? app.mode.groundY : 0;
    const inst = await app.loader.instantiate(def);
    const { Boss } = await import('./bosses/Boss.js');
    const boss = new Boss({ def, defaults: app.manifest.defaults, object: inst.object, clips: [], procedural: inst.procedural });
    boss.setHeight(height ?? app.settings.defaultHeight);
    boss.root.position.set(x, y, z);
    boss.setStyle(app.settings.style);
    app.scene.add(boss.root);
    app.bosses.push(boss);
    app.select(boss);
    app.emit('bosses', app.bosses);
    return boss;
  },
  state: () => ({
    mode: app.mode ? app.mode.name : null,
    bosses: app.bosses.map((b) => ({ id: b.def.id, hp: b.hp, alive: b.alive, height: b.height, state: b.fight.state, procedural: b.procedural, rigid: b.rigid, pos: b.root.position.toArray() })),
    fight: { active: app.fight.active, winner: app.fight.winner ? app.fight.winner.def.id : null, elapsed: app.fight.elapsed },
  }),
};
