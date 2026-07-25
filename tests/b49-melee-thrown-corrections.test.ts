import {
  meleeComboSelectionFor,
  projectileWaveformPositionAt,
  WEAPONS,
  type WeaponDef,
} from "@dd/shared";
import { describe, expect, it } from "vitest";
import {
  CASTER_PARTICLE_PROJECTILES,
  casterSourceUsesFist,
} from "../packages/client/src/vfx/caster-vfx-recipes.js";

const ORDER_IDS = [
  "x2-hailshard-resonator",
  "gravediggers-spade",
  "x2-cinderbrand-cleaver",
  "x2-brimstone-doubleheader",
  "x2-hollowmoon-reaver",
  "x2-frostfang-rakes",
  "x2-gallows-splitter",
  "x2-saloon-tomahawk",
  "x2-reverent-broadsword",
  "x2-emberfist-wraps",
  "x2-void-throwing-star",
  "x2-frostknuckle-rimewrap",
  "x2-cinderpalm-brand-glove",
] as const;

function weapon(id: (typeof ORDER_IDS)[number]): WeaponDef {
  const found = WEAPONS[id];
  expect(found, `${id} must be present in the runtime catalog`).toBeDefined();
  return found as WeaponDef;
}

describe("B49 melee/thrown owner corrections", () => {
  it("restores Hailshard's held 360-degree ice spin without a duplicate melee hitbox", () => {
    const hail = weapon("x2-hailshard-resonator");
    expect(hail.swingStyle).toBe("spin");
    expect(hail.scatter?.aim).toBe("radial-random");
    expect(hail.scatter?.count).toBe(5);
    expect(hail.performance).toMatchObject({
      action: "spin",
      continuous: true,
      suppressSwing: true,
      twirl: {
        plane: "screen-circle",
        pivot: "shaft-midpoint",
        visualRevolutions: 1,
      },
      holdScaling: { cadence: "weapon-cooldown" },
    });
    expect(hail.suppressMeleeHitbox).toBe(true);
    expect(hail.suppressVfx).not.toBe(true);
    expect(CASTER_PARTICLE_PROJECTILES[hail.id]).toMatchObject({
      treatment: "stream",
      pack: "frost-shard",
    });
  });

  it("halves Gravedigger's visible rate and splits unchanged DPS across every revolution", () => {
    const spade = weapon("gravediggers-spade");
    const revolutions = spade.performance?.twirl?.visualRevolutions;
    expect(revolutions).toBe(3);
    expect(spade.swingArc).toBeCloseTo(Math.PI * 6, 10);
    expect(spade.performance?.twirl?.cadenceSeconds).toBeCloseTo(0.6, 10);
    expect(spade.damage).toBeCloseTo(8 / 3, 10);
    expect((spade.damage * Number(revolutions)) / spade.cooldown).toBeCloseTo(8 / 0.6, 10);
  });

  it("keeps Cinderbrand and both whirlwind weapons planted with visual sweep truth", () => {
    const cinderbrand = weapon("x2-cinderbrand-cleaver");
    const doubleheader = weapon("x2-brimstone-doubleheader");
    expect(cinderbrand.range).toBe(182);
    expect(cinderbrand.damage / cinderbrand.cooldown).toBeCloseTo(50 / 3, 10);
    expect(doubleheader.tags.grip).toBe("dual");
    expect(doubleheader).toMatchObject({
      swingStyle: "spin",
      suppressVfx: true,
      performance: {
        action: "spin",
        continuous: true,
        suppressSwing: true,
        twirl: { plane: "ground-whirlwind", visualRevolutions: 1 },
        holdScaling: { cadence: "weapon-cooldown" },
      },
    });
    expect(doubleheader.swingArc).toBeCloseTo(Math.PI * 2, 10);
    expect(doubleheader.damage / doubleheader.cooldown).toBeCloseTo(5 / 0.28, 10);
  });

  it("authors Hollowmoon's upright two-hand eclipse combo and drives Frostfang forward", () => {
    const hollowmoon = weapon("x2-hollowmoon-reaver");
    expect(hollowmoon.performance).toMatchObject({
      hold: "upright",
      carryForwardPx: 16,
      carryAngleRad: -1.45,
      comboForwardPx: 26,
    });
    const hollowCombo = meleeComboSelectionFor(hollowmoon)?.sequence ?? [];
    expect(hollowCombo).toHaveLength(5);
    expect(new Set(hollowCombo.map((step) => step.motion)).size).toBeGreaterThan(3);
    expect(hollowCombo.every((step) => step.hand === "both" && step.ribbon)).toBe(true);

    const frostfang = weapon("x2-frostfang-rakes");
    expect(frostfang.performance?.comboForwardPx).toBe(64);
    expect(frostfang.range).toBe(172);
  });

  it.each([
    "x2-gallows-splitter",
    "x2-saloon-tomahawk",
  ] as const)("gives %s a real two-hand behind-head throw windup", (id) => {
    const thrown = weapon(id);
    expect(thrown.performance).toMatchObject({
      action: "throw-release",
      suppressSwing: true,
      throwStyle: "two-hand-overhead",
    });
    expect(thrown.performance?.windupSeconds).toBeGreaterThanOrEqual(0.3);
    expect(thrown.thrown).toBeDefined();
  });

  it("slows Reverent's flip and makes Emberfist smaller while extending punch reach", () => {
    const reverent = weapon("x2-reverent-broadsword");
    const flip = meleeComboSelectionFor(reverent)?.sequence[1];
    expect(flip?.theatrics).toEqual({ flip: "front", flipEnd: 0.68 });
    expect(flip?.theatrics?.flipEnd).toBeGreaterThan(flip?.timing.impact ?? 0);

    const emberfist = weapon("x2-emberfist-wraps");
    expect(emberfist.displayLength).toBe(40);
    expect(emberfist.range).toBe(184);
    expect(emberfist.damage / emberfist.cooldown).toBeCloseTo(20, 10);
  });

  it("launches two equal-damage Void stars on opposite helix curves", () => {
    const stars = weapon("x2-void-throwing-star");
    expect(stars.tags.grip).toBe("dual");
    expect(stars.thrown?.helix).toEqual({ amplitudePx: 44, frequencyHz: 2 });
    const waveform = stars.thrown?.helix as { amplitudePx: number; frequencyHz: number };
    const lead = projectileWaveformPositionAt(0, 0, 100, 0, 0.0625, {
      ...waveform,
      phaseRad: 0,
    });
    const off = projectileWaveformPositionAt(0, 0, 100, 0, 0.0625, {
      ...waveform,
      phaseRad: Math.PI,
    });
    expect(lead.x).toBeCloseTo(off.x, 10);
    expect(lead.y).toBeCloseTo(-off.y, 10);
    expect(Math.abs(lead.y)).toBeGreaterThan(20);
    expect(stars.thrown?.damage).toBe(12);
  });

  it("mirrors both glove sprites and keeps elemental emission fist-anchored", () => {
    const frost = weapon("x2-frostknuckle-rimewrap");
    const cinder = weapon("x2-cinderpalm-brand-glove");
    expect(frost.tags.grip).toBe("dual");
    expect(cinder.tags.grip).toBe("dual");
    expect(CASTER_PARTICLE_PROJECTILES[frost.id]).toMatchObject({
      treatment: "stream",
      pack: "frost-mote",
    });
    expect(casterSourceUsesFist(frost)).toBe(true);
    expect(casterSourceUsesFist(cinder)).toBe(true);
  });

  it("keeps every corrected order free of player auras, chains, and displacement fields", () => {
    for (const id of ORDER_IDS) {
      const corrected = weapon(id);
      const authored = JSON.stringify(corrected);
      expect(corrected.chainLightning, `${id}: no chain payload`).toBeUndefined();
      expect(authored, `${id}: no player/body aura`).not.toMatch(/playerAura|bodyAura/i);
      expect(authored, `${id}: no melee displacement`).not.toMatch(
        /forwardDrift|rootMotion|dashImpulse|lunge|userKnockback/i,
      );
    }
  });
});
