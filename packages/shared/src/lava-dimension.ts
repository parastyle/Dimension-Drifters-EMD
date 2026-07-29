import {
  LAVA_ARENA_HEIGHT,
  LAVA_ARENA_WIDTH,
  type ArenaMap,
  type ArenaMapSeeds,
  DIST_JUMP_REACH,
  generateArena,
  type LavaRoomEdge,
  type LavaRoomLayout,
  type LavaRoomNode,
  MAP_ZONE_COMMONS,
  MAP_ZONE_COVER,
  MAP_ZONE_SCAR,
  makeRng,
  mixSeeds,
  type PlacedLavaRoom,
  type PlatformPrefab,
  type PrefabPoint,
  TILE_GROUND,
  TILE_PIT,
} from "./index-internal.js";
import { LAVA_DECORATIVE_PREFABS, LAVA_PLATFORM_PREFABS } from "./lava-dimension.generated.js";

export {
  LAVA_BACKGROUND_FILE,
  LAVA_DECORATIVE_PREFABS,
  LAVA_FLOW_FILE,
  LAVA_PLATFORM_PREFABS,
} from "./lava-dimension.generated.js";

export const LAVA_DIMENSION_ID = "lava-foundry" as const;
export const LAVA_COLLISION_TILE_PX = 20;
/** Leaves 32 px beneath the real 372 px distance-jump reach; body radii are applied at query time. */
export const LAVA_MAX_TRAVERSAL_GAP_PX = DIST_JUMP_REACH - 32;
/** Exact Euclidean clearance required between every pair of walkable collision surfaces. */
export const LAVA_MIN_PLATFORM_CLEARANCE_PX = 72;
const TARGET_GAP_MAX = 124;
export const LAVA_HERO_ROOM_RATE = 0.5;
const MAP_MARGIN = 12;

type Rect = { x: number; y: number; width: number; height: number };
type Direction = "above" | "right" | "below" | "left";
type GapKey = "spawn->route" | "route->hub" | "hub->exit" | "hub->branch" | "branch->reward";
type GapPlan = Readonly<Record<GapKey, number>>;

export const LAVA_DEGRADATION_LADDER = [
  "requested seeded prefab/role construction",
  "same hero and role with compact gaps and the smaller regular-prefab order",
  "same hero rerouted to its orientation-safe hub/destination template",
  "regular-only compact construction",
  "regular-only compact construction with reward coalesced into the hub",
] as const;

const GRAPH_NODES: readonly LavaRoomNode[] = [
  { id: "spawn", role: "spawn" },
  { id: "route", role: "route" },
  { id: "hub", role: "hub" },
  { id: "branch", role: "branch" },
  { id: "reward", role: "reward" },
  { id: "exit", role: "exit" },
];

const GRAPH_EDGES: readonly LavaRoomEdge[] = [
  { from: "spawn", to: "route" },
  { from: "route", to: "hub" },
  { from: "hub", to: "exit" },
  { from: "hub", to: "branch" },
  { from: "branch", to: "reward" },
];

const REGULAR_IDS = Object.values(LAVA_PLATFORM_PREFABS)
  .filter((prefab) => !prefab.tags.includes("mega") && !prefab.tags.includes("hero-room"))
  .map((prefab) => prefab.id);
const HERO_IDS = Object.values(LAVA_PLATFORM_PREFABS)
  .filter((prefab) => prefab.tags.includes("mega") || prefab.tags.includes("hero-room"))
  .map((prefab) => prefab.id);

function prefab(id: string): PlatformPrefab {
  const value = LAVA_PLATFORM_PREFABS[id];
  if (!value) throw new Error(`unknown Lava Foundry prefab ${id}`);
  return value;
}

