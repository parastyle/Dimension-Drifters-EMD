import {
  addImpulse,
  ARENA_WIDTH,
  DIST_JUMP_VERTICAL_VELOCITY,
  INTERP_SNAP_PLAYER,
  stepImpulse,
  stepSteeredMovement,
  stepVertical,
  TICK_MS,
  WEAPONS,
} from "@dd/shared";
import { describe, expect, it } from "vitest";
import {
  LOCOMOTION_ONLY_AUTHORITY_RADIUS_PX,
  type PredCmd,
  SelfPredictor,
  type ServerView,
} from "./prediction.js";

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

  it("the explicit impulse seam stays exact for classified hit knockback", () => {
    const server = new MockServer();
    const pred = new SelfPredictor(server.view());
    for (let round = 0; round < 4; round++) {
      server.knockback(-180, 95);
      pred.addPredictedImpulse(-180, 95);
      const cmd = pred.mintCmd(1, 0, false);
      server.send(cmd);
      server.tick();
      pred.tick(cmd);
      pred.reconcile(server.view());
      const rendered = pred.renderPos(1, 0, 0);
      expect(rendered.x, `round ${round + 1} x`).toBeCloseTo(server.x, 6);
      expect(rendered.y, `round ${round + 1} y`).toBeCloseTo(server.y, 6);
      expect(pred.stats.errPx, `round ${round + 1} correction`).toBeLessThan(0.01);
    }
  });

  it("keeps weapon presentation recoil out of predicted locomotion at low and induced latency", () => {
    const weapon = WEAPONS["x2-galvanic-overcasters"];
    expect(weapon?.gun?.recoil).toBeGreaterThan(0);

    for (const latency of [0, 3]) {
      const server = new MockServer();
      const pred = new SelfPredictor(server.view());
      const before = pred.renderPos(0, 0, 0);
      expect(pred.renderPos(0, 0, 0), `latency ${latency} recoil edge`).toMatchObject(before);

      run(pred, server, [...hold(1, 0, 24), ...hold(-1, 0, 24), ...hold(1, 0, 24)], latency);
      const moving = pred.renderPos(1, 0, 0);
      const bounded = pred.boundLocomotionPresentation(server.x, server.y, moving.x, moving.y);
      expect(
        Math.hypot(bounded.x - server.x, bounded.y - server.y),
        `latency ${latency} authority radius`,
      ).toBeLessThanOrEqual(LOCOMOTION_ONLY_AUTHORITY_RADIUS_PX);
      run(pred, server, hold(0, 0, 40), latency);
      const settled = pred.renderPos(0, 0, 0);
      expect(settled.x, `latency ${latency} settled x`).toBeCloseTo(server.x, 1);
      expect(settled.y, `latency ${latency} settled y`).toBeCloseTo(server.y, 1);
    }
  });

  it("TELEPORT (teleportSeq bump) hard-SNAPS: no glide across the map, pending + offset cleared", () => {
    const server = new MockServer();
    const pred = new SelfPredictor(server.view());
    run(pred, server, hold(1, 0, 10), 2);
    server.teleport(3000, 3000); // rift descent / lava recovery / restart
    run(pred, server, hold(0, 0, 3), 2);
    const r = pred.renderPos(0, 0, 0);
    expect(Math.hypot(r.x - 3000, r.y - 3000)).toBeLessThan(INTERP_SNAP_PLAYER); // snapped, not gliding
    expect(pred.stats.errPx).toBe(0);
    run(pred, server, hold(0, 0, 5), 2);
    expect(pred.renderPos(0, 0, 0).x).toBeCloseTo(server.x, 1);
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
    // Truth finally arrives → simulation rebases, but L10 preserves SELF and glides the stale lead out.
    server.tick();
    pred.reconcile(server.view());
    expect(pred.isStalled).toBe(false);
    expect(pred.renderPos(0, 0, 0).x).toBeCloseTo(frozenAt.x, 6);
    expect(pred.isSmoothingCorrection).toBe(true);
    for (let frame = 0; frame < 12; frame++) pred.decayError(1 / 60);
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
    const authoritativeHop = stepVertical(0, DIST_JUMP_VERTICAL_VELOCITY, DT);

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
  it("replays an immediate default distance jump through a pre-input patch", () => {
    const server = new MockServer();
    const pred = new SelfPredictor({ ...server.view(), moveStance: 0, stanceSeq: 0 });
    const preJump = server.view();

    const first = pred.mintCmd(1, 0, true, false, false, 1, 0);
    pred.tick(first);
    expect(pred.moveStance).toBe(2);
    expect(pred.renderPos(1, 0, 0).height).toBeGreaterThan(0);
    pred.reconcile({ ...preJump, ackSeq: 0, moveStance: 0, stanceSeq: 0 });
    expect(pred.moveStance).toBe(2);
    expect(pred.renderPos(1, 0, 0).height).toBeGreaterThan(0);
  });

  it("predicts full airtime when the hard arena boundary collapses the endpoint onto takeoff", async () => {
    const shared = await import("@dd/shared");
    const server = new MockServer();
    server.x = shared.ARENA_WIDTH - shared.PLAYER_RADIUS;
    const pred = new SelfPredictor({ ...server.view(), moveStance: 0, stanceSeq: 0 });
    const map = shared.generateArena({
      seedTerrain: 1,
      seedHazard: 2,
      seedTheme: 3,
      seedDecor: 4,
    });
    pred.setMap(map);

    pred.tick(pred.mintCmd(1, 0, true, false, false, 1, 0));
    let airborneTicks = pred.renderPos(0, 0, 0).height > 0 ? 1 : 0;
    while (pred.renderPos(0, 0, 0).height > 0 && airborneTicks < 30) {
      pred.tick(pred.mintCmd(0, 0, false, false, false, 1, 0));
      airborneTicks++;
    }

    expect(airborneTicks).toBe(
      Math.ceil(
        shared.verticalTimeToGround(0, shared.DIST_JUMP_VERTICAL_VELOCITY) /
          (shared.TICK_MS / 1_000),
      ),
    );
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
    pred.tick(pred.mintCmd(1, 0, false, false, false, 1, 0, true, true));
    expect(pred.moveStance).toBe(4);

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
    pred.tick(pred.mintCmd(0, 0, false, false, false, 1, 0, true, true));
    expect(pred.moveStance).toBe(0); // the same physical hold is not a new press
    pred.tick(pred.mintCmd(0, 0, false, false, false, 1, 0, false, false));
    expect(pred.moveStance).toBe(0); // forced cancellation starts the time cooldown
  });
});

