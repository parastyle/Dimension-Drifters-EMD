import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";
import { DEFAULT_CHARACTER } from "./characters.js";
import { SCHEMA_VERSION } from "./constants.js";
import { DEFAULT_DIMENSION } from "./dimensions.js";
import type { Attr } from "./leveling.js";

/** §29 v0.118 one stored weapon in a player's ARSENAL — a 3-slot loadout plus a bag. Mirrors the loot
 *  identity carried on the held weapon (`weapon`/`weaponRarity`/`weaponAffix`) so a stowed weapon keeps its
 *  rarity, affix, and earned-provenance while it's not in hand. `weapon === ""` = an empty slot / bag entry. */
export class ArsenalSlot extends Schema {
  @type("string") weapon = "";
  @type("uint8") rarity = 0;
  @type("string") affix = "";
  /** Earned provenance used by weapon banking and B20 L3 disassembly eligibility. */
  @type("boolean") earned = false;
  // G-01 server-private combat ledger. These deliberately have no `@type`: only the active slot's
  // charges/maxCharges are presentation state, while stowed cooldown debt remains authoritative server data.
  resourceWeapon = "";
  resourceReady = false;
  cooldown = 0;
  reload = 0;
  resourceCharges = 0;
  // Weapon-bank identity is owner-private account/run state. It deliberately has no `@type`, so duplicate
  // definitions remain distinct without broadcasting account ids or adding steady 20 Hz patch bytes.
  instanceId = "";
  bankEntryId = "";
  bankProvenance = "";
  sourceWorldTier = 0;
  homeIssue = false;
}

/** Ultimate's nine-field wire row. Nested because PlayerState is at Colyseus's 64-field ceiling. */
export class UltimateState extends Schema {
  @type("uint8") archetype = 0;
  @type("uint8") charge = 0;
  @type("uint8") phase = 0;
  @type("uint16") seq = 0;
  @type("uint32") startTick = 0;
  @type("uint32") resolveTick = 0;
  @type("uint32") endTick = 0;
  @type("float32") targetX = 0;
  @type("float32") targetY = 0;
}

/** Schema-30 public projection of the server-private Drive float and beam lock epoch. */
export class WeaponResourceState extends Schema {
  /** Hundredths of one Drive point. Floored so presentation never overstates authority. */
  @type("uint16") valueQ = 10_000;
  /** 0 paused · 1 guaranteed floor · 2 pressure-earned engaged recovery. */
  @type("uint8") regenMode = 1;
  /** Absolute 20 Hz tick at which the current empty-beam minimum lock expires. */
  @type("uint32") beamLockEndTick = 0;
}

/** Run-scoped relic ownership. Counts are the only common-line truth; derived effects are computed. */
export class RelicState extends Schema {
  @type("uint8") energyPool = 0;
  @type("uint8") energyRegen = 0;
  @type("uint8") parryReach = 0;
  @type("uint8") dodgeRecovery = 0;
  @type("uint8") moveSpeed = 0;
  @type("uint8") hpRegen = 0;
  @type("uint8") luck = 0;
  @type("uint8") crit = 0;
  @type("uint8") jumpCount = 0;
  @type("string") ownedRare = "";
  @type("string") activeDodge = "";
  @type("boolean") reviveAvailable = false;
  @type("uint32") deathWardReadyTick = 0;
  @type("uint8") airJumpsRemaining = 0;
}

/** Read-only stand-in returned by the decode-window accessor below while the nested tail row is
 *  still undecoded on a fresh client join. Holds initializer values (a full bar); never mutated —
 *  the server always constructs real rows, so no write path can reach this instance. */
const DECODE_WINDOW_RESOURCE = new WeaponResourceState();

