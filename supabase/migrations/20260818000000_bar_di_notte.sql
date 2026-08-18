-- ============================================================
-- BAR DI NOTTE — schema iniziale
-- Tre tavoli nel retrobottega: sessions, messages, reports.
-- Nessuna coordinata viene mai salvata: solo scadenze (l'alba).
-- ============================================================

-- Estensioni ------------------------------------------------------------
create extension if not exists pg_cron;

-- ------------------------------------------------------------
-- SESSIONS: identità effimere. Nascono al tramonto, muoiono all'alba.
--   id     = identificatore pubblico (finisce sui messaggi)
--   token  = segreto per scrivere (non lascia mai le Edge Functions)
-- ------------------------------------------------------------
create table public.sessions (
  id              uuid primary key default gen_random_uuid(),
  token           uuid not null unique default gen_random_uuid(),
  pseudonym       text not null,
  utc_offset_min  integer not null check (utc_offset_min between -720 and 840),
  expires_at      timestamptz not null,          -- l'alba locale
  last_message_at timestamptz,                   -- per il rate limit (1 msg / 20s)
  muted           boolean not null default false,
  created_at      timestamptz not null default now()
);

create index sessions_token_idx on public.sessions (token);
create index sessions_expires_idx on public.sessions (expires_at);

-- ------------------------------------------------------------
-- MESSAGES: i pensieri lasciati sul bancone. expires_at = alba locale
-- del mittente, calcolata in memoria dalla Edge Function (le coordinate
-- NON vengono salvate). utc_offset_min individua il bancone (stanza).
-- ------------------------------------------------------------
create table public.messages (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references public.sessions (id) on delete cascade,
  pseudonym      text not null,
  body           text not null check (char_length(body) between 1 and 500),
  utc_offset_min integer not null check (utc_offset_min between -720 and 840),
  hidden         boolean not null default false, -- 3 segnalazioni = nascosto
  expires_at     timestamptz not null,           -- l'alba: poi, cenere
  created_at     timestamptz not null default now()
);

create index messages_room_idx on public.messages (utc_offset_min, created_at);
create index messages_expires_idx on public.messages (expires_at);

-- ------------------------------------------------------------
-- REPORTS: segnalazioni al barista. Una per avventore per messaggio.
-- ------------------------------------------------------------
create table public.reports (
  id                  bigint generated always as identity primary key,
  message_id          uuid not null references public.messages (id) on delete cascade,
  reporter_session_id uuid not null references public.sessions (id) on delete cascade,
  created_at          timestamptz not null default now(),
  unique (message_id, reporter_session_id)
);

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY
-- Gli avventori (anon) possono SOLO leggere i messaggi visibili e non
-- ancora bruciati. Ogni scrittura passa dalle Edge Functions (service
-- role), che rifanno i conti col sole: è l'anti-cheat.
-- ------------------------------------------------------------
alter table public.sessions enable row level security;
alter table public.messages enable row level security;
alter table public.reports  enable row level security;

create policy "chiunque legge i messaggi visibili e non bruciati"
  on public.messages
  for select
  to anon, authenticated
  using (hidden = false and expires_at > now());

-- Nessuna policy su sessions e reports: invisibili a chiunque
-- non abbia la service role key. Nessuna policy di insert/update/delete
-- su messages: si scrive solo passando dal barista (Edge Function).

-- ------------------------------------------------------------
-- REALTIME: la chat live ascolta gli INSERT su messages.
-- ------------------------------------------------------------
alter publication supabase_realtime add table public.messages;

-- ------------------------------------------------------------
-- LA COMBUSTIONE: ogni 15 minuti, hard delete di tutto ciò la cui alba
-- è passata. Non è un soft delete: è un DELETE. La notte non si archivia.
-- ------------------------------------------------------------
select cron.schedule(
  'bar-di-notte-combustione',
  '*/15 * * * *',
  $$
    delete from public.messages where expires_at < now();
    delete from public.sessions where expires_at < now();
  $$
);
