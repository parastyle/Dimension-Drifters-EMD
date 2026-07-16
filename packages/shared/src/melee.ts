import { CHOP_IMPACT_FRAC, SWING_WINDOW_FRAC } from "./constants.js";
import { clamp } from "./math.js";
import type { Vec2 } from "./movement.js";
import type { WeaponDef } from "./weapons.js";

/**
 * §20 WYSIWYG melee (playtest #2/#5/#6). A melee swing is not an instant cone — it's a swept BLADE: a line
 * from the wielder out to the weapon's `range` along the aim, that sweeps across the weapon's `swingArc`
 * over a brief active window. Sampled each server tick (super-sampled between ticks so a fast enemy can't
 * slip a gap), ANY enemy the blade line crosses — within `MELEE_BLADE_HALFWIDTH` of it — takes the edge
 * ONCE per swing. So "if any part of the weapon touches a monster, it's a hit", and the hit region is the
 * blade itself (tight) rather than a fat wedge. Pure + deterministic so the server owns it and it's tested.
 */

/** @deprecated Compatibility tuning/API for pre-§44 callers. Accepted swings MUST use `swingDescriptorFor`;
 *  retaining this pure clamp keeps old tooling/tests loadable without reintroducing a second live clock. */
export const MELEE_SWING_ACTIVE = 0.18;
/** @deprecated See {@link MELEE_SWING_ACTIVE}; the authoritative server does not call this helper. */
export function meleeSwingActive(cooldown: number): number {
  return Math.min(MELEE_SWING_ACTIVE, Math.max(0.04, cooldown * 0.9));
}

/** Blade half-thickness (px). §20 v0.114 beefed 16→21 — a graze along the flat connects; fewer "looked like
 *  a hit" whiffs. Generous but still tight off the line. */
export const MELEE_BLADE_HALFWIDTH = 21;
/** Max angular gap (rad) between super-sampled blade tests — keeps the swept band continuous between the
 *  20Hz ticks (a long blade at a wide arc would otherwise leave holes a small enemy could sit in). §20 v0.114
 *  tightened 0.12→0.08 so a fast wide swing can't skip over a small enemy between samples. */
export const MELEE_SAMPLE_STEP = 0.08;

export type SwingStyle = NonNullable<WeaponDef["swingStyle"]>;

/** §45 Stage-1 combo vocabulary. These tables are inert authored DATA: the client consumes pose/timing,
 *  while the server keeps resolving its one legacy centered sweep. `path` is deliberately carried now so a
 *  later accepted descriptor can reuse the exact step table without trusting a client-authored finisher. */
export type MeleeComboFamily = "arc" | "chop" | "rake" | "punch" | "thrust";
export type MeleeComboMotion =
  | "slash"
  | "overhead"
  | "shoulder-chop"
  | "rising-chop"
  | "execution-slam"
  | "rake"
  | "scissor"
  | "jab"
  | "hook"
  | "haymaker"
  | "lunge"
  | "disengage"
  | "impale";
export type MeleeComboHand = "lead" | "off" | "both";
export type MeleeComboPath = "sweep" | "fan" | "dual-sweep" | "capsule";

export interface MeleeComboStep {
  readonly name: string;
  readonly motion: MeleeComboMotion;
  /** +1 forehand/lead, −1 reverse/off-side, 0 opposing paths. Cosmetic until signed server paths land. */
  readonly direction: -1 | 0 | 1;
  readonly hand: MeleeComboHand;
  readonly timing: {
    readonly activeStart: number;
    readonly activeEnd: number;
    readonly impact?: number;
    readonly followEnd: number;
    /** Scissor's delayed second hand; absent for every single-path step. */
    readonly secondaryActiveStart?: number;
    readonly secondaryActiveEnd?: number;
  };
  /** Dormant authoritative-path authoring for Stage 3+. Stage 1 never reads damage/range/knockback. */
  readonly path: {
    readonly kind: MeleeComboPath;
    readonly arcMultiplier: number;
    readonly rangeMultiplier: number;
    readonly damageMultiplier: number;
    readonly knockback: number;
  };
}

/** §45 section-B authored 3-hit cycles. Arrays/step roots are frozen and fields are readonly; all fractions
 *  are normalized over the effective-cooldown pose so the eventual accepted descriptor can consume them. */
export const MELEE_COMBO_SEQUENCES: Readonly<
  Record<MeleeComboFamily, readonly Readonly<MeleeComboStep>[]>
