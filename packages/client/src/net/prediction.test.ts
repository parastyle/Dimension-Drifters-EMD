import {
  addImpulse,
  INTERP_SNAP_PLAYER,
  JUMP_VELOCITY,
  stepImpulse,
  stepSteeredMovement,
  stepVertical,
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

  it("keeps an un-acked jump when a pre-jump authoritative patch arrives", () => {
    const server = new MockServer();
    const pred = new SelfPredictor(server.view());
    const preJumpPatch = server.view();
    const jump = pred.mintCmd(0, 0, true);

    pred.tick(jump);
    const predictedHop = pred.renderPos(0, 0, 0).height;
    expect(predictedHop).toBeGreaterThan(12); // first step is ~15px: above the adoption threshold

    pred.reconcile({ ...preJumpPatch, ackSeq: (jump.seq - 1) >>> 0, height: 0, vh: 0 });

    expect(pred.stats.pending).toBe(1);
    expect(pred.renderPos(0, 0, 0).height).toBeCloseTo(predictedHop, 9);
  });

  it("converges without a vertical snap when the post-jump ack follows the pre-jump patch", () => {
    const server = new MockServer();
    const pred = new SelfPredictor(server.view());
    const preJumpPatch = server.view();
    const jump = pred.mintCmd(0, 0, true);

    pred.tick(jump);
    pred.reconcile({ ...preJumpPatch, ackSeq: (jump.seq - 1) >>> 0, height: 0, vh: 0 });
    const beforeAck = pred.renderPos(0, 0, 0).height;
    const authoritativeHop = stepVertical(0, JUMP_VELOCITY, DT);

    pred.reconcile({
      ...server.view(),
      ackSeq: jump.seq,
      height: authoritativeHop.height,
      vh: authoritativeHop.vh,
    });

    expect(pred.stats.pending).toBe(0);
    expect(pred.renderPos(0, 0, 0).height).toBeCloseTo(beforeAck, 9);
    expect(pred.renderPos(0, 0, 0).height).toBeCloseTo(authoritativeHop.height, 9);
  });

  it("still hard-snaps a genuine server height correction after replaying later pending commands", () => {
    const server = new MockServer();
    const pred = new SelfPredictor(server.view());
    const jump = pred.mintCmd(0, 0, true);
    pred.tick(jump);
    pred.tick(pred.mintCmd(0, 0, false)); // remains pending after the server acks/rejects the jump
    expect(pred.renderPos(0, 0, 0).height).toBeGreaterThan(12);

    pred.reconcile({ ...server.view(), ackSeq: jump.seq, height: 0, vh: 0 });

    expect(pred.stats.pending).toBe(1); // proves the correction was evaluated after a pending replay
    expect(pred.renderPos(0, 0, 0).height).toBe(0);
  });
});

