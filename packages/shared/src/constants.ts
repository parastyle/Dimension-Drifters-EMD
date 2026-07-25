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
export const SCHEMA_VERSION = 47 as const; // B60 dimension landmark wire removal

/** §ULT stat-free damage/activity meter and action tuning (20Hz tick epochs). */
/** B55 reversible owner ruling: one switch gates grants, charge, input, activation, reveal, and HUD. */
export const ULTIMATES_ENABLED = false as const;
export const ULT_CHARGE_MAX = 100 as const;
/** Precise charge is normalized 0..1: 30 applied damage pays one displayed charge point. */
export const ULT_CHARGE_PER_DAMAGE = 0.0003333333333333333 as const;
export const ULT_CHARGE_KILL_BONUS = 0.003 as const;
export const ULT_CHARGE_PARRY_BONUS = 0.04 as const;
export const ULT_CHARGE_TICK_CAP = 0.04 as const;
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

/**
 * Schema-30 weapon-resource economy. Drive is one player-global authority; Ultimate Charge remains a
 * completely separate earned meter. Costs are expressed in points and quantized down to quarters.
 */
export const DRIVE_CAPACITY = 100 as const;
export const DRIVE_FLOOR_REGEN_PER_SECOND = 20 as const;
export const DRIVE_ENGAGED_BONUS_PER_SECOND = 15 as const;
export const DRIVE_MAX_GENERIC_RECOVERY_MULT = 1.18 as const;
export const DRIVE_PRESSURE_MEMORY_SECONDS = 2 as const;
export const DRIVE_THREAT_RADIUS = 640 as const;
export const DRIVE_COST_QUANTUM = 0.25 as const;
export const DRIVE_LOAD_MAX = 2.5 as const;
export const DRIVE_GUN_BURST_RETENTION = 0.35 as const;
export const DRIVE_THROWN_BURST_RETENTION = 0.45 as const;

/** Ruling #2: the bar is beam heat. These values mechanically translate the retired normalized curve. */
export const DRIVE_BEAM_IGNITION_COST = 25 as const;
export const DRIVE_BEAM_NET_DRAIN_PER_SECOND = 60 as const;
export const DRIVE_BEAM_GROSS_DRAIN_PER_SECOND = 80 as const;
export const DRIVE_BEAM_CANCEL_COST = 20 as const;
export const DRIVE_BEAM_RESTART_THRESHOLD = 68 as const;

/** Flat player move speed in px/sec. §7 [LOCKED]: flat move speed, no sprint layer. (tuning) */
export const MOVE_SPEED = 320;

/**
 * §7 v0.111 PIVOT movement ("pull the reins"). Superseded the v0.105 continuous velocity-steer (which
 * curved the PATH on every turn = mushy). The heading is now DIRECT — the body faces input instantly
 * (responsive, essential for a dodge game) — and the directional WEIGHT is a discrete, ONE-TIME
 * TURN-HITCH: a SHARP direction change (> MOVE_HITCH_MIN_ANGLE) briefly dips the speed (the "stop"),
 * scaled by how sharp the turn is (a full reversal now retains 95.8%; a 45° nudge is free), then speed
 * recovers over MOVE_RECOVER_ACCEL (the "go"). A slow arc keeps each tick's turn angle small → never
 * hitches. The dip fires ONCE because the heading snaps to input each tick (next tick already aligned
 * → no re-dip). All state lives in the (synced) velocity, so client prediction is unchanged. (tuning)
 */
/** Sharp-turn threshold (rad). Below this the turn is smooth/free; above it dips the speed. ~45°. */
export const MOVE_HITCH_MIN_ANGLE = Math.PI / 4;
/** Max fraction the speed dips on the sharpest (180°) turn. Server-tuning wave: 0.42→0.042 cuts the
 *  direction-switch gate's INTENSITY by 90%, so a full reversal retains 95.8% speed. */
export const MOVE_HITCH_DIP = 0.042;
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
/** Legacy B41 parity-test constant. B42 production corrections use the explicit three-band 140ms law. */
export const PRED_ERR_DECAY = 12;
/** B42 client-authoritative movement plausibility envelope. The speed tolerance absorbs float32 wire
 * quantization and one fixed-step mode edge without turning the envelope into a second movement tier. */
export const CLIENT_MOVE_SPEED_TOLERANCE = 24;
/** Position continuity/nav comparisons receive a sub-body tolerance; this is also the silent correction band. */
export const MOVEMENT_CORRECTION_SILENT_PX = 3;
/** Remote and owner medium corrections must finish inside this wall-clock duration, even under held input. */
export const MOVEMENT_CORRECTION_SMOOTH_MAX_MS = 140;
/** Anything at least this far from adopted truth is a lag/teleport cut, never a smoothing journey. */
export const MOVEMENT_CORRECTION_LARGE_PX = INTERP_SNAP_PLAYER;
/** A parry/juggle launch owns the complete conservative airborne window. */
export const SERVER_MOTION_LAUNCH_TICKS = 16;

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
 * MONEY DROPS — authoritative kill rewards. A bounded synced row rests at the death point, then flies to
 * the first eligible player in reach. Collection credits the existing scrip balance; no XP or level state
 * participates in this rail.
 */
