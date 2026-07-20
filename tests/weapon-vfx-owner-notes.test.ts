import { readFileSync } from "node:fs";
import {
  admittedPrismaticBeamRayCount,
  FRIENDLY_BEAM_ENTITY_CAP,
  MAX_PLAYERS,
  meleeComboSelectionFor,
  meleeReach,
  PRISM_BEAM_MAX_RAYS,
  prismaticBeamRayOffsets,
  swingDescriptorFor,
  WEAPONS,
  weaponEffectCueSeconds,
  weaponEffectEmitterFor,
  weaponEffectEmitterPoint,
  weaponMuzzleReach,
} from "@dd/shared";
import { describe, expect, it } from "vitest";
import { PARTICLE_PACKS } from "../packages/client/src/vfx/particle-manifest.js";
import {
  resolveWeaponAuraVfxRecipe,
  resolveWeaponEffectRecipe,
  TESLA_WARP_VFX_RECIPE,
  WEAPON_EFFECT_RECIPES,
} from "../packages/client/src/vfx/weapon-effect-recipes.js";
import { GENERATED_MELEE_COMBO_BARS } from "../packages/shared/src/weapons-expansion.generated.js";

const EXPECTED = {
  "x2-galvanic-overcasters": ["galvanic-blue-burst", "tip"],
  "x2-riftglass-prism-lantern": ["riftglass-rainbow-volley", "tip"],
  "x2-twin-whispervolumes": ["whispervolume-page-scatter", "tip"],
  "x2-riftcleaver-greatblade": ["riftcleaver-crystal-shards", "blade"],
  "x2-verdict-longsword": ["verdict-tip-procession", "tip"],
  "x2-tombwarden-claymore": ["tombwarden-dark-slash", "blade"],
  "x2-choir-iron-greataxe": ["choir-iron-flame-slash", "blade"],
  "x2-hangman-s-greatcleaver": ["hangman-blood-spatter", "blade"],
  "x2-dustreaper-zweihander": ["dustreaper-continuous-edge", "blade"],
} as const;

function weapon(id: string) {
  const definition = WEAPONS[id];
  if (!definition) throw new Error(`Missing W-VFX weapon fixture: ${id}`);
  return definition;
}

function combo(id: string) {
  const definition = weapon(id);
  const selection = meleeComboSelectionFor(definition);
  if (!selection) throw new Error(`Missing W-VFX combo fixture: ${id}`);
  return { definition, selection };
}

