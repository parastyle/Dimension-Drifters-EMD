import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  BOSS_SPAWN_FLOOR,
  BOSS_SPAWN_SECONDS,
  bossSpawnAt,
  coneAngles,
  DEPTH_HP_PER,
  depthHpScale,
  ENEMY_KINDS,
  ENEMY_RADIUS,
  effectiveMelee,
  enemyHpScale,
  inMeleeArc,
  LUNGE_MIN_DAMAGE,
  nearestPoint,
  pickEnemyKind,
  spawnInterval,
  stepEnemyChase,
  stepEnemyKite,
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

describe("Ronin (§15/§20 Sekiro duelist)", () => {
  const m = ENEMY_KINDS.ronin?.melee;
  it("lunges forward each strike (a positive step), advancing rather than standing still", () => {
    expect(m?.step ?? 0).toBeGreaterThan(0);
  });
  it("starts the duel OUTSIDE the lunge floor so the first step reads as closing in", () => {
    // The lunge never goes inside range×0.45, so approach must be beyond that for the advance to show.
    expect(m?.approach ?? 0).toBeGreaterThan((m?.range ?? 0) * 0.45);
  });
  it("telegraphs every hit — a first windup and a follow-up rhythm gap, both > 0", () => {
    expect(m?.windup ?? 0).toBeGreaterThan(0);
    expect(m?.swingGap ?? 0).toBeGreaterThan(0);
    expect(m?.hits ?? 0).toBeGreaterThan(1);
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

// §6 chain DEPTH scaling (v0.103, audit H2) — every escalation lever gains a depth axis on top of the
// clock/player axes, and depth 1 is exactly the pre-chain behaviour (backwards-compatible defaults).
describe("difficulty scales with §6 chain depth (v0.103)", () => {
  it("depthHpScale: 1.0 at depth 1, rising per depth, sub-1 depths clamp to 1", () => {
    expect(depthHpScale(1)).toBeCloseTo(1, 6);
    expect(depthHpScale(0)).toBeCloseTo(1, 6);
    expect(depthHpScale(3)).toBeGreaterThan(depthHpScale(2));
    expect(depthHpScale(3)).toBeCloseTo(1 + DEPTH_HP_PER * 2, 6);
  });
  it("toughChance rises with depth (elite-denser), still capped at 0.8", () => {
    expect(toughChance(60, 1, 3)).toBeGreaterThan(toughChance(60, 1, 1));
    expect(toughChance(60, 1, 1)).toBeCloseTo(toughChance(60, 1), 6); // depth 1 = the old behaviour
    expect(toughChance(9999, 8, 50)).toBeLessThanOrEqual(0.8);
  });
  it("spawnInterval compresses with depth (faster pressure), never non-positive", () => {
    expect(spawnInterval(60, 3)).toBeLessThan(spawnInterval(60, 1));
    expect(spawnInterval(60, 1)).toBeCloseTo(spawnInterval(60), 6);
    expect(spawnInterval(9999, 30)).toBeGreaterThan(0);
  });
  it("bossSpawnAt: sooner per depth, floored, depth 1 = the base clock", () => {
    expect(bossSpawnAt(1)).toBe(BOSS_SPAWN_SECONDS);
    expect(bossSpawnAt(2)).toBeLessThan(bossSpawnAt(1));
    expect(bossSpawnAt(99)).toBe(BOSS_SPAWN_FLOOR);
  });
});

describe("stepEnemyChase (§15 rusher AI)", () => {
  const C = { x: 600, y: 600 };

  it("with no target, the enemy holds position (returns a copy)", () => {
    const out = stepEnemyChase(C, null, 200, 0.1);
    expect(out).toEqual(C);
    expect(out).not.toBe(C); // pure — never mutates the input
  });

  it("moves toward the target by exactly speed×dt along the straight line", () => {
    const out = stepEnemyChase(C, { x: 800, y: 600 }, 100, 0.5);
    expect(out.x).toBeCloseTo(650, 6); // 100 * 0.5 = 50 px toward +x
    expect(out.y).toBeCloseTo(600, 6);
  });

  it("normalizes the direction so diagonal chase isn't faster than axis chase", () => {
    const out = stepEnemyChase(C, { x: 600 + 300, y: 600 + 400 }, 100, 1); // 3-4-5 triangle
    const moved = Math.hypot(out.x - C.x, out.y - C.y);
    expect(moved).toBeCloseTo(100, 4); // step length == speed×dt regardless of angle
  });

  it("clamps to the arena bounds (never walks an enemy off the field)", () => {
    const corner = { x: ENEMY_RADIUS + 1, y: ENEMY_RADIUS + 1 };
    const out = stepEnemyChase(corner, { x: -9999, y: -9999 }, 500, 1);
    expect(out.x).toBeGreaterThanOrEqual(ENEMY_RADIUS);
    expect(out.y).toBeGreaterThanOrEqual(ENEMY_RADIUS);
    expect(out.x).toBeLessThanOrEqual(ARENA_WIDTH - ENEMY_RADIUS);
    expect(out.y).toBeLessThanOrEqual(ARENA_HEIGHT - ENEMY_RADIUS);
  });

  it("is deterministic (same inputs → same output)", () => {
    const t = { x: 700, y: 500 };
    expect(stepEnemyChase(C, t, 123, 0.3)).toEqual(stepEnemyChase(C, t, 123, 0.3));
  });
});

describe("stepEnemyKite (§15 spitter AI)", () => {
  const C = { x: 600, y: 600 };
  const RANGE = 200;

  it("with no target, holds position (returns a copy)", () => {
    const out = stepEnemyKite(C, null, 100, RANGE, 0.1);
    expect(out).toEqual(C);
    expect(out).not.toBe(C);
  });

  it("closes in when farther than preferredRange", () => {
    const target = { x: 600 + RANGE + 100, y: 600 }; // well beyond range, to the +x
    const out = stepEnemyKite(C, target, 100, RANGE, 0.5);
    expect(out.x).toBeGreaterThan(C.x); // steps toward the target
  });

  it("backs off when closer than 85% of preferredRange", () => {
    const target = { x: 600 + RANGE * 0.5, y: 600 }; // too close, to the +x
    const out = stepEnemyKite(C, target, 100, RANGE, 0.5);
    expect(out.x).toBeLessThan(C.x); // retreats AWAY from the target
  });

  it("holds station inside the dead-band (between 85% and 100% of range)", () => {
    const target = { x: 600 + RANGE * 0.92, y: 600 }; // inside the comfort band
    const out = stepEnemyKite(C, target, 100, RANGE, 0.5);
    expect(out.x).toBeCloseTo(C.x, 6);
    expect(out.y).toBeCloseTo(C.y, 6);
  });

  it("clamps to the arena bounds", () => {
    const edge = { x: ARENA_WIDTH - ENEMY_RADIUS - 1, y: 600 };
    const out = stepEnemyKite(edge, { x: ARENA_WIDTH + 9999, y: 600 }, 500, RANGE, 1);
    expect(out.x).toBeLessThanOrEqual(ARENA_WIDTH - ENEMY_RADIUS);
  });
});

describe("effectiveMelee — §20 universal lunge", () => {
  it("derives a single-hit lunge for the contact archetypes (rusher/swarm/zoner)", () => {
    for (const kindId of ["critter", "mote-swarm", "pricklepulp"]) {
      const m = effectiveMelee(ENEMY_KINDS[kindId]);
      expect(m, kindId).toBeDefined();
      expect(m?.hits).toBe(1);
      expect(m?.windup).toBeGreaterThan(0); // telegraphed → parryable
      expect(m?.range).toBeGreaterThan(ENEMY_KINDS[kindId]?.radius ?? 0); // reaches a touch past the body
      expect(m?.damage).toBeGreaterThanOrEqual(LUNGE_MIN_DAMAGE);
    }
  });

  it("has NO lunge for ranged spitters, the boss, or dummies (their threat isn't a jab)", () => {
    expect(effectiveMelee(ENEMY_KINDS.boothill)).toBeUndefined(); // spitter
    expect(effectiveMelee(ENEMY_KINDS["old-rust"])).toBeUndefined(); // boss
    expect(effectiveMelee(ENEMY_KINDS.dummy)).toBeUndefined();
    expect(effectiveMelee(undefined)).toBeUndefined();
  });

  it("returns a duelist's EXPLICIT multi-hit combo verbatim (not the derived jab)", () => {
    const ronin = ENEMY_KINDS.ronin;
    expect(effectiveMelee(ronin)).toBe(ronin?.melee); // same object — the authored combo
    expect(ronin?.melee?.hits).toBeGreaterThan(1);
  });

  it("MEMOIZES the derived lunge per kind (no per-tick allocation)", () => {
    expect(effectiveMelee(ENEMY_KINDS.critter)).toBe(effectiveMelee(ENEMY_KINDS.critter));
  });
});
