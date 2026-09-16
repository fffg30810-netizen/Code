# Malenia, Lama di Miquella — prompt pack

- **Manifest id:** `malenia` · **Altezza da lore:** ~2.6 m
- **Silhouette:** guerriera alta e sottilissima, elmo alato dorato che copre gli occhi, braccio e gamba destri protesici in oro, katana lunghissima, capelli rossi.
- **Palette:** oro `#c9a24a`, bende scure `#5b3a2e`, pelle chiara `#e8d2b8`, marciume scarlatto `#c0392b`

## 1. Text-to-3D corto (Meshy / Tripo)
```
Elden Ring inspired dark fantasy boss: tall slender warrior woman, long flowing red hair,
golden winged helmet covering the eyes, ornate mechanical prosthetic right arm and right leg
made of engraved gold, torn dark bandages and worn red-brown cloth around the torso and hips,
the prosthetic right hand holding an extremely long slender katana, graceful and deadly.
Single full-body character, A-pose, katana attached to right hand, game-ready PBR, high
detail, no base.
```

## 2. Text-to-3D esteso (Rodin / Hunyuan3D / TRELLIS)
```
Dark fantasy character inspired by FromSoftware's Elden Ring: grim, gothic, ornate and weathered.
A tall, very slender warrior woman with an upright, poised stance. Long wavy red hair falls to
her waist from under a golden helmet whose two large sculpted wings sweep back from the temples
and whose visor covers her eyes. Her right arm and right leg are ornate prosthetics of engraved
gold with visible joints, plates and fine mechanical detail; the rest of her body is pale, wrapped
in torn dark linen bandages and a worn red-brown cloth skirt, with a few plates of tarnished gold
armor on the chest and left shoulder. Faint patches of scarlet rot bloom on her skin. Her golden
right hand holds an extremely long, slender katana with a blade longer than her torso, its edge
catching the light. Realistic proportions (very tall, long limbs), muted palette with warm gold
and deep scarlet accents. Full body, single character, A-pose, feet flat, facing forward, katana
attached to the right hand. Game-ready, clean topology, PBR materials, no base, no props.
```

## 3. Character sheet per image-to-3D
```
Character reference sheet, three orthographic views side by side (front, left side, back), same
character and scale, neutral flat gray background, soft even studio light, A-pose, katana
attached to the right hand, ultra detailed, 8k. Subject: a tall slender warrior woman with long
red hair, golden winged helmet covering the eyes, ornate golden prosthetic right arm and right
leg, torn dark bandages and red-brown cloth, tarnished gold chest plate, holding a very long
slender katana in the golden hand, dark fantasy Elden Ring style.
```

## 4. Retexture / rifinitura HD
```
Prosthetics: engraved warm gold with fine scratches, darker recesses, visible joints. Helmet:
polished gold wings with subtle hammering marks. Bandages: dark stained linen, frayed. Cloth:
worn red-brown wool. Skin: pale with faint scarlet rot blotches (subsurface look). Katana:
bright folded steel blade, gold tsuba, wrapped grip. 4K PBR, low roughness on gold and blade.
```

## 5. Animazioni
| Clip | Cerca in Mixamo | Note |
| --- | --- | --- |
| Idle | "Sword And Shield Idle" / "Standing Idle" | |
| Walk | "Sword And Shield Walk" / "Female Walk" | veloce: `speed` 0.8 |
| Attack1 | "Sword And Shield Slash" | hitTime 0.4 |
| Attack2 | "Standing Melee Attack 360 High" (Danza della Valchiria!) | hitTime 0.5 |
| Hit | "Sword And Shield Impact" | |
| Death | "Sword And Shield Death" | |
| Victory | "Sword And Shield Power Up" | opzionale |

## 6. Manifest
```json
{ "id": "malenia", "name": "Malenia, Lama di Miquella", "short": "Malenia", "model": "models/malenia.glb",
  "loreHeight": 2.6, "color": "#d4af37",
  "stats": { "hp": 120, "attack": 21, "speed": 0.8, "range": 0.5, "cooldown": 1.2 },
  "hitTime": { "Attack1": 0.4, "Attack2": 0.5 } }
```

## 7. Variante
- **Fase 2 (Dea del Marciume):** "enormous tattered butterfly wings of scarlet rot spreading
  from her back, blooming rot flowers on the wings, helmet removed" — usa `"color": "#c0392b"`.
