import {
  isWornWeapon,
  meleeComboSelectionFor,
  meleeReach,
  swingDescriptorFor,
  swingStyleFor,
  WEAPONS,
} from "@dd/shared";
import { describe, expect, it } from "vitest";

const CLOSE_BLADE_IDS = [
  "twin-bowie-fangs",
  "x2-wendigo-claws",
  "x2-knucklebone-talons",
  "x2-rendclaw-vambrace",
  "x2-frostfang-rakes",
  "x2-wyrmscale-hex-talon",
] as const;

function weapon(id: string) {
  const definition = WEAPONS[id];
  if (!definition) throw new Error(`Missing test weapon: ${id}`);
  return definition;
}

describe("dagger/claw full-body attack routing", () => {
  it("routes the held Twin Bowie knives to dagger rakes without changing mount or arc clock", () => {
    const twin = weapon("twin-bowie-fangs");
    expect(isWornWeapon(twin)).toBe(false);
    expect(swingStyleFor(twin)).toBe("arc");
    expect(meleeComboSelectionFor(twin)).toMatchObject({
      family: "rake",
      variant: "dagger",
    });
    const descriptor = swingDescriptorFor(twin, twin.cooldown);
    expect(descriptor.activeStartSeconds / descriptor.poseSeconds).toBeCloseTo(0.16, 6);
    expect(descriptor.activeEndSeconds / descriptor.poseSeconds).toBeCloseTo(0.74, 6);
  });

  it("routes every named claw/rake through the claw cadence while preserving held versus worn mounts", () => {
    for (const id of CLOSE_BLADE_IDS.slice(1)) {
      const definition = weapon(id);
      expect(meleeComboSelectionFor(definition), id).toMatchObject({
        family: "rake",
        variant: id === "x2-frostfang-rakes" ? "frostfang-forward-rend" : "claw",
      });
    }
    expect(isWornWeapon(weapon("x2-frostfang-rakes"))).toBe(false);
    for (const id of [
      "x2-wendigo-claws",
      "x2-knucklebone-talons",
      "x2-rendclaw-vambrace",
      "x2-wyrmscale-hex-talon",
    ] as const) {
      expect(isWornWeapon(weapon(id)), id).toBe(true);
      expect(swingStyleFor(weapon(id)), id).toBe("pivot");
    }
  });

  it("keeps the accepted lead/off/both visual cadence", () => {
    for (const id of CLOSE_BLADE_IDS) {
      const selection = meleeComboSelectionFor(weapon(id));
      const expectedHands =
        id === "x2-frostfang-rakes"
          ? ["lead", "off", "both", "lead", "both"]
          : ["lead", "off", "both"];
      expect(
        selection?.sequence.map((step) => step.hand),
        id,
      ).toEqual(expectedHands);
      expect(selection?.sequence).toHaveLength(expectedHands.length);
    }
  });

  it("keeps worn maulers and blunt worn gear in the punch vocabulary", () => {
    for (const id of [
      "x2-pyreclap-mauler",
      "x2-thunderhead-stormfists",
      "x2-revenant-knuckle",
      "fists",
    ] as const) {
      const definition = weapon(id);
      expect(swingStyleFor(definition), id).toBe("punch");
      expect(meleeComboSelectionFor(definition), id).toMatchObject({ family: "punch" });
    }
  });

  it("leaves distance fixed while Swift and Heavy scale only descriptor time", () => {
    const twin = weapon("twin-bowie-fangs");
    const swift = swingDescriptorFor(twin, twin.cooldown * 0.82);
    const heavy = swingDescriptorFor(twin, twin.cooldown * 1.2);
    expect(swift.poseSeconds).toBeCloseTo(twin.cooldown * 0.82 * 0.64, 8);
    expect(heavy.poseSeconds).toBeCloseTo(twin.cooldown * 1.2 * 0.64, 8);
    expect(meleeReach(twin)).toBeGreaterThanOrEqual(92);
  });
});
