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
  gunLocomotionRecoilFor,
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
import { SpatialGrid } from "../SpatialGrid.js";import { COMBO_RINGOUT_ORBIT, COMBO_RIPOSTE_STAGGER_TICKS, ZERO_MOVE_INPUT, ZERO_IMPULSE, tickReached, ticksFromSeconds, pointSegmentDistanceSq, pointInConvexQuadrilateral, pointSweptUprightCapsuleDistanceSq, EXTRACT_ARM_SECONDS, EXTRACT_HOLD_SECONDS, SPAWN_CANDIDATE_COUNT, SPAWN_MIN_DISTANCE, SPAWN_CAMERA_HALF_WIDTH, SPAWN_CAMERA_HALF_HEIGHT, ENEMY_GRID_CELL_SIZE, MAX_ENEMY_RADIUS, ENEMY_SEPARATION_OVERLAP_FRACTION, ENEMY_SEPARATION_MAX_STEP, GROUND_ZONE_ENTITY_CAP, GROUND_ZONE_OWNER_CAP, weaponComboRootMotion, weaponComboForwardDrift } from "./room-progression.js";
import type { InputCmd, InputState, WeaponResourceLedger, WeaponSpendReason, ZoneRuntime, WeaponSpendResult, PendingScatterVolley, PendingHybridProjectile, PendingWeaponLunge, PendingWeaponThrow, ActiveMeleeSwing, DriveRuntime, RunWeaponLedger, PickupWeaponBankMeta, DisconnectedPlayerReservation, PlayerDamageKind, PetRunRuntime, UltimateTarget, UltimateRuntime, WeaponHand, CombatState, DuelistComboState, RewardBoundary, WeaponComboForwardDrift, WeaponComboRootMotion, GameRoomContext } from "./room-progression.js";

