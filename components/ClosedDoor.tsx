"use client";

import { useEffect, useState } from "react";
import { formatCountdown } from "@/lib/format";

interface Props {
  /** Prossimo tramonto locale; null alle latitudini estreme senza tramonto. */
  sunsetAt: Date | null;
  /** Chiamato quando il countdown arriva a zero: è ora di riprovare a entrare. */
  onSunset: () => void;
}

export default function ClosedDoor({ sunsetAt, onSunset }: Props) {
  const [left, setLeft] = useState<number | null>(
    sunsetAt ? sunsetAt.getTime() - Date.now() : null
  );

  useEffect(() => {
    if (!sunsetAt) return;
    const tick = () => {
      const ms = sunsetAt.getTime() - Date.now();
      setLeft(ms);
      if (ms <= 0) onSunset();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [sunsetAt, onSunset]);

  return (
    <main className="fade-slow flex min-h-dvh flex-col items-center justify-center gap-8 px-6 text-center">
      {/* La porta */}
      <div aria-hidden className="relative">
        <div className="h-44 w-28 rounded-t-[3.2rem] border-2 border-night-line bg-night-soft shadow-[inset_0_0_30px_rgba(0,0,0,0.8)]">
          <div className="absolute left-4 top-1/2 h-2 w-2 rounded-full bg-ember-dim" />
          <div className="absolute inset-x-3 top-6 h-10 rounded-t-[2rem] border border-night-line" />
        </div>
        {/* Luce calda che filtra da sotto la porta */}
        <div className="door-light absolute -bottom-1 left-1/2 h-2 w-24 -translate-x-1/2 rounded-full bg-ember blur-md" />
      </div>

      <div className="space-y-3">
        <h1 className="font-lettera text-3xl text-parchment">Il bar apre al tramonto</h1>
        <p className="text-sm text-parchment-dim">
          Qui dentro si entra solo quando fuori è buio.
        </p>
      </div>

      {left !== null ? (
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-widest text-parchment-dim">
            Si apre tra
          </p>
          <p className="font-lettera text-4xl tabular-nums text-ember">
            {formatCountdown(left)}
          </p>
          <p className="text-xs text-parchment-dim">
            tramonto locale:{" "}
            {sunsetAt?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      ) : (
        <p className="max-w-xs text-sm text-parchment-dim">
          Dalle tue parti, in questo periodo, il sole non tramonta. Il bar ti
          aspetta quando tornerà il buio.
        </p>
      )}
    </main>
  );
}