function polygonBounds(polygons: readonly (readonly PrefabPoint[])[]): Rect {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const polygon of polygons) {
    for (const point of polygon) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function localCollisionBounds(value: PlatformPrefab): Rect {
  return polygonBounds(value.collision.surfaces.map((surface) => surface.polygon));
}

function translateRect(rect: Rect, x: number, y: number): Rect {
  return { x: rect.x + x, y: rect.y + y, width: rect.width, height: rect.height };
}

function rectCenterX(rect: Rect): number {
  return rect.x + rect.width / 2;
}

function rectCenterY(rect: Rect): number {
  return rect.y + rect.height / 2;
}

function makePlaced(node: LavaRoomNode, prefabId: string, x: number, y: number): PlacedLavaRoom {
  const value = prefab(prefabId);
  const [visibleX, visibleY, visibleWidth, visibleHeight] = value.visibleBounds;
  return {
    nodeId: node.id,
    graphNodeIds: [node.id],
    role: node.role,
    prefabId,
    x,
    y,
    width: value.width,
    height: value.height,
    nativeScale: 1,
    visibleBounds: {
      x: x + visibleX,
      y: y + visibleY,
      width: visibleWidth,
      height: visibleHeight,
    },
    collisionBounds: translateRect(localCollisionBounds(value), x, y),
  };
}

function centred(node: LavaRoomNode, prefabId: string, x: number, y: number): PlacedLavaRoom {
  const bounds = localCollisionBounds(prefab(prefabId));
  return makePlaced(node, prefabId, x - rectCenterX(bounds), y - rectCenterY(bounds));
}

function shuffle<T>(values: readonly T[], random: () => number): T[] {
  const out = [...values];
  for (let index = out.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [out[index], out[other]] = [out[other] as T, out[index] as T];
  }
  return out;
}

const COMPACT_REGULAR_IDS = [...REGULAR_IDS]
  .filter((id) => id !== "broken-security-gate-platform")
  .sort((a, b) => {
    const aBounds = localCollisionBounds(prefab(a));
    const bBounds = localCollisionBounds(prefab(b));
    return aBounds.width * aBounds.height - bBounds.width * bBounds.height || a.localeCompare(b);
  });
const NARROW_REGULAR_IDS = [...REGULAR_IDS]
  .filter((id) => id !== "broken-security-gate-platform")
  .sort(
    (a, b) =>
      localCollisionBounds(prefab(a)).width - localCollisionBounds(prefab(b)).width ||
      a.localeCompare(b),
  );

function assignment(
  random: () => number,
  heroId?: string,
  heroRole?: LavaRoomNode["role"],
  compact = false,
): Record<string, string> {
  const middle = compact
    ? [...NARROW_REGULAR_IDS.slice(0, 3)]
    : shuffle(NARROW_REGULAR_IDS.slice(0, 3), random);
  const outer = compact ? [...COMPACT_REGULAR_IDS] : shuffle(NARROW_REGULAR_IDS, random);
  let nextRegular = 0;
  const take = (): string => {
    const value = outer[nextRegular % outer.length];
    nextRegular++;
    return value ?? "broken-turntable-arena";
  };
  const ids: Record<string, string> = {
    // The fixed spawn keeps the existing 200x200 full-footprint-safe spawn deck guarantee. Art choice
    // elsewhere is fully procedural; changing spawn safely requires a separate spawn-footprint audit.
    spawn: "broken-security-gate-platform",
    route: middle[2] ?? "broken-turntable-arena",
    hub: middle[1] ?? "broken-turntable-arena",
    branch: middle[0] ?? "broken-reactor-arena",
    reward: take(),
    exit: middle[2] ?? "broken-lavafall-overlook",
  };
  if (heroId && heroRole) ids[heroRole] = heroId;
  return ids;
}

function gapPlan(random: () => number, compact = false): GapPlan {
  const next = (): number =>
    compact
      ? LAVA_MIN_PLATFORM_CLEARANCE_PX
      : Math.round(
          LAVA_MIN_PLATFORM_CLEARANCE_PX +
            random() * (TARGET_GAP_MAX - LAVA_MIN_PLATFORM_CLEARANCE_PX),
        );
  return {
    "spawn->route": next(),
    "route->hub": next(),
    "hub->exit": next(),
    "hub->branch": next(),
    "branch->reward": next(),
  };
}

function placedAtCollisionTopLeft(
  node: LavaRoomNode,
  prefabId: string,
  left: number,
  top: number,
): PlacedLavaRoom {
  const bounds = localCollisionBounds(prefab(prefabId));
  return makePlaced(node, prefabId, left - bounds.x, top - bounds.y);
}

function shifted(room: PlacedLavaRoom, dx: number, dy: number): PlacedLavaRoom {
  return {
    ...makePlaced({ id: room.nodeId, role: room.role }, room.prefabId, room.x + dx, room.y + dy),
    graphNodeIds: room.graphNodeIds,
  };
}

function flatSupportCoordinate(value: PlatformPrefab, side: Direction): number {
  const bounds = localCollisionBounds(value);
  const extreme =
    side === "above"
      ? bounds.y
      : side === "below"
        ? bounds.y + bounds.height
        : side === "left"
          ? bounds.x
          : bounds.x + bounds.width;
  let bestLength = -1;
  const centerCoordinate =
    side === "above" || side === "below" ? rectCenterX(bounds) : rectCenterY(bounds);
  let coordinate = centerCoordinate;
  let nearestExtremeVertex = Number.POSITIVE_INFINITY;
  for (const surface of value.collision.surfaces) {
    const ring = surface.polygon;
    for (let index = 0; index < ring.length; index++) {
      const a = ring[index] as PrefabPoint;
      const b = ring[(index + 1) % ring.length] as PrefabPoint;
      const aOnExtreme =
        side === "above" || side === "below"
          ? Math.abs(a.y - extreme) <= 1e-7
          : Math.abs(a.x - extreme) <= 1e-7;
      if (aOnExtreme && bestLength < 0) {
        const perpendicular = side === "above" || side === "below" ? a.x : a.y;
        const distance = Math.abs(perpendicular - centerCoordinate);
        if (distance < nearestExtremeVertex) {
          nearestExtremeVertex = distance;
          coordinate = perpendicular;
        }
      }
      const onExtreme =
        side === "above" || side === "below"
          ? Math.abs(a.y - extreme) <= 1e-7 && Math.abs(b.y - extreme) <= 1e-7
          : Math.abs(a.x - extreme) <= 1e-7 && Math.abs(b.x - extreme) <= 1e-7;
      if (!onExtreme) continue;
      const length =
        side === "above" || side === "below" ? Math.abs(b.x - a.x) : Math.abs(b.y - a.y);
      if (length > bestLength) {
        bestLength = length;
        coordinate = side === "above" || side === "below" ? (a.x + b.x) / 2 : (a.y + b.y) / 2;
      }
    }
  }
  return coordinate;
}

function supportAlignedStart(
  parent: PlacedLavaRoom,
  childPrefabId: string,
  direction: Direction,
): number {
  const child = prefab(childPrefabId);
  const childBounds = localCollisionBounds(child);
  if (direction === "above")
    return (
      parent.x +
      flatSupportCoordinate(prefab(parent.prefabId), "above") -
      flatSupportCoordinate(child, "below") +
      childBounds.x
    );
  if (direction === "below")
    return (
      parent.x +
      flatSupportCoordinate(prefab(parent.prefabId), "below") -
      flatSupportCoordinate(child, "above") +
      childBounds.x
    );
  if (direction === "left")
    return (
      parent.y +
      flatSupportCoordinate(prefab(parent.prefabId), "left") -
      flatSupportCoordinate(child, "right") +
      childBounds.y
    );
  return (
    parent.y +
    flatSupportCoordinate(prefab(parent.prefabId), "right") -
    flatSupportCoordinate(child, "left") +
    childBounds.y
  );
}

const directionalPlacementCache = new Map<string, Readonly<{ dx: number; dy: number }>>();
let lastDirectionalFailure = "";

/**
 * Places a child outside a collision-bounds barrier, then solves monotonically outward until the
 * exact polygon-to-polygon Euclidean distance equals the seeded target. The barrier gives every
 * non-edge pair a separating axis; the polygon solve gives graph edges their real crossing length.
 */
function placeAcrossBarrier(
  node: LavaRoomNode,
  prefabId: string,
  parent: PlacedLavaRoom,
  direction: Direction,
  barrier: number,
  perpendicularStart: number,
  requestedGap: number,
): PlacedLavaRoom | undefined {
  const localBounds = localCollisionBounds(prefab(prefabId));
  const relativeBarrier =
    direction === "above" || direction === "below" ? barrier - parent.y : barrier - parent.x;
  const relativePerpendicular =
    direction === "above" || direction === "below"
      ? perpendicularStart - parent.x
      : perpendicularStart - parent.y;
  const cacheKey = [
    parent.prefabId,
    prefabId,
    direction,
    relativeBarrier.toFixed(4),
    relativePerpendicular.toFixed(4),
    requestedGap.toFixed(4),
  ].join("|");
  const cached = directionalPlacementCache.get(cacheKey);
  if (cached) return makePlaced(node, prefabId, parent.x + cached.dx, parent.y + cached.dy);

  let left = perpendicularStart;
  let top = perpendicularStart;
  if (direction === "above") top = barrier - LAVA_MIN_PLATFORM_CLEARANCE_PX - localBounds.height;
  if (direction === "below") top = barrier + LAVA_MIN_PLATFORM_CLEARANCE_PX;
  if (direction === "left") left = barrier - LAVA_MIN_PLATFORM_CLEARANCE_PX - localBounds.width;
  if (direction === "right") left = barrier + LAVA_MIN_PLATFORM_CLEARANCE_PX;
  const baseline = placedAtCollisionTopLeft(node, prefabId, left, top);
  const baselineGap = measureLavaRoomClearance(parent, baseline);
  const targetGap = Math.max(requestedGap, baselineGap);
  if (targetGap > LAVA_MAX_TRAVERSAL_GAP_PX + 1e-6) {
    lastDirectionalFailure = `${parent.nodeId}->${node.id}/${direction}=${baselineGap.toFixed(1)}`;
    return undefined;
  }

  const outward = (distance: number): PlacedLavaRoom => {
    if (direction === "above") return shifted(baseline, 0, -distance);
    if (direction === "below") return shifted(baseline, 0, distance);
    if (direction === "left") return shifted(baseline, -distance, 0);
    return shifted(baseline, distance, 0);
  };

  let result = baseline;
  if (targetGap > baselineGap + 0.01) {
    let low = 0;
    let high = LAVA_MAX_TRAVERSAL_GAP_PX;
    for (let iteration = 0; iteration < 16; iteration++) {
      const middle = (low + high) / 2;
      const candidate = outward(middle);
      if (measureLavaRoomClearance(parent, candidate) < targetGap) low = middle;
      else {
        high = middle;
        result = candidate;
      }
    }
  }
  directionalPlacementCache.set(cacheKey, { dx: result.x - parent.x, dy: result.y - parent.y });
  return result;
}

function nodeById(id: string): LavaRoomNode {
  const node = GRAPH_NODES.find((candidate) => candidate.id === id);
  if (!node) throw new Error(`unknown Lava Foundry graph node ${id}`);
  return node;
}

function constructMiddleRows(
  ids: Record<string, string>,
  gaps: GapPlan,
  mirrored: boolean,
  coalesceReward: boolean,
): PlacedLavaRoom[] | undefined {
  const outward: Direction = mirrored ? "right" : "left";
  const inward: Direction = mirrored ? "left" : "right";
  let hub = centred(nodeById("hub"), ids.hub as string, 0, 0);
  if (coalesceReward) hub = { ...hub, graphNodeIds: ["hub", "reward"] };
  const branchBounds = localCollisionBounds(prefab(ids.branch as string));
  const branch = placeAcrossBarrier(
    nodeById("branch"),
    ids.branch as string,
    hub,
    outward,
    outward === "left" ? hub.collisionBounds.x : hub.collisionBounds.x + hub.collisionBounds.width,
    rectCenterY(hub.collisionBounds) - branchBounds.height / 2,
    gaps["hub->branch"],
  );
  const exitBounds = localCollisionBounds(prefab(ids.exit as string));
  const exit = placeAcrossBarrier(
    nodeById("exit"),
    ids.exit as string,
    hub,
    inward,
    inward === "left" ? hub.collisionBounds.x : hub.collisionBounds.x + hub.collisionBounds.width,
    rectCenterY(hub.collisionBounds) - exitBounds.height / 2,
    gaps["hub->exit"],
  );
  if (!branch || !exit) return undefined;

  const middleTop = Math.min(
    branch.collisionBounds.y,
    hub.collisionBounds.y,
    exit.collisionBounds.y,
  );
  const middleBottom = Math.max(
    branch.collisionBounds.y + branch.collisionBounds.height,
    hub.collisionBounds.y + hub.collisionBounds.height,
    exit.collisionBounds.y + exit.collisionBounds.height,
  );
  const route = placeAcrossBarrier(
    nodeById("route"),
    ids.route as string,
    hub,
    "above",
    middleTop,
    supportAlignedStart(hub, ids.route as string, "above"),
    gaps["route->hub"],
  );
  if (!route) return undefined;
  const spawn = placeAcrossBarrier(
    nodeById("spawn"),
    ids.spawn as string,
    route,
    "above",
    route.collisionBounds.y,
    supportAlignedStart(route, ids.spawn as string, "above"),
    gaps["spawn->route"],
  );
  if (!spawn) return undefined;

  if (coalesceReward) return [spawn, route, hub, branch, exit];
  const rewardBounds = localCollisionBounds(prefab(ids.reward as string));
  const rewardPrefab = prefab(ids.reward as string);
  const middleLeft = Math.min(
    branch.collisionBounds.x,
    hub.collisionBounds.x,
    exit.collisionBounds.x,
  );
  const middleRight = Math.max(
    branch.collisionBounds.x + branch.collisionBounds.width,
    hub.collisionBounds.x + hub.collisionBounds.width,
    exit.collisionBounds.x + exit.collisionBounds.width,
  );
  const massiveReward =
    rewardPrefab.tags.includes("mega") || rewardPrefab.tags.includes("hero-room");
  const rewardLeft = massiveReward
    ? (middleLeft + middleRight - rewardBounds.width) / 2
    : supportAlignedStart(branch, ids.reward as string, "below");
  const reward = placeAcrossBarrier(
    nodeById("reward"),
    ids.reward as string,
    branch,
    "below",
    middleBottom,
    rewardLeft,
    gaps["branch->reward"],
  );
  return reward ? [spawn, route, hub, branch, reward, exit] : undefined;
}

function constructLandscapeHub(
  ids: Record<string, string>,
  gaps: GapPlan,
  mirrored: boolean,
): PlacedLavaRoom[] | undefined {
  const outward: Direction = mirrored ? "right" : "left";
  const baseHub = centred(nodeById("hub"), ids.hub as string, 0, 0);
  const hub: PlacedLavaRoom = { ...baseHub, graphNodeIds: ["hub", "reward"] };
  const routeBounds = localCollisionBounds(prefab(ids.route as string));
  const branchBounds = localCollisionBounds(prefab(ids.branch as string));
  const pairWidth = routeBounds.width + LAVA_MIN_PLATFORM_CLEARANCE_PX + branchBounds.width;
  const pairLeft = rectCenterX(hub.collisionBounds) - pairWidth / 2;
  const routeLeft =
    outward === "left" ? pairLeft : pairLeft + branchBounds.width + LAVA_MIN_PLATFORM_CLEARANCE_PX;
  const branchLeft =
    outward === "left" ? pairLeft + routeBounds.width + LAVA_MIN_PLATFORM_CLEARANCE_PX : pairLeft;
  const route = placeAcrossBarrier(
    nodeById("route"),
    ids.route as string,
    hub,
    "above",
    hub.collisionBounds.y,
    routeLeft,
    gaps["route->hub"],
  );
  const branch = placeAcrossBarrier(
    nodeById("branch"),
    ids.branch as string,
    hub,
    "above",
    hub.collisionBounds.y,
    branchLeft,
    gaps["hub->branch"],
  );
  if (!route || !branch) return undefined;
  const spawn = placeAcrossBarrier(
    nodeById("spawn"),
    ids.spawn as string,
    route,
    "above",
    route.collisionBounds.y,
    supportAlignedStart(route, ids.spawn as string, "above"),
    gaps["spawn->route"],
  );
  const exit = placeAcrossBarrier(
    nodeById("exit"),
    ids.exit as string,
    hub,
    "below",
    hub.collisionBounds.y + hub.collisionBounds.height,
    supportAlignedStart(hub, ids.exit as string, "below"),
    gaps["hub->exit"],
  );
  return spawn && exit ? [spawn, route, hub, branch, exit] : undefined;
}

function constructPortraitHub(
  ids: Record<string, string>,
  gaps: GapPlan,
  mirrored: boolean,
): PlacedLavaRoom[] | undefined {
  const outward: Direction = mirrored ? "right" : "left";
  const baseHub = centred(nodeById("hub"), ids.hub as string, 0, 0);
  const hub: PlacedLavaRoom = { ...baseHub, graphNodeIds: ["hub", "reward"] };
  const route = placeAcrossBarrier(
    nodeById("route"),
    ids.route as string,
    hub,
    "above",
    hub.collisionBounds.y,
    supportAlignedStart(hub, ids.route as string, "above"),
    gaps["route->hub"],
  );
  if (!route) return undefined;
  const spawnBounds = localCollisionBounds(prefab(ids.spawn as string));
  const spawn = placeAcrossBarrier(
    nodeById("spawn"),
    ids.spawn as string,
    route,
    outward,
    outward === "left"
      ? route.collisionBounds.x
      : route.collisionBounds.x + route.collisionBounds.width,
    Math.min(
      supportAlignedStart(route, ids.spawn as string, outward),
      route.collisionBounds.y + route.collisionBounds.height - spawnBounds.height,
    ),
    gaps["spawn->route"],
  );
  const branchBounds = localCollisionBounds(prefab(ids.branch as string));
  const branch = placeAcrossBarrier(
    nodeById("branch"),
    ids.branch as string,
    hub,
    outward,
    outward === "left" ? hub.collisionBounds.x : hub.collisionBounds.x + hub.collisionBounds.width,
    Math.max(
      hub.collisionBounds.y,
      Math.min(
        supportAlignedStart(hub, ids.branch as string, outward),
        hub.collisionBounds.y + hub.collisionBounds.height - branchBounds.height,
      ),
    ),
    gaps["hub->branch"],
  );
  const exit = placeAcrossBarrier(
    nodeById("exit"),
    ids.exit as string,
    hub,
    "below",
    hub.collisionBounds.y + hub.collisionBounds.height,
    supportAlignedStart(hub, ids.exit as string, "below"),
    gaps["hub->exit"],
  );
  if (!spawn || !branch || !exit) return undefined;
  // Top-aligning the side branch keeps it inside the portrait hero's vertical band.
  if (branchBounds.height > hub.collisionBounds.height) return undefined;
  return [spawn, route, hub, branch, exit];
}

function constructPortraitExit(
  ids: Record<string, string>,
  gaps: GapPlan,
  mirrored: boolean,
): PlacedLavaRoom[] | undefined {
  const heroDirection: Direction = mirrored ? "left" : "right";
  const hub = centred(nodeById("hub"), ids.hub as string, 0, 0);
  const columnEdge =
    heroDirection === "right"
      ? hub.collisionBounds.x + hub.collisionBounds.width
      : hub.collisionBounds.x;
  const alignedLeft = (prefabId: string): number => {
    const bounds = localCollisionBounds(prefab(prefabId));
    return heroDirection === "right" ? columnEdge - bounds.width : columnEdge;
  };
  const route = placeAcrossBarrier(
    nodeById("route"),
    ids.route as string,
    hub,
    "above",
    hub.collisionBounds.y,
    alignedLeft(ids.route as string),
    gaps["route->hub"],
  );
  if (!route) return undefined;
  const spawn = placeAcrossBarrier(
    nodeById("spawn"),
    ids.spawn as string,
    route,
    "above",
    route.collisionBounds.y,
    alignedLeft(ids.spawn as string),
    gaps["spawn->route"],
  );
  const branch = placeAcrossBarrier(
    nodeById("branch"),
    ids.branch as string,
    hub,
    "below",
    hub.collisionBounds.y + hub.collisionBounds.height,
    alignedLeft(ids.branch as string),
    gaps["hub->branch"],
  );
  if (!spawn || !branch) return undefined;
  const reward = placeAcrossBarrier(
    nodeById("reward"),
    ids.reward as string,
    branch,
    "below",
    branch.collisionBounds.y + branch.collisionBounds.height,
    alignedLeft(ids.reward as string),
    gaps["branch->reward"],
  );
  if (!reward) return undefined;
  const exit = placeAcrossBarrier(
    nodeById("exit"),
    ids.exit as string,
    hub,
    heroDirection,
    columnEdge,
    supportAlignedStart(hub, ids.exit as string, heroDirection),
    gaps["hub->exit"],
  );
  return exit ? [spawn, route, hub, branch, reward, exit] : undefined;
}

function constructRooms(
  ids: Record<string, string>,
  gaps: GapPlan,
  mirrored: boolean,
  heroId?: string,
  heroRole?: LavaRoomNode["role"],
  coalesceReward = false,
): PlacedLavaRoom[] | undefined {
  if (!heroId || !heroRole) return constructMiddleRows(ids, gaps, mirrored, coalesceReward);
  const heroBounds = localCollisionBounds(prefab(heroId));
  const landscape = heroBounds.width >= heroBounds.height;
  if (heroRole === "hub")
    return landscape
      ? constructLandscapeHub(ids, gaps, mirrored)
      : constructPortraitHub(ids, gaps, mirrored);
  if (heroRole === "reward" && landscape) return constructMiddleRows(ids, gaps, mirrored, false);
  if (heroRole === "exit" && !landscape) return constructPortraitExit(ids, gaps, mirrored);
  return undefined;
}

function normalizeToArena(rooms: readonly PlacedLavaRoom[]): PlacedLavaRoom[] | undefined {
  const minX = Math.min(...rooms.map((room) => room.visibleBounds.x));
  const minY = Math.min(...rooms.map((room) => room.visibleBounds.y));
  const maxX = Math.max(...rooms.map((room) => room.visibleBounds.x + room.visibleBounds.width));
  const maxY = Math.max(...rooms.map((room) => room.visibleBounds.y + room.visibleBounds.height));
  const availableWidth = LAVA_ARENA_WIDTH - MAP_MARGIN * 2;
  const availableHeight = LAVA_ARENA_HEIGHT - MAP_MARGIN * 2;
  if (maxX - minX > availableWidth || maxY - minY > availableHeight) return undefined;
  const desiredMinX = MAP_MARGIN + (availableWidth - (maxX - minX)) / 2;
  const desiredMinY = MAP_MARGIN + (availableHeight - (maxY - minY)) / 2;
  const shiftX = desiredMinX - minX;
  const shiftY = desiredMinY - minY;
  return rooms.map((room) => ({
    ...makePlaced(
      { id: room.nodeId, role: room.role },
      room.prefabId,
      room.x + shiftX,
      room.y + shiftY,
    ),
    graphNodeIds: room.graphNodeIds,
  }));
}

function pointInPolygon(point: PrefabPoint, polygon: readonly PrefabPoint[]): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const a = polygon[index] as PrefabPoint;
    const b = polygon[previous] as PrefabPoint;
    const intersects =
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y || 1e-9) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointOnRoom(room: PlacedLavaRoom, worldX: number, worldY: number): boolean {
  const value = prefab(room.prefabId);
  const point = { x: worldX - room.x, y: worldY - room.y };
  for (const surface of value.collision.surfaces) {
    if (!pointInPolygon(point, surface.polygon)) continue;
    if (surface.holes.some((hole) => pointInPolygon(point, hole))) continue;
    return true;
  }
  return false;
}

