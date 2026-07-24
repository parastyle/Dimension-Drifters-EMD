import {
  type CarryPlacementV1,
  type CarrySelectionV1,
  type MetaAccountV4,
  weaponDisassemblyValue,
  WEAPON_ACTIVE_CAPACITY,
  WEAPON_PACK_BASE_CAPACITY,
  WEAPONS,
  type WeaponBankEntryV1,
  type WeaponRarityId,
  weaponEntryInstances,
  weaponEntryMinimumWorldTier,
  weaponEntryPhysicalSize,
  weaponRarityIndex,
} from "@dd/shared";

export interface ArmoryDraft {
  placements: CarryPlacementV1[];
  activeEntryId: string;
  packCapacity: number;
}

export interface ArmorySummary {
  atRiskPhysical: number;
  atRiskEntries: number;
  atRiskValue: number;
  safeEntries: number;
  activePhysical: number;
  packPhysical: number;
  requiredWorldTier: number;
  intakeBlocked: boolean;
}

export interface ArmoryEntryView {
  entry: WeaponBankEntryV1;
  name: string;
  detail: string;
  physical: number;
  atRiskValue: number;
  placement?: CarryPlacementV1;
  active: boolean;
  source: "stash" | "intake";
  zone: "safe" | "active" | "pack" | "intake";
  rarity: WeaponRarityId;
  weaponClass: string;
  family: string;
  delivery: string;
  provenance: string;
  paired: boolean;
}

export type ArmoryZoneFilter = "all" | "safe" | "staged" | "active" | "pack" | "intake";
export type ArmoryCatalogSort = "recommended" | "name" | "rarity" | "value" | "size" | "newest";

export interface ArmoryCatalogFilters {
  query: string;
  zone: ArmoryZoneFilter;
  weaponClass: string | "all";
  family: string | "all";
  delivery: string | "all";
  rarity: string | "all";
  provenance: string | "all";
  composition: "all" | "single" | "pair";
  sort: ArmoryCatalogSort;
}

export const DEFAULT_ARMORY_FILTERS: ArmoryCatalogFilters = {
  query: "",
  zone: "all",
  weaponClass: "all",
  family: "all",
  delivery: "all",
  rarity: "all",
  provenance: "all",
  composition: "all",
  sort: "recommended",
};

function firstFreeSpan(cells: boolean[], size: number): number {
  for (let start = 0; start + size <= cells.length; start++) {
    let free = true;
    for (let index = start; index < start + size; index++) free &&= !cells[index];
    if (free) return start;
  }
  return -1;
}

function occupiedCells(
  placements: readonly CarryPlacementV1[],
  entries: ReadonlyMap<string, WeaponBankEntryV1>,
  zone: "active" | "pack",
  capacity: number,
): boolean[] {
  const cells = Array.from({ length: capacity }, () => false);
  for (const placement of placements) {
    if (placement.zone !== zone) continue;
    const entry = entries.get(placement.entryId);
    if (!entry) continue;
    const span = weaponEntryPhysicalSize(entry);
    for (
      let index = placement.start;
      index < placement.start + span && index < cells.length;
      index++
    ) {
      cells[index] = true;
    }
  }
  return cells;
}

function validPlacement(
  placement: CarryPlacementV1,
  entry: WeaponBankEntryV1,
  placements: readonly CarryPlacementV1[],
  entries: ReadonlyMap<string, WeaponBankEntryV1>,
  packCapacity: number,
): boolean {
  const capacity = placement.zone === "active" ? WEAPON_ACTIVE_CAPACITY : packCapacity;
  const size = weaponEntryPhysicalSize(entry);
  if (
    !Number.isInteger(placement.start) ||
    placement.start < 0 ||
    placement.start + size > capacity
  )
    return false;
  const cells = occupiedCells(placements, entries, placement.zone, capacity);
  for (let index = placement.start; index < placement.start + size; index++) {
    if (cells[index]) return false;
  }
  return true;
}

