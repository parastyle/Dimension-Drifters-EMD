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
  corporateGridFloorForBelt,
  bladeAngleAt,
  bladeExtensionPoseAt,
  bladeHitsCircle,
  bladeHitsCircleXY,
  bossDefFor,
  bossSpawnAt,
  CAST_VOLLEY_PROJECTILE_CAP,
  type CarrySelectionV1,
  CHAIN_MAX_RANGE,
  CHEST_OPEN_RADIUS,
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
  serverSeededGunPelletVolley,
  shortestAngleDelta,
  slideContactInvulnerable,
  spawnInterval,
  stepBeamAngle,
  stepEnemyChase,
  stepEnemyKite,
  stepImpulse,
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
import { SpatialGrid } from "./SpatialGrid.js";

/** §51 duel-token courtesy distance: a combo tough whose victim is already CLAIMED holds a visible
 *  ring-out orbit here instead of stacking a second unreadable choreography (G12 crossfire law). */
const COMBO_RINGOUT_ORBIT = 260;
/** §51 the riposte stagger normalised onto tick anchors (the legacy machine's 1s, in 50ms ticks). */
const COMBO_RIPOSTE_STAGGER_TICKS = 20;
/** Shared immutable no-input sample for rooted stance movement; avoids a fresh object in the 20Hz loop. */
const ZERO_MOVE_INPUT = { dx: 0, dy: 0 } as const;
const ZERO_IMPULSE = { vx: 0, vy: 0 } as const;
const tickReached = (now: number, target: number): boolean => ((now - target) | 0) >= 0;
const ticksFromSeconds = (seconds: number): number =>
  Math.max(1, Math.round((seconds * 1000) / TICK_MS));

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

