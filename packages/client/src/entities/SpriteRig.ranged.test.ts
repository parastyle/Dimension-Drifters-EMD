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

// BAR-4 FIX — append-only raw-intent boundaries. The action at 1_000ms must clear the authored state
// between the 999ms and 1_001ms observations, even when gameplay never resolves displacement/action.
describe("SpriteRig BAR-4 raw Arena intent boundaries", () => {
  const quietIntent = () => ({
    attack: false,
    parryOrBrace: false,
    jumpOrDodge: false,
    interaction: false,
    weaponSelection: false,
    desiredMoveX: 0,
    desiredMoveY: 0,
  });

  async function expectCancelledAcrossOneMillisecondBoundary(
    intent: ReturnType<typeof quietIntent>,
    previousMoveX = 0,
    previousMoveY = 0,
  ): Promise<void> {
    const { rawFlourishIntentCancels, SpriteRig } = await import("./SpriteRig.js");
    let nowMs = 999;
    const rig = Object.create(SpriteRig.prototype) as {
      flourishChannels: Array<{ active: boolean; startMs: number }>;
      flourishArms: Array<{ armed: boolean; earliestStartMs: number; weaponId: string }>;
      stowProxies: Array<{ img?: { destroy(): void }; startMs: number; destroyAtMs: number }>;
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
      { active: true, startMs: 900 },
      { active: false, startMs: -1e9 },
    ];
    rig.flourishArms = [
      { armed: false, earliestStartMs: -1e9, weaponId: "" },
      { armed: false, earliestStartMs: -1e9, weaponId: "" },
    ];
    rig.stowProxies = [
      { startMs: -1e9, destroyAtMs: -1e9 },
      { startMs: -1e9, destroyAtMs: -1e9 },
    ];
    rig.flourishHeadX = 2;
    rig.flourishHeadY = -1;
    rig.flourishCancelGeneration = 0;
    rig.idleFlourishEligibleAtMs = 0;
    rig.idleFlourishOffsetMs = 0;
    rig.presentationClockNow = () => nowMs;

    expect(rig.flourishChannels[0]?.active, "1ms before").toBe(true);
    nowMs = 1_000;
    expect(rawFlourishIntentCancels(intent, previousMoveX, previousMoveY), "at edge").toBe(true);
    rig.cancelFlourish("raw-arena-input");
    expect(rig.flourishChannels[0]?.active, "at edge").toBe(false);
    nowMs = 1_001;
    rig.cancelFlourish("raw-arena-input");
    expect(rig.flourishChannels[0]?.active, "1ms after").toBe(false);
    expect(rig.flourishCancelEdge).toBe(1);
  }

  it("cancels at the 1ms edge for desired movement blocked to zero displacement", async () => {
    const intent = quietIntent();
    intent.desiredMoveX = 1;
    await expectCancelledAcrossOneMillisecondBoundary(intent);
  });

  it("cancels at the 1ms edge for cooldown-rejected parry/brace", async () => {
    const intent = quietIntent();
    intent.parryOrBrace = true;
    await expectCancelledAcrossOneMillisecondBoundary(intent);
  });

  it("cancels at the 1ms edge for jump", async () => {
    const intent = quietIntent();
    intent.jumpOrDodge = true;
    await expectCancelledAcrossOneMillisecondBoundary(intent);
  });

  it("cancels at the 1ms edge for interaction", async () => {
    const intent = quietIntent();
    intent.interaction = true;
    await expectCancelledAcrossOneMillisecondBoundary(intent);
  });

  it.each(["Q", "E"])("cancels at the 1ms edge for %s weapon selection", async () => {
    const intent = quietIntent();
    intent.weaponSelection = true;
    await expectCancelledAcrossOneMillisecondBoundary(intent);
  });

  it("uses the shared hitch threshold for hard desired-axis changes but permits steady gait", async () => {
    const { flourishMovementIntent } = await import("./SpriteRig.js");
    expect(flourishMovementIntent(1, 0, 1, 0)).toBe(false);
    expect(flourishMovementIntent(1, 0, 1, -1)).toBe(false);
    expect(flourishMovementIntent(1, 0, 0, -1)).toBe(true);
    expect(flourishMovementIntent(1, 0, -1, 0)).toBe(true);
  });
});

