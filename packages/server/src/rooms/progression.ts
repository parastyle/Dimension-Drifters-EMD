import {
  type Attr,
  deriveStats,
  LEVEL_CAP,
  LEVELUP_WINDOW_SECONDS,
  M0_CLASS_ATTR,
  M0_REQ_ATTR,
  type PlayerState,
  xpToNextLevel,
} from "@dd/shared";

/**
 * §12 authoritative player progression — pure mutations on a single PlayerState. Extracted from GameRoom
 * so the room keeps only the squad-level orchestration (grantXp iterates the roster, tickLevelWindows
 * counts down the pick window); the per-player level/allocation maths live here.
 */

/** Allocate `n` points into an attribute and re-derive maxHp (CON), topping up the gained HP. */
export function allocate(player: PlayerState, attr: Attr, n: number): void {
  player[attr] += n;
  const prevMax = player.maxHp;
  player.maxHp = deriveStats(player).maxHp;
  if (player.maxHp > prevMax) player.hp += player.maxHp - prevMax; // gain the new HP immediately
}

/** Consume one pending flex point; close the window (or refresh its timer) accordingly. */
export function consumeFlex(player: PlayerState): void {
  player.flexPending = Math.max(0, player.flexPending - 1);
  player.flexTimer = player.flexPending > 0 ? LEVELUP_WINDOW_SECONDS : 0;
}

/** Add XP to one player; each level reached (capped at 30) grants the §12 3-point allocation. */
export function levelUpPlayer(player: PlayerState, amount: number): void {
  if (player.level >= LEVEL_CAP) return;
  player.xp += amount;
  while (player.xp >= player.xpToNext && player.level < LEVEL_CAP) {
    player.xp -= player.xpToNext;
    player.level += 1;
    // 2 auto points: +1 class attr, +1 requirement attr (§12). The 3rd is the FLEX pick.
    allocate(player, M0_CLASS_ATTR, 1);
    allocate(player, M0_REQ_ATTR, 1);
    player.flexPending += 1;
    player.flexTimer = LEVELUP_WINDOW_SECONDS; // open/refresh the invincible pick window
    player.xpToNext = xpToNextLevel(player.level);
  }
  if (player.level >= LEVEL_CAP) player.xp = 0;
}
