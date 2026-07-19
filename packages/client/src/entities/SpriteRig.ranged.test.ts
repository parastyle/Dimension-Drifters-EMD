import { WEAPONS } from "@dd/shared";
import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({ default: {} }));

import { firingHandTarget } from "../sprites/firing-stance.js";
import {
  createPoseLanguageInput,
  createPoseLanguageSample,
  poseImpulsePending,
  samplePoseLanguage,
  weaponPoseSpecFor,
} from "../sprites/pose-language.js";
import {
  RANGED_AIM_LINGER_MS,
  RANGED_AIM_RAISE_MS,
  RANGED_AIM_SETTLE_MS,
  sampleRangedAimBlend,
} from "./SpriteRig.js";

describe("SpriteRig ranged aimed-pose envelope", () => {
  it("raises quickly, holds through linger, and settles back to rest", () => {
    const raiseAt = 1_000;
    const activeUntil = raiseAt + RANGED_AIM_LINGER_MS;
    expect(sampleRangedAimBlend(raiseAt - 1, raiseAt, activeUntil)).toBe(0);
    expect(sampleRangedAimBlend(raiseAt + RANGED_AIM_RAISE_MS, raiseAt, activeUntil)).toBe(1);
    expect(sampleRangedAimBlend(activeUntil, raiseAt, activeUntil)).toBe(1);
    expect(sampleRangedAimBlend(activeUntil + RANGED_AIM_SETTLE_MS, raiseAt, activeUntil)).toBe(0);
  });
});

// POSE IMPLEMENTATION WAVE — append-only guard/support sequencing under the retained gun envelope.
describe("SpriteRig ranged pose-language handoff", () => {
  it("keeps barrel truth fixed while the free hand guards through raise, shot, linger, and settle", () => {
    const pistol = WEAPONS["x-gun-ricochet-pistol"];
    if (!pistol) throw new Error("missing pistol pose fixture");
    const input = createPoseLanguageInput();
    input.spec = weaponPoseSpecFor(pistol);
    input.freeHand = 1;
    input.reducedMotion = true;
    const out = createPoseLanguageSample();
    const firingTarget = firingHandTarget(pistol, "lead", 0.4);
    const stages = [
      { now: 1_000, phase: "anticipation" as const, phaseT: 0 },
      { now: 1_090, phase: "anticipation" as const, phaseT: 1 },
      { now: 1_140, phase: "active" as const, phaseT: 0.5 },
      { now: 1_250, phase: "recovery" as const, phaseT: 0.2 },
      { now: 1_430, phase: "recovery" as const, phaseT: 1 },
    ];
    for (const stage of stages) {
      input.phase = stage.phase;
      input.phaseT = stage.phaseT;
      samplePoseLanguage(input, out);
      expect(out.offBlend, `${stage.phase}:guard`).toBeGreaterThan(0.8);
      expect(firingHandTarget(pistol, "lead", 0.4)).toEqual(firingTarget);
    }
    expect(sampleRangedAimBlend(1_000, 1_000, 1_250)).toBe(0);
    expect(sampleRangedAimBlend(1_090, 1_000, 1_250)).toBe(1);
    expect(sampleRangedAimBlend(1_250, 1_000, 1_250)).toBe(1);
    expect(sampleRangedAimBlend(1_430, 1_000, 1_250)).toBe(0);
  });

  it("offers one recoil-catch impulse per shot edge instead of reinjecting each frame", () => {
    const edge = 2_000;
    let consumed = -1e9;
    expect(poseImpulsePending(edge, edge, consumed)).toBe(true);
    consumed = edge;
    for (const now of [2_001, 2_016, 2_100]) {
      expect(poseImpulsePending(now, edge, consumed)).toBe(false);
    }
    expect(poseImpulsePending(2_200, 2_200, consumed)).toBe(true);
  });

  it("braces and releases a beam without changing its base weapon family", () => {
    const beam = WEAPONS["x2-voltcaster-machine-pistol"];
    if (!beam) throw new Error("missing beam pose fixture");
    const input = createPoseLanguageInput();
    input.spec = weaponPoseSpecFor(beam);
    input.freeHand = 1;
    input.phase = "active";
    input.beamPhase = "active";
    const braced = samplePoseLanguage(input, createPoseLanguageSample());
    input.phase = "recovery";
    input.phaseT = 0;
    input.beamPhase = "cooling";
    const released = samplePoseLanguage(input, createPoseLanguageSample());
    expect(input.spec.family).toBe("pistol");
    expect(braced.offOwn).toBeGreaterThan(0.8);
    expect(Math.abs(released.offLateral)).toBeGreaterThan(Math.abs(braced.offLateral));
  });
});

