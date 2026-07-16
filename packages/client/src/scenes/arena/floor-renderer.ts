import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type ArenaMap,
  type DimensionPalette,
  isPitAtPx,
  MAP_MAX_JUMP_TILES,
  MAP_SPAWN_CLEAR_TILES,
  makeRng,
  mixSeeds,
  poiRadius,
  poiScale,
  TILE_PIT,
} from "@dd/shared";
import type Phaser from "phaser";
import { DECAL_IDS } from "../../sprites/decal-manifest.js";
import { DECAL_IDS_ASHLANDS } from "../../sprites/decal-manifest-ashlands.js";
import { DECAL_IDS_FROSTFELL } from "../../sprites/decal-manifest-frostfell.js";
import { DECAL_IDS_NEON_CYBER } from "../../sprites/decal-manifest-neon-cyber.js";
import { DECAL_IDS_VERDANT_RUINS } from "../../sprites/decal-manifest-verdant-ruins.js";
import { POI_IDS } from "../../sprites/poi-manifest.js";
import { POI_IDS_ASHLANDS } from "../../sprites/poi-manifest-ashlands.js";
import { POI_IDS_FROSTFELL } from "../../sprites/poi-manifest-frostfell.js";
import { POI_IDS_NEON_CYBER } from "../../sprites/poi-manifest-neon-cyber.js";
import { POI_IDS_VERDANT_RUINS } from "../../sprites/poi-manifest-verdant-ruins.js";

/**
 * §17 arena floor renderer — the "Dust & The Drop" look, extracted from ArenaScene so the scene stays a
 * thin orchestrator. Every function is a pure renderer: it takes the scene (for the GameObject factory)
 * plus the synced `ArenaMap`, and draws into the world at the established NEGATIVE depths. The scene's
 * `maybeBuildFloor` gate still owns lifecycle (regen map from seeds → build once).
 *
 * Depth stack (back→front): bed(-20) · painted base(-19.5) · path wear(-18.7) · patches(-17.4) ·
 * dust(-16) · flat litter(-15) · pit/rim/accent(-14…-13.8) · POI skirts(-13.6) · rail(-12) ·
 * contact AO(-11). Entities use depth = world Y (≥ 0), so all ground integration sits behind gameplay.
 */

const PAINTED_TILE_SIZE = 512;

type PoiSizeClass = "S" | "M" | "L" | "XL";
type PoiBucket = "squat" | "structure" | "organic";
type DecalRole = "flat" | "edge" | "solid";
type DecalProjection = "ground" | "low" | "upright";

export type PoiVisualMeta = Readonly<{
  id: string;
  bucket: PoiBucket;
  contactX: number;
  contactY: number;
  baseSpanPx: number;
  maxClass: PoiSizeClass;
  heightClass: 0 | 1 | 2 | 3;
  swayRad: number;
  usable: boolean;
}>;

export type DecalVisualMeta = Readonly<{
  id: string;
  role: DecalRole;
  projection: DecalProjection;
  footprintPx: number;
  accent: boolean;
  usable: boolean;
  pitOnly: boolean;
}>;

type DimensionFloorStyle = Readonly<{
  skirt: number;
  disturbance: number;
  shadow: number;
  colliderCue: number;
  wearBroad: number;
  wearFine: number;
  tileBase: readonly number[];
  tileRoute: readonly number[];
  tileCluster: readonly number[];
  tileEdge: readonly number[];
  slab: boolean;
}>;

export type DimensionPropPack = Readonly<{
  poiIds: readonly string[];
  decalIds: readonly string[];
  poiMeta: readonly PoiVisualMeta[];
  decalMeta: readonly DecalVisualMeta[];
  poiDir: string;
  decalDir: string;
  style: DimensionFloorStyle;
}>;

const poiMeta = (
  id: string,
  bucket: PoiBucket,
  contactX: number,
  contactY: number,
  baseSpanPx: number,
  maxClass: PoiSizeClass,
  heightClass: 0 | 1 | 2 | 3,
  swayRad = 0,
  usable = true,
): PoiVisualMeta => ({
  id,
  bucket,
  contactX,
  contactY,
  baseSpanPx,
  maxClass,
  heightClass,
  swayRad,
  usable,
});

const decalMeta = (
  id: string,
  role: DecalRole,
  projection: DecalProjection,
  footprintPx = 132,
  accent = false,
  usable = true,
  pitOnly = false,
): DecalVisualMeta => ({ id, role, projection, footprintPx, accent, usable, pitOnly });

const WILD_WEST_POI_META = [
  poiMeta("poi-00", "organic", 68, 274, 108, "XL", 3, 0.012),
  poiMeta("poi-01", "squat", 73, 274, 142, "M", 1),
  poiMeta("poi-02", "structure", 77, 274, 150, "XL", 3),
  poiMeta("poi-03", "structure", 58, 278, 72, "XL", 3),
  poiMeta("poi-04", "structure", 64, 276, 112, "XL", 3),
  // Chroma-green source field: keep the authored id/load contract, but never select it for live art.
  poiMeta("poi-05", "squat", 126, 256, 242, "XL", 1, 0, false),
] as const;
const WILD_WEST_DECAL_META = [
  decalMeta("decal-00", "solid", "low"),
  decalMeta("decal-01", "edge", "upright"),
  decalMeta("decal-02", "edge", "low"),
  decalMeta("decal-03", "solid", "upright", 132, true),
  decalMeta("decal-04", "edge", "upright"),
  decalMeta("decal-05", "edge", "low", 132, true),
  decalMeta("decal-06", "solid", "upright", 132, true),
  decalMeta("decal-07", "solid", "upright", 132, true),
  decalMeta("decal-08", "flat", "ground"),
] as const;

const FROSTFELL_POI_META = [
  poiMeta("poi-frostfell-00", "squat", 77, 276, 146, "L", 2),
  poiMeta("poi-frostfell-01", "organic", 74, 276, 78, "L", 3, 0.01),
  poiMeta("poi-frostfell-02", "structure", 85, 276, 162, "XL", 3),
  poiMeta("poi-frostfell-03", "structure", 86, 276, 164, "XL", 2),
  poiMeta("poi-frostfell-04", "structure", 79, 276, 150, "XL", 2),
  poiMeta("poi-frostfell-05", "squat", 120, 268, 228, "XL", 1, 0, false),
] as const;
const FROSTFELL_DECAL_META = [
  decalMeta("decal-frostfell-00", "solid", "upright", 126, true),
  decalMeta("decal-frostfell-01", "flat", "low"),
  // A harmless black-ice-looking slick would lie about the unwired dimension hazard.
  decalMeta("decal-frostfell-02", "solid", "ground", 132, false, false),
  decalMeta("decal-frostfell-03", "edge", "upright"),
  decalMeta("decal-frostfell-04", "flat", "ground"),
  decalMeta("decal-frostfell-05", "edge", "low"),
  decalMeta("decal-frostfell-06", "edge", "low", 132, true),
  decalMeta("decal-frostfell-07", "edge", "low", 132, true),
] as const;

const VERDANT_RUINS_POI_META = [
  poiMeta("poi-verdant-ruins-00", "structure", 100, 276, 190, "XL", 2),
  // The open arch promises a passage that the authoritative circle does not provide.
  poiMeta("poi-verdant-ruins-01", "structure", 140, 263, 270, "XL", 2, 0, false),
  poiMeta("poi-verdant-ruins-02", "squat", 140, 247, 270, "XL", 1),
  poiMeta("poi-verdant-ruins-03", "structure", 116, 275, 222, "XL", 2),
  poiMeta("poi-verdant-ruins-04", "organic", 140, 258, 268, "XL", 2, 0.006),
  poiMeta("poi-verdant-ruins-05", "squat", 140, 221, 270, "L", 1),
] as const;
const VERDANT_RUINS_DECAL_META = [
  decalMeta("decal-verdant-ruins-00", "solid", "low", 132, true),
  decalMeta("decal-verdant-ruins-01", "solid", "low"),
  decalMeta("decal-verdant-ruins-02", "flat", "low"),
  decalMeta("decal-verdant-ruins-03", "solid", "upright", 132, true),
  decalMeta("decal-verdant-ruins-04", "flat", "low"),
  decalMeta("decal-verdant-ruins-05", "flat", "ground"),
  decalMeta("decal-verdant-ruins-06", "edge", "low"),
  decalMeta("decal-verdant-ruins-07", "flat", "ground"),
  decalMeta("decal-verdant-ruins-08", "solid", "low", 132, true),
] as const;