describe("SelfPredictor — jump-feel stance replay", () => {
  it("replays crouch through its ten command ticks and launches the predicted distance jump", () => {
    const server = new MockServer();
    const pred = new SelfPredictor({ ...server.view(), moveStance: 0, stanceSeq: 0 });
    const preCrouch = server.view();

    const first = pred.mintCmd(1, 0, false, true, false, 1, 0);
    pred.tick(first);
    expect(pred.moveStance).toBe(1);
    pred.reconcile({ ...preCrouch, ackSeq: 0, moveStance: 0, stanceSeq: 0 });
    expect(pred.moveStance).toBe(1);

    for (let i = 1; i < 10; i++) pred.tick(pred.mintCmd(1, 0, false, true, false, 1, 0));
    expect(pred.moveStance).toBe(2);
    expect(pred.renderPos(1, 0, 0).height).toBeGreaterThan(0);
  });

  it("replays pound gather and constant-speed descent from the one-shot command bit", () => {
    const server = new MockServer();
    const pred = new SelfPredictor({ ...server.view(), moveStance: 0, stanceSeq: 0 });
    pred.tick(pred.mintCmd(0, 0, true));
    pred.tick(pred.mintCmd(0, 0, false));
    expect(pred.renderPos(0, 0, 0).height).toBeGreaterThan(24);
    const beforePound = { ...server.view(), height: pred.renderPos(0, 0, 0).height, vh: 0 };
    const pound = pred.mintCmd(0, 0, false, false, true);
    pred.tick(pound);
    expect(pred.moveStance).toBe(3);
    const gatheredHeight = pred.renderPos(0, 0, 0).height;
    pred.reconcile({ ...beforePound, ackSeq: (pound.seq - 1) >>> 0, moveStance: 0, stanceSeq: 0 });
    expect(pred.moveStance).toBe(3);
    pred.tick(pred.mintCmd(0, 0, false));
    pred.tick(pred.mintCmd(0, 0, false));
    expect(pred.renderPos(0, 0, 0).height).toBeLessThan(gatheredHeight);
  });

  it("stanceSeq adopts authority, strips pending stance causes, and preserves the glide offset", () => {
    const server = new MockServer();
    const initial = { ...server.view(), moveStance: 0 as const, stanceSeq: 0 };
    const pred = new SelfPredictor(initial);
    pred.tick(pred.mintCmd(1, 0, false));
    pred.tick(pred.mintCmd(1, 0, false, true));
    expect(pred.moveStance).toBe(1);

    const before = pred.renderPos(1, 0, 0);
    const forced = { ...initial, x: initial.x - 8, moveStance: 0 as const, stanceSeq: 1 };
    pred.reconcile(forced);
    expect(pred.moveStance).toBe(0);
    expect(pred.stats.errPx).toBeGreaterThan(0);
    expect(Math.abs(pred.renderPos(1, 0, 0).x - before.x)).toBeLessThan(1);

    for (let i = 0; i < 3; i++) {
      pred.reconcile(forced);
      expect(pred.moveStance).toBe(0);
    }
    pred.tick(pred.mintCmd(0, 0, false, true));
    expect(pred.moveStance).toBe(0); // the same physical hold is not a new press
    pred.tick(pred.mintCmd(0, 0, false, false));
    pred.tick(pred.mintCmd(0, 0, false, true));
    expect(pred.moveStance).toBe(1); // release then press legitimately re-arms crouch
  });
});

describe("jump-feel input and indicator helpers", () => {
  it("emits tap jump only on release, hold state at 150ms, and pound on an airborne press", async () => {
    const { SpaceGestureClassifier } = await import("./prediction.js");
    const input = new SpaceGestureClassifier();
    expect(input.sample(0, true, true, false, false).jump).toBe(false);
    expect(input.sample(90, false, false, true, false)).toMatchObject({
      jump: true,
      pound: false,
      crouchHeld: false,
    });

    input.sample(200, true, true, false, false);
    expect(input.sample(349, true, false, false, false).crouchHeld).toBe(false);
    expect(input.sample(350, true, false, false, false).crouchHeld).toBe(true);
    expect(input.sample(410, false, false, true, false).jump).toBe(false);
    expect(input.sample(500, true, true, false, true).pound).toBe(true);
  });

  it("marks only server-validation changes red and reports the exact validated endpoint", async () => {
    const { writeDistanceJumpIndicator } = await import("./prediction.js");
    const out = { rawX: 0, rawY: 0, x: 0, y: 0, dirX: 0, dirY: 0, clamped: false };
    expect(writeDistanceJumpIndicator(out, 1000, 1000, 1, 0, 0, 0)).toBe(true);
    expect(out.x).toBeCloseTo(1372, 6);
    expect(out.clamped).toBe(false);

    expect(writeDistanceJumpIndicator(out, 4780, 1000, 1, 0, 0, 0)).toBe(true);
    expect(out.x).toBeLessThan(out.rawX);
    expect(out.clamped).toBe(true);
  });
});

