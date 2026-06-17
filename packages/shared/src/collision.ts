import { ARENA_HEIGHT, ARENA_WIDTH, PLAYER_RADIUS } from "./constants.js";
import { clamp } from "./math.js";
import type { Vec2 } from "./movement.js";

/**
 * Resolve body-to-body overlap between circular bodies (§5: "body collision respected by
 * all objects — players block each other"). Pure + deterministic: the server runs it each
 * tick after movement integration so positions stay authoritative.
 *
 * Pushes each overlapping pair apart equally along their separating axis, a few relaxation
 * iterations for stability in clumps, then clamps everyone back inside the arena bounds.
 * Returns NEW positions (does not mutate the input).
 */
export function resolveBodyCollisions(
  bodies: readonly Vec2[],
  radius: number = PLAYER_RADIUS,
  iterations = 2,
): Vec2[] {
  const out: Vec2[] = bodies.map((b) => ({ x: b.x, y: b.y }));
  const minDist = radius * 2;

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i];
        const b = out[j];
        if (!a || !b) continue;

        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.hypot(dx, dy);
        if (dist === 0) {
          // Perfectly coincident — pick an arbitrary axis so they still separate.
          dx = 1;
          dy = 0;
          dist = 1;
        }
        if (dist < minDist) {
          const push = (minDist - dist) / 2;
          const nx = dx / dist;
          const ny = dy / dist;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
        }
      }
    }
  }

  for (const b of out) {
    b.x = clamp(b.x, radius, ARENA_WIDTH - radius);
    b.y = clamp(b.y, radius, ARENA_HEIGHT - radius);
  }
  return out;
}
