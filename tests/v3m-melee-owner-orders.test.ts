import { holdScaledSwingCount, meleeComboSelectionFor, WEAPONS } from "@dd/shared";
import { describe, expect, it } from "vitest";

import {
  comboWeaponThicknessSign,
  createWeaponPerformanceInput,
  createWeaponPerformanceSample,
  namedWeaponStanceFor,
  sampleWeaponPerformance,
  shaftMidpointPivotTransform,
  twirlDirectionForBeat,
} from "../packages/client/src/sprites/pose-language.js";
import { resolveWeaponEffectRecipe } from "../packages/client/src/vfx/weapon-effect-recipes.js";
import { WEAPON_VFX } from "../packages/client/src/vfx/weapon-vfx.generated.js";

function weapon(id: string) {
  const definition = WEAPONS[id];
  expect(definition, id).toBeDefined();
  return definition!;
}

describe("V3M named reusable blade stances", () => {
  it.each([
    ["drift-nodachi-pale-horizon", "hasso-no-kamae", "screen"],
    ["x2-hailwidow-katana", "tachi-no-tori", "screen"],
    ["drift-katana-riftstep", "blade-forward-high-hilt", "aim"],
    ["drift-katana-stillwater-edict", "two-hands-on-hilt", "aim"],
  ] as const)("resolves %s through %s", (id, stanceId, angleReference) => {
    const stance = namedWeaponStanceFor(weapon(id));
    expect(stance).toMatchObject({ id: stanceId, angleReference });
  });
});

describe("V3M twirl geometry and held cadence", () => {
  it("pins a shaft midpoint to the character centre throughout a perfect circle", () => {
    const center = { x: 17, y: -9 };
    const length = 280;
    const grip = 0.12;
    for (const angle of [0, Math.PI / 3, Math.PI, Math.PI * 1.75]) {
      const pose = shaftMidpointPivotTransform(center.x, center.y, angle, length, grip);
      const offset = (0.5 - grip) * length;
      expect(pose.x + Math.cos(angle) * offset).toBeCloseTo(center.x, 8);
      expect(pose.y + Math.sin(angle) * offset).toBeCloseTo(center.y, 8);
      expect(Math.hypot(pose.x - center.x, pose.y - center.y)).toBeCloseTo(offset, 8);
    }
    expect(weapon("x2-mournveil-scythe").performance?.twirl).toEqual({
      plane: "screen-circle",
      pivot: "shaft-midpoint",
      direction: "forward",
      visualRevolutions: 2,
    });
  });

  it("grows Hollow Harvest's accepted swing count at its authoritative cadence", () => {
    const hollow = weapon("x2-hollow-harvest");
    // N(T)=1+floor(T/0.66); each 12-damage revolution stays unchanged (18.18 base DPS).
    expect(holdScaledSwingCount(0, hollow.cooldown)).toBe(1);
    expect(holdScaledSwingCount(0.65, hollow.cooldown)).toBe(1);
    expect(holdScaledSwingCount(0.66, hollow.cooldown)).toBe(2);
    expect(holdScaledSwingCount(3.3, hollow.cooldown)).toBe(6);
    expect(holdScaledSwingCount(99, hollow.cooldown)).toBe(151);
    expect(hollow.performance?.holdScaling).toEqual({ cadence: "weapon-cooldown" });
    expect(hollow.swingArc).toBeCloseTo(Math.PI * 2, 10);
    expect(hollow.damage / hollow.cooldown).toBeCloseTo(12 / 0.66, 10);
  });

  it("alternates Gravechain's Garen direction while retaining full server arcs", () => {
    const gravechain = weapon("x2-gravechain-scythe");
    expect(gravechain.swingArc).toBeCloseTo(Math.PI * 2, 10);
    expect(gravechain.performance?.twirl?.plane).toBe("ground-whirlwind");
    expect([1, 2, 3, 4].map((beat) => twirlDirectionForBeat("alternate", beat))).toEqual([
      1,
      -1,
      1,
      -1,
    ]);
  });
});

