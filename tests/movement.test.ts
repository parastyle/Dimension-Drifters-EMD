import {
  ARENA_WIDTH,
  addImpulse,
  GRAVITY,
  IMPULSE_MAX,
  JUMP_VELOCITY,
  MOVE_HITCH_DIP,
  MOVE_ROTATION_RADIANS_PER_SECOND,
  MOVE_ROTATION_REARM_TICKS,
  MOVE_ROTATION_SPEED_RESERVE,
  MOVE_SPEED,
  PLAYER_RADIUS,
  steerVelocity,
  stepImpulse,
  stepPlayerMovement,
  stepSteeredMovement,
  stepVertical,
} from "@dd/shared";
import { describe, expect, it } from "vitest";

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

// §7 v0.105 STEERED movement — the "directional combination course correction". The authoritative tick
// now blends velocity toward the input target instead of snapping, so direction changes TRANSITION
// (forward→up sweeps through the diagonal), taps ease in, and releases settle to an exact stop.
describe("steerVelocity / stepSteeredMovement (§7 v0.111 pivot / turn-hitch)", () => {
  const TICK = 0.05; // the server's 20Hz dt

  it("spins up from rest to ~full speed quickly (the responsive baseline, no continuous ramp)", () => {
    let v = { vx: 0, vy: 0 };
    const speeds: number[] = [];
    for (let i = 0; i < 6; i++) {
      v = steerVelocity(v, { dx: 1, dy: 0 }, TICK);
      speeds.push(v.vx);
    }
    for (let i = 1; i < speeds.length; i++) {
      expect(speeds[i]).toBeGreaterThanOrEqual(speeds[i - 1] ?? 0); // monotonic spin-up
    }
    expect(v.vx).toBeGreaterThan(MOVE_SPEED * 0.95); // ~full speed within ~5 ticks (250ms)
    expect(v.vy).toBe(0);
  });

  it("PIVOTS a right→up turn: heading SNAPS to up (direct), speed DIPS once, then recovers", () => {
    // Run full-right, then hold UP (a 90° turn). The new model does NOT glide through the diagonal —
    // the heading snaps to vertical immediately (responsive), but the speed hitches (dips) on the turn.
    let v = steerVelocity({ vx: 0, vy: 0 }, { dx: 1, dy: 0 }, 2); // settle at full right
    expect(v.vx).toBeCloseTo(MOVE_SPEED, 0);
    v = steerVelocity(v, { dx: 0, dy: -1 }, TICK); // now hold UP
    expect(Math.abs(v.vx)).toBeLessThan(1e-6); // heading SNAPPED to vertical — no rightward glide
    expect(v.vy).toBeLessThan(0); // moving up
    const dipped = Math.hypot(v.vx, v.vy);
    // A 90° turn is one-third of the 45°→180° hitch curve: 275.2 → 315.52 after
    // the requested 90% gate-intensity reduction (MOVE_HITCH_DIP 0.42 → 0.042).
    expect(dipped).toBeCloseTo(MOVE_SPEED * (1 - MOVE_HITCH_DIP / 3), 10);
    expect(dipped).toBeLessThan(MOVE_SPEED); // the hitch remains, but is intentionally subtle
    // …then it recovers to full speed up over the next few ticks (the "go").
    for (let i = 0; i < 6; i++) v = steerVelocity(v, { dx: 0, dy: -1 }, TICK);
    expect(Math.abs(v.vx)).toBeLessThan(1e-6);
    expect(v.vy).toBeLessThan(-MOVE_SPEED * 0.95);
  });

  it("a 180° REVERSAL dips harder than a 90° turn (the hitch scales with turn sharpness)", () => {
    const full = steerVelocity({ vx: 0, vy: 0 }, { dx: 1, dy: 0 }, 2); // full right
    const after90 = steerVelocity(full, { dx: 0, dy: -1 }, TICK); // 90° turn
    const after180 = steerVelocity(full, { dx: -1, dy: 0 }, TICK); // 180° reversal
    expect(Math.hypot(after180.vx, after180.vy)).toBeLessThan(Math.hypot(after90.vx, after90.vy));
  });

  it("a SLOW arc never hitches — small per-tick angle changes keep full speed", () => {
    let v = steerVelocity({ vx: 0, vy: 0 }, { dx: 1, dy: 0 }, 2); // full right
    // Rotate the input a few degrees per tick (well under the 45° threshold) — a smooth arc.
    for (let i = 1; i <= 12; i++) {
      const a = i * 0.15 * -1; // ~8.6°/tick, downward-ish arc
      v = steerVelocity(v, { dx: Math.cos(a), dy: Math.sin(a) }, TICK);
      expect(Math.hypot(v.vx, v.vy)).toBeGreaterThan(MOVE_SPEED * 0.95); // never dipped
    }
  });

  it("NEVER exceeds the §7 flat-speed ceiling, even mid-turn", () => {
    let v = steerVelocity({ vx: 0, vy: 0 }, { dx: 1, dy: 0 }, 2);
    for (let i = 0; i < 20; i++) {
      v = steerVelocity(v, { dx: i % 2 ? 1 : 0, dy: i % 2 ? 0 : -1 }, TICK); // thrash the stick
      expect(Math.hypot(v.vx, v.vy)).toBeLessThanOrEqual(MOVE_SPEED + 1e-9);
    }
  });

  it("releasing the keys settles to an EXACT stop (no ice-skating, no residual drift)", () => {
    let v = steerVelocity({ vx: 0, vy: 0 }, { dx: 1, dy: 0 }, 2);
    for (let i = 0; i < 8; i++) v = steerVelocity(v, { dx: 0, dy: 0 }, TICK);
    expect(v.vx).toBe(0); // snapped to exactly zero, not 0.0003
    expect(v.vy).toBe(0);
  });

  it("is deterministic + the linear recover composes across substeps (aligned, below the speed cap)", () => {
    // The fixed-timestep netcode (v0.107) always steps at the SAME dt on server + predictor, so identical
    // (vel,input,dt) MUST give identical output — pin that. And in the aligned recover region (no turn, below
    // the cap) the linear accel composes exactly (two 25ms ≡ one 50ms), so a fractional preview stays honest.
    const start = { vx: 100, vy: 0 }; // moving right, below the cap, input aligned → pure recover (no hitch)
    const input = { dx: 1, dy: 0 };
    expect(steerVelocity(start, input, 0.05)).toEqual(steerVelocity(start, input, 0.05)); // deterministic
    const one = steerVelocity(start, input, 0.05);
    const half = steerVelocity(steerVelocity(start, input, 0.025), input, 0.025);
    expect(half.vx).toBeCloseTo(one.vx, 9);
    expect(half.vy).toBeCloseTo(one.vy, 9);
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
    let v = { vx: 0, vy: 0 };
    for (let i = 0; i < 40; i++) v = steerVelocity(v, { dx: 99, dy: 0 }, TICK);
    expect(v.vx).toBeLessThanOrEqual(MOVE_SPEED + 1e-9);
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

// §7 v0.118 circle-jitter reproduction — record the displacement the player actually receives each
// authoritative 20 Hz tick. The pre-fix snap law fails both direction bounds below; when a fast rotating
// intent is quantized to the eight keyboard headings it also alternates 45°/90° facets and strobes the
// 90° hitch between 320 and 315.52 px/s.
describe("stepSteeredMovement (§7 v0.118 sustained-rotation regression)", () => {
  const TICK = 0.05;
  const MAX_TURN_PER_TICK = MOVE_ROTATION_RADIANS_PER_SECOND * TICK;
  const MAX_MAGNITUDE_SPREAD = MOVE_ROTATION_SPEED_RESERVE * (MOVE_ROTATION_REARM_TICKS * 2 + 1);
  const KEYBOARD_FACET = Math.PI / 4;

  function shortestTurn(from: number, to: number): number {
    let delta = (to - from + Math.PI) % (Math.PI * 2);
    if (delta < 0) delta += Math.PI * 2;
    return delta - Math.PI;
  }

  function circleTrace(
    radiansPerTick: number,
    ticks: number,
    quantizeToKeyboard: boolean,
  ): { magnitudes: number[]; directionDeltas: number[] } {
    let x = 2500;
    let y = 2500;
    let vx = MOVE_SPEED;
    let vy = 0;
    let heading = 0;
    const magnitudes: number[] = [];
    const directionDeltas: number[] = [];
    for (let tick = 1; tick <= ticks; tick++) {
      const rawHeading = radiansPerTick * tick;
      const inputHeading = quantizeToKeyboard
        ? Math.round(rawHeading / KEYBOARD_FACET) * KEYBOARD_FACET
        : rawHeading;
      const moved = stepSteeredMovement(
        { x, y },
        { vx, vy },
        { dx: Math.cos(inputHeading), dy: Math.sin(inputHeading) },
        TICK,
      );
      const displacementX = moved.x - x;
      const displacementY = moved.y - y;
      const nextHeading = Math.atan2(displacementY, displacementX);
      magnitudes.push(Math.hypot(displacementX, displacementY) / TICK);
      directionDeltas.push(Math.abs(shortestTurn(heading, nextHeading)));
      x = moved.x;
      y = moved.y;
      vx = moved.vx;
      vy = moved.vy;
      heading = nextHeading;
    }
    return { magnitudes, directionDeltas };
  }

  function expectSmoothRotation(trace: { magnitudes: number[]; directionDeltas: number[] }): void {
    const magnitudeSpread = Math.max(...trace.magnitudes) - Math.min(...trace.magnitudes);
    expect(magnitudeSpread).toBeLessThan(MAX_MAGNITUDE_SPREAD);
    expect(Math.max(...trace.directionDeltas)).toBeLessThanOrEqual(MAX_TURN_PER_TICK + 1e-10);
  }

  it("bounds smooth continuous-circle displacement at several angular speeds", () => {
    for (const degreesPerTick of [10, 30, 46]) {
      expectSmoothRotation(circleTrace((degreesPerTick * Math.PI) / 180, 160, false));
    }
  });

  it("kills 45°-quantized keyboard circle facets and hitch strobe at several angular speeds", () => {
    for (const degreesPerTick of [15, 46, 60]) {
      expectSmoothRotation(circleTrace((degreesPerTick * Math.PI) / 180, 160, true));
    }
  });

  it("keeps one deliberate 180° pivot direct and fires today's hitch dip exactly once", () => {
    let velocity = { vx: MOVE_SPEED, vy: 0 };
    const speeds: number[] = [];
    for (let tick = 0; tick < 5; tick++) {
      velocity = steerVelocity(velocity, { dx: -1, dy: 0 }, TICK);
      speeds.push(Math.hypot(velocity.vx, velocity.vy));
      expect(velocity.vx).toBeLessThan(0);
      expect(Math.abs(velocity.vy)).toBeLessThan(1e-12);
    }
    expect(speeds[0]).toBeCloseTo(MOVE_SPEED * (1 - MOVE_HITCH_DIP), 10);
    expect(speeds.filter((value) => value < MOVE_SPEED - 1e-9)).toHaveLength(1);
  });

  it("resimulates identical authority/prediction input sequences to bit-identical positions", () => {
    const sequences = [
      Array.from({ length: 160 }, (_, tick) => ((tick + 1) * 30 * Math.PI) / 180),
      Array.from({ length: 160 }, (_, tick) => {
        const rawHeading = ((tick + 1) * 60 * Math.PI) / 180;
        return Math.round(rawHeading / KEYBOARD_FACET) * KEYBOARD_FACET;
      }),
    ];
    for (const sequence of sequences) {
      let authority = { x: 2500, y: 2500, vx: MOVE_SPEED, vy: 0 };
      let prediction = { ...authority };
      for (const heading of sequence) {
        const input = { dx: Math.cos(heading), dy: Math.sin(heading) };
        authority = stepSteeredMovement(authority, authority, input, TICK);
        prediction = stepSteeredMovement(prediction, prediction, input, TICK);
        expect(prediction.x).toBe(authority.x);
        expect(prediction.y).toBe(authority.y);
        expect(prediction.vx).toBe(authority.vx);
        expect(prediction.vy).toBe(authority.vy);
      }
    }
  });
});
