import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  BOSS_SPAWN_FLOOR,
  BOSS_SPAWN_SECONDS,
  DEPTH_BOSS_ACCEL,
  DEPTH_DMG_PER,
  DEPTH_HP_PER,
  DEPTH_SPAWN_MULT,
  DEPTH_TOUGH_PER,
  DUMMY_HP,
  DUMMY_RADIUS,
  ENEMY_HP_PER_PLAYER,
  ENEMY_RADIUS,
  JUGGLE_KEEP_VH,
  JUGGLE_LAUNCH_VH,
  LUNGE_DAMAGE_MULT,
  LUNGE_MIN_DAMAGE,
  LUNGE_REACH_PAD,
  LUNGE_RECOVER,
  LUNGE_RECOVER_SWARM,
  LUNGE_STEP_FRAC,
  LUNGE_WINDUP,
  LUNGE_WINDUP_SWARM,
  SPAWN_INTERVAL_MIN,
  SPAWN_INTERVAL_START,
  SPAWN_RAMP_SECONDS,
  TOUGH_CHANCE_MAX,
  TOUGH_CHANCE_PER_PLAYER,
  TOUGH_RAMP_SECONDS,
} from "./constants.js";
import { DIMENSION_ENEMY_KINDS } from "./dimensions.generated.js";
import { clamp } from "./math.js";
import type { Vec2 } from "./movement.js";

/**
 * Enemy roster + authoritative AI (§15). PURE + data-driven (§15 "data-driven module library"):
 * the server runs these, client-side prediction could reuse them, and neither references engine
 * or network types. Behavioral nuance per archetype (spitter projectiles, zoner puddles, tough
 * combos — §15) layers on later; the M0 POC walks every archetype toward the nearest drifter.
 */
export interface EnemyKind {
  /** Sprite manifest id (matches an installed harvest-sliced sprite). */
  sprite: string;
  /** Behavioral archetype (§15). `dummy` = stationary training target (§21); `boss` = §16 OLD RUST;
   *  `duelist` = a melee swordsman that closes, telegraphs, then strings a COMBO (see `melee`); `leaper`
   *  (v0.113) = an elite that LEAPS to a telegraphed spot to announce its combo (see `leap`); `ranger`
   *  (v0.113) = a kiting shooter that DODGE-ROLLS away when you close (see `dodge`). */
  archetype:
    | "rusher"
    | "swarm"
    | "zoner"
    | "spitter"
    | "tough"
    | "duelist"
    | "leaper"
    | "ranger"
    | "dummy"
    | "boss";
  /** Render-size multiplier (§28.6: bosses/toughs are BIGGER, not more detailed). Default 1. */
  renderScale?: number;
  /** Move speed, px/sec. */
  speed: number;
  hp: number;
  radius: number;
  /** Contact damage to a touched player, hp/sec. */
  contactDamage: number;
  /** Relative spawn frequency. */
  weight: number;
  /** XP granted to the killer (§12). Tougher kin are worth more; dummies grant none. */
  xpValue: number;
  /**
   * Ranged attack (§15 spitter): fires a projectile at the nearest player on a cooldown, and
   * KITES — holds at `preferredRange` instead of rushing into melee. Absent = pure melee.
   */
  ranged?: {
    /** Will fire when a player is within this distance (px). */
    range: number;
    /** Distance the spitter tries to maintain (px) — backs off if closer, approaches if farther. */
    preferredRange: number;
    /** Seconds between shots. */
    cooldown: number;
    /** Damage per projectile hit (hp). */
    damage: number;
    /** Projectile speed (px/sec). */
    projectileSpeed: number;
    /**
     * §15 SCATTER spread (Gatlin): fire `count` projectiles fanned across `arc` radians (TOTAL cone,
     * centred on the aim) in one volley instead of a single shot — a shotgun burst. Each pellet does the
     * `damage` above. Absent / `count` ≤ 1 → a single aimed shot.
     */
    spread?: {
      count: number;
      arc: number;
    };
  };
  /**
   * §15 melee DUELIST combo (Sekiro-style §20): the enemy closes to `approach`, then strings `hits`
   * advancing strikes. EACH strike telegraphs (a white rhythm ring + lean-in) for its own windup —
   * `windup` sec for the first, `swingGap` sec for each follow-up — then LUNGES `step` px forward and
   * swings (arc-damaging players within `range`/`halfArc`), so it walks INTO you instead of flailing in
   * place. After the last hit it `recover`s before it can start another.
   */
  melee?: {
    approach: number;
    range: number;
    halfArc: number;
    damage: number;
    hits: number;
    windup: number;
    swingGap: number;
    recover: number;
    /** §20 forward LUNGE distance (px) on each strike — the "steps forward each attack" advance. */
    step: number;
  };
  /** §15 v0.113 LEAP — a `leaper` elite closes to `range`, then telegraphs a red landing marker at the
   *  target's spot (`windup` sec, an UNPARRYABLE dodge cue), LEAPS there over `airTime` sec, and on landing
   *  immediately strings its `melee` combo. The leap ANNOUNCES the combo: clear the marker or eat the flurry.
   *  `range` is the max distance it will commit a leap from; `cooldown` sec between leaps. */
  leap?: {
    range: number;
    windup: number;
    airTime: number;
    cooldown: number;
  };
  /** §15 v0.113 DODGE-ROLL — a `ranger` kites + fires, but when a player closes within `range` (and the
   *  `cooldown` is up) it ROLLS `distance` px away from the threat over `duration` sec (a fast evasive burst),
   *  so it's slippery to pin down. Pure repositioning (no i-frames) — the payoff is catching it mid-roll. */
  dodge?: {
    range: number;
    distance: number;
    duration: number;
    cooldown: number;
  };
  /** §9/§15 the enemy visibly WIELDS this weapon id (held-sprite on its rig, swung on each combo hit). */
  wieldsWeapon?: string;
  /** §13 on death, CHANCE [0..1] to DROP `wieldsWeapon` as a grabbable pickup. */
  dropWeapon?: number;
  /** §17 DIMENSION SHIFTER — a roaming cross-dimensional invader (the TimeSplitters-style antagonists), NOT
   *  part of any weighted spawn roster (weight 0). The shifter director phases one in on a timer, it HUNTS
   *  for `window` seconds, then phases out (despawns) if it survives. `tier` orders the three (1 = earliest
   *  + weakest Marshal, 2 = Ronin, 3 = heaviest Warden) — the active tier scales with run time. */
  shifter?: { tier: number; window: number };
  /** §51 the authored TOUGH-COMBO deck this kind speaks (keys TOUGH_COMBOS) with per-entry depth gates —
   *  the language binds only to TOUGH instances (and shifters, always): non-tough kin keep the legacy
   *  machine untouched. Vocabulary scales by DEPTH, never by compressing wind-ups (G15). */
  combos?: readonly ToughComboEntry[];
  /** §51 this kind OPENS its combo with the Negotiated Leap (the white duel-offer to the player's front)
   *  when tough — leapers + shifters. Grounded duelists walk in instead. */
  comboLeap?: boolean;
}

