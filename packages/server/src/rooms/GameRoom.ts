import { randomBytes } from "node:crypto";
import {
  ACTION_MSGS_PER_TICK,
  ACTIVE_WEAPON_CATALOG_IDS,
  ARENA_HEIGHT,
  ARENA_WIDTH,
  ARSENAL_SLOTS,
  type ArenaMap,
  ArenaState,
  ArsenalSlot,
  ATTACK_BUFFER_SECONDS,
  ATTACK_HELD_WINDOW,
  type Attr,
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
  admittedPrismaticBeamRayCount,
  advanceChestCadence,
  advanceParryGuardCycle,
  appendRareRelic,
  BAG_CAP,
  BASE_MONEY_DROP_REACH,
  BEAM_COOL_PER_SECOND,
  BEAM_CRIT_QUANTUM_SECONDS,
  BEAM_OVERHEAT_LOCK_SECONDS,
  BEAM_RECOVERY_SECONDS,
  BEAM_RESTART_HEAT,
  BEAM_STALE_INPUT_TICKS,
  BELT_Y0,
  type BeamDescriptor,
  BeamPhase,
  BeamState,
  type BeltLevel,
  BOSS_DEF_IDS,
  BOSS_PROJECTILE_BUDGET,
  BOSSRUSH_BREATHER,
  BOSSRUSH_HEAL_FRAC,
  type BossCounterSummary,
  BRAND_DAMAGE_MULT,
  BRAND_DURATION,
  BULWARK_SHIELD,
  beamDescriptorFor,
  beamStepDamage,
  beamSweepSampleCount,
  beltLevelFor,
  beltPlayableXBounds,
  beltPitAtX,
  beltProjectileBlocked,
  beltSafeX,
  CORPORATE_ELEVATOR_ARRIVAL_TICKS,
  CORPORATE_ELEVATOR_COUNTDOWN_TICKS,
  CORPORATE_ELEVATOR_DEPART_TICKS,
  CORPORATE_ELEVATOR_INTERACT_X,
  CORPORATE_ELEVATOR_PHASE,
  corporateGridBeltLevelForDepth,
  corporateGridFloorForBelt,
  corporateGridVariantCode,
  corporateGridVariantForDepth,
  bladeAngleAt,
  bladeExtensionPoseAt,
  bladeHitsCircle,
  bladeHitsCircleXY,
  bossDefFor,
  bossSpawnAt,
  CAST_VOLLEY_PROJECTILE_CAP,
  type CarrySelectionV1,
  type ClientMovementReport,
  CHAIN_MAX_RANGE,
  CHEST_OPEN_RADIUS,
  CHEST_PLACEMENT_RADIUS,
  type ChainCandidate,
  type ChestCadenceState,
  type ChestKind,
  ChestState,
  COMBAT_RECEIPT_CAP,
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
  COMMON_RELIC_DEFS,
  CONFLAG_DELAY,
  CombatDelivery,
  CombatReceiptState,
  type CommonRelicId,
  CRIT_CHANCE_CAP,
  CRIT_MULT,
  characterScale,
  chargedProjectileFraction,
  chargedProjectileSnapshot,
  chestCadenceInitial,
  classifyParryIncidence,
  clamp,
  clampBeltFloorY,
  clampParrySlideToNavigation,
  clampQuakeEpicenter,
  clipPoiRayLength,
  comboStepForChain,
  committedMeleeEvaded,
  coneAngles,
  coneStreamHitsCircle,
  countAugment,
  countWeaponCopies,
  critChanceFor,
  DEATH_WARD_COOLDOWN_SECONDS,
  DEBUG_SPAWN_MAX,
  DEFAULT_CHARACTER,
  DEFAULT_DIMENSION,
  DEFAULT_WEAPON,
  DEFLECT_SPEED,
  DEFLECT_TTL,
  DEPTH_DODGE_MULT,
  DEPTH_MAX,
  DEPTH_TOL_ENEMY,
  DEPTH_TOL_PLAYER,
  DIMENSIONS,
  DISASSEMBLY_HOLD_TICKS,
  DIST_JUMP_AIRTIME,
  DIST_JUMP_COOLDOWN,
  DIST_JUMP_LANDING_SPEED_MULT,
  DIST_JUMP_MAX_STEER_RADIANS,
  DIST_JUMP_REACH,
  DIST_JUMP_SPEED,
  DIST_JUMP_STEER_RADIANS_PER_SECOND,
  DIST_JUMP_VERTICAL_VELOCITY,
  DRIVE_BEAM_CANCEL_COST,
  DRIVE_BEAM_IGNITION_COST,
  DRIVE_BEAM_NET_DRAIN_PER_SECOND,
  DRIVE_BEAM_RESTART_THRESHOLD,
  DRIVE_CAPACITY,
  DRIVE_FLOOR_REGEN_PER_SECOND,
  DRIVE_MAX_GENERIC_RECOVERY_MULT,
  DRIVE_PRESSURE_MEMORY_SECONDS,
  DRIVE_THREAT_RADIUS,
  DROP_GRACE_SECONDS,
  DriveRegenMode,
  type DriveRegenModeValue,
  DUMMY_HP,
  DUMMY_RADIUS,
  depthDamageScale,
  depthHpScale,
  driveCostForProfile,
  driveRegenModeFor,
  driveRegenPerSecond,
  EMBERGUARD_BASE_DMG,
  EMBERGUARD_HALF_ARC,
  EMBERGUARD_RANGE,
  ENEMY_KINDS,
  ENEMY_MELEE_COMMIT_SECONDS,
  ENEMY_MELEE_COMMIT_TICKS,
  ENEMY_RADIUS,
  type EnemyKind,
  EnemyState,
  EXTRACT_RADIUS,
  type ExpeditionEntryV1,
  effectiveAcceptedWeaponInterval,
  effectiveMelee,
  encodedJsonByteLength,
  encodeGearCosmetics,
  enemyHpScale,
  FISTS_WEAPON,
  FRIENDLY_BEAM_ENTITY_CAP,
  FRIENDLY_PROJECTILE_ENTITY_CAP,
  type GearRunRuntime,
  GROUND_EPSILON,
  generateArena,
  getDimension,
  HAIRTRIGGER_MAX,
  HAIRTRIGGER_WINDOW,
  HIT_KNOCKBACK_IMPULSE,
  hasAugment,
  hasRareRelic,
  IMPULSE_FRICTION,
  INPUT_MSGS_PER_TICK,
  INPUT_QUEUE_MAX,
  IRON_STANCE_IFRAME_PER,
  IRON_STANCE_KNOCKBACK_PER,
  inMeleeArc,
  isAugment,
  isBreakActionWeapon,
  isCharacterUnlocked,
  isInsidePoi,
  isPetId,
  isPitAtPx,
  isPlayableCharacter,
  isRareRelicId,
  isWholeArtCharacter,
  JUGGLE_LANDING_MERCY,
  JUGGLE_MAX_AIR_HITS,
  JUGGLE_MAX_CONTROL_SECONDS,
  JUMP_BUFFER_SECONDS,
  type KatanaBeatEffect,
  katanaBeatEffectFor,
  LANDING_TIER_SOFT,
  type LandingThumpTier,
  landingThumpTier,
  lockedLungePointAt,
  lootCooldownMult,
  lootDamageMult,
  MAX_ENEMIES,
  MAX_MONEY_DROPS,
  MAX_PLAYERS,
  type MapZoneId,
  MELEE_BLADE_HALFWIDTH,
  MELEE_SAMPLE_STEP,
  META_ACCOUNT_REVISION_MAX,
  META_ACCOUNT_SCRIP_MAX,
  META_JOIN_MAX_BYTES,
  type MeleeComboFamily,
  type MeleeComboStep,
  type MetaAccountV5,
  MONEY_DROP_ARM_TICKS,
  MONEY_DROP_FLIGHT_TICKS,
  MONEY_DROP_REACH_MAX,
  MONEY_DROP_REACH_MIN,
  type MoneyBankReceipt,
  MoneyDropState,
  type MoveStance,
  meleeComboGraceMs,
  meleeComboSelectionFor,
  meleeDamageEnvelopeFor,
  meleeDamageHalfWidthAt,
  meleeDamageReachAt,
  mixSeeds,
  nearestGroundPx,
  nearestPoint,
  nextWeapon,
  nextWholeArtCharacter,
  PARRY_BUFFER_SECONDS,
  PARRY_CHAIN_CD,
  PARRY_CHAIN_HEAL,
  PARRY_CHAIN_HEAL_MAX_STACKS,
  PARRY_CHAIN_RIPOSTE_AT,
  PARRY_CHAIN_WINDOW,
  PARRY_COOLDOWN,
  PARRY_ENEMY_STAGGER_SECONDS,
  PARRY_IFRAMES,
  PARRY_KNOCKBACK,
  PARRY_LAUNCH,
  PARRY_LAUNCH_MAX,
  PARRY_PUSH,
  PARRY_REFLECT_DMG_MULT,
  PARRY_REFLECT_MIN_DAMAGE,
  PARRY_REFLECT_PIERCE,
  PARRY_REFLECT_SPEED,
  type ParryGuardCycleState,
  ParryReaction,
  PET_CATALOG_VERSION,
  type PetId,
  type PetMods,
  type PetProgressReceipt,
  type PetStageBand,
  PICKUP_RADIUS,
  PIT_FALL_DAMAGE_FRAC,
  PIT_FALL_GRACE,
  PickupState,
  PLAYER_MAX_HP,
  PLAYER_RADIUS,
  PLAYER_REGEN,
  PlayerAttackMoveMode,
  PlayerState,
  POUND_GATHER_SECONDS,
  POUND_JUMP_COOLDOWN,
  POUND_KNOCKBACK_SPEED,
  POUND_MIN_HEIGHT,
  POUND_RADIUS,
  POUND_RECOVERY_SECONDS,
  POUND_SPEED,
  POUND_STAGGER_SECONDS,
  PoiCollisionIndex,
  PROJECTILE_RADIUS,
  PROJECTILE_TTL,
  type ProjectileDamageEnvelope,
  ProjectileState,
  type ProjectileWaveformDef,
  packParryPresentation,
  parryGuardSubtypeKey,
  parrySlideDistance,
  petLevelForXp,
  petModsForLevel,
  petStageBandForLevel,
  pickEnemyKind,
  pickToughCombo,
  placeArenaGatePair,
  placeChestOnArena,
  playerAttackInputSpeedMultiplier,
  poiCollisionAt,
  pointInAnnulusGap,
  pointInOrientedRect,
  pointInSweptAnnularArc,
  poundDamage,
  presentPayloadExplosion,
  prevWeapon,
  prismaticBeamRayOffsets,
  projectileDamageEnvelopeFor,
  projectileWaveformPositionAt,
  QUAKE_REACH,
  type QuirkDef,
  type QuirkEffect,
  quirkForCharacter,
  RARE_RELIC_DEFS,
  RARITIES,
  RARITY_COMMON,
  type RareRelicId,
  RELIC_COMMON_STACK_CAP,
  RESPAWN_CLEAR_RADIUS,
  RETURN_STAGGER_TICKS,
  RETURN_STEP_MAX,
  REVIVE_HP_FRAC,
  RelicState,
  RIFT_CHANNEL_SECONDS,
  ROLL_ATTACK_CANCEL_SECONDS,
  ROLL_DURATION_TICKS,
  ROLL_PARRY_LOCK_SECONDS,
  type RuntimeMods,
  randomSeed,
  relicCritAdd,
  relicDodgeCooldown,
  relicEnergyCapacity,
  relicEnergyRegenAdd,
  relicHpRegenAdd,
  relicJumpCount,
  relicMoveSpeed,
  relicParryRadius,
  relicRollSpeedAtTick,
  resolveBeltObstacles,
  resolveBeltNavigation,
  resolveBodyCollisions,
  selectCorporateWaveAnchor,
  resolveOneShotProtection,
  resolvePoiCollisionInto,
  resolveRelicRevive,
  rollChestReward,
  runtimeModsForQuirk,
  SECOND_WIND_BASE,
  SHIFTER_FIRST_SECONDS,
  SHIFTER_HP_PER_WAVE,
  SHIFTER_INTERVAL,
  SHIFTER_KIND_IDS,
  SHIFTER_TIER_SECONDS,
  SLIDE_PHASE_GROUND,
  SLIDE_PHASE_OFF,
  type SlidePhase,
  SPAWN_RING,
  STANCE_CROUCH,
  STANCE_DASH,
  STANCE_NONE,
  STANCE_POUND,
  STANCE_SLIDE,
  type SwingDescriptor,
  safeSpawnPos,
  salvageArchivedWeaponBank,
  sanitizeMetaAccountV2,
  sanitizeMetaAccountV3,
  sanitizeMetaAccountV5WithDiagnostics,
  sanitizeMetaLevels,
  selectChainTargets,
  SERVER_MOTION_IMPULSE_TICKS,
  SERVER_MOTION_LAUNCH_TICKS,
  serverSeededGunPelletVolley,
  serverSeededPresentPayloadRoll,
  shortestAngleDelta,
  slideContactInvulnerable,
  spawnInterval,
  stepBeamAngle,
  stepEnemyChase,
  stepEnemyKite,
  evaluateClientMovementEnvelope,
  stepImpulse,
  stepPlayerAttackMovement,
  stepSteeredMovement,
  stepVertical,
  swingDescriptorFor,
  swingEdgeProgress,
  TelegraphState,
  TgShape,
  TICK_MS,
  TOUGH_COMBOS,
  TOUGH_DAMAGE_MULT,
  TOUGH_HP_MULT,
  type ToughComboDef,
  type ToughComboReturn,
  type ToughComboStep,
  thrownProjectileKindFor,
  toughChance,
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
  UltimateFamily,
  type UltimateFamilyValue,
  UltimatePhase,
  ultimateCodeFor,
  ultimateFamilyForCode,
  ultimateVariantForCode,
  unlockedWeaponDropPool,
  VASTAGHAR_ENCOUNTER,
  type VastagharArenaMutationKind,
  VastagharMode,
  type Vec2,
  validateArena,
  validateArenaGatePair,
  verticalTimeToGround,
  WEAPON_CARRY_MAX_PHYSICAL,
  WEAPON_DRAW_LOCK_SECONDS,
  WEAPON_IDS,
  WEAPON_PACK_MAX_CAPACITY,
  WEAPONS,
  type WeaponBankCuratorInputV1,
  type WeaponBankEntryV1,
  type WeaponDef,
  type WeaponDisassemblyReceipt,
  type WeaponInstanceV1,
  type WeaponProvenance,
  WORM_MAX_SEGMENTS,
  weaponAttackCooldown,
  weaponDisassemblyValue,
  weaponEffectCueSeconds,
  weaponEffectEmitterPoint,
  weaponEntryInstances,
  weaponEntryPhysicalSize,
  weaponMuzzleWorldPoint,
  weaponMuzzleWorldPointsForShot,
  weaponRarityId,
  weaponResourceProfile,
  weaponSetBonus,
  weaponUsesAuthoritativeEnvelopeCombo,
  ZONE_DPS,
  ZONE_RADIUS,
  ZONE_TTL,
  ZONER_DROP_INTERVAL,
  ZoneKind,
  ZoneState,
  ZoneStyle,
} from "@dd/shared";
import { type Client, Room } from "colyseus";
import { appendOwnerNote, sanitizeOwnerNote } from "../owner-notes.js";
import {
  BossController,
  type VastagharEmitSink,
  VastagharEncounterRuntime,
  type VastagharTarget,
} from "./BossController.js";
import { MeleeAttackTokens } from "./MeleeAttackTokens.js";
import {
  bankPetBondXp,
  commitWeaponCarry,
  settleWeaponExpedition,
  type WeaponSettlementResult,
  wipeWeaponBankForPrestige,
} from "./progression.js";
import { SpatialGrid } from "./SpatialGrid.js";import { COMBO_RINGOUT_ORBIT, COMBO_RIPOSTE_STAGGER_TICKS, ZERO_MOVE_INPUT, ZERO_IMPULSE, tickReached, ticksFromSeconds, pointSegmentDistanceSq, pointInConvexQuadrilateral, pointSweptUprightCapsuleDistanceSq, EXTRACT_ARM_SECONDS, EXTRACT_HOLD_SECONDS, SPAWN_CANDIDATE_COUNT, SPAWN_MIN_DISTANCE, SPAWN_CAMERA_HALF_WIDTH, SPAWN_CAMERA_HALF_HEIGHT, ENEMY_GRID_CELL_SIZE, MAX_ENEMY_RADIUS, ENEMY_SEPARATION_OVERLAP_FRACTION, ENEMY_SEPARATION_MAX_STEP, GROUND_ZONE_ENTITY_CAP, GROUND_ZONE_OWNER_CAP, roomProgressionMethods, GAME_ROOM_STATICS } from "./room/room-progression.js";
import type { InputCmd, InputState, WeaponResourceLedger, WeaponSpendReason, ZoneRuntime, WeaponSpendResult, PendingScatterVolley, PendingHybridProjectile, PendingWeaponThrow, ActiveMeleeSwing, DriveRuntime, RunWeaponLedger, PickupWeaponBankMeta, DisconnectedPlayerReservation, PlayerDamageKind, PetRunRuntime, UltimateTarget, UltimateRuntime, WeaponHand, CombatState, DuelistComboState, RewardBoundary, ServerMotionSource } from "./room/room-progression.js";
import { roomMovementMethods } from "./room/room-movement.js";
import { roomCombatMethods } from "./room/room-combat.js";
import { roomEnemyMethods } from "./room/room-enemies.js";
import { roomEconomyMethods } from "./room/room-economy.js";


