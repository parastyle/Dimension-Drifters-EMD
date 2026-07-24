import { meleeComboSelectionFor, WEAPONS } from "@dd/shared";
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
  "teep-kick",
  "spinning-back-elbow",
  "chain-punch",
  "oblique-kick",
  "double-palm",
  "sway-jab",
  "weave-cross",
  "weave-backfist",
  "sweeping-leg",
  "frontflip-heel-drop",
  "crushing-palm",
  "stomp-kick",
  "mantis-double-hook",
];

function impactSample(motion: KungFuWrapMotion) {
  const input = createKungFuWrapPoseInput();
  input.motion = motion;
  input.limb =
    motion === "knee-strike" || motion === "roundhouse-kick" || motion === "backflip-head-kick"
      ? "foot"
      : "hand";
  input.t = input.timing.impact ?? input.timing.activeEnd;
  return sampleKungFuWrapPose(input, createKungFuWrapPoseSample());
}

function comboSample(weaponId: string, stepIndex: number, t: number) {
  const weapon = WEAPONS[weaponId];
  const step = weapon && meleeComboSelectionFor(weapon)?.sequence[stepIndex];
  if (!step || !isKungFuMotion(step.motion))
    throw new Error(`Missing B25 pose fixture ${weaponId}:${stepIndex}`);
  const input = createKungFuWrapPoseInput();
  input.motion = step.motion;
  input.hand = step.hand;
  input.limb = step.limb ?? "hand";
  input.direction = step.direction;
  input.timing = step.timing;
  input.theatrics = step.theatrics;
  input.strikeReachBodyHeights = (weapon!.range * step.path.rangeMultiplier) / 76;
  input.t = t;
  return sampleKungFuWrapPose(input, createKungFuWrapPoseSample());
}

function isKungFuMotion(motion: string): motion is KungFuWrapMotion {
  return (MOTIONS as readonly string[]).includes(motion);
}

describe("B25 theatrical kung-fu wrap full-body pose sampler", () => {
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

  it("sweeps the roundhouse across a big lateral arc instead of posing a static kick", () => {
    const input = createKungFuWrapPoseInput();
    input.motion = "roundhouse-kick";
    input.limb = "foot";
    input.t = input.timing.activeStart;
    const opening = { ...sampleKungFuWrapPose(input, createKungFuWrapPoseSample()) };
    input.t = input.timing.impact ?? input.timing.activeEnd;
    const impact = sampleKungFuWrapPose(input, createKungFuWrapPoseSample());

    expect(opening.frontFootLateral).toBeLessThan(-0.35);
    expect(impact.frontFootLateral).toBeGreaterThan(0.35);
    expect(impact.bodyRotation).toBeGreaterThan(0.4);
  });

  it("drives the front-flip heel drop through the shared full-card tumble channel", () => {
    const flip = comboSample("x2-drunken-fist-wraps", 4, 0.3);
    expect(flip.flipProgress).toBeGreaterThan(0.45);
    expect(flip.flipProgress).toBeLessThan(0.8);
    expect(flip.flipDirection).toBe(1);
    expect(flip.wholeBodyLift).toBeGreaterThan(0.4);
    expect(flip.frontFootLift).toBeGreaterThan(0.35);
    expect(flip.frontFootForward).toBeGreaterThan(1);
  });

  it("turns the entire paper rig through the far mirror on both authored roundhouses", () => {
    for (const [weaponId, stepIndex] of [
      ["x2-muay-thai-wraps", 4],
      ["x2-iron-palm-wraps", 2],
    ] as const) {
      const weapon = WEAPONS[weaponId]!;
      const step = meleeComboSelectionFor(weapon)!.sequence[stepIndex]!;
      const impact = comboSample(weaponId, stepIndex, step.timing.impact!);
      const held = comboSample(weaponId, stepIndex, step.timing.followEnd);
      const resolved = comboSample(weaponId, stepIndex, 1);
      expect(impact.paperTurnProgress, weaponId).toBeGreaterThan(0.5);
      expect(impact.paperTurnScaleX, weaponId).toBeLessThan(-0.5);
      expect(held.paperTurnScaleX, weaponId).toBeLessThan(-0.5);
      expect(resolved.paperTurnScaleX, weaponId).toBeCloseTo(1, 8);
    }
  });

  it("wild-stretches only the signature striking limb through impact and snaps it back", () => {
    const dragon = comboSample("x2-muay-thai-wraps", 0, 0.29);
    expect(dragon.frontFootStretch).toBeCloseTo(2.15, 8);
    expect(dragon.handStretch).toBe(1);
    const hook = comboSample("x2-iron-palm-wraps", 3, 0.39);
    expect(hook.handStretch).toBeCloseTo(2.1, 8);
    expect(hook.rearHandStretch).toBeCloseTo(2.1, 8);
    const held = comboSample("x2-iron-palm-wraps", 3, 0.7);
    expect(held.handStretch).toBeCloseTo(2.1, 8);
    expect(held.rearHandStretch).toBeCloseTo(2.1, 8);
    const snapped = comboSample("x2-iron-palm-wraps", 3, 1.01);
    expect(snapped.handStretch).toBe(1);
    expect(snapped.rearHandStretch).toBe(1);
  });

  it("holds the crane, mantis, and champion silhouettes between the strike and next beat", () => {
    const champion = comboSample("x2-muay-thai-wraps", 4, 0.8);
    expect(champion.holdPose).toBe("champion-guard");
    expect(champion.holdStrength).toBe(1);
    expect(Math.abs(champion.handLateral)).toBeGreaterThan(0.18);
    expect(Math.abs(champion.rearHandLateral)).toBeGreaterThan(0.18);
    expect(Math.sign(champion.handLateral)).toBe(-Math.sign(champion.rearHandLateral));

    const crane = comboSample("x2-drunken-fist-wraps", 4, 0.8);
    expect(crane.holdPose).toBe("crane-one-leg");
    expect(crane.frontFootLift).toBeGreaterThan(0.5);

    const mantis = comboSample("x2-iron-palm-wraps", 3, 0.8);
    expect(mantis.holdPose).toBe("praying-mantis");
    expect(mantis.handAngleOffset).toBeGreaterThan(0.9);
    expect(mantis.rearHandAngleOffset).toBeLessThan(-0.6);
  });

  it("extends visible limb travel with the exact authored hit-envelope reach", () => {
    const input = createKungFuWrapPoseInput();
    input.motion = "chain-punch";
    input.t = input.timing.impact ?? input.timing.activeEnd;
    input.strikeReachBodyHeights = 1.05;
    const close = { ...sampleKungFuWrapPose(input, createKungFuWrapPoseSample()) };
    input.strikeReachBodyHeights = 1.8;
    const long = sampleKungFuWrapPose(input, createKungFuWrapPoseSample());
    expect(long.handForward).toBeGreaterThan(close.handForward + 0.35);
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
      expect(output.wholeBodyLift, motion).toBe(0);
      expect(output.flipProgress, motion).toBe(-1);
      expect(output.flipDirection, motion).toBe(0);
      expect(output.paperTurnScaleX, motion).toBe(1);
      expect(output.handStretch, motion).toBe(1);
      expect(output.frontFootStretch, motion).toBe(1);
      expect(output.holdPose, motion).toBeUndefined();
    }
  });
});
