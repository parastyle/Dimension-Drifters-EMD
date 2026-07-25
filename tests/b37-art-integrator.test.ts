import { existsSync } from "node:fs";
import {
  PRESENT_BIG_PAYLOAD_ODDS,
  PRESENT_BIG_PAYLOAD_SCALE,
  PRESENT_BIG_PAYLOAD_VARIANT,
  PRESENT_REGULAR_PAYLOAD_DAMAGE_SCALE,
  presentPayloadExplosion,
  serverSeededPresentPayloadRoll,
  WEAPONS,
} from "@dd/shared";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { SPRITES } from "../packages/client/src/sprites/manifest.js";
import { PROJECTILE_SPRITES } from "../packages/client/src/sprites/projectile-manifest.js";
import {
  FAN_TORNADO_WEAPON_VFX_IDS,
  FAN_TORNADO_WEAPON_VFX_RECIPES,
  fanTornadoFrameIndexAtTick,
} from "../packages/client/src/vfx/generated-image-weapon-vfx-recipes.js";
import { GUN_GENERATED_PROJECTILES } from "../packages/client/src/vfx/gun-projectile-art.js";
import {
  PROJECTILE_EXPLOSION_VFX_RECIPES,
  resolveProjectileExplosionVfxRecipe,
} from "../packages/client/src/vfx/projectile-explosion-vfx-recipes.js";

async function png(path: string): Promise<{ width: number; height: number; data: Buffer }> {
  expect(existsSync(path), path).toBe(true);
  const { data, info } = await sharp(path)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data };
}

function visiblePixelCount(data: Buffer): number {
  let count = 0;
  for (let offset = 3; offset < data.length; offset += 4) if ((data[offset] ?? 0) >= 48) count++;
  return count;
}

