# Godfrey, il Primo Lord Ancestrale — prompt pack

- **Manifest id:** `godfrey` · **Altezza da lore:** ~3.6 m
- **Silhouette:** re guerriero colossale a petto nudo, lunghi capelli e barba dorati, ascia da battaglia enorme; sulla schiena si aggrappa una bestia-leone dalla criniera dorata (Serosh).
- **Palette:** cuoio `#6a5233`, pelle abbronzata `#d2a377`, oro `#e4b96a`, acciaio

## 1. Text-to-3D corto (Meshy / Tripo)
```
Elden Ring inspired dark fantasy boss: colossal muscular warrior king with bare scarred chest,
long golden hair and thick braided beard, ornate gold-trimmed leather armor pieces, fur cape,
a huge golden double-headed battle axe in the right hand, a golden-maned lion beast clinging to
his back with its head over his shoulder. Single full-body character, A-pose, weapon attached
to right hand, game-ready PBR, high detail, no base.
```

## 2. Text-to-3D esteso (Rodin / Hunyuan3D / TRELLIS)
```
Dark fantasy character inspired by FromSoftware's Elden Ring: grim, gothic, ornate and weathered.
A colossal, heavily muscular warrior king standing tall and proud. His chest is bare and covered
in old scars; he wears a wide gold-trimmed leather belt, ornate bracers, a layered leather skirt
with gold plates, and a heavy fur cape over one shoulder. His face is stern, framed by long golden
hair and a thick braided golden beard; his eyes glow faintly gold. His right hand grips a gigantic
double-headed battle axe of weathered gold and steel with an engraved haft. Clinging to his back,
with its great maned head resting over his left shoulder, is a golden-maned lion-like beast with
regal features and closed eyes. Realistic proportions exaggerated for size (huge torso, thick
arms), muted palette with warm gold accents. Full body, single character, A-pose, feet flat,
facing forward, weapon attached to the right hand. Game-ready, clean topology, PBR materials,
no base, no props.
```

## 3. Character sheet per image-to-3D
```
Character reference sheet, three orthographic views side by side (front, left side, back), same
character and scale, neutral flat gray background, soft even studio light, A-pose, weapon
attached to the right hand, ultra detailed, 8k. Subject: a colossal bare-chested warrior king
with long golden hair and braided beard, gold-trimmed leather armor, fur cape, huge golden
double-headed battle axe, a golden-maned lion beast clinging to his back with its head over his
shoulder, dark fantasy Elden Ring style.
```

## 4. Retexture / rifinitura HD
```
Skin: tanned, scarred, oily sheen. Hair/beard: golden blond, braided with gold rings. Leather:
dark oiled brown with gold plates and wear. Fur: thick grey-brown. Axe: weathered gold heads with
engraved runes, notched edges, steel core, wrapped haft. Beast: golden mane, pale fur. 4K PBR.
```

## 5. Animazioni
| Clip | Cerca in Mixamo | Note |
| --- | --- | --- |
| Idle | "Great Sword Idle" | |
| Walk | "Great Sword Walk" | |
| Attack1 | "Great Sword Slash" | hitTime 0.45 |
| Attack2 | "Standing Melee Attack Downward" (schianto a terra) | hitTime 0.5 |
| Hit | "Great Sword Impact" | |
| Death | "Standing Death Backward" | |
| Victory | "Mutant Roaring" | opzionale |

## 6. Manifest
```json
{ "id": "godfrey", "name": "Godfrey, il Primo Lord Ancestrale", "short": "Godfrey", "model": "models/godfrey.glb",
  "loreHeight": 3.6, "color": "#b08d57",
  "stats": { "hp": 180, "attack": 22, "speed": 0.55, "range": 0.6, "cooldown": 1.6 },
  "hitTime": { "Attack1": 0.45, "Attack2": 0.5 } }
```

## 7. Variante
- **Hoarah Loux:** senza ascia e senza bestia, "bare-handed, roaring, wild stance"; animazioni Mixamo
  "Mutant Punch" / "Mutant Swiping"; `"range": 0.4`, `"cooldown": 1.1`.
