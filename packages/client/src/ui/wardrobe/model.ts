import {
  GEAR_CATALOG,
  GEAR_IDS,
  GEAR_SLOTS,
  type GearDef,
  type GearId,
  type GearSlot,
  type MetaAccountV4,
  resolveGearLoadout,
  STARTER_GEAR_LOADOUT,
  sanitizeMetaAccountV4,
  weaponEntryInstances,
  weaponEntryPhysicalSize,
} from "@dd/shared";
import type { ArmoryArtStatus } from "../armory-ui/tokens.js";

export const WARDROBE_PRESET_STORAGE_KEY = "dd.wardrobe.presets.v1";
export const WARDROBE_WRITABLE_PRESETS = 5;

export interface WardrobePreset {
  name: string;
  loadout: Record<GearSlot, GearId>;
}

export interface WardrobePresetState {
  version: 1;
  selected: number;
  presets: WardrobePreset[];
}

export interface WardrobePresetView extends WardrobePreset {
  index: number;
  writable: boolean;
  selected: boolean;
}

export interface WardrobeSlotItemView {
  id: GearId;
  def: GearDef;
  owned: boolean;
  equipped: boolean;
  lockedCopy: string;
  artStatus?: ArmoryArtStatus;
}

export interface WardrobeSetSlotView {
  slot: GearSlot;
  gearId: GearId;
  owned: boolean;
  equipped: boolean;
}

export interface WardrobeSetView {
  id: string;
  name: string;
  owned: number;
  equipped: number;
  total: number;
  complete: boolean;
  slots: WardrobeSetSlotView[];
  missingSlots: GearSlot[];
}

export type WardrobeOwnershipFilter = "all" | "owned" | "locked";
export type WardrobeSort = "recommended" | "name" | "rarity" | "set" | "owned" | "newest";

export interface WardrobeCatalogFilters {
  query: string;
  slot: GearSlot;
  rarity: GearDef["rarity"] | "all";
  setId: string | "all";
  gearClass: GearDef["gearClass"] | "all";
  ownership: WardrobeOwnershipFilter;
  artStatus: ArmoryArtStatus | "all";
  sort: WardrobeSort;
}

export const DEFAULT_WARDROBE_FILTERS: WardrobeCatalogFilters = {
  query: "",
  slot: "hat",
  rarity: "all",
  setId: "all",
  gearClass: "all",
  ownership: "all",
  artStatus: "all",
  sort: "recommended",
};

export const PRESTIGE_CAP = 30;
export const PRESTIGE_CONFIRM_HOLD_MS = 2_000;

export interface PrestigeAtStakeSummary {
  stashEntries: number;
  intakeEntries: number;
  totalEntries: number;
  physicalWeapons: number;
  pairEntries: number;
  distinctWeaponIds: number;
  lastCarryReferences: number;
}

export interface PrestigeCeremonyView {
  eligible: boolean;
  eligibilityCopy: string;
  worldTier: number;
  nextWorldTier: number | null;
  hatSlots: number;
  nextHatSlots: number;
  nextHatPromise: string;
  atStake: PrestigeAtStakeSummary;
  costCopy: string;
  survivorCopy: string;
}

export interface PrestigeResetRequest {
  requestId: string;
  expectedRevision: number;
}

export interface PrestigeReceiptView {
  ok: true;
  removedEntries: number;
  removedPhysical: number;
  prestige: number;
  scripPaid: 0;
  revision: number;
}

