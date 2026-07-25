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
import {
  type CorporateGridBounds,
  type CorporateGridFloor,
  type CorporateGridFloorId,
  type CorporateGridVariant,
  type CorporateGridWaveAnchor,
  corporateGridFloorInstanceForDepth,
  corporateGridFloorFor,
  corporateGridVariantForDepth,
} from "./corporate-grid-map.js";

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

/** A jumpable PIT — a gap in the deck spanning belt x ∈ [x0, x1] (full depth). A GROUNDED body over it falls
 *  (chip + snap-back for players, death for enemies, §17); an AIRBORNE body (mid-jump) clears it. Sized
 *  under the jump reach (~run-speed × airtime) so a running jump always makes it across. */
export interface BeltPit {
  x0: number;
  x1: number;
}

/** A ROOM the squad clears to advance (beat-'em-up progression). The camera + movement LOCK at `gateX`
 *  while `wave` enemies are alive; clear them → the gate opens → walk on to the next room. `boss` rooms
 *  spawn the dimension boss instead of a trash wave. Rooms are contiguous: room i spans (prev gateX, gateX]. */
export interface BeltRoom {
  gateX: number;
  wave: number;
  boss?: boolean;
  /** §36 the boss KIND this finale room spawns (an ENEMY_KINDS boss id). Omitted → the level's dimension
   *  boss. Lets each level end on a different capstone (the Sky Carrier ends on the colossus world-titan). */
  bossKind?: string;
  /** Label for the "ROOM: …" banner. */
  name: string;
}

export interface BeltLevel {
  id: string;
  name: string;
  /** §36 the DIMENSION this level scopes — its enemy roster (spawnBeltWave), palette + default boss. Each
   *  belt level is themed by a dimension so the four levels feel distinct (frost mobs vs cyber mobs …). */
  dimensionId: string;
  /** One-line flavour for the level-select card. */
  blurb?: string;
  /** Belt length in world px (the playable x extent). */
  length: number;
  /** Floor profile, sorted by `x`. */
  floor: readonly BeltFloorKey[];
  /** Jumpable pits (the only hazard) — gaps in the deck. */
  pits: readonly BeltPit[];
  obstacles: readonly BeltObstacle[];
  /** Ordered rooms (clear-to-advance gates), last is the boss. */
  rooms: readonly BeltRoom[];
  /** B34 generated LDtk floor backing this belt. Omitted by every legacy authored belt. */
  corporateGridFloorId?: CorporateGridFloorId;
  /** Zero-based authored floor depth. Lane 2 may drive a later run-depth independently. */
  corporateDepth?: number;
  /** Deterministic runtime crop. Present only on generated Corporate Grid floor instances. */
  corporateVariant?: CorporateGridVariant;
}

/** The generated LDtk floor behind a corporate belt level, if this is one. */
export function corporateGridFloorForBelt(level: BeltLevel): CorporateGridFloor | undefined {
  if (!level.corporateGridFloorId) return undefined;
  if (level.corporateVariant && level.corporateDepth !== undefined) {
    const floor = corporateGridFloorInstanceForDepth(level.corporateDepth + 1, level.corporateVariant);
    if (floor.id !== level.corporateGridFloorId)
      throw new Error(
        `corporate-grid belt floor mismatch: ${level.corporateGridFloorId} != ${floor.id}`,
      );
    return floor;
  }
  return corporateGridFloorFor(level.corporateGridFloorId);
}

/** Playable horizontal center bounds. Legacy levels retain their exact [0,length] behavior. */
export function beltPlayableXBounds(level: BeltLevel): { minX: number; maxX: number } {
  return corporateGridFloorForBelt(level)?.playableBounds ?? { minX: 0, maxX: level.length };
}

/** Camera scroll content bounds. Legacy levels retain their exact full-level extent. */
export function beltCameraBounds(level: BeltLevel): CorporateGridBounds {
  return (
    corporateGridFloorForBelt(level)?.cameraBounds ?? {
      minX: 0,
      minY: 0,
      maxX: level.length,
      maxY: DEPTH_MAX,
    }
  );
}

