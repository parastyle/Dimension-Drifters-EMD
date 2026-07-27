import {
  JIGGLE_FOOT_AIR_W,
  JIGGLE_FOOT_AIR_Z,
  JIGGLE_FOOT_IDLE_X,
  JIGGLE_FOOT_IDLE_Y,
  JIGGLE_FOOT_MAX_V,
  JIGGLE_FOOT_MAX_X,
  JIGGLE_FOOT_MAX_Y,
  JIGGLE_FOOT_PLANT_Z,
  JIGGLE_HAND_IDLE_X,
  JIGGLE_HAND_IDLE_Y,
  JIGGLE_HAND_MAX_V,
  JIGGLE_HAND_MAX_X,
  JIGGLE_HAND_MAX_Y,
  JIGGLE_HAND_W,
  JIGGLE_HAND_Z,
  PROCEDURAL_LIMB_PHYSICS,
} from "@dd/shared";
import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({
  default: {
    BlendModes: { ADD: 1 },
    TintModes: { FILL: 1, MULTIPLY: 2 },
  },
}));

import {
  FLOATING_HEAD_SPRING_TUNING,
  type FloatingHeadSpringState,
  type JigglePartState,
  resetJigglePart,
  stepFloatingHeadSpring,
  stepJigglePart,
} from "./rig-core.js";

const DT = 1 / 60;

function freshPart(): JigglePartState {
  return {
    jx: 0,
    jy: 0,
    jvx: 0,
    jvy: 0,
    prevAx: 0,
    prevAy: 0,
    prevAvx: 0,
    prevAvy: 0,
    prevOwn: 0,
    springReady: false,
  };
}

function freshHead(): FloatingHeadSpringState {
  return { x: 0, y: 0, vx: 0, vy: 0, ready: false };
}

