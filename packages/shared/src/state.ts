import { MapSchema, Schema, type } from "@colyseus/schema";

/**
 * Authoritative networked state (Colyseus Schema). Lives in `shared` so client and
 * server bind to the SAME class instance (§27.1 single source of truth).
 *
 * §4 Tier 1 (hard sync): players are full authoritative state. This is the only tier
 * the netcode-handshake POC implements. Toughs/bosses/loot (also Tier 1) and the
 * Tier 2/3 horde + bullets come later. StateView area-of-interest filtering (§4) is
 * not wired yet — fine at 2–4 players, required before the 10-player load test.
 */
export class PlayerState extends Schema {
  @type("string") id = "";
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") hp = 100;
  @type("number") maxHp = 100;
  /** Downed players are dead until respawn (POC) / rez (§6). */
  @type("boolean") alive = true;
  /** Equipped weapon id (keys WEAPONS + the sprite manifest). */
  @type("string") weapon = "rusty-cleaver";
  /** §12 leveling (synced for the HUD). XP is squad-shared, so all players level in lockstep. */
  @type("number") level = 1;
  /** Current XP toward the next level. */
  @type("number") xp = 0;
  /** XP needed to reach the next level (xpToNextLevel(level)). */
  @type("number") xpToNext = 6;
  /** The five attributes (§11), all starting at 1 (the 1/1/1/1/1 spread). Drive derived combat stats. */
  @type("number") str = 1;
  @type("number") dex = 1;
  @type("number") int = 1;
  @type("number") con = 1;
  @type("number") luk = 1;
  /** Unspent FLEX points awaiting allocation (§12). While > 0 the player is in the invincible,
   *  untargeted level-up window (frozen + immune) choosing where to spend each flex point. */
  @type("number") flexPending = 0;
  /** Seconds left in the current level-up window (counts down from LEVELUP_WINDOW_SECONDS). */
  @type("number") flexTimer = 0;
  /** Thrown-weapon charges remaining + max (§9/§10 charge readout). 0/0 = not a thrown weapon. */
  @type("number") charges = 0;
  @type("number") maxCharges = 0;
}

/** One authoritative enemy (§15). Full Tier-1 sync for the POC (modest counts). */
export class EnemyState extends Schema {
  @type("string") id = "";
  /** Enemy kind id — keys ENEMY_KINDS and the sprite manifest. */
  @type("string") kind = "";
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") hp = 0;
  /** Tough tier (§15): bigger/glowier/buffed kin. Client renders the glow + scale-up. */
  @type("boolean") tough = false;
}

/** A lingering corrosive puddle dropped by a zoner (§15) — DoTs players standing inside. */
export class ZoneState extends Schema {
  @type("string") id = "";
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") radius = 0;
}

/** A weapon lying on the ground in Testing Grounds — walk over it to equip (§21). */
export class PickupState extends Schema {
  @type("string") id = "";
  @type("number") x = 0;
  @type("number") y = 0;
  @type("string") weapon = "";
}

/**
 * An in-flight enemy projectile (§15 spitter "bullet-heaven"). Damage is applied
 * server-authoritatively on the tick; the client renders + dead-reckons it from (x,y,vx,vy)
 * for smooth motion between 20Hz snapshots (the §4 Tier-3 "bullets are client-sim'd" feel,
 * but kept server-owned for honest damage at M0's modest counts).
 */
export class ProjectileState extends Schema {
  @type("string") id = "";
  @type("number") x = 0;
  @type("number") y = 0;
  /** Velocity, px/sec (synced so the client can extrapolate between snapshots). */
  @type("number") vx = 0;
  @type("number") vy = 0;
  /** Visual kind — keys the client's projectile renderer ("spit" enemy, "cleaver" thrown weapon). */
  @type("string") kind = "spit";
  /** true = enemy attack (hits players); false = player throw (hits enemies). */
  @type("boolean") hostile = true;
}

export class ArenaState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type({ map: EnemyState }) enemies = new MapSchema<EnemyState>();
  @type({ map: PickupState }) pickups = new MapSchema<PickupState>();
  @type({ map: ProjectileState }) projectiles = new MapSchema<ProjectileState>();
  @type({ map: ZoneState }) zones = new MapSchema<ZoneState>();
  /** Run time in seconds — drives spawn escalation (§6) and the HUD timer. */
  @type("number") elapsed = 0;
  /** "arena" (survival) | "training" (Testing Grounds — dummies + pickups, no spawns). */
  @type("string") mode = "arena";
  /** Run outcome (§16): "active" while playing, "victory" once a player extracts. */
  @type("string") outcome = "active";
  /** Extraction portal — opened when the boss OLD RUST falls; step in to win. */
  @type("boolean") portalOpen = false;
  @type("number") portalX = 0;
  @type("number") portalY = 0;
}
