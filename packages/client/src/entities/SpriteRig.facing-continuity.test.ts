import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({ default: {} }));

import { FACING_FLIP_MAX_SPEED, facingLayoutSign, stepFacingFlip } from "./SpriteRig.js";

describe("SpriteRig facing continuity", () => {
  it("rate-limits a full mirror and settles exactly on the requested side", () => {
    const state = { visual: 1, velocity: 0 };
    let maxStep = 0;
    for (let frame = 0; frame < 240; frame++) {
      const before = state.visual;
      stepFacingFlip(state, -1, 1000 / 60);
      maxStep = Math.max(maxStep, Math.abs(state.visual - before));
    }

    expect(maxStep).toBeLessThanOrEqual(FACING_FLIP_MAX_SPEED / 60 + 1e-6);
    expect(state).toEqual({ visual: -1, velocity: 0 });
  });

  it("reverses from the current visual state without restarting the mirror", () => {
    const state = { visual: 1, velocity: 0 };
    for (let frame = 0; frame < 8; frame++) stepFacingFlip(state, -1, 1000 / 60);
    const interruptedVisual = state.visual;
    const interruptedVelocity = state.velocity;

    stepFacingFlip(state, 1, 0);
    expect(state.visual).toBe(interruptedVisual);
    expect(state.velocity).toBe(interruptedVelocity);

    let maxStep = 0;
    for (let frame = 0; frame < 180; frame++) {
      const before = state.visual;
      stepFacingFlip(state, frame % 5 < 2 ? -1 : 1, 1000 / 60);
      maxStep = Math.max(maxStep, Math.abs(state.visual - before));
    }
    expect(maxStep).toBeLessThanOrEqual(FACING_FLIP_MAX_SPEED / 60 + 1e-6);
    expect(state.visual).toBeGreaterThanOrEqual(-1);
    expect(state.visual).toBeLessThanOrEqual(1);
  });

  it("keeps facing-local layout on the visible side until the mirror is edge-on", () => {
    expect(facingLayoutSign(0.8, -1)).toBe(1);
    expect(facingLayoutSign(0.001, -1)).toBe(1);
    expect(facingLayoutSign(0, -1)).toBe(-1);
    expect(facingLayoutSign(-0.001, 1)).toBe(-1);
    expect(facingLayoutSign(-0.8, 1)).toBe(-1);
  });
});