/** Clamp a body center between the authored EndWall/IntGrid-3 end blockers. */
export function clampBeltX(level: BeltLevel, x: number, bodyR = 0): number {
  const bounds = beltPlayableXBounds(level);
  const min = bounds.minX + bodyR;
  const max = bounds.maxX - bodyR;
  if (max < min) return (min + max) / 2;
  return x < min ? min : x > max ? max : x;
}

/** Is belt position `x` over a pit gap? PURE. */
export function beltPitAtX(level: BeltLevel, x: number): boolean {
  for (const p of level.pits) if (x >= p.x0 && x <= p.x1) return true;
  return false;
}

/** Nearest safe belt x OUTSIDE any pit, given a fall-back reference `fromX` (the last grounded x) — used to
 *  snap a fallen body back to solid deck (before the pit it walked into). PURE. */
export function beltSafeX(level: BeltLevel, x: number, fromX: number): number {
  if (!beltPitAtX(level, x)) return x;
  for (const p of level.pits) {
    if (x >= p.x0 && x <= p.x1) return fromX <= p.x0 ? p.x0 - 4 : p.x1 + 4; // step back to the edge you came from
  }
  return x;
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
 *  `{x, y}`. PURE and allocation-free. */
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

function resolveCircleRect(
  x: number,
  y: number,
  radius: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): { x: number; y: number } {
  const closestX = Math.max(minX, Math.min(maxX, x));
  const closestY = Math.max(minY, Math.min(maxY, y));
  const dx = x - closestX;
  const dy = y - closestY;
  const distanceSq = dx * dx + dy * dy;
  if (distanceSq >= radius * radius) return { x, y };
  if (distanceSq > 1e-8) {
    const distance = Math.sqrt(distanceSq);
    const push = radius - distance;
    return { x: x + (dx / distance) * push, y: y + (dy / distance) * push };
  }
  const left = Math.abs(x - minX);
  const right = Math.abs(maxX - x);
  const top = Math.abs(y - minY);
  const bottom = Math.abs(maxY - y);
  const nearest = Math.min(left, right, top, bottom);
  if (nearest === left) return { x: minX - radius, y };
  if (nearest === right) return { x: maxX + radius, y };
  if (nearest === top) return { x, y: minY - radius };
  return { x, y: maxY + radius };
}

/**
 * Resolve a belt body against the LDtk solid value-1 cells and end blockers. Non-corporate belts return
 * the input unchanged, preserving the old obstacle path byte-for-byte.
 */
export function resolveBeltMapCollision(
  level: BeltLevel,
  x: number,
  worldY: number,
  bodyR: number,
): { x: number; y: number } {
  const floor = corporateGridFloorForBelt(level);
  if (!floor) return { x, y: worldY };
  let px = clampBeltX(level, x, bodyR);
  let py = worldY;
  const tile = floor.gridSize;
  for (let pass = 0; pass < 3; pass++) {
    const localY = py - BELT_Y0;
    const minCol = Math.max(0, Math.floor((px - bodyR) / tile));
    const maxCol = Math.min(floor.cols - 1, Math.floor((px + bodyR) / tile));
    const minRow = Math.max(0, Math.floor((localY - bodyR) / tile));
    const maxRow = Math.min(floor.rows - 1, Math.floor((localY + bodyR) / tile));
    let moved = false;
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        if (floor.collisionGrid[row * floor.cols + col] !== 1) continue;
        const resolved = resolveCircleRect(
          px,
          py,
          bodyR,
          col * tile,
          BELT_Y0 + row * tile,
          (col + 1) * tile,
          BELT_Y0 + (row + 1) * tile,
        );
        if (resolved.x !== px || resolved.y !== py) {
          px = resolved.x;
          py = resolved.y;
          moved = true;
        }
      }
    }
    px = clampBeltX(level, px, bodyR);
    if (!moved) break;
  }
  return { x: px, y: py };
}

