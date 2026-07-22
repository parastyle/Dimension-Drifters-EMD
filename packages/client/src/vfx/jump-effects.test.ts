import { describe, expect, it } from "vitest";
import {
  enemyComboLeapHeight,
  enemyComboLeapVelocity,
  enemyComboOfferPhase,
  rollTumbleRotation,
} from "./jump-effects.js";

describe("roll tumble presentation geometry", () => {
  it("turns the whole card through one signed revolution", () => {
    expect(rollTumbleRotation(0, 1)).toBe(0);
    expect(rollTumbleRotation(0.5, 1)).toBeCloseTo(Math.PI);
    expect(rollTumbleRotation(1, 1)).toBeCloseTo(Math.PI * 2);
    expect(rollTumbleRotation(0.5, -1)).toBeCloseTo(-Math.PI);
  });

  it("clamps overshoot and gives reduced motion a bounded tuck instead of a revolution", () => {
    expect(rollTumbleRotation(2, 1)).toBeCloseTo(Math.PI * 2);
    expect(Math.abs(rollTumbleRotation(0.5, 1, true))).toBeCloseTo(0.32);
    expect(rollTumbleRotation(1, 1, true)).toBeCloseTo(0);
  });
});

describe("enemy combo leap presentation", () => {
  it("forms one committed ballistic rise, hang, and fall without moving either endpoint", () => {
    expect(enemyComboLeapHeight(0, 48)).toBe(0);
    expect(enemyComboLeapHeight(0.25, 48)).toBe(36);
    expect(enemyComboLeapHeight(0.5, 48)).toBe(48);
    expect(enemyComboLeapHeight(0.75, 48)).toBe(36);
    expect(enemyComboLeapHeight(1, 48)).toBe(0);
  });

  it("reports signed rise/fall speed around a zero-velocity apex", () => {
    expect(enemyComboLeapVelocity(0, 350, 48)).toBeGreaterThan(0);
    expect(enemyComboLeapVelocity(0.5, 350, 48)).toBe(0);
    expect(enemyComboLeapVelocity(1, 350, 48)).toBeLessThan(0);
    expect(enemyComboLeapVelocity(0, 350, 48)).toBeCloseTo(-enemyComboLeapVelocity(1, 350, 48));
  });

  it("maps only the six-tick offer portion of the shared thirteen-tick marker clock", () => {
    expect(enemyComboOfferPhase(0, 6, 7)).toBe(0);
    expect(enemyComboOfferPhase(3 / 13, 6, 7)).toBeCloseTo(0.5);
    expect(enemyComboOfferPhase(6 / 13, 6, 7)).toBe(1);
    expect(enemyComboOfferPhase(1, 6, 7)).toBe(1);
  });
});
