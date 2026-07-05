/**
 * Cross-cutting constants. Single source of truth (§26 retro #3) — imported by both
 * client and server so the two never disagree on the numbers that drive sync.
 *
 * Anything tagged "tuning" is a placeholder, not a [LOCKED] spec value.
 */

/** §4 Colyseus schema HANDSHAKE version (audit). BUMP this whenever a synced `@type` field is added,
 *  removed, reordered, or retyped in state.ts — Colyseus serializes by field ORDER, so a stale client
 *  decodes new patches with corrupted offsets (HP reads as aim, etc.). The server stamps it on
 *  `ArenaState.schemaVersion`; the client compares on join and tells the player to hard-reload on a
 *  mismatch instead of rendering silently-corrupt state. */
export const SCHEMA_VERSION = 5; // v0.104 — §10/§13 loot: +pickup rarity/affix/known, +player weaponRarity/weaponAffix

/** Server simulation tick rate. §4 [LOCKED]: 20Hz (bullets are client-sim'd). */
export const TICK_RATE = 20;
/** Milliseconds per server tick. */
export const TICK_MS = 1000 / TICK_RATE;

/** Flat player move speed in px/sec. §7 [LOCKED]: flat move speed, no sprint layer. (tuning) */
export const MOVE_SPEED = 320;

/** One big arena per stage (§5). Server-seeded procedural arenas come later (§4/§17). (tuning)
 *  v0.102 "release-roominess" pass: 2400² → 4800² (4× the area) so the arena reads as a WORLD you roam,
 *  not a pen — combat density is unchanged (enemies spawn on a ring around the players), the extra space
 *  is breathing room between the terrain features. */
export const ARENA_WIDTH = 4800;
export const ARENA_HEIGHT = 4800;

/**
 * §17 procedural arena tiling. The map is a coarse integer grid of `MAP_TILE`-px cells (chosen to divide
 * the arena evenly: 4800 / 80 = 60 → a 60×60 grid). Generation (mapgen.ts) is server-seeded + shared so
 * every client reproduces the identical map. All TUNING. Phase 0 only produces + validates the grid; pit
 * rendering/collision is the §17 Phase 1 follow-up.
 */
export const MAP_TILE = 80;
/** Guaranteed-ground disc at the arena centre (tiles) — players spawn here, never on/over a pit. */
export const MAP_SPAWN_CLEAR_TILES = 3;
/** A solid ground ring this many tiles deep around the arena edge (no pit flush against the wall). */
export const MAP_BORDER_TILES = 1;
/** Target pit coverage of the interior (fraction) — the generator aims near this. Kept LOW on purpose
 *  (roominess): pits are fewer, GRANDER features with open lanes between, not scattered pixel noise. */
export const MAP_PIT_TARGET = 0.13;
/** Hard ceiling on pit coverage — if blob growth + smoothing overshoot, an erosion pass trims pits back
 *  under this so the arena stays mostly playable (never swiss cheese). */
export const MAP_PIT_MAX = 0.22;
/** Minimum spacing between pit "seed" sites (tiles), so hazards spread out instead of clumping — wide
 *  enough that clear traversal lanes always exist between neighbouring pit features. */
export const MAP_PIT_SPACING_TILES = 7;
/**
 * Widest pit GAP (tiles) a player may be REQUIRED to cross by jumping — the connectivity guarantee treats
 * any straight gap up to this as "hoppable" and bridges anything wider with ground, so no region is ever
 * stranded behind an uncrossable pit. Derived from the hop reach (JUMP_AIRTIME × MOVE_SPEED ≈ 144px ≈ ~2
 * tiles); kept conservative so a required hop is always comfortable.
 */
export const MAP_MAX_JUMP_TILES = 2;

/**
 * §17 POI LANDMARKS — big standing structures (oil derrick / windmill / dead tree / adobe ruin /
 * water tower / rock spire) placed deterministically in the arena for cover + orientation. Players AND
 * enemies COLLIDE with them (static circle obstacles), so they read as real cover. (tuning)
 *
 * v0.102 size-class system: every landmark gets a deterministic size class from its `kind`
 * (`poiScale(kind)` in mapgen.ts — S/M/L/XL), its collision radius scales with it (`poiRadius(kind)`),
 * and the client derives each sprite's visual scale FROM the collision radius (WYSIWYG — the art's base
 * width matches the blocker you actually collide with). MAP_POI_RADIUS is the M-class BASE radius.
 */
