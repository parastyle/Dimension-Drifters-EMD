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
  EXTRACT_RADIUS,
  MAP_BORDER_TILES,
  MAP_MAX_JUMP_TILES,
  MAP_PIT_MAX,
  MAP_PIT_SPACING_TILES,
  MAP_PIT_TARGET,
  MAP_SPAWN_CLEAR_TILES,
  MAP_TILE,
  PLAYER_GROUND_CONTACT_OFFSET_Y,
  RIFT_OFFSET,
} from "./constants.js";
import type { LavaRoomLayout } from "./lava-prefabs.js";
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

export type ArenaMapSeeds = {
  seedTerrain: number;
  seedHazard: number;
  seedTheme: number;
  seedDecor: number;
};

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
  /** The seeds this map was built from (so consumers can confirm they reproduced the right one). */
  seeds: ArenaMapSeeds;
  /** Per-map hop audit reach. Existing dimensions omit this and retain MAP_MAX_JUMP_TILES exactly. */
  maxJumpTiles?: number;
  /** Present only for the additive native-prefab Lava Foundry dimension. */
  lavaLayout?: LavaRoomLayout;
};

/** The two post-boss choices are one placement contract: both complete discs must be usable and the
 * circles must remain visually/physically distinct after every terrain correction. */
export type ArenaGatePair = Readonly<{
  extractX: number;
  extractY: number;
  riftX: number;
  riftY: number;
  radius: number;
  minSeparation: number;
}>;

/** Extra breathing room beyond two touching gate footprints. */
export const ARENA_GATE_PAIR_GAP = 80;

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

