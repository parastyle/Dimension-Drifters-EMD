/**
 * Tiny numeric helpers shared by the sim. Kept in `shared` so server + client clamp identically —
 * a divergent clamp would desync predicted vs. authoritative state.
 */

/** Constrain `value` to the inclusive `[min, max]` range. */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Constrain `value` to `[0, 1]` (the common normalized-parameter case). */
export function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}
