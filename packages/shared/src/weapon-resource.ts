import {
  effectiveAcceptedWeaponInterval,
  type WeaponDelivery,
  weaponDeliveryFor,
} from "./combat.js";
import {
  DRIVE_BEAM_GROSS_DRAIN_PER_SECOND,
  DRIVE_BEAM_IGNITION_COST,
  DRIVE_BEAM_NET_DRAIN_PER_SECOND,
  DRIVE_BEAM_RESTART_THRESHOLD,
  DRIVE_CAPACITY,
  DRIVE_COST_QUANTUM,
  DRIVE_FLOOR_REGEN_PER_SECOND,
  DRIVE_GUN_BURST_RETENTION,
  DRIVE_LOAD_MAX,
  DRIVE_THROWN_BURST_RETENTION,
} from "./constants.js";
import { katanaExpectedMechanic } from "./melee.js";
import {
  ACTIVE_WEAPON_CATALOG_IDS,
  ARCHIVED_WEAPON_IDS,
  hybridProjectileDamagePerAcceptedBeat,
  WEAPONS,
  type WeaponDef,
  weaponAttackCooldown,
} from "./weapons.js";

export const WEAPON_RESOURCE_FORMULA_VERSION = 1 as const;

export const WEAPON_RESOURCE_SIZE_FACTORS = Object.freeze({
  S: 0.9,
  M: 1,
  L: 1.15,
  XL: 1.3,
} as const);

/** Frozen formula-v1 medians. Catalog additions must not reprice existing weapon instances. */
export const WEAPON_RESOURCE_FROZEN_MEDIANS = Object.freeze({
  "melee:melee": 21.4,
  "melee:thrown": 54.4768,
  "caster:thrown": 54.4768,
  "ranged:gun": 58.752,
  "caster:cast": 126.8185,
  "caster:melee": 51.072,
  "caster:gun": 61.0667,
  "ranged:beam": 31.0259,
  "ranged:zone": 20.9549,
  "caster:beam": 20.9549,
  "caster:zone": 20.9549,
} as const);

export type WeaponResourceBucket = keyof typeof WEAPON_RESOURCE_FROZEN_MEDIANS;

export interface WeaponResourceOverride {
  readonly multiplier: number;
  readonly reason: string;
}

/** Bounded formula-v1 utility exceptions. More than fifteen entries is a formula review failure. */
export const WEAPON_RESOURCE_OVERRIDES: Readonly<Record<string, WeaponResourceOverride>> =
  Object.freeze({
    "gravediggers-spade": Object.freeze({
      multiplier: 1.15,
      reason: "A successful swing can revive; that utility has no damage statistic.",
    }),
    "drift-greatkatana-tempest-regent": Object.freeze({
      multiplier: 1.1,
      reason: "Perfect continuations grant brief invulnerability outside the damage formula.",
    }),
  });

export interface WeaponResourceProfile {
  readonly formulaVersion: typeof WEAPON_RESOURCE_FORMULA_VERSION;
  readonly weaponId: string;
  readonly delivery: WeaponDelivery;
  readonly bucket: WeaponResourceBucket;
  readonly size: WeaponDef["tags"]["size"];
  readonly neutralAcceptedInterval: number;
  readonly effectivePower: number;
  readonly frozenMedian: number;
  readonly load: number;
  readonly override: number;
  readonly overrideReason: string;
  readonly legacyNeutralCost: number;
  readonly neutralCost: number;
  readonly grossSpendPerSecond: number;
  readonly netSpendPerSecond: number;
  readonly actionsFromFull: number;
  readonly zeroToNextActionSeconds: number;
  readonly holdToEmptySeconds: number;
  readonly repeatedCyclePower: number;
  readonly branch: "tap" | "beam" | "zone";
  readonly ignitionCost: number;
  readonly grossDrainPerSecond: number;
  readonly netDrainPerSecond: number;
  readonly restartThreshold: number;
}

function clamp(min: number, max: number, value: number): number {
  return Math.max(min, Math.min(max, value));
}

export function floorDriveCost(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor((value + 1e-9) / DRIVE_COST_QUANTUM) * DRIVE_COST_QUANTUM;
}

