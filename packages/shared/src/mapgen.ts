/**
 * §17 procedural arena generation — PURE + DETERMINISTIC.
 *
 * The server mints four seed scalars at room create and syncs them on `ArenaState`; both server and
 * client call `generateArena` with those seeds and get a BYTE-IDENTICAL tile map (no tile streaming).
 *
 * Recipe (the research verdict — "build the hazard, not the platformer"):
 *   1. scatter PIT seed sites with min-spacing (Poisson-disc-ish) so hazards spread, not clump;
 *   2. grow each into an organic blob;
 *   3. cellular-automata smooth for natural edges;
 *   4. force GROUND where the game needs it (a central spawn disc + a border ring);
 *   5. VALIDATE + REPAIR: guarantee every ground tile is reachable from spawn by walking + hopping pit
 *      gaps no wider than the jump reach — anything stranded behind a too-wide pit is bridged with ground
 *      (or, if it's a tiny nub, dissolved into the pit). The post-condition is GUARANTEED on return.
 *
 * Phase 0 (this module) produces + guarantees the grid. Rendering the pits, pit collision, and the
 * fall→chip+reposition rule are the §17 Phase 1+ follow-ups; they consume this map read-only.
 */
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  MAP_BORDER_TILES,
  MAP_MAX_JUMP_TILES,
  MAP_PIT_MAX,
  MAP_PIT_SPACING_TILES,
  MAP_PIT_TARGET,
  MAP_POI_COUNT,
  MAP_POI_GAP,
  MAP_POI_GROUND_CLEARANCE,
  MAP_POI_RADIUS,
  MAP_POI_SPACING_TILES,
  MAP_POI_SPAWN_CLEAR_TILES,
  MAP_SPAWN_CLEAR_TILES,
  MAP_TILE,
  PLAYER_RADIUS,
} from "./constants.js";
import { makeRng, mixSeeds, type Rng } from "./rng.js";

/** Tile kinds (Phase 0 is binary: walkable vs hazard). Walls/decor/themes come in later §17 phases. */
export const TILE_GROUND = 0;
export const TILE_PIT = 1;

/** Static macro-geography. These ids are structural across every dimension; only the active palette/art
 * changes client-side. V1 deliberately has exactly two authored terrain exchanges plus neutral ground. */
export const MAP_ZONE_COMMONS = 0;
export const MAP_ZONE_COVER = 1;
export const MAP_ZONE_SCAR = 2;
export const MAP_ZONE_COUNT = 3;
export type MapZoneId =
  | typeof MAP_ZONE_COMMONS
  | typeof MAP_ZONE_COVER
  | typeof MAP_ZONE_SCAR;
export type MapZoneKind = "commons" | "cover" | "scar";

export type MapZoneSeed = Readonly<{
  id: MapZoneId;
  kind: MapZoneKind;
  col: number;
  row: number;
}>;

export type PoiCluster = Readonly<{
  id: number;
  x: number;
  y: number;
  zoneId: MapZoneId;
  /** Shared placement phase for the cluster's satellite ring. Cosmetic code may read it, never replace it. */
  phase: number;
}>;

export type ArenaMapSeeds = {
  seedTerrain: number;
  seedHazard: number;
  seedTheme: number;
  seedDecor: number;
};

/** A §17 POI landmark placed in the arena — world px + a `kind` index the client maps to a sprite. */
export type PoiInstance = { x: number; y: number; kind: number; clusterId: number };

export type ArenaMap = {
  /** Grid dimensions in tiles + the px size of one tile. */
  cols: number;
  rows: number;
  tileSize: number;
  /** Row-major tile grid (`cols*rows`), each cell `TILE_GROUND` or `TILE_PIT`. */
  tiles: Uint8Array;
  /** Row-major static macro-geography, regenerated from the same synced seeds on server and client. */
  zoneIds: Uint8Array;
  /** Debug/label anchors only. `zoneIds` is the exact footprint truth. */
  zoneSeeds: MapZoneSeed[];
  /** Guaranteed-ground spawn point, in WORLD px (centre of the arena). */
  spawnX: number;
  spawnY: number;
  /** §17 collidable landmark structures (cover + orientation), placed deterministically on ground. */
  pois: PoiInstance[];
  /** Authoritative macro-cluster anchors used by shared POI placement. */
  poiClusters: PoiCluster[];
  /** The seeds this map was built from (so consumers can confirm they reproduced the right one). */
  seeds: ArenaMapSeeds;
};

const idx = (x: number, y: number, cols: number): number => y * cols + x;
const inBounds = (x: number, y: number, cols: number, rows: number): boolean =>
  x >= 0 && y >= 0 && x < cols && y < rows;
const CARDINALS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

const ZONE_SALT = 0x5a0e1701;
const ZONE_LATTICE = 6;
const ZONE_WARP_FIXED = 576; // 2.25 cells in 8-bit fixed point
const ZONE_COMMONS_CORE_TILES = 5;
const ZONE_MIN_AREA_FRAC = 0.08;

function zoneKind(id: MapZoneId): MapZoneKind {
  if (id === MAP_ZONE_COVER) return "cover";
  if (id === MAP_ZONE_SCAR) return "scar";
  return "commons";
}

function signedLatticeHash(seed: number, x: number, y: number, salt: number): number {
  return (mixSeeds(seed, x, y, salt) & 0xffff) - 0x8000;
}

/** Bilinear low-frequency displacement in 8-bit fixed point. Integer interpolation keeps the footprint
 * byte-identical across server/client engines and avoids variable-cadence random draws per cell. */
function zoneWarpAt(seed: number, col: number, row: number, salt: number): number {
  const lx = Math.floor(col / ZONE_LATTICE);
  const ly = Math.floor(row / ZONE_LATTICE);
  const fx = Math.floor(((col % ZONE_LATTICE) * 256) / ZONE_LATTICE);
  const fy = Math.floor(((row % ZONE_LATTICE) * 256) / ZONE_LATTICE);
  const a = signedLatticeHash(seed, lx, ly, salt);
  const b = signedLatticeHash(seed, lx + 1, ly, salt);
  const c = signedLatticeHash(seed, lx, ly + 1, salt);
  const d = signedLatticeHash(seed, lx + 1, ly + 1, salt);
  const top = Math.trunc((a * (256 - fx) + b * fx) / 256);
  const bottom = Math.trunc((c * (256 - fx) + d * fx) / 256);
  const value = Math.trunc((top * (256 - fy) + bottom * fy) / 256);
  return Math.trunc((value * ZONE_WARP_FIXED) / 0x8000);
}

function zoneComponentSize(
  zoneIds: Uint8Array,
  cols: number,
  rows: number,
  start: number,
  zoneId: MapZoneId,
): number {
  if (zoneIds[start] !== zoneId) return 0;
  const seen = new Uint8Array(zoneIds.length);
  const stack = [start];
  seen[start] = 1;
  let size = 0;
  while (stack.length) {
    const cur = stack.pop() as number;
    size++;
    const cx = cur % cols;
    const cy = Math.floor(cur / cols);
    for (const [dx, dy] of CARDINALS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!inBounds(nx, ny, cols, rows)) continue;
      const ni = idx(nx, ny, cols);
      if (!seen[ni] && zoneIds[ni] === zoneId) {
        seen[ni] = 1;
        stack.push(ni);
      }
    }
  }
  return size;
}

function zoneLayoutValid(
  zoneIds: Uint8Array,
  seeds: readonly MapZoneSeed[],
  cols: number,
  rows: number,
): boolean {
  if (seeds.length !== MAP_ZONE_COUNT || zoneIds.length !== cols * rows) return false;
  const counts = new Int32Array(MAP_ZONE_COUNT);
  for (const zoneId of zoneIds) {
    if (zoneId >= MAP_ZONE_COUNT) return false;
    counts[zoneId] = (counts[zoneId] ?? 0) + 1;
  }
  const minArea = Math.floor(zoneIds.length * ZONE_MIN_AREA_FRAC);
  for (const seed of seeds) {
    const site = idx(seed.col, seed.row, cols);
    if (zoneIds[site] !== seed.id || (counts[seed.id] ?? 0) < minArea) return false;
    if (zoneComponentSize(zoneIds, cols, rows, site, seed.id) !== counts[seed.id]) return false;
  }
  return true;
}

