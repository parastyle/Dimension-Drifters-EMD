import { existsSync, readFileSync } from "node:fs";
import {
  comboRibbonFanOutScaleAt,
  comboRibbonWidthMultiplierAt,
  hybridProjectileDamagePerAcceptedBeat,
  meleeComboSelectionFor,
  meleeDamageEnvelopeFor,
  swingDescriptorFor,
  swingDescriptorWithComboStep,
  WEAPONS,
  weaponHitEnvelopeAuthoringFor,
} from "@dd/shared";
import { describe, expect, it } from "vitest";
import { SPRITES } from "../packages/client/src/sprites/manifest.js";
import {
  FAN_TORNADO_WEAPON_VFX_IDS,
  FAN_TORNADO_WEAPON_VFX_RECIPES,
  fanTornadoReleasePlanFor,
  generatedImageVfxReplacesProceduralRecipe,
  resolveGeneratedImageWeaponVfxRecipe,
} from "../packages/client/src/vfx/generated-image-weapon-vfx-recipes.js";
import { WEAPON_VFX } from "../packages/client/src/vfx/weapon-vfx.generated.js";
import { weaponVfxSuiteFor } from "../packages/client/src/vfx/weapon-vfx-suite.js";

const EXPECTED = {
  "x2-iron-war-fan": {
    subject: "vfx-tornado-iron-gale",
    dimensions: [839, 1380],
    element: "physical",
    suite: "blade-trail",
  },
  "x2-ember-fan": {
    subject: "vfx-tornado-ember-fire",
    dimensions: [468, 768],
    element: "fire",
    suite: "blade-trail",
  },
  "x2-storm-fan": {
    subject: "vfx-tornado-storm-shock",
    dimensions: [901, 1444],
    element: "shock",
    suite: "twin-slash",
  },
} as const;

function requiredWeapon(id: (typeof FAN_TORNADO_WEAPON_VFX_IDS)[number]) {
  const weapon = WEAPONS[id];
  if (!weapon) throw new Error(`Missing B18 fan ${id}`);
  return weapon;
}

function pngDimensions(path: string): readonly [number, number] {
  const bytes = readFileSync(path);
  expect(bytes.subarray(1, 4).toString("ascii"), path).toBe("PNG");
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)] as const;
}