/**
 * §51 TOUGH-ENEMY COMBO LANGUAGE — the authored combo grammar (enemycombo panel). PURE data, shared so
 * the server executes and (later waves) the client presents off the same tables. Every wind-up is in
 * whole 50ms TICKS (the worm action-tick model) and every damaging beat respects the guardrails:
 * windup ≥ 6 ticks (G6 — T1's authored 0.25s second jab is clamped up to the 0.30s floor), strike
 * advance ≤ COMBO_STEP_MAX px (G2), and escalations spend MORE telegraph time than what they escalate
 * from ("stronger = slower = fairer" — the bait return is the longest white beat in its combo).
 */
export interface ToughComboEntry {
  /** Keys TOUGH_COMBOS. */
  combo: string;
  /** The run depth this entry unlocks at (§6 chain) — one new lesson at a time (G15). */
  minDepth: number;
}
export interface ToughComboStep {
  /** "strike" = an arc hit · "launcher" = strike that SETS the victim's vh (the juggle door) ·
   *  "airkeep" = strike valid only against an AIRBORNE victim inside its height window. */
  kind: "strike" | "launcher" | "airkeep";
  /** Authored wind-up in 50ms ticks (≥6, G6). The white ramp + Lock commit run over exactly this. */
  windupTicks: number;
  range: number;
  /** Cone half-arc, radians. */
  halfArc: number;
  /** × the kind's `melee.damage` (before TOUGH_DAMAGE_MULT and depthDamageScale). */
  damageMult: number;
  /** Forward lunge px at resolve — clamped to COMBO_STEP_MAX (G2: no >96px single-tick writes). */
  step: number;
  /** × HIT_KNOCKBACK_IMPULSE on a clean hit (finishers shove harder). Default 1. */
  knockbackMult?: number;
  /** RED step (H1's low sweep): dodge/jump-only — never parryable, never glints, and an AIRBORNE
   *  player CLEARS it (the footfall-quake "feet" language). Telegraphs danger=1. */
  unparryable?: boolean;
  /** Parry-BAIT: a parry of this step converts the knockback into the authored empowered return. */
  returnCapable?: boolean;
  /** Launcher payload: SET (never add) the victim's vh + a horizontal pop along the strike. */
  launch?: { vh: number; push: number };
  /** Air-keep payload: vh RESET (0 = no re-loft, the finisher lets you fall) + push, valid only while
   *  the victim's height is inside [hMin, hMax] px — grounded at resolve = the whole string whiffs. */
  airkeep?: { vh: number; push: number; hMin: number; hMax: number };
}
export interface ToughComboReturn {
  /** The empowered comeback's wind-up (ticks) — authored SLOWER than the bait (escalation buys the
   *  player MORE read time), then a RETURN_DASH_TICKS bounded-velocity close (≤RETURN_STEP_MAX px). */
  windupTicks: number;
  range: number;
  halfArc: number;
  damageMult: number;
  knockbackMult?: number;
  /** The forced recover after the return resolves PARRIED — the biggest punish window in the tier. */
  recoverTicks: number;
}
export interface ToughComboDef {
  id: string;
  /** Negotiated-leap canonical landing distance in FRONT of the player = 0.80 × opener range. */
  frontOffset: number;
  steps: readonly ToughComboStep[];
  /** Post-combo vulnerable window, ticks. */
  recoverTicks: number;
  /** Present = this combo carries a parry-bait branch (the "comes back stronger" return). */
  return?: ToughComboReturn;
  /** Parry-baited returns per combo run — 1 everywhere below the depth-7 Warden dialect. */
  maxReturns: number;
  /** Bait/juggle dialects — throttled to ≤40% of picks so the plain rhythms stay the spine. */
  advanced?: boolean;
}

/** Server-tuning wave: ordinary melee closes 25% faster; negotiated-leap/shifter kinds use the gentler
 * +20% rail so their fixed offer/arc choreography keeps its authored displacement assumptions. */
export const MELEE_ENEMY_SPEED_MULT = 1.25;
export const LEAP_MELEE_ENEMY_SPEED_MULT = 1.2;
/** Authoritative melee sectors are 30% larger in both reach and half-arc. Telegraphs consume these same
 * values, so the enlarged danger remains WYSIWYG without touching any windup or juggle law. */
export const MELEE_ENEMY_RANGE_MULT = 1.3;
export const MELEE_ENEMY_ARC_MULT = 1.3;

/** §51 the combo library, keyed by id. Timings/damage are the designer's authored numbers on the 50ms
 *  grid; each inter-impact gap is ≥ the 0.25s chain-parry fairness floor. */
