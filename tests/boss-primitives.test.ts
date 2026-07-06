import {
  aimedVolley,
  BOSS_PRIMITIVES,
  beamSweep,
  bulletFan,
  corrosivePool,
  dashCharge,
  expandingRing,
  landingZone,
  makeRng,
  type PrimitiveCtx,
  pointInAnnulusGap,
  pointInOrientedRect,
  RING_BAND_HALF,
  radialBurst,
  spiral,
  summonAdds,
  TELEGRAPH_DODGE,
  TgShape,
} from "@dd/shared";
import { describe, expect, it } from "vitest";

// §16 v0.109 the boss attack primitives — PURE geometry, RNG injected. These pin the emit shapes each
// primitive produces so a boss def composes them predictably, and lock the design's mandatory rule that a
// telegraph and its payload share the SAME coordinates (computed once per cast, never re-derived).

function ctx(over: Partial<PrimitiveCtx> = {}): PrimitiveCtx {
  return {
    boss: { x: 1000, y: 1000, kind: "verkaln", radius: 70 },
    targets: [{ x: 1300, y: 1000 }],
    rng: makeRng(12345),
    phaseTick: 1,
    params: {},
    ...over,
  };
}

describe("bulletFan (§16 fan of parryable slugs)", () => {
  it("fires count−2 slugs (the 2-wide weave-gap) aimed at the target", () => {
    const plan = bulletFan(ctx({ params: { count: 11, arc: 1.9, speed: 360, damage: 8 } }));
    expect(plan.emits.projectiles).toHaveLength(9);
    expect(plan.telegraphs).toHaveLength(0);
    // Target is straight right → the fan centres on angle 0 (aimX≈cos near 1 for the central slug).
    const aims = (plan.emits.projectiles ?? []).map((p) => Math.atan2(p.aimY, p.aimX));
    for (const a of aims) expect(Math.abs(a)).toBeLessThanOrEqual(1.9 / 2 + 1e-6);
  });
});

describe("radialBurst (§16 full-circle ring)", () => {
  it("emits `count` evenly-spaced bullets over 2π + a dodge pre-flash ring", () => {
    const plan = radialBurst(ctx({ params: { count: 8, speed: 300, damage: 8, warn: 1 } }));
    expect(plan.emits.projectiles).toHaveLength(8);
    expect(plan.telegraphs).toHaveLength(1);
    expect(plan.telegraphs[0]?.shape).toBe(TgShape.Ring);
    expect(plan.telegraphs[0]?.danger).toBe(TELEGRAPH_DODGE);
  });

  it("suppresses the pre-flash when warn=0", () => {
    expect(radialBurst(ctx({ params: { count: 6, warn: 0 } })).telegraphs).toHaveLength(0);
  });
});

describe("spiral (§16 rotating ring)", () => {
  it("rotates the base angle with phaseTick (a later trigger fires a different pattern)", () => {
    const a = spiral(ctx({ phaseTick: 1, params: { count: 6, spinPerVolley: 0.5 } }));
    const b = spiral(ctx({ phaseTick: 2, params: { count: 6, spinPerVolley: 0.5 } }));
    const firstA = a.emits.projectiles?.[0];
    const firstB = b.emits.projectiles?.[0];
    expect(Math.atan2(firstA?.aimY ?? 0, firstA?.aimX ?? 0)).not.toBeCloseTo(
      Math.atan2(firstB?.aimY ?? 0, firstB?.aimX ?? 0),
      5,
    );
  });
});

describe("aimedVolley (§16 cone at nearest target)", () => {
  it("emits `pellets` bullets in a cone toward the nearest target", () => {
    const plan = aimedVolley(ctx({ params: { pellets: 5, arc: 0.6, speed: 340, damage: 7 } }));
    expect(plan.emits.projectiles).toHaveLength(5);
  });
});

describe("landingZone (§16 the generalised slam)", () => {
  it("telegraph count == AoE count, and each telegraph shares its AoE's exact coordinates", () => {
    const plan = landingZone(
      ctx({ params: { count: 3, radius: 150, damage: 22, knockback: 700, spread: 300 } }),
    );
    expect(plan.telegraphs).toHaveLength(3);
    expect(plan.emits.aoe).toHaveLength(3);
    for (let i = 0; i < 3; i++) {
      // The mandatory rule: the danger the player reads sits EXACTLY where the hit lands.
      expect(plan.telegraphs[i]?.x).toBe(plan.emits.aoe?.[i]?.x);
      expect(plan.telegraphs[i]?.y).toBe(plan.emits.aoe?.[i]?.y);
      expect(plan.telegraphs[i]?.danger).toBe(TELEGRAPH_DODGE);
      expect(plan.telegraphs[i]?.shape).toBe(TgShape.Circle);
    }
    // First drop leads the target.
    expect(plan.telegraphs[0]?.x).toBe(1300);
    expect(plan.telegraphs[0]?.y).toBe(1000);
  });
});

describe("corrosivePool (§16 persistent DoT hazard)", () => {
  it("drops `count` dodge puddles, each with a matching telegraph", () => {
    const plan = corrosivePool(ctx({ params: { count: 2, radius: 96, ttl: 4, spread: 300 } }));
    expect(plan.emits.zones).toHaveLength(2);
    expect(plan.telegraphs).toHaveLength(2);
    for (let i = 0; i < 2; i++) {
      expect(plan.telegraphs[i]?.x).toBe(plan.emits.zones?.[i]?.x);
      expect(plan.telegraphs[i]?.danger).toBe(TELEGRAPH_DODGE);
    }
  });
});

