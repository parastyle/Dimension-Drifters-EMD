/**
 * Deterministic PRNG (mulberry32) — shared by server + client so a given seed reproduces the EXACT
 * same sequence on every machine. This is the backbone of server-seeded procedural generation
 * (§17/§4): the server picks seeds once, syncs them on `ArenaState`, and every client regenerates the
 * identical map locally instead of streaming tiles. Same algorithm both sides → byte-identical maps.
 *
 * Promoted from the inline scatter RNG that used to live in the client scene (it was already mulberry32).
 */

export type Rng = {
  /** Next float in [0, 1). */
  next(): number;
  /** Float in [min, max). */
  range(min: number, max: number): number;
  /** Integer in [min, max] INCLUSIVE. */
  int(min: number, max: number): number;
  /** true with probability p (0..1). */
  chance(p: number): boolean;
  /** A uniformly-random element of a non-empty array. */
  pick<T>(arr: readonly T[]): T;
};

/** Make a seeded generator. Same `seed` → same stream, on any machine, forever. */
export function makeRng(seed: number): Rng {
  let s = seed | 0;
  const next = (): number => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const range = (min: number, max: number): number => min + next() * (max - min);
  const int = (min: number, max: number): number => Math.floor(range(min, max + 1));
  const chance = (p: number): boolean => next() < p;
  const pick = <T>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length)] as T;
  return { next, range, int, chance, pick };
}

/**
 * Collapse several integer seeds into ONE 32-bit seed (xmur3-style mix) so the small set of seed
 * scalars synced on `ArenaState` can drive a single deterministic stream — and so independent passes
 * (terrain vs hazards) can each be seeded from a distinct mix without correlating.
 */
export function mixSeeds(...nums: number[]): number {
  let h = 0x9e3779b1 | 0;
  for (const n of nums) {
    h = Math.imul(h ^ (n | 0), 0x85ebca6b);
    h = (h ^ (h >>> 13)) | 0;
  }
  h = Math.imul(h ^ (h >>> 16), 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 13), 0x27d4eb2f);
  return (h ^ (h >>> 16)) >>> 0;
}

/** A fresh nonzero 32-bit seed scalar (server picks these at room create, then syncs them). Kept here
 *  so seed minting lives next to the generator. `Math.random` is fine server-side — the RESULT is what
 *  gets synced + reproduced, not the source of entropy. */
export function randomSeed(): number {
  return (Math.random() * 0x100000000) >>> 0 || 1;
}