function groundDiscClear(
  tiles: Uint8Array,
  cols: number,
  rows: number,
  tileSize: number,
  cx: number,
  cy: number,
  radius: number,
): boolean {
  const centreCol = Math.floor(cx / tileSize);
  const centreRow = Math.floor(cy / tileSize);
  const tileRadius = Math.ceil(radius / tileSize) + 1;
  for (let dy = -tileRadius; dy <= tileRadius; dy++)
    for (let dx = -tileRadius; dx <= tileRadius; dx++) {
      const col = centreCol + dx;
      const row = centreRow + dy;
      const x0 = col * tileSize;
      const y0 = row * tileSize;
      const nx = Math.max(x0, Math.min(cx, x0 + tileSize)) - cx;
      const ny = Math.max(y0, Math.min(cy, y0 + tileSize)) - cy;
      if (
        nx * nx + ny * ny < radius * radius &&
        (!inBounds(col, row, cols, rows) || tiles[idx(col, row, cols)] !== TILE_GROUND)
      )
        return false;
    }
  return true;
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

  return {
    cols,
    rows,
    tileSize: MAP_TILE,
    tiles,
    zoneIds,
    zoneSeeds,
    spawnX: (spawnCol + 0.5) * MAP_TILE,
    spawnY: (spawnRow + 0.5) * MAP_TILE,
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

/**
 * Player-only pit trigger at the visible ground contact under the upright paper rig. `isPitAtPx` remains
 * exact tile truth for enemies, spawns, recovery searches, and floor rendering; player fall damage samples
 * the feet instead of the torso/root centre so the hazard crosses the painted lip when the character does.
 */
export function isPlayerGroundContactInPit(map: ArenaMap, rootX: number, rootY: number): boolean {
  return isPitAtPx(map, rootX, rootY + PLAYER_GROUND_CONTACT_OFFSET_Y);
}

/** Fraction of the grid that is pit — for tuning + tests. */
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

/** Nudge a spawn position onto solid GROUND so nothing spawns inside a pit and falls on the next tick. */
export function safeSpawnPos(map: ArenaMap, x: number, y: number): { x: number; y: number } {
  return isPitAtPx(map, x, y) ? nearestGroundPx(map, x, y) : { x, y };
}

/** True only when the COMPLETE objective disc lies on ground and inside the arena. Unlike `safeSpawnPos`,
 * this intentionally rejects a ground centre whose rim hangs over a pit. */
export function isArenaDiscSafe(
  map: ArenaMap,
  x: number,
  y: number,
  radius: number,
): boolean {
  return (
    Number.isFinite(x) &&
    Number.isFinite(y) &&
    Number.isFinite(radius) &&
    radius > 0 &&
    groundDiscClear(map.tiles, map.cols, map.rows, map.tileSize, x, y, radius)
  );
}

/** Nearest full-footprint safe ground disc, optionally constrained away from the other gate. Generated
 * maps are navigation-audited, so every accepted tile centre belongs to the spawn-reachable component.
 * The raw point wins when already safe; otherwise row-major tile-centre ties keep the answer deterministic. */
function nearestArenaDisc(
  map: ArenaMap,
  x: number,
  y: number,
  radius: number,
  avoidX = 0,
  avoidY = 0,
  minSeparation = 0,
): { x: number; y: number } {
  const separation2 = minSeparation * minSeparation;
  const separated = (candidateX: number, candidateY: number): boolean => {
    if (minSeparation <= 0) return true;
    const dx = candidateX - avoidX;
    const dy = candidateY - avoidY;
    return dx * dx + dy * dy + 1e-6 >= separation2;
  };
  if (isArenaDiscSafe(map, x, y, radius) && separated(x, y)) return { x, y };

  let bestX = Number.NaN;
  let bestY = Number.NaN;
  let bestDistance2 = Number.POSITIVE_INFINITY;
  for (let row = 0; row < map.rows; row++)
    for (let col = 0; col < map.cols; col++) {
      const candidateX = (col + 0.5) * map.tileSize;
      const candidateY = (row + 0.5) * map.tileSize;
      if (
        !separated(candidateX, candidateY) ||
        !isArenaDiscSafe(map, candidateX, candidateY, radius)
      )
        continue;
      const dx = candidateX - x;
      const dy = candidateY - y;
      const distance2 = dx * dx + dy * dy;
      if (distance2 + 1e-6 >= bestDistance2) continue;
      bestDistance2 = distance2;
      bestX = candidateX;
      bestY = candidateY;
    }
  if (!Number.isFinite(bestX) || !Number.isFinite(bestY))
    throw new Error("arena has no reachable full-footprint gate disc");
  return { x: bestX, y: bestY };
}

/** Joint post-boss gate solver. Extract stays nearest the corpse; the rift prefers the inward bearing at
 * `RIFT_OFFSET`, but every pass applies the real full-disc correction and the pair constraint. Re-solving
 * extract and then rift makes either correction incapable of invalidating the other gate. */
export function placeArenaGatePair(
  map: ArenaMap,
  corpseX: number,
  corpseY: number,
  radius = EXTRACT_RADIUS,
): ArenaGatePair {
  const minSeparation = radius * 2 + ARENA_GATE_PAIR_GAP;
  let extract = nearestArenaDisc(map, corpseX, corpseY, radius);
  let centreX = ARENA_WIDTH / 2 - extract.x;
  let centreY = ARENA_HEIGHT / 2 - extract.y;
  let centreDistance = Math.hypot(centreX, centreY);
  if (centreDistance <= 1e-6) {
    centreX = 0;
    centreY = -1;
    centreDistance = 1;
  }
  let desiredRiftX = extract.x + (centreX / centreDistance) * RIFT_OFFSET;
  let desiredRiftY = extract.y + (centreY / centreDistance) * RIFT_OFFSET;
  let rift = nearestArenaDisc(
    map,
    desiredRiftX,
    desiredRiftY,
    radius,
    extract.x,
    extract.y,
    minSeparation,
  );

  extract = nearestArenaDisc(
    map,
    corpseX,
    corpseY,
    radius,
    rift.x,
    rift.y,
    minSeparation,
  );
  centreX = ARENA_WIDTH / 2 - extract.x;
  centreY = ARENA_HEIGHT / 2 - extract.y;
  centreDistance = Math.hypot(centreX, centreY);
  if (centreDistance <= 1e-6) {
    centreX = 0;
    centreY = -1;
    centreDistance = 1;
  }
  desiredRiftX = extract.x + (centreX / centreDistance) * RIFT_OFFSET;
  desiredRiftY = extract.y + (centreY / centreDistance) * RIFT_OFFSET;
  rift = nearestArenaDisc(
    map,
    desiredRiftX,
    desiredRiftY,
    radius,
    extract.x,
    extract.y,
    minSeparation,
  );
  return {
    extractX: extract.x,
    extractY: extract.y,
    riftX: rift.x,
    riftY: rift.y,
    radius,
    minSeparation,
  };
}

/** Gate-only half of `validateArena`, exposed for the boss-death seam so an already-running arena is not
 * re-rejected for an unrelated generation diagnostic while opening an otherwise valid objective pair. */
export function validateArenaGatePair(
  map: ArenaMap,
  gates: ArenaGatePair,
): { ok: boolean; reason: string } {
  if (!isArenaDiscSafe(map, gates.extractX, gates.extractY, gates.radius))
    return { ok: false, reason: "extract gate is not a reachable full-footprint safe disc" };
  if (!isArenaDiscSafe(map, gates.riftX, gates.riftY, gates.radius))
    return { ok: false, reason: "rift gate is not a reachable full-footprint safe disc" };
  const dx = gates.riftX - gates.extractX;
  const dy = gates.riftY - gates.extractY;
  if (dx * dx + dy * dy + 1e-6 < gates.minSeparation * gates.minSeparation)
    return { ok: false, reason: "extract/rift gate footprints are too close" };
  return { ok: true, reason: "" };
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

/** Navigation proof for the generated arena. All ground cell centres must remain in the spawn component,
 * including exact hops across pit gaps no wider than the shared jump limit. */
export function auditArenaNavigation(map: ArenaMap): ArenaNavigationAudit {
  const total = map.cols * map.rows;
  const passable = new Uint8Array(total);
  let navigableCells = 0;
  for (let row = 0; row < map.rows; row++)
    for (let col = 0; col < map.cols; col++) {
      const cell = idx(col, row, map.cols);
      if (map.tiles[cell] !== TILE_GROUND) continue;
      passable[cell] = 1;
      navigableCells++;
    }
  const spawnCol = Math.floor(map.spawnX / map.tileSize);
  const spawnRow = Math.floor(map.spawnY / map.tileSize);
  const spawn = idx(spawnCol, spawnRow, map.cols);
  if (!passable[spawn])
    return { ok: false, reason: "spawn is blocked by terrain", reachableCells: 0, navigableCells };
  const seen = new Uint8Array(total);
  const stack = [spawn];
  seen[spawn] = 1;
  let reachableCells = 0;
  while (stack.length) {
    const cur = stack.pop() as number;
    reachableCells++;
    const col = cur % map.cols;
    const row = Math.floor(cur / map.cols);
    for (const [dx, dy] of CARDINALS) {
      const walkCol = col + dx;
      const walkRow = row + dy;
      if (inBounds(walkCol, walkRow, map.cols, map.rows)) {
        const walk = idx(walkCol, walkRow, map.cols);
        if (passable[walk] && !seen[walk]) {
          seen[walk] = 1;
          stack.push(walk);
        }
      }
      for (let gap = 1; gap <= (map.maxJumpTiles ?? MAP_MAX_JUMP_TILES); gap++) {
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
  if (map.lavaLayout) {
    return { ok: true, reason: "", reachableCells, navigableCells };
  }
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
  return { ok: true, reason: "", reachableCells, navigableCells };
}

/**
 * Validate the post-conditions a generated map MUST satisfy (used by tests + as a server-side assert):
 * the spawn is ground, every ground tile is reachable from spawn (walk + hop), and the border ring is
 * solid ground. Returns `{ ok, reason }`.
 */
export function validateArena(
  map: ArenaMap,
  gates?: ArenaGatePair,
): { ok: boolean; reason: string } {
  const { tiles, cols, rows } = map;
  if (map.lavaLayout) {
    const spawnCol = Math.floor(map.spawnX / map.tileSize);
    const spawnRow = Math.floor(map.spawnY / map.tileSize);
    if (tiles[idx(spawnCol, spawnRow, cols)] !== TILE_GROUND)
      return { ok: false, reason: "spawn tile is not ground" };
    const navigation = auditArenaNavigation(map);
    if (!navigation.ok) return { ok: false, reason: navigation.reason };
    if (gates) return validateArenaGatePair(map, gates);
    return { ok: true, reason: "" };
  }
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
  if (gates) {
    const gateValidation = validateArenaGatePair(map, gates);
    if (!gateValidation.ok) return gateValidation;
  }
  return { ok: true, reason: "" };
}
