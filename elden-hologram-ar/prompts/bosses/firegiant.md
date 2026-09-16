# Gigante di Fuoco — prompt pack

- **Manifest id:** `firegiant` · **Altezza da lore:** ~28 m
- **Silhouette:** gigante enorme dai capelli e barba rossi, pelle grigia piena di cicatrici, catene, gamba sinistra ferita con tutore di metallo, scudo rotondo di legno gigantesco con lama ricurva incastrata.
- **Palette:** pelle bruciata `#c98a5a`, cuoio `#7a4a2a`, fuoco `#ff9a2a`, legno scuro

## 1. Text-to-3D corto (Meshy / Tripo)
```
Elden Ring inspired dark fantasy boss: colossal giant with grey scarred skin, wild red hair and
a huge red beard, heavy iron chains and shackles, a metal brace on the wounded left leg, ragged
loincloth of hides, right hand gripping a gigantic round wooden shield with a carved face and a
massive curved blade fixed to its edge. Single full-body character, A-pose, weapon-shield attached
to right hand, game-ready PBR, high detail, no base.
```

## 2. Text-to-3D esteso (Rodin / Hunyuan3D / TRELLIS)
```
Dark fantasy character inspired by FromSoftware's Elden Ring: grim, gothic, ornate and weathered.
A colossal giant with a broad, top-heavy body and a heavy limp. His skin is grey and leathery,
covered in old burn scars and stitched wounds; his hair and immense beard are wild and fiery red,
braided in places with bone rings. Heavy rusted iron chains hang from shackles on his wrists and
neck, and his left leg is bound in a crude metal brace over a deep wound. He wears a ragged
loincloth and belts of animal hides. His right hand grips a gigantic round wooden shield with an
iron rim and a snarling face carved into it, with a massive curved iron blade fixed along its
edge, used as a weapon. Realistic giant anatomy (thick limbs, small head), muted palette of grey
skin, dark hide and rusted iron with warm red hair. Full body, single character, A-pose, feet
flat, facing forward, shield-blade attached to the right hand. Game-ready, clean topology, PBR
materials, no base, no props.
```

## 3. Character sheet per image-to-3D
```
Character reference sheet, three orthographic views side by side (front, left side, back), same
character and scale, neutral flat gray background, soft even studio light, A-pose, shield-blade
attached to the right hand, ultra detailed, 8k. Subject: a colossal grey-skinned giant with wild
red hair and huge red beard, burn scars, rusted chains and shackles, metal brace on the left leg,
hide loincloth, holding a gigantic round wooden shield with a carved face and a massive curved
blade on its edge, dark fantasy Elden Ring style.
```

## 4. Retexture / rifinitura HD
```
Skin: grey, leathery, burn scars with darker charred edges, stitches. Hair/beard: fiery red,
coarse. Chains: heavily rusted iron. Brace: dented dark iron with leather straps. Shield: dark
weathered oak planks, iron rim, carved face with soot; blade of pitted iron. 4K PBR.
```

## 5. Animazioni
| Clip | Cerca in Mixamo | Note |
| --- | --- | --- |
| Idle | "Great Sword Idle" | |
| Walk | "Injured Walk" (zoppica!) | lento: `speed` 0.35 |
| Attack1 | "Standing Melee Attack Downward" | hitTime 0.5 |
| Attack2 | "Standing Melee Attack Horizontal" | hitTime 0.55 |
| Hit | "Standing React Large From Front" | |
| Death | "Falling Back Death" | |

## 6. Manifest
```json
{ "id": "firegiant", "name": "Gigante di Fuoco", "short": "Gigante", "model": "models/firegiant.glb",
  "loreHeight": 28, "color": "#e67e22",
  "stats": { "hp": 260, "attack": 26, "speed": 0.35, "range": 0.7, "cooldown": 2.6 },
  "hitTime": { "Attack1": 0.5, "Attack2": 0.55 } }
```

## 7. Variante
- **Fase 2:** "his torn belly opens into a huge burning face with a single glowing eye, flames
  pouring out" — aggiungi emissive forte; `"color": "#ff6a00"`.
