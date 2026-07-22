import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BEAM_VFX_RECIPES } from "../packages/client/src/vfx/caster-vfx-recipes.js";
import { GUN_GENERATED_PROJECTILES } from "../packages/client/src/vfx/gun-projectile-art.js";
import {
  coneStreamHitsCircle,
  expectedRandomGunPelletCount,
  weaponMuzzleWorldPoint,
  serverSeededGunPelletVolley,
  WEAPONS,
} from "../packages/shared/src/index.js";

const CROSSBOW_LENGTHS = Object.freeze({
  "x2-widowmaker-arbalest": 225,
  "x2-quill-storm-repeater": 165,
  "x2-ghostbolt-crossbow": 216,
  "x2-buckshot-bramble-bow": 174,
  "x2-whisperbarb-hand-crossbow": 99,
});

function projectilePng(path: string): { width: number; height: number; colorType: number } {
  const bytes = readFileSync(path);
  expect(bytes.toString("ascii", 1, 4), path).toBe("PNG");
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    colorType: bytes[25] ?? -1,
  };
}

describe("W4R ranged owner orders", () => {
  it("applies the exact size orders and the complete +50% crossbow-family sweep", () => {
    const concepts = JSON.parse(readFileSync("data/weapon-concepts-300.json", "utf8")) as {
      weapons: Array<{
        id: string;
        type: string;
        name: string;
        family: string;
        theme: string;
        artPrompt: string;
      }>;
    };
    const swept = concepts.weapons
      .filter(
        (weapon) =>
          weapon.type === "ranged" &&
          /crossbow/i.test([weapon.name, weapon.family, weapon.theme, weapon.artPrompt].join(" ")),
      )
      .map((weapon) => weapon.id)
      .sort();
    expect(swept).toEqual(Object.keys(CROSSBOW_LENGTHS).sort());
    for (const [weaponId, displayLength] of Object.entries(CROSSBOW_LENGTHS)) {
      const weapon = WEAPONS[weaponId];
      expect(weapon?.displayLength, weaponId).toBe(displayLength);
      expect(weapon?.gun?.projectileArt, weaponId).toMatch(/^(arrow|generated)$/);
      if (!weapon) throw new Error(`${weaponId} fixture required`);
      expect(weaponMuzzleWorldPoint(weapon, { x: 0, y: 0, aimX: 1, aimY: 0 }).x, weaponId)
        .toBeGreaterThan(displayLength * 0.5);
    }
    expect(WEAPONS["x2-tracer-saint-carbine"]?.displayLength).toBe(150.8);
    expect(WEAPONS["x2-quicksilver-fanner"]?.displayLength).toBe(112);
  });

  it("keeps the fan, buckshot, random-pellet, and cone conversions DPS-neutral", () => {
    const gravel = WEAPONS["x2-gravelthroat-repeater"]?.gun;
    const fanner = WEAPONS["x2-quicksilver-fanner"]?.gun;
    const buckshot = WEAPONS["x2-buckshot-avalanche"]?.gun;
    const frost = WEAPONS["x2-permafrost-siege-lobber"]?.beam;
    const magma = WEAPONS["x2-doomsday-drum-cannon"]?.beam;
    if (!gravel?.randomPellets || !fanner?.pellets || !buckshot?.explode || !frost || !magma)
      throw new Error("W4R damage fixtures are required");
    expect(gravel?.randomPellets).toEqual({ min: 1, max: 10, directions: "radial" });
    expect(expectedRandomGunPelletCount(gravel.randomPellets)).toBe(5.5);
    expect(gravel.damage / gravel.fireRate).toBeCloseTo((4 * 6) / 0.6, 8);
    expect(fanner).toMatchObject({ damage: 1, pellets: 6, spread: 0.22 });
    expect((fanner.damage * fanner.pellets) / fanner.fireRate).toBeCloseTo(6 / 0.12, 8);
    expect(buckshot).toMatchObject({ damage: 9, pellets: 4, projectileVisualScale: 2 });
    expect(((buckshot.damage + buckshot.explode.damage) * 4) / buckshot.fireRate).toBeCloseTo(
      ((4 + 3) * 9) / 0.72,
      8,
    );
    expect(frost.damagePerSecond).toBeCloseTo((10 + 9) / 0.76, 8);
    expect(magma.damagePerSecond).toBeCloseTo((7 + 6) / 0.34, 8);
  });

  it("makes the Gravelthroat roll reproducible, variable, radial, and cap-admitted", () => {
    const rule = WEAPONS["x2-gravelthroat-repeater"]?.gun?.randomPellets;
    if (!rule) throw new Error("Gravelthroat random-pellet rule is required");
    const rolls = Array.from({ length: 64 }, (_, seed) =>
      serverSeededGunPelletVolley(rule, seed + 1),
    );
    expect(new Set(rolls.map((roll) => roll.requestedCount)).size).toBeGreaterThan(4);
    expect(rolls.some((roll) => roll.angles.some((angle) => angle < 0))).toBe(true);
    expect(rolls.some((roll) => roll.angles.some((angle) => angle > 0))).toBe(true);
    expect(serverSeededGunPelletVolley(rule, 0x44aa22)).toEqual(
      serverSeededGunPelletVolley(rule, 0x44aa22),
    );
    const capped = serverSeededGunPelletVolley(rule, 0x44aa22, 3);
    expect(capped.angles).toHaveLength(Math.min(3, capped.requestedCount));
    expect(capped.angles.every((angle) => angle >= -Math.PI && angle < Math.PI)).toBe(true);
  });

  it("installs the requested projectile identities and generated-art registrations", () => {
    expect(WEAPONS["x-gun-ricochet-pistol"]).toMatchObject({
      tags: { element: "shock" },
      gun: { bulletKind: "spark", projectileColor: 0x3f9dff },
      chainLightning: { jumps: 3, range: 190, damage: 3, falloff: 0.75 },
    });
    expect(WEAPONS["x2-tumbleweed-skipper"]?.gun?.projectileColor).toBe(0x3f9dff);
    expect(WEAPONS["x2-tesla-faradayer"]?.gun).toMatchObject({
      bulletKind: "spark",
      projectileColor: 0xb14bff,
    });
    expect(WEAPONS["x2-widowmaker-cannon"]?.gun).toMatchObject({
      projectileArt: "cannonball",
      projectileVisualScale: 4,
    });
    for (const [weaponId, filename] of [
      ["x2-widowmaker-arbalest", "widowmaker-arbalest-arrow.png"],
      ["x2-tidehook-bombarpoon", "tidehook-bombarpoon-harpoon.png"],
      ["x2-hexbore-voidmaw", "hexbore-voidmaw-rune.png"],
    ] as const) {
      expect(WEAPONS[weaponId]?.gun?.projectileArt).toBe("generated");
      expect(GUN_GENERATED_PROJECTILES[weaponId]?.url).toBe(`projectiles/${filename}`);
      const path = `packages/client/public/projectiles/${filename}`;
      expect(existsSync(path), path).toBe(true);
      const png = projectilePng(path);
      if (weaponId !== "x2-hexbore-voidmaw") expect(png.width).toBeGreaterThan(png.height * 2);
      expect(png.colorType).toBe(6);
    }
  });

  it("replaces Hexbore's rejected barrel crop with generated rune art", () => {
    const weaponId = "x2-hexbore-voidmaw";
    expect(WEAPONS[weaponId]?.gun).toMatchObject({
      projectileArt: "generated",
      projectileColor: 0xb14bff,
    });
    expect(GUN_GENERATED_PROJECTILES[weaponId]?.spriteId).toBe("hexbore-voidmaw-rune");
  });

  it("registers both reusable cone streams and retains Mirage's purple double helix", () => {
    expect(WEAPONS["x2-permafrost-siege-lobber"]?.beam?.coneStream).toEqual({
      halfAngle: 0.42,
      flavor: "ice",
    });
    expect(WEAPONS["x2-doomsday-drum-cannon"]?.beam?.coneStream).toEqual({
      halfAngle: 0.48,
      flavor: "magma",
    });
    expect(BEAM_VFX_RECIPES["x2-permafrost-siege-lobber"]?.signature).toBe(
      "permafrost-ice-cone-stream",
    );
    expect(BEAM_VFX_RECIPES["x2-doomsday-drum-cannon"]?.signature).toBe("doomsday-magma-cone-wave");
    expect(BEAM_VFX_RECIPES["x2-mirage-coilrifle"]).toMatchObject({
      signature: "mirage-purple-double-helix",
      ripple: "double-helix",
      accentColor: 0xb14bff,
    });
  });

  it("uses widening cone-sector geometry rather than a fixed-width ray", () => {
    expect(coneStreamHitsCircle({ x: 0, y: 0 }, 0, 400, 0.42, { x: 300, y: 100 }, 8)).toBe(true);
    expect(coneStreamHitsCircle({ x: 0, y: 0 }, 0, 400, 0.42, { x: 300, y: 180 }, 8)).toBe(false);
    expect(coneStreamHitsCircle({ x: 0, y: 0 }, 0, 400, 0.42, { x: 430, y: 0 }, 8)).toBe(false);
  });
});
