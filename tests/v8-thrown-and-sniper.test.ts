import { readFileSync } from "node:fs";
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
const { PNG } = require("pngjs") as {
  PNG: {
    sync: {
      read(bytes: Buffer): { width: number; height: number; data: Buffer };
    };
  };
};

const THROWN = [
  { id: "x2-iron-throwing-star", damage: 8, cooldown: 0.32, rotation: "spin" },
  { id: "x2-fire-throwing-star", damage: 10, cooldown: 0.42, rotation: "spin" },
  { id: "x2-ice-throwing-star", damage: 8, cooldown: 0.36, rotation: "spin" },
  { id: "x2-void-throwing-star", damage: 12, cooldown: 0.5, rotation: "spin" },
  { id: "x2-kunai", damage: 9, cooldown: 0.3, rotation: "point-forward" },
] as const;

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

describe("V8 throwing stars, kunai, and plain anti-materiel rifle", () => {
  it("publishes all six generated weapons into the active Training-Grounds catalog", () => {
    const ids = [...THROWN.map(({ id }) => id), "x2-m50-anti-materiel-rifle"];
    for (const id of ids) {
      expect(ACTIVE_WEAPON_CATALOG_IDS, id).toContain(id);
      expect(CARD_ART_IDS, `${id}: generated card`).toContain(id);
      expect(SPRITES[id]?.parts, `${id}: generated held art`).toHaveLength(1);
      const alpha = alphaCounts(`packages/client/public/sprites/${id}/part-1.png`);
      expect(alpha.visible, `${id}: visible generated pixels`).toBeGreaterThan(120);
      expect(alpha.transparent, `${id}: transparent background`).toBeGreaterThan(0);
    }
  });

  it("keeps the five thrown weapons in their authored sane raw-DPS band and own-sprite delivery", () => {
    for (const expected of THROWN) {
      const weapon = WEAPONS[expected.id];
      if (!weapon) throw new Error(`missing V8 thrown fixture: ${expected.id}`);
      expect(weapon).toMatchObject({
        cooldown: expected.cooldown,
        tags: { delivery: "thrown", family: "thrown" },
        performance: {
          hold: "steady",
          action: "throw-release",
          suppressSwing: true,
          preThrowRevolutions: 0.5,
        },
        thrown: { damage: expected.damage, rotation: expected.rotation },
      });
      const rawDps = expected.damage / expected.cooldown;
      expect(rawDps, `${expected.id}: raw DPS floor`).toBeGreaterThanOrEqual(20);
      expect(rawDps, `${expected.id}: raw DPS ceiling`).toBeLessThanOrEqual(30);
      const kind = thrownProjectileKindFor(weapon);
      expect(kind).toBe(`thrown:${expected.id}`);
      expect(thrownProjectileSpriteId(kind)).toBe(expected.id);
      expect(thrownProjectileRotationPolicy(kind)).toBe(expected.rotation);
    }
  });

  it("keeps the M-50 distinct from the retained Barrett and in the plain bolt-sniper DPS band", () => {
    const m50 = WEAPONS["x2-m50-anti-materiel-rifle"];
    const barrett = WEAPONS["x2-barrett-50-cal-sniper"];
    expect(m50).toBeDefined();
    expect(barrett).toBeDefined();
    expect(m50?.id).not.toBe(barrett?.id);
    expect(m50?.name).toBe("M-50 Anti-Materiel Rifle");
    expect(m50?.description.toLowerCase()).toContain("clean modern");
    expect(m50).toMatchObject({
      cooldown: 1.05,
      tags: { family: "marksman-rifle", handling: ["bolt"], element: "physical" },
      gripPoints: { secondary: { role: "bolt" } },
      gun: { damage: 32, fireRate: 1.05, magazine: 5, projectileArt: "generated" },
    });
    expect((m50?.gun?.damage ?? 0) / (m50?.gun?.fireRate ?? 1)).toBeCloseTo(30.476, 2);
    expect((m50?.gun?.damage ?? 0) / (m50?.gun?.fireRate ?? 1)).toBeLessThanOrEqual(31);
  });
});
