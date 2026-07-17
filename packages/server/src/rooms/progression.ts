import {
  type Attr,
  augmentGateForWeapon,
  classForCharacter,
  deriveStats,
  LEVEL_CAP,
  LEVELUP_WINDOW_SECONDS,
  type PlayerState,
  SIGNATURE_INTERVAL,
  WEAPONS,
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

/** Consume one pending flex point; close the window (or refresh its timer) accordingly. The window stays
 *  open while a §8 signature augment pick is ALSO owed, so the timer doesn't expire between picks. */
export function consumeFlex(player: PlayerState): void {
  player.flexPending = Math.max(0, player.flexPending - 1);
  player.flexTimer = player.flexPending > 0 || player.sigPending > 0 ? LEVELUP_WINDOW_SECONDS : 0;
}

/** Add XP to one player; each level reached (capped at 30) grants the §12 3-point allocation. */
export function levelUpPlayer(player: PlayerState, amount: number): void {
  if (player.level >= LEVEL_CAP) return;
  player.xp += amount;
  while (player.xp >= player.xpToNext && player.level < LEVEL_CAP) {
    player.xp -= player.xpToNext;
    player.level += 1;
    // 2 auto points: +1 class attr, +1 requirement attr (§12/§38). Which attrs depends on the worn
    // character's CLASS — a Bruiser grows STR+CON, a Caster INT+CON, a Scoundrel LUK+DEX, etc. Read live so
    // swapping character (C) re-aims future growth. The 3rd point is the FLEX pick.
    const cls = classForCharacter(player.character);
    allocate(player, cls.classAttr, 1);
    allocate(player, cls.reqAttr, 1);
    player.flexPending += 1;
    // §8 every 5th level ALSO grants a signature pick (an augment draft) — same window. The offer CSV is
    // rolled server-side once the window is open (GameRoom.openSigOffers).
    if (player.level % SIGNATURE_INTERVAL === 0) {
      player.sigPending += 1;
      // G-09: snapshot the earned signature lane now. A last-frame quick swap must not rewrite the draft.
      const gate = augmentGateForWeapon(WEAPONS[player.weapon]);
      player.sigGateQueue = player.sigGateQueue ? `${player.sigGateQueue};${gate}` : gate;
    }
    player.flexTimer = LEVELUP_WINDOW_SECONDS; // open/refresh the invincible pick window
    player.xpToNext = xpToNextLevel(player.level);
  }
  if (player.level >= LEVEL_CAP) player.xp = 0;
}
