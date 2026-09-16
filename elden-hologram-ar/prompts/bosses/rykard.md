# Rykard, Signore della Blasfemia — prompt pack

- **Manifest id:** `rykard` · **Altezza da lore:** ~12 m (il serpente è enorme)
- **Silhouette:** corpo di serpente gigantesco a squame nere e rosse; dalle fauci spalancate emerge il torso di un lord che impugna uno spadone col teschio-serpente avvolto nella lava.
- **Palette:** magma `#ff8c3a`, squame nere `#3a1a0a`, bruciato `#5c2a12`

## 1. Text-to-3D corto (Meshy / Tripo)
```
Elden Ring inspired dark fantasy boss: gigantic serpent with black and dark red scales, coiled
lower body, its huge jaws gaping open and a human lord's armored torso emerging from the mouth,
the lord's right hand gripping a colossal greatsword with a serpent-skull hilt wreathed in molten
lava, glowing magma cracks, embers. Single creature, upright pose, weapon attached to right hand,
game-ready PBR, high detail, no base.
```

## 2. Text-to-3D esteso (Rodin / Hunyuan3D / TRELLIS)
```
Dark fantasy creature inspired by FromSoftware's Elden Ring: grim, gothic, ornate and weathered.
A gigantic serpent rearing upright on a coiled lower body. Its scales are black with dark red
underbellies, cracked and glowing with molten orange fissures; its enormous jaws are stretched
open, and from inside the mouth emerges the upper body of a lord in melted, blackened ceremonial
armor with a serpent motif, his face pained and partially fused with the snake's throat. The
lord's right hand grips a colossal greatsword whose hilt is a fanged serpent skull and whose
blade is wrapped in flowing lava. Realistic monstrous anatomy, muted charcoal palette lit by warm
emissive magma. Single creature, upright S-shaped pose with the coil resting on the ground,
facing forward, weapon attached to the right hand. Game-ready, clean topology, PBR materials
with emissive lava, no base, no props.
```

## 3. Character sheet per image-to-3D
```
Creature reference sheet, three orthographic views side by side (front, left side, back), same
creature and scale, neutral flat gray background, soft even studio light, ultra detailed, 8k.
Subject: a gigantic black-and-red scaled serpent rearing upright on a coil, jaws gaping, an
armored lord's torso emerging from its mouth holding a colossal serpent-skull greatsword wreathed
in lava, glowing magma cracks, dark fantasy Elden Ring style.
```

## 4. Retexture / rifinitura HD
```
Scales: black obsidian-like with dark red bellies, cracked, emissive orange magma in fissures.
Lord's armor: blackened, melted steel with serpent engravings. Sword: dull steel blade with
emissive lava flow, bone-white serpent skull hilt. 4K PBR, strong emissive map.
```

## 5. Animazioni (nota: non umanoide)
Mixamo rigga solo umanoidi. Opzioni:
1. **Meshy/Tripo Animate** con preset "creature/serpent" se disponibile → esporta le clip con i nomi standard;
2. **Rig umanoide del solo torso** in Mixamo: modella il serpente come "gonna" pesata alle anche;
   il torso attacca, il serpente resta quasi fermo (accettabile a 20 cm sul tavolo);
3. tieni il **segnaposto procedurale** (già con coda di serpente) finché non hai un rig.

| Clip | Cerca in Mixamo (opzione 2) | Note |
| --- | --- | --- |
| Idle | "Great Sword Idle" | |
| Walk | "Great Sword Idle" (usa la stessa: il serpente "scivola") | `speed` 0.35 |
| Attack1 | "Great Sword Slash" | hitTime 0.45 |
| Attack2 | "Standing Melee Attack Downward" | hitTime 0.5 |
| Hit | "Great Sword Impact" | |
| Death | "Standing Death Forward" | |

## 6. Manifest
```json
{ "id": "rykard", "name": "Rykard, Signore della Blasfemia", "short": "Rykard", "model": "models/rykard.glb",
  "loreHeight": 12, "color": "#d35400",
  "stats": { "hp": 200, "attack": 22, "speed": 0.35, "range": 0.8, "cooldown": 2.3 },
  "hitTime": { "Attack1": 0.45, "Attack2": 0.5 } }
```
