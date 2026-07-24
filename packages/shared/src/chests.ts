import { TICK_RATE } from "./constants.js";
import {
  type ArenaMap,
  isArenaDiscSafe,
  MAP_ZONE_SCAR,
  type MapZoneId,
  zoneAtPx,
} from "./mapgen.js";
import {
  COMMON_RELIC_IDS,
  type CommonRelicId,
  RARE_RELIC_IDS,
  type RareRelicId,
} from "./relics.js";
import { makeRng, mixSeeds, type Rng } from "./rng.js";
import { WEAPONS, type WeaponTier } from "./weapons.js";

export const CHEST_FIRST_SECONDS = 25 as const;
export const CHEST_INTERVAL_SECONDS = 55 as const;
export const CHEST_INTERVAL_JITTER_SECONDS = 15 as const;
export const CHEST_WEAPON_GUARANTEE_SECONDS = 150 as const;
export const CHEST_OPEN_RADIUS = 72 as const;
export const CHEST_PLACEMENT_RADIUS = 24 as const;
export const CHEST_MIN_SPACING = 120 as const;

export const CHEST_FIRST_TICKS = CHEST_FIRST_SECONDS * TICK_RATE;
export const CHEST_WEAPON_GUARANTEE_TICKS = CHEST_WEAPON_GUARANTEE_SECONDS * TICK_RATE;

export const CHEST_KIND_STANDARD = 0 as const;
export const CHEST_KIND_WEAPON_CACHE = 1 as const;
export type ChestKind = typeof CHEST_KIND_STANDARD | typeof CHEST_KIND_WEAPON_CACHE;

export interface ChestCadenceState {
  nextSpawnTick: number;
  lastWeaponChestTick: number;
  sequence: number;
}

export interface ChestSpawnDirective {
  sequence: number;
  spawnTick: number;
  kind: ChestKind;
}

export interface ChestCadenceAdvance {
  state: ChestCadenceState;
  spawns: ChestSpawnDirective[];
}

export function chestCadenceInitial(startTick: number, cadenceSeed: number): ChestCadenceState {
  const start = startTick >>> 0;
  return {
    nextSpawnTick: (start + CHEST_FIRST_TICKS) >>> 0,
    lastWeaponChestTick: start,
    sequence: mixSeeds(cadenceSeed, start, 0xc4e57) & 0xffff,
  };
}

function chestIntervalTicks(cadenceSeed: number, sequence: number, spawnTick: number): number {
  const rng = makeRng(mixSeeds(cadenceSeed, sequence, spawnTick, 0xc4de));
  const seconds =
    CHEST_INTERVAL_SECONDS +
    rng.range(-CHEST_INTERVAL_JITTER_SECONDS, CHEST_INTERVAL_JITTER_SECONDS);
  return Math.max(1, Math.round(seconds * TICK_RATE));
}

/** Pure tick director. The hard deadline competes with the ordinary schedule, so a late interval can
 * never stretch the weapon-cache drought beyond 150 seconds. */
export function advanceChestCadence(
  source: Readonly<ChestCadenceState>,
  currentTick: number,
  cadenceSeed: number,
): ChestCadenceAdvance {
  const state: ChestCadenceState = { ...source };
  const spawns: ChestSpawnDirective[] = [];
  const now = currentTick >>> 0;
  for (let guard = 0; guard < 64; guard++) {
    const weaponDeadline = (state.lastWeaponChestTick + CHEST_WEAPON_GUARANTEE_TICKS) >>> 0;
    const deadlineFirst = ((weaponDeadline - state.nextSpawnTick) | 0) <= 0;
    const dueTick = deadlineFirst ? weaponDeadline : state.nextSpawnTick;
    if (((now - dueTick) | 0) < 0) break;
    const kind = deadlineFirst ? CHEST_KIND_WEAPON_CACHE : CHEST_KIND_STANDARD;
    spawns.push({ sequence: state.sequence, spawnTick: dueTick, kind });
    if (kind === CHEST_KIND_WEAPON_CACHE) state.lastWeaponChestTick = dueTick;
    state.sequence = (state.sequence + 1) & 0xffff;
    state.nextSpawnTick =
      (dueTick + chestIntervalTicks(cadenceSeed, state.sequence, dueTick)) >>> 0;
  }
  return { state, spawns };
}

export interface ChestPlacement {
  x: number;
  y: number;
  zone: MapZoneId;
}

