import { describe, expect, it } from "vitest";
import { PROJECTILE_SPRITES } from "../../sprites/projectile-manifest.js";
import {
  BARREL_ROLL_RATE_RADIANS_PER_SECOND,
  barrelRollArtTransform,
  projectileArtTransform,
} from "./projectile-facing.js";

function transformedForward(rotation: number, scaleX: number): { x: number; y: number } {
  return {
    x: Math.cos(rotation) * scaleX,
    y: Math.sin(rotation) * scaleX,
  };
}

describe("projectile art facing", () => {
  it("audits every manifest sprite and flags the holy skull as mirror-upright", () => {
    const entries = Object.entries(PROJECTILE_SPRITES);
    const asymmetric = entries.filter(([, sprite]) => sprite.asymmetric);
    const rotational = entries
      .filter(([, sprite]) => !sprite.asymmetric)
      .map(([id]) => id)
      .sort();

    expect(entries).toHaveLength(24);
    expect(asymmetric).toHaveLength(22);
    expect(asymmetric.every(([, sprite]) => sprite.facing === "mirror-upright")).toBe(true);
    expect(PROJECTILE_SPRITES["saintskull-monstrance-holy-skull"]).toMatchObject({
      asymmetric: true,
      facing: "mirror-upright",
    });
    expect(rotational).toEqual(["coyotes-grin-throwing-blade", "thunderhead-smoke-ring"]);
  });

  it("mirrors left-moving asymmetric art without rotating its authored top through pi", () => {
    const right = projectileArtTransform(900, 0, "mirror-upright");
    const left = projectileArtTransform(-900, 0, "mirror-upright");

    expect(right).toEqual({ rotation: 0, scaleX: 1 });
    expect(left.rotation).toBeCloseTo(0, 10);
    expect(left.scaleX).toBe(-1);
  });

  it("keeps mirrored asymmetric art point-forward for every non-zero velocity", () => {
    const velocities: ReadonlyArray<readonly [number, number]> = [
      [8, 2],
      [8, -2],
      [-8, 2],
      [-8, -2],
      [0, 8],
      [0, -8],
    ];
    for (const [vx, vy] of velocities) {
      const transform = projectileArtTransform(vx, vy, "mirror-upright");
      const forward = transformedForward(transform.rotation, transform.scaleX);
      const length = Math.hypot(vx, vy);
      expect(forward.x).toBeCloseTo(vx / length, 10);
      expect(forward.y).toBeCloseTo(vy / length, 10);
      expect(Math.abs(transform.rotation)).toBeLessThanOrEqual(Math.PI / 2 + 1e-10);
    }
  });

  it("retains full travel-angle rotation for rotational art", () => {
    const left = projectileArtTransform(-900, 0, "rotate");
    expect(Math.abs(left.rotation)).toBeCloseTo(Math.PI, 10);
    expect(left.scaleX).toBe(1);
  });

  it("keeps a barrel-rolling spear on its flight heading while paper-mirroring its normal axis", () => {
    const rightFront = barrelRollArtTransform(8, 2, 0);
    const rightBack = barrelRollArtTransform(
      8,
      2,
      Math.PI / BARREL_ROLL_RATE_RADIANS_PER_SECOND,
    );
    const leftQuarter = barrelRollArtTransform(
      -8,
      -2,
      Math.PI / (2 * BARREL_ROLL_RATE_RADIANS_PER_SECOND),
    );

    expect(rightFront.rotation).toBeCloseTo(Math.atan2(2, 8), 10);
    expect(rightBack.rotation).toBeCloseTo(rightFront.rotation, 10);
    expect(rightFront.scaleY).toBeCloseTo(1, 10);
    expect(rightBack.scaleY).toBeCloseTo(-1, 10);
    expect(leftQuarter.rotation).toBeCloseTo(Math.atan2(-2, -8), 10);
    expect(Math.abs(leftQuarter.scaleY)).toBeLessThan(1e-10);
  });
});
