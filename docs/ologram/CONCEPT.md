# Ologram — concept

**Ologram** trasforma qualunque gioco in un ologramma nella tua stanza: un diorama da tavolo (il *Board*) che puoi
afferrare, scalare, ruotare e in cui puoi entrare a scala 1:1, in mixed reality. Non è un singolo gioco ma una
piattaforma: un runtime sul visore, un servizio "ponte" che parla con i giochi, e adapter per ogni gioco o genere.

## Perché "qualunque gioco" è possibile

Nessuna tecnica singola copre tutti i giochi. Ologram li copre a **livelli (tier)**, dal migliore al peggiore:

| Tier | Nome | Come funziona | Esempi |
|---|---|---|---|
| 1 | **Native** | Il mondo è generato dentro Ologram | Voxelcraft (stile Minecraft), Tiletown (mappa 2D → città 3D), scacchi/dama |
| 2 | **Data** | Ologram legge lo stato reale del gioco (memoria dell'emulatore, mod, file di livello) e lo ricostruisce in 3D | Game Boy/NES via emulatore, Minecraft vero via mod, Doom via WAD |
| 3 | **Visual** | Cattura lo schermo del gioco e lo "solleva" in 3D con un modello di visione, secondo un profilo per gioco | giochi 2D a tile e sprite su PC/console |
| 4 | **Screen** | Schermo virtuale flottante con cornice olografica e parallasse dalla profondità stimata | tutto il resto, dal giorno uno |

Ogni gioco parte dal Tier 4 e sale di tier quando esiste un adapter migliore. Gli adapter li scrive **Ologram Forge**,
una pipeline basata su LLM che, dati video/screenshot del gioco, produce la tassonomia dei tile, la mappatura
tile → prefab, la configurazione di lettura memoria e la lista di asset da creare.

## Componenti

1. **Ologram Core** (app sul visore, WebXR + three.js o Unity): Board, base olografica, HUD, menu, modalità di vista
   (BOARD / LIFE-SIZE / SCREEN), input unificato, renderer (voxel, tile, mesh, sprite), salvataggi, libreria giochi.
2. **Ologram Bridge** (servizio sul PC o worker in-headset): ospita gli adapter e trasmette al Core lo stato del gioco
   tramite l'**Holo Scene Protocol (HSP)**, un formato JSON/binario con scena iniziale + delta; riporta gli input al gioco.
3. **Adapter** (plugin per gioco/genere), organizzati per tier.
4. **Ologram Forge**: generatore di adapter assistito da AI.
5. **Asset pack** originali (voxel, città low-poly, dungeon, sci-fi): niente asset protetti da copyright.

## Grammatica di interazione (uguale per tutti i giochi)

`LEFT GRIP` sposta il Board · `BOTH GRIPS` scala/ruota · `B` ruota di 45° · `X` entra/esce dalla vista 1:1 ·
`Y` menu · `TRIGGER` azione principale · `STICK` movimento · `A` salto/conferma.

## Note legali

Emulatori solo con ROM di proprietà dell'utente; mod nel rispetto delle EULA; asset e nomi originali "in stile".
Il prompt completo per costruire la piattaforma è in `PROMPT-ologram.md`.
