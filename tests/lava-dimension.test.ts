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
  isArenaDiscSafe,
  isPitAtPx,
  LAVA_DECORATIVE_PREFABS,
  LAVA_DIMENSION_ID,
  LAVA_MAX_TRAVERSAL_GAP_PX,
  LAVA_PLATFORM_PREFABS,
  placeChestOnArena,
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

function overlapFraction(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): number {
  const width = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const height = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return (width * height) / Math.max(1, Math.min(a.width * a.height, b.width * b.height));
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
          provenance: { kind: string };
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
      expect(entry.surfaces.length, id).toBeGreaterThan(0);
      for (const surface of entry.surfaces) {
        expect(surface.polygon.length, `${id}/${surface.id}`).toBeGreaterThanOrEqual(3);
        expect(Array.isArray(surface.holes), `${id}/${surface.id}`).toBe(true);
      }
    }
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

  it("rejects heavy visible overlaps and keeps every imported hero image indivisible when selected", () => {
    for (const index of [1, 2, 26, 52, 77]) {
      const map = generateLavaArena(sample(index));
      const rooms = map.lavaLayout?.rooms ?? [];
      for (let a = 0; a < rooms.length; a++) {
        for (let b = a + 1; b < rooms.length; b++) {
          const left = rooms[a];
          const right = rooms[b];
          if (!left || !right) throw new Error(`missing room pair ${a}/${b}`);
          expect(
            overlapFraction(left.visibleBounds, right.visibleBounds),
            `seed ${index}: ${left.nodeId}/${right.nodeId}`,
          ).toBeLessThanOrEqual(0.32);
        }
      }
      const heroId = map.lavaLayout?.heroRoomId;
      if (heroId) {
        const instances = rooms.filter((room) => room.prefabId === heroId);
        expect(instances, heroId).toHaveLength(1);
        expect(instances[0]?.graphNodeIds, heroId).toEqual(["hub", "reward"]);
      }
    }
    expect(generateLavaArena(sample(26)).lavaLayout?.heroRoomId).toBe("dual-turntable-bridge");
    expect(generateLavaArena(sample(52)).lavaLayout?.heroRoomId).toBe(
      "security-to-turntable-bridge",
    );
    expect(generateLavaArena(sample(77)).lavaLayout?.heroRoomId).toBe(
      "glass-to-reactor-vertical-bridge",
    );
  });

  it("keeps reactor openings lethal and the full ±100px join jitter on the spawn deck", () => {
    const map = generateLavaArena(LAVA_EVIDENCE_SEEDS);
    const reactor = map.lavaLayout?.rooms.find((room) => room.prefabId === "broken-reactor-arena");
    const hole = LAVA_PLATFORM_PREFABS["broken-reactor-arena"]?.collision.surfaces[0]?.holes[0];
    expect(reactor).toBeDefined();
    expect(hole).toBeDefined();
    if (reactor && hole) {
      const x = reactor.x + hole.reduce((sum, point) => sum + point.x, 0) / hole.length;
      const y = reactor.y + hole.reduce((sum, point) => sum + point.y, 0) / hole.length;
      expect(isPitAtPx(map, x, y)).toBe(true);
    }
    for (let x = -100; x <= 100; x += 20) {
      for (let y = -100; y <= 100; y += 20) {
        expect(isPitAtPx(map, map.spawnX + x, map.spawnY + y), `${x},${y}`).toBe(false);
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
    expect(first).toBe("d810d5d79e78f8a3d2d8126157d76018200150d738cf7745e1a047a09a6f08f2");
  });
});
