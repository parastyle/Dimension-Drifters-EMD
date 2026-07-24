import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import {
  ACTIVE_WEAPON_CATALOG_IDS,
  hybridProjectileDamagePerAcceptedBeat,
  WEAPONS,
} from "@dd/shared";
import { describe, expect, it } from "vitest";
import { SPRITES } from "../packages/client/src/sprites/manifest.js";
import { FAN_HYBRID_VFX_RECIPES } from "../packages/client/src/vfx/fan-hybrid-vfx-recipes.js";

const require = createRequire(import.meta.url);
const { PNG } = require("../tools/artkit/node_modules/pngjs") as {
  PNG: {
    sync: {
      read(bytes: Buffer): { width: number; height: number; data: Buffer };
    };
  };
};

const B3_FANS = ["x2-iron-war-fan", "x2-ember-fan", "x2-storm-fan"] as const;
const NATIVE_DIMENSIONS: Readonly<
  Record<(typeof B3_FANS)[number], readonly [number, number]>
> = {
  "x2-iron-war-fan": [247, 256],
  "x2-ember-fan": [256, 215],
  "x2-storm-fan": [384, 224],
};

function visibleAlphaBounds(data: Buffer, width: number, height: number) {
  let visible = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if ((data[(y * width + x) * 4 + 3] ?? 0) <= 16) continue;
      visible++;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return { visible, minX, minY, maxX, maxY };
}

describe("B3 fan projectile-hybrid catalog", () => {
  it("publishes three active 2H fan-forward rows with distinct authoritative signatures", () => {
    expect(new Set(B3_FANS).size).toBe(3);
    const mechanics = new Set<string>();
    const visuals = new Set<string>();
    for (const id of B3_FANS) {
      const weapon = WEAPONS[id];
      expect(weapon, id).toBeDefined();
      expect(weapon?.expansion, id).toBe(true);
      expect(weapon?.archived, id).not.toBe(true);
      expect(ACTIVE_WEAPON_CATALOG_IDS, id).toContain(id);
      expect(weapon?.tags, id).toMatchObject({
        grip: "2H",
        delivery: "melee-hybrid",
        classPool: "melee",
        rangeBand: "close",
      });
      expect(weapon?.twoHanded, id).toBe(true);
      expect(weapon?.poseLanguage, id).toEqual({
        idle: "secondary-grip",
        feet: id === "x2-storm-fan" ? "wide-plant" : "combat-plant",
      });
      expect(weapon?.gripPoints?.secondary?.role, id).toBe("handle");
      expect(weapon?.performance?.hold, id).toBe("aim-forward");
      expect(weapon?.authoritativeCombo, id).toBe(true);
      expect(weapon?.hybridProjectile, id).toBeDefined();
      mechanics.add(JSON.stringify(weapon?.hybridProjectile));
      visuals.add(FAN_HYBRID_VFX_RECIPES[id]?.signature ?? "");
    }
    expect(mechanics.size).toBe(3);
    expect(visuals.size).toBe(3);
  });

  it("pins finisher gust, cinder cone, and 300ms returning arc behavior", () => {
    expect(WEAPONS["x2-iron-war-fan"]?.hybridProjectile).toEqual({
      style: "cutting-gust",
      trigger: "combo-finisher",
      comboLength: 3,
      speed: 760,
      range: 180,
      damage: 12,
      count: 1,
      spread: 0,
      pierce: 1,
    });
    expect(WEAPONS["x2-ember-fan"]?.hybridProjectile).toMatchObject({
      style: "cinder-blade-cone",
      trigger: "each-swing",
      count: 3,
      spread: 0.34,
      damage: 4,
    });
    expect(WEAPONS["x2-storm-fan"]?.hybridProjectile).toMatchObject({
      style: "returning-arc",
      trigger: "each-swing",
      count: 1,
      range: 210,
      damage: 2,
      returnAfterSeconds: 0.3,
    });
  });

  it("holds every fan at approximately 15 melee + 5 projectile = 20 sustained DPS", () => {
    for (const id of B3_FANS) {
      const weapon = WEAPONS[id]!;
      const meleeDps = weapon.damage / weapon.cooldown;
      const projectileDps =
        hybridProjectileDamagePerAcceptedBeat(weapon) / weapon.cooldown;
      expect(meleeDps, `${id} melee`).toBeCloseTo(15, 8);
      expect(projectileDps, `${id} projectile`).toBeCloseTo(5, 8);
      expect(meleeDps + projectileDps, `${id} total`).toBeCloseTo(20, 8);
    }
  });

  it("ships exact native textures with visible alpha bounds and leading-edge muzzles", () => {
    for (const id of B3_FANS) {
      const path = `packages/client/public/sprites/${id}/part-1.png`;
      expect(existsSync(path), id).toBe(true);
      const png = PNG.sync.read(readFileSync(path));
      expect([png.width, png.height], id).toEqual(NATIVE_DIMENSIONS[id]);
      expect(SPRITES[id]?.canvas, id).toEqual({
        w: NATIVE_DIMENSIONS[id][0],
        h: NATIVE_DIMENSIONS[id][1],
      });
      expect(SPRITES[id]?.parts[0], id).toMatchObject({
        file: "part-1.png",
        w: png.width,
        h: png.height,
      });
      const bounds = visibleAlphaBounds(png.data, png.width, png.height);
      expect(bounds.visible, id).toBeGreaterThan(10_000);
      expect(bounds.maxX - bounds.minX, id).toBeGreaterThan(png.width * 0.75);
      expect(bounds.maxY - bounds.minY, id).toBeGreaterThan(png.height * 0.6);
      expect(bounds.visible, id).toBeLessThan(png.width * png.height);
      const muzzle = WEAPONS[id]?.muzzle?.points[0];
      expect(muzzle, id).toBeDefined();
      expect(muzzle?.x, id).toBeGreaterThanOrEqual(png.width - 1);
      expect(muzzle?.y, id).toBeGreaterThanOrEqual(0);
      expect(muzzle?.y, id).toBeLessThan(png.height);
    }
  });

  it("keeps every fan free of standing chain, tassel, or rope language", () => {
    const source = JSON.parse(
      readFileSync("data/weapon-concepts-300.json", "utf8"),
    ) as { weapons: Array<{ id: string; theme?: string; description?: string }> };
    for (const id of B3_FANS) {
      const row = source.weapons.find((weapon) => weapon.id === id);
      expect(row, id).toBeDefined();
      expect(`${row?.theme ?? ""} ${row?.description ?? ""}`, id).not.toMatch(
        /\b(?:chain|tassel|rope|dangling)\b/i,
      );
      expect(row?.theme, id).toContain("static painted ribbon guards");
    }
  });
});
