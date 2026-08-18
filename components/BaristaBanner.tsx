"use client";

import { SUPPORT_LINE } from "@/lib/crisis";

/**
 * L'angolo del barista: un bigliettino gentile lasciato sul bancone,
 * visibile solo a chi ha scritto il messaggio. Non blocca, non giudica.
 */
export default function BaristaBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      role="status"
      className="fade-slow mx-3 mb-2 rounded-lg border border-ember-dim/50 bg-night-panel px-4 py-3 shadow-[0_0_20px_rgba(212,162,78,0.08)]"
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className="mt-0.5 text-lg">
          🕯️
        </span>
        <div className="flex-1 space-y-1">
          <p className="font-lettera text-sm leading-relaxed text-parchment">
            Ehi. Qualunque cosa tu stia attraversando stanotte, non devi
            attraversarla da solo.
          </p>
          <p className="text-xs text-parchment-dim">
            {SUPPORT_LINE.name}:{" "}
            <a
              href={`tel:${SUPPORT_LINE.phone.replace(/\s/g, "")}`}
              className="text-ember underline underline-offset-2"
            >
              {SUPPORT_LINE.phone}
            </a>{" "}
            ({SUPPORT_LINE.hours}). Il bancone resta qui per te.
          </p>
        </div>
        <button
          onClick={onDismiss}
          aria-label="Chiudi il bigliettino"
          className="-mr-1 -mt-1 p-2 text-parchment-dim transition-colors hover:text-parchment"
        >
          ×
        </button>
      </div>
    </div>
  );
}
