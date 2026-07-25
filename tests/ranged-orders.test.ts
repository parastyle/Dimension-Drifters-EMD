import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PROJECTILE_SPRITES } from "../packages/client/src/sprites/projectile-manifest.js";
import { GUN_GENERATED_PROJECTILES } from "../packages/client/src/vfx/gun-projectile-art.js";
import { PROJECTILE_EXPLOSION_VFX_RECIPES } from "../packages/client/src/vfx/projectile-explosion-vfx-recipes.js";
import {
  serverSeededGunPelletVolley,
  WEAPON_MUZZLE_COUNT_CAP,
  WEAPONS,
  weaponMuzzleWorldPointsForShot,
} from "../packages/shared/src/index.js";

const GENERATED_IDENTITIES = Object.freeze({
  "x2-brimstone-gallows-rifle": "brimstone-flaming-cross",
  "x2-frostfang-speargun": "frostfang-pictured-harpoon",
  "x2-galvanic-coachgun": "galvanic-coachgun-electric-slug",
  "x2-ironhide-buffalo-gun": "ironhide-anti-tank-shell",
  "x2-plaguespitter-flak-gun": "plaguespitter-green-shot",
  "x2-tesla-drumbore": "tesla-drumbore-electric-particle",
  "x2-tesla-faradayer": "tesla-faradayer-hand-drawn-bolt",
  "x2-thunderhead-lever-gun": "thunderhead-blue-helix",
  "x2-thunderhead-repeater-cannon": "thunderhead-smoke-ring",
  "x-gun-ricochet-pistol": "ricochet-icicle",
} as const);

