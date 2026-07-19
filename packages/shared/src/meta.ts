/**
 * §31 v0.118 META-PROGRESSION — permanent upgrades bought with belt SCRIP (the "send stuff back" sink).
 * Pure + data-driven: the catalog, next-level cost, and stat application live here so the server (buy +
 * apply-on-spawn) and the client (shop UI + persistence) share one source of truth. Levels persist across
 * runs (client localStorage bank today; a server/account store can replace the transport without touching
 * this). Kept deliberately small — three legible tracks, three levels each.
 */

export type MetaUpgradeId = "vitality" | "fortune" | "power";

export interface MetaUpgrade {
  id: MetaUpgradeId;
  name: string;
  /** One-line effect per level, for the shop UI. */
  desc: string;
  maxLevel: number;
  /** Scrip cost to buy each successive level (index 0 = 1st level). */
  costs: readonly number[];
}

export const META_UPGRADES: readonly MetaUpgrade[] = [
  { id: "vitality", name: "Vitality", desc: "+20 max HP", maxLevel: 3, costs: [30, 70, 140] },
  {
    id: "fortune",
    name: "Fortune",
    desc: "+1 LUK — better loot & crits",
    maxLevel: 3,
    costs: [40, 90, 180],
  },
  { id: "power", name: "Power", desc: "+1 STR — melee damage", maxLevel: 3, costs: [45, 100, 200] },
];

/** Per-level stat deltas applied to a fresh player. */
export const META_VITALITY_HP = 20;
export const META_FORTUNE_LUK = 1;
export const META_POWER_STR = 1;

/** Owned levels of each upgrade (0 = unpurchased). The persisted "account". */
export interface MetaLevels {
  vitality: number;
  fortune: number;
  power: number;
}

export const EMPTY_META: MetaLevels = { vitality: 0, fortune: 0, power: 0 };

/** Clamp arbitrary (client-supplied) input into a valid MetaLevels — each level bounded by its catalog max. */
export function sanitizeMetaLevels(input: unknown): MetaLevels {
  const src = (input ?? {}) as Partial<Record<MetaUpgradeId, unknown>>;
  const lvl = (id: MetaUpgradeId): number => {
    const max = META_UPGRADES.find((u) => u.id === id)?.maxLevel ?? 0;
    const v = Math.floor(Number(src[id]));
    return Number.isFinite(v) ? Math.max(0, Math.min(max, v)) : 0;
  };
  return { vitality: lvl("vitality"), fortune: lvl("fortune"), power: lvl("power") };
}

/** Scrip cost to buy the NEXT level of `id` given the current level, or null if already maxed. PURE. */
export function nextUpgradeCost(id: MetaUpgradeId, currentLevel: number): number | null {
  const u = META_UPGRADES.find((x) => x.id === id);
  if (!u || currentLevel >= u.maxLevel) return null;
  return u.costs[currentLevel] ?? null;
}

// Pet APIs are re-exported through meta so the package's existing public index remains stable in P1.
export * from "./pets.js";

import {
  createWeaponBankV1,
  sanitizeWeaponBankV1,
  type WeaponBankSanitizeResult,
  type WeaponBankV1,
} from "./bank.js";
import {
  GEAR_CATALOG,
  GEAR_IDS,
  type GearId,
  type GearSlot,
  isGearId,
  STARTER_GEAR_IDS,
  STARTER_GEAR_LOADOUT,
  sanitizeEquippedGear,
  torsoForLegacyPants,
} from "./gear.js";
import { isPetId, PET_IDS, type PetId, type PetStageBand, sanitizeBondXp } from "./pets.js";

export interface PersistedPet {
  /** Lifetime total. Presence of the canonical id in `pets` is the ownership bit. */
  bondXp: number;
}

export interface MetaAccountV2 {
  version: 2;
  revision: number;
  scrip: number;
  upgrades: MetaLevels;
  pets: Partial<Record<PetId, PersistedPet>>;
  /** Empty is the explicit accessibility "No pet" selection. */
  selectedPetId: PetId | "";
  slateTortoisePityMisses: number;
}

export interface MetaAccountV3 {
  version: 3;
  revision: number;
  scrip: number;
  pets: Partial<Record<PetId, PersistedPet>>;
  selectedPetId: PetId | "";
  slateTortoisePityMisses: number;
  ownedGear: GearId[];
  equippedGear: Record<GearSlot, GearId>;
}

export interface MetaAccountV4 {
  version: 4;
  revision: number;
  scrip: number;
  pets: Partial<Record<PetId, PersistedPet>>;
  selectedPetId: PetId | "";
  slateTortoisePityMisses: number;
  ownedGear: GearId[];
  equippedGear: Record<GearSlot, GearId>;
  /** Prestige count is also progression World Tier. Hat-tower composition arrives in a later wave. */
  prestige: number;
  weaponBank: WeaponBankV1;
}

export type MetaAccount = MetaAccountV2 | MetaAccountV3 | MetaAccountV4;