const slidePredictionShared = await import("@dd/shared");

describe("SelfPredictor — schema-23 slide replay", () => {
  it("replays the ten-tick capped decay curve deterministically", () => {
    const initial: ServerView = {
      x: 1000,
      y: 1000,
      mvx: slidePredictionShared.SLIDE_ENTRY_SPEED,
      mvy: 0,
      vx: 0,
      vy: 0,
      height: 0,
      vh: 0,
      ackSeq: 0,
      teleportSeq: 0,
      moveStance: slidePredictionShared.STANCE_NONE,
      stanceSeq: 0,
      alive: true,
      frozen: false,
    };
    const a = new SelfPredictor(initial);
    const b = new SelfPredictor(initial);
    for (let tick = 0; tick < slidePredictionShared.SLIDE_GROUND_TICKS; tick++) {
      const slide = tick === 0;
      const aCmd = a.mintCmd(1, 0, false, false, false, 1, 0, slide, true);
      const bCmd = b.mintCmd(1, 0, false, false, false, 1, 0, slide, true);
      a.tick(aCmd);
      b.tick(bCmd);
    }
    const beforeReplay = a.renderPos(0, 1, 0);
    const expectedDistance =
      ((slidePredictionShared.SLIDE_SPEED_CAP *
        (1 -
          slidePredictionShared.SLIDE_GROUND_DECAY **
            slidePredictionShared.SLIDE_GROUND_TICKS)) /
        (1 - slidePredictionShared.SLIDE_GROUND_DECAY)) *
      DT;
    expect(beforeReplay.x - initial.x).toBeCloseTo(expectedDistance, 9);
    expect(beforeReplay.y).toBeCloseTo(initial.y, 9);
    expect(a.moveStance).toBe(slidePredictionShared.STANCE_NONE);
    expect(b.renderPos(0, 1, 0)).toEqual(beforeReplay);

    // A delayed pre-slide patch rebases at ack 0; all ten pending commands reproduce the same state.
    a.reconcile(initial);
    const replayed = a.renderPos(0, 1, 0);
    expect(replayed.x).toBeCloseTo(beforeReplay.x, 9);
    expect(replayed.y).toBeCloseTo(beforeReplay.y, 9);
    expect(a.moveStance).toBe(slidePredictionShared.STANCE_NONE);
  });

  it("exposes the exact five-tick opening fraction and vulnerable tail", () => {
    const server = new MockServer();
    const pred = new SelfPredictor({
      ...server.view(),
      mvx: slidePredictionShared.SLIDE_ENTRY_SPEED,
      moveStance: slidePredictionShared.STANCE_NONE,
      stanceSeq: 0,
    });
    pred.tick(pred.mintCmd(1, 0, false, false, false, 1, 0, true, true));
    expect(pred.slideInvulnerable).toBe(true); // phase tick 1
    for (let tick = 1; tick < 5; tick++) {
      pred.tick(pred.mintCmd(1, 0, false, false, false, 1, 0, false, true));
      expect(pred.slideInvulnerable).toBe(true);
    }
    pred.tick(pred.mintCmd(1, 0, false, false, false, 1, 0, false, true));
    expect(pred.slideInvulnerable).toBe(false); // phase tick 6: ink/vulnerability returns
    expect(pred.moveStance).toBe(slidePredictionShared.STANCE_SLIDE);
    for (let tick = 6; tick <= 9; tick++) {
      pred.tick(pred.mintCmd(1, 0, false, false, false, 1, 0, false, true));
      expect(pred.slideParryLocked).toBe(true);
    }
    pred.tick(pred.mintCmd(1, 0, false, false, false, 1, 0, false, true));
    expect(pred.slideParryLocked).toBe(false); // consume + 10: the parry seam has elapsed
  });

  it("adopts a stanceSeq forced cancel, strips pending slide causes, and preserves glide correction", () => {
    const server = new MockServer();
    const initial = {
      ...server.view(),
      mvx: slidePredictionShared.SLIDE_ENTRY_SPEED,
      moveStance: slidePredictionShared.STANCE_NONE,
      stanceSeq: 0,
    };
    const pred = new SelfPredictor(initial);
    pred.tick(pred.mintCmd(1, 0, false, false, false, 1, 0, true, true));
    pred.tick(pred.mintCmd(1, 0, false, false, false, 1, 0, false, true));
    expect(pred.moveStance).toBe(slidePredictionShared.STANCE_SLIDE);
    const before = pred.renderPos(0, 1, 0);

    const forced = {
      ...initial,
      x: initial.x - 8,
      moveStance: slidePredictionShared.STANCE_NONE,
      stanceSeq: 1,
    };
    pred.reconcile(forced);
    expect(pred.moveStance).toBe(slidePredictionShared.STANCE_NONE);
    expect(pred.stats.errPx).toBeGreaterThan(0);
    expect(Math.abs(pred.renderPos(0, 1, 0).x - before.x)).toBeLessThan(1);
    expect(pred.canSlide).toBe(false);

    for (let patch = 0; patch < 3; patch++) {
      pred.reconcile(forced);
      expect(pred.moveStance).toBe(slidePredictionShared.STANCE_NONE);
    }
  });
});

