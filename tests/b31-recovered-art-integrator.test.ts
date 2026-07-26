import { existsSync } from "node:fs";
import {
  ACTIVE_EXPANSION_WEAPON_IDS,
  ACTIVE_WEAPON_CATALOG_IDS,
  ARCHIVED_WEAPON_IDS,
  chargedProjectileFraction,
  chargedProjectileSnapshot,
  createMetaAccountV5,
  DROP_POOL,
  lockedPackCandidates,
  meleeComboGraceMs,
  meleeComboSelectionFor,
  WEAPON_CATALOG_IDS,
  WEAPONS,
  type WeaponDef,
} from "@dd/shared";
import { describe, expect, it } from "vitest";
import { SPRITES } from "../packages/client/src/sprites/manifest.js";
import { BEAM_VFX_RECIPES } from "../packages/client/src/vfx/caster-vfx-recipes.js";
import {
  resolveWeaponEffectRecipe,
  WEAPON_EFFECT_RECIPES,
} from "../packages/client/src/vfx/weapon-effect-recipes.js";
import { WEAPON_VFX } from "../packages/client/src/vfx/weapon-vfx.generated.js";
import { WEAPON_ART_MUZZLES } from "../packages/shared/src/weapon-muzzles.generated.js";

function weapon(id: string): WeaponDef {
  const definition = WEAPONS[id];
  if (!definition) throw new Error(`Missing B31 weapon fixture: ${id}`);
  return definition;
}

