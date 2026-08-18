// send-message: il barista riceve il pensiero, controlla il cielo
// (anti-cheat: di giorno si rifiuta), il ritmo (1 ogni 20s), le regole
// della casa (blocklist) e lo appoggia sul bancone con la sua scadenza:
// l'alba locale del mittente. Le coordinate non vengono mai salvate.
//
// File auto-contenuto: si può incollare così com'è nell'editor
// Edge Functions della dashboard Supabase (JWT verification: OFF).
import * as SunCalc from "npm:suncalc@2.0.1";
import { createClient } from "npm:@supabase/supabase-js@2";

const MAX_LEN = 500;
const COOLDOWN_MS = 20_000;

/* ---------------- risposte ---------------- */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/* ---------------- sole (stessi conti del client: l'anti-cheat) ---------------- */
const roundCoord = (v: number) => Math.round(v * 10) / 10;

function isNight(lat: number, lng: number, at = new Date()): boolean {
  return SunCalc.getPosition(at, lat, lng).altitude < 0;
}

function isValidDate(d: Date | null | undefined): d is Date {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

function nextSunrise(lat: number, lng: number, after = new Date()): Date | null {
  for (let i = 0; i < 4; i++) {
    const day = new Date(after.getTime() + i * 86_400_000);
    const t = SunCalc.getTimes(day, lat, lng).sunrise;
    if (isValidDate(t) && t.getTime() > after.getTime()) return t;
  }
  return null;
}

function validCoords(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

/* ---------------- regole della casa (sincronizzare con lib/blocklist.ts) ---------------- */
const SLURS: string[] = [
  "negro", "negri", "negra", "negre",
  "frocio", "froci", "ricchione", "ricchioni",
  "mongoloide", "ritardato", "ritardata",
  "zingraccio", "sporco ebreo",
  "nigger", "niggers", "faggot", "faggots",
  "kike", "spic", "retard", "tranny",
];

const blockPattern = new RegExp(
  `(?:^|[^\\p{L}])(?:${SLURS.map((s) => s.replace(/ /g, "\\s+")).join("|")})(?:[^\\p{L}]|$)`,
  "iu"
);

function containsBlocked(text: string): boolean {
  return blockPattern.test(text.normalize("NFKC"));
}

/* ---------------- la funzione ---------------- */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  let payload: { token?: unknown; lat?: unknown; lng?: unknown; body?: unknown };
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: "bad_request" });
  }

  const { token, lat: rawLat, lng: rawLng, body } = payload;
  if (!isUuid(token)) return json(401, { error: "invalid_session" });
  if (!validCoords(rawLat, rawLng)) return json(400, { error: "bad_coords" });
  if (typeof body !== "string") return json(400, { error: "bad_body" });

  const text = body.trim();
  if (text.length === 0 || text.length > MAX_LEN) {
    return json(400, { error: "bad_body" });
  }

  const lat = roundCoord(rawLat as number);
  const lng = roundCoord(rawLng as number);

  // Anti-cheat: il server rifà i conti col sole. Di giorno, niente.
  if (!isNight(lat, lng)) return json(403, { error: "daylight" });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: session } = await supabase
    .from("sessions")
    .select("id, pseudonym, utc_offset_min, expires_at, muted")
    .eq("token", token)
    .maybeSingle();

  if (!session) return json(401, { error: "invalid_session" });
  if (new Date(session.expires_at).getTime() <= Date.now()) {
    return json(401, { error: "expired" });
  }
  if (session.muted) return json(403, { error: "muted" });

  // Regole della casa.
  if (containsBlocked(text)) return json(400, { error: "blocked" });

  // Rate limit atomico: si "prenota" lo slot aggiornando last_message_at
  // solo se sono passati almeno 20 secondi dall'ultimo messaggio.
  const now = new Date();
  const cutoff = new Date(now.getTime() - COOLDOWN_MS).toISOString();
  const { data: slot } = await supabase
    .from("sessions")
    .update({ last_message_at: now.toISOString() })
    .eq("id", session.id)
    .or(`last_message_at.is.null,last_message_at.lt.${cutoff}`)
    .select("id");

  if (!slot || slot.length === 0) {
    return json(429, { error: "slow_down", retryAfterMs: COOLDOWN_MS });
  }

  // Il messaggio brucia all'alba locale del mittente.
  const dawn = nextSunrise(lat, lng);
  const expiresAt =
    dawn ??
    new Date(
      Math.min(
        new Date(session.expires_at).getTime(),
        now.getTime() + 24 * 3_600_000
      )
    );

  const { data: msg, error } = await supabase
    .from("messages")
    .insert({
      session_id: session.id,
      pseudonym: session.pseudonym,
      body: text,
      utc_offset_min: session.utc_offset_min,
      expires_at: expiresAt.toISOString(),
    })
    .select("id")
    .single();

  if (error || !msg) {
    console.error("send-message insert failed", error);
    return json(500, { error: "internal" });
  }

  return json(200, { ok: true, id: msg.id });
});
