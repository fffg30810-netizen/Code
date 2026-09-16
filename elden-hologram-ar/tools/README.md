# Strumenti della pipeline asset

| Script | Cosa fa |
| --- | --- |
| `copy-decoders.mjs` | (automatico al `npm install`) copia i decoder Draco/Basis in `public/decoders`. |
| `optimize-glb.mjs` | `npm run optimize -- raw.glb` → GLB compresso (Meshopt + WebP 2048) in `public/models/`. `--all` processa `public/models/raw/*.glb`. |
| `build-manifest.mjs` | `npm run manifest` → aggiorna `public/bosses.json` con i GLB/USDZ presenti e stampa le clip trovate. |
| `blender_export.py` | `blender -b -P tools/blender_export.py -- --base ... --anim Idle=... --out ...` unisce le animazioni Mixamo in un unico GLB. |

Flusso tipico per un boss:

```bash
# 1) genera il modello (vedi ../prompts/README.md), riggalo e scarica le animazioni
# 2) unisci tutto in un GLB
blender -b -P tools/blender_export.py -- --base raw/malenia.fbx \
  --anim Idle=raw/anim/idle.fbx Walk=raw/anim/walk.fbx Attack1=raw/anim/slash.fbx \
         Attack2=raw/anim/spin.fbx Hit=raw/anim/hit.fbx Death=raw/anim/death.fbx \
  --out public/models/raw/malenia.glb
# 3) comprimi per il telefono
npm run optimize -- public/models/raw/malenia.glb
# 4) aggiorna il manifest e controlla le clip
npm run manifest
```

Per iOS Quick Look (opzionale) converti il GLB in USDZ con Reality Converter (macOS) o
`usdzconvert` e mettilo in `public/usdz/<id>.usdz`: il manifest lo rileva da solo.

## Verificare un modello generato

```bash
npm run preview-glb -- public/models/malenia.glb preview.png     # file locale
npm run preview-glb -- https://…/model.glb preview.png           # URL remoto
```

Renderizza il modello da tre angolazioni su una griglia e stampa triangoli, mesh, materiali,
texture e clip di animazione trovate: utile per capire subito se il GLB è orientato bene
(deve guardare verso **+Z**), se ha lo scheletro e quanto pesa.

Se guarda dalla parte sbagliata, correggilo nel manifest senza ritoccare il file:

```json
{ "id": "malenia", "fix": { "yaw": 180 } }
```
