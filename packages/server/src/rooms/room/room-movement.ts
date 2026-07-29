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
  LAVA_GAP_FALL_DAMAGE_FRAC,
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

export const roomMovementMethods = {

  /** Consume the two jump-feel command bits on their exact acknowledged input tick. */
  consumeMoveStanceInput(this: GameRoomContext,
    player: PlayerState,
    input: InputState,
    c: CombatState,
    cmd: InputCmd,
  ): void {
    if (cmd.pound) {
      if (
        player.alive &&
        player.height > POUND_MIN_HEIGHT &&
        !c.poundUsed &&
        (c.stance === STANCE_NONE || c.stance === STANCE_DASH)
      ) {
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
      } else if (player.height > GROUND_EPSILON && player.height <= POUND_MIN_HEIGHT) {
        // The first/last sliver keeps the old "press before landing" buffer rather than stealing it.
        c.jumpBuffer = JUMP_BUFFER_SECONDS;
      }
    }

    // Shift and Ctrl collapse to one unbuffered edge. Direction is frozen at acceptance and the cooldown
    // is time-owned; held state, run-up speed, later steering, release timing, and aim changes cannot alter it.
    if (
      cmd.slide &&
      player.alive &&
      player.height <= GROUND_EPSILON &&
      c.stance === STANCE_NONE &&
      c.recoveryT <= 0 &&
      c.rollCd <= 0 &&
      !c.juggleArmed &&
      c.invuln <= 0 &&
      c.lavaGapGrace <= 0
    ) {
      let dx = cmd.dx;
      let dy = cmd.dy;
      let length = Math.hypot(dx, dy);
      if (length <= 1e-4) {
        dx = input.mvx;
        dy = input.mvy;
        length = Math.hypot(dx, dy);
      }
      if (length <= 1e-4) {
        dx = c.aimX;
        dy = c.aimY;
        length = Math.hypot(dx, dy);
      }
      if (length > 1e-4) {
        const speed = relicRollSpeedAtTick(player.relics, 0);
        c.momentumX = (dx / length) * speed;
        c.momentumY = (dy / length) * speed;
        c.slidePhase = SLIDE_PHASE_GROUND;
        c.slidePhaseTick = 0;
        c.slideParryLockT = ROLL_PARRY_LOCK_SECONDS + TICK_MS / 1000;
        c.attackBuffer = 0;
        input.mvx = c.momentumX;
        input.mvy = c.momentumY;
        player.mvx = input.mvx;
        player.mvy = input.mvy;
        if (c.beamPhase !== 0 || c.beamDescriptor)
          this.cancelBeam(player, player.id, c, true, false);
        this.setMoveStance(player, c, STANCE_SLIDE);
        this.beginServerMotion(player, ROLL_DURATION_TICKS + 1, "dodge-roll");
      }
    }
  },

  setMoveStance(this: GameRoomContext, player: PlayerState, c: CombatState, stance: MoveStance): void {
    if (c.stance === stance) return;
    c.stance = stance;
    player.moveStance = stance;
  },

  syncSlideWire(this: GameRoomContext, player: PlayerState, c: CombatState): void {
    if (c.stance === STANCE_SLIDE && c.slidePhase === SLIDE_PHASE_GROUND) {
      const raw = Math.hypot(c.momentumX, c.momentumY);
      if (raw > 1e-4 && Number.isFinite(raw)) {
        const scale = relicRollSpeedAtTick(player.relics, c.slidePhaseTick) / raw;
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
  },

  /** Forced cancels alone bump stanceSeq; organic abort/launch/landing edges only change moveStance. */
  cancelMoveStance(this: GameRoomContext, player: PlayerState, c: CombatState, forced: boolean): void {
    if (c.stance === STANCE_NONE) return;
    if (c.stance === STANCE_SLIDE) {
      const input = this.inputs.get(player.id);
      if (input) {
        input.mvx = 0;
        input.mvy = 0;
        player.mvx = input.mvx;
        player.mvy = input.mvy;
      }
      c.rollCd = Math.max(c.rollCd, relicDodgeCooldown(player.relics));
      c.momentumX = 0;
      c.momentumY = 0;
      c.slidePhase = SLIDE_PHASE_OFF;
      c.slidePhaseTick = 0;
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
  },

  /** Swept environment half of B42's envelope. The numeric budget is shared; only the room owns map truth. */
  clientMovementNavValid(this: GameRoomContext,
    player: PlayerState,
    combat: CombatState | undefined,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
  ): boolean {
    if (![fromX, fromY, toX, toY].every(Number.isFinite)) return false;
    const dx = toX - fromX;
    const dy = toY - fromY;
    const distance = Math.hypot(dx, dy);
    const samples = Math.max(1, Math.ceil(distance / 4));
    const grounded = player.height <= GROUND_EPSILON && (combat?.vh ?? 0) <= 0;

    if (this.belt && this.beltLevel) {
      const level = this.beltLevel;
      const beltX = beltPlayableXBounds(level);
      const rightBound =
        (this.state.beltLockX > 0 ? this.state.beltLockX : beltX.maxX) - PLAYER_RADIUS;
      for (let sample = 1; sample <= samples; sample++) {
        const progress = sample / samples;
        const x = fromX + dx * progress;
        const y = fromY + dy * progress;
        if (
          x < beltX.minX + PLAYER_RADIUS ||
          x > rightBound ||
          y < BELT_Y0 ||
          y > BELT_Y0 + DEPTH_MAX
        )
          return false;
        const resolved = resolveBeltNavigation(level, x, y, PLAYER_RADIUS);
        if (Math.hypot(resolved.x - x, resolved.y - y) > 0.75) return false;
      }
      return true;
    }

    for (let sample = 1; sample <= samples; sample++) {
      const progress = sample / samples;
      const x = fromX + dx * progress;
      const y = fromY + dy * progress;
      if (
        x < PLAYER_RADIUS ||
        x > ARENA_WIDTH - PLAYER_RADIUS ||
        y < PLAYER_RADIUS ||
        y > ARENA_HEIGHT - PLAYER_RADIUS ||
        (grounded && isLavaGapAtPx(this.map, x, y))
      )
        return false;
    }
    return true;
  },

  /** Begin or extend an authored server-displacement window. Epoch advances only on a new ownership edge. */
  beginServerMotion(
    this: GameRoomContext,
    player: PlayerState,
    ticks: number,
    source: ServerMotionSource,
  ): void {
    const duration = Math.max(1, Math.ceil(ticks));
    const candidate = (this.state.tick + duration) >>> 0;
    const current = this.serverMotionUntilTick.get(player.id);
    if (current === undefined || tickReached(candidate, current))
      this.serverMotionUntilTick.set(player.id, candidate);
    this.serverMotionSourceByPlayer.set(player.id, source);
    if (!player.dualWield.serverMotionActive) {
      player.dualWield.serverMotionEpoch = (player.dualWield.serverMotionEpoch + 1) >>> 0;
      player.dualWield.serverMotionActive = true;
    }
  },

  /** Register placement ownership before any position field is mutated in the supplied atomic callback. */
  placeWithMotionEpoch(
    this: GameRoomContext,
    player: PlayerState,
    source: ServerMotionSource,
    place: () => void,
    ticks = 1,
  ): void {
    this.beginServerMotion(player, ticks, source);
    place();
    const presented = this.presentedSelfBodies.get(player.id);
    // The client may still be drawing the pre-placement body until it reports the next visible frame.
    if (presented?.reported) presented.hittable = false;
  },

  /** Recompute the wire flag before consuming this tick's client report. */
  refreshServerMotionState(this: GameRoomContext, player: PlayerState, id: string, _dt: number): void {
    const untilTick = this.serverMotionUntilTick.get(id);
    const timed = untilTick !== undefined && !tickReached(this.state.tick, untilTick);
    if (untilTick !== undefined && !timed) {
      this.serverMotionUntilTick.delete(id);
      this.serverMotionSourceByPlayer.delete(id);
    }
    const ultimate = this.ultimateOwnsMovement(player);
    if (ultimate) this.serverMotionSourceByPlayer.set(id, "ultimate");
    const active = timed || ultimate;
    if (active && !player.dualWield.serverMotionActive)
      player.dualWield.serverMotionEpoch = (player.dualWield.serverMotionEpoch + 1) >>> 0;
    player.dualWield.serverMotionActive = active;
    if (!active) this.serverMotionSourceByPlayer.delete(id);
  },

  freshInputState(this: GameRoomContext): InputState {
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
      traversalEdgeBudget: 1,
      lastFreshFireTick: 0,
      actionBudget: ACTION_MSGS_PER_TICK,
      mvx: 0,
      mvy: 0,
    };
  },

  /** End the fixed roll after its eighth integrated sample; cooldown begins on this authored edge. */
  stepSlideStance(this: GameRoomContext, player: PlayerState, c: CombatState): void {
    if (
      c.stance !== STANCE_SLIDE ||
      c.slidePhase !== SLIDE_PHASE_GROUND ||
      c.slidePhaseTick < ROLL_DURATION_TICKS
    )
      return;
    const length = Math.hypot(c.momentumX, c.momentumY);
    const dirX = length > 1e-4 ? c.momentumX / length : 0;
    const dirY = length > 1e-4 ? c.momentumY / length : 0;
    this.cancelMoveStance(player, c, false);
    const input = this.inputs.get(player.id);
    if (input) {
      const moveSpeed = relicMoveSpeed(player.relics);
      input.mvx = dirX * moveSpeed;
      input.mvy = dirY * moveSpeed;
      player.mvx = input.mvx;
      player.mvy = input.mvy;
    }
  },

  damageLavaGapFall(this: GameRoomContext, player: PlayerState): void {
    this.damagePlayer(player, player.maxHp * LAVA_GAP_FALL_DAMAGE_FRAC, "lava-gap");
    const pet = this.petRuns.get(player.id);
    if (player.hp > 0 && pet?.mods.lavaGapRegenSeconds) {
      pet.tortoiseLavaGapRegenSeconds = pet.mods.lavaGapRegenSeconds;
    }
  },

  /** Traversal acceptance runs before horizontal integration. Space consumes directly into
   *  the authored distance jump; there is no ordinary-hop or crouch/charge intermediate sentence. */
  stepTraversalLaunches(this: GameRoomContext, dt: number): void {
    this.distanceJumpLaunches.clear();
    this.state.players.forEach((player, id) => {
      const c = this.combat.get(id);
      if (!c) return;
      c.jumpCd = Math.max(0, c.jumpCd - dt);
      c.jumpBuffer = Math.max(0, c.jumpBuffer - dt);
      c.distJumpCd = Math.max(0, c.distJumpCd - dt);
      const acting = this.state.outcome === "active" && player.alive;
      if (!acting) return;

      const grounded = player.height <= GROUND_EPSILON;
      const airJump =
        !grounded &&
        player.relics.airJumpsRemaining > 0 &&
        (c.stance === STANCE_NONE || c.stance === STANCE_DASH);
      if (
        (c.stance === STANCE_NONE || airJump) &&
        c.recoveryT <= 0 &&
        c.jumpBuffer > 0 &&
        (grounded ? c.distJumpCd <= 0 : airJump)
      ) {
        c.jumpBuffer = 0;
        const input = this.inputs.get(id);
        if (input) {
          if (airJump) {
            this.cancelMoveStance(player, c, false);
            player.relics.airJumpsRemaining--;
          } else {
            player.relics.airJumpsRemaining = relicJumpCount(player.relics);
          }
          this.launchDistanceJump(player, c, input);
          // launchDistanceJump mutates c.stance; read it widened so the narrowing from the
          // STANCE_NONE guard above doesn't make this (correct) comparison look impossible.
          const stanceAfterLaunch: number = c.stance;
          if (stanceAfterLaunch === STANCE_DASH) this.distanceJumpLaunches.add(id);
        }
      }
    });
  },

  launchDistanceJump(this: GameRoomContext, player: PlayerState, c: CombatState, input: InputState): void {
    let dx = input.held.dx;
    let dy = input.held.dy;
    let len = Math.hypot(dx, dy);
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

    const beltX = this.beltLevel ? beltPlayableXBounds(this.beltLevel) : undefined;
    const rawX = clamp(
      player.x + dx * DIST_JUMP_REACH,
      (beltX?.minX ?? 0) + PLAYER_RADIUS,
      (beltX?.maxX ?? ARENA_WIDTH) - PLAYER_RADIUS,
    );
    const rawY = clamp(
      player.y + dy * DIST_JUMP_REACH,
      PLAYER_RADIUS,
      ARENA_HEIGHT - PLAYER_RADIUS,
    );
    let targetX: number;
    let targetY: number;
    if (this.belt && this.beltLevel) {
      const target = resolveBeltNavigation(this.beltLevel, rawX, rawY, PLAYER_RADIUS);
      targetX = target.x;
      targetY = target.y;
    } else {
      const safe = safeSpawnPos(this.map, rawX, rawY);
      targetX = safe.x;
      targetY = safe.y;
    }
    dx = targetX - player.x;
    dy = targetY - player.y;
    len = Math.hypot(dx, dy);
    // Endpoint validation may legitimately collapse onto takeoff (for example, a small isolated safe
    // floor patch). That removes horizontal travel, not the authored jump sentence.
    const stationary = len <= 1e-4;
    c.dashDirX = stationary ? 0 : dx / len;
    c.dashDirY = stationary ? 0 : dy / len;
    c.dashBaseDirX = c.dashDirX;
    c.dashBaseDirY = c.dashDirY;
    c.dashSteer = 0;
    c.dashSpeed = stationary ? 0 : Math.min(DIST_JUMP_SPEED, len / DIST_JUMP_AIRTIME);
    c.distJumpCd = DIST_JUMP_COOLDOWN;
    c.vh = DIST_JUMP_VERTICAL_VELOCITY;
    player.vh = c.vh;
    input.mvx = c.dashDirX * c.dashSpeed;
    input.mvy = c.dashDirY * c.dashSpeed;
    player.mvx = input.mvx;
    player.mvy = input.mvy;
    this.setMoveStance(player, c, STANCE_DASH);
    this.beginServerMotion(
      player,
      Math.ceil(DIST_JUMP_AIRTIME / (TICK_MS / 1000)) + 1,
      "distance-jump",
    );
  },

  /** Bend toward held WASD at <=45°/s and never farther than ±27° from the launch heading. */
  steerDistanceJump(this: GameRoomContext, c: CombatState, input: InputCmd, dt: number): void {
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
  },

  finishPlayerLanding(this: GameRoomContext,
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
        const moveSpeed = relicMoveSpeed(player.relics);
        input.mvx = c.dashDirX * moveSpeed * DIST_JUMP_LANDING_SPEED_MULT;
        input.mvy = c.dashDirY * moveSpeed * DIST_JUMP_LANDING_SPEED_MULT;
        player.mvx = input.mvx;
        player.mvy = input.mvy;
      }
    }
    if (landingStance !== STANCE_NONE && landingStance !== STANCE_SLIDE)
      this.cancelMoveStance(player, c, false);
    c.poundUsed = false;
  },

  /** One postcondition for every blink/hop/dash endpoint: range, bounds, deck, lava platform, gate. */
  navValidDest(this: GameRoomContext,
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
      const floor = corporateGridFloorForBelt(this.beltLevel);
      const right =
        (this.state.beltLockX > 0 ? this.state.beltLockX : this.beltLevel.length) - PLAYER_RADIUS;
      if (floor) {
        const min = floor.playableBounds.minX + PLAYER_RADIUS;
        const max = Math.min(right, floor.playableBounds.maxX - PLAYER_RADIUS);
        const safeX = clamp(ranged.x, min, max);
        const resolved = resolveBeltNavigation(
          this.beltLevel,
          safeX,
          ranged.y,
          PLAYER_RADIUS,
        );
        return { x: Math.min(max, resolved.x), y: resolved.y };
      }
      let x = clamp(ranged.x, PLAYER_RADIUS, right);
      const obstacle = resolveBeltObstacles(
        this.beltLevel,
        x,
        clamp(ranged.y, BELT_Y0, BELT_Y0 + DEPTH_MAX),
        PLAYER_RADIUS,
      );
      x = Math.min(right, obstacle.x);
      return { x, y: clampBeltFloorY(this.beltLevel, x, obstacle.y, PLAYER_RADIUS) };
    }
    let x = clamp(ranged.x, PLAYER_RADIUS, ARENA_WIDTH - PLAYER_RADIUS);
    let y = clamp(ranged.y, PLAYER_RADIUS, ARENA_HEIGHT - PLAYER_RADIUS);
    let safe = safeSpawnPos(this.map, x, y);
    x = safe.x;
    y = safe.y;
    if (Number.isFinite(maxRange)) {
      const finalRange = clampQuakeEpicenter(player, { x, y }, Math.max(0, maxRange));
      x = clamp(finalRange.x, PLAYER_RADIUS, ARENA_WIDTH - PLAYER_RADIUS);
      y = clamp(finalRange.y, PLAYER_RADIUS, ARENA_HEIGHT - PLAYER_RADIUS);
      safe = safeSpawnPos(this.map, x, y);
      x = safe.x;
      y = safe.y;
    }
    return { x, y };
  },
} satisfies ThisType<GameRoomContext>;
