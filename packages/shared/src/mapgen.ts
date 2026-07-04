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
} from "./constants.js";
import { makeRng, mixSeeds, type Rng } from "./rng.js";

/** Tile kinds (Phase 0 is binary: walkable vs hazard). Walls/decor/themes come in later §17 phases. */
export const TILE_GROUND = 0;
export const TILE_PIT = 1;

export type ArenaMapSeeds = {
  seedTerrain: number;
  seedHazard: number;
  seedTheme: number;
  seedDecor: number;
};

/** A §17 POI landmark placed in the arena — world px + a `kind` index the client maps to a sprite. */
export type PoiInstance = { x: number; y: number; kind: number };

export type ArenaMap = {
  /** Grid dimensions in tiles + the px size of one tile. */
  cols: number;
  rows: number;
  tileSize: number;
  /** Row-major tile grid (`cols*rows`), each cell `TILE_GROUND` or `TILE_PIT`. */
  tiles: Uint8Array;
  /** Guaranteed-ground spawn point, in WORLD px (centre of the arena). */
  spawnX: number;
  spawnY: number;
  /** §17 collidable landmark structures (cover + orientation), placed deterministically on ground. */
  pois: PoiInstance[];
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

/** Scatter pit seed sites with a minimum spacing (rejection-sampled Poisson-disc). Deterministic. */
function pitSites(rng: Rng, cols: number, rows: number, target: number): Array<[number, number]> {
  const sites: Array<[number, number]> = [];
  const spacing2 = MAP_PIT_SPACING_TILES * MAP_PIT_SPACING_TILES;
  // Roughly one site per (target-scaled) area; each grows into a blob downstream. The divisor is the
  // MEASURED per-blob footprint (~20 cells at radius 2–3 AFTER the two dilating smooth() passes —
  // calibrated empirically over 2000 seeds so real coverage lands on the target, not 25% above it).
  const wanted = Math.max(4, Math.round((cols * rows * target) / 20));
  const attempts = wanted * 12;
  for (let a = 0; a < attempts && sites.length < wanted; a++) {
    const x = rng.int(MAP_BORDER_TILES + 1, cols - MAP_BORDER_TILES - 2);
    const y = rng.int(MAP_BORDER_TILES + 1, rows - MAP_BORDER_TILES - 2);
    let ok = true;
    for (const [sx, sy] of sites) {
      const dx = sx - x;
      const dy = sy - y;
      if (dx * dx + dy * dy < spacing2) {
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
function placePois(
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
    pois.push({ x: cx, y: cy, kind });
  }
  return pois;
}

/** Generate the arena for a set of seeds. PURE: same seeds → byte-identical map, on any machine. */
export function generateArena(seeds: ArenaMapSeeds): ArenaMap {
  const cols = Math.floor(ARENA_WIDTH / MAP_TILE);
  const rows = Math.floor(ARENA_HEIGHT / MAP_TILE);
  const tiles = new Uint8Array(cols * rows); // all TILE_GROUND (0)
  const spawnCol = Math.floor(cols / 2);
  const spawnRow = Math.floor(rows / 2);

  // Hazard pass — its own stream so tuning terrain elsewhere won't reshuffle pits.
  const hz = makeRng(mixSeeds(seeds.seedHazard, seeds.seedTerrain, 0x1701));
  for (const [sx, sy] of pitSites(hz, cols, rows, MAP_PIT_TARGET))
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
  const pois = placePois(tiles, cols, rows, spawnCol, spawnRow, poiRng);

  return {
    cols,
    rows,
    tileSize: MAP_TILE,
    tiles,
    spawnX: (spawnCol + 0.5) * MAP_TILE,
    spawnY: (spawnRow + 0.5) * MAP_TILE,
    pois,
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
  for (const p of map.pois) {
    const r = poiRadius(p.kind);
    const dx = x - p.x;
    const dy = y - p.y;
    if (dx * dx + dy * dy < r * r) return p;
  }
  return undefined;
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
export function resolvePoiCollision(
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
    if (isInsidePoi(map, nx, ny)) {
      const safe = resolvePoiCollision(map, nx, ny, radius);
      nx = safe.x;
      ny = safe.y;
    }
    if (!isPitAtPx(map, nx, ny) && !isInsidePoi(map, nx, ny)) break; // settled
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

/**
 * Validate the post-conditions a generated map MUST satisfy (used by tests + as a server-side assert):
 * the spawn is ground, every ground tile is reachable from spawn (walk + hop), and the border ring is
 * solid ground. Returns `{ ok, reason }`.
 */
export function validateArena(map: ArenaMap): { ok: boolean; reason: string } {
  const { tiles, cols, rows } = map;
  const spawn = idx(Math.floor(cols / 2), Math.floor(rows / 2), cols);
  if (tiles[spawn] !== TILE_GROUND) return { ok: false, reason: "spawn tile is not ground" };
  for (let x = 0; x < cols; x++) {
    if (tiles[idx(x, 0, cols)] !== TILE_GROUND || tiles[idx(x, rows - 1, cols)] !== TILE_GROUND)
      return { ok: false, reason: "border ring has a pit" };
  }
  const reached = reachable(tiles, cols, rows, spawn);
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] === TILE_GROUND && !reached[i])
      return { ok: false, reason: `ground tile ${i} stranded` };
  }
  return { ok: true, reason: "" };
}