// ARM-WPN-02 — append-only lazy-art clock-cut coverage for the two audited expansion failures.
describe("SpriteRig retained lazy-art draw transition", () => {
  it.each([
    "x2-hailshot-hand-maul",
    "x2-codex-of-forked-tongues",
  ])("starts %s's incoming draw after a loading hitch", async (weaponId) => {
    const { SpriteRig } = await import("./SpriteRig.js");
    const { weaponFlourishSpecFor } = await import("../sprites/pose-language.js");
    const def = WEAPONS[weaponId];
    if (!def) throw new Error(`missing lazy-art flourish fixture: ${weaponId}`);
    const spec = weaponFlourishSpecFor(def);
    type RigInstance = InstanceType<typeof SpriteRig>;
    const rig = Object.create(SpriteRig.prototype) as RigInstance;
    Object.assign(rig, {
      flourishChannels: [
        { active: false, startMs: -1e9, moment: "draw", hand: 0, rotationSign: 1, spec },
        { active: false, startMs: -1e9, moment: "draw", hand: 1, rotationSign: -1, spec },
      ],
      flourishArms: [
        { armed: false, earliestStartMs: -1e9, weaponId: "" },
        { armed: false, earliestStartMs: -1e9, weaponId: "" },
      ],
      stowProxies: [
        { startMs: -1e9, destroyAtMs: -1e9 },
        { startMs: -1e9, destroyAtMs: -1e9 },
      ],
      flourishStreaks: [
        { count: 0, lastAcceptedMs: -1e9, weaponId: "" },
        { count: 0, lastAcceptedMs: -1e9, weaponId: "" },
      ],
      flourishHeadX: 0,
      flourishHeadY: 0,
      pendingSwapKey: `old->${weaponId}`,
      pendingSwapObservedKey: `old->${weaponId}`,
      pendingSwapEpochMs: 100,
      lastSwapKey: `old->${weaponId}`,
      lastSwapObservedKey: `old->${weaponId}`,
      bladeNeutralReady: true,
      idleFlourishEligibleAtMs: 0,
      idleFlourishOffsetMs: 0,
      flourishLeadSpec: spec,
      flourishOffSpec: undefined,
      weapons: [{ def }],
      pairCeremonyStartMs: 0,
      presentationClockNow: () => 500,
    });
    const internals = SpriteRig.prototype as unknown as {
      resetFlourishState(
        this: RigInstance,
        clearCounters: boolean,
        preservePendingSwap?: boolean,
      ): void;
      completePendingWeaponSwap(this: RigInstance): void;
    };

    internals.resetFlourishState.call(rig, false, true);
    expect(rig.weaponSwapPending).toBe(true);
    internals.completePendingWeaponSwap.call(rig);

    const channels = (
      rig as unknown as {
        flourishChannels: Array<{
          active: boolean;
          moment: string;
          startMs: number;
          spec: { family: string };
        }>;
      }
    ).flourishChannels;
    expect(channels[0]).toMatchObject({
      active: true,
      moment: "draw",
      startMs: 500,
      spec: { family: spec.family },
    });
  });
});

