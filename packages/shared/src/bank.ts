import { ENEMY_KINDS } from "./enemies.js";
import { AFFIXES, CURSED_AFFIXES, DROP_POOL, RARITIES } from "./loot.js";
import { pairEligible, WEAPONS } from "./weapons.js";

export const WEAPON_BANK_VERSION = 1 as const;
export const WEAPON_STASH_BASE_CAPACITY = 72 as const;
export const WEAPON_STASH_SHELF_SIZE = 12 as const;
export const WEAPON_STASH_MAX_SHELVES = 6 as const;
export const WEAPON_STASH_MAX_CAPACITY = 144 as const;
export const WEAPON_ACTIVE_CAPACITY = 3 as const;
export const WEAPON_PACK_BASE_CAPACITY = 12 as const;
export const WEAPON_PACK_MAX_CAPACITY = 13 as const;
export const WEAPON_CARRY_MAX_PHYSICAL = 16 as const;
export const WEAPON_BANK_MAX_BYTES = 192 * 1024;
export const META_JOIN_MAX_BYTES = 256 * 1024;
export const WEAPON_BANK_MAX_COMPONENTS = 304 as const;
export const WEAPON_ID_MAX_LENGTH = 64 as const;
export const WEAPON_RUN_ID_MAX_LENGTH = 64 as const;

export const WEAPON_INSTANCE_ID_RE = /^wi_[A-Za-z0-9_-]{22}$/;
export const WEAPON_PAIR_ENTRY_ID_RE = /^wp_[A-Za-z0-9_-]{22}$/;
const BOUNDED_ASCII_RE = /^[\x21-\x7e]+$/;

export type WeaponInstanceId = string;
export type WeaponPairEntryId = string;
export type WeaponRarityId =
  | "common"
  | "uncommon"
  | "rare"
  | "really-rare"
  | "legendary"
  | "ultimate"
  | "cursed";
export type WeaponAffixId =
  | ""
  | "keen"
  | "swift"
  | "heavy"
  | "light"
  | "balanced"
  | "brutal"
  | "worn"
  | "sluggish"
  | "blessed"
  | "frenzied"
  | "doomed"
  | "hollow";
export type WeaponProvenance =
  | "enemy-drop"
  | "boss-drop"
  | "tutorial-drop"
  | "migration-earned";

export interface WeaponInstanceV1 {
  instanceId: WeaponInstanceId;
  weaponId: string;
  rarity: WeaponRarityId;
  affix: WeaponAffixId;
  provenance: WeaponProvenance;
  sourceWorldTier: number;
}

export interface SingleWeaponEntryV1 {
  kind: "single";
  entryId: WeaponInstanceId;
  weapon: WeaponInstanceV1;
}

export interface PairedWeaponEntryV1 {
  kind: "pair";
  entryId: WeaponPairEntryId;
  lead: WeaponInstanceV1;
  offhand: WeaponInstanceV1;
}

export type WeaponBankEntryV1 = SingleWeaponEntryV1 | PairedWeaponEntryV1;

export interface CarryPlacementV1 {
  entryId: string;
  zone: "active" | "pack";
  start: number;
}

export interface LastCarryV1 {
  placements: CarryPlacementV1[];
  activeEntryId: string | "";
}

export interface ExpeditionEntryV1 {
  entry: WeaponBankEntryV1;
  stakeOrigin: "committed" | "found";
  location: "active" | "pack" | "field";
  start: number;
}

export interface WeaponExpeditionReservationV1 {
  runId: string;
  commitRevision: number;
  status: "committed";
  entries: ExpeditionEntryV1[];
}

export interface WeaponBankV1 {
  version: 1;
  shelfUpgrades: number;
  stash: WeaponBankEntryV1[];
  intake: WeaponBankEntryV1[];
  lastCarry: LastCarryV1;
  expedition: WeaponExpeditionReservationV1 | null;
}

