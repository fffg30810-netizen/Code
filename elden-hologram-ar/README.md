# Elden Hologram AR

Evoca i boss di Elden Ring come **ologrammi in alta definizione sul tavolo di casa**, guardandoli
attraverso la fotocamera del telefono. Scegli tu quanto sono grandi (da 5 cm a "scala reale") e
falli **combattere fra loro**. Web app, niente da installare: si apre da un link HTTPS.

<p align="center"><img src="docs/screens/fight.png" alt="Combattimento in anteprima 3D" width="360" /></p>

> **Malenia, Radahn e Margit sono già modelli 3D veri** generati da immagini di riferimento:
> l'app li scarica da sola al primo utilizzo. Gli altri boss usano segnaposto procedurali,
> con i prompt pronti in [`prompts/`](./prompts/) per generarli allo stesso modo.

## Cosa fa

- **AR vera (WebXR, Android + Chrome):** rileva il tavolo, mostra un sigillo dorato dove appoggiare il
  boss, ombre di contatto, stima della luce reale, DOM overlay per i controlli. Alla prima evocazione
  crea un'**ancora** sul punto toccato: da lì in poi i boss restano inchiodati al tavolo anche
  camminandoci intorno.
- **Modalità Camera (iPhone e tutto il resto):** fotocamera + giroscopio, i boss stanno su un piano
  virtuale davanti a te. Il giroscopio da solo non sa se ti sposti, quindi l'app stima il movimento
  guardando l'immagine della fotocamera e muove la vista di conseguenza: il boss resta fermo sul
  tavolo invece di seguirti. Si disattiva da *Impostazioni → Ancora al tavolo*, e *Ricentra* rimette
  la vista a posto. Regoli l'altezza del telefono dal tavolo e il campo visivo. Su iOS c'è anche **Quick Look** (AR nativa Apple) se aggiungi i file USDZ.
- **Anteprima 3D (desktop):** tavolo virtuale con orbit camera, per provare tutto senza telefono.
- **Grandezza libera:** slider logaritmico 5 cm → 10 m, pizzico a due dita, pulsante **Scala reale**
  (altezza da lore: Malenia 2,6 m, Radahn 6,5 m, Gigante di Fuoco 28 m…).
- **Combattimento con i moveset veri:** ogni boss ha le sue mosse, con preparazione leggibile
  (telegrafo a terra), finestra di danno e scopertura. Malenia incatena fendenti, fa la **Danza dei
  Trampolieri** (nove colpi in tre raffiche) e assorbe vita a ogni colpo; in seconda fase apre la
  **Scarlet Aeonia**. Radahn alterna doppia spazzata, colpo calante, carica e **attrazione
  gravitazionale** che trascina l'avversario, e sotto metà vita chiama la **meteora**. Margit
  concatena bastonate, evoca il **martello di luce**, lancia il **pugnale dorato** e scatta col balzo.
  Ci sono schivate, parate, rottura della posa, passaggio alla seconda fase con ruggito, e ogni mossa
  ha il suo effetto e il suo suono. Barre vita, vincitore, rivincita, slow-motion (0,1× → 2×).
- **Stili:** *Realistico* (PBR, ambiente HDR, tone mapping ACES), *Spirito* (ologramma azzurro come le
  Ceneri spirituali), *Oro ancestrale*. Evocazione con effetto "materializzazione" dal basso.
- **HD:** supersampling WebXR 1,4×, pixel ratio 2, texture anisotrope, ombre PCF 2048, supporto GLB
  con Draco / Meshopt / KTX2 / WebP.
- **13 boss** con statistiche e altezze da lore: tre con modello 3D reale (Malenia, Radahn,
  Margit), gli altri con segnaposto procedurali animati, sostituibili con i tuoi GLB.
- **Modelli senza scheletro supportati**: chi non ha un rig viene animato a corpo rigido, così
  anche un modello generato da una foto combatte senza altro lavoro.
- **Integrazione con la stanza vera:** in modalità Camera l'app legge ogni mezzo secondo un fotogramma
  ridotto e ne ricava colore della luce, esposizione, direzione dominante e una mappa di riflessione:
  i boss vengono illuminati e riflettono la stanza in cui sono appoggiati. Sotto ognuno c'è
  un'**ombra di contatto** morbida che si allarga e si schiarisce quando il corpo si stacca da terra,
  e i materiali prendono **grana, alzata del nero e desaturazione** della fotocamera, così il modello
  non sembra un adesivo pulito incollato sopra l'immagine. In AR vera la stessa regia arriva dalla
  stima della luce di WebXR. Si disattiva da *Impostazioni → Luce della stanza*.
