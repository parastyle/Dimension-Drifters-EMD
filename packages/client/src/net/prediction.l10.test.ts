import {
  INTERP_SNAP_PLAYER,
  MovementCorrectionBand,
  type MovementCorrectionBandValue,
} from "@dd/shared";
import { describe, expect, it } from "vitest";
import { limitPresentedRootStep } from "../entities/rig/rig-presentation.js";
import {
  SELF_STALL_RECOVERY_MS,
  type SelfCorrectionCause,
  type SelfCorrectionEvent,
  SelfPredictor,
  type ServerView,
} from "./prediction.js";

const FRAME_SECONDS = 1 / 60;
const FRAME_MS = FRAME_SECONDS * 1000;
const STALL_CORRECTION_PX = 320;
const STALL_MAX_FRAME_STEP_PX = 70;

function view(overrides: Partial<ServerView> = {}): ServerView {
  return {
    x: 1000,
    y: 1000,
    mvx: 0,
    mvy: 0,
    vx: 0,
    vy: 0,
    height: 0,
    vh: 0,
    ackSeq: 0,
    teleportSeq: 0,
    movementCorrectionSeq: 0,
    serverMotionEpoch: 0,
    serverMotionActive: false,
    alive: true,
    ...overrides,
  };
}

function expectEvent(
  event: SelfCorrectionEvent | undefined,
  cause: SelfCorrectionCause,
  band: MovementCorrectionBandValue,
  magnitudePx: number,
): void {
  expect(event).toMatchObject({ cause, band });
  expect(event?.magnitudePx).toBeCloseTo(magnitudePx, 6);
}

describe("Canon L10 — stale SELF prediction is not an authored teleport", () => {
  it("settles a >250ms stall resync within 80ms without a one-frame teleport", () => {
    const predictor = new SelfPredictor(view());
    const events: SelfCorrectionEvent[] = [];
    predictor.setCorrectionObserver((event) => events.push({ ...event }));

    const beforeStall = predictor.renderPos(0, 0, 0);
    predictor.forceResync(); // ArenaScene's unchanged deltaMs > 250 detector.
    predictor.reconcile(view({ x: beforeStall.x - STALL_CORRECTION_PX }));

    // Reconciliation rebases simulation, but SELF does not move on the patch edge.
    let presentedX = beforeStall.x;
    let presentedY = beforeStall.y;
    expect(predictor.renderPos(0, 0, 0)).toMatchObject(beforeStall);
    expectEvent(events[0], "stall-resync", MovementCorrectionBand.Smooth, STALL_CORRECTION_PX);
    expect(predictor.stats.correctionRemainingMs).toBe(SELF_STALL_RECOVERY_MS);
    expect(predictor.isFastStallRecovery).toBe(true);

    let worstStallFramePx = 0;
    for (let frame = 0; frame < 8; frame++) {
      const correctionWasFastStallRecovery = predictor.isFastStallRecovery;
      predictor.decayError(FRAME_SECONDS);
      const candidate = predictor.renderPos(0, 0, 0);
      const constrained = predictor.constrainRenderStep(
        presentedX,
        presentedY,
        candidate.x,
        candidate.y,
        0,
        0,
      );
      const next = limitPresentedRootStep(
        presentedX,
        presentedY,
        constrained.x,
        constrained.y,
        FRAME_MS,
        48,
        INTERP_SNAP_PLAYER,
        false,
        correctionWasFastStallRecovery || predictor.isFastStallRecovery,
      );
      worstStallFramePx = Math.max(
        worstStallFramePx,
        Math.hypot(next.x - presentedX, next.y - presentedY),
      );
      presentedX = next.x;
      presentedY = next.y;
    }
    expect(worstStallFramePx).toBeLessThan(STALL_MAX_FRAME_STEP_PX);
    expect(worstStallFramePx).toBeCloseTo(66.666667, 6);
    expect(presentedX).toBeCloseTo(beforeStall.x - STALL_CORRECTION_PX, 6);
    expect(presentedY).toBeCloseTo(beforeStall.y, 6);

    const teleportTarget = { x: 3000, y: 2600 };
    const beforeTeleport = { x: presentedX, y: presentedY };
    predictor.reconcile(
      view({
        ...teleportTarget,
        teleportSeq: 1,
        serverMotionEpoch: 1,
        serverMotionActive: true,
      }),
    );
    const teleported = predictor.renderPos(0, 0, 0);
    const teleportRoot = limitPresentedRootStep(
      beforeTeleport.x,
      beforeTeleport.y,
      teleported.x,
      teleported.y,
      FRAME_MS,
      48,
      INTERP_SNAP_PLAYER,
    );
    expect(teleportRoot).toMatchObject(teleportTarget);
    expect(Math.hypot(teleportRoot.x - beforeTeleport.x, teleportRoot.y - beforeTeleport.y)).toBe(
      Math.hypot(teleportTarget.x - beforeTeleport.x, teleportTarget.y - beforeTeleport.y),
    );
    expectEvent(
      events[1],
      "teleport",
      MovementCorrectionBand.Snap,
      Math.hypot(teleportTarget.x - beforeTeleport.x, teleportTarget.y - beforeTeleport.y),
    );
  });

  it("snaps once and resettles when fresh correction truth arrives inside the short recovery", () => {
    const predictor = new SelfPredictor(view());
    const events: SelfCorrectionEvent[] = [];
    predictor.setCorrectionObserver((event) => events.push({ ...event }));

    predictor.forceResync();
    predictor.reconcile(view({ x: 680 }));
    predictor.decayError(FRAME_SECONDS);
    predictor.forceResync();
    predictor.reconcile(view({ x: 650 }));

    expectEvent(events[0], "stall-resync", MovementCorrectionBand.Smooth, 320);
    expectEvent(events[1], "stall-resync", MovementCorrectionBand.Snap, 283.333333);
    expect(predictor.renderPos(0, 0, 0)).toMatchObject({ x: 650, y: 1000 });
    expect(predictor.isFastStallRecovery).toBe(false);
    expect(predictor.isSmoothingCorrection).toBe(false);
  });

  it("reports a B42 rejection with its ordinary envelope-violation band", () => {
    const predictor = new SelfPredictor(view());
    const events: SelfCorrectionEvent[] = [];
    predictor.setCorrectionObserver((event) => events.push({ ...event }));

    predictor.reconcile(view({ x: 950, movementCorrectionSeq: 1 }));

    expectEvent(events[0], "envelope-violation", MovementCorrectionBand.Smooth, 50);
    expect(predictor.isSmoothingCorrection).toBe(true);
    expect(predictor.isFastStallRecovery).toBe(false);
  });
});
