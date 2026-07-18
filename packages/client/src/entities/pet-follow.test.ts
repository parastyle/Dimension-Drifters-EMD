import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({ default: {} }));

import { PET_FOLLOW_TUNING, type PetFollowState, stepPetFollowSpring } from "./PetRig.js";

function state(x = 0, y = 0, ready = true): PetFollowState {
  return { x, y, vx: 0, vy: 0, ready };
}

describe("pet follow spring", () => {
  it("rebases an uninitialized follower without injecting spring energy", () => {
    const follower = state(0, 0, false);
    stepPetFollowSpring(follower, 72, -18, 1 / 60);
    expect(follower).toEqual({ x: 72, y: -18, vx: 0, vy: 0, ready: true });
  });

  it("settles a normal shoulder correction to within five pixels in 260ms", () => {
    const follower = state();
    for (let elapsed = 0; elapsed < 0.26; elapsed += 0.01)
      stepPetFollowSpring(follower, 30, 0, 0.01);
    expect(Math.abs(30 - follower.x)).toBeLessThan(5);
  });

  it("honors the regular-flight speed and acceleration ceilings", () => {
    const follower = state();
    let previousVx = follower.vx;
    for (let step = 0; step < 20; step++) {
      stepPetFollowSpring(follower, 1_000, 0, 0.01);
      expect(Math.hypot(follower.vx, follower.vy)).toBeLessThanOrEqual(
        PET_FOLLOW_TUNING.maxSpeed + 1e-6,
      );
      expect(Math.abs(follower.vx - previousVx) / 0.01).toBeLessThanOrEqual(
        PET_FOLLOW_TUNING.maxAcceleration + 1e-5,
      );
      previousVx = follower.vx;
    }
  });

  it("clamps a tab-wake delta to the same result as a 100ms presentation step", () => {
    const clamped = state();
    const ordinary = state();
    stepPetFollowSpring(clamped, 80, 20, 1);
    stepPetFollowSpring(ordinary, 80, 20, 0.1);
    expect(clamped.x).toBeCloseTo(ordinary.x, 10);
    expect(clamped.y).toBeCloseTo(ordinary.y, 10);
    expect(clamped.vx).toBeCloseTo(ordinary.vx, 10);
    expect(clamped.vy).toBeCloseTo(ordinary.vy, 10);
  });
});
