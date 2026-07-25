import { existsSync, readFileSync } from "node:fs";
import {
  deriveWeaponResourceProfile,
  projectileWaveformPositionAt,
  WEAPONS,
  type WeaponDef,
  weaponResourceProfile,
} from "@dd/shared";
import { describe, expect, it } from "vitest";
import { sampleProjectileWaveformFromAuthoritative } from "../packages/client/src/scenes/arena/projectile-waveform.js";
import { PROJECTILE_SPRITES } from "../packages/client/src/sprites/projectile-manifest.js";
import { secondaryGripHandRendersAbove } from "../packages/client/src/sprites/secondary-grip.js";
import {
  BEAM_VFX_RECIPES,
  CASTER_TEXTURE_PROJECTILES,
  CASTER_VFX_PALETTE_OVERRIDES,
} from "../packages/client/src/vfx/caster-vfx-recipes.js";
import { GUN_GENERATED_PROJECTILES } from "../packages/client/src/vfx/gun-projectile-art.js";
import {
  resolveWeaponAuraVfxRecipe,
  resolveWeaponEffectRecipe,
} from "../packages/client/src/vfx/weapon-effect-recipes.js";

function weapon(id: string): WeaponDef {
  const value = WEAPONS[id];
  if (!value) throw new Error(`Missing V5R weapon: ${id}`);
  return value;
}