const ASHLANDS_POI_META = [
  poiMeta("poi-ashlands-00", "squat", 96, 276, 186, "L", 2),
  poiMeta("poi-ashlands-01", "organic", 101, 276, 188, "XL", 3, 0.008),
  poiMeta("poi-ashlands-02", "squat", 140, 258, 268, "XL", 1),
  poiMeta("poi-ashlands-03", "structure", 132, 275, 252, "XL", 3),
  poiMeta("poi-ashlands-04", "squat", 140, 241, 272, "L", 1),
  poiMeta("poi-ashlands-05", "structure", 140, 197, 268, "XL", 1, 0, false),
] as const;
const ASHLANDS_DECAL_META = [
  decalMeta("decal-ashlands-00", "solid", "low"),
  // Glowing cracks belong only to the real pit edge, never to harmless open ground.
  decalMeta("decal-ashlands-01", "edge", "ground", 132, true, true, true),
  decalMeta("decal-ashlands-02", "solid", "low"),
  decalMeta("decal-ashlands-03", "flat", "ground"),
  decalMeta("decal-ashlands-04", "flat", "ground", 132, true),
  decalMeta("decal-ashlands-05", "edge", "low"),
  decalMeta("decal-ashlands-06", "edge", "low"),
  decalMeta("decal-ashlands-07", "edge", "low"),
  decalMeta("decal-ashlands-08", "solid", "low", 132, true),
  decalMeta("decal-ashlands-09", "edge", "low", 132, true),
  decalMeta("decal-ashlands-10", "flat", "ground"),
] as const;

const NEON_CYBER_POI_META = [
  poiMeta("poi-neon-cyber-00", "structure", 85, 276, 160, "XL", 3),
  poiMeta("poi-neon-cyber-01", "structure", 90, 276, 174, "XL", 3),
  poiMeta("poi-neon-cyber-02", "squat", 130, 275, 250, "XL", 2),
  poiMeta("poi-neon-cyber-03", "structure", 18, 156, 32, "XL", 2, 0, false),
  poiMeta("poi-neon-cyber-04", "structure", 75, 276, 142, "XL", 3),
  poiMeta("poi-neon-cyber-05", "structure", 129, 275, 246, "XL", 2),
  poiMeta("poi-neon-cyber-06", "structure", 110, 264, 206, "XL", 2),
] as const;
const NEON_CYBER_DECAL_META = [
  decalMeta("decal-neon-cyber-00", "flat", "low"),
  decalMeta("decal-neon-cyber-01", "flat", "low"),
  decalMeta("decal-neon-cyber-02", "solid", "low", 132, true),
  decalMeta("decal-neon-cyber-03", "solid", "upright", 132, true),
  decalMeta("decal-neon-cyber-04", "edge", "low"),
  decalMeta("decal-neon-cyber-05", "flat", "ground"),
  // Chroma-green source field: retain load order, quarantine every cosmetic placement channel.
  decalMeta("decal-neon-cyber-06", "solid", "upright", 121, true, false),
  decalMeta("decal-neon-cyber-07", "flat", "low"),
  decalMeta("decal-neon-cyber-08", "flat", "ground", 132, true),
  decalMeta("decal-neon-cyber-09", "solid", "upright", 132, true),
] as const;

const FLOOR_STYLES = {
  "wild-west": {
    skirt: 0x8f5a35,
    disturbance: 0xc49a66,
    shadow: 0x493326,
    colliderCue: 0x3d2a20,
    wearBroad: 0x745039,
    wearFine: 0xa77c50,
    tileBase: [2, 0],
    tileRoute: [3],
    tileCluster: [1],
    tileEdge: [1, 0],
    slab: false,
  },
  frostfell: {
    skirt: 0x718da6,
    disturbance: 0xc6dce7,
    shadow: 0x283b50,
    colliderCue: 0x37536d,
    wearBroad: 0x58758f,
    wearFine: 0x9bb7c8,
    tileBase: [1],
    tileRoute: [0],
    tileCluster: [3],
    tileEdge: [2],
    slab: false,
  },
  "verdant-ruins": {
    skirt: 0x596344,
    disturbance: 0x89865e,
    shadow: 0x283126,
    colliderCue: 0x394431,
    wearBroad: 0x69674f,
    wearFine: 0x948e70,
    tileBase: [0, 3],
    tileRoute: [1],
    tileCluster: [2],
    tileEdge: [2],
    slab: false,
  },
  ashlands: {
    skirt: 0x493a35,
    disturbance: 0x665148,
    shadow: 0x281e20,
    colliderCue: 0x5c3c33,
    wearBroad: 0x382f30,
    wearFine: 0x735247,
    tileBase: [3],
    tileRoute: [0],
    tileCluster: [1],
    tileEdge: [2],
    slab: false,
  },
  "neon-cyber": {
    skirt: 0x35404d,
    disturbance: 0x5d7185,
    shadow: 0x181529,
    colliderCue: 0x476e7e,
    wearBroad: 0x252936,
    wearFine: 0x467488,
    tileBase: [0],
    tileRoute: [1],
    tileCluster: [2],
    tileEdge: [3],
    slab: true,
  },
} as const satisfies Readonly<Record<string, DimensionFloorStyle>>;

/** §17 active-dimension prop registry. The original generic manifests ARE Wild West's authored pack;
 *  every generated theme keeps its manifest order as the stable local kind/index → texture convention. */
const WILD_WEST_PROP_PACK: DimensionPropPack = {
  poiIds: POI_IDS,
  decalIds: DECAL_IDS,
  poiMeta: WILD_WEST_POI_META,
  decalMeta: WILD_WEST_DECAL_META,
  poiDir: "pois",
  decalDir: "decals",
  style: FLOOR_STYLES["wild-west"],
};
export const DIMENSION_PROP_PACKS: Readonly<Record<string, DimensionPropPack>> = {
  "wild-west": WILD_WEST_PROP_PACK,
  frostfell: {
    poiIds: POI_IDS_FROSTFELL,
    decalIds: DECAL_IDS_FROSTFELL,
    poiMeta: FROSTFELL_POI_META,
    decalMeta: FROSTFELL_DECAL_META,
    poiDir: "pois/frostfell",
    decalDir: "decals/frostfell",
    style: FLOOR_STYLES.frostfell,
  },
  "verdant-ruins": {
    poiIds: POI_IDS_VERDANT_RUINS,
    decalIds: DECAL_IDS_VERDANT_RUINS,
    poiMeta: VERDANT_RUINS_POI_META,
    decalMeta: VERDANT_RUINS_DECAL_META,
    poiDir: "pois/verdant-ruins",
    decalDir: "decals/verdant-ruins",
    style: FLOOR_STYLES["verdant-ruins"],
  },
  ashlands: {
    poiIds: POI_IDS_ASHLANDS,
    decalIds: DECAL_IDS_ASHLANDS,
    poiMeta: ASHLANDS_POI_META,
    decalMeta: ASHLANDS_DECAL_META,
    poiDir: "pois/ashlands",
    decalDir: "decals/ashlands",
    style: FLOOR_STYLES.ashlands,
  },
  "neon-cyber": {
    poiIds: POI_IDS_NEON_CYBER,
    decalIds: DECAL_IDS_NEON_CYBER,
    poiMeta: NEON_CYBER_POI_META,
    decalMeta: NEON_CYBER_DECAL_META,
    poiDir: "pois/neon-cyber",
    decalDir: "decals/neon-cyber",
    style: FLOOR_STYLES["neon-cyber"],
  },
};

/** Resolve stale/unknown ids exactly like shared `getDimension`: Wild West is the compatibility fallback. */
export function dimensionPropPack(dimensionId: string): DimensionPropPack {
  return DIMENSION_PROP_PACKS[dimensionId] ?? WILD_WEST_PROP_PACK;
}

/** §17 stable optional-terrain texture keys — shared with ArenaScene's active-dimension preload. */
export function terrainTileKey(dimensionId: string, variant: number): string {
  return `terrain:${dimensionId}:tile-${variant}`;
}

export function terrainRimKey(dimensionId: string): string {
  return `terrain:${dimensionId}:rim`;
}

type WorldPoint = Readonly<{ x: number; y: number }>;
type GridPoint = Readonly<{ gx: number; gy: number }>;
type WearRoute = Readonly<{ points: readonly WorldPoint[] }>;