/** One collision postcondition used by server and predictor for every belt body. */
export function resolveBeltNavigation(
  level: BeltLevel,
  x: number,
  worldY: number,
  bodyR: number,
): { x: number; y: number } {
  const obstacle = resolveBeltObstacles(level, x, worldY, bodyR);
  const map = resolveBeltMapCollision(level, obstacle.x, obstacle.y, bodyR);
  return {
    x: map.x,
    y: clampBeltFloorY(level, map.x, map.y, bodyR),
  };
}

function segmentIntersectsRect(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): boolean {
  const dx = x1 - x0;
  const dy = y1 - y0;
  let enter = 0;
  let exit = 1;
  const clip = (p: number, q: number): boolean => {
    if (Math.abs(p) < 1e-9) return q >= 0;
    const ratio = q / p;
    if (p < 0) {
      if (ratio > exit) return false;
      if (ratio > enter) enter = ratio;
    } else {
      if (ratio < enter) return false;
      if (ratio < exit) exit = ratio;
    }
    return true;
  };
  return (
    clip(-dx, x0 - minX) &&
    clip(dx, maxX - x0) &&
    clip(-dy, y0 - minY) &&
    clip(dy, maxY - y0)
  );
}

/** True when a projectile sweep crosses an LDtk solid-1 cell or an authored end blocker. */
export function beltProjectileBlocked(
  level: BeltLevel,
  fromX: number,
  fromWorldY: number,
  toX: number,
  toWorldY: number,
  radius = 0,
): boolean {
  const floor = corporateGridFloorForBelt(level);
  if (!floor) return false;
  const playable = floor.playableBounds;
  if (toX - radius < playable.minX || toX + radius > playable.maxX) return true;
  const tile = floor.gridSize;
  const localFromY = fromWorldY - BELT_Y0;
  const localToY = toWorldY - BELT_Y0;
  const minCol = Math.max(0, Math.floor((Math.min(fromX, toX) - radius) / tile));
  const maxCol = Math.min(
    floor.cols - 1,
    Math.floor((Math.max(fromX, toX) + radius) / tile),
  );
  const minRow = Math.max(
    0,
    Math.floor((Math.min(localFromY, localToY) - radius) / tile),
  );
  const maxRow = Math.min(
    floor.rows - 1,
    Math.floor((Math.max(localFromY, localToY) + radius) / tile),
  );
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      if (floor.collisionGrid[row * floor.cols + col] !== 1) continue;
      if (
        segmentIntersectsRect(
          fromX,
          localFromY,
          toX,
          localToY,
          col * tile - radius,
          row * tile - radius,
          (col + 1) * tile + radius,
          (row + 1) * tile + radius,
        )
      )
        return true;
    }
  }
  return false;
}

/** Early floors are 85% right-biased; the bias eases to an even split by authored floor depth 2. */
export function beltWaveSideForDepth(depth: number, roll: number): "left" | "right" {
  const normalizedDepth = Math.max(0, Number.isFinite(depth) ? depth : 0);
  const rightChance = Math.max(0.5, 0.85 - normalizedDepth * 0.175);
  return roll < rightChance ? "right" : "left";
}

/**
 * Select a generated wave anchor with an explicit depth parameter for Lane 2. The chosen side is relative
 * to the squad's current x; x-range filtering keeps each legacy belt room's gate progression intact.
 */
export function selectCorporateWaveAnchor(
  floor: CorporateGridFloor,
  playerX: number,
  depth: number,
  sideRoll: number,
  anchorRoll: number,
  xMin = floor.playableBounds.minX,
  xMax = floor.playableBounds.maxX,
): CorporateGridWaveAnchor {
  const inRoom = floor.waveAnchors.filter((anchor) => anchor.x >= xMin && anchor.x <= xMax);
  const pool = inRoom.length > 0 ? inRoom : floor.waveAnchors;
  const side = beltWaveSideForDepth(depth, sideRoll);
  const sided = pool.filter((anchor) =>
    side === "right" ? anchor.x >= playerX + 90 : anchor.x <= playerX - 90,
  );
  const candidates = sided.length > 0 ? sided : pool;
  const clampedRoll = Math.max(0, Math.min(0.999999999, anchorRoll));
  const fallback = floor.waveAnchors[0];
  if (!fallback) throw new Error(`corporate-grid floor ${floor.id} has no wave anchors`);
  return candidates[Math.floor(clampedRoll * candidates.length)] ?? fallback;
}

