import {
  ARENA_WIDTH,
  addImpulse,
  GRAVITY,
  IMPULSE_MAX,
  JUMP_VELOCITY,
  MOVE_SPEED,
  PLAYER_RADIUS,
  ROLL_DISTANCE,
  ROLL_DURATION_TICKS,
  ROLL_SPEED_CURVE,
  ROLL_TICK_SECONDS,
  rollSpeedAtTick,
  steerVelocity,
  stepImpulse,
  stepPlayerMovement,
  stepSteeredMovement,
  stepVertical,
} from "@dd/shared";
import { describe, expect, it } from "vitest";

describe("V7 fixed roll sentence", () => {
  it("samples eight deterministic speeds totaling exactly 188 px over 400 ms", () => {
    const samples = Array.from({ length: ROLL_DURATION_TICKS }, (_, tick) => rollSpeedAtTick(tick));
    expect(samples).toEqual(ROLL_SPEED_CURVE);
    expect(samples.reduce((distance, speed) => distance + speed * ROLL_TICK_SECONDS, 0)).toBe(
      ROLL_DISTANCE,
    );
    expect(ROLL_DURATION_TICKS * ROLL_TICK_SECONDS).toBeCloseTo(0.4, 9);
  });

  it("clamps corrupted/fractional sample indices without changing the roll law", () => {
    expect(rollSpeedAtTick(-100)).toBe(ROLL_SPEED_CURVE[0]);
    expect(rollSpeedAtTick(3.9)).toBe(ROLL_SPEED_CURVE[3]);
    expect(rollSpeedAtTick(100)).toBe(ROLL_SPEED_CURVE.at(-1));
  });
});

// §26 retro #4: test the hot path first. Movement is the authoritative step shared by
// the server tick and (later) client prediction — if it drifts, co-op desyncs.
describe("stepPlayerMovement", () => {
  it("moves at the flat move speed over one second", () => {
    const result = stepPlayerMovement({ x: 1000, y: 1000 }, { dx: 1, dy: 0 }, 1);
    expect(result.x).toBeCloseTo(1000 + MOVE_SPEED);
    expect(result.y).toBe(1000);
  });

  it("normalizes diagonal input so diagonal isn't faster (§7 flat speed / anti speed-hack)", () => {
    const result = stepPlayerMovement({ x: 1000, y: 1000 }, { dx: 1, dy: 1 }, 1);
    const distance = Math.hypot(result.x - 1000, result.y - 1000);
    expect(distance).toBeCloseTo(MOVE_SPEED);
  });

  it("ignores an over-unit input vector (cannot request a faster step)", () => {
    const result = stepPlayerMovement({ x: 1000, y: 1000 }, { dx: 99, dy: 0 }, 1);
    expect(result.x).toBeCloseTo(1000 + MOVE_SPEED);
  });

  it("clamps to arena bounds (§4 light server position sanity check)", () => {
    const result = stepPlayerMovement(
      { x: ARENA_WIDTH - PLAYER_RADIUS, y: 1000 },
      { dx: 1, dy: 0 },
      1,
    );
    expect(result.x).toBe(ARENA_WIDTH - PLAYER_RADIUS);
  });

  it("does not move with zero input", () => {
    const result = stepPlayerMovement({ x: 500, y: 500 }, { dx: 0, dy: 0 }, 1);
    expect(result).toEqual({ x: 500, y: 500 });
  });
});

