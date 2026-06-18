/**
 * §16 OLD RUST — the multi-phase boss fight. PURE + deterministic (the server runs it; tests pin it). The
 * phase escalates by HP fraction, and each phase layers a new pattern on:
 *   P1 (>50%): minigun BULLET-WALLS with a weave-gap (parryable slugs).
 *   P2 (≤50%): + telegraphed RED PUNCH-SLAM shockwaves (unparryable) between sweeps.
 *   P3 (≤20%): ENRAGE — faster walls + spawns Mote adds (a DPS check).
 */

export type BossPhase = 1 | 2 | 3;

/** The §16 phase for a boss at `frac` of max HP. Thresholds: ≤0.2 enrage, ≤0.5 slam, else paces. */
export function bossPhaseForHp(frac: number): BossPhase {
  if (frac <= 0.2) return 3;
  if (frac <= 0.5) return 2;
  return 1;
}

/** §16 P1 bullet-wall: a fan of `count` angles across `arc` (TOTAL) centred on `base`, with a 2-wide
 *  WEAVE-GAP at `gapIdx` (the slot, and its neighbour, omitted) — the gap the squad threads. Returns the
 *  angles that actually FIRE. Pure (the client could re-derive the same wall). `count` ≥ 4. */
export function bulletWallAngles(
  base: number,
  count: number,
  arc: number,
  gapIdx: number,
): number[] {
  const out: number[] = [];
  const n = Math.max(4, Math.floor(count));
  const g = ((gapIdx % (n - 1)) + (n - 1)) % (n - 1); // keep the gap (and its +1 neighbour) in range
  for (let i = 0; i < n; i++) {
    if (i === g || i === g + 1) continue; // the 2-wide weave-gap
    out.push(base - arc / 2 + (arc * i) / (n - 1));
  }
  return out;
}