/**
 * §29 SKY CARRIER — Level 1 (authored). A flight deck that runs wide, pinches to a narrow CATWALK over the
 * open sky mid-level, then opens into a wide BOSS ARENA. A few crates/barrels to fight around. The near/far
 * edges ARE the railings the client draws — WYSIWYG collision.
 */
export const SKY_CARRIER: BeltLevel = {
  id: "sky-carrier",
  name: "Sky Carrier",
  dimensionId: "wild-west",
  blurb: "Board a flying dreadnought. Fight up the flight deck to the bridge — and the World-Tread.",
  length: ARENA_WIDTH,
  // §37 margins ×1.5 with the deeper DEPTH_MAX so the wide/pinch proportions hold (+50% room everywhere).
  floor: [
    { x: 0, yMin: 66, yMax: DEPTH_MAX - 66 },
    { x: 1900, yMin: 66, yMax: DEPTH_MAX - 66 }, // wide flight deck
    { x: 2450, yMin: 320, yMax: DEPTH_MAX - 320 }, // pinch → catwalk
    { x: 3150, yMin: 320, yMax: DEPTH_MAX - 320 },
    { x: 3750, yMin: 60, yMax: DEPTH_MAX - 60 }, // open → boss arena
    { x: ARENA_WIDTH, yMin: 60, yMax: DEPTH_MAX - 60 },
  ],
  // Jumpable pits — the only hazard (§29). Placed in the WIDE sections (never the catwalk); ~110px wide so
  // a running jump (~144px reach) clears them. Kite enemies in — they can't jump, so pits are free kills.
  pits: [
    { x0: 1180, x1: 1290 },
    { x0: 1560, x1: 1670 },
    { x0: 4120, x1: 4235 },
  ],
  obstacles: [],
  // Clear-to-advance rooms → boss on the bridge. Gates fall on the deck's natural beats (flight deck /
  // catwalk mouth / arena mouth / bridge).
  rooms: [
    { gateX: 1900, wave: 4, name: "Flight Deck" },
    { gateX: 3150, wave: 5, name: "The Catwalk" },
    { gateX: 3750, wave: 6, name: "Arena Mouth" },
    { gateX: ARENA_WIDTH, wave: 0, boss: true, bossKind: "world-titan", name: "The Bridge" },
  ],
  // The Catwalk opens just past the first gate on clear deck (clear of the 1560–1670 pit).
};

/** §36 FROSTFELL DESCENT — a glacier chasm. Narrow crevasse pinches, more pits, frost roster, Hollow King. */
export const FROST_CHASM: BeltLevel = {
  id: "frost-chasm",
  name: "Frostfell Descent",
  dimensionId: "frostfell",
  blurb: "Cross a shattered glacier. Mind the crevasses — a running jump clears them, the frostbitten can't.",
  length: ARENA_WIDTH,
  floor: [
    { x: 0, yMin: 90, yMax: DEPTH_MAX - 90 },
    { x: 1500, yMin: 90, yMax: DEPTH_MAX - 90 }, // wide shelf
    { x: 2000, yMin: 360, yMax: DEPTH_MAX - 360 }, // pinch → the crevasse
    { x: 2900, yMin: 360, yMax: DEPTH_MAX - 360 },
    { x: 3400, yMin: 75, yMax: DEPTH_MAX - 75 }, // open → the throne
    { x: ARENA_WIDTH, yMin: 75, yMax: DEPTH_MAX - 75 },
  ],
  pits: [
    { x0: 900, x1: 1010 },
    { x0: 1300, x1: 1410 },
    { x0: 3600, x1: 3712 },
    { x0: 4000, x1: 4110 },
  ],
  obstacles: [],
  rooms: [
    { gateX: 1600, wave: 4, name: "Glacier Shelf" },
    { gateX: 2900, wave: 5, name: "The Crevasse" },
    { gateX: 3400, wave: 6, name: "Frost Gate" },
    { gateX: ARENA_WIDTH, wave: 0, boss: true, name: "The Hollow Throne" },
  ],
};

