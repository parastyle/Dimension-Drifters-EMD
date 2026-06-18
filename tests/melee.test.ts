import {
  bladeAngleAt,
  bladeHitsCircle,
  MELEE_BLADE_HALFWIDTH,
  MELEE_SWING_ACTIVE,
  meleeSwingActive,
  pointSegmentDist2,
} from "@dd/shared";
import { describe, expect, it } from "vitest";

describe("pointSegmentDist2 (§20 swept-blade geometry)", () => {
  it("is 0 for a point on the segment", () => {
    expect(pointSegmentDist2(5, 0, 0, 0, 10, 0)).toBeCloseTo(0, 6);
  });

  it("measures perpendicular distance to the segment body", () => {
    expect(pointSegmentDist2(5, 3, 0, 0, 10, 0)).toBeCloseTo(9, 6); // 3px off the line → 3² = 9
  });

  it("clamps to the nearest endpoint when the foot of the perpendicular is off the segment", () => {
    // Point beyond B: nearest is B(10,0), distance 5 → 25.
    expect(pointSegmentDist2(15, 0, 0, 0, 10, 0)).toBeCloseTo(25, 6);
    // Point behind A: nearest is A(0,0), distance 4 → 16.
    expect(pointSegmentDist2(0, 4, 0, 0, 10, 0)).toBeCloseTo(16, 6);
  });

  it("handles a degenerate (zero-length) segment as point distance", () => {
    expect(pointSegmentDist2(3, 4, 2, 2, 2, 2)).toBeCloseTo(5, 6); // (1,2) → 1+4=5
  });
});

describe("bladeAngleAt (§20 sweep)", () => {
  it("sweeps from aim−arc/2 at p=0 to aim+arc/2 at p=1, centred at p=0.5", () => {
    expect(bladeAngleAt(0, 2, 0)).toBeCloseTo(-1, 6);
    expect(bladeAngleAt(0, 2, 0.5)).toBeCloseTo(0, 6);
    expect(bladeAngleAt(0, 2, 1)).toBeCloseTo(1, 6);
  });

  it("clamps progress outside [0,1]", () => {
    expect(bladeAngleAt(0, 2, -1)).toBeCloseTo(-1, 6);
    expect(bladeAngleAt(0, 2, 9)).toBeCloseTo(1, 6);
  });
});

describe("bladeHitsCircle (§20 — any part of the blade touching = a hit)", () => {
  const wielder = { x: 0, y: 0 };

  it("hits an enemy the blade line passes through", () => {
    // Blade points along +x for 120px; an enemy at (80,0) r18 sits right on the line.
    expect(bladeHitsCircle(wielder, 0, 120, { x: 80, y: 0 }, 18, MELEE_BLADE_HALFWIDTH)).toBe(true);
  });

  it("hits an enemy GRAZING the side of the blade (within radius + halfWidth)", () => {
    // 18 (enemy r) + 16 (halfWidth) = 34px tolerance off the line; 30px off → still a graze hit.
    expect(bladeHitsCircle(wielder, 0, 120, { x: 60, y: 30 }, 18, MELEE_BLADE_HALFWIDTH)).toBe(
      true,
    );
  });

  it("misses an enemy clearly off the blade line", () => {
    expect(bladeHitsCircle(wielder, 0, 120, { x: 60, y: 90 }, 18, MELEE_BLADE_HALFWIDTH)).toBe(
      false,
    );
  });

  it("misses an enemy past the blade tip (out of reach)", () => {
    expect(bladeHitsCircle(wielder, 0, 120, { x: 200, y: 0 }, 18, MELEE_BLADE_HALFWIDTH)).toBe(
      false,
    );
  });

  it("point-blank (enemy on the wielder) always connects", () => {
    expect(bladeHitsCircle(wielder, 1.2, 120, { x: 0, y: 0 }, 18, MELEE_BLADE_HALFWIDTH)).toBe(
      true,
    );
  });

  it("respects the blade ANGLE — the same enemy is hit only when the blade sweeps to it", () => {
    const enemy = { x: 0, y: 80 }; // straight DOWN (+y)
    expect(bladeHitsCircle(wielder, 0, 120, enemy, 18, MELEE_BLADE_HALFWIDTH)).toBe(false); // pointing +x
    expect(bladeHitsCircle(wielder, Math.PI / 2, 120, enemy, 18, MELEE_BLADE_HALFWIDTH)).toBe(true); // swept to +y
  });
});

describe("meleeSwingActive (§20 window clamp)", () => {
  it("uses the base active window for a normal cooldown", () => {
    expect(meleeSwingActive(0.5)).toBeCloseTo(MELEE_SWING_ACTIVE, 6);
  });

  it("never lets the blade stay live past ~the weapon's own cooldown (fast weapons)", () => {
    expect(meleeSwingActive(0.1)).toBeLessThanOrEqual(0.1);
    expect(meleeSwingActive(0.1)).toBeCloseTo(0.09, 6);
  });
});
