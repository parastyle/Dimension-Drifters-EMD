import {
  addImpulse,
  INTERP_SNAP_PLAYER,
  stepImpulse,
  stepSteeredMovement,
  TICK_MS,
} from "@dd/shared";
import { describe, expect, it } from "vitest";
import { type PredCmd, SelfPredictor, type ServerView } from "./prediction.js";

/**
 * §4 v0.107 reconciliation correctness — the predictor against a MOCK SERVER running the SAME shared
 * steppers at the same fixed 50ms timestep (exactly what the fixed-timestep GameRoom does), with a
 * configurable command/patch latency. If these invariants hold, the live pair can only diverge through
 * transport bugs, not math.
 */

const DT = TICK_MS / 1000;

/** A minimal authoritative server: consumes one command per tick (held fallback), integrates with the
 *  shared steppers, and publishes tick-locked views. Mirrors GameRoom's movement phase 1:1. */
class MockServer {
  x = 1000;
  y = 1000;
  mvx = 0;
  mvy = 0;
  vx = 0;
  vy = 0;
  ackSeq = 0;
  teleportSeq = 0;
  private held: PredCmd = { seq: 0, dx: 0, dy: 0, jump: false };
  private readonly queue: PredCmd[] = [];

  send(cmd: PredCmd): void {
    this.queue.push(cmd);
  }

  tick(): void {
    if (this.queue.length > 1) this.queue.splice(0, this.queue.length - 1); // drain-to-newest
    const cmd = this.queue.shift();
    if (cmd) {
      this.held = cmd;
      this.ackSeq = cmd.seq;
    }
    const moved = stepSteeredMovement(
      { x: this.x, y: this.y },
      { vx: this.mvx, vy: this.mvy },
      this.held,
      DT,
    );
    this.mvx = moved.vx;
    this.mvy = moved.vy;
    const imp = stepImpulse(moved, { vx: this.vx, vy: this.vy }, DT);
    this.x = imp.x;
    this.y = imp.y;
    this.vx = imp.vx;
    this.vy = imp.vy;
  }

  knockback(ix: number, iy: number): void {
    const k = addImpulse({ vx: this.vx, vy: this.vy }, ix, iy);
    this.vx = k.vx;
    this.vy = k.vy;
  }

  teleport(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.mvx = 0;
    this.mvy = 0;
    this.queue.length = 0;
    this.held = { seq: this.held.seq, dx: 0, dy: 0, jump: false };
    this.teleportSeq = (this.teleportSeq + 1) >>> 0;
  }

  view(): ServerView {
    return {
      x: this.x,
      y: this.y,
      mvx: this.mvx,
      mvy: this.mvy,
      vx: this.vx,
      vy: this.vy,
      height: 0,
      vh: 0,
      ackSeq: this.ackSeq,
      teleportSeq: this.teleportSeq,
      alive: true,
      frozen: false,
    };
  }
}

/** Drive predictor + server in lockstep with `latency` ticks of one-way delay on BOTH directions
 *  (command up, patch down) — the realistic round-trip picture. Returns the predictor. */
function run(
  pred: SelfPredictor,
  server: MockServer,
  inputs: { dx: number; dy: number }[],
  latency: number,
): void {
  const upWire: { at: number; cmd: PredCmd }[] = [];
  const downWire: { at: number; view: ServerView }[] = [];
  for (let t = 0; t < inputs.length; t++) {
    const inp = inputs[t] as { dx: number; dy: number };
    const cmd = pred.mintCmd(inp.dx, inp.dy, false);
    upWire.push({ at: t + latency, cmd });
    while (upWire.length > 0 && (upWire[0] as { at: number }).at <= t) {
      server.send((upWire.shift() as { cmd: PredCmd }).cmd);
    }
    server.tick();
    downWire.push({ at: t + latency, view: server.view() });
    pred.tick(cmd);
    while (downWire.length > 0 && (downWire[0] as { at: number }).at <= t) {
      pred.reconcile((downWire.shift() as { view: ServerView }).view);
    }
    pred.decayError(DT);
  }
}

