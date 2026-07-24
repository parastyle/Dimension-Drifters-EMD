import { readFileSync } from "node:fs";
import {
  meleeComboSelectionFor,
  meleeDamageEnvelopeFor,
  WEAPONS,
  type WeaponDef,
} from "@dd/shared";
import { describe, expect, it } from "vitest";
import { fistGunShotHandOffset } from "../packages/client/src/sprites/firing-stance.js";
import {
  createWeaponPerformanceInput,
  createWeaponPerformanceSample,
  sampleWeaponPerformance,
  weaponPerformanceSpecFor,
} from "../packages/client/src/sprites/pose-language.js";
import { tomeOpenArtFor } from "../packages/client/src/sprites/tome-open-art.js";
import {
  CASTER_PAINTED_IMPACTS,
  CASTER_SPRITE_PROJECTILES,
  CASTER_TEXTURE_PROJECTILES,
} from "../packages/client/src/vfx/caster-vfx-recipes.js";
import {
  generatedImageMeleeGeometryFor,
  resolveGeneratedImageWeaponVfxRecipe,
} from "../packages/client/src/vfx/generated-image-weapon-vfx-recipes.js";
import {
  paintedParticleDisplaySize,
  paintedParticleDominance,
  paintedSwingDisplayWidth,
} from "../packages/client/src/vfx/painted-particle-scale.js";
import { resolveQuakeVfxRecipe } from "../packages/client/src/vfx/quake-vfx-recipes.js";
import {
  resolveWeaponAuraVfxRecipe,
  resolveWeaponEffectRecipe,
  weaponSwingIdentitySizePx,
} from "../packages/client/src/vfx/weapon-effect-recipes.js";

function weapon(id: string): WeaponDef {
  const definition = WEAPONS[id];
  if (!definition) throw new Error(`missing W4M fixture ${id}`);
  return definition;
}

function performance(id: string) {
  const spec = weaponPerformanceSpecFor(weapon(id));
  if (!spec) throw new Error(`missing W4M performance ${id}`);
  return spec;
}

