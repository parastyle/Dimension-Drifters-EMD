import { describe, expect, it } from "vitest";
import {
  createKungFuWrapPoseInput,
  createKungFuWrapPoseSample,
  type KungFuWrapMotion,
  sampleKungFuWrapPose,
} from "./kung-fu-wrap-pose.js";

const MOTIONS: readonly KungFuWrapMotion[] = [
  "elbow",
  "knee-strike",
  "roundhouse-kick",
  "chain-punch",
  "sway-jab",
  "weave-cross",
  "gourd-haymaker",
  "iron-knuckle",
  "iron-palm",
];

function impactSample(motion: KungFuWrapMotion) {
  const input = createKungFuWrapPoseInput();
  input.motion = motion;
  input.t = input.timing.impact ?? input.timing.activeEnd;
  return sampleKungFuWrapPose(input, createKungFuWrapPoseSample());
}

describe("B14 kung-fu wrap full-body pose sampler", () => {
  it("gives every authored motion a distinct impact-frame body/hand/foot signature", () => {
    const signatures = new Set(
      MOTIONS.map((motion) => {
        const sample = impactSample(motion);
        return JSON.stringify({
          handForward: sample.handForward,
          handLateral: sample.handLateral,
          bodyForward: sample.bodyForward,
          bodyLateral: sample.bodyLateral,
          bodyLift: sample.bodyLift,
          bodyRotation: sample.bodyRotation,
          frontFootForward: sample.frontFootForward,
          frontFootLift: sample.frontFootLift,
        });
      }),
    );
    expect(signatures.size).toBe(MOTIONS.length);
  });

  it("uses the foot rig for Muay Thai knees and roundhouses", () => {
    expect(impactSample("knee-strike").frontFootLift).toBeGreaterThan(0.3);
    const roundhouse = impactSample("roundhouse-kick");
    expect(roundhouse.frontFootLift).toBeGreaterThan(0.25);
    expect(roundhouse.frontFootForward).toBeGreaterThan(0.6);
  });

  it("keeps Wing Chun precise while Drunken Fist sways and weaves", () => {
    const chain = impactSample("chain-punch");
    const sway = impactSample("sway-jab");
    const weave = impactSample("weave-cross");
    expect(chain.handForward).toBeGreaterThan(0.8);
    expect(Math.abs(chain.bodyLateral)).toBeLessThan(0.01);
    expect(Math.abs(sway.bodyLateral)).toBeGreaterThan(0.15);
    expect(Math.abs(weave.bodyLateral)).toBeGreaterThan(0.18);
    expect(Math.sign(sway.bodyLateral)).not.toBe(Math.sign(weave.bodyLateral));
    expect(impactSample("gourd-haymaker").handAngleOffset).toBeGreaterThan(0.5);
  });

  it("makes the two-hand iron-palm finish the deepest planted drive", () => {
    const knuckle = impactSample("iron-knuckle");
    const palm = impactSample("iron-palm");
    expect(palm.rearHandForward).toBeGreaterThan(0.5);
    expect(palm.bodyForward).toBeGreaterThan(knuckle.bodyForward);
    expect(palm.bodyScaleX).toBeLessThan(knuckle.bodyScaleX);
    expect(palm.impactSnap).toBe(1);
  });

  it("returns every owned channel to identity after follow-through", () => {
    const input = createKungFuWrapPoseInput();
    const output = createKungFuWrapPoseSample();
    for (const motion of MOTIONS) {
      input.motion = motion;
      input.t = 1;
      sampleKungFuWrapPose(input, output);
      expect(output.active, motion).toBe(false);
      expect(output.handForward, motion).toBe(0);
      expect(output.bodyForward, motion).toBe(0);
      expect(Math.abs(output.bodyLateral), motion).toBe(0);
      expect(output.frontFootLift, motion).toBe(0);
      expect(output.footBlend, motion).toBe(0);
    }
  });
});
