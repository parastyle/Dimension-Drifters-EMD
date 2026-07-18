import {
  VASTAGHAR_ENCOUNTER,
  VastagharActionKind,
  VastagharActionResult,
  VastagharArenaMutationKind,
  VastagharFoot,
  VastagharMode,
  VastagharPhase,
  VastagharVictoryStage,
} from "@dd/shared";
import { describe, expect, it } from "vitest";
import {
  sampleVastagharPresentation,
  type VastagharPresentationState,
  VastagharShakeBudget,
  vastagharTickDelta,
} from "./vastaghar-vfx.js";

function presentationState(
  overrides: Partial<VastagharPresentationState> = {},
): VastagharPresentationState {
  return {
    active: true,
    encounterSeq: 3,
    mode: VastagharMode.Combat,
    phase: VastagharPhase.LearnWeight,
    phaseStartTick: 80,
    actionSeq: 7,
    actionKind: VastagharActionKind.Crownstep,
    actionResult: VastagharActionResult.Pending,
    actionStartTick: 100,
    actionResolveTick: 120,
    actionActiveEndTick: 140,
    actionEndTick: 150,
    sourceFoot: VastagharFoot.OuterLeft,
    aim: 0.4,
    impactX: 420,
    impactY: 310,
    revolutions: 1,
    stepSeq: 9,
    stepIndex: 0,
    stepCount: 1,
    stepStartTick: 110,
    stepResolveTick: 120,
    responseOpenTick: 115,
    stridePips: 1,
    punishEndTick: 0,
    cueSeq: 4,
    cueKind: VastagharActionKind.Crownstep,
    cueTick: 100,
    arenaMutationSeq: 0,
    arenaMutationKind: VastagharArenaMutationKind.None,
    arenaMutationTick: 0,
    victoryStage: VastagharVictoryStage.None,
    victoryTick: 0,
    victoryXp: 0,
    ...overrides,
  };
}

