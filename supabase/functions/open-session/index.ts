// open-session: al tramonto il barista ti dà un nome nuovo.
// Verifica che da te sia davvero notte, crea la sessione effimera
// e la fa scadere all'alba locale. Le coordinate restano in memoria.
import { json, preflight } from "../_shared/cors.ts";
import { isNight, nextSunrise, roundCoord, validCoords } from "../_shared/sun.ts";
import { generatePseudonym } from "../_shared/pseudonym.ts";
import { adminClient } from "../_shared/admin.ts";

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;

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

  const supabase = adminClient();
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
