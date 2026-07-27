import {
  DODGE_PROFILES,
  EMPTY_RELIC_STACKS,
  ROLL_DURATION_TICKS,
  relicCritAdd,
  relicDodgeCooldown,
  relicEnergyCapacity,
  relicEnergyRegenAdd,
  relicHpRegenAdd,
  relicJumpCount,
  relicLuckMultiplier,
  relicMoveSpeed,
  relicParryRadius,
  relicRollSpeedAtTick,
  resolveOneShotProtection,
  resolveRelicRevive,
} from "@dd/shared";
import { describe, expect, it } from "vitest";

const relics = (patch: Partial<typeof EMPTY_RELIC_STACKS>) => ({
  ...EMPTY_RELIC_STACKS,
  ...patch,
});

describe("B20 L2 common relic stacking", () => {
  it("stacks additive lines and caps malformed counts", () => {
    expect(relicEnergyCapacity(relics({ energyPool: 3 }))).toBe(
      relicEnergyCapacity(EMPTY_RELIC_STACKS) + 30,
    );
    expect(relicEnergyRegenAdd(relics({ energyRegen: 4 }))).toBeCloseTo(3.2);
    expect(relicParryRadius(relics({ parryReach: 2 }))).toBe(
      relicParryRadius(EMPTY_RELIC_STACKS) + 16,
    );
    expect(relicHpRegenAdd(relics({ hpRegen: 3 }))).toBeCloseTo(0.75);
    expect(relicLuckMultiplier(relics({ luck: 2 }))).toBeCloseTo(1.1);
    expect(relicCritAdd(relics({ crit: 2 }))).toBeCloseTo(0.04);
    expect(relicJumpCount(relics({ jumpCount: 2 }))).toBe(2);
    expect(relicMoveSpeed(relics({ moveSpeed: 20 }))).toBe(relicMoveSpeed(EMPTY_RELIC_STACKS));
    expect(relicDodgeCooldown(relics({ moveSpeed: 2 }))).toBeCloseTo(
      relicDodgeCooldown(EMPTY_RELIC_STACKS) - 0.06,
    );
    expect(relicJumpCount(relics({ jumpCount: 255 }))).toBe(20);
  });
});

describe("B20 L2 rare relic edges", () => {
  it("changes dodge distance and recovery while the fair roll duration stays shared", () => {
    const baseSpeed = relicRollSpeedAtTick(EMPTY_RELIC_STACKS, 0);
    expect(relicRollSpeedAtTick(relics({ activeDodge: "dodge-shuffle" }), 0)).toBeLessThan(
      baseSpeed,
    );
    expect(
      relicRollSpeedAtTick(relics({ activeDodge: "dodge-bloodhound-step" }), 0),
    ).toBeGreaterThan(baseSpeed);
    expect(relicDodgeCooldown(relics({ activeDodge: "dodge-shuffle" }))).toBeLessThan(
      relicDodgeCooldown(EMPTY_RELIC_STACKS),
    );
    expect(
      relicDodgeCooldown(relics({ activeDodge: "dodge-bloodhound-step", dodgeRecovery: 2 })),
    ).toBeCloseTo(DODGE_PROFILES["dodge-bloodhound-step"].cooldownSeconds - 0.12);
    expect(ROLL_DURATION_TICKS).toBeGreaterThan(0);
    expect(
      Object.values(DODGE_PROFILES)
        .filter((profile) => profile.id)
        .map((profile) => profile.presentation),
    ).toEqual(["shuffle", "flip", "phase", "bloodhound"]);
    for (const profile of Object.values(DODGE_PROFILES)) {
      expect(profile).not.toHaveProperty("iframeDuration");
    }
  });

  it("consumes a revive once and refuses missing or spent ownership", () => {
    expect(resolveRelicRevive(100, true, true)).toEqual({
      revived: true,
      hp: 30,
      available: false,
    });
    expect(resolveRelicRevive(100, true, false)).toEqual({
      revived: false,
      hp: 0,
      available: false,
    });
    expect(resolveRelicRevive(100, false, true)).toEqual({
      revived: false,
      hp: 0,
      available: true,
    });
  });

  it("blocks only ready lethal hits that begin above the HP threshold", () => {
    expect(resolveOneShotProtection(35, 100, 35, true, true)).toEqual({
      hp: 1,
      triggered: true,
    });
    expect(resolveOneShotProtection(34.9, 100, 40, true, true)).toEqual({
      hp: 0,
      triggered: false,
    });
    expect(resolveOneShotProtection(80, 100, 30, true, true)).toEqual({
      hp: 50,
      triggered: false,
    });
    expect(resolveOneShotProtection(80, 100, 90, true, false)).toEqual({
      hp: 0,
      triggered: false,
    });
  });
});
