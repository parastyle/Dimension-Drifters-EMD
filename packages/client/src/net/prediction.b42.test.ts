import { MOVEMENT_CORRECTION_SMOOTH_MAX_MS } from "@dd/shared";
import { describe, expect, it } from "vitest";
import { SelfPredictor, type ServerView } from "./prediction.js";

function view(extra: Partial<ServerView> = {}): ServerView {
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
    movementCorrectionSeq: 0,
    serverMotionEpoch: 0,
    serverMotionActive: false,
    alive: true,
    ...extra,
  };
}

describe("SelfPredictor B42 relaxed authority", () => {
  it("treats an accepted adopted pose as an acknowledgement with zero self-corrections", () => {
    const predictor = new SelfPredictor(view());
    const cmd = predictor.mintCmd(1, 0, false);
    predictor.tick(cmd);
    const report = predictor.clientMovementReport();
    predictor.reconcile(
      view({
        x: report.x,
        y: report.y,
        mvx: report.mvx,
        mvy: report.mvy,
        vx: report.vx,
        vy: report.vy,
        ackSeq: cmd.seq,
      }),
    );

    expect(predictor.stats).toMatchObject({ selfCorrections: 0, errPx: 0, pending: 0 });
  });

  it("silent-snaps under 3px, caps medium correction at 140ms, and snaps large error", () => {
    const silent = new SelfPredictor(view());
    silent.reconcile(view({ x: 1_002, movementCorrectionSeq: 1 }));
    expect(silent.renderPos(0, 0, 0).x).toBe(1_002);

    const medium = new SelfPredictor(view());
    medium.reconcile(view({ x: 1_040, movementCorrectionSeq: 1 }));
    expect(medium.renderPos(0, 0, 0).x).toBe(1_000);
    medium.decayError((MOVEMENT_CORRECTION_SMOOTH_MAX_MS - 1) / 1000);
    expect(medium.stats.errPx).toBeGreaterThan(0);
    medium.decayError(0.001);
    expect(medium.stats).toMatchObject({
      selfCorrections: 1,
      errPx: 0,
      correctionRemainingMs: 0,
    });
    expect(medium.renderPos(0, 0, 0).x).toBe(1_040);

    const large = new SelfPredictor(view());
    large.reconcile(view({ x: 1_220, movementCorrectionSeq: 1 }));
    expect(large.stats.errPx).toBe(0);
    expect(large.renderPos(0, 0, 0).x).toBe(1_220);
  });

  it("does not restart an in-flight medium deadline and counts one server-motion epoch once", () => {
    const predictor = new SelfPredictor(view());
    predictor.reconcile(view({ x: 1_060, serverMotionEpoch: 1, serverMotionActive: true }));
    predictor.decayError(0.1);
    const remaining = predictor.stats.correctionRemainingMs;
    predictor.reconcile(view({ x: 1_080, serverMotionEpoch: 1, serverMotionActive: true }));
    expect(predictor.stats.correctionRemainingMs).toBeCloseTo(remaining, 6);
    expect(predictor.stats.selfCorrections).toBe(1);
    predictor.decayError(0.04);
    expect(predictor.stats.errPx).toBe(0);
  });
});
