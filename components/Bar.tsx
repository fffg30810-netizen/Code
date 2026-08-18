"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import Candle from "@/components/Candle";
import BaristaBanner from "@/components/BaristaBanner";
import { formatClock, formatCountdown } from "@/lib/format";
import { containsBlocked } from "@/lib/blocklist";
import { detectCrisis } from "@/lib/crisis";
import {
  clearSession,
  getStoredSession,
  storeSession,
  type BarSession,
} from "@/lib/session";
import { callFunction, getSupabase } from "@/lib/supabase";

const MAX_LEN = 500;
const COOLDOWN_MS = 20_000;
const BURN_TOTAL_MS = 3800;

interface Msg {
  id: string;
  session_id: string;
  pseudonym: string;
  body: string;
  created_at: string;
}

interface Props {
  lat: number;
  lng: number;
  offsetMin: number;
  /** Il server (o l'orologio) dice che è giorno: si torna al cancello. */
  onDay: () => void;
}

type Phase = "opening" | "open" | "burning" | "closed";

export default function Bar({ lat, lng, offsetMin, onDay }: Props) {
  const [phase, setPhase] = useState<Phase>("opening");
  const [session, setSession] = useState<BarSession | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [present, setPresent] = useState(1);
  const [dawnLeft, setDawnLeft] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [showBarista, setShowBarista] = useState(false);
  const [reported, setReported] = useState<Set<string>>(new Set());
  const listRef = useRef<HTMLDivElement>(null);
  const burnStarted = useRef(false);

  /* ------------------------------------------------------------------ */
  /* Combustione: all'alba i messaggi bruciano e il bar chiude.          */
  /* ------------------------------------------------------------------ */
  const startBurn = useCallback(() => {
    if (burnStarted.current) return;
    burnStarted.current = true;
    clearSession();
    setPhase("burning");
    window.setTimeout(() => setPhase("closed"), BURN_TOTAL_MS);
  }, []);

  /* ------------------------------------------------------------------ */
  /* Apertura sessione effimera                                          */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    let cancelled = false;
    async function open() {
      const stored = getStoredSession();
      if (stored && stored.offsetMin === offsetMin) {
        setSession(stored);
        setPhase("open");
        return;
      }
      clearSession();
      const { status, data } = await callFunction<BarSession>("open-session", {
        lat,
        lng,
        offsetMin,
      });
      if (cancelled) return;
      if (status === 200 && data.token) {
        const s: BarSession = {
          token: data.token,
          sessionId: data.sessionId,
          pseudonym: data.pseudonym,
          expiresAt: data.expiresAt,
          offsetMin,
        };
        storeSession(s);
        setSession(s);
        setPhase("open");
      } else if (status === 403 && data.error === "daylight") {
        onDay();
      } else {
        setOpenError(
          "Il barista non riesce ad aprirti la porta. Riprova tra un momento."
        );
      }
    }
    open();
    return () => {
      cancelled = true;
    };
  }, [lat, lng, offsetMin, onDay]);

  /* ------------------------------------------------------------------ */
  /* Countdown all'alba (l'ansia dolce della fine)                       */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (!session) return;
    const dawn = new Date(session.expiresAt).getTime();
    const tick = () => {
      const ms = dawn - Date.now();
      setDawnLeft(ms);
      if (ms <= 0) startBurn();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [session, startBurn]);

  /* ------------------------------------------------------------------ */
  /* Messaggi: fetch iniziale + realtime + riconciliazione ogni 60s      */
  /* ------------------------------------------------------------------ */
  const loadMessages = useCallback(async () => {
    const supabase = getSupabase();
    const { data } = await supabase
      .from("messages")
      .select("id,session_id,pseudonym,body,created_at")
      .eq("utc_offset_min", offsetMin)
      .order("created_at", { ascending: true })
      .limit(300);
    if (data) setMessages(data as Msg[]);
  }, [offsetMin]);

  useEffect(() => {
    if (phase !== "open") return;
    const supabase = getSupabase();
    loadMessages();

    const channel: RealtimeChannel = supabase
      .channel(`bancone-${offsetMin}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `utc_offset_min=eq.${offsetMin}`,
        },
        (payload) => {
          const m = payload.new as Msg & { hidden?: boolean };
          if (m.hidden) return;
          setMessages((prev) =>
            prev.some((x) => x.id === m.id) ? prev : [...prev, m]
          );
        }
      )
      .subscribe();

    const reconcile = setInterval(loadMessages, 60_000);
    return () => {
      clearInterval(reconcile);
      supabase.removeChannel(channel);
    };
  }, [phase, offsetMin, loadMessages]);

  /* ------------------------------------------------------------------ */
  /* Presenze al bancone                                                 */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (phase !== "open" || !session) return;
    const supabase = getSupabase();
    const channel = supabase.channel(`presenza-${offsetMin}`, {
      config: { presence: { key: session.sessionId } },
    });
    channel
      .on("presence", { event: "sync" }, () => {
        setPresent(Math.max(1, Object.keys(channel.presenceState()).length));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") await channel.track({ at: Date.now() });
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [phase, offsetMin, session]);

  /* ------------------------------------------------------------------ */
  /* Cooldown 20s e autoscroll                                           */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    const id = setInterval(
      () => setCooldownLeft(Math.max(0, cooldownUntil - Date.now())),
      250
    );
    return () => clearInterval(id);
  }, [cooldownUntil]);

  useEffect(() => {
    if (phase === "open" && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, phase]);

  /* ------------------------------------------------------------------ */
  /* Invio                                                               */
  /* ------------------------------------------------------------------ */
  async function send() {
    if (!session || sending || phase !== "open") return;
    const text = input.trim();
    if (!text || text.length > MAX_LEN) return;
    if (Date.now() < cooldownUntil) return;
    if (containsBlocked(text)) {
      setNotice("Il barista scuote la testa: certe parole qui non entrano.");
      return;
    }
    setSending(true);
    setNotice(null);
    const { status, data } = await callFunction("send-message", {
      token: session.token,
      lat,
      lng,
      body: text,
    });
    setSending(false);

    if (status === 200) {
      setInput("");
      setCooldownUntil(Date.now() + COOLDOWN_MS);
      if (detectCrisis(text)) setShowBarista(true);
      return;
    }
    if (status === 403 && data.error === "daylight") {
      startBurn();
    } else if (status === 403 && data.error === "muted") {
      setNotice("Per stanotte il barista ti ha chiesto di ascoltare soltanto.");
    } else if (status === 429) {
      setNotice("Con calma: un pensiero ogni 20 secondi.");
      setCooldownUntil(Date.now() + COOLDOWN_MS);
    } else if (status === 400 && data.error === "blocked") {
      setNotice("Il barista scuote la testa: certe parole qui non entrano.");
    } else if (status === 401) {
      clearSession();
      setNotice("La tua sessione è svanita nel buio. Ricarica la pagina.");
    } else {
      setNotice("Il messaggio si è perso nel fumo. Riprova.");
    }
  }

  /* ------------------------------------------------------------------ */
  /* Segnalazioni                                                        */
  /* ------------------------------------------------------------------ */
  async function report(messageId: string) {
    if (!session || reported.has(messageId)) return;
    setReported((prev) => new Set(prev).add(messageId));
    const { status, data } = await callFunction("report-message", {
      token: session.token,
      messageId,
    });
    if (status === 200 && data.hidden) {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    }
    setNotice("Segnalazione ricevuta. Il barista terrà d'occhio il tavolo.");
  }

  /* ------------------------------------------------------------------ */
  /* Render                                                              */
  /* ------------------------------------------------------------------ */

  if (phase === "closed") {
    return (
      <main className="fade-slow flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
        <div aria-hidden className="text-3xl opacity-60">
          🌅
        </div>
        <h1 className="font-lettera text-3xl text-parchment">Il bar è chiuso.</h1>
        <p className="text-sm text-parchment-dim">
          Ogni parola di stanotte è cenere. Buona giornata.
        </p>
      </main>
    );
  }

  if (openError) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-parchment-dim">{openError}</p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-full border border-ember-dim px-5 py-2 text-sm text-ember"
        >
          Bussa di nuovo
        </button>
      </main>
    );
  }

  if (phase === "opening" || !session) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4">
        <Candle />
        <p className="text-sm text-parchment-dim">Il barista ti apre la porta…</p>
      </main>
    );
  }

  const burning = phase === "burning";
  const chars = input.length;

  return (
    <div className="mx-auto flex h-dvh max-w-lg flex-col">
      {/* Header: candela, presenze, countdown all'alba */}
      <header className="flex items-center justify-between border-b border-night-line px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Candle small />
          <div>
            <p className="text-sm text-parchment">
              {present} {present === 1 ? "nottambulo" : "nottambuli"} al bancone
            </p>
            <p className="text-[11px] text-parchment-dim">
              stanotte sei <span className="text-ember">{session.pseudonym}</span>
            </p>
          </div>
        </div>
        {dawnLeft !== null && (
          <p className="text-right text-[11px] leading-tight text-parchment-dim">
            il bar chiude tra
            <br />
            <span className="font-lettera text-sm tabular-nums text-ember">
              {formatCountdown(dawnLeft)}
            </span>
          </p>
        )}
      </header>

      {/* Messaggi */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && !burning && (
          <p className="mt-16 text-center font-lettera text-sm italic text-parchment-dim">
            Il bancone è ancora pulito. Di&apos; qualcosa nel buio.
          </p>
        )}
        <ul className="space-y-5">
          {messages.map((m, i) => {
            const mine = m.session_id === session.sessionId;
            return (
              <li
                key={m.id}
                className={burning ? "msg-burn" : "msg-in"}
                style={burning ? { animationDelay: `${(i % 14) * 0.12}s` } : undefined}
              >
                <div className="mb-0.5 flex items-baseline gap-2">
                  <span
                    className={`text-xs ${mine ? "text-ember" : "text-ember/70"}`}
                  >
                    {m.pseudonym}
                    {mine && " (tu)"}
                  </span>
                  <span className="text-[10px] text-parchment-dim">
                    {formatClock(m.created_at)}
                  </span>
                  {!mine && (
                    <button
                      onClick={() => report(m.id)}
                      disabled={reported.has(m.id)}
                      aria-label="Segnala questo messaggio"
                      title="Segnala al barista"
                      className="ml-auto text-[10px] text-parchment-dim/60 transition-colors hover:text-danger disabled:opacity-40"
                    >
                      {reported.has(m.id) ? "segnalato" : "⚑"}
                    </button>
                  )}
                </div>
                <p className="font-lettera text-[15px] leading-relaxed text-parchment">
                  {m.body}
                </p>
              </li>
            );
          })}
        </ul>
        {burning && (
          <div aria-hidden>
            {Array.from({ length: 14 }).map((_, i) => (
              <span
                key={i}
                className="ash"
                style={{
                  left: `${6 + ((i * 37) % 88)}%`,
                  animationDelay: `${(i % 7) * 0.3}s`,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Angolo del barista */}
      {showBarista && !burning && (
        <BaristaBanner onDismiss={() => setShowBarista(false)} />
      )}

      {/* Avvisi */}
      {notice && !burning && (
        <p className="px-4 pb-1 text-xs text-ember/80" role="status">
          {notice}
        </p>
      )}

      {/* Input: mobile-first, tutto sotto il pollice */}
      <footer className="border-t border-night-line px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => {
              setInput(e.target.value.slice(0, MAX_LEN));
              if (notice) setNotice(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            disabled={burning}
            placeholder="Racconta al buio…"
            className="max-h-32 min-h-[2.75rem] flex-1 resize-none rounded-xl border border-night-line bg-night-panel px-4 py-2.5 font-lettera text-[15px] text-parchment placeholder:text-parchment-dim/60 focus:border-ember-dim focus:outline-none"
          />
          <button
            onClick={send}
            disabled={
              burning || sending || !input.trim() || cooldownLeft > 0
            }
            className="h-11 shrink-0 rounded-xl bg-ember px-4 text-sm font-medium text-night transition-opacity disabled:opacity-35"
          >
            {cooldownLeft > 0 ? `${Math.ceil(cooldownLeft / 1000)}s` : "Di' pure"}
          </button>
        </div>
        <p className="mt-1 pr-1 text-right text-[10px] text-parchment-dim/60">
          {chars}/{MAX_LEN}
        </p>
      </footer>
    </div>
  );
}
