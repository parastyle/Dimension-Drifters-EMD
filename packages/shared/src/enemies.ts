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
   *  `duelist` = a melee swordsman that closes, telegraphs, then strings a COMBO (see `melee`). */
  archetype: "rusher" | "swarm" | "zoner" | "spitter" | "tough" | "duelist" | "dummy" | "boss";
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
  /** §9/§15 the enemy visibly WIELDS this weapon id (held-sprite on its rig, swung on each combo hit). */
  wieldsWeapon?: string;
  /** §13 on death, CHANCE [0..1] to DROP `wieldsWeapon` as a grabbable pickup. */
  dropWeapon?: number;
  /** §17 DIMENSION SHIFTER — a roaming cross-dimensional invader (the TimeSplitters-style antagonists), NOT
   *  part of any weighted spawn roster (weight 0). The shifter director phases one in on a timer, it HUNTS
   *  for `window` seconds, then phases out (despawns) if it survives. `tier` orders the three (1 = earliest
   *  + weakest Marshal, 2 = Ronin, 3 = heaviest Warden) — the active tier scales with run time. */
  shifter?: { tier: number; window: number };
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
    sprite: "boothill",
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
    sprite: "boothill",
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
    sprite: "boothill",
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
    sprite: "boothill",
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
    sprite: "boothill",
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
    sprite: "boothill",
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
    sprite: "boothill",
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
    const reach = kind.radius + LUNGE_REACH_PAD;
    derived = {
      approach: reach + 16, // start winding up a touch before contact range
      range: reach,
      halfArc: 0.95, // forgiving cone — readable, not a sniper jab
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
