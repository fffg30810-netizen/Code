// send-message: il barista riceve il pensiero, controlla il cielo
// (anti-cheat: di giorno si rifiuta), il ritmo (1 ogni 20s), le regole
// della casa (blocklist) e lo appoggia sul bancone con la sua scadenza:
// l'alba locale del mittente. Le coordinate non vengono mai salvate.
import { json, preflight } from "../_shared/cors.ts";
import { isNight, nextSunrise, roundCoord, validCoords } from "../_shared/sun.ts";
import { containsBlocked } from "../_shared/blocklist.ts";
import { adminClient, isUuid } from "../_shared/admin.ts";

const MAX_LEN = 500;
const COOLDOWN_MS = 20_000;

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;

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

  const supabase = adminClient();

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
