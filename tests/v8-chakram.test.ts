import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { CARD_ART_IDS } from "../packages/client/src/sprites/card-manifest.js";
import { SPRITES } from "../packages/client/src/sprites/manifest.js";
import {
  ACTIVE_WEAPON_CATALOG_IDS,
  thrownProjectileKindFor,
  thrownProjectileRotationPolicy,
  thrownProjectileSpriteId,
  WEAPONS,
} from "../packages/shared/src/index.js";

const require = createRequire(import.meta.url);
const { PNG } = require("../tools/artkit/node_modules/pngjs") as {
  PNG: {
    sync: {
      read(bytes: Buffer): { width: number; height: number; data: Buffer };
    };
  };
};

const CHAKRAM_ID = "x2-iron-chakram";

function alphaCounts(relativePath: string): { visible: number; transparent: number } {
  const png = PNG.sync.read(readFileSync(relativePath));
  let visible = 0;
  let transparent = 0;
  for (let offset = 3; offset < png.data.length; offset += 4) {
    if ((png.data[offset] ?? 0) > 64) visible++;
    if (png.data[offset] === 0) transparent++;
  }
  return { visible, transparent };
}

describe("V8 ricocheting iron chakram", () => {
  it("publishes generated card, held sprite, and own-sprite projectile art", () => {
    expect(ACTIVE_WEAPON_CATALOG_IDS).toContain(CHAKRAM_ID);
    expect(CARD_ART_IDS).toContain(CHAKRAM_ID);
    expect(existsSync(`packages/client/public/cards/${CHAKRAM_ID}.jpg`)).toBe(true);
    expect(SPRITES[CHAKRAM_ID]?.kind).toBe("weapon");
    expect(SPRITES[CHAKRAM_ID]?.parts).toHaveLength(1);

    const alpha = alphaCounts(`packages/client/public/sprites/${CHAKRAM_ID}/part-1.png`);
    expect(alpha.visible).toBeGreaterThan(5_000);
    expect(alpha.transparent).toBeGreaterThan(0);
  });

  it("composes the shipped throw-release delivery with two nearby enemy ricochets", () => {
    const weapon = WEAPONS[CHAKRAM_ID];
    if (!weapon) throw new Error("missing V8 iron chakram fixture");

    expect(weapon).toMatchObject({
      damage: 8,
      cooldown: 0.4,
      tags: {
        classPool: "melee",
        delivery: "thrown",
        element: "physical",
        family: "thrown",
      },
      performance: {
        hold: "steady",
        action: "throw-release",
        suppressSwing: true,
        windupSeconds: 0.19,
        preThrowRevolutions: 0.5,
      },
      thrown: {
        speed: 920,
        range: 700,
        damage: 8,
        charges: 4,
        refillSeconds: 1.5,
        pierce: 1,
        rotation: "spin",
        ricochetHops: 2,
        ricochetRange: 360,
      },
    });

    const rawDirectDps = (weapon.thrown?.damage ?? 0) / weapon.cooldown;
    expect(rawDirectDps).toBe(20);
    expect(rawDirectDps).toBeGreaterThanOrEqual(20);
    expect(rawDirectDps).toBeLessThanOrEqual(30);
  });

  it("keeps one stable thrown identity from the release hand through every bounce", () => {
    const weapon = WEAPONS[CHAKRAM_ID];
    if (!weapon) throw new Error("missing V8 iron chakram fixture");

    const kind = thrownProjectileKindFor(weapon);
    expect(kind).toBe(`thrown:${CHAKRAM_ID}`);
    expect(thrownProjectileSpriteId(kind)).toBe(CHAKRAM_ID);
    expect(thrownProjectileRotationPolicy(kind)).toBe("spin");
  });
});