const SHADOW_X = 0.62;
const SHADOW_Y = 0.78;
const SHADOW_ANGLE = Math.atan2(SHADOW_Y, SHADOW_X);
const CONTACT_SHADOW_KEY = "floor:contact-shadow";

function poiSizeClass(kind: number): PoiSizeClass {
  const scale = poiScale(kind);
  if (scale <= 0.8) return "S";
  if (scale >= 1.9) return "XL";
  if (scale >= 1.45) return "L";
  return "M";
}

function classRank(sizeClass: PoiSizeClass): number {
  if (sizeClass === "S") return 0;
  if (sizeClass === "M") return 1;
  if (sizeClass === "L") return 2;
  return 3;
}

function groundCell(map: ArenaMap, gx: number, gy: number): boolean {
  return (
    gx >= 0 &&
    gy >= 0 &&
    gx < map.cols &&
    gy < map.rows &&
    map.tiles[gy * map.cols + gx] !== TILE_PIT
  );
}

function distanceToSegmentSq(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t =
    lengthSq > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq)) : 0;
  const qx = ax + dx * t;
  const qy = ay + dy * t;
  return (px - qx) ** 2 + (py - qy) ** 2;
}

function pointClearsPois(map: ArenaMap, x: number, y: number, margin: number): boolean {
  for (const poi of map.pois) {
    const r = poiRadius(poi.kind) + margin;
    if ((x - poi.x) ** 2 + (y - poi.y) ** 2 < r * r) return false;
  }
  return true;
}

function segmentClearsPois(
  map: ArenaMap,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  margin: number,
): boolean {
  for (const poi of map.pois) {
    const r = poiRadius(poi.kind) + margin;
    if (distanceToSegmentSq(poi.x, poi.y, ax, ay, bx, by) < r * r) return false;
  }
  return true;
}

function gridCentre(map: ArenaMap, gx: number, gy: number): WorldPoint {
  return { x: (gx + 0.5) * map.tileSize, y: (gy + 0.5) * map.tileSize };
}

function walkableGridCell(map: ArenaMap, gx: number, gy: number): boolean {
  if (!groundCell(map, gx, gy)) return false;
  const p = gridCentre(map, gx, gy);
  return pointClearsPois(map, p.x, p.y, map.tileSize * 0.1);
}

function nearestWalkableCell(
  map: ArenaMap,
  targetX: number,
  targetY: number,
): GridPoint | undefined {
  const startX = Math.max(0, Math.min(map.cols - 1, Math.floor(targetX / map.tileSize)));
  const startY = Math.max(0, Math.min(map.rows - 1, Math.floor(targetY / map.tileSize)));
  const maxRadius = Math.max(map.cols, map.rows);
  for (let radius = 0; radius <= maxRadius; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const gx = startX + dx;
        const gy = startY + dy;
        if (walkableGridCell(map, gx, gy)) return { gx, gy };
      }
    }
  }
  return undefined;
}

function poiApproachCell(
  map: ArenaMap,
  poiIndex: number,
  towardX: number,
  towardY: number,
): GridPoint | undefined {
  const poi = map.pois[poiIndex];
  if (!poi) return undefined;
  const angle = Math.atan2(towardY - poi.y, towardX - poi.x);
  const distance = poiRadius(poi.kind) + map.tileSize * 0.72;
  return nearestWalkableCell(
    map,
    poi.x + Math.cos(angle) * distance,
    poi.y + Math.sin(angle) * distance,
  );
}

function findGridRoute(map: ArenaMap, start: GridPoint, goal: GridPoint): WorldPoint[] {
  const total = map.cols * map.rows;
  const parent = new Int32Array(total);
  parent.fill(-1);
  const queue = new Int32Array(total);
  const startIndex = start.gy * map.cols + start.gx;
  const goalIndex = goal.gy * map.cols + goal.gx;
  let head = 0;
  let tail = 0;
  queue[tail++] = startIndex;
  parent[startIndex] = startIndex;
  // Fixed order is part of the cosmetic determinism contract.
  const neighbours = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ] as const;
  while (head < tail && parent[goalIndex] === -1) {
    const current = queue[head++] ?? startIndex;
    const gx = current % map.cols;
    const gy = Math.floor(current / map.cols);
    const a = gridCentre(map, gx, gy);
    for (const [dx, dy] of neighbours) {
      const nx = gx + dx;
      const ny = gy + dy;
      if (!walkableGridCell(map, nx, ny)) continue;
      const next = ny * map.cols + nx;
      if (parent[next] !== -1) continue;
      const b = gridCentre(map, nx, ny);
      if (!segmentClearsPois(map, a.x, a.y, b.x, b.y, map.tileSize * 0.08)) continue;
      parent[next] = current;
      queue[tail++] = next;
    }
  }
  if (parent[goalIndex] === -1) return [];
  const reversed: WorldPoint[] = [];
  let at = goalIndex;
  for (;;) {
    reversed.push(gridCentre(map, at % map.cols, Math.floor(at / map.cols)));
    if (at === startIndex) break;
    const previous = parent[at];
    if (previous === undefined || previous < 0) return [];
    at = previous;
  }
  reversed.reverse();
  return reversed;
}

/** Cosmetic route descriptors only: they never alter tiles, AI navigation, POI centres, or radii. */
function buildWearRoutes(map: ArenaMap): WearRoute[] {
  const rng = makeRng(mixSeeds(map.seeds.seedDecor, map.seeds.seedTheme, 0x57454152));
  const ranked = map.pois.map((poi, index) => ({
    index,
    scale: poiScale(poi.kind),
    tie: rng.next(),
  }));
  ranked.sort((a, b) => b.scale - a.scale || a.tie - b.tie || a.index - b.index);
  // Eight destinations leave deliberate wilderness pockets rather than connecting every blocker.
  const destinations = ranked.filter((entry) => entry.scale >= 1).slice(0, 8);
  const connected: Array<{ x: number; y: number; poiIndex?: number }> = [
    { x: map.spawnX, y: map.spawnY },
  ];
  const routes: WearRoute[] = [];
  for (const destination of destinations) {
    const poi = map.pois[destination.index];
    if (!poi) continue;
    let anchor = connected[0] ?? { x: map.spawnX, y: map.spawnY };
    let best = Number.POSITIVE_INFINITY;
    for (const candidate of connected) {
      const d = (candidate.x - poi.x) ** 2 + (candidate.y - poi.y) ** 2;
      if (d < best) {
        best = d;
        anchor = candidate;
      }
    }
    const start =
      anchor.poiIndex === undefined
        ? nearestWalkableCell(map, anchor.x, anchor.y)
        : poiApproachCell(map, anchor.poiIndex, poi.x, poi.y);
    const goal = poiApproachCell(map, destination.index, anchor.x, anchor.y);
    if (start && goal) {
      const points = findGridRoute(map, start, goal);
      if (points.length > 1) routes.push({ points });
    }
    connected.push({ x: poi.x, y: poi.y, poiIndex: destination.index });
  }
  return routes;
}

type MaterialZone = "base" | "route" | "cluster" | "edge";

function materialZoneAt(
  map: ArenaMap,
  routes: readonly WearRoute[],
  x: number,
  y: number,
): MaterialZone {
  const T = map.tileSize;
  const minGX = Math.max(0, Math.floor((x - PAINTED_TILE_SIZE / 2 - T) / T));
  const maxGX = Math.min(map.cols - 1, Math.floor((x + PAINTED_TILE_SIZE / 2 + T) / T));
  const minGY = Math.max(0, Math.floor((y - PAINTED_TILE_SIZE / 2 - T) / T));
  const maxGY = Math.min(map.rows - 1, Math.floor((y + PAINTED_TILE_SIZE / 2 + T) / T));
  for (let gy = minGY; gy <= maxGY; gy++)
    for (let gx = minGX; gx <= maxGX; gx++)
      if (map.tiles[gy * map.cols + gx] === TILE_PIT) return "edge";
  for (const poi of map.pois) {
    const reach = poiRadius(poi.kind) + PAINTED_TILE_SIZE * 0.52;
    if ((x - poi.x) ** 2 + (y - poi.y) ** 2 <= reach * reach) return "cluster";
  }
  for (const route of routes)
    for (const point of route.points)
      if (
        Math.abs(point.x - x) <= PAINTED_TILE_SIZE * 0.58 &&
        Math.abs(point.y - y) <= PAINTED_TILE_SIZE * 0.58
      )
        return "route";
  return "base";
}

