/**
 * Pet v1's closed, deterministic identity catalog. Accounts persist only ownership + Bond XP; numeric
 * tuning lives here and is snapshotted by the server at a run boundary.
 */

export const PET_IDS = [
  "verdant-wing",
  "hearth-newt",
  "lodestar-moth",
  "copper-snail",
  "gilded-gecko",
  "brass-crab",
  "pale-firefly",
  "slate-tortoise",
] as const;

export type PetId = (typeof PET_IDS)[number];
export type PetStageBand = 1 | 2 | 3;

/** Patchable balance-definition epoch. Active runs retain the version and resolved numbers they joined on. */
export const PET_CATALOG_VERSION = 1 as const;
export const PET_MAX_LEVEL = 10 as const;
export const PET_BOND_XP_THRESHOLDS = [0, 120, 300, 540, 840, 1200, 1620, 2100, 2700, 3600] as const;
export const PET_MAX_BOND_XP = PET_BOND_XP_THRESHOLDS[PET_BOND_XP_THRESHOLDS.length - 1]!;

/** Stable normalized slots let later fusion/evolution manifests replace parts without migrating accounts. */
export const PET_PART_SLOTS = ["core", "primary", "secondary"] as const;

export const PET_STAGE_DEFS = [
  { band: 1, name: "Hatchling", minLevel: 1, maxLevel: 3, partSlots: PET_PART_SLOTS },
  { band: 2, name: "Awakened", minLevel: 4, maxLevel: 7, partSlots: PET_PART_SLOTS },
  { band: 3, name: "Ascendant", minLevel: 8, maxLevel: 10, partSlots: PET_PART_SLOTS },
] as const;

/** Source-neutral scalar/event inputs consumed at existing authoritative server seams. */
export interface PetMods {
  passiveRegenMultiplier: number;
  healingReceivedMultiplier: number;
  weaponChargeCapacityAdd: number;
  descentHealMaxHpFraction: number;
  moneyDropReachAdd: number;
  boundaryMoneyReach: number;
  earnedPickupRadius: number;
  bagCapacityAdd: number;
  saleBonusRate: number;
  saleBonusCap: number;
  reloadDurationMultiplier: number;
  stowedReloadRate: number;
  reviveReachAdd: number;
  reviveHpFraction: number;
  groundHazardDamageMultiplier: number;
  pitRegenMultiplier: number;
  pitRegenSeconds: number;
}

export const PET_CATALOG = {
  "verdant-wing": {
    id: "verdant-wing",
    name: "Verdant Wing",
    budgetKey: "sustain.regen-ammo",
    maxLevel: PET_MAX_LEVEL,
    bonus: { kind: "passive-regen", multiplierPerLevel: 0.05 },
    capstone: { kind: "gun-thrown-capacity", capacityAdd: 1 },
  },
  "hearth-newt": {
    id: "hearth-newt",
    name: "Hearth Newt",
    budgetKey: "sustain.healing",
    maxLevel: PET_MAX_LEVEL,
    bonus: { kind: "healing-received", multiplierPerLevel: 0.02 },
    capstone: { kind: "descent-heal", maxHpFraction: 0.15 },
  },
  "lodestar-moth": {
    id: "lodestar-moth",
    name: "Lodestar Moth",
    budgetKey: "economy.money-collection",
    maxLevel: PET_MAX_LEVEL,
    bonus: { kind: "money-reach", base: 180, perLevel: 18 },
    capstone: { kind: "boundary-money-sweep", radius: 600 },
  },
  "copper-snail": {
    id: "copper-snail",
    name: "Copper Snail",
    budgetKey: "economy.weapon-carry",
    maxLevel: PET_MAX_LEVEL,
    bonus: { kind: "earned-pickup-reach", base: 46, perLevel: 4 },
    capstone: { kind: "bag-capacity", capacityAdd: 1 },
  },
  "gilded-gecko": {
    id: "gilded-gecko",
    name: "Gilded Gecko",
    budgetKey: "economy.earned-sale",
    maxLevel: PET_MAX_LEVEL,
    bonus: { kind: "earned-sale", ratePerLevel: 0.02, capPerLevel: 2 },
    capstone: { kind: "sale-cap", cap: 30 },
  },
  "brass-crab": {
    id: "brass-crab",
    name: "Brass Crab",
    budgetKey: "resource.reload-refill",
    maxLevel: PET_MAX_LEVEL,
    bonus: { kind: "reload-duration", reductionPerLevel: 0.01 },
    capstone: { kind: "stowed-reload-rate", rate: 1.25 },
  },
  "pale-firefly": {
    id: "pale-firefly",
    name: "Pale Firefly",
    budgetKey: "sustain.revive",
    maxLevel: PET_MAX_LEVEL,
    bonus: { kind: "revive-reach", base: 96, perLevel: 6 },
    capstone: { kind: "revive-hp", fraction: 0.4 },
  },
  "slate-tortoise": {
    id: "slate-tortoise",
    name: "Slate Tortoise",
    budgetKey: "sustain.ground-hazard",
    maxLevel: PET_MAX_LEVEL,
    bonus: { kind: "ground-hazard-damage", reductionPerLevel: 0.015 },
    capstone: { kind: "pit-regen", multiplier: 1.5, seconds: 3 },
  },
} as const;

