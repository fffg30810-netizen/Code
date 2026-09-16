# Analisi frame-by-frame — "AR Board" (reel @ae.t.he.r)

Analisi di due screen recording Android (Instagram, UI in italiano) registrati il 16/09/2026 alle 18:59 e 19:00.
Frame estratti con ffmpeg a 2 fps (73 + 65 frame) più frame a piena risoluzione (1200×2670) nei punti chiave.
I frame di riferimento sono in `frames/`.

## 1. Metadati dei due reel

| | Video 1 | Video 2 |
|---|---|---|
| File | `52573361-Screenrecorder-2026-09-16-18-59-38-418.mp4` | `f5adce74-Screenrecorder-2026-09-16-19-00-31-450.mp4` |
| Durata | 36,7 s | 32,5 s |
| Autore reel | `ae.t.he.r` | `ae.t.he.r` |
| Titolo overlay | "GPT 6 converts any game into an AR Board 😳" | "GPT 6 has no Limits 💀" |
| Audio | Pebble Ballad | Pebble Ballad |
| Data post | (non visibile) | 7 settembre |
| Interazioni | 2 commenti · 3 condivisioni · 28 salvataggi | 178 commenti · 280 condivisioni · 3.535 salvataggi |

**Caption video 1** (trascritta integralmente):

> I used GPT to create Minecraft in AR. 💀⛏
> Instead of opening a game, I turned my room into the game. I can place blocks, equip diamond tools, build structures and face enemies through an AR interface created with AI.
> This is what fascinates me about vibe coding: you can take a world everyone knows, break it down into interactions and rebuild it beyond the screen—directly inside your own space.
> I'm pushing vibe coding beyond the screen and into reality. Follow to see what I build next.
> AI has no limits.
> #GPT6 #Minecraft #AugmentedReality …

**Caption video 2**:

> GPT-6 turned a flat Pokémon map into a world inside my room.
> AI really has no limits. 💀
> #GPT6 #Pokemon #AugmentedReality …

Commento più votato (135 like) di `samir.benaskeur`: "How did you convert it into AR game?" — ha 2 risposte precedenti e una risposta dell'autore, ma il testo delle risposte non è mai visibile nel video.

Il primo mezzo secondo del video 1 mostra il reel precedente (Bits Today, "Qwen 3.8 Builds an Offline Browser…"): irrilevante.

## 2. Timeline video 1 — Minecraft AR Board

| t (s) | Cosa si vede | Frame |
|---|---|---|
| 0,0–0,5 | Reel precedente, swipe. | — |
| 0,5–9,5 | **Board view.** Diorama voxel stile Minecraft ancorato sul letto in passthrough. Terreno a gradoni erba/terra, alberi di quercia, casa in oak planks con tetto a gradoni, sentiero di sabbia, chiazze di cobblestone a scacchiera, colonna di cobblestone, avatar Steve che cammina sul board. Base olografica: griglia teal semitrasparente + bordo wireframe teal + fascia nera frontale con HUD. Mano sinistra nuda (hand tracking), controller Touch Plus nella destra. A 9,0 s un bagliore rosso accanto alla casa (cursore "mine" sul blocco puntato). | `mc-01`, `mc-hud-text` |
| 10–11,5 | **LEFT GRIP → MOVE BOARD.** Il board (HUD compreso) viene afferrato, inclinato e spostato in fondo al letto. | `mc-02` |
| 12–14,5 | **BOTH GRIPS → SCALE / TURN.** Il board viene ingrandito e ruotato con due mani. | — |
| 15,0 | HUD ora "SWORD" / "LARGE 32": preset dimensione LARGE (32 blocchi di lato) e spada equipaggiata. Mondo più esteso (più alberi, chiazza di terra arata). | `mc-03` |
| 15,5–16,5 | **Y → INVENTORY.** Pannello "BUILD" a tablet verticale flottante davanti all'utente. Laser teal dal controller destro; item selezionato evidenziato con card teal (PICKAXE). | `mc-04`, `mc-build-panel-zoom` |
| 17–17,5 | **X → VIEW.** Vista a scala reale: il mondo riempie la stanza (alberi fino al soffitto), Steve accanto a una colonna di cobblestone con blocco evidenziato teal, casa in oak planks. | `mc-05` |
| 18–31 | (sheet commenti aperto, video in piccolo) **Prima persona** dentro la casa: pareti oak planks, pavimento cobblestone, finestra di vetro con wireframe teal (blocco puntato dal laser), secondo personaggio Steve-like accanto al muro (mob). Il giocatore si gira e guarda la finestra dal basso. | `mc-06` |
| 32–34,5 | Board view ravvicinata: HUD "MEDIUM 24", "TRIGGER MINE". Laser teal dal controller destro (Touch Plus senza anello) su un blocco di stone con **icona rossa a forma di piccone** (cursore mine). | `mc-07`, `mc-hud-text-2`, `mc-08` |
| 35–36,7 | Board view iniziale (loop del reel). | — |