export function createArmoryDraft(
  account: MetaAccountV4,
  packCapacity: number = WEAPON_PACK_BASE_CAPACITY,
): ArmoryDraft {
  const capacity = Math.max(0, Math.min(13, Math.floor(packCapacity)));
  const entries = new Map(account.weaponBank.stash.map((entry) => [entry.entryId, entry]));
  const placements: CarryPlacementV1[] = [];
  for (const placement of account.weaponBank.lastCarry.placements) {
    const entry = entries.get(placement.entryId);
    if (!entry || !validPlacement(placement, entry, placements, entries, capacity)) continue;
    placements.push({ ...placement });
  }
  const activeEntryId = placements.some(
    (row) => row.zone === "active" && row.entryId === account.weaponBank.lastCarry.activeEntryId,
  )
    ? account.weaponBank.lastCarry.activeEntryId
    : (placements.find((row) => row.zone === "active")?.entryId ?? "");
  return { placements, activeEntryId, packCapacity: capacity };
}

export function toggleArmoryEntry(
  account: MetaAccountV4,
  draft: ArmoryDraft,
  entryId: string,
): { draft: ArmoryDraft; error?: "carry-full" | "missing-entry" } {
  const selected = draft.placements.find((row) => row.entryId === entryId);
  if (selected) {
    const placements = draft.placements.filter((row) => row.entryId !== entryId);
    const activeEntryId =
      draft.activeEntryId === entryId
        ? (placements.find((row) => row.zone === "active")?.entryId ?? "")
        : draft.activeEntryId;
    return { draft: { ...draft, placements, activeEntryId } };
  }
  const entry = account.weaponBank.stash.find((row) => row.entryId === entryId);
  if (!entry) return { draft, error: "missing-entry" };
  const entries = new Map(account.weaponBank.stash.map((row) => [row.entryId, row]));
  const size = weaponEntryPhysicalSize(entry);
  const activeStart = firstFreeSpan(
    occupiedCells(draft.placements, entries, "active", WEAPON_ACTIVE_CAPACITY),
    size,
  );
  const packStart = firstFreeSpan(
    occupiedCells(draft.placements, entries, "pack", draft.packCapacity),
    size,
  );
  const placement: CarryPlacementV1 | undefined =
    activeStart >= 0
      ? { entryId, zone: "active", start: activeStart }
      : packStart >= 0
        ? { entryId, zone: "pack", start: packStart }
        : undefined;
  if (!placement) return { draft, error: "carry-full" };
  return {
    draft: {
      ...draft,
      placements: [...draft.placements, placement],
      activeEntryId: draft.activeEntryId || (placement.zone === "active" ? entryId : ""),
    },
  };
}

export function selectArmoryActiveEntry(draft: ArmoryDraft, entryId: string): ArmoryDraft {
  return draft.placements.some((row) => row.entryId === entryId && row.zone === "active")
    ? { ...draft, activeEntryId: entryId }
    : draft;
}

export function selectArmoryActiveCell(
  account: MetaAccountV4,
  draft: ArmoryDraft,
  cell: number,
): ArmoryDraft {
  const bounded = Math.max(0, Math.min(WEAPON_ACTIVE_CAPACITY - 1, Math.floor(cell)));
  const entries = new Map(account.weaponBank.stash.map((entry) => [entry.entryId, entry]));
  const placement = draft.placements.find(
    (row) => {
      const entry = entries.get(row.entryId);
      return (
        row.zone === "active" &&
        !!entry &&
        row.start <= bounded &&
        bounded < row.start + weaponEntryPhysicalSize(entry)
      );
    },
  );
  return placement ? selectArmoryActiveEntry(draft, placement.entryId) : draft;
}