function zoneVariants(style: DimensionFloorStyle, zone: MaterialZone): readonly number[] {
  if (zone === "edge") return style.tileEdge;
  if (zone === "cluster") return style.tileCluster;
  if (zone === "route") return style.tileRoute;
  return style.tileBase;
}

/** Base ground bed + material-zoned painted tiles. `hasTile` is the scene's missing-texture guard, so a partial or
 *  absent painted kit takes the EXACT legacy tile-ground path. Returns every created object so the scene
 *  can DESTROY the floor on a §6 rift descent (v0.103 — new dimension mid-run = full floor rebuild). */
export function drawArena(
  scene: Phaser.Scene,
  map: ArenaMap,
  dimensionId: string,
  hasTile: (key: string) => boolean,
  palette: DimensionPalette,
): Phaser.GameObjects.GameObject[] {
  const out: Phaser.GameObjects.GameObject[] = [];
  const cx = ARENA_WIDTH / 2;
  const cy = ARENA_HEIGHT / 2;
  // Base ground bed + material zones. The §17 procedural PITS, the rim telegraph,
  // the spawn safe-ring + seeded decor are baked in `buildArenaFloor` once the server's map seeds sync.
  // The whole floor stack lives at NEGATIVE depths so it always renders behind the entities (which use
  // depth = world Y, ≥ 0). Stack, back→front: bed(-20) · painted tile base(-19.5) · wear/patches
  // (-18.7…-17.4) · dust(-16) · litter(-15) · pits/rim(-14…-13.8) · skirts(-13.6) · rail/AO(-12…-11).
  // Colours come from the active dimension palette; Wild West's remain the compatibility defaults.
  out.push(scene.add.rectangle(cx, cy, ARENA_WIDTH, ARENA_HEIGHT, palette.groundBed).setDepth(-20));
  const paintedKeys = Array.from({ length: 4 }, (_, i) => terrainTileKey(dimensionId, i));
  if (paintedKeys.every(hasTile)) {
    // The four authored variants now follow client-only material zones: quiet bed, worn routes, disturbed
    // clusters, and pit approaches. The irregular wear/cluster passes below soften these 512px decisions.
    // Do not quarter-turn authored lighting/panel flow: one north-west sun is shared by every dimension.
    const rng = makeRng(mixSeeds(map.seeds.seedTheme, map.seeds.seedDecor, 0x71e5));
    const routes = buildWearRoutes(map);
    const style = dimensionPropPack(dimensionId).style;
    const groundW = map.cols * map.tileSize;
    const groundH = map.rows * map.tileSize;
    for (let y = 0; y < groundH; y += PAINTED_TILE_SIZE) {
      for (let x = 0; x < groundW; x += PAINTED_TILE_SIZE) {
        const cx = x + PAINTED_TILE_SIZE / 2;
        const cy = y + PAINTED_TILE_SIZE / 2;
        const variants = zoneVariants(style, materialZoneAt(map, routes, cx, cy));
        const variant = variants[Math.floor(rng.next() * variants.length)] ?? variants[0] ?? 0;
        const key = paintedKeys[variant] ?? paintedKeys[0] ?? terrainTileKey(dimensionId, 0);
        out.push(
          scene.add
            .image(cx, cy, key)
            .setDisplaySize(PAINTED_TILE_SIZE, PAINTED_TILE_SIZE)
            .setDepth(-19.5),
        );
      }
    }
    // The old universal 128px grid competed with the painted kits. Neon route traces are now localized in
    // `buildPathWear`; the other four dimensions intentionally have no vector wallpaper.
  } else if (hasTile("tile-ground")) {
    // §17 PAINTED ground — a SEAMLESS Codex dust tile (gen-tiles.mjs), GPU-tiled across the arena PLUS a
    // wide margin so 4K/ultrawide viewports always show ground, never the void. One draw, scrolls free.
    const margin = 3200;
    const ts = scene.add
      .tileSprite(cx, cy, ARENA_WIDTH + margin * 2, ARENA_HEIGHT + margin * 2, "tile-ground")
      .setDepth(-19);
    ts.tileScaleX = 0.5;
    ts.tileScaleY = 0.5;
    out.push(ts);
  } else {
    // Fallback (no tile art installed yet): the low-contrast themed grid.
    out.push(
      scene.add
        .grid(
          cx,
          cy,
          ARENA_WIDTH,
          ARENA_HEIGHT,
          128,
          128,
          palette.gridColor1,
          1,
          palette.gridColor2,
          0.5,
        )
        .setDepth(-19),
    );
  }
  // Arena boundary — a themed rail (marks the playable bound; the ground extends past it on big screens).
  out.push(
    scene.add
      .rectangle(cx, cy, ARENA_WIDTH, ARENA_HEIGHT)
      .setStrokeStyle(6, palette.boundaryRail)
      .setDepth(-12),
  );
  return out;
}

function ensureContactShadowTexture(scene: Phaser.Scene): boolean {
  if (scene.textures.exists(CONTACT_SHADOW_KEY)) return true;
  const canvas = scene.textures.createCanvas(CONTACT_SHADOW_KEY, 128, 128);
  if (!canvas) return false;
  const ctx = canvas.getContext();
  ctx.clearRect(0, 0, 128, 128);
  const gradient = ctx.createRadialGradient(64, 64, 3, 64, 64, 62);
  // White RGB permits a per-dimension tint; the readability-capped alpha is baked into the shared kernel.
  gradient.addColorStop(0, "rgba(255,255,255,0.18)");
  gradient.addColorStop(0.22, "rgba(255,255,255,0.18)");
  gradient.addColorStop(0.58, "rgba(255,255,255,0.07)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  canvas.refresh();
  return true;
}

function closestRouteAngle(
  map: ArenaMap,
  routes: readonly WearRoute[],
  x: number,
  y: number,
): number {
  let targetX = map.spawnX;
  let targetY = map.spawnY;
  let best = (x - targetX) ** 2 + (y - targetY) ** 2;
  for (const route of routes)
    for (const point of route.points) {
      const d = (x - point.x) ** 2 + (y - point.y) ** 2;
      if (d < best) {
        best = d;
        targetX = point.x;
        targetY = point.y;
      }
    }
  return Math.atan2(targetY - y, targetX - x);
}

function beginIrregularSkirt(
  g: Phaser.GameObjects.Graphics,
  map: ArenaMap,
  poiIndex: number,
  x: number,
  y: number,
  r: number,
  style: DimensionFloorStyle,
): void {
  const rng = makeRng(mixSeeds(map.seeds.seedDecor, map.seeds.seedTheme, poiIndex, 0x5a17c17));
  const points = style.slab ? 8 : 14;
  const rx = r * 1.55;
  const ry = r * 0.775;
  g.fillStyle(style.skirt, 0.06);
  g.beginPath();
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2;
    const wobble = style.slab ? 1 : 0.92 + rng.next() * 0.16;
    const px = x + Math.cos(angle) * rx * wobble;
    const py = y + Math.sin(angle) * ry * wobble;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
  g.fillPath();
}

function drawPoiGroundPatch(
  g: Phaser.GameObjects.Graphics,
  map: ArenaMap,
  poiIndex: number,
  r: number,
  style: DimensionFloorStyle,
  entranceAngle: number,
): void {
  const poi = map.pois[poiIndex];
  if (!poi) return;
  beginIrregularSkirt(g, map, poiIndex, poi.x, poi.y + r * 0.04, r, style);
  // Broken disturbance arc, with a route-facing 90° entrance instead of a decorative closed halo.
  const steps = 28;
  const opening = Math.PI / 2;
  g.lineStyle(Math.max(2, r * 0.035), style.disturbance, 0.07);
  for (let i = 0; i < steps; i++) {
    const a0 = (i / steps) * Math.PI * 2;
    const a1 = ((i + 0.62) / steps) * Math.PI * 2;
    const delta = Math.atan2(Math.sin(a0 - entranceAngle), Math.cos(a0 - entranceAngle));
    if (Math.abs(delta) < opening / 2 || i % 4 === 1) continue;
    const rx = r * 1.24;
    const ry = r * 0.59;
    g.lineBetween(
      poi.x + Math.cos(a0) * rx,
      poi.y + r * 0.04 + Math.sin(a0) * ry,
      poi.x + Math.cos(a1) * rx,
      poi.y + r * 0.04 + Math.sin(a1) * ry,
    );
  }
  // Quality-invariant fallback/collider cue: present even when the selected painted POI failed to load.
  g.lineStyle(Math.max(1.5, r * 0.022), style.colliderCue, 0.14);
  g.strokeEllipse(poi.x, poi.y + r * 0.04, r * 2, r * 0.64);
}

function footprintGroundSafe(map: ArenaMap, x: number, y: number, radius: number): boolean {
  if (
    x - radius < 0 ||
    y - radius < 0 ||
    x + radius >= map.cols * map.tileSize ||
    y + radius >= map.rows * map.tileSize
  )
    return false;
  if (isPitAtPx(map, x, y)) return false;
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    if (isPitAtPx(map, x + Math.cos(angle) * radius, y + Math.sin(angle) * radius)) return false;
  }
  return true;
}

