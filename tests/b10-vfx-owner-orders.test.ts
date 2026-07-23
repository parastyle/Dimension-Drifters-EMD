import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import {
  bladeExtensionGeometryFor,
  meleeDamageEnvelopeFor,
  meleeReach,
  weaponDamageEnvelopeFor,
  WEAPONS,
} from "@dd/shared";
import { describe, expect, it } from "vitest";
import {
  ALL_BLADE_EXTENSION_TEXTURES,
  weaponSupportsBladeExtension,
} from "../packages/client/src/vfx/blade-extension-treatments.js";
import {
  resolveWeaponEffectRecipe,
  weaponSwingIdentitySizePx,
} from "../packages/client/src/vfx/weapon-effect-recipes.js";
import { WEAPON_VFX } from "../packages/client/src/vfx/weapon-vfx.generated.js";
import {
  weaponPaintedAuraFor,
  weaponPaintedQuakeFor,
  weaponPaintedSwingFor,
  weaponPaintedSwingGeometryFor,
  weaponVfxSuiteFor,
} from "../packages/client/src/vfx/weapon-vfx-suite.js";

const require = createRequire(import.meta.url);
const { PNG } = require("../tools/artkit/node_modules/pngjs") as {
  PNG: {
    sync: {
      read(bytes: Buffer): { width: number; height: number; data: Buffer };
    };
  };
};

interface RasterCensus {
  readonly width: number;
  readonly height: number;
  readonly visibleFraction: number;
  readonly averageRed: number;
  readonly averageGreen: number;
  readonly averageBlue: number;
  readonly radialCoverage: readonly number[];
}

function rasterCensus(relativePath: string): RasterCensus {
  const png = PNG.sync.read(readFileSync(relativePath));
  const bins = Array.from({ length: 10 }, () => ({ visible: 0, total: 0 }));
  let visible = 0;
  let red = 0;
  let green = 0;
  let blue = 0;
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const offset = (y * png.width + x) * 4;
      const alpha = png.data[offset + 3] ?? 0;
      if (alpha > 16) {
        visible++;
        red += png.data[offset] ?? 0;
        green += png.data[offset + 1] ?? 0;
        blue += png.data[offset + 2] ?? 0;
      }
      const normalizedX = (x + 0.5 - png.width / 2) / (png.width / 2);
      const normalizedY = (y + 0.5 - png.height / 2) / (png.height / 2);
      const radius = Math.hypot(normalizedX, normalizedY);
      if (radius >= 1) continue;
      const bin = bins[Math.min(9, Math.floor(radius * 10))];
      if (!bin) continue;
      bin.total++;
      if (alpha > 16) bin.visible++;
    }
  }
  return {
    width: png.width,
    height: png.height,
    visibleFraction: visible / (png.width * png.height),
    averageRed: red / visible,
    averageGreen: green / visible,
    averageBlue: blue / visible,
    radialCoverage: bins.map((bin) => bin.visible / bin.total),
  };
}