export const MAP_POI_COUNT = 28;
/** Minimum spacing between POIs (tiles) — a floor; the real rule is pairwise radius-aware (mapgen). */
export const MAP_POI_SPACING_TILES = 5;
/** BASE (M-class) POI collision radius (px) — size classes multiply this (S 0.8× → XL 1.9×). */
export const MAP_POI_RADIUS = 58;
/** Guaranteed clear WALKING gap (px) between any two landmark footprints — wide enough that a player
 *  (and the horde chasing them) can always thread between neighbouring blockers without wedging. */
export const MAP_POI_GAP = 150;
/** GROUND ring guaranteed around each landmark's footprint (px) — must exceed the LARGEST body radius,
 *  because resolvePoiCollision parks a pushed-out body's centre at `poiRadius + bodyRadius`: without this
 *  ring an XL landmark on a pit lip shoves the body straight over the edge (adversarial-verify finding). */
export const MAP_POI_GROUND_CLEARANCE = 72;
/** Keep POIs this many tiles clear of the spawn disc so they never trap a spawning player. */
export const MAP_POI_SPAWN_CLEAR_TILES = 5;

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
/** Dev summon (§21 Testing Grounds): max monsters spawned per Tab-menu summon click (the multiplier cap). */
export const DEBUG_SPAWN_MAX = 30;

/** Player combat/survival (§6, §20). All tuning placeholders. */
export const PLAYER_MAX_HP = 100;
/** Always-on health regen, hp/sec (§6). */
export const PLAYER_REGEN = 6;
/** Legacy POC respawn delay — superseded by the §6 rez-or-dead model (kept only for `restart`). */
export const RESPAWN_SECONDS = 3;
/** On revive/restart, clear enemies within this radius so you don't instantly die in the pile. (tuning) */
export const RESPAWN_CLEAR_RADIUS = 320;
/** §6 rez-or-dead death model. A downed player is dead until a REZ weapon effect is used on them; the
 *  revive returns them at `REVIVE_HP_FRAC` of max HP. `REZ_RADIUS` = how close the rez weapon reaches a
 *  downed ally on a swing. No rezzer (solo, or whole squad down) → the run wipes (`outcome="defeat"`). */
export const REVIVE_HP_FRAC = 0.3;
export const REZ_RADIUS = 96;

/** Testing Grounds (§21 hub dummies). Dummy HP resets when depleted so it persists; pickups
 *  equip on walk-over. (tuning) */
export const DUMMY_HP = 250;
export const DUMMY_RADIUS = 30;
export const PICKUP_RADIUS = 46;
/** §9/§13 drop & salvage: after a player DROPS a weapon it can't be re-grabbed for this long (sec), so a
 *  drop at your feet doesn't snap straight back. */
export const DROP_GRACE_SECONDS = 0.7;
/** §13 hold-to-salvage: seconds the drop key must be HELD before the held weapon salvages (tap = drop). */
export const SALVAGE_HOLD_SECONDS = 0.6;

/** §5 JUMP (Spacebar) — a low all-class traversal HOP that clears barriers + pitfalls (§17). It is PURE
 *  MOVEMENT, NOT a dodge — no i-frames (the parry stays the only defensive tool, so the two never overlap).
 *  Server-authoritative airborne timer + a short cooldown so it isn't a spammable bunny-hop; the §17 pit
 *  layer reads `airborne` to let a hopping player pass over a gap. */
export const JUMP_AIRTIME = 0.45;
export const JUMP_COOLDOWN = 0.7;
/** Peak visual hop height (px) the client lifts the rig at the top of the arc. */
export const JUMP_HOP_HEIGHT = 34;

