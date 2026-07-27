import { INTERP_SNAP_PLAYER, MOVE_SPEED, TICK_MS } from "@dd/shared";
import { describe, expect, it } from "vitest";
import { limitPresentedRootStep } from "../entities/rig/rig-presentation.js";
import { type PredCmd, SelfPredictor, type ServerView } from "./prediction.js";

const FRAME_MS = 16;
const MAX_FRAME_STEP_PX = (MOVE_SPEED * FRAME_MS) / 1_000;

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

function command(predictor: SelfPredictor, dx: number): PredCmd {
  return predictor.mintCmd(dx, 0, false);
}

describe("B83 faster-than-tick direction alias measurement", () => {
  it("records the confirmed legacy boundary divergence under 16ms AD flips", () => {
    const predictor = new SelfPredictor(view());
    let inputAccMs = 0;
    let previousRender = predictor.renderPos(0, 0, 0);
    let worstBoundaryDivergencePx = 0;

    for (let frame = 0; frame < 40; frame++) {
      const dx = frame % 2 === 0 ? 1 : -1;
      inputAccMs += FRAME_MS;
      while (inputAccMs >= TICK_MS) {
        inputAccMs -= TICK_MS;
        predictor.tick(command(predictor, dx));
        const committed = predictor.renderPos(dx, 0, 0);
        worstBoundaryDivergencePx = Math.max(
          worstBoundaryDivergencePx,
          Math.hypot(committed.x - previousRender.x, committed.y - previousRender.y),
        );
      }
      previousRender = predictor.renderPos(dx, 0, inputAccMs / 1_000);
    }

    console.info(
      `B83 measured legacy: worst render/commit boundary divergence=${worstBoundaryDivergencePx.toFixed(
        3,
      )}px; first-frame response budget=${((FRAME_MS / 1_000) * MOVE_SPEED).toFixed(3)}px`,
    );
    expect(worstBoundaryDivergencePx).toBeCloseTo(31.36, 6);
    expect(previousRender.x).toBeTypeOf("number");
  });

  it("commits the sampled path with no faster-than-tick rendered discontinuity", () => {
    const predictor = new SelfPredictor(view());
    let inputAccMs = 0;
    let previousRender = predictor.renderPos(0, 0, 0);
    let worstBoundaryStepPx = 0;
    let worstRenderCommitAliasPx = 0;
    let worstRenderedFrameStepPx = 0;
    let firstFrameResponsePx = 0;

    for (let frame = 0; frame < 40; frame++) {
      const dx = frame % 2 === 0 ? 1 : -1;
      let remainingFrameMs = FRAME_MS;
      while (remainingFrameMs > 1e-9) {
        const sliceMs = Math.min(remainingFrameMs, TICK_MS - inputAccMs);
        predictor.sampleInputFrame(dx, 0, sliceMs / 1_000);
        inputAccMs += sliceMs;
        remainingFrameMs -= sliceMs;
        if (inputAccMs < TICK_MS - 1e-9) continue;

        const extrapolatedAtBoundary = predictor.renderPos(dx, 0, inputAccMs / 1_000);
        predictor.tick(command(predictor, dx));
        inputAccMs = 0;
        const committed = predictor.renderPos(dx, 0, 0);
        worstRenderCommitAliasPx = Math.max(
          worstRenderCommitAliasPx,
          Math.hypot(
            committed.x - extrapolatedAtBoundary.x,
            committed.y - extrapolatedAtBoundary.y,
          ),
        );
        worstBoundaryStepPx = Math.max(
          worstBoundaryStepPx,
          Math.hypot(committed.x - previousRender.x, committed.y - previousRender.y),
        );
      }

      const rendered = predictor.renderPos(dx, 0, inputAccMs / 1_000);
      const renderedFrameStepPx = Math.hypot(
        rendered.x - previousRender.x,
        rendered.y - previousRender.y,
      );
      if (frame === 0) firstFrameResponsePx = renderedFrameStepPx;
      worstRenderedFrameStepPx = Math.max(worstRenderedFrameStepPx, renderedFrameStepPx);
      previousRender = rendered;
    }

    console.info(
      [
        `B83 fixed: worst boundary step=${worstBoundaryStepPx.toFixed(3)}px`,
        `render/commit alias=${worstRenderCommitAliasPx.toFixed(6)}px`,
        `worst 16ms rendered step=${worstRenderedFrameStepPx.toFixed(3)}px`,
        "input response=same sampled frame (0ms added)",
      ].join("; "),
    );
    expect(worstRenderCommitAliasPx).toBeLessThan(1e-8);
    expect(worstBoundaryStepPx).toBeLessThanOrEqual(MAX_FRAME_STEP_PX + 1e-8);
    expect(worstRenderedFrameStepPx).toBeLessThanOrEqual(MAX_FRAME_STEP_PX + 1e-8);
    expect(firstFrameResponsePx).toBeCloseTo(MAX_FRAME_STEP_PX, 10);
  });

  it("keeps a lagging presented root at constant speed across a sampled reversal", () => {
    const predictor = new SelfPredictor(view());
    predictor.sampleInputFrame(1, 0, 0.048);
    const priorTarget = predictor.renderPos(1, 0, 0.048);
    const presentedBeforeFlip = limitPresentedRootStep(
      1_000,
      1_000,
      priorTarget.x,
      priorTarget.y,
      FRAME_MS,
      MOVE_SPEED,
      INTERP_SNAP_PLAYER,
    );

    predictor.sampleInputFrame(-1, 0, 0.002);
    const candidate = predictor.renderPos(-1, 0, 0.05);
    const constrained = predictor.constrainRenderStep(
      presentedBeforeFlip.x,
      presentedBeforeFlip.y,
      candidate.x,
      candidate.y,
      -1,
      0,
      true,
      false,
    );
    const presentedAfterFlip = limitPresentedRootStep(
      presentedBeforeFlip.x,
      presentedBeforeFlip.y,
      constrained.x,
      constrained.y,
      FRAME_MS,
      MOVE_SPEED,
      INTERP_SNAP_PLAYER,
    );

    expect(presentedAfterFlip.x).toBeLessThan(presentedBeforeFlip.x);
    expect(
      Math.hypot(
        presentedAfterFlip.x - presentedBeforeFlip.x,
        presentedAfterFlip.y - presentedBeforeFlip.y,
      ),
    ).toBeCloseTo(MAX_FRAME_STEP_PX, 10);
    expect(predictor.stats.errPx).toBe(0);
    expect(predictor.isSmoothingCorrection).toBe(false);
  });
});