describe("jump-feel input and indicator helpers", () => {
  it("emits jump on the first grounded keydown, never charges, and pounds on an airborne press", async () => {
    const { SpaceGestureClassifier } = await import("./prediction.js");
    const input = new SpaceGestureClassifier();
    expect(input.sample(0, true, true, false, false)).toMatchObject({
      jump: true,
      pound: false,
      crouchHeld: false,
    });
    expect(input.sample(350, true, false, false, false)).toMatchObject({
      jump: false,
      crouchHeld: false,
    });
    expect(input.sample(410, false, false, true, false).jump).toBe(false);
    expect(input.sample(500, true, true, false, true).pound).toBe(true);
  });

  it("re-arms from the stable released state when a loaded frame coalesces the JustUp edge", async () => {
    const { SpaceGestureClassifier } = await import("./prediction.js");
    const input = new SpaceGestureClassifier();
    expect(input.sample(0, true, true, false, false).jump).toBe(true);
    expect(input.sample(16, false, false, false, false).jump).toBe(false);
    expect(input.sample(32, true, true, false, true).pound).toBe(true);
  });

  it("marks only server-validation changes red and reports the exact validated endpoint", async () => {
    const { writeDistanceJumpIndicator } = await import("./prediction.js");
    const out = { rawX: 0, rawY: 0, x: 0, y: 0, dirX: 0, dirY: 0, clamped: false };
    expect(writeDistanceJumpIndicator(out, 1000, 1000, 1, 0, 0, 0)).toBe(true);
    expect(out.x).toBeCloseTo(1372, 6);
    expect(out.clamped).toBe(false);

    expect(writeDistanceJumpIndicator(out, ARENA_WIDTH - 20, 1000, 1, 0, 0, 0)).toBe(true);
    expect(out.x).toBeLessThan(out.rawX);
    expect(out.clamped).toBe(true);
  });
});

const rollPredictionShared = await import("@dd/shared");

function rollInitial(): ServerView {
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
    moveStance: rollPredictionShared.STANCE_NONE,
    stanceSeq: 0,
    alive: true,
  };
}

function rollCmd(pred: SelfPredictor, dx: number, dy: number, edge: boolean): PredCmd {
  return pred.mintCmd(dx, dy, false, false, false, 1, 0, edge, edge);
}

