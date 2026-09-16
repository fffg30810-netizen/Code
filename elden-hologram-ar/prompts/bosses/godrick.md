# Godrick l'Innestato — prompt pack

- **Manifest id:** `godrick` · **Altezza da lore:** ~3.2 m
- **Silhouette:** re gonfio e tozzo con decine di braccia e gambe innestate che spuntano dal corpo, armatura dorato-verde, mantello regale, ascia enorme.
- **Palette:** oro verdastro `#8a7f2f`, pelle innestata pallida `#d9c5a3`, ottone `#e2c95a`

## 1. Text-to-3D corto (Meshy / Tripo)
```
Elden Ring inspired dark fantasy boss: bloated hunched king with many grafted pale arms and legs
sprouting from his back and shoulders, ornate green-gold plate armor with royal engravings,
ragged crimson cape, small golden crown, two of his arms gripping a huge weathered greataxe in
the right hand, grotesque yet regal. Single full-body character, A-pose, weapon attached to right
hand, game-ready PBR, high detail, no base.
```

## 2. Text-to-3D esteso (Rodin / Hunyuan3D / TRELLIS)
```
Dark fantasy character inspired by FromSoftware's Elden Ring: grim, gothic, ornate and weathered.
A short, wide, bloated king standing hunched under his own weight. Dozens of grafted human limbs
in different skin tones sprout from his back, shoulders and hips like a grotesque mantle, stitched
on with iron staples and leather straps. He wears heavy plate armor of oxidized green-gold with
engraved heraldry, a torn crimson royal cape, ornate pauldrons, and a small tarnished gold crown
on a bald sweating head with a pained expression. His main right arm and a second grafted arm both
grip the long handle of a gigantic greataxe with a chipped bronze blade. Realistic proportions
(stocky, broad, heavy), muted palette with green-gold accents. Full body, single character,
A-pose, feet flat, facing forward, weapon attached to the right hand. Game-ready, clean topology,
PBR materials, no base, no props.
```

## 3. Character sheet per image-to-3D
```
Character reference sheet, three orthographic views side by side (front, left side, back), same
character and scale, neutral flat gray background, soft even studio light, A-pose, weapon
attached to the right hand, ultra detailed, 8k. Subject: a bloated grafted king covered in many
extra pale arms and legs sprouting from his back, green-gold engraved plate armor, torn crimson
cape, small gold crown, gripping a gigantic chipped greataxe, dark fantasy Elden Ring style.
```

## 4. Retexture / rifinitura HD
```
Armor: oxidized brass-gold with green verdigris in engravings, deep scratches, dried blood at the
seams. Grafted limbs: mismatched pale and bruised skin tones, red inflamed stitching, iron staples.
Cape: heavy crimson velvet, mud-stained hem. Axe: chipped bronze blade, wrapped leather grip.
4K PBR, high roughness on cloth and skin, medium on brass.
```

## 5. Animazioni
| Clip | Cerca in Mixamo | Note |
| --- | --- | --- |
| Idle | "Great Sword Idle" | |
| Walk | "Great Sword Walk" (lento: `speed` 0.45) | |
| Attack1 | "Great Sword Slash" | hitTime 0.45 |
| Attack2 | "Great Sword Spin Attack" | hitTime 0.55 |
| Hit | "Great Sword Impact" | |
| Death | "Great Sword Death" | |

## 6. Manifest
```json
{ "id": "godrick", "name": "Godrick l'Innestato", "short": "Godrick", "model": "models/godrick.glb",
  "loreHeight": 3.2, "color": "#9a8b3a",
  "stats": { "hp": 150, "attack": 15, "speed": 0.45, "range": 0.6, "cooldown": 1.9 },
  "hitTime": { "Attack1": 0.45, "Attack2": 0.55 } }
```

## 7. Variante
- **Fase 2 (testa di drago):** "a severed dragon head grafted onto his left forearm, jaws open,
  breathing embers" — ottimo con lo stile *Oro ancestrale* + particelle.