export const TOUGH_COMBOS: Record<string, ToughComboDef> = {
  // ── Katana — the teaching family (opener range 138 → frontOffset 110) ──
  /** K1 · Sanren: fast-fast-slow, the rhythm every player should be able to hum. Designed to be beaten
   *  completely — two quick parries build the chain, the slow gold finisher is the riposte setup. */
  "k1-sanren": {
    id: "k1-sanren",
    frontOffset: 110,
    steps: [
      { kind: "strike" as const, windupTicks: 8, range: 138, halfArc: 0.9, damageMult: 1.0, step: 66 },
      { kind: "strike" as const, windupTicks: 6, range: 138, halfArc: 0.9, damageMult: 1.0, step: 66 },
      {
        kind: "strike" as const,
        windupTicks: 15,
        range: 138,
        halfArc: 0.9,
        damageMult: 1.25,
        step: 96,
        knockbackMult: 1.3,
      },
    ],
    recoverTicks: 22,
    maxReturns: 0,
  },
  /** K2 · Drawn Moon: one delayed iai cut, all nerve — punishes the panic-parry, rewards the read. */
  "k2-drawn-moon": {
    id: "k2-drawn-moon",
    frontOffset: 110,
    steps: [
      { kind: "strike" as const, windupTicks: 19, range: 138, halfArc: 1.4, damageMult: 1.5, step: 84 },
    ],
    recoverTicks: 26,
    maxReturns: 0,
  },
  /** K3 · Gale Cross: the parry-bait. The scary branch is the one YOUR button created — and it hands
   *  you the bigger prize (second parry → riposte-range chain + the 1.50s punish window). */
  "k3-gale-cross": {
    id: "k3-gale-cross",
    frontOffset: 110,
    steps: [
      {
        kind: "strike" as const,
        windupTicks: 9,
        range: 138,
        halfArc: 0.9,
        damageMult: 0.9,
        step: 66,
        returnCapable: true,
      },
      { kind: "strike" as const, windupTicks: 7, range: 138, halfArc: 0.9, damageMult: 1.0, step: 66 },
    ],
    recoverTicks: 22,
    return: {
      windupTicks: 17,
      range: 138,
      halfArc: 0.9,
      damageMult: 1.5,
      knockbackMult: 1.5,
      recoverTicks: 30,
    },
    maxReturns: 1,
    advanced: true,
  },
  /** K4 · Sky Hook: the flagship juggle — launcher + two air-keeps at the 0.65/0.60s cadence, then the
   *  kneeling 1.60s recover (the longest vulnerability in the tough roster). */
  "k4-sky-hook": {
    id: "k4-sky-hook",
    frontOffset: 110,
    steps: [
      {
        kind: "launcher" as const,
        windupTicks: 12,
        range: 138,
        halfArc: 0.9,
        damageMult: 1.0,
        step: 70,
        launch: { vh: JUGGLE_LAUNCH_VH, push: 120 },
      },
      {
        kind: "airkeep" as const,
        windupTicks: 13,
        range: 138,
        halfArc: 0.9,
        damageMult: 0.7,
        step: 24,
        airkeep: { vh: JUGGLE_KEEP_VH, push: 0, hMin: 2, hMax: 130 },
      },
      {
        kind: "airkeep" as const,
        windupTicks: 12,
        range: 138,
        halfArc: 0.9,
        damageMult: 0.7,
        step: 24,
        airkeep: { vh: 0, push: 0, hMin: 2, hMax: 130 }, // no re-loft — the finisher lets you fall
      },
    ],
    recoverTicks: 32,
    maxReturns: 0,
    advanced: true,
  },
  // ── Heavy — the weight family (opener range 150 → frontOffset 120) ──
  /** H1 · Sweep-into-Overhead: the mixed-verb classic — RED low sweep (jump it), white overhead (parry
   *  it). Teaches that red-on-a-tough means FEET. */
  "h1-sweep-overhead": {
    id: "h1-sweep-overhead",
    frontOffset: 120,
    steps: [
      {
        kind: "strike" as const,
        windupTicks: 11,
        range: 150,
        halfArc: 2.27,
        damageMult: 0.9,
        step: 40,
        unparryable: true,
      },
      {
        kind: "strike" as const,
        windupTicks: 13,
        range: 150,
        halfArc: 1.0,
        damageMult: 1.35,
        step: 78,
      },
    ],
    recoverTicks: 25,
    maxReturns: 0,
  },
  /** H2 · Anchor Drag: heavy's iai — one 0.90s scored-ground yank. */
  "h2-anchor-drag": {
    id: "h2-anchor-drag",
    frontOffset: 120,
    steps: [
      { kind: "strike" as const, windupTicks: 18, range: 150, halfArc: 1.0, damageMult: 1.3, step: 90 },
    ],
    recoverTicks: 24,
    maxReturns: 0,
  },
  /** H3 · Gravedigger: the heavy bait — smells like a finisher, is actually an opener. */
  "h3-gravedigger": {
    id: "h3-gravedigger",
    frontOffset: 120,
    steps: [
      {
        kind: "strike" as const,
        windupTicks: 12,
        range: 150,
        halfArc: 1.0,
        damageMult: 1.1,
        step: 70,
        returnCapable: true,
      },
      { kind: "strike" as const, windupTicks: 10, range: 150, halfArc: 1.0, damageMult: 1.0, step: 60 },
    ],
    recoverTicks: 25,
    return: {
      windupTicks: 19,
      range: 150,
      halfArc: 1.0,
      damageMult: 1.6,
      knockbackMult: 1.6,
      recoverTicks: 32,
    },
    maxReturns: 1,
    advanced: true,
  },
  /** H4 · Coffin Lid: the heavy juggle (depth 6+) — the golf-swing keep bats you somewhere on purpose. */
  "h4-coffin-lid": {
    id: "h4-coffin-lid",
    frontOffset: 120,
    steps: [
      {
        kind: "launcher" as const,
        windupTicks: 14,
        range: 150,
        halfArc: 1.0,
        damageMult: 1.1,
        step: 60,
        launch: { vh: JUGGLE_LAUNCH_VH, push: 120 },
      },
      {
        kind: "airkeep" as const,
        windupTicks: 13,
        range: 150,
        halfArc: 1.0,
        damageMult: 0.9,
        step: 24,
        airkeep: { vh: JUGGLE_KEEP_VH, push: 200, hMin: 2, hMax: 130 },
      },
    ],
    recoverTicks: 32,
    maxReturns: 0,
    advanced: true,
  },
  // ── Thrust — the line family (opener range 145 → frontOffset 116) ──
  /** T1 · Rail Sequence: thin wedges — sidestep is as valid as parry. Step-2's authored 0.25s rides the
   *  G6 floor at 6 ticks; the impale's authored 110px advance rides the G2 cap at 96. */
  "t1-rail": {
    id: "t1-rail",
    frontOffset: 116,
    steps: [
      { kind: "strike" as const, windupTicks: 7, range: 145, halfArc: 0.35, damageMult: 0.85, step: 50 },
      { kind: "strike" as const, windupTicks: 6, range: 145, halfArc: 0.35, damageMult: 0.85, step: 50 },
      { kind: "strike" as const, windupTicks: 12, range: 145, halfArc: 0.35, damageMult: 1.3, step: 96 },
    ],
    recoverTicks: 20,
    maxReturns: 0,
  },
  /** T2 · Switchback: hit-and-run bait — if the deep lunge LANDS the thrust disengages (combo ends);
   *  if it's PARRIED the rail-dash impale comes back along a thin painted lane. */
  "t2-switchback": {
    id: "t2-switchback",
    frontOffset: 116,
    steps: [
      {
        kind: "strike" as const,
        windupTicks: 10,
        range: 145,
        halfArc: 0.35,
        damageMult: 1.0,
        step: 90,
        returnCapable: true,
      },
    ],
    recoverTicks: 20,
    return: {
      windupTicks: 16,
      range: 145,
      halfArc: 0.35,
      damageMult: 1.45,
      recoverTicks: 28,
    },
    maxReturns: 1,
    advanced: true,
  },
  // ── Dual — the flurry family (opener range ~140 → frontOffset 112) ──
  /** D1 · Fang Flurry: the chain-parry exam — four crests, individually cheap, collectively lethal. */
  "d1-fang-flurry": {
    id: "d1-fang-flurry",
    frontOffset: 112,
    steps: [
      { kind: "strike" as const, windupTicks: 7, range: 140, halfArc: 0.8, damageMult: 0.7, step: 40 },
      { kind: "strike" as const, windupTicks: 6, range: 140, halfArc: 0.8, damageMult: 0.7, step: 40 },
      { kind: "strike" as const, windupTicks: 6, range: 140, halfArc: 0.8, damageMult: 0.7, step: 40 },
      { kind: "strike" as const, windupTicks: 11, range: 140, halfArc: 0.8, damageMult: 0.7, step: 40 },
    ],
    recoverTicks: 23,
    maxReturns: 0,
  },
  /** D2 · Scissor Lift: the short-form juggle — teaches the vocabulary at lower stakes (one keep,
   *  no re-loft), appears earliest in the depth curve. */
  "d2-scissor-lift": {
    id: "d2-scissor-lift",
    frontOffset: 112,
    steps: [
      {
        kind: "launcher" as const,
        windupTicks: 11,
        range: 140,
        halfArc: 0.8,
        damageMult: 0.9,
        step: 60,
        launch: { vh: JUGGLE_LAUNCH_VH, push: 120 },
      },
      {
        kind: "airkeep" as const,
        windupTicks: 13,
        range: 140,
        halfArc: 0.8,
        damageMult: 0.75,
        step: 24,
        airkeep: { vh: 0, push: 0, hMin: 2, hMax: 130 },
      },
    ],
    recoverTicks: 26,
    maxReturns: 0,
    advanced: true,
  },
};

