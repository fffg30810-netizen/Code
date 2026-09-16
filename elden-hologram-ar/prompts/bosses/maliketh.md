# Maliketh, la Lama Nera — prompt pack

- **Manifest id:** `maliketh` · **Altezza da lore:** ~3.0 m
- **Silhouette:** bestia-uomo dalla testa di lupo nero, mantello nero stracciato che avvolge il corpo, spadone nero dalla lama ricurva con finiture d'oro, occhi dorati.
- **Palette:** nero carbone `#2c2c34`, grigio cenere `#8d8d99`, viola pallido `#7d6bb0`, oro

## 1. Text-to-3D corto (Meshy / Tripo)
```
Elden Ring inspired dark fantasy boss: hulking beast-man with a black wolf-like head, glowing
golden eyes, muscular hunched build covered in charcoal-dark fur, ragged black hooded cloak
wrapping the body, long clawed hands, right hand gripping a large black greatsword with a
curved blade and gold-trimmed hilt. Single full-body character, A-pose, weapon attached to right
hand, game-ready PBR, high detail, no base.
```

## 2. Text-to-3D esteso (Rodin / Hunyuan3D / TRELLIS)
```
Dark fantasy character inspired by FromSoftware's Elden Ring: grim, gothic, ornate and weathered.
A hulking beast-man standing hunched like a predator ready to lunge. His head is that of a black
wolf with a long muzzle, bared fangs and glowing golden eyes; his body is heavily muscular,
covered in short charcoal-dark fur, with long arms ending in clawed hands. He is wrapped in a
ragged black hooded cloak and torn dark wrappings with a few pale gold clasps. His right hand
grips a large greatsword of black metal with a wide curved blade, gold-trimmed hilt and ornate
guard. Realistic bestial anatomy, near-monochrome charcoal palette with gold accents. Full
body, single character, A-pose, feet flat, facing forward, weapon attached to the right hand.
Game-ready, clean topology, PBR materials, no base, no props.
```

## 3. Character sheet per image-to-3D
```
Character reference sheet, three orthographic views side by side (front, left side, back), same
character and scale, neutral flat gray background, soft even studio light, A-pose, weapon
attached to the right hand, ultra detailed, 8k. Subject: a hulking black wolf-headed beast-man
with golden eyes, charcoal fur, ragged black hooded cloak and torn wrappings, clawed hands
holding a black curved greatsword with gold trim, dark fantasy Elden Ring style.
```

## 4. Retexture / rifinitura HD
```
Fur: short charcoal black with subtle grey tips (use a fur-like normal/height detail). Cloak:
matte black wool, heavy fraying, dust. Eyes: gold emissive. Sword: black oxidized steel with
faint red-gold runes (subtle emissive), gold trim on hilt. Claws: dark horn. 4K PBR.
```

## 5. Animazioni
| Clip | Cerca in Mixamo | Note |
| --- | --- | --- |
| Idle | "Great Sword Idle" / "Mutant Idle" (più bestiale) | |
| Walk | "Great Sword Walk" / "Mutant Walking" | veloce: `speed` 0.85 |
| Attack1 | "Great Sword Slash" | hitTime 0.42 |
| Attack2 | "Great Sword Jump Attack" | hitTime 0.55 |
| Hit | "Great Sword Impact" | |
| Death | "Great Sword Death" | |
| Victory | "Mutant Roaring" | opzionale |

## 6. Manifest
```json
{ "id": "maliketh", "name": "Maliketh, la Lama Nera", "short": "Maliketh", "model": "models/maliketh.glb",
  "loreHeight": 3.0, "color": "#3c3c48",
  "stats": { "hp": 130, "attack": 23, "speed": 0.85, "range": 0.6, "cooldown": 1.3 },
  "hitTime": { "Attack1": 0.42, "Attack2": 0.55 } }
```
