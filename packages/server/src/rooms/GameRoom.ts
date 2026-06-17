import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type ArenaMap,
  ArenaState,
  type Attr,
  BOSS_SPAWN_SECONDS,
  CHAIN_MAX_RANGE,
  type ChainCandidate,
  clamp,
  clampQuakeEpicenter,
  coneAngles,
  DEFAULT_WEAPON,
  DROP_GRACE_SECONDS,
  DUMMY_HP,
  deriveStats,
  ENEMY_KINDS,
  ENEMY_RADIUS,
  EnemyState,
  EXTRACT_RADIUS,
  effectiveDamageMult,
  enemyHpScale,
  FISTS_WEAPON,
  generateArena,
  gunMuzzleReach,
  inMeleeArc,
  isAttr,
  isInsidePoi,
  isPitAtPx,
  JUMP_AIRTIME,
  JUMP_COOLDOWN,
  LEVEL_CAP,
  LEVELUP_WINDOW_SECONDS,
  M0_CLASS_ATTR,
  M0_REQ_ATTR,
  MAP_POI_RADIUS,
  MAX_ENEMIES,
  MAX_PLAYERS,
  MOVE_SPEED,
  type MoveInput,
  nearestGroundPx,
  nearestPoint,
  nextCharacter,
  nextWeapon,
  PARRY_COOLDOWN,
  PARRY_IFRAMES,
  PARRY_KNOCKBACK,
  PARRY_RADIUS,
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
  QUAKE_REACH,
  RESPAWN_CLEAR_RADIUS,
  RESPAWN_SECONDS,
  randomSeed,
  resolveBodyCollisions,
  resolvePoiCollision,
  SPAWN_RING,
  selectChainTargets,
  spawnInterval,
  stepEnemyChase,
  stepEnemyKite,
  stepPlayerMovement,
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

/** Latest input received from each client, applied every tick. */
interface InputState {
  dx: number;
  dy: number;
}

/** Per-player combat/aux state, kept server-side (not all of it needs to sync). */
interface CombatState {
  aimX: number;
  aimY: number;
  /** Cursor world target (for slam-at-cursor weapons; clamped to QUAKE_REACH server-side). */
  targetX: number;
  targetY: number;
  /** Set by an "attack" message, consumed (and cleared) each tick. */
  attacking: boolean;
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
  /** §17 last GROUNDED position (world px) — where a pit-fall snaps the player back to. Updated every
   *  tick the player stands on solid ground. */
  lastGroundX: number;
  lastGroundY: number;
  /** §17 post-fall grace, sec: i-frames + a window where the player won't re-fall (so a pit isn't a death
   *  spiral or a landing-gank). */
  pitGrace: number;
}

/**
 * Authoritative PvE room (§4 RoR2-style host-authoritative sync via Colyseus).
 *
 * Netcode-handshake POC scope (build order §27.3 step 2): server owns player position,
 * integrates it at the locked 20Hz tick, and broadcasts ArenaState. Clients send input
 * and interpolate toward the authoritative position. No client prediction yet — added
 * once this baseline feels right (prediction reuses shared `stepPlayerMovement`).
 */
export class GameRoom extends Room<ArenaState> {
  override maxClients = MAX_PLAYERS;

  private readonly inputs = new Map<string, InputState>();
  private readonly combat = new Map<string, CombatState>();
  /** Per-enemy ranged-attack cooldown, sec (spitters). Keyed by enemy id; pruned with the enemy. */
  private readonly enemyFireCd = new Map<string, number>();
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
  /** §15 duelist (ronin) combo state per enemy id: phase + timer + swings left. Pruned with the enemy. */
  private readonly comboState = new Map<
    string,
    { phase: "idle" | "windup" | "swing" | "recover"; t: number; hits: number }
  >();
  /** §9/§13 per-DROPPED-pickup grace timer (sec): while > 0 the pickup can't be re-grabbed, so a weapon
   *  dropped at your feet doesn't snap straight back. Keyed by pickup id; only set for player drops. */
  private readonly pickupGrace = new Map<string, number>();
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
  private bossId: string | null = null;
  /** Co-op host = the first player to join (reassigned if they leave). Run-wide commands
   *  (restart / toggle-training / spawn-boss) are host-only so one client can't wipe the shared run. */
  private hostId: string | null = null;
  private isHost(client: Client): boolean {
    return this.hostId === null || client.sessionId === this.hostId;
  }

