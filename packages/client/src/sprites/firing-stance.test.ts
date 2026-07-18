import { WEAPONS, type WeaponDef } from "@dd/shared";
import { describe, expect, it } from "vitest";
import {
  FIRING_FACE_LINE_Y,
  FIRING_STANCES,
  FIST_GUN_CHEST_CAP_Y,
  type FiringHandRole,
  firingHandTarget,
  firingStanceFamilyFor,
  firingStanceFor,
  usesAimedFiringStance,
} from "./firing-stance.js";

function weapon(id: string): WeaponDef {
  const def = WEAPONS[id];
  if (!def) throw new Error(`Missing stance fixture weapon: ${id}`);
  return def;
}

const FAMILY_FIXTURES = [
  ["pistol", "x-gun-revolver-cannon"],
  ["long-gun", "x2-sunbreaker-railgun"],
  ["scattergun", "x-gun-coffin-shotgun"],
  ["rapid-gun", "x-gun-nailgun"],
  ["launcher", "x-gun-hand-mortar"],
  ["fist-gun", "x2-hellmouth-palmcaster"],
  ["wand", "x-staff-storm-rod"],
  ["staff", "x-staff-arcane-lance"],
  ["tome", "x2-null-grimoire-of-the-hollow-page"],
  ["thrown", "x-sword-railspike"],
] as const;

describe("weapon firing-stance table", () => {
  it("classifies every real ranged/caster delivery family from mechanism and tags", () => {
    for (const [family, id] of FAMILY_FIXTURES) {
      expect(firingStanceFamilyFor(weapon(id)), id).toBe(family);
    }
  });

  it("keeps every per-family aimed hand target inside its authored band and below the face", () => {
    const aimExtremes = [-Math.PI / 2, 0, Math.PI / 2];
    for (const [family, id] of FAMILY_FIXTURES) {
      if (family === "thrown") continue;
      const def = weapon(id);
      const stance = firingStanceFor(def);
      const roles: FiringHandRole[] = stance.castingHand
        ? ["lead", "off", "casting"]
        : ["lead", "off"];
      for (const role of roles) {
        for (const aim of aimExtremes) {
          const { y } = firingHandTarget(def, role, aim);
          expect(y, `${family}:${role}:min`).toBeGreaterThanOrEqual(
            stance.yBand[0] - Number.EPSILON,
          );
          expect(y, `${family}:${role}:max`).toBeLessThanOrEqual(stance.yBand[1] + Number.EPSILON);
          expect(y, `${family}:${role}:face`).toBeGreaterThan(FIRING_FACE_LINE_Y);
        }
      }
    }
  });

  it("hard-caps worn fist-guns at chest height and squares the body", () => {
    const fistGun = weapon("x2-hellmouth-palmcaster");
    const dualFistGun = weapon("x2-voltvein-conductors");
    for (const def of [fistGun, dualFistGun]) {
      const stance = firingStanceFor(def);
      expect(stance.family).toBe("fist-gun");
      expect(stance.bodyTurn).toBe(0);
      for (const role of ["lead", "off"] as const) {
        expect(firingHandTarget(def, role, -Math.PI / 2).y).toBeGreaterThanOrEqual(
          FIST_GUN_CHEST_CAP_Y,
        );
      }
    }
  });

  it("resolves heterogeneous dual-wield hands independently", () => {
    const pistol = weapon("x-gun-ricochet-pistol");
    const fistGun = weapon("x2-hellmouth-palmcaster");
    expect(firingStanceFamilyFor(pistol)).toBe("pistol");
    expect(firingStanceFamilyFor(fistGun)).toBe("fist-gun");
    expect(firingHandTarget(pistol, "lead", 0)).toEqual({ x: 0.245, y: -0.08 });
    expect(firingHandTarget(fistGun, "off", 0)).toEqual({ x: 0.238, y: -0.035 });
  });

  it("leaves thrown wind-up to the throw animation instead of the retained aim envelope", () => {
    const thrown = weapon("x-sword-railspike");
    expect(firingStanceFor(thrown)).toBe(FIRING_STANCES.thrown);
    expect(usesAimedFiringStance(thrown)).toBe(false);
    expect(firingHandTarget(thrown, "lead", -Math.PI / 2)).toEqual({ x: 0, y: 0 });
  });
});
