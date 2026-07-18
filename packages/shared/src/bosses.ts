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
import {
  VastagharActionKind,
  VastagharFoot,
  WormActionKind,
  WormSegmentRole,
  type VastagharEncounterDef,
  type WormEncounterDef,
} from "./boss.js";

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
  /** Dedicated encounter directors opt in explicitly; absent keeps the legacy module scheduler untouched. */
  encounter?: "worm" | "vastaghar";
  worm?: WormEncounterDef;
  vastaghar?: VastagharEncounterDef;
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

/** §16 Nul the Sightline (LARGE) — a single enormous eye that charges + SWEEPS a death-beam across the
 *  arena. The whole fight is watching the aim and running perpendicular to the sweep. */
const NUL: BossDef = {
  kind: "nul-sightline",
  name: "Nul the Sightline",
  move: "stationary",
  phases: [
    {
      hpAbove: 0.55,
      modules: [
        {
          primitive: "beamSweep",
          cooldown: 2.6,
          windup: 0.95,
          params: { length: 1000, halfWidth: 42, sweepArc: 0, duration: 0.5, dps: 34 },
        },
      ],
    },
    {
      hpAbove: 0.25,
      modules: [
        {
          primitive: "beamSweep",
          cooldown: 3,
          windup: 0.9,
          params: { length: 1000, halfWidth: 44, sweepArc: 1.4, duration: 1.4, dps: 30 },
        },
        {
          primitive: "aimedVolley",
          cooldown: 2.2,
          firstDelay: 1,
          params: { pellets: 3, arc: 0.5, speed: 340, damage: 7 },
        },
      ],
    },
    {
      hpAbove: 0,
      modules: [
        {
          primitive: "beamSweep",
          cooldown: 2.6,
          windup: 0.8,
          params: { length: 1000, halfWidth: 46, sweepArc: 2, duration: 1.6, dps: 30 },
        },
        {
          primitive: "landingZone",
          cooldown: 4.5,
          windup: 0.8,
          firstDelay: 2,
          params: { count: 1, radius: 150, damage: 20, knockback: 640, spread: 0 },
        },
      ],
    },
  ],
};

/** §16 The Metronome (LARGE) — a clockwork heart beating expanding rings with a rotating safe gap. A rhythm
 *  boss: time your dashes to the beat, thread each ring's gap. */
const METRONOME: BossDef = {
  kind: "metronome",
  name: "The Metronome",
  move: "stationary",
  phases: [
    {
      hpAbove: 0.55,
      modules: [
        {
          primitive: "expandingRing",
          cooldown: 2.4,
          windup: 0.5,
          params: { maxR: 540, bandHalf: 44, gapAngle: 0.62, duration: 1.1, dps: 26 },
        },
      ],
    },
    {
      hpAbove: 0.25,
      modules: [
        {
          primitive: "expandingRing",
          cooldown: 1.9,
          windup: 0.45,
          params: { maxR: 560, bandHalf: 46, gapAngle: 0.55, duration: 1.0, dps: 28 },
        },
        {
          primitive: "radialBurst",
          cooldown: 2.6,
          windup: 0.4,
          firstDelay: 1,
          params: { count: 10, speed: 250, damage: 7 },
        },
      ],
    },
    {
      hpAbove: 0,
      modules: [
        {
          primitive: "expandingRing",
          cooldown: 1.6,
          windup: 0.4,
          params: { maxR: 560, bandHalf: 48, gapAngle: 0.48, duration: 0.95, dps: 28 },
        },
        {
          primitive: "landingZone",
          cooldown: 4,
          windup: 0.8,
          firstDelay: 2,
          params: { count: 1, radius: 150, damage: 20, knockback: 640, spread: 0 },
        },
      ],
    },
  ],
};

/** §16 Grull the Unchained (LARGE) — a hulking brute that CHAINS dash-lunges across the arena, building
 *  momentum. Bait him into overshooting; sidestep each red charge. */
