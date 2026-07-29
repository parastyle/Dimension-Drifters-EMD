import type { WeaponClass, WeaponDef, WeaponSubclass } from "./weapons.js";

/** The only live field-enemy taxonomy. `dummy` remains a Testing Grounds fixture, not an archetype. */
export type EnemyArchetype = "runner" | "cultist" | "big" | "dummy";

export const RUNNER_CHARACTER_ID = "proto-frost-rune-guardian";
export const CULTIST_CHARACTER_IDS = [
  "proto-punk-occult-summoner",
  "proto-ninja-purple",
  "proto-wizard",
  "proto-cyberpunk-hacker",
  "proto-alien-void-scholar",
  "proto-hooded-rogue",
] as const;

export type CultistBehaviourId =
  | "blade-duelist"
  | "heavy-breaker"
  | "reach-keeper"
  | "brawler"
  | "thrown-skirmisher"
  | "automatic-suppressor"
  | "scatter-flanker"
  | "precision-marksman"
  | "artillery-bombardier"
  | "mobile-gunner"
  | "beam-channeler"
  | "ritual-caster"
  | "adaptive-special";

export interface CultistBehaviour {
  readonly id: CultistBehaviourId;
  /** Preferred distance as a fraction of the weapon's authored useful range. */
  readonly preferredRangeFraction: number;
  /** Begin backing away inside this fraction of the preferred range. */
  readonly retreatRangeFraction: number;
  /** Signed orbit strength while holding range. */
  readonly strafe: number;
}

export const CULTIST_BEHAVIOURS: Readonly<Record<CultistBehaviourId, CultistBehaviour>> =
  Object.freeze({
    "blade-duelist": {
      id: "blade-duelist",
      preferredRangeFraction: 0.72,
      retreatRangeFraction: 0.35,
      strafe: 0.18,
    },
    "heavy-breaker": {
      id: "heavy-breaker",
      preferredRangeFraction: 0.62,
      retreatRangeFraction: 0.25,
      strafe: 0,
    },
    "reach-keeper": {
      id: "reach-keeper",
      preferredRangeFraction: 0.88,
      retreatRangeFraction: 0.58,
      strafe: 0.22,
    },
    brawler: {
      id: "brawler",
      preferredRangeFraction: 0.45,
      retreatRangeFraction: 0,
      strafe: 0.3,
    },
    "thrown-skirmisher": {
      id: "thrown-skirmisher",
      preferredRangeFraction: 0.62,
      retreatRangeFraction: 0.42,
      strafe: 0.62,
    },
    "automatic-suppressor": {
      id: "automatic-suppressor",
      preferredRangeFraction: 0.55,
      retreatRangeFraction: 0.38,
      strafe: 0.38,
    },
    "scatter-flanker": {
      id: "scatter-flanker",
      preferredRangeFraction: 0.42,
      retreatRangeFraction: 0.24,
      strafe: 0.72,
    },
    "precision-marksman": {
      id: "precision-marksman",
      preferredRangeFraction: 0.82,
      retreatRangeFraction: 0.62,
      strafe: 0.14,
    },
    "artillery-bombardier": {
      id: "artillery-bombardier",
      preferredRangeFraction: 0.72,
      retreatRangeFraction: 0.56,
      strafe: 0,
    },
    "mobile-gunner": {
      id: "mobile-gunner",
      preferredRangeFraction: 0.58,
      retreatRangeFraction: 0.36,
      strafe: 0.66,
    },
    "beam-channeler": {
      id: "beam-channeler",
      preferredRangeFraction: 0.66,
      retreatRangeFraction: 0.5,
      strafe: 0.12,
    },
    "ritual-caster": {
      id: "ritual-caster",
      preferredRangeFraction: 0.7,
      retreatRangeFraction: 0.5,
      strafe: 0.32,
    },
    "adaptive-special": {
      id: "adaptive-special",
      preferredRangeFraction: 0.62,
      retreatRangeFraction: 0.4,
      strafe: 0.35,
    },
  });

