import { thrownProjectileKindFor, thrownProjectileSpriteId, WEAPONS } from "@dd/shared";
import { describe, expect, it } from "vitest";

const PRE_CHANGE_DPS = {
  "x2-sidewinder-spontoon": 7 / 0.32,
  "x2-stormcrow-twin-hatchets": 5 / 0.3,
  "x2-boothook-harpoon": (12 * 3) / 1.8,
} as const;

function weapon(id: keyof typeof PRE_CHANGE_DPS) {
  const value = WEAPONS[id];
  if (!value) throw new Error(`Missing B7 weapon ${id}`);
  return value;
}

function nominalThrownDps(id: keyof typeof PRE_CHANGE_DPS): number {
  const thrown = weapon(id).thrown;
  if (!thrown) throw new Error(`B7 weapon ${id} is not built as thrown`);
  return (thrown.damage * thrown.charges) / thrown.refillSeconds;
}

describe("B7 thrown conversions", () => {
  it("builds Sidewinder Spontoon and Stormcrow Twin-Hatchets as own-sprite throws", () => {
    for (const id of ["x2-sidewinder-spontoon", "x2-stormcrow-twin-hatchets"] as const) {
      const definition = weapon(id);
      // Source behavior.kind is lowered to the built thrown payload and delivery tag.
      expect(definition.thrown).toBeDefined();
      expect(definition.tags.delivery).toBe("thrown");
      expect(definition.performance).toMatchObject({
        action: "throw-release",
        suppressSwing: true,
      });
      expect(thrownProjectileSpriteId(thrownProjectileKindFor(definition))).toBe(id);
    }

    expect(weapon("x2-stormcrow-twin-hatchets").tags.element).toBe("shock");
  });

  it("keeps Boothook thrown, point-forward, and no-spin through its over-shoulder release", () => {
    const boothook = weapon("x2-boothook-harpoon");
    expect(boothook.tags.delivery).toBe("thrown");
    expect(boothook.thrown).toMatchObject({
      speed: 760,
      rotation: "point-forward",
    });
    expect(boothook.performance).toMatchObject({
      action: "throw-release",
      suppressSwing: true,
      preThrowRevolutions: 0,
      throwHeightPx: 28,
    });
    expect(boothook.performance?.carryAngleRad).toBeLessThan(-Math.PI / 3);
    expect(boothook.performance?.carryAngleRad).toBeGreaterThan(-Math.PI / 2);
  });

  it("keeps each weapon's nominal sustained DPS within one percent", () => {
    for (const [id, before] of Object.entries(PRE_CHANGE_DPS)) {
      const after = nominalThrownDps(id as keyof typeof PRE_CHANGE_DPS);
      expect(Math.abs(after - before) / before, id).toBeLessThanOrEqual(0.01);
    }
  });
});