const GRULL: BossDef = {
  kind: "grull",
  name: "Grull the Unchained",
  move: "chase",
  phases: [
    {
      hpAbove: 0.6,
      modules: [
        {
          primitive: "dashCharge",
          cooldown: 3.2,
          windup: 0.6,
          params: { reach: 650, halfWidth: 60, duration: 0.4, damage: 55, knockback: 720 },
        },
      ],
    },
    {
      hpAbove: 0.3,
      speedMult: 1.1,
      modules: [
        {
          primitive: "dashCharge",
          cooldown: 2.2,
          windup: 0.5,
          params: { reach: 680, halfWidth: 62, duration: 0.38, damage: 55, knockback: 740 },
        },
        {
          primitive: "dashCharge",
          cooldown: 2.6,
          windup: 0.5,
          firstDelay: 1.1,
          params: { reach: 680, halfWidth: 62, duration: 0.38, damage: 55, knockback: 740 },
        },
      ],
    },
    {
      hpAbove: 0,
      speedMult: 1.25,
      modules: [
        {
          primitive: "dashCharge",
          cooldown: 1.6,
          windup: 0.42,
          params: { reach: 700, halfWidth: 64, duration: 0.34, damage: 55, knockback: 760 },
        },
        {
          primitive: "corrosivePool",
          cooldown: 2,
          windup: 0.4,
          firstDelay: 0.8,
          params: { count: 1, radius: 96, ttl: 4, spread: 260 },
        },
      ],
    },
  ],
};

/** §16 Quickdraw Vane (CHARACTER) — a circle-strafing gunslinger who suppresses your movement with red no-go
 *  LANES while peppering aimed shots. Positioning pressure, not raw bullet count. */
const QUICKDRAW: BossDef = {
  kind: "quickdraw-vane",
  name: "Quickdraw Vane",
  move: "strafe",
  phases: [
    {
      hpAbove: 0.6,
      modules: [
        {
          primitive: "aimedVolley",
          cooldown: 1,
          params: { pellets: 1, arc: 0, speed: 420, damage: 8 },
        },
      ],
    },
    {
      hpAbove: 0.3,
      modules: [
        {
          primitive: "aimedVolley",
          cooldown: 0.9,
          params: { pellets: 1, arc: 0, speed: 440, damage: 8 },
        },
        {
          primitive: "beamSweep",
          cooldown: 3,
          windup: 0.7,
          firstDelay: 1,
          params: { length: 820, halfWidth: 46, sweepArc: 0, duration: 0.45, dps: 34 },
        },
      ],
    },
    {
      hpAbove: 0,
      speedMult: 1.15,
      modules: [
        {
          primitive: "aimedVolley",
          cooldown: 1.6,
          params: { pellets: 7, arc: 0.9, speed: 360, damage: 7 },
        },
        {
          primitive: "beamSweep",
          cooldown: 2.6,
          windup: 0.6,
          firstDelay: 0.8,
          params: { length: 820, halfWidth: 48, sweepArc: 0, duration: 0.45, dps: 34 },
        },
      ],
    },
  ],
};

/** §16 Slice 3 — Kaido the Parry-Dancer (CHARACTER) — the marquee PARRY duel. His swings are WHITE, parryable
 *  wedges (chain them for the v0.114 heal/riposte), interleaved with RED dash-lunges you must dodge. Reading
 *  white-vs-red under pressure IS the fight. He plants to swing (the controller freezes his feet mid-cast). */
