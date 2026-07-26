import {
  createMetaAccountV2,
  createMetaAccountV5,
  EMPTY_META,
  type MetaAccountV5,
  PET_BOND_XP_THRESHOLDS,
  PET_CATALOG,
  PET_STAGE_DEFS,
  type PetId,
  type PetProgressReceipt,
  petLevelForXp,
  petModsForLevel,
  petStageBandForLevel,
  sanitizeMetaAccountV5,
  sanitizeMetaLevels,
} from "@dd/shared";

export const PET_META_STORAGE_KEY = "dd.metaAccount.v5";
export const PET_ACCOUNT_ID_STORAGE_KEY = "dd.accountId.v1";
const LEGACY_V4_META_STORAGE_KEY = "dd.metaAccount.v4";
const LEGACY_PET_META_STORAGE_KEY = "dd.metaAccount.v2";
const PET_ACCOUNT_ID_PATTERN = /^acct_[A-Za-z0-9_-]{16,80}$/;

export class MetaAccountStorageError extends Error {
  constructor(operation: "identity" | "write" | "verify", cause?: unknown) {
    super(`Account cache ${operation} failed`, { cause });
    this.name = "MetaAccountStorageError";
  }
}

/** Stable browser identity only. Money, unlocks, escrow, and receipts live in the server's SQLite store. */
export function loadOrCreatePetAccountId(): string {
  let existing: string | null;
  try {
    existing = localStorage.getItem(PET_ACCOUNT_ID_STORAGE_KEY);
  } catch (error) {
    throw new MetaAccountStorageError("identity", error);
  }
  if (existing && PET_ACCOUNT_ID_PATTERN.test(existing)) return existing;
  const accountId = `acct_${crypto.randomUUID().replaceAll("-", "")}`;
  try {
    localStorage.setItem(PET_ACCOUNT_ID_STORAGE_KEY, accountId);
    if (localStorage.getItem(PET_ACCOUNT_ID_STORAGE_KEY) !== accountId) {
      throw new MetaAccountStorageError("verify");
    }
  } catch (error) {
    if (error instanceof MetaAccountStorageError) throw error;
    throw new MetaAccountStorageError("identity", error);
  }
  return accountId;
}

export interface PetSelectionView {
  id: PetId;
  name: string;
  owned: boolean;
  selected: boolean;
  level: number;
  stage: string;
  bondXp: number;
  nextBondXp: number | null;
  bonus: string;
  capstone: string;
}

function legacyMetaAccount(): MetaAccountV5 {
  const account = createMetaAccountV2();
  try {
    const rawScrip = Number.parseInt(localStorage.getItem("dd.beltScrip") ?? "0", 10);
    account.scrip = Number.isFinite(rawScrip) ? Math.max(0, Math.min(65_535, rawScrip)) : 0;
    account.upgrades = sanitizeMetaLevels(
      JSON.parse(localStorage.getItem("dd.beltUpgrades") ?? "{}"),
    );
  } catch {
    account.upgrades = { ...EMPTY_META };
  }
  return sanitizeMetaAccountV5(account);
}

/** Local/offline account cache. A corrupt or blocked store always falls back to the starter companion. */
export function loadPetMetaAccount(): MetaAccountV5 {
  try {
    const raw = localStorage.getItem(PET_META_STORAGE_KEY);
    if (raw) return sanitizeMetaAccountV5(JSON.parse(raw));
    const legacy =
      localStorage.getItem(LEGACY_V4_META_STORAGE_KEY) ??
      localStorage.getItem(LEGACY_PET_META_STORAGE_KEY);
    const migrated = legacy ? sanitizeMetaAccountV5(JSON.parse(legacy)) : legacyMetaAccount();
    savePetMetaAccount(migrated);
    return migrated;
  } catch {
    return createMetaAccountV5();
  }
}

/** Cache a server-authored replacement atomically and verify it; callers must surface any failure. */
export function savePetMetaAccount(value: unknown): MetaAccountV5 {
  const account = sanitizeMetaAccountV5(value);
  const serialized = JSON.stringify(account);
  try {
    localStorage.setItem(PET_META_STORAGE_KEY, serialized);
  } catch (error) {
    throw new MetaAccountStorageError("write", error);
  }
  try {
    if (localStorage.getItem(PET_META_STORAGE_KEY) !== serialized) {
      throw new MetaAccountStorageError("verify");
    }
  } catch (error) {
    if (error instanceof MetaAccountStorageError) throw error;
    throw new MetaAccountStorageError("verify", error);
  }
  return account;
}

