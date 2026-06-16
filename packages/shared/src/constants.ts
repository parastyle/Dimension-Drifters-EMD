/**
 * Cross-cutting constants. Single source of truth (§26 retro #3) — imported by both
 * client and server so the two never disagree on the numbers that drive sync.
 *
 * Anything tagged "tuning" is a placeholder, not a [LOCKED] spec value.
 */

/** Server simulation tick rate. §4 [LOCKED]: 20Hz (bullets are client-sim'd). */
export const TICK_RATE = 20;
/** Milliseconds per server tick. */
export const TICK_MS = 1000 / TICK_RATE;

/** Flat player move speed in px/sec. §7 [LOCKED]: flat move speed, no sprint layer. (tuning) */
export const MOVE_SPEED = 320;

/** One big arena per stage (§5). Server-seeded procedural arenas come later (§4/§17). (tuning) */
export const ARENA_WIDTH = 2400;
export const ARENA_HEIGHT = 2400;

/** Blob body radius in px. Body collision is respected by all objects (§5) — added later. (tuning) */
export const PLAYER_RADIUS = 24;

/** Networking. */
export const DEFAULT_PORT = 2567;
export const ROOM_NAME = "arena";

/** Session ceiling. §5/§22 [LOCKED]: up to 10 players. */
export const MAX_PLAYERS = 10;

/** Enemy body radius in px (tuning). */
export const ENEMY_RADIUS = 18;

/**
 * Spawn director (§5 density pressure, §6 timed escalation). All tuning placeholders.
 * Spawns ramp from SPAWN_INTERVAL_START to SPAWN_INTERVAL_MIN seconds over SPAWN_RAMP_SECONDS.
 */
export const SPAWN_INTERVAL_START = 1.9;
export const SPAWN_INTERVAL_MIN = 0.65;
export const SPAWN_RAMP_SECONDS = 240;
/** Distance from a player at which enemies spawn — just beyond a typical screen edge. (tuning) */
export const SPAWN_RING = 720;
/**
 * POC enemy cap. Enemies are full Tier-1 sync here (fine at these counts); the §4 Tier-2
 * soft-synced horde (hundreds/player) lands with StateView AoI before the load test.
 */
export const MAX_ENEMIES = 80;

/** Player combat/survival (§6, §20). All tuning placeholders. */
export const PLAYER_MAX_HP = 100;
/** Always-on health regen, hp/sec (§6). */
export const PLAYER_REGEN = 6;
/** POC convenience respawn; the brutal §6 death rules (rez-or-dead) come with the run loop. */
export const RESPAWN_SECONDS = 3;
/** On respawn, clear enemies within this radius of the spawn point so you don't instantly die. (tuning) */
export const RESPAWN_CLEAR_RADIUS = 320;

/** Testing Grounds (§21 hub dummies). Dummy HP resets when depleted so it persists; pickups
 *  equip on walk-over. (tuning) */
export const DUMMY_HP = 250;
export const DUMMY_RADIUS = 30;
export const PICKUP_RADIUS = 46;

/**
 * "Fists" placeholder melee — a stand-in so the level is playable before the real weapon
 * framework (build-order step 4 / §10 arsenal). Swings a short forward arc toward the cursor.
 */
export const FISTS_DAMAGE = 2;
export const FISTS_RANGE = 96;
/** Half-angle (radians) of the swing arc on each side of the aim direction. */
export const FISTS_HALF_ARC = 0.7;
export const FISTS_COOLDOWN = 0.32;

/**
 * Enemy ranged attacks (§15 spitter — the "heaven" of bullets to dodge). Server-authoritative
 * projectiles: damage is applied on the tick; the client renders + dead-reckons them. (tuning)
 */
export const PROJECTILE_SPEED = 300;
export const PROJECTILE_DAMAGE = 8;
export const PROJECTILE_RADIUS = 9;
/** Seconds a projectile lives before expiring (also culled at the arena edge). */
export const PROJECTILE_TTL = 3.5;

/**
 * Zoner puddles (§15 Pricklepulp): a lingering corrosive zone dropped as the zoner moves,
 * denying ground — stand in it and take DoT. Server-authoritative. (tuning)
 */
export const ZONE_RADIUS = 86;
export const ZONE_DPS = 10;
export const ZONE_TTL = 4.5;
/** Seconds between a zoner dropping fresh puddles. */
export const ZONER_DROP_INTERVAL = 2.4;

/**
 * Tough tier (§15 — "bigger/glowier size-parity of its kin," NOT bespoke art). Spawn chance ramps
 * with run time; a tough enemy scales up, hits harder, tanks more, and is worth more XP. (tuning)
 */
export const TOUGH_CHANCE_MAX = 0.28;
export const TOUGH_RAMP_SECONDS = 200;
/**
 * §6 difficulty scaling by PLAYER COUNT (not by multiplying the horde): each extra player makes
 * every enemy spongier (equalises death rate vs more combined DPS) and raises the tough rate. At 1
 * player both are 1.0/no-op (solo baseline). (tuning)
 */
export const ENEMY_HP_PER_PLAYER = 0.6; // +60% enemy HP per extra player
export const TOUGH_CHANCE_PER_PLAYER = 0.08; // +8 percentage-points tough chance per extra player
export const TOUGH_HP_MULT = 4;
export const TOUGH_DAMAGE_MULT = 1.7;
export const TOUGH_XP_MULT = 4;
export const TOUGH_SCALE = 1.7;

/**
 * Run loop (§6/§16): the boss OLD RUST spawns at this mark, and clearing it opens an extraction
 * portal — step into it to WIN the run. The capstone goal that turns survival into a run. (tuning)
 */
export const BOSS_SPAWN_SECONDS = 120;

/** Greatsword slam (§9 "everything aims at the cursor"): the quake erupts at the CURSOR, but no
 *  farther than this from the character — you slam where you aim, within reach. (tuning) */
export const QUAKE_REACH = 260;
/** Chain lightning (§10 on-hit proc): a single hop cannot exceed this even if a weapon over-tunes its
 *  own `chainLightning.range`. Server + client both clamp to it so the predicted bolt path matches the
 *  authoritative chain. (Global safety cap, analogous to QUAKE_REACH.) */
export const CHAIN_MAX_RANGE = 320;
/** Step within this radius of the open extraction portal to complete the run. (tuning) */
export const EXTRACT_RADIUS = 90;

/** Parry — the melee LMB signature (§7/§8). Base effect = i-frames + knockback (augments TODO).
 *  No telegraphed enemy attacks yet, so for now it's a defensive panic button. (tuning) */
export const PARRY_IFRAMES = 0.45;
export const PARRY_COOLDOWN = 0.6;
export const PARRY_RADIUS = 135;
export const PARRY_KNOCKBACK = 96;