/** §36 VERDANT OVERGROWTH — a sunken ruin swallowed by jungle. Root-choked, few pits, verdant roster. */
export const VERDANT_RUIN: BeltLevel = {
  id: "verdant-ruin",
  name: "Verdant Overgrowth",
  dimensionId: "verdant-ruins",
  blurb: "Push through a ruin the jungle reclaimed. Vine-lashers swarm the root halls to the Moss-Stone Golem.",
  length: ARENA_WIDTH,
  floor: [
    { x: 0, yMin: 75, yMax: DEPTH_MAX - 75 },
    { x: 1700, yMin: 180, yMax: DEPTH_MAX - 180 },
    { x: 2600, yMin: 180, yMax: DEPTH_MAX - 180 }, // root corridor
    { x: 3300, yMin: 300, yMax: DEPTH_MAX - 90 }, // canted floor → ruin mouth
    { x: ARENA_WIDTH, yMin: 90, yMax: DEPTH_MAX - 90 },
  ],
  pits: [
    { x0: 2050, x1: 2160 },
    { x0: 3050, x1: 3160 },
  ],
  obstacles: [],
  rooms: [
    { gateX: 1800, wave: 5, name: "Root Hall" },
    { gateX: 2900, wave: 6, name: "Canopy Walk" },
    { gateX: 3600, wave: 6, name: "Ruin Mouth" },
    { gateX: ARENA_WIDTH, wave: 0, boss: true, name: "The Heart-Stone" },
  ],
};

/** §36 NEON UNDERGRID — a cyber sublevel. Long clean sightlines, catwalk pits over the void, cyber roster. */
export const NEON_UNDERGRID: BeltLevel = {
  id: "neon-undergrid",
  name: "Neon Undergrid",
  dimensionId: "neon-cyber",
  blurb: "Descend a server sublevel. Ranged synth-mobs hold the conduits down to the Warden's reactor core.",
  length: ARENA_WIDTH,
  floor: [
    { x: 0, yMin: 105, yMax: DEPTH_MAX - 105 },
    { x: 1600, yMin: 105, yMax: DEPTH_MAX - 105 }, // server farm
    { x: 2100, yMin: 390, yMax: DEPTH_MAX - 390 }, // data conduit (tight)
    { x: 3400, yMin: 390, yMax: DEPTH_MAX - 390 },
    { x: 3800, yMin: 60, yMax: DEPTH_MAX - 60 }, // reactor floor
    { x: ARENA_WIDTH, yMin: 60, yMax: DEPTH_MAX - 60 },
  ],
  pits: [
    { x0: 1150, x1: 1260 },
    { x0: 2500, x1: 2610 },
    { x0: 3000, x1: 3110 },
    { x0: 4180, x1: 4290 },
  ],
  obstacles: [],
  rooms: [
    { gateX: 1700, wave: 5, name: "Server Farm" },
    { gateX: 3400, wave: 6, name: "Data Conduit" },
    { gateX: 3800, wave: 7, name: "Reactor Gate" },
    { gateX: ARENA_WIDTH, wave: 0, boss: true, name: "The Core" },
  ],
};

/** §36 ASHLAND FORGE — a live volcanic foundry. Lava-gap pits, the cinder roster, the Molten Brute (Ver'Kaln
 *  the Descending). Tight pour-line catwalk in the middle, an open crucible at the end. */
