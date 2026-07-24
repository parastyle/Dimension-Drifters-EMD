import {
  MOVE_SPEED,
  PRED_ERR_DECAY,
  PlayerAttackMoveMode,
  stepPlayerAttackMovement,
  TICK_MS,
} from "@dd/shared";
import { describe, expect, it } from "vitest";
import { SelfPredictor, type ServerView } from "./prediction.js";

const DT = TICK_MS / 1000;
const STOP_WITHIN_TICKS = 3;

function legacyZeroInputGlideTicks(initialErrorPx: number): number {
  let error = initialErrorPx;
  let ticks = 0;
  while (Math.abs(error) >= 0.5 && ticks < 100) {
    let correction = error * (Math.exp(-PRED_ERR_DECAY * DT) - 1);
    const movementBudget = MOVE_SPEED * DT;
    if (Math.abs(correction) > movementBudget)
      correction = Math.sign(correction) * movementBudget;
    error += correction;
    ticks++;
  }
  return ticks;
}

interface MovementRow {
  x: number;
  y: number;
  mvx: number;
  mvy: number;
  ackSeq: number;
  mode: number;
}

function view(row: MovementRow): ServerView {
  return {
    x: row.x,
    y: row.y,
    mvx: row.mvx,
    mvy: row.mvy,
    vx: 0,
    vy: 0,
    height: 0,
    vh: 0,
    ackSeq: row.ackSeq,
    teleportSeq: 0,
    attackMoveMode: row.mode,
    alive: true,
  };
}

function stepAuthority(row: MovementRow, dx: number, dy: number): void {
  const next = stepPlayerAttackMovement(
    row,
    { vx: row.mvx, vy: row.mvy },
    { dx, dy },
    DT,
    MOVE_SPEED,
    row.mode,
  );
  row.x = next.x;
  row.y = next.y;
  row.mvx = next.vx;
  row.mvy = next.vy;
  row.ackSeq++;
}

describe("B41 attack-move parity and crisp release", () => {
  it("keeps slowed authority and client prediction bit-identical, then stops within three ticks", () => {
    const authority: MovementRow = {
      x: 1_000,
      y: 1_000,
      mvx: 0,
      mvy: 0,
      ackSeq: 0,
      mode: PlayerAttackMoveMode.InputSlow,
    };
    const predictor = new SelfPredictor(view(authority));

    for (let tick = 0; tick < 8; tick++) {
      const cmd = predictor.mintCmd(1, 0, false);
      predictor.tick(cmd);
      stepAuthority(authority, 1, 0);
      const predicted = predictor.renderPos(1, 0, 0);
      expect(predicted.x).toBeCloseTo(authority.x, 9);
      expect(predicted.y).toBeCloseTo(authority.y, 9);
      expect(predictor.stats.errPx).toBe(0);
      predictor.reconcile(view(authority));
    }

    let stoppedAt = 0;
    for (let tick = 1; tick <= STOP_WITHIN_TICKS; tick++) {
      const cmd = predictor.mintCmd(0, 0, false);
      predictor.tick(cmd);
      stepAuthority(authority, 0, 0);
      const predicted = predictor.renderPos(0, 0, 0);
      expect(predicted.x).toBeCloseTo(authority.x, 9);
      expect(predicted.y).toBeCloseTo(authority.y, 9);
      expect(predictor.stats.errPx).toBe(0);
      predictor.reconcile(view(authority));
      if (Math.hypot(authority.mvx, authority.mvy) === 0) {
        stoppedAt = tick;
        break;
      }
    }

    expect(stoppedAt).toBeGreaterThan(0);
    expect(stoppedAt).toBeLessThanOrEqual(STOP_WITHIN_TICKS);
    expect(Math.hypot(authority.mvx, authority.mvy)).toBe(0);
    expect(predictor.renderPos(0, 0, 0)).toMatchObject({ x: authority.x, y: authority.y });
  });

  it("presents authoritative root travel directly instead of gliding it out after release", () => {
    const authority: MovementRow = {
      x: 1_000,
      y: 1_000,
      mvx: MOVE_SPEED,
      mvy: 0,
      ackSeq: 8,
      mode: PlayerAttackMoveMode.Normal,
    };
    const predictor = new SelfPredictor(view(authority));

    // The server replaces input with an authored one-tick Stormfists lunge. Before B41, reconcile folded
    // this 360 px delta into errX, which the zero-input decay presented as a long ice-slide.
    expect(legacyZeroInputGlideTicks(-360)).toBe(28);
    authority.mode = PlayerAttackMoveMode.RootMotion;
    authority.mvx = 0;
    authority.x += 360;
    authority.ackSeq++;
    predictor.reconcile(view(authority));
    expect(predictor.renderPos(0, 0, 0).x).toBe(authority.x);
    expect(predictor.stats.errPx).toBe(0);

    authority.mode = PlayerAttackMoveMode.Normal;
    authority.ackSeq++;
    predictor.reconcile(view(authority));
    const releasedX = predictor.renderPos(0, 0, 0).x;
    for (let tick = 0; tick < STOP_WITHIN_TICKS; tick++) {
      predictor.tick(predictor.mintCmd(0, 0, false));
      stepAuthority(authority, 0, 0);
      predictor.reconcile(view(authority));
      predictor.decayError(DT, 0, 0);
      expect(predictor.renderPos(0, 0, 0).x).toBe(releasedX);
      expect(predictor.stats.errPx).toBe(0);
    }
  });

  it("retires only a bounded slow-mode release correction instead of carrying it into recovery", () => {
    const initial: MovementRow = {
      x: 1_000,
      y: 1_000,
      mvx: 240,
      mvy: 0,
      ackSeq: 4,
      mode: PlayerAttackMoveMode.InputSlow,
    };
    const predictor = new SelfPredictor(view(initial));
    predictor.tick(predictor.mintCmd(0, 0, false));

    const released = {
      ...initial,
      x: initial.x + 8,
      mvx: 0,
      ackSeq: 5,
      mode: PlayerAttackMoveMode.Normal,
    };
    predictor.reconcile(view(released));
    expect(predictor.stats.errPx).toBe(0);
    expect(predictor.renderPos(0, 0, 0).x).toBe(released.x);
  });
});