describe("B37 harvested art integration", () => {
  it("remeasures the redrawn Buffalo Gun, re-derives its muzzle, and pins both hands to opaque art", async () => {
    const weapon = WEAPONS["x2-ironhide-buffalo-gun"];
    const manifest = SPRITES["x2-ironhide-buffalo-gun"];
    const image = await png("packages/client/public/sprites/x2-ironhide-buffalo-gun/part-1.png");
    expect([image.width, image.height]).toEqual([768, 252]);
    expect(manifest).toMatchObject({
      canvas: { w: 768, h: 252 },
      parts: [{ file: "part-1.png", w: 768, h: 252 }],
    });
    expect(weapon?.muzzle?.parts).toEqual([{ width: 768, height: 252 }]);
    expect(weapon?.muzzle?.points).toEqual([
      { part: 0, x: 767, y: 92.9, derived: { x: 767, y: 92.9 } },
    ]);
    expect(weapon?.gripPoints).toEqual({
      primary: { x: 0.29, y: 0.68 },
      secondary: { x: 0.48, y: 0.66, role: "under-barrel" },
    });
    for (const grip of [weapon?.gripPoints?.primary, weapon?.gripPoints?.secondary]) {
      expect(grip).toBeDefined();
      if (!grip) continue;
      const x = Math.round(grip.x * (image.width - 1));
      const y = Math.round(grip.y * (image.height - 1));
      expect(image.data[(y * image.width + x) * 4 + 3], `${x},${y}`).toBeGreaterThanOrEqual(48);
    }
  });

  it("pins five present skins and preserves the authored big-payload silhouette", async () => {
    const visible: number[] = [];
    for (let variant = 1; variant <= 5; variant++) {
      const id = `exploding-present-variant-${variant}` as keyof typeof PROJECTILE_SPRITES;
      expect(PROJECTILE_SPRITES[id]).toMatchObject({
        url: `sprites/vfx-present-variants/part-${variant}.png`,
        width: 640,
        height: 512,
      });
      visible.push(
        visiblePixelCount(
          (await png(`packages/client/public/sprites/vfx-present-variants/part-${variant}.png`))
            .data,
        ),
      );
    }
    expect(visible[4]).toBeGreaterThan(Math.max(...visible.slice(0, 4)) * 2.5);
  });

  it("uses a deterministic 1-in-8 server roll and conserves expected present explosion DPS", () => {
    expect(PRESENT_BIG_PAYLOAD_ODDS).toBe(8);
    expect(PRESENT_BIG_PAYLOAD_VARIANT).toBe(5);
    expect(PRESENT_BIG_PAYLOAD_SCALE).toBe(1.75);
    const first = Array.from({ length: 16_384 }, (_, seed) => serverSeededPresentPayloadRoll(seed));
    const second = Array.from({ length: 16_384 }, (_, seed) =>
      serverSeededPresentPayloadRoll(seed),
    );
    expect(second).toEqual(first);
    expect(new Set(first.map((roll) => roll.variant))).toEqual(new Set([1, 2, 3, 4, 5]));
    const bigRate = first.filter((roll) => roll.big).length / first.length;
    expect(bigRate).toBeGreaterThan(0.115);
    expect(bigRate).toBeLessThan(0.135);
    const base = { radius: 58, damage: 11 };
    const regular = presentPayloadExplosion(base, false);
    const big = presentPayloadExplosion(base, true);
    expect(regular.radius).toBe(58);
    expect(big.radius).toBeCloseTo(101.5, 8);
    expect(big.damage / base.damage).toBe(PRESENT_BIG_PAYLOAD_SCALE);
    expect(regular.damage / base.damage).toBeCloseTo(PRESENT_REGULAR_PAYLOAD_DAMAGE_SCALE, 12);
    expect((regular.damage * 7 + big.damage) / 8).toBeCloseTo(base.damage, 10);
  });

  it("replaces both Streetsweeper placeholders and sizes the painted blast to authority", () => {
    const weapon = WEAPONS["x2-quicksilver-streetsweeper"];
    expect(weapon?.gun).toMatchObject({
      bulletKind: "grenade",
      projectileArt: "generated",
      projectileVisualScale: 1.35,
      arcHeight: 112,
      explode: { radius: 62, damage: 9 },
    });
    expect(GUN_GENERATED_PROJECTILES[weapon?.id ?? ""]).toMatchObject({
      spriteId: "streetsweeper-grenade-shell",
      url: "sprites/vfx-streetsweeper-grenade/part-1.png",
      displayLength: 34,
    });
    expect(PROJECTILE_SPRITES["streetsweeper-grenade-shell"]).toMatchObject({
      width: 1536,
      height: 1024,
      facing: "mirror-upright",
    });
    expect(PROJECTILE_SPRITES["streetsweeper-grenade-explosion"]).toMatchObject({
      width: 1254,
      height: 1254,
    });
    expect(resolveProjectileExplosionVfxRecipe(weapon?.id)).toEqual(
      PROJECTILE_EXPLOSION_VFX_RECIPES["x2-quicksilver-streetsweeper"],
    );
    expect(PROJECTILE_EXPLOSION_VFX_RECIPES["x2-quicksilver-streetsweeper"]).toMatchObject({
      suppressProcedural: true,
      paintedHalo: false,
      paintedTexture: {
        url: "sprites/vfx-streetsweeper-grenade/part-2.png",
        diameterMultiplier: 1,
      },
    });
  });

  it("cycles all three upright tornadoes through three installed frames at deterministic 10 fps", async () => {
    expect(fanTornadoFrameIndexAtTick(10, 0, 0, 3)).toBe(0);
    expect(
      Array.from({ length: 8 }, (_, age) => fanTornadoFrameIndexAtTick(10, 0, age, 3)),
    ).toEqual([0, 0, 1, 1, 2, 2, 0, 0]);
    for (const id of FAN_TORNADO_WEAPON_VFX_IDS) {
      const recipe = FAN_TORNADO_WEAPON_VFX_RECIPES[id];
      expect(recipe.frameRate, id).toBe(10);
      expect(recipe.frames, id).toHaveLength(3);
      expect(new Set(recipe.frames.map((frame) => frame.textureKey)).size, id).toBe(3);
      for (const [index, frame] of recipe.frames.entries()) {
        expect(frame.url, `${id}/frame-${index + 1}`).toBe(
          `sprites/${recipe.subject}/part-${index + 1}.png`,
        );
        const image = await png(`packages/client/public/${frame.url}`);
        expect([image.width, image.height], `${id}/frame-${index + 1}`).toEqual(
          id === "x2-iron-war-fan" ? [839, 1380] : id === "x2-ember-fan" ? [468, 768] : [901, 1444],
        );
      }
    }
  });
});
