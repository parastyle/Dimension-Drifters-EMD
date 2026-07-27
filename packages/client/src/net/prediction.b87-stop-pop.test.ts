import { readFileSync } from "node:fs";
import { INTERP_SNAP_PLAYER, MOVE_SPEED, TICK_MS } from "@dd/shared";
import { describe, expect, it } from "vitest";
import { isPresentedInputStop, limitPresentedRootStep } from "../entities/rig/rig-presentation.js";
import { type PredCmd, SelfPredictor, type ServerView } from "./prediction.js";

const EPSILON_PX = 1e-8;
const FRAME_MS = 16;
const arenaSource = readFileSync(new URL("../scenes/ArenaScene.ts", import.meta.url), "utf8");

function view(): ServerView {
  return {
    x: 1_000,
    y: 1_000,
    mvx: 0,
    mvy: 0,
    vx: 0,
    vy: 0,
    height: 0,
    vh: 0,
    ackSeq: 0,
    teleportSeq: 0,
    alive: true,
  };
}

function command(predictor: SelfPredictor, dx: number, dy: number): PredCmd {
  return predictor.mintCmd(dx, dy, false);
}

interface TraceState {
  inputAccMs: number;
  presentedX: number;
  presentedY: number;
  moveIntentActive: boolean;
  worstBoundaryPopPx: number;
  worstIntraTickDisagreementPx: number;
}

function traceState(): TraceState {
  return {
    inputAccMs: 0,
    presentedX: 1_000,
    presentedY: 1_000,
    moveIntentActive: false,
    worstBoundaryPopPx: 0,
    worstIntraTickDisagreementPx: 0,
  };
}

/**
 * Mirror ArenaScene's sampled-input loop and final SELF root presentation. Input time and presentation
 * time are deliberately the same here to isolate the confirmed velocity-source defect; the source
 * contract below separately pins production's real-wall constant-speed limiter.
 */
function advanceFrame(
  predictor: SelfPredictor,
  trace: TraceState,
  dx: number,
  dy: number,
  elapsedMs: number,
): { releaseStepPx: number; axisStepX: number; axisStepY: number } {
  let remainingMs = elapsedMs;
  while (remainingMs > 1e-9) {
    const sliceMs = Math.min(remainingMs, TICK_MS - trace.inputAccMs);
    predictor.sampleInputFrame(dx, dy, sliceMs / 1_000);
    trace.inputAccMs += sliceMs;
    remainingMs -= sliceMs;
    if (trace.inputAccMs < TICK_MS - 1e-9) continue;

    const beforeCommit = predictor.renderPos(dx, dy, TICK_MS / 1_000);
    predictor.tick(command(predictor, dx, dy));
    trace.inputAccMs = 0;
    const afterCommit = predictor.renderPos(dx, dy, 0);
    trace.worstBoundaryPopPx = Math.max(
      trace.worstBoundaryPopPx,
      Math.hypot(afterCommit.x - beforeCommit.x, afterCommit.y - beforeCommit.y),
    );
  }

  const target = predictor.renderPos(dx, dy, trace.inputAccMs / 1_000);
  const locomotionSpeed = Math.hypot(target.mvx, target.mvy);
  const recoilSpeed = Math.hypot(target.vx, target.vy);
  const inputStopped = isPresentedInputStop(
    trace.moveIntentActive,
    dx,
    dy,
    target.stance !== 0 || recoilSpeed > 1e-4,
  );
  const previousX = trace.presentedX;
  const previousY = trace.presentedY;
  const presented = limitPresentedRootStep(
    previousX,
    previousY,
    target.x,
    target.y,
    elapsedMs,
    Math.max(48, locomotionSpeed + recoilSpeed),
    INTERP_SNAP_PLAYER,
    inputStopped,
  );
  trace.presentedX = presented.x;
  trace.presentedY = presented.y;
  trace.moveIntentActive = Math.hypot(dx, dy) > 1e-4;
  trace.worstIntraTickDisagreementPx = Math.max(
    trace.worstIntraTickDisagreementPx,
    Math.hypot(presented.x - target.x, presented.y - target.y),
  );
  return {
    releaseStepPx: inputStopped ? Math.hypot(presented.x - previousX, presented.y - previousY) : 0,
    axisStepX: presented.x - previousX,
    axisStepY: presented.y - previousY,
  };
}

function advanceDuration(
  predictor: SelfPredictor,
  trace: TraceState,
  dx: number,
  dy: number,
  durationMs: number,
): void {
  let remainingMs = durationMs;
  while (remainingMs > 1e-9) {
    const frameMs = Math.min(FRAME_MS, remainingMs);
    advanceFrame(predictor, trace, dx, dy, frameMs);
    remainingMs -= frameMs;
  }
}

