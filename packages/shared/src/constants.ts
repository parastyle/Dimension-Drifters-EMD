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
export const SCHEMA_VERSION = 27 as const; // dual-wield slot-link fields appended

/** §ULT authoritative allocation, meter, action, and five-family tuning (20Hz tick epochs). */
export const ULT_UNLOCK_ALLOCS = 15 as const;
export const ULT_TEMPER_ALLOCS = 30 as const;
export const ULT_CHARGE_MAX = 100 as const;
/** Precise charge is normalized 0..1: 30 applied damage pays one displayed charge point. */
export const ULT_CHARGE_PER_DAMAGE = 0.0003333333333333333 as const;
export const ULT_CHARGE_KILL_BONUS = 0.003 as const;
export const ULT_CHARGE_PARRY_BONUS = 0.04 as const;
export const ULT_CHARGE_TICK_CAP = 0.04 as const;
export const ULT_TEMPER_CHARGE_MULT = 1.1 as const;
export const ULT_BUFFER_SECONDS = 0.2 as const;
export const ULT_RECOVERY_TICKS = 8 as const;

export const ULT_SEISMARCH_RANGE = 380 as const;
export const ULT_SEISMARCH_DEX_RANGE = 520 as const;
export const ULT_SEISMARCH_WINDUP_TICKS = 7 as const;
export const ULT_SEISMARCH_AIR_TICKS = 10 as const;
export const ULT_SEISMARCH_INNER_RADIUS = 160 as const;
export const ULT_SEISMARCH_MID_RADIUS = 300 as const;
export const ULT_SEISMARCH_OUTER_RADIUS = 440 as const;
export const ULT_SEISMARCH_INNER_DAMAGE = 60 as const;
export const ULT_SEISMARCH_MID_DAMAGE = 32 as const;
export const ULT_SEISMARCH_OUTER_DAMAGE = 14 as const;
export const ULT_SEISMARCH_STUN_SECONDS = 1.2 as const;
export const ULT_STUN_ICD_TICKS = 60 as const;
export const ULT_SEISMARCH_FISSURE_SECONDS = 3 as const;
export const ULT_SEISMARCH_FISSURE_DAMAGE = 6 as const;

export const ULT_ALPHA_RADIUS = 600 as const;
export const ULT_ALPHA_MAX_TARGETS = 5 as const;
export const ULT_ALPHA_HIT_TICKS = 2 as const;
export const ULT_ALPHA_DAMAGE = 22 as const;
export const ULT_ALPHA_EXECUTE_FRAC = 0.15 as const;
export const ULT_ALPHA_EXECUTE_MULT = 2.5 as const;
export const ULT_ALPHA_SINGLE_MULT = 1.5 as const;
export const ULT_ALPHA_WINDUP_TICKS = 2 as const;

export const ULT_FIREBALL_WINDUP_TICKS = 8 as const;
export const ULT_FIREBALL_SPEED = 520 as const;
export const ULT_FIREBALL_RANGE = 1100 as const;
export const ULT_FIREBALL_DAMAGE = 48 as const;
export const ULT_NUKE_RADIUS = 260 as const;
export const ULT_NUKE_DAMAGE = 26 as const;

export const ULT_PHASE_WINDUP_TICKS = 2 as const;
export const ULT_PHASE_RANGE = 420 as const;
export const ULT_PHASE_SPEED = 1400 as const;
export const ULT_PHASE_HALFWIDTH = 52 as const;
export const ULT_PHASE_DAMAGE = 36 as const;
export const ULT_PHASE_BRAND_SECONDS = 4 as const;
export const ULT_PHASE_BRAND_MULT = 1.2 as const;

export const ULT_BLINK_RANGE = 1400 as const;
export const ULT_BLINK_WINDUP_TICKS = 2 as const;
export const ULT_BLINK_IFRAMES = 0.5 as const;
export const ULT_BLINK_RECOVERY_TICKS = 8 as const;
export const ULT_DOOR_DECOY_SECONDS = 2.5 as const;
export const ULT_DOOR_RETURN_SECONDS = 4 as const;
export const ULT_DOOR_DECOY_HP = 40 as const;
export const ULT_DOOR_DECOY_RADIUS = 300 as const;
export const ULT_DOOR_DETONATE_RADIUS = 200 as const;
export const ULT_DOOR_DETONATE_DAMAGE = 34 as const;

/** Server simulation tick rate. §4 [LOCKED]: 20Hz (bullets are client-sim'd). */
export const TICK_RATE = 20;
/** Milliseconds per server tick. */
export const TICK_MS = 1000 / TICK_RATE;

/** Flat player move speed in px/sec. §7 [LOCKED]: flat move speed, no sprint layer. (tuning) */
export const MOVE_SPEED = 320;

/**
 * Class-dissolution caster safety lever. INT-forward character spreads are the shipped mitigation; this
 * C-grade-like multiplier floor remains flag-OFF until telemetry proves it necessary. Keep the application
 * pure so the flag can be pinned without mutating shared module state in tests.
 */
export const CAST_GRADE_FLOOR_ENABLED = false as const;
export const CAST_GRADE_FLOOR = 1.4 as const;
export function applyCastGradeFloor(
  multiplier: number,
  enabled: boolean = CAST_GRADE_FLOOR_ENABLED,
): number {
  return enabled ? Math.max(multiplier, CAST_GRADE_FLOOR) : multiplier;
}

/**
 * §7 v0.111 PIVOT movement ("pull the reins"). Superseded the v0.105 continuous velocity-steer (which
 * curved the PATH on every turn = mushy). The heading is now DIRECT — the body faces input instantly
 * (responsive, essential for a dodge game) — and the directional WEIGHT is a discrete, ONE-TIME
 * TURN-HITCH: a SHARP direction change (> MOVE_HITCH_MIN_ANGLE) briefly dips the speed (the "stop"),
 * scaled by how sharp the turn is (a full reversal nearly stops; a 45° nudge barely dips), then speed
 * recovers over MOVE_RECOVER_ACCEL (the "go"). A slow arc keeps each tick's turn angle small → never
 * hitches. The dip fires ONCE because the heading snaps to input each tick (next tick already aligned
 * → no re-dip). All state lives in the (synced) velocity, so client prediction is unchanged. (tuning)
 */
