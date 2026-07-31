/**
 * The slice-1 encounter: four Drifters against four Wardens on the Overgrown Ruin.
 *
 * Every character and weapon here is an EXISTING catalog asset — no placeholder art, no bespoke
 * sprites. That is deliberate: the point of this slice is to find out whether the squad direction is
 * fun using the assets the project already has, not to find out whether new art would be.
 *
 * Units are named rather than numbered because the design log's Fire Emblem entry argues the whole
 * value of permadeath is losing *Vesh*, not losing "ranged unit 3". Costs nothing to start now.
 *
 * FORMATION. `rankOffsetPx` is the unit's distance from the midline at rest, so the roster reads as a
 * battle line: vanguard closest, DPS behind, medic furthest back. `laneY` is mirrored between the two
 * teams so opposing roles share a row — without that the two vanguards would never be close enough to
 * actually clash, and the melee half of the fight would silently never happen.
 */

import type { UnitSpec } from "./battle-sim.js";

/**
 * Shared depth lanes. Front (higher y) draws over back.
 *
 * Spread across the ruin's actual stone floor rather than bunched at the top of it — a first live capture
 * had all four rows inside 300px of a 2160 canvas and the squad read as one clump. The band stops at 1690
 * because a second capture at 1840 put the front rank in the bottom corners, where the foreground vine
 * overlay draws over them.
 *
 * The 180px spacing is deliberately wider than `PARRY_REACH_PX`, so a vanguard parked in one row genuinely
 * cannot cover its neighbour: it has to walk, and walking there means leaving somewhere else open.
 */
const LANE = {
  rangedBack: 1150,
  medic: 1330,
  vanguard: 1510,
  rangedFront: 1690,
} as const;

/** Rest distance from the midline. The vanguard sits close enough that pressing forward puts the two
 *  tanks inside melee reach of each other — that meeting at the line is the picture the fight is built
 *  around, so it must be reachable by construction rather than by luck. */
const RANK = {
  vanguard: 380,
  rangedFront: 820,
  rangedBack: 780,
  medic: 1080,
} as const;

interface RoleTemplate {
  readonly maxHp: number;
  readonly moveSpeed: number;
  readonly beatsPerAction: number;
  readonly damage: number;
  readonly healRange?: number;
}

/** Deliberately the biggest pool in the fight. A live probe at 140 had both vanguards dead inside 17
 *  seconds — they soak the whole enemy volley AND trade melee with each other, so the encounter
 *  collapsed into a naked shootout before the interposition game had a chance to be interesting. */
const VANGUARD: RoleTemplate = { maxHp: 210, moveSpeed: 430, beatsPerAction: 2, damage: 11 };
const RANGED: RoleTemplate = { maxHp: 70, moveSpeed: 340, beatsPerAction: 2, damage: 7 };
/** `damage` is the heal size for a medic — one number, one meaning: "how much this unit moves a bar". */
const MEDIC: RoleTemplate = { maxHp: 80, moveSpeed: 300, beatsPerAction: 3, damage: 9, healRange: 700 };

export const BATTLE_ROSTER: readonly UnitSpec[] = [
  // ----- Drifters (left) -----
  {
    ...VANGUARD,
    id: "kord",
    name: "Kord",
    team: 0,
    role: "vanguard",
    spriteId: "proto-templar-knight",
    weaponId: "tombstone-greatsword",
    rankOffsetPx: RANK.vanguard,
    laneY: LANE.vanguard,
  },
  {
    ...RANGED,
    id: "tuli",
    name: "Tuli",
    team: 0,
    role: "ranged",
    spriteId: "proto-cowboy",
    weaponId: "x-gun-revolver-cannon",
    rankOffsetPx: RANK.rangedBack,
    laneY: LANE.rangedBack,
  },
  {
    ...RANGED,
    id: "sabra",
    name: "Sabra",
    team: 0,
    role: "ranged",
    spriteId: "proto-hooded-rogue",
    weaponId: "x-gun-ricochet-pistol",
    rankOffsetPx: RANK.rangedFront,
    laneY: LANE.rangedFront,
  },
  {
    ...MEDIC,
    id: "vesh",
    name: "Vesh",
    team: 0,
    role: "medic",
    spriteId: "proto-bone-cleric",
    weaponId: "x-staff-arcane-lance",
    rankOffsetPx: RANK.medic,
    laneY: LANE.medic,
  },

  // ----- Wardens (right) -----
  {
    ...VANGUARD,
    id: "halvard",
    name: "Halvard",
    team: 1,
    role: "vanguard",
    spriteId: "proto-royal-executioner",
    weaponId: "driftblade",
    rankOffsetPx: RANK.vanguard,
    laneY: LANE.vanguard,
  },
  {
    ...RANGED,
    id: "crane",
    name: "Crane",
    team: 1,
    role: "ranged",
    spriteId: "proto-pirate-captain",
    weaponId: "x-gun-coffin-shotgun",
    rankOffsetPx: RANK.rangedBack,
    laneY: LANE.rangedBack,
  },
  {
    ...RANGED,
    id: "dell",
    name: "Dell",
    team: 1,
    role: "ranged",
    spriteId: "proto-space-miner",
    weaponId: "x-gun-nailgun",
    rankOffsetPx: RANK.rangedFront,
    laneY: LANE.rangedFront,
  },
  {
    ...MEDIC,
    id: "moss",
    name: "Moss",
    team: 1,
    role: "medic",
    spriteId: "proto-swamp-shaman",
    weaponId: "x-staff-storm-rod",
    rankOffsetPx: RANK.medic,
    laneY: LANE.medic,
  },
];
