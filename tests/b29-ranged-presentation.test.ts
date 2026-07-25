import { describe, expect, it, vi } from "vitest";
import {
  ACTIVE_WEAPON_CATALOG_IDS,
  AUTHORED_DUAL_GUN_VERTICAL_SPLIT_BODY_FRAC,
  AUTHORED_DUAL_GUN_VERTICAL_SPLIT_MS,
  authoredDualGunVerticalOffset,
  isAuthoredDualFirearm,
  weaponHasHandlingTag,
  weaponMuzzleGripOffset,
  WEAPONS,
} from "../packages/shared/src/index.js";

vi.mock("phaser", () => ({ default: {} }));

const RESIZED_THROWN = [
  ["x2-iron-throwing-star", 76, 56],
  ["x2-fire-throwing-star", 78, 58],
  ["x2-ice-throwing-star", 78, 58],
  ["x2-void-throwing-star", 82, 60],
  ["x2-iron-chakram", 104, 76],
] as const;

const AUTHORED_DUAL_GUNS = [
  "x2-coyote-stinger",
  "x2-pinwheel-caromer",
  "x2-scattershell-duster",
  "x2-sidewinder-twin-rifles",
  "x2-twin-maw-greenerbore",
] as const;

const ONE_HANDED_REVOLVERS = [
  "x-gun-revolver-cannon",
  "x-gun-ricochet-pistol",
  "x2-ashfall-peacemaker",
  "x2-brimstone-bull",
  "x2-carom-king",
  "x2-fool-s-gold-revolver",
  "x2-gravewind-rimfire",
  "x2-grit-snubnose",
  "x2-hailspitter-pepperbox",
  "x2-hollowpoint-hex",
  "x2-iron-marshal",
  "x2-ironhail-pepperbox",
  "x2-mesa-hand-cannon",
  "x2-quicksilver-fanner",
  "x2-ricochet-roulette",
  "x2-sunbrand-hogleg",
  "x2-tumbleweed-skipper",
] as const;

function activeIdsMatching(predicate: (weapon: (typeof WEAPONS)[string]) => boolean): string[] {
  const active = new Set(ACTIVE_WEAPON_CATALOG_IDS);
  return Object.values(WEAPONS)
    .filter((weapon) => active.has(weapon.id) && predicate(weapon))
    .map((weapon) => weapon.id)
    .sort();
}

describe("B29 ranged/thrown presentation census", () => {
  it("meaningfully enlarges every shuriken and chakram while preserving its prior collision length", () => {
    for (const [id, displayLength, collisionLength] of RESIZED_THROWN) {
      const weapon = WEAPONS[id];
      expect(weapon, id).toBeDefined();
      expect(weapon?.displayLength, `${id}: held/projectile presentation length`).toBe(
        displayLength,
      );
      expect(weapon?.collisionLength, `${id}: unchanged gameplay collision length`).toBe(
        collisionLength,
      );
      expect(displayLength / collisionLength, `${id}: meaningful size increase`).toBeGreaterThan(
        1.34,
      );
      expect(weapon?.performance?.throwStyle, `${id}: engaged anatomy marker`).toBe("engaged");
    }
  });

  it("enumerates exactly the five pre-made dual firearms", () => {
    expect(activeIdsMatching(isAuthoredDualFirearm)).toEqual([...AUTHORED_DUAL_GUNS].sort());
  });

  it("enumerates the 17 one-handed revolvers plus the paired and two-hand fan-hammer exceptions", () => {
    expect(
      activeIdsMatching(
        (weapon) => weapon.tags.grip === "1H" && weaponHasHandlingTag(weapon, "revolver"),
      ),
    ).toEqual([...ONE_HANDED_REVOLVERS].sort());
    expect(
      activeIdsMatching(
        (weapon) => weapon.tags.grip === "dual" && weaponHasHandlingTag(weapon, "revolver"),
      ),
    ).toEqual(["x2-twin-maw-greenerbore"]);
    expect(
      activeIdsMatching(
        (weapon) => weapon.tags.grip === "2H" && weaponHasHandlingTag(weapon, "revolver"),
      ),
    ).toEqual(["x2-hallowbore-coachgun"]);
  });
});