describe("B74 subtle head/hand/foot physics doctrine", () => {
  it("keeps every required limb follower critically damped", () => {
    expect(PROCEDURAL_LIMB_PHYSICS).toBe(true);
    expect(JIGGLE_HAND_Z).toBe(1);
    expect(JIGGLE_FOOT_AIR_Z).toBe(1);
    expect(JIGGLE_FOOT_PLANT_Z).toBe(1);
    expect(FLOATING_HEAD_SPRING_TUNING.dampingRatio).toBe(1);
  });

  it("moves idle hands and feet subtly through their bounded physical followers", () => {
    const hand = freshPart();
    const foot = freshPart();
    const handSamples: number[] = [];
    const footSamples: number[] = [];

    for (let frame = 0; frame < 240; frame++) {
      const time = frame * DT;
      stepJigglePart(
        hand,
        0,
        0,
        0,
        DT,
        JIGGLE_HAND_W,
        JIGGLE_HAND_Z,
        Math.sin(time * Math.PI * 2 * 0.57) * JIGGLE_HAND_IDLE_X,
        Math.sin(time * Math.PI * 2 * 1.13 + 0.8) * JIGGLE_HAND_IDLE_Y,
        0,
        0,
        JIGGLE_HAND_MAX_X,
        JIGGLE_HAND_MAX_Y,
        JIGGLE_HAND_MAX_V,
        false,
        frame === 0,
      );
      stepJigglePart(
        foot,
        0,
        0,
        0,
        DT,
        JIGGLE_FOOT_AIR_W,
        JIGGLE_FOOT_AIR_Z,
        Math.sin(time * Math.PI * 2 * 0.73 + 1.1) * JIGGLE_FOOT_IDLE_X,
        Math.sin(time * Math.PI * 2 * 1.37 + 2.2) * JIGGLE_FOOT_IDLE_Y,
        0,
        0,
        JIGGLE_FOOT_MAX_X,
        JIGGLE_FOOT_MAX_Y,
        JIGGLE_FOOT_MAX_V,
        false,
        frame === 0,
      );
      handSamples.push(Math.hypot(hand.jx, hand.jy));
      footSamples.push(Math.hypot(foot.jx, foot.jy));
    }

    expect(Math.max(...handSamples)).toBeGreaterThan(0.2);
    expect(Math.max(...handSamples)).toBeLessThan(1);
    expect(Math.max(...footSamples)).toBeGreaterThan(0.05);
    expect(Math.max(...footSamples)).toBeLessThan(0.4);
  });

  it("keeps the head physical while idle and inside the subtle offset ceiling", () => {
    const head = freshHead();
    const offsets: number[] = [];
    for (let frame = 0; frame < 240; frame++) {
      const time = frame * DT;
      stepFloatingHeadSpring(head, {
        targetX: 0,
        targetY: 0,
        authoredOffsetX:
          Math.sin(time * Math.PI * 2 * 0.43) * FLOATING_HEAD_SPRING_TUNING.idleDriftXPx,
        authoredOffsetY:
          Math.sin(time * Math.PI * 2 * 0.79 + 0.7) * FLOATING_HEAD_SPRING_TUNING.idleDriftYPx,
        impulseX: 0,
        impulseY: 0,
        elapsedSeconds: DT,
        reducedMotion: false,
        reset: frame === 0,
      });
      offsets.push(Math.hypot(head.x, head.y));
    }

    expect(Math.max(...offsets)).toBeGreaterThan(0.08);
    expect(Math.max(...offsets)).toBeLessThan(0.4);
    expect(Math.abs(head.x)).toBeLessThanOrEqual(FLOATING_HEAD_SPRING_TUNING.maxOffsetX);
    expect(Math.abs(head.y)).toBeLessThanOrEqual(FLOATING_HEAD_SPRING_TUNING.maxOffsetY);
  });

  it("keeps head, hands, and feet physically responsive during movement", () => {
    const hand = freshPart();
    const foot = freshPart();
    const head = freshHead();
    let handPeak = 0;
    let footPeak = 0;
    let headPeak = 0;

    for (let frame = 0; frame < 180; frame++) {
      const phase = frame * DT * Math.PI * 5;
      stepJigglePart(
        hand,
        Math.sin(phase) * 3,
        Math.cos(phase) * 2,
        0,
        DT,
        JIGGLE_HAND_W,
        JIGGLE_HAND_Z,
        0,
        0,
        frame === 0 ? 0 : Math.sin(phase) * 0.22,
        frame === 0 ? 0 : Math.cos(phase) * 0.18,
        JIGGLE_HAND_MAX_X,
        JIGGLE_HAND_MAX_Y,
        JIGGLE_HAND_MAX_V,
        false,
        frame === 0,
      );
      stepJigglePart(
        foot,
        Math.sin(phase + Math.PI) * 2,
        Math.cos(phase + Math.PI) * 1.5,
        0,
        DT,
        JIGGLE_FOOT_AIR_W,
        JIGGLE_FOOT_AIR_Z,
        0,
        0,
        frame === 0 ? 0 : Math.sin(phase + Math.PI) * 0.12,
        frame === 0 ? 0 : Math.cos(phase + Math.PI) * 0.1,
        JIGGLE_FOOT_MAX_X,
        JIGGLE_FOOT_MAX_Y,
        JIGGLE_FOOT_MAX_V,
        false,
        frame === 0,
      );
      stepFloatingHeadSpring(head, {
        targetX: 0,
        targetY: 0,
        authoredOffsetX: Math.sin(phase * 0.5) * FLOATING_HEAD_SPRING_TUNING.walkBobPx,
        authoredOffsetY: Math.cos(phase) * FLOATING_HEAD_SPRING_TUNING.walkBobPx,
        impulseX: frame === 0 ? 0 : Math.sin(phase) * 0.08,
        impulseY: frame === 0 ? 0 : Math.cos(phase) * 0.08,
        elapsedSeconds: DT,
        reducedMotion: false,
        reset: frame === 0,
      });
      handPeak = Math.max(handPeak, Math.hypot(hand.jx, hand.jy));
      footPeak = Math.max(footPeak, Math.hypot(foot.jx, foot.jy));
      headPeak = Math.max(headPeak, Math.hypot(head.x, head.y));
    }

    expect(handPeak).toBeGreaterThan(0.02);
    expect(handPeak).toBeLessThanOrEqual(Math.max(JIGGLE_HAND_MAX_X, JIGGLE_HAND_MAX_Y));
    expect(footPeak).toBeGreaterThan(0.01);
    expect(footPeak).toBeLessThanOrEqual(Math.max(JIGGLE_FOOT_MAX_X, JIGGLE_FOOT_MAX_Y));
    expect(headPeak).toBeGreaterThan(0.1);
    expect(headPeak).toBeLessThanOrEqual(
      Math.hypot(FLOATING_HEAD_SPRING_TUNING.maxOffsetX, FLOATING_HEAD_SPRING_TUNING.maxOffsetY),
    );
  });

  it("settles a displaced hand monotonically without springy overshoot", () => {
    const hand = freshPart();
    resetJigglePart(hand, 0, 0, 0);
    hand.jx = 4;
    let previous = hand.jx;

    for (let frame = 0; frame < 180; frame++) {
      stepJigglePart(
        hand,
        0,
        0,
        0,
        DT,
        JIGGLE_HAND_W,
        JIGGLE_HAND_Z,
        0,
        0,
        0,
        0,
        JIGGLE_HAND_MAX_X,
        JIGGLE_HAND_MAX_Y,
        JIGGLE_HAND_MAX_V,
        false,
        false,
      );
      expect(hand.jx).toBeGreaterThanOrEqual(-1e-10);
      expect(hand.jx).toBeLessThanOrEqual(previous + 1e-10);
      previous = hand.jx;
    }
    expect(hand.jx).toBeLessThan(1e-6);
  });
});
