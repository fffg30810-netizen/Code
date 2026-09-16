# Messmer l'Impalatore (Shadow of the Erdtree) — prompt pack

- **Manifest id:** `messmer` · **Altezza da lore:** ~3.0 m
- **Silhouette:** uomo alto e pallido con capelli rosso fuoco selvaggi, un occhio sigillato, armatura-cappotto nera e rossa con motivi di serpente, lancia dalla punta rossa fiammeggiante, serpenti attorcigliati sulle spalle.
- **Palette:** nero bruciato `#3a1e1a`, rosso `#7a1f1a`, fiamma `#ff5a2a`, oro `#c9a24a`

## 1. Text-to-3D corto (Meshy / Tripo)
```
Elden Ring inspired dark fantasy boss: tall pale man with wild fiery red hair, one eye closed
under a decorative seal, long black and dark red coat-armor with serpent motifs and gold trim,
two serpents coiled around his shoulders, right hand holding an ornate spear with a red
flame-shaped blade, embers and ash. Single full-body character, A-pose, spear attached to right
hand, game-ready PBR, high detail, no base.
```

## 2. Text-to-3D esteso (Rodin / Hunyuan3D / TRELLIS)
```
Dark fantasy character inspired by FromSoftware's Elden Ring: grim, gothic, ornate and weathered.
A tall, gaunt and pale man with a severe, aristocratic face. His hair is long, wild and fiery
red-orange, falling over a long black coat-armor with dark red panels, high collar, engraved gold
trim and serpent motifs; his left eye is closed and covered by an ornate seal. Two dark serpents
with golden eyes coil around his shoulders and arms, heads raised. His right hand holds a tall
ornate spear of blackened steel and gold with a long red blade shaped like a flame, embers
drifting from it. Realistic proportions (tall, slim), muted palette of black and dark red with
gold and emissive orange accents. Full body, single character, A-pose, feet flat, facing forward,
spear attached to the right hand. Game-ready, clean topology, PBR materials with subtle emissive,
no base, no props.
```

## 3. Character sheet per image-to-3D
```
Character reference sheet, three orthographic views side by side (front, left side, back), same
character and scale, neutral flat gray background, soft even studio light, A-pose, spear attached
to the right hand, ultra detailed, 8k. Subject: a tall pale man with wild fiery red hair and one
sealed eye, long black and dark red coat-armor with serpent motifs and gold trim, two serpents
coiled on his shoulders, holding an ornate spear with a red flame-shaped blade, dark fantasy
Elden Ring style.
```

## 4. Retexture / rifinitura HD
```
Coat-armor: blackened steel plates and dark red leather, engraved gold trim, soot and ash.
Hair: fiery red-orange with slight emissive tips. Skin: very pale, faint veins. Serpents: dark
scales with gold eyes (emissive). Spear: blackened steel haft, gold fittings, red blade with hot
emissive core. 4K PBR.
```

## 5. Animazioni
| Clip | Cerca in Mixamo | Note |
| --- | --- | --- |
| Idle | "Sword And Shield Idle" / "Standing Idle" | |
| Walk | "Sword And Shield Walk" | veloce: `speed` 0.75 |
| Attack1 | "Standing Melee Attack Downward" (affondo di lancia) | hitTime 0.42 |
| Attack2 | "Standing Melee Attack 360 High" | hitTime 0.5 |
| Hit | "Sword And Shield Impact" | |
| Death | "Standing Death Backward" | |

## 6. Manifest
```json
{ "id": "messmer", "name": "Messmer l'Impalatore", "short": "Messmer", "model": "models/messmer.glb",
  "loreHeight": 3.0, "color": "#c0392b",
  "stats": { "hp": 140, "attack": 22, "speed": 0.75, "range": 0.65, "cooldown": 1.3 },
  "hitTime": { "Attack1": 0.42, "Attack2": 0.5 } }
```

## 7. Variante
- **Fase 2 (Base Serpent):** "a gigantic dark serpent with a flaming mane rising behind him, fused
  to his back" — id nuovo `messmer2`, `"loreHeight": 8`.
