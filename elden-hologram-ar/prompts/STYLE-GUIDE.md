# Guida di stile comune (prefisso per tutti i prompt)

Incolla questo blocco **prima** del prompt specifico del boss quando lo strumento accetta prompt
lunghi (Rodin, Hunyuan3D, generatori di immagini). Per Meshy/Tripo (limite ~600 caratteri) usa
la versione corta.

## Prefisso lungo (immagini / Rodin / Hunyuan3D)

```
Dark fantasy character inspired by FromSoftware's Elden Ring: grim, gothic, ornate and weathered.
Realistic proportions, cinematic lighting, muted desaturated palette with tarnished gold accents,
worn leather, torn linen, oxidized bronze and scarred skin. Full body, single character, standing
in a relaxed A-pose with feet flat on the ground, facing forward, weapon held in the right hand
and attached to it. Game-ready sculpt, clean symmetrical topology, high-frequency surface detail,
PBR materials (albedo, roughness, metalness, normal), no base, no pedestal, no background props.
```

## Prefisso corto (Meshy / Tripo)

```
Elden Ring inspired dark fantasy boss, ornate weathered armor, tarnished gold, realistic
proportions, single full-body character in A-pose, weapon in right hand, game-ready PBR,
high detail, no base.
```

## Negative prompt (sempre)

```
multiple characters, duplicate, base, pedestal, platform, background, text, logo, watermark,
low poly, blocky, blurry texture, smooth plastic, floating parts, disconnected limbs, extra
fingers, cropped, chibi, cartoon, anime
```

## Character sheet (image-to-3D) — schema

```
Character reference sheet, three orthographic views side by side (front view, left side view,
back view), same character, same scale, neutral flat gray background, soft even studio light,
no shadows on the background, A-pose, arms slightly away from the body, weapon attached to the
right hand, ultra detailed, 8k, PBR-ready materials. Subject: <descrizione del boss>.
```

Genera **una immagine per vista** se lo strumento image-to-3D le accetta separate (Tripo
multi-view, Meshy multi-image): stessa descrizione + "front view only" / "left side view only" /
"back view only".

## Palette di riferimento

| Nome | Hex | Uso |
| --- | --- | --- |
| Oro ancestrale | `#d9b654` | Erdtree, Ordine Aureo, Radagon, Godfrey |
| Bronzo consunto | `#8a6f2e` | armature e ornamenti |
| Rosso Caelid | `#c0392b` | Radahn, Messmer, marciume |
| Sangue di Mohg | `#8e1b2c` | Mohgwyn |
| Blu Caria | `#6e7fd6` | Rennala, Accademia |
| Ombra nera | `#2c2c34` | Maliketh, Marika's shadow |
| Spirito | `#8fd8ff` | ologramma "Ceneri spirituali" |
