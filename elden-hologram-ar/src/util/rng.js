// Generatore pseudo-casuale con seed (mulberry32): rende i combattimenti
// riproducibili nei test e deterministici a parità di seed.
export class Rng {
  constructor(seed = Date.now() >>> 0) { this.seed = seed >>> 0; }
  next() {
    let t = (this.seed += 0x6d2b79f5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(min, max) { return min + (max - min) * this.next(); }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  chance(p) { return this.next() < p; }
}