function pointSegmentDistance(point: PrefabPoint, a: PrefabPoint, b: PrefabPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= 1e-9) return Math.hypot(point.x - a.x, point.y - a.y);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq));
  return Math.hypot(point.x - (a.x + dx * t), point.y - (a.y + dy * t));
}

type LocalSegment = Readonly<{
  a: PrefabPoint;
  b: PrefabPoint;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}>;

const COLLISION_SEGMENTS = new Map<string, readonly LocalSegment[]>(
  Object.values(LAVA_PLATFORM_PREFABS).map((value) => {
    const segments: LocalSegment[] = [];
    for (const surface of value.collision.surfaces) {
      for (const ring of [surface.polygon, ...surface.holes]) {
        for (let index = 0; index < ring.length; index++) {
          const a = ring[index] as PrefabPoint;
          const b = ring[(index + 1) % ring.length] as PrefabPoint;
          segments.push({
            a,
            b,
            minX: Math.min(a.x, b.x),
            minY: Math.min(a.y, b.y),
            maxX: Math.max(a.x, b.x),
            maxY: Math.max(a.y, b.y),
          });
        }
      }
    }
    return [value.id, segments] as const;
  }),
);

function orientation(a: PrefabPoint, b: PrefabPoint, c: PrefabPoint): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function pointOnSegment(point: PrefabPoint, a: PrefabPoint, b: PrefabPoint): boolean {
  const epsilon = 1e-7;
  return (
    Math.abs(orientation(a, b, point)) <= epsilon &&
    point.x >= Math.min(a.x, b.x) - epsilon &&
    point.x <= Math.max(a.x, b.x) + epsilon &&
    point.y >= Math.min(a.y, b.y) - epsilon &&
    point.y <= Math.max(a.y, b.y) + epsilon
  );
}

