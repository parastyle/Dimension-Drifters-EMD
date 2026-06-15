import { ARENA_WIDTH, PLAYER_RADIUS, resolveBodyCollisions } from "@dd/shared";
import { describe, expect, it } from "vitest";

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

// §26 retro #4: new mechanic ⇒ new test. Body collision is authoritative (§5).
describe("resolveBodyCollisions", () => {
  it("pushes two overlapping bodies apart to at least 2*radius", () => {
    const [a, b] = resolveBodyCollisions([
      { x: 1000, y: 1000 },
      { x: 1010, y: 1000 },
    ]);
    expect(a && b && dist(a, b)).toBeGreaterThanOrEqual(PLAYER_RADIUS * 2 - 0.001);
  });

  it("separates perfectly-coincident bodies instead of leaving them stacked", () => {
    const [a, b] = resolveBodyCollisions([
      { x: 1000, y: 1000 },
      { x: 1000, y: 1000 },
    ]);
    expect(a && b && dist(a, b)).toBeGreaterThan(0);
  });

  it("leaves non-overlapping bodies untouched", () => {
    const input = [
      { x: 500, y: 500 },
      { x: 900, y: 900 },
    ];
    const out = resolveBodyCollisions(input);
    expect(out).toEqual(input);
  });

  it("keeps resolved bodies inside the arena bounds", () => {
    const [a, b] = resolveBodyCollisions([
      { x: ARENA_WIDTH - PLAYER_RADIUS, y: 1000 },
      { x: ARENA_WIDTH - PLAYER_RADIUS - 5, y: 1000 },
    ]);
    expect(a?.x).toBeLessThanOrEqual(ARENA_WIDTH - PLAYER_RADIUS + 0.001);
    expect(b?.x).toBeLessThanOrEqual(ARENA_WIDTH - PLAYER_RADIUS + 0.001);
  });

  it("does not mutate the input array", () => {
    const input = [
      { x: 1000, y: 1000 },
      { x: 1010, y: 1000 },
    ];
    resolveBodyCollisions(input);
    expect(input[0]).toEqual({ x: 1000, y: 1000 });
  });
});
