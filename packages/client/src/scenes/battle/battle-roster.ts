/**
 * The slice-1 encounter: four Drifters against four Wardens on the Overgrown Ruin.
 *
 * Every character and weapon here is an EXISTING catalog asset — no placeholder art, no bespoke sprites.
 * The point of this slice is to find out whether the squad direction is fun using the assets the project
 * already has, not whether new art would be.
 *
 * Units are named rather than numbered because the design log's Fire Emblem entry argues the whole value of
 * permadeath is losing *Vesh*, not losing "ranged unit 3". Costs nothing to start now.
 *
 * WHAT A UNIT IS MADE OF: a role baseline from `battle-stats.ts`, an optional per-unit bias, an ability
 * set, and a real weapon. Damage, cadence and reach are NOT written here — they come from the weapon
 * definition (see `weaponProfile` in the sim), which is what makes the 395-weapon catalog matter.
 *
 * FORMATION: `rankOffsetPx` is the unit's distance from the midline at rest, so the roster reads as a
 * battle line — vanguard closest, DPS behind, medic furthest back. `laneY` is mirrored between the teams so
 * opposing roles share a row; without that the two vanguards would never come within melee reach and the
 * melee half of the fight would silently never happen.
 */

import {
  ROLE_ABILITIES,
  ROLE_STATS,
  applyStats,
  type AbilityId,
  type StatBias,
  type UnitStats,
} from "./battle-stats.js";

export type BattleTeam = 0 | 1;
export type BattleRole = "vanguard" | "medic" | "ranged";

export interface UnitSpec {
  readonly id: string;
  readonly name: string;
  readonly team: BattleTeam;
  readonly role: BattleRole;
  /** Whole-art character sprite id, straight from the existing roster. */
  readonly spriteId: string;
  /** Real catalog weapon id. Drives damage, cadence and reach — not just what is drawn in hand. */
  readonly weaponId: string;
  readonly stats: UnitStats;
  readonly abilities: readonly AbilityId[];
  /** Distance from the midline this unit stands at in `hold` stance. Its rank in the formation. */
  readonly rankOffsetPx: number;
  /** Home depth row. Only units with `interpose` ever leave it. */
  readonly laneY: number;
}

/**
 * Shared depth lanes. Front (higher y) draws over back.
 *
 * Spread across the ruin's actual stone floor rather than bunched at the top of it — a first live capture
 * had all four rows inside 300px of a 2160 canvas and the squad read as one clump. The band stops at 1690
 * because a second capture at 1840 put the front rank in the bottom corners, where the foreground vine
 * overlay draws over them.
 *
 * The 180px spacing is deliberately wider than any unit's `parryReach`, so a vanguard parked in one row
 * genuinely cannot cover its neighbour: it has to walk, and walking there means leaving somewhere open.
 */
const LANE = {
  rangedBack: 1150,
  medic: 1330,
  vanguard: 1510,
  rangedFront: 1690,
} as const;

/** Rest distance from the midline. The vanguard sits close enough that pressing forward puts the two tanks
 *  inside melee reach of each other — that meeting at the line is the picture the fight is built around, so
 *  it must be reachable by construction rather than by luck. */
const RANK = {
  vanguard: 380,
  rangedFront: 820,
  rangedBack: 780,
  medic: 1080,
} as const;

interface RosterEntry {
  readonly id: string;
  readonly name: string;
  readonly team: BattleTeam;
  readonly role: BattleRole;
  readonly spriteId: string;
  readonly weaponId: string;
  readonly rankOffsetPx: number;
  readonly laneY: number;
  /** Per-unit deviation from the role baseline. This is where character identity will live. */
  readonly bias?: StatBias;
}

const ROSTER: readonly RosterEntry[] = [
  // ----- Drifters (left) -----
  {
    id: "kord",
    name: "Kord",
    team: 0,
    role: "vanguard",
    spriteId: "proto-templar-knight",
    weaponId: "tombstone-greatsword",
    rankOffsetPx: RANK.vanguard,
    laneY: LANE.vanguard,
    // Slower and tougher than Halvard: the same job, done by standing still and taking it.
    bias: { guard: 0.72, speed: 400 },
  },
  {
    id: "tuli",
    name: "Tuli",
    team: 0,
    role: "ranged",
    spriteId: "proto-cowboy",
    weaponId: "x-gun-revolver-cannon",
    rankOffsetPx: RANK.rangedBack,
    laneY: LANE.rangedBack,
    bias: { might: 1.15, maxHp: 64 },
  },
  {
    id: "sabra",
    name: "Sabra",
    team: 0,
    role: "ranged",
    spriteId: "proto-hooded-rogue",
    weaponId: "x-gun-ricochet-pistol",
    rankOffsetPx: RANK.rangedFront,
    laneY: LANE.rangedFront,
    bias: { speed: 400, focus: 0.85 },
  },
  {
    id: "vesh",
    name: "Vesh",
    team: 0,
    role: "medic",
    spriteId: "proto-bone-cleric",
    weaponId: "x-staff-arcane-lance",
    rankOffsetPx: RANK.medic,
    laneY: LANE.medic,
    bias: { mend: 10 },
  },

  // ----- Wardens (right) -----
  {
    id: "halvard",
    name: "Halvard",
    team: 1,
    role: "vanguard",
    spriteId: "proto-royal-executioner",
    weaponId: "x2-choir-iron-greataxe",
    rankOffsetPx: RANK.vanguard,
    laneY: LANE.vanguard,
    // The mirror of Kord: quicker to the threatened row, softer when it arrives.
    bias: { guard: 0.87, speed: 430 },
  },
  {
    id: "crane",
    name: "Crane",
    team: 1,
    role: "ranged",
    spriteId: "proto-pirate-captain",
    weaponId: "x-gun-coffin-shotgun",
    rankOffsetPx: RANK.rangedBack,
    laneY: LANE.rangedBack,
    bias: { maxHp: 74, might: 1.15 },
  },
  {
    id: "dell",
    name: "Dell",
    team: 1,
    role: "ranged",
    spriteId: "proto-space-miner",
    weaponId: "x-gun-nailgun",
    rankOffsetPx: RANK.rangedFront,
    laneY: LANE.rangedFront,
    bias: { speed: 370 },
  },
  {
    id: "moss",
    name: "Moss",
    team: 1,
    role: "medic",
    spriteId: "proto-swamp-shaman",
    weaponId: "x-staff-storm-rod",
    rankOffsetPx: RANK.medic,
    laneY: LANE.medic,
    bias: { mend: 10, mendRange: 760 },
  },
];

export const BATTLE_ROSTER: readonly UnitSpec[] = ROSTER.map((entry) => ({
  id: entry.id,
  name: entry.name,
  team: entry.team,
  role: entry.role,
  spriteId: entry.spriteId,
  weaponId: entry.weaponId,
  rankOffsetPx: entry.rankOffsetPx,
  laneY: entry.laneY,
  stats: applyStats(ROLE_STATS[entry.role], entry.bias),
  abilities: ROLE_ABILITIES[entry.role],
}));

/** The squad the player commands. Takeover is limited to these. */
export const PLAYER_TEAM: BattleTeam = 0;
