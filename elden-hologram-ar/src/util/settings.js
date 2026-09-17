const KEY = 'elden-hologram-ar:settings:v1';
const DEFAULTS = {
  style: 'realistic',      // realistic | spirit | gold
  sound: true,
  hd: true,                // supersampling in WebXR
  shadows: true,
  defaultHeight: 0.25,     // metri: grandezza iniziale dei boss evocati
  phoneHeight: 0.6,        // metri: modalità Camera, altezza del telefono dal piano
  fov: 65,                 // gradi: modalità Camera
  stabilize: true,         // modalità Camera: compensa lo spostamento del telefono
  autoLight: true,         // modalità Camera: luce e riflessi presi dall'immagine della stanza
};
export function loadSettings() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return { ...DEFAULTS }; }
}
export function saveSettings(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage non disponibile: ignora */ }
}
