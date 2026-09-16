# Piano per fasi

Stato: ✅ fatto · 🔜 prossimo · 💡 idea

## Fase 0 — Piano e architettura ✅
- Web app (nessuna installazione, un link HTTPS) invece di app nativa: funziona su Android in AR vera
  e su iPhone in modalità camera; three.js + WebXR; Vite per dev HTTPS in LAN e build statica.
- Asset: per licenza niente modelli estratti dal gioco → segnaposto procedurali + pipeline IA
  documentata con prompt.

## Fase 1 — App AR base ✅
- Renderer HD (pixel ratio 2, supersampling XR 1,4×, ACES, ambiente HDR, ombre PCF 2048, anisotropia).
- WebXR: hit-test viewer + touch, reticolo "sigillo", DOM overlay, light estimation, uscita pulita.
- Modalità Camera: getUserMedia + DeviceOrientation (permesso iOS), piano virtuale regolabile, FOV.
- Anteprima 3D desktop con tavolo virtuale.
- Evocazione con tap, selezione, drag, pinch-to-scale, rotazione a due dita, slider logaritmico,
  "Scala reale" con altezze da lore, rimozione/svuota.
- Manifest dei boss (13) con fallback procedurale animato (idle, walk, 2 attacchi, hit, death, victory).
- Stili realistico / spirito / oro con shader ologramma (scanline, fresnel, taglio di evocazione),
  effetto materializzazione e dissolvenza.

## Fase 2 — Combattimento ✅
- IA tutti-contro-tutti: bersaglio più vicino, avvicinamento, portata dipendente dalla scala,
  attacchi con `hitTime` per clip, critici, contraccolpo, morte, dissolvenza, separazione dei corpi.
- Barre vita billboard, scintille, suoni sintetizzati, banner vincitore, rivincita, slow-motion.
- RNG con seed per test riproducibili.

## Fase 3 — Pipeline asset HD + prompt ✅
- `prompts/`: guida di stile, README della pipeline (Meshy/Tripo/Rodin/Hunyuan3D, Mixamo, Blender),
  13 prompt pack (text-to-3D corto/esteso, character sheet, retexture, animazioni, manifest) + template.
- `tools/`: ottimizzazione GLB (Meshopt/Draco + WebP), generatore manifest con lettura clip, script
  Blender per unire le animazioni in un GLB.

## Fase 4 — Qualità, test, deploy ✅
- Smoke test headless Playwright (evocazione, gesti, ologramma, combattimento fino al vincitore,
  reset, uscita) con screenshot.
- Workflow GitHub Pages, README in italiano, Quick Look iOS opzionale.

## Fase 5 — Prossimi passi 🔜
- **Occlusione**: WebXR `depth-sensing` per far sparire il boss dietro oggetti reali (Android).
- **Marker mode iOS a 6DoF**: tracciamento immagine (es. MindAR) su un "sigillo" stampato, così anche
  su iPhone il boss resta inchiodato al tavolo mentre ti muovi.
- **Ancore persistenti** (`anchors`) per tenere la scena stabile in sessioni lunghe.
- **Registrazione video in-app** in modalità Camera (MediaRecorder su canvas + video).
- **Modelli HD reali**: eseguire la pipeline per i primi 3-4 boss e caricarli in `public/models/`.

## Fase 6 — Idee 💡
- Squadre e duelli 1v1 scelti a mano, mosse speciali per boss (Scarlet Aeonia, meteora di Radahn) con
  particelle dedicate.
- Multiplayer locale (WebRTC) per evocare ognuno il proprio boss sullo stesso tavolo.
- Arena: pavimento circolare olografico e nebbia; modalità "diorama" con boss statici in posa.
