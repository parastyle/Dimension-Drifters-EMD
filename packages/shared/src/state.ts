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
  /** §7 chosen CHARACTER skin (keys the sprite manifest) — cosmetic; cycled with the C key. Synced so
   *  teammates see who you're playing. Defaults to the Drifter. */
  @type("string") character = "drifter";
  /** §9 aim direction (radians, atan2 of the cursor aim) — synced so EVERY client can point a player's
   *  held GUN barrel + render their shots along their real aim. The local player uses its own live cursor;
   *  this drives remote players' gun pose. Updated server-side from the aim each shot. */
  @type("number") aimDir = 0;
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
  /** §8 owned parry augments — CSV of augment ids (repeats = stacks). Drives the parry handler's offense
   *  (server) + the owned-augment HUD (client). */
  @type("string") augments = "";
  /** §8/§12 signature picks owed (one per 5th level). While > 0 the level-up window stays open offering
   *  an augment draft; the player is frozen + immune just like the flex-point pick. */
  @type("number") sigPending = 0;
  /** §8 the current 3-of-9 augment DRAFT offered for the open signature pick — CSV of augment ids. */
  @type("string") sigOffer = "";
  /** Thrown-weapon charges remaining + max (§9/§10 charge readout). 0/0 = not a thrown weapon. */
  @type("number") charges = 0;
  @type("number") maxCharges = 0;
  /** §13 salvage-bag stub: count of weapons salvaged (hold-drop). The real parts economy (§13) isn't
   *  built yet — this just tallies + drives the HUD readout so the hold-to-salvage action has feedback. */
  @type("number") salvaged = 0;
  /** §5/§20 jump (Stage B): HEIGHT in px above the ground (0 = grounded). A real vertical axis under
   *  gravity — the jump seeds the upward velocity, the §8 parry-launch will add to it. Synced so every
   *  client lifts the rig; the server gates pit-falling on it (§17 — airborne, height>0, clears gaps). */
  @type("number") height = 0;
  /** §17 pit fall: increments each time this player falls into a pit. Synced ONLY as a client VFX trigger
   *  (dust poof + a local red flash) — the fall's damage/reposition is applied server-authoritatively. */
  @type("number") fellSeq = 0;
  /** §20 momentum layer (Stage A): impulse velocity (px/s) — the shove from gun recoil / hit knockback.
   *  Server integrates it into x/y each tick + decays it; synced so the client leans/jiggles the rig. */
  @type("number") vx = 0;
  @type("number") vy = 0;
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
  /** §15 duelist combo: increments on each melee swing so the client triggers a swing animation. */
  @type("number") atkSeq = 0;
  /** §8 Brand augment: seconds remaining as Marked — takes ×BRAND_DAMAGE_MULT from all sources. Synced so
   *  the client can tint the marked enemy. 0 = not branded. */
  @type("number") branded = 0;
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
  /** Visual kind — keys the client's projectile renderer ("spit" enemy, "cleaver" thrown weapon,
   *  "magma" exploding scatter shot). */
  @type("string") kind = "spit";
  /** true = enemy attack (hits players); false = player throw (hits enemies). */
  @type("boolean") hostile = true;
  /** §14 WYSIWYG: if > 0, this projectile detonates an AoE of this px radius on death — the client
   *  renders an explosion of EXACTLY this size so the visual matches the server hitbox. 0 = no blast. */
  @type("number") explodeR = 0;
}

export class ArenaState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type({ map: EnemyState }) enemies = new MapSchema<EnemyState>();
  @type({ map: PickupState }) pickups = new MapSchema<PickupState>();
  @type({ map: ProjectileState }) projectiles = new MapSchema<ProjectileState>();
  @type({ map: ZoneState }) zones = new MapSchema<ZoneState>();
  /**
   * §17 procedural arena seeds. The server mints these ONCE at room create (server-side `Math.random`)
   * and syncs them; every client feeds the same four into the shared `generateArena` (mapgen.ts) and
   * reproduces a byte-identical map locally — no tile streaming. Four independent streams so tuning one
   * pass (terrain shape vs hazard placement vs theme vs decor) doesn't reshuffle the others. All 0 until
   * the server seeds them (0 = "no map yet" — a client treats that as the empty open arena).
   */
  @type("number") seedTerrain = 0;
  @type("number") seedHazard = 0;
  @type("number") seedTheme = 0;
  @type("number") seedDecor = 0;
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
