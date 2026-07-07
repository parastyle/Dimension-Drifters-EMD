import { clamp } from "./math.js";
import type { Vec2 } from "./movement.js";

/**
 * §20 WYSIWYG melee (playtest #2/#5/#6). A melee swing is not an instant cone — it's a swept BLADE: a line
 * from the wielder out to the weapon's `range` along the aim, that sweeps across the weapon's `swingArc`
 * over a brief active window. Sampled each server tick (super-sampled between ticks so a fast enemy can't
 * slip a gap), ANY enemy the blade line crosses — within `MELEE_BLADE_HALFWIDTH` of it — takes the edge
 * ONCE per swing. So "if any part of the weapon touches a monster, it's a hit", and the hit region is the
 * blade itself (tight) rather than a fat wedge. Pure + deterministic so the server owns it and it's tested.
 */

/** Seconds the blade stays "live" and sweeping after a swing fires (clamped to the weapon's cooldown). */
export const MELEE_SWING_ACTIVE = 0.18;
/** Blade half-thickness (px). §20 v0.114 beefed 16→21 — a graze along the flat connects; fewer "looked like
 *  a hit" whiffs. Generous but still tight off the line. */
export const MELEE_BLADE_HALFWIDTH = 21;
/** Max angular gap (rad) between super-sampled blade tests — keeps the swept band continuous between the
 *  20Hz ticks (a long blade at a wide arc would otherwise leave holes a small enemy could sit in). §20 v0.114
 *  tightened 0.12→0.08 so a fast wide swing can't skip over a small enemy between samples. */
export const MELEE_SAMPLE_STEP = 0.08;

/** Effective swing-active window for a weapon: the blade can't stay live past its own cooldown (else a fast
 *  weapon's swings would overlap and the per-swing hit-set would never reset cleanly). */
export function meleeSwingActive(cooldown: number): number {
  return Math.min(MELEE_SWING_ACTIVE, Math.max(0.04, cooldown * 0.9));
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