// Tough geometry is authored above in its original weapon-family proportions, then widened once at module
// load. Keeping the multiplier here makes the equal-strength 1.30× pass auditable while leaving every
// windupTicks, step, damage, recover, launch, airkeep, and juggle cap byte-for-byte unchanged.
for (const combo of Object.values(TOUGH_COMBOS)) {
  combo.frontOffset *= MELEE_ENEMY_RANGE_MULT;
  for (const step of combo.steps) {
    step.range *= MELEE_ENEMY_RANGE_MULT;
    step.halfArc = Math.min(Math.PI, step.halfArc * MELEE_ENEMY_ARC_MULT);
  }
  if (combo.return) {
    combo.return.range *= MELEE_ENEMY_RANGE_MULT;
    combo.return.halfArc = Math.min(Math.PI, combo.return.halfArc * MELEE_ENEMY_ARC_MULT);
  }
}

/** §51 does this combo carry a parry-bait branch / a juggle string? (pillar classification for G15). */
export function comboIsBait(id: string): boolean {
  return !!TOUGH_COMBOS[id]?.return;
}
export function comboIsJuggle(id: string): boolean {
  return !!TOUGH_COMBOS[id]?.steps.some((s) => s.kind === "launcher");
}

/**
 * §51 pick the next combo from a deck — PURE (caller supplies the [0,1) roll). Depth gates the
 * vocabulary; a NO-REPEAT rule (never the same combo twice in a row) plus the ≤40% advanced throttle
 * (never two bait/juggle picks back-to-back — fall back to the deck's first core rhythm) keep the plain
 * rhythms the statistical spine. Returns "" when nothing is eligible at this depth.
 */
export function pickToughCombo(
  deck: readonly ToughComboEntry[],
  depth: number,
  lastComboId: string,
  roll: number,
): string {
  // Combo commits are per-engagement (seconds apart), but the selector is still allocation-free: the
  // 60/40 core/advanced split is a hard probability partition, then a second pass selects within it.
  const atDepth = Math.max(1, depth);
  let coreCount = 0;
  let advancedCount = 0;
  for (const entry of deck) {
    const def = entry.minDepth <= atDepth ? TOUGH_COMBOS[entry.combo] : undefined;
    if (!def) continue;
    if (def.advanced) advancedCount++;
    else coreCount++;
  }
  if (coreCount + advancedCount === 0) return "";
  const boundedRoll = Math.max(0, Math.min(0.999999999, roll));
  // No consecutive advanced picks keeps their realised share below the authored 40% ceiling, while the
  // partition makes the unconditioned deck weight exactly 60/40 when both dialects are available.
  let advanced =
    advancedCount > 0 &&
    (coreCount === 0 || (boundedRoll >= 0.6 && !TOUGH_COMBOS[lastComboId]?.advanced));
  let count = advanced ? advancedCount : coreCount;
  if (count === 0) {
    advanced = !advanced;
    count = advanced ? advancedCount : coreCount;
  }
  const localRoll = advanced && coreCount > 0 ? (boundedRoll - 0.6) / 0.4 : boundedRoll / 0.6;
  let slot = Math.min(count - 1, Math.max(0, Math.floor(Math.max(0, localRoll) * count)));
  let picked = "";
  for (const entry of deck) {
    const def = entry.minDepth <= atDepth ? TOUGH_COMBOS[entry.combo] : undefined;
    if (!def || !!def.advanced !== advanced) continue;
    if (slot-- === 0) {
      picked = entry.combo;
      break;
    }
  }
  if (picked !== lastComboId) return picked;
  // Absolute no-repeat: rotate within the selected partition, then across partitions if it had one item.
  for (const entry of deck) {
    const def = entry.minDepth <= atDepth ? TOUGH_COMBOS[entry.combo] : undefined;
    if (def && !!def.advanced === advanced && entry.combo !== lastComboId) return entry.combo;
  }
  for (const entry of deck) {
    if (entry.minDepth <= atDepth && TOUGH_COMBOS[entry.combo] && entry.combo !== lastComboId)
      return entry.combo;
  }
  return picked;
}

