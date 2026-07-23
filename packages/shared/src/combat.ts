/**
 * Pure combat geometry shared by the authoritative server AND the client VFX (§10/§14). Extracting
 * these means the server's damage and the client's predicted VFX run the SAME math — they cannot
 * diverge (the project's "one shared function" law). No engine/network types.
 */

import {
  BEAM_AGGREGATE_TARGET_CAP,
  BEAM_CHANNEL_MOVE_MUL,
  BEAM_CHARGE_MOVE_MUL,
  BEAM_COOL_PER_SECOND,
  BEAM_HEAT_PER_SECOND,
  BEAM_IGNITION_HEAT,
  BEAM_MAX_CHANNEL_SECONDS,
  BEAM_MAX_RANGE,
  BEAM_MAX_SWEEP_SAMPLES,
  BEAM_MAX_TURN_RATE,
  BEAM_MAX_WIDTH,
  BEAM_MIN_CHARGE_SECONDS,
  BEAM_OVERHEAT_LOCK_SECONDS,
  BEAM_RESTART_HEAT,
  DRIVE_ENGAGED_BONUS_PER_SECOND,
  DRIVE_FLOOR_REGEN_PER_SECOND,
  TICK_RATE,
  SLIDE_IFRAME_TICKS,
  SLIDE_PHASE_AIR,
  SLIDE_PHASE_GROUND,
  STANCE_SLIDE,
  type MoveStance,
} from "./constants.js";
import type { Vec2 } from "./movement.js";
import type { WeaponDef } from "./weapons.js";
import { spreadForCharacter } from "./character-classes.js";
import { ATTRS, type Attr, type AttrValues } from "./leveling.js";

/** Contact-only opening immunity inherited from 21b. It is derived, never written into parry state. */
export function slideContactInvulnerable(
  stance: MoveStance,
  phase: number,
  slideTick: number,
): boolean {
  return (
    stance === STANCE_SLIDE &&
    (phase === SLIDE_PHASE_GROUND || phase === SLIDE_PHASE_AIR) &&
    slideTick > 0 &&
    slideTick <= SLIDE_IFRAME_TICKS
  );
}

export const BeamPhase = {
  Idle: 0,
  Charging: 1,
  Active: 2,
  Cooling: 3,
  Overheated: 4,
} as const;
export type BeamPhaseValue = (typeof BeamPhase)[keyof typeof BeamPhase];

/** Compact wire taxonomy for authoritative hit/kill ownership receipts. Values are append-only. */
export const CombatDelivery = {
  Melee: 1,
  Gun: 2,
  Cast: 3,
  Thrown: 4,
  Beam: 5,
  Quake: 6,
  Chain: 7,
  Parry: 8,
  Scatter: 9,
  Ultimate: 10,
  Zone: 11,
  Aura: 12,
  Warp: 13,
  HybridProjectile: 14,
} as const;
export type CombatDeliveryValue = (typeof CombatDelivery)[keyof typeof CombatDelivery];

export type WeaponDelivery = "melee" | "thrown" | "gun" | "cast" | "beam" | "zone";

/** Live delivery is behavioral; authored tag prose is not an affordability authority. */
export function weaponDeliveryFor(weapon: WeaponDef): WeaponDelivery {
  if (weapon.groundZone?.trigger === "channel") return "zone";
  if (weapon.beam) return "beam";
  if (weapon.thrown) return "thrown";
  if (weapon.gun) return "gun";
  if (weapon.cast) return "cast";
  return "melee";
}

/**
 * Neutral/live accepted solo interval under the fixed 20 Hz room clock. Accumulating gun cadence keeps
 * its sub-tick remainder; resetting melee, thrown, and cast cadence advances on the next legal tick.
 */
export function effectiveAcceptedWeaponInterval(
  weapon: WeaponDef,
  effectiveCooldown: number,
): number {
  const cooldown = Math.max(1 / TICK_RATE, Number.isFinite(effectiveCooldown) ? effectiveCooldown : 0);
  if (weapon.gun && !weapon.beam) return cooldown;
  const ticks = Math.max(1, Math.ceil(cooldown * TICK_RATE - 1e-9));
  return ticks / TICK_RATE;
}

