import {
  meleeComboSelectionFor,
  swingDescriptorFor,
  swingDescriptorWithComboStep,
  WEAPONS,
  weaponUsesAuthoritativeEnvelopeCombo,
} from "@dd/shared";
import { describe, expect, it } from "vitest";
import { weaponPoseFamilyFor, weaponPoseSpecFor } from "../sprites/pose-language.js";
import { rollTumbleRotation } from "../vfx/jump-effects.js";

describe("Reverent Broadsword martial two-beat combo", () => {
  const weapon = WEAPONS["x2-reverent-broadsword"];
  if (!weapon) throw new Error("missing Reverent Broadsword fixture");
  const combo = meleeComboSelectionFor(weapon);
  if (!combo) throw new Error("missing Reverent Broadsword combo");

  it("authors exactly a one-hand stab followed by an in-place paper-flip stab", () => {
    expect(weapon.swingStyle).toBe("thrust");
    expect(weaponUsesAuthoritativeEnvelopeCombo(weapon)).toBe(true);
    expect(combo).toMatchObject({
      family: "thrust",
      variant: "reverent-two-stab-flip",
    });
    expect(combo.sequence).toHaveLength(2);
    expect(
      combo.sequence.map(({ motion, hand, theatrics }) => ({ motion, hand, theatrics })),
    ).toEqual([
      { motion: "jab", hand: "lead", theatrics: undefined },
      { motion: "impale", hand: "lead", theatrics: { flip: "front" } },
    ]);
    expect(combo.sequence.every((step) => step.rootMotion === undefined)).toBe(true);
    expect(weapon.performance?.forwardDrift).toBeUndefined();
  });

  it("uses the opposite extended free hand and capsule stab envelopes on both beats", () => {
    expect(weaponPoseFamilyFor(weapon)).toBe("one-hand-blade");
    expect(weaponPoseSpecFor(weapon)).toMatchObject({
      offHandVerb: "oppose",
      active: { forward: -0.075, lateral: 0.205 },
    });

    for (const stepIndex of [0, 1]) {
      const descriptor = swingDescriptorWithComboStep(
        swingDescriptorFor(weapon, weapon.cooldown),
        weapon,
        stepIndex,
      );
      expect(descriptor).toMatchObject({
        style: "thrust",
        comboStep: stepIndex,
        comboPath: {
          kind: "capsule",
          deltaAngle: 0,
          arcMultiplier: 0,
          rangeMultiplier: 1,
          damageMultiplier: 1,
        },
      });
    }
  });

  it.each([-1, 1] as const)(
    "presents one full 360 paper rotation without translating the character (facing %i)",
    (facing) => {
      expect(rollTumbleRotation(0, facing)).toBeCloseTo(0);
      expect(Math.abs(rollTumbleRotation(0.5, facing))).toBeCloseTo(Math.PI);
      expect(Math.abs(rollTumbleRotation(1, facing))).toBeCloseTo(Math.PI * 2);
      expect(combo.sequence[1]?.rootMotion).toBeUndefined();
    },
  );
});