export type PetTerminalOutcome = "victory" | "defeat";

export interface PetProgressReceipt {
  petId: PetId;
  outcome: PetTerminalOutcome;
  earnedBondXp: number;
  awardedBondXp: number;
  oldBondXp: number;
  newBondXp: number;
  oldLevel: number;
  newLevel: number;
  oldStageBand: PetStageBand;
  newStageBand: PetStageBand;
  reachedCapstone: boolean;
  slateTortoiseAwarded: boolean;
}

export const META_ACCOUNT_V2_VERSION = 2 as const;
export const META_ACCOUNT_V3_VERSION = 3 as const;
export const META_ACCOUNT_VERSION = 4 as const;
export const META_ACCOUNT_SCRIP_MAX = 65535 as const;
export const META_ACCOUNT_REVISION_MAX = 0xffffffff as const;
export const STARTER_PET_ID: PetId = "verdant-wing";

export function createMetaAccountV2(): MetaAccountV2 {
  return {
    version: META_ACCOUNT_V2_VERSION,
    revision: 0,
    scrip: 0,
    upgrades: { ...EMPTY_META },
    pets: { [STARTER_PET_ID]: { bondXp: 0 } },
    selectedPetId: STARTER_PET_ID,
    slateTortoisePityMisses: 0,
  };
}

export function createMetaAccountV3(): MetaAccountV3 {
  return {
    version: META_ACCOUNT_V3_VERSION,
    revision: 0,
    scrip: 0,
    pets: { [STARTER_PET_ID]: { bondXp: 0 } },
    selectedPetId: STARTER_PET_ID,
    slateTortoisePityMisses: 0,
    ownedGear: [...STARTER_GEAR_IDS],
    equippedGear: { ...STARTER_GEAR_LOADOUT },
  };
}

export function createMetaAccountV4(): MetaAccountV4 {
  const gear = createMetaAccountV3();
  return {
    ...gear,
    version: META_ACCOUNT_VERSION,
    prestige: 0,
    weaponBank: createWeaponBankV1(),
  };
}