function decalRotation(meta: DecalVisualMeta, flowAngle: number, roll: number): number {
  if (meta.projection === "ground") return roll * Math.PI * 2;
  if (meta.projection === "low") return flowAngle + (roll - 0.5) * (Math.PI / 6);
  return (roll - 0.5) * (Math.PI / 22.5);
}

function buildPoiGroundingCluster(
  scene: Phaser.Scene,
  map: ArenaMap,
  pack: DimensionPropPack,
  poiIndex: number,
  entranceAngle: number,
): Phaser.GameObjects.GameObject[] {
  const poi = map.pois[poiIndex];
  if (!poi || pack.decalMeta.length === 0) return [];
  const r = poiRadius(poi.kind);
  const sizeClass = poiSizeClass(poi.kind);
  const candidateCount = sizeClass === "S" ? 1 : sizeClass === "M" ? 3 : sizeClass === "L" ? 4 : 5;
  const flatCount = sizeClass === "S" ? 1 : 2;
  const flat = pack.decalMeta.filter(
    (meta) => meta.usable && !meta.pitOnly && meta.role === "flat" && !meta.accent,
  );
  const contained = pack.decalMeta.filter(
    (meta) => meta.usable && !meta.pitOnly && meta.role !== "flat",
  );
  const rng = makeRng(
    mixSeeds(map.seeds.seedDecor, map.seeds.seedTheme, poi.kind, poiIndex, 0x00c1a57e),
  );
  const out: Phaser.GameObjects.GameObject[] = [];
  let accentPlaced = false;
  for (let i = 0; i < candidateCount; i++) {
    // Draw the entire descriptor tuple before any rejection or texture lookup.
    const idRoll = rng.next();
    const angleRoll = rng.next();
    const distanceRoll = rng.next();
    const scaleRoll = rng.next();
    const rotationRoll = rng.next();
    const flipRoll = rng.next();
    const accentRoll = rng.next();
    const pool = i < flatCount && flat.length > 0 ? flat : contained.length > 0 ? contained : flat;
    const meta = pool[Math.floor(idRoll * pool.length)] ?? pool[0];
    if (!meta) continue;
    if (meta.accent && (accentPlaced || classRank(sizeClass) < classRank("L") || accentRoll > 0.28))
      continue;
    const opening = Math.PI / 2;
    const angle = entranceAngle + opening / 2 + angleRoll * (Math.PI * 2 - opening);
    const desiredScale = 0.2 + scaleRoll * (meta.role === "flat" ? 0.28 : 0.2);
    const footprint = meta.footprintPx * desiredScale;
    const limit = meta.role === "flat" ? r * 1.45 : r * 0.82;
    const maxDistance = Math.max(0, limit - footprint / 2);
    const minDistance = meta.role === "flat" ? r * 0.42 : r * 0.08;
    if (maxDistance < minDistance) continue;
    const distance = minDistance + distanceRoll * (maxDistance - minDistance);
    const x = poi.x + Math.cos(angle) * distance;
    const y = poi.y + r * 0.04 + Math.sin(angle) * distance * 0.55;
    if (!footprintGroundSafe(map, x, y, footprint / 2)) continue;
    const spawnClear = MAP_SPAWN_CLEAR_TILES * map.tileSize + footprint / 2 + map.tileSize * 0.35;
    if ((x - map.spawnX) ** 2 + (y - map.spawnY) ** 2 < spawnClear * spawnClear) continue;
    if (!scene.textures.exists(meta.id)) continue;
    const rotation = decalRotation(meta, entranceAngle + Math.PI / 2, rotationRoll);
    const img = scene.add
      .image(x, y, meta.id)
      .setScale(desiredScale)
      .setRotation(rotation)
      .setAlpha(meta.role === "flat" ? 0.065 : meta.role === "edge" ? 0.52 : 0.64)
      .setDepth(-13.55);
    // Consume the flip roll for fixed cadence, but never mirror authored light under the one-sun rule.
    void flipRoll;
    out.push(img);
    if (meta.accent) accentPlaced = true;
  }
  return out;
}

/** A placed landmark sprite + its collision radius, returned to the scene so it can run the per-frame
 *  occlusion fade (an XL is taller than the viewport — fade it when the local player walks behind it).
 *  TODO(ArenaScene owner): multiply the existing generic sway by `swayRad / 0.018`; zero means rigid. */
export type PoiSprite = {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  r: number;
  swayRad: number;
};

/** §17 place the POI landmark sprites — calibrated contact at the map position, depth = its y so
 *  players + enemies depth-sort around them (walk BEHIND a tower's upper structure, IN FRONT of its base).
 *  v0.102 WYSIWYG: each sprite's scale is derived FROM its collision radius (`poiRadius(kind)` — the same
 *  size-class function the server collides with), so the art's base width ≈ the blocker you bump into.
 *  Client metadata selects collider-honest silhouettes and sizes the painted base (not the PNG bounds),
 *  while one shared soft kernel plus the batched skirt grounds every blocker even if optional art is absent. */
export function buildPois(
  scene: Phaser.Scene,
  map: ArenaMap,
  dimensionId: string,
): { sprites: PoiSprite[]; objs: Phaser.GameObjects.GameObject[] } {
  const pack = dimensionPropPack(dimensionId);
  const out: PoiSprite[] = [];
  const objs: Phaser.GameObjects.GameObject[] = [];
  const routes = buildWearRoutes(map);
  const skirtG = scene.add.graphics().setDepth(-13.6);
  objs.push(skirtG);
  const hasSoftShadow = ensureContactShadowTexture(scene);
  for (let poiIndex = 0; poiIndex < map.pois.length; poiIndex++) {
    const poi = map.pois[poiIndex];
    if (!poi) continue;
    const r = poiRadius(poi.kind);
    const sizeClass = poiSizeClass(poi.kind);
    const eligible = pack.poiMeta.filter(
      (meta) => meta.usable && classRank(meta.maxClass) >= classRank(sizeClass),
    );
    const preferred =
      sizeClass === "S" ? eligible.filter((meta) => meta.bucket === "squat") : eligible;
    const pool = preferred.length > 0 ? preferred : eligible;
    const meta = pool[Math.floor(poi.kind / 7) % pool.length] ?? pool[0];
    const entranceAngle = closestRouteAngle(map, routes, poi.x, poi.y);
    drawPoiGroundPatch(skirtG, map, poiIndex, r, pack.style, entranceAngle);
    objs.push(...buildPoiGroundingCluster(scene, map, pack, poiIndex, entranceAngle));
    if (hasSoftShadow) {
      if (sizeClass !== "S") {
        const castOffset = r * (0.2 + (meta?.heightClass ?? 1) * 0.06);
        objs.push(
          scene.add
            .image(
              poi.x + SHADOW_X * castOffset,
              poi.y + r * 0.04 + SHADOW_Y * castOffset,
              CONTACT_SHADOW_KEY,
            )
            .setDisplaySize(r * (1.5 + (meta?.heightClass ?? 1) * 0.14), r * 0.68)
            .setRotation(SHADOW_ANGLE)
            .setTint(pack.style.shadow)
            .setDepth(-11),
        );
      }
      objs.push(
        scene.add
          .image(poi.x, poi.y + r * 0.04, CONTACT_SHADOW_KEY)
          .setDisplaySize(r * 2.05, r * 0.52)
          .setTint(pack.style.shadow)
          .setDepth(-11),
      );
    } else {
      skirtG.fillStyle(pack.style.shadow, 0.16);
      skirtG.fillEllipse(poi.x, poi.y + r * 0.04, r * 2.05, r * 0.52);
    }
    // The procedural skirt/collider cue above is unconditional: missing optional art cannot hide a blocker.
    if (!meta || !scene.textures.exists(meta.id)) continue;
    const tex = scene.textures.get(meta.id).getSourceImage() as { width: number; height: number };
    const sc = (r * 2) / Math.max(1, meta.baseSpanPx);
    const img = scene.add
      .image(poi.x, poi.y + r * 0.04, meta.id)
      .setOrigin(meta.contactX / Math.max(1, tex.width), meta.contactY / Math.max(1, tex.height))
      .setDepth(poi.y)
      .setScale(sc);
    img.setData("poiSwayRad", meta.swayRad);
    objs.push(img);
    out.push({ img, x: poi.x, y: poi.y, r, swayRad: meta.swayRad });
  }
  return { sprites: out, objs };
}

