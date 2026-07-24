import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SPRITES } from "../packages/client/src/sprites/manifest.js";
import {
  GUN_PROJECTILE_ART_PACKS,
  GUN_SPRITE_PROJECTILES,
} from "../packages/client/src/vfx/gun-projectile-art.js";
import { PARTICLE_PACKS } from "../packages/client/src/vfx/particle-manifest.js";
import { weaponArtMuzzlePointsForShot, WEAPONS } from "../packages/shared/src/index.js";

const OWN_SPRITE_PROJECTILES = ["x2-grave-anchor-harpoon"] as const;

function pngDimensions(path: string): { width: number; height: number } {
  const bytes = readFileSync(path);
  if (bytes.toString("ascii", 1, 4) !== "PNG") throw new Error(`${path} is not a PNG`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe("V3R ranged owner orders", () => {
  it("retains only the legacy Grave-Anchor bounded crop", () => {
    for (const weaponId of OWN_SPRITE_PROJECTILES) {
      const weapon = WEAPONS[weaponId];
      const recipe = GUN_SPRITE_PROJECTILES[weaponId];
      const part = recipe
        ? SPRITES[recipe.spriteId as keyof typeof SPRITES]?.parts.find(
            (candidate) => candidate.role === recipe.partRole,
          )
        : undefined;
      expect(weapon?.gun?.projectileArt).toBe("weapon-crop");
      expect(recipe?.spriteId).toBe(weaponId);
      expect(part).toBeDefined();
      if (!recipe || !part) throw new Error(`Missing crop registration for ${weaponId}`);
      expect(recipe.crop.x).toBeGreaterThanOrEqual(0);
      expect(recipe.crop.y).toBeGreaterThanOrEqual(0);
      expect(recipe.crop.x + recipe.crop.width).toBeLessThanOrEqual(part.w);
      expect(recipe.crop.y + recipe.crop.height).toBeLessThanOrEqual(part.h);
    }
  });

  it("routes arrows, cannonballs, and fireballs through installed painted packs", () => {
    expect(WEAPONS["x2-quill-storm-repeater"]?.gun?.projectileArt).toBe("generated");
    expect(WEAPONS["x2-hailshot-hand-maul"]?.gun?.projectileArt).toBe("cannonball");
    expect(WEAPONS["x2-sanctus-siege-bombard"]?.gun?.projectileArt).toBe("cannonball");
    expect(WEAPONS["x2-boneyard-ricochet-mortar"]?.gun?.projectileArt).toBe("fireball");
    for (const packId of Object.values(GUN_PROJECTILE_ART_PACKS))
      expect(PARTICLE_PACKS[packId]).toBeDefined();
    expect(WEAPONS["x2-hailshot-hand-maul"]?.gun?.explode).toBeUndefined();
  });

  it("registers the clean Duster crop as an identical two-part default pair", () => {
    const sprite = SPRITES["x2-scattershell-duster"];
    const weapon = WEAPONS["x2-scattershell-duster"];
    expect(weapon?.dual).toBe(true);
    expect(sprite.parts.map((part) => part.role)).toEqual(["part-1", "part-2"]);
    if (!weapon?.muzzle) throw new Error("Duster art-space muzzle fixture required");
    expect(weaponArtMuzzlePointsForShot(weapon.muzzle, 1)).toHaveLength(4);
    for (const part of sprite.parts) {
      const path = `packages/client/public/sprites/x2-scattershell-duster/${part.file}`;
      expect(pngDimensions(path)).toEqual({ width: 253, height: 128 });
      expect(readFileSync(path)).toEqual(
        readFileSync("packages/client/public/sprites/x2-scattershell-duster/part-1.png"),
      );
    }
  });

  it("keeps size-only orders exact and fixed-barrel counts declarative", () => {
    expect(WEAPONS["x2-snakebite-dart-slinger"]?.displayLength).toBe(172);
    expect(WEAPONS["x2-frostbore-scattergun"]?.displayLength).toBe(131.6);
    expect(WEAPONS["x2-ashfall-peacemaker"]?.displayLength).toBe(74.48);
    expect(WEAPONS["x-gun-gatling"]?.muzzle?.points).toHaveLength(1);
    expect(WEAPONS["x2-reliquary-nailcaster"]?.muzzle?.points).toHaveLength(3);
    expect(WEAPONS["x2-stormcaller-tesla-gatling"]?.muzzle?.points).toHaveLength(6);
    expect(WEAPONS["x2-voltcaster-machine-pistol"]?.gun).toMatchObject({
      bulletKind: "laser",
      magazine: 24,
    });
  });

  it("retains the V3G grip laws on overlapping V3R weapons", () => {
    expect(WEAPONS["x2-widowmaker-arbalest"]?.gripPoints?.secondary?.role).toBe("crank");
    expect(WEAPONS["x2-boneyard-ricochet-mortar"]?.gripPoints?.secondary).toBeDefined();
    expect(WEAPONS["x2-brimstone-rocket-tube"]?.gripPoints?.secondary?.role).toBe("shoulder-RPG");
  });
});
