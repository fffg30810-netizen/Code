// report-message: una segnalazione al barista. Alla terza, il messaggio
// viene nascosto e chi l'ha scritto resta in silenzio per il resto
// della notte. All'alba, come tutto, anche questo viene dimenticato.
import { json, preflight } from "../_shared/cors.ts";
import { adminClient, isUuid } from "../_shared/admin.ts";

const REPORTS_TO_HIDE = 3;

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;

  let payload: { token?: unknown; messageId?: unknown };
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: "bad_request" });
  }

  const { token, messageId } = payload;
  if (!isUuid(token)) return json(401, { error: "invalid_session" });
  if (!isUuid(messageId)) return json(400, { error: "bad_message" });

  const supabase = adminClient();

  const { data: session } = await supabase
    .from("sessions")
    .select("id, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (!session || new Date(session.expires_at).getTime() <= Date.now()) {
    return json(401, { error: "invalid_session" });
  }

  const { data: message } = await supabase
    .from("messages")
    .select("id, session_id, hidden")
    .eq("id", messageId)
    .maybeSingle();
  if (!message) return json(404, { error: "not_found" });

  const { error: insertError } = await supabase.from("reports").upsert(
    { message_id: message.id, reporter_session_id: session.id },
    { onConflict: "message_id,reporter_session_id", ignoreDuplicates: true }
  );
  if (insertError) {
    console.error("report insert failed", insertError);
    return json(500, { error: "internal" });
  }

  const { count } = await supabase
    .from("reports")
    .select("id", { count: "exact", head: true })
    .eq("message_id", message.id);

  const reports = count ?? 0;
  let hidden = message.hidden;

  if (!hidden && reports >= REPORTS_TO_HIDE) {
    await supabase.from("messages").update({ hidden: true }).eq("id", message.id);
    await supabase
      .from("sessions")
      .update({ muted: true })
      .eq("id", message.session_id);
    hidden = true;
  }

  return json(200, { reports, hidden });
});
