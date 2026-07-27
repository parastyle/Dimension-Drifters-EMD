import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  ACTIVE_WEAPON_CATALOG_IDS,
  ARCHIVED_WEAPON_IDS,
  effectivePower,
  selectChainTargets,
  swingDescriptorFor,
  WEAPON_CATALOG_IDS,
  WEAPONS,
  type WeaponDef,
} from "@dd/shared";
import { describe, expect, it } from "vitest";

import { PAGE_PROJECTILE_ART } from "../packages/client/src/vfx/page-projectile-art.js";
import { resolveWeaponEffectRecipe } from "../packages/client/src/vfx/weapon-effect-recipes.js";
import { WEAPON_VFX } from "../packages/client/src/vfx/weapon-vfx.generated.js";
import {
  buildWeaponFallbackSuite,
  weaponVfxSuiteFor,
} from "../packages/client/src/vfx/weapon-vfx-suite.js";

const MARKED_RADIAL_WEAPON_IDS = [
  "x2-thunderpost-fetish",
  "x2-thunderhoof-splittingaxe",
  "x2-reaper-s-tithe",
  "x2-hollow-harvest",
  "x2-gravechain-scythe",
  "x2-twin-whispervolumes",
] as const;

const SYNTHETIC_PER_LAYER_IDS = ["blade-trail", "twin-slash", "thrust-streak"] as const;
const B30_REMOVED_AFTER_B24_IDS = new Set([
  "x2-hailshard-resonator",
  "x2-coyote-trickster-s-sparkmitt",
  "x2-brimstone-doubleheader",
]);

function weapon(id: string): WeaponDef {
  const definition = WEAPONS[id];
  if (!definition) throw new Error(`Missing B24 weapon ${id}`);
  return definition;
}

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex").toUpperCase();
}

function wasSyntheticFallbackCandidate(definition: WeaponDef): boolean {
  const vfx = WEAPON_VFX[definition.id];
  const authored = !!(vfx?.suite && Object.keys(vfx.suite).length > 0);
  return (
    (definition.suppressVfx !== true || B30_REMOVED_AFTER_B24_IDS.has(definition.id)) &&
    !authored &&
    vfx?.suppressFallback !== true
  );
}

function formerSyntheticLayer(definition: WeaponDef): (typeof SYNTHETIC_PER_LAYER_IDS)[number] {
  const swing = swingDescriptorFor(definition, definition.cooldown);
  const dual =
    definition.tags.grip === "dual" || definition.tags.family.toLowerCase() === "paired-war-fan";
  if (dual) return "twin-slash";
  if (swing.style === "thrust") return "thrust-streak";
  return "blade-trail";
}