function segmentsIntersect(
  a: PrefabPoint,
  b: PrefabPoint,
  c: PrefabPoint,
  d: PrefabPoint,
): boolean {
  const abC = orientation(a, b, c);
  const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a);
  const cdB = orientation(c, d, b);
  if (
    ((abC > 0 && abD < 0) || (abC < 0 && abD > 0)) &&
    ((cdA > 0 && cdB < 0) || (cdA < 0 && cdB > 0))
  )
    return true;
  return (
    pointOnSegment(c, a, b) ||
    pointOnSegment(d, a, b) ||
    pointOnSegment(a, c, d) ||
    pointOnSegment(b, c, d)
  );
}

function segmentBoundsDistance(
  a: LocalSegment,
  ax: number,
  ay: number,
  b: LocalSegment,
  bx: number,
  by: number,
) {
  const dx = Math.max(0, Math.max(a.minX + ax, b.minX + bx) - Math.min(a.maxX + ax, b.maxX + bx));
  const dy = Math.max(0, Math.max(a.minY + ay, b.minY + by) - Math.min(a.maxY + ay, b.maxY + by));
  return Math.hypot(dx, dy);
}

/**
 * Exact minimum Euclidean distance between the two filled collision-polygon sets. Outer polygon and
 * hole boundary segments are both measured; boundary intersection or filled containment returns zero.
 */
