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
  { id: "fortune", name: "Fortune", desc: "+1 LUK — better loot & crits", maxLevel: 3, costs: [40, 90, 180] },
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