/** Player tail wire row. Nested because PlayerState is at Colyseus's 64-field ceiling. */
export class DualWieldState extends Schema {
  /** Retired schema-v27 composed-pair bytes. Keep these four positions and widths forever so the unrelated
   * live tenants below retain their exact wire indexes. They are never read or written by gameplay. */
  @type("uint8") retiredByte0 = 255;
  @type("uint32") retiredUint32 = 0;
  @type("uint8") retiredByte1 = 0;
  @type("uint8") retiredByte2 = 0;
  /** Schema v28 wire, current order: hat,glasses,facialHair,torso,cloak. */
  @type("string") gearUpper = "";
  /** Schema v28 wire, current order: gloves,head,boots. */
  @type("string") gearLower = "";
  /** Schema v30. Nested here because PlayerState's 64 direct field indexes are all occupied. */
  @type(WeaponResourceState) weaponResource = new WeaponResourceState();
  /** Schema v31. Compact public hat-tower count; the full account remains owner-private. */
  @type("uint8") prestige = 0;
  /** Schema v35. Run-scoped common stacks, rare ownership, and survival cooldown state. */
  @type(RelicState) relics = new RelicState();
  /** Schema v38. 0 normal · 1 active unauthored attack (75% input) · 2 root motion (input replaced). */
  @type("uint8") attackMoveMode = 0;
}

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
  /** §7 chosen CHARACTER skin (keys the sprite manifest). C may cycle this cosmetically mid-run. */
  @type("string") character: string = DEFAULT_CHARACTER;
  /** §9 aim direction (radians, atan2 of the cursor aim) — synced so EVERY client can point a player's
   *  held GUN barrel + render their shots along their real aim. The local player uses its own live cursor;
   *  this drives remote players' gun pose. Updated server-side from the aim each shot. */
  @type("number") aimDir = 0;
  /** §8 owned parry augments — CSV of augment ids (repeats = stacks). Drives the parry handler's offense
   *  (server) + the owned-augment HUD (client). */
  @type("string") augments = "";
  /** Thrown-weapon charges remaining + max (§9/§10 charge readout). 0/0 = not a thrown weapon. */
  @type("number") charges = 0;
  @type("number") maxCharges = 0;
  /** §10 v0.104 the HELD weapon's loot identity: rarity tier (indexes shared RARITIES) + the single
   *  Terraria affix id. Rolled on the drop, applied on grab; a cycled/conjured weapon is Common/plain.
   *  The server multiplies every damage source + the cooldown by the derived loot mults; the card shows
   *  the same numbers (WYSIWYG). */
  @type("uint8") weaponRarity = 0;
  @type("string") weaponAffix = "";
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
  // ── §29 v0.118 ARSENAL: 3-slot loadout + a bag (replaces the roster carousel in belt play). The ACTIVE
  // slot mirrors the held weapon (`weapon`/`weaponRarity`/`weaponAffix`); the other two remember stowed
  // weapons you can swap to instantly. Appended (field-order stable). ──
  /** The 3 loadout slots. `slots[activeSlot]` is re-synced from the held weapon on every swap/grab; the
   *  inactive slots hold their stowed weapon. An empty slot has `weapon === ""`. */
  @type([ArsenalSlot]) slots = new ArraySchema<ArsenalSlot>();
  /** Which of the 3 slots is in hand (0–2). */
  @type("uint8") activeSlot = 0;
  /** Finite overflow storage. Earned rows can be disassembled directly from the bag panel. */
  @type([ArsenalSlot]) bag = new ArraySchema<ArsenalSlot>();
  /** B20 L3 run money. It starts at zero and banks 100% through terminal meta-account settlement. */
  @type("uint32") scrip = 0;
  // ── SYNCED ATTACK BEAT — APPENDED for wire safety. Weapon identity + `aimDir` already describe the pose;
  // these fields expose only the authoritative acceptance edge so remote clients can start its animation.
  /** Monotonic uint32 counter bumped exactly once when the server accepts and fires an attack. */
  @type("uint32") attackSeq = 0;
  /** Authoritative `ArenaState.tick` on which `attackSeq` most recently advanced. */
  @type("uint32") attackTick = 0;
  /** True while the last accepted attack remains inside `ATTACK_HELD_WINDOW`; cleared by the server. */
  @type("boolean") attackHeld = false;
  /** §51 JUGGLED edge (APPENDED at schema v19, after every v18 field): bumped exactly once each time this
   *  player is LAUNCHED or air-kept by a tough-combo juggle hit — the client edge-fires the hit-reaction /
   *  tumble pose off changes. The arc itself rides the existing synced `height`/`vh` channels. */
  @type("uint8") juggledSeq = 0;
  /** Committed movement pose: 0 normal · 1 retired charge tombstone · 2 distance jump · 3 pound · 4 roll. */
  @type("uint8") moveStance = 0;
  /** Authoritative ground-pound landing edge; remotes fire the exact-radius impact presentation from it. */
  @type("uint8") poundSeq = 0;
  /** Soft reconcile edge bumped only when authority force-cancels a committed movement stance. */
  @type("uint8") stanceSeq = 0;
  /** §classmerge run-boundary identity snapshot. Character cycling may change `character` cosmetically,
   *  but spread/quirk consumers use this field until the next authored snapshot edge. APPENDED at v21. */
  @type("string") runCharacter: string = DEFAULT_CHARACTER;
  /** Contact null-whiff edge. Cosmetic only; never aliases the rewarded parry receipt. APPENDED at v22. */
  @type("uint8") dodgedSeq = 0;
  /** Fixed-roll direction/speed replay anchor. External impulse remains exclusively in vx/vy. APPENDED at v23. */
  @type("number") momentumX = 0;
  @type("number") momentumY = 0;
  /** Append-only wire names: V7 roll phase + exact sentence tick, sufficient for mid-roll adoption/replay. */
  @type("uint8") slidePhase = 0;
  @type("uint8") slidePhaseTick = 0;
  // ── §ULT schema v24. The resolved family+variant is packed into one byte so the amended 5×4
  // matrix remains late-join safe without exceeding the panel's nine-field wire budget. Tick epochs are
  // immutable for an accepted cast; the client interpolates phases without a per-tick schema write.
  @type(UltimateState) ultimate = new UltimateState();
  /** Pet v1's complete public follower descriptor. Exact account XP/level stays owner-private. */
  @type("string") petId = "";
  /** 0 none Â· 1 Hatchling (L1-3) Â· 2 Awakened (L4-7) Â· 3 Ascendant (L8-10). */
  @type("uint8") petLevelBand = 0;
  // Packed compatibility tail. The first four nested positions are inert schema-v27 tombstones.
  @type(DualWieldState) dualWield = new DualWieldState();
  /** B26 packed successful-parry direction + 0..2 guard pose. APPENDED at schema v35. `parriedSeq` is the
   * receipt edge; this byte is its server-selected deterministic presentation payload. */
  @type("uint8") parryPresentation = 0;
  /** B31 authoritative hold-to-charge presentation. The immutable start tick plus weapon definition
   * reconstructs muzzle growth without trusting a client wall clock. APPENDED at schema v38. */
  @type("boolean") weaponChargeActive = false;
  @type("uint32") weaponChargeStartTick = 0;
  /** Direct accessor keeps the resource contract independent of the packed tail envelope.
   *  REFLECTION LAW (client): the room joins WITHOUT a root-schema constructor, so decoded client
   *  rows carry only wire fields — these compatibility getters exist ONLY on server-constructed
   *  instances. Client code must never call them on room state; it reads `player.dualWield?.…`
   *  directly (see ArenaScene.addBlob / loadout-entry-view). The `?.`/`??` guards below are
   *  server-side hygiene so a partially-built row can never throw mid-tick. */
  get weaponResource(): WeaponResourceState {
    return this.dualWield?.weaponResource ?? DECODE_WINDOW_RESOURCE;
  }
  /** Schema v28 accessors append two frozen wardrobe strings to the existing final wire envelope. */
  get gearUpper(): string {
    return this.dualWield?.gearUpper ?? "";
  }
  set gearUpper(value: string) {
    this.dualWield.gearUpper = value;
  }
  get gearLower(): string {
    return this.dualWield?.gearLower ?? "";
  }
  set gearLower(value: string) {
    this.dualWield.gearLower = value;
  }
  /** Schema v31 public tower count, packed beside the cosmetic gear strings. */
  get prestige(): number {
    return this.dualWield?.prestige ?? 0;
  }
  set prestige(value: number) {
    this.dualWield.prestige = value;
  }
  get relics(): RelicState {
    return this.dualWield.relics;
  }
  /** Direct accessors preserve the panel/U2 contract while the nine fields serialize in `ultimate`. */
  get ultArchetype(): number {
    return this.ultimate.archetype;
  }
  set ultArchetype(value: number) {
    this.ultimate.archetype = value;
  }
  get ultCharge(): number {
    return this.ultimate.charge;
  }
  set ultCharge(value: number) {
    this.ultimate.charge = value;
  }
  get ultPhase(): number {
    return this.ultimate.phase;
  }
  set ultPhase(value: number) {
    this.ultimate.phase = value;
  }
  get ultSeq(): number {
    return this.ultimate.seq;
  }
  set ultSeq(value: number) {
    this.ultimate.seq = value;
  }
  get ultStartTick(): number {
    return this.ultimate.startTick;
  }
  set ultStartTick(value: number) {
    this.ultimate.startTick = value;
  }
  get ultResolveTick(): number {
    return this.ultimate.resolveTick;
  }
  set ultResolveTick(value: number) {
    this.ultimate.resolveTick = value;
  }
  get ultEndTick(): number {
    return this.ultimate.endTick;
  }
  set ultEndTick(value: number) {
    this.ultimate.endTick = value;
  }
  get ultTargetX(): number {
    return this.ultimate.targetX;
  }
  set ultTargetX(value: number) {
    this.ultimate.targetX = value;
  }
  get ultTargetY(): number {
    return this.ultimate.targetY;
  }
  set ultTargetY(value: number) {
    this.ultimate.targetY = value;
  }

  /** Server-only identity guard: true only when a validated v3 loadout, not a character fallback, seeded. */
  gearSeeded = false;
  /** Locked family/variant state is private; ultArchetype is its packed read-only presentation. */
  ultFamily = 0;
  ultVariant: Attr | "" = "";
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
  /** §8 Brand augment: transition-only Marked flag — takes ×BRAND_DAMAGE_MULT from all sources while the
   *  server-private timer is active. Synced for the client tint; 0 = not branded, 1 = branded. */
  @type("number") branded = 0;
  /** §8/B33 body TELEGRAPH: windup progress 0→1 of a parryable attack (0 = not telegraphing).
   *  Synced so the client ramps the enemy from its base look toward its palette accent. The separate
   *  `commitSeq` edge triggers the universal white pop and fixed commit-to-impact window. */
  @type("number") windup = 0;
  /** §30 v0.118 CRIT flash: a counter bumped each time this enemy takes a CRITICAL hit. Synced ONLY as a
   *  client VFX trigger — on a change (alongside an hp drop) the client styles that damage number gold +
   *  adds extra hit-stop/ring. Appended (field-order stable). */
  @type("uint8") critFlash = 0;
  /** §51 combo STEP-COMMIT edge (APPENDED at schema v19): bumped exactly once per documented commit —
   *  leap LIFTOFF (offer→arc), each strike POP (B33 lunge-vector lock), and a parry-bait RETURN start.
   *  Wraps 1..255 (0 is reserved = "no combo has ever run"); the client edge-triggers step
   *  presentation (arc hop, empowered flash) off changes. The full combo brain stays server-private. */
  @type("uint8") comboSeq = 0;
  /** §51 combo presentation bit flags (APPENDED at schema v19): COMBO_FLAG_AIRBORNE (leap in flight —
   *  ballistic hop + shadow) · COMBO_FLAG_EMPOWERED (gold bait-return windup) · COMBO_FLAG_JUGGLE
   *  (air-keep posture while a juggle string is live). 0 = no combo state to render. */
  @type("uint8") comboFlags = 0;
  /** B33 white-pop/commit edge. Each increment locks one lunge vector for the shared 200ms clock. */
  @type("uint8") commitSeq = 0;
}

