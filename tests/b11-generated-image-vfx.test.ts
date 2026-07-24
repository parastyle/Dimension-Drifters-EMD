import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import {
  ARCANIST_LANCE_PROJECTILE_HALF_LENGTH,
  ARCANIST_LANCE_PROJECTILE_RADIUS,
  DUSTREAPER_FIRE_DRAGON_HALF_WIDTH,
  DUSTREAPER_FIRE_DRAGON_REACH,
  hitEnvelopeExtentsAgree,
  MESA_HEART_CRYSTAL_FRAGMENT_RADIUS,
  meleeDamageEnvelopeFor,
  projectileDamageEnvelopeFor,
  WEAPONS,
} from "@dd/shared";
import { describe, expect, it } from "vitest";
import { resolveCasterVfxRecipe } from "../packages/client/src/vfx/caster-vfx-recipes.js";
import {
  GENERATED_IMAGE_WEAPON_VFX_IDS,
  GENERATED_IMAGE_WEAPON_VFX_RECIPES,
  generatedImageMeleeGeometryFor,
  generatedImageProjectileGeometryFor,
  resolveGeneratedImageWeaponVfxRecipe,
} from "../packages/client/src/vfx/generated-image-weapon-vfx-recipes.js";
import { resolveWeaponEffectRecipe } from "../packages/client/src/vfx/weapon-effect-recipes.js";
import { WEAPON_VFX } from "../packages/client/src/vfx/weapon-vfx.generated.js";
import { weaponVfxSuiteFor } from "../packages/client/src/vfx/weapon-vfx-suite.js";

const require = createRequire(import.meta.url);
const { PNG } = require("../tools/artkit/node_modules/pngjs") as {
  PNG: {
    sync: {
      read(bytes: Buffer): { width: number; height: number; data: Buffer };
    };
  };
};

interface AlphaCensus {
  readonly width: number;
  readonly height: number;
  readonly visibleFraction: number;
  readonly alphaBounds: Readonly<{ minX: number; minY: number; maxX: number; maxY: number }>;
  readonly rowsWithFourRuns: number;
}