- **Peso dei colpi:** ogni fendente lascia una **scia dell'arma** agganciata alla mano, le scintille
  partono dal punto in cui la lama tocca davvero e schizzano nella direzione del colpo, chi incassa
  viene **spinto indietro** e reagisce secondo la provenienza del colpo (davanti, dietro, di lato).
  Un colpo pesante che rompe la posa **atterra** l'avversario, che resta a terra e si rialza: la
  finestra in cui l'altro lo punisce con la mossa più dannosa, a danno maggiorato. Passi con polvere
  e rumore, suoni posizionati in stereo secondo dove si trova il boss rispetto a te.
- **Nessun colpo uguale al precedente:** lo stesso attacco sceglie ogni volta un arco diverso
  (fendente diritto, diagonale, risalita, doppio taglio, montante, pestone, calcio) e può essere
  **specchiato** per arrivare dall'altro lato; preparazione, finestra di danno e recupero cambiano a
  ogni esecuzione. Come nel gioco ci sono i **colpi trattenuti** — l'arma resta ferma in alto un
  istante di troppo — e le **finte**, dove la preparazione si spegne a metà e parte un altro colpo.
  Dentro una catena il colpo successivo parte già caricato.
- **Impatti a strati:** niente campioni audio, ma un motore d'urto costruito su cinque strati
  (transiente, tonfo del corpo, parziali inarmonici del metallo, rumore dell'urto, sotto-basso sui
  colpi pesanti) con accordatura e durate diverse a ogni colpo, mandato a un breve **riverbero di
  stanza**. Ogni famiglia — acciaio, punta, contundente, magia, marciume — ha il suo timbro, il suo
  colore di scintille, il suo lampo e il suo segno del taglio. Il fruscio del fendente segue la
  curva Doppler della lama che passa e la velocità vera di quella esecuzione.

## Avvio rapido

```bash
cd elden-hologram-ar
npm install          # copia anche i decoder Draco/Basis in public/decoders
npm run dev          # server HTTPS in LAN (certificato self-signed)
```

Apri sul telefono l'indirizzo `https://<ip-del-pc>:5173` mostrato in console, accetta il certificato,
poi **Avvia AR** (Android/Chrome) o **Modalità Camera** (iPhone). Sul PC usa **Anteprima 3D**.

Build e test:

```bash
npm run build        # dist/ pronto per GitHub Pages / qualsiasi hosting statico HTTPS
npm test             # smoke test headless: evoca, combatte, verifica il vincitore (screenshot in tests/output/)
```

### Metterla online (per usarla dal telefono)

Serve un indirizzo **HTTPS**: fotocamera, sensori e WebXR non funzionano in HTTP. Due strade:

**A. GitHub Pages (consigliata, gratis).** Il workflow
[`.github/workflows/deploy-pages.yml`](../.github/workflows/deploy-pages.yml) a ogni push compila il
sito, ci scarica dentro i tre modelli 3D e lo pubblica in due forme: l'artefatto Pages **e** il
branch `gh-pages`. Manca solo l'interruttore, una volta sola:

1. apri <https://github.com/fffg30810-netizen/Code/settings/pages>
2. in *Build and deployment → Source* scegli una delle due (funzionano entrambe):
   - **GitHub Actions**, oppure
   - **Deploy from a branch** → branch `gh-pages`, cartella `/ (root)`
3. salva: il sito è online in un minuto, senza rilanciare niente

L'indirizzo è `https://fffg30810-netizen.github.io/Code/`: aprilo dal telefono e premi *Avvia AR*
(Android) o *Modalità Camera* (iPhone). Senza quell'interruttore GitHub risponde
`Site not found`: il repository è privato e Pages resta spento finché non lo accendi tu.

**B. Dal tuo computer, senza pubblicare niente.** `npm run dev` espone un indirizzo HTTPS in rete
locale (`https://<ip-del-pc>:5173`): aprilo dal telefono sulla stessa Wi-Fi e accetta il certificato
self-signed.

## Come si usa (sul telefono)

1. Scegli il boss nella barra in basso: quelli con l'etichetta **3D** hanno un modello vero
   (si scarica al primo utilizzo), gli altri usano il segnaposto procedurale.
2. **Tocca il tavolo** dove vuoi evocarlo (in WebXR aspetta che appaia il sigillo dorato).
3. **Pizzica** per ridimensionare, **trascina** per spostare, **due dita** per ruotare, oppure usa lo slider
   e i pulsanti *↻ 45°*, *Scala reale*, *Rimuovi*.
4. Evoca almeno due boss e premi **⚔ Combatti**. Regola la **Velocità** per lo slow-motion.
5. **✦** cambia stile (realistico / spirito / oro), **♪** suoni, **HD** qualità, **⚙** impostazioni.

Per registrare il combattimento usa la registrazione schermo del telefono (in WebXR la fotocamera
è composta dal sistema e non è accessibile alla pagina).

## Boss reali già inclusi

Tre boss sono **modelli 3D veri**, generati con la pipeline immagine → 3D e caricati
automaticamente dall'app (nessuna installazione, si scaricano al volo dal CDN):