export function measureLavaRoomClearance(a: PlacedLavaRoom, b: PlacedLavaRoom): number {
  const aSegments = COLLISION_SEGMENTS.get(a.prefabId);
  const bSegments = COLLISION_SEGMENTS.get(b.prefabId);
  if (!aSegments || !bSegments)
    throw new Error(`missing collision segments for ${a.prefabId}/${b.prefabId}`);
  let minimum = Number.POSITIVE_INFINITY;
  for (const aSegment of aSegments) {
    const aStart = { x: aSegment.a.x + a.x, y: aSegment.a.y + a.y };
    const aEnd = { x: aSegment.b.x + a.x, y: aSegment.b.y + a.y };
    for (const bSegment of bSegments) {
      if (segmentBoundsDistance(aSegment, a.x, a.y, bSegment, b.x, b.y) >= minimum) continue;
      const bStart = { x: bSegment.a.x + b.x, y: bSegment.a.y + b.y };
      const bEnd = { x: bSegment.b.x + b.x, y: bSegment.b.y + b.y };
      if (segmentsIntersect(aStart, aEnd, bStart, bEnd)) return 0;
      minimum = Math.min(
        minimum,
        pointSegmentDistance(aStart, bStart, bEnd),
        pointSegmentDistance(aEnd, bStart, bEnd),
        pointSegmentDistance(bStart, aStart, aEnd),
        pointSegmentDistance(bEnd, aStart, aEnd),
      );
    }
  }
  for (const surface of prefab(a.prefabId).collision.surfaces) {
    const point = surface.polygon[0];
    if (point && pointOnRoom(b, point.x + a.x, point.y + a.y)) return 0;
  }
  for (const surface of prefab(b.prefabId).collision.surfaces) {
    const point = surface.polygon[0];
    if (point && pointOnRoom(a, point.x + b.x, point.y + b.y)) return 0;
  }
  return minimum;
}

