import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
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
/** Leaves 32 px beneath the real 372 px distance-jump reach; polygons already inset actor centres. */
export const LAVA_MAX_TRAVERSAL_GAP_PX = DIST_JUMP_REACH - 32;
const TARGET_GAP_MIN = 72;
const TARGET_GAP_MAX = 124;
const MAX_VISIBLE_OVERLAP_FRACTION = 0.32;
const MAP_MARGIN = 12;

type Rect = { x: number; y: number; width: number; height: number };
type Direction = "above" | "right" | "below" | "left";

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

function relative(
  node: LavaRoomNode,
  prefabId: string,
  parent: PlacedLavaRoom,
  direction: Direction,
  gap: number,
  alignment?: number,
): PlacedLavaRoom {
  const bounds = localCollisionBounds(prefab(prefabId));
  const parentBounds = parent.collisionBounds;
  if (direction === "above") {
    const targetX = alignment ?? rectCenterX(parentBounds);
    return makePlaced(
      node,
      prefabId,
      targetX - rectCenterX(bounds),
      parentBounds.y - gap - (bounds.y + bounds.height),
    );
  }
  if (direction === "below") {
    const targetX = alignment ?? rectCenterX(parentBounds);
    return makePlaced(
      node,
      prefabId,
      targetX - rectCenterX(bounds),
      parentBounds.y + parentBounds.height + gap - bounds.y,
    );
  }
  if (direction === "left") {
    const targetY = alignment ?? rectCenterY(parentBounds);
    return makePlaced(
      node,
      prefabId,
      parentBounds.x - gap - (bounds.x + bounds.width),
      targetY - rectCenterY(bounds),
    );
  }
  const targetY = alignment ?? rectCenterY(parentBounds);
  return makePlaced(
    node,
    prefabId,
    parentBounds.x + parentBounds.width + gap - bounds.x,
    targetY - rectCenterY(bounds),
  );
}

function shuffle<T>(values: readonly T[], random: () => number): T[] {
  const out = [...values];
  for (let index = out.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [out[index], out[other]] = [out[other] as T, out[index] as T];
  }
  return out;
}

function assignment(random: () => number, heroId?: string): Record<string, string> {
  const regular = shuffle(REGULAR_IDS, random);
  const take = (fallback: string) => regular.shift() ?? fallback;
  return {
    spawn: "broken-security-gate-platform",
    route: take("broken-reactor-arena"),
    hub: heroId ?? take("broken-turntable-arena"),
    branch: take("broken-lavafall-overlook"),
    reward: take("broken-glass-observatory"),
    exit: take("broken-reactor-arena"),
  };
}

function gap(random: () => number): number {
  return Math.round(TARGET_GAP_MIN + random() * (TARGET_GAP_MAX - TARGET_GAP_MIN));
}

function normalLayout(
  ids: Record<string, string>,
  random: () => number,
  mirrored: boolean,
): PlacedLavaRoom[] {
  const byId = new Map(GRAPH_NODES.map((node) => [node.id, node]));
  const hub = centred(byId.get("hub") as LavaRoomNode, ids.hub as string, ARENA_WIDTH / 2, 2_180);
  const route = relative(
    byId.get("route") as LavaRoomNode,
    ids.route as string,
    hub,
    "above",
    gap(random),
  );
  const spawn = relative(
    byId.get("spawn") as LavaRoomNode,
    ids.spawn as string,
    route,
    mirrored ? "right" : "left",
    gap(random),
  );
  const exit = relative(
    byId.get("exit") as LavaRoomNode,
    ids.exit as string,
    hub,
    mirrored ? "left" : "right",
    gap(random),
  );
  const branch = relative(
    byId.get("branch") as LavaRoomNode,
    ids.branch as string,
    hub,
    mirrored ? "right" : "left",
    gap(random),
  );
  const reward = relative(
    byId.get("reward") as LavaRoomNode,
    ids.reward as string,
    branch,
    "below",
    gap(random),
  );
  return [spawn, route, hub, branch, reward, exit];
}

