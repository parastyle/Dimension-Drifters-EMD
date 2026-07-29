import {
  ARENA_GATE_PAIR_GAP,
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type ArenaMapSeeds,
  auditArenaNavigation,
  DIMENSION_IDS,
  EXTRACT_RADIUS,
  generateArena,
  generateDimensionArena,
  isArenaDiscSafe,
  LAVA_DIMENSION_ID,
  MAP_TILE,
  MAP_ZONE_COMMONS,
  MAP_ZONE_COUNT,
  MAP_ZONE_COVER,
  MAP_ZONE_SCAR,
  placeArenaGatePair,
  TILE_GROUND,
  TILE_LAVA_GAP,
  tileAtPx,
  validateArena,
  zoneAtTile,
} from "@dd/shared";
import { describe, expect, it, vi } from "vitest";

vi.setConfig({ testTimeout: 30_000 });

const seeds = (a: number, b: number, c: number, d: number): ArenaMapSeeds => ({
  seedTerrain: a,
  seedHazard: b,
  seedTheme: c,
  seedDecor: d,
});

const SAMPLES: ArenaMapSeeds[] = Array.from({ length: 32 }, (_, index) =>
  seeds(index * 2_654_435_761, index * 40_503 + 7, index + 1, index * 13 + 5),
);

function connectedZoneSize(map: ReturnType<typeof generateArena>, zoneId: number): number {
  const seed = map.zoneSeeds.find((entry) => entry.id === zoneId);
  if (!seed) return 0;
  const start = seed.row * map.cols + seed.col;
  const seen = new Uint8Array(map.zoneIds.length);
  const stack = [start];
  seen[start] = 1;
  let count = 0;
  while (stack.length) {
    const current = stack.pop() as number;
    count++;
    const col = current % map.cols;
    const row = Math.floor(current / map.cols);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const x = col + dx;
      const y = row + dy;
      if (x < 0 || y < 0 || x >= map.cols || y >= map.rows) continue;
      const next = y * map.cols + x;
      if (!seen[next] && map.zoneIds[next] === zoneId) {
        seen[next] = 1;
        stack.push(next);
      }
    }
  }
  return count;
}

describe("open arena generation", () => {
  it("uses the eight-times-linear 38,400px arena and 480x480 grid", () => {
    const map = generateArena(seeds(1, 2, 3, 4));
    expect([ARENA_WIDTH, ARENA_HEIGHT, MAP_TILE]).toEqual([38_400, 38_400, 80]);
    expect([map.cols, map.rows, map.tiles.length]).toEqual([480, 480, 230_400]);

    const formerSize = generateArena(seeds(1, 2, 3, 4), 4_800, 4_800);
    expect([formerSize.cols, formerSize.rows, formerSize.tiles.length]).toEqual([60, 60, 3_600]);
  });

  it("contains zero lava-gap tiles across generated maps", () => {
    for (const sample of SAMPLES) {
      const map = generateArena(sample);
      expect(map.tiles.indexOf(TILE_LAVA_GAP), `seed ${JSON.stringify(sample)}`).toBe(-1);
      expect(map.tiles.every((tile) => tile === TILE_GROUND)).toBe(true);
    }
  });

  it("loads every pre-lava dimension on the continuous open-arena generator", () => {
    const historicalIds = DIMENSION_IDS.filter((id) => id !== LAVA_DIMENSION_ID);
    expect(historicalIds).toHaveLength(5);
    for (const id of historicalIds) {
      const map = generateDimensionArena(seeds(11, 22, 33, 44), id);
      expect(map.lavaLayout, id).toBeUndefined();
      expect(map.tiles.indexOf(TILE_LAVA_GAP), id).toBe(-1);
      expect(validateArena(map), id).toEqual({ ok: true, reason: "" });
    }
  });

  it("reproduces byte-identical ground and macro geography from the synced seeds", () => {
    for (const sample of SAMPLES.slice(0, 4)) {
      const serverMap = generateArena(sample);
      const clientMap = generateArena(sample);
      expect(clientMap.tiles).toEqual(serverMap.tiles);
      expect(clientMap.zoneIds).toEqual(serverMap.zoneIds);
      expect(clientMap.zoneSeeds).toEqual(serverMap.zoneSeeds);
      expect([clientMap.spawnX, clientMap.spawnY]).toEqual([serverMap.spawnX, serverMap.spawnY]);
    }
  });

  it("still varies macro geography across seeds", () => {
    const fingerprints = new Set(
      SAMPLES.slice(0, 16).map((sample) => generateArena(sample).zoneIds.join("")),
    );
    expect(fingerprints.size).toBeGreaterThan(10);
  });

  it("validates continuous navigation and all three connected macro zones", () => {
    for (const sample of SAMPLES.slice(0, 8)) {
      const map = generateArena(sample);
      const validation = validateArena(map);
      expect(validation.ok, `${JSON.stringify(sample)}: ${validation.reason}`).toBe(true);
      const audit = auditArenaNavigation(map);
      expect(audit).toEqual({
        ok: true,
        reason: "",
        reachableCells: map.tiles.length,
        navigableCells: map.tiles.length,
      });

      const counts = new Int32Array(MAP_ZONE_COUNT);
      for (const zoneId of map.zoneIds) counts[zoneId] = (counts[zoneId] ?? 0) + 1;
      expect(map.zoneSeeds.map((entry) => entry.id).sort()).toEqual([
        MAP_ZONE_COMMONS,
        MAP_ZONE_COVER,
        MAP_ZONE_SCAR,
      ]);
      for (const zone of map.zoneSeeds) {
        expect(zoneAtTile(map, zone.col, zone.row)).toBe(zone.id);
        expect(connectedZoneSize(map, zone.id)).toBe(counts[zone.id]);
        expect((counts[zone.id] ?? 0) / map.zoneIds.length).toBeGreaterThanOrEqual(0.08);
      }
    }
  });

  it("keeps the centre spawn and jointly placed post-boss gates fully in bounds", () => {
    for (const sample of SAMPLES.slice(0, 8)) {
      const map = generateArena(sample);
      expect(tileAtPx(map, map.spawnX, map.spawnY)).toBe(TILE_GROUND);
      const pair = placeArenaGatePair(map, 20, 20, EXTRACT_RADIUS);
      expect(validateArena(map, pair).ok).toBe(true);
      expect(isArenaDiscSafe(map, pair.extractX, pair.extractY, pair.radius)).toBe(true);
      expect(isArenaDiscSafe(map, pair.riftX, pair.riftY, pair.radius)).toBe(true);
      expect(
        Math.hypot(pair.riftX - pair.extractX, pair.riftY - pair.extractY),
      ).toBeGreaterThanOrEqual(EXTRACT_RADIUS * 2 + ARENA_GATE_PAIR_GAP - 1e-6);
    }
  });

  it("retains ground-valued out-of-bounds tile reads while the simulation enforces the hard boundary", () => {
    const map = generateArena(seeds(9, 9, 9, 9));
    expect(tileAtPx(map, -50, -50)).toBe(TILE_GROUND);
    expect(tileAtPx(map, 999_999, 999_999)).toBe(TILE_GROUND);
  });
});