> = Object.freeze({
  arc: Object.freeze([
    Object.freeze({
      name: "forehand cut",
      motion: "slash" as const,
      direction: 1 as const,
      hand: "lead" as const,
      timing: { activeStart: 0.16, activeEnd: 0.66, followEnd: 0.8 },
      path: {
        kind: "sweep" as const,
        arcMultiplier: 1,
        rangeMultiplier: 1,
        damageMultiplier: 1,
        knockback: 0,
      },
    }),
    Object.freeze({
      name: "reverse backhand",
      motion: "slash" as const,
      direction: -1 as const,
      hand: "lead" as const,
      timing: { activeStart: 0.1, activeEnd: 0.6, followEnd: 0.78 },
      path: {
        kind: "sweep" as const,
        arcMultiplier: -1,
        rangeMultiplier: 1,
        damageMultiplier: 1,
        knockback: 0,
      },
    }),
    Object.freeze({
      name: "overhead diagonal finisher",
      motion: "overhead" as const,
      direction: 1 as const,
      hand: "lead" as const,
      timing: { activeStart: 0.28, activeEnd: 0.6, impact: 0.52, followEnd: 0.74 },
      path: {
        kind: "sweep" as const,
        arcMultiplier: 1.25,
        rangeMultiplier: 1.08,
        damageMultiplier: 1.2,
        knockback: 72,
      },
    }),
  ]),
  chop: Object.freeze([
    Object.freeze({
      name: "shoulder chop",
      motion: "shoulder-chop" as const,
      direction: 1 as const,
      hand: "lead" as const,
      timing: { activeStart: 0.24, activeEnd: 0.52, impact: 0.52, followEnd: 0.66 },
      path: {
        kind: "sweep" as const,
        arcMultiplier: 0.75,
        rangeMultiplier: 1,
        damageMultiplier: 1,
        knockback: 0,
      },
    }),
    Object.freeze({
      name: "reverse rising cut",
      motion: "rising-chop" as const,
      direction: -1 as const,
      hand: "lead" as const,
      timing: { activeStart: 0.14, activeEnd: 0.5, impact: 0.5, followEnd: 0.7 },
      path: {
        kind: "sweep" as const,
        arcMultiplier: -0.8,
        rangeMultiplier: 1,
        damageMultiplier: 1,
        knockback: 0,
      },
    }),
    Object.freeze({
      name: "execution slam",
      motion: "execution-slam" as const,
      direction: 1 as const,
      hand: "lead" as const,
      timing: { activeStart: 0.32, activeEnd: 0.56, impact: 0.56, followEnd: 0.74 },
      path: {
        kind: "fan" as const,
        arcMultiplier: 1.15,
        rangeMultiplier: 1.05,
        damageMultiplier: 1.25,
        knockback: 96,
      },
    }),
  ]),
  rake: Object.freeze([
    Object.freeze({
      name: "lead-hand rake",
      motion: "rake" as const,
      direction: 1 as const,
      hand: "lead" as const,
      timing: { activeStart: 0.13, activeEnd: 0.58, followEnd: 0.76 },
      path: {
        kind: "sweep" as const,
        arcMultiplier: 1,
        rangeMultiplier: 1,
        damageMultiplier: 1,
        knockback: 0,
      },
    }),
    Object.freeze({
      name: "off-hand reverse rake",
      motion: "rake" as const,
      direction: -1 as const,
      hand: "off" as const,
      timing: { activeStart: 0.09, activeEnd: 0.54, followEnd: 0.74 },
      path: {
        kind: "sweep" as const,
        arcMultiplier: -1,
        rangeMultiplier: 1,
        damageMultiplier: 1,
        knockback: 0,
      },
    }),
    Object.freeze({
      name: "scissor drag",
      motion: "scissor" as const,
      direction: 0,
      hand: "both" as const,
      timing: {
        activeStart: 0.18,
        activeEnd: 0.52,
        secondaryActiveStart: 0.24,
        secondaryActiveEnd: 0.58,
        impact: 0.43,
        followEnd: 0.76,
      },
      path: {
        kind: "dual-sweep" as const,
        arcMultiplier: 0.85,
        rangeMultiplier: 1.05,
        damageMultiplier: 1.18,
        knockback: 64,
      },
    }),
  ]),
  punch: Object.freeze([
    Object.freeze({
      name: "lead jab",
      motion: "jab" as const,
      direction: 1 as const,
      hand: "lead" as const,
      timing: { activeStart: 0.1, activeEnd: 0.36, impact: 0.36, followEnd: 0.44 },
      path: {
        kind: "capsule" as const,
        arcMultiplier: 0,
        rangeMultiplier: 0.92,
        damageMultiplier: 0.95,
        knockback: 0,
      },
    }),
    Object.freeze({
      name: "cross / body hook",
      motion: "hook" as const,
      direction: -1 as const,
      hand: "off" as const,
      timing: { activeStart: 0.18, activeEnd: 0.48, impact: 0.48, followEnd: 0.68 },
      path: {
        kind: "sweep" as const,
        arcMultiplier: 1,
        rangeMultiplier: 1,
        damageMultiplier: 1,
        knockback: 0,
      },
    }),
    Object.freeze({
      name: "haymaker / hammerfist",
      motion: "haymaker" as const,
      direction: 1 as const,
      hand: "lead" as const,
      timing: { activeStart: 0.28, activeEnd: 0.56, impact: 0.56, followEnd: 0.72 },
      path: {
        kind: "sweep" as const,
        arcMultiplier: 1,
        rangeMultiplier: 1.05,
        damageMultiplier: 1.25,
        knockback: 88,
      },
    }),
  ]),
  thrust: Object.freeze([
    Object.freeze({
      name: "outside-line lunge",
      motion: "lunge" as const,
      direction: 1 as const,
      hand: "lead" as const,
      timing: { activeStart: 0.14, activeEnd: 0.42, impact: 0.42, followEnd: 0.5 },
      path: {
        kind: "capsule" as const,
        arcMultiplier: 0,
        rangeMultiplier: 1,
        damageMultiplier: 1,
        knockback: 0,
      },
    }),
    Object.freeze({
      name: "disengage thrust",
      motion: "disengage" as const,
      direction: -1 as const,
      hand: "lead" as const,
      timing: { activeStart: 0.18, activeEnd: 0.44, impact: 0.44, followEnd: 0.52 },
      path: {
        kind: "capsule" as const,
        arcMultiplier: 0,
        rangeMultiplier: 1,
        damageMultiplier: 1,
        knockback: 0,
      },
    }),
    Object.freeze({
      name: "step-through impale",
      motion: "impale" as const,
      direction: 1 as const,
      hand: "both" as const,
      timing: { activeStart: 0.24, activeEnd: 0.58, impact: 0.58, followEnd: 0.7 },
      path: {
        kind: "capsule" as const,
        arcMultiplier: 0,
        rangeMultiplier: 1.15,
        damageMultiplier: 1.22,
        knockback: 80,
      },
    }),
  ]),
});

