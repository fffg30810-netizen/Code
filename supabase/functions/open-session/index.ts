// open-session: al tramonto il barista ti dà un nome nuovo.
// Verifica che da te sia davvero notte, crea la sessione effimera
// e la fa scadere all'alba locale. Le coordinate restano in memoria.
//
// File auto-contenuto: si può incollare così com'è nell'editor
// Edge Functions della dashboard Supabase (JWT verification: OFF).
import * as SunCalc from "npm:suncalc@2.0.1";
import { createClient } from "npm:@supabase/supabase-js@2";

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

/** Prossima alba (fino a 4 giorni avanti, per le latitudini estreme). */
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

/* ---------------- pseudonimi: ogni notte sei qualcun altro ---------------- */
type Gender = "m" | "f";

const CREATURES: Array<[string, Gender]> = [
  ["Gufo", "m"], ["Volpe", "f"], ["Falena", "f"], ["Corvo", "m"],
  ["Lucciola", "f"], ["Civetta", "f"], ["Riccio", "m"], ["Airone", "m"],
  ["Gatta", "f"], ["Lupo", "m"], ["Tasso", "m"], ["Barbagianni", "m"],
  ["Salamandra", "f"], ["Faina", "f"],
];

const ADJECTIVES: Array<Record<Gender, string>> = [
  { m: "Insonne", f: "Insonne" },
  { m: "Notturno", f: "Notturna" },
  { m: "Silenzioso", f: "Silenziosa" },
  { m: "Errante", f: "Errante" },
  { m: "Lunare", f: "Lunare" },
  { m: "Malinconico", f: "Malinconica" },
  { m: "Sonnambulo", f: "Sonnambula" },
  { m: "Pensieroso", f: "Pensierosa" },
  { m: "Randagio", f: "Randagia" },
  { m: "Scalzo", f: "Scalza" },
  { m: "Brumoso", f: "Brumosa" },
  { m: "Clandestino", f: "Clandestina" },
];

const ORDINALS: Record<Gender, string[]> = {
  m: ["Primo", "Secondo", "Terzo", "Quarto", "Quinto", "Sesto", "Settimo", "Ottavo", "Nono", "Ultimo"],
  f: ["Prima", "Seconda", "Terza", "Quarta", "Quinta", "Sesta", "Settima", "Ottava", "Nona", "Ultima"],
};

const OBJECTS: Array<[string, Gender]> = [
  ["Candela", "f"], ["Luna", "f"], ["Stella", "f"], ["Bicchiere", "m"],
  ["Tram", "m"], ["Lampione", "m"], ["Caffè", "m"], ["Turno", "m"],
  ["Brindisi", "m"], ["Sbadiglio", "m"], ["Insegna", "f"],
];

const WANDERERS = [
  "Chi Non Dorme", "Voce nel Buio", "Ombra al Bancone",
  "Anima in Piedi", "Cliente di Passaggio", "Pensiero delle Tre",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generatePseudonym(): string {
  const roll = Math.random();
  if (roll < 0.4) {
    const [noun, gender] = pick(CREATURES);
    return `${noun} ${pick(ADJECTIVES)[gender]}`;
  }
  if (roll < 0.7) {
    const [noun, gender] = pick(OBJECTS);
    return `${pick(ORDINALS[gender])} ${noun}`;
  }
  return `${pick(WANDERERS)} #${1 + Math.floor(Math.random() * 99)}`;
}

/* ---------------- la funzione ---------------- */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  let body: { lat?: unknown; lng?: unknown; offsetMin?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "bad_request" });
  }

  const { lat: rawLat, lng: rawLng, offsetMin } = body;
  if (!validCoords(rawLat, rawLng)) return json(400, { error: "bad_coords" });
  if (
    typeof offsetMin !== "number" ||
    !Number.isInteger(offsetMin) ||
    offsetMin < -720 ||
    offsetMin > 840
  ) {
    return json(400, { error: "bad_offset" });
  }

  const lat = roundCoord(rawLat as number);
  const lng = roundCoord(rawLng as number);

  // Il cancello notturno, lato server: di giorno non si entra.
  if (!isNight(lat, lng)) return json(403, { error: "daylight" });

  // La sessione muore all'alba locale. Alle latitudini senza alba
  // imminente, si spegne comunque dopo 24 ore.
  const dawn = nextSunrise(lat, lng);
  const expiresAt = dawn ?? new Date(Date.now() + 24 * 3_600_000);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data, error } = await supabase
    .from("sessions")
    .insert({
      pseudonym: generatePseudonym(),
      utc_offset_min: offsetMin,
      expires_at: expiresAt.toISOString(),
    })
    .select("id, token, pseudonym, expires_at")
    .single();

  if (error || !data) {
    console.error("open-session insert failed", error);
    return json(500, { error: "internal" });
  }

  return json(200, {
    token: data.token,
    sessionId: data.id,
    pseudonym: data.pseudonym,
    expiresAt: data.expires_at,
    offsetMin,
  });
});
