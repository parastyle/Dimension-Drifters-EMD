import type { WeaponLimb } from "@dd/shared";

/**
 * Final render ownership, highest first.  The ordering is deliberately total: equal-priority writers are
 * impossible, so a limb can never depend on module execution order.
 */
export const LIMB_OWNER_PRIORITY = Object.freeze({
  constraint: 600,
  attack: 500,
  "gun-mechanism": 400,
  flourish: 300,
  locomotion: 200,
  spring: 100,
} as const);

export type LimbOwner = keyof typeof LIMB_OWNER_PRIORITY;

export interface LimbClaimCandidate {
  readonly owner: LimbOwner;
  readonly active: boolean;
  /** The owner's authored envelope. It affects the visible blend, never the winner selection. */
  readonly weight: number;
}

export interface LimbResolution {
  readonly limb: WeaponLimb;
  readonly owner: LimbOwner;
  readonly weight: number;
  readonly previousOwner: LimbOwner;
}

export interface LimbPoseTarget {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

interface LimbTransition {
  owner: LimbOwner;
  previousOwner: LimbOwner;
  changedAtMs: number;
  from: LimbPoseTarget;
  final: LimbPoseTarget;
  resolution: {
    limb: WeaponLimb;
    owner: LimbOwner;
    weight: number;
    previousOwner: LimbOwner;
  };
}

const DEFAULT_CANDIDATE: LimbClaimCandidate = Object.freeze({
  owner: "spring",
  active: true,
  weight: 1,
});

export const LIMB_BLEND_IN_MS = 90;
export const LIMB_BLEND_OUT_MS = 130;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function smootherstep01(value: number): number {
  const t = clamp01(value);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function mixAngle(a: number, b: number, t: number): number {
  let delta = b - a;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return a + delta * t;
}

function copyPose(source: LimbPoseTarget): LimbPoseTarget {
  return {
    x: source.x,
    y: source.y,
    rotation: source.rotation,
    scaleX: source.scaleX,
    scaleY: source.scaleY,
  };
}

/** Pure total-order winner selection used by the runtime and the regression tests. */
export function resolveLimbOwner(
  limb: WeaponLimb,
  candidates: readonly LimbClaimCandidate[],
): LimbResolution {
  let winner = DEFAULT_CANDIDATE;
  for (const candidate of candidates) {
    if (!candidate.active) continue;
    if (LIMB_OWNER_PRIORITY[candidate.owner] > LIMB_OWNER_PRIORITY[winner.owner])
      winner = candidate;
  }
  return {
    limb,
    owner: winner.owner,
    previousOwner: winner.owner,
    weight: clamp01(winner.weight),
  };
}

/**
 * Per-rig final-pose arbiter. Pose modules may calculate candidates in any order, but only this winner is
 * committed to a rendered limb. An ownership edge starts from the prior rendered transform and crossfades
 * with zero endpoint velocity, so attack/flourish/mechanism release cannot pop back to locomotion.
 */
export class LimbPriorityResolver {
  private readonly transitions = new Map<WeaponLimb, LimbTransition>();
  private readonly resolutions = new Map<WeaponLimb, LimbResolution>();

  apply(
    limb: WeaponLimb,
    target: LimbPoseTarget,
    candidates: readonly LimbClaimCandidate[],
    nowMs: number,
  ): LimbResolution {
    const selected = resolveLimbOwner(limb, candidates);
    return this.applySelected(limb, target, nowMs, selected.owner, selected.weight);
  }

  private applySelected(
    limb: WeaponLimb,
    target: LimbPoseTarget,
    nowMs: number,
    selectedOwner: LimbOwner,
    selectedWeight: number,
  ): LimbResolution {
    let transition = this.transitions.get(limb);
    if (!transition) {
      transition = {
        owner: selectedOwner,
        previousOwner: selectedOwner,
        changedAtMs: nowMs,
        from: copyPose(target),
        final: copyPose(target),
        resolution: {
          limb,
          owner: selectedOwner,
          previousOwner: selectedOwner,
          weight: selectedWeight,
        },
      };
      this.transitions.set(limb, transition);
    } else if (transition.owner !== selectedOwner) {
      transition.previousOwner = transition.owner;
      transition.owner = selectedOwner;
      transition.changedAtMs = nowMs;
      transition.from = copyPose(transition.final);
    }

    const releasingHighPriority =
      LIMB_OWNER_PRIORITY[transition.previousOwner] > LIMB_OWNER_PRIORITY[transition.owner];
    const durationMs = releasingHighPriority ? LIMB_BLEND_OUT_MS : LIMB_BLEND_IN_MS;
    const blend = smootherstep01((nowMs - transition.changedAtMs) / durationMs);
    transition.final.x = mix(transition.from.x, target.x, blend);
    transition.final.y = mix(transition.from.y, target.y, blend);
    transition.final.rotation = mixAngle(transition.from.rotation, target.rotation, blend);
    transition.final.scaleX = mix(transition.from.scaleX, target.scaleX, blend);
    transition.final.scaleY = mix(transition.from.scaleY, target.scaleY, blend);

    target.x = transition.final.x;
    target.y = transition.final.y;
    target.rotation = transition.final.rotation;
    target.scaleX = transition.final.scaleX;
    target.scaleY = transition.final.scaleY;

    const resolution = transition.resolution;
    resolution.owner = selectedOwner;
    resolution.previousOwner = transition.previousOwner;
    resolution.weight = blend * selectedWeight;
    this.resolutions.set(limb, resolution);
    return resolution;
  }

  /** Allocation-free hot-loop entry: arguments follow the published total order. */
  applyWeights(
    limb: WeaponLimb,
    target: LimbPoseTarget,
    nowMs: number,
    constraint: number,
    attack: number,
    gunMechanism: number,
    flourish: number,
    locomotion: number,
  ): LimbResolution {
    let owner: LimbOwner = "spring";
    let weight = 1;
    if (locomotion > 0.001) {
      owner = "locomotion";
      weight = locomotion;
    }
    if (flourish > 0.001) {
      owner = "flourish";
      weight = flourish;
    }
    if (gunMechanism > 0.001) {
      owner = "gun-mechanism";
      weight = gunMechanism;
    }
    if (attack > 0.001) {
      owner = "attack";
      weight = attack;
    }
    if (constraint > 0.001) {
      owner = "constraint";
      weight = constraint;
    }
    return this.applySelected(limb, target, nowMs, owner, weight);
  }

  snapshot(): Readonly<Record<WeaponLimb, Readonly<LimbResolution>>> {
    const out = {} as Record<WeaponLimb, LimbResolution>;
    for (const [limb, resolution] of this.resolutions) out[limb] = { ...resolution };
    return out;
  }

  reset(): void {
    this.transitions.clear();
    this.resolutions.clear();
  }
}
