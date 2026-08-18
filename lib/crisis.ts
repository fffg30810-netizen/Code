/**
 * L'angolo del barista: se un messaggio suona come una notte davvero difficile,
 * lasciamo un bigliettino sul bancone — solo per chi l'ha scritto.
 * Nessun blocco, nessun giudizio.
 */
const CRISIS_PATTERNS: string[] = [
  "suicid",
  "farla finita",
  "farmi fuori",
  "ammazzarmi",
  "uccidermi",
  "voglio morire",
  "vorrei morire",
  "voglio sparire",
  "non voglio più vivere",
  "non ce la faccio più",
  "autolesion",
  "tagliarmi",
  "farmi del male",
  "kill myself",
  "self harm",
  "end it all",
];

export function detectCrisis(text: string): boolean {
  const t = text.toLowerCase();
  return CRISIS_PATTERNS.some((p) => t.includes(p));
}

export const SUPPORT_LINE = {
  name: "Telefono Amico",
  phone: "02 2327 2327",
  hours: "tutti i giorni, 10–24",
};