export interface PrestigeReceiptFlow {
  request: PrestigeResetRequest;
  expectedPrestige: number;
  status: "pending" | "awaiting-account" | "revealed";
  receipt?: PrestigeReceiptView;
  refreshedAccount?: MetaAccountV4;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const SET_NAMES: Readonly<Record<string, string>> = {
  "ash-walker": "Asha · Ash-Walker",
  "ashen-crusader": "Cassian · Ashen Crusader",
  "molten-core": "Cinderpyre · Molten Core",
  coldsnap: "Cordell · Coldsnap",
  graveside: "Elias · Graveside",
  "nine-veils": "Iridia · Nine Veils",
  "demon-mask": "Kuro-Oni · Demon Mask",
  thornwatch: "Veyra · Thornwatch",
  "neon-mirage": "Neon Mirage",
  "house-edge": "Odette · House Edge",
  unbending: "Galloway · Unbending",
  pressurized: "Magnus · Pressurized",
};

function copyLoadout(loadout: Readonly<Record<GearSlot, GearId>>): Record<GearSlot, GearId> {
  return { ...loadout };
}

export function prestigeHatSlots(prestige: number): number {
  const bounded = Number.isFinite(prestige) ? Math.max(0, Math.floor(prestige)) : 0;
  return Math.min(PRESTIGE_CAP, bounded + 1);
}

export function prestigeAtStakeSummary(account: MetaAccountV4): PrestigeAtStakeSummary {
  const entries = [...account.weaponBank.stash, ...account.weaponBank.intake];
  const weaponIds = new Set<string>();
  let physicalWeapons = 0;
  let pairEntries = 0;
  for (const entry of entries) {
    physicalWeapons += weaponEntryPhysicalSize(entry);
    if (entry.kind === "pair") pairEntries++;
    for (const weapon of weaponEntryInstances(entry)) weaponIds.add(weapon.weaponId);
  }
  return {
    stashEntries: account.weaponBank.stash.length,
    intakeEntries: account.weaponBank.intake.length,
    totalEntries: entries.length,
    physicalWeapons,
    pairEntries,
    distinctWeaponIds: weaponIds.size,
    lastCarryReferences: account.weaponBank.lastCarry.placements.length,
  };
}

/** Binding prestige law: a terminal game clear, no live expedition, and the World Tier 30 cap. */
export function prestigeCeremonyView(
  account: MetaAccountV4,
  gameCleared: boolean,
): PrestigeCeremonyView {
  const worldTier = Math.min(PRESTIGE_CAP, Math.max(0, Math.floor(account.prestige)));
  const atStake = prestigeAtStakeSummary(account);
  const atCap = worldTier >= PRESTIGE_CAP;
  const expeditionActive = account.weaponBank.expedition !== null;
  const eligible = gameCleared && !expeditionActive && !atCap;
  const eligibilityCopy = atCap
    ? "WORLD TIER 30 · HAT TOWER AT CAP"
    : expeditionActive
      ? "CLOSE THE ACTIVE EXPEDITION BEFORE PRESTIGE"
      : gameCleared
        ? "GAME CLEAR RECEIPT HELD · FAREWELL AVAILABLE"
        : `BEAT THE GAME AT WORLD TIER ${worldTier} TO PRESTIGE`;
  const hatSlots = prestigeHatSlots(worldTier);
  const nextHatSlots = prestigeHatSlots(worldTier + 1);
  const nextHatPromise =
    nextHatSlots > hatSlots
      ? `NEXT HAT SLOT · ${hatSlots} → ${nextHatSlots} stacked hats`
      : `NEXT HAT SLOT · tower remains capped at ${PRESTIGE_CAP} hats`;
  return {
    eligible,
    eligibilityCopy,
    worldTier,
    nextWorldTier: atCap ? null : worldTier + 1,
    hatSlots,
    nextHatSlots,
    nextHatPromise,
    atStake,
    costCopy: [
      "ENTIRE WEAPON BANK WIPED",
      `${atStake.totalEntries} entries · ${atStake.physicalWeapons} weapons`,
      `Stash ${atStake.stashEntries} · Intake ${atStake.intakeEntries} · Pairs ${atStake.pairEntries}`,
      `Distinct bases ${atStake.distinctWeaponIds} · Last Carry refs ${atStake.lastCarryReferences}`,
      "MONEY PAID · 0",
    ].join("\n"),
    survivorCopy: [
      "SURVIVE",
      "Fists + Home-Issue Rusty Cleaver starter floor",
      `${account.ownedGear.length} unlocked gear · ${Object.keys(account.pets).length} pets`,
      `${account.scrip.toLocaleString()} Money · Armory shelves · cosmetics`,
    ].join("\n"),
  };
}

export function prestigeHoldProgress(startedAtMs: number, nowMs: number): number {
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(nowMs) || nowMs <= startedAtMs) return 0;
  return Math.min(1, (nowMs - startedAtMs) / PRESTIGE_CONFIRM_HOLD_MS);
}

export function beginPrestigeReceiptFlow(
  account: MetaAccountV4,
  gameCleared: boolean,
  requestId: string,
): PrestigeReceiptFlow | null {
  if (!prestigeCeremonyView(account, gameCleared).eligible) return null;
  const cleanRequestId = requestId.trim().slice(0, 64);
  if (!cleanRequestId) return null;
  return {
    request: { requestId: cleanRequestId, expectedRevision: account.revision },
    expectedPrestige: account.prestige + 1,
    status: "pending",
  };
}

