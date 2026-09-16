# Prompt di ricostruzione esatta — "AR Board" (Minecraft + Pokémon in mixed reality)

Come usarlo: copia tutto ciò che segue la riga `=== PROMPT ===` e incollalo in Claude Code / Cursor / ChatGPT
insieme alle immagini in `frames/`. Il prompt è in inglese perché tutte le stringhe UI del progetto originale lo sono.
Se preferisci Unity al posto di WebXR, cambia solo la sezione "0. Stack".

=== PROMPT ===

You are a senior XR engineer. Build **"AR Board"**, a mixed-reality app for Meta Quest 3 that renders a game world as a
tabletop diorama anchored on real furniture (a bed), lets the user grab / scale / rotate it, and switch to a 1:1
first-person view inside the room. Two worlds must be delivered: **(A) a Minecraft-style voxel world** and
**(B) a Pokémon-style world generated from a 2D Game Boy tilemap**. Reproduce the reference screenshots in `frames/`
as faithfully as possible: same layout, same UI strings, same colors, same interaction mapping. Do not ask
questions; where something is unspecified, pick the choice closest to the screenshots.

## 0. Stack (default)

- **WebXR + three.js + TypeScript + Vite**, running in Meta Quest Browser as an `immersive-ar` session
  (color passthrough is automatic in AR mode). Required/optional features: `local-floor`, `hand-tracking`,
  `hit-test`, `anchors`, `plane-detection` (optional), `layers` (optional).
- Input via WebXR Gamepad API (Touch Plus mapping: trigger=0, grip=1, thumbstick=2/3 axes, A/X=4, B/Y=5,
  thumbstick press=3) plus hand-tracking joints for the free left hand (pinch = grip).
- Serve over HTTPS (Vite `--host` + mkcert or `vite-plugin-mkcert`) so the headset can open it on the LAN.
- Alternative (same spec applies): Unity 6 URP + Meta XR All-in-One SDK (Passthrough, Interaction SDK ray/grab,
  MRUK for surface anchoring) building an APK.

## 1. Core: the Board

`BoardRoot` is a single transform node. Everything of a world lives under it, so translating/scaling/rotating
`BoardRoot` moves the whole diorama and its HUD together.

- **Default pose:** on session start, do a hit-test on the real world 1.2 m in front of the user; place BoardRoot
  on the hit point (fallback: 0.7 m above floor, 1.2 m ahead). Board footprint: 1.0 m × 1.0 m at scale 1 for the
  MEDIUM preset; the diorama is centred on the board and its ground level sits on the surface.
- **Holographic base:** a flat translucent grid plane (teal `#2EE6C5` lines on `rgba(10,40,45,0.35)`, cell 1/24 of
  the board width, additive blending) extending ~15 % beyond the world footprint, with a teal wireframe rectangle
  as border and four short vertical teal edge lines at the corners. Thin teal lines also outline the world's
  vertical bounding box (see `mc-01`, `mc-07`).
- **HUD strip** (world A only): a black opaque panel `#050607` attached to the **front edge** of the board, lying
  almost flat (tilted ~15° toward the user), width = board width, height = 18 % of board width, teal 2 px
  border + one teal horizontal separator under the first text row. White condensed uppercase sans-serif text
  (e.g. "Barlow Condensed"/"Oswald", tracking +2 %). Text content is defined in §2.6.
- **Manipulation (both worlds):**
  - **LEFT GRIP** held (or left-hand pinch): BoardRoot follows the left controller/hand pose delta (translate +
    yaw). Release = drop in place, keep it there (world-locked).
  - **BOTH GRIPS** held: two-handed scale / turn: scale factor = current hand distance / initial distance
    (clamp 0.25 – 12), yaw = angle change of the hand-to-hand vector.
  - **B** (right): rotate BoardRoot by +45° yaw around its centre (animated 200 ms).
- **VIEW mode toggle (X):** switch between *Board view* (miniature, third-person avatar) and *Life-size view*:
  animate BoardRoot scale to `1 block = 1 m` over 600 ms while keeping the avatar's feet position fixed on the
  real floor, then parent the XR camera rig to the avatar so the user is *inside* the world at the avatar's eye
  height (1.62 m). In life-size view the passthrough stays visible where there is no geometry (sky = passthrough;
  see `mc-05`, `mc-06`). Press X again to return to the previous board pose.

