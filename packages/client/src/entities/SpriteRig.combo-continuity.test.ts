import {
  meleeComboSelectionFor,
  swingDescriptorFor,
  swingDescriptorWithComboStep,
  WEAPONS,
  type WeaponSizeClass,
} from "@dd/shared";
import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({
  default: {
    BlendModes: { ADD: 1 },
    TintModes: { FILL: 1, MULTIPLY: 2 },
  },
}));

import {
  blendComboStagePoseTransform,
  COMBO_STAGE_TRANSITION_MAX_MS,
  type ComboStagePoseTransform,
  comboStageTransitionDurationMs,
  createCloseBladePoseInput,
  createCloseBladePoseSample,
  sampleCloseBladePose,
} from "./SpriteRig.js";

const REPRESENTATIVES: ReadonlyArray<{
  id: string;
  sizeClass?: WeaponSizeClass;
}> = [
  { id: "x2-dustreaper-zweihander" },
  { id: "drift-wakizashi-kagewake", sizeClass: "short" },
  { id: "drift-katana-stillwater-edict", sizeClass: "standard" },
  { id: "drift-nodachi-pale-horizon", sizeClass: "long" },
  { id: "drift-greatkatana-moonwake", sizeClass: "great" },
  { id: "drift-colossal-world-seam", sizeClass: "colossal" },
];

function boundaryPose(step: number, direction: number, end: boolean): ComboStagePoseTransform {
  const phase = step + (end ? 0.75 : 0.15);
  return {
    x: phase * 9 + direction * 3,
    y: phase * -5 + direction * 2,
    rotation: direction * 0.8 + phase * 0.21,
    scaleX: 1 - phase * 0.025,
    scaleY: 1 + phase * 0.018,
  };
}

// G3 -- append-only category coverage for Dustreaper and every authored melee sizeClass.
describe("SpriteRig combo stage continuity", () => {
  it.each(REPRESENTATIVES)("bridges every $id stage boundary without a pose cut", ({
    id,
    sizeClass,
  }) => {
    const weapon = WEAPONS[id];
    if (!weapon) throw new Error(`Missing G3 representative: ${id}`);
    if (sizeClass) expect(weapon.sizeClass, id).toBe(sizeClass);
    const selection = meleeComboSelectionFor(weapon);
    expect(selection, id).toBeDefined();
    if (!selection) return;
    expect(selection.sequence.length, id).toBeGreaterThan(1);

    for (let nextIndex = 1; nextIndex < selection.sequence.length; nextIndex++) {
      const previousStep = selection.sequence[nextIndex - 1];
      const nextStep = selection.sequence[nextIndex];
      if (!previousStep || !nextStep) continue;
      const descriptor = swingDescriptorWithComboStep(
        swingDescriptorFor(weapon, weapon.cooldown),
        weapon,
        nextIndex,
      );
      const timingBefore = {
        activeStartSeconds: descriptor.activeStartSeconds,
        activeEndSeconds: descriptor.activeEndSeconds,
        impactSeconds: descriptor.impactSeconds,
        poseSeconds: descriptor.poseSeconds,
        effectiveCooldown: descriptor.effectiveCooldown,
      };
      const durationMs = comboStageTransitionDurationMs(descriptor.activeStartSeconds);
      expect(durationMs, `${id}:${nextIndex}:positive anticipation bridge`).toBeGreaterThan(0);
      expect(durationMs, `${id}:${nextIndex}:bounded`).toBeLessThanOrEqual(
        COMBO_STAGE_TRANSITION_MAX_MS,
      );
      expect(durationMs, `${id}:${nextIndex}:ends before active`).toBeLessThanOrEqual(
        descriptor.activeStartSeconds * 1000,
      );

      const previous = boundaryPose(nextIndex - 1, previousStep.direction, true);
      const target = boundaryPose(nextIndex, nextStep.direction, false);
      const atBoundary = { ...target };
      blendComboStagePoseTransform(previous, target, 0, durationMs, atBoundary);
      expect(atBoundary, `${id}:${nextIndex}:no discontinuity`).toEqual(previous);

      const afterBridge = { ...previous };
      blendComboStagePoseTransform(previous, target, durationMs, durationMs, afterBridge);
      expect(afterBridge.x).toBeCloseTo(target.x, 10);
      expect(afterBridge.y).toBeCloseTo(target.y, 10);
      expect(afterBridge.rotation).toBeCloseTo(target.rotation, 10);
      expect(afterBridge.scaleX).toBeCloseTo(target.scaleX, 10);
      expect(afterBridge.scaleY).toBeCloseTo(target.scaleY, 10);
      expect(descriptor).toMatchObject(timingBefore); // presentation sampling never retimes server truth
    }
  });

  it("preserves the authored claw/dagger lunge and releases it instead of treating it as a warp", () => {
    const input = createCloseBladePoseInput();
    const sample = createCloseBladePoseSample();
    Object.assign(input, {
      t: 0.44,
      serverActiveStart: 0.18,
      serverActiveEnd: 0.58,
      aimLocal: 0,
      effectiveCooldown: 0.42,
      targetTipRadius: 96,
      businessLength: 54,
      rigScale: 1,
      direction: 1,
      hand: "both",
      hasRearWeapon: true,
      variant: "claw",
    });
    sampleCloseBladePose(input, sample);
    expect(sample.frontGripBlend).toBeGreaterThan(0);
    expect(sample.backGripBlend).toBeGreaterThan(0);
    expect(sample.artX).toBeGreaterThan(0); // deliberate beat-3 paper advance remains authored motion

    input.t = 1;
    sampleCloseBladePose(input, sample);
    expect(sample.frontGripBlend).toBe(0);
    expect(sample.backGripBlend).toBe(0);
    expect(sample.artX).toBe(0);
    expect(sample.artY).toBe(0);
  });
});