export type PetDef = (typeof PET_CATALOG)[PetId];

export function isPetId(value: unknown): value is PetId {
  return typeof value === "string" && (PET_IDS as readonly string[]).includes(value);
}

export function sanitizeBondXp(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(PET_MAX_BOND_XP, Math.floor(numeric)));
}

export function petLevelForXp(value: unknown): number {
  const xp = sanitizeBondXp(value);
  let level = 1;
  for (let i = 1; i < PET_BOND_XP_THRESHOLDS.length; i++) {
    if (xp < PET_BOND_XP_THRESHOLDS[i]!) break;
    level = i + 1;
  }
  return level;
}

export function petStageBandForLevel(value: number): PetStageBand {
  const level = Number.isFinite(value) ? Math.max(1, Math.min(PET_MAX_LEVEL, Math.floor(value))) : 1;
  return level <= 3 ? 1 : level <= 7 ? 2 : 3;
}

export function petHasCapstone(level: number): boolean {
  return Number.isFinite(level) && Math.floor(level) >= PET_MAX_LEVEL;
}

/** Resolve once per run. The returned object is never constructed in the 20 Hz loop. */
export function petModsForLevel(id: PetId, value: number): Readonly<PetMods> {
  const level = Number.isFinite(value) ? Math.max(1, Math.min(PET_MAX_LEVEL, Math.floor(value))) : 1;
  const capstone = level === PET_MAX_LEVEL;
  const mods: PetMods = {
    passiveRegenMultiplier: 1,
    healingReceivedMultiplier: 1,
    weaponChargeCapacityAdd: 0,
    descentHealMaxHpFraction: 0,
    moneyDropReachAdd: 0,
    boundaryMoneyReach: 0,
    earnedPickupRadius: 0,
    bagCapacityAdd: 0,
    saleBonusRate: 0,
    saleBonusCap: 0,
    reloadDurationMultiplier: 1,
    stowedReloadRate: 1,
    reviveReachAdd: 0,
    reviveHpFraction: 0,
    groundHazardDamageMultiplier: 1,
    pitRegenMultiplier: 1,
    pitRegenSeconds: 0,
  };

  const def = PET_CATALOG[id];
  switch (def.bonus.kind) {
    case "passive-regen":
      mods.passiveRegenMultiplier = 1 + def.bonus.multiplierPerLevel * level;
      if (capstone && def.capstone.kind === "gun-thrown-capacity") {
        mods.weaponChargeCapacityAdd = def.capstone.capacityAdd;
      }
      break;
    case "healing-received":
      mods.healingReceivedMultiplier = 1 + def.bonus.multiplierPerLevel * level;
      if (capstone && def.capstone.kind === "descent-heal") {
        mods.descentHealMaxHpFraction = def.capstone.maxHpFraction;
      }
      break;
    case "money-reach":
      mods.moneyDropReachAdd = def.bonus.perLevel * level;
      if (capstone && def.capstone.kind === "boundary-money-sweep") {
        mods.boundaryMoneyReach = def.capstone.radius;
      }
      break;
    case "earned-pickup-reach":
      mods.earnedPickupRadius = def.bonus.base + def.bonus.perLevel * level;
      if (capstone && def.capstone.kind === "bag-capacity") {
        mods.bagCapacityAdd = def.capstone.capacityAdd;
      }
      break;
    case "earned-sale":
      mods.saleBonusRate = def.bonus.ratePerLevel * level;
      mods.saleBonusCap =
        capstone && def.capstone.kind === "sale-cap"
          ? def.capstone.cap
          : def.bonus.capPerLevel * level;
      break;
    case "reload-duration":
      mods.reloadDurationMultiplier = 1 - def.bonus.reductionPerLevel * level;
      if (capstone && def.capstone.kind === "stowed-reload-rate") {
        mods.stowedReloadRate = def.capstone.rate;
      }
      break;
    case "revive-reach":
      mods.reviveReachAdd = def.bonus.perLevel * level;
      if (capstone && def.capstone.kind === "revive-hp") {
        mods.reviveHpFraction = def.capstone.fraction;
      }
      break;
    case "ground-hazard-damage":
      mods.groundHazardDamageMultiplier = 1 - def.bonus.reductionPerLevel * level;
      if (capstone && def.capstone.kind === "pit-regen") {
        mods.pitRegenMultiplier = def.capstone.multiplier;
        mods.pitRegenSeconds = def.capstone.seconds;
      }
      break;
  }
  return mods;
}