const KAIDO: BossDef = {
  kind: "kaido",
  name: "Kaido the Parry-Dancer",
  move: "chase",
  phases: [
    {
      hpAbove: 0.6,
      modules: [
        {
          primitive: "meleeCombo",
          cooldown: 0.7,
          windup: 0.5,
          params: { range: 200, halfArc: 0.7, damage: 15, knockback: 440 },
        },
        {
          primitive: "dashCharge",
          cooldown: 4.5,
          windup: 0.55,
          firstDelay: 2.2,
          params: { reach: 560, halfWidth: 52, duration: 0.34, damage: 45, knockback: 640 },
        },
      ],
    },
    {
      hpAbove: 0.3,
      speedMult: 1.1,
      modules: [
        // A faster flurry — the parry window tightens (shorter windup) and a second swing chases the first.
        {
          primitive: "meleeCombo",
          cooldown: 0.52,
          windup: 0.4,
          params: { range: 210, halfArc: 0.75, damage: 15, knockback: 460 },
        },
        {
          primitive: "dashCharge",
          cooldown: 3.4,
          windup: 0.5,
          firstDelay: 1.4,
          params: { reach: 600, halfWidth: 54, duration: 0.32, damage: 45, knockback: 680 },
        },
      ],
    },
    {
      hpAbove: 0,
      speedMult: 1.2,
      modules: [
        {
          primitive: "meleeCombo",
          cooldown: 0.46,
          windup: 0.34,
          params: { range: 220, halfArc: 0.8, damage: 16, knockback: 480 },
        },
        {
          primitive: "aimedVolley",
          cooldown: 2.4,
          firstDelay: 1,
          params: { pellets: 3, arc: 0.4, speed: 380, damage: 7 },
        },
      ],
    },
  ],
};

/** §16 Slice 3 — Nihil the Blink Assassin (CHARACTER) — teleports beside a target and slams; parryable
 *  shuriken fill the gaps. Watch the poof marker, vacate it, punish the recovery. Fragile. */
const NIHIL: BossDef = {
  kind: "nihil",
  name: "Nihil the Blink Assassin",
  move: "kite",
  phases: [
    {
      hpAbove: 0.6,
      modules: [
        {
          primitive: "blinkStrike",
          cooldown: 3.4,
          windup: 0.7,
          params: { offset: 80, radius: 130, damage: 20, knockback: 620 },
        },
        {
          primitive: "aimedVolley",
          cooldown: 1.6,
          firstDelay: 0.8,
          params: { pellets: 3, arc: 0.5, speed: 360, damage: 7 },
        },
      ],
    },
    {
      hpAbove: 0.3,
      speedMult: 1.1,
      modules: [
        {
          primitive: "blinkStrike",
          cooldown: 2.6,
          windup: 0.6,
          params: { offset: 76, radius: 138, damage: 22, knockback: 660 },
        },
        {
          primitive: "aimedVolley",
          cooldown: 1.3,
          params: { pellets: 5, arc: 0.7, speed: 380, damage: 7 },
        },
      ],
    },
    {
      hpAbove: 0,
      speedMult: 1.15,
      modules: [
        // Twin blinks — two slams land in quick succession, so you can't just sidestep once.
        {
          primitive: "blinkStrike",
          cooldown: 2,
          windup: 0.5,
          params: { offset: 72, radius: 140, damage: 22, knockback: 680 },
        },
        {
          primitive: "radialBurst",
          cooldown: 3,
          windup: 0.4,
          firstDelay: 1,
          params: { count: 12, speed: 260, damage: 7 },
        },
      ],
    },
  ],
};

/** §16 Slice 3 — Castor & Pollux the Blade Twins (CHARACTER) — a twin-blade duelist striking with BOTH edges
 *  at once: paired dash lanes (two reds to thread) plus a parryable cross-slash. Constant two-danger pressure.
 *  (True dual-body / shared-pool is a schema-touching follow-up; this single body wields both blades.) */