describe("B31 recovered-art integrator", () => {
  it("owns Emberleaf charge on one documented release snapshot and preserves full-cycle DPS", () => {
    const emberleaf = weapon("x2-emberleaf-chapbook");
    const charge = emberleaf.chargedProjectile;
    if (!charge) throw new Error("Emberleaf lost its charged projectile");

    expect(emberleaf.scatter).toBeUndefined();
    expect(emberleaf.tags).toMatchObject({
      delivery: "projectile",
      fireMode: "hold",
      element: "fire",
    });
    expect(charge).toEqual({
      chargeSeconds: 1.2,
      speed: 520,
      range: 420,
      directDamageMin: 3,
      directDamageMax: 18,
      explosionDamageMin: 2,
      explosionDamageMax: 22,
      explosionRadiusMin: 34,
      explosionRadiusMax: 100,
      visualScaleMin: 0.55,
      visualScaleMax: 1.5,
      scaleExponent: 2,
      baseRadius: 28,
      sprite: "sprites/vfx-emberleaf-fireball/part-1.png",
    });

    expect(chargedProjectileFraction(0, charge)).toBe(0);
    expect(chargedProjectileFraction(0.6, charge)).toBe(0.5);
    expect(chargedProjectileFraction(9, charge)).toBe(1);
    expect(chargedProjectileSnapshot(charge, 0)).toEqual({
      fraction: 0,
      directDamage: 3,
      explosionDamage: 2,
      explosionRadius: 34,
      visualScale: 0.55,
    });
    expect(chargedProjectileSnapshot(charge, 0.5)).toEqual({
      fraction: 0.5,
      directDamage: 6.75,
      explosionDamage: 7,
      explosionRadius: 50.5,
      visualScale: 1.025,
    });
    expect(chargedProjectileSnapshot(charge, 1)).toEqual({
      fraction: 1,
      directDamage: 18,
      explosionDamage: 22,
      explosionRadius: 100,
      visualScale: 1.5,
    });

    const oldScatterDps = (4 + 4) / 0.3;
    const fullChargeCycleDps =
      (charge.directDamageMax + charge.explosionDamageMax) /
      (charge.chargeSeconds + emberleaf.cooldown);
    expect(fullChargeCycleDps / oldScatterDps).toBeGreaterThanOrEqual(0.9);
    expect(fullChargeCycleDps / oldScatterDps).toBeLessThanOrEqual(1.1);
    expect(WEAPON_ART_MUZZLES[emberleaf.id]?.points).toEqual([
      expect.objectContaining({ part: 0, x: 330, y: 201 }),
    ]);
    expect(existsSync("packages/client/public/sprites/vfx-emberleaf-fireball/part-1.png")).toBe(
      true,
    );
  });

  it("renders both Wyrmscale talons and alternates four authored wide fire slashes", () => {
    const wyrmscale = weapon("x2-wyrmscale-hex-talon");
    const manifest = SPRITES[wyrmscale.id];
    const combo = meleeComboSelectionFor(wyrmscale);
    if (!manifest || !combo) throw new Error("Wyrmscale art/combo fixture missing");

    expect(wyrmscale).toMatchObject({
      damage: 11,
      cooldown: 0.46,
      dual: true,
      authoritativeCombo: true,
      comboVariant: "wyrmscale-inferno-talons",
      effectRecipe: "wyrmscale-fire-slash",
      effectEmitter: "blade",
      effectTiming: "impact",
      tags: { grip: "dual", family: "fist-blade", element: "fire" },
    });
    expect(manifest.parts.map((part) => part.file)).toEqual(["part-1.png", "part-2.png"]);
    expect(combo.sequence.map((step) => step.hand)).toEqual(["lead", "off", "lead", "off"]);
    expect(combo.sequence.every((step) => step.path.kind === "sweep")).toBe(true);
    expect(
      combo.sequence.every(
        (step) => Math.abs(step.path.arcMultiplier * wyrmscale.swingArc) >= Math.PI * 1.6,
      ),
    ).toBe(true);
    expect(meleeComboGraceMs(wyrmscale.cooldown, combo.sequence)).toBeGreaterThanOrEqual(450);
    expect((wyrmscale.damage / wyrmscale.cooldown) / ((5 + 6) / 0.46)).toBeCloseTo(1, 10);

    const fireSlash = WEAPON_EFFECT_RECIPES["wyrmscale-fire-slash"];
    expect(fireSlash).toMatchObject({
      weaponId: wyrmscale.id,
      emitter: "blade",
      classification: "weapon-motion",
      swingPack: "fire-bolt",
      swingScaleMode: "blade-length",
    });
    expect(fireSlash.radialDistribution).toBeUndefined();
    expect(wyrmscale.performance?.aura).toBeUndefined();
  });

  it("keeps Unicorn beam gameplay immutable and replaces its procedural stack with one recovered tile", () => {
    const unicorn = weapon("x2-unicorn-rainbow-beam");
    expect(unicorn.beam).toEqual({
      damagePerSecond: 20,
      tickRate: 0.1,
      width: 64,
      range: 520,
      chargeSeconds: 0.65,
      sweepLagSeconds: 0.12,
      overheat: {
        maxChannelSeconds: 1.25,
        heatPerSecond: 0.6,
        coolPerSecond: 0.35,
        ignitionHeat: 0.25,
        lockSeconds: 1.5,
        restartHeat: 0.35,
      },
      movement: { chargeMul: 0.55, channelMul: 0.35 },
    });
    expect(BEAM_VFX_RECIPES[unicorn.id]).toMatchObject({
      signature: "unicorn-recovered-cel-band-tile",
      tileArt: {
        textureKey: "recovered:unicorn-rainbow-beam",
        url: "sprites/vfx-unicorn-rainbow-beam/part-1.png",
        nativeWidth: 1158,
        nativeHeight: 362,
      },
    });
    expect(BEAM_VFX_RECIPES[unicorn.id]?.structure).toBeUndefined();
    expect(BEAM_VFX_RECIPES[unicorn.id]?.strandPalette).toBeUndefined();
    expect(existsSync("packages/client/public/sprites/vfx-unicorn-rainbow-beam/part-1.png")).toBe(
      true,
    );
  });

  it("registers Emberfist as two duplicated wraps with impact-only striking-hand flame overlays", () => {
    const emberfist = weapon("x2-emberfist-wraps");
    const sparkmitt = weapon("x2-coyote-trickster-s-sparkmitt");
    const manifest = SPRITES[emberfist.id];
    const emberCombo = meleeComboSelectionFor(emberfist);
    const sparkCombo = meleeComboSelectionFor(sparkmitt);
    if (!manifest || !emberCombo || !sparkCombo) throw new Error("Emberfist fixture missing");

    expect(emberfist).toMatchObject({
      damage: 2.4,
      cooldown: 0.12,
      tier: 2,
      glovePair: { sharedCombo: true },
      strikeOverlayPart: 2,
      suppressVfx: true,
      authoritativeCombo: true,
      tags: { grip: "2H", delivery: "glove-pair", family: "wraps", element: "fire" },
      performance: {
        continuous: true,
      },
    });
    expect("forwardDrift" in (emberfist.performance ?? {})).toBe(false);
    expect(emberfist.damage / emberfist.cooldown).toBe(20);
    expect(
      emberCombo.sequence.map(({ name: _name, ...signature }) => signature),
    ).toEqual(sparkCombo.sequence.map(({ name: _name, ...signature }) => signature));
    expect(meleeComboGraceMs(emberfist.cooldown, emberCombo.sequence)).toBeGreaterThanOrEqual(450);
    expect(manifest.parts).toMatchObject([
      { role: "part-1", file: "part-1.png", w: 576, h: 896 },
      { role: "part-2", file: "part-2.png", w: 576, h: 896 },
    ]);
    expect(resolveWeaponEffectRecipe(emberfist)).toBeUndefined();
    expect(WEAPON_VFX[emberfist.id]).toBeUndefined();
    expect(emberfist.performance?.aura).toBeUndefined();
  });

  it("moves the active census by exactly one and exposes Emberfist to both acquisition pools", () => {
    const id = "x2-emberfist-wraps";
    const packIds = lockedPackCandidates(createMetaAccountV5(), "weapon").map((row) => row.id);
    // B69's deliberate B63/B66 merge advances each live census while archives remain fixed at twenty.
    expect(WEAPON_CATALOG_IDS).toHaveLength(379);
    expect(ACTIVE_WEAPON_CATALOG_IDS).toHaveLength(359);
    expect(ACTIVE_EXPANSION_WEAPON_IDS).toHaveLength(330);
    expect(ARCHIVED_WEAPON_IDS).toHaveLength(20);
    expect(ACTIVE_WEAPON_CATALOG_IDS).toContain(id);
    expect(ACTIVE_EXPANSION_WEAPON_IDS).toContain(id);
    expect(DROP_POOL).toContain(id);
    expect(packIds).toContain(id);
  });
});
