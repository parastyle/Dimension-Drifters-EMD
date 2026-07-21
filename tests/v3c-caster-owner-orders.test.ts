import { readFileSync } from "node:fs";
import {
  CAST_VOLLEY_PROJECTILE_CAP,
  meleeComboSelectionFor,
  WEAPONS,
  weaponEffectEmitterFor,
  type WeaponDef,
} from "@dd/shared";
import { describe, expect, it } from "vitest";
import {
  continuousWhirlPhase,
  createWeaponPerformanceInput,
  createWeaponPerformanceSample,
  sampleWeaponPerformance,
} from "../packages/client/src/sprites/pose-language.js";
import { tomeOpenRotationForAim } from "../packages/client/src/sprites/tome-open-art.js";
import {
  resolveWeaponAuraVfxRecipe,
  resolveWeaponEffectRecipe,
  shouldSpawnLegacyQuakeVfx,
} from "../packages/client/src/vfx/weapon-effect-recipes.js";

function weapon(id: string): WeaponDef {
  const definition = WEAPONS[id];
  if (!definition) throw new Error(`Missing V3C fixture: ${id}`);
  return definition;
}

function sample(
  definition: WeaponDef,
  overrides: Partial<ReturnType<typeof createWeaponPerformanceInput>>,
) {
  if (!definition.performance) throw new Error(`Missing V3C performance: ${definition.id}`);
  const input = createWeaponPerformanceInput();
  Object.assign(input, { spec: definition.performance, aimLocal: 0, ...overrides });
  return { ...sampleWeaponPerformance(input, createWeaponPerformanceSample()) };
}

function angleDistance(a: number, b: number): number {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}

