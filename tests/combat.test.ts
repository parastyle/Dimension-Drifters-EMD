import { type ChainCandidate, clampQuakeEpicenter, selectChainTargets } from "@dd/shared";
import { describe, expect, it } from "vitest";

// The two fns the server (damage) and client (VFX) both run — they must agree, so they're tested once.
describe("selectChainTargets", () => {
  // a small cluster: seed at origin, targets fanning out to the right
  const cands: ChainCandidate[] = [
    { id: "a", x: 50, y: 0 },
    { id: "b", x: 120, y: 0 },
    { id: "c", x: 200, y: 0 },
    { id: "far", x: 5000, y: 0 },
  ];

  it("greedily picks the nearest unused candidate, in link order", () => {
    const r = selectChainTargets({ x: 0, y: 0 }, cands, 3, 100);
    expect(r.map((t) => t.id)).toEqual(["a", "b", "c"]); // a(50)→b(+70)→c(+80), each within 100
  });

  it("stops early when no candidate is within hopRange", () => {
    const r = selectChainTargets({ x: 0, y: 0 }, cands, 5, 60);
    expect(r.map((t) => t.id)).toEqual(["a"]); // a is 50 away; b is 70 from a → out of 60 range
  });

  it("respects the jumps cap", () => {
    expect(selectChainTargets({ x: 0, y: 0 }, cands, 1, 1000)).toHaveLength(1);
    expect(selectChainTargets({ x: 0, y: 0 }, cands, 2, 1000).map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("never re-links the same enemy (dedup)", () => {
    const r = selectChainTargets({ x: 0, y: 0 }, cands, 4, 10000);
    expect(new Set(r.map((t) => t.id)).size).toBe(r.length);
  });

  it("excludes the seeded set (arc-hit enemies)", () => {
    const r = selectChainTargets({ x: 0, y: 0 }, cands, 3, 10000, new Set(["a", "b"]));
    expect(r.map((t) => t.id)).toEqual(["c", "far"]); // a,b excluded
  });

  it("returns [] when no candidates", () => {
    expect(selectChainTargets({ x: 0, y: 0 }, [], 3, 1000)).toEqual([]);
  });
});

describe("clampQuakeEpicenter", () => {
  const player = { x: 100, y: 100 };

  it("returns the target unchanged when within reach", () => {
    expect(clampQuakeEpicenter(player, { x: 150, y: 100 }, 260)).toEqual({ x: 150, y: 100 });
  });

  it("clamps to exactly `reach` along the aim when beyond", () => {
    const ep = clampQuakeEpicenter(player, { x: 1000, y: 100 }, 260); // straight right, far
    expect(ep.x).toBeCloseTo(360, 6); // 100 + 260
    expect(ep.y).toBeCloseTo(100, 6);
    expect(Math.hypot(ep.x - player.x, ep.y - player.y)).toBeCloseTo(260, 6);
  });

  it("clamps diagonally to the reach radius", () => {
    const ep = clampQuakeEpicenter(player, { x: 1000, y: 1000 }, 200);
    expect(Math.hypot(ep.x - player.x, ep.y - player.y)).toBeCloseTo(200, 6);
  });
});
