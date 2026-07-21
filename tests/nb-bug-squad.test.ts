import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import {
  meleeReach,
  ProjectileState,
  thrownProjectileKindFor,
  thrownProjectileSpriteId,
  WEAPONS,
  weaponDisplaySpriteId,
} from "@dd/shared";
import { describe, expect, it } from "vitest";
import { localAttackCooldownSeconds } from "../packages/client/src/scenes/arena/attack-cadence.js";
import {
  FX_EMITTER_LIFETIME_BOUND_MS,
  wispTweenTiming,
} from "../packages/client/src/vfx/fx-emitter-lifetime.js";
import { PARTICLE_PACKS } from "../packages/client/src/vfx/particle-manifest.js";
import {
  resolveWeaponEffectRecipe,
  shouldSpawnLegacyQuakeVfx,
  weaponSwingIdentityScale,
} from "../packages/client/src/vfx/weapon-effect-recipes.js";
import { WEAPON_VFX } from "../packages/client/src/vfx/weapon-vfx.generated.js";

describe("NB bug squad weapon contracts", () => {
  it("resolves bespoke projectile art from immutable wire ownership on the first frame", () => {
    const projectile = new ProjectileState();
    projectile.sourcePlayerId = "owner";
    projectile.sourceWeaponId = "x2-galvanic-overcasters";
    const weapon = WEAPONS[projectile.sourceWeaponId];
    const recipe = resolveWeaponEffectRecipe(weapon);

    expect(projectile.sourcePlayerId).toBe("owner");
    expect(recipe).toMatchObject({
      weaponId: projectile.sourceWeaponId,
      projectile: "electric-bolt",
      projectileColor: 0x2f8fff,
    });
  });

  it("uses Arcanist's cast cadence for the held-fire scheduler", () => {
    const lance = WEAPONS["x-staff-arcane-lance"];
    expect(lance?.cast?.cooldown).toBe(0.62);
    expect(localAttackCooldownSeconds(lance, 1)).toBe(0.62);
  });

  it("bounds every pooled pack wisp lifetime and starts delay inside the first tween", () => {
    for (let order = 0; order < 4; order++) {
      const timing = wispTweenTiming(order);
      expect(timing.total).toBeLessThanOrEqual(FX_EMITTER_LIFETIME_BOUND_MS);
      expect(timing.fadeDuration).toBeGreaterThan(0);
    }
    const source = readFileSync(
      new URL("../packages/client/src/vfx/fx-composer.ts", import.meta.url),
      "utf8",
    );
    const wispBlock = source.slice(
      source.indexOf("plan.wisps?.indexes.forEach"),
      source.indexOf("plan.ground?.forEach"),
    );
    const chainHeader = wispBlock.slice(
      wispBlock.indexOf("scene.tweens.chain"),
      wispBlock.indexOf("tweens: ["),
    );
    expect(chainHeader).not.toContain("delay:");
    expect(wispBlock).toContain("delay: timing.delay");
    expect(wispBlock).toContain("onComplete: () => img.destroy()");
  });

  it("sizes Tombwarden's replacement slash to the blade and suppresses its legacy quake explosion", () => {
    const tombwarden = WEAPONS["x2-tombwarden-claymore"];
    const recipe = resolveWeaponEffectRecipe(tombwarden);
    if (!tombwarden || !recipe?.impactPack) throw new Error("Tombwarden recipe fixture is required");
    const frameWidth = PARTICLE_PACKS[recipe.impactPack]?.frameWidth;
    if (!frameWidth) throw new Error("Tombwarden particle pack fixture is required");

    expect(weaponSwingIdentityScale(recipe, tombwarden.displayLength) * frameWidth).toBeCloseTo(
      tombwarden.displayLength,
      8,
    );
    expect(recipe.suppressQuakeVfx).toBe(true);
    expect(shouldSpawnLegacyQuakeVfx(tombwarden)).toBe(false);
  });

  it("matches Permafrost's whirlwind radius to its authoritative damage reach", () => {
    const bardiche = WEAPONS["x2-permafrost-bardiche"];
    if (!bardiche) throw new Error("Permafrost fixture is required");
    expect(WEAPON_VFX[bardiche.id]?.vfxRadius).toBe(meleeReach(bardiche));
    expect(WEAPON_VFX[bardiche.id]?.vfxRadius).toBe(bardiche.range);
  });

  it("makes Quicksilver thrown and uses its own cleaned sprite as the projectile", () => {
    const cleaver = WEAPONS["x2-quicksilver-skinning-cleaver"];
    if (!cleaver?.thrown) throw new Error("Quicksilver thrown fixture is required");
    const kind = thrownProjectileKindFor(cleaver);

    expect(cleaver.tags.delivery).toBe("thrown");
    expect(thrownProjectileSpriteId(kind)).toBe(weaponDisplaySpriteId(cleaver));

    const require = createRequire(import.meta.url);
    const { PNG } = require("../tools/artkit/node_modules/pngjs");
    const png = PNG.sync.read(
      readFileSync(
        new URL(
          "../packages/client/public/sprites/x2-quicksilver-skinning-cleaver/part-1.png",
          import.meta.url,
        ),
      ),
    );
    let transparent = 0;
    let keyedBlue = 0;
    for (let i = 0; i < png.data.length; i += 4) {
      const r = png.data[i] as number;
      const g = png.data[i + 1] as number;
      const b = png.data[i + 2] as number;
      const a = png.data[i + 3] as number;
      if (a === 0) transparent++;
      if (a > 200 && b > 140 && b - Math.max(r, g) > 90 && r < 150 && g < 150) keyedBlue++;
    }
    expect(transparent).toBeGreaterThan(50_000);
    expect(keyedBlue).toBe(0);
  });
});
