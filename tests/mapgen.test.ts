import {
  type ArenaMapSeeds,
  classifyPitRegions,
  generateArena,
  isInsidePoi,
  isPitAtPx,
  MAP_MAX_JUMP_TILES,
  MAP_POI_COUNT,
  MAP_POI_GAP,
  MAP_POI_SPACING_TILES,
  MAP_POI_SPAWN_CLEAR_TILES,
  MAP_TILE,
  nearestGroundPx,
  pitFraction,
  poiAt,
  poiRadius,
  poiScale,
  resolvePoiCollision,
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

describe("mapgen — POI landmarks (v0.102 size classes)", () => {
  it("poiScale is a deterministic size-class map with real variety (S/M/L/XL all occur)", () => {
    const classes = new Set<number>();
    for (let k = 0; k < 200; k++) {
      const sc = poiScale(k);
      expect(sc).toBe(poiScale(k)); // pure
      expect(sc).toBeGreaterThan(0.5);
      expect(sc).toBeLessThan(2.5);
      classes.add(sc);
    }
    expect(classes.size).toBe(4); // S, M, L, XL
  });

  it("places POIs on GROUND (whole footprint), radius-aware spaced with a walk gap, clear of spawn", () => {
    for (const s of SAMPLES.slice(0, 80)) {
      const map = generateArena(s);
      expect(map.pois.length).toBeLessThanOrEqual(MAP_POI_COUNT);
      const floorPx = MAP_POI_SPACING_TILES * MAP_TILE;
      const spawnClearPx = MAP_POI_SPAWN_CLEAR_TILES * MAP_TILE;
      for (let i = 0; i < map.pois.length; i++) {
        const p = map.pois[i];
        if (!p) continue;
        const r = poiRadius(p.kind);
        // The WHOLE collision footprint stands on ground — probe the centre + the 4 cardinal rim points.
        expect(isPitAtPx(map, p.x, p.y), "POI centre must be ground").toBe(false);
        for (const [ox, oy] of [
          [r - 1, 0],
          [-(r - 1), 0],
          [0, r - 1],
          [0, -(r - 1)],
        ] as const) {
          expect(isPitAtPx(map, p.x + ox, p.y + oy), "POI rim hangs over a pit").toBe(false);
        }
        expect(Math.hypot(p.x - map.spawnX, p.y - map.spawnY)).toBeGreaterThan(
          spawnClearPx + r - MAP_TILE,
        );
        for (let j = i + 1; j < map.pois.length; j++) {
          const q = map.pois[j];
          if (!q) continue;
          // Pairwise rule: both footprints + the guaranteed walking gap (or the legacy tile floor).
          const need = Math.max(floorPx, r + poiRadius(q.kind) + MAP_POI_GAP);
          expect(Math.hypot(p.x - q.x, p.y - q.y)).toBeGreaterThanOrEqual(need);
        }
      }
    }
  });

  it("resolvePoiCollision pushes an entity OUT of a landmark + leaves clear ground untouched", () => {
    const map = generateArena(seeds(3, 4, 5, 6));
    if (map.pois.length === 0) return;
    const p = map.pois[0];
    if (!p) return;
    const r = 24;
    const out = resolvePoiCollision(map, p.x + 5, p.y, r); // start INSIDE the obstacle
    expect(Math.hypot(out.x - p.x, out.y - p.y)).toBeGreaterThanOrEqual(
      poiRadius(p.kind) + r - 0.5,
    );
    // A point far from every POI is returned unchanged.
    const far = resolvePoiCollision(map, map.spawnX, map.spawnY, r);
    expect([far.x, far.y]).toEqual([map.spawnX, map.spawnY]);
  });

  it("resolvePoiCollision never leaves a body inside ANY landmark (multi-POI settle)", () => {
    for (const s of SAMPLES.slice(0, 30)) {
      const map = generateArena(s);
      for (const p of map.pois) {
        const out = resolvePoiCollision(map, p.x + 3, p.y - 2, 24);
        expect(poiAt(map, out.x, out.y), "body left inside a landmark").toBeUndefined();
      }
    }
  });

  it("isInsidePoi blocks a projectile inside a landmark, passes clear ground (§17 cover)", () => {
    const map = generateArena(seeds(11, 12, 13, 14));
    if (map.pois.length === 0) return;
    const p = map.pois[0];
    if (!p) return;
    expect(isInsidePoi(map, p.x, p.y)).toBe(true); // dead centre = blocked
    expect(isInsidePoi(map, p.x + poiRadius(p.kind) + 5, p.y)).toBe(false); // just outside the footprint
    expect(isInsidePoi(map, map.spawnX, map.spawnY)).toBe(false); // spawn is clear of POIs
  });

  it("poiAt returns the containing landmark (for the ricochet carom) or undefined", () => {
    const map = generateArena(seeds(7, 8, 9, 10));
    if (map.pois.length === 0) return;
    const p = map.pois[0];
    if (!p) return;
    expect(poiAt(map, p.x, p.y)).toBe(p); // inside → that POI
    expect(poiAt(map, map.spawnX, map.spawnY)).toBeUndefined(); // clear ground → none
  });
});

describe("mapgen — safeSpawnPos (§17 spawn nudge)", () => {
  const R = 24;

  it("nudges a pit-centre spawn onto solid ground", () => {
    for (const s of SAMPLES.slice(0, 60)) {
      const map = generateArena(s);
      for (let i = 0; i < map.tiles.length; i++) {
        if (map.tiles[i] !== TILE_PIT) continue;
        const cx = ((i % map.cols) + 0.5) * map.tileSize;
        const cy = (Math.floor(i / map.cols) + 0.5) * map.tileSize;
        const sp = safeSpawnPos(map, cx, cy, R);
        expect(isPitAtPx(map, sp.x, sp.y), `pit spawn for seed ${JSON.stringify(s)}`).toBe(false);
        break; // one pit cell per map is enough to exercise the nudge
      }
    }
  });

  it("pushes a spawn out of a POI footprint", () => {
    const map = generateArena(seeds(3, 4, 5, 6));
    const p = map.pois[0];
    if (!p) return;
    const sp = safeSpawnPos(map, p.x + 5, p.y, R); // start inside the landmark
    expect(isInsidePoi(map, sp.x, sp.y)).toBe(false);
  });

  it("leaves an already-clear spawn (the map spawn point) on ground + out of POIs", () => {
    for (const s of SAMPLES.slice(0, 40)) {
      const map = generateArena(s);
      const sp = safeSpawnPos(map, map.spawnX, map.spawnY, R);
      expect(isPitAtPx(map, sp.x, sp.y)).toBe(false);
      expect(isInsidePoi(map, sp.x, sp.y)).toBe(false);
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

// Natural-zone / authoritative-cluster coverage is intentionally appended so every legacy assertion above
// remains an unchanged gate.
import {
  auditArenaNavigation,
  MAP_ZONE_COMMONS,
  MAP_ZONE_COUNT,
  MAP_ZONE_COVER,
  MAP_ZONE_SCAR,
  PLAYER_RADIUS,
  poiCollisionAt,
  poiCollisionCircles,
  zoneAtPx,
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
  for (const cluster of map.poiClusters) {
    addInt(cluster.id);
    addInt(cluster.x);
    addInt(cluster.y);
    addInt(cluster.zoneId);
    addInt(Math.round(cluster.phase * 1_000_000));
  }
  for (const poi of map.pois) {
    addInt(poi.x);
    addInt(poi.y);
    addInt(poi.kind);
    addInt(poi.clusterId);
  }
  return hash.toString(16).padStart(8, "0");
}

describe("mapgen — natural-zone authority", () => {
  it("reproduces byte-identical zones, clusters, and POIs from the four synced seeds", () => {
    for (const sample of SAMPLES.slice(0, 30)) {
      const serverMap = generateArena(sample);
      const clientMap = generateArena(sample);
      expect(Array.from(clientMap.zoneIds)).toEqual(Array.from(serverMap.zoneIds));
      expect(clientMap.zoneSeeds).toEqual(serverMap.zoneSeeds);
      expect(clientMap.poiClusters).toEqual(serverMap.poiClusters);
      expect(clientMap.pois).toEqual(serverMap.pois);
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

  it("correlates the existing risk exchanges: Scar owns pits and Cover owns landmarks", () => {
    const cells = new Int32Array(MAP_ZONE_COUNT);
    const pits = new Int32Array(MAP_ZONE_COUNT);
    const pois = new Int32Array(MAP_ZONE_COUNT);
    for (const sample of SAMPLES) {
      const map = generateArena(sample);
      for (let index = 0; index < map.tiles.length; index++) {
        const zoneId = map.zoneIds[index] ?? MAP_ZONE_COMMONS;
        cells[zoneId] = (cells[zoneId] ?? 0) + 1;
        if (map.tiles[index] === TILE_PIT) pits[zoneId] = (pits[zoneId] ?? 0) + 1;
      }
      for (const poi of map.pois) {
        const zoneId = zoneAtPx(map, poi.x, poi.y);
        pois[zoneId] = (pois[zoneId] ?? 0) + 1;
      }
    }
    const pitRate = (zoneId: number) => (pits[zoneId] ?? 0) / Math.max(1, cells[zoneId] ?? 0);
    expect(pitRate(MAP_ZONE_SCAR)).toBeGreaterThan(pitRate(MAP_ZONE_COMMONS) * 1.8);
    expect(pitRate(MAP_ZONE_COVER)).toBeLessThan(pitRate(MAP_ZONE_COMMONS) * 0.8);
    expect(pois[MAP_ZONE_COVER] ?? 0).toBeGreaterThan((pois[MAP_ZONE_COMMONS] ?? 0) * 3);
    expect(pois[MAP_ZONE_COVER] ?? 0).toBeGreaterThan((pois[MAP_ZONE_SCAR] ?? 0) * 3);
  });

  it("deals the full landmark budget into six navigable macro-clusters", () => {
    for (const sample of SAMPLES) {
      const map = generateArena(sample);
      expect(map.pois).toHaveLength(MAP_POI_COUNT);
      expect(map.poiClusters).toHaveLength(6);
      const classes = new Int16Array(7);
      for (const poi of map.pois) {
        const classId = ((poi.kind % 7) + 7) % 7;
        classes[classId] = (classes[classId] ?? 0) + 1;
      }
      expect(Array.from(classes)).toEqual([4, 4, 4, 4, 4, 4, 4]);
      for (const cluster of map.poiClusters) {
        const members = map.pois.filter((poi) => poi.clusterId === cluster.id);
        expect(members.length).toBeGreaterThanOrEqual(3);
        expect(members.length).toBeLessThanOrEqual(6);
        expect(Math.min(...members.map((poi) => Math.hypot(poi.x - cluster.x, poi.y - cluster.y)))).toBe(
          0,
        );
      }
    }
  });

  it("proves player-radius navigation through every zone and cluster approach", () => {
    for (const sample of SAMPLES) {
      const map = generateArena(sample);
      const audit = auditArenaNavigation(map, PLAYER_RADIUS);
      expect(audit.ok, `seed ${JSON.stringify(sample)} failed: ${audit.reason}`).toBe(true);
      expect(audit.reachableCells).toBe(audit.navigableCells);
    }
  });
});

describe("mapgen — compound landmark authority", () => {
  it("uses shared compound children for large cover and settles bodies outside every child", () => {
    let compound = 0;
    for (const sample of SAMPLES.slice(0, 40)) {
      const map = generateArena(sample);
      for (const poi of map.pois) {
        const circles = poiCollisionCircles(poi);
        if (poiScale(poi.kind) >= 1.45) {
          expect(circles).toHaveLength(3);
          compound++;
        } else {
          expect(circles).toHaveLength(1);
        }
        for (const circle of circles) {
          expect(poiCollisionAt(map, circle.x, circle.y)?.poi).toBe(poi);
          expect(Math.hypot(circle.x - poi.x, circle.y - poi.y) + circle.radius).toBeLessThanOrEqual(
            poiRadius(poi.kind) + 1e-6,
          );
          const settled = resolvePoiCollision(map, circle.x, circle.y, PLAYER_RADIUS);
          for (const other of map.pois)
            for (const child of poiCollisionCircles(other))
              expect(Math.hypot(settled.x - child.x, settled.y - child.y)).toBeGreaterThanOrEqual(
                child.radius + PLAYER_RADIUS - 0.01,
              );
        }
      }
    }
    expect(compound).toBeGreaterThan(0);
  });

  it("locks golden zone/cluster/POI descriptors", () => {
    expect(authorityDigest(generateArena(seeds(1, 2, 3, 4)))).toBe("543176bd");
    expect(
      authorityDigest(generateArena(seeds(0xdeadbeef, 0x12345678, 0xabcdef01, 0x31415926))),
    ).toBe("845118fb");
    expect(authorityDigest(generateArena(seeds(2654435761, 40510, 2, 18)))).toBe("90c9fa82");
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
      let corpseX = map.spawnX;
      let corpseY = map.spawnY;
      if (sampleIndex % 2 === 0 && map.pois[0]) {
        corpseX = map.pois[0].x;
        corpseY = map.pois[0].y;
      } else {
        const pit = map.tiles.indexOf(TILE_PIT);
        expect(pit).toBeGreaterThanOrEqual(0);
        corpseX = ((pit % map.cols) + 0.5) * map.tileSize;
        corpseY = (Math.floor(pit / map.cols) + 0.5) * map.tileSize;
      }
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
