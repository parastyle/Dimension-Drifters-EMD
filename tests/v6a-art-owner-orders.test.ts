import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PROJECTILE_SPRITES } from "../packages/client/src/sprites/projectile-manifest.js";
import { THROWN_GENERATED_PROJECTILES } from "../packages/client/src/vfx/gun-projectile-art.js";
import {
  ALL_BLADE_EXTENSION_TEXTURES,
  weaponSupportsBladeExtension,
} from "../packages/client/src/vfx/blade-extension-treatments.js";
import { resolveWeaponEffectRecipe } from "../packages/client/src/vfx/weapon-effect-recipes.js";
import { PAGE_PROJECTILE_ART } from "../packages/client/src/vfx/page-projectile-art.js";
import {
  bladeExtensionGeometryFor,
  meleeDamageEnvelopeFor,
} from "../packages/shared/src/hit-envelope.js";
import { swingDescriptorFor } from "../packages/shared/src/melee.js";
import { meleeReach } from "../packages/shared/src/weapons.js";
import { WEAPONS } from "../packages/shared/src/weapons.js";

describe("V6A generated-art owner orders", () => {
  it("retires every Headsman-only generated-art extension hook", () => {
    const headsman = WEAPONS["x2-sanctified-headsman"];
    expect(headsman).toBeDefined();
    if (!headsman) throw new Error("missing Sanctified Headsman fixture");
    expect(existsSync("packages/client/src/vfx/headsman-prototypes.ts")).toBe(false);
    expect(weaponSupportsBladeExtension(headsman.id)).toBe(false);
    expect(
      ALL_BLADE_EXTENSION_TEXTURES.some((treatment) => treatment.weaponId === headsman.id),
    ).toBe(false);
    expect(bladeExtensionGeometryFor(headsman)).toBeUndefined();
    const ordinaryReach = meleeReach(headsman);
    expect(meleeDamageEnvelopeFor(headsman)).toMatchObject({
      baseReach: ordinaryReach,
      maxReach: ordinaryReach,
    });
    expect(resolveWeaponEffectRecipe(headsman)).toBeUndefined();
    expect(headsman.suppressVfx).toBe(true);
  });

  it("keeps the Headsman's ordinary sword damage and timing with no ignition path", () => {
    const headsman = WEAPONS["x2-sanctified-headsman"];
    expect(headsman).toMatchObject({
      damage: 13,
      cooldown: 0.74,
      range: 160,
      suppressVfx: true,
    });
    expect(swingDescriptorFor(headsman, headsman.cooldown).style).toBe("chop");
    const playerSource = readFileSync("packages/client/src/vfx/VfxPlayer.ts", "utf8");
    expect(playerSource).not.toContain("headsman-proto");
    expect(playerSource).not.toContain("headsmanExtensionReveal");
    expect(playerSource).not.toContain("x2-sanctified-headsman");
  });

  it("keeps the stable Gravewarden art and combat contract with the seamless frontflip", () => {
    expect(WEAPONS["gravediggers-spade"]).toMatchObject({
      id: "gravediggers-spade",
      name: "Gravewarden Buster",
      sprite: "gravewarden-buster",
      range: 354,
      cooldown: 0.6,
      damage: 8 / 3,
      swingArc: Math.PI * 6,
      performance: {
        hold: "steady",
        action: "spin",
        continuous: true,
        suppressSwing: true,
        twirl: {
          plane: "continuous-frontflip",
          direction: "forward",
          visualRevolutions: 3,
          cadenceSeconds: 0.6,
        },
      },
    });
  });

  it("registers real page images and preserves Verdigris's 7x page scale", () => {
    expect(PAGE_PROJECTILE_ART["x2-twin-whispervolumes"]?.url).toBe(
      "projectiles/twin-whisper-page.png",
    );
    expect(PAGE_PROJECTILE_ART["x2-verdigris-grand-grimoire"]).toMatchObject({
      url: "projectiles/verdigris-grand-page.png",
      scaleMultiplier: 7,
      displayWidth: 98,
    });
  });

  it("registers a generated standalone Coyote projectile instead of the tiled held-art part", () => {
    expect(THROWN_GENERATED_PROJECTILES["x2-coyote-s-grin"]).toMatchObject({
      spriteId: "coyotes-grin-throwing-blade",
      url: "projectiles/coyotes-grin-throwing-blade.png",
    });
    expect(PROJECTILE_SPRITES["coyotes-grin-throwing-blade"].source).toBe("generated");
  });

  it("keeps every thrown payload free of the old blanket yellow-circle overlay", () => {
    const source = readFileSync("packages/client/src/scenes/arena/projectile-factory.ts", "utf8");
    const thrownFactory = source.slice(
      source.indexOf("export function makeThrownWeapon"),
      source.indexOf("export function makeMagma"),
    );
    expect(thrownFactory).not.toMatch(/add\.(?:circle|ellipse)\(/);
    expect(thrownFactory).not.toContain("0xffb23b");
  });
});
