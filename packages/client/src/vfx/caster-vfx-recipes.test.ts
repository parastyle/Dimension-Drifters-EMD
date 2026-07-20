import { WEAPONS } from "@dd/shared";
import { describe, expect, it } from "vitest";
import {
  CASTER_VFX_ELEMENTS,
  CASTER_VFX_SIGNATURES,
  type CasterVfxRecipe,
  resolveCasterVfxRecipe,
} from "./caster-vfx-recipes.js";
import { PARTICLE_PACKS } from "./particle-manifest.js";

const CASTERS = Object.values(WEAPONS).filter((weapon) => weapon.tags.classPool === "caster");

describe("caster VFX recipe resolver", () => {
  it("resolves every one of the 99 caster ids to a complete non-default recipe", () => {
    expect(CASTERS).toHaveLength(99);
    const resolved = CASTERS.map((weapon) => [weapon, resolveCasterVfxRecipe(weapon)] as const);
    const missing = resolved.filter(([, recipe]) => !recipe).map(([weapon]) => weapon.id);
    expect(missing).toEqual([]);

    for (const [weapon, maybeRecipe] of resolved) {
      const recipe = maybeRecipe as CasterVfxRecipe;
      expect(recipe.kind, weapon.id).toBe("caster-vfx");
      expect(recipe.isDefault, weapon.id).toBe(false);
      expect(recipe.key, weapon.id).not.toBe("default");
      expect(recipe.key, weapon.id).toContain(weapon.tags.element);
      expect(recipe.weaponId, weapon.id).toBe(weapon.id);
      expect(recipe.source.radius, weapon.id).toBeGreaterThan(0);
      expect(recipe.source.particles, weapon.id).toBeGreaterThan(0);
      expect(recipe.projectile.coreRadius, weapon.id).toBeGreaterThan(0);
      expect(recipe.projectile.trailLength, weapon.id).toBeGreaterThan(0);
      expect(recipe.impact.radius, weapon.id).toBeGreaterThan(0);
      expect(recipe.impact.particles, weapon.id).toBeGreaterThan(0);
    }
  });

  it("covers every caster element and each required family silhouette", () => {
    const recipes = CASTERS.map((weapon) => resolveCasterVfxRecipe(weapon) as CasterVfxRecipe);
    expect(new Set(recipes.map((recipe) => recipe.element))).toEqual(new Set(CASTER_VFX_ELEMENTS));
    expect(new Set(recipes.map((recipe) => recipe.form))).toEqual(
      new Set(["staff", "tome", "codex", "lance", "orb", "focus", "relic", "gauntlet"]),
    );
  });

  it("only uses checked-in painted element-shape packs", () => {
    for (const weapon of CASTERS) {
      const recipe = resolveCasterVfxRecipe(weapon) as CasterVfxRecipe;
      for (const shape of [
        recipe.source.particleShape,
        recipe.projectile.particleShape,
        recipe.impact.particleShape,
      ]) {
        expect(PARTICLE_PACKS[`${recipe.element}-${shape}`], `${weapon.id}:${shape}`).toBeDefined();
      }
    }
  });

  it("keeps the six prominent signature passes explicit and recipe-driven", () => {
    expect(CASTER_VFX_SIGNATURES).toEqual({
      "x-staff-arcane-lance": "arcane-lance-line",
      "x2-codex-of-forked-tongues": "forked-page-flutter",
      "x2-null-grimoire-of-the-hollow-page": "hollow-page-aperture",
      "x2-sunmote-reliquary-staff": "sunmote-corona",
      "x2-mesa-spine-thunder-stave": "mesa-lightning-crown",
      "x2-obsidian-maw-void-staff": "obsidian-maw",
    });
    for (const [id, signature] of Object.entries(CASTER_VFX_SIGNATURES)) {
      expect(resolveCasterVfxRecipe(WEAPONS[id])?.signature, id).toBe(signature);
    }
  });

  it("does not claim non-caster weapons", () => {
    expect(resolveCasterVfxRecipe(WEAPONS.driftblade)).toBeUndefined();
    expect(resolveCasterVfxRecipe(undefined)).toBeUndefined();
  });
});