function buildZoneAttempt(
  source: ArenaMapSeeds,
  cols: number,
  rows: number,
  attempt: number,
  warped: boolean,
): { zoneIds: Uint8Array; zoneSeeds: MapZoneSeed[] } {
  const rng = makeRng(mixSeeds(source.seedTerrain, source.seedTheme, ZONE_SALT, attempt));
  const centreCol = Math.floor(cols / 2);
  const centreRow = Math.floor(rows / 2);
  const baseAngle = rng.range(0, Math.PI * 2);
  const firstRadius = rng.range(17, 21);
  const secondRadius = rng.range(17, 21);
  const secondAngle = baseAngle + Math.PI + rng.range(-0.3, 0.3);
  const firstId = rng.chance(0.5) ? MAP_ZONE_COVER : MAP_ZONE_SCAR;
  const secondId = firstId === MAP_ZONE_COVER ? MAP_ZONE_SCAR : MAP_ZONE_COVER;
  const clampSite = (value: number, extent: number) =>
    Math.max(MAP_BORDER_TILES + 5, Math.min(extent - MAP_BORDER_TILES - 6, Math.round(value)));
  const outer = [
    {
      id: firstId,
      col: clampSite(centreCol + Math.cos(baseAngle) * firstRadius, cols),
      row: clampSite(centreRow + Math.sin(baseAngle) * firstRadius, rows),
    },
    {
      id: secondId,
      col: clampSite(centreCol + Math.cos(secondAngle) * secondRadius, cols),
      row: clampSite(centreRow + Math.sin(secondAngle) * secondRadius, rows),
    },
  ] as const;
  const zoneSeeds: MapZoneSeed[] = [
    { id: MAP_ZONE_COMMONS, kind: "commons", col: centreCol, row: centreRow },
    ...outer
      .map((site) => ({ ...site, kind: zoneKind(site.id) }))
      .sort((a, b) => a.id - b.id),
  ];
  const zoneIds = new Uint8Array(cols * rows);
  const warpSeed = mixSeeds(source.seedTerrain, source.seedTheme, ZONE_SALT, attempt, 0x0a11);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const coreDx = col - centreCol;
      const coreDy = row - centreRow;
      if (coreDx * coreDx + coreDy * coreDy <= ZONE_COMMONS_CORE_TILES ** 2) {
        zoneIds[idx(col, row, cols)] = MAP_ZONE_COMMONS;
        continue;
      }
      const sx = col * 256 + (warped ? zoneWarpAt(warpSeed, col, row, 0x581) : 0);
      const sy = row * 256 + (warped ? zoneWarpAt(warpSeed, col, row, 0xa73) : 0);
      let bestId = MAP_ZONE_COMMONS as MapZoneId;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (const site of zoneSeeds) {
        const dx = sx - site.col * 256;
        const dy = sy - site.row * 256;
        const distance = dx * dx + dy * dy;
        if (distance < bestDistance || (distance === bestDistance && site.id < bestId)) {
          bestDistance = distance;
          bestId = site.id;
        }
      }
      zoneIds[idx(col, row, cols)] = bestId;
    }
  }
  return { zoneIds, zoneSeeds };
}

/** Build one exact static geography grid before any terrain/cover pass consumes it. */
function generateMapZones(
  source: ArenaMapSeeds,
  cols: number,
  rows: number,
): { zoneIds: Uint8Array; zoneSeeds: MapZoneSeed[] } {
  for (let attempt = 0; attempt < 4; attempt++) {
    const layout = buildZoneAttempt(source, cols, rows, attempt, true);
    if (zoneLayoutValid(layout.zoneIds, layout.zoneSeeds, cols, rows)) return layout;
  }
  // Bounded deterministic fallback: keep the seeded compass deal but remove the displacement field.
  const fallback = buildZoneAttempt(source, cols, rows, 4, false);
  if (zoneLayoutValid(fallback.zoneIds, fallback.zoneSeeds, cols, rows)) return fallback;
  // The symmetric final layout is construction-safe for the fixed 60x60 arena and retains seeded rotation.
  return buildZoneAttempt(source, cols, rows, 5, false);
}

/** Clamp to the nearest map cell; static geography extends visually to the arena rail. */
export function zoneAtTile(map: ArenaMap, col: number, row: number): MapZoneId {
  const x = Math.max(0, Math.min(map.cols - 1, Math.floor(col)));
  const y = Math.max(0, Math.min(map.rows - 1, Math.floor(row)));
  return (map.zoneIds[idx(x, y, map.cols)] ?? MAP_ZONE_COMMONS) as MapZoneId;
}

export function zoneAtPx(map: ArenaMap, x: number, y: number): MapZoneId {
  return zoneAtTile(map, x / map.tileSize, y / map.tileSize);
}

/** Scatter pit seed sites with a minimum spacing (rejection-sampled Poisson-disc). Deterministic. */
function pitSites(
  rng: Rng,
  cols: number,
  rows: number,
  target: number,
  zoneIds: Uint8Array,
): Array<[number, number]> {
  const sites: Array<[number, number]> = [];
  // Roughly one site per (target-scaled) area; each grows into a blob downstream. The divisor is the
  // MEASURED per-blob footprint (~20 cells at radius 2–3 AFTER the two dilating smooth() passes —
  // calibrated empirically over 2000 seeds so real coverage lands on the target, not 25% above it).
  const wanted = Math.max(4, Math.round((cols * rows * target) / 20));
  const attempts = wanted * 48;
  for (let a = 0; a < attempts && sites.length < wanted; a++) {
    const x = rng.int(MAP_BORDER_TILES + 1, cols - MAP_BORDER_TILES - 2);
    const y = rng.int(MAP_BORDER_TILES + 1, rows - MAP_BORDER_TILES - 2);
    const acceptanceRoll = rng.next();
    const zoneId = (zoneIds[idx(x, y, cols)] ?? MAP_ZONE_COMMONS) as MapZoneId;
    const acceptance =
      zoneId === MAP_ZONE_SCAR ? 1 : zoneId === MAP_ZONE_COVER ? 0.2 : 0.42;
    if (acceptanceRoll >= acceptance) continue;
    const spacing =
      zoneId === MAP_ZONE_SCAR ? 4 : zoneId === MAP_ZONE_COVER ? 9 : MAP_PIT_SPACING_TILES + 1;
    let ok = true;
    for (const [sx, sy] of sites) {
      const dx = sx - x;
      const dy = sy - y;
      const otherZone = (zoneIds[idx(sx, sy, cols)] ?? MAP_ZONE_COMMONS) as MapZoneId;
      const otherSpacing =
        otherZone === MAP_ZONE_SCAR
          ? 4
          : otherZone === MAP_ZONE_COVER
            ? 9
            : MAP_PIT_SPACING_TILES + 1;
      const need = Math.min(spacing, otherSpacing);
      if (dx * dx + dy * dy < need * need) {
        ok = false;
        break;
      }
    }
    if (ok) sites.push([x, y]);
  }
  return sites;
}

/** Grow a site into an organic pit blob: a jittered disc with probabilistic falloff toward the edge.
 *  v0.102: radius 2–3 (was 1–2) — fewer, GRANDER pit features that read as deliberate terrain, not noise. */
function growBlob(
  tiles: Uint8Array,
  cols: number,
  rows: number,
  cx: number,
  cy: number,
  rng: Rng,
): void {
  const r = rng.int(2, 3);
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (!inBounds(x, y, cols, rows)) continue;
      const dist = Math.hypot(dx, dy);
      if (dist > r + 0.5) continue;
      // Solid core, ragged rim: outer cells get carved only sometimes.
      if (dist <= r - 0.5 || rng.chance(1 - (dist - (r - 0.5)))) tiles[idx(x, y, cols)] = TILE_PIT;
    }
  }
}

/** One cellular-automata smoothing pass: a cell flips toward the majority of its 8 neighbours, so blob
 *  edges read as organic coastline rather than pixel noise. Border cells are left for the force-ground pass. */