/** Wild West M0 roster wired for the first level (§15). */
export const ENEMY_KINDS: Record<string, EnemyKind> = {
  critter: {
    sprite: "critter",
    archetype: "rusher",
    speed: 168,
    hp: 3,
    radius: 18,
    contactDamage: 4,
    weight: 5,
    xpValue: 1,
  },
  "mote-swarm": {
    sprite: "mote-swarm",
    archetype: "swarm",
    speed: 225,
    hp: 1,
    radius: 12,
    contactDamage: 2.5,
    weight: 4,
    xpValue: 1,
  },
  pricklepulp: {
    sprite: "pricklepulp",
    archetype: "zoner",
    speed: 62,
    hp: 9,
    radius: 26,
    contactDamage: 6,
    weight: 2,
    xpValue: 3,
  },
  boothill: {
    sprite: "boothill",
    archetype: "spitter",
    speed: 120,
    hp: 5,
    radius: 20,
    contactDamage: 3.5,
    weight: 2,
    xpValue: 3,
    // Skeleton gunslinger — keeps its distance and spits at you (§15). The first real ranged threat.
    ranged: {
      range: 560,
      preferredRange: 340,
      cooldown: 2.1,
      damage: 8,
      projectileSpeed: 300,
    },
  },
  // §16 BOSS — OLD RUST. POC stand-in art (a scaled-up boothill; bigger, not more detailed, §28.6)
  // until bespoke boss art lands. Slow, tanky, hits hard in melee AND spits heavy at range. weight 0
  // = never randomly spawned; only the boss director spawns it at BOSS_SPAWN_SECONDS.
  "old-rust": {
    sprite: "boothill",
    archetype: "boss",
    speed: 72,
    hp: 420,
    radius: 64,
    contactDamage: 14,
    weight: 0,
    xpValue: 40,
    renderScale: 2.7,
    ranged: {
      range: 760,
      preferredRange: 360,
      cooldown: 1.6,
      damage: 13,
      projectileSpeed: 320,
    },
  },
  // §16 v0.109 DATA-DRIVEN BOSS BODIES — the framework's showcase styles (BossDef in bosses.ts drives their
  // attacks; these entries only supply the body). POC stand-in art = the scaled boothill boss rig; bespoke
  // Codex art swaps in via the manifest with no code change. weight 0 = never randomly spawned (director
  // + debug picker only). archetype "boss" → boss bar + no derived lunge (the BossController owns attacks).
  // Ver'Kaln — LARGE landing-zone titan.
  verkaln: {
    sprite: "verkaln", // §16 v0.116 bespoke art harvest-installed
    archetype: "boss",
    speed: 60,
    hp: 480,
    radius: 72,
    contactDamage: 12,
    weight: 0,
    xpValue: 42,
    renderScale: 2.9,
  },
  // The Choirmath — LARGE bullet-hell spiral god (stationary).
  choirmath: {
    sprite: "choirmath", // §16 v0.116 bespoke art harvest-installed
    archetype: "boss",
    speed: 0,
    hp: 440,
    radius: 66,
    contactDamage: 8,
    weight: 0,
    xpValue: 40,
    renderScale: 2.7,
  },
  // Cor-Vane the Hive-Mind — CHARACTER-SIZED fragile summoner (kites).
  corvane: {
    sprite: "corvane", // §16 v0.116 bespoke art harvest-installed
    archetype: "boss",
    speed: 150,
    hp: 300,
    radius: 26,
    contactDamage: 6,
    weight: 0,
    xpValue: 38,
    renderScale: 1.25,
  },
  // Nul the Sightline — LARGE stationary beam-sweeper (one enormous eye).
  "nul-sightline": {
    sprite: "nul-sightline", // §16 v0.116 bespoke art harvest-installed
    archetype: "boss",
    speed: 0,
    hp: 440,
    radius: 66,
    contactDamage: 8,
    weight: 0,
    xpValue: 40,
    renderScale: 2.7,
  },
  // The Metronome — LARGE stationary expanding-ring rhythm boss.
  metronome: {
    sprite: "metronome", // §16 v0.116 bespoke art harvest-installed
    archetype: "boss",
    speed: 0,
    hp: 440,
    radius: 64,
    contactDamage: 8,
    weight: 0,
    xpValue: 40,
    renderScale: 2.7,
  },
  // Grull the Unchained — LARGE chain-dash berserker (lumbers between charges).
  grull: {
    sprite: "grull", // §16 v0.116 bespoke art harvest-installed
    archetype: "boss",
    speed: 70,
    hp: 470,
    radius: 70,
    contactDamage: 12,
    weight: 0,
    xpValue: 42,
    renderScale: 2.6,
  },
  // Quickdraw Vane — CHARACTER-SIZED strafing gunslinger. `ranged` supplies the controller's strafe orbit
  // range only (the boss fires via its BossDef, not the generic spitter path, which skips the boss).
  "quickdraw-vane": {
    sprite: "quickdraw-vane", // §16 v0.116 bespoke art harvest-installed
    archetype: "boss",
    speed: 150,
    hp: 320,
    radius: 26,
    contactDamage: 6,
    weight: 0,
    xpValue: 38,
    renderScale: 1.3,
    ranged: { range: 700, preferredRange: 340, cooldown: 2, damage: 6, projectileSpeed: 320 },
  },
  // §16 Slice 3 — Kaido the Parry-Dancer (CHARACTER). A relentless close-range duelist: he plants + swings
  // PARRYABLE white arcs (parry-chain them) and mixes in red dash-lunges you must dodge. Fast, in-your-face.
  kaido: {
    sprite: "kaido", // §16 v0.117 bespoke art harvest-installed
    archetype: "boss",
    speed: 170,
    hp: 340,
    radius: 26,
    contactDamage: 6,
    weight: 0,
    xpValue: 40,
    renderScale: 1.32,
  },
  // §16 Slice 3 — Nihil the Blink Assassin (CHARACTER). Teleports beside you and slams; peppers parryable
  // shuriken between blinks. Watch the poof marker, vacate it. Fragile — punish the recovery.
  nihil: {
    sprite: "nihil", // §16 v0.117 bespoke art harvest-installed
    archetype: "boss",
    speed: 120,
    hp: 300,
    radius: 26,
    contactDamage: 6,
    weight: 0,
    xpValue: 40,
    renderScale: 1.28,
  },
  // §16 Slice 3 — Castor & Pollux the Blade Twins (CHARACTER). A twin-blade duelist that strikes with BOTH
  // edges at once — paired dash lanes + a parryable cross-slash. Aggressive, two-danger-at-a-time pressure.
  "blade-twins": {
    sprite: "blade-twins", // §16 v0.117 bespoke art harvest-installed
    archetype: "boss",
    speed: 160,
    hp: 380,
    radius: 30,
    contactDamage: 8,
    weight: 0,
    xpValue: 44,
    renderScale: 1.4,
  },
  // §16 v0.117 GOROGOTH, THE DIMENSION-ENDER — the COLOSSUS: a boss so vast it barely fits on screen. The
  // existing "LARGE" bosses sit at renderScale ~2.7 (radius ~70); this one is 6.4× / radius 170 — a walking
  // mountain the squad orbits, dodging screen-wide shockwaves and craters. Borrows the `grull` brute
  // silhouette at colossal scale until bespoke art is harvest-installed. Ponderous (slow) but hits like a god.
  "dimensional-colossus": {
    sprite: "grull", // placeholder silhouette — a hulking brute reads right at titan scale
    archetype: "boss",
    speed: 46,
    hp: 1300,
    radius: 170,
    contactDamage: 16,
    weight: 0,
    xpValue: 90,
    renderScale: 6.4,
  },
  // §33 v0.118 VASTAGHAR — a boss so vast only his LOWER BODY fits on screen (renderScale 13). You fight at
  // his feet; every ponderous FOOTSTEP drops a ground quake you jump over or parry. Slow, unstoppable.
  "world-titan": {
    sprite: "grull", // placeholder silhouette (the same hulking brute, rendered mountain-huge)
    archetype: "boss",
    speed: 40,
    hp: 1900,
    radius: 230,
    contactDamage: 18,
    weight: 0,
    xpValue: 110,
    renderScale: 13,
  },
  // §15 melee DUELIST — a sword-wielding ronin (a tough-tier threat). Closes in, telegraphs, then
  // strings a 3-hit combo with a real arc hitbox (no passive contact DPS — it ATTACKS). Wields one of
  // our example swords (Voltedge) and has a chance to drop it on death (§13). POC art = boothill rig
  // (humanoid w/ hands); bespoke ronin art lands via CODE-21.
  ronin: {
    sprite: "boothill",
    archetype: "duelist",
    renderScale: 1.18,
    speed: 156,
    hp: 36,
    radius: 22,
    contactDamage: 0, // attacks via the combo, not by touch
    weight: 0.7, // rare — a special threat, not horde filler
    xpValue: 9,
    wieldsWeapon: "x-sword-neon-katana",
    dropWeapon: 0.35,
    melee: {
      approach: 150, // start the duel from a touch farther so the lunges read as it CLOSING on you
      range: 138,
      halfArc: 0.9,
      damage: 13,
      hits: 3,
      windup: 0.52, // a clear first telegraph (white ring fills) — time to read + parry
      swingGap: 0.34, // each follow-up also telegraphs over this — a parryable rhythm, not a flurry
      recover: 0.95,
      step: 72, // lunges forward on each strike (Sekiro step-in) — advances rather than standing still
    },
    // §51 the TOUGH ronin speaks the katana grammar (grounded duelist — walks in, no leap): the Sanren
    // spine, the Drawn Moon iai at depth 3, the Gale Cross bait at depth 3. Non-tough kin keep the
    // legacy 3-hit machine untouched.
    combos: [
      { combo: "k1-sanren", minDepth: 1 },
      { combo: "k2-drawn-moon", minDepth: 3 },
      { combo: "k3-gale-cross", minDepth: 3 },
    ],
  },
  // §15 SCATTER tough — GATLIN, a heavy drifter (§15 "Tough/scatter — parryable scatter spread"). Slow
  // and bulky, it KITES to its preferred range and lets loose a 5-pellet SHOTGUN cone (the `spread` block)
  // on a long cooldown — punishes standing in a line, rewards flanking. Some contact threat (it's beefy)
  // but the volley is the danger. POC art = the boothill rig (bespoke full-build Gatlin art via CODE-21).
  gatlin: {
    sprite: "boothill",
    archetype: "spitter", // reuses the kite + fire framework; `spread` turns the shot into a burst
    renderScale: 1.5,
    speed: 92, // slow heavy drifter
    hp: 48,
    radius: 28,
    contactDamage: 5,
    weight: 0.6, // rare special threat, like the ronin
    xpValue: 11,
    ranged: {
      range: 460,
      preferredRange: 300,
      cooldown: 2.6, // a slow, heavy volley
      damage: 6, // per pellet
      projectileSpeed: 320,
      spread: { count: 5, arc: 0.85 }, // 5-pellet cone, ~49° wide
    },
  },
  // §15 v0.113 VAULT-RONIN — a leaping duelist ELITE. Closes, then LEAPS to a telegraphed landing spot on
  // you (announcing the combo), and on landing strings a fast 3-hit parryable flurry. Rare special threat.
  "vault-ronin": {
    sprite: "boothill",
    archetype: "leaper",
    renderScale: 1.22,
    speed: 150,
    hp: 44,
    radius: 22,
    contactDamage: 0, // attacks via the combo, not touch
    weight: 0.55,
    xpValue: 13,
    wieldsWeapon: "x-sword-neon-katana",
    dropWeapon: 0.3,
    melee: {
      approach: 140,
      range: 140,
      halfArc: 0.95,
      damage: 12,
      hits: 3,
      windup: 0.46,
      swingGap: 0.3,
      recover: 0.85,
      step: 66,
    },
    leap: { range: 540, windup: 0.5, airTime: 0.28, cooldown: 3.4 },
    // §51 the TOUGH vault-ronin replaces its red assault-leap with the WHITE Negotiated Leap and speaks
    // Sanren + (depth 5) the Sky Hook juggle. Leap+juggle = two pillars, never three (G15) — no baits.
    combos: [
      { combo: "k1-sanren", minDepth: 1 },
      { combo: "k4-sky-hook", minDepth: 5 },
    ],
    comboLeap: true,
  },
  // §15 v0.113 DUST-RANGER — a kiting gunslinger that DODGE-ROLLS away when you close, so it's slippery to
  // pin. Punishes lazy approach; reward = catch it mid-roll or corner it. A special threat, not horde filler.
  "dust-ranger": {
    sprite: "boothill",
    archetype: "ranger",
    renderScale: 1.15,
    speed: 158,
    hp: 40,
    radius: 22,
    contactDamage: 4,
    weight: 0.55,
    xpValue: 12,
    ranged: {
      range: 640,
      preferredRange: 380,
      cooldown: 1.35,
      damage: 9,
      projectileSpeed: 350,
    },
    dodge: { range: 250, distance: 230, duration: 0.26, cooldown: 2.6 },
  },
  // Training dummy (§21) — stationary, harmless, lots of HP (resets on depletion). weight 0 =
  // never chosen by the spawn director; only placed in Testing Grounds mode.
  dummy: {
    sprite: "pricklepulp",
    archetype: "dummy",
    speed: 0,
    hp: DUMMY_HP,
    radius: DUMMY_RADIUS,
    contactDamage: 0,
    weight: 0,
    xpValue: 0,
  },
  // §17 the themed-dimension rosters (Frostfell / Verdant Ruins / Ashlands / Neon-Cyber) + the 3 roaming
  // SHIFTERS, codegen'd into dimensions.generated.ts from the design data. Each dimension scopes its own
  // weighted spawn pool via `getDimension(id).roster` (pickEnemyKind), so these never leak into Wild West.
  ...DIMENSION_ENEMY_KINDS,
};