// V3G2/V3G3/V3G4/V3G5 -- append-only grip and gun-law coverage.
describe("SpriteRig V3G grip and mechanism laws", () => {
  it("transforms a normalized secondary anchor through weapon scale and rotation", async () => {
    const { resolveSecondaryGripPosition } = await import("./SpriteRig.js");
    const out = { x: 0, y: 0 };
    resolveSecondaryGripPosition(
      {
        primaryX: 10,
        primaryY: 20,
        spriteWidth: 100,
        spriteHeight: 40,
        scaleX: 2,
        scaleY: 1,
        rotationRad: Math.PI / 2,
        primary: { x: 0.1, y: 0.5 },
        secondary: { x: 0.4, y: 0.75 },
        flourishForward: 0,
        flourishLateral: 0,
      },
      out,
    );
    expect(out.x).toBeCloseTo(0, 10);
    expect(out.y).toBeCloseTo(80, 10);
  });

  it("samples pump, lever, and ordered four-phase bolt strokes while reduced motion stays anchored", async () => {
    const {
      gunHandlingCycleDurationMs,
      sampleGunHandlingHandOffset,
      secondaryGripHandRendersAbove,
    } = await import("./SpriteRig.js");
    const out = { forward: 0, lateral: 0 };
    const pumpDuration = gunHandlingCycleDurationMs("pump", 0.4);
    sampleGunHandlingHandOffset("pump", pumpDuration * 0.42, pumpDuration, 100, false, out);
    expect(out.forward).toBeCloseTo(-10, 10);
    expect(out.lateral).toBe(0);
    sampleGunHandlingHandOffset("pump", pumpDuration * 0.8, pumpDuration, 100, false, out);
    expect(out.forward).toBeGreaterThan(-10);
    const leverDuration = gunHandlingCycleDurationMs("lever", 0.34);
    sampleGunHandlingHandOffset("lever", leverDuration * 0.4, leverDuration, 100, false, out);
    expect(out.forward).toBeCloseTo(-3.5, 10);
    expect(out.lateral).toBeCloseTo(7, 10);
    sampleGunHandlingHandOffset("lever", leverDuration * 0.8, leverDuration, 100, false, out);
    expect(out.lateral).toBeLessThan(7);
    const boltDuration = gunHandlingCycleDurationMs("bolt", 1.15);
    expect(boltDuration).toBe(520);
    sampleGunHandlingHandOffset("bolt", boltDuration * 0.3, boltDuration, 100, false, out);
    expect(out.forward).toBeCloseTo(-11.5, 10);
    expect(out.lateral).toBe(0);
    sampleGunHandlingHandOffset("bolt", boltDuration * 0.5, boltDuration, 100, false, out);
    expect(out.forward).toBeCloseTo(-8, 10);
    expect(out.lateral).toBeCloseTo(10, 10);
    sampleGunHandlingHandOffset("bolt", boltDuration * 0.68, boltDuration, 100, false, out);
    expect(out.forward).toBeCloseTo(-4, 10);
    expect(out.lateral).toBeCloseTo(-9, 10);
    sampleGunHandlingHandOffset("bolt", boltDuration * 0.86, boltDuration, 100, false, out);
    expect(out.forward).toBeCloseTo(8, 10);
    expect(out.lateral).toBe(0);
    sampleGunHandlingHandOffset("pump", pumpDuration * 0.42, pumpDuration, 100, true, out);
    expect(out).toEqual({ forward: 0, lateral: 0 });
    expect(secondaryGripHandRendersAbove("pump")).toBe(true);
    expect(secondaryGripHandRendersAbove("lever")).toBe(true);
    expect(secondaryGripHandRendersAbove("bolt")).toBe(true);
  });

  it("starts one immediate mechanism cycle from every accepted tagged shot", async () => {
    const { SpriteRig, gunHandlingMechanismFor } = await import("./SpriteRig.js");
    const mechanisms = Object.values(WEAPONS).filter(
      (weapon) => gunHandlingMechanismFor(weapon) !== undefined,
    );
    expect(mechanisms).toHaveLength(31);
    for (const weapon of mechanisms) {
      const rig = Object.create(SpriteRig.prototype) as {
        weapons: Array<{ def: typeof weapon }>;
        weaponDef: typeof weapon;
        attackBeatSeq: number;
        gunHandlingCycles: Array<{
          active: boolean;
          acceptedSeq: number;
          mechanism?: "bolt" | "lever" | "pump";
          startMs: number;
          weaponId: string;
        }>;
      };
      Object.assign(rig, {
        weapons: [{ def: weapon }],
        weaponDef: weapon,
        attackBeatSeq: 17,
        gunHandlingCycles: [
          { active: false, acceptedSeq: 0, startMs: -1e9, weaponId: "" },
          { active: false, acceptedSeq: 0, startMs: -1e9, weaponId: "" },
        ],
      });
      const internals = SpriteRig.prototype as unknown as {
        recordAcceptedRangedBeat(this: typeof rig, hand: 0 | 1, epochMs: number): void;
      };
      internals.recordAcceptedRangedBeat.call(rig, 0, 2_000);
      expect(rig.gunHandlingCycles[0], weapon.id).toEqual({
        active: true,
        acceptedSeq: 17,
        mechanism: gunHandlingMechanismFor(weapon),
        startMs: 2_000,
        weaponId: weapon.id,
      });
    }
  });

  it("retains independent accepted-shot lever clocks for both Sidewinder hands", async () => {
    const { SpriteRig } = await import("./SpriteRig.js");
    const sidewinder = WEAPONS["x2-sidewinder-twin-rifles"];
    if (!sidewinder) throw new Error("missing Sidewinder dual-lever fixture");
    const rig = Object.create(SpriteRig.prototype) as {
      weapons: Array<{ def: typeof sidewinder }>;
      weaponDef: typeof sidewinder;
      attackBeatSeq: number;
      gunHandlingCycles: Array<{
        active: boolean;
        acceptedSeq: number;
        mechanism?: "bolt" | "lever" | "pump";
        startMs: number;
        weaponId: string;
      }>;
    };
    Object.assign(rig, {
      weapons: [{ def: sidewinder }, { def: sidewinder }],
      weaponDef: sidewinder,
      attackBeatSeq: 40,
      gunHandlingCycles: [
        { active: false, acceptedSeq: 0, startMs: -1e9, weaponId: "" },
        { active: false, acceptedSeq: 0, startMs: -1e9, weaponId: "" },
      ],
    });
    const internals = SpriteRig.prototype as unknown as {
      recordAcceptedRangedBeat(this: typeof rig, hand: 0 | 1, epochMs: number): void;
    };
    internals.recordAcceptedRangedBeat.call(rig, 0, 1_000);
    rig.attackBeatSeq = 41;
    internals.recordAcceptedRangedBeat.call(rig, 1, 1_140);
    expect(rig.gunHandlingCycles).toEqual([
      {
        active: true,
        acceptedSeq: 40,
        mechanism: "lever",
        startMs: 1_000,
        weaponId: sidewinder.id,
      },
      {
        active: true,
        acceptedSeq: 41,
        mechanism: "lever",
        startMs: 1_140,
        weaponId: sidewinder.id,
      },
    ]);
  });

  it("fits every tagged mechanism cycle inside its accepted fire cadence", async () => {
    const { gunHandlingCycleDurationMs, gunHandlingMechanismFor } = await import("./SpriteRig.js");
    for (const weapon of Object.values(WEAPONS)) {
      const mechanism = gunHandlingMechanismFor(weapon);
      if (!mechanism) continue;
      const fireRateMs = (weapon.gun?.fireRate ?? 0) * 1_000;
      expect(gunHandlingCycleDurationMs(mechanism, weapon.gun?.fireRate), weapon.id).toBeLessThan(
        fireRateMs,
      );
    }
  });
});