export interface CarrySelectionV1 {
  requestId: string;
  expectedRevision: number;
  placements: CarryPlacementV1[];
  activeEntryId: string | "";
  requestedWorldTier: number;
}

export interface WeaponBankCuratorInputV1 {
  accountId: string;
  worldTier: number;
  copiesByWeaponId: ReadonlyMap<string, number>;
  runIssuedByWeaponId: Map<string, number>;
}

export interface WeaponBankSanitizeResult {
  ok: boolean;
  bank: WeaponBankV1;
  errors: string[];
}

export function createWeaponBankV1(): WeaponBankV1 {
  return {
    version: WEAPON_BANK_VERSION,
    shelfUpgrades: 0,
    stash: [],
    intake: [],
    lastCarry: { placements: [], activeEntryId: "" },
    expedition: null,
  };
}

/** Exact UTF-8 size without relying on DOM or Node globals in the shared package. */
export function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x80) bytes++;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && i + 1 < value.length) {
      const low = value.charCodeAt(i + 1);
      if (low >= 0xdc00 && low <= 0xdfff) {
        bytes += 4;
        i++;
      } else bytes += 3;
    } else bytes += 3;
  }
  return bytes;
}

export function encodedJsonByteLength(value: unknown): number {
  if (value === undefined) return 0;
  try {
    const encoded = JSON.stringify(value);
    return typeof encoded === "string" ? utf8ByteLength(encoded) : Number.POSITIVE_INFINITY;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

export function weaponEntryPhysicalSize(entry: WeaponBankEntryV1): 1 | 2 {
  return entry.kind === "pair" ? 2 : 1;
}

export function weaponEntryInstances(entry: WeaponBankEntryV1): readonly WeaponInstanceV1[] {
  return entry.kind === "pair" ? [entry.lead, entry.offhand] : [entry.weapon];
}

export function weaponEntryMinimumWorldTier(entry: WeaponBankEntryV1): number {
  return entry.kind === "pair"
    ? Math.max(entry.lead.sourceWorldTier, entry.offhand.sourceWorldTier)
    : entry.weapon.sourceWorldTier;
}

export function weaponRarityIndex(rarity: WeaponRarityId): number {
  return RARITIES.findIndex((candidate) => candidate.id === rarity);
}

export function weaponRarityId(index: number): WeaponRarityId {
  return (RARITIES[index]?.id ?? "common") as WeaponRarityId;
}

const DIRECT_ENEMY_DROP_IDS = new Set<string>();
for (const kind of Object.values(ENEMY_KINDS)) {
  if (kind.wieldsWeapon && (kind.dropWeapon ?? 0) > 0) DIRECT_ENEMY_DROP_IDS.add(kind.wieldsWeapon);
}
const RANDOM_DROP_IDS = new Set(DROP_POOL);
const MIGRATION_DROP_IDS = new Set([...DROP_POOL, ...DIRECT_ENEMY_DROP_IDS]);
const NORMAL_AFFIX_IDS = new Set(AFFIXES.map((affix) => affix.id));
const CURSED_AFFIX_IDS = new Set(CURSED_AFFIXES.map((affix) => affix.id));
const RARITY_IDS = new Set(RARITIES.map((rarity) => rarity.id));
const PROVENANCE_IDS = new Set<WeaponProvenance>([
  "enemy-drop",
  "boss-drop",
  "tutorial-drop",
  "migration-earned",
]);

export function isWeaponAcquisitionAllowed(
  weaponId: string,
  provenance: WeaponProvenance,
): boolean {
  if (weaponId === "fists" || !WEAPONS[weaponId]) return false;
  if (provenance === "enemy-drop") {
    return RANDOM_DROP_IDS.has(weaponId) || DIRECT_ENEMY_DROP_IDS.has(weaponId);
  }
  if (provenance === "boss-drop") return RANDOM_DROP_IDS.has(weaponId);
  if (provenance === "tutorial-drop") return weaponId === "rusty-cleaver";
  return MIGRATION_DROP_IDS.has(weaponId);
}

export function isLegalWeaponRarityAffix(rarity: unknown, affix: unknown): boolean {
  if (typeof rarity !== "string" || !RARITY_IDS.has(rarity) || typeof affix !== "string") {
    return false;
  }
  return rarity === "cursed" ? CURSED_AFFIX_IDS.has(affix) : NORMAL_AFFIX_IDS.has(affix);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBoundedAscii(value: unknown, maxLength: number): value is string {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= maxLength &&
    BOUNDED_ASCII_RE.test(value);
}

function parseInstance(value: unknown, errors: string[], path: string): WeaponInstanceV1 | null {
  if (!isRecord(value)) {
    errors.push(`${path}:record`);
    return null;
  }
  const instanceId = value.instanceId;
  const weaponId = value.weaponId;
  const rarity = value.rarity;
  const affix = value.affix;
  const provenance = value.provenance;
  const sourceWorldTier = value.sourceWorldTier;
  if (typeof instanceId !== "string" || !WEAPON_INSTANCE_ID_RE.test(instanceId)) {
    errors.push(`${path}:instanceId`);
  }
  if (
    typeof weaponId !== "string" ||
    weaponId.length === 0 ||
    weaponId.length > WEAPON_ID_MAX_LENGTH
  ) errors.push(`${path}:weaponId`);
  if (!isLegalWeaponRarityAffix(rarity, affix)) errors.push(`${path}:rarity-affix`);
  if (typeof provenance !== "string" || !PROVENANCE_IDS.has(provenance as WeaponProvenance)) {
    errors.push(`${path}:provenance`);
  }
  if (!Number.isInteger(sourceWorldTier) || (sourceWorldTier as number) < 0 || (sourceWorldTier as number) > 30) {
    errors.push(`${path}:sourceWorldTier`);
  }
  if (
    typeof weaponId === "string" &&
    typeof provenance === "string" &&
    PROVENANCE_IDS.has(provenance as WeaponProvenance) &&
    !isWeaponAcquisitionAllowed(weaponId, provenance as WeaponProvenance)
  ) errors.push(`${path}:acquisition`);
  if (errors.some((error) => error.startsWith(`${path}:`))) return null;
  return {
    instanceId: instanceId as string,
    weaponId: weaponId as string,
    rarity: rarity as WeaponRarityId,
    affix: affix as WeaponAffixId,
    provenance: provenance as WeaponProvenance,
    sourceWorldTier: sourceWorldTier as number,
  };
}

function parseEntry(value: unknown, errors: string[], path: string): WeaponBankEntryV1 | null {
  if (!isRecord(value)) {
    errors.push(`${path}:record`);
    return null;
  }
  if (value.kind === "single") {
    const weapon = parseInstance(value.weapon, errors, `${path}.weapon`);
    if (typeof value.entryId !== "string" || !WEAPON_INSTANCE_ID_RE.test(value.entryId)) {
      errors.push(`${path}:entryId`);
    }
    if (weapon && value.entryId !== weapon.instanceId) errors.push(`${path}:single-entry-alias`);
    if (!weapon || errors.some((error) => error.startsWith(`${path}:`))) return null;
    return { kind: "single", entryId: value.entryId as string, weapon };
  }
  if (value.kind === "pair") {
    const lead = parseInstance(value.lead, errors, `${path}.lead`);
    const offhand = parseInstance(value.offhand, errors, `${path}.offhand`);
    if (typeof value.entryId !== "string" || !WEAPON_PAIR_ENTRY_ID_RE.test(value.entryId)) {
      errors.push(`${path}:entryId`);
    }
    if (lead && offhand) {
      if (lead.instanceId === offhand.instanceId) errors.push(`${path}:pair-self`);
      if (!pairEligible(WEAPONS[lead.weaponId], WEAPONS[offhand.weaponId])) {
        errors.push(`${path}:pair-ineligible`);
      }
    }
    if (!lead || !offhand || errors.some((error) => error.startsWith(`${path}:`))) return null;
    return { kind: "pair", entryId: value.entryId as string, lead, offhand };
  }
  errors.push(`${path}:kind`);
  return null;
}

function parsePlacement(value: unknown, errors: string[], path: string): CarryPlacementV1 | null {
  if (!isRecord(value)) {
    errors.push(`${path}:record`);
    return null;
  }
  if (!isBoundedAscii(value.entryId, 25)) errors.push(`${path}:entryId`);
  if (value.zone !== "active" && value.zone !== "pack") errors.push(`${path}:zone`);
  if (!Number.isInteger(value.start)) errors.push(`${path}:start`);
  if (errors.some((error) => error.startsWith(`${path}:`))) return null;
  return {
    entryId: value.entryId as string,
    zone: value.zone as "active" | "pack",
    start: value.start as number,
  };
}

function validateUniqueEntries(
  entries: readonly WeaponBankEntryV1[],
  entryIds: Set<string>,
  instanceIds: Set<string>,
  errors: string[],
  path: string,
): void {
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index]!;
    if (entryIds.has(entry.entryId)) errors.push(`${path}[${index}]:duplicate-entry`);
    entryIds.add(entry.entryId);
    for (const instance of weaponEntryInstances(entry)) {
      if (instanceIds.has(instance.instanceId)) errors.push(`${path}[${index}]:duplicate-instance`);
      instanceIds.add(instance.instanceId);
    }
  }
}

function validatePlacedEntries(
  entries: readonly ExpeditionEntryV1[],
  errors: string[],
): void {
  const active = new Uint8Array(WEAPON_ACTIVE_CAPACITY);
  const pack = new Uint8Array(WEAPON_PACK_MAX_CAPACITY);
  let carriedPhysical = 0;
  for (let index = 0; index < entries.length; index++) {
    const expedition = entries[index]!;
    const span = weaponEntryPhysicalSize(expedition.entry);
    if (expedition.location === "field") {
      if (expedition.start !== 255) errors.push(`expedition.entries[${index}]:field-start`);
      continue;
    }
    const cells = expedition.location === "active" ? active : pack;
    if (expedition.start < 0 || expedition.start + span > cells.length) {
      errors.push(`expedition.entries[${index}]:placement-bounds`);
      continue;
    }
    carriedPhysical += span;
    for (let cell = expedition.start; cell < expedition.start + span; cell++) {
      if (cells[cell]) errors.push(`expedition.entries[${index}]:placement-overlap`);
      cells[cell] = 1;
    }
  }
  if (carriedPhysical > WEAPON_CARRY_MAX_PHYSICAL) errors.push("expedition:physical-capacity");
}

/**
 * Strict local-trust boundary. Any invalid row rejects the complete bank; valid rows are rebuilt with only
 * canonical fields, so client-authored stats, price, damage, resource debt, and other extras disappear.
 */
export function sanitizeWeaponBankV1(input: unknown): WeaponBankSanitizeResult {
  const fallback = createWeaponBankV1();
  const errors: string[] = [];
  if (encodedJsonByteLength(input) > WEAPON_BANK_MAX_BYTES) {
    return { ok: false, bank: fallback, errors: ["bank:encoded-size"] };
  }
  if (!isRecord(input) || input.version !== WEAPON_BANK_VERSION) {
    return { ok: false, bank: fallback, errors: ["bank:version"] };
  }
  if (!Number.isInteger(input.shelfUpgrades) || (input.shelfUpgrades as number) < 0 || (input.shelfUpgrades as number) > WEAPON_STASH_MAX_SHELVES) {
    errors.push("bank:shelfUpgrades");
  }
  if (!Array.isArray(input.stash) || input.stash.length > WEAPON_STASH_MAX_CAPACITY) {
    errors.push("bank:stash-cardinality");
  }
  if (!Array.isArray(input.intake) || input.intake.length > WEAPON_CARRY_MAX_PHYSICAL) {
    errors.push("bank:intake-cardinality");
  }
  const stash: WeaponBankEntryV1[] = [];
  const intake: WeaponBankEntryV1[] = [];
  if (Array.isArray(input.stash) && input.stash.length <= WEAPON_STASH_MAX_CAPACITY) {
    for (let index = 0; index < input.stash.length; index++) {
      const entry = parseEntry(input.stash[index], errors, `stash[${index}]`);
      if (entry) stash.push(entry);
    }
  }
  if (Array.isArray(input.intake) && input.intake.length <= WEAPON_CARRY_MAX_PHYSICAL) {
    for (let index = 0; index < input.intake.length; index++) {
      const entry = parseEntry(input.intake[index], errors, `intake[${index}]`);
      if (entry) intake.push(entry);
    }
  }
  const shelfUpgrades = Number.isInteger(input.shelfUpgrades)
    ? input.shelfUpgrades as number
    : 0;
  const stashCapacity = WEAPON_STASH_BASE_CAPACITY +
    WEAPON_STASH_SHELF_SIZE * Math.max(0, Math.min(WEAPON_STASH_MAX_SHELVES, shelfUpgrades));
  if (stash.length > stashCapacity) errors.push("bank:stash-capacity");
  let intakePhysical = 0;
  for (const entry of intake) intakePhysical += weaponEntryPhysicalSize(entry);
  if (intakePhysical > WEAPON_CARRY_MAX_PHYSICAL) errors.push("bank:intake-physical-capacity");

  const lastCarry: LastCarryV1 = { placements: [], activeEntryId: "" };
  if (!isRecord(input.lastCarry)) errors.push("bank:lastCarry");
  else {
    if (!Array.isArray(input.lastCarry.placements) || input.lastCarry.placements.length > WEAPON_CARRY_MAX_PHYSICAL) {
      errors.push("bank:lastCarry-cardinality");
    } else {
      const seenLast = new Set<string>();
      for (let index = 0; index < input.lastCarry.placements.length; index++) {
        const placement = parsePlacement(input.lastCarry.placements[index], errors, `lastCarry.placements[${index}]`);
        if (!placement) continue;
        if (seenLast.has(placement.entryId)) errors.push(`lastCarry.placements[${index}]:duplicate-entry`);
        seenLast.add(placement.entryId);
        const max = placement.zone === "active" ? WEAPON_ACTIVE_CAPACITY : WEAPON_PACK_MAX_CAPACITY;
        if (placement.start < 0 || placement.start >= max) errors.push(`lastCarry.placements[${index}]:bounds`);
        lastCarry.placements.push(placement);
      }
    }
    if (input.lastCarry.activeEntryId !== "" && !isBoundedAscii(input.lastCarry.activeEntryId, 25)) {
      errors.push("bank:lastCarry-activeEntryId");
    } else lastCarry.activeEntryId = input.lastCarry.activeEntryId as string;
  }

  let expedition: WeaponExpeditionReservationV1 | null = null;
  if (input.expedition !== null) {
    if (!isRecord(input.expedition)) errors.push("bank:expedition");
    else {
      const raw = input.expedition;
      if (!isBoundedAscii(raw.runId, WEAPON_RUN_ID_MAX_LENGTH)) errors.push("expedition:runId");
      if (!Number.isInteger(raw.commitRevision) || (raw.commitRevision as number) < 0 || (raw.commitRevision as number) > 0xffffffff) {
        errors.push("expedition:commitRevision");
      }
      if (raw.status !== "committed") errors.push("expedition:status");
      if (!Array.isArray(raw.entries) || raw.entries.length > WEAPON_CARRY_MAX_PHYSICAL) {
        errors.push("expedition:cardinality");
      }
      const entries: ExpeditionEntryV1[] = [];
      if (Array.isArray(raw.entries) && raw.entries.length <= WEAPON_CARRY_MAX_PHYSICAL) {
        for (let index = 0; index < raw.entries.length; index++) {
          const row = raw.entries[index];
          if (!isRecord(row)) {
            errors.push(`expedition.entries[${index}]:record`);
            continue;
          }
          const entry = parseEntry(row.entry, errors, `expedition.entries[${index}].entry`);
          if (row.stakeOrigin !== "committed" && row.stakeOrigin !== "found") {
            errors.push(`expedition.entries[${index}]:stakeOrigin`);
          }
          if (row.location !== "active" && row.location !== "pack" && row.location !== "field") {
            errors.push(`expedition.entries[${index}]:location`);
          }
          if (!Number.isInteger(row.start)) errors.push(`expedition.entries[${index}]:start`);
          if (entry && (row.stakeOrigin === "committed" || row.stakeOrigin === "found") &&
            (row.location === "active" || row.location === "pack" || row.location === "field") &&
            Number.isInteger(row.start)) {
            entries.push({
              entry,
              stakeOrigin: row.stakeOrigin,
              location: row.location,
              start: row.start as number,
            });
          }
        }
      }
      validatePlacedEntries(entries, errors);
      if (errors.length === 0) {
        expedition = {
          runId: raw.runId as string,
          commitRevision: raw.commitRevision as number,
          status: "committed",
          entries,
        };
      }
    }
  }

  const entryIds = new Set<string>();
  const instanceIds = new Set<string>();
  validateUniqueEntries(stash, entryIds, instanceIds, errors, "stash");
  validateUniqueEntries(intake, entryIds, instanceIds, errors, "intake");
  if (expedition) {
    validateUniqueEntries(expedition.entries.map((row) => row.entry), entryIds, instanceIds, errors, "expedition");
  }
  if (instanceIds.size > WEAPON_BANK_MAX_COMPONENTS) errors.push("bank:component-capacity");
  if (errors.length > 0) return { ok: false, bank: fallback, errors };
  return {
    ok: true,
    bank: {
      version: WEAPON_BANK_VERSION,
      shelfUpgrades,
      stash,
      intake,
      lastCarry,
      expedition,
    },
    errors,
  };
}

export function countWeaponCopies(
  bank: WeaponBankV1,
  includeStarterFloor = true,
): Map<string, number> {
  const counts = new Map<string, number>();
  const add = (entry: WeaponBankEntryV1): void => {
    for (const instance of weaponEntryInstances(entry)) {
      counts.set(instance.weaponId, (counts.get(instance.weaponId) ?? 0) + 1);
    }
  };
  for (const entry of bank.stash) add(entry);
  for (const entry of bank.intake) add(entry);
  if (bank.expedition) for (const row of bank.expedition.entries) add(row.entry);
  if (includeStarterFloor) counts.set("rusty-cleaver", Math.max(1, counts.get("rusty-cleaver") ?? 0));
  return counts;
}

export function weaponCuratorIdentityWeight(copyCount: number): number {
  if (copyCount <= 0) return 3;
  if (copyCount === 1) return 1;
  if (copyCount === 2) return 0.55;
  return 0.25;
}

/** Allocation-free weighted identity roll once the run-start maps have been built. */
export function rollBankAwareDropWeapon(
  input: WeaponBankCuratorInputV1 | undefined,
  roll: number,
): string {
  if (!input) {
    return DROP_POOL[Math.floor(Math.min(0.999999, Math.max(0, roll)) * DROP_POOL.length)] ?? "rusty-cleaver";
  }
  let total = 0;
  for (const id of DROP_POOL) {
    total += weaponCuratorIdentityWeight(
      (input.copiesByWeaponId.get(id) ?? 0) + (input.runIssuedByWeaponId.get(id) ?? 0),
    );
  }
  let cursor = Math.min(0.999999, Math.max(0, roll)) * total;
  for (const id of DROP_POOL) {
    cursor -= weaponCuratorIdentityWeight(
      (input.copiesByWeaponId.get(id) ?? 0) + (input.runIssuedByWeaponId.get(id) ?? 0),
    );
    if (cursor < 0) return id;
  }
  return DROP_POOL[DROP_POOL.length - 1] ?? "rusty-cleaver";
}