export const ASHLAND_FORGE: BeltLevel = {
  id: "ashland-forge",
  name: "Ashland Forge",
  dimensionId: "ashlands",
  blurb: "Cross a live foundry. Leap the lava gaps — the cinder-born wade them, you won't. Ver'Kaln waits at the pour.",
  length: ARENA_WIDTH,
  floor: [
    { x: 0, yMin: 84, yMax: DEPTH_MAX - 84 },
    { x: 1650, yMin: 84, yMax: DEPTH_MAX - 84 }, // foundry floor
    { x: 2150, yMin: 345, yMax: DEPTH_MAX - 345 }, // pinch → the pour-line catwalk
    { x: 3100, yMin: 345, yMax: DEPTH_MAX - 345 },
    { x: 3600, yMin: 69, yMax: DEPTH_MAX - 69 }, // open → the crucible
    { x: ARENA_WIDTH, yMin: 69, yMax: DEPTH_MAX - 69 },
  ],
  pits: [
    { x0: 1000, x1: 1110 },
    { x0: 1400, x1: 1510 },
    { x0: 3750, x1: 3862 },
    { x0: 4150, x1: 4260 },
  ],
  obstacles: [],
  rooms: [
    { gateX: 1700, wave: 5, name: "Foundry Floor" },
    { gateX: 3100, wave: 6, name: "The Pour-Line" },
    { gateX: 3600, wave: 7, name: "Crucible Gate" },
    { gateX: ARENA_WIDTH, wave: 0, boss: true, name: "The Crucible" },
  ],
};

export interface CorporateGridWavePressure {
  roomCount: number;
  waves: readonly number[];
  depthBonus: number;
}

/** Existing belt depth drives count; existing toughChance(elapsed, players, depth) drives tier pressure. */
export function corporateGridWavePressure(
  depth: number,
  variant = corporateGridVariantForDepth(depth),
): CorporateGridWavePressure {
  const normalizedDepth = Math.max(1, Math.floor(Number.isFinite(depth) ? depth : 1));
  const roomCount = variant === "short" ? 2 : variant === "long" ? 4 : 3;
  const depthBonus = Math.min(5, Math.floor((normalizedDepth - 1) / 2));
  return {
    roomCount,
    waves: Array.from({ length: roomCount }, (_, index) => 4 + index + depthBonus),
    depthBonus,
  };
}

function corporateGridRooms(
  floor: CorporateGridFloor,
  depth: number,
  variant: CorporateGridVariant,
): BeltRoom[] {
  const pressure = corporateGridWavePressure(depth, variant);
  const span = floor.playableBounds.maxX - floor.playableBounds.minX;
  const traversable = span - 360;
  const names = ["Reception Wing", "Portrait Run", "Executive Hall", "Terminus Approach"];
  return pressure.waves.map((wave, index) => ({
    gateX:
      floor.playableBounds.minX +
      Math.round(((traversable * (index + 1)) / pressure.roomCount) / floor.gridSize) *
        floor.gridSize,
    wave,
    name: names[index] ?? `Corporate Wave ${index + 1}`,
  }));
}

function corporateGridBeltLevel(
  id: string,
  floorId: CorporateGridFloorId,
  name: string,
  depth: number,
): BeltLevel {
  const floorDepth = depth + 1;
  const variant = corporateGridVariantForDepth(floorDepth);
  const floor = corporateGridFloorInstanceForDepth(floorDepth, variant);
  if (floor.id !== floorId)
    throw new Error(`corporate-grid loop mismatch: expected ${floorId}, received ${floor.id}`);
  return {
    id,
    name,
    dimensionId: "wild-west",
    blurb: `Fight through Corporate Grid floor ${floorDepth}.`,
    length: floor.playableBounds.maxX,
    floor: [
      { x: floor.playableBounds.minX, yMin: floor.laneBounds.minY, yMax: floor.laneBounds.maxY },
      { x: floor.playableBounds.maxX, yMin: floor.laneBounds.minY, yMax: floor.laneBounds.maxY },
    ],
    pits: [],
    obstacles: [],
    rooms: corporateGridRooms(floor, floorDepth, variant),
    corporateGridFloorId: floor.id,
    corporateDepth: depth,
    corporateVariant: variant,
  };
}

