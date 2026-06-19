import {
  CON_HP_PER,
  LEVEL_CAP,
  LEVELUP_WINDOW_SECONDS,
  PlayerState,
  SIGNATURE_INTERVAL,
  xpToNextLevel,
} from "@dd/shared";
import { describe, expect, it } from "vitest";
import { allocate, consumeFlex, levelUpPlayer } from "./progression.js";

// §12 the per-run progression maths (XP → level → auto-allocation → flex/signature owed) are the most
// consequential per-tick mutations and had ZERO direct coverage (only pure deriveStats was tested). An
// off-by-one in the level loop or a dropped flex point silently corrupts every run.

const fresh = () => new PlayerState(); // defaults: level 1, xp 0, xpToNext 6, 1/1/1/1/1, hp/maxHp 100

describe("levelUpPlayer (§12)", () => {
  it("a single level: carries the xp remainder, +1 class +1 req, owes one flex point", () => {
    const p = fresh();
    levelUpPlayer(p, p.xpToNext); // exactly one level's worth
    expect(p.level).toBe(2);
    expect(p.xp).toBe(0);
    expect(p.str).toBe(2); // M0 class attr auto +1
    expect(p.con).toBe(2); // M0 req attr auto +1
    expect(p.flexPending).toBe(1);
    expect(p.xpToNext).toBeCloseTo(xpToNextLevel(2), 6);
    expect(p.flexTimer).toBe(LEVELUP_WINDOW_SECONDS);
  });

  it("carries the leftover xp below the next threshold", () => {
    const p = fresh();
    levelUpPlayer(p, p.xpToNext + 4); // one level + a 4-xp remainder (< the new, larger xpToNext)
    expect(p.level).toBe(2);
    expect(p.xp).toBe(4);
  });

  it("a multi-level single call owes one flex point per level gained", () => {
    const p = fresh();
    levelUpPlayer(p, 100); // several levels in one grant
    expect(p.level).toBeGreaterThan(2);
    expect(p.flexPending).toBe(p.level - 1); // one per level over the L1 start
    expect(p.xp).toBeLessThan(p.xpToNext); // never leaves the player over the threshold
  });

  it("grants exactly one signature pick at each 5th level", () => {
    const p = fresh();
    // enough to blow past the cap → every multiple-of-5 level (5,10,…,30) granted one sig
    levelUpPlayer(p, 1e9);
    expect(p.level).toBe(LEVEL_CAP);
    expect(p.sigPending).toBe(Math.floor(LEVEL_CAP / SIGNATURE_INTERVAL)); // 30/5 = 6
  });

  it("clamps at LEVEL_CAP, zeroes leftover xp, and a further grant is a no-op", () => {
    const p = fresh();
    levelUpPlayer(p, 1e9);
    expect(p.level).toBe(LEVEL_CAP);
    expect(p.xp).toBe(0);
    const before = { level: p.level, xp: p.xp, str: p.str };
    levelUpPlayer(p, 1e9); // capped → nothing changes
    expect({ level: p.level, xp: p.xp, str: p.str }).toEqual(before);
  });
});

describe("allocate (§12 CON → maxHp)", () => {
  it("raising CON raises maxHp by CON_HP_PER and tops up current hp by the same delta", () => {
    const p = fresh();
    allocate(p, "con", 1);
    expect(p.maxHp).toBe(100 + CON_HP_PER);
    expect(p.hp).toBe(100 + CON_HP_PER);
  });

  it("a hurt player gains only the maxHp DELTA, not a full heal", () => {
    const p = fresh();
    p.hp = 50;
    allocate(p, "con", 1);
    expect(p.maxHp).toBe(100 + CON_HP_PER);
    expect(p.hp).toBe(50 + CON_HP_PER); // gained the +8, still hurt
  });
});

describe("consumeFlex (§12 pick window)", () => {
  it("decrements pending and refreshes the window while more picks are owed, closes it when done", () => {
    const p = fresh();
    p.flexPending = 2;
    consumeFlex(p);
    expect(p.flexPending).toBe(1);
    expect(p.flexTimer).toBe(LEVELUP_WINDOW_SECONDS); // still owed → window stays open
    consumeFlex(p);
    expect(p.flexPending).toBe(0);
    expect(p.flexTimer).toBe(0); // nothing owed → window closes
  });

  it("keeps the window open for a still-owed signature pick", () => {
    const p = fresh();
    p.flexPending = 1;
    p.sigPending = 1;
    consumeFlex(p);
    expect(p.flexPending).toBe(0);
    expect(p.flexTimer).toBe(LEVELUP_WINDOW_SECONDS); // sig still owed → window stays open
  });
});