/** Sharp-turn threshold (rad). Below this the turn is smooth/free; above it dips the speed. ~45°. */
export const MOVE_HITCH_MIN_ANGLE = Math.PI / 4;
/** Max fraction the speed dips on the sharpest (180°) turn. v0.117 playtest EASE — 0.72→0.42 so a full
 *  reversal keeps ~58% speed (was ~28%): direction-swap dodging stops feeling like wading through mud while
 *  the pivot still reads as WEIGHT, not a dead stop. A 90° turn now dips only to ~85%. */
export const MOVE_HITCH_DIP = 0.42;
/** Below this speed (px/s) a turn can't hitch — starting from ~rest just accelerates, never "pivots". */
export const MOVE_HITCH_MIN_SPEED = 40;
/** Speed recovery after a hitch / spin-up from rest (px/s²). v0.117 EASE 1800→2600 (~0.12s to top, was
 *  ~0.18s) so the "go" snaps back fast after a swap — responsiveness is king in a dodge game. */
export const MOVE_RECOVER_ACCEL = 2600;
/** Crisp stop when input is released (px/s²) — ~0.12s from top speed to 0, no ice-skating. */
export const MOVE_STOP_DECEL = 2600;

/**
 * PROCEDURAL JIGGLE (client-cosmetic Stage 1). These exports live here only to keep the rollback flag and
 * role tuning in one auditable block; server simulation never reads spring state. Migration deliberately
 * starts near critical and inside the devil's-advocate combat/readability ceilings. Frequencies are angular
 * rad/s, damping values are ratios, displacement is normalized rig-local px, and velocity is local px/s.
 */
export const PROCEDURAL_JIGGLE = true;
export const JIGGLE_HAND_W = 10; // §50 FLOPPY tune (director: "much more bouncier and floppier")
export const JIGGLE_HAND_Z = 0.32;
export const JIGGLE_FOOT_AIR_W = 12;
export const JIGGLE_FOOT_AIR_Z = 0.38;
export const JIGGLE_FOOT_PLANT_W = 34;
export const JIGGLE_FOOT_PLANT_Z = 1;
export const JIGGLE_HAND_MAX_X = 22; // §50 floppy: 0.29 body heights
export const JIGGLE_HAND_MAX_Y = 22;
export const JIGGLE_FOOT_MAX_X = 9; // §50 floppy
export const JIGGLE_FOOT_MAX_Y = 9;
export const JIGGLE_HAND_MAX_V = 420;
export const JIGGLE_FOOT_MAX_V = 240;
export const JIGGLE_FREE_HAND_INERTIA = 0.95;
export const JIGGLE_WEAPON_HAND_INERTIA = 0.7;
export const JIGGLE_FOOT_AIR_INERTIA = 0.45;
export const JIGGLE_FOOT_PLANT_INERTIA = 0.05;
export const JIGGLE_SIGNAL_IMPULSE_HZ = 7;
export const JIGGLE_SELF_FILTER_HZ = 26;
export const JIGGLE_REMOTE_FILTER_HZ = 14;
export const JIGGLE_SIGNAL_DEAD_ZONE = 0.015;
export const JIGGLE_HANDOFF_MAX_V = 120;
export const JIGGLE_HAND_IDLE_X = 0.55;
export const JIGGLE_HAND_IDLE_Y = 0.75;
export const JIGGLE_FOOT_IDLE_X = 0.16;
export const JIGGLE_FOOT_IDLE_Y = 0.22;
export const JIGGLE_TURN_HAND_KICK = 30;
export const JIGGLE_TURN_FOOT_KICK = 4;
export const JIGGLE_LAND_HAND_KICK = 48;
export const JIGGLE_SIZE_FREQ_POWER = -0.35;
export const JIGGLE_SIZE_FREQ_MIN = 0.42;
export const JIGGLE_SIZE_FREQ_MAX = 1.05;
export const JIGGLE_MAX_DT_S = 0.1;
export const JIGGLE_LOD_MARGIN_PX = 240;

/**
 * §7 v0.105 de-clunk — CLIENT render-lerp teleport SNAP thresholds (px). The client smooths each rig
 * toward its authoritative position with a τ≈154ms exponential lerp (great for the ~sub-49px
 * frame-to-frame gap), but when the SERVER teleports an entity — a rift descent (~3000px), a run
 * restart, a pit snap-back — that same lerp turns into a multi-second camera fly-by across the map. If
 * the gap exceeds the threshold it's a teleport, not motion: hard-snap instead of gliding. Set well above
 * any legitimate single-tick move so knockback never false-snaps: players top out at IMPULSE_MAX
 * (780px/s → ~39px/tick) plus a little hit-stop catch-up; enemies get parry-knocked up to
 * PARRY_KNOCKBACK×1.6 (~154px) in one tick, so their floor is higher. (tuning)
 */
export const INTERP_SNAP_PLAYER = 200;
export const INTERP_SNAP_ENEMY = 260;

/**
 * §7 v0.117 CAMERA FOLLOW feel (client-only presentation — never touches sync). Playtest: "the camera
 * follows the character too rigidly." The old `followSelf` hard-centred on the player every frame; now the
 * camera focus EASES toward the player with a frame-rate-independent exponential smoothing, plus a subtle
 * look-AHEAD so you see a touch more of where you're heading (vital in a bullet-dodge game). All tuning.
 */
/** Follow smoothing time-constant (sec): lower = tighter/snappier, higher = floatier. ~0.13s trails just
 *  enough to read as a real camera without feeling laggy or sea-sick. */
