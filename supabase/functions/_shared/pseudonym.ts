// Ogni notte sei qualcun altro: pseudonimi poetici notturni,
// generati al tramonto, dimenticati all'alba.

type Gender = "m" | "f";

const CREATURES: Array<[string, Gender]> = [
  ["Gufo", "m"],
  ["Volpe", "f"],
  ["Falena", "f"],
  ["Corvo", "m"],
  ["Lucciola", "f"],
  ["Civetta", "f"],
  ["Riccio", "m"],
  ["Airone", "m"],
  ["Gatta", "f"],
  ["Lupo", "m"],
  ["Tasso", "m"],
  ["Barbagianni", "m"],
  ["Salamandra", "f"],
  ["Faina", "f"],
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
  ["Candela", "f"],
  ["Luna", "f"],
  ["Stella", "f"],
  ["Bicchiere", "m"],
  ["Tram", "m"],
  ["Lampione", "m"],
  ["Caffè", "m"],
  ["Turno", "m"],
  ["Brindisi", "m"],
  ["Sbadiglio", "m"],
  ["Insegna", "f"],
];

const WANDERERS = [
  "Chi Non Dorme",
  "Voce nel Buio",
  "Ombra al Bancone",
  "Anima in Piedi",
  "Cliente di Passaggio",
  "Pensiero delle Tre",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generatePseudonym(): string {
  const roll = Math.random();
  if (roll < 0.4) {
    // "Gufo Insonne"
    const [noun, gender] = pick(CREATURES);
    return `${noun} ${pick(ADJECTIVES)[gender]}`;
  }
  if (roll < 0.7) {
    // "Terza Candela"
    const [noun, gender] = pick(OBJECTS);
    return `${pick(ORDINALS[gender])} ${noun}`;
  }
  // "Chi Non Dorme #12"
  return `${pick(WANDERERS)} #${1 + Math.floor(Math.random() * 99)}`;
}
