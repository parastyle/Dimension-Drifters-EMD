import {
  ACTIVE_WEAPON_CATALOG_IDS,
  ACTIVE_WEAPON_SUBCLASS_GROUPS,
  WEAPON_CATALOG_IDS,
  WEAPON_CLASS_ORDER,
  WEAPON_SUBCLASS_GROUPS,
  WEAPONS,
  weaponSubclassFromFamily,
  weaponTaxonomyFor,
} from "@dd/shared";
import { describe, expect, it } from "vitest";

describe("codegen-backed weapon subclass taxonomy", () => {
  it("resolves every canonical weapon to exactly one subclass and one class", () => {
    const covered = WEAPON_SUBCLASS_GROUPS.flatMap((group) => group.weaponIds);
    expect(covered).toHaveLength(WEAPON_CATALOG_IDS.length);
    expect(new Set(covered).size).toBe(WEAPON_CATALOG_IDS.length);
    expect(new Set(covered)).toEqual(new Set(WEAPON_CATALOG_IDS));

    for (const [id, weapon] of Object.entries(WEAPONS)) {
      const resolved = weaponTaxonomyFor(weapon);
      expect(weapon.tags.weaponClass, id).toBe(resolved.weaponClass);
      expect(weapon.tags.subclass, id).toBe(resolved.subclass);
      expect(WEAPON_CLASS_ORDER, id).toContain(weapon.tags.weaponClass);
      expect(weapon.tags.subclass.trim(), id).not.toBe("");
    }
  });

  it("handles an unseen family without throwing and applies the singleton law", () => {
    const unseen = {
      id: "future-plasma-spoon",
      tags: {
        classPool: "ranged" as const,
        family: "plasma-spoon",
      },
    };
    expect(weaponSubclassFromFamily(unseen.tags.family)).toBe("Plasma Spoon");
    expect(() => weaponTaxonomyFor(unseen)).not.toThrow();
    expect(weaponTaxonomyFor(unseen)).toEqual({
      weaponClass: "Special",
      subclass: "Special",
    });
  });

  it("makes subclass to class a clean hierarchy with no non-Special singleton", () => {
    const owner = new Map<string, string>();
    for (const group of WEAPON_SUBCLASS_GROUPS) {
      const existing = owner.get(group.subclass);
      expect(existing, group.subclass).toBeUndefined();
      owner.set(group.subclass, group.weaponClass);
      if (group.weaponIds.length === 1) expect(group.weaponClass).toBe("Special");
      if (group.weaponClass === "Special") expect(group.subclass).toBe("Special");
    }
    for (const group of ACTIVE_WEAPON_SUBCLASS_GROUPS) {
      if (group.weaponIds.length === 1) expect(group.weaponClass).toBe("Special");
    }
  });

  it("orders one active page per subclass within class and covers the full active roster", () => {
    const active = ACTIVE_WEAPON_SUBCLASS_GROUPS.flatMap((group) => group.weaponIds);
    expect(active).toHaveLength(ACTIVE_WEAPON_CATALOG_IDS.length);
    expect(new Set(active)).toEqual(new Set(ACTIVE_WEAPON_CATALOG_IDS));

    const classRank = new Map(WEAPON_CLASS_ORDER.map((weaponClass, index) => [weaponClass, index]));
    for (let index = 1; index < ACTIVE_WEAPON_SUBCLASS_GROUPS.length; index++) {
      const previous = ACTIVE_WEAPON_SUBCLASS_GROUPS[index - 1];
      const current = ACTIVE_WEAPON_SUBCLASS_GROUPS[index];
      if (!previous || !current) continue;
      const previousRank = classRank.get(previous.weaponClass) ?? Number.MAX_SAFE_INTEGER;
      const currentRank = classRank.get(current.weaponClass) ?? Number.MAX_SAFE_INTEGER;
      expect(currentRank, `${previous.subclass} -> ${current.subclass}`).toBeGreaterThanOrEqual(
        previousRank,
      );
      if (currentRank === previousRank) {
        expect(
          previous.subclass.localeCompare(current.subclass),
          `${previous.subclass} -> ${current.subclass}`,
        ).toBeLessThan(0);
      }
    }
  });
});