describe("SpriteRig V3G pistol idle twirl", () => {
  it("starts its 0.5s quiet clock after shot recovery and reuses the pistol twirl beat", async () => {
    const {
      idleFlourishEligibleEpoch,
      PISTOL_DUAL_TWIRL_STAGGER_MS,
      PISTOL_IDLE_TWIRL_DELAY_MS,
      RANGED_GUN_RECOVERY_MS,
    } = await import("./SpriteRig.js");
    const { weaponFlourishSpecFor } = await import("../sprites/pose-language.js");
    const pistol = WEAPONS["x-gun-revolver-cannon"];
    if (!pistol) throw new Error("missing pistol idle fixture");
    expect(idleFlourishEligibleEpoch(pistol, 2_000, 537)).toBe(2_500);
    const recoveryEndsAt = 2_000 + RANGED_GUN_RECOVERY_MS;
    expect(idleFlourishEligibleEpoch(pistol, 2_050, 537, recoveryEndsAt)).toBe(2_820);
    expect(RANGED_GUN_RECOVERY_MS).toBe(320);
    expect(PISTOL_IDLE_TWIRL_DELAY_MS).toBe(500);
    expect(PISTOL_DUAL_TWIRL_STAGGER_MS).toBe(40);
    const spec = weaponFlourishSpecFor(pistol);
    expect(spec.idleSettle).toBe(spec.afterAttack);
    expect(spec.idleSettle?.rotationRad).toBe(Math.PI * 2);
  });

  it("cancels an active twirl on fire and restarts its 0.5s quiet clock", async () => {
    const { SpriteRig } = await import("./SpriteRig.js");
    const pistol = WEAPONS["x-gun-ricochet-pistol"];
    if (!pistol) throw new Error("missing pistol cancel fixture");
    const rig = Object.create(SpriteRig.prototype) as {
      flourishChannels: Array<{ active: boolean; startMs: number }>;
      flourishArms: Array<{ armed: boolean; earliestStartMs: number; weaponId: string }>;
      stowProxies: Array<{ img?: { destroy(): void }; startMs: number; destroyAtMs: number }>;
      flourishHeadX: number;
      flourishHeadY: number;
      flourishCancelGeneration: number;
      idleFlourishEligibleAtMs: number;
      idleFlourishOffsetMs: number;
      weaponDef: typeof pistol;
      weapons: Array<{ def: typeof pistol }>;
      presentationClockNow(): number;
      cancelFlourish(reason?: string): void;
      readonly flourishCancelEdge: number;
    };
    Object.assign(rig, {
      flourishChannels: [
        { active: true, startMs: 1_000 },
        { active: false, startMs: -1e9 },
      ],
      flourishArms: [
        { armed: false, earliestStartMs: -1e9, weaponId: "" },
        { armed: false, earliestStartMs: -1e9, weaponId: "" },
      ],
      stowProxies: [
        { startMs: -1e9, destroyAtMs: -1e9 },
        { startMs: -1e9, destroyAtMs: -1e9 },
      ],
      flourishHeadX: 0,
      flourishHeadY: 0,
      flourishCancelGeneration: 0,
      idleFlourishEligibleAtMs: Number.POSITIVE_INFINITY,
      idleFlourishOffsetMs: 600,
      weaponDef: pistol,
      weapons: [{ def: pistol }],
      presentationClockNow: () => 2_000,
    });
    rig.cancelFlourish("accepted-attack");
    expect(rig.flourishChannels[0]?.active).toBe(false);
    expect(rig.idleFlourishEligibleAtMs).toBe(2_500);
    expect(rig.flourishCancelEdge).toBe(1);
  });
});