/** Q/E movement between Active and Pack is reversible and uses the same physical-cell authority. */
export function moveArmoryEntryZone(
  account: MetaAccountV4,
  draft: ArmoryDraft,
  entryId: string,
  direction: -1 | 1,
): { draft: ArmoryDraft; error?: "carry-full" | "missing-entry" } {
  const entry = account.weaponBank.stash.find((row) => row.entryId === entryId);
  if (!entry) return { draft, error: "missing-entry" };
  const current = draft.placements.find((row) => row.entryId === entryId);
  if (!current) return toggleArmoryEntry(account, draft, entryId);
  const targetZone = direction < 0 ? "active" : "pack";
  if (current.zone === targetZone) return { draft };
  const placements = draft.placements.filter((row) => row.entryId !== entryId);
  const entries = new Map(account.weaponBank.stash.map((row) => [row.entryId, row]));
  const capacity = targetZone === "active" ? WEAPON_ACTIVE_CAPACITY : draft.packCapacity;
  const start = firstFreeSpan(
    occupiedCells(placements, entries, targetZone, capacity),
    weaponEntryPhysicalSize(entry),
  );
  if (start < 0) return { draft, error: "carry-full" };
  const nextPlacements = [...placements, { entryId, zone: targetZone, start } satisfies CarryPlacementV1];
  return {
    draft: {
      ...draft,
      placements: nextPlacements,
      activeEntryId:
        targetZone === "active"
          ? entryId
          : draft.activeEntryId === entryId
            ? (nextPlacements.find((row) => row.zone === "active")?.entryId ?? "")
            : draft.activeEntryId,
    },
  };
}

export function armoryEntryValue(entry: WeaponBankEntryV1): number {
  return weaponEntryInstances(entry).reduce(
    (sum, instance) => sum + weaponDisassemblyValue(instance.weaponId),
    0,
  );
}

export function armoryEntryName(entry: WeaponBankEntryV1): string {
  const names = weaponEntryInstances(entry).map(
    (instance) => WEAPONS[instance.weaponId]?.name ?? "Unknown weapon",
  );
  return names.join(" × ");
}

export function armoryEntryViews(account: MetaAccountV4, draft: ArmoryDraft): ArmoryEntryView[] {
  const placements = new Map(draft.placements.map((placement) => [placement.entryId, placement]));
  const rows = [
    ...account.weaponBank.stash.map((entry) => ({ entry, source: "stash" as const })),
    ...account.weaponBank.intake.map((entry) => ({ entry, source: "intake" as const })),
  ];
  return rows.map(({ entry, source }) => {
    const placement = placements.get(entry.entryId);
    const instances = weaponEntryInstances(entry);
    const detail = instances
      .map((instance) => `${instance.rarity.replace("-", " ")} · ${instance.affix || "plain"}`)
      .join(" / ");
    const definitions = instances.map((instance) => WEAPONS[instance.weaponId]).filter(Boolean);
    const rarityInstance = instances.reduce((best, instance) =>
      weaponRarityIndex(instance.rarity) > weaponRarityIndex(best.rarity) ? instance : best,
    );
    return {
      entry,
      name: armoryEntryName(entry),
      detail,
      physical: weaponEntryPhysicalSize(entry),
      atRiskValue: armoryEntryValue(entry),
      placement,
      active: draft.activeEntryId === entry.entryId,
      source,
      zone: source === "intake" ? "intake" : (placement?.zone ?? "safe"),
      rarity: rarityInstance.rarity,
      weaponClass: definitions.map((def) => def?.tags.classPool ?? "unknown").join(" / "),
      family: definitions.map((def) => def?.tags.family ?? "unknown").join(" / "),
      delivery: definitions.map((def) => def?.tags.delivery ?? "unknown").join(" / "),
      provenance: [...new Set(instances.map((instance) => instance.provenance))].join(" / "),
      paired: entry.kind === "pair",
    };
  });
}

