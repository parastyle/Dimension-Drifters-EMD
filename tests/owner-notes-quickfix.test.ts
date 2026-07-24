import {
  ACTIVE_WEAPON_CATALOG_IDS,
  ARCHIVED_WEAPON_IDS,
  DROP_POOL,
  rapidThrustExtensionAt,
  WEAPONS,
  weaponHasHandlingTag,
} from "@dd/shared";
import { describe, expect, it } from "vitest";
import { resolveCasterVfxRecipe } from "../packages/client/src/vfx/caster-vfx-recipes.js";
import { PARTICLE_PACKS } from "../packages/client/src/vfx/particle-manifest.js";

const ARCHIVED = ["x2-glimmerdust-prospector-wand", "x2-tumbleweed-flail"] as const;
const PIKES = ["x2-nullspike-pike", "x2-cinderbrand-pike"] as const;

describe("2026-07-24 owner-notes quickfix", () => {
  it("archives exactly the ordered retained definitions out of active and drop pools", () => {
    for (const id of ARCHIVED) {
      expect(WEAPONS[id]?.archived, id).toBe(true);
      expect(ARCHIVED_WEAPON_IDS, id).toContain(id);
      expect(ACTIVE_WEAPON_CATALOG_IDS, id).not.toContain(id);
      expect(DROP_POOL, id).not.toContain(id);
    }
  });

  it("keeps Dustdevil's authored vertical foregrip planted without changing its gun values", () => {
    const riotgun = WEAPONS["x2-dustdevil-riotgun"];
    expect(riotgun?.gun).toMatchObject({
      damage: 4,
      projectileSpeed: 760,
      range: 360,
      fireRate: 0.38,
      pellets: 6,
      spread: 0.32,
      magazine: 8,
    });
    expect(riotgun?.gripPoints?.secondary).toEqual({
      x: 0.8,
      y: 0.78,
      role: "vertical-foregrip",
    });
    expect(weaponHasHandlingTag(riotgun, "pump")).toBe(false);
    expect(riotgun?.tags.handling).toBeUndefined();
  });

  it.each(PIKES)("%s owns three fast intra-attack hits at unchanged nominal DPS", (id) => {
    const weapon = WEAPONS[id];
    const rapid = weapon?.rapidThrust;
    expect(rapid?.impacts).toEqual([0.22, 0.42, 0.62]);
    expect((rapid?.damageMultiplier ?? 0) * (rapid?.impacts.length ?? 0)).toBeCloseTo(1, 12);
    expect(weapon?.damage).toBe(id === "x2-nullspike-pike" ? 11 : 13);
    expect(weapon?.cooldown).toBe(id === "x2-nullspike-pike" ? 0.64 : 0.68);
    for (const impact of rapid?.impacts ?? [])
      expect(rapidThrustExtensionAt(rapid, impact), `${id}@${impact}`).toBeCloseTo(1, 12);
    expect(rapidThrustExtensionAt(rapid, 0.32)).toBeCloseTo(-0.18, 12);
    expect(rapidThrustExtensionAt(rapid, 0.52)).toBeCloseTo(-0.18, 12);
  });

  it("renders Reliquary's unchanged holy scatter authority as a readable particle stream", () => {
    const lantern = WEAPONS["x2-reliquary-lantern-wand"];
    expect(lantern?.scatter).toMatchObject({
      count: 5,
      spread: 0.4,
      speed: 400,
      range: 250,
      damage: 6,
      explode: { radius: 54, damage: 5 },
    });
    expect(lantern?.cooldown).toBe(0.52);
    const recipe = resolveCasterVfxRecipe(lantern);
    expect(recipe?.projectile).toMatchObject({
      particleTreatment: "stream",
      particlePack: "holy-spark",
      particleCount: 4,
    });
    expect(PARTICLE_PACKS["holy-spark"]).toBeDefined();
  });
});