## 2. World A — Minecraft-style voxel world

### 2.1 Voxel engine
- Block grid, block size 1 unit under BoardRoot. Chunked mesher (16×16×16), greedy or naive faces with
  per-face UVs on a 16 px texture atlas. Write your own original 16×16 pixel-art textures (no Mojang assets):
  GRASS (green top `#5FBF3A`, dirt sides), DIRT `#7A4A2A`, STONE grey `#8A8A8A`, COBBLESTONE (grey stones with
  dark mortar), SAND `#E2CF8E`, OAK LOG (brown bark, ring top), OAK PLANKS `#C2843A` with dark plank lines (the
  house colour in `mc-01`), OAK LEAVES (bright green with holes, alpha-tested), GLASS (transparent with light
  frame). Nearest-neighbour filtering, no mipmaps, flat lighting + simple AO on vertex.
- Raycast (DDA) from the right controller ray for targeting; max distance 8 blocks in life-size view, unlimited
  on the board.
- **Target highlight:** in place mode, the face-adjacent empty cell is outlined with a teal wireframe cube; in mine
  mode the targeted block gets a red translucent overlay and a small red pickaxe glyph billboard at the ray hit
  (see `mc-08`). The ray itself is a thin teal line from the controller to the hit point.

### 2.2 World generation (deterministic, seeded)
Presets (name and side length in blocks) exactly as shown in the HUD: **`SMALL 16`**, **`MEDIUM 24`** (default),
**`LARGE 32`**. Height 24. Generator:
1. Heightmap = 2-octave value noise, quantised into 3–4 terraces (grass top, 1–2 dirt layers, stone below), so
   the terrain shows stepped grass edges like `mc-01`.
2. 6–12 oak trees (trunk 3–4 logs, 5×5×3 leaf blob with corners removed), mostly near the border.
3. One **oak-plank house** (7×5 footprint, 3 high, stepped plank roof, 1-block doorway, one glass window) placed
   right of centre.
4. A 2-wide **sand path** running from the front edge toward the house.
5. Two decorative cobblestone patches: a 4×4 checkerboard of cobblestone/stone flush with the ground, and a small
   3-block cobblestone pillar.
6. (LARGE only) an extra 3×3 tilled-dirt patch and more trees.
7. Spawn the player avatar on the grass near the centre.

### 2.3 Items (inventory)
Tools (diamond look: teal `#3DE0C3` head, brown stick): `PICKAXE`, `SHOVEL`, `AXE`, `HOE`, `SWORD`.
Blocks: `DIRT`, `GRASS`, `STONE`, `COBBLESTONE`, `OAK LOG`, `OAK PLANKS`, `SAND`, `GLASS`, `OAK LEAVES`.
Each block has a count; in FREE BUILD mode the count is the literal string `UNLIMITED`.

### 2.4 Modes
- **FREE BUILD** (default): all blocks `UNLIMITED`, trigger places the selected block (or mines if a tool is
  selected), no damage.
- **COLLECT**: mined blocks are added to the inventory counts, placing consumes them, the correct tool mines
  faster (pickaxe → stone/cobblestone, axe → logs/planks, shovel → dirt/grass/sand), the sword hits mobs.
- The toggle line in the BUILD panel reads `FREE BUILD  ·  SWITCH TO COLLECT` (and `COLLECT  ·  SWITCH TO FREE
  BUILD` when in COLLECT).

### 2.5 Avatar and mobs
- Player avatar: 2-unit-tall blocky humanoid in the classic look (dark hair, cyan shirt, blue trousers), animated
  walk cycle, holds the selected tool in the right hand.
- In Board view the avatar walks on the diorama driven by the left thumbstick (relative to the user's view
  direction), `A` = jump, gravity + voxel collision. In life-size view the same locomotion moves the camera rig
  (head-relative), still with jump and collisions.
- Mobs: 1–3 hostile humanoids with the same body but green skin and darker clothes, spawn on grass at the far
  side of the board, wander, and in COLLECT mode walk toward the player and deal damage on contact
  (simple health bar bottom-left of the HUD strip). Sword hits knock them back; 3 hits kill.

