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
  clientServerMotionEpochAdmissible,
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
import { SpatialGrid } from "../SpatialGrid.js";

/** §51 duel-token courtesy distance: a combo tough whose victim is already CLAIMED holds a visible
 *  ring-out orbit here instead of stacking a second unreadable choreography (G12 crossfire law). */
export const COMBO_RINGOUT_ORBIT = 260;
/** §51 the riposte stagger normalised onto tick anchors (the legacy machine's 1s, in 50ms ticks). */
export const COMBO_RIPOSTE_STAGGER_TICKS = 20;
/** Shared immutable no-input sample for rooted stance movement; avoids a fresh object in the 20Hz loop. */
export const ZERO_MOVE_INPUT = { dx: 0, dy: 0 } as const;
export const ZERO_IMPULSE = { vx: 0, vy: 0 } as const;
export const tickReached = (now: number, target: number): boolean => ((now - target) | 0) >= 0;
export const ticksFromSeconds = (seconds: number): number =>
  Math.max(1, Math.round((seconds * 1000) / TICK_MS));
/** Closed census of every legal server-authored player-motion owner.
 * B45 gun/beam recoil is the sole weapon-fire source; melee and caster motion remain prohibited. */
export const SERVER_MOTION_SOURCES = [
  "dodge-roll",
  "distance-jump",
  "slide-hop",
  "parry-slide",
  "parry-launch",
  "enemy-contact-hit",
  "enemy-commit-hit",
  "enemy-commit-launch",
  "hostile-projectile-hit",
  "pit-snapback",
  "elevator-boarding",
  "revive-placement",
  "teleport-placement",
  "ultimate",
  "weapon-fire-recoil",
] as const;
export type ServerMotionSource = (typeof SERVER_MOTION_SOURCES)[number];

