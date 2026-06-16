import {
  coneAngles,
  ENEMY_KINDS,
  enemyHpScale,
  inMeleeArc,
  nearestPoint,
  pickEnemyKind,
  spawnInterval,
  toughChance,
} from "@dd/shared";
import { describe, expect, it } from "vitest";

describe("inMeleeArc", () => {
  const origin = { x: 0, y: 0 };
  it("hits a target dead ahead within range", () => {
    expect(inMeleeArc(origin, 1, 0, { x: 80, y: 0 }, 120, 0.8)).toBe(true);
  });
  it("misses a target beyond range", () => {
    expect(inMeleeArc(origin, 1, 0, { x: 200, y: 0 }, 120, 0.8)).toBe(false);
  });
  it("misses a target behind (outside the arc)", () => {
    expect(inMeleeArc(origin, 1, 0, { x: -80, y: 0 }, 120, 0.8)).toBe(false);
  });
  it("point-blank always counts regardless of aim", () => {
    expect(inMeleeArc(origin, 1, 0, { x: 0, y: 0 }, 120, 0.1)).toBe(true);
  });
  it("respects the arc half-angle boundary", () => {
    // target at 45° (π/4 ≈ 0.785 rad) off the +x aim
    const t = { x: 70, y: 70 };
    expect(inMeleeArc(origin, 1, 0, t, 200, 0.9)).toBe(true); // 0.9 > 0.785 → inside
    expect(inMeleeArc(origin, 1, 0, t, 200, 0.6)).toBe(false); // 0.6 < 0.785 → outside
  });
});

describe("pickEnemyKind", () => {
  const weighted = Object.keys(ENEMY_KINDS).filter((k) => (ENEMY_KINDS[k]?.weight ?? 0) > 0);
  const zeroWeight = Object.keys(ENEMY_KINDS).filter((k) => (ENEMY_KINDS[k]?.weight ?? 0) === 0);

  it("only ever returns a positively-weighted kind across the [0,1) roll range", () => {
    for (let r = 0; r < 1; r += 0.01) {
      expect(weighted).toContain(pickEnemyKind(r));
    }
  });
  it("never returns a weight:0 kind (boss/dummy must not random-spawn)", () => {
    for (let r = 0; r < 1; r += 0.005) {
      expect(zeroWeight).not.toContain(pickEnemyKind(r));
    }
  });
  it("is deterministic for a given roll", () => {
    expect(pickEnemyKind(0.42)).toBe(pickEnemyKind(0.42));
  });
});

describe("nearestPoint", () => {
  it("returns the closest target", () => {
    expect(
      nearestPoint({ x: 0, y: 0 }, [
        { x: 100, y: 0 },
        { x: 10, y: 0 },
        { x: 50, y: 0 },
      ]),
    ).toEqual({ x: 10, y: 0 });
  });
  it("returns null with no targets", () => {
    expect(nearestPoint({ x: 0, y: 0 }, [])).toBeNull();
  });
});

describe("coneAngles (§15 scatter spread)", () => {
  it("returns just the base angle for a single shot", () => {
    expect(coneAngles(0.5, 1, 0.85)).toEqual([0.5]);
    expect(coneAngles(0.5, 0, 0.85)).toEqual([0.5]);
  });
  it("fans count angles symmetrically across the full arc, centred on base", () => {
    const a = coneAngles(0, 5, 0.8);
    expect(a).toHaveLength(5);
    expect(a[2]).toBeCloseTo(0, 6); // middle pellet on the aim
    expect(a[0]).toBeCloseTo(-0.4, 6); // −arc/2
    expect(a[4]).toBeCloseTo(0.4, 6); // +arc/2
    // symmetric about the centre
    expect(a[0] + a[4]).toBeCloseTo(0, 6);
    expect(a[1] + a[3]).toBeCloseTo(0, 6);
  });
  it("spans exactly `arc` radians edge to edge and stays centred on a non-zero base", () => {
    const base = 1.2;
    const a = coneAngles(base, 4, 1.0);
    expect(a[3] - a[0]).toBeCloseTo(1.0, 6);
    expect((a[0] + a[3]) / 2).toBeCloseTo(base, 6);
  });
});

describe("Gatlin (§15 scatter tough)", () => {
  const g = ENEMY_KINDS.gatlin;
  it("is a positively-weighted spitter with a shotgun spread", () => {
    expect(g?.archetype).toBe("spitter");
    expect(g?.weight ?? 0).toBeGreaterThan(0);
    expect(g?.ranged?.spread?.count).toBeGreaterThan(1);
    expect(g?.ranged?.spread?.arc).toBeGreaterThan(0);
  });
  it("can random-spawn from the weighted pool", () => {
    const weighted = Object.keys(ENEMY_KINDS).filter((k) => (ENEMY_KINDS[k]?.weight ?? 0) > 0);
    expect(weighted).toContain("gatlin");
  });
});

describe("difficulty ramps (§6)", () => {
  it("toughChance is monotonic in time, ≥0, capped at 0.8", () => {
    expect(toughChance(0)).toBeGreaterThanOrEqual(0);
    expect(toughChance(0)).toBeLessThan(toughChance(9999));
    expect(toughChance(9999, 8)).toBeLessThanOrEqual(0.8);
  });
  it("toughChance rises with player count", () => {
    expect(toughChance(60, 4)).toBeGreaterThan(toughChance(60, 1));
  });
  it("enemyHpScale is 1.0 solo and rises with players", () => {
    expect(enemyHpScale(1)).toBeCloseTo(1, 6);
    expect(enemyHpScale(4)).toBeGreaterThan(enemyHpScale(1));
  });
  it("spawnInterval shrinks over the run (faster spawns)", () => {
    expect(spawnInterval(0)).toBeGreaterThan(spawnInterval(9999));
    expect(spawnInterval(9999)).toBeGreaterThan(0);
  });
});