function smooth(tiles: Uint8Array, cols: number, rows: number): void {
  const next = tiles.slice();
  for (let y = 1; y < rows - 1; y++) {
    for (let x = 1; x < cols - 1; x++) {
      let pit = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          if (tiles[idx(x + dx, y + dy, cols)] === TILE_PIT) pit++;
        }
      const i = idx(x, y, cols);
      if (pit >= 5) next[i] = TILE_PIT;
      else if (pit <= 2) next[i] = TILE_GROUND;
    }
  }
  tiles.set(next);
}

/** Count of pit tiles. */
function pitCount(tiles: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < tiles.length; i++) if (tiles[i] === TILE_PIT) n++;
  return n;
}

/** One erosion pass: flip rim pit cells (those with few pit neighbours) back to ground. Shrinks blobs
 *  from their edges to pull total coverage down under the ceiling without erasing whole hazards. */
function erode(tiles: Uint8Array, cols: number, rows: number): void {
  const next = tiles.slice();
  for (let y = 1; y < rows - 1; y++) {
    for (let x = 1; x < cols - 1; x++) {
      const i = idx(x, y, cols);
      if (tiles[i] !== TILE_PIT) continue;
      let pit = 0;
      for (const [dx, dy] of CARDINALS) if (tiles[idx(x + dx, y + dy, cols)] === TILE_PIT) pit++;
      if (pit <= 2) next[i] = TILE_GROUND; // an edge/spur cell → ground
    }
  }
  tiles.set(next);
}

/** Force a solid GROUND border ring + a clear GROUND spawn disc at the centre. */
function forceGround(
  tiles: Uint8Array,
  cols: number,
  rows: number,
  spawnX: number,
  spawnY: number,
): void {
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      const onBorder =
        x < MAP_BORDER_TILES ||
        y < MAP_BORDER_TILES ||
        x >= cols - MAP_BORDER_TILES ||
        y >= rows - MAP_BORDER_TILES;
      const inSpawn = Math.hypot(x - spawnX, y - spawnY) <= MAP_SPAWN_CLEAR_TILES;
      if (onBorder || inSpawn) tiles[idx(x, y, cols)] = TILE_GROUND;
    }
}

/**
 * Tiles reachable from `start` by WALKING (4-dir ground steps) or HOPPING a straight pit gap of up to
 * `MAP_MAX_JUMP_TILES` cells (all intermediate cells pit, landing cell ground). This is the connectivity
 * the player actually has once the jump (§5) is wired to clear pits.
 */
function reachable(tiles: Uint8Array, cols: number, rows: number, start: number): Uint8Array {
  const seen = new Uint8Array(cols * rows);
  if (tiles[start] !== TILE_GROUND) return seen;
  const stack = [start];
  seen[start] = 1;
  while (stack.length) {
    const cur = stack.pop() as number;
    const cx = cur % cols;
    const cy = (cur / cols) | 0;
    for (const [dx, dy] of CARDINALS) {
      // Walk one ground step.
      const wx = cx + dx;
      const wy = cy + dy;
      if (inBounds(wx, wy, cols, rows)) {
        const wi = idx(wx, wy, cols);
        if (tiles[wi] === TILE_GROUND && !seen[wi]) {
          seen[wi] = 1;
          stack.push(wi);
        }
      }
      // Hop a gap of g pit cells, landing on ground at g+1.
      for (let g = 1; g <= MAP_MAX_JUMP_TILES; g++) {
        const mx = cx + dx * g;
        const my = cy + dy * g;
        if (!inBounds(mx, my, cols, rows) || tiles[idx(mx, my, cols)] !== TILE_PIT) break; // gap broke → no hop
        const lx = cx + dx * (g + 1);
        const ly = cy + dy * (g + 1);
        if (!inBounds(lx, ly, cols, rows)) continue;
        const li = idx(lx, ly, cols);
        if (tiles[li] === TILE_GROUND && !seen[li]) {
          seen[li] = 1;
          stack.push(li);
        }
      }
    }
  }
  return seen;
}

/** The 4-connected GROUND component containing `start` (a stranded island, when start is unreachable). */
function groundComponent(tiles: Uint8Array, cols: number, rows: number, start: number): number[] {
  const out: number[] = [];
  const seen = new Uint8Array(cols * rows);
  const stack = [start];
  seen[start] = 1;
  while (stack.length) {
    const cur = stack.pop() as number;
    out.push(cur);
    const cx = cur % cols;
    const cy = (cur / cols) | 0;
    for (const [dx, dy] of CARDINALS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!inBounds(nx, ny, cols, rows)) continue;
      const ni = idx(nx, ny, cols);
      if (tiles[ni] === TILE_GROUND && !seen[ni]) {
        seen[ni] = 1;
        stack.push(ni);
      }
    }
  }
  return out;
}

/** Carve a 4-connected GROUND corridor from a stranded tile to the nearest reached ground tile (BFS over
 *  all cells, shortest hop count), converting the pit cells on the path. Connects the island by WALKING. */
function carveBridge(
  tiles: Uint8Array,
  cols: number,
  rows: number,
  from: number,
  reached: Uint8Array,
): boolean {
  const prev = new Int32Array(cols * rows).fill(-1);
  const seen = new Uint8Array(cols * rows);
  const q = [from];
  seen[from] = 1;
  let head = 0;
  let found = -1;
  while (head < q.length) {
    const cur = q[head++] as number;
    if (cur !== from && tiles[cur] === TILE_GROUND && reached[cur]) {
      found = cur;
      break;
    }
    const cx = cur % cols;
    const cy = (cur / cols) | 0;
    for (const [dx, dy] of CARDINALS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!inBounds(nx, ny, cols, rows)) continue;
      const ni = idx(nx, ny, cols);
      if (!seen[ni]) {
        seen[ni] = 1;
        prev[ni] = cur;
        q.push(ni);
      }
    }
  }
  if (found < 0) return false;
  for (let node = found; node !== -1 && node !== from; node = prev[node] as number) {
    tiles[node] = TILE_GROUND;
  }
  return true;
}

/**
 * Guarantee the post-condition: EVERY ground tile is reachable from spawn (walk + hop). Bridges stranded
 * regions with ground, dissolves tiny nubs into the pit, and — as a final backstop — flips anything still
 * unreachable to pit. Pure + bounded (each step strictly reduces the unreached set).
 */
function ensureConnected(tiles: Uint8Array, cols: number, rows: number, spawn: number): void {
  const NUB = 3; // a stranded island this small is just dissolved into the pit
  const maxRepairs = cols * rows; // far more than ever needed; the set strictly shrinks each pass
  for (let r = 0; r < maxRepairs; r++) {
    const reached = reachable(tiles, cols, rows, spawn);
    let target = -1;
    for (let i = 0; i < tiles.length; i++) {
      if (tiles[i] === TILE_GROUND && !reached[i]) {
        target = i;
        break;
      }
    }
    if (target < 0) return; // fully connected
    const region = groundComponent(tiles, cols, rows, target);
    if (region.length <= NUB || !carveBridge(tiles, cols, rows, target, reached)) {
      for (const i of region) tiles[i] = TILE_PIT; // remove (nub, or unbridgeable)
    }
  }
  // Backstop (should never fire): flip any residual unreachable ground to pit.
  const reached = reachable(tiles, cols, rows, spawn);
  for (let i = 0; i < tiles.length; i++)
    if (tiles[i] === TILE_GROUND && !reached[i]) tiles[i] = TILE_PIT;
}

/**
 * §17 per-landmark SIZE CLASS, derived deterministically from `kind` so server collision + client visual
 * always agree (both sides call this — no sync needed). Distribution over kind%7: three M (the everyday
 * blocker), two L, one XL (a genuinely building-sized landmark), one S (scrub/boulder accent). "Bigger
 * clipping obstacles" (v0.102): the collision footprint scales with the class AND the client derives the
 * sprite's visual scale FROM the collision radius, so what blocks you is what you see (WYSIWYG).
 */
export function poiScale(kind: number): number {
  const c = ((kind % 7) + 7) % 7;
  if (c === 6) return 0.8; // S — scrub / boulder
  if (c === 5) return 1.9; // XL — the landmark you navigate BY
  if (c >= 3) return 1.45; // L
  return 1.0; // M (c 0..2)
}

/** §17 a landmark's collision radius (px) — the M-class base scaled by its size class. */
export function poiRadius(kind: number): number {
  return MAP_POI_RADIUS * poiScale(kind);
}