describe("schema-23 slide input treaties", () => {
  it("binds Shift and Ctrl to identical press and hold signals", async () => {
    const { slideHeldFromBindings, slidePressedFromBindings } = await import("./prediction.js");
    expect(slidePressedFromBindings(true, false)).toBe(true);
    expect(slidePressedFromBindings(false, true)).toBe(true);
    expect(slidePressedFromBindings(false, false)).toBe(false);
    expect(slideHeldFromBindings(true, false)).toBe(true);
    expect(slideHeldFromBindings(false, true)).toBe(true);
    expect(slideHeldFromBindings(false, false)).toBe(false);
  });

  it("consumes grounded-slide Space on keydown and cannot leak that press into pound", async () => {
    const { SpaceGestureClassifier } = await import("./prediction.js");
    const input = new SpaceGestureClassifier();
    expect(input.sample(0, true, true, false, false, true, true)).toMatchObject({
      jump: true,
      pound: false,
      crouchHeld: false,
    });
    expect(input.sample(50, true, false, false, true, true, false)).toMatchObject({
      jump: false,
      pound: false,
    });
    input.sample(100, false, false, true, true, true, false);
    expect(input.sample(150, true, true, false, true, true, false).pound).toBe(true);
  });

  it("adopts an acknowledged server denial and requires a physical release", () => {
    const initial: ServerView = {
      x: 1000,
      y: 1000,
      mvx: slidePredictionShared.SLIDE_ENTRY_SPEED,
      mvy: 0,
      vx: 0,
      vy: 0,
      height: 0,
      vh: 0,
      ackSeq: 0,
      teleportSeq: 0,
      moveStance: slidePredictionShared.STANCE_NONE,
      stanceSeq: 0,
      alive: true,
      frozen: false,
    };
    const pred = new SelfPredictor(initial);
    const pressed = pred.mintCmd(1, 0, false, false, false, 1, 0, true, true);
    pred.tick(pressed);
    expect(pred.moveStance).toBe(slidePredictionShared.STANCE_SLIDE);
    pred.reconcile({ ...initial, ackSeq: pressed.seq });
    expect(pred.moveStance).toBe(slidePredictionShared.STANCE_NONE);
    pred.tick(pred.mintCmd(1, 0, false, false, false, 1, 0, true, true));
    expect(pred.moveStance).toBe(slidePredictionShared.STANCE_NONE);
  });

  it("adopts an authority-only slide break and clears divergent momentum before replay", () => {
    const initial: ServerView = {
      x: 1000,
      y: 1000,
      mvx: slidePredictionShared.SLIDE_ENTRY_SPEED,
      mvy: 0,
      vx: 0,
      vy: 0,
      height: 0,
      vh: 0,
      ackSeq: 0,
      teleportSeq: 0,
      moveStance: slidePredictionShared.STANCE_NONE,
      stanceSeq: 0,
      alive: true,
      frozen: false,
    };
    const pred = new SelfPredictor(initial);
    const entry = pred.mintCmd(1, 0, false, false, false, 1, 0, true, true);
    pred.tick(entry);
    const held = pred.mintCmd(1, 0, false, false, false, 1, 0, false, true);
    pred.tick(held);
    pred.reconcile({
      ...initial,
      x: initial.x + slidePredictionShared.SLIDE_SPEED_CAP * DT,
      mvx: slidePredictionShared.SLIDE_SPEED_CAP * slidePredictionShared.SLIDE_GROUND_DECAY,
      momentumX:
        slidePredictionShared.SLIDE_SPEED_CAP * slidePredictionShared.SLIDE_GROUND_DECAY,
      momentumY: 0,
      slidePhase: slidePredictionShared.SLIDE_PHASE_GROUND,
      slidePhaseTick: 1,
      moveStance: slidePredictionShared.STANCE_SLIDE,
      ackSeq: entry.seq,
    });
    const tail = pred.mintCmd(1, 0, false, false, false, 1, 0, false, true);
    pred.tick(tail);
    pred.reconcile({
      ...initial,
      x: initial.x + 40,
      mvx: 0,
      momentumX: 0,
      momentumY: 0,
      slidePhase: slidePredictionShared.SLIDE_PHASE_OFF,
      slidePhaseTick: 0,
      moveStance: slidePredictionShared.STANCE_NONE,
      ackSeq: held.seq,
    });
    expect(pred.moveStance).toBe(slidePredictionShared.STANCE_NONE);
    expect(pred.momentumSpeed).toBe(0);
  });
});