const TWINS: BossDef = {
  kind: "blade-twins",
  name: "Castor & Pollux the Blade Twins",
  move: "chase",
  phases: [
    {
      hpAbove: 0.55,
      modules: [
        // Two dash lanes fired a half-beat apart — Castor's blade, then Pollux's.
        {
          primitive: "dashCharge",
          cooldown: 3.6,
          windup: 0.55,
          params: { reach: 600, halfWidth: 50, duration: 0.34, damage: 42, knockback: 640 },
        },
        {
          primitive: "dashCharge",
          cooldown: 3.6,
          windup: 0.55,
          firstDelay: 0.5,
          params: { reach: 600, halfWidth: 50, duration: 0.34, damage: 42, knockback: 640 },
        },
        {
          primitive: "meleeCombo",
          cooldown: 1.4,
          windup: 0.45,
          firstDelay: 1.8,
          params: { range: 210, halfArc: 0.9, damage: 14, knockback: 420 },
        },
      ],
    },
    {
      hpAbove: 0.25,
      speedMult: 1.12,
      modules: [
        {
          primitive: "dashCharge",
          cooldown: 2.8,
          windup: 0.5,
          params: { reach: 640, halfWidth: 52, duration: 0.32, damage: 42, knockback: 680 },
        },
        {
          primitive: "dashCharge",
          cooldown: 2.8,
          windup: 0.5,
          firstDelay: 0.45,
          params: { reach: 640, halfWidth: 52, duration: 0.32, damage: 42, knockback: 680 },
        },
        {
          primitive: "meleeCombo",
          cooldown: 1,
          windup: 0.4,
          firstDelay: 1.2,
          params: { range: 220, halfArc: 0.95, damage: 14, knockback: 440 },
        },
      ],
    },
    {
      hpAbove: 0,
      speedMult: 1.24,
      modules: [
        {
          primitive: "dashCharge",
          cooldown: 2,
          windup: 0.42,
          params: { reach: 660, halfWidth: 54, duration: 0.3, damage: 42, knockback: 700 },
        },
        {
          primitive: "meleeCombo",
          cooldown: 0.7,
          windup: 0.34,
          params: { range: 230, halfArc: 1, damage: 15, knockback: 460 },
        },
      ],
    },
  ],
};

/** §16 v0.117 GOROGOTH, THE DIMENSION-ENDER — the COLOSSUS. A walking mountain (renderScale 6.4, radius 170)
 *  the squad orbits. Its whole kit is HUGE + telegraphed: screen-wide crater slams, expanding shockwave rings
 *  you dash the gap of, a sweeping gaze-beam across the whole arena, blooming bullet rings, and — at enrage —
 *  summoned voidspawn + double shockwaves. Ponderous body, godlike reach. The biggest fight in the game. */
const COLOSSUS: BossDef = {
  kind: "dimensional-colossus",
  name: "Gorogoth, the Dimension-Ender",
  move: "chase",
  phases: [
    // P1 (>66%) — the mountain wakes: ground-splitting crater slams + a slow, screen-wide shockwave ring.
    {
      hpAbove: 0.66,
      modules: [
        {
          primitive: "landingZone",
          cooldown: 3.4,
          windup: 1.0,
          params: { count: 2, radius: 220, damage: 26, knockback: 900, spread: 520 },
        },
        {
          primitive: "expandingRing",
          cooldown: 5.2,
          windup: 0.7,
          firstDelay: 2.2,
          params: { maxR: 620, gapAngle: 0.75, duration: 1.5, dps: 30 },
        },
      ],
    },
    // P2 (>33%) — it lashes out: a sweeping gaze-beam across the arena, blooming bullet rings, heavier slams.
    {
      hpAbove: 0.33,
      speedMult: 1.08,
      modules: [
        {
          primitive: "landingZone",
          cooldown: 3.0,
          windup: 0.9,
          params: { count: 3, radius: 220, damage: 28, knockback: 940, spread: 620 },
        },
        {
          primitive: "beamSweep",
          cooldown: 4.2,
          windup: 1.0,
          firstDelay: 1.4,
          params: { length: 1500, halfWidth: 70, sweepArc: 1.7, duration: 1.8, dps: 34 },
        },
        {
          primitive: "radialBurst",
          cooldown: 3.0,
          windup: 0.5,
          firstDelay: 2.4,
          params: { count: 20, speed: 250, damage: 8 },
        },
      ],
    },
    // P3 (enrage) — the arena becomes a maelstrom: summoned voidspawn, double shockwaves, a rain of craters.
    {
      hpAbove: 0,
      speedMult: 1.18,
      modules: [
        {
          primitive: "landingZone",
          cooldown: 2.4,
          windup: 0.75,
          params: { count: 4, radius: 210, damage: 28, knockback: 940, spread: 720 },
        },
        {
          primitive: "expandingRing",
          cooldown: 3.4,
          windup: 0.55,
          params: { maxR: 660, gapAngle: 0.6, duration: 1.3, dps: 32 },
        },
        {
          primitive: "radialBurst",
          cooldown: 2.6,
          windup: 0.45,
          firstDelay: 1.0,
          params: { count: 26, speed: 260, damage: 8, spin: 0.14 },
        },
        {
          primitive: "summonAdds",
          cooldown: 6.0,
          addKind: "mote-swarm",
          firstDelay: 2.0,
          params: { count: 4, ringRadius: 300, ringJitter: 90 },
        },
      ],
    },
  ],
};