function alphaCensus(path: string): AlphaCensus {
  const png = PNG.sync.read(readFileSync(path));
  let visible = 0;
  let minX = png.width;
  let minY = png.height;
  let maxX = -1;
  let maxY = -1;
  let rowsWithFourRuns = 0;
  for (let y = 0; y < png.height; y++) {
    let runs = 0;
    let inside = false;
    for (let x = 0; x < png.width; x++) {
      const alpha = png.data[(y * png.width + x) * 4 + 3] ?? 0;
      const opaque = alpha > 16;
      if (opaque) {
        visible++;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
      if (opaque && !inside) runs++;
      inside = opaque;
    }
    if (runs >= 4) rowsWithFourRuns++;
  }
  return {
    width: png.width,
    height: png.height,
    visibleFraction: visible / (png.width * png.height),
    alphaBounds: Object.freeze({ minX, minY, maxX, maxY }),
    rowsWithFourRuns,
  };
}

function weapon(id: string) {
  const definition = WEAPONS[id];
  if (!definition) throw new Error(`Missing B11 fixture: ${id}`);
  return definition;
}

describe("B11 generated-image weapon VFX", () => {
  it("catalogs exactly three distinct authoritative subjects", () => {
    expect(GENERATED_IMAGE_WEAPON_VFX_IDS).toEqual([
      "x2-dustreaper-zweihander",
      "x2-mesa-heart-geodes",
      "x-staff-arcane-lance",
    ]);
    expect(Object.keys(GENERATED_IMAGE_WEAPON_VFX_RECIPES)).toEqual(GENERATED_IMAGE_WEAPON_VFX_IDS);
    expect(
      new Set(Object.values(GENERATED_IMAGE_WEAPON_VFX_RECIPES).map((row) => row.subject)),
    ).toEqual(new Set(["vfx-fire-dragon", "vfx-purple-crystal-family", "vfx-arcanist-lance"]));
    expect(
      new Set(Object.values(GENERATED_IMAGE_WEAPON_VFX_RECIPES).map((row) => row.signature)).size,
    ).toBe(3);
    expect(
      new Set(Object.values(GENERATED_IMAGE_WEAPON_VFX_RECIPES).map((row) => row.kind)),
    ).toEqual(new Set(["fire-dragon-sweep", "purple-crystal-burst", "arcane-lance-projectile"]));
  });

  it("suppresses every generic suite and displaced procedural recipe", () => {
    for (const id of GENERATED_IMAGE_WEAPON_VFX_IDS) {
      const definition = weapon(id);
      const generated = WEAPON_VFX[id];
      expect(resolveGeneratedImageWeaponVfxRecipe(id), id).toMatchObject(
        generated?.generatedImage ?? {},
      );
      expect(generated?.suite, id).toEqual({});
      expect(generated?.suppressFallback, id).toBe(true);
      expect(
        weaponVfxSuiteFor(id, definition.tags.element, "arc"),
        `${id}/generic-suite`,
      ).toMatchObject({ authored: true, suite: {} });
    }
    expect(resolveWeaponEffectRecipe(weapon("x2-dustreaper-zweihander"))).toBeUndefined();
    expect(resolveCasterVfxRecipe(weapon("x2-mesa-heart-geodes"))).toBeUndefined();
    expect(resolveCasterVfxRecipe(weapon("x-staff-arcane-lance"))).toBeUndefined();
  });

  it("sizes the dragon sweep and crystal family from the shared melee envelope", () => {
    const dustreaper = weapon("x2-dustreaper-zweihander");
    const dragon = generatedImageMeleeGeometryFor(dustreaper);
    const dragonEnvelope = meleeDamageEnvelopeFor(dustreaper);
    expect(dragon).toEqual({
      forwardExtent: DUSTREAPER_FIRE_DRAGON_REACH,
      halfWidth: DUSTREAPER_FIRE_DRAGON_HALF_WIDTH,
    });
    expect(dragonEnvelope.baseReach).toBeLessThan(DUSTREAPER_FIRE_DRAGON_REACH);
    expect(hitEnvelopeExtentsAgree(dragon?.forwardExtent ?? 0, dragonEnvelope.maxReach)).toBe(true);
    expect(hitEnvelopeExtentsAgree(dragon?.halfWidth ?? 0, dragonEnvelope.maxHalfWidth)).toBe(true);

    const mesa = weapon("x2-mesa-heart-geodes");
    const crystals = generatedImageMeleeGeometryFor(mesa);
    const crystalEnvelope = meleeDamageEnvelopeFor(mesa);
    expect(crystals).toEqual({
      forwardExtent: 360,
      halfWidth: MESA_HEART_CRYSTAL_FRAGMENT_RADIUS,
    });
    expect(crystalEnvelope.maxHalfWidth).toBe(MESA_HEART_CRYSTAL_FRAGMENT_RADIUS);
  });

  it("matches the lance's visible tip and thickness to its authoritative cast capsule", () => {
    const lance = weapon("x-staff-arcane-lance");
    const projectile = projectileDamageEnvelopeFor(lance, "cast");
    const visual = generatedImageProjectileGeometryFor(lance);
    expect(projectile).toEqual({
      shape: "capsule",
      radius: ARCANIST_LANCE_PROJECTILE_RADIUS,
      halfLength: ARCANIST_LANCE_PROJECTILE_HALF_LENGTH,
    });
    expect(visual).toEqual({
      displayWidth: (ARCANIST_LANCE_PROJECTILE_HALF_LENGTH + ARCANIST_LANCE_PROJECTILE_RADIUS) * 2,
      displayHeight: ARCANIST_LANCE_PROJECTILE_RADIUS * 2,
      tipExtent: ARCANIST_LANCE_PROJECTILE_HALF_LENGTH + ARCANIST_LANCE_PROJECTILE_RADIUS,
    });
    expect(hitEnvelopeExtentsAgree((visual?.displayHeight ?? 0) / 2, projectile.radius)).toBe(true);
    expect(
      hitEnvelopeExtentsAgree(visual?.tipExtent ?? 0, projectile.halfLength + projectile.radius),
    ).toBe(true);
  });

  it("ships readable alpha-bearing subjects, including a non-circular shard family", () => {
    const dragon = alphaCensus("packages/client/public/sprites/vfx-fire-dragon/part-1.png");
    expect(dragon).toMatchObject({ width: 768, height: 276 });
    expect(dragon.visibleFraction).toBeGreaterThan(0.38);
    expect(dragon.alphaBounds.maxX).toBeGreaterThanOrEqual(766);

    const crystals = alphaCensus(
      "packages/client/public/sprites/vfx-purple-crystal-family/part-1.png",
    );
    expect(crystals).toMatchObject({ width: 361, height: 384 });
    expect(crystals.visibleFraction).toBeGreaterThan(0.34);
    expect(crystals.rowsWithFourRuns).toBeGreaterThan(80);

    const lance = alphaCensus("packages/client/public/sprites/vfx-arcanist-lance/part-1.png");
    expect(lance).toMatchObject({ width: 1370, height: 334 });
    expect(lance.visibleFraction).toBeGreaterThan(0.3);
    expect(lance.alphaBounds.maxX).toBeGreaterThanOrEqual(1368);
  });

  it("preserves damage, cadence, range, and Arcanist projectile count", () => {
    expect(weapon("x2-dustreaper-zweihander")).toMatchObject({
      damage: 13,
      range: 218,
      cooldown: 0.78,
    });
    expect(weapon("x2-mesa-heart-geodes")).toMatchObject({
      damage: 6,
      range: 360,
      cooldown: 0.32,
      chainLightning: { jumps: 3, damage: 5, falloff: 0.85 },
    });
    expect(weapon("x-staff-arcane-lance")).toMatchObject({
      damage: 5,
      range: 96,
      cooldown: 0.5,
      cast: {
        damage: 16,
        speed: 620,
        range: 720,
        cooldown: 0.62,
        volley: { count: 3, spread: 0.16 },
      },
    });
  });

  it("routes all three bespoke source cues through AudioBus", () => {
    const source = readFileSync(
      new URL("../packages/client/src/audio/AudioBus.ts", import.meta.url),
      "utf8",
    );
    for (const recipe of Object.values(GENERATED_IMAGE_WEAPON_VFX_RECIPES))
      expect(source, recipe.audioCue).toContain(`case "${recipe.audioCue}"`);
  });
});