/** §5/§20 VERTICAL physics (Stage B) — the jump is now a real upward impulse under gravity, generalising
 *  the old fixed-duration hop into a HEIGHT axis (px above ground) that the §17 pit layer + the later
 *  §8 parry-launch ride on. Tuned so airtime ≈ JUMP_AIRTIME (0.45s) and peak ≈ JUMP_HOP_HEIGHT (34px).
 *  PURE: a shared `stepVertical(height, vh, dt)` integrates it server-side + (future) in client prediction. */
export const GRAVITY = 1350; // px/s² pulling height back to ground
export const JUMP_VELOCITY = 303; // px/s upward kick on a grounded jump
/** Height (px) at/below which a player counts as GROUNDED (jump-ready + pit-fall-eligible). */
export const GROUND_EPSILON = 0.5;

/** §17 pitfall FALL consequence (Mike's ruling: chip + reposition, NOT run-ending). A grounded player
 *  whose body is over a pit falls: loses this fraction of max HP, snaps back to the last grounded tile,
 *  and gets a brief GRACE (i-frames + no re-fall) so a pit isn't a death spiral or a landing-gank. An
 *  AIRBORNE player (mid-jump, §5) is immune — the hop clears the gap. */
export const PIT_FALL_DAMAGE_FRAC = 0.15;
export const PIT_FALL_GRACE = 0.6;

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
 * Run loop (§6/§16): the dimension boss spawns at this mark, and clearing it opens the EXTRACTION
 * portal (bank & end) plus the DEEPER rift (§6 chain — push into the next dimension, harder). (tuning)
 */
export const BOSS_SPAWN_SECONDS = 120;

/**
 * §6 DIMENSION CHAIN (v0.103, audit C1/H2/H6) — the greed loop. Clearing a boss offers TWO portals:
 * EXTRACT (bank the squad's carried salvage, run ends in victory) or the RIFT (descend: depth+1, a new
 * dimension + freshly-seeded map, same squad/levels/weapons/HP — risk it all for a bigger bank).
 * Difficulty scales with DEPTH on top of the clock/player scaling: enemy+boss HP, tough chance, and a
 * faster boss clock. A WIPE loses everything carried ("bank or lose"). All tuning.
 */
/** Extra enemy/boss HP per depth beyond 1 (depth 3 → ×1.5). */
export const DEPTH_HP_PER = 0.25;
/** Extra enemy DAMAGE per depth beyond 1 (contact/melee/projectile/DoT/slam). Without a damage axis the
 *  chain punishes patience, not skill — player EHP grows ~+40% per 10 levels while enemy damage sat flat. */
export const DEPTH_DMG_PER = 0.12;
/** §6 the chain's WAGES (v0.103) — what pushing deeper actually EARNS. Every living player pockets
 *  carried salvage on the two capstone moments, scaled by depth: bank it at the portal or gamble it
 *  deeper. (A depth-5 chain carries ~5+10+15+20+25 = 75 from bosses alone vs 5 for bank-at-1.) */
export const BOSS_SALVAGE_PER_DEPTH = 5;
export const SHIFTER_SALVAGE_PER_DEPTH = 3;
/** §6 the rift is a CHANNEL, not a tripwire: a living player must hold the rift for this long (a synced
 *  0→1 charge the client draws) before the squad commits — one misstep or one griefer can't yank four
 *  players into depth+1. Extraction stays instant (it's the benign direction). */
export const RIFT_CHANNEL_SECONDS = 1.6;

/**
 * §10/§13 IN-RUN LOOT (v0.104) — drop rates + the LUK hook. Any enemy can drop (§13); tier drives the
 * rate; bosses GUARANTEE a drop; shifters keep their identity-known wielded-weapon drop on top. Drops are
 * MYSTERY pickups (type + rarity telegraphed, identity revealed on grab). All tuning.
 */
/** Chance a TRASH kill drops a mystery weapon. */
export const DROP_CHANCE_TRASH = 0.012;
/** Chance a TOUGH kill drops a mystery weapon. */
export const DROP_CHANCE_TOUGH = 0.055;
/** §11 LUK: each point above 1 multiplies every rarity tier above Common by (1 + this)^tier — the
 *  dormant attribute finally reads into something (rarity odds), per "LUK = rarity/luck effects". */