/** §33 v0.118 VASTAGHAR, THE WORLD-TREAD — a boss so vast only his lower body fits on screen (renderScale
 *  13). You fight at his feet, and his whole rhythm is the FOOTSTEP: every ponderous stomp drops a ground
 *  quake (`footfallQuake`) you must JUMP over (airborne = immune) or PARRY (white cue, negates + feeds the
 *  chain). Stay grounded and flat-footed and the quake flattens you. The steps quicken + multiply as he
 *  falls; supporting fire (crater slams / bullet fan / voidspawn) forces you to move between stomps. */
/** The Last Crossing: immutable tick-authored data shared by server authority and the client director. */
export const VASTAGHAR_ENCOUNTER = {
  thresholds: [0.7, 0.35, 0.08],
  entranceDelayTicks: 40,
  transitionTicks: 16,
  transitionClaimDelayTicks: 20,
  strideBreakPips: 3,
  strideBreakTicks: 64,
  strideBreakDamageMultiplier: 1.2,
  responseWindowTicks: 5,
  addCap: 4,
  addLifetimeTicks: 140,
  maxDestroyedPois: 2,
  bossXp: 110,
  actions: {
    [VastagharActionKind.Crownstep]: {
      kind: VastagharActionKind.Crownstep,
      windupTicks: 21,
      activeTicks: 0,
      recoveryTicks: 20,
      stepOffsets: [21],
      stepFeet: [VastagharFoot.InnerLeft],
      stepRadii: [360],
      stepDamage: [24],
      stepKnockback: [900],
      innerRange: 0,
      outerRange: 0,
      halfWidth: 0,
      sweepRadians: 0,
      maxTargets: 1,
    },
    [VastagharActionKind.HeelReap]: {
      kind: VastagharActionKind.HeelReap,
      windupTicks: 16,
      activeTicks: 9,
      recoveryTicks: 20,
      stepOffsets: [],
      stepFeet: [VastagharFoot.OuterRight],
      stepRadii: [],
      stepDamage: [20],
      stepKnockback: [520],
      innerRange: 220,
      outerRange: 520,
      halfWidth: 34,
      sweepRadians: 2.2,
      maxTargets: 1,
    },
    [VastagharActionKind.ShedMountain]: {
      kind: VastagharActionKind.ShedMountain,
      windupTicks: 20,
      activeTicks: 0,
      recoveryTicks: 20,
      stepOffsets: [20],
      stepFeet: [VastagharFoot.Body],
      stepRadii: [155],
      stepDamage: [20],
      stepKnockback: [650],
      innerRange: 0,
      outerRange: 0,
      halfWidth: 0,
      sweepRadians: 0,
      maxTargets: 2,
    },
    [VastagharActionKind.ThreefoldMarch]: {
      kind: VastagharActionKind.ThreefoldMarch,
      windupTicks: 19,
      activeTicks: 30,
      recoveryTicks: 23,
      stepOffsets: [19, 34, 49],
      stepFeet: [VastagharFoot.OuterLeft, VastagharFoot.OuterRight, VastagharFoot.InnerLeft],
      stepRadii: [340, 340, 340],
      stepDamage: [22, 22, 22],
      stepKnockback: [850, 850, 850],
      innerRange: 0,
      outerRange: 0,
      halfWidth: 0,
      sweepRadians: 0,
      maxTargets: 1,
    },
    [VastagharActionKind.LandmarkBreak]: {
      kind: VastagharActionKind.LandmarkBreak,
      windupTicks: 23,
      activeTicks: 10,
      recoveryTicks: 25,
      stepOffsets: [],
      stepFeet: [VastagharFoot.Body],
      stepRadii: [],
      stepDamage: [24],
      stepKnockback: [720],
      innerRange: 0,
      outerRange: 620,
      halfWidth: 135,
      sweepRadians: 0,
      maxTargets: 1,
    },
    [VastagharActionKind.TwinTread]: {
      kind: VastagharActionKind.TwinTread,
      windupTicks: 20,
      activeTicks: 15,
      recoveryTicks: 20,
      stepOffsets: [20, 35],
      stepFeet: [VastagharFoot.InnerLeft, VastagharFoot.InnerRight],
      stepRadii: [350, 350],
      stepDamage: [24, 24],
      stepKnockback: [900, 900],
      innerRange: 0,
      outerRange: 0,
      halfWidth: 0,
      sweepRadians: 0,
      maxTargets: 1,
    },
    [VastagharActionKind.Worldwheel]: {
      kind: VastagharActionKind.Worldwheel,
      windupTicks: 21,
      activeTicks: 30,
      recoveryTicks: 20,
      stepOffsets: [],
      stepFeet: [VastagharFoot.OuterLeft],
      stepRadii: [],
      stepDamage: [16, 16],
      stepKnockback: [380, 380],
      innerRange: 230,
      outerRange: 590,
      halfWidth: 38,
      sweepRadians: Math.PI * 4,
      maxTargets: 1,
    },
    [VastagharActionKind.FinalTread]: {
      kind: VastagharActionKind.FinalTread,
      windupTicks: 22,
      activeTicks: 67,
      recoveryTicks: 28,
      stepOffsets: [22, 37, 52, 67, 89],
      stepFeet: [
        VastagharFoot.OuterLeft,
        VastagharFoot.OuterRight,
        VastagharFoot.InnerLeft,
        VastagharFoot.InnerRight,
        VastagharFoot.Body,
      ],
      stepRadii: [350, 350, 350, 350, 960],
      stepDamage: [22, 22, 22, 22, 26],
      stepKnockback: [850, 850, 850, 850, 1000],
      innerRange: 0,
      outerRange: 0,
      halfWidth: 0,
      sweepRadians: 0,
      maxTargets: 1,
    },
  },
  phaseOneDeck: [
    VastagharActionKind.Crownstep,
    VastagharActionKind.HeelReap,
    VastagharActionKind.ShedMountain,
  ],
  phaseTwoDeck: [
    VastagharActionKind.ThreefoldMarch,
    VastagharActionKind.LandmarkBreak,
    VastagharActionKind.ShedMountain,
  ],
  phaseThreeDeck: [
    VastagharActionKind.TwinTread,
    VastagharActionKind.Worldwheel,
    VastagharActionKind.ShedMountain,
  ],
  desperationDeck: [VastagharActionKind.TwinTread, VastagharActionKind.Worldwheel],
  neutralTicks: {
    [VastagharActionKind.Crownstep]: 11,
    [VastagharActionKind.HeelReap]: 11,
    [VastagharActionKind.ShedMountain]: 14,
    [VastagharActionKind.ThreefoldMarch]: 15,
    [VastagharActionKind.LandmarkBreak]: 13,
    [VastagharActionKind.TwinTread]: 12,
    [VastagharActionKind.Worldwheel]: 18,
    [VastagharActionKind.FinalTread]: 20,
  },
} as const satisfies VastagharEncounterDef;

