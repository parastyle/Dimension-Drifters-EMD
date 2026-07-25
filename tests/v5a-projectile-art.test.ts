import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { PROJECTILE_SPRITES } from "../packages/client/src/sprites/projectile-manifest.js";
import { CASTER_SPRITE_PROJECTILES } from "../packages/client/src/vfx/caster-vfx-recipes.js";
import {
  GUN_GENERATED_PROJECTILES,
  GUN_SPRITE_PROJECTILES,
} from "../packages/client/src/vfx/gun-projectile-art.js";
import { WEAPONS } from "../packages/shared/src/index.js";

const require = createRequire(import.meta.url);
const { PNG } = require("pngjs") as {
  PNG: {
    sync: {
      read(bytes: Buffer): { width: number; height: number; data: Buffer };
    };
  };
};

const V5A_PROJECTILES = [
  ["x2-saintskull-monstrance", "saintskull-monstrance-holy-skull", 96],
  ["x2-quill-storm-repeater", "quill-storm-repeater-arrow", 44],
  ["x2-mesa-hand-cannon", "mesa-hand-cannon-50cal", 52.5],
  ["x-gun-hand-mortar", "hand-mortar-shell", 80],
  ["x2-ghostbolt-crossbow", "ghostbolt-crossbow-arrow", 216],
  ["x2-leviathan-harpoon-gun", "leviathan-harpoon-gun-harpoon", 96],
  ["x2-hexbore-voidmaw", "hexbore-voidmaw-rune", 67.2],
  ["x2-brimstone-rocket-tube", "brimstone-rocket-warhead", 65],
  ["x2-widowmaker-arbalest", "widowmaker-arbalest-arrow", 234],
] as const;

describe("V5A generated projectile identity art", () => {
  it("registers every ordered standalone sprite through the manifest and projectile factory", () => {
    for (const [weaponId, spriteId, liveLength] of V5A_PROJECTILES) {
      const weapon = WEAPONS[weaponId];
      const recipe = GUN_GENERATED_PROJECTILES[weaponId];
      const sprite = PROJECTILE_SPRITES[spriteId];
      expect(weapon?.gun?.projectileArt, weaponId).toBe("generated");
      expect(recipe?.spriteId, weaponId).toBe(spriteId);
      expect(recipe?.url, weaponId).toBe(sprite.url);
      expect((recipe?.displayLength ?? 0) * (weapon?.gun?.projectileVisualScale ?? 1)).toBeCloseTo(
        liveLength,
        6,
      );

      const png = PNG.sync.read(readFileSync(`packages/client/public/${sprite.url}`));
      expect({ width: png.width, height: png.height }, spriteId).toEqual({
        width: sprite.width,
        height: sprite.height,
      });
      let transparent = 0;
      let visible = 0;
      for (let offset = 3; offset < png.data.length; offset += 4) {
        if (png.data[offset] === 0) transparent++;
        if ((png.data[offset] ?? 0) > 64) visible++;
      }
      expect(transparent, `${spriteId}: transparent padding`).toBeGreaterThan(0);
      expect(visible, `${spriteId}: visible subject`).toBeGreaterThan(180);
    }
    expect(PROJECTILE_SPRITES["brimstone-rocket-warhead"].source).toBe("edited");
    for (const [, spriteId] of V5A_PROJECTILES.filter(
      ([weaponId]) => weaponId !== "x2-brimstone-rocket-tube",
    ))
      expect(PROJECTILE_SPRITES[spriteId].source, spriteId).toBe("generated");
  });

  it("removes every owner-rejected crop registration", () => {
    for (const weaponId of [
      "x2-saintskull-monstrance",
      "x2-quill-storm-repeater",
      "x2-leviathan-harpoon-gun",
      "x2-hexbore-voidmaw",
      "x2-brimstone-rocket-tube",
    ])
      expect(GUN_SPRITE_PROJECTILES[weaponId], weaponId).toBeUndefined();
    expect(CASTER_SPRITE_PROJECTILES["x2-saintskull-monstrance"]).toBeUndefined();
  });

  it("makes Saintskull one large one-second shot while preserving the documented 90 DPS budget", () => {
    const weapon = WEAPONS["x2-saintskull-monstrance"];
    const gun = weapon?.gun;
    expect(weapon?.tags.fireMode).toBe("tap-charge");
    expect(gun).toMatchObject({
      damage: 90,
      fireRate: 1,
      magazine: 1,
      reloadSeconds: 0.6,
      projectileArt: "generated",
    });
    if (!gun) throw new Error("Saintskull gun fixture required");
    // GameRoom's authoritative gun cadence is fireRate; magazine/reload currently price Drive only.
    const cadenceSeconds = gun.fireRate;
    expect(cadenceSeconds).toBe(1);
    expect(gun.damage / cadenceSeconds).toBe(90);
  });

  it("derives Mesa's shared visual/server muzzle and gives Hexbore its flat one-hand pose", () => {
    const mesa = WEAPONS["x2-mesa-hand-cannon"];
    expect(mesa?.muzzle?.points[0]).toMatchObject({ part: 0, x: 255, y: 28.4 });
    expect(WEAPONS["x2-hexbore-voidmaw"]).toMatchObject({
      displayLength: 97.44,
      tags: { grip: "1H", handling: ["pistol"] },
    });
    expect(WEAPONS["x2-hexbore-voidmaw"]?.gripPoints).toEqual({
      primary: { x: 0.22, y: 0.62 },
    });
  });

  it("keeps the tiny-VFX scale contract and enlarges Brimstone's exact WYSIWYG blast", () => {
    expect(GUN_GENERATED_PROJECTILES["x-gun-hand-mortar"]?.displayLength).toBe(16);
    expect(WEAPONS["x-gun-hand-mortar"]?.gun?.projectileVisualScale).toBe(5);
    expect(WEAPONS["x2-brimstone-rocket-tube"]?.gun).toMatchObject({
      projectileVisualScale: 1.3,
      explode: { radius: 220, damage: 13 },
    });
    expect(WEAPONS["x2-widowmaker-arbalest"]?.gun?.projectileVisualScale).toBe(3);
  });
});
