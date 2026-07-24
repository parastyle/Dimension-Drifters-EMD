import {
  DISASSEMBLY_VALUE_MAX,
  DISASSEMBLY_VALUE_MIN,
  weaponDisassemblyValue,
  WEAPONS,
} from "@dd/shared";
import { describe, expect, it } from "vitest";

describe("B20 L3 weapon disassembly curve", () => {
  it("is deterministic, damage-budget based, and bounded", () => {
    for (const weapon of Object.values(WEAPONS)) {
      const value = weaponDisassemblyValue(weapon);
      expect(value).toBeGreaterThanOrEqual(DISASSEMBLY_VALUE_MIN);
      expect(value).toBeLessThanOrEqual(DISASSEMBLY_VALUE_MAX);
      expect(weaponDisassemblyValue(weapon.id)).toBe(value);
    }
  });

  it("rejects unknown ids and rewards a larger authored budget", () => {
    expect(weaponDisassemblyValue("missing-weapon")).toBe(0);
    expect(weaponDisassemblyValue("tombstone-greatsword")).toBeGreaterThan(
      weaponDisassemblyValue("rusty-cleaver"),
    );
  });
});