describe("B10 weapon VFX cleanup/reuse", () => {
  it("fills Fulgurite continuously from the player center through its exact aura diameter", () => {
    const weapon = WEAPONS["x2-fulgurite-storm-sphere"];
    if (!weapon) throw new Error("Missing Fulgurite Storm-Sphere fixture");
    const treatment = weaponPaintedAuraFor(weapon.id);
    expect(treatment).toMatchObject({
      textureKey: "b10:fulgurite-blue-fill",
      url: "vfx/weapons/v7/fulgurite-blue-fill.png",
      diameterMultiplier: 1,
      verticalScale: 0.56,
      layers: [1, 0.62],
      subjects: ["blue-lightning", "storm-plates", "center-fill"],
    });
    const aura = weaponDamageEnvelopeFor(weapon).aura;
    expect(aura?.radius).toBe(450);
    expect((aura?.radius ?? 0) * 2 * (treatment?.diameterMultiplier ?? 0)).toBe(900);

    const census = rasterCensus(`packages/client/public/${treatment?.url}`);
    expect(census.visibleFraction).toBeGreaterThan(0.6);
    expect(census.averageBlue).toBeGreaterThan(census.averageGreen * 1.5);
    expect(census.averageGreen).toBeGreaterThan(census.averageRed * 3);
    for (const [index, coverage] of census.radialCoverage.slice(0, 9).entries())
      expect(coverage, `radial band ${index} must not become a dead annulus`).toBeGreaterThan(0.9);
  });

  it("renders Tombstone quake with stones and smoke but no bone subject", () => {
    const weapon = WEAPONS["tombstone-greatsword"];
    if (!weapon) throw new Error("Missing Tombstone Greatsword fixture");
    const treatment = weaponPaintedQuakeFor(weapon.id);
    expect(treatment).toMatchObject({
      textureKey: "b10:tombstone-stone-smoke",
      url: "vfx/weapons/v7/tombstone-stone-smoke.png",
      diameterMultiplier: 1,
      subjects: ["stone", "smoke"],
      removedSubjects: ["bone"],
    });
    expect(treatment?.subjects).not.toContain("bone");
    const quake = weaponDamageEnvelopeFor(weapon).quake;
    expect(quake?.radius).toBe(270);
    expect((quake?.radius ?? 0) * 2 * (treatment?.diameterMultiplier ?? 0)).toBe(540);
    expect(rasterCensus(`packages/client/public/${treatment?.url}`).visibleFraction).toBeGreaterThan(
      0.4,
    );

    const source = readFileSync("packages/client/src/scenes/arena/vfx.ts", "utf8");
    const paintedBranch = source.indexOf("if (paintedQuake &&");
    const paintedReturn = source.indexOf("return;", paintedBranch);
    const graveFallback = source.indexOf('grave ? "grave-call"', paintedBranch);
    expect(paintedBranch).toBeGreaterThan(-1);
    expect(paintedReturn).toBeGreaterThan(paintedBranch);
    expect(paintedReturn).toBeLessThan(graveFallback);
  });

  it("sizes the Voulge's reused blue electrical art to its complete damage reach", () => {
    const weapon = WEAPONS["x2-thunderhead-voulge"];
    if (!weapon) throw new Error("Missing Thunderhead Voulge fixture");
    const treatment = weaponPaintedSwingFor(weapon.id);
    const recipe = resolveWeaponEffectRecipe(weapon);
    const geometry = weaponPaintedSwingGeometryFor(weapon, treatment);
    expect(recipe).toMatchObject({
      id: "thunderhead-electric-codex",
      paintedSwing: true,
    });
    expect(recipe?.swingPack).toBeUndefined();
    expect(treatment).toMatchObject({
      textureKey: "b10:thunderhead-voulge-blue",
      url: "vfx/weapons/v7/thunderhead-voulge-blue-effect.png",
      extentMultiplier: 1,
      originX: 0.04,
      tint: 0x33e6ff,
      subjects: ["blue-electric-arc"],
    });
    expect(geometry?.forwardExtent).toBe(meleeDamageEnvelopeFor(weapon).maxReach);
    expect(geometry?.forwardExtent).toBe(230);
    expect(geometry?.displayWidth).toBeGreaterThan(weapon.displayLength * 1.2);
    expect(geometry?.forwardExtent).toBeGreaterThan(
      weaponSwingIdentitySizePx(recipe, weapon.displayLength) * 4,
    );
    expect(weaponVfxSuiteFor(weapon.id, weapon.tags.element, "chop").suite).toEqual({});

    const census = rasterCensus(`packages/client/public/${treatment?.url}`);
    expect(census.visibleFraction).toBeGreaterThan(0.4);
    expect(census.averageBlue).toBeGreaterThan(census.averageGreen * 1.5);
    expect(census.averageGreen).toBeGreaterThan(census.averageRed * 3);
  });

  it("leaves Sanctified Headsman as an ordinary sword with zero special VFX or extension", () => {
    const weapon = WEAPONS["x2-sanctified-headsman"];
    if (!weapon) throw new Error("Missing Sanctified Headsman fixture");
    expect(weapon).toMatchObject({
      damage: 13,
      cooldown: 0.74,
      range: 160,
      displayLength: 186.3,
      suppressVfx: true,
    });
    expect(weapon.effectRecipe).toBeUndefined();
    expect(resolveWeaponEffectRecipe(weapon)).toBeUndefined();
    expect(WEAPON_VFX[weapon.id]).toBeUndefined();
    expect(weaponSupportsBladeExtension(weapon.id)).toBe(false);
    expect(
      ALL_BLADE_EXTENSION_TEXTURES.some((treatment) => treatment.weaponId === weapon.id),
    ).toBe(false);
    expect(bladeExtensionGeometryFor(weapon)).toBeUndefined();
    const ordinaryReach = meleeReach(weapon);
    expect(meleeDamageEnvelopeFor(weapon)).toMatchObject({
      baseReach: ordinaryReach,
      maxReach: ordinaryReach,
    });
    expect(weaponVfxSuiteFor(weapon.id, weapon.tags.element, "chop")).toMatchObject({
      authored: true,
      suite: {},
    });
  });

  it("preserves all four weapons' nominal damage and cooldown values", () => {
    expect(WEAPONS["x2-fulgurite-storm-sphere"]).toMatchObject({
      damage: 7,
      cooldown: 0.4,
      performance: { aura: { damagePerSecond: 18 } },
    });
    expect(WEAPONS["tombstone-greatsword"]).toMatchObject({
      damage: 11,
      cooldown: 0.78,
      quake: { damage: 8 },
    });
    expect(WEAPONS["x2-thunderhead-voulge"]).toMatchObject({
      damage: 13,
      cooldown: 0.82,
      chainLightning: { damage: 6 },
    });
    expect(WEAPONS["x2-sanctified-headsman"]).toMatchObject({
      damage: 13,
      cooldown: 0.74,
    });
  });
});
