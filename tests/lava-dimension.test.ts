import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type ArenaMapSeeds,
  DIMENSION_IDS,
  DIST_JUMP_REACH,
  generateArena,
  generateDimensionArena,
  generateLavaArena,
  generateLavaLayout,
  isArenaDiscSafe,
  isLavaGapAtPx,
  LAVA_DECORATIVE_PREFABS,
  LAVA_DIMENSION_ID,
  LAVA_HERO_ROOM_RATE,
  LAVA_MAX_TRAVERSAL_GAP_PX,
  LAVA_MIN_PLATFORM_CLEARANCE_PX,
  LAVA_PLATFORM_PREFABS,
  measureLavaRoomClearance,
  placeChestOnArena,
  PLAYER_RADIUS,
  validateArena,
} from "@dd/shared";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = join(ROOT, "packages", "client", "public");
const COLLISION_PATH = join(ROOT, "data", "lava-foundry", "collision-surfaces.json");
const RENDERER_PATH = join(
  ROOT,
  "packages",
  "client",
  "src",
  "scenes",
  "arena",
  "lava-floor-renderer.ts",
);

const LAVA_EVIDENCE_SEEDS: ArenaMapSeeds = {
  seedTerrain: 2_654_435_761,
  seedHazard: 97,
  seedTheme: 7_919,
  seedDecor: 104_729,
};

function sample(index: number): ArenaMapSeeds {
  return {
    seedTerrain: Math.imul(index, 2_654_435_761) >>> 0,
    seedHazard: Math.imul(index, 97) >>> 0,
    seedTheme: Math.imul(index, 7_919) >>> 0,
    seedDecor: Math.imul(index, 104_729) >>> 0,
  };
}

function layoutDigest(seeds: ArenaMapSeeds): string {
  const map = generateLavaArena(seeds);
  const hash = createHash("sha256");
  hash.update(map.tiles);
  hash.update(JSON.stringify(map.lavaLayout));
  return hash.digest("hex");
}

function pointInRing(
  point: Readonly<{ x: number; y: number }>,
  ring: readonly Readonly<{ x: number; y: number }>[],
): boolean {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const a = ring[index];
    const b = ring[previous];
    if (!a || !b) continue;
    const intersects =
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y || 1e-9) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function distanceToSegment(
  point: Readonly<{ x: number; y: number }>,
  a: Readonly<{ x: number; y: number }>,
  b: Readonly<{ x: number; y: number }>,
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  const progress =
    lengthSq <= 1e-9
      ? 0
      : Math.max(
          0,
          Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq),
        );
  return Math.hypot(point.x - (a.x + dx * progress), point.y - (a.y + dy * progress));
}

function bodyCentreFitsPrefab(
  prefab: (typeof LAVA_PLATFORM_PREFABS)[string],
  point: Readonly<{ x: number; y: number }>,
): boolean {
  for (const surface of prefab.collision.surfaces) {
    if (!pointInRing(point, surface.polygon)) continue;
    if (surface.holes.some((hole) => pointInRing(point, hole))) continue;
    let edgeDistance = Number.POSITIVE_INFINITY;
    for (const ring of [surface.polygon, ...surface.holes]) {
      for (let index = 0; index < ring.length; index++) {
        const a = ring[index];
        const b = ring[(index + 1) % ring.length];
        if (a && b) edgeDistance = Math.min(edgeDistance, distanceToSegment(point, a, b));
      }
    }
    if (edgeDistance + 1e-6 >= PLAYER_RADIUS) return true;
  }
  return false;
}

function regularPlatformWalkableShare(id: string): number {
  const prefab = LAVA_PLATFORM_PREFABS[id];
  if (!prefab) throw new Error(`missing ${id}`);
  const png = PNG.sync.read(readFileSync(join(PUBLIC, prefab.file)));
  const cellPx = 12;
  let visibleFloorCells = 0;
  let walkableBodyCentres = 0;
  for (let cellY = 0; cellY < Math.ceil(png.height / cellPx); cellY++) {
    for (let cellX = 0; cellX < Math.ceil(png.width / cellPx); cellX++) {
      let opaque = 0;
      let molten = 0;
      let samples = 0;
      for (let y = cellY * cellPx; y < Math.min(png.height, (cellY + 1) * cellPx); y += 2) {
        for (let x = cellX * cellPx; x < Math.min(png.width, (cellX + 1) * cellPx); x += 2) {
          samples++;
          const offset = (y * png.width + x) * 4;
          const alpha = png.data[offset + 3] ?? 0;
          if (alpha < 40) continue;
          opaque++;
          const red = png.data[offset] ?? 0;
          const green = png.data[offset + 1] ?? 0;
          const blue = png.data[offset + 2] ?? 0;
          if (red > 105 && red > green * 1.28 && red > blue * 1.48) molten++;
        }
      }
      if (
        opaque / Math.max(1, samples) < 0.28 ||
        molten / Math.max(1, opaque) >= 0.24
      )
        continue;
      visibleFloorCells++;
      if (
        bodyCentreFitsPrefab(prefab, {
          x: (cellX + 0.5) * cellPx,
          y: (cellY + 0.5) * cellPx,
        })
      )
        walkableBodyCentres++;
    }
  }
  return Math.round((walkableBodyCentres / visibleFloorCells) * 1_000) / 10;
}

