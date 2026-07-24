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

/** Reusable authored action row for a segmented boss. Geometry comes from an existing pure primitive;
 * the dedicated director supplies a stable anatomy emitter and owns exclusivity/cancellation. */
export interface SegmentedBossActionModuleDef {
  kind: WormActionKind;
  primitive: string;
  emitterRole: WormSegmentRole;
  windupTicks: number;
  recoveryTicks: number;
  params: Readonly<Record<string, number>>;
}

/** One HP lane in the segmented action scheduler. Sequences rotate deterministically; `paired` requests a
 * second action after recovery, never an overlapping warning or damage window. */
export interface SegmentedBossActionPhaseDef {
  hpAbove: number;
  cadenceTicks: number;
  sequence: readonly WormActionKind[];
  paired?: boolean;
  pairGapTicks?: number;
}

export interface WormEncounterDef {
  baseCoreHp: number;
  rootKind: string;
  anatomy: Readonly<Record<WormSegmentRole, WormAnatomyDef>>;
  actions?: readonly SegmentedBossActionModuleDef[];
  actionPhases?: readonly SegmentedBossActionPhaseDef[];
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

/** Flagship World-Tread presentation/authority modes. These are stable wire values. */
export enum VastagharMode {
  Inactive = 0,
  Entrance = 1,
  Combat = 2,
  Punish = 3,
  Transition = 4,
  StrideBreak = 5,
  Desperation = 6,
  Victory = 7,
}

/** Authored health lanes. Phase changes alter the required verb, never attack speed or base damage. */
export enum VastagharPhase {
  None = 0,
  LearnWeight = 1,
  BreakStride = 2,
  UnderHeel = 3,
  FinalTread = 4,
  Defeated = 5,
}

/** One semantic owner for every body pose, telegraph group, and client spectacle beat. */
export enum VastagharActionKind {
  None = 0,
  Crownstep = 1,
  HeelReap = 2,
  ShedMountain = 3,
  ThreefoldMarch = 4,
  LandmarkBreak = 5,
  TwinTread = 6,
  Worldwheel = 7,
  FinalTread = 8,
  PhaseStuckStep = 9,
  PhaseWorldTurn = 10,
  StrideBreak = 11,
  Death = 12,
}

export enum VastagharFoot {
  OuterLeft = 0,
  OuterRight = 1,
  InnerLeft = 2,
  InnerRight = 3,
  Body = 4,
}

export enum VastagharActionResult {
  Pending = 0,
  Resolved = 1,
  Countered = 2,
  Cancelled = 3,
}

export enum VastagharArenaMutationKind {
  None = 0,
  StuckStep = 1,
  LandmarkBreak = 2,
  WorldTurn = 3,
}

export enum VastagharVictoryStage {
  None = 0,
  ThreatEnded = 1,
  Collapse = 2,
  MoneyCrown = 3,
  ReceiptHeld = 4,
  RewardsOpen = 5,
}

export interface VastagharActionDef {
  kind: VastagharActionKind;
  windupTicks: number;
  activeTicks: number;
  recoveryTicks: number;
  stepOffsets: readonly number[];
  stepFeet: readonly VastagharFoot[];
  stepRadii: readonly number[];
  stepDamage: readonly number[];
  stepKnockback: readonly number[];
  innerRange: number;
  outerRange: number;
  halfWidth: number;
  sweepRadians: number;
  maxTargets: number;
}

/** Narrow data contract for the flagship timeline. All gameplay clocks are integer 20 Hz ticks. */
export interface VastagharEncounterDef {
  thresholds: readonly [number, number, number];
  entranceDelayTicks: number;
  transitionTicks: number;
  transitionClaimDelayTicks: number;
  strideBreakPips: number;
  strideBreakTicks: number;
  strideBreakDamageMultiplier: number;
  responseWindowTicks: number;
  addCap: number;
  addLifetimeTicks: number;
  maxDestroyedPois: number;
  bossMoney: number;
  actions: Readonly<Partial<Record<VastagharActionKind, VastagharActionDef>>>;
  phaseOneDeck: readonly VastagharActionKind[];
  phaseTwoDeck: readonly VastagharActionKind[];
  phaseThreeDeck: readonly VastagharActionKind[];
  desperationDeck: readonly VastagharActionKind[];
  neutralTicks: Readonly<Partial<Record<VastagharActionKind, number>>>;
}
