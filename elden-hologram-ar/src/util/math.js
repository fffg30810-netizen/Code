export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
// Interpola un angolo (radianti) lungo il percorso più corto.
export function dampAngle(a, b, lambda, dt) {
  let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a + d * (1 - Math.exp(-lambda * dt));
}
// Slider logaritmico 0..1000 -> metri (0.05 m .. 10 m)
const MIN_H = 0.05, MAX_H = 10;
export const sliderToMeters = (v) => MIN_H * Math.pow(MAX_H / MIN_H, clamp(v, 0, 1000) / 1000);
export const metersToSlider = (m) => Math.round(1000 * Math.log(clamp(m, MIN_H, MAX_H) / MIN_H) / Math.log(MAX_H / MIN_H));
export function formatMeters(m) {
  if (m < 1) return `${Math.round(m * 100)} cm`;
  return `${m.toFixed(m < 10 ? 2 : 1).replace(/\.?0+$/, '')} m`;
}