const WORLD_TITAN: BossDef = {
  kind: "world-titan",
  name: "Vastaghar, the World-Tread",
  move: "chase",
  encounter: "vastaghar",
  vastaghar: VASTAGHAR_ENCOUNTER,
  phases: [
    // P1 (>60%) — the slow, thunderous march: one quake per footfall, the odd crater to make you move.
    {
      hpAbove: 0.6,
      modules: [
        {
          primitive: "footfallQuake",
          cooldown: 2.2,
          windup: 0.95,
          params: { count: 1, radius: 320, damage: 24, knockback: 950, spread: 0 },
        },
        {
          primitive: "landingZone",
          cooldown: 5.0,
          windup: 1.0,
          firstDelay: 2.6,
          params: { count: 2, radius: 200, damage: 24, knockback: 850, spread: 560 },
        },
      ],
    },
    // P2 (>25%) — the stride quickens: double stomps (a foot + its aftershock) + a raking bullet fan.
    {
      hpAbove: 0.25,
      speedMult: 1.06,
      modules: [
        {
          primitive: "footfallQuake",
          cooldown: 1.8,
          windup: 0.85,
          params: { count: 2, radius: 320, damage: 26, knockback: 1000, spread: 360 },
        },
        {
          primitive: "bulletFan",
          cooldown: 3.4,
          windup: 0,
          firstDelay: 1.6,
          params: { count: 14, arc: 2.6, speed: 320, damage: 7 },
        },
      ],
    },
    // P3 (enrage) — a stampede: rapid triple-stomp quakes + summoned voidspawn between the tremors.
    {
      hpAbove: 0,
      speedMult: 1.14,
      modules: [
        {
          primitive: "footfallQuake",
          cooldown: 1.4,
          windup: 0.7,
          params: { count: 3, radius: 320, damage: 26, knockback: 1000, spread: 460 },
        },
        {
          primitive: "summonAdds",
          cooldown: 6.0,
          addKind: "mote-swarm",
          firstDelay: 2.0,
          params: { count: 4, ringRadius: 300, ringJitter: 90 },
        },
      ],
    },
  ],
};

