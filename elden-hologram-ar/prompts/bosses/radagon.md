# Radagon dell'Ordine Aureo — prompt pack

- **Manifest id:** `radagon` · **Altezza da lore:** ~2.3 m
- **Silhouette:** uomo muscoloso di pietra dorata crepata e pelle pallida, capelli e barba rossi, martello dorato enorme dalla testa spaccata.
- **Palette:** oro `#d9a441`, oro scuro `#8a6a2a`, pelle di statua `#f0e3d2`, luce `#ffd77a`

## 1. Text-to-3D corto (Meshy / Tripo)
```
Elden Ring inspired dark fantasy boss: muscular divine man whose body is half pale skin and half
cracked golden stone with glowing gold fissures, long red hair and red beard, tattered white and
gold cloth around the waist, right hand gripping a huge ornate golden hammer with a cracked head,
statue-like, sacred and broken. Single full-body character, A-pose, weapon attached to right
hand, game-ready PBR, high detail, no base.
```

## 2. Text-to-3D esteso (Rodin / Hunyuan3D / TRELLIS)
```
Dark fantasy character inspired by FromSoftware's Elden Ring: grim, gothic, ornate and weathered.
A tall, muscular divine man standing like a living statue. His body is a mix of pale marble-like
skin and cracked golden stone: the right half of his torso, his right arm and parts of his legs
are fractured gold with glowing fissures, as if a sacred statue were breaking apart. He has long
wild red hair, a thick red beard and a stern face with golden eyes. Around his waist and over his
left shoulder hangs tattered white cloth with gold embroidery. His right hand grips a huge ornate
hammer of gold with an engraved cracked head and a long haft. Realistic proportions, palette of
pale stone and warm gold with emissive fissures. Full body, single character, A-pose, feet flat,
facing forward, weapon attached to the right hand. Game-ready, clean topology, PBR materials
with emissive cracks, no base, no props.
```

## 3. Character sheet per image-to-3D
```
Character reference sheet, three orthographic views side by side (front, left side, back), same
character and scale, neutral flat gray background, soft even studio light, A-pose, weapon
attached to the right hand, ultra detailed, 8k. Subject: a muscular divine man with long red hair
and beard, body half pale marble skin and half cracked glowing golden stone, tattered white-gold
cloth at the waist, holding a huge ornate golden hammer with a cracked head, dark fantasy Elden
Ring style.
```

## 4. Retexture / rifinitura HD
```
Skin: pale marble with subtle veins. Gold stone: warm gold with deep cracks, emissive light in
fissures, chipped edges. Hair: deep red, matte. Cloth: white linen with gold embroidery, ash
stains. Hammer: gold head with engraved runes and large cracks (emissive), dark haft. 4K PBR.
```

## 5. Animazioni
| Clip | Cerca in Mixamo | Note |
| --- | --- | --- |
| Idle | "Great Sword Idle" | |
| Walk | "Great Sword Walk" | |
| Attack1 | "Standing Melee Attack Downward" (colpo di martello) | hitTime 0.5 |
| Attack2 | "Great Sword Slash" | hitTime 0.45 |
| Hit | "Great Sword Impact" | |
| Death | "Standing Death Forward" | |

## 6. Manifest
```json
{ "id": "radagon", "name": "Radagon dell'Ordine Aureo", "short": "Radagon", "model": "models/radagon.glb",
  "loreHeight": 2.3, "color": "#e8b04a",
  "stats": { "hp": 130, "attack": 20, "speed": 0.7, "range": 0.55, "cooldown": 1.4 },
  "hitTime": { "Attack1": 0.5, "Attack2": 0.45 } }
```

## 7. Variante
- **Bestia Ancestrale (fase 2):** creatura a sé (~30 m): "colossal ethereal sea-creature-like
  deity, translucent blue-gold body with a starfield inside, long tail, holding a giant golden
  sword" — usa lo stile *Spirito* e un id nuovo `eldenbeast`.