export type PoiCollisionCircle = Readonly<{ x: number; y: number; radius: number }>;

/** Shared WYSIWYG footprint. S/M landmarks retain the familiar circle; L/XL structures use an overlapping
 * three-circle base whose union reads as a broad building/skirt without inventing walk-through arches.
 * The union stays inside `poiRadius(kind)`, so the existing placement gap remains a conservative bound. */
export function poiCollisionCircles(poi: PoiInstance): readonly PoiCollisionCircle[] {
  const outer = poiRadius(poi.kind);
  if (poiScale(poi.kind) < 1.45) return [{ x: poi.x, y: poi.y, radius: outer }];
  const centreRadius = outer * (poiScale(poi.kind) >= 1.9 ? 0.7 : 0.66);
  const sideRadius = outer * (poiScale(poi.kind) >= 1.9 ? 0.52 : 0.5);
  const offset = outer - sideRadius;
  return [
    { x: poi.x, y: poi.y, radius: centreRadius },
    { x: poi.x - offset, y: poi.y, radius: sideRadius },
    { x: poi.x + offset, y: poi.y, radius: sideRadius },
  ];
}

export type PoiCollisionHit = Readonly<{ poi: PoiInstance; circle: PoiCollisionCircle }>;

/** Exact compound-circle containing test, including the child circle needed for a correct carom normal. */
export function poiCollisionAt(map: ArenaMap, x: number, y: number): PoiCollisionHit | undefined {
  for (const poi of map.pois) {
    for (const circle of poiCollisionCircles(poi)) {
      const dx = x - circle.x;
      const dy = y - circle.y;
      if (dx * dx + dy * dy < circle.radius * circle.radius) return { poi, circle };
    }
  }
  return undefined;
}

function pointOverlapsPoi(
  pois: readonly PoiInstance[],
  x: number,
  y: number,
  radius: number,
): boolean {
  for (const poi of pois)
    for (const circle of poiCollisionCircles(poi)) {
      const reach = circle.radius + radius;
      const dx = x - circle.x;
      const dy = y - circle.y;
      if (dx * dx + dy * dy < reach * reach - 1e-6) return true;
    }
  return false;
}

function distanceToSegmentSquared(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const length2 = dx * dx + dy * dy;
  const t =
    length2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length2)) : 0;
  const qx = ax + dx * t;
  const qy = ay + dy * t;
  return (px - qx) ** 2 + (py - qy) ** 2;
}

function segmentClearsPoiFootprints(
  pois: readonly PoiInstance[],
  ax: number,
  ay: number,
  bx: number,
  by: number,
  bodyRadius: number,
): boolean {
  for (const poi of pois)
    for (const circle of poiCollisionCircles(poi)) {
      const reach = circle.radius + bodyRadius;
      if (distanceToSegmentSquared(circle.x, circle.y, ax, ay, bx, by) < reach * reach) return false;
    }
  return true;
}

/** The size-class deal order: the c-value (kind%7) each successive landmark is FORCED to, cycling. An iid
 *  roll made XL a lottery (4% of maps had zero "landmark you navigate BY"); dealing from a fixed cycle
 *  guarantees every map the same S/M/L/XL mix (per 7: 1×XL, 3×M, 2×L, 1×S) while the art stays random. */
const POI_CLASS_CYCLE = [5, 0, 3, 1, 6, 4, 2] as const; // XL, M, L, M, S, L, M

/** Place §17 POI landmarks: rejection-sample GROUND tiles, spread out (pairwise radius-aware spacing with
 *  a guaranteed walking gap) + clear of the spawn disc + the landmark's whole footprint AND a
 *  `MAP_POI_GROUND_CLEARANCE` ring on solid ground — the ring is where resolvePoiCollision parks pushed-out
 *  bodies (centre at r+bodyRadius), so without it an XL on a pit lip shoves players/enemies into the void.
 *  Deterministic (its own seed stream; all distance rejects compare SQUARED distances — Math.hypot is
 *  implementation-approximated per ECMA-262, sqrt/mul are correctly rounded, so this stays engine-exact).
 *  Each landmark's size class is dealt from POI_CLASS_CYCLE; the art roll stays random via the kind. */
function placePoisLegacy(
  tiles: Uint8Array,
  cols: number,
  rows: number,
  spawnCol: number,
  spawnRow: number,
  rng: Rng,
): PoiInstance[] {
  const pois: PoiInstance[] = [];
  const floorPx = MAP_POI_SPACING_TILES * MAP_TILE; // legacy tile floor — the radius-aware rule usually exceeds it
  const attempts = MAP_POI_COUNT * 60;
  const groundAt = (gx: number, gy: number): boolean =>
    inBounds(gx, gy, cols, rows) && tiles[idx(gx, gy, cols)] === TILE_GROUND;
  for (let a = 0; a < attempts && pois.length < MAP_POI_COUNT; a++) {
    const tx = rng.int(MAP_BORDER_TILES + 1, cols - MAP_BORDER_TILES - 2);
    const ty = rng.int(MAP_BORDER_TILES + 1, rows - MAP_BORDER_TILES - 2);
    const roll = rng.int(0, 999); // draw BEFORE any reject so the RNG cadence stays fixed per attempt
    // Deal the size class from the cycle (keyed by how many landmarks are already placed); keep the roll's
    // entropy in the upper bits for the client's art pick.
    const cls = POI_CLASS_CYCLE[pois.length % POI_CLASS_CYCLE.length] as number;
    const kind = roll - (roll % 7) + cls;
    if (tiles[idx(tx, ty, cols)] !== TILE_GROUND) continue; // stand on solid ground
    const cx = (tx + 0.5) * MAP_TILE;
    const cy = (ty + 0.5) * MAP_TILE;
    const r = poiRadius(kind);
    // Spawn clearance scales with the landmark's own footprint so an XL can't loom over the safe disc.
    const spawnNeed = MAP_POI_SPAWN_CLEAR_TILES * MAP_TILE + r;
    const sdx = (tx - spawnCol) * MAP_TILE;
    const sdy = (ty - spawnRow) * MAP_TILE;
    if (sdx * sdx + sdy * sdy <= spawnNeed * spawnNeed) continue;
    // The collision footprint PLUS the push-out clearance ring must sit on ground — check every tile that
    // disc overlaps (proper circle-vs-tile-rect test: nearest point on the tile's rect to the centre;
    // a centre-only check misses edge-clipped tiles).
    const guard = r + MAP_POI_GROUND_CLEARANCE;
    const rt = Math.ceil(guard / MAP_TILE) + 1;
    let footprintOk = true;
    for (let dy = -rt; dy <= rt && footprintOk; dy++)
      for (let dx = -rt; dx <= rt && footprintOk; dx++) {
        const x0 = (tx + dx) * MAP_TILE;
        const y0 = (ty + dy) * MAP_TILE;
        const nx = Math.max(x0, Math.min(cx, x0 + MAP_TILE)) - cx;
        const ny = Math.max(y0, Math.min(cy, y0 + MAP_TILE)) - cy;
        if (nx * nx + ny * ny < guard * guard && !groundAt(tx + dx, ty + dy)) footprintOk = false;
      }
    if (!footprintOk) continue;
    // Pairwise spacing: both footprints + a guaranteed walking gap (or the legacy tile floor if larger).
    const spaced = pois.every((p) => {
      const need = Math.max(floorPx, r + poiRadius(p.kind) + MAP_POI_GAP);
      const dx = p.x - cx;
      const dy = p.y - cy;
      return dx * dx + dy * dy >= need * need;
    });
    if (!spaced) continue;
    pois.push({ x: cx, y: cy, kind, clusterId: -1 });
  }
  return pois;
}

/** Generate the arena for a set of seeds. PURE: same seeds → byte-identical map, on any machine. */
function zoneInteriorAt(
  zoneIds: Uint8Array,
  cols: number,
  rows: number,
  col: number,
  row: number,
  zoneId: MapZoneId,
): boolean {
  if (!inBounds(col, row, cols, rows) || zoneIds[idx(col, row, cols)] !== zoneId) return false;
  for (const [dx, dy] of CARDINALS) {
    const x = col + dx * 2;
    const y = row + dy * 2;
    if (!inBounds(x, y, cols, rows) || zoneIds[idx(x, y, cols)] !== zoneId) return false;
  }
  return true;
}