function sanitizedInt(value: unknown, max: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(max, Math.floor(numeric)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validate the local/offline client-claimed account payload. Unsupported/missing versions become a fresh
 * starter record; unknown ids and malformed rows are dropped, and levels are never accepted directly.
 */
export function sanitizeMetaAccountV2(input: unknown): MetaAccountV2 {
  if (!isRecord(input) || input.version !== META_ACCOUNT_V2_VERSION) return createMetaAccountV2();

  const pets: Partial<Record<PetId, PersistedPet>> = {};
  const rawPets = isRecord(input.pets) ? input.pets : {};
  for (const id of PET_IDS) {
    const rawPet = rawPets[id];
    if (!isRecord(rawPet)) continue;
    pets[id] = { bondXp: sanitizeBondXp(rawPet.bondXp) };
  }
  // Onboarding ownership is invariant even when a cache is partially corrupt.
  pets[STARTER_PET_ID] ??= { bondXp: 0 };

  let selectedPetId: PetId | "" = STARTER_PET_ID;
  if (input.selectedPetId === "") selectedPetId = "";
  else if (isPetId(input.selectedPetId) && pets[input.selectedPetId]) {
    selectedPetId = input.selectedPetId;
  }

  return {
    version: META_ACCOUNT_V2_VERSION,
    revision: sanitizedInt(input.revision, META_ACCOUNT_REVISION_MAX),
    scrip: sanitizedInt(input.scrip, META_ACCOUNT_SCRIP_MAX),
    upgrades: sanitizeMetaLevels(input.upgrades),
    pets,
    selectedPetId,
    slateTortoisePityMisses: sanitizedInt(input.slateTortoisePityMisses, 7),
  };
}

/** Old numerical tracks become one ordinary, visible item at the highest owned rank. */
export const LEGACY_UPGRADE_GRANTS = {
  vitality: [null, "mended-workshirt", "reinforced-workshirt", "shopkeeps-sunday-best"],
  fortune: [null, "brass-readers", "lucky-readers", "loaded-readers"],
  power: [null, "work-gloves", "knuckled-gloves", "ironhand-gloves"],
} as const satisfies Readonly<Record<MetaUpgradeId, readonly (GearId | null)[]>>;

export function migrateMetaAccountV2(input: MetaAccountV2): MetaAccountV3 {
  const source = sanitizeMetaAccountV2(input);
  const ownedGear: GearId[] = [...STARTER_GEAR_IDS];
  const equippedGear = { ...STARTER_GEAR_LOADOUT } as Record<GearSlot, GearId>;
  for (const upgrade of META_UPGRADES) {
    const grant = LEGACY_UPGRADE_GRANTS[upgrade.id][source.upgrades[upgrade.id]];
    if (!grant) continue;
    ownedGear.push(grant);
    const slot = GEAR_CATALOG[grant].slot;
    equippedGear[slot] = grant;
  }
  return {
    version: META_ACCOUNT_V3_VERSION,
    revision: source.revision,
    scrip: source.scrip,
    pets: source.pets,
    selectedPetId: source.selectedPetId,
    slateTortoisePityMisses: source.slateTortoisePityMisses,
    ownedGear,
    equippedGear,
  };
}

/**
 * Canonical local-trust account boundary. Ownership ids are trusted only as presence claims; every stat,
 * hook, slot, code, and modifier is re-derived from the closed catalog after this function returns.
 */
export function sanitizeMetaAccountV3(input: unknown): MetaAccountV3 {
  if (!isRecord(input)) return createMetaAccountV3();
  if (input.version === META_ACCOUNT_V2_VERSION) {
    return migrateMetaAccountV2(sanitizeMetaAccountV2(input));
  }
  if (input.version !== META_ACCOUNT_V3_VERSION) return createMetaAccountV3();

  const pets: Partial<Record<PetId, PersistedPet>> = {};
  const rawPets = isRecord(input.pets) ? input.pets : {};
  for (const id of PET_IDS) {
    const rawPet = rawPets[id];
    if (isRecord(rawPet)) pets[id] = { bondXp: sanitizeBondXp(rawPet.bondXp) };
  }
  pets[STARTER_PET_ID] ??= { bondXp: 0 };

  let selectedPetId: PetId | "" = STARTER_PET_ID;
  if (input.selectedPetId === "") selectedPetId = "";
  else if (isPetId(input.selectedPetId) && pets[input.selectedPetId])
    selectedPetId = input.selectedPetId;

  const requested = new Set<GearId>();
  if (Array.isArray(input.ownedGear)) {
    for (const value of input.ownedGear) {
      if (isGearId(value)) requested.add(value);
      else {
        const torso = torsoForLegacyPants(value);
        if (torso) requested.add(torso);
      }
    }
  }
  for (const id of STARTER_GEAR_IDS) requested.add(id);
  const ownedGear = GEAR_IDS.filter((id) => requested.has(id));
  const owned = new Set<GearId>(ownedGear);
  const equippedGear = sanitizeEquippedGear(input.equippedGear, owned);

  return {
    version: META_ACCOUNT_V3_VERSION,
    revision: sanitizedInt(input.revision, META_ACCOUNT_REVISION_MAX),
    scrip: sanitizedInt(input.scrip, META_ACCOUNT_SCRIP_MAX),
    pets,
    selectedPetId,
    slateTortoisePityMisses: sanitizedInt(input.slateTortoisePityMisses, 7),
    ownedGear,
    equippedGear,
  };
}

export function migrateMetaAccountV3(input: MetaAccountV3): MetaAccountV4 {
  const source = sanitizeMetaAccountV3(input);
  return {
    ...source,
    version: META_ACCOUNT_VERSION,
    prestige: 0,
    weaponBank: createWeaponBankV1(),
  };
}

export interface MetaAccountV4SanitizeResult {
  ok: boolean;
  account: MetaAccountV4;
  bank: WeaponBankSanitizeResult;
}

/**
 * Coordinated Wave-2 account boundary. V2/V3 migrate with an empty bank; a malformed V4 bank is reported
 * as invalid as a unit so the server can reject ready/commit instead of silently erasing selected value.
 */
export function sanitizeMetaAccountV4WithDiagnostics(input: unknown): MetaAccountV4SanitizeResult {
  if (!isRecord(input)) {
    const account = createMetaAccountV4();
    return { ok: false, account, bank: { ok: true, bank: account.weaponBank, errors: [] } };
  }
  if (input.version === META_ACCOUNT_V2_VERSION) {
    const account = migrateMetaAccountV3(migrateMetaAccountV2(sanitizeMetaAccountV2(input)));
    return { ok: true, account, bank: { ok: true, bank: account.weaponBank, errors: [] } };
  }
  if (input.version === META_ACCOUNT_V3_VERSION) {
    const account = migrateMetaAccountV3(sanitizeMetaAccountV3(input));
    return { ok: true, account, bank: { ok: true, bank: account.weaponBank, errors: [] } };
  }
  if (input.version !== META_ACCOUNT_VERSION) {
    const account = createMetaAccountV4();
    return { ok: false, account, bank: { ok: true, bank: account.weaponBank, errors: [] } };
  }

  const gear = sanitizeMetaAccountV3({ ...input, version: META_ACCOUNT_V3_VERSION });
  const bank = sanitizeWeaponBankV1(input.weaponBank);
  const account: MetaAccountV4 = {
    ...gear,
    version: META_ACCOUNT_VERSION,
    prestige: sanitizedInt(input.prestige, 30),
    weaponBank: bank.bank,
  };
  return { ok: bank.ok, account, bank };
}

export function sanitizeMetaAccountV4(input: unknown): MetaAccountV4 {
  return sanitizeMetaAccountV4WithDiagnostics(input).account;
}