  override onCreate(): void {
    this.setState(new ArenaState());

    // §17 mint the procedural arena ONCE. The four seeds are synced on ArenaState so every client feeds
    // them to the same shared `generateArena` and reproduces a byte-identical map — no tile streaming.
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

    this.onMessage("input", (client, message: MoveInput) => {
      // Trust nothing off the wire; coerce to finite numbers. stepPlayerMovement
      // clamps magnitude + bounds, so a hostile client cannot speed-hack from here.
      const dx = Number.isFinite(message?.dx) ? message.dx : 0;
      const dy = Number.isFinite(message?.dy) ? message.dy : 0;
      this.inputs.set(client.sessionId, { dx, dy });
    });

    // RMB fires the equipped weapon (§9). Tick gates it by cooldown + resolves the arc/quake
    // authoritatively — the client only requests + sends its aim.
    this.onMessage(
      "attack",
      (client, message: { aimX?: number; aimY?: number; tx?: number; ty?: number }) => {
        const c = this.combat.get(client.sessionId);
        const player = this.state.players.get(client.sessionId);
        if (!c) return;
        c.attacking = true;
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

    // LMB = the melee Parry signature (§7/§8). Base effect: brief i-frames + knockback. (No
    // telegraphed enemy attacks yet, so it's a defensive button; augments/white-tells come later.)
    this.onMessage("parry", (client) => {
      const player = this.state.players.get(client.sessionId);
      const c = this.combat.get(client.sessionId);
      if (!player?.alive || !c || c.parryCd > 0) return;
      c.invuln = PARRY_IFRAMES;
      c.parryCd = PARRY_COOLDOWN;
      const r2 = PARRY_RADIUS * PARRY_RADIUS;
      this.state.enemies.forEach((enemy) => {
        const dx = enemy.x - player.x;
        const dy = enemy.y - player.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > 0 && d2 <= r2) {
          const d = Math.sqrt(d2);
          enemy.x = clamp(
            enemy.x + (dx / d) * PARRY_KNOCKBACK,
            ENEMY_RADIUS,
            ARENA_WIDTH - ENEMY_RADIUS,
          );
          enemy.y = clamp(
            enemy.y + (dy / d) * PARRY_KNOCKBACK,
            ENEMY_RADIUS,
            ARENA_HEIGHT - ENEMY_RADIUS,
          );
        }
      });
    });

    // Cycle to the next weapon in the roster (§9 arsenal — POC keyboard cycle).
    this.onMessage("cycleWeapon", (client) => {
      const player = this.state.players.get(client.sessionId);
      if (player) player.weapon = nextWeapon(player.weapon);
    });

    // §7 swap the player's CHARACTER skin (C key). Cosmetic + per-player (not host-gated).
    this.onMessage("cycleCharacter", (client) => {
      const player = this.state.players.get(client.sessionId);
      if (player) player.character = nextCharacter(player.character);
    });

    // §9/§13 R-TAP = DROP the held weapon on the floor (grabbable) in front of you; you fall back to
    // FISTS (§9). The drop gets a brief grace so it doesn't snap straight back to you (DROP_GRACE_SECONDS).
    this.onMessage("dropWeapon", (client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player?.alive || player.weapon === FISTS_WEAPON) return;
      const c = this.combat.get(client.sessionId);
      const ax = c?.aimX ?? 1;
      const ay = c?.aimY ?? 0;
      const pk = new PickupState();
      pk.id = `drop${this.pickupSeq++}`;
      pk.weapon = player.weapon;
      pk.x = clamp(player.x + ax * PICKUP_RADIUS * 1.6, PICKUP_RADIUS, ARENA_WIDTH - PICKUP_RADIUS);
      pk.y = clamp(
        player.y + ay * PICKUP_RADIUS * 1.6,
        PICKUP_RADIUS,
        ARENA_HEIGHT - PICKUP_RADIUS,
      );
      this.state.pickups.set(pk.id, pk);
      this.pickupGrace.set(pk.id, DROP_GRACE_SECONDS);
      player.weapon = FISTS_WEAPON;
    });

    // §13 R-HOLD = SALVAGE the held weapon into the salvage bag (consumed, no pickup) → fall back to
    // FISTS. The parts economy (§13) isn't built yet, so this just tallies `salvaged` for HUD feedback.
    this.onMessage("salvageWeapon", (client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player?.alive || player.weapon === FISTS_WEAPON) return;
      player.salvaged += 1;
      player.weapon = FISTS_WEAPON;
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
      player.weapon = grabbed.weapon;
      if (grabbed.id.startsWith("drop")) {
        this.state.pickups.delete(grabbed.id);
        this.pickupGrace.delete(grabbed.id);
      }
    });

    // §5 JUMP (Spacebar) — a low all-class traversal HOP, then a cooldown so it isn't spammable. PURE
    // movement, NOT a dodge (no i-frames — the parry stays the defensive tool). The §17 pitfall layer reads
    // `airborne` to let a hopping player clear a gap.
    this.onMessage("jump", (client) => {
      const player = this.state.players.get(client.sessionId);
      const c = this.combat.get(client.sessionId);
      if (!player?.alive || player.flexPending > 0 || !c) return;
      if (c.jumpCd > 0 || player.airborne > 0) return;
      player.airborne = JUMP_AIRTIME;
      c.jumpCd = JUMP_COOLDOWN;
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

    // §12 level-up window: the player spends their FLEX point on an attribute.
    this.onMessage("chooseAttribute", (client, message: { attr?: string }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || player.flexPending <= 0) return;
      const attr = message?.attr;
      if (!isAttr(attr)) return; // validate the untrusted field, then it narrows to Attr
      this.allocate(player, attr, 1);
      this.consumeFlex(player);
    });

    this.setSimulationInterval((deltaMs) => this.update(deltaMs), TICK_MS);
    // Pin the patch (state-broadcast) rate to the sim tick explicitly — otherwise it sits at the
    // Colyseus default (50ms) and silently diverges from the sim if TICK_MS ever changes.
    this.setPatchRate(TICK_MS);
  }