function groundDiscClear(
  tiles: Uint8Array,
  cols: number,
  rows: number,
  cx: number,
  cy: number,
  radius: number,
): boolean {
  const centreCol = Math.floor(cx / MAP_TILE);
  const centreRow = Math.floor(cy / MAP_TILE);
  const tileRadius = Math.ceil(radius / MAP_TILE) + 1;
  for (let dy = -tileRadius; dy <= tileRadius; dy++)
    for (let dx = -tileRadius; dx <= tileRadius; dx++) {
      const col = centreCol + dx;
      const row = centreRow + dy;
      const x0 = col * MAP_TILE;
      const y0 = row * MAP_TILE;
      const nx = Math.max(x0, Math.min(cx, x0 + MAP_TILE)) - cx;
      const ny = Math.max(y0, Math.min(cy, y0 + MAP_TILE)) - cy;
      if (
        nx * nx + ny * ny < radius * radius &&
        (!inBounds(col, row, cols, rows) || tiles[idx(col, row, cols)] !== TILE_GROUND)
      )
        return false;
    }
  return true;
}

function satelliteCourtCount(
  tiles: Uint8Array,
  zoneIds: Uint8Array,
  cols: number,
  rows: number,
  cx: number,
  cy: number,
  zoneId: MapZoneId,
  apron: number,
): number {
  let count = 0;
  for (let step = 0; step < 24; step++) {
    const angle = (step / 24) * Math.PI * 2;
    const x = (Math.floor((cx + Math.cos(angle) * MAP_TILE * 5) / MAP_TILE) + 0.5) * MAP_TILE;
    const y = (Math.floor((cy + Math.sin(angle) * MAP_TILE * 5) / MAP_TILE) + 0.5) * MAP_TILE;
    const col = Math.floor(x / MAP_TILE);
    const row = Math.floor(y / MAP_TILE);
    if (!inBounds(col, row, cols, rows) || zoneIds[idx(col, row, cols)] !== zoneId) continue;
    if (groundDiscClear(tiles, cols, rows, x, y, apron)) count++;
  }
  return count;
}

function placePoiClusters(
  tiles: Uint8Array,
  zoneIds: Uint8Array,
  cols: number,
  rows: number,
  spawnCol: number,
  spawnRow: number,
  rng: Rng,
): PoiCluster[] {
  const desired: MapZoneId[] = [
    MAP_ZONE_COVER,
    MAP_ZONE_COVER,
    MAP_ZONE_COVER,
    MAP_ZONE_COVER,
    MAP_ZONE_COVER,
    MAP_ZONE_SCAR,
  ];
  for (let i = desired.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    const swap = desired[i] as MapZoneId;
    desired[i] = desired[j] as MapZoneId;
    desired[j] = swap;
  }
  const anchors: PoiCluster[] = [];
  const minAnchorSpacing = 9 * MAP_TILE;
  const anchorApron = MAP_POI_RADIUS * 1.9 + MAP_POI_GROUND_CLEARANCE;
  for (const desiredZone of desired) {
    let accepted: PoiCluster | undefined;
    for (let attempt = 0; attempt < 420; attempt++) {
      const tx = rng.int(MAP_BORDER_TILES + 3, cols - MAP_BORDER_TILES - 4);
      const ty = rng.int(MAP_BORDER_TILES + 3, rows - MAP_BORDER_TILES - 4);
      const phase = rng.range(0, Math.PI * 2);
      if (tiles[idx(tx, ty, cols)] !== TILE_GROUND) continue;
      if (!zoneInteriorAt(zoneIds, cols, rows, tx, ty, desiredZone)) continue;
      const spawnDx = (tx - spawnCol) * MAP_TILE;
      const spawnDy = (ty - spawnRow) * MAP_TILE;
      if (spawnDx * spawnDx + spawnDy * spawnDy < (7 * MAP_TILE) ** 2) continue;
      const x = (tx + 0.5) * MAP_TILE;
      const y = (ty + 0.5) * MAP_TILE;
      if (!groundDiscClear(tiles, cols, rows, x, y, anchorApron)) continue;
      if (
        desiredZone === MAP_ZONE_SCAR &&
        satelliteCourtCount(tiles, zoneIds, cols, rows, x, y, desiredZone, anchorApron) < 2
      )
        continue;
      if (anchors.some((anchor) => (anchor.x - x) ** 2 + (anchor.y - y) ** 2 < minAnchorSpacing ** 2))
        continue;
      accepted = { id: anchors.length, x, y, zoneId: desiredZone, phase };
      break;
    }
    if (!accepted) {
      let bestScore = Number.NEGATIVE_INFINITY;
      for (let ty = MAP_BORDER_TILES + 3; ty < rows - MAP_BORDER_TILES - 3; ty++) {
        for (let tx = MAP_BORDER_TILES + 3; tx < cols - MAP_BORDER_TILES - 3; tx++) {
          if (tiles[idx(tx, ty, cols)] !== TILE_GROUND) continue;
          if (!zoneInteriorAt(zoneIds, cols, rows, tx, ty, desiredZone)) continue;
          const spawnDx = (tx - spawnCol) * MAP_TILE;
          const spawnDy = (ty - spawnRow) * MAP_TILE;
          if (spawnDx * spawnDx + spawnDy * spawnDy < (7 * MAP_TILE) ** 2) continue;
          const x = (tx + 0.5) * MAP_TILE;
          const y = (ty + 0.5) * MAP_TILE;
          if (!groundDiscClear(tiles, cols, rows, x, y, anchorApron)) continue;
          if (
            desiredZone === MAP_ZONE_SCAR &&
            satelliteCourtCount(tiles, zoneIds, cols, rows, x, y, desiredZone, anchorApron) < 2
          )
            continue;
          let score = spawnDx * spawnDx + spawnDy * spawnDy;
          for (const anchor of anchors)
            score = Math.min(score, (anchor.x - x) ** 2 + (anchor.y - y) ** 2);
          if (score <= bestScore) continue;
          bestScore = score;
          accepted = {
            id: anchors.length,
            x,
            y,
            zoneId: desiredZone,
            phase: (mixSeeds(tx, ty, desiredZone, 0xc1157e) / 0x100000000) * Math.PI * 2,
          };
        }
      }
    }
    if (accepted) anchors.push(accepted);
  }
  return anchors.map((anchor, id) => ({ ...anchor, id }));
}

/** Place authoritative landmark macro-clusters. Cover receives four courts, Commons one sparse navigation
 * cluster, and Scar one small claim: global count/class budget stays fixed while geography becomes legible. */
