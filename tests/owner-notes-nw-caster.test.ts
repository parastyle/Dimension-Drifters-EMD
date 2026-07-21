import { readFileSync } from "node:fs";
import { isWornWeapon, WEAPONS, type WeaponDef } from "@dd/shared";
import { describe, expect, it } from "vitest";
import {
  createWeaponPerformanceInput,
  createWeaponPerformanceSample,
  sampleWeaponPerformance,
} from "../packages/client/src/sprites/pose-language.js";
import {
  CASTER_SPRITE_PROJECTILES,
  CASTER_TEXTURE_PROJECTILES,
  CASTER_VFX_PALETTE_OVERRIDES,
  resolveCasterVfxRecipe,
} from "../packages/client/src/vfx/caster-vfx-recipes.js";
import { PARTICLE_PACKS } from "../packages/client/src/vfx/particle-manifest.js";
import {
  resolveWeaponAuraVfxRecipe,
  resolveWeaponEffectRecipe,
} from "../packages/client/src/vfx/weapon-effect-recipes.js";

function weapon(id: string): WeaponDef {
  const definition = WEAPONS[id];
  if (!definition) throw new Error(`Missing NW-CASTER fixture: ${id}`);
  return definition;
}

function performanceSample(
  id: string,
  overrides: Partial<ReturnType<typeof createWeaponPerformanceInput>> = {},
) {
  const definition = weapon(id);
  if (!definition.performance) throw new Error(`Missing NW-CASTER performance: ${id}`);
  const input = createWeaponPerformanceInput();
  Object.assign(input, {
    spec: definition.performance,
    aimLocal: 0,
    phase: "idle",
    phaseT: 0,
    fireHeld: true,
    ...overrides,
  });
  return { ...sampleWeaponPerformance(input, createWeaponPerformanceSample()) };
}