// FLOURISH IMPLEMENTATION WAVE — append-only earned-edge and live-terminal coverage.
describe("SpriteRig flourish eligibility math", () => {
  it("arms a pistol hand on its third accepted edge and resets outside the cadence window", async () => {
    const { flourishStreakWindowMs, nextFlourishStreakCount } = await import("./SpriteRig.js");
    const windowMs = flourishStreakWindowMs(0.24);
    expect(windowMs).toBeCloseTo(528, 10);
    let count = 0;
    let last = -1e9;
    for (const acceptedAt of [1_000, 1_220, 1_440]) {
      count = nextFlourishStreakCount(count, last, true, acceptedAt, windowMs);
      last = acceptedAt;
    }
    expect(count).toBe(3);
    expect(nextFlourishStreakCount(count, last, true, last + windowMs + 1, windowMs)).toBe(1);
    expect(nextFlourishStreakCount(count, last, false, last + 1, windowMs)).toBe(1);
  });

  it("uses live three-step and six-step sequence lengths without a familiar hard-coded index", async () => {
    const { isTerminalFlourishStep } = await import("./SpriteRig.js");
    expect(isTerminalFlourishStep(0, 3)).toBe(false);
    expect(isTerminalFlourishStep(1, 3)).toBe(false);
    expect(isTerminalFlourishStep(2, 3)).toBe(true);
    expect(isTerminalFlourishStep(4, 6)).toBe(false);
    expect(isTerminalFlourishStep(5, 6)).toBe(true);
  });
});

describe("SpriteRig flourish cancellation edge", () => {
  it("drops every authored transform and outgoing proxy synchronously on input", async () => {
    const { SpriteRig } = await import("./SpriteRig.js");
    const destroyLeadProxy = vi.fn();
    const rig = Object.create(SpriteRig.prototype) as {
      flourishChannels: Array<{ active: boolean; startMs: number }>;
      flourishArms: Array<{ armed: boolean; earliestStartMs: number; weaponId: string }>;
      stowProxies: Array<{
        img?: { destroy(): void };
        startMs: number;
        destroyAtMs: number;
      }>;
      flourishHeadX: number;
      flourishHeadY: number;
      flourishCancelGeneration: number;
      idleFlourishEligibleAtMs: number;
      idleFlourishOffsetMs: number;
      presentationClockNow(): number;
      cancelFlourish(reason?: string): void;
      readonly flourishCancelEdge: number;
    };
    rig.flourishChannels = [
      { active: true, startMs: 100 },
      { active: true, startMs: 155 },
    ];
    rig.flourishArms = [
      { armed: true, earliestStartMs: 220, weaponId: "lead" },
      { armed: true, earliestStartMs: 275, weaponId: "off" },
    ];
    rig.stowProxies = [
      { img: { destroy: destroyLeadProxy }, startMs: 100, destroyAtMs: 300 },
      { startMs: -1e9, destroyAtMs: -1e9 },
    ];
    rig.flourishHeadX = 3;
    rig.flourishHeadY = -2;
    rig.flourishCancelGeneration = 0;
    rig.idleFlourishEligibleAtMs = 0;
    rig.idleFlourishOffsetMs = 120;
    rig.presentationClockNow = () => 1_000;

    rig.cancelFlourish("attack-input");

    expect(rig.flourishChannels.every((channel) => !channel.active)).toBe(true);
    expect(rig.flourishArms.every((arm) => !arm.armed && arm.weaponId === "")).toBe(true);
    expect(rig.stowProxies.every((proxy) => proxy.img === undefined)).toBe(true);
    expect(destroyLeadProxy).toHaveBeenCalledOnce();
    expect([rig.flourishHeadX, rig.flourishHeadY]).toEqual([0, 0]);
    expect(rig.flourishCancelEdge).toBe(1);
    expect(rig.idleFlourishEligibleAtMs).toBe(2_720);
  });
});
