import { describe, expect, it } from "vitest";
import {
  FAN_HYBRID_VFX_RECIPES,
  resolveFanHybridVfxRecipe,
} from "./fan-hybrid-vfx-recipes.js";

describe("B3 fan hybrid VFX recipes", () => {
  it("owns three distinct projectile, impact, palette, and signature combinations", () => {
    const recipes = Object.values(FAN_HYBRID_VFX_RECIPES);
    expect(recipes).toHaveLength(3);
    expect(new Set(recipes.map((recipe) => recipe.projectile)).size).toBe(3);
    expect(new Set(recipes.map((recipe) => recipe.impact)).size).toBe(3);
    expect(new Set(recipes.map((recipe) => recipe.signature)).size).toBe(3);
    expect(
      new Set(recipes.map((recipe) => `${recipe.primaryColor}:${recipe.accentColor}`)).size,
    ).toBe(3);
  });

  it("does not claim non-fan weapons", () => {
    expect(resolveFanHybridVfxRecipe("x2-iron-war-fan")?.projectile).toBe("iron-gust");
    expect(resolveFanHybridVfxRecipe("x2-fish-launcher")).toBeUndefined();
  });
});
