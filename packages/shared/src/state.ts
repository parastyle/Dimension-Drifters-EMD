import { MapSchema, Schema, type } from "@colyseus/schema";
import { SCHEMA_VERSION } from "./constants.js";
import { DEFAULT_DIMENSION } from "./dimensions.js";

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
  /** §6 alive flag. `false` = DOWNED — dead until a rez weapon effect revives you (no auto-respawn); the
   *  body persists in-world + keeps its arsenal, and the player spectate-follows the squad. */
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
  /** §10 v0.104 the HELD weapon's loot identity: rarity tier (indexes shared RARITIES) + the single
   *  Terraria affix id. Rolled on the drop, applied on grab; a cycled/conjured weapon is Common/plain.
   *  The server multiplies every damage source + the cooldown by the derived loot mults; the card shows
   *  the same numbers (WYSIWYG). */
  @type("uint8") weaponRarity = 0;
  @type("string") weaponAffix = "";
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
  /** §8 successful-parry counter (Stage C): increments each time this player PARRIES a telegraphed enemy
   *  attack (negates it in the parry window). Synced ONLY as a client VFX trigger (white parry flash). */
  @type("number") parriedSeq = 0;
  /** §6 rez counter: increments each time this player is REVIVED by a rez weapon (Gravedigger's Spade).
   *  Synced ONLY as a client VFX trigger (the revive pop) — the heal itself is in `hp`/`alive`. */
  @type("number") revivedSeq = 0;
  // ── §4 v0.107 ONLINE NETCODE (client prediction + reconciliation) — all APPENDED (Colyseus serializes
  // by field order; appending keeps old offsets stable, and the SCHEMA_VERSION bump forces a reload anyway).
  /** Seq of the last input command the server CONSUMED for this player (uint32, client-minted, validated
   *  monotonic server-side). The owning client uses it to trim its pending-prediction buffer and rebase. */
  @type("uint32") ackSeq = 0;
  /** §7 the server's STEERED movement velocity (px/s) — the reconciliation rebase source. The owning
   *  client adopts these at each patch instead of reconstructing them from local history (the history
   *  reconstruction breaks under queue starvation / drop-to-newest — design review finding #2). */
  @type("number") mvx = 0;
  @type("number") mvy = 0;
  /** §5 vertical velocity (px/s) — synced so the predicting client can rebase its jump arc exactly. */
  @type("number") vh = 0;
  /** Bumped INSIDE `zeroMoveVel` — i.e. on EVERY server-side teleport/reposition (pit snap-back, rift
   *  descent, restart, training toggle, revive, and any future site). The owning client hard-resyncs its
   *  predictor on a change instead of hand-mirroring the server's teleport call sites (review #7). */
  @type("uint32") teleportSeq = 0;
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
  /** §8 white-tell TELEGRAPH (Stage C): windup progress 0→1 of a parryable attack (0 = not telegraphing).
   *  Synced so the client ramps the enemy WHITE + shrinks the rhythm ring; the swing lands (and is
   *  parryable) as it peaks at 1. The §8 universal cue: white = parryable. */
  @type("number") windup = 0;
}

/** A lingering corrosive puddle dropped by a zoner (§15) — DoTs players standing inside. */
export class ZoneState extends Schema {
  @type("string") id = "";
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") radius = 0;
}

/**
 * §16 GENERIC TELEGRAPH — one synced danger footprint the client renders. The backbone of the
 * data-driven boss framework's "show the landing zone": ANY boss can broadcast N heterogeneous
 * danger shapes at once (landing circles, expanding rings, cones, beam/dash lanes, bullet-origin
 * warnings), replacing the single hardcoded `bossSlam` triple. A row is CREATED when a windup
 * begins and DELETED the tick the attack resolves; the client edge-fires the impact VFX on removal
 * (the same pattern `renderBossSlam` used on `bossSlamT` high→0). Only `t` (the fill) mutates per
 * tick, so a live telegraph costs ~1 changed field/tick — as cheap as `bossSlamT` was.
 *
 * CRUCIAL: telegraphs are AUTHORITATIVE state read DIRECTLY (never snapshot-interpolated like a
 * body, never client-guessed), and every row is authored at a FIXED world coord (the predicted
 * LAND point), so all clients paint the identical danger at the identical fill even though the
 * boss body renders ~120ms behind on interp (§4). `danger` carries the §8 parry-language colour.
 */
export class TelegraphState extends Schema {
  /** "tg{seq}" minted server-side, like projectile ids. */
  @type("string") id = "";
  /** 0 circle · 1 ring (expanding donut) · 2 cone/wedge · 3 rect (beam/dash lane) · 4 arc-sweep ·
   *  5 point-warn (bullet origin). The client switches its geometry on this; all share one fill-to-`t` path. */
  @type("uint8") shape = 0;
  /** Epicentre / lane origin — a FIXED world coordinate, never parented to the moving body. */
  @type("number") x = 0;
  @type("number") y = 0;
  /** Primary size: circle/ring radius · rect length · cone reach. */
  @type("number") a = 0;
  /** Secondary size: rect half-width · cone half-arc (rad) · ring inner-radius · 0 if unused. */
  @type("number") b = 0;
  /** Orientation radians (cone/rect/beam aim) — authored server-side, never derived from stale facing. */
  @type("number") rot = 0;
  /** Fill progress 0→1 over the windup; the client eases the danger fill toward this. Replaces `bossSlamT`. */
  @type("number") t = 0;
  /** 0 = parryable (WHITE, §8) · 1 = unparryable (RED, dodge-only). Carries the §8 colour into the sync. */
  @type("uint8") danger = 0;
  /** Cosmetic sub-style for the renderer (slam vs beam vs summon-marker) — art differs without new shapes. */
  @type("uint8") kindTag = 0;
}