export const CAM_FOLLOW_TAU = 0.13;
/** Look-ahead lead (px at full move speed): the focus leads along the move direction. Small on purpose —
 *  enough to open up the approach, not so much it swims. Scales down with speed (0 at a standstill). */
export const CAM_LOOKAHEAD = 74;
/** A focus jump beyond this (px) is a TELEPORT (rift descent, respawn, pit snap-back), not motion — snap
 *  the camera instead of gliding it across the whole map. Set above any legit single-frame move. */
export const CAM_SNAP_DIST = 600;

/**
 * §4 v0.107 ONLINE NETCODE — client prediction + reconciliation + snapshot interpolation. The design was
 * adversarially reviewed pre-implementation (docs/NETCODE_DESIGN.md is the binding amended spec).
 *
 * Protocol: the client sends one sequence-numbered input command per 50ms sim tick ({seq, dx, dy, jump},
 * ~20/s over Colyseus's reliable ordered WebSocket). The server queues them (bounded), consumes toward
 * ONE per fixed sub-step, integrates with ITS OWN fixed dt (input only sets direction — a fast client
 * clock cannot buy speed), and mirrors `ackSeq`/`mvx/mvy/vh`/`teleportSeq` on PlayerState so the owning
 * client can rebase its prediction exactly. Remote entities interpolate between tick-stamped snapshots.
 */
/** Server-side input command queue cap per player. Above it the queue drops to the NEWEST command (the
 *  freshest intent wins; a backlog must never ratchet input latency — review #3). */
export const INPUT_QUEUE_MAX = 8;
/** Per-tick budget of accepted "input" messages per player (≈ 4×20 = 80/s ceiling; a legit client sends
 *  ~20/s). Beyond it messages are IGNORED — a flood can't burn server CPU (review #18). */
export const INPUT_MSGS_PER_TICK = 4;
/** §44 per-tick budget of accepted ACTION messages per player (attack/parry/grab/cycle/… — everything
 *  except "input", which has its own budget above). 8×20 = 160/s is far beyond any human cadence (a held
 *  trigger re-arms ~20/s), but caps the handler CPU a modified client can burn between ticks — the Sol
 *  audit's "only movement input has a message-rate budget" hole. Beyond it messages are IGNORED. */
export const ACTION_MSGS_PER_TICK = 8;
/** Player-beam genre-inversion guardrails. These are runtime laws, not authoring suggestions. */
export const BEAM_MIN_CHARGE_SECONDS = 0.65;
export const BEAM_CHARGE_MOVE_MUL = 0.55;
export const BEAM_CHANNEL_MOVE_MUL = 0.35;
export const BEAM_DEFAULT_WIDTH = 48;
export const BEAM_MAX_WIDTH = 64;
export const BEAM_DEFAULT_RANGE = 520;
export const BEAM_MAX_RANGE = 640;
export const BEAM_MAX_TURN_RATE = (75 * Math.PI) / 180;
export const BEAM_IGNITION_HEAT = 0.25;
export const BEAM_HEAT_PER_SECOND = 0.6;
export const BEAM_MAX_CHANNEL_SECONDS = 1.25;
export const BEAM_RECOVERY_SECONDS = 0.35;
export const BEAM_EARLY_CANCEL_HEAT = 0.2;
export const BEAM_OVERHEAT_LOCK_SECONDS = 1.5;
export const BEAM_COOL_PER_SECOND = 0.35;
export const BEAM_RESTART_HEAT = 0.35;
export const BEAM_CRIT_QUANTUM_SECONDS = 0.25;
export const BEAM_AGGREGATE_TARGET_CAP = 3;
export const BEAM_STALE_INPUT_TICKS = 3;
export const BEAM_MAX_SWEEP_SAMPLES = 16;
export const BEAM_RELEASE_VISUAL_SECONDS = 0.08;
/** Client pending-prediction buffer cap (~3.2s of un-acked commands). Overflow = the connection has
 *  stalled; the predictor flags itself for a hard resync on the next patch (review #13). */
export const PRED_PENDING_MAX = 64;
/** Client render delay (ms) behind the server-tick timeline for REMOTE entities — 2 patch intervals +
 *  jitter margin. Remote players/enemies render this far in the past, interpolated between real
 *  snapshots (PvE: server hit-tests server positions, so this is purely visual). */
export const INTERP_DELAY_MS = 120;
/** Max extrapolation (ms) past the newest snapshot when the buffer starves (a TCP burst-stall) before
 *  the renderer HOLDS — bounded guessing, never runaway. */
export const INTERP_EXTRAP_MAX_MS = 60;
/** Snapshot ring depth per entity (~400ms at 20Hz) — rides a burst arrival without dropping brackets. */
export const SNAPSHOT_DEPTH = 8;
/** Exponential decay rate (per second) of the predictor's visual error offset — a reconciliation
 *  correction GLIDES over ~⅓s tail instead of popping (review #11/#14 fold corrections through this). */
export const PRED_ERR_DECAY = 12;

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
 * stranded behind an uncrossable pit. Derived from the asymmetric hop reach
 * (JUMP_AIRTIME × MOVE_SPEED ≈ 176px ≈ 2.2 tiles); kept conservative so a required hop is always
 * comfortable while the committed distance jump remains an optional route verb.
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

/**
 * §29 v0.118 BELT-SCROLLER floor plane (see docs/BEATEMUP_CONVERSION.md). The 2.5D conversion reinterprets
 * the flat sim: `x` = horizontal along the belt, `y` = DEPTH into a SHALLOW band (not the old open arena).
 * These are the AUTHORITATIVE sim values — the world depth extent + the combat depth-tolerances. The screen
 * PROJECTION (horizon / depthScale) is CLIENT-ONLY and lives in the client's belt-projection module; it must
 * never appear in sim/hit math. Stage 3 clamps `y` to [0, DEPTH_MAX]; Stage 5 uses the tolerances. (tuning)
 */