describe("B18 fan-out tornado integration", () => {
  it("catalogs one distinct generated tornado subject per fan without replacing retained fan layers", () => {
    expect(FAN_TORNADO_WEAPON_VFX_IDS).toEqual([
      "x2-iron-war-fan",
      "x2-ember-fan",
      "x2-storm-fan",
    ]);
    expect(Object.keys(FAN_TORNADO_WEAPON_VFX_RECIPES)).toEqual(
      FAN_TORNADO_WEAPON_VFX_IDS,
    );
    expect(
      new Set(Object.values(FAN_TORNADO_WEAPON_VFX_RECIPES).map((recipe) => recipe.subject))
        .size,
    ).toBe(3);

    for (const id of FAN_TORNADO_WEAPON_VFX_IDS) {
      const expected = EXPECTED[id];
      const weapon = requiredWeapon(id);
      const recipe = FAN_TORNADO_WEAPON_VFX_RECIPES[id];
      expect(resolveGeneratedImageWeaponVfxRecipe(id), id).toEqual(recipe);
      expect(WEAPON_VFX[id]?.generatedImage, id).toMatchObject({
        kind: "fan-tornado",
        subject: expected.subject,
        damageMode: "presentation-only",
        poolSize: 1,
      });
      expect(WEAPON_VFX[id]?.suite, id).toEqual({});
      expect(WEAPON_VFX[id]?.suppressFallback, id).not.toBe(true);
      expect(generatedImageVfxReplacesProceduralRecipe(id), id).toBe(false);
      const retained = weaponVfxSuiteFor(id, weapon.tags.element, "orbit");
      expect(retained.authored, id).toBe(false);
      expect(Object.keys(retained.suite), id).toEqual([expected.suite]);
    }
  });

  it("publishes weapon-vfx manifest rows and exact native PNG dimensions", () => {
    for (const id of FAN_TORNADO_WEAPON_VFX_IDS) {
      const { subject, dimensions } = EXPECTED[id];
      const path = `packages/client/public/sprites/${subject}/part-1.png`;
      expect(existsSync(path), id).toBe(true);
      expect(pngDimensions(path), id).toEqual(dimensions);
      expect(SPRITES[subject], id).toMatchObject({
        id: subject,
        kind: "weapon-vfx",
        canvas: { w: dimensions[0], h: dimensions[1] },
        parts: [{ file: "part-1.png", w: dimensions[0], h: dimensions[1] }],
      });
      expect(FAN_TORNADO_WEAPON_VFX_RECIPES[id].url, id).toBe(
        `sprites/${subject}/part-1.png`,
      );
    }
  });

  it("keeps generated weapon-vfx direct-loaded and outside the boot atlas", () => {
    const packerSource = readFileSync(
      new URL("../tools/artkit/pack-atlas.mjs", import.meta.url),
      "utf8",
    );
    const checkerSource = readFileSync(
      new URL("../tools/artkit/check-assets.mjs", import.meta.url),
      "utf8",
    );
    expect(packerSource).toContain('manifest.kind === "weapon-vfx"');
    expect(checkerSource).toContain('directLoadedWeaponVfx: kind === "weapon-vfx"');
    expect(checkerSource).toContain(
      "!sprite.expansion && !sprite.directLoadedWeaponVfx",
    );
  });

  it("widens every authored fan ribbon from a folded start through a full outward opening", () => {
    for (const id of FAN_TORNADO_WEAPON_VFX_IDS) {
      const selection = meleeComboSelectionFor(requiredWeapon(id));
      expect(selection?.sequence, id).toHaveLength(3);
      for (const [stepIndex, step] of (selection?.sequence ?? []).entries()) {
        expect(
          id === "x2-storm-fan" ? step.path.kind === "dual-sweep" : step.path.kind === "fan",
          `${id}/step-${stepIndex}/path`,
        ).toBe(true);
        const ribbon = step.ribbon;
        expect(ribbon, `${id}/step-${stepIndex}/ribbon`).toBeDefined();
        if (!ribbon) continue;
        const foldedScale = comboRibbonFanOutScaleAt(ribbon, 0);
        const openScale = comboRibbonFanOutScaleAt(ribbon, 1);
        const foldedWidth = comboRibbonWidthMultiplierAt(ribbon, 0);
        const openWidth = comboRibbonWidthMultiplierAt(ribbon, 1);
        expect(foldedScale, `${id}/step-${stepIndex}/folded`).toBeLessThan(0.3);
        expect(openScale, `${id}/step-${stepIndex}/open`).toBeGreaterThan(1);
        expect(openWidth / foldedWidth, `${id}/step-${stepIndex}/spread`).toBeGreaterThan(
          4,
        );
      }
    }
  });

  it("releases at the swept edge, travels only a short presentation path, and alternates Storm lanes", () => {
    for (const id of FAN_TORNADO_WEAPON_VFX_IDS) {
      const weapon = requiredWeapon(id);
      const recipe = FAN_TORNADO_WEAPON_VFX_RECIPES[id];
      const base = swingDescriptorFor(weapon, weapon.cooldown);
      const rightPlans = [0, 1].map((step) =>
        fanTornadoReleasePlanFor(
          weapon,
          recipe,
          400,
          300,
          0,
          swingDescriptorWithComboStep(base, weapon, step),
        ),
      );
      const left = fanTornadoReleasePlanFor(
        weapon,
        recipe,
        400,
        300,
        Math.PI,
        swingDescriptorWithComboStep(base, weapon, 0),
      );
      for (const plan of [...rightPlans, left]) {
        expect(plan.damageMode, id).toBe("presentation-only");
        expect(plan.overlapsMeleeAtSpawn, id).toBe(true);
        expect(
          Math.hypot(plan.endX - plan.startX, plan.endY - plan.startY),
          `${id}/travel`,
        ).toBeCloseTo(recipe.travelPx, 8);
        expect(plan.travelPx, id).toBeGreaterThanOrEqual(40);
        expect(plan.travelPx, id).toBeLessThanOrEqual(50);
        expect(plan.delayMs, id).toBeGreaterThan(0);
        expect(plan.maxVisualRadius, id).toBeLessThan(
          plan.meleeEnvelopeReach + recipe.travelPx + recipe.displayHeight,
        );
      }
      if (id === "x2-storm-fan")
        expect(rightPlans.map((plan) => plan.releaseLane)).toEqual(["lead", "off"]);
      else expect(rightPlans.map((plan) => plan.releaseLane)).toEqual(["center", "center"]);
      expect(Math.sign(left.endX - left.startX), `${id}/left-facing`).toBe(-1);
    }
  });

  it("keeps the authoritative fan envelopes unchanged and nominal DPS exactly at baseline", () => {
    for (const id of FAN_TORNADO_WEAPON_VFX_IDS) {
      const weapon = requiredWeapon(id);
      const envelope = meleeDamageEnvelopeFor(weapon);
      expect(weaponHitEnvelopeAuthoringFor(weapon), `${id}/no-tornado-envelope`).toBeUndefined();
      expect(envelope.maxReach, `${id}/reach`).toBe(envelope.baseReach);
      expect(envelope.maxHalfWidth, `${id}/width`).toBe(envelope.baseHalfWidth);

      const meleeDps = weapon.damage / weapon.cooldown;
      const hybridDps =
        hybridProjectileDamagePerAcceptedBeat(weapon) / weapon.cooldown;
      const nominalDps = meleeDps + hybridDps;
      expect(nominalDps, `${id}/lower-band`).toBeGreaterThanOrEqual(18);
      expect(nominalDps, `${id}/upper-band`).toBeLessThanOrEqual(22);
      expect(nominalDps, `${id}/baseline`).toBeCloseTo(20, 8);
    }
  });

  it("routes three bespoke elemental source cues and animates the single frames by spin, flip, and pulse", () => {
    const audioSource = readFileSync(
      new URL("../packages/client/src/audio/AudioBus.ts", import.meta.url),
      "utf8",
    );
    const runtimeSource = readFileSync(
      new URL(
        "../packages/client/src/vfx/generated-image-weapon-vfx.ts",
        import.meta.url,
      ),
      "utf8",
    );
    for (const recipe of Object.values(FAN_TORNADO_WEAPON_VFX_RECIPES))
      expect(audioSource, recipe.audioCue).toContain(`case "${recipe.audioCue}"`);
    expect(runtimeSource).toContain(".setRotation(progress * recipe.spinTurns");
    expect(runtimeSource).toContain(".setFlipX(");
    expect(runtimeSource).toContain(".setFlipY(");
    expect(runtimeSource).toContain("recipe.scalePulse");
  });
});
