import {
  ACTIVE_WEAPON_CATALOG_IDS,
  ARCHIVED_WEAPON_IDS,
  bladeAngleAt,
  meleeComboSelectionFor,
  meleeReach,
  WEAPONS,
  weaponDamageSources,
} from "@dd/shared";
import { describe, expect, it } from "vitest";
import {
  resolveWeaponEffectRecipe,
  weaponSwingIdentitySizePx,
} from "../packages/client/src/vfx/weapon-effect-recipes.js";

function weapon(id: string) {
  const value = WEAPONS[id];
  if (!value) throw new Error(`Missing V6M weapon: ${id}`);
  return value;
}

describe("V6M melee owner orders", () => {
  it("makes Sparkmitt's second escalation an authoritative eight-beat monk flurry at neutral DPS", () => {
    const sparkmitt = weapon("x2-coyote-trickster-s-sparkmitt");
    const combo = meleeComboSelectionFor(sparkmitt)?.sequence;
    expect(sparkmitt.cooldown).toBe(0.12);
    expect(sparkmitt.damage / sparkmitt.cooldown).toBeCloseTo(3 / 0.34, 10);
    expect(sparkmitt.authoritativeCombo).toBe(true);
    expect(combo).toHaveLength(8);
    expect(combo?.map((step) => step.hand)).toEqual([
      "lead",
      "off",
      "lead",
      "off",
      "lead",
      "off",
      "lead",
      "off",
    ]);
  });

  it("applies the exact Glasswidow, Stormthread, Rimethorn, and Drowned size orders", () => {
    expect(weapon("x2-glasswidow-hexweave").displayLength).toBeCloseTo(52 * 1.77, 10);
    expect(weapon("drift-katana-stormthread").displayLength).toBe(272);
    const rimethorn = weapon("x2-rimethorn-naginata");
    expect(rimethorn.displayLength).toBe(290);
    expect(rimethorn.swingStyle).toBe("arc");
    expect(bladeAngleAt(Math.PI / 2, rimethorn.swingArc, 0.5)).toBeCloseTo(Math.PI / 2, 10);
    const drowned = weapon("x-sword-anchor");
    expect(drowned.displayLength).toBe(247.5);
    expect(meleeReach(drowned)).toBeCloseTo(245.55, 8);
  });

  it("converts Abyssal Apocrypha into a held Garen whirlwind and a painted purple AoE", () => {
    const abyssal = weapon("x2-abyssal-apocrypha");
    expect(abyssal.tags.classPool).toBe("melee");
    expect(abyssal.scatter).toBeUndefined();
    expect(abyssal.swingStyle).toBe("spin");
    expect(abyssal.swingArc).toBeCloseTo(Math.PI * 2, 10);
    expect(abyssal.range).toBe(240);
    expect(abyssal.performance?.twirl?.plane).toBe("ground-whirlwind");
    expect(resolveWeaponEffectRecipe(abyssal)).toMatchObject({
      classification: "weapon-motion",
      swingPack: "void-splat",
      swingCount: 36,
      radialDistribution: "full-circle",
    });
    expect(resolveWeaponEffectRecipe(abyssal)?.impactAnchor).toBeUndefined();
  });

  it("authors Cinderbrand's alternating three-per-second chops and forward walk at neutral DPS", () => {
    const cinderbrand = weapon("x2-cinderbrand-cleaver");
    expect(cinderbrand.cooldown).toBeCloseTo(1 / 3, 12);
    expect(cinderbrand.damage / cinderbrand.cooldown).toBeCloseTo(12 / 0.72, 10);
    expect((cinderbrand.scatter?.damage ?? 0) / cinderbrand.cooldown).toBeCloseTo(5 / 0.72, 10);
    expect((cinderbrand.scatter?.explode?.damage ?? 0) / cinderbrand.cooldown).toBeCloseTo(
      6 / 0.72,
      10,
    );
    expect(cinderbrand.performance).toMatchObject({
      continuous: true,
      forwardDrift: { speedPxPerSecond: 72, durationSeconds: 1 / 3 },
    });
    expect(meleeComboSelectionFor(cinderbrand)?.sequence.map((step) => step.motion)).toEqual([
      "shoulder-chop",
      "reverse-chop",
    ]);
  });

  it("splits Coilshot's old twelve damage into a real draw arc plus throw", () => {
    const coilshot = weapon("x2-coilshot-meteor");
    expect(coilshot.thrown?.damage).toBe(8);
    expect(coilshot.performance?.preThrowDamage).toEqual({ damage: 4, range: 150 });
    expect(coilshot.performance?.preThrowRevolutions).toBe(1);
    expect(weaponDamageSources(coilshot).map(({ label, base }) => [label, base])).toEqual([
      ["throw", 8],
      ["draw twirl", 4],
    ]);
  });

  it("replaces Hollow's undersized dust with dominant organic painted fire", () => {
    const hollow = weapon("x2-hollow-harvest");
    const recipe = resolveWeaponEffectRecipe(hollow);
    expect(recipe).toMatchObject({
      classification: "weapon-motion",
      swingPack: "fire-splat",
      swingCount: 24,
      swingParticleDominance: 0.56,
      radialDistribution: "full-circle",
    });
    expect(weaponSwingIdentitySizePx(recipe, hollow.displayLength)).toBe(84);
    expect(recipe?.impactAnchor).toBeUndefined();
  });

  it("uses the grenade-arc idiom for the three named thrown melees and throws Snakebite", () => {
    expect(weapon("x2-hailspur-sickle").thrown?.arcHeight).toBe(112);
    expect(weapon("rusty-cleaver").thrown?.arcHeight).toBe(124);
    expect(weapon("x2-hangman-s-gavel").thrown?.arcHeight).toBe(132);
    expect(weapon("x2-snakebite-morningstar").thrown).toMatchObject({
      speed: 620,
      range: 480,
      damage: 9,
      rotation: "spin",
    });
  });

  it("carries Dustdevil upright-forward and resolves chop before stab", () => {
    const dustdevil = weapon("x2-dustdevil-glaive");
    expect(dustdevil.performance).toMatchObject({
      hold: "upright",
      carryAngleRad: -1.25,
      carryForwardPx: 14,
    });
    expect(meleeComboSelectionFor(dustdevil)?.sequence.map((step) => step.motion)).toEqual([
      "overhead",
      "impale",
    ]);
  });

  it("archives Kagewake and its Hushglass partner through the catalog archive system", () => {
    for (const id of ["drift-wakizashi-kagewake", "drift-wakizashi-hushglass"]) {
      expect(weapon(id).archived).toBe(true);
      expect(ARCHIVED_WEAPON_IDS).toContain(id);
      expect(ACTIVE_WEAPON_CATALOG_IDS).not.toContain(id);
    }
  });

  it("moves Cinderfang's paired blades and painted slash forward away from the body", () => {
    expect(weapon("x2-cinderfang-wakizashi-pair").performance).toMatchObject({
      comboForwardPx: 38,
      vfxForwardPx: 38,
    });
  });

  it("keeps Saintspar's repeat order as an authoritative upward second hit", () => {
    const saintspar = weapon("x2-saintspar-lochaber");
    const second = meleeComboSelectionFor(saintspar)?.sequence[1];
    expect(saintspar.authoritativeCombo).toBe(true);
    expect(second).toMatchObject({
      motion: "rising-chop",
      direction: -1,
      path: { kind: "sweep", arcMultiplier: -1 },
    });
  });

  it("restructures Reaper's Tithe as rest downswing then the retained full waist orbit", () => {
    const reaper = weapon("x2-reaper-s-tithe");
    const combo = meleeComboSelectionFor(reaper)?.sequence;
    expect(combo?.map((step) => step.motion)).toEqual(["rest-downswing", "waist-orbit"]);
    expect(reaper.swingArc * (combo?.[1]?.path.arcMultiplier ?? 0)).toBeCloseTo(Math.PI * 2, 10);
    expect(reaper.authoritativeCombo).toBe(true);
  });

  it("records Drowned Anchor's thirtyfold water order as superseded by the remove-VFX note", () => {
    const drowned = weapon("x-sword-anchor");
    const recipe = resolveWeaponEffectRecipe(drowned);
    expect(drowned.effectRecipe).toBeUndefined();
    expect(drowned.effectEmitter).toBeUndefined();
    expect(drowned.effectTiming).toBeUndefined();
    expect(recipe).toBeUndefined();
  });

  it("types Galvanic's direct poison separately from its electric chain", () => {
    const galvanic = weapon("x2-galvanic-lancepole");
    expect(galvanic.tags.element).toBe("toxic");
    expect(galvanic.chainLightning).toMatchObject({ jumps: 3, damage: 5 });
  });

  it("speeds Pyreclap without changing edge or quake DPS", () => {
    const pyreclap = weapon("x2-pyreclap-mauler");
    expect(pyreclap.cooldown).toBe(0.55);
    expect(pyreclap.damage / pyreclap.cooldown).toBeCloseTo(6 / 0.85, 10);
    expect((pyreclap.quake?.damage ?? 0) / pyreclap.cooldown).toBeCloseTo(9 / 0.85, 10);
  });
});