function placePois(
  tiles: Uint8Array,
  zoneIds: Uint8Array,
  cols: number,
  rows: number,
  spawnCol: number,
  spawnRow: number,
  rng: Rng,
): { pois: PoiInstance[]; clusters: PoiCluster[] } {
  const clusters = placePoiClusters(tiles, zoneIds, cols, rows, spawnCol, spawnRow, rng);
  const pois: PoiInstance[] = [];
  if (clusters.length === 0) return { pois, clusters };
  const counts = new Int16Array(clusters.length);
  const quotas = clusters.map((cluster) => (cluster.zoneId === MAP_ZONE_SCAR ? 3 : 5));
  const floorPx = MAP_POI_SPACING_TILES * MAP_TILE;
  const attempts = MAP_POI_COUNT * 180;
  const groundAt = (gx: number, gy: number): boolean =>
    inBounds(gx, gy, cols, rows) && tiles[idx(gx, gy, cols)] === TILE_GROUND;
  for (let a = 0; a < attempts && pois.length < MAP_POI_COUNT; a++) {
    let minimum = Number.POSITIVE_INFINITY;
    for (let i = 0; i < clusters.length; i++)
      if ((counts[i] ?? 0) < (quotas[i] ?? 0)) minimum = Math.min(minimum, counts[i] ?? 0);
    const eligibleClusters: number[] = [];
    for (let i = 0; i < clusters.length; i++)
      if ((counts[i] ?? 0) === minimum && (counts[i] ?? 0) < (quotas[i] ?? 0))
        eligibleClusters.push(i);
    const clusterIndex = eligibleClusters[a % Math.max(1, eligibleClusters.length)] ?? 0;
    const cluster = clusters[clusterIndex];
    const quota = quotas[clusterIndex] ?? 0;
    const placed = counts[clusterIndex] ?? 0;
    const roll = rng.int(0, 999);
    const angleJitter = rng.range(-Math.PI, Math.PI);
    const distanceRoll = rng.next();
    const centreAngle = rng.range(0, Math.PI * 2);
    const centreDistance = rng.range(0, MAP_TILE * 0.7);
    const zoneAcceptanceRoll = rng.next();
    if (!cluster || placed >= quota) continue;
    const cls = POI_CLASS_CYCLE[pois.length % POI_CLASS_CYCLE.length] as number;
    const kind = roll - (roll % 7) + cls;
    const satelliteCount = Math.max(1, quota - 1);
    const angle =
      placed === 0
        ? centreAngle
        : cluster.phase + ((placed - 1) / satelliteCount) * Math.PI * 2 + angleJitter;
    const distance = placed === 0 ? 0 : MAP_TILE * (4.2 + distanceRoll * 9.8);
    const rawX = cluster.x + Math.cos(angle) * distance;
    const rawY = cluster.y + Math.sin(angle) * distance;
    const tx = Math.floor(rawX / MAP_TILE);
    const ty = Math.floor(rawY / MAP_TILE);
    const cx = (tx + 0.5) * MAP_TILE;
    const cy = (ty + 0.5) * MAP_TILE;
    if (!inBounds(tx, ty, cols, rows) || tiles[idx(tx, ty, cols)] !== TILE_GROUND) continue;
    const candidateZone = (zoneIds[idx(tx, ty, cols)] ?? MAP_ZONE_COMMONS) as MapZoneId;
    const zoneAcceptance =
      candidateZone === cluster.zoneId
        ? 1
        : candidateZone === MAP_ZONE_SCAR
          ? 0.14
          : candidateZone === MAP_ZONE_COMMONS
            ? 0.45
            : 0.7;
    if (zoneAcceptanceRoll >= zoneAcceptance) continue;
    const r = poiRadius(kind);
    const spawnNeed = MAP_POI_SPAWN_CLEAR_TILES * MAP_TILE + r;
    const sdx = cx - (spawnCol + 0.5) * MAP_TILE;
    const sdy = cy - (spawnRow + 0.5) * MAP_TILE;
    if (sdx * sdx + sdy * sdy <= spawnNeed * spawnNeed) continue;
    const guard = r + MAP_POI_GROUND_CLEARANCE;
    const rt = Math.ceil(guard / MAP_TILE) + 1;
    let footprintOk = true;
    for (let dy = -rt; dy <= rt && footprintOk; dy++)
      for (let dx = -rt; dx <= rt && footprintOk; dx++) {
        const x0 = (tx + dx) * MAP_TILE;
        const y0 = (ty + dy) * MAP_TILE;
        const nx = Math.max(x0, Math.min(cx, x0 + MAP_TILE)) - cx;
        const ny = Math.max(y0, Math.min(cy, y0 + MAP_TILE)) - cy;
        if (nx * nx + ny * ny < guard * guard && !groundAt(tx + dx, ty + dy)) footprintOk = false;
      }
    if (!footprintOk) continue;
    const spaced = pois.every((poi) => {
      const need = Math.max(floorPx, r + poiRadius(poi.kind) + MAP_POI_GAP);
      return (poi.x - cx) ** 2 + (poi.y - cy) ** 2 >= need * need;
    });
    if (!spaced) continue;
    pois.push({ x: cx, y: cy, kind, clusterId: cluster.id });
    counts[clusterIndex] = (counts[clusterIndex] ?? 0) + 1;
  }
  // If terrain/spacing exhausts a satellite court before the global landmark budget is dealt, finish with
  // zone-biased ground candidates and attach each to its nearest non-full macro anchor. This preserves the
  // 3-6 member cluster contract while avoiding a seed-dependent POI-count collapse.
  for (let attempt = 0; attempt < MAP_POI_COUNT * 240 && pois.length < MAP_POI_COUNT; attempt++) {
    const tx = rng.int(MAP_BORDER_TILES + 1, cols - MAP_BORDER_TILES - 2);
    const ty = rng.int(MAP_BORDER_TILES + 1, rows - MAP_BORDER_TILES - 2);
    const roll = rng.int(0, 999);
    const acceptanceRoll = rng.next();
    const candidateZone = (zoneIds[idx(tx, ty, cols)] ?? MAP_ZONE_COMMONS) as MapZoneId;
    const acceptance =
      candidateZone === MAP_ZONE_COVER ? 1 : candidateZone === MAP_ZONE_COMMONS ? 0.38 : 0.12;
    if (acceptanceRoll >= acceptance || tiles[idx(tx, ty, cols)] !== TILE_GROUND) continue;
    const cls = POI_CLASS_CYCLE[pois.length % POI_CLASS_CYCLE.length] as number;
    const kind = roll - (roll % 7) + cls;
    const cx = (tx + 0.5) * MAP_TILE;
    const cy = (ty + 0.5) * MAP_TILE;
    const r = poiRadius(kind);
    const spawnNeed = MAP_POI_SPAWN_CLEAR_TILES * MAP_TILE + r;
    const sdx = cx - (spawnCol + 0.5) * MAP_TILE;
    const sdy = cy - (spawnRow + 0.5) * MAP_TILE;
    if (sdx * sdx + sdy * sdy <= spawnNeed * spawnNeed) continue;
    if (!groundDiscClear(tiles, cols, rows, cx, cy, r + MAP_POI_GROUND_CLEARANCE)) continue;
    const spaced = pois.every((poi) => {
      const need = Math.max(floorPx, r + poiRadius(poi.kind) + MAP_POI_GAP);
      return (poi.x - cx) ** 2 + (poi.y - cy) ** 2 >= need * need;
    });
    if (!spaced) continue;
    let clusterIndex = -1;
    let clusterDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < clusters.length; i++) {
      if ((counts[i] ?? 0) >= 6) continue;
      const cluster = clusters[i];
      if (!cluster) continue;
      const distance2 = (cluster.x - cx) ** 2 + (cluster.y - cy) ** 2;
      if (distance2 < clusterDistance) {
        clusterDistance = distance2;
        clusterIndex = i;
      }
    }
    const cluster = clusters[clusterIndex];
    if (!cluster) continue;
    pois.push({ x: cx, y: cy, kind, clusterId: cluster.id });
    counts[clusterIndex] = (counts[clusterIndex] ?? 0) + 1;
  }
  return { pois, clusters };
}

export function generateArena(seeds: ArenaMapSeeds): ArenaMap {
  const cols = Math.floor(ARENA_WIDTH / MAP_TILE);
  const rows = Math.floor(ARENA_HEIGHT / MAP_TILE);
  const tiles = new Uint8Array(cols * rows); // all TILE_GROUND (0)
  const spawnCol = Math.floor(cols / 2);
  const spawnRow = Math.floor(rows / 2);
  const { zoneIds, zoneSeeds } = generateMapZones(seeds, cols, rows);

  // Hazard pass — its own stream so tuning terrain elsewhere won't reshuffle pits.
  const hz = makeRng(mixSeeds(seeds.seedHazard, seeds.seedTerrain, 0x1701));
  for (const [sx, sy] of pitSites(hz, cols, rows, MAP_PIT_TARGET, zoneIds))
    growBlob(tiles, cols, rows, sx, sy, hz);
  smooth(tiles, cols, rows);
  smooth(tiles, cols, rows);
  // Clamp coverage under the ceiling: erode rim cells until pits are a hazard, not the whole floor.
  const cap = Math.floor(cols * rows * MAP_PIT_MAX);
  for (let g = 0; g < 8 && pitCount(tiles) > cap; g++) erode(tiles, cols, rows);
  forceGround(tiles, cols, rows, spawnCol, spawnRow);
  ensureConnected(tiles, cols, rows, idx(spawnCol, spawnRow, cols));

  // POI landmarks — its own seed stream so tuning pits/decor won't reshuffle them.
  const poiRng = makeRng(mixSeeds(seeds.seedTheme, seeds.seedDecor, 0x9011));
  const { pois, clusters: poiClusters } = placePois(
    tiles,
    zoneIds,
    cols,
    rows,
    spawnCol,
    spawnRow,
    poiRng,
  );

  return {
    cols,
    rows,
    tileSize: MAP_TILE,
    tiles,
    zoneIds,
    zoneSeeds,
    spawnX: (spawnCol + 0.5) * MAP_TILE,
    spawnY: (spawnRow + 0.5) * MAP_TILE,
    pois,
    poiClusters,
    seeds: { ...seeds },
  };
}

