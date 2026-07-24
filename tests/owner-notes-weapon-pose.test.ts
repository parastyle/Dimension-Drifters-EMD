import {
  meleeComboSelectionFor,
  PROJECTILE_RADIUS,
  swingDescriptorFor,
  swingDescriptorWithComboStep,
  WEAPONS,
} from "@dd/shared";
import { describe, expect, it } from "vitest";
import {
  continuousFrontflipAngle,
  continuousTwirlAxisFor,
  continuousWhirlPhase,
  createWeaponPerformanceInput,
  createWeaponPerformanceSample,
  namedWeaponStanceFor,
  sampleWeaponPerformance,
} from "../packages/client/src/sprites/pose-language.js";
import { secondaryGripHandRendersAbove } from "../packages/client/src/sprites/secondary-grip.js";

describe("owner ledger W-SIZE", () => {
  it("matches every ordered display scalar without coupling Hand Mortar collision", () => {
    expect(WEAPONS["x-gun-hand-mortar"]?.gun?.projectileVisualScale).toBe(1 + 4);
    expect(PROJECTILE_RADIUS).toBe(10);
    expect(WEAPONS["x2-throne-of-ash-coal-scepter"]?.displayLength).toBe(88 * 3);
    expect(WEAPONS["x2-dustdevil-whirlbits"]?.displayLength).toBe(60 * 2);
    expect(WEAPONS["x2-saloon-tomahawk"]?.displayLength).toBe(60 * 2);
  });

  it("keeps Gravesinger at twice the ordered 90px caster-family baseline", () => {
    const lengths = Object.values(WEAPONS)
      .filter((weapon) => weapon.tags.classPool === "caster")
      .map((weapon) => weapon.displayLength)
      .sort((a, b) => a - b);
    const middle = Math.floor(lengths.length / 2);
    const lower = lengths[middle - 1] ?? Number.NaN;
    const upper = lengths[middle] ?? Number.NaN;
    const median = lengths.length % 2 === 1 ? upper : (lower + upper) / 2;
    expect(lengths).toHaveLength(98);
    expect(median).toBe(92);
    expect(WEAPONS["x2-gravesinger-s-hex-wand"]?.displayLength).toBe(90 * 2);
  });
});

const B8_WEAPON_IDS = [
  "gravediggers-spade",
  "x2-saint-bough-frost-crozier",
  "x2-nullspike-pike",
  "x-sword-neon-katana",
  "x2-sunbreaker-railgun",
  "x2-fool-s-gold-revolver",
  "x2-hollowbarrel-spell-scattergun-staff",
] as const;

function b8Weapon(id: (typeof B8_WEAPON_IDS)[number]) {
  const definition = WEAPONS[id];
  if (!definition) throw new Error(`Missing B8 pose weapon ${id}`);
  return definition;
}

