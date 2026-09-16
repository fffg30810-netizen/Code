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

## Fase 5 — Boss reali (immagine → 3D) ✅
- Pipeline eseguita davvero, non solo documentata: prompt immagine → render di riferimento →
  conversione image-to-3D → GLB texturizzato → manifest.
- **Malenia** e **Radahn** da immagine di riferimento (Tripo H3.1 image-to-3D, ~57k triangoli
  ciascuno), **Margit** da text-to-3D: caricati dall'app via CDN, con `npm run fetch-models`
  per tenerli in locale.
- I modelli generati non hanno scheletro: aggiunto `RigidAnimator`, che anima l'intero corpo
  (respiro, passo, affondo, spazzata rotante, contraccolpo, caduta) così anche una mesh statica
  combatte. Selezione automatica fra clip del GLB e animazione rigida.
- Loader esteso agli URL remoti, correzione di orientamento per boss (`fix.yaw`), precaricamento
  del modello selezionato, avviso di caricamento, fallback ai segnaposto se il modello non arriva.
- Test headless esteso al percorso "mesh statica" (combattimento completo fino al vincitore).

## Fase 6 — Prossimi passi 🔜
- **Occlusione**: WebXR `depth-sensing` per far sparire il boss dietro oggetti reali (Android).
- **Marker mode iOS a 6DoF**: tracciamento immagine (es. MindAR) su un "sigillo" stampato, così anche
  su iPhone il boss resta inchiodato al tavolo mentre ti muovi.
- **Ancore persistenti** (`anchors`) per tenere la scena stabile in sessioni lunghe.
- **Registrazione video in-app** in modalità Camera (MediaRecorder su canvas + video).
- **Gli altri dieci boss**: stessa pipeline, ~10 crediti a boss (1 immagine + 1 conversione);
  i prompt sono già pronti in `prompts/bosses/`.
- **Rig e animazioni articolate** per i modelli generati (Meshy auto-rigging o Mixamo), al posto
  dell'animazione a corpo rigido.

## Fase 7 — Idee 💡
- Squadre e duelli 1v1 scelti a mano, mosse speciali per boss (Scarlet Aeonia, meteora di Radahn) con
  particelle dedicate.
- Multiplayer locale (WebRTC) per evocare ognuno il proprio boss sullo stesso tavolo.
- Arena: pavimento circolare olografico e nebbia; modalità "diorama" con boss statici in posa.
