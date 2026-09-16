# Ologram — master build prompt

Come usarlo: copia tutto ciò che segue `=== PROMPT ===` in Claude Code / Cursor / ChatGPT. Allegare anche
`../ar-board/frames/` come riferimento visivo per lo stile del Board e dell'HUD. Il prompt è in inglese perché è
destinato a un agente di coding; i nomi di prodotto (Ologram, Bridge, Forge, HSP) restano invariati.

=== PROMPT ===

You are the founding engineer of **Ologram**. Build it end to end, in the order of the milestones in §9. Do not ask
questions: where something is unspecified, choose the option that best serves the mission and note it in
`DECISIONS.md`.

## 1. Mission

Ologram lets people play **hologram versions of any game** in their own room, on a mixed-reality headset. Every
game becomes a **Board**: a tabletop diorama anchored on real furniture that the player can grab, scale, rotate and
step into at 1:1 scale. Ologram is a platform, not a single game:

- **Ologram Core** — the headset app (Board, rendering, input, UI, library, saves).
- **Ologram Bridge** — a companion service that connects real games to the Core through the **Holo Scene
  Protocol (HSP)**.
- **Adapters** — plugins that turn a specific game or genre into HSP scenes, organised in four tiers (§4).
- **Ologram Forge** — an AI pipeline that generates new adapters from reference footage and game data.

**Reference experience (normative).** Ologram v1 must reproduce, first and exactly, the two "AR Board" experiences documented in `ar-board/ANALISI.md`, `ar-board/PROMPT-ricostruzione.md` and `ar-board/frames/`: a Minecraft-style voxel board (`voxelcraft`) and a Pokémon-style tilemap board with a live Game Boy-palette map screen (`tiletown`). Their look and feel (holographic grid base, black HUD strip with teal accent, BUILD panel, life-size VIEW toggle, grip-move / two-grip scale) is the house style of every other Ologram game.

"Any game" is delivered by tiers: every game gets at least a Tier 4 hologram (a floating screen with holographic
frame) the moment it is added; Tiers 3, 2 and 1 progressively replace the screen with a true 3D scene.

## 2. Non-negotiable product rules

1. **One interaction grammar for every game** (§5.4). A player who learned one Ologram game knows them all.
2. **The game is the source of truth.** The hologram is a live view of game state; player input flows back to the
   game. Never fork game logic inside an adapter when the real game can run.
3. **Screen first, 3D when possible.** Tier 4 must work for any window/stream on day one; higher tiers are
   upgrades, never prerequisites.
4. **Original art only.** No ripped textures, sprites, models or sounds. Asset packs are "in the style of"
   (voxel, low-poly town, dungeon, sci-fi, pixel-billboard). Emulator tiers require the user's own ROMs.
5. **Local by default.** Bridge and Core talk over the LAN with a pairing code; nothing leaves the network unless
   the user enables cloud features.
6. **72 Hz on Quest 3.** Budgets in §8 are hard limits.

## 3. Architecture

```
┌──────────────── Headset (Quest 3 / any WebXR AR device) ────────────────┐
│ Ologram Core (WebXR + three.js + TypeScript, Vite)                       │
│  Library · Board · Renderers (voxel | tile | mesh | sprite | screen)      │
│  Input mapper · HUD/Menu · Save · Forge client                           │
└───────────────▲──────────────────── WebSocket / WebRTC (HSP) ───────────┘
                │
┌───────────────┴──────────────── PC / Mac / mini-PC ─────────────────────┐
│ Ologram Bridge (Node 22 + TypeScript)                                    │
│  Adapter host · HSP encoder · Media (H.264/WebRTC screen) · Pairing      │
│  Adapters: native | emulator | mod | file | capture+vision | screen       │
│  Forge server (LLM + vision tools) — optional, can run in the cloud       │
└──────────────────────────────────────────────────────────────────────────┘
```

Tier 1 adapters can also run **inside the Core** (no PC needed) as Web Workers; the Bridge is required from Tier 2
upward unless the emulator runs in-headset as WASM (allowed for Game Boy / NES class systems).

Stack alternative (same spec): Unity 6 URP + Meta XR All-in-One SDK for the Core, same Bridge.

## 4. Adapter tiers and reference adapters

Each adapter implements the `OlogramAdapter` interface:

```ts
interface OlogramAdapter {
  manifest: { id: string; name: string; tier: 1|2|3|4; genre: string; inputs: InputCapability[]; views: ViewMode[] };
  probe(source: GameSource): Promise<boolean>;         // can I handle this source?
  start(source: GameSource, out: HspSink): Promise<void>;  // begin emitting scene.init + scene.delta
  input(ev: HspInput): void;                            // headset → game
  stop(): Promise<void>;
}
```