// §32 v0.118 EVERY enemy wields one of our weapons — the one it DROPS irregularly on death. Assigned here
// (post-merge, so it covers hand-authored AND generated dimension kinds) to any non-boss/dummy kind that
// doesn't already carry a signature weapon. Melee archetypes get a blade, ranged get a gun; the pick is
// hashed off the kind id so it's stable + varied. `wieldsWeapon` only drives the drop (server) + the
// in-hand render (client) — no AI change — and handless "blob" rigs simply don't draw it (they still drop).
const ENEMY_MELEE_POOL: readonly string[] = [
  "rusty-cleaver",
  "driftblade",
  "twin-bowie-fangs",
  "x-sword-buzzsaw",
  "x-sword-anchor",
  "rattler-sabre",
  "x-sword-coffin",
  "x-sword-railspike",
  "x-sword-neon-katana",
  "x-sword-bone",
  "tombstone-greatsword",
];
const ENEMY_RANGED_POOL: readonly string[] = [
  "x-gun-revolver-cannon",
  "x-gun-coffin-shotgun",
  "x-gun-gatling",
  "x-gun-nailgun",
  "x-gun-ricochet-pistol",
];
const MELEE_ARCHETYPES = new Set(["rusher", "swarm", "leaper", "duelist"]);
function hashPick(seed: string, pool: readonly string[]): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return pool[h % pool.length] ?? pool[0]!;
}
for (const [id, kind] of Object.entries(ENEMY_KINDS)) {
  if (kind.archetype === "boss" || kind.archetype === "dummy" || kind.wieldsWeapon) continue;
  const pool = MELEE_ARCHETYPES.has(kind.archetype) ? ENEMY_MELEE_POOL : ENEMY_RANGED_POOL;
  kind.wieldsWeapon = hashPick(id, pool);
  kind.dropWeapon = kind.dropWeapon ?? 0.22; // irregular — most kills don't drop
}

// §51 COMBO-DECK ASSIGNMENT (post-merge, like the weapon pass above, so it covers hand-authored AND
// generated dimension kinds): every duelist/leaper/shifter kind with a real `melee` block and a wielded
// pool blade speaks its BLADE's weapon-family grammar when tough. The family is the vocabulary the
// player already knows from their own hands (§51 designer roster). G15 pillar law enforced here as
// data-lint: a LEAPING kind sheds one advanced dialect — shifters keep the family BAIT and shed the
// juggle (the Warden dialect), other leapers keep the JUGGLE and shed the bait (the vault-ronin
// template) — so no non-boss kind ever stacks leap + bait + juggle.
const KATANA_DECK: readonly ToughComboEntry[] = [
  { combo: "k1-sanren", minDepth: 1 },
  { combo: "k2-drawn-moon", minDepth: 3 },
  { combo: "k3-gale-cross", minDepth: 3 },
  { combo: "k4-sky-hook", minDepth: 5 },
];
const HEAVY_DECK: readonly ToughComboEntry[] = [
  { combo: "h1-sweep-overhead", minDepth: 1 },
  { combo: "h2-anchor-drag", minDepth: 2 },
  { combo: "h3-gravedigger", minDepth: 4 },
  { combo: "h4-coffin-lid", minDepth: 6 },
];
const THRUST_DECK: readonly ToughComboEntry[] = [
  { combo: "t1-rail", minDepth: 1 },
  { combo: "t2-switchback", minDepth: 3 },
];
const DUAL_DECK: readonly ToughComboEntry[] = [
  { combo: "d1-fang-flurry", minDepth: 1 },
  { combo: "d2-scissor-lift", minDepth: 4 },
];
const COMBO_DECK_BY_WEAPON: Record<string, readonly ToughComboEntry[]> = {
  "x-sword-neon-katana": KATANA_DECK,
  "rattler-sabre": KATANA_DECK,
  driftblade: KATANA_DECK,
  "rusty-cleaver": HEAVY_DECK,
  "x-sword-anchor": HEAVY_DECK,
  "x-sword-coffin": HEAVY_DECK,
  "x-sword-bone": HEAVY_DECK,
  "tombstone-greatsword": HEAVY_DECK,
  "x-sword-buzzsaw": HEAVY_DECK,
  "x-sword-railspike": THRUST_DECK,
  "twin-bowie-fangs": DUAL_DECK,
};

