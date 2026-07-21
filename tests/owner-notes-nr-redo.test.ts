import { readFileSync } from "node:fs";
import {
  meleeComboSelectionFor,
  swingDescriptorFor,
  WEAPONS,
  weaponEffectCueSeconds,
  weaponEffectEmitterPoint,
  type WeaponDef,
} from "@dd/shared";
import { describe, expect, it } from "vitest";
import {
  FIRING_STANCES,
  firingHandTarget,
  firingStanceFamilyFor,
} from "../packages/client/src/sprites/firing-stance.js";
import {
  createWeaponPerformanceInput,
  createWeaponPerformanceSample,
  sampleWeaponPerformance,
} from "../packages/client/src/sprites/pose-language.js";
import { PARTICLE_PACKS } from "../packages/client/src/vfx/particle-manifest.js";
import {
  resolveWeaponAuraVfxRecipe,
  TESLA_WARP_VFX_RECIPE,
} from "../packages/client/src/vfx/weapon-effect-recipes.js";

function weapon(id: string): WeaponDef {
  const definition = WEAPONS[id];
  if (!definition) throw new Error(`Missing NR REDO fixture: ${id}`);
  return definition;
}

function performanceSample(
  id: string,
  phase: "idle" | "anticipation" | "active" | "recovery",
  phaseT: number,
  timeS = 0.37,
) {
  const definition = weapon(id);
  if (!definition.performance) throw new Error(`Missing NR REDO performance: ${id}`);
  const input = createWeaponPerformanceInput();
  input.spec = definition.performance;
  input.phase = phase;
  input.phaseT = phaseT;
  input.timeS = timeS;
  input.aimLocal = 0;
  return { ...sampleWeaponPerformance(input, createWeaponPerformanceSample()) };
}

