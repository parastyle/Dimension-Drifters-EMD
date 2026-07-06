import {
  BOSS_ADD_CD,
  BOSS_ADD_COUNT,
  BOSS_P1_FIRE_CD,
  BOSS_P3_FIRE_CD,
  BOSS_SLAM_CD,
  BOSS_SLAM_DAMAGE,
  BOSS_SLAM_RADIUS,
  BOSS_SLAM_TELEGRAPH,
  BOSS_WALL_ARC,
  BOSS_WALL_COUNT,
  HIT_KNOCKBACK_IMPULSE,
} from "./constants.js";

/**
 * §16 v0.109 DATA-DRIVEN BOSS DEFINITIONS. A boss is a body (an `EnemyKind` supplying sprite / renderScale /
 * hp / radius — the SIZE axis is just `renderScale`) plus an ordered list of HP-gated PHASES, each phase a
 * set of ATTACK MODULES that fire independent cadences composed from the shared `BOSS_PRIMITIVES`. The
 * server `BossController` runs a def deterministically (it replaces the hardcoded `stepBoss`); the client
 * renders whatever telegraphs the modules emit — so a NEW boss style is pure data, zero new code.
 *
 * Any boss kind WITHOUT a registered def falls back to `CLASSIC_BOSS` (OLD RUST's bullet-wall / slam / adds),
 * so every existing dimension boss keeps its behaviour until it earns a bespoke def.
 */

/** One attack the boss fires on a cadence. Composed into a phase. */
export interface AttackModule {
  /** Keys `BOSS_PRIMITIVES`. */
  primitive: string;
  /** Seconds between triggers. */
  cooldown: number;
  /** Telegraph fill lead in seconds (the windup the danger footprint grows over). 0 = instant, no pre-warn. */
  windup?: number;
  /** Initial cooldown offset so modules don't all fire on the same tick (readability + patch-spike avoidance). */
  firstDelay?: number;
  /** For `summonAdds`: which enemy kind to conjure (numeric params can't carry a string). */
  addKind?: string;
  /** The primitive's numeric tuning (count / arc / radius / damage / speed / knockback …). */
  params: Record<string, number>;
}

/** One HP-gated phase. Entered when `hp/maxHp` drops to ≤ the previous phase's floor and is still > `hpAbove`. */
export interface BossPhase {
  /** Phase floor: this phase is active while `frac > hpAbove` (and ≤ the previous phase's floor). The last
   *  phase uses 0. Generalises `bossPhaseForHp` (P1 {0.5}, P2 {0.2}, P3 {0}). */
  hpAbove: number;
  modules: AttackModule[];
  /** Enrage body-speed multiplier for this phase (default 1). */
  speedMult?: number;
}

export interface BossDef {
  /** The `EnemyKind` id supplying the body (sprite / renderScale / hp / radius). Also the `BOSSES` key. */
  kind: string;
  /** Display name for the boss bar. */
  name: string;
  /** Body movement while alive. `strafe` orbits the target (added in Slice 2); the others reuse the shared
   *  enemy steppers. */
  move: "chase" | "kite" | "stationary" | "strafe";
  phases: BossPhase[];
}

/** OLD RUST reproduced as data — the fallback for any boss kind without a bespoke def. P1 bullet-walls, P2
 *  adds the telegraphed punch-slam (a `landingZone`), P3 enrages (faster walls + Mote adds). The per-slug
 *  damage mirrors the old `fireBulletWall` (ranged 13 × 0.55). */
export const CLASSIC_BOSS: BossDef = {
  kind: "classic",
  name: "Old Rust",
  move: "kite",
  phases: [
    {
      hpAbove: 0.5,
      modules: [
        {
          primitive: "bulletFan",
          cooldown: BOSS_P1_FIRE_CD,
          params: { count: BOSS_WALL_COUNT, arc: BOSS_WALL_ARC, speed: 360, damage: 7.15 },
        },
      ],
    },
    {
      hpAbove: 0.2,
      modules: [
        {
          primitive: "bulletFan",
          cooldown: BOSS_P1_FIRE_CD,
          params: { count: BOSS_WALL_COUNT, arc: BOSS_WALL_ARC, speed: 360, damage: 7.15 },
        },
        {
          primitive: "landingZone",
          cooldown: BOSS_SLAM_CD,
          windup: BOSS_SLAM_TELEGRAPH,
          firstDelay: 1.2,
          params: {
            count: 1,
            radius: BOSS_SLAM_RADIUS,
            damage: BOSS_SLAM_DAMAGE,
            knockback: HIT_KNOCKBACK_IMPULSE * 2.2,
            spread: 0,
          },
        },
      ],
    },
    {
      hpAbove: 0,
      speedMult: 1.1,
      modules: [
        {
          primitive: "bulletFan",
          cooldown: BOSS_P3_FIRE_CD,
          params: { count: BOSS_WALL_COUNT, arc: BOSS_WALL_ARC, speed: 360, damage: 7.15 },
        },
        {
          primitive: "landingZone",
          cooldown: BOSS_SLAM_CD,
          windup: BOSS_SLAM_TELEGRAPH,
          firstDelay: 0.8,
          params: {
            count: 1,
            radius: BOSS_SLAM_RADIUS,
            damage: BOSS_SLAM_DAMAGE,
            knockback: HIT_KNOCKBACK_IMPULSE * 2.2,
            spread: 0,
          },
        },
        {
          primitive: "summonAdds",
          cooldown: BOSS_ADD_CD,
          addKind: "mote-swarm",
          firstDelay: 2,
          params: { count: BOSS_ADD_COUNT, ringRadius: 110, ringJitter: 35 },
        },
      ],
    },
  ],
};

