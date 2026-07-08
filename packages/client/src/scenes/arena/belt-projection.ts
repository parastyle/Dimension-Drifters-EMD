/**
 * §29 v0.118 BELT-SCROLLER PROJECTION (Stage 1) — the single place that maps the server's flat floor
 * position into 2.5D beat-'em-up screen space (TMNT: Shredder's Revenge / Streets of Rage 4 feel). See
 * docs/BEATEMUP_CONVERSION.md.
 *
 * ARCHITECTURE LAW (from the belt-scroller research): the authoritative sim reasons ONLY in flat floor
 * world-units — `x` (horizontal along the belt) and `y` (DEPTH into the shallow band) — plus a `height`
 * (jump). This module is CLIENT-ONLY PRESENTATION: `HORIZON`, `DEPTH_SCALE`, the screen projection, and
 * the depth-sort NEVER feed back into the sim or hit detection. That boundary lets us retune the whole look
 * (band height, foreshortening) without touching or re-certifying the server. Any hit/movement math that
 * references a value from THIS file is a bug — depth-tolerance combat lives in the shared sim (Stage 5).
 *
 * HD path (locked): virtual canvas 1920×1080; numbers are the 640×360 research figures ×3.
 */
import { DEPTH_MAX } from "@dd/shared";

/** Re-export the authoritative depth extent so belt render code has one import site. `y=0` is the far edge
 *  (at HORIZON), `y=DEPTH_MAX` the near edge (at FRONT). Owned by the shared sim (Stage 3 clamps to it). */
export { DEPTH_MAX };

/** Virtual render height the belt geometry is authored against (HD 1920×1080 → 1080 tall). The scene scales
 *  this to the display; all constants below are in these virtual px so the belt feel is aspect-stable. */
export const VIRTUAL_H = 1080;

/** Screen row (virtual px) of the FAR edge of the walkable floor band — the back wall / vanishing line.
 *  ~59% down the 1080 canvas. */
export const HORIZON = 642;
/** Screen row (virtual px) of the NEAR edge of the band (nearest depth). ~92% down; a thin lip sits below. */
export const FRONT = 990;

/** Foreshortening: screen px per world depth unit. The band is shallow on screen (~⅓ height) but deep in
 *  world units, so this is < 1 (≈0.5). depthScale = (FRONT − HORIZON) / DEPTH_MAX. */
export const DEPTH_SCALE = (FRONT - HORIZON) / DEPTH_MAX;

/** Subtle size foreshortening: an actor at the NEAR edge draws this-many× larger than at the far edge, so
 *  depth reads in scale too (kept gentle — the band is shallow). */
export const NEAR_SCALE_BONUS = 0.28;

/** The screen Y (virtual px) an actor's FEET sit at, for floor depth `y` and jump `height` (both world
 *  units). Feet are anchored to the floor: shadow uses `floorScreenY` (ignores height), the body subtracts
 *  height so a jump lifts the sprite while its shadow stays put. PURE. */
export function floorScreenY(depthY: number): number {
  return HORIZON + clampDepth(depthY) * DEPTH_SCALE;
}
export function bodyScreenY(depthY: number, height = 0): number {
  return floorScreenY(depthY) - height;
}

/** Per-actor render scale from depth `y` (0 far … DEPTH_MAX near): 1 at the far edge → 1+NEAR_SCALE_BONUS
 *  at the near edge. Multiply the rig's own scale by this. PURE. */
export function depthRenderScale(depthY: number): number {
  return 1 + (clampDepth(depthY) / DEPTH_MAX) * NEAR_SCALE_BONUS;
}

/** Depth-sort key: sort floor actors by this ASCENDING so NEARER (larger depth) draws LAST / in front. Uses
 *  DEPTH, not screenY, so a jump (height) never scrambles draw order. `bias` nudges ties (e.g. the local
 *  player gets a small +bias so it pokes in front of an enemy at equal depth). PURE. */
export function depthSortKey(depthY: number, bias = 0): number {
  return clampDepth(depthY) + bias;
}

/** Radius (virtual px) of the floor shadow ellipse for an actor of body scale `s` at jump `height` — it
 *  SHRINKS as the actor rises (higher jump = smaller, fainter shadow), selling the airborne gap. PURE. */
export function shadowRadius(baseR: number, s: number, height = 0): number {
  const lift = Math.max(0, 1 - height / (DEPTH_MAX * 0.5));
  return baseR * s * lift;
}

function clampDepth(y: number): number {
  return y < 0 ? 0 : y > DEPTH_MAX ? DEPTH_MAX : y;
}

/**
 * §29 PARALLAX layer config (Stage 4 wires it in Phaser). scrollFactor = fraction of camera-X the layer
 * moves (0 = pinned sky, 1 = the floor/gameplay reference, >1 = foreground occluder that passes in front).
 * `drift` (px/s) is a CAMERA-INDEPENDENT auto-scroll — for clouds that keep sliding during a locked fight.
 * Ratios (not px) so they hold at any resolution. Order = far → near.
 */
export interface ParallaxLayer {
  id: string;
  scrollFactor: number;
  /** Camera-independent horizontal drift, virtual px/sec (0 = static). */
  drift: number;
}
export const PARALLAX_LAYERS: readonly ParallaxLayer[] = [
  { id: "sky", scrollFactor: 0.0, drift: 0 },
  { id: "clouds-far", scrollFactor: 0.08, drift: 6 },
  { id: "far", scrollFactor: 0.2, drift: 0 },
  { id: "clouds-mid", scrollFactor: 0.16, drift: 10 },
  { id: "mid", scrollFactor: 0.4, drift: 0 },
  { id: "near", scrollFactor: 0.7, drift: 0 },
  { id: "floor", scrollFactor: 1.0, drift: 0 }, // gameplay reference plane (actors live here)
  { id: "foreground", scrollFactor: 1.2, drift: 0 }, // occluder — passes IN FRONT of the actors
] as const;

/** §29 camera: eased horizontal follow (belt-scroll). Frame-rate-independent lerp toward the target scroll
 *  each frame: `x += (want − x) * (1 − e^(−dt/CAM_TAU))`. Vertical is LOCKED (depth lives in screenY). */
export const CAM_TAU = 0.12; // ≈ lerpX 0.10 feel
