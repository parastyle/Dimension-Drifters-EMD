/**
 * Unit stats and abilities for the squad autobattler.
 *
 * These numbers are PLACEHOLDERS and are meant to be replaced. What is not a placeholder is the shape:
 * the simulation reads stats and abilities and never asks "what role is this?" for anything mechanical, so
 * new stats, new abilities and eventually subclasses can be added without touching `battle-sim.ts`.
 *
 * WHY ABILITIES AND NOT ROLE CHECKS. The design log's 2026-07-30 entry gives the vanguard three subclasses
 * (Defender / Fighter / Rogue) that all hold the line but do it differently — a Defender hard-blocks, a
 * Fighter only blocks as a parry, a Rogue crosses the midline. If the sim asked `role === "vanguard"` those
 * would each need a new branch. Asking `has(unit, "interpose")` instead means a subclass is just a
 * different ability set plus stat biases, which is data.
 *
 * WHAT A STAT MUST BE. Every field here is a multiplier or a distance that something in the sim already
 * reads. Adding a stat that nothing reads is worse than not adding it — it looks like a feature and is a
 * lie. See `applyStats` for the full list of what is actually wired.
 */

/** One capability. The sim gates behaviour on these, never on role. */
export type AbilityId =
  /** May interpose on a hostile projectile and parry it. The vanguard's whole job. */
  | "interpose"
  /** Heals the most hurt ally in range on its action beat. */
  | "mend"
  /** Fires a projectile at its chosen target on its action beat. */
  | "volley"
  /** Strikes a target inside weapon reach on its action beat. */
  | "strike";

/**
 * Not yet implemented — listed so the gap is visible rather than forgotten. Adding one means giving it a
 * branch in the sim AND a place in a subclass's ability set; until both exist it does not belong above.
 */
export const PLANNED_ABILITIES = Object.freeze({
  /** Parry sends the bolt back instead of eating it. Design log: an UPGRADE, never baseline. */
  reflect: "unbuilt — needs a gating rule (perfect-timing / budget / resource)",
  /** Cross the midline deliberately for a beat or two. The Rogue subclass is defined by it. */
  lineBreak: "unbuilt — needs a dash cooldown distinct from the midline sling",
  /** Hard block: refuse damage outright rather than catching one projectile. Defender only. */
  hardBlock: "unbuilt — needs a resource cost or it invalidates the Fighter",
});

export interface UnitStats {
  readonly maxHp: number;
  /** Outgoing damage multiplier, applied on top of the weapon's own damage. */
  readonly might: number;
  /** Incoming damage multiplier. Lower is tougher. */
  readonly guard: number;
  /** Walk speed in canvas px/s. Also the lateral escort speed. */
  readonly speed: number;
  /**
   * Action cadence multiplier on the weapon's cooldown. Below 1 acts more often.
   *
   * HANDLE WITH CARE — cadence is rounded to whole beats, so this stat is a CLIFF, not a slope. A `focus`
   * of 0.8 on a weapon sitting near a boundary tipped it from 2 beats to 1 and silently doubled its
   * throughput; a 60-seed probe had that one unit swing the fight to 57 wins out of 60. Check the derived
   * `beatsPerAction` after changing it rather than assuming a small number is a small change.
   */
  readonly focus: number;
  /** How near a bolt must pass to be interposed on. Meaningless without `interpose`. */
  readonly parryReach: number;
  /** Recovery between parries, ms. This is what stops a guard being a wall. */
  readonly parryCooldownMs: number;
  /** Heal size. Meaningless without `mend`. */
  readonly mend: number;
  /** How far a heal reaches — gives support a genuine positioning problem. */
  readonly mendRange: number;
  /** Sideways burst speed of a dodge roll, px/s. */
  readonly dodgeSpeed: number;
  /** How long the roll lasts, ms. Distance covered is roughly speed x duration. */
  readonly dodgeDurationMs: number;
  /** Recovery between rolls. This is what stops anyone dodging everything. */
  readonly dodgeCooldownMs: number;
  /** How far ahead a unit reads an incoming bolt, seconds. Higher = reacts earlier. */
  readonly dodgeReactionSeconds: number;
}

/** Placeholder role baselines. Individual units bias these; see `battle-roster.ts`. */
export const ROLE_STATS = {
  vanguard: {
    dodgeSpeed: 520,
    dodgeDurationMs: 300,
    dodgeCooldownMs: 2600,
    dodgeReactionSeconds: 0.34,
    maxHp: 210,
    might: 1,
    guard: 0.8,
    speed: 430,
    focus: 1,
    parryReach: 150,
    parryCooldownMs: 620,
    mend: 0,
    mendRange: 0,
  },
  ranged: {
    dodgeSpeed: 700,
    dodgeDurationMs: 280,
    dodgeCooldownMs: 1500,
    dodgeReactionSeconds: 0.46,
    maxHp: 70,
    might: 1,
    guard: 1,
    speed: 340,
    focus: 1,
    parryReach: 0,
    parryCooldownMs: 0,
    mend: 0,
    mendRange: 0,
  },
  medic: {
    dodgeSpeed: 640,
    dodgeDurationMs: 290,
    dodgeCooldownMs: 1900,
    dodgeReactionSeconds: 0.42,
    maxHp: 80,
    might: 0.8,
    guard: 1,
    speed: 300,
    focus: 1.5,
    parryReach: 0,
    parryCooldownMs: 0,
    mend: 9,
    mendRange: 700,
  },
} as const satisfies Record<string, UnitStats>;

export const ROLE_ABILITIES = {
  vanguard: ["interpose", "strike"],
  ranged: ["volley"],
  // A medic heals FIRST and shoots only when nobody needs it — see `resolveBeat`. Without the second
  // ability a fight that thinned down to two medics could never end, because neither could deal damage:
  // 7% of a 250-seed sweep ran to a five-minute cap. They carry caster staffs; letting them use them fixes
  // the deadlock and stops support being purely passive.
  medic: ["mend", "volley"],
} as const satisfies Record<string, readonly AbilityId[]>;

/** Per-unit bias applied over the role baseline. Every field optional — omit means "role default". */
export type StatBias = Partial<UnitStats>;

export function applyStats(base: UnitStats, bias: StatBias | undefined): UnitStats {
  return bias ? { ...base, ...bias } : base;
}