/** §16 Ver'Kaln the Descending (LARGE) — a landing-zone titan. The whole fight is reading + vacating red
 *  circles fast; used ground stays briefly denied by corrosive puddles. */
const VERKALN: BossDef = {
  kind: "verkaln",
  name: "Ver'Kaln the Descending",
  move: "chase",
  phases: [
    {
      hpAbove: 0.55,
      modules: [
        {
          primitive: "landingZone",
          cooldown: 2.6,
          windup: 0.9,
          params: { count: 2, radius: 150, damage: 20, knockback: 700, spread: 360 },
        },
        {
          primitive: "corrosivePool",
          cooldown: 4.5,
          windup: 0.6,
          firstDelay: 1.5,
          params: { count: 1, radius: 90, ttl: 3.5, spread: 260 },
        },
      ],
    },
    {
      hpAbove: 0.25,
      modules: [
        {
          primitive: "landingZone",
          cooldown: 2.3,
          windup: 0.85,
          params: { count: 3, radius: 158, damage: 22, knockback: 720, spread: 420 },
        },
        {
          primitive: "corrosivePool",
          cooldown: 3.4,
          windup: 0.55,
          firstDelay: 1,
          params: { count: 2, radius: 96, ttl: 4, spread: 340 },
        },
      ],
    },
    {
      hpAbove: 0,
      speedMult: 1.15,
      modules: [
        {
          primitive: "landingZone",
          cooldown: 2,
          windup: 0.75,
          params: { count: 4, radius: 150, damage: 22, knockback: 720, spread: 480 },
        },
        {
          primitive: "summonAdds",
          cooldown: 5.5,
          addKind: "mote-swarm",
          firstDelay: 2.5,
          params: { count: 3, ringRadius: 160, ringJitter: 60 },
        },
      ],
    },
  ],
};

/** §16 The Choirmath (LARGE) — a serene spiral god. Rotating bullet spirals you read as a dance; the safe
 *  gap is always moving. A punch of aimed pressure + a slam break turtling as it escalates. */
const CHOIRMATH: BossDef = {
  kind: "choirmath",
  name: "The Choirmath",
  move: "stationary",
  phases: [
    {
      hpAbove: 0.6,
      modules: [
        {
          primitive: "spiral",
          cooldown: 0.62,
          params: { count: 8, speed: 220, damage: 8, spinPerVolley: 0.5 },
        },
      ],
    },
    {
      hpAbove: 0.3,
      modules: [
        {
          primitive: "spiral",
          cooldown: 0.55,
          params: { count: 10, speed: 240, damage: 8, spinPerVolley: -0.55 },
        },
        {
          primitive: "landingZone",
          cooldown: 5,
          windup: 0.9,
          firstDelay: 2.5,
          params: { count: 1, radius: 150, damage: 20, knockback: 640, spread: 0 },
        },
      ],
    },
    {
      hpAbove: 0,
      modules: [
        {
          primitive: "spiral",
          cooldown: 0.5,
          params: { count: 12, speed: 260, damage: 8, spinPerVolley: 0.62 },
        },
        {
          primitive: "aimedVolley",
          cooldown: 2.4,
          firstDelay: 1.2,
          params: { pellets: 5, arc: 0.6, speed: 340, damage: 7 },
        },
      ],
    },
  ],
};

/** §16 Cor-Vane the Hive-Mind (CHARACTER) — a nimble, fragile conductor that kites the squad and drowns the
 *  arena in adds. A DPS/priority race: thin the swarm or burn the conductor. (Slice 2 adds the add-gated
 *  damage shield that makes it a true priority puzzle.) */
const CORVANE: BossDef = {
  kind: "corvane",
  name: "Cor-Vane the Hive-Mind",
  move: "kite",
  phases: [
    {
      hpAbove: 0.6,
      modules: [
        {
          primitive: "summonAdds",
          cooldown: 5,
          addKind: "mote-swarm",
          params: { count: 3, ringRadius: 130, ringJitter: 50 },
        },
        {
          primitive: "radialBurst",
          cooldown: 2.6,
          windup: 0.5,
          firstDelay: 1.4,
          params: { count: 8, speed: 260, damage: 7 },
        },
      ],
    },
    {
      hpAbove: 0.25,
      speedMult: 1.1,
      modules: [
        {
          primitive: "summonAdds",
          cooldown: 4,
          addKind: "mote-swarm",
          params: { count: 4, ringRadius: 150, ringJitter: 60 },
        },
        {
          primitive: "radialBurst",
          cooldown: 2.2,
          windup: 0.45,
          firstDelay: 1,
          params: { count: 10, speed: 280, damage: 7 },
        },
      ],
    },
    {
      hpAbove: 0,
      speedMult: 1.2,
      modules: [
        {
          primitive: "summonAdds",
          cooldown: 6,
          addKind: "mote-swarm",
          params: { count: 5, ringRadius: 170, ringJitter: 70 },
        },
        {
          primitive: "aimedVolley",
          cooldown: 1.6,
          params: { pellets: 4, arc: 0.7, speed: 320, damage: 7 },
        },
      ],
    },
  ],
};

/** The boss-definition registry — keyed by `kind`. Slice 2 adds the other 7 styles + their new primitives. */
export const BOSSES: Record<string, BossDef> = {
  verkaln: VERKALN,
  choirmath: CHOIRMATH,
  corvane: CORVANE,
};

/** The def for a boss `kind`, or `CLASSIC_BOSS` for any kind without a bespoke def (every current dimension
 *  boss). Never returns undefined. */
export function bossDefFor(kind: string): BossDef {
  return BOSSES[kind] ?? CLASSIC_BOSS;
}

/** Ordered list of the DEBUG-picker-spawnable boss kinds (the ones with bespoke defs) — drives the dev menu. */
export const BOSS_DEF_IDS: readonly string[] = Object.keys(BOSSES);