describe("B87 stop-transition rendered-path regression", () => {
  for (const holdMs of [40, 65, 130]) {
    it(`stops without a dip or pop after a non-tick-multiple ${holdMs}ms hold`, () => {
      const predictor = new SelfPredictor(view());
      const trace = traceState();
      advanceDuration(predictor, trace, 0, -1, holdMs);
      const beforeReleaseY = trace.presentedY;
      const release = advanceFrame(predictor, trace, 0, 0, 0);
      const releaseDipPx = Math.max(0, trace.presentedY - beforeReleaseY);
      const releasePopPx = release.releaseStepPx;

      const untilBoundaryMs = TICK_MS - trace.inputAccMs;
      advanceFrame(predictor, trace, 0, 0, untilBoundaryMs);
      const boundaryPopPx = trace.worstBoundaryPopPx;

      console.info(
        `B87 ${holdMs}ms stop: release dip=${releaseDipPx.toFixed(6)}px, ` +
          `release pop=${releasePopPx.toFixed(6)}px, boundary pop=${boundaryPopPx.toFixed(6)}px, ` +
          `intra-tick disagreement=${trace.worstIntraTickDisagreementPx.toFixed(6)}px`,
      );
      expect(releaseDipPx).toBeLessThanOrEqual(EPSILON_PX);
      expect(releasePopPx).toBeLessThanOrEqual(EPSILON_PX);
      expect(boundaryPopPx).toBeLessThanOrEqual(EPSILON_PX);
    });
  }

  for (const changeAtMs of [40, 65, 130]) {
    it(`replays a forward-to-strafe change after ${changeAtMs}ms without losing either axis`, () => {
      const predictor = new SelfPredictor(view());
      const trace = traceState();
      advanceDuration(predictor, trace, 0, -1, changeAtMs);
      const beforeChangeX = trace.presentedX;
      const beforeChangeY = trace.presentedY;

      const changed = advanceFrame(predictor, trace, 1, 0, 8);
      expect(changed.axisStepX).toBeGreaterThanOrEqual(-EPSILON_PX);
      expect(changed.axisStepY).toBeLessThanOrEqual(EPSILON_PX);
      expect(trace.presentedX).toBeGreaterThan(beforeChangeX);
      expect(trace.presentedY).toBeLessThanOrEqual(beforeChangeY + EPSILON_PX);

      advanceFrame(predictor, trace, 1, 0, TICK_MS - trace.inputAccMs);
      expect(trace.worstBoundaryPopPx).toBeLessThanOrEqual(EPSILON_PX);
      expect(trace.worstIntraTickDisagreementPx).toBeLessThanOrEqual(EPSILON_PX);
    });
  }

  it("attributes the measured stop pop to final-root debt, not sampled preview direction", () => {
    const predictor = new SelfPredictor(view());
    const trace = traceState();
    advanceDuration(predictor, trace, 0, -1, 48);

    const sampledBeforeRelease = predictor.renderPos(0, -1, trace.inputAccMs / 1_000);
    const sampledOnRelease = predictor.renderPos(0, 0, trace.inputAccMs / 1_000);
    const predictorReleaseDipPx = Math.max(0, sampledOnRelease.y - sampledBeforeRelease.y);
    const release = advanceFrame(predictor, trace, 0, 0, 2);

    console.info(
      `B87 root-cause split: predictor release dip=${predictorReleaseDipPx.toFixed(6)}px, ` +
        `rendered release pop=${release.releaseStepPx.toFixed(6)}px`,
    );
    expect(predictorReleaseDipPx).toBeLessThanOrEqual(EPSILON_PX);
    expect(release.releaseStepPx).toBeLessThanOrEqual(EPSILON_PX);
  });

  it("responds at canonical speed in the first sampled frame with no added input latency", () => {
    const predictor = new SelfPredictor(view());
    const trace = traceState();
    const first = advanceFrame(predictor, trace, 1, 0, FRAME_MS);
    expect(first.axisStepX).toBeCloseTo((MOVE_SPEED * FRAME_MS) / 1_000, 10);
    expect(first.axisStepY).toBeCloseTo(0, 10);
  });

  it("wires presentation velocity into the real-time constant-speed root limiter", () => {
    expect(arenaSource).toContain(
      "const locomotionSpeed = Math.hypot(predicted.mvx, predicted.mvy)",
    );
    expect(arenaSource).toContain("const recoilSpeed = Math.hypot(predicted.vx, predicted.vy)");
    expect(arenaSource).toMatch(
      /limitPresentedRootStep\([\s\S]*?frame\.wallDeltaMs,[\s\S]*?Math\.max\(48, locomotionSpeed \+ recoilSpeed\)/,
    );
  });
});
