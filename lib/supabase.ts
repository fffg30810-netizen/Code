import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!supabaseConfigured) {
    throw new Error("Supabase non configurato: compila .env.local (vedi .env.local.example)");
  }
  if (!client) {
    client = createClient(url!, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export interface FnResult<T = Record<string, unknown>> {
  status: number;
  data: T & { error?: string };
}

/**
 * Chiama una Edge Function e restituisce sempre status + body decodificato.
 * Non lancia mai: un errore di rete diventa { status: 0, error: "network" }.
 */
export async function callFunction<T = Record<string, unknown>>(
  name: string,
  payload: unknown
): Promise<FnResult<T>> {
  try {
    const res = await fetch(`${url}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey!,
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify(payload),
    });
    let data: FnResult<T>["data"];
    try {
      data = (await res.json()) as FnResult<T>["data"];
    } catch {
      data = { error: "invalid_response" } as FnResult<T>["data"];
    }
    return { status: res.status, data };
  } catch {
    return { status: 0, data: { error: "network" } as FnResult<T>["data"] };
  }
}