describe("Lava Foundry — additive dimension registry", () => {
  it("adds one new id after the five unchanged dimensions", () => {
    expect(DIMENSION_IDS).toEqual([
      "wild-west",
      "frostfell",
      "verdant-ruins",
      "ashlands",
      "neon-cyber",
      LAVA_DIMENSION_ID,
    ]);
  });

  it("routes every existing dimension through the byte-identical historical generator", () => {
    for (const id of DIMENSION_IDS.filter((value) => value !== LAVA_DIMENSION_ID)) {
      const historical = generateArena(LAVA_EVIDENCE_SEEDS);
      const routed = generateDimensionArena(LAVA_EVIDENCE_SEEDS, id);
      expect(Array.from(routed.tiles), id).toEqual(Array.from(historical.tiles));
      expect(Array.from(routed.zoneIds), id).toEqual(Array.from(historical.zoneIds));
      expect(routed.zoneSeeds, id).toEqual(historical.zoneSeeds);
      expect([routed.spawnX, routed.spawnY], id).toEqual([historical.spawnX, historical.spawnY]);
      expect(routed.lavaLayout, id).toBeUndefined();
    }
  });
});

describe("Lava Foundry — manifest registry and collision contract", () => {
  it("registers six platforms plus three indivisible hero rooms at native scale", () => {
    const prefabs = Object.values(LAVA_PLATFORM_PREFABS);
    expect(prefabs).toHaveLength(9);
    expect(prefabs.filter((prefab) => prefab.tags.includes("hero-room"))).toHaveLength(3);
    expect(prefabs.filter((prefab) => prefab.tags.includes("platform"))).toHaveLength(9);
    for (const prefab of prefabs) {
      expect(prefab.nativeScale, prefab.id).toBe(1);
      expect(prefab.collision.coordinateSpace, prefab.id).toBe("source-pixels");
      expect(prefab.collision.surfaces.length, prefab.id).toBeGreaterThan(0);
      const path = join(PUBLIC, prefab.file);
      expect(existsSync(path), prefab.id).toBe(true);
      const png = PNG.sync.read(readFileSync(path));
      expect([png.width, png.height], prefab.id).toEqual([prefab.width, prefab.height]);
    }
  });

  it("keeps all 20 broken pieces decorative and out of collision authority", () => {
    const debris = Object.values(LAVA_DECORATIVE_PREFABS);
    expect(debris).toHaveLength(20);
    for (const prefab of debris) {
      expect(prefab.nonColliding, prefab.id).toBe(true);
      expect(prefab.tags, prefab.id).toContain("decorative-debris");
      expect(existsSync(join(PUBLIC, prefab.file)), prefab.id).toBe(true);
      expect(LAVA_PLATFORM_PREFABS[prefab.id], prefab.id).toBeUndefined();
    }
  });

  it("ships a painter-replaceable prefab-id keyed polygon format", () => {
    const data = JSON.parse(readFileSync(COLLISION_PATH, "utf8")) as {
      formatVersion: number;
      dimensionId: string;
      units: string;
      prefabs: Record<
        string,
        {
          coordinateSpace: string;
          provenance: {
            kind: string;
            edgeInsetPx?: number;
            bottomTrimFraction?: number;
            minHoleInscribedDiameterPx?: number;
          };
          surfaces: Array<{ id: string; polygon: unknown[]; holes: unknown[][] }>;
        }
      >;
    };
    expect(data).toMatchObject({
      formatVersion: 1,
      dimensionId: LAVA_DIMENSION_ID,
      units: "source-pixels",
    });
    expect(Object.keys(data.prefabs).sort()).toEqual(Object.keys(LAVA_PLATFORM_PREFABS).sort());
    for (const [id, entry] of Object.entries(data.prefabs)) {
      expect(entry.coordinateSpace, id).toBe("source-pixels");
      expect(entry.provenance.kind, id).toMatch(/^(derived-alpha-v1|authored)$/);
      if (entry.provenance.kind === "derived-alpha-v1") {
        expect(entry.provenance.edgeInsetPx, id).toBe(0);
        expect(entry.provenance.bottomTrimFraction, id).toBeUndefined();
        expect(entry.provenance.minHoleInscribedDiameterPx, id).toBe(PLAYER_RADIUS * 2);
      }
      expect(entry.surfaces.length, id).toBeGreaterThan(0);
      for (const surface of entry.surfaces) {
        expect(surface.polygon.length, `${id}/${surface.id}`).toBeGreaterThanOrEqual(3);
        expect(Array.isArray(surface.holes), `${id}/${surface.id}`).toBe(true);
      }
    }
  });

  it("keeps a player-radius body centre on at least 80% of every prefab's drawn floor", () => {
    expect(
      Object.fromEntries(
        [
          "broken-glass-observatory",
          "broken-turntable-arena",
          "broken-lavafall-overlook",
          "broken-reactor-arena",
          "broken-security-gate-platform",
          "broken-mega-arena",
          "dual-turntable-bridge",
          "security-to-turntable-bridge",
          "glass-to-reactor-vertical-bridge",
        ].map((id) => [id, regularPlatformWalkableShare(id)]),
      ),
    ).toEqual({
      "broken-glass-observatory": 84.5,
      "broken-turntable-arena": 84.6,
      "broken-lavafall-overlook": 83.7,
      "broken-reactor-arena": 82.3,
      "broken-security-gate-platform": 89.1,
      "broken-mega-arena": 91.9,
      "dual-turntable-bridge": 87.6,
      "security-to-turntable-bridge": 88.8,
      "glass-to-reactor-vertical-bridge": 90.3,
    });
  });

  it("renders platform/hero PNGs with scale=1 and uses endlessly moving tileSprites", () => {
    const source = readFileSync(RENDERER_PATH, "utf8");
    expect(source).toContain(".setScale(room.nativeScale)");
    expect(source).not.toMatch(/setDisplaySize\([^)]*room/);
    expect(source.match(/\.tileSprite\(/g)).toHaveLength(2);
    expect(source).toContain("camera.scrollX * 0.065");
    expect(source).toContain("timeMs * 0.024");
  });
});

describe("Lava Foundry — graph placement, walkability, and determinism", () => {
  it("builds the abstract spawn/route/branch/hub/reward/exit graph before placing art", () => {
    const map = generateLavaArena(LAVA_EVIDENCE_SEEDS);
    expect(map.lavaLayout?.graph.nodes.map((node) => node.role).sort()).toEqual([
      "branch",
      "exit",
      "hub",
      "reward",
      "route",
      "spawn",
    ]);
    expect(map.lavaLayout?.graph.edges).toEqual([
      { from: "spawn", to: "route" },
      { from: "route", to: "hub" },
      { from: "hub", to: "exit" },
      { from: "hub", to: "branch" },
      { from: "branch", to: "reward" },
    ]);
    expect(map.lavaLayout?.rooms.every((room) => room.nativeScale === 1)).toBe(true);
  });

  it("keeps every placed graph crossing under the real shipped distance-jump reach", () => {
    expect(LAVA_MAX_TRAVERSAL_GAP_PX).toBeLessThan(DIST_JUMP_REACH);
    for (let index = 1; index <= 100; index++) {
      const map = generateLavaArena(sample(index));
      const validation = validateArena(map);
      expect(validation.ok, `seed ${index}: ${validation.reason}`).toBe(true);
      for (const edge of map.lavaLayout?.traversal ?? []) {
        expect(edge.gapPx, `seed ${index} ${edge.from}->${edge.to}`).toBeLessThanOrEqual(
          LAVA_MAX_TRAVERSAL_GAP_PX,
        );
      }
    }
  }, 30_000);

  it("constructs exact collision-surface clearance and traversal invariants over 2,000 seeds", async () => {
    const failures: string[] = [];
    let heroLayouts = 0;
    let destinationHeroes = 0;
    for (let index = 1; index <= 2_000; index++) {
      if (index % 50 === 0) await new Promise<void>((resolve) => setImmediate(resolve));
      let layout: ReturnType<typeof generateLavaLayout>;
      try {
        layout = generateLavaLayout(sample(index));
      } catch (error) {
        failures.push(`seed ${index} threw: ${String(error)}`);
        continue;
      }
      expect(layout.rejectedPlacements, `seed ${index}`).toBe(0);
      for (let first = 0; first < layout.rooms.length; first++) {
        for (let second = first + 1; second < layout.rooms.length; second++) {
          const a = layout.rooms[first];
          const b = layout.rooms[second];
          if (!a || !b) throw new Error(`missing room pair ${first}/${second}`);
          const clearance = measureLavaRoomClearance(a, b);
          expect(
            clearance + 0.01,
            `seed ${index}: ${a.nodeId}/${b.nodeId} exact polygon clearance ${clearance}`,
          ).toBeGreaterThanOrEqual(LAVA_MIN_PLATFORM_CLEARANCE_PX);
        }
      }
      for (const edge of layout.traversal) {
        expect(edge.gapPx, `seed ${index}: ${edge.from}->${edge.to}`).toBeGreaterThanOrEqual(
          LAVA_MIN_PLATFORM_CLEARANCE_PX,
        );
        expect(edge.gapPx, `seed ${index}: ${edge.from}->${edge.to}`).toBeLessThanOrEqual(
          LAVA_MAX_TRAVERSAL_GAP_PX,
        );
      }
      if (layout.heroRoomId) {
        heroLayouts++;
        const instances = layout.rooms.filter((room) => room.prefabId === layout.heroRoomId);
        expect(instances, layout.heroRoomId).toHaveLength(1);
        expect(instances[0]?.nativeScale, layout.heroRoomId).toBe(1);
        if (layout.heroRoomRole === "hub")
          expect(instances[0]?.graphNodeIds, layout.heroRoomId).toEqual(["hub", "reward"]);
        else {
          expect(instances[0]?.graphNodeIds, layout.heroRoomId).toEqual([layout.heroRoomRole]);
          destinationHeroes++;
        }
      }
    }
    expect(failures).toEqual([]);
    expect(LAVA_HERO_ROOM_RATE).toBe(0.5);
    expect(heroLayouts / 2_000).toBeGreaterThanOrEqual(0.48);
    expect(destinationHeroes / 2_000).toBeGreaterThanOrEqual(0.2);
  }, 120_000);

  it("keeps genuine reactor openings lethal and the full ±100px join jitter on the spawn deck", () => {
    const map = generateLavaArena(LAVA_EVIDENCE_SEEDS);
    const reactor = map.lavaLayout?.rooms.find((room) => room.prefabId === "broken-reactor-arena");
    const hole = LAVA_PLATFORM_PREFABS["broken-reactor-arena"]?.collision.surfaces[0]?.holes[0];
    expect(reactor).toBeDefined();
    expect(hole).toBeDefined();
    if (reactor && hole) {
      const x = reactor.x + hole.reduce((sum, point) => sum + point.x, 0) / hole.length;
      const y = reactor.y + hole.reduce((sum, point) => sum + point.y, 0) / hole.length;
      expect(isLavaGapAtPx(map, x, y)).toBe(true);
    }
    const bridgeMap = generateLavaArena(sample(14));
    const bridge = bridgeMap.lavaLayout?.rooms.find(
      (room) => room.prefabId === "glass-to-reactor-vertical-bridge",
    );
    const bridgeHoles =
      LAVA_PLATFORM_PREFABS["glass-to-reactor-vertical-bridge"]?.collision.surfaces[0]?.holes;
    expect(bridge).toBeDefined();
    expect(bridgeHoles).toHaveLength(1);
    const bridgeHole = bridgeHoles?.[0];
    if (bridge && bridgeHole) {
      const x = bridge.x + bridgeHole.reduce((sum, point) => sum + point.x, 0) / bridgeHole.length;
      const y = bridge.y + bridgeHole.reduce((sum, point) => sum + point.y, 0) / bridgeHole.length;
      expect(isLavaGapAtPx(bridgeMap, x, y)).toBe(true);
    }
    for (let x = -100; x <= 100; x += 20) {
      for (let y = -100; y <= 100; y += 20) {
        expect(isLavaGapAtPx(map, map.spawnX + x, map.spawnY + y), `${x},${y}`).toBe(false);
      }
    }
  });

  it("supports the existing full-footprint chest pipeline on the finer collision raster", () => {
    const map = generateLavaArena(LAVA_EVIDENCE_SEEDS);
    expect(map.tileSize).toBe(20);
    expect(isArenaDiscSafe(map, map.spawnX, map.spawnY, 24)).toBe(true);
    const chest = placeChestOnArena(map, 123, 1, 500, []);
    expect(isArenaDiscSafe(map, chest.x, chest.y, 24)).toBe(true);
  });

  it("regenerates byte-identically from the evidence seed", () => {
    const first = layoutDigest(LAVA_EVIDENCE_SEEDS);
    const second = layoutDigest({ ...LAVA_EVIDENCE_SEEDS });
    expect(second).toBe(first);
    expect(first).toBe("2fdbbc3f63570be63ff40d49636a140058cfd8f256aaee2b522b5df0c8b59433");
  });
});