/** A lingering corrosive puddle dropped by a zoner (§15) — DoTs players standing inside. */
/** Append-only compact ground-zone wire taxonomy. */
export const ZoneKind = { Hostile: 0, Weapon: 1 } as const;
export const ZoneStyle = { Legacy: 0, Nether: 1, Poison: 2, Ice: 3, PoisonSmoke: 4 } as const;

export class ZoneState extends Schema {
  @type("string") id = "";
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") radius = 0;
  @type("uint8") kind: number = ZoneKind.Hostile;
  @type("uint8") style: number = ZoneStyle.Legacy;
  @type("string") ownerId = "";
  @type("string") weaponId = "";
  @type("uint16") seed = 0;
  @type("number") maxRadius = 0;
  @type("uint32") bornTick = 0;
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
  /** Flagship semantic ownership. Empty/zero preserves every legacy and horde row. APPENDED at schema v26. */
  @type("string") ownerId = "";
  @type("uint32") castSeq = 0;
}

/** A weapon lying on the ground from the Testing-Grounds gallery or a player bag/hand drop. New run
 *  weapons enter through opener-instanced chests and may later reach this row through an explicit swap.
 *  `rarity` indexes shared RARITIES; `affix` is the retained loot-identity field. */
export class PickupState extends Schema {
  @type("string") id = "";
  @type("number") x = 0;
  @type("number") y = 0;
  /** Serialized weapon identity. Empty for a mystery pickup until reveal. This occupies the legacy weapon
   *  wire slot so later offsets stay fixed. */
  @type("string") weaponPublic = "";
  /** Exact weapon identity on the server. Not decorated, therefore never serialized. */
  weapon = "";
  @type("uint8") rarity = 0;
  /** Serialized affix identity. Empty for a mystery pickup until reveal; legacy affix wire slot. */
  @type("string") affixPublic = "";
  /** Exact affix identity on the server. Not decorated, therefore never serialized. */
  affix = "";
  @type("boolean") known = true;
  /** Public coarse weapon class for mystery-drop glyphs ("melee" | "ranged" | "caster"). This preserves
   *  the intended type tell without serializing the exact hidden weapon identity. Appended for wire safety. */
  @type("string") weaponClass = "";
  /** B20 L3: true only for earned run weapons which may become money in place. */
  @type("boolean") disassemblable = false;
  /** Optional owner visibility for an overflowed chest reward. Empty means squad-visible. */
  @type("string") ownerId = "";
}