/** Read the tile kind at a WORLD px position (out-of-bounds reads as ground — the border ring guards it). */
export function tileAtPx(map: ArenaMap, px: number, py: number): number {
  const x = Math.floor(px / map.tileSize);
  const y = Math.floor(py / map.tileSize);
  if (!inBounds(x, y, map.cols, map.rows)) return TILE_GROUND;
  return map.tiles[idx(x, y, map.cols)] as number;
}

/** True if a world px position is over a pit (§17 — fall trigger, once collision is wired in Phase 1). */
export function isPitAtPx(map: ArenaMap, px: number, py: number): boolean {
  return tileAtPx(map, px, py) === TILE_PIT;
}

/** §17 the POI whose obstacle footprint contains a world px point, or undefined. Radius is per-landmark
 *  (size classes — `poiRadius(kind)`). PURE. */
export function poiAt(map: ArenaMap, x: number, y: number): PoiInstance | undefined {
  return poiCollisionAt(map, x, y)?.poi;
}

/** §17 true if a world px point is inside a POI obstacle (the landmark footprint) — projectiles blocked
 *  here so the landmarks are real cover from gunfire. PURE. */
export function isInsidePoi(map: ArenaMap, x: number, y: number): boolean {
  return poiAt(map, x, y) !== undefined;
}

/** §17 push an entity (centre x,y + body radius) OUT of any overlapping POI obstacle, returning the
 *  corrected position. Radii are per-landmark (size classes); placement guarantees a walking gap between
 *  footprints, but a push-out CAN nudge a body toward a neighbour, so resolve against every POI (a second
 *  pass settles the rare double-touch — bounded, deterministic). PURE. */
function resolvePoiCollisionLegacy(
  map: ArenaMap,
  x: number,
  y: number,
  radius: number,
): { x: number; y: number } {
  let nx = x;
  let ny = y;
  for (let pass = 0; pass < 2; pass++) {
    let touched = false;
    for (const p of map.pois) {
      const min = poiRadius(p.kind) + radius;
      const dx = nx - p.x;
      const dy = ny - p.y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= min * min) continue;
      touched = true;
      const d = Math.sqrt(d2);
      if (d < 1e-4) {
        nx = p.x;
        ny = p.y - min; // dead centre → pop straight out
      } else {
        nx = p.x + (dx / d) * min;
        ny = p.y + (dy / d) * min;
      }
    }
    if (!touched) break;
  }
  return { x: nx, y: ny };
}

/** Fraction of the grid that is pit — for tuning + tests. */
export function resolvePoiCollision(
  map: ArenaMap,
  x: number,
  y: number,
  radius: number,
): { x: number; y: number } {
  let nx = x;
  let ny = y;
  // Overlapping child circles need more than the old two-circle passes, but the set is tiny (at most 84).
  // Sequential projection converges outward because every child stays inside the conservative placement disc.
  for (let pass = 0; pass < 10; pass++) {
    let touched = false;
    for (const poi of map.pois) {
      for (const circle of poiCollisionCircles(poi)) {
        const reach = circle.radius + radius;
        const dx = nx - circle.x;
        const dy = ny - circle.y;
        const distance2 = dx * dx + dy * dy;
        if (distance2 >= reach * reach) continue;
        touched = true;
        const distance = Math.sqrt(distance2);
        if (distance < 1e-4) {
          nx = circle.x;
          ny = circle.y - reach;
        } else {
          nx = circle.x + (dx / distance) * reach;
          ny = circle.y + (dy / distance) * reach;
        }
      }
    }
    if (!touched) break;
  }
  return { x: nx, y: ny };
}

export function pitFraction(map: ArenaMap): number {
  let pit = 0;
  for (let i = 0; i < map.tiles.length; i++) if (map.tiles[i] === TILE_PIT) pit++;
  return pit / map.tiles.length;
}

/** Nearest GROUND tile centre (world px) to a point — BFS over the grid, so it returns the closest safe
 *  tile by step distance. Used to snap a fallen player/enemy/drop back onto solid ground (the border ring
 *  is always ground, so this never fails). */
export function nearestGroundPx(map: ArenaMap, px: number, py: number): { x: number; y: number } {
  const { tiles, cols, rows, tileSize } = map;
  const sx = Math.max(0, Math.min(cols - 1, Math.floor(px / tileSize)));
  const sy = Math.max(0, Math.min(rows - 1, Math.floor(py / tileSize)));
  const start = idx(sx, sy, cols);
  const center = (x: number, y: number) => ({ x: (x + 0.5) * tileSize, y: (y + 0.5) * tileSize });
  if (tiles[start] === TILE_GROUND) return center(sx, sy);
  const seen = new Uint8Array(cols * rows);
  const q = [start];
  seen[start] = 1;
  let head = 0;
  while (head < q.length) {
    const cur = q[head++] as number;
    const cx = cur % cols;
    const cy = (cur / cols) | 0;
    if (tiles[cur] === TILE_GROUND) return center(cx, cy);
    for (const [dx, dy] of CARDINALS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (inBounds(nx, ny, cols, rows)) {
        const ni = idx(nx, ny, cols);
        if (!seen[ni]) {
          seen[ni] = 1;
          q.push(ni);
        }
      }
    }
  }
  return center(Math.floor(cols / 2), Math.floor(rows / 2)); // unreachable (border is ground)
}

/** §17 nudge a spawn position onto solid GROUND and OUT of any POI obstacle, so nothing spawns inside a
 *  pit or a landmark and then teleports out on the next tick. Pure — the server's spawn paths + the
 *  unit tests share it. */
export function safeSpawnPos(
  map: ArenaMap,
  x: number,
  y: number,
  radius: number,
): { x: number; y: number } {
  let nx = x;
  let ny = y;
  // Two settle rounds: pit-snap can land inside a POI's (all-ground) footprint, and a POI push-out could in
  // principle end over a pit — placement's MAP_POI_GROUND_CLEARANCE ring makes that near-impossible, but
  // this stays correct even if a future body outgrows the ring. Round 2 re-checks both; bounded + pure.
  for (let round = 0; round < 2; round++) {
    if (isPitAtPx(map, nx, ny)) {
      const g = nearestGroundPx(map, nx, ny);
      nx = g.x;
      ny = g.y;
    }
    const safe = resolvePoiCollision(map, nx, ny, radius);
    nx = safe.x;
    ny = safe.y;
    if (!isPitAtPx(map, nx, ny) && !pointOverlapsPoi(map.pois, nx, ny, radius)) break;
  }
  return { x: nx, y: ny };
}

export type PitClassification = {
  /** Per-cell region id (−1 for ground). */
  regionOf: Int16Array;
  /** Per region: is its narrowest span ≤ the jump reach (so a player can HOP across it somewhere)? Drives
   *  the cosmetic rim telegraph — a thin solid lip ("hop me") vs the full chevron treatment ("go around"). */
  hoppable: boolean[];
};

/** Group pit cells into 4-connected regions and flag each as hoppable (narrow enough to clear with a jump).
 *  Purely cosmetic — feeds the §17 rim's width-keyed danger vocabulary. */
export function classifyPitRegions(map: ArenaMap): PitClassification {
  const { tiles, cols, rows } = map;
  const regionOf = new Int16Array(cols * rows).fill(-1);
  const hoppable: boolean[] = [];
  let id = 0;
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] !== TILE_PIT || regionOf[i] !== -1) continue;
    const stack = [i];
    regionOf[i] = id;
    let minX = cols;
    let maxX = 0;
    let minY = rows;
    let maxY = 0;
    while (stack.length) {
      const cur = stack.pop() as number;
      const cx = cur % cols;
      const cy = (cur / cols) | 0;
      if (cx < minX) minX = cx;
      if (cx > maxX) maxX = cx;
      if (cy < minY) minY = cy;
      if (cy > maxY) maxY = cy;
      for (const [dx, dy] of CARDINALS) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (inBounds(nx, ny, cols, rows)) {
          const ni = idx(nx, ny, cols);
          if (tiles[ni] === TILE_PIT && regionOf[ni] === -1) {
            regionOf[ni] = id;
            stack.push(ni);
          }
        }
      }
    }
    hoppable[id] = Math.min(maxX - minX + 1, maxY - minY + 1) <= MAP_MAX_JUMP_TILES;
    id++;
  }
  return { regionOf, hoppable };
}