describe("summonAdds (§16 pre-warned conjuring)", () => {
  it("emits `count` adds + point-warn markers at matching spots (kind stamped by the controller)", () => {
    const plan = summonAdds(ctx({ params: { count: 3, ringRadius: 160, ringJitter: 60 } }));
    expect(plan.emits.adds).toHaveLength(3);
    expect(plan.telegraphs).toHaveLength(3);
    for (let i = 0; i < 3; i++) {
      expect(plan.telegraphs[i]?.shape).toBe(TgShape.PointWarn);
      expect(plan.telegraphs[i]?.x).toBe(plan.emits.adds?.[i]?.x);
      expect(plan.emits.adds?.[i]?.kind).toBe(""); // controller stamps the real kind
    }
  });
});

describe("active-hazard primitives (§16 Slice 2)", () => {
  it("beamSweep produces a rect telegraph + a beam active-spec swept through the target", () => {
    const plan = beamSweep(
      ctx({ params: { length: 900, halfWidth: 40, sweepArc: 1.4, duration: 0.5, dps: 30 } }),
    );
    expect(plan.telegraphs[0]?.shape).toBe(TgShape.Rect);
    expect(plan.emits.active?.kind).toBe(0);
    // sweep is centred on the target aim (straight right = 0): rot0 = -sweepArc/2, rotEnd = +sweepArc/2.
    expect(plan.emits.active?.rot0).toBeCloseTo(-0.7, 5);
    expect(plan.emits.active?.rotEnd).toBeCloseTo(0.7, 5);
  });

  it("expandingRing produces a ring telegraph carrying the gap half-width in `b` + a ring active-spec", () => {
    const plan = expandingRing(
      ctx({ params: { maxR: 500, bandHalf: 40, gapAngle: 0.5, duration: 1, dps: 26 } }),
    );
    expect(plan.telegraphs[0]?.shape).toBe(TgShape.Ring);
    expect(plan.telegraphs[0]?.b).toBe(0.5); // gap half-width for the client, not band thickness
    expect(plan.emits.active?.kind).toBe(1);
    expect(plan.emits.active?.gapHalf).toBe(0.5);
    expect(plan.emits.active?.b).toBe(RING_BAND_HALF); // band thickness = shared constant (WYSIWYG w/ client)
  });

  it("dashCharge aims its lane at the target + carries knockback", () => {
    const plan = dashCharge(
      ctx({ params: { reach: 600, halfWidth: 60, duration: 0.4, damage: 55, knockback: 700 } }),
    );
    expect(plan.emits.active?.kind).toBe(2);
    expect(plan.emits.active?.rot0).toBeCloseTo(0, 5); // target straight right
    expect(plan.emits.active?.knockback).toBe(700);
  });
});

describe("hazard geometry (§16 pure hit tests)", () => {
  it("pointInOrientedRect: inside the lane vs off to the side / behind", () => {
    // lane from origin along +x, length 100, half-width 20
    expect(pointInOrientedRect(50, 0, 0, 0, 100, 20, 0)).toBe(true);
    expect(pointInOrientedRect(50, 25, 0, 0, 100, 20, 0)).toBe(false); // outside half-width
    expect(pointInOrientedRect(-10, 0, 0, 0, 100, 20, 0)).toBe(false); // behind the origin
    expect(pointInOrientedRect(150, 0, 0, 0, 100, 20, 0)).toBe(false); // past the end
  });

  it("pointInAnnulusGap: in the band outside the gap = danger; in the gap or off-band = safe", () => {
    // band at radius 100 ±20, gap centred at angle 0 (±0.4 rad)
    expect(pointInAnnulusGap(100, 0, 0, 0, 100, 20, 0, 0.4)).toBe(false); // in the safe gap (angle 0)
    expect(pointInAnnulusGap(0, 100, 0, 0, 100, 20, 0, 0.4)).toBe(true); // in the band, angle π/2 (outside gap)
    expect(pointInAnnulusGap(0, 50, 0, 0, 100, 20, 0, 0.4)).toBe(false); // inside the band radius (too close)
  });
});

describe("primitive purity + registry", () => {
  it("every primitive is deterministic under a fixed seed", () => {
    for (const [name, prim] of Object.entries(BOSS_PRIMITIVES)) {
      const a = prim(ctx({ rng: makeRng(777), params: { count: 4 } }));
      const b = prim(ctx({ rng: makeRng(777), params: { count: 4 } }));
      expect(a, `${name} must be deterministic`).toEqual(b);
    }
  });

  it("registers the full primitive set (Slice 1 emit casts + Slice 2 active hazards)", () => {
    expect(Object.keys(BOSS_PRIMITIVES).sort()).toEqual(
      [
        "aimedVolley",
        "beamSweep",
        "bulletFan",
        "corrosivePool",
        "dashCharge",
        "expandingRing",
        "landingZone",
        "radialBurst",
        "spiral",
        "summonAdds",
      ].sort(),
    );
  });
});