describe("owner ledger B8 pose, grip, and combo language", () => {
  it("pins the complete seven-ID/eight-note scope and preserves nominal damage/cadence", () => {
    expect(B8_WEAPON_IDS).toHaveLength(7);
    expect(
      Object.fromEntries(
        B8_WEAPON_IDS.map((id) => {
          const definition = b8Weapon(id);
          return [
            id,
            {
              damage: definition.damage,
              cooldown: definition.cooldown,
              gunDamage: definition.gun?.damage ?? null,
              fireRate: definition.gun?.fireRate ?? null,
              scatterDamage: definition.scatter?.damage ?? null,
              scatterCount: definition.scatter?.count ?? null,
            },
          ];
        }),
      ),
    ).toEqual({
      "gravediggers-spade": {
        damage: 8,
        cooldown: 0.6,
        gunDamage: null,
        fireRate: null,
        scatterDamage: null,
        scatterCount: null,
      },
      "x2-saint-bough-frost-crozier": {
        damage: 5,
        cooldown: 0.72,
        gunDamage: null,
        fireRate: null,
        scatterDamage: null,
        scatterCount: null,
      },
      "x2-nullspike-pike": {
        damage: 11,
        cooldown: 0.64,
        gunDamage: null,
        fireRate: null,
        scatterDamage: null,
        scatterCount: null,
      },
      "x-sword-neon-katana": {
        damage: 5.5,
        cooldown: 0.28,
        gunDamage: null,
        fireRate: null,
        scatterDamage: null,
        scatterCount: null,
      },
      "x2-sunbreaker-railgun": {
        damage: 16,
        cooldown: 0.9,
        gunDamage: 16,
        fireRate: 0.85,
        scatterDamage: null,
        scatterCount: null,
      },
      "x2-fool-s-gold-revolver": {
        damage: 6,
        cooldown: 0.42,
        gunDamage: 10,
        fireRate: 0.38,
        scatterDamage: null,
        scatterCount: null,
      },
      "x2-hollowbarrel-spell-scattergun-staff": {
        damage: 5,
        cooldown: 0.62,
        gunDamage: null,
        fireRate: null,
        scatterDamage: 4,
        scatterCount: 8,
      },
    });
  });

  it("keeps Gravewarden's held frontflip pitch-continuous without ground-plane yaw", () => {
    const gravewarden = b8Weapon("gravediggers-spade");
    expect(gravewarden.performance).toMatchObject({
      action: "spin",
      continuous: true,
      suppressSwing: true,
      twirl: {
        plane: "continuous-frontflip",
        pivot: "grip",
        direction: "forward",
        visualRevolutions: 1,
      },
      holdScaling: { cadence: "weapon-cooldown" },
    });
    expect(continuousTwirlAxisFor(gravewarden.performance)).toBe("pitch");
    expect(gravewarden.performance?.twirl?.plane).not.toBe("ground-whirlwind");
    expect(
      continuousWhirlPhase(
        gravewarden.performance,
        true,
        false,
        gravewarden.cooldown,
        gravewarden.cooldown,
      ),
    ).toBe(0);
    const epsilon = 1e-6;
    const start = continuousFrontflipAngle(0, 1, 1, 1);
    const end = continuousFrontflipAngle(1, 1, 1, 1);
    expect(Math.cos(end)).toBeCloseTo(Math.cos(start), 12);
    expect(Math.sin(end)).toBeCloseTo(Math.sin(start), 12);
    expect((end - continuousFrontflipAngle(1 - epsilon, 1, 1, 1)) / epsilon).toBeCloseTo(
      (continuousFrontflipAngle(epsilon, 1, 1, 1) - start) / epsilon,
      8,
    );
  });

  it("holds Saint-Bough upright in one hand with a walking-staff stride tap", () => {
    const saintBough = b8Weapon("x2-saint-bough-frost-crozier");
    expect(saintBough.tags.grip).toBe("1H");
    expect(saintBough.twoHanded).not.toBe(true);
    expect(saintBough.gripPoints).toEqual({ primary: { x: 0.2, y: 0.68 } });
    expect(saintBough.performance).toMatchObject({
      hold: "one-hand-walking-staff",
      action: "default-swing",
      strideTap: { amplitudePx: 10, phaseOffset: 0.35 },
    });
    const input = createWeaponPerformanceInput();
    input.spec = saintBough.performance!;
    input.gait = 1;
    input.stridePhase = -0.35;
    const sampled = sampleWeaponPerformance(input, createWeaponPerformanceSample());
    expect(sampled.weaponAngle).toBe(-Math.PI / 2);
    expect(sampled.backHandBlend).toBe(0);
  });

  it("places Nullspike on its purple wrap and exposes exactly three authoritative thrust hits", () => {
    const nullspike = b8Weapon("x2-nullspike-pike");
    const selection = meleeComboSelectionFor(nullspike);
    expect(nullspike.gripPoints?.secondary).toEqual({
      x: 0.34,
      y: 0.5,
      role: "shaft",
    });
    expect(nullspike.authoritativeCombo).toBe(true);
    expect(selection?.variant).toBe("nullspike-three-thrust");
    expect(selection?.sequence.map((step) => step.motion)).toEqual(["jab", "lunge", "impale"]);
    expect(selection?.sequence).toHaveLength(3);
    expect(
      selection?.sequence.every(
        (step) =>
          step.path.kind === "capsule" &&
          step.path.arcMultiplier === 0 &&
          step.path.damageMultiplier === 1,
      ),
    ).toBe(true);
    expect(selection?.sequence.map((step) => step.path.rangeMultiplier)).toEqual([0.86, 1, 1.12]);
  });

  it("holds Voltedge blade-up near the ear and makes every authoritative envelope a stab", () => {
    const voltedge = b8Weapon("x-sword-neon-katana");
    const stance = namedWeaponStanceFor(voltedge);
    const selection = meleeComboSelectionFor(voltedge);
    expect(stance).toMatchObject({
      id: "near-ear-blade-up",
      angleReference: "screen",
      handReference: "screen",
      restAngleRad: -Math.PI / 2,
      handLateral: -0.3,
    });
    expect(voltedge.swingStyle).toBe("thrust");
    expect(voltedge.authoritativeCombo).toBe(true);
    expect(selection?.variant).toBe("voltedge-stab");
    expect(selection?.sequence).toHaveLength(3);
    for (let index = 0; index < 3; index++) {
      const descriptor = swingDescriptorWithComboStep(
        swingDescriptorFor(voltedge, voltedge.cooldown),
        voltedge,
        index,
      );
      expect(descriptor.comboPath).toMatchObject({
        kind: "capsule",
        arcMultiplier: 0,
        damageMultiplier: 1,
      });
      expect(["side-cut", "wave-cut"]).not.toContain(
        descriptor.comboChoreography?.primitive,
      );
    }
  });

  it("pins Sunbreaker, Fool's Gold, and Hollowbarrel to their painted contact points", () => {
    const sunbreaker = b8Weapon("x2-sunbreaker-railgun");
    expect(sunbreaker.gripPoints).toEqual({
      primary: { x: 0.43, y: 0.67 },
      secondary: { x: 0.55, y: 0.64, role: "horizontal-foregrip" },
    });
    expect(secondaryGripHandRendersAbove("horizontal-foregrip")).toBe(true);

    expect(b8Weapon("x2-fool-s-gold-revolver").gripPoints).toEqual({
      primary: { x: 0.53, y: 0.72 },
    });

    const hollowbarrel = b8Weapon("x2-hollowbarrel-spell-scattergun-staff");
    expect(hollowbarrel.gripPoints).toEqual({
      primary: { x: 0.28, y: 0.5 },
      secondary: { x: 0.54, y: 0.5, role: "handle" },
    });
    expect(hollowbarrel.performance).toMatchObject({
      hold: "horn-to-face",
      action: "recoil",
      suppressSwing: true,
      emitter: "spout",
    });
  });
});