/**
 * One bounded, server-authoritative money drop. The server owns collection and scrip credit; clients render
 * the resting/flight descriptor. `delivered` remains true for one patch so the pickup presentation has an
 * authoritative receipt edge.
 */
export class MoneyDropState extends Schema {
  @type("string") id = "";
  @type("number") x = 0;
  @type("number") y = 0;
  @type("uint32") value = 0;
  @type("uint16") seed = 0;
  @type("uint32") bornTick = 0;
  @type("string") collectorId = "";
  @type("uint32") launchTick = 0;
  @type("uint32") collectTick = 0;
  @type("boolean") delivered = false;
  /** Empty keeps L1's squad-shared payout; a player id makes a chest payout owner-instanced. */
  @type("string") ownerId = "";
}

/** One non-blocking arena chest. Contents remain private until each player opens it once. */
export class ChestState extends Schema {
  @type("string") id = "";
  @type("number") x = 0;
  @type("number") y = 0;
  @type("uint8") zone = 0;
  @type("uint8") kind = 0;
  @type("uint32") spawnTick = 0;
  @type("boolean") opened = false;
  @type({ map: "boolean" }) openedBy = new MapSchema<boolean>();
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
  /** Visual kind — keys the client's projectile renderer ("spit" enemy, "thrown:<weapon-id>" thrown
   *  implement, "magma" exploding scatter shot). */
  @type("string") kind = "spit";
  /** true = enemy attack (hits players); false = player throw (hits enemies). */
  @type("boolean") hostile = true;
  /** §14 WYSIWYG: if > 0, this projectile detonates an AoE of this px radius on death — the client
   *  renders an explosion of EXACTLY this size so the visual matches the server hitbox. 0 = no blast. */
  @type("number") explodeR = 0;
  /** Spawn tick lets clients draw a cosmetic grenade arc without another changing wire field. */
  @type("uint32") bornTick = 0;
  /** Immutable launch ownership. Clients must never guess this from a projectile's first sampled position. */
  @type("string") sourcePlayerId = "";
  /** Immutable launch weapon. Recipe art resolves from this id even after the owner swaps weapons. */
  @type("string") sourceWeaponId = "";
  /** Server-authored ballistic lift. The server flight clock below prevents client stat inference. */
  @type("number") arcHeight = 0;
  /** Complete authoritative flight duration in 50ms simulation ticks. */
  @type("uint16") flightTicks = 0;
  /** Server-advanced flight age; clients use this for ballistic and waveform phases. */
  @type("uint16") flightAgeTicks = 0;
  /** B31 immutable release scale for a charged projectile; server collision uses this exact scalar. */
  @type("number") visualScale = 1;
}

