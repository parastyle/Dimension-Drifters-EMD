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
import type { InputCmd, InputState, WeaponResourceLedger, WeaponSpendReason, ZoneRuntime, WeaponSpendResult, PendingScatterVolley, PendingHybridProjectile, PendingWeaponThrow, ActiveMeleeSwing, DriveRuntime, RunWeaponLedger, PickupWeaponBankMeta, DisconnectedPlayerReservation, PlayerDamageKind, PetRunRuntime, UltimateTarget, UltimateRuntime, WeaponHand, CombatState, DuelistComboState, RewardBoundary, GameRoomContext } from "./room-progression.js";

export const roomEnemyMethods = {

  /** Delete enemies within `radius` of a point (respawn breathing room). Never clears the boss —
   *  it must be defeated, not despawned by a nearby respawn (§16). */
  clearEnemiesNear(this: GameRoomContext, x: number, y: number, radius: number): void {
    const r2 = radius * radius;
    const doomed: string[] = [];
    this.state.enemies.forEach((enemy, id) => {
      if (id === this.bossId) return;
      const dx = enemy.x - x;
      const dy = enemy.y - y;
      if (dx * dx + dy * dy <= r2) doomed.push(id);
    });
    for (const id of doomed) this.state.enemies.delete(id);
  },

  /** §45 rebuild the ONE enemy broad phase for this fixed tick. Later movement uses `update`, not a rebuild. */
  rebuildEnemyGrid(this: GameRoomContext): void {
    this.enemyGrid.clear();
    this.oversizedEnemyIds.length = 0;
    this.state.enemies.forEach((enemy, id) => {
      this.insertEnemyGrid(id, enemy);
    });
    this.rebuildWormSegmentGrid();
  },

  insertEnemyGrid(this: GameRoomContext, id: string, enemy: EnemyState): void {
    if (id === this.bossId && this.bossController?.wormRuntime) return;
    this.enemyGrid.insert(id, enemy.x, enemy.y);
    const radius = ENEMY_KINDS[enemy.kind]?.radius ?? ENEMY_RADIUS;
    if (radius > ENEMY_GRID_CELL_SIZE / 2 && !this.oversizedEnemyIds.includes(id)) {
      this.oversizedEnemyIds.push(id);
    }
  },

  updateEnemyGrid(this: GameRoomContext, id: string, enemy: EnemyState): void {
    if (id === this.bossId && this.bossController?.wormRuntime) {
      this.enemyGrid.remove(id);
      return;
    }
    this.enemyGrid.update(id, enemy.x, enemy.y);
  },

  rebuildWormSegmentGrid(this: GameRoomContext): void {
    this.wormSegmentGrid.clear();
    const runtime = this.bossController?.wormRuntime;
    if (!runtime || !this.state.wormBoss.active) return;
    for (let slot = 0; slot < WORM_MAX_SEGMENTS; slot++) {
      if (!runtime.isTargetable(slot)) continue;
      this.wormSegmentGrid.insert(slot, runtime.x[slot]!, runtime.y[slot]!);
    }
  },

  effectiveEnemyBodies(this: GameRoomContext): number {
    const runtime = this.bossController?.wormRuntime;
    if (!runtime || !this.state.wormBoss.active) return this.state.enemies.size;
    return this.state.enemies.size + runtime.effectiveBodyCount - 1;
  },

  /** §5/§45 horde body collision. Each unordered grid pair contributes a radius-overlap correction into
   * fixed tick-local buffers; one capped integration prevents pair-order shoves and enemy stacks without
   * an O(n²) scan. Boss/dummy bodies are anchors (ordinary enemies move one-way around them); the worm's
   * compatibility root/segments never enter this grid. Player push-out remains the existing one-way law. */
  resolveEnemyCollisions(this: GameRoomContext): void {
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
  },

  /** §16 v0.109 run the active boss's data-driven controller (replaces the hardcoded OLD RUST machine). It
   *  owns the boss's movement + phase escalation + telegraphed attacks; the GameRoom only wires the emit
   *  sink (projectiles/AoE/zones/adds/telegraphs) so hit + damage plumbing stays here. When the boss is
   *  gone (killed/removed), tears down: null the controller, clear its telegraphs, blank the synced label. */
  stepBoss(this: GameRoomContext, dt: number, bodies: Vec2[]): void {
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
    while (this.bossController.drainWormReward()) {
      // B20 L2: consume the legacy anatomy-reward queue without minting non-chest itemization.
    }
  },

  /** Tear down the active boss: dispose the controller (removes its in-flight telegraphs), reset the synced
   *  boss fields. Called when the boss dies/vanishes or the run restarts. */
  clearBoss(this: GameRoomContext): void {
    this.vastagharEncounter?.dispose(this.bossSink as VastagharEmitSink);
    this.vastagharEncounter = null;
    this.vastagharTargets.length = 0;
    this.vastagharDownTicks.clear();
    this.vastagharSweepEpoch.clear();
    this.vastagharVictoryMode = "";
    this.vastagharMoneyAwarded = false;
    this.bossController?.dispose(this.bossSink, this.state.tick);
    this.bossController = null;
    this.wormSegmentGrid.clear();
    this.bossId = null;
    this.bossPetAwardEligible = false;
    this.bossAddIds.clear();
    this.bossAddExpireTick.clear();
    this.state.bossPhase = 0;
    this.state.bossKind = "";
    this.state.bossSlamT = 0; // §16 deprecated slam scalars stay at 0
    // Boss disposal owns every remaining row; horde melee no longer publishes floor geometry.
    this.state.telegraphs.clear();
  },

  /** §16 v0.109 the emit surface handed to the BossController — turns a boss def's abstract "casts" into real
   *  sim: hostile projectiles, telegraph rows, corrosive zones, adds, and unparryable AoE. Built once, lazily. */
  get bossSink(): VastagharEmitSink {
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
            return {
              x: beltSafeX(this.beltLevel, bx, bx),
              y: clampBeltFloorY(this.beltLevel, bx, y, radius),
            };
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
  },

  /** §16/§15 v0.113 create a synced telegraph row (used by boss casts AND enemy leaps). Returns its id. */
  addTelegraphRow(this: GameRoomContext, 
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
  },

  /** Set a telegraph row's fill progress 0→1. */
  setTelegraphRowProgress(this: GameRoomContext, id: string, prog: number): void {
    const row = this.state.telegraphs.get(id);
    if (row) row.t = prog;
  },

  /** Remove a telegraph row (the client edge-fires its impact VFX if it had filled). */
  removeTelegraphRow(this: GameRoomContext, id: string): void {
    this.state.telegraphs.delete(id);
  },

  /** §16 an unparryable radius AoE (the generalised punch-slam): flat damage + a hard radial knockback to
   *  every living player inside. `damage` arrives already depth-scaled from the controller. */
  applyBossAoE(this: GameRoomContext, 
    x: number,
    y: number,
    radius: number,
    damage: number,
    knockback: number,
  ): void {
    const r2 = radius * radius;
    this.state.players.forEach((p) => {
      if (!p.alive) return;
      const dx = p.x - x;
      const dy = p.y - y;
      if (dx * dx + dy * dy > r2) return;
      this.damagePlayer(p, damage, "enemy"); // §16 unparryable — dodge it, don't block it
      const d = Math.hypot(dx, dy) || 1;
      const k = addImpulse(p, (dx / d) * knockback, (dy / d) * knockback);
      p.vx = k.vx;
      p.vy = k.vy;
      this.beginServerMotion(p, SERVER_MOTION_IMPULSE_TICKS, "enemy-commit-hit");
    });
  },

  /** §33 FOOTFALL QUAKE resolve: a ground shockwave you JUMP over or PARRY. Grounded, un-parried players in
   *  the radius take it + a radial shove; AIRBORNE players (mid-jump) clear it; a player in a parry/i-frame
   *  window NEGATES it (white flash — the timing reward). This is the colossus's whole rhythm. */
  applyBossQuake(this: GameRoomContext, 
    x: number,
    y: number,
    radius: number,
    damage: number,
    knockback: number,
  ): void {
    const r2 = radius * radius;
    this.state.players.forEach((p) => {
      if (!p.alive) return;
      const dx = p.x - x;
      const dy = p.y - y;
      if (dx * dx + dy * dy > r2) return;
      if (p.height > GROUND_EPSILON) return; // JUMPED — airborne clears the quake
      const c = this.combat.get(p.id);
      if (c && c.pitGrace > 0) return; // mercy nullifies damage but is never a rewarded parry
      if (c && c.invuln > 0) {
        p.parriedSeq += 1; // PARRIED (i-frame window) — negate + trigger the white parry flash
        c.parryCd = Math.min(c.parryCd, PARRY_CHAIN_CD);
        this.applyDirectionalParryReaction(p, c, dx, dy, damage);
        this.applyParryAugments(p, c);
        this.bossController?.acceptWormParry(p.id, this.state.tick);
        return;
      }
      this.damagePlayer(p, damage, "enemy");
      const d = Math.hypot(dx, dy) || 1;
      const k = addImpulse(p, (dx / d) * knockback, (dy / d) * knockback);
      p.vx = k.vx;
      p.vy = k.vy;
      this.beginServerMotion(p, SERVER_MOTION_IMPULSE_TICKS, "enemy-commit-hit");
    });
  },

  /** One-foot-one-epoch flagship quake. Only authoritative jump/parry answers buy Stride/punish credit. */
  applyVastagharQuake(this: GameRoomContext, 
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
      if (!player.alive) return;
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
        this.resolveVastagharParry(player, combat, x, y, damage);
        return;
      }
      if (combat && (combat.pitGrace > 0 || this.slideInvulnerable(combat) || combat.invuln > 0)) {
        if (this.slideInvulnerable(combat)) this.noteSlideDodge(player);
        return;
      }
      out.hit++;
      this.damagePlayer(player, damage, "enemy");
      const distance = Math.hypot(dx, dy) || 1;
      const impulse = addImpulse(player, (dx / distance) * knockback, (dy / distance) * knockback);
      player.vx = impulse.vx;
      player.vy = impulse.vy;
      this.beginServerMotion(player, SERVER_MOTION_IMPULSE_TICKS, "enemy-commit-hit");
    });
  },

  /** Swept-angular truth with a per-player/per-revolution receipt. A two-turn Worldwheel can hit twice. */
  applyVastagharSweep(this: GameRoomContext, 
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
      if (!player.alive) return;
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
      )
        return;
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
        this.resolveVastagharParry(player, combat, x, y, damage);
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
      const impulse = addImpulse(player, (dx / distance) * knockback, (dy / distance) * knockback);
      player.vx = impulse.vx;
      player.vy = impulse.vy;
      this.beginServerMotion(player, SERVER_MOTION_IMPULSE_TICKS, "enemy-commit-hit");
    });
  },

  vastagharParryActive(this: GameRoomContext, player: PlayerState, combat: CombatState): boolean {
    if (combat.invuln <= 0 || combat.parryOpenedTick === 0xffffffff) return false;
    const windowSeconds = Math.max(
      PARRY_IFRAMES * combat.mods.parryIFrameMult,
      PARRY_IFRAMES * (1 + IRON_STANCE_IFRAME_PER * countAugment(player.augments, "iron-stance")),
    );
    const windowTicks = Math.ceil((windowSeconds * 1000) / TICK_MS);
    return (this.state.tick - combat.parryOpenedTick) >>> 0 <= windowTicks;
  },

  /** Same personal chain/cooldown/heal/augment ledger as melee parry, without moving the 230px titan root. */
  resolveVastagharParry(this: GameRoomContext, 
    player: PlayerState,
    combat: CombatState,
    sourceX: number,
    sourceY: number,
    preventedDamage: number,
  ): void {
    this.recordPetAcceptedAction(player.id);
    player.parriedSeq = (player.parriedSeq + 1) % 100000;
    combat.parryCd = Math.min(combat.parryCd, PARRY_CHAIN_CD);
    combat.parryChain = combat.parryChainT > 0 ? combat.parryChain + 1 : 1;
    combat.parryChainT = PARRY_CHAIN_WINDOW;
    const heal = PARRY_CHAIN_HEAL * Math.min(combat.parryChain, PARRY_CHAIN_HEAL_MAX_STACKS);
    this.applyHeal(player, heal);
    this.addUltimateFlatCharge(player, combat, ULT_CHARGE_PARRY_BONUS);
    this.applyDirectionalParryReaction(
      player,
      combat,
      player.x - sourceX,
      player.y - sourceY,
      preventedDamage,
    );
    this.applyParryAugments(player, combat);
    this.applyParryQuirk(player, combat, heal);
  },

  /** POI identity stays at its deterministic seed index; moving the server copy off-map removes collision
   * on the exact synchronized mutation edge while the client consumes `destroyedPoiMask`. */
  mutateVastagharArena(this: GameRoomContext, _kind: VastagharArenaMutationKind, poiIndex: number): void {
    if (poiIndex < 0 || poiIndex >= this.map.pois.length || poiIndex === 255) return;
    const poi = this.map.pois[poiIndex];
    if (!poi) return;
    poi.x = -100_000;
    poi.y = -100_000;
  },

  /** §16 v0.109 Slice 2 — damage every living player inside an oriented rect (a beam / dash lane). `damage`
   *  is ALREADY the per-tick depth-scaled amount. `knockback` (dash) shoves them PERPENDICULAR out of the lane. */
  damageBeamRect(this: GameRoomContext, 
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
      if (!p.alive) return;
      if (!pointInOrientedRect(p.x, p.y, x, y, len, halfW, rot)) return;
      this.damagePlayer(p, damage, "enemy");
      if (knockback > 0) {
        const side = (p.x - x) * nx + (p.y - y) * ny >= 0 ? 1 : -1; // shove to the side they're already on
        const k = addImpulse(p, nx * side * knockback, ny * side * knockback);
        p.vx = k.vx;
        p.vy = k.vy;
        this.beginServerMotion(p, SERVER_MOTION_IMPULSE_TICKS, "enemy-commit-hit");
      }
    });
  },

  /** §16 v0.109 Slice 2 — damage every living player in an expanding ring's danger band (outside the safe
   *  gap wedge). `damage` is the per-tick depth-scaled amount. */
  damageRingBand(this: GameRoomContext, 
    cx: number,
    cy: number,
    bandR: number,
    bandHalf: number,
    gapCenter: number,
    gapHalf: number,
    damage: number,
  ): void {
    this.state.players.forEach((p) => {
      if (!p.alive) return;
      if (!pointInAnnulusGap(p.x, p.y, cx, cy, bandR, bandHalf, gapCenter, gapHalf)) return;
      this.damagePlayer(p, damage, "enemy");
    });
  },

  /** §16 drop a corrosive DoT puddle (reuses ZoneState + the zoner DoT machinery) at a boss-authored spot. */
  spawnWeaponGroundZoneAt(this: GameRoomContext, 
    player: PlayerState,
    weapon: WeaponDef,
    x: number,
    y: number,
    damagePerSecond: number,
    crit = 0,
  ): ZoneState | undefined {
    const def = weapon.groundZone;
    if (!def || this.state.zones.size >= GROUND_ZONE_ENTITY_CAP) return undefined;
    const owned: ZoneState[] = [];
    this.state.zones.forEach((row) => {
      if (row.kind === ZoneKind.Weapon && row.ownerId === player.id) owned.push(row);
    });
    owned.sort((a, b) => a.bornTick - b.bornTick || a.id.localeCompare(b.id));
    while (owned.length >= GROUND_ZONE_OWNER_CAP) {
      const oldest = owned.shift();
      if (!oldest) break;
      this.state.zones.delete(oldest.id);
      this.zoneMeta.delete(oldest.id);
    }
    const zone = new ZoneState();
    zone.id = `z${this.zoneSeq++}`;
    zone.x = clamp(x, 0, ARENA_WIDTH);
    zone.y = clamp(y, 0, ARENA_HEIGHT);
    zone.radius = def.initialRadius;
    zone.kind = ZoneKind.Weapon;
    zone.style =
      def.style === "poison-smoke"
        ? ZoneStyle.PoisonSmoke
        : def.style === "nether"
          ? ZoneStyle.Nether
          : def.style === "ice"
            ? ZoneStyle.Ice
            : ZoneStyle.Poison;
    zone.ownerId = player.id;
    zone.weaponId = weapon.id;
    zone.seed = ((this.zoneSeq * 40503) ^ this.state.tick) & 0xffff;
    zone.maxRadius = def.maxRadius;
    zone.bornTick = this.state.tick;
    this.state.zones.set(zone.id, zone);
    this.zoneMeta.set(zone.id, {
      ttl: def.lingerSeconds,
      hostile: false,
      ownerId: player.id,
      weaponId: weapon.id,
      damagePerSecond: Math.max(0, damagePerSecond),
      tickRate: def.tickRate,
      tickAccumulator: 0,
      slowMultiplier: def.slowMultiplier ?? 1,
      slowSeconds: def.slowSeconds ?? 0,
      refreshedTick: this.state.tick,
      crit,
    });
    return zone;
  },

  dropBossZone(this: GameRoomContext, x: number, y: number, radius: number, ttl: number): void {
    if (this.state.zones.size >= GROUND_ZONE_ENTITY_CAP) return;
    const zone = new ZoneState();
    zone.id = `z${this.zoneSeq++}`;
    zone.x = x;
    zone.y = y;
    zone.radius = radius;
    this.state.zones.set(zone.id, zone);
    this.zoneMeta.set(zone.id, {
      ttl,
      hostile: true,
      ownerId: "",
      weaponId: "",
      damagePerSecond: ZONE_DPS * depthDamageScale(this.state.depth),
      tickRate: 0.05,
      tickAccumulator: 0,
      slowMultiplier: 1,
      slowSeconds: 0,
      refreshedTick: -1,
      crit: 0,
    });
  },

  /** §16 conjure one boss ADD at a telegraphed spot (HP scaled to living count × depth), tracked so the
   *  add-cap counts only boss-summoned adds. Lands on solid ground clear of POIs. */
  spawnBossAddAt(this: GameRoomContext, kindId: string, x: number, y: number): void {
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
  },

  /** Hard encounter budget: seven-second add life, and no residual add pressure during the solo rez beat. */
  stepVastagharAddBudget(this: GameRoomContext): void {
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
      )
        continue;
      const combo = this.comboState.get(id);
      if (combo?.tg) this.removeTelegraphRow(combo.tg);
      this.meleeAttackTokens.releaseHolder(id);
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
  },

  /** Spitters fire a projectile at the nearest living player on a cooldown (§15 ranged threat). */
  stepSpitters(this: GameRoomContext, dt: number, bodies: Vec2[]): void {
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
  },

  stepDuelists(this: GameRoomContext, dt: number, _bodies: Vec2[]): void {
    for (const [id, dead] of this.comboState) {
      if (!this.state.enemies.has(id)) {
        if (dead?.tg) this.removeTelegraphRow(dead.tg); // §15 v0.113 a leaper killed mid-leap: clear its marker
        this.meleeAttackTokens.releaseHolder(id);
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
      const moveSpeed = kind.speed * this.enemyGroundZoneSlow(id);
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
      let target = st.targetId ? this.state.players.get(st.targetId) : undefined;
      if (!target?.alive) {
        if (st.targetId) this.meleeAttackTokens.releaseHolder(id);
        st.targetId = "";
        st.strike = undefined;
        if (st.phase !== "recover") st.phase = "idle";
        target = this.nearestLivingPlayer(enemy);
      }
      const dist = target
        ? Math.hypot(target.x - enemy.x, target.y - enemy.y)
        : Number.POSITIVE_INFINITY;
      const leap = kind.leap;
      if (st.phase === "idle") {
        enemy.windup = 0;
        st.leapCd = Math.max(0, (st.leapCd ?? 0) - dt);
        if (!target) return;
        if (dist > m.approach && !(leap && (st.leapCd ?? 0) <= 0 && dist <= leap.range)) {
          const next = stepEnemyChase({ x: enemy.x, y: enemy.y }, target, moveSpeed, dt);
          enemy.x = next.x;
          enemy.y = next.y;
        } else if (!this.meleeAttackTokens.acquire(target.id, id)) {
          this.postureMeleeEnemy(enemy, id, target, moveSpeed, m.approach, dt);
        } else if (leap && (st.leapCd ?? 0) <= 0 && dist > m.approach && dist <= leap.range) {
          st.targetId = target.id;
          // §15 v0.113 LEAP: commit — telegraph a red landing marker ON the target (announcing the combo),
          // then vault there and flurry on landing. Clear the marker or eat it.
          st.lx = target.x;
          st.ly = target.y;
          st.tg = this.addTelegraphRow(0, st.lx, st.ly, m.range, 1, 2); // circle · dodge-red · light-poof land
          st.phase = "leapwind";
          st.t = leap.windup;
        } else if (dist <= m.approach) {
          st.targetId = target.id;
          st.phase = "windup"; // begin the first telegraphed strike
          st.hits = m.hits;
          st.wind = m.windup;
          st.t = m.windup;
          st.strike = undefined;
        }
      } else if (st.phase === "leapwind") {
        st.t -= dt;
        // Winding up the leap in place — fill the landing marker so the dodge window reads.
        if (st.tg && leap)
          this.setTelegraphRowProgress(st.tg, Math.max(0, Math.min(1, 1 - st.t / leap.windup)));
        if (st.t <= 0) {
          st.phase = "leap";
          st.t = leap?.airTime ?? 0.28;
        }
      } else if (st.phase === "leap") {
        st.t -= dt;
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
        st.t -= dt;
        const phase = st.wind > 0 ? Math.max(0, Math.min(1, 1 - st.t / st.wind)) : 0;
        enemy.windup = phase;
        // Modest tracking belongs only to the ramp. The white-pop edge below freezes the vector.
        if (target && dist > m.range * 0.45) {
          const next = stepEnemyChase({ x: enemy.x, y: enemy.y }, target, moveSpeed * 0.28, dt);
          enemy.x = next.x;
          enemy.y = next.y;
        }
        if (st.t <= 0) {
          if (!target?.alive) {
            this.enterOrdinaryMeleeRecover(enemy, id, st, m.recover);
            return;
          }
          st.strike = this.planDuelistStrike(enemy, target, m, target.id);
          st.phase = "commit";
          st.t = ENEMY_MELEE_COMMIT_SECONDS;
          enemy.windup = 0;
          enemy.commitSeq = (enemy.commitSeq + 1) & 0xff;
          this.consumeDebugCommitDefense(target, enemy);
        }
      } else if (st.phase === "commit") {
        st.t = Math.max(0, st.t - dt);
        if (st.t <= 1e-9) st.t = 0;
        enemy.windup = 0;
        const strike = st.strike;
        if (!strike) {
          this.enterOrdinaryMeleeRecover(enemy, id, st, m.recover);
          return;
        }
        const committed = this.state.players.get(strike.targetId);
        if (committed?.alive)
          this.captureAuthoredMeleeEscape(strike, committed, this.combat.get(committed.id));
        const point = lockedLungePointAt(
          { x: strike.startX, y: strike.startY },
          { x: strike.endX, y: strike.endY },
          ENEMY_MELEE_COMMIT_SECONDS - st.t,
        );
        enemy.x = point.x;
        enemy.y = point.y;
        if (st.t <= 0) {
          enemy.x = strike.endX;
          enemy.y = strike.endY;
          this.duelistSwing(enemy, id, committed, m, strike);
          st.strike = undefined;
          // A parry enters recover inside resolveParry and owns the token release/stagger.
          if (st.phase === "commit") {
            st.hits -= 1;
            if (st.hits > 0) {
              st.phase = "windup";
              st.wind = m.swingGap;
              st.t = m.swingGap;
            } else {
              this.meleeAttackTokens.releaseHolder(id);
              st.targetId = "";
              st.phase = "recover";
              st.t = m.recover;
            }
          }
        }
      } else if (st.phase === "recover") {
        st.t -= dt;
        enemy.windup = 0;
        if (st.t <= 0) st.phase = "idle";
      }
      this.updateEnemyGrid(id, enemy);
    });
  },

  /** Non-holder movement stays legible: close normally, then take a deterministic ring-out posture. */
  postureMeleeEnemy(this: GameRoomContext, 
    enemy: EnemyState,
    id: string,
    target: PlayerState,
    speed: number,
    approach: number,
    dt: number,
  ): void {
    const dx = target.x - enemy.x;
    const dy = target.y - enemy.y;
    const distance = Math.hypot(dx, dy);
    if (distance > approach + 24) {
      const next = stepEnemyChase(enemy, target, speed, dt);
      enemy.x = next.x;
      enemy.y = next.y;
      return;
    }
    if (distance <= 0.001) return;
    const sign = (id.charCodeAt(id.length - 1) & 1) === 0 ? 1 : -1;
    const tangentX = (-dy / distance) * sign;
    const tangentY = (dx / distance) * sign;
    const radius = ENEMY_KINDS[enemy.kind]?.radius ?? ENEMY_RADIUS;
    const maxX =
      this.belt && this.beltLevel ? this.beltLevel.length - radius : ARENA_WIDTH - radius;
    enemy.x = clamp(enemy.x + tangentX * speed * 0.22 * dt, radius, maxX);
    enemy.y = clamp(enemy.y + tangentY * speed * 0.22 * dt, radius, ARENA_HEIGHT - radius);
  },

  /** Capture one nav-valid endpoint and immutable target/vector at the white pop. */
  planDuelistStrike(this: GameRoomContext, 
    enemy: EnemyState,
    target: PlayerState,
    m: { range: number; step: number },
    targetId: string,
  ): NonNullable<DuelistComboState["strike"]> {
    const dx = target.x - enemy.x;
    const dy = target.y - enemy.y;
    const dist = Math.hypot(dx, dy);
    const nx = dist > 0.001 ? dx / dist : 1;
    const ny = dist > 0.001 ? dy / dist : 0;
    const floor = m.range * 0.45;
    const move = Math.max(0, Math.min(m.step, dist - floor));
    const r = ENEMY_KINDS[enemy.kind]?.radius ?? ENEMY_RADIUS;
    const maxX = this.belt && this.beltLevel ? this.beltLevel.length - r : ARENA_WIDTH - r;
    const rawX = clamp(enemy.x + nx * move, r, maxX);
    const rawY = clamp(enemy.y + ny * move, r, ARENA_HEIGHT - r);
    const end = this.navValidEnemyLungeDest(enemy, rawX, rawY);
    return {
      startX: enemy.x,
      startY: enemy.y,
      endX: end.x,
      endY: end.y,
      aimX: nx,
      aimY: ny,
      targetId,
      targetX: target.x,
      targetY: target.y,
      range: m.range,
      authoredEscape: false,
    };
  },

  /** Sample the complete accepted enemy segment so the fixed lunge cannot cross a pit or landmark. */
  navValidEnemyLungeDest(this: GameRoomContext, enemy: EnemyState, targetX: number, targetY: number): Vec2 {
    const r = ENEMY_KINDS[enemy.kind]?.radius ?? ENEMY_RADIUS;
    const maxX = this.belt && this.beltLevel ? this.beltLevel.length - r : ARENA_WIDTH - r;
    const endX = clamp(targetX, r, maxX);
    const endY = clamp(targetY, r, ARENA_HEIGHT - r);
    const dx = endX - enemy.x;
    const dy = endY - enemy.y;
    const samples = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 2));
    let safeX = enemy.x;
    let safeY = enemy.y;
    for (let sample = 1; sample <= samples; sample++) {
      const t = sample / samples;
      const x = enemy.x + dx * t;
      const y = enemy.y + dy * t;
      if (this.belt && this.beltLevel) {
        if (beltPitAtX(this.beltLevel, x)) break;
        const resolved = resolveBeltObstacles(this.beltLevel, x, y, r);
        if (Math.hypot(resolved.x - x, resolved.y - y) > 1e-6) break;
        safeX = x;
        safeY = clampBeltFloorY(this.beltLevel, x, y, r);
      } else {
        if (isPitAtPx(this.map, x, y)) break;
        if (this.map.pois.length > 0) {
          const resolved = resolvePoiCollisionInto(this.map, x, y, r, this.poiResolveScratch);
          if (Math.hypot(resolved.x - x, resolved.y - y) > 1e-6) break;
        }
        safeX = x;
        safeY = y;
      }
    }
    return { x: safeX, y: safeY };
  },

  captureAuthoredMeleeEscape(this: GameRoomContext, 
    strike: NonNullable<DuelistComboState["strike"]>,
    target: PlayerState,
    combat: CombatState | undefined,
  ): void {
    if (strike.authoredEscape) return;
    const beyond =
      Math.hypot(target.x - strike.endX, target.y - strike.endY) > strike.range + PLAYER_RADIUS;
    if (!beyond) return;
    const authoredMotion =
      target.height > GROUND_EPSILON ||
      combat?.stance === STANCE_DASH ||
      combat?.stance === STANCE_SLIDE ||
      this.ultimateOwnsMovement(target);
    if (authoredMotion) strike.authoredEscape = true;
  },

  enterOrdinaryMeleeRecover(this: GameRoomContext, 
    enemy: EnemyState,
    id: string,
    st: DuelistComboState,
    seconds: number,
  ): void {
    this.meleeAttackTokens.releaseHolder(id);
    st.targetId = "";
    st.strike = undefined;
    st.phase = "recover";
    st.t = Math.max(seconds, PARRY_ENEMY_STAGGER_SECONDS);
    enemy.windup = 0;
  },

  /** Resolve against the committed player identity. Walking/strafing is deliberately not an answer. */
  duelistSwing(this: GameRoomContext, 
    enemy: EnemyState,
    enemyId: string,
    target: PlayerState | undefined,
    m: { damage: number },
    committed: NonNullable<DuelistComboState["strike"]>,
  ): void {
    enemy.atkSeq = (enemy.atkSeq + 1) % 100000;
    if (!target?.alive) return;
    const dmgMul = enemy.tough ? TOUGH_DAMAGE_MULT : 1;
    const pc = this.combat.get(target.id);
    const parrying = (pc?.invuln ?? 0) > 0;
    const rolling = !!pc && this.slideInvulnerable(pc);
    const airborne = target.height > GROUND_EPSILON;
    if (
      committedMeleeEvaded({
        parrying,
        rollInvulnerable: rolling,
        airborne,
        authoredDisplacementBeyondReach: committed.authoredEscape,
      })
    ) {
      if (parrying && pc)
        this.resolveParry(
          target,
          pc,
          enemy,
          enemyId,
          m.damage * dmgMul * depthDamageScale(this.state.depth),
        );
      else if (rolling) this.noteSlideDodge(target);
      return;
    }
    if (pc && pc.juggleMercy > 0) return;
    this.damagePlayer(target, m.damage * dmgMul * depthDamageScale(this.state.depth), "enemy");
    const impulse = addImpulse(
      target,
      committed.aimX * HIT_KNOCKBACK_IMPULSE,
      committed.aimY * HIT_KNOCKBACK_IMPULSE,
    );
    target.vx = impulse.vx;
    target.vy = impulse.vy;
    this.beginServerMotion(target, SERVER_MOTION_IMPULSE_TICKS, "enemy-commit-hit");
  },

  /** §51 one TOUGH combo-speaking elite, one tick — the authored, tick-anchored machine (worm action
   *  model): idle → [leapwind → leap → settle] → windup … → (return) → recover. The laws enforced here:
   *  the negotiated landing NEVER moves once its marker exists (G3/G5); each ramp tracks until the
   *  universal white pop, then four fixed commit ticks own a frozen vector; every displacement is bounded
   *  motion or a ≤COMBO_STEP_MAX commit-write (G2); juggle strings obey every G9 cap at the resolve
   *  tick; the parried bait stands a visible ≥0.4s stagger at its DISPLACED spot before returning (G8). */
  stepComboEnemy(this: GameRoomContext, 
    enemy: EnemyState,
    id: string,
    kind: EnemyKind,
    m: NonNullable<EnemyKind["melee"]>,
    st: DuelistComboState,
    dt: number,
  ): void {
    const tick = this.state.tick;
    const moveSpeed = kind.speed * this.enemyGroundZoneSlow(id);
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
        if (dist > COMBO_RINGOUT_ORBIT + 40) this.moveComboEnemyToward(enemy, prey, moveSpeed, dt);
        return;
      }
      if (kind.comboLeap) {
        // Named leapers/shifters ALWAYS offer the negotiated frame. Inside range they wait for the
        // authored 4s cooldown; outside it they close until a legal fixed-duration arc is available.
        if ((st.leapCd ?? 0) <= 0 && dist <= COMBO_LEAP_RANGE)
          this.commitCombo(enemy, id, kind, st, prey, true);
        else this.moveComboEnemyToward(enemy, prey, moveSpeed, dt);
      } else if (dist <= m.approach) {
        this.commitCombo(enemy, id, kind, st, prey, false);
      } else {
        this.moveComboEnemyToward(enemy, prey, moveSpeed, dt);
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
          (live?.x ?? Number.POSITIVE_INFINITY) -
          (st.negotiatedTargetX ?? Number.NEGATIVE_INFINITY);
        const whiffDy =
          (live?.y ?? Number.POSITIVE_INFINITY) -
          (st.negotiatedTargetY ?? Number.NEGATIVE_INFINITY);
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
      // Ramp-only tracking: the white pop below is the immutable vector boundary.
      if (live && !knockbackMoving) {
        const dist = Math.hypot(live.x - enemy.x, live.y - enemy.y);
        if (step.kind === "airkeep") {
          this.moveComboEnemyToward(enemy, live, kind.speed * 1.6, dt);
        } else if (dist > step.range * 0.45) {
          this.moveComboEnemyToward(enemy, live, kind.speed * 0.28, dt);
        }
      }
      enemy.windup = phase01;
      if (left <= 0) {
        if (!live) {
          this.enterComboRecover(enemy, id, st, def.recoverTicks);
          return;
        }
        st.strike = this.planComboStrike(
          enemy,
          live,
          step.range,
          Math.min(step.step, COMBO_STEP_MAX),
          0,
        );
        st.phase = "commit";
        st.stepStartTick = tick;
        st.stepEndTick = (tick + ENEMY_MELEE_COMMIT_SECONDS / (TICK_MS / 1000)) >>> 0;
        enemy.windup = 0;
        enemy.commitSeq = (enemy.commitSeq + 1) & 0xff;
        this.bumpComboSeq(enemy);
      }
    } else if (st.phase === "commit" && def) {
      const returning = st.empowered === true && def.return !== undefined;
      const step = returning ? undefined : def.steps[st.stepIndex ?? 0];
      const geo = returning ? def.return : step;
      const strike = st.strike;
      if (!strike || !geo) {
        this.enterComboRecover(enemy, id, st, def.recoverTicks);
        return;
      }
      const target = this.state.players.get(strike.targetId);
      if (target?.alive)
        this.captureAuthoredMeleeEscape(strike, target, this.combat.get(target.id));
      const commitTicks = Math.max(1, Math.round(ENEMY_MELEE_COMMIT_SECONDS / (TICK_MS / 1000)));
      const elapsedTicks = Math.max(0, commitTicks - Math.max(0, left));
      const point = lockedLungePointAt(
        { x: strike.startX, y: strike.startY },
        { x: strike.endX, y: strike.endY },
        elapsedTicks * (TICK_MS / 1000),
      );
      enemy.x = point.x;
      enemy.y = point.y;
      enemy.windup = 0;
      if (left <= 0) {
        enemy.x = strike.endX;
        enemy.y = strike.endY;
        st.strike = undefined;
        if (step?.kind === "airkeep" && !this.airkeepValid(st, step, target)) {
          this.enterComboRecover(enemy, id, st, def.recoverTicks);
          return;
        }
        this.comboSwing(enemy, id, st, step, geo, strike);
        // A parry may convert/break/recover inside comboSwing. Only an untouched commit advances.
        if (st.phase === "commit" && returning) {
          this.enterComboRecover(enemy, id, st, def.return?.recoverTicks ?? def.recoverTicks);
        } else if (st.phase === "commit") {
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
      const rampTicks = Math.max(1, ret.windupTicks - ENEMY_MELEE_COMMIT_TICKS);
      const windEnd = (staggerEnd + rampTicks) >>> 0;
      const staggerLeft = (staggerEnd - tick) | 0;
      const windLeft = (windEnd - tick) | 0;
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
        const phase01 = Math.max(0, Math.min(1, (rampTicks - windLeft) / rampTicks));
        enemy.windup = phase01;
      } else {
        if (!live) {
          this.enterComboRecover(enemy, id, st, ret.recoverTicks);
          return;
        }
        st.strike = this.planComboStrike(enemy, live, ret.range, RETURN_STEP_MAX, 0);
        st.phase = "commit";
        st.stepStartTick = tick;
        st.stepEndTick = (tick + ENEMY_MELEE_COMMIT_SECONDS / (TICK_MS / 1000)) >>> 0;
        enemy.windup = 0;
        enemy.commitSeq = (enemy.commitSeq + 1) & 0xff;
        this.bumpComboSeq(enemy);
      }
    } else if (st.phase === "recover") {
      enemy.windup = 0;
      if (left <= 0) st.phase = "idle";
    } else {
      // A phase with no authored data behind it (comboId pruned mid-run) — fail safe into recover.
      this.enterComboRecover(enemy, id, st, 8);
    }
  },

  /** §51 commit one combo performance: pick from the depth-gated deck (no-repeat + ≤40% advanced),
   *  CLAIM the duel token (G12 — the choreography aims at ONE player, period), and either negotiate
   *  the leap (frozen at THIS decision) or open grounded at step 0. */
  commitCombo(this: GameRoomContext, 
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
    st.stepLimit = this.state.depth <= 2 ? Math.min(2, def.steps.length) : def.steps.length;
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
  },

  /** §51 one immutable landing promise. The base 0.8×-range point is distance-clamped, then routed through
   *  the exact arena/belt spawn-safety functions. A >40px nav correction searches the nearest bearings on
   *  the player's front 90° arc and marks the landing awkward (+0.10s settle), as authored. */
  negotiateComboLanding(this: GameRoomContext, 
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
  },

  /** Decision-edge helper for `negotiateComboLanding`; `navShift` measures only the safety correction,
   *  not the authored 560px range pullback. */
  comboLandingCandidate(this: GameRoomContext, 
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
  },

  /** §51 open authored step `index`: fresh tick anchors, no strike (Lock will sample it). */
  beginComboStep(this: GameRoomContext, st: DuelistComboState, def: ToughComboDef, index: number): void {
    const step = def.steps[index];
    st.stepIndex = index;
    st.phase = "windup";
    st.strike = undefined;
    st.stepStartTick = this.state.tick;
    // Existing combo cadence names impact-to-impact timing. Reserve its final four ticks for B33's
    // universal pop-to-impact window so adding the channel does not slow or invalidate authored strings.
    const rampTicks = Math.max(1, (step?.windupTicks ?? 1) - ENEMY_MELEE_COMMIT_TICKS);
    st.stepEndTick = (this.state.tick + rampTicks) >>> 0;
  },

  /** §51 end a combo performance: clear rows + presentation flags, FREE the duel token (G12 — the
   *  kneeling punish window pressures no one), and hold `recover` for `ticks`. */
  enterComboRecover(this: GameRoomContext, 
    enemy: EnemyState,
    id: string,
    st: DuelistComboState,
    ticks: number,
  ): void {
    st.strike = undefined;
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
  },

  /** §51 G9 air-keep gate at the RESOLVE tick: the victim must still be airborne inside the authored
   *  height window, under the ≤2 air-hit cap, and inside the ≤2.0s loss-of-control ceiling. Any miss =
   *  the whole string whiffs into recover — falling out (or being left to land) IS an escape. */
  airkeepValid(this: GameRoomContext, 
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
  },

  /** §51 capture a combo step's committed origin + aim — planDuelistStrike generalised: authored range,
   *  an explicit travel cap (COMBO_STEP_MAX for steps, RETURN_STEP_MAX for the bait return), and an
   *  optional ONE-TIME velocity lead (air-keep fall compensation, sampled at Lock, never re-timed). */
  planComboStrike(this: GameRoomContext, 
    enemy: EnemyState,
    target: PlayerState,
    range: number,
    travelCap: number,
    leadSeconds: number,
  ): NonNullable<DuelistComboState["strike"]> {
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
    const maxX = this.belt && this.beltLevel ? this.beltLevel.length - r : ARENA_WIDTH - r;
    const rawX = clamp(enemy.x + nx * move, r, maxX);
    const rawY = clamp(enemy.y + ny * move, r, ARENA_HEIGHT - r);
    const end = this.navValidEnemyLungeDest(enemy, rawX, rawY);
    return {
      startX: enemy.x,
      startY: enemy.y,
      endX: end.x,
      endY: end.y,
      aimX: nx,
      aimY: ny,
      targetId: target.id,
      targetX: tx,
      targetY: ty,
      range,
      authoredEscape: false,
    };
  },

  /** §51 allocation-free steady-state chase used only by authored combos. The shared chase helper returns
   *  fresh vectors (fine for legacy); active elites mutate in place so their richer per-tick machine adds
   *  zero garbage-collector pressure. */
  moveComboEnemyToward(this: GameRoomContext, enemy: EnemyState, target: Vec2, speed: number, dt: number): void {
    const dx = target.x - enemy.x;
    const dy = target.y - enemy.y;
    const d = Math.hypot(dx, dy);
    if (d <= 0.001) return;
    const move = Math.min(d, speed * dt);
    const r = ENEMY_KINDS[enemy.kind]?.radius ?? ENEMY_RADIUS;
    const maxX = this.belt && this.beltLevel ? this.beltLevel.length - r : ARENA_WIDTH - r;
    enemy.x = clamp(enemy.x + (dx / d) * move, r, maxX);
    enemy.y = clamp(enemy.y + (dy / d) * move, r, ARENA_HEIGHT - r);
  },

  /** §51 schedule parry recoil as a continuous ≤90px/tick motion. Pits remain lethal and POI collision
   *  still runs in the normal phase afterward — no immunity is granted to protect authored content. */
  scheduleComboKnockback(this: GameRoomContext, 
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
  },

  /** §51 advance one scheduled recoil slice; completion captures the ACTUAL post-knockback position from
   *  which a bait return later path-plans. Returns true on every tick that recoil owns movement. */
  stepComboKnockback(this: GameRoomContext, enemy: EnemyState, st: DuelistComboState, tick: number): boolean {
    if (
      st.knockbackEndTick === undefined ||
      st.knockbackX === undefined ||
      st.knockbackY === undefined
    )
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
  },

  /** §51 one authored combo swing from the committed Lock geometry. Parry language: white steps are
   *  parryable (shared resolveParry — bait conversion / juggle break / riposte all branch in there);
   *  RED steps (unparryable) speak the FEET language — an airborne player clears them, the parry does
   *  not answer them. Juggle displacement rides ONLY the two channels prediction already reconciles
   *  (`addImpulse` and vh) — never a position write, never zeroMoveVel (no new divergence classes). */
  comboSwing(this: GameRoomContext, 
    enemy: EnemyState,
    enemyId: string,
    st: DuelistComboState,
    step: ToughComboStep | undefined,
    geo: { range: number; halfArc: number; damageMult: number; knockbackMult?: number },
    strike: NonNullable<DuelistComboState["strike"]>,
  ): void {
    enemy.atkSeq = (enemy.atkSeq + 1) % 100000;
    const m = effectiveMelee(ENEMY_KINDS[enemy.kind]);
    const base =
      (m?.damage ?? 0) *
      geo.damageMult *
      (enemy.tough ? TOUGH_DAMAGE_MULT : 1) *
      depthDamageScale(this.state.depth);
    const player = this.state.players.get(strike.targetId);
    if (!player?.alive) return;
    const pc = this.combat.get(player.id);
    const parrying = !step?.unparryable && (pc?.invuln ?? 0) > 0;
    const rolling = !step?.airkeep && !!pc && this.slideInvulnerable(pc);
    const airborne = !step?.airkeep && player.height > GROUND_EPSILON;
    if (
      committedMeleeEvaded({
        parrying,
        rollInvulnerable: rolling,
        airborne,
        authoredDisplacementBeyondReach: strike.authoredEscape,
      })
    ) {
      if (parrying && pc) {
        const preventedDamage =
          player.id === st.targetId && st.juggleCombo
            ? Math.min(
                base,
                Math.max(0, player.maxHp * COMBO_DAMAGE_CAP_FRAC - (st.comboDamage ?? 0)),
              )
            : base;
        this.resolveParry(player, pc, enemy, enemyId, preventedDamage);
      } else if (rolling) {
        this.noteSlideDodge(player);
      }
      return;
    }
    if (pc && pc.juggleMercy > 0) return;
    let dmg = base;
    if (player.id === st.targetId && st.juggleCombo) {
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
      (pc.stance === STANCE_CROUCH || pc.stance === STANCE_DASH || pc.stance === STANCE_SLIDE)
    ) {
      this.cancelMoveStance(player, pc, true);
    }
    const poundOwnsVertical = pc?.stance === STANCE_POUND;
    if (step?.launch && pc && player.id === st.targetId && !poundOwnsVertical) {
      pc.vh = Math.min(step.launch.vh, PARRY_LAUNCH_MAX);
      player.vh = pc.vh;
      pc.juggleArmed = true;
      const k = addImpulse(player, (hx / hd) * step.launch.push, (hy / hd) * step.launch.push);
      player.vx = k.vx;
      player.vy = k.vy;
      this.beginServerMotion(player, SERVER_MOTION_LAUNCH_TICKS, "enemy-commit-launch");
      player.juggledSeq = (player.juggledSeq + 1) & 0xff;
      st.launchTick = this.state.tick;
      enemy.comboFlags |= COMBO_FLAG_JUGGLE;
    } else if (step?.airkeep && pc && player.id === st.targetId && !poundOwnsVertical) {
      if (step.airkeep.vh > 0) {
        pc.vh = Math.min(step.airkeep.vh, PARRY_LAUNCH_MAX);
        player.vh = pc.vh;
      }
      if (step.airkeep.push > 0) {
        const k = addImpulse(player, (hx / hd) * step.airkeep.push, (hy / hd) * step.airkeep.push);
        player.vx = k.vx;
        player.vy = k.vy;
        this.beginServerMotion(player, SERVER_MOTION_LAUNCH_TICKS, "enemy-commit-launch");
      }
      player.juggledSeq = (player.juggledSeq + 1) & 0xff;
      st.juggleHits = (st.juggleHits ?? 0) + 1;
    } else {
      const push = HIT_KNOCKBACK_IMPULSE * (geo.knockbackMult ?? 1);
      const k = addImpulse(player, (hx / hd) * push, (hy / hd) * push);
      player.vx = k.vx;
      player.vy = k.vy;
      this.beginServerMotion(player, SERVER_MOTION_IMPULSE_TICKS, "enemy-commit-hit");
    }
  },

  /** §51 nearest LIVING player WITH identity (the anonymous `bodies` scratch drops ids — a combo
   *  commits to ONE victim at negotiation, G12). O(players), zero allocation. */
  nearestLivingPlayer(this: GameRoomContext, pos: Vec2): PlayerState | undefined {
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
  },

  /** §51 bump the synced step-commit edge, wrapping 1..255 (0 stays "no combo has ever run"). */
  bumpComboSeq(this: GameRoomContext, enemy: EnemyState): void {
    enemy.comboSeq = (enemy.comboSeq % 255) + 1;
  },

  /** Publish one deterministic success pose, then route the server-owned displacement/state by incidence. */
  applyDirectionalParryReaction(this: GameRoomContext, 
    player: PlayerState,
    pc: CombatState,
    incomingX: number,
    incomingY: number,
    preventedDamage: number,
  ): void {
    const reaction = classifyParryIncidence(incomingX, incomingY);
    const weapon = WEAPONS[player.weapon] ?? WEAPONS[FISTS_WEAPON];
    const subtype = weapon ? parryGuardSubtypeKey(weapon) : "melee:fist";
    const cycle = advanceParryGuardCycle(pc.parryGuardCycles.get(subtype), this.state.tick);
    pc.parryGuardCycles.set(subtype, cycle.state);
    player.parryPresentation = packParryPresentation(reaction, cycle.pose);

    if (reaction === ParryReaction.FromBelow) {
      this.applyLegacyParryLift(player, pc, incomingX, incomingY);
      return;
    }
    if (reaction === ParryReaction.FromLeft || reaction === ParryReaction.FromRight) {
      this.applySideParrySlide(player, pc, incomingX, incomingY, preventedDamage);
    }
  },

  /** The pre-B26 parry lift, extracted byte-for-byte in behavior and reached only by below incidence. */
  applyLegacyParryLift(this: GameRoomContext, 
    player: PlayerState,
    pc: CombatState,
    incomingX: number,
    incomingY: number,
  ): void {
    this.beginServerMotion(player, SERVER_MOTION_LAUNCH_TICKS, "parry-launch");
    if (pc.stance !== STANCE_POUND) {
      pc.vh = Math.min(pc.vh + PARRY_LAUNCH, PARRY_LAUNCH_MAX);
      player.vh = pc.vh;
    }
    const distance = Math.hypot(incomingX, incomingY) || 1;
    const impulse = addImpulse(
      player,
      (incomingX / distance) * PARRY_PUSH,
      (incomingY / distance) * PARRY_PUSH,
    );
    player.vx = impulse.vx;
    player.vy = impulse.vy;
  },

  /** Move immediately to a swept-valid endpoint; snapshot interpolation presents the authored slide beat. */
  applySideParrySlide(this: GameRoomContext, 
    player: PlayerState,
    pc: CombatState,
    incomingX: number,
    incomingY: number,
    preventedDamage: number,
  ): void {
    this.beginServerMotion(player, 1, "parry-slide");
    const distance = parrySlideDistance(preventedDamage);
    let destination: Vec2;
    if (this.belt && this.beltLevel) {
      const length = Math.hypot(incomingX, incomingY) || 1;
      destination = this.navValidMotionDest(
        player,
        pc,
        player.x + (incomingX / length) * distance,
        player.y + (incomingY / length) * distance,
        distance,
      );
    } else {
      destination = clampParrySlideToNavigation(
        player.x,
        player.y,
        incomingX,
        incomingY,
        distance,
        (x, y) => {
          if (
            x < PLAYER_RADIUS ||
            x > ARENA_WIDTH - PLAYER_RADIUS ||
            y < PLAYER_RADIUS ||
            y > ARENA_HEIGHT - PLAYER_RADIUS ||
            isPitAtPx(this.map, x, y)
          )
            return false;
          if (this.map.pois.length === 0) return true;
          const resolved = resolvePoiCollisionInto(
            this.map,
            x,
            y,
            PLAYER_RADIUS,
            this.poiResolveScratch,
          );
          return Math.hypot(resolved.x - x, resolved.y - y) <= 1e-6;
        },
      );
    }
    player.x = destination.x;
    player.y = destination.y;
    if (player.height <= GROUND_EPSILON && pc.vh <= 0) {
      pc.lastGroundX = player.x;
      pc.lastGroundY = player.y;
    }
  },

  /** §8 apply a SUCCESSFUL parry of a telegraphed melee strike: negate + punish + FLOW + the v0.114 chain
   *  reward. `attacker` is bump-knocked back; `attackerId` looks up its `comboState` for the high-chain
   *  STAGGER (a boss has no comboState entry → no stagger, which is correct — bosses aren't stunlockable).
   *  Shared by the horde duelist swing and the boss `meleeCombo` so the two parry paths can't drift. */
  resolveParry(this: GameRoomContext, 
    player: PlayerState,
    pc: CombatState,
    attacker: EnemyState,
    attackerId: string,
    preventedDamage: number,
  ): void {
    this.recordPetAcceptedAction(player.id);
    player.parriedSeq = (player.parriedSeq + 1) % 100000;
    const dx = attacker.x - player.x;
    const dy = attacker.y - player.y;
    const d = Math.hypot(dx, dy) || 1;
    const ironKnockback =
      (1 + IRON_STANCE_KNOCKBACK_PER * countAugment(player.augments, "iron-stance")) *
      pc.mods.parryKnockbackMult;
    // §8 flow: refresh the cooldown so the next swing can be parried immediately (chain).
    pc.parryCd = Math.min(pc.parryCd, PARRY_CHAIN_CD);
    this.applyDirectionalParryReaction(player, pc, -dx, -dy, preventedDamage);
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
      attacker.x = clamp(attacker.x + nx * baseKnockback, ENEMY_RADIUS, ARENA_WIDTH - ENEMY_RADIUS);
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
      } else if (est.empowered) {
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
          (est.stepStartTick +
            RETURN_STAGGER_TICKS +
            Math.max(1, def.return.windupTicks - ENEMY_MELEE_COMMIT_TICKS)) >>>
          0;
        attacker.comboFlags = (attacker.comboFlags & ~COMBO_FLAG_JUGGLE) | COMBO_FLAG_EMPOWERED;
        this.bumpComboSeq(attacker); // documented edge: empowered return STEP START
      } else {
        // B33: every successfully parried committed lunge pays a readable stagger.
        this.enterComboRecover(
          attacker,
          attackerId,
          est,
          ticksFromSeconds(PARRY_ENEMY_STAGGER_SECONDS) + knockbackTicks,
        );
      }
    } else if (est) {
      this.enterOrdinaryMeleeRecover(
        attacker,
        attackerId,
        est,
        riposte ? 1 : PARRY_ENEMY_STAGGER_SECONDS,
      );
    }
    // G-02: augments belong to this success receipt, never to the button press that opened the window.
    this.applyParryAugments(player, pc);
    this.applyParryQuirk(player, pc, parryHeal);
  },

  /** §16 Slice 3 — resolve a PARRYABLE boss melee wedge (the `meleeCombo` primitive). Mirrors the horde
   *  duelist swing: a player in the arc with parry i-frames PARRIES it (shared `resolveParry` reward),
   *  otherwise takes the (already depth-scaled) hit + a knockback shove along the strike. */
  applyBossMelee(this: GameRoomContext, 
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
      if (!player.alive) return;
      if (!inMeleeArc(origin, aimX, aimY, player, range, halfArc)) return;
      const pc = this.combat.get(player.id);
      if (pc && pc.invuln > 0) {
        if (boss && this.bossId) this.resolveParry(player, pc, boss, this.bossId, damage);
        else {
          player.parriedSeq = (player.parriedSeq + 1) % 100000;
          this.applyDirectionalParryReaction(player, pc, player.x - x, player.y - y, damage);
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
      this.beginServerMotion(player, SERVER_MOTION_IMPULSE_TICKS, "enemy-commit-hit");
    });
  },

  /** Zoners drop a corrosive puddle under themselves on a cooldown (§15 area denial). */
  stepZoners(this: GameRoomContext, dt: number): void {
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
      if (this.state.zones.size >= GROUND_ZONE_ENTITY_CAP) {
        this.zonerDropCd.set(id, ZONER_DROP_INTERVAL);
        return;
      }
      const zone = new ZoneState();
      zone.id = `z${this.zoneSeq++}`;
      zone.x = enemy.x;
      zone.y = enemy.y;
      zone.radius = ZONE_RADIUS * (enemy.tough ? 1.4 : 1);
      this.state.zones.set(zone.id, zone);
      this.zoneMeta.set(zone.id, {
        ttl: ZONE_TTL,
        hostile: true,
        ownerId: "",
        weaponId: "",
        damagePerSecond: ZONE_DPS * depthDamageScale(this.state.depth),
        tickRate: 0.05,
        tickAccumulator: 0,
        slowMultiplier: 1,
        slowSeconds: 0,
        refreshedTick: -1,
        crit: 0,
      });
      this.zonerDropCd.set(id, ZONER_DROP_INTERVAL);
    });
  },

  /** Tick puddle lifetimes; DoT any living, non-invulnerable player standing inside one. */
  stepZones(this: GameRoomContext, dt: number): void {
    const doomed: string[] = [];
    this.state.zones.forEach((zone, id) => {
      const rawMeta = this.zoneMeta.get(id) as ZoneRuntime | number | undefined;
      const meta: ZoneRuntime | undefined =
        typeof rawMeta === "number"
          ? {
              ttl: rawMeta,
              hostile: true,
              ownerId: "",
              weaponId: "",
              damagePerSecond: ZONE_DPS * depthDamageScale(this.state.depth),
              tickRate: 0.05,
              tickAccumulator: 0,
              slowMultiplier: 1,
              slowSeconds: 0,
              refreshedTick: -1,
              crit: 0,
            }
          : rawMeta;
      if (!meta) {
        doomed.push(id);
        return;
      }
      if (typeof rawMeta === "number") this.zoneMeta.set(id, meta);
      if (meta.refreshedTick !== this.state.tick) meta.ttl -= dt;
      if (meta.ttl <= 0) {
        doomed.push(id);
        return;
      }
      const r2 = zone.radius * zone.radius;
      if (meta.hostile)
        this.state.players.forEach((player) => {
          // Zoner puddles are unparryable; you must walk out of them.
          if (!player.alive) return;
          const dx = player.x - zone.x;
          const dy = player.y - zone.y;
          if (dx * dx + dy * dy <= r2) {
            // Enemy-created zoner puddles are not authored neutral ground hazards.
            this.damagePlayer(player, meta.damagePerSecond * dt, "enemy");
          }
        });
      if (meta.hostile) return;
      meta.tickAccumulator += dt;
      while (meta.tickAccumulator + 1e-9 >= meta.tickRate) {
        meta.tickAccumulator -= meta.tickRate;
        const kills: string[] = [];
        this.enemyGrid.queryRadius(
          zone.x,
          zone.y,
          zone.radius + MAX_ENEMY_RADIUS,
          this.enemyCandidates,
        );
        for (const enemyId of this.enemyCandidates) {
          const enemy = this.state.enemies.get(enemyId);
          if (!enemy) continue;
          const bodyRadius = ENEMY_KINDS[enemy.kind]?.radius ?? ENEMY_RADIUS;
          const dx = enemy.x - zone.x;
          const dy = enemy.y - zone.y;
          if (dx * dx + dy * dy > (zone.radius + bodyRadius) ** 2) continue;
          if (meta.damagePerSecond > 0)
            this.damageEnemy(
              enemy,
              enemyId,
              meta.damagePerSecond * meta.tickRate,
              kills,
              meta.crit,
              meta.ownerId,
              meta.weaponId,
              CombatDelivery.Zone,
              zone.x,
              zone.y,
            );
          this.applyEnemySlow(enemyId, meta.slowMultiplier, meta.slowSeconds);
        }
        for (const enemyId of kills) this.state.enemies.delete(enemyId);
      }
    });
    for (const id of doomed) {
      this.state.zones.delete(id);
      this.zoneMeta.delete(id);
      for (const [ownerId, activeId] of this.activeGroundZones)
        if (activeId === id) this.activeGroundZones.delete(ownerId);
    }
  },

  /** Non-boss (trash) enemies currently alive — a belt room is cleared when this hits 0. */
  beltTrashAlive(this: GameRoomContext): number {
    let n = 0;
    this.state.enemies.forEach((_e, id) => {
      if (id !== this.bossId) n++;
    });
    return n;
  },

  /** §29 spawn a room's wave: `n` enemies spread across the room's belt x-range, on the authored floor. */
  spawnBeltWave(this: GameRoomContext, 
    n: number,
    x0: number,
    x1: number,
    depth = this.beltLevel?.corporateDepth ?? 0,
  ): void {
    const level = this.beltLevel;
    if (!level || n <= 0) return;
    const floor = corporateGridFloorForBelt(level);
    let squadX = 0;
    let squadCount = 0;
    this.state.players.forEach((player) => {
      if (!player.alive) return;
      squadX += player.x;
      squadCount++;
    });
    squadX = squadCount > 0 ? squadX / squadCount : floor?.playerSpawns[0]?.x ?? x0;
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
      if (floor) {
        const anchor = selectCorporateWaveAnchor(
          floor,
          squadX,
          depth,
          Math.random(),
          Math.random(),
          x0,
          x1,
        );
        const resolved = resolveBeltNavigation(
          level,
          anchor.x,
          BELT_Y0 + anchor.y,
          kind.radius,
        );
        enemy.x = resolved.x;
        enemy.y = resolved.y;
      } else {
        // Legacy belts retain their random room spread and pit avoidance.
        let ex = x0 + 100 + Math.random() * Math.max(1, x1 - x0 - 200);
        if (beltPitAtX(level, ex)) ex = beltSafeX(level, ex, x0);
        enemy.x = ex;
        enemy.y = clampBeltFloorY(
          level,
          ex,
          BELT_Y0 + Math.random() * DEPTH_MAX,
          kind.radius,
        );
      }
      this.state.enemies.set(enemy.id, enemy);
      this.insertEnemyGrid(enemy.id, enemy);
    }
  },

  /** Spawn enemies on a ring around a random player, accelerating with run time (§5/§6) and pressing
   *  harder per §6 chain depth (v0.103). */
  runSpawnDirector(this: GameRoomContext, dt: number, anchors: Vec2[]): void {
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
  },

  /** Reuses stable target rows and scans the fixed receipt ring for the authored four-second threat share. */
  buildVastagharTargets(this: GameRoomContext): void {
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
        (this.state.tick - receipt.tick) >>> 0 > 80
      )
        continue;
      for (let i = 0; i < count; i++) {
        const target = this.vastagharTargets[i];
        if (target?.id === receipt.sourcePlayerId) {
          target.recentBossDamage += Math.max(0, receipt.damage);
          break;
        }
      }
    }
  },

  /** Validate the FINAL corrected point against every living player's warning circle and a conservative
   *  gameplay-camera rectangle. The bounded angular fan reuses the real safe-position correction for each
   *  attempt and writes the accepted result into the two scalar scratch fields. */
  findFairEnemySpawn(this: GameRoomContext, anchor: Vec2, radius: number, baseAngle: number): boolean {
    const minDistance2 = SPAWN_MIN_DISTANCE * SPAWN_MIN_DISTANCE;
    const margin = radius + 4;
    for (let attempt = 0; attempt < SPAWN_CANDIDATE_COUNT; attempt++) {
      const angle = baseAngle + (attempt / SPAWN_CANDIDATE_COUNT) * Math.PI * 2;
      const rawX = clamp(anchor.x + Math.cos(angle) * SPAWN_RING, margin, ARENA_WIDTH - margin);
      const rawY = clamp(anchor.y + Math.sin(angle) * SPAWN_RING, margin, ARENA_HEIGHT - margin);
      const corrected = safeSpawnPos(this.map, rawX, rawY, radius);
      let fair = true;
      this.state.players.forEach((player) => {
        if (!fair || !player.alive) return;
        const dx = corrected.x - player.x;
        const dy = corrected.y - player.y;
        if (
          dx * dx + dy * dy + 1e-6 < minDistance2 ||
          (Math.abs(dx) <= SPAWN_CAMERA_HALF_WIDTH && Math.abs(dy) <= SPAWN_CAMERA_HALF_HEIGHT)
        )
          fair = false;
      });
      if (!fair) continue;
      this.spawnCandidateX = corrected.x;
      this.spawnCandidateY = corrected.y;
      return true;
    }
    return false;
  },

  spawnEnemy(this: GameRoomContext, anchors: Vec2[]): boolean {
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
  },

  /** §21 Dev summon: place ONE enemy of `kindId` on the spawn ring around `anchor`, optionally tough.
   *  Mirrors spawnEnemy's placement (ring offset + pit/POI safe-spawn) but with a CHOSEN kind/tier so the
   *  Testing-Grounds Tab menu can conjure exactly what the playtester wants to fight. */
  debugSpawnOne(this: GameRoomContext, 
    kindId: string,
    tough: boolean,
    anchor: PlayerState,
    angleOverride?: number,
    distanceOverride?: number,
    attackReady = false,
  ): void {
    // §44 HARD entity cap (Sol audit P0 #1): the spawn director respects MAX_ENEMIES but this path
    // didn't — a summon flood could push the room into the quadratic collision loop unbounded.
    if (this.effectiveEnemyBodies() >= MAX_ENEMIES) return;
    const kind = ENEMY_KINDS[kindId];
    if (!kind) return;
    const players = this.state.players.size;
    const angle = angleOverride ?? Math.random() * Math.PI * 2;
    const distance = distanceOverride ?? SPAWN_RING;
    const m = kind.radius + 4;
    const enemy = new EnemyState();
    enemy.id = `e${this.enemySeq++}`;
    enemy.kind = kindId;
    // Swarm trash can't be tough (matches the director rule); the boss ignores the flag (it's already a tier).
    enemy.tough = tough && kind.archetype !== "swarm" && kind.archetype !== "boss";
    enemy.hp = kind.hp * (enemy.tough ? TOUGH_HP_MULT : 1) * enemyHpScale(players);
    const ex = clamp(anchor.x + Math.cos(angle) * distance, m, ARENA_WIDTH - m);
    const ey = clamp(anchor.y + Math.sin(angle) * distance, m, ARENA_HEIGHT - m);
    const sp = safeSpawnPos(this.map, ex, ey, kind.radius);
    enemy.x = sp.x;
    enemy.y = sp.y;
    this.state.enemies.set(enemy.id, enemy);
    this.insertEnemyGrid(enemy.id, enemy);
    if (attackReady) this.enemyFireCd.set(enemy.id, 0);
  },

  /** §16 v0.116 BOSS RUSH — drop the boss at `bossRushIndex` in the gauntlet order (`BOSS_DEF_IDS`). Reuses
   *  `spawnBoss` (ring-spawn near a living player, HP-scaled by the escalating depth), which also retires any
   *  lingering previous boss. */
  spawnBossRushBoss(this: GameRoomContext): void {
    const kind = BOSS_DEF_IDS[this.bossRushIndex];
    if (kind) this.spawnBoss(kind);
  },

  /** §16 v0.116 BOSS RUSH — a boss just fell: pay the squad a depth-scaled wage + a mid-run heal + a mystery
   *  drop, then either QUEUE the next boss (escalating `depth`) or, on the final boss, WIN the run (bank + clean
   *  the field, mirroring `checkExtraction`). */
  advanceBossRush(this: GameRoomContext): void {
    this.state.players.forEach((p) => {
      if (!p.alive) return;
      this.applyHeal(p, p.maxHp * BOSSRUSH_HEAL_FRAC);
    });
    this.bossRushIndex++;
    if (this.bossRushIndex >= BOSS_DEF_IDS.length) {
      // GAUNTLET CLEARED: the boss core catches before progression presentation is torn down and banked.
      this.completeRewardBoundary("bossrush-victory");
      return;
    }
    this.beginNextPetDimension();
    // Escalate the difficulty (HP + damage) with each round, and queue the next boss after a breather.
    this.state.depth = Math.min(255, this.bossRushIndex + 1);
    this.bossRushNextTimer = BOSSRUSH_BREATHER;
  },

  /** Spawn a BOSS on a ring around a player (§16) — the run's capstone threat. `overrideKind` (the debug
   *  picker) spawns a specific boss BODY; otherwise the active dimension's boss. The body kind supplies the
   *  sprite/hp/radius; its `BossDef` (or CLASSIC_BOSS fallback) drives the attacks via the BossController. */
  retireStageForVastaghar(this: GameRoomContext): void {
    this.state.enemies.clear();
    this.enemyGrid.clear();
    this.state.projectiles.clear();
    this.projectileMeta.clear();
    this.hostileProjectileCount = 0;
    this.state.zones.clear();
    this.zoneMeta.clear();
    this.activeGroundZones.clear();
    this.groundZoneInputWasHeld.clear();
    this.enemyZoneSlow.clear();
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
  },

  spawnBoss(this: GameRoomContext, overrideKind?: string, petAwardEligible = true): void {
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
    if (def.encounter === "worm" && this.state.enemies.size + WORM_MAX_SEGMENTS + 3 > MAX_ENEMIES)
      return;
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
      boss.x = clamp(
        (this.state.beltLockX || bx) - 260,
        kind.radius,
        this.beltLevel.length - kind.radius,
      );
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
  },

  /** Reset the §17 shifter director (first incursion timer, no active incursion). `keepWaves` (a §6 rift
   *  descent) preserves the per-incursion HP ramp — descending IS "deeper into the chain"; only a fresh
   *  run/training toggle zeroes it. */
  resetShifters(this: GameRoomContext, keepWaves = false): void {
    this.shifterCd = SHIFTER_FIRST_SECONDS;
    this.shifterId = null;
    this.shifterTimer = 0;
    if (!keepWaves) this.shifterWaves = 0;
  },

  /** §17 SHIFTER director: manage the active incursion (phase it out when its hunt window expires) and, in
   *  normal play, start the next one on the cadence. Only one incursion at a time; held while the boss is up
   *  or the portal is open. The shifter's actual combat runs through the generic archetype AI. */
  stepShifters(this: GameRoomContext, dt: number, bodies: Vec2[]): void {
    // The active shifter died (or was removed) → clear tracking so the cooldown can restart.
    if (this.shifterId && !this.state.enemies.has(this.shifterId)) this.shifterId = null;

    if (this.shifterId) {
      // PHASE-OUT: an incursion the squad couldn't put down rifts back out when its window elapses.
      this.shifterTimer -= dt;
      if (this.shifterTimer <= 0) {
        this.state.enemies.delete(this.shifterId);
        const combo = this.comboState.get(this.shifterId);
        if (combo?.tg) this.removeTelegraphRow(combo.tg);
        this.meleeAttackTokens.releaseHolder(this.shifterId);
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
  },

  /** Phase a shifter in at the arena edge near a living drifter. Tier escalates with run time AND §6 chain
   *  depth (v0.103 — a depth-3 dimension opens with a mid-tier invader, matching the world around it); HP
   *  ramps per incursion across the WHOLE run (shifterWaves survives descents — "tougher deeper into the
   *  chain") and scales with depth like everything else. Hunts for `shifter.window` sec, then phases out. */
  spawnShifter(this: GameRoomContext, bodies: Vec2[]): boolean {
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
  },
} satisfies ThisType<GameRoomContext>;