### 2.6 HUD strip — exact strings
```
top-left  : <SELECTED ITEM NAME>                (block: "COBBLESTONE · UNLIMITED" / tool: "PICKAXE")
top-right : <PRESET NAME> <SIZE>                ("MEDIUM 24", "LARGE 32")
row 1     : STICK MOVE    A JUMP    TRIGGER PLACE        (TRIGGER MINE when a tool is selected)
row 2     : X VIEW    Y INVENTORY    B ROTATE    R-STICK HOLD
row 3     : LEFT GRIP MOVE BOARD    BOTH GRIPS SCALE / TURN
```
Rows 1–3 are centred; top-left/right are ~1.4× larger. See `mc-hud-text.jpg` and `mc-hud-text-2.jpg`.
`R-STICK HOLD`: holding the right thumbstick pressed lets the right stick orbit/tilt the board view camera
target (board view) or snap-turn (life-size).

### 2.7 BUILD panel — exact layout (see `mc-build-panel-zoom.jpg`)
Opened/closed with **Y**. A world-locked black panel `#050607`, 0.55 m × 0.85 m, teal 2 px border, spawned 0.8 m in
front of the user's head, facing the user, slightly tilted back. Content, top to bottom:
```
BUILD                                             RIGHT TRIGGER / SELECT
row A (3 cols):   PICKAXE   SHOVEL   AXE            ← tool icons (3D diamond tools, teal)
row B (2 cols, centred): HOE   SWORD
row C (3 cols):   DIRT UNLIMITED     GRASS UNLIMITED     STONE UNLIMITED
row D (3 cols):   COBBLESTONE UNL.   OAK LOG UNL.        OAK PLANKS UNL.
row E (3 cols):   SAND UNLIMITED     GLASS UNLIMITED     OAK LEAVES UNLIMITED
footer 1 (centred): FREE BUILD  ·  SWITCH TO COLLECT      ← button toggling the mode
footer 2 (centred): SAVE & CLOSE                           ← button
footer 3 (tiny, centred): Y MENU    A JUMP    B ROTATE    X VIEW
```
Each cell = a small 3D icon (rotating cube with the block texture, or the tool model) + label under it +
count to the right in dim grey. Hover from the right-controller ray turns the cell into a filled teal
`#2EE6C5` rounded card with dark text; **right trigger** selects (sets the HUD top-left label and closes nothing).
`SAVE & CLOSE` serialises the voxel world + board pose to `localStorage` (or IndexedDB) and hides the panel; the
world is restored on next launch.

### 2.8 Controls summary (Touch Plus)
| Input | Board view | Life-size view |
|---|---|---|
| Left stick | move avatar on the board | move player |
| A | avatar jump | jump |
| Right trigger | place / mine at ray hit (or select in BUILD panel) | same |
| X | enter life-size view | back to board view |
| Y | open/close BUILD panel | same |
| B | rotate board 45° | rotate board 45° (world) |
| Right stick press (hold) + stick | orbit/tilt camera target | snap turn |
| Left grip / left pinch | grab and move the board | — |
| Both grips | scale / turn the board | — |

## 3. World B — Pokémon-style world from a 2D Game Boy tilemap

### 3.1 Input
A tilemap in JSON: `{ width, height, tiles: string[][], warps: [{x,y,to,tx,ty}], npcs: [{x,y,type,path}] }`
plus a PNG rendering of the same map in the 4-tone Game Boy green palette (`#E0F8D0 #88C070 #346856 #081820`).
Ship two maps: an outdoor town (grass field bordered by round trees, a fence row, hedges, signposts, one plain
house with yellow trim, one Pokémon-Center-style building with a red roof, a pond with stone rim, lamp posts, a
bench) and the interior of the Center (counter with red stripe, nurse behind it, PC on the left, sliding glass
doors), connected by a warp on the Center door. Do not copy Nintendo tiles or sprites; draw original look-alikes.

### 3.2 Tile → 3D prefab mapping (1 tile = 1 unit under BoardRoot)
| tile | prefab |
|---|---|
| `grass` | flat ground quad, light green `#BFE3A0`, scattered grass tufts |
| `path` | sandy quad `#D9D0A8` |
| `tree` | round-canopy low-poly tree, 2 units tall |
| `hedge` | 0.5-unit-high green box row |
| `fence` | wooden fence segment, joins with neighbours |
| `sign` | small green signpost |
| `lamp` | black lamp post 2.5 units |
| `bench` | wooden bench |
| `water` | animated blue plane with stone rim |
| `house_*` | one white house with yellow/blue trim per bounding box of the tile group |
| `center_*` | one Pokémon-Center-style building (white walls, red rounded roof, red-striped column, glass front) |
| `door` | warp trigger volume in front of the building |
| `counter` / `pc` / `wall` / `floor` | interior pieces for the Center |