// Server-latency wave — append-only transport timing proof. Predictor math above remains unchanged.
const latencyPrediction = await import("./prediction.js");

describe("input transport — immediate changes retain the 20Hz heartbeat", () => {
  it("mints a movement change immediately, continues the heartbeat, and caps jitter extras", () => {
    const predictor = new SelfPredictor(new MockServer().view());
    const sendTimes: number[] = [];

    expect(
      predictor.shouldMintImmediateInput(0, 0, false, false, false, false, false, false, false),
    ).toBe(false);
    expect(
      predictor.shouldMintImmediateInput(1, 0, false, false, false, false, false, false, false),
    ).toBe(true);
    const movement = predictor.mintCmd(1, 0, false);
    predictor.tick(movement);
    sendTimes.push(1);

    // An edge send does not consume ArenaScene's cadence: the regular 50ms command follows.
    predictor.noteInputHeartbeat(1, 0, false, false, false);
    const heartbeat = predictor.mintCmd(1, 0, false);
    predictor.tick(heartbeat);
    sendTimes.push(50);
    expect(sendTimes).toEqual([1, 50]);
    expect([movement.seq, heartbeat.seq]).toEqual([1, 2]);

    // A noisy held edge can spend only the three tokens beside the next heartbeat's fourth token.
    let fireHeld = false;
    let extras = 0;
    for (let edge = 0; edge < latencyPrediction.IMMEDIATE_INPUT_SEND_CAP + 4; edge++) {
      fireHeld = !fireHeld;
      if (
        predictor.shouldMintImmediateInput(
          1,
          0,
          false,
          false,
          false,
          false,
          false,
          fireHeld,
          false,
        )
      )
        extras++;
    }
    expect(extras).toBe(latencyPrediction.IMMEDIATE_INPUT_SEND_CAP);
    expect(latencyPrediction.IMMEDIATE_INPUT_SEND_CAP).toBe(3);

    // A heartbeat re-opens the allowance; one-shots and held transitions use it too.
    predictor.noteInputHeartbeat(1, 0, false, false, fireHeld);
    expect(
      predictor.shouldMintImmediateInput(1, 0, true, false, false, false, false, fireHeld, false),
    ).toBe(true);
    expect(
      predictor.shouldMintImmediateInput(1, 0, false, true, false, false, false, fireHeld, false),
    ).toBe(true);
    expect(
      predictor.shouldMintImmediateInput(1, 0, false, true, false, false, false, fireHeld, true),
    ).toBe(true);

    predictor.noteInputHeartbeat(1, 0, false, false, fireHeld);
    expect(
      predictor.shouldMintImmediateInput(1, 0, false, false, true, false, false, fireHeld, false),
    ).toBe(true);
    expect(
      predictor.shouldMintImmediateInput(1, 0, false, false, false, true, false, fireHeld, false),
    ).toBe(true);
    expect(
      predictor.shouldMintImmediateInput(1, 0, false, false, false, false, true, fireHeld, false),
    ).toBe(true);
  });
});

