import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = (...parts: string[]) => readFileSync(join(ROOT, ...parts), "utf8");

describe("open-arena integration seams", () => {
  it("keeps the deleted wash, bake, flat-floor toggle, and terrain-variant paths absent", () => {
    const floor = source("packages", "client", "src", "scenes", "arena", "floor-renderer.ts");
    const arena = source("packages", "client", "src", "scenes", "ArenaScene.ts");
    for (const retired of [
      "buildMapZoneGround",
      "bakeStaticFloorGraphics",
      "STATIC_FLOOR_BAKE_SCALE",
      "FLAT_FLOOR_",
      "installFlatFloorToggle",
      "terrainTileKey",
    ]) {
      expect(floor + arena, retired).not.toContain(retired);
    }
    expect(floor.match(/\.tileSprite\(/g)).toHaveLength(1);
    expect(floor).toContain("const arenaWidth = map.cols * map.tileSize;");
    expect(arena).toContain("...drawArena(this, this.arenaMap, (k) => this.hasTile(k), palette)");
  });

  it("pins the live camera, prediction, authority, spawn, and gate call sites to arena-relative seams", () => {
    const arena = source("packages", "client", "src", "scenes", "ArenaScene.ts");
    const prediction = source("packages", "client", "src", "net", "prediction.ts");
    const movement = source("packages", "server", "src", "rooms", "room", "room-movement.ts");
    const enemies = source("packages", "server", "src", "rooms", "room", "room-enemies.ts");
    const progression = source("packages", "server", "src", "rooms", "room", "room-progression.ts");
    const mapgen = source("packages", "shared", "src", "mapgen.ts");

    expect(arena).toContain("axis(x - viewW / 2, viewW, ARENA_WIDTH)");
    expect(arena).toContain("axis(y - viewH / 2, viewH, ARENA_HEIGHT)");
    expect(prediction).toContain(
      "Math.min((beltX?.maxX ?? ARENA_WIDTH) - PLAYER_RADIUS, out.rawX)",
    );
    expect(movement).toContain("x > ARENA_WIDTH - PLAYER_RADIUS");
    expect(movement).toContain("y > ARENA_HEIGHT - PLAYER_RADIUS");
    expect(enemies).toContain("SPAWN_CAMERA_HALF_WIDTH");
    expect(enemies).toContain("SPAWN_CAMERA_HALF_HEIGHT");
    expect(enemies).toContain("SPAWN_MIN_DISTANCE");
    expect(enemies).toContain("SPAWN_CANDIDATE_COUNT");
    expect(progression).toContain(
      "const gates = placeArenaGatePair(this.map, x, y, EXTRACT_RADIUS);",
    );
    expect(mapgen).toContain("const arenaWidth = map.cols * map.tileSize;");
    expect(mapgen).toContain("const arenaHeight = map.rows * map.tileSize;");
  });
});