export function pointSegmentDistanceSq(
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

export function pointInConvexQuadrilateral(
  px: number,
  py: number,
  vertices: readonly Readonly<{ x: number; y: number }>[],
): boolean {
  let signedArea = 0;
  let hasPositive = false;
  let hasNegative = false;
  for (let index = 0; index < vertices.length; index++) {
    const a = vertices[index];
    const b = vertices[(index + 1) % vertices.length];
    if (!a || !b) continue;
    signedArea += a.x * b.y - b.x * a.y;
    const cross = (b.x - a.x) * (py - a.y) - (b.y - a.y) * (px - a.x);
    hasPositive ||= cross > 1e-9;
    hasNegative ||= cross < -1e-9;
  }
  return Math.abs(signedArea) > 1e-9 && !(hasPositive && hasNegative);
}

/** Squared distance from a point to the complete swept volume of an upright capsule centre. The
 * centre's movement segment plus the fixed vertical stem forms a parallelogram; expanding that hull by
 * the capsule radius produces the exact moving B22 tornado envelope. */
export function pointSweptUprightCapsuleDistanceSq(
  px: number,
  py: number,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  halfLength: number,
): number {
  const stem = Math.max(0, halfLength);
  if (stem <= 1e-9) return pointSegmentDistanceSq(px, py, fromX, fromY, toX, toY);
  const vertices = [
    { x: fromX, y: fromY - stem },
    { x: toX, y: toY - stem },
    { x: toX, y: toY + stem },
    { x: fromX, y: fromY + stem },
  ] as const;
  if (pointInConvexQuadrilateral(px, py, vertices)) return 0;
  let distanceSq = Number.POSITIVE_INFINITY;
  for (let index = 0; index < vertices.length; index++) {
    const a = vertices[index];
    const b = vertices[(index + 1) % vertices.length];
    if (!a || !b) continue;
    distanceSq = Math.min(distanceSq, pointSegmentDistanceSq(px, py, a.x, a.y, b.x, b.y));
  }
  return distanceSq;
}
/** QOL-01: visible stabilisation beat, then an intentional spatial hold after a fresh entry. */
export const EXTRACT_ARM_SECONDS = 0.8;
export const EXTRACT_HOLD_SECONDS = 0.75;
/** QOL-05: the authored 720px ring is a postcondition after clamp/terrain correction, not an input hint. */
export const SPAWN_CANDIDATE_COUNT = 8;
export const SPAWN_MIN_DISTANCE = SPAWN_RING * 0.85;
export const SPAWN_CAMERA_HALF_WIDTH = SPAWN_RING * 0.8;
export const SPAWN_CAMERA_HALF_HEIGHT = SPAWN_RING * 0.5;

/** §45 one tick-wide horde broad phase. 128px keeps ordinary enemy separation in the same/adjacent cells;
 *  the radius ceiling keeps boss/projectile/melee queries conservative for the oversized boss roster. */
export const ENEMY_GRID_CELL_SIZE = 128;
export const MAX_ENEMY_RADIUS = Math.max(
  ENEMY_RADIUS,
  ...Object.values(ENEMY_KINDS).map((kind) => kind.radius),
);
/** Soft horde separation consumes this fraction of each pair's radius overlap per 20Hz tick. */
export const ENEMY_SEPARATION_OVERLAP_FRACTION = 0.45;
/** A dense crowd can contribute many pair forces; cap the accumulated body correction per tick. */
export const ENEMY_SEPARATION_MAX_STEP = 12;

/** §4 v0.107 one sequence-numbered input COMMAND from a client (~one per 50ms client tick). `jump` rides
 *  the command (not a separate message) so its consume tick is part of the acked timeline (review #5). */
export interface InputCmd {
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
  /** B42 post-prediction owner pose for this exact sequence. Absent only for legacy tests/clients. */
  movement?: ClientMovementReport;
}

/** Per-client input pipeline + the player's PERSISTENT steered movement velocity (§7 course correction).
 *  §4 v0.107: commands queue here (bounded), the tick consumes toward ONE per fixed sub-step and falls
 *  back to `held` when starved (preserving the original held-input semantics); `lastSeq` enforces
 *  monotonicity (drops replays/garbage), `msgBudget` rate-caps the message handler per tick. */
export interface InputState {
  queue: InputCmd[];
  held: InputCmd;
  lastSeq: number;
  msgBudget: number;
  traversalEdgeBudget: number;
  lastFreshFireTick: number;
  /** §44 per-tick budget for ACTION messages (attack/parry/grab/cycle/…) — the input budget's sibling,
   *  so a modified client can't monopolize the event loop with non-movement RPCs between ticks. */
  actionBudget: number;
  mvx: number;
  mvy: number;
  /** Set only on a newly consumed command; held fallback must never re-adopt an old pose. */
  freshMovement?: ClientMovementReport;
}

export interface WeaponResourceLedger {
  cooldown: number;
  reload: number;
  charges: number;
}

export type WeaponSpendReason = "tap" | "beam-ignite" | "beam-active" | "beam-cancel" | "aura-active";

export const GROUND_ZONE_ENTITY_CAP = 48;
export const GROUND_ZONE_OWNER_CAP = 4;

export interface ZoneRuntime {
  ttl: number;
  hostile: boolean;
  ownerId: string;
  weaponId: string;
  damagePerSecond: number;
  tickRate: number;
  tickAccumulator: number;
  slowMultiplier: number;
  slowSeconds: number;
  refreshedTick: number;
  crit: number;
}

export interface WeaponSpendResult {
  accepted: boolean;
  debit: number;
  beamEmpty: boolean;
}

export interface PendingScatterVolley {
  t: number;
  originX: number;
  originY: number;
  sweepX: number;
  sweepY: number;
  baseAng: number;
  aimMode: "cone" | "radial-random";
  count: number;
  spread: number;
  speed: number;
  range: number;
  damage: number;
  pierce: number;
  explode?: { radius: number; damage: number };
  crit: number;
  sourcePlayerId: string;
  sourceWeaponId: string;
  sourceMuzzlePart: 0 | 1;
  kind: string;
}

/** B3 accepted fan beat waiting for its melee impact epoch before the real projectile is emitted. */
export interface PendingHybridProjectile {
  t: number;
  playerId: string;
  weaponId: string;
  aimX: number;
  aimY: number;
  damage: number;
  crit: number;
}

/** A committed thrown beat whose authored in-hand draw must finish before projectile release. */
export interface PendingWeaponThrow {
  t: number;
  playerId: string;
  weaponId: string;
  aimX: number;
  aimY: number;
  speed: number;
  range: number;
  damage: number;
  pierce: number;
  kind: string;
  crit: number;
  landingDamagePerSecond?: number;
  ricochet?: { hops: number; range: number };
  projectileWaveform?: ProjectileWaveformDef;
  arcHeight?: number;
  returning?: boolean;
  sourceMuzzlePart?: 0 | 1;
}

export interface ActiveMeleeSwing {
  playerId: string;
  swing: SwingDescriptor;
  aim0: number;
  range: number;
  swingArc: number;
  halfWidth: number;
  rangeMultiplier: number;
  timedWeaponEnvelope: boolean;
  edgeDamage: number;
  toughDamageMultiplier: number;
  weaponId: string;
  crit: number;
  hitStatus?: WeaponDef["hitStatus"];
  elapsed: number;
  hit: Set<string>;
  /** Intra-attack authoritative contacts expressed on the immutable accepted pose clock. */
  rapidImpactSeconds?: readonly number[];
  rapidHitIndex?: number;
  originX?: number;
  originY?: number;
}

/** One server-private Drive authority. The result row is reused so the 20 Hz seam allocates nothing. */
export interface DriveRuntime {
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

export interface RunWeaponLedger {
  runId: string;
  entries: Map<string, ExpeditionEntryV1>;
  byInstanceId: Map<string, string>;
  curator: WeaponBankCuratorInputV1;
}

export interface PickupWeaponBankMeta {
  provenance: WeaponProvenance;
  entry?: WeaponBankEntryV1;
  ownerId: string;
  ownerLockUntil: number;
}

export interface DisconnectedPlayerReservation {
  player: PlayerState;
  combat: CombatState;
}

export type PlayerDamageKind = "pit" | "ground-hazard" | "enemy" | "self";

export interface PetRunRuntime {
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

export interface UltimateTarget {
  id: string;
  slot: number;
  generation: number;
  distanceSq: number;
}

export interface UltimateRuntime {
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
export type WeaponHand = 0 | 1;

export interface CombatState {
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
  /** Ordered gun rounds still owed by the current accepted trigger. */
  gunBurstRemaining: number;
  gunBurstT: number;
  gunBurstWeaponId: string;
  gunBurstHand: WeaponHand;
  /** B31 server-owned hold/release projectile clock. Only the immutable start tick is replicated. */
  chargedProjectileInputWasHeld: boolean;
  chargedProjectileWeaponId: string;
  chargedProjectileStartTick: number;
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
  /** Server copy of the solo accepted-combo chain used by Driftblade-line mechanical hooks. */
  soloComboSeq: number | undefined;
  soloComboAcceptedAtMs: number;
  soloComboId: string;
  soloComboFamily: MeleeComboFamily;
  soloComboStep: number;
  soloComboExpiresAtMs: number;
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
  /** Append-only schema-23 channel, now the fixed accepted roll direction × current curve speed. */
  momentumX: number;
  momentumY: number;
  slidePhase: SlidePhase;
  /** Exact fixed-roll sample age; the append-only wire field retains its schema-23 name. */
  slidePhaseTick: number;
  /** Time cooldown begins when the authored roll sentence ends or is force-cancelled. */
  rollCd: number;
  slideParryLockT: number;
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
  /** B26 successful-guard cycles are independent per catalog subtype and advance on receipts only. */
  parryGuardCycles: Map<string, ParryGuardCycleState>;
  /** Exact accepted parry epoch; boss counters never mistake slide/ultimate i-frames for a white answer. */
  parryOpenedTick: number;
  /** Graveside Manner's bounded event receipt; no per-tick allocation or synced counter. */
  killHealWindowStart: number;
  killHealWindowAmount: number;
  /** Earned provenance (v0.103 anti-exploit): true only while the held weapon traces back to an enemy
   *  drop/account row. Cycled, conjured, and gallery weapons cannot mint money through disassembly. */
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
  /** Server-chosen Prism-Lantern fan. Index zero is the ordinary primary beam row. */
  beamRayOffsets: number[];
  /** Ordered art-space muzzle point index per replicated row. */
  beamMuzzlePointIndices: number[];
  beamPreviousOriginsX: number[];
  beamPreviousOriginsY: number[];
  beamCurrentOriginsX: number[];
  beamCurrentOriginsY: number[];
  beamPreviousLengths: number[];
  beamCurrentLengths: number[];
  beamTeleportSeq: number;
  beamInputWasHeld: boolean;
  beamPulseT: number;
  beamQuantumT: number;
  beamCrit: number;
  beamHitIds: Set<string>;
  beamPendingDamage: Map<string, number>;
  /** Authored garlic-style aura channel. It shares input heartbeat + Drive authority with beams. */
  auraActive: boolean;
  auraInputWasHeld: boolean;
  auraRequireRelease: boolean;
  auraPulseT: number;
  auraCrit: number;
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
export interface DuelistComboState {
  phase: "idle" | "leapwind" | "leap" | "settle" | "windup" | "commit" | "return" | "recover";
  t: number;
  hits: number;
  wind: number;
  // §15 v0.113 LEAP (leaper elites): landing spot, the synced marker id, and the leap cooldown.
  lx?: number;
  ly?: number;
  tg?: string;
  leapCd?: number;
  /** Fixed lunge vector captured at the white pop. Walking never changes this committed target. */
  strike?: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    aimX: number;
    aimY: number;
    targetId: string;
    targetX: number;
    targetY: number;
    range: number;
    authoredEscape: boolean;
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

export type RewardBoundary = "extract" | "descent" | "belt-victory" | "bossrush-victory" | "boss-clear";

export const GAME_ROOM_STATICS = Object.freeze({
  GALLERY_ROSTER: [...ACTIVE_WEAPON_CATALOG_IDS].sort(
    (a, b) => {
      const wa = WEAPONS[a];
      const wb = WEAPONS[b];
      const c = (wa?.tags?.classPool ?? "").localeCompare(wb?.tags?.classPool ?? "");
      if (c !== 0) return c;
      const f = (wa?.tags?.family ?? "").localeCompare(wb?.tags?.family ?? "");
      if (f !== 0) return f;
      return (wa?.name ?? a).localeCompare(wb?.name ?? b);
    },
  ),
  GALLERY_PAGE: 42,
});
export interface GameRoomContext extends Room<ArenaState> {
  maxClients: number;
  readonly enemyGrid: SpatialGrid<string>;
  readonly enemyCandidates: string[];
  readonly oversizedEnemyIds: string[];
  readonly enemySeparationX: Float64Array<ArrayBuffer>;
  readonly enemySeparationY: Float64Array<ArrayBuffer>;
  readonly wormSegmentGrid: SpatialGrid<number>;
  readonly wormSegmentCandidates: number[];
  readonly wormHitSlots: number[];
  wormDamageSourceSeq: number;
  readonly beamSampleX: Float64Array<ArrayBuffer>;
  readonly beamSampleY: Float64Array<ArrayBuffer>;
  readonly beamSampleEndX: Float64Array<ArrayBuffer>;
  readonly beamSampleEndY: Float64Array<ArrayBuffer>;
  readonly beamSampleLength: Float64Array<ArrayBuffer>;
  readonly poiResolveScratch: { x: number; y: number; };
  beamCurrentX: number;
  beamCurrentY: number;
  beamCurrentLength: number;
  readonly beamMuzzleScratch: { x: number; y: number; };
  readonly distanceJumpLaunches: Set<string>;
  readonly inputs: Map<string, InputState>;
  readonly acceptedClientMovement: Map<string, ClientMovementReport>;
  readonly serverMotionUntilTick: Map<string, number>;
  readonly serverMotionSourceByPlayer: Map<string, ServerMotionSource>;
  readonly combat: Map<string, CombatState>;
  readonly metaAccounts: Map<string, MetaAccountV5>;
  readonly weaponRuns: Map<string, RunWeaponLedger>;
  worldTier: number;
  readonly disconnectedPlayers: Map<string, DisconnectedPlayerReservation>;
  readonly weaponSettlementReceipts: Map<string, WeaponSettlementResult>;
  readonly prestigeReceipts: Map<string, unknown>;
  readonly prestigeGameClearReceipts: Set<string>;
  readonly gearRuns: Map<string, GearRunRuntime>;
  readonly petRuns: Map<string, PetRunRuntime>;
  readonly petSettledAccounts: Set<string>;
  petDimensionEpoch: number;
  readonly enemyFireCd: Map<string, number>;
  bossController: BossController | null;
  vastagharEncounter: VastagharEncounterRuntime | null;
  readonly vastagharTargets: VastagharTarget[];
  readonly vastagharDownTicks: Map<string, number>;
  readonly vastagharSweepEpoch: Map<string, number>;
  readonly vastagharKillScratch: string[];
  vastagharVictoryX: number;
  vastagharVictoryY: number;
  vastagharVictoryReadyTick: number;
  vastagharVictoryMode: "" | "arena" | "bossrush";
  vastagharMoneyAwarded: boolean;
  broadcastGeneration: number;
  telegraphSeq: number;
  readonly bossAddIds: Set<string>;
  readonly bossAddExpireTick: Map<string, number>;
  _bossSink: VastagharEmitSink | null;
  readonly projectileMeta: Map<string, { ttl: number; damage: number; hostile: boolean; pierce: number; hit: Set<string>; explode?: { radius: number; damage: number; }; bounces?: number; pierceMax?: number; legTtl?: number; crit?: number; sourcePlayerId?: string; sourceWeaponId?: string; delivery?: number; sourceX?: number; sourceY?: number; firstCollisionX?: number; firstCollisionY?: number; firstStep: boolean; deferredSteps?: number; landingZoneDamage?: number; ricochetHops?: number; ricochetRange?: number; waveform?: { originX: number; originY: number; elapsedSeconds: number; definition: ProjectileWaveformDef; }; returnToOwner?: { outboundSeconds: number; returning: boolean; }; damageEnvelope?: ProjectileDamageEnvelope; }>;
  hostileProjectileCount: number;
  readonly zonerDropCd: Map<string, number>;
  readonly zoneMeta: Map<string, ZoneRuntime>;
  readonly activeGroundZones: Map<string, string>;
  readonly groundZoneInputWasHeld: Map<string, boolean>;
  readonly enemyZoneSlow: Map<string, { multiplier: number; untilTick: number; }>;
  readonly comboState: Map<string, DuelistComboState>;
  readonly meleeAttackTokens: MeleeAttackTokens;
  readonly debugCommitDefense: Map<string, "roll" | "parry">;
  readonly debugAttackMoveCapture: Set<string>;
  readonly debugHeldFire: Set<string>;
  readonly duelTokens: Map<string, string>;
  readonly dodgeState: Map<string, { cd: number; t: number; dx: number; dy: number; }>;
  readonly poundEnemyEffects: Map<string, { vx: number; vy: number; staggerT: number; }>;
  readonly ultimateStunUntil: Map<string, number>;
  readonly ultimateBrands: Map<string, { remaining: number; multiplier: number; }>;
  readonly ultimateDecoys: Map<string, { x: number; y: number; hp: number; detonateTick: number; returnEndTick: number; detonated: boolean; damage: number; }>;
  readonly ultimateFissures: {
    x: number;
    y: number;
    ownerId: string;
    damage: number;
    nextTick: number;
    endTick: number;
  }[];
  readonly ultimateKills: string[];
  readonly ultimateTargetCandidates: UltimateTarget[];
  readonly meleeSwings: Map<string, ActiveMeleeSwing>;
  readonly pendingQuakes: {
    t: number;
    x: number;
    y: number;
    radius: number;
    damage: number;
    crit: number;
    sourcePlayerId: string;
    sourceWeaponId: string;
    zoneDamagePerSecond?: number;
  }[];
  readonly pendingScatterVolleys: PendingScatterVolley[];
  readonly pendingHybridProjectiles: PendingHybridProjectile[];
  readonly minimumAttackInputSlowUntilTick: Map<string, number>;
  readonly pendingWeaponThrows: PendingWeaponThrow[];
  readonly pickupGrace: Map<string, number>;
  readonly earnedPickups: Set<string>;
  readonly pickupWeaponBankMeta: Map<string, PickupWeaponBankMeta>;
  readonly floorDisassemblyIntents: Map<string, { pickupId: string; readyTick: number; }>;
  readonly brandedTimers: Map<string, number>;
  readonly burnPulses: {
    x: number;
    y: number;
    aimX: number;
    aimY: number;
    dmg: number;
    at: number;
    sourcePlayerId: string;
    sourceWeaponId: string;
  }[];
  spawnAccum: number;
  spawnCandidateX: number;
  spawnCandidateY: number;
  enemySeq: number;
  projectileSeq: number;
  zoneSeq: number;
  pickupSeq: number;
  moneyDropSeq: number;
  chestRoomSeed: number;
  chestRunStartTick: number;
  chestCadence: ChestCadenceState;
  combatReceiptSeq: number;
  combatReceiptCursor: number;
  map: ArenaMap;
  bossSpawned: boolean;
  bossRushIndex: number;
  bossRushNextTimer: number;
  extractArmTimer: number;
  extractHoldTimer: number;
  readonly extractBlocked: Set<string>;
  readonly visitedDims: Set<string>;
  homeDimension: string;
  belt: boolean;
  beltLevel: BeltLevel | null;
  beltRoomIdx: number;
  beltPhase: "enter" | "fight" | "cleared";
  corporateHomeDepth: number;
  bossId: string | null;
  bossPetAwardEligible: boolean;
  shifterCd: number;
  shifterId: string | null;
  shifterTimer: number;
  shifterWaves: number;
  hostId: string | null;
  isHost(client: Client): boolean;
  devToolsEnabled(): boolean;
  takeAction(client: Client): boolean;
  installCorporateFloor(depth: number, elevatorPhase: number): void;
  isCorporateLoop(): boolean;
  onCreate(options?: {
    dimensionId?: string;
    bossRush?: boolean;
    belt?: boolean;
    beltLevel?: string;
  }): void;
  clearTransients(): void;
  clearCombatEntities(): void;
  enterTerminalOutcome(outcome: "defeat" | "victory"): void;
  dropHeldWeapon(player: PlayerState, c: CombatState | undefined): void;
  weaponEntryDisassemblyValue(entry: WeaponBankEntryV1): number;
  canDisassembleFloorPickup(player: PlayerState, pickup: PickupState): boolean;
  clearFloorPickup(pickupId: string): void;
  disassembleFloorPickup(player: PlayerState, pickup: PickupState): void;
  disassembleBagPickup(player: PlayerState, index: number): void;
  initializeStoredWeaponResource(player: PlayerState, slot: ArsenalSlot): void;
  copySlot(dst: ArsenalSlot, src: ArsenalSlot | null): void;
  mintWeaponOpaqueId(prefix: "wi"): string;
  mintWeaponInstance(weaponId: string, rarity: number, affix: string, provenance: WeaponProvenance): WeaponInstanceV1;
  installWeaponMember(slot: ArsenalSlot, entry: WeaponBankEntryV1, member: WeaponInstanceV1): void;
  installHomeIssue(slot: ArsenalSlot): void;
  materializeWeaponRun(player: PlayerState, account: MetaAccountV5): void;
  createWeaponRun(playerId: string, account: MetaAccountV5): RunWeaponLedger | undefined;
  syncWeaponRunFromArsenal(player: PlayerState): void;
  registerFoundWeaponEntry(player: PlayerState, entry: WeaponBankEntryV1): void;
  consumeRunWeaponEntry(player: PlayerState, entryId: string): void;
  sendWeaponManifest(player: PlayerState): void;
  bagCapacity(player: PlayerState): number;
  resetChestDirector(): void;
  stepChestDirector(): void;
  refreshChestOpened(chest: ChestState): void;
  refreshAllChestOpened(): void;
  chestWeaponBagSlot(player: PlayerState): ArsenalSlot | undefined;
  grantChestWeapon(player: PlayerState, weaponId: string): boolean;
  dropChestWeapon(player: PlayerState, chest: ChestState, weaponId: string): boolean;
  maybeDropEnemyWeapon(enemy: EnemyState, kind: EnemyKind): void;
  grantCommonRelic(player: PlayerState, id: CommonRelicId): number;
  grantRareRelic(player: PlayerState, id: RareRelicId): number;
  openChestForPlayer(playerId: string, chestId: string): void;
  saveWeaponResource(player: PlayerState, c: CombatState): void;
  restoreWeaponResource(player: PlayerState, c: CombatState, genuinelyNewPickup?: boolean, applyDrawLock?: boolean): void;
  transitionWeapon(player: PlayerState, c: CombatState, genuinelyNewPickup?: boolean, applyDrawLock?: boolean): void;
  stepHeldBreakActionReload(player: PlayerState, c: CombatState, weapon: WeaponDef | undefined, dt: number): void;
  stepStowedWeaponResources(player: PlayerState, c: CombatState, dt: number): void;
  stepStoredSlot(player: PlayerState, slot: ArsenalSlot, dt: number): void;
  syncActiveSlot(player: PlayerState, c: CombatState | undefined): void;
  loadSlot(player: PlayerState, c: CombatState | undefined, i: number): void;
  grabIntoArsenal(player: PlayerState, c: CombatState | undefined, grabbed: PickupState, bankEntry?: WeaponBankEntryV1): boolean;
  heldDamageMult(weapon: WeaponDef, player: PlayerState, _hand?: WeaponHand): number;
  weaponRecoveryMult(player: PlayerState, weapon: WeaponDef): number;
  heldCastDamageMult(weapon: WeaponDef, player: PlayerState, hand?: WeaponHand): number;
  snapshotRunCharacter(player: PlayerState, combat: CombatState | undefined, _rebase: boolean, topUpMaxHp?: boolean): void;
  snapshotGearRun(player: PlayerState, combat: CombatState | undefined, runtime: GearRunRuntime, topUpMaxHp?: boolean): void;
  snapshotRunIdentity(player: PlayerState, combat: CombatState | undefined, rebase: boolean, topUpMaxHp?: boolean): void;
  applyQuirkEffects(player: PlayerState, combat: CombatState, effects: readonly QuirkEffect[]): void;
  applyParryQuirk(player: PlayerState, combat: CombatState, parryHeal: number): void;
  applyKillQuirk(player: PlayerState, combat: CombatState, enemy: EnemyState): void;
  loadoutIds(player: PlayerState): string[];
  livingCount(): number;
  ownerClient(playerId: string): Client | undefined;
  sendOwnerMessage(playerId: string, type: string, payload: unknown): void;
  publishPetPickupEligibility(): void;
  bumpAccountRevision(account: MetaAccountV5): void;
  snapshotPetRun(player: PlayerState, selectedPetId: PetId | ""): void;
  resetPetAccrual(playerId: string): void;
  advancePetPresence(dt: number): void;
  recordPetAcceptedAction(playerId: string): void;
  awardPetDimensionClear(): void;
  beginNextPetDimension(): void;
  rollSlateTortoise(account: MetaAccountV5, outcome: "defeat" | "victory"): boolean;
  settleMetaAccounts(outcome: "defeat" | "victory"): void;
  applyHeal(target: PlayerState, rawAmount: number, applyReceivedMultiplier?: boolean): number;
  toggleTraining(abandoningPlayerId?: string): void;
  forfeitWeaponRunForWorkshop(playerId: string): void;
  galleryPage: number;
  spawnGalleryPage(): void;
  restartRun(): void;
  clearEnemiesNear(x: number, y: number, radius: number): void;
  rebuildEnemyGrid(): void;
  insertEnemyGrid(id: string, enemy: EnemyState): void;
  updateEnemyGrid(id: string, enemy: EnemyState): void;
  rebuildWormSegmentGrid(): void;
  effectiveEnemyBodies(): number;
  resolveEnemyCollisions(): void;
  onJoin(client: Client, options?: {
      scrip?: number;
      up?: unknown;
      metaAccount?: unknown;
      carry?: CarrySelectionV1;
      selectedCharacterId?: unknown;
      selectedPetId?: unknown;
      petId?: unknown;
    }): void;
  onLeave(client: Client): void;
  setWeaponResourceRegenOverride(playerId: string, mode: "auto" | "paused" | "forceEngaged"): void;
  drivePendingValue(player: PlayerState, c: CombatState): number;
  markWeaponResourcePressure(c: CombatState): void;
  hostileWithinDriveThreat(player: PlayerState): boolean;
  beamEmptyRecoveryTicks(c: CombatState): number;
  beginWeaponResourceTick(player: PlayerState, c: CombatState, dt: number): void;
  commitWeaponResourceTick(player: PlayerState, c: CombatState): void;
  creditWeaponResource(player: PlayerState, c: CombatState, amount: number): number;
  trySpendWeaponResource(player: PlayerState, c: CombatState, weapon: WeaponDef, _weaponInstanceId: string, _delivery: number, _hand: WeaponHand, effectiveInterval: number, costMultiplier: number, continuousDt: number, reason: WeaponSpendReason): WeaponSpendResult;
  slideInvulnerable(c: CombatState): boolean;
  noteSlideDodge(player: PlayerState): void;
  damagePlayer(player: PlayerState, amount: number, kind?: PlayerDamageKind): void;
  consumeDebugCommitDefense(player: PlayerState, attacker: EnemyState): void;
  consumeMoveStanceInput(player: PlayerState, input: InputState, c: CombatState, cmd: InputCmd): void;
  setMoveStance(player: PlayerState, c: CombatState, stance: MoveStance): void;
  syncSlideWire(player: PlayerState, c: CombatState): void;
  cancelMoveStance(player: PlayerState, c: CombatState, forced: boolean): void;
  clientMovementNavValid(player: PlayerState, combat: CombatState | undefined, fromX: number, fromY: number, toX: number, toY: number): boolean;
  beginServerMotion(player: PlayerState, ticks: number, source: ServerMotionSource): void;
  placeWithMotionEpoch(
    player: PlayerState,
    source: ServerMotionSource,
    place: () => void,
    ticks?: number,
  ): void;
  refreshServerMotionState(player: PlayerState, id: string, dt: number): void;
  freshInputState(): InputState;
  stepSlideStance(player: PlayerState, c: CombatState): void;
  damagePitFall(player: PlayerState): void;
  stepTraversalLaunches(dt: number): void;
  launchDistanceJump(player: PlayerState, c: CombatState, input: InputState): void;
  steerDistanceJump(c: CombatState, input: InputCmd, dt: number): void;
  finishPlayerLanding(player: PlayerState, c: CombatState, landingStance: MoveStance, impactVh: number): void;
  applyPoundImpact(player: PlayerState, c: CombatState): void;
  enemyCommittedAttack(id: string): boolean;
  stepPoundEnemyEffects(dt: number): void;
  writeCombatReceipt(targetId: string, targetX: number, targetY: number, sourcePlayerId: string, sourceWeaponId: string, delivery: number, sourceX: number, sourceY: number, damage: number, crit: boolean, finalBlow: boolean): void;
  advanceElapsed(dt: number): void;
  resetElapsed(): void;
  onUncaughtException(error: Error, methodName: string): void;
  simAccMs: number;
  update(deltaMs: number): void;
  stepSim(dt: number): void;
  ultimateOwnsMovement(player: PlayerState): boolean;
  nearestDoorDecoy(pos: Vec2): Vec2 | undefined;
  navValidDest(player: PlayerState, c: CombatState, targetX: number, targetY: number, maxRange: number): { x: number; y: number };
  ultimateTargetPosition(target: UltimateTarget): { x: number; y: number; radius: number } | null;
  selectAlphaTargets(player: PlayerState, maxTargets: number): UltimateTarget[];
  acceptUltimate(player: PlayerState, c: CombatState): boolean;
  tryDimensionDoorReturn(player: PlayerState, c: CombatState): boolean;
  beginUltimate(player: PlayerState, c: CombatState, ult: UltimateRuntime): void;
  ultimateScale(_player: PlayerState, _ult: UltimateRuntime): number;
  critAdditiveModifiers(player: PlayerState, _combat: CombatState | undefined): readonly number[];
  flatCritChance(player: PlayerState, combat?: CombatState): number;
  weaponCritChance(player: PlayerState, c: CombatState): number;
  launchSunspiteComet(player: PlayerState, c: CombatState, ult: UltimateRuntime): void;
  stepSeismarch(player: PlayerState, c: CombatState, ult: UltimateRuntime): void;
  resolveSeismarchImpact(player: PlayerState, c: CombatState, ult: UltimateRuntime): void;
  applyUltimateStun(enemy: EnemyState, id: string, seconds: number): boolean;
  stepEventHorizon(player: PlayerState, c: CombatState, ult: UltimateRuntime): void;
  damageEventHorizonSweep(player: PlayerState, ult: UltimateRuntime, fromX: number, fromY: number, toX: number, toY: number): void;
  stepAlphaStrike(player: PlayerState, c: CombatState, ult: UltimateRuntime): void;
  cancelUltimate(player: PlayerState, c: CombatState): void;
  stepUltimateWorldEffects(dt: number): void;
  stepUltimates(dt: number): void;
  stampAttackBeat(player: PlayerState): void;
  nextSoloMeleeBeat(player: PlayerState, c: CombatState, weapon: WeaponDef, expectedInterval: number): {
    step: number;
    length: number;
    family: MeleeComboFamily;
    continued: boolean;
    gapRatio: number;
  };
  recordSoloMeleeBeat(player: PlayerState, c: CombatState, weapon: WeaponDef, family: MeleeComboFamily, step: number, interval: number): void;
  resolveSingleWeaponAttack(player: PlayerState, c: CombatState): boolean;
  resolveSwing(player: PlayerState, c: CombatState, weapon: WeaponDef, swing: SwingDescriptor, hand?: WeaponHand, katanaEffect?: KatanaBeatEffect, comboStep?: Readonly<MeleeComboStep>, hybridBeat?: Readonly<{ step: number; length: number }>): void;
  tryRez(rezzer: PlayerState, radius: number): void;
  beamHeld(id: string): boolean;
  stepPlayerChargedProjectile(player: PlayerState, id: string, c: CombatState, weapon: WeaponDef, acting: boolean): void;
  fireChargedProjectile(player: PlayerState, c: CombatState, weapon: WeaponDef, fraction: number): void;
  stepPlayerAura(player: PlayerState, id: string, c: CombatState, weapon: WeaponDef, dt: number, acting: boolean): void;
  navValidMotionDest(player: PlayerState, combat: CombatState, targetX: number, targetY: number, maxRange: number): Vec2;
  playerAttackMoveMode(playerId: string, dt: number): number;
  zoneTarget(player: PlayerState, c: CombatState, placementRange: number): Vec2;
  stepPlayerGroundZone(player: PlayerState, id: string, c: CombatState, weapon: WeaponDef, dt: number, acting: boolean): void;
  clearBeamRows(ownerId: string, satellitesOnly?: boolean): void;
  beamSatelliteCount(): number;
  stepPlayerBeam(player: PlayerState, id: string, c: CombatState, weapon: WeaponDef, dt: number, acting: boolean): void;
  stepActiveBeam(player: PlayerState, id: string, c: CombatState, descriptor: BeamDescriptor, dt: number): void;
  finishBeam(player: PlayerState, id: string, c: CombatState, overheated: boolean): void;
  cancelBeam(player: PlayerState, id: string, c: CombatState, addCancelCost: boolean, removeRow: boolean): void;
  syncRestingBeamRow(player: PlayerState, id: string, c: CombatState, weapon: WeaponDef): void;
  syncBeamRow(player: PlayerState, id: string, c: CombatState, descriptor: BeamDescriptor, phase: number, length: number, intensity: number, rayIndex?: number): BeamState;
  writeBeamMuzzle(player: PlayerState, weaponId: string, angle: number, pointIndex?: number): { x: number; y: number };
  clipBeamLength(ox: number, oy: number, angle: number, authoredRange: number, halfWidth: number): number;
  rayCircleLength(ox: number, oy: number, dx: number, dy: number, cx: number, cy: number, radius: number, current: number): number;
  damageBeamSweep(player: PlayerState, c: CombatState, descriptor: BeamDescriptor, dt: number): number;
  flushBeamDamage(c: CombatState, allowCrit: boolean, sourceId?: string): void;
  applyRapidThrustHit(player: PlayerState, sw: ActiveMeleeSwing, impactElapsed: number, rapidHitIndex: number, kills: string[]): void;
  stepMeleeSwings(dt: number): void;
  beginVastagharClear(x: number, y: number): void;
  stepVastagharVictory(): void;
  completeVastagharVictoryPresentation(): void;
  completeVastagharClear(): void;
  awardMoney(amount: number, ownerId?: string): void;
  moneyDropReach(player: PlayerState): number;
  nearestMoneyCollector(x: number, y: number, requireReach: boolean, ownerId?: string): PlayerState | null;
  dropMoney(x: number, y: number, value: number, ownerId?: string): void;
  stepMoneyDrops(): void;
  drainMoneyDrops(): void;
  completeRewardBoundary(kind: RewardBoundary): void;
  completeExtraction(): void;
  completeBossRushVictory(): void;
  stepBoss(dt: number, bodies: Vec2[]): void;
  clearBoss(): void;
  readonly bossSink: VastagharEmitSink;
  addTelegraphRow(shape: number, x: number, y: number, a: number, danger: number, kindTag: number): string;
  setTelegraphRowProgress(id: string, prog: number): void;
  removeTelegraphRow(id: string): void;
  applyBossAoE(x: number, y: number, radius: number, damage: number, knockback: number): void;
  applyBossQuake(x: number, y: number, radius: number, damage: number, knockback: number): void;
  applyVastagharQuake(x: number, y: number, radius: number, damage: number, knockback: number, _epoch: number, out: BossCounterSummary): void;
  applyVastagharSweep(x: number, y: number, innerRange: number, outerRange: number, halfWidth: number, fromAngle: number, toAngle: number, damage: number, knockback: number, actionSeq: number, revolution: number, airborneAnswers: boolean, out: BossCounterSummary): void;
  vastagharParryActive(player: PlayerState, combat: CombatState): boolean;
  resolveVastagharParry(player: PlayerState, combat: CombatState, sourceX: number, sourceY: number, preventedDamage: number): void;
  mutateVastagharArena(_kind: VastagharArenaMutationKind, poiIndex: number): void;
  damageBeamRect(x: number, y: number, len: number, halfW: number, rot: number, damage: number, knockback: number): void;
  damageRingBand(cx: number, cy: number, bandR: number, bandHalf: number, gapCenter: number, gapHalf: number, damage: number): void;
  spawnWeaponGroundZoneAt(player: PlayerState, weapon: WeaponDef, x: number, y: number, damagePerSecond: number, crit?: number): ZoneState | undefined;
  dropBossZone(x: number, y: number, radius: number, ttl: number): void;
  spawnBossAddAt(kindId: string, x: number, y: number): void;
  stepVastagharAddBudget(): void;
  stepSpitters(dt: number, bodies: Vec2[]): void;
  fireProjectile(from: Vec2, to: Vec2, speed: number, damage: number, hostile?: boolean, kind?: string, pierce?: number, ttl?: number, explode?: { radius: number; damage: number }, bounces?: number, crit?: number, sourcePlayerId?: string, sourceWeaponId?: string, delivery?: number, firstCollisionFrom?: Vec2, landingZoneDamage?: number, targetRicochet?: { hops: number; range: number }, projectileWaveform?: ProjectileWaveformDef, arcHeight?: number, returnAfterSeconds?: number, damageEnvelope?: ProjectileDamageEnvelope, visualScale?: number, sourceMuzzlePart?: number, sourceBurstIndex?: number, visualVariant?: number): void;
  removeProjectile(id: string): void;
  aimDir(player: PlayerState, c: CombatState): { x: number; y: number };
  armGunBurst(c: CombatState, weapon: WeaponDef, hand: WeaponHand): void;
  clearGunBurst(c: CombatState): void;
  stepGunBurst(player: PlayerState, c: CombatState, weapon: WeaponDef | undefined, acting: boolean): void;
  detonateWarpAtCursor(player: PlayerState, c: CombatState, weapon: WeaponDef): void;
  fireGun(player: PlayerState, c: CombatState, weapon: WeaponDef, hand?: WeaponHand, recoilElapsedMs?: number, burstIndex?: number): void;
  applyWeaponFireRecoil(player: PlayerState, aimX: number, aimY: number, impulse: number): void;
  applyProjectileChain(seed: EnemyState, seedId: string, meta: {
      hit: Set<string>;
      sourcePlayerId?: string;
      sourceWeaponId?: string;
      crit?: number;
    }, kills: string[]): void;
  fireCast(player: PlayerState, c: CombatState, weapon: WeaponDef, hand?: WeaponHand): void;
  throwWeapon(player: PlayerState, c: CombatState, weapon: WeaponDef, hand?: WeaponHand): void;
  emitWeaponThrow(pending: PendingWeaponThrow, originX: number, originY: number): void;
  redirectThrownRicochet(pr: ProjectileState, meta: {
      ttl: number;
      hit: Set<string>;
      pierce: number;
      pierceMax?: number;
      ricochetHops?: number;
      ricochetRange?: number;
    }): boolean;
  fireScatter(player: PlayerState, c: CombatState, weapon: WeaponDef, hand?: WeaponHand, delaySeconds?: number, swing?: SwingDescriptor): void;
  emitScatterVolley(volley: PendingScatterVolley): void;
  emitHybridProjectile(pending: PendingHybridProjectile): void;
  damageWormSlots(slots: readonly number[], raw: number, sourceKey: string, kills: string[], crit?: number, piercing?: boolean, sourcePlayerId?: string, sourceWeaponId?: string, delivery?: number, sourceX?: number, sourceY?: number): void;
  collectWormRadiusHits(x: number, y: number, radius: number): readonly number[];
  damageEnemy(enemy: EnemyState, eid: string, raw: number, kills: string[], crit?: number, sourcePlayerId?: string, sourceWeaponId?: string, delivery?: number, sourceX?: number, sourceY?: number): void;
  zeroMoveVel(id: string, bumpTeleport: boolean | undefined, source: ServerMotionSource): void;
  placePickupPos(x: number, y: number): { x: number; y: number };
  detonate(x: number, y: number, radius: number, damage: number, crit?: number, sourcePlayerId?: string, sourceWeaponId?: string, delivery?: number): void;
  emberguardWave(x: number, y: number, aimX: number, aimY: number, dmg: number, crit?: number, sourcePlayerId?: string, sourceWeaponId?: string): void;
  executeParry(player: PlayerState, c: CombatState): void;
  applyParryAugments(player: PlayerState, c: CombatState): void;
  enemyGroundZoneSlow(enemyId: string): number;
  applyEnemySlow(enemyId: string, multiplier: number, seconds: number): void;
  applyEnemyHitStatus(enemyId: string, status: WeaponDef["hitStatus"]): void;
  stepDuelists(dt: number, _bodies: Vec2[]): void;
  postureMeleeEnemy(enemy: EnemyState, id: string, target: PlayerState, speed: number, approach: number, dt: number): void;
  planDuelistStrike(enemy: EnemyState, target: PlayerState, m: { range: number; step: number }, targetId: string): NonNullable<DuelistComboState["strike"]>;
  navValidEnemyLungeDest(enemy: EnemyState, targetX: number, targetY: number): Vec2;
  captureAuthoredMeleeEscape(strike: NonNullable<DuelistComboState["strike"]>, target: PlayerState, combat: CombatState | undefined): void;
  enterOrdinaryMeleeRecover(enemy: EnemyState, id: string, st: DuelistComboState, seconds: number): void;
  duelistSwing(enemy: EnemyState, enemyId: string, target: PlayerState | undefined, m: { damage: number }, committed: NonNullable<DuelistComboState["strike"]>): void;
  stepComboEnemy(enemy: EnemyState, id: string, kind: EnemyKind, m: NonNullable<EnemyKind["melee"]>, st: DuelistComboState, dt: number): void;
  commitCombo(enemy: EnemyState, id: string, kind: EnemyKind, st: DuelistComboState, prey: PlayerState, withLeap: boolean): void;
  negotiateComboLanding(enemy: EnemyState, targetX: number, targetY: number, kind: EnemyKind, def: ToughComboDef, facingX: number, facingY: number): { x: number; y: number; awkward: boolean };
  comboLandingCandidate(enemy: EnemyState, targetX: number, targetY: number, kind: EnemyKind, offset: number, facingX: number, facingY: number, angle: number): { x: number; y: number; navShift: number };
  beginComboStep(st: DuelistComboState, def: ToughComboDef, index: number): void;
  enterComboRecover(enemy: EnemyState, id: string, st: DuelistComboState, ticks: number): void;
  airkeepValid(st: DuelistComboState, step: ToughComboStep, live: PlayerState | undefined): boolean;
  planComboStrike(enemy: EnemyState, target: PlayerState, range: number, travelCap: number, leadSeconds: number): NonNullable<DuelistComboState["strike"]>;
  moveComboEnemyToward(enemy: EnemyState, target: Vec2, speed: number, dt: number): void;
  scheduleComboKnockback(enemy: EnemyState, st: DuelistComboState, dirX: number, dirY: number, distance: number): number;
  stepComboKnockback(enemy: EnemyState, st: DuelistComboState, tick: number): boolean;
  comboSwing(enemy: EnemyState, enemyId: string, st: DuelistComboState, step: ToughComboStep | undefined, geo: { range: number; halfArc: number; damageMult: number; knockbackMult?: number }, strike: NonNullable<DuelistComboState["strike"]>): void;
  nearestLivingPlayer(pos: Vec2): PlayerState | undefined;
  bumpComboSeq(enemy: EnemyState): void;
  applyDirectionalParryReaction(player: PlayerState, pc: CombatState, incomingX: number, incomingY: number, preventedDamage: number): void;
  applyLegacyParryLift(player: PlayerState, pc: CombatState, incomingX: number, incomingY: number): void;
  applySideParrySlide(player: PlayerState, pc: CombatState, incomingX: number, incomingY: number, preventedDamage: number): void;
  resolveParry(player: PlayerState, pc: CombatState, attacker: EnemyState, attackerId: string, preventedDamage: number): void;
  applyBossMelee(x: number, y: number, aimX: number, aimY: number, range: number, halfArc: number, damage: number, knockback: number): void;
  stepProjectiles(dt: number): void;
  reflectProjectile(pr: ProjectileState, meta: {
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
    }, player: PlayerState, pc: CombatState): void;
  stepZoners(dt: number): void;
  stepZones(dt: number): void;
  positionCorporateParty(atExit: boolean, bumpTeleport?: boolean): void;
  transitionCorporateFloor(): void;
  stepCorporateElevator(): void;
  stepBeltRooms(_dt: number, bodies: Vec2[]): void;
  beltTrashAlive(): number;
  spawnBeltWave(n: number, x0: number, x1: number, depth?: number): void;
  runSpawnDirector(dt: number, anchors: Vec2[]): void;
  buildVastagharTargets(): void;
  syncUltimateCharge(player: PlayerState, c: CombatState): void;
  accrueUltimateCharge(sourcePlayerId: string, applied: number, finalBlow: boolean, enemyKind: string, delivery: number): void;
  addUltimateFlatCharge(player: PlayerState, c: CombatState, amount: number): void;
  findFairEnemySpawn(anchor: Vec2, radius: number, baseAngle: number): boolean;
  spawnEnemy(anchors: Vec2[]): boolean;
  debugSpawnOne(kindId: string, tough: boolean, anchor: PlayerState, angleOverride?: number, distanceOverride?: number, attackReady?: boolean): void;
  spawnBossRushBoss(): void;
  advanceBossRush(): void;
  retireStageForVastaghar(): void;
  spawnBoss(overrideKind?: string, petAwardEligible?: boolean): void;
  resetShifters(keepWaves?: boolean): void;
  stepShifters(dt: number, bodies: Vec2[]): void;
  spawnShifter(bodies: Vec2[]): boolean;
  mintMap(): void;
  openPortal(x: number, y: number): void;
  resetExtractionIntent(): void;
  transitionDimension(): void;
  checkExtraction(bodies: Vec2[], dt?: number): void;
  checkDescend(dt: number, bodies: Vec2[]): void;
}
const GameRoom = GAME_ROOM_STATICS;

export const roomProgressionMethods = {
  isHost(this: GameRoomContext, client: Client): boolean {
    return this.hostId === null || client.sessionId === this.hostId;
  },

  /** §44 dev-tool gate (Sol audit P0 #1): the debug RPCs (training toggle, boss picker, dev summon, dev
   *  equip, B-key boss) are playtest affordances that must be UNREACHABLE on a public deploy — "host" is
   *  just the first joiner, so one hostile client could otherwise flood the shared Node process with
   *  entities. ON outside production (local dev, vitest) or when DD_DEV_TOOLS=1 (a staged playtest build).
   *  Read per-call (not cached) so tests can flip the environment. */
  devToolsEnabled(this: GameRoomContext): boolean {
    return process.env.DD_DEV_TOOLS === "1" || process.env.NODE_ENV !== "production";
  },

  /** §44 spend one ACTION-message token for this client (attack/parry/grab/cycle/… — every gameplay RPC
   *  except "input", which has its own budget). Refilled each tick; when dry the message is IGNORED, so a
   *  modified client can't monopolize the event loop between ticks. Returns false when over budget. */
  takeAction(this: GameRoomContext, client: Client): boolean {
    const rec = this.inputs.get(client.sessionId);
    if (!rec) return false;
    if (rec.actionBudget <= 0) return false;
    rec.actionBudget--;
    return true;
  },

  installCorporateFloor(this: GameRoomContext, depth: number, elevatorPhase: number): void {
    const floorDepth = Math.max(1, Math.floor(Number.isFinite(depth) ? depth : 1));
    const variant = corporateGridVariantForDepth(floorDepth);
    this.beltLevel = corporateGridBeltLevelForDepth(floorDepth, variant);
    this.state.corporateFloorDepth = floorDepth >>> 0;
    this.state.depth = Math.min(255, floorDepth);
    this.state.corporateFloorId = this.beltLevel.corporateGridFloorId ?? "";
    this.state.corporateVariant = corporateGridVariantCode(variant);
    this.state.elevatorPhase = elevatorPhase;
    this.state.elevatorDeadlineTick = 0;
    this.state.beltLockX = 0;
    this.state.beltRoomName = "";
    this.beltRoomIdx = 0;
    this.beltPhase = "enter";
  },

  isCorporateLoop(this: GameRoomContext): boolean {
    return this.belt && this.state.corporateFloorId !== "" && !!this.beltLevel;
  },

  onCreate(this: GameRoomContext, options?: {
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
    if (this.beltLevel?.corporateGridFloorId) {
      this.corporateHomeDepth = (this.beltLevel.corporateDepth ?? 0) + 1;
      this.installCorporateFloor(this.corporateHomeDepth, CORPORATE_ELEVATOR_PHASE.sealed);
    }

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
      (
        client,
        message: {
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
          clientX?: number;
          clientY?: number;
          clientMvx?: number;
          clientMvy?: number;
          clientVx?: number;
          clientVy?: number;
          clientServerMotionEpoch?: number;
          clientCorrectionSeq?: number;
        },
      ) => {
        const rec = this.inputs.get(client.sessionId);
        if (!rec) return;
        const traversalEdge =
          message?.jump === true || message?.pound === true || message?.slide === true;
        if (rec.msgBudget > 0) rec.msgBudget--;
        else {
          // The real client may send three capped catch-up heartbeats before a physical traversal edge in
          // one loaded render frame. Preserve one such edge without opening the flood gate: the ordinary
          // budget, this single reserved slot, monotonic seq validation, and the queue cap all still apply.
          if (!traversalEdge || rec.traversalEdgeBudget <= 0) return;
          rec.traversalEdgeBudget--;
        }
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
        const carriesMovement =
          message?.clientX !== undefined ||
          message?.clientY !== undefined ||
          message?.clientMvx !== undefined ||
          message?.clientMvy !== undefined ||
          message?.clientVx !== undefined ||
          message?.clientVy !== undefined;
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
          movement: carriesMovement
            ? {
                // Preserve invalid/missing components as NaN. The shared envelope rejects the complete
                // report atomically; coercing one component to zero could accidentally legalize it.
                x: Number(message?.clientX),
                y: Number(message?.clientY),
                mvx: Number(message?.clientMvx),
                mvy: Number(message?.clientMvy),
                vx: Number(message?.clientVx),
                vy: Number(message?.clientVy),
                serverMotionEpoch: Number.isFinite(message?.clientServerMotionEpoch)
                  ? (message.clientServerMotionEpoch as number) >>> 0
                  : 0xffffffff,
                movementCorrectionSeq: Number.isFinite(message?.clientCorrectionSeq)
                  ? (message.clientCorrectionSeq as number) >>> 0
                  : 0xffffffff,
              }
            : undefined,
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
        if (
          held &&
          (WEAPONS[held.weapon]?.beam ||
            WEAPONS[held.weapon]?.chargedProjectile ||
            WEAPONS[held.weapon]?.groundZone?.trigger === "channel" ||
            WEAPONS[held.weapon]?.performance?.aura)
        )
          return;
        if (!this.takeAction(client)) return; // §44 action budget
        const c = this.combat.get(client.sessionId);
        const player = this.state.players.get(client.sessionId);
        if (!c) return;
        if (player && c.stance === STANCE_SLIDE) {
          if (c.slidePhaseTick * (TICK_MS / 1000) + 1e-9 < ROLL_ATTACK_CANCEL_SECONDS) return;
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

    // F = one ordinary, budgeted buffered ultimate action. The client supplies intent only; aim is
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
    // CONJURED, not earned, and therefore cannot be disassembled (see `heldEarned`).
    this.onMessage("cycleWeapon", (client, message: { dir?: number }) => {
      if (!this.takeAction(client)) return; // §44 action budget
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      const c = this.combat.get(client.sessionId);
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
      if (
        typeof message?.weapon === "string" &&
        WEAPONS[message.weapon] &&
        WEAPONS[message.weapon]?.archived !== true
      ) {
        const c = this.combat.get(client.sessionId);
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
    // weapon back into its slot first, so the other two stored weapons are remembered exactly.
    this.onMessage("swapSlot", (client, message: { slot?: number }) => {
      if (!this.takeAction(client)) return; // §44 action budget
      const player = this.state.players.get(client.sessionId);
      if (!player?.alive) return;
      const i = Math.floor(message?.slot ?? -1);
      if (i < 0 || i >= ARSENAL_SLOTS || i === player.activeSlot) return;
      const c = this.combat.get(client.sessionId);
      this.syncActiveSlot(player, c);
      this.loadSlot(player, c, i);
    });

    // §29 ARSENAL cycle: Q advances through NON-EMPTY slots. The wire direction stays bidirectional.
    this.onMessage("cycleSlot", (client, message: { dir?: number }) => {
      if (!this.takeAction(client)) return; // §44 action budget
      const player = this.state.players.get(client.sessionId);
      if (!player?.alive) return;
      const c = this.combat.get(client.sessionId);
      this.syncActiveSlot(player, c);
      const dir = (message?.dir ?? 1) < 0 ? -1 : 1;
      for (let step = 1; step < ARSENAL_SLOTS; step++) {
        const i =
          (((player.activeSlot + dir * step) % ARSENAL_SLOTS) + ARSENAL_SLOTS) % ARSENAL_SLOTS;
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

    // Prestige is a terminal account conversion, independent of the retired in-run economy UI.
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
        const receipt = {
          ...result,
          prestige: account.prestige,
          scripPaid: 0,
          revision: account.revision,
        };
        this.prestigeReceipts.set(receiptKey, receipt);
        this.sendOwnerMessage(client.sessionId, "prestigeReceipt", receipt);
        this.sendOwnerMessage(client.sessionId, "metaAccount", account);
      },
    );

    // §classmerge C key: cosmetic during a run; Testing Grounds deliberately re-snapshots the full kit.
    this.onMessage("cycleCharacter", (client) => {
      if (!this.takeAction(client)) return; // §44 action budget
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      player.character = nextWholeArtCharacter(player.character);
      if (this.state.mode === "training") {
        this.snapshotRunIdentity(player, this.combat.get(client.sessionId), true);
      }
    });

    // §9/§13 R-TAP = DROP the held weapon on the floor (grabbable) in front of you; you fall back to
    // FISTS (§9). The drop gets a brief grace so it doesn't snap straight back to you (DROP_GRACE_SECONDS).
    // Provenance (v0.103): the dropped pickup INHERITS the held weapon's earned flag, so an earned drop
    // stays disassemblable after a re-grab but a conjured one can never launder into money.
    this.onMessage("dropWeapon", (client) => {
      if (!this.takeAction(client)) return; // §44 action budget (each drop allocates a synced pickup)
      const player = this.state.players.get(client.sessionId);
      if (!player?.alive) return;
      const c = this.combat.get(client.sessionId);
      if (c?.stance === STANCE_SLIDE) return;
      this.dropHeldWeapon(player, c);
    });

    // B20 L3: an exact floor row is latched on E-down, then consumed only after the server hold clock.
    this.onMessage("beginDisassembleFloor", (client, message?: { pickupId?: unknown }) => {
      if (!this.takeAction(client)) return;
      const player = this.state.players.get(client.sessionId);
      const pickupId =
        typeof message?.pickupId === "string" && message.pickupId.length <= 160
          ? message.pickupId
          : "";
      const pickup = pickupId ? this.state.pickups.get(pickupId) : undefined;
      if (!player?.alive || !pickup || !this.canDisassembleFloorPickup(player, pickup)) return;
      if (this.combat.get(player.id)?.stance === STANCE_SLIDE) return;
      this.floorDisassemblyIntents.set(player.id, {
        pickupId,
        readyTick: (this.state.tick + DISASSEMBLY_HOLD_TICKS) >>> 0,
      });
    });

    this.onMessage("cancelDisassembleFloor", (client) => {
      if (!this.takeAction(client)) return;
      this.floorDisassemblyIntents.delete(client.sessionId);
    });

    this.onMessage("disassembleFloorWeapon", (client, message?: { pickupId?: unknown }) => {
      if (!this.takeAction(client)) return;
      const player = this.state.players.get(client.sessionId);
      const pickupId =
        typeof message?.pickupId === "string" && message.pickupId.length <= 160
          ? message.pickupId
          : "";
      const intent = this.floorDisassemblyIntents.get(client.sessionId);
      const pickup = pickupId ? this.state.pickups.get(pickupId) : undefined;
      if (
        !player?.alive ||
        !pickup ||
        !intent ||
        intent.pickupId !== pickupId ||
        !tickReached(this.state.tick, intent.readyTick) ||
        !this.canDisassembleFloorPickup(player, pickup) ||
        this.combat.get(player.id)?.stance === STANCE_SLIDE
      )
        return;
      this.floorDisassemblyIntents.delete(player.id);
      this.disassembleFloorPickup(player, pickup);
    });

    this.onMessage("disassembleBagWeapon", (client, message?: { index?: unknown }) => {
      if (!this.takeAction(client)) return;
      const player = this.state.players.get(client.sessionId);
      const index = Math.floor(Number(message?.index));
      if (
        !player?.alive ||
        !this.belt ||
        !Number.isInteger(index) ||
        index < 0 ||
        index >= player.bag.length ||
        this.combat.get(player.id)?.stance === STANCE_SLIDE
      )
        return;
      this.disassembleBagPickup(player, index);
    });

    // §13 E near a ground weapon = GRAB it. Current clients name the exact synced pickup highlighted at
    // press time; that identity is authoritative. A gallery page can be rebuilt between send and receipt, so
    // a missing id is rejected instead of silently substituting the new weapon occupying the old cell.
    // Legacy id-less grabs remain available for ordinary `drop*` pickups only — never the mutable gallery.
    this.onMessage("grabWeapon", (client, message?: { pickupId?: unknown }) => {
      if (!this.takeAction(client)) return; // §44 action budget (O(pickups) scan per call)
      const player = this.state.players.get(client.sessionId);
      if (!player?.alive) return;
      this.floorDisassemblyIntents.delete(client.sessionId);
      if (this.combat.get(client.sessionId)?.stance === STANCE_SLIDE) return;
      const suppliedPickupId = message?.pickupId;
      const requestedPickupId =
        typeof suppliedPickupId === "string" &&
        suppliedPickupId.length > 0 &&
        suppliedPickupId.length <= 160
          ? suppliedPickupId
          : null;
      if (suppliedPickupId !== undefined && requestedPickupId === null) return;
      let best: PickupState | null = null;
      let bestD = Number.POSITIVE_INFINITY;
      const consider = (pk: PickupState, pid: string): void => {
        if ((this.pickupGrace.get(pid) ?? 0) > 0) return;
        if (pk.ownerId && pk.ownerId !== player.id) return;
        const bankMeta = this.pickupWeaponBankMeta.get(pid);
        if (bankMeta?.entry && bankMeta.ownerId && bankMeta.ownerId !== player.id) return;
        if (
          bankMeta?.ownerId &&
          bankMeta.ownerId !== player.id &&
          this.state.elapsed < bankMeta.ownerLockUntil
        )
          return;
        const d = (pk.x - player.x) ** 2 + (pk.y - player.y) ** 2;
        const petReach = this.petRuns.get(player.id)?.mods.earnedPickupRadius ?? 0;
        const radius = this.earnedPickups.has(pid) && petReach > 0 ? petReach : PICKUP_RADIUS;
        if (d <= radius * radius && d <= bestD) {
          bestD = d;
          best = pk;
        }
      };
      if (requestedPickupId !== null) {
        const requested = this.state.pickups.get(requestedPickupId);
        if (!requested) return;
        consider(requested, requestedPickupId);
      } else {
        this.state.pickups.forEach((pk, pid) => {
          if (pid.startsWith("pk:")) return;
          consider(pk, pid);
        });
      }
      if (!best) return;
      const grabbed = best as PickupState;
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
      )
        return;
      const c = this.combat.get(client.sessionId);
      if (this.belt) {
        // §29 belt: grabs ACCUMULATE into the 3-slot arsenal (the carousel is gone) — fill an empty slot,
        // overflow to the bag, only drop when everything is full.
        if (!this.grabIntoArsenal(player, c, grabbed, bankEntry)) return;
      } else {
        // §13 v0.106 (A11 de-clunk): grabbing is a SWAP, not a replace. If we're already holding a weapon,
        // DROP it on the floor first (as a grabbable pickup carrying its loot identity + earned provenance +
        // a re-grab grace) — otherwise grabbing a Common off the ground while holding a Legendary silently
        // DESTROYED the Legendary. No-op on fists (empty hands = a plain pickup, nothing to drop).
        this.dropHeldWeapon(player, c);
        player.weapon = grabbed.weapon;
        // A floor swap carries the exact weapon identity already shown by the pickup.
        player.weaponRarity = grabbed.rarity;
        player.weaponAffix = grabbed.affix;
        // Provenance rides the grab: chest-issued gear is earned; Testing-Grounds/conjured gear is not.
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
        this.clearFloorPickup(grabbed.id);
      }
      this.sendWeaponManifest(player);
    });

    // §5 JUMP (Spacebar) — a low all-class traversal HOP, then a cooldown so it isn't spammable. PURE
    // movement, NOT a dodge (no i-frames — the parry stays the defensive tool). The §17 pitfall layer reads
    // `airborne` to let a hopping player clear a gap.
    // B20 L2 chest OPEN is a budgeted, distance-validated interaction. Contents are rolled only here,
    // from a chest/player-specific seed, and the consumed bit is written only after delivery.
    this.onMessage("useElevator", (client) => {
      if (!this.takeAction(client) || !this.isCorporateLoop()) return;
      if (this.state.elevatorPhase !== CORPORATE_ELEVATOR_PHASE.ready) return;
      const player = this.state.players.get(client.sessionId);
      const floor = this.beltLevel ? corporateGridFloorForBelt(this.beltLevel) : undefined;
      const exit = floor?.elevatorMarkers[2];
      if (!player?.alive || !exit) return;
      if (Math.abs(player.x - exit.x) > CORPORATE_ELEVATOR_INTERACT_X) return;
      this.state.elevatorPhase = CORPORATE_ELEVATOR_PHASE.countdown;
      this.state.elevatorDeadlineTick =
        (this.state.tick + CORPORATE_ELEVATOR_COUNTDOWN_TICKS) >>> 0;
      this.state.beltRoomName = "Elevator departing in 3";
    });

    this.onMessage("openChest", (client, message?: { chestId?: unknown }) => {
      if (!this.takeAction(client)) return;
      const chestId =
        typeof message?.chestId === "string" && message.chestId.length <= 80 ? message.chestId : "";
      if (!chestId) return;
      this.openChestForPlayer(client.sessionId, chestId);
    });

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

    // Owner field notes: a dev-gated Testing-Grounds affordance, persisted outside schema state.
    // Weapon identity is derived from the authoritative live active slot, never trusted from the client.
    this.onMessage("ownerNote", (client, message: { type?: unknown; note?: unknown }) => {
      const reject = (reason: string): void =>
        client.send("ownerNoteAck", { saved: false, reason });
      if (!this.devToolsEnabled()) return reject("dev tools disabled");
      if (!this.takeAction(client)) return reject("rate limited");
      if (this.state.mode !== "training") return reject("Testing Grounds only");
      const player = this.state.players.get(client.sessionId);
      if (!player) return reject("player unavailable");
      const type = message?.type;
      if (type !== "game" && type !== "weapon") return reject("invalid note type");
      const note = sanitizeOwnerNote(message?.note);
      if (!note) return reject("empty note");
      try {
        appendOwnerNote({
          ts: new Date().toISOString(),
          session: client.sessionId,
          mode: "training",
          type,
          ...(type === "weapon"
            ? {
                weaponId: player.weapon,
                weaponName: WEAPONS[player.weapon]?.name ?? player.weapon,
              }
            : {}),
          note,
        });
        client.send("ownerNoteAck", { saved: true });
      } catch (error) {
        console.error(`[room ${this.roomId}] owner-note append failed`, error);
        reject("disk write failed");
      }
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
      )
        return;
      this.spawnBoss(kindId, false);
    });

    // B33 private live-gate fixture. It is unreachable in production and does not invent a defense:
    // the next ordinary white-pop tick calls the same roll/parry machinery as accepted player input.
    this.onMessage("debugArmCommitDefense", (client, message: { kind?: "roll" | "parry" }) => {
      if (
        !this.devToolsEnabled() ||
        this.state.mode !== "training" ||
        !this.takeAction(client) ||
        (message?.kind !== "roll" && message?.kind !== "parry")
      )
        return;
      this.debugCommitDefense.set(client.sessionId, message.kind);
    });

    // §21 Dev summon (Tab menu): spawn N of a chosen enemy kind on a ring around the requester, optionally
    // TOUGH. Training-mode ONLY — it's a sandbox affordance (so any client may summon; both players test),
    // and gating to training keeps it out of a live survival run. All fields validated (untrusted client).
    this.onMessage("debugArmAttackMoveCapture", (client) => {
      if (!this.devToolsEnabled() || this.state.mode !== "training" || !this.takeAction(client))
        return;
      this.debugAttackMoveCapture.add(client.sessionId);
    });

    // B36 private live-gate fixture. It drives the same retained held bit and watchdog timestamp as an
    // accepted input heartbeat, without racing the scene's independent movement command producer.
    this.onMessage("debugSetFireInputHeld", (client, message: { held?: boolean }) => {
      if (!this.devToolsEnabled() || this.state.mode !== "training" || !this.takeAction(client))
        return;
      const input = this.inputs.get(client.sessionId);
      const player = this.state.players.get(client.sessionId);
      if (!input || !player) return;
      input.held.fireHeld = message?.held === true;
      input.lastFreshFireTick = this.state.tick;
      player.dualWield.fireInputHeld = input.held.fireHeld;
      if (input.held.fireHeld) this.debugHeldFire.add(client.sessionId);
      else this.debugHeldFire.delete(client.sessionId);
      client.send("b36FireHeldReceipt", {
        held: input.held.fireHeld,
        tick: this.state.tick,
      });
    });

    this.onMessage(
      "debugSpawn",
      (
        client,
        message: {
          kind?: string;
          count?: number;
          tough?: boolean;
          angle?: number;
          distance?: number;
          attackReady?: boolean;
        },
      ) => {
        if (!this.devToolsEnabled() || !this.takeAction(client)) return; // §44 dev-gated + budgeted
        if (this.state.mode !== "training") return;
        const player = this.state.players.get(client.sessionId);
        if (!player) return;
        const kindId = message?.kind;
        if (typeof kindId !== "string" || !ENEMY_KINDS[kindId] || kindId === "dummy") return;
        const count = clamp(Math.floor(message?.count ?? 1), 1, DEBUG_SPAWN_MAX);
        const tough = message?.tough === true;
        const rawAngle = message?.angle;
        const suppliedAngle =
          typeof rawAngle === "number" && Number.isFinite(rawAngle)
            ? Math.atan2(Math.sin(rawAngle), Math.cos(rawAngle))
            : undefined;
        const rawDistance = message?.distance;
        const suppliedDistance =
          typeof rawDistance === "number" && Number.isFinite(rawDistance)
            ? clamp(rawDistance, 160, SPAWN_RING)
            : undefined;
        const attackReady = message?.attackReady === true;
        for (let i = 0; i < count; i++) {
          const angle =
            suppliedAngle === undefined ? undefined : suppliedAngle + (i - (count - 1) / 2) * 0.22;
          this.debugSpawnOne(kindId, tough, player, angle, suppliedDistance, attackReady);
        }
      },
    );

    this.setSimulationInterval((deltaMs) => this.update(deltaMs), TICK_MS);
    // §7 v0.105 de-clunk: DISABLE the independent patch timer and broadcast at the END of each tick
    // instead (`this.broadcastPatch()` in `update`). Colyseus's default patch interval is a SECOND 50ms
    // timer whose phase drifts against the sim, so a fresh tick's results could wait up to a full extra
    // 50ms before being sent (the "sometimes snappy, sometimes laggy" +0–50ms). Tick-locking removes it.
    this.setPatchRate(0);
  },

  /** Reset every NON-synced per-entity collection at a run boundary (restart / training toggle) so no
   *  in-flight swing, combo, fire-cooldown, zone, pickup-grace, or burn-pulse ghost-carries into the fresh
   *  run. ONE place → adding a new transient Map forces touching this. (`inputs`/`combat` are player-
   *  lifecycle, not run transients, so they're left alone.) */
  clearTransients(this: GameRoomContext): void {
    this.projectileMeta.clear();
    this.hostileProjectileCount = 0;
    this.enemyFireCd.clear();
    this.zonerDropCd.clear();
    this.zoneMeta.clear();
    this.activeGroundZones.clear();
    this.groundZoneInputWasHeld.clear();
    this.enemyZoneSlow.clear();
    this.comboState.clear();
    this.meleeAttackTokens.clear();
    this.debugHeldFire.clear();
    this.duelTokens.clear(); // §51 no duel claim may ghost-carry into the fresh run
    this.dodgeState.clear(); // §15 v0.113
    this.poundEnemyEffects.clear();
    this.ultimateStunUntil.clear();
    this.ultimateBrands.clear();
    this.ultimateDecoys.clear();
    this.ultimateFissures.length = 0;
    this.meleeSwings.clear();
    this.pendingQuakes.length = 0; // §40.2 no landed-blade detonation may carry across a run boundary
    this.pendingScatterVolleys.length = 0;
    this.pendingHybridProjectiles.length = 0;
    this.minimumAttackInputSlowUntilTick.clear();
    this.pendingWeaponThrows.length = 0;
    this.pickupGrace.clear();
    if (this.earnedPickups.size > 0) {
      this.earnedPickups.clear();
      this.publishPetPickupEligibility();
    }
    this.pickupWeaponBankMeta.clear();
    this.floorDisassemblyIntents.clear();
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
      c.rollCd = 0;
      c.slideParryLockT = 0;
      c.ultBuffer = 0;
      c.ultAccrualThisTick = 0;
      c.ult = undefined;
      c.ultCritCharges = 0;
      c.ultCritEndTick = 0;
      const player = this.state.players.get(id);
      if (player) {
        player.ultPhase = UltimatePhase.Idle;
        player.dualWield.attackMoveMode = PlayerAttackMoveMode.Normal;
        this.cancelMoveStance(player, c, true);
      }
    }
    this.state.telegraphs.clear(); // §16/§15 clear any orphan leap/boss markers on a reset
    this.enemyGrid.clear(); // §45 no cleared combat body may remain queryable across the boundary
    this.wormSegmentGrid.clear();
  },

  /** §6 terminal combat teardown shared by wipes and every victory route. Pickups/player state remain for the
   *  result screen; all damage-producing bodies and their non-synced machines are retired together. */
  clearCombatEntities(this: GameRoomContext): void {
    this.clearBoss();
    this.state.enemies.clear();
    this.state.projectiles.clear();
    this.state.zones.clear();
    this.clearTransients();
    this.resetChestDirector();
  },

  /** §6 enter a terminal result exactly once through the full combat teardown path. */
  enterTerminalOutcome(this: GameRoomContext, outcome: "defeat" | "victory"): void {
    this.settleMetaAccounts(outcome);
    if (outcome === "defeat") this.state.moneyDrops.clear();
    this.state.outcome = outcome;
    this.clearCombatEntities();
  },

  /** Switch between survival ("arena") and Testing Grounds ("training", §21). */
  toggleTraining(this: GameRoomContext, abandoningPlayerId = this.hostId ?? ""): void {
    if (this.state.mode === "arena") this.forfeitWeaponRunForWorkshop(abandoningPlayerId);
    // Entering/leaving the workshop aborts the expedition; pending run rewards are explicitly forfeited.
    this.state.enemies.clear();
    this.state.pickups.clear();
    this.state.projectiles.clear();
    this.state.zones.clear();
    this.clearTransients();
    this.resetChestDirector();
    this.state.outcome = "active";
    this.state.portalOpen = false;
    this.resetExtractionIntent();
    this.state.riftOpen = false; // §6 chain — the Testing Grounds sits outside the run structure
    this.state.depth = 1;
    this.petDimensionEpoch = 0;
    this.visitedDims.clear();
    // Stepping OUT of a live run into the workshop aborts the weapon expedition. Without this, T is a
    // panic button that launders at-stake weapons through a depth reset. Also clear the
    // elapsed-clock parry timestamps (elapsed resets below) + weapon provenance (the gallery is free).
    this.state.players.forEach((p) => {
      this.resetPetAccrual(p.id);
      p.dualWield.relics = new RelicState();
      p.ultCharge = 0;
      // …and the held weapon sheds its rolled loot identity too — without this, the workshop is a
      // risk-free reroll booth whose Legendary rides back into the real run (adversarial-verify).
      p.weaponRarity = RARITY_COMMON;
      p.weaponAffix = "";
    });
    this.combat.forEach((c) => {
      c.lastParryAt = -999;
      c.hairStreak = 0;
      c.parryGuardCycles.clear();
      c.heldEarned = false;
      c.ultChargeF = 0;
      c.ultAccrualThisTick = 0;
      c.drive.valueF = Math.min(DRIVE_CAPACITY, c.drive.valueF);
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
      // §31 SHOWROOM: browse every ACTIVE arted weapon (curated + expansion; archived rows stay hidden),
      // one page at a time (Z/X cycles pages), so the gallery remains comfortably performant.
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
        this.placeWithMotionEpoch(player, "teleport-placement", () => {
          player.x = cx;
          player.y = cy + 20;
          this.zeroMoveVel(id, undefined, "teleport-placement"); // §7 the reposition is a teleport — don't glide out of it
        });
      });
    } else {
      this.state.mode = "arena";
      this.resetElapsed();
      this.spawnAccum = 0;
    }
    console.log(`[room ${this.roomId}] mode → ${this.state.mode}`);
  },

  /** The dev workshop is an explicit abandon, followed by an empty non-bank training reservation. */
  forfeitWeaponRunForWorkshop(this: GameRoomContext, playerId: string): void {
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
  },

  /** §31 (re)spawn the current showroom PAGE: clear the gallery pickups (`pk*`) and lay out this page's
   *  slice of GALLERY_ROSTER in a grid above the player. Wraps the page index. Training mode only.
   *  §41 cells keep their EXACT grid position — a cell over a pit/POI is SKIPPED (the shelf shows a gap)
   *  instead of safeSpawnPos NUDGING it: the old nudge scattered the neat grid and piled pickups onto their
   *  neighbours, so E grabbed "the wrong thing" and pages read as disorganized. */
  spawnGalleryPage(this: GameRoomContext): void {
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
      // Page-scoped ids make both the renderer and grab RPC identity-stable. Reusing `pk0…pk41` caused the
      // client to retain the previous page's art while these same ids changed weapon underneath it.
      pk.id = `pk:${this.galleryPage + 1}:${pages}:${i}:${weaponId}`;
      pk.weapon = weaponId;
      pk.weaponPublic = weaponId;
      pk.x = cell.x;
      pk.y = cell.y;
      this.state.pickups.set(pk.id, pk);
    });
  },

  restartRun(this: GameRoomContext): void {
    if (this.state.outcome === "active") this.settleMetaAccounts("defeat");
    // A restart is a fresh expedition (progression resets below), so no old field packet crosses it.
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
    // Persistent meta-account money survives; run money is minted fresh.
    this.state.riftOpen = false;
    this.state.riftCharge = 0;
    if (this.corporateHomeDepth > 0) {
      this.installCorporateFloor(this.corporateHomeDepth, CORPORATE_ELEVATOR_PHASE.sealed);
    } else {
      this.state.depth = 1;
    }
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
      // Fresh run: reset run-scoped combat and snapshot flavor identity.
      player.weaponRarity = RARITY_COMMON;
      player.weaponAffix = "";
      player.dualWield.relics = new RelicState();
      this.snapshotRunIdentity(player, c, false);
      // Augments remain an empty hook until a non-level acquisition lane owns them.
      player.augments = "";
      // B20 interim: every identity uses the same flat, damage-meter Sunspite ultimate.
      player.ultFamily = UltimateFamily.SunspiteComet;
      player.ultVariant = "str";
      player.ultArchetype = ultimateCodeFor(UltimateFamily.SunspiteComet, "str");
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
      const corporateFloor =
        this.corporateHomeDepth > 0 && this.beltLevel
          ? corporateGridFloorForBelt(this.beltLevel)
          : undefined;
      const corporateSpawn = corporateFloor?.playerSpawns[0];
      this.placeWithMotionEpoch(player, "teleport-placement", () => {
        if (corporateSpawn && this.beltLevel) {
          const placed = resolveBeltNavigation(
            this.beltLevel,
            corporateSpawn.x,
            BELT_Y0 + corporateSpawn.y,
            PLAYER_RADIUS,
          );
          player.x = placed.x;
          player.y = placed.y;
        } else {
          player.x = this.map.spawnX + (Math.random() * 200 - 100);
          player.y = this.map.spawnY + (Math.random() * 200 - 100);
        }
      });
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
        c.parryGuardCycles.clear();
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
        c.rollCd = 0;
        c.slideParryLockT = 0;
      }
      this.zeroMoveVel(id, undefined, "teleport-placement"); // §7 fresh run, fresh momentum
    });
    // §16 v0.116 a restart in BOSS RUSH re-arms the gauntlet from boss 1 (mode is preserved across restart).
    if (this.state.mode === "bossrush") {
      this.bossRushIndex = 0;
      this.bossRushNextTimer = BOSSRUSH_BREATHER;
    }
    console.log(`[room ${this.roomId}] run restarted`);
  },

  onJoin(this: GameRoomContext,
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
  ): void {
    const disconnected = this.disconnectedPlayers.get(client.sessionId);
    const reservedAccount = this.metaAccounts.get(client.sessionId);
    if (
      disconnected &&
      reservedAccount?.weaponBank.expedition &&
      this.weaponRuns.has(client.sessionId)
    ) {
      this.disconnectedPlayers.delete(client.sessionId);
      this.state.players.set(client.sessionId, disconnected.player);
      this.state.chests.forEach((chest) => {
        if (!chest.openedBy.get(client.sessionId)) chest.opened = false;
      });
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
    player.character = isWholeArtCharacter(options?.selectedCharacterId)
      ? options.selectedCharacterId
      : DEFAULT_CHARACTER;
    // §29/§31 restore the player's persisted meta ACCOUNT (belt only): scrip bank + permanent upgrade
    // levels. Client-supplied → clamped (a sane bound; the persistence model is an MVP, not a trusted
    // economy). The upgrades then apply their stat bonuses to this fresh player.
    // §44 (Sol audit): client-authored progression is only honoured while dev tools are on — on a public
    // deploy any client could join claiming 65,535 legacy money + max upgrades. INTERIM until an authenticated
    // account store owns progression; production joins start at the defaults.
    const trustLegacyMeta = this.belt && this.devToolsEnabled();
    const suppliedCurrentAccount =
      typeof options?.metaAccount === "object" &&
      options.metaAccount !== null &&
      !Array.isArray(options.metaAccount) &&
      ((options.metaAccount as { version?: unknown }).version === 3 ||
        (options.metaAccount as { version?: unknown }).version === 4 ||
        (options.metaAccount as { version?: unknown }).version === 5);
    const suppliedBankAccount =
      suppliedCurrentAccount &&
      ((options?.metaAccount as { version?: unknown }).version === 4 ||
        (options?.metaAccount as { version?: unknown }).version === 5);
    const legacyAccount = sanitizeMetaAccountV2(options?.metaAccount);
    // Legacy local keys remain a bounded migration input only when no v2 blob was supplied.
    if (options?.metaAccount === undefined && trustLegacyMeta) {
      if (Number.isFinite(options?.scrip)) {
        legacyAccount.scrip = Math.max(0, Math.min(65535, Math.floor(options?.scrip as number)));
      }
      legacyAccount.upgrades = sanitizeMetaLevels(options?.up);
    }
    const accountResult = sanitizeMetaAccountV5WithDiagnostics(
      suppliedCurrentAccount ? options?.metaAccount : legacyAccount,
    );
    if (suppliedBankAccount && !accountResult.ok) {
      throw new Error(`invalid weapon bank: ${accountResult.bank.errors.join(",")}`);
    }
    const account = accountResult.account;
    // W4A archive migration: persisted rows are accepted only so every retired instance can be valued and
    // removed here. Do not advance revision yet — like stale-expedition abandonment below, the client's
    // carry was built against the exact revision it supplied. The carry commit performs the ordinary bump.
    const archiveSalvage = salvageArchivedWeaponBank(account.weaponBank);
    if (archiveSalvage.payout > 0) {
      account.scrip = Math.min(META_ACCOUNT_SCRIP_MAX, account.scrip + archiveSalvage.payout);
    }
    const requestedPetId = options?.selectedPetId ?? options?.petId;
    if (requestedPetId === "") account.selectedPetId = "";
    else if (isPetId(requestedPetId) && account.pets[requestedPetId]) {
      account.selectedPetId = requestedPetId;
    }
    this.metaAccounts.set(client.sessionId, account);
    if (!isCharacterUnlocked(account, player.character)) player.character = DEFAULT_CHARACTER;
    player.scrip = 0;
    player.prestige = account.prestige;
    // Persisted gear remains sanitized in the canonical account but is archived runtime-inert state.
    // Every ordinary join snapshots the selected/default whole-art kit and creates no gear run.
    this.snapshotRunCharacter(player, undefined, false, false);
    player.ultFamily = UltimateFamily.SunspiteComet;
    player.ultVariant = "str";
    player.ultArchetype = ultimateCodeFor(UltimateFamily.SunspiteComet, "str");
    player.hp = player.maxHp;
    this.snapshotPetRun(player, account.selectedPetId);
    for (let i = 0; i < ARSENAL_SLOTS; i++) player.slots.push(new ArsenalSlot());
    const runId = `run_${randomBytes(12).toString("base64url")}`;
    const requestedTier = Math.max(account.prestige, this.worldTier);
    let carry: CarrySelectionV1 = options?.carry ?? {
      requestId: `auto_${randomBytes(12).toString("base64url")}`,
      expectedRevision: account.revision,
      placements: [],
      activeEntryId: "",
      requestedWorldTier: requestedTier,
    };
    if (archiveSalvage.salvagedInstances > 0 && Array.isArray(carry.placements)) {
      const available = new Set(account.weaponBank.stash.map((entry) => entry.entryId));
      const placements = carry.placements.flatMap((placement) => {
        const entryId = placement.entryId;
        return available.has(entryId) ? [{ ...placement, entryId }] : [];
      });
      const activeEntryId = carry.activeEntryId;
      carry = {
        ...carry,
        placements,
        activeEntryId: placements.some(
          (placement) => placement.zone === "active" && placement.entryId === activeEntryId,
        )
          ? activeEntryId
          : "",
      };
    }
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
    if (archiveSalvage.salvagedInstances > 0) {
      this.sendOwnerMessage(client.sessionId, "weaponArchiveSalvageReceipt", {
        payout: archiveSalvage.payout,
        salvagedInstances: archiveSalvage.salvagedInstances,
        affectedEntries: archiveSalvage.affectedEntries,
        weaponIds: archiveSalvage.salvagedWeaponIds,
      });
    }
    this.worldTier = Math.max(this.worldTier, committed.runTier);
    this.materializeWeaponRun(player, account);
    this.createWeaponRun(client.sessionId, account);
    // Spawn on the map's guaranteed-clear spawn disc (§17), with a little scatter so blobs don't overlap
    // (±100px stays inside the cleared centre, never over a pit). §29 belt spawns at the START of the belt
    // (the mouth of room 0), mid-depth, so the room progression flows left→right.
    if (this.belt) {
      const floor = this.beltLevel ? corporateGridFloorForBelt(this.beltLevel) : undefined;
      const authoredSpawn = floor?.playerSpawns[0];
      if (this.beltLevel && authoredSpawn) {
        const ordinal = this.state.players.size;
        const scatter = ordinal === 0 ? 0 : (Math.ceil(ordinal / 2) * (ordinal % 2 ? 1 : -1)) * 36;
        const spawn = resolveBeltNavigation(
          this.beltLevel,
          authoredSpawn.x + scatter,
          BELT_Y0 + authoredSpawn.y,
          PLAYER_RADIUS,
        );
        player.x = spawn.x;
        player.y = spawn.y;
      } else {
        player.x = 180 + Math.random() * 120;
        player.y = BELT_Y0 + DEPTH_MAX * (0.4 + Math.random() * 0.2);
      }
    } else {
      player.x = this.map.spawnX + (Math.random() * 200 - 100);
      player.y = this.map.spawnY + (Math.random() * 200 - 100);
    }
    this.state.players.set(client.sessionId, player);
    this.state.chests.forEach((chest) => {
      if (!chest.openedBy.get(client.sessionId)) chest.opened = false;
    });
    if (this.hostId === null) this.hostId = client.sessionId; // first joiner is the co-op host
    this.inputs.set(client.sessionId, this.freshInputState());
    const joinedQuirk = quirkForCharacter(player.runCharacter);
    this.combat.set(client.sessionId, {
      identityCharacter: player.runCharacter,
      quirk: joinedQuirk,
      mods: runtimeModsForQuirk(joinedQuirk),
      aimX: 1,
      aimY: 0,
      targetX: 0,
      targetY: 0,
      attackBuffer: 0,
      parryBuffer: 0,
      jumpBuffer: 0,
      cd: 0,
      gunBurstRemaining: 0,
      gunBurstT: 0,
      gunBurstWeaponId: "",
      gunBurstHand: 0,
      chargedProjectileInputWasHeld: false,
      chargedProjectileWeaponId: "",
      chargedProjectileStartTick: 0,
      respawn: 0,
      invuln: 0,
      parryCd: 0,
      reloadCd: 0,
      lastWeapon: player.weapon,
      drawLock: 0,
      soloComboSeq: undefined,
      soloComboAcceptedAtMs: 0,
      soloComboId: "",
      soloComboFamily: "arc",
      soloComboStep: 0,
      soloComboExpiresAtMs: 0,
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
      rollCd: 0,
      slideParryLockT: 0,
      lastLandingTier: LANDING_TIER_SOFT,
      lastLandingSpeed: 0,
      lastGroundX: player.x,
      lastGroundY: player.y,
      pitGrace: 0,
      hairStreak: 0,
      lastParryAt: -999,
      parryChain: 0,
      parryChainT: 0,
      parryGuardCycles: new Map<string, ParryGuardCycleState>(),
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
      beamRayOffsets: [0],
      beamMuzzlePointIndices: [0],
      beamPreviousOriginsX: [player.x],
      beamPreviousOriginsY: [player.y],
      beamCurrentOriginsX: [player.x],
      beamCurrentOriginsY: [player.y],
      beamPreviousLengths: [0],
      beamCurrentLengths: [0],
      beamTeleportSeq: player.teleportSeq,
      beamInputWasHeld: false,
      beamPulseT: 0,
      beamQuantumT: 0,
      beamCrit: 0,
      beamHitIds: new Set<string>(),
      beamPendingDamage: new Map<string, number>(),
      auraActive: false,
      auraInputWasHeld: false,
      auraRequireRelease: false,
      auraPulseT: 0,
      auraCrit: 0,
      ultChargeF: 0,
      ultBuffer: 0,
      ultAccrualThisTick: 0,
      ultAlphaBonusTargets: 0,
      ultCritCharges: 0,
      ultCritEndTick: 0,
    });
    this.sendWeaponManifest(player);
    this.publishPetPickupEligibility();
    if (typeof client.send === "function") client.send("metaAccount", account);
    console.log(`[room ${this.roomId}] +join ${client.sessionId} (${this.clients.length} online)`);
  },

  onLeave(this: GameRoomContext, client: Client): void {
    const leaving = this.state.players.get(client.sessionId);
    const leavingCombat = this.combat.get(client.sessionId);
    if (leaving && leavingCombat)
      this.cancelBeam(leaving, client.sessionId, leavingCombat, false, true);
    if (
      leaving &&
      leavingCombat &&
      this.metaAccounts.get(client.sessionId)?.weaponBank.expedition
    ) {
      this.syncWeaponRunFromArsenal(leaving);
      this.disconnectedPlayers.set(client.sessionId, { player: leaving, combat: leavingCombat });
    }
    this.clearBeamRows(client.sessionId);
    this.state.players.delete(client.sessionId);
    this.refreshAllChestOpened();
    this.inputs.delete(client.sessionId);
    this.acceptedClientMovement.delete(client.sessionId);
    this.serverMotionUntilTick.delete(client.sessionId);
    this.serverMotionSourceByPlayer.delete(client.sessionId);
    this.combat.delete(client.sessionId);
    this.debugCommitDefense.delete(client.sessionId);
    this.debugAttackMoveCapture.delete(client.sessionId);
    this.debugHeldFire.delete(client.sessionId);
    this.minimumAttackInputSlowUntilTick.delete(client.sessionId);
    // Transport loss is not a terminal weapon result. Account, pet accrual, exact escrow, and the private
    // body/debt snapshot remain reserved; accepted extraction/wipe settles them even while disconnected.
    // Host left → hand off to whoever's still here (or null if the room's now empty).
    if (client.sessionId === this.hostId) {
      const next = this.state.players.keys().next();
      this.hostId = next.done ? null : next.value;
    }
    console.log(`[room ${this.roomId}] -leave ${client.sessionId} (${this.clients.length} online)`);
  },

  /** Advance the precise, non-serialized run clock and patch only when its whole-second projection changes. */
  advanceElapsed(this: GameRoomContext, dt: number): void {
    this.state.elapsed += dt;
    const seconds = Math.max(0, Math.floor(this.state.elapsed));
    if (this.state.elapsedSeconds !== seconds) this.state.elapsedSeconds = seconds;
  },

  resetElapsed(this: GameRoomContext): void {
    this.state.elapsed = 0;
    this.state.elapsedSeconds = 0;
  },

  /** §4 v0.107 defense-in-depth (review #4): WITHOUT this, Colyseus does not wrap the simulation-interval
   *  or message handlers in try/catch — a single uncaught throw (e.g. a hostile payload reaching a schema
   *  setter) escapes the timer and kills the whole Node process (every room, every player). With it, the
   *  error degrades to a log line. Input validation is still the first line — this is the seatbelt. */
  onUncaughtException(this: GameRoomContext, error: Error, methodName: string): void {
    console.error(`[room ${this.roomId}] uncaught exception in ${methodName}:`, error);
  },
  update(this: GameRoomContext, deltaMs: number): void {
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
  },

  /** One EXACT 50ms authoritative sub-step. The hand-numbered phase order is a CONTRACT (golden test). */
  stepSim(this: GameRoomContext, dt: number): void {
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
    this.acceptedClientMovement.clear();
    this.state.players.forEach((player, id) => {
      // The wire latch derives only from accepted attack epochs. Wrap-safe uint32 subtraction keeps the
      // short window correct across ArenaState.tick rollover; write only on the true→false lapse edge.
      if (player.attackHeld && (this.state.tick - player.attackTick) >>> 0 >= ATTACK_HELD_WINDOW) {
        player.attackHeld = false;
      }
      const input = this.inputs.get(id);
      if (!input) return;
      this.refreshServerMotionState(player, id, dt);
      input.freshMovement = undefined;
      const tickCombat = this.combat.get(id);
      if (tickCombat) tickCombat.ultAccrualThisTick = 0;
      input.msgBudget = INPUT_MSGS_PER_TICK;
      input.traversalEdgeBudget = 1;
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
            if (queued.fireHeld && !fireWasHeld && fireStartSeq === 0) fireStartSeq = queued.seq;
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
        input.freshMovement = cmd.movement;
        input.lastFreshFireTick = this.state.tick;
        player.ackSeq = cmd.seq;
        const beamAim = this.combat.get(id);
        if (beamAim) {
          const aimLength = Math.hypot(cmd.aimX, cmd.aimY);
          if (aimLength > 1e-4) {
            beamAim.aimX = cmd.aimX / aimLength;
            beamAim.aimY = cmd.aimY / aimLength;
          }
          beamAim.targetX = Number.isFinite(cmd.targetX) ? cmd.targetX : player.x + beamAim.aimX;
          beamAim.targetY = Number.isFinite(cmd.targetY) ? cmd.targetY : player.y + beamAim.aimY;
          player.aimDir = Math.atan2(beamAim.aimY, beamAim.aimX);
        }
        // The jump intent rides the command (review #5) — same buffered-jump semantics as the SPACE
        // message (the consume gate re-checks grounded/cooldown/alive/level-window).
        if (cmd.jump) {
          const c = this.combat.get(id);
          if (c) {
            const rollTail =
              c.stance === STANCE_SLIDE
                ? (ROLL_DURATION_TICKS - c.slidePhaseTick + 2) * (TICK_MS / 1000)
                : 0;
            c.jumpBuffer = Math.max(JUMP_BUFFER_SECONDS, rollTail);
          }
        }
        const stance = this.combat.get(id);
        if (stance) this.consumeMoveStanceInput(player, input, stance, cmd);
      }
      player.dualWield.fireInputHeld =
        this.debugHeldFire.has(id) ||
        (input.held.fireHeld &&
          ((this.state.tick - input.lastFreshFireTick) >>> 0) < BEAM_STALE_INPUT_TICKS);
    });
    // §6 TERMINAL HOLD: keep input acknowledgements/action budgets alive so the host can restart, but retire
    // any combat entity an out-of-band action tried to create and skip every movement/AI/damage machine.
    if (this.state.outcome !== "active") {
      this.clearCombatEntities();
      return;
    }
    this.stepVastagharAddBudget();
    this.rebuildEnemyGrid(); // §45 exactly once/ACTIVE sub-step; later enemy motion updates cell membership
    // Accepted long jumps own the tick before pit sampling. Their launch tick advances height but defers
    // horizontal travel so the authored 12 flight samples still total exactly 372 px.
    this.stepTraversalLaunches(dt);

    // 1. Integrate each living player's authoritative movement from held input.
    this.state.players.forEach((player, id) => {
      const input = this.inputs.get(id);
      if (!input) return;
      if (!player.alive) {
        player.dualWield.attackMoveMode = PlayerAttackMoveMode.Normal;
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
        player.dualWield.attackMoveMode = PlayerAttackMoveMode.Normal;
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
        beamRuntime.slidePhaseTick * (TICK_MS / 1000) + 1e-9 >= ROLL_ATTACK_CANCEL_SECONDS
      ) {
        this.cancelMoveStance(player, beamRuntime, true);
      }
      const baseMoveSpeed = relicMoveSpeed(player.relics);
      const channelSpeed = beamRuntime?.beamDescriptor
        ? baseMoveSpeed *
          (beamRuntime.beamPhase === 1
            ? beamRuntime.beamDescriptor.chargeMoveMul
            : beamRuntime.beamPhase === 2
              ? beamRuntime.beamDescriptor.channelMoveMul
              : 1)
        : baseMoveSpeed;
      const beamSpeed =
        player.ultPhase === UltimatePhase.Windup &&
        ultimateFamilyForCode(player.ultArchetype) === UltimateFamily.SunspiteComet
          ? channelSpeed * 0.55
          : channelSpeed;
      const attackMoveMode = this.playerAttackMoveMode(id, dt);
      player.dualWield.attackMoveMode = attackMoveMode;
      const inputMoveSpeed = beamSpeed * playerAttackInputSpeedMultiplier(attackMoveMode);
      const captureAttackMove =
        attackMoveMode === PlayerAttackMoveMode.InputSlow && this.debugAttackMoveCapture.delete(id);
      const movementStartX = player.x;
      const movementStartY = player.y;
      const movementStartImpulse = Math.hypot(player.vx, player.vy);
      let normalSpeedProjection: { x: number; y: number } | undefined;
      let nextX: number;
      let nextY: number;
      const beltX = this.beltLevel ? beltPlayableXBounds(this.beltLevel) : undefined;
      const minBeltX = (beltX?.minX ?? 0) + PLAYER_RADIUS;
      const maxBeltX = (beltX?.maxX ?? ARENA_WIDTH) - PLAYER_RADIUS;
      const activeRoll =
        beamRuntime?.stance === STANCE_SLIDE && beamRuntime.slidePhase === SLIDE_PHASE_GROUND;
      if (beamRuntime?.stance === STANCE_DASH || activeRoll) {
        const deferDashDisplacement =
          beamRuntime?.stance === STANCE_DASH && this.distanceJumpLaunches.delete(id);
        if (beamRuntime?.stance === STANCE_DASH) {
          this.steerDistanceJump(beamRuntime, input.held, dt);
          input.mvx = beamRuntime.dashDirX * beamRuntime.dashSpeed;
          input.mvy = beamRuntime.dashDirY * beamRuntime.dashSpeed;
        } else if (beamRuntime) {
          const directionLength = Math.hypot(beamRuntime.momentumX, beamRuntime.momentumY);
          if (directionLength <= 1e-4) {
            this.cancelMoveStance(player, beamRuntime, false);
            input.mvx = 0;
            input.mvy = 0;
          } else {
            const speed = relicRollSpeedAtTick(player.relics, beamRuntime.slidePhaseTick);
            beamRuntime.momentumX = (beamRuntime.momentumX / directionLength) * speed;
            beamRuntime.momentumY = (beamRuntime.momentumY / directionLength) * speed;
            input.mvx = beamRuntime.momentumX;
            input.mvy = beamRuntime.momentumY;
          }
        }
        nextX = deferDashDisplacement
          ? player.x
          : clamp(player.x + input.mvx * dt, minBeltX, maxBeltX);
        nextY = deferDashDisplacement
          ? player.y
          : clamp(
              player.y + input.mvy * dt,
              this.belt ? BELT_Y0 : PLAYER_RADIUS,
              this.belt ? BELT_Y0 + DEPTH_MAX : ARENA_HEIGHT - PLAYER_RADIUS,
            );
        if (activeRoll && beamRuntime?.stance === STANCE_SLIDE) {
          beamRuntime.slidePhaseTick++;
          const length = Math.hypot(beamRuntime.momentumX, beamRuntime.momentumY);
          const nextSpeed = relicRollSpeedAtTick(player.relics, beamRuntime.slidePhaseTick);
          if (length > 1e-4) {
            beamRuntime.momentumX = (beamRuntime.momentumX / length) * nextSpeed;
            beamRuntime.momentumY = (beamRuntime.momentumY / length) * nextSpeed;
          }
          input.mvx = beamRuntime.momentumX;
          input.mvy = beamRuntime.momentumY;
        }
      } else {
        const rooted =
          beamRuntime?.stance === STANCE_CROUCH ||
          beamRuntime?.stance === STANCE_POUND ||
          (beamRuntime?.recoveryT ?? 0) > 0;
        if (captureAttackMove) {
          normalSpeedProjection = this.belt
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
        }
        const next = this.belt
          ? stepPlayerAttackMovement(
              player,
              { vx: input.mvx, vy: input.mvy },
              rooted ? ZERO_MOVE_INPUT : input.held,
              dt,
              beamSpeed,
              attackMoveMode,
              BELT_Y0,
              BELT_Y0 + DEPTH_MAX,
              minBeltX,
              maxBeltX,
            )
          : stepPlayerAttackMovement(
              player,
              { vx: input.mvx, vy: input.mvy },
              rooted ? ZERO_MOVE_INPUT : input.held,
              dt,
              beamSpeed,
              attackMoveMode,
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
      if (captureAttackMove && normalSpeedProjection) {
        const actualDistance = Math.hypot(nextX - movementStartX, nextY - movementStartY);
        const normalDistance = Math.hypot(
          normalSpeedProjection.x - movementStartX,
          normalSpeedProjection.y - movementStartY,
        );
        this.sendOwnerMessage(id, "b33AttackMoveCapture", {
          tick: this.state.tick,
          mode: attackMoveMode,
          inputSpeed: inputMoveSpeed,
          normalInputSpeed: beamSpeed,
          configuredRatio: playerAttackInputSpeedMultiplier(attackMoveMode),
          actualDistance,
          normalDistance,
          displacementRatio: normalDistance > 1e-9 ? actualDistance / normalDistance : 0,
        });
      }
      player.x = nextX;
      player.y = nextY;
      const imp = stepImpulse(player, player, dt, minBeltX, maxBeltX);
      player.x = imp.x;
      player.y = imp.y;
      player.vx = imp.vx;
      player.vy = imp.vy;
      const movement = input.freshMovement;
      const movementEpochCurrent =
        clientServerMotionEpochAdmissible(
          movement?.serverMotionEpoch,
          player.dualWield.serverMotionEpoch,
          player.dualWield.serverMotionActive,
        ) &&
        movement?.movementCorrectionSeq === player.dualWield.movementCorrectionSeq;
      if (movement && movementEpochCurrent && !player.dualWield.serverMotionActive) {
        const movementSpeedBudget = Math.max(
          baseMoveSpeed,
          // Distance jumps and dodge rolls are player traversal verbs with explicit motion epochs.
          // Admit their exact per-tick budget without granting a generic tier outside those windows.
          Math.hypot(player.mvx, player.mvy),
          beamRuntime?.stance === STANCE_DASH ? DIST_JUMP_SPEED : 0,
          activeRoll && beamRuntime
            ? relicRollSpeedAtTick(player.relics, Math.max(0, beamRuntime.slidePhaseTick - 1))
            : 0,
        );
        const envelope = evaluateClientMovementEnvelope(movement, {
          fromX: movementStartX,
          fromY: movementStartY,
          dtSeconds: dt,
          maxMoveSpeed: movementSpeedBudget,
          maxImpulseSpeed: movementStartImpulse,
        });
        if (
          envelope.accepted &&
          this.clientMovementNavValid(
            player,
            beamRuntime,
            movementStartX,
            movementStartY,
            movement.x,
            movement.y,
          )
        ) {
          input.mvx = movement.mvx;
          input.mvy = movement.mvy;
          player.mvx = movement.mvx;
          player.mvy = movement.mvy;
          this.acceptedClientMovement.set(id, movement);
        } else {
          player.dualWield.movementCorrectionSeq =
            (player.dualWield.movementCorrectionSeq + 1) >>> 0;
        }
      }
    });

    // 2. Resolve body collisions so living players block each other (§5). Authoritative.
    const ids: string[] = [];
    const bodies: Vec2[] = [];
    this.state.players.forEach((player, id) => {
      if (!player.alive) return;
      if (
        player.ultPhase === UltimatePhase.Active &&
        ultimateFamilyForCode(player.ultArchetype) === UltimateFamily.AlphaStrike
      )
        return;
      ids.push(id);
      bodies.push({ x: player.x, y: player.y });
    });
    const bodyBeltX = this.beltLevel ? beltPlayableXBounds(this.beltLevel) : undefined;
    const resolved = resolveBodyCollisions(
      bodies,
      PLAYER_RADIUS,
      2,
      (bodyBeltX?.minX ?? 0) + PLAYER_RADIUS,
      (bodyBeltX?.maxX ?? ARENA_WIDTH) - PLAYER_RADIUS,
    );
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
      const floor = corporateGridFloorForBelt(level);
      // §29 room GATE — a closed gate (beltLockX>0) caps how far right the squad can advance until the
      // room's wave is cleared; else the whole belt is open.
      const rightBound =
        (this.state.beltLockX > 0 ? this.state.beltLockX : level.length) - PLAYER_RADIUS;
      this.state.players.forEach((player) => {
        if (!player.alive) return;
        if (floor) {
          const resolved = resolveBeltNavigation(
            level,
            Math.min(player.x, rightBound),
            player.y,
            PLAYER_RADIUS,
          );
          player.x = Math.min(resolved.x, rightBound);
          player.y = resolved.y;
        } else {
          const o = resolveBeltObstacles(level, player.x, player.y, PLAYER_RADIUS);
          player.x = Math.min(o.x, rightBound);
          player.y = clampBeltFloorY(level, player.x, o.y, PLAYER_RADIUS);
        }
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

    // Accepted client truth wins after the legacy friend-body pass. Reports were swept against navigation
    // above, so this cannot restore a wall/POI/pit clip; it only avoids making co-op friends authority walls.
    for (const [id, movement] of this.acceptedClientMovement) {
      const player = this.state.players.get(id);
      if (!player?.alive || player.dualWield.serverMotionActive) continue;
      player.x = movement.x;
      player.y = movement.y;
    }

    // 2.5 §17 PITFALL — a GROUNDED player whose body is over a pit falls: chip damage + snap back to the
    // last solid tile + a brief grace (i-frames, no re-fall). An AIRBORNE player (mid-jump, §5) clears the
    // gap and is immune. We also remember the last grounded spot here so the snap-back has somewhere to go.
    this.state.players.forEach((player, id) => {
      if (!player.alive) return;
      const c = this.combat.get(id);
      if (!c) return;
      if (c.augmentSnapshot !== player.augments) {
        c.augmentSnapshot = player.augments;
        c.beamVentStacks = countAugment(player.augments, "beam-vent");
        c.beamFocusStacks = countAugment(player.augments, "beam-focus");
      }
      if (c.pitGrace > 0) c.pitGrace = Math.max(0, c.pitGrace - dt);
      if (this.ultimateOwnsMovement(player)) return;
      if (player.height > GROUND_EPSILON || c.vh > 0) return; // airborne distance jump / launch — the vertical sentence carries you over
      // §29 belt PITS — gaps in the deck; grounded-over-a-gap falls (chip + snap back to the edge you came
      // from), a jump clears it. Enemies (which can't jump) get kited in for free kills (5.6 below).
      if (this.belt && this.beltLevel) {
        const level = this.beltLevel;
        if (!beltPitAtX(level, player.x)) {
          c.lastGroundX = player.x;
          return;
        }
        if (c.pitGrace > 0) return;
        this.damagePitFall(player);
        this.placeWithMotionEpoch(player, "pit-snapback", () => {
          player.x = beltSafeX(level, player.x, c.lastGroundX);
          c.lastGroundX = player.x;
          c.pitGrace = PIT_FALL_GRACE;
          this.zeroMoveVel(id, undefined, "pit-snapback");
        });
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
      this.placeWithMotionEpoch(player, "pit-snapback", () => {
        player.x = safe.x;
        player.y = safe.y;
        c.lastGroundX = safe.x;
        c.lastGroundY = safe.y;
        c.pitGrace = PIT_FALL_GRACE;
        this.zeroMoveVel(id, undefined, "pit-snapback"); // §7 the snap-back is a teleport — carried steering would glide you back in
      });
      player.fellSeq++;
    });

    // 2.7 MONEY drops: movement establishes pickup reach first; collection credits the run-money rail.
    // Fresh kills later in this sub-step keep their short readable settle before they can launch.
    this.stepMoneyDrops();
    this.stepVastagharVictory();

    // 3. Run clock + spawn director (§6) — survival mode only. `bodies` = living players.
    if (this.state.mode === "arena") {
      if (this.state.outcome === "active") {
        this.advanceElapsed(dt);
        this.stepChestDirector();
        if (this.belt) {
          // §29 belt: room-gated progression REPLACES the continuous director + boss clock + shifters —
          // walk into a room, the gate locks, clear the wave, the gate opens, advance; the last room = boss.
          if (this.isCorporateLoop()) {
            this.stepCorporateElevator();
            if (this.state.elevatorPhase === CORPORATE_ELEVATOR_PHASE.sealed)
              this.stepBeltRooms(dt, bodies);
          } else {
            this.stepBeltRooms(dt, bodies);
          }
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

    // 3b. Pickups are grabbed with E (§13 `grabWeapon`), not walk-over — here we just age the
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
      c.gunBurstT = Math.max(-dt, c.gunBurstT - dt);
      c.drawLock = Math.max(0, c.drawLock - dt);
      this.stepStowedWeaponResources(player, c, dt);
      c.invuln = Math.max(0, c.invuln - dt);
      c.juggleMercy = Math.max(0, c.juggleMercy - dt); // §51 G10 touchdown mercy ages out
      c.parryCd = Math.max(0, c.parryCd - dt);
      if (!c.mods.parryChainNeverExpires) {
        c.parryChainT = Math.max(0, c.parryChainT - dt);
        if (c.parryChainT <= 0) c.parryChain = 0;
      }
      c.recoveryT = Math.max(0, c.recoveryT - dt);
      c.rollCd = Math.max(0, c.rollCd - dt);
      c.slideParryLockT = Math.max(0, c.slideParryLockT - dt);
      if (c.slideParryLockT <= 1e-9) c.slideParryLockT = 0;
      // §7 v0.105 de-clunk: age the queued-input buffers, then fire any that the cooldown has just cleared.
      c.attackBuffer = Math.max(0, c.attackBuffer - dt);
      c.parryBuffer = Math.max(0, c.parryBuffer - dt);
      const acting =
        this.state.outcome === "active" && player.alive && player.ultPhase === UltimatePhase.Idle;
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
      if (landed) {
        player.relics.airJumpsRemaining = relicJumpCount(player.relics);
        this.finishPlayerLanding(player, c, landingStance, impactVh);
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
      // schema-37 resource slots remain tombstones except for Frostbore's explicit two-shell exception.
      if (c.lastWeapon !== player.weapon) {
        // Direct server-side identity edits (tests/dev setup) restore debt but are not a player quick-swap.
        // Network-reachable swap handlers apply the shared draw gate at the transition edge above.
        this.transitionWeapon(player, c, false, false);
      }

      this.stepHeldBreakActionReload(player, c, weapon, dt);
      this.stepGunBurst(player, c, weapon, acting);

      if (weapon?.performance?.aura) {
        c.attackBuffer = 0;
        this.clearBeamRows(id);
        this.stepPlayerAura(player, id, c, weapon, dt, acting && c.stance !== STANCE_SLIDE);
        return;
      }
      if (weapon?.groundZone?.trigger === "channel") {
        c.attackBuffer = 0;
        this.clearBeamRows(id);
        this.stepPlayerGroundZone(player, id, c, weapon, dt, acting && c.stance !== STANCE_SLIDE);
        return;
      }
      this.activeGroundZones.delete(id);
      this.groundZoneInputWasHeld.set(id, false);
      if (weapon?.beam) {
        c.attackBuffer = 0;
        this.stepPlayerBeam(player, id, c, weapon, dt, acting && c.stance !== STANCE_SLIDE);
        return;
      }
      if (weapon?.chargedProjectile) {
        c.attackBuffer = 0;
        this.clearBeamRows(id);
        this.stepPlayerChargedProjectile(
          player,
          id,
          c,
          weapon,
          acting && c.stance !== STANCE_SLIDE,
        );
        return;
      }
      const nonBeamHeld = this.beamHeld(id);
      if (!nonBeamHeld) c.drive.beamRequireRelease = false;
      c.beamInputWasHeld = nonBeamHeld;
      this.clearBeamRows(id);
      if (weapon?.performance?.continuous && nonBeamHeld && acting && c.stance !== STANCE_SLIDE) {
        // Presentation-only latch refresh: accepted beats still own attackSeq and all damage cadence.
        player.attackTick = this.state.tick;
        player.attackHeld = true;
      }

      // §7 v0.105 de-clunk: a BUFFERED attack is live while its window hasn't decayed; the tick fires it the
      // instant the cooldown drains (a press one tick early is honoured, not eaten), and consuming it zeroes
      // the buffer so it can't double-fire. A held trigger re-arms the buffer each client cooldown.
      const canAct =
        acting && c.stance !== STANCE_SLIDE && c.attackBuffer > 0 && c.cd <= 0 && c.drawLock <= 0;
      // §10 v0.104: the single Terraria affix can speed up / slow down the held weapon (Swift/Heavy…).
      const cdMul = lootCooldownMult(player.weaponAffix);
      if (weapon?.warp) {
        if (canAct) {
          c.attackBuffer = 0;
          const cooldown = weapon.cooldown * cdMul * this.weaponRecoveryMult(player, weapon);
          const interval = effectiveAcceptedWeaponInterval(weapon, cooldown);
          const instanceId = player.slots[player.activeSlot]?.instanceId || weapon.id;
          if (
            this.trySpendWeaponResource(
              player,
              c,
              weapon,
              instanceId,
              CombatDelivery.Warp,
              0,
              interval,
              1,
              0,
              "tap",
            ).accepted
          ) {
            this.stampAttackBeat(player);
            this.detonateWarpAtCursor(player, c, weapon);
            c.cd = cooldown;
          }
        }
      } else if (weapon?.gun) {
        const breakAction = isBreakActionWeapon(weapon);
        if (canAct && (!breakAction || (player.charges > 0 && c.reloadCd <= 0))) {
          c.attackBuffer = 0;
          const cooldown = weapon.gun.fireRate * cdMul * this.weaponRecoveryMult(player, weapon);
          const interval = effectiveAcceptedWeaponInterval(weapon, cooldown);
          const instanceId = player.slots[player.activeSlot]?.instanceId || weapon.id;
          if (
            this.trySpendWeaponResource(
              player,
              c,
              weapon,
              instanceId,
              CombatDelivery.Gun,
              0,
              interval,
              1,
              0,
              "tap",
            ).accepted
          ) {
            this.stampAttackBeat(player);
            this.fireGun(player, c, weapon);
            this.armGunBurst(c, weapon, 0);
            if (breakAction) {
              player.maxCharges = weapon.gun.magazine;
              player.charges = Math.max(0, player.charges - 1);
              if (player.charges === 0) {
                c.reloadCd =
                  weapon.gun.reloadSeconds *
                  (this.petRuns.get(player.id)?.mods.reloadDurationMultiplier ?? 1) *
                  this.weaponRecoveryMult(player, weapon);
                c.cd = c.reloadCd;
              } else {
                c.cd += cooldown;
              }
            } else {
              c.cd += cooldown; // accumulating cadence carries its sub-tick remainder
            }
          }
        }
      } else if (weapon?.thrown) {
        if (canAct) {
          c.attackBuffer = 0;
          const cooldown = weapon.cooldown * cdMul * this.weaponRecoveryMult(player, weapon);
          const interval = effectiveAcceptedWeaponInterval(weapon, cooldown);
          const instanceId = player.slots[player.activeSlot]?.instanceId || weapon.id;
          if (
            this.trySpendWeaponResource(
              player,
              c,
              weapon,
              instanceId,
              CombatDelivery.Thrown,
              0,
              interval,
              1,
              0,
              "tap",
            ).accepted
          ) {
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
          if (
            this.trySpendWeaponResource(
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
            ).accepted
          ) {
            this.stampAttackBeat(player);
            this.fireCast(player, c, weapon);
            c.cd = cooldown;
          }
        }
      } else if (weapon && canAct) {
        if (
          weapon.hybridProjectile ||
          weapon.glovePair?.wrapsFeet === true ||
          weapon.comboVariant === "wyrmscale-inferno-talons" ||
          weapon.strikeOverlayPart !== undefined
        ) {
          this.resolveSingleWeaponAttack(player, c);
          return;
        }
        c.attackBuffer = 0;
        // §44 AUTHORITATIVE EPOCH: construct exactly once when `canAct` accepts — never on message arrival.
        // Client prediction starts from local send until a later swing-seq protocol can reconcile buffering.
        const swing = swingDescriptorFor(
          weapon,
          weapon.cooldown * cdMul * this.weaponRecoveryMult(player, weapon),
        );
        const interval = effectiveAcceptedWeaponInterval(weapon, swing.effectiveCooldown);
        const instanceId = player.slots[player.activeSlot]?.instanceId || weapon.id;
        if (
          this.trySpendWeaponResource(
            player,
            c,
            weapon,
            instanceId,
            CombatDelivery.Melee,
            0,
            interval,
            1,
            0,
            "tap",
          ).accepted
        ) {
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
        if (q.zoneDamagePerSecond !== undefined) {
          const owner = this.state.players.get(q.sourcePlayerId);
          const weapon = WEAPONS[q.sourceWeaponId];
          if (owner && weapon?.groundZone?.trigger === "impact") {
            this.spawnWeaponGroundZoneAt(owner, weapon, q.x, q.y, q.zoneDamagePerSecond, q.crit);
          }
        }
        this.pendingQuakes.splice(i, 1);
      }
    }
    for (let i = this.pendingScatterVolleys.length - 1; i >= 0; i--) {
      const volley = this.pendingScatterVolleys[i];
      if (!volley) continue;
      volley.t -= dt;
      if (volley.t <= 0) {
        this.emitScatterVolley(volley);
        this.pendingScatterVolleys.splice(i, 1);
      }
    }
    for (let i = this.pendingWeaponThrows.length - 1; i >= 0; i--) {
      const pending = this.pendingWeaponThrows[i];
      if (!pending) continue;
      pending.t -= dt;
      if (pending.t > 0) continue;
      const player = this.state.players.get(pending.playerId);
      if (player?.alive) this.emitWeaponThrow(pending, player.x, player.y);
      this.pendingWeaponThrows.splice(i, 1);
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
      const zoneSlow = this.enemyGroundZoneSlow(id);
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
          const rollSpeed = (kind.dodge.distance / kind.dodge.duration) * zoneSlow;
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
            kind.speed * zoneSlow,
            kind.ranged.preferredRange,
            dt,
          )
        : stepEnemyChase({ x: enemy.x, y: enemy.y }, target, kind.speed * zoneSlow, dt);
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
    // B3 fan payloads are authored at the melee impact epoch, but enter the shared projectile rail
    // after this tick's projectile pass. That preserves melee-before-projectile authority and guarantees
    // the replicated row exists for one patch before a point-blank swept collision can consume it.
    for (let i = this.pendingHybridProjectiles.length - 1; i >= 0; i--) {
      const pending = this.pendingHybridProjectiles[i];
      if (!pending) continue;
      pending.t -= dt;
      if (pending.t > 0) continue;
      this.emitHybridProjectile(pending);
      this.pendingHybridProjectiles.splice(i, 1);
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
      const floor = corporateGridFloorForBelt(level);
      this.state.enemies.forEach((enemy, eid) => {
        const er = ENEMY_KINDS[enemy.kind]?.radius ?? ENEMY_RADIUS;
        if (floor) {
          const resolved = resolveBeltNavigation(level, enemy.x, enemy.y, er);
          enemy.x = resolved.x;
          enemy.y = resolved.y;
        } else if (eid !== this.bossId) {
          const o = resolveBeltObstacles(level, enemy.x, enemy.y, er); // boss crushes through obstacles
          enemy.x = o.x;
          enemy.y = o.y;
          enemy.y = clampBeltFloorY(level, enemy.x, enemy.y, er);
        } else {
          enemy.y = clampBeltFloorY(level, enemy.x, enemy.y, er);
        }
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
    // Terrain kills are free crowd control. §29 belt uses the authored pit x-ranges.
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
      if (combo?.tg) this.removeTelegraphRow(combo.tg);
      this.meleeAttackTokens.releaseHolder(eid);
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
      )
        return;
      const kind = ENEMY_KINDS[enemy.kind];
      if (!kind) return;
      if (effectiveMelee(kind)) return; // B33 melee damage is delivered only by committed attacks.
      this.state.players.forEach((player) => {
        if (!player.alive) return;
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
            Math.abs(dy) <= DEPTH_TOL_ENEMY * (Math.abs(player.vy) > 40 ? DEPTH_DODGE_MULT : 1)
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
            this.beginServerMotion(player, SERVER_MOTION_IMPULSE_TICKS, "enemy-contact-hit");
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
        const relicRevive = resolveRelicRevive(
          player.maxHp,
          hasRareRelic(player.relics.ownedRare, "revive"),
          player.relics.reviveAvailable,
        );
        if (relicRevive.revived) {
          player.relics.reviveAvailable = relicRevive.available;
          player.hp = relicRevive.hp;
          player.revivedSeq = (player.revivedSeq + 1) % 100000;
          player.alive = true;
          this.zeroMoveVel(player.id, undefined, "revive-placement");
          this.clearEnemiesNear(player.x, player.y, RESPAWN_CLEAR_RADIUS);
          this.sendOwnerMessage(player.id, "relicTriggered", { id: "revive" });
          anyAlive = true;
          return;
        }
        player.alive = false; // DOWNED
        this.meleeAttackTokens.releaseTarget(player.id);
        if (this.vastagharEncounter) this.vastagharDownTicks.set(player.id, this.state.tick);
        return;
      }
      anyAlive = true;
      const combat = this.combat.get(player.id);
      const pet = this.petRuns.get(player.id);
      const pitRegenMultiplier =
        pet && pet.tortoisePitRegenSeconds > 0 ? pet.mods.pitRegenMultiplier : 1;
      const regen =
        (PLAYER_REGEN + relicHpRegenAdd(player.relics)) *
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
      this.enterTerminalOutcome("defeat");
      return;
    }

    // §8 Conflagration: fire any deferred burn re-pulses whose delay has elapsed (the "lingering" wave).
    for (let i = this.burnPulses.length - 1; i >= 0; i--) {
      const p = this.burnPulses[i];
      if (p && this.state.elapsed >= p.at) {
        this.emberguardWave(p.x, p.y, p.aimX, p.aimY, p.dmg, 0, p.sourcePlayerId, p.sourceWeaponId);
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
  },

  /** End every threat before the first celebration patch; player clocks/position remain untouched. */
  beginVastagharClear(this: GameRoomContext, x: number, y: number): void {
    const encounter = this.vastagharEncounter;
    if (!encounter || encounter.state.mode === VastagharMode.Victory) return;
    encounter.beginVictory(this.state.tick, this.bossSink);
    this.vastagharVictoryX = x;
    this.vastagharVictoryY = y;
    this.vastagharVictoryReadyTick = (this.state.tick + 40) >>> 0;
    this.vastagharVictoryMode = this.state.mode === "bossrush" ? "bossrush" : "arena";
    this.vastagharMoneyAwarded = false;
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
    this.activeGroundZones.clear();
    this.groundZoneInputWasHeld.clear();
    this.enemyZoneSlow.clear();
    this.enemyFireCd.clear();
    this.zonerDropCd.clear();
    this.comboState.clear();
    this.meleeAttackTokens.clear();
    this.duelTokens.clear();
    this.dodgeState.clear();
    this.poundEnemyEffects.clear();
    this.ultimateStunUntil.clear();
    this.ultimateBrands.clear();
    this.bossAddIds.clear();
    this.bossAddExpireTick.clear();
    this.state.telegraphs.clear();
  },

  /** Advance the authoritative collapse, then open the ordinary reward route without minting boss loot. */
  stepVastagharVictory(this: GameRoomContext): void {
    const encounter = this.vastagharEncounter;
    if (!encounter || encounter.state.mode !== VastagharMode.Victory) return;
    if (encounter.advanceVictory(this.state.tick)) this.completeVastagharVictoryPresentation();
    if (this.vastagharMoneyAwarded && ((this.state.tick - this.vastagharVictoryReadyTick) | 0) >= 0)
      this.completeRewardBoundary("boss-clear");
  },

  /** B20 L2: preserve the collapse beat but retire the old boss-money itemization channel. */
  completeVastagharVictoryPresentation(this: GameRoomContext): void {
    const encounter = this.vastagharEncounter;
    if (!encounter || this.vastagharMoneyAwarded) return;
    this.vastagharMoneyAwarded = true;
    this.vastagharVictoryReadyTick = this.state.tick;
    encounter.setVictoryMoney(0);
  },

  completeVastagharClear(this: GameRoomContext): void {
    const encounter = this.vastagharEncounter;
    if (!encounter) return;
    this.state.players.forEach((player) => {
      if (player.alive) return;
      player.alive = true;
      player.hp = Math.max(1, Math.round(player.maxHp * REVIVE_HP_FRAC));
      player.revivedSeq = (player.revivedSeq + 1) % 100000;
      this.zeroMoveVel(player.id, undefined, "revive-placement");
      this.vastagharDownTicks.delete(player.id);
    });
    encounter.markRewardsOpen(this.state.tick);
    this.state.bossKind = "";
    if (this.vastagharVictoryMode === "bossrush") {
      this.advanceBossRush();
    } else {
      this.openPortal(this.vastagharVictoryX, this.vastagharVictoryY);
    }
    this.vastagharVictoryMode = "";
  },

  /** Committed transitions conserve every uncollected money row before teardown. */
  completeRewardBoundary(this: GameRoomContext, kind: RewardBoundary): void {
    this.drainMoneyDrops();
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
  },
  completeExtraction(this: GameRoomContext): void {
    this.state.riftOpen = false;
    this.enterTerminalOutcome("victory");
    console.log(`[room ${this.roomId}] run extracted at depth ${this.state.depth} — VICTORY`);
  },

  completeBossRushVictory(this: GameRoomContext): void {
    this.enterTerminalOutcome("victory");
    console.log(
      `[room ${this.roomId}] BOSS RUSH cleared all ${BOSS_DEF_IDS.length} bosses — VICTORY`,
    );
  },

  /** §29 belt ROOM state machine — walk into a room → the gate locks + its wave spawns → clear it → the gate
   *  opens → advance; the last room drops the boss, and clearing it wins the run. Server-authoritative + the
   *  lock x syncs so every client's camera + the gate render agree. */
  positionCorporateParty(this: GameRoomContext, atExit: boolean, bumpTeleport = true): void {
    const level = this.beltLevel;
    const floor = level ? corporateGridFloorForBelt(level) : undefined;
    if (!level || !floor) return;
    const marker = floor.elevatorMarkers[atExit ? 2 : 0];
    const spawn = floor.playerSpawns[0];
    if (!marker || !spawn) return;
    let ordinal = 0;
    this.state.players.forEach((player, id) => {
      const scatter = atExit ? 0 : (Math.ceil(ordinal / 2) * (ordinal % 2 ? 1 : -1)) * 36;
      const targetX = atExit ? marker.x - 90 : spawn.x + scatter;
      const resolved = resolveBeltNavigation(level, targetX, BELT_Y0 + spawn.y, PLAYER_RADIUS);
      const ticksLeft = atExit
        ? Math.max(0, (this.state.elevatorDeadlineTick - this.state.tick) | 0)
        : CORPORATE_ELEVATOR_ARRIVAL_TICKS;
      // Departure reasserts the car point every tick and arrival immediately follows it. Keep those
      // writes inside one ownership epoch; repeated holds are not fresh teleports/corrections.
      this.placeWithMotionEpoch(
        player,
        "elevator-boarding",
        () => {
          player.x = resolved.x;
          player.y = resolved.y;
          player.vx = 0;
          player.vy = 0;
          player.height = 0;
          const combat = this.combat.get(id);
          if (combat) {
            combat.lastGroundX = player.x;
            combat.lastGroundY = player.y;
            combat.pitGrace = 0;
          }
          this.zeroMoveVel(id, bumpTeleport, "elevator-boarding");
        },
        ticksLeft + 1,
      );
      ordinal++;
    });
  },

  transitionCorporateFloor(this: GameRoomContext): void {
    const nextDepth = Math.max(1, (this.state.corporateFloorDepth + 1) >>> 0);
    this.state.enemies.clear();
    this.state.projectiles.clear();
    this.state.zones.clear();
    this.state.pickups.clear();
    this.clearTransients();
    this.installCorporateFloor(nextDepth, CORPORATE_ELEVATOR_PHASE.arriving);
    this.state.elevatorDeadlineTick =
      (this.state.tick + CORPORATE_ELEVATOR_ARRIVAL_TICKS) >>> 0;
    this.state.beltRoomName = `Floor ${nextDepth}`;
    this.positionCorporateParty(false);

    // B20 state stays run-scoped. Existing money/chest rows are retained but moved inside the new crop;
    // player scrip, relic rows, arsenal, HP, and the run clock are deliberately untouched.
    const level = this.beltLevel;
    if (level) {
      this.state.moneyDrops.forEach((drop) => {
        const placed = resolveBeltNavigation(level, drop.x, drop.y, 0);
        drop.x = placed.x;
        drop.y = placed.y;
      });
      this.state.chests.forEach((chest) => {
        const placed = resolveBeltNavigation(level, chest.x, chest.y, 0);
        chest.x = placed.x;
        chest.y = placed.y;
      });
    }
  },

  /** Owner-locked B34 transition: one player commits, the whole room rides, and no body stays behind. */
  stepCorporateElevator(this: GameRoomContext): void {
    if (!this.isCorporateLoop()) return;
    const phase = this.state.elevatorPhase;
    if (phase === CORPORATE_ELEVATOR_PHASE.countdown) {
      const ticksLeft = (this.state.elevatorDeadlineTick - this.state.tick) >>> 0;
      this.state.beltRoomName = `Elevator departing in ${Math.max(1, Math.ceil(ticksLeft / 20))}`;
      if (this.state.tick < this.state.elevatorDeadlineTick) return;
      this.state.elevatorPhase = CORPORATE_ELEVATOR_PHASE.departing;
      this.state.elevatorDeadlineTick =
        (this.state.tick + CORPORATE_ELEVATOR_DEPART_TICKS) >>> 0;
      this.state.beltRoomName = "Elevator departing";
      this.positionCorporateParty(true);
      return;
    }
    if (phase === CORPORATE_ELEVATOR_PHASE.departing) {
      // Re-assert the car position through the short fade so a queued movement command cannot peel a
      // straggler back out after the server has committed the party transition.
      this.positionCorporateParty(true, false);
      if (this.state.tick >= this.state.elevatorDeadlineTick) this.transitionCorporateFloor();
      return;
    }
    if (
      phase === CORPORATE_ELEVATOR_PHASE.arriving &&
      this.state.tick >= this.state.elevatorDeadlineTick
    ) {
      this.state.elevatorPhase = CORPORATE_ELEVATOR_PHASE.sealed;
      this.state.elevatorDeadlineTick = 0;
      this.state.beltRoomName = "";
    }
  },

  stepBeltRooms(this: GameRoomContext, _dt: number, bodies: Vec2[]): void {
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
        if (room.boss) this.completeRewardBoundary("belt-victory");
        else if (this.isCorporateLoop() && this.beltRoomIdx === level.rooms.length - 1) {
          this.state.elevatorPhase = CORPORATE_ELEVATOR_PHASE.ready;
          this.state.elevatorDeadlineTick = 0;
          this.state.beltRoomName = "Elevator ready";
        }
      }
    } else {
      // cleared → advance when a player crosses the (now-open) gate.
      if (!room.boss && bodies.some((b) => b.x >= room.gateX)) {
        this.beltRoomIdx++;
        this.beltPhase = "enter";
        this.state.beltRoomName = "";
      }
    }
  },

  /** Open the extraction portal where the boss fell (§16). */
  /** §17 mint fresh map seeds + regenerate the server's arena from them (the client mirrors via the
   *  synced seeds). Called at room create, on every §6 rift descent, and on run restart. */
  mintMap(this: GameRoomContext): void {
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
    this.resetChestDirector();
  },

  /** §6 the boss falls → open BOTH gates of the greed decision: the amber EXTRACTION portal (bank 100% of
   *  run money and end in victory) and the violet DEEPER rift (descend to depth+1 — harder, richer).
   *  QOL-03 solves them jointly as reachable, full-footprint safe discs with protected separation. */
  openPortal(this: GameRoomContext, x: number, y: number): void {
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
  },

  resetExtractionIntent(this: GameRoomContext): void {
    this.extractArmTimer = -1;
    this.extractHoldTimer = 0;
    this.extractBlocked.clear();
  },

  /** §6 rift descent (v0.103, the chain): depth+1, a NEW dimension + freshly-seeded map, the same squad —
   *  levels/attributes/weapons/augments/run money/HP all persist (that's the greed: you push in
   *  whatever shape the last fight left you). The field is cleared, the clock and boss director reset. */
  transitionDimension(this: GameRoomContext): void {
    // Normal descent reaches this only after the cleanup vacuum; defensive cleanup prevents stale rows if a
    // server operator invokes the transition directly during recovery/testing.
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
      this.placeWithMotionEpoch(player, "teleport-placement", () => {
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
          c.parryGuardCycles.clear();
        }
        const descentHeal = this.petRuns.get(id)?.mods.descentHealMaxHpFraction ?? 0;
        if (descentHeal > 0) this.applyHeal(player, player.maxHp * descentHeal, false);
        this.zeroMoveVel(id, undefined, "teleport-placement"); // §7 the descent repositions the body — momentum doesn't cross dimensions
      });
    });
    console.log(
      `[room ${this.roomId}] ⇓ rift descent — depth ${this.state.depth}, dimension ${this.state.dimensionId}`,
    );
  },

  /** QOL-01 extraction is a deliberate post-reward choice: stabilise, block every body carried through the
   *  arming edge until it leaves, then require a short uninterrupted fresh spatial hold. Direct state-only
   *  test/dev gates retain the legacy immediate seam (`extractArmTimer < 0`); production gates all enter via
   *  `openPortal` and can never use it. */
  checkExtraction(this: GameRoomContext, bodies: Vec2[], dt = TICK_MS / 1000): void {
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
      if (reached) this.completeRewardBoundary("extract");
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
      this.completeRewardBoundary("extract");
  },

  /** §6 the other half of the greed decision (v0.103): the DEEPER rift is a CHANNEL — a living player
   *  must HOLD it for RIFT_CHANNEL_SECONDS (the synced `riftCharge` fills 0→1, drawn by the client) before
   *  the whole squad commits. Leaving the ring drains the charge — one misstep or one griefer can't yank
   *  four players into depth+1. Extraction stays instant (it's the benign direction). */
  checkDescend(this: GameRoomContext, dt: number, bodies: Vec2[]): void {
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
        this.completeRewardBoundary("descent");
      }
    } else if (this.state.riftCharge > 0) {
      this.state.riftCharge = Math.max(0, this.state.riftCharge - (dt / RIFT_CHANNEL_SECONDS) * 2);
    }
  },
} satisfies ThisType<GameRoomContext>;