const SUBCLASS_BEHAVIOUR: Readonly<Record<string, CultistBehaviourId>> = Object.freeze({
  Axes: "heavy-breaker",
  "Battle Grimoires": "ritual-caster",
  Broadswords: "blade-duelist",
  Claws: "brawler",
  Cleavers: "heavy-breaker",
  "Energy Blades": "blade-duelist",
  "Fist Blades": "brawler",
  Flails: "reach-keeper",
  Glaives: "reach-keeper",
  Greatswords: "heavy-breaker",
  Halberds: "reach-keeper",
  Harpoons: "reach-keeper",
  Katanas: "blade-duelist",
  Maces: "heavy-breaker",
  "Martial Arts": "brawler",
  Mauls: "heavy-breaker",
  Naginatas: "reach-keeper",
  Nodachi: "heavy-breaker",
  Partisans: "reach-keeper",
  Rapiers: "blade-duelist",
  Sabers: "blade-duelist",
  "Scythes & Sickles": "reach-keeper",
  Spears: "reach-keeper",
  Swords: "blade-duelist",
  "Thrown Weapons": "thrown-skirmisher",
  "War Fans": "thrown-skirmisher",
  Warhammers: "heavy-breaker",
  "Whips & Chains": "reach-keeper",
  "Auto Rifles": "automatic-suppressor",
  Blunderbusses: "scatter-flanker",
  Crossbows: "precision-marksman",
  "Hand Cannons": "precision-marksman",
  "Harpoon Guns": "mobile-gunner",
  "Heavy Scatterguns": "scatter-flanker",
  "Launchers & Mortars": "artillery-bombardier",
  "Lever Rifles": "precision-marksman",
  "Machine Pistols": "automatic-suppressor",
  "Marksman Rifles": "precision-marksman",
  Pistols: "mobile-gunner",
  Railguns: "precision-marksman",
  "Ricochet Guns": "mobile-gunner",
  "Rotary Guns": "automatic-suppressor",
  "Scrap Cannons": "scatter-flanker",
  Shotguns: "scatter-flanker",
  "Siege Cannons": "artillery-bombardier",
  "Spike Launchers": "artillery-bombardier",
  Foci: "beam-channeler",
  Gauntlets: "beam-channeler",
  Orbs: "ritual-caster",
  "Relics & Totems": "ritual-caster",
  Scepters: "ritual-caster",
  Spellbooks: "ritual-caster",
  "Staves & Rods": "beam-channeler",
  Wands: "ritual-caster",
  Special: "adaptive-special",
});

/** One table row per authored subclass; weapon ids never enter the decision layer. */
export function cultistBehaviourForSubclass(
  subclass: WeaponSubclass | string,
): CultistBehaviour {
  return CULTIST_BEHAVIOURS[SUBCLASS_BEHAVIOUR[subclass] ?? "adaptive-special"];
}

export function cultistBehaviourForWeapon(
  weapon: Pick<WeaponDef, "tags">,
): CultistBehaviour {
  return cultistBehaviourForSubclass(weapon.tags.subclass);
}

/** Report/test seam: the exact subclass-to-behaviour table without exposing a mutable registry. */
export const CULTIST_SUBCLASS_BEHAVIOUR_TABLE: Readonly<
  Record<string, CultistBehaviourId>
> = SUBCLASS_BEHAVIOUR;

/** Authored range is delivery-specific; the behaviour only decides how to use it. */
export function cultistAuthoredRange(
  weapon: Pick<WeaponDef, "range" | "gun" | "cast" | "beam" | "thrown" | "chargedProjectile">,
): number {
  if (weapon.beam) return weapon.beam.range;
  if (weapon.chargedProjectile) return weapon.chargedProjectile.range;
  if (weapon.gun) return weapon.gun.range;
  if (weapon.cast) return weapon.cast.range;
  if (weapon.thrown) return weapon.thrown.range;
  return weapon.range;
}

/** Delivery remains authored even when a catalog row is grouped under Special. */
export function cultistDeliveryClass(weapon: Pick<WeaponDef, "tags">): WeaponClass {
  return weapon.tags.weaponClass;
}