export const DEPTH_MAX = 1300; // §37 more room to walk in depth (696 → 870 → +50% again); tolerances scale below
/** Depth alignment (world units) an attack tolerates for a hit — GENEROUS for players, TIGHT for enemies
 *  (the classic beat-'em-up fairness lever). A hit needs horizontal reach AND |Δdepth| ≤ this. Kept
 *  proportional to DEPTH_MAX so the deeper band (§37) doesn't make hits feel stingier. */
export const DEPTH_TOL_PLAYER = 90;
export const DEPTH_TOL_ENEMY = 57;
/** SoR4 trick: while a body is actively moving in DEPTH, its hurtbox depth shrinks by this factor, so
 *  repositioning genuinely dodges instead of getting clipped by a fat window. */
export const DEPTH_DODGE_MULT = 0.5;
/** §29 belt DEPTH BAND placement in the arena: belt-mode reuses the SAME flat sim, just confined to a
 *  wide-shallow field. The playable depth band is `y ∈ [BELT_Y0, BELT_Y0 + DEPTH_MAX]`, centred in the
 *  arena so movement-clamp + spawns keep everything in the band. `x` stays the long belt axis (full
 *  ARENA_WIDTH). The client projects `(worldY − BELT_Y0)` as belt depth. Authoritative (both the server and
 *  the client predictor clamp movement to this band in belt mode, so prediction stays in sync). */
export const BELT_Y0 = (ARENA_HEIGHT - DEPTH_MAX) / 2;

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

/**
 * XP ECHOES — authoritative kill rewards. One synced Echo carries an aggregate XP value; its position is
 * static while resting and its launch/arrival epochs describe the client-rendered flight. No per-tick flight
 * coordinates are serialized. All values in this block are game-feel tuning shared by server and client.
 */
export const BASE_XP_MOTE_REACH = 180;
export const XP_MOTE_REACH_MIN = 120;
export const XP_MOTE_REACH_MAX = 600;
/** Reserved first stat hook: each future Mote-Reach stack grows the authoritative radius by 18%. */
export const XP_MOTE_REACH_PER_STACK = 0.18;
/** Hard synchronized-entity ceiling. Overflow always merges value; XP is never discarded. */
export const MAX_XP_ECHOES = 48;
/** Below this count only close, simultaneous deaths merge; above it the field coalesces aggressively. */
export const XP_ECHO_DENSE_AT = 32;
export const XP_ECHO_RECENT_MERGE_RADIUS = 64;
export const XP_ECHO_DENSE_MERGE_RADIUS = 80;
export const XP_ECHO_RECENT_MERGE_MS = 200;
/** Every drop gets a readable pop/settle before Reach may latch it. Higher tiers linger 40ms longer. */
export const XP_ECHO_ARM_MS = 260;
export const XP_ECHO_ARM_TIER_MS = 40;
export const XP_ECHO_ARM_MAX_MS = 380;
/** Distance-sensitive, tick-quantized magnet flight: clamp(0.22 + distance/1500, 0.24, 0.52). */
export const XP_ECHO_FLIGHT_BASE_SECONDS = 0.22;
export const XP_ECHO_FLIGHT_DISTANCE_DIVISOR = 1500;
export const XP_ECHO_FLIGHT_MIN_SECONDS = 0.24;
export const XP_ECHO_FLIGHT_MAX_SECONDS = 0.52;
/** Legacy tick-compatibility lane: a corpse already overlapping the two body radii catches in one tick. */
export const XP_ECHO_POINT_BLANK_REACH = 48;
export const XP_ECHO_POINT_BLANK_FLIGHT_TICKS = 1;
export const XP_ECHO_RETARGET_MIN_SECONDS = 0.16;
export const XP_ECHO_RETARGET_MAX_SECONDS = 0.26;
/** Stream admission keeps a large pile braided and readable instead of arriving as one opaque flash. */
export const XP_ECHO_LAUNCHES_PER_COLLECTOR_TICK = 2;
export const XP_ECHO_LAUNCHES_PER_ROOM_TICK = 3;
export const XP_ECHO_RECEIPTS_PER_COLLECTOR_TICK = 2;
/** Closed-beat cleanup admits faster streams and folds any tail after the 650ms presentation budget. */
export const XP_ECHO_CLEANUP_LAUNCHES_PER_TICK = 6;
export const XP_ECHO_CLEANUP_FLIGHT_MIN_SECONDS = 0.22;
export const XP_ECHO_CLEANUP_FLIGHT_MAX_SECONDS = 0.36;
export const XP_ECHO_CLEANUP_MAX_MS = 650;
/** §29 v0.118 ARSENAL: a fixed 3-slot loadout (the belt "carry 3 weapons, swap instantly") plus a bag for
 *  overflow you haul to a shopkeeper. */
export const ARSENAL_SLOTS = 3;
/** G-01 one responsive, shared draw gate after any held-weapon transition. Kept separate from each
 * weapon's restored cooldown so swapping never erases debt and the gate never overwrites a longer debt. */
export const WEAPON_DRAW_LOCK_SECONDS = 0.15;
/** Dual-wield metronome: after one hand fires, the next beat waits on 72% of the incoming hand's
 * effective cooldown. The lead hand's cooldown affix is the pair's only cadence affix. */
export const PAIR_TEMPO = 0.72;
/** Pair throughput ceilings relative to the lead weapon's honest solo stream. */
export const DUAL_THROUGHPUT_CAP = 1.37;
export const DUAL_MATCHED_THROUGHPUT_CAP = 1.45;
/** Off-hand damage starts honest; a matched family gets a small chase bonus, then the cap trims it. */
export const DUAL_OFFHAND_BASE_MULT = 1;
export const DUAL_MATCHED_OFFHAND_BASE_MULT = 1.1;
/** v18 fixed-size authoritative hit/final-blow receipt ring. Allocated once when the room is created. */
export const COMBAT_RECEIPT_CAP = 32;
export const BAG_CAP = 12;
/** §29 shopkeeper interaction reach (world px) + SCRIP paid per rarity tier when selling an EARNED weapon
 *  (unearned/conjured weapons sell for nothing — same anti-launder rule as salvage). Indexed by rarity. */
