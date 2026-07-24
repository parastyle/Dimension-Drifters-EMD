import { existsSync, readFileSync } from "node:fs";
import {
  comboRibbonFanOutScaleAt,
  comboRibbonWidthMultiplierAt,
  FAN_TORNADO_PROJECTILE_HALF_LENGTH,
  FAN_TORNADO_PROJECTILE_HEIGHT,
  FAN_TORNADO_PROJECTILE_RADIUS,
  FAN_TORNADO_PROJECTILE_WIDTH,
  hybridProjectileDamagePerAcceptedBeat,
  meleeComboSelectionFor,
  projectileDamageEnvelopeFor,
  WEAPONS,
} from "@dd/shared";
import { describe, expect, it } from "vitest";
import { SPRITES } from "../packages/client/src/sprites/manifest.js";
import {
  FAN_TORNADO_WEAPON_VFX_IDS,
  FAN_TORNADO_WEAPON_VFX_RECIPES,
  fanTornadoProjectileGeometryFor,
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
    audioCue: "b18:iron-gale-whoosh",
  },
  "x2-ember-fan": {
    subject: "vfx-tornado-ember-fire",
    dimensions: [468, 768],
    element: "fire",
    audioCue: "b18:ember-fire-roar",
  },
  "x2-storm-fan": {
    subject: "vfx-tornado-storm-shock",
    dimensions: [901, 1444],
    element: "shock",
    audioCue: "b18:storm-thunder-crack",
  },
} as const;

function requiredWeapon(id: (typeof FAN_TORNADO_WEAPON_VFX_IDS)[number]) {
  const weapon = WEAPONS[id];
  if (!weapon) throw new Error(`Missing B22 fan ${id}`);
  return weapon;
}

function pngDimensions(path: string): readonly [number, number] {
  const bytes = readFileSync(path);
  expect(bytes.subarray(1, 4).toString("ascii"), path).toBe("PNG");
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)] as const;
}