export function armoryCatalogEntries(
  account: MetaAccountV4,
  draft: ArmoryDraft,
  filters: ArmoryCatalogFilters,
): ArmoryEntryView[] {
  const query = filters.query.trim().toLocaleLowerCase();
  const rows = armoryEntryViews(account, draft).filter((row) => {
    const staged = row.zone === "active" || row.zone === "pack";
    if (filters.zone !== "all") {
      if (filters.zone === "staged" ? !staged : row.zone !== filters.zone) return false;
    }
    if (filters.weaponClass !== "all" && !row.weaponClass.split(" / ").includes(filters.weaponClass)) return false;
    if (filters.family !== "all" && !row.family.split(" / ").includes(filters.family)) return false;
    if (filters.delivery !== "all" && !row.delivery.split(" / ").includes(filters.delivery)) return false;
    if (filters.rarity !== "all" && row.rarity !== filters.rarity) return false;
    if (filters.provenance !== "all" && !row.provenance.split(" / ").includes(filters.provenance)) return false;
    if (filters.composition !== "all" && (row.paired ? "pair" : "single") !== filters.composition) return false;
    return !query || [row.name, row.detail, row.weaponClass, row.family, row.delivery, row.provenance]
      .join(" ")
      .toLocaleLowerCase()
      .includes(query);
  });
  rows.sort((a, b) => {
    if (filters.sort === "name") return a.name.localeCompare(b.name) || a.entry.entryId.localeCompare(b.entry.entryId);
    if (filters.sort === "rarity") return weaponRarityIndex(b.rarity) - weaponRarityIndex(a.rarity) || a.name.localeCompare(b.name);
    if (filters.sort === "value") return b.atRiskValue - a.atRiskValue || a.name.localeCompare(b.name);
    if (filters.sort === "size") return b.physical - a.physical || a.name.localeCompare(b.name);
    if (filters.sort === "newest") return b.entry.entryId.localeCompare(a.entry.entryId);
    return (
      Number(!!b.placement) - Number(!!a.placement) ||
      Number(b.active) - Number(a.active) ||
      weaponRarityIndex(b.rarity) - weaponRarityIndex(a.rarity) ||
      a.name.localeCompare(b.name)
    );
  });
  return rows;
}

export function armorySummary(account: MetaAccountV4, draft: ArmoryDraft): ArmorySummary {
  const selected = new Set(draft.placements.map((row) => row.entryId));
  let atRiskPhysical = 0;
  let atRiskValue = 0;
  let activePhysical = 0;
  let packPhysical = 0;
  let requiredWorldTier = account.prestige;
  for (const entry of account.weaponBank.stash) {
    if (!selected.has(entry.entryId)) continue;
    const physical = weaponEntryPhysicalSize(entry);
    atRiskPhysical += physical;
    atRiskValue += armoryEntryValue(entry);
    requiredWorldTier = Math.max(requiredWorldTier, weaponEntryMinimumWorldTier(entry));
    const zone = draft.placements.find((row) => row.entryId === entry.entryId)?.zone;
    if (zone === "active") activePhysical += physical;
    else if (zone === "pack") packPhysical += physical;
  }
  return {
    atRiskPhysical,
    atRiskEntries: selected.size,
    atRiskValue,
    safeEntries: Math.max(0, account.weaponBank.stash.length - selected.size),
    activePhysical,
    packPhysical,
    requiredWorldTier,
    intakeBlocked: account.weaponBank.intake.length > 0,
  };
}

export function armoryCarrySelection(
  account: MetaAccountV4,
  draft: ArmoryDraft,
  requestId: string,
): CarrySelectionV1 {
  const summary = armorySummary(account, draft);
  return {
    requestId: requestId.slice(0, 64),
    expectedRevision: account.revision,
    placements: draft.placements.map((placement) => ({ ...placement })),
    activeEntryId: draft.activeEntryId,
    requestedWorldTier: summary.requiredWorldTier,
  };
}