export const LUK_RARITY_PER = 0.06;
/** §13 "tier affects drop rate AND rarity": the killer's tier rolls the rarity table as bonus LUK — a
 *  TOUGH rolls like +2 LUK, a BOSS like +8, so the guaranteed capstone drop rarely lands Common-plain.
 *  (This also gives depth an organic rarity gradient — tough-share ramps with depth.) */
export const LOOT_TIER_LUK_TOUGH = 2;
export const LOOT_TIER_LUK_BOSS = 8;
/** Extra tough-spawn chance per depth beyond 1 (additive percentage points). */
export const DEPTH_TOUGH_PER = 0.06;
/** Spawn-interval multiplier per depth beyond 1 (0.92 → each depth spawns ~8% faster, floored). */
export const DEPTH_SPAWN_MULT = 0.92;
/** The boss clock shortens this many seconds per depth beyond 1 (deeper = the capstone comes sooner)… */
export const DEPTH_BOSS_ACCEL = 15;
/** …but never below this floor (the squad always gets a breath to level + loot). */
export const BOSS_SPAWN_FLOOR = 70;
/** How far from the extraction portal the DEEPER rift opens (px) — apart enough that standing in one
 *  can never read as choosing the other. */
export const RIFT_OFFSET = 420;
/** §16 OLD RUST multi-phase fight tuning (all placeholders). P1/P3 = bullet-wall fire cadence (sec); the
 *  wall fans `BOSS_WALL_COUNT` slugs across `BOSS_WALL_ARC` rad with a 2-wide weave-gap at `BOSS_BULLET_SPEED`.
 *  P2 punch-slam: telegraph `BOSS_SLAM_TELEGRAPH` sec then an UNPARRYABLE `BOSS_SLAM_DAMAGE` hit inside
 *  `BOSS_SLAM_RADIUS`, on a `BOSS_SLAM_CD` cadence. P3 enrage spawns Mote adds every `BOSS_ADD_CD` sec. */
export const BOSS_WALL_COUNT = 11;
export const BOSS_WALL_ARC = 1.9;
export const BOSS_BULLET_SPEED = 360;
export const BOSS_P1_FIRE_CD = 1.5;
export const BOSS_P3_FIRE_CD = 0.85;
export const BOSS_SLAM_CD = 4.2;
export const BOSS_SLAM_TELEGRAPH = 0.85;
export const BOSS_SLAM_RADIUS = 150;
export const BOSS_SLAM_DAMAGE = 22;
export const BOSS_ADD_CD = 3.5;
export const BOSS_ADD_COUNT = 2;

/**
 * §17 DIMENSION SHIFTER incursions — the roaming cross-dimensional antagonists (TimeSplitters-style). One
 * phases in on the `SHIFTER_INTERVAL` cadence (first at `SHIFTER_FIRST_SECONDS`), HUNTS the squad for its
 * own `shifter.window`, then rifts back out if it survives. The tier in play escalates with run time —
 * `floor(elapsed / SHIFTER_TIER_SECONDS)` indexes the tier-ordered roster (Marshal → Ronin → Warden) — and
 * each successive incursion is `SHIFTER_HP_PER_WAVE` tougher (the "deeper into the chain" ramp). Only one
 * incursion at a time; held while the dimension BOSS is up. (tuning)
 */
export const SHIFTER_FIRST_SECONDS = 28;
export const SHIFTER_INTERVAL = 42;
export const SHIFTER_TIER_SECONDS = 45;
export const SHIFTER_HP_PER_WAVE = 0.12;

/** Greatsword slam (§9 "everything aims at the cursor"): the quake erupts at the CURSOR, but no
 *  farther than this from the character — you slam where you aim, within reach. (tuning) */
export const QUAKE_REACH = 260;
/** Chain lightning (§10 on-hit proc): a single hop cannot exceed this even if a weapon over-tunes its
 *  own `chainLightning.range`. Server + client both clamp to it so the predicted bolt path matches the
 *  authoritative chain. (Global safety cap, analogous to QUAKE_REACH.) */
export const CHAIN_MAX_RANGE = 320;
/** Step within this radius of the open extraction portal to complete the run. (tuning) */
export const EXTRACT_RADIUS = 90;

