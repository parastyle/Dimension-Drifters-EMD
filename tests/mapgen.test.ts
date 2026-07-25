import {
  type ArenaMapSeeds,
  classifyPitRegions,
  generateArena,
  isPitAtPx,
  MAP_MAX_JUMP_TILES,
  nearestGroundPx,
  pitFraction,
  safeSpawnPos,
  TILE_GROUND,
  TILE_PIT,
  tileAtPx,
  validateArena,
} from "@dd/shared";
import { describe, expect, it } from "vitest";

const seeds = (a: number, b: number, c: number, d: number): ArenaMapSeeds => ({
  seedTerrain: a,
  seedHazard: b,
  seedTheme: c,
  seedDecor: d,
});

// A spread of seeds to exercise the generator's guarantees, not just one happy path.
const SAMPLES: ArenaMapSeeds[] = [];
for (let i = 0; i < 200; i++) SAMPLES.push(seeds(i * 2654435761, i * 40503 + 7, i + 1, i * 13 + 5));

describe("mapgen — determinism", () => {
  it("same seeds → byte-identical map (server + client reproduce it)", () => {
    for (const s of SAMPLES.slice(0, 25)) {
      const a = generateArena(s);
      const b = generateArena(s);
      expect(Array.from(a.tiles)).toEqual(Array.from(b.tiles));
      expect([a.spawnX, a.spawnY]).toEqual([b.spawnX, b.spawnY]);
    }
  });

  it("different seeds → different maps (it actually varies)", () => {
    const fingerprints = new Set(SAMPLES.slice(0, 30).map((s) => generateArena(s).tiles.join("")));
    expect(fingerprints.size).toBeGreaterThan(20); // overwhelmingly distinct
  });
});

describe("mapgen — guarantees hold for every seed", () => {
  it("validateArena passes for all 200 sample seeds", () => {
    for (const s of SAMPLES) {
      const map = generateArena(s);
      const v = validateArena(map);
      expect(v.ok, `seed ${JSON.stringify(s)} failed: ${v.reason}`).toBe(true);
    }
  });

  it("spawn is always clear ground", () => {
    for (const s of SAMPLES) {
      const map = generateArena(s);
      expect(tileAtPx(map, map.spawnX, map.spawnY)).toBe(TILE_GROUND);
      expect(isPitAtPx(map, map.spawnX, map.spawnY)).toBe(false);
    }
  });

  it("keeps pit coverage in a sane band (some hazard, never overrun)", () => {
    for (const s of SAMPLES) {
      const f = pitFraction(generateArena(s));
      expect(f).toBeGreaterThan(0); // there ARE pits
      expect(f).toBeLessThan(0.4); // but the arena stays mostly playable
    }
  });
});

describe("mapgen — pit helpers (fall + rim)", () => {
  it("nearestGroundPx always returns a GROUND point", () => {
    for (const s of SAMPLES.slice(0, 60)) {
      const map = generateArena(s);
      // Probe every pit cell centre — the snap-back must land on solid ground.
      for (let i = 0; i < map.tiles.length; i++) {
        if (map.tiles[i] !== TILE_PIT) continue;
        const cx = ((i % map.cols) + 0.5) * map.tileSize;
        const cy = (Math.floor(i / map.cols) + 0.5) * map.tileSize;
        const g = nearestGroundPx(map, cx, cy);
        expect(isPitAtPx(map, g.x, g.y), `snap landed in a pit for seed ${JSON.stringify(s)}`).toBe(
          false,
        );
      }
    }
  });

  it("nearestGroundPx is a no-op when already on ground", () => {
    const map = generateArena(seeds(5, 6, 7, 8));
    const g = nearestGroundPx(map, map.spawnX, map.spawnY);
    expect(tileAtPx(map, g.x, g.y)).toBe(TILE_GROUND);
  });

  it("classifyPitRegions: ground is -1, every pit cell gets a real region + boolean hoppable", () => {
    for (const s of SAMPLES.slice(0, 40)) {
      const map = generateArena(s);
      const { regionOf, hoppable } = classifyPitRegions(map);
      let maxRegion = -1;
      for (let i = 0; i < map.tiles.length; i++) {
        if (map.tiles[i] === TILE_PIT) {
          expect(regionOf[i]).toBeGreaterThanOrEqual(0);
          maxRegion = Math.max(maxRegion, regionOf[i] as number);
        } else {
          expect(regionOf[i]).toBe(-1);
        }
      }
      expect(hoppable.length).toBe(maxRegion + 1);
      expect(hoppable.every((h) => typeof h === "boolean")).toBe(true);
    }
  });
});