export const DriveRegenMode = {
  Paused: 0,
  Floor: 1,
  Engaged: 2,
} as const;
export type DriveRegenModeValue = (typeof DriveRegenMode)[keyof typeof DriveRegenMode];

/** Pure anti-turtle reducer. Ultimate time is floor-only even when pressure is otherwise present. */
export function driveRegenModeFor(
  alive: boolean,
  simulationPaused: boolean,
  recoveryDebtLive: boolean,
  pressure: boolean,
  ultimateActive: boolean,
): DriveRegenModeValue {
  if (!alive || simulationPaused) return DriveRegenMode.Paused;
  if (recoveryDebtLive || !pressure || ultimateActive) return DriveRegenMode.Floor;
  return DriveRegenMode.Engaged;
}

export function driveRegenPerSecond(mode: DriveRegenModeValue, engagedMultiplier = 1): number {
  if (mode === DriveRegenMode.Paused) return 0;
  if (mode === DriveRegenMode.Floor) return DRIVE_FLOOR_REGEN_PER_SECOND;
  return (
    (DRIVE_FLOOR_REGEN_PER_SECOND + DRIVE_ENGAGED_BONUS_PER_SECOND) *
    Math.max(0, engagedMultiplier)
  );
}

export type DualWieldHand = 0 | 1;

/** Firing hand for an already-accepted paired gun/caster beat. The first seq after the bind epoch is lead;
 * uint32 subtraction keeps the answer deterministic through wrap. Hand identity is derived, never synced. */
export function dualHandForSeq(attackSeq: number, pairBaseSeq: number): DualWieldHand {
  const delta = ((attackSeq >>> 0) - (pairBaseSeq >>> 0)) >>> 0;
  return (((delta - 1) >>> 0) & 1) as DualWieldHand;
}

/** §ULT family ids follow ATTRS order: STR, DEX, INT, CON, LUK. */
export const UltimateFamily = {
  Locked: 0,
  Seismarch: 1,
  AlphaStrike: 2,
  SunspiteComet: 3,
  EventHorizon: 4,
  DimensionDoor: 5,
} as const;
export type UltimateFamilyValue = (typeof UltimateFamily)[keyof typeof UltimateFamily];

export const UltimatePhase = {
  Idle: 0,
  Windup: 1,
  Active: 2,
  Recovery: 3,
} as const;
export type UltimatePhaseValue = (typeof UltimatePhase)[keyof typeof UltimatePhase];

/** Stable 5×4 modifier grammar. Each row omits its own family attribute. */
export const ULTIMATE_VARIANTS = [
  ["dex", "int", "con", "luk"],
  ["str", "int", "con", "luk"],
  ["str", "dex", "con", "luk"],
  ["str", "dex", "int", "luk"],
  ["str", "dex", "int", "con"],
] as const satisfies readonly (readonly Attr[])[];

export function ultimateFamilyAttr(family: number): Attr {
  return ATTRS[Math.max(0, Math.min(ATTRS.length - 1, Math.floor(family) - 1))] ?? "str";
}

/** Pack one family+secondary cell into 1..20; 0 remains the locked wire value. */
export function ultimateCodeFor(family: number, variant: Attr): number {
  if (family < UltimateFamily.Seismarch || family > UltimateFamily.DimensionDoor) return 0;
  const row = ULTIMATE_VARIANTS[family - 1]!;
  const variantIndex = row.indexOf(variant as never);
  return variantIndex < 0 ? 0 : (family - 1) * 4 + variantIndex + 1;
}

export function ultimateFamilyForCode(code: number): UltimateFamilyValue {
  if (!Number.isInteger(code) || code < 1 || code > 20) return UltimateFamily.Locked;
  return (Math.floor((code - 1) / 4) + 1) as UltimateFamilyValue;
}

