import { TICK_MS } from "./constants.js";
import type { WeaponDef } from "./weapons.js";

export const ParryReaction = {
  None: 0,
  FromBelow: 1,
  FromLeft: 2,
  FromRight: 3,
  FromAbove: 4,
} as const;

export type ParryReactionValue = (typeof ParryReaction)[keyof typeof ParryReaction];
export type ParryGuardPose = 0 | 1 | 2;

/** Damage-to-travel tuning: weak catches still read, ordinary hits separate, boss hits stay on-camera. */
export const PARRY_SLIDE_PX_PER_DAMAGE = 4;
export const PARRY_SLIDE_MIN_PX = 24;
export const PARRY_SLIDE_MAX_PX = 120;
export const PARRY_GUARD_RESET_SECONDS = 3;
export const PARRY_GUARD_RESET_TICKS = Math.ceil((PARRY_GUARD_RESET_SECONDS * 1000) / TICK_MS);
export const PARRY_ABOVE_BRACE_SECONDS = 0.34;

const REACTION_MASK = 0b111;
const GUARD_SHIFT = 3;
const DIRECTION_EPSILON = 1e-6;

/**
 * Classify an incoming travel vector in screen/world coordinates (+x right, +y down). Diagonal ties are
 * horizontal so the four quadrants have deterministic, gap-free boundaries. A degenerate vector takes the
 * safe no-displacement brace response.
 */
export function classifyParryIncidence(incomingX: number, incomingY: number): ParryReactionValue {
  const x = Number.isFinite(incomingX) ? incomingX : 0;
  const y = Number.isFinite(incomingY) ? incomingY : 0;
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  if (ax <= DIRECTION_EPSILON && ay <= DIRECTION_EPSILON) return ParryReaction.FromAbove;
  if (ax >= ay) return x >= 0 ? ParryReaction.FromLeft : ParryReaction.FromRight;
  return y < 0 ? ParryReaction.FromBelow : ParryReaction.FromAbove;
}

export function parrySlideDistance(preventedDamage: number): number {
  const damage = Number.isFinite(preventedDamage) ? Math.max(0, preventedDamage) : 0;
  return Math.max(
    PARRY_SLIDE_MIN_PX,
    Math.min(PARRY_SLIDE_MAX_PX, damage * PARRY_SLIDE_PX_PER_DAMAGE),
  );
}

export interface NavClampedParrySlide {
  x: number;
  y: number;
  traveled: number;
  requested: number;
  clamped: boolean;
}

/**
 * Walk a side-parry segment in small deterministic samples and stop at the last valid point. The caller
 * owns world-specific navigation truth (arena bounds + POIs + pits, or an equivalent test predicate).
 */
export function clampParrySlideToNavigation(
  startX: number,
  startY: number,
  incomingX: number,
  incomingY: number,
  requestedDistance: number,
  isNavigable: (x: number, y: number) => boolean,
  sampleStepPx = 2,
): NavClampedParrySlide {
  const length = Math.hypot(incomingX, incomingY);
  const requested = Number.isFinite(requestedDistance) ? Math.max(0, requestedDistance) : 0;
  if (length <= DIRECTION_EPSILON || requested <= DIRECTION_EPSILON) {
    return { x: startX, y: startY, traveled: 0, requested, clamped: requested > 0 };
  }
  const unitX = incomingX / length;
  const unitY = incomingY / length;
  const samples = Math.max(1, Math.ceil(requested / Math.max(0.25, sampleStepPx)));
  let x = startX;
  let y = startY;
  let traveled = 0;
  for (let sample = 1; sample <= samples; sample++) {
    const distance = requested * (sample / samples);
    const nextX = startX + unitX * distance;
    const nextY = startY + unitY * distance;
    if (!isNavigable(nextX, nextY)) break;
    x = nextX;
    y = nextY;
    traveled = distance;
  }
  return {
    x,
    y,
    traveled,
    requested,
    clamped: traveled + DIRECTION_EPSILON < requested,
  };
}

export interface ParryGuardCycleState {
  readonly nextPose: ParryGuardPose;
  readonly lastSuccessTick: number;
}

export interface ParryGuardCycleResult {
  readonly pose: ParryGuardPose;
  readonly state: ParryGuardCycleState;
  readonly reset: boolean;
}

/** Select this success's pose, then retain the next pose. Only successful parries call this function. */
export function advanceParryGuardCycle(
  previous: ParryGuardCycleState | undefined,
  successTick: number,
  resetTicks = PARRY_GUARD_RESET_TICKS,
): ParryGuardCycleResult {
  const tick = Number.isFinite(successTick) ? Math.max(0, Math.floor(successTick)) : 0;
  const reset =
    !previous ||
    tick < previous.lastSuccessTick ||
    tick - previous.lastSuccessTick > Math.max(0, resetTicks);
  const pose: ParryGuardPose = reset ? 0 : previous.nextPose;
  return {
    pose,
    state: {
      nextPose: ((pose + 1) % 3) as ParryGuardPose,
      lastSuccessTick: tick,
    },
    reset,
  };
}

/** Family is the natural subtype; classPool keeps reused family labels in separate handling vocabularies. */
export function parryGuardSubtypeKey(
  weapon: Pick<WeaponDef, "tags">,
): `${WeaponDef["tags"]["classPool"]}:${string}` {
  return `${weapon.tags.classPool}:${weapon.tags.family}`;
}

export function packParryPresentation(reaction: ParryReactionValue, pose: ParryGuardPose): number {
  return (reaction & REACTION_MASK) | ((pose & 0b11) << GUARD_SHIFT);
}

export function unpackParryReaction(presentation: number): ParryReactionValue {
  const reaction = presentation & REACTION_MASK;
  return reaction >= ParryReaction.FromBelow && reaction <= ParryReaction.FromAbove
    ? (reaction as ParryReactionValue)
    : ParryReaction.None;
}

export function unpackParryGuardPose(presentation: number): ParryGuardPose {
  const pose = (presentation >> GUARD_SHIFT) & 0b11;
  return (pose <= 2 ? pose : 0) as ParryGuardPose;
}
