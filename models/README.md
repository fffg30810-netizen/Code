# Modelli HD dei boss

Metti qui i file `.glb` finali, uno per boss, con il nome uguale all'`id` del manifest
(`malenia.glb`, `radahn.glb`, …). L'app li carica al posto dei segnaposto procedurali.

- `raw/` → GLB grezzi (pesanti) prima dell'ottimizzazione: `npm run optimize -- --all`
- requisiti: personaggio singolo, piedi a y=0, fronte verso +Z, riggato, clip `Idle`, `Walk`,
  `Attack1`, `Attack2`, `Hit`, `Death` (+ `Victory` opzionale). L'altezza viene normalizzata a runtime.
- consigliato: ≤ 150k triangoli, texture ≤ 2048 px in WebP/KTX2, Meshopt o Draco, ≤ 25 MB.

Per generare i modelli con l'IA segui `../../prompts/README.md`.
I file `.glb` in questa cartella sono ignorati da git tranne questo README (vedi `.gitignore`).