export function ultimateVariantForCode(code: number): Attr | "" {
  const family = ultimateFamilyForCode(code);
  if (family === UltimateFamily.Locked) return "";
  return ULTIMATE_VARIANTS[family - 1]![((code - 1) % 4)] ?? "";
}

function allocationRanksAhead(
  left: Attr,
  right: Attr,
  allocRun: Readonly<Record<Attr, number>>,
  base: AttrValues,
  raw: AttrValues,
): boolean {
  if (allocRun[left] !== allocRun[right]) return allocRun[left] > allocRun[right];
  if (base[left] !== base[right]) return base[left] > base[right];
  if (raw[left] !== raw[right]) return raw[left] > raw[right];
  return ATTRS.indexOf(left) < ATTRS.indexOf(right);
}

/** Amended deterministic law: allocRun, identity spread, raw total, then ATTRS order. */
export function ultimateRankingForAllocation(
  allocRun: Readonly<Record<Attr, number>>,
  runCharacter: string,
  raw: AttrValues,
): readonly [Attr, Attr] {
  const base = spreadForCharacter(runCharacter);
  let first: Attr = "str";
  let second: Attr = "dex";
  if (allocationRanksAhead(second, first, allocRun, base, raw)) [first, second] = [second, first];
  for (let i = 2; i < ATTRS.length; i++) {
    const attr = ATTRS[i]!;
    if (allocationRanksAhead(attr, first, allocRun, base, raw)) {
      second = first;
      first = attr;
    } else if (allocationRanksAhead(attr, second, allocRun, base, raw)) {
      second = attr;
    }
  }
  return [first, second] as const;
}

/** Best current modifier while excluding the family that is permanently locked. */
export function ultimateVariantForAllocation(
  allocRun: Readonly<Record<Attr, number>>,
  runCharacter: string,
  raw: AttrValues,
  familyAttr: Attr,
): Attr {
  const base = spreadForCharacter(runCharacter);
  let best: Attr | undefined;
  for (const attr of ATTRS) {
    if (attr === familyAttr) continue;
    if (!best || allocationRanksAhead(attr, best, allocRun, base, raw)) best = attr;
  }
  return best ?? (familyAttr === "str" ? "dex" : "str");
}

/** Gear-era lock law: permanent starting state never participates in family/variant ranking. */
export function ultimateRankingForRunAllocation(
  allocRun: Readonly<Record<Attr, number>>,
): readonly [Attr, Attr] {
  const ranked = [...ATTRS].sort((left, right) =>
    allocRun[right] - allocRun[left] || ATTRS.indexOf(left) - ATTRS.indexOf(right));
  return [ranked[0] ?? "str", ranked[1] ?? "dex"] as const;
}

export function ultimateVariantForRunAllocation(
  allocRun: Readonly<Record<Attr, number>>,
  familyAttr: Attr,
): Attr {
  let best: Attr | undefined;
  for (const attr of ATTRS) {
    if (attr === familyAttr) continue;
    if (!best || allocRun[attr] > allocRun[best]) best = attr;
  }
  return best ?? (familyAttr === "str" ? "dex" : "str");
}

/** Ultimate damage deliberately reads attrs+crit only: no weapon/augment/set multiplicative tower. */
export function ultimateDamageScale(raw: AttrValues, primary: Attr, secondary: Attr): number {
  return 1 + 0.1 * Math.max(0, raw[primary] - 1) + 0.045 * Math.max(0, raw[secondary] - 1);
}

