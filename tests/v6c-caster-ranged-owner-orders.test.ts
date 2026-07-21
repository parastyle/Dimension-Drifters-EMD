import { existsSync } from "node:fs";
import { FRIENDLY_PROJECTILE_ENTITY_CAP, WEAPONS, type WeaponDef } from "@dd/shared";
import { describe, expect, it } from "vitest";
import {
  createWeaponPerformanceInput,
  createWeaponPerformanceSample,
  sampleWeaponPerformance,
} from "../packages/client/src/sprites/pose-language.js";
import {
  BEAM_VFX_RECIPES,
  CASTER_TEXTURE_PROJECTILES,
  CASTER_VFX_PALETTE_OVERRIDES,
} from "../packages/client/src/vfx/caster-vfx-recipes.js";
import { GUN_GENERATED_PROJECTILES } from "../packages/client/src/vfx/gun-projectile-art.js";
import { resolveProjectileExplosionVfxRecipe } from "../packages/client/src/vfx/projectile-explosion-vfx-recipes.js";
import { resolveQuakeVfxRecipe } from "../packages/client/src/vfx/quake-vfx-recipes.js";

function weapon(id: string): WeaponDef {
  const definition = WEAPONS[id];
  if (!definition) throw new Error(`Missing V6C weapon: ${id}`);
  return definition;
}

function jabSample(definition: WeaponDef, phase: "anticipation" | "active") {
  if (!definition.performance) throw new Error(`Missing V6C performance: ${definition.id}`);
  const input = createWeaponPerformanceInput();
  Object.assign(input, {
    spec: definition.performance,
    aimLocal: 0,
    phase,
    phaseT: 1,
  });
  return { ...sampleWeaponPerformance(input, createWeaponPerformanceSample()) };
}