/** Serraketh keeps one compatibility EnemyState root while its twelve fixed slots own all hurt geometry. */
const SERRAKETH: BossDef = {
  kind: "seam-eater",
  name: "Serraketh, the Seam-Eater",
  move: "stationary",
  encounter: "worm",
  worm: {
    baseCoreHp: 1500,
    rootKind: "old-rust",
    anatomy: {
      [WormSegmentRole.Head]: {
        role: WormSegmentRole.Head,
        radius: 52,
        localHpFraction: 0.04,
        armorHpFraction: 0.035,
        platedCoreMultiplier: 0.35,
        exposedCoreMultiplier: 1.35,
      },
      [WormSegmentRole.Neck]: {
        role: WormSegmentRole.Neck,
        radius: 43,
        localHpFraction: 0.05,
        armorHpFraction: 0.025,
        platedCoreMultiplier: 0.15,
        exposedCoreMultiplier: 0.75,
      },
      [WormSegmentRole.Body]: {
        role: WormSegmentRole.Body,
        radius: 39,
        localHpFraction: 0.045,
        armorHpFraction: 0,
        platedCoreMultiplier: 1,
        exposedCoreMultiplier: 1,
      },
      [WormSegmentRole.Spinner]: {
        role: WormSegmentRole.Spinner,
        radius: 45,
        localHpFraction: 0.04,
        armorHpFraction: 0.03,
        platedCoreMultiplier: 0.2,
        exposedCoreMultiplier: 0.9,
      },
      [WormSegmentRole.Tail]: {
        role: WormSegmentRole.Tail,
        radius: 37,
        localHpFraction: 0.055,
        armorHpFraction: 0.02,
        platedCoreMultiplier: 0.25,
        exposedCoreMultiplier: 1,
      },
    },
    actions: [
      {
        kind: WormActionKind.StitchReap,
        primitive: "seamEaterStitchReap",
        emitterRole: WormSegmentRole.Tail,
        windupTicks: 11,
        recoveryTicks: 8,
        params: { range: 230, halfArc: 0.8, damage: 18, knockback: 520 },
      },
      {
        kind: WormActionKind.RibQuake,
        primitive: "seamEaterRibQuake",
        emitterRole: WormSegmentRole.Spinner,
        windupTicks: 16,
        recoveryTicks: 8,
        params: { radius: 250, damage: 22, knockback: 850 },
      },
    ] as const,
    actionPhases: [
      { hpAbove: 0.7, cadenceTicks: 64, sequence: [WormActionKind.StitchReap] },
      {
        hpAbove: 0.35,
        cadenceTicks: 54,
        sequence: [WormActionKind.StitchReap, WormActionKind.RibQuake],
      },
      {
        hpAbove: 0.08,
        cadenceTicks: 40,
        sequence: [WormActionKind.RibQuake, WormActionKind.StitchReap],
      },
      {
        hpAbove: 0,
        cadenceTicks: 30,
        sequence: [WormActionKind.StitchReap, WormActionKind.RibQuake],
        paired: true,
        pairGapTicks: 5,
      },
    ] as const,
  },
  // The dedicated director owns these thresholds/actions. Empty module rows keep shared phase data explicit.
  phases: [
    { hpAbove: 0.7, modules: [] },
    { hpAbove: 0.35, modules: [] },
    { hpAbove: 0.08, modules: [] },
    { hpAbove: 0, modules: [] },
  ],
};