  /** Switch between survival ("arena") and Testing Grounds ("training", §21). */
  private toggleTraining(): void {
    this.state.enemies.clear();
    this.state.pickups.clear();
    this.state.projectiles.clear();
    this.state.zones.clear();
    this.projectileMeta.clear();
    this.enemyFireCd.clear();
    this.zonerDropCd.clear();
    this.zoneMeta.clear();
    this.state.outcome = "active";
    this.state.portalOpen = false;
    this.bossSpawned = false;
    this.bossId = null;
    const cx = ARENA_WIDTH / 2;
    const cy = ARENA_HEIGHT / 2;

    if (this.state.mode === "arena") {
      this.state.mode = "training";
      this.state.elapsed = 0;
      this.spawnAccum = 0;
      // Weapon pickups in a row (one per roster weapon), and dummies below them.
      WEAPON_IDS.forEach((weaponId, i) => {
        const pk = new PickupState();
        pk.id = `pk${i}`;
        pk.weapon = weaponId;
        pk.x = cx + (i - (WEAPON_IDS.length - 1) / 2) * 150;
        pk.y = cy - 200;
        this.state.pickups.set(pk.id, pk);
      });
      for (let i = 0; i < 3; i++) {
        const dummy = new EnemyState();
        dummy.id = `dummy${i}`;
        dummy.kind = "dummy";
        dummy.hp = DUMMY_HP;
        dummy.x = cx + (i - 1) * 200;
        dummy.y = cy + 170;
        this.state.enemies.set(dummy.id, dummy);
      }
      // Reset players to the center, full HP, so they start clear of everything.
      this.state.players.forEach((player) => {
        player.alive = true;
        player.hp = player.maxHp;
        player.x = cx;
        player.y = cy + 20;
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
    this.projectileMeta.clear();
    this.enemyFireCd.clear();
    this.zonerDropCd.clear();
    this.zoneMeta.clear();
    this.state.elapsed = 0;
    this.state.outcome = "active";
    this.state.portalOpen = false;
    this.bossSpawned = false;
    this.bossId = null;
    this.spawnAccum = 0;
    this.enemySeq = 0;
    this.state.players.forEach((player, id) => {
      // Fresh run → reset progression + attributes to the 1/1/1/1/1 start (§11/§12).
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
      player.maxHp = PLAYER_MAX_HP;
      player.alive = true;
      player.hp = player.maxHp;
      player.x = this.map.spawnX + (Math.random() * 200 - 100);
      player.y = this.map.spawnY + (Math.random() * 200 - 100);
      const c = this.combat.get(id);
      if (c) {
        c.respawn = 0;
        c.cd = 0;
        c.attacking = false;
        c.reloadCd = 0;
        c.lastWeapon = ""; // forces charge re-init next tick
      }
    });
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

  override onJoin(client: Client): void {
    const player = new PlayerState();
    player.id = client.sessionId;
    player.hp = PLAYER_MAX_HP;
    player.maxHp = PLAYER_MAX_HP;
    player.alive = true;
    player.weapon = DEFAULT_WEAPON;
    // Spawn on the map's guaranteed-clear spawn disc (§17), with a little scatter so blobs don't overlap
    // (±100px stays inside the cleared centre, never over a pit).
    player.x = this.map.spawnX + (Math.random() * 200 - 100);
    player.y = this.map.spawnY + (Math.random() * 200 - 100);
    this.state.players.set(client.sessionId, player);
    if (this.hostId === null) this.hostId = client.sessionId; // first joiner is the co-op host
    this.inputs.set(client.sessionId, { dx: 0, dy: 0 });
    this.combat.set(client.sessionId, {
      aimX: 1,
      aimY: 0,
      targetX: 0,
      targetY: 0,
      attacking: false,
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

  private update(deltaMs: number): void {
    // Clamp the step so one GC/CPU stall can't produce a giant dt (point-sampled projectiles would
    // tunnel + enemies teleport). Cap at ~2.5 ticks; a longer stall is absorbed as a brief slow-mo.
    const dt = Math.min(deltaMs, TICK_MS * 2.5) / 1000;

    // 1. Integrate each LIVING player's authoritative movement from their latest input.
    //    A player in the §12 level-up window (flexPending) is frozen so they can pick safely.
    this.state.players.forEach((player, id) => {
      if (!player.alive || player.flexPending > 0) return;
      const input = this.inputs.get(id);
      if (!input) return;
      const next = stepPlayerMovement(player, input, dt, MOVE_SPEED);
      player.x = next.x;
      player.y = next.y;
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

    // 2.4 §17 POI collision — push living players OUT of the landmark obstacles (cover you can't walk through).
    this.state.players.forEach((player) => {
      if (!player.alive) return;
      const r = resolvePoiCollision(this.map, player.x, player.y, PLAYER_RADIUS);
      player.x = r.x;
      player.y = r.y;
    });

    // 2.5 §17 PITFALL — a GROUNDED player whose body is over a pit falls: chip damage + snap back to the
    // last solid tile + a brief grace (i-frames, no re-fall). An AIRBORNE player (mid-jump, §5) clears the
    // gap and is immune. We also remember the last grounded spot here so the snap-back has somewhere to go.
    this.state.players.forEach((player, id) => {
      if (!player.alive || player.flexPending > 0) return;
      const c = this.combat.get(id);
      if (!c) return;
      if (c.pitGrace > 0) c.pitGrace = Math.max(0, c.pitGrace - dt);
      if (player.airborne > 0) return; // the hop carries you over
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
      player.fellSeq++;
    });

    // 3. Run clock + spawn director (§6) — survival mode only. `bodies` = living players.
    if (this.state.mode === "arena") {
      if (this.state.outcome === "active") {
        this.state.elapsed += dt;
        // Boss director (§16): OLD RUST arrives at the time mark, once per run.
        if (!this.bossSpawned && this.state.elapsed >= BOSS_SPAWN_SECONDS) this.spawnBoss();
        // The horde keeps coming until the boss falls; once the portal opens it eases off so the
        // run can be cleanly extracted.
        if (!this.state.portalOpen) this.runSpawnDirector(dt, bodies);
        this.checkExtraction(bodies);
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
      c.jumpCd = Math.max(0, c.jumpCd - dt);
      player.airborne = Math.max(0, player.airborne - dt); // §5 jump hop airtime
      const weapon = WEAPONS[player.weapon] ?? WEAPONS[DEFAULT_WEAPON];

      // (Re)initialise the ammo/charge readout when the equipped weapon changes (§9/§10). Guns use the
      // magazine as ammo; thrown weapons use charges; both share charges/maxCharges + the reload timer.
      if (c.lastWeapon !== player.weapon) {
        c.lastWeapon = player.weapon;
        c.cd = 0; // clear the previous weapon's leftover cooldown so the new one can act immediately
        c.reloadCd = 0;
        const max = weapon?.gun?.magazine ?? weapon?.thrown?.charges ?? 0;
        player.charges = max;
        player.maxCharges = max;
      }

      const canAct = player.alive && player.flexPending <= 0 && c.attacking && c.cd <= 0;
      if (weapon?.gun) {
        // §9 GUN: fire-rate-gated bullets that spend ammo; on empty, RELOAD (refill the magazine).
        if (player.charges <= 0 && c.reloadCd > 0) {
          c.reloadCd -= dt;
          if (c.reloadCd <= 0) player.charges = player.maxCharges;
        }
        if (canAct && player.charges > 0) {
          this.fireGun(player, c, weapon);
          player.charges -= 1;
          c.cd += weapon.gun.fireRate; // ACCUMULATE (not assign) so the sub-tick remainder carries (exact cadence)
          if (player.charges <= 0) c.reloadCd = weapon.gun.reloadSeconds;
        }
      } else if (weapon?.thrown) {
        // Refill all charges once a depleted weapon's cooldown elapses (§10 three-layer model).
        if (player.charges <= 0 && c.reloadCd > 0) {
          c.reloadCd -= dt;
          if (c.reloadCd <= 0) player.charges = player.maxCharges;
        }
        if (canAct && player.charges > 0) {
          this.throwWeapon(player, c, weapon);
          player.charges -= 1;
          c.cd = weapon.cooldown; // flat (DEX is damage-only now; attack-speed scaling source OPEN)
          if (player.charges <= 0) c.reloadCd = weapon.thrown.refillSeconds;
        }
      } else if (weapon && canAct) {
        this.resolveSwing(player, c, weapon);
        c.cd = weapon.cooldown; // flat cooldown — DEX scales DAMAGE (via §10 grades), not speed
      }
      c.attacking = false;
    });

    // 5. Enemy AI — melee archetypes rush the nearest LIVING drifter; spitters KITE (§15). Duelists
    // (kind.melee) move + attack in stepDuelists, so they're skipped here.
    this.state.enemies.forEach((enemy) => {
      const kind = ENEMY_KINDS[enemy.kind];
      if (!kind || kind.melee) return;
      const target = nearestPoint(enemy, bodies);
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
    this.state.enemies.forEach((enemy) => {
      const r = resolvePoiCollision(
        this.map,
        enemy.x,
        enemy.y,
        ENEMY_KINDS[enemy.kind]?.radius ?? ENEMY_RADIUS,
      );
      enemy.x = r.x;
      enemy.y = r.y;
    });

    // 5.6 §17 PITFALL — a non-boss enemy whose body ends the tick over a pit falls in and DIES. This is
    // the "hazards hurt everything" rule (§17): kite the horde into a pit, or knock one in with a parry
    // (the knockback shoves it over the edge) = an instant kill. The boss is pit-immune. No XP — terrain
    // kills are free crowd control, not score.
    const fellIn: string[] = [];
    this.state.enemies.forEach((enemy, eid) => {
      if (eid === this.bossId) return;
      if (isPitAtPx(this.map, enemy.x, enemy.y)) fellIn.push(eid);
    });
    for (const eid of fellIn) this.state.enemies.delete(eid);

    // 6. Enemy contact damage (continuous DPS while touching a living player).
    this.state.enemies.forEach((enemy) => {
      const kind = ENEMY_KINDS[enemy.kind];
      if (!kind) return;
      this.state.players.forEach((player) => {
        if (!player.alive || player.flexPending > 0) return; // invincible in the §12 level window
        if ((this.combat.get(player.id)?.invuln ?? 0) > 0) return; // parry i-frames
        const reach = kind.radius + PLAYER_RADIUS;
        const dx = enemy.x - player.x;
        const dy = enemy.y - player.y;
        const dmgMul = enemy.tough ? TOUGH_DAMAGE_MULT : 1;
        if (dx * dx + dy * dy <= reach * reach) player.hp -= kind.contactDamage * dmgMul * dt;
      });
    });

    // 7. Always-on regen (§6), death, and POC respawn.
    this.state.players.forEach((player, id) => {
      const c = this.combat.get(id);
      if (!c) return;
      if (player.alive) {
        if (player.hp <= 0) {
          player.hp = 0;
          player.alive = false;
          c.respawn = RESPAWN_SECONDS;
        } else {
          player.hp = Math.min(player.maxHp, player.hp + deriveStats(player).regen * dt);
        }
      } else {
        c.respawn -= dt;
        if (c.respawn <= 0) {
          player.alive = true;
          player.hp = player.maxHp;
          player.x = this.map.spawnX;
          player.y = this.map.spawnY;
          // Clear the pile that coalesced on the spawn point so respawn isn't instant death.
          this.clearEnemiesNear(player.x, player.y, RESPAWN_CLEAR_RADIUS);
        }
      }
    });

    // 8. Tick the §12 level-up windows (auto-resolve a flex point if the 5s timer runs out).
    this.tickLevelWindows(dt);
  }

  /** Apply one weapon swing: forward-arc damage, plus an earthquake AoE for quake weapons.
   *  Damage scales with the player's level-up `power` (§12); kills grant XP. */
  private resolveSwing(player: PlayerState, c: CombatState, weapon: WeaponDef): void {
    const kills = new Set<string>();
    let xpGained = 0;
    const hit = (enemy: EnemyState, eid: string, dmg: number): void => {
      if (kills.has(eid)) return;
      enemy.hp -= dmg;
      if (enemy.hp <= 0) {
        // Dummies persist — reset HP instead of dying so you can keep testing on them.
        if (enemy.kind === "dummy") enemy.hp = DUMMY_HP;
        else {
          kills.add(eid);
          xpGained += (ENEMY_KINDS[enemy.kind]?.xpValue ?? 0) * (enemy.tough ? TOUGH_XP_MULT : 1);
          this.maybeDropWeapon(enemy); // §13 ronin sword drop
          // Boss down → open the extraction portal where it fell (§16).
          if (enemy.kind === "old-rust") this.openPortal(enemy.x, enemy.y);
        }
      }
    };

    // §14 WYSIWYG: each damage SOURCE scales independently. The EDGE (forward arc) uses the weapon's
    // own grades; the VFX/behavior sources below (chain, quake, …) carry their own grades and may scale
    // off DIFFERENT attributes (e.g. an INT-scaling magma burst on a STR/DEX blade).
    const edgePower = effectiveDamageMult(weapon, weapon.scalingGrades, player); // §10 edge grades × §11 req penalty

    // Forward arc — also capture the nearest struck enemy as the chain-lightning SEED, and remember
    // every arc-hit enemy so the chain leaps to OTHER enemies (not ones the cut already hit).
    const struckArc = new Set<string>();
    let seedX = 0;
    let seedY = 0;
    let seedFound = false;
    let seedBestD = Infinity;
    this.state.enemies.forEach((enemy, eid) => {
      if (inMeleeArc(player, c.aimX, c.aimY, enemy, weapon.range, weapon.halfArc)) {
        hit(enemy, eid, weapon.damage * edgePower);
        struckArc.add(eid);
        const d = (enemy.x - player.x) ** 2 + (enemy.y - player.y) ** 2;
        if (d < seedBestD) {
          seedBestD = d;
          seedX = enemy.x;
          seedY = enemy.y;
          seedFound = true;
        }
      }
    });

    // Chain lightning (§10 on-hit proc): leap from the seed to the nearest UNHIT enemy, up to `jumps`
    // times; link n does damage × falloff^n × power. Target SELECTION is the shared `selectChainTargets`
    // (the client re-runs the identical pick for the bolt VFX — they cannot diverge). Damage routes
    // through hit() (dedupe/XP/portal for free).
    if (weapon.chainLightning && seedFound) {
      const cl = weapon.chainLightning;
      const clPower = effectiveDamageMult(weapon, cl.scalingGrades, player); // §14 source grades × §11 req penalty
      const candidates: ChainCandidate[] = [];
      this.state.enemies.forEach((enemy, eid) => {
        if (!kills.has(eid)) candidates.push({ id: eid, x: enemy.x, y: enemy.y });
      });
      const links = selectChainTargets(
        { x: seedX, y: seedY },
        candidates,
        cl.jumps,
        Math.min(cl.range, CHAIN_MAX_RANGE),
        struckArc, // arc-hit enemies are not chain targets
      );
      links.forEach((t, n) => {
        const enemy = this.state.enemies.get(t.id);
        if (enemy) hit(enemy, t.id, cl.damage * cl.falloff ** n * clPower);
      });
    }

    // Earthquake: erupts at the CURSOR, clamped to QUAKE_REACH from the player (§9 aim-at-cursor);
    // AoE damage to everything within radius of that epicenter (§14 VFX matches on the client via the
    // SAME shared clampQuakeEpicenter).
    if (weapon.quake) {
      const qPower = effectiveDamageMult(weapon, weapon.quake.scalingGrades, player); // §14 source grades × §11 req penalty
      const ep = clampQuakeEpicenter(player, { x: c.targetX, y: c.targetY }, QUAKE_REACH);
      const r2 = weapon.quake.radius * weapon.quake.radius;
      this.state.enemies.forEach((enemy, eid) => {
        const dx = enemy.x - ep.x;
        const dy = enemy.y - ep.y;
        if (dx * dx + dy * dy <= r2) hit(enemy, eid, (weapon.quake?.damage ?? 0) * qPower);
      });
    }

    // Scatter shot (§14 WYSIWYG): fling real magma projectiles that each deal an INT-scaled hit + explode.
    // Fired as live projectiles (server-authoritative) — they advance + detonate in stepProjectiles.
    if (weapon.scatter) this.fireScatter(player, c, weapon);

    for (const eid of kills) this.state.enemies.delete(eid);
    if (xpGained > 0) this.grantXp(xpGained);
  }

  /** §12: XP is SQUAD-SHARED — every kill levels the whole squad in lockstep (not just the killer). */
  private grantXp(amount: number): void {
    this.state.players.forEach((player) => {
      this.levelUpPlayer(player, amount);
    });
  }

  /** Add XP to one player; each level reached (capped at 30) grants the §12 3-point allocation. */
  private levelUpPlayer(player: PlayerState, amount: number): void {
    if (player.level >= LEVEL_CAP) return;
    player.xp += amount;
    while (player.xp >= player.xpToNext && player.level < LEVEL_CAP) {
      player.xp -= player.xpToNext;
      player.level += 1;
      // 2 auto points: +1 class attr, +1 requirement attr (§12). The 3rd is the FLEX pick.
      this.allocate(player, M0_CLASS_ATTR, 1);
      this.allocate(player, M0_REQ_ATTR, 1);
      player.flexPending += 1;
      player.flexTimer = LEVELUP_WINDOW_SECONDS; // open/refresh the invincible pick window
      player.xpToNext = xpToNextLevel(player.level);
    }
    if (player.level >= LEVEL_CAP) player.xp = 0;
  }

  /** Allocate `n` points into an attribute and re-derive maxHp (CON), topping up the gained HP. */
  private allocate(player: PlayerState, attr: Attr, n: number): void {
    player[attr] += n;
    const prevMax = player.maxHp;
    player.maxHp = deriveStats(player).maxHp;
    if (player.maxHp > prevMax) player.hp += player.maxHp - prevMax; // gain the new HP immediately
  }

  /** Consume one pending flex point; close the window (or refresh its timer) accordingly. */
  private consumeFlex(player: PlayerState): void {
    player.flexPending = Math.max(0, player.flexPending - 1);
    player.flexTimer = player.flexPending > 0 ? LEVELUP_WINDOW_SECONDS : 0;
  }

  /** §12 window: count down each open pick; on timeout auto-spend the flex into the class attr. */
  private tickLevelWindows(dt: number): void {
    this.state.players.forEach((player) => {
      if (player.flexPending <= 0) return;
      player.flexTimer -= dt;
      if (player.flexTimer <= 0) {
        this.allocate(player, M0_CLASS_ATTR, 1); // "pick in time or you exit it" → default to class
        this.consumeFlex(player);
      }
    });
  }

  /** Spitters fire a projectile at the nearest living player on a cooldown (§15 ranged threat). */
  private stepSpitters(dt: number, bodies: Vec2[]): void {
    // Prune cooldowns for enemies that have died/left.
    for (const id of [...this.enemyFireCd.keys()]) {
      if (!this.state.enemies.has(id)) this.enemyFireCd.delete(id);
    }
    this.state.enemies.forEach((enemy, id) => {
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
        const dmg = ranged.damage * (enemy.tough ? TOUGH_DAMAGE_MULT : 1);
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
    const dmg = g.damage * effectiveDamageMult(weapon, g.scalingGrades, player);
    const explode = g.explode
      ? {
          radius: g.explode.radius,
          damage:
            g.explode.damage *
            effectiveDamageMult(weapon, g.explode.scalingGrades ?? g.scalingGrades, player),
        }
      : undefined;
    const pellets = Math.max(1, g.pellets ?? 1);
    const spread = g.spread ?? 0;
    const baseAng = Math.atan2(c.aimY, c.aimX);
    const ttl = g.range / g.projectileSpeed;
    // §9 spawn from the BARREL TIP (player centre + aim × the gun's own muzzle reach), not the body.
    const reach = gunMuzzleReach(weapon);
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
  }

  /** Hurl a thrown weapon at the player's aim — a friendly, STR-scaled, piercing projectile (§10). */
  private throwWeapon(player: PlayerState, c: CombatState, weapon: WeaponDef): void {
    const t = weapon.thrown;
    if (!t) return;
    const dmg = t.damage * effectiveDamageMult(weapon, t.scalingGrades, player); // §14 source grades × §11 req penalty
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
    const ballDmg = sc.damage * effectiveDamageMult(weapon, sc.scalingGrades, player);
    const pierce = sc.pierce ?? 1;
    // The blast inherits the scatter's grades unless it overrides them; bake its damage once here.
    const explode = sc.explode
      ? {
          radius: sc.explode.radius,
          damage:
            sc.explode.damage *
            effectiveDamageMult(weapon, sc.explode.scalingGrades ?? sc.scalingGrades, player),
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
      enemy.hp -= damage;
      if (enemy.hp <= 0) {
        if (enemy.kind === "dummy") {
          enemy.hp = DUMMY_HP;
        } else {
          if (enemy.kind === "old-rust") this.openPortal(enemy.x, enemy.y);
          xpGained += (ENEMY_KINDS[enemy.kind]?.xpValue ?? 0) * (enemy.tough ? TOUGH_XP_MULT : 1);
          this.maybeDropWeapon(enemy); // §13 ronin sword drop
          kills.push(eid);
        }
      }
    });
    for (const eid of kills) this.state.enemies.delete(eid);
    if (xpGained > 0) this.grantXp(xpGained);
  }

  /** §15 duelists (ronin): close to `melee.approach`, telegraph `windup`, then swing `hits` times (each
   *  an arc hit toward the nearest player), then `recover`. Movement + the combo state machine. */
  private stepDuelists(dt: number, bodies: Vec2[]): void {
    for (const id of [...this.comboState.keys()]) {
      if (!this.state.enemies.has(id)) this.comboState.delete(id);
    }
    this.state.enemies.forEach((enemy, id) => {
      const kind = ENEMY_KINDS[enemy.kind];
      const m = kind?.melee;
      if (!m) return;
      const target = nearestPoint(enemy, bodies);
      let st = this.comboState.get(id);
      if (!st) {
        st = { phase: "idle", t: 0, hits: 0 };
        this.comboState.set(id, st);
      }
      const dist = target
        ? Math.hypot(target.x - enemy.x, target.y - enemy.y)
        : Number.POSITIVE_INFINITY;
      // Move toward the target only while idle + out of reach; hold position through the combo.
      if (st.phase === "idle" && target && dist > m.approach) {
        const next = stepEnemyChase({ x: enemy.x, y: enemy.y }, target, kind.speed, dt);
        enemy.x = next.x;
        enemy.y = next.y;
      }
      st.t -= dt;
      if (st.phase === "idle") {
        if (target && dist <= m.approach) {
          st.phase = "windup";
          st.t = m.windup;
        }
      } else if (st.phase === "windup") {
        if (st.t <= 0) {
          st.phase = "swing";
          st.hits = m.hits;
          this.duelistSwing(enemy, target, m);
          st.hits -= 1;
          st.t = m.swingGap;
        }
      } else if (st.phase === "swing") {
        if (st.t <= 0) {
          if (st.hits > 0) {
            this.duelistSwing(enemy, target, m);
            st.hits -= 1;
            st.t = m.swingGap;
          } else {
            st.phase = "recover";
            st.t = m.recover;
          }
        }
      } else if (st.t <= 0) {
        st.phase = "idle"; // recover done
      }
    });
  }

  /** One duelist swing: bump `atkSeq` (client animates) + arc-damage players in front (parry dodges). */
  private duelistSwing(
    enemy: EnemyState,
    target: Vec2 | null,
    m: { range: number; halfArc: number; damage: number },
  ): void {
    enemy.atkSeq = (enemy.atkSeq + 1) % 100000;
    const aimX = target ? target.x - enemy.x : 1;
    const aimY = target ? target.y - enemy.y : 0;
    const dmgMul = enemy.tough ? TOUGH_DAMAGE_MULT : 1;
    this.state.players.forEach((player) => {
      if (!player.alive || player.flexPending > 0) return;
      if ((this.combat.get(player.id)?.invuln ?? 0) > 0) return; // parry i-frames dodge it
      if (inMeleeArc(enemy, aimX, aimY, player, m.range, m.halfArc)) {
        player.hp -= m.damage * dmgMul;
      }
    });
  }

  /** §13 weapon drop: when a wielding enemy dies, roll its `dropWeapon` chance → spawn a grabbable pickup. */
  private maybeDropWeapon(enemy: EnemyState): void {
    const kind = ENEMY_KINDS[enemy.kind];
    if (!kind?.wieldsWeapon || !kind.dropWeapon) return;
    if (Math.random() > kind.dropWeapon) return;
    const pk = new PickupState();
    pk.id = `drop${this.pickupSeq++}`;
    pk.weapon = kind.wieldsWeapon;
    pk.x = enemy.x;
    pk.y = enemy.y;
    this.state.pickups.set(pk.id, pk);
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
          pr.x = hitPoi.x + ux * (MAP_POI_RADIUS + PROJECTILE_RADIUS);
          pr.y = hitPoi.y + uy * (MAP_POI_RADIUS + PROJECTILE_RADIUS);
          meta.hit.clear();
          meta.pierce = meta.pierceMax ?? meta.pierce;
          meta.ttl += meta.legTtl ?? 0;
        } else {
          doomed.push(id);
          return;
        }
      }
      if (meta.hostile) {
        let hit = false;
        this.state.players.forEach((player) => {
          if (hit || !player.alive || player.flexPending > 0) return;
          if ((this.combat.get(player.id)?.invuln ?? 0) > 0) return; // parry dodges it
          const reach = PROJECTILE_RADIUS + PLAYER_RADIUS;
          const dx = pr.x - player.x;
          const dy = pr.y - player.y;
          if (dx * dx + dy * dy <= reach * reach) {
            player.hp -= meta.damage;
            hit = true;
          }
        });
        if (hit) doomed.push(id);
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
            enemy.hp -= meta.damage;
            if (enemy.hp <= 0) {
              if (enemy.kind === "dummy") enemy.hp = DUMMY_HP;
              else {
                if (enemy.kind === "old-rust") this.openPortal(enemy.x, enemy.y);
                xpGained +=
                  (ENEMY_KINDS[enemy.kind]?.xpValue ?? 0) * (enemy.tough ? TOUGH_XP_MULT : 1);
                this.maybeDropWeapon(enemy); // §13 ronin sword drop
                kills.push(eid);
              }
            }
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
        if (!player.alive || player.flexPending > 0) return;
        const dx = player.x - zone.x;
        const dy = player.y - zone.y;
        if (dx * dx + dy * dy <= r2) player.hp -= ZONE_DPS * dt;
      });
    });
    for (const id of doomed) {
      this.state.zones.delete(id);
      this.zoneMeta.delete(id);
    }
  }

  /** Spawn enemies on a ring around a random player, accelerating with run time (§5/§6). */
  private runSpawnDirector(dt: number, anchors: Vec2[]): void {
    if (anchors.length === 0) return; // nobody to hunt — pause spawning
    this.spawnAccum += dt;
    const interval = spawnInterval(this.state.elapsed);
    while (this.spawnAccum >= interval && this.state.enemies.size < MAX_ENEMIES) {
      this.spawnAccum -= interval;
      this.spawnEnemy(anchors);
    }
  }

  private spawnEnemy(anchors: Vec2[]): void {
    const kindId = pickEnemyKind(Math.random());
    const kind = ENEMY_KINDS[kindId];
    if (!kind) return;
    const anchor = anchors[Math.floor(Math.random() * anchors.length)] ?? anchors[0];
    if (!anchor) return;

    // Appear on a ring just beyond a typical screen edge, then converge inward.
    const angle = Math.random() * Math.PI * 2;
    const m = ENEMY_RADIUS + 4;
    const players = this.state.players.size;
    const enemy = new EnemyState();
    enemy.id = `e${this.enemySeq++}`;
    enemy.kind = kindId;
    // Tough tier (§15): rolls more likely with run time AND player count (§6). Swarm stays trash.
    enemy.tough =
      kind.archetype !== "swarm" && Math.random() < toughChance(this.state.elapsed, players);
    // §6: spongier with more players (equalises death rate vs combined DPS). 1.0 solo.
    enemy.hp = kind.hp * (enemy.tough ? TOUGH_HP_MULT : 1) * enemyHpScale(players);
    const ex = clamp(anchor.x + Math.cos(angle) * SPAWN_RING, m, ARENA_WIDTH - m);
    const ey = clamp(anchor.y + Math.sin(angle) * SPAWN_RING, m, ARENA_HEIGHT - m);
    // §17 don't spawn inside a pit (instant fall) or a POI (a one-tick shove-out teleport) — nudge clear.
    const sp = this.safeSpawnPos(ex, ey, kind.radius);
    enemy.x = sp.x;
    enemy.y = sp.y;
    this.state.enemies.set(enemy.id, enemy);
  }

  /** §17 nudge a spawn position onto solid GROUND and OUT of any POI obstacle, so nothing spawns inside a
   *  pit or a landmark and then teleports out on the next tick (the review caught this for enemies + the boss). */
  private safeSpawnPos(x: number, y: number, radius: number): Vec2 {
    let nx = x;
    let ny = y;
    if (isPitAtPx(this.map, nx, ny)) {
      const g = nearestGroundPx(this.map, nx, ny);
      nx = g.x;
      ny = g.y;
    }
    if (isInsidePoi(this.map, nx, ny)) {
      const safe = resolvePoiCollision(this.map, nx, ny, radius);
      nx = safe.x;
      ny = safe.y;
    }
    return { x: nx, y: ny };
  }

  /** Spawn the boss OLD RUST on a ring around a player (§16) — the run's capstone threat. */
  private spawnBoss(): void {
    const kind = ENEMY_KINDS["old-rust"];
    if (!kind) return;
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
    boss.kind = "old-rust";
    boss.hp = kind.hp * enemyHpScale(this.state.players.size); // §6 boss HP-sponge × players
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
    const sp = this.safeSpawnPos(bx, by, kind.radius);
    boss.x = sp.x;
    boss.y = sp.y;
    this.state.enemies.set(boss.id, boss);
    this.bossSpawned = true;
    this.bossId = boss.id;
    console.log(`[room ${this.roomId}] ⚠ OLD RUST approaches`);
  }

  /** Open the extraction portal where the boss fell (§16). */
  private openPortal(x: number, y: number): void {
    this.state.portalOpen = true;
    this.state.portalX = x;
    this.state.portalY = y;
    this.bossId = null;
    console.log(`[room ${this.roomId}] OLD RUST defeated — extraction portal open`);
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
        // Clean the field for the win screen.
        this.state.enemies.clear();
        this.state.projectiles.clear();
        this.projectileMeta.clear();
        this.enemyFireCd.clear();
        console.log(`[room ${this.roomId}] run extracted — VICTORY`);
        return;
      }
    }
  }
}
