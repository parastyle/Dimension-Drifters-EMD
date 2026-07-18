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
} from "@dd/shared";

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
}

export interface WardrobeSetView {
  id: string;
  name: string;
  owned: number;
  equipped: number;
  total: number;
  complete: boolean;
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

function canonicalPresetLoadout(value: unknown, account: MetaAccountV4): Record<GearSlot, GearId> {
  const source =
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const owned = new Set(account.ownedGear);
  const output = copyLoadout(STARTER_GEAR_LOADOUT);
  for (const slot of GEAR_SLOTS) {
    const id = source[slot];
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

export function wardrobeSetViews(account: MetaAccountV4): WardrobeSetView[] {
  const owned = new Set(account.ownedGear);
  const equipped = new Set(Object.values(account.equippedGear));
  return Object.entries(SET_NAMES).map(([id, name]) => {
    const items = GEAR_IDS.filter((gearId) => GEAR_CATALOG[gearId].legacySetId === id);
    const ownedCount = items.filter((gearId) => owned.has(gearId)).length;
    const equippedCount = items.filter((gearId) => equipped.has(gearId)).length;
    return {
      id,
      name,
      owned: ownedCount,
      equipped: equippedCount,
      total: items.length,
      complete: items.length === GEAR_SLOTS.length && ownedCount === items.length,
    };
  });
}

export function wardrobePreview(account: MetaAccountV4) {
  return resolveGearLoadout(account.equippedGear);
}

export function gearRarityPips(def: Pick<GearDef, "rarity">): string {
  const count = ["Common", "Uncommon", "Rare", "Really Rare", "Ultimate"].indexOf(def.rarity) + 1;
  return `${"◆".repeat(Math.max(1, count))}${"◇".repeat(Math.max(0, 5 - count))}`;
}
