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
  beltProjectileBlocked,
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
  isPetId,
  isLavaGapAtPx,
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
  ULTIMATES_ENABLED,
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
import { appendOwnerNote, sanitizeOwnerNote } from "../../owner-notes.js";
import {
  BossController,
  type VastagharEmitSink,
  VastagharEncounterRuntime,
  type VastagharTarget,
} from "../BossController.js";
import { MeleeAttackTokens } from "../MeleeAttackTokens.js";
import {
  bankPetBondXp,
  commitWeaponCarry,
  settleWeaponExpedition,
  type WeaponSettlementResult,
  wipeWeaponBankForPrestige,
} from "../progression.js";
import { SpatialGrid } from "../SpatialGrid.js";import { COMBO_RINGOUT_ORBIT, COMBO_RIPOSTE_STAGGER_TICKS, ZERO_MOVE_INPUT, ZERO_IMPULSE, tickReached, ticksFromSeconds, pointSegmentDistanceSq, pointInConvexQuadrilateral, pointSweptUprightCapsuleDistanceSq, EXTRACT_ARM_SECONDS, EXTRACT_HOLD_SECONDS, SPAWN_CANDIDATE_COUNT, SPAWN_MIN_DISTANCE, SPAWN_CAMERA_HALF_WIDTH, SPAWN_CAMERA_HALF_HEIGHT, ENEMY_GRID_CELL_SIZE, MAX_ENEMY_RADIUS, ENEMY_SEPARATION_OVERLAP_FRACTION, ENEMY_SEPARATION_MAX_STEP, GROUND_ZONE_ENTITY_CAP, GROUND_ZONE_OWNER_CAP } from "./room-progression.js";
import type { InputCmd, InputState, WeaponResourceLedger, WeaponSpendReason, ZoneRuntime, WeaponSpendResult, PendingScatterVolley, PendingHybridProjectile, PendingWeaponThrow, ActiveMeleeSwing, DriveRuntime, RunWeaponLedger, PickupWeaponBankMeta, DisconnectedPlayerReservation, PlayerDamageKind, PetRunRuntime, UltimateTarget, UltimateRuntime, WeaponHand, CombatState, DuelistComboState, RewardBoundary, GameRoomContext, ServerMotionSource } from "./room-progression.js";