/** §44 the immutable clock accepted/predicted for ONE swing. Seconds are relative to that peer's accepted
 *  epoch: the server starts at `canAct`; the client predicts at send until an acceptance sequence exists.
 *  Geometry/damage remain separate so extending a slow edge's wall-clock opportunity cannot multiply hits. */
export interface SwingDescriptor {
  readonly effectiveCooldown: number;
  readonly style: SwingStyle;
  readonly poseSeconds: number;
  readonly activeStartSeconds: number;
  readonly activeEndSeconds: number;
  readonly impactSeconds: number;
}

/** Worn gear is animated around the hand, not mounted by the authored hilt pivot. Shared because this same
 *  classification also selects the authoritative swing clock's existing normalized pose envelope. */
export function isWornWeapon(def: WeaponDef): boolean {
  if (/^(gauntlet|fist)$/i.test(def.tags?.family ?? "")) return true;
  return /\b(claws?|talons?|mitts?|gloves?|vambraces?|gauntlets?|knuckles?|cestus|fists?)\b/i.test(
    def.name,
  );
}

/** One style resolver for rig + accepted server descriptor. Authored style wins; the fallbacks exactly match
 *  the pre-§44 client vocabulary, so this clock change cannot silently change a pose shape. */
export function swingStyleFor(def: WeaponDef): SwingStyle {
  if (def.swingStyle) return def.swingStyle;
  if (isWornWeapon(def)) return /claws?|talons?/i.test(def.name) ? "pivot" : "punch";
  if (def.quake) return "chop";
  if (/rapier|lance|spear|pike|estoc|needle/i.test(def.tags?.family ?? "")) return "thrust";
  if (def.twoHanded) return "orbit";
  return "arc";
}