/**
 * Authoritative PvE room (§4 RoR2-style host-authoritative sync via Colyseus).
 *
 * ONLINE NETCODE: the server runs a fixed 50ms timestep and consumes one bounded, sequence-numbered
 * command per player. B42 adopts a fresh owner-reported pose only inside the shared speed/continuity
 * envelope and server-owned navigation; violations and authored server-motion epochs retain server truth.
 * Remote entities interpolate tick-stamped adopted positions. Combat, enemies, damage, loot, and economy
 * never leave server authority.
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
  /** One allocation-free muzzle seam shared by charge sync, live collision, and replicated geometry. */
  private readonly beamMuzzleScratch = { x: 0, y: 0 };
  /** Tick-local launch markers defer only the first dash displacement while height/pit immunity begin now. */
  private readonly distanceJumpLaunches = new Set<string>();
  private readonly inputs = new Map<string, InputState>();
  /** B42 accepted owner poses are re-applied after legacy player-body resolution; navigation was already
   * swept and validated, while co-op friends deliberately do not become an authority wall. */
  private readonly acceptedClientMovement = new Map<string, ClientMovementReport>();
  /** Exclusive tick deadline for short server-authored impulse/reposition ownership windows. */
  private readonly serverMotionUntilTick = new Map<string, number>();
  /** Classification companion for the active B42 epoch. B45 recoil is the sole legal weapon source. */
  private readonly serverMotionSourceByPlayer = new Map<string, ServerMotionSource>();
  private readonly combat = new Map<string, CombatState>();
  /** Local/offline account truth: validated client claim in, canonical room mutations/receipts out. */
  private readonly metaAccounts = new Map<string, MetaAccountV5>();
  /** Account-private move-not-copy escrow. Nothing here is synchronized at 20 Hz. */
  private readonly weaponRuns = new Map<string, RunWeaponLedger>();
  private worldTier = 0;
  private readonly disconnectedPlayers = new Map<string, DisconnectedPlayerReservation>();
  private readonly weaponSettlementReceipts = new Map<string, WeaponSettlementResult>();
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
  private vastagharVictoryMode: "" | "arena" | "bossrush" = "";
  private vastagharMoneyAwarded = false;
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
  /** Anatomy money is paid immediately; this counter conserves the fixed encounter total at core death. */
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
      /** Gun/cast tick-one collision begins at the authoritative body, before the muzzle offset. */
      firstCollisionX?: number;
      firstCollisionY?: number;
      firstStep: boolean;
      /** B3 point-blank hybrids retain their muzzle row for one patch before entering collision. */
      deferredSteps?: number;
      /** Landing-trigger ground zone; skips airborne contact and blooms when travel truth expires. */
      landingZoneDamage?: number;
      /** Enemy-to-enemy redirects left for an authored thrown ricochet. */
      ricochetHops?: number;
      ricochetRange?: number;
      /** Authoritative curved-flight state; velocity remains the straight launch basis. */
      waveform?: {
        originX: number;
        originY: number;
        elapsedSeconds: number;
        definition: ProjectileWaveformDef;
      };
      /** Outbound timer and return-leg state for true boomerang projectiles. */
      returnToOwner?: {
        outboundSeconds: number;
        returning: boolean;
      };
      /** Shared WYSIWYG body used by the B22 upright tornado rail. */
      damageEnvelope?: ProjectileDamageEnvelope;
    }
  >();
  /** §16 arena-wide HOSTILE-projectile rail. Maintained on spawn/removal/reflection so both the generic
   *  spitter path and BossController admission read the hard ceiling in O(1). Friendly shots never count. */
  private hostileProjectileCount = 0;
  /** Per-zoner puddle-drop cooldown (sec), keyed by enemy id; pruned with the enemy. */
  private readonly zonerDropCd = new Map<string, number>();
  /** Private damage/lifetime/channel truth for every synced zone row. */
  private readonly zoneMeta = new Map<string, ZoneRuntime>();
  private readonly activeGroundZones = new Map<string, string>();
  private readonly groundZoneInputWasHeld = new Map<string, boolean>();
  private readonly enemyZoneSlow = new Map<string, { multiplier: number; untilTick: number }>();
  /** §15 duelist (ronin) combo state per enemy id: phase + timer + swings left + the CURRENT windup's
   *  duration (`wind`, for the 0→1 telegraph ramp — `windup` for the first hit, `swingGap` after). Each hit
   *  now telegraphs (no standalone "swing" phase). §51 widened with the tick-anchored TOUGH-COMBO fields
   *  (see DuelistComboState). Pruned with the enemy. */
  private readonly comboState = new Map<string, DuelistComboState>();
  /** B33 ordinary melee slots: at most three non-elite attack performances may pressure one player. */
  private readonly meleeAttackTokens = new MeleeAttackTokens();
  /** Training-only live-gate fixture: consume one real player defense on the next white-pop tick. */
  private readonly debugCommitDefense = new Map<string, "roll" | "parry">();
  /** Training-only live-gate receipt: sample one real unauthored attack-movement integration tick. */
  private readonly debugAttackMoveCapture = new Set<string>();
  /** Training-only B36 held-frame heartbeat folded into the replicated authority bit. */
  private readonly debugHeldFire = new Set<string>();
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
  private readonly meleeSwings = new Map<string, ActiveMeleeSwing>();
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
    zoneDamagePerSecond?: number;
  }[] = [];
  /** Accepted scatter descriptors waiting for an authored impact epoch (Cinderchoke downswing). */
  private readonly pendingScatterVolleys: PendingScatterVolley[] = [];
  /** Accepted fan hybrids waiting for the close edge's authored impact epoch. */
  private readonly pendingHybridProjectiles: PendingHybridProjectile[] = [];
  /** Non-displacing sub-tick melee still owes B33 one authoritative 0.75-input movement tick. */
  private readonly minimumAttackInputSlowUntilTick = new Map<string, number>();
  /** Accepted authored draws waiting for their visible pre-throw revolution to complete. */
  private readonly pendingWeaponThrows: PendingWeaponThrow[] = [];
  /** §9/§13 per-DROPPED-pickup grace timer (sec): while > 0 the pickup can't be re-grabbed, so a weapon
   *  dropped at your feet doesn't snap straight back. Keyed by pickup id; only set for player drops. */
  private readonly pickupGrace = new Map<string, number>();
  /** Earned floor-weapon provenance. A chest weapon remains earned if its owner puts it down; free
   *  gallery/conjured pickups never enter this set. Pruned with the pickup and cleared with transients. */
  private readonly earnedPickups = new Set<string>();
  /** Mint/provenance/owner rail for bankable loot and exact player-owned field stakes. */
  private readonly pickupWeaponBankMeta = new Map<string, PickupWeaponBankMeta>();
  /** Server-clock hold intents make floor disassembly authoritative instead of trusting a client duration. */
  private readonly floorDisassemblyIntents = new Map<
    string,
    { pickupId: string; readyTick: number }
  >();
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
  private moneyDropSeq = 0;
  private chestRoomSeed = 0;
  private chestRunStartTick = 0;
  private chestCadence: ChestCadenceState = {
    nextSpawnTick: 0,
    lastWeaponChestTick: 0,
    sequence: 0,
  };
  /** polish #7 fixed preallocated authoritative combat receipt ring (v18). */
  private combatReceiptSeq = 0;
  private combatReceiptCursor = 0;
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
  /** Direct material links restart there; the canonical corporate-grid link starts on F1. */
  private corporateHomeDepth = 0;
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
    private declare isHost: OmitThisParameter<typeof roomProgressionMethods.isHost>;

  /** §44 dev-tool gate (Sol audit P0 #1): the debug RPCs (training toggle, boss picker, dev summon, dev
   *  equip, B-key boss) are playtest affordances that must be UNREACHABLE on a public deploy — "host" is
   *  just the first joiner, so one hostile client could otherwise flood the shared Node process with
   *  entities. ON outside production (local dev, vitest) or when DD_DEV_TOOLS=1 (a staged playtest build).
   *  Read per-call (not cached) so tests can flip the environment. */
    private declare devToolsEnabled: OmitThisParameter<typeof roomProgressionMethods.devToolsEnabled>;

  /** §44 spend one ACTION-message token for this client (attack/parry/grab/cycle/… — every gameplay RPC
   *  except "input", which has its own budget). Refilled each tick; when dry the message is IGNORED, so a
   *  modified client can't monopolize the event loop between ticks. Returns false when over budget. */
    private declare takeAction: OmitThisParameter<typeof roomProgressionMethods.takeAction>;

    private declare installCorporateFloor: OmitThisParameter<typeof roomProgressionMethods.installCorporateFloor>;

    private declare isCorporateLoop: OmitThisParameter<typeof roomProgressionMethods.isCorporateLoop>;

    override onCreate(options?: {
    dimensionId?: string;
    bossRush?: boolean;
    belt?: boolean;
    beltLevel?: string;
  }): void { return Reflect.apply(roomProgressionMethods.onCreate, this, arguments); }

  /** Reset every NON-synced per-entity collection at a run boundary (restart / training toggle) so no
   *  in-flight swing, combo, fire-cooldown, zone, pickup-grace, or burn-pulse ghost-carries into the fresh
   *  run. ONE place → adding a new transient Map forces touching this. (`inputs`/`combat` are player-
   *  lifecycle, not run transients, so they're left alone.) */
    private declare clearTransients: OmitThisParameter<typeof roomProgressionMethods.clearTransients>;

  /** §6 terminal combat teardown shared by wipes and every victory route. Pickups/player state remain for the
   *  result screen; all damage-producing bodies and their non-synced machines are retired together. */
    private declare clearCombatEntities: OmitThisParameter<typeof roomProgressionMethods.clearCombatEntities>;

  /** §6 enter a terminal result exactly once through the full combat teardown path. */
    private declare enterTerminalOutcome: OmitThisParameter<typeof roomProgressionMethods.enterTerminalOutcome>;

  /** §13 v0.106 (A11) spawn the player's currently-held weapon on the floor as a grabbable pickup in front
   *  of them, inheriting its rolled loot identity + earned provenance + a brief re-grab GRACE, then reset the
   *  hands to FISTS. No-op on fists (nothing to drop). Shared by the R-tap DROP and the grab-while-holding
   *  SWAP, so a grab can never silently DESTROY a held (possibly Legendary) weapon. */
    private declare dropHeldWeapon: OmitThisParameter<typeof roomEconomyMethods.dropHeldWeapon>;

  // ── §29 v0.118 ARSENAL helpers: the held weapon is the ACTIVE slot's live mirror; these keep the slots
  // array in sync and move weapons between hand / slots / bag. ──
  /** Copy one stored weapon into another (or clear `dst` when `src` is null). */
  /** Initialize a never-drawn stored weapon exactly once. Rebinding a ready row never grants resources. */
    private declare weaponEntryDisassemblyValue: OmitThisParameter<typeof roomEconomyMethods.weaponEntryDisassemblyValue>;

    private declare canDisassembleFloorPickup: OmitThisParameter<typeof roomEconomyMethods.canDisassembleFloorPickup>;

    private declare clearFloorPickup: OmitThisParameter<typeof roomEconomyMethods.clearFloorPickup>;

    private declare disassembleFloorPickup: OmitThisParameter<typeof roomEconomyMethods.disassembleFloorPickup>;

    private declare disassembleBagPickup: OmitThisParameter<typeof roomEconomyMethods.disassembleBagPickup>;

    private declare initializeStoredWeaponResource: OmitThisParameter<typeof roomEconomyMethods.initializeStoredWeaponResource>;

    private declare copySlot: OmitThisParameter<typeof roomEconomyMethods.copySlot>;

    private declare mintWeaponOpaqueId: OmitThisParameter<typeof roomEconomyMethods.mintWeaponOpaqueId>;

    private declare mintWeaponInstance: OmitThisParameter<typeof roomEconomyMethods.mintWeaponInstance>;

    private declare installWeaponMember: OmitThisParameter<typeof roomEconomyMethods.installWeaponMember>;

    private declare installHomeIssue: OmitThisParameter<typeof roomEconomyMethods.installHomeIssue>;

  /** Project account-private escrow into the existing three slots + dense Pack rows at a join/rejoin edge. */
    private declare materializeWeaponRun: OmitThisParameter<typeof roomEconomyMethods.materializeWeaponRun>;

    private declare createWeaponRun: OmitThisParameter<typeof roomEconomyMethods.createWeaponRun>;

  /** Slot/Pack topology is a view; this records it back onto the exact escrow entries after explicit moves. */
    private declare syncWeaponRunFromArsenal: OmitThisParameter<typeof roomEconomyMethods.syncWeaponRunFromArsenal>;

    private declare registerFoundWeaponEntry: OmitThisParameter<typeof roomEconomyMethods.registerFoundWeaponEntry>;

    private declare consumeRunWeaponEntry: OmitThisParameter<typeof roomEconomyMethods.consumeRunWeaponEntry>;

    private declare sendWeaponManifest: OmitThisParameter<typeof roomEconomyMethods.sendWeaponManifest>;

    private declare bagCapacity: OmitThisParameter<typeof roomEconomyMethods.bagCapacity>;

    private declare resetChestDirector: OmitThisParameter<typeof roomEconomyMethods.resetChestDirector>;

    private declare stepChestDirector: OmitThisParameter<typeof roomEconomyMethods.stepChestDirector>;

    private declare refreshChestOpened: OmitThisParameter<typeof roomEconomyMethods.refreshChestOpened>;

    private declare refreshAllChestOpened: OmitThisParameter<typeof roomEconomyMethods.refreshAllChestOpened>;

    private declare chestWeaponBagSlot: OmitThisParameter<typeof roomEconomyMethods.chestWeaponBagSlot>;

    private declare grantChestWeapon: OmitThisParameter<typeof roomEconomyMethods.grantChestWeapon>;

    private declare dropChestWeapon: OmitThisParameter<typeof roomEconomyMethods.dropChestWeapon>;

    private declare maybeDropEnemyWeapon: OmitThisParameter<typeof roomEconomyMethods.maybeDropEnemyWeapon>;

    private declare grantCommonRelic: OmitThisParameter<typeof roomEconomyMethods.grantCommonRelic>;

    private declare grantRareRelic: OmitThisParameter<typeof roomEconomyMethods.grantRareRelic>;

    private declare openChestForPlayer: OmitThisParameter<typeof roomEconomyMethods.openChestForPlayer>;

  /** Persist only the active weapon instance's cadence debt before identity changes. */
    private declare saveWeaponResource: OmitThisParameter<typeof roomEconomyMethods.saveWeaponResource>;

  /** Restore a weapon's own debt. Only a genuinely new pickup may initialize a fresh resource row. */
    private declare restoreWeaponResource: OmitThisParameter<typeof roomEconomyMethods.restoreWeaponResource>;

    private declare transitionWeapon: OmitThisParameter<typeof roomEconomyMethods.transitionWeapon>;

  /** Frostbore's two-shell exception reuses the retained private reload/resource row. The row advances on
   * the fixed simulation clock and mirrors only its two public counters for deterministic remote posing. */
    private declare stepHeldBreakActionReload: OmitThisParameter<typeof roomEconomyMethods.stepHeldBreakActionReload>;

  /** Stowed debts progress normally; swapping changes identity, never the passage of time. */
    private declare stepStowedWeaponResources: OmitThisParameter<typeof roomEconomyMethods.stepStowedWeaponResources>;

    private declare stepStoredSlot: OmitThisParameter<typeof roomEconomyMethods.stepStoredSlot>;

  /** Write the live held weapon (+ loot identity + earned provenance) INTO the active slot, so the slots
   *  array reflects reality before a swap/grab/stash reads it. FISTS → an empty slot. */
    private declare syncActiveSlot: OmitThisParameter<typeof roomEconomyMethods.syncActiveSlot>;

  /** Load slot `i` into the player's hands (sets it active + mirrors held weapon/loot/provenance). An empty
   *  slot loads FISTS. */
    private declare loadSlot: OmitThisParameter<typeof roomEconomyMethods.loadSlot>;

  /** §29 BELT grab: ADD the grabbed weapon to the arsenal instead of the arena swap-drop. Fills the first
   *  empty slot (and equips it); if all 3 are full, the current active weapon overflows to the bag (or drops
   *  to the floor when the bag is full too — still never destroyed) and the grab takes the active slot. */
    private declare grabIntoArsenal: OmitThisParameter<typeof roomEconomyMethods.grabIntoArsenal>;

  /** Stat-free held damage multiplier. Authored source damage is modified only by the held weapon's
   * non-stat factors: loot identity, weapon-set bonus, and runtime effects. */
    private declare heldDamageMult: OmitThisParameter<typeof roomEconomyMethods.heldDamageMult>;

  /** One audited recovery seam for held, cast, gun, thrown, beam, and stored cooldown debt. */
    private declare weaponRecoveryMult: OmitThisParameter<typeof roomEconomyMethods.weaponRecoveryMult>;

    private declare heldCastDamageMult: OmitThisParameter<typeof roomEconomyMethods.heldCastDamageMult>;

  /** Capture the cosmetic character as flavor-only run identity. */
    private declare snapshotRunCharacter: OmitThisParameter<typeof roomEconomyMethods.snapshotRunCharacter>;

  /** Install one validated, catalog-derived wardrobe snapshot without applying numeric stats. */
    private declare snapshotGearRun: OmitThisParameter<typeof roomEconomyMethods.snapshotGearRun>;

  /** Gear owns identity when present; character kits remain the compatibility fallback until the art wave. */
    private declare snapshotRunIdentity: OmitThisParameter<typeof roomEconomyMethods.snapshotRunIdentity>;

  /** Interpret pure quirk descriptors at event seams through existing authoritative state machinery. */
    private declare applyQuirkEffects: OmitThisParameter<typeof roomEconomyMethods.applyQuirkEffects>;

    private declare applyParryQuirk: OmitThisParameter<typeof roomEconomyMethods.applyParryQuirk>;

    private declare applyKillQuirk: OmitThisParameter<typeof roomEconomyMethods.applyKillQuirk>;

  /** §30 the player's equipped loadout as weapon ids — the active slot reads the LIVE held weapon (slots are
   *  only re-synced on swap), the others their stored weapon. Drives the class set-bonus count. */
    private declare loadoutIds: OmitThisParameter<typeof roomEconomyMethods.loadoutIds>;

  /** §6 count of LIVING players — what the TRASH horde difficulty scales on, so a mostly-downed squad faces
   *  a beatable horde and rezzes stay achievable (the rez-or-dead death-spiral fix). The boss keeps the
   *  full-squad `players.size` high-water-mark (a capstone shouldn't soften because allies are down). */
    private declare livingCount: OmitThisParameter<typeof roomEconomyMethods.livingCount>;

    private declare ownerClient: OmitThisParameter<typeof roomEconomyMethods.ownerClient>;

    private declare sendOwnerMessage: OmitThisParameter<typeof roomEconomyMethods.sendOwnerMessage>;

  /** Copper Gecko's wider reach is intentionally private: only its owner receives the earned-id rail that
   *  lets P2 render an honest local prompt. This runs only when that rare set changes, never per tick. */
    private declare publishPetPickupEligibility: OmitThisParameter<typeof roomEconomyMethods.publishPetPickupEligibility>;

    private declare bumpAccountRevision: OmitThisParameter<typeof roomEconomyMethods.bumpAccountRevision>;

  /** New run/ready boundary: only the pet identity and presentation band enter public run state. */
    private declare snapshotPetRun: OmitThisParameter<typeof roomEconomyMethods.snapshotPetRun>;

    private declare resetPetAccrual: OmitThisParameter<typeof roomEconomyMethods.resetPetAccrual>;

  /** Allocation-free 20 Hz qualification clock; training/debug rooms never build Bond eligibility. */
    private declare advancePetPresence: OmitThisParameter<typeof roomEconomyMethods.advancePetPresence>;

  /** Count only a server-accepted combat/support result, never a message, movement tick, dummy, or training. */
    private declare recordPetAcceptedAction: OmitThisParameter<typeof roomEconomyMethods.recordPetAcceptedAction>;

  /** Evaluate each authored dimension/boss epoch once. Failed presence/action qualification cannot pay later. */
    private declare awardPetDimensionClear: OmitThisParameter<typeof roomEconomyMethods.awardPetDimensionClear>;

    private declare beginNextPetDimension: OmitThisParameter<typeof roomEconomyMethods.beginNextPetDimension>;

    private declare rollSlateTortoise: OmitThisParameter<typeof roomEconomyMethods.rollSlateTortoise>;

  /** One idempotent account commit for pets, money, and exact weapon escrow on every terminal route. */
    private declare settleMetaAccounts: OmitThisParameter<typeof roomEconomyMethods.settleMetaAccounts>;

  /** Explicit event/intermission heal; passive regen, revive HP, meta headroom and Hearth's own 15% use
   * their dedicated paths. The receiver's selected pet owns the multiplier. */
    private declare applyHeal: OmitThisParameter<typeof roomEconomyMethods.applyHeal>;

  /** Switch between survival ("arena") and Testing Grounds ("training", §21). */
    private declare toggleTraining: OmitThisParameter<typeof roomProgressionMethods.toggleTraining>;

  /** The dev workshop is an explicit abandon, followed by an empty non-bank training reservation. */
    private declare forfeitWeaponRunForWorkshop: OmitThisParameter<typeof roomProgressionMethods.forfeitWeaponRunForWorkshop>;

  /** §31 full browsable ACTIVE roster. Archived ids remain canonical but have no showroom page. */
  /** §41 the showroom roster, ORGANIZED: class → family → name, so every page reads as a coherent shelf
   *  ("all the melee axes together") instead of concept-file order. Stable + deterministic. */
    private static readonly GALLERY_ROSTER = GAME_ROOM_STATICS.GALLERY_ROSTER;
    private static readonly GALLERY_PAGE = GAME_ROOM_STATICS.GALLERY_PAGE; // weapons per page (14×3 grid) — comfortably performant
  private galleryPage = 0;

  /** §31 (re)spawn the current showroom PAGE: clear the gallery pickups (`pk*`) and lay out this page's
   *  slice of GALLERY_ROSTER in a grid above the player. Wraps the page index. Training mode only.
   *  §41 cells keep their EXACT grid position — a cell over a pit/POI is SKIPPED (the shelf shows a gap)
   *  instead of safeSpawnPos NUDGING it: the old nudge scattered the neat grid and piled pickups onto their
   *  neighbours, so E grabbed "the wrong thing" and pages read as disorganized. */
    private declare spawnGalleryPage: OmitThisParameter<typeof roomProgressionMethods.spawnGalleryPage>;

    private declare restartRun: OmitThisParameter<typeof roomProgressionMethods.restartRun>;

  /** Delete enemies within `radius` of a point (respawn breathing room). Never clears the boss —
   *  it must be defeated, not despawned by a nearby respawn (§16). */
    private declare clearEnemiesNear: OmitThisParameter<typeof roomEnemyMethods.clearEnemiesNear>;

  /** §45 rebuild the ONE enemy broad phase for this fixed tick. Later movement uses `update`, not a rebuild. */
    private declare rebuildEnemyGrid: OmitThisParameter<typeof roomEnemyMethods.rebuildEnemyGrid>;

    private declare insertEnemyGrid: OmitThisParameter<typeof roomEnemyMethods.insertEnemyGrid>;

    private declare updateEnemyGrid: OmitThisParameter<typeof roomEnemyMethods.updateEnemyGrid>;

    private declare rebuildWormSegmentGrid: OmitThisParameter<typeof roomEnemyMethods.rebuildWormSegmentGrid>;

    private declare effectiveEnemyBodies: OmitThisParameter<typeof roomEnemyMethods.effectiveEnemyBodies>;

  /** §5/§45 horde body collision. Each unordered grid pair contributes a radius-overlap correction into
   * fixed tick-local buffers; one capped integration prevents pair-order shoves and enemy stacks without
   * an O(n²) scan. Boss/dummy bodies are anchors (ordinary enemies move one-way around them); the worm's
   * compatibility root/segments never enter this grid. Player push-out remains the existing one-way law. */
    private declare resolveEnemyCollisions: OmitThisParameter<typeof roomEnemyMethods.resolveEnemyCollisions>;

    override onJoin(
    client: Client,
    options?: {
      scrip?: number;
      up?: unknown;
      metaAccount?: unknown;
      carry?: CarrySelectionV1;
      selectedCharacterId?: unknown;
      selectedPetId?: unknown;
      petId?: unknown;
    },
  ): void { return Reflect.apply(roomProgressionMethods.onJoin, this, arguments); }

    override onLeave(client: Client): void { return Reflect.apply(roomProgressionMethods.onLeave, this, arguments); }

  /** Explicit encounter/modal hook. Auto remains the default; callers never write Drive or regenMode. */
    declare setWeaponResourceRegenOverride: OmitThisParameter<typeof roomCombatMethods.setWeaponResourceRegenOverride>;

    private declare drivePendingValue: OmitThisParameter<typeof roomCombatMethods.drivePendingValue>;

    private declare markWeaponResourcePressure: OmitThisParameter<typeof roomCombatMethods.markWeaponResourcePressure>;

  /** Cover-agnostic pressure evidence. Dummy rows are training fixtures, not living hostiles. */
    private declare hostileWithinDriveThreat: OmitThisParameter<typeof roomCombatMethods.hostileWithinDriveThreat>;

  /** Preserve the old discrete lock+cool tick count for approved beam-only vent/lock modifiers. */
    private declare beamEmptyRecoveryTicks: OmitThisParameter<typeof roomCombatMethods.beamEmptyRecoveryTicks>;

  /** Compute one fixed-step credit before any fire path. Recovery debt is sampled before it ages. */
    private declare beginWeaponResourceTick: OmitThisParameter<typeof roomCombatMethods.beginWeaponResourceTick>;

  /** Commit once after all same-tick fire paths, then floor the public hundredths mirror. */
    private declare commitWeaponResourceTick: OmitThisParameter<typeof roomCombatMethods.commitWeaponResourceTick>;

  /** Credits are a separate authority seam and cannot clear release or minimum-lock gates. */
    private declare creditWeaponResource: OmitThisParameter<typeof roomCombatMethods.creditWeaponResource>;

  /**
   * The one weapon spend seam. It resolves canonical formula data and live cadence; callers never supply a
   * price. The reused result row avoids a per-action allocation in the fixed 20 Hz loop.
   */
    private declare trySpendWeaponResource: OmitThisParameter<typeof roomCombatMethods.trySpendWeaponResource>;

  /** Direct-contact slide predicate. Separate from parry `invuln`; ticks 1..5 are the inherited budget. */
    private declare slideInvulnerable: OmitThisParameter<typeof roomCombatMethods.slideInvulnerable>;

    private declare noteSlideDodge: OmitThisParameter<typeof roomCombatMethods.noteSlideDodge>;

  /** One authoritative player-damage seam. Bulwark spends its successful-parry shield before HP. */
    private declare damagePlayer: OmitThisParameter<typeof roomCombatMethods.damagePlayer>;

  /** Training gate only: execute one already-armed real defense on the authoritative white-pop tick. */
    private declare consumeDebugCommitDefense: OmitThisParameter<typeof roomCombatMethods.consumeDebugCommitDefense>;

  /** Consume the two jump-feel command bits on their exact acknowledged input tick. */
    private declare consumeMoveStanceInput: OmitThisParameter<typeof roomMovementMethods.consumeMoveStanceInput>;

    private declare setMoveStance: OmitThisParameter<typeof roomMovementMethods.setMoveStance>;

    private declare syncSlideWire: OmitThisParameter<typeof roomMovementMethods.syncSlideWire>;

  /** Forced cancels alone bump stanceSeq; organic abort/launch/landing edges only change moveStance. */
    private declare cancelMoveStance: OmitThisParameter<typeof roomMovementMethods.cancelMoveStance>;

  /** Swept environment half of B42's envelope. The numeric budget is shared; only the room owns map truth. */
    private declare clientMovementNavValid: OmitThisParameter<typeof roomMovementMethods.clientMovementNavValid>;

  /** Begin or extend an authored server-displacement window. Epoch advances only on a new ownership edge. */
    private declare beginServerMotion: OmitThisParameter<typeof roomMovementMethods.beginServerMotion>;

  /** Register placement ownership before mutating any synchronized position fields. */
    private declare placeWithMotionEpoch: OmitThisParameter<typeof roomMovementMethods.placeWithMotionEpoch>;

  /** Recompute the wire flag before consuming this tick's client report. */
    private declare refreshServerMotionState: OmitThisParameter<typeof roomMovementMethods.refreshServerMotionState>;

    private declare freshInputState: OmitThisParameter<typeof roomMovementMethods.freshInputState>;

  /** End the fixed roll after its eighth integrated sample; cooldown begins on this authored edge. */
    private declare stepSlideStance: OmitThisParameter<typeof roomMovementMethods.stepSlideStance>;

    private declare damagePitFall: OmitThisParameter<typeof roomMovementMethods.damagePitFall>;

  /** Traversal acceptance runs before horizontal integration/pit sampling. Space consumes directly into
   *  the authored distance jump; there is no ordinary-hop or crouch/charge intermediate sentence. */
    private declare stepTraversalLaunches: OmitThisParameter<typeof roomMovementMethods.stepTraversalLaunches>;

    private declare launchDistanceJump: OmitThisParameter<typeof roomMovementMethods.launchDistanceJump>;

  /** Bend toward held WASD at <=45°/s and never farther than ±27° from the launch heading. */
    private declare steerDistanceJump: OmitThisParameter<typeof roomMovementMethods.steerDistanceJump>;

    private declare finishPlayerLanding: OmitThisParameter<typeof roomMovementMethods.finishPlayerLanding>;

    private declare applyPoundImpact: OmitThisParameter<typeof roomCombatMethods.applyPoundImpact>;

    private declare enemyCommittedAttack: OmitThisParameter<typeof roomCombatMethods.enemyCommittedAttack>;

  /** Decaying 260px/s shove totals <40px and refuses the one step that would cross a ground→pit edge. */
    private declare stepPoundEnemyEffects: OmitThisParameter<typeof roomCombatMethods.stepPoundEnemyEffects>;

  /** Write into the fixed v18 ring. Every field comes from the accepted source epoch, never proximity. */
    private declare writeCombatReceipt: OmitThisParameter<typeof roomCombatMethods.writeCombatReceipt>;

  /** Advance the precise, non-serialized run clock and patch only when its whole-second projection changes. */
    private declare advanceElapsed: OmitThisParameter<typeof roomProgressionMethods.advanceElapsed>;

    private declare resetElapsed: OmitThisParameter<typeof roomProgressionMethods.resetElapsed>;

  /** §4 v0.107 defense-in-depth (review #4): WITHOUT this, Colyseus does not wrap the simulation-interval
   *  or message handlers in try/catch — a single uncaught throw (e.g. a hostile payload reaching a schema
   *  setter) escapes the timer and kills the whole Node process (every room, every player). With it, the
   *  error degrades to a log line. Input validation is still the first line — this is the seatbelt. */
    override onUncaughtException(error: Error, methodName: string): void { return Reflect.apply(roomProgressionMethods.onUncaughtException, this, arguments); }

  /** §4 v0.107 FIXED-TIMESTEP accumulator (review #1). Colyseus's simulation interval reports REAL elapsed
   *  wall-clock time (50-55ms+ of jitter under load) — but client-side prediction replays exact 50ms steps,
   *  so the sim must integrate in exact 50ms sub-steps too or the two can never agree. Accumulate the real
   *  delta, run whole TICK_MS sub-steps, broadcast once after the batch. Capped at 3 sub-steps + remainder
   *  per invocation (a longer stall is absorbed as brief slow-mo — same posture as the old 2.5-tick clamp),
   *  and a stall's backlog CATCHES UP over following invocations instead of stretching dt. */
  private simAccMs = 0;
    private declare update: OmitThisParameter<typeof roomProgressionMethods.update>;

  /** One EXACT 50ms authoritative sub-step. The hand-numbered phase order is a CONTRACT (golden test). */
    private declare stepSim: OmitThisParameter<typeof roomProgressionMethods.stepSim>;

    private declare ultimateOwnsMovement: OmitThisParameter<typeof roomCombatMethods.ultimateOwnsMovement>;

    private declare nearestDoorDecoy: OmitThisParameter<typeof roomCombatMethods.nearestDoorDecoy>;

  /** One postcondition for every blink/hop/dash endpoint: range, bounds, POI/deck, pit, gate. */
    private declare navValidDest: OmitThisParameter<typeof roomMovementMethods.navValidDest>;

    private declare ultimateTargetPosition: OmitThisParameter<typeof roomCombatMethods.ultimateTargetPosition>;

  /** SpatialGrid selection is nearest-first, exact-radius, immutable, and protocol-capped at five. */
    private declare selectAlphaTargets: OmitThisParameter<typeof roomCombatMethods.selectAlphaTargets>;

    private declare acceptUltimate: OmitThisParameter<typeof roomCombatMethods.acceptUltimate>;

    private declare tryDimensionDoorReturn: OmitThisParameter<typeof roomCombatMethods.tryDimensionDoorReturn>;

    private declare beginUltimate: OmitThisParameter<typeof roomCombatMethods.beginUltimate>;

    private declare ultimateScale: OmitThisParameter<typeof roomCombatMethods.ultimateScale>;

  /** L1's additive seam now consumes the run-scoped L2 crit line. */
    private declare critAdditiveModifiers: OmitThisParameter<typeof roomCombatMethods.critAdditiveModifiers>;

    private declare flatCritChance: OmitThisParameter<typeof roomCombatMethods.flatCritChance>;

    private declare weaponCritChance: OmitThisParameter<typeof roomCombatMethods.weaponCritChance>;

    private declare launchSunspiteComet: OmitThisParameter<typeof roomCombatMethods.launchSunspiteComet>;

    private declare stepSeismarch: OmitThisParameter<typeof roomCombatMethods.stepSeismarch>;

    private declare resolveSeismarchImpact: OmitThisParameter<typeof roomCombatMethods.resolveSeismarchImpact>;

    private declare applyUltimateStun: OmitThisParameter<typeof roomCombatMethods.applyUltimateStun>;

    private declare stepEventHorizon: OmitThisParameter<typeof roomCombatMethods.stepEventHorizon>;

    private declare damageEventHorizonSweep: OmitThisParameter<typeof roomCombatMethods.damageEventHorizonSweep>;

    private declare stepAlphaStrike: OmitThisParameter<typeof roomCombatMethods.stepAlphaStrike>;

    private declare cancelUltimate: OmitThisParameter<typeof roomCombatMethods.cancelUltimate>;

    private declare stepUltimateWorldEffects: OmitThisParameter<typeof roomCombatMethods.stepUltimateWorldEffects>;

    private declare stepUltimates: OmitThisParameter<typeof roomCombatMethods.stepUltimates>;

  /** Publish one authoritative player-attack acceptance edge. Damage/cooldown behavior remains elsewhere. */
    private declare stampAttackBeat: OmitThisParameter<typeof roomCombatMethods.stampAttackBeat>;

  /** Prospective solo combo beat for generated katana hooks, using the presentation chain law. */
    private declare nextSoloMeleeBeat: OmitThisParameter<typeof roomCombatMethods.nextSoloMeleeBeat>;

    private declare recordSoloMeleeBeat: OmitThisParameter<typeof roomCombatMethods.recordSoloMeleeBeat>;

  /** Fire one weapon swing (§20 WYSIWYG). The EDGE is registered as a SWEPT BLADE (`stepMeleeSwings` sweeps
   *  it across `swingArc` and damages each enemy the blade actually crosses — #2/#5/#6); the secondary
   *  LAYERS (chain / quake / scatter) fire here at the swing moment, each an independent position-based
   *  source ("layered like the Wyrmtooth"). Each layer uses its authored flat damage. */
  /** Resolve one accepted attack for the single weapon equipped in the active slot. */
    private declare resolveSingleWeaponAttack: OmitThisParameter<typeof roomCombatMethods.resolveSingleWeaponAttack>;

    private declare resolveSwing: OmitThisParameter<typeof roomCombatMethods.resolveSwing>;

  /** §6 try to revive the nearest DOWNED ally within `radius` of the rezzer (the swing's rez effect). The
   *  ally comes back at `REVIVE_HP_FRAC` of max HP, WHERE THEY FELL, with the spawn pile cleared so they
   *  don't instantly re-down; `revivedSeq` bumps the client's revive VFX. One rez per swing. */
    private declare tryRez: OmitThisParameter<typeof roomCombatMethods.tryRez>;

  /** §20/§44 advance accepted descriptor time, sweeping only while the unchanged pose envelope is dangerous.
   *  A tick may cross wind-up, the whole fast active interval, or recovery; clamped progress preserves full
   *  arc supersampling and hit-once coverage in every case. The live player position still anchors the edge. */
  /** Input held-state with the three-tick disconnect/stall watchdog applied. */
    private declare beamHeld: OmitThisParameter<typeof roomCombatMethods.beamHeld>;

  /** Hold starts one immutable server clock; release snapshots the curve into one real projectile. */
    private declare stepPlayerChargedProjectile: OmitThisParameter<typeof roomCombatMethods.stepPlayerChargedProjectile>;

    private declare fireChargedProjectile: OmitThisParameter<typeof roomCombatMethods.fireChargedProjectile>;

  /** Server-authoritative character-centered aura. Drive pays the authored net drain every fixed step;
   * damage receives only the funded fraction of the final step and the channel release-locks at empty. */
    private declare stepPlayerAura: OmitThisParameter<typeof roomCombatMethods.stepPlayerAura>;

    private declare navValidMotionDest: OmitThisParameter<typeof roomCombatMethods.navValidMotionDest>;

    private declare playerAttackMoveMode: OmitThisParameter<typeof roomCombatMethods.playerAttackMoveMode>;

    private declare zoneTarget: OmitThisParameter<typeof roomCombatMethods.zoneTarget>;

  /** Hold-to-grow authority. One ZoneState row changes only its radius; input remains the normal heartbeat. */
    private declare stepPlayerGroundZone: OmitThisParameter<typeof roomCombatMethods.stepPlayerGroundZone>;

  /** Charge → authoritative ignition → sustained swept damage → recovery/overheat. */
    private declare clearBeamRows: OmitThisParameter<typeof roomCombatMethods.clearBeamRows>;

    private declare beamSatelliteCount: OmitThisParameter<typeof roomCombatMethods.beamSatelliteCount>;

    private declare stepPlayerBeam: OmitThisParameter<typeof roomCombatMethods.stepPlayerBeam>;

    private declare stepActiveBeam: OmitThisParameter<typeof roomCombatMethods.stepActiveBeam>;

    private declare finishBeam: OmitThisParameter<typeof roomCombatMethods.finishBeam>;

  /** Hard cancellation for swaps/death/teleports/parry. Early/escape cancels pay the 20-heat commitment. */
    private declare cancelBeam: OmitThisParameter<typeof roomCombatMethods.cancelBeam>;

    private declare syncRestingBeamRow: OmitThisParameter<typeof roomCombatMethods.syncRestingBeamRow>;

    private declare syncBeamRow: OmitThisParameter<typeof roomCombatMethods.syncBeamRow>;

  /** Weapon-rooted beam origin. Every authoritative consumer calls this exact seam each fixed tick. */
    private declare writeBeamMuzzle: OmitThisParameter<typeof roomCombatMethods.writeBeamMuzzle>;

  /** Exact ray truncation against arena edges and colliding POI/belt circles. */
    private declare clipBeamLength: OmitThisParameter<typeof roomCombatMethods.clipBeamLength>;

    private declare rayCircleLength: OmitThisParameter<typeof roomCombatMethods.rayCircleLength>;

  /** One broad-phase query for the complete previous→current swept capsule union. */
    private declare damageBeamSweep: OmitThisParameter<typeof roomCombatMethods.damageBeamSweep>;

    private declare flushBeamDamage: OmitThisParameter<typeof roomCombatMethods.flushBeamDamage>;

  /** Resolve one authored rapid-thrust pulse at its exact shared pose epoch. Each pulse starts with a fresh
   * hit ledger, so a target held on the visible pike line receives one distinct authoritative contact. */
    private declare applyRapidThrustHit: OmitThisParameter<typeof roomCombatMethods.applyRapidThrustHit>;

    private declare stepMeleeSwings: OmitThisParameter<typeof roomCombatMethods.stepMeleeSwings>;

  /** End every threat before the first celebration patch; player clocks/position remain untouched. */
    private declare beginVastagharClear: OmitThisParameter<typeof roomProgressionMethods.beginVastagharClear>;

  /** Advance the authoritative collapse, then open the ordinary reward route without minting boss loot. */
    private declare stepVastagharVictory: OmitThisParameter<typeof roomProgressionMethods.stepVastagharVictory>;

  /** B20 L2: preserve the collapse beat but retire the old boss-money itemization channel. */
    private declare completeVastagharVictoryPresentation: OmitThisParameter<typeof roomProgressionMethods.completeVastagharVictoryPresentation>;

    private declare completeVastagharClear: OmitThisParameter<typeof roomProgressionMethods.completeVastagharClear>;

  /** Credit a collected drop through the per-player run-money rail. */
    private declare awardMoney: OmitThisParameter<typeof roomEconomyMethods.awardMoney>;

    private declare moneyDropReach: OmitThisParameter<typeof roomEconomyMethods.moneyDropReach>;

    private declare nearestMoneyCollector: OmitThisParameter<typeof roomEconomyMethods.nearestMoneyCollector>;

  /** Convert one chest money roll into a bounded collectible row. Overflow merges; value is conserved. */
    private declare dropMoney: OmitThisParameter<typeof roomEconomyMethods.dropMoney>;

    private declare stepMoneyDrops: OmitThisParameter<typeof roomEconomyMethods.stepMoneyDrops>;

    private declare drainMoneyDrops: OmitThisParameter<typeof roomEconomyMethods.drainMoneyDrops>;

  /** Committed transitions conserve every uncollected money row before teardown. */
    private declare completeRewardBoundary: OmitThisParameter<typeof roomProgressionMethods.completeRewardBoundary>;
    private declare completeExtraction: OmitThisParameter<typeof roomProgressionMethods.completeExtraction>;

    private declare completeBossRushVictory: OmitThisParameter<typeof roomProgressionMethods.completeBossRushVictory>;

  /** §16 v0.109 run the active boss's data-driven controller (replaces the hardcoded OLD RUST machine). It
   *  owns the boss's movement + phase escalation + telegraphed attacks; the GameRoom only wires the emit
   *  sink (projectiles/AoE/zones/adds/telegraphs) so hit + damage plumbing stays here. When the boss is
   *  gone (killed/removed), tears down: null the controller, clear its telegraphs, blank the synced label. */
    private declare stepBoss: OmitThisParameter<typeof roomEnemyMethods.stepBoss>;

  /** Tear down the active boss: dispose the controller (removes its in-flight telegraphs), reset the synced
   *  boss fields. Called when the boss dies/vanishes or the run restarts. */
    private declare clearBoss: OmitThisParameter<typeof roomEnemyMethods.clearBoss>;

  /** §16 v0.109 the emit surface handed to the BossController — turns a boss def's abstract "casts" into real
   *  sim: hostile projectiles, telegraph rows, corrosive zones, adds, and unparryable AoE. Built once, lazily. */
    private declare readonly bossSink: typeof roomEnemyMethods.bossSink;

  /** §16/§15 v0.113 create a synced telegraph row (used by boss casts AND enemy leaps). Returns its id. */
    private declare addTelegraphRow: OmitThisParameter<typeof roomEnemyMethods.addTelegraphRow>;

  /** Set a telegraph row's fill progress 0→1. */
    private declare setTelegraphRowProgress: OmitThisParameter<typeof roomEnemyMethods.setTelegraphRowProgress>;

  /** Remove a telegraph row (the client edge-fires its impact VFX if it had filled). */
    private declare removeTelegraphRow: OmitThisParameter<typeof roomEnemyMethods.removeTelegraphRow>;

  /** §16 an unparryable radius AoE (the generalised punch-slam): flat damage + a hard radial knockback to
   *  every living player inside. `damage` arrives already depth-scaled from the controller. */
    private declare applyBossAoE: OmitThisParameter<typeof roomEnemyMethods.applyBossAoE>;

  /** §33 FOOTFALL QUAKE resolve: a ground shockwave you JUMP over or PARRY. Grounded, un-parried players in
   *  the radius take it + a radial shove; AIRBORNE players (mid-jump) clear it; a player in a parry/i-frame
   *  window NEGATES it (white flash — the timing reward). This is the colossus's whole rhythm. */
    private declare applyBossQuake: OmitThisParameter<typeof roomEnemyMethods.applyBossQuake>;

  /** One-foot-one-epoch flagship quake. Only authoritative jump/parry answers buy Stride/punish credit. */
    private declare applyVastagharQuake: OmitThisParameter<typeof roomEnemyMethods.applyVastagharQuake>;

  /** Swept-angular truth with a per-player/per-revolution receipt. A two-turn Worldwheel can hit twice. */
    private declare applyVastagharSweep: OmitThisParameter<typeof roomEnemyMethods.applyVastagharSweep>;

    private declare vastagharParryActive: OmitThisParameter<typeof roomEnemyMethods.vastagharParryActive>;

  /** Same personal chain/cooldown/heal/augment ledger as melee parry, without moving the 230px titan root. */
    private declare resolveVastagharParry: OmitThisParameter<typeof roomEnemyMethods.resolveVastagharParry>;

  /** POI identity stays at its deterministic seed index; moving the server copy off-map removes collision
   * on the exact synchronized mutation edge while the client consumes `destroyedPoiMask`. */
    private declare mutateVastagharArena: OmitThisParameter<typeof roomEnemyMethods.mutateVastagharArena>;

  /** §16 v0.109 Slice 2 — damage every living player inside an oriented rect (a beam / dash lane). `damage`
   *  is ALREADY the per-tick depth-scaled amount. `knockback` (dash) shoves them PERPENDICULAR out of the lane. */
    private declare damageBeamRect: OmitThisParameter<typeof roomEnemyMethods.damageBeamRect>;

  /** §16 v0.109 Slice 2 — damage every living player in an expanding ring's danger band (outside the safe
   *  gap wedge). `damage` is the per-tick depth-scaled amount. */
    private declare damageRingBand: OmitThisParameter<typeof roomEnemyMethods.damageRingBand>;

  /** §16 drop a corrosive DoT puddle (reuses ZoneState + the zoner DoT machinery) at a boss-authored spot. */
    private declare spawnWeaponGroundZoneAt: OmitThisParameter<typeof roomEnemyMethods.spawnWeaponGroundZoneAt>;

    private declare dropBossZone: OmitThisParameter<typeof roomEnemyMethods.dropBossZone>;

  /** §16 conjure one boss ADD at a telegraphed spot (HP scaled to living count × depth), tracked so the
   *  add-cap counts only boss-summoned adds. Lands on solid ground clear of POIs. */
    private declare spawnBossAddAt: OmitThisParameter<typeof roomEnemyMethods.spawnBossAddAt>;

  /** Hard encounter budget: seven-second add life, and no residual add pressure during the solo rez beat. */
    private declare stepVastagharAddBudget: OmitThisParameter<typeof roomEnemyMethods.stepVastagharAddBudget>;

  /** Spitters fire a projectile at the nearest living player on a cooldown (§15 ranged threat). */
    private declare stepSpitters: OmitThisParameter<typeof roomEnemyMethods.stepSpitters>;

    private declare fireProjectile: OmitThisParameter<typeof roomCombatMethods.fireProjectile>;

  /** §16 remove one live projectile while keeping the O(1) hostile admission count exact. */
    private declare removeProjectile: OmitThisParameter<typeof roomCombatMethods.removeProjectile>;

  /** §9/§15 fire a GUN — spend one ammo to launch `pellets` friendly bullets down-barrel (a cone for
   *  shotguns / a touch of inaccuracy for autos), each WYSIWYG-scaled, piercing/bouncing/exploding per
   *  the gun's block. Ammo + reload are handled by the caller (mirrors the thrown charge model). */
  /** §37 the PRECISE firing direction: from the shooter's AUTHORITATIVE body toward the CURSOR WORLD POINT the
   *  client sent (targetX/Y), not the client's rig-derived aim VECTOR. The predicted/interpolated rig can lead
   *  the real body while moving, so a direction-only aim skews slightly off the cursor; aiming at the sent
   *  point lands the shot ON the cursor. Falls back to the aim vector if no target was sent. Unit vector. */
    private declare aimDir: OmitThisParameter<typeof roomCombatMethods.aimDir>;

    private declare armGunBurst: OmitThisParameter<typeof roomCombatMethods.armGunBurst>;

    private declare clearGunBurst: OmitThisParameter<typeof roomCombatMethods.clearGunBurst>;

  /** Emit follow-up rounds from an accepted trigger; they need no second input or Drive spend. */
    private declare stepGunBurst: OmitThisParameter<typeof roomCombatMethods.stepGunBurst>;

  /** Cogwright's Tesla-Rod: the cursor is intent only. The server resolves the full-distance endpoint through
   * the same bounds/POI/pit/deck validator as every other teleport, writes position itself, and bumps the
   * movement hard-resync edge before applying the small arrival burst. */
    private declare detonateWarpAtCursor: OmitThisParameter<typeof roomCombatMethods.detonateWarpAtCursor>;

    private declare fireGun: OmitThisParameter<typeof roomCombatMethods.fireGun>;

  /** §38 CASTER fire — conjure one piercing arcane BOLT down aim (no ammo). Distinct from a gun
   *  (no magazine/spread; pierces the whole line) and from melee (ranged). Spawns from the same muzzle reach. */
  /** Gun-contact version of the existing Venomtongue chain idiom. The projectile hit is the seed and is
   * excluded from the extra links; every hop is selected and damaged on the server. */
    private declare applyProjectileChain: OmitThisParameter<typeof roomCombatMethods.applyProjectileChain>;

    private declare fireCast: OmitThisParameter<typeof roomCombatMethods.fireCast>;

  /** Hurl a thrown weapon at the player's aim — a friendly, piercing projectile (§10). */
    private declare throwWeapon: OmitThisParameter<typeof roomCombatMethods.throwWeapon>;

  /** §14 scatter shot — fling `count` REAL magma projectiles in a cone toward aim. Each is a WYSIWYG
   *  damage source with flat authored direct-hit and explosion damage. */
  /** Redirect one spent thrown impact toward the nearest fresh enemy. Selection is server-owned and uses
   * the same greedy nearest-target primitive as chain lightning. */
    private declare emitWeaponThrow: OmitThisParameter<typeof roomCombatMethods.emitWeaponThrow>;

    private declare redirectThrownRicochet: OmitThisParameter<typeof roomCombatMethods.redirectThrownRicochet>;

    private declare fireScatter: OmitThisParameter<typeof roomCombatMethods.fireScatter>;

    private declare emitScatterVolley: OmitThisParameter<typeof roomCombatMethods.emitScatterVolley>;

  /** Emit one B3 fan payload from the actual painted leading edge. The close swept edge has already
   * advanced through this impact epoch; these rows then travel and collide through the shared authority rail. */
    private declare emitHybridProjectile: OmitThisParameter<typeof roomCombatMethods.emitHybridProjectile>;

    private declare damageWormSlots: OmitThisParameter<typeof roomCombatMethods.damageWormSlots>;

    private declare collectWormRadiusHits: OmitThisParameter<typeof roomCombatMethods.collectWormRadiusHits>;

  /** Apply `raw` damage, then perform shared kill, money, and portal bookkeeping. */
    private declare damageEnemy: OmitThisParameter<typeof roomCombatMethods.damageEnemy>;

  /** §7 v0.105 zero a player's persistent steering velocity — call at every position TELEPORT (pit
   *  snap-back, rift descent, restart, training reposition, revive) so carried momentum can't glide the
   *  body away from where it was authoritatively placed. §4 v0.107: also DROPS the queued/held input
   *  direction (a teleport must not replay stale pre-teleport intent; the next command lands ≤50ms later),
   *  mirrors zero velocity, and normally bumps `teleportSeq`. Repeated elevator holds can suppress only
   *  that redundant bump while one server-motion epoch already owns the complete placement window. */
    private declare zeroMoveVel: OmitThisParameter<typeof roomCombatMethods.zeroMoveVel>;

  /** §29 place a floor pickup on solid ground: the BELT deck (clamped into the depth band, nudged off any
   *  pit gap) in belt mode, else the procgen arena's safe-spawn nudge. Keeps swaps and explicitly issued
   *  pickups grabbable, never in a pit or off the walkable floor. */
    private declare placePickupPos: OmitThisParameter<typeof roomCombatMethods.placePickupPos>;

  /** Apply an AoE blast at (x,y): damage every enemy within `radius`, with the same kill/money/portal
   *  bookkeeping as a swing hit. Used by the scatter-shot magma explosions (§14). */
    private declare detonate: OmitThisParameter<typeof roomCombatMethods.detonate>;

  /** §8 Emberguard fire wave — a cone of fire in front of `aim` (origin at the player), `dmg` to each enemy
   *  inside, kill bookkeeping via `damageEnemy`. The shared primitive for the on-parry wave AND the
   *  Conflagration re-pulse. */
    private declare emberguardWave: OmitThisParameter<typeof roomCombatMethods.emberguardWave>;

  /** §7/§8 execute a parry — grant i-frames, knock nearby enemies back, and fire the owned augments. Split
   *  out of the message handler (v0.105 de-clunk) so a BUFFERED parry (one that arrived during the cooldown)
   *  can fire from the tick the instant the cd drains, not just synchronously on message arrival. */
    private declare executeParry: OmitThisParameter<typeof roomCombatMethods.executeParry>;

  /** §8 apply the player's owned parry AUGMENTS on a successful parry (Iron Stance is handled at the call
   *  site since it scales the base i-frames/knockback). Each augment is small + stacks; the pool builds a
   *  custom parry per run. Offense here is server-authoritative (the client renders off the synced effects). */
    private declare applyParryAugments: OmitThisParameter<typeof roomCombatMethods.applyParryAugments>;

  /** §15/B33 duelists and derived contact melee: chase, acquire one target slot, ramp on-body, then commit. */
    private declare enemyGroundZoneSlow: OmitThisParameter<typeof roomCombatMethods.enemyGroundZoneSlow>;

  /** One enemy-movement status seam for Frostquill zones and direct-hit freezes. */
    private declare applyEnemySlow: OmitThisParameter<typeof roomCombatMethods.applyEnemySlow>;

    private declare applyEnemyHitStatus: OmitThisParameter<typeof roomCombatMethods.applyEnemyHitStatus>;

    private declare stepDuelists: OmitThisParameter<typeof roomEnemyMethods.stepDuelists>;

  /** Non-holder movement stays legible: close normally, then take a deterministic ring-out posture. */
    private declare postureMeleeEnemy: OmitThisParameter<typeof roomEnemyMethods.postureMeleeEnemy>;

  /** Capture one nav-valid endpoint and immutable target/vector at the white pop. */
    private declare planDuelistStrike: OmitThisParameter<typeof roomEnemyMethods.planDuelistStrike>;

  /** Sample the complete accepted enemy segment so the fixed lunge cannot cross a pit or landmark. */
    private declare navValidEnemyLungeDest: OmitThisParameter<typeof roomEnemyMethods.navValidEnemyLungeDest>;

    private declare captureAuthoredMeleeEscape: OmitThisParameter<typeof roomEnemyMethods.captureAuthoredMeleeEscape>;

    private declare enterOrdinaryMeleeRecover: OmitThisParameter<typeof roomEnemyMethods.enterOrdinaryMeleeRecover>;

  /** Resolve against the committed player identity. Walking/strafing is deliberately not an answer. */
    private declare duelistSwing: OmitThisParameter<typeof roomEnemyMethods.duelistSwing>;

  /** §51 one TOUGH combo-speaking elite, one tick — the authored, tick-anchored machine (worm action
   *  model): idle → [leapwind → leap → settle] → windup … → (return) → recover. The laws enforced here:
   *  the negotiated landing NEVER moves once its marker exists (G3/G5); each ramp tracks until the
   *  universal white pop, then four fixed commit ticks own a frozen vector; every displacement is bounded
   *  motion or a ≤COMBO_STEP_MAX commit-write (G2); juggle strings obey every G9 cap at the resolve
   *  tick; the parried bait stands a visible ≥0.4s stagger at its DISPLACED spot before returning (G8). */
    private declare stepComboEnemy: OmitThisParameter<typeof roomEnemyMethods.stepComboEnemy>;

  /** §51 commit one combo performance: pick from the depth-gated deck (no-repeat + ≤40% advanced),
   *  CLAIM the duel token (G12 — the choreography aims at ONE player, period), and either negotiate
   *  the leap (frozen at THIS decision) or open grounded at step 0. */
    private declare commitCombo: OmitThisParameter<typeof roomEnemyMethods.commitCombo>;

  /** §51 one immutable landing promise. The base 0.8×-range point is distance-clamped, then routed through
   *  the exact arena/belt spawn-safety functions. A >40px nav correction searches the nearest bearings on
   *  the player's front 90° arc and marks the landing awkward (+0.10s settle), as authored. */
    private declare negotiateComboLanding: OmitThisParameter<typeof roomEnemyMethods.negotiateComboLanding>;

  /** Decision-edge helper for `negotiateComboLanding`; `navShift` measures only the safety correction,
   *  not the authored 560px range pullback. */
    private declare comboLandingCandidate: OmitThisParameter<typeof roomEnemyMethods.comboLandingCandidate>;

  /** §51 open authored step `index`: fresh tick anchors, no strike (Lock will sample it). */
    private declare beginComboStep: OmitThisParameter<typeof roomEnemyMethods.beginComboStep>;

  /** §51 end a combo performance: clear rows + presentation flags, FREE the duel token (G12 — the
   *  kneeling punish window pressures no one), and hold `recover` for `ticks`. */
    private declare enterComboRecover: OmitThisParameter<typeof roomEnemyMethods.enterComboRecover>;

  /** §51 G9 air-keep gate at the RESOLVE tick: the victim must still be airborne inside the authored
   *  height window, under the ≤2 air-hit cap, and inside the ≤2.0s loss-of-control ceiling. Any miss =
   *  the whole string whiffs into recover — falling out (or being left to land) IS an escape. */
    private declare airkeepValid: OmitThisParameter<typeof roomEnemyMethods.airkeepValid>;

  /** §51 capture a combo step's committed origin + aim — planDuelistStrike generalised: authored range,
   *  an explicit travel cap (COMBO_STEP_MAX for steps, RETURN_STEP_MAX for the bait return), and an
   *  optional ONE-TIME velocity lead (air-keep fall compensation, sampled at Lock, never re-timed). */
    private declare planComboStrike: OmitThisParameter<typeof roomEnemyMethods.planComboStrike>;

  /** §51 allocation-free steady-state chase used only by authored combos. The shared chase helper returns
   *  fresh vectors (fine for legacy); active elites mutate in place so their richer per-tick machine adds
   *  zero garbage-collector pressure. */
    private declare moveComboEnemyToward: OmitThisParameter<typeof roomEnemyMethods.moveComboEnemyToward>;

  /** §51 schedule parry recoil as a continuous ≤90px/tick motion. Pits remain lethal and POI collision
   *  still runs in the normal phase afterward — no immunity is granted to protect authored content. */
    private declare scheduleComboKnockback: OmitThisParameter<typeof roomEnemyMethods.scheduleComboKnockback>;

  /** §51 advance one scheduled recoil slice; completion captures the ACTUAL post-knockback position from
   *  which a bait return later path-plans. Returns true on every tick that recoil owns movement. */
    private declare stepComboKnockback: OmitThisParameter<typeof roomEnemyMethods.stepComboKnockback>;

  /** §51 one authored combo swing from the committed Lock geometry. Parry language: white steps are
   *  parryable (shared resolveParry — bait conversion / juggle break / riposte all branch in there);
   *  RED steps (unparryable) speak the FEET language — an airborne player clears them, the parry does
   *  not answer them. Juggle displacement rides ONLY the two channels prediction already reconciles
   *  (`addImpulse` and vh) — never a position write, never zeroMoveVel (no new divergence classes). */
    private declare comboSwing: OmitThisParameter<typeof roomEnemyMethods.comboSwing>;

  /** §51 nearest LIVING player WITH identity (the anonymous `bodies` scratch drops ids — a combo
   *  commits to ONE victim at negotiation, G12). O(players), zero allocation. */
    private declare nearestLivingPlayer: OmitThisParameter<typeof roomEnemyMethods.nearestLivingPlayer>;

  /** §51 bump the synced step-commit edge, wrapping 1..255 (0 stays "no combo has ever run"). */
    private declare bumpComboSeq: OmitThisParameter<typeof roomEnemyMethods.bumpComboSeq>;

  /** Publish one deterministic success pose, then route the server-owned displacement/state by incidence. */
    private declare applyDirectionalParryReaction: OmitThisParameter<typeof roomEnemyMethods.applyDirectionalParryReaction>;

  /** The pre-B26 parry lift, extracted byte-for-byte in behavior and reached only by below incidence. */
    private declare applyLegacyParryLift: OmitThisParameter<typeof roomEnemyMethods.applyLegacyParryLift>;

  /** Move immediately to a swept-valid endpoint; snapshot interpolation presents the authored slide beat. */
    private declare applySideParrySlide: OmitThisParameter<typeof roomEnemyMethods.applySideParrySlide>;

  /** §8 apply a SUCCESSFUL parry of a telegraphed melee strike: negate + punish + FLOW + the v0.114 chain
   *  reward. `attacker` is bump-knocked back; `attackerId` looks up its `comboState` for the high-chain
   *  STAGGER (a boss has no comboState entry → no stagger, which is correct — bosses aren't stunlockable).
   *  Shared by the horde duelist swing and the boss `meleeCombo` so the two parry paths can't drift. */
    private declare resolveParry: OmitThisParameter<typeof roomEnemyMethods.resolveParry>;

  /** §16 Slice 3 — resolve a PARRYABLE boss melee wedge (the `meleeCombo` primitive). Mirrors the horde
   *  duelist swing: a player in the arc with parry i-frames PARRIES it (shared `resolveParry` reward),
   *  otherwise takes the (already depth-scaled) hit + a knockback shove along the strike. */
    private declare applyBossMelee: OmitThisParameter<typeof roomEnemyMethods.applyBossMelee>;

  /** Advance every projectile, expire at TTL/arena edge. HOSTILE projectiles hit players (parry-/
   *  level-immune); FRIENDLY (thrown) projectiles cut through enemies up to their pierce count. */
    private declare stepProjectiles: OmitThisParameter<typeof roomCombatMethods.stepProjectiles>;

  /** §8 v0.117 PROJECTILE PARRY — a hostile bullet caught in the i-frame window is DEFLECTED. Two modes:
   *  • BASE (no augment): it GLANCES off to the side and fades — like a round pinging off Superman. Pure
   *    defense, zero enemy damage, a brief spark (kind "deflect", short TTL).
   *  • `deflector` augment: it RICOCHETS BACK at the nearest enemy — a friendly counter-shot, boosted speed
   *    + damage (kind "counter"), the offensive upgrade.
   *  Either way it fires the parry reward (flash + heal + FLOW cd + chain build) so catching a spit chains
   *  like a melee parry, and the client re-skins the bullet mid-flight (it sees `hostile`+`kind` flip). */
    private declare reflectProjectile: OmitThisParameter<typeof roomCombatMethods.reflectProjectile>;

  /** Zoners drop a corrosive puddle under themselves on a cooldown (§15 area denial). */
    private declare stepZoners: OmitThisParameter<typeof roomEnemyMethods.stepZoners>;

  /** Tick puddle lifetimes; DoT any living, non-invulnerable player standing inside one. */
    private declare stepZones: OmitThisParameter<typeof roomEnemyMethods.stepZones>;

  /** §29 belt ROOM state machine — walk into a room → the gate locks + its wave spawns → clear it → the gate
   *  opens → advance; the last room drops the boss, and clearing it wins the run. Server-authoritative + the
   *  lock x syncs so every client's camera + the gate render agree. */
    private declare positionCorporateParty: OmitThisParameter<typeof roomProgressionMethods.positionCorporateParty>;

    private declare transitionCorporateFloor: OmitThisParameter<typeof roomProgressionMethods.transitionCorporateFloor>;

  /** Owner-locked B34 transition: one player commits, the whole room rides, and no body stays behind. */
    private declare stepCorporateElevator: OmitThisParameter<typeof roomProgressionMethods.stepCorporateElevator>;

    private declare stepBeltRooms: OmitThisParameter<typeof roomProgressionMethods.stepBeltRooms>;

  /** Non-boss (trash) enemies currently alive — a belt room is cleared when this hits 0. */
    private declare beltTrashAlive: OmitThisParameter<typeof roomEnemyMethods.beltTrashAlive>;

  /** §29 spawn a room's wave: `n` enemies spread across the room's belt x-range, on the authored floor. */
    private declare spawnBeltWave: OmitThisParameter<typeof roomEnemyMethods.spawnBeltWave>;

  /** Spawn enemies on a ring around a random player, accelerating with run time (§5/§6) and pressing
   *  harder per §6 chain depth (v0.103). */
    private declare runSpawnDirector: OmitThisParameter<typeof roomEnemyMethods.runSpawnDirector>;

  /** Reuses stable target rows and scans the fixed receipt ring for the authored four-second threat share. */
    private declare buildVastagharTargets: OmitThisParameter<typeof roomEnemyMethods.buildVastagharTargets>;

  /** Beam-heat-style ultimate truth: private float, quantized mirror, one ready sequence edge. */
    private declare syncUltimateCharge: OmitThisParameter<typeof roomCombatMethods.syncUltimateCharge>;

  /** Personal anti-farm seam shared by ordinary enemies and Serraketh slots. */
    private declare accrueUltimateCharge: OmitThisParameter<typeof roomCombatMethods.accrueUltimateCharge>;

    private declare addUltimateFlatCharge: OmitThisParameter<typeof roomCombatMethods.addUltimateFlatCharge>;

  /** Validate the FINAL corrected point against every living player's warning circle and a conservative
   *  gameplay-camera rectangle. The bounded angular fan reuses the real safe-position correction for each
   *  attempt and writes the accepted result into the two scalar scratch fields. */
    private declare findFairEnemySpawn: OmitThisParameter<typeof roomEnemyMethods.findFairEnemySpawn>;

    private declare spawnEnemy: OmitThisParameter<typeof roomEnemyMethods.spawnEnemy>;

  /** §21 Dev summon: place ONE enemy of `kindId` on the spawn ring around `anchor`, optionally tough.
   *  Mirrors spawnEnemy's placement (ring offset + pit/POI safe-spawn) but with a CHOSEN kind/tier so the
   *  Testing-Grounds Tab menu can conjure exactly what the playtester wants to fight. */
    private declare debugSpawnOne: OmitThisParameter<typeof roomEnemyMethods.debugSpawnOne>;

  /** §16 v0.116 BOSS RUSH — drop the boss at `bossRushIndex` in the gauntlet order (`BOSS_DEF_IDS`). Reuses
   *  `spawnBoss` (ring-spawn near a living player, HP-scaled by the escalating depth), which also retires any
   *  lingering previous boss. */
    private declare spawnBossRushBoss: OmitThisParameter<typeof roomEnemyMethods.spawnBossRushBoss>;

  /** §16 v0.116 BOSS RUSH — a boss just fell: pay the squad a depth-scaled wage + a mid-run heal + a mystery
   *  drop, then either QUEUE the next boss (escalating `depth`) or, on the final boss, WIN the run (bank + clean
   *  the field, mirroring `checkExtraction`). */
    private declare advanceBossRush: OmitThisParameter<typeof roomEnemyMethods.advanceBossRush>;

  /** Spawn a BOSS on a ring around a player (§16) — the run's capstone threat. `overrideKind` (the debug
   *  picker) spawns a specific boss BODY; otherwise the active dimension's boss. The body kind supplies the
   *  sprite/hp/radius; its `BossDef` (or CLASSIC_BOSS fallback) drives the attacks via the BossController. */
    private declare retireStageForVastaghar: OmitThisParameter<typeof roomEnemyMethods.retireStageForVastaghar>;

    private declare spawnBoss: OmitThisParameter<typeof roomEnemyMethods.spawnBoss>;

  /** Reset the §17 shifter director (first incursion timer, no active incursion). `keepWaves` (a §6 rift
   *  descent) preserves the per-incursion HP ramp — descending IS "deeper into the chain"; only a fresh
   *  run/training toggle zeroes it. */
    private declare resetShifters: OmitThisParameter<typeof roomEnemyMethods.resetShifters>;

  /** §17 SHIFTER director: manage the active incursion (phase it out when its hunt window expires) and, in
   *  normal play, start the next one on the cadence. Only one incursion at a time; held while the boss is up
   *  or the portal is open. The shifter's actual combat runs through the generic archetype AI. */
    private declare stepShifters: OmitThisParameter<typeof roomEnemyMethods.stepShifters>;

  /** Phase a shifter in at the arena edge near a living drifter. Tier escalates with run time AND §6 chain
   *  depth (v0.103 — a depth-3 dimension opens with a mid-tier invader, matching the world around it); HP
   *  ramps per incursion across the WHOLE run (shifterWaves survives descents — "tougher deeper into the
   *  chain") and scales with depth like everything else. Hunts for `shifter.window` sec, then phases out. */
    private declare spawnShifter: OmitThisParameter<typeof roomEnemyMethods.spawnShifter>;

  /** Open the extraction portal where the boss fell (§16). */
  /** §17 mint fresh map seeds + regenerate the server's arena from them (the client mirrors via the
   *  synced seeds). Called at room create, on every §6 rift descent, and on run restart. */
    private declare mintMap: OmitThisParameter<typeof roomProgressionMethods.mintMap>;

  /** §6 the boss falls → open BOTH gates of the greed decision: the amber EXTRACTION portal (bank 100% of
   *  run money and end in victory) and the violet DEEPER rift (descend to depth+1 — harder, richer).
   *  QOL-03 solves them jointly as reachable, full-footprint safe discs with protected separation. */
    private declare openPortal: OmitThisParameter<typeof roomProgressionMethods.openPortal>;

    private declare resetExtractionIntent: OmitThisParameter<typeof roomProgressionMethods.resetExtractionIntent>;

  /** §6 rift descent (v0.103, the chain): depth+1, a NEW dimension + freshly-seeded map, the same squad —
   *  levels/attributes/weapons/augments/run money/HP all persist (that's the greed: you push in
   *  whatever shape the last fight left you). The field is cleared, the clock and boss director reset. */
    private declare transitionDimension: OmitThisParameter<typeof roomProgressionMethods.transitionDimension>;

  /** QOL-01 extraction is a deliberate post-reward choice: stabilise, block every body carried through the
   *  arming edge until it leaves, then require a short uninterrupted fresh spatial hold. Direct state-only
   *  test/dev gates retain the legacy immediate seam (`extractArmTimer < 0`); production gates all enter via
   *  `openPortal` and can never use it. */
    private declare checkExtraction: OmitThisParameter<typeof roomProgressionMethods.checkExtraction>;

  /** §6 the other half of the greed decision (v0.103): the DEEPER rift is a CHANNEL — a living player
   *  must HOLD it for RIFT_CHANNEL_SECONDS (the synced `riftCharge` fills 0→1, drawn by the client) before
   *  the whole squad commits. Leaving the ring drains the charge — one misstep or one griefer can't yank
   *  four players into depth+1. Extraction stays instant (it's the benign direction). */
    private declare checkDescend: OmitThisParameter<typeof roomProgressionMethods.checkDescend>;
}

