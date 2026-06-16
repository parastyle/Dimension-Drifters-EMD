import {
  CON_HP_PER,
  CON_REGEN_PER,
  deriveStats,
  PLAYER_MAX_HP,
  PLAYER_REGEN,
  XP_BASE,
  xpToNextLevel,
} from "@dd/shared";
import { describe, expect, it } from "vitest";

describe("xpToNextLevel (§12 curve)", () => {
  it("level 1→2 costs XP_BASE", () => {
    expect(xpToNextLevel(1)).toBe(XP_BASE);
  });
  it("is strictly increasing (geometric)", () => {
    for (let lvl = 1; lvl < 30; lvl++) {
      expect(xpToNextLevel(lvl + 1)).toBeGreaterThan(xpToNextLevel(lvl));
    }
  });
  it("treats level < 1 as level 1 (no negative exponent)", () => {
    expect(xpToNextLevel(0)).toBe(XP_BASE);
  });
});

describe("deriveStats (CON survivability, §11)", () => {
  it("is the base at CON 1", () => {
    expect(deriveStats({ con: 1 })).toEqual({ maxHp: PLAYER_MAX_HP, regen: PLAYER_REGEN });
  });
  it("adds CON_HP_PER / CON_REGEN_PER per point over 1", () => {
    const s = deriveStats({ con: 4 });
    expect(s.maxHp).toBeCloseTo(PLAYER_MAX_HP + CON_HP_PER * 3, 6);
    expect(s.regen).toBeCloseTo(PLAYER_REGEN + CON_REGEN_PER * 3, 6);
  });
});