// Movement-reconciliation wave — append-only regression proof for the owner jitter fix.
describe("owner reconciliation presentation — aligned ticks and bounded correction", () => {
  it("keeps a movement-only edge transport-only until the next fixed heartbeat", () => {
    const predictor = new SelfPredictor(new MockServer().view());
    const before = predictor.renderPos(0, 0, 0);
    const edge = predictor.mintCmd(1, 0, false);

    // ArenaScene sends this edge immediately but deliberately does not call tick(edge).
    expect(edge.seq).toBe(1);
    expect(predictor.stats.pending).toBe(0);
    expect(predictor.renderPos(0, 0, 0)).toMatchObject(before);

    const heartbeat = predictor.mintCmd(1, 0, false);
    predictor.tick(heartbeat);
    expect(heartbeat.seq).toBe(2);
    expect(predictor.stats.pending).toBe(1);
    expect(predictor.renderPos(0, 0, 0).x).toBeGreaterThan(before.x);
  });

  it("folds a coarse-frame resync and keeps ordinary correction inside the commanded forward cone", () => {
    const server = new MockServer();
    const predictor = new SelfPredictor(server.view());
    predictor.tick(predictor.mintCmd(1, 0, false));
    const before = predictor.renderPos(1, 0, 0);

    predictor.forceResync();
    predictor.reconcile({ ...server.view(), x: server.x - 180 });
    expect(predictor.renderPos(1, 0, 0).x).toBeCloseTo(before.x, 6);
    expect(predictor.stats.errPx).toBeGreaterThan(150);

    predictor.decayError(DT, 1, 0);
    const candidate = predictor.renderPos(1, 0, DT);
    const presented = predictor.constrainRenderStep(
      before.x,
      before.y,
      candidate.x,
      candidate.y,
      1,
      0,
    );
    const stepAngle = Math.abs(Math.atan2(presented.y - before.y, presented.x - before.x));
    expect(presented.x).toBeGreaterThan(before.x);
    expect(stepAngle).toBeLessThanOrEqual(Math.PI / 18 + 1e-9);
  });

  it("never presentation-folds an explicit teleport edge", () => {
    const server = new MockServer();
    const predictor = new SelfPredictor(server.view());
    const before = predictor.renderPos(1, 0, 0);
    predictor.reconcile({
      ...server.view(),
      x: 3000,
      y: 2600,
      teleportSeq: 1,
    });
    const candidate = predictor.renderPos(1, 0, 0);
    const presented = predictor.constrainRenderStep(
      before.x,
      before.y,
      candidate.x,
      candidate.y,
      1,
      0,
    );
    expect(presented).toMatchObject({ x: 3000, y: 2600 });
    expect(predictor.stats.errPx).toBe(0);
  });
});
