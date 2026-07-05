import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  GRAVITY,
  IMPULSE_EPSILON,
  IMPULSE_FRICTION,
  IMPULSE_MAX,
  MOVE_SPEED,
  MOVE_STEER_ACCEL,
  MOVE_STEER_DECEL,
  PLAYER_RADIUS,
} from "./constants.js";
import { clamp } from "./math.js";

export interface Vec2 {
  x: number;
  y: number;
}

/** Intended movement direction from a player's input (not necessarily normalized). */
export interface MoveInput {
  dx: number;
  dy: number;
}

/**
 * Authoritative player movement step — PURE and deterministic given (pos, input, dt).
 *
 * This is the single source of truth for movement (§26 retro #3): the server runs it
 * every tick, and client-side prediction will run the SAME function later so the two
 * cannot diverge. Keep it free of side effects and engine/network types.
 *
 * Diagonal input is clamped to magnitude 1 — this both removes the diagonal speed bonus
 * and enforces the §7 "flat move speed" law, doubling as a §4 light anti-cheat check
 * (a client cannot request a faster-than-MOVE_SPEED step).
 */
export function stepPlayerMovement(
  pos: Vec2,
  input: MoveInput,
  dtSeconds: number,
  speed: number = MOVE_SPEED,
): Vec2 {
  let dx = input.dx;
  let dy = input.dy;

  const len = Math.hypot(dx, dy);
  if (len > 1) {
    dx /= len;
    dy /= len;
  }

  let x = pos.x + dx * speed * dtSeconds;
  let y = pos.y + dy * speed * dtSeconds;

  // §4 light server sanity check: clamp position to arena bounds.
  x = clamp(x, PLAYER_RADIUS, ARENA_WIDTH - PLAYER_RADIUS);
  y = clamp(y, PLAYER_RADIUS, ARENA_HEIGHT - PLAYER_RADIUS);

  return { x, y };
}

/** §20 momentum layer (Stage A). An impulse velocity that shoves the body. */
export interface Impulse {
  vx: number;
  vy: number;
}

/**
 * §7 v0.105 STEER a movement velocity toward the input's target — the "directional combination course
 * correction": instead of the body snapping to a new heading, its velocity blends exponentially toward
 * the target, so forward→up sweeps through the diagonal, key-taps ease in, and releases ease out. PURE +
 * deterministic + frame-rate independent (the exponential blend composes exactly: two 25ms steps ≡ one
 * 50ms step), so the server tick and (future) client prediction produce identical curves. The result is
 * hard-clamped to `speed` — steering shapes the TRANSITION, never the §7 flat-speed ceiling — and a
 * keys-released residual snaps to exactly 0 once negligible (the body fully settles, no ice-skating).
 */
export function steerVelocity(
  vel: Impulse,
  input: MoveInput,
  dtSeconds: number,
  speed: number = MOVE_SPEED,
): Impulse {
  let dx = input.dx;
  let dy = input.dy;
  const len = Math.hypot(dx, dy);
  if (len > 1) {
    dx /= len;
    dy /= len;
  }
  const tx = dx * speed;
  const ty = dy * speed;
  const idle = tx === 0 && ty === 0;
  const rate = idle ? MOVE_STEER_DECEL : MOVE_STEER_ACCEL;
  const k = 1 - Math.exp(-rate * dtSeconds);
  let vx = vel.vx + (tx - vel.vx) * k;
  let vy = vel.vy + (ty - vel.vy) * k;
  const sp = Math.hypot(vx, vy);
  if (sp > speed) {
    vx = (vx / sp) * speed;
    vy = (vy / sp) * speed;
  }
  if (idle && Math.hypot(vx, vy) < 1) {
    vx = 0;
    vy = 0;
  }
  return { vx, vy };
}

/**
 * §7 v0.105 one STEERED movement step: steer the velocity toward the input, integrate it, clamp to the
 * arena. The server's authoritative movement (replacing the old instant-velocity step); returns the new
 * velocity so the caller persists it per player. Same anti-cheat posture as before — the input magnitude
 * is clamped inside `steerVelocity` and the speed ceiling is hard. PURE.
 */
export function stepSteeredMovement(
  pos: Vec2,
  vel: Impulse,
  input: MoveInput,
  dtSeconds: number,
  speed: number = MOVE_SPEED,
): { x: number; y: number; vx: number; vy: number } {
  const v = steerVelocity(vel, input, dtSeconds, speed);
  return {
    x: clamp(pos.x + v.vx * dtSeconds, PLAYER_RADIUS, ARENA_WIDTH - PLAYER_RADIUS),
    y: clamp(pos.y + v.vy * dtSeconds, PLAYER_RADIUS, ARENA_HEIGHT - PLAYER_RADIUS),
    vx: v.vx,
    vy: v.vy,
  };
}

/**
 * Integrate an impulse shove into a position then decay it under exponential friction — PURE + deterministic.
 * The authoritative player position = the WASD base (`stepPlayerMovement`) PLUS this offset, so recoil /
 * knockback / (later) parry-launch read as weight without breaking input control. Clamps to the arena;
 * snaps sub-`IMPULSE_EPSILON` residuals to 0 so the shove fully settles. Same fn server + (future) client
 * prediction so the two can't diverge.
 */
export function stepImpulse(
  pos: Vec2,
  vel: Impulse,
  dtSeconds: number,
): { x: number; y: number; vx: number; vy: number } {
  const x = clamp(pos.x + vel.vx * dtSeconds, PLAYER_RADIUS, ARENA_WIDTH - PLAYER_RADIUS);
  const y = clamp(pos.y + vel.vy * dtSeconds, PLAYER_RADIUS, ARENA_HEIGHT - PLAYER_RADIUS);
  const decay = Math.exp(-IMPULSE_FRICTION * dtSeconds); // frame-rate-independent friction
  let vx = vel.vx * decay;
  let vy = vel.vy * decay;
  if (Math.abs(vx) < IMPULSE_EPSILON) vx = 0;
  if (Math.abs(vy) < IMPULSE_EPSILON) vy = 0;
  return { x, y, vx, vy };
}

/** Add an impulse to a velocity, capped at `IMPULSE_MAX` so a rapid-fire stream / pile-up can't fling a
 *  body across the arena. PURE. */
export function addImpulse(vel: Impulse, ix: number, iy: number): Impulse {
  let vx = vel.vx + ix;
  let vy = vel.vy + iy;
  const sp = Math.hypot(vx, vy);
  if (sp > IMPULSE_MAX) {
    vx = (vx / sp) * IMPULSE_MAX;
    vy = (vy / sp) * IMPULSE_MAX;
  }
  return { vx, vy };
}

/**
 * §5/§20 vertical physics (Stage B) — integrate a HEIGHT (px above ground) under an upward velocity `vh`
 * and gravity, landing (snap to 0) when it returns to the floor. PURE + deterministic. The jump seeds `vh`
 * with `JUMP_VELOCITY`; the later §8 parry-launch adds to it, so a chain of incoming hits can loft a player
 * higher and gravity reclaims them when it stops. `height > GROUND_EPSILON` = airborne (clears §17 pits).
 */
export function stepVertical(
  height: number,
  vh: number,
  dtSeconds: number,
): { height: number; vh: number } {
  const h = height + vh * dtSeconds;
  if (h <= 0) return { height: 0, vh: 0 }; // landed → rest on the ground
  return { height: h, vh: vh - GRAVITY * dtSeconds };
}
