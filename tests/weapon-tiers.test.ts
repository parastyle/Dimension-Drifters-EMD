import { readFileSync } from "node:fs";
import {
  ACTIVE_WEAPON_CATALOG_IDS,
  derivedWeaponTier,
  WEAPONS,
  WEAPON_TIER_MANUAL_FLOORS,
  weaponTierPowerBudget,
} from "@dd/shared";
import { describe, expect, it } from "vitest";

interface WeaponTierInput {
  version: number;
  formula: string;
  tiers: Record<string, number>;
}

describe("B20 L5 authored weapon tiers", () => {
  it("keeps the deterministic power-budget derivation and manual review pass pinned", () => {
    for (const id of ACTIVE_WEAPON_CATALOG_IDS) {
      const weapon = WEAPONS[id];
      expect(weapon, id).toBeDefined();
      const first = weaponTierPowerBudget(weapon);
      const second = weaponTierPowerBudget(weapon);
      expect(Number.isFinite(first), id).toBe(true);
      expect(second, id).toBe(first);
      expect(weapon.tier, id).toBe(derivedWeaponTier(weapon));
    }
    expect(WEAPON_TIER_MANUAL_FLOORS).toEqual({
      "tombstone-greatsword": 3,
      "x2-abyssal-apocrypha": 4,
      "x2-choir-iron-greataxe": 3,
      "x2-quarry-splitter-bardiche": 3,
    });
  });

  it("emits every active catalog assignment from the generator input", () => {
    const input = JSON.parse(
      readFileSync("data/weapon-tiers.json", "utf8"),
    ) as WeaponTierInput;
    expect(input).toMatchObject({
      version: 1,
      formula: "b20-l5-tier-budget-v1",
    });
    for (const id of ACTIVE_WEAPON_CATALOG_IDS) {
      expect(input.tiers[id], id).toBe(WEAPONS[id]?.tier);
    }
  });

  it("pins a populated, non-dominant five-tier census", () => {
    const counts = [1, 2, 3, 4, 5].map(
      (tier) =>
        ACTIVE_WEAPON_CATALOG_IDS.filter((id) => WEAPONS[id]?.tier === tier).length,
    );
    // The twenty-one active catalog additions are retained across the authored five-tier distribution.
    expect(counts).toEqual([75, 77, 68, 75, 65]);
    expect(counts.every((count) => count > 0)).toBe(true);
    expect(Math.max(...counts)).toBeLessThanOrEqual(ACTIVE_WEAPON_CATALOG_IDS.length / 2);
  });

  it("keeps wacky weapons honest while numeric and reviewed outliers stay high", () => {
    expect(WEAPONS["x2-confetti-cannon"]?.tier).toBe(1);
    expect(WEAPONS["x2-fish-launcher"]?.tier).toBe(1);
    expect(WEAPONS["x2-unicorn-rainbow-beam"]?.tier).toBe(1);
    expect(WEAPONS["x2-exploding-present-lobber"]?.tier).toBe(1);
    expect(WEAPONS["x2-squeaky-mallet"]?.tier).toBe(1);
    expect(WEAPONS["x2-bubble-wand-swarm-caster"]?.tier).toBe(4);
    expect(WEAPONS["x2-abyssal-apocrypha"]?.tier).toBe(4);
    expect(WEAPONS["x2-galvanic-overcasters"]?.tier).toBe(5);
  });
});
