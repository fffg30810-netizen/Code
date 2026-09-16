# <Nome boss> — prompt pack

- **Manifest id:** `<id>` · **Altezza da lore:** ~<x> m (stima community)
- **Silhouette in una frase:** <cosa lo rende riconoscibile a 20 cm di altezza sul tavolo>
- **Palette:** <3 colori>

## 1. Text-to-3D corto (Meshy / Tripo, ≤ 600 caratteri)
```
<prefisso corto da STYLE-GUIDE.md> <descrizione compatta: corpo, armatura, arma nella mano destra, 3 dettagli iconici, materiali>
```
**Negative:** vedi STYLE-GUIDE.md

## 2. Text-to-3D esteso (Rodin / Hunyuan3D / TRELLIS)
```
<prefisso lungo> <descrizione dettagliata>
```

## 3. Character sheet per image-to-3D
```
<schema character sheet da STYLE-GUIDE.md> Subject: <descrizione>
```

## 4. Retexture / rifinitura HD (Meshy Retexture, Substance 3D)
```
<materiali e usura per zona: armatura, stoffa, pelle, arma>
```

## 5. Animazioni (Mixamo → nomi clip)
| Clip | Cerca in Mixamo | Note |
| --- | --- | --- |
| Idle | … | |
| Walk | … | |
| Attack1 | … | hitTime 0.45 |
| Attack2 | … | hitTime 0.5 |
| Hit | … | |
| Death | … | |

## 6. Manifest (`public/bosses.json`)
```json
{ "id": "<id>", "name": "…", "short": "…", "model": "models/<id>.glb", "loreHeight": 3, "color": "#d9b654",
  "stats": { "hp": 130, "attack": 16, "speed": 0.55, "range": 0.55, "cooldown": 1.7 },
  "hitTime": { "Attack1": 0.45, "Attack2": 0.5 } }
```
