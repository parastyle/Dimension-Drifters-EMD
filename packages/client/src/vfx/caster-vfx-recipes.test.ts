import { WEAPONS } from "@dd/shared";
import { describe, expect, it } from "vitest";
import {
  BEAM_VFX_RECIPES,
  CASTER_VFX_ELEMENTS,
  CASTER_VFX_SIGNATURES,
  type CasterVfxRecipe,
  resolveCasterVfxRecipe,
} from "./caster-vfx-recipes.js";
import { PARTICLE_PACKS } from "./particle-manifest.js";

const CASTERS = Object.values(WEAPONS).filter((weapon) => weapon.tags.classPool === "caster");
const BEAMS = Object.values(WEAPONS).filter((weapon) => weapon.beam);

describe("caster VFX recipe resolver", () => {
  it("resolves every one of the 97 caster ids to a complete non-default recipe", () => {
    expect(CASTERS).toHaveLength(97);
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

  it("resolves every beam weapon id to a distinct authored recipe signature", () => {
    expect(BEAMS).toHaveLength(21);
    expect(Object.keys(BEAM_VFX_RECIPES).sort()).toEqual(BEAMS.map((weapon) => weapon.id).sort());
    const signatures = new Set<string>();
    const visualSignatures = new Set<string>();
    for (const weapon of BEAMS) {
      const recipe = resolveCasterVfxRecipe(weapon);
      expect(recipe, weapon.id).toBeDefined();
      expect(recipe?.beam, weapon.id).toBeDefined();
      expect(recipe?.key, weapon.id).toContain(`:beam:${recipe?.beam?.signature}`);
      expect(signatures.has(recipe?.beam?.signature ?? ""), weapon.id).toBe(false);
      signatures.add(recipe?.beam?.signature ?? "");
      const visualSignature = JSON.stringify([
        recipe?.beam?.widthProfile,
        recipe?.beam?.edgeColor,
        recipe?.beam?.accentColor,
        recipe?.beam?.coreColor,
        recipe?.beam?.edgeWidth,
        recipe?.beam?.chromaWidth,
        recipe?.beam?.coreWidth,
        recipe?.beam?.ripple,
        recipe?.beam?.rippleAmplitude,
        recipe?.beam?.flickerHz,
        recipe?.beam?.particleElement,
        recipe?.beam?.bodyParticle,
        recipe?.beam?.coreParticle,
        recipe?.beam?.bodyFrame,
        recipe?.beam?.coreFrame,
        recipe?.beam?.impact,
      ]);
      expect(visualSignatures.has(visualSignature), weapon.id).toBe(false);
      visualSignatures.add(visualSignature);
      expect(recipe?.beam?.edgeWidth, weapon.id).toBeLessThanOrEqual(1);
      expect(recipe?.beam?.chromaWidth, weapon.id).toBeLessThanOrEqual(1);
      expect(recipe?.beam?.coreWidth, weapon.id).toBeLessThanOrEqual(1);
      expect(
        PARTICLE_PACKS[`${recipe?.beam?.particleElement}-${recipe?.beam?.bodyParticle}`],
        `${weapon.id}:body`,
      ).toBeDefined();
      expect(
        PARTICLE_PACKS[`${recipe?.beam?.particleElement}-${recipe?.beam?.coreParticle}`],
        `${weapon.id}:core`,
      ).toBeDefined();
    }
    expect(signatures.size).toBe(BEAMS.length);
    expect(visualSignatures.size).toBe(BEAMS.length);
  });
});
