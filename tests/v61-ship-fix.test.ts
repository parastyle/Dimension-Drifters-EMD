import { existsSync, readFileSync } from "node:fs";
import {
  bladeExtensionGeometryFor,
  meleeDamageEnvelopeFor,
  meleeReach,
  swingDescriptorFor,
  WEAPONS,
} from "@dd/shared";
import { describe, expect, it } from "vitest";
import {
  ALL_BLADE_EXTENSION_TEXTURES,
  weaponSupportsBladeExtension,
} from "../packages/client/src/vfx/blade-extension-treatments.js";
import { resolveWeaponEffectRecipe } from "../packages/client/src/vfx/weapon-effect-recipes.js";
import { WEAPON_VFX } from "../packages/client/src/vfx/weapon-vfx.generated.js";
import {
  GENERIC_IMPACT_RING_LAYER_IDS,
  splitWeaponVfxSuite,
  weaponVfxSuiteFor,
} from "../packages/client/src/vfx/weapon-vfx-suite.js";

describe("B10 Headsman retirement", () => {
  it("retires the failed Headsman-only extension treatment and review selector", () => {
    expect(existsSync("packages/client/src/vfx/headsman-prototypes.ts")).toBe(false);
    expect(weaponSupportsBladeExtension("x2-sanctified-headsman")).toBe(false);
    expect(
      ALL_BLADE_EXTENSION_TEXTURES.some(
        (treatment) => treatment.weaponId === "x2-sanctified-headsman",
      ),
    ).toBe(false);
  });

  it("keeps only the ordinary physical blade, normal hit envelope, and normal sword animation", () => {
    const headsman = WEAPONS["x2-sanctified-headsman"];
    expect(headsman).toBeDefined();
    if (!headsman) throw new Error("missing Sanctified Headsman fixture");
    expect(headsman).toMatchObject({
      range: 160,
      damage: 13,
      cooldown: 0.74,
      suppressVfx: true,
    });
    expect(headsman.effectRecipe).toBeUndefined();
    expect(headsman.effectEmitter).toBeUndefined();
    expect(headsman.effectTiming).toBeUndefined();
    expect(resolveWeaponEffectRecipe(headsman)).toBeUndefined();
    expect(WEAPON_VFX[headsman.id]).toBeUndefined();
    expect(bladeExtensionGeometryFor(headsman)).toBeUndefined();
    const ordinaryReach = meleeReach(headsman);
    expect(meleeDamageEnvelopeFor(headsman)).toMatchObject({
      baseReach: ordinaryReach,
      maxReach: ordinaryReach,
    });

    const player = readFileSync("packages/client/src/vfx/VfxPlayer.ts", "utf8");
    expect(player).not.toContain("headsman-proto");
    expect(player).not.toContain("resolveHeadsmanTreatment");
  });
});

describe("V6.1 generic cursor-circle regression", () => {
  it("emits no generic ring primitive and does not require a replacement impact", () => {
    for (const definition of Object.values(WEAPONS)) {
      if (definition.archived) continue;
      const swing = swingDescriptorFor(definition, definition.cooldown);
      const suite = weaponVfxSuiteFor(definition.id, definition.tags.element, swing.style).suite;
      for (const layerId of GENERIC_IMPACT_RING_LAYER_IDS)
        expect(suite[layerId]?.on, `${definition.id}:${layerId}`).not.toBe(true);
      if (suite["painted-impact"]?.on)
        expect(suite["painted-impact"]?.params.paint, definition.id).toBeTypeOf("number");
    }

    for (const [weaponId, recipe] of Object.entries(WEAPON_VFX))
      for (const layerId of GENERIC_IMPACT_RING_LAYER_IDS)
        expect(recipe.suite[layerId]?.on, `${weaponId}:${layerId}`).not.toBe(true);

    for (const id of [
      "x2-revenant-knuckle",
      "drift-colossal-world-seam",
    ]) {
      const definition = WEAPONS[id];
      if (!definition) throw new Error(`missing V6.1 fixture ${id}`);
      const swing = swingDescriptorFor(definition, definition.cooldown);
      expect(
        weaponVfxSuiteFor(id, definition.tags.element, swing.style).suite["painted-impact"],
        id,
      ).toMatchObject({ on: true });
    }

    for (const id of ["x2-voltfang-tachi", "x2-sanctified-headsman", "x2-mournveil-scythe"]) {
      const definition = WEAPONS[id];
      if (!definition) throw new Error(`missing V6.3 targetless fixture ${id}`);
      const swing = swingDescriptorFor(definition, definition.cooldown);
      const suite = weaponVfxSuiteFor(id, definition.tags.element, swing.style).suite;
      expect(Object.keys(splitWeaponVfxSuite(suite).target), id).toEqual([]);
    }
  });

  it("routes replacement impacts to Codex splat art without a rim drawing path", () => {
    expect(globalThis.VFXLAYERS.LAYERS["painted-impact"]).toMatchObject({
      trigger: "impact",
      anchor: "target",
    });
    const renderer = readFileSync("packages/client/src/vfx/vfx-render.js", "utf8");
    const replacement = renderer.slice(
      renderer.indexOf('"painted-impact": {'),
      renderer.indexOf('"hit-spark": {'),
    );
    expect(replacement).toContain("S.paintedImpact?.(o.params)");
    expect(replacement).not.toMatch(/paintBrokenRim|\.arc\(|\.ellipse\(|\.circle\(/i);
  });
});