describe("B24 shared radial fallback removal", () => {
  it("records the complete resolver cohort after the B63/B66 catalog merge", () => {
    const candidates = Object.values(WEAPONS).filter(wasSyntheticFallbackCandidate);
    const byFormerLayer = Object.fromEntries(
      SYNTHETIC_PER_LAYER_IDS.map((layerId) => [
        layerId,
        candidates.filter((definition) => formerSyntheticLayer(definition) === layerId).length,
      ]),
    );

    // Literal membership-loss tripwires: new guns must join this behavioral cohort rather than
    // silently escaping the fallback-removal law. Authored Rimegut/Whiteout VFX stay excluded.
    expect(candidates).toHaveLength(350);
    expect(byFormerLayer).toEqual({
      "blade-trail": 312,
      "twin-slash": 27,
      "thrust-streak": 11,
    });
    expect(candidates.filter((definition) => !definition.archived)).toHaveLength(332);
    expect(candidates.filter((definition) => definition.archived)).toHaveLength(18);
    for (const id of MARKED_RADIAL_WEAPON_IDS)
      expect(
        candidates.map((definition) => definition.id),
        `${id} must be in the shared fallback cohort`,
      ).toContain(id);

    expect(
      buildWeaponFallbackSuite("shock", "slash", weapon("x2-thunderpost-fetish").tags),
    ).toEqual({});
    expect(
      buildWeaponFallbackSuite("shock", "spin", weapon("x2-twin-whispervolumes").tags),
    ).toEqual({});

    for (const definition of candidates) {
      const swing = swingDescriptorFor(definition, definition.cooldown);
      const resolved = weaponVfxSuiteFor(definition.id, definition.tags.element, swing.style).suite;
      for (const layerId of SYNTHETIC_PER_LAYER_IDS)
        expect(resolved[layerId]?.on, `${definition.id}:${layerId}`).not.toBe(true);
    }
    for (const id of MARKED_RADIAL_WEAPON_IDS) {
      const definition = weapon(id);
      const swing = swingDescriptorFor(definition, definition.cooldown);
      expect(weaponVfxSuiteFor(id, definition.tags.element, swing.style).suite, id).toEqual({});
    }
  });

  it("leaves all three marked bespoke effect recipes intact while B28 removes Thunderhead's recipe", () => {
    expect(resolveWeaponEffectRecipe(weapon("x2-hollow-harvest"))).toEqual({
      id: "hollow-harvest-circle",
      weaponId: "x2-hollow-harvest",
      emitter: "blade",
      classification: "weapon-motion",
      swingPack: "fire-splat",
      swingCount: 24,
      swingParticleDominance: 0.56,
      radialDistribution: "full-circle",
      additive: true,
    });
    expect(resolveWeaponEffectRecipe(weapon("x2-gravechain-scythe"))).toEqual({
      id: "gravechain-dominant-spin",
      weaponId: "x2-gravechain-scythe",
      emitter: "blade",
      classification: "weapon-motion",
      swingPack: "void-wisp",
      swingCount: 24,
      swingParticleDominance: 0.52,
      radialDistribution: "full-circle",
      additive: true,
    });
    expect(resolveWeaponEffectRecipe(weapon("x2-twin-whispervolumes"))).toEqual({
      id: "whispervolume-page-scatter",
      weaponId: "x2-twin-whispervolumes",
      emitter: "tip",
      classification: "chain-path",
      chain: "scattered-pages",
    });

    expect(sha256("packages/client/src/vfx/weapon-effect-recipes.ts")).toBe(
      "924011E00EB6079D49E3511E8B0A3BC3D21F15141BFCAC7137484A371FEBD692",
    );
    expect(sha256("packages/client/src/vfx/weapon-effect-vfx.ts")).toBe(
      "813C0739A4D53BAB740C934A2D0FCEEEB256970F1D20224665D64A6D58FEBD54",
    );
    expect(sha256("packages/client/public/projectiles/twin-whisper-page.png")).toBe(
      "F3457ED4128DA7A1662CFD82947DFFEF61FC1DBDC2044A7F8626C4FB58633A6E",
    );
  });

  it("removes Mournveil's on-cursor suite without altering its held swing", () => {
    const mournveil = weapon("x2-mournveil-scythe");
    expect(mournveil).toMatchObject({
      displayLength: 364,
      damage: 14,
      cooldown: 0.82,
      range: 250,
      swingStyle: "spin",
      swingArc: Math.PI * 2,
      performance: {
        continuous: true,
        twirl: { plane: "screen-circle", pivot: "shaft-midpoint", direction: "forward" },
      },
    });
    expect(WEAPON_VFX[mournveil.id]).toMatchObject({ suite: {}, suppressFallback: true });
    expect(WEAPON_VFX[mournveil.id]?.vfxOrigin).toBeUndefined();
    expect(WEAPON_VFX[mournveil.id]?.vfxRadius).toBeUndefined();
    expect(weaponVfxSuiteFor(mournveil.id, mournveil.tags.element, "spin").suite).toEqual({});
  });

  it("archives Pocket Hexicon through the canonical weapon catalogs", () => {
    expect(weapon("x2-pocket-hexicon").archived).toBe(true);
    expect(ARCHIVED_WEAPON_IDS).toContain("x2-pocket-hexicon");
    expect(ACTIVE_WEAPON_CATALOG_IDS).not.toContain("x2-pocket-hexicon");
    // The live total is catalog-derived; the literal archive count below remains the loss tripwire.
    expect(ACTIVE_WEAPON_CATALOG_IDS).toHaveLength(
      WEAPON_CATALOG_IDS.length - ARCHIVED_WEAPON_IDS.length,
    );
    expect(ARCHIVED_WEAPON_IDS).toHaveLength(20);
  });

  it("renders Spitfire Censer Wand exactly forty percent larger without stat or art edits", () => {
    const censer = weapon("x2-spitfire-censer-wand");
    expect(censer.displayLength).toBe(126);
    expect(censer.displayLength / 90).toBeCloseTo(1.4, 10);
    expect(censer).toMatchObject({
      damage: 4,
      range: 460,
      cooldown: 0.3,
      gun: {
        damage: 4,
        projectileSpeed: 820,
        range: 460,
        fireRate: 0.1,
        magazine: 30,
        reloadSeconds: 1.6,
      },
    });
  });

  it("makes Whispervolume pages 50% larger and extends both visual and authoritative reach", () => {
    const twin = weapon("x2-twin-whispervolumes");
    expect(PAGE_PROJECTILE_ART[twin.id]).toMatchObject({
      displayWidth: 45,
      displayHeight: 33,
      scaleMultiplier: 1.5,
    });
    expect(twin).toMatchObject({
      damage: 6,
      cooldown: 0.32,
      range: 220,
      chainLightning: { jumps: 3, range: 240, damage: 5, falloff: 0.8 },
    });
    expect(twin.damage / twin.cooldown).toBe(18.75);

    const baselineChain = twin.chainLightning;
    if (!baselineChain) throw new Error("Twin Whispervolumes must keep its chain metadata");
    const before = {
      ...twin,
      range: 145,
      chainLightning: { ...baselineChain, range: 180 },
    } satisfies WeaponDef;
    const powerRatio = effectivePower(twin) / effectivePower(before);
    expect(powerRatio).toBeGreaterThanOrEqual(0.9);
    expect(powerRatio).toBeLessThanOrEqual(1.1);

    const distantPageTarget = [{ id: "far-page-target", x: 230, y: 0 }];
    expect(selectChainTargets({ x: 0, y: 0 }, distantPageTarget, 1, 180)).toEqual([]);
    expect(selectChainTargets({ x: 0, y: 0 }, distantPageTarget, 1, 240)).toEqual(
      distantPageTarget,
    );
  });
});
