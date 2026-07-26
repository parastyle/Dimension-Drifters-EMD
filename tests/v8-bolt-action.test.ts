import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { CARD_ART_IDS } from "../packages/client/src/sprites/card-manifest.js";
import { SPRITES } from "../packages/client/src/sprites/manifest.js";
import { PROJECTILE_SPRITES } from "../packages/client/src/sprites/projectile-manifest.js";
import { GUN_GENERATED_PROJECTILES } from "../packages/client/src/vfx/gun-projectile-art.js";
import { WEAPONS, weaponHasHandlingTag } from "../packages/shared/src/index.js";

const require = createRequire(import.meta.url);
const { PNG } = require("pngjs") as {
  PNG: {
    sync: {
      read(bytes: Buffer): { width: number; height: number; data: Buffer };
    };
  };
};

const BOLT_IDS = [
  "x2-barrett-50-cal-sniper",
  "x2-buzzard-s-eye-marksman",
  "x2-m50-anti-materiel-rifle",
  "x2-mauler-slug-thrower",
  "x2-pale-horse-longgun",
  "x2-tracer-saint-carbine",
  "x2-varmint-bolt-223",
] as const;

describe("V8 Wave B bolt-action owner order", () => {
  it("ships the exact documented bolt census through one normalized mechanism", () => {
    const actual = Object.values(WEAPONS)
      .filter((weapon) => weaponHasHandlingTag(weapon, "bolt"))
      .map((weapon) => weapon.id)
      .sort();
    expect(actual).toEqual([...BOLT_IDS].sort());
    for (const id of BOLT_IDS) {
      const weapon = WEAPONS[id];
      expect(weapon?.gun, id).toBeDefined();
      expect(weapon?.gripPoints?.primary, `${id}: primary`).toBeDefined();
      expect(weapon?.gripPoints?.secondary?.role, `${id}: support`).toBe("bolt");
    }
  });

  it("preserves the four existing bolt guns' authored server fire law", () => {
    expect(WEAPONS["x2-buzzard-s-eye-marksman"]?.gun).toMatchObject({
      damage: 16,
      fireRate: 0.6,
      burst: { count: 4, intervalSeconds: 0.05 },
    });
    expect(WEAPONS["x2-tracer-saint-carbine"]?.gun).toMatchObject({
      damage: 8,
      fireRate: 0.18,
      magazine: 15,
    });
    expect(WEAPONS["x2-pale-horse-longgun"]?.gun).toMatchObject({
      damage: 14,
      fireRate: 0.56,
      magazine: 5,
    });
    expect(WEAPONS["x2-mauler-slug-thrower"]?.gun).toMatchObject({
      damage: 16,
      fireRate: 0.82,
      magazine: 4,
    });
  });

  it("ships the Barrett's complete generated weapon/card/projectile pipeline", () => {
    const id = "x2-barrett-50-cal-sniper";
    const weapon = WEAPONS[id];
    expect(weapon).toMatchObject({
      name: "Barrett .50-Cal Sniper",
      tags: { family: "marksman-rifle", grip: "2H", size: "XL", fireMode: "tap-charge" },
      displayLength: 198,
      gun: {
        damage: 34,
        projectileSpeed: 2100,
        range: 1100,
        fireRate: 1.15,
        pierce: 5,
        magazine: 5,
        reloadSeconds: 2.8,
        bulletKind: "slug",
        projectileArt: "generated",
        sonicBoomRing: true,
      },
    });
    expect(weapon?.muzzle?.points).toHaveLength(1);
    expect(weapon?.muzzle?.points[0]?.part).toBe(0);
    expect(SPRITES[id]?.parts).toHaveLength(1);
    expect(CARD_ART_IDS).toContain(id);

    const recipe = GUN_GENERATED_PROJECTILES[id];
    const projectile = PROJECTILE_SPRITES["barrett-50cal-round"];
    expect(recipe).toMatchObject({
      spriteId: "barrett-50cal-round",
      url: projectile.url,
      displayLength: 54,
    });
    expect(projectile.source).toBe("generated");
    const png = PNG.sync.read(readFileSync(`packages/client/public/${projectile.url}`));
    expect({ width: png.width, height: png.height }).toEqual({
      width: projectile.width,
      height: projectile.height,
    });
    let visible = 0;
    let transparent = 0;
    for (let offset = 3; offset < png.data.length; offset += 4) {
      if ((png.data[offset] ?? 0) > 64) visible++;
      if (png.data[offset] === 0) transparent++;
    }
    expect(visible).toBeGreaterThan(180);
    expect(transparent).toBeGreaterThan(0);
  });

  it("ships the plain M-50 through the same generated bolt-rifle pipeline", () => {
    const id = "x2-m50-anti-materiel-rifle";
    const weapon = WEAPONS[id];
    expect(weapon).toMatchObject({
      name: "M-50 Anti-Materiel Rifle",
      tags: {
        family: "marksman-rifle",
        grip: "2H",
        size: "XL",
        fireMode: "tap-charge",
        element: "physical",
        handling: ["bolt"],
      },
      displayLength: 202,
      gripPoints: { secondary: { role: "bolt" } },
      gun: {
        damage: 32,
        projectileSpeed: 2200,
        range: 1100,
        fireRate: 1.05,
        pierce: 4,
        magazine: 5,
        reloadSeconds: 2.6,
        bulletKind: "slug",
        projectileArt: "generated",
        sonicBoomRing: true,
      },
    });
    expect(weapon?.description.toLowerCase()).toContain("modern");
    expect(weapon?.muzzle?.points).toHaveLength(1);
    expect(weapon?.muzzle?.points[0]?.part).toBe(0);
    expect(SPRITES[id]?.parts).toHaveLength(1);
    expect(CARD_ART_IDS).toContain(id);

    const recipe = GUN_GENERATED_PROJECTILES[id];
    const projectile = PROJECTILE_SPRITES["m50-50cal-round"];
    expect(recipe).toMatchObject({
      spriteId: "m50-50cal-round",
      url: projectile.url,
      displayLength: 54,
    });
    expect(projectile.source).toBe("generated");
    const png = PNG.sync.read(readFileSync(`packages/client/public/${projectile.url}`));
    expect({ width: png.width, height: png.height }).toEqual({
      width: projectile.width,
      height: projectile.height,
    });
    let visible = 0;
    let transparent = 0;
    for (let offset = 3; offset < png.data.length; offset += 4) {
      if ((png.data[offset] ?? 0) > 64) visible++;
      if (png.data[offset] === 0) transparent++;
    }
    expect(visible).toBeGreaterThan(180);
    expect(transparent).toBeGreaterThan(0);
  });

  it("keeps Sidewinder dual, lever-tagged, and on its authored authoritative cadence", () => {
    const sidewinder = WEAPONS["x2-sidewinder-twin-rifles"];
    expect(sidewinder).toMatchObject({
      dual: true,
      tags: { handling: ["lever"] },
      gripPoints: { secondary: { role: "lever" } },
      gun: { damage: 6, fireRate: 0.14, magazine: 16 },
    });
  });
});