type PitSegment = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  nx: number;
  ny: number;
  hop: boolean;
};

function buildPathWear(
  scene: Phaser.Scene,
  map: ArenaMap,
  dimensionId: string,
  routes: readonly WearRoute[],
): Phaser.GameObjects.Graphics {
  const style = dimensionPropPack(dimensionId).style;
  const rng = makeRng(mixSeeds(map.seeds.seedDecor, map.seeds.seedTheme, 0x57454153));
  const segments: Array<{
    a: WorldPoint;
    b: WorldPoint;
    broad: boolean;
    fine: boolean;
  }> = [];
  const spawnClear = MAP_SPAWN_CLEAR_TILES * map.tileSize + map.tileSize * 0.2;
  for (const route of routes)
    for (let i = 1; i < route.points.length; i++) {
      // Fixed cadence: gap decisions are drawn even for pieces omitted around the spawn safety rail.
      const broad = rng.next() > 0.16;
      const fine = rng.next() > (dimensionId === "neon-cyber" ? 0.64 : 0.42);
      const a = route.points[i - 1];
      const b = route.points[i];
      if (!a || !b) continue;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      if ((mx - map.spawnX) ** 2 + (my - map.spawnY) ** 2 < spawnClear * spawnClear) continue;
      segments.push({ a, b, broad, fine });
    }
  const g = scene.add.graphics().setDepth(-18.7);
  g.lineStyle(map.tileSize * 0.32, style.wearBroad, 0.055);
  for (const segment of segments)
    if (segment.broad) g.lineBetween(segment.a.x, segment.a.y, segment.b.x, segment.b.y);
  g.lineStyle(map.tileSize * (dimensionId === "neon-cyber" ? 0.055 : 0.1), style.wearFine, 0.05);
  for (const segment of segments)
    if (segment.fine) g.lineBetween(segment.a.x, segment.a.y, segment.b.x, segment.b.y);
  return g;
}

function localPitCrossingIsHoppable(map: ArenaMap, segment: Omit<PitSegment, "hop">): boolean {
  const T = map.tileSize;
  const mx = (segment.x1 + segment.x2) / 2;
  const my = (segment.y1 + segment.y2) / 2;
  for (let distance = 0; distance <= MAP_MAX_JUMP_TILES; distance++) {
    const sample = distance + 0.5;
    const gx = Math.floor((mx + segment.nx * T * sample) / T);
    const gy = Math.floor((my + segment.ny * T * sample) / T);
    if (gx < 0 || gy < 0 || gx >= map.cols || gy >= map.rows) return false;
    const pit = map.tiles[gy * map.cols + gx] === TILE_PIT;
    if (!pit) return distance > 0;
  }
  return false;
}

function mixColor(a: number, b: number, amount: number): number {
  const t = Math.max(0, Math.min(1, amount));
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  return (
    (Math.round(ar + (br - ar) * t) << 16) |
    (Math.round(ag + (bg - ag) * t) << 8) |
    Math.round(ab + (bb - ab) * t)
  );
}

function shadeColor(color: number, factor: number): number {
  const r = Math.max(0, Math.min(255, Math.round(((color >> 16) & 0xff) * factor)));
  const g = Math.max(0, Math.min(255, Math.round(((color >> 8) & 0xff) * factor)));
  const b = Math.max(0, Math.min(255, Math.round((color & 0xff) * factor)));
  return (r << 16) | (g << 8) | b;
}

function drawPitDepth(
  scene: Phaser.Scene,
  map: ArenaMap,
  palette: DimensionPalette,
  segments: readonly PitSegment[],
): Phaser.GameObjects.Graphics {
  const T = map.tileSize;
  const total = map.cols * map.rows;
  const distance = new Int16Array(total);
  distance.fill(-1);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;
  for (let gy = 0; gy < map.rows; gy++)
    for (let gx = 0; gx < map.cols; gx++) {
      const index = gy * map.cols + gx;
      if (map.tiles[index] !== TILE_PIT) continue;
      if (
        groundCell(map, gx - 1, gy) ||
        groundCell(map, gx + 1, gy) ||
        groundCell(map, gx, gy - 1) ||
        groundCell(map, gx, gy + 1)
      ) {
        distance[index] = 0;
        queue[tail++] = index;
      }
    }
  const neighbours = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ] as const;
  while (head < tail) {
    const current = queue[head++] ?? 0;
    const gx = current % map.cols;
    const gy = Math.floor(current / map.cols);
    for (const [dx, dy] of neighbours) {
      const nx = gx + dx;
      const ny = gy + dy;
      if (nx < 0 || ny < 0 || nx >= map.cols || ny >= map.rows) continue;
      const next = ny * map.cols + nx;
      if (map.tiles[next] !== TILE_PIT || distance[next] !== -1) continue;
      distance[next] = (distance[current] ?? 0) + 1;
      queue[tail++] = next;
    }
  }
  const g = scene.add.graphics().setDepth(-14);
  for (let gy = 0; gy < map.rows; gy++)
    for (let gx = 0; gx < map.cols; gx++) {
      const index = gy * map.cols + gx;
      if (map.tiles[index] !== TILE_PIT) continue;
      const depth = Math.max(0, distance[index] ?? 0);
      const mottleRng = makeRng(mixSeeds(map.seeds.seedDecor, gx, gy, 0xd33f));
      const mottle = (mottleRng.next() - 0.5) * 0.06;
      const tint = mixColor(palette.pitVoid, palette.groundBed, 0.015 + Math.min(5, depth) * 0.012);
      g.fillStyle(shadeColor(tint, 0.79 + Math.min(5, depth) * 0.035 + mottle), 1);
      g.fillRect(gx * T, gy * T, T, T);
    }
  // Dense contact darkness stays inside the lethal tile, while broader bands produce a readable cut.
  for (const band of [
    { offset: 0.36, width: 0.48, alpha: 0.12 },
    { offset: 0.2, width: 0.28, alpha: 0.28 },
    { offset: 0.075, width: 0.15, alpha: 0.72 },
  ]) {
    g.lineStyle(T * band.width, shadeColor(palette.pitVoid, 0.62), band.alpha);
    for (const segment of segments)
      g.lineBetween(
        segment.x1 + segment.nx * T * band.offset,
        segment.y1 + segment.ny * T * band.offset,
        segment.x2 + segment.nx * T * band.offset,
        segment.y2 + segment.ny * T * band.offset,
      );
  }
  // Only the camera-facing north wall gets a vertical falloff; side/back faces remain shallow caps.
  for (const segment of segments) {
    if (segment.nx !== 0 || segment.ny !== 1) continue;
    for (let band = 0; band < 4; band++) {
      g.fillStyle(shadeColor(palette.pitVoid, 0.58 + band * 0.08), 0.52 - band * 0.1);
      g.fillRect(segment.x1, segment.y1 + band * T * 0.14, segment.x2 - segment.x1, T * 0.16);
    }
  }
  return g;
}

type RimRun = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  nx: number;
  ny: number;
};

function mergeRimRuns(segments: readonly PitSegment[]): RimRun[] {
  const groups = new Map<string, PitSegment[]>();
  for (const segment of segments) {
    const horizontal = segment.y1 === segment.y2;
    const fixed = horizontal ? segment.y1 : segment.x1;
    const key = `${segment.nx},${segment.ny},${fixed}`;
    const group = groups.get(key);
    if (group) group.push(segment);
    else groups.set(key, [segment]);
  }
  const runs: RimRun[] = [];
  for (const group of groups.values()) {
    const first = group[0];
    if (!first) continue;
    const horizontal = first.y1 === first.y2;
    group.sort((a, b) => (horizontal ? a.x1 - b.x1 : a.y1 - b.y1));
    for (const segment of group) {
      const previous = runs[runs.length - 1];
      const contiguous =
        previous &&
        previous.nx === segment.nx &&
        previous.ny === segment.ny &&
        (horizontal
          ? previous.y1 === segment.y1 && previous.x2 === segment.x1
          : previous.x1 === segment.x1 && previous.y2 === segment.y1);
      if (contiguous) {
        previous.x2 = segment.x2;
        previous.y2 = segment.y2;
      } else {
        runs.push({ ...segment });
      }
    }
  }
  return runs;
}

