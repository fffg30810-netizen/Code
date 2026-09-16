# Radahn, Flagello delle Stelle — prompt pack

- **Manifest id:** `radahn` · **Altezza da lore:** ~6.5 m
- **Silhouette:** generale colossale, elmo a testa di leone con criniera rossa, armatura pesante bronzo-rosso, due spadoni ricurvi enormi (uno per mano).
- **Palette:** rosso cremisi `#7a1f1a`, bronzo `#e0a955`, acciaio `#9a9a9a`

## 1. Text-to-3D corto (Meshy / Tripo)
```
Elden Ring inspired dark fantasy boss: colossal red-haired warrior general, massive lion-shaped
helmet with a flowing crimson mane, heavy weathered bronze and dark red plate armor, oversized
muscular build, two gigantic curved greatswords held one in each hand, scarred gravity-warped
metal. Single full-body character, A-pose, weapons attached to hands, game-ready PBR, high
detail, no base.
```

## 2. Text-to-3D esteso (Rodin / Hunyuan3D / TRELLIS)
```
Dark fantasy character inspired by FromSoftware's Elden Ring: grim, gothic, ornate and weathered.
A colossal warrior general with an oversized muscular build and a slightly hunched, heavy
stance. His head is covered by a massive helmet sculpted as a roaring lion's face with a long
flowing crimson mane made of hair and leather strips. He wears heavy layered plate armor of
weathered bronze and dark red enamel, dented and scarred, with a tattered red cape and a wide
belt of studded leather. In each hand he grips a gigantic curved greatsword with a notched dull
steel blade and bronze fittings; the blades are almost as long as he is tall. Realistic
proportions exaggerated for size (huge torso, thick limbs), muted palette with crimson and
bronze accents. Full body, single character, A-pose with swords lowered, feet flat, facing
forward, both weapons attached to the hands. Game-ready, clean topology, PBR materials, no base,
no horse, no props.
```

## 3. Character sheet per image-to-3D
```
Character reference sheet, three orthographic views side by side (front, left side, back), same
character and scale, neutral flat gray background, soft even studio light, A-pose, greatswords
attached to both hands, ultra detailed, 8k. Subject: a colossal general in dented bronze and dark
red plate armor, huge lion-faced helmet with a long crimson mane, tattered red cape, holding two
gigantic notched curved greatswords, dark fantasy Elden Ring style.
```

## 4. Retexture / rifinitura HD
```
Armor: weathered bronze with dark red enamel panels, deep dents, scratches, dust of Caelid (red
ochre) in recesses. Mane: crimson hair strands and leather strips, matte. Cape: torn red wool.
Swords: dull notched steel with rust pitting, bronze guards. Skin (visible neck/hands): tanned,
scarred. 4K PBR, low roughness only on polished bronze edges.
```

## 5. Animazioni
| Clip | Cerca in Mixamo | Note |
| --- | --- | --- |
| Idle | "Great Sword Idle" | |
| Walk | "Great Sword Walk" | |
| Attack1 | "Great Sword Slash" | hitTime 0.45 |
| Attack2 | "Great Sword Spin Attack" oppure "Great Sword Jump Attack" | hitTime 0.55 |
| Hit | "Great Sword Impact" | |
| Death | "Great Sword Death" | |

## 6. Manifest
```json
{ "id": "radahn", "name": "Radahn, Flagello delle Stelle", "short": "Radahn", "model": "models/radahn.glb",
  "loreHeight": 6.5, "color": "#c0392b",
  "stats": { "hp": 220, "attack": 24, "speed": 0.5, "range": 0.65, "cooldown": 2.0 },
  "hitTime": { "Attack1": 0.45, "Attack2": 0.55 } }
```

## 7. Varianti
- **A cavallo (Leonard):** "riding a small emaciated grey horse far too small for him" — fantastico
  da vedere ma difficile da riggare: usa solo come statua (senza animazioni) o in Quick Look.
- **Consorte Promesso (DLC):** stessa silhouette senza elmo, capelli rossi sciolti, corpo dorato
  e crepato di luce, `"color": "#e8b04a"`.
