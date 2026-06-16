/**
 * Pure combat geometry shared by the authoritative server AND the client VFX (§10/§14). Extracting
 * these means the server's damage and the client's predicted VFX run the SAME math — they cannot
 * diverge (the project's "one shared function" law). No engine/network types.
 */
import type { Vec2 } from "./movement.js";

/** A chain / nearest-target candidate: a position with a stable id (enemy id). */
export interface ChainCandidate {
  id: string;
  x: number;
  y: number;
}

/**
 * Greedy CHAIN-LIGHTNING target selection. Starting from `seed`, repeatedly pick the NEAREST candidate
 * that is (a) not already used and (b) within `hopRange` of the previous link — up to `jumps` times.
 * `exclude` seeds the used-set (e.g. the enemies the swing arc already hit, so the chain leaps to
 * OTHERS). Returns the picked candidates in link order; stops early when no candidate is in range.
 * PURE — the server applies damage to the result, the client draws bolts to it, off the same selection.
 */
export function selectChainTargets(
  seed: Vec2,
  candidates: readonly ChainCandidate[],
  jumps: number,
  hopRange: number,
  exclude?: ReadonlySet<string>,
): ChainCandidate[] {
  const used = new Set<string>(exclude ?? []);
  const hopR2 = hopRange * hopRange;
  const picked: ChainCandidate[] = [];
  let fromX = seed.x;
  let fromY = seed.y;
  for (let n = 0; n < jumps; n++) {
    let best: ChainCandidate | undefined;
    let bestD = Number.POSITIVE_INFINITY;
    for (const c of candidates) {
      if (used.has(c.id)) continue;
      const d = (c.x - fromX) ** 2 + (c.y - fromY) ** 2;
      if (d <= hopR2 && d < bestD) {
        bestD = d;
        best = c;
      }
    }
    if (!best) break; // no unused candidate in range → chain ends
    used.add(best.id);
    picked.push(best);
    fromX = best.x;
    fromY = best.y;
  }
  return picked;
}

/**
 * Clamp a slam/quake EPICENTER (the cursor target) to within `reach` px of the player — "you slam
 * where you aim, within reach" (§9). PURE — server + client compute the IDENTICAL epicenter so the
 * damage AoE and the VFX line up (§14).
 */
export function clampQuakeEpicenter(player: Vec2, target: Vec2, reach: number): Vec2 {
  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const dist = Math.hypot(dx, dy);
  if (dist > reach) {
    return { x: player.x + (dx / dist) * reach, y: player.y + (dy / dist) * reach };
  }
  return { x: target.x, y: target.y };
}
