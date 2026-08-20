# Che Pasta! 🍝

> In italiano si dice **«essere di pasta buona»**. Noi l'abbiamo presa alla lettera.

**Che Pasta!** è il mood tracker più italiano che c'è: ogni giorno scegli la pasta che ti
rappresenta — Fusillo se sei ingarbugliato, Penna all'arrabbiata se girano, Gnocco se
servono coccole, Spaghetto scotto se la giornata ti ha lessato — e il tuo umore diventa
un menù: diario a calendario, classifica delle paste, giorni di fila e il commento dello chef.

Dodici formati di umore, dodici mascotte kawaii disegnate a mano in SVG.

## Cosa c'è in scatola

```
.
├── index.html            → reindirizza al sito
├── app/                  → l'app per telefono (PWA installabile)
│   ├── index.html        → tutta l'app: HTML + CSS + JS vanilla, zero dipendenze
│   ├── manifest.webmanifest
│   ├── sw.js             → service worker: funziona anche offline
│   └── icons/            → icona dell'app (SVG + PNG)
└── site/
    └── index.html        → il sito di presentazione
```

Nessun framework, nessuna build, nessun `npm install`: due file HTML autosufficienti.
L'unica risorsa esterna sono i font (Google Fonts: Lilita One + Nunito), con fallback di sistema.

## Provarla

Serve un qualsiasi server statico (per il service worker serve `http://localhost` o HTTPS):

```bash
python3 -m http.server 8000
# poi apri http://localhost:8000  → sito
#          http://localhost:8000/app/  → app
```

Su telefono: aprila nel browser e scegli **"Aggiungi alla schermata Home"** — si installa
come una vera app e funziona offline.

Trucchi per fare i curiosi in fretta:

- `app/?demo=1` riempie sei settimane di dati di esempio (solo se la dispensa è vuota);
- `app/?tab=diario` (o `menu`) apre direttamente una tab;
- in **Menù → «Cucina un po' di dati di prova»** fai lo stesso dall'interno dell'app.

## I dodici formati

| Pasta | Umore |
|---|---|
| Fusillo | Ingarbugliato |
| Farfalla | Leggero |
| Rigatone | Tosto |
| Penna all'arrabbiata | Arrabbiato |
| Gnocco | Coccoloso |
| Spaghetto scotto | Sfinito |
| Tortellino | Innamorato |
| Lasagna | A strati |
| Conchiglia | In guscio |
| Stellina | Sognante |
| Linguine | Chiacchierone |
| Ruota | Su di giri |

## Privacy

I dati restano nel `localStorage` del dispositivo. Niente account, niente cloud,
niente analytics: solo tu e la tua dispensa.

---

*Peso netto: 1 umore ℮ · Cottura: 24 ore · Nessun fusillo è stato maltrattato.*