// The generated design data still carries two pre-combo placeholders that contradict the named roster:
// Marshal is a sabre tutorialist (K1), not a gunner, and the neon Riot Enforcer is the thrust-family
// dimension duelist. Normalise those identities here rather than editing generated output by hand.
const comboMarshal = ENEMY_KINDS["shifter-cinder-marshal"];
if (comboMarshal) {
  comboMarshal.archetype = "duelist";
  comboMarshal.ranged = undefined;
  comboMarshal.wieldsWeapon = "rattler-sabre";
  comboMarshal.melee = {
    approach: 150,
    range: 138,
    halfArc: 0.9,
    damage: 11,
    hits: 3,
    windup: 0.5,
    swingGap: 0.3,
    recover: 0.9,
    step: 66,
  };
  comboMarshal.combos = [{ combo: "k1-sanren", minDepth: 1 }];
  comboMarshal.comboLeap = true;
}
const comboRiotEnforcer = ENEMY_KINDS["riot-enforcer"];
if (comboRiotEnforcer) comboRiotEnforcer.wieldsWeapon = "x-sword-railspike";

for (const kind of Object.values(ENEMY_KINDS)) {
  if (kind.combos || !kind.melee) continue;
  if (kind.archetype !== "duelist" && kind.archetype !== "leaper" && !kind.shifter) continue;
  const deck = COMBO_DECK_BY_WEAPON[kind.wieldsWeapon ?? ""];
  if (!deck) continue;
  const leaps = kind.archetype === "leaper" || !!kind.shifter;
  if (leaps) kind.comboLeap = true;
  if (!leaps) kind.combos = deck;
  else if (kind.shifter?.tier === 3) {
    // Warden's named deck includes H3 at depth 4 and H4 at depth 6. A performance selects ONE entry, so
    // it is leap+bait OR leap+juggle — never all three pillars in one choreography (G15).
    kind.combos = deck;
  } else {
    kind.combos = kind.shifter
      ? deck.filter((e) => !comboIsJuggle(e.combo))
      : deck.filter((e) => !comboIsBait(e.combo));
  }
}

// One roster-wide melee tuning pass covers both hand-authored and generated dimension kinds without
// editing generated output. Tough instances read the same kind row, so they inherit the speed increase.
// Explicit combo sectors widen here; derived rusher/swarm/zoner sectors widen in effectiveMelee below.
for (const kind of Object.values(ENEMY_KINDS)) {
  const meleeMover =
    kind.archetype === "rusher" ||
    kind.archetype === "swarm" ||
    kind.archetype === "zoner" ||
    kind.archetype === "duelist" ||
    kind.archetype === "leaper";
  if (!meleeMover) continue;
  kind.speed *= kind.archetype === "leaper" || kind.shifter
    ? LEAP_MELEE_ENEMY_SPEED_MULT
    : MELEE_ENEMY_SPEED_MULT;
  if (!kind.melee) continue;
  kind.melee.approach *= MELEE_ENEMY_RANGE_MULT;
  kind.melee.range *= MELEE_ENEMY_RANGE_MULT;
  kind.melee.halfArc = Math.min(Math.PI, kind.melee.halfArc * MELEE_ENEMY_ARC_MULT);
}

export const ENEMY_KIND_IDS = Object.keys(ENEMY_KINDS);

/** §17 the DIMENSION-SHIFTER kind ids, ordered by tier (1 = earliest/weakest Marshal → 3 = Warden). Derived
 *  from the `shifter` flag on the merged kinds, so adding a shifter to the data wires it into the director
 *  with no code change. The shifter director indexes this by run-time tier. */
export const SHIFTER_KIND_IDS: readonly string[] = ENEMY_KIND_IDS.filter(
  (id) => ENEMY_KINDS[id]?.shifter,
).sort((a, b) => (ENEMY_KINDS[a]?.shifter?.tier ?? 0) - (ENEMY_KINDS[b]?.shifter?.tier ?? 0));

/** Pick a kind id by spawn weight from a [0,1) roll, restricted to `roster` (§17 the active dimension's
 *  weighted spawn pool — so frost enemies never spawn in the desert). Pure (caller supplies the random);
 *  defaults to every kind for back-compat. */
export function pickEnemyKind(roll: number, roster: readonly string[] = ENEMY_KIND_IDS): string {
  const ids = roster.length ? roster : ENEMY_KIND_IDS;
  const total = ids.reduce((s, k) => s + (ENEMY_KINDS[k]?.weight ?? 0), 0);
  if (total <= 0) return ids[0] ?? "critter";
  let r = roll * total;
  for (const k of ids) {
    r -= ENEMY_KINDS[k]?.weight ?? 0;
    if (r < 0) return k;
  }
  return ids[0] ?? "critter";
}

/** §8/§20 the LUNGE attack a melee/contact monster uses: the explicit `melee` combo if the kind defines one
 *  (duelists/shifters), else a DERIVED single-hit lunge for the contact archetypes (rusher/swarm/zoner) so
 *  EVERY such monster telegraphs then JUMPS at you = parryable (§8). Ranged spitters, the boss, and dummies
 *  have NO lunge (undefined) — their threat is projectiles / phases / nothing, and DoT puddles + the boss's
 *  AoE slam stay unparryable by design. Passive contact (touch) damage (`contactDamage`) is SEPARATE and
 *  always applies; the lunge is the discrete telegraphed hit on top. Derived lunges are MEMOIZED per kind
 *  (deterministic) so the per-tick AI loop allocates nothing. */
const LUNGE_ARCHETYPES = new Set(["rusher", "swarm", "zoner"]);
const meleeCache = new WeakMap<EnemyKind, NonNullable<EnemyKind["melee"]> | null>();
export function effectiveMelee(kind: EnemyKind | undefined): EnemyKind["melee"] {
  if (!kind) return undefined;
  if (kind.melee) return kind.melee;
  const cached = meleeCache.get(kind);
  if (cached !== undefined) return cached ?? undefined;
  let derived: NonNullable<EnemyKind["melee"]> | null = null;
  if (LUNGE_ARCHETYPES.has(kind.archetype)) {
    const swarm = kind.archetype === "swarm";
    const reach = (kind.radius + LUNGE_REACH_PAD) * MELEE_ENEMY_RANGE_MULT;
    derived = {
      approach: reach + 16 * MELEE_ENEMY_RANGE_MULT, // preserve the pre-contact windup margin
      range: reach,
      halfArc: 0.95 * MELEE_ENEMY_ARC_MULT, // forgiving cone — readable, not a sniper jab
      damage: Math.max(LUNGE_MIN_DAMAGE, kind.contactDamage * LUNGE_DAMAGE_MULT),
      hits: 1, // a single jab (duelists override with a real multi-hit combo)
      windup: swarm ? LUNGE_WINDUP_SWARM : LUNGE_WINDUP,
      swingGap: 0.3, // unused at hits:1, kept valid for the combo machine
      recover: swarm ? LUNGE_RECOVER_SWARM : LUNGE_RECOVER,
      step: Math.max(48, kind.speed * LUNGE_STEP_FRAC),
    };
  }
  meleeCache.set(kind, derived);
  return derived ?? undefined;
}