describe("owner-notes V3C caster orders", () => {
  it("aims Hexbloom's painted open fore-edge at the projectile for both facings", () => {
    const id = "x2-hexbloom-scattergrimoire";
    for (const facing of [1, -1] as const) {
      const worldAim = 0.71;
      const localAim = Math.atan2(Math.sin(worldAim), Math.cos(worldAim) * facing);
      const rotation = tomeOpenRotationForAim(id, localAim);
      const paintedOpeningAfterRotation = rotation - Math.PI / 2;
      const worldOpening = Math.atan2(
        Math.sin(paintedOpeningAfterRotation),
        Math.cos(paintedOpeningAfterRotation) * facing,
      );
      expect(angleDistance(worldOpening, worldAim), `facing ${facing}`).toBeLessThan(1e-10);
    }
  });

  it("routes Galvanic through the continuous Garen whirl and adds real shock-cloud art", () => {
    const definition = weapon("x2-galvanic-liber-of-storms");
    expect(definition.performance?.twirl).toEqual({
      plane: "ground-whirlwind",
      pivot: "grip",
      direction: "forward",
    });
    expect(continuousWhirlPhase(definition.performance, true, false, 0.35, 0.7)).toBeCloseTo(
      0.5,
      8,
    );
    const aura = resolveWeaponAuraVfxRecipe(definition);
    expect(aura).toMatchObject({
      packs: ["shock-wisp", "shock-splat", "shock-bolt"],
      count: 12,
    });
    expect(definition.performance?.aura?.damagePerSecond).toBeCloseTo(
      definition.damage / definition.cooldown,
      1,
    );
  });

  it("keeps Coffin-Nail hanging at rest but yields to a real attack swing", () => {
    const definition = weapon("x2-coffin-nail-rosary-orb");
    const idle = sample(definition, { phase: "idle", phaseT: 0 });
    const attack = sample(definition, { phase: "anticipation", phaseT: 0.5 });
    expect(definition.performance).toEqual({ hold: "hanging-chain", action: "default-swing" });
    expect(idle.active).toBe(true);
    expect(idle.weaponAngle).toBeCloseTo(Math.PI / 2, 8);
    expect(attack.active).toBe(false);
  });

  it("mirrors Sparkknuckle's alternating monk-fist combo and tiny sparks on Coyote", () => {
    const coyote = weapon("x2-coyote-trickster-s-sparkmitt");
    const sparkknuckle = weapon("x2-sparkknuckle-hex-mitt");
    const coyoteCombo = meleeComboSelectionFor(coyote);
    const sparkCombo = meleeComboSelectionFor(sparkknuckle);
    const signature = (step: NonNullable<typeof coyoteCombo>["sequence"][number]) => ({
      motion: step.motion,
      direction: step.direction,
      hand: step.hand,
      timing: step.timing,
      path: step.path,
    });
    expect(coyoteCombo?.sequence.map(signature)).toEqual(sparkCombo?.sequence.map(signature));
    const coyoteSparks = resolveWeaponAuraVfxRecipe(coyote);
    const sparkSparks = resolveWeaponAuraVfxRecipe(sparkknuckle);
    expect(coyoteSparks && { ...coyoteSparks, weaponId: undefined }).toEqual(
      sparkSparks && { ...sparkSparks, weaponId: undefined },
    );
    expect(coyoteSparks).toMatchObject({
      packs: ["shock-spark"],
      count: 4,
      particleDominance: 0.3,
    });
  });

  it("vibrates Witherleaf through the shake idiom and emits spores at the tip", () => {
    const definition = weapon("x2-witherleaf-bestiary");
    const a = sample(definition, { fireHeld: true, timeS: 0.011 });
    const b = sample(definition, { fireHeld: true, timeS: 0.029 });
    expect(definition.performance).toMatchObject({
      action: "shake",
      suppressSwing: true,
      emitter: "spout",
    });
    expect(a.offsetY).not.toBeCloseTo(b.offsetY, 5);
    expect(weaponEffectEmitterFor(definition)).toBe("tip");
    expect(resolveWeaponEffectRecipe(definition)).toMatchObject({
      id: "witherleaf-tip-spores",
      swingPack: "toxic-wisp",
    });
  });

  it("twirls Hailshard as a held channel while retaining its bounded five-shard payload", () => {
    const definition = weapon("x2-hailshard-resonator");
    const a = sample(definition, { fireHeld: true, timeS: 0.1 });
    const b = sample(definition, { fireHeld: true, timeS: 0.2 });
    expect(definition.performance).toMatchObject({ action: "spin", continuous: true });
    expect(a.weaponAngle).not.toBeCloseTo(b.weaponAngle, 4);
    expect(definition.scatter).toMatchObject({ count: 5, aim: "radial-random" });
  });

  it("splits Arcanist's Lance into three capped bolts without multiplying DPS", () => {
    const cast = weapon("x-staff-arcane-lance").cast;
    expect(cast?.volley).toEqual({ count: 3, spread: 0.16 });
    expect(cast?.volley?.count).toBeLessThanOrEqual(CAST_VOLLEY_PROJECTILE_CAP);
    expect((cast?.damage ?? 0) / (cast?.cooldown ?? 1)).toBeCloseTo(16 / 0.62, 10);
    expect((cast?.damage ?? 0) / (cast?.volley?.count ?? 1)).toBeCloseTo(16 / 3, 10);
  });

  it("adds tiny green attack sparks to Snakeoil's actual spout tip", () => {
    const definition = weapon("x2-snakeoil-tincture-scepter");
    expect(definition.performance?.emitter).toBe("spout");
    expect(weaponEffectEmitterFor(definition)).toBe("tip");
    expect(resolveWeaponEffectRecipe(definition)).toMatchObject({
      id: "snakeoil-tip-sparks",
      swingPack: "toxic-spark",
      swingCount: 5,
      swingScaleMultiplier: 0.36,
    });
  });

  it("doubles Carrion Roost Necro-Scepter's held display size", () => {
    expect(weapon("x2-carrion-roost-necro-scepter").displayLength).toBe(92 * 2);
  });

  it("widens Sporebound's server radius while scaling its painted aura up", () => {
    const definition = weapon("x2-sporebound-witchglobe");
    expect(definition.performance?.aura).toMatchObject({
      radius: 210,
      damagePerSecond: 12.1,
      damageType: "bio",
    });
    expect(resolveWeaponAuraVfxRecipe(definition)).toMatchObject({
      particleDominance: 0.42,
      extent: 1,
    });
    expect(definition.performance?.aura?.damagePerSecond).toBeCloseTo(
      definition.damage / definition.cooldown,
      1,
    );
  });

  it("moves Cairn farther forward and replaces its quake with a purple explosion", () => {
    const definition = weapon("x2-cairn-of-hollow-names");
    expect(definition.performance?.carryForwardPx).toBe(54);
    expect(resolveWeaponEffectRecipe(definition)).toMatchObject({
      id: "void-caster-explosion",
      quakeExplosionElement: "void",
    });
    expect(shouldSpawnLegacyQuakeVfx(definition)).toBe(false);
  });

  it("replaces Vagrant's quake presentation with the shared purple explosion", () => {
    const definition = weapon("x2-vagrant-s-wishing-marble");
    expect(resolveWeaponEffectRecipe(definition)).toMatchObject({
      id: "void-caster-explosion",
      quakeExplosionElement: "void",
    });
    expect(shouldSpawnLegacyQuakeVfx(definition)).toBe(false);
  });

  it("extends Thunderpost to a documented five-beat, damage-neutral cadence", () => {
    const definition = weapon("x2-thunderpost-fetish");
    const combo = meleeComboSelectionFor(definition);
    expect(combo?.variant).toBe("thunderpost-storm-cadence");
    expect(combo?.sequence.map((step) => step.motion)).toEqual([
      "draw-cut",
      "guard-check",
      "rising-ward",
      "compass-rose",
      "thunder-fall",
    ]);
    for (const step of combo?.sequence ?? [])
      expect(step.path).toMatchObject({
        rangeMultiplier: 1,
        damageMultiplier: 1,
        knockback: 0,
      });
    expect(definition.cooldown * (combo?.sequence.length ?? 0)).toBeCloseTo(3, 10);
    const cadenceDoc = readFileSync(
      new URL("../docs/v3c-caster-owner-orders.md", import.meta.url),
      "utf8",
    );
    expect(cadenceDoc).toContain("five beats");
    expect(cadenceDoc).toContain("3.00 s");
  });

  it("grows Carrion Effigy's landing AoE without changing its poison DPS", () => {
    const zone = weapon("x2-carrion-effigy").groundZone;
    expect(zone).toMatchObject({
      trigger: "landing",
      initialRadius: 84,
      maxRadius: 84,
      damagePerSecond: 11.1111111,
    });
    expect(zone?.initialRadius).toBeGreaterThan(44);
  });
});