describe("Batch R ranged owner orders", () => {
  it("constrains both random volleys to their authored forward cones", () => {
    for (const [weaponId, expected] of [
      ["x2-gravelthroat-repeater", { min: 1, max: 10, halfAngle: 0.48 }],
      ["x2-plaguespitter-flak-gun", { min: 3, max: 7, halfAngle: 0.34 }],
    ] as const) {
      const random = WEAPONS[weaponId]?.gun?.randomPellets;
      expect(random, weaponId).toEqual({ ...expected, directions: "cone" });
      if (random?.directions !== "cone") throw new Error(`${weaponId} cone fixture is required`);
      const rolls = Array.from({ length: 80 }, (_, seed) =>
        serverSeededGunPelletVolley(random, seed + 1),
      );
      expect(Math.min(...rolls.map((roll) => roll.requestedCount))).toBeGreaterThanOrEqual(
        expected.min,
      );
      expect(Math.max(...rolls.map((roll) => roll.requestedCount))).toBeLessThanOrEqual(
        expected.max,
      );
      expect(
        rolls.every((roll) =>
          roll.angles.every((angle) => angle >= -expected.halfAngle && angle < expected.halfAngle),
        ),
      ).toBe(true);
    }
  });

  it("authors two and seven parallel art-space muzzles without multiplying trigger damage", () => {
    expect(WEAPON_MUZZLE_COUNT_CAP).toBe(7);
    for (const [weaponId, count] of [
      ["x2-sidewinder-spitfire", 2],
      ["x2-hailspitter-pepperbox", 7],
    ] as const) {
      const weapon = WEAPONS[weaponId];
      expect(weapon?.gun?.spread, weaponId).toBe(0);
      expect(weapon?.muzzle, weaponId).toMatchObject({
        salvoMode: "parallel",
        barrelMode: "parallel",
      });
      expect(weapon?.muzzle?.points, weaponId).toHaveLength(count);
      if (!weapon) throw new Error(`${weaponId} definition is required`);
      const world = weaponMuzzleWorldPointsForShot(weapon, {
        x: 100,
        y: 200,
        aimX: 0,
        aimY: 1,
      });
      expect(world).toHaveLength(count);
      expect(new Set(world.map((point) => point.x.toFixed(4))).size).toBe(count);
      expect(new Set(world.map((point) => point.y.toFixed(4))).size).toBe(1);
    }
  });

  it("slows Mesa by exactly 0.5 seconds and moves the old DPS into its detonation", () => {
    const gun = WEAPONS["x2-mesa-hand-cannon"]?.gun;
    expect(gun).toMatchObject({
      damage: 16,
      fireRate: 1.2,
      explode: { radius: 74, damage: 11.428571428571 },
    });
    if (!gun?.explode) throw new Error("Mesa explosion fixture is required");
    expect((gun.damage + gun.explode.damage) / gun.fireRate).toBeCloseTo(16 / 0.7, 8);
    expect(PROJECTILE_EXPLOSION_VFX_RECIPES["x2-mesa-hand-cannon"].paintedTexture).toMatchObject({
      url: "vfx/explosions/v7/mesa-detonation.png",
      diameterMultiplier: 1,
    });
  });

  it("keeps Rocket Tube's large blast and moves the trigger hand while advancing the tube", () => {
    const weapon = WEAPONS["x2-brimstone-rocket-tube"];
    expect(weapon?.gun?.explode).toEqual({ radius: 220, damage: 13 });
    expect(weapon?.gripPoints).toEqual({
      primary: { x: 0.28, y: 0.74 },
      secondary: { x: 0.61, y: 0.58, role: "shoulder-RPG" },
    });
    expect(
      PROJECTILE_EXPLOSION_VFX_RECIPES["x2-brimstone-rocket-tube"].paintedTexture,
    ).toMatchObject({
      url: "vfx/explosions/v7/brimstone-rocket-tube-large-explosion.png",
      diameterMultiplier: 1,
    });
  });

  it("applies the exact size, projectile-scale, planted recoil, and one-hand orders", () => {
    expect(WEAPONS["x2-dustline-lever-action"]?.displayLength).toBe(240);
    expect(WEAPONS["x2-gravelung-punt-rifle"]?.gun?.projectileVisualScale).toBe(2);
    const hexbore = WEAPONS["x2-hexbore-voidmaw"];
    expect(hexbore).toMatchObject({
      displayLength: 97.44,
      tags: { grip: "1H", handling: ["pistol"] },
      gripPoints: { primary: { x: 0.22, y: 0.62 } },
    });
    expect(hexbore?.gripPoints?.secondary).toBeUndefined();
    const sanctus = WEAPONS["x2-sanctus-siege-bombard"];
    if (!sanctus?.gun) throw new Error("Sanctus gun fixture is required");
    expect(sanctus.gun.recoil).toBe(0.0038);
    expect("userKnockbackMultiplier" in sanctus.gun).toBe(false);
  });

  it("retains Stormcaller's already-shipped six barrel-aligned beams", () => {
    const weapon = WEAPONS["x2-stormcaller-tesla-gatling"];
    expect(weapon?.beam).toBeDefined();
    expect(weapon?.muzzle).toMatchObject({
      salvoMode: "parallel",
      barrelMode: "parallel",
    });
    expect(weapon?.muzzle?.points).toHaveLength(6);
  });

  it("installs every requested generated projectile as a transparent standalone bitmap", () => {
    for (const [weaponId, spriteId] of Object.entries(GENERATED_IDENTITIES)) {
      const recipe = GUN_GENERATED_PROJECTILES[weaponId];
      const sprite = PROJECTILE_SPRITES[spriteId as keyof typeof PROJECTILE_SPRITES];
      expect(WEAPONS[weaponId]?.gun?.projectileArt, weaponId).toBe("generated");
      expect(recipe?.spriteId, weaponId).toBe(spriteId);
      expect(recipe?.url, weaponId).toBe(sprite.url);
      const path = `packages/client/public/${sprite.url}`;
      expect(existsSync(path), path).toBe(true);
      const bytes = readFileSync(path);
      expect(bytes.toString("ascii", 1, 4), path).toBe("PNG");
      expect(bytes[25], `${path}: RGBA color type`).toBe(6);
    }
    expect(GUN_GENERATED_PROJECTILES["x2-brimstone-gallows-rifle"]?.displayLength).toBeLessThan(40);
  });

  it("pins trigger/support hands and preserves Hexbore's existing void VFX", () => {
    expect(WEAPONS["x2-ironhail-pepperbox"]?.gripPoints).toEqual({
      primary: { x: 0.38, y: 0.7 },
    });
    expect(WEAPONS["x2-hailstorm-coilgun"]?.gripPoints).toEqual({
      primary: { x: 0.43, y: 0.68 },
      secondary: { x: 0.78, y: 0.54, role: "under-barrel" },
    });
    expect(GUN_GENERATED_PROJECTILES["x2-hexbore-voidmaw"]).toMatchObject({
      spriteId: "hexbore-voidmaw-rune",
      displayLength: 48,
    });
  });
});