function parsePrestigeReceipt(payload: unknown): PrestigeReceiptView | undefined {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return undefined;
  const row = payload as Partial<PrestigeReceiptView>;
  if (
    row.ok !== true ||
    !Number.isInteger(row.removedEntries) ||
    Number(row.removedEntries) < 0 ||
    !Number.isInteger(row.removedPhysical) ||
    Number(row.removedPhysical) < 0 ||
    !Number.isInteger(row.prestige) ||
    Number(row.prestige) < 1 ||
    Number(row.prestige) > PRESTIGE_CAP ||
    row.scripPaid !== 0 ||
    !Number.isInteger(row.revision) ||
    Number(row.revision) < 0
  ) {
    return undefined;
  }
  return row as PrestigeReceiptView;
}

function settlePrestigeReceiptFlow(flow: PrestigeReceiptFlow): PrestigeReceiptFlow {
  if (
    flow.receipt &&
    flow.refreshedAccount &&
    flow.receipt.prestige === flow.expectedPrestige &&
    flow.refreshedAccount.prestige === flow.receipt.prestige &&
    flow.refreshedAccount.revision >= flow.receipt.revision
  ) {
    return { ...flow, status: "revealed" };
  }
  return { ...flow, status: flow.receipt ? "awaiting-account" : "pending" };
}

/** Receipt and canonical account may arrive on adjacent frames; reveal only after both agree. */
export function receivePrestigeReceipt(
  flow: PrestigeReceiptFlow,
  payload: unknown,
): PrestigeReceiptFlow {
  const receipt = parsePrestigeReceipt(payload);
  if (
    !receipt ||
    receipt.prestige !== flow.expectedPrestige ||
    receipt.revision <= flow.request.expectedRevision
  ) {
    return flow;
  }
  return settlePrestigeReceiptFlow({ ...flow, receipt });
}

export function receivePrestigeAccount(
  flow: PrestigeReceiptFlow,
  account: MetaAccountV4,
): PrestigeReceiptFlow {
  if (account.revision < flow.request.expectedRevision) return flow;
  return settlePrestigeReceiptFlow({ ...flow, refreshedAccount: account });
}

function canonicalPresetLoadout(value: unknown, account: MetaAccountV4): Record<GearSlot, GearId> {
  const source =
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const owned = new Set(account.ownedGear);
  const output = copyLoadout(STARTER_GEAR_LOADOUT);
  for (const slot of GEAR_SLOTS) {
    // Preset v1 survives the pair migration: its old shirt selection becomes the complete torso and its
    // pants selection is intentionally ignored, matching account equipment sanitization.
    const id = slot === "torso" ? (source.torso ?? source.shirt) : source[slot];
    if (
      typeof id === "string" &&
      id in GEAR_CATALOG &&
      owned.has(id as GearId) &&
      GEAR_CATALOG[id as GearId].slot === slot
    ) {
      output[slot] = id as GearId;
    }
  }
  return output;
}

function defaultPresetState(account: MetaAccountV4): WardrobePresetState {
  return {
    version: 1,
    selected: 1,
    presets: Array.from({ length: WARDROBE_WRITABLE_PRESETS }, (_, index) => ({
      name: `Preset ${index + 1}`,
      loadout: copyLoadout(account.equippedGear),
    })),
  };
}

export function sanitizeWardrobePresetState(
  input: unknown,
  account: MetaAccountV4,
): WardrobePresetState {
  const fallback = defaultPresetState(account);
  if (!input || typeof input !== "object" || Array.isArray(input)) return fallback;
  const source = input as { version?: unknown; selected?: unknown; presets?: unknown };
  if (source.version !== 1 || !Array.isArray(source.presets)) return fallback;
  const sourcePresets = source.presets;
  const presets = Array.from({ length: WARDROBE_WRITABLE_PRESETS }, (_, index) => {
    const raw = sourcePresets[index];
    const row =
      raw && typeof raw === "object" && !Array.isArray(raw)
        ? (raw as { name?: unknown; loadout?: unknown })
        : {};
    const cleanName = typeof row.name === "string" ? row.name.trim().slice(0, 20) : "";
    return {
      name: cleanName || `Preset ${index + 1}`,
      loadout: canonicalPresetLoadout(row.loadout, account),
    };
  });
  const selected =
    Number.isInteger(source.selected) &&
    Number(source.selected) >= 0 &&
    Number(source.selected) <= WARDROBE_WRITABLE_PRESETS
      ? Number(source.selected)
      : 1;
  return { version: 1, selected, presets };
}