export type ArenaNavigationAudit = Readonly<{
  ok: boolean;
  reason: string;
  reachableCells: number;
  navigableCells: number;
}>;

/** Collision-aware navigation proof for the generated arena. The grid uses actual player radius, exact pit
 * hops, and every compound POI child. It is intentionally stricter than AI steering: all navigable cell
 * centres must remain in the spawn component, so no cluster can make a sealed pocket or wall off a zone. */
export function auditArenaNavigation(
  map: ArenaMap,
  bodyRadius = PLAYER_RADIUS,
): ArenaNavigationAudit {
  const total = map.cols * map.rows;
  const passable = new Uint8Array(total);
  let navigableCells = 0;
  for (let row = 0; row < map.rows; row++)
    for (let col = 0; col < map.cols; col++) {
      const cell = idx(col, row, map.cols);
      if (map.tiles[cell] !== TILE_GROUND) continue;
      const x = (col + 0.5) * map.tileSize;
      const y = (row + 0.5) * map.tileSize;
      if (pointOverlapsPoi(map.pois, x, y, bodyRadius)) continue;
      passable[cell] = 1;
      navigableCells++;
    }
  const spawnCol = Math.floor(map.spawnX / map.tileSize);
  const spawnRow = Math.floor(map.spawnY / map.tileSize);
  const spawn = idx(spawnCol, spawnRow, map.cols);
  if (!passable[spawn])
    return { ok: false, reason: "spawn is blocked by terrain or a POI", reachableCells: 0, navigableCells };
  const seen = new Uint8Array(total);
  const stack = [spawn];
  seen[spawn] = 1;
  let reachableCells = 0;
  while (stack.length) {
    const cur = stack.pop() as number;
    reachableCells++;
    const col = cur % map.cols;
    const row = Math.floor(cur / map.cols);
    const ax = (col + 0.5) * map.tileSize;
    const ay = (row + 0.5) * map.tileSize;
    for (const [dx, dy] of CARDINALS) {
      const walkCol = col + dx;
      const walkRow = row + dy;
      if (inBounds(walkCol, walkRow, map.cols, map.rows)) {
        const walk = idx(walkCol, walkRow, map.cols);
        const bx = (walkCol + 0.5) * map.tileSize;
        const by = (walkRow + 0.5) * map.tileSize;
        if (
          passable[walk] &&
          !seen[walk] &&
          segmentClearsPoiFootprints(map.pois, ax, ay, bx, by, bodyRadius)
        ) {
          seen[walk] = 1;
          stack.push(walk);
        }
      }
      for (let gap = 1; gap <= MAP_MAX_JUMP_TILES; gap++) {
        const pitCol = col + dx * gap;
        const pitRow = row + dy * gap;
        if (
          !inBounds(pitCol, pitRow, map.cols, map.rows) ||
          map.tiles[idx(pitCol, pitRow, map.cols)] !== TILE_PIT
        )
          break;
        const landCol = col + dx * (gap + 1);
        const landRow = row + dy * (gap + 1);
        if (!inBounds(landCol, landRow, map.cols, map.rows)) continue;
        const land = idx(landCol, landRow, map.cols);
        if (!passable[land] || seen[land]) continue;
        const bx = (landCol + 0.5) * map.tileSize;
        const by = (landRow + 0.5) * map.tileSize;
        if (!segmentClearsPoiFootprints(map.pois, ax, ay, bx, by, bodyRadius)) continue;
        seen[land] = 1;
        stack.push(land);
      }
    }
  }
  if (reachableCells !== navigableCells)
    return {
      ok: false,
      reason: `${navigableCells - reachableCells} navigable cells are sealed from spawn`,
      reachableCells,
      navigableCells,
    };
  const reachedByZone = new Uint8Array(MAP_ZONE_COUNT);
  for (let i = 0; i < total; i++) if (seen[i]) reachedByZone[map.zoneIds[i] ?? MAP_ZONE_COMMONS] = 1;
  for (let zoneId = 0; zoneId < MAP_ZONE_COUNT; zoneId++)
    if (!reachedByZone[zoneId])
      return {
        ok: false,
        reason: `zone ${zoneId} has no player-radius route from Commons`,
        reachableCells,
        navigableCells,
      };
  for (const cluster of map.poiClusters) {
    let approached = false;
    const reach = MAP_TILE * 3;
    for (let i = 0; i < total && !approached; i++) {
      if (!seen[i]) continue;
      const x = ((i % map.cols) + 0.5) * map.tileSize;
      const y = (Math.floor(i / map.cols) + 0.5) * map.tileSize;
      approached = (x - cluster.x) ** 2 + (y - cluster.y) ** 2 <= reach * reach;
    }
    if (!approached)
      return {
        ok: false,
        reason: `POI cluster ${cluster.id} has no reachable approach`,
        reachableCells,
        navigableCells,
      };
  }
  return { ok: true, reason: "", reachableCells, navigableCells };
}

/**
 * Validate the post-conditions a generated map MUST satisfy (used by tests + as a server-side assert):
 * the spawn is ground, every ground tile is reachable from spawn (walk + hop), and the border ring is
 * solid ground. Returns `{ ok, reason }`.
 */
export function validateArena(map: ArenaMap): { ok: boolean; reason: string } {
  const { tiles, cols, rows } = map;
  if (!zoneLayoutValid(map.zoneIds, map.zoneSeeds, cols, rows))
    return { ok: false, reason: "invalid/disconnected map-zone layout" };
  const centreCol = Math.floor(cols / 2);
  const centreRow = Math.floor(rows / 2);
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++) {
      const dx = col - centreCol;
      const dy = row - centreRow;
      if (
        dx * dx + dy * dy <= ZONE_COMMONS_CORE_TILES ** 2 &&
        map.zoneIds[idx(col, row, cols)] !== MAP_ZONE_COMMONS
      )
        return { ok: false, reason: "Commons does not own the central identity core" };
    }
  if (map.poiClusters.length !== 6) return { ok: false, reason: "expected six POI macro-clusters" };
  const clusterMembers = new Int16Array(map.poiClusters.length);
  for (const poi of map.pois) {
    const cluster = map.poiClusters[poi.clusterId];
    if (!cluster) return { ok: false, reason: "POI has an invalid cluster id" };
    clusterMembers[poi.clusterId] = (clusterMembers[poi.clusterId] ?? 0) + 1;
  }
  for (let clusterId = 0; clusterId < clusterMembers.length; clusterId++)
    if ((clusterMembers[clusterId] ?? 0) < 3)
      return { ok: false, reason: `POI cluster ${clusterId} has fewer than three landmarks` };
  const spawn = idx(Math.floor(cols / 2), Math.floor(rows / 2), cols);
  if (tiles[spawn] !== TILE_GROUND) return { ok: false, reason: "spawn tile is not ground" };
  for (let x = 0; x < cols; x++) {
    if (tiles[idx(x, 0, cols)] !== TILE_GROUND || tiles[idx(x, rows - 1, cols)] !== TILE_GROUND)
      return { ok: false, reason: "border ring has a pit" };
  }
  for (let y = 0; y < rows; y++) {
    if (tiles[idx(0, y, cols)] !== TILE_GROUND || tiles[idx(cols - 1, y, cols)] !== TILE_GROUND)
      return { ok: false, reason: "border ring has a pit" };
  }
  const reached = reachable(tiles, cols, rows, spawn);
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] === TILE_GROUND && !reached[i])
      return { ok: false, reason: `ground tile ${i} stranded` };
  }
  const navigation = auditArenaNavigation(map);
  if (!navigation.ok) return { ok: false, reason: navigation.reason };
  return { ok: true, reason: "" };
}
