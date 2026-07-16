import { clamp } from "./math.js";
import type { Vec2 } from "./movement.js";
import { CHOP_IMPACT_FRAC, SWING_WINDOW_FRAC } from "./constants.js";
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
