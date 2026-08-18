// Stessi conti del client (lib/sun.ts), rifatti qui: l'anti-cheat.
// Le coordinate arrivano già arrotondate, vengono ri-arrotondate per
// sicurezza e non lasciano mai la memoria di questa funzione.
import * as SunCalc from "npm:suncalc@2.0.1";

export const roundCoord = (v: number) => Math.round(v * 10) / 10;

export function isNight(lat: number, lng: number, at: Date = new Date()): boolean {
  return SunCalc.getPosition(at, lat, lng).altitude < 0;
}

function isValidDate(d: Date | null | undefined): d is Date {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

/** Prossima alba (fino a 4 giorni avanti, per le latitudini estreme). */
export function nextSunrise(lat: number, lng: number, after: Date = new Date()): Date | null {
  for (let i = 0; i < 4; i++) {
    const day = new Date(after.getTime() + i * 86_400_000);
    const t = SunCalc.getTimes(day, lat, lng).sunrise;
    if (isValidDate(t) && t.getTime() > after.getTime()) return t;
  }
  return null;
}

export function validCoords(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng as number) <= 180
  );
}