/** Immutable accepted beam epoch. Damage and timing are snapshotted at channel acceptance. */
export interface BeamDescriptor {
  readonly weaponId: string;
  readonly startTick: number;
  readonly startSeq: number;
  readonly chargeSeconds: number;
  readonly damagePerSecond: number;
  readonly tickRate: number;
  readonly width: number;
  readonly range: number;
  /** Positive only for the reusable cone-stream specialization; zero keeps ordinary ray geometry. */
  readonly coneHalfAngle: number;
  readonly sweepLagSeconds: number;
  readonly maxTurnRate: number;
  readonly maxChannelSeconds: number;
  readonly heatPerSecond: number;
  readonly coolPerSecond: number;
  readonly ignitionHeat: number;
  readonly lockSeconds: number;
  readonly restartHeat: number;
  readonly chargeMoveMul: number;
  readonly channelMoveMul: number;
}

/** Construct the immutable server/prediction clock and enforce the hard beam laws at runtime. */
export function beamDescriptorFor(
  weapon: WeaponDef,
  startTick: number,
  startSeq: number,
  damageMultiplier = 1,
  chargeMultiplier = 1,
  sweepControlMultiplier = 1,
): BeamDescriptor {
  const beam = weapon.beam;
  if (!beam) throw new Error(`Weapon ${weapon.id} has no beam delivery`);
  return Object.freeze({
    weaponId: weapon.id,
    startTick: startTick >>> 0,
    startSeq: startSeq >>> 0,
    chargeSeconds: Math.max(BEAM_MIN_CHARGE_SECONDS, beam.chargeSeconds * chargeMultiplier),
    damagePerSecond: Math.max(0, beam.damagePerSecond * damageMultiplier),
    tickRate: Math.min(0.25, Math.max(0.05, Math.round(beam.tickRate / 0.05) * 0.05)),
    width: Math.min(BEAM_MAX_WIDTH, Math.max(1, beam.width)),
    range: Math.min(BEAM_MAX_RANGE, Math.max(1, beam.range)),
    coneHalfAngle: beam.coneStream
      ? Math.min(0.9, Math.max(0.08, beam.coneStream.halfAngle))
      : 0,
    sweepLagSeconds: Math.max(0.001, beam.sweepLagSeconds / Math.max(1, sweepControlMultiplier)),
    maxTurnRate: BEAM_MAX_TURN_RATE,
    maxChannelSeconds: Math.min(BEAM_MAX_CHANNEL_SECONDS, beam.overheat.maxChannelSeconds),
    heatPerSecond: Math.max(BEAM_HEAT_PER_SECOND, beam.overheat.heatPerSecond),
    coolPerSecond: Math.min(BEAM_COOL_PER_SECOND, Math.max(0, beam.overheat.coolPerSecond)),
    ignitionHeat: Math.max(BEAM_IGNITION_HEAT, beam.overheat.ignitionHeat),
    lockSeconds: Math.max(BEAM_OVERHEAT_LOCK_SECONDS, beam.overheat.lockSeconds),
    restartHeat: Math.min(BEAM_RESTART_HEAT, Math.max(0, beam.overheat.restartHeat)),
    chargeMoveMul: Math.min(BEAM_CHARGE_MOVE_MUL, Math.max(0, beam.movement.chargeMul)),
    channelMoveMul: Math.min(BEAM_CHANNEL_MOVE_MUL, Math.max(0, beam.movement.channelMul)),
  });
}

/** Wrapped target-current delta in [-pi, pi]. */
export function shortestAngleDelta(current: number, target: number): number {
  let delta = (target - current + Math.PI) % (Math.PI * 2);
  if (delta < 0) delta += Math.PI * 2;
  return delta - Math.PI;
}

/** Deterministic first-order beam steering plus an absolute server turn budget. */
export function stepBeamAngle(
  current: number,
  target: number,
  sweepLagSeconds: number,
  dt: number,
  maxTurnRate = BEAM_MAX_TURN_RATE,
): number {
  const desired = shortestAngleDelta(current, target);
  const alpha = 1 - Math.exp(-Math.max(0, dt) / Math.max(0.001, sweepLagSeconds));
  const proposed = desired * alpha;
  const budget = Math.max(0, maxTurnRate) * Math.max(0, dt);
  return current + Math.max(-budget, Math.min(budget, proposed));
}