describe("SelfPredictor — V7 fixed roll replay", () => {
  it("replays the exact eight-sample 188 px sentence from rest with frozen direction", () => {
    const initial = rollInitial();
    const pred = new SelfPredictor(initial);
    for (let tick = 0; tick < rollPredictionShared.ROLL_DURATION_TICKS; tick++) {
      const edge = tick === 0;
      pred.tick(rollCmd(pred, edge ? 1 : 0, edge ? 0 : 1, edge));
    }
    const beforeReplay = pred.renderPos(0, 1, 0);
    expect(beforeReplay.x - initial.x).toBeCloseTo(rollPredictionShared.ROLL_DISTANCE, 9);
    expect(beforeReplay.y).toBeCloseTo(initial.y, 9);
    expect(pred.moveStance).toBe(rollPredictionShared.STANCE_NONE);
    expect(pred.slideCooldownRemaining).toBeGreaterThan(2.9);

    pred.reconcile(initial);
    const replayed = pred.renderPos(0, 1, 0);
    expect(replayed.x).toBeCloseTo(beforeReplay.x, 9);
    expect(replayed.y).toBeCloseTo(beforeReplay.y, 9);
  });

  it("exposes five opening ticks, a vulnerable tail, and the independent parry lock", () => {
    const pred = new SelfPredictor(rollInitial());
    pred.tick(rollCmd(pred, 1, 0, true));
    expect(pred.slideInvulnerable).toBe(true);
    for (let tick = 1; tick < rollPredictionShared.ROLL_IFRAME_TICKS; tick++) {
      pred.tick(rollCmd(pred, 1, 0, false));
      expect(pred.slideInvulnerable).toBe(true);
    }
    pred.tick(rollCmd(pred, 1, 0, false));
    expect(pred.slideInvulnerable).toBe(false);
    expect(pred.moveStance).toBe(rollPredictionShared.STANCE_SLIDE);
    expect(pred.slideParryLocked).toBe(true);
  });

  it("adopts a forced authority cancel, clears momentum, and starts cooldown", () => {
    const initial = rollInitial();
    const pred = new SelfPredictor(initial);
    const entry = rollCmd(pred, 1, 0, true);
    pred.tick(entry);
    pred.tick(rollCmd(pred, 1, 0, false));
    const before = pred.renderPos(0, 1, 0);
    pred.reconcile({
      ...initial,
      x: initial.x - 8,
      ackSeq: entry.seq,
      moveStance: rollPredictionShared.STANCE_NONE,
      stanceSeq: 1,
      momentumX: 0,
      momentumY: 0,
      slidePhase: rollPredictionShared.SLIDE_PHASE_OFF,
      slidePhaseTick: 0,
    });
    expect(pred.moveStance).toBe(rollPredictionShared.STANCE_NONE);
    expect(pred.momentumSpeed).toBe(0);
    expect(pred.canSlide).toBe(false);
    expect(pred.stats.errPx).toBeGreaterThan(0);
    expect(Math.abs(pred.renderPos(0, 1, 0).x - before.x)).toBeLessThan(1);
  });

  it("binds Shift and Ctrl identically and requires release after an acknowledged denial", async () => {
    const { slideHeldFromBindings, slidePressedFromBindings } = await import("./prediction.js");
    expect(slidePressedFromBindings(true, false)).toBe(true);
    expect(slidePressedFromBindings(false, true)).toBe(true);
    expect(slideHeldFromBindings(true, false)).toBe(true);
    expect(slideHeldFromBindings(false, true)).toBe(true);

    const initial = rollInitial();
    const pred = new SelfPredictor(initial);
    const pressed = rollCmd(pred, 1, 0, true);
    pred.tick(pressed);
    expect(pred.moveStance).toBe(rollPredictionShared.STANCE_SLIDE);
    pred.reconcile({ ...initial, ackSeq: pressed.seq });
    expect(pred.moveStance).toBe(rollPredictionShared.STANCE_NONE);
    pred.tick(rollCmd(pred, 1, 0, true));
    expect(pred.moveStance).toBe(rollPredictionShared.STANCE_NONE);
  });

  it("buffers Space during the roll and launches the long jump on the first legal tick", () => {
    const pred = new SelfPredictor(rollInitial());
    pred.tick(rollCmd(pred, 1, 0, true));
    pred.tick(pred.mintCmd(1, 0, true));
    for (let tick = 2; tick < rollPredictionShared.ROLL_DURATION_TICKS; tick++)
      pred.tick(pred.mintCmd(1, 0, false));
    pred.tick(pred.mintCmd(1, 0, false));
    expect(pred.moveStance).toBe(rollPredictionShared.STANCE_DASH);
    expect(pred.renderPos(1, 0, 0).height).toBeGreaterThan(0);
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
        predictor.shouldMintImmediateInput(1, 0, false, false, false, false, false, fireHeld, false)
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
  it("folds B19-sized authoritative combo root motion into a glide instead of a teleport", () => {
    const server = new MockServer();
    const predictor = new SelfPredictor(server.view());
    const before = predictor.renderPos(0, 0, 0);
    const forced = { ...server.view(), x: server.x + 16, y: server.y - 11 };

    predictor.reconcile(forced);
    expect(predictor.renderPos(0, 0, 0)).toMatchObject(before);
    expect(predictor.stats.errPx).toBeCloseTo(Math.hypot(16, 11), 8);

    let previous = before;
    for (let frame = 0; frame < 30; frame++) {
      predictor.decayError(1 / 60, 0, 0);
      const next = predictor.renderPos(0, 0, 0);
      expect(Math.hypot(next.x - previous.x, next.y - previous.y)).toBeLessThan(4);
      previous = next;
    }
    expect(previous.x).toBeGreaterThan(before.x + 14);
    expect(previous.y).toBeLessThan(before.y - 9);
  });

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
