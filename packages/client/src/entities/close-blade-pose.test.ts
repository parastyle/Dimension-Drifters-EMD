import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({ default: {} }));

import {
  type CloseBladePoseInput,
  createCloseBladePoseSample,
  sampleCloseBladePose,
} from "./SpriteRig.js";

const BODY_HEIGHT = 76;
const PLAYER_RADIUS = 24;
const TARGET_TIP = BODY_HEIGHT + PLAYER_RADIUS;

function input(overrides: Partial<CloseBladePoseInput> = {}): CloseBladePoseInput {
  return {
    t: 0,
    serverActiveStart: 0.16,
    serverActiveEnd: 0.74,
    aimLocal: 0,
    effectiveCooldown: 0.18,
    targetTipRadius: TARGET_TIP,
    businessLength: 52.08,
    rigScale: 1,
    direction: 1,
    hand: "lead",
    hasRearWeapon: true,
    variant: "dagger",
    ...overrides,
  };
}

function tipRadius(
  gripX: number,
  gripY: number,
  angle: number,
  businessLength: number,
  artX: number,
  artY: number,
): number {
  return Math.hypot(
    gripX + Math.cos(angle) * businessLength + artX,
    gripY + Math.sin(angle) * businessLength + artY,
  );
}

describe("close-blade full-body pose sampler", () => {
  it("lands each selected dagger/claw business end on, but never beyond, the truthful tip", () => {
    for (const variant of ["dagger", "claw"] as const) {
      for (const aimLocal of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        for (const hand of ["lead", "off", "both"] as const) {
          const serverActiveStart = variant === "dagger" ? 0.16 : 0.1;
          const serverActiveEnd = variant === "dagger" ? 0.74 : 0.62;
          const contact =
            serverActiveStart +
            (serverActiveEnd - serverActiveStart) * (hand === "both" ? 0.5 : 0.54);
          const poseInput = input({
            t: contact,
            serverActiveStart,
            serverActiveEnd,
            aimLocal,
            direction: hand === "off" ? -1 : hand === "both" ? 0 : 1,
            hand,
            variant,
            businessLength: variant === "dagger" ? 52.08 : 34.8,
            effectiveCooldown: variant === "dagger" ? 0.18 : 0.3,
          });
          const sample = createCloseBladePoseSample();
          sampleCloseBladePose(poseInput, sample);
          const frontTip = tipRadius(
            sample.frontGripX,
            sample.frontGripY,
            sample.frontAngle,
            poseInput.businessLength,
            sample.artX,
            sample.artY,
          );
          const backTip = tipRadius(
            sample.backGripX,
            sample.backGripY,
            sample.backAngle,
            poseInput.businessLength,
            sample.artX,
            sample.artY,
          );
          const selectedTip = hand === "off" ? backTip : frontTip;
          expect(selectedTip, `${variant}/${hand}/${aimLocal}`).toBeCloseTo(TARGET_TIP, 5);
          expect(selectedTip).toBeLessThanOrEqual(TARGET_TIP + 1e-6);
          if (hand === "both") expect(backTip).toBeLessThanOrEqual(TARGET_TIP);
        }
      }
    }
  });

  it("alternates exact lead/off ownership and gives the finisher one dominant two-hand convergence", () => {
    const contact = 0.16 + (0.74 - 0.16) * 0.54;
    const sample = createCloseBladePoseSample();
    sampleCloseBladePose(input({ t: contact, hand: "lead" }), sample);
    expect(sample.frontOwn).toBe(1);
    expect(sample.backOwn).toBe(0);
    sampleCloseBladePose(input({ t: contact, hand: "off", direction: -1 }), sample);
    expect(sample.frontOwn).toBe(0);
    expect(sample.backOwn).toBe(1);
    sampleCloseBladePose(
      input({ t: 0.45, hand: "both", direction: 0, effectiveCooldown: 0.3 }),
      sample,
    );
    expect(sample.frontOwn).toBe(1);
    expect(sample.backOwn).toBe(1);
    const frontTip = tipRadius(
      sample.frontGripX,
      sample.frontGripY,
      sample.frontAngle,
      52.08,
      sample.artX,
      sample.artY,
    );
    const backTip = tipRadius(
      sample.backGripX,
      sample.backGripY,
      sample.backAngle,
      52.08,
      sample.artX,
      sample.artY,
    );
    expect(frontTip).toBeCloseTo(TARGET_TIP, 5);
    expect(backTip).toBeLessThan(frontTip);
  });

  it("retracts and returns every lunge-only channel to identity by the terminal hold sample", () => {
    const sample = createCloseBladePoseSample();
    for (const t of [0.92, 1]) {
      sampleCloseBladePose(input({ t, hand: "both", effectiveCooldown: 0.46 }), sample);
      expect(sample.frontGripBlend).toBe(0);
      expect(sample.backGripBlend).toBe(0);
      expect(sample.frontFootBlend).toBe(0);
      expect(sample.backFootBlend).toBe(0);
      expect(sample.frontOwn).toBe(0);
      expect(sample.backOwn).toBe(0);
      expect(sample.feetOwn).toBe(0);
      expect(sample.artX).toBe(0);
      expect(sample.artY).toBe(0);
      expect(sample.bodyX).toBe(0);
      expect(sample.bodyY).toBe(0);
      expect(sample.bodyRotation).toBe(0);
      expect(sample.bodyScaleX).toBe(1);
      expect(sample.bodyScaleY).toBe(1);
    }
  });

  it("keeps the Swift tier planted and caps slower finisher paper advance at six pixels", () => {
    const sample = createCloseBladePoseSample();
    sampleCloseBladePose(
      input({ t: 0.45, hand: "both", direction: 0, effectiveCooldown: 0.1476 }),
      sample,
    );
    expect(Math.hypot(sample.artX, sample.artY)).toBe(0);
    sampleCloseBladePose(
      input({ t: 0.45, hand: "both", direction: 0, effectiveCooldown: 0.216 }),
      sample,
    );
    expect(Math.hypot(sample.artX, sample.artY)).toBe(0);
    sampleCloseBladePose(
      input({ t: 0.45, hand: "both", direction: 0, effectiveCooldown: 0.46 }),
      sample,
    );
    expect(Math.hypot(sample.artX, sample.artY)).toBeLessThanOrEqual(6);
    expect(Math.hypot(sample.shadowX, sample.shadowY)).toBeLessThanOrEqual(3);
  });
});
