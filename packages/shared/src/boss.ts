/**
 * §16 OLD RUST — the multi-phase boss fight. PURE + deterministic (the server runs it; tests pin it). The
 * phase escalates by HP fraction, and each phase layers a new pattern on:
 *   P1 (>50%): minigun BULLET-WALLS with a weave-gap (parryable slugs).
 *   P2 (≤50%): + telegraphed RED PUNCH-SLAM shockwaves (unparryable) between sweeps.
 *   P3 (≤20%): ENRAGE — faster walls + spawns Mote adds (a DPS check).
 */

export type BossPhaseTier = 1 | 2 | 3;

/** Stable synchronized anatomy identities. Slots never change role during one Serraketh encounter. */
export enum WormSegmentRole {
  Head = 0,
  Neck = 1,
  Body = 2,
  Spinner = 3,
  Tail = 4,
}

export enum WormSegmentCondition {
  Intact = 0,
  Wounded = 1,
  BreakReady = 2,
  ArmorOpen = 3,
  Regrown = 4,
  Destroyed = 5,
}

export enum WormArmorBand {
  None = 0,
  Plated = 1,
  Cracked = 2,
  Exposed = 3,
}

export enum WormSegmentMode {
  Dormant = 0,
  Surface = 1,
  Reconnecting = 2,
  Submerging = 3,
  Underground = 4,
  Emerging = 5,
  ArmGrace = 6,
  Bud = 7,
  Destroyed = 8,
}

export enum WormChain {
  None = 0,
  Main = 1,
  Stub = 2,
}

export enum WormBossMode {
  Inactive = 0,
  Surface = 1,
  DiveWindup = 2,
  Submerging = 3,
  Underground = 4,
  EruptionClaim = 5,
  Emerging = 6,
  SurfaceArmGrace = 7,
  Split = 8,
  Regrow = 9,
  Dead = 10,
}

export enum WormActionKind {
  None = 0,
  SeamDive = 1,
  Eruption = 2,
  RibQuake = 3,
  StitchReap = 4,
  ShearBloom = 5,
  ClosingLoop = 6,
  Split = 7,
  GraftHunger = 8,
  Finale = 9,
}

export interface WormAnatomyDef {
  role: WormSegmentRole;
  radius: number;
  localHpFraction: number;
  armorHpFraction: number;
  platedCoreMultiplier: number;
  exposedCoreMultiplier: number;
}

export interface WormEncounterDef {
  baseCoreHp: number;
  rootKind: string;
  anatomy: Readonly<Record<WormSegmentRole, WormAnatomyDef>>;
}

/** The §16 phase for a boss at `frac` of max HP. Thresholds: ≤0.2 enrage, ≤0.5 slam, else paces. (Legacy —
 *  the data-driven `BossDef` in bosses.ts generalises this; kept for the OLD RUST phase unit tests.) */
export function bossPhaseForHp(frac: number): BossPhaseTier {
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
