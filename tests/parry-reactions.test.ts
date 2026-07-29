import {
  advanceParryGuardCycle,
  clampParrySlideToNavigation,
  classifyParryIncidence,
  PARRY_GUARD_RESET_TICKS,
  PARRY_SLIDE_MAX_PX,
  PARRY_SLIDE_MIN_PX,
  PARRY_SLIDE_PX_PER_DAMAGE,
  ParryReaction,
  packParryPresentation,
  parryGuardSubtypeKey,
  parrySlideDistance,
  unpackParryGuardPose,
  unpackParryReaction,
} from "@dd/shared";
import { describe, expect, it } from "vitest";

describe("B26 directional parry incidence", () => {
  it.each([
    ["below", 0, -1, ParryReaction.FromBelow],
    ["left", 1, 0, ParryReaction.FromLeft],
    ["right", -1, 0, ParryReaction.FromRight],
    ["above", 0, 1, ParryReaction.FromAbove],
  ] as const)("routes an attack from %s", (_label, x, y, expected) => {
    expect(classifyParryIncidence(x, y)).toBe(expected);
  });

  it("uses horizontal reactions on exact diagonal boundaries", () => {
    expect(classifyParryIncidence(1, -1)).toBe(ParryReaction.FromLeft);
    expect(classifyParryIncidence(1, 1)).toBe(ParryReaction.FromLeft);
    expect(classifyParryIncidence(-1, -1)).toBe(ParryReaction.FromRight);
    expect(classifyParryIncidence(-1, 1)).toBe(ParryReaction.FromRight);
  });

  it("routes just inside either side of a quadrant boundary without gaps", () => {
    expect(classifyParryIncidence(0.999, -1)).toBe(ParryReaction.FromBelow);
    expect(classifyParryIncidence(1, -0.999)).toBe(ParryReaction.FromLeft);
    expect(classifyParryIncidence(-0.999, 1)).toBe(ParryReaction.FromAbove);
    expect(classifyParryIncidence(-1, 0.999)).toBe(ParryReaction.FromRight);
  });

  it("uses the no-displacement above brace for a degenerate or invalid vector", () => {
    expect(classifyParryIncidence(0, 0)).toBe(ParryReaction.FromAbove);
    expect(classifyParryIncidence(Number.NaN, Number.POSITIVE_INFINITY)).toBe(
      ParryReaction.FromAbove,
    );
  });
});

describe("B26 side-parry damage curve", () => {
  it("applies the readability floor to weak or invalid damage", () => {
    expect(parrySlideDistance(0)).toBe(PARRY_SLIDE_MIN_PX);
    expect(parrySlideDistance(1)).toBe(PARRY_SLIDE_MIN_PX);
    expect(parrySlideDistance(Number.NaN)).toBe(PARRY_SLIDE_MIN_PX);
  });

  it("scales linearly between floor and cap", () => {
    const damage = 18;
    expect(parrySlideDistance(damage)).toBe(damage * PARRY_SLIDE_PX_PER_DAMAGE);
  });

  it("caps boss-scale prevented damage", () => {
    expect(parrySlideDistance(10_000)).toBe(PARRY_SLIDE_MAX_PX);
  });
});

describe("B26 guard cycle", () => {
  it("cycles 0 → 1 → 2 → 0 on consecutive successful parries", () => {
    const first = advanceParryGuardCycle(undefined, 10);
    const second = advanceParryGuardCycle(first.state, 11);
    const third = advanceParryGuardCycle(second.state, 12);
    const fourth = advanceParryGuardCycle(third.state, 13);
    expect([first.pose, second.pose, third.pose, fourth.pose]).toEqual([0, 1, 2, 0]);
    expect([first.reset, second.reset, third.reset, fourth.reset]).toEqual([
      true,
      false,
      false,
      false,
    ]);
  });

  it("continues at the reset boundary and restarts after it", () => {
    const first = advanceParryGuardCycle(undefined, 20);
    const atBoundary = advanceParryGuardCycle(first.state, 20 + PARRY_GUARD_RESET_TICKS);
    const afterBoundary = advanceParryGuardCycle(
      atBoundary.state,
      20 + PARRY_GUARD_RESET_TICKS * 2 + 1,
    );
    expect(atBoundary.pose).toBe(1);
    expect(atBoundary.reset).toBe(false);
    expect(afterBoundary.pose).toBe(0);
    expect(afterBoundary.reset).toBe(true);
  });

  it("keys independent cycles by shared classPool:family taxonomy", () => {
    expect(
      parryGuardSubtypeKey({
        tags: {
          grip: "1H",
          size: "S",
          delivery: "bullet",
          fireMode: "semi",
          element: "physical",
          classPool: "ranged",
          family: "pistol",
          rangeBand: "long",
          scaling: ["DEX"],
        },
      }),
    ).toBe("ranged:pistol");
  });

  it("packs the server-selected reaction and guard pose into one receipt payload", () => {
    const packed = packParryPresentation(ParryReaction.FromRight, 2);
    expect(unpackParryReaction(packed)).toBe(ParryReaction.FromRight);
    expect(unpackParryGuardPose(packed)).toBe(2);
  });
});

describe("B26 swept navigation clamp", () => {
  it("stops at the final sampled point before a navigation boundary", () => {
    const slide = clampParrySlideToNavigation(0, 0, 1, 0, 100, (x) => x < 47, 2);
    expect(slide.x).toBe(46);
    expect(slide.y).toBe(0);
    expect(slide.traveled).toBe(46);
    expect(slide.clamped).toBe(true);
  });

  it("reaches an unobstructed endpoint without extending the requested distance", () => {
    const slide = clampParrySlideToNavigation(12, 18, -3, 4, 50, () => true, 2);
    expect(slide.x).toBeCloseTo(-18);
    expect(slide.y).toBeCloseTo(58);
    expect(slide.traveled).toBeCloseTo(50);
    expect(Math.hypot(slide.x - 12, slide.y - 18)).toBeCloseTo(50);
    expect(slide.clamped).toBe(false);
  });
});