function pointInConvexQuadrilateral(
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
function pointSweptUprightCapsuleDistanceSq(
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
  traversalEdgeBudget: number;
  lastFreshFireTick: number;
  /** §44 per-tick budget for ACTION messages (attack/parry/grab/cycle/…) — the input budget's sibling,
   *  so a modified client can't monopolize the event loop with non-movement RPCs between ticks. */
  actionBudget: number;
  mvx: number;
  mvy: number;
}

interface WeaponResourceLedger {
  cooldown: number;
  reload: number;
  charges: number;
}

type WeaponSpendReason = "tap" | "beam-ignite" | "beam-active" | "beam-cancel" | "aura-active";

const GROUND_ZONE_ENTITY_CAP = 48;
const GROUND_ZONE_OWNER_CAP = 4;

interface ZoneRuntime {
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

interface WeaponSpendResult {
  accepted: boolean;
  debit: number;
  beamEmpty: boolean;
}

interface PendingScatterVolley {
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
  kind: string;
}

/** B3 accepted fan beat waiting for its melee impact epoch before the real projectile is emitted. */
interface PendingHybridProjectile {
  t: number;
  playerId: string;
  weaponId: string;
  aimX: number;
  aimY: number;
  damage: number;
  crit: number;
}

/** One accepted authored lunge per player. A Map hard-caps this transient at MAX_PLAYERS. */
interface PendingWeaponLunge {
  t: number;
  playerId: string;
  weaponId: string;
  aimX: number;
  aimY: number;
  distancePx: number;
  durationSeconds: number;
  invulnerable: boolean;
  impactAtDestination: boolean;
  destinationQuake?: {
    radius: number;
    damage: number;
    crit: number;
    zoneDamagePerSecond?: number;
  };
  elapsedSeconds?: number;
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
}

/** A committed thrown beat whose authored in-hand draw must finish before projectile release. */
interface PendingWeaponThrow {
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
  arcHeight?: number;
  returning?: boolean;
}

interface ActiveMeleeSwing {
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
  waitForWeaponLunge?: boolean;
  originX?: number;
  originY?: number;
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
type WeaponHand = 0 | 1;

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
  /** Exclusive tick bound for weapon-lunge i-frames. Kept separate so they never count as a parry. */
  weaponLungeIFrameUntilTick: number;
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
interface DuelistComboState {
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

type RewardBoundary = "extract" | "descent" | "belt-victory" | "bossrush-victory" | "boss-clear";

export interface WeaponComboForwardDrift {
  readonly distancePx: number;
  readonly durationSeconds: number;
}

export interface WeaponComboRootMotion {
  readonly forwardPx: number;
  readonly lateralPx: number;
  readonly durationSeconds: number;
}

/** Resolve authored character displacement from the same combo index that owns damage and presentation. */
export function weaponComboRootMotion(
  weapon: Readonly<WeaponDef>,
  comboStepIndex: number | undefined,
): WeaponComboRootMotion | undefined {
  const sequence = meleeComboSelectionFor(weapon)?.sequence;
  if (!sequence?.length) return undefined;
  const step = Math.max(0, Math.trunc(comboStepIndex ?? 0)) % sequence.length;
  return sequence[step]?.rootMotion;
}

/** Resolve one accepted combo beat's server-owned walking displacement. Most weapons keep one fixed
 * drift; authored martial sequences may vary the same bounded movement by beat without client inference. */
export function weaponComboForwardDrift(
  weapon: Readonly<WeaponDef>,
  comboStepIndex: number | undefined,
): WeaponComboForwardDrift | undefined {
  const drift = weapon.performance?.forwardDrift;
  if (!drift) return undefined;
  const step = Math.max(0, Math.trunc(comboStepIndex ?? 0));
  const multiplier = drift.comboStepMultipliers?.[step] ?? 1;
  return {
    distancePx: drift.speedPxPerSecond * drift.durationSeconds * multiplier,
    durationSeconds: drift.durationSeconds,
  };
}

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
  /** One allocation-free muzzle seam shared by charge sync, live collision, and replicated geometry. */
  private readonly beamMuzzleScratch = { x: 0, y: 0 };
  /** Tick-local launch markers defer only the first dash displacement while height/pit immunity begin now. */
  private readonly distanceJumpLaunches = new Set<string>();
  private readonly inputs = new Map<string, InputState>();
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
  /** Accepted punch lunges waiting for active start; final displacement is validated by server navigation. */
  private readonly pendingWeaponLunges = new Map<string, PendingWeaponLunge>();
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
    this.activeGroundZones.clear();
    this.groundZoneInputWasHeld.clear();
    this.enemyZoneSlow.clear();
    this.comboState.clear();
    this.meleeAttackTokens.clear();
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
    this.pendingWeaponLunges.clear();
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
  }

  /** §6 terminal combat teardown shared by wipes and every victory route. Pickups/player state remain for the
   *  result screen; all damage-producing bodies and their non-synced machines are retired together. */
  private clearCombatEntities(): void {
    this.clearBoss();
    this.state.enemies.clear();
    this.state.projectiles.clear();
    this.state.zones.clear();
    this.clearTransients();
    this.resetChestDirector();
  }

  /** §6 enter a terminal result exactly once through the full combat teardown path. */
  private enterTerminalOutcome(outcome: "defeat" | "victory"): void {
    this.settleMetaAccounts(outcome);
    if (outcome === "defeat") this.state.moneyDrops.clear();
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
  }

  // ── §29 v0.118 ARSENAL helpers: the held weapon is the ACTIVE slot's live mirror; these keep the slots
  // array in sync and move weapons between hand / slots / bag. ──
  /** Copy one stored weapon into another (or clear `dst` when `src` is null). */
  /** Initialize a never-drawn stored weapon exactly once. Rebinding a ready row never grants resources. */
  private weaponEntryDisassemblyValue(entry: WeaponBankEntryV1): number {
    return weaponEntryInstances(entry).reduce(
      (total, instance) => total + weaponDisassemblyValue(instance.weaponId),
      0,
    );
  }

  private canDisassembleFloorPickup(player: PlayerState, pickup: PickupState): boolean {
    if (!pickup.disassemblable || (this.pickupGrace.get(pickup.id) ?? 0) > 0) return false;
    if (pickup.ownerId && pickup.ownerId !== player.id) return false;
    const bankMeta = this.pickupWeaponBankMeta.get(pickup.id);
    if (bankMeta?.ownerId && bankMeta.ownerId !== player.id) return false;
    const radius = Math.max(
      PICKUP_RADIUS,
      this.petRuns.get(player.id)?.mods.earnedPickupRadius ?? 0,
    );
    return (pickup.x - player.x) ** 2 + (pickup.y - player.y) ** 2 <= radius * radius;
  }

  private clearFloorPickup(pickupId: string): void {
    this.state.pickups.delete(pickupId);
    this.pickupGrace.delete(pickupId);
    const eligibilityChanged = this.earnedPickups.delete(pickupId);
    this.pickupWeaponBankMeta.delete(pickupId);
    for (const [playerId, intent] of this.floorDisassemblyIntents) {
      if (intent.pickupId === pickupId) this.floorDisassemblyIntents.delete(playerId);
    }
    if (eligibilityChanged) this.publishPetPickupEligibility();
  }

  private disassembleFloorPickup(player: PlayerState, pickup: PickupState): void {
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
  }

  private disassembleBagPickup(player: PlayerState, index: number): void {
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
  }

  private initializeStoredWeaponResource(player: PlayerState, slot: ArsenalSlot): void {
    if (slot.resourceReady && slot.resourceWeapon === slot.weapon) return;
    slot.resourceWeapon = slot.weapon;
    slot.resourceReady = true;
    slot.cooldown = 0;
    slot.reload = 0;
    slot.resourceCharges = 0;
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
    dst.bankProvenance = src?.bankProvenance ?? "";
    dst.sourceWorldTier = src?.sourceWorldTier ?? 0;
    dst.homeIssue = src?.homeIssue ?? false;
  }

  private mintWeaponOpaqueId(prefix: "wi"): string {
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
  private materializeWeaponRun(player: PlayerState, account: MetaAccountV5): void {
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
  }

  private createWeaponRun(playerId: string, account: MetaAccountV5): RunWeaponLedger | undefined {
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
  }

  private sendWeaponManifest(player: PlayerState): void {
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
  }

  private bagCapacity(player: PlayerState): number {
    return BAG_CAP + (this.petRuns.get(player.id)?.mods.bagCapacityAdd ?? 0);
  }

  private resetChestDirector(): void {
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
  }

  private stepChestDirector(): void {
    if (
      this.belt ||
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
      const placement = placeChestOnArena(
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
  }

  private refreshChestOpened(chest: ChestState): void {
    let opened = this.state.players.size > 0;
    this.state.players.forEach((_player, id) => {
      if (!chest.openedBy.get(id)) opened = false;
    });
    chest.opened = opened;
  }

  private refreshAllChestOpened(): void {
    this.state.chests.forEach((chest) => {
      this.refreshChestOpened(chest);
    });
  }

  private chestWeaponBagSlot(player: PlayerState): ArsenalSlot | undefined {
    for (const slot of player.bag) if (!slot.weapon) return slot;
    if (player.bag.length >= this.bagCapacity(player)) return undefined;
    const slot = new ArsenalSlot();
    player.bag.push(slot);
    return slot;
  }

  private grantChestWeapon(player: PlayerState, weaponId: string): boolean {
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
  }

  private dropChestWeapon(player: PlayerState, chest: ChestState, weaponId: string): boolean {
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
  }

  private maybeDropEnemyWeapon(enemy: EnemyState, kind: EnemyKind): void {
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
  }

  private grantCommonRelic(player: PlayerState, id: CommonRelicId): number {
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
  }

  private grantRareRelic(player: PlayerState, id: RareRelicId): number {
    const relics = player.relics;
    if (hasRareRelic(relics.ownedRare, id)) return 1;
    relics.ownedRare = appendRareRelic(relics.ownedRare, id);
    if (id.startsWith("dodge-")) relics.activeDodge = id;
    if (id === "revive") relics.reviveAvailable = true;
    return 1;
  }

  private openChestForPlayer(playerId: string, chestId: string): void {
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
  }

  /** Persist only the active weapon instance's cadence debt before identity changes. */
  private saveWeaponResource(player: PlayerState, c: CombatState): void {
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
  }

  /** Restore a weapon's own debt. Only a genuinely new pickup may initialize a fresh resource row. */
  private restoreWeaponResource(
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
  }

  private transitionWeapon(
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
  }

  /** Frostbore's two-shell exception reuses the retained private reload/resource row. The row advances on
   * the fixed simulation clock and mirrors only its two public counters for deterministic remote posing. */
  private stepHeldBreakActionReload(
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
  }

  /** Stowed debts progress normally; swapping changes identity, never the passage of time. */
  private stepStowedWeaponResources(player: PlayerState, c: CombatState, dt: number): void {
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
  }

  private stepStoredSlot(player: PlayerState, slot: ArsenalSlot, dt: number): void {
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
  }

  /** Stat-free held damage multiplier. Authored source damage is modified only by the held weapon's
   * non-stat factors: loot identity, weapon-set bonus, and runtime effects. */
  private heldDamageMult(weapon: WeaponDef, player: PlayerState, _hand: WeaponHand = 0): number {
    const c = this.combat.get(player.id);
    return (
      lootDamageMult(player.weaponRarity, player.weaponAffix) *
      weaponSetBonus(this.loadoutIds(player), weapon.id) * // §30 class set-bonus (2/3-of-a-class)
      (c?.mods.outgoingWeaponDamageMult ?? 1)
    );
  }

  /** One audited recovery seam for held, cast, gun, thrown, beam, and stored cooldown debt. */
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

  private heldCastDamageMult(weapon: WeaponDef, player: PlayerState, hand: WeaponHand = 0): number {
    return this.heldDamageMult(weapon, player, hand);
  }

  /** Capture the cosmetic character as flavor-only run identity. */
  private snapshotRunCharacter(
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
  }

  /** Install one validated, catalog-derived wardrobe snapshot without applying numeric stats. */
  private snapshotGearRun(
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
  private applyQuirkEffects(
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

  private bumpAccountRevision(account: MetaAccountV5): void {
    account.revision = Math.min(META_ACCOUNT_REVISION_MAX, account.revision + 1);
  }

  /** New run/ready boundary: only the pet identity and presentation band enter public run state. */
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
    )
      return;
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
    )
      return;
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
      )
        return;
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

  private rollSlateTortoise(account: MetaAccountV5, outcome: "defeat" | "victory"): boolean {
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

  /** One idempotent account commit for pets, money, and exact weapon escrow on every terminal route. */
  private settleMetaAccounts(outcome: "defeat" | "victory"): void {
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
  }

  /** Explicit event/intermission heal; passive regen, revive HP, meta headroom and Hearth's own 15% use
   * their dedicated paths. The receiver's selected pet owns the multiplier. */
  private applyHeal(
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
  }

  /** Switch between survival ("arena") and Testing Grounds ("training", §21). */
  private toggleTraining(abandoningPlayerId = this.hostId ?? ""): void {
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

  /** §31 full browsable ACTIVE roster. Archived ids remain canonical but have no showroom page. */
  /** §41 the showroom roster, ORGANIZED: class → family → name, so every page reads as a coherent shelf
   *  ("all the melee axes together") instead of concept-file order. Stable + deterministic. */
  private static readonly GALLERY_ROSTER: readonly string[] = [...ACTIVE_WEAPON_CATALOG_IDS].sort(
    (a, b) => {
      const wa = WEAPONS[a];
      const wb = WEAPONS[b];
      const c = (wa?.tags?.classPool ?? "").localeCompare(wb?.tags?.classPool ?? "");
      if (c !== 0) return c;
      const f = (wa?.tags?.family ?? "").localeCompare(wb?.tags?.family ?? "");
      if (f !== 0) return f;
      return (wa?.name ?? a).localeCompare(wb?.name ?? b);
    },
  );
  private static readonly GALLERY_PAGE = 42; // weapons per page (14×3 grid) — comfortably performant
  private galleryPage = 0;

  /** §31 (re)spawn the current showroom PAGE: clear the gallery pickups (`pk*`) and lay out this page's
   *  slice of GALLERY_ROSTER in a grid above the player. Wraps the page index. Training mode only.
   *  §41 cells keep their EXACT grid position — a cell over a pit/POI is SKIPPED (the shelf shows a gap)
   *  instead of safeSpawnPos NUDGING it: the old nudge scattered the neat grid and piled pickups onto their
   *  neighbours, so E grabbed "the wrong thing" and pages read as disorganized. */
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
      // Page-scoped ids make both the renderer and grab RPC identity-stable. Reusing `pk0…pk41` caused the
      // client to retain the previous page's art while these same ids changed weapon underneath it.
      pk.id = `pk:${this.galleryPage + 1}:${pages}:${i}:${weaponId}`;
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
      weaponLungeIFrameUntilTick: 0,
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
  }

  override onLeave(client: Client): void {
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
    this.combat.delete(client.sessionId);
    this.debugCommitDefense.delete(client.sessionId);
    this.debugAttackMoveCapture.delete(client.sessionId);
    // Transport loss is not a terminal weapon result. Account, pet accrual, exact escrow, and the private
    // body/debt snapshot remain reserved; accepted extraction/wipe settles them even while disconnected.
    // Host left → hand off to whoever's still here (or null if the room's now empty).
    if (client.sessionId === this.hostId) {
      const next = this.state.players.keys().next();
      this.hostId = next.done ? null : next.value;
    }
    console.log(`[room ${this.roomId}] -leave ${client.sessionId} (${this.clients.length} online)`);
  }

  /** Explicit encounter/modal hook. Auto remains the default; callers never write Drive or regenMode. */
  setWeaponResourceRegenOverride(playerId: string, mode: "auto" | "paused" | "forceEngaged"): void {
    const drive = this.combat.get(playerId)?.drive;
    if (!drive) return;
    drive.simulationPaused = mode === "paused";
    drive.forceEngaged = mode === "forceEngaged";
  }

  private drivePendingValue(player: PlayerState, c: CombatState): number {
    return Math.max(
      0,
      Math.min(
        relicEnergyCapacity(player.relics),
        c.drive.valueF + c.drive.tickCreditF - c.drive.tickDebitF,
      ),
    );
  }

  private markWeaponResourcePressure(c: CombatState): void {
    c.drive.pressureUntilTick =
      (this.state.tick + Math.ceil((DRIVE_PRESSURE_MEMORY_SECONDS * 1000) / TICK_MS)) >>> 0;
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
      (BEAM_OVERHEAT_LOCK_SECONDS * c.mods.beamOverheatLockMult * 1000) / TICK_MS - 1e-9,
    );
    const ventMultiplier = (1 + AUG_BEAM_COOL_PER * c.beamVentStacks) * c.mods.beamVentMult;
    const coolTicks = Math.ceil(
      (((1 - BEAM_RESTART_HEAT) / Math.max(1e-9, BEAM_COOL_PER_SECOND * ventMultiplier)) * 1000) /
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
  }

  /** Commit once after all same-tick fire paths, then floor the public hundredths mirror. */
  private commitWeaponResourceTick(player: PlayerState, c: CombatState): void {
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
  }

  /** Credits are a separate authority seam and cannot clear release or minimum-lock gates. */
  private creditWeaponResource(player: PlayerState, c: CombatState, amount: number): number {
    const credit = Number.isFinite(amount) ? Math.max(0, amount) : 0;
    c.drive.valueF = Math.min(relicEnergyCapacity(player.relics), c.drive.valueF + credit);
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
  }

  /** Direct-contact slide predicate. Separate from parry `invuln`; ticks 1..5 are the inherited budget. */
  private slideInvulnerable(c: CombatState): boolean {
    return slideContactInvulnerable(c.stance, c.slidePhase, c.slidePhaseTick);
  }

  /** Thunderhead's accepted lunge is immunity only through its exclusive server tick bound. */
  private weaponLungeInvulnerable(c: CombatState): boolean {
    return (
      c.weaponLungeIFrameUntilTick !== 0 &&
      !tickReached(this.state.tick, c.weaponLungeIFrameUntilTick)
    );
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
    // Weapon-lunge i-frames are a pure phase: no HP loss, pressure, parry reward, or defensive proc.
    // Pit recovery remains authoritative and cannot be bypassed by attacking over a ledge.
    if (c && kind !== "pit" && this.weaponLungeInvulnerable(c) && left > 0) return;
    if (
      player.ultPhase === UltimatePhase.Windup &&
      ultimateFamilyForCode(player.ultArchetype) === UltimateFamily.Seismarch
    )
      left *= 0.4;
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
  }

  /** Training gate only: execute one already-armed real defense on the authoritative white-pop tick. */
  private consumeDebugCommitDefense(player: PlayerState, attacker: EnemyState): void {
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
  }

  /** Consume the two jump-feel command bits on their exact acknowledged input tick. */
  private consumeMoveStanceInput(
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
      c.pitGrace <= 0
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
      }
    }
  }

  private setMoveStance(player: PlayerState, c: CombatState, stance: MoveStance): void {
    if (c.stance === stance) return;
    c.stance = stance;
    player.moveStance = stance;
  }

  private syncSlideWire(player: PlayerState, c: CombatState): void {
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
  }

  /** Forced cancels alone bump stanceSeq; organic abort/launch/landing edges only change moveStance. */
  private cancelMoveStance(player: PlayerState, c: CombatState, forced: boolean): void {
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
      traversalEdgeBudget: 1,
      lastFreshFireTick: 0,
      actionBudget: ACTION_MSGS_PER_TICK,
      mvx: 0,
      mvy: 0,
    };
  }

  /** End the fixed roll after its eighth integrated sample; cooldown begins on this authored edge. */
  private stepSlideStance(player: PlayerState, c: CombatState): void {
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
  }

  private damagePitFall(player: PlayerState): void {
    this.damagePlayer(player, player.maxHp * PIT_FALL_DAMAGE_FRAC, "pit");
    const pet = this.petRuns.get(player.id);
    if (player.hp > 0 && pet?.mods.pitRegenSeconds) {
      pet.tortoisePitRegenSeconds = pet.mods.pitRegenSeconds;
    }
  }

  /** Traversal acceptance runs before horizontal integration/pit sampling. Space consumes directly into
   *  the authored distance jump; there is no ordinary-hop or crouch/charge intermediate sentence. */
  private stepTraversalLaunches(dt: number): void {
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
  }

  private launchDistanceJump(player: PlayerState, c: CombatState, input: InputState): void {
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
      const safeX = beltSafeX(this.beltLevel, rawX, player.x);
      const target = resolveBeltNavigation(this.beltLevel, safeX, rawY, PLAYER_RADIUS);
      targetX = target.x;
      targetY = target.y;
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
      if (player.attackHeld && (this.state.tick - player.attackTick) >>> 0 >= ATTACK_HELD_WINDOW) {
        player.attackHeld = false;
      }
      const input = this.inputs.get(id);
      if (!input) return;
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
          ? stepSteeredMovement(
              player,
              { vx: input.mvx, vy: input.mvy },
              rooted ? ZERO_MOVE_INPUT : input.held,
              dt,
              inputMoveSpeed,
              BELT_Y0,
              BELT_Y0 + DEPTH_MAX,
              minBeltX,
              maxBeltX,
            )
          : stepSteeredMovement(
              player,
              { vx: input.mvx, vy: input.mvy },
              rooted ? ZERO_MOVE_INPUT : input.held,
              dt,
              inputMoveSpeed,
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
            this.warpWeaponToCursor(player, c, weapon);
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
    this.stepPendingWeaponLunges(dt);
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
        if (pcc && this.weaponLungeInvulnerable(pcc)) return;
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
          this.zeroMoveVel(player.id);
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
      const floor = corporateGridFloorForBelt(this.beltLevel);
      const right =
        (this.state.beltLockX > 0 ? this.state.beltLockX : this.beltLevel.length) - PLAYER_RADIUS;
      if (floor) {
        const min = floor.playableBounds.minX + PLAYER_RADIUS;
        const max = Math.min(right, floor.playableBounds.maxX - PLAYER_RADIUS);
        const safeX = beltSafeX(this.beltLevel, clamp(ranged.x, min, max), player.x);
        const resolved = resolveBeltNavigation(
          this.beltLevel,
          safeX,
          ranged.y,
          PLAYER_RADIUS,
        );
        return { x: Math.min(max, resolved.x), y: resolved.y };
      }
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

  private ultimateTargetPosition(
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
  }

  private tryDimensionDoorReturn(player: PlayerState, c: CombatState): boolean {
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
        damage:
          (ult.variant === "int" ? 50 : ULT_DOOR_DETONATE_DAMAGE) * this.ultimateScale(player, ult),
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
    this.zeroMoveVel(player.id);
    ult.teleportSeqAtAccept = player.teleportSeq;
    const activeTicks = Math.max(1, (ult.activeEndTick - this.state.tick) >>> 0);
    c.invuln = Math.max(c.invuln, (activeTicks * TICK_MS) / 1000 + TICK_MS / 1000);
  }

  private ultimateScale(_player: PlayerState, _ult: UltimateRuntime): number {
    return 1;
  }

  /** L1's additive seam now consumes the run-scoped L2 crit line. */
  private critAdditiveModifiers(
    player: PlayerState,
    _combat: CombatState | undefined,
  ): readonly number[] {
    const relicCrit = relicCritAdd(player.relics);
    return relicCrit > 0 ? [relicCrit] : [];
  }

  private flatCritChance(player: PlayerState, combat?: CombatState): number {
    return critChanceFor(this.critAdditiveModifiers(player, combat));
  }

  private weaponCritChance(player: PlayerState, c: CombatState): number {
    if (c.ultCritCharges > 0 && tickReached(this.state.tick, c.ultCritEndTick))
      c.ultCritCharges = 0;
    if (c.ultCritCharges > 0) {
      c.ultCritCharges--;
      return 1;
    }
    return this.flatCritChance(player, c);
  }

  private launchSunspiteComet(player: PlayerState, c: CombatState, ult: UltimateRuntime): void {
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
  }

  /** Publish one authoritative player-attack acceptance edge. Damage/cooldown behavior remains elsewhere. */
  private stampAttackBeat(player: PlayerState): void {
    player.attackSeq = (player.attackSeq + 1) >>> 0;
    player.attackTick = this.state.tick;
    player.attackHeld = true;
    this.recordPetAcceptedAction(player.id);
  }

  /** Prospective solo combo beat for generated katana hooks, using the presentation chain law. */
  private nextSoloMeleeBeat(
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
  }

  private recordSoloMeleeBeat(
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
  }

  /** Fire one weapon swing (§20 WYSIWYG). The EDGE is registered as a SWEPT BLADE (`stepMeleeSwings` sweeps
   *  it across `swingArc` and damages each enemy the blade actually crosses — #2/#5/#6); the secondary
   *  LAYERS (chain / quake / scatter) fire here at the swing moment, each an independent position-based
   *  source ("layered like the Wyrmtooth"). Each layer uses its authored flat damage. */
  /** Resolve one accepted attack for the single weapon equipped in the active slot. */
  private resolveSingleWeaponAttack(player: PlayerState, c: CombatState): boolean {
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
  }

  private resolveSwing(
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
    const authoredLunge = weapon.performance?.lunge;
    const impactAtDestination = hand === 0 && authoredLunge?.impactAtDestination === true;
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
          (comboStep && (comboStep.rootMotion || weapon.glovePair?.wrapsFeet === true)
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
        waitForWeaponLunge: impactAtDestination,
      });

    if (authoredLunge && hand === 0) {
      this.pendingWeaponLunges.set(player.id, {
        t: authoritativeSwing.activeStartSeconds,
        playerId: player.id,
        weaponId: weapon.id,
        aimX: Math.cos(aim0),
        aimY: Math.sin(aim0),
        distancePx: authoredLunge.distancePx,
        durationSeconds: authoredLunge.durationSeconds ?? TICK_MS / 1000,
        invulnerable: authoredLunge.invulnerable === true,
        impactAtDestination,
      });
    } else if (hand === 0) {
      const rootMotion = comboStep?.rootMotion ?? weaponComboRootMotion(weapon, hybridBeat?.step);
      if (rootMotion) {
        const forwardX = Math.cos(aim0);
        const forwardY = Math.sin(aim0);
        const moveX = forwardX * rootMotion.forwardPx - forwardY * rootMotion.lateralPx;
        const moveY = forwardY * rootMotion.forwardPx + forwardX * rootMotion.lateralPx;
        const distancePx = Math.hypot(moveX, moveY);
        if (distancePx > 1e-6)
          this.pendingWeaponLunges.set(player.id, {
            t: authoritativeSwing.activeStartSeconds,
            playerId: player.id,
            weaponId: weapon.id,
            aimX: moveX / distancePx,
            aimY: moveY / distancePx,
            distancePx,
            durationSeconds: rootMotion.durationSeconds,
            invulnerable: false,
            impactAtDestination: false,
          });
      } else {
        const drift = weaponComboForwardDrift(weapon, hybridBeat?.step);
        if (drift)
          this.pendingWeaponLunges.set(player.id, {
            t: 0,
            playerId: player.id,
            weaponId: weapon.id,
            aimX: Math.cos(aim0),
            aimY: Math.sin(aim0),
            distancePx: drift.distancePx,
            durationSeconds: drift.durationSeconds,
            invulnerable: false,
            impactAtDestination: false,
          });
      }
    }

    if (katanaEffect?.invulnerabilitySeconds)
      c.invuln = Math.max(c.invuln, katanaEffect.invulnerabilitySeconds);
    if (katanaEffect?.dashImpulse) {
      const impulse = addImpulse(
        player,
        Math.cos(aim0) * katanaEffect.dashImpulse,
        Math.sin(aim0) * katanaEffect.dashImpulse,
      );
      player.vx = impulse.vx;
      player.vy = impulse.vy;
    }
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
      if (impactAtDestination) {
        const lunge = this.pendingWeaponLunges.get(player.id);
        if (lunge)
          lunge.destinationQuake = {
            radius: weapon.quake.radius,
            damage: weapon.quake.damage * qPower,
            crit: attackCrit,
            zoneDamagePerSecond,
          };
      } else {
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
          zoneDamagePerSecond,
        });
      }
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
    return (this.state.tick - input.lastFreshFireTick) >>> 0 < BEAM_STALE_INPUT_TICKS;
  }

  /** Hold starts one immutable server clock; release snapshots the curve into one real projectile. */
  private stepPlayerChargedProjectile(
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
  }

  private fireChargedProjectile(
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
    this.fireProjectile(
      source,
      { x: source.x + aim.x, y: source.y + aim.y },
      definition.speed,
      release.directDamage * damageMultiplier,
      false,
      "emberleaf-fireball",
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
      { shape: "capsule", radius, halfLength: 0 },
      release.visualScale,
    );
  }

  /** Server-authoritative character-centered aura. Drive pays the authored net drain every fixed step;
   * damage receives only the funded fraction of the final step and the channel release-locks at empty. */
  private stepPlayerAura(
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
  }

  private cancelDestinationLungeImpact(playerId: string, weaponId: string): void {
    for (const key of [playerId, `${playerId}:0`]) {
      const swing = this.meleeSwings.get(key);
      if (swing?.waitForWeaponLunge && swing.weaponId === weaponId) this.meleeSwings.delete(key);
    }
  }

  /** Unlock one accepted punch at its immutable legal endpoint and release its destination-only layers. */
  private releaseDestinationLungeImpact(
    player: PlayerState,
    combat: CombatState,
    lunge: PendingWeaponLunge,
  ): void {
    if (!lunge.impactAtDestination) return;
    for (const key of [player.id, `${player.id}:0`]) {
      const swing = this.meleeSwings.get(key);
      if (!swing?.waitForWeaponLunge || swing.weaponId !== lunge.weaponId) continue;
      swing.waitForWeaponLunge = false;
      swing.elapsed = Math.max(swing.elapsed, swing.swing.activeStartSeconds);
      swing.originX = player.x;
      swing.originY = player.y;
    }
    const quake = lunge.destinationQuake;
    lunge.destinationQuake = undefined;
    if (!quake) return;
    this.detonate(
      player.x,
      player.y,
      quake.radius,
      quake.damage,
      quake.crit,
      player.id,
      lunge.weaponId,
      CombatDelivery.Quake,
    );
    const weapon = WEAPONS[lunge.weaponId];
    if (quake.zoneDamagePerSecond !== undefined && weapon?.groundZone?.trigger === "impact")
      this.spawnWeaponGroundZoneAt(
        player,
        weapon,
        player.x,
        player.y,
        quake.zoneDamagePerSecond,
        quake.crit,
      );
    combat.lastGroundX = player.x;
    combat.lastGroundY = player.y;
  }

  /** Clamp an arena lunge to the last unobstructed point on its accepted segment. Endpoint navigation can
   * legitimately snap a target out of a pit or POI; sampling prevents that correction from carrying the
   * player through the intervening obstacle. Belt endpoints already use the belt's swept safe-X resolver. */
  private navValidLungeDest(
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
      if (isPitAtPx(this.map, x, y)) break;
      if (this.map.pois.length > 0) {
        const resolved = resolvePoiCollisionInto(
          this.map,
          x,
          y,
          PLAYER_RADIUS,
          this.poiResolveScratch,
        );
        if (Math.hypot(resolved.x - x, resolved.y - y) > 1e-6) break;
      }
      safeX = x;
      safeY = y;
    }
    return { x: safeX, y: safeY };
  }

  /** Resolve an accepted lunge across its authored active window. Cursor intent is captured at acceptance;
   * the endpoint and complete travel segment are navigation-validated before authoritative movement. */
  private playerAttackMoveMode(playerId: string, dt: number): number {
    const lunge = this.pendingWeaponLunges.get(playerId);
    if (lunge && (lunge.elapsedSeconds !== undefined || lunge.t <= dt + 1e-9)) {
      // Authored combo travel owns displacement; input never stacks on top.
      return PlayerAttackMoveMode.RootMotion;
    }
    for (const swing of this.meleeSwings.values()) {
      if (swing.playerId !== playerId || swing.waitForWeaponLunge) continue;
      const activeStart = swing.swing.activeStartSeconds;
      const activeEnd = swing.swing.activeEndSeconds;
      if (swing.elapsed < activeEnd && swing.elapsed + dt + 1e-9 >= activeStart) {
        return PlayerAttackMoveMode.InputSlow;
      }
    }
    return PlayerAttackMoveMode.Normal;
  }

  private stepPendingWeaponLunges(dt: number): void {
    for (const [playerId, lunge] of this.pendingWeaponLunges) {
      const player = this.state.players.get(playerId);
      const combat = this.combat.get(playerId);
      if (!player?.alive || !combat || player.weapon !== lunge.weaponId) {
        if (combat) combat.weaponLungeIFrameUntilTick = this.state.tick;
        this.cancelDestinationLungeImpact(playerId, lunge.weaponId);
        this.pendingWeaponLunges.delete(playerId);
        continue;
      }
      let travelDt = dt;
      if (lunge.elapsedSeconds === undefined) {
        const waitSeconds = lunge.t;
        lunge.t = Math.max(0, waitSeconds - dt);
        if (lunge.t > 1e-9) continue;
        travelDt = Math.max(0, dt - waitSeconds);
        const destination = this.navValidLungeDest(
          player,
          combat,
          player.x + lunge.aimX * lunge.distancePx,
          player.y + lunge.aimY * lunge.distancePx,
          lunge.distancePx,
        );
        const dx = destination.x - player.x;
        const dy = destination.y - player.y;
        // A pit/obstacle correction may slide sideways, but it may never turn the authored lunge backward.
        const blocked = dx * lunge.aimX + dy * lunge.aimY <= 0;
        lunge.elapsedSeconds = 0;
        lunge.startX = player.x;
        lunge.startY = player.y;
        lunge.endX = blocked ? player.x : destination.x;
        lunge.endY = blocked ? player.y : destination.y;
        if (lunge.invulnerable) {
          combat.weaponLungeIFrameUntilTick =
            (this.state.tick + ticksFromSeconds(lunge.durationSeconds)) >>> 0;
        }
      }
      const nextElapsed = (lunge.elapsedSeconds ?? 0) + travelDt;
      lunge.elapsedSeconds =
        nextElapsed + 1e-9 >= lunge.durationSeconds ? lunge.durationSeconds : nextElapsed;
      const progress = lunge.elapsedSeconds / lunge.durationSeconds;
      player.x =
        (lunge.startX ?? player.x) +
        ((lunge.endX ?? player.x) - (lunge.startX ?? player.x)) * progress;
      player.y =
        (lunge.startY ?? player.y) +
        ((lunge.endY ?? player.y) - (lunge.startY ?? player.y)) * progress;
      combat.lastGroundX = player.x;
      combat.lastGroundY = player.y;
      if (progress >= 1) {
        this.releaseDestinationLungeImpact(player, combat, lunge);
        this.pendingWeaponLunges.delete(playerId);
      }
    }
  }

  private zoneTarget(player: PlayerState, c: CombatState, placementRange: number): Vec2 {
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
      const safe = nearestGroundPx(this.map, x, y);
      x = safe.x;
      y = safe.y;
    }
    return { x, y };
  }

  /** Hold-to-grow authority. One ZoneState row changes only its radius; input remains the normal heartbeat. */
  private stepPlayerGroundZone(
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
  }

  /** Charge → authoritative ignition → sustained swept damage → recovery/overheat. */
  private clearBeamRows(ownerId: string, satellitesOnly = false): void {
    const keys: string[] = [];
    this.state.beams.forEach((row, key) => {
      if (row.ownerId === ownerId && (!satellitesOnly || key !== ownerId)) keys.push(key);
    });
    for (const key of keys) this.state.beams.delete(key);
  }

  private beamSatelliteCount(): number {
    let count = 0;
    this.state.beams.forEach((row, key) => {
      if (key !== row.ownerId) count++;
    });
    return count;
  }

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
  }

  private finishBeam(player: PlayerState, id: string, c: CombatState, overheated: boolean): void {
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
  }

  private syncRestingBeamRow(
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
  }

  private syncBeamRow(
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
  }

  /** Weapon-rooted beam origin. Every authoritative consumer calls this exact seam each fixed tick. */
  private writeBeamMuzzle(
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
      length = clipPoiRayLength(this.map.poiCollisionIndex, ox, oy, dx, dy, halfWidth, length);
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

  /** Resolve one authored rapid-thrust pulse at its exact shared pose epoch. Each pulse starts with a fresh
   * hit ledger, so a target held on the visible pike line receives one distinct authoritative contact. */
  private applyRapidThrustHit(
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
      if (sw.waitForWeaponLunge) continue;
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
      if (absoluteSwingArc > Math.PI * 2 + 1e-6) {
        const rev0 = Math.floor((absoluteSwingArc * p0) / (Math.PI * 2));
        const rev1 = Math.floor((absoluteSwingArc * p1) / (Math.PI * 2));
        if (rev1 > rev0) sw.hit.clear();
      }
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
  }

  /** End every threat before the first celebration patch; player clocks/position remain untouched. */
  private beginVastagharClear(x: number, y: number): void {
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
  }

  /** Advance the authoritative collapse, then open the ordinary reward route without minting boss loot. */
  private stepVastagharVictory(): void {
    const encounter = this.vastagharEncounter;
    if (!encounter || encounter.state.mode !== VastagharMode.Victory) return;
    if (encounter.advanceVictory(this.state.tick)) this.completeVastagharVictoryPresentation();
    if (this.vastagharMoneyAwarded && ((this.state.tick - this.vastagharVictoryReadyTick) | 0) >= 0)
      this.completeRewardBoundary("boss-clear");
  }

  /** B20 L2: preserve the collapse beat but retire the old boss-money itemization channel. */
  private completeVastagharVictoryPresentation(): void {
    const encounter = this.vastagharEncounter;
    if (!encounter || this.vastagharMoneyAwarded) return;
    this.vastagharMoneyAwarded = true;
    this.vastagharVictoryReadyTick = this.state.tick;
    encounter.setVictoryMoney(0);
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
      this.advanceBossRush();
    } else {
      this.openPortal(this.vastagharVictoryX, this.vastagharVictoryY);
    }
    this.vastagharVictoryMode = "";
  }

  /** Credit a collected drop through the per-player run-money rail. */
  private awardMoney(amount: number, ownerId = ""): void {
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
  }

  private moneyDropReach(player: PlayerState): number {
    return clamp(
      BASE_MONEY_DROP_REACH + (this.petRuns.get(player.id)?.mods.moneyDropReachAdd ?? 0),
      MONEY_DROP_REACH_MIN,
      MONEY_DROP_REACH_MAX,
    );
  }

  private nearestMoneyCollector(
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
  }

  /** Convert one chest money roll into a bounded collectible row. Overflow merges; value is conserved. */
  private dropMoney(x: number, y: number, value: number, ownerId = ""): void {
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
  }

  private stepMoneyDrops(): void {
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
  }

  private drainMoneyDrops(): void {
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
  }

  /** Committed transitions conserve every uncollected money row before teardown. */
  private completeRewardBoundary(kind: RewardBoundary): void {
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
  }
  private completeExtraction(): void {
    this.state.riftOpen = false;
    this.enterTerminalOutcome("victory");
    console.log(`[room ${this.roomId}] run extracted at depth ${this.state.depth} — VICTORY`);
  }

  private completeBossRushVictory(): void {
    this.enterTerminalOutcome("victory");
    console.log(
      `[room ${this.roomId}] BOSS RUSH cleared all ${BOSS_DEF_IDS.length} bosses — VICTORY`,
    );
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
    while (this.bossController.drainWormReward()) {
      // B20 L2: consume the legacy anatomy-reward queue without minting non-chest itemization.
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
      if (!p.alive) return;
      const dx = p.x - x;
      const dy = p.y - y;
      if (dx * dx + dy * dy > r2) return;
      const combat = this.combat.get(p.id);
      if (combat && this.weaponLungeInvulnerable(combat)) return;
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
    });
  }

  private vastagharParryActive(player: PlayerState, combat: CombatState): boolean {
    if (combat.invuln <= 0 || combat.parryOpenedTick === 0xffffffff) return false;
    const windowSeconds = Math.max(
      PARRY_IFRAMES * combat.mods.parryIFrameMult,
      PARRY_IFRAMES * (1 + IRON_STANCE_IFRAME_PER * countAugment(player.augments, "iron-stance")),
    );
    const windowTicks = Math.ceil((windowSeconds * 1000) / TICK_MS);
    return (this.state.tick - combat.parryOpenedTick) >>> 0 <= windowTicks;
  }

  /** Same personal chain/cooldown/heal/augment ledger as melee parry, without moving the 230px titan root. */
  private resolveVastagharParry(
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
  }

  /** POI identity stays at its deterministic seed index; moving the server copy off-map removes collision
   * on the exact synchronized mutation edge while the client consumes `destroyedPoiMask`. */
  private mutateVastagharArena(_kind: VastagharArenaMutationKind, poiIndex: number): void {
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
      if (!p.alive) return;
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
      if (!p.alive) return;
      if (!pointInAnnulusGap(p.x, p.y, cx, cy, bandR, bandHalf, gapCenter, gapHalf)) return;
      this.damagePlayer(p, damage, "enemy");
    });
  }

  /** §16 drop a corrosive DoT puddle (reuses ZoneState + the zoner DoT machinery) at a boss-authored spot. */
  private spawnWeaponGroundZoneAt(
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
  }

  private dropBossZone(x: number, y: number, radius: number, ttl: number): void {
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
  }

  /** §16 remove one live projectile while keeping the O(1) hostile admission count exact. */
  private removeProjectile(id: string): void {
    const meta = this.projectileMeta.get(id);
    if (meta?.hostile) this.hostileProjectileCount = Math.max(0, this.hostileProjectileCount - 1);
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

  private armGunBurst(c: CombatState, weapon: WeaponDef, hand: WeaponHand): void {
    const burst = weapon.gun?.burst;
    if (!burst || burst.count <= 1) return;
    c.gunBurstWeaponId = weapon.id;
    c.gunBurstHand = hand;
    c.gunBurstRemaining = burst.count - 1;
    c.gunBurstT = burst.intervalSeconds;
  }

  private clearGunBurst(c: CombatState): void {
    c.gunBurstWeaponId = "";
    c.gunBurstHand = 0;
    c.gunBurstRemaining = 0;
    c.gunBurstT = 0;
  }

  /** Emit follow-up rounds from an accepted trigger; they need no second input or Drive spend. */
  private stepGunBurst(
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
    );
    c.gunBurstRemaining--;
    if (c.gunBurstRemaining <= 0) this.clearGunBurst(c);
    else c.gunBurstT += weapon.gun.burst.intervalSeconds;
  }

  /** Cogwright's Tesla-Rod: the cursor is intent only. The server resolves the full-distance endpoint through
   * the same bounds/POI/pit/deck validator as every other teleport, writes position itself, and bumps the
   * movement hard-resync edge before applying the small arrival burst. */
  private warpWeaponToCursor(player: PlayerState, c: CombatState, weapon: WeaponDef): void {
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
    player.x = destination.x;
    player.y = destination.y;
    c.lastGroundX = destination.x;
    c.lastGroundY = destination.y;
    c.pitGrace = PIT_FALL_GRACE;
    this.zeroMoveVel(player.id);
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
  }

  private fireGun(
    player: PlayerState,
    c: CombatState,
    weapon: WeaponDef,
    hand: WeaponHand = 0,
    recoilElapsedMs = 0,
    burstIndex = 0,
  ): void {
    const g = weapon.gun;
    if (!g) return;
    const pellets = Math.max(1, g.pellets ?? 1);
    const spread = g.spread ?? 0;
    const aim = this.aimDir(player, c); // §37 aim at the cursor POINT, not the rig-derived vector
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
    const explode = g.explode
      ? {
          radius: g.explode.radius,
          damage:
            (g.explode.damage * this.heldDamageMult(weapon, player, hand)) / projectileDivisor,
        }
      : undefined;
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
        );
      }
    }
    // §20 RECOIL pushback (Stage A): most guns kick the body backward along aim. Presentation-only
    // exceptions keep their authored rig/camera response without injecting velocity into authoritative
    // locomotion; remote interpolation therefore observes the same stable movement-only root.
    const recoil = gunLocomotionRecoilFor(weapon);
    const r = addImpulse(
      player,
      -aim.x * recoil.impulse,
      -aim.y * recoil.impulse,
      recoil.maxImpulse,
    );
    player.vx = r.vx;
    player.vy = r.vy;
  }

  /** §38 CASTER fire — conjure one piercing arcane BOLT down aim (no ammo). Distinct from a gun
   *  (no magazine/spread; pierces the whole line) and from melee (ranged). Spawns from the same muzzle reach. */
  /** Gun-contact version of the existing Venomtongue chain idiom. The projectile hit is the seed and is
   * excluded from the extra links; every hop is selected and damaged on the server. */
  private applyProjectileChain(
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
  }

  private fireCast(
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
  }

  /** Hurl a thrown weapon at the player's aim — a friendly, piercing projectile (§10). */
  private throwWeapon(
    player: PlayerState,
    c: CombatState,
    weapon: WeaponDef,
    hand: WeaponHand = 0,
  ): void {
    const t = weapon.thrown;
    if (!t) return;
    const damageMultiplier = this.heldDamageMult(weapon, player, hand);
    const dmg = t.damage * damageMultiplier;
    const outboundSeconds = t.range / t.speed;
    const ttl = outboundSeconds * (t.returning ? 2 : 1);
    const aim = this.aimDir(player, c); // §37 aim at the cursor POINT, not the rig-derived vector
    const drawSeconds = weapon.performance?.windupSeconds ?? 0;
    if ((weapon.performance?.preThrowRevolutions ?? 0) > 0 && drawSeconds > 0) {
      const attackCrit = this.weaponCritChance(player, c);
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
          swingArc: Math.PI * 2 * (weapon.performance?.preThrowRevolutions ?? 1),
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
      this.pendingWeaponThrows.push({
        t: drawSeconds,
        playerId: player.id,
        weaponId: weapon.id,
        aimX: aim.x,
        aimY: aim.y,
        speed: t.speed,
        range: t.range,
        damage: dmg,
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
      });
      return;
    }
    this.fireProjectile(
      { x: player.x, y: player.y },
      { x: player.x + aim.x, y: player.y + aim.y },
      t.speed,
      dmg,
      false,
      thrownProjectileKindFor(weapon),
      t.pierce,
      ttl,
      undefined,
      0,
      this.weaponCritChance(player, c), // §ULT Door rider consumes once per throw
      player.id,
      weapon.id,
      CombatDelivery.Thrown,
      undefined,
      weapon.groundZone?.trigger === "landing"
        ? weapon.groundZone.damagePerSecond * this.heldDamageMult(weapon, player, hand)
        : undefined,
      t.ricochetHops
        ? { hops: t.ricochetHops, range: t.ricochetRange ?? Math.min(t.range, 320) }
        : undefined,
      undefined,
      t.arcHeight ?? weapon.groundZone?.grenadeArcHeight ?? 0,
      t.returning ? outboundSeconds : undefined,
    );
  }

  /** §14 scatter shot — fling `count` REAL magma projectiles in a cone toward aim. Each is a WYSIWYG
   *  damage source with flat authored direct-hit and explosion damage. */
  /** Redirect one spent thrown impact toward the nearest fresh enemy. Selection is server-owned and uses
   * the same greedy nearest-target primitive as chain lightning. */
  private emitWeaponThrow(pending: PendingWeaponThrow, originX: number, originY: number): void {
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
      undefined,
      pending.arcHeight ?? 0,
      pending.returning ? pending.range / pending.speed : undefined,
    );
  }

  private redirectThrownRicochet(
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
  }

  private fireScatter(
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
      kind,
    };
    if (volley.t > 0) this.pendingScatterVolleys.push(volley);
    else this.emitScatterVolley(volley);
  }

  private emitScatterVolley(volley: PendingScatterVolley): void {
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
      );
    }
  }

  /** Emit one B3 fan payload from the actual painted leading edge. The close swept edge has already
   * advanced through this impact epoch; these rows then travel and collide through the shared authority rail. */
  private emitHybridProjectile(pending: PendingHybridProjectile): void {
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
    while (controller.drainWormReward()) {
      // B20 L2: consume the legacy anatomy-reward queue without minting non-chest itemization.
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

  /** Apply `raw` damage, then perform shared kill, money, and portal bookkeeping. */
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
      player.teleportSeq = (player.teleportSeq + 1) >>> 0;
    }
  }

  /** §29 place a floor pickup on solid ground: the BELT deck (clamped into the depth band, nudged off any
   *  pit gap) in belt mode, else the procgen arena's safe-spawn nudge. Keeps swaps and explicitly issued
   *  pickups grabbable, never in a pit or off the walkable floor. */
  private placePickupPos(x: number, y: number): { x: number; y: number } {
    if (this.belt && this.beltLevel) {
      const bx = beltSafeX(this.beltLevel, x, x);
      return { x: bx, y: clampBeltFloorY(this.beltLevel, bx, y, PICKUP_RADIUS) };
    }
    return safeSpawnPos(this.map, x, y, PICKUP_RADIUS);
  }

  /** Apply an AoE blast at (x,y): damage every enemy within `radius`, with the same kill/money/portal
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
  }

  /** §15/B33 duelists and derived contact melee: chase, acquire one target slot, ramp on-body, then commit. */
  private enemyGroundZoneSlow(enemyId: string): number {
    const slow = this.enemyZoneSlow.get(enemyId);
    if (!slow) return 1;
    if (this.state.tick >= slow.untilTick) {
      this.enemyZoneSlow.delete(enemyId);
      return 1;
    }
    return slow.multiplier;
  }

  /** One enemy-movement status seam for Frostquill zones and direct-hit freezes. */
  private applyEnemySlow(enemyId: string, multiplier: number, seconds: number): void {
    if (!(multiplier < 1) || seconds <= 0) return;
    const untilTick = (this.state.tick + Math.ceil((seconds * 1000) / TICK_MS)) >>> 0;
    const current = this.enemyZoneSlow.get(enemyId);
    this.enemyZoneSlow.set(enemyId, {
      multiplier: Math.min(current?.multiplier ?? 1, multiplier),
      untilTick: Math.max(current?.untilTick ?? 0, untilTick),
    });
  }

  private applyEnemyHitStatus(enemyId: string, status: WeaponDef["hitStatus"]): void {
    if (status?.kind === "slow") this.applyEnemySlow(enemyId, status.multiplier, status.seconds);
  }

  private stepDuelists(dt: number, _bodies: Vec2[]): void {
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
  }

  /** Non-holder movement stays legible: close normally, then take a deterministic ring-out posture. */
  private postureMeleeEnemy(
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
  }

  /** Capture one nav-valid endpoint and immutable target/vector at the white pop. */
  private planDuelistStrike(
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
  }

  /** Sample the complete accepted enemy segment so the fixed lunge cannot cross a pit or landmark. */
  private navValidEnemyLungeDest(enemy: EnemyState, targetX: number, targetY: number): Vec2 {
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
  }

  private captureAuthoredMeleeEscape(
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
      this.pendingWeaponLunges.has(target.id) ||
      this.ultimateOwnsMovement(target);
    if (authoredMotion) strike.authoredEscape = true;
  }

  private enterOrdinaryMeleeRecover(
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
  }

  /** Resolve against the committed player identity. Walking/strafing is deliberately not an answer. */
  private duelistSwing(
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
  }

  /** §51 one TOUGH combo-speaking elite, one tick — the authored, tick-anchored machine (worm action
   *  model): idle → [leapwind → leap → settle] → windup … → (return) → recover. The laws enforced here:
   *  the negotiated landing NEVER moves once its marker exists (G3/G5); each ramp tracks until the
   *  universal white pop, then four fixed commit ticks own a frozen vector; every displacement is bounded
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
    // Existing combo cadence names impact-to-impact timing. Reserve its final four ticks for B33's
    // universal pop-to-impact window so adding the channel does not slow or invalidate authored strings.
    const rampTicks = Math.max(1, (step?.windupTicks ?? 1) - ENEMY_MELEE_COMMIT_TICKS);
    st.stepEndTick = (this.state.tick + rampTicks) >>> 0;
  }

  /** §51 end a combo performance: clear rows + presentation flags, FREE the duel token (G12 — the
   *  kneeling punish window pressures no one), and hold `recover` for `ticks`. */
  private enterComboRecover(
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
  }

  /** §51 allocation-free steady-state chase used only by authored combos. The shared chase helper returns
   *  fresh vectors (fine for legacy); active elites mutate in place so their richer per-tick machine adds
   *  zero garbage-collector pressure. */
  private moveComboEnemyToward(enemy: EnemyState, target: Vec2, speed: number, dt: number): void {
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
  private stepComboKnockback(enemy: EnemyState, st: DuelistComboState, tick: number): boolean {
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
      }
      player.juggledSeq = (player.juggledSeq + 1) & 0xff;
      st.juggleHits = (st.juggleHits ?? 0) + 1;
    } else {
      const push = HIT_KNOCKBACK_IMPULSE * (geo.knockbackMult ?? 1);
      const k = addImpulse(player, (hx / hd) * push, (hy / hd) * push);
      player.vx = k.vx;
      player.vy = k.vy;
    }
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

  /** Publish one deterministic success pose, then route the server-owned displacement/state by incidence. */
  private applyDirectionalParryReaction(
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
  }

  /** The pre-B26 parry lift, extracted byte-for-byte in behavior and reached only by below incidence. */
  private applyLegacyParryLift(
    player: PlayerState,
    pc: CombatState,
    incomingX: number,
    incomingY: number,
  ): void {
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
  }

  /** Move immediately to a swept-valid endpoint; snapshot interpolation presents the authored slide beat. */
  private applySideParrySlide(
    player: PlayerState,
    pc: CombatState,
    incomingX: number,
    incomingY: number,
    preventedDamage: number,
  ): void {
    const distance = parrySlideDistance(preventedDamage);
    let destination: Vec2;
    if (this.belt && this.beltLevel) {
      const length = Math.hypot(incomingX, incomingY) || 1;
      destination = this.navValidLungeDest(
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
    });
  }

  /** Advance every projectile, expire at TTL/arena edge. HOSTILE projectiles hit players (parry-/
   *  level-immune); FRIENDLY (thrown) projectiles cut through enemies up to their pierce count. */
  private stepProjectiles(dt: number): void {
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
      // §17 POI COVER — a projectile that flies into a landmark is BLOCKED. A RICOCHET round (bounces left)
      // CAROMS off the landmark like a wall: reflect the velocity across the radial normal, snap to the
      // surface, and re-arm (fresh pierce/hit-set/life) so it keeps hunting. Everything else is ABSORBED
      // (exploding rounds detonate via the doomed loop). Cover works both ways — a landmark in YOUR line
      // eats your shots too.
      const hitPoi = corporateFloor ? undefined : poiCollisionAt(this.map, pr.x, pr.y);
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
          const pc = this.combat.get(player.id);
          if (pc && this.weaponLungeInvulnerable(pc)) return;
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
  }

  /** Tick puddle lifetimes; DoT any living, non-invulnerable player standing inside one. */
  private stepZones(dt: number): void {
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
        if (room.boss) this.completeRewardBoundary("belt-victory");
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
  private spawnBeltWave(
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
    )
      return;
    const gain =
      Math.max(0, applied) * ULT_CHARGE_PER_DAMAGE + (finalBlow ? ULT_CHARGE_KILL_BONUS : 0);
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
    )
      return;
    const admitted = Math.min(amount, ULT_CHARGE_TICK_CAP - c.ultAccrualThisTick, 1 - c.ultChargeF);
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
  private debugSpawnOne(
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
  private advanceBossRush(): void {
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
    this.resetChestDirector();
  }

  /** §6 the boss falls → open BOTH gates of the greed decision: the amber EXTRACTION portal (bank 100% of
   *  run money and end in victory) and the violet DEEPER rift (descend to depth+1 — harder, richer).
   *  QOL-03 solves them jointly as reachable, full-footprint safe discs with protected separation. */
  private openPortal(x: number, y: number): void {
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
   *  levels/attributes/weapons/augments/run money/HP all persist (that's the greed: you push in
   *  whatever shape the last fight left you). The field is cleared, the clock and boss director reset. */
  private transitionDimension(): void {
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
        this.completeRewardBoundary("descent");
      }
    } else if (this.state.riftCharge > 0) {
      this.state.riftCharge = Math.max(0, this.state.riftCharge - (dt / RIFT_CHANNEL_SECONDS) * 2);
    }
  }
}