describe("W4M melee/caster iteration orders", () => {
  it("alternates Voltvein's forward striking fist and retracting next fist", () => {
    for (const strikingHand of [0, 1] as const) {
      const lead = fistGunShotHandOffset(0, strikingHand, 0, 1);
      const off = fistGunShotHandOffset(1, strikingHand, 0, 1);
      expect(strikingHand === 0 ? lead.x : off.x).toBeCloseTo(0.2);
      expect(strikingHand === 0 ? off.x : lead.x).toBeCloseTo(-0.055);
    }
  });

  it("uses the shell-free, right-facing Plague bug and removes Saintskull's rejected crop", () => {
    expect(CASTER_SPRITE_PROJECTILES["x2-locust-glass-plague-orb"]).toBeUndefined();
    expect(CASTER_TEXTURE_PROJECTILES["x2-locust-glass-plague-orb"]).toMatchObject({
      textureKey: "caster:plague-locust",
      displayLength: 48,
    });
    expect(CASTER_SPRITE_PROJECTILES["x2-saintskull-monstrance"]).toBeUndefined();
  });

  it("triples Fulgurite's authoritative radius and stages up its painted scale contract", () => {
    const definition = weapon("x2-fulgurite-storm-sphere");
    const aura = resolveWeaponAuraVfxRecipe(definition);
    expect(definition.performance?.aura?.radius).toBe(450);
    expect(aura?.count).toBe(8);
    expect(
      paintedParticleDisplaySize(
        paintedParticleDominance(
          definition.displayLength * (aura?.particleReferenceMultiplier ?? 1),
          aura?.particleDominance ?? 0,
          aura?.minParticlePx,
          aura?.maxParticlePx,
        ),
      ),
    ).toBe(96);
  });

  it("replaces Saintskull's beam with a documented 90-DPS one-second single skull shot", () => {
    const definition = weapon("x2-saintskull-monstrance");
    expect(definition.beam).toBeUndefined();
    expect(definition.gun).toMatchObject({
      projectileSpeed: 560,
      range: 760,
      damage: 90,
      fireRate: 1,
      magazine: 1,
      reloadSeconds: 0.6,
      bulletKind: "orb",
      projectileArt: "generated",
    });
    const gun = definition.gun;
    if (!gun) throw new Error("Saintskull gun fixture required");
    expect(gun.damage / gun.fireRate).toBe(90);
  });

  it("carries Cairn closer with a 20-degree forward lean and painted-purple-only impact", () => {
    const definition = weapon("x2-cairn-of-hollow-names");
    const recipe = resolveWeaponEffectRecipe(definition);
    expect(definition.performance).toMatchObject({
      carryForwardPx: 24,
      carryAngleRad: -1.2217304763960306,
    });
    expect(recipe).toMatchObject({
      quakeExplosionElement: "void",
      quakeExplosionPaintedOnlyWeaponIds: ["x2-cairn-of-hollow-names"],
    });
    expect(
      resolveWeaponEffectRecipe(weapon("x2-vagrant-s-wishing-marble"))
        ?.quakeExplosionPaintedOnlyWeaponIds,
    ).not.toContain("x2-vagrant-s-wishing-marble");
  });

  it("makes Wyrmskull's whole authoritative combo a spear-jab sequence", () => {
    const definition = weapon("x2-wyrmskull-reliquary");
    const sequence = meleeComboSelectionFor(definition)?.sequence;
    expect(definition.comboFamily).toBe("thrust");
    expect(definition.comboVariant).toBe("wyrmskull-spear-jabs");
    expect(sequence?.map((step) => step.motion)).toEqual(["jab", "jab", "impale"]);
    for (const step of sequence ?? []) {
      expect(step.path.kind).toBe("capsule");
      expect(step.path.damageMultiplier).toBe(1);
    }
  });

  it("doubles Gravesinger and assigns real projectile/explosion frames", () => {
    const definition = weapon("x2-gravesinger-s-hex-wand");
    expect(definition.displayLength).toBe(180);
    expect(CASTER_TEXTURE_PROJECTILES[definition.id]).toMatchObject({
      frame: 0,
      frameWidth: 627,
      displayLength: 72,
    });
    expect(CASTER_PAINTED_IMPACTS[definition.id]).toMatchObject({
      frames: [1, 2, 3],
      displayLength: 180,
    });
  });

  it("enlarges Bogwater by 10% and holds it at the ordered upright lean", () => {
    const definition = weapon("x2-bogwater-twinbits");
    expect(definition.displayLength).toBeCloseTo(58 * 1.1, 8);
    const input = createWeaponPerformanceInput();
    input.spec = performance(definition.id);
    const sampled = sampleWeaponPerformance(input, createWeaponPerformanceSample());
    expect(sampled.weaponAngle).toBeCloseTo(-1.2217304763960306);
  });

  it("keeps Dustreaper legible after the B11 generated-dragon replacement", () => {
    const definition = weapon("x2-dustreaper-zweihander");
    expect(resolveWeaponEffectRecipe(definition)).toBeUndefined();
    expect(resolveGeneratedImageWeaponVfxRecipe(definition.id)).toMatchObject({
      kind: "fire-dragon-sweep",
      subject: "vfx-fire-dragon",
      bladeOverlay: { lengthMultiplier: 1, widthMultiplier: 1 },
    });
    const envelope = meleeDamageEnvelopeFor(definition);
    expect(generatedImageMeleeGeometryFor(definition)).toEqual({
      forwardExtent: envelope.baseReach,
      halfWidth: envelope.baseHalfWidth,
    });
  });

  it("gives Coilshot a visible in-hand orbit during its complete pre-throw turn", () => {
    const input = createWeaponPerformanceInput();
    const out = createWeaponPerformanceSample();
    const spec = performance("x2-coilshot-meteor");
    input.spec = spec;
    input.phase = "anticipation";
    input.phaseT = 0.5;
    const twirled = { ...sampleWeaponPerformance(input, out) };
    input.spec = { ...spec, preThrowRevolutions: 0 };
    const control = { ...sampleWeaponPerformance(input, out) };
    expect(spec.preThrowRevolutions).toBe(1);
    expect(Math.hypot(twirled.handX - control.handX, twirled.handY - control.handY)).toBeCloseTo(
      0.2,
    );
  });

  it("opens Riftstep with a damage-neutral tsuki capsule from blade-forward stance", () => {
    const definition = weapon("drift-katana-riftstep");
    const opener = meleeComboSelectionFor(definition)?.sequence[0];
    expect(definition.stance).toBe("blade-forward-high-hilt");
    expect(opener).toMatchObject({
      name: "Near Shore Tsuki",
      motion: "jab",
      hand: "both",
      path: { kind: "capsule", deltaAngle: 0, damageMultiplier: 0.98 },
    });
  });

  it("doubles Godsbone's holy quake count and sizes the feather as shrapnel", () => {
    expect(resolveQuakeVfxRecipe(weapon("x2-godsbone-pillar"))?.effectCountMultiplier).toBe(2);
    const composer = readFileSync(
      new URL("../packages/client/src/vfx/fx-composer.ts", import.meta.url),
      "utf8",
    );
    expect(composer).toContain("shrapnel: [0, 1, 4, 5, 7]");
    expect(composer).not.toContain("wisps: { indexes: [7] }, // feather");
  });

  it("puts Reaper's Tithe's lower hand on the walking-staff shaft", () => {
    const input = createWeaponPerformanceInput();
    input.spec = performance("x2-reaper-s-tithe");
    input.gait = 0.7;
    const sampled = sampleWeaponPerformance(input, createWeaponPerformanceSample());
    expect(sampled.backHandBlend).toBe(1);
    expect(sampled.backHandX).toBeCloseTo(sampled.handX);
    expect(sampled.backHandY - sampled.handY).toBeCloseTo(0.22);
  });

  it("makes Gravechain continuously spin one way with a much denser scaled burst", () => {
    const definition = weapon("x2-gravechain-scythe");
    const recipe = resolveWeaponEffectRecipe(definition);
    expect(definition.performance?.twirl?.direction).toBe("forward");
    expect(recipe?.swingCount).toBe(24);
    expect(weaponSwingIdentitySizePx(recipe, definition.displayLength)).toBe(84);
    expect(paintedSwingDisplayWidth(definition)).toBeCloseTo(61.2, 5);
  });

  it("gives Hailspur a full authored release instead of a generic swing", () => {
    expect(weapon("x2-hailspur-sickle").performance).toMatchObject({
      action: "throw-release",
      suppressSwing: true,
      preThrowRevolutions: 1,
    });
  });

  it("makes Verdigris pages seven times larger and doubles server reach", () => {
    expect(tomeOpenArtFor("x2-verdigris-grand-grimoire")?.pageScale).toBe(7);
    expect(weapon("x2-verdigris-grand-grimoire").range).toBe(400);
  });

  it("joins Thunderhoof to the forward Garen whirlwind", () => {
    const definition = weapon("x2-thunderhoof-splittingaxe");
    expect(definition.swingStyle).toBe("spin");
    expect(definition.swingArc).toBeCloseTo(Math.PI * 2);
    expect(definition.performance?.twirl).toEqual({
      plane: "ground-whirlwind",
      pivot: "grip",
      direction: "forward",
    });
  });

  it("converts Hangman's Gavel to a DPS-neutral own-sprite throw", () => {
    const definition = weapon("x2-hangman-s-gavel");
    expect(definition.thrown).toMatchObject({
      speed: 720,
      range: 520,
      damage: 11,
      refillSeconds: 0.6,
      rotation: "spin",
    });
    expect(definition.gun).toBeUndefined();
    expect(definition.performance?.suppressSwing).toBe(true);
  });
});
