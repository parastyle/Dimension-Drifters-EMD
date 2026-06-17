import {
  ARENA_WIDTH,
  addImpulse,
  IMPULSE_MAX,
  MOVE_SPEED,
  PLAYER_RADIUS,
  stepImpulse,
  stepPlayerMovement,
} from "@dd/shared";
import { describe, expect, it } from "vitest";

// §26 retro #4: test the hot path first. Movement is the authoritative step shared by
// the server tick and (later) client prediction — if it drifts, co-op desyncs.
describe("stepPlayerMovement", () => {
  it("moves at the flat move speed over one second", () => {
    const result = stepPlayerMovement({ x: 1000, y: 1000 }, { dx: 1, dy: 0 }, 1);
    expect(result.x).toBeCloseTo(1000 + MOVE_SPEED);
    expect(result.y).toBe(1000);
  });

  it("normalizes diagonal input so diagonal isn't faster (§7 flat speed / anti speed-hack)", () => {
    const result = stepPlayerMovement({ x: 1000, y: 1000 }, { dx: 1, dy: 1 }, 1);
    const distance = Math.hypot(result.x - 1000, result.y - 1000);
    expect(distance).toBeCloseTo(MOVE_SPEED);
  });

  it("ignores an over-unit input vector (cannot request a faster step)", () => {
    const result = stepPlayerMovement({ x: 1000, y: 1000 }, { dx: 99, dy: 0 }, 1);
    expect(result.x).toBeCloseTo(1000 + MOVE_SPEED);
  });

  it("clamps to arena bounds (§4 light server position sanity check)", () => {
    const result = stepPlayerMovement(
      { x: ARENA_WIDTH - PLAYER_RADIUS, y: 1000 },
      { dx: 1, dy: 0 },
      1,
    );
    expect(result.x).toBe(ARENA_WIDTH - PLAYER_RADIUS);
  });

  it("does not move with zero input", () => {
    const result = stepPlayerMovement({ x: 500, y: 500 }, { dx: 0, dy: 0 }, 1);
    expect(result).toEqual({ x: 500, y: 500 });
  });
});

// §20 momentum layer (Stage A) — the shove that gives recoil + knockback weight.
describe("stepImpulse (momentum integration + friction)", () => {
  it("displaces the position along the impulse velocity", () => {
    const r = stepImpulse({ x: 1000, y: 1000 }, { vx: 200, vy: 0 }, 0.1);
    expect(r.x).toBeCloseTo(1020); // 200 px/s × 0.1s
    expect(r.y).toBeCloseTo(1000);
  });

  it("decays the velocity under friction (settles to rest)", () => {
    let vel = { vx: 600, vy: 0 };
    let pos = { x: 1000, y: 1000 };
    for (let i = 0; i < 200; i++) {
      const r = stepImpulse(pos, vel, 1 / 60);
      pos = { x: r.x, y: r.y };
      vel = { vx: r.vx, vy: r.vy };
    }
    expect(vel.vx).toBe(0); // fully snapped to rest
    expect(vel.vy).toBe(0);
  });

  it("snaps sub-epsilon residuals straight to zero (no infinite crawl)", () => {
    const r = stepImpulse({ x: 500, y: 500 }, { vx: 3, vy: -2 }, 1 / 60);
    expect(r.vx).toBe(0);
    expect(r.vy).toBe(0);
  });

  it("clamps the shoved position to the arena bounds", () => {
    const r = stepImpulse({ x: ARENA_WIDTH - PLAYER_RADIUS, y: 1000 }, { vx: 9999, vy: 0 }, 1);
    expect(r.x).toBe(ARENA_WIDTH - PLAYER_RADIUS);
  });

  it("a zero impulse is a no-op", () => {
    const r = stepImpulse({ x: 500, y: 500 }, { vx: 0, vy: 0 }, 1 / 60);
    expect([r.x, r.y, r.vx, r.vy]).toEqual([500, 500, 0, 0]);
  });
});

describe("addImpulse (accumulate + cap)", () => {
  it("adds the kick to the existing velocity", () => {
    const r = addImpulse({ vx: 100, vy: 0 }, 50, -30);
    expect(r.vx).toBe(150);
    expect(r.vy).toBe(-30);
  });

  it("caps the accumulated speed at IMPULSE_MAX (a stream can't fling you away)", () => {
    let vel = { vx: 0, vy: 0 };
    for (let i = 0; i < 50; i++) vel = addImpulse(vel, 200, 0); // hammer it
    expect(Math.hypot(vel.vx, vel.vy)).toBeCloseTo(IMPULSE_MAX, 4);
  });

  it("preserves direction when capping", () => {
    const r = addImpulse({ vx: 0, vy: 0 }, 3000, 4000); // 3-4-5 → way over cap
    expect(r.vx / r.vy).toBeCloseTo(3 / 4, 6);
    expect(Math.hypot(r.vx, r.vy)).toBeCloseTo(IMPULSE_MAX, 4);
  });
});