export const SHOP_RADIUS = 90;
export const SCRIP_BY_RARITY = [4, 9, 18, 34, 60] as const;
/** §30 v0.118 HARVEST (Brotato parity #3): extracting banks a BONUS on the carried salvage, scaled by the
 *  squad's best LUK — rewarding the luck/greed axis without a new stat. +4%/LUK over 1, capped. */
export const HARVEST_PER_LUK = 0.04;
export const HARVEST_CAP = 0.5;
/** §9/§13 drop & salvage: after a player DROPS a weapon it can't be re-grabbed for this long (sec), so a
 *  drop at your feet doesn't snap straight back. */
export const DROP_GRACE_SECONDS = 0.7;
/** §13 hold-to-salvage: seconds the drop key must be HELD before the held weapon salvages (tap = drop). */
export const SALVAGE_HOLD_SECONDS = 0.6;

/** §5 JUMP (Spacebar) — universal traversal that clears barriers + pitfalls, with no i-frames. Defensive
 *  channels stay distinct: parry answers WHITE and owns every reward; schema-23 slide opening answers
 *  RED-projectile and locked melee with safety only. Neither movement verb inherits the parry reward ladder. */
export const JUMP_AIRTIME = 0.55;
export const JUMP_COOLDOWN = 0.7;
/** Peak visual hop height (px) the client lifts the rig at the top of the arc. */
export const JUMP_HOP_HEIGHT = 47;
/** §7 v0.105 de-clunk — INPUT BUFFER (sec): a SPACE pressed while still airborne / on cooldown is
 *  QUEUED, not dropped, and fires the instant the player is grounded + ready. Sized just over the
 *  post-landing dead window (JUMP_COOLDOWN 0.7s − airtime ~0.55s ≈ 0.15s) so a press a beat early still
 *  hops instead of silently eating the input. */
export const JUMP_BUFFER_SECONDS = 0.25;

/** §5/§20 VERTICAL physics (Stage B) — the jump is now a real upward impulse under gravity, generalising
 *  the old fixed-duration hop into a HEIGHT axis (px above ground) that the §17 pit layer + the later
 *  §8 parry-launch ride on. Tuned so airtime ≈ JUMP_AIRTIME (0.55s) and peak ≈ JUMP_HOP_HEIGHT (47px).
 *  PURE: a shared `stepVertical(height, vh, dt)` integrates it server-side + (future) in client prediction. */
export const GRAVITY_RISE = 1250; // px/s² while vh > +GRAVITY_APEX_BAND
export const GRAVITY_APEX = 900; // px/s² while |vh| <= GRAVITY_APEX_BAND
export const GRAVITY_FALL = 2200; // px/s² while vh < -GRAVITY_APEX_BAND
export const GRAVITY_APEX_BAND = 80; // px/s — the readable float window around the apex
/** Compatibility alias for old analytic callers. New vertical motion must use the three-zone profile. */
export const GRAVITY = GRAVITY_RISE;
export const JUMP_VELOCITY = 335; // px/s upward kick on a grounded jump
/** Height (px) at/below which a player counts as GROUNDED (jump-ready + pit-fall-eligible). */
export const GROUND_EPSILON = 0.5;

/** Jump-feel committed movement stances. Normal airborne phases remain derivable from height/vh. */
export const STANCE_NONE = 0 as const;
export const STANCE_CROUCH = 1 as const;
export const STANCE_DASH = 2 as const;
export const STANCE_POUND = 3 as const;
/** Schema-23 slide-hop reuses the retired roll's stance byte; wire id 4 never changed meaning mid-patch. */
export const STANCE_SLIDE = 4 as const;
export type MoveStance =
  | typeof STANCE_NONE
  | typeof STANCE_CROUCH
  | typeof STANCE_DASH
  | typeof STANCE_POUND
  | typeof STANCE_SLIDE;
/** Normal vertical phases are derived, never stored or serialized as part of the committed stance byte. */
export const VERTICAL_PHASE_GROUNDED = "grounded" as const;
export const VERTICAL_PHASE_RISING = "rising" as const;
export const VERTICAL_PHASE_APEX = "apex" as const;
export const VERTICAL_PHASE_FALLING = "falling" as const;
export type VerticalPhase =
  | typeof VERTICAL_PHASE_GROUNDED
  | typeof VERTICAL_PHASE_RISING
  | typeof VERTICAL_PHASE_APEX
  | typeof VERTICAL_PHASE_FALLING;

/** Space is classified as a hold locally at this threshold; the held bit then rides every input command. */
export const CROUCH_HOLD_MS = 150;
/** Once crouching starts, ten authoritative ticks are committed before the automatic distance launch. */
export const CROUCH_COMMIT_SECONDS = 0.5;
export const DIST_JUMP_SPEED = 620; // px/s horizontal, below the existing impulse/interp envelope
export const DIST_JUMP_VERTICAL_VELOCITY = 380; // px/s; ≈59px apex under the three-zone profile
export const DIST_JUMP_AIRTIME = 0.6;
export const DIST_JUMP_REACH = DIST_JUMP_SPEED * DIST_JUMP_AIRTIME; // 372px, clears a 320px gap
export const DIST_JUMP_STEER_RADIANS_PER_SECOND = Math.PI / 4; // 45°/s
export const DIST_JUMP_MAX_STEER_RADIANS = DIST_JUMP_STEER_RADIANS_PER_SECOND * DIST_JUMP_AIRTIME; // ±27° over the flight
export const DIST_JUMP_COOLDOWN = 2.5;
export const DIST_JUMP_LANDING_SPEED_MULT = 0.6;
/** Even ignoring its cooldown, hold + commit + flight averages below ordinary walking speed. */
export const DIST_JUMP_CYCLE_SECONDS =
  CROUCH_HOLD_MS / 1000 + CROUCH_COMMIT_SECONDS + DIST_JUMP_AIRTIME;