### Tier 1 — Native (world generated inside Ologram)
- **`voxelcraft`**: Minecraft-style voxel world. Reproduce the AR Board reference exactly: presets `SMALL 16`,
  `MEDIUM 24`, `LARGE 32`; procedural terraces, oak trees, plank house, sand path, cobblestone patches; items
  PICKAXE/SHOVEL/AXE/HOE/SWORD + DIRT/GRASS/STONE/COBBLESTONE/OAK LOG/OAK PLANKS/SAND/GLASS/OAK LEAVES;
  modes `FREE BUILD` / `COLLECT`; HUD strip strings verbatim; BUILD panel layout; avatar, jump, mobs; save.
  (Full spec: see `ar-board/PROMPT-ricostruzione.md` §2; it is normative.)
- **`tiletown`**: 2D tilemap → 3D world (Pokémon-style town). JSON tilemap + Game Boy-palette PNG, tile → prefab
  table, NPCs, companion, warps to interiors, live 2D map screen synced to player tile. (Spec: same file §3.)
- **`tabletop`**: rules engines for chess, checkers, Go, and a generic card table. Pieces are grabbable; legal-move
  highlights; optional engine opponent (Stockfish WASM for chess).

### Tier 2 — Data (real game state read directly)
- **`emu-gb` / `emu-nes` / `emu-snes`**: emulator (WASM in-headset for GB/NES, PC-side for SNES) + a per-game
  **memory profile** (`profiles/<game-hash>.json`: addresses of map id, player x/y, facing, party/inventory,
  battle flag) + a **tile lift** that decodes the current tilemap from VRAM/ROM banks and classifies tiles into
  the `tiletown` taxonomy. Output: HSP tile scene with entities, plus the raw 2D frame for the map screen.
  Input: HSP inputs → emulator joypad.
- **`minecraft-mod`**: a Fabric mod for real Minecraft Java that streams loaded chunks (block palette + deltas)
  and entities over WebSocket to the Bridge, and accepts movement/actions back. The hologram is the *real*
  server world; the player's in-game character is the avatar.
- **`level-file`**: parsers for open formats (Doom WAD, Quake BSP, Tiled `.tmx/.tmj`, Minecraft `.schematic`)
  producing static HSP scenes with optional live entity feeds when the game exposes them.