/** A weapon lying on the ground — the Testing-Grounds gallery, a player drop, or (v0.104 §13) an in-run
 *  LOOT drop. Loot drops are MYSTERY: `known=false` hides the identity client-side (the pickup renders as
 *  a rarity-tinted bundle, cursed = the §10 ghostly-purple gamble cue) until it's grabbed; the gallery,
 *  player drops, and wielding-enemy drops stay identity-known. `rarity` indexes shared RARITIES; `affix`
 *  is the §10 single Terraria affix id rolled at drop time. */
export class PickupState extends Schema {
  @type("string") id = "";
  @type("number") x = 0;
  @type("number") y = 0;
  @type("string") weapon = "";
  @type("uint8") rarity = 0;
  @type("string") affix = "";
  @type("boolean") known = true;
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
  /** §4 schema handshake (audit) — FIRST field (index 0) so it stays decodable even if later fields get
   *  reordered; the client compares it to its own SCHEMA_VERSION on join and prompts a reload on mismatch
   *  rather than rendering corrupt state. Bump SCHEMA_VERSION (constants.ts) on any synced-field change. */
  @type("uint16") schemaVersion = SCHEMA_VERSION;
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
  /** §17 the active DIMENSION id (keys the shared `DIMENSIONS` registry) — scopes the server's spawn roster
   *  + boss and drives the client's palette + POI/decal/tile asset sets. A run is a chain of these (§6). */
  @type("string") dimensionId = DEFAULT_DIMENSION;
  /** Run outcome (§16): "active" while playing, "victory" once a player extracts, "defeat" on a §6 wipe. */
  @type("string") outcome = "active";
  /** Extraction portal — opened when the dimension boss falls; step in to BANK the squad's carried
   *  salvage and end the run in victory (§6 "bank now"). */
  @type("boolean") portalOpen = false;
  @type("number") portalX = 0;
  @type("number") portalY = 0;
  /** §6 chain (v0.103): the DEEPER rift — opens beside the extraction portal; HOLD it (a channel, not a
   *  tripwire) to DESCEND the squad to depth+1 (same squad/levels/weapons/HP, harder everything, bigger
   *  potential bank). `riftCharge` is the synced 0→1 channel progress the client draws as a filling ring. */
  @type("boolean") riftOpen = false;
  @type("number") riftX = 0;
  @type("number") riftY = 0;
  @type("number") riftCharge = 0;
  /** §6 chain depth — 1 on a fresh run, +1 per rift descent. Drives the H2 difficulty scaling + the HUD. */
  @type("uint8") depth = 1;
  /** §6/§13 the squad's BANKED salvage (v0.103 "bank or lose"): carried `player.salvaged` is deposited
   *  here on extraction and LOST on a wipe. Survives restarts within the room session (the M0 "account"). */
  @type("number") bankedSalvage = 0;
  /** §16 OLD RUST phase (0 = no boss · 1 paces/bullet-walls · 2 +punch-slams · 3 enrage). Drives the
   *  client's heat-haze/aggression tell. */
  @type("number") bossPhase = 0;
  /** §16 P2 punch-slam TELEGRAPH: epicentre + progress 0→1 (0 = no slam pending). The client draws a red
   *  shrinking warning ring; at 1 the server fires the unparryable hit. */
  @type("number") bossSlamX = 0;
  @type("number") bossSlamY = 0;
  @type("number") bossSlamT = 0;
  /** §4 v0.107 the authoritative SIM TICK counter — +1 per fixed 50ms sub-step, unconditionally (unlike
   *  `elapsed`, which freezes outside active arena play). The client's snapshot-interpolation timeline:
   *  every patch is stamped `tick × TICK_MS` so remote entities interpolate on the SERVER's clock, immune
   *  to TCP burst-arrival jitter (review #6). Also guarantees every tick's patch has a change to send. */
  @type("uint32") tick = 0;
  /** §16 v0.109 GENERIC TELEGRAPH map — every active boss danger footprint (landing zones / rings / beams /
   *  dash lanes / bullet warnings). Appended after `tick` (append-only: field offsets before it are frozen).
   *  Replaces the single `bossSlamX/Y/T` triple, which stays at 0 forever (kept only for offset stability).
   *  The client renders these generically via `renderTelegraphs` regardless of which boss is up. */
  @type({ map: TelegraphState }) telegraphs = new MapSchema<TelegraphState>();
  /** §16 v0.109 the active BOSS DEFINITION id (keys the shared `BOSSES` registry) — lets the client label the
   *  boss bar with the real boss name + pick per-boss cosmetic tints. "" while no boss is up. */
  @type("string") bossKind = "";

  /** §29 belt-scroller room progression. `beltLockX` = the world-x the camera + movement lock to while a
   *  room's wave is uncleared (a closed gate); 0 = open (no lock). `beltRoomName` labels the room banner. */
  @type("number") beltLockX = 0;
  @type("string") beltRoomName = "";
}
