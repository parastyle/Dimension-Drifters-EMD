import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { ACTIVE_WEAPON_CATALOG_IDS, WEAPONS } from "@dd/shared";
import { describe, expect, it } from "vitest";
import { SPRITES } from "../packages/client/src/sprites/manifest.js";

import { WACKY_WEAPON_VFX_RECIPES } from "../packages/client/src/vfx/wacky-weapon-vfx-recipes.js";

const require = createRequire(import.meta.url);
const { PNG } = require("../tools/artkit/node_modules/pngjs") as {
  PNG: {
    sync: {
      read(bytes: Buffer): { width: number; height: number; data: Buffer };
    };
  };
};

const B2 = [
  "x2-unicorn-rainbow-beam",
  "x2-fish-launcher",
  "x2-squeaky-mallet",
  "x2-exploding-present-lobber",
  "x2-bubble-wand-swarm-caster",
  "x2-boomerang-boot",
  "x2-confetti-cannon",
] as const;

const NATIVE_DIMENSIONS: Readonly<Record<(typeof B2)[number], readonly [number, number]>> = {
  "x2-unicorn-rainbow-beam": [384, 217],
  "x2-fish-launcher": [768, 218],
  "x2-squeaky-mallet": [384, 241],
  "x2-exploding-present-lobber": [512, 224],
  "x2-bubble-wand-swarm-caster": [300, 221],
  "x2-boomerang-boot": [246, 256],
  "x2-confetti-cannon": [1380, 693],
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

function mechanicalSignature(id: (typeof B2)[number]): string {
  const weapon = WEAPONS[id]!;
  return JSON.stringify({
    delivery: weapon.tags.delivery,
    beam: weapon.beam,
    gun: weapon.gun,
    quake: weapon.quake,
    cast: weapon.cast,
    thrown: weapon.thrown,
    cooldown: weapon.cooldown,
    range: weapon.range,
  });
}

describe("B2 wacky expansion catalog", () => {
  it("keeps seven durable expansion rows while B28 archives the Boomerang Boot", () => {
    expect(new Set(B2).size).toBe(7);
    for (const id of B2) {
      const weapon = WEAPONS[id];
      expect(weapon, id).toBeDefined();
      expect(weapon?.expansion, id).toBe(true);
      if (id === "x2-boomerang-boot") {
        expect(weapon?.archived, id).toBe(true);
        expect(ACTIVE_WEAPON_CATALOG_IDS, id).not.toContain(id);
      } else {
        expect(weapon?.archived, id).not.toBe(true);
        expect(ACTIVE_WEAPON_CATALOG_IDS, id).toContain(id);
      }
      expect(weapon?.tags.grip, id).toMatch(/^(?:1H|2H)$/);
      expect(weapon?.tags.size, id).toMatch(/^(?:M|L|XL)$/);
      expect(weapon?.tags.rangeBand, id).toMatch(/^(?:close|mid|long)$/);
      expect(weapon, id).not.toHaveProperty("scalingGrades");
      expect(weapon, id).not.toHaveProperty("requirements");
      expect(WACKY_WEAPON_VFX_RECIPES[id], id).toBeDefined();
    }
    expect(new Set(B2.map(mechanicalSignature)).size).toBe(7);
    expect(new Set(B2.map((id) => WACKY_WEAPON_VFX_RECIPES[id]!.signature)).size).toBe(7);
    expect(
      new Set(
        B2.map(
          (id) => `${mechanicalSignature(id)}:${WACKY_WEAPON_VFX_RECIPES[id]!.signature}`,
        ),
      ).size,
    ).toBe(7);
  });

  it("pins each ledger mechanic and its nominal damage cadence", () => {
    expect(WEAPONS["x2-unicorn-rainbow-beam"]?.beam).toMatchObject({
      damagePerSecond: 20,
      tickRate: 0.1,
      range: 520,
      width: 64,
    });
    expect(WEAPONS["x2-fish-launcher"]?.gun).toMatchObject({
      damage: 5,
      pellets: 4,
      spread: 0.36,
    });
    expect(WEAPONS["x2-squeaky-mallet"]).toMatchObject({
      damage: 15,
      cooldown: 1.5,
      swingStyle: "chop",
      quake: { radius: 90, damage: 7.5 },
    });
    expect(WEAPONS["x2-exploding-present-lobber"]?.gun).toMatchObject({
      bulletKind: "grenade",
      arcHeight: 120,
      explode: { radius: 58, damage: 11 },
    });
    expect(WEAPONS["x2-bubble-wand-swarm-caster"]?.cast).toMatchObject({
      damage: 16,
      volley: { count: 5, spread: 0.2 },
      projectileWaveform: { amplitudePx: 20, frequencyHz: 1.4 },
      explode: { radius: 36, damage: 4 },
    });
    expect(WEAPONS["x2-boomerang-boot"]?.thrown).toMatchObject({
      rotation: "spin",
      returning: true,
    });
    expect(WEAPONS["x2-confetti-cannon"]?.gun).toMatchObject({
      damage: 3,
      pellets: 7,
      spread: 0.55,
      recoil: 0.005,
      userKnockbackMultiplier: 2.2,
    });

    const dps = {
      unicorn: WEAPONS["x2-unicorn-rainbow-beam"]!.beam!.damagePerSecond,
      fish: (5 * 4) / 0.9,
      mallet: (15 + 7.5) / 1.5,
      present: (8 + 11) / 0.9,
      bubble: (16 + 4) / 0.9,
      boot: (10 * 3) / 1.8,
      confetti: (3 * 7) / 0.9,
    };
    expect(dps.mallet).toBe(15);
    for (const [name, value] of Object.entries(dps)) {
      expect(value, name).toBeGreaterThanOrEqual(15);
      expect(value, name).toBeLessThanOrEqual(24);
    }
  });

  it("ships native-size manifest textures with transparent pixels and visible alpha bounds", () => {
    for (const id of B2) {
      const path = `packages/client/public/sprites/${id}/part-1.png`;
      expect(existsSync(path), id).toBe(true);
      const png = PNG.sync.read(readFileSync(path));
      expect([png.width, png.height], id).toEqual(NATIVE_DIMENSIONS[id]);
      const manifest = SPRITES[id];
      expect(manifest?.canvas, id).toEqual({
        w: NATIVE_DIMENSIONS[id][0],
        h: NATIVE_DIMENSIONS[id][1],
      });
      expect(manifest?.parts[0], id).toMatchObject({
        file: "part-1.png",
        w: png.width,
        h: png.height,
      });
      const bounds = visibleAlphaBounds(png.data, png.width, png.height);
      expect(bounds.visible, id).toBeGreaterThan(10_000);
      expect(bounds.maxX - bounds.minX, id).toBeGreaterThan(png.width * 0.45);
      expect(bounds.maxY - bounds.minY, id).toBeGreaterThan(png.height * 0.35);
      expect(bounds.visible, id).toBeLessThan(png.width * png.height);
    }
  });

  it("anchors every launched B2 payload at the painted right-side business end", () => {
    for (const id of [
      "x2-unicorn-rainbow-beam",
      "x2-fish-launcher",
      "x2-exploding-present-lobber",
      "x2-bubble-wand-swarm-caster",
      "x2-confetti-cannon",
    ] as const) {
      const weapon = WEAPONS[id]!;
      const [width, height] = NATIVE_DIMENSIONS[id];
      const point = weapon.muzzle?.points[0];
      expect(point, id).toBeDefined();
      expect(point!.x, id).toBeGreaterThanOrEqual(width * 0.99);
      expect(point!.y, id).toBeGreaterThanOrEqual(0);
      expect(point!.y, id).toBeLessThan(height);
    }
    expect(WEAPONS["x2-squeaky-mallet"]?.muzzle).toBeUndefined();
    expect(WEAPONS["x2-boomerang-boot"]?.muzzle).toBeUndefined();
  });
});
