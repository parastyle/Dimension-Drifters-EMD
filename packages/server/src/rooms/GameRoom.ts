import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  BELT_Y0,
  type BeltLevel,
  beltLevelFor,
  beltPitAtX,
  beltSafeX,
  clampBeltFloorY,
  resolveBeltObstacles,
  type ArenaMap,
  ArenaState,
  ArsenalSlot,
  ARSENAL_SLOTS,
  ATTACK_BUFFER_SECONDS,
  AUG_PROJECTILE_DAMAGE,
  AUG_PROJECTILE_PIERCE,
  AUG_PROJECTILE_SPEED,
  AUG_PROJECTILE_SPREAD,
  addImpulse,
  BOSS_DEF_IDS,
  BOSS_SALVAGE_PER_DEPTH,
  BOSSRUSH_BREATHER,
  BOSSRUSH_HEAL_FRAC,
  BAG_CAP,
  BRAND_DAMAGE_MULT,
  BRAND_DURATION,
  BULWARK_SHIELD,
  bladeAngleAt,
  bladeHitsCircle,
  bossDefFor,
  bossSpawnAt,
  CHAIN_MAX_RANGE,
  type ChainCandidate,
  CONFLAG_DELAY,
  characterScale,
  clamp,
  clampQuakeEpicenter,
  coneAngles,
  countAugment,
  DEBUG_SPAWN_MAX,
  DEFAULT_DIMENSION,
  DEFAULT_WEAPON,
  DEPTH_DODGE_MULT,
  DEPTH_MAX,
  DEPTH_TOL_ENEMY,
  DEPTH_TOL_PLAYER,
  DIMENSIONS,
  DROP_CHANCE_TOUGH,
  DROP_CHANCE_TRASH,
  DROP_GRACE_SECONDS,
  DUMMY_HP,
  DUMMY_RADIUS,
  depthDamageScale,
  depthHpScale,
  deriveStats,
  draftAugments,
  EMBERGUARD_BASE_DMG,
  EMBERGUARD_HALF_ARC,
  EMBERGUARD_PER_INT,
  EMBERGUARD_RANGE,
  ENEMY_KINDS,
  ENEMY_RADIUS,
  EnemyState,
  EXTRACT_RADIUS,
  effectiveDamageMult,
  effectiveMelee,
  enemyHpScale,
  FISTS_WEAPON,
  GROUND_EPSILON,
  GUN_RECOIL_BASELINE,
  GUN_RECOIL_IMPULSE,
  generateArena,
  getDimension,
  gunMuzzleReach,
  meleeReach,
  HAIRTRIGGER_MAX,
  HAIRTRIGGER_WINDOW,
  HIT_KNOCKBACK_IMPULSE,
  hasAugment,
  INPUT_MSGS_PER_TICK,
  INPUT_QUEUE_MAX,
  IRON_STANCE_IFRAME_PER,
  IRON_STANCE_KNOCKBACK_PER,
  inMeleeArc,
  isAttr,
  isAugment,
  isPitAtPx,
  JUMP_BUFFER_SECONDS,
  JUMP_COOLDOWN,
  JUMP_VELOCITY,
  LEVELUP_WINDOW_SECONDS,
  LOOT_TIER_LUK_BOSS,
  LOOT_TIER_LUK_TOUGH,
  lootCooldownMult,
  lootDamageMult,
  M0_CLASS_ATTR,
  MAX_ENEMIES,
  MAX_PLAYERS,
  MOVE_SPEED,
  MELEE_BLADE_HALFWIDTH,
  MELEE_SAMPLE_STEP,
  meleeSwingActive,
  nearestGroundPx,
  nearestPoint,
  nextCharacter,
  nextWeapon,
  PARRY_BUFFER_SECONDS,
  PARRY_CHAIN_CD,
  PARRY_CHAIN_HEAL,
  PARRY_CHAIN_HEAL_MAX_STACKS,
  PARRY_CHAIN_RIPOSTE_AT,
  PARRY_CHAIN_WINDOW,
  PARRY_COOLDOWN,
  PARRY_IFRAMES,
  PARRY_KNOCKBACK,
  PARRY_LAUNCH,
  PARRY_LAUNCH_MAX,
  PARRY_PUSH,
  PARRY_RADIUS,
  DEFLECT_SPEED,
  DEFLECT_TTL,
  PARRY_REFLECT_DMG_MULT,
  PARRY_REFLECT_MIN_DAMAGE,
  PARRY_REFLECT_PIERCE,
  PARRY_REFLECT_SPEED,
  PICKUP_RADIUS,
  PIT_FALL_DAMAGE_FRAC,
  PIT_FALL_GRACE,
  PickupState,
  PLAYER_MAX_HP,
  PLAYER_RADIUS,
  PlayerState,
  PROJECTILE_RADIUS,
  PROJECTILE_TTL,
  ProjectileState,
  pickEnemyKind,
  poiAt,
  pointInAnnulusGap,
  pointInOrientedRect,
  poiRadius,
  prevWeapon,
  QUAKE_REACH,
  RARITY_COMMON,
  RESPAWN_CLEAR_RADIUS,
  REVIVE_HP_FRAC,
  RIFT_CHANNEL_SECONDS,
  RIFT_OFFSET,
  randomSeed,
  resolveBodyCollisions,
  resolvePoiCollision,
  rollAffix,
  rollDropWeapon,
  rollRarity,
  SECOND_WIND_BASE,
  SECOND_WIND_PER_CON,
  SHIFTER_FIRST_SECONDS,
  SHIFTER_HP_PER_WAVE,
  SHIFTER_INTERVAL,
  SHIFTER_KIND_IDS,
  SHIFTER_SALVAGE_PER_DEPTH,
  SHIFTER_TIER_SECONDS,
  SHOP_RADIUS,
  SPAWN_RING,
  safeSpawnPos,
  salvageValue,
  scripValue,
  selectChainTargets,
  spawnInterval,
  stepEnemyChase,
  stepEnemyKite,
  stepImpulse,
  stepSteeredMovement,
  stepVertical,
  TelegraphState,
  TICK_MS,
  TOUGH_DAMAGE_MULT,
  TOUGH_HP_MULT,
  TOUGH_XP_MULT,
  toughChance,
  type Vec2,
  validateArena,
  WEAPON_IDS,
  WEAPONS,
  type WeaponDef,
  xpToNextLevel,
  ZONE_DPS,
  ZONE_RADIUS,
  ZONE_TTL,
  ZONER_DROP_INTERVAL,
  ZoneState,
} from "@dd/shared";
import { type Client, Room } from "colyseus";
import { BossController, type BossEmitSink } from "./BossController.js";
import { allocate, consumeFlex, levelUpPlayer } from "./progression.js";

/** §4 v0.107 one sequence-numbered input COMMAND from a client (~one per 50ms client tick). `jump` rides
 *  the command (not a separate message) so its consume tick is part of the acked timeline (review #5). */
interface InputCmd {
  seq: number;
  dx: number;
  dy: number;
  jump: boolean;
}

/** Per-client input pipeline + the player's PERSISTENT steered movement velocity (§7 course correction).
 *  §4 v0.107: commands queue here (bounded), the tick consumes toward ONE per fixed sub-step and falls
 *  back to `held` when starved (preserving the original held-input semantics); `lastSeq` enforces
 *  monotonicity (drops replays/garbage), `msgBudget` rate-caps the message handler per tick. */
interface InputState {
  queue: InputCmd[];
  held: InputCmd;
  lastSeq: number;
  msgBudget: number;
  mvx: number;
  mvy: number;
}

/** Per-player combat/aux state, kept server-side (not all of it needs to sync). */
interface CombatState {
  aimX: number;
  aimY: number;
  /** Cursor world target (for slam-at-cursor weapons; clamped to QUAKE_REACH server-side). */
  targetX: number;
  targetY: number;
  /** §7 v0.105 de-clunk — remaining ATTACK BUFFER (sec). An "attack" message sets it to
   *  ATTACK_BUFFER_SECONDS; the tick fires the swing the instant the cooldown drains and it's still >0
   *  (a press one tick early is queued, not eaten), then zeroes it. Decays otherwise so a stale press
   *  can't fire a beat after release. */
  attackBuffer: number;
  /** §7 v0.105 de-clunk — remaining PARRY BUFFER (sec). A "parry" that arrives during the parry cooldown
   *  is queued here and fires when the cooldown drains (fixes the chain-parry client/server desync). */
  parryBuffer: number;
  /** §7 v0.105 de-clunk — remaining JUMP BUFFER (sec). A SPACE pressed mid-air / on cooldown is queued and
   *  hops the instant the player is grounded + ready (kills the ~0.25s post-landing dead window). */
  jumpBuffer: number;
  /** Remaining weapon cooldown, sec. */
  cd: number;
  /** Remaining respawn countdown while dead, sec. */
  respawn: number;
  /** Remaining parry i-frames (negate contact damage), sec. */
  invuln: number;
  /** Remaining parry cooldown, sec. */
  parryCd: number;
  /** Thrown-weapon refill cooldown once charges deplete, sec (§10). */
  reloadCd: number;
  /** Last equipped weapon id — detect a swap to (re)initialise charges. */
  lastWeapon: string;
  /** §5 jump cooldown, sec (so the hop isn't spammable). */
  jumpCd: number;
  /** §5/§20 vertical velocity (px/s) for the real height axis — the jump seeds it, gravity decays it. */
  vh: number;
  /** §17 last GROUNDED position (world px) — where a pit-fall snaps the player back to. Updated every
   *  tick the player stands on solid ground. */
  lastGroundX: number;
  lastGroundY: number;
  /** §17 post-fall grace, sec: i-frames + a window where the player won't re-fall (so a pit isn't a death
   *  spiral or a landing-gank). */
  pitGrace: number;
  /** §8 Hair-Trigger augment: consecutive-parry streak (each parry within HAIRTRIGGER_WINDOW adds one). */
  hairStreak: number;
  /** §8 Hair-Trigger: run-elapsed (sec) of the last parry, for the streak window. */
  lastParryAt: number;
  /** §8 v0.114 PARRY COMBO chain (independent of the Hair-Trigger augment): consecutive successful parries
   *  within `PARRY_CHAIN_WINDOW`. Each parry heals a chain-scaled sliver + (at RIPOSTE_AT) ripostes the
   *  attacker. `parryChainT` = seconds left before the chain lapses. */
  parryChain: number;
  parryChainT: number;
  /** §13 salvage PROVENANCE (v0.103 anti-exploit): true only while the held weapon traces back to an
   *  ENEMY DROP. Cycled/conjured/gallery weapons are false — salvaging them pays nothing, so the
   *  cycle→salvage loop can't mint bankable salvage from thin air. */
  heldEarned: boolean;
}

/**
 * Authoritative PvE room (§4 RoR2-style host-authoritative sync via Colyseus).
 *
 * §4 v0.107 ONLINE NETCODE (docs/NETCODE_DESIGN.md): the server runs a FIXED 50ms timestep,
 * consumes one sequence-numbered input command per player per sub-step (validated, bounded,
 * drain-to-newest), integrates with the shared pure steppers, and mirrors ackSeq/mvx/mvy/vh/
 * teleportSeq on state so the owning client PREDICTS its own movement and reconciles exactly.
 * Remote entities interpolate between tick-stamped snapshots (`ArenaState.tick`). The server
 * stays fully authoritative — prediction is display-only; damage/economy never leave the tick.
 */
export class GameRoom extends Room<ArenaState> {
  override maxClients = MAX_PLAYERS;

  private readonly inputs = new Map<string, InputState>();
  private readonly combat = new Map<string, CombatState>();
  /** Per-enemy ranged-attack cooldown, sec (spitters). Keyed by enemy id; pruned with the enemy. */
  private readonly enemyFireCd = new Map<string, number>();
  /** §16 v0.109 the active boss's data-driven controller (replaces the hardcoded OLD RUST phase timers).
   *  Constructed in `spawnBoss` from the boss kind's `BossDef`; nulled on boss death. Runs the phase machine
   *  + telegraph windups deterministically. `null` while no boss is up. */
  private bossController: BossController | null = null;
  /** §16 v0.109 monotonic id source for synced telegraph rows (`tg{n}`). */
  private telegraphSeq = 0;
  /** §16 v0.109 ids of adds the boss summoned — so the add-cap counts only boss adds, not the horde. Pruned
   *  lazily as adds die. */
  private readonly bossAddIds = new Set<string>();
  /** §16 v0.109 the injected boss emit-surface, built lazily (see `bossSink`). */
  private _bossSink: BossEmitSink | null = null;
  /** Server-side projectile metadata not worth syncing. Keyed by projectile id. `explode` (baked at
   *  spawn with this source's scaling) detonates an AoE on the projectile's death (§14 scatter shot). */
  private readonly projectileMeta = new Map<
    string,
    {
      ttl: number;
      damage: number;
      hostile: boolean;
      pierce: number;
      hit: Set<string>;
      explode?: { radius: number; damage: number };
      /** §9 ricochet rounds: wall bounces left before the bullet expires. */
      bounces?: number;
      /** §9 ricochet: original pierce + per-leg lifetime, re-armed each carom so it keeps hunting. */
      pierceMax?: number;
      legTtl?: number;
    }
  >();
  /** Per-zoner puddle-drop cooldown (sec), keyed by enemy id; pruned with the enemy. */
  private readonly zonerDropCd = new Map<string, number>();
  /** Per-zone remaining lifetime (sec), keyed by zone id. */
  private readonly zoneMeta = new Map<string, number>();
  /** §15 duelist (ronin) combo state per enemy id: phase + timer + swings left + the CURRENT windup's
   *  duration (`wind`, for the 0→1 telegraph ramp — `windup` for the first hit, `swingGap` after). Each hit
   *  now telegraphs (no standalone "swing" phase). Pruned with the enemy. */
  private readonly comboState = new Map<
    string,
    {
      phase: "idle" | "leapwind" | "leap" | "windup" | "recover";
      t: number;
      hits: number;
      wind: number;
      // §15 v0.113 LEAP (leaper elites): landing spot, the synced marker id, and the leap cooldown.
      lx?: number;
      ly?: number;
      tg?: string;
      leapCd?: number;
    }
  >();
  /** §15 v0.113 DODGE-ROLL state per ranger id: `cd` = seconds until it can roll again, `t` = seconds left
   *  in the current roll (>0 = rolling), `dx/dy` = the roll direction. Pruned with the enemy. */
  private readonly dodgeState = new Map<
    string,
    { cd: number; t: number; dx: number; dy: number }
  >();
  /** §20 WYSIWYG melee: in-flight swept-blade swings per player id. A swing lives for its `active` window;
   *  `stepMeleeSwings` sweeps the blade across `swingArc` from `aim0` and edge-hits each enemy ONCE (`hit`).
   *  The blade origin is read live from the player each tick, so the cut tracks you as you move. */
  private readonly meleeSwings = new Map<
    string,
    {
      aim0: number;
      range: number;
      swingArc: number;
      halfWidth: number;
      edgeDamage: number;
      elapsed: number;
      active: number;
      hit: Set<string>;
    }
  >();
  /** §9/§13 per-DROPPED-pickup grace timer (sec): while > 0 the pickup can't be re-grabbed, so a weapon
   *  dropped at your feet doesn't snap straight back. Keyed by pickup id; only set for player drops. */
  private readonly pickupGrace = new Map<string, number>();
  /** §13 v0.103 salvage provenance: pickup ids whose weapon came off an ENEMY (earned → salvageable).
   *  Gallery/conjured pickups are never in here. Pruned with the pickup; cleared with the transients. */
  private readonly earnedPickups = new Set<string>();
  /** §8 Conflagration: pending deferred Emberguard re-pulses (the "burning zone" POC). Each fires one more
   *  fire-wave cone once `state.elapsed >= at`. Processed + pruned each tick. */
  private readonly burnPulses: {
    x: number;
    y: number;
    aimX: number;
    aimY: number;
    dmg: number;
    at: number;
  }[] = [];
  /** Spawn-director accumulator + monotonic enemy/projectile/zone/pickup id counters. */
  private spawnAccum = 0;
  private enemySeq = 0;
  private projectileSeq = 0;
  private zoneSeq = 0;
  private pickupSeq = 0;
  /** §17 the procedurally generated arena for this room — minted once at create from the seeds synced on
   *  ArenaState, so the server holds the authoritative tile grid (pit collision/fall handling, §17 Phase 1).
   *  Clients reproduce the identical map from the same seeds. */
  private map!: ArenaMap;
  /** §16 boss/extraction run loop: has OLD RUST spawned this run, and its enemy id. */
  private bossSpawned = false;
  /** §16 v0.116 BOSS RUSH — which boss of the gauntlet is up next (0-based index into `BOSS_DEF_IDS`) and
   *  the countdown until it drops in (>0 = a breather between rounds; ≤0 = idle/nothing queued). */
  private bossRushIndex = 0;
  private bossRushNextTimer = 0;
  /** §6 chain (v0.103): dimensions this run has already visited — rift descents prefer fresh ones. */
  private readonly visitedDims = new Set<string>();
  /** §6 chain (v0.103): the menu-picked dimension the room was created with — a run RESTART returns here
   *  (a wipe deep in the chain shouldn't strand the next expedition in a random dimension). */
  private homeDimension = DEFAULT_DIMENSION;
  /** §29 v0.118 BELT mode — the SAME game, confined to a wide-shallow depth band + flat deck (no pits/POIs),
   *  rendered belt-scroller by the client. Set from the `belt` join option; all combat/enemies/bosses/loot
   *  are unchanged. */
  private belt = false;
  /** §29 the authored belt level (floor-collision profile + obstacles) when in belt mode; null otherwise. */
  private beltLevel: BeltLevel | null = null;
  /** §29 belt ROOM progression: current room index + phase (walk in → lock+fight the wave → clear → advance). */
  private beltRoomIdx = 0;
  private beltPhase: "enter" | "fight" | "cleared" = "enter";
  private bossId: string | null = null;
  /** §17 shifter-incursion director: cd to the next incursion, the active shifter's enemy id + remaining
   *  hunt window (0 = none active), and how many incursions have fired (drives the per-wave HP ramp). */
  private shifterCd = SHIFTER_FIRST_SECONDS;
  private shifterId: string | null = null;
  private shifterTimer = 0;
  private shifterWaves = 0;
  /** Co-op host = the first player to join (reassigned if they leave). Run-wide commands
   *  (restart / toggle-training / spawn-boss) are host-only so one client can't wipe the shared run. */
  private hostId: string | null = null;
  private isHost(client: Client): boolean {
    return this.hostId === null || client.sessionId === this.hostId;
  }

