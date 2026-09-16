# Mohg, Signore del Sangue — prompt pack

- **Manifest id:** `mohg` · **Altezza da lore:** ~3.6 m
- **Silhouette:** Omen cornuto, volto nascosto da un cappuccio nero, vesti cerimoniali rosso sangue e oro, grande tridente dorato contorto.
- **Palette:** sangue `#5a1622`, notte `#2a0b12`, fiamma rossa `#ff3b4e`, oro `#d4a052`

## 1. Text-to-3D corto (Meshy / Tripo)
```
Elden Ring inspired dark fantasy boss: tall horned Omen lord, black hood and cowl completely
hiding the face, long curved horns, ornate crimson and gold ceremonial robes soaked in blood,
clawed hands, right hand gripping a large twisted golden trident with three prongs and blood-red
flame motifs, regal and sinister. Single full-body character, A-pose, weapon attached to right
hand, game-ready PBR, high detail, no base.
```

## 2. Text-to-3D esteso (Rodin / Hunyuan3D / TRELLIS)
```
Dark fantasy character inspired by FromSoftware's Elden Ring: grim, gothic, ornate and weathered.
A tall Omen lord with a slightly hunched, ceremonial posture. Two long curved horns rise from
under a black hood and cowl that hide his face in shadow. He wears layered ceremonial robes of
deep crimson velvet and gold brocade with sacred embroidery, stained and dripping with dark
blood, a wide ornate collar and heavy gold chains. His hands are grey and clawed; the right one
grips a very large twisted trident of dark gold with three barbed prongs and engraved flame
motifs. Realistic proportions (tall, long arms), muted palette with crimson and dark gold
accents. Full body, single character, A-pose, feet flat, facing forward, weapon attached to the
right hand. Game-ready, clean topology, PBR materials, no base, no props.
```

## 3. Character sheet per image-to-3D
```
Character reference sheet, three orthographic views side by side (front, left side, back), same
character and scale, neutral flat gray background, soft even studio light, A-pose, trident
attached to the right hand, ultra detailed, 8k. Subject: a tall horned Omen lord in a black hood
hiding the face, blood-soaked crimson and gold ceremonial robes, clawed hands, holding a large
twisted golden trident, dark fantasy Elden Ring style.
```

## 4. Retexture / rifinitura HD
```
Robes: crimson velvet and gold brocade, wet dark blood stains (glossy where fresh), gold chains
with wear. Hood: matte black cloth. Horns: dark keratin with lighter ridges. Trident: dark
tarnished gold, engraved flames with faint red emissive glow, barbed steel prongs. 4K PBR.
```

## 5. Animazioni
| Clip | Cerca in Mixamo | Note |
| --- | --- | --- |
| Idle | "Great Sword Idle" (impugnatura a due mani va bene per il tridente) | |
| Walk | "Great Sword Walk" | |
| Attack1 | "Standing Melee Attack Downward" (affondo) | hitTime 0.45 |
| Attack2 | "Great Sword Spin Attack" | hitTime 0.55 |
| Hit | "Great Sword Impact" | |
| Death | "Standing Death Backward" | |

## 6. Manifest
```json
{ "id": "mohg", "name": "Mohg, Signore del Sangue", "short": "Mohg", "model": "models/mohg.glb",
  "loreHeight": 3.6, "color": "#8e1b2c",
  "stats": { "hp": 160, "attack": 19, "speed": 0.5, "range": 0.7, "cooldown": 1.8 },
  "hitTime": { "Attack1": 0.45, "Attack2": 0.55 } }
```
