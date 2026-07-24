import { WEAPONS } from "@dd/shared";
import { describe, expect, it } from "vitest";
import {
  FAN_TORNADO_WEAPON_VFX_IDS,
  FAN_TORNADO_WEAPON_VFX_RECIPES,
  fanTornadoProjectileGeometryFor,
  generatedImageVfxReplacesProceduralRecipe,
} from "./generated-image-weapon-vfx-recipes.js";
import { weaponVfxSuiteFor } from "./weapon-vfx-suite.js";

describe("B22 fan tornado VFX recipes", () => {
  it("owns three distinct generated-image projectile subjects with no legacy impact recipe", () => {
    const recipes = Object.values(FAN_TORNADO_WEAPON_VFX_RECIPES);
    expect(recipes).toHaveLength(3);
    expect(new Set(recipes.map((recipe) => recipe.subject)).size).toBe(3);
    expect(new Set(recipes.map((recipe) => recipe.signature)).size).toBe(3);
    expect(new Set(recipes.map((recipe) => recipe.audioCue)).size).toBe(3);
  });

  it("claims the complete visual signature and sizes every projectile from shared 48x76 authority", () => {
    for (const id of FAN_TORNADO_WEAPON_VFX_IDS) {
      const weapon = WEAPONS[id];
      expect(weapon, id).toBeDefined();
      if (!weapon) continue;
      expect(generatedImageVfxReplacesProceduralRecipe(id), id).toBe(true);
      expect(weapon.suppressVfx, id).toBe(true);
      expect(fanTornadoProjectileGeometryFor(weapon), id).toMatchObject({
        displayWidth: 48,
        displayHeight: 76,
        damageWidth: 48,
        damageHeight: 76,
        orientation: "upright",
      });
      expect(weaponVfxSuiteFor(id, weapon.tags.element, "orbit"), id).toMatchObject({
        suite: {},
        authored: true,
      });
    }
  });
});
