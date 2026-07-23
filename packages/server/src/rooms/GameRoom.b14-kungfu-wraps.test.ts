import { WEAPONS } from "@dd/shared";
import { describe, expect, it, vi } from "vitest";

vi.mock("colyseus", () => ({
  Room: class {},
  Client: class {},
}));

const { weaponComboForwardDrift } = await import("./GameRoom.js");

describe("GameRoom B14 combo drift authority", () => {
  it("applies Drunken Fist's authored per-beat sway drift", () => {
    const weapon = WEAPONS["x2-drunken-fist-wraps"]!;
    expect(weaponComboForwardDrift(weapon, 0)).toEqual({
      distancePx: 42 * 0.14 * 0.65,
      durationSeconds: 0.14,
    });
    expect(weaponComboForwardDrift(weapon, 1)).toEqual({
      distancePx: 42 * 0.14 * 1.05,
      durationSeconds: 0.14,
    });
    expect(weaponComboForwardDrift(weapon, 2)).toEqual({
      distancePx: 42 * 0.14 * 1.45,
      durationSeconds: 0.14,
    });
  });

  it("does not add hidden micro-movement to the other three styles", () => {
    for (const id of ["x2-muay-thai-wraps", "x2-wing-chun-wraps", "x2-iron-palm-wraps"]) {
      expect(weaponComboForwardDrift(WEAPONS[id]!, 0), id).toBeUndefined();
    }
  });
});