| Boss | Pipeline | Triangoli |
| --- | --- | --- |
| Malenia | immagine di riferimento (GPT Image) → Tripo H3.1 *image-to-3D* | ~57.000 |
| Radahn | immagine di riferimento (GPT Image) → Tripo H3.1 *image-to-3D* | ~57.000 |
| Margit | Tripo *text-to-3D* | ~60.000 |

Sono mesh texturizzate **senza scheletro**: l'app le anima a **corpo rigido** (respiro, passo
ondeggiante, affondo, spazzata rotante, contraccolpo, caduta all'indietro), quindi combattono
regolarmente. Gli altri boss usano i segnaposto procedurali finché non generi i loro modelli.

Per tenerli in locale (offline, niente CDN):

```bash
npm run fetch-models     # scarica in public/models/ e aggiorna il manifest
```

## Aggiungere gli altri boss: la pipeline

Per gli altri dieci boss del manifest:

1. Apri [`prompts/README.md`](./prompts/README.md) e il pacchetto prompt del boss in
   [`prompts/bosses/`](./prompts/bosses/) (text-to-3D, character sheet per image-to-3D, retexture,
   animazioni, snippet manifest).
2. Genera il modello (Meshy, Tripo, Rodin, Hunyuan3D…), riggalo e scarica le animazioni
   (Meshy/Tripo Animate o Mixamo).
3. Unisci tutto in un GLB con [`tools/blender_export.py`](./tools/blender_export.py), comprimi con
   `npm run optimize -- file.glb`, aggiorna il manifest con `npm run manifest`.
4. Metti il file in `public/models/<id>.glb`: l'app lo carica automaticamente.

Requisiti del GLB: un personaggio, piedi a y=0, fronte verso +Z, riggato, clip `Idle`, `Walk`,
`Attack1`, `Attack2`, `Hit`, `Death` (nomi alternativi riconosciuti in automatico). L'altezza viene
normalizzata a runtime, quindi la scala del file non importa.

## Struttura

```
elden-hologram-ar/
├── index.html, src/style.css      UI (italiano), schermata iniziale, HUD / DOM overlay
├── src/main.js                    bootstrap + API di debug window.__elden
├── src/app/App.js                 renderer, luci/ombre, evocazione, gesti, effetti, loop
├── src/app/Modes.js               WebXRMode · GyroCameraMode · PreviewMode
├── src/bosses/Boss.js             entità boss: normalizzazione, animazioni, stile, HP, evocazione/dissolvenza
├── src/bosses/BossLoader.js       manifest + GLTF (Draco/KTX2/Meshopt) con fallback procedurale
├── src/bosses/ProceduralBoss.js   segnaposto animati costruiti con primitive
├── src/fight/FightSystem.js       IA di combattimento tutti-contro-tutti
├── src/fx/                        shader ologramma, particelle, barre HP, suoni WebAudio
│                                  + WeaponTrail (scia della lama), ContactShadow (ombra sotto i piedi),
│                                  CameraMatch (grana e resa "ripreso dalla fotocamera")
├── src/ar/                        Stabilizer (movimento del telefono), CameraLight (luce della stanza)
├── src/input/Gestures.js          tap / drag / pinch / rotazione (Pointer Events)
├── public/bosses.json             manifest dei boss (stat, altezze da lore, clip, segnaposto)
├── public/models/, public/usdz/   i tuoi asset HD (ignorati da git)
├── prompts/                       prompt pack per generare i boss con l'IA
├── tools/                         ottimizzazione GLB, manifest, script Blender
├── tests/smoke.mjs                smoke test Playwright headless
└── tests/realism.mjs              verifica ombra di contatto, scia, contraccolpo, atterramento, luce
```

## Requisiti e limiti

| Piattaforma | Modalità | Note |
| --- | --- | --- |
| Android + Chrome (dispositivo con ARCore) | **Avvia AR** (WebXR) | tracciamento 6DoF delle superfici, ombre sul tavolo, stima luce |
| iPhone / iPad (Safari) | **Modalità Camera** | Safari iOS non supporta WebXR AR: il piano è virtuale, il telefono va tenuto fermo per il massimo realismo. Quick Look opzionale con USDZ (un boss alla volta). |
| Desktop | **Anteprima 3D** | orbit camera, tavolo virtuale |

- Serve **HTTPS** (WebXR, fotocamera, sensori). `npm run dev` lo fornisce in LAN.
- I nomi e i design dei boss sono di FromSoftware / Bandai Namco: progetto fan-made per uso personale,
  nessun asset del gioco incluso o redistribuibile.

## Roadmap

Vedi [`FASI.md`](./FASI.md): stato delle fasi completate e prossimi passi (occlusione con depth
sensing, modalità marker per iOS a 6DoF, multiplayer locale, registrazione video in-app).
