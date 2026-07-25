import { ALL_AUGMENT_IDS, type AugmentDef, augmentStackCap, countAugment } from "./augments.js";
import { TICK_RATE } from "./constants.js";
import {
  type ArenaMap,
  isArenaDiscSafe,
  MAP_ZONE_SCAR,
  type MapZoneId,
  zoneAtPx,
} from "./mapgen.js";
import { PET_IDS, type PetId } from "./pets.js";
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

export const CHEST_CONTENT_TRINKET = "trinket" as const;
export const CHEST_CONTENT_WEAPON = "weapon" as const;
export const CHEST_CONTENT_PET = "pet" as const;
export const CHEST_CONTENT_HP_POTION = "hp-potion" as const;
export const CHEST_CONTENT_MONEY = "money" as const;
export type ChestContentKind =
  | typeof CHEST_CONTENT_TRINKET
  | typeof CHEST_CONTENT_WEAPON
  | typeof CHEST_CONTENT_PET
  | typeof CHEST_CONTENT_HP_POTION
  | typeof CHEST_CONTENT_MONEY;

export interface ChestZoneWeights {
  content: Readonly<Record<ChestContentKind, number>>;
  rareTrinketChance: number;
  augmentTrinketChance: number;
}

/** Percent weights. Scar shifts value out of consumables/currency and into lasting run power. */
export const COMMONS_CHEST_WEIGHTS: ChestZoneWeights = {
  content: {
    [CHEST_CONTENT_TRINKET]: 34,
    [CHEST_CONTENT_WEAPON]: 24,
    [CHEST_CONTENT_PET]: 10,
    [CHEST_CONTENT_HP_POTION]: 14,
    [CHEST_CONTENT_MONEY]: 18,
  },
  rareTrinketChance: 0.08,
  augmentTrinketChance: 0.35,
};

export const SCAR_CHEST_WEIGHTS: ChestZoneWeights = {
  content: {
    [CHEST_CONTENT_TRINKET]: 38,
    [CHEST_CONTENT_WEAPON]: 30,
    [CHEST_CONTENT_PET]: 12,
    [CHEST_CONTENT_HP_POTION]: 8,
    [CHEST_CONTENT_MONEY]: 12,
  },
  rareTrinketChance: 0.2,
  augmentTrinketChance: 0.5,
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
      (weight, tierIndex) => weight + ((right.weights[tierIndex] ?? weight) - weight) * progress,
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
    (weight, index) => weight * (zoneMultipliers[index] ?? 1) * (index >= 3 ? highTierLuck : 1),
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
  ownedAugments?: string;
  activePetId?: PetId | "";
  weaponIds: readonly string[];
}

export interface ChestWeaponReward {
  id: string;
  tier: WeaponTier;
}

export type TrinketId = CommonRelicId | RareRelicId;

export interface ChestTrinketReward {
  id: CommonRelicId | RareRelicId;
  rarity: "common" | "rare";
  augmentId?: string;
}

export interface ChestReward {
  content: ChestContentKind;
  weapon?: ChestWeaponReward;
  trinket?: ChestTrinketReward;
  pet?: { id: PetId };
  potion?: { healFraction: number };
  money: number;
}

function commonTrinket(rng: Rng): ChestTrinketReward {
  return { id: rng.pick(COMMON_RELIC_IDS), rarity: "common" };
}

/** Internal relic ids remain stable; this mapping is the explicit augment payload carried by each trinket. */
export const TRINKET_AUGMENT_MAPPING: Readonly<Record<TrinketId, readonly string[]>> = {
  "energy-pool": ["beam-vent"],
  "energy-regen": ["overcharge"],
  "parry-reach": ["counterblade"],
  "dodge-recovery": ["hair-trigger"],
  "move-speed": ["twin-fang"],
  "hp-regen": ["second-wind"],
  luck: ["ricochet-rounds"],
  crit: ["hollowpoints"],
  "jump-count": ["arc-split"],
  "dodge-shuffle": ["deflector"],
  "dodge-ninja-flip": ["iron-stance"],
  "dodge-phase-step": ["bulwark"],
  "dodge-bloodhound-step": ["beam-focus"],
  revive: ["emberguard"],
  "one-shot-protection": ["brand", "conflagration"],
};

const CHEST_CONTENT_KINDS = [
  CHEST_CONTENT_TRINKET,
  CHEST_CONTENT_WEAPON,
  CHEST_CONTENT_PET,
  CHEST_CONTENT_HP_POTION,
  CHEST_CONTENT_MONEY,
] as const;

