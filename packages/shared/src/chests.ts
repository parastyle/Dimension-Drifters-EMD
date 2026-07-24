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
import { WEAPONS, type WeaponDef, weaponAttackCooldown, weaponDamageSources } from "./weapons.js";

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

export type PlaceholderWeaponTier = "low" | "mid" | "high";

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
  tierWeights: readonly [low: number, mid: number, high: number];
  rareRelicChance: number;
}

export const COMMONS_CHEST_WEIGHTS: ChestZoneWeights = {
  weaponChance: 0.5,
  relicChance: 0.7,
  moneyChance: 0.8,
  tierWeights: [60, 30, 10],
  rareRelicChance: 0.08,
};

export const SCAR_CHEST_WEIGHTS: ChestZoneWeights = {
  weaponChance: 0.7,
  relicChance: 0.85,
  moneyChance: 0.9,
  tierWeights: [35, 40, 25],
  rareRelicChance: 0.2,
};

export function chestWeightsForZone(zone: MapZoneId): ChestZoneWeights {
  return zone === MAP_ZONE_SCAR ? SCAR_CHEST_WEIGHTS : COMMONS_CHEST_WEIGHTS;
}

/** L2 placeholder only. L5 replaces these damage-budget bands with the catalog-owned tier curve. */
export function placeholderWeaponBudget(weapon: Readonly<WeaponDef>): number {
  const payload = weaponDamageSources(weapon).reduce(
    (total, source) => total + Math.max(0, source.base) * Math.max(1, source.count),
    0,
  );
  const cadence = Math.max(0.2, weaponAttackCooldown(weapon));
  return payload + Math.sqrt(payload / cadence) * 2;
}

/** L2 placeholder only. Thresholds intentionally live beside the sampler for surgical L5 replacement. */
export function placeholderWeaponTier(weapon: Readonly<WeaponDef>): PlaceholderWeaponTier {
  const budget = placeholderWeaponBudget(weapon);
  if (budget < 24) return "low";
  if (budget < 48) return "mid";
  return "high";
}

function pickWeightedTier(
  rng: Rng,
  base: readonly [number, number, number],
  elapsedSeconds: number,
  luckMultiplier: number,
): PlaceholderWeaponTier {
  const progress = Math.max(0, Math.min(1, elapsedSeconds / 1_200));
  const low = base[0] * (1 - 0.45 * progress);
  const mid = base[1] * (1 + 0.15 * progress);
  const high = base[2] * (1 + 1.5 * progress) * luckMultiplier;
  const total = low + mid + high;
  const draw = rng.range(0, total);
  if (draw < low) return "low";
  if (draw < low + mid) return "mid";
  return "high";
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
  tier: PlaceholderWeaponTier;
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
    const tier = pickWeightedTier(
      weaponRng,
      weights.tierWeights,
      input.elapsedSeconds,
      luckMultiplier,
    );
    const inTier = input.weaponIds.filter((id) => {
      const weaponDef = WEAPONS[id];
      return weaponDef ? placeholderWeaponTier(weaponDef) === tier : false;
    });
    const candidates = inTier.length > 0 ? inTier : input.weaponIds.filter((id) => !!WEAPONS[id]);
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
