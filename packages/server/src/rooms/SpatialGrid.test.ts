import { describe, expect, it } from "vitest";
import { SpatialGrid } from "./SpatialGrid.js";

describe("SpatialGrid — §45 reusable enemy broad phase", () => {
  it("inserts and queries across positive, negative, and exact cell boundaries", () => {
    const grid = new SpatialGrid<string>(10);
    const out: string[] = [];
    grid.insert("right-boundary", 10, 5);
    grid.insert("left-cell", 9.999, 5);
    grid.insert("negative-cell", -0.001, 5);
    grid.insert("far", 20.001, 5);

    expect(grid.queryAabb(-0.001, 0, 10, 9.999, out)).toEqual([
      "right-boundary",
      "left-cell",
      "negative-cell",
    ]);
    expect(grid.queryAabb(10, 5, 10, 5, out)).toEqual(["right-boundary"]);
  });

  it("a radius query is a conservative superset of every exact circular hit", () => {
    const grid = new SpatialGrid<string>(8);
    const out: string[] = [];
    const points = new Map<string, { x: number; y: number }>([
      ["centre", { x: 16, y: 16 }],
      ["edge-x", { x: 26, y: 16 }],
      ["edge-diagonal", { x: 22, y: 24 }],
      ["aabb-corner", { x: 25, y: 25 }],
      ["outside", { x: 40, y: 40 }],
    ]);
    for (const [id, point] of points) grid.insert(id, point.x, point.y);

    const candidates = grid.queryRadius(16, 16, 10, out);
    const trueHits = [...points]
      .filter(([, point]) => (point.x - 16) ** 2 + (point.y - 16) ** 2 <= 10 ** 2)
      .map(([id]) => id);
    for (const id of trueHits) expect(candidates).toContain(id);
    expect(candidates).toContain("aabb-corner"); // broad phase intentionally leaves exact rejection to caller
    expect(candidates).not.toContain("outside");
  });

  it("never duplicates an item after repeated insert, movement, query, or clear/reuse", () => {
    const grid = new SpatialGrid<string>(16);
    const out: string[] = [];
    grid.insert("mover", 1, 1);
    grid.insert("mover", 1, 1);
    grid.update("mover", 17, 1);
    grid.update("mover", 33, 1);
    grid.insert("anchor", 2, 2);

    expect(grid.queryAabb(0, 0, 48, 16, out)).toEqual(["mover", "anchor"]);
    expect(new Set(out).size).toBe(out.length);

    grid.clear();
    grid.insert("mover", -16, -16);
    grid.insert("anchor", 16, 16);
    expect(grid.queryAabb(-16, -16, 16, 16, out)).toEqual(["mover", "anchor"]);
    expect(new Set(out).size).toBe(out.length);
  });
});