function traversalFor(rooms: readonly PlacedLavaRoom[]) {
  const byNode = new Map<string, PlacedLavaRoom>();
  for (const room of rooms) {
    for (const nodeId of room.graphNodeIds) byNode.set(nodeId, room);
  }
  return GRAPH_EDGES.map((edge) => {
    const from = byNode.get(edge.from);
    const to = byNode.get(edge.to);
    if (!from || !to) throw new Error(`missing placed graph edge ${edge.from}->${edge.to}`);
    return {
      ...edge,
      gapPx: Math.round(measureLavaRoomClearance(from, to) * 10) / 10,
      maxReachPx: LAVA_MAX_TRAVERSAL_GAP_PX,
    };
  });
}

function distanceToSegment(point: PrefabPoint, a: PrefabPoint, b: PrefabPoint): number {
  return pointSegmentDistance(point, a, b);
}

function placeDebris(
  rooms: readonly PlacedLavaRoom[],
  random: () => number,
): LavaRoomLayout["debris"] {
  const ids = Object.keys(LAVA_DECORATIVE_PREFABS);
  const roomByNode = new Map<string, PlacedLavaRoom>();
  for (const room of rooms) {
    for (const nodeId of room.graphNodeIds) roomByNode.set(nodeId, room);
  }
  const corridors = GRAPH_EDGES.map((edge) => {
    const from = roomByNode.get(edge.from) as PlacedLavaRoom;
    const to = roomByNode.get(edge.to) as PlacedLavaRoom;
    return {
      a: { x: rectCenterX(from.collisionBounds), y: rectCenterY(from.collisionBounds) },
      b: { x: rectCenterX(to.collisionBounds), y: rectCenterY(to.collisionBounds) },
    };
  });
  const debris: Array<{
    prefabId: string;
    x: number;
    y: number;
    scale: number;
    flipX: boolean;
    nonColliding: true;
  }> = [];
  for (let attempt = 0; attempt < 120 && debris.length < 5; attempt++) {
    const x = 280 + random() * (LAVA_ARENA_WIDTH - 560);
    const y = 280 + random() * (LAVA_ARENA_HEIGHT - 560);
    if (rooms.some((room) => pointOnRoom(room, x, y))) continue;
    if (corridors.some((corridor) => distanceToSegment({ x, y }, corridor.a, corridor.b) < 420))
      continue;
    const prefabId = ids[Math.floor(random() * ids.length)];
    if (!prefabId) continue;
    debris.push({
      prefabId,
      x: Math.round(x),
      y: Math.round(y),
      scale: Math.round((0.2 + random() * 0.09) * 100) / 100,
      flipX: random() >= 0.5,
      nonColliding: true,
    });
  }
  return debris;
}

