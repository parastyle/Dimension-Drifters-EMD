import {
  DISASSEMBLY_VALUE_BY_TIER,
  DISASSEMBLY_VALUE_MAX,
  DISASSEMBLY_VALUE_MIN,
  weaponDisassemblyValue,
  WEAPONS,
} from "@dd/shared";
import { describe, expect, it } from "vitest";

describe("B20 L3 weapon disassembly curve", () => {
  it("is deterministic, authored-tier based, and bounded", () => {
    for (const weapon of Object.values(WEAPONS)) {
      const value = weaponDisassemblyValue(weapon);
      expect(value).toBe(DISASSEMBLY_VALUE_BY_TIER[weapon.tier]);
      expect(value).toBeGreaterThanOrEqual(DISASSEMBLY_VALUE_MIN);
      expect(value).toBeLessThanOrEqual(DISASSEMBLY_VALUE_MAX);
      expect(weaponDisassemblyValue(weapon.id)).toBe(value);
    }
  });

  it("reads only the authored tier field and rejects unknown ids", () => {
    const baseline = WEAPONS["rusty-cleaver"];
    expect(baseline).toBeDefined();
    expect(
      ([1, 2, 3, 4, 5] as const).map((tier) =>
        weaponDisassemblyValue({ ...(baseline as NonNullable<typeof baseline>), tier }),
      ),
    ).toEqual([4, 8, 16, 32, 60]);
    expect(weaponDisassemblyValue("missing-weapon")).toBe(0);
    expect(weaponDisassemblyValue("tombstone-greatsword")).toBeGreaterThan(
      weaponDisassemblyValue("rusty-cleaver"),
    );
  });
});