describe("B22 fan tornado corrections", () => {
  it("catalogs one distinct generated tornado per fan as the complete visual replacement", () => {
    expect(FAN_TORNADO_WEAPON_VFX_IDS).toEqual(["x2-iron-war-fan", "x2-ember-fan", "x2-storm-fan"]);
    expect(Object.keys(FAN_TORNADO_WEAPON_VFX_RECIPES)).toEqual(FAN_TORNADO_WEAPON_VFX_IDS);
    expect(
      new Set(Object.values(FAN_TORNADO_WEAPON_VFX_RECIPES).map((recipe) => recipe.subject)).size,
    ).toBe(3);

    for (const id of FAN_TORNADO_WEAPON_VFX_IDS) {
      const expected = EXPECTED[id];
      const weapon = requiredWeapon(id);
      const recipe = FAN_TORNADO_WEAPON_VFX_RECIPES[id];
      expect(resolveGeneratedImageWeaponVfxRecipe(id), id).toEqual(recipe);
      expect(WEAPON_VFX[id], id).toMatchObject({
        suite: {},
        suppressFallback: true,
        generatedImage: {
          kind: "fan-tornado",
          subject: expected.subject,
          audioCue: expected.audioCue,
          lifeMs: 500,
          poolSize: 1,
          scalePulse: 0.06,
        },
      });
      expect(weapon.suppressVfx, id).toBe(true);
      expect(generatedImageVfxReplacesProceduralRecipe(id), id).toBe(true);
      expect(weaponVfxSuiteFor(id, weapon.tags.element, "orbit"), id).toMatchObject({
        suite: {},
        authored: true,
      });
    }
  });

  it("publishes the three direct-loaded tornado assets with exact native PNG dimensions", () => {
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
      expect(FAN_TORNADO_WEAPON_VFX_RECIPES[id].url, id).toBe(`sprites/${subject}/part-1.png`);
    }
  });

  it("keeps generated weapon VFX direct-loaded and outside the boot atlas", () => {
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
    expect(checkerSource).toContain("!sprite.expansion && !sprite.directLoadedWeaponVfx");
  });

  it("retains B18's fan-out weapon motion while suppressing its ribbon rendering", () => {
    for (const id of FAN_TORNADO_WEAPON_VFX_IDS) {
      const selection = meleeComboSelectionFor(requiredWeapon(id));
      expect(selection?.sequence, id).toHaveLength(3);
      for (const [stepIndex, step] of (selection?.sequence ?? []).entries()) {
        expect(
          id === "x2-storm-fan" ? step.path.kind === "dual-sweep" : step.path.kind === "fan",
          `${id}/step-${stepIndex}/path`,
        ).toBe(true);
        const ribbon = step.ribbon;
        expect(ribbon, `${id}/step-${stepIndex}/fan-out-motion`).toBeDefined();
        if (!ribbon) continue;
        const foldedScale = comboRibbonFanOutScaleAt(ribbon, 0);
        const openScale = comboRibbonFanOutScaleAt(ribbon, 1);
        const foldedWidth = comboRibbonWidthMultiplierAt(ribbon, 0);
        const openWidth = comboRibbonWidthMultiplierAt(ribbon, 1);
        expect(foldedScale, `${id}/step-${stepIndex}/folded`).toBeLessThan(0.3);
        expect(openScale, `${id}/step-${stepIndex}/open`).toBeGreaterThan(1);
        expect(openWidth / foldedWidth, `${id}/step-${stepIndex}/spread`).toBeGreaterThan(4);
      }
    }
  });

  it("uses one player-height upright moving envelope for visible art and server damage", () => {
    expect(FAN_TORNADO_PROJECTILE_WIDTH).toBe(48);
    expect(FAN_TORNADO_PROJECTILE_HEIGHT).toBe(76);
    expect(FAN_TORNADO_PROJECTILE_RADIUS).toBe(24);
    expect(FAN_TORNADO_PROJECTILE_HALF_LENGTH).toBe(14);

    for (const id of FAN_TORNADO_WEAPON_VFX_IDS) {
      const weapon = requiredWeapon(id);
      const hybrid = weapon.hybridProjectile;
      expect(hybrid, id).toMatchObject({
        style: "tornado",
        trigger: "each-swing",
        speed: 520,
        range: 260,
        damage: 4,
        count: 1,
        spread: 0,
        pierce: 1,
      });
      expect(hybrid?.returnAfterSeconds, id).toBeUndefined();
      expect(projectileDamageEnvelopeFor(weapon, "hybrid"), id).toEqual({
        shape: "capsule",
        radius: 24,
        halfLength: 14,
        orientation: "upright",
      });
      expect(fanTornadoProjectileGeometryFor(weapon), id).toEqual({
        displayWidth: 48,
        displayHeight: 76,
        damageWidth: 48,
        damageHeight: 76,
        orientation: "upright",
      });
      expect((hybrid?.range ?? 0) / (hybrid?.speed ?? 1), `${id}/travel-seconds`).toBe(
        FAN_TORNADO_WEAPON_VFX_RECIPES[id].lifeMs / 1000,
      );
    }
  });

  it("keeps every corrected fan at the shipped 20 DPS baseline", () => {
    for (const id of FAN_TORNADO_WEAPON_VFX_IDS) {
      const weapon = requiredWeapon(id);
      const meleeDps = weapon.damage / weapon.cooldown;
      const tornadoDps = hybridProjectileDamagePerAcceptedBeat(weapon) / weapon.cooldown;
      const nominalDps = meleeDps + tornadoDps;
      expect(meleeDps, `${id}/melee`).toBeCloseTo(15, 8);
      expect(tornadoDps, `${id}/tornado`).toBeCloseTo(5, 8);
      expect(nominalDps, `${id}/lower-band`).toBeGreaterThanOrEqual(18);
      expect(nominalDps, `${id}/upper-band`).toBeLessThanOrEqual(22);
      expect(nominalDps, `${id}/baseline`).toBeCloseTo(20, 8);
    }
  });

  it("renders the server row upright with a growth-only pulse and no spin, flip loop, or impact layer", () => {
    const audioSource = readFileSync(
      new URL("../packages/client/src/audio/AudioBus.ts", import.meta.url),
      "utf8",
    );
    const runtimeSource = readFileSync(
      new URL("../packages/client/src/vfx/generated-image-weapon-vfx.ts", import.meta.url),
      "utf8",
    );
    const arenaSource = readFileSync(
      new URL("../packages/client/src/scenes/ArenaScene.ts", import.meta.url),
      "utf8",
    );
    for (const recipe of Object.values(FAN_TORNADO_WEAPON_VFX_RECIPES))
      expect(audioSource, recipe.audioCue).toContain(`case "${recipe.audioCue}"`);
    expect(runtimeSource).toContain(
      ".setName(`generated-image-vfx:" + "${" + "weaponId}" + ":fan-tornado-projectile`)",
    );
    expect(runtimeSource).toContain(".setRotation(0)");
    expect(runtimeSource).toContain(".setFlipX(flipX)");
    expect(runtimeSource).toContain(".setFlipY(false)");
    expect(runtimeSource).toContain('damageMode: "server-projectile"');
    expect(runtimeSource).toContain('if (weapon && recipe?.kind === "fan-tornado") return true;');
    expect(runtimeSource).not.toContain("spinTurns");
    expect(runtimeSource).not.toContain("fanTornadoReleasePlanFor");
    expect(arenaSource).toContain(
      "1 + (0.5 - Math.cos(pulseSeconds * Math.PI * 4) * 0.5) * pulseAmount",
    );
    expect(arenaSource).not.toContain("fanHybridPayload");
    expect(existsSync("packages/client/src/vfx/fan-hybrid-vfx.ts")).toBe(false);
    expect(existsSync("packages/client/src/vfx/fan-hybrid-vfx-recipes.ts")).toBe(false);
  });
});