export const BASE_MONEY_DROP_REACH = 180;
export const MONEY_DROP_REACH_MIN = 120;
export const MONEY_DROP_REACH_MAX = 600;
export const MAX_MONEY_DROPS = 48;
export const MONEY_DROP_ARM_TICKS = 6;
export const MONEY_DROP_FLIGHT_TICKS = 6;

/** §29 v0.118 ARSENAL: a fixed 3-slot loadout plus a finite bag. */
export const ARSENAL_SLOTS = 3;
/** G-01 one responsive, shared draw gate after any held-weapon transition. Kept separate from each
 * weapon's restored cooldown so swapping never erases debt and the gate never overwrites a longer debt. */
export const WEAPON_DRAW_LOCK_SECONDS = 0.15;
/** v18 fixed-size authoritative hit/final-blow receipt ring. Allocated once when the room is created. */
export const COMBAT_RECEIPT_CAP = 32;
export const BAG_CAP = 12;
/** §9/B20 L3 drop interaction: after a player DROPS a weapon it can't be re-grabbed for this long (sec), so a
 *  drop at your feet doesn't snap straight back. */
export const DROP_GRACE_SECONDS = 0.7;

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
/** Retired crouch/charge wire id. Kept as a tombstone so schema history never changes meaning. */
export const STANCE_CROUCH = 1 as const;
export const STANCE_DASH = 2 as const;
export const STANCE_POUND = 3 as const;
/** Fixed dodge-roll wire id, restored without changing the append-only stance byte. */
export const STANCE_ROLL = 4 as const;
/** Schema-23 compatibility alias. The wire field names remain append-only; gameplay is a roll again. */
export const STANCE_SLIDE = STANCE_ROLL;
export type MoveStance =
  | typeof STANCE_NONE
  | typeof STANCE_CROUCH
  | typeof STANCE_DASH
  | typeof STANCE_POUND
  | typeof STANCE_ROLL;
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

export const DIST_JUMP_SPEED = 620; // px/s horizontal, below the existing impulse/interp envelope
export const DIST_JUMP_VERTICAL_VELOCITY = 380; // px/s; ≈59px apex under the three-zone profile
export const DIST_JUMP_AIRTIME = 0.6;
export const DIST_JUMP_REACH = DIST_JUMP_SPEED * DIST_JUMP_AIRTIME; // 372px, clears a 320px gap
export const DIST_JUMP_STEER_RADIANS_PER_SECOND = Math.PI / 4; // 45°/s
export const DIST_JUMP_MAX_STEER_RADIANS = DIST_JUMP_STEER_RADIANS_PER_SECOND * DIST_JUMP_AIRTIME; // ±27° over the flight
export const DIST_JUMP_COOLDOWN = 2.5;
export const DIST_JUMP_LANDING_SPEED_MULT = 0.6;
/** Space launches immediately; the traversal sentence contains only its authored flight. */
export const DIST_JUMP_CYCLE_SECONDS = DIST_JUMP_AIRTIME;
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

/** V7 fixed dodge roll. Eight exact 20 Hz samples total 188 px in 400 ms. The accepted direction is
 * frozen for the whole sentence; the first five ticks retain the existing contact/projectile/locked-melee
 * opening, while the final three are visible vulnerable recovery. Cooldown starts at sentence end. */
export const ROLL_TICK_SECONDS = 0.05 as const;
export const ROLL_DURATION_TICKS = 8 as const;
export const ROLL_DURATION = ROLL_DURATION_TICKS * ROLL_TICK_SECONDS;
export const ROLL_DISTANCE = 188 as const;
export const ROLL_SPEED_CURVE = [680, 640, 580, 500, 420, 340, 300, 300] as const;
export const ROLL_IFRAME_TICKS = 5 as const;
export const ROLL_IFRAME_SECONDS = ROLL_IFRAME_TICKS * ROLL_TICK_SECONDS;
export const ROLL_ATTACK_CANCEL_TICKS = 6 as const;
export const ROLL_ATTACK_CANCEL_SECONDS = ROLL_ATTACK_CANCEL_TICKS * ROLL_TICK_SECONDS;
export const ROLL_PARRY_LOCK_TICKS = 10 as const;
export const ROLL_PARRY_LOCK_SECONDS = ROLL_PARRY_LOCK_TICKS * ROLL_TICK_SECONDS;
export const ROLL_COOLDOWN = 3 as const;

