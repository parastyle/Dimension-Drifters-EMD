import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  ArenaState,
  ATTRS,
  type Attr,
  BOSS_SPAWN_SECONDS,
  DEFAULT_WEAPON,
  DUMMY_HP,
  deriveStats,
  ENEMY_KINDS,
  ENEMY_RADIUS,
  EnemyState,
  EXTRACT_RADIUS,
  enemyHpScale,
  inMeleeArc,
  LEVEL_CAP,
  LEVELUP_WINDOW_SECONDS,
  M0_CLASS_ATTR,
  M0_REQ_ATTR,
  MAX_ENEMIES,
  MAX_PLAYERS,
  MOVE_SPEED,
  type MoveInput,
  nearestPoint,
  nextWeapon,
  PARRY_COOLDOWN,
  PARRY_IFRAMES,
  PARRY_KNOCKBACK,
  PARRY_RADIUS,
  PICKUP_RADIUS,
  PickupState,
  PLAYER_MAX_HP,
  PLAYER_RADIUS,
  PlayerState,
  PROJECTILE_RADIUS,
  PROJECTILE_TTL,
  ProjectileState,
  pickEnemyKind,
  QUAKE_REACH,
  RESPAWN_CLEAR_RADIUS,
  RESPAWN_SECONDS,
  resolveBodyCollisions,
  SPAWN_RING,
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
  WEAPON_IDS,
  WEAPONS,
  type WeaponDef,
  weaponDamageMult,
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
  /** Server-side projectile metadata not worth syncing. Keyed by projectile id. */
  private readonly projectileMeta = new Map<
    string,
    { ttl: number; damage: number; hostile: boolean; pierce: number; hit: Set<string> }
  >();
  /** Per-zoner puddle-drop cooldown (sec), keyed by enemy id; pruned with the enemy. */
  private readonly zonerDropCd = new Map<string, number>();
  /** Per-zone remaining lifetime (sec), keyed by zone id. */
  private readonly zoneMeta = new Map<string, number>();
  /** Spawn-director accumulator + monotonic enemy/projectile/zone id counters. */
  private spawnAccum = 0;
  private enemySeq = 0;
  private projectileSeq = 0;
  private zoneSeq = 0;
  /** §16 boss/extraction run loop: has OLD RUST spawned this run, and its enemy id. */
  private bossSpawned = false;
  private bossId: string | null = null;

  override onCreate(): void {
    this.setState(new ArenaState());

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

    // Toggle the Testing Grounds (§21): stop spawns, swap the swarm for dummies + weapon pickups.
    this.onMessage("toggleTraining", () => this.toggleTraining());

    // Restart the run (playtest QoL): wipe the horde, reset the clock, revive everyone fresh.
    // Any player can call it — co-op shares one run.
    this.onMessage("restart", () => this.restartRun());

    // Debug/playtest: summon the boss now instead of waiting for the timed spawn (B key).
    this.onMessage("spawnBoss", () => {
      if (this.state.mode === "arena" && !this.bossSpawned) this.spawnBoss();
    });

    // §12 level-up window: the player spends their FLEX point on an attribute.
    this.onMessage("chooseAttribute", (client, message: { attr?: string }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || player.flexPending <= 0) return;
      const attr = message?.attr as Attr | undefined;
      if (!attr || !ATTRS.includes(attr)) return;
      this.allocate(player, attr, 1);
      this.consumeFlex(player);
    });

    this.setSimulationInterval((deltaMs) => this.update(deltaMs), TICK_MS);
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
      player.x = ARENA_WIDTH / 2 + (Math.random() * 200 - 100);
      player.y = ARENA_HEIGHT / 2 + (Math.random() * 200 - 100);
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
    // Spawn near arena center with a little scatter so blobs don't perfectly overlap.
    player.x = ARENA_WIDTH / 2 + (Math.random() * 200 - 100);
    player.y = ARENA_HEIGHT / 2 + (Math.random() * 200 - 100);
    this.state.players.set(client.sessionId, player);
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
    });
    console.log(`[room ${this.roomId}] +join ${client.sessionId} (${this.clients.length} online)`);
  }

  override onLeave(client: Client): void {
    this.state.players.delete(client.sessionId);
    this.inputs.delete(client.sessionId);
    this.combat.delete(client.sessionId);
    console.log(`[room ${this.roomId}] -leave ${client.sessionId} (${this.clients.length} online)`);
  }

  private update(deltaMs: number): void {
    const dt = deltaMs / 1000;

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
    } else {
      // Testing Grounds: walk over a weapon pickup to equip it.
      this.state.players.forEach((player) => {
        if (!player.alive) return;
        this.state.pickups.forEach((pk) => {
          const dx = pk.x - player.x;
          const dy = pk.y - player.y;
          if (dx * dx + dy * dy <= PICKUP_RADIUS * PICKUP_RADIUS) player.weapon = pk.weapon;
        });
      });
    }

    // 4. Resolve attacks (cooldown-gated). Melee weapons swing; thrown weapons hurl a charge.
    this.state.players.forEach((player, id) => {
      const c = this.combat.get(id);
      if (!c) return;
      c.cd = Math.max(0, c.cd - dt);
      c.invuln = Math.max(0, c.invuln - dt);
      c.parryCd = Math.max(0, c.parryCd - dt);
      const weapon = WEAPONS[player.weapon] ?? WEAPONS[DEFAULT_WEAPON];

      // (Re)initialise the charge readout when the equipped weapon changes (§9/§10).
      if (c.lastWeapon !== player.weapon) {
        c.lastWeapon = player.weapon;
        c.reloadCd = 0;
        const max = weapon?.thrown?.charges ?? 0;
        player.charges = max;
        player.maxCharges = max;
      }

      const canAct = player.alive && player.flexPending <= 0 && c.attacking && c.cd <= 0;
      if (weapon?.thrown) {
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

    // 5. Enemy AI — melee archetypes rush the nearest LIVING drifter; spitters KITE (§15).
    this.state.enemies.forEach((enemy) => {
      const kind = ENEMY_KINDS[enemy.kind];
      if (!kind) return;
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
          player.x = ARENA_WIDTH / 2;
          player.y = ARENA_HEIGHT / 2;
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
          // Boss down → open the extraction portal where it fell (§16).
          if (enemy.kind === "old-rust") this.openPortal(enemy.x, enemy.y);
        }
      }
    };

    const power = weaponDamageMult(weapon, player); // §10 per-weapon attribute scaling grades

    // Forward arc.
    this.state.enemies.forEach((enemy, eid) => {
      if (inMeleeArc(player, c.aimX, c.aimY, enemy, weapon.range, weapon.halfArc)) {
        hit(enemy, eid, weapon.damage * power);
      }
    });

    // Earthquake: erupts at the CURSOR, clamped to QUAKE_REACH from the player (§9 aim-at-cursor);
    // AoE damage to everything within radius of that epicenter (§14 VFX matches on the client).
    if (weapon.quake) {
      let ex = c.targetX;
      let ey = c.targetY;
      const adx = ex - player.x;
      const ady = ey - player.y;
      const adist = Math.hypot(adx, ady);
      if (adist > QUAKE_REACH) {
        ex = player.x + (adx / adist) * QUAKE_REACH;
        ey = player.y + (ady / adist) * QUAKE_REACH;
      }
      const r2 = weapon.quake.radius * weapon.quake.radius;
      this.state.enemies.forEach((enemy, eid) => {
        const dx = enemy.x - ex;
        const dy = enemy.y - ey;
        if (dx * dx + dy * dy <= r2) hit(enemy, eid, (weapon.quake?.damage ?? 0) * power);
      });
    }

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
        this.fireProjectile(enemy, target, ranged.projectileSpeed, dmg);
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
    this.state.projectiles.set(pr.id, pr);
    this.projectileMeta.set(pr.id, { ttl, damage, hostile, pierce, hit: new Set() });
  }

  /** Hurl a thrown weapon at the player's aim — a friendly, STR-scaled, piercing projectile (§10). */
  private throwWeapon(player: PlayerState, c: CombatState, weapon: WeaponDef): void {
    const t = weapon.thrown;
    if (!t) return;
    const dmg = t.damage * weaponDamageMult(weapon, player); // §10 per-weapon scaling grades
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

  /** Advance every projectile, expire at TTL/arena edge. HOSTILE projectiles hit players (parry-/
   *  level-immune); FRIENDLY (thrown) projectiles cut through enemies up to their pierce count. */
  private stepProjectiles(dt: number): void {
    const doomed: string[] = [];
    this.state.projectiles.forEach((pr, id) => {
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      const meta = this.projectileMeta.get(id);
      if (meta) meta.ttl -= dt;
      if (
        !meta ||
        meta.ttl <= 0 ||
        pr.x < 0 ||
        pr.x > ARENA_WIDTH ||
        pr.y < 0 ||
        pr.y > ARENA_HEIGHT
      ) {
        doomed.push(id);
        return;
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
                kills.push(eid);
              }
            }
          }
        });
        for (const eid of kills) this.state.enemies.delete(eid);
        if (xpGained > 0) this.grantXp(xpGained);
        if (meta.pierce <= 0) doomed.push(id);
      }
    });
    for (const id of doomed) {
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
    enemy.x = clamp(anchor.x + Math.cos(angle) * SPAWN_RING, m, ARENA_WIDTH - m);
    enemy.y = clamp(anchor.y + Math.sin(angle) * SPAWN_RING, m, ARENA_HEIGHT - m);
    this.state.enemies.set(enemy.id, enemy);
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
    boss.x = clamp(anchor.x + Math.cos(angle) * SPAWN_RING, kind.radius, ARENA_WIDTH - kind.radius);
    boss.y = clamp(
      anchor.y + Math.sin(angle) * SPAWN_RING,
      kind.radius,
      ARENA_HEIGHT - kind.radius,
    );
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

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
