# Rennala, Regina della Luna Piena — prompt pack

- **Manifest id:** `rennala` · **Altezza da lore:** ~2.2 m
- **Silhouette:** regina-maga in vesti fluenti blu-viola, alto copricapo dorato a falce di luna, grande uovo d'ambra stretto al petto, bastone sottile.
- **Palette:** blu Caria `#2b3a7a`, notte `#1c2352`, luce lunare `#a7b7ff`

## 1. Text-to-3D corto (Meshy / Tripo)
```
Elden Ring inspired dark fantasy boss: regal sorceress queen in flowing layered robes of deep
blue and violet with gold embroidery, tall golden crescent-moon headdress, long pale hair,
left arm cradling a large glowing translucent amber egg, right hand holding a slender ornate
staff, ethereal and melancholic. Single full-body character, A-pose, staff attached to right
hand, game-ready PBR, high detail, no base.
```

## 2. Text-to-3D esteso (Rodin / Hunyuan3D / TRELLIS)
```
Dark fantasy character inspired by FromSoftware's Elden Ring: grim, gothic, ornate and weathered.
A tall regal sorceress queen with a serene, sorrowful face and long pale silver-blonde hair. She
wears many layers of flowing academic robes in deep blue and violet velvet with gold thread
embroidery of moons and stars, a wide collar, and a tall golden headdress shaped like a crescent
moon with hanging chains. Her left arm cradles a large translucent amber egg glowing softly from
inside; her right hand holds a slender staff of dark wood topped with a small blue crystal.
Realistic proportions, elegant posture, muted palette lit by cold blue moonlight with gold
accents. Full body, single character, A-pose, feet hidden under the robe hem touching the
ground, facing forward, staff attached to the right hand. Game-ready, clean topology, PBR
materials, translucent amber material for the egg, no base, no props.
```

## 3. Character sheet per image-to-3D
```
Character reference sheet, three orthographic views side by side (front, left side, back), same
character and scale, neutral flat gray background, soft even studio light, A-pose, staff attached
to the right hand, ultra detailed, 8k. Subject: a tall sorceress queen in layered blue-violet
velvet robes with gold moon embroidery, tall golden crescent headdress, long pale hair, cradling
a glowing amber egg in the left arm and a slender crystal staff in the right hand, dark fantasy
Elden Ring style.
```

## 4. Retexture / rifinitura HD
```
Robes: deep blue and violet velvet with fine gold-thread embroidery (moons, stars), soft sheen,
worn gold trim. Headdress: polished gold with small scratches, hanging fine chains. Egg:
translucent warm amber with inner glow (emissive), subsurface look. Staff: dark lacquered wood,
blue crystal emissive tip. Skin: pale, porcelain-like. 4K PBR.
```

## 5. Animazioni
| Clip | Cerca in Mixamo | Note |
| --- | --- | --- |
| Idle | "Standing Idle" / "Female Standing Pose" | |
| Walk | "Female Walk" / "Walking" | |
| Attack1 | "Standing 1H Magic Attack 01" | hitTime 0.5 (colpo a distanza: `range` alto) |
| Attack2 | "Standing 2H Magic Attack 01" | hitTime 0.55 |
| Hit | "Standing React Small From Front" | |
| Death | "Standing Death Forward" | |

## 6. Manifest
```json
{ "id": "rennala", "name": "Rennala, Regina della Luna Piena", "short": "Rennala", "model": "models/rennala.glb",
  "loreHeight": 2.2, "color": "#6e7fd6",
  "stats": { "hp": 100, "attack": 20, "speed": 0.4, "range": 0.9, "cooldown": 2.2 },
  "hitTime": { "Attack1": 0.5, "Attack2": 0.55 } }
```

## 7. Variante
- **Fase 2 (Luna Piena):** "levitating, robes billowing, a huge pale full moon behind her, spectral
  blue glow" — perfetta con lo stile *Spirito*.
