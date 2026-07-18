import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  BELT_Y0,
  type BeltLevel,
  beltLevelFor,
  beltPitAtX,
  beltSafeX,
  beamDescriptorFor,
  beamStepDamage,
  beamSweepSampleCount,
  BeamPhase,
  type BeamDescriptor,
  BeamState,
  DriveRegenMode,
  type DriveRegenModeValue,
  driveRegenModeFor,
  driveRegenPerSecond,
  clampBeltFloorY,
  resolveBeltObstacles,
  type ArenaMap,
  ArenaState,
  ArsenalSlot,
  ARSENAL_SLOTS,
  ATTACK_BUFFER_SECONDS,
  ATTACK_HELD_WINDOW,
  AUG_BEAM_COOL_PER,
  AUG_BEAM_FOCUS_PER,
  AUG_CAST_DMG_PER,
  AUG_CAST_SPLIT_MAX,
  AUG_CAST_SPLIT_PER,
  AUG_CAST_SPLIT_SPREAD,
  AUG_GUN_BOUNCE_PER,
  AUG_GUN_PIERCE_PER,
  AUG_PROJECTILE_DAMAGE,
  AUG_PROJECTILE_PIERCE,
  AUG_PROJECTILE_SPEED,
  AUG_PROJECTILE_SPREAD,
  addImpulse,
  applyCastGradeFloor,
  ATTRS,
  type Attr,
  BOSS_DEF_IDS,
  type BossCounterSummary,
  BOSS_PROJECTILE_BUDGET,
  BOSS_SALVAGE_PER_DEPTH,
  BEAM_CRIT_QUANTUM_SECONDS,
  BEAM_COOL_PER_SECOND,
  BEAM_OVERHEAT_LOCK_SECONDS,
  BEAM_RECOVERY_SECONDS,
  BEAM_RESTART_HEAT,
  BEAM_STALE_INPUT_TICKS,
  BOSSRUSH_BREATHER,
  BOSSRUSH_HEAL_FRAC,
  BAG_CAP,
  BRAND_DAMAGE_MULT,
  BRAND_DURATION,
  BULWARK_SHIELD,
  CombatDelivery,
  CombatReceiptState,
  COMBAT_RECEIPT_CAP,
  comboStepForChain,
  bladeAngleAt,
  bladeHitsCircle,
  bladeHitsCircleXY,
  bossDefFor,
  bossSpawnAt,
  VASTAGHAR_ENCOUNTER,
  CHAIN_MAX_RANGE,
  type ChainCandidate,
  COMBO_DAMAGE_CAP_FRAC,
  COMBO_FLAG_AIRBORNE,
  COMBO_FLAG_EMPOWERED,
  COMBO_FLAG_JUGGLE,
  COMBO_LEAP_AIR_TICKS,
  COMBO_LEAP_COOLDOWN,
  COMBO_LEAP_OFFER_TICKS,
  COMBO_LEAP_RANGE,
  COMBO_LEAP_SETTLE_TICKS,
  COMBO_MAX_ACTIVE,
  COMBO_STEP_MAX,
  CONFLAG_DELAY,
  characterScale,
  clamp,
  clipPoiRayLength,
  clampQuakeEpicenter,
  isPlayableCharacter,
  coneAngles,
  countAugment,
  CRIT_CHANCE_CAP,
  CRIT_MULT,
  critChanceFor,
  damageMultFromGrades,
  dualHandForSeq,
  dualOffhandDamageMultiplier,
  type DualWieldHand,
  DUAL_MELEE_PAIR_BAR,
  DUAL_MELEE_SEQUENCE_LENGTH,
  defaultFlexAttr,
  CROUCH_COMMIT_SECONDS,
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
  DRIVE_BEAM_CANCEL_COST,
  DRIVE_BEAM_IGNITION_COST,
  DRIVE_BEAM_NET_DRAIN_PER_SECOND,
  DRIVE_BEAM_RESTART_THRESHOLD,
  DRIVE_CAPACITY,
  DRIVE_FLOOR_REGEN_PER_SECOND,
  DRIVE_MAX_GENERIC_RECOVERY_MULT,
  DRIVE_PRESSURE_MEMORY_SECONDS,
  DRIVE_THREAT_RADIUS,
  DUMMY_HP,
  DUMMY_RADIUS,
  depthDamageScale,
  depthHpScale,
  deriveStats,
  draftAugments,
  augmentDeliveriesForGate,
  augmentGateForWeapon,
  EMBERGUARD_BASE_DMG,
  EMBERGUARD_HALF_ARC,
  EMBERGUARD_PER_INT,
  EMBERGUARD_RANGE,
  ENEMY_KINDS,
  ENEMY_RADIUS,
  type EnemyKind,
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
  meleeComboSelectionFor,
  type MeleeComboFamily,
  HAIRTRIGGER_MAX,
  HAIRTRIGGER_WINDOW,
  HARVEST_CAP,
  HARVEST_PER_LUK,
  HIT_KNOCKBACK_IMPULSE,
  META_FORTUNE_LUK,
  META_POWER_STR,
  META_VITALITY_HP,
  META_ACCOUNT_REVISION_MAX,
  type MetaAccountV4,
  GEAR_IDS,
  LEGACY_UPGRADE_GRANTS,
  nextUpgradeCost,
  PET_CATALOG_VERSION,
  type PetId,
  type PetMods,
  type PetProgressReceipt,
  type PetStageBand,
  isPetId,
  petLevelForXp,
  petModsForLevel,
  petStageBandForLevel,
  sanitizeMetaAccountV2,
  sanitizeMetaAccountV3,
  sanitizeMetaAccountV4WithDiagnostics,
  sanitizeMetaLevels,
  encodeGearCosmetics,
  resolveGearLoadout,
  runtimeModsForQuirk,
  type GearRunRuntime,
  type RuntimeMods,
  hasAugment,
  ACTION_MSGS_PER_TICK,
  INPUT_MSGS_PER_TICK,
  INPUT_QUEUE_MAX,
  IMPULSE_FRICTION,
  IRON_STANCE_IFRAME_PER,
  IRON_STANCE_KNOCKBACK_PER,
  inMeleeArc,
  isAttr,
  isAugment,
  isInsidePoi,
  isPitAtPx,
  JUGGLE_LANDING_MERCY,
  JUGGLE_MAX_AIR_HITS,
  JUGGLE_MAX_CONTROL_SECONDS,
  JUMP_BUFFER_SECONDS,
  JUMP_COOLDOWN,
  JUMP_VELOCITY,
  landingThumpTier,
  LANDING_TIER_SOFT,
  type LandingThumpTier,
  LEVELUP_WINDOW_SECONDS,
  LEVEL_CAP,
  LOOT_TIER_LUK_BOSS,
  LOOT_TIER_LUK_TOUGH,
  lootCooldownMult,
  lootDamageMult,
  MAX_ENEMIES,
  MAX_PLAYERS,
  MAX_XP_ECHOES,
  MOVE_SPEED,
  MELEE_BLADE_HALFWIDTH,
  MELEE_SAMPLE_STEP,
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
  PAIR_TEMPO,
  pairDamagePerUse,
  pairEligible,
  pairRequirementPenalty,
  PICKUP_RADIUS,
  PIT_FALL_DAMAGE_FRAC,
  PIT_FALL_GRACE,
  POUND_GATHER_SECONDS,
  POUND_JUMP_COOLDOWN,
  POUND_KNOCKBACK_SPEED,
  POUND_MIN_HEIGHT,
  POUND_RADIUS,
  POUND_RECOVERY_SECONDS,
  POUND_SPEED,
  POUND_STAGGER_SECONDS,
  poundDamage,
  PickupState,
  PLAYER_MAX_HP,
  PLAYER_RADIUS,
  PlayerState,
  PROJECTILE_RADIUS,
  PROJECTILE_TTL,
  ProjectileState,
  pickEnemyKind,
  PoiCollisionIndex,
  poiCollisionAt,
  pointInAnnulusGap,
  pointInOrientedRect,
  pointInSweptAnnularArc,
  prevWeapon,
  QUAKE_REACH,
  type QuirkDef,
  type QuirkEffect,
  quirkForCharacter,
  RARITIES,
  RARITY_COMMON,
  RESPAWN_CLEAR_RADIUS,
  requirementPenalty,
  RETURN_DASH_TICKS,
  RETURN_STAGGER_TICKS,
  RETURN_STEP_MAX,
  REVIVE_HP_FRAC,
  RIFT_CHANNEL_SECONDS,
  randomSeed,
  resolveBodyCollisions,
  resolvePoiCollisionInto,
  rollAffix,
  rollDropWeapon,
  rollRarity,
  clampSlideSpeed,
  slideContactInvulnerable,
  slideGroundNextSpeed,
  slideHopSpeed,
  slideLandingSpeed,
  slideSteeredAngle,
  SLIDE_ATTACK_CANCEL_SECONDS,
  SLIDE_COLD_REARM_TICKS,
  SLIDE_COMMIT_TICKS,
  SLIDE_ENTRY_SPEED,
  SLIDE_GROUND_TICKS,
  SLIDE_HOP_MAX_TICK,
  SLIDE_HOP_MIN_TICK,
  SLIDE_HOP_VERTICAL_VELOCITY,
  SLIDE_LAND_WINDOW_TICKS,
  SLIDE_PARRY_LOCK_SECONDS,
  SLIDE_PHASE_AIR,
  SLIDE_PHASE_GROUND,
  SLIDE_PHASE_LAND_WINDOW,
  SLIDE_PHASE_OFF,
  SLIDE_PRELAND_BUFFER_TICKS,
  SLIDE_SPEED_CAP,
  type SlidePhase,
  SECOND_WIND_BASE,
  SECOND_WIND_PER_CON,
  SHIFTER_FIRST_SECONDS,
  SHIFTER_HP_PER_WAVE,
  SHIFTER_INTERVAL,
  SHIFTER_KIND_IDS,
  swingDescriptorFor,
  swingEdgeProgress,
  type SwingDescriptor,
  SHIFTER_SALVAGE_PER_DEPTH,
  SHIFTER_TIER_SECONDS,
  shortestAngleDelta,
  SHOP_RADIUS,
  SPAWN_RING,
  placeArenaGatePair,
  safeSpawnPos,
  salvageValue,
  scripValue,
  selectChainTargets,
  sourceDamageMult,
  spawnInterval,
  spreadAdjustedCon,
  spreadForCharacter,
  stepEnemyChase,
  stepEnemyKite,
  stepBeamAngle,
  stepImpulse,
  stepSteeredMovement,
  stepVertical,
  STANCE_CROUCH,
  STANCE_DASH,
  STANCE_NONE,
  STANCE_POUND,
  STANCE_SLIDE,
  type MoveStance,
  TelegraphState,
  TgShape,
  TICK_MS,
  TOUGH_COMBOS,
  TOUGH_DAMAGE_MULT,
  TOUGH_HP_MULT,
  TOUGH_XP_MULT,
  type ToughComboDef,
  type ToughComboReturn,
  type ToughComboStep,
  toughChance,
  pickToughCombo,
  type Vec2,
  validateArena,
  validateArenaGatePair,
  VastagharArenaMutationKind,
  VastagharMode,
  verticalTimeToGround,
  EXPANSION_WEAPON_IDS,
  WEAPON_IDS,
  WEAPONS,
  type WeaponDef,
  weaponMuzzleReach,
  weaponAttackCooldown,
  effectiveAcceptedWeaponInterval,
  driveCostForProfile,
  weaponResourceProfile,
  weaponSetBonus,
  xpToNextLevel,
  ZONE_DPS,
  ZONE_RADIUS,
  ZONE_TTL,
  ZONER_DROP_INTERVAL,
  ZoneState,
  BASE_XP_MOTE_REACH,
  XP_ECHO_ARM_MAX_MS,
  XP_ECHO_ARM_MS,
  XP_ECHO_ARM_TIER_MS,
  XP_ECHO_CLEANUP_FLIGHT_MAX_SECONDS,
  XP_ECHO_CLEANUP_FLIGHT_MIN_SECONDS,
  XP_ECHO_CLEANUP_LAUNCHES_PER_TICK,
  XP_ECHO_CLEANUP_MAX_MS,
  XP_ECHO_DENSE_AT,
  XP_ECHO_DENSE_MERGE_RADIUS,
  XP_ECHO_FLIGHT_BASE_SECONDS,
  XP_ECHO_FLIGHT_DISTANCE_DIVISOR,
  XP_ECHO_FLIGHT_MAX_SECONDS,
  XP_ECHO_FLIGHT_MIN_SECONDS,
  XP_ECHO_LAUNCHES_PER_COLLECTOR_TICK,
  XP_ECHO_LAUNCHES_PER_ROOM_TICK,
  XP_ECHO_POINT_BLANK_FLIGHT_TICKS,
  XP_ECHO_POINT_BLANK_REACH,
  XP_ECHO_RECEIPTS_PER_COLLECTOR_TICK,
  XP_ECHO_RECENT_MERGE_MS,
  XP_ECHO_RECENT_MERGE_RADIUS,
  XP_ECHO_RETARGET_MAX_SECONDS,
  XP_ECHO_RETARGET_MIN_SECONDS,
  XP_MOTE_REACH_MAX,
  XP_MOTE_REACH_MIN,
  XP_MOTE_REACH_PER_STACK,
  XpEchoState,
  WORM_MAX_SEGMENTS,
  WORM_TOTAL_XP,
  WEAPON_DRAW_LOCK_SECONDS,
  DIST_JUMP_AIRTIME,
  DIST_JUMP_COOLDOWN,
  DIST_JUMP_LANDING_SPEED_MULT,
  DIST_JUMP_MAX_STEER_RADIANS,
  DIST_JUMP_REACH,
  DIST_JUMP_SPEED,
  DIST_JUMP_STEER_RADIANS_PER_SECOND,
  DIST_JUMP_VERTICAL_VELOCITY,
  ULT_ALPHA_DAMAGE,
  ULT_ALPHA_EXECUTE_FRAC,
  ULT_ALPHA_EXECUTE_MULT,
  ULT_ALPHA_HIT_TICKS,
  ULT_ALPHA_MAX_TARGETS,
  ULT_ALPHA_RADIUS,
  ULT_ALPHA_SINGLE_MULT,
  ULT_ALPHA_WINDUP_TICKS,
  ULT_BLINK_IFRAMES,
  ULT_BLINK_RANGE,
  ULT_BLINK_RECOVERY_TICKS,
  ULT_BLINK_WINDUP_TICKS,
  ULT_BUFFER_SECONDS,
  ULT_CHARGE_KILL_BONUS,
  ULT_CHARGE_MAX,
  ULT_CHARGE_PARRY_BONUS,
  ULT_CHARGE_PER_DAMAGE,
  ULT_CHARGE_TICK_CAP,
  ULT_DOOR_DECOY_HP,
  ULT_DOOR_DECOY_RADIUS,
  ULT_DOOR_DECOY_SECONDS,
  ULT_DOOR_DETONATE_DAMAGE,
  ULT_DOOR_DETONATE_RADIUS,
  ULT_DOOR_RETURN_SECONDS,
  ULT_FIREBALL_DAMAGE,
  ULT_FIREBALL_RANGE,
  ULT_FIREBALL_SPEED,
  ULT_FIREBALL_WINDUP_TICKS,
  ULT_NUKE_DAMAGE,
  ULT_NUKE_RADIUS,
  ULT_PHASE_BRAND_MULT,
  ULT_PHASE_BRAND_SECONDS,
  ULT_PHASE_DAMAGE,
  ULT_PHASE_HALFWIDTH,
  ULT_PHASE_RANGE,
  ULT_PHASE_SPEED,
  ULT_PHASE_WINDUP_TICKS,
  ULT_RECOVERY_TICKS,
  ULT_SEISMARCH_AIR_TICKS,
  ULT_SEISMARCH_DEX_RANGE,
  ULT_SEISMARCH_FISSURE_DAMAGE,
  ULT_SEISMARCH_FISSURE_SECONDS,
  ULT_SEISMARCH_INNER_DAMAGE,
  ULT_SEISMARCH_INNER_RADIUS,
  ULT_SEISMARCH_MID_DAMAGE,
  ULT_SEISMARCH_MID_RADIUS,
  ULT_SEISMARCH_OUTER_DAMAGE,
  ULT_SEISMARCH_OUTER_RADIUS,
  ULT_SEISMARCH_RANGE,
  ULT_SEISMARCH_STUN_SECONDS,
  ULT_SEISMARCH_WINDUP_TICKS,
  ULT_STUN_ICD_TICKS,
  ULT_TEMPER_CHARGE_MULT,
  UltimateFamily,
  type UltimateFamilyValue,
  UltimatePhase,
  ultimateDamageScale,
  ultimateFamilyAttr,
  ultimateFamilyForCode,
  ultimateVariantForCode,
  countWeaponCopies,
  encodedJsonByteLength,
  META_JOIN_MAX_BYTES,
  rollBankAwareDropWeapon,
  weaponEntryInstances,
  weaponEntryPhysicalSize,
  weaponRarityId,
  WEAPON_CARRY_MAX_PHYSICAL,
  WEAPON_PACK_MAX_CAPACITY,
  type CarrySelectionV1,
  type ExpeditionEntryV1,
  type PairedWeaponEntryV1,
  type SingleWeaponEntryV1,
  type WeaponBankCuratorInputV1,
  type WeaponBankEntryV1,
  type WeaponInstanceV1,
  type WeaponProvenance,
} from "@dd/shared";
import { type Client, Room } from "colyseus";
import { randomBytes } from "node:crypto";
import {
  BossController,
  conserveVastagharVictoryXp,
  VastagharEncounterRuntime,
  type VastagharEmitSink,
  type VastagharTarget,
} from "./BossController.js";
import {
  applyAllocationChoice,
  bankPetBondXp,
  commitWeaponCarry,
  consumeFlex,
  levelUpPlayer,
  sellWeaponBankEntry,
  settleWeaponExpedition,
  wipeWeaponBankForPrestige,
  type StashSaleResult,
  type WeaponSettlementResult,
} from "./progression.js";
import { SpatialGrid } from "./SpatialGrid.js";

/** Horde-melee rows reuse the existing telegraph schema; the id carries cosmetic ownership client-side. */
const MELEE_TELEGRAPH_PREFIX = "melee:";
const MELEE_LOCK_PHASE = 0.65;
/** §51 duel-token courtesy distance: a combo tough whose victim is already CLAIMED holds a visible
 *  ring-out orbit here instead of stacking a second unreadable choreography (G12 crossfire law). */
const COMBO_RINGOUT_ORBIT = 260;
/** §51 the riposte stagger normalised onto tick anchors (the legacy machine's 1s, in 50ms ticks). */
const COMBO_RIPOSTE_STAGGER_TICKS = 20;
/** Shared immutable no-input sample for rooted stance movement; avoids a fresh object in the 20Hz loop. */
const ZERO_MOVE_INPUT = { dx: 0, dy: 0 } as const;
const ZERO_IMPULSE = { vx: 0, vy: 0 } as const;
const tickReached = (now: number, target: number): boolean => ((now - target) | 0) >= 0;
const ticksFromSeconds = (seconds: number): number => Math.max(1, Math.round(seconds * 1000 / TICK_MS));

function pointSegmentDistanceSq(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const vx = bx - ax;
  const vy = by - ay;
  const vv = vx * vx + vy * vy;
  const t = vv > 1e-9 ? clamp(((px - ax) * vx + (py - ay) * vy) / vv, 0, 1) : 0;
  const dx = px - (ax + vx * t);
  const dy = py - (ay + vy * t);
  return dx * dx + dy * dy;
}
/** QOL-01: visible stabilisation beat, then an intentional spatial hold after a fresh entry. */
const EXTRACT_ARM_SECONDS = 0.8;
const EXTRACT_HOLD_SECONDS = 0.75;
/** QOL-05: the authored 720px ring is a postcondition after clamp/terrain correction, not an input hint. */
const SPAWN_CANDIDATE_COUNT = 8;
const SPAWN_MIN_DISTANCE = SPAWN_RING * 0.85;
const SPAWN_CAMERA_HALF_WIDTH = SPAWN_RING * 0.8;
const SPAWN_CAMERA_HALF_HEIGHT = SPAWN_RING * 0.5;

/** §45 one tick-wide horde broad phase. 128px keeps ordinary enemy separation in the same/adjacent cells;
 *  the radius ceiling keeps boss/projectile/melee queries conservative for the oversized boss roster. */
const ENEMY_GRID_CELL_SIZE = 128;
const MAX_ENEMY_RADIUS = Math.max(
  ENEMY_RADIUS,
  ...Object.values(ENEMY_KINDS).map((kind) => kind.radius),
);
/** Soft horde separation consumes this fraction of each pair's radius overlap per 20Hz tick. */
const ENEMY_SEPARATION_OVERLAP_FRACTION = 0.45;
/** A dense crowd can contribute many pair forces; cap the accumulated body correction per tick. */
const ENEMY_SEPARATION_MAX_STEP = 12;

/** §4 v0.107 one sequence-numbered input COMMAND from a client (~one per 50ms client tick). `jump` rides
 *  the command (not a separate message) so its consume tick is part of the acked timeline (review #5). */
interface InputCmd {
  seq: number;
  dx: number;
  dy: number;
  jump: boolean;
  crouchHeld: boolean;
  pound: boolean;
  slide: boolean;
  slideHeld: boolean;
  fireHeld: boolean;
  /** First false→true fire command folded into this fixed-step sample; ack still uses `seq`. */
  fireStartSeq: number;
  aimX: number;
  aimY: number;
  targetX: number;
  targetY: number;
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
  lastFreshFireTick: number;
  /** §44 per-tick budget for ACTION messages (attack/parry/grab/cycle/…) — the input budget's sibling,
   *  so a modified client can't monopolize the event loop with non-movement RPCs between ticks. */
  actionBudget: number;
  mvx: number;
  mvy: number;
}

interface WeaponResourceLedger {
  cooldown: number;
}

type WeaponSpendReason = "tap" | "beam-ignite" | "beam-active" | "beam-cancel";

interface WeaponSpendResult {
  accepted: boolean;
  debit: number;
  beamEmpty: boolean;
}

/** One server-private Drive authority. The result row is reused so the 20 Hz seam allocates nothing. */
interface DriveRuntime {
  valueF: number;
  recoveryDebtF: number;
  pressureUntilTick: number;
  regenMode: DriveRegenModeValue;
  beamLockEndTick: number;
  beamRecoveryEndTick: number;
  beamRequireRelease: boolean;
  tickCreditF: number;
  tickDebitF: number;
  tickOpen: boolean;
  forceEngaged: boolean;
  simulationPaused: boolean;
  engagedRecoveryMult: number;
  spendResult: WeaponSpendResult;
}

interface RunWeaponLedger {
  runId: string;
  entries: Map<string, ExpeditionEntryV1>;
  byInstanceId: Map<string, string>;
  curator: WeaponBankCuratorInputV1;
}

interface PickupWeaponBankMeta {
  provenance: WeaponProvenance;
  entry?: WeaponBankEntryV1;
  ownerId: string;
  ownerLockUntil: number;
}

interface DisconnectedPlayerReservation {
  player: PlayerState;
  combat: CombatState;
}

type PlayerDamageKind = "pit" | "ground-hazard" | "enemy" | "self";

interface PetRunRuntime {
  petId: PetId;
  level: number;
  stageBand: PetStageBand;
  catalogVersion: number;
  mods: Readonly<PetMods>;
  pendingBondXp: number;
  clearReceipts: number;
  lastEvaluatedDimensionEpoch: number;
  dimensionPresenceSeconds: number;
  acceptedActionsThisDimension: number;
  geckoFraction: number;
  geckoMinted: number;
  tortoisePitRegenSeconds: number;
  settled: boolean;
}

interface UltimateTarget {
  id: string;
  slot: number;
  generation: number;
  distanceSq: number;
}

interface UltimateRuntime {
  family: UltimateFamilyValue;
  variant: Attr;
  startX: number;
  startY: number;
  dirX: number;
  dirY: number;
  activeEndTick: number;
  teleportSeqAtAccept: number;
  targets: UltimateTarget[];
  hitIndex: number;
  nextHitTick: number;
  hit: Set<string>;
  impactDone: boolean;
  sourceKey: string;
}

/** Per-player combat/aux state, kept server-side (not all of it needs to sync). */
interface CombatState {
  /** Server-private identity lock. `player.character` may change cosmetically between snapshot edges. */
  identityCharacter: string;
  /** Resolved once per identity edge so hot combat paths never walk character maps. */
  quirk: QuirkDef;
  /** Character fallback or gear runtime scalars, composed once outside the 20 Hz loop. */
  mods: RuntimeMods;
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
  /** Schema tombstone for the retired reload/refill clock. Always zero in schema-30 rooms. */
  reloadCd: number;
  /** Last equipped weapon id — detects identity changes for cadence-ledger restore. */
  lastWeapon: string;
  /** G-01 shared responsive draw gate. Per-weapon debt is restored underneath this short lock. */
  drawLock: number;
  /** One dual-wield attack stream gate. It survives bind/unbind so topology cannot mint a beat. */
  handGate: number;
  /** Identity currently owned by the paired-off live slot ledger; defense against direct slot rewrites. */
  offLastWeapon: string;
  /** Server copy of the six-beat melee chain snapshot used by comboStepForChain. */
  pairComboSeq: number | undefined;
  pairComboAcceptedAtMs: number;
  pairComboId: string;
  pairComboFamily: MeleeComboFamily;
  pairComboStep: number;
  pairComboExpiresAtMs: number;
  /** Arena carousel has no ArsenalSlot rows, so its resource debt is keyed by weapon identity. */
  weaponLedger: Map<string, WeaponResourceLedger>;
  /** Schema-30 one global bar/debt/beam gate. Never copied through slot or topology ledgers. */
  drive: DriveRuntime;
  /** §5 jump cooldown, sec (so the hop isn't spammable). */
  jumpCd: number;
  /** §5/§20 vertical velocity (px/s) for the real height axis — the jump seeds it, gravity decays it. */
  vh: number;
  /** Jump-feel's one-deep committed movement machine; normal rise/apex/fall derive from height/vh. */
  stance: MoveStance;
  crouchT: number;
  crouchPrevHeld: boolean;
  crouchAimX: number;
  crouchAimY: number;
  dashDirX: number;
  dashDirY: number;
  dashBaseDirX: number;
  dashBaseDirY: number;
  dashSpeed: number;
  dashSteer: number;
  distJumpCd: number;
  poundUsed: boolean;
  poundGatherT: number;
  poundTriggerHeight: number;
  recoveryT: number;
  /** Schema-23 persistent player-authored carry. Never includes recoil/hostile impulse. */
  momentumX: number;
  momentumY: number;
  slidePhase: SlidePhase;
  /** Sentence age across GROUND/AIR; LAND_WINDOW reuses it as elapsed landing age. */
  slidePhaseTick: number;
  slidePrevHeld: boolean;
  slideHopBuffered: boolean;
  slidePrelandTicks: number;
  slideLandMomentumX: number;
  slideLandMomentumY: number;
  slideColdArmed: boolean;
  slideColdRearmTicks: number;
  slideParryLockT: number;
  lastSlideLandingTick: number;
  /** Allocation-free collision feedback anchors for the active authored step. */
  slideStepStartX: number;
  slideStepStartY: number;
  lastLandingTier: LandingThumpTier;
  lastLandingSpeed: number;
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
  /** Exact accepted parry epoch; boss counters never mistake slide/ultimate i-frames for a white answer. */
  parryOpenedTick: number;
  /** Graveside Manner's bounded event receipt; no per-tick allocation or synced counter. */
  killHealWindowStart: number;
  killHealWindowAmount: number;
  /** §13 salvage PROVENANCE (v0.103 anti-exploit): true only while the held weapon traces back to an
   *  ENEMY DROP. Cycled/conjured/gallery weapons are false — salvaging them pays nothing, so the
   *  cycle→salvage loop can't mint bankable salvage from thin air. */
  heldEarned: boolean;
  /** G-02 Bulwark success reward: absorb points, never an extension of parry invulnerability. */
  bulwarkShield: number;
  /** §51 G10 touchdown mercy (sec): melee/contact immunity granted when an ENEMY-initiated launch lands
   *  (never the player's own jump), so a juggle cannot chain into the horde the instant gravity wins. */
  juggleMercy: number;
  /** §51 armed by a juggle launcher hit; converts to `juggleMercy` on the next airborne→grounded edge. */
  juggleArmed: boolean;
  /** Allocation-free beam tuning cache; refreshed only when the owned CSV changes. */
  augmentSnapshot: string;
  beamVentStacks: number;
  beamFocusStacks: number;
  /** Beam channel runtime. Affordability and lock truth live only in the player-global Drive row. */
  beamDescriptor?: BeamDescriptor;
  beamPhase: 0 | 1 | 2;
  beamPhaseT: number;
  beamChannelT: number;
  beamAngle: number;
  beamPreviousAngle: number;
  beamPreviousX: number;
  beamPreviousY: number;
  beamPreviousLength: number;
  beamTeleportSeq: number;
  beamInputWasHeld: boolean;
  beamPulseT: number;
  beamQuantumT: number;
  beamCrit: number;
  beamHitIds: Set<string>;
  beamPendingDamage: Map<string, number>;
  /** §ULT precise meter + buffered action + accepted immutable runtime. */
  ultChargeF: number;
  ultBuffer: number;
  ultAccrualThisTick: number;
  ult?: UltimateRuntime;
  ultAlphaBonusTargets: number;
  ultCritCharges: number;
  ultCritEndTick: number;
}

/** §15/§51 per-enemy duelist machine entry (server-private, pruned with the enemy, cleared by
 *  clearTransients). The legacy float fields (`t`/`hits`/`wind`) drive the derived rusher/swarm/zoner
 *  lunge + non-tough duelists byte-for-byte as before; the §51 fields are the TOUGH-COMBO widening —
 *  tick-anchored (worm action-tick model: wrap-safe `(tick − start) | 0` deltas) because the tick
 *  anchors survive catch-up sub-steps exactly where accumulating floats drift. The full combo brain is
 *  this entry; only the three appended presentation edges (comboSeq/comboFlags/juggledSeq) sync. */
interface DuelistComboState {
  phase: "idle" | "leapwind" | "leap" | "settle" | "windup" | "return" | "recover";
  t: number;
  hits: number;
  wind: number;
  // §15 v0.113 LEAP (leaper elites): landing spot, the synced marker id, and the leap cooldown.
  lx?: number;
  ly?: number;
  tg?: string;
  leapCd?: number;
  /** Fixed post-lunge sector captured at Lock. The advertised row and damage consume these same values. */
  strike?: {
    x: number;
    y: number;
    aimX: number;
    aimY: number;
    tg: string;
  };
  // ── §51 TOUGH-COMBO machine (all optional so legacy entries stay shape-compatible) ──
  /** Keys shared TOUGH_COMBOS; "" / undefined = the legacy derived path (unchanged). */
  comboId?: string;
  /** For the deck's no-repeat + ≤40%-advanced pick rules. */
  lastComboId?: string;
  /** 0-based index into the combo's authored steps. */
  stepIndex?: number;
  /** uint32 ArenaState.tick anchors for the CURRENT phase window (wrap-safe signed deltas). */
  stepStartTick?: number;
  stepEndTick?: number;
  /** The committed leap landing point (world px) — FROZEN at the offer; never renegotiated (G3/G5). */
  negotiatedX?: number;
  negotiatedY?: number;
  /** Victim origin at negotiation; moving beyond the offer footprint authors the landing whiff (G4). */
  negotiatedTargetX?: number;
  negotiatedTargetY?: number;
  /** The committed victim (G12 front-claim: the choreography aims at ONE player, period). */
  targetId?: string;
  /** Nav-clamped awkward landings buy two extra settle ticks; ordinary landings use the authored five. */
  settleTicks?: number;
  /** Depth 1–2 learn nouns only: core choreography is committed but truncated to its first two beats. */
  stepLimit?: number;
  /** Position AFTER the parry knockback — the return path-plans FROM here, not from the swing spot. */
  displacedX?: number;
  displacedY?: number;
  /** Tough-combo parry knockback is short bounded motion, never the legacy one-tick 154px position write. */
  knockbackX?: number;
  knockbackY?: number;
  knockbackEndTick?: number;
  /** The next swing is the authored empowered return (gold tell, slower clock, bigger hit). */
  empowered?: boolean;
  /** Parry-baited returns left this run (maxReturns cap — no infinite bait loop). */
  returnsLeft?: number;
  /** Air-keep hits landed this string (G9 ≤ JUGGLE_MAX_AIR_HITS). */
  juggleHits?: number;
  /** Tick of the launcher hit — anchors the G9 ≤2.0s loss-of-control ceiling. */
  launchTick?: number;
  /** Damage dealt to the committed victim this performance (G9 ≤40% max-HP budget). */
  comboDamage?: number;
  /** True only for launcher-authored definitions; G9's damage/control budget does not flatten core grammar. */
  juggleCombo?: boolean;
  /** Ally damage during a live juggle; 8% max-HP breaks the string for co-op rescue. */
  juggleAllyDamage?: number;
  juggleInterruptHp?: number;
}

/** Server-private launch geometry. The wire keeps only immutable epochs; this cache lets disconnect
 * retargeting resume from the packet's current curved-flight point instead of snapping back to its corpse. */
interface XpFlightMeta {
  targetX: number;
  targetY: number;
  c1x: number;
  c1y: number;
}

type XpBoundary = "extract" | "descent" | "belt-victory" | "bossrush-victory" | "boss-clear";

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

  /** §45 rebuilt once per fixed sub-step, then maintained in-place as that tick moves/spawns enemies. */
  private readonly enemyGrid = new SpatialGrid<string>(ENEMY_GRID_CELL_SIZE);
  private readonly enemyCandidates: string[] = [];
  private readonly oversizedEnemyIds: string[] = [];
  /** Grid insertion order is a dense [0, MAX_ENEMIES) tick-local handle, so fixed numeric buffers can
   * accumulate pair forces without allocating vectors/maps in the 20Hz loop. */
  private readonly enemySeparationX = new Float64Array(MAX_ENEMIES);
  private readonly enemySeparationY = new Float64Array(MAX_ENEMIES);
  /** Worm segments are stable numeric handles, never ordinary EnemyState rows. */
  private readonly wormSegmentGrid = new SpatialGrid<number>(ENEMY_GRID_CELL_SIZE);
  private readonly wormSegmentCandidates: number[] = [];
  private readonly wormHitSlots: number[] = [];
  private wormDamageSourceSeq = 0;
  /** Reused swept-capsule samples (16 intervals + both endpoints); no per-beam/tick arrays. */
  private readonly beamSampleX = new Float64Array(17);
  private readonly beamSampleY = new Float64Array(17);
  private readonly beamSampleEndX = new Float64Array(17);
  private readonly beamSampleEndY = new Float64Array(17);
  private readonly beamSampleLength = new Float64Array(17);
  /** Shared caller-owned POI projection slot; every use consumes it before the next query. */
  private readonly poiResolveScratch = { x: 0, y: 0 };
  /** Scratch endpoint for the active beam currently being stepped. Kept off CombatState so the
   * previous pose remains intact until it has been published for remote swept-ribbon interpolation. */
  private beamCurrentX = 0;
  private beamCurrentY = 0;
  private beamCurrentLength = 0;
  private readonly inputs = new Map<string, InputState>();
  private readonly combat = new Map<string, CombatState>();
  /** Local/offline account truth: validated client claim in, canonical room mutations/receipts out. */
  private readonly metaAccounts = new Map<string, MetaAccountV4>();
  /** Account-private move-not-copy escrow. Nothing here is synchronized at 20 Hz. */
  private readonly weaponRuns = new Map<string, RunWeaponLedger>();
  private readonly weaponCuratorOrder: string[] = [];
  private weaponCuratorRecipient = 0;
  private worldTier = 0;
  private readonly disconnectedPlayers = new Map<string, DisconnectedPlayerReservation>();
  private readonly weaponSettlementReceipts = new Map<string, WeaponSettlementResult>();
  private readonly stashSaleReceipts = new Map<string, StashSaleResult>();
  private readonly prestigeReceipts = new Map<string, unknown>();
  /** One optional farewell per terminal game clear; consumed only by an accepted prestige receipt. */
  private readonly prestigeGameClearReceipts = new Set<string>();
  /** Present only when a validated v3 loadout, rather than the compatibility character kit, owns identity. */
  private readonly gearRuns = new Map<string, GearRunRuntime>();
  /** Exact pet level/modifiers and all hot counters are server-private and snapshotted once per run. */
  private readonly petRuns = new Map<string, PetRunRuntime>();
  private readonly petSettledAccounts = new Set<string>();
  private petDimensionEpoch = 0;
  /** Per-enemy ranged-attack cooldown, sec (spitters). Keyed by enemy id; pruned with the enemy. */
  private readonly enemyFireCd = new Map<string, number>();
  /** §16 v0.109 the active boss's data-driven controller (replaces the hardcoded OLD RUST phase timers).
   *  Constructed in `spawnBoss` from the boss kind's `BossDef`; nulled on boss death. Runs the phase machine
   *  + telegraph windups deterministically. `null` while no boss is up. */
  private bossController: BossController | null = null;
  /** Top-down flagship director and fixed scratch. Belt finales deliberately keep the legacy World-Titan. */
  private vastagharEncounter: VastagharEncounterRuntime | null = null;
  private readonly vastagharTargets: VastagharTarget[] = [];
  private readonly vastagharDownTicks = new Map<string, number>();
  private readonly vastagharSweepEpoch = new Map<string, number>();
  private readonly vastagharKillScratch: string[] = [];
  private vastagharVictoryX = 0;
  private vastagharVictoryY = 0;
  private vastagharVictoryReadyTick = 0;
  private vastagharCoreArmTick = 0;
  private vastagharVictoryMode: "" | "arena" | "bossrush" = "";
  private vastagharCoreId = "";
  /** Number of tick-locked patches that have completed. Catch-up substeps share this value so a boss
   *  telegraph settled during the batch cannot be removed before its t=1 state is broadcast. */
  private broadcastGeneration = 0;
  /** §16 v0.109 monotonic id source for synced telegraph rows (`tg{n}`). */
  private telegraphSeq = 0;
  /** §16 v0.109 ids of adds the boss summoned — so the add-cap counts only boss adds, not the horde. Pruned
   *  lazily as adds die. */
  private readonly bossAddIds = new Set<string>();
  private readonly bossAddExpireTick = new Map<string, number>();
  /** §16 v0.109 the injected boss emit-surface, built lazily (see `bossSink`). */
  private _bossSink: VastagharEmitSink | null = null;
  /** Segment trophies are real Echo rows, but cannot merge/latch/collect before terminal core death. */
  private readonly lockedWormEchoIds = new Set<string>();
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
      /** §30 crit CHANCE captured at fire time (friendly shots) — each enemy hit / explosion rolls it. */
      crit?: number;
      /** polish #7 immutable authoritative ownership captured at launch (never inferred near impact). */
      sourcePlayerId?: string;
      sourceWeaponId?: string;
      delivery?: number;
      sourceX?: number;
      sourceY?: number;
    }
  >();
  /** §16 arena-wide HOSTILE-projectile rail. Maintained on spawn/removal/reflection so both the generic
   *  spitter path and BossController admission read the hard ceiling in O(1). Friendly shots never count. */
  private hostileProjectileCount = 0;
  /** Per-zoner puddle-drop cooldown (sec), keyed by enemy id; pruned with the enemy. */
  private readonly zonerDropCd = new Map<string, number>();
  /** Per-zone remaining lifetime (sec), keyed by zone id. */
  private readonly zoneMeta = new Map<string, number>();
  /** §15 duelist (ronin) combo state per enemy id: phase + timer + swings left + the CURRENT windup's
   *  duration (`wind`, for the 0→1 telegraph ramp — `windup` for the first hit, `swingGap` after). Each hit
   *  now telegraphs (no standalone "swing" phase). §51 widened with the tick-anchored TOUGH-COMBO fields
   *  (see DuelistComboState). Pruned with the enemy. */
  private readonly comboState = new Map<string, DuelistComboState>();
  /** §51 DUEL TOKENS (G12): victim player id → the ONE enemy id running the combo language against them.
   *  A second combo-capable tough holds a ring-out orbit until the token frees; map size doubles as the
   *  ≤COMBO_MAX_ACTIVE arena-wide performance count. Freed at recover entry / enemy death / transients. */
  private readonly duelTokens = new Map<string, string>();
  /** §15 v0.113 DODGE-ROLL state per ranger id: `cd` = seconds until it can roll again, `t` = seconds left
   *  in the current roll (>0 = rolling), `dx/dy` = the roll direction. Pruned with the enemy. */
  private readonly dodgeState = new Map<
    string,
    { cd: number; t: number; dx: number; dy: number }
  >();
  /** Ground-pound CC is a short, decaying enemy impulse + stagger. Rows exist only for affected enemies. */
  private readonly poundEnemyEffects = new Map<
    string,
    { vx: number; vy: number; staggerT: number }
  >();
  /** §ULT shared hard-CC immunity: no enemy can be re-stunned by stacked ults inside three seconds. */
  private readonly ultimateStunUntil = new Map<string, number>();
  /** Event Horizon's phase-brand is separate from the signature Brand lane and stacks additively. */
  private readonly ultimateBrands = new Map<string, { remaining: number; multiplier: number }>();
  /** Dimension Door decoys are server-picked taunt bodies and return tickets, never client claims. */
  private readonly ultimateDecoys = new Map<
    string,
    {
      x: number;
      y: number;
      hp: number;
      detonateTick: number;
      returnEndTick: number;
      detonated: boolean;
      damage: number;
    }
  >();
  /** Seismarch fissures tick at a fixed 1Hz cadence; rows allocate only on impact. */
  private readonly ultimateFissures: {
    x: number;
    y: number;
    ownerId: string;
    damage: number;
    nextTick: number;
    endTick: number;
  }[] = [];
  /** Shared scratch for ultimate damage primitives; emptied before every bounded execution beat. */
  private readonly ultimateKills: string[] = [];
  private readonly ultimateTargetCandidates: UltimateTarget[] = [];
  /** §20/§44 in-flight swept blades. `swing` is the immutable descriptor captured at the accepted `canAct`
   *  epoch; `elapsed` advances that one server clock through wind-up + active frames. The blade origin stays
   *  live, while `hit` preserves once-per-enemy-per-accepted-swing semantics regardless of active length. */
  private readonly meleeSwings = new Map<
    string,
    {
      playerId: string;
      swing: SwingDescriptor;
      aim0: number;
      range: number;
      swingArc: number;
      halfWidth: number;
      edgeDamage: number;
      weaponId: string;
      crit: number;
      elapsed: number;
      hit: Set<string>;
    }
  >();
  /** §40.2 quakes awaiting their blade-LANDING moment (damage/epicenter captured at swing time; detonated
   *  when `t` drains — the same shared clock the chop animation + the client's eruption VFX run on). */
  private readonly pendingQuakes: {
    t: number;
    x: number;
    y: number;
    radius: number;
    damage: number;
    crit: number;
    sourcePlayerId: string;
    sourceWeaponId: string;
  }[] = [];
  /** §9/§13 per-DROPPED-pickup grace timer (sec): while > 0 the pickup can't be re-grabbed, so a weapon
   *  dropped at your feet doesn't snap straight back. Keyed by pickup id; only set for player drops. */
  private readonly pickupGrace = new Map<string, number>();
  /** Cached launch control points/last authoritative target positions for guaranteed-flight retargeting. */
  private readonly xpFlights = new Map<string, XpFlightMeta>();
  /** §13 v0.103 salvage provenance: pickup ids whose weapon came off an ENEMY (earned → salvageable).
   *  Gallery/conjured pickups are never in here. Pruned with the pickup; cleared with the transients. */
  private readonly earnedPickups = new Set<string>();
  /** Audit #15: exact mystery-loot identities never enter Schema state before reveal. Rarity remains public
   *  on the pickup for its intended glow; this map is the authoritative weapon/rarity/affix identity. */
  private readonly hiddenPickupIdentities = new Map<
    string,
    { weapon: string; rarity: number; affix: string }
  >();
  /** Mint/provenance/owner rail for bankable loot and exact player-owned field stakes. */
  private readonly pickupWeaponBankMeta = new Map<string, PickupWeaponBankMeta>();
  /** Audit #14: precise Brand durations are gameplay-only. EnemyState.branded is a transition-only 0/1 flag. */
  private readonly brandedTimers = new Map<string, number>();
  /** §8 Conflagration: pending deferred Emberguard re-pulses (the "burning zone" POC). Each fires one more
   *  fire-wave cone once `state.elapsed >= at`. Processed + pruned each tick. */
  private readonly burnPulses: {
    x: number;
    y: number;
    aimX: number;
    aimY: number;
    dmg: number;
    at: number;
    sourcePlayerId: string;
    sourceWeaponId: string;
  }[] = [];
  /** Spawn-director accumulator + monotonic enemy/projectile/zone/pickup id counters. */
  private spawnAccum = 0;
  /** Allocation-free result slot for the bounded QOL-05 candidate search. */
  private spawnCandidateX = 0;
  private spawnCandidateY = 0;
  private enemySeq = 0;
  private projectileSeq = 0;
  private zoneSeq = 0;
  private pickupSeq = 0;
  private xpEchoSeq = 0;
  /** polish #7 fixed preallocated authoritative combat receipt ring (v18). */
  private combatReceiptSeq = 0;
  private combatReceiptCursor = 0;
  /** Closed-beat cleanup holds teardown until every authoritative Echo has caught or folded into a core. */
  private xpBoundary: XpBoundary | null = null;
  private xpBoundaryStartedTick = 0;
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
  /** QOL-01 extraction intent. A production gate starts with a stabilisation beat; every player still in
   *  the disc when it arms is blocked until leaving, so a corpse-standing body cannot carry into the hold. */
  private extractArmTimer = -1;
  private extractHoldTimer = 0;
  private readonly extractBlocked = new Set<string>();
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
  /** Debug-spawned bosses never qualify the run-structure Bond receipt. */
  private bossPetAwardEligible = false;
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

  /** §44 dev-tool gate (Sol audit P0 #1): the debug RPCs (training toggle, boss picker, dev summon, dev
   *  equip, B-key boss) are playtest affordances that must be UNREACHABLE on a public deploy — "host" is
   *  just the first joiner, so one hostile client could otherwise flood the shared Node process with
   *  entities. ON outside production (local dev, vitest) or when DD_DEV_TOOLS=1 (a staged playtest build).
   *  Read per-call (not cached) so tests can flip the environment. */
  private devToolsEnabled(): boolean {
    return process.env.DD_DEV_TOOLS === "1" || process.env.NODE_ENV !== "production";
  }

  /** §44 spend one ACTION-message token for this client (attack/parry/grab/cycle/… — every gameplay RPC
   *  except "input", which has its own budget). Refilled each tick; when dry the message is IGNORED, so a
   *  modified client can't monopolize the event loop between ticks. Returns false when over budget. */
  private takeAction(client: Client): boolean {
    const rec = this.inputs.get(client.sessionId);
    if (!rec) return false;
    if (rec.actionBudget <= 0) return false;
    rec.actionBudget--;
    return true;
  }

  override onCreate(options?: {
    dimensionId?: string;
    bossRush?: boolean;
    belt?: boolean;
    beltLevel?: string;
  }): void {
    this.setState(new ArenaState());
    for (let i = 0; i < COMBAT_RECEIPT_CAP; i++) {
      this.state.combatReceipts.push(new CombatReceiptState());
    }
    this.belt = !!options?.belt; // §29 belt-scroller mode (wide-shallow band, authored deck + collision)
    // §36 the SELECTED belt level (menu level-select). Each level scopes its own dimension (roster/palette),
    // so no two selections are the same run. Unknown id → Sky Carrier.
    this.beltLevel = this.belt ? beltLevelFor(options?.beltLevel ?? "sky-carrier") : null;
    this.state.beltShopX = this.beltLevel?.shopX ?? 0; // §29 sync the shopkeeper's world-x (0 = no vendor)

    // §17 the run's DIMENSION — a belt level fixes its own; else the menu pick. `getDimension` resolves an
    // unknown/missing id back to Wild West, so a stale client can't desync the roster/boss/palette. The id
    // syncs on ArenaState so the client reproduces the matching palette + asset set.
    this.state.dimensionId = this.beltLevel
      ? getDimension(this.beltLevel.dimensionId).id
      : getDimension(options?.dimensionId).id;
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
      (client, message: {
        seq?: number;
        dx?: number;
        dy?: number;
        jump?: boolean;
        crouchHeld?: boolean;
        pound?: boolean;
        slide?: boolean;
        slideHeld?: boolean;
        fireHeld?: boolean;
        aimX?: number;
        aimY?: number;
        targetX?: number;
        targetY?: number;
      }) => {
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
          crouchHeld: message?.crouchHeld === true,
          pound: message?.pound === true,
          slide: message?.slide === true,
          slideHeld: message?.slideHeld === true,
          fireHeld: message?.fireHeld === true,
          fireStartSeq: message?.fireHeld === true ? seq : 0,
          aimX: Number.isFinite(message?.aimX) ? (message.aimX as number) : rec.held.aimX,
          aimY: Number.isFinite(message?.aimY) ? (message.aimY as number) : rec.held.aimY,
          targetX: Number.isFinite(message?.targetX)
            ? (message.targetX as number)
            : rec.held.targetX,
          targetY: Number.isFinite(message?.targetY)
            ? (message.targetY as number)
            : rec.held.targetY,
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
        const held = this.state.players.get(client.sessionId);
        if (held && WEAPONS[held.weapon]?.beam) return;
        if (!this.takeAction(client)) return; // §44 action budget
        const c = this.combat.get(client.sessionId);
        const player = this.state.players.get(client.sessionId);
        if (!c) return;
        if (player && c.stance === STANCE_SLIDE) {
          if (c.slidePhaseTick * (TICK_MS / 1000) + 1e-9 < SLIDE_ATTACK_CANCEL_SECONDS) return;
          this.cancelMoveStance(player, c, true);
        }
        if (player && c.stance === STANCE_CROUCH) this.cancelMoveStance(player, c, true);
        // §7 v0.105 de-clunk: QUEUE the attack rather than latch a boolean — the tick fires it the instant
        // the cooldown drains, so a press that lands a tick early (off-grid melee cadences, held trigger)
        // is honoured instead of silently eaten.
        c.attackBuffer = Math.max(
          ATTACK_BUFFER_SECONDS,
          c.drawLock > 0 ? c.drawLock + TICK_MS / 1000 + 1e-6 : 0,
        );
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

    // G = one ordinary, budgeted buffered ultimate action. The client supplies intent only; aim is
    // normalized here and every destination/target set is rebuilt from authoritative state at acceptance.
    this.onMessage(
      "ultimate",
      (client, message: { aimX?: number; aimY?: number; tx?: number; ty?: number }) => {
        if (!this.takeAction(client)) return;
        const player = this.state.players.get(client.sessionId);
        const c = this.combat.get(client.sessionId);
        if (!player?.alive || !c) return;
        let aimX = Number.isFinite(message?.aimX) ? (message.aimX as number) : c.aimX;
        let aimY = Number.isFinite(message?.aimY) ? (message.aimY as number) : c.aimY;
        const len = Math.hypot(aimX, aimY);
        if (len > 1e-4) {
          aimX /= len;
          aimY /= len;
        } else {
          aimX = 1;
          aimY = 0;
        }
        c.aimX = aimX;
        c.aimY = aimY;
        c.targetX = Number.isFinite(message?.tx) ? (message.tx as number) : player.x + aimX;
        c.targetY = Number.isFinite(message?.ty) ? (message.ty as number) : player.y + aimY;
        player.aimDir = Math.atan2(aimY, aimX);
        c.ultBuffer = ULT_BUFFER_SECONDS;
      },
    );

    // LMB = the melee Parry signature (§7/§8). Base effect: brief i-frames + knockback; ALL offense comes
    // from the §8 augment pool (applied below). (No telegraphed enemy attacks yet, so it's a defensive
    // button + augment offense; the white-tell parry-this-attack layer comes later.)
    this.onMessage("parry", (client) => {
      if (!this.takeAction(client)) return; // §44 action budget (executeParry is an O(enemies) scan)
      const player = this.state.players.get(client.sessionId);
      const c = this.combat.get(client.sessionId);
      if (!player?.alive || !c) return;
      if (c.recoveryT > 0) return; // pound recovery is explicitly a no-parry window
      if (c.slideParryLockT > 0) {
        c.parryBuffer = PARRY_BUFFER_SECONDS;
        return;
      }
      // §44 (Sol audit): NO parry inside the level-up window — the tick path already defines acting as
      // alive AND not in the window, but this immediate path skipped that gate, so a frozen-invincible
      // player could scan/knock the whole horde risk-free every cooldown. Queue it instead: the tick
      // consumes the buffer under the common `acting` gate the moment the window closes.
      if (this.inLevelWindow(player)) {
        c.parryBuffer = PARRY_BUFFER_SECONDS;
        return;
      }
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
      if (!this.takeAction(client)) return; // §44 action budget
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      const c = this.combat.get(client.sessionId);
      if (this.belt && c) this.dissolvePair(player, c);
      if (this.belt) this.syncActiveSlot(player, c);
      else if (c) this.saveWeaponResource(player, c);
      if (c && (c.beamPhase !== 0 || c.beamDescriptor)) {
        this.cancelBeam(player, player.id, c, true, true);
      }
      player.weapon =
        (message?.dir ?? 1) < 0 ? prevWeapon(player.weapon) : nextWeapon(player.weapon);
      player.weaponRarity = RARITY_COMMON; // conjured = plain Common (loot identity lives on DROPS)
      player.weaponAffix = "";
      if (this.belt) {
        const slot = player.slots[player.activeSlot];
        if (slot) {
          slot.weapon = player.weapon;
          slot.rarity = RARITY_COMMON;
          slot.affix = "";
          slot.earned = false;
          slot.resourceReady = false;
        }
      }
      if (c) {
        c.heldEarned = false;
        this.restoreWeaponResource(player, c);
      }
    });

    // §39 DEV PORTAL: jump straight to a specific weapon / character by id (Testing-Grounds only, so it can't
    // touch a live run). Both ids are validated against the real catalogs; a bad id is ignored.
    this.onMessage("devEquip", (client, message: { weapon?: string; character?: string }) => {
      // §44 dev-gated (defense in depth: training is itself unreachable without dev tools) + budgeted.
      if (!this.devToolsEnabled() || !this.takeAction(client)) return;
      if (this.state.mode !== "training") return;
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      if (typeof message?.weapon === "string" && WEAPONS[message.weapon]) {
        const c = this.combat.get(client.sessionId);
        if (c) this.dissolvePair(player, c);
        if (this.belt) this.syncActiveSlot(player, c);
        else if (c) this.saveWeaponResource(player, c);
        if (c && (c.beamPhase !== 0 || c.beamDescriptor)) {
          this.cancelBeam(player, player.id, c, true, true);
        }
        player.weapon = message.weapon;
        player.weaponRarity = RARITY_COMMON;
        player.weaponAffix = "";
        if (player.slots[player.activeSlot]) {
          player.slots[player.activeSlot]!.weapon = message.weapon;
          player.slots[player.activeSlot]!.resourceReady = false;
        }
        if (c) {
          c.heldEarned = false;
          this.restoreWeaponResource(player, c);
        }
      }
      if (typeof message?.character === "string" && isPlayableCharacter(message.character)) {
        player.character = message.character;
        this.snapshotRunIdentity(player, this.combat.get(client.sessionId), true);
      }
    });

    // §29 v0.118 ARSENAL swap: switch which of the 3 slots is in hand (1/2/3 keys). Stows the current held
    // weapon back into its slot first, so the two off-hand weapons are remembered exactly.
    this.onMessage("swapSlot", (client, message: { slot?: number }) => {
      if (!this.takeAction(client)) return; // §44 action budget
      const player = this.state.players.get(client.sessionId);
      if (!player?.alive) return;
      const i = Math.floor(message?.slot ?? -1);
      if (i < 0 || i >= ARSENAL_SLOTS || i === player.activeSlot) return;
      const c = this.combat.get(client.sessionId);
      if (c) this.dissolvePair(player, c);
      this.syncActiveSlot(player, c);
      this.loadSlot(player, c, i);
    });

    // §29 ARSENAL cycle: Q/E through the NON-EMPTY slots (dir < 0 = back). No-op if nothing else is filled.
    this.onMessage("cycleSlot", (client, message: { dir?: number }) => {
      if (!this.takeAction(client)) return; // §44 action budget
      const player = this.state.players.get(client.sessionId);
      if (!player?.alive) return;
      const c = this.combat.get(client.sessionId);
      if (c) this.dissolvePair(player, c);
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
      if (c && this.slotTouchesPair(player, i)) this.dissolvePair(player, c);
      if (i === player.activeSlot) this.syncActiveSlot(player, c); // capture the live held weapon first
      const s = player.slots[i]!;
      if (!s.weapon || player.bag.length >= this.bagCapacity(player)) return;
      const b = new ArsenalSlot();
      this.copySlot(b, s);
      player.bag.push(b);
      this.copySlot(s, null);
      if (i === player.activeSlot) this.loadSlot(player, c, i); // now empty → fists in hand
      this.syncWeaponRunFromArsenal(player);
      this.sendWeaponManifest(player);
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
      if (c && this.slotTouchesPair(player, si)) this.dissolvePair(player, c);
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
      this.syncWeaponRunFromArsenal(player);
      this.sendWeaponManifest(player);
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
        if (c && this.slotTouchesPair(player, idx)) this.dissolvePair(player, c);
        if (idx === player.activeSlot) this.syncActiveSlot(player, c);
        const s = player.slots[idx]!;
        if (!s.weapon) return;
        if (s.bankEntryId) return;
        player.scrip = Math.min(65535, player.scrip + this.petSalePayout(player, s.rarity, s.earned));
        this.copySlot(s, null);
        if (idx === player.activeSlot) this.loadSlot(player, c, idx);
        this.publishAccountMutation(player);
      } else {
        if (idx < 0 || idx >= player.bag.length) return;
        const b = player.bag[idx]!;
        if (b.bankEntryId) return;
        player.scrip = Math.min(65535, player.scrip + this.petSalePayout(player, b.rarity, b.earned));
        player.bag.splice(idx, 1);
        this.publishAccountMutation(player);
      }
    });

    // Safe account-side shop conversion. The client supplies identity + revision, never price or rarity.
    this.onMessage(
      "sellStashEntry",
      (client, message: {
        requestId?: string;
        expectedRevision?: number;
        entryId?: string;
        from?: "stash" | "intake";
      }) => {
        if (!this.takeAction(client)) return;
        const account = this.metaAccounts.get(client.sessionId);
        const player = this.state.players.get(client.sessionId) ??
          this.disconnectedPlayers.get(client.sessionId)?.player;
        if (!account || !player) return;
        const requestId = typeof message?.requestId === "string" ? message.requestId : "";
        const receiptKey = `${client.sessionId}:${requestId}`;
        const replay = this.stashSaleReceipts.get(receiptKey);
        if (replay) {
          this.sendOwnerMessage(client.sessionId, "stashSaleReceipt", replay);
          this.sendOwnerMessage(client.sessionId, "metaAccount", account);
          return;
        }
        const result = sellWeaponBankEntry(account, {
          requestId,
          expectedRevision: message?.expectedRevision as number,
          entryId: typeof message?.entryId === "string" ? message.entryId : "",
          from: message?.from === "intake" ? "intake" : "stash",
        });
        if (!result.ok) return;
        this.stashSaleReceipts.set(receiptKey, result);
        player.scrip = account.scrip;
        this.sendOwnerMessage(client.sessionId, "stashSaleReceipt", result);
        this.sendOwnerMessage(client.sessionId, "metaAccount", account);
      },
    );

    // Prestige tower visuals arrive later; this is the revisioned account int + all-weapon wipe hook.
    this.onMessage(
      "prestigeReset",
      (client, message: { requestId?: string; expectedRevision?: number }) => {
        if (!this.takeAction(client)) return;
        const account = this.metaAccounts.get(client.sessionId);
        if (!account || message?.expectedRevision !== account.revision) return;
        const requestId = typeof message.requestId === "string" ? message.requestId : "";
        if (!requestId || requestId.length > 64) return;
        const receiptKey = `${client.sessionId}:${requestId}`;
        const replay = this.prestigeReceipts.get(receiptKey);
        if (replay) {
          this.sendOwnerMessage(client.sessionId, "prestigeReceipt", replay);
          return;
        }
        // A prestige is the optional result-screen transaction earned by clearing the current run. The
        // bank helper retains its atomic no-expedition + cap laws; this room owns the game-clear receipt.
        if (
          this.state.outcome !== "victory" ||
          !this.prestigeGameClearReceipts.has(client.sessionId)
        )
          return;
        const result = wipeWeaponBankForPrestige(account);
        if (!result.ok) return;
        this.prestigeGameClearReceipts.delete(client.sessionId);
        const player =
          this.state.players.get(client.sessionId) ??
          this.disconnectedPlayers.get(client.sessionId)?.player;
        if (player) player.prestige = account.prestige;
        const receipt = { ...result, prestige: account.prestige, scripPaid: 0, revision: account.revision };
        this.prestigeReceipts.set(receiptKey, receipt);
        this.sendOwnerMessage(client.sessionId, "prestigeReceipt", receipt);
        this.sendOwnerMessage(client.sessionId, "metaAccount", account);
      },
    );

    // §31 META BUY: spend scrip at the shopkeeper on a PERMANENT upgrade level (persists across runs). Gated
    // on proximity + alive; server-authoritative cost check + stat application (the client can't grant itself
    // a level — it only requests, and re-persists the synced result).
    // Dual-wield BIND is a deliberate shop service. The pair is only a link from the active slot to one
    // other occupied arsenal row; both halves keep their own identity and G-01 debt in place.
    this.onMessage("bindPair", (client, message: { off?: number }) => {
      if (!this.takeAction(client)) return;
      const player = this.state.players.get(client.sessionId);
      const c = this.combat.get(client.sessionId);
      if (!player?.alive || !c || !this.belt || this.inLevelWindow(player)) return;
      if (c.stance === STANCE_SLIDE) return;
      const shopX = this.state.beltShopX;
      if (shopX <= 0 || Math.abs(player.x - shopX) > SHOP_RADIUS) return;
      const offIndex = Math.floor(message?.off ?? -1);
      if (
        offIndex < 0 ||
        offIndex >= ARSENAL_SLOTS ||
        offIndex === player.activeSlot ||
        player.offhandSlot === offIndex
      ) return;

      this.syncActiveSlot(player, c);
      const leadSlot = player.slots[player.activeSlot];
      const offSlot = player.slots[offIndex];
      const lead = WEAPONS[leadSlot?.weapon ?? ""];
      const off = WEAPONS[offSlot?.weapon ?? ""];
      if (!leadSlot || !offSlot || !lead || !off || !pairEligible(lead, off)) return;
      const fee = Math.max(
        scripValue(leadSlot.rarity, leadSlot.earned),
        scripValue(offSlot.rarity, offSlot.earned),
      );
      if (player.scrip < fee) return;

      if (player.offhandSlot !== 255) this.dissolvePair(player, c, false);
      this.initializeStoredWeaponResource(player, offSlot);
      player.scrip -= fee;
      player.offhandSlot = offIndex;
      player.pairBaseSeq = player.attackSeq;
      player.offMaxCharges = 0;
      player.offCharges = 0;
      c.offLastWeapon = offSlot.weapon;
      c.pairComboSeq = undefined;
      c.pairComboAcceptedAtMs = 0;
      c.pairComboId = `${lead.id}|${off.id}`;
      c.pairComboFamily = meleeComboSelectionFor(lead)?.family ?? "arc";
      c.pairComboStep = 0;
      c.pairComboExpiresAtMs = 0;
      this.bindRunWeaponPair(player, leadSlot, offSlot);
      const quirkMult = c.mods.drawLockMult;
      c.drawLock = Math.max(c.drawLock, WEAPON_DRAW_LOCK_SECONDS * quirkMult);
      if (c.beamPhase !== 0 || c.beamDescriptor) {
        this.cancelBeam(player, player.id, c, true, true);
      }
      if (fee > 0) this.publishAccountMutation(player);
      this.sendWeaponManifest(player);
    });

    // UNBIND is free but remains a shop service. No refund and no ledger writes: the off row is already live.
    this.onMessage("unbindPair", (client) => {
      if (!this.takeAction(client)) return;
      const player = this.state.players.get(client.sessionId);
      const c = this.combat.get(client.sessionId);
      if (!player?.alive || !c || !this.belt) return;
      const shopX = this.state.beltShopX;
      if (shopX <= 0 || Math.abs(player.x - shopX) > SHOP_RADIUS) return;
      if (player.offhandSlot !== 255) {
        const durable = this.unbindRunWeaponPair(player);
        this.dissolvePair(player, c, true);
        if (durable) {
          this.syncWeaponRunFromArsenal(player);
          this.publishAccountMutation(player);
          this.sendWeaponManifest(player);
        }
      }
    });

    this.onMessage("buyUpgrade", (client, message: { id?: string }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player?.alive || !this.belt) return;
      if (this.combat.get(client.sessionId)?.stance === STANCE_SLIDE) return;
      const shopX = this.state.beltShopX;
      if (shopX <= 0 || Math.abs(player.x - shopX) > SHOP_RADIUS) return;
      const id = message?.id;
      if (id !== "vitality" && id !== "fortune" && id !== "power") return;
      const account = this.metaAccounts.get(player.id);
      if (!account) return;
      const grants = LEGACY_UPGRADE_GRANTS[id];
      let ownedRank = 0;
      for (let rank = 1; rank < grants.length; rank++) {
        const gearId = grants[rank];
        if (gearId && account.ownedGear.includes(gearId)) ownedRank = rank;
      }
      const legacyRank = id === "vitality"
        ? player.upVitality
        : id === "fortune"
          ? player.upFortune
          : player.upPower;
      const cur = Math.max(ownedRank, legacyRank);
      const cost = nextUpgradeCost(id, cur);
      if (cost === null || player.scrip < cost) return; // maxed or can't afford
      player.scrip -= cost;
      const granted = grants[cur + 1];
      if (granted && !account.ownedGear.includes(granted)) {
        const requested = new Set([...account.ownedGear, granted]);
        account.ownedGear = GEAR_IDS.filter((gearId) => requested.has(gearId));
      }
      // A v3 wardrobe is frozen for the run. The compatibility path keeps old clients playable while the
      // client wardrobe wave is absent; its tombstones never feed a gear-seeded run.
      if (this.gearRuns.has(player.id)) {
        this.publishAccountMutation(player);
        return;
      } else if (id === "vitality") {
        player.upVitality += 1;
        player.maxHp += META_VITALITY_HP;
        player.hp = Math.min(player.maxHp, player.hp + META_VITALITY_HP); // heal the new headroom
      } else if (id === "fortune") {
        player.upFortune += 1;
        player.luk += META_FORTUNE_LUK;
      } else {
        player.upPower += 1;
        player.str += META_POWER_STR;
      }
      this.publishAccountMutation(player);
    });

    // §classmerge C key: cosmetic during a run; Testing Grounds deliberately re-snapshots the full kit.
    this.onMessage("cycleCharacter", (client) => {
      if (!this.takeAction(client)) return; // §44 action budget
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      player.character = nextCharacter(player.character);
      if (this.state.mode === "training") {
        this.snapshotRunIdentity(player, this.combat.get(client.sessionId), true);
      }
    });

    // §9/§13 R-TAP = DROP the held weapon on the floor (grabbable) in front of you; you fall back to
    // FISTS (§9). The drop gets a brief grace so it doesn't snap straight back to you (DROP_GRACE_SECONDS).
    // Provenance (v0.103): the dropped pickup INHERITS the held weapon's earned flag, so an earned drop
    // stays salvageable after a re-grab but a conjured one can never launder into salvage value.
    this.onMessage("dropWeapon", (client) => {
      if (!this.takeAction(client)) return; // §44 action budget (each drop allocates a synced pickup)
      const player = this.state.players.get(client.sessionId);
      if (!player?.alive) return;
      const c = this.combat.get(client.sessionId);
      if (c?.stance === STANCE_SLIDE) return;
      this.dropHeldWeapon(player, c);
    });

    // §13 R-HOLD = SALVAGE the held weapon (consumed, no pickup) → fall back to FISTS. §6 v0.103: salvage
    // is now the BANKABLE run currency, so it only pays for weapons that trace back to an ENEMY DROP
    // (`heldEarned` provenance) — an unearned weapon still salvages away (QoL) but is worth nothing.
    this.onMessage("salvageWeapon", (client) => {
      if (!this.takeAction(client)) return; // §44 action budget
      const player = this.state.players.get(client.sessionId);
      if (!player?.alive || player.weapon === FISTS_WEAPON) return;
      const c = this.combat.get(client.sessionId);
      if (c?.stance === STANCE_SLIDE) return;
      const bankEntryId = player.slots[player.activeSlot]?.bankEntryId ?? "";
      if (c) this.dissolvePair(player, c);
      if (c) this.saveWeaponResource(player, c);
      if (bankEntryId) {
        this.consumeRunWeaponEntry(player, bankEntryId);
      } else if (c?.heldEarned) {
        player.salvaged += salvageValue(player.weaponRarity); // §13 v0.104: rarity drives the parts value
        c.heldEarned = false;
      }
      player.weapon = FISTS_WEAPON;
      player.weaponRarity = RARITY_COMMON;
      player.weaponAffix = "";
      if (this.belt) this.copySlot(player.slots[player.activeSlot]!, null);
      if (c) this.restoreWeaponResource(player, c);
      this.syncWeaponRunFromArsenal(player);
      this.sendWeaponManifest(player);
    });

    // §13 R-TAP near a ground weapon = GRAB it (the client only sends this when a pickup is in reach).
    // Equips the nearest pickup; player drops (`drop*`) are consumed on grab, the Testing-Grounds gallery
    // (`pk*`) persists so you can keep swapping.
    this.onMessage("grabWeapon", (client) => {
      if (!this.takeAction(client)) return; // §44 action budget (O(pickups) scan per call)
      const player = this.state.players.get(client.sessionId);
      if (!player?.alive) return;
      if (this.combat.get(client.sessionId)?.stance === STANCE_SLIDE) return;
      let best: PickupState | null = null;
      let bestD = Number.POSITIVE_INFINITY;
      this.state.pickups.forEach((pk, pid) => {
        if ((this.pickupGrace.get(pid) ?? 0) > 0) return;
        const bankMeta = this.pickupWeaponBankMeta.get(pid);
        if (bankMeta?.entry && bankMeta.ownerId && bankMeta.ownerId !== player.id) return;
        if (bankMeta?.ownerId && bankMeta.ownerId !== player.id && this.state.elapsed < bankMeta.ownerLockUntil) return;
        const d = (pk.x - player.x) ** 2 + (pk.y - player.y) ** 2;
        const petReach = this.petRuns.get(player.id)?.mods.earnedPickupRadius ?? 0;
        const radius = this.earnedPickups.has(pid) && petReach > 0 ? petReach : PICKUP_RADIUS;
        if (d <= radius * radius && d <= bestD) {
          bestD = d;
          best = pk;
        }
      });
      if (!best) return;
      const grabbed = best as PickupState;
      // Audit #15: reveal from the server-only identity rail only after the authoritative grab succeeds.
      // A consumed `drop*` is deleted before the next patch; a persistent pickup keeps the revealed fields.
      const hidden = this.hiddenPickupIdentities.get(grabbed.id);
      if (hidden) {
        grabbed.weapon = hidden.weapon;
        grabbed.weaponPublic = hidden.weapon;
        grabbed.rarity = hidden.rarity;
        grabbed.affix = hidden.affix;
        grabbed.affixPublic = hidden.affix;
        grabbed.known = true;
        this.hiddenPickupIdentities.delete(grabbed.id);
      }
      const pickupBankMeta = this.pickupWeaponBankMeta.get(grabbed.id);
      let bankEntry = pickupBankMeta?.entry;
      if (!bankEntry && pickupBankMeta && this.weaponRuns.has(player.id)) {
        const weapon = this.mintWeaponInstance(
          grabbed.weapon,
          grabbed.rarity,
          grabbed.affix,
          pickupBankMeta.provenance,
        );
        bankEntry = { kind: "single", entryId: weapon.instanceId, weapon };
        pickupBankMeta.entry = bankEntry;
        pickupBankMeta.ownerId = player.id;
      }
      const weaponRun = this.weaponRuns.get(player.id);
      if (
        bankEntry &&
        weaponRun &&
        !weaponRun.entries.has(bankEntry.entryId) &&
        weaponRun.entries.size >= WEAPON_CARRY_MAX_PHYSICAL
      ) return;
      const c = this.combat.get(client.sessionId);
      if (this.belt) {
        // §29 belt: grabs ACCUMULATE into the 3-slot arsenal (the carousel is gone) — fill an empty slot,
        // overflow to the bag, only drop when everything is full.
        if (!this.grabIntoArsenal(player, c, grabbed, bankEntry)) return;
      } else {
        if (bankEntry?.kind === "pair") return;
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
        if (c) {
          c.heldEarned = this.earnedPickups.has(grabbed.id);
          this.restoreWeaponResource(player, c, true);
        }
        if (bankEntry?.kind === "single") {
          this.installWeaponMember(player.slots[player.activeSlot]!, bankEntry, bankEntry.weapon);
          this.registerFoundWeaponEntry(player, bankEntry);
        }
      }
      if (grabbed.id.startsWith("drop")) {
        this.state.pickups.delete(grabbed.id);
        this.pickupGrace.delete(grabbed.id);
        if (this.earnedPickups.delete(grabbed.id)) this.publishPetPickupEligibility();
        this.hiddenPickupIdentities.delete(grabbed.id);
        this.pickupWeaponBankMeta.delete(grabbed.id);
      }
      this.sendWeaponManifest(player);
    });

    // §5 JUMP (Spacebar) — a low all-class traversal HOP, then a cooldown so it isn't spammable. PURE
    // movement, NOT a dodge (no i-frames — the parry stays the defensive tool). The §17 pitfall layer reads
    // `airborne` to let a hopping player clear a gap.
    this.onMessage("jump", (client) => {
      if (!this.takeAction(client)) return; // §44 action budget
      const c = this.combat.get(client.sessionId);
      if (!c) return;
      // §7 v0.105 de-clunk: QUEUE the hop — the tick fires it the instant the player is grounded + off
      // cooldown, so a SPACE pressed a beat early (during the ~0.25s post-landing dead window) still hops
      // instead of vanishing. (`alive` / level-window / grounded / cooldown are all re-checked on consume.)
      c.jumpBuffer = JUMP_BUFFER_SECONDS;
    });

    // Toggle the Testing Grounds (§21): stop spawns, swap the swarm for dummies + weapon pickups.
    // Run-wide → host-only (a non-host can't yank everyone into/out of training). §44 DEV-GATED: on a
    // public deploy the Testing Grounds (and everything reachable only through it — dev summon, dev
    // equip, the showroom) does not exist; "host" is just the first joiner, not a trust level.
    this.onMessage("toggleTraining", (client) => {
      if (!this.devToolsEnabled() || !this.takeAction(client)) return;
      if (!this.isHost(client)) return;
      // Entering the workshop abandons the initiating host's live expedition. The shared dev scene may
      // move the squad, but a host action never settles or destroys a teammate's escrow.
      this.toggleTraining(client.sessionId);
    });

    // §31 SHOWROOM paging: cycle the Testing-Grounds weapon gallery to the next/prev page. Host-only +
    // training-only (the shared gallery is a co-op-wide view).
    this.onMessage("galleryPage", (client, message: { dir?: number }) => {
      if (!this.takeAction(client)) return; // §44 budget (spawnGalleryPage rebuilds the whole shelf)
      if (!this.isHost(client) || this.state.mode !== "training") return;
      this.galleryPage += (message?.dir ?? 1) < 0 ? -1 : 1;
      this.spawnGalleryPage();
    });

    // Restart the run (playtest QoL): wipe the horde, reset the clock, revive everyone fresh.
    // Host-only — co-op shares one run, so one client must not be able to reset everyone's progress.
    this.onMessage("restart", (client) => {
      if (!this.isHost(client)) return;
      if (this.state.outcome === "active" && this.state.players.size > 1) return;
      this.restartRun();
    });

    // Debug/playtest: summon the boss now instead of waiting for the timed spawn (B key). Host-only,
    // §44 dev-gated (a public run earns its boss on the timer).
    this.onMessage("spawnBoss", (client) => {
      if (!this.devToolsEnabled() || !this.takeAction(client)) return;
      if (this.isHost(client) && this.state.mode === "arena" && !this.bossSpawned) {
        this.spawnBoss(undefined, false);
      }
    });

    // §16 v0.109 Debug BOSS PICKER: spawn a SPECIFIC boss def by kind to playtest its style (works in arena
    // OR training; re-spawns/swaps a live boss). Host-only + kind validated + §44 dev-gated.
    this.onMessage("spawnBossDef", (client, message: { kind?: string }) => {
      if (!this.devToolsEnabled() || !this.takeAction(client)) return;
      if (!this.isHost(client)) return;
      const kindId = message?.kind;
      if (
        typeof kindId !== "string" ||
        (ENEMY_KINDS[kindId]?.archetype !== "boss" && !BOSS_DEF_IDS.includes(kindId))
      ) return;
      this.spawnBoss(kindId, false);
    });

    // §21 Dev summon (Tab menu): spawn N of a chosen enemy kind on a ring around the requester, optionally
    // TOUGH. Training-mode ONLY — it's a sandbox affordance (so any client may summon; both players test),
    // and gating to training keeps it out of a live survival run. All fields validated (untrusted client).
    this.onMessage(
      "debugSpawn",
      (client, message: { kind?: string; count?: number; tough?: boolean }) => {
        if (!this.devToolsEnabled() || !this.takeAction(client)) return; // §44 dev-gated + budgeted
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

    // §classmerge level-up: one validated choice resolves +2 chosen and +1 deterministic ballast.
    this.onMessage("chooseAttribute", (client, message: { attr?: string }) => {
      if (!this.takeAction(client)) return; // §44 action budget
      const player = this.state.players.get(client.sessionId);
      if (!player || player.flexPending <= 0) return;
      const attr = message?.attr;
      if (!isAttr(attr)) return; // validate the untrusted field, then it narrows to Attr
      applyAllocationChoice(player, attr);
      consumeFlex(player);
      this.syncFlexTimer(player);
    });

    // §8 signature pick: the player chooses one augment from the offered 3-of-9 draft.
    this.onMessage("chooseAugment", (client, message: { id?: string }) => {
      if (!this.takeAction(client)) return; // §44 action budget
      const player = this.state.players.get(client.sessionId);
      if (!player || player.sigPending <= 0) return;
      const id = message?.id;
      if (!isAugment(id)) return; // valid augment id…
      if (!player.sigOffer.split(",").includes(id)) return; // …AND one actually offered this pick
      player.augments = player.augments ? `${player.augments},${id}` : id;
      player.sigPending = Math.max(0, player.sigPending - 1);
      player.sigOffer = ""; // re-rolled next tick by tickLevelWindows if more picks remain
      this.consumeSignatureGate(player);
      // Keep the window open + timer alive if anything's still owed (flex or another sig pick).
      player.flexTimer =
        player.flexPending > 0 || player.sigPending > 0 ? LEVELUP_WINDOW_SECONDS : 0;
      this.syncFlexTimer(player);
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
    this.hostileProjectileCount = 0;
    this.enemyFireCd.clear();
    this.zonerDropCd.clear();
    this.zoneMeta.clear();
    this.comboState.clear();
    this.duelTokens.clear(); // §51 no duel claim may ghost-carry into the fresh run
    this.dodgeState.clear(); // §15 v0.113
    this.poundEnemyEffects.clear();
    this.ultimateStunUntil.clear();
    this.ultimateBrands.clear();
    this.ultimateDecoys.clear();
    this.ultimateFissures.length = 0;
    this.meleeSwings.clear();
    this.pendingQuakes.length = 0; // §40.2 no landed-blade detonation may carry across a run boundary
    this.pickupGrace.clear();
    if (this.earnedPickups.size > 0) {
      this.earnedPickups.clear();
      this.publishPetPickupEligibility();
    }
    this.hiddenPickupIdentities.clear();
    this.pickupWeaponBankMeta.clear();
    this.brandedTimers.clear();
    this.burnPulses.length = 0;
    this.state.beams.clear();
    for (const [id, c] of this.combat) {
      c.beamDescriptor = undefined;
      c.beamPhase = 0;
      c.beamPhaseT = 0;
      c.beamChannelT = 0;
      c.beamPulseT = 0;
      c.beamQuantumT = 0;
      c.beamPendingDamage.clear();
      c.beamHitIds.clear();
      c.beamInputWasHeld = false;
      c.juggleArmed = false;
      c.juggleMercy = 0;
      c.poundUsed = false;
      c.poundGatherT = 0;
      c.recoveryT = 0;
      c.momentumX = 0;
      c.momentumY = 0;
      c.slidePhase = SLIDE_PHASE_OFF;
      c.slidePhaseTick = 0;
      c.slideColdArmed = true;
      c.slideColdRearmTicks = 0;
      c.slideParryLockT = 0;
      c.ultBuffer = 0;
      c.ultAccrualThisTick = 0;
      c.ult = undefined;
      c.ultCritCharges = 0;
      c.ultCritEndTick = 0;
      const player = this.state.players.get(id);
      if (player) {
        player.ultPhase = UltimatePhase.Idle;
        this.cancelMoveStance(player, c, true);
      }
    }
    this.state.telegraphs.clear(); // §16/§15 clear any orphan leap/boss markers on a reset
    this.enemyGrid.clear(); // §45 no cleared combat body may remain queryable across the boundary
    this.wormSegmentGrid.clear();
  }

  private clearXpEchoes(): void {
    this.state.xpEchoes.clear();
    this.lockedWormEchoIds.clear();
    this.xpFlights.clear();
    this.xpBoundary = null;
  }

  /** §6 terminal combat teardown shared by wipes and every victory route. Pickups/player state remain for the
   *  result screen; all damage-producing bodies and their non-synced machines are retired together. */
  private clearCombatEntities(): void {
    this.clearBoss();
    this.state.enemies.clear();
    this.state.projectiles.clear();
    this.state.zones.clear();
    this.clearTransients();
  }

  /** §6 enter a terminal result exactly once through the full combat teardown path. */
  private enterTerminalOutcome(outcome: "defeat" | "victory"): void {
    this.settleMetaAccounts(outcome);
    // A wipe has no eligible collector and explicitly forfeits unclaimed field XP with the failed run.
    // Victory routes reach here only after `beginXpBoundary` has visibly caught every paid packet.
    if (outcome === "defeat") this.clearXpEchoes();
    this.state.outcome = outcome;
    this.clearCombatEntities();
  }

  /** §13 v0.106 (A11) spawn the player's currently-held weapon on the floor as a grabbable pickup in front
   *  of them, inheriting its rolled loot identity + earned provenance + a brief re-grab GRACE, then reset the
   *  hands to FISTS. No-op on fists (nothing to drop). Shared by the R-tap DROP and the grab-while-holding
   *  SWAP, so a grab can never silently DESTROY a held (possibly Legendary) weapon. */
  private dropHeldWeapon(player: PlayerState, c: CombatState | undefined): void {
    if (player.weapon === FISTS_WEAPON) return;
    const activeSlot = player.slots[player.activeSlot];
    const bankEntryId = activeSlot?.bankEntryId ?? "";
    const bankEntry = bankEntryId ? this.weaponRuns.get(player.id)?.entries.get(bankEntryId)?.entry : undefined;
    const pairedOffIndex = bankEntry?.kind === "pair" ? player.offhandSlot : 255;
    if (c) this.dissolvePair(player, c);
    if (c) this.saveWeaponResource(player, c);
    const ax = c?.aimX ?? 1;
    const ay = c?.aimY ?? 0;
    const pk = new PickupState();
    pk.id = `drop${this.pickupSeq++}`;
    pk.weapon = player.weapon;
    pk.weaponPublic = player.weapon;
    // The player KNOWS what they dropped — identity + its rolled loot identity ride the pickup.
    pk.rarity = player.weaponRarity;
    pk.affix = player.weaponAffix;
    pk.affixPublic = player.weaponAffix;
    const dropX = clamp(player.x + ax * PICKUP_RADIUS * 1.6, PICKUP_RADIUS, ARENA_WIDTH - PICKUP_RADIUS);
    const dropY = clamp(player.y + ay * PICKUP_RADIUS * 1.6, PICKUP_RADIUS, ARENA_HEIGHT - PICKUP_RADIUS);
    const sp = this.placePickupPos(dropX, dropY); // §29 belt: keep the drop on the deck (band + off pits)
    pk.x = sp.x;
    pk.y = sp.y;
    this.state.pickups.set(pk.id, pk);
    this.pickupGrace.set(pk.id, DROP_GRACE_SECONDS);
    if (bankEntry) {
      this.pickupWeaponBankMeta.set(pk.id, {
        provenance: bankEntry.kind === "pair" ? bankEntry.lead.provenance : bankEntry.weapon.provenance,
        entry: bankEntry,
        ownerId: player.id,
        ownerLockUntil: Number.POSITIVE_INFINITY,
      });
    }
    if (c?.heldEarned) {
      this.earnedPickups.add(pk.id);
      this.publishPetPickupEligibility();
    }
    if (c && (c.beamPhase !== 0 || c.beamDescriptor)) {
      this.cancelBeam(player, player.id, c, true, true);
    }
    if (c) c.heldEarned = false;
    player.weapon = FISTS_WEAPON;
    player.weaponRarity = RARITY_COMMON;
    player.weaponAffix = "";
    if (this.belt || bankEntry) this.copySlot(player.slots[player.activeSlot]!, null);
    if (pairedOffIndex !== 255 && player.slots[pairedOffIndex]?.bankEntryId === bankEntryId) {
      this.copySlot(player.slots[pairedOffIndex]!, null);
    }
    if (c) this.restoreWeaponResource(player, c);
    this.syncWeaponRunFromArsenal(player);
    this.sendWeaponManifest(player);
  }

  // ── §29 v0.118 ARSENAL helpers: the held weapon is the ACTIVE slot's live mirror; these keep the slots
  // array in sync and move weapons between hand / slots / bag. ──
  /** Copy one stored weapon into another (or clear `dst` when `src` is null). */
  /** Initialize a never-drawn stored weapon exactly once. Rebinding a ready row never grants resources. */
  private initializeStoredWeaponResource(player: PlayerState, slot: ArsenalSlot): void {
    if (slot.resourceReady && slot.resourceWeapon === slot.weapon) return;
    slot.resourceWeapon = slot.weapon;
    slot.resourceReady = true;
    slot.cooldown = 0;
    slot.reload = 0;
    slot.resourceCharges = 0;
  }

  /** Return the authoritative paired-off row only while the slot link and eligibility still agree. */
  private pairedOffSlot(player: PlayerState, c: CombatState): ArsenalSlot | undefined {
    const index = player.offhandSlot;
    if (index === 255 || index === player.activeSlot || index >= player.slots.length) return undefined;
    const slot = player.slots[index];
    if (!slot || slot.weapon !== c.offLastWeapon) return undefined;
    if (!pairEligible(WEAPONS[player.weapon], WEAPONS[slot.weapon])) return undefined;
    return slot;
  }

  /** Clear only relationship/presentation state. The off slot's cooldown/reload/ammo row is never written. */
  private dissolvePair(player: PlayerState, c: CombatState, armDrawLock = true): void {
    if (player.offhandSlot === 255) return;
    player.offhandSlot = 255;
    player.offCharges = 0;
    player.offMaxCharges = 0;
    c.offLastWeapon = "";
    c.pairComboSeq = undefined;
    c.pairComboAcceptedAtMs = 0;
    c.pairComboId = "";
    c.pairComboStep = 0;
    c.pairComboExpiresAtMs = 0;
    this.meleeSwings.delete(`${player.id}:0`);
    this.meleeSwings.delete(`${player.id}:1`);
    if (armDrawLock) {
      const quirkMult = c.mods.drawLockMult;
      c.drawLock = Math.max(c.drawLock, WEAPON_DRAW_LOCK_SECONDS * quirkMult);
    }
  }

  private slotTouchesPair(player: PlayerState, slot: number): boolean {
    return player.offhandSlot !== 255 &&
      (slot === player.activeSlot || slot === player.offhandSlot);
  }

  /** Paired off-hand debt ages live exactly once. The stowed loop excludes this same row. */
  private stepPairedOffWeaponResources(player: PlayerState, slot: ArsenalSlot, dt: number): void {
    slot.cooldown = Math.max(-dt, slot.cooldown - dt);
    slot.reload = 0;
    slot.resourceCharges = 0;
    player.offMaxCharges = 0;
    player.offCharges = 0;
  }

  private copySlot(dst: ArsenalSlot, src: ArsenalSlot | null): void {
    dst.weapon = src?.weapon ?? "";
    dst.rarity = src?.rarity ?? 0;
    dst.affix = src?.affix ?? "";
    dst.earned = src?.earned ?? false;
    dst.resourceWeapon = src?.resourceWeapon ?? "";
    dst.resourceReady = src?.resourceReady ?? false;
    dst.cooldown = src?.cooldown ?? 0;
    dst.reload = 0;
    dst.resourceCharges = 0;
    dst.instanceId = src?.instanceId ?? "";
    dst.bankEntryId = src?.bankEntryId ?? "";
    dst.bankEntryKind = src?.bankEntryKind ?? "";
    dst.bankPairRole = src?.bankPairRole ?? "";
    dst.bankProvenance = src?.bankProvenance ?? "";
    dst.sourceWorldTier = src?.sourceWorldTier ?? 0;
    dst.homeIssue = src?.homeIssue ?? false;
  }

  private mintWeaponOpaqueId(prefix: "wi" | "wp"): string {
    return `${prefix}_${randomBytes(16).toString("base64url")}`;
  }

  private mintWeaponInstance(
    weaponId: string,
    rarity: number,
    affix: string,
    provenance: WeaponProvenance,
  ): WeaponInstanceV1 {
    return {
      instanceId: this.mintWeaponOpaqueId("wi"),
      weaponId,
      rarity: weaponRarityId(rarity),
      affix: affix as WeaponInstanceV1["affix"],
      provenance,
      sourceWorldTier: this.worldTier,
    };
  }

  private installWeaponMember(
    slot: ArsenalSlot,
    entry: WeaponBankEntryV1,
    member: WeaponInstanceV1,
    role: "" | "lead" | "offhand" = "",
  ): void {
    this.copySlot(slot, null);
    slot.weapon = member.weaponId;
    slot.rarity = RARITIES.findIndex((rarity) => rarity.id === member.rarity);
    slot.affix = member.affix;
    slot.earned = true;
    slot.instanceId = member.instanceId;
    slot.bankEntryId = entry.entryId;
    slot.bankEntryKind = entry.kind;
    slot.bankPairRole = role;
    slot.bankProvenance = member.provenance;
    slot.sourceWorldTier = member.sourceWorldTier;
    slot.resourceWeapon = member.weaponId;
    slot.resourceReady = false;
  }

  private installHomeIssue(slot: ArsenalSlot): void {
    this.copySlot(slot, null);
    slot.weapon = DEFAULT_WEAPON;
    slot.rarity = RARITY_COMMON;
    slot.affix = "";
    slot.earned = false;
    slot.homeIssue = true;
    slot.resourceWeapon = DEFAULT_WEAPON;
    slot.resourceReady = false;
  }

  /** Project account-private escrow into the existing three slots + dense Pack rows at a join/rejoin edge. */
  private materializeWeaponRun(player: PlayerState, account: MetaAccountV4): void {
    while (player.slots.length < ARSENAL_SLOTS) player.slots.push(new ArsenalSlot());
    for (const slot of player.slots) this.copySlot(slot, null);
    player.bag.splice(0, player.bag.length);
    const expedition = account.weaponBank.expedition;
    let activeEntryId = account.weaponBank.lastCarry.activeEntryId;
    let firstStarterSlot = -1;
    let maxPackCell = -1;
    if (expedition) {
      for (const row of expedition.entries) {
        if (row.location === "pack") {
          maxPackCell = Math.max(maxPackCell, row.start + weaponEntryPhysicalSize(row.entry) - 1);
        }
      }
      for (let index = 0; index <= maxPackCell; index++) player.bag.push(new ArsenalSlot());
      for (const row of expedition.entries) {
        if (row.location === "field") continue;
        const target = row.location === "active" ? player.slots : player.bag;
        if (row.entry.kind === "single") {
          const slot = target[row.start];
          if (slot) this.installWeaponMember(slot, row.entry, row.entry.weapon);
        } else {
          const lead = target[row.start];
          const offhand = target[row.start + 1];
          if (lead) this.installWeaponMember(lead, row.entry, row.entry.lead, "lead");
          if (offhand) this.installWeaponMember(offhand, row.entry, row.entry.offhand, "offhand");
        }
      }
    }
    // The reusable floor is not an instance, never enters escrow, and consumes the first genuinely empty
    // Active cell. A fully selected three-entry Active manifest has deliberately replaced it for this run.
    for (let index = 0; index < ARSENAL_SLOTS; index++) {
      if (!player.slots[index]?.weapon) {
        this.installHomeIssue(player.slots[index]!);
        firstStarterSlot = index;
        break;
      }
    }
    let activeSlot = firstStarterSlot >= 0 ? firstStarterSlot : 0;
    if (activeEntryId) {
      const requested = player.slots.findIndex((slot) => slot.bankEntryId === activeEntryId && slot.bankPairRole !== "offhand");
      if (requested >= 0) activeSlot = requested;
      else activeEntryId = "";
    }
    if (!player.slots[activeSlot]?.weapon) {
      const first = player.slots.findIndex((slot) => !!slot.weapon);
      activeSlot = first >= 0 ? first : 0;
    }
    player.activeSlot = activeSlot;
    const active = player.slots[activeSlot];
    player.weapon = active?.weapon || FISTS_WEAPON;
    player.weaponRarity = active?.rarity ?? RARITY_COMMON;
    player.weaponAffix = active?.affix ?? "";
    player.maxCharges = 0;
    player.charges = 0;
    if (active) {
      active.resourceWeapon = active.weapon;
      active.resourceReady = true;
      active.resourceCharges = 0;
    }
  }

  private createWeaponRun(playerId: string, account: MetaAccountV4): RunWeaponLedger | undefined {
    const expedition = account.weaponBank.expedition;
    if (!expedition) return undefined;
    const entries = new Map<string, ExpeditionEntryV1>();
    const byInstanceId = new Map<string, string>();
    for (const row of expedition.entries) {
      entries.set(row.entry.entryId, row);
      for (const instance of weaponEntryInstances(row.entry)) {
        byInstanceId.set(instance.instanceId, row.entry.entryId);
      }
    }
    const curator: WeaponBankCuratorInputV1 = {
      accountId: playerId,
      worldTier: this.worldTier,
      copiesByWeaponId: countWeaponCopies(account.weaponBank, true),
      runIssuedByWeaponId: new Map<string, number>(),
    };
    const run = { runId: expedition.runId, entries, byInstanceId, curator };
    this.weaponRuns.set(playerId, run);
    if (!this.weaponCuratorOrder.includes(playerId)) this.weaponCuratorOrder.push(playerId);
    return run;
  }

  /** Slot/Pack topology is a view; this records it back onto the exact escrow entries after explicit moves. */
  private syncWeaponRunFromArsenal(player: PlayerState): void {
    const run = this.weaponRuns.get(player.id);
    if (!run) return;
    for (const row of run.entries.values()) {
      row.location = "field";
      row.start = 255;
    }
    for (let index = 0; index < player.slots.length; index++) {
      const slot = player.slots[index];
      if (!slot?.bankEntryId || slot.bankPairRole === "offhand") continue;
      const row = run.entries.get(slot.bankEntryId);
      if (row) {
        row.location = "active";
        row.start = index;
      }
    }
    for (let index = 0; index < player.bag.length; index++) {
      const slot = player.bag[index];
      if (!slot?.bankEntryId || slot.bankPairRole === "offhand") continue;
      const row = run.entries.get(slot.bankEntryId);
      if (row) {
        row.location = "pack";
        row.start = index;
      }
    }
  }

  private registerFoundWeaponEntry(player: PlayerState, entry: WeaponBankEntryV1): void {
    const run = this.weaponRuns.get(player.id);
    const account = this.metaAccounts.get(player.id);
    const expedition = account?.weaponBank.expedition;
    if (!run || !expedition || run.entries.has(entry.entryId)) return;
    const row: ExpeditionEntryV1 = {
      entry,
      stakeOrigin: "found",
      location: "field",
      start: 255,
    };
    expedition.entries.push(row);
    run.entries.set(entry.entryId, row);
    for (const instance of weaponEntryInstances(entry)) {
      run.byInstanceId.set(instance.instanceId, entry.entryId);
    }
    this.syncWeaponRunFromArsenal(player);
  }

  private consumeRunWeaponEntry(player: PlayerState, entryId: string): void {
    if (!entryId) return;
    const run = this.weaponRuns.get(player.id);
    const account = this.metaAccounts.get(player.id);
    const row = run?.entries.get(entryId);
    if (!run || !account?.weaponBank.expedition || !row) return;
    for (const instance of weaponEntryInstances(row.entry)) run.byInstanceId.delete(instance.instanceId);
    run.entries.delete(entryId);
    const index = account.weaponBank.expedition.entries.indexOf(row);
    if (index >= 0) account.weaponBank.expedition.entries.splice(index, 1);
    for (const slot of player.slots) if (slot.bankEntryId === entryId) this.copySlot(slot, null);
    for (let index = player.bag.length - 1; index >= 0; index--) {
      if (player.bag[index]?.bankEntryId === entryId) player.bag.splice(index, 1);
    }
    for (const [pickupId, meta] of this.pickupWeaponBankMeta) {
      if (meta.entry?.entryId === entryId) this.pickupWeaponBankMeta.delete(pickupId);
    }
  }

  private bindRunWeaponPair(
    player: PlayerState,
    leadSlot: ArsenalSlot,
    offSlot: ArsenalSlot,
  ): PairedWeaponEntryV1 | undefined {
    const run = this.weaponRuns.get(player.id);
    const account = this.metaAccounts.get(player.id);
    const expedition = account?.weaponBank.expedition;
    const leadRow = run?.entries.get(leadSlot.bankEntryId);
    const offRow = run?.entries.get(offSlot.bankEntryId);
    if (
      !run ||
      !expedition ||
      !leadRow ||
      !offRow ||
      leadRow === offRow ||
      leadRow.entry.kind !== "single" ||
      offRow.entry.kind !== "single"
    ) return undefined;
    const pair: PairedWeaponEntryV1 = {
      kind: "pair",
      entryId: this.mintWeaponOpaqueId("wp"),
      lead: leadRow.entry.weapon,
      offhand: offRow.entry.weapon,
    };
    const row: ExpeditionEntryV1 = {
      entry: pair,
      stakeOrigin: leadRow.stakeOrigin === "found" || offRow.stakeOrigin === "found" ? "found" : "committed",
      location: "active",
      start: player.activeSlot,
    };
    const leadIndex = expedition.entries.indexOf(leadRow);
    const offIndex = expedition.entries.indexOf(offRow);
    if (leadIndex >= 0) expedition.entries.splice(leadIndex, 1);
    const adjustedOffIndex = expedition.entries.indexOf(offRow);
    if (adjustedOffIndex >= 0) expedition.entries.splice(adjustedOffIndex, 1);
    expedition.entries.push(row);
    run.entries.delete(leadRow.entry.entryId);
    run.entries.delete(offRow.entry.entryId);
    run.entries.set(pair.entryId, row);
    run.byInstanceId.set(pair.lead.instanceId, pair.entryId);
    run.byInstanceId.set(pair.offhand.instanceId, pair.entryId);
    leadSlot.bankEntryId = pair.entryId;
    leadSlot.bankEntryKind = "pair";
    leadSlot.bankPairRole = "lead";
    offSlot.bankEntryId = pair.entryId;
    offSlot.bankEntryKind = "pair";
    offSlot.bankPairRole = "offhand";
    this.syncWeaponRunFromArsenal(player);
    return pair;
  }

  private unbindRunWeaponPair(player: PlayerState): boolean {
    const leadSlot = player.slots[player.activeSlot];
    const run = this.weaponRuns.get(player.id);
    const account = this.metaAccounts.get(player.id);
    const expedition = account?.weaponBank.expedition;
    const pairRow = leadSlot?.bankEntryId ? run?.entries.get(leadSlot.bankEntryId) : undefined;
    if (!leadSlot || !run || !expedition || pairRow?.entry.kind !== "pair") return false;
    const offIndex = player.offhandSlot;
    const offSlot = offIndex === 255 ? undefined : player.slots[offIndex];
    if (!offSlot || offSlot.bankEntryId !== pairRow.entry.entryId) return false;
    const lead: SingleWeaponEntryV1 = {
      kind: "single",
      entryId: pairRow.entry.lead.instanceId,
      weapon: pairRow.entry.lead,
    };
    const offhand: SingleWeaponEntryV1 = {
      kind: "single",
      entryId: pairRow.entry.offhand.instanceId,
      weapon: pairRow.entry.offhand,
    };
    const index = expedition.entries.indexOf(pairRow);
    if (index >= 0) expedition.entries.splice(index, 1);
    const leadRow: ExpeditionEntryV1 = {
      entry: lead,
      stakeOrigin: pairRow.stakeOrigin,
      location: "active",
      start: player.activeSlot,
    };
    const offRow: ExpeditionEntryV1 = {
      entry: offhand,
      stakeOrigin: pairRow.stakeOrigin,
      location: "active",
      start: offIndex,
    };
    expedition.entries.push(leadRow, offRow);
    run.entries.delete(pairRow.entry.entryId);
    run.entries.set(lead.entryId, leadRow);
    run.entries.set(offhand.entryId, offRow);
    run.byInstanceId.set(lead.weapon.instanceId, lead.entryId);
    run.byInstanceId.set(offhand.weapon.instanceId, offhand.entryId);
    leadSlot.bankEntryId = lead.entryId;
    leadSlot.bankEntryKind = "single";
    leadSlot.bankPairRole = "";
    offSlot.bankEntryId = offhand.entryId;
    offSlot.bankEntryKind = "single";
    offSlot.bankPairRole = "";
    return true;
  }

  private nextWeaponCurator(): WeaponBankCuratorInputV1 | undefined {
    if (this.weaponCuratorOrder.length === 0) return undefined;
    for (let tries = 0; tries < this.weaponCuratorOrder.length; tries++) {
      const index = this.weaponCuratorRecipient++ % this.weaponCuratorOrder.length;
      const input = this.weaponRuns.get(this.weaponCuratorOrder[index]!)?.curator;
      if (input) return input;
    }
    return undefined;
  }

  private activateMaterializedPair(player: PlayerState, c: CombatState): void {
    const leadSlot = player.slots[player.activeSlot];
    if (!leadSlot || leadSlot.bankEntryKind !== "pair" || leadSlot.bankPairRole !== "lead") return;
    let offIndex = -1;
    for (let index = 0; index < player.slots.length; index++) {
      const slot = player.slots[index];
      if (slot?.bankEntryId === leadSlot.bankEntryId && slot.bankPairRole === "offhand") {
        offIndex = index;
        break;
      }
    }
    if (offIndex < 0 || !pairEligible(WEAPONS[leadSlot.weapon], WEAPONS[player.slots[offIndex]!.weapon])) return;
    const off = player.slots[offIndex]!;
    this.initializeStoredWeaponResource(player, off);
    player.offhandSlot = offIndex;
    player.pairBaseSeq = player.attackSeq;
    player.offMaxCharges = 0;
    player.offCharges = 0;
    c.offLastWeapon = off.weapon;
    c.pairComboId = `${leadSlot.weapon}|${off.weapon}`;
    c.pairComboFamily = meleeComboSelectionFor(WEAPONS[leadSlot.weapon]!)?.family ?? "arc";
  }

  private sendWeaponManifest(player: PlayerState): void {
    const run = this.weaponRuns.get(player.id);
    if (!run) return;
    this.syncWeaponRunFromArsenal(player);
    const entries = [] as Array<{
      entryId: string;
      kind: "single" | "pair";
      origin: "committed" | "found";
      location: "active" | "pack" | "field";
      start: number;
      instanceIds: string[];
    }>;
    for (const row of run.entries.values()) {
      entries.push({
        entryId: row.entry.entryId,
        kind: row.entry.kind,
        origin: row.stakeOrigin,
        location: row.location,
        start: row.start,
        instanceIds: weaponEntryInstances(row.entry).map((instance) => instance.instanceId),
      });
    }
    this.sendOwnerMessage(player.id, "weaponManifest", { runId: run.runId, entries });
  }

  private bagCapacity(player: PlayerState): number {
    return BAG_CAP + (this.petRuns.get(player.id)?.mods.bagCapacityAdd ?? 0);
  }

  /** Base earned sale plus Gecko's fractional, per-run-capped mint. Unearned/zero sales never feed it. */
  private petSalePayout(player: PlayerState, rarity: number, earned: boolean): number {
    const base = scripValue(rarity, earned);
    if (base <= 0 || !player.alive) return base;
    const pet = this.petRuns.get(player.id);
    if (!pet || pet.mods.saleBonusRate <= 0 || pet.geckoMinted >= pet.mods.saleBonusCap) return base;
    pet.geckoFraction += base * pet.mods.saleBonusRate;
    const available = Math.max(0, Math.floor(pet.mods.saleBonusCap - pet.geckoMinted));
    const minted = Math.min(available, Math.floor(pet.geckoFraction));
    if (minted > 0) {
      pet.geckoFraction -= minted;
      pet.geckoMinted += minted;
    }
    return base + minted;
  }

  /** Persist only the active weapon instance's cadence debt before identity changes. */
  private saveWeaponResource(player: PlayerState, c: CombatState): void {
    if (!c.lastWeapon) return;
    if (this.belt) {
      const slot = player.slots[player.activeSlot];
      if (!slot || slot.weapon !== c.lastWeapon) return;
      slot.resourceWeapon = c.lastWeapon;
      slot.resourceReady = true;
      slot.cooldown = Math.max(0, c.cd);
      slot.reload = 0;
      slot.resourceCharges = 0;
      return;
    }
    let ledger = c.weaponLedger.get(c.lastWeapon);
    if (!ledger) {
      ledger = { cooldown: 0 };
      c.weaponLedger.set(c.lastWeapon, ledger);
    }
    ledger.cooldown = Math.max(0, c.cd);
  }

  /** Restore a weapon's own debt. Only a genuinely new pickup may initialize a fresh resource row. */
  private restoreWeaponResource(
    player: PlayerState,
    c: CombatState,
    genuinelyNewPickup = false,
    applyDrawLock = true,
  ): void {
    const weaponId = player.weapon;
    let cooldown = 0;
    if (this.belt) {
      const slot = player.slots[player.activeSlot];
      if (
        !genuinelyNewPickup &&
        slot?.resourceReady &&
        slot.resourceWeapon === weaponId
      ) {
        cooldown = slot.cooldown;
      } else if (slot) {
        slot.resourceWeapon = weaponId;
        slot.resourceReady = true;
        slot.cooldown = 0;
        slot.reload = 0;
        slot.resourceCharges = 0;
      }
    } else {
      let ledger = c.weaponLedger.get(weaponId);
      if (!ledger || genuinelyNewPickup) {
        ledger = { cooldown: 0 };
        c.weaponLedger.set(weaponId, ledger);
      }
      cooldown = ledger.cooldown;
    }
    c.lastWeapon = weaponId;
    c.cd = Math.max(0, cooldown);
    c.reloadCd = 0;
    c.attackBuffer = 0;
    if (applyDrawLock) {
      const quirkMult = c.mods.drawLockMult;
      c.drawLock = Math.max(c.drawLock, WEAPON_DRAW_LOCK_SECONDS * quirkMult);
    }
    player.maxCharges = 0;
    player.charges = 0;
  }

  private transitionWeapon(
    player: PlayerState,
    c: CombatState,
    genuinelyNewPickup = false,
    applyDrawLock = true,
  ): void {
    if (player.offhandSlot !== 255) this.dissolvePair(player, c);
    this.saveWeaponResource(player, c);
    if (c.beamPhase !== 0 || c.beamDescriptor) {
      this.cancelBeam(player, player.id, c, true, true);
    }
    if (this.belt) {
      const slot = player.slots[player.activeSlot];
      if (slot && slot.weapon !== player.weapon) {
        this.copySlot(slot, null);
        slot.weapon = player.weapon === FISTS_WEAPON ? "" : player.weapon;
        slot.rarity = player.weaponRarity;
        slot.affix = player.weaponAffix;
        slot.earned = c.heldEarned;
        slot.resourceReady = false;
      }
    }
    this.restoreWeaponResource(player, c, genuinelyNewPickup, applyDrawLock);
  }

  /** Stowed debts progress normally; swapping changes identity, never the passage of time. */
  private stepStowedWeaponResources(player: PlayerState, c: CombatState, dt: number): void {
    if (this.belt) {
      for (let i = 0; i < player.slots.length; i++) {
        // P0 dual-wield law: the paired-off row is stepped by the live hand path below, never here too.
        if (i === player.activeSlot || i === player.offhandSlot) continue;
        const slot = player.slots[i];
        if (slot?.resourceReady) this.stepStoredSlot(player, slot, dt);
      }
      for (const slot of player.bag) if (slot.resourceReady) this.stepStoredSlot(player, slot, dt);
      return;
    }
    for (const [weaponId, ledger] of c.weaponLedger) {
      if (weaponId === player.weapon) continue;
      ledger.cooldown = Math.max(0, ledger.cooldown - dt);
    }
  }

  private stepStoredSlot(player: PlayerState, slot: ArsenalSlot, dt: number): void {
    slot.cooldown = Math.max(0, slot.cooldown - dt);
    slot.reload = 0;
    slot.resourceCharges = 0;
  }

  /** Write the live held weapon (+ loot identity + earned provenance) INTO the active slot, so the slots
   *  array reflects reality before a swap/grab/stash reads it. FISTS → an empty slot. */
  private syncActiveSlot(player: PlayerState, c: CombatState | undefined): void {
    const s = player.slots[player.activeSlot];
    if (!s) return;
    if (c) this.saveWeaponResource(player, c);
    if (!player.weapon || player.weapon === FISTS_WEAPON) {
      this.copySlot(s, null);
    } else {
      if (s.weapon !== player.weapon) {
        s.instanceId = "";
        s.bankEntryId = "";
        s.bankEntryKind = "";
        s.bankPairRole = "";
        s.bankProvenance = "";
        s.sourceWorldTier = 0;
        s.homeIssue = false;
      }
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
      if (c) {
        c.heldEarned = false;
        this.restoreWeaponResource(player, c);
      }
      return;
    }
    player.weapon = s.weapon;
    player.weaponRarity = s.rarity;
    player.weaponAffix = s.affix;
    if (c) {
      c.heldEarned = s.earned;
      this.restoreWeaponResource(player, c);
    }
  }

  /** §29 BELT grab: ADD the grabbed weapon to the arsenal instead of the arena swap-drop. Fills the first
   *  empty slot (and equips it); if all 3 are full, the current active weapon overflows to the bag (or drops
   *  to the floor when the bag is full too — still never destroyed) and the grab takes the active slot. */
  private grabIntoArsenal(
    player: PlayerState,
    c: CombatState | undefined,
    grabbed: PickupState,
    bankEntry?: WeaponBankEntryV1,
  ): boolean {
    if (c) this.dissolvePair(player, c);
    this.syncActiveSlot(player, c);
    const earned = this.earnedPickups.has(grabbed.id);
    if (bankEntry?.kind === "pair") {
      let start = -1;
      for (let index = 0; index < ARSENAL_SLOTS - 1; index++) {
        if (!player.slots[index]?.weapon && !player.slots[index + 1]?.weapon) {
          start = index;
          break;
        }
      }
      if (start < 0) return false;
      this.installWeaponMember(player.slots[start]!, bankEntry, bankEntry.lead, "lead");
      this.installWeaponMember(player.slots[start + 1]!, bankEntry, bankEntry.offhand, "offhand");
      this.loadSlot(player, c, start);
      this.registerFoundWeaponEntry(player, bankEntry);
      this.syncWeaponRunFromArsenal(player);
      if (c) this.activateMaterializedPair(player, c);
      return true;
    }
    let target = -1;
    for (let i = 0; i < ARSENAL_SLOTS; i++) {
      if (!player.slots[i]?.weapon) {
        target = i;
        break;
      }
    }
    if (target === -1) {
      const old = player.slots[player.activeSlot]!;
      if (old.weapon && player.bag.length < this.bagCapacity(player)) {
        const b = new ArsenalSlot();
        this.copySlot(b, old);
        player.bag.push(b);
      } else if (old.weapon) {
        this.dropHeldWeapon(player, c); // no room anywhere → drop current (still grabbable, not destroyed)
      }
      target = player.activeSlot;
    }
    const s = player.slots[target]!;
    if (bankEntry?.kind === "single") this.installWeaponMember(s, bankEntry, bankEntry.weapon);
    else {
      this.copySlot(s, null);
      s.weapon = grabbed.weapon;
      s.rarity = grabbed.rarity;
      s.affix = grabbed.affix;
      s.earned = earned;
      s.resourceWeapon = grabbed.weapon;
      s.resourceReady = false;
    }
    this.loadSlot(player, c, target);
    if (bankEntry) this.registerFoundWeaponEntry(player, bankEntry);
    this.syncWeaponRunFromArsenal(player);
    return true;
  }

  /** §10 v0.104 per-source damage multiplier INCLUDING the held weapon's loot identity: attribute grades ×
   *  §11 requirement penalty × (rarity × affix). Every damage source of the held weapon flows through this
   *  so a Legendary Keen blade hits harder on its edge AND its chain AND its quake — WYSIWYG with the card. */
  private heldDamageMult(
    weapon: WeaponDef,
    grades: Parameters<typeof effectiveDamageMult>[1],
    player: PlayerState,
    hand: DualWieldHand = 0,
  ): number {
    const c = this.combat.get(player.id);
    const offSlot = c ? this.pairedOffSlot(player, c) : undefined;
    const rarity = hand === 1 && offSlot ? offSlot.rarity : player.weaponRarity;
    const affix = hand === 1 && offSlot ? offSlot.affix : player.weaponAffix;
    const baseRequirement = offSlot
      ? pairRequirementPenalty(WEAPONS[player.weapon]!, WEAPONS[offSlot.weapon]!, player)
      : requirementPenalty(weapon, player);
    const requirement = baseRequirement *
      (hand === 1 && offSlot ? this.pairOffhandDamageMultiplier(player, offSlot) : 1);
    return (
      sourceDamageMult(weapon, grades, player) *
      requirement *
      lootDamageMult(rarity, affix) *
      weaponSetBonus(this.loadoutIds(player), weapon.id) * // §30 class set-bonus (2/3-of-a-class)
      (c?.mods.outgoingWeaponDamageMult ?? 1)
    );
  }

  /** One audited recovery seam for held, paired, cast, gun, thrown, beam, and stored cooldown debt. */
  private weaponRecoveryMult(player: PlayerState, weapon: WeaponDef): number {
    const mods = this.combat.get(player.id)?.mods;
    if (!mods) return 1;
    let mult = mods.weaponCooldownMult;
    if (weapon.gun) mult *= mods.gunCooldownMult;
    else if (weapon.beam) mult *= mods.beamCooldownMult;
    else if (weapon.cast || weapon.tags.classPool === "caster") mult *= mods.casterCooldownMult;
    else mult *= mods.meleeCooldownMult;
    if (weapon.tags.grip === "2H") mult *= mods.heavyCooldownMult;
    return mult;
  }

  /** Cast-only grade floor lever. Flag-off is byte-identical to heldDamageMult. */
  /** Compute the off-hand trim from both live loot identities, then enforce the shared throughput cap. */
  private pairOffhandDamageMultiplier(player: PlayerState, offSlot: ArsenalSlot): number {
    const lead = WEAPONS[player.weapon];
    const off = WEAPONS[offSlot.weapon];
    if (!lead || !off) return 0;
    const leadGrades = lead.gun?.scalingGrades ?? lead.cast?.scalingGrades ?? lead.scalingGrades;
    const offGrades = off.gun?.scalingGrades ?? off.cast?.scalingGrades ?? off.scalingGrades;
    const leadDamage =
      pairDamagePerUse(lead) *
      sourceDamageMult(lead, leadGrades, player) *
      lootDamageMult(player.weaponRarity, player.weaponAffix);
    const offDamage =
      pairDamagePerUse(off) *
      sourceDamageMult(off, offGrades, player) *
      lootDamageMult(offSlot.rarity, offSlot.affix);
    return dualOffhandDamageMultiplier(lead, off, leadDamage, offDamage);
  }

  private heldCastDamageMult(
    weapon: WeaponDef,
    grades: Parameters<typeof effectiveDamageMult>[1],
    player: PlayerState,
    hand: DualWieldHand = 0,
  ): number {
    const gradeMult = applyCastGradeFloor(
      damageMultFromGrades(grades ?? weapon.scalingGrades, player),
    );
    const c = this.combat.get(player.id);
    const offSlot = c ? this.pairedOffSlot(player, c) : undefined;
    const rarity = hand === 1 && offSlot ? offSlot.rarity : player.weaponRarity;
    const affix = hand === 1 && offSlot ? offSlot.affix : player.weaponAffix;
    const requirement = (offSlot
      ? pairRequirementPenalty(WEAPONS[player.weapon]!, WEAPONS[offSlot.weapon]!, player)
      : requirementPenalty(weapon, player)) *
      (hand === 1 && offSlot ? this.pairOffhandDamageMultiplier(player, offSlot) : 1);
    return (
      gradeMult *
      requirement *
      lootDamageMult(rarity, affix) *
      weaponSetBonus(this.loadoutIds(player), weapon.id) *
      (c?.mods.outgoingWeaponDamageMult ?? 1)
    );
  }

  /**
   * Capture the cosmetic character as the run identity. Fresh edges seed the sum-10 spread; re-snapshot
   * edges apply only the old→new spread delta so earned allocations and permanent upgrades survive.
   */
  private snapshotRunCharacter(
    player: PlayerState,
    combat: CombatState | undefined,
    rebase: boolean,
    topUpMaxHp = true,
  ): void {
    const identity = isPlayableCharacter(player.character) ? player.character : "drifter";
    const nextSpread = spreadForCharacter(identity);
    if (rebase) {
      const previousSpread = spreadForCharacter(player.runCharacter);
      for (const attr of ATTRS) player[attr] += nextSpread[attr] - previousSpread[attr];
    } else {
      for (const attr of ATTRS) player[attr] = nextSpread[attr];
      if (player.upPower > 0) player.str = 1 + META_POWER_STR * player.upPower;
      if (player.upFortune > 0) player.luk = 1 + META_FORTUNE_LUK * player.upFortune;
    }
    player.runCharacter = identity;
    player.spreadSeeded = true;
    player.gearSeeded = false;
    player.gearMaxHpAdd = 0;
    player.gearUpper = "";
    player.gearLower = "";
    const quirk = quirkForCharacter(identity);
    player.identityBallastFollowsChoice = quirk.mods?.ballastFollowsChoice === true;
    if (combat) {
      combat.identityCharacter = identity;
      combat.quirk = quirk;
      combat.mods = runtimeModsForQuirk(quirk);
    }
    const previousMax = player.maxHp;
    const derivedCon = spreadAdjustedCon(player.con);
    player.maxHp = deriveStats({ con: derivedCon }).maxHp + META_VITALITY_HP * player.upVitality;
    if (topUpMaxHp && player.maxHp > previousMax) player.hp += player.maxHp - previousMax;
    player.hp = Math.min(player.hp, player.maxHp);
  }

  /** Install one validated, catalog-derived wardrobe snapshot. No allocation counter is touched here. */
  private snapshotGearRun(
    player: PlayerState,
    combat: CombatState | undefined,
    runtime: GearRunRuntime,
    topUpMaxHp = true,
  ): void {
    for (const attr of ATTRS) player[attr] = runtime.baseStats[attr];
    player.character = "drifter";
    player.runCharacter = "drifter";
    player.spreadSeeded = true;
    player.gearSeeded = true;
    player.gearMaxHpAdd = runtime.mods.maxHpAdd;
    player.identityBallastFollowsChoice = runtime.mods.ballastFollowsChoice;
    player.upVitality = 0;
    player.upFortune = 0;
    player.upPower = 0;
    const cosmetics = encodeGearCosmetics(runtime.idsBySlot);
    player.gearUpper = cosmetics.gearUpper;
    player.gearLower = cosmetics.gearLower;
    if (combat) {
      combat.identityCharacter = "drifter";
      combat.quirk = runtime.quirk;
      combat.mods = runtime.mods;
    }
    const previousMax = player.maxHp;
    player.maxHp =
      deriveStats({ con: spreadAdjustedCon(player.con) }).maxHp + runtime.mods.maxHpAdd;
    if (topUpMaxHp && player.maxHp > previousMax) player.hp += player.maxHp - previousMax;
    player.hp = Math.min(player.hp, player.maxHp);
  }

  /** Gear owns identity when present; character kits remain the compatibility fallback until the art wave. */
  private snapshotRunIdentity(
    player: PlayerState,
    combat: CombatState | undefined,
    rebase: boolean,
    topUpMaxHp = true,
  ): void {
    const gear = this.gearRuns.get(player.id);
    if (gear) {
      // Rift/cosmetic rebase edges may not mutate an active gear snapshot.
      if (!rebase) this.snapshotGearRun(player, combat, gear, topUpMaxHp);
      return;
    }
    this.snapshotRunCharacter(player, combat, rebase, topUpMaxHp);
  }

  /** Interpret pure quirk descriptors at event seams through existing authoritative state machinery. */
  private applyQuirkEffects(player: PlayerState, combat: CombatState, effects: readonly QuirkEffect[]): void {
    for (const effect of effects) {
      if (effect.kind === "heal-nearest-ally") {
        if (effect.amount <= 0) continue;
        const radiusSq = effect.radius * effect.radius;
        let nearest: PlayerState | undefined;
        let nearestSq = Number.POSITIVE_INFINITY;
        this.state.players.forEach((ally) => {
          if (!ally.alive || ally.id === player.id) return;
          const dx = ally.x - player.x;
          const dy = ally.y - player.y;
          const distanceSq = dx * dx + dy * dy;
          if (
            distanceSq <= radiusSq &&
            (distanceSq < nearestSq ||
              (distanceSq === nearestSq && ally.id.localeCompare(nearest?.id ?? "") < 0))
          ) {
            nearest = ally;
            nearestSq = distanceSq;
          }
        });
        if (nearest) this.applyHeal(nearest, effect.amount);
      } else if (effect.kind === "heal-self") {
        const window = Math.floor(this.state.elapsed);
        if (combat.killHealWindowStart !== window) {
          combat.killHealWindowStart = window;
          combat.killHealWindowAmount = 0;
        }
        const amount = Math.min(effect.amount, effect.capPerSecond - combat.killHealWindowAmount);
        if (amount > 0) {
          this.applyHeal(player, amount);
          combat.killHealWindowAmount += amount;
        }
      }
      // `reload-held-gun` is declared for Coldsnap but cannot arrive until wave 21b calls onRollEnd.
    }
  }

  private applyParryQuirk(player: PlayerState, combat: CombatState, parryHeal: number): void {
    const effects = combat.quirk.hooks?.onParrySuccess?.({ parryHeal });
    if (effects) this.applyQuirkEffects(player, combat, effects);
  }

  private applyKillQuirk(player: PlayerState, combat: CombatState, enemy: EnemyState): void {
    const effects = combat.quirk.hooks?.onKill?.({
      killedEnemyId: enemy.id,
      killDistance: Math.hypot(enemy.x - player.x, enemy.y - player.y),
    });
    if (effects) this.applyQuirkEffects(player, combat, effects);
  }

  /** §30 the player's equipped loadout as weapon ids — the active slot reads the LIVE held weapon (slots are
   *  only re-synced on swap), the others their stored weapon. Drives the class set-bonus count. */
  private loadoutIds(player: PlayerState): string[] {
    const out: string[] = [];
    for (let i = 0; i < player.slots.length; i++) {
      // Pair is one build choice toward set thresholds even though its identities keep two slot ledgers.
      if (player.offhandSlot !== 255 && i === player.offhandSlot) continue;
      out.push(i === player.activeSlot ? player.weapon : (player.slots[i]?.weapon ?? ""));
    }
    return out;
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

  private ownerClient(playerId: string): Client | undefined {
    for (const client of this.clients) if (client.sessionId === playerId) return client;
    return undefined;
  }

  private sendOwnerMessage(playerId: string, type: string, payload: unknown): void {
    const client = this.ownerClient(playerId);
    if (client && typeof client.send === "function") client.send(type, payload);
  }

  /** Copper Gecko's wider reach is intentionally private: only its owner receives the earned-id rail that
   *  lets P2 render an honest local prompt. This runs only when that rare set changes, never per tick. */
  private publishPetPickupEligibility(): void {
    let ids: string[] | undefined;
    this.state.players.forEach((player) => {
      if ((this.petRuns.get(player.id)?.mods.earnedPickupRadius ?? 0) <= 0) return;
      ids ??= Array.from(this.earnedPickups);
      this.sendOwnerMessage(player.id, "petPickupEligibility", { ids });
    });
  }

  private bumpAccountRevision(account: MetaAccountV4): void {
    account.revision = Math.min(META_ACCOUNT_REVISION_MAX, account.revision + 1);
  }

  private syncAccountFromPlayer(player: PlayerState, account: MetaAccountV4): void {
    account.scrip = Math.max(0, Math.min(65535, Math.floor(player.scrip)));
  }

  private publishAccountMutation(player: PlayerState): void {
    const account = this.metaAccounts.get(player.id);
    if (!account) return;
    this.syncAccountFromPlayer(player, account);
    this.bumpAccountRevision(account);
    this.sendOwnerMessage(player.id, "metaAccount", account);
  }

  /** New run/ready boundary: exact XP becomes a private immutable level/mod snapshot; only id/band sync. */
  private snapshotPetRun(player: PlayerState, selectedPetId: PetId | ""): void {
    const account = this.metaAccounts.get(player.id);
    const persisted = selectedPetId ? account?.pets[selectedPetId] : undefined;
    this.petSettledAccounts.delete(player.id);
    if (!selectedPetId || !persisted) {
      this.petRuns.delete(player.id);
      player.petId = "";
      player.petLevelBand = 0;
      return;
    }
    const level = petLevelForXp(persisted.bondXp);
    const stageBand = petStageBandForLevel(level);
    this.petRuns.set(player.id, {
      petId: selectedPetId,
      level,
      stageBand,
      catalogVersion: PET_CATALOG_VERSION,
      mods: petModsForLevel(selectedPetId, level),
      pendingBondXp: 0,
      clearReceipts: 0,
      lastEvaluatedDimensionEpoch: -1,
      dimensionPresenceSeconds: 0,
      acceptedActionsThisDimension: 0,
      geckoFraction: 0,
      geckoMinted: 0,
      tortoisePitRegenSeconds: 0,
      settled: false,
    });
    player.petId = selectedPetId;
    player.petLevelBand = stageBand;
  }

  private resetPetAccrual(playerId: string): void {
    const pet = this.petRuns.get(playerId);
    if (!pet) return;
    pet.pendingBondXp = 0;
    pet.clearReceipts = 0;
    pet.lastEvaluatedDimensionEpoch = -1;
    pet.dimensionPresenceSeconds = 0;
    pet.acceptedActionsThisDimension = 0;
    pet.geckoFraction = 0;
    pet.geckoMinted = 0;
    pet.tortoisePitRegenSeconds = 0;
    pet.settled = false;
    this.petSettledAccounts.delete(playerId);
  }

  /** Allocation-free 20 Hz qualification clock; training/debug rooms never build Bond eligibility. */
  private advancePetPresence(dt: number): void {
    if (
      this.state.outcome !== "active" ||
      (this.state.mode !== "arena" && this.state.mode !== "bossrush")
    ) return;
    this.petRuns.forEach((pet, playerId) => {
      if (!this.state.players.has(playerId) || pet.settled) return;
      pet.dimensionPresenceSeconds += dt;
    });
  }

  /** Count only a server-accepted combat/support result, never a message, movement tick, dummy, or training. */
  private recordPetAcceptedAction(playerId: string): void {
    if (
      this.state.outcome !== "active" ||
      (this.state.mode !== "arena" && this.state.mode !== "bossrush")
    ) return;
    const player = this.state.players.get(playerId);
    const pet = this.petRuns.get(playerId);
    if (!player?.alive || !pet || pet.settled) return;
    pet.acceptedActionsThisDimension++;
  }

  /** Evaluate each authored dimension/boss epoch once. Failed presence/action qualification cannot pay later. */
  private awardPetDimensionClear(): void {
    if (this.state.mode !== "arena" && this.state.mode !== "bossrush") return;
    const awards = [100, 140, 180] as const;
    this.petRuns.forEach((pet, playerId) => {
      if (pet.lastEvaluatedDimensionEpoch === this.petDimensionEpoch) return;
      pet.lastEvaluatedDimensionEpoch = this.petDimensionEpoch;
      if (
        !this.state.players.has(playerId) ||
        pet.settled ||
        pet.clearReceipts >= awards.length ||
        pet.dimensionPresenceSeconds + 1e-9 < 60 ||
        pet.acceptedActionsThisDimension < 3
      ) return;
      pet.pendingBondXp = Math.min(500, pet.pendingBondXp + awards[pet.clearReceipts]!);
      pet.clearReceipts++;
    });
  }

  private beginNextPetDimension(): void {
    this.petDimensionEpoch++;
    this.petRuns.forEach((pet) => {
      pet.dimensionPresenceSeconds = 0;
      pet.acceptedActionsThisDimension = 0;
    });
  }

  private rollSlateTortoise(account: MetaAccountV4, outcome: "defeat" | "victory"): boolean {
    if (outcome !== "victory" || account.pets["slate-tortoise"]) return false;
    const misses = Math.max(0, Math.min(7, Math.floor(account.slateTortoisePityMisses)));
    const success = misses >= 7 || Math.random() < 0.08 * (misses + 1);
    if (success) {
      account.pets["slate-tortoise"] = { bondXp: 0 };
      account.slateTortoisePityMisses = 0;
      return true;
    }
    account.slateTortoisePityMisses = Math.min(7, misses + 1);
    return false;
  }

  /** One idempotent account commit for pets, Scrip, and exact weapon escrow on every terminal route. */
  private settleMetaAccounts(outcome: "defeat" | "victory"): void {
    this.metaAccounts.forEach((account, playerId) => {
      if (this.petSettledAccounts.has(playerId)) return;
      this.petSettledAccounts.add(playerId);
      if (outcome === "victory") this.prestigeGameClearReceipts.add(playerId);
      else this.prestigeGameClearReceipts.delete(playerId);
      const player = this.state.players.get(playerId) ?? this.disconnectedPlayers.get(playerId)?.player;
      if (player) {
        this.syncWeaponRunFromArsenal(player);
        this.syncAccountFromPlayer(player, account);
      }
      const pet = this.petRuns.get(playerId);
      let receipt: PetProgressReceipt | undefined;
      if (pet) {
        pet.settled = true;
        const earnedBondXp = Math.min(
          500,
          pet.pendingBondXp + (outcome === "victory" && pet.clearReceipts > 0 ? 80 : 0),
        );
        const banked = bankPetBondXp(account, pet.petId, earnedBondXp);
        receipt = {
          petId: pet.petId,
          outcome,
          ...banked,
          slateTortoiseAwarded: false,
        };
      }
      const slateTortoiseAwarded = this.rollSlateTortoise(account, outcome);
      if (receipt) receipt.slateTortoiseAwarded = slateTortoiseAwarded;
      const runId = account.weaponBank.expedition?.runId;
      if (runId) {
        const settlementKey = `${playerId}:${runId}:${outcome}:1`;
        let weaponReceipt = this.weaponSettlementReceipts.get(settlementKey);
        if (!weaponReceipt) {
          weaponReceipt = settleWeaponExpedition(account, outcome, false);
          this.weaponSettlementReceipts.set(settlementKey, weaponReceipt);
        }
        this.sendOwnerMessage(playerId, "weaponSettlementReceipt", weaponReceipt);
      }
      this.bumpAccountRevision(account);
      if (receipt) this.sendOwnerMessage(playerId, "petProgressReceipt", receipt);
      this.sendOwnerMessage(playerId, "metaAccount", account);
      this.weaponRuns.delete(playerId);
      this.disconnectedPlayers.delete(playerId);
    });
  }

  /** Explicit event/intermission heal; passive regen, revive HP, meta headroom and Hearth's own 15% use
   * their dedicated paths. The receiver's selected pet owns the multiplier. */
  private applyHeal(target: PlayerState, rawAmount: number, applyReceivedMultiplier = true): number {
    if (!target.alive || rawAmount <= 0) return 0;
    const multiplier = applyReceivedMultiplier
      ? (this.petRuns.get(target.id)?.mods.healingReceivedMultiplier ?? 1) *
        (this.combat.get(target.id)?.mods.healingReceivedMult ?? 1)
      : 1;
    const before = target.hp;
    target.hp = Math.min(target.maxHp, target.hp + rawAmount * multiplier);
    return target.hp - before;
  }

  /** Switch between survival ("arena") and Testing Grounds ("training", §21). */
  private toggleTraining(abandoningPlayerId = this.hostId ?? ""): void {
    if (this.state.mode === "arena") this.forfeitWeaponRunForWorkshop(abandoningPlayerId);
    // Entering/leaving the workshop aborts the expedition; unclaimed run XP is explicitly forfeited.
    this.state.players.forEach((player, id) => {
      const c = this.combat.get(id);
      if (!c) return;
      this.dissolvePair(player, c, false);
      player.pairBaseSeq = 0;
      c.handGate = 0;
    });
    this.clearXpEchoes();
    this.state.enemies.clear();
    this.state.pickups.clear();
    this.state.projectiles.clear();
    this.state.zones.clear();
    this.clearTransients();
    this.state.outcome = "active";
    this.state.portalOpen = false;
    this.resetExtractionIntent();
    this.state.riftOpen = false; // §6 chain — the Testing Grounds sits outside the run structure
    this.state.depth = 1;
    this.petDimensionEpoch = 0;
    this.visitedDims.clear();
    // §6 bank-or-lose (v0.103): stepping OUT of a live run into the workshop ABORTS the expedition —
    // everything carried is lost (only extraction banks). Without this, T is a wipe-panic button that
    // launders deep-run salvage through a depth reset (adversarial-verify finding F2). Also clear the
    // elapsed-clock parry timestamps (elapsed resets below) + weapon provenance (the gallery is free).
    this.state.players.forEach((p) => {
      this.resetPetAccrual(p.id);
      p.salvaged = 0;
      p.ultCharge = 0;
      // …and the held weapon sheds its rolled loot identity too — without this, the workshop is a
      // risk-free reroll booth whose Legendary rides back into the real run (adversarial-verify).
      p.weaponRarity = RARITY_COMMON;
      p.weaponAffix = "";
    });
    this.combat.forEach((c) => {
      c.lastParryAt = -999;
      c.hairStreak = 0;
      c.heldEarned = false;
      c.ultChargeF = 0;
      c.ultAccrualThisTick = 0;
    });
    this.bossSpawned = false;
    this.clearBoss();
    this.resetShifters();
    const cx = ARENA_WIDTH / 2;
    const cy = ARENA_HEIGHT / 2;

    if (this.state.mode === "arena") {
      this.state.mode = "training";
      this.resetElapsed();
      this.spawnAccum = 0;
      // §31 SHOWROOM: browse EVERY arted weapon (active roster + the whole +300 expansion arsenal), one
      // PAGE at a time (Q/E cycles pages). A full 314-pickup dump tanked the client to ~2fps (314 rigs +
      // 297 lazy art loads at once), so it's paged — GALLERY_PAGE weapons per page, laid out in a grid.
      this.galleryPage = 0;
      this.spawnGalleryPage();
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
        this.insertEnemyGrid(dummy.id, dummy);
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
      this.resetElapsed();
      this.spawnAccum = 0;
    }
    console.log(`[room ${this.roomId}] mode → ${this.state.mode}`);
  }

  /** The dev workshop is an explicit abandon, followed by an empty non-bank training reservation. */
  private forfeitWeaponRunForWorkshop(playerId: string): void {
    const account = this.metaAccounts.get(playerId);
    const expedition = account?.weaponBank.expedition;
    const player = this.state.players.get(playerId);
    if (!account || !expedition || !player) return;
    this.syncWeaponRunFromArsenal(player);
    const settlementKey = `${playerId}:${expedition.runId}:defeat:1`;
    const receipt = settleWeaponExpedition(account, "defeat");
    this.weaponSettlementReceipts.set(settlementKey, receipt);
    this.weaponRuns.delete(playerId);
    const committed = commitWeaponCarry(
      account,
      {
        requestId: `workshop_${randomBytes(10).toString("base64url")}`,
        expectedRevision: account.revision,
        placements: [],
        activeEntryId: "",
        requestedWorldTier: Math.max(account.prestige, this.worldTier),
      },
      `run_${randomBytes(12).toString("base64url")}`,
      this.bagCapacity(player),
      this.worldTier,
    );
    if (!committed.ok) throw new Error(`workshop weapon reset rejected: ${committed.error}`);
    this.materializeWeaponRun(player, account);
    this.createWeaponRun(playerId, account);
    this.sendOwnerMessage(playerId, "weaponSettlementReceipt", receipt);
    this.sendOwnerMessage(playerId, "metaAccount", account);
    this.sendWeaponManifest(player);
  }

  /** §31 the full browsable weapon roster for the Testing-Grounds SHOWROOM: the active arsenal + every
   *  arted expansion weapon. Shown one page at a time (perf: a full dump is ~2fps). */
  /** §41 the showroom roster, ORGANIZED: class → family → name, so every page reads as a coherent shelf
   *  ("all the melee axes together") instead of concept-file order. Stable + deterministic. */
  private static readonly GALLERY_ROSTER: readonly string[] = [
    ...WEAPON_IDS,
    ...EXPANSION_WEAPON_IDS,
  ].sort((a, b) => {
    const wa = WEAPONS[a];
    const wb = WEAPONS[b];
    const c = (wa?.tags?.classPool ?? "").localeCompare(wb?.tags?.classPool ?? "");
    if (c !== 0) return c;
    const f = (wa?.tags?.family ?? "").localeCompare(wb?.tags?.family ?? "");
    if (f !== 0) return f;
    return (wa?.name ?? a).localeCompare(wb?.name ?? b);
  });
  private static readonly GALLERY_PAGE = 42; // weapons per page (14×3 grid) — comfortably performant
  private galleryPage = 0;

  /** §31 (re)spawn the current showroom PAGE: clear the gallery pickups (`pk*`) and lay out this page's
   *  slice of GALLERY_ROSTER in a grid above the player. Wraps the page index. Training mode only.
   *  §41 cells keep their EXACT grid position — a cell over a pit/POI is SKIPPED (the shelf shows a gap)
   *  instead of safeSpawnPos NUDGING it: the old nudge scattered the neat grid and piled pickups onto their
   *  neighbours, so R grabbed "the wrong thing" and pages read as disorganized. */
  private spawnGalleryPage(): void {
    for (const id of [...this.state.pickups.keys()]) {
      if (id.startsWith("pk")) this.state.pickups.delete(id);
    }
    const roster = GameRoom.GALLERY_ROSTER;
    const pages = Math.max(1, Math.ceil(roster.length / GameRoom.GALLERY_PAGE));
    this.galleryPage = ((this.galleryPage % pages) + pages) % pages;
    const start = this.galleryPage * GameRoom.GALLERY_PAGE;
    const slice = roster.slice(start, start + GameRoom.GALLERY_PAGE);
    const cx = ARENA_WIDTH / 2;
    const cy = ARENA_HEIGHT / 2;
    const COLS = 14;
    const GAP = 150;
    // Safe EXACT grid cells — row 0 sits just above the player, rows grow upward; unsafe cells are gaps.
    const cells: { x: number; y: number }[] = [];
    for (let row = 0; cells.length < slice.length && row < 14; row++) {
      for (let col = 0; col < COLS && cells.length < slice.length; col++) {
        const gx = cx + (col - (COLS - 1) / 2) * GAP;
        const gy = cy - 200 - row * GAP;
        if (gx < PICKUP_RADIUS || gx > ARENA_WIDTH - PICKUP_RADIUS || gy < PICKUP_RADIUS) continue;
        if (isPitAtPx(this.map, gx, gy) || isInsidePoi(this.map, gx, gy)) continue;
        cells.push({ x: gx, y: gy });
      }
    }
    slice.forEach((weaponId, i) => {
      const cell = cells[i];
      if (!cell) return;
      const pk = new PickupState();
      pk.id = `pk${i}`;
      pk.weapon = weaponId;
      pk.weaponPublic = weaponId;
      pk.x = cell.x;
      pk.y = cell.y;
      this.state.pickups.set(pk.id, pk);
    });
  }

  private restartRun(): void {
    if (this.state.outcome === "active") this.settleMetaAccounts("defeat");
    // A restart is a fresh expedition (progression resets below), so no old field packet crosses it.
    this.clearXpEchoes();
    this.state.enemies.clear();
    this.state.projectiles.clear();
    this.state.zones.clear();
    // A fresh map means old drops would float over unrelated terrain — clear them with the field.
    this.state.pickups.clear();
    this.clearTransients();
    this.resetElapsed();
    this.state.outcome = "active";
    this.state.portalOpen = false;
    this.resetExtractionIntent();
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
    this.petDimensionEpoch = 0;
    this.state.players.forEach((player, id) => {
      const c = this.combat.get(id);
      if (c) this.dissolvePair(player, c, false);
      player.pairBaseSeq = 0;
      this.snapshotPetRun(player, this.metaAccounts.get(id)?.selectedPetId ?? "");
      const account = this.metaAccounts.get(id);
      if (account && !account.weaponBank.expedition) {
        const committed = commitWeaponCarry(
          account,
          {
            requestId: `restart_${randomBytes(10).toString("base64url")}`,
            expectedRevision: account.revision,
            placements: [],
            activeEntryId: "",
            requestedWorldTier: Math.max(account.prestige, this.worldTier),
          },
          `run_${randomBytes(12).toString("base64url")}`,
          this.bagCapacity(player),
          this.worldTier,
        );
        if (committed.ok) {
          this.materializeWeaponRun(player, account);
          this.createWeaponRun(id, account);
        }
      }
      // Fresh run → reset progression and snapshot the worn character's sum-10 spread; carried salvage
      // starts empty too (§6 bank-or-lose — a restart is a NEW expedition, not a continue), and the
      // held weapon sheds its rolled loot identity (drops are per-run).
      player.salvaged = 0;
      player.weaponRarity = RARITY_COMMON;
      player.weaponAffix = "";
      player.level = 1;
      player.xp = 0;
      player.xpToNext = xpToNextLevel(1);
      this.snapshotRunIdentity(player, c, false);
      player.flexPending = 0;
      player.flexTimer = 0;
      player.flexTimerDs = 0;
      // §8 augments are PER-RUN — clear the parry build on a fresh run.
      player.augments = "";
      player.sigPending = 0;
      player.sigOffer = "";
      player.sigGateQueue = "";
      for (const attr of ATTRS) player.allocRun[attr] = 0;
      player.ultFamily = UltimateFamily.Locked;
      player.ultVariant = "";
      player.ultTempered = false;
      player.ultArchetype = 0;
      player.ultCharge = 0;
      player.ultPhase = UltimatePhase.Idle;
      player.ultStartTick = 0;
      player.ultResolveTick = 0;
      player.ultEndTick = 0;
      player.ultTargetX = 0;
      player.ultTargetY = 0;
      player.vx = 0; // §20 clear any residual momentum
      player.vy = 0;
      player.height = 0; // §5/§20 back to the ground
      player.alive = true;
      player.hp = player.maxHp;
      player.x = this.map.spawnX + (Math.random() * 200 - 100);
      player.y = this.map.spawnY + (Math.random() * 200 - 100);
      for (const slot of player.slots) slot.resourceReady = false;
      for (const slot of player.bag) slot.resourceReady = false;
      if (c) {
        c.respawn = 0;
        c.cd = 0;
        c.attackBuffer = 0;
        c.parryBuffer = 0;
        c.jumpBuffer = 0;
        c.ultChargeF = 0;
        c.ultBuffer = 0;
        c.ultAccrualThisTick = 0;
        c.ult = undefined;
        c.ultAlphaBonusTargets = 0;
        c.ultCritCharges = 0;
        c.ultCritEndTick = 0;
        c.reloadCd = 0;
        c.lastWeapon = player.weapon;
        c.drawLock = 0;
        c.handGate = 0;
        c.offLastWeapon = "";
        c.weaponLedger.clear();
        player.maxCharges = 0;
        player.charges = 0;
        const active = player.slots[player.activeSlot];
        if (active) {
          active.resourceWeapon = player.weapon;
          active.resourceReady = true;
          active.cooldown = 0;
          active.reload = 0;
          active.resourceCharges = 0;
        }
        c.drive.valueF = DRIVE_CAPACITY;
        c.drive.recoveryDebtF = 0;
        c.drive.pressureUntilTick = 0;
        c.drive.regenMode = DriveRegenMode.Floor;
        c.drive.beamLockEndTick = 0;
        c.drive.beamRecoveryEndTick = 0;
        c.drive.beamRequireRelease = false;
        c.drive.tickCreditF = 0;
        c.drive.tickDebitF = 0;
        c.drive.tickOpen = false;
        player.weaponResource.valueQ = DRIVE_CAPACITY * 100;
        player.weaponResource.regenMode = DriveRegenMode.Floor;
        player.weaponResource.beamLockEndTick = 0;
        c.bulwarkShield = 0;
        c.hairStreak = 0;
        c.lastParryAt = -999;
        c.killHealWindowStart = -999;
        c.killHealWindowAmount = 0;
        c.vh = 0;
        c.jumpCd = 0;
        c.distJumpCd = 0;
        c.poundUsed = false;
        c.recoveryT = 0;
        c.momentumX = 0;
        c.momentumY = 0;
        c.slidePhase = SLIDE_PHASE_OFF;
        c.slidePhaseTick = 0;
        c.slideColdArmed = true;
        c.slideColdRearmTicks = 0;
        c.slideParryLockT = 0;
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

  /** §45 rebuild the ONE enemy broad phase for this fixed tick. Later movement uses `update`, not a rebuild. */
  private rebuildEnemyGrid(): void {
    this.enemyGrid.clear();
    this.oversizedEnemyIds.length = 0;
    this.state.enemies.forEach((enemy, id) => {
      this.insertEnemyGrid(id, enemy);
    });
    this.rebuildWormSegmentGrid();
  }

  private insertEnemyGrid(id: string, enemy: EnemyState): void {
    if (id === this.bossId && this.bossController?.wormRuntime) return;
    this.enemyGrid.insert(id, enemy.x, enemy.y);
    const radius = ENEMY_KINDS[enemy.kind]?.radius ?? ENEMY_RADIUS;
    if (radius > ENEMY_GRID_CELL_SIZE / 2 && !this.oversizedEnemyIds.includes(id)) {
      this.oversizedEnemyIds.push(id);
    }
  }

  private updateEnemyGrid(id: string, enemy: EnemyState): void {
    if (id === this.bossId && this.bossController?.wormRuntime) {
      this.enemyGrid.remove(id);
      return;
    }
    this.enemyGrid.update(id, enemy.x, enemy.y);
  }

  private rebuildWormSegmentGrid(): void {
    this.wormSegmentGrid.clear();
    const runtime = this.bossController?.wormRuntime;
    if (!runtime || !this.state.wormBoss.active) return;
    for (let slot = 0; slot < WORM_MAX_SEGMENTS; slot++) {
      if (!runtime.isTargetable(slot)) continue;
      this.wormSegmentGrid.insert(slot, runtime.x[slot]!, runtime.y[slot]!);
    }
  }

  private effectiveEnemyBodies(): number {
    const runtime = this.bossController?.wormRuntime;
    if (!runtime || !this.state.wormBoss.active) return this.state.enemies.size;
    return this.state.enemies.size + runtime.effectiveBodyCount - 1;
  }

  /** §5/§45 horde body collision. Each unordered grid pair contributes a radius-overlap correction into
   * fixed tick-local buffers; one capped integration prevents pair-order shoves and enemy stacks without
   * an O(n²) scan. Boss/dummy bodies are anchors (ordinary enemies move one-way around them); the worm's
   * compatibility root/segments never enter this grid. Player push-out remains the existing one-way law. */
  private resolveEnemyCollisions(): void {
    this.enemySeparationX.fill(0);
    this.enemySeparationY.fill(0);
    this.state.enemies.forEach((a, aid) => {
      if (a.hp <= 0) return;
      const aOrder = this.enemyGrid.orderOf(aid);
      if (aOrder === undefined || aOrder >= MAX_ENEMIES) return;
      const aKind = ENEMY_KINDS[a.kind];
      const ra = aKind?.radius ?? ENEMY_RADIUS;
      const aMovable = aKind?.archetype !== "boss" && aKind?.archetype !== "dummy";
      if (ra > ENEMY_GRID_CELL_SIZE / 2) {
        this.enemyGrid.queryRadius(a.x, a.y, ra + MAX_ENEMY_RADIUS, this.enemyCandidates);
      } else {
        // Ordinary bodies inspect only the current 128px cell and its eight neighbors; oversized anchors
        // are appended because their edges can reach into this neighborhood from farther-away centres.
        this.enemyGrid.queryRadius(a.x, a.y, ENEMY_GRID_CELL_SIZE, this.enemyCandidates);
        for (const id of this.oversizedEnemyIds) {
          if (this.state.enemies.has(id) && !this.enemyCandidates.includes(id)) {
            this.enemyCandidates.push(id);
          }
        }
        this.enemyCandidates.sort(
          (left, right) =>
            (this.enemyGrid.orderOf(left) ?? 0) - (this.enemyGrid.orderOf(right) ?? 0),
        );
      }
      for (const bid of this.enemyCandidates) {
        const bOrder = this.enemyGrid.orderOf(bid);
        if (bOrder === undefined || bOrder <= aOrder || bOrder >= MAX_ENEMIES) continue;
        const b = this.state.enemies.get(bid);
        if (!b || b.hp <= 0) continue;
        const bKind = ENEMY_KINDS[b.kind];
        const bMovable = bKind?.archetype !== "boss" && bKind?.archetype !== "dummy";
        if (!aMovable && !bMovable) continue;
        const minDistance = ra + (bKind?.radius ?? ENEMY_RADIUS);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distanceSq = dx * dx + dy * dy;
        let distance = 0;
        let nx: number;
        let ny: number;
        if (distanceSq > 1e-12) {
          distance = Math.sqrt(distanceSq);
          if (distance >= minDistance) continue;
          nx = dx / distance;
          ny = dy / distance;
        } else {
          // Exact stacks have no geometric normal. A stable pair hash fans a crowd across many directions
          // without random state or per-pair objects, instead of marching every coincident body along +x.
          const hash = (((aOrder + 1) * 73856093) ^ ((bOrder + 1) * 19349663)) >>> 0;
          const angle = (hash / 0x100000000) * Math.PI * 2;
          nx = Math.cos(angle);
          ny = Math.sin(angle);
        }
        const movers = (aMovable ? 1 : 0) + (bMovable ? 1 : 0);
        const push = ((minDistance - distance) * ENEMY_SEPARATION_OVERLAP_FRACTION) / movers;
        if (aMovable) {
          this.enemySeparationX[aOrder] = (this.enemySeparationX[aOrder] ?? 0) - nx * push;
          this.enemySeparationY[aOrder] = (this.enemySeparationY[aOrder] ?? 0) - ny * push;
        }
        if (bMovable) {
          this.enemySeparationX[bOrder] = (this.enemySeparationX[bOrder] ?? 0) + nx * push;
          this.enemySeparationY[bOrder] = (this.enemySeparationY[bOrder] ?? 0) + ny * push;
        }
      }
    });

    this.state.enemies.forEach((enemy, id) => {
      const order = this.enemyGrid.orderOf(id);
      if (enemy.hp <= 0 || order === undefined || order >= MAX_ENEMIES) return;
      let sx = this.enemySeparationX[order] ?? 0;
      let sy = this.enemySeparationY[order] ?? 0;
      const separation = Math.hypot(sx, sy);
      if (separation > ENEMY_SEPARATION_MAX_STEP) {
        const scale = ENEMY_SEPARATION_MAX_STEP / separation;
        sx *= scale;
        sy *= scale;
      }
      enemy.x += sx;
      enemy.y += sy;

      // Preserve the established one-way player body law: only the enemy is projected, never the player.
      const radius = ENEMY_KINDS[enemy.kind]?.radius ?? ENEMY_RADIUS;
      this.state.players.forEach((player) => {
        if (!player.alive) return;
        const minDistance = radius + PLAYER_RADIUS;
        let dx = enemy.x - player.x;
        let dy = enemy.y - player.y;
        let distance = Math.hypot(dx, dy);
        if (distance === 0) {
          dx = 1;
          dy = 0;
          distance = 1;
        }
        if (distance < minDistance) {
          enemy.x = player.x + (dx / distance) * minDistance;
          enemy.y = player.y + (dy / distance) * minDistance;
        }
      });
      enemy.x = clamp(enemy.x, ENEMY_RADIUS, ARENA_WIDTH - ENEMY_RADIUS);
      enemy.y = clamp(enemy.y, ENEMY_RADIUS, ARENA_HEIGHT - ENEMY_RADIUS);
      this.updateEnemyGrid(id, enemy);
    });
  }

  override onJoin(
    client: Client,
    options?: {
      scrip?: number;
      up?: unknown;
      metaAccount?: unknown;
      carry?: CarrySelectionV1;
      selectedPetId?: unknown;
      petId?: unknown;
    },
  ): void {
    const disconnected = this.disconnectedPlayers.get(client.sessionId);
    const reservedAccount = this.metaAccounts.get(client.sessionId);
    if (disconnected && reservedAccount?.weaponBank.expedition && this.weaponRuns.has(client.sessionId)) {
      this.disconnectedPlayers.delete(client.sessionId);
      this.state.players.set(client.sessionId, disconnected.player);
      this.combat.set(client.sessionId, disconnected.combat);
      this.inputs.set(client.sessionId, this.freshInputState());
      if (this.hostId === null) this.hostId = client.sessionId;
      this.sendOwnerMessage(client.sessionId, "metaAccount", reservedAccount);
      this.sendWeaponManifest(disconnected.player);
      return;
    }
    if (encodedJsonByteLength(options) > META_JOIN_MAX_BYTES) {
      throw new Error("meta/carry payload exceeds 256 KiB");
    }
    const player = new PlayerState();
    player.id = client.sessionId;
    player.hp = PLAYER_MAX_HP;
    player.maxHp = PLAYER_MAX_HP;
    player.alive = true;
    player.weapon = DEFAULT_WEAPON;
    // §29/§31 restore the player's persisted meta ACCOUNT (belt only): scrip bank + permanent upgrade
    // levels. Client-supplied → clamped (a sane bound; the persistence model is an MVP, not a trusted
    // economy). The upgrades then apply their stat bonuses to this fresh player.
    // §44 (Sol audit): client-authored progression is only honoured while dev tools are on — on a public
    // deploy any client could join claiming 65,535 scrip + max upgrades. INTERIM until an authenticated
    // account store owns progression; production joins start at the defaults.
    const trustLegacyMeta = this.belt && this.devToolsEnabled();
    const suppliedGearAccount =
      typeof options?.metaAccount === "object" &&
      options.metaAccount !== null &&
      !Array.isArray(options.metaAccount) &&
      ((options.metaAccount as { version?: unknown }).version === 3 ||
        (options.metaAccount as { version?: unknown }).version === 4);
    const suppliedV4 = suppliedGearAccount &&
      (options?.metaAccount as { version?: unknown }).version === 4;
    const legacyAccount = sanitizeMetaAccountV2(options?.metaAccount);
    // Legacy local keys remain a bounded migration input only when no v2 blob was supplied.
    if (options?.metaAccount === undefined && trustLegacyMeta) {
      if (Number.isFinite(options?.scrip)) {
        legacyAccount.scrip = Math.max(0, Math.min(65535, Math.floor(options?.scrip as number)));
      }
      legacyAccount.upgrades = sanitizeMetaLevels(options?.up);
    }
    const accountResult = sanitizeMetaAccountV4WithDiagnostics(
      suppliedGearAccount ? options?.metaAccount : legacyAccount,
    );
    if (suppliedV4 && !accountResult.ok) {
      throw new Error(`invalid weapon bank: ${accountResult.bank.errors.join(",")}`);
    }
    const account = accountResult.account;
    const requestedPetId = options?.selectedPetId ?? options?.petId;
    if (requestedPetId === "") account.selectedPetId = "";
    else if (isPetId(requestedPetId) && account.pets[requestedPetId]) {
      account.selectedPetId = requestedPetId;
    }
    this.metaAccounts.set(client.sessionId, account);
    player.scrip = account.scrip;
    player.prestige = account.prestige;
    if (suppliedGearAccount) {
      const gear = resolveGearLoadout(account.equippedGear);
      this.gearRuns.set(client.sessionId, gear);
      this.snapshotGearRun(player, undefined, gear, false);
      player.hp = player.maxHp;
    } else {
      // Compatibility sequencing: current v2 clients retain their playable kit until they send a v3
      // wardrobe. The canonical account has already migrated the three upgrade tracks to owned items.
      player.upVitality = legacyAccount.upgrades.vitality;
      player.upFortune = legacyAccount.upgrades.fortune;
      player.upPower = legacyAccount.upgrades.power;
      this.snapshotRunCharacter(player, undefined, false, false);
      player.hp = player.maxHp;
    }
    this.snapshotPetRun(player, account.selectedPetId);
    for (let i = 0; i < ARSENAL_SLOTS; i++) player.slots.push(new ArsenalSlot());
    const runId = `run_${randomBytes(12).toString("base64url")}`;
    const requestedTier = Math.max(account.prestige, this.worldTier);
    const carry: CarrySelectionV1 = options?.carry ?? {
      requestId: `auto_${randomBytes(12).toString("base64url")}`,
      expectedRevision: account.revision,
      placements: [],
      activeEntryId: "",
      requestedWorldTier: requestedTier,
    };
    // Bank §2.3 — disconnect is never extraction, and there is no reservation machinery yet: an
    // account arriving at a NEW join with an OPEN expedition abandoned the old one (client killed,
    // Wi-Fi lost — the settlement only ever lived in that room's memory while the blob lives in
    // localStorage). Settle it as the defeat outcome BEFORE this carry: the stake is lost, the bank
    // un-bricks, and no kill-the-client replay can turn a carried instance into a safe copy plus a
    // live copy. Revision must NOT advance here — the client built this join's carry against the
    // account exactly as it last saw it, so a bump would falsely stale-reject the fresh carry.
    const abandoned = account.weaponBank.expedition
      ? settleWeaponExpedition(account, "defeat", false)
      : undefined;
    const committed = commitWeaponCarry(
      account,
      carry,
      runId,
      this.bagCapacity(player),
      this.worldTier,
    );
    if (!committed.ok) throw new Error(`weapon carry rejected: ${committed.error}`);
    if (abandoned?.ok) {
      // Honest ledger: the owner learns what the abandoned run cost the moment they are back.
      this.sendOwnerMessage(client.sessionId, "expeditionAbandonReceipt", abandoned);
    }
    this.worldTier = Math.max(this.worldTier, committed.runTier);
    this.materializeWeaponRun(player, account);
    this.createWeaponRun(client.sessionId, account);
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
    this.inputs.set(client.sessionId, this.freshInputState());
    const joinedGear = this.gearRuns.get(client.sessionId);
    const joinedQuirk = joinedGear?.quirk ?? quirkForCharacter(player.runCharacter);
    this.combat.set(client.sessionId, {
      identityCharacter: player.runCharacter,
      quirk: joinedQuirk,
      mods: joinedGear?.mods ?? runtimeModsForQuirk(joinedQuirk),
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
      lastWeapon: player.weapon,
      drawLock: 0,
      handGate: 0,
      offLastWeapon: "",
      pairComboSeq: undefined,
      pairComboAcceptedAtMs: 0,
      pairComboId: "",
      pairComboFamily: "arc",
      pairComboStep: 0,
      pairComboExpiresAtMs: 0,
      weaponLedger: new Map<string, WeaponResourceLedger>(),
      drive: {
        valueF: DRIVE_CAPACITY,
        recoveryDebtF: 0,
        pressureUntilTick: 0,
        regenMode: DriveRegenMode.Floor,
        beamLockEndTick: 0,
        beamRecoveryEndTick: 0,
        beamRequireRelease: false,
        tickCreditF: 0,
        tickDebitF: 0,
        tickOpen: false,
        forceEngaged: false,
        simulationPaused: false,
        engagedRecoveryMult: 1,
        spendResult: { accepted: false, debit: 0, beamEmpty: false },
      },
      jumpCd: 0,
      stance: STANCE_NONE,
      crouchT: 0,
      crouchPrevHeld: false,
      crouchAimX: 0,
      crouchAimY: 0,
      dashDirX: 0,
      dashDirY: 0,
      dashBaseDirX: 0,
      dashBaseDirY: 0,
      dashSpeed: 0,
      dashSteer: 0,
      distJumpCd: 0,
      poundUsed: false,
      poundGatherT: 0,
      poundTriggerHeight: 0,
      recoveryT: 0,
      momentumX: 0,
      momentumY: 0,
      slidePhase: SLIDE_PHASE_OFF,
      slidePhaseTick: 0,
      slidePrevHeld: false,
      slideHopBuffered: false,
      slidePrelandTicks: 0,
      slideLandMomentumX: 0,
      slideLandMomentumY: 0,
      slideColdArmed: true,
      slideColdRearmTicks: 0,
      slideParryLockT: 0,
      lastSlideLandingTick: -1,
      slideStepStartX: player.x,
      slideStepStartY: player.y,
      lastLandingTier: LANDING_TIER_SOFT,
      lastLandingSpeed: 0,
      lastGroundX: player.x,
      lastGroundY: player.y,
      pitGrace: 0,
      hairStreak: 0,
      lastParryAt: -999,
      parryChain: 0,
      parryChainT: 0,
      parryOpenedTick: 0xffffffff,
      killHealWindowStart: -999,
      killHealWindowAmount: 0,
      vh: 0,
      heldEarned: player.slots[player.activeSlot]?.earned ?? false,
      bulwarkShield: 0,
      juggleMercy: 0,
      juggleArmed: false,
      augmentSnapshot: "",
      beamVentStacks: 0,
      beamFocusStacks: 0,
      beamPhase: 0,
      beamPhaseT: 0,
      beamChannelT: 0,
      beamAngle: 0,
      beamPreviousAngle: 0,
      beamPreviousX: player.x,
      beamPreviousY: player.y,
      beamPreviousLength: 0,
      beamTeleportSeq: player.teleportSeq,
      beamInputWasHeld: false,
      beamPulseT: 0,
      beamQuantumT: 0,
      beamCrit: 0,
      beamHitIds: new Set<string>(),
      beamPendingDamage: new Map<string, number>(),
      ultChargeF: 0,
      ultBuffer: 0,
      ultAccrualThisTick: 0,
      ultAlphaBonusTargets: 0,
      ultCritCharges: 0,
      ultCritEndTick: 0,
    });
    const joinedCombat = this.combat.get(client.sessionId);
    if (joinedCombat) this.activateMaterializedPair(player, joinedCombat);
    this.sendWeaponManifest(player);
    this.publishPetPickupEligibility();
    if (typeof client.send === "function") client.send("metaAccount", account);
    console.log(`[room ${this.roomId}] +join ${client.sessionId} (${this.clients.length} online)`);
  }

  override onLeave(client: Client): void {
    const leaving = this.state.players.get(client.sessionId);
    const leavingCombat = this.combat.get(client.sessionId);
    if (leaving && leavingCombat) this.cancelBeam(leaving, client.sessionId, leavingCombat, false, true);
    if (leaving && leavingCombat && this.metaAccounts.get(client.sessionId)?.weaponBank.expedition) {
      this.syncWeaponRunFromArsenal(leaving);
      this.disconnectedPlayers.set(client.sessionId, { player: leaving, combat: leavingCombat });
    }
    this.state.beams.delete(client.sessionId);
    this.state.players.delete(client.sessionId);
    this.inputs.delete(client.sessionId);
    this.combat.delete(client.sessionId);
    // Transport loss is not a terminal weapon result. Account, pet accrual, exact escrow, and the private
    // body/debt snapshot remain reserved; accepted extraction/wipe settles them even while disconnected.
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

  /** Explicit encounter/modal hook. Auto remains the default; callers never write Drive or regenMode. */
  setWeaponResourceRegenOverride(
    playerId: string,
    mode: "auto" | "paused" | "forceEngaged",
  ): void {
    const drive = this.combat.get(playerId)?.drive;
    if (!drive) return;
    drive.simulationPaused = mode === "paused";
    drive.forceEngaged = mode === "forceEngaged";
  }

  private drivePendingValue(c: CombatState): number {
    return Math.max(
      0,
      Math.min(DRIVE_CAPACITY, c.drive.valueF + c.drive.tickCreditF - c.drive.tickDebitF),
    );
  }

  private markWeaponResourcePressure(c: CombatState): void {
    c.drive.pressureUntilTick = (
      this.state.tick + Math.ceil(DRIVE_PRESSURE_MEMORY_SECONDS * 1000 / TICK_MS)
    ) >>> 0;
  }

  /** Cover-agnostic pressure evidence. Dummy rows are training fixtures, not living hostiles. */
  private hostileWithinDriveThreat(player: PlayerState): boolean {
    const radiusSq = DRIVE_THREAT_RADIUS * DRIVE_THREAT_RADIUS;
    this.enemyGrid.queryRadius(player.x, player.y, DRIVE_THREAT_RADIUS, this.enemyCandidates);
    for (let i = 0; i < this.enemyCandidates.length; i++) {
      const enemy = this.state.enemies.get(this.enemyCandidates[i]!);
      if (!enemy || enemy.hp <= 0 || enemy.kind === "dummy") continue;
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      if (dx * dx + dy * dy <= radiusSq) return true;
    }
    return false;
  }

  /** Preserve the old discrete lock+cool tick count for approved beam-only vent/lock modifiers. */
  private beamEmptyRecoveryTicks(c: CombatState): number {
    const lockTicks = Math.ceil(
      BEAM_OVERHEAT_LOCK_SECONDS * c.mods.beamOverheatLockMult * 1000 / TICK_MS - 1e-9,
    );
    const ventMultiplier =
      (1 + AUG_BEAM_COOL_PER * c.beamVentStacks) * c.mods.beamVentMult;
    const coolTicks = Math.ceil(
      (1 - BEAM_RESTART_HEAT) /
        Math.max(1e-9, BEAM_COOL_PER_SECOND * ventMultiplier) *
        1000 /
        TICK_MS -
        1e-9,
    );
    return Math.max(1, lockTicks + coolTicks);
  }

  /** Compute one fixed-step credit before any fire path. Recovery debt is sampled before it ages. */
  private beginWeaponResourceTick(player: PlayerState, c: CombatState, dt: number): void {
    const drive = c.drive;
    drive.tickCreditF = 0;
    drive.tickDebitF = 0;
    drive.tickOpen = true;
    const debtLive = drive.recoveryDebtF > 1e-9;
    const recentReceipt =
      drive.pressureUntilTick !== 0 && !tickReached(this.state.tick, drive.pressureUntilTick);
    const pressure = drive.forceEngaged || recentReceipt || this.hostileWithinDriveThreat(player);
    drive.regenMode = driveRegenModeFor(
      player.alive,
      drive.simulationPaused || this.inLevelWindow(player),
      debtLive,
      pressure,
      player.ultPhase !== UltimatePhase.Idle,
    );
    const genericRecovery = Math.max(
      1,
      Math.min(DRIVE_MAX_GENERIC_RECOVERY_MULT, drive.engagedRecoveryMult),
    );
    const rebuildingEmptyBeam =
      drive.beamLockEndTick !== 0 && this.drivePendingValue(c) + 1e-9 < DRIVE_BEAM_RESTART_THRESHOLD;
    if (drive.regenMode !== DriveRegenMode.Paused && rebuildingEmptyBeam) {
      // This is the old beam-only vent row translated into the shared bar, not generic/hiding recovery.
      drive.regenMode = DriveRegenMode.Floor;
      drive.tickCreditF =
        DRIVE_BEAM_RESTART_THRESHOLD /
        (this.beamEmptyRecoveryTicks(c) * TICK_MS / 1000) *
        dt;
    } else {
      drive.tickCreditF = driveRegenPerSecond(drive.regenMode, genericRecovery) * dt;
    }
    drive.recoveryDebtF = Math.max(0, drive.recoveryDebtF - dt);
  }

  /** Commit once after all same-tick fire paths, then floor the public hundredths mirror. */
  private commitWeaponResourceTick(player: PlayerState, c: CombatState): void {
    const drive = c.drive;
    drive.valueF = Math.max(
      0,
      Math.min(DRIVE_CAPACITY, drive.valueF + drive.tickCreditF - drive.tickDebitF),
    );
    player.weaponResource.valueQ = Math.max(0, Math.floor(drive.valueF * 100 + 1e-7));
    player.weaponResource.regenMode = drive.regenMode;
    player.weaponResource.beamLockEndTick = drive.beamLockEndTick >>> 0;
    drive.tickCreditF = 0;
    drive.tickDebitF = 0;
    drive.tickOpen = false;
  }

  /** Credits are a separate authority seam and cannot clear release or minimum-lock gates. */
  private creditWeaponResource(player: PlayerState, c: CombatState, amount: number): number {
    const credit = Number.isFinite(amount) ? Math.max(0, amount) : 0;
    c.drive.valueF = Math.min(DRIVE_CAPACITY, c.drive.valueF + credit);
    player.weaponResource.valueQ = Math.floor(c.drive.valueF * 100 + 1e-7);
    return credit;
  }

  /**
   * The one weapon spend seam. It resolves canonical formula data and live cadence; callers never supply a
   * price. The reused result row avoids a per-action allocation in the fixed 20 Hz loop.
   */
  private trySpendWeaponResource(
    player: PlayerState,
    c: CombatState,
    weapon: WeaponDef,
    _weaponInstanceId: string,
    _delivery: number,
    _hand: DualWieldHand,
    effectiveInterval: number,
    pairContribution: number,
    continuousDt: number,
    reason: WeaponSpendReason,
  ): WeaponSpendResult {
    const result = c.drive.spendResult;
    result.accepted = false;
    result.debit = 0;
    result.beamEmpty = false;
    const profile = weaponResourceProfile(weapon.id);
    if (!profile) return result;

    let requested = 0;
    if (reason === "tap") {
      requested = driveCostForProfile(profile, effectiveInterval) * Math.max(0, pairContribution);
    } else if (reason === "beam-ignite") {
      requested = DRIVE_BEAM_IGNITION_COST;
    } else if (reason === "beam-active") {
      const dt = Math.max(0, continuousDt);
      const concurrentRegen = dt > 0 ? c.drive.tickCreditF / dt : DRIVE_FLOOR_REGEN_PER_SECOND;
      requested = (DRIVE_BEAM_NET_DRAIN_PER_SECOND + concurrentRegen) * dt;
    } else {
      requested = DRIVE_BEAM_CANCEL_COST;
    }
    if (!Number.isFinite(requested) || requested < 0) return result;

    const available = this.drivePendingValue(c);
    const partial = reason === "beam-active" || reason === "beam-cancel";
    if (!partial && available + 1e-9 < requested) return result;
    const debit = partial ? Math.min(available, requested) : requested;
    if (reason === "beam-active" && debit <= 1e-9) return result;
    if (c.drive.tickOpen) {
      c.drive.tickDebitF += debit;
    } else {
      c.drive.valueF = Math.max(0, c.drive.valueF - debit);
      player.weaponResource.valueQ = Math.floor(c.drive.valueF * 100 + 1e-7);
    }
    c.drive.recoveryDebtF = Math.max(
      c.drive.recoveryDebtF,
      Math.max(0, effectiveInterval),
      debit / DRIVE_FLOOR_REGEN_PER_SECOND,
    );
    result.accepted = true;
    result.debit = debit;
    result.beamEmpty = reason === "beam-active" && available - debit <= 1e-9;
    return result;
  }

  /** Direct-contact slide predicate. Separate from parry `invuln`; ticks 1..5 are the inherited budget. */
  private slideInvulnerable(c: CombatState): boolean {
    return slideContactInvulnerable(c.stance, c.slidePhase, c.slidePhaseTick);
  }

  private noteSlideDodge(player: PlayerState): void {
    player.dodgedSeq = (player.dodgedSeq + 1) & 0xff;
  }

  /** One authoritative player-damage seam. Bulwark spends its successful-parry shield before HP. */
  private damagePlayer(
    player: PlayerState,
    amount: number,
    kind: PlayerDamageKind = "enemy",
  ): void {
    const c = this.combat.get(player.id);
    let left = Math.max(0, amount);
    if (
      player.ultPhase === UltimatePhase.Windup &&
      ultimateFamilyForCode(player.ultArchetype) === UltimateFamily.Seismarch
    ) left *= 0.4;
    if (player.alive && (kind === "pit" || kind === "ground-hazard")) {
      left *=
        (this.petRuns.get(player.id)?.mods.groundHazardDamageMultiplier ?? 1) *
        (c?.mods.groundHazardDamageMult ?? 1);
    }
    const capFrac = c?.mods.incomingDamageCapFrac ?? 1;
    if (capFrac < 1) left = Math.min(left, player.maxHp * capFrac);
    // Failed-jump mercy is its own null-immunity channel. It never writes/consults parry `invuln`, so a
    // snap-back cannot mint parry flashes, augments, chain economy, or worm accepts from a later quake.
    if (c && c.pitGrace > 0 && left > 0) return;
    if (c && kind === "enemy" && left > 0) this.markWeaponResourcePressure(c);
    if (c && left > 0 && (c.stance === STANCE_CROUCH || c.stance === STANCE_DASH)) {
      this.cancelMoveStance(player, c, true);
    }
    if (c && c.bulwarkShield > 0 && left > 0) {
      const absorbed = Math.min(c.bulwarkShield, left);
      c.bulwarkShield -= absorbed;
      left -= absorbed;
    }
    if (left > 0) {
      player.hp = Math.max(0, player.hp - left);
      if (c?.mods.parryChainNeverExpires) {
        c.parryChain = 0;
        c.parryChainT = 0;
      }
    }
  }

  /** Consume the two jump-feel command bits on their exact acknowledged input tick. */
  private consumeMoveStanceInput(
    player: PlayerState,
    input: InputState,
    c: CombatState,
    cmd: InputCmd,
  ): void {
    if (cmd.fireHeld && c.stance === STANCE_CROUCH) this.cancelMoveStance(player, c, true);

    if (cmd.pound) {
      const slideAir = c.stance === STANCE_SLIDE && c.slidePhase === SLIDE_PHASE_AIR;
      if (
        player.alive &&
        !this.inLevelWindow(player) &&
        player.height > POUND_MIN_HEIGHT &&
        !c.poundUsed &&
        (c.stance === STANCE_NONE || c.stance === STANCE_DASH || slideAir)
      ) {
        if (slideAir) this.cancelMoveStance(player, c, false);
        c.poundUsed = true;
        c.poundGatherT = POUND_GATHER_SECONDS;
        c.poundTriggerHeight = player.height;
        c.vh = 0;
        player.vh = 0;
        input.mvx = 0;
        input.mvy = 0;
        player.mvx = 0;
        player.mvy = 0;
        c.dashSpeed = 0;
        this.setMoveStance(player, c, STANCE_POUND);
      } else if (
        slideAir &&
        verticalTimeToGround(player.height, c.vh) <=
          SLIDE_PRELAND_BUFFER_TICKS * (TICK_MS / 1000) + 1e-9
      ) {
        // A fresh near-ground Space edge can be the next hop only when the landing slide is also armed.
        c.slideHopBuffered = true;
      } else if (player.height > GROUND_EPSILON && player.height <= POUND_MIN_HEIGHT) {
        // The first/last sliver keeps the old "press before landing" buffer rather than stealing it.
        c.jumpBuffer = JUMP_BUFFER_SECONDS;
      }
    }

    const slideReleased = !cmd.slideHeld && c.slidePrevHeld;
    c.slidePrevHeld = cmd.slideHeld;
    if (
      slideReleased &&
      c.stance === STANCE_SLIDE &&
      c.slidePhase === SLIDE_PHASE_GROUND &&
      c.slidePhaseTick >= SLIDE_COMMIT_TICKS
    ) {
      this.cancelMoveStance(player, c, false);
    }

    if (cmd.slide && c.stance === STANCE_SLIDE) {
      if (c.slidePhase === SLIDE_PHASE_LAND_WINDOW) {
        this.acceptSlideLandingChain(player, c, input);
      } else if (
        c.slidePhase === SLIDE_PHASE_AIR &&
        verticalTimeToGround(player.height, c.vh) <= SLIDE_PRELAND_BUFFER_TICKS * (TICK_MS / 1000) + 1e-9
      ) {
        c.slidePrelandTicks = SLIDE_PRELAND_BUFFER_TICKS;
      }
    }

    // Shift and Ctrl collapse to the same unbuffered edge. Cold entry is movement-gated and never retries
    // from a held key; landing windows are the explicit held/buffered exception.
    if (
      cmd.slide &&
      player.alive &&
      !this.inLevelWindow(player) &&
      player.height <= GROUND_EPSILON &&
      c.stance === STANCE_NONE &&
      c.recoveryT <= 0 &&
      c.slideColdArmed &&
      !c.juggleArmed &&
      c.invuln <= 0 &&
      c.pitGrace <= 0 &&
      c.beamPhase === 0 &&
      Math.hypot(cmd.dx, cmd.dy) > 1e-4
    ) {
      const speed = Math.hypot(input.mvx, input.mvy);
      if (speed + 1e-9 >= SLIDE_ENTRY_SPEED) {
        c.momentumX = (input.mvx / speed) * SLIDE_SPEED_CAP;
        c.momentumY = (input.mvy / speed) * SLIDE_SPEED_CAP;
        c.slidePhase = SLIDE_PHASE_GROUND;
        c.slidePhaseTick = 0;
        c.slideHopBuffered = false;
        c.slidePrelandTicks = 0;
        c.slideLandMomentumX = 0;
        c.slideLandMomentumY = 0;
        c.slideColdArmed = false;
        c.slideColdRearmTicks = 0;
        c.lastSlideLandingTick = -1;
        c.slideParryLockT = SLIDE_PARRY_LOCK_SECONDS + TICK_MS / 1000;
        c.attackBuffer = 0;
        input.mvx = c.momentumX;
        input.mvy = c.momentumY;
        player.mvx = input.mvx;
        player.mvy = input.mvy;
        this.setMoveStance(player, c, STANCE_SLIDE);
      }
    }

    const pressed = cmd.crouchHeld && !c.crouchPrevHeld;
    const released = !cmd.crouchHeld && c.crouchPrevHeld;
    c.crouchPrevHeld = cmd.crouchHeld;
    if (released && c.stance === STANCE_CROUCH) this.cancelMoveStance(player, c, false);
    if (
      pressed &&
      player.alive &&
      !this.inLevelWindow(player) &&
      player.height <= GROUND_EPSILON &&
      c.stance === STANCE_NONE &&
      c.recoveryT <= 0 &&
      c.attackBuffer <= 0 &&
      c.parryBuffer <= 0 &&
      !cmd.fireHeld
    ) {
      c.crouchT = 0;
      c.crouchAimX = 0;
      c.crouchAimY = 0;
      const len = Math.hypot(cmd.dx, cmd.dy);
      if (len > 1e-4) {
        c.crouchAimX = cmd.dx / len;
        c.crouchAimY = cmd.dy / len;
      }
      this.setMoveStance(player, c, STANCE_CROUCH);
    }
  }

  private setMoveStance(player: PlayerState, c: CombatState, stance: MoveStance): void {
    if (c.stance === stance) return;
    c.stance = stance;
    player.moveStance = stance;
  }

  private syncSlideWire(player: PlayerState, c: CombatState): void {
    if (c.slidePhase === SLIDE_PHASE_LAND_WINDOW) {
      const raw = Math.hypot(c.slideLandMomentumX, c.slideLandMomentumY);
      const speed = clampSlideSpeed(raw);
      if (raw > 1e-4 && Number.isFinite(raw)) {
        const scale = speed / raw;
        c.slideLandMomentumX *= scale;
        c.slideLandMomentumY *= scale;
      } else {
        c.slideLandMomentumX = 0;
        c.slideLandMomentumY = 0;
      }
      player.momentumX = c.slideLandMomentumX;
      player.momentumY = c.slideLandMomentumY;
    } else if (c.stance === STANCE_SLIDE) {
      const speed = clampSlideSpeed(Math.hypot(c.momentumX, c.momentumY));
      const raw = Math.hypot(c.momentumX, c.momentumY);
      if (raw > 1e-4 && Number.isFinite(raw)) {
        const scale = speed / raw;
        c.momentumX *= scale;
        c.momentumY *= scale;
      } else {
        c.momentumX = 0;
        c.momentumY = 0;
      }
      player.momentumX = c.momentumX;
      player.momentumY = c.momentumY;
    } else {
      player.momentumX = 0;
      player.momentumY = 0;
    }
    player.slidePhase = c.slidePhase;
    player.slidePhaseTick = Math.max(0, Math.min(255, c.slidePhaseTick));
  }

  /** Forced cancels alone bump stanceSeq; organic abort/launch/landing edges only change moveStance. */
  private cancelMoveStance(player: PlayerState, c: CombatState, forced: boolean): void {
    if (c.stance === STANCE_NONE) return;
    if (c.stance === STANCE_SLIDE) {
      const input = this.inputs.get(player.id);
      if (input) {
        if (!forced && (c.slidePhase === SLIDE_PHASE_GROUND || c.slidePhase === SLIDE_PHASE_AIR)) {
          input.mvx = c.momentumX;
          input.mvy = c.momentumY;
        } else {
          input.mvx = 0;
          input.mvy = 0;
        }
        player.mvx = input.mvx;
        player.mvy = input.mvy;
      }
      c.momentumX = 0;
      c.momentumY = 0;
      c.slidePhase = SLIDE_PHASE_OFF;
      c.slidePhaseTick = 0;
      c.slideHopBuffered = false;
      c.slidePrelandTicks = 0;
      c.slideLandMomentumX = 0;
      c.slideLandMomentumY = 0;
      c.lastSlideLandingTick = -1;
      c.slideColdRearmTicks = 0;
      player.momentumX = 0;
      player.momentumY = 0;
      player.slidePhase = SLIDE_PHASE_OFF;
      player.slidePhaseTick = 0;
    }
    c.stance = STANCE_NONE;
    player.moveStance = STANCE_NONE;
    c.crouchT = 0;
    c.crouchAimX = 0;
    c.crouchAimY = 0;
    c.dashDirX = 0;
    c.dashDirY = 0;
    c.dashBaseDirX = 0;
    c.dashBaseDirY = 0;
    c.dashSpeed = 0;
    c.dashSteer = 0;
    c.poundGatherT = 0;
    c.poundTriggerHeight = 0;
    if (forced) player.stanceSeq = (player.stanceSeq + 1) & 0xff;
  }

  private launchSlideHop(player: PlayerState, c: CombatState): void {
    const speed = Math.hypot(c.momentumX, c.momentumY);
    if (speed <= 1e-4) return;
    const nextSpeed = slideHopSpeed(speed);
    c.momentumX = (c.momentumX / speed) * nextSpeed;
    c.momentumY = (c.momentumY / speed) * nextSpeed;
    c.slidePhase = SLIDE_PHASE_AIR;
    c.slideHopBuffered = false;
    c.vh = SLIDE_HOP_VERTICAL_VELOCITY;
    c.jumpCd = Math.max(c.jumpCd, JUMP_COOLDOWN);
    player.vh = c.vh;
  }

  private acceptSlideLandingChain(
    player: PlayerState,
    c: CombatState,
    input: InputState,
  ): boolean {
    if (
      c.stance !== STANCE_SLIDE ||
      c.slidePhase !== SLIDE_PHASE_LAND_WINDOW ||
      c.slidePhaseTick > SLIDE_LAND_WINDOW_TICKS ||
      c.lastSlideLandingTick < 0 ||
      c.pitGrace > 0
    ) return false;
    const landingSpeed = Math.hypot(c.slideLandMomentumX, c.slideLandMomentumY);
    if (landingSpeed <= 1e-4) return false;
    const nextSpeed = slideLandingSpeed(landingSpeed);
    c.momentumX = (c.slideLandMomentumX / landingSpeed) * nextSpeed;
    c.momentumY = (c.slideLandMomentumY / landingSpeed) * nextSpeed;
    c.slideLandMomentumX = 0;
    c.slideLandMomentumY = 0;
    c.lastSlideLandingTick = -1;
    c.slidePhase = SLIDE_PHASE_GROUND;
    c.slidePhaseTick = 0;
    c.slidePrelandTicks = 0;
    c.slideParryLockT = Math.max(
      c.slideParryLockT,
      SLIDE_PARRY_LOCK_SECONDS + TICK_MS / 1000,
    );
    input.mvx = c.momentumX;
    input.mvy = c.momentumY;
    player.mvx = input.mvx;
    player.mvy = input.mvy;
    return true;
  }

  private freshInputState(): InputState {
    return {
      queue: [],
      held: {
        seq: 0,
        dx: 0,
        dy: 0,
        jump: false,
        crouchHeld: false,
        pound: false,
        slide: false,
        slideHeld: false,
        fireHeld: false,
        fireStartSeq: 0,
        aimX: 1,
        aimY: 0,
        targetX: 0,
        targetY: 0,
      },
      lastSeq: 0,
      msgBudget: INPUT_MSGS_PER_TICK,
      lastFreshFireTick: 0,
      actionBudget: ACTION_MSGS_PER_TICK,
      mvx: 0,
      mvy: 0,
    };
  }

  /** Tick-only slide transitions that remain after horizontal/vertical integration. Slide-hop launch is
   *  deliberately consumed by `stepTraversalLaunches` before movement and pit sampling (QOL-02). */
  private stepSlideStance(player: PlayerState, c: CombatState): void {
    if (c.stance !== STANCE_SLIDE) return;
    if (c.slidePhase === SLIDE_PHASE_GROUND) {
      if (c.slidePhaseTick >= SLIDE_GROUND_TICKS) {
        this.cancelMoveStance(player, c, false);
      }
      return;
    }
    if (c.slidePhase === SLIDE_PHASE_LAND_WINDOW) {
      c.slidePhaseTick++;
      if (c.slidePhaseTick > SLIDE_LAND_WINDOW_TICKS) this.cancelMoveStance(player, c, false);
    }
  }

  private damagePitFall(player: PlayerState): void {
    this.damagePlayer(player, player.maxHp * PIT_FALL_DAMAGE_FRAC, "pit");
    const pet = this.petRuns.get(player.id);
    if (player.hp > 0 && pet?.mods.pitRegenSeconds) {
      pet.tortoisePitRegenSeconds = pet.mods.pitRegenSeconds;
    }
  }

  /** QOL-02 traversal acceptance phase. Cooldown/buffer clocks advance here so a jump that becomes ready
   *  on THIS tick launches before horizontal integration and pit sampling, rather than after taking a fall.
   *  A buffered slide-hop that would become ready on the pending ground step consumes that step's exact
   *  schema-23 decay before launch, preserving the landed momentum contract while moving the launch edge. */
  private stepTraversalLaunches(dt: number): void {
    this.state.players.forEach((player, id) => {
      const c = this.combat.get(id);
      if (!c) return;
      c.jumpCd = Math.max(0, c.jumpCd - dt);
      c.jumpBuffer = Math.max(0, c.jumpBuffer - dt);
      const acting =
        this.state.outcome === "active" && player.alive && !this.inLevelWindow(player);
      if (!acting) return;

      if (
        c.stance === STANCE_SLIDE &&
        c.slidePhase === SLIDE_PHASE_GROUND &&
        c.slideHopBuffered &&
        c.slidePhaseTick + 1 >= SLIDE_HOP_MIN_TICK
      ) {
        const speed = Math.hypot(c.momentumX, c.momentumY);
        if (speed > 1e-4) {
          const decayed = slideGroundNextSpeed(speed);
          const scale = decayed / speed;
          c.momentumX *= scale;
          c.momentumY *= scale;
        }
        this.launchSlideHop(player, c);
      }

      if (
        c.stance === STANCE_NONE &&
        c.recoveryT <= 0 &&
        c.jumpBuffer > 0 &&
        c.jumpCd <= 0 &&
        player.height <= GROUND_EPSILON
      ) {
        c.jumpBuffer = 0;
        c.vh = JUMP_VELOCITY;
        c.jumpCd = JUMP_COOLDOWN;
        player.vh = c.vh;
      }
    });
  }

  /** Advance the fixed ten-tick crouch; launch direction is sampled from this exact authoritative tick. */
  private stepCrouchStance(
    player: PlayerState,
    c: CombatState,
    input: InputState | undefined,
    dt: number,
  ): void {
    if (c.stance !== STANCE_CROUCH) return;
    if (!input?.held.crouchHeld) {
      this.cancelMoveStance(player, c, false);
      return;
    }
    const len = Math.hypot(input.held.dx, input.held.dy);
    if (len > 1e-4) {
      c.crouchAimX = input.held.dx / len;
      c.crouchAimY = input.held.dy / len;
    }
    c.crouchT += dt;
    if (c.crouchT + 1e-9 < CROUCH_COMMIT_SECONDS) return;
    if (c.distJumpCd > 0) {
      this.cancelMoveStance(player, c, false);
      return;
    }
    this.launchDistanceJump(player, c, input);
  }

  private launchDistanceJump(player: PlayerState, c: CombatState, input: InputState): void {
    let dx = input.held.dx;
    let dy = input.held.dy;
    let len = Math.hypot(dx, dy);
    if (len <= 1e-4) {
      dx = c.crouchAimX;
      dy = c.crouchAimY;
      len = Math.hypot(dx, dy);
    }
    if (len <= 1e-4) {
      dx = c.aimX;
      dy = c.aimY;
      len = Math.hypot(dx, dy);
    }
    if (len <= 1e-4) {
      this.cancelMoveStance(player, c, false);
      return;
    }
    dx /= len;
    dy /= len;

    const rawX = clamp(
      player.x + dx * DIST_JUMP_REACH,
      PLAYER_RADIUS,
      ARENA_WIDTH - PLAYER_RADIUS,
    );
    const rawY = clamp(
      player.y + dy * DIST_JUMP_REACH,
      PLAYER_RADIUS,
      ARENA_HEIGHT - PLAYER_RADIUS,
    );
    let targetX: number;
    let targetY: number;
    if (this.belt && this.beltLevel) {
      targetX = beltSafeX(this.beltLevel, rawX, player.x);
      targetY = clampBeltFloorY(this.beltLevel, targetX, rawY, PLAYER_RADIUS);
    } else {
      const safe = safeSpawnPos(this.map, rawX, rawY, PLAYER_RADIUS);
      targetX = safe.x;
      targetY = safe.y;
    }
    dx = targetX - player.x;
    dy = targetY - player.y;
    len = Math.hypot(dx, dy);
    if (len <= 1e-4) {
      this.cancelMoveStance(player, c, false);
      return;
    }
    c.dashDirX = dx / len;
    c.dashDirY = dy / len;
    c.dashBaseDirX = c.dashDirX;
    c.dashBaseDirY = c.dashDirY;
    c.dashSteer = 0;
    c.dashSpeed = Math.min(DIST_JUMP_SPEED, len / DIST_JUMP_AIRTIME);
    c.distJumpCd = DIST_JUMP_COOLDOWN;
    c.vh = DIST_JUMP_VERTICAL_VELOCITY;
    player.vh = c.vh;
    input.mvx = c.dashDirX * c.dashSpeed;
    input.mvy = c.dashDirY * c.dashSpeed;
    player.mvx = input.mvx;
    player.mvy = input.mvy;
    this.setMoveStance(player, c, STANCE_DASH);
  }

  /** Bend toward held WASD at <=45°/s and never farther than ±27° from the launch heading. */
  private steerDistanceJump(c: CombatState, input: InputCmd, dt: number): void {
    const len = Math.hypot(input.dx, input.dy);
    if (len <= 1e-4) return;
    const base = Math.atan2(c.dashBaseDirY, c.dashBaseDirX);
    const desired = Math.atan2(input.dy, input.dx);
    const targetSteer = clamp(
      shortestAngleDelta(base, desired),
      -DIST_JUMP_MAX_STEER_RADIANS,
      DIST_JUMP_MAX_STEER_RADIANS,
    );
    const maxStep = DIST_JUMP_STEER_RADIANS_PER_SECOND * dt;
    c.dashSteer += clamp(targetSteer - c.dashSteer, -maxStep, maxStep);
    const angle = base + c.dashSteer;
    c.dashDirX = Math.cos(angle);
    c.dashDirY = Math.sin(angle);
  }

  private finishPlayerLanding(
    player: PlayerState,
    c: CombatState,
    landingStance: MoveStance,
    impactVh: number,
  ): void {
    c.lastLandingSpeed = Math.abs(impactVh);
    c.lastLandingTier = landingThumpTier(
      impactVh,
      landingStance === STANCE_DASH
        ? c.dashSpeed
        : landingStance === STANCE_SLIDE
          ? Math.hypot(c.momentumX, c.momentumY)
          : 0,
      landingStance === STANCE_DASH || landingStance === STANCE_POUND,
    );
    if (landingStance === STANCE_POUND) {
      this.applyPoundImpact(player, c);
      c.jumpCd = Math.max(c.jumpCd, POUND_JUMP_COOLDOWN);
      c.recoveryT = POUND_RECOVERY_SECONDS;
      c.invuln = 0; // landing begins the explicit no-parry bill and cannot auto-answer a quake
    } else if (landingStance === STANCE_DASH) {
      c.jumpCd = Math.max(c.jumpCd, 0.4);
      const input = this.inputs.get(player.id);
      if (input) {
        input.mvx = c.dashDirX * MOVE_SPEED * DIST_JUMP_LANDING_SPEED_MULT;
        input.mvy = c.dashDirY * MOVE_SPEED * DIST_JUMP_LANDING_SPEED_MULT;
        player.mvx = input.mvx;
        player.mvy = input.mvy;
      }
    } else if (landingStance === STANCE_SLIDE && c.slidePhase === SLIDE_PHASE_AIR) {
      const unsafe = this.belt && this.beltLevel
        ? beltPitAtX(this.beltLevel, player.x)
        : !this.belt && isPitAtPx(this.map, player.x, player.y);
      if (unsafe) {
        this.cancelMoveStance(player, c, true);
      } else {
        c.slideLandMomentumX = c.momentumX;
        c.slideLandMomentumY = c.momentumY;
        c.momentumX = 0;
        c.momentumY = 0;
        c.slidePhase = SLIDE_PHASE_LAND_WINDOW;
        c.slidePhaseTick = 0;
        c.lastSlideLandingTick = this.state.tick;
        const input = this.inputs.get(player.id);
        const chained =
          !!input &&
          (input.held.slideHeld || c.slidePrelandTicks > 0) &&
          this.acceptSlideLandingChain(player, c, input);
        if (!chained) c.slideHopBuffered = false;
      }
    }
    if (landingStance !== STANCE_NONE && landingStance !== STANCE_SLIDE)
      this.cancelMoveStance(player, c, false);
    c.poundUsed = false;
  }

  private applyPoundImpact(player: PlayerState, c: CombatState): void {
    const damage = poundDamage(c.poundTriggerHeight);
    this.detonate(
      player.x,
      player.y,
      POUND_RADIUS,
      damage,
      0,
      player.id,
      "pound",
      CombatDelivery.Quake,
    );
    player.poundSeq = (player.poundSeq + 1) & 0xff;

    const r2 = POUND_RADIUS * POUND_RADIUS;
    this.enemyGrid.queryRadius(player.x, player.y, POUND_RADIUS, this.enemyCandidates);
    for (const id of this.enemyCandidates) {
      if (id === this.bossId || this.enemyCommittedAttack(id)) continue; // bosses take damage only
      const enemy = this.state.enemies.get(id);
      if (!enemy) continue;
      let dx = enemy.x - player.x;
      let dy = enemy.y - player.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;
      const d = Math.sqrt(d2);
      if (d > 1e-4) {
        dx /= d;
        dy /= d;
      } else {
        dx = c.aimX;
        dy = c.aimY;
      }
      const existing = this.poundEnemyEffects.get(id);
      const impulse = addImpulse(
        existing ?? ZERO_IMPULSE,
        dx * POUND_KNOCKBACK_SPEED,
        dy * POUND_KNOCKBACK_SPEED,
      );
      const impulseSpeed = Math.hypot(impulse.vx, impulse.vy);
      if (impulseSpeed > POUND_KNOCKBACK_SPEED) {
        impulse.vx = (impulse.vx / impulseSpeed) * POUND_KNOCKBACK_SPEED;
        impulse.vy = (impulse.vy / impulseSpeed) * POUND_KNOCKBACK_SPEED;
      }
      if (existing) {
        existing.vx = impulse.vx;
        existing.vy = impulse.vy;
        existing.staggerT = Math.max(existing.staggerT, POUND_STAGGER_SECONDS);
      } else {
        this.poundEnemyEffects.set(id, {
          vx: impulse.vx,
          vy: impulse.vy,
          staggerT: POUND_STAGGER_SECONDS,
        });
      }
    }
  }

  private enemyCommittedAttack(id: string): boolean {
    const combo = this.comboState.get(id);
    return combo?.phase === "windup" && !!combo.strike;
  }

  /** Decaying 260px/s shove totals <40px and refuses the one step that would cross a ground→pit edge. */
  private stepPoundEnemyEffects(dt: number): void {
    const decay = Math.exp(-IMPULSE_FRICTION * dt);
    for (const [id, fx] of this.poundEnemyEffects) {
      const enemy = this.state.enemies.get(id);
      if (!enemy || fx.staggerT <= 0) {
        this.poundEnemyEffects.delete(id);
        continue;
      }
      const kind = ENEMY_KINDS[enemy.kind];
      const radius = kind?.radius ?? ENEMY_RADIUS;
      const nextX = clamp(enemy.x + fx.vx * dt, radius, ARENA_WIDTH - radius);
      const nextY = clamp(enemy.y + fx.vy * dt, radius, ARENA_HEIGHT - radius);
      const currentlyOverPit =
        this.belt && this.beltLevel
          ? beltPitAtX(this.beltLevel, enemy.x)
          : !this.belt && isPitAtPx(this.map, enemy.x, enemy.y);
      const nextOverPit =
        this.belt && this.beltLevel
          ? beltPitAtX(this.beltLevel, nextX)
          : !this.belt && isPitAtPx(this.map, nextX, nextY);
      if (!currentlyOverPit && nextOverPit) {
        fx.vx = 0;
        fx.vy = 0;
      } else {
        enemy.x = nextX;
        enemy.y = nextY;
        fx.vx *= decay;
        fx.vy *= decay;
        this.updateEnemyGrid(id, enemy);
      }
      fx.staggerT = Math.max(0, fx.staggerT - dt);
    }
  }

  /** Write into the fixed v18 ring. Every field comes from the accepted source epoch, never proximity. */
  private writeCombatReceipt(
    targetId: string,
    targetX: number,
    targetY: number,
    sourcePlayerId: string,
    sourceWeaponId: string,
    delivery: number,
    sourceX: number,
    sourceY: number,
    damage: number,
    crit: boolean,
    finalBlow: boolean,
  ): void {
    const target = this.state.enemies.get(targetId);
    const sourceCombat = this.combat.get(sourcePlayerId);
    if (
      sourceCombat &&
      ((target !== undefined && target.kind !== "dummy") || targetId.startsWith("worm:"))
    ) this.markWeaponResourcePressure(sourceCombat);
    if (!sourcePlayerId || this.state.combatReceipts.length === 0) return;
    const row = this.state.combatReceipts[this.combatReceiptCursor];
    if (!row) return;
    this.combatReceiptCursor = (this.combatReceiptCursor + 1) % this.state.combatReceipts.length;
    this.combatReceiptSeq = (this.combatReceiptSeq + 1) >>> 0;
    if (this.combatReceiptSeq === 0) this.combatReceiptSeq = 1;
    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    const len = Math.hypot(dx, dy);
    row.seq = this.combatReceiptSeq;
    row.tick = this.state.tick;
    row.targetId = targetId;
    row.sourcePlayerId = sourcePlayerId;
    row.weaponId = sourceWeaponId;
    row.delivery = delivery;
    row.element = WEAPONS[sourceWeaponId]?.tags.element ?? "physical";
    row.dirX = len > 1e-6 ? dx / len : 0;
    row.dirY = len > 1e-6 ? dy / len : 0;
    row.damage = Math.max(0, damage);
    row.crit = crit;
    row.finalBlow = finalBlow;
  }

  /** Mirror the precise, non-serialized timer as integer deciseconds. Ceil keeps the bar visible until the
   *  authoritative timeout and limits patches to 10Hz instead of every 20Hz simulation step. */
  private syncFlexTimer(player: PlayerState): void {
    const deciseconds = Math.max(0, Math.min(0xffff, Math.ceil(player.flexTimer * 10 - 1e-9)));
    if (player.flexTimerDs !== deciseconds) player.flexTimerDs = deciseconds;
  }

  /** Advance the precise, non-serialized run clock and patch only when its whole-second projection changes. */
  private advanceElapsed(dt: number): void {
    this.state.elapsed += dt;
    const seconds = Math.max(0, Math.floor(this.state.elapsed));
    if (this.state.elapsedSeconds !== seconds) this.state.elapsedSeconds = seconds;
  }

  private resetElapsed(): void {
    this.state.elapsed = 0;
    this.state.elapsedSeconds = 0;
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
    if (stepped) {
      this.broadcastPatch();
      this.broadcastGeneration++;
    }
  }

  /** One EXACT 50ms authoritative sub-step. The hand-numbered phase order is a CONTRACT (golden test). */
  private stepSim(dt: number): void {
    // Production maps keep immutable POIs. Authored test/dev maps may replace that geometry after mapgen;
    // refresh once at the mutation boundary, never in the steady collision hot path.
    if (this.map.poiCollisionIndex.sourcePoiCount !== this.map.pois.length)
      this.map.poiCollisionIndex = new PoiCollisionIndex(
        this.map.pois,
        this.map.cols * this.map.tileSize,
        this.map.rows * this.map.tileSize,
      );
    // 0. §4 v0.107 the sim-tick counter (the snapshot timeline) + per-tick input plumbing: refill each
    //    player's message budget, then consume toward ONE command per sub-step for EVERY player — alive,
    //    downed, or frozen (review #3: consumption must never stall, or queues pin at cap during a level
    //    window and replay ~400ms of stale directions on resume). A backlog drains by jumping straight to
    //    the NEWEST command (input only sets direction; the ack jump is client-safe by design).
    this.state.tick = (this.state.tick + 1) >>> 0;
    this.advancePetPresence(dt);
    this.state.players.forEach((player, id) => {
      // The wire latch derives only from accepted attack epochs. Wrap-safe uint32 subtraction keeps the
      // short window correct across ArenaState.tick rollover; write only on the true→false lapse edge.
      if (
        player.attackHeld &&
        ((this.state.tick - player.attackTick) >>> 0) >= ATTACK_HELD_WINDOW
      ) {
        player.attackHeld = false;
      }
      const input = this.inputs.get(id);
      if (!input) return;
      const tickCombat = this.combat.get(id);
      if (tickCombat) tickCombat.ultAccrualThisTick = 0;
      input.msgBudget = INPUT_MSGS_PER_TICK;
      input.actionBudget = ACTION_MSGS_PER_TICK; // §44 refill the action budget alongside input's
      let cmd: InputCmd | undefined;
      const queuedCount = input.queue.length;
      if (queuedCount > 0) {
        cmd = input.queue[queuedCount - 1];
        if (cmd) {
          let fireWasHeld = input.held.fireHeld;
          let fireStartSeq = 0;
          for (let queuedIndex = 0; queuedIndex < queuedCount; queuedIndex++) {
            const queued = input.queue[queuedIndex];
            if (!queued) continue;
            if (queued.fireHeld && !fireWasHeld && fireStartSeq === 0)
              fireStartSeq = queued.seq;
            fireWasHeld = queued.fireHeld;
            if (queuedIndex === queuedCount - 1) continue;
            // Drain-to-newest still consumes one fixed-step sample, but transport-only extras cannot erase
            // one-shot edges merely because a heartbeat arrived later in the same server interval.
            cmd.jump ||= queued.jump;
            cmd.pound ||= queued.pound;
            cmd.slide ||= queued.slide;
          }
          cmd.fireStartSeq = cmd.fireHeld ? fireStartSeq || cmd.fireStartSeq || cmd.seq : 0;
        }
        input.queue.length = 0;
      }
      if (cmd) {
        input.held = cmd;
        input.lastFreshFireTick = this.state.tick;
        player.ackSeq = cmd.seq;
        const beamAim = this.combat.get(id);
        if (beamAim) {
          const aimLength = Math.hypot(cmd.aimX, cmd.aimY);
          if (aimLength > 1e-4) {
            beamAim.aimX = cmd.aimX / aimLength;
            beamAim.aimY = cmd.aimY / aimLength;
          }
          beamAim.targetX = Number.isFinite(cmd.targetX)
            ? cmd.targetX
            : player.x + beamAim.aimX;
          beamAim.targetY = Number.isFinite(cmd.targetY)
            ? cmd.targetY
            : player.y + beamAim.aimY;
          player.aimDir = Math.atan2(beamAim.aimY, beamAim.aimX);
        }
        // The jump intent rides the command (review #5) — same buffered-jump semantics as the SPACE
        // message (the consume gate re-checks grounded/cooldown/alive/level-window).
        if (cmd.jump) {
          const c = this.combat.get(id);
          if (c) {
            if (c.stance === STANCE_SLIDE && c.slidePhase === SLIDE_PHASE_GROUND) {
              if (c.slidePhaseTick < SLIDE_HOP_MIN_TICK) c.slideHopBuffered = true;
              else if (c.slidePhaseTick <= SLIDE_HOP_MAX_TICK) this.launchSlideHop(player, c);
              else c.jumpBuffer = JUMP_BUFFER_SECONDS;
            } else {
              c.jumpBuffer = JUMP_BUFFER_SECONDS;
            }
          }
        }
        const stance = this.combat.get(id);
        if (stance) this.consumeMoveStanceInput(player, input, stance, cmd);
      }
    });
    // §6 TERMINAL HOLD: keep input acknowledgements/action budgets alive so the host can restart, but retire
    // any combat entity an out-of-band action tried to create and skip every movement/AI/damage machine.
    if (this.state.outcome !== "active") {
      this.clearCombatEntities();
      return;
    }
    this.stepVastagharAddBudget();
    this.rebuildEnemyGrid(); // §45 exactly once/ACTIVE sub-step; later enemy motion updates cell membership
    // QOL-02: accepted standard/slide-hop launches own the tick before horizontal displacement or the pit
    // sample. This phase also advances their cooldown/buffer clocks exactly once for the fixed step.
    this.stepTraversalLaunches(dt);

    // 1. Integrate each LIVING player's authoritative movement from their held input command.
    //    A player in the §12 level-up window (flexPending) is frozen so they can pick safely.
    this.state.players.forEach((player, id) => {
      const input = this.inputs.get(id);
      if (!input) return;
      if (!player.alive || this.inLevelWindow(player)) {
        const frozenCombat = this.combat.get(id);
        if (frozenCombat) this.cancelMoveStance(player, frozenCombat, true);
        // §7 a freeze/down is an INTENTIONAL stop — zero the steering velocity so the player doesn't
        // glide on a stale heading when they resume (same bug class as the v0.105 tryRez fix), and keep
        // the synced mirror coherent for the predicting client.
        input.mvx = 0;
        input.mvy = 0;
        player.mvx = 0;
        player.mvy = 0;
        return;
      }
      if (this.ultimateOwnsMovement(player)) {
        input.mvx = 0;
        input.mvy = 0;
        player.mvx = 0;
        player.mvy = 0;
        return;
      }
      // §7 v0.105 STEERED movement (course correction): the velocity blends toward the input's target,
      // so forward→up sweeps through the diagonal, taps ease in, releases ease out — no more snap-turns.
      // §29 belt mode confines DEPTH (y) to the shallow band; the client predictor passes identical bounds.
      const beamRuntime = this.combat.get(id);
      if (
        beamRuntime?.stance === STANCE_SLIDE &&
        input.held.fireHeld &&
        beamRuntime.slidePhaseTick * (TICK_MS / 1000) + 1e-9 >= SLIDE_ATTACK_CANCEL_SECONDS
      ) {
        this.cancelMoveStance(player, beamRuntime, true);
      }
      const channelSpeed = beamRuntime?.beamDescriptor
        ? MOVE_SPEED *
          (beamRuntime.beamPhase === 1
            ? beamRuntime.beamDescriptor.chargeMoveMul
            : beamRuntime.beamPhase === 2
              ? beamRuntime.beamDescriptor.channelMoveMul
              : 1)
        : MOVE_SPEED;
      const beamSpeed =
        player.ultPhase === UltimatePhase.Windup &&
        ultimateFamilyForCode(player.ultArchetype) === UltimateFamily.SunspiteComet
          ? channelSpeed * 0.55
          : channelSpeed;
      let nextX: number;
      let nextY: number;
      let slideSpeed = 0;
      const activeSlide =
        beamRuntime?.stance === STANCE_SLIDE &&
        (beamRuntime.slidePhase === SLIDE_PHASE_GROUND ||
          beamRuntime.slidePhase === SLIDE_PHASE_AIR);
      if (beamRuntime?.stance === STANCE_DASH || activeSlide) {
        if (beamRuntime?.stance === STANCE_DASH) {
          this.steerDistanceJump(beamRuntime, input.held, dt);
          input.mvx = beamRuntime.dashDirX * beamRuntime.dashSpeed;
          input.mvy = beamRuntime.dashDirY * beamRuntime.dashSpeed;
        } else if (beamRuntime) {
          slideSpeed = clampSlideSpeed(Math.hypot(beamRuntime.momentumX, beamRuntime.momentumY));
          if (slideSpeed <= 1e-4) {
            this.cancelMoveStance(player, beamRuntime, false);
            input.mvx = 0;
            input.mvy = 0;
          } else {
            const angle = slideSteeredAngle(
              beamRuntime.momentumX,
              beamRuntime.momentumY,
              input.held.dx,
              input.held.dy,
              dt,
              beamRuntime.slidePhase === SLIDE_PHASE_AIR,
            );
            beamRuntime.momentumX = Math.cos(angle) * slideSpeed;
            beamRuntime.momentumY = Math.sin(angle) * slideSpeed;
            input.mvx = beamRuntime.momentumX;
            input.mvy = beamRuntime.momentumY;
            beamRuntime.slideStepStartX = player.x;
            beamRuntime.slideStepStartY = player.y;
          }
        }
        nextX = clamp(player.x + input.mvx * dt, PLAYER_RADIUS, ARENA_WIDTH - PLAYER_RADIUS);
        nextY = clamp(
          player.y + input.mvy * dt,
          this.belt ? BELT_Y0 : PLAYER_RADIUS,
          this.belt ? BELT_Y0 + DEPTH_MAX : ARENA_HEIGHT - PLAYER_RADIUS,
        );
        if (activeSlide && beamRuntime?.stance === STANCE_SLIDE) {
          if (beamRuntime.slidePhase === SLIDE_PHASE_GROUND) {
            const nextSpeed = slideGroundNextSpeed(slideSpeed);
            const scale = slideSpeed > 1e-4 ? nextSpeed / slideSpeed : 0;
            beamRuntime.momentumX *= scale;
            beamRuntime.momentumY *= scale;
          }
          beamRuntime.slidePhaseTick++;
          input.mvx = beamRuntime.momentumX;
          input.mvy = beamRuntime.momentumY;
        }
      } else {
        const rooted =
          beamRuntime?.stance === STANCE_CROUCH ||
          beamRuntime?.stance === STANCE_POUND ||
          (beamRuntime?.recoveryT ?? 0) > 0;
        const next = this.belt
          ? stepSteeredMovement(
              player,
              { vx: input.mvx, vy: input.mvy },
              rooted ? ZERO_MOVE_INPUT : input.held,
              dt,
              beamSpeed,
              BELT_Y0,
              BELT_Y0 + DEPTH_MAX,
            )
          : stepSteeredMovement(
              player,
              { vx: input.mvx, vy: input.mvy },
              rooted ? ZERO_MOVE_INPUT : input.held,
              dt,
              beamSpeed,
            );
        input.mvx = next.vx;
        input.mvy = next.vy;
        nextX = next.x;
        nextY = next.y;
      }
      // §4 v0.107 mirror the steering velocity onto synced state — the owning client REBASES its
      // prediction from these at every patch (review #2: local-history reconstruction breaks under
      // queue starvation/drain, so the server publishes the truth instead).
      player.mvx = input.mvx;
      player.mvy = input.mvy;
      // §20 momentum layer (Stage A): integrate the impulse shove (recoil / knockback) on top of WASD,
      // then decay it. The authoritative position is the input base PLUS the shove.
      player.x = nextX;
      player.y = nextY;
      const imp = stepImpulse(player, player, dt);
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
      if (
        player.ultPhase === UltimatePhase.Active &&
        ultimateFamilyForCode(player.ultArchetype) === UltimateFamily.AlphaStrike
      ) return;
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
        const r = resolvePoiCollisionInto(
          this.map,
          player.x,
          player.y,
          PLAYER_RADIUS,
          this.poiResolveScratch,
        );
        player.x = r.x;
        player.y = r.y;
      });
    }

    // Collision may only remove renewable carry. The post-solver displacement can never refill it from
    // hostile impulse/body separation, and a head-on result below the entry floor breaks the sentence.
    this.state.players.forEach((player, id) => {
      const c = this.combat.get(id);
      if (
        !c ||
        c.stance !== STANCE_SLIDE ||
        (c.slidePhase !== SLIDE_PHASE_GROUND && c.slidePhase !== SLIDE_PHASE_AIR)
      ) return;
      const authoredSpeed = Math.hypot(c.momentumX, c.momentumY);
      const actualSpeed = Math.hypot(
        player.x - c.slideStepStartX,
        player.y - c.slideStepStartY,
      ) / dt;
      if (actualSpeed + 1 < authoredSpeed) {
        const retained = Math.min(authoredSpeed, actualSpeed);
        if (retained < SLIDE_ENTRY_SPEED) {
          this.cancelMoveStance(player, c, false);
          return;
        }
        c.momentumX = (c.momentumX / authoredSpeed) * retained;
        c.momentumY = (c.momentumY / authoredSpeed) * retained;
        const input = this.inputs.get(id);
        if (input) {
          input.mvx = c.momentumX;
          input.mvy = c.momentumY;
          player.mvx = input.mvx;
          player.mvy = input.mvy;
        }
      }
    });

    // 2.5 §17 PITFALL — a GROUNDED player whose body is over a pit falls: chip damage + snap back to the
    // last solid tile + a brief grace (i-frames, no re-fall). An AIRBORNE player (mid-jump, §5) clears the
    // gap and is immune. We also remember the last grounded spot here so the snap-back has somewhere to go.
    this.state.players.forEach((player, id) => {
      if (!player.alive || this.inLevelWindow(player)) return;
      const c = this.combat.get(id);
      if (!c) return;
      if (c.augmentSnapshot !== player.augments) {
        c.augmentSnapshot = player.augments;
        c.beamVentStacks = countAugment(player.augments, "beam-vent");
        c.beamFocusStacks = countAugment(player.augments, "beam-focus");
      }
      if (c.pitGrace > 0) c.pitGrace = Math.max(0, c.pitGrace - dt);
      if (this.ultimateOwnsMovement(player)) return;
      if (
        player.height > GROUND_EPSILON ||
        c.vh > 0 ||
        (c.stance === STANCE_SLIDE && c.slidePhase === SLIDE_PHASE_AIR && c.vh > 0)
      ) return; // airborne (including the exact slide-hop launch tick) — the hop carries you over
      // §29 belt PITS — gaps in the deck; grounded-over-a-gap falls (chip + snap back to the edge you came
      // from), a jump clears it. Enemies (which can't jump) get kited in for free kills (5.6 below).
      if (this.belt && this.beltLevel) {
        if (!beltPitAtX(this.beltLevel, player.x)) {
          c.lastGroundX = player.x;
          return;
        }
        if (c.pitGrace > 0) return;
        this.damagePitFall(player);
        player.x = beltSafeX(this.beltLevel, player.x, c.lastGroundX);
        c.lastGroundX = player.x;
        c.pitGrace = PIT_FALL_GRACE;
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
      this.damagePitFall(player);
      const safe = isPitAtPx(this.map, c.lastGroundX, c.lastGroundY)
        ? nearestGroundPx(this.map, player.x, player.y)
        : { x: c.lastGroundX, y: c.lastGroundY };
      player.x = safe.x;
      player.y = safe.y;
      c.lastGroundX = safe.x;
      c.lastGroundY = safe.y;
      c.pitGrace = PIT_FALL_GRACE;
      this.zeroMoveVel(id); // §7 the snap-back is a teleport — carried steering would glide you back in
      player.fellSeq++;
    });

    // 2.7 XP Echoes: movement establishes Reach first; arrival grants before level-window ticking. Fresh
    // kills later in this sub-step begin their mandatory pop/read window and are considered next tick.
    this.stepVastagharVictory();
    this.stepXpEchoes();
    if (this.xpBoundary) return; // committed cleanup freezes new pressure until the visible squad receipt

    // 3. Run clock + spawn director (§6) — survival mode only. `bodies` = living players.
    if (this.state.mode === "arena") {
      if (this.state.outcome === "active") {
        this.advanceElapsed(dt);
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
          if (!this.state.portalOpen && !this.vastagharEncounter) this.runSpawnDirector(dt, bodies);
          // §17 cross-dimensional SHIFTER incursions (roaming invaders) — phase one in on a timer, phase it
          // out if it survives its window. Combat is the generic archetype AI (spitter/duelist), so this just
          // owns lifecycle.
          if (!this.vastagharEncounter) this.stepShifters(dt, bodies);
          this.checkExtraction(bodies, dt);
          this.checkDescend(dt, bodies); // §6 chain (v0.103): the rift channel — the other half of the choice
        }
      }
    } else if (this.state.mode === "bossrush") {
      // §16 v0.116 BOSS RUSH — no horde, no boss clock: just count down the breather and drop the next boss.
      // The gauntlet advances in `advanceBossRush` (called from the boss death path).
      if (this.state.outcome === "active") {
        this.advanceElapsed(dt);
        if (this.bossRushNextTimer > 0) {
          this.bossRushNextTimer -= dt;
          if (this.bossRushNextTimer <= 0) this.spawnBossRushBoss();
        }
      }
    }
    // §6 belt-final/extraction victories can resolve inside phase 3; do not fall through into combat phases.
    if (this.state.outcome !== "active") return;

    // 3b. Pickups are grabbed with the R key now (§13 `grabWeapon`), not walk-over — here we just age the
    // per-DROP grace window (a just-dropped weapon can't be re-grabbed until it expires).
    for (const [pid, t] of this.pickupGrace) {
      const left = t - dt;
      if (left <= 0 || !this.state.pickups.has(pid)) this.pickupGrace.delete(pid);
      else this.pickupGrace.set(pid, left);
    }

    // 4. Compute one simultaneous Drive credit, then let every accepted fire path accumulate through the
    // single spend seam. A second pass commits the private float and its floored schema mirror.
    this.state.players.forEach((player, id) => {
      const c = this.combat.get(id);
      if (c) this.beginWeaponResourceTick(player, c, dt);
    });

    // Resolve attacks (cooldown-gated). All deliveries spend the shared bar before creating effects.
    this.state.players.forEach((player, id) => {
      const c = this.combat.get(id);
      if (!c) return;
      // Allow ONE tick of negative so an accumulating cooldown (guns, below) carries its sub-tick
      // remainder across the 20Hz grid — otherwise a 0.08s fire-rate quantises to 0.10s (a silent ~20%
      // DPS loss on fast autos). Resetting weapons (melee/thrown) clamp to 0 effectively (they set `= cd`).
      c.cd = Math.max(-dt, c.cd - dt);
      c.drawLock = Math.max(0, c.drawLock - dt);
      c.handGate = Math.max(-dt, c.handGate - dt);
      this.stepStowedWeaponResources(player, c, dt);
      c.invuln = Math.max(0, c.invuln - dt);
      c.juggleMercy = Math.max(0, c.juggleMercy - dt); // §51 G10 touchdown mercy ages out
      c.parryCd = Math.max(0, c.parryCd - dt);
      if (!c.mods.parryChainNeverExpires) {
        c.parryChainT = Math.max(0, c.parryChainT - dt);
        if (c.parryChainT <= 0) c.parryChain = 0;
      }
      c.distJumpCd = Math.max(0, c.distJumpCd - dt);
      c.recoveryT = Math.max(0, c.recoveryT - dt);
      c.slideParryLockT = Math.max(0, c.slideParryLockT - dt);
      if (c.slideParryLockT <= 1e-9) c.slideParryLockT = 0;
      // §7 v0.105 de-clunk: age the queued-input buffers, then fire any that the cooldown has just cleared.
      c.attackBuffer = Math.max(0, c.attackBuffer - dt);
      c.parryBuffer = Math.max(0, c.parryBuffer - dt);
      const acting =
        this.state.outcome === "active" &&
        player.alive &&
        !this.inLevelWindow(player) &&
        player.ultPhase === UltimatePhase.Idle;
      // BUFFERED PARRY — a press that arrived on cooldown fires the instant the cd drains.
      if (
        acting &&
        c.recoveryT <= 0 &&
        c.slideParryLockT <= 0 &&
        c.parryBuffer > 0 &&
        c.parryCd <= 0
      ) {
        c.parryBuffer = 0;
        this.executeParry(player, c);
      }
      const slideColdCandidate = c.stance === STANCE_NONE;
      if (acting) this.stepCrouchStance(player, c, this.inputs.get(id), dt);
      if (acting) this.stepSlideStance(player, c);
      // §5/§20 (Stage B): integrate the real height axis. Pound owns a gather + constant-speed descent;
      // every other cause shares the exact three-zone gravity stepper.
      const wasAirborne = player.height > GROUND_EPSILON; // §51 G10: sampled before the integration edge
      const impactVh = c.vh;
      const landingStance = c.stance;
      if (c.stance === STANCE_POUND) {
        if (c.poundGatherT > 0) {
          c.poundGatherT = Math.max(0, c.poundGatherT - dt);
          c.vh = c.poundGatherT <= 0 ? -POUND_SPEED : 0;
        } else {
          c.vh = -POUND_SPEED;
          player.height = Math.max(0, player.height - POUND_SPEED * dt);
          if (player.height <= GROUND_EPSILON) {
            player.height = 0;
            c.vh = 0;
          }
        }
      } else {
        const vert = stepVertical(player.height, c.vh, dt);
        player.height = vert.height;
        c.vh = vert.vh;
      }
      player.vh = c.vh; // §4 v0.107 synced mirror — the predicting client rebases its jump arc exactly
      const landed = wasAirborne && player.height <= GROUND_EPSILON;
      if (landed) this.finishPlayerLanding(player, c, landingStance, impactVh);
      const moveInput = this.inputs.get(id);
      if (!c.slideColdArmed) {
        const qualifying =
          slideColdCandidate &&
          c.stance === STANCE_NONE &&
          player.height <= GROUND_EPSILON &&
          c.recoveryT <= 0 &&
          c.pitGrace <= 0 &&
          !!moveInput &&
          Math.hypot(moveInput.held.dx, moveInput.held.dy) > 1e-4 &&
          Math.hypot(moveInput.mvx, moveInput.mvy) + 1e-9 >= SLIDE_ENTRY_SPEED;
        c.slideColdRearmTicks = qualifying ? c.slideColdRearmTicks + 1 : 0;
        if (c.slideColdRearmTicks >= SLIDE_COLD_REARM_TICKS) {
          c.slideColdArmed = true;
          c.slideColdRearmTicks = SLIDE_COLD_REARM_TICKS;
        }
      }
      this.syncSlideWire(player, c);
      // §51 G10 landing mercy: an enemy-initiated launch (juggle) that returns to ground grants a brief
      // melee/contact immunity — armed ONLY by the launcher hit, never by the player's own jumps.
      if (c.juggleArmed && landed) {
        c.juggleArmed = false;
        c.juggleMercy = Math.max(c.juggleMercy, JUGGLE_LANDING_MERCY);
      }
      const weapon = WEAPONS[player.weapon] ?? WEAPONS[DEFAULT_WEAPON];

      // Restore the identity-local cadence row when the equipped weapon changes. Drive stays player-global;
      // legacy ammo, charge, and reload schema slots remain zeroed tombstones.
      if (c.lastWeapon !== player.weapon) {
        // Direct server-side identity edits (tests/dev setup) restore debt but are not a player quick-swap.
        // Network-reachable swap handlers apply the shared draw gate at the transition edge above.
        this.transitionWeapon(player, c, false, false);
      }

      let offSlot = this.pairedOffSlot(player, c);
      if (player.offhandSlot !== 255 && !offSlot) {
        this.dissolvePair(player, c);
        offSlot = undefined;
      }
      if (offSlot) this.stepPairedOffWeaponResources(player, offSlot, dt);

      if (weapon?.beam) {
        c.attackBuffer = 0;
        this.stepPlayerBeam(player, id, c, weapon, dt, acting && c.stance !== STANCE_SLIDE);
        return;
      }
      const nonBeamHeld = this.beamHeld(id);
      if (!nonBeamHeld) c.drive.beamRequireRelease = false;
      c.beamInputWasHeld = nonBeamHeld;
      this.state.beams.delete(id);

      // §7 v0.105 de-clunk: a BUFFERED attack is live while its window hasn't decayed; the tick fires it the
      // instant the cooldown drains (a press one tick early is honoured, not eaten), and consuming it zeroes
      // the buffer so it can't double-fire. A held trigger re-arms the buffer each client cooldown.
      if (offSlot) {
        const leadWeapon = weapon!;
        const offWeapon = WEAPONS[offSlot.weapon]!;

        let pairStep = -1;
        let hand: DualWieldHand;
        if (!leadWeapon.gun && !leadWeapon.cast) {
          pairStep = this.nextPairMeleeStep(player, c);
          hand = this.pairMeleeServerHand(pairStep);
        } else {
          hand = dualHandForSeq((player.attackSeq + 1) >>> 0, player.pairBaseSeq);
        }

        const pairCanAct =
          acting &&
          c.stance !== STANCE_SLIDE &&
          c.attackBuffer > 0 &&
          c.drawLock <= 0 &&
          c.handGate <= 0 &&
          this.handCooldown(c, offSlot, hand) <= 0;
        if (pairCanAct) {
          this.resolveHandAttack(player, c, hand, offSlot, pairStep, false);
        }
        return;
      }

      const canAct =
        acting &&
        c.stance !== STANCE_SLIDE &&
        c.attackBuffer > 0 &&
        c.cd <= 0 &&
        c.drawLock <= 0;
      // §10 v0.104: the single Terraria affix can speed up / slow down the held weapon (Swift/Heavy…).
      const cdMul = lootCooldownMult(player.weaponAffix);
      if (weapon?.gun) {
        // Schema-30 gun cadence survives; magazines/reload are authoring-only inputs to the Drive formula.
        if (canAct) {
          c.attackBuffer = 0;
          const cooldown = weapon.gun.fireRate * cdMul * this.weaponRecoveryMult(player, weapon);
          const interval = effectiveAcceptedWeaponInterval(weapon, cooldown);
          const instanceId = player.slots[player.activeSlot]?.instanceId || weapon.id;
          if (this.trySpendWeaponResource(
            player, c, weapon, instanceId, CombatDelivery.Gun, 0, interval, 1, 0, "tap",
          ).accepted) {
            this.stampAttackBeat(player);
            this.fireGun(player, c, weapon);
            c.cd += cooldown; // accumulating cadence carries its sub-tick remainder
          }
        }
      } else if (weapon?.thrown) {
        if (canAct) {
          c.attackBuffer = 0;
          const cooldown = weapon.cooldown * cdMul * this.weaponRecoveryMult(player, weapon);
          const interval = effectiveAcceptedWeaponInterval(weapon, cooldown);
          const instanceId = player.slots[player.activeSlot]?.instanceId || weapon.id;
          if (this.trySpendWeaponResource(
            player, c, weapon, instanceId, CombatDelivery.Thrown, 0, interval, 1, 0, "tap",
          ).accepted) {
            this.stampAttackBeat(player);
            this.throwWeapon(player, c, weapon);
            c.cd = cooldown;
          }
        }
      } else if (weapon?.cast) {
        // §38 CASTER: conjure a piercing arcane bolt on a flat cooldown (no ammo/reload) — INT-scaled.
        if (canAct) {
          c.attackBuffer = 0;
          const cooldown = weapon.cast.cooldown * cdMul * this.weaponRecoveryMult(player, weapon);
          const interval = effectiveAcceptedWeaponInterval(weapon, cooldown);
          const instanceId = player.slots[player.activeSlot]?.instanceId || weapon.id;
          if (this.trySpendWeaponResource(
            player, c, weapon, instanceId, CombatDelivery.Cast, 0, interval, 1, 0, "tap",
          ).accepted) {
            this.stampAttackBeat(player);
            this.fireCast(player, c, weapon);
            c.cd = cooldown;
          }
        }
      } else if (weapon && canAct) {
        c.attackBuffer = 0;
        // §44 AUTHORITATIVE EPOCH: construct exactly once when `canAct` accepts — never on message arrival.
        // Client prediction starts from local send until a later swing-seq protocol can reconcile buffering.
        const swing = swingDescriptorFor(
          weapon,
          weapon.cooldown * cdMul * this.weaponRecoveryMult(player, weapon),
        );
        const interval = effectiveAcceptedWeaponInterval(weapon, swing.effectiveCooldown);
        const instanceId = player.slots[player.activeSlot]?.instanceId || weapon.id;
        if (this.trySpendWeaponResource(
          player, c, weapon, instanceId, CombatDelivery.Melee, 0, interval, 1, 0, "tap",
        ).accepted) {
          this.stampAttackBeat(player);
          this.resolveSwing(player, c, weapon, swing);
          c.cd = swing.effectiveCooldown; // flat cooldown — DEX scales DAMAGE; loot affix owns speed
        }
      }
    });
    // §6 a synchronous player hit can clear the last boss-rush round from inside resolveSwing.
    if (this.state.outcome !== "active") {
      this.clearCombatEntities();
      return;
    }

    // 4.6 §20 advance in-flight swept melee blades (edge damage over the swing's active window).
    this.stepMeleeSwings(dt);
    if (this.state.outcome !== "active") {
      this.clearCombatEntities();
      return;
    }
    // 4.65 §40.2 detonate quakes whose blade has LANDED (delay captured at swing time; see resolveSwing).
    for (let i = this.pendingQuakes.length - 1; i >= 0; i--) {
      const q = this.pendingQuakes[i];
      if (!q) continue;
      q.t -= dt;
      if (q.t <= 0) {
        this.detonate(
          q.x,
          q.y,
          q.radius,
          q.damage,
          q.crit,
          q.sourcePlayerId,
          q.sourceWeaponId,
          CombatDelivery.Quake,
        );
        this.pendingQuakes.splice(i, 1);
      }
    }

    // 4.7 §ULT immutable-epoch action machines settle before enemy targeting reads player positions.
    this.stepUltimates(dt);
    if (this.state.outcome !== "active") {
      this.clearCombatEntities();
      return;
    }
    // `bodies` was captured before phase 4.7; remove a just-resolved Alpha Strike on this same tick so
    // duelists/spitters cannot aim at the newly untargetable body for one stale frame.
    for (let i = ids.length - 1; i >= 0; i--) {
      const id = ids[i]!;
      const player = this.state.players.get(id);
      if (
        player?.ultPhase === UltimatePhase.Active &&
        ultimateFamilyForCode(player.ultArchetype) === UltimateFamily.AlphaStrike
      ) {
        ids.splice(i, 1);
        bodies.splice(i, 1);
      }
    }

    // 5. Enemy AI — melee archetypes rush the nearest LIVING drifter; spitters KITE (§15). Duelists
    // (kind.melee) move + attack in stepDuelists, so they're skipped here.
    for (const id of [...this.dodgeState.keys()]) {
      if (!this.state.enemies.has(id)) this.dodgeState.delete(id);
    }
    this.stepPoundEnemyEffects(dt);
    this.state.enemies.forEach((enemy, id) => {
      const kind = ENEMY_KINDS[enemy.kind];
      if (this.poundEnemyEffects.has(id)) return; // stagger owns this tick; no AI movement/attack underneath
      // §20 lunge-enemies (duelists + the derived rusher/swarm/zoner lunge) move via stepDuelists; this
      // generic pass only chases/kites the rest (ranged spitters kite). §16 v0.109 the boss is stepped by
      // its BossController (which owns movement), so skip it here to avoid a double-move.
      if (!kind || effectiveMelee(kind) || id === this.bossId) return;
      const target = this.nearestDoorDecoy(enemy) ?? nearestPoint(enemy, bodies);
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
          this.updateEnemyGrid(id, enemy);
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
      this.updateEnemyGrid(id, enemy);
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
    if (this.state.outcome !== "active") {
      this.clearCombatEntities();
      return;
    }
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
        const r = resolvePoiCollisionInto(
          this.map,
          enemy.x,
          enemy.y,
          ENEMY_KINDS[enemy.kind]?.radius ?? ENEMY_RADIUS,
          this.poiResolveScratch,
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
    for (const eid of fellIn) {
      this.state.enemies.delete(eid);
      // §51 pit cheese stays legal, but the dead choreography cannot leave a marker/token on the wire for
      // one extra patch. Terrain death cleans the same rows the next-tick reaper would have removed.
      const combo = this.comboState.get(eid);
      if (combo?.strike) this.removeTelegraphRow(combo.strike.tg);
      if (combo?.tg) this.removeTelegraphRow(combo.tg);
      if (combo?.targetId && this.duelTokens.get(combo.targetId) === eid)
        this.duelTokens.delete(combo.targetId);
      this.comboState.delete(eid);
    }

    // 6. Enemy contact damage (continuous DPS while touching a living player).
    this.state.enemies.forEach((enemy) => {
      if (enemy.id === this.bossId && this.bossController?.wormRuntime) return;
      if (
        enemy.id === this.bossId &&
        this.vastagharEncounter &&
        !this.vastagharEncounter.contactDamageEnabled(this.state.tick)
      ) return;
      const kind = ENEMY_KINDS[enemy.kind];
      if (!kind) return;
      this.state.players.forEach((player) => {
        if (!player.alive || this.inLevelWindow(player)) return; // invincible in the §12 level window
        const pcc = this.combat.get(player.id);
        if ((pcc?.invuln ?? 0) > 0) return; // parry i-frames
        if ((pcc?.juggleMercy ?? 0) > 0) return; // §51 G10 touchdown mercy — a juggle can't chain into the horde
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
          if (pcc && this.slideInvulnerable(pcc)) {
            this.noteSlideDodge(player);
            return;
          }
          this.damagePlayer(
            player,
            kind.contactDamage * dmgMul * depthDamageScale(this.state.depth) * dt,
            "enemy",
          );
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
        const c = this.combat.get(player.id);
        if (c) this.cancelMoveStance(player, c, true);
        player.alive = false; // DOWNED
        if (this.vastagharEncounter) this.vastagharDownTicks.set(player.id, this.state.tick);
        return;
      }
      anyAlive = true;
      const derivedCon = player.spreadSeeded ? spreadAdjustedCon(player.con) : player.con;
      const combat = this.combat.get(player.id);
      const pet = this.petRuns.get(player.id);
      const pitRegenMultiplier =
        pet && pet.tortoisePitRegenSeconds > 0 ? pet.mods.pitRegenMultiplier : 1;
      const regen =
        deriveStats({ con: derivedCon }).regen *
        (combat?.mods.regenMult ?? 1) *
        (pet?.mods.passiveRegenMultiplier ?? 1) *
        pitRegenMultiplier;
      player.hp = Math.min(player.maxHp, player.hp + regen * dt);
      if (pet && pet.tortoisePitRegenSeconds > 0) {
        pet.tortoisePitRegenSeconds = Math.max(0, pet.tortoisePitRegenSeconds - dt);
      }
    });
    // §6 WIPE: in a live run (survival OR boss rush), if there are players and NONE are still up, no one can
    // rez → the run is over.
    if (
      (this.state.mode === "arena" || this.state.mode === "bossrush") &&
      this.state.outcome === "active" &&
      this.state.players.size > 0 &&
      !anyAlive
    ) {
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
      this.enterTerminalOutcome("defeat");
      return;
    }

    // §8 Conflagration: fire any deferred burn re-pulses whose delay has elapsed (the "lingering" wave).
    for (let i = this.burnPulses.length - 1; i >= 0; i--) {
      const p = this.burnPulses[i];
      if (p && this.state.elapsed >= p.at) {
        this.emberguardWave(
          p.x,
          p.y,
          p.aimX,
          p.aimY,
          p.dmg,
          0,
          p.sourcePlayerId,
          p.sourceWeaponId,
        );
        this.burnPulses.splice(i, 1);
      }
    }
    // §8 Brand: precise durations stay server-private; the synced field changes only on apply/expiry.
    for (const [id, remaining] of this.brandedTimers) {
      const enemy = this.state.enemies.get(id);
      if (!enemy) {
        this.brandedTimers.delete(id);
        continue;
      }
      const left = remaining - dt;
      if (left > 0) {
        this.brandedTimers.set(id, left);
      } else {
        this.brandedTimers.delete(id);
        enemy.branded = 0;
      }
    }

    // 8. Tick the §12 level-up windows (auto-resolve a flex point + signature pick if the 5s timer runs out).
    this.tickLevelWindows(dt);
  }

  private ultimateOwnsMovement(player: PlayerState): boolean {
    if (player.ultPhase !== UltimatePhase.Active) return false;
    const family = ultimateFamilyForCode(player.ultArchetype);
    return (
      family === UltimateFamily.Seismarch ||
      family === UltimateFamily.AlphaStrike ||
      family === UltimateFamily.EventHorizon
    );
  }

  private nearestDoorDecoy(pos: Vec2): Vec2 | undefined {
    let best: Vec2 | undefined;
    let bestDistanceSq = ULT_DOOR_DECOY_RADIUS * ULT_DOOR_DECOY_RADIUS;
    for (const decoy of this.ultimateDecoys.values()) {
      if (decoy.detonated) continue;
      const distanceSq = (decoy.x - pos.x) ** 2 + (decoy.y - pos.y) ** 2;
      if (distanceSq > bestDistanceSq) continue;
      bestDistanceSq = distanceSq;
      best = decoy;
    }
    return best;
  }

  /** One postcondition for every blink/hop/dash endpoint: range, bounds, POI/deck, pit, gate. */
  private navValidDest(
    player: PlayerState,
    c: CombatState,
    targetX: number,
    targetY: number,
    maxRange: number,
  ): { x: number; y: number } {
    const ranged = Number.isFinite(maxRange)
      ? clampQuakeEpicenter(player, { x: targetX, y: targetY }, Math.max(0, maxRange))
      : { x: targetX, y: targetY };
    if (this.belt && this.beltLevel) {
      const right = (this.state.beltLockX > 0 ? this.state.beltLockX : this.beltLevel.length) - PLAYER_RADIUS;
      let x = clamp(ranged.x, PLAYER_RADIUS, right);
      x = beltSafeX(this.beltLevel, x, player.x);
      const obstacle = resolveBeltObstacles(
        this.beltLevel,
        x,
        clamp(ranged.y, BELT_Y0, BELT_Y0 + DEPTH_MAX),
        PLAYER_RADIUS,
      );
      x = Math.min(right, beltSafeX(this.beltLevel, obstacle.x, player.x));
      return { x, y: clampBeltFloorY(this.beltLevel, x, obstacle.y, PLAYER_RADIUS) };
    }
    let x = clamp(ranged.x, PLAYER_RADIUS, ARENA_WIDTH - PLAYER_RADIUS);
    let y = clamp(ranged.y, PLAYER_RADIUS, ARENA_HEIGHT - PLAYER_RADIUS);
    const poi = resolvePoiCollisionInto(this.map, x, y, PLAYER_RADIUS, this.poiResolveScratch);
    x = poi.x;
    y = poi.y;
    if (isPitAtPx(this.map, x, y)) {
      const safe = nearestGroundPx(this.map, x, y);
      x = safe.x;
      y = safe.y;
    }
    if (Number.isFinite(maxRange)) {
      const finalRange = clampQuakeEpicenter(player, { x, y }, Math.max(0, maxRange));
      x = clamp(finalRange.x, PLAYER_RADIUS, ARENA_WIDTH - PLAYER_RADIUS);
      y = clamp(finalRange.y, PLAYER_RADIUS, ARENA_HEIGHT - PLAYER_RADIUS);
      if (isPitAtPx(this.map, x, y)) {
        const safe = nearestGroundPx(this.map, x, y);
        x = safe.x;
        y = safe.y;
      }
    }
    return { x, y };
  }

  private ultimateTargetPosition(target: UltimateTarget): { x: number; y: number; radius: number } | null {
    if (target.slot >= 0) {
      const runtime = this.bossController?.wormRuntime;
      if (
        !runtime ||
        !runtime.isTargetable(target.slot) ||
        runtime.segmentGeneration(target.slot) !== target.generation
      ) return null;
      return {
        x: runtime.x[target.slot]!,
        y: runtime.y[target.slot]!,
        radius: runtime.segmentRadius(target.slot),
      };
    }
    const enemy = this.state.enemies.get(target.id);
    if (!enemy || enemy.hp <= 0 || (target.id === this.bossId && !!this.bossController?.wormRuntime))
      return null;
    return {
      x: enemy.x,
      y: enemy.y,
      radius: ENEMY_KINDS[enemy.kind]?.radius ?? ENEMY_RADIUS,
    };
  }

  /** SpatialGrid selection is nearest-first, exact-radius, immutable, and protocol-capped at five. */
  private selectAlphaTargets(player: PlayerState, maxTargets: number): UltimateTarget[] {
    this.ultimateTargetCandidates.length = 0;
    this.enemyGrid.queryRadius(player.x, player.y, ULT_ALPHA_RADIUS, this.enemyCandidates);
    const radiusSq = ULT_ALPHA_RADIUS * ULT_ALPHA_RADIUS;
    for (const id of this.enemyCandidates) {
      if (id === this.bossId && this.bossController?.wormRuntime) continue;
      const enemy = this.state.enemies.get(id);
      if (!enemy || enemy.hp <= 0) continue;
      const distanceSq = (enemy.x - player.x) ** 2 + (enemy.y - player.y) ** 2;
      if (distanceSq > radiusSq) continue;
      this.ultimateTargetCandidates.push({ id, slot: -1, generation: 0, distanceSq });
    }
    const worm = this.bossController?.wormRuntime;
    if (worm) {
      let wormTargets = 0;
      this.wormSegmentGrid.queryRadius(
        player.x,
        player.y,
        ULT_ALPHA_RADIUS + 52,
        this.wormSegmentCandidates,
      );
      for (const slot of this.wormSegmentCandidates) {
        if (wormTargets >= 2) break;
        if (!worm.isTargetable(slot)) continue;
        const distanceSq = (worm.x[slot]! - player.x) ** 2 + (worm.y[slot]! - player.y) ** 2;
        if (distanceSq > radiusSq) continue;
        const generation = worm.segmentGeneration(slot);
        this.ultimateTargetCandidates.push({
          id: `worm:${slot}:${generation}`,
          slot,
          generation,
          distanceSq,
        });
        wormTargets++;
      }
    }
    this.ultimateTargetCandidates.sort((a, b) => a.distanceSq - b.distanceSq);
    return this.ultimateTargetCandidates.splice(0, Math.min(ULT_ALPHA_MAX_TARGETS, maxTargets));
  }

  private acceptUltimate(player: PlayerState, c: CombatState): boolean {
    if (
      this.state.outcome !== "active" ||
      !player.alive ||
      this.inLevelWindow(player) ||
      c.juggleArmed ||
      c.recoveryT > 0 ||
      player.ultPhase !== UltimatePhase.Idle ||
      c.ult ||
      c.ultChargeF < 1 - 1e-9
    ) return false;
    const family = ultimateFamilyForCode(player.ultArchetype);
    const variant = player.ultVariant || ultimateVariantForCode(player.ultArchetype);
    if (family === UltimateFamily.Locked || !variant) return false;

    let targets: UltimateTarget[] = [];
    if (family === UltimateFamily.AlphaStrike) {
      const cap = variant === "str" ? Math.min(4, ULT_ALPHA_MAX_TARGETS) : ULT_ALPHA_MAX_TARGETS;
      targets = this.selectAlphaTargets(player, cap);
      if (targets.length === 0) return false;
    }
    if (c.beamPhase !== 0 || c.beamDescriptor) this.cancelBeam(player, player.id, c, true, false);
    if (c.stance !== STANCE_NONE) this.cancelMoveStance(player, c, true);

    const now = this.state.tick;
    let targetX = c.targetX;
    let targetY = c.targetY;
    let resolveTick = now;
    let activeEndTick = now;
    let endTick = now;
    const aim = this.aimDir(player, c);

    if (family === UltimateFamily.Seismarch) {
      const range = variant === "dex" ? ULT_SEISMARCH_DEX_RANGE : ULT_SEISMARCH_RANGE;
      const dest = this.navValidDest(player, c, targetX, targetY, range);
      targetX = dest.x;
      targetY = dest.y;
      resolveTick = (now + ULT_SEISMARCH_WINDUP_TICKS) >>> 0;
      activeEndTick = (resolveTick + ULT_SEISMARCH_AIR_TICKS) >>> 0;
      endTick = (activeEndTick + ULT_RECOVERY_TICKS) >>> 0;
    } else if (family === UltimateFamily.AlphaStrike) {
      const first = this.ultimateTargetPosition(targets[0]!);
      if (!first) return false;
      targetX = first.x;
      targetY = first.y;
      resolveTick = (now + ULT_ALPHA_WINDUP_TICKS) >>> 0;
      activeEndTick = (resolveTick + Math.max(1, targets.length) * ULT_ALPHA_HIT_TICKS) >>> 0;
      endTick = (activeEndTick + ULT_RECOVERY_TICKS) >>> 0;
    } else if (family === UltimateFamily.SunspiteComet) {
      const aimed = clampQuakeEpicenter(player, { x: targetX, y: targetY }, ULT_FIREBALL_RANGE);
      targetX = aimed.x;
      targetY = aimed.y;
      const speed = variant === "dex" ? 680 : ULT_FIREBALL_SPEED;
      resolveTick = (now + ULT_FIREBALL_WINDUP_TICKS) >>> 0;
      activeEndTick = (resolveTick + ticksFromSeconds(ULT_FIREBALL_RANGE / speed)) >>> 0;
      endTick = (activeEndTick + ULT_RECOVERY_TICKS) >>> 0;
    } else if (family === UltimateFamily.EventHorizon) {
      const dest = this.navValidDest(
        player,
        c,
        player.x + aim.x * ULT_PHASE_RANGE,
        player.y + aim.y * ULT_PHASE_RANGE,
        ULT_PHASE_RANGE,
      );
      targetX = dest.x;
      targetY = dest.y;
      const distance = Math.hypot(targetX - player.x, targetY - player.y);
      resolveTick = (now + ULT_PHASE_WINDUP_TICKS) >>> 0;
      activeEndTick = (resolveTick + ticksFromSeconds(distance / ULT_PHASE_SPEED)) >>> 0;
      endTick = (activeEndTick + ULT_RECOVERY_TICKS) >>> 0;
    } else {
      const range = variant === "str" ? 1100 : ULT_BLINK_RANGE;
      const dest = this.navValidDest(player, c, targetX, targetY, range);
      targetX = dest.x;
      targetY = dest.y;
      resolveTick = (now + ULT_BLINK_WINDUP_TICKS) >>> 0;
      activeEndTick = (resolveTick + 1) >>> 0;
      endTick = (activeEndTick + ULT_BLINK_RECOVERY_TICKS) >>> 0;
    }

    const dx = targetX - player.x;
    const dy = targetY - player.y;
    const distance = Math.hypot(dx, dy) || 1;
    player.ultStartTick = now;
    player.ultResolveTick = resolveTick;
    player.ultEndTick = endTick;
    player.ultTargetX = targetX;
    player.ultTargetY = targetY;
    player.ultPhase = UltimatePhase.Windup;
    player.ultSeq = (player.ultSeq + 1) & 0xffff;
    c.ultChargeF = 0;
    this.syncUltimateCharge(player, c);
    c.ultBuffer = 0;
    c.ult = {
      family,
      variant,
      startX: player.x,
      startY: player.y,
      dirX: dx / distance,
      dirY: dy / distance,
      activeEndTick,
      teleportSeqAtAccept: player.teleportSeq,
      targets,
      hitIndex: 0,
      nextHitTick: resolveTick,
      hit: new Set<string>(),
      impactDone: false,
      sourceKey: `ult:${player.id}:${player.ultSeq}`,
    };
    this.recordPetAcceptedAction(player.id);
    return true;
  }

  private tryDimensionDoorReturn(player: PlayerState, c: CombatState): boolean {
    const ticket = this.ultimateDecoys.get(player.id);
    if (
      !ticket ||
      tickReached(this.state.tick, ticket.returnEndTick) ||
      ultimateFamilyForCode(player.ultArchetype) !== UltimateFamily.DimensionDoor ||
      !player.alive ||
      this.inLevelWindow(player) ||
      c.juggleArmed ||
      player.ultPhase !== UltimatePhase.Idle
    ) return false;
    const dest = this.navValidDest(player, c, ticket.x, ticket.y, Number.POSITIVE_INFINITY);
    this.ultimateDecoys.delete(player.id);
    player.ultStartTick = this.state.tick;
    player.ultResolveTick = this.state.tick;
    player.ultEndTick = (this.state.tick + ULT_BLINK_RECOVERY_TICKS) >>> 0;
    player.ultTargetX = dest.x;
    player.ultTargetY = dest.y;
    player.ultPhase = UltimatePhase.Recovery;
    player.ultSeq = (player.ultSeq + 1) & 0xffff;
    player.x = dest.x;
    player.y = dest.y;
    c.lastGroundX = dest.x;
    c.lastGroundY = dest.y;
    c.pitGrace = PIT_FALL_GRACE;
    c.invuln = Math.max(c.invuln, ULT_BLINK_IFRAMES);
    this.zeroMoveVel(player.id);
    c.ultBuffer = 0;
    c.ult = {
      family: UltimateFamily.DimensionDoor,
      variant: player.ultVariant || "str",
      startX: player.x,
      startY: player.y,
      dirX: 0,
      dirY: 0,
      activeEndTick: this.state.tick,
      teleportSeqAtAccept: player.teleportSeq,
      targets: [],
      hitIndex: 0,
      nextHitTick: this.state.tick,
      hit: new Set<string>(),
      impactDone: true,
      sourceKey: `ult:return:${player.id}:${player.ultSeq}`,
    };
    return true;
  }

  private beginUltimate(player: PlayerState, c: CombatState, ult: UltimateRuntime): void {
    player.ultPhase = UltimatePhase.Active;
    if (ult.family === UltimateFamily.SunspiteComet) {
      this.launchSunspiteComet(player, c, ult);
      return;
    }
    if (ult.family === UltimateFamily.DimensionDoor) {
      this.ultimateDecoys.set(player.id, {
        x: ult.startX,
        y: ult.startY,
        hp: ULT_DOOR_DECOY_HP * Math.max(1, this.state.players.size),
        detonateTick: (this.state.tick + ticksFromSeconds(ULT_DOOR_DECOY_SECONDS)) >>> 0,
        returnEndTick: (this.state.tick + ticksFromSeconds(ULT_DOOR_RETURN_SECONDS)) >>> 0,
        detonated: false,
        damage: (ult.variant === "int" ? 50 : ULT_DOOR_DETONATE_DAMAGE) *
          this.ultimateScale(player, ult),
      });
      player.x = player.ultTargetX;
      player.y = player.ultTargetY;
      c.lastGroundX = player.x;
      c.lastGroundY = player.y;
      c.pitGrace = PIT_FALL_GRACE;
      c.invuln = Math.max(c.invuln, ult.variant === "con" ? 0.9 : ULT_BLINK_IFRAMES);
      this.zeroMoveVel(player.id);
      ult.teleportSeqAtAccept = player.teleportSeq;
      if (ult.variant === "str") {
        this.detonate(
          player.x,
          player.y,
          140,
          28 * this.ultimateScale(player, ult),
          critChanceFor(player.luk, player.dex),
          player.id,
          "ult:dimension-door",
          CombatDelivery.Ultimate,
        );
      } else if (ult.variant === "con") {
        c.bulwarkShield = Math.max(c.bulwarkShield, 15);
      }
      c.ultCritCharges = ult.variant === "con" ? 0 : ult.variant === "str" ? 2 : 3;
      c.ultCritEndTick = (this.state.tick + ticksFromSeconds(4)) >>> 0;
      return;
    }
    ult.startX = player.x;
    ult.startY = player.y;
    const dx = player.ultTargetX - player.x;
    const dy = player.ultTargetY - player.y;
    const distance = Math.hypot(dx, dy) || 1;
    ult.dirX = dx / distance;
    ult.dirY = dy / distance;
    this.zeroMoveVel(player.id);
    ult.teleportSeqAtAccept = player.teleportSeq;
    const activeTicks = Math.max(1, (ult.activeEndTick - this.state.tick) >>> 0);
    c.invuln = Math.max(c.invuln, activeTicks * TICK_MS / 1000 + TICK_MS / 1000);
  }

  private ultimateScale(player: PlayerState, ult: UltimateRuntime): number {
    return ultimateDamageScale(player, ultimateFamilyAttr(ult.family), ult.variant);
  }

  private weaponCritChance(player: PlayerState, c: CombatState): number {
    if (c.ultCritCharges > 0 && tickReached(this.state.tick, c.ultCritEndTick)) c.ultCritCharges = 0;
    if (c.ultCritCharges > 0) {
      c.ultCritCharges--;
      return 1;
    }
    return Math.max(
      0,
      Math.min(CRIT_CHANCE_CAP, critChanceFor(player.luk, player.dex) + c.mods.critChanceAdd),
    );
  }

  private launchSunspiteComet(player: PlayerState, c: CombatState, ult: UltimateRuntime): void {
    const aim = this.aimDir(player, c);
    const speed = ult.variant === "dex" ? 680 : ULT_FIREBALL_SPEED;
    const direct = (ult.variant === "str" ? 70 : ULT_FIREBALL_DAMAGE) * this.ultimateScale(player, ult);
    const blast = (ult.variant === "con" ? 20 : ULT_NUKE_DAMAGE) * this.ultimateScale(player, ult);
    const muzzle = gunMuzzleReach(WEAPONS[player.weapon] ?? WEAPONS[DEFAULT_WEAPON]!);
    const mx = player.x + aim.x * muzzle;
    const my = player.y + aim.y * muzzle;
    this.fireProjectile(
      { x: mx, y: my },
      { x: mx + aim.x, y: my + aim.y },
      speed,
      direct,
      false,
      "fireball",
      1,
      ULT_FIREBALL_RANGE / speed,
      { radius: ULT_NUKE_RADIUS, damage: blast },
      0,
      critChanceFor(player.luk, player.dex),
      player.id,
      "ult:sunspite-comet",
      CombatDelivery.Ultimate,
    );
  }

  private stepSeismarch(player: PlayerState, c: CombatState, ult: UltimateRuntime): void {
    const elapsed = ((this.state.tick - player.ultResolveTick) >>> 0) + 1;
    const progress = Math.min(1, elapsed / ULT_SEISMARCH_AIR_TICKS);
    player.x = ult.startX + (player.ultTargetX - ult.startX) * progress;
    player.y = ult.startY + (player.ultTargetY - ult.startY) * progress;
    if (progress < 1 || ult.impactDone) return;
    ult.impactDone = true;
    this.resolveSeismarchImpact(player, c, ult);
    this.zeroMoveVel(player.id);
    ult.teleportSeqAtAccept = player.teleportSeq;
    player.ultPhase = UltimatePhase.Recovery;
  }

  private resolveSeismarchImpact(player: PlayerState, c: CombatState, ult: UltimateRuntime): void {
    const shrink = ult.variant === "dex" ? 0.8 : 1;
    const inner = ULT_SEISMARCH_INNER_RADIUS * shrink;
    const mid = ULT_SEISMARCH_MID_RADIUS * shrink;
    const outer = ULT_SEISMARCH_OUTER_RADIUS * shrink;
    const scale = this.ultimateScale(player, ult);
    const crit = Math.min(1, critChanceFor(player.luk, player.dex) * (ult.variant === "luk" ? 1.5 : 1));
    this.ultimateKills.length = 0;
    this.enemyGrid.queryRadius(player.x, player.y, outer, this.enemyCandidates);
    for (const id of this.enemyCandidates) {
      const enemy = this.state.enemies.get(id);
      if (!enemy || (id === this.bossId && this.bossController?.wormRuntime)) continue;
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const distance = Math.hypot(dx, dy);
      if (distance > outer) continue;
      const damage =
        distance <= inner
          ? (ult.variant === "con" ? 48 : ULT_SEISMARCH_INNER_DAMAGE)
          : distance <= mid
            ? ULT_SEISMARCH_MID_DAMAGE
            : ULT_SEISMARCH_OUTER_DAMAGE;
      this.damageEnemy(
        enemy,
        id,
        damage * scale,
        this.ultimateKills,
        crit,
        player.id,
        "ult:seismarch",
        CombatDelivery.Ultimate,
        player.x,
        player.y,
      );
      if (distance <= inner && enemy.hp > 0)
        this.applyUltimateStun(enemy, id, ULT_SEISMARCH_STUN_SECONDS);
      else if (distance > mid && distance > 1e-4) {
        enemy.x += (dx / distance) * PARRY_KNOCKBACK;
        enemy.y += (dy / distance) * PARRY_KNOCKBACK;
        this.updateEnemyGrid(id, enemy);
      }
    }
    this.damageWormSlots(
      this.collectWormRadiusHits(player.x, player.y, outer),
      ULT_SEISMARCH_INNER_DAMAGE * scale,
      ult.sourceKey,
      this.ultimateKills,
      crit,
      false,
      player.id,
      "ult:seismarch",
      CombatDelivery.Ultimate,
      player.x,
      player.y,
    );
    for (const id of this.ultimateKills) this.state.enemies.delete(id);
    if (ult.variant === "dex") c.jumpCd = 0;
    if (ult.variant === "con") {
      this.state.players.forEach((ally) => {
        if (!ally.alive || (ally.x - player.x) ** 2 + (ally.y - player.y) ** 2 > outer * outer) return;
        const allyCombat = this.combat.get(ally.id);
        if (allyCombat) allyCombat.bulwarkShield = Math.max(allyCombat.bulwarkShield, 20);
      });
    }
    this.ultimateFissures.push({
      x: player.x,
      y: player.y,
      ownerId: player.id,
      damage: (ult.variant === "int" ? 12 : ULT_SEISMARCH_FISSURE_DAMAGE) * scale,
      nextTick: (this.state.tick + ticksFromSeconds(1)) >>> 0,
      endTick: (this.state.tick + ticksFromSeconds(ult.variant === "int" ? 5 : ULT_SEISMARCH_FISSURE_SECONDS)) >>> 0,
    });
  }

  private applyUltimateStun(enemy: EnemyState, id: string, seconds: number): boolean {
    if (ENEMY_KINDS[enemy.kind]?.archetype === "boss") return false;
    const until = this.ultimateStunUntil.get(id);
    if (until !== undefined && !tickReached(this.state.tick, until)) return false;
    this.ultimateStunUntil.set(id, (this.state.tick + ULT_STUN_ICD_TICKS) >>> 0);
    const existing = this.poundEnemyEffects.get(id);
    if (existing) existing.staggerT = Math.max(existing.staggerT, seconds);
    else this.poundEnemyEffects.set(id, { vx: 0, vy: 0, staggerT: seconds });
    return true;
  }

  private stepEventHorizon(player: PlayerState, c: CombatState, ult: UltimateRuntime): void {
    const duration = Math.max(1, (ult.activeEndTick - player.ultResolveTick) >>> 0);
    const elapsed = ((this.state.tick - player.ultResolveTick) >>> 0) + 1;
    const progress = Math.min(1, elapsed / duration);
    const fromX = player.x;
    const fromY = player.y;
    const toX = ult.startX + (player.ultTargetX - ult.startX) * progress;
    const toY = ult.startY + (player.ultTargetY - ult.startY) * progress;
    this.damageEventHorizonSweep(player, ult, fromX, fromY, toX, toY);
    player.x = toX;
    player.y = toY;
    if (progress < 1) return;
    this.zeroMoveVel(player.id);
    ult.teleportSeqAtAccept = player.teleportSeq;
    player.ultPhase = UltimatePhase.Recovery;
  }

  private damageEventHorizonSweep(
    player: PlayerState,
    ult: UltimateRuntime,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
  ): void {
    const halfWidth = ult.variant === "int" ? 120 : ULT_PHASE_HALFWIDTH;
    const pad = halfWidth + MAX_ENEMY_RADIUS;
    this.enemyGrid.queryAabb(
      Math.min(fromX, toX) - pad,
      Math.min(fromY, toY) - pad,
      Math.max(fromX, toX) + pad,
      Math.max(fromY, toY) + pad,
      this.enemyCandidates,
    );
    this.ultimateKills.length = 0;
    const scale = this.ultimateScale(player, ult);
    for (const id of this.enemyCandidates) {
      if (ult.hit.has(id) || (id === this.bossId && this.bossController?.wormRuntime)) continue;
      const enemy = this.state.enemies.get(id);
      if (!enemy) continue;
      const radius = ENEMY_KINDS[enemy.kind]?.radius ?? ENEMY_RADIUS;
      const reach = halfWidth + radius;
      if (pointSegmentDistanceSq(enemy.x, enemy.y, fromX, fromY, toX, toY) > reach * reach) continue;
      ult.hit.add(id);
      this.damageEnemy(
        enemy,
        id,
        ULT_PHASE_DAMAGE * (ult.variant === "str" ? 1.5 : 1) * scale,
        this.ultimateKills,
        critChanceFor(player.luk, player.dex),
        player.id,
        "ult:event-horizon",
        CombatDelivery.Ultimate,
        fromX,
        fromY,
      );
      if (enemy.hp > 0 && ENEMY_KINDS[enemy.kind]?.archetype !== "boss") {
        this.ultimateBrands.set(id, {
          remaining: ULT_PHASE_BRAND_SECONDS,
          multiplier: ult.variant === "luk" ? 0.28 : ULT_PHASE_BRAND_MULT - 1,
        });
        enemy.branded = 1;
      }
    }
    const worm = this.bossController?.wormRuntime;
    if (worm) {
      this.wormHitSlots.length = 0;
      this.wormSegmentGrid.queryAabb(
        Math.min(fromX, toX) - halfWidth - 52,
        Math.min(fromY, toY) - halfWidth - 52,
        Math.max(fromX, toX) + halfWidth + 52,
        Math.max(fromY, toY) + halfWidth + 52,
        this.wormSegmentCandidates,
      );
      for (const slot of this.wormSegmentCandidates) {
        const key = `worm:${slot}:${worm.segmentGeneration(slot)}`;
        if (ult.hit.has(key)) continue;
        if (!worm.segmentIntersectsSweptCapsule(slot, fromX, fromY, toX, toY, halfWidth)) continue;
        ult.hit.add(key);
        this.wormHitSlots.push(slot);
      }
      this.damageWormSlots(
        this.wormHitSlots,
        ULT_PHASE_DAMAGE * scale,
        ult.sourceKey,
        this.ultimateKills,
        critChanceFor(player.luk, player.dex),
        true,
        player.id,
        "ult:event-horizon",
        CombatDelivery.Ultimate,
        fromX,
        fromY,
      );
    }
    for (const id of this.ultimateKills) this.state.enemies.delete(id);
  }

  private stepAlphaStrike(player: PlayerState, c: CombatState, ult: UltimateRuntime): void {
    if (ult.hitIndex < ult.targets.length && tickReached(this.state.tick, ult.nextHitTick)) {
      const target = ult.targets[ult.hitIndex]!;
      const position = this.ultimateTargetPosition(target);
      ult.hitIndex++;
      ult.nextHitTick = (ult.nextHitTick + ULT_ALPHA_HIT_TICKS) >>> 0;
      if (position) {
        const ax = position.x - player.x;
        const ay = position.y - player.y;
        const distance = Math.hypot(ax, ay) || 1;
        const dest = this.navValidDest(
          player,
          c,
          position.x - (ax / distance) * (position.radius + PLAYER_RADIUS),
          position.y - (ay / distance) * (position.radius + PLAYER_RADIUS),
          Number.POSITIVE_INFINITY,
        );
        player.x = dest.x;
        player.y = dest.y;
        c.lastGroundX = dest.x;
        c.lastGroundY = dest.y;
        this.zeroMoveVel(player.id);
        ult.teleportSeqAtAccept = player.teleportSeq;
        const scale = this.ultimateScale(player, ult);
        let base = ult.variant === "str" ? 38 : ULT_ALPHA_DAMAGE;
        if (ult.targets.length === 1) base *= ULT_ALPHA_SINGLE_MULT;
        this.ultimateKills.length = 0;
        if (target.slot >= 0) {
          this.wormHitSlots.length = 0;
          this.wormHitSlots.push(target.slot);
          this.damageWormSlots(
            this.wormHitSlots,
            base * scale,
            `${ult.sourceKey}:${target.id}`,
            this.ultimateKills,
            critChanceFor(player.luk, player.dex),
            false,
            player.id,
            "ult:alpha-strike",
            CombatDelivery.Ultimate,
            player.x,
            player.y,
          );
        } else {
          const enemy = this.state.enemies.get(target.id);
          if (enemy) {
            const kind = ENEMY_KINDS[enemy.kind];
            const maxHp = (kind?.hp ?? enemy.hp) * enemyHpScale(this.state.depth) *
              (enemy.tough ? TOUGH_HP_MULT : 1);
            const executeAt = ult.variant === "luk" ? 0.25 : ULT_ALPHA_EXECUTE_FRAC;
            if (maxHp > 0 && enemy.hp / maxHp < executeAt) base *= ULT_ALPHA_EXECUTE_MULT;
            this.damageEnemy(
              enemy,
              target.id,
              base * scale,
              this.ultimateKills,
              critChanceFor(player.luk, player.dex),
              player.id,
              "ult:alpha-strike",
              CombatDelivery.Ultimate,
              player.x,
              player.y,
            );
            if (ult.variant === "str" && enemy.hp > 0) this.applyUltimateStun(enemy, target.id, 0.5);
          }
        }
        for (const id of this.ultimateKills) this.state.enemies.delete(id);
      }
    }
    if (!tickReached(this.state.tick, ult.activeEndTick)) return;
    c.invuln = Math.max(c.invuln, ult.variant === "con" ? 0.6 : 0.25);
    if (ult.variant === "con") c.bulwarkShield = Math.max(c.bulwarkShield, 15 * Math.floor(ult.hitIndex / 2));
    player.ultPhase = UltimatePhase.Recovery;
  }

  private cancelUltimate(player: PlayerState, c: CombatState): void {
    if (this.ultimateOwnsMovement(player)) this.zeroMoveVel(player.id);
    player.ultPhase = UltimatePhase.Idle;
    c.ult = undefined;
  }

  private stepUltimateWorldEffects(dt: number): void {
    for (const [id, brand] of this.ultimateBrands) {
      const enemy = this.state.enemies.get(id);
      if (!enemy) {
        this.ultimateBrands.delete(id);
        continue;
      }
      brand.remaining -= dt;
      if (brand.remaining > 0) continue;
      this.ultimateBrands.delete(id);
      if (!this.brandedTimers.has(id)) enemy.branded = 0;
    }
    for (let i = this.ultimateFissures.length - 1; i >= 0; i--) {
      const fissure = this.ultimateFissures[i]!;
      if (tickReached(this.state.tick, fissure.endTick)) {
        this.ultimateFissures.splice(i, 1);
        continue;
      }
      if (!tickReached(this.state.tick, fissure.nextTick)) continue;
      fissure.nextTick = (fissure.nextTick + ticksFromSeconds(1)) >>> 0;
      this.detonate(
        fissure.x,
        fissure.y,
        ULT_SEISMARCH_INNER_RADIUS,
        fissure.damage,
        0,
        fissure.ownerId,
        "ult:seismarch-fissure",
        CombatDelivery.Ultimate,
      );
    }
    for (const [ownerId, decoy] of this.ultimateDecoys) {
      if (!decoy.detonated) {
        this.state.enemies.forEach((enemy) => {
          if (decoy.hp <= 0 || ENEMY_KINDS[enemy.kind]?.archetype === "boss") return;
          const kind = ENEMY_KINDS[enemy.kind];
          const reach = (kind?.radius ?? ENEMY_RADIUS) + PLAYER_RADIUS;
          if ((enemy.x - decoy.x) ** 2 + (enemy.y - decoy.y) ** 2 <= reach * reach)
            decoy.hp -= (kind?.contactDamage ?? 0) * dt;
        });
        if (decoy.hp <= 0 || tickReached(this.state.tick, decoy.detonateTick)) {
          decoy.detonated = true;
          this.detonate(
            decoy.x,
            decoy.y,
            ULT_DOOR_DETONATE_RADIUS,
            decoy.damage,
            0,
            ownerId,
            "ult:dimension-door-decoy",
            CombatDelivery.Ultimate,
          );
        }
      }
      if (tickReached(this.state.tick, decoy.returnEndTick)) this.ultimateDecoys.delete(ownerId);
    }
  }

  private stepUltimates(dt: number): void {
    this.stepUltimateWorldEffects(dt);
    this.state.players.forEach((player, id) => {
      const c = this.combat.get(id);
      if (!c) return;
      c.ultBuffer = Math.max(0, c.ultBuffer - dt);
      const ult = c.ult;
      if (ult) {
        if (
          !player.alive ||
          this.state.outcome !== "active" ||
          player.teleportSeq !== ult.teleportSeqAtAccept
        ) {
          this.cancelUltimate(player, c);
        } else {
          if (
            player.ultPhase === UltimatePhase.Windup &&
            tickReached(this.state.tick, player.ultResolveTick)
          ) this.beginUltimate(player, c, ult);
          if (player.ultPhase === UltimatePhase.Active) {
            if (ult.family === UltimateFamily.Seismarch) this.stepSeismarch(player, c, ult);
            else if (ult.family === UltimateFamily.AlphaStrike) this.stepAlphaStrike(player, c, ult);
            else if (ult.family === UltimateFamily.EventHorizon) this.stepEventHorizon(player, c, ult);
            else if (tickReached(this.state.tick, ult.activeEndTick))
              player.ultPhase = UltimatePhase.Recovery;
          }
          if (
            player.ultPhase === UltimatePhase.Recovery &&
            tickReached(this.state.tick, player.ultEndTick)
          ) {
            player.ultPhase = UltimatePhase.Idle;
            c.ult = undefined;
          }
        }
      }
      if (player.ultPhase === UltimatePhase.Idle && c.ultBuffer > 0) {
        if (!this.tryDimensionDoorReturn(player, c)) this.acceptUltimate(player, c);
      }
    });
    this.state.players.forEach((player, id) => {
      const c = this.combat.get(id);
      if (c) this.commitWeaponResourceTick(player, c);
    });
  }

  /** Publish one authoritative player-attack acceptance edge. Damage/cooldown behavior remains elsewhere. */
  private stampAttackBeat(player: PlayerState): void {
    player.attackSeq = (player.attackSeq + 1) >>> 0;
    player.attackTick = this.state.tick;
    player.attackHeld = true;
    this.recordPetAcceptedAction(player.id);
  }

  /** Fire one weapon swing (§20 WYSIWYG). The EDGE is registered as a SWEPT BLADE (`stepMeleeSwings` sweeps
   *  it across `swingArc` and damages each enemy the blade actually crosses — #2/#5/#6); the secondary
   *  LAYERS (chain / quake / scatter) fire here at the swing moment, each an independent position-based
   *  source ("layered like the Wyrmtooth"). Damage scales per-source (§14); kills grant XP. */
  /** Prospective six-beat melee step. It mutates nothing until the attack is actually accepted. */
  private nextPairMeleeStep(player: PlayerState, c: CombatState): number {
    const acceptedAtMs = this.state.tick * TICK_MS;
    return comboStepForChain(
      (player.attackSeq + 1) >>> 0,
      acceptedAtMs,
      c.pairComboId,
      c.pairComboFamily,
      DUAL_MELEE_SEQUENCE_LENGTH,
      c.pairComboSeq,
      c.pairComboAcceptedAtMs,
      c.pairComboId,
      c.pairComboSeq === undefined ? undefined : c.pairComboFamily,
      c.pairComboStep,
      c.pairComboExpiresAtMs,
    );
  }

  /** Crossfall's `both` is presentation; the shipped authoritative event is one lead sweep. */
  private pairMeleeServerHand(step: number): DualWieldHand {
    return DUAL_MELEE_PAIR_BAR[step] === "off" ? 1 : 0;
  }

  /** The `both` gather is timed by the off weapon, matching the six-beat bar's heavy incoming note. */
  private pairMeleeCadenceHand(step: number): DualWieldHand {
    return DUAL_MELEE_PAIR_BAR[step] === "lead" ? 0 : 1;
  }

  private handCooldown(c: CombatState, offSlot: ArsenalSlot, hand: DualWieldHand): number {
    return hand === 0 ? c.cd : offSlot.cooldown;
  }

  private setHandCooldown(
    c: CombatState,
    offSlot: ArsenalSlot | undefined,
    hand: DualWieldHand,
    cooldown: number,
    accumulate: boolean,
  ): void {
    if (hand === 0) c.cd = accumulate ? c.cd + cooldown : cooldown;
    else if (offSlot) offSlot.cooldown = accumulate ? offSlot.cooldown + cooldown : cooldown;
  }

  private recordPairMeleeBeat(
    player: PlayerState,
    c: CombatState,
    offSlot: ArsenalSlot,
    step: number,
    cadenceMult: number,
  ): void {
    const acceptedAtMs = this.state.tick * TICK_MS;
    const nextStep = (step + 1) % DUAL_MELEE_SEQUENCE_LENGTH;
    const incomingHand = this.pairMeleeCadenceHand(nextStep);
    const incoming = incomingHand === 0 ? WEAPONS[player.weapon] : WEAPONS[offSlot.weapon];
    const gap = incoming ? PAIR_TEMPO * weaponAttackCooldown(incoming) * cadenceMult : 0;
    const graceMs = Math.min(300, Math.max(120, gap * 350));
    c.pairComboSeq = player.attackSeq;
    c.pairComboAcceptedAtMs = acceptedAtMs;
    c.pairComboStep = step;
    c.pairComboExpiresAtMs = acceptedAtMs + gap * 1000 + graceMs;
  }

  /** Resolve one accepted attack from one hand. Identity, loot, damage, receipt, and resource writes all
   * come from that hand; the lead's cooldown affix alone owns pair cadence. */
  private resolveHandAttack(
    player: PlayerState,
    c: CombatState,
    hand: DualWieldHand,
    offSlot?: ArsenalSlot,
    pairStep = -1,
    _soloCover = false,
  ): boolean {
    const paired = !!offSlot;
    const weapon = hand === 0 ? WEAPONS[player.weapon] : WEAPONS[offSlot?.weapon ?? ""];
    if (!weapon) return false;
    const cadenceMult =
      lootCooldownMult(player.weaponAffix) * this.weaponRecoveryMult(player, weapon);
    const soloCooldown = weaponAttackCooldown(weapon) * cadenceMult;
    c.attackBuffer = 0;
    const interval = effectiveAcceptedWeaponInterval(weapon, soloCooldown);
    const pairContribution = hand === 1 && offSlot
      ? this.pairOffhandDamageMultiplier(player, offSlot)
      : 1;
    const delivery = weapon.gun
      ? CombatDelivery.Gun
      : weapon.thrown
        ? CombatDelivery.Thrown
        : weapon.cast
          ? CombatDelivery.Cast
          : CombatDelivery.Melee;
    const instanceId = hand === 1
      ? offSlot?.instanceId || weapon.id
      : player.slots[player.activeSlot]?.instanceId || weapon.id;
    if (!this.trySpendWeaponResource(
      player,
      c,
      weapon,
      instanceId,
      delivery,
      hand,
      interval,
      pairContribution,
      0,
      "tap",
    ).accepted) return false;
    this.stampAttackBeat(player);

    if (weapon.gun) {
      this.fireGun(player, c, weapon, hand);
      this.setHandCooldown(c, offSlot, hand, soloCooldown, true);
    } else if (weapon.thrown) {
      this.throwWeapon(player, c, weapon, hand);
      this.setHandCooldown(c, offSlot, hand, soloCooldown, false);
    } else if (weapon.cast) {
      this.fireCast(player, c, weapon, hand);
      this.setHandCooldown(c, offSlot, hand, soloCooldown, false);
    } else {
      const descriptorCooldown = paired ? PAIR_TEMPO * soloCooldown : soloCooldown;
      const swing = swingDescriptorFor(weapon, descriptorCooldown);
      this.resolveSwing(player, c, weapon, swing, hand);
      this.setHandCooldown(c, offSlot, hand, soloCooldown, false);
    }

    if (!offSlot) return true;
    if (pairStep >= 0) this.recordPairMeleeBeat(player, c, offSlot, pairStep, cadenceMult);
    let gap: number;
    if (pairStep >= 0) {
      const nextStep = (pairStep + 1) % DUAL_MELEE_SEQUENCE_LENGTH;
      const incomingHand = this.pairMeleeCadenceHand(nextStep);
      const incoming = incomingHand === 0 ? WEAPONS[player.weapon] : WEAPONS[offSlot.weapon];
      gap = PAIR_TEMPO * weaponAttackCooldown(incoming!) * cadenceMult;
    } else {
      const incoming = hand === 0 ? WEAPONS[offSlot.weapon] : WEAPONS[player.weapon];
      gap = PAIR_TEMPO * weaponAttackCooldown(incoming!) * cadenceMult;
    }
    c.handGate += gap;
    player.offCharges = 0;
    player.offMaxCharges = 0;
    return true;
  }

  private resolveSwing(
    player: PlayerState,
    c: CombatState,
    weapon: WeaponDef,
    swing: SwingDescriptor,
    hand: DualWieldHand = 0,
  ): void {
    const attackCrit = this.weaponCritChance(player, c);
    // §14 WYSIWYG: each damage SOURCE scales independently. The EDGE uses the weapon's own grades; the
    // layers below carry their own and may scale off DIFFERENT attributes (e.g. INT magma on a STR blade).
    const edgePower = this.heldDamageMult(weapon, weapon.scalingGrades, player, hand); // §10 edge grades × §11 req penalty
    const aim0 = Math.atan2(c.aimY, c.aimX);
    // §20 WYSIWYG: the hit reach follows the RENDERED blade — floored at the sprite tip + scaled by the
    // holder's rig — so the point stops whiffing (guns already do this via gunMuzzleReach; melee was flat).
    const reach = meleeReach(weapon); // §29 weapons are a FIXED size now (not char-scaled) → fixed reach
    // Register the swept edge on the accepted descriptor. Slow active seconds can exceed the old 180ms cap,
    // but BALANCE/DPS does not multiply: cooldown + edgeDamage + arc coverage are unchanged and `hit` still
    // admits each enemy exactly once per accepted swing. Replaces any in-flight swing; pose ≤ cooldown.
    const swingKey = player.offhandSlot !== 255 ? `${player.id}:${hand}` : player.id;
    this.meleeSwings.set(swingKey, {
      playerId: player.id,
      swing,
      aim0,
      range: reach,
      swingArc: weapon.swingArc,
      halfWidth: MELEE_BLADE_HALFWIDTH,
      edgeDamage: weapon.damage * edgePower,
      weaponId: weapon.id,
      crit: attackCrit,
      elapsed: 0,
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
        if (eid === this.bossId && this.bossController?.wormRuntime) return;
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
      const wormRuntime = this.bossController?.wormRuntime;
      if (wormRuntime) {
        this.wormSegmentGrid.queryRadius(player.x, player.y, reach + 52, this.wormSegmentCandidates);
        for (const slot of this.wormSegmentCandidates) {
          const dx = wormRuntime.x[slot]! - player.x;
          const dy = wormRuntime.y[slot]! - player.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > (reach + wormRuntime.segmentRadius(slot)) ** 2) continue;
          let da = Math.abs(Math.atan2(dy, dx) - aim0);
          if (da > Math.PI) da = 2 * Math.PI - da;
          if (da > halfSweep) continue;
          const id = `worm:${slot}:${wormRuntime.segmentGeneration(slot)}`;
          wedge.add(id);
          if (d2 < seedBestD) {
            seedBestD = d2;
            seedX = wormRuntime.x[slot]!;
            seedY = wormRuntime.y[slot]!;
            seedFound = true;
          }
        }
      }
      if (seedFound) {
        const cl = weapon.chainLightning;
        const clPower = this.heldDamageMult(weapon, cl.scalingGrades, player, hand);
        const candidates: ChainCandidate[] = [];
        this.state.enemies.forEach((enemy, eid) => {
          if (eid === this.bossId && this.bossController?.wormRuntime) return;
          candidates.push({ id: eid, x: enemy.x, y: enemy.y });
        });
        if (wormRuntime) {
          for (let slot = 0; slot < WORM_MAX_SEGMENTS; slot++) {
            if (!wormRuntime.isTargetable(slot)) continue;
            candidates.push({
              id: `worm:${slot}:${wormRuntime.segmentGeneration(slot)}`,
              x: wormRuntime.x[slot]!,
              y: wormRuntime.y[slot]!,
            });
          }
        }
        const links = selectChainTargets(
          { x: seedX, y: seedY },
          candidates,
          cl.jumps,
          Math.min(cl.range, CHAIN_MAX_RANGE),
          wedge, // swing-wedge enemies aren't chain targets (the blade already covers them)
        );
        const kills: string[] = [];
        links.forEach((t, n) => {
          if (t.id.startsWith("worm:")) {
            const slot = Number(t.id.split(":")[1]);
            if (Number.isInteger(slot)) {
              this.damageWormSlots(
                [slot],
                cl.damage * cl.falloff ** n * clPower,
                `chain:${player.id}:${player.attackSeq}`,
                kills,
                attackCrit,
                true,
                player.id,
                weapon.id,
                CombatDelivery.Chain,
                player.x,
                player.y,
              );
            }
            return;
          }
          const enemy = this.state.enemies.get(t.id);
          if (enemy)
            this.damageEnemy(
              enemy,
              t.id,
              cl.damage * cl.falloff ** n * clPower,
              kills,
              attackCrit,
              player.id,
              weapon.id,
              CombatDelivery.Chain,
              player.x,
              player.y,
            );
        });
        for (const eid of kills) this.state.enemies.delete(eid);
      }
    }

    // Earthquake: erupts at the CURSOR, clamped to QUAKE_REACH from the player (§9 aim-at-cursor); AoE via
    // the shared `detonate` (same kill/XP/portal bookkeeping). The client matches the epicentre via the
    // SAME shared clampQuakeEpicenter. §44 the descriptor's 52% impact is relative to this accepted epoch;
    // the client predicts the identical effective-cooldown descriptor at send. A later accepted-swing seq is
    // still required to remove the residual network/buffer epoch offset — no protocol expansion in this P0.
    if (weapon.quake) {
      const qPower = this.heldDamageMult(weapon, weapon.quake.scalingGrades, player, hand);
      const ep = clampQuakeEpicenter(player, { x: c.targetX, y: c.targetY }, QUAKE_REACH);
      this.pendingQuakes.push({
        t: swing.impactSeconds,
        x: ep.x,
        y: ep.y,
        radius: weapon.quake.radius,
        damage: weapon.quake.damage * qPower,
        crit: attackCrit,
        sourcePlayerId: player.id,
        sourceWeaponId: weapon.id,
      });
    }

    // Scatter shot (§14 WYSIWYG): fling real magma projectiles that each deal an INT-scaled hit + explode.
    // Fired as live projectiles (server-authoritative) — they advance + detonate ON CONTACT in
    // stepProjectiles, so the secondary VFX damage where it actually touches an enemy (#6).
    if (weapon.scatter) this.fireScatter(player, c, weapon, hand);

    // §6 REZ (Gravedigger's Spade): the swing REVIVES the nearest downed ally within range (at 30% HP).
    if (weapon.rez) this.tryRez(player, weapon.rez.radius);
  }

  /** §6 try to revive the nearest DOWNED ally within `radius` of the rezzer (the swing's rez effect). The
   *  ally comes back at `REVIVE_HP_FRAC` of max HP, WHERE THEY FELL, with the spawn pile cleared so they
   *  don't instantly re-down; `revivedSeq` bumps the client's revive VFX. One rez per swing. */
  private tryRez(rezzer: PlayerState, radius: number): void {
    const petMods = this.petRuns.get(rezzer.id)?.mods;
    const effectiveRadius = radius + (petMods?.reviveReachAdd ?? 0);
    let best: PlayerState | null = null;
    let bestId = "";
    let bestD = effectiveRadius * effectiveRadius;
    this.state.players.forEach((p) => {
      if (p.alive || p.id === rezzer.id) return; // only DOWNED allies
      const dx = p.x - rezzer.x;
      const dy = p.y - rezzer.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD || (d2 === bestD && (bestId === "" || p.id.localeCompare(bestId) < 0))) {
        bestD = d2;
        best = p;
        bestId = p.id;
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
    const reviveHpFraction = petMods?.reviveHpFraction || REVIVE_HP_FRAC;
    ally.hp = Math.max(1, Math.round(ally.maxHp * reviveHpFraction));
    ally.revivedSeq = (ally.revivedSeq + 1) % 100000;
    this.vastagharDownTicks.delete(ally.id);
    this.clearEnemiesNear(ally.x, ally.y, RESPAWN_CLEAR_RADIUS);
    this.recordPetAcceptedAction(rezzer.id);
  }

  /** §20/§44 advance accepted descriptor time, sweeping only while the unchanged pose envelope is dangerous.
   *  A tick may cross wind-up, the whole fast active interval, or recovery; clamped progress preserves full
   *  arc supersampling and hit-once coverage in every case. The live player position still anchors the edge. */
  /** Input held-state with the three-tick disconnect/stall watchdog applied. */
  private beamHeld(id: string): boolean {
    const input = this.inputs.get(id);
    if (!input?.held.fireHeld) return false;
    return ((this.state.tick - input.lastFreshFireTick) >>> 0) < BEAM_STALE_INPUT_TICKS;
  }

  /** Charge → authoritative ignition → sustained swept damage → recovery/overheat. */
  private stepPlayerBeam(
    player: PlayerState,
    id: string,
    c: CombatState,
    weapon: WeaponDef,
    dt: number,
    acting: boolean,
  ): void {
    const input = this.inputs.get(id);
    if (!input || !weapon.beam) return;
    const held = this.beamHeld(id);
    const rising = held && !c.beamInputWasHeld;
    if (!held) c.drive.beamRequireRelease = false;

    if (!acting || c.beamTeleportSeq !== player.teleportSeq) {
      if (c.beamPhase !== 0) this.cancelBeam(player, id, c, true, true);
      else this.state.beams.delete(id);
      c.beamInputWasHeld = held;
      c.beamTeleportSeq = player.teleportSeq;
      return;
    }

    if (
      c.beamPhase === 0 &&
      rising &&
      c.drawLock <= 0 &&
      (c.drive.beamLockEndTick === 0 || tickReached(this.state.tick, c.drive.beamLockEndTick)) &&
      (c.drive.beamRecoveryEndTick === 0 || tickReached(this.state.tick, c.drive.beamRecoveryEndTick)) &&
      !c.drive.beamRequireRelease &&
      this.drivePendingValue(c) + 1e-9 >= DRIVE_BEAM_RESTART_THRESHOLD
    ) {
      const classDamage =
        weapon.tags.classPool === "caster"
          ? 1 + AUG_CAST_DMG_PER * countAugment(player.augments, "overcharge")
          : 1;
      c.beamDescriptor = beamDescriptorFor(
        weapon,
        this.state.tick,
        input.held.fireStartSeq || input.held.seq,
        this.heldDamageMult(weapon, weapon.beam.scalingGrades, player) * classDamage,
        lootCooldownMult(player.weaponAffix) * this.weaponRecoveryMult(player, weapon),
        1 + AUG_BEAM_FOCUS_PER * c.beamFocusStacks,
      );
      c.beamPhase = 1;
      c.beamPhaseT = 0;
      c.beamChannelT = 0;
      c.beamPulseT = 0;
      c.beamQuantumT = 0;
      c.beamPendingDamage.clear();
      c.beamAngle = Math.atan2(c.aimY, c.aimX);
      c.beamPreviousAngle = c.beamAngle;
      const reach = weaponMuzzleReach(weapon, characterScale(player.character));
      c.beamPreviousX = player.x + Math.cos(c.beamAngle) * reach;
      c.beamPreviousY = player.y + Math.sin(c.beamAngle) * reach;
      c.beamPreviousLength = this.clipBeamLength(
        c.beamPreviousX,
        c.beamPreviousY,
        c.beamAngle,
        c.beamDescriptor.range,
        c.beamDescriptor.width / 2,
      );
      c.beamTeleportSeq = player.teleportSeq;
    }

    const descriptor = c.beamDescriptor;
    if (c.beamPhase === 1 && descriptor) {
      if (!held) {
        this.cancelBeam(player, id, c, true, false);
      } else {
        c.beamAngle = stepBeamAngle(
          c.beamAngle,
          Math.atan2(c.aimY, c.aimX),
          descriptor.sweepLagSeconds,
          dt,
          descriptor.maxTurnRate,
        );
        c.beamPhaseT += dt;
        const chargeRow = this.syncBeamRow(
          player,
          id,
          c,
          descriptor,
          BeamPhase.Charging,
          0,
          Math.min(0.95, c.beamPhaseT / descriptor.chargeSeconds),
        );
        // Charge steers/moves the implement but is non-damaging; ignition begins from the latest accepted
        // pose, never sweeps the whole anticipation path as a retroactive hit.
        c.beamPreviousX = chargeRow.originX;
        c.beamPreviousY = chargeRow.originY;
        c.beamPreviousAngle = c.beamAngle;
        c.beamPreviousLength = this.clipBeamLength(
          chargeRow.originX,
          chargeRow.originY,
          c.beamAngle,
          descriptor.range,
          descriptor.width / 2,
        );
        if (c.beamPhaseT + 1e-9 >= descriptor.chargeSeconds) {
          const instanceId = player.slots[player.activeSlot]?.instanceId || weapon.id;
          const ignition = this.trySpendWeaponResource(
            player,
            c,
            weapon,
            instanceId,
            CombatDelivery.Beam,
            0,
            BEAM_RECOVERY_SECONDS,
            1,
            0,
            "beam-ignite",
          );
          if (!ignition.accepted) {
            this.cancelBeam(player, id, c, false, false);
          } else {
            c.drive.beamLockEndTick = 0;
            c.drive.beamRecoveryEndTick = 0;
            this.stampAttackBeat(player);
            c.beamPhase = 2;
            c.beamPhaseT = 0;
            c.beamChannelT = 0;
            c.beamPulseT = 0;
            c.beamQuantumT = 0;
            c.beamCrit = this.weaponCritChance(player, c);
            const row = this.state.beams.get(id);
            if (row) row.phaseStartTick = this.state.tick;
            this.stepActiveBeam(player, id, c, descriptor, dt);
          }
        }
      }
    } else if (c.beamPhase === 2 && descriptor) {
      if (!held) this.finishBeam(player, id, c, false);
      else this.stepActiveBeam(player, id, c, descriptor, dt);
    } else if (c.beamPhase === 0) {
      this.syncRestingBeamRow(player, id, c, weapon);
    }

    c.beamInputWasHeld = held;
  }

  private stepActiveBeam(
    player: PlayerState,
    id: string,
    c: CombatState,
    descriptor: BeamDescriptor,
    dt: number,
  ): void {
    const weapon = WEAPONS[descriptor.weaponId];
    if (!weapon) return;
    const instanceId = player.slots[player.activeSlot]?.instanceId || weapon.id;
    const spend = this.trySpendWeaponResource(
      player,
      c,
      weapon,
      instanceId,
      CombatDelivery.Beam,
      0,
      dt,
      1,
      dt,
      "beam-active",
    );
    if (!spend.accepted) {
      this.finishBeam(player, id, c, true);
      return;
    }
    c.beamAngle = stepBeamAngle(
      c.beamAngle,
      Math.atan2(c.aimY, c.aimX),
      descriptor.sweepLagSeconds,
      dt,
      descriptor.maxTurnRate,
    );
    const length = this.damageBeamSweep(player, c, descriptor, dt);
    c.beamChannelT += dt;
    this.syncBeamRow(
      player,
      id,
      c,
      descriptor,
      BeamPhase.Active,
      length,
      1,
    );
    c.beamPreviousX = this.beamCurrentX;
    c.beamPreviousY = this.beamCurrentY;
    c.beamPreviousAngle = c.beamAngle;
    c.beamPreviousLength = this.beamCurrentLength;
    if (spend.beamEmpty) this.finishBeam(player, id, c, true);
  }

  private finishBeam(
    player: PlayerState,
    id: string,
    c: CombatState,
    overheated: boolean,
  ): void {
    this.flushBeamDamage(c, false, id);
    c.beamPhase = 0;
    c.beamPhaseT = 0;
    c.beamChannelT = 0;
    c.beamPulseT = 0;
    c.beamQuantumT = 0;
    if (overheated) {
      const lockSeconds =
        (c.beamDescriptor?.lockSeconds ?? 1.5) * c.mods.beamOverheatLockMult;
      c.drive.beamLockEndTick = (
        this.state.tick + Math.ceil(lockSeconds * 1000 / TICK_MS - 1e-9)
      ) >>> 0;
      // Keep the whole old 30-lock + 38-cool rhythm on floor recovery. Otherwise a recent pressure receipt
      // would add the engaged bonus after the minimum lock and restart earlier than the learned 68th tick.
      c.drive.recoveryDebtF = Math.max(
        c.drive.recoveryDebtF,
        lockSeconds,
        this.beamEmptyRecoveryTicks(c) * TICK_MS / 1000,
      );
      c.drive.beamRequireRelease = true;
    } else {
      const recoveryMultiplier =
        (1 + AUG_BEAM_COOL_PER * c.beamVentStacks) * c.mods.beamVentMult;
      c.drive.beamRecoveryEndTick = (
        this.state.tick +
        Math.ceil(BEAM_RECOVERY_SECONDS / recoveryMultiplier * 1000 / TICK_MS - 1e-9)
      ) >>> 0;
    }
    const weapon = WEAPONS[player.weapon];
    if (weapon?.beam) this.syncRestingBeamRow(player, id, c, weapon);
    else this.state.beams.delete(id);
  }

  /** Hard cancellation for swaps/death/teleports/parry. Early/escape cancels pay the 20-heat commitment. */
  private cancelBeam(
    player: PlayerState,
    id: string,
    c: CombatState,
    addCancelCost: boolean,
    removeRow: boolean,
  ): void {
    this.flushBeamDamage(c, false, id);
    const descriptor = c.beamDescriptor;
    const committedPhase = c.beamPhase !== 0;
    if (descriptor && addCancelCost && committedPhase) {
      const weapon = WEAPONS[descriptor.weaponId];
      if (weapon) {
        const instanceId = player.slots[player.activeSlot]?.instanceId || weapon.id;
        this.trySpendWeaponResource(
          player,
          c,
          weapon,
          instanceId,
          CombatDelivery.Beam,
          0,
          BEAM_RECOVERY_SECONDS,
          1,
          0,
          "beam-cancel",
        );
      }
      const recoveryMultiplier =
        (1 + AUG_BEAM_COOL_PER * c.beamVentStacks) * c.mods.beamVentMult;
      c.drive.beamRecoveryEndTick = (
        this.state.tick +
        Math.ceil(BEAM_RECOVERY_SECONDS / recoveryMultiplier * 1000 / TICK_MS - 1e-9)
      ) >>> 0;
      c.drive.beamRequireRelease = this.inputs.get(id)?.held.fireHeld === true;
    }
    c.beamPhase = 0;
    c.beamPhaseT = 0;
    c.beamChannelT = 0;
    c.beamPulseT = 0;
    c.beamQuantumT = 0;
    c.beamPendingDamage.clear();
    if (removeRow) {
      c.beamDescriptor = undefined;
      this.state.beams.delete(id);
    } else if (descriptor && WEAPONS[player.weapon]?.beam) {
      this.syncRestingBeamRow(
        player,
        id,
        c,
        WEAPONS[player.weapon]!,
      );
    }
  }

  private syncRestingBeamRow(
    player: PlayerState,
    id: string,
    c: CombatState,
    weapon: WeaponDef,
  ): void {
    const lockActive =
      c.drive.beamLockEndTick !== 0 && !tickReached(this.state.tick, c.drive.beamLockEndTick);
    const recoveryActive =
      c.drive.beamRecoveryEndTick !== 0 && !tickReached(this.state.tick, c.drive.beamRecoveryEndTick);
    const awaitingThreshold =
      c.drive.beamLockEndTick !== 0 && this.drivePendingValue(c) + 1e-9 < DRIVE_BEAM_RESTART_THRESHOLD;
    if (!lockActive && !recoveryActive && !awaitingThreshold && !c.drive.beamRequireRelease) {
      this.state.beams.delete(id);
      if (c.beamPhase === 0) c.beamDescriptor = undefined;
      return;
    }
    const descriptor =
      c.beamDescriptor?.weaponId === weapon.id
        ? c.beamDescriptor
        : beamDescriptorFor(weapon, this.state.tick, 0, 1, 1);
    const overheated = lockActive || c.drive.beamRequireRelease;
    const spentFraction = 1 - this.drivePendingValue(c) / DRIVE_CAPACITY;
    this.syncBeamRow(
      player,
      id,
      c,
      descriptor,
      overheated ? BeamPhase.Overheated : BeamPhase.Cooling,
      c.beamPreviousLength,
      overheated ? 1 : spentFraction,
    );
  }

  private syncBeamRow(
    player: PlayerState,
    id: string,
    c: CombatState,
    descriptor: BeamDescriptor,
    phase: number,
    length: number,
    intensity: number,
  ): BeamState {
    let row = this.state.beams.get(id);
    if (!row) {
      row = new BeamState();
      row.ownerId = id;
      this.state.beams.set(id, row);
    }
    if (row.phase !== phase) row.phaseStartTick = this.state.tick;
    const reach = weaponMuzzleReach(WEAPONS[descriptor.weaponId], characterScale(player.character));
    const originX = player.x + Math.cos(c.beamAngle) * reach;
    const originY = player.y + Math.sin(c.beamAngle) * reach;
    row.weaponId = descriptor.weaponId;
    row.seq = descriptor.startSeq;
    row.startSeq = descriptor.startSeq;
    row.phase = phase;
    row.originX = originX;
    row.originY = originY;
    row.previousAngle = c.beamPreviousAngle;
    row.angle = c.beamAngle;
    row.effectiveLength = length;
    row.length = length;
    row.width = descriptor.width;
    row.halfWidth = descriptor.width / 2;
    // Schema-30 compatibility alias only. Gameplay never reads this field; the shared bar is the heat.
    row.heat = 1 - this.drivePendingValue(c) / DRIVE_CAPACITY;
    row.intensity = Math.max(0, Math.min(1, intensity));
    row.element = WEAPONS[descriptor.weaponId]?.tags.element ?? "physical";
    row.previousOriginX = c.beamPreviousX;
    row.previousOriginY = c.beamPreviousY;
    row.previousLength = c.beamPreviousLength;
    return row;
  }

  /** Exact ray truncation against arena edges and colliding POI/belt circles. */
  private clipBeamLength(
    ox: number,
    oy: number,
    angle: number,
    authoredRange: number,
    halfWidth: number,
  ): number {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    let length = authoredRange;
    const minX = halfWidth;
    const maxX = ARENA_WIDTH - halfWidth;
    const minY = halfWidth;
    const maxY = ARENA_HEIGHT - halfWidth;
    if (dx > 1e-6) length = Math.min(length, (maxX - ox) / dx);
    else if (dx < -1e-6) length = Math.min(length, (minX - ox) / dx);
    if (dy > 1e-6) length = Math.min(length, (maxY - oy) / dy);
    else if (dy < -1e-6) length = Math.min(length, (minY - oy) / dy);

    if (this.belt && this.beltLevel) {
      for (const obstacle of this.beltLevel.obstacles) {
        length = this.rayCircleLength(
          ox,
          oy,
          dx,
          dy,
          obstacle.x,
          BELT_Y0 + obstacle.depth,
          obstacle.r + halfWidth,
          length,
        );
      }
    } else {
      length = clipPoiRayLength(
        this.map.poiCollisionIndex,
        ox,
        oy,
        dx,
        dy,
        halfWidth,
        length,
      );
    }
    return Math.max(0, Math.min(authoredRange, length));
  }

  private rayCircleLength(
    ox: number,
    oy: number,
    dx: number,
    dy: number,
    cx: number,
    cy: number,
    radius: number,
    current: number,
  ): number {
    const rx = ox - cx;
    const ry = oy - cy;
    const c = rx * rx + ry * ry - radius * radius;
    if (c <= 0) return 0;
    const b = rx * dx + ry * dy;
    const disc = b * b - c;
    if (disc < 0) return current;
    const t = -b - Math.sqrt(disc);
    return t >= 0 && t < current ? t : current;
  }

  /** One broad-phase query for the complete previous→current swept capsule union. */
  private damageBeamSweep(
    player: PlayerState,
    c: CombatState,
    descriptor: BeamDescriptor,
    dt: number,
  ): number {
    const reach = weaponMuzzleReach(WEAPONS[descriptor.weaponId], characterScale(player.character));
    const currentX = player.x + Math.cos(c.beamAngle) * reach;
    const currentY = player.y + Math.sin(c.beamAngle) * reach;
    const angularDelta = shortestAngleDelta(c.beamPreviousAngle, c.beamAngle);
    const originTravel = Math.hypot(currentX - c.beamPreviousX, currentY - c.beamPreviousY);
    const samples = beamSweepSampleCount(
      originTravel,
      angularDelta,
      descriptor.range,
      descriptor.width / 2,
    );
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (let sample = 0; sample <= samples; sample++) {
      const f = sample / samples;
      const sx = c.beamPreviousX + (currentX - c.beamPreviousX) * f;
      const sy = c.beamPreviousY + (currentY - c.beamPreviousY) * f;
      const angle = c.beamPreviousAngle + angularDelta * f;
      const length = this.clipBeamLength(sx, sy, angle, descriptor.range, descriptor.width / 2);
      this.beamSampleX[sample] = sx;
      this.beamSampleY[sample] = sy;
      this.beamSampleLength[sample] = length;
      const ex = sx + Math.cos(angle) * length;
      const ey = sy + Math.sin(angle) * length;
      this.beamSampleEndX[sample] = ex;
      this.beamSampleEndY[sample] = ey;
      minX = Math.min(minX, sx, ex);
      minY = Math.min(minY, sy, ey);
      maxX = Math.max(maxX, sx, ex);
      maxY = Math.max(maxY, sy, ey);
    }
    const broadPad = descriptor.width / 2 + MAX_ENEMY_RADIUS;
    this.enemyGrid.queryAabb(
      minX - broadPad,
      minY - broadPad,
      maxX + broadPad,
      maxY + broadPad,
      this.enemyCandidates,
    );
    c.beamHitIds.clear();
    for (const enemyId of this.enemyCandidates) {
      const enemy = this.state.enemies.get(enemyId);
      if (!enemy || enemy.hp <= 0) continue;
      const radius = ENEMY_KINDS[enemy.kind]?.radius ?? ENEMY_RADIUS;
      for (let sample = 0; sample <= samples; sample++) {
        if (
          bladeHitsCircleXY(
            this.beamSampleX[sample]!,
            this.beamSampleY[sample]!,
            this.beamSampleEndX[sample]!,
            this.beamSampleEndY[sample]!,
            enemy.x,
            enemy.y,
            radius,
            descriptor.width / 2,
          )
        ) {
          c.beamHitIds.add(enemyId);
          break;
        }
      }
    }
    let wormHitCount = 0;
    const runtime = this.bossController?.wormRuntime;
    if (runtime) {
      this.wormSegmentGrid.queryAabb(
        minX - descriptor.width / 2 - 52,
        minY - descriptor.width / 2 - 52,
        maxX + descriptor.width / 2 + 52,
        maxY + descriptor.width / 2 + 52,
        this.wormSegmentCandidates,
      );
      for (const slot of this.wormSegmentCandidates) {
        if (wormHitCount >= 2) break;
        for (let sample = 0; sample <= samples; sample++) {
          if (
            bladeHitsCircleXY(
              this.beamSampleX[sample]!,
              this.beamSampleY[sample]!,
              this.beamSampleEndX[sample]!,
              this.beamSampleEndY[sample]!,
              runtime.x[slot]!,
              runtime.y[slot]!,
              runtime.segmentRadius(slot),
              descriptor.width / 2,
            )
          ) {
            c.beamHitIds.add(`worm:${slot}:${runtime.segmentGeneration(slot)}`);
            wormHitCount++;
            break;
          }
        }
      }
    }
    const targetCount = c.beamHitIds.size - wormHitCount + (wormHitCount > 0 ? 1 : 0);
    const stepDamage = beamStepDamage(descriptor.damagePerSecond, dt, targetCount);
    for (const enemyId of c.beamHitIds) {
      c.beamPendingDamage.set(
        enemyId,
        (c.beamPendingDamage.get(enemyId) ?? 0) + stepDamage,
      );
    }
    c.beamPulseT += dt;
    c.beamQuantumT += dt;
    if (c.beamPulseT + 1e-9 >= descriptor.tickRate) {
      c.beamPulseT -= descriptor.tickRate;
      const allowCrit = c.beamQuantumT + 1e-9 >= BEAM_CRIT_QUANTUM_SECONDS;
      if (allowCrit) c.beamQuantumT -= BEAM_CRIT_QUANTUM_SECONDS;
      this.flushBeamDamage(c, allowCrit, player.id);
    }
    this.beamCurrentX = currentX;
    this.beamCurrentY = currentY;
    this.beamCurrentLength = this.beamSampleLength[samples]!;
    return this.beamCurrentLength;
  }

  private flushBeamDamage(c: CombatState, allowCrit: boolean, sourceId = "beam"): void {
    if (c.beamPendingDamage.size === 0) return;
    const kills: string[] = [];
    const sourcePlayer = this.state.players.get(sourceId);
    const sourceWeaponId = c.beamDescriptor?.weaponId ?? sourcePlayer?.weapon ?? "";
    this.wormHitSlots.length = 0;
    let wormDamage = 0;
    for (const [enemyId, damage] of c.beamPendingDamage) {
      if (enemyId.startsWith("worm:")) {
        const slot = Number(enemyId.split(":")[1]);
        if (Number.isInteger(slot)) this.wormHitSlots.push(slot);
        wormDamage = Math.max(wormDamage, damage);
        continue;
      }
      const enemy = this.state.enemies.get(enemyId);
      if (enemy && enemy.hp > 0 && damage > 0) {
        this.damageEnemy(
          enemy,
          enemyId,
          damage,
          kills,
          allowCrit ? c.beamCrit : 0,
          sourcePlayer?.id ?? "",
          sourceWeaponId,
          CombatDelivery.Beam,
          sourcePlayer?.x ?? enemy.x,
          sourcePlayer?.y ?? enemy.y,
        );
      }
    }
    this.damageWormSlots(
      this.wormHitSlots,
      wormDamage,
      `beam:${sourceId}:${this.state.tick}`,
      kills,
      allowCrit ? c.beamCrit : 0,
      true,
      sourcePlayer?.id ?? "",
      sourceWeaponId,
      CombatDelivery.Beam,
      sourcePlayer?.x ?? 0,
      sourcePlayer?.y ?? 0,
    );
    c.beamPendingDamage.clear();
    for (const enemyId of kills) {
      this.state.enemies.delete(enemyId);
      this.enemyGrid.remove(enemyId);
    }
  }

  private stepMeleeSwings(dt: number): void {
    if (this.meleeSwings.size === 0) return;
    const kills: string[] = [];
    for (const [pid, sw] of this.meleeSwings) {
      const playerId = sw.playerId;
      const player = this.state.players.get(playerId);
      if (!player?.alive) {
        this.meleeSwings.delete(pid);
        continue;
      }
      const p0 = swingEdgeProgress(sw.swing, sw.elapsed);
      sw.elapsed += dt;
      const p1 = swingEdgeProgress(sw.swing, sw.elapsed);
      if (p1 <= p0) {
        if (sw.elapsed >= sw.swing.activeEndSeconds) this.meleeSwings.delete(pid);
        continue;
      }
      const critC = sw.crit;
      if (this.belt) {
        // §29 BELT melee is LANE-based (SoR4 model), not the top-down angular sweep: a hit needs horizontal
        // reach in the facing direction AND depth alignment |Δy| ≤ DEPTH_TOL_PLAYER (+ the target radius).
        // A blade that whiffs because the mob is a hair nearer/farther in the shallow band feels awful; this
        // is the fairness lever the belt constants were authored for. Tested once/tick during the descriptor's
        // active interval (hit-once via `sw.hit`) so a mob walking into your swing still gets clipped.
        const facing = Math.cos(sw.aim0) >= 0 ? 1 : -1;
        this.enemyGrid.queryAabb(
          player.x - (facing > 0 ? MAX_ENEMY_RADIUS * 0.5 : sw.range),
          player.y - DEPTH_TOL_PLAYER - MAX_ENEMY_RADIUS,
          player.x + (facing > 0 ? sw.range : MAX_ENEMY_RADIUS * 0.5),
          player.y + DEPTH_TOL_PLAYER + MAX_ENEMY_RADIUS,
          this.enemyCandidates,
        );
        for (const eid of this.enemyCandidates) {
          const enemy = this.state.enemies.get(eid);
          if (!enemy || sw.hit.has(eid) || enemy.hp <= 0) continue; // once/swing; skip dead/stale ids
          const r = ENEMY_KINDS[enemy.kind]?.radius ?? ENEMY_RADIUS;
          const fx = (enemy.x - player.x) * facing; // forward distance along the belt (in front = positive)
          if (fx < -r * 0.5 || fx > sw.range) continue; // behind us, or beyond blade reach
          // Depth window: generous for the attacker, but a mob actively rolling in depth (dodgeState) shrinks
          // its own hurtbox depth (DEPTH_DODGE_MULT) so a well-timed roll genuinely slips the swing.
          const rolling = (this.dodgeState.get(eid)?.t ?? 0) > 0;
          const depthWin = DEPTH_TOL_PLAYER + r * (rolling ? DEPTH_DODGE_MULT : 1);
          if (Math.abs(enemy.y - player.y) > depthWin) continue;
          sw.hit.add(eid);
          this.damageEnemy(
            enemy,
            eid,
            sw.edgeDamage,
            kills,
            critC,
            playerId,
            sw.weaponId,
            CombatDelivery.Melee,
            player.x,
            player.y,
          );
        }
        const runtime = this.bossController?.wormRuntime;
        if (runtime) {
          this.wormHitSlots.length = 0;
          this.wormSegmentGrid.queryAabb(
            player.x - (facing > 0 ? 26 : sw.range),
            player.y - DEPTH_TOL_PLAYER - 52,
            player.x + (facing > 0 ? sw.range : 26),
            player.y + DEPTH_TOL_PLAYER + 52,
            this.wormSegmentCandidates,
          );
          for (const slot of this.wormSegmentCandidates) {
            const hitKey = `worm:${slot}:${runtime.segmentGeneration(slot)}`;
            if (sw.hit.has(hitKey)) continue;
            const r = runtime.segmentRadius(slot);
            const fx = (runtime.x[slot]! - player.x) * facing;
            if (fx < -r * 0.5 || fx > sw.range || Math.abs(runtime.y[slot]! - player.y) > DEPTH_TOL_PLAYER + r) continue;
            sw.hit.add(hitKey);
            this.wormHitSlots.push(slot);
          }
          this.damageWormSlots(
            this.wormHitSlots,
            sw.edgeDamage,
            `melee:${playerId}:${player.attackSeq}`,
            kills,
            critC,
            false,
            playerId,
            sw.weaponId,
            CombatDelivery.Melee,
            player.x,
            player.y,
          );
        }
        if (sw.elapsed >= sw.swing.activeEndSeconds) this.meleeSwings.delete(pid);
        continue;
      }
      // §50 SPIN weapons sweep MULTIPLE revolutions per swing (whirlwind swingArc = 4π), but hit-once
      // spanned the whole swing — a held whirlwind "blink hit" each enemy once per press despite the blade
      // visibly crossing them every turn (playtest). WYSIWYG: each completed 2π re-arms the hit set, so
      // every revolution the blade actually sweeps through an enemy damages it again.
      if (sw.swingArc > Math.PI * 2 + 1e-6) {
        const rev0 = Math.floor((sw.swingArc * p0) / (Math.PI * 2));
        const rev1 = Math.floor((sw.swingArc * p1) / (Math.PI * 2));
        if (rev1 > rev0) sw.hit.clear();
      }
      const steps = Math.max(1, Math.ceil((sw.swingArc * (p1 - p0)) / MELEE_SAMPLE_STEP));
      const wielder = { x: player.x, y: player.y };
      this.enemyGrid.queryRadius(
        player.x,
        player.y,
        sw.range + sw.halfWidth + MAX_ENEMY_RADIUS,
        this.enemyCandidates,
      );
      const runtime = this.bossController?.wormRuntime;
      this.wormHitSlots.length = 0;
      if (runtime) {
        this.wormSegmentGrid.queryRadius(
          player.x,
          player.y,
          sw.range + sw.halfWidth + 52,
          this.wormSegmentCandidates,
        );
      }
      for (let s = 1; s <= steps; s++) {
        const angle = bladeAngleAt(sw.aim0, sw.swingArc, p0 + ((p1 - p0) * s) / steps);
        for (const eid of this.enemyCandidates) {
          const enemy = this.state.enemies.get(eid);
          if (!enemy || sw.hit.has(eid) || enemy.hp <= 0) continue; // once/swing; skip dead/stale ids
          const r = ENEMY_KINDS[enemy.kind]?.radius ?? ENEMY_RADIUS;
          if (bladeHitsCircle(wielder, angle, sw.range, enemy, r, sw.halfWidth)) {
            sw.hit.add(eid);
            this.damageEnemy(
              enemy,
              eid,
              sw.edgeDamage,
              kills,
              critC,
              playerId,
              sw.weaponId,
              CombatDelivery.Melee,
              player.x,
              player.y,
            );
          }
        }
        if (runtime) {
          for (const slot of this.wormSegmentCandidates) {
            const hitKey = `worm:${slot}:${runtime.segmentGeneration(slot)}`;
            if (sw.hit.has(hitKey)) continue;
            if (
              bladeHitsCircle(
                wielder,
                angle,
                sw.range,
                { x: runtime.x[slot]!, y: runtime.y[slot]! },
                runtime.segmentRadius(slot),
                sw.halfWidth,
              )
            ) {
              sw.hit.add(hitKey);
              this.wormHitSlots.push(slot);
            }
          }
        }
      }
      this.damageWormSlots(
        this.wormHitSlots,
        sw.edgeDamage,
        `melee:${playerId}:${player.attackSeq}:${Math.floor((sw.swingArc * p1) / (Math.PI * 2))}`,
        kills,
        critC,
        false,
        playerId,
        sw.weaponId,
        CombatDelivery.Melee,
        player.x,
        player.y,
      );
      if (sw.elapsed >= sw.swing.activeEndSeconds) this.meleeSwings.delete(pid);
    }
    for (const eid of kills) this.state.enemies.delete(eid);
  }

  /** §12: XP is SQUAD-SHARED — every kill levels the whole squad in lockstep (not just the killer). */
  /** End every threat before the first celebration patch; player clocks/position remain untouched. */
  private beginVastagharClear(x: number, y: number): void {
    const encounter = this.vastagharEncounter;
    if (!encounter || encounter.state.mode === VastagharMode.Victory) return;
    encounter.beginVictory(this.state.tick, this.bossSink);
    this.vastagharVictoryX = x;
    this.vastagharVictoryY = y;
    this.vastagharVictoryReadyTick = (this.state.tick + 40) >>> 0;
    this.vastagharCoreArmTick = 0;
    this.vastagharVictoryMode = this.state.mode === "bossrush" ? "bossrush" : "arena";
    this.vastagharCoreId = "";
    this.bossController?.dispose(this.bossSink, this.state.tick);
    this.bossController = null;
    this.bossId = null;
    this.bossPetAwardEligible = false;
    this.state.bossPhase = 0;
    this.state.enemies.clear();
    this.enemyGrid.clear();
    this.wormSegmentGrid.clear();
    this.state.projectiles.clear();
    this.projectileMeta.clear();
    this.hostileProjectileCount = 0;
    this.state.zones.clear();
    this.zoneMeta.clear();
    this.enemyFireCd.clear();
    this.zonerDropCd.clear();
    this.comboState.clear();
    this.duelTokens.clear();
    this.dodgeState.clear();
    this.poundEnemyEffects.clear();
    this.ultimateStunUntil.clear();
    this.ultimateBrands.clear();
    this.bossAddIds.clear();
    this.bossAddExpireTick.clear();
    this.state.telegraphs.clear();
  }

  /** Advances the authoritative 0.9s collapse, then respects the crown's arm/read before cleanup flight. */
  private stepVastagharVictory(): void {
    const encounter = this.vastagharEncounter;
    if (!encounter || encounter.state.mode !== VastagharMode.Victory) return;
    if (encounter.advanceVictory(this.state.tick)) this.mintVastagharVictoryCore();
    if (
      this.vastagharCoreId &&
      !this.xpBoundary &&
      ((this.state.tick - this.vastagharCoreArmTick) | 0) >= 0
    ) this.beginXpBoundary("boss-clear");
  }

  /** Fold every unpaid field packet into one reserved, unmergeable crown; exact value is conserved. */
  private mintVastagharVictoryCore(): void {
    const encounter = this.vastagharEncounter;
    if (!encounter || this.vastagharCoreId) return;
    let fieldValue = 0;
    this.state.xpEchoes.forEach((echo) => {
      if (!echo.delivered) fieldValue += echo.value;
    });
    this.state.xpEchoes.clear();
    this.xpFlights.clear();
    this.lockedWormEchoIds.clear();
    const bossXp = bossDefFor("world-titan").vastaghar?.bossXp ?? 110;
    const total = conserveVastagharVictoryXp(fieldValue, bossXp);
    const core = new XpEchoState();
    core.id = `vastaghar-core:${this.xpEchoSeq++}`;
    core.x = this.vastagharVictoryX;
    core.y = this.vastagharVictoryY;
    core.value = total;
    core.seed = (Math.imul(this.xpEchoSeq, 40503) + Math.imul(this.state.tick, 7919)) & 0xffff;
    core.bornTick = this.state.tick;
    this.state.xpEchoes.set(core.id, core);
    this.vastagharCoreId = core.id;
    this.vastagharCoreArmTick = (this.state.tick + this.xpEchoArmTicks(core.value)) >>> 0;
    encounter.setVictoryEcho(core.id, core.value);
  }

  private completeVastagharClear(): void {
    const encounter = this.vastagharEncounter;
    if (!encounter) return;
    this.state.players.forEach((player) => {
      if (player.alive) return;
      player.alive = true;
      player.hp = Math.max(1, Math.round(player.maxHp * REVIVE_HP_FRAC));
      player.revivedSeq = (player.revivedSeq + 1) % 100000;
      this.zeroMoveVel(player.id);
      this.vastagharDownTicks.delete(player.id);
    });
    encounter.markRewardsOpen(this.state.tick);
    this.state.bossKind = "";
    if (this.vastagharVictoryMode === "bossrush") {
      this.advanceBossRush(this.vastagharVictoryX, this.vastagharVictoryY);
    } else {
      this.openPortal(this.vastagharVictoryX, this.vastagharVictoryY);
      if (this.state.mode === "arena") {
        const loot = this.vastagharLootPoint();
        this.dropLoot(loot.x, loot.y, 1, LOOT_TIER_LUK_BOSS);
      }
    }
    this.vastagharVictoryMode = "";
  }

  private vastagharLootPoint(): Vec2 {
    const separation = EXTRACT_RADIUS + PICKUP_RADIUS + 32;
    const separation2 = separation * separation;
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const candidate = safeSpawnPos(
        this.map,
        this.vastagharVictoryX + Math.cos(angle) * 240,
        this.vastagharVictoryY + Math.sin(angle) * 240,
        PICKUP_RADIUS,
      );
      const ex = candidate.x - this.state.portalX;
      const ey = candidate.y - this.state.portalY;
      const rx = candidate.x - this.state.riftX;
      const ry = candidate.y - this.state.riftY;
      if (ex * ex + ey * ey >= separation2 && rx * rx + ry * ry >= separation2) return candidate;
    }
    return safeSpawnPos(
      this.map,
      this.vastagharVictoryX + 320,
      this.vastagharVictoryY,
      PICKUP_RADIUS,
    );
  }

  private grantXp(amount: number): void {
    this.state.players.forEach((player) => {
      levelUpPlayer(player, amount);
    });
  }

  /** Coarse value tier shared by arm timing and the painted client silhouette. */
  private xpEchoTier(value: number): number {
    if (value <= 1) return 0;
    if (value <= 4) return 1;
    if (value <= 15) return 2;
    if (value <= 35) return 3;
    return 4;
  }

  private xpEchoArmTicks(value: number): number {
    const ms = Math.min(
      XP_ECHO_ARM_MAX_MS,
      XP_ECHO_ARM_MS + this.xpEchoTier(value) * XP_ECHO_ARM_TIER_MS,
    );
    return Math.ceil(ms / TICK_MS);
  }

  /** First Mote-Reach build hook. The id is reserved until its authored card lands; baseline is 180px. */
  private xpMoteReach(player: PlayerState): number {
    let stacks = 0;
    for (const id of player.augments.split(",")) {
      if (id === "mote-reach") stacks++;
    }
    return clamp(
      BASE_XP_MOTE_REACH * (1 + stacks * XP_MOTE_REACH_PER_STACK) +
        (this.petRuns.get(player.id)?.mods.xpMoteReachAdd ?? 0),
      XP_MOTE_REACH_MIN,
      XP_MOTE_REACH_MAX,
    );
  }

  /** A capped squad has no progression receipt, so paid deaths do not leave misleading collectibles. */
  private hasXpRecipient(): boolean {
    let has = false;
    this.state.players.forEach((player) => {
      if (player.level < LEVEL_CAP) has = true;
    });
    return has;
  }

  /**
   * Convert one paid death into a bounded authoritative Echo. Spatial/temporal merges preserve exact value;
   * at the hard cap a new kill feeds a resting packet, or the earliest guaranteed flight when all are latched.
   */
  private dropXp(x: number, y: number, value: number): void {
    const amount = Math.max(0, Math.floor(value));
    if (amount <= 0 || !this.hasXpRecipient()) return;
    const count = this.state.xpEchoes.size;
    const recentTicks = Math.ceil(XP_ECHO_RECENT_MERGE_MS / TICK_MS);
    const mergeRadius = count < XP_ECHO_DENSE_AT
      ? XP_ECHO_RECENT_MERGE_RADIUS
      : XP_ECHO_DENSE_MERGE_RADIUS;
    const mergeR2 = mergeRadius * mergeRadius;
    let merge: XpEchoState | null = null;
    let mergeD2 = Number.POSITIVE_INFINITY;
    let earliestFlight: XpEchoState | null = null;
    this.state.xpEchoes.forEach((echo) => {
      if (this.lockedWormEchoIds.has(echo.id)) return;
      if (echo.delivered) return;
      if (echo.collectorId) {
        if (!earliestFlight || echo.collectTick < earliestFlight.collectTick) earliestFlight = echo;
        return;
      }
      const dx = echo.x - x;
      const dy = echo.y - y;
      const d2 = dx * dx + dy * dy;
      const recent = ((this.state.tick - echo.bornTick) >>> 0) <= recentTicks;
      const localMerge = count < XP_ECHO_DENSE_AT ? recent && d2 <= mergeR2 : d2 <= mergeR2;
      if (localMerge && d2 < mergeD2) {
        merge = echo;
        mergeD2 = d2;
      }
    });

    if (!merge && count >= MAX_XP_ECHOES) {
      // At cap, distance no longer creates rows: use the nearest resting Echo anywhere on the field.
      this.state.xpEchoes.forEach((echo) => {
        if (this.lockedWormEchoIds.has(echo.id)) return;
        if (echo.delivered || echo.collectorId) return;
        const dx = echo.x - x;
        const dy = echo.y - y;
        const d2 = dx * dx + dy * dy;
        if (d2 < mergeD2) {
          merge = echo;
          mergeD2 = d2;
        }
      });
      merge ??= earliestFlight;
    }
    const mergeTarget = merge as XpEchoState | null;
    if (mergeTarget) {
      mergeTarget.value = Math.min(0xffffffff, mergeTarget.value + amount);
      return;
    }

    const echo = new XpEchoState();
    echo.id = `xp${this.xpEchoSeq++}`;
    echo.x = x;
    echo.y = y;
    echo.value = amount;
    // Stable variety without consuming the combat RNG stream (golden-tick determinism stays intact).
    echo.seed = (Math.imul(this.xpEchoSeq, 40503) + Math.imul(this.state.tick, 7919)) & 0xffff;
    echo.bornTick = this.state.tick;
    const pointBlankCollector = this.nearestXpCollector(echo.x, echo.y, true);
    if (
      pointBlankCollector &&
      Math.hypot(pointBlankCollector.x - echo.x, pointBlankCollector.y - echo.y) <=
        XP_ECHO_POINT_BLANK_REACH
    ) {
      // An overlapping corpse is already at the catch point. Pre-arm it so legacy same-sim-window
      // kill assertions still observe the authoritative arrival, while ordinary drops keep the full settle.
      echo.bornTick = (this.state.tick - this.xpEchoArmTicks(echo.value)) >>> 0;
    }
    this.state.xpEchoes.set(echo.id, echo);
  }

  private dropLockedWormXp(x: number, y: number, value: number): void {
    const amount = Math.max(0, Math.floor(value));
    if (amount <= 0 || !this.hasXpRecipient()) return;
    // A topology transaction may be reached through more than one damage source in the same fixed tick.
    // Keep its visible receipt atomic: one locked Echo row, with all of that tick's escrow folded into it.
    for (const id of this.lockedWormEchoIds) {
      const sameTick = this.state.xpEchoes.get(id);
      if (sameTick?.bornTick !== this.state.tick) continue;
      sameTick.value = Math.min(0xffffffff, sameTick.value + amount);
      return;
    }
    if (this.state.xpEchoes.size >= MAX_XP_ECHOES) {
      const existingId = this.lockedWormEchoIds.values().next().value as string | undefined;
      const existing = existingId ? this.state.xpEchoes.get(existingId) : undefined;
      if (existing) existing.value = Math.min(0xffffffff, existing.value + amount);
      // With no locked row available the value remains terminal escrow and is folded into the core below.
      return;
    }
    const echo = new XpEchoState();
    echo.id = `worm-xp:${this.state.wormBoss.ownerId}:${this.xpEchoSeq++}`;
    echo.x = x;
    echo.y = y;
    echo.value = amount;
    echo.seed = (Math.imul(this.xpEchoSeq, 40503) + Math.imul(this.state.tick, 7919)) & 0xffff;
    echo.bornTick = this.state.tick;
    this.state.xpEchoes.set(echo.id, echo);
    this.lockedWormEchoIds.add(echo.id);
  }

  /** Unlock anatomy trophies first, then mint the one terminal core so the encounter always totals 110 XP. */
  private releaseWormXp(x: number, y: number): void {
    let represented = 0;
    for (const id of this.lockedWormEchoIds) {
      const echo = this.state.xpEchoes.get(id);
      if (!echo) continue;
      represented += echo.value;
      echo.bornTick = (this.state.tick - this.xpEchoArmTicks(echo.value)) >>> 0;
    }
    this.lockedWormEchoIds.clear();
    const coreValue = Math.max(0, WORM_TOTAL_XP - represented);
    if (coreValue <= 0 || !this.hasXpRecipient()) return;
    const core = new XpEchoState();
    core.id = `worm-core:${this.xpEchoSeq++}`;
    core.x = x;
    core.y = y;
    core.value = coreValue;
    core.seed = (Math.imul(this.xpEchoSeq, 40503) + Math.imul(this.state.tick, 7919)) & 0xffff;
    core.bornTick = this.state.tick;
    if (this.state.xpEchoes.size < MAX_XP_ECHOES) {
      this.state.xpEchoes.set(core.id, core);
      return;
    }
    // Cap pressure cannot discard the finale: fold into the strongest now-unlocked packet.
    let target: XpEchoState | null = null;
    this.state.xpEchoes.forEach((echo) => {
      if (!target || echo.value > target.value) target = echo;
    });
    const cappedTarget = target as XpEchoState | null;
    if (cappedTarget) cappedTarget.value = Math.min(0xffffffff, cappedTarget.value + coreValue);
  }

  /** Nearest absolute-distance winner; exact ties resolve by stable session id. */
  private nearestXpCollector(x: number, y: number, requireReach: boolean): PlayerState | null {
    let best: PlayerState | null = null;
    let bestId = "";
    let bestD2 = Number.POSITIVE_INFINITY;
    this.state.players.forEach((player, id) => {
      if (!player.alive || this.inLevelWindow(player)) return;
      const dx = player.x - x;
      const dy = player.y - y;
      const d2 = dx * dx + dy * dy;
      const reach = this.xpMoteReach(player);
      if (requireReach && d2 > reach * reach) return;
      if (d2 < bestD2 || (d2 === bestD2 && (bestId === "" || id.localeCompare(bestId) < 0))) {
        best = player;
        bestId = id;
        bestD2 = d2;
      }
    });
    return best;
  }

  /** No collector may receive more than two authoritative catch packets on one tick. */
  private reserveXpCollectTick(collectorId: string, firstTick: number): number {
    let tick = firstTick >>> 0;
    for (;;) {
      let n = 0;
      this.state.xpEchoes.forEach((echo) => {
        if (!echo.delivered && echo.collectorId === collectorId && echo.collectTick === tick) n++;
      });
      if (n < XP_ECHO_RECEIPTS_PER_COLLECTOR_TICK) return tick;
      tick = (tick + 1) >>> 0;
    }
  }

  private latchXpEcho(
    echo: XpEchoState,
    collector: PlayerState,
    retarget = false,
    cleanup = false,
  ): void {
    const dx = collector.x - echo.x;
    const dy = collector.y - echo.y;
    const distance = Math.hypot(dx, dy);
    const rawSeconds = XP_ECHO_FLIGHT_BASE_SECONDS + distance / XP_ECHO_FLIGHT_DISTANCE_DIVISOR;
    const seconds = cleanup
      ? clamp(rawSeconds, XP_ECHO_CLEANUP_FLIGHT_MIN_SECONDS, XP_ECHO_CLEANUP_FLIGHT_MAX_SECONDS)
      : retarget
        ? clamp(rawSeconds, XP_ECHO_RETARGET_MIN_SECONDS, XP_ECHO_RETARGET_MAX_SECONDS)
        : clamp(rawSeconds, XP_ECHO_FLIGHT_MIN_SECONDS, XP_ECHO_FLIGHT_MAX_SECONDS);
    const flightTicks =
      !retarget && !cleanup && distance <= XP_ECHO_POINT_BLANK_REACH
        ? XP_ECHO_POINT_BLANK_FLIGHT_TICKS
        : Math.max(1, Math.ceil(seconds * (1000 / TICK_MS)));
    echo.collectorId = collector.id;
    echo.launchTick = this.state.tick;
    echo.collectTick = this.reserveXpCollectTick(
      collector.id,
      (this.state.tick + flightTicks) >>> 0,
    );
    echo.delivered = false;

    const inv = distance > 1e-6 ? 1 / distance : 0;
    const fx = dx * inv;
    const fy = dy * inv;
    const nx = -fy;
    const ny = fx;
    const sign = (echo.seed & 1) === 0 ? -1 : 1;
    const back = Math.min(16, distance * 0.06);
    const lateral = Math.min(72, distance * 0.24) * sign;
    this.xpFlights.set(echo.id, {
      targetX: collector.x,
      targetY: collector.y,
      c1x: echo.x - fx * back + nx * lateral,
      c1y: echo.y - fy * back + ny * lateral,
    });
  }

  /** Analytic current point used only when a collector disconnects mid-flight. */
  private sampleXpFlight(echo: XpEchoState, meta: XpFlightMeta): { x: number; y: number } {
    const span = Math.max(1, (echo.collectTick - echo.launchTick) >>> 0);
    const t = clamp(((this.state.tick - echo.launchTick) >>> 0) / span, 0, 1);
    const q = t ** 2.2;
    const dx = meta.targetX - echo.x;
    const dy = meta.targetY - echo.y;
    const distance = Math.hypot(dx, dy);
    const inv = distance > 1e-6 ? 1 / distance : 0;
    const fx = dx * inv;
    const fy = dy * inv;
    const nx = -fy;
    const ny = fx;
    const sign = (echo.seed & 1) === 0 ? -1 : 1;
    const c2x = meta.targetX - fx * Math.min(84, distance * 0.3) - nx * sign * Math.min(28, distance * 0.08);
    const c2y = meta.targetY - fy * Math.min(84, distance * 0.3) - ny * sign * Math.min(28, distance * 0.08);
    const a = 1 - q;
    const bx = a ** 3 * echo.x + 3 * a * a * q * meta.c1x + 3 * a * q * q * c2x + q ** 3 * meta.targetX;
    const by = a ** 3 * echo.y + 3 * a * a * q * meta.c1y + 3 * a * q * q * c2y + q ** 3 * meta.targetY;
    const sw = clamp((t - 0.68) / 0.32, 0, 1);
    const w = sw * sw * (3 - 2 * sw);
    const angle = sign * Math.PI * 0.7 * w;
    const rx = bx - meta.targetX;
    const ry = by - meta.targetY;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return { x: meta.targetX + rx * c - ry * s, y: meta.targetY + rx * s + ry * c };
  }

  /** A guaranteed packet never becomes unpaid because its collector left. Retarget globally or return armed. */
  private retargetXpEcho(echo: XpEchoState): void {
    const meta = this.xpFlights.get(echo.id);
    if (meta) {
      const point = this.sampleXpFlight(echo, meta);
      echo.x = point.x;
      echo.y = point.y;
    }
    this.xpFlights.delete(echo.id);
    echo.collectorId = "";
    echo.launchTick = 0;
    echo.collectTick = 0;
    const next = this.nearestXpCollector(echo.x, echo.y, false);
    if (next) {
      this.latchXpEcho(echo, next, true);
    } else {
      // Already-read value rests indefinitely and can latch as soon as a future eligible player exists.
      echo.bornTick = (this.state.tick - this.xpEchoArmTicks(echo.value)) >>> 0;
    }
  }

  private nearestLivingXpCollector(x: number, y: number): PlayerState | null {
    let best: PlayerState | null = null;
    let bestId = "";
    let bestD2 = Number.POSITIVE_INFINITY;
    this.state.players.forEach((player, id) => {
      if (!player.alive) return;
      const dx = player.x - x;
      const dy = player.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2 || (d2 === bestD2 && (bestId === "" || id.localeCompare(bestId) < 0))) {
        best = player;
        bestId = id;
        bestD2 = d2;
      }
    });
    return best;
  }

  /** Level-10 Lodestar owners claim nearby live rows before the ordinary bounded boundary cleanup. */
  private sweepLodestarEchoes(): void {
    this.state.xpEchoes.forEach((echo) => {
      if (echo.delivered || echo.collectorId || this.lockedWormEchoIds.has(echo.id)) return;
      let best: PlayerState | null = null;
      let bestId = "";
      let bestD2 = Number.POSITIVE_INFINITY;
      this.state.players.forEach((player, playerId) => {
        if (!player.alive || this.inLevelWindow(player)) return;
        const reach = this.petRuns.get(playerId)?.mods.boundaryEchoReach ?? 0;
        if (reach <= 0) return;
        const dx = player.x - echo.x;
        const dy = player.y - echo.y;
        const d2 = dx * dx + dy * dy;
        if (
          d2 <= reach * reach &&
          (d2 < bestD2 || (d2 === bestD2 && (bestId === "" || playerId.localeCompare(bestId) < 0)))
        ) {
          best = player;
          bestId = playerId;
          bestD2 = d2;
        }
      });
      if (best) this.latchXpEcho(echo, best, false, true);
    });
  }

  /** Hold a committed teardown while the bounded field performs its six-per-tick cleanup vacuum. */
  private beginXpBoundary(kind: XpBoundary): void {
    if (this.xpBoundary) return;
    this.sweepLodestarEchoes();
    if (this.state.xpEchoes.size === 0) {
      this.completeXpBoundary(kind);
      return;
    }
    this.xpBoundary = kind;
    this.xpBoundaryStartedTick = this.state.tick;
  }

  private completeXpBoundary(kind: XpBoundary): void {
    this.xpBoundary = null;
    switch (kind) {
      case "extract":
        this.completeExtraction();
        break;
      case "descent":
        this.transitionDimension();
        break;
      case "belt-victory":
        this.enterTerminalOutcome("victory");
        break;
      case "bossrush-victory":
        this.completeBossRushVictory();
        break;
      case "boss-clear":
        this.completeVastagharClear();
        break;
    }
  }

  private completeExtraction(): void {
    let banked = 0;
    this.state.players.forEach((player) => {
      banked += player.salvaged;
      player.salvaged = 0;
    });
    const harvest = Math.round(
      banked *
        Math.min(
          HARVEST_CAP,
          HARVEST_PER_LUK * (this.bestLuk() - 1) * this.bestHarvestMultiplier(),
        ),
    );
    this.state.bankedSalvage += banked + harvest;
    this.state.riftOpen = false;
    this.enterTerminalOutcome("victory");
    console.log(
      `[room ${this.roomId}] run extracted at depth ${this.state.depth} — VICTORY (+${banked}+${harvest} harvest banked, ${this.state.bankedSalvage} total)`,
    );
  }

  private completeBossRushVictory(): void {
    let banked = 0;
    this.state.players.forEach((player) => {
      banked += player.salvaged;
      player.salvaged = 0;
    });
    this.state.bankedSalvage += banked;
    this.enterTerminalOutcome("victory");
    console.log(
      `[room ${this.roomId}] BOSS RUSH cleared all ${BOSS_DEF_IDS.length} bosses — VICTORY (+${banked} banked)`,
    );
  }

  /** At 650ms, conserve the cleanup tail in one final delivered crown before teardown. */
  private foldXpCleanupTail(): void {
    let value = 0;
    let x = 0;
    let y = 0;
    let strongest = -1;
    const unpaid: string[] = [];
    this.state.xpEchoes.forEach((echo, id) => {
      if (echo.delivered) return;
      unpaid.push(id);
      value += echo.value;
      if (echo.value > strongest) {
        strongest = echo.value;
        x = echo.x;
        y = echo.y;
      }
    });
    if (value <= 0) return;
    const collector = this.nearestLivingXpCollector(x, y);
    if (!collector) return;
    for (const id of unpaid) {
      this.state.xpEchoes.delete(id);
      this.xpFlights.delete(id);
    }
    this.grantXp(value);
    const core = new XpEchoState();
    core.id = `xp${this.xpEchoSeq++}`;
    core.x = collector.x;
    core.y = collector.y;
    core.value = Math.min(0xffffffff, value);
    core.seed = (Math.imul(this.xpEchoSeq, 40503) + Math.imul(this.state.tick, 7919)) & 0xffff;
    core.bornTick = this.state.tick;
    core.collectorId = collector.id;
    core.launchTick = this.state.tick;
    core.collectTick = this.state.tick;
    core.delivered = true;
    this.state.xpEchoes.set(core.id, core);
  }

  /**
   * Server-authoritative Reach/magnet rail. Grants happen only at `collectTick`; delivered rows survive one
   * full patch and are deleted on the following simulation tick. Downing never cancels a guaranteed flight.
   */
  private stepXpEchoes(): void {
    if (
      this.vastagharEncounter?.state.mode === VastagharMode.Victory &&
      !this.vastagharCoreId
    ) return;
    // Retire the previous patch's receipts first.
    for (const [id, echo] of this.state.xpEchoes) {
      if (this.lockedWormEchoIds.has(id)) continue;
      if (!echo.delivered) continue;
      this.state.xpEchoes.delete(id);
      this.xpFlights.delete(id);
    }

    if (
      this.xpBoundary === "boss-clear" &&
      this.state.xpEchoes.size === 0 &&
      ((this.state.tick - this.vastagharVictoryReadyTick) | 0) < 0
    ) return;
    if (this.xpBoundary && this.state.xpEchoes.size === 0) {
      this.completeXpBoundary(this.xpBoundary);
      return;
    }

    // Advance guaranteed flights against their collector's latest authoritative chest/body position.
    this.state.xpEchoes.forEach((echo) => {
      if (this.lockedWormEchoIds.has(echo.id)) return;
      if (!echo.collectorId || echo.delivered) return;
      const collector = this.state.players.get(echo.collectorId);
      if (!collector) {
        this.retargetXpEcho(echo);
        return;
      }
      const meta = this.xpFlights.get(echo.id);
      if (meta) {
        meta.targetX = collector.x;
        meta.targetY = collector.y;
      }
      if (this.state.tick < echo.collectTick) return;
      // The flagship never converts add XP into a modal/invulnerability exploit mid-attack. Flights may
      // arrive, but their unpaid values remain authoritative and fold into the reserved death crown.
      if (
        this.vastagharEncounter &&
        this.vastagharEncounter.state.mode !== VastagharMode.Victory
      ) return;
      this.grantXp(echo.value);
      echo.delivered = true;
      this.xpFlights.delete(echo.id);
    });

    if (this.xpBoundary) {
      const cleanupAgeMs = ((this.state.tick - this.xpBoundaryStartedTick) >>> 0) * TICK_MS;
      if (cleanupAgeMs >= XP_ECHO_CLEANUP_MAX_MS) {
        this.foldXpCleanupTail();
        return;
      }
      const resting = [...this.state.xpEchoes.values()]
        .filter((echo) => !echo.delivered && !echo.collectorId)
        .sort((a, b) => b.value - a.value || a.id.localeCompare(b.id));
      let launched = 0;
      for (const echo of resting) {
        if (launched >= XP_ECHO_CLEANUP_LAUNCHES_PER_TICK) break;
        const collector = this.nearestXpCollector(echo.x, echo.y, false);
        if (!collector) break;
        this.latchXpEcho(echo, collector, false, true);
        launched++;
      }
      return;
    }

    // New latches happen after movement. Admission limits form a stream under dense clears.
    let roomLaunches = 0;
    const perCollector = new Map<string, number>();
    this.state.xpEchoes.forEach((echo) => {
      if (this.lockedWormEchoIds.has(echo.id)) return;
      if (roomLaunches >= XP_ECHO_LAUNCHES_PER_ROOM_TICK || echo.collectorId || echo.delivered) return;
      if (((this.state.tick - echo.bornTick) >>> 0) < this.xpEchoArmTicks(echo.value)) return;
      const collector = this.nearestXpCollector(echo.x, echo.y, true);
      if (!collector) return;
      const launched = perCollector.get(collector.id) ?? 0;
      if (launched >= XP_ECHO_LAUNCHES_PER_COLLECTOR_TICK) return;
      this.latchXpEcho(echo, collector);
      perCollector.set(collector.id, launched + 1);
      roomLaunches++;
    });
  }

  /** §classmerge/§8 window: on timeout drain every owed allocation decision through the held weapon's
   *  deterministic default (+2 pick +1 ballast), then resolve one signature offer. */
  private tickLevelWindows(dt: number): void {
    this.state.players.forEach((player) => {
      // Open the augment draft for any signature pick that doesn't have one yet (server-authoritative roll).
      if (player.sigPending > 0 && !player.sigOffer) {
        // G-09 reads the lane captured at the signature level edge; swapping during the window cannot
        // rewrite it. Legacy/manual pending picks snapshot once here as a compatibility fallback.
        if (!player.sigGateQueue) {
          player.sigGateQueue = augmentGateForWeapon(WEAPONS[player.weapon]);
        }
        const sep = player.sigGateQueue.indexOf(";");
        const gate = sep < 0 ? player.sigGateQueue : player.sigGateQueue.slice(0, sep);
        player.sigOffer = draftAugments(Math.random, augmentDeliveriesForGate(gate)).join(",");
      }
      if (!this.inLevelWindow(player)) {
        if (player.flexTimer !== 0) player.flexTimer = 0;
        this.syncFlexTimer(player);
        return;
      }
      player.flexTimer -= dt;
      if (player.flexTimer > 0) {
        this.syncFlexTimer(player);
        return;
      }
      // One pass drains stacked level debts; AFK invulnerability never stretches to N×5 seconds.
      const timeoutAttr = defaultFlexAttr(WEAPONS[player.weapon]);
      while (player.flexPending > 0) {
        applyAllocationChoice(player, timeoutAttr);
        player.flexPending--;
      }
      if (player.sigPending > 0) {
        const first = player.sigOffer.split(",").filter(Boolean)[0];
        if (first) player.augments = player.augments ? `${player.augments},${first}` : first;
        player.sigPending = Math.max(0, player.sigPending - 1);
        player.sigOffer = "";
        this.consumeSignatureGate(player);
      }
      player.flexTimer = this.inLevelWindow(player) ? LEVELUP_WINDOW_SECONDS : 0;
      this.syncFlexTimer(player);
    });
  }

  private consumeSignatureGate(player: PlayerState): void {
    const sep = player.sigGateQueue.indexOf(";");
    player.sigGateQueue = sep < 0 ? "" : player.sigGateQueue.slice(sep + 1);
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
    if (this.vastagharEncounter) {
      this.buildVastagharTargets();
      this.state.bossPhase = this.vastagharEncounter.step(
        dt,
        boss,
        this.vastagharTargets,
        this.state.depth,
        this.state.tick,
        this.bossSink as VastagharEmitSink,
        this.broadcastGeneration,
      );
      this.updateEnemyGrid(this.bossId, boss);
      if (boss.hp <= 0 && this.bossId) {
        const attribution = this.vastagharEncounter.deferredAttribution;
        this.vastagharKillScratch.length = 0;
        this.damageEnemy(
          boss,
          this.bossId,
          0,
          this.vastagharKillScratch,
          0,
          attribution.sourcePlayerId,
          attribution.sourceWeaponId,
          attribution.delivery,
          attribution.sourceX,
          attribution.sourceY,
        );
        for (const id of this.vastagharKillScratch) this.state.enemies.delete(id);
      }
      return;
    }
    this.state.bossPhase = this.bossController.step(
      dt,
      boss,
      bodies,
      this.state.depth,
      this.state.tick,
      this.bossSink,
      this.broadcastGeneration,
    );
    this.updateEnemyGrid(this.bossId, boss);
    this.rebuildWormSegmentGrid();
    for (;;) {
      const reward = this.bossController.drainWormReward();
      if (!reward) break;
      this.dropLockedWormXp(reward.x, reward.y, reward.value);
    }
  }

  /** Tear down the active boss: dispose the controller (removes its in-flight telegraphs), reset the synced
   *  boss fields. Called when the boss dies/vanishes or the run restarts. */
  private clearBoss(): void {
    this.vastagharEncounter?.dispose(this.bossSink as VastagharEmitSink);
    this.vastagharEncounter = null;
    this.vastagharTargets.length = 0;
    this.vastagharDownTicks.clear();
    this.vastagharSweepEpoch.clear();
    this.vastagharVictoryMode = "";
    this.vastagharCoreId = "";
    this.bossController?.dispose(this.bossSink, this.state.tick);
    this.bossController = null;
    this.wormSegmentGrid.clear();
    for (const id of this.lockedWormEchoIds) this.state.xpEchoes.delete(id);
    this.lockedWormEchoIds.clear();
    this.bossId = null;
    this.bossPetAwardEligible = false;
    this.bossAddIds.clear();
    this.bossAddExpireTick.clear();
    this.state.bossPhase = 0;
    this.state.bossKind = "";
    this.state.bossSlamT = 0; // §16 deprecated slam scalars stay at 0
    // Boss disposal owns its rows. Preserve any independently winding horde sectors through a boss death.
    for (const id of [...this.state.telegraphs.keys()]) {
      if (!id.startsWith(MELEE_TELEGRAPH_PREFIX)) this.state.telegraphs.delete(id);
    }
  }

  /** §16 v0.109 the emit surface handed to the BossController — turns a boss def's abstract "casts" into real
   *  sim: hostile projectiles, telegraph rows, corrosive zones, adds, and unparryable AoE. Built once, lazily. */
  private get bossSink(): VastagharEmitSink {
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
          t.ownerId = spec.ownerId ?? "";
          t.castSeq = spec.castSeq ?? 0;
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
        applyQuake: (x, y, radius, damage, knockback) =>
          this.applyBossQuake(x, y, radius, damage, knockback),
        applyVastagharQuake: (x, y, radius, damage, knockback, epoch, out) =>
          this.applyVastagharQuake(x, y, radius, damage, knockback, epoch, out),
        applyVastagharSweep: (
          x,
          y,
          innerRange,
          outerRange,
          halfWidth,
          fromAngle,
          toAngle,
          damage,
          knockback,
          actionSeq,
          revolution,
          airborneAnswers,
          out,
        ) =>
          this.applyVastagharSweep(
            x,
            y,
            innerRange,
            outerRange,
            halfWidth,
            fromAngle,
            toAngle,
            damage,
            knockback,
            actionSeq,
            revolution,
            airborneAnswers,
            out,
          ),
        mutateVastagharArena: (kind, poiIndex) => this.mutateVastagharArena(kind, poiIndex),
        applyMelee: (x, y, aimX, aimY, range, halfArc, damage, knockback) =>
          this.applyBossMelee(x, y, aimX, aimY, range, halfArc, damage, knockback),
        moveBoss: (x, y) => {
          const boss = this.bossId ? this.state.enemies.get(this.bossId) : undefined;
          if (boss) {
            // §36 belt: keep a REPOSITIONING boss on the deck. Bespoke arena bosses now run belt finales, and
            // some (Nihil's blink, Grull's charge) drive moveBoss — un-clamped they'd leave the depth band or
            // float over a pit. Clamp x to the level and y to the floor band (no-op in top-down arena).
            if (this.belt && this.beltLevel) {
              const r = ENEMY_KINDS[boss.kind]?.radius ?? 40;
              boss.x = clamp(x, r, this.beltLevel.length - r);
              boss.y = clampBeltFloorY(this.beltLevel, boss.x, y, r);
            } else {
              boss.x = x;
              boss.y = y;
            }
          }
        },
        hostileProjectiles: () => {
          return this.hostileProjectileCount;
        },
        aliveAdds: () => {
          for (const id of this.bossAddIds) {
            if (!this.state.enemies.has(id)) this.bossAddIds.delete(id);
          }
          return this.bossAddIds.size;
        },
        validateWormPoint: (x, y, radius) => {
          if (this.belt && this.beltLevel) {
            const bx = clamp(x, radius, this.beltLevel.length - radius);
            return { x: beltSafeX(this.beltLevel, bx, bx), y: clampBeltFloorY(this.beltLevel, bx, y, radius) };
          }
          return safeSpawnPos(
            this.map,
            clamp(x, radius, ARENA_WIDTH - radius),
            clamp(y, radius, ARENA_HEIGHT - radius),
            radius,
          );
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

  /** Publish one fixed horde-melee sector without adding a second timing field to the wire contract.
   *  §51 optional style overrides: `danger` 1 = a RED dodge/jump-only combo step (H1's low sweep);
   *  `kindTag` 7 = the deterministic gold/double-glint bait vocabulary (bait step AND empowered return;
   *  still white/parryable — art differs, shape does not). */
  private addMeleeTelegraphRow(
    enemyId: string,
    x: number,
    y: number,
    range: number,
    halfArc: number,
    rot: number,
    phase: number,
    danger = 0,
    kindTag = 6,
  ): string {
    const id = `${MELEE_TELEGRAPH_PREFIX}${enemyId}`;
    const t = new TelegraphState();
    t.id = id;
    t.shape = TgShape.Cone;
    t.x = x;
    t.y = y;
    t.a = range;
    t.b = halfArc;
    t.rot = rot;
    // Creation-only snapshot; clients bind this row to its owner's existing windup scalar via the id.
    t.t = phase;
    t.danger = danger;
    t.kindTag = kindTag;
    this.state.telegraphs.set(id, t);
    return id;
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
      this.damagePlayer(p, damage, "enemy"); // §16 unparryable — dodge it, don't block it
      const d = Math.hypot(dx, dy) || 1;
      const k = addImpulse(p, (dx / d) * knockback, (dy / d) * knockback);
      p.vx = k.vx;
      p.vy = k.vy;
    });
  }

  /** §33 FOOTFALL QUAKE resolve: a ground shockwave you JUMP over or PARRY. Grounded, un-parried players in
   *  the radius take it + a radial shove; AIRBORNE players (mid-jump) clear it; a player in a parry/i-frame
   *  window NEGATES it (white flash — the timing reward). This is the colossus's whole rhythm. */
  private applyBossQuake(
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
      if (p.height > GROUND_EPSILON) return; // JUMPED — airborne clears the quake
      const c = this.combat.get(p.id);
      if (c && c.pitGrace > 0) return; // mercy nullifies damage but is never a rewarded parry
      if (c && c.invuln > 0) {
        p.parriedSeq += 1; // PARRIED (i-frame window) — negate + trigger the white parry flash
        c.parryCd = Math.min(c.parryCd, PARRY_CHAIN_CD);
        this.applyParryAugments(p, c);
        this.bossController?.acceptWormParry(p.id, this.state.tick);
        return;
      }
      this.damagePlayer(p, damage, "enemy");
      const d = Math.hypot(dx, dy) || 1;
      const k = addImpulse(p, (dx / d) * knockback, (dy / d) * knockback);
      p.vx = k.vx;
      p.vy = k.vy;
    });
  }

  /** One-foot-one-epoch flagship quake. Only authoritative jump/parry answers buy Stride/punish credit. */
  private applyVastagharQuake(
    x: number,
    y: number,
    radius: number,
    damage: number,
    knockback: number,
    _epoch: number,
    out: BossCounterSummary,
  ): void {
    out.threatened = 0;
    out.answered = 0;
    out.parried = 0;
    out.airborne = 0;
    out.hit = 0;
    out.lastParrierId = "";
    const r2 = radius * radius;
    this.state.players.forEach((player) => {
      if (!player.alive || this.inLevelWindow(player)) return;
      const dx = player.x - x;
      const dy = player.y - y;
      if (dx * dx + dy * dy > r2) return;
      out.threatened++;
      if (player.height > GROUND_EPSILON) {
        out.airborne++;
        out.answered++;
        return;
      }
      const combat = this.combat.get(player.id);
      if (combat && this.vastagharParryActive(player, combat)) {
        out.parried++;
        out.answered++;
        out.lastParrierId = player.id;
        this.resolveVastagharParry(player, combat, x, y, false);
        return;
      }
      if (
        combat &&
        (combat.pitGrace > 0 || this.slideInvulnerable(combat) || combat.invuln > 0)
      ) {
        if (this.slideInvulnerable(combat)) this.noteSlideDodge(player);
        return;
      }
      out.hit++;
      this.damagePlayer(player, damage, "enemy");
      const distance = Math.hypot(dx, dy) || 1;
      const impulse = addImpulse(
        player,
        (dx / distance) * knockback,
        (dy / distance) * knockback,
      );
      player.vx = impulse.vx;
      player.vy = impulse.vy;
    });
  }

  /** Swept-angular truth with a per-player/per-revolution receipt. A two-turn Worldwheel can hit twice. */
  private applyVastagharSweep(
    x: number,
    y: number,
    innerRange: number,
    outerRange: number,
    halfWidth: number,
    fromAngle: number,
    toAngle: number,
    damage: number,
    knockback: number,
    actionSeq: number,
    revolution: number,
    airborneAnswers: boolean,
    out: BossCounterSummary,
  ): void {
    out.threatened = 0;
    out.answered = 0;
    out.parried = 0;
    out.airborne = 0;
    out.hit = 0;
    out.lastParrierId = "";
    const epoch = (actionSeq << 2) + revolution + 1;
    this.state.players.forEach((player) => {
      if (!player.alive || this.inLevelWindow(player)) return;
      if (this.vastagharSweepEpoch.get(player.id) === epoch) return;
      if (
        !pointInSweptAnnularArc(
          player.x,
          player.y,
          x,
          y,
          innerRange,
          outerRange,
          halfWidth,
          fromAngle,
          toAngle,
          PLAYER_RADIUS,
        )
      ) return;
      this.vastagharSweepEpoch.set(player.id, epoch);
      out.threatened++;
      if (airborneAnswers && player.height > GROUND_EPSILON) {
        out.airborne++;
        out.answered++;
        return;
      }
      const combat = this.combat.get(player.id);
      if (combat && this.vastagharParryActive(player, combat)) {
        out.parried++;
        out.answered++;
        out.lastParrierId = player.id;
        this.resolveVastagharParry(player, combat, x, y, true);
        return;
      }
      if (combat && (this.slideInvulnerable(combat) || combat.invuln > 0)) {
        if (this.slideInvulnerable(combat)) this.noteSlideDodge(player);
        return;
      }
      out.hit++;
      this.damagePlayer(player, damage, "enemy");
      const dx = player.x - x;
      const dy = player.y - y;
      const distance = Math.hypot(dx, dy) || 1;
      const impulse = addImpulse(
        player,
        (dx / distance) * knockback,
        (dy / distance) * knockback,
      );
      player.vx = impulse.vx;
      player.vy = impulse.vy;
    });
  }

  private vastagharParryActive(player: PlayerState, combat: CombatState): boolean {
    if (combat.invuln <= 0 || combat.parryOpenedTick === 0xffffffff) return false;
    const windowSeconds = Math.max(
      PARRY_IFRAMES * combat.mods.parryIFrameMult,
      PARRY_IFRAMES *
        (1 + IRON_STANCE_IFRAME_PER * countAugment(player.augments, "iron-stance")),
    );
    const windowTicks = Math.ceil((windowSeconds * 1000) / TICK_MS);
    return ((this.state.tick - combat.parryOpenedTick) >>> 0) <= windowTicks;
  }

  /** Same personal chain/cooldown/heal/augment ledger as melee parry, without moving the 230px titan root. */
  private resolveVastagharParry(
    player: PlayerState,
    combat: CombatState,
    sourceX: number,
    sourceY: number,
    launch: boolean,
  ): void {
    this.recordPetAcceptedAction(player.id);
    player.parriedSeq = (player.parriedSeq + 1) % 100000;
    combat.parryCd = Math.min(combat.parryCd, PARRY_CHAIN_CD);
    combat.parryChain = combat.parryChainT > 0 ? combat.parryChain + 1 : 1;
    combat.parryChainT = PARRY_CHAIN_WINDOW;
    const heal = PARRY_CHAIN_HEAL * Math.min(combat.parryChain, PARRY_CHAIN_HEAL_MAX_STACKS);
    this.applyHeal(player, heal);
    this.addUltimateFlatCharge(player, combat, ULT_CHARGE_PARRY_BONUS);
    if (launch) {
      const dx = sourceX - player.x;
      const dy = sourceY - player.y;
      const distance = Math.hypot(dx, dy) || 1;
      if (combat.stance !== STANCE_POUND) {
        combat.vh = Math.min(combat.vh + PARRY_LAUNCH, PARRY_LAUNCH_MAX);
        player.vh = combat.vh;
      }
      const impulse = addImpulse(
        player,
        (-dx / distance) * PARRY_PUSH,
        (-dy / distance) * PARRY_PUSH,
      );
      player.vx = impulse.vx;
      player.vy = impulse.vy;
    }
    this.applyParryAugments(player, combat);
    this.applyParryQuirk(player, combat, heal);
  }

  /** POI identity stays at its deterministic seed index; moving the server copy off-map removes collision
   * on the exact synchronized mutation edge while the client consumes `destroyedPoiMask`. */
  private mutateVastagharArena(
    _kind: VastagharArenaMutationKind,
    poiIndex: number,
  ): void {
    if (poiIndex < 0 || poiIndex >= this.map.pois.length || poiIndex === 255) return;
    const poi = this.map.pois[poiIndex];
    if (!poi) return;
    poi.x = -100_000;
    poi.y = -100_000;
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
      this.damagePlayer(p, damage, "enemy");
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
      this.damagePlayer(p, damage, "enemy");
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
    if (this.bossController?.wormRuntime || this.effectiveEnemyBodies() >= MAX_ENEMIES) return;
    if (this.vastagharEncounter && this.bossAddIds.size >= VASTAGHAR_ENCOUNTER.addCap) return;
    const kind = ENEMY_KINDS[kindId];
    if (!kind) return;
    const players = this.livingCount(); // §6 scale adds to who can fight, not who's connected
    const e = new EnemyState();
    e.id = `e${this.enemySeq++}`;
    e.kind = kindId;
    e.hp = kind.hp * enemyHpScale(players) * depthHpScale(this.state.depth);
    // §36 belt: a boss's summoned adds must land ON the deck (the telegraphed spot may be off the depth band
    // now that arena bosses run belt finales) — mirror the trash-spawn clamp. Arena keeps map-safe placement.
    if (this.belt && this.beltLevel) {
      e.x = clamp(x, kind.radius, this.beltLevel.length - kind.radius);
      e.y = clampBeltFloorY(this.beltLevel, e.x, y, kind.radius);
    } else {
      const sp = safeSpawnPos(
        this.map,
        clamp(x, kind.radius, ARENA_WIDTH - kind.radius),
        clamp(y, kind.radius, ARENA_HEIGHT - kind.radius),
        kind.radius,
      );
      e.x = sp.x;
      e.y = sp.y;
    }
    this.state.enemies.set(e.id, e);
    this.insertEnemyGrid(e.id, e);
    this.bossAddIds.add(e.id);
    if (this.vastagharEncounter)
      this.bossAddExpireTick.set(
        e.id,
        (this.state.tick + VASTAGHAR_ENCOUNTER.addLifetimeTicks) >>> 0,
      );
  }

  /** Hard encounter budget: seven-second add life, and no residual add pressure during the solo rez beat. */
  private stepVastagharAddBudget(): void {
    if (!this.vastagharEncounter) return;
    const clearForSoloRez = this.livingCount() <= 1;
    for (const id of this.bossAddIds) {
      const enemy = this.state.enemies.get(id);
      if (!enemy) {
        this.bossAddIds.delete(id);
        this.bossAddExpireTick.delete(id);
        continue;
      }
      const expireTick = this.bossAddExpireTick.get(id);
      if (
        !clearForSoloRez &&
        (expireTick === undefined || ((this.state.tick - expireTick) | 0) < 0)
      ) continue;
      const combo = this.comboState.get(id);
      if (combo?.strike) this.removeTelegraphRow(combo.strike.tg);
      if (combo?.tg) this.removeTelegraphRow(combo.tg);
      if (combo?.targetId && this.duelTokens.get(combo.targetId) === id)
        this.duelTokens.delete(combo.targetId);
      this.state.enemies.delete(id);
      this.enemyFireCd.delete(id);
      this.zonerDropCd.delete(id);
      this.comboState.delete(id);
      this.dodgeState.delete(id);
      this.poundEnemyEffects.delete(id);
      this.ultimateStunUntil.delete(id);
      this.ultimateBrands.delete(id);
      this.bossAddIds.delete(id);
      this.bossAddExpireTick.delete(id);
    }
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
      const target = this.nearestDoorDecoy(enemy) ?? nearestPoint(enemy, bodies);
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
    crit = 0,
    sourcePlayerId = "",
    sourceWeaponId = "",
    delivery = 0,
  ): void {
    // §16 the documented budget is ARENA-wide: reject generic spitters here too. Friendly player fire is
    // deliberately uncapped; a reflected hostile shot changes sides and frees its slot immediately.
    if (
      this.state.outcome !== "active" ||
      (hostile && this.hostileProjectileCount >= BOSS_PROJECTILE_BUDGET)
    )
      return;
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
      crit,
      sourcePlayerId,
      sourceWeaponId,
      delivery,
      sourceX: from.x,
      sourceY: from.y,
    });
    if (hostile) this.hostileProjectileCount++;
  }

  /** §16 remove one live projectile while keeping the O(1) hostile admission count exact. */
  private removeProjectile(id: string): void {
    const meta = this.projectileMeta.get(id);
    if (meta?.hostile)
      this.hostileProjectileCount = Math.max(0, this.hostileProjectileCount - 1);
    this.state.projectiles.delete(id);
    this.projectileMeta.delete(id);
  }

  /** §9/§15 fire a GUN — spend one ammo to launch `pellets` friendly bullets down-barrel (a cone for
   *  shotguns / a touch of inaccuracy for autos), each WYSIWYG-scaled, piercing/bouncing/exploding per
   *  the gun's block. Ammo + reload are handled by the caller (mirrors the thrown charge model). */
  /** §37 the PRECISE firing direction: from the shooter's AUTHORITATIVE body toward the CURSOR WORLD POINT the
   *  client sent (targetX/Y), not the client's rig-derived aim VECTOR. The predicted/interpolated rig can lead
   *  the real body while moving, so a direction-only aim skews slightly off the cursor; aiming at the sent
   *  point lands the shot ON the cursor. Falls back to the aim vector if no target was sent. Unit vector. */
  private aimDir(player: PlayerState, c: CombatState): { x: number; y: number } {
    const dx = c.targetX - player.x;
    const dy = c.targetY - player.y;
    const l = Math.hypot(dx, dy);
    return l > 1e-3 ? { x: dx / l, y: dy / l } : { x: c.aimX, y: c.aimY };
  }

  private fireGun(
    player: PlayerState,
    c: CombatState,
    weapon: WeaponDef,
    hand: DualWieldHand = 0,
  ): void {
    const g = weapon.gun;
    if (!g) return;
    const dmg = g.damage * this.heldDamageMult(weapon, g.scalingGrades, player, hand);
    const explode = g.explode
      ? {
          radius: g.explode.radius,
          damage:
            g.explode.damage *
            this.heldDamageMult(weapon, g.explode.scalingGrades ?? g.scalingGrades, player, hand),
        }
      : undefined;
    const pellets = Math.max(1, g.pellets ?? 1);
    const spread = g.spread ?? 0;
    const aim = this.aimDir(player, c); // §37 aim at the cursor POINT, not the rig-derived vector
    const baseAng = Math.atan2(aim.y, aim.x);
    const ttl = g.range / g.projectileSpeed;
    // §38 GUNSLINGER signature augments: Hollow-Points add pierce, Ricochet Rounds add bounces (per stack).
    const pierce = (g.pierce ?? 1) + AUG_GUN_PIERCE_PER * countAugment(player.augments, "hollowpoints");
    const bounces = (g.bounces ?? 0) + AUG_GUN_BOUNCE_PER * countAugment(player.augments, "ricochet-rounds");
    // §9 spawn from the BARREL TIP (player centre + aim × the gun's own muzzle reach), not the body. Scale
    // by the holder's rig size (§7) so the shot lands exactly on the rendered tip, not short of it.
    const reach = gunMuzzleReach(weapon); // §29 fixed-size weapon → fixed muzzle reach
    const mx = player.x + aim.x * reach;
    const my = player.y + aim.y * reach;
    const crit = this.weaponCritChance(player, c); // §ULT Door rider consumes once per trigger pull
    // §35 encode the weapon's ELEMENT onto the bullet kind ("tracer:fire") so the client tints the bullet to
    // its element — a fire and a frost gun read distinct even sharing a bullet shape. Physical = no suffix.
    const el = weapon.tags?.element;
    const bulletKind = el && el !== "physical" ? `${g.bulletKind}:${el}` : g.bulletKind;
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
        bulletKind,
        pierce, // §38 base + Hollow-Points
        ttl,
        explode,
        bounces, // §38 base + Ricochet Rounds
        crit,
        player.id,
        weapon.id,
        CombatDelivery.Gun,
      );
    }
    // §20 RECOIL pushback (Stage A): the shot kicks the body BACKWARD along aim, scaled by the gun's
    // authored `recoil` (which already differentiates a heavy revolver from a light gatling). Per-shot,
    // so a slow heavy gun punches once while a gatling stream accumulates a steady shove (capped).
    const kick = GUN_RECOIL_IMPULSE * ((g.recoil ?? GUN_RECOIL_BASELINE) / GUN_RECOIL_BASELINE);
    const r = addImpulse(player, -aim.x * kick, -aim.y * kick);
    player.vx = r.vx;
    player.vy = r.vy;
  }

  /** §38 CASTER fire — conjure one piercing arcane BOLT down aim (INT-scaled, no ammo). Distinct from a gun
   *  (no magazine/spread; pierces the whole line) and from melee (ranged). Spawns from the same muzzle reach. */
  private fireCast(
    player: PlayerState,
    c: CombatState,
    weapon: WeaponDef,
    hand: DualWieldHand = 0,
  ): void {
    const cast = weapon.cast;
    if (!cast) return;
    // §38 CASTER signature augments: Overcharge boosts bolt damage, Arc Split adds forked bolts (per stack).
    const dmgMul = 1 + AUG_CAST_DMG_PER * countAugment(player.augments, "overcharge");
    const dmg = cast.damage * this.heldCastDamageMult(weapon, cast.scalingGrades, player, hand) * dmgMul;
    const forks = Math.min(AUG_CAST_SPLIT_MAX, AUG_CAST_SPLIT_PER * countAugment(player.augments, "arc-split"));
    const ttl = cast.range / cast.speed;
    const reach = gunMuzzleReach(weapon);
    const aim = this.aimDir(player, c); // §37 aim at the cursor POINT
    const mx = player.x + aim.x * reach;
    const my = player.y + aim.y * reach;
    const crit = this.weaponCritChance(player, c);
    // §35 element-tint the bolt (arcane/shock/void…) so different caster weapons read distinct.
    const el = weapon.tags?.element;
    const bulletKind = el && el !== "physical" ? `orb:${el}` : "orb";
    const baseAng = Math.atan2(aim.y, aim.x);
    // The main bolt + `forks` extra bolts fanned symmetrically around aim (Arc Split).
    for (let i = 0; i <= forks; i++) {
      const ang = baseAng + (i === 0 ? 0 : (i % 2 === 1 ? 1 : -1) * Math.ceil(i / 2) * AUG_CAST_SPLIT_SPREAD);
      this.fireProjectile(
        { x: mx, y: my },
        { x: mx + Math.cos(ang), y: my + Math.sin(ang) },
        cast.speed,
        dmg,
        false,
        bulletKind,
        cast.pierce ?? 99,
        ttl,
        undefined,
        0,
        crit,
        player.id,
        weapon.id,
        CombatDelivery.Cast,
      );
    }
  }

  /** Hurl a thrown weapon at the player's aim — a friendly, STR-scaled, piercing projectile (§10). */
  private throwWeapon(
    player: PlayerState,
    c: CombatState,
    weapon: WeaponDef,
    hand: DualWieldHand = 0,
  ): void {
    const t = weapon.thrown;
    if (!t) return;
    const dmg = t.damage * this.heldDamageMult(weapon, t.scalingGrades, player, hand); // §14 source grades × §11 req penalty
    const ttl = t.range / t.speed;
    const aim = this.aimDir(player, c); // §37 aim at the cursor POINT, not the rig-derived vector
    this.fireProjectile(
      { x: player.x, y: player.y },
      { x: player.x + aim.x, y: player.y + aim.y },
      t.speed,
      dmg,
      false,
      "cleaver",
      t.pierce,
      ttl,
      undefined,
      0,
      this.weaponCritChance(player, c), // §ULT Door rider consumes once per throw
      player.id,
      weapon.id,
      CombatDelivery.Thrown,
    );
  }

  /** §14 scatter shot — fling `count` REAL magma projectiles in a cone toward aim. Each is a WYSIWYG
   *  damage source: an INT-scaled direct hit plus, on death, an INT-scaled explosion (both baked here
   *  from the player's attributes at swing time). Cone/speed/range/blast radius are FIXED (§14). */
  private fireScatter(
    player: PlayerState,
    c: CombatState,
    weapon: WeaponDef,
    hand: DualWieldHand = 0,
  ): void {
    const sc = weapon.scatter;
    if (!sc) return;
    const ballDmg = sc.damage * this.heldDamageMult(weapon, sc.scalingGrades, player, hand);
    const pierce = sc.pierce ?? 1;
    // The blast inherits the scatter's grades unless it overrides them; bake its damage once here.
    const explode = sc.explode
      ? {
          radius: sc.explode.radius,
          damage:
            sc.explode.damage *
            this.heldDamageMult(
              weapon,
              sc.explode.scalingGrades ?? sc.scalingGrades,
              player,
              hand,
            ),
        }
      : undefined;
    const aim = this.aimDir(player, c); // §37 aim the cone at the cursor POINT
    const baseAng = Math.atan2(aim.y, aim.x);
    const crit = this.weaponCritChance(player, c); // §ULT Door rider consumes once per scatter cast
    // §41 the ball carries its weapon's ELEMENT on the kind ("magma:frost") so the client renders
    // element-true balls + explosions — the frost Hailshard was shooting lava because every scatter
    // weapon inherited the Wyrmtooth's magma visual. "physical" (the Wyrmtooth's literal magma) keeps
    // the classic bare "magma".
    const el = weapon.tags.element;
    const kind = el && el !== "physical" ? `magma:${el}` : "magma";
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
        kind,
        pierce,
        sc.range / spd, // expire after travelling ~range (then explode)
        explode,
        0,
        crit,
        player.id,
        weapon.id,
        CombatDelivery.Scatter,
      );
    }
  }

  private damageWormSlots(
    slots: readonly number[],
    raw: number,
    sourceKey: string,
    kills: string[],
    crit = 0,
    piercing = false,
    sourcePlayerId = "",
    sourceWeaponId = "",
    delivery = 0,
    sourceX = 0,
    sourceY = 0,
  ): void {
    const controller = this.bossController;
    const runtime = controller?.wormRuntime;
    const boss = this.bossId ? this.state.enemies.get(this.bossId) : undefined;
    if (!controller || !runtime || !boss || slots.length === 0 || boss.hp <= 0) return;
    const hpBefore = boss.hp;
    let damage = raw;
    let didCrit = false;
    if (crit > 0 && Math.random() < crit) {
      damage *= CRIT_MULT;
      didCrit = true;
      boss.critFlash = (boss.critFlash + 1) & 0xff;
    }
    const signatureBrand = this.brandedTimers.has(boss.id) ? BRAND_DAMAGE_MULT - 1 : 0;
    const ultimateBrand = this.ultimateBrands.get(boss.id)?.multiplier ?? 0;
    damage *= 1 + signatureBrand + ultimateBrand;
    const result = controller.damageWormSegments(
      slots,
      damage,
      sourceKey,
      this.state.tick,
      piercing,
      boss,
    );
    if (!result.accepted) return;
    this.accrueUltimateCharge(
      sourcePlayerId,
      Math.min(hpBefore, Math.max(result.coreDamage, damage)),
      result.terminal,
      boss.kind,
      delivery,
    );
    const firstSlot = slots[0] ?? 0;
    this.writeCombatReceipt(
      `worm:${firstSlot}:${runtime.segmentGeneration(firstSlot)}`,
      runtime.x[firstSlot] ?? boss.x,
      runtime.y[firstSlot] ?? boss.y,
      sourcePlayerId,
      sourceWeaponId,
      delivery,
      sourceX,
      sourceY,
      Math.max(result.coreDamage, damage),
      didCrit,
      result.terminal,
    );
    for (;;) {
      const reward = controller.drainWormReward();
      if (!reward) break;
      this.dropLockedWormXp(reward.x, reward.y, reward.value);
    }
    this.rebuildWormSegmentGrid();
    if (result.terminal) this.damageEnemy(boss, boss.id, 0, kills, 0);
  }

  private collectWormRadiusHits(x: number, y: number, radius: number): readonly number[] {
    this.wormHitSlots.length = 0;
    const runtime = this.bossController?.wormRuntime;
    if (!runtime) return this.wormHitSlots;
    this.wormSegmentGrid.queryRadius(x, y, radius + 52, this.wormSegmentCandidates);
    for (const slot of this.wormSegmentCandidates) {
      const reach = radius + runtime.segmentRadius(slot);
      const dx = runtime.x[slot]! - x;
      const dy = runtime.y[slot]! - y;
      if (dx * dx + dy * dy <= reach * reach) this.wormHitSlots.push(slot);
    }
    return this.wormHitSlots;
  }

  /** Apply `raw` damage to one enemy, folding in the §8 Brand multiplier, then do the shared kill/XP/portal
   *  bookkeeping (dummy reset · boss portal · ronin drop). Pushes the id to `kills` on death (the caller
   *  deletes after iterating) and drops one authoritative XP Echo at the exact corpse position. The single
   *  primitive keeps Brand + drops + XP consistent across every source (swing / blast / projectile / wave). */
  private damageEnemy(
    enemy: EnemyState,
    eid: string,
    raw: number,
    kills: string[],
    crit = 0,
    sourcePlayerId = "",
    sourceWeaponId = "",
    delivery = 0,
    sourceX = enemy.x,
    sourceY = enemy.y,
  ): void {
    const wormRoot = eid === this.bossId && !!this.bossController?.wormRuntime;
    // The compatibility root is never a hurt shape; zero damage is the segment route's terminal hand-off.
    if (wormRoot && (raw > 0 || enemy.hp > 0)) return;
    // §30 CRIT: player-sourced damage passes its crit CHANCE; roll here so every damage source (edge,
    // chain, quake, gun, thrown, riposte) can independently crit. A crit doubles the hit + bumps the
    // synced critFlash so the client styles a gold number with extra juice. Non-player sources pass 0.
    let dmg = raw;
    let didCrit = false;
    if (crit > 0 && Math.random() < crit) {
      dmg *= CRIT_MULT;
      didCrit = true;
      enemy.critFlash = (enemy.critFlash + 1) & 0xff;
    }
    const hpBefore = enemy.hp;
    const signatureBrand = this.brandedTimers.has(eid) ? BRAND_DAMAGE_MULT - 1 : 0;
    const ultimateBrand = this.ultimateBrands.get(eid)?.multiplier ?? 0;
    const flagship = eid === this.bossId ? this.vastagharEncounter : null;
    const creditedApplied =
      dmg * (1 + signatureBrand + ultimateBrand) * (flagship?.damageMultiplier() ?? 1);
    const applied = flagship
      ? flagship.capIncomingDamage(
          enemy.hp,
          creditedApplied,
          sourcePlayerId,
          sourceWeaponId,
          delivery,
          sourceX,
          sourceY,
        )
      : creditedApplied;
    const finalBlow = enemy.kind !== "dummy" && enemy.hp - applied <= 0;
    enemy.hp -= applied;
    this.accrueUltimateCharge(
      sourcePlayerId,
      Math.min(Math.max(0, hpBefore), Math.max(0, creditedApplied)),
      finalBlow,
      enemy.kind,
      delivery,
    );
    this.writeCombatReceipt(
      eid,
      enemy.x,
      enemy.y,
      sourcePlayerId,
      sourceWeaponId,
      delivery,
      sourceX,
      sourceY,
      creditedApplied,
      didCrit,
      finalBlow,
    );
    const combo = this.comboState.get(eid);
    if (enemy.hp > 0) {
      // §51 co-op rescue: while the launcher/keep string owns the victim, damage from any OTHER player
      // accumulates toward an 8%-max-HP interrupt. The juggler is never script-armoured; teamwork buys a
      // real 0.8s stagger and immediately frees the aerial-pressure/duel token.
      if (
        combo?.comboId &&
        (enemy.comboFlags & COMBO_FLAG_JUGGLE) !== 0 &&
        sourcePlayerId &&
        sourcePlayerId !== combo.targetId
      ) {
        combo.juggleAllyDamage = (combo.juggleAllyDamage ?? 0) + Math.max(0, applied);
        if (combo.juggleAllyDamage >= (combo.juggleInterruptHp ?? Number.POSITIVE_INFINITY))
          this.enterComboRecover(enemy, eid, combo, 16);
      }
      return;
    }
    if (enemy.kind === "dummy") {
      enemy.hp = DUMMY_HP;
      return;
    }
    this.ultimateStunUntil.delete(eid);
    this.ultimateBrands.delete(eid);
    if (combo?.strike) this.removeTelegraphRow(combo.strike.tg);
    if (combo?.tg) this.removeTelegraphRow(combo.tg);
    if (combo?.targetId && this.duelTokens.get(combo.targetId) === eid)
      this.duelTokens.delete(combo.targetId);
    if (combo) combo.strike = undefined;
    const kind = ENEMY_KINDS[enemy.kind];
    if (wormRoot) this.releaseWormXp(enemy.x, enemy.y);
    else if (!flagship) {
      this.dropXp(
        enemy.x,
        enemy.y,
        (kind?.xpValue ?? 0) * (enemy.tough ? TOUGH_XP_MULT : 1),
      );
    }
    if (kind?.archetype === "boss" && flagship) {
      if (this.bossPetAwardEligible) this.awardPetDimensionClear();
      this.beginVastagharClear(enemy.x, enemy.y);
    } else if (kind?.archetype === "boss") {
      if (enemy.id === this.bossId && this.bossPetAwardEligible) this.awardPetDimensionClear();
      // §16 v0.109 tear the boss down HERE (the death path): dispose the controller + clear any in-flight
      // telegraph rows before opening the portal. Otherwise a boss killed mid-windup leaves orphaned
      // telegraphs (never resolved) + a leaked controller — stepBoss early-returns once bossId is null and
      // never reaches its own cleanup. clearBoss is idempotent + also nulls bossId / blanks bossKind.
      if (enemy.id === this.bossId) this.clearBoss();
      if (this.state.mode === "bossrush") {
        // §16 v0.116 the gauntlet: heal + reward + queue the next boss (or win on the last).
        this.advanceBossRush(enemy.x, enemy.y);
      } else {
        // §13 "no guaranteed weapon drops EXCEPT bosses" — with a heavy tier bonus on the rarity table
        // (§13 "tier affects drop rate AND rarity"), so the capstone drop rarely lands Common. ARENA-only:
        // a debug-summoned Testing-Grounds boss must never mint carryable loot (adversarial-verify — the
        // training reroll-laundering exploit). QOL-01: reserve/create the reward BEFORE the gate lifecycle
        // begins, so extraction can never outrun the capstone drop.
        if (this.state.mode === "arena") this.dropLoot(enemy.x, enemy.y, 1, LOOT_TIER_LUK_BOSS);
        this.openPortal(enemy.x, enemy.y);
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
    const killer = sourcePlayerId ? this.state.players.get(sourcePlayerId) : undefined;
    const killerCombat = sourcePlayerId ? this.combat.get(sourcePlayerId) : undefined;
    if (killer && killerCombat) this.applyKillQuirk(killer, killerCombat, enemy);
    kills.push(eid);
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
      inp.held.dx = 0;
      inp.held.dy = 0;
      inp.held.jump = false;
      inp.held.crouchHeld = false;
      inp.held.pound = false;
      inp.held.slide = false;
      inp.held.slideHeld = false;
      inp.held.fireHeld = false;
    }
    const c = this.combat.get(id);
    const player = this.state.players.get(id);
    if (player) {
      if (c) {
        c.crouchPrevHeld = false;
        c.slidePrevHeld = false;
        c.slideColdArmed = false;
        c.slideColdRearmTicks = 0;
        c.slideHopBuffered = false;
        c.slidePrelandTicks = 0;
        c.momentumX = 0;
        c.momentumY = 0;
        c.slideLandMomentumX = 0;
        c.slideLandMomentumY = 0;
        c.slidePhase = SLIDE_PHASE_OFF;
        c.slidePhaseTick = 0;
        this.cancelMoveStance(player, c, true);
      }
      player.mvx = 0;
      player.mvy = 0;
      player.momentumX = 0;
      player.momentumY = 0;
      player.slidePhase = SLIDE_PHASE_OFF;
      player.slidePhaseTick = 0;
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
    const curator = this.nextWeaponCurator();
    const weapon = rollBankAwareDropWeapon(curator, Math.random());
    if (curator) {
      curator.runIssuedByWeaponId.set(weapon, (curator.runIssuedByWeaponId.get(weapon) ?? 0) + 1);
    }
    const rarity = rollRarity(Math.random(), this.bestLuk() + tierLukBonus);
    const affix = rollAffix(Math.random(), rarity).id;
    this.hiddenPickupIdentities.set(pk.id, { weapon, rarity, affix });
    // Only the intended public tells enter Schema: rarity glow/name + coarse class glyph. Exact weapon and
    // affix remain empty placeholders until the authoritative grab reveals the server-only identity.
    pk.weapon = weapon;
    pk.weaponPublic = "";
    pk.rarity = rarity;
    pk.affix = affix;
    pk.affixPublic = "";
    pk.weaponClass = WEAPONS[weapon]?.tags.classPool ?? "";
    pk.known = false;
    const sp = this.placePickupPos(x, y);
    pk.x = sp.x;
    pk.y = sp.y;
    this.state.pickups.set(pk.id, pk);
    this.earnedPickups.add(pk.id); // a loot drop is EARNED — it carries §13 salvage value
    this.pickupWeaponBankMeta.set(pk.id, {
      provenance: tierLukBonus >= LOOT_TIER_LUK_BOSS ? "boss-drop" : "enemy-drop",
      ownerId: curator?.accountId ?? "",
      ownerLockUntil: curator ? this.state.elapsed + 2 : 0,
    });
    this.publishPetPickupEligibility();
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
  private detonate(
    x: number,
    y: number,
    radius: number,
    damage: number,
    crit = 0,
    sourcePlayerId = "",
    sourceWeaponId = "",
    delivery = 0,
  ): void {
    const r2 = radius * radius;
    const kills: string[] = [];
    this.enemyGrid.queryRadius(x, y, radius, this.enemyCandidates);
    for (const eid of this.enemyCandidates) {
      const enemy = this.state.enemies.get(eid);
      if (!enemy) continue;
      const dx = enemy.x - x;
      const dy = enemy.y - y;
      if (dx * dx + dy * dy > r2) continue;
      this.damageEnemy(
        enemy,
        eid,
        damage,
        kills,
        crit,
        sourcePlayerId,
        sourceWeaponId,
        delivery,
        x,
        y,
      );
    }
    this.damageWormSlots(
      this.collectWormRadiusHits(x, y, radius),
      damage,
      `aoe:${this.wormDamageSourceSeq++}`,
      kills,
      crit,
      false,
      sourcePlayerId,
      sourceWeaponId,
      delivery,
      x,
      y,
    );
    for (const eid of kills) this.state.enemies.delete(eid);
  }

  /** §8 Emberguard fire wave — a cone of fire in front of `aim` (origin at the player), `dmg` to each enemy
   *  inside, kill bookkeeping via `damageEnemy`. The shared primitive for the on-parry wave AND the
   *  Conflagration re-pulse. */
  private emberguardWave(
    x: number,
    y: number,
    aimX: number,
    aimY: number,
    dmg: number,
    crit = 0,
    sourcePlayerId = "",
    sourceWeaponId = "",
  ): void {
    const kills: string[] = [];
    this.state.enemies.forEach((enemy, eid) => {
      if (inMeleeArc({ x, y }, aimX, aimY, enemy, EMBERGUARD_RANGE, EMBERGUARD_HALF_ARC)) {
        this.damageEnemy(
          enemy,
          eid,
          dmg,
          kills,
          crit,
          sourcePlayerId,
          sourceWeaponId,
          CombatDelivery.Parry,
          x,
          y,
        );
      }
    });
    const runtime = this.bossController?.wormRuntime;
    if (runtime) {
      this.wormHitSlots.length = 0;
      this.wormSegmentGrid.queryRadius(x, y, EMBERGUARD_RANGE + 52, this.wormSegmentCandidates);
      for (const slot of this.wormSegmentCandidates) {
        if (
          inMeleeArc(
            { x, y },
            aimX,
            aimY,
            { x: runtime.x[slot]!, y: runtime.y[slot]! },
            EMBERGUARD_RANGE + runtime.segmentRadius(slot),
            EMBERGUARD_HALF_ARC,
          )
        ) this.wormHitSlots.push(slot);
      }
      this.damageWormSlots(
        this.wormHitSlots,
        dmg,
        `ember:${this.wormDamageSourceSeq++}`,
        kills,
        crit,
        false,
        sourcePlayerId,
        sourceWeaponId,
        CombatDelivery.Parry,
        x,
        y,
      );
    }
    for (const eid of kills) this.state.enemies.delete(eid);
  }

  /** §7/§8 execute a parry — grant i-frames, knock nearby enemies back, and fire the owned augments. Split
   *  out of the message handler (v0.105 de-clunk) so a BUFFERED parry (one that arrived during the cooldown)
   *  can fire from the tick the instant the cd drains, not just synchronously on message arrival. */
  private executeParry(player: PlayerState, c: CombatState): void {
    if (c.recoveryT > 0 || c.slideParryLockT > 0) return;
    if (c.stance === STANCE_SLIDE) this.cancelMoveStance(player, c, false);
    if (c.stance === STANCE_CROUCH) this.cancelMoveStance(player, c, true);
    if (c.beamPhase !== 0) this.cancelBeam(player, player.id, c, true, false);
    // G-02: the press opens only the base defensive window. Augment rewards are success-gated below.
    c.invuln = Math.max(c.invuln, PARRY_IFRAMES * c.mods.parryIFrameMult);
    c.parryCd = PARRY_COOLDOWN * c.mods.parryCooldownMult;
    c.parryOpenedTick = this.state.tick;
    const knockback = PARRY_KNOCKBACK * c.mods.parryKnockbackMult;
    const r2 = PARRY_RADIUS * PARRY_RADIUS;
    this.state.enemies.forEach((enemy, id) => {
      if (id === this.bossId && (this.bossController?.wormRuntime || this.vastagharEncounter)) return;
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > 0 && d2 <= r2) {
        const d = Math.sqrt(d2);
        enemy.x = clamp(enemy.x + (dx / d) * knockback, ENEMY_RADIUS, ARENA_WIDTH - ENEMY_RADIUS);
        enemy.y = clamp(enemy.y + (dy / d) * knockback, ENEMY_RADIUS, ARENA_HEIGHT - ENEMY_RADIUS);
        this.updateEnemyGrid(id, enemy);
      }
    });
  }

  /** §8 apply the player's owned parry AUGMENTS on a successful parry (Iron Stance is handled at the call
   *  site since it scales the base i-frames/knockback). Each augment is small + stacks; the pool builds a
   *  custom parry per run. Offense here is server-authoritative (the client renders off the synced effects). */
  private applyParryAugments(player: PlayerState, c: CombatState): void {
    this.markWeaponResourcePressure(c);
    const owned = player.augments;
    if (!owned) return;
    const now = this.state.elapsed;

    const iron = countAugment(owned, "iron-stance");
    if (iron > 0) {
      c.invuln = Math.max(c.invuln, PARRY_IFRAMES * (1 + IRON_STANCE_IFRAME_PER * iron));
    }

    // Aegis — Second Wind (stacks): heal a CON-scaled sliver. Bulwark: a brief absorb shield.
    const sw = countAugment(owned, "second-wind");
    if (sw > 0) {
      const heal = sw * (SECOND_WIND_BASE + SECOND_WIND_PER_CON * Math.max(0, player.con - 1));
      this.applyHeal(player, heal);
    }
    if (hasAugment(owned, "bulwark")) {
      c.bulwarkShield = Math.max(c.bulwarkShield, BULWARK_SHIELD);
    }

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
          PROJECTILE_TTL,
          undefined,
          0,
          0,
          player.id,
          player.weapon,
          CombatDelivery.Parry,
        );
      }
    }

    // Hex — Brand (mark nearby enemies), Emberguard (fire wave), Conflagration (a deferred re-pulse).
    if (hasAugment(owned, "brand")) {
      const r2 = PARRY_RADIUS * PARRY_RADIUS;
      this.state.enemies.forEach((enemy) => {
        const dx = enemy.x - player.x;
        const dy = enemy.y - player.y;
        if (dx * dx + dy * dy <= r2) {
          this.brandedTimers.set(enemy.id, BRAND_DURATION);
          if (enemy.branded === 0) enemy.branded = 1;
        }
      });
      const root = this.bossId ? this.state.enemies.get(this.bossId) : undefined;
      if (root && this.collectWormRadiusHits(player.x, player.y, PARRY_RADIUS).length > 0) {
        this.brandedTimers.set(root.id, BRAND_DURATION);
        root.branded = 1;
      }
    }
    if (hasAugment(owned, "emberguard")) {
      const dmg = EMBERGUARD_BASE_DMG + EMBERGUARD_PER_INT * Math.max(0, player.int - 1);
      this.emberguardWave(
        player.x,
        player.y,
        c.aimX,
        c.aimY,
        dmg,
        critChanceFor(player.luk, player.dex),
        player.id,
        player.weapon,
      );
      if (hasAugment(owned, "conflagration")) {
        this.burnPulses.push({
          x: player.x,
          y: player.y,
          aimX: c.aimX,
          aimY: c.aimY,
          dmg,
          at: now + CONFLAG_DELAY,
          sourcePlayerId: player.id,
          sourceWeaponId: player.weapon,
        });
      }
    }
  }

  /** §15 duelists (ronin): close to `melee.approach`, telegraph `windup`, then swing `hits` times (each
   *  an arc hit toward the nearest player), then `recover`. Movement + the combo state machine. */
  private stepDuelists(dt: number, bodies: Vec2[]): void {
    for (const [id, dead] of this.comboState) {
      if (!this.state.enemies.has(id)) {
        if (dead?.tg) this.removeTelegraphRow(dead.tg); // §15 v0.113 a leaper killed mid-leap: clear its marker
        if (dead?.strike) this.removeTelegraphRow(dead.strike.tg);
        // §51 a combo tough killed mid-performance frees its victim's duel token (G12 co-op rescue).
        if (dead?.targetId && this.duelTokens.get(dead.targetId) === id)
          this.duelTokens.delete(dead.targetId);
        this.comboState.delete(id);
      }
    }
    this.state.enemies.forEach((enemy, id) => {
      const kind = ENEMY_KINDS[enemy.kind];
      if (this.poundEnemyEffects.has(id)) return;
      // §20 every contact monster lunges: an explicit duelist combo, or a derived single-hit lunge for
      // rusher/swarm/zoner (so the attack telegraphs + is parryable). Spitters/boss/dummies → no lunge.
      const m = effectiveMelee(kind);
      if (!m || !kind) return;
      let st = this.comboState.get(id);
      if (!st) {
        st = { phase: "idle", t: 0, hits: 0, wind: 0 };
        this.comboState.set(id, st);
      }
      // §51 ELITE COMBO LANGUAGE: TOUGH instances of combo-deck kinds (and shifters, always) run the
      // tick-anchored authored machine. Every other instance falls through to the legacy float machine
      // below, byte-for-byte untouched — the language stays special.
      if (kind.combos && (enemy.tough || kind.shifter)) {
        this.stepComboEnemy(enemy, id, kind, m, st, dt);
        this.updateEnemyGrid(id, enemy);
        return;
      }
      const target = this.nearestDoorDecoy(enemy) ?? nearestPoint(enemy, bodies);
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
      if (
        st.phase === "windup" &&
        !st.strike &&
        target &&
        dist > m.range * 0.45
      ) {
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
          st.strike = undefined;
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
          st.strike = undefined;
        }
      } else if (st.phase === "windup") {
        const phase = st.wind > 0 ? Math.max(0, Math.min(1, 1 - st.t / st.wind)) : 0;
        if (!st.strike && target && st.t > 0 && phase >= MELEE_LOCK_PHASE) {
          const strike = this.planDuelistStrike(enemy, target, m);
          const rot = Math.atan2(strike.aimY, strike.aimX);
          const tg = this.addMeleeTelegraphRow(
            id,
            strike.x,
            strike.y,
            m.range,
            m.halfArc,
            rot,
            phase,
          );
          st.strike = { ...strike, tg };
        }
        if (st.t <= 0) {
          // Strike from the exact advertised Lock geometry. The fallback only covers a timer that somehow
          // skipped the lock sample; normal 20 Hz authored windups always commit several ticks beforehand.
          const strike = st.strike;
          if (strike) {
            enemy.x = strike.x;
            enemy.y = strike.y;
            this.removeTelegraphRow(strike.tg);
            this.duelistSwing(enemy, id, target, m, strike);
          } else {
            this.duelistLunge(enemy, target, m, dist);
            this.duelistSwing(enemy, id, target, m);
          }
          st.strike = undefined;
          // A riposte may have changed the combo to its one-second stagger inside `duelistSwing`.
          const staggered =
            this.comboState.get(id)?.phase === "recover" && st.t === 1;
          if (!staggered) {
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
        }
      } else if (st.t <= 0) {
        st.phase = "idle"; // recover done
      }
      // §8 white-tell TELEGRAPH (Stage C): every windup (the first AND each follow-up) ramps `windup` 0→1
      // so the client fills a white rhythm ring + whitens the enemy before EACH hit — a parryable beat.
      enemy.windup =
        st.phase === "windup" && st.wind > 0 ? Math.max(0, Math.min(1, 1 - st.t / st.wind)) : 0;
      this.updateEnemyGrid(id, enemy);
    });
  }

  /** Capture the exact capped-lunge origin and target-relative aim that both telegraph and hit will consume. */
  private planDuelistStrike(
    enemy: EnemyState,
    target: Vec2,
    m: { range: number; step: number },
  ): { x: number; y: number; aimX: number; aimY: number } {
    const dx = target.x - enemy.x;
    const dy = target.y - enemy.y;
    const dist = Math.hypot(dx, dy);
    const nx = dist > 0.001 ? dx / dist : 1;
    const ny = dist > 0.001 ? dy / dist : 0;
    const floor = m.range * 0.45;
    const move = Math.max(0, Math.min(m.step, dist - floor));
    const r = ENEMY_KINDS[enemy.kind]?.radius ?? ENEMY_RADIUS;
    const x = clamp(enemy.x + nx * move, r, ARENA_WIDTH - r);
    const y = clamp(enemy.y + ny * move, r, ARENA_HEIGHT - r);
    const aimX = target.x - x;
    const aimY = target.y - y;
    return {
      x,
      y,
      aimX: Math.abs(aimX) + Math.abs(aimY) > 0.001 ? aimX : nx,
      aimY: Math.abs(aimX) + Math.abs(aimY) > 0.001 ? aimY : ny,
    };
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
    committed?: { aimX: number; aimY: number },
  ): void {
    enemy.atkSeq = (enemy.atkSeq + 1) % 100000;
    const aimX = committed?.aimX ?? (target ? target.x - enemy.x : 1);
    const aimY = committed?.aimY ?? (target ? target.y - enemy.y : 0);
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
      if (pc && this.slideInvulnerable(pc)) {
        this.noteSlideDodge(player);
        return;
      }
      if (pc && pc.juggleMercy > 0) return; // §51 G10 touchdown mercy covers ALL melee, legacy included
      // §20 a clean (un-parried) hit lands with UMPH — damage + a knockback shove along the strike, so a
      // duelist combo visibly drives you back (and makes parrying the alternative feel earned).
      this.damagePlayer(player, m.damage * dmgMul * depthDamageScale(this.state.depth), "enemy");
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

  /** §51 one TOUGH combo-speaking elite, one tick — the authored, tick-anchored machine (worm action
   *  model): idle → [leapwind → leap → settle] → windup … → (return) → recover. The laws enforced here:
   *  the negotiated landing NEVER moves once its marker exists (G3/G5); per-step aim re-samples only
   *  until that step's Lock (MELEE_LOCK_PHASE) then freezes (G5); every displacement is bounded-velocity
   *  motion or a ≤COMBO_STEP_MAX commit-write (G2); juggle strings obey every G9 cap at the resolve
   *  tick; the parried bait stands a visible ≥0.4s stagger at its DISPLACED spot before returning (G8). */
  private stepComboEnemy(
    enemy: EnemyState,
    id: string,
    kind: EnemyKind,
    m: NonNullable<EnemyKind["melee"]>,
    st: DuelistComboState,
    dt: number,
  ): void {
    const tick = this.state.tick;
    const def = st.comboId ? TOUGH_COMBOS[st.comboId] : undefined;
    const committed = st.targetId ? this.state.players.get(st.targetId) : undefined;
    const live = committed?.alive ? committed : undefined;
    const left = ((st.stepEndTick ?? tick) - tick) | 0; // wrap-safe signed delta (uint32 anchors)
    const knockbackMoving = this.stepComboKnockback(enemy, st, tick);
    if (knockbackMoving && st.phase === "windup") {
      // A parried ordinary beat may continue its committed choreography, but the NEXT full Claim→Lock
      // clock begins only after visible recoil. Shift both anchors together: timing identity is unchanged,
      // while even extreme Iron Stance cannot make a strike Lock mid-knockback.
      st.stepStartTick = ((st.stepStartTick ?? tick) + 1) >>> 0;
      st.stepEndTick = ((st.stepEndTick ?? tick) + 1) >>> 0;
      enemy.windup = 0;
      return;
    }
    if (st.phase === "idle") {
      st.leapCd = Math.max(0, (st.leapCd ?? 0) - dt);
      enemy.windup = 0;
      const prey = this.nearestLivingPlayer(enemy);
      if (!prey) return;
      const dist = Math.hypot(prey.x - enemy.x, prey.y - enemy.y);
      const holder = this.duelTokens.get(prey.id);
      if (
        (holder !== undefined && holder !== id) ||
        (holder === undefined && this.duelTokens.size >= COMBO_MAX_ACTIVE)
      ) {
        // G12: the victim is already claimed (or 4 performances run arena-wide) — stalk the ring-out
        // orbit, visibly waiting a turn instead of stacking an unreadable committed crossfire.
        if (dist > COMBO_RINGOUT_ORBIT + 40)
          this.moveComboEnemyToward(enemy, prey, kind.speed, dt);
        return;
      }
      if (kind.comboLeap) {
        // Named leapers/shifters ALWAYS offer the negotiated frame. Inside range they wait for the
        // authored 4s cooldown; outside it they close until a legal fixed-duration arc is available.
        if ((st.leapCd ?? 0) <= 0 && dist <= COMBO_LEAP_RANGE)
          this.commitCombo(enemy, id, kind, st, prey, true);
        else this.moveComboEnemyToward(enemy, prey, kind.speed, dt);
      } else if (dist <= m.approach) {
        this.commitCombo(enemy, id, kind, st, prey, false);
      } else {
        this.moveComboEnemyToward(enemy, prey, kind.speed, dt);
      }
    } else if (st.phase === "leapwind") {
      // The OFFER: deep crouch in place while the white duel ring fades in at the FIXED landing point.
      enemy.windup = 0;
      if (st.tg) {
        const total = COMBO_LEAP_OFFER_TICKS + COMBO_LEAP_AIR_TICKS;
        const gone = COMBO_LEAP_OFFER_TICKS - Math.max(0, left);
        this.setTelegraphRowProgress(st.tg, Math.max(0, Math.min(1, gone / total)));
      }
      if (left <= 0) {
        // LIFTOFF — a documented comboSeq edge. The promise (marker) is already on the ground and will
        // never move; from here the flight flies to the COMMITTED point, not to the live player.
        st.phase = "leap";
        st.stepStartTick = tick;
        st.stepEndTick = (tick + COMBO_LEAP_AIR_TICKS) >>> 0;
        st.leapCd = COMBO_LEAP_COOLDOWN;
        enemy.comboFlags |= COMBO_FLAG_AIRBORNE;
        this.bumpComboSeq(enemy);
      }
    } else if (st.phase === "leap") {
      if (st.tg) {
        const total = COMBO_LEAP_OFFER_TICKS + COMBO_LEAP_AIR_TICKS;
        this.setTelegraphRowProgress(
          st.tg,
          Math.max(0, Math.min(1, (total - Math.max(0, left)) / total)),
        );
      }
      // Fixed-arrival flight: remaining distance ÷ remaining ticks (≤80px/tick at max range — inside
      // the G2 ≤90px/tick budget; arrival time is the metronome, speed is what varies).
      const lx = st.negotiatedX ?? enemy.x;
      const ly = st.negotiatedY ?? enemy.y;
      const remain = Math.max(1, left + 1);
      enemy.x += (lx - enemy.x) / remain;
      enemy.y += (ly - enemy.y) / remain;
      if (left <= 0) {
        enemy.x = lx; // land EXACTLY on the committed promise
        enemy.y = ly;
        if (st.tg) {
          this.removeTelegraphRow(st.tg); // the removal edge-fires the client's landing dust
          st.tg = undefined;
        }
        enemy.comboFlags &= ~COMBO_FLAG_AIRBORNE;
        const landingRadius = kind.radius + 10;
        const whiffDx =
          (live?.x ?? Number.POSITIVE_INFINITY) - (st.negotiatedTargetX ?? Number.NEGATIVE_INFINITY);
        const whiffDy =
          (live?.y ?? Number.POSITIVE_INFINITY) - (st.negotiatedTargetY ?? Number.NEGATIVE_INFINITY);
        if (!live || whiffDx * whiffDx + whiffDy * whiffDy > landingRadius * landingRadius) {
          // G4: walking out of the white offer ring is a COMPLETE answer. No settle/re-acquire slide;
          // the tough owns an authored whiff punish of at least 0.85s and spends its cooldown.
          this.enterComboRecover(enemy, id, st, Math.max(17, def?.recoverTicks ?? 17));
          return;
        }
        st.phase = "settle";
        st.stepStartTick = tick;
        st.stepEndTick = (tick + (st.settleTicks ?? COMBO_LEAP_SETTLE_TICKS)) >>> 0;
      }
    } else if (st.phase === "settle") {
      // The settle beat is SACRED: nothing damages; the player chooses (parry / pre-turn / dodge out).
      enemy.windup = 0;
      if (left <= 0) {
        if (def) this.beginComboStep(st, def, 0);
        else this.enterComboRecover(enemy, id, st, 8);
      }
    } else if (st.phase === "windup" && def) {
      const step = def.steps[st.stepIndex ?? 0];
      if (!step) {
        this.enterComboRecover(enemy, id, st, def.recoverTicks);
        return;
      }
      const dur = Math.max(1, ((st.stepEndTick ?? tick) - (st.stepStartTick ?? tick)) | 0);
      const phase01 = Math.max(0, Math.min(1, (dur - Math.max(0, left)) / dur));
      // Pre-Lock tracking (G5's honest half): strikes lean in (the Sekiro creep); air-keeps dash under
      // the falling victim's ground shadow at 1.6× — VISIBLE compensation, not magic tracking. Both
      // freeze the moment Lock samples.
      if (!st.strike && live && !knockbackMoving) {
        const dist = Math.hypot(live.x - enemy.x, live.y - enemy.y);
        if (step.kind === "airkeep") {
          this.moveComboEnemyToward(enemy, live, kind.speed * 1.6, dt);
        } else if (dist > step.range * 0.45) {
          this.moveComboEnemyToward(enemy, live, kind.speed * 0.28, dt);
        }
      }
      if (!st.strike && live && left > 0 && phase01 >= MELEE_LOCK_PHASE) {
        // LOCK — the advertised sector IS the damage sector from here (G5). Air-keeps lead the live
        // authoritative velocity ONCE (fall compensation is authored rhythm, never re-timed — G11).
        const lead = step.kind === "airkeep" ? (left * TICK_MS) / 1000 : 0;
        const strike = this.planComboStrike(
          enemy,
          live,
          step.range,
          Math.min(step.step, COMBO_STEP_MAX),
          lead,
        );
        const rot = Math.atan2(strike.aimY, strike.aimX);
        const tg = this.addMeleeTelegraphRow(
          id,
          strike.x,
          strike.y,
          step.range,
          step.halfArc,
          rot,
          phase01,
          step.unparryable ? 1 : 0,
          step.returnCapable ? 7 : 6,
        );
        st.strike = { ...strike, tg };
        this.bumpComboSeq(enemy); // documented edge: each strike LOCK
      }
      enemy.windup = phase01;
      if (left <= 0) {
        const strike = st.strike;
        st.strike = undefined;
        enemy.windup = 0;
        if (!strike) {
          // The Lock never sampled (victim died/left pre-Lock) — drop the performance, no re-aim.
          this.enterComboRecover(enemy, id, st, def.recoverTicks);
          return;
        }
        this.removeTelegraphRow(strike.tg);
        if (step.kind === "airkeep" && !this.airkeepValid(st, step, live)) {
          // G9: the victim fell out / a cap tripped — the swing whiffs, the string ends. Escape won.
          this.enterComboRecover(enemy, id, st, def.recoverTicks);
          return;
        }
        enemy.x = strike.x; // ≤COMBO_STEP_MAX commit-write — the same Lock-honest advance as legacy (G2)
        enemy.y = strike.y;
        this.comboSwing(enemy, id, st, step, step, strike);
        // A parry inside the swing may have CONVERTED (bait → return), BROKEN (juggle, G11) or
        // STAGGERED (riposte, G14) the machine — only an untouched windup advances to the next beat.
        if (st.phase === "windup") {
          const next = (st.stepIndex ?? 0) + 1;
          if (next < Math.min(def.steps.length, st.stepLimit ?? def.steps.length))
            this.beginComboStep(st, def, next);
          else this.enterComboRecover(enemy, id, st, def.recoverTicks);
        }
      }
    } else if (st.phase === "return" && def?.return) {
      const ret = def.return;
      const start = st.stepStartTick ?? tick;
      const staggerEnd = (start + RETURN_STAGGER_TICKS) >>> 0;
      const windEnd = (staggerEnd + ret.windupTicks) >>> 0;
      const dashEnd = (windEnd + RETURN_DASH_TICKS) >>> 0;
      const staggerLeft = (staggerEnd - tick) | 0;
      const windLeft = (windEnd - tick) | 0;
      const dashLeft = (dashEnd - tick) | 0;
      if (staggerLeft > 0) {
        // G8: ≥0.4s of VISIBLE stagger at the DISPLACED position — proof the parry had mass. The
        // return path-plans from here, not from where the swing was thrown.
        enemy.windup = 0;
        if (!knockbackMoving) {
          // Phase-5.55 POI/belt resolution runs after AI; refreshing during the hold captures that final
          // legal post-recoil spot rather than the pre-collision endpoint scheduled in resolveParry.
          st.displacedX = enemy.x;
          st.displacedY = enemy.y;
        }
      } else if (windLeft > 0) {
        const phase01 = Math.max(0, Math.min(1, (ret.windupTicks - windLeft) / ret.windupTicks));
        enemy.windup = phase01;
        if (!st.strike && live && phase01 >= MELEE_LOCK_PHASE) {
          // LOCK the comeback: travel computed from the ACTUAL displacement (Iron Stance moves it),
          // capped at RETURN_STEP_MAX (outrunning it = an honest whiff), advertised as the gold
          // kindTag-7 wedge at the dash-END origin. Still WHITE — parry it again and the chain math
          // ends the loop.
          const strike = this.planComboStrike(enemy, live, ret.range, RETURN_STEP_MAX, 0);
          const rot = Math.atan2(strike.aimY, strike.aimX);
          const tg = this.addMeleeTelegraphRow(
            id,
            strike.x,
            strike.y,
            ret.range,
            ret.halfArc,
            rot,
            phase01,
            0,
            7,
          );
          st.strike = { ...strike, tg };
        }
      } else {
        const strike = st.strike;
        if (!strike) {
          // The Lock never sampled (victim died mid-stagger) — the comeback dissolves, no re-aim.
          this.enterComboRecover(enemy, id, st, ret.recoverTicks);
          return;
        }
        if (dashLeft >= RETURN_DASH_TICKS) {
          // Windup resolves on this anchor; travel starts on the NEXT interval so exactly six 50ms
          // displacement slices span the authored 0.30s dash (not seven inclusive tick samples).
          enemy.windup = 1;
          return;
        }
        // Bounded-velocity CLOSE (≤50px/tick over RETURN_DASH_TICKS — G2: recovery from real force,
        // never a position warp), then the empowered swing from the advertised geometry.
        const remain = Math.max(1, dashLeft + 1);
        enemy.x += (strike.x - enemy.x) / remain;
        enemy.y += (strike.y - enemy.y) / remain;
        enemy.windup = 1;
        if (dashLeft <= 0) {
          enemy.x = strike.x;
          enemy.y = strike.y;
          st.strike = undefined;
          this.removeTelegraphRow(strike.tg);
          this.comboSwing(enemy, id, st, undefined, ret, strike);
          // A PARRIED return already ended the combo inside resolveParry (the authored long punish
          // recover); a LANDED return exits through the standard recover.
          if (st.phase === "return") this.enterComboRecover(enemy, id, st, ret.recoverTicks);
        }
      }
    } else if (st.phase === "recover") {
      enemy.windup = 0;
      if (left <= 0) st.phase = "idle";
    } else {
      // A phase with no authored data behind it (comboId pruned mid-run) — fail safe into recover.
      this.enterComboRecover(enemy, id, st, 8);
    }
  }

  /** §51 commit one combo performance: pick from the depth-gated deck (no-repeat + ≤40% advanced),
   *  CLAIM the duel token (G12 — the choreography aims at ONE player, period), and either negotiate
   *  the leap (frozen at THIS decision) or open grounded at step 0. */
  private commitCombo(
    enemy: EnemyState,
    id: string,
    kind: EnemyKind,
    st: DuelistComboState,
    prey: PlayerState,
    withLeap: boolean,
  ): void {
    const comboId = pickToughCombo(
      kind.combos ?? [],
      this.state.depth,
      st.lastComboId ?? "",
      Math.random(),
    );
    const def = TOUGH_COMBOS[comboId];
    if (!def) return; // nothing eligible at this depth — keep stalking
    this.duelTokens.set(prey.id, id);
    st.comboId = comboId;
    st.lastComboId = comboId;
    st.targetId = prey.id;
    st.stepIndex = 0;
    st.stepLimit =
      this.state.depth <= 2 ? Math.min(2, def.steps.length) : def.steps.length;
    st.settleTicks = COMBO_LEAP_SETTLE_TICKS;
    st.empowered = false;
    st.returnsLeft = def.maxReturns;
    st.juggleHits = 0;
    st.launchTick = 0;
    st.comboDamage = 0;
    st.juggleCombo = false;
    for (const step of def.steps) {
      if (step.kind === "launcher") {
        st.juggleCombo = true;
        break;
      }
    }
    st.juggleAllyDamage = 0;
    st.juggleInterruptHp =
      Math.max(
        enemy.hp,
        kind.hp *
          (enemy.tough ? TOUGH_HP_MULT : 1) *
          enemyHpScale(Math.max(1, this.livingCount())) *
          depthHpScale(this.state.depth),
      ) * 0.08;
    st.knockbackX = undefined;
    st.knockbackY = undefined;
    st.knockbackEndTick = undefined;
    st.displacedX = undefined;
    st.displacedY = undefined;
    st.strike = undefined;
    if (!withLeap) {
      this.beginComboStep(st, def, 0);
      return;
    }
    // §51 NEGOTIATED LEAP: "front" is the advocate's SLOW anchor — authoritative steering heading,
    // falling back to player→enemy approach bearing. Live mouse aim is deliberately forbidden: a 180°
    // turn during the offer must not make the committed marker look like a behind-the-back cheat.
    let fx = prey.mvx;
    let fy = prey.mvy;
    let fd = Math.hypot(fx, fy);
    if (fd < 1) {
      fx = enemy.x - prey.x;
      fy = enemy.y - prey.y;
      fd = Math.hypot(fx, fy);
    }
    if (fd < 0.001) {
      fx = 1;
      fy = 0;
      fd = 1;
    }
    const effectiveVx = prey.mvx + prey.vx;
    const effectiveVy = prey.mvy + prey.vy;
    const effectiveSpeed = Math.hypot(effectiveVx, effectiveVy);
    let forecastX = prey.x;
    let forecastY = prey.y;
    if (effectiveSpeed > 400) {
      const lead = Math.min(140, effectiveSpeed * 0.3);
      forecastX += (effectiveVx / effectiveSpeed) * lead;
      forecastY += (effectiveVy / effectiveSpeed) * lead;
    }
    const landing = this.negotiateComboLanding(
      enemy,
      forecastX,
      forecastY,
      kind,
      def,
      fx / fd,
      fy / fd,
    );
    st.negotiatedX = landing.x;
    st.negotiatedY = landing.y;
    st.negotiatedTargetX = forecastX;
    st.negotiatedTargetY = forecastY;
    st.settleTicks = COMBO_LEAP_SETTLE_TICKS + (landing.awkward ? 2 : 0);
    // WHITE duel-offer ring (danger 0 — the landing itself damages NOTHING; the settle beat is sacred,
    // so a red dodge marker would be a lie), full footprint from the first tick, visible 0.65s before
    // touchdown (G3's 0.4s floor with room to spare). kindTag 2 keeps the leaper poof style.
    st.tg = this.addTelegraphRow(0, landing.x, landing.y, kind.radius + 10, 0, 2);
    st.phase = "leapwind";
    st.stepStartTick = this.state.tick;
    st.stepEndTick = (this.state.tick + COMBO_LEAP_OFFER_TICKS) >>> 0;
  }

  /** §51 one immutable landing promise. The base 0.8×-range point is distance-clamped, then routed through
   *  the exact arena/belt spawn-safety functions. A >40px nav correction searches the nearest bearings on
   *  the player's front 90° arc and marks the landing awkward (+0.10s settle), as authored. */
  private negotiateComboLanding(
    enemy: EnemyState,
    targetX: number,
    targetY: number,
    kind: EnemyKind,
    def: ToughComboDef,
    facingX: number,
    facingY: number,
  ): { x: number; y: number; awkward: boolean } {
    let best = this.comboLandingCandidate(
      enemy,
      targetX,
      targetY,
      kind,
      def.frontOffset,
      facingX,
      facingY,
      0,
    );
    const awkward = best.navShift > 40;
    if (awkward) {
      // ±15°, ±30°, ±45°: nearest-bearing-first, bounded and allocation-free apart from decision-edge
      // return records. First candidate needing ≤40px nav correction is the nearest valid front slot.
      for (let i = 1; i <= 6; i++) {
        const magnitude = Math.ceil(i / 2) * (Math.PI / 12);
        const angle = i % 2 === 1 ? magnitude : -magnitude;
        const candidate = this.comboLandingCandidate(
          enemy,
          targetX,
          targetY,
          kind,
          def.frontOffset,
          facingX,
          facingY,
          angle,
        );
        if (candidate.navShift < best.navShift) best = candidate;
        if (candidate.navShift <= 40) {
          best = candidate;
          break;
        }
      }
    }
    return { x: best.x, y: best.y, awkward };
  }

  /** Decision-edge helper for `negotiateComboLanding`; `navShift` measures only the safety correction,
   *  not the authored 560px range pullback. */
  private comboLandingCandidate(
    enemy: EnemyState,
    targetX: number,
    targetY: number,
    kind: EnemyKind,
    offset: number,
    facingX: number,
    facingY: number,
    angle: number,
  ): { x: number; y: number; navShift: number } {
    const ca = Math.cos(angle);
    const sa = Math.sin(angle);
    const fx = facingX * ca - facingY * sa;
    const fy = facingX * sa + facingY * ca;
    let rawX = targetX + fx * offset;
    let rawY = targetY + fy * offset;
    const dx = rawX - enemy.x;
    const dy = rawY - enemy.y;
    const d = Math.hypot(dx, dy);
    if (d > COMBO_LEAP_RANGE) {
      rawX = enemy.x + (dx / d) * COMBO_LEAP_RANGE;
      rawY = enemy.y + (dy / d) * COMBO_LEAP_RANGE;
    }
    const r = kind.radius;
    let x: number;
    let y: number;
    if (this.belt && this.beltLevel) {
      const boundedX = clamp(rawX, r, this.beltLevel.length - r);
      x = beltSafeX(this.beltLevel, boundedX, boundedX);
      y = clampBeltFloorY(this.beltLevel, x, rawY, r);
    } else {
      const safe = safeSpawnPos(
        this.map,
        clamp(rawX, r, ARENA_WIDTH - r),
        clamp(rawY, r, ARENA_HEIGHT - r),
        r,
      );
      x = safe.x;
      y = safe.y;
    }
    return { x, y, navShift: Math.hypot(x - rawX, y - rawY) };
  }

  /** §51 open authored step `index`: fresh tick anchors, no strike (Lock will sample it). */
  private beginComboStep(st: DuelistComboState, def: ToughComboDef, index: number): void {
    const step = def.steps[index];
    st.stepIndex = index;
    st.phase = "windup";
    st.strike = undefined;
    st.stepStartTick = this.state.tick;
    st.stepEndTick = (this.state.tick + Math.max(1, step?.windupTicks ?? 1)) >>> 0;
  }

  /** §51 end a combo performance: clear rows + presentation flags, FREE the duel token (G12 — the
   *  kneeling punish window pressures no one), and hold `recover` for `ticks`. */
  private enterComboRecover(
    enemy: EnemyState,
    id: string,
    st: DuelistComboState,
    ticks: number,
  ): void {
    if (st.strike) {
      this.removeTelegraphRow(st.strike.tg);
      st.strike = undefined;
    }
    if (st.tg) {
      this.removeTelegraphRow(st.tg);
      st.tg = undefined;
    }
    if (st.targetId && this.duelTokens.get(st.targetId) === id) this.duelTokens.delete(st.targetId);
    st.targetId = "";
    st.comboId = "";
    st.empowered = false;
    enemy.comboFlags = 0;
    enemy.windup = 0;
    st.phase = "recover";
    st.stepStartTick = this.state.tick;
    st.stepEndTick = (this.state.tick + Math.max(1, ticks)) >>> 0;
  }

  /** §51 G9 air-keep gate at the RESOLVE tick: the victim must still be airborne inside the authored
   *  height window, under the ≤2 air-hit cap, and inside the ≤2.0s loss-of-control ceiling. Any miss =
   *  the whole string whiffs into recover — falling out (or being left to land) IS an escape. */
  private airkeepValid(
    st: DuelistComboState,
    step: ToughComboStep,
    live: PlayerState | undefined,
  ): boolean {
    if (!live || !step.airkeep) return false;
    if (live.height <= GROUND_EPSILON) return false;
    if (live.height < step.airkeep.hMin || live.height > step.airkeep.hMax) return false;
    if ((st.juggleHits ?? 0) >= JUGGLE_MAX_AIR_HITS) return false;
    const controlSec = st.launchTick
      ? (((this.state.tick - st.launchTick) >>> 0) * TICK_MS) / 1000
      : 0;
    if (controlSec >= JUGGLE_MAX_CONTROL_SECONDS) return false;
    // Hard guarantee, not merely authored hope: refuse a re-loft whose deterministic gravity arc would
    // land after the 2.0s ceiling. A zero-vh finisher keeps the current fall and cannot extend control.
    if (step.airkeep.vh > 0) {
      const vh = Math.min(step.airkeep.vh, PARRY_LAUNCH_MAX);
      const landingSeconds = verticalTimeToGround(live.height, vh);
      if (controlSec + landingSeconds > JUGGLE_MAX_CONTROL_SECONDS) return false;
    }
    return true;
  }

  /** §51 capture a combo step's committed origin + aim — planDuelistStrike generalised: authored range,
   *  an explicit travel cap (COMBO_STEP_MAX for steps, RETURN_STEP_MAX for the bait return), and an
   *  optional ONE-TIME velocity lead (air-keep fall compensation, sampled at Lock, never re-timed). */
  private planComboStrike(
    enemy: EnemyState,
    target: PlayerState,
    range: number,
    travelCap: number,
    leadSeconds: number,
  ): { x: number; y: number; aimX: number; aimY: number } {
    const tx = target.x + (target.mvx + target.vx) * leadSeconds;
    const ty = target.y + (target.mvy + target.vy) * leadSeconds;
    const dx = tx - enemy.x;
    const dy = ty - enemy.y;
    const dist = Math.hypot(dx, dy);
    const nx = dist > 0.001 ? dx / dist : 1;
    const ny = dist > 0.001 ? dy / dist : 0;
    const floor = range * 0.45;
    const move = Math.max(0, Math.min(travelCap, dist - floor));
    const r = ENEMY_KINDS[enemy.kind]?.radius ?? ENEMY_RADIUS;
    const x = clamp(enemy.x + nx * move, r, ARENA_WIDTH - r);
    const y = clamp(enemy.y + ny * move, r, ARENA_HEIGHT - r);
    const aimX = tx - x;
    const aimY = ty - y;
    return {
      x,
      y,
      aimX: Math.abs(aimX) + Math.abs(aimY) > 0.001 ? aimX : nx,
      aimY: Math.abs(aimX) + Math.abs(aimY) > 0.001 ? aimY : ny,
    };
  }

  /** §51 allocation-free steady-state chase used only by authored combos. The shared chase helper returns
   *  fresh vectors (fine for legacy); active elites mutate in place so their richer per-tick machine adds
   *  zero garbage-collector pressure. */
  private moveComboEnemyToward(
    enemy: EnemyState,
    target: Vec2,
    speed: number,
    dt: number,
  ): void {
    const dx = target.x - enemy.x;
    const dy = target.y - enemy.y;
    const d = Math.hypot(dx, dy);
    if (d <= 0.001) return;
    const move = Math.min(d, speed * dt);
    const r = ENEMY_KINDS[enemy.kind]?.radius ?? ENEMY_RADIUS;
    const maxX = this.belt && this.beltLevel ? this.beltLevel.length - r : ARENA_WIDTH - r;
    enemy.x = clamp(enemy.x + (dx / d) * move, r, maxX);
    enemy.y = clamp(enemy.y + (dy / d) * move, r, ARENA_HEIGHT - r);
  }

  /** §51 schedule parry recoil as a continuous ≤90px/tick motion. Pits remain lethal and POI collision
   *  still runs in the normal phase afterward — no immunity is granted to protect authored content. */
  private scheduleComboKnockback(
    enemy: EnemyState,
    st: DuelistComboState,
    dirX: number,
    dirY: number,
    distance: number,
  ): number {
    const r = ENEMY_KINDS[enemy.kind]?.radius ?? ENEMY_RADIUS;
    const maxX = this.belt && this.beltLevel ? this.beltLevel.length - r : ARENA_WIDTH - r;
    const x = clamp(enemy.x + dirX * distance, r, maxX);
    const y = clamp(enemy.y + dirY * distance, r, ARENA_HEIGHT - r);
    const actual = Math.hypot(x - enemy.x, y - enemy.y);
    if (actual <= 0.001) {
      st.displacedX = enemy.x;
      st.displacedY = enemy.y;
      st.knockbackX = undefined;
      st.knockbackY = undefined;
      st.knockbackEndTick = undefined;
      return 0;
    }
    const ticks = Math.max(1, Math.ceil(actual / 90));
    st.knockbackX = x;
    st.knockbackY = y;
    st.knockbackEndTick = (this.state.tick + ticks) >>> 0;
    return ticks;
  }

  /** §51 advance one scheduled recoil slice; completion captures the ACTUAL post-knockback position from
   *  which a bait return later path-plans. Returns true on every tick that recoil owns movement. */
  private stepComboKnockback(
    enemy: EnemyState,
    st: DuelistComboState,
    tick: number,
  ): boolean {
    if (st.knockbackEndTick === undefined || st.knockbackX === undefined || st.knockbackY === undefined)
      return false;
    const left = (st.knockbackEndTick - tick) | 0;
    if (left < 0) {
      st.displacedX = enemy.x;
      st.displacedY = enemy.y;
      st.knockbackX = undefined;
      st.knockbackY = undefined;
      st.knockbackEndTick = undefined;
      return false;
    }
    const remain = Math.max(1, left + 1);
    enemy.x += (st.knockbackX - enemy.x) / remain;
    enemy.y += (st.knockbackY - enemy.y) / remain;
    if (left <= 0) {
      enemy.x = st.knockbackX;
      enemy.y = st.knockbackY;
      st.displacedX = enemy.x;
      st.displacedY = enemy.y;
      st.knockbackX = undefined;
      st.knockbackY = undefined;
      st.knockbackEndTick = undefined;
    }
    return true;
  }

  /** §51 one authored combo swing from the committed Lock geometry. Parry language: white steps are
   *  parryable (shared resolveParry — bait conversion / juggle break / riposte all branch in there);
   *  RED steps (unparryable) speak the FEET language — an airborne player clears them, the parry does
   *  not answer them. Juggle displacement rides ONLY the two channels prediction already reconciles
   *  (`addImpulse` and vh) — never a position write, never zeroMoveVel (no new divergence classes). */
  private comboSwing(
    enemy: EnemyState,
    enemyId: string,
    st: DuelistComboState,
    step: ToughComboStep | undefined,
    geo: { range: number; halfArc: number; damageMult: number; knockbackMult?: number },
    strike: { x: number; y: number; aimX: number; aimY: number },
  ): void {
    enemy.atkSeq = (enemy.atkSeq + 1) % 100000;
    const m = effectiveMelee(ENEMY_KINDS[enemy.kind]);
    const base =
      (m?.damage ?? 0) *
      geo.damageMult *
      (enemy.tough ? TOUGH_DAMAGE_MULT : 1) *
      depthDamageScale(this.state.depth);
    this.state.players.forEach((player) => {
      if (!player.alive || this.inLevelWindow(player)) return;
      if (!inMeleeArc(strike, strike.aimX, strike.aimY, player, geo.range, geo.halfArc)) return;
      const pc = this.combat.get(player.id);
      if (step?.unparryable) {
        if (player.height > GROUND_EPSILON) return; // RED = feet — the jump clears it (quake language)
      } else if (pc && pc.invuln > 0) {
        this.resolveParry(player, pc, enemy, enemyId); // §8 negate + reward; §51 branches live inside
        return;
      }
      if (pc && !step?.airkeep && this.slideInvulnerable(pc)) {
        this.noteSlideDodge(player);
        return;
      }
      if (pc && pc.juggleMercy > 0) return; // §51 G10 touchdown mercy — no landing-gank
      let dmg = base;
      if (player.id === st.targetId && st.juggleCombo) {
        // G9: one performance may never take more than 40% of the committed victim's max HP — the
        // budget clamps every hit (bystanders splashed by the honest hitbox are not the victim).
        const budget = Math.max(0, player.maxHp * COMBO_DAMAGE_CAP_FRAC - (st.comboDamage ?? 0));
        dmg = Math.min(dmg, budget);
        st.comboDamage = (st.comboDamage ?? 0) + dmg;
      }
      if (dmg > 0) this.damagePlayer(player, dmg, "enemy");
      const hx = player.x - enemy.x;
      const hy = player.y - enemy.y;
      const hd = Math.hypot(hx, hy) || 1;
      const displacementHit = !!(step?.launch || step?.airkeep);
      if (
        displacementHit &&
        pc &&
        (pc.stance === STANCE_CROUCH ||
          pc.stance === STANCE_DASH ||
          pc.stance === STANCE_SLIDE)
      ) {
        this.cancelMoveStance(player, pc, true);
      }
      const poundOwnsVertical = pc?.stance === STANCE_POUND;
      if (step?.launch && pc && player.id === st.targetId && !poundOwnsVertical) {
        // LAUNCHER: SET the victim's vh (deterministic apex; the parry-launch cap is the law, G9) + a
        // front-loaded pop along the strike. Arms the G10 touchdown mercy for this enemy-made flight.
        pc.vh = Math.min(step.launch.vh, PARRY_LAUNCH_MAX);
        player.vh = pc.vh;
        pc.juggleArmed = true;
        const k = addImpulse(player, (hx / hd) * step.launch.push, (hy / hd) * step.launch.push);
        player.vx = k.vx;
        player.vy = k.vy;
        player.juggledSeq = (player.juggledSeq + 1) & 0xff;
        st.launchTick = this.state.tick;
        enemy.comboFlags |= COMBO_FLAG_JUGGLE;
      } else if (step?.airkeep && pc && player.id === st.targetId && !poundOwnsVertical) {
        // AIR-KEEP: REFRESH vh by assignment (never additive — no co-op moon-launch; authored vh 0 =
        // the finisher lets you fall) + count toward the G9 air-hit cap.
        if (step.airkeep.vh > 0) {
          pc.vh = Math.min(step.airkeep.vh, PARRY_LAUNCH_MAX);
          player.vh = pc.vh;
        }
        if (step.airkeep.push > 0) {
          const k = addImpulse(player, (hx / hd) * step.airkeep.push, (hy / hd) * step.airkeep.push);
          player.vx = k.vx;
          player.vy = k.vy;
        }
        player.juggledSeq = (player.juggledSeq + 1) & 0xff;
        st.juggleHits = (st.juggleHits ?? 0) + 1;
      } else {
        const push = HIT_KNOCKBACK_IMPULSE * (geo.knockbackMult ?? 1);
        const k = addImpulse(player, (hx / hd) * push, (hy / hd) * push);
        player.vx = k.vx;
        player.vy = k.vy;
      }
    });
  }

  /** §51 nearest LIVING player WITH identity (the anonymous `bodies` scratch drops ids — a combo
   *  commits to ONE victim at negotiation, G12). O(players), zero allocation. */
  private nearestLivingPlayer(pos: Vec2): PlayerState | undefined {
    let best: PlayerState | undefined;
    let bestD = Number.POSITIVE_INFINITY;
    this.state.players.forEach((p) => {
      if (!p.alive) return;
      const d = (p.x - pos.x) ** 2 + (p.y - pos.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    });
    return best;
  }

  /** §51 bump the synced step-commit edge, wrapping 1..255 (0 stays "no combo has ever run"). */
  private bumpComboSeq(enemy: EnemyState): void {
    enemy.comboSeq = (enemy.comboSeq % 255) + 1;
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
    this.recordPetAcceptedAction(player.id);
    player.parriedSeq = (player.parriedSeq + 1) % 100000;
    const dx = attacker.x - player.x;
    const dy = attacker.y - player.y;
    const d = Math.hypot(dx, dy) || 1;
    const ironKnockback =
      (1 + IRON_STANCE_KNOCKBACK_PER * countAugment(player.augments, "iron-stance")) *
      pc.mods.parryKnockbackMult;
    // §8 flow: refresh the cooldown so the next swing can be parried immediately (chain), and §20 Stage D
    // LAUNCH the parrier (upward kick + a shove along the attack vector — chain to ride the flurry UP).
    pc.parryCd = Math.min(pc.parryCd, PARRY_CHAIN_CD);
    if (pc.stance !== STANCE_POUND) {
      pc.vh = Math.min(pc.vh + PARRY_LAUNCH, PARRY_LAUNCH_MAX);
      player.vh = pc.vh;
    }
    const k = addImpulse(player, (-dx / d) * PARRY_PUSH, (-dy / d) * PARRY_PUSH);
    player.vx = k.vx;
    player.vy = k.vy;
    // §8 v0.114 PARRY COMBO: build the chain → heal a chain-scaled sliver, and at RIPOSTE_AT stagger the
    // parried attacker (if it runs the combo machine) + an extra shove.
    pc.parryChain = pc.parryChainT > 0 ? pc.parryChain + 1 : 1;
    pc.parryChainT = PARRY_CHAIN_WINDOW;
    const parryHeal = PARRY_CHAIN_HEAL * Math.min(pc.parryChain, PARRY_CHAIN_HEAL_MAX_STACKS);
    this.applyHeal(player, parryHeal);
    this.addUltimateFlatCharge(player, pc, ULT_CHARGE_PARRY_BONUS);
    const est = this.comboState.get(attackerId);
    const def = est?.comboId ? TOUGH_COMBOS[est.comboId] : undefined;
    const authored = !!est && !!def;
    const riposte = pc.parryChain >= PARRY_CHAIN_RIPOSTE_AT;
    const nx = dx / d;
    const ny = dy / d;
    const baseKnockback = PARRY_KNOCKBACK * 1.6 * ironKnockback;
    let knockbackTicks = 0;
    if (authored && est) {
      // G2/G8: focused combo elites visibly travel through their recoil (≤90px/tick). Grunts and legacy
      // duelists keep the cheap historical write so this feature cannot perturb their established rhythm.
      knockbackTicks = this.scheduleComboKnockback(
        attacker,
        est,
        nx,
        ny,
        baseKnockback + (riposte ? PARRY_KNOCKBACK : 0),
      );
    } else {
      attacker.x = clamp(
        attacker.x + nx * baseKnockback,
        ENEMY_RADIUS,
        ARENA_WIDTH - ENEMY_RADIUS,
      );
      attacker.y = clamp(
        attacker.y + ny * baseKnockback,
        ENEMY_RADIUS,
        ARENA_HEIGHT - ENEMY_RADIUS,
      );
      if (riposte) {
        attacker.x = clamp(
          attacker.x + nx * PARRY_KNOCKBACK,
          ENEMY_RADIUS,
          ARENA_WIDTH - ENEMY_RADIUS,
        );
        attacker.y = clamp(
          attacker.y + ny * PARRY_KNOCKBACK,
          ENEMY_RADIUS,
          ARENA_HEIGHT - ENEMY_RADIUS,
        );
      }
    }
    if (est && def) {
      const step = def.steps[est.stepIndex ?? 0];
      const juggleString =
        (attacker.comboFlags & COMBO_FLAG_JUGGLE) !== 0 ||
        step?.kind === "launcher" ||
        step?.kind === "airkeep";
      if (riposte) {
        // G14 interrupt supremacy: chain mastery cancels ANY committed phase, including return dashes and
        // air keeps. The full one-second stagger begins after the bounded recoil finishes.
        this.enterComboRecover(
          attacker,
          attackerId,
          est,
          COMBO_RIPOSTE_STAGGER_TICKS + knockbackTicks,
        );
      } else if (est.phase === "return") {
        // The empowered comeback always loses to the second parry. maxReturns is already spent; even when
        // the global chain entered at 0, the authored 1.4–1.6s punish window ends the branch permanently.
        this.enterComboRecover(
          attacker,
          attackerId,
          est,
          (def.return?.recoverTicks ?? def.recoverTicks) + knockbackTicks,
        );
      } else if (juggleString) {
        // G11: airborne parry (or refusing the launcher at the door) breaks the clock, frees the one-victim
        // token, and never re-times the remaining keeps to chase the altered vh arc.
        this.enterComboRecover(attacker, attackerId, est, def.recoverTicks + knockbackTicks);
      } else if (step?.returnCapable && def.return && (est.returnsLeft ?? 0) > 0) {
        // G8 return conversion. `stepStartTick` begins only after recoil motion completes; from there the
        // enemy holds eight full ticks at the captured displaced point before the complete white windup.
        est.returnsLeft = Math.max(0, (est.returnsLeft ?? 0) - 1);
        est.empowered = true;
        est.phase = "return";
        est.stepStartTick = (this.state.tick + knockbackTicks) >>> 0;
        est.stepEndTick =
          (est.stepStartTick + RETURN_STAGGER_TICKS + def.return.windupTicks + RETURN_DASH_TICKS) >>> 0;
        attacker.comboFlags =
          (attacker.comboFlags & ~COMBO_FLAG_JUGGLE) | COMBO_FLAG_EMPOWERED;
        this.bumpComboSeq(attacker); // documented edge: empowered return STEP START
      }
    } else if (riposte && est) {
      if (est.strike) this.removeTelegraphRow(est.strike.tg);
      est.strike = undefined;
      est.phase = "recover";
      est.t = 1; // legacy interrupt: a full second of stagger before it can attack again
      attacker.windup = 0;
    }
    // G-02: augments belong to this success receipt, never to the button press that opened the window.
    this.applyParryAugments(player, pc);
    this.applyParryQuirk(player, pc, parryHeal);
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
        else {
          player.parriedSeq = (player.parriedSeq + 1) % 100000;
          this.applyParryAugments(player, pc);
        }
        this.bossController?.acceptWormParry(player.id, this.state.tick);
        return;
      }
      if (pc && this.slideInvulnerable(pc)) {
        this.noteSlideDodge(player);
        return;
      }
      this.damagePlayer(player, damage, "enemy"); // already depth-scaled by the controller
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
    // G-03: this known-weapon reward channel obeys the same boss anti-farm lock as mystery loot. Named
    // shifters guarantee their signature only outside that lock; ordinary rates stay deliberately scarce.
    if (this.bossId || kind.archetype === "boss") return;
    const chance = kind.shifter ? 1 : enemy.tough ? 0.06 : 0.02;
    if (Math.random() > chance) return;
    const pk = new PickupState();
    pk.id = `drop${this.pickupSeq++}`;
    pk.weapon = kind.wieldsWeapon;
    pk.weaponPublic = kind.wieldsWeapon;
    // §13 the wielder's drop is identity-KNOWN (you saw the sword it swung) but its rarity/affix still
    // roll on drop (v0.104) — same squad-LUK table as the mystery channel (one rarity economy).
    pk.rarity = rollRarity(Math.random(), this.bestLuk());
    pk.affix = rollAffix(Math.random(), pk.rarity).id;
    pk.affixPublic = pk.affix;
    const sp = this.placePickupPos(enemy.x, enemy.y);
    pk.x = sp.x;
    pk.y = sp.y;
    this.state.pickups.set(pk.id, pk);
    this.earnedPickups.add(pk.id); // §13 v0.103: an ENEMY drop is EARNED — it carries salvage value
    this.pickupWeaponBankMeta.set(pk.id, {
      provenance: "enemy-drop",
      ownerId: "",
      ownerLockUntil: 0,
    });
    this.publishPetPickupEligibility();
  }

  /** Advance every projectile, expire at TTL/arena edge. HOSTILE projectiles hit players (parry-/
   *  level-immune); FRIENDLY (thrown) projectiles cut through enemies up to their pierce count. */
  private stepProjectiles(dt: number): void {
    const doomed: string[] = [];
    this.state.projectiles.forEach((pr, id) => {
      let projectileFromX = pr.x;
      let projectileFromY = pr.y;
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
          projectileFromX = pr.x;
          projectileFromY = pr.y;
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
      const hitPoi = poiCollisionAt(this.map, pr.x, pr.y);
      if (hitPoi) {
        if ((meta.bounces ?? 0) > 0) {
          meta.bounces = (meta.bounces ?? 0) - 1;
          const nx = pr.x - hitPoi.circle.x;
          const ny = pr.y - hitPoi.circle.y;
          const nl = Math.hypot(nx, ny) || 1;
          const ux = nx / nl;
          const uy = ny / nl;
          const dot = pr.vx * ux + pr.vy * uy;
          pr.vx -= 2 * dot * ux;
          pr.vy -= 2 * dot * uy;
          pr.x = hitPoi.circle.x + ux * (hitPoi.circle.radius + PROJECTILE_RADIUS);
          pr.y = hitPoi.circle.y + uy * (hitPoi.circle.radius + PROJECTILE_RADIUS);
          meta.hit.clear();
          meta.pierce = meta.pierceMax ?? meta.pierce;
          meta.ttl += meta.legTtl ?? 0;
          projectileFromX = pr.x;
          projectileFromY = pr.y;
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
          if (pc && this.slideInvulnerable(pc)) {
            this.noteSlideDodge(player);
            return;
          }
          this.damagePlayer(player, meta.damage, "enemy");
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
        this.enemyGrid.queryRadius(
          pr.x,
          pr.y,
          PROJECTILE_RADIUS + MAX_ENEMY_RADIUS,
          this.enemyCandidates,
        );
        for (const eid of this.enemyCandidates) {
          if (meta.pierce <= 0 || meta.hit.has(eid)) continue;
          const enemy = this.state.enemies.get(eid);
          if (!enemy) continue;
          const reach = (ENEMY_KINDS[enemy.kind]?.radius ?? ENEMY_RADIUS) + PROJECTILE_RADIUS;
          const dx = pr.x - enemy.x;
          const dy = pr.y - enemy.y;
          if (dx * dx + dy * dy <= reach * reach) {
            meta.hit.add(eid);
            meta.pierce -= 1;
            // Route through the ONE damage primitive (Brand · dummy-reset · boss portal · drop · XP) so the
            // projectile path can't drift from the swing/blast path (was a hand-duplicated copy).
            this.damageEnemy(
              enemy,
              eid,
              meta.damage,
              kills,
              meta.crit ?? 0,
              meta.sourcePlayerId ?? "",
              meta.sourceWeaponId ?? "",
              meta.delivery ?? 0,
              meta.sourceX ?? pr.x,
              meta.sourceY ?? pr.y,
            );
          }
        }
        const runtime = this.bossController?.wormRuntime;
        if (runtime && meta.pierce > 0) {
          this.wormHitSlots.length = 0;
          this.wormSegmentGrid.queryAabb(
            Math.min(projectileFromX, pr.x) - PROJECTILE_RADIUS - 52,
            Math.min(projectileFromY, pr.y) - PROJECTILE_RADIUS - 52,
            Math.max(projectileFromX, pr.x) + PROJECTILE_RADIUS + 52,
            Math.max(projectileFromY, pr.y) + PROJECTILE_RADIUS + 52,
            this.wormSegmentCandidates,
          );
          let wormContacts = 0;
          for (const slot of this.wormSegmentCandidates) {
            if (meta.pierce <= 0 || wormContacts >= 2) break;
            const hitKey = `worm:${slot}:${runtime.segmentGeneration(slot)}`;
            if (meta.hit.has(hitKey)) continue;
            if (!runtime.segmentIntersectsSweptCapsule(
              slot,
              projectileFromX,
              projectileFromY,
              pr.x,
              pr.y,
              PROJECTILE_RADIUS,
            )) continue;
            meta.hit.add(hitKey);
            meta.pierce--;
            wormContacts++;
            this.wormHitSlots.push(slot);
          }
          this.damageWormSlots(
            this.wormHitSlots,
            meta.damage,
            `projectile:${id}`,
            kills,
            meta.crit ?? 0,
            true,
            meta.sourcePlayerId ?? "",
            meta.sourceWeaponId ?? "",
            meta.delivery ?? 0,
            meta.sourceX ?? pr.x,
            meta.sourceY ?? pr.y,
          );
        }
        for (const eid of kills) this.state.enemies.delete(eid);
        // Bouncing rounds survive a spent pierce — they re-arm on the next carom (above).
        if (meta.pierce <= 0 && (meta.bounces ?? 0) <= 0) doomed.push(id);
      }
    });
    for (const id of doomed) {
      const pr = this.state.projectiles.get(id);
      const meta = this.projectileMeta.get(id);
      // Detonate exploding projectiles (magma scatter) at their death position — §14 WYSIWYG.
      if (pr && meta?.explode)
        this.detonate(
          pr.x,
          pr.y,
          meta.explode.radius,
          meta.explode.damage,
          meta.crit ?? 0,
          meta.sourcePlayerId ?? "",
          meta.sourceWeaponId ?? "",
          meta.delivery ?? 0,
        );
      this.removeProjectile(id);
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
      sourcePlayerId?: string;
      sourceWeaponId?: string;
      delivery?: number;
      sourceX?: number;
      sourceY?: number;
    },
    player: PlayerState,
    pc: CombatState,
  ): void {
    if (meta.hostile)
      this.hostileProjectileCount = Math.max(0, this.hostileProjectileCount - 1);
    pr.hostile = false;
    meta.hostile = false;
    meta.sourcePlayerId = player.id;
    meta.sourceWeaponId = player.weapon;
    meta.delivery = CombatDelivery.Parry;
    meta.sourceX = player.x;
    meta.sourceY = player.y;
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
    this.applyHeal(player, PARRY_CHAIN_HEAL);
    this.applyParryAugments(player, pc);
    this.applyParryQuirk(player, pc, PARRY_CHAIN_HEAL);
    this.recordPetAcceptedAction(player.id);
  }

  private bestHarvestMultiplier(): number {
    let bestLuk = 1;
    let multiplier = 1;
    this.state.players.forEach((player) => {
      if (!player.alive) return;
      const candidate = this.combat.get(player.id)?.mods.harvestMult ?? 1;
      if (player.luk > bestLuk) {
        bestLuk = player.luk;
        multiplier = candidate;
      } else if (player.luk === bestLuk) {
        multiplier = Math.max(multiplier, candidate);
      }
    });
    return multiplier;
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
        if (dx * dx + dy * dy <= r2) {
          // Enemy-created zoner puddles are not authored neutral ground hazards.
          this.damagePlayer(player, ZONE_DPS * depthDamageScale(this.state.depth) * dt, "enemy");
        }
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
        if (room.boss)
          // §36 the finale boss: the room's authored kind (Sky Carrier → the colossus), else the level's
          // dimension boss — so each level ends on its own capstone.
          this.spawnBoss(room.bossKind ?? getDimension(this.state.dimensionId).boss);
        else this.spawnBeltWave(room.wave, prevGate, room.gateX);
      }
    } else if (this.beltPhase === "fight") {
      const bossAlive = room.boss ? this.bossId !== null : false;
      if (!bossAlive && trashAlive === 0) {
        this.beltPhase = "cleared";
        this.state.beltLockX = 0; // gate opens
        if (room.boss) this.beginXpBoundary("belt-victory"); // catch the finale XP before the win teardown
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
      this.insertEnemyGrid(enemy.id, enemy);
    }
  }

  /** Spawn enemies on a ring around a random player, accelerating with run time (§5/§6) and pressing
   *  harder per §6 chain depth (v0.103). */
  private runSpawnDirector(dt: number, anchors: Vec2[]): void {
    if (this.bossController?.wormRuntime) return;
    if (anchors.length === 0) return; // nobody to hunt — pause spawning
    this.spawnAccum += dt;
    const interval = spawnInterval(this.state.elapsed, this.state.depth);
    while (this.spawnAccum >= interval && this.effectiveEnemyBodies() < MAX_ENEMIES) {
      // QOL-05: an unfair final correction defers this spawn credit; do not turn it into a surprise on the
      // next interval or spin the while-loop against an impossible candidate set.
      if (!this.spawnEnemy(anchors)) break;
      this.spawnAccum -= interval;
    }
  }

  /** Reuses stable target rows and scans the fixed receipt ring for the authored four-second threat share. */
  private buildVastagharTargets(): void {
    let count = 0;
    this.state.players.forEach((player, id) => {
      let target = this.vastagharTargets[count];
      if (!target) {
        target = { id: "", x: 0, y: 0, alive: false, downTick: 0, recentBossDamage: 0 };
        this.vastagharTargets[count] = target;
      }
      target.id = id;
      target.x = player.x;
      target.y = player.y;
      target.alive = player.alive;
      if (!player.alive && !this.vastagharDownTicks.has(id))
        this.vastagharDownTicks.set(id, this.state.tick);
      if (player.alive) this.vastagharDownTicks.delete(id);
      target.downTick = this.vastagharDownTicks.get(id) ?? this.state.tick;
      target.recentBossDamage = 0;
      count++;
    });
    this.vastagharTargets.length = count;
    if (!this.bossId) return;
    for (const receipt of this.state.combatReceipts) {
      if (
        receipt.seq === 0 ||
        receipt.targetId !== this.bossId ||
        !receipt.sourcePlayerId ||
        ((this.state.tick - receipt.tick) >>> 0) > 80
      ) continue;
      for (let i = 0; i < count; i++) {
        const target = this.vastagharTargets[i];
        if (target?.id === receipt.sourcePlayerId) {
          target.recentBossDamage += Math.max(0, receipt.damage);
          break;
        }
      }
    }
  }

  /** Beam-heat-style ultimate truth: private float, quantized mirror, one ready sequence edge. */
  private syncUltimateCharge(player: PlayerState, c: CombatState): void {
    const quantized = Math.max(
      0,
      Math.min(ULT_CHARGE_MAX, Math.floor(c.ultChargeF * ULT_CHARGE_MAX + 1e-9)),
    );
    if (player.ultCharge === quantized) return;
    const becameReady = player.ultCharge < ULT_CHARGE_MAX && quantized >= ULT_CHARGE_MAX;
    player.ultCharge = quantized;
    if (becameReady) player.ultSeq = (player.ultSeq + 1) & 0xffff;
  }

  /** Personal anti-farm seam shared by ordinary enemies and Serraketh slots. */
  private accrueUltimateCharge(
    sourcePlayerId: string,
    applied: number,
    finalBlow: boolean,
    enemyKind: string,
    delivery: number,
  ): void {
    if (!sourcePlayerId || enemyKind === "dummy" || this.state.mode === "training") return;
    const player = this.state.players.get(sourcePlayerId);
    const c = this.combat.get(sourcePlayerId);
    if (
      !player?.alive ||
      !c ||
      player.ultArchetype === 0 ||
      player.ultPhase !== UltimatePhase.Idle ||
      delivery === CombatDelivery.Ultimate ||
      c.ultChargeF >= 1 ||
      c.ultAccrualThisTick >= ULT_CHARGE_TICK_CAP
    ) return;
    const family = ultimateFamilyForCode(player.ultArchetype);
    let gain = Math.max(0, applied) * ULT_CHARGE_PER_DAMAGE;
    if (family === UltimateFamily.SunspiteComet) gain *= 1.25;
    let killGain = finalBlow ? ULT_CHARGE_KILL_BONUS : 0;
    if (family === UltimateFamily.AlphaStrike) killGain *= 1.5;
    gain += killGain;
    if (family === UltimateFamily.Seismarch && player.ultVariant === "dex") gain *= 1.15;
    if (player.ultTempered) gain *= ULT_TEMPER_CHARGE_MULT;
    const admitted = Math.min(gain, ULT_CHARGE_TICK_CAP - c.ultAccrualThisTick, 1 - c.ultChargeF);
    if (admitted <= 0) return;
    c.ultAccrualThisTick += admitted;
    c.ultChargeF += admitted;
    this.syncUltimateCharge(player, c);
  }

  private addUltimateFlatCharge(player: PlayerState, c: CombatState, amount: number): void {
    if (
      this.state.mode === "training" ||
      !player.alive ||
      player.ultArchetype === 0 ||
      player.ultPhase !== UltimatePhase.Idle ||
      c.ultChargeF >= 1 ||
      c.ultAccrualThisTick >= ULT_CHARGE_TICK_CAP
    ) return;
    const scaled = amount * (player.ultTempered ? ULT_TEMPER_CHARGE_MULT : 1);
    const admitted = Math.min(scaled, ULT_CHARGE_TICK_CAP - c.ultAccrualThisTick, 1 - c.ultChargeF);
    if (admitted <= 0) return;
    c.ultAccrualThisTick += admitted;
    c.ultChargeF += admitted;
    this.syncUltimateCharge(player, c);
  }

  /** Validate the FINAL corrected point against every living player's warning circle and a conservative
   *  gameplay-camera rectangle. The bounded angular fan reuses the real safe-position correction for each
   *  attempt and writes the accepted result into the two scalar scratch fields. */
  private findFairEnemySpawn(anchor: Vec2, radius: number, baseAngle: number): boolean {
    const minDistance2 = SPAWN_MIN_DISTANCE * SPAWN_MIN_DISTANCE;
    const margin = radius + 4;
    for (let attempt = 0; attempt < SPAWN_CANDIDATE_COUNT; attempt++) {
      const angle = baseAngle + (attempt / SPAWN_CANDIDATE_COUNT) * Math.PI * 2;
      const rawX = clamp(
        anchor.x + Math.cos(angle) * SPAWN_RING,
        margin,
        ARENA_WIDTH - margin,
      );
      const rawY = clamp(
        anchor.y + Math.sin(angle) * SPAWN_RING,
        margin,
        ARENA_HEIGHT - margin,
      );
      const corrected = safeSpawnPos(this.map, rawX, rawY, radius);
      let fair = true;
      this.state.players.forEach((player) => {
        if (!fair || !player.alive) return;
        const dx = corrected.x - player.x;
        const dy = corrected.y - player.y;
        if (
          dx * dx + dy * dy + 1e-6 < minDistance2 ||
          (Math.abs(dx) <= SPAWN_CAMERA_HALF_WIDTH &&
            Math.abs(dy) <= SPAWN_CAMERA_HALF_HEIGHT)
        )
          fair = false;
      });
      if (!fair) continue;
      this.spawnCandidateX = corrected.x;
      this.spawnCandidateY = corrected.y;
      return true;
    }
    return false;
  }

  private spawnEnemy(anchors: Vec2[]): boolean {
    if (this.effectiveEnemyBodies() >= MAX_ENEMIES) return false;
    // §17 weighted pick scoped to the ACTIVE dimension's roster (frost enemies never spawn in the desert).
    const kindId = pickEnemyKind(Math.random(), getDimension(this.state.dimensionId).roster);
    const kind = ENEMY_KINDS[kindId];
    if (!kind) return false;
    const anchor = anchors[Math.floor(Math.random() * anchors.length)] ?? anchors[0];
    if (!anchor) return false;

    // Appear on a ring just beyond a typical screen edge, then converge inward.
    const angle = Math.random() * Math.PI * 2;
    if (!this.belt && !this.findFairEnemySpawn(anchor, kind.radius, angle)) return false;
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
    const m = kind.radius + 4;
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
      this.insertEnemyGrid(enemy.id, enemy);
      return true;
    }
    enemy.x = this.spawnCandidateX;
    enemy.y = this.spawnCandidateY;
    this.state.enemies.set(enemy.id, enemy);
    this.insertEnemyGrid(enemy.id, enemy);
    return true;
  }

  /** §21 Dev summon: place ONE enemy of `kindId` on the spawn ring around `anchor`, optionally tough.
   *  Mirrors spawnEnemy's placement (ring offset + pit/POI safe-spawn) but with a CHOSEN kind/tier so the
   *  Testing-Grounds Tab menu can conjure exactly what the playtester wants to fight. */
  private debugSpawnOne(kindId: string, tough: boolean, anchor: PlayerState): void {
    // §44 HARD entity cap (Sol audit P0 #1): the spawn director respects MAX_ENEMIES but this path
    // didn't — a summon flood could push the room into the quadratic collision loop unbounded.
    if (this.effectiveEnemyBodies() >= MAX_ENEMIES) return;
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
    this.insertEnemyGrid(enemy.id, enemy);
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
      this.applyHeal(p, p.maxHp * BOSSRUSH_HEAL_FRAC);
    });
    this.dropLoot(x, y, 1, LOOT_TIER_LUK_BOSS); // the reward for the clear (boss-tier rarity)
    this.bossRushIndex++;
    if (this.bossRushIndex >= BOSS_DEF_IDS.length) {
      // GAUNTLET CLEARED: the boss core catches before progression presentation is torn down and banked.
      this.beginXpBoundary("bossrush-victory");
      return;
    }
    this.beginNextPetDimension();
    // Escalate the difficulty (HP + damage) with each round, and queue the next boss after a breather.
    this.state.depth = Math.min(255, this.bossRushIndex + 1);
    this.bossRushNextTimer = BOSSRUSH_BREATHER;
  }

  /** Spawn a BOSS on a ring around a player (§16) — the run's capstone threat. `overrideKind` (the debug
   *  picker) spawns a specific boss BODY; otherwise the active dimension's boss. The body kind supplies the
   *  sprite/hp/radius; its `BossDef` (or CLASSIC_BOSS fallback) drives the attacks via the BossController. */
  private retireStageForVastaghar(): void {
    this.state.enemies.clear();
    this.enemyGrid.clear();
    this.state.projectiles.clear();
    this.projectileMeta.clear();
    this.hostileProjectileCount = 0;
    this.state.zones.clear();
    this.zoneMeta.clear();
    this.state.telegraphs.clear();
    this.enemyFireCd.clear();
    this.zonerDropCd.clear();
    this.comboState.clear();
    this.duelTokens.clear();
    this.dodgeState.clear();
    this.poundEnemyEffects.clear();
    this.bossAddIds.clear();
    this.bossAddExpireTick.clear();
    this.shifterId = null;
    this.shifterTimer = 0;
  }

  private spawnBoss(overrideKind?: string, petAwardEligible = true): void {
    const bossKind =
      overrideKind &&
      (ENEMY_KINDS[overrideKind]?.archetype === "boss" || BOSS_DEF_IDS.includes(overrideKind))
        ? overrideKind
        : getDimension(this.state.dimensionId).boss;
    const def = bossDefFor(bossKind);
    const bodyKind = ENEMY_KINDS[bossKind] ? bossKind : def.worm?.rootKind;
    const kind = bodyKind ? ENEMY_KINDS[bodyKind] : undefined;
    if (!kind) return;
    if (this.vastagharEncounter && !this.bossId) {
      this.vastagharEncounter.dispose(this.bossSink);
      this.vastagharEncounter = null;
    }
    // A picker re-spawn while a boss is up: retire the old one, its adds, and its telegraphs first. Evicting
    // the tracked adds (not just clearing the Set) stops them lingering off-cap under the new boss.
    if (this.bossId) {
      this.state.enemies.delete(this.bossId);
      for (const addId of this.bossAddIds) this.state.enemies.delete(addId);
      this.clearBoss();
    }
    if (def.encounter === "vastaghar" && !(this.belt && this.beltLevel))
      this.retireStageForVastaghar();
    // The custom collection is not free capacity: reserve every authored starting hurt body before admission.
    if (def.encounter === "worm" && this.state.enemies.size + WORM_MAX_SEGMENTS + 3 > MAX_ENEMIES) return;
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
    boss.kind = bodyKind!;
    // §6 boss HP-sponge × players × chain depth (v0.103 — deeper capstones are meaner).
    boss.hp =
      (def.worm?.baseCoreHp ?? kind.hp) *
      enemyHpScale(this.state.players.size) *
      depthHpScale(this.state.depth);
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
    // §33 belt: place it ON the deck — just ahead of the room gate, mid-depth — instead of the procgen map.
    if (this.belt && this.beltLevel) {
      boss.x = clamp((this.state.beltLockX || bx) - 260, kind.radius, this.beltLevel.length - kind.radius);
      boss.y = clampBeltFloorY(this.beltLevel, boss.x, BELT_Y0 + DEPTH_MAX * 0.5, kind.radius);
    } else {
      const sp = safeSpawnPos(this.map, bx, by, kind.radius);
      boss.x = sp.x;
      boss.y = sp.y;
    }
    this.state.enemies.set(boss.id, boss);
    this.bossSpawned = true;
    this.bossId = boss.id;
    this.bossPetAwardEligible = petAwardEligible && this.state.mode !== "training";
    // §16 v0.109 the data-driven controller runs this boss's def (CLASSIC_BOSS = OLD RUST for any kind
    // without a bespoke def, so every dimension boss keeps its behaviour). maxHp frozen for phase thresholds.
    const controllerSeed = randomSeed();
    this.bossController = new BossController(def, boss.hp, controllerSeed);
    if (def.encounter === "worm") {
      this.bossController.attachWorm(this.state.wormBoss, boss, this.state.tick, angle + Math.PI);
    }
    if (def.encounter === "vastaghar" && def.vastaghar && !(this.belt && this.beltLevel)) {
      let poi0 = 255;
      let poi1 = 255;
      let score0 = Number.POSITIVE_INFINITY;
      let score1 = Number.POSITIVE_INFINITY;
      let quadrant0 = -1;
      for (let i = 0; i < this.map.pois.length; i++) {
        const poi = this.map.pois[i];
        if (!poi) continue;
        const dx = poi.x - boss.x;
        const dy = poi.y - boss.y;
        const distance = Math.hypot(dx, dy);
        if (distance < 320 || distance > 760 || distance > 1100) continue;
        const score = Math.abs(distance - 540) * 100 + i;
        if (score < score0) {
          poi0 = i;
          score0 = score;
          quadrant0 = (dx >= 0 ? 1 : 0) | (dy >= 0 ? 2 : 0);
        }
      }
      for (let i = 0; i < this.map.pois.length; i++) {
        if (i === poi0) continue;
        const poi = this.map.pois[i];
        if (!poi) continue;
        const dx = poi.x - boss.x;
        const dy = poi.y - boss.y;
        const distance = Math.hypot(dx, dy);
        if (distance < 320 || distance > 760 || distance > 1100) continue;
        const quadrant = (dx >= 0 ? 1 : 0) | (dy >= 0 ? 2 : 0);
        const score = Math.abs(distance - 540) * 100 + i + (quadrant === quadrant0 ? 100_000 : 0);
        if (score < score1) {
          poi1 = i;
          score1 = score;
        }
      }
      const firstPoi = poi0 === 255 ? undefined : this.map.pois[poi0];
      const secondPoi = poi1 === 255 ? undefined : this.map.pois[poi1];
      this.vastagharEncounter = new VastagharEncounterRuntime(
        def.vastaghar,
        this.state.vastaghar,
        boss.hp,
        boss.id,
        this.state.tick,
        poi0,
        firstPoi?.x ?? 0,
        firstPoi?.y ?? 0,
        poi1,
        secondPoi?.x ?? 0,
        secondPoi?.y ?? 0,
      );
    }
    this.insertEnemyGrid(boss.id, boss);
    this.rebuildWormSegmentGrid();
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
        const combo = this.comboState.get(this.shifterId);
        if (combo?.strike) this.removeTelegraphRow(combo.strike.tg);
        if (combo?.tg) this.removeTelegraphRow(combo.tg);
        if (combo?.targetId && this.duelTokens.get(combo.targetId) === this.shifterId)
          this.duelTokens.delete(combo.targetId);
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
    if (!this.spawnShifter(bodies)) this.shifterCd = 0;
  }

  /** Phase a shifter in at the arena edge near a living drifter. Tier escalates with run time AND §6 chain
   *  depth (v0.103 — a depth-3 dimension opens with a mid-tier invader, matching the world around it); HP
   *  ramps per incursion across the WHOLE run (shifterWaves survives descents — "tougher deeper into the
   *  chain") and scales with depth like everything else. Hunts for `shifter.window` sec, then phases out. */
  private spawnShifter(bodies: Vec2[]): boolean {
    if (SHIFTER_KIND_IDS.length === 0 || bodies.length === 0) return false;
    const tier = Math.min(
      SHIFTER_KIND_IDS.length - 1,
      this.state.depth - 1 + Math.floor(this.state.elapsed / SHIFTER_TIER_SECONDS),
    );
    const kindId = SHIFTER_KIND_IDS[tier];
    const kind = kindId ? ENEMY_KINDS[kindId] : undefined;
    if (!kindId || !kind) return false;
    const anchor = bodies[Math.floor(Math.random() * bodies.length)] ?? {
      x: ARENA_WIDTH / 2,
      y: ARENA_HEIGHT / 2,
    };
    const angle = Math.random() * Math.PI * 2;
    if (!this.findFairEnemySpawn(anchor, kind.radius, angle)) return false;
    const s = new EnemyState();
    s.id = `shifter${this.enemySeq++}`;
    s.kind = kindId;
    s.hp =
      kind.hp *
      enemyHpScale(this.state.players.size) *
      depthHpScale(this.state.depth) *
      (1 + SHIFTER_HP_PER_WAVE * this.shifterWaves);
    s.x = this.spawnCandidateX;
    s.y = this.spawnCandidateY;
    this.state.enemies.set(s.id, s);
    this.insertEnemyGrid(s.id, s);
    this.shifterId = s.id;
    this.shifterTimer = kind.shifter?.window ?? 20;
    this.shifterWaves++;
    console.log(
      `[room ${this.roomId}] ⌁ shifter incursion — ${kindId} (wave ${this.shifterWaves})`,
    );
    return true;
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
   *  QOL-03 solves them jointly as reachable, full-footprint safe discs with a protected separation.
   *  The boss ALSO pays the chain's real wage (v0.103 — the "richer" in the rift's promise): every living
   *  player pockets BOSS_SALVAGE_PER_DEPTH × depth carried salvage — bank it now or gamble it deeper. */
  private openPortal(x: number, y: number): void {
    const wage = BOSS_SALVAGE_PER_DEPTH * this.state.depth;
    this.state.players.forEach((p) => {
      if (p.alive) p.salvaged += wage;
    });
    const gates = placeArenaGatePair(this.map, x, y, EXTRACT_RADIUS);
    const gateValidation = validateArenaGatePair(this.map, gates);
    if (!gateValidation.ok)
      throw new Error(`invalid post-boss gate pair: ${gateValidation.reason}`);
    this.state.portalOpen = true;
    this.state.portalX = gates.extractX;
    this.state.portalY = gates.extractY;
    this.state.riftOpen = true;
    this.state.riftX = gates.riftX;
    this.state.riftY = gates.riftY;
    this.extractArmTimer = EXTRACT_ARM_SECONDS;
    this.extractHoldTimer = 0;
    this.extractBlocked.clear();
    this.bossId = null;
    console.log(
      `[room ${this.roomId}] boss defeated — extraction portal + deeper rift open (depth ${this.state.depth})`,
    );
  }

  private resetExtractionIntent(): void {
    this.extractArmTimer = -1;
    this.extractHoldTimer = 0;
    this.extractBlocked.clear();
  }

  /** §6 rift descent (v0.103, the chain): depth+1, a NEW dimension + freshly-seeded map, the same squad —
   *  levels/attributes/weapons/augments/carried salvage/HP all persist (that's the greed: you push in
   *  whatever shape the last fight left you). The field is cleared, the clock and boss director reset. */
  private transitionDimension(): void {
    // Normal descent reaches this only after the cleanup vacuum; defensive cleanup prevents stale rows if a
    // server operator invokes the transition directly during recovery/testing.
    this.clearXpEchoes();
    this.beginNextPetDimension();
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
    this.resetElapsed();
    this.spawnAccum = 0;
    this.state.outcome = "active";
    this.state.portalOpen = false;
    this.resetExtractionIntent();
    this.state.riftOpen = false;
    this.bossSpawned = false;
    this.clearBoss(); // §16 v0.109 also resets bossPhase/bossKind + clears telegraphs
    this.resetShifters(true); // keep the per-incursion HP ramp — a descent IS "deeper into the chain"
    // Carry the whole squad through the rift — downed bodies come too, arriving STILL DOWN at the new
    // spawn (the rez-or-dead rule doesn't soften mid-chain; a rez weapon works on the far side).
    this.state.players.forEach((player, id) => {
      const c = this.combat.get(id);
      this.snapshotRunIdentity(player, c, true, player.alive);
      player.x = this.map.spawnX + (Math.random() * 200 - 100);
      player.y = this.map.spawnY + (Math.random() * 200 - 100);
      player.vx = 0;
      player.vy = 0;
      player.height = 0;
      if (c) {
        c.lastGroundX = player.x;
        c.lastGroundY = player.y;
        c.pitGrace = 0;
        // The Hair-Trigger streak timestamps ride the elapsed clock, which just reset — clear them or the
        // first parry in the new dimension inherits the old dimension's streak (verify finding).
        c.lastParryAt = -999;
        c.hairStreak = 0;
      }
      const descentHeal = this.petRuns.get(id)?.mods.descentHealMaxHpFraction ?? 0;
      if (descentHeal > 0) this.applyHeal(player, player.maxHp * descentHeal, false);
      this.zeroMoveVel(id); // §7 the descent repositions the body — momentum doesn't cross dimensions
    });
    console.log(
      `[room ${this.roomId}] ⇓ rift descent — depth ${this.state.depth}, dimension ${this.state.dimensionId}`,
    );
  }

  /** QOL-01 extraction is a deliberate post-reward choice: stabilise, block every body carried through the
   *  arming edge until it leaves, then require a short uninterrupted fresh spatial hold. Direct state-only
   *  test/dev gates retain the legacy immediate seam (`extractArmTimer < 0`); production gates all enter via
   *  `openPortal` and can never use it. */
  private checkExtraction(bodies: Vec2[], dt = TICK_MS / 1000): void {
    if (!this.state.portalOpen || this.state.outcome !== "active" || bodies.length === 0) return;
    const r2 = EXTRACT_RADIUS * EXTRACT_RADIUS;
    if (this.extractArmTimer < 0) {
      let reached = false;
      this.state.players.forEach((player, id) => {
        if (!player.alive || this.combat.get(id)?.stance === STANCE_SLIDE) return;
        const dx = player.x - this.state.portalX;
        const dy = player.y - this.state.portalY;
        if (dx * dx + dy * dy <= r2) reached = true;
      });
      if (reached) this.beginXpBoundary("extract");
      return;
    }

    if (this.extractArmTimer > 0) {
      this.extractArmTimer = Math.max(0, this.extractArmTimer - dt);
      if (this.extractArmTimer > 0) return;
      this.extractBlocked.clear();
      this.state.players.forEach((player, id) => {
        if (!player.alive) return;
        const dx = player.x - this.state.portalX;
        const dy = player.y - this.state.portalY;
        if (dx * dx + dy * dy <= r2) this.extractBlocked.add(id);
      });
      this.extractHoldTimer = 0;
      return;
    }

    let holding = false;
    this.state.players.forEach((player, id) => {
      if (!player.alive || this.combat.get(id)?.stance === STANCE_SLIDE) return;
      const dx = player.x - this.state.portalX;
      const dy = player.y - this.state.portalY;
      const inside = dx * dx + dy * dy <= r2;
      if (!inside) {
        this.extractBlocked.delete(id);
        return;
      }
      if (!this.extractBlocked.has(id)) holding = true;
    });
    this.extractHoldTimer = holding ? this.extractHoldTimer + dt : 0;
    if (this.extractHoldTimer + 1e-9 >= EXTRACT_HOLD_SECONDS)
      this.beginXpBoundary("extract");
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
    if (bodies.length > 0)
      this.state.players.forEach((player, id) => {
        if (!player.alive || this.combat.get(id)?.stance === STANCE_SLIDE) return;
        const dx = player.x - this.state.riftX;
        const dy = player.y - this.state.riftY;
        if (dx * dx + dy * dy <= r2) holding = true;
      });
    if (holding) {
      this.state.riftCharge = Math.min(1, this.state.riftCharge + dt / RIFT_CHANNEL_SECONDS);
      if (this.state.riftCharge >= 1) {
        this.state.riftCharge = 0;
        this.beginXpBoundary("descent");
      }
    } else if (this.state.riftCharge > 0) {
      this.state.riftCharge = Math.max(0, this.state.riftCharge - (dt / RIFT_CHANNEL_SECONDS) * 2);
    }
  }
}
