import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import {
  chargedProjectileSnapshot,
  WEAPONS,
  type ChargedProjectileDef,
} from "@dd/shared";
import { describe, expect, it } from "vitest";
import { SPRITES } from "../packages/client/src/sprites/manifest.js";
import { WEAPON_ART_MUZZLES } from "../packages/shared/src/weapon-muzzles.generated.js";

const require = createRequire(import.meta.url);
const { PNG } = require("pngjs") as {
  PNG: {
    sync: {
      read(bytes: Buffer): { width: number; height: number; data: Buffer };
    };
  };
};

const ID = "x2-rimechoir-chime-rack";

function charge(): ChargedProjectileDef {
  const definition = WEAPONS[ID]?.chargedProjectile;
  if (!definition) throw new Error("Rimechoir charged projectile is missing");
  return definition;
}

function alphaBounds(path: string) {
  const png = PNG.sync.read(readFileSync(path));
  let minX = png.width;
  let minY = png.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      if ((png.data[(y * png.width + x) * 4 + 3] ?? 0) <= 16) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  const cornerAlpha = [
    png.data[3],
    png.data[(png.width - 1) * 4 + 3],
    png.data[(png.height - 1) * png.width * 4 + 3],
    png.data[(png.width * png.height - 1) * 4 + 3],
  ];
  return { ...png, minX, minY, maxX, maxY, cornerAlpha };
}

describe("B66 Rimechoir Chime-Rack", () => {
  it("owns a planted hold-to-charge long-line lane with weak quick releases", () => {
    const weapon = WEAPONS[ID];
    expect(weapon).toMatchObject({
      name: "Rimechoir Chime-Rack",
      cooldown: 0.85,
      tags: {
        classPool: "caster",
        delivery: "projectile",
        fireMode: "hold",
        family: "resonator",
        element: "frost",
        rangeBand: "long",
      },
      performance: {
        hold: "aim-forward",
        action: "hold",
        suppressSwing: true,
      },
    });
    expect(weapon?.gun).toBeUndefined();
    expect(weapon?.beam).toBeUndefined();
    expect(weapon?.recoil ?? 0).toBe(0);
    expect(weapon?.performance?.aura).toBeUndefined();

    expect(charge()).toEqual({
      chargeSeconds: 1.25,
      speed: 620,
      range: 760,
      directDamageMin: 4,
      directDamageMax: 24,
      explosionDamageMin: 0,
      explosionDamageMax: 0,
      explosionRadiusMin: 16,
      explosionRadiusMax: 16,
      visualScaleMin: 0.55,
      visualScaleMax: 1.55,
      scaleExponent: 2,
      baseRadius: 18,
      sprite: "projectiles/rimechoir-chime-rack-pressure-wedge.png",
    });
    expect(chargedProjectileSnapshot(charge(), 0)).toEqual({
      fraction: 0,
      directDamage: 4,
      explosionDamage: 0,
      explosionRadius: 16,
      visualScale: 0.55,
    });
    expect(chargedProjectileSnapshot(charge(), 1)).toEqual({
      fraction: 1,
      directDamage: 24,
      explosionDamage: 0,
      explosionRadius: 16,
      visualScale: 1.55,
    });

    const quickReleaseDps = 4 / 0.85;
    const fullChargeDps = 24 / (1.25 + 0.85);
    expect(fullChargeDps / quickReleaseDps).toBeGreaterThan(2);
  });

  it("ships one manifest-backed held sprite and a readable alpha projectile", () => {
    expect(SPRITES[ID]).toMatchObject({
      kind: "weapon",
      body: { w: 256, h: 111 },
      parts: [{ role: "part-1", file: "part-1.png", w: 256, h: 111 }],
    });
    expect(WEAPON_ART_MUZZLES[ID]?.points).toEqual([
      expect.objectContaining({ part: 0, x: 252, y: 42 }),
    ]);

    const held = alphaBounds("packages/client/public/sprites/x2-rimechoir-chime-rack/part-1.png");
    const projectile = alphaBounds(
      "packages/client/public/projectiles/rimechoir-chime-rack-pressure-wedge.png",
    );
    expect(held).toMatchObject({ width: 256, height: 111, cornerAlpha: [0, 0, 0, 0] });
    expect(projectile).toMatchObject({
      width: 200,
      height: 118,
      cornerAlpha: [0, 0, 0, 0],
    });
    expect((projectile.maxX - projectile.minX) / (projectile.maxY - projectile.minY)).toBeGreaterThan(
      1.7,
    );
  });

  it("routes the painted wedge through a matching charged capsule and no gun flash", () => {
    const server = readFileSync("packages/server/src/rooms/room/room-combat.ts", "utf8");
    const client = readFileSync("packages/client/src/scenes/ArenaScene.ts", "utf8");
    expect(server).toContain('rimechoir ? "rimechoir-pressure-wedge" : "emberleaf-fireball"');
    expect(server).toContain("halfLength: rimechoir ? radius * 1.5 : 0");
    expect(client).toContain('pr.kind === "rimechoir-pressure-wedge"');
    expect(client).toContain("spawnCasterSourceAtRig(sourceWeapon, sourceRig");
  });
});
