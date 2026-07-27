import { describe, expect, it } from "vitest";
import {
  addImpulse,
  SERVER_MOTION_IMPULSE_TICKS,
  stepImpulse,
  stepSteeredMovement,
  WEAPONS,
} from "../packages/shared/src/index.js";

const TICK_SECONDS = 0.05;

describe("B45 physical gun recoil catalog", () => {
  it.each([
    ["x2-ashfall-peacemaker", 41, "pistol nudge"],
    ["x2-buckshot-briar", 146, "shotgun shove"],
    ["x2-mesa-hand-cannon", 143, "hand-cannon shove"],
    ["x2-sunbreaker-railgun", 213, "railgun push"],
    ["x2-calamity-howitzer", 233, "heavy-cannon push"],
    ["x2-hellbore-gatling", 13, "rapid-fire tick"],
  ] as const)("%s authors %i px/s (%s)", (weaponId, recoil) => {
    expect(WEAPONS[weaponId]?.recoil).toBe(recoil);
  });

  it("covers the post-B63/B66 ranged catalog while melee/caster roots stay planted", () => {
    const definitions = Object.values(WEAPONS);
    const rangedGuns = definitions.filter(
      (weapon) => weapon.tags.classPool === "ranged" && weapon.gun,
    );
    const rangedBeams = definitions.filter(
      (weapon) => weapon.tags.classPool === "ranged" && weapon.beam,
    );
    // Literal cohort tripwires ensure new ranged mechanisms enter the every-weapon recoil law.
    expect(rangedGuns).toHaveLength(143);
    expect(rangedBeams).toHaveLength(6);
    expect(rangedGuns.every((weapon) => (weapon.recoil ?? 0) > 0)).toBe(true);
    expect(rangedBeams.every((weapon) => (weapon.recoil ?? 0) > 0)).toBe(true);
    expect(
      definitions
        .filter((weapon) => weapon.tags.classPool !== "ranged")
        .every((weapon) => (weapon.recoil ?? 0) === 0),
    ).toBe(true);
  });

  it("retains the old camera-kick values independently from physical recoil", () => {
    expect(WEAPONS["x-gun-revolver-cannon"]?.gun?.recoil).toBe(0.004);
    expect(WEAPONS["x-gun-coffin-shotgun"]?.gun?.recoil).toBe(0.0035);
    expect(WEAPONS["x-gun-gatling"]?.gun?.recoil).toBe(0.0006);
  });
});

describe("B45 recoil feel on the shared impulse rail", () => {
  it("settles the heaviest catalog push inside the classified server-motion window", () => {
    let position = { x: 1_000, y: 1_000 };
    let velocity = { vx: -(WEAPONS["x2-calamity-howitzer"]?.recoil ?? 0), vy: 0 };
    let settledAt = 0;
    for (let tick = 1; tick <= SERVER_MOTION_IMPULSE_TICKS; tick++) {
      const next = stepImpulse(position, velocity, TICK_SECONDS);
      position = next;
      velocity = next;
      if (velocity.vx === 0 && settledAt === 0) settledAt = tick;
    }
    expect(settledAt).toBeGreaterThan(0);
    expect(settledAt).toBeLessThanOrEqual(SERVER_MOTION_IMPULSE_TICKS);
    expect(position.x).toBeLessThan(1_000);
  });

  it("composes forward input with opposite-aim recoil so the player can lean into the shove", () => {
    const start = { x: 1_000, y: 1_000 };
    const forward = stepSteeredMovement(start, { vx: 0, vy: 0 }, { dx: 1, dy: 0 }, TICK_SECONDS);
    const recoil = { vx: -(WEAPONS["x-gun-revolver-cannon"]?.recoil ?? 0), vy: 0 };
    const passive = stepImpulse(start, recoil, TICK_SECONDS);
    const composed = stepImpulse(forward, recoil, TICK_SECONDS);

    expect(passive.x).toBeLessThan(start.x);
    expect(composed.x).toBeGreaterThan(start.x);
    expect(composed.x).toBeLessThan(forward.x);
  });

  it("turns rapid-fire ticks into bounded sustained creep instead of one large launch", () => {
    const recoil = WEAPONS["x2-hellbore-gatling"]?.recoil ?? 0;
    const fireRate = WEAPONS["x2-hellbore-gatling"]?.gun?.fireRate ?? 1;
    let position = { x: 1_000, y: 1_000 };
    let velocity = { vx: 0, vy: 0 };
    let nextShotSeconds = 0;
    for (let tick = 0; tick < 40; tick++) {
      const nowSeconds = tick * TICK_SECONDS;
      while (nowSeconds + 1e-9 >= nextShotSeconds) {
        velocity = addImpulse(velocity, -recoil, 0);
        nextShotSeconds += fireRate;
      }
      const next = stepImpulse(position, velocity, TICK_SECONDS);
      position = next;
      velocity = next;
    }
    const travel = 1_000 - position.x;
    expect(travel).toBeGreaterThan(10);
    expect(travel).toBeLessThan(80);
    expect(Math.abs(velocity.vx)).toBeLessThan(80);
  });

  it("keeps ranged beam pressure subtle over a full second of channeling", () => {
    const recoilPerSecond = WEAPONS["x2-mirage-coilrifle"]?.recoil ?? 0;
    let position = { x: 1_000, y: 1_000 };
    let velocity = { vx: 0, vy: 0 };
    for (let tick = 0; tick < 20; tick++) {
      velocity = addImpulse(velocity, -recoilPerSecond * TICK_SECONDS, 0);
      const next = stepImpulse(position, velocity, TICK_SECONDS);
      position = next;
      velocity = next;
    }
    expect(1_000 - position.x).toBeGreaterThan(1);
    expect(1_000 - position.x).toBeLessThan(6);
  });
});