  override onCreate(options?: { dimensionId?: string; bossRush?: boolean; belt?: boolean }): void {
    this.setState(new ArenaState());
    this.belt = !!options?.belt; // §29 belt-scroller mode (wide-shallow band, authored deck + collision)
    this.beltLevel = this.belt ? beltLevelFor("sky-carrier") : null;
    this.state.beltShopX = this.beltLevel?.shopX ?? 0; // §29 sync the shopkeeper's world-x (0 = no vendor)

    // §17 the run's DIMENSION — picked at the menu and passed as a join option. `getDimension` resolves an
    // unknown/missing id back to Wild West, so a stale client can't desync the roster/boss/palette. The id
    // syncs on ArenaState so the client reproduces the matching palette + asset set.
    this.state.dimensionId = getDimension(options?.dimensionId).id;
    this.homeDimension = this.state.dimensionId; // restarts return HERE, not wherever the chain died

    // §16 v0.116 BOSS RUSH — a chained gauntlet of every bespoke boss. Set the mode + arm the first boss with
    // a short lead so joiners finish loading before it drops. No horde, no boss clock — the tick's bossrush
    // branch just counts down the breather between rounds.
    if (options?.bossRush) {
      this.state.mode = "bossrush";
      this.bossRushIndex = 0;
      this.bossRushNextTimer = BOSSRUSH_BREATHER;
    }

    // §17 mint the procedural arena. The four seeds are synced on ArenaState so every client feeds them
    // to the same shared `generateArena` and reproduces a byte-identical map — no tile streaming. Re-run
    // on every §6 rift descent + run restart (v0.103): fresh seeds → the client rebuilds its floor.
    this.mintMap();

    // §4 v0.107 sequence-numbered input COMMANDS (~one per client 50ms tick). Trust nothing off the wire:
    // every field is coerced (a non-number `seq` assigned raw into the uint32 `ackSeq` would THROW inside
    // the schema setter and, uncaught, kill the process — review #4), seq is forced MONOTONIC (drops
    // replays/regressions and keeps ackSeq meaningful), and a per-tick message budget caps handler CPU
    // against floods (review #18). The steered movement step still clamps magnitude + speed + bounds, so
    // none of this trusts direction values either. Legacy seq-less messages (the test harness) get a
    // synthetic next-seq so held-input semantics keep working.
    this.onMessage(
      "input",
      (client, message: { seq?: number; dx?: number; dy?: number; jump?: boolean }) => {
        const rec = this.inputs.get(client.sessionId);
        if (!rec) return;
        if (rec.msgBudget <= 0) return; // over the per-tick budget — ignore (flood guard)
        rec.msgBudget--;
        const seq = Number.isFinite(message?.seq) ? (message?.seq as number) >>> 0 : 0;
        // Monotonic AND bounded, WRAP-AWARE: the uint32 forward delta must be 1..10000. This drops
        // replays/regressions (delta 0 or huge), drops hostile negatives (coerce to ~4.29e9 → huge
        // delta) so they can't poison lastSeq, drops seq-less messages (coerce 0 → delta 0 once any
        // command landed... and a fresh join expects seq ≥ 1), and survives the uint32 wrap (delta
        // arithmetic in >>>0 space: 0xFFFFFFFF → 0 is delta 1). A real client increments by 1 per 50ms
        // over reliable ordered transport; a jump beyond +10000 (~8 min of commands) is a payload.
        const delta = (seq - rec.lastSeq) >>> 0;
        if (delta === 0 || delta > 10000) return;
        rec.lastSeq = seq;
        rec.queue.push({
          seq,
          dx: Number.isFinite(message?.dx) ? (message?.dx as number) : 0,
          dy: Number.isFinite(message?.dy) ? (message?.dy as number) : 0,
          jump: message?.jump === true,
        });
        // Bounded queue: shed the OLDEST beyond the cap (the freshest intent must survive).
        while (rec.queue.length > INPUT_QUEUE_MAX) rec.queue.shift();
      },
    );

    // RMB fires the equipped weapon (§9). Tick gates it by cooldown + resolves the arc/quake
    // authoritatively — the client only requests + sends its aim.
    this.onMessage(
      "attack",
      (client, message: { aimX?: number; aimY?: number; tx?: number; ty?: number }) => {
        const c = this.combat.get(client.sessionId);
        const player = this.state.players.get(client.sessionId);
        if (!c) return;
        // §7 v0.105 de-clunk: QUEUE the attack rather than latch a boolean — the tick fires it the instant
        // the cooldown drains, so a press that lands a tick early (off-grid melee cadences, held trigger)
        // is honoured instead of silently eaten.
        c.attackBuffer = ATTACK_BUFFER_SECONDS;
        c.aimX = Number.isFinite(message?.aimX) ? (message.aimX as number) : c.aimX;
        c.aimY = Number.isFinite(message?.aimY) ? (message.aimY as number) : c.aimY;
        // Trust nothing off the wire: NORMALIZE aim to a unit vector. It feeds the melee-arc direction
        // and the thrown-projectile velocity directly, so a non-unit (or zero) aim would warp reach/speed.
        const aimLen = Math.hypot(c.aimX, c.aimY);
        if (aimLen > 1e-4) {
          c.aimX /= aimLen;
          c.aimY /= aimLen;
        } else {
          c.aimX = 1;
          c.aimY = 0;
        }
        // §9 sync the aim angle so other clients can point this player's held gun + bullets at their cursor.
        if (player) player.aimDir = Math.atan2(c.aimY, c.aimX);
        // Cursor world target (defaults to just ahead of the player along aim).
        c.targetX = Number.isFinite(message?.tx)
          ? (message.tx as number)
          : (player?.x ?? 0) + c.aimX;
        c.targetY = Number.isFinite(message?.ty)
          ? (message.ty as number)
          : (player?.y ?? 0) + c.aimY;
      },
    );

    // LMB = the melee Parry signature (§7/§8). Base effect: brief i-frames + knockback; ALL offense comes
    // from the §8 augment pool (applied below). (No telegraphed enemy attacks yet, so it's a defensive
    // button + augment offense; the white-tell parry-this-attack layer comes later.)
    this.onMessage("parry", (client) => {
      const player = this.state.players.get(client.sessionId);
      const c = this.combat.get(client.sessionId);
      if (!player?.alive || !c) return;
      // §7 v0.105 de-clunk: if the parry is still on cooldown, QUEUE it (the tick fires it the moment the
      // cd drains) instead of silently dropping — this closes the chain-parry desync where the client's
      // local cooldown clears ~a round-trip after the server's, so a valid chain press was being eaten.
      if (c.parryCd > 0) {
        c.parryBuffer = PARRY_BUFFER_SECONDS;
        return;
      }
      this.executeParry(player, c);
    });

    // Cycle through the roster (§9 arsenal). Q = forward, E = back (dir < 0). A cycled weapon is
    // CONJURED, not earned — it carries no salvage value (v0.103 provenance, see `heldEarned`).
    this.onMessage("cycleWeapon", (client, message: { dir?: number }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      player.weapon =
        (message?.dir ?? 1) < 0 ? prevWeapon(player.weapon) : nextWeapon(player.weapon);
      player.weaponRarity = RARITY_COMMON; // conjured = plain Common (loot identity lives on DROPS)
      player.weaponAffix = "";
      const c = this.combat.get(client.sessionId);
      if (c) c.heldEarned = false;
    });

    // §29 v0.118 ARSENAL swap: switch which of the 3 slots is in hand (1/2/3 keys). Stows the current held
    // weapon back into its slot first, so the two off-hand weapons are remembered exactly.
    this.onMessage("swapSlot", (client, message: { slot?: number }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player?.alive) return;
      const i = Math.floor(message?.slot ?? -1);
      if (i < 0 || i >= ARSENAL_SLOTS || i === player.activeSlot) return;
      const c = this.combat.get(client.sessionId);
      this.syncActiveSlot(player, c);
      this.loadSlot(player, c, i);
    });

