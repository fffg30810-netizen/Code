# Prompt pack: boss di Elden Ring in alta definizione per l'AR

Questa cartella contiene i prompt per generare i modelli 3D dei boss con gli strumenti di
IA generativa (testo → 3D e immagine → 3D), riggarli, animarli e portarli nell'app.

> **Nota legale.** I nomi e i design dei boss appartengono a FromSoftware / Bandai Namco.
> Usa i modelli generati solo per uso personale sul tuo telefono: non ridistribuirli e non
> caricare nel repository asset estratti dal gioco. I prompt descrivono i personaggi "ispirati a",
> in stile dark fantasy: è la strada corretta per un progetto fan-made privato.

## I modelli già inclusi (generati con questa pipeline)

Due boss sono già pronti e vengono caricati dall'app senza che tu debba fare nulla:

| Boss | Come è stato fatto | Triangoli |
| --- | --- | --- |
| Malenia | prompt immagine (GPT Image) → Tripo H3.1 *image-to-3D* | ~57.000 |
| Radahn | prompt immagine (GPT Image) → Tripo H3.1 *image-to-3D* | ~60.000 |

Non hanno scheletro: l'app li anima **a corpo rigido** (respiro, passo, affondo, spazzata
rotante, contraccolpo, caduta), quindi combattono comunque. Per animazioni articolate
serve il rig (passi 3-4 qui sotto) oppure l'opzione *rigging* del generatore.

I `.glb` stanno su un CDN e sono referenziati nel manifest. Per averli in locale:

```bash
npm run fetch-models      # scarica in public/models/ e aggiorna il manifest
```

## Pipeline in 5 passi

| Passo | Strumento consigliato | Alternativa | Output |
| --- | --- | --- | --- |
| 1. Immagini di riferimento (facoltativo ma migliora molto) | OpenArt / Midjourney / Flux / SDXL con i prompt "character sheet" | Screenshot personali del gioco (solo uso privato) | 3 viste: fronte, lato, retro |
| 2. Modello 3D | **Meshy** (Text-to-3D o Image-to-3D, poi *Refine* 4K) | **Tripo AI**, **Rodin (Hyper3D)**, **Hunyuan3D 2.x** (open source, locale), **TRELLIS** | GLB con texture PBR |
| 3. Rig | Meshy *Auto-Rigging* o Tripo *Rig* | **Mixamo** (upload FBX → auto-rig) | modello riggato |
| 4. Animazioni | Meshy/Tripo *Animate* (libreria di mosse) | **Mixamo** (scarica le clip "without skin") | clip Idle, Walk, Attack1, Attack2, Hit, Death |
| 5. Assemblaggio + ottimizzazione | `tools/blender_export.py` → `npm run optimize` → `npm run manifest` | Blender manuale (NLA) + gltf-transform | `public/models/<id>.glb` |

Dettagli per ogni boss nella cartella [`bosses/`](./bosses/). Lo stile comune (prefisso da
incollare davanti a ogni prompt) è in [`STYLE-GUIDE.md`](./STYLE-GUIDE.md).

## Regole d'oro per prompt text-to-3D

1. **Un solo personaggio, corpo intero, in posa A o T**, piedi a terra, niente base/piedistallo:
   così l'auto-rig funziona e l'app normalizza l'altezza senza sorprese.
2. **Arma impugnata e attaccata alla mano** (non separata): le animazioni Mixamo la muovono
   insieme al braccio.
3. **Silhouette prima dei dettagli**: i generatori capiscono meglio "forma, materiali, colori,
   3 dettagli iconici" che pagine di lore.
4. **Materiali espliciti** (PBR): "weathered gold", "tarnished bronze", "torn dark linen".
5. **Negative prompt sempre**: `multiple characters, base, pedestal, text, watermark, low poly,
   blurry texture, floating parts, disconnected limbs, extra fingers, blocky`.
6. Per l'**alta definizione**: usa la funzione *Refine/Retexture* a 4K, poi lascia che
   `npm run optimize` comprima le texture a 2048 px WebP (ottimo compromesso sul telefono).
7. Se il risultato ha proporzioni sbagliate, prova l'**image-to-3D con 3 viste** generate dai
   prompt "character sheet": è il metodo più fedele.

## Mappatura animazioni

L'app cerca queste clip (vedi `public/bosses.json → defaults.clips`):

| Clip | Uso | Suggerimenti Mixamo |
| --- | --- | --- |
| `Idle` | in attesa | "Sword And Shield Idle", "Great Sword Idle", "Standing Idle" |
| `Walk` | avvicinamento | "Great Sword Walk", "Sword And Shield Walk", "Walking" |
| `Attack1` | colpo 1 | "Great Sword Slash", "Sword And Shield Slash", "Standing Melee Attack Downward" |
| `Attack2` | colpo 2 | "Great Sword Spin Attack", "Sword And Shield Attack", "Standing Melee Attack Horizontal" |
| `Hit` | contraccolpo | "Sword And Shield Impact", "Standing React Large From Front" |
| `Death` | morte | "Sword And Shield Death", "Falling Back Death", "Standing Death Backward" |
| `Victory` (opz.) | esultanza | "Sword And Shield Power Up", "Victory Idle" |

Il momento in cui il colpo "connette" è `hitTime` (frazione della clip, default 0.45): puoi
impostarlo per boss o per clip nel manifest, es. `"hitTime": { "Attack1": 0.4, "Attack2": 0.55 }`.

## Strumenti open source / locali

- **Hunyuan3D 2.x** (Tencent) e **TRELLIS** (Microsoft): text/image → mesh con texture, girano
  su GPU consumer; buoni per iterare gratis prima dei servizi a pagamento.
- **UniRig** / **Mixamo** per il rig; **Blender 4.x** per assemblare (script incluso).
- **gltf-transform** per compressione (già in `devDependencies`).
