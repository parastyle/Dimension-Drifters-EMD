import { BOSS_WALL_ARC, BOSS_WALL_COUNT, bossPhaseForHp, bulletWallAngles } from "@dd/shared";
import { describe, expect, it } from "vitest";

describe("bossPhaseForHp (§16 phase thresholds)", () => {
  it("paces (P1) above 50% HP", () => {
    expect(bossPhaseForHp(1)).toBe(1);
    expect(bossPhaseForHp(0.51)).toBe(1);
  });

  it("punch-slams (P2) at or below 50%, down to 20%", () => {
    expect(bossPhaseForHp(0.5)).toBe(2);
    expect(bossPhaseForHp(0.21)).toBe(2);
  });

  it("enrages (P3) at or below 20%", () => {
    expect(bossPhaseForHp(0.2)).toBe(3);
    expect(bossPhaseForHp(0)).toBe(3);
  });

  it("only ESCALATES as HP drops (never de-phases)", () => {
    let prev = 1;
    for (let f = 1; f >= 0; f -= 0.05) {
      const p = bossPhaseForHp(f);
      expect(p).toBeGreaterThanOrEqual(prev);
      prev = p;
    }
  });
});

describe("bulletWallAngles (§16 P1 bullet-wall + weave-gap)", () => {
  // The full evenly-spaced fan the wall is carved from (base 0).
  const fullFan = (count: number, arc: number): number[] =>
    Array.from({ length: count }, (_, i) => -arc / 2 + (arc * i) / (count - 1));

  it("fires count−2 slugs (a 2-wide weave-gap is omitted)", () => {
    expect(bulletWallAngles(0, BOSS_WALL_COUNT, BOSS_WALL_ARC, 3)).toHaveLength(
      BOSS_WALL_COUNT - 2,
    );
  });

  it("the gap is a contiguous hole (slots gapIdx and gapIdx+1) the squad threads", () => {
    const all = fullFan(BOSS_WALL_COUNT, BOSS_WALL_ARC);
    const fired = bulletWallAngles(0, BOSS_WALL_COUNT, BOSS_WALL_ARC, 3);
    expect(fired).not.toContain(all[3]);
    expect(fired).not.toContain(all[4]);
    expect(fired).toContain(all[2]); // the slugs either side still fire
    expect(fired).toContain(all[5]);
  });

  it("stays centred on the base angle (every slug within base ± arc/2)", () => {
    const base = 1.0;
    for (const ang of bulletWallAngles(base, BOSS_WALL_COUNT, BOSS_WALL_ARC, 2)) {
      expect(ang).toBeGreaterThanOrEqual(base - BOSS_WALL_ARC / 2 - 1e-9);
      expect(ang).toBeLessThanOrEqual(base + BOSS_WALL_ARC / 2 + 1e-9);
    }
  });

  it("wraps an out-of-range gap index (any fire-seq is safe) and still fires", () => {
    expect(() => bulletWallAngles(0, BOSS_WALL_COUNT, BOSS_WALL_ARC, 999)).not.toThrow();
    expect(bulletWallAngles(0, BOSS_WALL_COUNT, BOSS_WALL_ARC, 999).length).toBeGreaterThan(0);
  });

  it("clamps a tiny count to a minimum wall (≥4 slots)", () => {
    // count 2 → treated as 4 slots minus the 2-wide gap = 2 slugs.
    expect(bulletWallAngles(0, 2, 1.5, 0)).toHaveLength(2);
  });
});