function assertConstructedLayout(
  rooms: readonly PlacedLavaRoom[],
  traversal: LavaRoomLayout["traversal"],
): void {
  for (const room of rooms) {
    const bounds = room.visibleBounds;
    if (
      bounds.x < MAP_MARGIN - 1e-6 ||
      bounds.y < MAP_MARGIN - 1e-6 ||
      bounds.x + bounds.width > LAVA_ARENA_WIDTH - MAP_MARGIN + 1e-6 ||
      bounds.y + bounds.height > LAVA_ARENA_HEIGHT - MAP_MARGIN + 1e-6
    )
      throw new Error(`Lava Foundry construction invariant: ${room.nodeId} escaped arena bounds`);
  }
  for (let first = 0; first < rooms.length; first++) {
    for (let second = first + 1; second < rooms.length; second++) {
      const a = rooms[first];
      const b = rooms[second];
      if (!a || !b) continue;
      const clearance = measureLavaRoomClearance(a, b);
      if (clearance + 0.01 < LAVA_MIN_PLATFORM_CLEARANCE_PX)
        throw new Error(
          `Lava Foundry construction invariant: ${a.nodeId}/${b.nodeId} clearance ${clearance}`,
        );
    }
  }
  for (const edge of traversal) {
    if (edge.gapPx > LAVA_MAX_TRAVERSAL_GAP_PX)
      throw new Error(
        `Lava Foundry construction invariant: ${edge.from}->${edge.to} gap ${edge.gapPx}`,
      );
  }
}

type ConstructionSpec = Readonly<{
  step: 0 | 1 | 2 | 3 | 4;
  ids: Record<string, string>;
  gaps: GapPlan;
  heroId?: string;
  heroRole?: LavaRoomNode["role"];
  coalesceReward?: boolean;
}>;

/**
 * Graph-first deterministic construction. Candidate rungs are capabilities, not random attempts:
 * each successfully constructed rung already satisfies separation/traversal by arithmetic, and only
 * its visible envelope is consulted before advancing to the next smaller deterministic capability.
 */
export function generateLavaLayout(seeds: ArenaMapSeeds): LavaRoomLayout {
  const graph = { nodes: GRAPH_NODES, edges: GRAPH_EDGES };
  const rng = makeRng(mixSeeds(seeds.seedTerrain, seeds.seedTheme, seeds.seedDecor, 0x1a7af04d));
  const random = () => rng.next();
  const wantsHero = rng.chance(LAVA_HERO_ROOM_RATE);
  const requestedHeroId = wantsHero ? HERO_IDS[Math.floor(random() * HERO_IDS.length)] : undefined;
  const requestedHeroBounds = requestedHeroId
    ? localCollisionBounds(prefab(requestedHeroId))
    : undefined;
  const requestedHeroLandscape = requestedHeroBounds
    ? requestedHeroBounds.width >= requestedHeroBounds.height
    : false;
  const requestedHeroRole: LavaRoomNode["role"] | undefined = requestedHeroId
    ? rng.chance(0.5)
      ? "hub"
      : requestedHeroLandscape
        ? "reward"
        : "exit"
    : undefined;
  const reroutedHeroRole: LavaRoomNode["role"] | undefined = requestedHeroId
    ? requestedHeroRole === "hub"
      ? requestedHeroLandscape
        ? "reward"
        : "exit"
      : "hub"
    : undefined;
  const mirrored = random() >= 0.5;
  const requestedGaps = gapPlan(random);
  const compactGaps = gapPlan(random, true);
  const requestedIds = assignment(random, requestedHeroId, requestedHeroRole);
  const compactRequestedIds = assignment(random, requestedHeroId, requestedHeroRole, true);
  const compactReroutedIds = assignment(random, requestedHeroId, reroutedHeroRole, true);
  const compactRegularIds = assignment(random, undefined, undefined, true);
  const specs: ConstructionSpec[] = [
    {
      step: 0,
      ids: requestedIds,
      gaps: requestedGaps,
      ...(requestedHeroId ? { heroId: requestedHeroId } : {}),
      ...(requestedHeroRole ? { heroRole: requestedHeroRole } : {}),
    },
    {
      step: 1,
      ids: compactRequestedIds,
      gaps: compactGaps,
      ...(requestedHeroId ? { heroId: requestedHeroId } : {}),
      ...(requestedHeroRole ? { heroRole: requestedHeroRole } : {}),
    },
    ...(requestedHeroId && reroutedHeroRole
      ? [
          {
            step: 2 as const,
            ids: compactReroutedIds,
            gaps: compactGaps,
            heroId: requestedHeroId,
            heroRole: reroutedHeroRole,
          },
        ]
      : []),
    { step: 3, ids: compactRegularIds, gaps: compactGaps },
    {
      step: 4,
      ids: compactRegularIds,
      gaps: compactGaps,
      coalesceReward: true,
    },
  ];

  const unavailable: string[] = [];
  for (const spec of specs) {
    const constructed = constructRooms(
      spec.ids,
      spec.gaps,
      mirrored,
      spec.heroId,
      spec.heroRole,
      spec.coalesceReward,
    );
    if (!constructed) {
      unavailable.push(`${spec.step}:crossing-${lastDirectionalFailure}`);
      continue;
    }
    const rooms = normalizeToArena(constructed);
    if (!rooms) {
      const minX = Math.min(...constructed.map((room) => room.visibleBounds.x));
      const minY = Math.min(...constructed.map((room) => room.visibleBounds.y));
      const maxX = Math.max(
        ...constructed.map((room) => room.visibleBounds.x + room.visibleBounds.width),
      );
      const maxY = Math.max(
        ...constructed.map((room) => room.visibleBounds.y + room.visibleBounds.height),
      );
      unavailable.push(`${spec.step}:bounds-${Math.round(maxX - minX)}x${Math.round(maxY - minY)}`);
      continue;
    }
    const traversal = traversalFor(rooms);
    assertConstructedLayout(rooms, traversal);
    return {
      dimensionId: LAVA_DIMENSION_ID,
      graph,
      rooms,
      traversal,
      debris: placeDebris(rooms, random),
      ...(spec.heroId ? { heroRoomId: spec.heroId } : {}),
      ...(spec.heroRole ? { heroRoomRole: spec.heroRole } : {}),
      degradationStep: spec.step,
      rejectedPlacements: 0,
    };
  }

  // This is the requested tripwire, not placement machinery. Rung 4's fixed regular construction is
  // smaller than the arena by arithmetic; reaching here means registry/collision data broke that proof.
  throw new Error(
    `Lava Foundry deterministic degradation ladder violated its arena proof (${unavailable.join(", ")})`,
  );
}