/** Nearest target to `pos` (the squad). Returns null if there are none. */
export function nearestPoint(pos: Vec2, targets: readonly Vec2[]): Vec2 | null {
  let best: Vec2 | null = null;
  let bestD = Number.POSITIVE_INFINITY;
  for (const t of targets) {
    const d = (t.x - pos.x) ** 2 + (t.y - pos.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  return best;
}

/** Authoritative enemy chase step — PURE. Walks `pos` toward `target` at `speed`, arena-clamped. */
export function stepEnemyChase(
  pos: Vec2,
  target: Vec2 | null,
  speed: number,
  dtSeconds: number,
): Vec2 {
  if (!target) return { x: pos.x, y: pos.y };
  let dx = target.x - pos.x;
  let dy = target.y - pos.y;
  const len = Math.hypot(dx, dy);
  if (len > 0.001) {
    dx /= len;
    dy /= len;
  }
  return {
    x: clamp(pos.x + dx * speed * dtSeconds, ENEMY_RADIUS, ARENA_WIDTH - ENEMY_RADIUS),
    y: clamp(pos.y + dy * speed * dtSeconds, ENEMY_RADIUS, ARENA_HEIGHT - ENEMY_RADIUS),
  };
}

/**
 * Authoritative KITE step — PURE. A spitter approaches when farther than `preferredRange`,
 * backs away when closer than ~85% of it, and otherwise holds (a small dead-band stops jitter).
 * Arena-clamped, same as the chase step.
 */
export function stepEnemyKite(
  pos: Vec2,
  target: Vec2 | null,
  speed: number,
  preferredRange: number,
  dtSeconds: number,
): Vec2 {
  if (!target) return { x: pos.x, y: pos.y };
  let dx = target.x - pos.x;
  let dy = target.y - pos.y;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;
  let dir = 0;
  if (len > preferredRange)
    dir = 1; // too far — close in
  else if (len < preferredRange * 0.85) dir = -1; // too close — back off
  return {
    x: clamp(pos.x + dx * speed * dir * dtSeconds, ENEMY_RADIUS, ARENA_WIDTH - ENEMY_RADIUS),
    y: clamp(pos.y + dy * speed * dir * dtSeconds, ENEMY_RADIUS, ARENA_HEIGHT - ENEMY_RADIUS),
  };
}

/** Is `target` within `range` of `origin` AND within `halfArc` radians of the aim dir? Pure — the core
 *  melee-arc hit test for EVERY weapon swing (server-authoritative; `range`/`halfArc` come from the
 *  WeaponDef). Point-blank always counts. */
export function inMeleeArc(
  origin: Vec2,
  aimX: number,
  aimY: number,
  target: Vec2,
  range: number,
  halfArc: number,
): boolean {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return false;
  if (dist < 0.001) return true;
  const aimLen = Math.hypot(aimX, aimY) || 1;
  const dot = (dx * aimX + dy * aimY) / (dist * aimLen);
  return dot >= Math.cos(halfArc);
}

/** Evenly-spaced fan of `count` angles spanning `arc` radians (TOTAL), centred on `baseAngle`. PURE —
 *  the deterministic geometry behind a §15 scatter spread (Gatlin's shotgun) and any cone volley. `count`
 *  ≤ 1 → just `[baseAngle]`; `count` 2+ spreads from `baseAngle − arc/2` to `baseAngle + arc/2`. */
export function coneAngles(baseAngle: number, count: number, arc: number): number[] {
  if (count <= 1) return [baseAngle];
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    out.push(baseAngle + (i / (count - 1) - 0.5) * arc);
  }
  return out;
}

/** Probability [0,1] that a freshly-spawned enemy is TOUGH — ramps with run time AND player count
 *  (§6 "more players → more toughs"). Pure. */
export function toughChance(elapsedSeconds: number, playerCount = 1, depth = 1): number {
  const t = Math.min(1, Math.max(0, elapsedSeconds) / TOUGH_RAMP_SECONDS);
  const players = Math.max(1, playerCount);
  return Math.min(
    0.8,
    TOUGH_CHANCE_MAX * t +
      TOUGH_CHANCE_PER_PLAYER * (players - 1) +
      DEPTH_TOUGH_PER * (Math.max(1, depth) - 1), // v0.103 §6 chain: deeper runs elite-denser
  );
}

/** §6 enemy HP multiplier from player count — spongier with more players (1.0 solo). Pure. */
export function enemyHpScale(playerCount: number): number {
  return 1 + ENEMY_HP_PER_PLAYER * (Math.max(1, playerCount) - 1);
}

/** §6 chain-depth HP multiplier (v0.103) — every dimension pushed makes enemies AND the boss spongier.
 *  Multiplies WITH enemyHpScale: independent axes (squad size vs how deep you've greeded). Pure. */
export function depthHpScale(depth: number): number {
  return 1 + DEPTH_HP_PER * (Math.max(1, depth) - 1);
}

/** §6 chain-depth DAMAGE multiplier (v0.103) — every hostile hit (contact/melee/projectile/DoT/slam)
 *  scales up per depth, so deep dimensions threaten a levelled squad instead of just out-sponging it. Pure. */
export function depthDamageScale(depth: number): number {
  return 1 + DEPTH_DMG_PER * (Math.max(1, depth) - 1);
}

/** Seconds-between-spawns given run elapsed — linear escalation to a floor (§6); §6 chain depth
 *  (v0.103) compresses the whole curve multiplicatively (each depth ~8% faster), HARD-floored at 0.25s
 *  so absurd depths can't collapse the interval toward zero (an instant-refill horde every tick). Pure. */
export function spawnInterval(elapsedSeconds: number, depth = 1): number {
  const t = Math.min(1, Math.max(0, elapsedSeconds) / SPAWN_RAMP_SECONDS);
  const base = SPAWN_INTERVAL_START + (SPAWN_INTERVAL_MIN - SPAWN_INTERVAL_START) * t;
  return Math.max(0.25, base * DEPTH_SPAWN_MULT ** (Math.max(1, depth) - 1));
}

/** §6/§16 when the dimension boss arrives, by chain depth (v0.103): DEPTH_BOSS_ACCEL seconds sooner per
 *  depth pushed, floored so the squad always gets a breath to level + loot before the capstone. Pure. */
export function bossSpawnAt(depth: number): number {
  return Math.max(
    BOSS_SPAWN_FLOOR,
    BOSS_SPAWN_SECONDS - DEPTH_BOSS_ACCEL * (Math.max(1, depth) - 1),
  );
}
