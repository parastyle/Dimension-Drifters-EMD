import { ARENA_HEIGHT, ARENA_WIDTH, MOVE_SPEED, PLAYER_RADIUS } from "./constants.js";
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