export function loadWardrobePresetState(
  account: MetaAccountV4,
  storage: StorageLike | undefined = typeof localStorage === "undefined" ? undefined : localStorage,
): WardrobePresetState {
  if (!storage) return defaultPresetState(account);
  try {
    const raw = storage.getItem(WARDROBE_PRESET_STORAGE_KEY);
    return sanitizeWardrobePresetState(raw ? JSON.parse(raw) : undefined, account);
  } catch {
    return defaultPresetState(account);
  }
}

export function saveWardrobePresetState(
  state: WardrobePresetState,
  account: MetaAccountV4,
  storage: StorageLike | undefined = typeof localStorage === "undefined" ? undefined : localStorage,
): WardrobePresetState {
  const clean = sanitizeWardrobePresetState(state, account);
  try {
    storage?.setItem(WARDROBE_PRESET_STORAGE_KEY, JSON.stringify(clean));
  } catch {
    // A blocked menu cache never blocks play; the account's equipped loadout remains canonical.
  }
  return clean;
}

export function wardrobePresetViews(state: WardrobePresetState): WardrobePresetView[] {
  return [
    {
      index: 0,
      name: "Starter / Reset",
      loadout: copyLoadout(STARTER_GEAR_LOADOUT),
      writable: false,
      selected: state.selected === 0,
    },
    ...state.presets.map((preset, index) => ({
      ...preset,
      loadout: copyLoadout(preset.loadout),
      index: index + 1,
      writable: true,
      selected: state.selected === index + 1,
    })),
  ];
}

export function equipWardrobeItem(account: MetaAccountV4, id: GearId): MetaAccountV4 {
  if (!account.ownedGear.includes(id)) return sanitizeMetaAccountV4(account);
  const next = sanitizeMetaAccountV4(account);
  const slot = GEAR_CATALOG[id].slot;
  next.equippedGear[slot] = id;
  return sanitizeMetaAccountV4(next);
}

/** Every slot has an explicit artless starter, so reversible unequip never invents nullable equipment. */
export function unequipWardrobeSlot(account: MetaAccountV4, slot: GearSlot): MetaAccountV4 {
  return equipWardrobeItem(account, STARTER_GEAR_LOADOUT[slot]);
}

export function applyWardrobePreset(
  account: MetaAccountV4,
  state: WardrobePresetState,
  index: number,
): { account: MetaAccountV4; state: WardrobePresetState } {
  const views = wardrobePresetViews(state);
  const preset = views.find((row) => row.index === index);
  if (!preset) return { account: sanitizeMetaAccountV4(account), state };
  const next = sanitizeMetaAccountV4(account);
  next.equippedGear = canonicalPresetLoadout(preset.loadout, next);
  return {
    account: sanitizeMetaAccountV4(next),
    state: { ...state, selected: index },
  };
}

export function overwriteWardrobePreset(
  state: WardrobePresetState,
  account: MetaAccountV4,
  index: number,
): WardrobePresetState {
  if (index < 1 || index > WARDROBE_WRITABLE_PRESETS) return state;
  const presets = state.presets.map((preset, row) =>
    row === index - 1 ? { ...preset, loadout: copyLoadout(account.equippedGear) } : preset,
  );
  return { version: 1, selected: index, presets };
}

export function wardrobeSlotItems(account: MetaAccountV4, slot: GearSlot): WardrobeSlotItemView[] {
  const owned = new Set(account.ownedGear);
  return GEAR_IDS.filter((id) => GEAR_CATALOG[id].slot === slot)
    .map((id) => {
      const def: GearDef = GEAR_CATALOG[id];
      const isOwned = owned.has(id);
      return {
        id,
        def,
        owned: isOwned,
        equipped: account.equippedGear[slot] === id,
        lockedCopy: isOwned
          ? "Owned"
          : def.originPool
            ? `Found in ${def.originPool}`
            : `${def.rarity} · Locked`,
      };
    })
    .sort((a, b) => Number(b.owned) - Number(a.owned) || a.def.netCode - b.def.netCode);
}

const GEAR_RARITY_ORDER: Readonly<Record<GearDef["rarity"], number>> = {
  Common: 1,
  Uncommon: 2,
  Rare: 3,
  "Really Rare": 4,
  Ultimate: 6,
};