describe("owner-notes NR REDO iteration contracts", () => {
  it("gives Cinderchoke a half-second overhead strike windup instead of an overhead idle", () => {
    const definition = weapon("x2-cinderchoke-brazier-orb");
    const swing = swingDescriptorFor(definition, definition.cooldown);
    const idle = performanceSample(definition.id, "idle", 0);
    const windup = performanceSample(definition.id, "anticipation", 0.9);
    const downswing = performanceSample(definition.id, "active", 1);

    expect(definition.performance).toMatchObject({
      hold: "steady",
      action: "overhead-downswing",
      windupSeconds: 0.5,
    });
    expect(swing.activeStartSeconds).toBeCloseTo(0.5, 8);
    expect(idle.weaponAngle).not.toBeCloseTo(-Math.PI / 2, 3);
    expect(windup.handY).toBeLessThan(-0.35);
    expect(downswing.weaponAngle).toBeGreaterThan(0);
  });

  it("authors Sparkknuckle as alternating hook/cross boxing with tiny painted sparks", () => {
    const definition = weapon("x2-sparkknuckle-hex-mitt");
    const combo = meleeComboSelectionFor(definition);
    const aura = resolveWeaponAuraVfxRecipe(definition);

    expect(combo?.variant).toBe("sparkknuckle-voltage-boxing");
    expect(combo?.sequence.map((step) => step.motion)).toEqual(["hook", "cross", "hook", "cross"]);
    expect(combo?.sequence.map((step) => step.hand)).toEqual(["lead", "off", "lead", "off"]);
    expect(aura).toMatchObject({ packs: ["shock-spark"], count: 4, scale: 0.085 });
    expect(aura?.scale).toBeLessThan(0.1);

    const rigSource = readFileSync(
      new URL("../packages/client/src/entities/SpriteRig.ts", import.meta.url),
      "utf8",
    );
    expect(rigSource).toContain('poseVariant === "sparkknuckle-voltage-boxing"');
    expect(rigSource).toContain("pairGlintAlpha");
    expect(rigSource).toContain("paintedAuraParticles");
  });

  it("renders Fulgurite's active aura from installed spark and arc sheets", () => {
    const aura = resolveWeaponAuraVfxRecipe(weapon("x2-fulgurite-storm-sphere"));
    expect(aura).toMatchObject({ packs: ["shock-spark", "shock-bolt"], count: 8 });
    for (const pack of aura?.packs ?? []) expect(PARTICLE_PACKS[pack], pack).toBeDefined();
  });

  it("moves Cairn's upright carry forward without changing the shared Rotgrove rest", () => {
    const cairn = weapon("x2-cairn-of-hollow-names");
    const cairnIdle = performanceSample(cairn.id, "idle", 0);
    const rotgroveIdle = performanceSample("x2-rotgrove-totem", "idle", 0);
    expect(cairn.performance?.carryForwardPx).toBe(54);
    expect(cairnIdle.handX - rotgroveIdle.handX).toBeCloseTo(54 / 76, 8);
  });

  it("uses painted electric departure and arrival punctuation for Cogwright warp", () => {
    expect(TESLA_WARP_VFX_RECIPE).toMatchObject({
      weaponId: "x2-cogwright-s-tesla-rod",
      departurePacks: ["shock-bolt", "shock-spark"],
      arrivalPacks: ["shock-splat", "shock-bolt"],
    });
    for (const pack of [
      ...TESLA_WARP_VFX_RECIPE.departurePacks,
      ...TESLA_WARP_VFX_RECIPE.arrivalPacks,
    ]) {
      expect(PARTICLE_PACKS[pack], pack).toBeDefined();
    }

    const arenaSource = readFileSync(
      new URL("../packages/client/src/scenes/ArenaScene.ts", import.meta.url),
      "utf8",
    );
    expect(arenaSource).toContain("spawnTeslaWarpDeparture(this, rig.x, rig.y)");
    expect(arenaSource).toContain("spawnTeslaWarpArrival(this, player.x, arrivalY)");
  });

  it("releases Riftcleaver's real shards from the forward blade midpoint on its cooler fourth beat", () => {
    const definition = weapon("x2-riftcleaver-greatblade");
    const combo = meleeComboSelectionFor(definition);
    const swing = swingDescriptorFor(definition, definition.cooldown);
    const cue = weaponEffectCueSeconds(definition, swing);
    const origin = weaponEffectEmitterPoint(definition, { x: 10, y: 20 }, 0, swing, cue);

    expect(combo?.sequence.map((step) => step.motion)).toEqual([
      "falling-gate",
      "backswing-wheel",
      "runaway-cleave",
      "true-charged-slam",
    ]);
    expect(definition).toMatchObject({ effectEmitter: "blade", effectTiming: "swing-midpoint" });
    expect(cue).toBeCloseTo((swing.activeStartSeconds + swing.activeEndSeconds) * 0.5, 8);
    expect(origin.x).toBeGreaterThan(10);
    expect(origin.y).toBeCloseTo(20, 8);

    const serverSource = readFileSync(
      new URL("../packages/server/src/rooms/GameRoom.ts", import.meta.url),
      "utf8",
    );
    expect(serverSource).toContain("weaponEffectCueSeconds(weapon, swing)");
  });

  it("turns Gravesinger into one cadence-neutral heavy shoulder-launched orb and blast", () => {
    const definition = weapon("x2-gravesinger-s-hex-wand");
    const stance = FIRING_STANCES[firingStanceFamilyFor(definition)];
    const lead = firingHandTarget(definition, "lead", 0);

    expect(definition.tags.grip).toBe("2H");
    expect(definition.performance).toMatchObject({
      hold: "shoulder-launcher",
      action: "recoil",
      suppressSwing: true,
    });
    expect(definition).toMatchObject({ damage: 5, cooldown: 0.4 });
    expect(definition.chainLightning).toBeUndefined();
    expect(definition.gun).toMatchObject({
      damage: 5,
      fireRate: 0.8,
      bulletKind: "orb",
      projectileVisualScale: 2.6,
      explode: { radius: 110, damage: 5 },
    });
    expect(((definition.gun?.damage ?? 0) + (definition.gun?.explode?.damage ?? 0)) / 0.8).toBe(
      definition.damage / definition.cooldown,
    );
    expect(stance.family).toBe("shoulder-launcher");
    expect(lead.x).toBeLessThan(0);
    expect(lead.y).toBeLessThan(-0.25);
  });

  it("winds both Bogwater hands behind the body before lurching them through release", () => {
    const wound = performanceSample("x2-bogwater-twinbits", "anticipation", 1);
    const released = performanceSample("x2-bogwater-twinbits", "active", 1);
    expect(wound.handX).toBeLessThan(0);
    expect(wound.backHandX).toBeLessThan(0);
    expect(released.handX).toBeGreaterThan(0.4);
    expect(released.backHandX).toBeGreaterThan(0.4);
    expect(released.backHandBlend).toBe(1);
  });

  it("rests Boothill Hatchet upright", () => {
    const definition = weapon("x2-boothill-hatchet");
    const idle = performanceSample(definition.id, "idle", 0);
    expect(definition.performance).toMatchObject({ hold: "upright", action: "default-swing" });
    expect(idle.weaponAngle).toBeCloseTo(-Math.PI / 2, 8);
  });
});
