# Morgott, il Re dei Presagi — prompt pack

- **Manifest id:** `morgott` · **Altezza da lore:** ~3.5 m
- **Silhouette:** Omen regale e curvo, corona di corna ricurve, lunga veste oro-bruno stracciata, spada ricurva dorata lunghissima.
- **Palette:** oro bruno `#6b5a3a`, ombra `#2e2a22`, luce dorata `#f0c85a`

## 1. Text-to-3D corto (Meshy / Tripo)
```
Elden Ring inspired dark fantasy boss: tall hunched Omen king, crown of many curling horns
growing from his head, long tattered royal robes in faded gold and brown with regal
embroidery, face partly wrapped, long clawed hands, right hand holding a very long curved
greatsword of tarnished gold with an ornate hilt, gaunt regal posture. Single full-body
character, A-pose, weapon attached to right hand, game-ready PBR, high detail, no base.
```

## 2. Text-to-3D esteso (Rodin / Hunyuan3D / TRELLIS)
```
Dark fantasy character inspired by FromSoftware's Elden Ring: grim, gothic, ornate and weathered.
A very tall Omen king with a hunched, tired posture. A crown of many curling ram-like horns grows
from his skull, some broken; his face is gaunt, grey and partly wrapped in old bandages, with
golden glowing eyes. He wears long layered royal robes of faded gold brocade and brown wool,
torn at the hems, with a heavy embroidered mantle and a tarnished gold chain of office. Long
clawed grey hands; the right one grips an extremely long, slender curved greatsword of tarnished
gold with a hilt shaped like twisted roots. Realistic proportions (tall, long limbs, narrow),
muted palette with old gold accents. Full body, single character, A-pose, feet flat, facing
forward, weapon attached to the right hand. Game-ready, clean topology, PBR materials, no base,
no props.
```

## 3. Character sheet per image-to-3D
```
Character reference sheet, three orthographic views side by side (front, left side, back), same
character and scale, neutral flat gray background, soft even studio light, A-pose, weapon
attached to the right hand, ultra detailed, 8k. Subject: a tall hunched Omen king with a crown of
curling horns, gaunt bandaged grey face with golden eyes, long torn robes of faded gold brocade
and brown wool, clawed hands holding a very long curved tarnished-gold greatsword, dark fantasy
Elden Ring style.
```

## 4. Retexture / rifinitura HD
```
Robes: faded gold brocade with worn embroidery, brown wool underlayers, dust, frayed hems. Horns:
keratin with cracks and darker tips. Skin: grey, wrinkled, bandages stained. Sword: tarnished
gold with warm emissive runes along the blade (subtle), root-shaped hilt. 4K PBR.
```

## 5. Animazioni
| Clip | Cerca in Mixamo | Note |
| --- | --- | --- |
| Idle | "Great Sword Idle" | |
| Walk | "Great Sword Walk" | |
| Attack1 | "Great Sword Slash" | hitTime 0.42 |
| Attack2 | "Standing Melee Attack Horizontal" | hitTime 0.5 |
| Hit | "Great Sword Impact" | |
| Death | "Standing Death Backward" | |

## 6. Manifest
```json
{ "id": "morgott", "name": "Morgott, il Re dei Presagi", "short": "Morgott", "model": "models/morgott.glb",
  "loreHeight": 3.5, "color": "#c9a44a",
  "stats": { "hp": 140, "attack": 18, "speed": 0.6, "range": 0.55, "cooldown": 1.5 },
  "hitTime": { "Attack1": 0.42, "Attack2": 0.5 } }
```