describe("owner-notes W-VFX weapon identities", () => {
  it("resolves one explicit recipe and shared emitter policy for every reworked weapon", () => {
    expect(Object.keys(WEAPON_EFFECT_RECIPES)).toHaveLength(9);
    for (const [weaponId, [recipeId, emitter]] of Object.entries(EXPECTED)) {
      const definition = weapon(weaponId);
      expect(definition.effectRecipe, weaponId).toBe(recipeId);
      expect(weaponEffectEmitterFor(definition), weaponId).toBe(emitter);
      expect(resolveWeaponEffectRecipe(definition), weaponId).toMatchObject({
        id: recipeId,
        weaponId,
        emitter,
      });

      const swing = swingDescriptorFor(definition, definition.cooldown);
      const point = weaponEffectEmitterPoint(definition, { x: 100, y: 200 }, 0, swing, 0);
      const distance = Math.hypot(point.x - 100, point.y - 200);
      expect(Number.isFinite(point.x) && Number.isFinite(point.y), weaponId).toBe(true);
      if (emitter === "tip")
        expect(distance, weaponId).toBeCloseTo(weaponMuzzleReach(definition), 8);
      else expect(distance, weaponId).toBeCloseTo(meleeReach(definition) * 0.78, 8);
    }
  });

  it("sources every painted accent from the installed particle library and keeps Hangman non-gore", () => {
    for (const recipe of Object.values(WEAPON_EFFECT_RECIPES)) {
      if (recipe.impactPack) expect(PARTICLE_PACKS[recipe.impactPack], recipe.id).toBeDefined();
      if (recipe.swingPack) expect(PARTICLE_PACKS[recipe.swingPack], recipe.id).toBeDefined();
    }
    expect(WEAPON_EFFECT_RECIPES["tombwarden-dark-slash"].swingPack).toBe("void-bolt");
    expect(WEAPON_EFFECT_RECIPES["choir-iron-flame-slash"].swingPack).toBe("fire-bolt");
    expect(WEAPON_EFFECT_RECIPES["hangman-blood-spatter"]).toMatchObject({
      swingPack: "blood-splat",
      noGore: true,
      additive: false,
    });
    expect(weapon("x2-galvanic-overcasters").gun?.projectileVisualScale).toBe(2.2);
    expect(WEAPON_EFFECT_RECIPES["galvanic-blue-burst"]).toMatchObject({
      projectile: "electric-bolt",
      projectileColor: 0x2f8fff,
      impactPack: "shock-bolt",
    });
    expect(WEAPON_EFFECT_RECIPES["whispervolume-page-scatter"].chain).toBe("scattered-pages");
  });

  it("uses retained Codex particle art for both revised shock auras and both Tesla warp beats", () => {
    const sparkknuckle = resolveWeaponAuraVfxRecipe(weapon("x2-sparkknuckle-hex-mitt"));
    const fulgurite = resolveWeaponAuraVfxRecipe(weapon("x2-fulgurite-storm-sphere"));
    expect(sparkknuckle).toMatchObject({
      packs: ["shock-spark"],
      count: 4,
      scale: 0.085,
      extent: 0.58,
    });
    expect(fulgurite).toMatchObject({
      packs: ["shock-spark", "shock-bolt"],
      count: 8,
      scale: 0.15,
    });
    for (const recipe of [sparkknuckle, fulgurite]) {
      if (!recipe) throw new Error("Missing revised shock-aura recipe");
      for (const pack of recipe.packs) expect(PARTICLE_PACKS[pack]).toBeDefined();
    }
    expect(TESLA_WARP_VFX_RECIPE.departurePacks).not.toEqual(
      TESLA_WARP_VFX_RECIPE.arrivalPacks,
    );
    for (const pack of [
      ...TESLA_WARP_VFX_RECIPE.departurePacks,
      ...TESLA_WARP_VFX_RECIPE.arrivalPacks,
    ])
      expect(PARTICLE_PACKS[pack]).toBeDefined();

    const rigSource = readFileSync(
      new URL("../packages/client/src/entities/SpriteRig.ts", import.meta.url),
      "utf8",
    );
    expect(rigSource).toContain("auraActive && !paintedAuraActive");
  });

  it("gives Sparkknuckle alternating hooks/crosses, body commitment, and impact snaps", () => {
    const { selection } = combo("x2-sparkknuckle-hex-mitt");
    expect(selection).toMatchObject({ family: "punch", variant: "sparkknuckle-voltage-boxing" });
    expect(selection.sequence.map((step) => step.motion)).toEqual([
      "hook",
      "cross",
      "hook",
      "cross",
    ]);
    expect(selection.sequence.map((step) => step.direction)).toEqual([1, -1, -1, 1]);
    expect(selection.sequence.map((step) => step.hand)).toEqual(["lead", "off", "lead", "off"]);

    const rigSource = readFileSync(
      new URL("../packages/client/src/entities/SpriteRig.ts", import.meta.url),
      "utf8",
    );
    expect(rigSource).toContain('poseVariant === "sparkknuckle-voltage-boxing"');
    expect(rigSource).toContain("impactFrame");
  });

  it("converts Gravesinger into one oversized explosive shoulder shell without changing base damage", () => {
    const definition = weapon("x2-gravesinger-s-hex-wand");
    expect(definition).toMatchObject({
      damage: 5,
      performance: { hold: "shoulder-launcher", action: "recoil", suppressSwing: true },
      gun: {
        damage: 5,
        fireRate: 0.8,
        bulletKind: "orb",
        projectileVisualScale: 2.6,
        explode: { radius: 110, damage: 5 },
      },
    });
    expect(definition.tags.grip).toBe("2H");
    expect(definition.chainLightning).toBeUndefined();
    expect(definition.gun?.pellets).toBeUndefined();
  });

  it("authors Riftcleaver's cooler four-hit cadence and emits its shards from the forward midpoint", () => {
    const { definition, selection } = combo("x2-riftcleaver-greatblade");
    expect(definition.comboVariant).toBe("riftcleaver-crystal-cadence");
    expect(GENERATED_MELEE_COMBO_BARS["riftcleaver-crystal-cadence"]).toHaveLength(4);
    expect(selection).toMatchObject({ family: "chop", variant: "riftcleaver-crystal-cadence" });
    expect(selection.sequence.map((step) => step.motion)).toEqual([
      "falling-gate",
      "backswing-wheel",
      "runaway-cleave",
      "true-charged-slam",
    ]);
    for (const step of selection.sequence) {
      expect(step.path).toMatchObject({
        arcMultiplier: 1,
        rangeMultiplier: 1,
        damageMultiplier: 1,
        knockback: 0,
      });
      expect(step.timing.impact).toBeGreaterThanOrEqual(step.timing.activeStart);
      expect(step.timing.impact).toBeLessThanOrEqual(step.timing.activeEnd);
      expect(step.timing.followEnd).toBeLessThanOrEqual(0.86);
    }

    const swing = swingDescriptorFor(definition, definition.cooldown);
    const recipe = resolveWeaponEffectRecipe(definition);
    if (!recipe) throw new Error("Missing Riftcleaver VFX recipe");
    const cue = weaponEffectCueSeconds(definition, swing);
    const point = weaponEffectEmitterPoint(definition, { x: 100, y: 200 }, 0, swing, cue);
    expect(definition.effectTiming).toBe("swing-midpoint");
    expect(cue).toBeCloseTo((swing.activeStartSeconds + swing.activeEndSeconds) * 0.5, 10);
    expect(point.x).toBeGreaterThan(100);
    expect(point.y).toBeCloseTo(200, 8);
  });

  it("gives Verdict an authored no-warp lunge procession from the weapon tip", () => {
    const { definition, selection } = combo("x2-verdict-longsword");
    expect(selection).toMatchObject({ family: "thrust", variant: "verdict-procession" });
    expect(selection.sequence.map((step) => step.motion)).toEqual(["lunge", "disengage", "impale"]);
    expect(definition.warp).toBeUndefined();
    expect(definition.effectEmitter).toBe("tip");

    const rigSource = readFileSync(
      new URL("../packages/client/src/entities/SpriteRig.ts", import.meta.url),
      "utf8",
    );
    const poseStart = rigSource.indexOf('poseStyle === "thrust"');
    const poseEnd = rigSource.indexOf('poseStyle === "arc"', poseStart + 24);
    const thrustPose = rigSource.slice(poseStart, poseEnd > poseStart ? poseEnd : undefined);
    expect(thrustPose).toContain("swingOffX");
    expect(thrustPose).not.toMatch(/this\.root\.(?:x|y)\s*[+\-*/]?=/);
  });

  it("keeps Prism-Lantern's server-authored rainbow fan inside both caps", () => {
    const beam = WEAPONS["x2-riftglass-prism-lantern"]?.beam;
    expect(beam?.randomRays).toEqual({ count: 7, spread: 1.05 });
    if (!beam?.randomRays) throw new Error("Missing Prism-Lantern random-ray fixture");
    const admitted = admittedPrismaticBeamRayCount(beam.randomRays.count, 0);
    const offsets = prismaticBeamRayOffsets(admitted, beam.randomRays.spread, 0x1020_3040);
    expect(offsets).toHaveLength(7);
    expect(offsets[0]).toBe(0);
    expect(offsets.every((offset) => Math.abs(offset) <= 1.05)).toBe(true);
    expect(new Set(offsets).size).toBe(offsets.length);
    expect(offsets.length).toBeLessThanOrEqual(PRISM_BEAM_MAX_RAYS);
    expect(MAX_PLAYERS + offsets.length - 1).toBeLessThanOrEqual(FRIENDLY_BEAM_ENTITY_CAP);
    expect(
      admittedPrismaticBeamRayCount(PRISM_BEAM_MAX_RAYS, FRIENDLY_BEAM_ENTITY_CAP - MAX_PLAYERS),
    ).toBe(1);
  });

  it("retains Dustreaper's smooth G3 three-beat sentence with a continuous edge accent", () => {
    const { definition, selection } = combo("x2-dustreaper-zweihander");
    expect(selection.variant).toBe("claymore-breach");
    expect(selection.sequence).toHaveLength(3);
    expect(new Set(selection.sequence.map((step) => step.motion)).size).toBe(3);
    expect(resolveWeaponEffectRecipe(definition)).toMatchObject({
      id: "dustreaper-continuous-edge",
      swingPack: "sand-wisp",
      emitter: "blade",
    });
  });
});