function pierceTargets(pierce: number | undefined): number {
  return 1 + 0.6 * (Math.min(6, Math.max(1, pierce ?? 1)) - 1);
}

function effectiveRange(weapon: WeaponDef, delivery: WeaponDelivery): number {
  if (delivery === "zone") return weapon.groundZone?.placementRange ?? weapon.range;
  if (delivery === "beam") return weapon.beam?.range ?? weapon.range;
  if (delivery === "gun") return weapon.gun?.range ?? weapon.range;
  if (delivery === "cast")
    return weapon.chargedProjectile?.range ?? weapon.cast?.range ?? weapon.range;
  if (delivery === "thrown") return weapon.thrown?.range ?? weapon.range;
  return weapon.range * katanaExpectedMechanic(weapon).maxReachMultiplier;
}

function reachCredit(range: number): number {
  return 1 + Math.min(0.4, Math.max(0, range) / 2500);
}

function meleeDamageBudget(weapon: WeaponDef): number {
  const katana = katanaExpectedMechanic(weapon);
  return (
    (weapon.suppressMeleeHitbox === true ? 0 : Math.max(0, weapon.damage)) *
      katana.averageDamageMultiplier +
    katana.averageBurstDamage +
    Math.max(0, weapon.quake?.damage ?? 0) +
    0.6 *
      Math.max(0, weapon.chainLightning?.damage ?? 0) *
      Math.max(0, weapon.chainLightning?.jumps ?? 0) +
    0.7 * Math.max(0, weapon.scatter?.damage ?? 0) * Math.max(0, weapon.scatter?.count ?? 0) +
    Math.max(0, weapon.scatter?.explode?.damage ?? 0) +
    hybridProjectileDamagePerAcceptedBeat(weapon)
  );
}

/** Repaired review power used only by formula v1; rarity and affixes never enter. */
export function resourceEffectivePower(
  weapon: WeaponDef,
  neutralAcceptedInterval = effectiveAcceptedWeaponInterval(weapon, weaponAttackCooldown(weapon)),
): number {
  const delivery = weaponDeliveryFor(weapon);
  const interval = Math.max(0.001, neutralAcceptedInterval);
  let budget = 0;
  if (delivery === "beam" || delivery === "zone") {
    const beam = weapon.beam;
    const zone = weapon.groundZone;
    // The learned early-vent/full-overheat estimator is normalized to the shared v1 duty cycle. Width and
    // aggregate coverage are bounded like the existing curation grammar; beam price itself is mechanical.
    const width = beam?.width ?? (zone?.initialRadius ?? 24) * 2;
    const dps = beam?.damagePerSecond ?? zone?.damagePerSecond ?? 0;
    const reach = beam?.range ?? zone?.placementRange ?? weapon.range;
    const active = beam ? Math.min(1.25, Math.max(0.05, beam.overheat.maxChannelSeconds)) : 1.25;
    const recovery = beam
      ? Math.max(1.5, beam.overheat.lockSeconds) +
        0.35 / Math.max(0.001, beam.overheat.coolPerSecond)
      : 1.5 + (zone?.lingerSeconds ?? 0);
    const coverage = 1 + Math.min(0.4, Math.max(0, width) / 160);
    return (dps * coverage * reachCredit(reach) * active) / (active + recovery);
  }
  if (delivery === "thrown") {
    budget = Math.max(0, weapon.thrown!.damage) * pierceTargets(weapon.thrown!.pierce);
  } else if (delivery === "gun") {
    const gun = weapon.gun!;
    budget =
      (0.85 * Math.max(0, gun.damage) * Math.max(1, gun.pellets ?? 1) * pierceTargets(gun.pierce) +
        Math.max(0, gun.explode?.damage ?? 0)) *
      Math.max(1, gun.burst?.count ?? 1) *
      (1 + 0.5 * Math.max(0, gun.bounces ?? 0));
  } else if (delivery === "cast") {
    budget = weapon.chargedProjectile
      ? Math.max(
          0,
          weapon.chargedProjectile.directDamageMax +
            weapon.chargedProjectile.explosionDamageMax,
        )
      : Math.max(0, weapon.cast!.damage) * pierceTargets(weapon.cast!.pierce);
  } else {
    budget = meleeDamageBudget(weapon);
  }
  return (budget / interval) * reachCredit(effectiveRange(weapon, delivery));
}