/** Append-only schema aliases consumed by the shared combat seam and old wire field names. A roll has only
 * OFF/GROUND phases; AIR/LAND_WINDOW remain reserved tombstones and are never authored by V7 movement. */
export const SLIDE_TICK_SECONDS = ROLL_TICK_SECONDS;
export const SLIDE_IFRAME_TICKS = ROLL_IFRAME_TICKS;
export const SLIDE_IFRAME_SECONDS = ROLL_IFRAME_SECONDS;
export const SLIDE_ATTACK_CANCEL_TICKS = ROLL_ATTACK_CANCEL_TICKS;
export const SLIDE_ATTACK_CANCEL_SECONDS = ROLL_ATTACK_CANCEL_SECONDS;
export const SLIDE_PARRY_LOCK_TICKS = ROLL_PARRY_LOCK_TICKS;
export const SLIDE_PARRY_LOCK_SECONDS = ROLL_PARRY_LOCK_SECONDS;
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
 * with run time; a tough enemy scales up, hits harder, tanks more, and pays more money. (tuning)
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
export const TOUGH_MONEY_MULT = 4;
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
 * EXTRACT (settle the run and bank 100% of run money) or the RIFT (descend: depth+1, a new dimension +
 * freshly-seeded map, same squad/levels/weapons/HP/run money — risk it all for a bigger bank).
 * Difficulty scales with DEPTH on top of the clock/player scaling: enemy+boss HP, tough chance, and a
 * faster boss clock. A WIPE loses everything carried ("bank or lose"). All tuning.
 */
/** Extra enemy/boss HP per depth beyond 1 (depth 3 → ×1.5). */
export const DEPTH_HP_PER = 0.25;
/** Extra enemy DAMAGE per depth beyond 1 (contact/melee/projectile/DoT/slam). Without a damage axis the
 *  chain punishes patience, not skill — player EHP grows ~+40% per 10 levels while enemy damage sat flat. */
export const DEPTH_DMG_PER = 0.12;
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
export const LUCK_RARITY_PER = 0.06;
/** §13 "tier affects drop rate AND rarity": the killer's tier applies a flat rarity bonus, so a
 *  TOUGH rolls at +2 and a BOSS at +8 and the guaranteed capstone drop rarely lands Common-plain.
 *  (This also gives depth an organic rarity gradient — tough-share ramps with depth.) */
export const LOOT_TIER_RARITY_TOUGH = 2;
export const LOOT_TIER_RARITY_BOSS = 8;
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
 *  and a per-boss cap on live adds regardless of player count. Enemy separation is grid-batched, but the
 *  add cap remains a wire/AI budget rail. Spectacle comes from cheap TELEGRAPHED zones/beams/dashes, not
 *  bullet density. */
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
export const WORM_TOTAL_MONEY = 110;
export const WORM_ANATOMY_MONEY_CAP = 35;
export const WORM_CORE_MONEY_MIN = 75;
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
 *  `deflector` augment (see below). */
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
export const LUNGE_WINDUP = 0.46; // body-accent wind-up before the universal white-pop commit
export const LUNGE_WINDUP_SWARM = 0.32; // swarm lunges faster so the cloud still feels frantic
export const LUNGE_RECOVER = 0.6; // post-jump vulnerable window before it can wind up again
export const LUNGE_RECOVER_SWARM = 0.42;
export const LUNGE_STEP_FRAC = 0.34; // forward dash distance = enemy speed × this (min 48px)
/** B33 ordinary melee pressure budget. Slots are per target player and server-owned. */
export const MELEE_ATTACK_TOKEN_CAP = 3 as const;
/** B33 one universal white-pop-to-impact clock. At 20 Hz this is exactly four simulation ticks. */
export const ENEMY_MELEE_COMMIT_SECONDS = 0.2 as const;
export const ENEMY_MELEE_COMMIT_TICKS = 4 as const;
/** Every successfully parried committed lunge gives its attacker this minimum punish pause. */
export const PARRY_ENEMY_STAGGER_SECONDS = 0.4 as const;
/** Active weapon attacks retain 75% input speed; weapons never replace player input. */
export const PLAYER_ATTACK_INPUT_SPEED_MULT = 0.75 as const;

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
/**
 * Impulses are registered after the current tick's movement phase. `beginServerMotion` stores an exclusive
 * expiry tick, so the duration needs one registration tick in addition to every future integration whose
 * pre-decay velocity is non-zero. The strict epsilon snap needs floor(log(max/epsilon)/(friction*dt)) + 1
 * integrations; the extra +1 below owns the late-registration tick as well.
 */
export const SERVER_MOTION_IMPULSE_TICKS =
  Math.floor(Math.log(IMPULSE_MAX / IMPULSE_EPSILON) / (IMPULSE_FRICTION * (TICK_MS / 1000))) + 2;
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