export function selectPet(account: MetaAccountV5, petId: PetId | ""): MetaAccountV5 {
  const next = sanitizeMetaAccountV5(account);
  if (petId === "" || next.pets[petId]) next.selectedPetId = petId;
  return savePetMetaAccount(next);
}

function petBonusCopy(id: PetId, level: number): readonly [string, string] {
  const mods = petModsForLevel(id, level);
  const next = petModsForLevel(id, Math.min(10, level + 1));
  const nextCopy = (value: string): string => (level < 10 ? ` · Next: ${value}` : " · Maxed");
  switch (id) {
    case "verdant-wing":
      return [
        `HP regeneration ×${mods.passiveRegenMultiplier.toFixed(2)}${nextCopy(
          `×${next.passiveRegenMultiplier.toFixed(2)}`,
        )}`,
        "Level 10: +1 use before gun reload / thrown refill",
      ];
    case "hearth-newt":
      return [
        `Healing received ×${mods.healingReceivedMultiplier.toFixed(2)}${nextCopy(
          `×${next.healingReceivedMultiplier.toFixed(2)}`,
        )}`,
        "Level 10: heal 15% max HP on descent",
      ];
    case "lodestar-moth":
      return [
        `Money-drop reach ${180 + mods.moneyDropReachAdd}px${nextCopy(`${180 + next.moneyDropReachAdd}px`)}`,
        "Level 10: sweep nearby money at run boundaries",
      ];
    case "copper-snail":
      return [
        `Earned-weapon pickup reach ${mods.earnedPickupRadius}px${nextCopy(
          `${next.earnedPickupRadius}px`,
        )}`,
        "Level 10: thirteenth Backpack row",
      ];
    case "gilded-gecko":
      return [
        "Archived economy perk · no in-run effect",
        "Disassembly values stay fixed for every pet",
      ];
    case "brass-crab":
      return [
        `Reload / refill duration ×${mods.reloadDurationMultiplier.toFixed(2)}${nextCopy(
          `×${next.reloadDurationMultiplier.toFixed(2)}`,
        )}`,
        "Level 10: stowed reload / refill debt ×1.25",
      ];
    case "pale-firefly":
      return [
        `Revive-effect reach ${96 + mods.reviveReachAdd}px${nextCopy(
          `${96 + next.reviveReachAdd}px`,
        )}`,
        "Level 10: allies return at 40% HP",
      ];
    case "slate-tortoise":
      return [
        `Pit / ground-hazard damage ×${mods.groundHazardDamageMultiplier.toFixed(3)}${nextCopy(
          `×${next.groundHazardDamageMultiplier.toFixed(3)}`,
        )}`,
        "Level 10: post-pit regeneration ×1.5 for 3s",
      ];
  }
}

export function petSelectionView(account: MetaAccountV5, id: PetId): PetSelectionView {
  const persisted = account.pets[id];
  const bondXp = persisted?.bondXp ?? 0;
  const level = petLevelForXp(bondXp);
  const stageBand = petStageBandForLevel(level);
  const stage = PET_STAGE_DEFS[stageBand - 1]?.name ?? "Hatchling";
  const [bonus, capstone] = petBonusCopy(id, level);
  return {
    id,
    name: PET_CATALOG[id].name,
    owned: persisted !== undefined,
    selected: account.selectedPetId === id,
    level,
    stage,
    bondXp,
    nextBondXp: level >= 10 ? null : (PET_BOND_XP_THRESHOLDS[level] ?? null),
    bonus,
    capstone,
  };
}

export function formatPetProgressReceipt(receipt: PetProgressReceipt): string {
  const name = PET_CATALOG[receipt.petId].name;
  const level =
    receipt.oldLevel === receipt.newLevel
      ? `Level ${receipt.newLevel}`
      : `Level ${receipt.oldLevel} → ${receipt.newLevel}`;
  return `${name} +${receipt.awardedBondXp} Bond XP · ${level}`;
}

export function petEvolutionLabel(receipt: PetProgressReceipt): string {
  if (receipt.reachedCapstone && receipt.oldStageBand === receipt.newStageBand)
    return `${PET_CATALOG[receipt.petId].name.toUpperCase()} · ASCENDANT CORE LIT`;
  const stage = PET_STAGE_DEFS[receipt.newStageBand - 1]?.name ?? "Ascendant";
  return `${PET_CATALOG[receipt.petId].name.toUpperCase()} · ${stage.toUpperCase()}`;
}
