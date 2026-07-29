/** §17 procedural arena generation — pure, deterministic, and continuously walkable. */
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  EXTRACT_RADIUS,
  MAP_BORDER_TILES,
  MAP_TILE,
  PLAYER_GROUND_CONTACT_OFFSET_Y,
  PLAYER_RADIUS,
  RIFT_OFFSET,
} from "./constants.js";
import type { LavaRoomLayout } from "./lava-prefabs.js";
import { makeRng, mixSeeds } from "./rng.js";

/** Ordinary arenas contain only ground. */
export const TILE_GROUND = 0;
export const TILE_LAVA_GAP = 1;
/** Compatibility name retained only because the locked lava generator imports it directly. */
export const TILE_PIT = TILE_LAVA_GAP;

/** Static macro-geography. These ids are structural across every dimension; only the active palette/art
 * changes client-side. V1 deliberately has exactly two authored terrain exchanges plus neutral ground. */
export const MAP_ZONE_COMMONS = 0;
export const MAP_ZONE_COVER = 1;
export const MAP_ZONE_SCAR = 2;
export const MAP_ZONE_COUNT = 3;
export type MapZoneId = typeof MAP_ZONE_COMMONS | typeof MAP_ZONE_COVER | typeof MAP_ZONE_SCAR;
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
  /** Row-major walkability grid. Ordinary arenas contain only `TILE_GROUND`. */
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
  /** Lava-only gap audit reach. */
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
/** Macro-zone ownership has no collision or rendering edge, so sample it at 160px and expand to the
 * 80px gameplay grid. This preserves two-tile boundary fidelity while avoiding expensive noise hashes
 * at every one of the 230,400 gameplay cells. */