function polygonCentroid(polygon: readonly PrefabPoint[]): PrefabPoint {
  let area2 = 0;
  let x = 0;
  let y = 0;
  for (let index = 0; index < polygon.length; index++) {
    const a = polygon[index] as PrefabPoint;
    const b = polygon[(index + 1) % polygon.length] as PrefabPoint;
    const cross = a.x * b.y - b.x * a.y;
    area2 += cross;
    x += (a.x + b.x) * cross;
    y += (a.y + b.y) * cross;
  }
  const scale = 1 / Math.max(1e-9, area2 * 3);
  return { x: x * scale, y: y * scale };
}

export function generateLavaArena(seeds: ArenaMapSeeds): ArenaMap {
  const lavaLayout = generateLavaLayout(seeds);
  const cols = Math.floor(LAVA_ARENA_WIDTH / LAVA_COLLISION_TILE_PX);
  const rows = Math.floor(LAVA_ARENA_HEIGHT / LAVA_COLLISION_TILE_PX);
  const tiles = new Uint8Array(cols * rows).fill(TILE_PIT);
  const zoneIds = new Uint8Array(cols * rows).fill(MAP_ZONE_COMMONS);
  const roleZone = {
    spawn: MAP_ZONE_COMMONS,
    route: MAP_ZONE_SCAR,
    hub: MAP_ZONE_COMMONS,
    branch: MAP_ZONE_COVER,
    reward: MAP_ZONE_COVER,
    exit: MAP_ZONE_SCAR,
  } as const;
  for (let row = 0; row < rows; row++) {
    const y = (row + 0.5) * LAVA_COLLISION_TILE_PX;
    for (let col = 0; col < cols; col++) {
      const x = (col + 0.5) * LAVA_COLLISION_TILE_PX;
      const room = lavaLayout.rooms.find((candidate) => pointOnRoom(candidate, x, y));
      if (!room) continue;
      const index = row * cols + col;
      tiles[index] = TILE_GROUND;
      zoneIds[index] = roleZone[room.role];
    }
  }

  const spawnRoom = lavaLayout.rooms.find((room) => room.role === "spawn");
  if (!spawnRoom) throw new Error("Lava Foundry graph has no placed spawn");
  const spawnPrefab = prefab(spawnRoom.prefabId);
  const spawnSurface = spawnPrefab.collision.surfaces[0];
  if (!spawnSurface) throw new Error(`${spawnPrefab.id}: no spawn collision surface`);
  const localSpawn = polygonCentroid(spawnSurface.polygon);
  const spawnX = spawnRoom.x + localSpawn.x;
  const spawnY = spawnRoom.y + localSpawn.y;

  return {
    cols,
    rows,
    tileSize: LAVA_COLLISION_TILE_PX,
    tiles,
    zoneIds,
    zoneSeeds: [
      {
        id: MAP_ZONE_COMMONS,
        kind: "commons",
        col: Math.floor(spawnX / LAVA_COLLISION_TILE_PX),
        row: Math.floor(spawnY / LAVA_COLLISION_TILE_PX),
      },
      { id: MAP_ZONE_COVER, kind: "cover", col: 0, row: 0 },
      { id: MAP_ZONE_SCAR, kind: "scar", col: cols - 1, row: rows - 1 },
    ],
    spawnX,
    spawnY,
    seeds: { ...seeds },
    maxJumpTiles: Math.floor(LAVA_MAX_TRAVERSAL_GAP_PX / LAVA_COLLISION_TILE_PX),
    lavaLayout,
  };
}

/** Existing dimensions take the exact historical generator; only the new id selects prefab generation. */
export function generateDimensionArena(seeds: ArenaMapSeeds, dimensionId?: string): ArenaMap {
  return dimensionId === LAVA_DIMENSION_ID ? generateLavaArena(seeds) : generateArena(seeds);
}
