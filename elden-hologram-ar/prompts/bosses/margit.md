# Margit, il Presagio Caduto — prompt pack

- **Manifest id:** `margit` · **Altezza da lore:** ~3.4 m
- **Silhouette:** Omen alto e curvo, avvolto in una veste-cappuccio stracciata, volto bendato, lungo bastone-spada dorato; le corna restano nascoste sotto il cappuccio.
- **Palette:** grigio-bruno polveroso `#5a5548`, lino sporco `#3b3a36`, oro brunito `#e6c56b`

## 1. Text-to-3D corto (Meshy / Tripo)
```
Elden Ring inspired dark fantasy boss: tall gaunt Omen warrior with a hunched back, tattered
grey-brown hooded robe and long ragged cloak hiding curled horns, face wrapped in dirty linen
bandages, bony clawed hands and bare clawed feet, right hand gripping a long ornate cane-sword
with a weathered gold hilt, tarnished gold bracelets, muted earth tones. Single full-body
character, A-pose, weapon attached to right hand, game-ready PBR, high detail, no base.
```

## 2. Text-to-3D esteso (Rodin / Hunyuan3D / TRELLIS)
```
Dark fantasy character inspired by FromSoftware's Elden Ring: grim, gothic, ornate and weathered.
A towering, emaciated Omen warrior standing hunched forward. He wears a heavy, torn hooded robe
of grey-brown wool layered over a ragged travelling cloak; the hood is pulled low and bulges over
two hidden curled horns. His face is completely wrapped in stained linen bandages except for a
faint golden glow where the eyes would be. Long sinewy arms end in bony clawed hands; his feet
are bare, grey and clawed. In his right hand he holds a long ornate cane-sword: a dark wooden
shaft with a tarnished gold hilt shaped like a gnarled root, blade partially drawn. A few rusted
chains and gold rings hang from his wrists. Realistic proportions (very tall, narrow shoulders,
long limbs), muted desaturated palette with tarnished gold accents. Full body, single character,
relaxed A-pose, feet flat on the ground, facing forward, weapon attached to the right hand.
Game-ready, clean symmetrical topology, high-frequency cloth wrinkles and frayed edges, PBR
materials, no base, no props.
```

## 3. Character sheet per image-to-3D
```
Character reference sheet, three orthographic views side by side (front, left side, back), same
character and scale, neutral flat gray background, soft even studio light, A-pose, weapon
attached to the right hand, ultra detailed, 8k. Subject: a tall hunched Omen warrior in a torn
grey-brown hooded robe and ragged cloak, bandaged face with faint golden glowing eyes, hidden
curled horns under the hood, bony clawed hands and feet, holding a long dark cane-sword with a
weathered gold root-shaped hilt, dark fantasy Elden Ring style.
```

## 4. Retexture / rifinitura HD
```
Robe: coarse grey-brown wool, heavy wear, frayed hems, dust and ash accumulation in folds.
Bandages: stained off-white linen, layered wraps, subtle blood and dirt. Skin: grey, leathery,
cracked knuckles. Cane-sword: dark oiled wood shaft with scratches, hilt in tarnished gold with
green oxidation in recesses, blade of dull steel with faint golden runes. Roughness high on
cloth, medium on skin, low on gold. 4K PBR.
```

## 5. Animazioni
| Clip | Cerca in Mixamo | Note |
| --- | --- | --- |
| Idle | "Great Sword Idle" oppure "Standing Idle" (leggermente curvo) | |
| Walk | "Great Sword Walk" / "Injured Walk" (passo pesante) | |
| Attack1 | "Standing Melee Attack Downward" | hitTime 0.45 |
| Attack2 | "Standing Melee Attack Horizontal" | hitTime 0.5 |
| Hit | "Standing React Large From Front" | |
| Death | "Standing Death Backward" | |

## 6. Manifest
```json
{ "id": "margit", "name": "Margit, il Presagio Caduto", "short": "Margit", "model": "models/margit.glb",
  "loreHeight": 3.4, "color": "#b7a37a",
  "stats": { "hp": 130, "attack": 16, "speed": 0.55, "range": 0.55, "cooldown": 1.7 },
  "hitTime": { "Attack1": 0.45, "Attack2": 0.5 } }
```

## 7. Variante
- **Fase 2 (martello dorato):** aggiungi al prompt "left hand summoning a huge translucent hammer of
  golden light" e nel manifest imposta `"color": "#f0c85a"`; usa lo stile *Oro ancestrale* nell'app.