// B74 owner law: ordinary movement has exactly two magnitudes — MOVE_SPEED while input is held, or zero.
// Heading changes are direct and may never feed an animation/gait/facing phase back into root velocity.
describe("steerVelocity / stepSteeredMovement (B74 constant-speed law)", () => {
  const TICK = 0.05; // the server's 20Hz dt

  it("starts at full speed on the first held-input tick", () => {
    const v = steerVelocity({ vx: 0, vy: 0 }, { dx: 1, dy: 0 }, TICK);
    expect(v).toEqual({ vx: MOVE_SPEED, vy: 0 });
  });

  it("snaps a 90-degree turn to the new heading without a speed dip", () => {
    const v = steerVelocity({ vx: MOVE_SPEED, vy: 0 }, { dx: 0, dy: -1 }, TICK);
    expect(v.vx).toBe(0);
    expect(v.vy).toBe(-MOVE_SPEED);
    expect(Math.hypot(v.vx, v.vy)).toBe(MOVE_SPEED);
  });

  it("snaps a full reversal without a hitch or recovery frame", () => {
    const v = steerVelocity({ vx: MOVE_SPEED, vy: 0 }, { dx: -1, dy: 0 }, TICK);
    expect(v).toEqual({ vx: -MOVE_SPEED, vy: 0 });
  });

  it("keeps a changing heading at constant speed", () => {
    let v = { vx: MOVE_SPEED, vy: 0 };
    for (let i = 1; i <= 32; i++) {
      const a = i * 0.31;
      v = steerVelocity(v, { dx: Math.cos(a), dy: Math.sin(a) }, TICK);
      expect(Math.hypot(v.vx, v.vy)).toBeCloseTo(MOVE_SPEED, 10);
    }
  });

  it("stays exactly at the §7 flat speed even while input thrashes", () => {
    let v = { vx: MOVE_SPEED, vy: 0 };
    for (let i = 0; i < 20; i++) {
      v = steerVelocity(v, { dx: i % 2 ? 1 : 0, dy: i % 2 ? 0 : -1 }, TICK); // thrash the stick
      expect(Math.hypot(v.vx, v.vy)).toBe(MOVE_SPEED);
    }
  });

  it("releasing input stops on the first tick with no residual drift", () => {
    expect(steerVelocity({ vx: MOVE_SPEED, vy: 0 }, { dx: 0, dy: 0 }, TICK)).toEqual({
      vx: 0,
      vy: 0,
    });
  });

  it("is deterministic and independent of substep size or retained velocity magnitude", () => {
    const input = { dx: 1, dy: 1 };
    const a = steerVelocity({ vx: -17, vy: 203 }, input, 0.05);
    const b = steerVelocity({ vx: 999, vy: -999 }, input, 0.001);
    expect(a).toEqual(b);
    expect(Math.hypot(a.vx, a.vy)).toBeCloseTo(MOVE_SPEED, 10);
  });

  it("stepSteeredMovement integrates the steered velocity + clamps to the arena", () => {
    const r = stepSteeredMovement(
      { x: ARENA_WIDTH - PLAYER_RADIUS, y: 1000 },
      { vx: MOVE_SPEED, vy: 0 },
      { dx: 1, dy: 0 },
      1,
    );
    expect(r.x).toBe(ARENA_WIDTH - PLAYER_RADIUS); // wall holds
    expect(r.vx).toBeGreaterThan(0); // velocity itself keeps steering (the wall clamps position only)
  });

  it("over-unit input cannot buy speed (anti speed-hack holds through the steering layer)", () => {
    const v = steerVelocity({ vx: 0, vy: 0 }, { dx: 99, dy: 0 }, TICK);
    expect(v.vx).toBe(MOVE_SPEED);
    expect(v.vy).toBe(0);
  });
});

