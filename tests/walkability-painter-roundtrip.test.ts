import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  readCollisionFile,
  readPrefabCollision,
  writePrefabCollision,
} from "../tools/walkability-painter/collision-store.mjs";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("Walkability Painter collision round-trip", () => {
  it("saves normalized native-pixel polygons and reloads them identically", () => {
    const directory = mkdtempSync(join(tmpdir(), "dd-walkability-painter-"));
    temporaryDirectories.push(directory);
    const path = join(directory, "prefab-walkability.json");
    const polygons = [
      [
        [10.2, 20.8],
        [310, 24],
        [300, 190],
        [18, 180],
        [10.2, 20.8],
      ],
      [
        [400, 100],
        [520, 112],
        [500, 240],
      ],
    ];

    const saved = writePrefabCollision(
      "round-trip-platform",
      polygons,
      { width: 640, height: 360 },
      path,
    );
    const reloaded = readPrefabCollision("round-trip-platform", path);

    expect(saved).toEqual([
      [
        [10, 21],
        [310, 24],
        [300, 190],
        [18, 180],
      ],
      [
        [400, 100],
        [520, 112],
        [500, 240],
      ],
    ]);
    expect(reloaded).toEqual(saved);
    expect(readCollisionFile(path).polygonsByPrefab["round-trip-platform"]).toEqual(saved);
    expect(readFileSync(path, "utf8")).toMatch(/\[10, 21\]/);
    expect(readFileSync(path, "utf8")).toMatch(/\n$/);
  });

  it("rejects an out-of-bounds polygon without changing the file", () => {
    const directory = mkdtempSync(join(tmpdir(), "dd-walkability-painter-"));
    temporaryDirectories.push(directory);
    const path = join(directory, "prefab-walkability.json");
    writePrefabCollision(
      "safe-platform",
      [
        [
          [1, 1],
          [20, 1],
          [20, 20],
        ],
      ],
      { width: 32, height: 32 },
      path,
    );
    const before = readFileSync(path, "utf8");

    expect(() =>
      writePrefabCollision(
        "safe-platform",
        [
          [
            [1, 1],
            [40, 1],
            [20, 20],
          ],
        ],
        { width: 32, height: 32 },
        path,
      ),
    ).toThrow(/outside 32x32/);
    expect(readFileSync(path, "utf8")).toBe(before);
  });
});
