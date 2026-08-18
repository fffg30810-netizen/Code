# 🕯️ Bar di Notte

Chat anonima ed effimera, aperta **solo quando è buio nel tuo luogo fisico**.
All'alba locale, tutto ciò che è stato scritto viene distrutto per sempre — un
vero `DELETE`, con un'animazione di combustione. Nessun account, nessun
archivio, nessuna cronologia. Il confessionale delle 3 di notte.

## Stack

- **Next.js 15** (App Router) + TypeScript + Tailwind CSS 4
- **Supabase**: Postgres, Realtime, Edge Functions, pg_cron
- **suncalc** per il calcolo di alba/tramonto — client E server, niente API esterne
- Deploy: Vercel (frontend) + Supabase cloud (free tier)

## Come funziona

| Meccanica | Implementazione |
|---|---|
| Cancello notturno | Geolocalizzazione browser arrotondata a 1 decimale (~11 km), `suncalc`: sole sotto l'orizzonte ⇒ si entra; altrimenti porta chiusa + countdown al tramonto |
| Anti-cheat | Ogni scrittura passa da una Edge Function che **ricalcola** giorno/notte server-side; le coordinate vivono solo in memoria, mai nel DB |
| Identità effimera | `open-session` genera uno pseudonimo poetico ("Gufo Insonne", "Terza Candela", "Chi Non Dorme #12") e un token che scade all'alba locale |
| Banconi | Una stanza per fuso orario (offset UTC in minuti); Realtime `postgres_changes` + Presence per il contatore dei presenti |
| Combustione | `pg_cron` ogni 15 minuti: `DELETE` dei messaggi/sessioni la cui alba è passata; client: animazione CSS di carbonizzazione, poi "Il bar è chiuso. Buona giornata." |
| Regole della casa | 1 msg / 20 s (atomico, server-side), max 500 caratteri, blocklist, 3 segnalazioni ⇒ messaggio nascosto + autore silenziato per la notte |
| Angolo del barista | Parole chiave di crisi ⇒ banner gentile **solo per l'autore** con Telefono Amico 02 2327 2327. Nessun blocco, nessun giudizio |

## Struttura

```
app/                    layout, pagina unica, tema (globals.css)
components/
  NightGate.tsx         il cancello: geolocalizzazione + giorno/notte
  ClosedDoor.tsx        porta chiusa + countdown al tramonto
  Bar.tsx               il bancone: chat realtime, presenze, combustione
  BaristaBanner.tsx     l'angolo del barista
  Candle.tsx            fiammella animata
lib/
  sun.ts                suncalc client (arrotondamento, notte, prossimi eventi)
  session.ts            sessione effimera in localStorage (muore all'alba)
  supabase.ts           client + chiamate alle Edge Functions
  blocklist.ts          pre-controllo client (autoritativo: server)
  crisis.ts             parole chiave per l'angolo del barista
supabase/
  migrations/…_bar_di_notte.sql   schema completo: tabelle, RLS, realtime, pg_cron
  functions/
    _shared/            sole, pseudonimi, blocklist, CORS, client admin
    open-session/       crea l'identità della notte (verifica notturna)
    send-message/       anti-cheat + rate limit + inserimento
    report-message/     segnalazioni e silenziamenti
```

---

## Setup (Windows + PowerShell)