const ZONE_SAMPLE_SCALE_TILES = 2;

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
  gameplayTilesPerSample = 1,
): { zoneIds: Uint8Array; zoneSeeds: MapZoneSeed[] } {
  const rng = makeRng(mixSeeds(source.seedTerrain, source.seedTheme, ZONE_SALT, attempt));
  const centreCol = Math.floor(cols / 2);
  const centreRow = Math.floor(rows / 2);
  const minExtent = Math.min(cols, rows);
  const baseAngle = rng.range(0, Math.PI * 2);
  // Preserve the authored 60x60 compass deal as proportions at every arena size.
  const firstRadius = rng.range((minExtent * 17) / 60, (minExtent * 21) / 60);
  const secondRadius = rng.range((minExtent * 17) / 60, (minExtent * 21) / 60);
  const secondAngle = baseAngle + Math.PI + rng.range(-0.3, 0.3);
  const firstId = rng.chance(0.5) ? MAP_ZONE_COVER : MAP_ZONE_SCAR;
  const secondId = firstId === MAP_ZONE_COVER ? MAP_ZONE_SCAR : MAP_ZONE_COVER;
  const sampleBorder = Math.ceil(MAP_BORDER_TILES / gameplayTilesPerSample);
  const siteInset = Math.ceil(5 / gameplayTilesPerSample);
  const clampSite = (value: number, extent: number) =>
    Math.max(
      sampleBorder + siteInset,
      Math.min(extent - sampleBorder - siteInset - 1, Math.round(value)),
    );
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
    ...outer.map((site) => ({ ...site, kind: zoneKind(site.id) })).sort((a, b) => a.id - b.id),
  ];
  const zoneIds = new Uint8Array(cols * rows);
  const warpSeed = mixSeeds(source.seedTerrain, source.seedTheme, ZONE_SALT, attempt, 0x0a11);
  const commonsCoreSamples = Math.ceil(ZONE_COMMONS_CORE_TILES / gameplayTilesPerSample);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const coreDx = col - centreCol;
      const coreDy = row - centreRow;
      if (coreDx * coreDx + coreDy * coreDy <= commonsCoreSamples ** 2) {
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
  const sampleScale = ZONE_SAMPLE_SCALE_TILES;
  const sampleCols = Math.ceil(cols / sampleScale);
  const sampleRows = Math.ceil(rows / sampleScale);
  let sampled: { zoneIds: Uint8Array; zoneSeeds: MapZoneSeed[] } | undefined;
  for (let attempt = 0; attempt < 4; attempt++) {
    const layout = buildZoneAttempt(source, sampleCols, sampleRows, attempt, true, sampleScale);
    if (zoneLayoutValid(layout.zoneIds, layout.zoneSeeds, sampleCols, sampleRows)) {
      sampled = layout;
      break;
    }
  }
  if (!sampled) {
    // Bounded deterministic fallback: keep the seeded compass deal but remove the displacement field.
    const fallback = buildZoneAttempt(source, sampleCols, sampleRows, 4, false, sampleScale);
    sampled = zoneLayoutValid(fallback.zoneIds, fallback.zoneSeeds, sampleCols, sampleRows)
      ? fallback
      : buildZoneAttempt(source, sampleCols, sampleRows, 5, false, sampleScale);
  }

  const zoneIds = new Uint8Array(cols * rows);
  for (let row = 0; row < rows; row++) {
    const sampledRow = Math.min(sampleRows - 1, Math.floor(row / sampleScale));
    const sourceOffset = sampledRow * sampleCols;
    const targetOffset = row * cols;
    for (let col = 0; col < cols; col++) {
      const sampledCol = Math.min(sampleCols - 1, Math.floor(col / sampleScale));
      zoneIds[targetOffset + col] = sampled.zoneIds[sourceOffset + sampledCol] as number;
    }
  }
  const zoneSeeds = sampled.zoneSeeds.map((seed) => ({
    ...seed,
    col: Math.min(cols - 1, seed.col * sampleScale + Math.floor(sampleScale / 2)),
    row: Math.min(rows - 1, seed.row * sampleScale + Math.floor(sampleScale / 2)),
  }));
  return { zoneIds, zoneSeeds };
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

export function generateArena(
  seeds: ArenaMapSeeds,
  arenaWidth = ARENA_WIDTH,
  arenaHeight = ARENA_HEIGHT,
): ArenaMap {
  const cols = Math.floor(arenaWidth / MAP_TILE);
  const rows = Math.floor(arenaHeight / MAP_TILE);
  const tiles = new Uint8Array(cols * rows); // all TILE_GROUND (0)
  const spawnCol = Math.floor(cols / 2);
  const spawnRow = Math.floor(rows / 2);
  const { zoneIds, zoneSeeds } = generateMapZones(seeds, cols, rows);

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

/** Exact tile query for the exempt lava dimension; ordinary arenas always return false. */
export function isLavaGapAtPx(map: ArenaMap, px: number, py: number): boolean {
  return map.lavaLayout !== undefined && tileAtPx(map, px, py) === TILE_LAVA_GAP;
}

/** Lava-only player gap trigger using the collision derivation owned by the lava dimension. */
export function isPlayerGroundContactInLavaGap(
  map: ArenaMap,
  rootX: number,
  rootY: number,
): boolean {
  return (
    map.lavaLayout !== undefined &&
    !isArenaDiscSafe(map, rootX, rootY + PLAYER_GROUND_CONTACT_OFFSET_Y, PLAYER_RADIUS)
  );
}

/** Lava-only recovery search for the nearest collision-safe tile centre. */
export function nearestLavaGroundPx(
  map: ArenaMap,
  px: number,
  py: number,
): { x: number; y: number } {
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

/** Lava maps correct placements onto platforms; ordinary arenas are continuous and return the input. */
export function safeSpawnPos(map: ArenaMap, x: number, y: number): { x: number; y: number } {
  if (map.lavaLayout) {
    const groundY = y + PLAYER_GROUND_CONTACT_OFFSET_Y;
    if (isArenaDiscSafe(map, x, groundY, PLAYER_RADIUS)) return { x, y };
    const safe = nearestArenaDisc(map, x, groundY, PLAYER_RADIUS);
    return { x: safe.x, y: safe.y - PLAYER_GROUND_CONTACT_OFFSET_Y };
  }
  return { x, y };
}

/** True only when the COMPLETE objective disc lies on ground and inside the arena. On lava maps this
 * intentionally rejects a platform centre whose footprint hangs over a gap. */
export function isArenaDiscSafe(map: ArenaMap, x: number, y: number, radius: number): boolean {
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
  const arenaWidth = map.cols * map.tileSize;
  const arenaHeight = map.rows * map.tileSize;
  let extract = nearestArenaDisc(map, corpseX, corpseY, radius);
  let centreX = arenaWidth / 2 - extract.x;
  let centreY = arenaHeight / 2 - extract.y;
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

  extract = nearestArenaDisc(map, corpseX, corpseY, radius, rift.x, rift.y, minSeparation);
  centreX = arenaWidth / 2 - extract.x;
  centreY = arenaHeight / 2 - extract.y;
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

export type ArenaNavigationAudit = Readonly<{
  ok: boolean;
  reason: string;
  reachableCells: number;
  navigableCells: number;
}>;

/** Navigation proof. Ordinary arenas are continuous; lava retains its authored gap-hop audit. */
export function auditArenaNavigation(map: ArenaMap): ArenaNavigationAudit {
  const total = map.cols * map.rows;
  if (!map.lavaLayout) {
    for (let cell = 0; cell < total; cell++)
      if (map.tiles[cell] !== TILE_GROUND)
        return {
          ok: false,
          reason: `ordinary arena cell ${cell} is not continuous ground`,
          reachableCells: cell,
          navigableCells: total,
        };
    return { ok: true, reason: "", reachableCells: total, navigableCells: total };
  }
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
      for (let gap = 1; gap <= (map.maxJumpTiles ?? 0); gap++) {
        const gapCol = col + dx * gap;
        const gapRow = row + dy * gap;
        if (
          !inBounds(gapCol, gapRow, map.cols, map.rows) ||
          map.tiles[idx(gapCol, gapRow, map.cols)] !== TILE_LAVA_GAP
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
  return { ok: true, reason: "", reachableCells, navigableCells };
}

/**
 * Validate the post-conditions a generated map MUST satisfy (used by tests + as a server-side assert):
 * ordinary arenas are continuous ground, while lava keeps its platform navigation proof.
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
  const navigation = auditArenaNavigation(map);
  if (!navigation.ok) return { ok: false, reason: navigation.reason };
  if (gates) {
    const gateValidation = validateArenaGatePair(map, gates);
    if (!gateValidation.ok) return gateValidation;
  }
  return { ok: true, reason: "" };
}