    // §29 ARSENAL cycle: Q/E through the NON-EMPTY slots (dir < 0 = back). No-op if nothing else is filled.
    this.onMessage("cycleSlot", (client, message: { dir?: number }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player?.alive) return;
      const c = this.combat.get(client.sessionId);
      this.syncActiveSlot(player, c);
      const dir = (message?.dir ?? 1) < 0 ? -1 : 1;
      for (let step = 1; step < ARSENAL_SLOTS; step++) {
        const i = (((player.activeSlot + dir * step) % ARSENAL_SLOTS) + ARSENAL_SLOTS) % ARSENAL_SLOTS;
        if (player.slots[i]?.weapon) {
          this.loadSlot(player, c, i);
          return;
        }
      }
    });

    // §29 ARSENAL bag STASH: move a slot's weapon into the bag (frees the slot; the active slot empties to
    // fists). No-op if the slot is empty or the bag is full.
    this.onMessage("bagStore", (client, message: { slot?: number }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player?.alive) return;
      const i = Math.floor(message?.slot ?? -1);
      if (i < 0 || i >= ARSENAL_SLOTS) return;
      const c = this.combat.get(client.sessionId);
      if (i === player.activeSlot) this.syncActiveSlot(player, c); // capture the live held weapon first
      const s = player.slots[i]!;
      if (!s.weapon || player.bag.length >= BAG_CAP) return;
      const b = new ArsenalSlot();
      this.copySlot(b, s);
      player.bag.push(b);
      this.copySlot(s, null);
      if (i === player.activeSlot) this.loadSlot(player, c, i); // now empty → fists in hand
    });

    // §29 ARSENAL bag EQUIP: pull bag[index] into slot[slot], swapping whatever was there back into the bag
    // (or consuming the bag entry when the slot was empty). Re-mirrors the held weapon if the slot is active.
    this.onMessage("bagEquip", (client, message: { index?: number; slot?: number }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player?.alive) return;
      const bi = Math.floor(message?.index ?? -1);
      const si = Math.floor(message?.slot ?? player.activeSlot);
      if (bi < 0 || bi >= player.bag.length || si < 0 || si >= ARSENAL_SLOTS) return;
      const c = this.combat.get(client.sessionId);
      if (si === player.activeSlot) this.syncActiveSlot(player, c);
      const bagItem = player.bag[bi]!;
      const slot = player.slots[si]!;
      const hadWeapon = !!slot.weapon;
      const stash = new ArsenalSlot();
      this.copySlot(stash, slot); // remember the slot's old content
      this.copySlot(slot, bagItem); // bag item → slot
      if (hadWeapon) {
        this.copySlot(bagItem, stash); // old slot weapon → the bag position (a true swap)
      } else {
        player.bag.splice(bi, 1); // slot was empty → the bag entry is consumed
      }
      if (si === player.activeSlot) this.loadSlot(player, c, si);
    });

    // §29 ARSENAL SELL: trade a bag or slot weapon to the shopkeeper for SCRIP. Gated on proximity to the
    // vendor (beltShopX) + alive; only EARNED weapons pay (anti-launder). Selling the active slot empties the
    // hand to fists.
    this.onMessage("sellWeapon", (client, message: { from?: "bag" | "slot"; index?: number }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player?.alive || !this.belt) return;
      const shopX = this.state.beltShopX;
      if (shopX <= 0 || Math.abs(player.x - shopX) > SHOP_RADIUS) return; // not at the vendor
      const idx = Math.floor(message?.index ?? -1);
      const c = this.combat.get(client.sessionId);
      if (message?.from === "slot") {
        if (idx < 0 || idx >= ARSENAL_SLOTS) return;
        if (idx === player.activeSlot) this.syncActiveSlot(player, c);
        const s = player.slots[idx]!;
        if (!s.weapon) return;
        player.scrip = Math.min(65535, player.scrip + scripValue(s.rarity, s.earned));
        this.copySlot(s, null);
        if (idx === player.activeSlot) this.loadSlot(player, c, idx);
      } else {
        if (idx < 0 || idx >= player.bag.length) return;
        const b = player.bag[idx]!;
        player.scrip = Math.min(65535, player.scrip + scripValue(b.rarity, b.earned));
        player.bag.splice(idx, 1);
      }
    });

    // §7 swap the player's CHARACTER skin (C key). Cosmetic + per-player (not host-gated).
    this.onMessage("cycleCharacter", (client) => {
      const player = this.state.players.get(client.sessionId);
      if (player) player.character = nextCharacter(player.character);
    });

    // §9/§13 R-TAP = DROP the held weapon on the floor (grabbable) in front of you; you fall back to
    // FISTS (§9). The drop gets a brief grace so it doesn't snap straight back to you (DROP_GRACE_SECONDS).
    // Provenance (v0.103): the dropped pickup INHERITS the held weapon's earned flag, so an earned drop
    // stays salvageable after a re-grab but a conjured one can never launder into salvage value.
    this.onMessage("dropWeapon", (client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player?.alive) return;
      this.dropHeldWeapon(player, this.combat.get(client.sessionId));
    });

    // §13 R-HOLD = SALVAGE the held weapon (consumed, no pickup) → fall back to FISTS. §6 v0.103: salvage
    // is now the BANKABLE run currency, so it only pays for weapons that trace back to an ENEMY DROP
    // (`heldEarned` provenance) — an unearned weapon still salvages away (QoL) but is worth nothing.
    this.onMessage("salvageWeapon", (client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player?.alive || player.weapon === FISTS_WEAPON) return;
      const c = this.combat.get(client.sessionId);
      if (c?.heldEarned) {
        player.salvaged += salvageValue(player.weaponRarity); // §13 v0.104: rarity drives the parts value
        c.heldEarned = false;
      }
      player.weapon = FISTS_WEAPON;
      player.weaponRarity = RARITY_COMMON;
      player.weaponAffix = "";
    });

    // §13 R-TAP near a ground weapon = GRAB it (the client only sends this when a pickup is in reach).
    // Equips the nearest pickup; player drops (`drop*`) are consumed on grab, the Testing-Grounds gallery
    // (`pk*`) persists so you can keep swapping.
    this.onMessage("grabWeapon", (client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player?.alive) return;
      let best: PickupState | null = null;
      let bestD = PICKUP_RADIUS * PICKUP_RADIUS;
      this.state.pickups.forEach((pk, pid) => {
        if ((this.pickupGrace.get(pid) ?? 0) > 0) return;
        const d = (pk.x - player.x) ** 2 + (pk.y - player.y) ** 2;
        if (d <= bestD) {
          bestD = d;
          best = pk;
        }
      });
      if (!best) return;
      const grabbed = best as PickupState;
      const c = this.combat.get(client.sessionId);
      if (this.belt) {
        // §29 belt: grabs ACCUMULATE into the 3-slot arsenal (the carousel is gone) — fill an empty slot,
        // overflow to the bag, only drop when everything is full.
        this.grabIntoArsenal(player, c, grabbed);
      } else {
        // §13 v0.106 (A11 de-clunk): grabbing is a SWAP, not a replace. If we're already holding a weapon,
        // DROP it on the floor first (as a grabbable pickup carrying its loot identity + earned provenance +
        // a re-grab grace) — otherwise grabbing a Common off the ground while holding a Legendary silently
        // DESTROYED the Legendary. No-op on fists (empty hands = a plain pickup, nothing to drop).
        this.dropHeldWeapon(player, c);
        player.weapon = grabbed.weapon;
        // §10 v0.104 the grab is the mystery REVEAL: the drop's rolled rarity + affix become the held
        // weapon's loot identity (the server multiplies damage/cooldown from these synced fields).
        player.weaponRarity = grabbed.rarity;
        player.weaponAffix = grabbed.affix;
        // Provenance rides the grab: an enemy-dropped weapon is EARNED (salvageable), the Testing-Grounds
        // gallery + conjured drops are not.
        if (c) c.heldEarned = this.earnedPickups.has(grabbed.id);
      }
      if (grabbed.id.startsWith("drop")) {
        this.state.pickups.delete(grabbed.id);
        this.pickupGrace.delete(grabbed.id);
        this.earnedPickups.delete(grabbed.id);
      }
    });

    // §5 JUMP (Spacebar) — a low all-class traversal HOP, then a cooldown so it isn't spammable. PURE
    // movement, NOT a dodge (no i-frames — the parry stays the defensive tool). The §17 pitfall layer reads
    // `airborne` to let a hopping player clear a gap.
    this.onMessage("jump", (client) => {
      const c = this.combat.get(client.sessionId);
      if (!c) return;
      // §7 v0.105 de-clunk: QUEUE the hop — the tick fires it the instant the player is grounded + off
      // cooldown, so a SPACE pressed a beat early (during the ~0.25s post-landing dead window) still hops
      // instead of vanishing. (`alive` / level-window / grounded / cooldown are all re-checked on consume.)
      c.jumpBuffer = JUMP_BUFFER_SECONDS;
    });

    // Toggle the Testing Grounds (§21): stop spawns, swap the swarm for dummies + weapon pickups.
    // Run-wide → host-only (a non-host can't yank everyone into/out of training).
    this.onMessage("toggleTraining", (client) => {
      if (this.isHost(client)) this.toggleTraining();
    });

    // Restart the run (playtest QoL): wipe the horde, reset the clock, revive everyone fresh.
    // Host-only — co-op shares one run, so one client must not be able to reset everyone's progress.
    this.onMessage("restart", (client) => {
      if (this.isHost(client)) this.restartRun();
    });

    // Debug/playtest: summon the boss now instead of waiting for the timed spawn (B key). Host-only.
    this.onMessage("spawnBoss", (client) => {
      if (this.isHost(client) && this.state.mode === "arena" && !this.bossSpawned) this.spawnBoss();
    });

    // §16 v0.109 Debug BOSS PICKER: spawn a SPECIFIC boss def by kind to playtest its style (works in arena
    // OR training; re-spawns/swaps a live boss). Host-only + kind validated (must be a real boss body).
    this.onMessage("spawnBossDef", (client, message: { kind?: string }) => {
      if (!this.isHost(client)) return;
      const kindId = message?.kind;
      if (typeof kindId !== "string" || ENEMY_KINDS[kindId]?.archetype !== "boss") return;
      this.spawnBoss(kindId);
    });

    // §21 Dev summon (Tab menu): spawn N of a chosen enemy kind on a ring around the requester, optionally
    // TOUGH. Training-mode ONLY — it's a sandbox affordance (so any client may summon; both players test),
    // and gating to training keeps it out of a live survival run. All fields validated (untrusted client).
    this.onMessage(
      "debugSpawn",
      (client, message: { kind?: string; count?: number; tough?: boolean }) => {
        if (this.state.mode !== "training") return;
        const player = this.state.players.get(client.sessionId);
        if (!player) return;
        const kindId = message?.kind;
        if (typeof kindId !== "string" || !ENEMY_KINDS[kindId] || kindId === "dummy") return;
        const count = clamp(Math.floor(message?.count ?? 1), 1, DEBUG_SPAWN_MAX);
        const tough = message?.tough === true;
        for (let i = 0; i < count; i++) this.debugSpawnOne(kindId, tough, player);
      },
    );

    // §12 level-up window: the player spends their FLEX point on an attribute.
    this.onMessage("chooseAttribute", (client, message: { attr?: string }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || player.flexPending <= 0) return;
      const attr = message?.attr;
      if (!isAttr(attr)) return; // validate the untrusted field, then it narrows to Attr
      allocate(player, attr, 1);
      consumeFlex(player);
    });

    // §8 signature pick: the player chooses one augment from the offered 3-of-9 draft.
    this.onMessage("chooseAugment", (client, message: { id?: string }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || player.sigPending <= 0) return;
      const id = message?.id;
      if (!isAugment(id)) return; // valid augment id…
      if (!player.sigOffer.split(",").includes(id)) return; // …AND one actually offered this pick
      player.augments = player.augments ? `${player.augments},${id}` : id;
      player.sigPending = Math.max(0, player.sigPending - 1);
      player.sigOffer = ""; // re-rolled next tick by tickLevelWindows if more picks remain
      // Keep the window open + timer alive if anything's still owed (flex or another sig pick).
      player.flexTimer =
        player.flexPending > 0 || player.sigPending > 0 ? LEVELUP_WINDOW_SECONDS : 0;
    });

    this.setSimulationInterval((deltaMs) => this.update(deltaMs), TICK_MS);
    // §7 v0.105 de-clunk: DISABLE the independent patch timer and broadcast at the END of each tick
    // instead (`this.broadcastPatch()` in `update`). Colyseus's default patch interval is a SECOND 50ms
    // timer whose phase drifts against the sim, so a fresh tick's results could wait up to a full extra
    // 50ms before being sent (the "sometimes snappy, sometimes laggy" +0–50ms). Tick-locking removes it.
    this.setPatchRate(0);
  }

  /** Reset every NON-synced per-entity collection at a run boundary (restart / training toggle) so no
   *  in-flight swing, combo, fire-cooldown, zone, pickup-grace, or burn-pulse ghost-carries into the fresh
   *  run. ONE place → adding a new transient Map forces touching this. (`inputs`/`combat` are player-
   *  lifecycle, not run transients, so they're left alone.) */
  private clearTransients(): void {
    this.projectileMeta.clear();
    this.enemyFireCd.clear();
    this.zonerDropCd.clear();
    this.zoneMeta.clear();
    this.comboState.clear();
    this.dodgeState.clear(); // §15 v0.113
    this.meleeSwings.clear();
    this.pickupGrace.clear();
    this.earnedPickups.clear();
    this.burnPulses.length = 0;
    this.state.telegraphs.clear(); // §16/§15 clear any orphan leap/boss markers on a reset
  }

  /** §13 v0.106 (A11) spawn the player's currently-held weapon on the floor as a grabbable pickup in front
   *  of them, inheriting its rolled loot identity + earned provenance + a brief re-grab GRACE, then reset the
   *  hands to FISTS. No-op on fists (nothing to drop). Shared by the R-tap DROP and the grab-while-holding
   *  SWAP, so a grab can never silently DESTROY a held (possibly Legendary) weapon. */
  private dropHeldWeapon(player: PlayerState, c: CombatState | undefined): void {
    if (player.weapon === FISTS_WEAPON) return;
    const ax = c?.aimX ?? 1;
    const ay = c?.aimY ?? 0;
    const pk = new PickupState();
    pk.id = `drop${this.pickupSeq++}`;
    pk.weapon = player.weapon;
    // The player KNOWS what they dropped — identity + its rolled loot identity ride the pickup.
    pk.rarity = player.weaponRarity;
    pk.affix = player.weaponAffix;
    const dropX = clamp(player.x + ax * PICKUP_RADIUS * 1.6, PICKUP_RADIUS, ARENA_WIDTH - PICKUP_RADIUS);
    const dropY = clamp(player.y + ay * PICKUP_RADIUS * 1.6, PICKUP_RADIUS, ARENA_HEIGHT - PICKUP_RADIUS);
    const sp = this.placePickupPos(dropX, dropY); // §29 belt: keep the drop on the deck (band + off pits)
    pk.x = sp.x;
    pk.y = sp.y;
    this.state.pickups.set(pk.id, pk);
    this.pickupGrace.set(pk.id, DROP_GRACE_SECONDS);
    if (c?.heldEarned) this.earnedPickups.add(pk.id);
    if (c) c.heldEarned = false;
    player.weapon = FISTS_WEAPON;
    player.weaponRarity = RARITY_COMMON;
    player.weaponAffix = "";
  }

  // ── §29 v0.118 ARSENAL helpers: the held weapon is the ACTIVE slot's live mirror; these keep the slots
  // array in sync and move weapons between hand / slots / bag. ──
  /** Copy one stored weapon into another (or clear `dst` when `src` is null). */
  private copySlot(dst: ArsenalSlot, src: ArsenalSlot | null): void {
    dst.weapon = src?.weapon ?? "";
    dst.rarity = src?.rarity ?? 0;
    dst.affix = src?.affix ?? "";
    dst.earned = src?.earned ?? false;
  }

  /** Write the live held weapon (+ loot identity + earned provenance) INTO the active slot, so the slots
   *  array reflects reality before a swap/grab/stash reads it. FISTS → an empty slot. */
  private syncActiveSlot(player: PlayerState, c: CombatState | undefined): void {
    const s = player.slots[player.activeSlot];
    if (!s) return;
    if (!player.weapon || player.weapon === FISTS_WEAPON) {
      this.copySlot(s, null);
    } else {
      s.weapon = player.weapon;
      s.rarity = player.weaponRarity;
      s.affix = player.weaponAffix;
      s.earned = !!c?.heldEarned;
    }
  }

  /** Load slot `i` into the player's hands (sets it active + mirrors held weapon/loot/provenance). An empty
   *  slot loads FISTS. */
  private loadSlot(player: PlayerState, c: CombatState | undefined, i: number): void {
    player.activeSlot = i;
    const s = player.slots[i];
    if (!s || !s.weapon) {
      player.weapon = FISTS_WEAPON;
      player.weaponRarity = RARITY_COMMON;
      player.weaponAffix = "";
      if (c) c.heldEarned = false;
      return;
    }
    player.weapon = s.weapon;
    player.weaponRarity = s.rarity;
    player.weaponAffix = s.affix;
    if (c) c.heldEarned = s.earned;
  }

  /** §29 BELT grab: ADD the grabbed weapon to the arsenal instead of the arena swap-drop. Fills the first
   *  empty slot (and equips it); if all 3 are full, the current active weapon overflows to the bag (or drops
   *  to the floor when the bag is full too — still never destroyed) and the grab takes the active slot. */
  private grabIntoArsenal(player: PlayerState, c: CombatState | undefined, grabbed: PickupState): void {
    this.syncActiveSlot(player, c);
    const earned = this.earnedPickups.has(grabbed.id);
    let target = -1;
    for (let i = 0; i < ARSENAL_SLOTS; i++) {
      if (!player.slots[i]?.weapon) {
        target = i;
        break;
      }
    }
    if (target === -1) {
      const old = player.slots[player.activeSlot]!;
      if (old.weapon && player.bag.length < BAG_CAP) {
        const b = new ArsenalSlot();
        this.copySlot(b, old);
        player.bag.push(b);
      } else if (old.weapon) {
        this.dropHeldWeapon(player, c); // no room anywhere → drop current (still grabbable, not destroyed)
      }
      target = player.activeSlot;
    }
    const s = player.slots[target]!;
    s.weapon = grabbed.weapon;
    s.rarity = grabbed.rarity;
    s.affix = grabbed.affix;
    s.earned = earned;
    this.loadSlot(player, c, target);
  }

  /** §10 v0.104 per-source damage multiplier INCLUDING the held weapon's loot identity: attribute grades ×
   *  §11 requirement penalty × (rarity × affix). Every damage source of the held weapon flows through this
   *  so a Legendary Keen blade hits harder on its edge AND its chain AND its quake — WYSIWYG with the card. */
  private heldDamageMult(
    weapon: WeaponDef,
    grades: Parameters<typeof effectiveDamageMult>[1],
    player: PlayerState,
  ): number {
    return (
      effectiveDamageMult(weapon, grades, player) *
      lootDamageMult(player.weaponRarity, player.weaponAffix)
    );
  }

  /** §6 count of LIVING players — what the TRASH horde difficulty scales on, so a mostly-downed squad faces
   *  a beatable horde and rezzes stay achievable (the rez-or-dead death-spiral fix). The boss keeps the
   *  full-squad `players.size` high-water-mark (a capstone shouldn't soften because allies are down). */
  private livingCount(): number {
    let n = 0;
    this.state.players.forEach((p) => {
      if (p.alive) n++;
    });
    return Math.max(1, n);
  }

  /** Switch between survival ("arena") and Testing Grounds ("training", §21). */
  private toggleTraining(): void {
    this.state.enemies.clear();
    this.state.pickups.clear();
    this.state.projectiles.clear();
    this.state.zones.clear();
    this.clearTransients();
    this.state.outcome = "active";
    this.state.portalOpen = false;
    this.state.riftOpen = false; // §6 chain — the Testing Grounds sits outside the run structure
    this.state.depth = 1;
    this.visitedDims.clear();
    // §6 bank-or-lose (v0.103): stepping OUT of a live run into the workshop ABORTS the expedition —
    // everything carried is lost (only extraction banks). Without this, T is a wipe-panic button that
    // launders deep-run salvage through a depth reset (adversarial-verify finding F2). Also clear the
    // elapsed-clock parry timestamps (elapsed resets below) + weapon provenance (the gallery is free).
    this.state.players.forEach((p) => {
      p.salvaged = 0;
      // …and the held weapon sheds its rolled loot identity too — without this, the workshop is a
      // risk-free reroll booth whose Legendary rides back into the real run (adversarial-verify).
      p.weaponRarity = RARITY_COMMON;
      p.weaponAffix = "";
    });
    this.combat.forEach((c) => {
      c.lastParryAt = -999;
      c.hairStreak = 0;
      c.heldEarned = false;
    });
    this.bossSpawned = false;
    this.clearBoss();
    this.resetShifters();
    const cx = ARENA_WIDTH / 2;
    const cy = ARENA_HEIGHT / 2;

    if (this.state.mode === "arena") {
      this.state.mode = "training";
      this.state.elapsed = 0;
      this.spawnAccum = 0;
      // Weapon pickups in a row (one per roster weapon), and dummies below them. Each placement runs
      // through safeSpawnPos — the fixed grid ignores the procgen terrain, so on a random map a slot can
      // land over a pit (pickup unreachable) or inside a landmark (ungrabbable: closest approach =
      // poiRadius + PLAYER_RADIUS > PICKUP_RADIUS); the nudge lands it on the nearest clear ground.
      WEAPON_IDS.forEach((weaponId, i) => {
        const pk = new PickupState();
        pk.id = `pk${i}`;
        pk.weapon = weaponId;
        const sp = safeSpawnPos(
          this.map,
          cx + (i - (WEAPON_IDS.length - 1) / 2) * 150,
          cy - 200,
          PICKUP_RADIUS,
        );
        pk.x = sp.x;
        pk.y = sp.y;
        this.state.pickups.set(pk.id, pk);
      });
      for (let i = 0; i < 3; i++) {
        const dummy = new EnemyState();
        dummy.id = `dummy${i}`;
        dummy.kind = "dummy";
        dummy.hp = DUMMY_HP;
        // A dummy is a non-boss enemy — over a pit the §17 terrain-death rule would delete it on tick 1.
        const sp = safeSpawnPos(this.map, cx + (i - 1) * 200, cy + 170, DUMMY_RADIUS);
        dummy.x = sp.x;
        dummy.y = sp.y;
        this.state.enemies.set(dummy.id, dummy);
      }
      // Reset players to the center, full HP, so they start clear of everything.
      this.state.players.forEach((player, id) => {
        player.alive = true;
        player.hp = player.maxHp;
        player.x = cx;
        player.y = cy + 20;
        this.zeroMoveVel(id); // §7 the reposition is a teleport — don't glide out of it
      });
    } else {
      this.state.mode = "arena";
      this.state.elapsed = 0;
      this.spawnAccum = 0;
    }
    console.log(`[room ${this.roomId}] mode → ${this.state.mode}`);
  }

  private restartRun(): void {
    this.state.enemies.clear();
    this.state.projectiles.clear();
    this.state.zones.clear();
    // A fresh map means old drops would float over unrelated terrain — clear them with the field.
    this.state.pickups.clear();
    this.clearTransients();
    this.state.elapsed = 0;
    this.state.outcome = "active";
    this.state.portalOpen = false;
    // §6 chain (v0.103): a fresh RUN resets the chain — depth 1, rift closed, visited wiped, back to the
    // menu-picked HOME dimension, and a freshly-minted map (every run gets new terrain). Only
    // `bankedSalvage` survives (the M0 "account").
    this.state.riftOpen = false;
    this.state.riftCharge = 0;
    this.state.depth = 1;
    this.visitedDims.clear();
    this.state.dimensionId = this.homeDimension;
    this.mintMap();
    this.bossSpawned = false;
    this.clearBoss();
    this.resetShifters();
    this.spawnAccum = 0;
    this.enemySeq = 0;
    this.state.players.forEach((player, id) => {
      // Fresh run → reset progression + attributes to the 1/1/1/1/1 start (§11/§12); carried salvage
      // starts empty too (§6 bank-or-lose — a restart is a NEW expedition, not a continue), and the
      // held weapon sheds its rolled loot identity (drops are per-run).
      player.salvaged = 0;
      player.weaponRarity = RARITY_COMMON;
      player.weaponAffix = "";
      player.level = 1;
      player.xp = 0;
      player.xpToNext = xpToNextLevel(1);
      player.str = 1;
      player.dex = 1;
      player.int = 1;
      player.con = 1;
      player.luk = 1;
      player.flexPending = 0;
      player.flexTimer = 0;
      // §8 augments are PER-RUN — clear the parry build on a fresh run.
      player.augments = "";
      player.sigPending = 0;
      player.sigOffer = "";
      player.vx = 0; // §20 clear any residual momentum
      player.vy = 0;
      player.height = 0; // §5/§20 back to the ground
      player.maxHp = PLAYER_MAX_HP;
      player.alive = true;
      player.hp = player.maxHp;
      player.x = this.map.spawnX + (Math.random() * 200 - 100);
      player.y = this.map.spawnY + (Math.random() * 200 - 100);
      const c = this.combat.get(id);
      if (c) {
        c.respawn = 0;
        c.cd = 0;
        c.attackBuffer = 0;
        c.parryBuffer = 0;
        c.jumpBuffer = 0;
        c.reloadCd = 0;
        c.lastWeapon = ""; // forces charge re-init next tick
        c.hairStreak = 0;
        c.lastParryAt = -999;
        c.vh = 0;
      }
      this.zeroMoveVel(id); // §7 fresh run, fresh momentum
    });
    // §16 v0.116 a restart in BOSS RUSH re-arms the gauntlet from boss 1 (mode is preserved across restart).
    if (this.state.mode === "bossrush") {
      this.bossRushIndex = 0;
      this.bossRushNextTimer = BOSSRUSH_BREATHER;
    }
    console.log(`[room ${this.roomId}] run restarted`);
  }

  /** Delete enemies within `radius` of a point (respawn breathing room). Never clears the boss —
   *  it must be defeated, not despawned by a nearby respawn (§16). */
  private clearEnemiesNear(x: number, y: number, radius: number): void {
    const r2 = radius * radius;
    const doomed: string[] = [];
    this.state.enemies.forEach((enemy, id) => {
      if (id === this.bossId) return;
      const dx = enemy.x - x;
      const dy = enemy.y - y;
      if (dx * dx + dy * dy <= r2) doomed.push(id);
    });
    for (const id of doomed) this.state.enemies.delete(id);
  }

  /** §5 body collision for the horde: enemy↔enemy separation + enemies pushed out of players. */
  private resolveEnemyCollisions(): void {
    const list = [...this.state.enemies.values()];
    const rad = (e: EnemyState): number => ENEMY_KINDS[e.kind]?.radius ?? ENEMY_RADIUS;
    for (let iter = 0; iter < 2; iter++) {
      for (let i = 0; i < list.length; i++) {
        const a = list[i];
        if (!a) continue;
        const ra = rad(a);
        for (let j = i + 1; j < list.length; j++) {
          const b = list[j];
          if (!b) continue;
          const min = ra + rad(b);
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let d = Math.hypot(dx, dy);
          if (d === 0) {
            dx = 1;
            dy = 0;
            d = 1;
          }
          if (d < min) {
            const push = (min - d) / 2;
            a.x -= (dx / d) * push;
            a.y -= (dy / d) * push;
            b.x += (dx / d) * push;
            b.y += (dy / d) * push;
          }
        }
        // Push the enemy out of any living player (the player stays put — authoritative).
        this.state.players.forEach((p) => {
          if (!p.alive || !a) return;
          const min = ra + PLAYER_RADIUS;
          let dx = a.x - p.x;
          let dy = a.y - p.y;
          let d = Math.hypot(dx, dy);
          if (d === 0) {
            dx = 1;
            dy = 0;
            d = 1;
          }
          if (d < min) {
            a.x = p.x + (dx / d) * min;
            a.y = p.y + (dy / d) * min;
          }
        });
      }
    }
    for (const e of list) {
      e.x = clamp(e.x, ENEMY_RADIUS, ARENA_WIDTH - ENEMY_RADIUS);
      e.y = clamp(e.y, ENEMY_RADIUS, ARENA_HEIGHT - ENEMY_RADIUS);
    }
  }

  override onJoin(client: Client, options?: { scrip?: number }): void {
    const player = new PlayerState();
    player.id = client.sessionId;
    player.hp = PLAYER_MAX_HP;
    player.maxHp = PLAYER_MAX_HP;
    player.alive = true;
    player.weapon = DEFAULT_WEAPON;
    // §29 restore the player's persisted meta-scrip (belt only). Client-supplied → clamp to the uint16
    // ceiling (a sane bound; the persistence model is an MVP, not a trusted economy).
    if (this.belt && Number.isFinite(options?.scrip)) {
      player.scrip = Math.max(0, Math.min(65535, Math.floor(options?.scrip as number)));
    }
    // §29 seed the 3-slot arsenal: slot 0 = the starting weapon (Common, conjured → not earned), 1 & 2
    // empty. The active slot mirrors the held weapon; grabs (belt) fill the empties before dropping anything.
    for (let i = 0; i < ARSENAL_SLOTS; i++) player.slots.push(new ArsenalSlot());
    player.slots[0]!.weapon = DEFAULT_WEAPON;
    player.activeSlot = 0;
    // Spawn on the map's guaranteed-clear spawn disc (§17), with a little scatter so blobs don't overlap
    // (±100px stays inside the cleared centre, never over a pit). §29 belt spawns at the START of the belt
    // (the mouth of room 0), mid-depth, so the room progression flows left→right.
    if (this.belt) {
      player.x = 180 + Math.random() * 120;
      player.y = BELT_Y0 + DEPTH_MAX * (0.4 + Math.random() * 0.2);
    } else {
      player.x = this.map.spawnX + (Math.random() * 200 - 100);
      player.y = this.map.spawnY + (Math.random() * 200 - 100);
    }
    this.state.players.set(client.sessionId, player);
    if (this.hostId === null) this.hostId = client.sessionId; // first joiner is the co-op host
    this.inputs.set(client.sessionId, {
      queue: [],
      held: { seq: 0, dx: 0, dy: 0, jump: false },
      lastSeq: 0,
      msgBudget: INPUT_MSGS_PER_TICK,
      mvx: 0,
      mvy: 0,
    });
    this.combat.set(client.sessionId, {
      aimX: 1,
      aimY: 0,
      targetX: 0,
      targetY: 0,
      attackBuffer: 0,
      parryBuffer: 0,
      jumpBuffer: 0,
      cd: 0,
      respawn: 0,
      invuln: 0,
      parryCd: 0,
      reloadCd: 0,
      lastWeapon: "",
      jumpCd: 0,
      lastGroundX: player.x,
      lastGroundY: player.y,
      pitGrace: 0,
      hairStreak: 0,
      lastParryAt: -999,
      parryChain: 0,
      parryChainT: 0,
      vh: 0,
      heldEarned: false,
    });
    console.log(`[room ${this.roomId}] +join ${client.sessionId} (${this.clients.length} online)`);
  }

  override onLeave(client: Client): void {
    this.state.players.delete(client.sessionId);
    this.inputs.delete(client.sessionId);
    this.combat.delete(client.sessionId);
    // Host left → hand off to whoever's still here (or null if the room's now empty).
    if (client.sessionId === this.hostId) {
      const next = this.state.players.keys().next();
      this.hostId = next.done ? null : next.value;
    }
    console.log(`[room ${this.roomId}] -leave ${client.sessionId} (${this.clients.length} online)`);
  }

  /** §12/§8 is the player in the invincible level-up window? True while EITHER a flex stat point OR a
   *  signature augment pick is owed — both freeze + immune the player so they choose safely. */
  private inLevelWindow(player: PlayerState): boolean {
    return player.flexPending > 0 || player.sigPending > 0;
  }

  /** §4 v0.107 defense-in-depth (review #4): WITHOUT this, Colyseus does not wrap the simulation-interval
   *  or message handlers in try/catch — a single uncaught throw (e.g. a hostile payload reaching a schema
   *  setter) escapes the timer and kills the whole Node process (every room, every player). With it, the
   *  error degrades to a log line. Input validation is still the first line — this is the seatbelt. */
  override onUncaughtException(error: Error, methodName: string): void {
    console.error(`[room ${this.roomId}] uncaught exception in ${methodName}:`, error);
  }

  /** §4 v0.107 FIXED-TIMESTEP accumulator (review #1). Colyseus's simulation interval reports REAL elapsed
   *  wall-clock time (50-55ms+ of jitter under load) — but client-side prediction replays exact 50ms steps,
   *  so the sim must integrate in exact 50ms sub-steps too or the two can never agree. Accumulate the real
   *  delta, run whole TICK_MS sub-steps, broadcast once after the batch. Capped at 3 sub-steps + remainder
   *  per invocation (a longer stall is absorbed as brief slow-mo — same posture as the old 2.5-tick clamp),
   *  and a stall's backlog CATCHES UP over following invocations instead of stretching dt. */
  private simAccMs = 0;
  private update(deltaMs: number): void {
    this.simAccMs = Math.min(this.simAccMs + deltaMs, TICK_MS * 3.5);
    let stepped = false;
    while (this.simAccMs >= TICK_MS) {
      this.simAccMs -= TICK_MS;
      this.stepSim(TICK_MS / 1000);
      stepped = true;
    }
    // §7 v0.105 de-clunk: broadcast tick-locked (patchRate is 0 — see onCreate), once per batch, so fresh
    // results never wait on a drifting second timer. Every sub-step bumps `state.tick`, so there is always
    // a change to send — the owning client's reconcile cadence is guaranteed.
    if (stepped) this.broadcastPatch();
  }

  /** One EXACT 50ms authoritative sub-step. The hand-numbered phase order is a CONTRACT (golden test). */
  private stepSim(dt: number): void {
    // 0. §4 v0.107 the sim-tick counter (the snapshot timeline) + per-tick input plumbing: refill each
    //    player's message budget, then consume toward ONE command per sub-step for EVERY player — alive,
    //    downed, or frozen (review #3: consumption must never stall, or queues pin at cap during a level
    //    window and replay ~400ms of stale directions on resume). A backlog drains by jumping straight to
    //    the NEWEST command (input only sets direction; the ack jump is client-safe by design).
    this.state.tick = (this.state.tick + 1) >>> 0;
    this.state.players.forEach((player, id) => {
      const input = this.inputs.get(id);
      if (!input) return;
      input.msgBudget = INPUT_MSGS_PER_TICK;
      if (input.queue.length > 1) input.queue.splice(0, input.queue.length - 1);
      const cmd = input.queue.shift();
      if (cmd) {
        input.held = cmd;
        player.ackSeq = cmd.seq;
        // The jump intent rides the command (review #5) — same buffered-jump semantics as the SPACE
        // message (the consume gate re-checks grounded/cooldown/alive/level-window).
        if (cmd.jump) {
          const c = this.combat.get(id);
          if (c) c.jumpBuffer = JUMP_BUFFER_SECONDS;
        }
      }
    });

    // 1. Integrate each LIVING player's authoritative movement from their held input command.
    //    A player in the §12 level-up window (flexPending) is frozen so they can pick safely.
    this.state.players.forEach((player, id) => {
      const input = this.inputs.get(id);
      if (!input) return;
      if (!player.alive || this.inLevelWindow(player)) {
        // §7 a freeze/down is an INTENTIONAL stop — zero the steering velocity so the player doesn't
        // glide on a stale heading when they resume (same bug class as the v0.105 tryRez fix), and keep
        // the synced mirror coherent for the predicting client.
        input.mvx = 0;
        input.mvy = 0;
        player.mvx = 0;
        player.mvy = 0;
        return;
      }
      // §7 v0.105 STEERED movement (course correction): the velocity blends toward the input's target,
      // so forward→up sweeps through the diagonal, taps ease in, releases ease out — no more snap-turns.
      // §29 belt mode confines DEPTH (y) to the shallow band; the client predictor passes identical bounds.
      const next = this.belt
        ? stepSteeredMovement(
            player,
            { vx: input.mvx, vy: input.mvy },
            input.held,
            dt,
            MOVE_SPEED,
            BELT_Y0,
            BELT_Y0 + DEPTH_MAX,
          )
        : stepSteeredMovement(player, { vx: input.mvx, vy: input.mvy }, input.held, dt);
      input.mvx = next.vx;
      input.mvy = next.vy;
      // §4 v0.107 mirror the steering velocity onto synced state — the owning client REBASES its
      // prediction from these at every patch (review #2: local-history reconstruction breaks under
      // queue starvation/drain, so the server publishes the truth instead).
      player.mvx = next.vx;
      player.mvy = next.vy;
      // §20 momentum layer (Stage A): integrate the impulse shove (recoil / knockback) on top of WASD,
      // then decay it. The authoritative position is the input base PLUS the shove.
      const imp = stepImpulse(next, player, dt);
      player.x = imp.x;
      player.y = imp.y;
      player.vx = imp.vx;
      player.vy = imp.vy;
    });

    // 2. Resolve body collisions so living players block each other (§5). Authoritative.
    const ids: string[] = [];
    const bodies: Vec2[] = [];
    this.state.players.forEach((player, id) => {
      if (!player.alive) return;
      ids.push(id);
      bodies.push({ x: player.x, y: player.y });
    });
    const resolved = resolveBodyCollisions(bodies);
    resolved.forEach((pos, i) => {
      const id = ids[i];
      if (!id) return;
      const player = this.state.players.get(id);
      if (player) {
        player.x = pos.x;
        player.y = pos.y;
      }
    });

    // 2.4 COLLISION — top-down: §17 POI landmarks. Belt (§29): clamp DEPTH to the authored floor profile at
    // this belt-x + route out of deck obstacles — the accurate edge/obstacle collision under the art.
    if (this.belt && this.beltLevel) {
      const level = this.beltLevel;
      // §29 room GATE — a closed gate (beltLockX>0) caps how far right the squad can advance until the
      // room's wave is cleared; else the whole belt is open.
      const rightBound = (this.state.beltLockX > 0 ? this.state.beltLockX : level.length) - PLAYER_RADIUS;
      this.state.players.forEach((player) => {
        if (!player.alive) return;
        const o = resolveBeltObstacles(level, player.x, player.y, PLAYER_RADIUS);
        player.x = Math.min(o.x, rightBound);
        player.y = clampBeltFloorY(level, player.x, o.y, PLAYER_RADIUS);
      });
    } else if (!this.belt) {
      this.state.players.forEach((player) => {
        if (!player.alive) return;
        const r = resolvePoiCollision(this.map, player.x, player.y, PLAYER_RADIUS);
        player.x = r.x;
        player.y = r.y;
      });
    }

    // 2.5 §17 PITFALL — a GROUNDED player whose body is over a pit falls: chip damage + snap back to the
    // last solid tile + a brief grace (i-frames, no re-fall). An AIRBORNE player (mid-jump, §5) clears the
    // gap and is immune. We also remember the last grounded spot here so the snap-back has somewhere to go.
    this.state.players.forEach((player, id) => {
      if (!player.alive || this.inLevelWindow(player)) return;
      const c = this.combat.get(id);
      if (!c) return;
      if (c.pitGrace > 0) c.pitGrace = Math.max(0, c.pitGrace - dt);
      if (player.height > GROUND_EPSILON) return; // airborne (mid-jump) — the hop carries you over
      // §29 belt PITS — gaps in the deck; grounded-over-a-gap falls (chip + snap back to the edge you came
      // from), a jump clears it. Enemies (which can't jump) get kited in for free kills (5.6 below).
      if (this.belt && this.beltLevel) {
        if (!beltPitAtX(this.beltLevel, player.x)) {
          c.lastGroundX = player.x;
          return;
        }
        if (c.pitGrace > 0) return;
        player.hp = Math.max(0, player.hp - player.maxHp * PIT_FALL_DAMAGE_FRAC);
        player.x = beltSafeX(this.beltLevel, player.x, c.lastGroundX);
        c.lastGroundX = player.x;
        c.pitGrace = PIT_FALL_GRACE;
        c.invuln = Math.max(c.invuln, PIT_FALL_GRACE);
        this.zeroMoveVel(id);
        player.fellSeq++;
        return;
      }
      const overPit = isPitAtPx(this.map, player.x, player.y);
      if (!overPit) {
        c.lastGroundX = player.x; // standing on solid ground → remember it
        c.lastGroundY = player.y;
        return;
      }
      if (c.pitGrace > 0) return; // just fell/landed — don't immediately re-fall
      // FALL.
      player.hp = Math.max(0, player.hp - player.maxHp * PIT_FALL_DAMAGE_FRAC);
      const safe = isPitAtPx(this.map, c.lastGroundX, c.lastGroundY)
        ? nearestGroundPx(this.map, player.x, player.y)
        : { x: c.lastGroundX, y: c.lastGroundY };
      player.x = safe.x;
      player.y = safe.y;
      c.lastGroundX = safe.x;
      c.lastGroundY = safe.y;
      c.pitGrace = PIT_FALL_GRACE;
      c.invuln = Math.max(c.invuln, PIT_FALL_GRACE); // brief mercy on landing
      this.zeroMoveVel(id); // §7 the snap-back is a teleport — carried steering would glide you back in
      player.fellSeq++;
    });

    // 3. Run clock + spawn director (§6) — survival mode only. `bodies` = living players.
    if (this.state.mode === "arena") {
      if (this.state.outcome === "active") {
        this.state.elapsed += dt;
        if (this.belt) {
          // §29 belt: room-gated progression REPLACES the continuous director + boss clock + shifters —
          // walk into a room, the gate locks, clear the wave, the gate opens, advance; the last room = boss.
          this.stepBeltRooms(dt, bodies);
        } else {
          // Boss director (§16): the dimension boss arrives at the depth-scaled mark (§6 chain — deeper
          // dimensions bring the capstone sooner), once per dimension.
          if (!this.bossSpawned && this.state.elapsed >= bossSpawnAt(this.state.depth))
            this.spawnBoss();
          // The horde keeps coming until the boss falls; once the portal opens it eases off so the
          // greed decision (bank vs descend) can be made cleanly.
          if (!this.state.portalOpen) this.runSpawnDirector(dt, bodies);
          // §17 cross-dimensional SHIFTER incursions (roaming invaders) — phase one in on a timer, phase it
          // out if it survives its window. Combat is the generic archetype AI (spitter/duelist), so this just
          // owns lifecycle.
          this.stepShifters(dt, bodies);
          this.checkExtraction(bodies);
          this.checkDescend(dt, bodies); // §6 chain (v0.103): the rift channel — the other half of the choice
        }
      }
    } else if (this.state.mode === "bossrush") {
      // §16 v0.116 BOSS RUSH — no horde, no boss clock: just count down the breather and drop the next boss.
      // The gauntlet advances in `advanceBossRush` (called from the boss death path).
      if (this.state.outcome === "active") {
        this.state.elapsed += dt;
        if (this.bossRushNextTimer > 0) {
          this.bossRushNextTimer -= dt;
          if (this.bossRushNextTimer <= 0) this.spawnBossRushBoss();
        }
      }
    }

    // 3b. Pickups are grabbed with the R key now (§13 `grabWeapon`), not walk-over — here we just age the
    // per-DROP grace window (a just-dropped weapon can't be re-grabbed until it expires).
    for (const [pid, t] of this.pickupGrace) {
      const left = t - dt;
      if (left <= 0 || !this.state.pickups.has(pid)) this.pickupGrace.delete(pid);
      else this.pickupGrace.set(pid, left);
    }

    // 4. Resolve attacks (cooldown-gated). Melee weapons swing; thrown weapons hurl a charge.
    this.state.players.forEach((player, id) => {
      const c = this.combat.get(id);
      if (!c) return;
      // Allow ONE tick of negative so an accumulating cooldown (guns, below) carries its sub-tick
      // remainder across the 20Hz grid — otherwise a 0.08s fire-rate quantises to 0.10s (a silent ~20%
      // DPS loss on fast autos). Resetting weapons (melee/thrown) clamp to 0 effectively (they set `= cd`).
      c.cd = Math.max(-dt, c.cd - dt);
      c.invuln = Math.max(0, c.invuln - dt);
      c.parryCd = Math.max(0, c.parryCd - dt);
      c.parryChainT = Math.max(0, c.parryChainT - dt);
      if (c.parryChainT <= 0) c.parryChain = 0; // §8 v0.114 the parry chain lapses if you don't keep it up
      c.jumpCd = Math.max(0, c.jumpCd - dt);
      // §7 v0.105 de-clunk: age the queued-input buffers, then fire any that the cooldown has just cleared.
      c.attackBuffer = Math.max(0, c.attackBuffer - dt);
      c.parryBuffer = Math.max(0, c.parryBuffer - dt);
      c.jumpBuffer = Math.max(0, c.jumpBuffer - dt);
      const acting = player.alive && !this.inLevelWindow(player);
      // BUFFERED PARRY — a press that arrived on cooldown fires the instant the cd drains.
      if (acting && c.parryBuffer > 0 && c.parryCd <= 0) {
        c.parryBuffer = 0;
        this.executeParry(player, c);
      }
      // BUFFERED JUMP — seed the hop BEFORE stepVertical so it lifts off this same tick (grounded + ready).
      if (acting && c.jumpBuffer > 0 && c.jumpCd <= 0 && player.height <= GROUND_EPSILON) {
        c.jumpBuffer = 0;
        c.vh = JUMP_VELOCITY;
        c.jumpCd = JUMP_COOLDOWN;
      }
      // §5/§20 (Stage B): integrate the real height axis under gravity (the jump + later parry-launch).
      const vert = stepVertical(player.height, c.vh, dt);
      player.height = vert.height;
      c.vh = vert.vh;
      player.vh = vert.vh; // §4 v0.107 synced mirror — the predicting client rebases its jump arc exactly
      const weapon = WEAPONS[player.weapon] ?? WEAPONS[DEFAULT_WEAPON];

      // (Re)initialise the ammo/charge readout when the equipped weapon changes (§9/§10). Guns use the
      // magazine as ammo; thrown weapons use charges; both share charges/maxCharges + the reload timer.
      if (c.lastWeapon !== player.weapon) {
        c.lastWeapon = player.weapon;
        c.cd = 0; // clear the previous weapon's leftover cooldown so the new one can act immediately
        c.reloadCd = 0;
        // §7 v0.105 de-clunk (adversarial-verify fix): also DROP any attack buffered on the OLD weapon.
        // The swap zeroes cd, so a stale buffered press would otherwise auto-fire the NEW weapon with no
        // input for it — a free cooldown-bypassing hit you could farm by attack→cycle→attack→cycle.
        c.attackBuffer = 0;
        const max = weapon?.gun?.magazine ?? weapon?.thrown?.charges ?? 0;
        player.charges = max;
        player.maxCharges = max;
      }

      // §7 v0.105 de-clunk: a BUFFERED attack is live while its window hasn't decayed; the tick fires it the
      // instant the cooldown drains (a press one tick early is honoured, not eaten), and consuming it zeroes
      // the buffer so it can't double-fire. A held trigger re-arms the buffer each client cooldown.
      const canAct = acting && c.attackBuffer > 0 && c.cd <= 0;
      // §10 v0.104: the single Terraria affix can speed up / slow down the held weapon (Swift/Heavy…).
      const cdMul = lootCooldownMult(player.weaponAffix);
      if (weapon?.gun) {
        // §9 GUN: fire-rate-gated bullets that spend ammo; on empty, RELOAD (refill the magazine).
        if (player.charges <= 0 && c.reloadCd > 0) {
          c.reloadCd -= dt;
          if (c.reloadCd <= 0) player.charges = player.maxCharges;
        }
        if (canAct && player.charges > 0) {
          c.attackBuffer = 0;
          this.fireGun(player, c, weapon);
          player.charges -= 1;
          c.cd += weapon.gun.fireRate * cdMul; // ACCUMULATE (not assign) so the sub-tick remainder carries
          if (player.charges <= 0) c.reloadCd = weapon.gun.reloadSeconds;
        }
      } else if (weapon?.thrown) {
        // Refill all charges once a depleted weapon's cooldown elapses (§10 three-layer model).
        if (player.charges <= 0 && c.reloadCd > 0) {
          c.reloadCd -= dt;
          if (c.reloadCd <= 0) player.charges = player.maxCharges;
        }
        if (canAct && player.charges > 0) {
          c.attackBuffer = 0;
          this.throwWeapon(player, c, weapon);
          player.charges -= 1;
          c.cd = weapon.cooldown * cdMul; // flat (DEX is damage-only; the affix is the only speed source)
          if (player.charges <= 0) c.reloadCd = weapon.thrown.refillSeconds;
        }
      } else if (weapon && canAct) {
        c.attackBuffer = 0;
        this.resolveSwing(player, c, weapon);
        c.cd = weapon.cooldown * cdMul; // flat cooldown — DEX scales DAMAGE (via §10 grades), not speed
      }
    });

    // 4.6 §20 advance in-flight swept melee blades (edge damage over the swing's active window).
    this.stepMeleeSwings(dt);

    // 5. Enemy AI — melee archetypes rush the nearest LIVING drifter; spitters KITE (§15). Duelists
    // (kind.melee) move + attack in stepDuelists, so they're skipped here.
    for (const id of [...this.dodgeState.keys()]) {
      if (!this.state.enemies.has(id)) this.dodgeState.delete(id);
    }
    this.state.enemies.forEach((enemy, id) => {
      const kind = ENEMY_KINDS[enemy.kind];
      // §20 lunge-enemies (duelists + the derived rusher/swarm/zoner lunge) move via stepDuelists; this
      // generic pass only chases/kites the rest (ranged spitters kite). §16 v0.109 the boss is stepped by
      // its BossController (which owns movement), so skip it here to avoid a double-move.
      if (!kind || effectiveMelee(kind) || id === this.bossId) return;
      const target = nearestPoint(enemy, bodies);
      // §15 v0.113 DODGE-ROLL (rangers): if a player has closed inside `dodge.range` and the roll is off
      // cooldown, burst AWAY from them for `duration` sec — evasive repositioning that overrides the kite.
      if (kind.dodge) {
        const ds = this.dodgeState.get(id) ?? { cd: 0, t: 0, dx: 0, dy: 0 };
        ds.cd = Math.max(0, ds.cd - dt);
        const nd = target
          ? Math.hypot(target.x - enemy.x, target.y - enemy.y)
          : Number.POSITIVE_INFINITY;
        if (ds.t <= 0 && ds.cd <= 0 && target && nd < kind.dodge.range) {
          const ax = enemy.x - target.x;
          const ay = enemy.y - target.y;
          const al = Math.hypot(ax, ay) || 1;
          ds.dx = ax / al;
          ds.dy = ay / al;
          ds.t = kind.dodge.duration;
          ds.cd = kind.dodge.cooldown + kind.dodge.duration;
        }
        if (ds.t > 0) {
          ds.t -= dt;
          const rollSpeed = kind.dodge.distance / kind.dodge.duration;
          const r = kind.radius;
          enemy.x = clamp(enemy.x + ds.dx * rollSpeed * dt, r, ARENA_WIDTH - r);
          enemy.y = clamp(enemy.y + ds.dy * rollSpeed * dt, r, ARENA_HEIGHT - r);
          this.dodgeState.set(id, ds);
          return; // rolling — skip the normal kite this tick
        }
        this.dodgeState.set(id, ds);
      }
      const next = kind.ranged
        ? stepEnemyKite(
            { x: enemy.x, y: enemy.y },
            target,
            kind.speed,
            kind.ranged.preferredRange,
            dt,
          )
        : stepEnemyChase({ x: enemy.x, y: enemy.y }, target, kind.speed, dt);
      enemy.x = next.x;
      enemy.y = next.y;
    });

    // 5.1 Duelists (ronin): close in, telegraph, then string a melee COMBO (§15).
    this.stepDuelists(dt, bodies);
    // 5.15 §16 OLD RUST boss phases (bullet-walls / punch-slams / enrage). Runs BEFORE the spitters so it
    // owns the boss's fire (stepSpitters skips the boss).
    this.stepBoss(dt, bodies);
    // 5.2 Spitters fire projectiles at the nearest player on a cooldown (§15 ranged threat).
    this.stepSpitters(dt, bodies);
    // 5.3 Advance projectiles + apply hits (server-authoritative damage).
    this.stepProjectiles(dt);
    // 5.4 Zoners drop corrosive puddles; puddles DoT players inside + expire (§15 area denial).
    this.stepZoners(dt);
    this.stepZones(dt);

    // 5.5 Body collision (§5): separate enemies from each other + push them out of living
    // players (one-way — players stay authoritative). Stops the horde stacking on the spawn.
    this.resolveEnemyCollisions();

    // 5.55 §17 POI collision — enemies are blocked by the landmarks too (they bunch up + flow around them).
    // The BOSS is exempt (like the pit rule below): a boss body — especially the colossus (r=170, far bigger
    // than any landmark) — crushes through cover rather than wedging on it, and its size exceeds the §17
    // wedge/push-out guards that keep normal bodies un-stuck.
    if (this.belt && this.beltLevel) {
      const level = this.beltLevel;
      this.state.enemies.forEach((enemy, eid) => {
        const er = ENEMY_KINDS[enemy.kind]?.radius ?? ENEMY_RADIUS;
        if (eid !== this.bossId) {
          const o = resolveBeltObstacles(level, enemy.x, enemy.y, er); // boss crushes through obstacles
          enemy.x = o.x;
          enemy.y = o.y;
        }
        enemy.y = clampBeltFloorY(level, enemy.x, enemy.y, er); // everything stays on the deck
      });
    } else if (!this.belt) {
      this.state.enemies.forEach((enemy, eid) => {
        if (eid === this.bossId) return;
        const r = resolvePoiCollision(
          this.map,
          enemy.x,
          enemy.y,
          ENEMY_KINDS[enemy.kind]?.radius ?? ENEMY_RADIUS,
        );
        enemy.x = r.x;
        enemy.y = r.y;
      });
    }

    // 5.6 §17 PITFALL — a non-boss enemy whose body ends the tick over a pit falls in and DIES. Kite the
    // horde into a pit (they can't jump) or knock one in with a parry = an instant kill. Boss is pit-immune.
    // No XP — terrain kills are free crowd control. §29 belt uses the level's authored pit x-ranges.
    const fellIn: string[] = [];
    this.state.enemies.forEach((enemy, eid) => {
      if (eid === this.bossId) return;
      const over =
        this.belt && this.beltLevel
          ? beltPitAtX(this.beltLevel, enemy.x)
          : !this.belt && isPitAtPx(this.map, enemy.x, enemy.y);
      if (over) fellIn.push(eid);
    });
    for (const eid of fellIn) this.state.enemies.delete(eid);

    // 6. Enemy contact damage (continuous DPS while touching a living player).
    this.state.enemies.forEach((enemy) => {
      const kind = ENEMY_KINDS[enemy.kind];
      if (!kind) return;
      this.state.players.forEach((player) => {
        if (!player.alive || this.inLevelWindow(player)) return; // invincible in the §12 level window
        if ((this.combat.get(player.id)?.invuln ?? 0) > 0) return; // parry i-frames
        const reach = kind.radius + PLAYER_RADIUS;
        const dx = enemy.x - player.x;
        const dy = enemy.y - player.y;
        const dmgMul = enemy.tough ? TOUGH_DAMAGE_MULT : 1;
        // §29 BELT: contact is LANE-gated too — horizontal touch AND a TIGHT depth alignment
        // (DEPTH_TOL_ENEMY), so sidestepping in depth is a real dodge. A player actively repositioning in
        // depth shrinks their own hurtbox (DEPTH_DODGE_MULT) — a juke slips the hit. (The other half of the
        // SoR4 fairness lever: generous for the player's own swing, tight for what lands on them.)
        const contact = this.belt
          ? Math.abs(dx) <= reach &&
            Math.abs(dy) <=
              DEPTH_TOL_ENEMY * (Math.abs(player.vy) > 40 ? DEPTH_DODGE_MULT : 1)
          : dx * dx + dy * dy <= reach * reach;
        if (contact) {
          player.hp -= kind.contactDamage * dmgMul * depthDamageScale(this.state.depth) * dt;
          // §20 contact knockback (Stage A): a gentle continuous shove AWAY while a damaging enemy touches.
          if (kind.contactDamage > 0) {
            const d = Math.hypot(dx, dy) || 1;
            const push = HIT_KNOCKBACK_IMPULSE * dt;
            const k = addImpulse(player, (-dx / d) * push, (-dy / d) * push);
            player.vx = k.vx;
            player.vy = k.vy;
          }
        }
      });
    });

    // 7. Always-on regen (§6) + the §6 REZ-OR-DEAD death model. A player at 0 HP is DOWNED — alive=false,
    // body persists, NO auto-respawn. They stay down until a rez weapon (Gravedigger's Spade) revives them
    // (handled in resolveSwing). Living players regen.
    let anyAlive = false;
    this.state.players.forEach((player) => {
      if (!player.alive) return; // downed — waiting for a rez (no auto-respawn)
      if (player.hp <= 0) {
        player.hp = 0;
        player.alive = false; // DOWNED
        return;
      }
      anyAlive = true;
      player.hp = Math.min(player.maxHp, player.hp + deriveStats(player).regen * dt);
    });
    // §6 WIPE: in a live run (survival OR boss rush), if there are players and NONE are still up, no one can
    // rez → the run is over.
    if (
      (this.state.mode === "arena" || this.state.mode === "bossrush") &&
      this.state.outcome === "active" &&
      this.state.players.size > 0 &&
      !anyAlive
    ) {
      this.state.outcome = "defeat";
      // §6 "bank or LOSE" (v0.103): a wipe drops everything the squad was carrying — only what was
      // banked at an extraction survives. This is the teeth of the extract-vs-descend decision.
      let lost = 0;
      this.state.players.forEach((p) => {
        lost += p.salvaged;
        p.salvaged = 0;
      });
      if (lost > 0)
        console.log(
          `[room ${this.roomId}] squad WIPED at depth ${this.state.depth} — ${lost} carried salvage lost`,
        );
    }

    // §8 Conflagration: fire any deferred burn re-pulses whose delay has elapsed (the "lingering" wave).
    for (let i = this.burnPulses.length - 1; i >= 0; i--) {
      const p = this.burnPulses[i];
      if (p && this.state.elapsed >= p.at) {
        this.emberguardWave(p.x, p.y, p.aimX, p.aimY, p.dmg);
        this.burnPulses.splice(i, 1);
      }
    }
    // §8 Brand: decay the Marked timer on every enemy.
    this.state.enemies.forEach((enemy) => {
      if (enemy.branded > 0) enemy.branded = Math.max(0, enemy.branded - dt);
    });

    // 8. Tick the §12 level-up windows (auto-resolve a flex point + signature pick if the 5s timer runs out).
    this.tickLevelWindows(dt);
  }

  /** Fire one weapon swing (§20 WYSIWYG). The EDGE is registered as a SWEPT BLADE (`stepMeleeSwings` sweeps
   *  it across `swingArc` and damages each enemy the blade actually crosses — #2/#5/#6); the secondary
   *  LAYERS (chain / quake / scatter) fire here at the swing moment, each an independent position-based
   *  source ("layered like the Wyrmtooth"). Damage scales per-source (§14); kills grant XP. */
  private resolveSwing(player: PlayerState, c: CombatState, weapon: WeaponDef): void {
    // §14 WYSIWYG: each damage SOURCE scales independently. The EDGE uses the weapon's own grades; the
    // layers below carry their own and may scale off DIFFERENT attributes (e.g. INT magma on a STR blade).
    const edgePower = this.heldDamageMult(weapon, weapon.scalingGrades, player); // §10 edge grades × §11 req penalty
    const aim0 = Math.atan2(c.aimY, c.aimX);
    // §20 WYSIWYG: the hit reach follows the RENDERED blade — floored at the sprite tip + scaled by the
    // holder's rig — so the point stops whiffing (guns already do this via gunMuzzleReach; melee was flat).
    const reach = meleeReach(weapon); // §29 weapons are a FIXED size now (not char-scaled) → fixed reach
    // Register the swept edge — the blade sweeps from `aim0 − swingArc/2` to `+swingArc/2` over `active`,
    // origin tracked live from the player. Replaces any in-flight swing (cooldown ≥ active, so no overlap).
    this.meleeSwings.set(player.id, {
      aim0,
      range: reach,
      swingArc: weapon.swingArc,
      halfWidth: MELEE_BLADE_HALFWIDTH,
      edgeDamage: weapon.damage * edgePower,
      elapsed: 0,
      active: meleeSwingActive(weapon.cooldown * lootCooldownMult(player.weaponAffix)),
      hit: new Set<string>(),
    });

    // Chain lightning (§10 on-hit proc): seed off the nearest enemy inside the swing WEDGE (within range +
    // swingArc/2 of the aim), then leap to the nearest enemies OUTSIDE the wedge, up to `jumps`. Target
    // SELECTION is the shared `selectChainTargets` (the client re-runs the identical pick for the bolt VFX).
    if (weapon.chainLightning) {
      const halfSweep = weapon.swingArc / 2;
      const r2 = reach * reach;
      const wedge = new Set<string>();
      let seedX = 0;
      let seedY = 0;
      let seedFound = false;
      let seedBestD = Number.POSITIVE_INFINITY;
      this.state.enemies.forEach((enemy, eid) => {
        const dx = enemy.x - player.x;
        const dy = enemy.y - player.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > r2) return;
        let da = Math.abs(Math.atan2(dy, dx) - aim0);
        if (da > Math.PI) da = 2 * Math.PI - da;
        if (da > halfSweep) return;
        wedge.add(eid);
        if (d2 < seedBestD) {
          seedBestD = d2;
          seedX = enemy.x;
          seedY = enemy.y;
          seedFound = true;
        }
      });
      if (seedFound) {
        const cl = weapon.chainLightning;
        const clPower = this.heldDamageMult(weapon, cl.scalingGrades, player);
        const candidates: ChainCandidate[] = [];
        this.state.enemies.forEach((enemy, eid) => {
          candidates.push({ id: eid, x: enemy.x, y: enemy.y });
        });
        const links = selectChainTargets(
          { x: seedX, y: seedY },
          candidates,
          cl.jumps,
          Math.min(cl.range, CHAIN_MAX_RANGE),
          wedge, // swing-wedge enemies aren't chain targets (the blade already covers them)
        );
        const kills: string[] = [];
        let xp = 0;
        links.forEach((t, n) => {
          const enemy = this.state.enemies.get(t.id);
          if (enemy)
            xp += this.damageEnemy(enemy, t.id, cl.damage * cl.falloff ** n * clPower, kills);
        });
        for (const eid of kills) this.state.enemies.delete(eid);
        if (xp > 0) this.grantXp(xp);
      }
    }

    // Earthquake: erupts at the CURSOR, clamped to QUAKE_REACH from the player (§9 aim-at-cursor); AoE via
    // the shared `detonate` (same kill/XP/portal bookkeeping). The client matches the epicentre via the
    // SAME shared clampQuakeEpicenter.
    if (weapon.quake) {
      const qPower = this.heldDamageMult(weapon, weapon.quake.scalingGrades, player);
      const ep = clampQuakeEpicenter(player, { x: c.targetX, y: c.targetY }, QUAKE_REACH);
      this.detonate(ep.x, ep.y, weapon.quake.radius, weapon.quake.damage * qPower);
    }

    // Scatter shot (§14 WYSIWYG): fling real magma projectiles that each deal an INT-scaled hit + explode.
    // Fired as live projectiles (server-authoritative) — they advance + detonate ON CONTACT in
    // stepProjectiles, so the secondary VFX damage where it actually touches an enemy (#6).
    if (weapon.scatter) this.fireScatter(player, c, weapon);

    // §6 REZ (Gravedigger's Spade): the swing REVIVES the nearest downed ally within range (at 30% HP).
    if (weapon.rez) this.tryRez(player, weapon.rez.radius);
  }

  /** §6 try to revive the nearest DOWNED ally within `radius` of the rezzer (the swing's rez effect). The
   *  ally comes back at `REVIVE_HP_FRAC` of max HP, WHERE THEY FELL, with the spawn pile cleared so they
   *  don't instantly re-down; `revivedSeq` bumps the client's revive VFX. One rez per swing. */
  private tryRez(rezzer: PlayerState, radius: number): void {
    let best: PlayerState | null = null;
    let bestD = radius * radius;
    this.state.players.forEach((p) => {
      if (p.alive || p.id === rezzer.id) return; // only DOWNED allies
      const dx = p.x - rezzer.x;
      const dy = p.y - rezzer.y;
      const d2 = dx * dx + dy * dy;
      if (d2 <= bestD) {
        bestD = d2;
        best = p;
      }
    });
    if (!best) return;
    const ally: PlayerState = best;
    ally.alive = true;
    // §7 v0.105 de-clunk (adversarial-verify fix): a downed player's steered velocity is FROZEN at the
    // heading they died on (the movement loop skips non-alive players, so it never decays). Zero it on
    // revive — otherwise stepSteeredMovement resumes from that stale velocity and slides the player
    // uncommanded for ~100ms on the first tick back, feeding that tick's pit/wall checks.
    this.zeroMoveVel(ally.id);
    ally.hp = Math.max(1, Math.round(ally.maxHp * REVIVE_HP_FRAC));
    ally.revivedSeq = (ally.revivedSeq + 1) % 100000;
    this.clearEnemiesNear(ally.x, ally.y, RESPAWN_CLEAR_RADIUS);
  }

  /** §20 advance every in-flight melee swing: sweep the blade across its arc this tick (super-sampled so the
   *  band is continuous between 20Hz ticks) and edge-hit each enemy the blade crosses ONCE per swing. The
   *  blade origin is read live from the player so the cut tracks you. Expired swings are dropped. */
  private stepMeleeSwings(dt: number): void {
    if (this.meleeSwings.size === 0) return;
    const kills: string[] = [];
    let xpGained = 0;
    for (const [pid, sw] of this.meleeSwings) {
      const player = this.state.players.get(pid);
      if (!player?.alive) {
        this.meleeSwings.delete(pid);
        continue;
      }
      const p0 = Math.min(1, sw.elapsed / sw.active);
      sw.elapsed += dt;
      const p1 = Math.min(1, sw.elapsed / sw.active);
      if (this.belt) {
        // §29 BELT melee is LANE-based (SoR4 model), not the top-down angular sweep: a hit needs horizontal
        // reach in the facing direction AND depth alignment |Δy| ≤ DEPTH_TOL_PLAYER (+ the target radius).
        // A blade that whiffs because the mob is a hair nearer/farther in the shallow band feels awful; this
        // is the fairness lever the belt constants were authored for. Tested once/tick (persist over `active`,
        // hit-once via `sw.hit`) so a mob walking into your swing still gets clipped.
        const facing = Math.cos(sw.aim0) >= 0 ? 1 : -1;
        this.state.enemies.forEach((enemy, eid) => {
          if (sw.hit.has(eid) || enemy.hp <= 0) return; // once per swing; skip corpses pending deletion
          const r = ENEMY_KINDS[enemy.kind]?.radius ?? ENEMY_RADIUS;
          const fx = (enemy.x - player.x) * facing; // forward distance along the belt (in front = positive)
          if (fx < -r * 0.5 || fx > sw.range) return; // behind us, or beyond blade reach
          // Depth window: generous for the attacker, but a mob actively rolling in depth (dodgeState) shrinks
          // its own hurtbox depth (DEPTH_DODGE_MULT) so a well-timed roll genuinely slips the swing.
          const rolling = (this.dodgeState.get(eid)?.t ?? 0) > 0;
          const depthWin = DEPTH_TOL_PLAYER + r * (rolling ? DEPTH_DODGE_MULT : 1);
          if (Math.abs(enemy.y - player.y) > depthWin) return;
          sw.hit.add(eid);
          xpGained += this.damageEnemy(enemy, eid, sw.edgeDamage, kills);
        });
        if (sw.elapsed >= sw.active) this.meleeSwings.delete(pid);
        continue;
      }
      const steps = Math.max(1, Math.ceil((sw.swingArc * (p1 - p0)) / MELEE_SAMPLE_STEP));
      const wielder = { x: player.x, y: player.y };
      for (let s = 1; s <= steps; s++) {
        const angle = bladeAngleAt(sw.aim0, sw.swingArc, p0 + ((p1 - p0) * s) / steps);
        this.state.enemies.forEach((enemy, eid) => {
          if (sw.hit.has(eid) || enemy.hp <= 0) return; // once per swing; skip corpses pending deletion
          const r = ENEMY_KINDS[enemy.kind]?.radius ?? ENEMY_RADIUS;
          if (bladeHitsCircle(wielder, angle, sw.range, enemy, r, sw.halfWidth)) {
            sw.hit.add(eid);
            xpGained += this.damageEnemy(enemy, eid, sw.edgeDamage, kills);
          }
        });
      }
      if (sw.elapsed >= sw.active) this.meleeSwings.delete(pid);
    }
    for (const eid of kills) this.state.enemies.delete(eid);
    if (xpGained > 0) this.grantXp(xpGained);
  }

  /** §12: XP is SQUAD-SHARED — every kill levels the whole squad in lockstep (not just the killer). */
  private grantXp(amount: number): void {
    this.state.players.forEach((player) => {
      levelUpPlayer(player, amount);
    });
  }

  /** §12/§8 window: roll the augment draft when a signature pick opens, count down the shared timer, and on
   *  timeout auto-resolve the pending pick(s) — a flex point → the class attr, a signature pick → the first
   *  offered augment ("pick in time or you exit it"; you never lose the pick). */
  private tickLevelWindows(dt: number): void {
    this.state.players.forEach((player) => {
      // Open the augment draft for any signature pick that doesn't have one yet (server-authoritative roll).
      if (player.sigPending > 0 && !player.sigOffer) {
        player.sigOffer = draftAugments(Math.random).join(",");
      }
      if (!this.inLevelWindow(player)) return;
      player.flexTimer -= dt;
      if (player.flexTimer > 0) return;
      // Timed out → auto-resolve one pending pick of each kind, then refresh/close the window.
      if (player.flexPending > 0) {
        allocate(player, M0_CLASS_ATTR, 1); // default the flex point to the class attr
        player.flexPending = Math.max(0, player.flexPending - 1);
      }
      if (player.sigPending > 0) {
        const first = player.sigOffer.split(",").filter(Boolean)[0];
        if (first) player.augments = player.augments ? `${player.augments},${first}` : first;
        player.sigPending = Math.max(0, player.sigPending - 1);
        player.sigOffer = "";
      }
      player.flexTimer = this.inLevelWindow(player) ? LEVELUP_WINDOW_SECONDS : 0;
    });
  }

  /** §16 v0.109 run the active boss's data-driven controller (replaces the hardcoded OLD RUST machine). It
   *  owns the boss's movement + phase escalation + telegraphed attacks; the GameRoom only wires the emit
   *  sink (projectiles/AoE/zones/adds/telegraphs) so hit + damage plumbing stays here. When the boss is
   *  gone (killed/removed), tears down: null the controller, clear its telegraphs, blank the synced label. */
  private stepBoss(dt: number, bodies: Vec2[]): void {
    if (!this.bossId || !this.bossController) {
      if (this.state.bossPhase !== 0) this.state.bossPhase = 0;
      return;
    }
    const boss = this.state.enemies.get(this.bossId);
    if (!boss) {
      this.clearBoss();
      return;
    }
    this.state.bossPhase = this.bossController.step(
      dt,
      boss,
      bodies,
      this.state.depth,
      this.state.tick,
      this.bossSink,
    );
  }

  /** Tear down the active boss: dispose the controller (removes its in-flight telegraphs), reset the synced
   *  boss fields. Called when the boss dies/vanishes or the run restarts. */
  private clearBoss(): void {
    this.bossController?.dispose(this.bossSink);
    this.bossController = null;
    this.bossId = null;
    this.bossAddIds.clear();
    this.state.bossPhase = 0;
    this.state.bossKind = "";
    this.state.bossSlamT = 0; // §16 deprecated slam scalars stay at 0
    this.state.telegraphs.clear();
  }

  /** §16 v0.109 the emit surface handed to the BossController — turns a boss def's abstract "casts" into real
   *  sim: hostile projectiles, telegraph rows, corrosive zones, adds, and unparryable AoE. Built once, lazily. */
  private get bossSink(): BossEmitSink {
    if (!this._bossSink) {
      this._bossSink = {
        fireProjectile: (x, y, aimX, aimY, speed, damage) =>
          this.fireProjectile({ x, y }, { x: x + aimX, y: y + aimY }, speed, damage),
        addTelegraph: (spec) => {
          const t = new TelegraphState();
          t.id = `tg${this.telegraphSeq++}`;
          t.shape = spec.shape;
          t.x = spec.x;
          t.y = spec.y;
          t.a = spec.a ?? 0;
          t.b = spec.b ?? 0;
          t.rot = spec.rot ?? 0;
          t.t = 0;
          t.danger = spec.danger ?? 1;
          t.kindTag = spec.kindTag ?? 0;
          this.state.telegraphs.set(t.id, t);
          return t.id;
        },
        setTelegraphProgress: (id, t) => {
          const row = this.state.telegraphs.get(id);
          if (row) row.t = t;
        },
        removeTelegraph: (id) => this.state.telegraphs.delete(id),
        updateTelegraphGeom: (id, x, y, a, b, rot) => {
          const row = this.state.telegraphs.get(id);
          if (row) {
            row.x = x;
            row.y = y;
            row.a = a;
            row.b = b;
            row.rot = rot;
          }
        },
        damageRect: (x, y, len, halfW, rot, damage, knockback) =>
          this.damageBeamRect(x, y, len, halfW, rot, damage, knockback),
        damageAnnulus: (cx, cy, bandR, bandHalf, gapCenter, gapHalf, damage) =>
          this.damageRingBand(cx, cy, bandR, bandHalf, gapCenter, gapHalf, damage),
        dropZone: (x, y, radius, ttl) => this.dropBossZone(x, y, radius, ttl),
        spawnAdds: (kind, spots) => {
          for (const s of spots) this.spawnBossAddAt(kind, s.x, s.y);
        },
        applyAoE: (x, y, radius, damage, knockback) =>
          this.applyBossAoE(x, y, radius, damage, knockback),
        applyMelee: (x, y, aimX, aimY, range, halfArc, damage, knockback) =>
          this.applyBossMelee(x, y, aimX, aimY, range, halfArc, damage, knockback),
        moveBoss: (x, y) => {
          const boss = this.bossId ? this.state.enemies.get(this.bossId) : undefined;
          if (boss) {
            boss.x = x;
            boss.y = y;
          }
        },
        hostileProjectiles: () => {
          let n = 0;
          this.state.projectiles.forEach((p) => {
            if (p.hostile) n++;
          });
          return n;
        },
        aliveAdds: () => {
          for (const id of [...this.bossAddIds]) {
            if (!this.state.enemies.has(id)) this.bossAddIds.delete(id);
          }
          return this.bossAddIds.size;
        },
      };
    }
    return this._bossSink;
  }

  /** §16/§15 v0.113 create a synced telegraph row (used by boss casts AND enemy leaps). Returns its id. */
  private addTelegraphRow(
    shape: number,
    x: number,
    y: number,
    a: number,
    danger: number,
    kindTag: number,
  ): string {
    const t = new TelegraphState();
    t.id = `tg${this.telegraphSeq++}`;
    t.shape = shape;
    t.x = x;
    t.y = y;
    t.a = a;
    t.b = 0;
    t.rot = 0;
    t.t = 0;
    t.danger = danger;
    t.kindTag = kindTag;
    this.state.telegraphs.set(t.id, t);
    return t.id;
  }

  /** Set a telegraph row's fill progress 0→1. */
  private setTelegraphRowProgress(id: string, prog: number): void {
    const row = this.state.telegraphs.get(id);
    if (row) row.t = prog;
  }

  /** Remove a telegraph row (the client edge-fires its impact VFX if it had filled). */
  private removeTelegraphRow(id: string): void {
    this.state.telegraphs.delete(id);
  }

  /** §16 an unparryable radius AoE (the generalised punch-slam): flat damage + a hard radial knockback to
   *  every living player inside. `damage` arrives already depth-scaled from the controller. */
  private applyBossAoE(
    x: number,
    y: number,
    radius: number,
    damage: number,
    knockback: number,
  ): void {
    const r2 = radius * radius;
    this.state.players.forEach((p) => {
      if (!p.alive || this.inLevelWindow(p)) return;
      const dx = p.x - x;
      const dy = p.y - y;
      if (dx * dx + dy * dy > r2) return;
      p.hp -= damage; // §16 unparryable — dodge it, don't block it
      const d = Math.hypot(dx, dy) || 1;
      const k = addImpulse(p, (dx / d) * knockback, (dy / d) * knockback);
      p.vx = k.vx;
      p.vy = k.vy;
    });
  }

  /** §16 v0.109 Slice 2 — damage every living player inside an oriented rect (a beam / dash lane). `damage`
   *  is ALREADY the per-tick depth-scaled amount. `knockback` (dash) shoves them PERPENDICULAR out of the lane. */
  private damageBeamRect(
    x: number,
    y: number,
    len: number,
    halfW: number,
    rot: number,
    damage: number,
    knockback: number,
  ): void {
    const nx = -Math.sin(rot); // lane-perpendicular unit
    const ny = Math.cos(rot);
    this.state.players.forEach((p) => {
      if (!p.alive || this.inLevelWindow(p)) return;
      if (!pointInOrientedRect(p.x, p.y, x, y, len, halfW, rot)) return;
      p.hp -= damage;
      if (knockback > 0) {
        const side = (p.x - x) * nx + (p.y - y) * ny >= 0 ? 1 : -1; // shove to the side they're already on
        const k = addImpulse(p, nx * side * knockback, ny * side * knockback);
        p.vx = k.vx;
        p.vy = k.vy;
      }
    });
  }

  /** §16 v0.109 Slice 2 — damage every living player in an expanding ring's danger band (outside the safe
   *  gap wedge). `damage` is the per-tick depth-scaled amount. */
  private damageRingBand(
    cx: number,
    cy: number,
    bandR: number,
    bandHalf: number,
    gapCenter: number,
    gapHalf: number,
    damage: number,
  ): void {
    this.state.players.forEach((p) => {
      if (!p.alive || this.inLevelWindow(p)) return;
      if (!pointInAnnulusGap(p.x, p.y, cx, cy, bandR, bandHalf, gapCenter, gapHalf)) return;
      p.hp -= damage;
    });
  }

  /** §16 drop a corrosive DoT puddle (reuses ZoneState + the zoner DoT machinery) at a boss-authored spot. */
  private dropBossZone(x: number, y: number, radius: number, ttl: number): void {
    const zone = new ZoneState();
    zone.id = `z${this.zoneSeq++}`;
    zone.x = x;
    zone.y = y;
    zone.radius = radius;
    this.state.zones.set(zone.id, zone);
    this.zoneMeta.set(zone.id, ttl); // §15 zoneMeta stores the remaining TTL as a plain number
  }

  /** §16 conjure one boss ADD at a telegraphed spot (HP scaled to living count × depth), tracked so the
   *  add-cap counts only boss-summoned adds. Lands on solid ground clear of POIs. */
  private spawnBossAddAt(kindId: string, x: number, y: number): void {
    const kind = ENEMY_KINDS[kindId];
    if (!kind) return;
    const players = this.livingCount(); // §6 scale adds to who can fight, not who's connected
    const e = new EnemyState();
    e.id = `e${this.enemySeq++}`;
    e.kind = kindId;
    e.hp = kind.hp * enemyHpScale(players) * depthHpScale(this.state.depth);
    const sp = safeSpawnPos(
      this.map,
      clamp(x, kind.radius, ARENA_WIDTH - kind.radius),
      clamp(y, kind.radius, ARENA_HEIGHT - kind.radius),
      kind.radius,
    );
    e.x = sp.x;
    e.y = sp.y;
    this.state.enemies.set(e.id, e);
    this.bossAddIds.add(e.id);
  }

  /** Spitters fire a projectile at the nearest living player on a cooldown (§15 ranged threat). */
  private stepSpitters(dt: number, bodies: Vec2[]): void {
    // Prune cooldowns for enemies that have died/left.
    for (const id of [...this.enemyFireCd.keys()]) {
      if (!this.state.enemies.has(id)) this.enemyFireCd.delete(id);
    }
    this.state.enemies.forEach((enemy, id) => {
      if (id === this.bossId) return; // §16 the boss fires via stepBoss (phase patterns), not the generic spit
      const ranged = ENEMY_KINDS[enemy.kind]?.ranged;
      if (!ranged) return;
      let cd = this.enemyFireCd.get(id);
      if (cd === undefined) {
        // Stagger the first shot so a freshly-spawned cluster doesn't volley in unison.
        this.enemyFireCd.set(id, Math.random() * ranged.cooldown);
        return;
      }
      cd -= dt;
      if (cd > 0) {
        this.enemyFireCd.set(id, cd);
        return;
      }
      const target = nearestPoint(enemy, bodies);
      if (target && Math.hypot(target.x - enemy.x, target.y - enemy.y) <= ranged.range) {
        const dmg =
          ranged.damage *
          (enemy.tough ? TOUGH_DAMAGE_MULT : 1) *
          depthDamageScale(this.state.depth);
        if (ranged.spread && ranged.spread.count > 1) {
          // §15 Gatlin shotgun: fan a cone of pellets toward the target in one volley.
          const base = Math.atan2(target.y - enemy.y, target.x - enemy.x);
          for (const ang of coneAngles(base, ranged.spread.count, ranged.spread.arc)) {
            this.fireProjectile(
              enemy,
              { x: enemy.x + Math.cos(ang), y: enemy.y + Math.sin(ang) },
              ranged.projectileSpeed,
              dmg,
            );
          }
        } else {
          this.fireProjectile(enemy, target, ranged.projectileSpeed, dmg);
        }
        this.enemyFireCd.set(id, ranged.cooldown);
      } else {
        // No target in range — stay primed so it fires the instant a player steps into range.
        this.enemyFireCd.set(id, 0);
      }
    });
  }

  private fireProjectile(
    from: Vec2,
    to: Vec2,
    speed: number,
    damage: number,
    hostile = true,
    kind = "spit",
    pierce = 1,
    ttl = PROJECTILE_TTL,
    explode?: { radius: number; damage: number },
    bounces = 0,
  ): void {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    const pr = new ProjectileState();
    pr.id = `p${this.projectileSeq++}`;
    pr.kind = kind;
    pr.hostile = hostile;
    pr.x = from.x;
    pr.y = from.y;
    pr.vx = (dx / len) * speed;
    pr.vy = (dy / len) * speed;
    pr.explodeR = explode?.radius ?? 0; // §14 WYSIWYG: client renders a blast of exactly this radius
    this.state.projectiles.set(pr.id, pr);
    this.projectileMeta.set(pr.id, {
      ttl,
      damage,
      hostile,
      pierce,
      hit: new Set(),
      explode,
      bounces,
      pierceMax: pierce,
      legTtl: ttl,
    });
  }

  /** §9/§15 fire a GUN — spend one ammo to launch `pellets` friendly bullets down-barrel (a cone for
   *  shotguns / a touch of inaccuracy for autos), each WYSIWYG-scaled, piercing/bouncing/exploding per
   *  the gun's block. Ammo + reload are handled by the caller (mirrors the thrown charge model). */
  private fireGun(player: PlayerState, c: CombatState, weapon: WeaponDef): void {
    const g = weapon.gun;
    if (!g) return;
    const dmg = g.damage * this.heldDamageMult(weapon, g.scalingGrades, player);
    const explode = g.explode
      ? {
          radius: g.explode.radius,
          damage:
            g.explode.damage *
            this.heldDamageMult(weapon, g.explode.scalingGrades ?? g.scalingGrades, player),
        }
      : undefined;
    const pellets = Math.max(1, g.pellets ?? 1);
    const spread = g.spread ?? 0;
    const baseAng = Math.atan2(c.aimY, c.aimX);
    const ttl = g.range / g.projectileSpeed;
    // §9 spawn from the BARREL TIP (player centre + aim × the gun's own muzzle reach), not the body. Scale
    // by the holder's rig size (§7) so the shot lands exactly on the rendered tip, not short of it.
    const reach = gunMuzzleReach(weapon); // §29 fixed-size weapon → fixed muzzle reach
    const mx = player.x + c.aimX * reach;
    const my = player.y + c.aimY * reach;
    for (let i = 0; i < pellets; i++) {
      // Shotguns fan evenly across the cone; single-shot guns jitter within their inaccuracy.
      const ang =
        pellets > 1
          ? baseAng + (i / (pellets - 1) - 0.5) * 2 * spread
          : baseAng + (Math.random() - 0.5) * 2 * spread;
      this.fireProjectile(
        { x: mx, y: my },
        { x: mx + Math.cos(ang), y: my + Math.sin(ang) },
        g.projectileSpeed,
        dmg,
        false,
        g.bulletKind,
        g.pierce ?? 1,
        ttl,
        explode,
        g.bounces ?? 0,
      );
    }
    // §20 RECOIL pushback (Stage A): the shot kicks the body BACKWARD along aim, scaled by the gun's
    // authored `recoil` (which already differentiates a heavy revolver from a light gatling). Per-shot,
    // so a slow heavy gun punches once while a gatling stream accumulates a steady shove (capped).
    const kick = GUN_RECOIL_IMPULSE * ((g.recoil ?? GUN_RECOIL_BASELINE) / GUN_RECOIL_BASELINE);
    const r = addImpulse(player, -c.aimX * kick, -c.aimY * kick);
    player.vx = r.vx;
    player.vy = r.vy;
  }

  /** Hurl a thrown weapon at the player's aim — a friendly, STR-scaled, piercing projectile (§10). */
  private throwWeapon(player: PlayerState, c: CombatState, weapon: WeaponDef): void {
    const t = weapon.thrown;
    if (!t) return;
    const dmg = t.damage * this.heldDamageMult(weapon, t.scalingGrades, player); // §14 source grades × §11 req penalty
    const ttl = t.range / t.speed;
    this.fireProjectile(
      { x: player.x, y: player.y },
      { x: player.x + c.aimX, y: player.y + c.aimY },
      t.speed,
      dmg,
      false,
      "cleaver",
      t.pierce,
      ttl,
    );
  }

  /** §14 scatter shot — fling `count` REAL magma projectiles in a cone toward aim. Each is a WYSIWYG
   *  damage source: an INT-scaled direct hit plus, on death, an INT-scaled explosion (both baked here
   *  from the player's attributes at swing time). Cone/speed/range/blast radius are FIXED (§14). */
  private fireScatter(player: PlayerState, c: CombatState, weapon: WeaponDef): void {
    const sc = weapon.scatter;
    if (!sc) return;
    const ballDmg = sc.damage * this.heldDamageMult(weapon, sc.scalingGrades, player);
    const pierce = sc.pierce ?? 1;
    // The blast inherits the scatter's grades unless it overrides them; bake its damage once here.
    const explode = sc.explode
      ? {
          radius: sc.explode.radius,
          damage:
            sc.explode.damage *
            this.heldDamageMult(weapon, sc.explode.scalingGrades ?? sc.scalingGrades, player),
        }
      : undefined;
    const baseAng = Math.atan2(c.aimY, c.aimX);
    for (let i = 0; i < sc.count; i++) {
      // Fan evenly across the cone, plus a little angle + speed jitter so the cluster reads organic.
      // (Server-authoritative: the client renders the synced positions, so this RNG is purely cosmetic.)
      const spread = sc.count > 1 ? (i / (sc.count - 1) - 0.5) * 2 * sc.spread : 0;
      const ang = baseAng + spread + (Math.random() - 0.5) * 0.12;
      const spd = sc.speed * (0.85 + Math.random() * 0.3);
      this.fireProjectile(
        { x: player.x, y: player.y },
        { x: player.x + Math.cos(ang), y: player.y + Math.sin(ang) },
        spd,
        ballDmg,
        false,
        "magma",
        pierce,
        sc.range / spd, // expire after travelling ~range (then explode)
        explode,
      );
    }
  }

  /** Apply `raw` damage to one enemy, folding in the §8 Brand multiplier, then do the shared kill/XP/portal
   *  bookkeeping (dummy reset · boss portal · ronin drop). Pushes the id to `kills` on death (the caller
   *  deletes after iterating). Returns XP earned (0 if it survived or was a dummy). The single damage
   *  primitive so Brand + drops + XP stay consistent across every source (swing / blast / projectile / wave). */
  private damageEnemy(enemy: EnemyState, eid: string, raw: number, kills: string[]): number {
    enemy.hp -= raw * (enemy.branded > 0 ? BRAND_DAMAGE_MULT : 1);
    if (enemy.hp > 0) return 0;
    if (enemy.kind === "dummy") {
      enemy.hp = DUMMY_HP;
      return 0;
    }
    const kind = ENEMY_KINDS[enemy.kind];
    if (kind?.archetype === "boss") {
      // §16 v0.109 tear the boss down HERE (the death path): dispose the controller + clear any in-flight
      // telegraph rows before opening the portal. Otherwise a boss killed mid-windup leaves orphaned
      // telegraphs (never resolved) + a leaked controller — stepBoss early-returns once bossId is null and
      // never reaches its own cleanup. clearBoss is idempotent + also nulls bossId / blanks bossKind.
      if (enemy.id === this.bossId) this.clearBoss();
      if (this.state.mode === "bossrush") {
        // §16 v0.116 the gauntlet: heal + reward + queue the next boss (or win on the last).
        this.advanceBossRush(enemy.x, enemy.y);
      } else {
        this.openPortal(enemy.x, enemy.y);
        // §13 "no guaranteed weapon drops EXCEPT bosses" — with a heavy tier bonus on the rarity table
        // (§13 "tier affects drop rate AND rarity"), so the capstone drop rarely lands Common. ARENA-only:
        // a debug-summoned Testing-Grounds boss must never mint carryable loot (adversarial-verify — the
        // training reroll-laundering exploit).
        if (this.state.mode === "arena") this.dropLoot(enemy.x, enemy.y, 1, LOOT_TIER_LUK_BOSS);
      }
    }
    // §6/§17 v0.103: putting DOWN a shifter incursion (instead of just outlasting its window) pays the
    // squad a depth-scaled bounty — the chain's second wage source, and it rewards engaging the elite.
    if (kind?.shifter) {
      const bounty = SHIFTER_SALVAGE_PER_DEPTH * this.state.depth;
      this.state.players.forEach((p) => {
        if (p.alive) p.salvaged += bounty;
      });
    } else if (kind?.archetype !== "boss" && this.state.mode === "arena" && !this.bossId) {
      // §13 v0.104: ANY enemy can drop — tier drives the rate AND up-weights the rarity table (toughs
      // roll richer). SUPPRESSED while the boss is ALIVE: without that, kiting an unkilled boss makes
      // the pre-portal arena an unbounded salvage farm (adversarial-verify) — kill it to loot again.
      this.dropLoot(
        enemy.x,
        enemy.y,
        enemy.tough ? DROP_CHANCE_TOUGH : DROP_CHANCE_TRASH,
        enemy.tough ? LOOT_TIER_LUK_TOUGH : 0,
      );
    }
    this.maybeDropWeapon(enemy); // §13 wielding enemies drop the SPECIFIC weapon they carry
    kills.push(eid);
    return (kind?.xpValue ?? 0) * (enemy.tough ? TOUGH_XP_MULT : 1);
  }

  /** §7 v0.105 zero a player's persistent steering velocity — call at every position TELEPORT (pit
   *  snap-back, rift descent, restart, training reposition, revive) so carried momentum can't glide the
   *  body away from where it was authoritatively placed. §4 v0.107: also DROPS the queued/held input
   *  direction (a teleport must not replay stale pre-teleport intent; the next command lands ≤50ms later),
   *  mirrors the zeroed velocity to synced state, and bumps `teleportSeq` — the ONE hard-resync signal the
   *  predicting client watches, so every current and future teleport site is covered by construction. */
  private zeroMoveVel(id: string): void {
    const inp = this.inputs.get(id);
    if (inp) {
      inp.mvx = 0;
      inp.mvy = 0;
      inp.queue.length = 0;
      inp.held = { seq: inp.held.seq, dx: 0, dy: 0, jump: false };
    }
    const player = this.state.players.get(id);
    if (player) {
      player.mvx = 0;
      player.mvy = 0;
      player.teleportSeq = (player.teleportSeq + 1) >>> 0;
    }
  }

  /** §11/§13 the squad's best LUK — loot is squad-shared, so the luckiest living drifter carries the
   *  rarity table for every roll. */
  private bestLuk(): number {
    let best = 1;
    this.state.players.forEach((p) => {
      if (p.alive && p.luk > best) best = p.luk;
    });
    return best;
  }

  /** §13 v0.104 roll an in-run MYSTERY loot drop at (x,y) with the given chance: identity from the
   *  power-banded DROP_POOL; rarity from squad-best LUK (§11) plus the killer's TIER bonus (§13 "tier
   *  affects drop rate AND rarity"); the single §10 affix rolled here-and-now. The pickup telegraphs
   *  type + rarity but hides WHICH weapon until grabbed (mystery dopamine); cursed reads ghostly purple. */
  private dropLoot(x: number, y: number, chance: number, tierLukBonus = 0): void {
    if (chance < 1 && Math.random() > chance) return;
    const pk = new PickupState();
    pk.id = `drop${this.pickupSeq++}`;
    pk.weapon = rollDropWeapon(Math.random());
    pk.rarity = rollRarity(Math.random(), this.bestLuk() + tierLukBonus);
    pk.affix = rollAffix(Math.random(), pk.rarity).id;
    pk.known = false;
    const sp = this.placePickupPos(x, y);
    pk.x = sp.x;
    pk.y = sp.y;
    this.state.pickups.set(pk.id, pk);
    this.earnedPickups.add(pk.id); // a loot drop is EARNED — it carries §13 salvage value
  }

  /** §29 place a dropped pickup on solid ground: the BELT deck (clamped into the depth band, nudged off any
   *  pit gap) in belt mode, else the procgen arena's safe-spawn nudge. Keeps loot grabbable, never in a pit
   *  or off the walkable floor. */
  private placePickupPos(x: number, y: number): { x: number; y: number } {
    if (this.belt && this.beltLevel) {
      const bx = beltSafeX(this.beltLevel, x, x);
      return { x: bx, y: clampBeltFloorY(this.beltLevel, bx, y, PICKUP_RADIUS) };
    }
    return safeSpawnPos(this.map, x, y, PICKUP_RADIUS);
  }

  /** Apply an AoE blast at (x,y): damage every enemy within `radius`, with the same kill/XP/portal
   *  bookkeeping as a swing hit. Used by the scatter-shot magma explosions (§14). */
  private detonate(x: number, y: number, radius: number, damage: number): void {
    const r2 = radius * radius;
    const kills: string[] = [];
    let xpGained = 0;
    this.state.enemies.forEach((enemy, eid) => {
      const dx = enemy.x - x;
      const dy = enemy.y - y;
      if (dx * dx + dy * dy > r2) return;
      xpGained += this.damageEnemy(enemy, eid, damage, kills);
    });
    for (const eid of kills) this.state.enemies.delete(eid);
    if (xpGained > 0) this.grantXp(xpGained);
  }

  /** §8 Emberguard fire wave — a cone of fire in front of `aim` (origin at the player), `dmg` to each enemy
   *  inside, kill bookkeeping via `damageEnemy`. The shared primitive for the on-parry wave AND the
   *  Conflagration re-pulse. */
  private emberguardWave(x: number, y: number, aimX: number, aimY: number, dmg: number): void {
    const kills: string[] = [];
    let xpGained = 0;
    this.state.enemies.forEach((enemy, eid) => {
      if (inMeleeArc({ x, y }, aimX, aimY, enemy, EMBERGUARD_RANGE, EMBERGUARD_HALF_ARC)) {
        xpGained += this.damageEnemy(enemy, eid, dmg, kills);
      }
    });
    for (const eid of kills) this.state.enemies.delete(eid);
    if (xpGained > 0) this.grantXp(xpGained);
  }

  /** §7/§8 execute a parry — grant i-frames, knock nearby enemies back, and fire the owned augments. Split
   *  out of the message handler (v0.105 de-clunk) so a BUFFERED parry (one that arrived during the cooldown)
   *  can fire from the tick the instant the cd drains, not just synchronously on message arrival. */
  private executeParry(player: PlayerState, c: CombatState): void {
    // §8 Iron Stance (stacks): wider i-frame window + bigger knockback.
    const iron = countAugment(player.augments, "iron-stance");
    c.invuln = Math.max(c.invuln, PARRY_IFRAMES * (1 + IRON_STANCE_IFRAME_PER * iron));
    c.parryCd = PARRY_COOLDOWN;
    const knockback = PARRY_KNOCKBACK * (1 + IRON_STANCE_KNOCKBACK_PER * iron);
    const r2 = PARRY_RADIUS * PARRY_RADIUS;
    this.state.enemies.forEach((enemy) => {
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > 0 && d2 <= r2) {
        const d = Math.sqrt(d2);
        enemy.x = clamp(enemy.x + (dx / d) * knockback, ENEMY_RADIUS, ARENA_WIDTH - ENEMY_RADIUS);
        enemy.y = clamp(enemy.y + (dy / d) * knockback, ENEMY_RADIUS, ARENA_HEIGHT - ENEMY_RADIUS);
      }
    });
    this.applyParryAugments(player, c);
  }

  /** §8 apply the player's owned parry AUGMENTS on a successful parry (Iron Stance is handled at the call
   *  site since it scales the base i-frames/knockback). Each augment is small + stacks; the pool builds a
   *  custom parry per run. Offense here is server-authoritative (the client renders off the synced effects). */
  private applyParryAugments(player: PlayerState, c: CombatState): void {
    const owned = player.augments;
    if (!owned) return;
    const now = this.state.elapsed;

    // Aegis — Second Wind (stacks): heal a CON-scaled sliver. Bulwark: a brief absorb shield.
    const sw = countAugment(owned, "second-wind");
    if (sw > 0) {
      const heal = sw * (SECOND_WIND_BASE + SECOND_WIND_PER_CON * Math.max(0, player.con - 1));
      player.hp = Math.min(player.maxHp, player.hp + heal);
    }
    // Bulwark POC: a 1.5s absorb modelled as extended i-frames (full negate for the window). A true
    // absorb-amount shield is a polish follow-up.
    if (hasAugment(owned, "bulwark")) c.invuln = Math.max(c.invuln, BULWARK_SHIELD);

    // Riposte — Counterblade + Twin Fang (each = +1 projectile) + Hair-Trigger (consecutive parries add one).
    let projectiles = countAugment(owned, "counterblade") + countAugment(owned, "twin-fang");
    if (hasAugment(owned, "hair-trigger")) {
      c.hairStreak =
        now - c.lastParryAt <= HAIRTRIGGER_WINDOW ? Math.min(HAIRTRIGGER_MAX, c.hairStreak + 1) : 1;
      projectiles += c.hairStreak;
    }
    c.lastParryAt = now;
    if (projectiles > 0) {
      const baseAng = Math.atan2(c.aimY, c.aimX);
      for (const ang of coneAngles(baseAng, projectiles, AUG_PROJECTILE_SPREAD)) {
        this.fireProjectile(
          { x: player.x, y: player.y },
          { x: player.x + Math.cos(ang), y: player.y + Math.sin(ang) },
          AUG_PROJECTILE_SPEED,
          AUG_PROJECTILE_DAMAGE,
          false,
          "counter",
          AUG_PROJECTILE_PIERCE,
        );
      }
    }

    // Hex — Brand (mark nearby enemies), Emberguard (fire wave), Conflagration (a deferred re-pulse).
    if (hasAugment(owned, "brand")) {
      const r2 = PARRY_RADIUS * PARRY_RADIUS;
      this.state.enemies.forEach((enemy) => {
        const dx = enemy.x - player.x;
        const dy = enemy.y - player.y;
        if (dx * dx + dy * dy <= r2) enemy.branded = BRAND_DURATION;
      });
    }
    if (hasAugment(owned, "emberguard")) {
      const dmg = EMBERGUARD_BASE_DMG + EMBERGUARD_PER_INT * Math.max(0, player.int - 1);
      this.emberguardWave(player.x, player.y, c.aimX, c.aimY, dmg);
      if (hasAugment(owned, "conflagration")) {
        this.burnPulses.push({
          x: player.x,
          y: player.y,
          aimX: c.aimX,
          aimY: c.aimY,
          dmg,
          at: now + CONFLAG_DELAY,
        });
      }
    }
  }

  /** §15 duelists (ronin): close to `melee.approach`, telegraph `windup`, then swing `hits` times (each
   *  an arc hit toward the nearest player), then `recover`. Movement + the combo state machine. */
  private stepDuelists(dt: number, bodies: Vec2[]): void {
    for (const id of [...this.comboState.keys()]) {
      if (!this.state.enemies.has(id)) {
        const dead = this.comboState.get(id);
        if (dead?.tg) this.removeTelegraphRow(dead.tg); // §15 v0.113 a leaper killed mid-leap: clear its marker
        this.comboState.delete(id);
      }
    }
    this.state.enemies.forEach((enemy, id) => {
      const kind = ENEMY_KINDS[enemy.kind];
      // §20 every contact monster lunges: an explicit duelist combo, or a derived single-hit lunge for
      // rusher/swarm/zoner (so the attack telegraphs + is parryable). Spitters/boss/dummies → no lunge.
      const m = effectiveMelee(kind);
      if (!m || !kind) return;
      const target = nearestPoint(enemy, bodies);
      let st = this.comboState.get(id);
      if (!st) {
        st = { phase: "idle", t: 0, hits: 0, wind: 0 };
        this.comboState.set(id, st);
      }
      const dist = target
        ? Math.hypot(target.x - enemy.x, target.y - enemy.y)
        : Number.POSITIVE_INFINITY;
      // Move toward the target only while idle + out of reach; the combo advances via LUNGES (below).
      if (st.phase === "idle" && target && dist > m.approach) {
        const next = stepEnemyChase({ x: enemy.x, y: enemy.y }, target, kind.speed, dt);
        enemy.x = next.x;
        enemy.y = next.y;
      }
      // §20 Sekiro lean-in: creep slowly forward DURING a windup so the wind-up reads as "stepping into it".
      if (st.phase === "windup" && target && dist > m.range * 0.45) {
        const next = stepEnemyChase({ x: enemy.x, y: enemy.y }, target, kind.speed * 0.28, dt);
        enemy.x = next.x;
        enemy.y = next.y;
      }
      st.t -= dt;
      const leap = kind.leap;
      if (st.phase === "idle") {
        st.leapCd = Math.max(0, (st.leapCd ?? 0) - dt);
        if (leap && target && (st.leapCd ?? 0) <= 0 && dist > m.approach && dist <= leap.range) {
          // §15 v0.113 LEAP: commit — telegraph a red landing marker ON the target (announcing the combo),
          // then vault there and flurry on landing. Clear the marker or eat it.
          st.lx = target.x;
          st.ly = target.y;
          st.tg = this.addTelegraphRow(0, st.lx, st.ly, m.range, 1, 2); // circle · dodge-red · light-poof land
          st.phase = "leapwind";
          st.t = leap.windup;
        } else if (target && dist <= m.approach) {
          st.phase = "windup"; // begin the first telegraphed strike
          st.hits = m.hits;
          st.wind = m.windup;
          st.t = m.windup;
        }
      } else if (st.phase === "leapwind") {
        // Winding up the leap in place — fill the landing marker so the dodge window reads.
        if (st.tg && leap)
          this.setTelegraphRowProgress(st.tg, Math.max(0, Math.min(1, 1 - st.t / leap.windup)));
        if (st.t <= 0) {
          st.phase = "leap";
          st.t = leap?.airTime ?? 0.28;
        }
      } else if (st.phase === "leap") {
        // Airborne: cover the remaining distance to the landing spot over the remaining air time.
        if (st.lx !== undefined && st.ly !== undefined) {
          const dx = st.lx - enemy.x;
          const dy = st.ly - enemy.y;
          const d = Math.hypot(dx, dy) || 1;
          const remain = Math.max(dt, st.t + dt); // distance ÷ time-left = the speed to arrive on schedule
          const stepD = Math.min(d, (d / remain) * dt);
          const r = kind.radius;
          enemy.x = clamp(enemy.x + (dx / d) * stepD, r, ARENA_WIDTH - r);
          enemy.y = clamp(enemy.y + (dy / d) * stepD, r, ARENA_HEIGHT - r);
        }
        if (st.t <= 0) {
          if (st.tg) {
            this.removeTelegraphRow(st.tg);
            st.tg = undefined;
          }
          st.leapCd = leap?.cooldown ?? 3;
          st.phase = "windup"; // LAND → the combo begins
          st.hits = m.hits;
          st.wind = m.windup;
          st.t = m.windup;
        }
      } else if (st.phase === "windup") {
        if (st.t <= 0) {
          // Strike: LUNGE forward (capped so it stops at sword's length, never stacks on the player), swing,
          // then either telegraph the next hit (swingGap) or recover.
          this.duelistLunge(enemy, target, m, dist);
          this.duelistSwing(enemy, id, target, m);
          st.hits -= 1;
          if (st.hits > 0) {
            st.phase = "windup";
            st.wind = m.swingGap;
            st.t = m.swingGap;
          } else {
            st.phase = "recover";
            st.t = m.recover;
          }
        }
      } else if (st.t <= 0) {
        st.phase = "idle"; // recover done
      }
      // §8 white-tell TELEGRAPH (Stage C): every windup (the first AND each follow-up) ramps `windup` 0→1
      // so the client fills a white rhythm ring + whitens the enemy before EACH hit — a parryable beat.
      enemy.windup =
        st.phase === "windup" && st.wind > 0 ? Math.max(0, Math.min(1, 1 - st.t / st.wind)) : 0;
    });
  }

  /** §20 one duelist LUNGE: dash the enemy `m.step` px toward the target, but never inside `range×0.45`
   *  (it stays at sword's length so the advance reads as pressure, not a body-block stack). */
  private duelistLunge(
    enemy: EnemyState,
    target: Vec2 | null,
    m: { range: number; step: number },
    dist: number,
  ): void {
    if (!target || dist < 0.001) return;
    const floor = m.range * 0.45;
    const move = Math.max(0, Math.min(m.step, dist - floor));
    if (move <= 0) return;
    const dx = (target.x - enemy.x) / dist;
    const dy = (target.y - enemy.y) / dist;
    const r = ENEMY_KINDS[enemy.kind]?.radius ?? ENEMY_RADIUS;
    enemy.x = clamp(enemy.x + dx * move, r, ARENA_WIDTH - r);
    enemy.y = clamp(enemy.y + dy * move, r, ARENA_HEIGHT - r);
  }

  /** One duelist swing: bump `atkSeq` (client animates) + arc-damage players in front. A player whose parry
   *  i-frames are up has PARRIED the telegraphed attack (§8) — it's negated, the attacker is knocked back,
   *  and `parriedSeq` ticks the client's white parry flash. (The parry's augment offense already fired.) */
  private duelistSwing(
    enemy: EnemyState,
    enemyId: string,
    target: Vec2 | null,
    m: { range: number; halfArc: number; damage: number },
  ): void {
    enemy.atkSeq = (enemy.atkSeq + 1) % 100000;
    const aimX = target ? target.x - enemy.x : 1;
    const aimY = target ? target.y - enemy.y : 0;
    const dmgMul = enemy.tough ? TOUGH_DAMAGE_MULT : 1;
    this.state.players.forEach((player) => {
      if (!player.alive || this.inLevelWindow(player)) return;
      if (!inMeleeArc(enemy, aimX, aimY, player, m.range, m.halfArc)) return;
      const pc = this.combat.get(player.id);
      if (pc && pc.invuln > 0) {
        // §8 PARRIED — negate + punish + FLOW + the v0.114 chain reward (shared with the boss meleeCombo).
        this.resolveParry(player, pc, enemy, enemyId);
        return;
      }
      // §20 a clean (un-parried) hit lands with UMPH — damage + a knockback shove along the strike, so a
      // duelist combo visibly drives you back (and makes parrying the alternative feel earned).
      player.hp -= m.damage * dmgMul * depthDamageScale(this.state.depth);
      const hx = player.x - enemy.x;
      const hy = player.y - enemy.y;
      const hd = Math.hypot(hx, hy) || 1;
      const k = addImpulse(
        player,
        (hx / hd) * HIT_KNOCKBACK_IMPULSE,
        (hy / hd) * HIT_KNOCKBACK_IMPULSE,
      );
      player.vx = k.vx;
      player.vy = k.vy;
    });
  }

  /** §8 apply a SUCCESSFUL parry of a telegraphed melee strike: negate + punish + FLOW + the v0.114 chain
   *  reward. `attacker` is bump-knocked back; `attackerId` looks up its `comboState` for the high-chain
   *  STAGGER (a boss has no comboState entry → no stagger, which is correct — bosses aren't stunlockable).
   *  Shared by the horde duelist swing and the boss `meleeCombo` so the two parry paths can't drift. */
  private resolveParry(
    player: PlayerState,
    pc: CombatState,
    attacker: EnemyState,
    attackerId: string,
  ): void {
    player.parriedSeq = (player.parriedSeq + 1) % 100000;
    const dx = attacker.x - player.x;
    const dy = attacker.y - player.y;
    const d = Math.hypot(dx, dy) || 1;
    attacker.x = clamp(
      attacker.x + (dx / d) * PARRY_KNOCKBACK * 1.6,
      ENEMY_RADIUS,
      ARENA_WIDTH - ENEMY_RADIUS,
    );
    attacker.y = clamp(
      attacker.y + (dy / d) * PARRY_KNOCKBACK * 1.6,
      ENEMY_RADIUS,
      ARENA_HEIGHT - ENEMY_RADIUS,
    );
    // §8 flow: refresh the cooldown so the next swing can be parried immediately (chain), and §20 Stage D
    // LAUNCH the parrier (upward kick + a shove along the attack vector — chain to ride the flurry UP).
    pc.parryCd = Math.min(pc.parryCd, PARRY_CHAIN_CD);
    pc.vh = Math.min(pc.vh + PARRY_LAUNCH, PARRY_LAUNCH_MAX);
    const k = addImpulse(player, (-dx / d) * PARRY_PUSH, (-dy / d) * PARRY_PUSH);
    player.vx = k.vx;
    player.vy = k.vy;
    // §8 v0.114 PARRY COMBO: build the chain → heal a chain-scaled sliver, and at RIPOSTE_AT stagger the
    // parried attacker (if it runs the combo machine) + an extra shove.
    pc.parryChain = pc.parryChainT > 0 ? pc.parryChain + 1 : 1;
    pc.parryChainT = PARRY_CHAIN_WINDOW;
    player.hp = Math.min(
      player.maxHp,
      player.hp + PARRY_CHAIN_HEAL * Math.min(pc.parryChain, PARRY_CHAIN_HEAL_MAX_STACKS),
    );
    if (pc.parryChain >= PARRY_CHAIN_RIPOSTE_AT) {
      const est = this.comboState.get(attackerId);
      if (est) {
        est.phase = "recover";
        est.t = 1; // interrupt: a full second of stagger before it can attack again
        attacker.windup = 0;
      }
      attacker.x = clamp(
        attacker.x + (dx / d) * PARRY_KNOCKBACK,
        ENEMY_RADIUS,
        ARENA_WIDTH - ENEMY_RADIUS,
      );
      attacker.y = clamp(
        attacker.y + (dy / d) * PARRY_KNOCKBACK,
        ENEMY_RADIUS,
        ARENA_HEIGHT - ENEMY_RADIUS,
      );
    }
  }

  /** §16 Slice 3 — resolve a PARRYABLE boss melee wedge (the `meleeCombo` primitive). Mirrors the horde
   *  duelist swing: a player in the arc with parry i-frames PARRIES it (shared `resolveParry` reward),
   *  otherwise takes the (already depth-scaled) hit + a knockback shove along the strike. */
  private applyBossMelee(
    x: number,
    y: number,
    aimX: number,
    aimY: number,
    range: number,
    halfArc: number,
    damage: number,
    knockback: number,
  ): void {
    const origin = { x, y };
    const boss = this.bossId ? this.state.enemies.get(this.bossId) : undefined;
    this.state.players.forEach((player) => {
      if (!player.alive || this.inLevelWindow(player)) return;
      if (!inMeleeArc(origin, aimX, aimY, player, range, halfArc)) return;
      const pc = this.combat.get(player.id);
      if (pc && pc.invuln > 0) {
        if (boss && this.bossId) this.resolveParry(player, pc, boss, this.bossId);
        else player.parriedSeq = (player.parriedSeq + 1) % 100000; // no body to knock — still flash the parry
        return;
      }
      player.hp -= damage; // already depth-scaled by the controller
      const hx = player.x - x;
      const hy = player.y - y;
      const hd = Math.hypot(hx, hy) || 1;
      const kk = addImpulse(player, (hx / hd) * knockback, (hy / hd) * knockback);
      player.vx = kk.vx;
      player.vy = kk.vy;
    });
  }

  /** §13 weapon drop: when a wielding enemy dies, roll its `dropWeapon` chance → spawn a grabbable pickup. */
  private maybeDropWeapon(enemy: EnemyState): void {
    if (this.state.mode !== "arena") return; // debug-summoned wielders in training mint NO loot (verify)
    const kind = ENEMY_KINDS[enemy.kind];
    if (!kind?.wieldsWeapon || !kind.dropWeapon) return;
    if (Math.random() > kind.dropWeapon) return;
    const pk = new PickupState();
    pk.id = `drop${this.pickupSeq++}`;
    pk.weapon = kind.wieldsWeapon;
    // §13 the wielder's drop is identity-KNOWN (you saw the sword it swung) but its rarity/affix still
    // roll on drop (v0.104) — same squad-LUK table as the mystery channel (one rarity economy).
    pk.rarity = rollRarity(Math.random(), this.bestLuk());
    pk.affix = rollAffix(Math.random(), pk.rarity).id;
    const sp = this.placePickupPos(enemy.x, enemy.y);
    pk.x = sp.x;
    pk.y = sp.y;
    this.state.pickups.set(pk.id, pk);
    this.earnedPickups.add(pk.id); // §13 v0.103: an ENEMY drop is EARNED — it carries salvage value
  }

  /** Advance every projectile, expire at TTL/arena edge. HOSTILE projectiles hit players (parry-/
   *  level-immune); FRIENDLY (thrown) projectiles cut through enemies up to their pierce count. */
  private stepProjectiles(dt: number): void {
    const doomed: string[] = [];
    this.state.projectiles.forEach((pr, id) => {
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      const meta = this.projectileMeta.get(id);
      if (meta) meta.ttl -= dt;
      if (!meta || meta.ttl <= 0) {
        doomed.push(id);
        return;
      }
      const oob = pr.x < 0 || pr.x > ARENA_WIDTH || pr.y < 0 || pr.y > ARENA_HEIGHT;
      if (oob) {
        // §9 ricochet rounds CAROM off the arena walls; everything else expires at the edge. On each
        // carom the round RE-ARMS — fresh pierce, cleared hit-set (can re-tag enemies), refreshed life —
        // so it actually "keeps hunting" down the new leg.
        if ((meta.bounces ?? 0) > 0) {
          meta.bounces = (meta.bounces ?? 0) - 1;
          if (pr.x < 0 || pr.x > ARENA_WIDTH) pr.vx = -pr.vx;
          if (pr.y < 0 || pr.y > ARENA_HEIGHT) pr.vy = -pr.vy;
          pr.x = clamp(pr.x, 0, ARENA_WIDTH);
          pr.y = clamp(pr.y, 0, ARENA_HEIGHT);
          meta.hit.clear();
          meta.pierce = meta.pierceMax ?? meta.pierce;
          meta.ttl += meta.legTtl ?? 0;
        } else {
          doomed.push(id);
          return;
        }
      }
      // §17 POI COVER — a projectile that flies into a landmark is BLOCKED. A RICOCHET round (bounces left)
      // CAROMS off the landmark like a wall: reflect the velocity across the radial normal, snap to the
      // surface, and re-arm (fresh pierce/hit-set/life) so it keeps hunting. Everything else is ABSORBED
      // (exploding rounds detonate via the doomed loop). Cover works both ways — a landmark in YOUR line
      // eats your shots too.
      const hitPoi = poiAt(this.map, pr.x, pr.y);
      if (hitPoi) {
        if ((meta.bounces ?? 0) > 0) {
          meta.bounces = (meta.bounces ?? 0) - 1;
          const nx = pr.x - hitPoi.x;
          const ny = pr.y - hitPoi.y;
          const nl = Math.hypot(nx, ny) || 1;
          const ux = nx / nl;
          const uy = ny / nl;
          const dot = pr.vx * ux + pr.vy * uy;
          pr.vx -= 2 * dot * ux;
          pr.vy -= 2 * dot * uy;
          pr.x = hitPoi.x + ux * (poiRadius(hitPoi.kind) + PROJECTILE_RADIUS);
          pr.y = hitPoi.y + uy * (poiRadius(hitPoi.kind) + PROJECTILE_RADIUS);
          meta.hit.clear();
          meta.pierce = meta.pierceMax ?? meta.pierce;
          meta.ttl += meta.legTtl ?? 0;
        } else {
          doomed.push(id);
          return;
        }
      }
      if (meta.hostile) {
        let consumed = false; // the bullet is spent (landed a hit) → doom it
        let reflected = false; // …unless it was PARRIED — then it lives on as a friendly counter-shot
        this.state.players.forEach((player) => {
          if (consumed || !player.alive) return;
          const reach = PROJECTILE_RADIUS + PLAYER_RADIUS;
          const dx = pr.x - player.x;
          const dy = pr.y - player.y;
          if (dx * dx + dy * dy > reach * reach) return; // no overlap with this player
          // §12 level-up invincibility: the bullet phases harmlessly through (not a parry — no reflect).
          if (this.inLevelWindow(player)) return;
          const pc = this.combat.get(player.id);
          // §8 v0.117 PROJECTILE PARRY: a bullet caught inside the parry i-frame window is DEFLECTED into a
          // friendly counter-shot rocketed back at the horde — the block lands with UMPH, not a silent phase.
          if ((pc?.invuln ?? 0) > 0 && pc) {
            this.reflectProjectile(pr, meta, player, pc);
            reflected = true;
            consumed = true;
            return;
          }
          player.hp -= meta.damage;
          // §20 knockback (Stage A): a sharp bump along the bullet's travel direction.
          const sp = Math.hypot(pr.vx, pr.vy) || 1;
          const k = addImpulse(
            player,
            (pr.vx / sp) * HIT_KNOCKBACK_IMPULSE,
            (pr.vy / sp) * HIT_KNOCKBACK_IMPULSE,
          );
          player.vx = k.vx;
          player.vy = k.vy;
          consumed = true;
        });
        if (consumed && !reflected) doomed.push(id);
      } else {
        // Friendly throw: damage each fresh enemy it touches until pierce runs out.
        const kills: string[] = [];
        let xpGained = 0;
        this.state.enemies.forEach((enemy, eid) => {
          if (meta.pierce <= 0 || meta.hit.has(eid)) return;
          const reach = (ENEMY_KINDS[enemy.kind]?.radius ?? ENEMY_RADIUS) + PROJECTILE_RADIUS;
          const dx = pr.x - enemy.x;
          const dy = pr.y - enemy.y;
          if (dx * dx + dy * dy <= reach * reach) {
            meta.hit.add(eid);
            meta.pierce -= 1;
            // Route through the ONE damage primitive (Brand · dummy-reset · boss portal · drop · XP) so the
            // projectile path can't drift from the swing/blast path (was a hand-duplicated copy).
            xpGained += this.damageEnemy(enemy, eid, meta.damage, kills);
          }
        });
        for (const eid of kills) this.state.enemies.delete(eid);
        if (xpGained > 0) this.grantXp(xpGained);
        // Bouncing rounds survive a spent pierce — they re-arm on the next carom (above).
        if (meta.pierce <= 0 && (meta.bounces ?? 0) <= 0) doomed.push(id);
      }
    });
    for (const id of doomed) {
      const pr = this.state.projectiles.get(id);
      const meta = this.projectileMeta.get(id);
      // Detonate exploding projectiles (magma scatter) at their death position — §14 WYSIWYG.
      if (pr && meta?.explode) this.detonate(pr.x, pr.y, meta.explode.radius, meta.explode.damage);
      this.state.projectiles.delete(id);
      this.projectileMeta.delete(id);
    }
  }

  /** §8 v0.117 PROJECTILE PARRY — a hostile bullet caught in the i-frame window is DEFLECTED. Two modes:
   *  • BASE (no augment): it GLANCES off to the side and fades — like a round pinging off Superman. Pure
   *    defense, zero enemy damage, a brief spark (kind "deflect", short TTL).
   *  • `deflector` augment: it RICOCHETS BACK at the nearest enemy — a friendly counter-shot, boosted speed
   *    + damage (kind "counter"), the offensive upgrade.
   *  Either way it fires the parry reward (flash + heal + FLOW cd + chain build) so catching a spit chains
   *  like a melee parry, and the client re-skins the bullet mid-flight (it sees `hostile`+`kind` flip). */
  private reflectProjectile(
    pr: ProjectileState,
    meta: {
      hostile: boolean;
      damage: number;
      pierce: number;
      pierceMax?: number;
      ttl: number;
      hit: Set<string>;
    },
    player: PlayerState,
    pc: CombatState,
  ): void {
    pr.hostile = false;
    meta.hostile = false;
    meta.hit.clear();
    if (hasAugment(player.augments, "deflector")) {
      // BOUNCE BACK — aim the counter at the nearest enemy to the bullet (fall back to a straight reversal).
      let tx = pr.x - pr.vx;
      let ty = pr.y - pr.vy;
      let bestD = Number.POSITIVE_INFINITY;
      this.state.enemies.forEach((enemy) => {
        const dx = enemy.x - pr.x;
        const dy = enemy.y - pr.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD) {
          bestD = d2;
          tx = enemy.x;
          ty = enemy.y;
        }
      });
      const dx = tx - pr.x;
      const dy = ty - pr.y;
      const len = Math.hypot(dx, dy) || 1;
      pr.vx = (dx / len) * PARRY_REFLECT_SPEED;
      pr.vy = (dy / len) * PARRY_REFLECT_SPEED;
      pr.kind = "counter";
      meta.damage = Math.max(PARRY_REFLECT_MIN_DAMAGE, meta.damage * PARRY_REFLECT_DMG_MULT);
      meta.pierce = PARRY_REFLECT_PIERCE;
      meta.pierceMax = PARRY_REFLECT_PIERCE;
    } else {
      // GLANCE OFF to the side + fade — the Superman ping. Kick perpendicular to the incoming travel, toward
      // the side that points AWAY from the player body, so it sprays outward; harmless (0 dmg) + short-lived.
      const inAng = Math.atan2(pr.vy, pr.vx);
      const perp = inAng + Math.PI / 2;
      const away = Math.cos(perp) * (pr.x - player.x) + Math.sin(perp) * (pr.y - player.y);
      const outAng = away >= 0 ? perp : inAng - Math.PI / 2;
      pr.vx = Math.cos(outAng) * DEFLECT_SPEED;
      pr.vy = Math.sin(outAng) * DEFLECT_SPEED;
      pr.kind = "deflect";
      meta.damage = 0;
      meta.pierce = 999; // flies clean THROUGH everything doing nothing, then fades on its short TTL
      meta.pierceMax = 999;
      meta.ttl = DEFLECT_TTL;
    }
    // §8 parry reward (ranged): flash + FLOW cd + chain build + a flat sliver heal. Kept a flat heal (not the
    // melee chain-scaled one) so parrying INTO a bullet-wall can't fully heal you — it's UMPH, not a fountain.
    player.parriedSeq = (player.parriedSeq + 1) % 100000;
    pc.parryCd = Math.min(pc.parryCd, PARRY_CHAIN_CD);
    pc.parryChain = pc.parryChainT > 0 ? pc.parryChain + 1 : 1;
    pc.parryChainT = PARRY_CHAIN_WINDOW;
    player.hp = Math.min(player.maxHp, player.hp + PARRY_CHAIN_HEAL);
  }

  /** Zoners drop a corrosive puddle under themselves on a cooldown (§15 area denial). */
  private stepZoners(dt: number): void {
    for (const id of [...this.zonerDropCd.keys()]) {
      if (!this.state.enemies.has(id)) this.zonerDropCd.delete(id);
    }
    this.state.enemies.forEach((enemy, id) => {
      if (ENEMY_KINDS[enemy.kind]?.archetype !== "zoner") return;
      let cd = this.zonerDropCd.get(id);
      if (cd === undefined) {
        this.zonerDropCd.set(id, Math.random() * ZONER_DROP_INTERVAL); // stagger first drop
        return;
      }
      cd -= dt;
      if (cd > 0) {
        this.zonerDropCd.set(id, cd);
        return;
      }
      const zone = new ZoneState();
      zone.id = `z${this.zoneSeq++}`;
      zone.x = enemy.x;
      zone.y = enemy.y;
      zone.radius = ZONE_RADIUS * (enemy.tough ? 1.4 : 1);
      this.state.zones.set(zone.id, zone);
      this.zoneMeta.set(zone.id, ZONE_TTL);
      this.zonerDropCd.set(id, ZONER_DROP_INTERVAL);
    });
  }

  /** Tick puddle lifetimes; DoT any living, non-invulnerable player standing inside one. */
  private stepZones(dt: number): void {
    const doomed: string[] = [];
    this.state.zones.forEach((zone, id) => {
      const ttl = (this.zoneMeta.get(id) ?? 0) - dt;
      this.zoneMeta.set(id, ttl);
      if (ttl <= 0) {
        doomed.push(id);
        return;
      }
      const r2 = zone.radius * zone.radius;
      this.state.players.forEach((player) => {
        // §8/§15: zoner puddles are UNPARRYABLE — only the §12 level-up invincibility skips them,
        // NOT parry i-frames. You must walk out of the puddle.
        if (!player.alive || this.inLevelWindow(player)) return;
        const dx = player.x - zone.x;
        const dy = player.y - zone.y;
        if (dx * dx + dy * dy <= r2)
          player.hp -= ZONE_DPS * depthDamageScale(this.state.depth) * dt;
      });
    });
    for (const id of doomed) {
      this.state.zones.delete(id);
      this.zoneMeta.delete(id);
    }
  }

  /** §29 belt ROOM state machine — walk into a room → the gate locks + its wave spawns → clear it → the gate
   *  opens → advance; the last room drops the boss, and clearing it wins the run. Server-authoritative + the
   *  lock x syncs so every client's camera + the gate render agree. */
  private stepBeltRooms(_dt: number, bodies: Vec2[]): void {
    const level = this.beltLevel;
    if (!level) return;
    const room = level.rooms[this.beltRoomIdx];
    if (!room) return; // past the last room (shouldn't happen — the boss room ends the run)
    const prevGate = this.beltRoomIdx === 0 ? 0 : (level.rooms[this.beltRoomIdx - 1]?.gateX ?? 0);
    const trashAlive = this.beltTrashAlive();
    if (this.beltPhase === "enter") {
      // Wait for a living player to walk into the room, THEN lock the gate + spawn the wave.
      if (bodies.some((b) => b.x >= prevGate + 90)) {
        this.beltPhase = "fight";
        this.state.beltLockX = room.gateX;
        this.state.beltRoomName = room.name;
        if (room.boss) this.spawnBoss();
        else this.spawnBeltWave(room.wave, prevGate, room.gateX);
      }
    } else if (this.beltPhase === "fight") {
      const bossAlive = room.boss ? this.bossId !== null : false;
      if (!bossAlive && trashAlive === 0) {
        this.beltPhase = "cleared";
        this.state.beltLockX = 0; // gate opens
        if (room.boss) this.state.outcome = "victory"; // §29 cleared the bridge → run won
      }
    } else {
      // cleared → advance when a player crosses the (now-open) gate.
      if (!room.boss && bodies.some((b) => b.x >= room.gateX)) {
        this.beltRoomIdx++;
        this.beltPhase = "enter";
        this.state.beltRoomName = "";
      }
    }
  }

  /** Non-boss (trash) enemies currently alive — a belt room is cleared when this hits 0. */
  private beltTrashAlive(): number {
    let n = 0;
    this.state.enemies.forEach((_e, id) => {
      if (id !== this.bossId) n++;
    });
    return n;
  }

  /** §29 spawn a room's wave: `n` enemies spread across the room's belt x-range, on the authored floor. */
  private spawnBeltWave(n: number, x0: number, x1: number): void {
    const level = this.beltLevel;
    if (!level || n <= 0) return;
    const players = this.livingCount();
    for (let i = 0; i < n; i++) {
      const kindId = pickEnemyKind(Math.random(), getDimension(this.state.dimensionId).roster);
      const kind = ENEMY_KINDS[kindId];
      if (!kind) continue;
      const enemy = new EnemyState();
      enemy.id = `e${this.enemySeq++}`;
      enemy.kind = kindId;
      enemy.tough =
        kind.archetype !== "swarm" &&
        Math.random() < toughChance(this.state.elapsed, players, this.state.depth);
      enemy.hp =
        kind.hp *
        (enemy.tough ? TOUGH_HP_MULT : 1) *
        enemyHpScale(players) *
        depthHpScale(this.state.depth);
      // spread across the room x, avoiding pits; depth on the authored floor.
      let ex = x0 + 100 + Math.random() * Math.max(1, x1 - x0 - 200);
      if (beltPitAtX(level, ex)) ex = beltSafeX(level, ex, x0);
      enemy.x = ex;
      enemy.y = clampBeltFloorY(level, ex, BELT_Y0 + Math.random() * DEPTH_MAX, kind.radius);
      this.state.enemies.set(enemy.id, enemy);
    }
  }

  /** Spawn enemies on a ring around a random player, accelerating with run time (§5/§6) and pressing
   *  harder per §6 chain depth (v0.103). */
  private runSpawnDirector(dt: number, anchors: Vec2[]): void {
    if (anchors.length === 0) return; // nobody to hunt — pause spawning
    this.spawnAccum += dt;
    const interval = spawnInterval(this.state.elapsed, this.state.depth);
    while (this.spawnAccum >= interval && this.state.enemies.size < MAX_ENEMIES) {
      this.spawnAccum -= interval;
      this.spawnEnemy(anchors);
    }
  }

  private spawnEnemy(anchors: Vec2[]): void {
    // §17 weighted pick scoped to the ACTIVE dimension's roster (frost enemies never spawn in the desert).
    const kindId = pickEnemyKind(Math.random(), getDimension(this.state.dimensionId).roster);
    const kind = ENEMY_KINDS[kindId];
    if (!kind) return;
    const anchor = anchors[Math.floor(Math.random() * anchors.length)] ?? anchors[0];
    if (!anchor) return;

    // Appear on a ring just beyond a typical screen edge, then converge inward.
    const angle = Math.random() * Math.PI * 2;
    const m = ENEMY_RADIUS + 4;
    const players = this.livingCount(); // §6 trash horde scales on LIVING players (rez-or-dead spiral fix)
    const enemy = new EnemyState();
    enemy.id = `e${this.enemySeq++}`;
    enemy.kind = kindId;
    // Tough tier (§15): rolls more likely with run time AND player count AND §6 chain depth. Swarm stays trash.
    enemy.tough =
      kind.archetype !== "swarm" &&
      Math.random() < toughChance(this.state.elapsed, players, this.state.depth);
    // §6: spongier with more players (equalises death rate vs combined DPS) × depth (the chain's escalation).
    enemy.hp =
      kind.hp *
      (enemy.tough ? TOUGH_HP_MULT : 1) *
      enemyHpScale(players) *
      depthHpScale(this.state.depth);
    const ex = clamp(anchor.x + Math.cos(angle) * SPAWN_RING, m, ARENA_WIDTH - m);
    if (this.belt && this.beltLevel) {
      // §29 belt: come in along the belt (x), confined to the authored floor DEPTH profile at that x.
      enemy.x = ex;
      enemy.y = clampBeltFloorY(
        this.beltLevel,
        ex,
        anchor.y + Math.sin(angle) * SPAWN_RING,
        kind.radius,
      );
      this.state.enemies.set(enemy.id, enemy);
      return;
    }
    const ey = clamp(anchor.y + Math.sin(angle) * SPAWN_RING, m, ARENA_HEIGHT - m);
    // §17 don't spawn inside a pit (instant fall) or a POI (a one-tick shove-out teleport) — nudge clear.
    const sp = safeSpawnPos(this.map, ex, ey, kind.radius);
    enemy.x = sp.x;
    enemy.y = sp.y;
    this.state.enemies.set(enemy.id, enemy);
  }

  /** §21 Dev summon: place ONE enemy of `kindId` on the spawn ring around `anchor`, optionally tough.
   *  Mirrors spawnEnemy's placement (ring offset + pit/POI safe-spawn) but with a CHOSEN kind/tier so the
   *  Testing-Grounds Tab menu can conjure exactly what the playtester wants to fight. */
  private debugSpawnOne(kindId: string, tough: boolean, anchor: PlayerState): void {
    const kind = ENEMY_KINDS[kindId];
    if (!kind) return;
    const players = this.state.players.size;
    const angle = Math.random() * Math.PI * 2;
    const m = kind.radius + 4;
    const enemy = new EnemyState();
    enemy.id = `e${this.enemySeq++}`;
    enemy.kind = kindId;
    // Swarm trash can't be tough (matches the director rule); the boss ignores the flag (it's already a tier).
    enemy.tough = tough && kind.archetype !== "swarm" && kind.archetype !== "boss";
    enemy.hp = kind.hp * (enemy.tough ? TOUGH_HP_MULT : 1) * enemyHpScale(players);
    const ex = clamp(anchor.x + Math.cos(angle) * SPAWN_RING, m, ARENA_WIDTH - m);
    const ey = clamp(anchor.y + Math.sin(angle) * SPAWN_RING, m, ARENA_HEIGHT - m);
    const sp = safeSpawnPos(this.map, ex, ey, kind.radius);
    enemy.x = sp.x;
    enemy.y = sp.y;
    this.state.enemies.set(enemy.id, enemy);
  }

  /** §16 v0.116 BOSS RUSH — drop the boss at `bossRushIndex` in the gauntlet order (`BOSS_DEF_IDS`). Reuses
   *  `spawnBoss` (ring-spawn near a living player, HP-scaled by the escalating depth), which also retires any
   *  lingering previous boss. */
  private spawnBossRushBoss(): void {
    const kind = BOSS_DEF_IDS[this.bossRushIndex];
    if (kind) this.spawnBoss(kind);
  }

  /** §16 v0.116 BOSS RUSH — a boss just fell: pay the squad a depth-scaled wage + a mid-run heal + a mystery
   *  drop, then either QUEUE the next boss (escalating `depth`) or, on the final boss, WIN the run (bank + clean
   *  the field, mirroring `checkExtraction`). */
  private advanceBossRush(x: number, y: number): void {
    const wage = BOSS_SALVAGE_PER_DEPTH * this.state.depth;
    this.state.players.forEach((p) => {
      if (!p.alive) return;
      p.salvaged += wage;
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp * BOSSRUSH_HEAL_FRAC);
    });
    this.dropLoot(x, y, 1, LOOT_TIER_LUK_BOSS); // the reward for the clear (boss-tier rarity)
    this.bossRushIndex++;
    if (this.bossRushIndex >= BOSS_DEF_IDS.length) {
      // GAUNTLET CLEARED → victory: bank everything carried + clear the field for the win screen.
      this.state.outcome = "victory";
      let banked = 0;
      this.state.players.forEach((p) => {
        banked += p.salvaged;
        p.salvaged = 0;
      });
      this.state.bankedSalvage += banked;
      this.state.enemies.clear();
      this.state.projectiles.clear();
      this.projectileMeta.clear();
      this.enemyFireCd.clear();
      console.log(
        `[room ${this.roomId}] BOSS RUSH cleared all ${BOSS_DEF_IDS.length} bosses — VICTORY (+${banked} banked)`,
      );
      return;
    }
    // Escalate the difficulty (HP + damage) with each round, and queue the next boss after a breather.
    this.state.depth = Math.min(255, this.bossRushIndex + 1);
    this.bossRushNextTimer = BOSSRUSH_BREATHER;
  }

  /** Spawn a BOSS on a ring around a player (§16) — the run's capstone threat. `overrideKind` (the debug
   *  picker) spawns a specific boss BODY; otherwise the active dimension's boss. The body kind supplies the
   *  sprite/hp/radius; its `BossDef` (or CLASSIC_BOSS fallback) drives the attacks via the BossController. */
  private spawnBoss(overrideKind?: string): void {
    const bossKind =
      overrideKind && ENEMY_KINDS[overrideKind]?.archetype === "boss"
        ? overrideKind
        : getDimension(this.state.dimensionId).boss;
    const kind = ENEMY_KINDS[bossKind];
    if (!kind) return;
    // A picker re-spawn while a boss is up: retire the old one, its adds, and its telegraphs first. Evicting
    // the tracked adds (not just clearing the Set) stops them lingering off-cap under the new boss.
    if (this.bossId) {
      this.state.enemies.delete(this.bossId);
      for (const addId of this.bossAddIds) this.state.enemies.delete(addId);
      this.clearBoss();
    }
    const anchors: Vec2[] = [];
    this.state.players.forEach((pl) => {
      if (pl.alive) anchors.push({ x: pl.x, y: pl.y });
    });
    const anchor = anchors[Math.floor(Math.random() * anchors.length)] ?? {
      x: ARENA_WIDTH / 2,
      y: ARENA_HEIGHT / 2,
    };
    const angle = Math.random() * Math.PI * 2;
    const boss = new EnemyState();
    boss.id = `boss${this.enemySeq++}`;
    boss.kind = bossKind;
    // §6 boss HP-sponge × players × chain depth (v0.103 — deeper capstones are meaner).
    boss.hp = kind.hp * enemyHpScale(this.state.players.size) * depthHpScale(this.state.depth);
    const bx = clamp(
      anchor.x + Math.cos(angle) * SPAWN_RING,
      kind.radius,
      ARENA_WIDTH - kind.radius,
    );
    const by = clamp(
      anchor.y + Math.sin(angle) * SPAWN_RING,
      kind.radius,
      ARENA_HEIGHT - kind.radius,
    );
    // §17 land the boss on solid ground + clear of POIs so its grand entrance doesn't teleport-out next tick.
    const sp = safeSpawnPos(this.map, bx, by, kind.radius);
    boss.x = sp.x;
    boss.y = sp.y;
    this.state.enemies.set(boss.id, boss);
    this.bossSpawned = true;
    this.bossId = boss.id;
    // §16 v0.109 the data-driven controller runs this boss's def (CLASSIC_BOSS = OLD RUST for any kind
    // without a bespoke def, so every dimension boss keeps its behaviour). maxHp frozen for phase thresholds.
    const def = bossDefFor(bossKind);
    this.bossController = new BossController(def, boss.hp, randomSeed());
    this.state.bossKind = bossKind; // client labels the boss bar from this
    console.log(`[room ${this.roomId}] ⚠ boss approaches — ${bossKind} (${def.name})`);
  }

  /** Reset the §17 shifter director (first incursion timer, no active incursion). `keepWaves` (a §6 rift
   *  descent) preserves the per-incursion HP ramp — descending IS "deeper into the chain"; only a fresh
   *  run/training toggle zeroes it. */
  private resetShifters(keepWaves = false): void {
    this.shifterCd = SHIFTER_FIRST_SECONDS;
    this.shifterId = null;
    this.shifterTimer = 0;
    if (!keepWaves) this.shifterWaves = 0;
  }

  /** §17 SHIFTER director: manage the active incursion (phase it out when its hunt window expires) and, in
   *  normal play, start the next one on the cadence. Only one incursion at a time; held while the boss is up
   *  or the portal is open. The shifter's actual combat runs through the generic archetype AI. */
  private stepShifters(dt: number, bodies: Vec2[]): void {
    // The active shifter died (or was removed) → clear tracking so the cooldown can restart.
    if (this.shifterId && !this.state.enemies.has(this.shifterId)) this.shifterId = null;

    if (this.shifterId) {
      // PHASE-OUT: an incursion the squad couldn't put down rifts back out when its window elapses.
      this.shifterTimer -= dt;
      if (this.shifterTimer <= 0) {
        this.state.enemies.delete(this.shifterId);
        this.comboState.delete(this.shifterId);
        this.enemyFireCd.delete(this.shifterId);
        console.log(`[room ${this.roomId}] ⌁ shifter phased out — ${this.shifterId}`);
        this.shifterId = null;
      }
      return; // one incursion at a time
    }

    this.shifterCd -= dt;
    if (this.shifterCd > 0) return;
    this.shifterCd = SHIFTER_INTERVAL;
    // Hold new incursions while the dimension boss is up or the run is extracting — keep the climax clean.
    if (this.bossId || this.state.portalOpen) return;
    this.spawnShifter(bodies);
  }

  /** Phase a shifter in at the arena edge near a living drifter. Tier escalates with run time AND §6 chain
   *  depth (v0.103 — a depth-3 dimension opens with a mid-tier invader, matching the world around it); HP
   *  ramps per incursion across the WHOLE run (shifterWaves survives descents — "tougher deeper into the
   *  chain") and scales with depth like everything else. Hunts for `shifter.window` sec, then phases out. */
  private spawnShifter(bodies: Vec2[]): void {
    if (SHIFTER_KIND_IDS.length === 0 || bodies.length === 0) return;
    const tier = Math.min(
      SHIFTER_KIND_IDS.length - 1,
      this.state.depth - 1 + Math.floor(this.state.elapsed / SHIFTER_TIER_SECONDS),
    );
    const kindId = SHIFTER_KIND_IDS[tier];
    const kind = kindId ? ENEMY_KINDS[kindId] : undefined;
    if (!kindId || !kind) return;
    const anchor = bodies[Math.floor(Math.random() * bodies.length)] ?? {
      x: ARENA_WIDTH / 2,
      y: ARENA_HEIGHT / 2,
    };
    const angle = Math.random() * Math.PI * 2;
    const s = new EnemyState();
    s.id = `shifter${this.enemySeq++}`;
    s.kind = kindId;
    s.hp =
      kind.hp *
      enemyHpScale(this.state.players.size) *
      depthHpScale(this.state.depth) *
      (1 + SHIFTER_HP_PER_WAVE * this.shifterWaves);
    const m = kind.radius + 4;
    const sx = clamp(anchor.x + Math.cos(angle) * SPAWN_RING, m, ARENA_WIDTH - m);
    const sy = clamp(anchor.y + Math.sin(angle) * SPAWN_RING, m, ARENA_HEIGHT - m);
    const sp = safeSpawnPos(this.map, sx, sy, kind.radius);
    s.x = sp.x;
    s.y = sp.y;
    this.state.enemies.set(s.id, s);
    this.shifterId = s.id;
    this.shifterTimer = kind.shifter?.window ?? 20;
    this.shifterWaves++;
    console.log(
      `[room ${this.roomId}] ⌁ shifter incursion — ${kindId} (wave ${this.shifterWaves})`,
    );
  }

  /** Open the extraction portal where the boss fell (§16). */
  /** §17 mint fresh map seeds + regenerate the server's arena from them (the client mirrors via the
   *  synced seeds). Called at room create, on every §6 rift descent, and on run restart. */
  private mintMap(): void {
    this.state.seedTerrain = randomSeed();
    this.state.seedHazard = randomSeed();
    this.state.seedTheme = randomSeed();
    this.state.seedDecor = randomSeed();
    this.map = generateArena({
      seedTerrain: this.state.seedTerrain,
      seedHazard: this.state.seedHazard,
      seedTheme: this.state.seedTheme,
      seedDecor: this.state.seedDecor,
    });
    // The generator guarantees a connected, spawn-clear map; assert it (cheap) so a future regression
    // surfaces loudly instead of shipping an unplayable arena.
    const v = validateArena(this.map);
    if (!v.ok) console.error(`[room ${this.roomId}] mapgen produced an invalid arena: ${v.reason}`);
  }

  /** §6 the boss falls → open BOTH gates of the greed decision: the amber EXTRACTION portal (bank the
   *  carried salvage, end in victory) and the violet DEEPER rift (descend to depth+1 — harder, richer).
   *  The rift opens RIFT_OFFSET away, nudged onto safe ground, so a step into one can't read as the other.
   *  The boss ALSO pays the chain's real wage (v0.103 — the "richer" in the rift's promise): every living
   *  player pockets BOSS_SALVAGE_PER_DEPTH × depth carried salvage — bank it now or gamble it deeper. */
  private openPortal(x: number, y: number): void {
    const wage = BOSS_SALVAGE_PER_DEPTH * this.state.depth;
    this.state.players.forEach((p) => {
      if (p.alive) p.salvaged += wage;
    });
    this.state.portalOpen = true;
    this.state.portalX = x;
    this.state.portalY = y;
    // Aim the rift's offset back toward the arena centre so it never lands clamped into the border rail.
    const cx = ARENA_WIDTH / 2 - x;
    const cy = ARENA_HEIGHT / 2 - y;
    const d = Math.hypot(cx, cy) || 1;
    const rp = safeSpawnPos(
      this.map,
      x + (cx / d) * RIFT_OFFSET,
      y + (cy / d) * RIFT_OFFSET,
      EXTRACT_RADIUS,
    );
    this.state.riftOpen = true;
    this.state.riftX = rp.x;
    this.state.riftY = rp.y;
    this.bossId = null;
    console.log(
      `[room ${this.roomId}] boss defeated — extraction portal + deeper rift open (depth ${this.state.depth})`,
    );
  }

  /** §6 rift descent (v0.103, the chain): depth+1, a NEW dimension + freshly-seeded map, the same squad —
   *  levels/attributes/weapons/augments/carried salvage/HP all persist (that's the greed: you push in
   *  whatever shape the last fight left you). The field is cleared, the clock and boss director reset. */
  private transitionDimension(): void {
    this.state.depth = Math.min(250, this.state.depth + 1);
    // Next dimension: prefer one the chain hasn't visited; once all are seen, any OTHER dimension.
    this.visitedDims.add(this.state.dimensionId);
    const all = Object.keys(DIMENSIONS);
    const fresh = all.filter((id) => !this.visitedDims.has(id));
    const pool = fresh.length > 0 ? fresh : all.filter((id) => id !== this.state.dimensionId);
    this.state.dimensionId =
      pool[Math.floor(Math.random() * pool.length)] ?? this.state.dimensionId;
    // Fresh battlefield: new seeds/map, cleared field, reset clock + directors.
    this.mintMap();
    this.state.enemies.clear();
    this.state.projectiles.clear();
    this.state.zones.clear();
    this.state.pickups.clear();
    this.clearTransients();
    this.state.elapsed = 0;
    this.spawnAccum = 0;
    this.state.outcome = "active";
    this.state.portalOpen = false;
    this.state.riftOpen = false;
    this.bossSpawned = false;
    this.clearBoss(); // §16 v0.109 also resets bossPhase/bossKind + clears telegraphs
    this.resetShifters(true); // keep the per-incursion HP ramp — a descent IS "deeper into the chain"
    // Carry the whole squad through the rift — downed bodies come too, arriving STILL DOWN at the new
    // spawn (the rez-or-dead rule doesn't soften mid-chain; a rez weapon works on the far side).
    this.state.players.forEach((player, id) => {
      player.x = this.map.spawnX + (Math.random() * 200 - 100);
      player.y = this.map.spawnY + (Math.random() * 200 - 100);
      player.vx = 0;
      player.vy = 0;
      player.height = 0;
      const c = this.combat.get(id);
      if (c) {
        c.lastGroundX = player.x;
        c.lastGroundY = player.y;
        c.pitGrace = 0;
        // The Hair-Trigger streak timestamps ride the elapsed clock, which just reset — clear them or the
        // first parry in the new dimension inherits the old dimension's streak (verify finding).
        c.lastParryAt = -999;
        c.hairStreak = 0;
      }
      this.zeroMoveVel(id); // §7 the descent repositions the body — momentum doesn't cross dimensions
    });
    console.log(
      `[room ${this.roomId}] ⇓ rift descent — depth ${this.state.depth}, dimension ${this.state.dimensionId}`,
    );
  }

  /** Step a living player into the open portal → run complete (§16). */
  private checkExtraction(bodies: Vec2[]): void {
    if (!this.state.portalOpen || this.state.outcome !== "active") return;
    const r2 = EXTRACT_RADIUS * EXTRACT_RADIUS;
    for (const b of bodies) {
      const dx = b.x - this.state.portalX;
      const dy = b.y - this.state.portalY;
      if (dx * dx + dy * dy <= r2) {
        this.state.outcome = "victory";
        // §6 BANK (v0.103, "bank or lose"): everything the squad carried is deposited — the win's payload.
        let banked = 0;
        this.state.players.forEach((p) => {
          banked += p.salvaged;
          p.salvaged = 0;
        });
        this.state.bankedSalvage += banked;
        // Clean the field for the win screen.
        this.state.enemies.clear();
        this.state.projectiles.clear();
        this.projectileMeta.clear();
        this.enemyFireCd.clear();
        this.state.riftOpen = false; // the choice is made — the rift closes
        console.log(
          `[room ${this.roomId}] run extracted at depth ${this.state.depth} — VICTORY (+${banked} salvage banked, ${this.state.bankedSalvage} total)`,
        );
        return;
      }
    }
  }

  /** §6 the other half of the greed decision (v0.103): the DEEPER rift is a CHANNEL — a living player
   *  must HOLD it for RIFT_CHANNEL_SECONDS (the synced `riftCharge` fills 0→1, drawn by the client) before
   *  the whole squad commits. Leaving the ring drains the charge — one misstep or one griefer can't yank
   *  four players into depth+1. Extraction stays instant (it's the benign direction). */
  private checkDescend(dt: number, bodies: Vec2[]): void {
    if (!this.state.riftOpen || this.state.outcome !== "active") {
      if (this.state.riftCharge !== 0) this.state.riftCharge = 0;
      return;
    }
    const r2 = EXTRACT_RADIUS * EXTRACT_RADIUS;
    let holding = false;
    for (const b of bodies) {
      const dx = b.x - this.state.riftX;
      const dy = b.y - this.state.riftY;
      if (dx * dx + dy * dy <= r2) {
        holding = true;
        break;
      }
    }
    if (holding) {
      this.state.riftCharge = Math.min(1, this.state.riftCharge + dt / RIFT_CHANNEL_SECONDS);
      if (this.state.riftCharge >= 1) {
        this.state.riftCharge = 0;
        this.transitionDimension();
      }
    } else if (this.state.riftCharge > 0) {
      this.state.riftCharge = Math.max(0, this.state.riftCharge - (dt / RIFT_CHANNEL_SECONDS) * 2);
    }
  }
}