function hold(dx: number, dy: number, ticks: number): { dx: number; dy: number }[] {
  return Array.from({ length: ticks }, () => ({ dx, dy }));
}

describe("SelfPredictor — §4 v0.107 prediction + reconciliation", () => {
  it("ZERO latency: predictor tracks the server EXACTLY (same steppers, same fixed dt)", () => {
    const server = new MockServer();
    const pred = new SelfPredictor(server.view());
    run(pred, server, [...hold(1, 0, 20), ...hold(0, -1, 20), ...hold(0, 0, 12)], 0);
    const r = pred.renderPos(0, 0, 0);
    expect(r.x).toBeCloseTo(server.x, 6);
    expect(r.y).toBeCloseTo(server.y, 6);
    expect(pred.stats.errPx).toBeLessThan(0.01);
  });

  it("REAL latency (100ms RTT): the render LEADS delayed truth while moving, then CONVERGES exactly on stop", () => {
    const server = new MockServer();
    const pred = new SelfPredictor(server.view());
    // Sprint right for 1s under 2-tick one-way latency…
    run(pred, server, hold(1, 0, 20), 2);
    const mid = pred.renderPos(1, 0, 0);
    expect(mid.x).toBeGreaterThan(server.x); // the whole point: render leads delayed truth
    // …then stop and settle: both sides must agree exactly.
    run(pred, server, hold(0, 0, 30), 2);
    const done = pred.renderPos(0, 0, 0);
    expect(done.x).toBeCloseTo(server.x, 1);
    expect(done.y).toBeCloseTo(server.y, 1);
    expect(pred.stats.errPx).toBeLessThan(0.5);
  });

  it("KNOCKBACK applied server-side mid-flight GLIDES in through the error offset (no teleport pop)", () => {
    const server = new MockServer();
    const pred = new SelfPredictor(server.view());
    run(pred, server, hold(1, 0, 10), 2);
    const before = pred.renderPos(1, 0, 0);
    server.knockback(-300, 0); // a hit shoves the authoritative body
    // One tick later the patch lands; the correction must be folded, not popped.
    run(pred, server, hold(1, 0, 1), 2);
    const after = pred.renderPos(1, 0, 0);
    // Per-frame render movement stays bounded (one tick of sprint is 16px; a pop would be ~33+).
    expect(Math.abs(after.x - before.x)).toBeLessThan(26);
    // And over the next half second the knockback is fully expressed — both sides agree.
    run(pred, server, hold(0, 0, 30), 2);
    expect(pred.renderPos(0, 0, 0).x).toBeCloseTo(server.x, 1);
  });

  it("TELEPORT (teleportSeq bump) hard-SNAPS: no glide across the map, pending + offset cleared", () => {
    const server = new MockServer();
    const pred = new SelfPredictor(server.view());
    run(pred, server, hold(1, 0, 10), 2);
    server.teleport(3000, 3000); // rift descent / pit snap-back / restart
    run(pred, server, hold(0, 0, 3), 2);
    const r = pred.renderPos(0, 0, 0);
    expect(Math.hypot(r.x - 3000, r.y - 3000)).toBeLessThan(INTERP_SNAP_PLAYER); // snapped, not gliding
    expect(pred.stats.errPx).toBe(0);
    run(pred, server, hold(0, 0, 5), 2);
    expect(pred.renderPos(0, 0, 0).x).toBeCloseTo(server.x, 1);
  });

  it("FREEZE (level window) pauses prediction and resumes cleanly from server truth", () => {
    const server = new MockServer();
    const pred = new SelfPredictor(server.view());
    run(pred, server, hold(1, 0, 10), 0);
    pred.reconcile({ ...server.view(), frozen: true });
    expect(pred.isPaused).toBe(true);
    const frozenAt = pred.renderPos(1, 0, 0);
    pred.tick(pred.mintCmd(1, 0, false)); // ticks while frozen are no-ops
    expect(pred.renderPos(1, 0, 0).x).toBeCloseTo(frozenAt.x, 6);
    pred.reconcile({ ...server.view(), frozen: false }); // window closed
    expect(pred.isPaused).toBe(false);
    run(pred, server, hold(1, 0, 5), 0);
    expect(pred.renderPos(1, 0, 0).x).toBeCloseTo(server.x, 4);
  });

  it("FREEZE ENTRY while moving under latency GLIDES (folds the lead into the offset — no backward pop)", () => {
    const server = new MockServer();
    const pred = new SelfPredictor(server.view());
    // Sprint under 3-tick latency: the render leads the delayed server truth by ~3 ticks of motion.
    run(pred, server, hold(1, 0, 15), 3);
    const before = pred.renderPos(1, 0, 0);
    expect(before.x).toBeGreaterThan(server.x + 20); // a real lead exists at the freeze edge
    // The level-up window opens: the patch arrives frozen, with the server's (behind) position.
    pred.reconcile({ ...server.view(), frozen: true });
    const atFreeze = pred.renderPos(0, 0, 0);
    // Amendment #14: the rig must NOT snap backward to server truth — the lead folds into the offset.
    expect(Math.abs(atFreeze.x - before.x)).toBeLessThan(2);
    // …and mid-window reconciles must not re-zero the fold.
    pred.reconcile({ ...server.view(), frozen: true });
    expect(Math.abs(pred.renderPos(0, 0, 0).x - before.x)).toBeLessThan(2);
    // The offset then DECAYS to server truth under the window (glide, ~⅓s).
    for (let i = 0; i < 40; i++) pred.decayError(0.016);
    expect(pred.renderPos(0, 0, 0).x).toBeCloseTo(server.x, 0);
  });

  it("a connection STALL freezes prediction (no dead-reckoning into the dark) and recovers on the next patch", () => {
    const server = new MockServer();
    const pred = new SelfPredictor(server.view());
    // No patches arrive at all: tick until the pending buffer overflows (~3.2s of silence).
    for (let i = 0; i < 70; i++) pred.tick(pred.mintCmd(1, 0, false));
    expect(pred.isStalled).toBe(true);
    const frozenAt = pred.renderPos(1, 0, 0);
    pred.tick(pred.mintCmd(1, 0, false)); // further ticks are no-ops — hold still, don't guess
    expect(pred.renderPos(1, 0, 0).x).toBe(frozenAt.x);
    // Truth finally arrives → hard resync, stall cleared, prediction resumes.
    server.tick();
    pred.reconcile(server.view());
    expect(pred.isStalled).toBe(false);
    expect(pred.renderPos(0, 0, 0).x).toBeCloseTo(server.x, 6);
  });

  it("the fractional-frame PREVIEW is pure (idempotent) and composes: preview(50ms) ≡ the next real tick", () => {
    const server = new MockServer();
    const pred = new SelfPredictor(server.view());
    run(pred, server, hold(1, 0, 8), 0);
    const a = pred.renderPos(1, 0, 0.03);
    const b = pred.renderPos(1, 0, 0.03);
    expect(a.x).toBe(b.x); // pure — no hidden accumulation frame to frame
    const full = pred.renderPos(1, 0, DT);
    pred.tick(pred.mintCmd(1, 0, false));
    const next = pred.renderPos(1, 0, 0);
    expect(full.x).toBeCloseTo(next.x, 9); // a full-tick preview lands exactly on the real next tick
    expect(full.y).toBeCloseTo(next.y, 9);
  });

  it("predicts the JUMP arc instantly and locally (rises on the press tick, lands back at 0)", () => {
    const server = new MockServer();
    const pred = new SelfPredictor(server.view());
    pred.tick(pred.mintCmd(0, 0, true)); // SPACE
    expect(pred.renderPos(0, 0, 0).height).toBeGreaterThan(0); // airborne immediately, no round-trip
    for (let i = 0; i < 12; i++) pred.tick(pred.mintCmd(0, 0, false));
    expect(pred.renderPos(0, 0, 0).height).toBe(0); // full arc landed (~0.45s)
  });
});