### Tier 3 — Visual (screen capture + AI lift)
- **`screen-lift`**: capture a game (window capture on PC, capture card, or Moonlight/Steam Link stream). A
  per-game **lift profile** (generated by Forge) defines: grid size and offset, a tile classifier (small CNN or
  colour-hash LUT trained on the game's tiles), a sprite detector (template matching or lightweight detector),
  and prefab bindings. The adapter emits `scene.delta` at 10–30 Hz with tiles and entity positions, plus the raw
  frame. Latency target ≤ 120 ms glass-to-glass. Fallback per region to Tier 4 when confidence < 0.6.

### Tier 4 — Screen (always available)
- **`holo-screen`**: any window/stream as a curved floating screen (16:9, 1.6 m default) with a holographic
  frame, optional 2.5D parallax from monocular depth (MiDaS-small on the Bridge, 15 Hz), optional stereo split
  for games with SBS output. Inputs: virtual gamepad passthrough (ViGEm on Windows, uinput on Linux).

## 5. Ologram Core — feature spec

### 5.1 Library ("Ologram" home)
World-locked panel with a grid of game cards (cover art, name, tier badge 1–4, source type). Actions: `PLAY`,
`ADD GAME`, `UPGRADE TIER` (opens Forge), `SETTINGS`, `PAIR BRIDGE` (6-digit code shown by the Bridge CLI).
`ADD GAME` sources: built-in world · ROM file (file picker) · Bridge-detected window/process · stream URL ·
level file · tilemap.

### 5.2 Board
`BoardRoot` transform; hit-test placement 1.2 m ahead (fallback 0.7 m above floor); footprint 1 m² at scale 1;
holographic base = translucent grid plane + wireframe border + corner edge lines + bounding-box outline;
accent colour per game (default teal `#2EE6C5`); radial edge fade; base and HUD move with the board.

### 5.3 View modes
- **BOARD**: miniature, third-person avatar or free camera target.
- **LIFE-SIZE**: animate scale to 1 unit = 1 m keeping the avatar's feet on the real floor, then parent the XR
  rig to the avatar's eyes; passthrough remains where there is no geometry; adapters may declare a sky colour.
- **SCREEN**: Tier 4 view; also available as a secondary panel in any tier (the "2D map screen" of `tiletown`).
- **SPLIT**: BOARD + SCREEN side by side (useful for Tier 2/3 to compare with the original).

### 5.4 Unified input grammar (Touch Plus; hand-tracking equivalents in brackets)
| Input | Meaning |
|---|---|
| LEFT GRIP [left pinch] | grab and move the Board |
| BOTH GRIPS [two pinches] | scale / turn the Board |
| B | rotate Board 45° |
| X | toggle BOARD ⇄ LIFE-SIZE |
| Y | open/close game menu (inventory, modes, save) |
| RIGHT TRIGGER [right pinch] | primary action at ray hit (place/mine/select/attack) |
| LEFT STICK | move avatar / player |
| A | jump / confirm |
| RIGHT STICK press + stick | orbit camera target (BOARD) / snap turn (LIFE-SIZE) |
| MENU | Ologram Library |
Adapters map these to game inputs through `InputCapability` declarations; unmapped inputs are shown greyed in the HUD.

### 5.5 HUD strip and menus
Black panel `#050607`, accent border, condensed uppercase white text, attached to the Board's front edge. Row 0:
selected item / status (left) and world label (right); rows 1–3: the input hints of the current adapter,
generated from its `InputCapability` list in the exact style `STICK MOVE  A JUMP  TRIGGER PLACE`. Game menu =
world-locked tablet panel 0.55 × 0.85 m with the adapter's sections (e.g. `BUILD` for `voxelcraft`), footer
buttons and the hint row `Y MENU  A JUMP  B ROTATE  X VIEW`.

### 5.6 Renderers
- `VoxelRenderer`: chunked meshes, 16 px atlas, nearest filtering, vertex AO, alpha-tested foliage.
- `TileRenderer`: instanced prefabs per tile class, ground quads, water shader, merged building volumes.
- `MeshRenderer`: glTF scenes from `level-file`, lightmapped or flat.
- `SpriteRenderer`: billboards with pixel-art textures for Tier 2/3 entities that have no 3D prefab yet.
- `ScreenRenderer`: WebRTC video texture on a curved quad; optional depth-parallax displacement.

### 5.7 Saves and profiles
Board pose, scale, view mode and per-game state (for Tier 1) in IndexedDB; export/import as `.ologram` JSON.

### 5.8 Multiplayer (phase 2)
Colocated co-op via shared spatial anchor + Bridge relay; remote spectators via WebRTC.

## 6. Holo Scene Protocol (HSP) v1

Transport: WebSocket (JSON, `scene.*`), plus a binary channel (`bin.*`, MessagePack) for voxel chunks and
frames. All coordinates in **game units** on a right-handed grid; the Core converts to Board space.

```jsonc
// Bridge → Core
{ "t": "hello", "hsp": 1, "adapter": "emu-gb", "tier": 2, "game": { "id": "...", "name": "...", "accent": "#2EE6C5" },
  "grid": { "cell": 1.0, "w": 40, "h": 36, "layers": ["ground","props","entities"] },
  "inputs": ["stick.move","a.jump","trigger.act","y.menu"], "views": ["board","life","screen","split"] }
{ "t": "scene.init", "tiles": [{ "l": "ground", "x": 0, "y": 0, "k": "grass" }, ...],
  "entities": [{ "id": "player", "k": "avatar.trainer", "x": 5, "y": 7, "yaw": 90, "anim": "idle" }],
  "volumes": [{ "k": "house.white", "x": 10, "y": 3, "w": 4, "h": 3, "rot": 0 }],
  "warps": [{ "x": 12, "y": 5, "to": "center-interior" }] }
{ "t": "scene.delta", "seq": 1234, "set": [...], "del": [...], "ent": [{ "id": "player", "x": 6, "y": 7, "anim": "walk" }] }
{ "t": "voxel.chunk", "cx": 0, "cy": 0, "cz": 0, "size": 16, "palette": ["air","grass","dirt"], "data": "<bin ref>" }
{ "t": "frame", "codec": "h264|jpeg", "w": 160, "h": 144, "data": "<bin ref>" }    // 2D screen / capture
{ "t": "hud", "left": "COBBLESTONE · UNLIMITED", "right": "MEDIUM 24", "rows": ["STICK MOVE  A JUMP  TRIGGER PLACE", "..."] }
{ "t": "event", "k": "warp|battle|damage|pickup", "data": {} }

// Core → Bridge
{ "t": "input", "k": "stick.move", "x": 0.3, "y": -1.0 }
{ "t": "input", "k": "trigger.act", "hit": { "x": 5, "y": 2, "z": 7, "face": "+y" } }
{ "t": "view", "mode": "life" }
{ "t": "menu", "action": "select", "item": "PICKAXE" }
```

Rules: `scene.init` ≤ 2 MB; deltas ≥ 10 Hz for Tier 2/3; sequence numbers; Core requests `scene.init` again on
gap; unknown tile kinds render as a neutral grey cube with the label so Forge can bind them later.

## 7. Ologram Forge — AI adapter builder

A CLI + panel in the Core. Input: game name, tier target, and evidence (screen recordings, screenshots, ROM
hash, mod API docs). Pipeline (LLM with tools; use Claude with vision, model id `claude-fable-5-1` or the best
available):
1. **Analyse** footage frame-by-frame (extract frames with ffmpeg, cluster tiles, detect sprites, read UI text).
2. **Taxonomy**: propose tile and entity classes, mapped onto the shared Ologram taxonomy (`grass, path, tree,
   hedge, fence, sign, lamp, bench, water, wall, floor, door, house.*, npc.*, item.*, enemy.*`), extending it
   only when necessary.
3. **Bindings**: produce `prefab-bindings.json` (class → asset pack prefab), an **asset brief** for missing
   prefabs (original, in-style), and for emulators a candidate **memory profile** verified by scripted play
   (move the player and confirm addresses change).
4. **Lift profile** (Tier 3): grid calibration, colour-hash LUT / tiny classifier trained from the footage,
   sprite templates.
5. **Generate** the adapter package (`adapters/<id>/`), run the acceptance suite (§10), and open the result in
   the Core with `SPLIT` view for human validation. Keep a `forge-report.md` with confidence per class.

Ship a reusable sub-prompt template `forge/prompts/analyse-game.md` that instructs the model to output the
taxonomy, bindings and memory profile as JSON.

## 8. Performance and quality budgets
- Core: 72 Hz, ≤ 8 ms CPU frame, ≤ 250k triangles in BOARD, ≤ 600k in LIFE-SIZE, ≤ 60 draw calls per renderer.
- Bridge → Core: ≤ 1 Mbit/s for HSP deltas, ≤ 8 Mbit/s for `frame` at 720p30.
- Tier 3 latency ≤ 120 ms; Tier 4 ≤ 60 ms (WebRTC).
- Chunk meshing in Web Workers; no allocation in the render loop; texture atlases ≤ 2048².

## 9. Milestones (each one runnable on the headset)
- **M0** Repo, CI, HTTPS dev server, AR session with Board + base + grab/scale/rotate + Library shell.
- **M1** Tier 1 `voxelcraft` complete (HUD, BUILD panel, modes, avatar, mobs, LIFE-SIZE, save).
- **M2** Tier 1 `tiletown` + `tabletop` (chess).
- **M3** Bridge + HSP + Tier 4 `holo-screen` with WebRTC and virtual gamepad passthrough.
- **M4** Tier 2 `emu-gb` in-headset WASM with one memory profile and tile lift; `SPLIT` view.
- **M5** Tier 2 `minecraft-mod` (Fabric) streaming a real world; `level-file` (Tiled, WAD).
- **M6** Tier 3 `screen-lift` with one lift profile; Forge CLI producing that profile from footage.
- **M7** Polish: haptics, edge fades, onboarding, `.ologram` export, colocated multiplayer (phase 2).

## 10. Acceptance suite
- Board can be placed on a bed, dragged with left grip, scaled with both grips, rotated with B; HUD follows.
- X enters LIFE-SIZE with the avatar's feet on the real floor and returns to the same Board pose.
- `voxelcraft` matches the reference frames (`ar-board/frames/mc-*.jpg`) string for string.
- `tiletown` matches `pk-*.jpg`, including the live 2D map screen and the interior warp.
- Any desktop window appears as a Tier 4 hologram within 10 s of `ADD GAME`, with working gamepad passthrough.
- `emu-gb` shows the player's position moving on the 3D board in sync with the 2D frame (≤ 2 frames lag).
- `minecraft-mod` renders a real server's chunks around the player and propagates a placed block both ways.
- Forge produces a valid adapter package for a new 2D game from a 60-second recording without manual edits,
  with ≥ 80 % tile classes above 0.6 confidence.

## 11. Repository layout
```
ologram/
  apps/core/          # WebXR app (Vite, three.js, TS)
  apps/bridge/        # Node service, adapter host, media, pairing
  packages/hsp/       # protocol types, encoder/decoder, validators
  packages/adapters/  # voxelcraft, tiletown, tabletop, emu-gb, minecraft-mod, level-file, screen-lift, holo-screen
  packages/assets/    # original asset packs (voxel, town, dungeon, scifi, pixel)
  packages/forge/     # CLI + prompts + tools (ffmpeg, frame clustering, classifier training)
  mods/minecraft-fabric/
  docs/               # DECISIONS.md, HSP spec, adapter authoring guide
```
Use pnpm workspaces, strict TypeScript, ESLint, Vitest, Playwright for the Core UI, and a `just`/`make` target
`dev` that starts the Bridge and the HTTPS Core with the pairing code printed.