/** The boss-definition registry — keyed by `kind`. Slice 3 completes the roster with the melee trio
 *  (Kaido / Nihil / Blade Twins) → 10 bespoke bosses; v0.117 adds GOROGOTH the colossus → 11. */
export const BOSSES: Record<string, BossDef> = {
  verkaln: VERKALN,
  choirmath: CHOIRMATH,
  corvane: CORVANE,
  "nul-sightline": NUL,
  metronome: METRONOME,
  grull: GRULL,
  "quickdraw-vane": QUICKDRAW,
  kaido: KAIDO,
  nihil: NIHIL,
  "blade-twins": TWINS,
  "dimensional-colossus": COLOSSUS,
  "world-titan": WORLD_TITAN,
  "seam-eater": SERRAKETH,
};

/** §36 DIMENSION FINALE FIGHTS — each dimension's themed boss KIND (art + name + HP stay keyed on the kind,
 *  §17) reuses an existing, already-tested bespoke fight so every level's capstone PLAYS differently instead
 *  of all sharing OLD RUST (CLASSIC_BOSS). Chosen for thematic fit: the wild-west drifter is a gun-duel, the
 *  hollow king blinks like a void assassin, the moss golem is an unchained brute, the molten brute descends
 *  in a volcanic rage, the warden-mech keeps a machine-precise rhythm. These map by KIND, not by def.kind, so
 *  they stay OUT of BOSS_DEF_IDS (the dev picker) — no duplicate picker rows. */
const DIMENSION_BOSS_DEFS: Record<string, BossDef> = {
  "old-rust": QUICKDRAW,
  "the-hollow-king": NIHIL,
  "moss-stone-golem": GRULL,
  "molten-brute": VERKALN,
  "warden-mech": METRONOME,
};

/** The def for a boss `kind`: a bespoke picker def, else its dimension-finale fight, else `CLASSIC_BOSS`
 *  (Old Rust) as the ultimate fallback. Never returns undefined. */
export function bossDefFor(kind: string): BossDef {
  return BOSSES[kind] ?? DIMENSION_BOSS_DEFS[kind] ?? CLASSIC_BOSS;
}

/** Ordered list of the DEBUG-picker-spawnable boss kinds (the ones with bespoke defs) — drives the dev menu. */
export const BOSS_DEF_IDS: readonly string[] = Object.keys(BOSSES);