/** One stable, friendly player-beam presentation row. Damage stays private to the server; this is the
 * authoritative WYSIWYG phase and footprint used by owners, teammates, spectators, and replays. */
export class BeamState extends Schema {
  @type("string") ownerId = "";
  @type("string") weaponId = "";
  @type("uint32") seq = 0;
  @type("uint32") startSeq = 0;
  @type("uint8") phase = 0;
  @type("uint32") phaseStartTick = 0;
  @type("number") originX = 0;
  @type("number") originY = 0;
  @type("number") previousAngle = 0;
  @type("number") angle = 0;
  @type("number") effectiveLength = 0;
  @type("number") length = 0;
  @type("number") width = 0;
  @type("number") halfWidth = 0;
  @type("number") heat = 0;
  @type("number") intensity = 0;
  @type("string") element = "physical";
  @type("number") previousOriginX = 0;
  @type("number") previousOriginY = 0;
  @type("number") previousLength = 0;
}

/** One slot in the fixed authoritative hit/kill receipt ring. Rows are allocated once at room creation and
 * overwritten by monotonically increasing `seq`; consumers ignore seq=0 and dedupe later generations. */
export class CombatReceiptState extends Schema {
  @type("uint32") seq = 0;
  @type("uint32") tick = 0;
  @type("string") targetId = "";
  @type("string") sourcePlayerId = "";
  @type("string") weaponId = "";
  /** Compact delivery enum; see CombatDelivery in combat.ts. */
  @type("uint8") delivery = 0;
  @type("string") element = "physical";
  @type("float32") dirX = 0;
  @type("float32") dirY = 0;
  @type("float32") damage = 0;
  @type("boolean") crit = false;
  @type("boolean") finalBlow = false;
}