/** Parry — the melee LMB signature (§7/§8). Base effect = i-frames + knockback; the parry *augments*
 *  (§12) are deferred — no telegraphed enemy attacks yet, so for now it's a defensive panic button. (tuning) */
export const PARRY_IFRAMES = 0.45;
export const PARRY_COOLDOWN = 0.6;
export const PARRY_RADIUS = 135;
export const PARRY_KNOCKBACK = 96;
/** §8 parry FLOW (Stage C): a SUCCESSFUL parry of a telegraphed attack refreshes the cooldown to this small
 *  value (vs the full PARRY_COOLDOWN miss-penalty), so you can immediately parry the next swing — that's how
 *  you chain-parry a combo / a flurry from multiple sources. A whiff still eats the full cooldown. */
export const PARRY_CHAIN_CD = 0.12;

/**
 * §8/§20 UNIVERSAL LUNGE — every melee/contact monster (rusher/swarm/zoner) telegraphs then JUMPS at you,
 * so its attack is PARRYABLE (the duelist combo machine, but a derived single-hit lunge). Passive contact
 * damage (`contactDamage`, while touching) is SEPARATE + always applies — the lunge is the discrete,
 * telegraphed, parryable hit on top. Only DoT (zoner puddles) + AoE (boss slam) stay unparryable. The
 * derived lunge is sized off each kind: reach = radius + pad, damage = max(min, contactDamage × mult),
 * windup readable (swarm faster), step forward dash. (tuning)
 */
export const LUNGE_REACH_PAD = 30; // lunge range = enemy radius + this (a touch beyond body contact)
export const LUNGE_DAMAGE_MULT = 1.6; // discrete lunge hit = contactDamage × this …
export const LUNGE_MIN_DAMAGE = 5; // … floored here so even a weak swarm lunge stings
export const LUNGE_WINDUP = 0.46; // telegraph (white-tell ramp) before the jump — time to read + parry
export const LUNGE_WINDUP_SWARM = 0.32; // swarm lunges faster so the cloud still feels frantic
export const LUNGE_RECOVER = 0.6; // post-jump vulnerable window before it can wind up again
export const LUNGE_RECOVER_SWARM = 0.42;
export const LUNGE_STEP_FRAC = 0.34; // forward dash distance = enemy speed × this (min 48px)

/** §8/§20 parry-LAUNCH (Stage D) — a successful parry of an attack lofts the PARRIER: it adds an upward kick
 *  to the height-axis velocity (`vh`, §5 Stage B) + shoves them along the attack vector. Chaining parries
 *  stacks the kicks faster than gravity removes them, so you RIDE the flurry up; stop parrying and gravity
 *  reclaims you. Capped so it can't moon-launch. (all tuning) */
export const PARRY_LAUNCH = 420; // px/s upward kick per parried hit
export const PARRY_LAUNCH_MAX = 640; // px/s cap on the accumulated upward velocity
export const PARRY_PUSH = 130; // px/s horizontal shove along the attack (away from the attacker)

/** §20 MOMENTUM layer (Stage A) — forces (gun recoil, enemy-hit knockback, …) add to a per-player impulse
 *  velocity that displaces the body on top of WASD, then decays back to rest. The authoritative position
 *  is the input-driven base PLUS this shove, so it reads as weight without breaking control. (all tuning) */
/** Exponential friction (per second) decaying an impulse shove to rest — higher = snappier settle. */
export const IMPULSE_FRICTION = 9;
/** Below this speed (px/s) the impulse snaps to 0 (fully settled, no infinite crawl). */
export const IMPULSE_EPSILON = 5;
/** Cap on accumulated impulse speed (px/s) so a gatling stream / pile-up can't fling you across the map. */
export const IMPULSE_MAX = 780;
/** Per-shot gun recoil pushback (px/s), backward along aim, scaled by the gun's authored `recoil`. */
export const GUN_RECOIL_IMPULSE = 190;
/** The recoil baseline `recoil` value the impulse scale is normalised against (the revolver's kick). */
export const GUN_RECOIL_BASELINE = 0.0017;
/** Knockback (px/s) shoved onto a player when an enemy contact-hits or a hostile projectile lands. */
export const HIT_KNOCKBACK_IMPULSE = 300;
