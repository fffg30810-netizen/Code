// Regole della casa, versione del barista (server-side, autoritativa).
// Tenere sincronizzata con lib/blocklist.ts.
const SLURS: string[] = [
  "negro",
  "negri",
  "negra",
  "negre",
  "frocio",
  "froci",
  "ricchione",
  "ricchioni",
  "mongoloide",
  "ritardato",
  "ritardata",
  "zingraccio",
  "sporco ebreo",
  "nigger",
  "niggers",
  "faggot",
  "faggots",
  "kike",
  "spic",
  "retard",
  "tranny",
];

const pattern = new RegExp(
  `(?:^|[^\\p{L}])(?:${SLURS.map((s) => s.replace(/ /g, "\\s+")).join("|")})(?:[^\\p{L}]|$)`,
  "iu"
);

export function containsBlocked(text: string): boolean {
  return pattern.test(text.normalize("NFKC"));
}