describe("V5R ranged/caster owner orders", () => {
  it("keeps the neutral orders on their old payload/cadence while applying the requested footprints", () => {
    const galvanic = weapon("x2-galvanic-liber-of-storms");
    expect(galvanic.performance?.aura).toMatchObject({ radius: 200, damagePerSecond: 14.3 });
    expect(galvanic.performance?.aura?.damagePerSecond).toBeCloseTo(
      galvanic.damage / galvanic.cooldown,
      1,
    );
    expect(resolveWeaponAuraVfxRecipe(galvanic)).toMatchObject({
      count: 16,
      maxParticlePx: 64,
      particleReferenceMultiplier: 1.4,
    });

    const witchglobe = weapon("x2-sporebound-witchglobe");
    expect(witchglobe.performance?.aura).toMatchObject({ radius: 252, damagePerSecond: 12.1 });
    expect(252 / 210).toBe(1.2);

    const frostbite = weapon("x2-frostbite-snowglobe");
    expect(frostbite.quake).toMatchObject({ radius: 140, damage: 11 });
    expect(frostbite.groundZone).toMatchObject({
      trigger: "impact",
      style: "ice",
      damagePerSecond: 0,
      slowMultiplier: 0.55,
    });

    const graveshot = weapon("x2-graveshot-grenade-gun");
    expect(graveshot.gun).toMatchObject({
      damage: 10,
      fireRate: 0.7,
      bulletKind: "grenade",
      arcHeight: 112,
      explode: { radius: 62, damage: 9 },
    });
    expect(
      ((graveshot.gun?.damage ?? 0) + (graveshot.gun?.explode?.damage ?? 0)) / 0.7,
    ).toBeCloseTo(19 / 0.7, 8);

    expect(weapon("x2-tesla-faradayer").gun).toMatchObject({
      projectileArt: "generated",
      projectileVisualScale: 3.5,
      projectileColor: 0xb14bff,
    });
    expect(weapon("x2-tidehook-bombarpoon").gun?.projectileVisualScale).toBe(1.75);
    expect(1.75 / 1.25).toBe(1.4);
    expect(weapon("x2-mauler-slug-thrower").gun).toMatchObject({
      damage: 16,
      fireRate: 0.82,
      bulletKind: "fire-plume",
      projectileVisualScale: 1.4,
    });
    const projectileFactory = readFileSync(
      "packages/client/src/scenes/arena/projectile-factory.ts",
      "utf8",
    );
    expect(projectileFactory).toContain(
      '"fire-plume": { color: 0xff6a22, size: 31, style: "boom", trail: 46, trailW: 18 }',
    );
  });

  it("documents Howitzer's payload-for-cadence/Drive redistribution with exact economy math", () => {
    const howitzer = weapon("x2-calamity-howitzer");
    if (!howitzer.gun) throw new Error("Howitzer gun block is required");
    expect(howitzer.gun).toMatchObject({
      damage: 22,
      fireRate: 2.2,
      reloadSeconds: 3.4,
      projectileArt: "generated",
      muzzle: "artillery",
      explode: { radius: 150, damage: 32 },
    });
    const oldPayload = 16 + 14;
    const newPayload = howitzer.gun.damage + (howitzer.gun.explode?.damage ?? 0);
    expect(newPayload / oldPayload).toBe(1.8);
    expect(oldPayload / 0.9).toBeCloseTo(33.333333, 5);
    expect(newPayload / howitzer.gun.fireRate).toBeCloseTo(24.545455, 5);

    const old = structuredClone(howitzer);
    if (!old.gun) throw new Error("Cloned Howitzer gun block is required");
    Object.assign(old.gun, { damage: 16, fireRate: 0.9, reloadSeconds: 3 });
    old.gun.explode = { radius: 70, damage: 14 };
    const oldEconomy = deriveWeaponResourceProfile(old);
    const newEconomy = weaponResourceProfile(howitzer.id);
    expect(oldEconomy).toMatchObject({ neutralCost: 18, actionsFromFull: 5 });
    expect(newEconomy).toMatchObject({ neutralCost: 44, actionsFromFull: 2 });

    const recipe = GUN_GENERATED_PROJECTILES[howitzer.id];
    expect(recipe).toMatchObject({
      spriteId: "calamity-howitzer-battleship-shell",
      displayLength: 92,
    });
    expect(PROJECTILE_SPRITES["calamity-howitzer-battleship-shell"]).toMatchObject({
      width: 256,
      height: 87,
      source: "generated",
    });
    expect(
      existsSync("packages/client/public/projectiles/calamity-howitzer-battleship-shell.png"),
    ).toBe(true);
  });

  it("converts Gilded's beam DPS into an ice slow zone and synchronizes Stormcaller's visual curve", () => {
    const gilded = weapon("x2-gilded-hourglass-frost-scepter");
    expect(gilded.beam).toBeUndefined();
    expect(gilded.groundZone).toMatchObject({
      trigger: "channel",
      style: "ice",
      maxRadius: 95,
      placementRange: 640,
      damagePerSecond: 5 / 0.13,
      slowMultiplier: 1 - gilded.damage / 10,
      slowSeconds: 0.3,
    });

    const stormcaller = weapon("x-staff-storm-rod");
    const waveform = stormcaller.cast?.projectileWaveform;
    expect(waveform).toEqual({ amplitudePx: 34, frequencyHz: 4 });
    expect(CASTER_VFX_PALETTE_OVERRIDES[stormcaller.id]).toEqual({
      core: 0xe8fbff,
      mid: 0x4aa8ff,
      shadow: 0x173f91,
    });
    if (!waveform) throw new Error("Stormcaller waveform is required");
    const authoritative = projectileWaveformPositionAt(100, 200, 480, 120, 0.2, waveform);
    const rendered = sampleProjectileWaveformFromAuthoritative(
      { ...authoritative, vx: 480, vy: 120 },
      waveform,
      0.2,
      0.25,
    );
    expect(rendered).toEqual(projectileWaveformPositionAt(100, 200, 480, 120, 0.25, waveform));
  });

  it("binds the remaining presentation orders to explicit recipe and grip data", () => {
    expect(resolveWeaponEffectRecipe(weapon("x2-cinderchoke-brazier-orb"))).toMatchObject({
      id: "cinderchoke-fire-impact",
      classification: "impact",
      impactAnchor: "target",
      impactPack: "fire-splat",
      suppressQuakeVfx: true,
    });
    expect(CASTER_TEXTURE_PROJECTILES["x2-locust-glass-plague-orb"]?.mirrorLeft).toBe(true);

    const idol = weapon("x2-idol-of-the-pale-verdict");
    expect(idol.gripPoints).toEqual({
      primary: { x: 0.22, y: 0.77 },
      secondary: { x: 0.48, y: 0.77, role: "handle" },
    });
    expect(secondaryGripHandRendersAbove(idol.gripPoints?.secondary?.role)).toBe(true);

    expect(BEAM_VFX_RECIPES["x2-permafrost-siege-lobber"]?.conePolish).toEqual({
      sheets: 5,
      ribs: 11,
      meltParticles: 7,
      residuePatches: 5,
    });
  });

  it("keeps Stormfists damage cadence intact while redistributing its committed risk/reach window", () => {
    const stormfists = weapon("x2-thunderhead-stormfists");
    expect(stormfists.performance).toMatchObject({ windupSeconds: 0.3 });
    expect("lunge" in (stormfists.performance ?? {})).toBe(false);
    expect(stormfists.range).toBe(680);
    expect(stormfists.quake?.placementRange).toBe(480);
    expect((stormfists.damage + (stormfists.quake?.damage ?? 0)) / stormfists.cooldown).toBe(17.5);
  });
});