/** Inverse of `p*p*(3-2*p)`, used only to locate where the EXISTING orbit envelope enters/leaves its
 *  authored damage arc amid the unchanged 1.5rad wind-up + 0.9rad follow-through. */
function inverseSmoothstep(value: number): number {
  return 0.5 - Math.sin(Math.asin(1 - 2 * clamp(value, 0, 1)) / 3);
}

/** Build the one swing clock from EFFECTIVE cooldown (base × loot affix). Active fractions mirror today's
 *  normalized pose branches; the server still sweeps the legacy arc linearly inside that interval — exact
 *  per-style path/easing sync is the later accepted-epoch/path protocol, not a hidden geometry rewrite here. */
export function swingDescriptorFor(def: WeaponDef, effectiveCooldown: number): SwingDescriptor {
  const style = swingStyleFor(def);
  const poseSeconds = Math.max(0, effectiveCooldown) * (style === "spin" ? 1 : SWING_WINDOW_FRAC);
  let activeStartFrac: number;
  let activeEndFrac: number;
  switch (style) {
    case "chop":
      [activeStartFrac, activeEndFrac] = [0.3, CHOP_IMPACT_FRAC];
      break;
    case "pivot":
      [activeStartFrac, activeEndFrac] = [0.1, 0.62];
      break;
    case "punch":
      [activeStartFrac, activeEndFrac] = [def.twoHanded ? 0.24 : 0.16, CHOP_IMPACT_FRAC];
      break;
    case "thrust":
      [activeStartFrac, activeEndFrac] = [0.14, 0.38];
      break;
    case "orbit": {
      const travel = Math.max(0, def.swingArc) + 2.4;
      activeStartFrac = inverseSmoothstep(1.5 / travel);
      activeEndFrac = inverseSmoothstep((1.5 + Math.max(0, def.swingArc)) / travel);
      break;
    }
    case "spin":
      [activeStartFrac, activeEndFrac] = [0, 1];
      break;
    default:
      [activeStartFrac, activeEndFrac] = [0.16, 0.74];
      break;
  }
  return Object.freeze({
    effectiveCooldown: Math.max(0, effectiveCooldown),
    style,
    poseSeconds,
    activeStartSeconds: poseSeconds * activeStartFrac,
    activeEndSeconds: poseSeconds * activeEndFrac,
    impactSeconds: poseSeconds * CHOP_IMPACT_FRAC,
  });
}

/** Normalized authoritative edge progress on the descriptor clock. Clamping lets a 20Hz tick that crosses
 *  an entire very-fast active interval still supersample the full arc instead of dropping the swing. */
export function swingEdgeProgress(swing: SwingDescriptor, elapsedSeconds: number): number {
  const activeSeconds = swing.activeEndSeconds - swing.activeStartSeconds;
  if (activeSeconds <= 0) return elapsedSeconds >= swing.activeEndSeconds ? 1 : 0;
  return clamp((elapsedSeconds - swing.activeStartSeconds) / activeSeconds, 0, 1);
}

export function swingEdgeActive(swing: SwingDescriptor, elapsedSeconds: number): boolean {
  return elapsedSeconds >= swing.activeStartSeconds && elapsedSeconds < swing.activeEndSeconds;
}

/** The blade's aim angle at sweep progress `p` ∈ [0,1]: from `aim − swingArc/2` to `aim + swingArc/2`. */
export function bladeAngleAt(aimAngle: number, swingArc: number, p: number): number {
  return aimAngle - swingArc / 2 + swingArc * clamp(p, 0, 1);
}

/** Squared distance from point (px,py) to the segment A(ax,ay)→B(bx,by). Pure. */
export function pointSegmentDist2(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1) : 0;
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  const ex = px - cx;
  const ey = py - cy;
  return ex * ex + ey * ey;
}

/** Does the blade (segment from `wielder` out to `wielder + dir(angle)×range`) touch a circle (an enemy of
 *  radius `targetR`) within `halfWidth`? Point-blank (target on the wielder) always counts. Pure. */
export function bladeHitsCircle(
  wielder: Vec2,
  angle: number,
  range: number,
  target: Vec2,
  targetR: number,
  halfWidth: number,
): boolean {
  const bx = wielder.x + Math.cos(angle) * range;
  const by = wielder.y + Math.sin(angle) * range;
  const d2 = pointSegmentDist2(target.x, target.y, wielder.x, wielder.y, bx, by);
  const rr = targetR + halfWidth;
  return d2 <= rr * rr;
}