describe("V3M flight, impact, and locomotion anchors", () => {
  it("promotes Hailspur to a spinning thrown sickle", () => {
    expect(weapon("x2-hailspur-sickle").thrown).toMatchObject({
      speed: 680,
      range: 520,
      rotation: "spin",
    });
  });

  it("flies Frostgig point-first without tumble after the behind-shoulder draw", () => {
    const frostgig = weapon("x2-frostgig-harpoon");
    expect(frostgig.displayLength).toBe(176);
    expect(frostgig.thrown?.rotation).toBe("point-forward");
    expect(frostgig.performance).toMatchObject({
      action: "throw-release",
      preThrowRevolutions: 0,
    });
  });

  it("anchors Nullspike's circle recipe to the struck target", () => {
    expect(resolveWeaponEffectRecipe(weapon("x2-nullspike-pike"))).toMatchObject({
      impactPack: "void-ring",
      impactAnchor: "target",
    });
  });

  it("drives Reaper's Tithe staff tap from locomotion stride phase", () => {
    const tithe = weapon("x2-reaper-s-tithe");
    const input = createWeaponPerformanceInput();
    input.spec = tithe.performance!;
    input.gait = 1;
    input.stridePhase = 0;
    const tap = sampleWeaponPerformance(input, createWeaponPerformanceSample()).handY;
    input.stridePhase = Math.PI;
    const lift = sampleWeaponPerformance(input, createWeaponPerformanceSample()).handY;
    expect(tap).toBeGreaterThan(lift);
  });
});

describe("V3M exact combo and VFX orders", () => {
  it.each([
    ["x2-dustdevil-glaive", 2, ["overhead", "impale"]],
    ["x2-blightfork-glaive", 1, ["jab"]],
    ["x2-saintspar-lochaber", 2, ["overhead", "rising-chop"]],
    ["x2-reliquary-halberd", 2, ["overhead", "impale"]],
    ["x2-wyrmskull-reliquary", 3, ["jab", "jab", "impale"]],
    ["x2-hailwidow-katana", 3, ["shoulder-chop", "guard-check", "splinter-fall"]],
  ] as const)("authors %s as an exact %i-beat sequence", (id, count, motions) => {
    const definition = weapon(id);
    const sequence = meleeComboSelectionFor(definition)?.sequence;
    expect(sequence).toHaveLength(count);
    expect(sequence?.map((step) => step.motion)).toEqual(motions);
    expect(definition.authoritativeCombo).toBe(true);
  });

  it("keeps Hailwidow's three-hit budget neutral while weighting hit three", () => {
    const hook = weapon("x2-hailwidow-katana").katanaHook!;
    expect(((hook.nonFinisherDamageMultiplier ?? 1) * 2 + (hook.finisherDamageMultiplier ?? 1)) / 3)
      .toBeCloseTo(1, 10);
  });

  it("turns Saintspar's painted axe head over for the reverse rising second hit", () => {
    const second = meleeComboSelectionFor(weapon("x2-saintspar-lochaber"))?.sequence[1];
    expect(second).toMatchObject({ motion: "rising-chop", direction: -1 });
    expect(comboWeaponThicknessSign(second)).toBe(-1);
  });

  it("removes Mournveil's cursor VFX entirely and scales Quarry VFX fourfold", () => {
    const mournveil = WEAPON_VFX["x2-mournveil-scythe"]!;
    expect(mournveil).toMatchObject({ suite: {}, suppressFallback: true });
    expect(mournveil.vfxOrigin).toBeUndefined();
    expect(WEAPON_VFX["x2-quarry-splitter-bardiche"]?.vfxRadius).toBe(296);
    expect(resolveWeaponEffectRecipe(weapon("x2-quarry-splitter-bardiche"))).toMatchObject({
      swingScaleMultiplier: 4,
    });
  });

  it("replaces Sermon's quake look with notes and promotes Thunderhead to its painted sweep", () => {
    expect(resolveWeaponEffectRecipe(weapon("x2-sermon-bell"))).toMatchObject({
      musicalNotes: true,
      suppressQuakeVfx: true,
    });
    const thunderhead = resolveWeaponEffectRecipe(weapon("x2-thunderhead-voulge"));
    expect(thunderhead).toMatchObject({ paintedSwing: true });
    expect(thunderhead?.swingPack).toBeUndefined();
  });

  it("applies the remaining exact size, carry, and VFX-suppression orders", () => {
    expect(weapon("x2-dustdevil-glaive").displayLength).toBe(300);
    expect(weapon("drift-katana-stillwater-edict").displayLength).toBe(260);
    expect(weapon("x2-thunderhead-voulge")).toMatchObject({
      displayLength: 198,
      performance: { hold: "upright" },
    });
    expect(weapon("x2-wickfire-fauchard").performance?.carryAngleRad).toBeCloseTo(-1.05, 10);
    expect(weapon("x2-reliquary-halberd").suppressVfx).toBe(true);
  });
});