export const DIST_JUMP_CYCLE_SPEED = DIST_JUMP_REACH / DIST_JUMP_CYCLE_SECONDS;

export const POUND_MIN_HEIGHT = 24;
export const POUND_GATHER_SECONDS = 0.1;
export const POUND_SPEED = 1400;
export const POUND_RADIUS = 90;
export const POUND_DAMAGE_BASE = 10;
export const POUND_DAMAGE_PER_HEIGHT = 0.1;
export const POUND_DAMAGE_CAP = 26;
export const POUND_KNOCKBACK_SPEED = 260;
export const POUND_STAGGER_SECONDS = 0.35;
export const POUND_RECOVERY_SECONDS = 0.25;
export const POUND_JUMP_COOLDOWN = 0.9;

/** Schema-23 Megabonk slide-hop. All timing is authored in 20 Hz ticks. The first five consumed-command
 * ticks inherit 21b's contact-only null-whiff budget; it never aliases parry `invuln` or its rewards. */
export const SLIDE_TICK_SECONDS = 0.05 as const;
export const SLIDE_ENTRY_SPEED = 256 as const;
export const SLIDE_SPEED_CAP = 544 as const;
export const SLIDE_GROUND_DECAY = 0.97 as const;
export const SLIDE_GROUND_TICKS = 10 as const;
export const SLIDE_COMMIT_TICKS = 3 as const;
export const SLIDE_GROUND_STEER_RADIANS_PER_SECOND = 1.5707963267948966 as const;
export const SLIDE_HOP_MIN_TICK = 2 as const;
export const SLIDE_HOP_MAX_TICK = 8 as const;
export const SLIDE_HOP_VERTICAL_VELOCITY = 285 as const;
export const SLIDE_HOP_RETENTION = 0.96 as const;
export const SLIDE_AIR_STEER_RADIANS_PER_SECOND = 2.0943951023931953 as const;
export const SLIDE_LANDING_RETENTION = 0.95 as const;
export const SLIDE_LANDING_KICK = 72 as const;
export const SLIDE_PRELAND_BUFFER_TICKS = 2 as const;
export const SLIDE_LAND_WINDOW_TICKS = 3 as const;
export const SLIDE_COLD_REARM_TICKS = 6 as const;
export const SLIDE_IFRAME_TICKS = 5 as const;
export const SLIDE_IFRAME_SECONDS = 0.25 as const;
export const SLIDE_ATTACK_CANCEL_TICKS = 6 as const;
export const SLIDE_ATTACK_CANCEL_SECONDS = 0.3 as const;
export const SLIDE_PARRY_LOCK_TICKS = 10 as const;
export const SLIDE_PARRY_LOCK_SECONDS = 0.5 as const;

/** Wire/replay slide subphases. `slidePhaseTick` is the age of the current slide sentence until landing. */
export const SLIDE_PHASE_OFF = 0 as const;
export const SLIDE_PHASE_GROUND = 1 as const;
export const SLIDE_PHASE_AIR = 2 as const;
export const SLIDE_PHASE_LAND_WINDOW = 3 as const;
export type SlidePhase =
  | typeof SLIDE_PHASE_OFF
  | typeof SLIDE_PHASE_GROUND
  | typeof SLIDE_PHASE_AIR
  | typeof SLIDE_PHASE_LAND_WINDOW;

export const LANDING_TIER_SOFT = 1 as const;
export const LANDING_TIER_SOLID = 2 as const;
export const LANDING_TIER_HEAVY = 3 as const;
export type LandingThumpTier =
  | typeof LANDING_TIER_SOFT
  | typeof LANDING_TIER_SOLID
  | typeof LANDING_TIER_HEAVY;
export const LANDING_SOLID_MIN_SPEED = 300;
export const LANDING_HEAVY_MIN_SPEED = 520;
export const LANDING_HORIZONTAL_WEIGHT = 0.3;

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
export const PROJECTILE_RADIUS = 10; // §20 v0.114 beefed a touch for more reliable hit registration
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
 * §16 v0.116 BOSS RUSH — a chained gauntlet of every bespoke boss back-to-back, no trash horde, difficulty
 * escalating via `depth`. Between rounds the squad heals a chunk (a breather, not a full reset) and gets a
 * short beat before the next boss drops in; clearing the final boss = victory (banks the run). (tuning)
 */
/** Seconds after a boss falls before the next one drops in (the breather + grab-your-drop window). */
export const BOSSRUSH_BREATHER = 3.5;
/** Fraction of max HP the squad heals after clearing each boss (rewards a clean clear, not a wipe-fest). */
export const BOSSRUSH_HEAL_FRAC = 0.5;

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

/** §16 v0.109 DATA-DRIVEN BOSS FRAMEWORK budget rails (feasibility, load-bearing — no AoI yet, so every
 *  projectile is broadcast to every client). The BossController enforces these so no boss def can flood the
 *  10-player wire: a hard ceiling on concurrent HOSTILE projectiles arena-wide (boss + horde + spitters),
 *  and a per-boss cap on live adds regardless of player count (resolveEnemyCollisions is ~O(n²)). Spectacle
 *  comes from cheap TELEGRAPHED zones/beams/dashes, not bullet density. */