/** Build the next endless-tower floor from depth alone; server and clients call this same constructor. */
export function corporateGridBeltLevelForDepth(
  depth: number,
  variant = corporateGridVariantForDepth(depth),
): BeltLevel {
  const normalizedDepth = Math.max(1, Math.floor(Number.isFinite(depth) ? depth : 1));
  const floor = corporateGridFloorInstanceForDepth(normalizedDepth, variant);
  const materialName =
    floor.id === "office-red-carpet-gallery"
      ? "Red Carpet Gallery"
      : floor.id === "office-random-dude-portrait-hall"
        ? "Portrait Hall"
        : "Marble Gallery";
  return {
    id: "corporate-grid",
    name: `Corporate Grid: ${materialName}`,
    dimensionId: "wild-west",
    blurb: `Endless tower floor ${normalizedDepth} · ${variant}.`,
    length: floor.playableBounds.maxX,
    floor: [
      { x: floor.playableBounds.minX, yMin: floor.laneBounds.minY, yMax: floor.laneBounds.maxY },
      { x: floor.playableBounds.maxX, yMin: floor.laneBounds.minY, yMax: floor.laneBounds.maxY },
    ],
    pits: [],
    obstacles: [],
    rooms: corporateGridRooms(floor, normalizedDepth, variant),
    corporateGridFloorId: floor.id,
    corporateDepth: normalizedDepth - 1,
    corporateVariant: variant,
  };
}

/** B34 floor 1 boot target. `beltLevel=corporate-grid` intentionally resolves here. */
export const CORPORATE_GRID_RED_CARPET = corporateGridBeltLevel(
  "corporate-grid",
  "office-red-carpet-gallery",
  "Corporate Grid: Red Carpet Gallery",
  0,
);

export const CORPORATE_GRID_PORTRAIT_HALL = corporateGridBeltLevel(
  "corporate-grid-portrait-hall",
  "office-random-dude-portrait-hall",
  "Corporate Grid: Portrait Hall",
  1,
);

export const CORPORATE_GRID_MARBLE_GALLERY = corporateGridBeltLevel(
  "corporate-grid-marble-gallery",
  "office-marble-gallery",
  "Corporate Grid: Marble Gallery",
  2,
);

export const BELT_LEVELS: Record<string, BeltLevel> = {
  "sky-carrier": SKY_CARRIER,
  "frost-chasm": FROST_CHASM,
  "verdant-ruin": VERDANT_RUIN,
  "neon-undergrid": NEON_UNDERGRID,
  "ashland-forge": ASHLAND_FORGE,
  "corporate-grid": CORPORATE_GRID_RED_CARPET,
  "corporate-grid-portrait-hall": CORPORATE_GRID_PORTRAIT_HALL,
  "corporate-grid-marble-gallery": CORPORATE_GRID_MARBLE_GALLERY,
};

const BELT_LEVEL_ALIASES: Readonly<Record<string, BeltLevel>> = {
  "corporate-grid-red-carpet": CORPORATE_GRID_RED_CARPET,
  "office-red-carpet-gallery": CORPORATE_GRID_RED_CARPET,
  "office-random-dude-portrait-hall": CORPORATE_GRID_PORTRAIT_HALL,
  "office-marble-gallery": CORPORATE_GRID_MARBLE_GALLERY,
};

/** §36 the belt level ids in menu order — drives the level-select. */
export const BELT_LEVEL_IDS: readonly string[] = Object.keys(BELT_LEVELS);

/** The belt level for an id, defaulting to Sky Carrier. Never undefined. */
export function beltLevelFor(id: string): BeltLevel {
  return BELT_LEVELS[id] ?? BELT_LEVEL_ALIASES[id] ?? SKY_CARRIER;
}