function ensureRimLipTexture(
  scene: Phaser.Scene,
  dimensionId: string,
  rimKey: string,
): { key: string; height: number } | undefined {
  const key = `floor:${dimensionId}:rim-lip`;
  if (scene.textures.exists(key)) {
    const source = scene.textures.get(key).getSourceImage() as { height?: number };
    return { key, height: source.height ?? 32 };
  }
  const source = scene.textures.get(rimKey).getSourceImage() as {
    width?: number;
    height?: number;
  };
  const width = Math.max(1, source.width ?? 512);
  const sourceHeight = Math.max(1, source.height ?? 256);
  const cropHeight = Math.max(8, Math.round(sourceHeight * 0.28));
  const height = Math.max(18, Math.round(sourceHeight * 0.18));
  const canvas = scene.textures.createCanvas(key, width, height);
  if (!canvas) return undefined;
  const ctx = canvas.getContext();
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(
    source as unknown as CanvasImageSource,
    0,
    0,
    width,
    cropHeight,
    0,
    0,
    width,
    height,
  );
  canvas.refresh();
  return { key, height };
}

function buildPaintedRims(
  scene: Phaser.Scene,
  dimensionId: string,
  rimKey: string,
  segments: readonly PitSegment[],
): Phaser.GameObjects.GameObject[] {
  const out: Phaser.GameObjects.GameObject[] = [];
  const source = scene.textures.get(rimKey).getSourceImage() as { height?: number };
  const fullHeight = source.height ?? 256;
  const lip = ensureRimLipTexture(scene, dimensionId, rimKey);
  for (const run of mergeRimRuns(segments)) {
    const horizontal = run.y1 === run.y2;
    const length = horizontal ? run.x2 - run.x1 : run.y2 - run.y1;
    const cx = (run.x1 + run.x2) / 2;
    const cy = (run.y1 + run.y2) / 2;
    if (run.nx === 0 && run.ny === 1) {
      const rim = scene.add.tileSprite(cx, cy, length, fullHeight, rimKey).setDepth(-13.9);
      rim.tilePositionX = run.x1;
      out.push(rim);
      continue;
    }
    if (!lip) continue;
    const rotation = run.ny === -1 ? Math.PI : run.nx === 1 ? Math.PI / 2 : -Math.PI / 2;
    const rim = scene.add
      .tileSprite(cx, cy, length, lip.height, lip.key)
      .setRotation(rotation)
      .setDepth(-13.9);
    rim.tilePositionX = horizontal ? run.x1 : run.y1;
    out.push(rim);
  }
  return out;
}

function buildPitDebris(
  scene: Phaser.Scene,
  map: ArenaMap,
  pack: DimensionPropPack,
  segments: readonly PitSegment[],
): Phaser.GameObjects.GameObject[] {
  const common = pack.decalMeta.filter(
    (meta) =>
      meta.usable &&
      !meta.pitOnly &&
      !meta.accent &&
      (meta.projection === "low" || meta.role === "edge"),
  );
  if (common.length === 0) return [];
  const rng = makeRng(mixSeeds(map.seeds.seedDecor, map.seeds.seedTheme, 0x11fdeb12));
  const out: Phaser.GameObjects.GameObject[] = [];
  let untilNext = 1 + Math.floor(rng.next() * 3);
  for (const segment of segments) {
    const idRoll = rng.next();
    const positionRoll = rng.next();
    const scaleRoll = rng.next();
    const rotationRoll = rng.next();
    if (untilNext-- > 0) continue;
    untilNext = 1 + Math.floor(rng.next() * 3);
    const meta = common[Math.floor(idRoll * common.length)] ?? common[0];
    if (!meta) continue;
    const scale = 0.18 + scaleRoll * 0.24;
    const footprint = meta.footprintPx * scale;
    const alongX = segment.x1 + (segment.x2 - segment.x1) * (0.2 + positionRoll * 0.6);
    const alongY = segment.y1 + (segment.y2 - segment.y1) * (0.2 + positionRoll * 0.6);
    // Inward normal points into the pit, so debris centres stay on the opposite, walkable side.
    const x = alongX - segment.nx * (footprint * 0.28 + 3);
    const y = alongY - segment.ny * (footprint * 0.28 + 3);
    if (!footprintGroundSafe(map, x, y, footprint * 0.38)) continue;
    if (!scene.textures.exists(meta.id)) continue;
    const tangent = Math.atan2(segment.y2 - segment.y1, segment.x2 - segment.x1);
    out.push(
      scene.add
        .image(x, y, meta.id)
        .setScale(scale)
        .setRotation(decalRotation(meta, tangent, rotationRoll))
        .setAlpha(0.52)
        .setDepth(-13.85),
    );
  }
  return out;
}

/**
 * §17 "Dust & The Drop" floor bake (the panel-winning look): warm-black PIT voids, a rust band + hot
 * amber lip on every pit edge with inward CHEVRON teeth on the wide (go-around) runs and a clean solid
 * lip on the narrow (hoppable) gaps, and a cyan SPAWN safe-ring. All static geometry in ONE Graphics
 * (drawn once, scrolled by the camera for free) at a low depth under the entities.
 */
export function buildArenaFloor(
  scene: Phaser.Scene,
  map: ArenaMap,
  dimensionId: string,
  hasTile: (key: string) => boolean,
  palette: DimensionPalette,
): Phaser.GameObjects.GameObject[] {
  const out: Phaser.GameObjects.GameObject[] = [];
  const T = map.tileSize;
  const pack = dimensionPropPack(dimensionId);
  const routes = buildWearRoutes(map);
  out.push(buildPathWear(scene, map, dimensionId, routes));
  // A quiet material clearing sits below the exact cool safety rail; dense dressing rejects this radius.
  const spawnPatch = scene.add.graphics().setDepth(-17.4);
  const sr = MAP_SPAWN_CLEAR_TILES * T;
  spawnPatch.fillStyle(pack.style.skirt, 0.045);
  spawnPatch.fillCircle(map.spawnX, map.spawnY, sr * 1.04);
  out.push(spawnPatch);

  // Pit-edge segments are exact authoritative tile boundaries. Hop vocabulary is checked along each local
  // normal, not inherited from a connected region's bounding box.
  const seg: PitSegment[] = [];
  const addSegment = (segment: Omit<PitSegment, "hop">): void => {
    seg.push({ ...segment, hop: localPitCrossingIsHoppable(map, segment) });
  };
  for (let y = 0; y < map.rows; y++)
    for (let x = 0; x < map.cols; x++) {
      if (map.tiles[y * map.cols + x] !== TILE_PIT) continue;
      const ox = x * T;
      const oy = y * T;
      if (groundCell(map, x, y - 1))
        addSegment({ x1: ox, y1: oy, x2: ox + T, y2: oy, nx: 0, ny: 1 });
      if (groundCell(map, x, y + 1))
        addSegment({ x1: ox, y1: oy + T, x2: ox + T, y2: oy + T, nx: 0, ny: -1 });
      if (groundCell(map, x - 1, y))
        addSegment({ x1: ox, y1: oy, x2: ox, y2: oy + T, nx: 1, ny: 0 });
      if (groundCell(map, x + 1, y))
        addSegment({ x1: ox + T, y1: oy, x2: ox + T, y2: oy + T, nx: -1, ny: 0 });
    }

  out.push(drawPitDepth(scene, map, palette, seg));
  const rimKey = terrainRimKey(dimensionId);
  if (hasTile(rimKey)) out.push(...buildPaintedRims(scene, dimensionId, rimKey, seg));
  out.push(...buildPitDebris(scene, map, pack, seg));
  const g = scene.add.graphics().setDepth(-13.8); // exact gameplay lip + spawn, above all painted material
  out.push(g);
  // Rust support band (under) then uninterrupted hot/cool exact rail (over).
  g.lineStyle(T * 0.11, palette.pitRustBand, 1);
  for (const s of seg) g.lineBetween(s.x1, s.y1, s.x2, s.y2);
  g.lineStyle(T * 0.045, palette.pitAmberLip, 1);
  for (const s of seg) g.lineBetween(s.x1, s.y1, s.x2, s.y2);
  // Inward chevrons mean go around. Locally hoppable spans receive two restrained inward notches.
  g.fillStyle(palette.pitAmberLip, 1);
  for (const s of seg) {
    const mx = (s.x1 + s.x2) / 2;
    const my = (s.y1 + s.y2) / 2;
    const ex = -s.ny; // edge direction (perpendicular to the inward normal)
    const ey = s.nx;
    if (s.hop) {
      g.lineStyle(T * 0.025, palette.pitAmberLip, 1);
      for (const offset of [-0.18, 0.18])
        g.lineBetween(
          mx + ex * T * offset,
          my + ey * T * offset,
          mx + ex * T * offset + s.nx * T * 0.13,
          my + ey * T * offset + s.ny * T * 0.13,
        );
    } else {
      g.fillTriangle(
        mx + s.nx * T * 0.2,
        my + s.ny * T * 0.2,
        mx + ex * T * 0.1,
        my + ey * T * 0.1,
        mx - ex * T * 0.1,
        my - ey * T * 0.1,
      );
    }
  }
  // Cool SPAWN safe-ring (cool = safe — the opposite semaphore to the hot pit lip).
  g.lineStyle(3, palette.spawnRingSafe, 0.85);
  g.strokeCircle(map.spawnX, map.spawnY, sr);

  out.push(...scatterDecor(scene, map, palette, pack, seg, routes));
  return out;
}