### 2.1 Testo esatto dell'HUD (fascia nera sul bordo frontale del board)

```
[in alto a sinistra]  PICKAXE            oppure  COBBLESTONE · UNLIMITED   oppure  SWORD
[in alto a destra]    MEDIUM 24          oppure  LARGE 32
[riga 1, centrata]    STICK MOVE    A JUMP    TRIGGER PLACE      (TRIGGER MINE quando è equipaggiato un attrezzo)
[riga 2, centrata]    X VIEW    Y INVENTORY    B ROTATE    R-STICK HOLD
[riga 3, centrata]    LEFT GRIP MOVE BOARD    BOTH GRIPS SCALE / TURN
```

Font condensato sans-serif maiuscolo, bianco su nero, bordo e linee separatrici teal (#2EE6C5 circa). La fascia è attaccata al bordo anteriore del board e si muove/scala con esso.

### 2.2 Pannello "BUILD" (inventario)

```
BUILD                                              RIGHT TRIGGER / SELECT

  [PICKAXE]        [SHOVEL]        [AXE]           ← strumenti diamante (teal)
        [HOE]            [SWORD]

  [DIRT]  UNLIMITED   [GRASS]  UNLIMITED   [STONE]  UNLIMITED
  [COBBLESTONE] UNL.  [OAK LOG] UNL.       [OAK PLANKS] UNL.
  [SAND]  UNLIMITED   [GLASS]  UNLIMITED   [OAK LEAVES] UNLIMITED

              FREE BUILD  ·  SWITCH TO COLLECT
                     SAVE & CLOSE
        Y MENU    A JUMP    B ROTATE    X VIEW
```

Pannello nero opaco con bordo teal, ~0,5 × 0,8 m, in piedi davanti all'utente; ogni voce ha l'icona 3D (cubo o attrezzo) a sinistra dell'etichetta; l'item puntato/selezionato diventa una card piena teal con testo scuro.

## 3. Timeline video 2 — Pokémon AR Board

| t (s) | Cosa si vede | Frame |
|---|---|---|
| 0–2,5 | **Board view.** Diorama 3D stile Pallet Town / Route 1 sul letto: prato, alberi, staccionate, cartelli, siepi, paletti bianchi, trainer + Pikachu in miniatura che camminano. Base a griglia blu semitrasparente. | `pk-01` |
| 2,5–9 | La camera gira a destra: **schermo virtuale 2D** ancorato accanto alla finestra mostra la mappa Game Boy originale (palette verde, alberi tondi, giocatore con Pokémon che lo segue). Lo sprite si muove tra 1,5 e 3,5 s: lo schermo è "vivo", sincronizzato col mondo 3D. | `pk-02` |
| 9–12 | Board view dal davanti, panning. | — |
| 12–17,5 | **Board ingrandito** (occupa tutto il letto): Pokémon Center (tetto rosso, vetrate), casa bianca con bordi gialli, laghetto con sassi, siepi, staccionata, cartello, panchina, lampioni; NPC e Pikachu. | `pk-03` |
| 18–23,5 | **Prima persona a scala reale:** cielo blu, lampioni, panchina, cartello, case, Pokémon Center; Pikachu corre verso il giocatore; schermo 2D flottante con la mappa Game Boy dell'area. | `pk-04` |
| 24–29,5 | (commenti aperti) Entra nel Pokémon Center: porte a vetri scorrevoli, interno con bancone, infermiera con capelli rosa, trainer NPC; **schermo 2D a destra mostra l'interno del Centro Pokémon in stile Game Boy** → il mapping 2D→3D vale anche per gli interni (warp). | `pk-05` |
| 30–32,5 | Ritorno alla board view (loop). | — |

Nel video 2 non compaiono né HUD né controller: è puro showcase della conversione mappa 2D → mondo 3D.

## 4. Cosa è stato fatto (interpretazione tecnica)

1. **Hardware:** Meta Quest 3 (passthrough a colori, controller Touch Plus senza anello, hand tracking sulla mano sinistra). I reel sono screen recording del visore.
2. **Concetto "AR Board":** un mondo di gioco viene reso come diorama ancorato a una superficie reale (il letto) su una base olografica a griglia. Il board si sposta con un grip, si scala/ruota con due grip, e con un tasto passa a **scala 1:1 in prima persona** dentro la stanza.
3. **Minecraft:** non è Minecraft vero ma un **motore voxel custom**: generazione procedurale (heightmap erba/terra/stone, alberi, sentiero di sabbia, casa in planks, chiazze di cobblestone), preset di dimensione MEDIUM 24 / LARGE 32, inventario con 5 attrezzi diamante e 9 blocchi, modalità FREE BUILD (tutto UNLIMITED) o COLLECT (raccolta), piazza/scava col trigger tramite laser, highlight teal sul blocco puntato in place e cursore rosso a piccone in mine, avatar Steve mosso con lo stick, salto, mob umanoidi, salvataggio.
4. **Pokémon:** un **convertitore tilemap 2D → scena 3D**: ogni tile della mappa Game Boy (albero, siepe, staccionata, cartello, casa, Pokémon Center, acqua, lampione, panchina) diventa un prefab 3D sulla stessa griglia; NPC e Pikachu si muovono; uno schermo 2D mostra la mappa originale nello stesso stato (posizione giocatore, interni). Gli asset 3D (Pikachu, Pokémon Center) sono modelli esistenti riadattati, non generati.
5. **"GPT 6"** è solo il titolo clickbait: il lavoro è vibe coding con un LLM che scrive tutto il codice (Unity + Meta XR SDK oppure WebXR/three.js nel browser del Quest).

## 5. Come riprodurlo (pipeline)

1. Scegliere lo stack: **WebXR + three.js** (più veloce da vibe-codare, gira nel browser del Quest 3 con `immersive-ar`) oppure **Unity 6 + Meta XR SDK** (Passthrough, Interaction SDK, MRUK per le superfici).
2. Costruire il **BoardRoot**: gruppo scalabile con base a griglia, bordo wireframe, fascia HUD; grab con grip sinistro, scala/rotazione a due mani, preset MEDIUM/LARGE.
3. Motore voxel: chunk mesh con texture atlas 16×16 in stile Minecraft (asset originali, non estratti dal gioco), generatore procedurale, raycast per place/mine, highlight.
4. Input: mapping controller identico all'HUD; laser dal controller destro; hand tracking opzionale per la sinistra.
5. Pannello BUILD come UI world-space; modalità FREE BUILD / COLLECT; salvataggio in localStorage/JSON.
6. Modalità VIEW: riparenting della camera all'avatar a scala 1:1 con locomozione stick + salto e collisioni voxel.
7. Pokémon: definire il tilemap (PNG/JSON), tabella tile→prefab, spawner di NPC, pannello 2D che renderizza lo stesso tilemap in palette Game Boy con lo sprite del giocatore sincronizzato; warp per gli interni.

Il prompt completo per la ricostruzione è in `PROMPT-ricostruzione.md`.

> Nota IP: Minecraft (Mojang/Microsoft) e Pokémon (Nintendo/Game Freak) sono marchi registrati. Per uso personale va bene; per pubblicare l'app usare asset originali "in stile" e nomi diversi.
