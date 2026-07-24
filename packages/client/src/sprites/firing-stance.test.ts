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
  GUN_HEAD_DROP_PX,
  GUN_HEAD_NOD_RAD,
  gunCheekWeldPoseFor,
  usesAimedFiringStance,
} from "./firing-stance.js";
import {
  createPoseLanguageInput,
  createPoseLanguageSample,
  samplePoseLanguage,
  weaponPoseSpecFor,
} from "./pose-language.js";

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
  it("maps rifle, railgun, and bolt catalog fiction to the full visible cheek weld", () => {
    for (const id of [
      "x2-cinderbore-longrifle",
      "x2-sunbreaker-railgun",
      "x2-barrett-50-cal-sniper",
      "x2-mauler-slug-thrower",
    ]) {
      expect(gunCheekWeldPoseFor(weapon(id)), id).toEqual({
        weaponClass: "sightedLong",
        dropPx: GUN_HEAD_DROP_PX.sightedLong,
        nodRad: GUN_HEAD_NOD_RAD.sightedLong,
      });
    }
  });

  it("gives pistols and other short-gun fiction the half cheek weld only", () => {
    for (const id of [
      "x-gun-revolver-cannon",
      "x-gun-nailgun",
      "x-gun-coffin-shotgun",
      "x-gun-hand-mortar",
    ]) {
      expect(gunCheekWeldPoseFor(weapon(id)), id).toEqual({
        weaponClass: "short",
        dropPx: GUN_HEAD_DROP_PX.short,
        nodRad: GUN_HEAD_NOD_RAD.short,
      });
    }
    expect(gunCheekWeldPoseFor(weapon("x-staff-arcane-lance"))).toBeUndefined();
  });

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

  it("hard-caps worn fist-guns on the shoulder lane and squares the body", () => {
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

  it("gives Gravesinger its intentional behind-head, above-shoulder launcher lane", () => {
    const launcher = weapon("x2-gravesinger-s-hex-wand");
    const stance = firingStanceFor(launcher);
    const lead = firingHandTarget(launcher, "lead", 0);
    const off = firingHandTarget(launcher, "off", 0);

    expect(firingStanceFamilyFor(launcher)).toBe("shoulder-launcher");
    expect(stance.yBand).toEqual([-0.36, -0.21]);
    expect(lead.x).toBeLessThan(0);
    expect(lead.y).toBeLessThan(FIRING_FACE_LINE_Y);
    expect(off.y).toBeLessThan(FIRING_FACE_LINE_Y);
  });

  it("resolves both hands of an authored dual weapon from one definition", () => {
    const weaponDef = weapon("x2-coyote-stinger");
    expect(firingStanceFamilyFor(weaponDef)).toBe("rapid-gun");
    expect(firingHandTarget(weaponDef, "lead", 0)).toEqual({ x: 0.222, y: -0.18 });
    expect(firingHandTarget(weaponDef, "off", 0)).toEqual({ x: 0.158, y: -0.16 });
  });

  it("leaves thrown wind-up to the throw animation instead of the retained aim envelope", () => {
    const thrown = weapon("x-sword-railspike");
    expect(firingStanceFor(thrown)).toBe(FIRING_STANCES.thrown);
    expect(usesAimedFiringStance(thrown)).toBe(false);
    expect(firingHandTarget(thrown, "lead", -Math.PI / 2)).toEqual({ x: 0, y: 0 });
  });
});

// POSE IMPLEMENTATION WAVE — append-only firing-height invariants with a live off-hand equilibrium.
describe("firing stance composed with pose language", () => {
  it("leaves every aimed firing-hand band and face-line cap canonical", () => {
    for (const [, id] of FAMILY_FIXTURES) {
      const def = weapon(id);
      if (!usesAimedFiringStance(def)) continue;
      const stance = firingStanceFor(def);
      const input = createPoseLanguageInput();
      input.spec = weaponPoseSpecFor(def);
      input.freeHand = 1;
      input.phase = "active";
      input.phaseT = 0.5;
      samplePoseLanguage(input, createPoseLanguageSample());
      for (const role of ["lead", "off"] as const) {
        const target = firingHandTarget(def, role, Math.PI / 3);
        expect(target.y, `${id}:${role}:min`).toBeGreaterThanOrEqual(stance.yBand[0]);
        expect(target.y, `${id}:${role}:max`).toBeLessThanOrEqual(stance.yBand[1]);
        expect(target.y, `${id}:${role}:face`).toBeGreaterThan(FIRING_FACE_LINE_Y);
      }
    }
  });

  it("keeps thrown outside aimed linger and fist-guns under the chest cap", () => {
    expect(usesAimedFiringStance(weapon("x-sword-railspike"))).toBe(false);
    const fistGun = weapon("x2-hellmouth-palmcaster");
    expect(firingHandTarget(fistGun, "lead", -Math.PI / 2).y).toBeGreaterThanOrEqual(
      FIST_GUN_CHEST_CAP_Y,
    );
    expect(weaponPoseSpecFor(fistGun).family).toBe("fist-gun");
  });
});