export const BOSS_PROJECTILE_BUDGET = 120;
export const BOSS_ADD_CAP = 12;
/** Serraketh's synchronized/body budgets are protocol contracts, not designer-expandable tuning. */
export const WORM_MAX_SEGMENTS = 12;
export const WORM_START_SEGMENTS = 10;
export const WORM_POSE_PUBLISH_TICKS = 2; // 20 Hz authority, 10 Hz moving-center publication
export const WORM_PATH_HISTORY_CAPACITY = 512;
export const WORM_PATH_OVERLAP_FACTOR = 0.86;
export const WORM_BASE_SPEED = 150;
export const WORM_MAX_TURN_RADIANS_PER_SECOND = 0.9;
export const WORM_MISSING_SEGMENT_SPEED_BONUS = 0.04;
export const WORM_MISSING_SEGMENT_SPEED_CAP = 0.28;
export const WORM_RECONNECT_TICKS = 8;
export const WORM_RECONNECT_CATCHUP_PX = 14;
export const WORM_DIVE_TICKS = 13;
export const WORM_UNDERGROUND_MIN_TICKS = 25;
export const WORM_UNDERGROUND_MAX_TICKS = 38;
export const WORM_ERUPTION_CLAIM_TICKS = 18;
export const WORM_ERUPTION_RADIUS = 145;
export const WORM_SURFACE_ARM_GRACE_TICKS = 6;
export const WORM_CONTACT_EPOCH_TICKS = 7; // ceil(350 ms / the fixed 50 ms tick)
export const WORM_SPLIT_TICKS = 160;
export const WORM_SPLIT_PUNISH_TICKS = 24;
export const WORM_REGROW_TICKS = 110;
export const WORM_LOCAL_PROJECTILE_CAP = 16;
export const WORM_TOTAL_XP = 110;
export const WORM_ANATOMY_XP_CAP = 35;
export const WORM_CORE_XP_MIN = 75;
/** §16 v0.109 telegraph danger channels: 0 = parryable (WHITE, §8), 1 = unparryable (RED, dodge). */
export const TELEGRAPH_PARRYABLE = 0;
export const TELEGRAPH_DODGE = 1;
/** §16 v0.110 expanding-ring band HALF-thickness (px). SHARED so the WYSIWYG contract holds: the server
 *  hit test damages ±this around the band radius AND the client draws a stroke of exactly `2×` this — the
 *  visible danger band equals the real hit band. Fixed (not per-boss) so the client needn't sync it. */
export const RING_BAND_HALF = 46;

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
/** §40.2/§44 swing-clock fractions. `swingDescriptorFor` applies these to EFFECTIVE cooldown (base × loot
 *  affix), then every consumer samples that immutable descriptor. Non-spin pose SHAPES remain normalized to
 *  this window; only their time base changes. The CHOP landing stays at the authored 52% pose beat. */
export const SWING_WINDOW_FRAC = 0.64;
export const CHOP_IMPACT_FRAC = 0.52;
/** Legacy non-spin convenience; new swing paths consume `SwingDescriptor.impactSeconds` so spin/style and
 *  effective-cooldown decisions cannot fork. The argument is EFFECTIVE cooldown, never the base stat. */
export function quakeImpactDelaySec(effectiveCooldown: number): number {
  return effectiveCooldown * SWING_WINDOW_FRAC * CHOP_IMPACT_FRAC;
}
/** Chain lightning (§10 on-hit proc): a single hop cannot exceed this even if a weapon over-tunes its
 *  own `chainLightning.range`. Server + client both clamp to it so the predicted bolt path matches the
 *  authoritative chain. (Global safety cap, analogous to QUAKE_REACH.) */
export const CHAIN_MAX_RANGE = 320;
/** Step within this radius of the open extraction portal to complete the run. (tuning) */
export const EXTRACT_RADIUS = 90;

/** Parry — the melee LMB signature (§7/§8). Base effect = i-frames + knockback; the parry *augments*
 *  (§12) are deferred — no telegraphed enemy attacks yet, so for now it's a defensive panic button. (tuning) */
export const PARRY_IFRAMES = 0.52; // §8 v0.114 EASE — a wider window so the parry timing is forgiving
export const PARRY_COOLDOWN = 0.6;
export const PARRY_RADIUS = 135;
export const PARRY_KNOCKBACK = 96;
/** §8 v0.114 PARRY COMBO: consecutive parries within `WINDOW` sec build a chain; each parry heals `HEAL`
 *  (× the chain, capped by `HEAL_MAX_STACKS`), and once the chain reaches `RIPOSTE_AT` every parry fires a
 *  `RIPOSTE_DMG` counter-strike into the parried attacker — parrying a flurry becomes offense, not just
 *  survival. A dropped chain (window lapses) resets to 0. (tuning) */
export const PARRY_CHAIN_WINDOW = 1.4;
export const PARRY_CHAIN_HEAL = 3;
export const PARRY_CHAIN_HEAL_MAX_STACKS = 5;
export const PARRY_CHAIN_RIPOSTE_AT = 3;
export const PARRY_RIPOSTE_DMG = 16;
/** §7 v0.105 de-clunk — INPUT BUFFER windows (sec). The 20Hz tick + client cooldown gating means a press
 *  that lands one tick before the server cooldown clears used to be silently EATEN (a visible swing/brace
 *  that did nothing). Instead a press is QUEUED for this long and fires the instant the cooldown drains —
 *  the "held trigger" and off-grid melee cadences stop dropping hits, and a chain-parry press that beats
 *  the round-trip is honoured. Small so it never fires a stale attack a beat after you let go. */
export const ATTACK_BUFFER_SECONDS = 0.15;
/** Number of authoritative 20Hz ticks for which the most recently accepted player attack counts as HELD.
 *  Acceptance refreshes the epoch; the server clears the synced latch once `tick - attackTick` reaches
 *  this window. Three ticks = 150ms, bridging rapid fire/cast beats without treating request arrival as
 *  proof that an attack actually fired. */
export const ATTACK_HELD_WINDOW = 3;
export const PARRY_BUFFER_SECONDS = 0.2; // §8 v0.114 EASE — a slightly wider buffer so early presses land
/** §8 parry FLOW (Stage C): a SUCCESSFUL parry of a telegraphed attack refreshes the cooldown to this small
 *  value (vs the full PARRY_COOLDOWN miss-penalty), so you can immediately parry the next swing — that's how
 *  you chain-parry a combo / a flurry from multiple sources. A whiff still eats the full cooldown. */