describe("owner-notes NW-CASTER contracts", () => {
  it("keeps Cryo/Saintskull crops and the re-derived shell-free Plague locust explicit", () => {
    expect(Object.keys(CASTER_SPRITE_PROJECTILES).sort()).toEqual([
      "x2-permafrost-cryo-bracer",
      "x2-saintskull-monstrance",
    ]);

    const cryo = resolveCasterVfxRecipe(weapon("x2-permafrost-cryo-bracer"));
    expect(cryo?.spriteProjectile).toMatchObject({
      spriteId: "x2-permafrost-cryo-bracer",
      partRole: "part-1",
      crop: { x: 121, y: 0, width: 135, height: 84 },
      displayLength: 58,
    });

    const locust = resolveCasterVfxRecipe(weapon("x2-locust-glass-plague-orb"));
    expect(locust?.spriteProjectile).toBeUndefined();
    expect(locust?.textureProjectile).toMatchObject({
      textureKey: "caster:plague-locust",
      displayLength: 48,
      flutterRadians: 0.18,
      flutterMs: 230,
    });
    expect(CASTER_TEXTURE_PROJECTILES[locust?.weaponId ?? ""]).toBeDefined();
  });

  it("keeps Galvanic's orbit and Sporebound's BIO aura DPS-neutral and within the retained-art budget", () => {
    const galvanic = weapon("x2-galvanic-liber-of-storms");
    const sporebound = weapon("x2-sporebound-witchglobe");
    expect(galvanic.performance).toMatchObject({
      hold: "steady",
      action: "spin",
      continuous: true,
      suppressSwing: true,
      aura: { radius: 160, damagePerSecond: 14.3, tickRate: 0.2 },
    });
    expect(sporebound.performance).toMatchObject({
      hold: "overhead",
      action: "shake",
      continuous: true,
      suppressSwing: true,
      aura: { radius: 210, damagePerSecond: 12.1, tickRate: 0.2, damageType: "bio" },
    });
    expect(galvanic.performance?.aura?.damagePerSecond).toBeCloseTo(
      galvanic.damage / galvanic.cooldown,
      1,
    );
    expect(sporebound.performance?.aura?.damagePerSecond).toBeCloseTo(
      sporebound.damage / sporebound.cooldown,
      1,
    );

    for (const definition of [galvanic, sporebound]) {
      const aura = resolveWeaponAuraVfxRecipe(definition);
      expect(aura?.count, definition.id).toBeLessThanOrEqual(12);
      for (const pack of aura?.packs ?? []) expect(PARTICLE_PACKS[pack], pack).toBeDefined();
    }
    const spinA = performanceSample(galvanic.id, { timeS: 0.1 });
    const spinB = performanceSample(galvanic.id, { timeS: 0.2 });
    expect(spinA.weaponAngle).not.toBeCloseTo(spinB.weaponAngle, 4);
  });

  it("holds Sporebound overhead and continuously jiggles both active censer streams", () => {
    const spore = performanceSample("x2-sporebound-witchglobe", { timeS: 0.011 });
    expect(spore.handY).toBe(-0.4);
    expect(spore.active).toBe(true);

    for (const id of ["x2-sporebound-witchglobe", "x2-marshlight-bog-censer-wand"]) {
      const definition = weapon(id);
      const sampleA = performanceSample(id, { timeS: 0.011 });
      const sampleB = performanceSample(id, { timeS: 0.029 });
      expect(definition.performance?.action, id).toBe("shake");
      expect(definition.performance?.continuous, id).toBe(true);
      expect(sampleA.offsetY, id).not.toBeCloseTo(sampleB.offsetY, 5);
    }
    expect(weapon("x2-marshlight-bog-censer-wand").performance?.emitter).toBe("spout");
  });

  it("authors Stormfists as a blue, two-hand lunge-punch with a three-fist-length displacement", () => {
    const stormfists = weapon("x2-thunderhead-stormfists");
    expect(stormfists.performance).toMatchObject({
      action: "lunge-punch",
      windupSeconds: 0.3,
      suppressSwing: true,
      lunge: { distancePx: 120 },
    });
    expect(CASTER_VFX_PALETTE_OVERRIDES[stormfists.id]).toEqual({
      core: 0xffffff,
      mid: 0x33e6ff,
      shadow: 0x245b91,
    });
    expect(resolveWeaponEffectRecipe(stormfists)).toMatchObject({
      id: "stormfist-blue-lunge",
      emitter: "body",
      swingPack: "arcane-bolt",
      swingCount: 8,
    });

    const wound = performanceSample(stormfists.id, { phase: "anticipation", phaseT: 1 });
    const strike = performanceSample(stormfists.id, { phase: "active", phaseT: 1 });
    expect(wound.handX).toBeLessThan(0);
    expect(wound.backHandX).toBeLessThan(0);
    expect(strike.handX).toBeGreaterThan(0.4);
    expect(strike.backHandX).toBeGreaterThan(0.4);
    expect(strike.backHandBlend).toBe(1);
  });

  it("tightens Frostknuckle from its weapon tip and turns Voidwell into one arcing purple blast", () => {
    expect(weapon("x2-frostknuckle-rimewrap")).toMatchObject({
      effectEmitter: "tip",
      scatter: { count: 6, spread: 0.28, range: 320 },
    });

    const voidwell = weapon("x2-voidwell-idol");
    expect(voidwell.beam).toBeUndefined();
    expect(voidwell.performance).toMatchObject({
      hold: "shoulder-launcher",
      action: "recoil",
      suppressSwing: true,
    });
    expect(voidwell.gun).toMatchObject({
      damage: 18,
      fireRate: 0.45,
      bulletKind: "grenade",
      muzzle: "boom",
      arcHeight: 112,
      muzzleColor: 0xb14bff,
      explode: { radius: 96, damage: 27 },
    });
    expect(((voidwell.gun?.damage ?? 0) + (voidwell.gun?.explode?.damage ?? 0)) / 0.45).toBe(100);
  });

  it("fires three sprite locusts without multiplying payload and makes Gravewax fire read above visible hands", () => {
    const locust = weapon("x2-locust-glass-plague-orb");
    expect(locust.scatter).toMatchObject({ count: 3, spread: 0.2, range: 360, damage: 1 });
    expect(
      (locust.scatter?.count ?? 0) *
        ((locust.scatter?.damage ?? 0) + (locust.scatter?.explode?.damage ?? 0)),
    ).toBeCloseTo(locust.damage, 8);

    const gravewax = weapon("x2-gravewax-twin-idols");
    expect(gravewax.tags.element).toBe("fire");
    expect(gravewax.renderAboveHands).toBe(true);
    expect(gravewax.gun).toMatchObject({
      bulletKind: "tracer",
      muzzle: "rapid",
      muzzleColor: 0xff862b,
    });
    expect(isWornWeapon(gravewax)).toBe(false);

    const rigSource = readFileSync(
      new URL("../packages/client/src/entities/SpriteRig.ts", import.meta.url),
      "utf8",
    );
    expect(rigSource).toContain("piece?.worn || piece?.def.renderAboveHands");
  });

  it("increases only Spitfire's display scale by fifty percent", () => {
    const spitfire = weapon("x2-spitfire-censer-wand");
    expect(spitfire.displayLength).toBe(90);
    expect(spitfire.displayLength / 60).toBe(1.5);
    expect(spitfire.gun).toMatchObject({ damage: 4, fireRate: 0.1, range: 460 });
  });
});