Prerequisiti: [Node 20+](https://nodejs.org), un progetto su
[supabase.com](https://supabase.com) (free tier), la
[Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started)
(`scoop install supabase` oppure `winget install Supabase.CLI`).

### 1. Dipendenze e ambiente

```powershell
npm install
Copy-Item .env.local.example .env.local
# Apri .env.local e incolla URL + anon key del progetto
# (Dashboard -> Project Settings -> API)
notepad .env.local
```

### 2. Database (schema + RLS + combustione)

Opzione A — con la CLI collegata al progetto:

```powershell
supabase login
supabase link --project-ref TUO_PROJECT_REF
supabase db push
```

Opzione B — a mano: apri il **SQL Editor** nella dashboard Supabase e incolla
l'intero contenuto di `supabase/migrations/20260818000000_bar_di_notte.sql`.

> ⚠️ `pg_cron` dev'essere abilitato sul progetto: Dashboard → Database →
> Extensions → cerca `pg_cron` → Enable (la migrazione fa comunque
> `create extension if not exists pg_cron`).

### 3. Edge Functions

```powershell
supabase functions deploy open-session `
  --no-verify-jwt
supabase functions deploy send-message `
  --no-verify-jwt
supabase functions deploy report-message `
  --no-verify-jwt
```

(Le funzioni validano da sole il token di sessione; `--no-verify-jwt` le rende
indipendenti dal tipo di API key. `SUPABASE_URL` e
`SUPABASE_SERVICE_ROLE_KEY` sono iniettate automaticamente da Supabase.)

### 4. Avvio

```powershell
npm run dev
```

Apri http://localhost:3000. Se da te è giorno, troverai la porta chiusa —
com'è giusto che sia (per i test, vedi sotto come "viaggiare").

### 5. Deploy su Vercel

```powershell
npm install -g vercel
vercel
# poi configura le env nel progetto Vercel:
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel --prod
```

> La geolocalizzazione browser richiede HTTPS (o localhost): su Vercel è
> automatico.

---

## Test manuali, passo per passo

Trucco per "viaggiare" nel tempo/spazio senza aspettare il tramonto: in
DevTools (F12) → **Sensors** → Location, imposta coordinate dove ora è notte
(es. `-33.9, 151.2` Sydney, oppure `35.7, 139.7` Tokyo) o dove è giorno
(es. `40.7, -74.0` New York), poi ricarica. Le coordinate in sessionStorage si
azzerano chiudendo la scheda (`sessionStorage.removeItem('bdn.coords')` per
forzare).

1. **Scaffolding + schema** — `npm run build` compila senza errori; nella
   dashboard Supabase vedi le tabelle `sessions`, `messages`, `reports` con
   RLS attiva (lucchetto). `select * from cron.job;` nel SQL Editor mostra
   `bar-di-notte-combustione`.
2. **Cancello notturno** — con coordinate "di giorno": porta chiusa, scritta
   "Il bar apre al tramonto" e countdown coerente con l'orario locale di quel
   punto. Con coordinate "di notte": si entra.
3. **Pseudonimi + sessioni** — entrando, l'header mostra "stanotte sei
   *Gufo Insonne*" (o simile); in `localStorage` c'è `bdn.session` con
   `expiresAt` = prossima alba. Nella tabella `sessions` c'è la riga, senza
   alcuna coordinata.
4. **Chat realtime** — apri due browser (o una finestra in incognito): il
   contatore dice "2 nottambuli al bancone"; un messaggio inviato da uno
   appare all'altro in ~1 s, con dissolvenza lenta.
5. **Verifica server-side** — da DevTools Console, prova a scrivere
   direttamente sul DB: `await (window.supabase ?? null)` — non esposto; con
   l'anon key via REST un `INSERT` su `messages` fallisce (RLS, nessuna
   policy di insert). Chiama la funzione con coordinate diurne:
   ```powershell
   $body = @'
   {"token":"00000000-0000-0000-0000-000000000000","lat":40.7,"lng":-74.0,"body":"ciao"}
   '@
   Invoke-RestMethod -Method Post `
     -Uri "https://TUO-PROGETTO.supabase.co/functions/v1/send-message" `
     -Headers @{ apikey = "ANON_KEY"; Authorization = "Bearer ANON_KEY" } `
     -ContentType "application/json" -Body $body
   ```
   → se in quel punto è giorno risponde `403 {"error":"daylight"}`; di notte
   `401 invalid_session` (il token finto non esiste). Invia due messaggi in
   meno di 20 s dall'app → "Con calma: un pensiero ogni 20 secondi."
6. **Combustione** — server: nel SQL Editor,
   `update messages set expires_at = now() - interval '1 minute';` poi
   `select cron.schedule…` o attendi ≤15 min → la tabella si svuota (hard
   delete). Client: in Console
   `const s = JSON.parse(localStorage.getItem('bdn.session')); s.expiresAt = new Date(Date.now()+5000).toISOString(); localStorage.setItem('bdn.session', JSON.stringify(s)); location.reload()`
   → dopo 5 s i messaggi bruciano (carbonizzazione + cenere) e appare "Il bar
   è chiuso. Buona giornata."
7. **Moderazione + barista** — invia un messaggio con una parola della
   blocklist → rifiutato con il messaggio del barista. Da 3 sessioni diverse
   (3 browser/incognito) segnala lo stesso messaggio → sparisce ai nuovi
   fetch e l'autore riceve `403 muted` al prossimo invio. Scrivi un messaggio
   contenente "non ce la faccio più" → **solo tu** vedi il bigliettino con
   Telefono Amico 02 2327 2327; il messaggio parte comunque.
8. **Estetica + countdown** — countdown all'alba sempre visibile in alto
   ("il bar chiude tra 3h 12m"), fiammella che tremola accanto al contatore,
   messaggi in serif che appaiono come pensieri, tutto usabile col pollice su
   mobile (input e bottone in basso, safe-area rispettata).

---

## Note e limiti (scelte deliberate)

- **Privacy**: le coordinate sono arrotondate a ~11 km *prima* di lasciare il
  browser, viaggiano solo verso le Edge Functions e non vengono mai scritte
  da nessuna parte. Nel DB esistono solo scadenze (`expires_at`).
- **Niente soft delete**: la combustione è `DELETE`. Il backup point-in-time
  di Supabase è disattivato sul free tier; se attivi i backup, sappi che
  contraddicono lo spirito del bar.
- I messaggi nascosti dalla moderazione spariscono ai nuovi caricamenti e
  alla riconciliazione periodica (60 s); chi li ha già a schermo li tiene
  fino ad allora.
- Un burlone potrebbe inviare coordinate di un punto dove è notte pur essendo
  altrove: senza account e senza tracciamento è il compromesso accettato
  (il danno massimo è… chattare di giorno da un fuso sbagliato).
- Blocklist e parole chiave del barista sono liste base in
  `lib/blocklist.ts` / `lib/crisis.ts` e `supabase/functions/_shared/` —
  pensate per essere estese (tenere sincronizzate client e server).