/** Number of interpolated capsules needed to cover origin and angular travel without 20Hz holes. */
export function beamSweepSampleCount(
  originTravel: number,
  angularDelta: number,
  range: number,
  halfWidth: number,
): number {
  const spacing = Math.max(1, halfWidth);
  const travel = Math.max(0, originTravel) + Math.max(0, range) * Math.abs(angularDelta);
  return Math.max(1, Math.min(BEAM_MAX_SWEEP_SAMPLES, Math.ceil(travel / spacing)));
}

/** Per-target raw damage for one fixed contact step. More than three contacts share the 3x budget. */
export function beamStepDamage(damagePerSecond: number, dt: number, targetCount: number): number {
  if (targetCount <= 0 || damagePerSecond <= 0 || dt <= 0) return 0;
  return damagePerSecond * dt * Math.min(1, BEAM_AGGREGATE_TARGET_CAP / targetCount);
}

/** Circle-vs-sector test used by the authoritative cone stream and append-only geometry gates. */
export function coneStreamHitsCircle(
  origin: Vec2,
  angle: number,
  range: number,
  halfAngle: number,
  target: Vec2,
  targetRadius: number,
): boolean {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const distance = Math.hypot(dx, dy);
  const radius = Math.max(0, targetRadius);
  if (distance > Math.max(0, range) + radius) return false;
  if (distance <= radius) return true;
  const forward = dx * Math.cos(angle) + dy * Math.sin(angle);
  if (forward < -radius) return false;
  const angularRadius = Math.asin(Math.min(1, radius / distance));
  return (
    Math.abs(shortestAngleDelta(angle, Math.atan2(dy, dx))) <=
    Math.max(0, halfAngle) + angularRadius
  );
}

/** A chain / nearest-target candidate: a position with a stable id (enemy id). */
export interface ChainCandidate {
  id: string;
  x: number;
  y: number;
}

/**
 * Greedy CHAIN-LIGHTNING target selection. Starting from `seed`, repeatedly pick the NEAREST candidate
 * that is (a) not already used and (b) within `hopRange` of the previous link — up to `jumps` times.
 * `exclude` seeds the used-set (e.g. the enemies the swing arc already hit, so the chain leaps to
 * OTHERS). Returns the picked candidates in link order; stops early when no candidate is in range.
 * PURE — the server applies damage to the result, the client draws bolts to it, off the same selection.
 */
export function selectChainTargets(
  seed: Vec2,
  candidates: readonly ChainCandidate[],
  jumps: number,
  hopRange: number,
  exclude?: ReadonlySet<string>,
): ChainCandidate[] {
  const used = new Set<string>(exclude ?? []);
  const hopR2 = hopRange * hopRange;
  const picked: ChainCandidate[] = [];
  let fromX = seed.x;
  let fromY = seed.y;
  for (let n = 0; n < jumps; n++) {
    let best: ChainCandidate | undefined;
    let bestD = Number.POSITIVE_INFINITY;
    for (const c of candidates) {
      if (used.has(c.id)) continue;
      const d = (c.x - fromX) ** 2 + (c.y - fromY) ** 2;
      if (d <= hopR2 && d < bestD) {
        bestD = d;
        best = c;
      }
    }
    if (!best) break; // no unused candidate in range → chain ends
    used.add(best.id);
    picked.push(best);
    fromX = best.x;
    fromY = best.y;
  }
  return picked;
}

/**
 * Clamp a slam/quake EPICENTER (the cursor target) to within `reach` px of the player — "you slam
 * where you aim, within reach" (§9). PURE — server + client compute the IDENTICAL epicenter so the
 * damage AoE and the VFX line up (§14).
 */
export function clampQuakeEpicenter(player: Vec2, target: Vec2, reach: number): Vec2 {
  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const dist = Math.hypot(dx, dy);
  if (dist > reach) {
    return { x: player.x + (dx / dist) * reach, y: player.y + (dy / dist) * reach };
  }
  return { x: target.x, y: target.y };
}