describe("B29 engaged thrown pose and kunai end-hook twirl", () => {
  it("authors a ready idle, whole-body wind-up, and step-through release", async () => {
    const {
      createWeaponPerformanceInput,
      createWeaponPerformanceSample,
      sampleWeaponPerformance,
    } = await import("../packages/client/src/sprites/pose-language.js");
    const star = WEAPONS["x2-iron-throwing-star"];
    if (!star?.performance) throw new Error("missing engaged throwing-star fixture");
    const input = createWeaponPerformanceInput();
    const sample = createWeaponPerformanceSample();
    input.spec = star.performance;
    input.aimLocal = 0;

    sampleWeaponPerformance(input, sample);
    expect(sample.active).toBe(true);
    expect(sample.backHandBlend).toBeGreaterThan(0.9);
    expect(sample.footBlend).toBeGreaterThan(0.7);
    expect(sample.frontFootForward).toBeGreaterThan(0.07);
    expect(sample.backFootForward).toBeLessThan(-0.09);

    input.phase = "anticipation";
    input.phaseT = 1;
    sampleWeaponPerformance(input, sample);
    expect(sample.bodyForward).toBeLessThan(-0.05);
    expect(sample.bodyTurn).toBeLessThan(-0.19);
    expect(sample.frontFootForward).toBeLessThan(-0.11);

    input.phase = "active";
    sampleWeaponPerformance(input, sample);
    expect(sample.bodyForward).toBeGreaterThan(0.1);
    expect(sample.bodyTurn).toBeGreaterThan(0.16);
    expect(sample.frontFootForward).toBeGreaterThan(0.18);
    expect(sample.backFootForward).toBeLessThan(-0.14);
  });

  it("keeps kunai size 72 and reuses the shipped pistol beats around its end hook", async () => {
    const {
      PISTOL_END_HOOK_PIVOT,
      WEAPON_FLOURISH_SPECS,
      weaponFlourishPivotFor,
      weaponFlourishSpecFor,
    } = await import("../packages/client/src/sprites/pose-language.js");
    const kunai = WEAPONS["x2-kunai"];
    if (!kunai) throw new Error("missing kunai fixture");
    const spec = weaponFlourishSpecFor(kunai);
    expect(kunai.displayLength).toBe(72);
    expect(kunai.performance?.flourishStyle).toBe("pistol-end-hook");
    expect(spec.draw).toBe(WEAPON_FLOURISH_SPECS.pistol.draw);
    expect(spec.afterAttack).toBe(WEAPON_FLOURISH_SPECS.pistol.afterAttack);
    expect(weaponFlourishPivotFor(kunai, "draw", true)).toBe(PISTOL_END_HOOK_PIVOT);
    expect(weaponFlourishPivotFor(kunai, "after-attack", true)).toBe(PISTOL_END_HOOK_PIVOT);
    expect(weaponFlourishPivotFor(kunai, "idle-settle", true)).toBeUndefined();
    expect(weaponFlourishPivotFor(kunai, "draw", false)).toBeUndefined();
    expect(PISTOL_END_HOOK_PIVOT).toEqual({ x: 0.073, y: 0.5 });
  });
});

