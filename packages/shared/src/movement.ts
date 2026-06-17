import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  IMPULSE_EPSILON,
  IMPULSE_FRICTION,
  IMPULSE_MAX,
  MOVE_SPEED,
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
