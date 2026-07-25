import {
  createWeaponBankV1,
  meleeComboSelectionFor,
  salvageArchivedWeaponBank,
  swingDescriptorFor,
  WEAPONS,
} from "@dd/shared";
import { describe, expect, it } from "vitest";
import {
  comboPresentationStyleFor,
  continuousFrontflipAngle,
  continuousWhirlPhase,
  createWeaponPerformanceInput,
  createWeaponPerformanceSample,
  edgeLeadScaleY,
  namedWeaponStanceFor,
  sampleWeaponPerformance,
} from "../packages/client/src/sprites/pose-language.js";
import { resolveQuakeVfxRecipe } from "../packages/client/src/vfx/quake-vfx-recipes.js";
import {
  resolveWeaponEffectRecipe,
  weaponEffectRadialPoints,
  weaponEffectCuePoint,
} from "../packages/client/src/vfx/weapon-effect-recipes.js";

function weapon(id: string) {
  const value = WEAPONS[id];
  if (!value) throw new Error(`Missing V5M weapon ${id}`);
  return value;
}

describe("V5M melee owner orders", () => {
  it("carries Reverent farther forward without changing its damage or cadence", () => {
    const reverent = weapon("x2-reverent-broadsword");
    expect(reverent.performance?.comboForwardPx).toBe(34);
    expect({ damage: reverent.damage, cooldown: reverent.cooldown }).toEqual({
      damage: 8,
      cooldown: 0.4,
    });
  });

  it("applies the later Headsman no-VFX order without changing nominal DPS", () => {
    const headsman = weapon("x2-sanctified-headsman");
    expect(resolveWeaponEffectRecipe(headsman)).toBeUndefined();
    expect(headsman).toMatchObject({
      damage: 13,
      cooldown: 0.74,
      range: 160,
      suppressVfx: true,
    });
  });

  it("flips Mirage's painted edge while preserving the +X grip-to-tip axis in both facings", () => {
    const mirage = weapon("x2-mirage-hardlight-saber");
    expect(mirage.performance?.edgeLeadFlip).toBe(true);
    expect(mirage.gripPoints?.primary).toEqual({ x: 0.13, y: 0.5 });
    expect([1, -1].map(() => edgeLeadScaleY(mirage.performance?.edgeLeadFlip))).toEqual([-1, -1]);
  });

  it("keeps both Voltfang hands close together and low on the authored handle", () => {
    const voltfang = weapon("x2-voltfang-tachi");
    expect(namedWeaponStanceFor(voltfang)).toMatchObject({
      id: "low-close-hilt",
      handLateral: 0.18,
      gripSpacing: 0.13,
    });
    expect(voltfang.gripPoints).toEqual({
      primary: { x: 0.1, y: 0.54 },
      secondary: { x: 0.2, y: 0.54, role: "shaft" },
    });
  });

  it("authors Frostfang as a five-beat, DPS-neutral forward-carrying rake combo", () => {
    const frostfang = weapon("x2-frostfang-rakes");
    const combo = meleeComboSelectionFor(frostfang);
    expect(frostfang.authoritativeCombo).toBe(true);
    expect(combo?.sequence).toHaveLength(5);
    expect(combo?.sequence.map((step) => step.motion)).toEqual([
      "rake",
      "rake",
      "scissor",
      "rake",
      "scissor",
    ]);
    expect(combo?.sequence.every((step) => step.path.damageMultiplier === 1)).toBe(true);
    expect("lunge" in (frostfang.performance ?? {})).toBe(false);
    expect(frostfang.range).toBe(172);
  });

  it("distributes Gravechain smoke and Hollow Harvest organic fire over their complete spin radius", () => {
    const grave = resolveWeaponEffectRecipe(weapon("x2-gravechain-scythe"));
    const hollow = resolveWeaponEffectRecipe(weapon("x2-hollow-harvest"));
    expect(grave).toMatchObject({
      swingPack: "void-wisp",
      swingCount: 24,
      radialDistribution: "full-circle",
    });
    expect(hollow).toMatchObject({
      swingPack: "fire-splat",
      swingCount: 24,
      radialDistribution: "full-circle",
    });
    const points = weaponEffectRadialPoints(10, 20, 100, 4);
    expect(points).toHaveLength(4);
    for (const point of points)
      expect(Math.hypot(point.x - 10, point.y - 20)).toBeCloseTo(100, 8);
    expect(points.map((point) => [Math.round(point.x), Math.round(point.y)])).toEqual([
      [110, 20],
      [10, 120],
      [-90, 20],
      [10, -80],
    ]);
  });

  it("speeds up Mournveil presentation with two visual turns and unchanged authoritative arc", () => {
    const mournveil = weapon("x2-mournveil-scythe");
    expect(mournveil.performance?.twirl?.visualRevolutions).toBe(2);
    expect(mournveil.swingArc).toBeCloseTo(Math.PI * 2, 10);
  });

  it("archives Quicksilver and salvages owned copies through the idempotent join migration", () => {
    const quicksilver = weapon("x2-quicksilver-chainblade");
    const bank = createWeaponBankV1();
    bank.stash.push({
      kind: "single",
      entryId: "wi_quicksilver_archive1",
      weapon: {
        instanceId: "wi_quicksilver_archive1",
        weaponId: quicksilver.id,
        rarity: "rare",
        affix: "keen",
        provenance: "enemy-drop",
        sourceWorldTier: 3,
      },
    });
    bank.lastCarry = {
      placements: [{ entryId: "wi_quicksilver_archive1", zone: "active", start: 0 }],
      activeEntryId: "wi_quicksilver_archive1",
    };

    const first = salvageArchivedWeaponBank(bank);
    const second = salvageArchivedWeaponBank(bank);

    expect(quicksilver.archived).toBe(true);
    expect(first).toMatchObject({ salvagedInstances: 1, affectedEntries: 1 });
    expect(first.payout).toBeGreaterThan(0);
    expect(bank.stash).toEqual([]);
    expect(bank.lastCarry).toEqual({ placements: [], activeEntryId: "" });
    expect(second).toMatchObject({ payout: 0, salvagedInstances: 0, affectedEntries: 0 });
  });

  it("rests Iron Vow and Reliquary upright-forward, then presents Reliquary downslash into stab", () => {
    const ironVow = weapon("x2-iron-vow-bearded-axe");
    const reliquary = weapon("x2-reliquary-halberd");
    expect(ironVow.performance).toMatchObject({
      hold: "upright",
      carryForwardPx: 10,
      carryAngleRad: -1.34,
    });
    expect(reliquary.performance).toMatchObject({
      hold: "upright",
      carryForwardPx: 14,
      carryAngleRad: -1.32,
    });
    const combo = meleeComboSelectionFor(reliquary);
    expect(combo?.sequence.map((step) => step.motion)).toEqual(["overhead", "impale"]);
    expect(comboPresentationStyleFor(combo!.family, combo!.sequence[0]!.motion)).toBe("chop");
    expect(comboPresentationStyleFor(combo!.family, combo!.sequence[1]!.motion)).toBe("thrust");
  });

  it("raises Frostgig and Sunlance over the shoulder and keeps both projectiles point-forward", () => {
    for (const id of ["x2-frostgig-harpoon", "x2-sunlance-javelin-pike"]) {
      const thrown = weapon(id);
      expect(thrown.performance).toMatchObject({
        action: "throw-release",
        preThrowRevolutions: 0,
        throwHeightPx: 28,
      });
      expect(thrown.thrown?.rotation).toBe("point-forward");
    }
    const input = createWeaponPerformanceInput();
    input.spec = weapon("x2-frostgig-harpoon").performance!;
    input.phase = "active";
    input.phaseT = 0.5;
    const raised = { ...sampleWeaponPerformance(input, createWeaponPerformanceSample()) };
    input.spec = { ...input.spec, throwHeightPx: 0 };
    const ordinary = sampleWeaponPerformance(input, createWeaponPerformanceSample());
    expect(raised.handY).toBeLessThan(ordinary.handY);
    expect(raised.backHandY).toBeLessThan(ordinary.backHandY);
  });

  it("authors Marrowpike's three server capsule stabs at neutral per-beat damage", () => {
    const marrowpike = weapon("x2-marrowpike-ranseur");
    const combo = meleeComboSelectionFor(marrowpike);
    expect(marrowpike.authoritativeCombo).toBe(true);
    expect(combo?.sequence.map((step) => step.motion)).toEqual(["jab", "jab", "impale"]);
    expect(combo?.sequence.every((step) =>
      step.path.kind === "capsule" && step.path.damageMultiplier === 1,
    )).toBe(true);
  });

  it("places Nullspike's far hand on the painted purple handle", () => {
    expect(weapon("x2-nullspike-pike").gripPoints?.secondary).toEqual({
      x: 0.34,
      y: 0.5,
      role: "shaft",
    });
  });

  it("anchors Cinderbrand magma at the authoritative impact point", () => {
    const cinderbrand = weapon("x2-cinderbrand-pike");
    const recipe = resolveWeaponEffectRecipe(cinderbrand);
    const swing = swingDescriptorFor(cinderbrand, cinderbrand.cooldown);
    const point = weaponEffectCuePoint(
      recipe!,
      cinderbrand,
      { x: 0, y: 0 },
      { x: 80, y: 25 },
      0,
      swing,
      swing.impactSeconds,
    );
    expect(cinderbrand.effectTiming).toBe("impact");
    expect(recipe).toMatchObject({
      classification: "impact",
      impactPack: "fire-splat",
      impactAnchor: "target",
    });
    expect(point).toMatchObject({ x: 80, y: 25 });
  });

  it("performs the slower three-turn planted Gravewarden frontflip with equal total DPS", () => {
    const spade = weapon("gravediggers-spade");
    const descriptor = swingDescriptorFor(spade, spade.cooldown);
    expect(spade.cooldown).toBe(0.6);
    expect(spade.swingArc).toBeCloseTo(Math.PI * 6, 10);
    expect(spade.damage * 3).toBeCloseTo(8, 10);
    expect(descriptor.poseSeconds).toBeLessThanOrEqual(spade.cooldown);
    expect(spade.performance).toMatchObject({
      action: "spin",
      continuous: true,
      suppressSwing: true,
      twirl: {
        plane: "continuous-frontflip",
        direction: "forward",
        visualRevolutions: 3,
        cadenceSeconds: 0.6,
      },
      holdScaling: { cadence: "weapon-cooldown" },
    });
    expect(
      continuousWhirlPhase(
        spade.performance,
        true,
        false,
        0,
        spade.performance?.twirl?.cadenceSeconds ?? spade.cooldown,
      ),
    ).toBe(0);
    const start = continuousFrontflipAngle(0, 3, 1, 1);
    const end = continuousFrontflipAngle(1, 3, 1, 1);
    expect(Math.cos(end)).toBeCloseTo(Math.cos(start), 12);
    expect(Math.sin(end)).toBeCloseTo(Math.sin(start), 12);
    const epsilon = 1e-5;
    const speedBefore =
      (continuousFrontflipAngle(1, 3, 1, 1) -
        continuousFrontflipAngle(1 - epsilon, 3, 1, 1)) /
      epsilon;
    const speedAfter =
      (continuousFrontflipAngle(epsilon, 3, 1, 1) -
        continuousFrontflipAngle(0, 3, 1, 1)) /
      epsilon;
    expect(speedAfter).toBeGreaterThan(0);
    expect(speedBefore).toBeCloseTo(speedAfter, 8);
  });

  it("marks Anvil-Drop as smoke-only while retaining the budgeted hammer-slam shake", () => {
    expect(resolveQuakeVfxRecipe(weapon("x2-anvil-drop"))).toMatchObject({
      variant: "hammer-slam",
      smokeOnly: true,
      shake: 0.018,
    });
  });
});