// §20 momentum layer (Stage A) — the shove that gives recoil + knockback weight.
describe("stepImpulse (momentum integration + friction)", () => {
  it("displaces the position along the impulse velocity", () => {
    const r = stepImpulse({ x: 1000, y: 1000 }, { vx: 200, vy: 0 }, 0.1);
    expect(r.x).toBeCloseTo(1020); // 200 px/s × 0.1s
    expect(r.y).toBeCloseTo(1000);
  });

  it("decays the velocity under friction (settles to rest)", () => {
    let vel = { vx: 600, vy: 0 };
    let pos = { x: 1000, y: 1000 };
    for (let i = 0; i < 200; i++) {
      const r = stepImpulse(pos, vel, 1 / 60);
      pos = { x: r.x, y: r.y };
      vel = { vx: r.vx, vy: r.vy };
    }
    expect(vel.vx).toBe(0); // fully snapped to rest
    expect(vel.vy).toBe(0);
  });

  it("snaps sub-epsilon residuals straight to zero (no infinite crawl)", () => {
    const r = stepImpulse({ x: 500, y: 500 }, { vx: 3, vy: -2 }, 1 / 60);
    expect(r.vx).toBe(0);
    expect(r.vy).toBe(0);
  });

  it("clamps the shoved position to the arena bounds", () => {
    const r = stepImpulse({ x: ARENA_WIDTH - PLAYER_RADIUS, y: 1000 }, { vx: 9999, vy: 0 }, 1);
    expect(r.x).toBe(ARENA_WIDTH - PLAYER_RADIUS);
  });

  it("a zero impulse is a no-op", () => {
    const r = stepImpulse({ x: 500, y: 500 }, { vx: 0, vy: 0 }, 1 / 60);
    expect([r.x, r.y, r.vx, r.vy]).toEqual([500, 500, 0, 0]);
  });
});

describe("addImpulse (accumulate + cap)", () => {
  it("adds the kick to the existing velocity", () => {
    const r = addImpulse({ vx: 100, vy: 0 }, 50, -30);
    expect(r.vx).toBe(150);
    expect(r.vy).toBe(-30);
  });

  it("caps the accumulated speed at IMPULSE_MAX (a stream can't fling you away)", () => {
    let vel = { vx: 0, vy: 0 };
    for (let i = 0; i < 50; i++) vel = addImpulse(vel, 200, 0); // hammer it
    expect(Math.hypot(vel.vx, vel.vy)).toBeCloseTo(IMPULSE_MAX, 4);
  });

  it("preserves direction when capping", () => {
    const r = addImpulse({ vx: 0, vy: 0 }, 3000, 4000); // 3-4-5 → way over cap
    expect(r.vx / r.vy).toBeCloseTo(3 / 4, 6);
    expect(Math.hypot(r.vx, r.vy)).toBeCloseTo(IMPULSE_MAX, 4);
  });
});

// §5/§20 vertical physics (Stage B) — the real height axis the jump + parry-launch ride on.
describe("stepVertical (height + gravity)", () => {
  it("a grounded rest is a no-op", () => {
    expect(stepVertical(0, 0, 1 / 60)).toEqual({ height: 0, vh: 0 });
  });

  it("rises on an upward velocity and gravity decelerates it", () => {
    const a = stepVertical(0, JUMP_VELOCITY, 1 / 60);
    expect(a.height).toBeGreaterThan(0);
    expect(a.vh).toBeLessThan(JUMP_VELOCITY); // gravity took a bite
    expect(a.vh).toBeCloseTo(JUMP_VELOCITY - GRAVITY / 60, 4);
  });

  it("a full jump arcs up then lands back at 0 (and stays grounded)", () => {
    let h = 0;
    let vh = JUMP_VELOCITY;
    let peak = 0;
    let landed = -1;
    const dt = 1 / 120;
    for (let i = 0; i < 240; i++) {
      const r = stepVertical(h, vh, dt);
      h = r.height;
      vh = r.vh;
      peak = Math.max(peak, h);
      if (h === 0 && landed < 0 && i > 1) landed = i * dt;
    }
    expect(peak).toBeGreaterThan(25); // a real hop (~34px peak with the tuning)
    expect(peak).toBeLessThan(60);
    expect(landed).toBeGreaterThan(0.3); // airtime in the ~0.45s ballpark
    expect(landed).toBeLessThan(0.6);
    expect(h).toBe(0); // fully landed, at rest
    expect(vh).toBe(0);
  });

  it("never goes below the ground (snaps to 0 on landing)", () => {
    const r = stepVertical(2, -9999, 1 / 60); // slammed down hard
    expect(r.height).toBe(0);
    expect(r.vh).toBe(0);
  });
});
