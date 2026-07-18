import {
  type Attr,
  ATTRS,
  augmentGateForWeapon,
  BALLAST_POINTS_PER_LEVEL,
  ballastAttrFor,
  CHOSEN_POINTS_PER_LEVEL,
  deriveStats,
  LEVEL_CAP,
  LEVELUP_WINDOW_SECONDS,
  META_VITALITY_HP,
  type PlayerState,
  quirkForCharacter,
  SIGNATURE_INTERVAL,
  spreadAdjustedCon,
  WEAPONS,
  ULT_TEMPER_ALLOCS,
  ULT_UNLOCK_ALLOCS,
  UltimateFamily,
  ultimateCodeFor,
  ultimateFamilyAttr,
  ultimateRankingForAllocation,
  ultimateVariantForAllocation,
  xpToNextLevel,
  type MetaAccountV2,
  PET_MAX_BOND_XP,
  type PetId,
  petLevelForXp,
  petStageBandForLevel,
  sanitizeBondXp,
} from "@dd/shared";

/**
 * §12 authoritative player progression — pure mutations on a single PlayerState. Extracted from GameRoom
 * so the room keeps only the squad-level orchestration (grantXp iterates the roster, tickLevelWindows
 * counts down the pick window); the per-player level/allocation maths live here.
 */

/** Allocate `n` points into an attribute and re-derive maxHp (CON), topping up the gained HP. */
export function allocate(player: PlayerState, attr: Attr, n: number): void {
  player[attr] += n;
  if (n > 0) player.allocRun[attr] += n;
  const prevMax = player.maxHp;
  const derivedCon = player.spreadSeeded ? spreadAdjustedCon(player.con) : player.con;
  player.maxHp = deriveStats({ con: derivedCon }).maxHp + META_VITALITY_HP * player.upVitality;
  if (player.maxHp > prevMax) player.hp += player.maxHp - prevMax; // gain the new HP immediately
}

/** Resolve one level-up decision: +2 chosen, then +1 to the post-choice lowest attr (ATTRS tie order). */
export function applyAllocationChoice(player: PlayerState, attr: Attr): Attr {
  allocate(player, attr, CHOSEN_POINTS_PER_LEVEL);
  const quirk = quirkForCharacter(player.runCharacter || player.character);
  const ballast = ballastAttrFor(player, attr, quirk.mods?.ballastFollowsChoice === true);
  allocate(player, ballast, BALLAST_POINTS_PER_LEVEL);
  evaluateUltimateAllocation(player);
  return ballast;
}

/** Evaluate only after a complete +2/+1 decision. Family locks at 15; variant tempers at 30. */
export function evaluateUltimateAllocation(player: PlayerState): void {
  const total = ATTRS.reduce((sum, attr) => sum + player.allocRun[attr], 0);
  if (total < ULT_UNLOCK_ALLOCS) return;
  const runCharacter = player.runCharacter || player.character;
  if (player.ultFamily === UltimateFamily.Locked) {
    const [primary, secondary] = ultimateRankingForAllocation(player.allocRun, runCharacter, player);
    player.ultFamily = ATTRS.indexOf(primary) + 1;
    player.ultVariant = secondary;
  } else if (!player.ultTempered) {
    const familyAttr = ultimateFamilyAttr(player.ultFamily);
    const candidate = ultimateVariantForAllocation(
      player.allocRun,
      runCharacter,
      player,
      familyAttr,
    );
    if (
      !player.ultVariant ||
      (candidate !== player.ultVariant &&
        player.allocRun[candidate] >= player.allocRun[player.ultVariant] + 1)
    ) {
      player.ultVariant = candidate;
    }
  }
  if (total >= ULT_TEMPER_ALLOCS) player.ultTempered = true;
  player.ultArchetype = ultimateCodeFor(player.ultFamily, player.ultVariant || "str");
}

/** Consume one pending flex point; close the window (or refresh its timer) accordingly. The window stays
 *  open while a §8 signature augment pick is ALSO owed, so the timer doesn't expire between picks. */
export function consumeFlex(player: PlayerState): void {
  player.flexPending = Math.max(0, player.flexPending - 1);
  player.flexTimer = player.flexPending > 0 || player.sigPending > 0 ? LEVELUP_WINDOW_SECONDS : 0;
}

/** Add XP; each level reached owes one decision which later realizes all three attribute points. */
export function levelUpPlayer(player: PlayerState, amount: number): void {
  if (player.level >= LEVEL_CAP) return;
  player.xp += amount;
  while (player.xp >= player.xpToNext && player.level < LEVEL_CAP) {
    player.xp -= player.xpToNext;
    player.level += 1;
    // §classmerge: no class-biased auto-growth. One pending decision resolves +2 chosen +1 ballast.
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

export interface PetBondBankResult {
  earnedBondXp: number;
  awardedBondXp: number;
  oldBondXp: number;
  newBondXp: number;
  oldLevel: number;
  newLevel: number;
  oldStageBand: 1 | 2 | 3;
  newStageBand: 1 | 2 | 3;
  reachedCapstone: boolean;
}

/** Bank one terminal run receipt into the selected owned pet. Account revision/other mutations stay atomic
 * at the caller's settlement seam; this helper owns only clamped Bond XP and its derived presentation. */
export function bankPetBondXp(
  account: MetaAccountV2,
  petId: PetId,
  value: unknown,
): PetBondBankResult {
  const pet = account.pets[petId];
  const oldBondXp = sanitizeBondXp(pet?.bondXp);
  const numeric = Number(value);
  const earnedBondXp = Number.isFinite(numeric)
    ? Math.max(0, Math.min(500, Math.floor(numeric)))
    : 0;
  const oldLevel = petLevelForXp(oldBondXp);
  const newBondXp = pet
    ? Math.min(PET_MAX_BOND_XP, oldBondXp + earnedBondXp)
    : oldBondXp;
  if (pet) pet.bondXp = newBondXp;
  const newLevel = petLevelForXp(newBondXp);
  return {
    earnedBondXp,
    awardedBondXp: newBondXp - oldBondXp,
    oldBondXp,
    newBondXp,
    oldLevel,
    newLevel,
    oldStageBand: petStageBandForLevel(oldLevel),
    newStageBand: petStageBandForLevel(newLevel),
    reachedCapstone: oldLevel < 10 && newLevel === 10,
  };
}

// Ultimate-wave ordering note: its planned `allocFlex` counter becomes total `allocRun`; every point applied
// by applyAllocationChoice (including timeout/ballast) counts. Retune ULT_UNLOCK_ALLOCS ×3 (about 15/30)
// there, not in 21a: the ultimate state and constants do not exist in this wave.
