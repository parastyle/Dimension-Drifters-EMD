import {
  authoredDualHandForSeq,
  stepBeamAngle,
  WEAPONS,
  weaponArtMuzzlePointsForShot,
} from "@dd/shared";
import { describe, expect, it } from "vitest";
import {
  firingHandTarget,
  firingStanceFor,
  GUN_HEAD_DROP_PX,
  GUN_HEAD_NOD_RAD,
  gunCheekWeldPoseFor,
} from "../packages/client/src/sprites/firing-stance.js";
import { GUN_GENERATED_PROJECTILES } from "../packages/client/src/vfx/gun-projectile-art.js";
import { resolveWeaponEffectRecipe } from "../packages/client/src/vfx/weapon-effect-recipes.js";

function weapon(id: string) {
  const definition = WEAPONS[id];
  if (!definition) throw new Error(`Missing B35 fixture: ${id}`);
  return definition;
}

describe("B35 gun presentation corrections", () => {
  it("applies render-only sizing while preserving collision datums", () => {
    expect(weapon("x2-riftglass-prism-lantern")).toMatchObject({
      displayLength: 46,
      collisionLength: 92,
      beam: { width: 57.6, randomRays: { count: 7 } },
    });
    expect(weapon("x2-iron-vow-bearded-axe")).toMatchObject({
      displayLength: 172.8,
      collisionLength: 128,
    });
    expect(weapon("x2-hexbore-voidmaw")).toMatchObject({
      displayLength: 97.44,
      collisionLength: 112,
      gripPoints: { primary: { x: 0.22, y: 0.62 } },
    });
  });

  it("puts Permafrost's support hand on the center blue gem and revolver hands on handles", () => {
    expect(weapon("x2-permafrost-bardiche").gripPoints).toEqual({
      primary: { x: 0.1, y: 0.52 },
      secondary: { x: 0.54, y: 0.52, role: "shaft" },
    });
    expect(weapon("x2-fool-s-gold-revolver").gripPoints?.primary).toEqual({
      x: 0.22,
      y: 0.66,
    });
  });

  it("locks laser aim instantly and matches Voidgrasp's rendered mouth diameter", () => {
    expect(stepBeamAngle(-2.7, 2.4, 99, 0.001, 0.0001)).toBe(2.4);
    const voidgrasp = weapon("x2-voidgrasp-null-gauntlet");
    expect(voidgrasp.beam?.width).toBe(19);
    expect((voidgrasp.beam!.width * 256) / voidgrasp.displayLength).toBeCloseTo(51.7447, 3);
  });

  it("alternates Voltvein's firing hand and physical muzzle shot by shot", () => {
    const conductors = weapon("x2-voltvein-conductors");
    expect(conductors.dual).toBe(true);
    expect(conductors.muzzle?.salvoMode).toBe("cycle");
    expect([1, 2, 3, 4].map((seq) => authoredDualHandForSeq(seq, 0))).toEqual([0, 1, 0, 1]);
    expect(
      [1, 2, 3, 4].map(
        (seq) => weaponArtMuzzlePointsForShot(conductors.muzzle!, seq)[0]?.part,
      ),
    ).toEqual([0, 1, 0, 1]);
  });

  it("ships the real Cinderbore bullet and discrete magazine-fed Voltcaster laser pulse", () => {
    expect(weapon("x2-cinderbore-longrifle").gun?.projectileArt).toBe("generated");
    expect(GUN_GENERATED_PROJECTILES["x2-cinderbore-longrifle"]).toMatchObject({
      spriteId: "barrett-50cal-round",
      displayLength: 46,
    });
    expect(weapon("x2-voltcaster-machine-pistol")).toMatchObject({
      tags: { fireMode: "semi-auto", delivery: "projectile" },
      gun: {
        bulletKind: "laser",
        projectileSpeed: 4000,
        magazine: 24,
        damage: 6,
        fireRate: 0.08,
      },
    });
    expect(weapon("x2-voltcaster-machine-pistol").beam).toBeUndefined();
  });

  it("ships purple Spectre-Rail chains and very large purple Faradayer blasts", () => {
    expect(weapon("x2-ghostwind-spectre-rail").chainLightning).toMatchObject({
      jumps: 3,
      vfx: { color: 0.9, jag: 0.42, life: 220 },
    });
    expect(weapon("x2-tesla-faradayer").gun).toMatchObject({
      projectileColor: 0xb14bff,
      projectileVisualScale: 3.5,
      projectileArt: "generated",
    });
  });

  it("uses shipped artillery muzzle and fire-splat impact families for Mauler", () => {
    const mauler = weapon("x2-mauler-slug-thrower");
    expect(mauler.gun).toMatchObject({ muzzle: "artillery", muzzleColor: 0xff6a2a });
    expect(resolveWeaponEffectRecipe(mauler)).toMatchObject({
      id: "mauler-fire-impact",
      emitter: "tip",
      impactPack: "fire-splat",
    });
  });

  it("keeps every gun family shouldered with catalog-scaled head drop and nod", () => {
    expect(gunCheekWeldPoseFor(weapon("x2-sunbreaker-railgun"))).toEqual({
      weaponClass: "sightedLong",
      dropPx: GUN_HEAD_DROP_PX.sightedLong,
      nodRad: GUN_HEAD_NOD_RAD.sightedLong,
    });
    expect(gunCheekWeldPoseFor(weapon("x-gun-revolver-cannon"))).toEqual({
      weaponClass: "short",
      dropPx: GUN_HEAD_DROP_PX.short,
      nodRad: GUN_HEAD_NOD_RAD.short,
    });
    expect(GUN_HEAD_DROP_PX.sightedLong).toBe(GUN_HEAD_DROP_PX.short * 2);
    expect(GUN_HEAD_NOD_RAD.sightedLong).toBeGreaterThan(0.08);
    for (const id of [
      "x-gun-revolver-cannon",
      "x2-sunbreaker-railgun",
      "x-gun-coffin-shotgun",
      "x-gun-nailgun",
      "x-gun-hand-mortar",
      "x2-voltvein-conductors",
    ]) {
      const definition = weapon(id);
      const stance = firingStanceFor(definition);
      for (const role of ["lead", "off"] as const) {
        const target = firingHandTarget(definition, role, 0);
        expect(target.y, `${id}:${role}:shoulder`).toBeLessThanOrEqual(-0.14);
        expect(target.y, `${id}:${role}:no-head-clip`).toBeGreaterThan(-0.22);
        expect(target.y, `${id}:${role}:band-min`).toBeGreaterThanOrEqual(stance.yBand[0]);
        expect(target.y, `${id}:${role}:band-max`).toBeLessThanOrEqual(stance.yBand[1]);
      }
    }
  });
});