export function placeChestOnArena(
  map: ArenaMap,
  placementSeed: number,
  sequence: number,
  spawnTick: number,
  existing: readonly Readonly<{ x: number; y: number }>[],
): ChestPlacement {
  const rng = makeRng(mixSeeds(placementSeed, sequence, spawnTick, 0x91ace));
  const clear = (x: number, y: number): boolean =>
    isArenaDiscSafe(map, x, y, CHEST_PLACEMENT_RADIUS) &&
    existing.every((chest) => (chest.x - x) ** 2 + (chest.y - y) ** 2 >= CHEST_MIN_SPACING ** 2);
  for (let attempt = 0; attempt < 96; attempt++) {
    const col = rng.int(1, map.cols - 2);
    const row = rng.int(1, map.rows - 2);
    const x = (col + 0.5) * map.tileSize;
    const y = (row + 0.5) * map.tileSize;
    if (clear(x, y)) return { x, y, zone: zoneAtPx(map, x, y) };
  }
  const total = map.cols * map.rows;
  const offset = rng.int(0, Math.max(0, total - 1));
  for (let step = 0; step < total; step++) {
    const index = (offset + step) % total;
    const col = index % map.cols;
    const row = Math.floor(index / map.cols);
    const x = (col + 0.5) * map.tileSize;
    const y = (row + 0.5) * map.tileSize;
    if (clear(x, y)) return { x, y, zone: zoneAtPx(map, x, y) };
  }
  throw new Error("generated arena has no safe chest placement candidate");
}

export interface ChestZoneWeights {
  weaponChance: number;
  relicChance: number;
  moneyChance: number;
  rareRelicChance: number;
}

export const COMMONS_CHEST_WEIGHTS: ChestZoneWeights = {
  weaponChance: 0.5,
  relicChance: 0.7,
  moneyChance: 0.8,
  rareRelicChance: 0.08,
};

export const SCAR_CHEST_WEIGHTS: ChestZoneWeights = {
  weaponChance: 0.7,
  relicChance: 0.85,
  moneyChance: 0.9,
  rareRelicChance: 0.2,
};

export function chestWeightsForZone(zone: MapZoneId): ChestZoneWeights {
  return zone === MAP_ZONE_SCAR ? SCAR_CHEST_WEIGHTS : COMMONS_CHEST_WEIGHTS;
}

export type WeaponTierWeights = readonly [number, number, number, number, number];

export const WEAPON_TIER_CURVE_ANCHORS = [
  { minute: 0, weights: [64, 28, 8, 0, 0] },
  { minute: 5, weights: [44, 30, 18, 7, 1] },
  { minute: 10, weights: [26, 26, 24, 17, 7] },
  { minute: 15, weights: [14, 18, 25, 25, 18] },
] as const satisfies readonly Readonly<{ minute: number; weights: WeaponTierWeights }>[];

/** L2's Scar low/mid/high ratios (35/60, 40/30, 25/10), expanded over five tiers. */
export const SCAR_WEAPON_TIER_MULTIPLIERS: WeaponTierWeights = [
  7 / 12,
  7 / 12,
  4 / 3,
  5 / 2,
  5 / 2,
];

function interpolatedTierWeights(elapsedSeconds: number): WeaponTierWeights {
  const minute = Number.isFinite(elapsedSeconds) ? Math.max(0, elapsedSeconds / 60) : 0;
  const last = WEAPON_TIER_CURVE_ANCHORS.at(-1);
  if (!last || minute >= last.minute) return last?.weights ?? [1, 0, 0, 0, 0];
  for (let index = 1; index < WEAPON_TIER_CURVE_ANCHORS.length; index++) {
    const right = WEAPON_TIER_CURVE_ANCHORS[index];
    const left = WEAPON_TIER_CURVE_ANCHORS[index - 1];
    if (!left || !right || minute > right.minute) continue;
    const progress = (minute - left.minute) / (right.minute - left.minute);
    return left.weights.map(
      (weight, tierIndex) =>
        weight + ((right.weights[tierIndex] ?? weight) - weight) * progress,
    ) as unknown as WeaponTierWeights;
  }
  return last.weights;
}

/** Time, zone, and L2 luck compose as multipliers before candidate availability and normalization. */
export function chestWeaponTierWeights(
  elapsedSeconds: number,
  zone: MapZoneId,
  luckStacks = 0,
): WeaponTierWeights {
  const timeWeights = interpolatedTierWeights(elapsedSeconds);
  const zoneMultipliers =
    zone === MAP_ZONE_SCAR ? SCAR_WEAPON_TIER_MULTIPLIERS : ([1, 1, 1, 1, 1] as const);
  const highTierLuck = 1 + Math.max(0, Math.min(20, luckStacks)) * 0.05;
  return timeWeights.map(
    (weight, index) =>
      weight * (zoneMultipliers[index] ?? 1) * (index >= 3 ? highTierLuck : 1),
  ) as unknown as WeaponTierWeights;
}

