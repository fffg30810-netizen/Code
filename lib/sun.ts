import * as SunCalc from "suncalc";

/** Arrotonda una coordinata a 1 decimale (~11 km): abbastanza per il sole, troppo poco per trovarti. */
export const roundCoord = (v: number) => Math.round(v * 10) / 10;

/** È notte quando il sole è sotto l'orizzonte. */
export function isNight(lat: number, lng: number, at: Date = new Date()): boolean {
  return SunCalc.getPosition(at, lat, lng).altitude < 0;
}

function isValidDate(d: Date | null | undefined): d is Date {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

function nextEvent(
  kind: "sunrise" | "sunset",
  lat: number,
  lng: number,
  after: Date
): Date | null {
  // Cerca fino a 4 giorni avanti: copre l'evento di oggi già passato
  // e i giorni senza alba/tramonto alle latitudini estreme.
  for (let i = 0; i < 4; i++) {
    const day = new Date(after.getTime() + i * 86_400_000);
    const t = SunCalc.getTimes(day, lat, lng)[kind];
    if (isValidDate(t) && t.getTime() > after.getTime()) return t;
  }
  return null;
}

/** Prossima alba: il momento in cui il bar chiude e tutto brucia. */
export function nextSunrise(lat: number, lng: number, after: Date = new Date()): Date | null {
  return nextEvent("sunrise", lat, lng, after);
}

/** Prossimo tramonto: il momento in cui il bar apre. */
export function nextSunset(lat: number, lng: number, after: Date = new Date()): Date | null {
  return nextEvent("sunset", lat, lng, after);
}

/** Offset UTC locale in minuti (es. Italia d'estate: +120). Identifica il bancone. */
export function localUtcOffsetMin(): number {
  return -new Date().getTimezoneOffset();
}