export const roomEconomyMethods = {

  /** §13 v0.106 (A11) spawn the player's currently-held weapon on the floor as a grabbable pickup in front
   *  of them, inheriting its rolled loot identity + earned provenance + a brief re-grab GRACE, then reset the
   *  hands to FISTS. No-op on fists (nothing to drop). Shared by the R-tap DROP and the grab-while-holding
   *  SWAP, so a grab can never silently DESTROY a held (possibly Legendary) weapon. */
  dropHeldWeapon(this: GameRoomContext, player: PlayerState, c: CombatState | undefined): void {
    if (player.weapon === FISTS_WEAPON) return;
    const activeSlot = player.slots[player.activeSlot];
    const bankEntryId = activeSlot?.bankEntryId ?? "";
    const bankEntry = bankEntryId
      ? this.weaponRuns.get(player.id)?.entries.get(bankEntryId)?.entry
      : undefined;
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
    const dropX = clamp(
      player.x + ax * PICKUP_RADIUS * 1.6,
      PICKUP_RADIUS,
      ARENA_WIDTH - PICKUP_RADIUS,
    );
    const dropY = clamp(
      player.y + ay * PICKUP_RADIUS * 1.6,
      PICKUP_RADIUS,
      ARENA_HEIGHT - PICKUP_RADIUS,
    );
    const sp = this.placePickupPos(dropX, dropY); // §29 belt: keep the drop on the deck (band + off pits)
    pk.x = sp.x;
    pk.y = sp.y;
    pk.disassemblable = !!bankEntry || !!c?.heldEarned;
    pk.ownerId = bankEntry ? player.id : "";
    this.state.pickups.set(pk.id, pk);
    this.pickupGrace.set(pk.id, DROP_GRACE_SECONDS);
    if (bankEntry) {
      this.pickupWeaponBankMeta.set(pk.id, {
        provenance: bankEntry.weapon.provenance,
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
    if (c) this.restoreWeaponResource(player, c);
    this.syncWeaponRunFromArsenal(player);
    this.sendWeaponManifest(player);
  },

  // ── §29 v0.118 ARSENAL helpers: the held weapon is the ACTIVE slot's live mirror; these keep the slots
  // array in sync and move weapons between hand / slots / bag. ──
  /** Copy one stored weapon into another (or clear `dst` when `src` is null). */
  /** Initialize a never-drawn stored weapon exactly once. Rebinding a ready row never grants resources. */
  weaponEntryDisassemblyValue(this: GameRoomContext, entry: WeaponBankEntryV1): number {
    return weaponEntryInstances(entry).reduce(
      (total, instance) => total + weaponDisassemblyValue(instance.weaponId),
      0,
    );
  },

  canDisassembleFloorPickup(this: GameRoomContext, player: PlayerState, pickup: PickupState): boolean {
    if (!pickup.disassemblable || (this.pickupGrace.get(pickup.id) ?? 0) > 0) return false;
    if (pickup.ownerId && pickup.ownerId !== player.id) return false;
    const bankMeta = this.pickupWeaponBankMeta.get(pickup.id);
    if (bankMeta?.ownerId && bankMeta.ownerId !== player.id) return false;
    const radius = Math.max(
      PICKUP_RADIUS,
      this.petRuns.get(player.id)?.mods.earnedPickupRadius ?? 0,
    );
    return (pickup.x - player.x) ** 2 + (pickup.y - player.y) ** 2 <= radius * radius;
  },

  clearFloorPickup(this: GameRoomContext, pickupId: string): void {
    this.state.pickups.delete(pickupId);
    this.pickupGrace.delete(pickupId);
    const eligibilityChanged = this.earnedPickups.delete(pickupId);
    this.pickupWeaponBankMeta.delete(pickupId);
    for (const [playerId, intent] of this.floorDisassemblyIntents) {
      if (intent.pickupId === pickupId) this.floorDisassemblyIntents.delete(playerId);
    }
    if (eligibilityChanged) this.publishPetPickupEligibility();
  },

  disassembleFloorPickup(this: GameRoomContext, player: PlayerState, pickup: PickupState): void {
    const bankEntry = this.pickupWeaponBankMeta.get(pickup.id)?.entry;
    const value = bankEntry
      ? this.weaponEntryDisassemblyValue(bankEntry)
      : weaponDisassemblyValue(pickup.weapon);
    if (value <= 0) return;
    const receipt: WeaponDisassemblyReceipt = {
      source: "floor",
      pickupId: pickup.id,
      weaponId: pickup.weapon,
      value,
      x: pickup.x,
      y: pickup.y,
    };
    if (bankEntry) this.consumeRunWeaponEntry(player, bankEntry.entryId);
    this.clearFloorPickup(pickup.id);
    this.awardMoney(value, player.id);
    this.sendOwnerMessage(player.id, "weaponDisassembled", receipt);
    this.syncWeaponRunFromArsenal(player);
    this.sendWeaponManifest(player);
  },

  disassembleBagPickup(this: GameRoomContext, player: PlayerState, index: number): void {
    const slot = player.bag[index];
    if (!slot?.weapon || slot.homeIssue || (!slot.earned && !slot.bankEntryId)) return;
    const bankRow = slot.bankEntryId
      ? this.weaponRuns.get(player.id)?.entries.get(slot.bankEntryId)
      : undefined;
    if (slot.bankEntryId && !bankRow) return;
    const value = bankRow
      ? this.weaponEntryDisassemblyValue(bankRow.entry)
      : weaponDisassemblyValue(slot.weapon);
    if (value <= 0) return;
    const receipt: WeaponDisassemblyReceipt = {
      source: "bag",
      pickupId: "",
      weaponId: slot.weapon,
      value,
      x: player.x,
      y: player.y,
    };
    if (bankRow) this.consumeRunWeaponEntry(player, bankRow.entry.entryId);
    else player.bag.splice(index, 1);
    this.awardMoney(value, player.id);
    this.syncWeaponRunFromArsenal(player);
    this.sendWeaponManifest(player);
    this.sendOwnerMessage(player.id, "weaponDisassembled", receipt);
  },

  initializeStoredWeaponResource(this: GameRoomContext, player: PlayerState, slot: ArsenalSlot): void {
    if (slot.resourceReady && slot.resourceWeapon === slot.weapon) return;
    slot.resourceWeapon = slot.weapon;
    slot.resourceReady = true;
    slot.cooldown = 0;
    slot.reload = 0;
    slot.resourceCharges = 0;
  },

  copySlot(this: GameRoomContext, dst: ArsenalSlot, src: ArsenalSlot | null): void {
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
    dst.bankProvenance = src?.bankProvenance ?? "";
    dst.sourceWorldTier = src?.sourceWorldTier ?? 0;
    dst.homeIssue = src?.homeIssue ?? false;
  },

  mintWeaponOpaqueId(this: GameRoomContext, prefix: "wi"): string {
    return `${prefix}_${randomBytes(16).toString("base64url")}`;
  },

  mintWeaponInstance(this: GameRoomContext,
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
  },

  installWeaponMember(this: GameRoomContext,
    slot: ArsenalSlot,
    entry: WeaponBankEntryV1,
    member: WeaponInstanceV1,
  ): void {
    this.copySlot(slot, null);
    slot.weapon = member.weaponId;
    slot.rarity = RARITIES.findIndex((rarity) => rarity.id === member.rarity);
    slot.affix = member.affix;
    slot.earned = true;
    slot.instanceId = member.instanceId;
    slot.bankEntryId = entry.entryId;
    slot.bankProvenance = member.provenance;
    slot.sourceWorldTier = member.sourceWorldTier;
    slot.resourceWeapon = member.weaponId;
    slot.resourceReady = false;
  },

  installHomeIssue(this: GameRoomContext, slot: ArsenalSlot): void {
    this.copySlot(slot, null);
    slot.weapon = DEFAULT_WEAPON;
    slot.rarity = RARITY_COMMON;
    slot.affix = "";
    slot.earned = false;
    slot.homeIssue = true;
    slot.resourceWeapon = DEFAULT_WEAPON;
    slot.resourceReady = false;
  },

  /** Project account-private escrow into the existing three slots + dense Pack rows at a join/rejoin edge. */
  materializeWeaponRun(this: GameRoomContext, player: PlayerState, account: MetaAccountV5): void {
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
        const slot = target[row.start];
        if (slot) this.installWeaponMember(slot, row.entry, row.entry.weapon);
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
      const requested = player.slots.findIndex((slot) => slot.bankEntryId === activeEntryId);
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
  },

  createWeaponRun(this: GameRoomContext, playerId: string, account: MetaAccountV5): RunWeaponLedger | undefined {
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
    return run;
  },

  /** Slot/Pack topology is a view; this records it back onto the exact escrow entries after explicit moves. */
  syncWeaponRunFromArsenal(this: GameRoomContext, player: PlayerState): void {
    const run = this.weaponRuns.get(player.id);
    if (!run) return;
    for (const row of run.entries.values()) {
      row.location = "field";
      row.start = 255;
    }
    for (let index = 0; index < player.slots.length; index++) {
      const slot = player.slots[index];
      if (!slot?.bankEntryId) continue;
      const row = run.entries.get(slot.bankEntryId);
      if (row) {
        row.location = "active";
        row.start = index;
      }
    }
    for (let index = 0; index < player.bag.length; index++) {
      const slot = player.bag[index];
      if (!slot?.bankEntryId) continue;
      const row = run.entries.get(slot.bankEntryId);
      if (row) {
        row.location = "pack";
        row.start = index;
      }
    }
  },

  registerFoundWeaponEntry(this: GameRoomContext, player: PlayerState, entry: WeaponBankEntryV1): void {
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
  },

  consumeRunWeaponEntry(this: GameRoomContext, player: PlayerState, entryId: string): void {
    if (!entryId) return;
    const run = this.weaponRuns.get(player.id);
    const account = this.metaAccounts.get(player.id);
    const row = run?.entries.get(entryId);
    if (!run || !account?.weaponBank.expedition || !row) return;
    for (const instance of weaponEntryInstances(row.entry))
      run.byInstanceId.delete(instance.instanceId);
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
  },

  sendWeaponManifest(this: GameRoomContext, player: PlayerState): void {
    const run = this.weaponRuns.get(player.id);
    if (!run) return;
    this.syncWeaponRunFromArsenal(player);
    const entries = [] as Array<{
      entryId: string;
      kind: "single";
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
  },

  bagCapacity(this: GameRoomContext, player: PlayerState): number {
    return BAG_CAP + (this.petRuns.get(player.id)?.mods.bagCapacityAdd ?? 0);
  },

  resetChestDirector(this: GameRoomContext): void {
    this.state.chests.clear();
    this.chestRoomSeed = mixSeeds(
      this.state.seedTerrain,
      this.state.seedHazard,
      this.state.seedTheme,
      this.state.seedDecor,
      0xc4e57,
    );
    this.chestRunStartTick = this.state.tick;
    this.chestCadence = chestCadenceInitial(this.state.tick, this.chestRoomSeed);
  },

  stepChestDirector(this: GameRoomContext): void {
    const corporateFloor = this.isCorporateLoop();
    if (
      (this.belt && !corporateFloor) ||
      this.state.mode !== "arena" ||
      this.state.outcome !== "active" ||
      this.state.portalOpen
    )
      return;
    const advanced = advanceChestCadence(this.chestCadence, this.state.tick, this.chestRoomSeed);
    this.chestCadence = advanced.state;
    for (const directive of advanced.spawns) {
      const existing = [...this.state.chests.values()].map((chest) => ({
        x: chest.x,
        y: chest.y,
      }));
      const floor =
        corporateFloor && this.beltLevel
          ? corporateGridFloorForBelt(this.beltLevel)
          : undefined;
      const anchor = floor?.waveAnchors[directive.sequence % floor.waveAnchors.length];
      const beltPlacement =
        this.beltLevel && anchor
          ? resolveBeltNavigation(
              this.beltLevel,
              anchor.x,
              BELT_Y0 + anchor.y,
              CHEST_PLACEMENT_RADIUS,
            )
          : undefined;
      const placement = beltPlacement
        ? { ...beltPlacement, zone: 0 as MapZoneId }
        : placeChestOnArena(
            this.map,
            this.chestRoomSeed,
            directive.sequence,
            directive.spawnTick,
            existing,
          );
      const chest = new ChestState();
      chest.id = `chest:${directive.sequence}:${directive.spawnTick}`;
      chest.x = placement.x;
      chest.y = placement.y;
      chest.zone = placement.zone;
      chest.kind = directive.kind;
      chest.spawnTick = directive.spawnTick;
      this.state.chests.set(chest.id, chest);
    }
  },

  refreshChestOpened(this: GameRoomContext, chest: ChestState): void {
    let opened = this.state.players.size > 0;
    this.state.players.forEach((_player, id) => {
      if (!chest.openedBy.get(id)) opened = false;
    });
    chest.opened = opened;
  },

  refreshAllChestOpened(this: GameRoomContext): void {
    this.state.chests.forEach((chest) => {
      this.refreshChestOpened(chest);
    });
  },

  chestWeaponBagSlot(this: GameRoomContext, player: PlayerState): ArsenalSlot | undefined {
    for (const slot of player.bag) if (!slot.weapon) return slot;
    if (player.bag.length >= this.bagCapacity(player)) return undefined;
    const slot = new ArsenalSlot();
    player.bag.push(slot);
    return slot;
  },

  grantChestWeapon(this: GameRoomContext, player: PlayerState, weaponId: string): boolean {
    const slot = this.chestWeaponBagSlot(player);
    if (!slot || !WEAPONS[weaponId]) return false;
    this.copySlot(slot, null);
    slot.weapon = weaponId;
    slot.rarity = RARITY_COMMON;
    slot.affix = "";
    slot.earned = true;
    slot.resourceWeapon = weaponId;
    slot.resourceReady = false;
    this.syncWeaponRunFromArsenal(player);
    this.sendWeaponManifest(player);
    return true;
  },

  dropChestWeapon(this: GameRoomContext, player: PlayerState, chest: ChestState, weaponId: string): boolean {
    if (!WEAPONS[weaponId]) return false;
    const pickup = new PickupState();
    pickup.id = `dropChest${this.pickupSeq++}`;
    pickup.weapon = weaponId;
    pickup.weaponPublic = weaponId;
    pickup.rarity = RARITY_COMMON;
    pickup.affix = "";
    pickup.affixPublic = "";
    pickup.known = true;
    pickup.disassemblable = true;
    pickup.ownerId = player.id;
    const placed = this.placePickupPos(chest.x + PICKUP_RADIUS, chest.y);
    pickup.x = placed.x;
    pickup.y = placed.y;
    this.state.pickups.set(pickup.id, pickup);
    this.earnedPickups.add(pickup.id);
    this.pickupWeaponBankMeta.set(pickup.id, {
      provenance: "enemy-drop",
      ownerId: player.id,
      ownerLockUntil: Number.POSITIVE_INFINITY,
    });
    this.publishPetPickupEligibility();
    return true;
  },

  maybeDropEnemyWeapon(this: GameRoomContext, enemy: EnemyState, kind: EnemyKind): void {
    const weaponId = kind.wieldsWeapon;
    if (
      this.state.mode !== "arena" ||
      kind.archetype === "boss" ||
      kind.archetype === "dummy" ||
      !weaponId ||
      !WEAPONS[weaponId]
    )
      return;
    this.state.players.forEach((_player, playerId) => {
      const account = this.metaAccounts.get(playerId);
      if (!account?.unlockedWeapons.includes(weaponId) || Math.random() >= (kind.dropWeapon ?? 0))
        return;
      const pickup = new PickupState();
      pickup.id = `dropEnemy${this.pickupSeq++}`;
      pickup.weapon = weaponId;
      pickup.weaponPublic = weaponId;
      pickup.rarity = RARITY_COMMON;
      pickup.affix = "";
      pickup.affixPublic = "";
      pickup.known = true;
      pickup.disassemblable = true;
      pickup.ownerId = playerId;
      const placed = this.placePickupPos(enemy.x, enemy.y);
      pickup.x = placed.x;
      pickup.y = placed.y;
      this.state.pickups.set(pickup.id, pickup);
      this.earnedPickups.add(pickup.id);
      this.pickupWeaponBankMeta.set(pickup.id, {
        provenance: "enemy-drop",
        ownerId: playerId,
        ownerLockUntil: Number.POSITIVE_INFINITY,
      });
    });
    this.publishPetPickupEligibility();
  },

  grantCommonRelic(this: GameRoomContext, player: PlayerState, id: CommonRelicId): number {
    const relics = player.relics;
    const increment = (value: number): number =>
      Math.min(RELIC_COMMON_STACK_CAP, Math.max(0, Math.floor(value)) + 1);
    switch (id) {
      case "energy-pool": {
        const before = relics.energyPool;
        relics.energyPool = increment(relics.energyPool);
        if (relics.energyPool > before) {
          const combat = this.combat.get(player.id);
          if (combat) {
            combat.drive.valueF = Math.min(relicEnergyCapacity(relics), combat.drive.valueF + 10);
            player.weaponResource.valueQ = Math.floor(combat.drive.valueF * 100 + 1e-7);
          }
        }
        return relics.energyPool;
      }
      case "energy-regen":
        relics.energyRegen = increment(relics.energyRegen);
        return relics.energyRegen;
      case "parry-reach":
        relics.parryReach = increment(relics.parryReach);
        return relics.parryReach;
      case "dodge-recovery":
        relics.dodgeRecovery = increment(relics.dodgeRecovery);
        return relics.dodgeRecovery;
      case "move-speed":
        relics.moveSpeed = increment(relics.moveSpeed);
        return relics.moveSpeed;
      case "hp-regen":
        relics.hpRegen = increment(relics.hpRegen);
        return relics.hpRegen;
      case "luck":
        relics.luck = increment(relics.luck);
        return relics.luck;
      case "crit":
        relics.crit = increment(relics.crit);
        return relics.crit;
      case "jump-count":
        relics.jumpCount = increment(relics.jumpCount);
        relics.airJumpsRemaining = Math.min(255, relics.airJumpsRemaining + 1);
        return relics.jumpCount;
    }
    return 0;
  },

  grantRareRelic(this: GameRoomContext, player: PlayerState, id: RareRelicId): number {
    const relics = player.relics;
    if (hasRareRelic(relics.ownedRare, id)) return 1;
    relics.ownedRare = appendRareRelic(relics.ownedRare, id);
    if (id.startsWith("dodge-")) relics.activeDodge = id;
    if (id === "revive") relics.reviveAvailable = true;
    return 1;
  },

  openChestForPlayer(this: GameRoomContext, playerId: string, chestId: string): void {
    const player = this.state.players.get(playerId);
    const chest = this.state.chests.get(chestId);
    if (!player?.alive || !chest || chest.openedBy.get(playerId)) return;
    const dx = player.x - chest.x;
    const dy = player.y - chest.y;
    if (dx * dx + dy * dy > CHEST_OPEN_RADIUS * CHEST_OPEN_RADIUS) return;
    const ownedRareIds = player.relics.ownedRare.split(",").filter(isRareRelicId) as RareRelicId[];
    const account = this.metaAccounts.get(playerId);
    const reward = rollChestReward({
      roomSeed: this.chestRoomSeed,
      chestSequence: Number(chest.id.split(":")[1]) || 0,
      spawnTick: chest.spawnTick,
      elapsedSeconds: Math.max(0, ((this.state.tick - this.chestRunStartTick) * TICK_MS) / 1_000),
      zone: chest.zone as MapZoneId,
      kind: chest.kind as ChestKind,
      playerKey: playerId,
      luckStacks: player.relics.luck,
      ownedRareIds,
      weaponIds: account ? unlockedWeaponDropPool(account) : [],
    });
    if (reward.weapon) {
      if (this.chestWeaponBagSlot(player)) {
        if (!this.grantChestWeapon(player, reward.weapon.id)) return;
      } else {
        if (!this.dropChestWeapon(player, chest, reward.weapon.id)) return;
      }
    }
    const relicReceipts: Array<{
      id: CommonRelicId | RareRelicId;
      rarity: "common" | "rare";
      label: string;
      stacks: number;
    }> = [];
    for (const relic of reward.relics) {
      if (relic.rarity === "rare") {
        const id = relic.id as RareRelicId;
        const stacks = this.grantRareRelic(player, id);
        relicReceipts.push({
          ...relic,
          label: RARE_RELIC_DEFS.find((def) => def.id === id)?.label ?? id,
          stacks,
        });
      } else {
        const id = relic.id as CommonRelicId;
        const stacks = this.grantCommonRelic(player, id);
        relicReceipts.push({
          ...relic,
          label: COMMON_RELIC_DEFS.find((def) => def.id === id)?.label ?? id,
          stacks,
        });
      }
    }
    if (reward.money > 0) this.dropMoney(chest.x, chest.y, reward.money, playerId);
    chest.openedBy.set(playerId, true);
    this.refreshChestOpened(chest);
    const weapon = reward.weapon
      ? {
          ...reward.weapon,
          name: WEAPONS[reward.weapon.id]?.name ?? reward.weapon.id,
        }
      : undefined;
    this.sendOwnerMessage(playerId, "chestOpened", {
      chestId,
      zone: chest.zone,
      kind: chest.kind,
      weapon,
      relics: relicReceipts,
      money: reward.money,
    });
  },

  /** Persist only the active weapon instance's cadence debt before identity changes. */
  saveWeaponResource(this: GameRoomContext, player: PlayerState, c: CombatState): void {
    if (!c.lastWeapon) return;
    const resourceWeapon = WEAPONS[c.lastWeapon];
    const breakAction = isBreakActionWeapon(resourceWeapon);
    if (this.belt) {
      const slot = player.slots[player.activeSlot];
      if (!slot || slot.weapon !== c.lastWeapon) return;
      slot.resourceWeapon = c.lastWeapon;
      slot.resourceReady = true;
      slot.cooldown = Math.max(0, c.cd);
      slot.reload = breakAction ? Math.max(0, c.reloadCd) : 0;
      slot.resourceCharges = breakAction ? Math.max(0, player.charges) : 0;
      return;
    }
    let ledger = c.weaponLedger.get(c.lastWeapon);
    if (!ledger) {
      ledger = {
        cooldown: 0,
        reload: 0,
        charges: breakAction ? resourceWeapon.gun.magazine : 0,
      };
      c.weaponLedger.set(c.lastWeapon, ledger);
    }
    ledger.cooldown = Math.max(0, c.cd);
    ledger.reload = breakAction ? Math.max(0, c.reloadCd) : 0;
    ledger.charges = breakAction ? Math.max(0, player.charges) : 0;
  },

  /** Restore a weapon's own debt. Only a genuinely new pickup may initialize a fresh resource row. */
  restoreWeaponResource(this: GameRoomContext,
    player: PlayerState,
    c: CombatState,
    genuinelyNewPickup = false,
    applyDrawLock = true,
  ): void {
    const weaponId = player.weapon;
    const resourceWeapon = WEAPONS[weaponId];
    const breakAction = isBreakActionWeapon(resourceWeapon);
    let cooldown = 0;
    let reload = 0;
    let charges = breakAction ? resourceWeapon.gun.magazine : 0;
    if (this.belt) {
      const slot = player.slots[player.activeSlot];
      if (!genuinelyNewPickup && slot?.resourceReady && slot.resourceWeapon === weaponId) {
        cooldown = slot.cooldown;
        if (breakAction) {
          reload = slot.reload;
          charges = slot.resourceCharges;
        }
      } else if (slot) {
        slot.resourceWeapon = weaponId;
        slot.resourceReady = true;
        slot.cooldown = 0;
        slot.reload = 0;
        slot.resourceCharges = charges;
      }
    } else {
      let ledger = c.weaponLedger.get(weaponId);
      if (!ledger || genuinelyNewPickup) {
        ledger = { cooldown: 0, reload: 0, charges };
        c.weaponLedger.set(weaponId, ledger);
      }
      cooldown = ledger.cooldown;
      reload = breakAction ? ledger.reload : 0;
      charges = breakAction ? ledger.charges : 0;
    }
    c.lastWeapon = weaponId;
    c.cd = Math.max(0, cooldown);
    c.gunBurstRemaining = 0;
    c.gunBurstT = 0;
    c.gunBurstWeaponId = "";
    c.gunBurstHand = 0;
    c.reloadCd = breakAction ? Math.max(0, reload) : 0;
    c.attackBuffer = 0;
    if (applyDrawLock) {
      const quirkMult = c.mods.drawLockMult;
      c.drawLock = Math.max(c.drawLock, WEAPON_DRAW_LOCK_SECONDS * quirkMult);
    }
    player.maxCharges = breakAction ? resourceWeapon.gun.magazine : 0;
    player.charges = breakAction ? Math.max(0, Math.min(player.maxCharges, charges)) : 0;
  },

  transitionWeapon(this: GameRoomContext,
    player: PlayerState,
    c: CombatState,
    genuinelyNewPickup = false,
    applyDrawLock = true,
  ): void {
    this.saveWeaponResource(player, c);
    if (c.beamPhase !== 0 || c.beamDescriptor) {
      this.cancelBeam(player, player.id, c, true, true);
    }
    c.auraActive = false;
    c.auraInputWasHeld = false;
    c.auraRequireRelease = false;
    c.auraPulseT = 0;
    c.chargedProjectileInputWasHeld = false;
    c.chargedProjectileWeaponId = "";
    c.chargedProjectileStartTick = 0;
    player.weaponChargeActive = false;
    player.weaponChargeStartTick = 0;
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
  },

  /** Frostbore's two-shell exception reuses the retained private reload/resource row. The row advances on
   * the fixed simulation clock and mirrors only its two public counters for deterministic remote posing. */
  stepHeldBreakActionReload(this: GameRoomContext,
    player: PlayerState,
    c: CombatState,
    weapon: WeaponDef | undefined,
    dt: number,
  ): void {
    if (!isBreakActionWeapon(weapon)) return;
    player.maxCharges = weapon.gun.magazine;
    if (player.charges > 0) {
      c.reloadCd = 0;
      return;
    }
    c.reloadCd = Math.max(0, c.reloadCd - dt);
    if (c.reloadCd <= 0) player.charges = weapon.gun.magazine;
  },

  /** Stowed debts progress normally; swapping changes identity, never the passage of time. */
  stepStowedWeaponResources(this: GameRoomContext, player: PlayerState, c: CombatState, dt: number): void {
    if (this.belt) {
      for (let i = 0; i < player.slots.length; i++) {
        if (i === player.activeSlot) continue;
        const slot = player.slots[i];
        if (slot?.resourceReady) this.stepStoredSlot(player, slot, dt);
      }
      for (const slot of player.bag) if (slot.resourceReady) this.stepStoredSlot(player, slot, dt);
      return;
    }
    for (const [weaponId, ledger] of c.weaponLedger) {
      if (weaponId === player.weapon) continue;
      ledger.cooldown = Math.max(0, ledger.cooldown - dt);
      const resourceWeapon = WEAPONS[weaponId];
      const breakAction = isBreakActionWeapon(resourceWeapon);
      if (breakAction && ledger.charges === 0) {
        const stowedRate = this.petRuns.get(player.id)?.mods.stowedReloadRate ?? 1;
        ledger.reload = Math.max(0, ledger.reload - dt * stowedRate);
        if (ledger.reload <= 0) ledger.charges = resourceWeapon.gun.magazine;
      } else if (!breakAction) {
        ledger.reload = 0;
        ledger.charges = 0;
      }
    }
  },

  stepStoredSlot(this: GameRoomContext, player: PlayerState, slot: ArsenalSlot, dt: number): void {
    slot.cooldown = Math.max(0, slot.cooldown - dt);
    const resourceWeapon = WEAPONS[slot.resourceWeapon || slot.weapon];
    const breakAction = isBreakActionWeapon(resourceWeapon);
    if (breakAction && slot.resourceCharges === 0) {
      const stowedRate = this.petRuns.get(player.id)?.mods.stowedReloadRate ?? 1;
      slot.reload = Math.max(0, slot.reload - dt * stowedRate);
      if (slot.reload <= 0) slot.resourceCharges = resourceWeapon.gun.magazine;
    } else if (!breakAction) {
      slot.reload = 0;
      slot.resourceCharges = 0;
    }
  },

  /** Write the live held weapon (+ loot identity + earned provenance) INTO the active slot, so the slots
   *  array reflects reality before a swap/grab/stash reads it. FISTS → an empty slot. */
  syncActiveSlot(this: GameRoomContext, player: PlayerState, c: CombatState | undefined): void {
    const s = player.slots[player.activeSlot];
    if (!s) return;
    if (c) this.saveWeaponResource(player, c);
    if (!player.weapon || player.weapon === FISTS_WEAPON) {
      this.copySlot(s, null);
    } else {
      if (s.weapon !== player.weapon) {
        s.instanceId = "";
        s.bankEntryId = "";
        s.bankProvenance = "";
        s.sourceWorldTier = 0;
        s.homeIssue = false;
      }
      s.weapon = player.weapon;
      s.rarity = player.weaponRarity;
      s.affix = player.weaponAffix;
      s.earned = !!c?.heldEarned;
    }
  },

  /** Load slot `i` into the player's hands (sets it active + mirrors held weapon/loot/provenance). An empty
   *  slot loads FISTS. */
  loadSlot(this: GameRoomContext, player: PlayerState, c: CombatState | undefined, i: number): void {
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
  },

  /** §29 BELT grab: ADD the grabbed weapon to the arsenal instead of the arena swap-drop. Fills the first
   *  empty slot (and equips it); if all 3 are full, the current active weapon overflows to the bag (or drops
   *  to the floor when the bag is full too — still never destroyed) and the grab takes the active slot. */
  grabIntoArsenal(this: GameRoomContext,
    player: PlayerState,
    c: CombatState | undefined,
    grabbed: PickupState,
    bankEntry?: WeaponBankEntryV1,
  ): boolean {
    this.syncActiveSlot(player, c);
    const earned = this.earnedPickups.has(grabbed.id);
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
    if (bankEntry) this.installWeaponMember(s, bankEntry, bankEntry.weapon);
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
  },

  /** Stat-free held damage multiplier. Authored source damage is modified only by the held weapon's
   * non-stat factors: loot identity, weapon-set bonus, and runtime effects. */
  heldDamageMult(this: GameRoomContext, weapon: WeaponDef, player: PlayerState, _hand: WeaponHand = 0): number {
    const c = this.combat.get(player.id);
    return (
      lootDamageMult(player.weaponRarity, player.weaponAffix) *
      weaponSetBonus(this.loadoutIds(player), weapon.id) * // §30 class set-bonus (2/3-of-a-class)
      (c?.mods.outgoingWeaponDamageMult ?? 1)
    );
  },

  /** One audited recovery seam for held, cast, gun, thrown, beam, and stored cooldown debt. */
  weaponRecoveryMult(this: GameRoomContext, player: PlayerState, weapon: WeaponDef): number {
    const mods = this.combat.get(player.id)?.mods;
    if (!mods) return 1;
    let mult = mods.weaponCooldownMult;
    if (weapon.gun) mult *= mods.gunCooldownMult;
    else if (weapon.beam) mult *= mods.beamCooldownMult;
    else if (weapon.cast || weapon.tags.classPool === "caster") mult *= mods.casterCooldownMult;
    else mult *= mods.meleeCooldownMult;
    if (weapon.tags.grip === "2H") mult *= mods.heavyCooldownMult;
    return mult;
  },

  heldCastDamageMult(this: GameRoomContext, weapon: WeaponDef, player: PlayerState, hand: WeaponHand = 0): number {
    return this.heldDamageMult(weapon, player, hand);
  },

  /** Capture the cosmetic character as flavor-only run identity. */
  snapshotRunCharacter(this: GameRoomContext,
    player: PlayerState,
    combat: CombatState | undefined,
    _rebase: boolean,
    topUpMaxHp = true,
  ): void {
    const identity = isPlayableCharacter(player.character) ? player.character : DEFAULT_CHARACTER;
    player.runCharacter = identity;
    player.gearSeeded = false;
    player.gearUpper = "";
    player.gearLower = "";
    const quirk = quirkForCharacter(identity);
    if (combat) {
      combat.identityCharacter = identity;
      combat.quirk = quirk;
      combat.mods = runtimeModsForQuirk(quirk);
    }
    const previousMax = player.maxHp;
    player.maxHp = PLAYER_MAX_HP;
    if (topUpMaxHp && player.maxHp > previousMax) player.hp += player.maxHp - previousMax;
    player.hp = Math.min(player.hp, player.maxHp);
  },

  /** Install one validated, catalog-derived wardrobe snapshot without applying numeric stats. */
  snapshotGearRun(this: GameRoomContext,
    player: PlayerState,
    combat: CombatState | undefined,
    runtime: GearRunRuntime,
    topUpMaxHp = true,
  ): void {
    player.character = "drifter";
    player.runCharacter = "drifter";
    player.gearSeeded = true;
    const cosmetics = encodeGearCosmetics(runtime.idsBySlot);
    player.gearUpper = cosmetics.gearUpper;
    player.gearLower = cosmetics.gearLower;
    if (combat) {
      combat.identityCharacter = "drifter";
      combat.quirk = runtime.quirk;
      combat.mods = runtime.mods;
    }
    const previousMax = player.maxHp;
    player.maxHp = PLAYER_MAX_HP + runtime.mods.maxHpAdd;
    if (topUpMaxHp && player.maxHp > previousMax) player.hp += player.maxHp - previousMax;
    player.hp = Math.min(player.hp, player.maxHp);
  },

  /** Gear owns identity when present; character kits remain the compatibility fallback until the art wave. */
  snapshotRunIdentity(this: GameRoomContext,
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
  },

  /** Interpret pure quirk descriptors at event seams through existing authoritative state machinery. */
  applyQuirkEffects(this: GameRoomContext,
    player: PlayerState,
    combat: CombatState,
    effects: readonly QuirkEffect[],
  ): void {
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
  },

  applyParryQuirk(this: GameRoomContext, player: PlayerState, combat: CombatState, parryHeal: number): void {
    const effects = combat.quirk.hooks?.onParrySuccess?.({ parryHeal });
    if (effects) this.applyQuirkEffects(player, combat, effects);
  },

  applyKillQuirk(this: GameRoomContext, player: PlayerState, combat: CombatState, enemy: EnemyState): void {
    const effects = combat.quirk.hooks?.onKill?.({
      killedEnemyId: enemy.id,
      killDistance: Math.hypot(enemy.x - player.x, enemy.y - player.y),
    });
    if (effects) this.applyQuirkEffects(player, combat, effects);
  },

  /** §30 the player's equipped loadout as weapon ids — the active slot reads the LIVE held weapon (slots are
   *  only re-synced on swap), the others their stored weapon. Drives the class set-bonus count. */
  loadoutIds(this: GameRoomContext, player: PlayerState): string[] {
    const out: string[] = [];
    for (let i = 0; i < player.slots.length; i++) {
      out.push(i === player.activeSlot ? player.weapon : (player.slots[i]?.weapon ?? ""));
    }
    return out;
  },

  /** §6 count of LIVING players — what the TRASH horde difficulty scales on, so a mostly-downed squad faces
   *  a beatable horde and rezzes stay achievable (the rez-or-dead death-spiral fix). The boss keeps the
   *  full-squad `players.size` high-water-mark (a capstone shouldn't soften because allies are down). */
  livingCount(this: GameRoomContext): number {
    let n = 0;
    this.state.players.forEach((p) => {
      if (p.alive) n++;
    });
    return Math.max(1, n);
  },

  ownerClient(this: GameRoomContext, playerId: string): Client | undefined {
    for (const client of this.clients) if (client.sessionId === playerId) return client;
    return undefined;
  },

  sendOwnerMessage(this: GameRoomContext, playerId: string, type: string, payload: unknown): void {
    const client = this.ownerClient(playerId);
    if (client && typeof client.send === "function") client.send(type, payload);
  },

  /** Copper Gecko's wider reach is intentionally private: only its owner receives the earned-id rail that
   *  lets P2 render an honest local prompt. This runs only when that rare set changes, never per tick. */
  publishPetPickupEligibility(this: GameRoomContext): void {
    let ids: string[] | undefined;
    this.state.players.forEach((player) => {
      if ((this.petRuns.get(player.id)?.mods.earnedPickupRadius ?? 0) <= 0) return;
      ids ??= Array.from(this.earnedPickups);
      this.sendOwnerMessage(player.id, "petPickupEligibility", { ids });
    });
  },

  bumpAccountRevision(this: GameRoomContext, account: MetaAccountV5): void {
    account.revision = Math.min(META_ACCOUNT_REVISION_MAX, account.revision + 1);
  },

  /** New run/ready boundary: only the pet identity and presentation band enter public run state. */
  snapshotPetRun(this: GameRoomContext, player: PlayerState, selectedPetId: PetId | ""): void {
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
  },

  resetPetAccrual(this: GameRoomContext, playerId: string): void {
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
  },

  /** Allocation-free 20 Hz qualification clock; training/debug rooms never build Bond eligibility. */
  advancePetPresence(this: GameRoomContext, dt: number): void {
    if (
      this.state.outcome !== "active" ||
      (this.state.mode !== "arena" && this.state.mode !== "bossrush")
    )
      return;
    this.petRuns.forEach((pet, playerId) => {
      if (!this.state.players.has(playerId) || pet.settled) return;
      pet.dimensionPresenceSeconds += dt;
    });
  },

  /** Count only a server-accepted combat/support result, never a message, movement tick, dummy, or training. */
  recordPetAcceptedAction(this: GameRoomContext, playerId: string): void {
    if (
      this.state.outcome !== "active" ||
      (this.state.mode !== "arena" && this.state.mode !== "bossrush")
    )
      return;
    const player = this.state.players.get(playerId);
    const pet = this.petRuns.get(playerId);
    if (!player?.alive || !pet || pet.settled) return;
    pet.acceptedActionsThisDimension++;
  },

  /** Evaluate each authored dimension/boss epoch once. Failed presence/action qualification cannot pay later. */
  awardPetDimensionClear(this: GameRoomContext): void {
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
      )
        return;
      pet.pendingBondXp = Math.min(500, pet.pendingBondXp + awards[pet.clearReceipts]!);
      pet.clearReceipts++;
    });
  },

  beginNextPetDimension(this: GameRoomContext): void {
    this.petDimensionEpoch++;
    this.petRuns.forEach((pet) => {
      pet.dimensionPresenceSeconds = 0;
      pet.acceptedActionsThisDimension = 0;
    });
  },

  rollSlateTortoise(this: GameRoomContext, account: MetaAccountV5, outcome: "defeat" | "victory"): boolean {
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
  },

  /** One idempotent account commit for pets, money, and exact weapon escrow on every terminal route. */
  settleMetaAccounts(this: GameRoomContext, outcome: "defeat" | "victory"): void {
    this.metaAccounts.forEach((account, playerId) => {
      if (this.petSettledAccounts.has(playerId)) return;
      this.petSettledAccounts.add(playerId);
      if (outcome === "victory") this.prestigeGameClearReceipts.add(playerId);
      else this.prestigeGameClearReceipts.delete(playerId);
      const player =
        this.state.players.get(playerId) ?? this.disconnectedPlayers.get(playerId)?.player;
      const previousBank = Math.max(0, Math.min(META_ACCOUNT_SCRIP_MAX, Math.floor(account.scrip)));
      const runMoney = player
        ? Math.max(0, Math.min(META_ACCOUNT_SCRIP_MAX, Math.floor(player.scrip)))
        : 0;
      account.scrip = Math.min(META_ACCOUNT_SCRIP_MAX, previousBank + runMoney);
      if (player) player.scrip = 0;
      const moneyReceipt: MoneyBankReceipt = {
        outcome,
        banked: account.scrip - previousBank,
        previousBank,
        bankTotal: account.scrip,
      };
      if (player) {
        this.syncWeaponRunFromArsenal(player);
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
      this.sendOwnerMessage(playerId, "moneyBankReceipt", moneyReceipt);
      if (receipt) this.sendOwnerMessage(playerId, "petProgressReceipt", receipt);
      this.sendOwnerMessage(playerId, "metaAccount", account);
      this.weaponRuns.delete(playerId);
      this.disconnectedPlayers.delete(playerId);
    });
  },

  /** Explicit event/intermission heal; passive regen, revive HP, meta headroom and Hearth's own 15% use
   * their dedicated paths. The receiver's selected pet owns the multiplier. */
  applyHeal(this: GameRoomContext,
    target: PlayerState,
    rawAmount: number,
    applyReceivedMultiplier = true,
  ): number {
    if (!target.alive || rawAmount <= 0) return 0;
    const multiplier = applyReceivedMultiplier
      ? (this.petRuns.get(target.id)?.mods.healingReceivedMultiplier ?? 1) *
        (this.combat.get(target.id)?.mods.healingReceivedMult ?? 1)
      : 1;
    const before = target.hp;
    target.hp = Math.min(target.maxHp, target.hp + rawAmount * multiplier);
    return target.hp - before;
  },

  /** Credit a collected drop through the per-player run-money rail. */
  awardMoney(this: GameRoomContext, amount: number, ownerId = ""): void {
    const payout = Math.max(0, Math.floor(amount));
    if (payout <= 0) return;
    if (ownerId) {
      const owner =
        this.state.players.get(ownerId) ?? this.disconnectedPlayers.get(ownerId)?.player;
      if (owner) owner.scrip = Math.min(META_ACCOUNT_SCRIP_MAX, owner.scrip + payout);
      return;
    }
    this.state.players.forEach((player) => {
      player.scrip = Math.min(META_ACCOUNT_SCRIP_MAX, player.scrip + payout);
    });
  },

  moneyDropReach(this: GameRoomContext, player: PlayerState): number {
    return clamp(
      BASE_MONEY_DROP_REACH + (this.petRuns.get(player.id)?.mods.moneyDropReachAdd ?? 0),
      MONEY_DROP_REACH_MIN,
      MONEY_DROP_REACH_MAX,
    );
  },

  nearestMoneyCollector(this: GameRoomContext,
    x: number,
    y: number,
    requireReach: boolean,
    ownerId = "",
  ): PlayerState | null {
    let best: PlayerState | null = null;
    let bestId = "";
    let bestD2 = Number.POSITIVE_INFINITY;
    this.state.players.forEach((player, id) => {
      if (!player.alive) return;
      if (ownerId && id !== ownerId) return;
      const dx = player.x - x;
      const dy = player.y - y;
      const d2 = dx * dx + dy * dy;
      const reach = this.moneyDropReach(player);
      if (requireReach && d2 > reach * reach) return;
      if (d2 < bestD2 || (d2 === bestD2 && (bestId === "" || id.localeCompare(bestId) < 0))) {
        best = player;
        bestId = id;
        bestD2 = d2;
      }
    });
    return best;
  },

  /** Convert one chest money roll into a bounded collectible row. Overflow merges; value is conserved. */
  dropMoney(this: GameRoomContext, x: number, y: number, value: number, ownerId = ""): void {
    const amount = Math.max(0, Math.floor(value));
    if (amount <= 0 || this.state.players.size === 0) return;
    let target: MoneyDropState | undefined;
    let nearestD2 = Number.POSITIVE_INFINITY;
    if (this.state.moneyDrops.size >= MAX_MONEY_DROPS) {
      this.state.moneyDrops.forEach((drop) => {
        if (drop.delivered) return;
        if (drop.ownerId !== ownerId) return;
        const dx = drop.x - x;
        const dy = drop.y - y;
        const d2 = dx * dx + dy * dy;
        if (d2 < nearestD2) {
          target = drop;
          nearestD2 = d2;
        }
      });
    }
    if (target) {
      target.value = Math.min(0xffffffff, target.value + amount);
      return;
    }
    if (this.state.moneyDrops.size >= MAX_MONEY_DROPS) {
      this.awardMoney(amount, ownerId);
      return;
    }
    const drop = new MoneyDropState();
    drop.id = `money${this.moneyDropSeq++}`;
    drop.x = x;
    drop.y = y;
    drop.value = amount;
    drop.seed = (Math.imul(this.moneyDropSeq, 40503) + Math.imul(this.state.tick, 7919)) & 0xffff;
    drop.bornTick = this.state.tick;
    drop.ownerId = ownerId;
    this.state.moneyDrops.set(drop.id, drop);
  },

  stepMoneyDrops(this: GameRoomContext): void {
    const remove: string[] = [];
    this.state.moneyDrops.forEach((drop, id) => {
      if (drop.delivered) {
        if (tickReached(this.state.tick, (drop.collectTick + 1) >>> 0)) remove.push(id);
        return;
      }
      if (drop.collectorId) {
        const collector = this.state.players.get(drop.collectorId);
        if (!collector?.alive) {
          drop.collectorId = "";
          drop.launchTick = 0;
          drop.collectTick = 0;
          return;
        }
        if (tickReached(this.state.tick, drop.collectTick)) {
          this.awardMoney(drop.value, drop.ownerId);
          drop.delivered = true;
        }
        return;
      }
      if (!tickReached(this.state.tick, (drop.bornTick + MONEY_DROP_ARM_TICKS) >>> 0)) return;
      const collector = this.nearestMoneyCollector(drop.x, drop.y, true, drop.ownerId);
      if (!collector) return;
      drop.collectorId = collector.id;
      drop.launchTick = this.state.tick;
      drop.collectTick = (this.state.tick + MONEY_DROP_FLIGHT_TICKS) >>> 0;
    });
    for (const id of remove) this.state.moneyDrops.delete(id);
  },

  drainMoneyDrops(this: GameRoomContext): void {
    let squadUnpaid = 0;
    const ownerUnpaid = new Map<string, number>();
    this.state.moneyDrops.forEach((drop) => {
      if (drop.delivered) return;
      if (drop.ownerId) {
        ownerUnpaid.set(drop.ownerId, (ownerUnpaid.get(drop.ownerId) ?? 0) + drop.value);
      } else {
        squadUnpaid += drop.value;
      }
    });
    this.state.moneyDrops.clear();
    this.awardMoney(squadUnpaid);
    for (const [ownerId, amount] of ownerUnpaid) this.awardMoney(amount, ownerId);
  },
} satisfies ThisType<GameRoomContext>;