function bucketFor(weapon: WeaponDef, delivery: WeaponDelivery): WeaponResourceBucket {
  const key = `${weapon.tags.classPool}:${delivery}`;
  if (!(key in WEAPON_RESOURCE_FROZEN_MEDIANS)) {
    throw new Error(`Weapon ${weapon.id} has no frozen Drive bucket: ${key}`);
  }
  return key as WeaponResourceBucket;
}

export function driveCostForProfile(
  profile: WeaponResourceProfile,
  effectiveInterval: number,
): number {
  if (profile.branch === "beam" || profile.branch === "zone") return 0;
  const interval = Math.max(0.001, effectiveInterval);
  const powerCost = DRIVE_FLOOR_REGEN_PER_SECOND * interval * profile.load;
  const legacyCost = (profile.legacyNeutralCost * interval) / profile.neutralAcceptedInterval;
  return floorDriveCost(Math.max(powerCost, legacyCost) * profile.override);
}

/** Pure formula-v1 generator for a canonical or mutation-test WeaponDef. */
export function deriveWeaponResourceProfile(weapon: WeaponDef): WeaponResourceProfile {
  const delivery = weaponDeliveryFor(weapon);
  const bucket = bucketFor(weapon, delivery);
  const t0 = effectiveAcceptedWeaponInterval(weapon, weaponAttackCooldown(weapon));
  const power = resourceEffectivePower(weapon, t0);
  const median = WEAPON_RESOURCE_FROZEN_MEDIANS[bucket];
  const override = WEAPON_RESOURCE_OVERRIDES[weapon.id];
  if (delivery === "beam" || delivery === "zone") {
    return Object.freeze({
      formulaVersion: WEAPON_RESOURCE_FORMULA_VERSION,
      weaponId: weapon.id,
      delivery,
      bucket,
      size: weapon.tags.size,
      neutralAcceptedInterval: t0,
      effectivePower: power,
      frozenMedian: median,
      load: 1,
      override: 1,
      overrideReason: "",
      legacyNeutralCost: 0,
      neutralCost: 0,
      grossSpendPerSecond: DRIVE_BEAM_GROSS_DRAIN_PER_SECOND,
      netSpendPerSecond: DRIVE_BEAM_NET_DRAIN_PER_SECOND,
      actionsFromFull: 1,
      zeroToNextActionSeconds: DRIVE_BEAM_RESTART_THRESHOLD / DRIVE_FLOOR_REGEN_PER_SECOND,
      holdToEmptySeconds:
        (DRIVE_CAPACITY - DRIVE_BEAM_IGNITION_COST) / DRIVE_BEAM_NET_DRAIN_PER_SECOND,
      repeatedCyclePower: power,
      branch: delivery,
      ignitionCost: DRIVE_BEAM_IGNITION_COST,
      grossDrainPerSecond: DRIVE_BEAM_GROSS_DRAIN_PER_SECOND,
      netDrainPerSecond: DRIVE_BEAM_NET_DRAIN_PER_SECOND,
      restartThreshold: DRIVE_BEAM_RESTART_THRESHOLD,
    });
  }
  const size = WEAPON_RESOURCE_SIZE_FACTORS[weapon.tags.size];
  const load = clamp(1, DRIVE_LOAD_MAX, (power / median) ** 0.75 * size);
  const legacyNeutralCost =
    delivery === "gun"
      ? (DRIVE_CAPACITY / Math.max(1, weapon.gun!.magazine)) * DRIVE_GUN_BURST_RETENTION
      : delivery === "thrown"
        ? (DRIVE_CAPACITY / Math.max(1, weapon.thrown!.charges)) * DRIVE_THROWN_BURST_RETENTION
        : 0;
  const shell = {
    formulaVersion: WEAPON_RESOURCE_FORMULA_VERSION,
    weaponId: weapon.id,
    delivery,
    bucket,
    size: weapon.tags.size,
    neutralAcceptedInterval: t0,
    effectivePower: power,
    frozenMedian: median,
    load,
    override: override?.multiplier ?? 1,
    overrideReason: override?.reason ?? "",
    legacyNeutralCost,
    branch: "tap" as const,
  };
  const neutralCost = driveCostForProfile(shell as WeaponResourceProfile, t0);
  const grossSpendPerSecond = neutralCost / t0;
  return Object.freeze({
    ...shell,
    neutralCost,
    grossSpendPerSecond,
    netSpendPerSecond: Math.max(0, grossSpendPerSecond - DRIVE_FLOOR_REGEN_PER_SECOND),
    actionsFromFull: Math.floor(DRIVE_CAPACITY / neutralCost),
    zeroToNextActionSeconds: neutralCost / DRIVE_FLOOR_REGEN_PER_SECOND,
    holdToEmptySeconds:
      grossSpendPerSecond > DRIVE_FLOOR_REGEN_PER_SECOND
        ? DRIVE_CAPACITY / (grossSpendPerSecond - DRIVE_FLOOR_REGEN_PER_SECOND)
        : Number.POSITIVE_INFINITY,
    repeatedCyclePower: power,
    ignitionCost: 0,
    grossDrainPerSecond: 0,
    netDrainPerSecond: 0,
    restartThreshold: 0,
  });
}

