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
  ultimateRankingForRunAllocation,
  ultimateVariantForAllocation,
  ultimateVariantForRunAllocation,
  xpToNextLevel,
  type MetaAccount,
  type MetaAccountV4,
  PET_MAX_BOND_XP,
  type PetId,
  petLevelForXp,
  petStageBandForLevel,
  sanitizeBondXp,
  META_ACCOUNT_REVISION_MAX,
  META_ACCOUNT_SCRIP_MAX,
  sanitizeWeaponBankV1,
  scripValue,
  weaponEntryInstances,
  weaponEntryMinimumWorldTier,
  weaponEntryPhysicalSize,
  weaponRarityIndex,
  WEAPON_ACTIVE_CAPACITY,
  WEAPON_CARRY_MAX_PHYSICAL,
  WEAPON_PACK_MAX_CAPACITY,
  WEAPON_STASH_BASE_CAPACITY,
  WEAPON_STASH_MAX_SHELVES,
  WEAPON_STASH_SHELF_SIZE,
  type CarrySelectionV1,
  type ExpeditionEntryV1,
  type WeaponBankEntryV1,
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
  player.maxHp =
    deriveStats({ con: derivedCon }).maxHp +
    META_VITALITY_HP * player.upVitality +
    player.gearMaxHpAdd;
  if (player.maxHp > prevMax) player.hp += player.maxHp - prevMax; // gain the new HP immediately
}

/** Resolve one level-up decision: +2 chosen, then +1 to the post-choice lowest attr (ATTRS tie order). */
export function applyAllocationChoice(player: PlayerState, attr: Attr): Attr {
  allocate(player, attr, CHOSEN_POINTS_PER_LEVEL);
  const followsChoice = player.gearSeeded
    ? player.identityBallastFollowsChoice
    : quirkForCharacter(player.runCharacter || player.character).mods?.ballastFollowsChoice === true;
  const ballast = ballastAttrFor(player, attr, followsChoice);
  allocate(player, ballast, BALLAST_POINTS_PER_LEVEL);
  evaluateUltimateAllocation(player);
  return ballast;
}

