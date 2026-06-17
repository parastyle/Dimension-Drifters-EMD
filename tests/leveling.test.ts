import {
  ATTRS,
  CON_HP_PER,
  CON_REGEN_PER,
  deriveStats,
  isAttr,
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

describe("isAttr (§12 untrusted-input guard)", () => {
  it("accepts every real attribute id", () => {
    for (const a of ATTRS) expect(isAttr(a)).toBe(true);
  });

  it("rejects unknown strings, wrong case, and empties", () => {
    for (const v of ["", "hp", "STR", "strength", "luck"]) expect(isAttr(v)).toBe(false);
  });

  it("rejects non-string values (a malformed network message field)", () => {
    for (const v of [undefined, null, 0, 1, {}, [], true]) expect(isAttr(v)).toBe(false);
  });

  it("narrows the type so a validated value indexes attribute records", () => {
    const msg: unknown = "dex";
    if (isAttr(msg)) {
      const spread: Record<typeof msg, number> = { str: 1, dex: 2, int: 1, con: 1, luk: 1 };
      expect(spread[msg]).toBe(2); // compiles only because `msg` narrowed to Attr
    }
  });
});