/**
 * Deterministic formula output for every durable catalog id. Archived profiles remain resolvable so old
 * receipts/instances never dangle while the join migration converts owned copies.
 */
export const WEAPON_RESOURCE_IDS = Object.freeze(
  Object.keys(WEAPONS)
    .filter((id) => id !== "fists")
    .sort(),
);

const generatedProfiles: Record<string, WeaponResourceProfile> = {};
for (const id of WEAPON_RESOURCE_IDS) {
  const weapon = WEAPONS[id];
  if (!weapon) throw new Error(`Missing canonical weapon ${id}`);
  generatedProfiles[id] = deriveWeaponResourceProfile(weapon);
}

export const WEAPON_RESOURCE_PROFILES: Readonly<Record<string, WeaponResourceProfile>> =
  Object.freeze(generatedProfiles);
export const FISTS_RESOURCE_PROFILE = deriveWeaponResourceProfile(WEAPONS.fists!);

export function weaponResourceProfile(weaponId: string): WeaponResourceProfile | undefined {
  return weaponId === "fists" ? FISTS_RESOURCE_PROFILE : WEAPON_RESOURCE_PROFILES[weaponId];
}

// These are the one deliberate literal tripwire against SILENT weapon loss. Catalog additions bump this
// owner once; tests consume the owner instead of copying its totals into unrelated census assertions.
export const WEAPON_RESOURCE_CENSUS_PINS = Object.freeze({
  catalog: 389,
  active: 369,
  archived: 20,
} as const);

if (WEAPON_RESOURCE_IDS.length !== WEAPON_RESOURCE_CENSUS_PINS.catalog) {
  throw new Error(
    `Drive formula expected ${WEAPON_RESOURCE_CENSUS_PINS.catalog} catalog weapons, received ${WEAPON_RESOURCE_IDS.length}`,
  );
}
if (
  ACTIVE_WEAPON_CATALOG_IDS.length !== WEAPON_RESOURCE_CENSUS_PINS.active ||
  ARCHIVED_WEAPON_IDS.length !== WEAPON_RESOURCE_CENSUS_PINS.archived ||
  ACTIVE_WEAPON_CATALOG_IDS.length + ARCHIVED_WEAPON_IDS.length !== WEAPON_RESOURCE_IDS.length
) {
  throw new Error(
    `Weapon archive census expected ${WEAPON_RESOURCE_CENSUS_PINS.active} active + ${WEAPON_RESOURCE_CENSUS_PINS.archived} archived, received ${ACTIVE_WEAPON_CATALOG_IDS.length} + ${ARCHIVED_WEAPON_IDS.length}`,
  );
}
if (Object.keys(WEAPON_RESOURCE_OVERRIDES).length > 15) {
  throw new Error(
    "Drive formula override cap exceeded; revise the formula instead of adding hand tunes",
  );
}
for (const [id, entry] of Object.entries(WEAPON_RESOURCE_OVERRIDES)) {
  if (entry.multiplier < 0.85 || entry.multiplier > 1.15 || !WEAPONS[id]) {
    throw new Error(`Invalid Drive formula override for ${id}`);
  }
}
