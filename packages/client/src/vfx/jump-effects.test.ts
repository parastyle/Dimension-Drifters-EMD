import { describe, expect, it } from "vitest";
import {
  enemyComboLeapHeight,
  enemyComboLeapVelocity,
  enemyComboOfferPhase,
} from "./jump-effects.js";

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