function ellipseGroundSafe(
  map: ArenaMap,
  x: number,
  y: number,
  rx: number,
  ry: number,
  rotation: number,
): boolean {
  if (isPitAtPx(map, x, y)) return false;
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2;
    const lx = Math.cos(angle) * rx;
    const ly = Math.sin(angle) * ry;
    const px = x + lx * Math.cos(rotation) - ly * Math.sin(rotation);
    const py = y + lx * Math.sin(rotation) + ly * Math.cos(rotation);
    if (
      px < 0 ||
      py < 0 ||
      px >= map.cols * map.tileSize ||
      py >= map.rows * map.tileSize ||
      isPitAtPx(map, px, py)
    )
      return false;
  }
  return true;
}

function fillRotatedEllipse(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  rx: number,
  ry: number,
  rotation: number,
): void {
  g.beginPath();
  for (let i = 0; i < 18; i++) {
    const angle = (i / 18) * Math.PI * 2;
    const lx = Math.cos(angle) * rx;
    const ly = Math.sin(angle) * ry;
    const px = x + lx * Math.cos(rotation) - ly * Math.sin(rotation);
    const py = y + lx * Math.sin(rotation) + ly * Math.cos(rotation);
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
  g.fillPath();
}

/** Deterministic composition cleanup: a single drift batch plus sparse, flat-only wilderness marks. */
export function scatterDecor(
  scene: Phaser.Scene,
  map: ArenaMap,
  palette: DimensionPalette,
  pack: DimensionPropPack,
  pitSegments: readonly PitSegment[],
  routes: readonly WearRoute[],
): Phaser.GameObjects.GameObject[] {
  const rng = makeRng(mixSeeds(map.seeds.seedDecor, map.seeds.seedTheme, 0xdec0));
  const out: Phaser.GameObjects.GameObject[] = [];
  const dust = scene.add.graphics().setDepth(-16);
  out.push(dust);
  let drifts = 0;
  // More candidates than the 8–12 budget are described, because full-footprint pit rejection may cull them.
  for (let i = 0; i < 24 && drifts < 10; i++) {
    const sourceRoll = rng.next();
    const indexRoll = rng.next();
    const positionRoll = rng.next();
    const jitterRoll = rng.next();
    const widthRoll = rng.next();
    const heightRoll = rng.next();
    const alphaRoll = rng.next();
    let x = map.spawnX;
    let y = map.spawnY;
    let angle = SHADOW_ANGLE;
    if (sourceRoll < 0.48 && routes.length > 0) {
      const route = routes[Math.floor(indexRoll * routes.length)] ?? routes[0];
      if (!route || route.points.length === 0) continue;
      const pointIndex = Math.min(
        route.points.length - 1,
        Math.floor(positionRoll * route.points.length),
      );
      const point = route.points[pointIndex];
      if (!point) continue;
      const neighbour = route.points[Math.min(route.points.length - 1, pointIndex + 1)] ?? point;
      angle = Math.atan2(neighbour.y - point.y, neighbour.x - point.x);
      x = point.x - Math.sin(angle) * (jitterRoll - 0.5) * map.tileSize * 0.45;
      y = point.y + Math.cos(angle) * (jitterRoll - 0.5) * map.tileSize * 0.45;
    } else if (sourceRoll < 0.86 && map.pois.length > 0) {
      const poi = map.pois[Math.floor(indexRoll * map.pois.length)] ?? map.pois[0];
      if (!poi) continue;
      const r = poiRadius(poi.kind);
      x = poi.x + SHADOW_X * r * (1.05 + positionRoll * 0.55);
      y = poi.y + SHADOW_Y * r * (0.5 + positionRoll * 0.35);
      angle = SHADOW_ANGLE + (jitterRoll - 0.5) * 0.35;
    } else if (pitSegments.length > 0) {
      const segment = pitSegments[Math.floor(indexRoll * pitSegments.length)] ?? pitSegments[0];
      if (!segment) continue;
      x = segment.x1 + (segment.x2 - segment.x1) * positionRoll - segment.nx * map.tileSize * 0.55;
      y = segment.y1 + (segment.y2 - segment.y1) * positionRoll - segment.ny * map.tileSize * 0.55;
      angle = Math.atan2(segment.y2 - segment.y1, segment.x2 - segment.x1);
    }
    const width = 120 + widthRoll * 150;
    const height = 32 + heightRoll * 54;
    if (!ellipseGroundSafe(map, x, y, width / 2, height / 2, angle)) continue;
    dust.fillStyle(palette.dustDrift, 0.03 + alphaRoll * 0.025);
    fillRotatedEllipse(dust, x, y, width / 2, height / 2, angle);
    drifts++;
  }

  // Open floor receives only non-accent flat/low marks. Solid silhouettes are reserved for collider sites.
  const flat = pack.decalMeta.filter(
    (meta) => meta.usable && !meta.pitOnly && meta.role === "flat" && !meta.accent,
  );
  const descriptors = new Map<
    string,
    Array<{ x: number; y: number; scale: number; rotation: number }>
  >();
  const AREA = (ARENA_WIDTH * ARENA_HEIGHT) / (2400 * 2400);
  for (let i = 0; i < Math.round(7 * AREA); i++) {
    const x = 60 + rng.next() * (ARENA_WIDTH - 120);
    const y = 60 + rng.next() * (ARENA_HEIGHT - 120);
    const idRoll = rng.next();
    const scaleRoll = rng.next();
    const rotationRoll = rng.next();
    const flipRoll = rng.next();
    const meta = flat[Math.floor(idRoll * flat.length)] ?? flat[0];
    if (!meta) continue;
    const scale = 0.24 + scaleRoll * 0.22;
    const footprint = meta.footprintPx * scale;
    if (!footprintGroundSafe(map, x, y, footprint / 2)) continue;
    if (!pointClearsPois(map, x, y, footprint / 2 + map.tileSize * 0.2)) continue;
    const spawnClear = MAP_SPAWN_CLEAR_TILES * map.tileSize + footprint / 2 + map.tileSize * 0.35;
    if ((x - map.spawnX) ** 2 + (y - map.spawnY) ** 2 < spawnClear * spawnClear) continue;
    // Missing art skips only this draw; it never changes descriptors or RNG cadence.
    if (!scene.textures.exists(meta.id)) continue;
    const descriptor = {
      x,
      y,
      scale,
      rotation: decalRotation(meta, 0, rotationRoll),
    };
    const list = descriptors.get(meta.id);
    if (list) list.push(descriptor);
    else descriptors.set(meta.id, [descriptor]);
    void flipRoll;
  }
  for (const [id, items] of descriptors)
    for (const descriptor of items)
      out.push(
        scene.add
          .image(descriptor.x, descriptor.y, id)
          .setScale(descriptor.scale)
          .setRotation(descriptor.rotation)
          .setAlpha(0.065)
          .setDepth(-15),
      );
  return out;
}