### 3.3 Characters
- Trainer avatar (low-poly boy, blue shirt, cap) walking with the left stick; a yellow mouse-like companion
  (original design in the spirit of `pk-04`) follows one tile behind and, in life-size view, runs toward the
  player and idles in front of them.
- 2–3 NPCs walking simple patrol paths; a pink-haired nurse behind the counter inside the Center.

### 3.4 Live 2D map screen
A world-locked panel (0.9 m × 0.8 m, thin black bezel) placed on the nearest real wall to the right of the
board (hit-test), rendering the **same tilemap** in the Game Boy palette with the player sprite and companion
sprite at the player's current tile, updated every frame (`pk-02`). In life-size view a smaller copy (0.6 m)
floats 1.5 m ahead-right of the player (`pk-04`); after a warp it shows the interior map (`pk-05`).

### 3.5 Board and view
Same BoardRoot, grid base (blue tint `#4A7BFF` at 30 % instead of teal), grab / scale / rotate, X toggles
life-size view with sky-blue background `#1E4FD8` replacing passthrough above the horizon (as in `pk-04`).
No HUD strip in this world.

## 4. Visual and UX details to match
- Teal accent everywhere in world A: `#2EE6C5`; panel black `#050607`; text white `#F2F2F2`; dim labels `#9AA0A6`.
- Voxel textures nearest-filtered, flat unlit look with slight vertex AO; leaves alpha-tested.
- Board base fades out at the edges (radial alpha) so it blends with the bed.
- 72 Hz target; chunk rebuilds off the main thread (worker) or amortised per frame.
- Haptic pulse on place/mine/select (20 ms).

## 5. Project layout and milestones
```
/src
  main.ts            – XR session, render loop
  xr/input.ts        – controller + hand mapping (§2.8)
  board/BoardRoot.ts – grid base, border, grab/scale/rotate, view toggle
  voxel/{World,Chunk,Mesher,Generator,Raycast}.ts
  voxel/items.ts     – item table (§2.3)
  ui/HudStrip.ts     – §2.6 (canvas texture → plane)
  ui/BuildPanel.ts   – §2.7
  entities/{Avatar,Mob}.ts
  tilemap/{Loader,Converter,MapScreen}.ts – §3
  assets/textures/*.png, assets/maps/*.json|png, assets/models/*.glb
```
Deliver in this order, each step runnable on the headset: (1) AR session + BoardRoot + grid base + grab/scale;
(2) voxel world MEDIUM 24 with generator and HUD strip; (3) targeting, place/mine, BUILD panel, modes, save;
(4) avatar, jump, life-size VIEW; (5) mobs; (6) tilemap loader + converter + 2D map screen; (7) warps and
interior; (8) polish (fades, haptics, performance).

## 6. Acceptance checklist (compare with `frames/`)
- [ ] Diorama sits on a real surface with teal grid base and HUD strip on the front edge (`mc-01`).
- [ ] HUD shows `COBBLESTONE · UNLIMITED` / `MEDIUM 24` and the three hint rows verbatim (`mc-hud-text`).
- [ ] Left grip drags the board with its HUD; both grips scale it; B rotates it (`mc-02`, `mc-03`).
- [ ] Y opens the BUILD panel with the exact 5 tools + 9 blocks, footer buttons and hover card (`mc-04`).
- [ ] X puts the user inside a life-size world with the avatar visible next to a highlighted block (`mc-05`, `mc-06`).
- [ ] Ray + red pickaxe cursor in mine mode, teal wireframe in place mode (`mc-08`).
- [ ] Pokémon-style board built from the tilemap, with a live Game Boy-palette screen on the wall (`pk-01`, `pk-02`).
- [ ] Life-size town with companion running to the player and a floating 2D map (`pk-04`).
- [ ] Walking through the Center door warps to the interior and the 2D screen switches to the interior map (`pk-05`).
