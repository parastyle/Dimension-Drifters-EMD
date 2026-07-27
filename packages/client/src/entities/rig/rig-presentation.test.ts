import { MOVE_SPEED, PlayerState } from "@dd/shared";
import { describe, expect, it } from "vitest";
import { SelfPredictor, type ServerView } from "../../net/prediction.js";
import {
  createPresentedActorState,
  isPresentedInputStop,
  limitPresentedRootStep,
  PRESENTED_INPUT_STOP_MAX_MS,
  PresentationFrameClock,
  PresentedActorBuffer,
} from "./rig-presentation.js";

describe("presentation frame clock", () => {
  it("is a single monotonic freeze-aware timebase", () => {
    const clock = new PresentationFrameClock();
    const first = { ...clock.advance(100, 16, true) };
    const frozen = { ...clock.advance(116, 16, false) };
    const resumed = { ...clock.advance(132, 16, true) };
    expect(first.nowMs).toBe(16);
    expect(frozen.nowMs).toBe(first.nowMs);
    expect(frozen.deltaMs).toBe(0);
    expect(resumed.nowMs).toBe(32);
    expect(resumed.frame).toBe(3);
  });

  it("marks a render stall as a timing cut without forking the monotonic clock", () => {
    const clock = new PresentationFrameClock();
    clock.advance(0, 16, true);
    const stalled = clock.advance(500, 500, true);
    expect(stalled.nowMs).toBe(516);
    expect(stalled.deltaMs).toBe(500);
    expect(stalled.cut).toBe(true);
  });

  it("keeps correction debt in root space and bounds its rendered derivative", () => {
    const root = limitPresentedRootStep(0, 0, 140, 0, 200, 384, 400);
    expect(root.x).toBeCloseTo(76.8);
    expect(root.y).toBe(0);
  });

  it("adds no per-frame speed headroom to ordinary locomotion", () => {
    const root = limitPresentedRootStep(0, 0, 140, 0, 50, 320, 400);
    expect(root.x).toBeCloseTo(16);
    expect(root.y).toBe(0);
  });

  it("cuts a legitimate input stop within one render frame instead of easing prediction lead", () => {
    const authority: ServerView = {
      x: 3_000,
      y: 3_000,
      mvx: MOVE_SPEED,
      mvy: 0,
      vx: 0,
      vy: 0,
      height: 0,
      vh: 0,
      ackSeq: 0,
      teleportSeq: 0,
      alive: true,
    };
    const predictor = new SelfPredictor(authority);

    // At 25ms into a 50ms tick the rendered root legitimately previews 8px ahead of committed truth.
    const beforeRelease = predictor.renderPos(1, 0, 0.025);
    expect(beforeRelease.x - authority.x).toBeCloseTo(8, 10);
    expect(predictor.clientMovementReport().mvx).toBe(MOVE_SPEED);

    predictor.tick(predictor.mintCmd(0, 0, false));
    const stoppedSimulation = predictor.clientMovementReport();
    const stoppedTarget = predictor.renderPos(0, 0, 0);
    expect(stoppedSimulation.x).toBe(authority.x);
    expect(stoppedSimulation.mvx).toBe(0);
    expect(stoppedTarget.x).toBe(authority.x);

    // The old idle lane paid that 8px discrepancy out at 48px/s: ten 60Hz frames = 166.67ms.
    const frameMs = 1_000 / 60;
    let easedX = beforeRelease.x;
    let oldFrames = 0;
    let oldDistancePx = 0;
    while (Math.abs(easedX - stoppedTarget.x) > 1e-6) {
      const next = limitPresentedRootStep(
        easedX,
        beforeRelease.y,
        stoppedTarget.x,
        stoppedTarget.y,
        frameMs,
        48,
        400,
      );
      oldDistancePx += Math.abs(next.x - easedX);
      easedX = next.x;
      oldFrames++;
      expect(oldFrames).toBeLessThan(20);
    }
    expect(oldDistancePx).toBeCloseTo(8, 10);
    expect(oldFrames * frameMs).toBeCloseTo(166.6666667, 5);

    const inputStopped = isPresentedInputStop(true, 0, 0, false);
    const stoppedRoot = limitPresentedRootStep(
      beforeRelease.x,
      beforeRelease.y,
      stoppedTarget.x,
      stoppedTarget.y,
      frameMs,
      48,
      400,
      inputStopped,
    );
    const followingRoot = limitPresentedRootStep(
      stoppedRoot.x,
      stoppedRoot.y,
      stoppedTarget.x,
      stoppedTarget.y,
      frameMs,
      48,
      400,
    );
    expect(stoppedRoot).toEqual({ x: stoppedTarget.x, y: stoppedTarget.y });
    expect(followingRoot).toEqual(stoppedRoot);
    expect(frameMs).toBeLessThanOrEqual(PRESENTED_INPUT_STOP_MAX_MS);
  });

  it("never classifies held travel, reversals, or exceptional root motion as an input stop", () => {
    expect(isPresentedInputStop(true, 1, 0, false)).toBe(false);
    expect(isPresentedInputStop(true, -1, 0, false)).toBe(false);
    expect(isPresentedInputStop(true, 0, 0, true)).toBe(false);
    expect(isPresentedInputStop(false, 0, 0, false)).toBe(false);
  });

  it("samples remote root and discrete pose edges from one coherent timeline row", () => {
    const player = new PlayerState();
    player.id = "remote";
    player.weapon = "first-rifle";
    player.x = 0;
    player.attackSeq = 4;
    player.attackHeld = false;

    const buffer = new PresentedActorBuffer();
    buffer.push(0, player);
    player.x = 10;
    player.attackSeq = 5;
    player.attackHeld = true;
    buffer.push(100, player);

    const frame = new PresentationFrameClock().advance(50, 16, true);
    const actor = createPresentedActorState(frame);
    expect(buffer.sampleInto(50, frame, actor)).toBe(actor);
    expect(actor.rootX).toBeGreaterThan(0);
    expect(actor.rootX).toBeLessThan(10);
    expect(actor.tick).toBe(1);
    expect(actor.attackSeq).toBe(4);
    expect(actor.attackHeld).toBe(false);

    buffer.sampleInto(100, frame, actor);
    expect(actor.rootX).toBe(10);
    expect(actor.attackSeq).toBe(5);
    expect(actor.attackHeld).toBe(true);
  });
});