describe("mapgen - safeSpawnPos", () => {

  it("nudges a pit-centre spawn onto solid ground", () => {
    for (const s of SAMPLES.slice(0, 60)) {
      const map = generateArena(s);
      for (let i = 0; i < map.tiles.length; i++) {
        if (map.tiles[i] !== TILE_PIT) continue;
        const cx = ((i % map.cols) + 0.5) * map.tileSize;
        const cy = (Math.floor(i / map.cols) + 0.5) * map.tileSize;
        const sp = safeSpawnPos(map, cx, cy);
        expect(isPitAtPx(map, sp.x, sp.y), `pit spawn for seed ${JSON.stringify(s)}`).toBe(false);
        break; // one pit cell per map is enough to exercise the nudge
      }
    }
  });

  it("leaves an already-clear spawn on ground", () => {
    for (const s of SAMPLES.slice(0, 40)) {
      const map = generateArena(s);
      const sp = safeSpawnPos(map, map.spawnX, map.spawnY);
      expect(isPitAtPx(map, sp.x, sp.y)).toBe(false);
    }
  });
});

describe("mapgen — shape sanity", () => {
  it("uses the expected 60×60 grid (v0.102 roominess: 4800² arena / 80px tiles)", () => {
    const map = generateArena(seeds(1, 2, 3, 4));
    expect(map.cols).toBe(60);
    expect(map.rows).toBe(60);
    expect(map.tiles.length).toBe(3600);
  });

  it("the jump-reach constant is the conservative ~2 tiles the design assumes", () => {
    expect(MAP_MAX_JUMP_TILES).toBe(2);
  });

  it("out-of-bounds px reads as ground (border ring guards the edge)", () => {
    const map = generateArena(seeds(9, 9, 9, 9));
    expect(tileAtPx(map, -50, -50)).toBe(TILE_GROUND);
    expect(tileAtPx(map, 999999, 999999)).toBe(TILE_GROUND);
  });
});

// Natural-zone authority coverage.
import {
  auditArenaNavigation,
  MAP_ZONE_COMMONS,
  MAP_ZONE_COUNT,
  MAP_ZONE_COVER,
  MAP_ZONE_SCAR,
  zoneAtTile,
} from "@dd/shared";

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