function heroLayout(
  ids: Record<string, string>,
  random: () => number,
  mirrored: boolean,
): PlacedLavaRoom[] {
  const byId = new Map(GRAPH_NODES.map((node) => [node.id, node]));
  const baseHub = centred(
    byId.get("hub") as LavaRoomNode,
    ids.hub as string,
    ARENA_WIDTH / 2,
    ARENA_HEIGHT / 2,
  );
  // A mega-connected PNG is one authored room. Its broad interior hosts both hub and reward graph beats;
  // the image is never split, duplicated, tiled, or treated as two platform prefabs.
  const hub: PlacedLavaRoom = { ...baseHub, graphNodeIds: ["hub", "reward"] };
  const landscape = hub.collisionBounds.width >= hub.collisionBounds.height;
  const connectedHero = prefab(ids.hub as string).tags.includes("hero-room");
  const heroConnectionGap = () =>
    connectedHero ? (landscape ? Math.max(0, gap(random) - 60) : -120) : gap(random) + 30;
  if (landscape) {
    const route = relative(
      byId.get("route") as LavaRoomNode,
      ids.route as string,
      hub,
      "above",
      heroConnectionGap(),
    );
    const spawn = relative(
      byId.get("spawn") as LavaRoomNode,
      ids.spawn as string,
      route,
      mirrored ? "right" : "left",
      gap(random),
    );
    const leftTarget = hub.collisionBounds.x + hub.collisionBounds.width * 0.23;
    const rightTarget = hub.collisionBounds.x + hub.collisionBounds.width * 0.77;
    const branch = relative(
      byId.get("branch") as LavaRoomNode,
      ids.branch as string,
      hub,
      "below",
      heroConnectionGap(),
      mirrored ? rightTarget : leftTarget,
    );
    const exit = relative(
      byId.get("exit") as LavaRoomNode,
      ids.exit as string,
      hub,
      "below",
      heroConnectionGap(),
      mirrored ? leftTarget : rightTarget,
    );
    return [spawn, route, hub, branch, exit];
  }

  const upperTarget = hub.collisionBounds.y + hub.collisionBounds.height * 0.24;
  const lowerTarget = hub.collisionBounds.y + hub.collisionBounds.height * 0.76;
  const route = relative(
    byId.get("route") as LavaRoomNode,
    ids.route as string,
    hub,
    mirrored ? "right" : "left",
    heroConnectionGap(),
    upperTarget,
  );
  const spawn = relative(
    byId.get("spawn") as LavaRoomNode,
    ids.spawn as string,
    route,
    "above",
    gap(random),
  );
  const branch = relative(
    byId.get("branch") as LavaRoomNode,
    ids.branch as string,
    hub,
    mirrored ? "right" : "left",
    heroConnectionGap(),
    lowerTarget,
  );
  const exit = relative(
    byId.get("exit") as LavaRoomNode,
    ids.exit as string,
    hub,
    mirrored ? "left" : "right",
    heroConnectionGap(),
    lowerTarget,
  );
  return [spawn, route, hub, branch, exit];
}

function overlapArea(a: Rect, b: Rect): number {
  const width = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const height = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return width * height;
}