/** One row in Serraketh's fixed twelve-slot table. Stable slots survive sever/regrow generations. */
export class WormSegmentState extends Schema {
  @type("uint8") slot = 0;
  @type("uint16") generation = 0;
  @type("uint8") role = 0;
  @type("uint8") condition = 0;
  @type("uint8") armorBand = 0;
  @type("uint8") mode = 0;
  @type("uint8") chain = 0;
  @type("uint8") ordinal = 0;
  @type("float32") x = 0;
  @type("float32") y = 0;
  @type("uint32") changeTick = 0;
  /** Event-driven, quantized local integrity/armor. 255 means full; 0 means exhausted. */
  @type("uint8") integrityQ = 0;
  @type("uint8") armorQ = 0;
}

/** Always allocated on ArenaState; `active=false` outside the single-owner worm encounter. */
export class WormBossState extends Schema {
  @type("boolean") active = false;
  @type("string") ownerId = "";
  @type("uint32") topologySeq = 0;
  @type("uint32") poseTick = 0;
  @type("uint8") mode = 0;
  @type("uint16") activeMask = 0;
  @type("uint16") targetableMask = 0;
  @type("uint16") collidableMask = 0;
  @type("uint16") undergroundMask = 0;
  @type("uint16") changedMask = 0;
  @type("boolean") splitActive = false;
  @type("uint32") splitExpireTick = 0;
  @type("uint8") actionKind = 0;
  @type("uint16") actionSeq = 0;
  @type("uint32") actionStartTick = 0;
  @type("uint32") actionResolveTick = 0;
  @type("uint32") actionEndTick = 0;
  @type("uint8") actionEmitterSlot = 0;
  @type("uint16") actionEmitterGeneration = 0;
  @type("uint32") actionTopologySeq = 0;
  @type("float32") actionTargetX = 0;
  @type("float32") actionTargetY = 0;
  @type([WormSegmentState]) segments = new ArraySchema<WormSegmentState>();
}

/** Always allocated compact flagship surface. Tick epochs let late joiners sample the current foot/action
 * without replaying entrance, phase, mutation, or death one-shots. APPENDED as one nested field at v26. */