function authorityDigest(map: ReturnType<typeof generateArena>): string {
  let hash = 0x811c9dc5 >>> 0;
  const addInt = (value: number): void => {
    let word = value | 0;
    for (let byte = 0; byte < 4; byte++) {
      hash ^= word & 0xff;
      hash = Math.imul(hash, 0x01000193) >>> 0;
      word >>>= 8;
    }
  };
  for (const zoneId of map.zoneIds) {
    hash ^= zoneId;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  for (const zone of map.zoneSeeds) {
    addInt(zone.id);
    addInt(zone.col);
    addInt(zone.row);
  }
  return hash.toString(16).padStart(8, "0");
}

describe("mapgen — natural-zone authority", () => {
  it("reproduces byte-identical terrain and zones from the four synced seeds", () => {
    for (const sample of SAMPLES.slice(0, 30)) {
      const serverMap = generateArena(sample);
      const clientMap = generateArena(sample);
      expect(Array.from(clientMap.zoneIds)).toEqual(Array.from(serverMap.zoneIds));
      expect(clientMap.zoneSeeds).toEqual(serverMap.zoneSeeds);
      expect(Array.from(clientMap.tiles)).toEqual(Array.from(serverMap.tiles));
    }
  });

  it("keeps one connected Commons, Cover, and Scar footprint with a forced neutral core", () => {
    for (const sample of SAMPLES) {
      const map = generateArena(sample);
      expect(map.zoneIds.length).toBe(map.tiles.length);
      expect(map.zoneSeeds.map((entry) => entry.id).sort()).toEqual([
        MAP_ZONE_COMMONS,
        MAP_ZONE_COVER,
        MAP_ZONE_SCAR,
      ]);
      const counts = new Int32Array(MAP_ZONE_COUNT);
      for (const zoneId of map.zoneIds) {
        expect(zoneId).toBeGreaterThanOrEqual(0);
        expect(zoneId).toBeLessThan(MAP_ZONE_COUNT);
        counts[zoneId] = (counts[zoneId] ?? 0) + 1;
      }
      for (const zone of map.zoneSeeds) {
        expect(zoneAtTile(map, zone.col, zone.row)).toBe(zone.id);
        expect(connectedZoneSize(map, zone.id)).toBe(counts[zone.id]);
        expect((counts[zone.id] ?? 0) / map.zoneIds.length).toBeGreaterThanOrEqual(0.08);
      }
      const centreCol = Math.floor(map.cols / 2);
      const centreRow = Math.floor(map.rows / 2);
      for (let row = centreRow - 5; row <= centreRow + 5; row++)
        for (let col = centreCol - 5; col <= centreCol + 5; col++)
          if ((col - centreCol) ** 2 + (row - centreRow) ** 2 <= 25)
            expect(zoneAtTile(map, col, row)).toBe(MAP_ZONE_COMMONS);
    }
  });

  it("keeps pits concentrated in Scar and sparse in Cover", () => {
    const cells = new Int32Array(MAP_ZONE_COUNT);
    const pits = new Int32Array(MAP_ZONE_COUNT);
    for (const sample of SAMPLES) {
      const map = generateArena(sample);
      for (let index = 0; index < map.tiles.length; index++) {
        const zoneId = map.zoneIds[index] ?? MAP_ZONE_COMMONS;
        cells[zoneId] = (cells[zoneId] ?? 0) + 1;
        if (map.tiles[index] === TILE_PIT) pits[zoneId] = (pits[zoneId] ?? 0) + 1;
      }
    }
    const pitRate = (zoneId: number) => (pits[zoneId] ?? 0) / Math.max(1, cells[zoneId] ?? 0);
    expect(pitRate(MAP_ZONE_SCAR)).toBeGreaterThan(pitRate(MAP_ZONE_COMMONS) * 1.8);
    expect(pitRate(MAP_ZONE_COVER)).toBeLessThan(pitRate(MAP_ZONE_COMMONS) * 0.8);
  });

  it("proves navigation through every zone", () => {
    for (const sample of SAMPLES) {
      const map = generateArena(sample);
      const audit = auditArenaNavigation(map);
      expect(audit.ok, `seed ${JSON.stringify(sample)} failed: ${audit.reason}`).toBe(true);
      expect(audit.reachableCells).toBe(audit.navigableCells);
    }
  });
});

describe("mapgen - natural-zone golden authority", () => {
  it("locks golden zone descriptors", () => {
    expect(authorityDigest(generateArena(seeds(1, 2, 3, 4)))).toBe("245aa52c");
    expect(
      authorityDigest(generateArena(seeds(0xdeadbeef, 0x12345678, 0xabcdef01, 0x31415926))),
    ).toBe("c56f66ae");
    expect(authorityDigest(generateArena(seeds(2654435761, 40510, 2, 18)))).toBe("958fedbc");
  });
});

// The appended 200-seed connected-component proof performs per-cell assertions; retain the full sample
// rather than weakening it to fit Vitest's 5s default.
import { vi } from "vitest";

vi.setConfig({ testTimeout: 30_000 });

// MAP QOL wave — append-only gate authority and locator proofs.
const mapQolShared = await import("@dd/shared");
const gateVisibility = await import(
  "../packages/client/src/scenes/arena/floor-renderer.js"
);

describe("mapgen — jointly validated post-boss gate pair", () => {
  it("places reachable full-footprint extract/rift discs with protected separation across seeds", () => {
    for (let sampleIndex = 0; sampleIndex < 120; sampleIndex++) {
      const sample = SAMPLES[sampleIndex];
      if (!sample) continue;
      const map = generateArena(sample);
      const pit = map.tiles.indexOf(TILE_PIT);
      expect(pit).toBeGreaterThanOrEqual(0);
      const corpseX = ((pit % map.cols) + 0.5) * map.tileSize;
      const corpseY = (Math.floor(pit / map.cols) + 0.5) * map.tileSize;
      const pair = mapQolShared.placeArenaGatePair(
        map,
        corpseX,
        corpseY,
        mapQolShared.EXTRACT_RADIUS,
      );
      const validation = validateArena(map, pair);
      expect(
        validation.ok,
        `seed ${JSON.stringify(sample)} gate pair failed: ${validation.reason}`,
      ).toBe(true);
      expect(
        mapQolShared.isArenaDiscSafe(map, pair.extractX, pair.extractY, pair.radius),
      ).toBe(true);
      expect(mapQolShared.isArenaDiscSafe(map, pair.riftX, pair.riftY, pair.radius)).toBe(
        true,
      );
      expect(Math.hypot(pair.riftX - pair.extractX, pair.riftY - pair.extractY)).toBeGreaterThanOrEqual(
        mapQolShared.EXTRACT_RADIUS * 2 + mapQolShared.ARENA_GATE_PAIR_GAP - 1e-6,
      );
      expect([pair.extractX, pair.extractY]).not.toEqual([corpseX, corpseY]);
    }
  });
});

describe("gate locator — complete-circle HUD-safe visibility", () => {
  it("persists for a clipped circle, clears only when the full gate is padded-visible, and pulses on open", () => {
    const viewport = { left: 0, top: 0, right: 1000, bottom: 800 };
    const radius = mapQolShared.EXTRACT_RADIUS;
    expect(
      gateVisibility.gateNeedsEdgeLocator(true, 70, 400, radius, viewport, false),
    ).toBe(true); // centre is on-screen, but the complete disc is clipped by the safe edge
    expect(
      gateVisibility.gateNeedsEdgeLocator(true, 129, 400, radius, viewport, false),
    ).toBe(true);
    expect(
      gateVisibility.gateNeedsEdgeLocator(true, 130, 400, radius, viewport, false),
    ).toBe(false); // radius 90 + padding 40 is now fully clear
    expect(
      gateVisibility.gateNeedsEdgeLocator(true, 500, 400, radius, viewport, true),
    ).toBe(true); // three-second first-open pulse overrides an already-visible centre
    expect(
      gateVisibility.gateNeedsEdgeLocator(false, 70, 400, radius, viewport, true),
    ).toBe(false);
  });
});