/** Evaluate only after a complete +2/+1 decision. Family locks at 15; variant tempers at 30. */
export function evaluateUltimateAllocation(player: PlayerState): void {
  const total = ATTRS.reduce((sum, attr) => sum + player.allocRun[attr], 0);
  if (total < ULT_UNLOCK_ALLOCS) return;
  if (player.ultFamily === UltimateFamily.Locked) {
    const [primary, secondary] = player.gearSeeded
      ? ultimateRankingForRunAllocation(player.allocRun)
      : ultimateRankingForAllocation(
          player.allocRun,
          player.runCharacter || player.character,
          player,
        );
    player.ultFamily = ATTRS.indexOf(primary) + 1;
    player.ultVariant = secondary;
  } else if (!player.ultTempered) {
    const familyAttr = ultimateFamilyAttr(player.ultFamily);
    const candidate = player.gearSeeded
      ? ultimateVariantForRunAllocation(player.allocRun, familyAttr)
      : ultimateVariantForAllocation(
          player.allocRun,
          player.runCharacter || player.character,
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
  account: MetaAccount,
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

export type WeaponBankTransactionError =
  | "invalid-account"
  | "invalid-request"
  | "stale-revision"
  | "intake-blocked"
  | "expedition-active"
  | "missing-entry"
  | "duplicate-entry"
  | "placement-overlap"
  | "placement-bounds"
  | "active-entry"
  | "world-tier"
  | "no-expedition"
  | "prestige-cap";

export interface CarryCommitResult {
  ok: boolean;
  error?: WeaponBankTransactionError;
  runTier: number;
  movedEntries: number;
  movedPhysical: number;
}

export interface WeaponSettlementResult {
  ok: boolean;
  error?: WeaponBankTransactionError;
  outcome: "victory" | "defeat";
  returnedEntries: number;
  returnedPhysical: number;
  intakeEntries: number;
  lostEntries: number;
  lostPhysical: number;
}

export interface StashSaleRequest {
  requestId: string;
  expectedRevision: number;
  entryId: string;
  from: "stash" | "intake";
}

export interface StashSaleResult {
  ok: boolean;
  error?: WeaponBankTransactionError;
  entryId: string;
  payout: number;
  revision: number;
}

function bumpMetaRevision(account: MetaAccountV4): void {
  account.revision = Math.min(META_ACCOUNT_REVISION_MAX, account.revision + 1);
}

function isBoundedRequestId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 64 && /^[\x21-\x7e]+$/.test(value);
}

export function weaponBankStashCapacity(account: Pick<MetaAccountV4, "weaponBank">): number {
  const shelves = Math.max(
    0,
    Math.min(WEAPON_STASH_MAX_SHELVES, Math.floor(account.weaponBank.shelfUpgrades)),
  );
  return WEAPON_STASH_BASE_CAPACITY + WEAPON_STASH_SHELF_SIZE * shelves;
}

export function weaponBankEntrySaleValue(entry: WeaponBankEntryV1): number {
  let value = 0;
  for (const instance of weaponEntryInstances(entry)) {
    const rarity = weaponRarityIndex(instance.rarity);
    if (rarity < 0) return 0;
    value += scripValue(rarity, true);
  }
  return value;
}

/** Atomic Stash -> expedition move. No selected instance remains safe after this succeeds. */
export function commitWeaponCarry(
  account: MetaAccountV4,
  selection: CarrySelectionV1,
  runId: string,
  packCapacity: number,
  lobbyWorldTier = 0,
): CarryCommitResult {
  const invalid = (error: WeaponBankTransactionError): CarryCommitResult => ({
    ok: false,
    error,
    runTier: Math.max(account.prestige, lobbyWorldTier),
    movedEntries: 0,
    movedPhysical: 0,
  });
  if (!sanitizeWeaponBankV1(account.weaponBank).ok) return invalid("invalid-account");
  if (!isBoundedRequestId(selection?.requestId) || !isBoundedRequestId(runId)) return invalid("invalid-request");
  if (!Number.isInteger(selection.expectedRevision) || selection.expectedRevision !== account.revision) {
    return invalid("stale-revision");
  }
  if (account.weaponBank.intake.length > 0) return invalid("intake-blocked");
  if (account.weaponBank.expedition) return invalid("expedition-active");
  if (!Array.isArray(selection.placements) || selection.placements.length > WEAPON_CARRY_MAX_PHYSICAL) {
    return invalid("invalid-request");
  }
  const packCap = Math.max(0, Math.min(WEAPON_PACK_MAX_CAPACITY, Math.floor(packCapacity)));
  const byEntry = new Map<string, WeaponBankEntryV1>();
  for (const entry of account.weaponBank.stash) byEntry.set(entry.entryId, entry);
  const selected = new Set<string>();
  const active = new Uint8Array(WEAPON_ACTIVE_CAPACITY);
  const pack = new Uint8Array(packCap);
  const entries: ExpeditionEntryV1[] = [];
  let physical = 0;
  let requiredTier = Math.max(account.prestige, Math.floor(lobbyWorldTier));
  for (const placement of selection.placements) {
    if (!placement || typeof placement.entryId !== "string" || selected.has(placement.entryId)) {
      return invalid("duplicate-entry");
    }
    const entry = byEntry.get(placement.entryId);
    if (!entry) return invalid("missing-entry");
    if (placement.zone !== "active" && placement.zone !== "pack") return invalid("invalid-request");
    if (!Number.isInteger(placement.start)) return invalid("placement-bounds");
    const span = weaponEntryPhysicalSize(entry);
    const cells = placement.zone === "active" ? active : pack;
    if (placement.start < 0 || placement.start + span > cells.length) return invalid("placement-bounds");
    for (let cell = placement.start; cell < placement.start + span; cell++) {
      if (cells[cell]) return invalid("placement-overlap");
      cells[cell] = 1;
    }
    selected.add(entry.entryId);
    physical += span;
    requiredTier = Math.max(requiredTier, weaponEntryMinimumWorldTier(entry));
    entries.push({
      entry,
      stakeOrigin: "committed",
      location: placement.zone,
      start: placement.start,
    });
  }
  if (physical > WEAPON_ACTIVE_CAPACITY + packCap) return invalid("placement-bounds");
  if (
    selection.activeEntryId !== "" &&
    !entries.some((row) => row.entry.entryId === selection.activeEntryId && row.location === "active")
  ) return invalid("active-entry");
  if (!Number.isInteger(selection.requestedWorldTier) || selection.requestedWorldTier < requiredTier || selection.requestedWorldTier > 30) {
    return invalid("world-tier");
  }

  account.weaponBank.stash = account.weaponBank.stash.filter((entry) => !selected.has(entry.entryId));
  account.weaponBank.lastCarry = {
    placements: selection.placements.map((placement) => ({ ...placement })),
    activeEntryId: selection.activeEntryId,
  };
  account.weaponBank.expedition = {
    runId,
    commitRevision: account.revision,
    status: "committed",
    entries,
  };
  bumpMetaRevision(account);
  return {
    ok: true,
    runTier: selection.requestedWorldTier,
    movedEntries: entries.length,
    movedPhysical: physical,
  };
}

/** Close escrow once. Victory returns carried entries; defeat destroys the full active/pack/field stake. */
export function settleWeaponExpedition(
  account: MetaAccountV4,
  outcome: "victory" | "defeat",
  advanceRevision = true,
): WeaponSettlementResult {
  const expedition = account.weaponBank.expedition;
  if (!expedition) {
    return {
      ok: false,
      error: "no-expedition",
      outcome,
      returnedEntries: 0,
      returnedPhysical: 0,
      intakeEntries: 0,
      lostEntries: 0,
      lostPhysical: 0,
    };
  }
  let returnedEntries = 0;
  let returnedPhysical = 0;
  let lostEntries = 0;
  let lostPhysical = 0;
  if (outcome === "victory") {
    const capacity = weaponBankStashCapacity(account);
    for (const row of expedition.entries) {
      const physical = weaponEntryPhysicalSize(row.entry);
      if (row.location === "field") {
        lostEntries++;
        lostPhysical += physical;
        continue;
      }
      if (account.weaponBank.stash.length < capacity) account.weaponBank.stash.push(row.entry);
      else account.weaponBank.intake.push(row.entry);
      returnedEntries++;
      returnedPhysical += physical;
    }
  } else {
    lostEntries = expedition.entries.length;
    for (const row of expedition.entries) lostPhysical += weaponEntryPhysicalSize(row.entry);
  }
  account.weaponBank.expedition = null;
  if (advanceRevision) bumpMetaRevision(account);
  return {
    ok: true,
    outcome,
    returnedEntries,
    returnedPhysical,
    intakeEntries: account.weaponBank.intake.length,
    lostEntries,
    lostPhysical,
  };
}

/** Irreversible safe-location conversion. The exact entry disappears before Scrip is credited. */
export function sellWeaponBankEntry(
  account: MetaAccountV4,
  request: StashSaleRequest,
  advanceRevision = true,
): StashSaleResult {
  const fail = (error: WeaponBankTransactionError): StashSaleResult => ({
    ok: false,
    error,
    entryId: typeof request?.entryId === "string" ? request.entryId : "",
    payout: 0,
    revision: account.revision,
  });
  if (!sanitizeWeaponBankV1(account.weaponBank).ok) return fail("invalid-account");
  if (!isBoundedRequestId(request?.requestId) || !isBoundedRequestId(request?.entryId)) return fail("invalid-request");
  if (request.expectedRevision !== account.revision) return fail("stale-revision");
  if (account.weaponBank.expedition) return fail("expedition-active");
  const location = request.from === "stash"
    ? account.weaponBank.stash
    : request.from === "intake"
      ? account.weaponBank.intake
      : null;
  if (!location) return fail("invalid-request");
  const index = location.findIndex((entry) => entry.entryId === request.entryId);
  if (index < 0) return fail("missing-entry");
  const entry = location[index]!;
  const payout = weaponBankEntrySaleValue(entry);
  if (payout <= 0) return fail("invalid-account");
  location.splice(index, 1);
  account.scrip = Math.min(META_ACCOUNT_SCRIP_MAX, account.scrip + payout);
  account.weaponBank.lastCarry.placements = account.weaponBank.lastCarry.placements.filter(
    (placement) => placement.entryId !== entry.entryId,
  );
  if (account.weaponBank.lastCarry.activeEntryId === entry.entryId) {
    account.weaponBank.lastCarry.activeEntryId = "";
  }
  if (advanceRevision) bumpMetaRevision(account);
  return { ok: true, entryId: entry.entryId, payout, revision: account.revision };
}

/** Prestige hook for the later hat-tower wave: all weapon power goes, permanent journey state stays. */
export function wipeWeaponBankForPrestige(
  account: MetaAccountV4,
  advanceRevision = true,
): { ok: boolean; error?: WeaponBankTransactionError; removedEntries: number; removedPhysical: number } {
  if (account.weaponBank.expedition) {
    return { ok: false, error: "expedition-active", removedEntries: 0, removedPhysical: 0 };
  }
  if (account.prestige >= 30) {
    return { ok: false, error: "prestige-cap", removedEntries: 0, removedPhysical: 0 };
  }
  let removedPhysical = 0;
  for (const entry of account.weaponBank.stash) removedPhysical += weaponEntryPhysicalSize(entry);
  for (const entry of account.weaponBank.intake) removedPhysical += weaponEntryPhysicalSize(entry);
  const removedEntries = account.weaponBank.stash.length + account.weaponBank.intake.length;
  account.weaponBank.stash = [];
  account.weaponBank.intake = [];
  account.weaponBank.lastCarry = { placements: [], activeEntryId: "" };
  account.prestige++;
  if (advanceRevision) bumpMetaRevision(account);
  return { ok: true, removedEntries, removedPhysical };
}

// Ultimate-wave ordering note: its planned `allocFlex` counter becomes total `allocRun`; every point applied
// by applyAllocationChoice (including timeout/ballast) counts. Retune ULT_UNLOCK_ALLOCS ×3 (about 15/30)
// there, not in 21a: the ultimate state and constants do not exist in this wave.
