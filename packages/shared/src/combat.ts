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
} from "./constants.js";
import type { Vec2 } from "./movement.js";
import type { WeaponDef } from "./weapons.js";

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
} as const;
export type CombatDeliveryValue = (typeof CombatDelivery)[keyof typeof CombatDelivery];

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