function weightedContent(rng: Rng, weights: ChestZoneWeights): ChestContentKind {
  const total = CHEST_CONTENT_KINDS.reduce(
    (sum, kind) => sum + Math.max(0, weights.content[kind]),
    0,
  );
  if (total <= 0) return CHEST_CONTENT_MONEY;
  const draw = rng.range(0, total);
  let cursor = 0;
  for (const kind of CHEST_CONTENT_KINDS) {
    cursor += Math.max(0, weights.content[kind]);
    if (draw < cursor) return kind;
  }
  return CHEST_CONTENT_MONEY;
}

export const CHEST_HP_POTION_HEAL_FRACTION = 0.35 as const;

export interface HpPotionResolution {
  hp: number;
  healed: number;
}

/** Exact instant-heal math used by authority and tests. Invalid inputs collapse safely and overheal clamps. */
export function resolveChestHpPotion(
  currentHp: number,
  maxHp: number,
  healFraction: number = CHEST_HP_POTION_HEAL_FRACTION,
): HpPotionResolution {
  const maximum = Number.isFinite(maxHp) ? Math.max(0, maxHp) : 0;
  const current = Number.isFinite(currentHp) ? Math.max(0, Math.min(maximum, currentHp)) : 0;
  const fraction = Number.isFinite(healFraction) ? Math.max(0, healFraction) : 0;
  const hp = Math.min(maximum, current + maximum * fraction);
  return { hp, healed: hp - current };
}

function eligibleMappedAugments(trinketId: TrinketId, owned: string): string[] {
  return (TRINKET_AUGMENT_MAPPING[trinketId] ?? []).filter(
    (id) =>
      (ALL_AUGMENT_IDS as readonly string[]).includes(id) &&
      countAugment(owned, id) < augmentStackCap(id),
  );
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
  const trinketRng = makeRng(mixSeeds(baseSeed, 0x4e11c));
  const augmentRng = makeRng(mixSeeds(baseSeed, 0xa091e));
  const petRng = makeRng(mixSeeds(baseSeed, 0x0e751));
  const moneyRng = makeRng(mixSeeds(baseSeed, 0x50c1));
  const luckMultiplier = 1 + Math.max(0, Math.min(20, input.luckStacks ?? 0)) * 0.05;
  let content: ChestContentKind =
    input.kind === CHEST_KIND_WEAPON_CACHE
      ? CHEST_CONTENT_WEAPON
      : weightedContent(categoryRng, weights);

  let weapon: ChestWeaponReward | undefined;
  if (content === CHEST_CONTENT_WEAPON && input.weaponIds.length > 0) {
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
    else content = CHEST_CONTENT_MONEY;
  } else if (content === CHEST_CONTENT_WEAPON) {
    content = CHEST_CONTENT_MONEY;
  }

  let trinket: ChestTrinketReward | undefined;
  if (content === CHEST_CONTENT_TRINKET) {
    const rareChance = Math.min(0.75, weights.rareTrinketChance * luckMultiplier);
    if (trinketRng.chance(rareChance)) {
      const rare = trinketRng.pick(RARE_RELIC_IDS);
      if (input.ownedRareIds?.includes(rare)) trinket = commonTrinket(trinketRng);
      else trinket = { id: rare, rarity: "rare" };
    } else {
      trinket = commonTrinket(trinketRng);
    }
    const eligible = eligibleMappedAugments(trinket.id, input.ownedAugments ?? "");
    const augmentChance = Math.min(0.9, weights.augmentTrinketChance * luckMultiplier);
    if (eligible.length > 0 && augmentRng.chance(augmentChance)) {
      trinket.augmentId = augmentRng.pick(eligible);
    }
  }

  const petCandidates = PET_IDS.filter((id) => id !== input.activePetId);
  const pet =
    content === CHEST_CONTENT_PET
      ? { id: petRng.pick(petCandidates.length > 0 ? petCandidates : PET_IDS) }
      : undefined;
  const potion =
    content === CHEST_CONTENT_HP_POTION
      ? { healFraction: CHEST_HP_POTION_HEAL_FRACTION }
      : undefined;
  const money =
    content === CHEST_CONTENT_MONEY
      ? moneyRng.int(8, 16) + Math.max(0, Math.floor(input.elapsedSeconds / 60))
      : 0;
  return { content, weapon, trinket, pet, potion, money };
}

export interface ChestOpenReceipt {
  chestId: string;
  zone: MapZoneId;
  kind: ChestKind;
  weapon?: ChestWeaponReward & { name: string };
  trinket?: ChestTrinketReward & {
    label: string;
    stacks: number;
    augment?: Pick<AugmentDef, "id" | "name" | "desc"> & { stacks: number };
  };
  pet?: { id: PetId; name: string; replacedPet?: { id: PetId; name: string } };
  potion?: { healFraction: number; healed: number; hp: number; maxHp: number };
  money: number;
}