export const PARRY_CHAIN_CD = 0.12;

/** §8 v0.117 PROJECTILE PARRY — a hostile bullet caught inside the parry i-frame window is DEFLECTED, not
 *  merely dodged. Playtest: "projectiles need more UMPH when parrying — I'm not sure I've actually parried
 *  them as they go through me." The old code let a bullet pass silently through the i-frames; now it becomes
 *  a FRIENDLY counter-shot rocketed back at the nearest enemy, so the block reads as a hard *thwack* and
 *  turns defense into offense (the parry's whole fantasy). All server-authoritative + tuning. */
/** §8 v0.117 BASE parry deflect (no augment) — the bullet GLANCES OFF to the side and fades, like a round
 *  pinging off Superman: pure defense, zero enemy damage. The offensive bounce-BACK is gated behind the
 *  `deflector` level-up augment (see below). */
export const DEFLECT_SPEED = 640; // px/s the glanced spark sprays sideways
export const DEFLECT_TTL = 0.4; // sec — it fades out fast (a brief spark, not a live shot)
/** §8 `deflector` augment — parried bullets RICOCHET BACK at the nearest enemy. Reflected-bullet speed
 *  (px/s), a hard fast return so the deflect visibly SNAPS out (the "UMPH"). */
export const PARRY_REFLECT_SPEED = 720;
/** Reflected damage = the incoming projectile's damage × this (a parried shot hurts more than it would have
 *  hurt you — it rewards the read). Floored at PARRY_REFLECT_MIN_DAMAGE so even a weak spit stings. */
export const PARRY_REFLECT_DMG_MULT = 2.2;
export const PARRY_REFLECT_MIN_DAMAGE = 14;
/** Enemies a reflected counter-shot punches through before dying (a satisfying skewer through a line). */
export const PARRY_REFLECT_PIERCE = 2;

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

/**
 * §51 TOUGH-ENEMY COMBO LANGUAGE (enemycombo panel) — the negotiated leap · authored combo grammar ·
 * parry-bait returns · juggles. All timings are authored in whole 50ms TICKS (worm action-tick model)
 * so beats land exactly on the 20Hz grid, and every number below is a LAW from the panel's
 * devil's-advocate guardrail table (G1–G15), not a tuning suggestion.
 */
/** Negotiated-leap OFFER (leapwind) — 0.30s of deep-crouch announcement before liftoff. */
export const COMBO_LEAP_OFFER_TICKS = 6;
/** Negotiated-leap ARC — FIXED 0.35s air time regardless of distance (G1 arc floor: the metronome).
 *  Max leap range 560px over 7 ticks = 80px/tick, inside the G2 ≤90px/tick displacement budget. */
export const COMBO_LEAP_AIR_TICKS = 7;
/** Negotiated-leap SETTLE — 0.25s sacred beat after landing: nothing damages, the player chooses. */
export const COMBO_LEAP_SETTLE_TICKS = 5;
/** Max distance a negotiated leap commits from (vs the legacy assault-leap's 540). */
export const COMBO_LEAP_RANGE = 560;
/** Seconds between negotiated leaps (one leap per combo — the cooldown spans the whole performance). */
export const COMBO_LEAP_COOLDOWN = 4.0;
/** G2: hard px cap on ANY single-tick combo strike-advance position write (no >100px snaps, ever). */
export const COMBO_STEP_MAX = 96;
/** G8: the parried bait holds a visible stagger at the DISPLACED position ≥0.4s before its return. */
export const RETURN_STAGGER_TICKS = 8;
/** The return closes as a bounded-velocity 0.30s dash — ≤300px over 6 ticks = ≤50px/tick (G2-safe). */
export const RETURN_DASH_TICKS = 6;
/** Max px a parry-bait return dash may cover — an Iron-Stance mega-knockback whiffs, never screen-dashes. */
export const RETURN_STEP_MAX = 300;
/** Juggle launcher SETS the victim's vh here (set, not add — deterministic apex ≈85px, airtime ≈0.71s). */
export const JUGGLE_LAUNCH = 480;
/** Explicit channel alias used by authored payload rows; both names are one law, not two tuning knobs. */
export const JUGGLE_LAUNCH_VH = JUGGLE_LAUNCH;
/** Each air-keep RESETS vh here (assignment, never stacking); raised so enemy lofts stay above leaps. */
export const JUGGLE_KEEP = 400;
/** Explicit channel alias used by authored payload rows. */
export const JUGGLE_KEEP_VH = JUGGLE_KEEP;
/** G9: hard cap on air-keep hits per combo — after 2 the string force-recovers regardless of success. */
export const JUGGLE_MAX_HITS = 2;
/** Name clarifies that the launcher is not counted against the two authored air keeps. */
export const JUGGLE_MAX_AIR_HITS = JUGGLE_MAX_HITS;
/** G9: hard cap on launch-to-landing loss of control (sec); past it every follow-up whiffs server-side. */
export const JUGGLE_MAX_CONTROL_SECONDS = 2.0;
/** G9: total combo damage to the committed victim ≤ this fraction of their max HP (launch included). */
export const COMBO_DAMAGE_CAP_FRAC = 0.4;
/** G10: melee/contact mercy (sec) granted on touchdown from an ENEMY-initiated launch (not own jumps). */
export const JUGGLE_LANDING_MERCY = 0.3;
/** G12: ≤4 concurrent combo performances arena-wide — a readability cap as much as a wire one. */
export const COMBO_MAX_ACTIVE = 4;
/** `EnemyState.comboFlags` bits (uint8): the three presentation edges the client cannot infer. */
export const COMBO_FLAG_AIRBORNE = 1; // leap in flight — client renders the ballistic hop + shadow
export const COMBO_FLAG_EMPOWERED = 2; // gold parry-bait return — client tints the windup + double glint
export const COMBO_FLAG_JUGGLE = 4; // juggle string live (launcher hit → string end) — air-keep posture