export const roomCombatMethods = {

  /** Explicit encounter/modal hook. Auto remains the default; callers never write Drive or regenMode. */
  setWeaponResourceRegenOverride(this: GameRoomContext, playerId: string, mode: "auto" | "paused" | "forceEngaged"): void {
    const drive = this.combat.get(playerId)?.drive;
    if (!drive) return;
    drive.simulationPaused = mode === "paused";
    drive.forceEngaged = mode === "forceEngaged";
  },

  drivePendingValue(this: GameRoomContext, player: PlayerState, c: CombatState): number {
    return Math.max(
      0,
      Math.min(
        relicEnergyCapacity(player.relics),
        c.drive.valueF + c.drive.tickCreditF - c.drive.tickDebitF,
      ),
    );
  },

  markWeaponResourcePressure(this: GameRoomContext, c: CombatState): void {
    c.drive.pressureUntilTick =
      (this.state.tick + Math.ceil((DRIVE_PRESSURE_MEMORY_SECONDS * 1000) / TICK_MS)) >>> 0;
  },

  /** Cover-agnostic pressure evidence. Dummy rows are training fixtures, not living hostiles. */
  hostileWithinDriveThreat(this: GameRoomContext, player: PlayerState): boolean {
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
  },

  /** Preserve the old discrete lock+cool tick count for approved beam-only vent/lock modifiers. */
  beamEmptyRecoveryTicks(this: GameRoomContext, c: CombatState): number {
    const lockTicks = Math.ceil(
      (BEAM_OVERHEAT_LOCK_SECONDS * c.mods.beamOverheatLockMult * 1000) / TICK_MS - 1e-9,
    );
    const ventMultiplier = (1 + AUG_BEAM_COOL_PER * c.beamVentStacks) * c.mods.beamVentMult;
    const coolTicks = Math.ceil(
      (((1 - BEAM_RESTART_HEAT) / Math.max(1e-9, BEAM_COOL_PER_SECOND * ventMultiplier)) * 1000) /
        TICK_MS -
        1e-9,
    );
    return Math.max(1, lockTicks + coolTicks);
  },

  /** Compute one fixed-step credit before any fire path. Recovery debt is sampled before it ages. */
  beginWeaponResourceTick(this: GameRoomContext, player: PlayerState, c: CombatState, dt: number): void {
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
      drive.simulationPaused,
      debtLive,
      pressure,
      player.ultPhase !== UltimatePhase.Idle,
    );
    const genericRecovery = Math.max(
      1,
      Math.min(DRIVE_MAX_GENERIC_RECOVERY_MULT, drive.engagedRecoveryMult),
    );
    const rebuildingEmptyBeam =
      drive.beamLockEndTick !== 0 &&
      this.drivePendingValue(player, c) + 1e-9 < DRIVE_BEAM_RESTART_THRESHOLD;
    if (drive.regenMode !== DriveRegenMode.Paused && rebuildingEmptyBeam) {
      // This is the old beam-only vent row translated into the shared bar, not generic/hiding recovery.
      drive.regenMode = DriveRegenMode.Floor;
      drive.tickCreditF =
        (DRIVE_BEAM_RESTART_THRESHOLD / ((this.beamEmptyRecoveryTicks(c) * TICK_MS) / 1000) +
          relicEnergyRegenAdd(player.relics)) *
        dt;
    } else {
      drive.tickCreditF =
        (driveRegenPerSecond(drive.regenMode, genericRecovery) +
          relicEnergyRegenAdd(player.relics)) *
        dt;
    }
    drive.recoveryDebtF = Math.max(0, drive.recoveryDebtF - dt);
  },

  /** Commit once after all same-tick fire paths, then floor the public hundredths mirror. */
  commitWeaponResourceTick(this: GameRoomContext, player: PlayerState, c: CombatState): void {
    const drive = c.drive;
    drive.valueF = Math.max(
      0,
      Math.min(
        relicEnergyCapacity(player.relics),
        drive.valueF + drive.tickCreditF - drive.tickDebitF,
      ),
    );
    player.weaponResource.valueQ = Math.max(0, Math.floor(drive.valueF * 100 + 1e-7));
    player.weaponResource.regenMode = drive.regenMode;
    player.weaponResource.beamLockEndTick = drive.beamLockEndTick >>> 0;
    drive.tickCreditF = 0;
    drive.tickDebitF = 0;
    drive.tickOpen = false;
  },

  /** Credits are a separate authority seam and cannot clear release or minimum-lock gates. */
  creditWeaponResource(this: GameRoomContext, player: PlayerState, c: CombatState, amount: number): number {
    const credit = Number.isFinite(amount) ? Math.max(0, amount) : 0;
    c.drive.valueF = Math.min(relicEnergyCapacity(player.relics), c.drive.valueF + credit);
    player.weaponResource.valueQ = Math.floor(c.drive.valueF * 100 + 1e-7);
    return credit;
  },

  /**
   * The one weapon spend seam. It resolves canonical formula data and live cadence; callers never supply a
   * price. The reused result row avoids a per-action allocation in the fixed 20 Hz loop.
   */
  trySpendWeaponResource(this: GameRoomContext,
    player: PlayerState,
    c: CombatState,
    weapon: WeaponDef,
    _weaponInstanceId: string,
    _delivery: number,
    _hand: WeaponHand,
    effectiveInterval: number,
    costMultiplier: number,
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
      requested = driveCostForProfile(profile, effectiveInterval) * Math.max(0, costMultiplier);
    } else if (reason === "beam-ignite") {
      requested = DRIVE_BEAM_IGNITION_COST;
    } else if (reason === "beam-active") {
      const dt = Math.max(0, continuousDt);
      const concurrentRegen = dt > 0 ? c.drive.tickCreditF / dt : DRIVE_FLOOR_REGEN_PER_SECOND;
      requested = (DRIVE_BEAM_NET_DRAIN_PER_SECOND + concurrentRegen) * dt;
    } else if (reason === "aura-active") {
      const dt = Math.max(0, continuousDt);
      const concurrentRegen = dt > 0 ? c.drive.tickCreditF / dt : DRIVE_FLOOR_REGEN_PER_SECOND;
      requested = ((weapon.performance?.aura?.resourcePerSecond ?? 0) + concurrentRegen) * dt;
    } else {
      requested = DRIVE_BEAM_CANCEL_COST;
    }
    if (!Number.isFinite(requested) || requested < 0) return result;

    const available = this.drivePendingValue(player, c);
    const partial =
      reason === "beam-active" || reason === "beam-cancel" || reason === "aura-active";
    if (!partial && available + 1e-9 < requested) return result;
    const debit = partial ? Math.min(available, requested) : requested;
    if ((reason === "beam-active" || reason === "aura-active") && debit <= 1e-9) return result;
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
    result.beamEmpty =
      (reason === "beam-active" || reason === "aura-active") && available - debit <= 1e-9;
    return result;
  },

  /** Direct-contact slide predicate. Separate from parry `invuln`; ticks 1..5 are the inherited budget. */
  slideInvulnerable(this: GameRoomContext, c: CombatState): boolean {
    return slideContactInvulnerable(c.stance, c.slidePhase, c.slidePhaseTick);
  },

  noteSlideDodge(this: GameRoomContext, player: PlayerState): void {
    player.dodgedSeq = (player.dodgedSeq + 1) & 0xff;
  },

  /** One authoritative player-damage seam. Bulwark spends its successful-parry shield before HP. */
  damagePlayer(this: GameRoomContext,
    player: PlayerState,
    amount: number,
    kind: PlayerDamageKind = "enemy",
  ): void {
    const c = this.combat.get(player.id);
    let left = Math.max(0, amount);
    if (
      player.ultPhase === UltimatePhase.Windup &&
      ultimateFamilyForCode(player.ultArchetype) === UltimateFamily.Seismarch
    )
      left *= 0.4;
    if (player.alive && (kind === "lava-gap" || kind === "ground-hazard")) {
      left *=
        (this.petRuns.get(player.id)?.mods.groundHazardDamageMultiplier ?? 1) *
        (c?.mods.groundHazardDamageMult ?? 1);
    }
    const capFrac = c?.mods.incomingDamageCapFrac ?? 1;
    if (capFrac < 1) left = Math.min(left, player.maxHp * capFrac);
    // Failed-jump mercy is its own null-immunity channel. It never writes/consults parry `invuln`, so a
    // snap-back cannot mint parry flashes, augments, chain economy, or worm accepts from a later quake.
    if (c && c.lavaGapGrace > 0 && left > 0) return;
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
      const deathWard = resolveOneShotProtection(
        player.hp,
        player.maxHp,
        left,
        hasRareRelic(player.relics.ownedRare, "one-shot-protection"),
        tickReached(this.state.tick, player.relics.deathWardReadyTick),
      );
      player.hp = deathWard.hp;
      if (deathWard.triggered) {
        player.relics.deathWardReadyTick =
          (this.state.tick + Math.ceil((DEATH_WARD_COOLDOWN_SECONDS * 1000) / TICK_MS)) >>> 0;
        this.sendOwnerMessage(player.id, "relicTriggered", {
          id: "one-shot-protection",
          readyTick: player.relics.deathWardReadyTick,
        });
      }
      if (c?.mods.parryChainNeverExpires) {
        c.parryChain = 0;
        c.parryChainT = 0;
      }
    }
  },

  /** Training gate only: execute one already-armed real defense on the authoritative white-pop tick. */
  consumeDebugCommitDefense(this: GameRoomContext, player: PlayerState, attacker: EnemyState): void {
    const defense = this.debugCommitDefense.get(player.id);
    if (!defense) return;
    this.debugCommitDefense.delete(player.id);
    const combat = this.combat.get(player.id);
    if (!combat) return;
    if (defense === "parry") {
      this.executeParry(player, combat);
      return;
    }
    const input = this.inputs.get(player.id);
    if (!input) return;
    const dx = player.x - attacker.x;
    const dy = player.y - attacker.y;
    const length = Math.hypot(dx, dy) || 1;
    this.consumeMoveStanceInput(player, input, combat, {
      ...input.held,
      dx: dx / length,
      dy: dy / length,
      slide: true,
      slideHeld: true,
    });
  },

  applyPoundImpact(this: GameRoomContext, player: PlayerState, c: CombatState): void {
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
  },

  enemyCommittedAttack(this: GameRoomContext, id: string): boolean {
    const combo = this.comboState.get(id);
    return combo?.phase === "windup" && !!combo.strike;
  },

  /** Decaying 260px/s shove totals <40px and preserves Lava Foundry platform collision. */
  stepPoundEnemyEffects(this: GameRoomContext, dt: number): void {
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
      const currentlyOverGap = isLavaGapAtPx(this.map, enemy.x, enemy.y);
      const nextOverGap = isLavaGapAtPx(this.map, nextX, nextY);
      if (!currentlyOverGap && nextOverGap) {
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
  },

  /** Write into the fixed v18 ring. Every field comes from the accepted source epoch, never proximity. */
  writeCombatReceipt(this: GameRoomContext,
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
    )
      this.markWeaponResourcePressure(sourceCombat);
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
    const sourceWeapon = WEAPONS[sourceWeaponId];
    row.element =
      delivery === CombatDelivery.Chain
        ? "shock"
        : delivery === CombatDelivery.Aura && sourceWeapon?.performance?.aura?.damageType
          ? sourceWeapon.performance.aura.damageType
          : (sourceWeapon?.tags.element ?? "physical");
    row.dirX = len > 1e-6 ? dx / len : 0;
    row.dirY = len > 1e-6 ? dy / len : 0;
    row.damage = Math.max(0, damage);
    row.crit = crit;
    row.finalBlow = finalBlow;
  },

  ultimateOwnsMovement(this: GameRoomContext, player: PlayerState): boolean {
    if (!ULTIMATES_ENABLED) return false;
    if (player.ultPhase !== UltimatePhase.Active) return false;
    const family = ultimateFamilyForCode(player.ultArchetype);
    return (
      family === UltimateFamily.Seismarch ||
      family === UltimateFamily.AlphaStrike ||
      family === UltimateFamily.EventHorizon
    );
  },

  nearestDoorDecoy(this: GameRoomContext, pos: Vec2): Vec2 | undefined {
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
  },

  ultimateTargetPosition(this: GameRoomContext,
    target: UltimateTarget,
  ): { x: number; y: number; radius: number } | null {
    if (target.slot >= 0) {
      const runtime = this.bossController?.wormRuntime;
      if (
        !runtime ||
        !runtime.isTargetable(target.slot) ||
        runtime.segmentGeneration(target.slot) !== target.generation
      )
        return null;
      return {
        x: runtime.x[target.slot]!,
        y: runtime.y[target.slot]!,
        radius: runtime.segmentRadius(target.slot),
      };
    }
    const enemy = this.state.enemies.get(target.id);
    if (
      !enemy ||
      enemy.hp <= 0 ||
      (target.id === this.bossId && !!this.bossController?.wormRuntime)
    )
      return null;
    return {
      x: enemy.x,
      y: enemy.y,
      radius: ENEMY_KINDS[enemy.kind]?.radius ?? ENEMY_RADIUS,
    };
  },

  /** SpatialGrid selection is nearest-first, exact-radius, immutable, and protocol-capped at five. */
  selectAlphaTargets(this: GameRoomContext, player: PlayerState, maxTargets: number): UltimateTarget[] {
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
  },

  acceptUltimate(this: GameRoomContext, player: PlayerState, c: CombatState): boolean {
    if (
      !ULTIMATES_ENABLED ||
      this.state.outcome !== "active" ||
      !player.alive ||
      c.juggleArmed ||
      c.recoveryT > 0 ||
      player.ultPhase !== UltimatePhase.Idle ||
      c.ult ||
      c.ultChargeF < 1 - 1e-9
    )
      return false;
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
  },

  tryDimensionDoorReturn(this: GameRoomContext, player: PlayerState, c: CombatState): boolean {
    if (!ULTIMATES_ENABLED) return false;
    const ticket = this.ultimateDecoys.get(player.id);
    if (
      !ticket ||
      tickReached(this.state.tick, ticket.returnEndTick) ||
      ultimateFamilyForCode(player.ultArchetype) !== UltimateFamily.DimensionDoor ||
      !player.alive ||
      c.juggleArmed ||
      player.ultPhase !== UltimatePhase.Idle
    )
      return false;
    const dest = this.navValidDest(player, c, ticket.x, ticket.y, Number.POSITIVE_INFINITY);
    this.ultimateDecoys.delete(player.id);
    player.ultStartTick = this.state.tick;
    player.ultResolveTick = this.state.tick;
    player.ultEndTick = (this.state.tick + ULT_BLINK_RECOVERY_TICKS) >>> 0;
    player.ultTargetX = dest.x;
    player.ultTargetY = dest.y;
    player.ultPhase = UltimatePhase.Recovery;
    player.ultSeq = (player.ultSeq + 1) & 0xffff;
    this.placeWithMotionEpoch(player, "ultimate", () => {
      player.x = dest.x;
      player.y = dest.y;
      if (this.map.lavaLayout) {
        c.lastGroundX = dest.x;
        c.lastGroundY = dest.y;
      }
      c.invuln = Math.max(c.invuln, ULT_BLINK_IFRAMES);
      this.zeroMoveVel(player.id, undefined, "ultimate");
    });
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
  },

  beginUltimate(this: GameRoomContext, player: PlayerState, c: CombatState, ult: UltimateRuntime): void {
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
        damage:
          (ult.variant === "int" ? 50 : ULT_DOOR_DETONATE_DAMAGE) * this.ultimateScale(player, ult),
      });
      this.placeWithMotionEpoch(player, "ultimate", () => {
        player.x = player.ultTargetX;
        player.y = player.ultTargetY;
        if (this.map.lavaLayout) {
          c.lastGroundX = player.x;
          c.lastGroundY = player.y;
        }
        c.invuln = Math.max(c.invuln, ult.variant === "con" ? 0.9 : ULT_BLINK_IFRAMES);
        this.zeroMoveVel(player.id, undefined, "ultimate");
      });
      ult.teleportSeqAtAccept = player.teleportSeq;
      if (ult.variant === "str") {
        this.detonate(
          player.x,
          player.y,
          140,
          28 * this.ultimateScale(player, ult),
          this.flatCritChance(player, c),
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
    this.zeroMoveVel(player.id, undefined, "ultimate");
    ult.teleportSeqAtAccept = player.teleportSeq;
    const activeTicks = Math.max(1, (ult.activeEndTick - this.state.tick) >>> 0);
    c.invuln = Math.max(c.invuln, (activeTicks * TICK_MS) / 1000 + TICK_MS / 1000);
  },

  ultimateScale(this: GameRoomContext, _player: PlayerState, _ult: UltimateRuntime): number {
    return 1;
  },

  /** L1's additive seam now consumes the run-scoped L2 crit line. */
  critAdditiveModifiers(this: GameRoomContext,
    player: PlayerState,
    _combat: CombatState | undefined,
  ): readonly number[] {
    const relicCrit = relicCritAdd(player.relics);
    return relicCrit > 0 ? [relicCrit] : [];
  },

  flatCritChance(this: GameRoomContext, player: PlayerState, combat?: CombatState): number {
    return critChanceFor(this.critAdditiveModifiers(player, combat));
  },

  weaponCritChance(this: GameRoomContext, player: PlayerState, c: CombatState): number {
    if (c.ultCritCharges > 0 && tickReached(this.state.tick, c.ultCritEndTick))
      c.ultCritCharges = 0;
    if (c.ultCritCharges > 0) {
      c.ultCritCharges--;
      return 1;
    }
    return this.flatCritChance(player, c);
  },

  launchSunspiteComet(this: GameRoomContext, player: PlayerState, c: CombatState, ult: UltimateRuntime): void {
    const aim = this.aimDir(player, c);
    const speed = ult.variant === "dex" ? 680 : ULT_FIREBALL_SPEED;
    const direct =
      (ult.variant === "str" ? 70 : ULT_FIREBALL_DAMAGE) * this.ultimateScale(player, ult);
    const blast = (ult.variant === "con" ? 20 : ULT_NUKE_DAMAGE) * this.ultimateScale(player, ult);
    const heldWeapon = WEAPONS[player.weapon] ?? WEAPONS[DEFAULT_WEAPON]!;
    const muzzle = heldWeapon.muzzle
      ? weaponMuzzleWorldPoint(heldWeapon, {
          x: player.x,
          y: player.y,
          aimX: aim.x,
          aimY: aim.y,
          renderScale: characterScale(player.character),
        })
      : { x: player.x, y: player.y };
    const mx = muzzle.x;
    const my = muzzle.y;
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
      this.flatCritChance(player, c),
      player.id,
      "ult:sunspite-comet",
      CombatDelivery.Ultimate,
    );
  },

  stepSeismarch(this: GameRoomContext, player: PlayerState, c: CombatState, ult: UltimateRuntime): void {
    const elapsed = ((this.state.tick - player.ultResolveTick) >>> 0) + 1;
    const progress = Math.min(1, elapsed / ULT_SEISMARCH_AIR_TICKS);
    this.placeWithMotionEpoch(player, "ultimate", () => {
      player.x = ult.startX + (player.ultTargetX - ult.startX) * progress;
      player.y = ult.startY + (player.ultTargetY - ult.startY) * progress;
    });
    if (progress < 1 || ult.impactDone) return;
    ult.impactDone = true;
    this.resolveSeismarchImpact(player, c, ult);
    this.zeroMoveVel(player.id, undefined, "ultimate");
    ult.teleportSeqAtAccept = player.teleportSeq;
    player.ultPhase = UltimatePhase.Recovery;
  },

  resolveSeismarchImpact(this: GameRoomContext, player: PlayerState, c: CombatState, ult: UltimateRuntime): void {
    const shrink = ult.variant === "dex" ? 0.8 : 1;
    const inner = ULT_SEISMARCH_INNER_RADIUS * shrink;
    const mid = ULT_SEISMARCH_MID_RADIUS * shrink;
    const outer = ULT_SEISMARCH_OUTER_RADIUS * shrink;
    const scale = this.ultimateScale(player, ult);
    const crit = this.flatCritChance(player, c);
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
          ? ult.variant === "con"
            ? 48
            : ULT_SEISMARCH_INNER_DAMAGE
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
        if (!ally.alive || (ally.x - player.x) ** 2 + (ally.y - player.y) ** 2 > outer * outer)
          return;
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
      endTick:
        (this.state.tick +
          ticksFromSeconds(ult.variant === "int" ? 5 : ULT_SEISMARCH_FISSURE_SECONDS)) >>>
        0,
    });
  },

  applyUltimateStun(this: GameRoomContext, enemy: EnemyState, id: string, seconds: number): boolean {
    if (ENEMY_KINDS[enemy.kind]?.archetype === "boss") return false;
    const until = this.ultimateStunUntil.get(id);
    if (until !== undefined && !tickReached(this.state.tick, until)) return false;
    this.ultimateStunUntil.set(id, (this.state.tick + ULT_STUN_ICD_TICKS) >>> 0);
    const existing = this.poundEnemyEffects.get(id);
    if (existing) existing.staggerT = Math.max(existing.staggerT, seconds);
    else this.poundEnemyEffects.set(id, { vx: 0, vy: 0, staggerT: seconds });
    return true;
  },

  stepEventHorizon(this: GameRoomContext, player: PlayerState, c: CombatState, ult: UltimateRuntime): void {
    const duration = Math.max(1, (ult.activeEndTick - player.ultResolveTick) >>> 0);
    const elapsed = ((this.state.tick - player.ultResolveTick) >>> 0) + 1;
    const progress = Math.min(1, elapsed / duration);
    const fromX = player.x;
    const fromY = player.y;
    const toX = ult.startX + (player.ultTargetX - ult.startX) * progress;
    const toY = ult.startY + (player.ultTargetY - ult.startY) * progress;
    this.damageEventHorizonSweep(player, ult, fromX, fromY, toX, toY);
    this.placeWithMotionEpoch(player, "ultimate", () => {
      player.x = toX;
      player.y = toY;
    });
    if (progress < 1) return;
    this.zeroMoveVel(player.id, undefined, "ultimate");
    ult.teleportSeqAtAccept = player.teleportSeq;
    player.ultPhase = UltimatePhase.Recovery;
  },

  damageEventHorizonSweep(this: GameRoomContext,
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
      if (pointSegmentDistanceSq(enemy.x, enemy.y, fromX, fromY, toX, toY) > reach * reach)
        continue;
      ult.hit.add(id);
      this.damageEnemy(
        enemy,
        id,
        ULT_PHASE_DAMAGE * (ult.variant === "str" ? 1.5 : 1) * scale,
        this.ultimateKills,
        this.flatCritChance(player, this.combat.get(player.id)),
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
        this.flatCritChance(player, this.combat.get(player.id)),
        true,
        player.id,
        "ult:event-horizon",
        CombatDelivery.Ultimate,
        fromX,
        fromY,
      );
    }
    for (const id of this.ultimateKills) this.state.enemies.delete(id);
  },

  stepAlphaStrike(this: GameRoomContext, player: PlayerState, c: CombatState, ult: UltimateRuntime): void {
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
        this.placeWithMotionEpoch(player, "ultimate", () => {
          player.x = dest.x;
          player.y = dest.y;
          if (this.map.lavaLayout) {
            c.lastGroundX = dest.x;
            c.lastGroundY = dest.y;
          }
          this.zeroMoveVel(player.id, undefined, "ultimate");
        });
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
            this.flatCritChance(player, c),
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
            const maxHp =
              (kind?.hp ?? enemy.hp) *
              enemyHpScale(this.state.depth) *
              (enemy.tough ? TOUGH_HP_MULT : 1);
            const executeAt = ult.variant === "luk" ? 0.25 : ULT_ALPHA_EXECUTE_FRAC;
            if (maxHp > 0 && enemy.hp / maxHp < executeAt) base *= ULT_ALPHA_EXECUTE_MULT;
            this.damageEnemy(
              enemy,
              target.id,
              base * scale,
              this.ultimateKills,
              this.flatCritChance(player, c),
              player.id,
              "ult:alpha-strike",
              CombatDelivery.Ultimate,
              player.x,
              player.y,
            );
            if (ult.variant === "str" && enemy.hp > 0)
              this.applyUltimateStun(enemy, target.id, 0.5);
          }
        }
        for (const id of this.ultimateKills) this.state.enemies.delete(id);
      }
    }
    if (!tickReached(this.state.tick, ult.activeEndTick)) return;
    c.invuln = Math.max(c.invuln, ult.variant === "con" ? 0.6 : 0.25);
    if (ult.variant === "con")
      c.bulwarkShield = Math.max(c.bulwarkShield, 15 * Math.floor(ult.hitIndex / 2));
    player.ultPhase = UltimatePhase.Recovery;
  },

  cancelUltimate(this: GameRoomContext, player: PlayerState, c: CombatState): void {
    if (this.ultimateOwnsMovement(player))
      this.zeroMoveVel(player.id, undefined, "ultimate");
    player.ultPhase = UltimatePhase.Idle;
    c.ult = undefined;
  },

  stepUltimateWorldEffects(this: GameRoomContext, dt: number): void {
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
  },

  stepUltimates(this: GameRoomContext, dt: number): void {
    if (!ULTIMATES_ENABLED) {
      this.ultimateStunUntil.clear();
      this.ultimateBrands.clear();
      this.ultimateDecoys.clear();
      this.ultimateFissures.length = 0;
      this.state.players.forEach((player, id) => {
        const c = this.combat.get(id);
        player.ultFamily = UltimateFamily.Locked;
        player.ultVariant = "";
        player.ultArchetype = 0;
        player.ultCharge = 0;
        player.ultPhase = UltimatePhase.Idle;
        player.ultSeq = 0;
        player.ultStartTick = 0;
        player.ultResolveTick = 0;
        player.ultEndTick = 0;
        player.ultTargetX = 0;
        player.ultTargetY = 0;
        if (c) {
          c.ultChargeF = 0;
          c.ultBuffer = 0;
          c.ultAccrualThisTick = 0;
          c.ult = undefined;
          this.commitWeaponResourceTick(player, c);
        }
      });
      return;
    }
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
          )
            this.beginUltimate(player, c, ult);
          if (player.ultPhase === UltimatePhase.Active) {
            if (ult.family === UltimateFamily.Seismarch) this.stepSeismarch(player, c, ult);
            else if (ult.family === UltimateFamily.AlphaStrike)
              this.stepAlphaStrike(player, c, ult);
            else if (ult.family === UltimateFamily.EventHorizon)
              this.stepEventHorizon(player, c, ult);
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
  },

  /** Publish one authoritative player-attack acceptance edge. Damage/cooldown behavior remains elsewhere. */
  stampAttackBeat(this: GameRoomContext, player: PlayerState): void {
    player.attackSeq = (player.attackSeq + 1) >>> 0;
    player.attackTick = this.state.tick;
    player.attackHeld = true;
    this.recordPetAcceptedAction(player.id);
  },

  /** Prospective solo combo beat for generated katana hooks, using the presentation chain law. */
  nextSoloMeleeBeat(this: GameRoomContext,
    player: PlayerState,
    c: CombatState,
    weapon: WeaponDef,
    expectedInterval: number,
  ): {
    step: number;
    length: number;
    family: MeleeComboFamily;
    continued: boolean;
    gapRatio: number;
  } {
    const selection = meleeComboSelectionFor(weapon);
    const family = selection?.family ?? "arc";
    const length = Math.max(1, selection?.sequence.length ?? 1);
    const acceptedAtMs = this.state.tick * TICK_MS;
    const attackSeq = (player.attackSeq + 1) >>> 0;
    const continued =
      c.soloComboSeq !== undefined &&
      (attackSeq - c.soloComboSeq) >>> 0 === 1 &&
      c.soloComboId === weapon.id &&
      c.soloComboFamily === family &&
      acceptedAtMs >= c.soloComboAcceptedAtMs &&
      acceptedAtMs <= c.soloComboExpiresAtMs;
    const step = comboStepForChain(
      attackSeq,
      acceptedAtMs,
      weapon.id,
      family,
      length,
      c.soloComboSeq,
      c.soloComboAcceptedAtMs,
      c.soloComboId,
      c.soloComboSeq === undefined ? undefined : c.soloComboFamily,
      c.soloComboStep,
      c.soloComboExpiresAtMs,
    );
    const gapMs = acceptedAtMs - c.soloComboAcceptedAtMs;
    return {
      step,
      length,
      family,
      continued,
      gapRatio: continued ? gapMs / Math.max(1, expectedInterval * 1000) : Number.POSITIVE_INFINITY,
    };
  },

  recordSoloMeleeBeat(this: GameRoomContext,
    player: PlayerState,
    c: CombatState,
    weapon: WeaponDef,
    family: MeleeComboFamily,
    step: number,
    interval: number,
  ): void {
    const acceptedAtMs = this.state.tick * TICK_MS;
    const graceMs = meleeComboGraceMs(interval, meleeComboSelectionFor(weapon)?.sequence);
    c.soloComboSeq = player.attackSeq;
    c.soloComboAcceptedAtMs = acceptedAtMs;
    c.soloComboId = weapon.id;
    c.soloComboFamily = family;
    c.soloComboStep = step;
    c.soloComboExpiresAtMs = acceptedAtMs + interval * 1000 + graceMs;
  },

  /** Fire one weapon swing (§20 WYSIWYG). The EDGE is registered as a SWEPT BLADE (`stepMeleeSwings` sweeps
   *  it across `swingArc` and damages each enemy the blade actually crosses — #2/#5/#6); the secondary
   *  LAYERS (chain / quake / scatter) fire here at the swing moment, each an independent position-based
   *  source ("layered like the Wyrmtooth"). Each layer uses its authored flat damage. */
  /** Resolve one accepted attack for the single weapon equipped in the active slot. */
  resolveSingleWeaponAttack(this: GameRoomContext, player: PlayerState, c: CombatState): boolean {
    const weapon = WEAPONS[player.weapon];
    if (!weapon) return false;
    const cadenceMult =
      lootCooldownMult(player.weaponAffix) * this.weaponRecoveryMult(player, weapon);
    const soloCooldown = weaponAttackCooldown(weapon) * cadenceMult;
    const melee =
      weapon.suppressMeleeHitbox !== true && !weapon.gun && !weapon.thrown && !weapon.cast;
    const soloBeat = melee ? this.nextSoloMeleeBeat(player, c, weapon, soloCooldown) : undefined;
    const authoritativeComboStep =
      weaponUsesAuthoritativeEnvelopeCombo(weapon) && soloBeat
        ? meleeComboSelectionFor(weapon)?.sequence[soloBeat.step]
        : undefined;
    const katanaEffect =
      melee && soloBeat
        ? katanaBeatEffectFor(
            weapon,
            soloBeat.step,
            soloBeat.length,
            soloBeat.continued,
            soloBeat.gapRatio,
          )
        : undefined;
    c.attackBuffer = 0;
    const interval = effectiveAcceptedWeaponInterval(weapon, soloCooldown);
    const delivery = weapon.gun
      ? CombatDelivery.Gun
      : weapon.thrown
        ? CombatDelivery.Thrown
        : weapon.cast
          ? CombatDelivery.Cast
          : CombatDelivery.Melee;
    const instanceId = player.slots[player.activeSlot]?.instanceId || weapon.id;
    if (
      !this.trySpendWeaponResource(
        player,
        c,
        weapon,
        instanceId,
        delivery,
        0,
        interval,
        1,
        0,
        "tap",
      ).accepted
    )
      return false;
    this.stampAttackBeat(player);

    if (weapon.gun) {
      this.fireGun(player, c, weapon, 0);
      this.armGunBurst(c, weapon, 0);
      c.cd += soloCooldown;
    } else if (weapon.thrown) {
      this.throwWeapon(player, c, weapon, 0);
      c.cd = soloCooldown;
    } else if (weapon.cast) {
      this.fireCast(player, c, weapon, 0);
      c.cd = soloCooldown;
    } else {
      const swing = swingDescriptorFor(weapon, soloCooldown);
      this.resolveSwing(
        player,
        c,
        weapon,
        swing,
        0,
        katanaEffect,
        authoritativeComboStep,
        soloBeat ? { step: soloBeat.step, length: soloBeat.length } : undefined,
      );
      c.cd = soloCooldown;
      if (soloBeat)
        this.recordSoloMeleeBeat(player, c, weapon, soloBeat.family, soloBeat.step, soloCooldown);
    }
    return true;
  },

  resolveSwing(this: GameRoomContext,
    player: PlayerState,
    c: CombatState,
    weapon: WeaponDef,
    swing: SwingDescriptor,
    hand: WeaponHand = 0,
    katanaEffect?: KatanaBeatEffect,
    comboStep?: Readonly<MeleeComboStep>,
    hybridBeat?: Readonly<{ step: number; length: number }>,
  ): void {
    const attackCrit = this.weaponCritChance(player, c);
    // Every authored damage source keeps its own flat damage and shares only non-stat held modifiers.
    const edgePower = this.heldDamageMult(weapon, player, hand);
    const aim0 = Math.atan2(c.aimY, c.aimX);
    const envelope = meleeDamageEnvelopeFor(weapon);
    const comboSwing = comboStep
      ? {
          ...swing,
          activeStartSeconds: comboStep.timing.activeStart * swing.poseSeconds,
          activeEndSeconds: comboStep.timing.activeEnd * swing.poseSeconds,
          impactSeconds:
            (comboStep.timing.impact ?? comboStep.timing.activeEnd) * swing.poseSeconds,
          motion: comboStep.motion,
        }
      : swing;
    const rapidImpactSeconds = weapon.rapidThrust?.impacts.map(
      (fraction) => fraction * comboSwing.poseSeconds,
    );
    const rapidFirstImpact = rapidImpactSeconds?.[0];
    const rapidLastImpact = rapidImpactSeconds?.[rapidImpactSeconds.length - 1];
    const authoritativeSwing =
      rapidFirstImpact !== undefined && rapidLastImpact !== undefined
        ? {
            ...comboSwing,
            activeStartSeconds: rapidFirstImpact,
            activeEndSeconds: Math.min(
              comboSwing.poseSeconds,
              rapidLastImpact + Math.max(0.04, comboSwing.poseSeconds * 0.08),
            ),
            impactSeconds: rapidLastImpact,
          }
        : comboSwing;
    const authoritativeArc = comboStep
      ? (comboStep.path.deltaAngle ?? weapon.swingArc * comboStep.path.arcMultiplier)
      : weapon.swingArc;
    // Register the swept edge on the accepted descriptor. Slow active seconds can exceed the old 180ms cap,
    // but BALANCE/DPS does not multiply: cooldown + edgeDamage + arc coverage are unchanged and `hit` still
    // admits each enemy exactly once per accepted swing. Replaces any in-flight swing; pose ≤ cooldown.
    const swingKey = player.id;
    const rangeMultiplier =
      (comboStep?.path.rangeMultiplier ?? 1) * (katanaEffect?.reachMultiplier ?? 1);
    const reach = envelope.maxReach * rangeMultiplier;
    if (weapon.suppressMeleeHitbox !== true)
      this.meleeSwings.set(swingKey, {
        playerId: player.id,
        swing: authoritativeSwing,
        aim0,
        range: reach,
        swingArc: authoritativeArc,
        halfWidth: envelope.maxHalfWidth,
        rangeMultiplier,
        timedWeaponEnvelope: true,
        edgeDamage:
          weapon.damage *
          edgePower *
          (katanaEffect?.damageMultiplier ?? 1) *
          (comboStep && weapon.glovePair?.wrapsFeet === true
            ? comboStep.path.damageMultiplier
            : 1) *
          (weapon.rapidThrust?.damageMultiplier ?? 1),
        toughDamageMultiplier: katanaEffect?.toughDamageMultiplier ?? 1,
        weaponId: weapon.id,
        crit: attackCrit,
        hitStatus: weapon.hitStatus,
        elapsed: 0,
        hit: new Set<string>(),
        ...(rapidImpactSeconds
          ? {
              rapidImpactSeconds,
              rapidHitIndex: 0,
            }
          : {}),
      });

    if (hand === 0)
      // Movement runs before attack acceptance, while a sub-tick active envelope can age out later in
      // this same 20 Hz step. Preserve B33's modest attack-input slow for the following movement tick.
      this.minimumAttackInputSlowUntilTick.set(player.id, (this.state.tick + 2) >>> 0);

    if (katanaEffect?.invulnerabilitySeconds)
      c.invuln = Math.max(c.invuln, katanaEffect.invulnerabilitySeconds);
    if (katanaEffect?.burstRadius && katanaEffect.burstDamage) {
      this.detonate(
        player.x,
        player.y,
        katanaEffect.burstRadius,
        katanaEffect.burstDamage * edgePower,
        attackCrit,
        player.id,
        weapon.id,
        CombatDelivery.Melee,
      );
    }

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
        this.wormSegmentGrid.queryRadius(
          player.x,
          player.y,
          reach + 52,
          this.wormSegmentCandidates,
        );
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
        const clPower = this.heldDamageMult(weapon, player, hand);
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
    // the shared `detonate` (same kill/money/portal bookkeeping). The client matches the epicentre via the
    // SAME shared clampQuakeEpicenter. §44 the descriptor's 52% impact is relative to this accepted epoch;
    // the client predicts the identical effective-cooldown descriptor at send. A later accepted-swing seq is
    // still required to remove the residual network/buffer epoch offset — no protocol expansion in this P0.
    if (weapon.quake) {
      const qPower = this.heldDamageMult(weapon, player, hand);
      const zoneDamagePerSecond =
        weapon.groundZone?.trigger === "impact"
          ? weapon.groundZone.damagePerSecond * this.heldDamageMult(weapon, player, hand)
          : undefined;
      const ep = clampQuakeEpicenter(
        player,
        { x: c.targetX, y: c.targetY },
        weapon.quake.placementRange ?? QUAKE_REACH,
      );
      this.pendingQuakes.push({
        t: swing.impactSeconds,
        x: ep.x,
        y: ep.y,
        radius: weapon.quake.radius,
        damage: weapon.quake.damage * qPower,
        crit: attackCrit,
        sourcePlayerId: player.id,
        sourceWeaponId: weapon.id,
        zoneDamagePerSecond,
      });
    }

    // Scatter shot (§14 WYSIWYG): fling real magma projectiles with flat authored hit/blast damage.
    // Fired as live projectiles (server-authoritative) — they advance + detonate ON CONTACT in
    // stepProjectiles, so the secondary VFX damage where it actually touches an enemy (#6).
    if (weapon.scatter)
      this.fireScatter(
        player,
        c,
        weapon,
        hand,
        weapon.effectTiming !== undefined
          ? weaponEffectCueSeconds(weapon, swing)
          : weapon.performance?.vfxAt === "impact"
            ? swing.impactSeconds
            : 0,
        swing,
      );

    // §6 REZ (Gravedigger's Spade): the swing REVIVES the nearest downed ally within range (at 30% HP).
    const hybrid = weapon.hybridProjectile;
    const hybridTriggerAccepted =
      hybridBeat !== undefined &&
      (hybrid?.trigger === "each-swing" ||
        (hybrid?.trigger === "combo-finisher" &&
          hybridBeat.step === hybridBeat.length - 1 &&
          hybridBeat.length === hybrid.comboLength));
    if (hybrid && hybridTriggerAccepted) {
      this.pendingHybridProjectiles.push({
        t: authoritativeSwing.impactSeconds,
        playerId: player.id,
        weaponId: weapon.id,
        aimX: Math.cos(aim0),
        aimY: Math.sin(aim0),
        damage: hybrid.damage * this.heldDamageMult(weapon, player, hand),
        crit: attackCrit,
      });
    }

    if (weapon.rez) this.tryRez(player, weapon.rez.radius);
  },

  /** §6 try to revive the nearest DOWNED ally within `radius` of the rezzer (the swing's rez effect). The
   *  ally comes back at `REVIVE_HP_FRAC` of max HP, WHERE THEY FELL, with the spawn pile cleared so they
   *  don't instantly re-down; `revivedSeq` bumps the client's revive VFX. One rez per swing. */
  tryRez(this: GameRoomContext, rezzer: PlayerState, radius: number): void {
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
    // uncommanded for ~100ms on the first tick back, feeding that tick's boundary checks.
    this.zeroMoveVel(ally.id, undefined, "revive-placement");
    const reviveHpFraction = petMods?.reviveHpFraction || REVIVE_HP_FRAC;
    ally.hp = Math.max(1, Math.round(ally.maxHp * reviveHpFraction));
    ally.revivedSeq = (ally.revivedSeq + 1) % 100000;
    this.vastagharDownTicks.delete(ally.id);
    this.clearEnemiesNear(ally.x, ally.y, RESPAWN_CLEAR_RADIUS);
    this.recordPetAcceptedAction(rezzer.id);
  },

  /** §20/§44 advance accepted descriptor time, sweeping only while the unchanged pose envelope is dangerous.
   *  A tick may cross wind-up, the whole fast active interval, or recovery; clamped progress preserves full
   *  arc supersampling and hit-once coverage in every case. The live player position still anchors the edge. */
  /** Input held-state with the three-tick disconnect/stall watchdog applied. */
  beamHeld(this: GameRoomContext, id: string): boolean {
    const input = this.inputs.get(id);
    if (!input?.held.fireHeld) return false;
    return (this.state.tick - input.lastFreshFireTick) >>> 0 < BEAM_STALE_INPUT_TICKS;
  },

  /** Hold starts one immutable server clock; release snapshots the curve into one real projectile. */
  stepPlayerChargedProjectile(this: GameRoomContext,
    player: PlayerState,
    id: string,
    c: CombatState,
    weapon: WeaponDef,
    acting: boolean,
  ): void {
    const definition = weapon.chargedProjectile;
    if (!definition) return;
    const held = this.beamHeld(id);
    const active =
      player.weaponChargeActive && c.chargedProjectileWeaponId === weapon.id;

    if (!acting) {
      c.chargedProjectileInputWasHeld = held;
      c.chargedProjectileWeaponId = "";
      c.chargedProjectileStartTick = 0;
      player.weaponChargeActive = false;
      player.weaponChargeStartTick = 0;
      return;
    }

    if (!active && held && c.cd <= 0 && c.drawLock <= 0) {
      c.chargedProjectileWeaponId = weapon.id;
      c.chargedProjectileStartTick = this.state.tick;
      player.weaponChargeActive = true;
      player.weaponChargeStartTick = this.state.tick;
      c.chargedProjectileInputWasHeld = true;
      return;
    }

    if (active && held) {
      c.chargedProjectileInputWasHeld = true;
      return;
    }

    // A stale heartbeat is not a release edge. Keep the immutable charge clock alive while the last
    // accepted command still says "held"; only an accepted false command may launch the projectile.
    // This prevents a brief renderer/network stall from manufacturing a shot at an unintended size.
    if (active && this.inputs.get(id)?.held.fireHeld === true) {
      c.chargedProjectileInputWasHeld = true;
      return;
    }

    if (active && !held) {
      const heldSeconds =
        (((this.state.tick - c.chargedProjectileStartTick) >>> 0) * TICK_MS) / 1000;
      const fraction = chargedProjectileFraction(heldSeconds, definition);
      const cooldown =
        weapon.cooldown *
        lootCooldownMult(player.weaponAffix) *
        this.weaponRecoveryMult(player, weapon);
      const interval = definition.chargeSeconds + cooldown;
      const instanceId = player.slots[player.activeSlot]?.instanceId || weapon.id;
      const spend = this.trySpendWeaponResource(
        player,
        c,
        weapon,
        instanceId,
        CombatDelivery.Cast,
        0,
        interval,
        1,
        0,
        "tap",
      );
      if (spend.accepted) {
        this.stampAttackBeat(player);
        this.fireChargedProjectile(player, c, weapon, fraction);
        c.cd = cooldown;
      }
      c.chargedProjectileWeaponId = "";
      c.chargedProjectileStartTick = 0;
      player.weaponChargeActive = false;
      player.weaponChargeStartTick = 0;
    }
    c.chargedProjectileInputWasHeld = held;
  },

  fireChargedProjectile(this: GameRoomContext,
    player: PlayerState,
    c: CombatState,
    weapon: WeaponDef,
    fraction: number,
  ): void {
    const definition = weapon.chargedProjectile;
    if (!definition) return;
    const release = chargedProjectileSnapshot(definition, fraction);
    const aim = this.aimDir(player, c);
    const source = weapon.muzzle
      ? weaponMuzzleWorldPoint(
          weapon,
          {
            x: player.x,
            y: player.y,
            aimX: aim.x,
            aimY: aim.y,
            facing: aim.x < 0 ? -1 : 1,
            renderScale: characterScale(player.character),
          },
          player.attackSeq,
        )
      : {
          x: player.x + aim.x * weapon.displayLength * 0.5,
          y: player.y + aim.y * weapon.displayLength * 0.5,
        };
    const damageMultiplier = this.heldDamageMult(weapon, player);
    const radius = definition.baseRadius * release.visualScale;
    const rimechoir = weapon.id === "x2-rimechoir-chime-rack";
    this.fireProjectile(
      source,
      { x: source.x + aim.x, y: source.y + aim.y },
      definition.speed,
      release.directDamage * damageMultiplier,
      false,
      rimechoir ? "rimechoir-pressure-wedge" : "emberleaf-fireball",
      1,
      definition.range / definition.speed,
      {
        radius: release.explosionRadius,
        damage: release.explosionDamage * damageMultiplier,
      },
      0,
      this.weaponCritChance(player, c),
      player.id,
      weapon.id,
      CombatDelivery.Cast,
      { x: player.x, y: player.y },
      undefined,
      undefined,
      undefined,
      0,
      undefined,
      { shape: "capsule", radius, halfLength: rimechoir ? radius * 1.5 : 0 },
      release.visualScale,
    );
  },

  /** Server-authoritative character-centered aura. Drive pays the authored net drain every fixed step;
   * damage receives only the funded fraction of the final step and the channel release-locks at empty. */
  stepPlayerAura(this: GameRoomContext,
    player: PlayerState,
    id: string,
    c: CombatState,
    weapon: WeaponDef,
    dt: number,
    acting: boolean,
  ): void {
    const aura = weapon.performance?.aura;
    if (!aura) return;
    const held = this.beamHeld(id);
    const rising = held && !c.auraInputWasHeld;
    if (!held) {
      c.auraActive = false;
      c.auraRequireRelease = false;
      c.auraPulseT = 0;
      c.auraInputWasHeld = false;
      return;
    }
    if (!acting || c.auraRequireRelease || (!c.auraActive && !rising)) {
      c.auraActive = false;
      c.auraInputWasHeld = held;
      return;
    }

    const instanceId = player.slots[player.activeSlot]?.instanceId || weapon.id;
    const spend = this.trySpendWeaponResource(
      player,
      c,
      weapon,
      instanceId,
      CombatDelivery.Aura,
      0,
      dt,
      1,
      dt,
      "aura-active",
    );
    if (!spend.accepted) {
      c.auraActive = false;
      c.auraRequireRelease = true;
      c.auraPulseT = 0;
      player.attackHeld = false;
      c.auraInputWasHeld = held;
      return;
    }

    if (!c.auraActive) {
      c.auraActive = true;
      c.auraPulseT = 0;
      c.auraCrit = this.weaponCritChance(player, c);
      this.stampAttackBeat(player);
    } else {
      player.attackTick = this.state.tick;
      player.attackHeld = true;
    }
    const regenPerSecond = dt > 0 ? c.drive.tickCreditF / dt : 0;
    const fundedDt = Math.min(
      dt,
      spend.debit / Math.max(1e-9, aura.resourcePerSecond + regenPerSecond),
    );
    const damagePerSecond = aura.damagePerSecond * this.heldDamageMult(weapon, player);
    c.auraPulseT += fundedDt;
    while (c.auraPulseT + 1e-9 >= aura.tickRate) {
      c.auraPulseT -= aura.tickRate;
      this.detonate(
        player.x,
        player.y,
        aura.radius,
        damagePerSecond * aura.tickRate,
        c.auraCrit,
        player.id,
        weapon.id,
        CombatDelivery.Aura,
      );
    }
    if (spend.beamEmpty) {
      if (c.auraPulseT > 1e-9) {
        this.detonate(
          player.x,
          player.y,
          aura.radius,
          damagePerSecond * c.auraPulseT,
          c.auraCrit,
          player.id,
          weapon.id,
          CombatDelivery.Aura,
        );
      }
      c.auraActive = false;
      c.auraRequireRelease = true;
      c.auraPulseT = 0;
      player.attackHeld = false;
    }
    c.auraInputWasHeld = held;
  },

  /** Clamp a server-owned placement to the last unobstructed point on its accepted segment. */
  navValidMotionDest(this: GameRoomContext,
    player: PlayerState,
    combat: CombatState,
    targetX: number,
    targetY: number,
    maxRange: number,
  ): Vec2 {
    const destination = this.navValidDest(player, combat, targetX, targetY, maxRange);
    if (this.belt && this.beltLevel) return destination;
    const dx = destination.x - player.x;
    const dy = destination.y - player.y;
    const distance = Math.hypot(dx, dy);
    const samples = Math.max(1, Math.ceil(distance / 2));
    let safeX = player.x;
    let safeY = player.y;
    for (let sample = 1; sample <= samples; sample++) {
      const progress = sample / samples;
      const x = player.x + dx * progress;
      const y = player.y + dy * progress;
      if (isLavaGapAtPx(this.map, x, y)) break;
      safeX = x;
      safeY = y;
    }
    return { x: safeX, y: safeY };
  },

  playerAttackMoveMode(this: GameRoomContext, playerId: string, dt: number): number {
    const minimumSlowUntilTick = this.minimumAttackInputSlowUntilTick.get(playerId);
    if (minimumSlowUntilTick !== undefined) {
      if (!tickReached(this.state.tick, minimumSlowUntilTick))
        return PlayerAttackMoveMode.InputSlow;
      this.minimumAttackInputSlowUntilTick.delete(playerId);
    }
    for (const swing of this.meleeSwings.values()) {
      if (swing.playerId !== playerId) continue;
      const activeStart = swing.swing.activeStartSeconds;
      const activeEnd = swing.swing.activeEndSeconds;
      if (swing.elapsed < activeEnd && swing.elapsed + dt + 1e-9 >= activeStart) {
        return PlayerAttackMoveMode.InputSlow;
      }
    }
    return PlayerAttackMoveMode.Normal;
  },

  zoneTarget(this: GameRoomContext, player: PlayerState, c: CombatState, placementRange: number): Vec2 {
    const dx = c.targetX - player.x;
    const dy = c.targetY - player.y;
    const length = Math.hypot(dx, dy);
    const scale = length > placementRange && length > 0 ? placementRange / length : 1;
    let x = player.x + dx * scale;
    let y = player.y + dy * scale;
    if (this.belt && this.beltLevel) {
      x = clamp(x, 0, ARENA_WIDTH);
      y = clampBeltFloorY(this.beltLevel, x, y);
    } else {
      const safe = safeSpawnPos(this.map, x, y);
      x = safe.x;
      y = safe.y;
    }
    return { x, y };
  },

  /** Hold-to-grow authority. One ZoneState row changes only its radius; input remains the normal heartbeat. */
  stepPlayerGroundZone(this: GameRoomContext,
    player: PlayerState,
    id: string,
    c: CombatState,
    weapon: WeaponDef,
    dt: number,
    acting: boolean,
  ): void {
    const def = weapon.groundZone;
    if (!def || def.trigger !== "channel") return;
    const held = this.beamHeld(id);
    const wasHeld = this.groundZoneInputWasHeld.get(id) ?? false;
    let zoneId = this.activeGroundZones.get(id);
    if (!acting || !held) {
      this.activeGroundZones.delete(id);
      this.groundZoneInputWasHeld.set(id, held);
      return;
    }
    if (!zoneId && held && !wasHeld) {
      const instanceId = player.slots[player.activeSlot]?.instanceId || weapon.id;
      const ignition = this.trySpendWeaponResource(
        player,
        c,
        weapon,
        instanceId,
        CombatDelivery.Zone,
        0,
        BEAM_RECOVERY_SECONDS,
        1,
        0,
        "beam-ignite",
      );
      if (ignition.accepted) {
        const target = this.zoneTarget(player, c, def.placementRange);
        const zone = this.spawnWeaponGroundZoneAt(
          player,
          weapon,
          target.x,
          target.y,
          def.damagePerSecond * this.heldDamageMult(weapon, player),
          this.weaponCritChance(player, c),
        );
        zoneId = zone?.id;
        if (zoneId) {
          this.activeGroundZones.set(id, zoneId);
          this.stampAttackBeat(player);
        }
      }
    }
    if (zoneId) {
      const zone = this.state.zones.get(zoneId);
      const meta = this.zoneMeta.get(zoneId);
      const instanceId = player.slots[player.activeSlot]?.instanceId || weapon.id;
      const spend = this.trySpendWeaponResource(
        player,
        c,
        weapon,
        instanceId,
        CombatDelivery.Zone,
        0,
        dt,
        1,
        dt,
        "beam-active",
      );
      if (!zone || !meta || !spend.accepted) {
        this.activeGroundZones.delete(id);
      } else {
        zone.radius = Math.min(def.maxRadius, zone.radius + def.growthPerSecond * dt);
        meta.refreshedTick = this.state.tick;
      }
    }
    this.groundZoneInputWasHeld.set(id, held);
  },

  /** Charge → authoritative ignition → sustained swept damage → recovery/overheat. */
  clearBeamRows(this: GameRoomContext, ownerId: string, satellitesOnly = false): void {
    const keys: string[] = [];
    this.state.beams.forEach((row, key) => {
      if (row.ownerId === ownerId && (!satellitesOnly || key !== ownerId)) keys.push(key);
    });
    for (const key of keys) this.state.beams.delete(key);
  },

  beamSatelliteCount(this: GameRoomContext): number {
    let count = 0;
    this.state.beams.forEach((row, key) => {
      if (key !== row.ownerId) count++;
    });
    return count;
  },

  stepPlayerBeam(this: GameRoomContext,
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
      else this.clearBeamRows(id);
      c.beamInputWasHeld = held;
      c.beamTeleportSeq = player.teleportSeq;
      return;
    }

    if (
      c.beamPhase === 0 &&
      rising &&
      c.drawLock <= 0 &&
      (c.drive.beamLockEndTick === 0 || tickReached(this.state.tick, c.drive.beamLockEndTick)) &&
      (c.drive.beamRecoveryEndTick === 0 ||
        tickReached(this.state.tick, c.drive.beamRecoveryEndTick)) &&
      !c.drive.beamRequireRelease &&
      this.drivePendingValue(player, c) + 1e-9 >= DRIVE_BEAM_RESTART_THRESHOLD
    ) {
      const classDamage =
        weapon.tags.classPool === "caster"
          ? 1 + AUG_CAST_DMG_PER * countAugment(player.augments, "overcharge")
          : 1;
      c.beamDescriptor = beamDescriptorFor(
        weapon,
        this.state.tick,
        input.held.fireStartSeq || input.held.seq,
        this.heldDamageMult(weapon, player) * classDamage,
        lootCooldownMult(player.weaponAffix) * this.weaponRecoveryMult(player, weapon),
        1 + AUG_BEAM_FOCUS_PER * c.beamFocusStacks,
      );
      // Charging owns one primary row. The satellite budget is admitted atomically at ignition so several
      // simultaneous Prism-Lantern charges cannot all reserve the same room capacity.
      c.beamRayOffsets = [0];
      c.beamMuzzlePointIndices = [0];
      c.beamPreviousOriginsX = [player.x];
      c.beamPreviousOriginsY = [player.y];
      c.beamCurrentOriginsX = [player.x];
      c.beamCurrentOriginsY = [player.y];
      c.beamPreviousLengths = [0];
      c.beamCurrentLengths = [0];
      c.beamPhase = 1;
      c.beamPhaseT = 0;
      c.beamChannelT = 0;
      c.beamPulseT = 0;
      c.beamQuantumT = 0;
      c.beamPendingDamage.clear();
      c.beamAngle = Math.atan2(c.aimY, c.aimX);
      c.beamPreviousAngle = c.beamAngle;
      const muzzle = this.writeBeamMuzzle(
        player,
        weapon.id,
        c.beamAngle,
        c.beamMuzzlePointIndices[0],
      );
      c.beamPreviousX = muzzle.x;
      c.beamPreviousY = muzzle.y;
      c.beamPreviousOriginsX[0] = muzzle.x;
      c.beamPreviousOriginsY[0] = muzzle.y;
      c.beamPreviousLength = this.clipBeamLength(
        c.beamPreviousX,
        c.beamPreviousY,
        c.beamAngle,
        c.beamDescriptor.range,
        c.beamDescriptor.width / 2,
      );
      for (let ray = 0; ray < c.beamRayOffsets.length; ray++) {
        c.beamPreviousLengths[ray] = this.clipBeamLength(
          c.beamPreviousX,
          c.beamPreviousY,
          c.beamAngle + (c.beamRayOffsets[ray] ?? 0),
          c.beamDescriptor.range,
          c.beamDescriptor.width / 2,
        );
      }
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
        c.beamPreviousOriginsX[0] = chargeRow.originX;
        c.beamPreviousOriginsY[0] = chargeRow.originY;
        c.beamPreviousAngle = c.beamAngle;
        c.beamPreviousLength = this.clipBeamLength(
          chargeRow.originX,
          chargeRow.originY,
          c.beamAngle,
          descriptor.range,
          descriptor.width / 2,
        );
        for (let ray = 0; ray < c.beamRayOffsets.length; ray++) {
          c.beamPreviousLengths[ray] = this.clipBeamLength(
            chargeRow.originX,
            chargeRow.originY,
            c.beamAngle + (c.beamRayOffsets[ray] ?? 0),
            descriptor.range,
            descriptor.width / 2,
          );
        }
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
            const fixedMuzzleCount = weapon.muzzle?.points.length ?? 1;
            const fixedMuzzles = fixedMuzzleCount > 1 ? weapon.muzzle?.points : undefined;
            const randomRays = fixedMuzzles ? undefined : weapon.beam.randomRays;
            const authoredCount = fixedMuzzles?.length ?? randomRays?.count ?? 1;
            const admittedCount = admittedPrismaticBeamRayCount(
              authoredCount,
              this.beamSatelliteCount(),
            );
            c.beamRayOffsets = randomRays
              ? prismaticBeamRayOffsets(admittedCount, randomRays.spread, descriptor.startSeq)
              : new Array(admittedCount).fill(0);
            c.beamMuzzlePointIndices = fixedMuzzles?.length
              ? Array.from({ length: admittedCount }, (_, index) => index)
              : new Array(admittedCount).fill(0);
            c.beamPreviousOriginsX = new Array(admittedCount);
            c.beamPreviousOriginsY = new Array(admittedCount);
            c.beamCurrentOriginsX = new Array(admittedCount);
            c.beamCurrentOriginsY = new Array(admittedCount);
            c.beamPreviousLengths = new Array(c.beamRayOffsets.length);
            c.beamCurrentLengths = new Array(c.beamRayOffsets.length).fill(0);
            for (let ray = 0; ray < c.beamRayOffsets.length; ray++) {
              const rayMuzzle = this.writeBeamMuzzle(
                player,
                descriptor.weaponId,
                c.beamAngle,
                c.beamMuzzlePointIndices[ray],
              );
              c.beamPreviousOriginsX[ray] = rayMuzzle.x;
              c.beamPreviousOriginsY[ray] = rayMuzzle.y;
              c.beamPreviousLengths[ray] = this.clipBeamLength(
                rayMuzzle.x,
                rayMuzzle.y,
                c.beamAngle + (c.beamRayOffsets[ray] ?? 0),
                descriptor.range,
                descriptor.width / 2,
              );
            }
            c.beamPreviousX = c.beamPreviousOriginsX[0] ?? c.beamPreviousX;
            c.beamPreviousY = c.beamPreviousOriginsY[0] ?? c.beamPreviousY;
            c.beamPreviousLength = c.beamPreviousLengths[0] ?? c.beamPreviousLength;
            c.drive.beamLockEndTick = 0;
            c.drive.beamRecoveryEndTick = 0;
            this.stampAttackBeat(player);
            c.beamPhase = 2;
            c.beamPhaseT = 0;
            c.beamChannelT = 0;
            c.beamPulseT = 0;
            c.beamQuantumT = 0;
            c.beamCrit = this.weaponCritChance(player, c);
            if (weapon.groundZone?.trigger === "attack") {
              const target = this.zoneTarget(player, c, weapon.groundZone.placementRange);
              this.spawnWeaponGroundZoneAt(
                player,
                weapon,
                target.x,
                target.y,
                weapon.groundZone.damagePerSecond * this.heldDamageMult(weapon, player),
                c.beamCrit,
              );
            }
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
  },

  stepActiveBeam(this: GameRoomContext,
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
    this.applyWeaponFireRecoil(
      player,
      Math.cos(c.beamAngle),
      Math.sin(c.beamAngle),
      (weapon.recoil ?? 0) * dt,
    );
    const length = this.damageBeamSweep(player, c, descriptor, dt);
    c.beamChannelT += dt;
    for (let ray = 0; ray < c.beamRayOffsets.length; ray++)
      this.syncBeamRow(
        player,
        id,
        c,
        descriptor,
        BeamPhase.Active,
        c.beamCurrentLengths[ray] ?? length,
        1,
        ray,
      );
    c.beamPreviousX = this.beamCurrentX;
    c.beamPreviousY = this.beamCurrentY;
    c.beamPreviousAngle = c.beamAngle;
    c.beamPreviousLength = this.beamCurrentLength;
    for (let ray = 0; ray < c.beamRayOffsets.length; ray++) {
      c.beamPreviousOriginsX[ray] = c.beamCurrentOriginsX[ray] ?? this.beamCurrentX;
      c.beamPreviousOriginsY[ray] = c.beamCurrentOriginsY[ray] ?? this.beamCurrentY;
      c.beamPreviousLengths[ray] = c.beamCurrentLengths[ray] ?? length;
    }
    if (spend.beamEmpty) this.finishBeam(player, id, c, true);
  },

  finishBeam(this: GameRoomContext, player: PlayerState, id: string, c: CombatState, overheated: boolean): void {
    this.flushBeamDamage(c, false, id);
    c.beamPhase = 0;
    c.beamPhaseT = 0;
    c.beamChannelT = 0;
    c.beamPulseT = 0;
    c.beamQuantumT = 0;
    if (overheated) {
      const lockSeconds = (c.beamDescriptor?.lockSeconds ?? 1.5) * c.mods.beamOverheatLockMult;
      c.drive.beamLockEndTick =
        (this.state.tick + Math.ceil((lockSeconds * 1000) / TICK_MS - 1e-9)) >>> 0;
      // Keep the whole old 30-lock + 38-cool rhythm on floor recovery. Otherwise a recent pressure receipt
      // would add the engaged bonus after the minimum lock and restart earlier than the learned 68th tick.
      c.drive.recoveryDebtF = Math.max(
        c.drive.recoveryDebtF,
        lockSeconds,
        (this.beamEmptyRecoveryTicks(c) * TICK_MS) / 1000,
      );
      c.drive.beamRequireRelease = true;
    } else {
      const recoveryMultiplier = (1 + AUG_BEAM_COOL_PER * c.beamVentStacks) * c.mods.beamVentMult;
      c.drive.beamRecoveryEndTick =
        (this.state.tick +
          Math.ceil(((BEAM_RECOVERY_SECONDS / recoveryMultiplier) * 1000) / TICK_MS - 1e-9)) >>>
        0;
    }
    const weapon = WEAPONS[player.weapon];
    if (weapon?.beam) this.syncRestingBeamRow(player, id, c, weapon);
    else this.clearBeamRows(id);
  },

  /** Hard cancellation for swaps/death/teleports/parry. Early/escape cancels pay the 20-heat commitment. */
  cancelBeam(this: GameRoomContext,
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
      const recoveryMultiplier = (1 + AUG_BEAM_COOL_PER * c.beamVentStacks) * c.mods.beamVentMult;
      c.drive.beamRecoveryEndTick =
        (this.state.tick +
          Math.ceil(((BEAM_RECOVERY_SECONDS / recoveryMultiplier) * 1000) / TICK_MS - 1e-9)) >>>
        0;
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
      this.clearBeamRows(id);
    } else if (descriptor && WEAPONS[player.weapon]?.beam) {
      this.syncRestingBeamRow(player, id, c, WEAPONS[player.weapon]!);
    }
  },

  syncRestingBeamRow(this: GameRoomContext,
    player: PlayerState,
    id: string,
    c: CombatState,
    weapon: WeaponDef,
  ): void {
    this.clearBeamRows(id, true);
    const lockActive =
      c.drive.beamLockEndTick !== 0 && !tickReached(this.state.tick, c.drive.beamLockEndTick);
    const recoveryActive =
      c.drive.beamRecoveryEndTick !== 0 &&
      !tickReached(this.state.tick, c.drive.beamRecoveryEndTick);
    const awaitingThreshold =
      c.drive.beamLockEndTick !== 0 &&
      this.drivePendingValue(player, c) + 1e-9 < DRIVE_BEAM_RESTART_THRESHOLD;
    if (!lockActive && !recoveryActive && !awaitingThreshold && !c.drive.beamRequireRelease) {
      this.clearBeamRows(id);
      if (c.beamPhase === 0) c.beamDescriptor = undefined;
      return;
    }
    const descriptor =
      c.beamDescriptor?.weaponId === weapon.id
        ? c.beamDescriptor
        : beamDescriptorFor(weapon, this.state.tick, 0, 1, 1);
    const overheated = lockActive || c.drive.beamRequireRelease;
    const spentFraction =
      1 - this.drivePendingValue(player, c) / relicEnergyCapacity(player.relics);
    this.syncBeamRow(
      player,
      id,
      c,
      descriptor,
      overheated ? BeamPhase.Overheated : BeamPhase.Cooling,
      c.beamPreviousLength,
      overheated ? 1 : spentFraction,
    );
  },

  syncBeamRow(this: GameRoomContext,
    player: PlayerState,
    id: string,
    c: CombatState,
    descriptor: BeamDescriptor,
    phase: number,
    length: number,
    intensity: number,
    rayIndex = 0,
  ): BeamState {
    const offset = c.beamRayOffsets[rayIndex] ?? 0;
    const fixedBarrels = (WEAPONS[descriptor.weaponId]?.muzzle?.points.length ?? 0) > 1;
    const rowKey =
      rayIndex === 0
        ? id
        : fixedBarrels
          ? `${id}:barrel:${rayIndex}`
          : `${id}:prism:${rayIndex}:${Math.round(offset * 1_000_000)}`;
    let row = this.state.beams.get(rowKey);
    if (!row) {
      row = new BeamState();
      row.ownerId = id;
      this.state.beams.set(rowKey, row);
    }
    if (row.phase !== phase) row.phaseStartTick = this.state.tick;
    const muzzle = this.writeBeamMuzzle(
      player,
      descriptor.weaponId,
      c.beamAngle,
      c.beamMuzzlePointIndices[rayIndex],
    );
    const originX = muzzle.x;
    const originY = muzzle.y;
    row.weaponId = descriptor.weaponId;
    row.seq = descriptor.startSeq;
    row.startSeq = descriptor.startSeq;
    row.phase = phase;
    row.originX = originX;
    row.originY = originY;
    row.previousAngle = c.beamPreviousAngle + offset;
    row.angle = c.beamAngle + offset;
    row.effectiveLength = length;
    row.length = length;
    row.width =
      descriptor.coneHalfAngle > 0
        ? Math.max(descriptor.width, 2 * length * Math.tan(descriptor.coneHalfAngle))
        : descriptor.width;
    row.halfWidth = row.width / 2;
    // Schema-30 compatibility alias only. Gameplay never reads this field; the shared bar is the heat.
    row.heat = 1 - this.drivePendingValue(player, c) / relicEnergyCapacity(player.relics);
    row.intensity = Math.max(0, Math.min(1, intensity));
    row.element = WEAPONS[descriptor.weaponId]?.tags.element ?? "physical";
    row.previousOriginX = c.beamPreviousOriginsX[rayIndex] ?? c.beamPreviousX;
    row.previousOriginY = c.beamPreviousOriginsY[rayIndex] ?? c.beamPreviousY;
    row.previousLength = c.beamPreviousLengths[rayIndex] ?? c.beamPreviousLength;
    if (this.state.beams.size > FRIENDLY_BEAM_ENTITY_CAP)
      throw new Error(`friendly beam entity cap exceeded: ${this.state.beams.size}`);
    return row;
  },

  /** Weapon-rooted beam origin. Every authoritative consumer calls this exact seam each fixed tick. */
  writeBeamMuzzle(this: GameRoomContext,
    player: PlayerState,
    weaponId: string,
    angle: number,
    pointIndex = 0,
  ): { x: number; y: number } {
    const weapon = WEAPONS[weaponId];
    if (!weapon?.muzzle) throw new Error(`Beam weapon ${weaponId} has no art-space muzzle`);
    const muzzles = weaponMuzzleWorldPointsForShot(
      weapon,
      {
        x: player.x,
        y: player.y,
        aimX: Math.cos(angle),
        aimY: Math.sin(angle),
        renderScale: characterScale(player.character),
      },
      1,
    );
    const muzzle = muzzles[pointIndex] ?? muzzles[0];
    if (!muzzle) throw new Error(`Beam weapon ${weaponId} resolved no muzzle point`);
    this.beamMuzzleScratch.x = muzzle.x;
    this.beamMuzzleScratch.y = muzzle.y;
    return this.beamMuzzleScratch;
  },

  /** Exact ray truncation against arena edges and colliding belt circles. */
  clipBeamLength(this: GameRoomContext,
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
    }
    return Math.max(0, Math.min(authoredRange, length));
  },

  rayCircleLength(this: GameRoomContext,
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
  },

  /** One broad-phase query for the complete previous→current swept capsule union. */
  damageBeamSweep(this: GameRoomContext,
    player: PlayerState,
    c: CombatState,
    descriptor: BeamDescriptor,
    dt: number,
  ): number {
    const angularDelta = shortestAngleDelta(c.beamPreviousAngle, c.beamAngle);
    c.beamHitIds.clear();
    for (let ray = 0; ray < c.beamRayOffsets.length; ray++) {
      const rayOffset = c.beamRayOffsets[ray] ?? 0;
      const muzzle = this.writeBeamMuzzle(
        player,
        descriptor.weaponId,
        c.beamAngle,
        c.beamMuzzlePointIndices[ray],
      );
      const currentX = muzzle.x;
      const currentY = muzzle.y;
      const previousX = c.beamPreviousOriginsX[ray] ?? c.beamPreviousX;
      const previousY = c.beamPreviousOriginsY[ray] ?? c.beamPreviousY;
      const originTravel = Math.hypot(currentX - previousX, currentY - previousY);
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
        const sx = previousX + (currentX - previousX) * f;
        const sy = previousY + (currentY - previousY) * f;
        const angle = c.beamPreviousAngle + angularDelta * f + rayOffset;
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
      const broadPad =
        descriptor.coneHalfAngle > 0
          ? descriptor.range * Math.sin(descriptor.coneHalfAngle) + MAX_ENEMY_RADIUS
          : descriptor.width / 2 + MAX_ENEMY_RADIUS;
      this.enemyGrid.queryAabb(
        minX - broadPad,
        minY - broadPad,
        maxX + broadPad,
        maxY + broadPad,
        this.enemyCandidates,
      );
      for (const enemyId of this.enemyCandidates) {
        const enemy = this.state.enemies.get(enemyId);
        if (!enemy || enemy.hp <= 0) continue;
        const radius = ENEMY_KINDS[enemy.kind]?.radius ?? ENEMY_RADIUS;
        for (let sample = 0; sample <= samples; sample++) {
          const hit =
            descriptor.coneHalfAngle > 0
              ? coneStreamHitsCircle(
                  { x: this.beamSampleX[sample]!, y: this.beamSampleY[sample]! },
                  c.beamPreviousAngle + angularDelta * (sample / samples) + rayOffset,
                  this.beamSampleLength[sample]!,
                  descriptor.coneHalfAngle,
                  { x: enemy.x, y: enemy.y },
                  radius,
                )
              : bladeHitsCircleXY(
                  this.beamSampleX[sample]!,
                  this.beamSampleY[sample]!,
                  this.beamSampleEndX[sample]!,
                  this.beamSampleEndY[sample]!,
                  enemy.x,
                  enemy.y,
                  radius,
                  descriptor.width / 2,
                );
          if (hit) {
            c.beamHitIds.add(enemyId);
            break;
          }
        }
      }
      let rayWormHitCount = 0;
      const runtime = this.bossController?.wormRuntime;
      if (runtime) {
        this.wormSegmentGrid.queryAabb(
          minX - broadPad - 52,
          minY - broadPad - 52,
          maxX + broadPad + 52,
          maxY + broadPad + 52,
          this.wormSegmentCandidates,
        );
        for (const slot of this.wormSegmentCandidates) {
          if (rayWormHitCount >= 2) break;
          for (let sample = 0; sample <= samples; sample++) {
            const hit =
              descriptor.coneHalfAngle > 0
                ? coneStreamHitsCircle(
                    { x: this.beamSampleX[sample]!, y: this.beamSampleY[sample]! },
                    c.beamPreviousAngle + angularDelta * (sample / samples) + rayOffset,
                    this.beamSampleLength[sample]!,
                    descriptor.coneHalfAngle,
                    { x: runtime.x[slot]!, y: runtime.y[slot]! },
                    runtime.segmentRadius(slot),
                  )
                : bladeHitsCircleXY(
                    this.beamSampleX[sample]!,
                    this.beamSampleY[sample]!,
                    this.beamSampleEndX[sample]!,
                    this.beamSampleEndY[sample]!,
                    runtime.x[slot]!,
                    runtime.y[slot]!,
                    runtime.segmentRadius(slot),
                    descriptor.width / 2,
                  );
            if (hit) {
              c.beamHitIds.add(`worm:${slot}:${runtime.segmentGeneration(slot)}`);
              rayWormHitCount++;
              break;
            }
          }
        }
      }
      c.beamCurrentOriginsX[ray] = currentX;
      c.beamCurrentOriginsY[ray] = currentY;
      c.beamCurrentLengths[ray] = this.beamSampleLength[samples]!;
    }
    let wormHitCount = 0;
    for (const targetId of c.beamHitIds) if (targetId.startsWith("worm:")) wormHitCount++;
    const targetCount = c.beamHitIds.size - wormHitCount + (wormHitCount > 0 ? 1 : 0);
    const stepDamage = beamStepDamage(descriptor.damagePerSecond, dt, targetCount);
    for (const enemyId of c.beamHitIds) {
      c.beamPendingDamage.set(enemyId, (c.beamPendingDamage.get(enemyId) ?? 0) + stepDamage);
    }
    c.beamPulseT += dt;
    c.beamQuantumT += dt;
    if (c.beamPulseT + 1e-9 >= descriptor.tickRate) {
      c.beamPulseT -= descriptor.tickRate;
      const allowCrit = c.beamQuantumT + 1e-9 >= BEAM_CRIT_QUANTUM_SECONDS;
      if (allowCrit) c.beamQuantumT -= BEAM_CRIT_QUANTUM_SECONDS;
      this.flushBeamDamage(c, allowCrit, player.id);
    }
    this.beamCurrentX = c.beamCurrentOriginsX[0] ?? c.beamPreviousX;
    this.beamCurrentY = c.beamCurrentOriginsY[0] ?? c.beamPreviousY;
    this.beamCurrentLength = c.beamCurrentLengths[0] ?? 0;
    return this.beamCurrentLength;
  },

  flushBeamDamage(this: GameRoomContext, c: CombatState, allowCrit: boolean, sourceId = "beam"): void {
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
  },

  /** Resolve one authored rapid-thrust pulse at its exact shared pose epoch. Each pulse starts with a fresh
   * hit ledger, so a target held on the visible pike line receives one distinct authoritative contact. */
  applyRapidThrustHit(this: GameRoomContext,
    player: PlayerState,
    sw: ActiveMeleeSwing,
    impactElapsed: number,
    rapidHitIndex: number,
    kills: string[],
  ): void {
    sw.hit.clear();
    const impactX = sw.originX ?? player.x;
    const impactY = sw.originY ?? player.y;
    const envelopeWeapon = sw.timedWeaponEnvelope ? WEAPONS[sw.weaponId] : undefined;
    const collisionRange = envelopeWeapon
      ? meleeDamageReachAt(envelopeWeapon, sw.swing, impactElapsed) * sw.rangeMultiplier
      : sw.range;
    const collisionHalfWidth = envelopeWeapon
      ? meleeDamageHalfWidthAt(envelopeWeapon, sw.swing, impactElapsed)
      : sw.halfWidth;
    const applyEnemy = (enemy: EnemyState, enemyId: string): void => {
      sw.hit.add(enemyId);
      this.damageEnemy(
        enemy,
        enemyId,
        sw.edgeDamage * (enemy.tough ? sw.toughDamageMultiplier : 1),
        kills,
        sw.crit,
        player.id,
        sw.weaponId,
        CombatDelivery.Melee,
        impactX,
        impactY,
      );
      this.applyEnemyHitStatus(enemyId, sw.hitStatus);
    };

    if (this.belt) {
      const facing = Math.cos(sw.aim0) >= 0 ? 1 : -1;
      const forwardPad = MAX_ENEMY_RADIUS + collisionHalfWidth;
      this.enemyGrid.queryAabb(
        impactX - (facing > 0 ? MAX_ENEMY_RADIUS * 0.5 : collisionRange + forwardPad),
        impactY - DEPTH_TOL_PLAYER - MAX_ENEMY_RADIUS,
        impactX + (facing > 0 ? collisionRange + forwardPad : MAX_ENEMY_RADIUS * 0.5),
        impactY + DEPTH_TOL_PLAYER + MAX_ENEMY_RADIUS,
        this.enemyCandidates,
      );
      for (const enemyId of this.enemyCandidates) {
        const enemy = this.state.enemies.get(enemyId);
        if (!enemy || enemy.hp <= 0) continue;
        const radius = ENEMY_KINDS[enemy.kind]?.radius ?? ENEMY_RADIUS;
        const forward = (enemy.x - impactX) * facing;
        if (forward < -radius * 0.5 || forward > collisionRange + radius + collisionHalfWidth)
          continue;
        const rolling = (this.dodgeState.get(enemyId)?.t ?? 0) > 0;
        const depthWindow = DEPTH_TOL_PLAYER + radius * (rolling ? DEPTH_DODGE_MULT : 1);
        if (Math.abs(enemy.y - impactY) > depthWindow) continue;
        applyEnemy(enemy, enemyId);
      }

      const runtime = this.bossController?.wormRuntime;
      if (!runtime) return;
      this.wormHitSlots.length = 0;
      this.wormSegmentGrid.queryAabb(
        impactX - (facing > 0 ? 26 : collisionRange + collisionHalfWidth + 52),
        impactY - DEPTH_TOL_PLAYER - 52,
        impactX + (facing > 0 ? collisionRange + collisionHalfWidth + 52 : 26),
        impactY + DEPTH_TOL_PLAYER + 52,
        this.wormSegmentCandidates,
      );
      for (const slot of this.wormSegmentCandidates) {
        const radius = runtime.segmentRadius(slot);
        const forward = (runtime.x[slot]! - impactX) * facing;
        if (
          forward < -radius * 0.5 ||
          forward > collisionRange + radius + collisionHalfWidth ||
          Math.abs(runtime.y[slot]! - impactY) > DEPTH_TOL_PLAYER + radius
        )
          continue;
        this.wormHitSlots.push(slot);
      }
      this.damageWormSlots(
        this.wormHitSlots,
        sw.edgeDamage,
        `melee:${player.id}:${player.attackSeq}:rapid:${rapidHitIndex}`,
        kills,
        sw.crit,
        false,
        player.id,
        sw.weaponId,
        CombatDelivery.Melee,
        impactX,
        impactY,
      );
      return;
    }

    const wielder = { x: impactX, y: impactY };
    this.enemyGrid.queryRadius(
      impactX,
      impactY,
      collisionRange + collisionHalfWidth + MAX_ENEMY_RADIUS,
      this.enemyCandidates,
    );
    for (const enemyId of this.enemyCandidates) {
      const enemy = this.state.enemies.get(enemyId);
      if (!enemy || enemy.hp <= 0) continue;
      const radius = ENEMY_KINDS[enemy.kind]?.radius ?? ENEMY_RADIUS;
      if (bladeHitsCircle(wielder, sw.aim0, collisionRange, enemy, radius, collisionHalfWidth))
        applyEnemy(enemy, enemyId);
    }

    const runtime = this.bossController?.wormRuntime;
    if (!runtime) return;
    this.wormHitSlots.length = 0;
    this.wormSegmentGrid.queryRadius(
      impactX,
      impactY,
      collisionRange + collisionHalfWidth + 52,
      this.wormSegmentCandidates,
    );
    for (const slot of this.wormSegmentCandidates) {
      if (
        bladeHitsCircle(
          wielder,
          sw.aim0,
          collisionRange,
          { x: runtime.x[slot]!, y: runtime.y[slot]! },
          runtime.segmentRadius(slot),
          collisionHalfWidth,
        )
      )
        this.wormHitSlots.push(slot);
    }
    this.damageWormSlots(
      this.wormHitSlots,
      sw.edgeDamage,
      `melee:${player.id}:${player.attackSeq}:rapid:${rapidHitIndex}`,
      kills,
      sw.crit,
      false,
      player.id,
      sw.weaponId,
      CombatDelivery.Melee,
      impactX,
      impactY,
    );
  },

  stepMeleeSwings(this: GameRoomContext, dt: number): void {
    if (this.meleeSwings.size === 0) return;
    const kills: string[] = [];
    for (const [pid, sw] of this.meleeSwings) {
      const playerId = sw.playerId;
      const player = this.state.players.get(playerId);
      if (!player?.alive) {
        this.meleeSwings.delete(pid);
        continue;
      }
      if (sw.rapidImpactSeconds) {
        sw.elapsed += dt;
        let rapidHitIndex = sw.rapidHitIndex ?? 0;
        while (
          rapidHitIndex < sw.rapidImpactSeconds.length &&
          sw.rapidImpactSeconds[rapidHitIndex]! <= sw.elapsed + 1e-9
        ) {
          this.applyRapidThrustHit(
            player,
            sw,
            sw.rapidImpactSeconds[rapidHitIndex]!,
            rapidHitIndex,
            kills,
          );
          rapidHitIndex++;
        }
        sw.rapidHitIndex = rapidHitIndex;
        if (sw.elapsed >= sw.swing.activeEndSeconds) this.meleeSwings.delete(pid);
        continue;
      }
      const impactX = sw.originX ?? player.x;
      const impactY = sw.originY ?? player.y;
      const p0 = swingEdgeProgress(sw.swing, sw.elapsed);
      sw.elapsed += dt;
      const p1 = swingEdgeProgress(sw.swing, sw.elapsed);
      if (p1 <= p0) {
        if (sw.elapsed >= sw.swing.activeEndSeconds) this.meleeSwings.delete(pid);
        continue;
      }
      const envelopeWeapon = sw.timedWeaponEnvelope ? WEAPONS[sw.weaponId] : undefined;
      // A tick may cross the active-end boundary. Its final supersample represents the visible edge just
      // before that boundary, not a post-hide frame, so keep it infinitesimally inside the shared clock.
      const collisionElapsed = Math.min(
        sw.elapsed,
        Math.max(sw.swing.activeStartSeconds, sw.swing.activeEndSeconds - 1e-9),
      );
      const collisionRange = envelopeWeapon
        ? meleeDamageReachAt(envelopeWeapon, sw.swing, collisionElapsed) * sw.rangeMultiplier
        : sw.range;
      const collisionHalfWidth = envelopeWeapon
        ? meleeDamageHalfWidthAt(envelopeWeapon, sw.swing, collisionElapsed)
        : sw.halfWidth;
      const critC = sw.crit;
      if (this.belt) {
        // §29 BELT melee is LANE-based (SoR4 model), not the top-down angular sweep: a hit needs horizontal
        // reach in the facing direction AND depth alignment |Δy| ≤ DEPTH_TOL_PLAYER (+ the target radius).
        // A blade that whiffs because the mob is a hair nearer/farther in the shallow band feels awful; this
        // is the fairness lever the belt constants were authored for. Tested once/tick during the descriptor's
        // active interval (hit-once via `sw.hit`) so a mob walking into your swing still gets clipped.
        const facing = Math.cos(sw.aim0) >= 0 ? 1 : -1;
        const forwardPad = MAX_ENEMY_RADIUS + sw.halfWidth;
        this.enemyGrid.queryAabb(
          impactX - (facing > 0 ? MAX_ENEMY_RADIUS * 0.5 : sw.range + forwardPad),
          impactY - DEPTH_TOL_PLAYER - MAX_ENEMY_RADIUS,
          impactX + (facing > 0 ? sw.range + forwardPad : MAX_ENEMY_RADIUS * 0.5),
          impactY + DEPTH_TOL_PLAYER + MAX_ENEMY_RADIUS,
          this.enemyCandidates,
        );
        for (const eid of this.enemyCandidates) {
          const enemy = this.state.enemies.get(eid);
          if (!enemy || sw.hit.has(eid) || enemy.hp <= 0) continue; // once/swing; skip dead/stale ids
          const r = ENEMY_KINDS[enemy.kind]?.radius ?? ENEMY_RADIUS;
          const fx = (enemy.x - impactX) * facing; // forward distance along the belt (in front = positive)
          if (fx < -r * 0.5 || fx > collisionRange + r + collisionHalfWidth) continue;
          // Depth window: generous for the attacker, but a mob actively rolling in depth (dodgeState) shrinks
          // its own hurtbox depth (DEPTH_DODGE_MULT) so a well-timed roll genuinely slips the swing.
          const rolling = (this.dodgeState.get(eid)?.t ?? 0) > 0;
          const depthWin = DEPTH_TOL_PLAYER + r * (rolling ? DEPTH_DODGE_MULT : 1);
          if (Math.abs(enemy.y - impactY) > depthWin) continue;
          sw.hit.add(eid);
          this.damageEnemy(
            enemy,
            eid,
            sw.edgeDamage * (enemy.tough ? sw.toughDamageMultiplier : 1),
            kills,
            critC,
            playerId,
            sw.weaponId,
            CombatDelivery.Melee,
            impactX,
            impactY,
          );
          this.applyEnemyHitStatus(eid, sw.hitStatus);
        }
        const runtime = this.bossController?.wormRuntime;
        if (runtime) {
          this.wormHitSlots.length = 0;
          this.wormSegmentGrid.queryAabb(
            impactX - (facing > 0 ? 26 : sw.range + sw.halfWidth + 52),
            impactY - DEPTH_TOL_PLAYER - 52,
            impactX + (facing > 0 ? sw.range + sw.halfWidth + 52 : 26),
            impactY + DEPTH_TOL_PLAYER + 52,
            this.wormSegmentCandidates,
          );
          for (const slot of this.wormSegmentCandidates) {
            const hitKey = `worm:${slot}:${runtime.segmentGeneration(slot)}`;
            if (sw.hit.has(hitKey)) continue;
            const r = runtime.segmentRadius(slot);
            const fx = (runtime.x[slot]! - impactX) * facing;
            if (
              fx < -r * 0.5 ||
              fx > collisionRange + r + collisionHalfWidth ||
              Math.abs(runtime.y[slot]! - impactY) > DEPTH_TOL_PLAYER + r
            )
              continue;
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
            impactX,
            impactY,
          );
        }
        if (sw.elapsed >= sw.swing.activeEndSeconds) this.meleeSwings.delete(pid);
        continue;
      }
      // §50 SPIN weapons sweep MULTIPLE revolutions per swing (whirlwind swingArc = 4π), but hit-once
      // spanned the whole swing — a held whirlwind "blink hit" each enemy once per press despite the blade
      // visibly crossing them every turn (playtest). WYSIWYG: each completed 2π re-arms the hit set, so
      // every revolution the blade actually sweeps through an enemy damages it again.
      const absoluteSwingArc = Math.abs(sw.swingArc);
      const multiRevolutionSwing = absoluteSwingArc > Math.PI * 2 + 1e-6;
      let sampledRevolution = Math.floor(
        (absoluteSwingArc * Math.min(p0, 1 - Number.EPSILON)) / (Math.PI * 2),
      );
      const activeSeconds = sw.swing.activeEndSeconds - sw.swing.activeStartSeconds;
      const extensionAngleAt = (progress: number): number | undefined =>
        envelopeWeapon
          ? bladeExtensionPoseAt(
              envelopeWeapon,
              sw.swing,
              sw.swing.activeStartSeconds + progress * activeSeconds,
              sw.aim0,
            )?.angle
          : undefined;
      const extensionAngle0 = extensionAngleAt(p0);
      const extensionAngle1 = extensionAngleAt(p1);
      const sampledAngularTravel =
        extensionAngle0 !== undefined && extensionAngle1 !== undefined
          ? Math.abs(extensionAngle1 - extensionAngle0)
          : absoluteSwingArc * (p1 - p0);
      const steps = Math.max(1, Math.ceil(sampledAngularTravel / MELEE_SAMPLE_STEP));
      const wielder = { x: impactX, y: impactY };
      this.enemyGrid.queryRadius(
        impactX,
        impactY,
        sw.range + sw.halfWidth + MAX_ENEMY_RADIUS,
        this.enemyCandidates,
      );
      const runtime = this.bossController?.wormRuntime;
      this.wormHitSlots.length = 0;
      if (runtime) {
        this.wormSegmentGrid.queryRadius(
          impactX,
          impactY,
          sw.range + sw.halfWidth + 52,
          this.wormSegmentCandidates,
        );
      }
      for (let s = 1; s <= steps; s++) {
        const sampleProgress = p0 + ((p1 - p0) * s) / steps;
        if (multiRevolutionSwing) {
          // Re-arm at the exact visual boundary, including when a coarse server tick
          // samples more than one revolution. Clamp the terminal endpoint so it does
          // not manufacture a zero-length fourth hit after a three-turn spin.
          const revolution = Math.floor(
            (absoluteSwingArc * Math.min(sampleProgress, 1 - Number.EPSILON)) /
              (Math.PI * 2),
          );
          if (revolution > sampledRevolution) sw.hit.clear();
          sampledRevolution = revolution;
        }
        const sampleElapsed = Math.min(
          sw.swing.activeEndSeconds - 1e-9,
          sw.swing.activeStartSeconds +
            sampleProgress * (sw.swing.activeEndSeconds - sw.swing.activeStartSeconds),
        );
        const extensionPose = envelopeWeapon
          ? bladeExtensionPoseAt(envelopeWeapon, sw.swing, sampleElapsed, sw.aim0)
          : undefined;
        const angle = extensionPose?.angle ?? bladeAngleAt(sw.aim0, sw.swingArc, sampleProgress);
        const sampleRange = envelopeWeapon
          ? meleeDamageReachAt(envelopeWeapon, sw.swing, sampleElapsed) * sw.rangeMultiplier
          : sw.range;
        const sampleHalfWidth = envelopeWeapon
          ? meleeDamageHalfWidthAt(envelopeWeapon, sw.swing, sampleElapsed)
          : sw.halfWidth;
        for (const eid of this.enemyCandidates) {
          const enemy = this.state.enemies.get(eid);
          if (!enemy || sw.hit.has(eid) || enemy.hp <= 0) continue; // once/swing; skip dead/stale ids
          const r = ENEMY_KINDS[enemy.kind]?.radius ?? ENEMY_RADIUS;
          if (bladeHitsCircle(wielder, angle, sampleRange, enemy, r, sampleHalfWidth)) {
            sw.hit.add(eid);
            this.damageEnemy(
              enemy,
              eid,
              sw.edgeDamage * (enemy.tough ? sw.toughDamageMultiplier : 1),
              kills,
              critC,
              playerId,
              sw.weaponId,
              CombatDelivery.Melee,
              impactX,
              impactY,
            );
            this.applyEnemyHitStatus(eid, sw.hitStatus);
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
                sampleRange,
                { x: runtime.x[slot]!, y: runtime.y[slot]! },
                runtime.segmentRadius(slot),
                sampleHalfWidth,
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
        `melee:${playerId}:${player.attackSeq}:${Math.floor((absoluteSwingArc * p1) / (Math.PI * 2))}`,
        kills,
        critC,
        false,
        playerId,
        sw.weaponId,
        CombatDelivery.Melee,
        impactX,
        impactY,
      );
      if (sw.elapsed >= sw.swing.activeEndSeconds) this.meleeSwings.delete(pid);
    }
    for (const eid of kills) this.state.enemies.delete(eid);
  },

  fireProjectile(this: GameRoomContext,
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
    firstCollisionFrom?: Vec2,
    landingZoneDamage?: number,
    targetRicochet?: { hops: number; range: number },
    projectileWaveform?: ProjectileWaveformDef,
    arcHeight = 0,
    returnAfterSeconds?: number,
    damageEnvelope?: ProjectileDamageEnvelope,
    visualScale = 1,
    sourceMuzzlePart = 0,
    sourceBurstIndex = 0,
    visualVariant = 0,
  ): void {
    // §16 the documented budget is ARENA-wide: reject generic spitters here too. Friendly player fire is
    // and friendly rows each have an explicit ceiling; a reflected hostile shot changes sides and frees
    // its hostile slot immediately before competing for friendly admission.
    const friendlyCount = this.state.projectiles.size - this.hostileProjectileCount;
    if (
      this.state.outcome !== "active" ||
      (hostile && this.hostileProjectileCount >= BOSS_PROJECTILE_BUDGET) ||
      (!hostile && friendlyCount >= FRIENDLY_PROJECTILE_ENTITY_CAP)
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
    pr.bornTick = this.state.tick;
    pr.sourcePlayerId = sourcePlayerId;
    pr.sourceWeaponId = sourceWeaponId;
    pr.explodeR = explode?.radius ?? 0; // §14 WYSIWYG: client renders a blast of exactly this radius
    pr.arcHeight = Math.max(0, arcHeight);
    pr.flightTicks = Math.min(0xffff, ticksFromSeconds(ttl));
    pr.visualScale = Math.max(0.01, visualScale);
    pr.sourceMuzzlePart = Math.max(0, Math.min(0xff, Math.trunc(sourceMuzzlePart)));
    pr.sourceBurstIndex = Math.max(0, Math.min(0xff, Math.trunc(sourceBurstIndex)));
    pr.visualVariant = Math.max(0, Math.min(0xff, Math.trunc(visualVariant)));
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
      firstCollisionX: firstCollisionFrom?.x,
      firstCollisionY: firstCollisionFrom?.y,
      firstStep: true,
      deferredSteps: delivery === CombatDelivery.HybridProjectile ? 1 : 0,
      landingZoneDamage,
      ricochetHops: targetRicochet?.hops,
      ricochetRange: targetRicochet?.range,
      waveform: projectileWaveform
        ? {
            originX: from.x,
            originY: from.y,
            elapsedSeconds: 0,
            definition: projectileWaveform,
          }
        : undefined,
      returnToOwner:
        returnAfterSeconds !== undefined
          ? { outboundSeconds: returnAfterSeconds, returning: false }
          : undefined,
      damageEnvelope,
    });
    if (hostile) this.hostileProjectileCount++;
  },

  /** §16 remove one live projectile while keeping the O(1) hostile admission count exact. */
  removeProjectile(this: GameRoomContext, id: string): void {
    const meta = this.projectileMeta.get(id);
    if (meta?.hostile) this.hostileProjectileCount = Math.max(0, this.hostileProjectileCount - 1);
    this.state.projectiles.delete(id);
    this.projectileMeta.delete(id);
  },

  /** §9/§15 fire a GUN — spend one ammo to launch `pellets` friendly bullets down-barrel (a cone for
   *  shotguns / a touch of inaccuracy for autos), each WYSIWYG-scaled, piercing/bouncing/exploding per
   *  the gun's block. Ammo + reload are handled by the caller (mirrors the thrown charge model). */
  /** B76 immutable accepted direction. The §37 cursor correction is resolved when the trigger message
   * enters authority; recalculating from a later player position can put the stale target behind the body. */
  aimDir(this: GameRoomContext, _player: PlayerState, c: CombatState): { x: number; y: number } {
    const length = Math.hypot(c.aimX, c.aimY);
    return Number.isFinite(length) && length > 1e-4
      ? { x: c.aimX / length, y: c.aimY / length }
      : { x: 1, y: 0 };
  },

  armGunBurst(this: GameRoomContext, c: CombatState, weapon: WeaponDef, hand: WeaponHand): void {
    const burst = weapon.gun?.burst;
    if (!burst || burst.count <= 1) return;
    c.gunBurstWeaponId = weapon.id;
    c.gunBurstHand = hand;
    c.gunBurstRemaining = burst.count - 1;
    c.gunBurstT = burst.intervalSeconds;
    c.gunBurstAimX = c.aimX;
    c.gunBurstAimY = c.aimY;
  },

  clearGunBurst(this: GameRoomContext, c: CombatState): void {
    c.gunBurstWeaponId = "";
    c.gunBurstHand = 0;
    c.gunBurstRemaining = 0;
    c.gunBurstT = 0;
    c.gunBurstAimX = 1;
    c.gunBurstAimY = 0;
  },

  /** B45 sanctioned gun/beam root motion. It enters the existing additive impulse rail so input composes,
   * navigation clamps still resolve, airborne bodies are pushed, and B42 ignores owner reports for the
   * complete fast-decay window instead of rejecting/rubberbanding them. */
  applyWeaponFireRecoil(
    this: GameRoomContext,
    player: PlayerState,
    aimX: number,
    aimY: number,
    impulse: number,
  ): void {
    if (!(impulse > 0)) return;
    const length = Math.hypot(aimX, aimY);
    if (!(length > 1e-6)) return;
    const next = addImpulse(
      player,
      (-aimX / length) * impulse,
      (-aimY / length) * impulse,
    );
    player.vx = next.vx;
    player.vy = next.vy;
    this.beginServerMotion(player, SERVER_MOTION_IMPULSE_TICKS, "weapon-fire-recoil");
  },

  /** Emit follow-up rounds from an accepted trigger; they need no second input or Drive spend. */
  stepGunBurst(this: GameRoomContext,
    player: PlayerState,
    c: CombatState,
    weapon: WeaponDef | undefined,
    acting: boolean,
  ): void {
    if (c.gunBurstRemaining <= 0) return;
    if (!acting || weapon?.id !== c.gunBurstWeaponId || !weapon.gun?.burst) {
      this.clearGunBurst(c);
      return;
    }
    if (c.gunBurstT > 0) return;
    const burstIndex = weapon.gun.burst.count - c.gunBurstRemaining;
    this.fireGun(
      player,
      c,
      weapon,
      c.gunBurstHand,
      weapon.gun.burst.intervalSeconds * 1000,
      burstIndex,
      { x: c.gunBurstAimX, y: c.gunBurstAimY },
    );
    c.gunBurstRemaining--;
    if (c.gunBurstRemaining <= 0) this.clearGunBurst(c);
    else c.gunBurstT += weapon.gun.burst.intervalSeconds;
  },

  /** Cogwright's Tesla-Rod resolves its full-distance cursor endpoint through navigation, but only the
   * damage burst travels. Weapon attacks never write the character root. */
  detonateWarpAtCursor(this: GameRoomContext, player: PlayerState, c: CombatState, weapon: WeaponDef): void {
    const warp = weapon.warp;
    if (!warp) return;
    const destination = this.navValidDest(
      player,
      c,
      c.targetX,
      c.targetY,
      Number.POSITIVE_INFINITY,
    );
    const damage = weapon.damage * this.heldDamageMult(weapon, player, 0);
    const crit = this.weaponCritChance(player, c);
    this.detonate(
      destination.x,
      destination.y,
      warp.burstRadius,
      damage,
      crit,
      player.id,
      weapon.id,
      CombatDelivery.Warp,
    );
  },

  fireGun(this: GameRoomContext,
    player: PlayerState,
    c: CombatState,
    weapon: WeaponDef,
    hand: WeaponHand = 0,
    recoilElapsedMs = 0,
    burstIndex = 0,
    acceptedAim?: Vec2,
  ): void {
    const g = weapon.gun;
    if (!g) return;
    const pellets = Math.max(1, g.pellets ?? 1);
    const spread = g.spread ?? 0;
    const acceptedAimLength = acceptedAim ? Math.hypot(acceptedAim.x, acceptedAim.y) : 0;
    const aim =
      acceptedAim && Number.isFinite(acceptedAimLength) && acceptedAimLength > 1e-4
        ? { x: acceptedAim.x / acceptedAimLength, y: acceptedAim.y / acceptedAimLength }
        : this.aimDir(player, c);
    const muzzles = weaponMuzzleWorldPointsForShot(
      weapon,
      {
        x: player.x,
        y: player.y,
        aimX: aim.x,
        aimY: aim.y,
        renderScale: characterScale(player.character),
        hand,
        recoilElapsedMs,
        recoilHand: hand,
      },
      player.attackSeq,
    );
    const parallelDivisor = weapon.muzzle?.barrelMode === "parallel" ? muzzles.length : 1;
    const baseAng = Math.atan2(aim.y, aim.x);
    const ttl = g.range / g.projectileSpeed;
    // §38 GUNSLINGER signature augments: Hollow-Points add pierce, Ricochet Rounds add bounces (per stack).
    const pierce =
      (g.pierce ?? 1) + AUG_GUN_PIERCE_PER * countAugment(player.augments, "hollowpoints");
    const bounces =
      (g.bounces ?? 0) + AUG_GUN_BOUNCE_PER * countAugment(player.augments, "ricochet-rounds");
    // §9 spawn from the BARREL TIP (player centre + aim × the gun's own muzzle reach), not the body. Scale
    // by the holder's rig size (§7) so the shot lands exactly on the rendered tip, not short of it.
    const crit = this.weaponCritChance(player, c); // §ULT Door rider consumes once per trigger pull
    // §35 encode the weapon's ELEMENT onto the bullet kind ("tracer:fire") so the client tints the bullet to
    // its element — a fire and a frost gun read distinct even sharing a bullet shape. Physical = no suffix.
    const el = weapon.tags?.element;
    const projectileTint =
      g.projectileColor === undefined
        ? undefined
        : `#${Math.round(g.projectileColor).toString(16).padStart(6, "0")}`;
    const bulletKind = projectileTint
      ? `${g.bulletKind}:${projectileTint}`
      : el && el !== "physical"
        ? `${g.bulletKind}:${el}`
        : g.bulletKind;
    // Resolve inaccuracy once per pellet so simultaneous barrel lanes remain exactly parallel. Random count/headings
    // come from the server-minted room seed + accepted attack epoch, never a client roll or global Math.random.
    // Radial headings are absolute; cone headings are bounded offsets about the accepted aim direction.
    const friendlyRows = this.state.projectiles.size - this.hostileProjectileCount;
    const rowsPerLane = Math.floor(
      Math.max(0, FRIENDLY_PROJECTILE_ENTITY_CAP - friendlyRows) / Math.max(1, muzzles.length),
    );
    const seededVolley = g.randomPellets
      ? serverSeededGunPelletVolley(
          g.randomPellets,
          mixSeeds(this.state.seedHazard, player.attackSeq, this.projectileSeq),
          rowsPerLane,
        )
      : undefined;
    const angles = seededVolley
      ? seededVolley.angles.map((angle) =>
          g.randomPellets?.directions === "cone" ? baseAng + angle : angle,
        )
      : Array.from({ length: pellets }, (_, i) =>
          pellets > 1
            ? baseAng + (i / (pellets - 1) - 0.5) * 2 * spread
            : baseAng + (Math.random() - 0.5) * 2 * spread,
        );
    // Random-pellet guns author one trigger damage pool. Divide by the server-owned requested roll, not the
    // admitted count: direction/count variance changes coverage without changing aggregate DPS, while an
    // arena-cap truncation can only remove damage and never concentrate it into surviving entities.
    const randomPelletDivisor = seededVolley?.requestedCount ?? 1;
    const projectileDivisor = parallelDivisor * randomPelletDivisor;
    const dmg = (g.damage * this.heldDamageMult(weapon, player, hand)) / projectileDivisor;
    const baseExplode = g.explode
      ? {
          radius: g.explode.radius,
          damage:
            (g.explode.damage * this.heldDamageMult(weapon, player, hand)) / projectileDivisor,
        }
      : undefined;
    // One deterministic room-seeded roll owns both installed art and gameplay-bearing payload size. The
    // one-based variant is replicated on ProjectileState, so every client observes the exact server roll.
    const presentPayload =
      weapon.id === "x2-exploding-present-lobber"
        ? serverSeededPresentPayloadRoll(
            mixSeeds(this.state.seedHazard, player.attackSeq, this.projectileSeq, 0x70726573),
          )
        : undefined;
    const explode =
      baseExplode && presentPayload
        ? presentPayloadExplosion(baseExplode, presentPayload.big)
        : baseExplode;
    for (const muzzle of muzzles) {
      for (const ang of angles) {
        this.fireProjectile(
          muzzle,
          { x: muzzle.x + Math.cos(ang), y: muzzle.y + Math.sin(ang) },
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
          player, // swept collision begins at the holder body even for laterally offset barrels
          undefined,
          undefined,
          undefined,
          g.arcHeight ?? 0,
          undefined,
          undefined,
          g.projectileVisualScale ?? 1,
          muzzle.point.part,
          burstIndex,
          presentPayload?.variant ?? 0,
        );
      }
    }
    this.applyWeaponFireRecoil(player, aim.x, aim.y, weapon.recoil ?? 0);
  },

  /** §38 CASTER fire — conjure one piercing arcane BOLT down aim (no ammo). Distinct from a gun
   *  (no magazine/spread; pierces the whole line) and from melee (ranged). Spawns from the same muzzle reach. */
  /** Gun-contact version of the existing Venomtongue chain idiom. The projectile hit is the seed and is
   * excluded from the extra links; every hop is selected and damaged on the server. */
  applyProjectileChain(this: GameRoomContext,
    seed: EnemyState,
    seedId: string,
    meta: {
      hit: Set<string>;
      sourcePlayerId?: string;
      sourceWeaponId?: string;
      crit?: number;
    },
    kills: string[],
  ): void {
    const player = this.state.players.get(meta.sourcePlayerId ?? "");
    const weapon = WEAPONS[meta.sourceWeaponId ?? ""];
    const chain = weapon?.chainLightning;
    if (!player || !weapon?.gun || !chain) return;
    const candidates: ChainCandidate[] = [];
    this.state.enemies.forEach((enemy, enemyId) => {
      if (enemyId !== seedId && enemy.hp > 0)
        candidates.push({ id: enemyId, x: enemy.x, y: enemy.y });
    });
    const links = selectChainTargets(
      { x: seed.x, y: seed.y },
      candidates,
      chain.jumps,
      Math.min(chain.range, CHAIN_MAX_RANGE),
      meta.hit,
    );
    const power = this.heldDamageMult(weapon, player, 0);
    for (let index = 0; index < links.length; index++) {
      const link = links[index]!;
      const enemy = this.state.enemies.get(link.id);
      if (!enemy || enemy.hp <= 0) continue;
      this.damageEnemy(
        enemy,
        link.id,
        chain.damage * chain.falloff ** index * power,
        kills,
        meta.crit ?? 0,
        player.id,
        weapon.id,
        CombatDelivery.Chain,
        seed.x,
        seed.y,
      );
    }
  },

  fireCast(this: GameRoomContext,
    player: PlayerState,
    c: CombatState,
    weapon: WeaponDef,
    hand: WeaponHand = 0,
  ): void {
    const cast = weapon.cast;
    if (!cast) return;
    // §38 CASTER signature augments: Overcharge boosts bolt damage, Arc Split adds forked bolts (per stack).
    const dmgMul = 1 + AUG_CAST_DMG_PER * countAugment(player.augments, "overcharge");
    const totalDamage = cast.damage * this.heldCastDamageMult(weapon, player, hand) * dmgMul;
    const volleyCount = Math.max(
      1,
      Math.min(CAST_VOLLEY_PROJECTILE_CAP, Math.trunc(cast.volley?.count ?? 1)),
    );
    const projectileDamage = totalDamage / volleyCount;
    const totalExplosionDamage = cast.explode
      ? cast.explode.damage * this.heldCastDamageMult(weapon, player, hand) * dmgMul
      : 0;
    const projectileExplosion = cast.explode
      ? { radius: cast.explode.radius, damage: totalExplosionDamage / volleyCount }
      : undefined;
    const forks = Math.min(
      AUG_CAST_SPLIT_MAX,
      AUG_CAST_SPLIT_PER * countAugment(player.augments, "arc-split"),
    );
    const ttl = cast.range / cast.speed;
    const aim = this.aimDir(player, c); // §37 aim at the cursor POINT
    const muzzle = weapon.muzzle
      ? weaponMuzzleWorldPoint(weapon, {
          x: player.x,
          y: player.y,
          aimX: aim.x,
          aimY: aim.y,
          renderScale: characterScale(player.character),
        })
      : player;
    const mx = muzzle.x;
    const my = muzzle.y;
    const crit = this.weaponCritChance(player, c);
    // §35 element-tint the bolt (arcane/shock/void…) so different caster weapons read distinct.
    const el = weapon.tags?.element;
    const bulletKind = el && el !== "physical" ? `orb:${el}` : "orb";
    const baseAng = Math.atan2(aim.y, aim.x);
    const emit = (ang: number): void => {
      this.fireProjectile(
        { x: mx, y: my },
        { x: mx + Math.cos(ang), y: my + Math.sin(ang) },
        cast.speed,
        projectileDamage,
        false,
        bulletKind,
        cast.pierce ?? 99,
        ttl,
        projectileExplosion,
        0,
        crit,
        player.id,
        weapon.id,
        CombatDelivery.Cast,
        player,
        undefined,
        undefined,
        cast.projectileWaveform,
      );
    };
    // The authored volley is one accepted payload split evenly over a bounded simultaneous fan.
    const volleySpread = cast.volley?.spread ?? 0;
    for (let i = 0; i < volleyCount; i++) {
      const offset = volleyCount > 1 ? (i / (volleyCount - 1) - 0.5) * 2 * volleySpread : 0;
      emit(baseAng + offset);
    }
    // Arc Split remains extra projectiles; volley weapons add the forks just outside their authored fan.
    for (let i = 1; i <= forks; i++) {
      const direction = i % 2 === 1 ? 1 : -1;
      const ring = Math.ceil(i / 2);
      emit(baseAng + direction * (volleySpread + ring * AUG_CAST_SPLIT_SPREAD));
    }
  },

  /** Hurl a thrown weapon at the player's aim — a friendly, piercing projectile (§10). */
  throwWeapon(this: GameRoomContext,
    player: PlayerState,
    c: CombatState,
    weapon: WeaponDef,
    hand: WeaponHand = 0,
  ): void {
    const t = weapon.thrown;
    if (!t) return;
    const damageMultiplier = this.heldDamageMult(weapon, player, hand);
    const dmg = t.damage * damageMultiplier;
    const aim = this.aimDir(player, c); // §37 aim at the cursor POINT, not the rig-derived vector
    const drawSeconds = weapon.performance?.windupSeconds ?? 0;
    const attackCrit = this.weaponCritChance(player, c);
    const drawRevolutions = weapon.performance?.preThrowRevolutions ?? 0;
    if (drawRevolutions > 0 && drawSeconds > 0) {
      const drawDamage = weapon.performance?.preThrowDamage;
      if (drawDamage) {
        this.meleeSwings.set(`${player.id}:prethrow:${hand}`, {
          playerId: player.id,
          swing: {
            effectiveCooldown: drawSeconds,
            style: "spin",
            poseSeconds: drawSeconds,
            activeStartSeconds: 0,
            activeEndSeconds: drawSeconds,
            impactSeconds: drawSeconds * 0.5,
          },
          aim0: Math.atan2(aim.y, aim.x),
          range: drawDamage.range,
          swingArc: Math.PI * 2 * drawRevolutions,
          halfWidth: MELEE_BLADE_HALFWIDTH,
          rangeMultiplier: 1,
          timedWeaponEnvelope: false,
          edgeDamage: drawDamage.damage * damageMultiplier,
          toughDamageMultiplier: 1,
          weaponId: weapon.id,
          crit: attackCrit,
          elapsed: 0,
          hit: new Set<string>(),
        });
      }
    }
    const queueThrow = (
      damage: number,
      sourceMuzzlePart: 0 | 1,
      projectileWaveform?: ProjectileWaveformDef,
    ): void => {
      const pending: PendingWeaponThrow = {
        t: drawSeconds,
        playerId: player.id,
        weaponId: weapon.id,
        aimX: aim.x,
        aimY: aim.y,
        speed: t.speed,
        range: t.range,
        damage,
        pierce: t.pierce,
        kind: thrownProjectileKindFor(weapon),
        crit: attackCrit,
        landingDamagePerSecond:
          weapon.groundZone?.trigger === "landing"
            ? weapon.groundZone.damagePerSecond * this.heldDamageMult(weapon, player, hand)
            : undefined,
        ricochet: t.ricochetHops
          ? { hops: t.ricochetHops, range: t.ricochetRange ?? Math.min(t.range, 320) }
          : undefined,
        arcHeight: t.arcHeight ?? weapon.groundZone?.grenadeArcHeight,
        returning: t.returning,
        projectileWaveform,
        sourceMuzzlePart,
      };
      if (drawSeconds > 0) this.pendingWeaponThrows.push(pending);
      else this.emitWeaponThrow(pending, player.x, player.y);
    };
    if (t.helix) {
      const halfDamage = dmg / 2;
      queueThrow(halfDamage, 0, { ...t.helix, phaseRad: 0 });
      queueThrow(halfDamage, 1, { ...t.helix, phaseRad: Math.PI });
    } else {
      queueThrow(dmg, hand, undefined);
    }
  },

  /** §14 scatter shot — fling `count` REAL magma projectiles in a cone toward aim. Each is a WYSIWYG
   *  damage source with flat authored direct-hit and explosion damage. */
  /** Redirect one spent thrown impact toward the nearest fresh enemy. Selection is server-owned and uses
   * the same greedy nearest-target primitive as chain lightning. */
  emitWeaponThrow(this: GameRoomContext, pending: PendingWeaponThrow, originX: number, originY: number): void {
    this.fireProjectile(
      { x: originX, y: originY },
      { x: originX + pending.aimX, y: originY + pending.aimY },
      pending.speed,
      pending.damage,
      false,
      pending.kind,
      pending.pierce,
      (pending.range / pending.speed) * (pending.returning ? 2 : 1),
      undefined,
      0,
      pending.crit,
      pending.playerId,
      pending.weaponId,
      CombatDelivery.Thrown,
      undefined,
      pending.landingDamagePerSecond,
      pending.ricochet,
      pending.projectileWaveform,
      pending.arcHeight ?? 0,
      pending.returning ? pending.range / pending.speed : undefined,
      undefined,
      1,
      pending.sourceMuzzlePart ?? 0,
    );
  },

  redirectThrownRicochet(this: GameRoomContext,
    pr: ProjectileState,
    meta: {
      ttl: number;
      hit: Set<string>;
      pierce: number;
      pierceMax?: number;
      ricochetHops?: number;
      ricochetRange?: number;
    },
  ): boolean {
    if ((meta.ricochetHops ?? 0) <= 0) return false;
    const candidates: ChainCandidate[] = [];
    this.state.enemies.forEach((enemy, id) => {
      if (enemy.hp > 0 && !(id === this.bossId && this.bossController?.wormRuntime))
        candidates.push({ id, x: enemy.x, y: enemy.y });
    });
    const target = selectChainTargets(pr, candidates, 1, meta.ricochetRange ?? 260, meta.hit)[0];
    if (!target) return false;
    const dx = target.x - pr.x;
    const dy = target.y - pr.y;
    const len = Math.hypot(dx, dy) || 1;
    const speed = Math.hypot(pr.vx, pr.vy);
    pr.vx = (dx / len) * speed;
    pr.vy = (dy / len) * speed;
    meta.ricochetHops = (meta.ricochetHops ?? 0) - 1;
    meta.pierce = Math.max(1, meta.pierceMax ?? 1);
    meta.ttl = (meta.ricochetRange ?? 260) / Math.max(1, speed);
    return true;
  },

  fireScatter(this: GameRoomContext,
    player: PlayerState,
    c: CombatState,
    weapon: WeaponDef,
    hand: WeaponHand = 0,
    delaySeconds = 0,
    swing?: SwingDescriptor,
  ): void {
    const sc = weapon.scatter;
    if (!sc) return;
    const ballDmg = sc.damage * this.heldDamageMult(weapon, player, hand);
    const pierce = sc.pierce ?? 1;
    const explode = sc.explode
      ? {
          radius: sc.explode.radius,
          damage: sc.explode.damage * this.heldDamageMult(weapon, player, hand),
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
    const effectOrigin = weapon.effectEmitter
      ? weaponEffectEmitterPoint(weapon, player, baseAng, swing, delaySeconds)
      : undefined;
    const volley: PendingScatterVolley = {
      t: Math.max(0, delaySeconds),
      originX: effectOrigin?.x ?? player.x,
      originY: effectOrigin?.y ?? player.y,
      sweepX: player.x,
      sweepY: player.y,
      baseAng,
      aimMode: sc.aim ?? "cone",
      count: sc.count,
      spread: sc.spread,
      speed: sc.speed,
      range: sc.range,
      damage: ballDmg,
      pierce,
      explode,
      crit,
      sourcePlayerId: player.id,
      sourceWeaponId: weapon.id,
      sourceMuzzlePart: hand,
      kind,
    };
    if (volley.t > 0) this.pendingScatterVolleys.push(volley);
    else this.emitScatterVolley(volley);
  },

  emitScatterVolley(this: GameRoomContext, volley: PendingScatterVolley): void {
    for (let i = 0; i < volley.count; i++) {
      // Cone volleys fan around aim; radial sprays sample a fresh full-circle heading per shard. This RNG
      // is server-owned because it changes projectile travel and therefore collision authority.
      const spread = volley.count > 1 ? (i / (volley.count - 1) - 0.5) * 2 * volley.spread : 0;
      const ang =
        volley.aimMode === "radial-random"
          ? Math.random() * Math.PI * 2
          : volley.baseAng + spread + (Math.random() - 0.5) * 0.12;
      const spd = volley.speed * (0.85 + Math.random() * 0.3);
      this.fireProjectile(
        { x: volley.originX, y: volley.originY },
        { x: volley.originX + Math.cos(ang), y: volley.originY + Math.sin(ang) },
        spd,
        volley.damage,
        false,
        volley.kind,
        volley.pierce,
        volley.range / spd, // expire after travelling ~range (then explode)
        volley.explode,
        0,
        volley.crit,
        volley.sourcePlayerId,
        volley.sourceWeaponId,
        CombatDelivery.Scatter,
        { x: volley.sweepX, y: volley.sweepY },
        undefined,
        undefined,
        undefined,
        0,
        undefined,
        undefined,
        1,
        volley.sourceMuzzlePart,
      );
    }
  },

  /** Emit one B3 fan payload from the actual painted leading edge. The close swept edge has already
   * advanced through this impact epoch; these rows then travel and collide through the shared authority rail. */
  emitHybridProjectile(this: GameRoomContext, pending: PendingHybridProjectile): void {
    const player = this.state.players.get(pending.playerId);
    const weapon = WEAPONS[pending.weaponId];
    const hybrid = weapon?.hybridProjectile;
    if (!player?.alive || !weapon || !hybrid || !weapon.muzzle) return;
    const muzzle = weaponMuzzleWorldPoint(weapon, {
      x: player.x,
      y: player.y,
      aimX: pending.aimX,
      aimY: pending.aimY,
      renderScale: characterScale(player.character),
    });
    const baseAngle = Math.atan2(pending.aimY, pending.aimX);
    const damagePerProjectile = pending.damage / Math.max(1, hybrid.count);
    const outboundSeconds = hybrid.returnAfterSeconds ?? hybrid.range / hybrid.speed;
    const ttl = hybrid.returnAfterSeconds === undefined ? outboundSeconds : outboundSeconds * 2;
    const damageEnvelope = projectileDamageEnvelopeFor(weapon, "hybrid");
    for (let index = 0; index < hybrid.count; index++) {
      const offset = hybrid.count > 1 ? (index / (hybrid.count - 1) - 0.5) * 2 * hybrid.spread : 0;
      const angle = baseAngle + offset;
      this.fireProjectile(
        muzzle,
        { x: muzzle.x + Math.cos(angle), y: muzzle.y + Math.sin(angle) },
        hybrid.speed,
        damagePerProjectile,
        false,
        `fan:${hybrid.style}`,
        hybrid.pierce,
        ttl,
        undefined,
        0,
        pending.crit,
        player.id,
        weapon.id,
        CombatDelivery.HybridProjectile,
        player,
        undefined,
        undefined,
        undefined,
        0,
        hybrid.returnAfterSeconds,
        damageEnvelope,
      );
    }
  },

  damageWormSlots(this: GameRoomContext,
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
    while (controller.drainWormReward()) {
      // B20 L2: consume the legacy anatomy-reward queue without minting non-chest itemization.
    }
    this.rebuildWormSegmentGrid();
    if (result.terminal) this.damageEnemy(boss, boss.id, 0, kills, 0);
  },

  collectWormRadiusHits(this: GameRoomContext, x: number, y: number, radius: number): readonly number[] {
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
  },

  /** Apply `raw` damage, then perform shared kill, money, and portal bookkeeping. */
  damageEnemy(this: GameRoomContext,
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
    if (combo?.tg) this.removeTelegraphRow(combo.tg);
    this.meleeAttackTokens.releaseHolder(eid);
    if (combo?.targetId && this.duelTokens.get(combo.targetId) === eid)
      this.duelTokens.delete(combo.targetId);
    if (combo) combo.strike = undefined;
    const kind = ENEMY_KINDS[enemy.kind];
    if (kind) this.maybeDropEnemyWeapon(enemy, kind);
    // B20 L3: eligible authored wielders may leave one disassemblable floor weapon. The
    // pre-existing combat/progression cleanup and boss gates still run through this death path.
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
        this.advanceBossRush();
      } else {
        // Boss kills open progression; the ordinary authored-wielder drop rule is resolved above.
        this.openPortal(enemy.x, enemy.y);
      }
    }
    // §6/§17 v0.103: putting DOWN a shifter incursion (instead of just outlasting its window) pays the
    // squad a depth-scaled bounty — the chain's second wage source, and it rewards engaging the elite.
    // Money remains on the L1 drop rail; L3 adds only the eligible authored weapon pickup above.
    const killer = sourcePlayerId ? this.state.players.get(sourcePlayerId) : undefined;
    const killerCombat = sourcePlayerId ? this.combat.get(sourcePlayerId) : undefined;
    if (killer && killerCombat) this.applyKillQuirk(killer, killerCombat, enemy);
    kills.push(eid);
  },

  /** §7 v0.105 zero a player's persistent steering velocity — call at every position TELEPORT (lava gap
   *  snap-back, rift descent, restart, training reposition, revive) so carried momentum can't glide the
   *  body away from where it was authoritatively placed. §4 v0.107: also DROPS the queued/held input
   *  direction (a teleport must not replay stale pre-teleport intent; the next command lands ≤50ms later),
   *  mirrors zero velocity, and normally bumps `teleportSeq`. Repeated elevator holds can suppress only
   *  that redundant bump while one server-motion epoch already owns the complete placement window. */
  zeroMoveVel(
    this: GameRoomContext,
    id: string,
    bumpTeleport = true,
    source: ServerMotionSource,
  ): void {
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
      this.beginServerMotion(player, 1, source);
      if (c) {
        c.crouchPrevHeld = false;
        c.momentumX = 0;
        c.momentumY = 0;
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
      player.dualWield.fireInputHeld = false;
      if (bumpTeleport) player.teleportSeq = (player.teleportSeq + 1) >>> 0;
    }
  },

  /** §29 place a floor pickup on solid ground: the BELT deck (clamped into the depth band, nudged off any
   *  obstacle) in belt mode, else the arena's placement contract. */
  placePickupPos(this: GameRoomContext, x: number, y: number): { x: number; y: number } {
    if (this.belt && this.beltLevel) {
      return { x, y: clampBeltFloorY(this.beltLevel, x, y, PICKUP_RADIUS) };
    }
    return safeSpawnPos(this.map, x, y);
  },

  /** Apply an AoE blast at (x,y): damage every enemy within `radius`, with the same kill/money/portal
   *  bookkeeping as a swing hit. Used by the scatter-shot magma explosions (§14). */
  detonate(this: GameRoomContext,
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
  },

  /** §8 Emberguard fire wave — a cone of fire in front of `aim` (origin at the player), `dmg` to each enemy
   *  inside, kill bookkeeping via `damageEnemy`. The shared primitive for the on-parry wave AND the
   *  Conflagration re-pulse. */
  emberguardWave(this: GameRoomContext,
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
        )
          this.wormHitSlots.push(slot);
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
  },

  /** §7/§8 execute a parry — grant i-frames, knock nearby enemies back, and fire the owned augments. Split
   *  out of the message handler (v0.105 de-clunk) so a BUFFERED parry (one that arrived during the cooldown)
   *  can fire from the tick the instant the cd drains, not just synchronously on message arrival. */
  executeParry(this: GameRoomContext, player: PlayerState, c: CombatState): void {
    if (c.recoveryT > 0 || c.slideParryLockT > 0) return;
    if (c.stance === STANCE_SLIDE) this.cancelMoveStance(player, c, false);
    if (c.stance === STANCE_CROUCH) this.cancelMoveStance(player, c, true);
    if (c.beamPhase !== 0) this.cancelBeam(player, player.id, c, true, false);
    // G-02: the press opens only the base defensive window. Augment rewards are success-gated below.
    c.invuln = Math.max(c.invuln, PARRY_IFRAMES * c.mods.parryIFrameMult);
    c.parryCd = PARRY_COOLDOWN * c.mods.parryCooldownMult;
    c.parryOpenedTick = this.state.tick;
    const knockback = PARRY_KNOCKBACK * c.mods.parryKnockbackMult;
    const parryRadius = relicParryRadius(player.relics);
    const r2 = parryRadius * parryRadius;
    this.state.enemies.forEach((enemy, id) => {
      if (id === this.bossId && (this.bossController?.wormRuntime || this.vastagharEncounter))
        return;
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
  },

  /** §8 apply the player's owned parry AUGMENTS on a successful parry (Iron Stance is handled at the call
   *  site since it scales the base i-frames/knockback). Each augment is small + stacks; the pool builds a
   *  custom parry per run. Offense here is server-authoritative (the client renders off the synced effects). */
  applyParryAugments(this: GameRoomContext, player: PlayerState, c: CombatState): void {
    this.markWeaponResourcePressure(c);
    const owned = player.augments;
    if (!owned) return;
    const now = this.state.elapsed;

    const iron = countAugment(owned, "iron-stance");
    if (iron > 0) {
      c.invuln = Math.max(c.invuln, PARRY_IFRAMES * (1 + IRON_STANCE_IFRAME_PER * iron));
    }

    // Aegis — Second Wind (stacks): flat heal. Bulwark: a brief absorb shield.
    const sw = countAugment(owned, "second-wind");
    if (sw > 0) {
      const heal = sw * SECOND_WIND_BASE;
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
      const parryRadius = relicParryRadius(player.relics);
      const r2 = parryRadius * parryRadius;
      this.state.enemies.forEach((enemy) => {
        const dx = enemy.x - player.x;
        const dy = enemy.y - player.y;
        if (dx * dx + dy * dy <= r2) {
          this.brandedTimers.set(enemy.id, BRAND_DURATION);
          if (enemy.branded === 0) enemy.branded = 1;
        }
      });
      const root = this.bossId ? this.state.enemies.get(this.bossId) : undefined;
      if (root && this.collectWormRadiusHits(player.x, player.y, parryRadius).length > 0) {
        this.brandedTimers.set(root.id, BRAND_DURATION);
        root.branded = 1;
      }
    }
    if (hasAugment(owned, "emberguard")) {
      const dmg = EMBERGUARD_BASE_DMG;
      this.emberguardWave(
        player.x,
        player.y,
        c.aimX,
        c.aimY,
        dmg,
        this.flatCritChance(player, c),
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
  },

  /** §15/B33 duelists and derived contact melee: chase, acquire one target slot, ramp on-body, then commit. */
  enemyGroundZoneSlow(this: GameRoomContext, enemyId: string): number {
    const slow = this.enemyZoneSlow.get(enemyId);
    if (!slow) return 1;
    if (this.state.tick >= slow.untilTick) {
      this.enemyZoneSlow.delete(enemyId);
      return 1;
    }
    return slow.multiplier;
  },

  /** One enemy-movement status seam for Frostquill zones and direct-hit freezes. */
  applyEnemySlow(this: GameRoomContext, enemyId: string, multiplier: number, seconds: number): void {
    if (!(multiplier < 1) || seconds <= 0) return;
    const untilTick = (this.state.tick + Math.ceil((seconds * 1000) / TICK_MS)) >>> 0;
    const current = this.enemyZoneSlow.get(enemyId);
    this.enemyZoneSlow.set(enemyId, {
      multiplier: Math.min(current?.multiplier ?? 1, multiplier),
      untilTick: Math.max(current?.untilTick ?? 0, untilTick),
    });
  },

  applyEnemyHitStatus(this: GameRoomContext, enemyId: string, status: WeaponDef["hitStatus"]): void {
    if (status?.kind === "slow") this.applyEnemySlow(enemyId, status.multiplier, status.seconds);
  },

  /** Advance every projectile, expire at TTL/arena edge. HOSTILE projectiles hit players (parry-/
   *  level-immune); FRIENDLY (thrown) projectiles cut through enemies up to their pierce count. */
  stepProjectiles(this: GameRoomContext, dt: number): void {
    const doomed: string[] = [];
    this.state.projectiles.forEach((pr, id) => {
      const meta = this.projectileMeta.get(id);
      if (meta && (meta.deferredSteps ?? 0) > 0) {
        meta.deferredSteps = (meta.deferredSteps ?? 0) - 1;
        if (meta.returnToOwner && !meta.returnToOwner.returning)
          meta.returnToOwner.outboundSeconds -= dt;
        return;
      }
      const sweptFriendly =
        !meta?.hostile &&
        (meta?.firstStep === true ||
          meta?.delivery === CombatDelivery.Gun ||
          meta?.delivery === CombatDelivery.Cast ||
          meta?.delivery === CombatDelivery.HybridProjectile);
      let projectileFromX = meta?.firstCollisionX ?? pr.x;
      let projectileFromY = meta?.firstCollisionY ?? pr.y;
      if (meta) {
        meta.firstCollisionX = undefined;
        meta.firstCollisionY = undefined;
        meta.firstStep = false;
      }
      if (meta?.returnToOwner) {
        const returning = meta.returnToOwner;
        if (!returning.returning) {
          returning.outboundSeconds -= dt;
          if (returning.outboundSeconds <= 0) {
            returning.returning = true;
            meta.hit.clear();
            meta.pierce = meta.pierceMax ?? meta.pierce;
          }
        }
        if (returning.returning) {
          const owner = this.state.players.get(meta.sourcePlayerId ?? "");
          if (!owner || !owner.alive) {
            doomed.push(id);
            return;
          }
          const dx = owner.x - pr.x;
          const dy = owner.y - pr.y;
          const distance = Math.hypot(dx, dy);
          const speed = Math.hypot(pr.vx, pr.vy);
          if (distance <= Math.max(PLAYER_RADIUS, speed * dt)) {
            doomed.push(id);
            return;
          }
          pr.vx = (dx / distance) * speed;
          pr.vy = (dy / distance) * speed;
        }
      }
      if (meta?.waveform) {
        meta.waveform.elapsedSeconds += dt;
        const sample = projectileWaveformPositionAt(
          meta.waveform.originX,
          meta.waveform.originY,
          pr.vx,
          pr.vy,
          meta.waveform.elapsedSeconds,
          meta.waveform.definition,
        );
        pr.x = sample.x;
        pr.y = sample.y;
      } else {
        pr.x += pr.vx * dt;
        pr.y += pr.vy * dt;
      }
      pr.flightAgeTicks = Math.min(0xffff, pr.flightAgeTicks + 1);
      if (meta) meta.ttl -= dt;
      if (!meta || meta.ttl <= 0) {
        doomed.push(id);
        return;
      }
      const corporateFloor =
        this.belt && this.beltLevel ? corporateGridFloorForBelt(this.beltLevel) : undefined;
      if (
        corporateFloor &&
        this.beltLevel &&
        beltProjectileBlocked(
          this.beltLevel,
          projectileFromX,
          projectileFromY,
          pr.x,
          pr.y,
          PROJECTILE_RADIUS,
        )
      ) {
        doomed.push(id);
        return;
      }
      const worldWidth = corporateFloor?.width ?? ARENA_WIDTH;
      const oob = pr.x < 0 || pr.x > worldWidth || pr.y < 0 || pr.y > ARENA_HEIGHT;
      if (oob) {
        // §9 ricochet rounds CAROM off the arena walls; everything else expires at the edge. On each
        // carom the round RE-ARMS — fresh pierce, cleared hit-set (can re-tag enemies), refreshed life —
        // so it actually "keeps hunting" down the new leg.
        if ((meta.bounces ?? 0) > 0) {
          meta.bounces = (meta.bounces ?? 0) - 1;
          if (pr.x < 0 || pr.x > worldWidth) pr.vx = -pr.vx;
          if (pr.y < 0 || pr.y > ARENA_HEIGHT) pr.vy = -pr.vy;
          pr.x = clamp(pr.x, 0, worldWidth);
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
      if (meta.hostile) {
        let consumed = false; // the bullet is spent (landed a hit) → doom it
        let reflected = false; // …unless it was PARRIED — then it lives on as a friendly counter-shot
        this.state.players.forEach((player) => {
          if (consumed || !player.alive) return;
          const presented = this.presentedPlayerPosition(player);
          if (!presented) return;
          const reach = PROJECTILE_RADIUS + PLAYER_RADIUS;
          const dx = pr.x - presented.x;
          const dy = pr.y - presented.y;
          if (dx * dx + dy * dy > reach * reach) return; // no overlap with this player
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
          this.beginServerMotion(player, SERVER_MOTION_IMPULSE_TICKS, "hostile-projectile-hit");
          consumed = true;
        });
        if (consumed && !reflected) doomed.push(id);
      } else if (meta.landingZoneDamage === undefined) {
        // Friendly projectile: damage each fresh enemy it touches until pierce runs out. Landing grenades
        // stay airborne for their complete server-owned flight and apply only their ground-zone payload.
        const kills: string[] = [];
        const projectileRadius = meta.damageEnvelope?.radius ?? PROJECTILE_RADIUS;
        const uprightHalfLength =
          meta.damageEnvelope?.orientation === "upright" ? meta.damageEnvelope.halfLength : 0;
        const projectileVerticalExtent = projectileRadius + uprightHalfLength;
        if (sweptFriendly) {
          this.enemyGrid.queryAabb(
            Math.min(projectileFromX, pr.x) - projectileRadius - MAX_ENEMY_RADIUS,
            Math.min(projectileFromY, pr.y) - projectileVerticalExtent - MAX_ENEMY_RADIUS,
            Math.max(projectileFromX, pr.x) + projectileRadius + MAX_ENEMY_RADIUS,
            Math.max(projectileFromY, pr.y) + projectileVerticalExtent + MAX_ENEMY_RADIUS,
            this.enemyCandidates,
          );
        } else {
          this.enemyGrid.queryRadius(
            pr.x,
            pr.y,
            projectileVerticalExtent + MAX_ENEMY_RADIUS,
            this.enemyCandidates,
          );
        }
        let targetRicocheted = false;
        for (const eid of this.enemyCandidates) {
          if (meta.pierce <= 0 || meta.hit.has(eid)) continue;
          const enemy = this.state.enemies.get(eid);
          if (!enemy) continue;
          const reach = (ENEMY_KINDS[enemy.kind]?.radius ?? ENEMY_RADIUS) + projectileRadius;
          const collided = sweptFriendly
            ? pointSweptUprightCapsuleDistanceSq(
                enemy.x,
                enemy.y,
                projectileFromX,
                projectileFromY,
                pr.x,
                pr.y,
                uprightHalfLength,
              ) <=
              reach * reach
            : pointSegmentDistanceSq(
                enemy.x,
                enemy.y,
                pr.x,
                pr.y - uprightHalfLength,
                pr.x,
                pr.y + uprightHalfLength,
              ) <=
              reach * reach;
          if (collided) {
            meta.hit.add(eid);
            meta.pierce -= 1;
            // Route through the ONE damage primitive (Brand · dummy-reset · boss portal · money drop) so the
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
            if (meta.delivery === CombatDelivery.Gun)
              this.applyProjectileChain(enemy, eid, meta, kills);
            if (this.redirectThrownRicochet(pr, meta)) {
              targetRicocheted = true;
              break;
            }
          }
        }
        const runtime = this.bossController?.wormRuntime;
        if (!targetRicocheted && runtime && meta.pierce > 0) {
          this.wormHitSlots.length = 0;
          this.wormSegmentGrid.queryAabb(
            Math.min(projectileFromX, pr.x) - projectileRadius - 52,
            Math.min(projectileFromY, pr.y) - projectileVerticalExtent - 52,
            Math.max(projectileFromX, pr.x) + projectileRadius + 52,
            Math.max(projectileFromY, pr.y) + projectileVerticalExtent + 52,
            this.wormSegmentCandidates,
          );
          let wormContacts = 0;
          for (const slot of this.wormSegmentCandidates) {
            if (meta.pierce <= 0 || wormContacts >= 2) break;
            const hitKey = `worm:${slot}:${runtime.segmentGeneration(slot)}`;
            if (meta.hit.has(hitKey)) continue;
            const verticalOffsets =
              uprightHalfLength > 0 ? [-uprightHalfLength, 0, uprightHalfLength] : [0];
            if (
              !verticalOffsets.some((offsetY) =>
                runtime.segmentIntersectsSweptCapsule(
                  slot,
                  projectileFromX,
                  projectileFromY + offsetY,
                  pr.x,
                  pr.y + offsetY,
                  projectileRadius,
                ),
              )
            )
              continue;
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
        if (meta.pierce <= 0 && (meta.bounces ?? 0) <= 0 && meta.returnToOwner === undefined)
          doomed.push(id);
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
      if (pr && meta?.landingZoneDamage !== undefined) {
        const owner = this.state.players.get(meta.sourcePlayerId ?? "");
        const weapon = WEAPONS[meta.sourceWeaponId ?? ""];
        if (owner && weapon?.groundZone?.trigger === "landing")
          this.spawnWeaponGroundZoneAt(
            owner,
            weapon,
            pr.x,
            pr.y,
            meta.landingZoneDamage,
            meta.crit ?? 0,
          );
      }
      this.removeProjectile(id);
    }
  },

  /** §8 v0.117 PROJECTILE PARRY — a hostile bullet caught in the i-frame window is DEFLECTED. Two modes:
   *  • BASE (no augment): it GLANCES off to the side and fades — like a round pinging off Superman. Pure
   *    defense, zero enemy damage, a brief spark (kind "deflect", short TTL).
   *  • `deflector` augment: it RICOCHETS BACK at the nearest enemy — a friendly counter-shot, boosted speed
   *    + damage (kind "counter"), the offensive upgrade.
   *  Either way it fires the parry reward (flash + heal + FLOW cd + chain build) so catching a spit chains
   *  like a melee parry, and the client re-skins the bullet mid-flight (it sees `hostile`+`kind` flip). */
  reflectProjectile(this: GameRoomContext,
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
    const preventedDamage = meta.damage;
    const incomingX = pr.vx;
    const incomingY = pr.vy;
    if (meta.hostile) this.hostileProjectileCount = Math.max(0, this.hostileProjectileCount - 1);
    pr.hostile = false;
    meta.hostile = false;
    meta.sourcePlayerId = player.id;
    meta.sourceWeaponId = player.weapon;
    pr.sourcePlayerId = player.id;
    pr.sourceWeaponId = player.weapon;
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
    this.applyDirectionalParryReaction(player, pc, incomingX, incomingY, preventedDamage);
    pc.parryCd = Math.min(pc.parryCd, PARRY_CHAIN_CD);
    pc.parryChain = pc.parryChainT > 0 ? pc.parryChain + 1 : 1;
    pc.parryChainT = PARRY_CHAIN_WINDOW;
    this.applyHeal(player, PARRY_CHAIN_HEAL);
    this.applyParryAugments(player, pc);
    this.applyParryQuirk(player, pc, PARRY_CHAIN_HEAL);
    this.recordPetAcceptedAction(player.id);
  },

  /** Beam-heat-style ultimate truth: private float, quantized mirror, one ready sequence edge. */
  syncUltimateCharge(this: GameRoomContext, player: PlayerState, c: CombatState): void {
    if (!ULTIMATES_ENABLED) {
      c.ultChargeF = 0;
      player.ultCharge = 0;
      return;
    }
    const quantized = Math.max(
      0,
      Math.min(ULT_CHARGE_MAX, Math.floor(c.ultChargeF * ULT_CHARGE_MAX + 1e-9)),
    );
    if (player.ultCharge === quantized) return;
    const becameReady = player.ultCharge < ULT_CHARGE_MAX && quantized >= ULT_CHARGE_MAX;
    player.ultCharge = quantized;
    if (becameReady) player.ultSeq = (player.ultSeq + 1) & 0xffff;
  },

  /** Personal anti-farm seam shared by ordinary enemies and Serraketh slots. */
  accrueUltimateCharge(this: GameRoomContext,
    sourcePlayerId: string,
    applied: number,
    finalBlow: boolean,
    enemyKind: string,
    delivery: number,
  ): void {
    if (!ULTIMATES_ENABLED) return;
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
    )
      return;
    const gain =
      Math.max(0, applied) * ULT_CHARGE_PER_DAMAGE + (finalBlow ? ULT_CHARGE_KILL_BONUS : 0);
    const admitted = Math.min(gain, ULT_CHARGE_TICK_CAP - c.ultAccrualThisTick, 1 - c.ultChargeF);
    if (admitted <= 0) return;
    c.ultAccrualThisTick += admitted;
    c.ultChargeF += admitted;
    this.syncUltimateCharge(player, c);
  },

  addUltimateFlatCharge(this: GameRoomContext, player: PlayerState, c: CombatState, amount: number): void {
    if (!ULTIMATES_ENABLED) return;
    if (
      this.state.mode === "training" ||
      !player.alive ||
      player.ultArchetype === 0 ||
      player.ultPhase !== UltimatePhase.Idle ||
      c.ultChargeF >= 1 ||
      c.ultAccrualThisTick >= ULT_CHARGE_TICK_CAP
    )
      return;
    const admitted = Math.min(amount, ULT_CHARGE_TICK_CAP - c.ultAccrualThisTick, 1 - c.ultChargeF);
    if (admitted <= 0) return;
    c.ultAccrualThisTick += admitted;
    c.ultChargeF += admitted;
    this.syncUltimateCharge(player, c);
  },
} satisfies ThisType<GameRoomContext>;