export class VastagharBossState extends Schema {
  @type("boolean") active = false;
  @type("string") ownerId = "";
  @type("uint16") encounterSeq = 0;
  @type("uint8") mode = 0;
  @type("uint8") phase = 0;
  @type("uint32") phaseStartTick = 0;
  @type("float32") maxHp = 0;
  @type("float32") storedDamage = 0;
  @type("uint16") actionSeq = 0;
  @type("uint8") actionKind = 0;
  @type("uint8") actionResult = 0;
  @type("uint32") actionStartTick = 0;
  @type("uint32") actionResolveTick = 0;
  @type("uint32") actionActiveEndTick = 0;
  @type("uint32") actionEndTick = 0;
  @type("string") focusPlayerId = "";
  @type("uint8") sourceFoot = 0;
  @type("float32") aim = 0;
  @type("float32") impactX = 0;
  @type("float32") impactY = 0;
  @type("uint8") revolutions = 0;
  @type("uint16") stepSeq = 0;
  @type("uint8") stepIndex = 0;
  @type("uint8") stepCount = 0;
  @type("uint32") stepStartTick = 0;
  @type("uint32") stepResolveTick = 0;
  @type("uint32") responseOpenTick = 0;
  @type("uint8") stridePips = 0;
  @type("uint32") punishEndTick = 0;
  @type("uint16") arenaMutationSeq = 0;
  @type("uint8") arenaMutationKind = 0;
  @type("uint32") arenaMutationTick = 0;
  @type("uint8") arenaMutationPoiIndex = 255;
  @type("uint32") destroyedPoiMask = 0;
  @type("uint8") arenaPaintStep = 0;
  @type("float32") arenaPaintRotation = 0;
  @type("uint16") cueSeq = 0;
  @type("uint8") cueKind = 0;
  @type("uint32") cueTick = 0;
  @type("uint8") victoryStage = 0;
  @type("uint32") victoryTick = 0;
  @type("uint32") victoryMoney = 0;
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
  /** Reserved wire slot for the former per-tick elapsed float. */
  @type("number") elapsedLegacy = 0;
  /** Precise run time in seconds. Server-only (not decorated / not serialized). */
  elapsed = 0;
  /** "arena" (survival) | "training" (Testing Grounds — dummies + pickups, no spawns). */
  @type("string") mode = "arena";
  /** §17 the active DIMENSION id (keys the shared `DIMENSIONS` registry) — scopes the server's spawn roster
   *  + boss and drives the client's palette + POI/decal/tile asset sets. A run is a chain of these (§6). */
  @type("string") dimensionId = DEFAULT_DIMENSION;
  /** Run outcome (§16): "active" while playing, "victory" once a player extracts, "defeat" on a §6 wipe. */
  @type("string") outcome = "active";
  /** Extraction portal — opened when the dimension boss falls; stepping in ends the run in victory,
   *  settles weapon escrow, and banks 100% of run money. */
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
  /** Whole elapsed run seconds for the HUD. Appended wire replacement for the legacy per-tick float. */
  @type("uint32") elapsedSeconds = 0;
  /** Collectible enemy money rewards introduced with schema v34. */
  @type({ map: MoneyDropState }) moneyDrops = new MapSchema<MoneyDropState>();
  /** Friendly player beams. APPENDED for Colyseus field-order safety; keyed by owner/player id. */
  @type({ map: BeamState }) beams = new MapSchema<BeamState>();
  /** Serraketh owner + fixed-cap segment table. APPENDED at schema v17; never inserted into older rows. */
  @type(WormBossState) wormBoss = new WormBossState();
  /** G-polish-07 fixed authoritative hit/kill event ring. APPENDED at schema v18 after every v17 field. */
  @type([CombatReceiptState]) combatReceipts = new ArraySchema<CombatReceiptState>();
  /** Vastaghar action/mutation/reward surface. APPENDED at schema v26; never inserted into older rows. */
  @type(VastagharBossState) vastaghar = new VastagharBossState();
  /** B20 L2 server-authored, non-colliding chest rows. */
  @type({ map: ChestState }) chests = new MapSchema<ChestState>();
  /** B34 belt-only endless-tower floor identity. Empty on arena/training and every legacy belt. */
  @type("string") corporateFloorId = "";
  /** B34 endless floor counter. Kept separate from the uint8 combat depth, which saturates for scaling. */
  @type("uint32") corporateFloorDepth = 0;
  /** B34 0 short · 1 standard · 2 long. Seeded from depth by the shared floor constructor. */
  @type("uint8") corporateVariant = 1;
  /** B34 0 sealed · 1 ready · 2 countdown · 3 departing · 4 arriving. Server authoritative. */
  @type("uint8") elevatorPhase = 0;
  /** Absolute 20 Hz tick ending the current timed elevator phase; zero outside a timed phase. */
  @type("uint32") elevatorDeadlineTick = 0;
}