function pickWeightedTier(rng: Rng, weights: WeaponTierWeights): WeaponTier {
  const total = weights.reduce((sum, weight) => sum + Math.max(0, weight), 0);
  if (total <= 0) return 1;
  const draw = rng.range(0, total);
  let cursor = 0;
  for (let index = 0; index < weights.length; index++) {
    cursor += Math.max(0, weights[index] ?? 0);
    if (draw < cursor) return (index + 1) as WeaponTier;
  }
  return 5;
}

function stringSeed(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export interface ChestRollInput {
  roomSeed: number;
  chestSequence: number;
  spawnTick: number;
  elapsedSeconds: number;
  zone: MapZoneId;
  kind: ChestKind;
  playerKey: string;
  luckStacks?: number;
  ownedRareIds?: readonly RareRelicId[];
  weaponIds: readonly string[];
}

export interface ChestWeaponReward {
  id: string;
  tier: WeaponTier;
}

export interface ChestRelicReward {
  id: CommonRelicId | RareRelicId;
  rarity: "common" | "rare";
}

export interface ChestReward {
  weapon?: ChestWeaponReward;
  relics: ChestRelicReward[];
  money: number;
}

function commonRelic(rng: Rng): ChestRelicReward {
  return { id: rng.pick(COMMON_RELIC_IDS), rarity: "common" };
}

export function rollChestReward(input: Readonly<ChestRollInput>): ChestReward {
  const weights = chestWeightsForZone(input.zone);
  const playerSeed = stringSeed(input.playerKey);
  const baseSeed = mixSeeds(
    input.roomSeed,
    input.chestSequence,
    input.spawnTick,
    playerSeed,
    0xc0e57,
  );
  const categoryRng = makeRng(mixSeeds(baseSeed, 0xca7e));
  const weaponRng = makeRng(mixSeeds(baseSeed, 0x7ea9));
  const relicRng = makeRng(mixSeeds(baseSeed, 0x4e11c));
  const moneyRng = makeRng(mixSeeds(baseSeed, 0x50c1));
  const luckMultiplier = 1 + Math.max(0, Math.min(20, input.luckStacks ?? 0)) * 0.05;
  let hasWeapon =
    input.kind === CHEST_KIND_WEAPON_CACHE || categoryRng.chance(weights.weaponChance);
  const hasRelic = categoryRng.chance(weights.relicChance);
  let hasMoney = categoryRng.chance(weights.moneyChance);
  if (!hasWeapon && !hasRelic && !hasMoney) hasMoney = true;

  let weapon: ChestWeaponReward | undefined;
  if (hasWeapon && input.weaponIds.length > 0) {
    const candidatesByTier = new Map<WeaponTier, string[]>();
    for (const id of input.weaponIds) {
      const weaponDef = WEAPONS[id];
      if (!weaponDef) continue;
      const candidates = candidatesByTier.get(weaponDef.tier) ?? [];
      candidates.push(id);
      candidatesByTier.set(weaponDef.tier, candidates);
    }
    let tierWeights = chestWeaponTierWeights(
      input.elapsedSeconds,
      input.zone,
      input.luckStacks,
    ).map((weight, index) =>
      (candidatesByTier.get((index + 1) as WeaponTier)?.length ?? 0) > 0 ? weight : 0,
    ) as unknown as WeaponTierWeights;
    if (tierWeights.every((weight) => weight <= 0)) {
      tierWeights = tierWeights.map((_weight, index) =>
        (candidatesByTier.get((index + 1) as WeaponTier)?.length ?? 0) > 0 ? 1 : 0,
      ) as unknown as WeaponTierWeights;
    }
    const tier = pickWeightedTier(weaponRng, tierWeights);
    const candidates = candidatesByTier.get(tier) ?? [];
    if (candidates.length > 0) weapon = { id: weaponRng.pick(candidates), tier };
    else hasWeapon = false;
  }

  const relics: ChestRelicReward[] = [];
  if (hasRelic) {
    const rareChance = Math.min(0.75, weights.rareRelicChance * luckMultiplier);
    if (relicRng.chance(rareChance)) {
      const rare = relicRng.pick(RARE_RELIC_IDS);
      if (input.ownedRareIds?.includes(rare)) relics.push(commonRelic(relicRng));
      else relics.push({ id: rare, rarity: "rare" });
    } else {
      relics.push(commonRelic(relicRng));
      if (relicRng.chance(0.2)) relics.push(commonRelic(relicRng));
    }
  }

  const money = hasMoney
    ? moneyRng.int(8, 16) + Math.max(0, Math.floor(input.elapsedSeconds / 60))
    : 0;
  return { weapon, relics, money };
}

export interface ChestOpenReceipt {
  chestId: string;
  zone: MapZoneId;
  kind: ChestKind;
  weapon?: ChestWeaponReward & { name: string };
  relics: Array<ChestRelicReward & { label: string; stacks: number }>;
  money: number;
}
