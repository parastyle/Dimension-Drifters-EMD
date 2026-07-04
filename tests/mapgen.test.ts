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