function normalizeToArena(rooms: readonly PlacedLavaRoom[]): PlacedLavaRoom[] {
  const minX = Math.min(...rooms.map((room) => room.visibleBounds.x));
  const minY = Math.min(...rooms.map((room) => room.visibleBounds.y));
  const maxX = Math.max(...rooms.map((room) => room.visibleBounds.x + room.visibleBounds.width));
  const maxY = Math.max(...rooms.map((room) => room.visibleBounds.y + room.visibleBounds.height));
  const availableWidth = ARENA_WIDTH - MAP_MARGIN * 2;
  const availableHeight = ARENA_HEIGHT - MAP_MARGIN * 2;
  if (maxX - minX > availableWidth || maxY - minY > availableHeight) return [...rooms];
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

function layoutFits(rooms: readonly PlacedLavaRoom[]): boolean {
  for (const room of rooms) {
    const bounds = room.visibleBounds;
    if (
      bounds.x < MAP_MARGIN ||
      bounds.y < MAP_MARGIN ||
      bounds.x + bounds.width > ARENA_WIDTH - MAP_MARGIN ||
      bounds.y + bounds.height > ARENA_HEIGHT - MAP_MARGIN
    ) {
      return false;
    }
  }
  for (let first = 0; first < rooms.length; first++) {
    for (let second = first + 1; second < rooms.length; second++) {
      const a = rooms[first]?.visibleBounds;
      const b = rooms[second]?.visibleBounds;
      if (!a || !b) continue;
      const overlap = overlapArea(a, b);
      const smaller = Math.min(a.width * a.height, b.width * b.height);
      if (overlap / Math.max(1, smaller) > MAX_VISIBLE_OVERLAP_FRACTION) return false;
    }
  }
  return true;
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

function roomDistance(a: PlacedLavaRoom, b: PlacedLavaRoom): number {
  const sampleStep = LAVA_COLLISION_TILE_PX / 2;
  const horizontalGap = (): number => {
    const left = rectCenterX(a.collisionBounds) <= rectCenterX(b.collisionBounds) ? a : b;
    const right = left === a ? b : a;
    const top = Math.max(left.collisionBounds.y, right.collisionBounds.y);
    const bottom = Math.min(
      left.collisionBounds.y + left.collisionBounds.height,
      right.collisionBounds.y + right.collisionBounds.height,
    );
    let minimum = Number.POSITIVE_INFINITY;
    for (let y = top + sampleStep / 2; y <= bottom; y += sampleStep) {
      let leftEdge = Number.NEGATIVE_INFINITY;
      let rightEdge = Number.POSITIVE_INFINITY;
      for (
        let x = left.collisionBounds.x;
        x <= left.collisionBounds.x + left.collisionBounds.width;
        x += sampleStep
      ) {
        if (pointOnRoom(left, x, y)) leftEdge = Math.max(leftEdge, x);
      }
      for (
        let x = right.collisionBounds.x;
        x <= right.collisionBounds.x + right.collisionBounds.width;
        x += sampleStep
      ) {
        if (pointOnRoom(right, x, y)) rightEdge = Math.min(rightEdge, x);
      }
      if (Number.isFinite(leftEdge) && Number.isFinite(rightEdge)) {
        minimum = Math.min(minimum, Math.max(0, rightEdge - leftEdge));
      }
    }
    return minimum;
  };

  const verticalGap = (): number => {
    const topRoom = rectCenterY(a.collisionBounds) <= rectCenterY(b.collisionBounds) ? a : b;
    const bottomRoom = topRoom === a ? b : a;
    const left = Math.max(topRoom.collisionBounds.x, bottomRoom.collisionBounds.x);
    const right = Math.min(
      topRoom.collisionBounds.x + topRoom.collisionBounds.width,
      bottomRoom.collisionBounds.x + bottomRoom.collisionBounds.width,
    );
    let minimum = Number.POSITIVE_INFINITY;
    for (let x = left + sampleStep / 2; x <= right; x += sampleStep) {
      let topEdge = Number.NEGATIVE_INFINITY;
      let bottomEdge = Number.POSITIVE_INFINITY;
      for (
        let y = topRoom.collisionBounds.y;
        y <= topRoom.collisionBounds.y + topRoom.collisionBounds.height;
        y += sampleStep
      ) {
        if (pointOnRoom(topRoom, x, y)) topEdge = Math.max(topEdge, y);
      }
      for (
        let y = bottomRoom.collisionBounds.y;
        y <= bottomRoom.collisionBounds.y + bottomRoom.collisionBounds.height;
        y += sampleStep
      ) {
        if (pointOnRoom(bottomRoom, x, y)) bottomEdge = Math.min(bottomEdge, y);
      }
      if (Number.isFinite(topEdge) && Number.isFinite(bottomEdge)) {
        minimum = Math.min(minimum, Math.max(0, bottomEdge - topEdge));
      }
    }
    return minimum;
  };

  return Math.min(horizontalGap(), verticalGap());
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
      gapPx: Math.round(roomDistance(from, to) * 10) / 10,
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
    const x = 280 + random() * (ARENA_WIDTH - 560);
    const y = 280 + random() * (ARENA_HEIGHT - 560);
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

function generateLayout(seeds: ArenaMapSeeds): LavaRoomLayout {
  // Graph is constructed first and never depends on which art is chosen.
  const graph = { nodes: GRAPH_NODES, edges: GRAPH_EDGES };
  const rng = makeRng(mixSeeds(seeds.seedTerrain, seeds.seedTheme, seeds.seedDecor, 0x1a7af04d));
  const random = () => rng.next();
  const wantsHero = rng.chance(0.16);
  const heroId = wantsHero ? HERO_IDS[Math.floor(random() * HERO_IDS.length)] : undefined;
  let rejectedPlacements = 0;
  let lastFailure = "";
  for (let attempt = 0; attempt < 32; attempt++) {
    const useHero = attempt < 16 ? heroId : undefined;
    const ids = assignment(random, useHero);
    const mirrored = random() >= 0.5;
    const rooms = normalizeToArena(
      useHero ? heroLayout(ids, random, mirrored) : normalLayout(ids, random, mirrored),
    );
    const traversal = traversalFor(rooms);
    const fits = layoutFits(rooms);
    const longEdge = traversal.find((edge) => edge.gapPx > LAVA_MAX_TRAVERSAL_GAP_PX);
    if (!fits || longEdge) {
      lastFailure = !fits
        ? `bounds/overlap: ${rooms
            .map(
              (room) =>
                `${room.nodeId}=${Math.round(room.visibleBounds.x)},${Math.round(room.visibleBounds.y)},${room.visibleBounds.width}x${room.visibleBounds.height}`,
            )
            .join("; ")}`
        : `${longEdge?.from}->${longEdge?.to} gap ${longEdge?.gapPx}`;
      rejectedPlacements++;
      continue;
    }
    return {
      dimensionId: LAVA_DIMENSION_ID,
      graph,
      rooms,
      traversal,
      debris: placeDebris(rooms, random),
      ...(useHero ? { heroRoomId: useHero } : {}),
      rejectedPlacements,
    };
  }
  throw new Error(
    `Lava Foundry placement exhausted 32 deterministic overlap/traversal attempts (${lastFailure})`,
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
  const lavaLayout = generateLayout(seeds);
  const cols = Math.floor(ARENA_WIDTH / LAVA_COLLISION_TILE_PX);
  const rows = Math.floor(ARENA_HEIGHT / LAVA_COLLISION_TILE_PX);
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