describe("Vastaghar epoch presentation", () => {
  it("uses the authoritative five-tick response surface as the complete white answer window", () => {
    expect(sampleVastagharPresentation(presentationState(), 114.999).responseActive).toBe(false);

    const open = sampleVastagharPresentation(presentationState(), 115);
    expect(open.responseActive).toBe(true);
    expect(open.responseT).toBe(0);

    const middle = sampleVastagharPresentation(presentationState(), 117.5);
    expect(middle.responseActive).toBe(true);
    expect(middle.responseT).toBeCloseTo(0.5);

    const laterSequenceStep = sampleVastagharPresentation(
      presentationState({
        actionKind: VastagharActionKind.ThreefoldMarch,
        actionResult: VastagharActionResult.Resolved,
        stepIndex: 1,
      }),
      117.5,
    );
    expect(laterSequenceStep.responseActive).toBe(true);

    const resolve = sampleVastagharPresentation(presentationState(), 120);
    expect(resolve.responseActive).toBe(false);
    expect(resolve.impactActive).toBe(true);
  });

  it("seeks directly into either Worldwheel revolution from the active epochs", () => {
    const state = presentationState({
      actionKind: VastagharActionKind.Worldwheel,
      actionResolveTick: 120,
      actionActiveEndTick: 160,
      actionEndTick: 170,
      revolutions: 2,
      aim: 0.25,
    });

    const first = sampleVastagharPresentation(state, 130);
    expect(first.activeT).toBe(0.25);
    expect(first.worldwheelRevolution).toBe(0);
    expect(first.worldwheelRevolutionT).toBeCloseTo(0.5);
    expect(first.worldwheelAngle).toBeCloseTo(0.25 - Math.PI / 2 + Math.PI);

    const second = sampleVastagharPresentation(state, 150);
    expect(second.activeT).toBe(0.75);
    expect(second.worldwheelRevolution).toBe(1);
    expect(second.worldwheelRevolutionT).toBeCloseTo(0.5);
    expect(second.worldwheelAngle).toBeCloseTo(0.25 - Math.PI / 2 + Math.PI * 3);
  });

  it("maps the authored entrance, sixteen-tick transition, and sixty-four-tick break clocks", () => {
    const entrance = presentationState({
      mode: VastagharMode.Entrance,
      phaseStartTick: 40,
    });
    expect(sampleVastagharPresentation(entrance, 40).entranceT).toBe(0);
    expect(sampleVastagharPresentation(entrance, 47.5).entranceT).toBeCloseTo(0.5);
    expect(sampleVastagharPresentation(entrance, 55).entranceT).toBe(1);

    const transition = presentationState({
      mode: VastagharMode.Transition,
      actionStartTick: 200,
      actionResolveTick: 216,
      actionActiveEndTick: 216,
      actionEndTick: 216,
    });
    const paperCut = sampleVastagharPresentation(transition, 208);
    expect(VASTAGHAR_ENCOUNTER.transitionTicks).toBe(16);
    expect(paperCut.transitionActive).toBe(true);
    expect(paperCut.actionT).toBeCloseTo(0.5);
    expect(sampleVastagharPresentation(transition, 216).transitionActive).toBe(false);

    const breakState = presentationState({
      mode: VastagharMode.StrideBreak,
      actionKind: VastagharActionKind.StrideBreak,
      actionStartTick: 300,
      actionResolveTick: 300,
      actionActiveEndTick: 364,
      actionEndTick: 364,
      punishEndTick: 364,
    });
    const payoff = sampleVastagharPresentation(breakState, 332);
    expect(VASTAGHAR_ENCOUNTER.strideBreakTicks).toBe(64);
    expect(payoff.downedGuard).toBe(true);
    expect(payoff.punishActive).toBe(true);
    expect(payoff.actionT).toBeCloseTo(0.5);
    expect(sampleVastagharPresentation(breakState, 364).downedGuard).toBe(false);
  });

  it("maps the death action without coupling it to packet arrival time", () => {
    const state = presentationState({
      mode: VastagharMode.Victory,
      phase: VastagharPhase.Defeated,
      actionKind: VastagharActionKind.Death,
      actionStartTick: 500,
      actionResolveTick: 500,
      actionActiveEndTick: 520,
      actionEndTick: 520,
      victoryStage: VastagharVictoryStage.Collapse,
    });
    expect(sampleVastagharPresentation(state, 506.6).deathT).toBeCloseTo(0.33);
  });

  it("computes fractional epoch distance across the uint32 tick wrap", () => {
    expect(vastagharTickDelta(0.5, 0xffff_fffe)).toBe(2.5);
    expect(vastagharTickDelta(0xffff_fffd + 0.5, 1)).toBe(-3.5);
  });
});

describe("Vastaghar camera shake budget", () => {
  it("enforces impulse, tier-three, and ten-second duty limits with fixed memory", () => {
    const impulse = new VastagharShakeBudget();
    expect(impulse.accept(0, 300, 0.02, 3)).toBe(true);
    expect(impulse.accept(500, 100, 0.01, 3)).toBe(false);
    expect(impulse.accept(500, 200, 0.02, 2)).toBe(true);
    expect(impulse.accept(600, 250, 0.02, 2)).toBe(false);
    expect(impulse.accept(1_101, 250, 0.02, 2)).toBe(true);

    const duty = new VastagharShakeBudget();
    expect(duty.accept(0, 500, 0.001, 1)).toBe(true);
    expect(duty.accept(2_000, 500, 0.001, 1)).toBe(true);
    expect(duty.accept(4_000, 500, 0.001, 1)).toBe(true);
    expect(duty.accept(6_000, 500, 0.001, 1)).toBe(true);
    expect(duty.accept(8_000, 100, 0.001, 1)).toBe(false);
    expect(duty.accept(10_001, 100, 0.001, 1)).toBe(true);
  });
});