type PrototypeMethodGroup = Readonly<Record<PropertyKey, unknown>>;

function installPrototypeMembers(
  target: { prototype: object },
  members: readonly (readonly [PrototypeMethodGroup, PropertyKey])[],
): void {
  for (const [group, name] of members) {
    const descriptor = Object.getOwnPropertyDescriptor(group, name);
    if (!descriptor) throw new Error(`Missing extracted prototype member ${String(name)}`);
    Object.defineProperty(target.prototype, name, { ...descriptor, enumerable: false });
  }
}

installPrototypeMembers(GameRoom, [
  [roomProgressionMethods, "isHost"],
  [roomProgressionMethods, "devToolsEnabled"],
  [roomProgressionMethods, "takeAction"],
  [roomProgressionMethods, "installCorporateFloor"],
  [roomProgressionMethods, "isCorporateLoop"],
  [roomProgressionMethods, "onCreate"],
  [roomProgressionMethods, "clearTransients"],
  [roomProgressionMethods, "clearCombatEntities"],
  [roomProgressionMethods, "enterTerminalOutcome"],
  [roomEconomyMethods, "dropHeldWeapon"],
  [roomEconomyMethods, "weaponEntryDisassemblyValue"],
  [roomEconomyMethods, "canDisassembleFloorPickup"],
  [roomEconomyMethods, "clearFloorPickup"],
  [roomEconomyMethods, "disassembleFloorPickup"],
  [roomEconomyMethods, "disassembleBagPickup"],
  [roomEconomyMethods, "initializeStoredWeaponResource"],
  [roomEconomyMethods, "copySlot"],
  [roomEconomyMethods, "mintWeaponOpaqueId"],
  [roomEconomyMethods, "mintWeaponInstance"],
  [roomEconomyMethods, "installWeaponMember"],
  [roomEconomyMethods, "installHomeIssue"],
  [roomEconomyMethods, "materializeWeaponRun"],
  [roomEconomyMethods, "createWeaponRun"],
  [roomEconomyMethods, "syncWeaponRunFromArsenal"],
  [roomEconomyMethods, "registerFoundWeaponEntry"],
  [roomEconomyMethods, "consumeRunWeaponEntry"],
  [roomEconomyMethods, "sendWeaponManifest"],
  [roomEconomyMethods, "bagCapacity"],
  [roomEconomyMethods, "resetChestDirector"],
  [roomEconomyMethods, "stepChestDirector"],
  [roomEconomyMethods, "refreshChestOpened"],
  [roomEconomyMethods, "refreshAllChestOpened"],
  [roomEconomyMethods, "chestWeaponBagSlot"],
  [roomEconomyMethods, "grantChestWeapon"],
  [roomEconomyMethods, "dropChestWeapon"],
  [roomEconomyMethods, "maybeDropEnemyWeapon"],
  [roomEconomyMethods, "grantCommonRelic"],
  [roomEconomyMethods, "grantRareRelic"],
  [roomEconomyMethods, "openChestForPlayer"],
  [roomEconomyMethods, "saveWeaponResource"],
  [roomEconomyMethods, "restoreWeaponResource"],
  [roomEconomyMethods, "transitionWeapon"],
  [roomEconomyMethods, "stepHeldBreakActionReload"],
  [roomEconomyMethods, "stepStowedWeaponResources"],
  [roomEconomyMethods, "stepStoredSlot"],
  [roomEconomyMethods, "syncActiveSlot"],
  [roomEconomyMethods, "loadSlot"],
  [roomEconomyMethods, "grabIntoArsenal"],
  [roomEconomyMethods, "heldDamageMult"],
  [roomEconomyMethods, "weaponRecoveryMult"],
  [roomEconomyMethods, "heldCastDamageMult"],
  [roomEconomyMethods, "snapshotRunCharacter"],
  [roomEconomyMethods, "snapshotGearRun"],
  [roomEconomyMethods, "snapshotRunIdentity"],
  [roomEconomyMethods, "applyQuirkEffects"],
  [roomEconomyMethods, "applyParryQuirk"],
  [roomEconomyMethods, "applyKillQuirk"],
  [roomEconomyMethods, "loadoutIds"],
  [roomEconomyMethods, "livingCount"],
  [roomEconomyMethods, "ownerClient"],
  [roomEconomyMethods, "sendOwnerMessage"],
  [roomEconomyMethods, "publishPetPickupEligibility"],
  [roomEconomyMethods, "bumpAccountRevision"],
  [roomEconomyMethods, "snapshotPetRun"],
  [roomEconomyMethods, "resetPetAccrual"],
  [roomEconomyMethods, "advancePetPresence"],
  [roomEconomyMethods, "recordPetAcceptedAction"],
  [roomEconomyMethods, "awardPetDimensionClear"],
  [roomEconomyMethods, "beginNextPetDimension"],
  [roomEconomyMethods, "rollSlateTortoise"],
  [roomEconomyMethods, "settleMetaAccounts"],
  [roomEconomyMethods, "applyHeal"],
  [roomProgressionMethods, "toggleTraining"],
  [roomProgressionMethods, "forfeitWeaponRunForWorkshop"],
  [roomProgressionMethods, "spawnGalleryPage"],
  [roomProgressionMethods, "restartRun"],
  [roomEnemyMethods, "clearEnemiesNear"],
  [roomEnemyMethods, "rebuildEnemyGrid"],
  [roomEnemyMethods, "insertEnemyGrid"],
  [roomEnemyMethods, "updateEnemyGrid"],
  [roomEnemyMethods, "rebuildWormSegmentGrid"],
  [roomEnemyMethods, "effectiveEnemyBodies"],
  [roomEnemyMethods, "resolveEnemyCollisions"],
  [roomProgressionMethods, "onJoin"],
  [roomProgressionMethods, "onLeave"],
  [roomCombatMethods, "setWeaponResourceRegenOverride"],
  [roomCombatMethods, "drivePendingValue"],
  [roomCombatMethods, "markWeaponResourcePressure"],
  [roomCombatMethods, "hostileWithinDriveThreat"],
  [roomCombatMethods, "beamEmptyRecoveryTicks"],
  [roomCombatMethods, "beginWeaponResourceTick"],
  [roomCombatMethods, "commitWeaponResourceTick"],
  [roomCombatMethods, "creditWeaponResource"],
  [roomCombatMethods, "trySpendWeaponResource"],
  [roomCombatMethods, "slideInvulnerable"],
  [roomCombatMethods, "noteSlideDodge"],
  [roomCombatMethods, "damagePlayer"],
  [roomCombatMethods, "consumeDebugCommitDefense"],
  [roomMovementMethods, "consumeMoveStanceInput"],
  [roomMovementMethods, "setMoveStance"],
  [roomMovementMethods, "syncSlideWire"],
  [roomMovementMethods, "cancelMoveStance"],
  [roomMovementMethods, "clientMovementNavValid"],
  [roomMovementMethods, "beginServerMotion"],
  [roomMovementMethods, "placeWithMotionEpoch"],
  [roomMovementMethods, "refreshServerMotionState"],
  [roomMovementMethods, "freshInputState"],
  [roomMovementMethods, "stepSlideStance"],
  [roomMovementMethods, "damagePitFall"],
  [roomMovementMethods, "stepTraversalLaunches"],
  [roomMovementMethods, "launchDistanceJump"],
  [roomMovementMethods, "steerDistanceJump"],
  [roomMovementMethods, "finishPlayerLanding"],
  [roomCombatMethods, "applyPoundImpact"],
  [roomCombatMethods, "enemyCommittedAttack"],
  [roomCombatMethods, "stepPoundEnemyEffects"],
  [roomCombatMethods, "writeCombatReceipt"],
  [roomProgressionMethods, "advanceElapsed"],
  [roomProgressionMethods, "resetElapsed"],
  [roomProgressionMethods, "onUncaughtException"],
  [roomProgressionMethods, "update"],
  [roomProgressionMethods, "stepSim"],
  [roomCombatMethods, "ultimateOwnsMovement"],
  [roomCombatMethods, "nearestDoorDecoy"],
  [roomMovementMethods, "navValidDest"],
  [roomCombatMethods, "ultimateTargetPosition"],
  [roomCombatMethods, "selectAlphaTargets"],
  [roomCombatMethods, "acceptUltimate"],
  [roomCombatMethods, "tryDimensionDoorReturn"],
  [roomCombatMethods, "beginUltimate"],
  [roomCombatMethods, "ultimateScale"],
  [roomCombatMethods, "critAdditiveModifiers"],
  [roomCombatMethods, "flatCritChance"],
  [roomCombatMethods, "weaponCritChance"],
  [roomCombatMethods, "launchSunspiteComet"],
  [roomCombatMethods, "stepSeismarch"],
  [roomCombatMethods, "resolveSeismarchImpact"],
  [roomCombatMethods, "applyUltimateStun"],
  [roomCombatMethods, "stepEventHorizon"],
  [roomCombatMethods, "damageEventHorizonSweep"],
  [roomCombatMethods, "stepAlphaStrike"],
  [roomCombatMethods, "cancelUltimate"],
  [roomCombatMethods, "stepUltimateWorldEffects"],
  [roomCombatMethods, "stepUltimates"],
  [roomCombatMethods, "stampAttackBeat"],
  [roomCombatMethods, "nextSoloMeleeBeat"],
  [roomCombatMethods, "recordSoloMeleeBeat"],
  [roomCombatMethods, "resolveSingleWeaponAttack"],
  [roomCombatMethods, "resolveSwing"],
  [roomCombatMethods, "tryRez"],
  [roomCombatMethods, "beamHeld"],
  [roomCombatMethods, "stepPlayerChargedProjectile"],
  [roomCombatMethods, "fireChargedProjectile"],
  [roomCombatMethods, "stepPlayerAura"],
  [roomCombatMethods, "navValidMotionDest"],
  [roomCombatMethods, "playerAttackMoveMode"],
  [roomCombatMethods, "zoneTarget"],
  [roomCombatMethods, "stepPlayerGroundZone"],
  [roomCombatMethods, "clearBeamRows"],
  [roomCombatMethods, "beamSatelliteCount"],
  [roomCombatMethods, "stepPlayerBeam"],
  [roomCombatMethods, "stepActiveBeam"],
  [roomCombatMethods, "finishBeam"],
  [roomCombatMethods, "cancelBeam"],
  [roomCombatMethods, "syncRestingBeamRow"],
  [roomCombatMethods, "syncBeamRow"],
  [roomCombatMethods, "writeBeamMuzzle"],
  [roomCombatMethods, "clipBeamLength"],
  [roomCombatMethods, "rayCircleLength"],
  [roomCombatMethods, "damageBeamSweep"],
  [roomCombatMethods, "flushBeamDamage"],
  [roomCombatMethods, "applyRapidThrustHit"],
  [roomCombatMethods, "stepMeleeSwings"],
  [roomProgressionMethods, "beginVastagharClear"],
  [roomProgressionMethods, "stepVastagharVictory"],
  [roomProgressionMethods, "completeVastagharVictoryPresentation"],
  [roomProgressionMethods, "completeVastagharClear"],
  [roomEconomyMethods, "awardMoney"],
  [roomEconomyMethods, "moneyDropReach"],
  [roomEconomyMethods, "nearestMoneyCollector"],
  [roomEconomyMethods, "dropMoney"],
  [roomEconomyMethods, "stepMoneyDrops"],
  [roomEconomyMethods, "drainMoneyDrops"],
  [roomProgressionMethods, "completeRewardBoundary"],
  [roomProgressionMethods, "completeExtraction"],
  [roomProgressionMethods, "completeBossRushVictory"],
  [roomEnemyMethods, "stepBoss"],
  [roomEnemyMethods, "clearBoss"],
  [roomEnemyMethods, "bossSink"],
  [roomEnemyMethods, "addTelegraphRow"],
  [roomEnemyMethods, "setTelegraphRowProgress"],
  [roomEnemyMethods, "removeTelegraphRow"],
  [roomEnemyMethods, "applyBossAoE"],
  [roomEnemyMethods, "applyBossQuake"],
  [roomEnemyMethods, "applyVastagharQuake"],
  [roomEnemyMethods, "applyVastagharSweep"],
  [roomEnemyMethods, "vastagharParryActive"],
  [roomEnemyMethods, "resolveVastagharParry"],
  [roomEnemyMethods, "mutateVastagharArena"],
  [roomEnemyMethods, "damageBeamRect"],
  [roomEnemyMethods, "damageRingBand"],
  [roomEnemyMethods, "spawnWeaponGroundZoneAt"],
  [roomEnemyMethods, "dropBossZone"],
  [roomEnemyMethods, "spawnBossAddAt"],
  [roomEnemyMethods, "stepVastagharAddBudget"],
  [roomEnemyMethods, "stepSpitters"],
  [roomCombatMethods, "fireProjectile"],
  [roomCombatMethods, "removeProjectile"],
  [roomCombatMethods, "aimDir"],
  [roomCombatMethods, "armGunBurst"],
  [roomCombatMethods, "clearGunBurst"],
  [roomCombatMethods, "stepGunBurst"],
  [roomCombatMethods, "detonateWarpAtCursor"],
  [roomCombatMethods, "fireGun"],
  [roomCombatMethods, "applyWeaponFireRecoil"],
  [roomCombatMethods, "applyProjectileChain"],
  [roomCombatMethods, "fireCast"],
  [roomCombatMethods, "throwWeapon"],
  [roomCombatMethods, "emitWeaponThrow"],
  [roomCombatMethods, "redirectThrownRicochet"],
  [roomCombatMethods, "fireScatter"],
  [roomCombatMethods, "emitScatterVolley"],
  [roomCombatMethods, "emitHybridProjectile"],
  [roomCombatMethods, "damageWormSlots"],
  [roomCombatMethods, "collectWormRadiusHits"],
  [roomCombatMethods, "damageEnemy"],
  [roomCombatMethods, "zeroMoveVel"],
  [roomCombatMethods, "placePickupPos"],
  [roomCombatMethods, "detonate"],
  [roomCombatMethods, "emberguardWave"],
  [roomCombatMethods, "executeParry"],
  [roomCombatMethods, "applyParryAugments"],
  [roomCombatMethods, "enemyGroundZoneSlow"],
  [roomCombatMethods, "applyEnemySlow"],
  [roomCombatMethods, "applyEnemyHitStatus"],
  [roomEnemyMethods, "stepDuelists"],
  [roomEnemyMethods, "postureMeleeEnemy"],
  [roomEnemyMethods, "planDuelistStrike"],
  [roomEnemyMethods, "navValidEnemyLungeDest"],
  [roomEnemyMethods, "captureAuthoredMeleeEscape"],
  [roomEnemyMethods, "enterOrdinaryMeleeRecover"],
  [roomEnemyMethods, "duelistSwing"],
  [roomEnemyMethods, "stepComboEnemy"],
  [roomEnemyMethods, "commitCombo"],
  [roomEnemyMethods, "negotiateComboLanding"],
  [roomEnemyMethods, "comboLandingCandidate"],
  [roomEnemyMethods, "beginComboStep"],
  [roomEnemyMethods, "enterComboRecover"],
  [roomEnemyMethods, "airkeepValid"],
  [roomEnemyMethods, "planComboStrike"],
  [roomEnemyMethods, "moveComboEnemyToward"],
  [roomEnemyMethods, "scheduleComboKnockback"],
  [roomEnemyMethods, "stepComboKnockback"],
  [roomEnemyMethods, "comboSwing"],
  [roomEnemyMethods, "nearestLivingPlayer"],
  [roomEnemyMethods, "bumpComboSeq"],
  [roomEnemyMethods, "applyDirectionalParryReaction"],
  [roomEnemyMethods, "applyLegacyParryLift"],
  [roomEnemyMethods, "applySideParrySlide"],
  [roomEnemyMethods, "resolveParry"],
  [roomEnemyMethods, "applyBossMelee"],
  [roomCombatMethods, "stepProjectiles"],
  [roomCombatMethods, "reflectProjectile"],
  [roomEnemyMethods, "stepZoners"],
  [roomEnemyMethods, "stepZones"],
  [roomProgressionMethods, "positionCorporateParty"],
  [roomProgressionMethods, "transitionCorporateFloor"],
  [roomProgressionMethods, "stepCorporateElevator"],
  [roomProgressionMethods, "stepBeltRooms"],
  [roomEnemyMethods, "beltTrashAlive"],
  [roomEnemyMethods, "spawnBeltWave"],
  [roomEnemyMethods, "runSpawnDirector"],
  [roomEnemyMethods, "buildVastagharTargets"],
  [roomCombatMethods, "syncUltimateCharge"],
  [roomCombatMethods, "accrueUltimateCharge"],
  [roomCombatMethods, "addUltimateFlatCharge"],
  [roomEnemyMethods, "findFairEnemySpawn"],
  [roomEnemyMethods, "spawnEnemy"],
  [roomEnemyMethods, "debugSpawnOne"],
  [roomEnemyMethods, "spawnBossRushBoss"],
  [roomEnemyMethods, "advanceBossRush"],
  [roomEnemyMethods, "retireStageForVastaghar"],
  [roomEnemyMethods, "spawnBoss"],
  [roomEnemyMethods, "resetShifters"],
  [roomEnemyMethods, "stepShifters"],
  [roomEnemyMethods, "spawnShifter"],
  [roomProgressionMethods, "mintMap"],
  [roomProgressionMethods, "openPortal"],
  [roomProgressionMethods, "resetExtractionIntent"],
  [roomProgressionMethods, "transitionDimension"],
  [roomProgressionMethods, "checkExtraction"],
  [roomProgressionMethods, "checkDescend"],
]);