/** Search/filter/sort is pure; explicit art state is injected from the manifest-owned visibility seam. */
export function wardrobeCatalogItems(
  account: MetaAccountV4,
  filters: WardrobeCatalogFilters,
  artStatusFor: (id: GearId) => ArmoryArtStatus = () => "ready",
): WardrobeSlotItemView[] {
  const query = filters.query.trim().toLocaleLowerCase();
  const rows = wardrobeSlotItems(account, filters.slot)
    .map((item) => ({ ...item, artStatus: artStatusFor(item.id) }))
    .filter((item) => {
      const def = item.def;
      if (filters.rarity !== "all" && def.rarity !== filters.rarity) return false;
      if (filters.setId !== "all" && def.legacySetId !== filters.setId) return false;
      if (filters.gearClass !== "all" && def.gearClass !== filters.gearClass) return false;
      if (filters.ownership === "owned" && !item.owned) return false;
      if (filters.ownership === "locked" && item.owned) return false;
      if (filters.artStatus !== "all" && item.artStatus !== filters.artStatus) return false;
      if (!query) return true;
      return [def.name, def.effectText, def.legacySetId ?? "", def.gearClass, def.rarity]
        .join(" ")
        .toLocaleLowerCase()
        .includes(query);
    });
  rows.sort((a, b) => {
    if (filters.sort === "name")
      return a.def.name.localeCompare(b.def.name) || a.def.netCode - b.def.netCode;
    if (filters.sort === "rarity")
      return (
        GEAR_RARITY_ORDER[b.def.rarity] - GEAR_RARITY_ORDER[a.def.rarity] ||
        a.def.name.localeCompare(b.def.name)
      );
    if (filters.sort === "set")
      return (
        (a.def.legacySetId ?? "zz").localeCompare(b.def.legacySetId ?? "zz") ||
        a.def.name.localeCompare(b.def.name)
      );
    if (filters.sort === "owned")
      return (
        Number(b.owned) - Number(a.owned) ||
        Number(b.equipped) - Number(a.equipped) ||
        a.def.name.localeCompare(b.def.name)
      );
    if (filters.sort === "newest") return b.def.netCode - a.def.netCode;
    return (
      Number(b.equipped) - Number(a.equipped) ||
      Number(b.owned) - Number(a.owned) ||
      GEAR_RARITY_ORDER[b.def.rarity] - GEAR_RARITY_ORDER[a.def.rarity] ||
      a.def.netCode - b.def.netCode
    );
  });
  return rows;
}

export function wardrobeSetViews(account: MetaAccountV4): WardrobeSetView[] {
  const owned = new Set(account.ownedGear);
  const equipped = new Set(Object.values(account.equippedGear));
  return Object.entries(SET_NAMES).map(([id, name]) => {
    const items = GEAR_IDS.filter((gearId) => GEAR_CATALOG[gearId].legacySetId === id);
    // Several legacy cowls are replacement heads in the live rig, while their paired collection identity
    // remains the set's hat piece. Keep runtime equipment canonical and normalize only this completion view.
    const collectionSlot = (gearId: GearId): GearSlot =>
      gearId.endsWith("-hat") ? "hat" : GEAR_CATALOG[gearId].slot;
    const slots = GEAR_SLOTS.map((slot) => {
      const gearId = items.find((candidate) => collectionSlot(candidate) === slot);
      if (!gearId) return undefined;
      return { slot, gearId, owned: owned.has(gearId), equipped: equipped.has(gearId) };
    }).filter((row): row is WardrobeSetSlotView => row !== undefined);
    const ownedCount = slots.filter((row) => row.owned).length;
    const equippedCount = slots.filter((row) => row.equipped).length;
    return {
      id,
      name,
      owned: ownedCount,
      equipped: equippedCount,
      total: items.length,
      complete: items.length === GEAR_SLOTS.length && ownedCount === items.length,
      slots,
      missingSlots: slots.filter((row) => !row.owned).map((row) => row.slot),
    };
  });
}

export function wardrobePreview(account: MetaAccountV4) {
  return resolveGearLoadout(account.equippedGear);
}

export function gearRarityPips(def: Pick<GearDef, "rarity">): string {
  const canonicalCount = GEAR_RARITY_ORDER[def.rarity];
  return "◆".repeat(canonicalCount);
}