describe("V6C caster/ranged owner orders", () => {
  it("extends Hexbloom travel without changing payload or cadence", () => {
    const definition = weapon("x2-hexbloom-scattergrimoire");
    expect(definition.scatter).toMatchObject({
      count: 6,
      range: 420,
      damage: 5,
      explode: { radius: 56, damage: 6 },
    });
    expect(((definition.scatter?.damage ?? 0) + (definition.scatter?.explode?.damage ?? 0)) /
      definition.cooldown).toBeCloseTo(11 / 0.48, 8);
  });

  it("renders Null as a black beam inside a purple outline", () => {
    const recipe = BEAM_VFX_RECIPES["x2-null-grimoire-of-the-hollow-page"];
    if (!recipe) throw new Error("Null beam recipe is required");
    expect(recipe).toMatchObject({
      edgeColor: 0xb14bff,
      accentColor: 0x6d1fd1,
      coreColor: 0x030106,
      edgeWidth: 1,
      chromaWidth: 0.68,
      coreWidth: 0.48,
    });
    expect(recipe.coreWidth).toBeLessThan(recipe.chromaWidth);
    expect(recipe.chromaWidth).toBeLessThan(recipe.edgeWidth);
  });

  it("fires a capped medium-range fan of the existing holy-feather art from Glyphward", () => {
    const definition = weapon("x2-glyphward-manuscript");
    const feather = CASTER_TEXTURE_PROJECTILES[definition.id];
    expect(definition.chainLightning).toBeUndefined();
    expect(definition.scatter).toMatchObject({
      count: 10,
      spread: 0.56,
      speed: 720,
      range: 420,
      damage: 1.5435,
    });
    expect((definition.scatter?.count ?? 0) * (definition.scatter?.damage ?? 0)).toBeCloseTo(
      6 * (1 + 0.85 + 0.85 ** 2),
      8,
    );
    expect(definition.scatter?.count).toBeLessThan(FRIENDLY_PROJECTILE_ENTITY_CAP);
    expect(feather).toMatchObject({
      url: "vfx/packs/holy-smite/fx-holy-smite-07.png",
      displayLength: 64,
      mirrorLeft: true,
    });
    expect(existsSync(`packages/client/public/${feather?.url}`)).toBe(true);
  });

  it("keeps Cyclone's quake language while applying the purple color pass", () => {
    const definition = weapon("x2-dust-devil-cyclone-orb");
    const recipe = resolveQuakeVfxRecipe(definition);
    expect(definition.tags.element).toBe("shock");
    expect(recipe).toMatchObject({
      variant: "double-ripple",
      pack: "lightning-ball",
      element: "shock",
      visualElement: "arcane",
      packTint: 0xb14bff,
    });
  });

  it("makes Fulgurite's chain/source VFX blue without changing shock gameplay", () => {
    const definition = weapon("x2-fulgurite-storm-sphere");
    expect(definition.tags.element).toBe("shock");
    expect(definition.chainLightning?.vfx).toEqual({ color: 0.6, jag: 0.3, life: 180 });
    expect(CASTER_VFX_PALETTE_OVERRIDES[definition.id]).toEqual({
      core: 0xe8fbff,
      mid: 0x3f9dff,
      shadow: 0x173f91,
    });
  });

  it("compresses Stormfists travel and immunity into exactly 50ms while keeping DPS intact", () => {
    const definition = weapon("x2-thunderhead-stormfists");
    expect(definition.performance?.lunge).toEqual({
      distancePx: 480,
      durationSeconds: 0.05,
      invulnerable: true,
    });
    expect((definition.damage + (definition.quake?.damage ?? 0)) / definition.cooldown).toBe(17.5);
  });

  it("makes Hexbolt projectiles purple without changing their payload", () => {
    const gun = weapon("x2-hexbolt-spitter-mitt").gun;
    expect(gun).toMatchObject({
      damage: 5,
      fireRate: 0.18,
      projectileColor: 0xb14bff,
    });
    expect((gun?.damage ?? 0) / (gun?.fireRate ?? 1)).toBeCloseTo(5 / 0.18, 8);
  });

  it("uses authored two-hand jab poses for Hexpost and Thunderpost", () => {
    for (const id of ["x2-hexpost-charm-pole", "x2-thunderpost-fetish"]) {
      const definition = weapon(id);
      expect(definition.performance).toMatchObject({
        hold: "aim-forward",
        action: "jab",
        suppressSwing: true,
      });
      const chamber = jabSample(definition, "anticipation");
      const strike = jabSample(definition, "active");
      expect(strike.weaponAngle, id).toBe(0);
      expect(strike.handX, id).toBeGreaterThan(chamber.handX);
      expect(strike.backHandX, id).toBeLessThan(strike.handX);
      expect(strike.backHandBlend, id).toBe(1);
    }
  });

  it("scales Ghostbolt's existing generated arrow to exactly three times its prior size", () => {
    const definition = weapon("x2-ghostbolt-crossbow");
    const art = GUN_GENERATED_PROJECTILES[definition.id];
    expect(definition.gun?.projectileVisualScale).toBe(3);
    expect(art?.displayLength).toBe(72);
    expect((art?.displayLength ?? 0) * (definition.gun?.projectileVisualScale ?? 1)).toBe(216);
  });

  it("gives Brimstone a larger circle-free organic blast without adding damage", () => {
    const definition = weapon("x2-brimstone-rocket-tube");
    expect(definition.gun).toMatchObject({
      damage: 14,
      fireRate: 0.85,
      explode: { radius: 220, damage: 13 },
    });
    expect(resolveProjectileExplosionVfxRecipe(definition.id)).toMatchObject({
      element: "fire",
      pack: "ember-eruption",
      silhouette: "organic-eruption",
      paintedHalo: false,
      footprintCount: 4,
    });
  });

  it("doubles only Calamity's server knockback channel", () => {
    const gun = weapon("x2-calamity-howitzer").gun;
    expect(gun).toMatchObject({
      damage: 22,
      fireRate: 2.2,
      recoil: 0.004,
      userKnockbackMultiplier: 2,
      explode: { radius: 150, damage: 32 },
    });
  });

  it("turns Tidehook's enlarged radius into a frost-typed ice bloom", () => {
    const definition = weapon("x2-tidehook-bombarpoon");
    expect(definition.tags.element).toBe("frost");
    expect(definition.gun?.explode).toEqual({ radius: 220, damage: 10 });
    expect(resolveProjectileExplosionVfxRecipe(definition.id)).toMatchObject({
      element: "frost",
      pack: "frost-nova",
      silhouette: "ice-bloom",
      shardCountMultiplier: 1.8,
    });
  });
});