describe("B29 dual-gun firing separation", () => {
  it("holds a clear vertical split during firing and returns to the authored neutral mounts", () => {
    expect(AUTHORED_DUAL_GUN_VERTICAL_SPLIT_BODY_FRAC * 76 * 2).toBeGreaterThan(12);
    for (const id of AUTHORED_DUAL_GUNS) {
      const weapon = WEAPONS[id];
      if (!weapon) throw new Error(`missing authored dual-gun fixture: ${id}`);
      expect(authoredDualGunVerticalOffset(weapon, 0, 60), id).toBeLessThan(-6);
      expect(authoredDualGunVerticalOffset(weapon, 1, 60), id).toBeGreaterThan(6);
      expect(
        authoredDualGunVerticalOffset(weapon, 0, AUTHORED_DUAL_GUN_VERTICAL_SPLIT_MS),
      ).toBe(0);
      expect(
        authoredDualGunVerticalOffset(weapon, 1, AUTHORED_DUAL_GUN_VERTICAL_SPLIT_MS),
      ).toBe(0);

      const leadFiring = weaponMuzzleGripOffset(weapon, 0, {
        aimX: 1,
        aimY: 0,
        facing: 1,
        recoilElapsedMs: 60,
        recoilHand: 0,
      });
      const offFiring = weaponMuzzleGripOffset(weapon, 1, {
        aimX: 1,
        aimY: 0,
        facing: 1,
        recoilElapsedMs: 60,
        recoilHand: 0,
      });
      const leadSettled = weaponMuzzleGripOffset(weapon, 0, {
        aimX: 1,
        aimY: 0,
        facing: 1,
        recoilElapsedMs: AUTHORED_DUAL_GUN_VERTICAL_SPLIT_MS,
        recoilHand: 0,
      });
      const offSettled = weaponMuzzleGripOffset(weapon, 1, {
        aimX: 1,
        aimY: 0,
        facing: 1,
        recoilElapsedMs: AUTHORED_DUAL_GUN_VERTICAL_SPLIT_MS,
        recoilHand: 0,
      });
      expect(
        offFiring.y - leadFiring.y - (offSettled.y - leadSettled.y),
        `${id}: added two-gun vertical read`,
      ).toBeCloseTo(AUTHORED_DUAL_GUN_VERTICAL_SPLIT_BODY_FRAC * 76 * 2, 8);
    }
  });
});

describe("B29 revolver hammer beats", () => {
  it("fits a visible weapon/thumb pulse inside every classified revolver cadence", async () => {
    const {
      createRevolverHammerBeatSample,
      revolverHammerBeatDurationMs,
      sampleRevolverHammerBeat,
    } = await import("../packages/client/src/sprites/pose-language.js");
    for (const id of [
      ...ONE_HANDED_REVOLVERS,
      "x2-twin-maw-greenerbore",
      "x2-hallowbore-coachgun",
    ]) {
      const weapon = WEAPONS[id];
      if (!weapon?.gun) throw new Error(`missing revolver fixture: ${id}`);
      const durationMs = revolverHammerBeatDurationMs(weapon.gun.fireRate);
      expect(durationMs, `${id}: pulse stays inside cadence`).toBeLessThan(
        weapon.gun.fireRate * 1_000,
      );
      const sample = createRevolverHammerBeatSample();
      sampleRevolverHammerBeat(weapon, durationMs * 0.38, weapon.displayLength, false, sample);
      expect(sample.active, id).toBe(true);
      expect(Math.abs(sample.weaponRotationRad), `${id}: visible hammer-end weapon pulse`).toBeGreaterThan(
        0.13,
      );
      expect(Math.abs(sample.handForward), `${id}: thumb/support-hand motion`).toBeGreaterThan(3);
      expect(Math.abs(sample.handLateral), `${id}: thumb/support-hand lift`).toBeGreaterThan(2);
    }
  });

  it("makes Twin-Maw's per-gun fan motion larger than a one-handed thumb beat", async () => {
    const { createRevolverHammerBeatSample, sampleRevolverHammerBeat } = await import(
      "../packages/client/src/sprites/pose-language.js"
    );
    const oneHanded = WEAPONS["x-gun-revolver-cannon"];
    const twinMaw = WEAPONS["x2-twin-maw-greenerbore"];
    if (!oneHanded || !twinMaw) throw new Error("missing revolver comparison fixtures");
    const one = createRevolverHammerBeatSample();
    const pair = createRevolverHammerBeatSample();
    sampleRevolverHammerBeat(oneHanded, 58, 100, false, one);
    sampleRevolverHammerBeat(twinMaw, 58, 100, false, pair);
    expect(Math.abs(pair.handForward)).toBeGreaterThan(Math.abs(one.handForward) * 1.75);
    expect(Math.abs(pair.handLateral)).toBeGreaterThan(Math.abs(one.handLateral) * 1.75);
  });
});
