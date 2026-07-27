import { BeamPowerCycle, beamCyclePower } from "./loot.js";
import { katanaExpectedMechanic } from "./melee.js";
import {
  hybridProjectileDamagePerAcceptedBeat,
  type WeaponDef,
  type WeaponTier,
} from "./weapons.js";

export const WEAPON_TIER_BUDGET_THRESHOLDS = [16.5, 20, 26, 44] as const;

export const WEAPON_TIER_RANGE_FACTORS = {
  close: 0.9,
  mid: 1,
  long: 1.1,
} as const;

/** Closed manual-review table. Consumers still read `weapon.tier`, never this derivation seam. */
export const WEAPON_TIER_MANUAL_FLOORS: Readonly<Partial<Record<string, WeaponTier>>> =
  Object.freeze({
    "tombstone-greatsword": 3,
    "x2-abyssal-apocrypha": 4,
    "x2-choir-iron-greataxe": 3,
    "x2-quarry-splitter-bardiche": 3,
    "x2-solaris-beam-lance": 5,
  });

function expectedPierceTargets(pierce: number | undefined): number {
  return 1 + 0.6 * (Math.min(6, pierce ?? 1) - 1);
}

function expectedAoeTargets(radius: number): number {
  return 1 + Math.min(2, Math.max(0, radius) / 180);
}

function expectedChainDamage(chain: NonNullable<WeaponDef["chainLightning"]>): number {
  let total = 0;
  let multiplier = 1;
  for (let link = 0; link < chain.jumps; link++) {
    total += chain.damage * multiplier;
    multiplier *= chain.falloff;
  }
  return total * 0.6;
}

/**
 * Deterministic B20 audit formula. Runtime itemization consumers must use the authored `tier` field
 * instead; this seam exists to derive and verify generator input without rebalancing weapon stats.
 */
export function weaponTierPowerBudget(weapon: Readonly<WeaponDef>): number {
  if (weapon.beam) {
    return Math.max(
      beamCyclePower(weapon, BeamPowerCycle.EarlyVent),
      beamCyclePower(weapon, BeamPowerCycle.FullOverheat),
    );
  }
  if (weapon.chargedProjectile) {
    const charged = weapon.chargedProjectile;
    const fullPayload =
      charged.directDamageMax +
      charged.explosionDamageMax *
        expectedAoeTargets(charged.explosionRadiusMax) *
        0.55;
    return (
      (fullPayload / Math.max(0.05, charged.chargeSeconds + weapon.cooldown)) *
      WEAPON_TIER_RANGE_FACTORS[weapon.tags.rangeBand]
    );
  }

  const katana = katanaExpectedMechanic(weapon);
  let directDamage =
    weapon.damage * katana.averageDamageMultiplier + katana.averageBurstDamage;
  let behaviorDamage = 0;
  let cadence = Math.max(0.12, weapon.cooldown);

  if (weapon.thrown) {
    directDamage =
      weapon.thrown.damage *
      expectedPierceTargets(weapon.thrown.pierce) *
      (weapon.thrown.returning ? 1.5 : 1);
    cadence += weapon.thrown.refillSeconds / Math.max(1, weapon.thrown.charges);
    behaviorDamage += weapon.performance?.preThrowDamage?.damage ?? 0;
  }

  if (weapon.gun) {
    const pelletCount = weapon.gun.randomPellets ? 1 : Math.max(1, weapon.gun.pellets ?? 1);
    const burstCount = Math.max(1, weapon.gun.burst?.count ?? 1);
    directDamage =
      weapon.gun.damage *
      pelletCount *
      burstCount *
      0.85 *
      expectedPierceTargets(weapon.gun.pierce) *
      (1 + 0.5 * (weapon.gun.bounces ?? 0));
    if (weapon.gun.explode) {
      behaviorDamage +=
        weapon.gun.explode.damage *
        burstCount *
        expectedAoeTargets(weapon.gun.explode.radius) *
        0.55;
    }
    cadence =
      Math.max(0.05, weapon.gun.fireRate) +
      weapon.gun.reloadSeconds / Math.max(1, weapon.gun.magazine);
  }

  if (weapon.cast) {
    directDamage = weapon.cast.damage * expectedPierceTargets(weapon.cast.pierce);
    if (weapon.cast.explode) {
      behaviorDamage +=
        weapon.cast.explode.damage *
        Math.max(1, weapon.cast.volley?.count ?? 1) *
        expectedAoeTargets(weapon.cast.explode.radius) *
        0.55;
    }
    cadence = Math.max(0.05, weapon.cast.cooldown);
  }

  if (weapon.quake) {
    behaviorDamage +=
      weapon.quake.damage * expectedAoeTargets(weapon.quake.radius) * 0.55;
  }
  if (weapon.chainLightning) behaviorDamage += expectedChainDamage(weapon.chainLightning);
  if (weapon.scatter) {
    behaviorDamage +=
      weapon.scatter.count *
      weapon.scatter.damage *
      0.7 *
      expectedPierceTargets(weapon.scatter.pierce);
    if (weapon.scatter.explode) {
      behaviorDamage +=
        weapon.scatter.explode.damage *
        weapon.scatter.count *
        expectedAoeTargets(weapon.scatter.explode.radius) *
        0.35;
    }
  }
  behaviorDamage += hybridProjectileDamagePerAcceptedBeat(weapon);

  const rangeFactor = WEAPON_TIER_RANGE_FACTORS[weapon.tags.rangeBand];
  if (weapon.groundZone) {
    const zone = weapon.groundZone;
    const pricedSeconds = Math.min(2.5, zone.lingerSeconds);
    const zoneDamage =
      zone.damagePerSecond * pricedSeconds * expectedAoeTargets(zone.maxRadius) * 0.45;
    if (zone.trigger === "channel") return (zoneDamage / pricedSeconds) * rangeFactor;
    behaviorDamage += zoneDamage;
  }

  let utility = 0;
  if (weapon.performance?.aura) {
    utility +=
      weapon.performance.aura.damagePerSecond *
      expectedAoeTargets(weapon.performance.aura.radius) *
      0.45;
  }
  if (weapon.warp) utility += 2;
  if (weapon.rez) utility += 4;
  if (weapon.hitStatus) utility += 2;

  return ((directDamage + behaviorDamage) / cadence) * rangeFactor + utility;
}

export function weaponTierForBudget(budget: number): WeaponTier {
  if (budget < WEAPON_TIER_BUDGET_THRESHOLDS[0]) return 1;
  if (budget < WEAPON_TIER_BUDGET_THRESHOLDS[1]) return 2;
  if (budget < WEAPON_TIER_BUDGET_THRESHOLDS[2]) return 3;
  if (budget < WEAPON_TIER_BUDGET_THRESHOLDS[3]) return 4;
  return 5;
}

/** Formula tier plus the closed manual outlier-review floor. */
export function derivedWeaponTier(weapon: Readonly<WeaponDef>): WeaponTier {
  return Math.max(
    weaponTierForBudget(weaponTierPowerBudget(weapon)),
    WEAPON_TIER_MANUAL_FLOORS[weapon.id] ?? 1,
  ) as WeaponTier;
}
