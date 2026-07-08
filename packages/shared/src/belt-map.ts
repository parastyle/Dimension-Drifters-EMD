/**
 * §29 v0.118 BELT-LEVEL MAP + COLLISION (see docs/BEATEMUP_CONVERSION.md). A belt level is authored DATA (a
 * designed level, like a real beat-'em-up — not procedural) with an ACCURATE floor-collision layer the art
 * sits on top of (WYSIWYG): the walkable DEPTH band edges vary along the belt, and solid obstacles you route
 * around. PURE + shared — the server sim, the client predictor, AND the client renderer all read the SAME
 * geometry, so the deck you SEE is exactly the deck you COLLIDE with, and prediction can't drift.
 *
 * Coordinate model: `x` = belt position (world px). DEPTH is band-relative (0 = FAR/back edge … DEPTH_MAX =
 * NEAR/front edge); the collision helpers add `BELT_Y0` to return WORLD y for the sim.
 */
import { ARENA_WIDTH, BELT_Y0, DEPTH_MAX } from "./constants.js";

/** A solid obstacle on the deck — a circle bodies route around. `depth` band-relative (0..DEPTH_MAX). */
export interface BeltObstacle {
  x: number;
  depth: number;
  r: number;
  /** Art/kind tag for the renderer (e.g. "crate", "barrel"). */
  kind?: string;
}

/** A floor-profile keyframe: at belt position `x` the walkable band is depth ∈ [yMin, yMax] (band-relative).
 *  Edges interpolate linearly between keyframes, so the deck can narrow (catwalk), widen (arena), or inset. */
export interface BeltFloorKey {
  x: number;
  yMin: number;
  yMax: number;
}

export interface BeltLevel {
  id: string;
  name: string;
  /** Belt length in world px (the playable x extent). */
  length: number;
  /** Floor profile, sorted by `x`. */
  floor: readonly BeltFloorKey[];
  obstacles: readonly BeltObstacle[];
}

/** Walkable depth band [yMin, yMax] (band-relative) at belt position `x`, linearly interpolated. PURE. */
export function beltBounds(level: BeltLevel, x: number): { yMin: number; yMax: number } {
  const f = level.floor;
  const first = f[0];
  if (!first) return { yMin: 0, yMax: DEPTH_MAX };
  if (x <= first.x) return { yMin: first.yMin, yMax: first.yMax };
  for (let i = 1; i < f.length; i++) {
    const a = f[i - 1];
    const b = f[i];
    if (a && b && x <= b.x) {
      const t = (x - a.x) / (b.x - a.x || 1);
      return { yMin: a.yMin + (b.yMin - a.yMin) * t, yMax: a.yMax + (b.yMax - a.yMax) * t };
    }
  }
  const last = f[f.length - 1] ?? first;
  return { yMin: last.yMin, yMax: last.yMax };
}

/** Clamp a body's WORLD y (depth) to the walkable floor at belt position `x`, keeping `bodyR` off the edges.
 *  Returns the clamped world y. PURE — server + client predictor + renderer all call this. */
export function clampBeltFloorY(level: BeltLevel, x: number, worldY: number, bodyR = 0): number {
  const { yMin, yMax } = beltBounds(level, x);
  const lo = BELT_Y0 + yMin + bodyR;
  const hi = BELT_Y0 + yMax - bodyR;
  if (hi < lo) return (lo + hi) / 2; // band narrower than the body → centre it
  return worldY < lo ? lo : worldY > hi ? hi : worldY;
}

/** Push a body (belt `x`, world `y`, radius `bodyR`) out of any obstacle it overlaps. Returns adjusted
 *  `{x, y}`. PURE — the belt equivalent of resolvePoiCollision. */
export function resolveBeltObstacles(
  level: BeltLevel,
  x: number,
  worldY: number,
  bodyR: number,
): { x: number; y: number } {
  let px = x;
  let py = worldY;
  for (const o of level.obstacles) {
    const oy = BELT_Y0 + o.depth;
    const dx = px - o.x;
    const dy = py - oy;
    const d = Math.hypot(dx, dy);
    const min = o.r + bodyR;
    if (d > 1e-4 && d < min) {
      px = o.x + (dx / d) * min;
      py = oy + (dy / d) * min;
    } else if (d <= 1e-4) {
      px = o.x + min; // exactly centred → shove +x
    }
  }
  return { x: px, y: py };
}

/**
 * §29 SKY CARRIER — Level 1 (authored). A flight deck that runs wide, pinches to a narrow CATWALK over the
 * open sky mid-level, then opens into a wide BOSS ARENA. A few crates/barrels to fight around. The near/far
 * edges ARE the railings the client draws — WYSIWYG collision.
 */
export const SKY_CARRIER: BeltLevel = {
  id: "sky-carrier",
  name: "Sky Carrier",
  length: ARENA_WIDTH,
  floor: [
    { x: 0, yMin: 44, yMax: DEPTH_MAX - 44 },
    { x: 1900, yMin: 44, yMax: DEPTH_MAX - 44 }, // wide flight deck
    { x: 2450, yMin: 214, yMax: DEPTH_MAX - 214 }, // pinch → catwalk
    { x: 3150, yMin: 214, yMax: DEPTH_MAX - 214 },
    { x: 3750, yMin: 40, yMax: DEPTH_MAX - 40 }, // open → boss arena
    { x: ARENA_WIDTH, yMin: 40, yMax: DEPTH_MAX - 40 },
  ],
  obstacles: [
    { x: 1050, depth: DEPTH_MAX * 0.3, r: 62, kind: "crate" },
    { x: 1400, depth: DEPTH_MAX * 0.72, r: 62, kind: "crate" },
    { x: 4300, depth: DEPTH_MAX * 0.5, r: 82, kind: "barrel" },
  ],
};

export const BELT_LEVELS: Record<string, BeltLevel> = { "sky-carrier": SKY_CARRIER };

/** The belt level for an id, defaulting to Sky Carrier. Never undefined. */
export function beltLevelFor(id: string): BeltLevel {
  return BELT_LEVELS[id] ?? SKY_CARRIER;
}
