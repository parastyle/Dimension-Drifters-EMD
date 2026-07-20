import { WEAPONS, type WeaponDef } from "@dd/shared";
import { describe, expect, it } from "vitest";
import {
  CLASS_POOL_MOVEMENT_POSTURES,
  createMovementPostureInput,
  createMovementPostureSample,
  type MovementPostureInput,
  type MovementPostureSpec,
  movementPostureFor,
  sampleMovementPosture,
  WEIGHTED_MOVEMENT_POSTURE,
} from "./pose-language.js";

const POSTURES: readonly MovementPostureSpec[] = [
  ...Object.values(CLASS_POOL_MOVEMENT_POSTURES),
  WEIGHTED_MOVEMENT_POSTURE,
];

function weapon(id: string): WeaponDef {
  const def = WEAPONS[id];
  if (!def) throw new Error(`Missing locomotion fixture weapon: ${id}`);
  return def;
}

function sample(spec: MovementPostureSpec, overrides: Partial<MovementPostureInput>) {
  const input = createMovementPostureInput();
  Object.assign(input, { spec, gait: 1, stridePhase: 0.73, ...overrides });
  return sampleMovementPosture(input, createMovementPostureSample());
}

describe("locomotion language descriptors", () => {
  it("resolves a frozen, bounded posture for every weapon id", () => {
    for (const def of Object.values(WEAPONS)) {
      const posture = movementPostureFor(def);
      expect(POSTURES, def.id).toContain(posture);
      expect(Object.isFrozen(posture), def.id).toBe(true);
      expect(posture.strideLengthPx, def.id).toBeGreaterThan(100);
      expect(posture.strideLengthPx, def.id).toBeLessThan(220);
      for (const value of Object.values(posture)) {
        if (typeof value === "number") expect(Number.isFinite(value), def.id).toBe(true);
      }
    }
  });

  it("maps class pools to sword, gunner, and caster language with a weighted big-weapon overlay", () => {
    expect(CLASS_POOL_MOVEMENT_POSTURES.melee.key).toBe("sword");
    expect(CLASS_POOL_MOVEMENT_POSTURES.ranged.key).toBe("gunner");
    expect(CLASS_POOL_MOVEMENT_POSTURES.caster.key).toBe("caster");
    expect(movementPostureFor(weapon("rattler-sabre"))).toBe(CLASS_POOL_MOVEMENT_POSTURES.melee);
    expect(movementPostureFor(weapon("x-gun-ricochet-pistol"))).toBe(
      CLASS_POOL_MOVEMENT_POSTURES.ranged,
    );
    expect(movementPostureFor(weapon("driftblade"))).toBe(WEIGHTED_MOVEMENT_POSTURE);
  });
});

describe("locomotion mirror invariant", () => {
  it("makes facing-right/moving-right and facing-left/moving-left exact mirror poses", () => {
    for (const posture of POSTURES) {
      for (const stridePhase of [0, 0.73, 1.91, 3.4]) {
        const right = sample(posture, {
          facing: 1,
          moveX: 1,
          lagX: 0.62,
          lagY: -0.18,
          stridePhase,
        });
        const left = sample(posture, {
          facing: -1,
          moveX: -1,
          lagX: -0.62,
          lagY: -0.18,
          stridePhase,
        });
        expect(left, `${posture.key}:phase=${stridePhase}`).toEqual(right);
        // The root's one signed scale turns identical local poses into opposite screen-space silhouettes.
        expect(left.bodyRotationRad * -1).toBeCloseTo(-(right.bodyRotationRad * 1), 12);
        expect(left.weaponCarryForwardPx * -1).toBeCloseTo(-(right.weaponCarryForwardPx * 1), 12);
      }
    }
  });

  it("keeps the static class posture but removes periodic/inertial accents under reduced motion", () => {
    for (const posture of POSTURES) {
      const reducedA = sample(posture, {
        facing: 1,
        moveX: 1,
        lagX: 0.9,
        lagY: -0.4,
        stridePhase: 0.4,
        reducedMotion: true,
      });
      const reducedB = sample(posture, {
        facing: 1,
        moveX: 1,
        lagX: -0.9,
        lagY: 0.4,
        stridePhase: 2.2,
        reducedMotion: true,
      });
      expect(reducedA.bodyRotationRad, posture.key).toBeCloseTo(posture.runLeanRad, 12);
      expect(reducedB.bodyRotationRad, posture.key).toBeCloseTo(posture.runLeanRad, 12);
      expect(reducedA.weaponCarryForwardPx, posture.key).toBe(posture.weaponCarryForwardPx);
      for (const key of [
        "bodyBobPx",
        "bodyBounce",
        "handSwingPx",
        "handBobPx",
        "handTrailXPx",
        "handTrailYPx",
        "weaponTrailSwayPx",
        "footStridePx",
        "footLiftPx",
        "footTrailXPx",
        "footTrailYPx",
        "footPivotRad",
        "headBobPx",
      ] as const) {
        expect(reducedA[key], `${posture.key}:${key}`).toBe(0);
        expect(reducedB[key], `${posture.key}:${key}`).toBe(0);
      }
    }
  });
});
