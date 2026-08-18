"use client";

import { useCallback, useEffect, useState } from "react";
import Bar from "@/components/Bar";
import Candle from "@/components/Candle";
import ClosedDoor from "@/components/ClosedDoor";
import { isNight, localUtcOffsetMin, nextSunset, roundCoord } from "@/lib/sun";
import { supabaseConfigured } from "@/lib/supabase";

type Gate =
  | { state: "boot" }
  | { state: "ask" }
  | { state: "locating" }
  | { state: "denied" }
  | { state: "unsupported" }
  | { state: "day"; lat: number; lng: number }
  | { state: "night"; lat: number; lng: number };

const COORDS_KEY = "bdn.coords";

function loadCoords(): { lat: number; lng: number } | null {
  try {
    const raw = window.sessionStorage.getItem(COORDS_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as { lat: number; lng: number };
    if (typeof c.lat !== "number" || typeof c.lng !== "number") return null;
    return c;
  } catch {
    return null;
  }
}

export default function NightGate() {
  const [gate, setGate] = useState<Gate>({ state: "boot" });

  const enterWith = useCallback((lat: number, lng: number) => {
    setGate(isNight(lat, lng) ? { state: "night", lat, lng } : { state: "day", lat, lng });
  }, []);

  // Al primo accesso: se abbiamo già le coordinate (arrotondate) in questa
  // scheda, entriamo senza richiedere il permesso.
  useEffect(() => {
    const c = loadCoords();
    if (c) enterWith(c.lat, c.lng);
    else setGate({ state: "ask" });
  }, [enterWith]);

  // Di giorno ricontrolliamo ogni 30s: appena il sole scende, la porta si apre.
  useEffect(() => {
    if (gate.state !== "day") return;
    const id = setInterval(() => enterWith(gate.lat, gate.lng), 30_000);
    return () => clearInterval(id);
  }, [gate, enterWith]);

  function knock() {
    if (!("geolocation" in navigator)) {
      setGate({ state: "unsupported" });
      return;
    }
    setGate({ state: "locating" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Arrotondiamo subito a 1 decimale (~11 km): la posizione precisa
        // non lascia mai questa funzione.
        const lat = roundCoord(pos.coords.latitude);
        const lng = roundCoord(pos.coords.longitude);
        try {
          window.sessionStorage.setItem(COORDS_KEY, JSON.stringify({ lat, lng }));
        } catch {
          // senza storage si rientra bussando di nuovo: va bene così
        }
        enterWith(lat, lng);
      },
      () => setGate({ state: "denied" }),
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 600_000 }
    );
  }

  if (!supabaseConfigured) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <Candle />
        <h1 className="font-lettera text-2xl text-parchment">Bar di Notte</h1>
        <p className="max-w-sm text-sm text-parchment-dim">
          Manca la configurazione di Supabase: copia{" "}
          <code className="text-ember">.env.local.example</code> in{" "}
          <code className="text-ember">.env.local</code> e compila URL e chiave
          anon del tuo progetto.
        </p>
      </main>
    );
  }

  switch (gate.state) {
    case "boot":
      return <main className="min-h-dvh" />;

    case "ask":
    case "locating":
      return (
        <main className="fade-slow flex min-h-dvh flex-col items-center justify-center gap-8 px-6 text-center">
          <Candle />
          <div className="space-y-3">
            <h1 className="font-lettera text-4xl text-parchment">Bar di Notte</h1>
            <p className="mx-auto max-w-xs font-lettera text-sm leading-relaxed text-parchment-dim">
              Un bar che esiste solo quando fuori è buio. All&apos;alba, ogni
              parola brucia. Nessun nome, nessun archivio, nessun domani.
            </p>
          </div>
          <button
            onClick={knock}
            disabled={gate.state === "locating"}
            className="rounded-full border border-ember-dim bg-night-panel px-8 py-3 text-sm text-ember transition-colors hover:border-ember disabled:opacity-50"
          >
            {gate.state === "locating" ? "Il barista guarda fuori…" : "Bussa alla porta"}
          </button>
          <p className="max-w-xs text-[11px] leading-relaxed text-parchment-dim/70">
            Ti chiediamo la posizione solo per sapere se da te è notte. La
            arrotondiamo a ~11 km e non la salviamo mai da nessuna parte.
          </p>
        </main>
      );

    case "denied":
      return (
        <main className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
          <p className="font-lettera text-2xl text-parchment">
            Senza sapere se è notte, la porta resta chiusa.
          </p>
          <p className="max-w-xs text-sm text-parchment-dim">
            Il bar apre solo col buio: ci serve la tua posizione approssimativa
            (~11 km, mai salvata) per guardare il cielo sopra di te. Consenti la
            geolocalizzazione dal browser e bussa di nuovo.
          </p>
          <button
            onClick={knock}
            className="rounded-full border border-ember-dim px-6 py-2.5 text-sm text-ember"
          >
            Bussa di nuovo
          </button>
        </main>
      );

    case "unsupported":
      return (
        <main className="flex min-h-dvh items-center justify-center px-6 text-center">
          <p className="max-w-xs text-sm text-parchment-dim">
            Il tuo browser non sa dire dov&apos;è la notte: serve la
            geolocalizzazione per entrare.
          </p>
        </main>
      );

    case "day":
      return (
        <ClosedDoor
          sunsetAt={nextSunset(gate.lat, gate.lng)}
          onSunset={() => enterWith(gate.lat, gate.lng)}
        />
      );

    case "night":
      return (
        <Bar
          lat={gate.lat}
          lng={gate.lng}
          offsetMin={localUtcOffsetMin()}
          onDay={() => enterWith(gate.lat, gate.lng)}
        />
      );
  }
}
