import {
  ATTACK_HELD_WINDOW,
  BLADE_EXTENSION_OVERLAP_FRACTION,
  CHOP_IMPACT_FRAC,
  comboRibbonFanOutScaleAt,
  comboStepForChain,
  composeWeaponTransform,
  createKatanaChoreographySample,
  DUAL_MELEE_PAIR_BAR,
  DUAL_MELEE_SEQUENCE_LENGTH,
  decodeGearCosmetics,
  dualHandForSeq,
  type GearId,
  type GearSlot,
  GRAVITY_APEX_BAND,
  GROUND_EPSILON,
  INTERP_SNAP_PLAYER,
  isMonkGloveWeapon,
  isWornWeapon,
  JIGGLE_FOOT_AIR_INERTIA,
  JIGGLE_FOOT_AIR_W,
  JIGGLE_FOOT_AIR_Z,
  JIGGLE_FOOT_IDLE_X,
  JIGGLE_FOOT_IDLE_Y,
  JIGGLE_FOOT_MAX_V,
  JIGGLE_FOOT_MAX_X,
  JIGGLE_FOOT_MAX_Y,
  JIGGLE_FOOT_PLANT_INERTIA,
  JIGGLE_FOOT_PLANT_W,
  JIGGLE_FOOT_PLANT_Z,
  JIGGLE_FREE_HAND_INERTIA,
  JIGGLE_HAND_IDLE_X,
  JIGGLE_HAND_IDLE_Y,
  JIGGLE_HAND_MAX_V,
  JIGGLE_HAND_MAX_X,
  JIGGLE_HAND_MAX_Y,
  JIGGLE_HAND_W,
  JIGGLE_HAND_Z,
  JIGGLE_HANDOFF_MAX_V,
  JIGGLE_LAND_HAND_KICK,
  JIGGLE_LOD_MARGIN_PX,
  JIGGLE_MAX_DT_S,
  JIGGLE_REMOTE_FILTER_HZ,
  JIGGLE_SELF_FILTER_HZ,
  JIGGLE_SIGNAL_DEAD_ZONE,
  JIGGLE_SIGNAL_IMPULSE_HZ,
  JIGGLE_SIZE_FREQ_MAX,
  JIGGLE_SIZE_FREQ_MIN,
  JIGGLE_SIZE_FREQ_POWER,
  JIGGLE_TURN_FOOT_KICK,
  JIGGLE_TURN_HAND_KICK,
  JIGGLE_WEAPON_HAND_INERTIA,
  JUMP_VELOCITY,
  landingThumpTier,
  MELEE_COMBO_SEQUENCES,
  type MeleeComboFamily,
  type MeleeComboHand,
  type MeleeComboLimb,
  type MeleeComboMotion,
  type MeleeComboStep,
  type MeleeComboVariant,
  MOVE_HITCH_MIN_ANGLE,
  MOVE_SPEED,
  type MoveStance,
  meleeComboSelectionFor,
  meleeComboSequenceFor,
  meleeReach,
  PLAYER_RADIUS,
  PROCEDURAL_JIGGLE,
  ROLL_DURATION,
  ROLL_IFRAME_TICKS,
  ROLL_TICK_SECONDS,
  SLIDE_PHASE_GROUND,
  SLIDE_PHASE_OFF,
  type SlidePhase,
  STANCE_DASH,
  STANCE_NONE,
  STANCE_POUND,
  STANCE_SLIDE,
  type SwingDescriptor,
  sampleKatanaChoreography,
  swingDescriptorFor,
  swingDescriptorWithComboStep,
  TICK_MS,
  transformWeaponArtPoint,
  UltimateFamily,
  type UltimateFamilyValue,
  UltimatePhase,
  type UltimatePhaseValue,
  VastagharActionKind,
  VastagharFoot,
  VastagharMode,
  type WeaponAffineTransform,
  type WeaponArtMuzzlePoint,
  type WeaponDef,
  weaponArtMuzzlePointsForShot,
  weaponHasHandlingTag,
  weaponMuzzleGripOffset,
  weaponSpriteTransform,
  weaponUsesAuthoritativeEnvelopeCombo,
} from "@dd/shared";
import Phaser from "phaser";
import {
  type WeaponArtGeometry,
  type WeaponArtStateGeometry,
  weaponArtGeometryFor,
} from "../sprites/art-geometry.generated.js";
import { firingFrameSpriteAt, resolveWeaponFiringFrame } from "../sprites/firing-frame.js";
import {
  firingHandTarget,
  firingStanceFor,
  fistGunShotHandOffset,
  usesAimedFiringStance,
} from "../sprites/firing-stance.js";
import {
  type AlternativeHeadTextureSelection,
  assembleBoilerplate,
  assembleGearLoadout,
  type BoilerplateAssembly,
  type BoilerplateAssemblyPart,
  boilerplateTextureKey,
  DEFAULT_LOADOUT_HEAD_TEXTURE,
  ensureBoilerplateTextures,
  ensureGearAssemblyTextures,
  ensureGearPartFrame,
  type GearAssemblyPart,
  type GearLoadoutAssembly,
  type GearPartsManifest,
  gearTextureKey,
  type HatChainInput,
  type HatSpringState,
  HEAD_MOUNT_SCALE,
  isGearReplacementManifest,
  MAX_HAT_SLOTS,
  type ResolvedLoadoutHeadTexture,
  resolveLoadoutHeadTexture,
  stepGearAngularSpring,
  stepHatSpringChain,
} from "../sprites/gear-parts.js";
import {
  type GearTextureBakeLease,
  gearTextureBakeCacheForScene,
} from "../sprites/gear-texture-baker.js";
import { resolvedGunGripPoints } from "../sprites/gun-grip-points.js";
import { SPRITES, type SpriteManifest, spriteImageFacingX } from "../sprites/manifest.js";
import {
  aimRelativePoint,
  BLADE_SIZE_STANCES,
  type BladeSizeClass,
  type BladeSizeStance,
  bladeSizeClassFor,
  classifyHandRole,
  comboPresentationStyleFor,
  comboWeaponThicknessSign,
  continuousFrontflipAngle,
  continuousTwirlAxisFor,
  continuousWhirlAngle,
  continuousWhirlPhase,
  createFlourishInput,
  createFlourishSample,
  createMovementPostureInput,
  createMovementPostureSample,
  createPoseLanguageInput,
  createPoseLanguageSample,
  createPoseVariantSelection,
  createWeaponPerformanceInput,
  createWeaponPerformanceSample,
  edgeLeadScaleY,
  FLOURISH_DUAL_AFTER_ECHO_MS,
  FLOURISH_DUAL_DRAW_ECHO_MS,
  FLOURISH_DUAL_STOW_ECHO_MS,
  type FlourishInput,
  type FlourishMoment,
  type FlourishSample,
  type MovementPostureInput,
  type MovementPostureSample,
  movementPostureFor,
  type NamedWeaponStance,
  namedWeaponStanceFor,
  oneHandBladePoseVariantFrom,
  POSE_ONE_HAND_BLADE_VARIANT_REGISTRY_KEY,
  POSE_PISTOL_VARIANT_REGISTRY_KEY,
  POSE_TWO_HAND_AUTHORITY_REGISTRY_KEY,
  type PoseActionPhase,
  type PoseBeamPhase,
  type PoseLanguageInput,
  type PoseLanguageSample,
  pistolPoseVariantFrom,
  poseImpulsePending,
  poseSupportHandFor,
  resolveIdleHandTarget,
  resolveWeaponFootPoseOffset,
  sampleFlourish,
  sampleMovementPosture,
  samplePoseLanguage,
  sampleWeaponPerformance,
  shaftMidpointPivotTransform,
  twirlDirectionForBeat,
  twoHandedPoseFor,
  twoHandPoseAuthorityFrom,
  WEAPON_FLOURISH_SPECS,
  type WeaponFlourishSpec,
  type WeaponPerformanceSpec,
  type WeaponPoseSpec,
  weaponFlourishSpecFor,
  weaponPerformanceSpecFor,
  weaponPoseSpecFor,
} from "../sprites/pose-language.js";
import { secondaryGripHandRendersAbove } from "../sprites/secondary-grip.js";
import { tomeOpenArtFor, tomeOpenRotationForAim } from "../sprites/tome-open-art.js";
import {
  isWholeArtCharacterId,
  isWholeArtCharacterPartRole,
  wholeArtCharacterTextureKey,
  wholeArtCharacterVisualScale,
} from "../sprites/whole-art-character.js";
import { rollTumbleRotation } from "../vfx/jump-effects.js";
import { PARTICLE_PACKS } from "../vfx/particle-manifest.js";
import { paintedParticleDominance, paintedParticleScale } from "../vfx/particles.js";
import { screenTrueScaleX } from "../vfx/screen-true-transform.js";
import { resolveWeaponAuraVfxRecipe } from "../vfx/weapon-effect-recipes.js";
import { weaponPaintedAuraFor } from "../vfx/weapon-vfx-suite.js";
import {
  createKungFuWrapPoseInput,
  createKungFuWrapPoseSample,
  isKungFuWrapMotion,
  sampleKungFuWrapPose,
} from "./kung-fu-wrap-pose.js";

export { GEAR_PARTS_MANIFEST } from "../sprites/gear-parts.js";

/** §28 the packed sprite MULTIATLAS key (tools/artkit/pack-atlas.mjs → public/sprites/dd-sprites.json). When
 *  loaded, every non-expansion part lives here as the frame "<id>/<role>", so the WebGL batcher binds ONE
 *  texture for a whole screen of rigs instead of one per part. ArenaScene boot-loads it under this key. */
export const SPRITE_ATLAS = "dd-sprites";

/** Resolve the texture for a sprite part: the packed atlas frame "<id>/<role>" if the atlas is loaded and
 *  has it, else the loose per-part texture "<id>:<role>" (back-compat — e.g. the atlas missing a frame, or
 *  a future on-demand expansion sprite). Returns args to spread into `scene.add.image(x, y, key, frame?)`.
 *  Exported so other renderers (e.g. ground weapon-pickups) resolve textures the same way. */
export function partTexture(
  scene: Phaser.Scene,
  spriteId: string,
  role: string,
): { key: string; frame?: string } {
  if (
    isWholeArtCharacterId(spriteId) &&
    isWholeArtCharacterPartRole(role) &&
    scene.textures.exists(wholeArtCharacterTextureKey(spriteId, role))
  ) {
    return { key: wholeArtCharacterTextureKey(spriteId, role) };
  }
  const frame = `${spriteId}/${role}`;
  if (scene.textures.exists(SPRITE_ATLAS) && scene.textures.get(SPRITE_ATLAS).has(frame)) {
    return { key: SPRITE_ATLAS, frame };
  }
  return { key: `${spriteId}:${role}` };
}

/** On-screen height of the body part, in px. Everything else scales from this. (tuning) */
const TARGET_BODY_H = 76; // §37 slightly smaller characters (was 84) — reads better in the zoomed-out belt
/** Vertical "look" toward the cursor (local player): how far the torso leans with the aim's up/down. */
const BODY_LOOK_LEAN = 0.14;
/** Pointed weapons obey semantic +X. The one neutral exception to laser-flat aim is this small ready cant. */
export const MELEE_FORWARD_READY_CANT = -Math.PI / 15;

export function forwardMeleeReadyAngle(aimLocal: number): number {
  return aimLocal + MELEE_FORWARD_READY_CANT;
}
/** §45 rollback switch for Stage-1 presentation, including empty-hand fist dispatch. No gameplay reads it. */
const CLIENT_VISUAL_COMBOS = true;
/** The authored guard eases to neutral only after accepted-cadence grace lapses. */
const COMBO_HOLD_RELEASE_MS = 120;
/** Sparkmitt accepts a new hand every 120 ms, but its former 76.8 ms pose could begin and end between
 * low-rate rendered frames. Cadence remains authoritative; this only keeps each monk strike readable. */
const MONK_FLURRY_MIN_POSE_MS = 240;
/** G3 presentation-only bridge. It is capped below one tenth of a second and never retimes a descriptor. */
export const COMBO_STAGE_TRANSITION_MAX_MS = 80;
const MELEE_GLINT_LEAD_MS = 280;
const MELEE_GLINT_CREST_MS = 60;
/** Open books bridge the authoritative held latch, then remain readable for one quiet settling beat. */
const TOME_IDLE_CLOSE_MS = 600;
const TOME_PAGE_INTERVAL_MS = 300;
const TOME_PAGE_DURATION_MS = 320;
const TOME_SETTLE_DURATION_MS = 260;
const TOME_SCRAP_DURATION_MS = 540;
/** Remote accepted attacks reuse the authored renderer only while their source can affect the camera read. */
const REMOTE_SIGNATURE_LOD_MARGIN_PX = 220;
/** Retained cast/tome source punctuation. It is sampled on the hit-stop-paused rig clock. */
const REMOTE_SOURCE_FLASH_MS = 150;
/** Ranged implements stay shouldered for one readable beat after the fire latch releases. */
export const RANGED_AIM_LINGER_MS = 250;
export const RANGED_AIM_RAISE_MS = 90;
export const RANGED_AIM_SETTLE_MS = 180;
const GUN_RECOIL_ACTIVE_MS = 140;
/** A pistol is not quiet while its accepted shot is still in the retained recoil/recovery pose. */
export const RANGED_GUN_RECOVERY_MS = GUN_RECOIL_ACTIVE_MS + RANGED_AIM_SETTLE_MS;
/** The rear held blade's ordinary idle lean is added by the weapon pass. Close-blade poses compensate it. */
const DUAL_BACK_WEAPON_LEAN = 0.32;
/** Close-blade lunges are fully released before a cadence hold can sample `tt = 1`. */
const CLOSE_BLADE_RELEASE_T = 0.92;

type RigComboFamily = MeleeComboFamily | "none";

export type RigSwingHand = 0 | 1 | "both";

export interface RigLoadoutPiece {
  readonly spriteId: string;
  readonly def: WeaponDef;
  readonly manifest: SpriteManifest;
  /** Authored twin sprites are the only loadout allowed to select part 1. Arbitrary pairs use part 0. */
  readonly partIndex?: 0 | 1;
}

export type WrapRigReceiver = "hand-r" | "hand-l" | "foot-r" | "foot-l";

export interface WrapRigMount {
  readonly receiver: WrapRigReceiver;
  readonly partIndex: 0 | 1;
}

const NO_WRAP_RIG_MOUNTS = Object.freeze([] as readonly WrapRigMount[]);
const FOUR_LIMB_WRAP_RIG_MOUNTS = Object.freeze([
  Object.freeze({ receiver: "hand-r", partIndex: 0 }),
  Object.freeze({ receiver: "hand-l", partIndex: 0 }),
  Object.freeze({ receiver: "foot-r", partIndex: 1 }),
  Object.freeze({ receiver: "foot-l", partIndex: 1 }),
] as const satisfies readonly WrapRigMount[]);

/** One hand source and one foot source become four independent joint-mounted worn sprites. */
export function wrapRigMountPlan(
  def: Readonly<WeaponDef>,
  manifest: Readonly<SpriteManifest>,
): readonly WrapRigMount[] {
  return def.glovePair?.wrapsFeet === true && manifest.parts.length >= 2
    ? FOUR_LIMB_WRAP_RIG_MOUNTS
    : NO_WRAP_RIG_MOUNTS;
}

/** Final horizontal art sign: the actor root owns facing; each source keeps its authored image direction. */
export function wrapRigFacingSign(actorFacing: -1 | 1, imageFacingX: -1 | 1): -1 | 1 {
  return actorFacing * imageFacingX < 0 ? -1 : 1;
}

/** Optional rig-only routing metadata. Shared combat truth remains the immutable SwingDescriptor payload. */
export interface RigSwingDescriptor extends SwingDescriptor {
  readonly hand?: RigSwingHand;
  readonly pairStep?: number;
}

/** Final held-blade affine sampled after every rig pose writer. Extension renderers consume this value
 * directly; they must never reconstruct aim, facing, recoil, orbit, or combo pose from actor coordinates. */
export interface WeaponBladeAttachmentPose {
  readonly sourceId: string;
  readonly weaponId: string;
  readonly hand: 0 | 1;
  readonly comboId: string;
  readonly comboStep: number;
  readonly comboStartedAtMs: number;
  readonly comboExpiresAtMs: number;
  readonly comboActive: boolean;
  readonly nowMs: number;
  readonly wielderX: number;
  readonly wielderY: number;
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly axisX: number;
  readonly axisY: number;
  readonly normalX: number;
  readonly normalY: number;
  readonly physicalBladeLength: number;
  readonly bladeWidth: number;
  readonly depth: number;
}

/** Measure the opaque blade span where the extension begins. The median across a narrow axial band rejects
 * one-pixel chips/sparks while keeping the result entirely derived from the equipped sprite. */
export function measureBladeWidthAtExtensionJoin(
  width: number,
  height: number,
  gripFraction: number,
  alphaAt: (x: number, y: number) => number,
): number {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const grip = clamp01(gripFraction);
  const physicalLength = Math.max(1, (1 - grip) * w);
  const joinX = w - physicalLength * BLADE_EXTENSION_OVERLAP_FRACTION;
  const bandRadius = Math.max(1, Math.round(w * 0.015));
  const spans: number[] = [];
  for (
    let x = Math.max(0, Math.floor(joinX) - bandRadius);
    x <= Math.min(w - 1, Math.ceil(joinX) + bandRadius);
    x++
  ) {
    let largest = 0;
    let run = 0;
    for (let y = 0; y < h; y++) {
      if (alphaAt(x, y) >= 32) {
        run++;
        largest = Math.max(largest, run);
      } else run = 0;
    }
    if (largest > 0) spans.push(largest);
  }
  if (spans.length === 0) return 1;
  spans.sort((a, b) => a - b);
  return spans[Math.floor(spans.length / 2)] ?? 1;
}

interface ComboChainState {
  family: RigComboFamily;
  step: number;
  expiresAtMs: number;
  chainExpiresAtMs: number;
  weaponId: string;
  hasAttackSeq: boolean;
  attackSeq: number;
  acceptedAtMs: number;
  generation: number;
  startedAtMs: number;
}

interface ComboStageTransitionState {
  readonly acceptedAtMs: number;
  readonly startedAtMs: number;
  readonly deadlineAtMs: number;
  readonly durationMs: number;
  readonly root: Readonly<ComboStageParentTransform>;
  readonly parts: ReadonlyArray<{
    readonly node: ComboStageTransformNode;
    readonly previous: Readonly<ComboStagePoseTransform>;
  }>;
  readonly shadows: ReadonlyArray<{
    readonly node: ComboStageTransformNode;
    readonly previous: Readonly<ComboStagePoseTransform>;
  }>;
}

interface ComboStageTransformNode extends ComboStagePoseTransform {
  readonly active: boolean;
}

function createComboChainState(): ComboChainState {
  return {
    family: "none",
    step: 0,
    expiresAtMs: -1e9,
    chainExpiresAtMs: -1e9,
    weaponId: "",
    hasAttackSeq: false,
    attackSeq: 0,
    acceptedAtMs: -1e9,
    generation: 0,
    startedAtMs: -1e9,
  };
}

const CROSSFALL_STEP = Object.freeze({
  name: "crossfall",
  motion: "scissor" as const,
  direction: 0 as const,
  hand: "both" as const,
  timing: {
    activeStart: 0.2,
    activeEnd: 0.52,
    secondaryActiveStart: 0.26,
    secondaryActiveEnd: 0.58,
    impact: 0.47,
    followEnd: 0.8,
  },
  path: {
    kind: "dual-sweep" as const,
    arcMultiplier: 0.9,
    rangeMultiplier: 1.05,
    damageMultiplier: 1.3,
    knockback: 84,
  },
  ribbon: {
    profile: "broken-cross" as const,
    radialStart: 0.3,
    radialEnd: 1,
    widthMultiplier: 1.3,
    end: "open" as const,
    setupEcho: "neutral-dim" as const,
  },
} satisfies Readonly<MeleeComboStep>);

export interface SwingChannelSample {
  readonly weaponAngle: number;
  readonly backWeaponAngle: number;
  readonly swingOffX: number;
  readonly swingOffY: number;
  readonly swingBackOffX: number;
  readonly swingBackOffY: number;
  readonly ownFront: number;
  readonly ownBack: number;
}

/** Pure post-dispatch channel router: an off beat moves only the rear implement/hand. */
export function routeSwingChannels(
  sample: SwingChannelSample,
  hand: RigSwingHand,
  restAngle: number,
  offLean: number,
): SwingChannelSample {
  if (hand !== 1) return sample;
  return {
    weaponAngle: restAngle,
    backWeaponAngle: sample.weaponAngle - offLean,
    swingOffX: 0,
    swingOffY: 0,
    swingBackOffX: sample.swingOffX,
    swingBackOffY: sample.swingOffY,
    ownFront: 0,
    ownBack: Math.max(sample.ownFront, sample.ownBack),
  };
}

/** Live sequence truth only; timeout and familiar historical bar lengths never earn punctuation. */
export function isTerminalFlourishStep(step: number, sequenceLength: number): boolean {
  return sequenceLength > 0 && step === sequenceLength - 1;
}

export function flourishStreakWindowMs(effectiveCooldown: number): number {
  return Math.max(320, Math.min(850, effectiveCooldown * 2.2 * 1000));
}

export interface RawFlourishIntent {
  attack: boolean;
  parryOrBrace: boolean;
  jumpOrDodge: boolean;
  interaction: boolean;
  weaponSelection: boolean;
  desiredMoveX: number;
  desiredMoveY: number;
}

/** Raw desired axes own flourish cancellation; collision/resolved displacement never enters this decision. */
export function flourishMovementIntent(
  previousX: number,
  previousY: number,
  desiredX: number,
  desiredY: number,
): boolean {
  const previousLength = Math.hypot(previousX, previousY);
  const desiredLength = Math.hypot(desiredX, desiredY);
  if (desiredLength <= 0.001) return false;
  if (previousLength <= 0.001) return true;
  const directionDot =
    (previousX * desiredX + previousY * desiredY) / (previousLength * desiredLength);
  const directionChange = Math.acos(Math.max(-1, Math.min(1, directionDot)));
  return directionChange > MOVE_HITCH_MIN_ANGLE + 1e-10;
}

/** One per-frame Arena capture, including requests rejected by gameplay cooldowns or collision. */
export function rawFlourishIntentCancels(
  input: Readonly<RawFlourishIntent>,
  previousMoveX: number,
  previousMoveY: number,
): boolean {
  return (
    input.attack ||
    input.parryOrBrace ||
    input.jumpOrDodge ||
    input.interaction ||
    input.weaponSelection ||
    flourishMovementIntent(previousMoveX, previousMoveY, input.desiredMoveX, input.desiredMoveY)
  );
}

export function nextFlourishStreakCount(
  previousCount: number,
  previousAcceptedMs: number,
  sameWeapon: boolean,
  acceptedMs: number,
  streakWindowMs: number,
): number {
  return sameWeapon && acceptedMs - previousAcceptedMs <= streakWindowMs ? previousCount + 1 : 1;
}

export const PISTOL_IDLE_TWIRL_DELAY_MS = 500;
export const PISTOL_DUAL_TWIRL_STAGGER_MS = 40;
const GENERIC_IDLE_FLOURISH_DELAY_MS = 1_600;
export const DUAL_PISTOL_HAND_RISE_BODY_FRAC = 0.035;

/** One data-driven timer law shared by equip, cancellation, and held-fire activity. */
export function idleFlourishEligibleEpoch(
  def: WeaponDef | undefined,
  activityAtMs: number,
  genericPhaseOffsetMs: number,
  recoveryEndsAtMs = activityAtMs,
): number {
  const quietBeginsAtMs = weaponHasHandlingTag(def, "pistol")
    ? Math.max(activityAtMs, Number.isFinite(recoveryEndsAtMs) ? recoveryEndsAtMs : activityAtMs)
    : activityAtMs;
  return (
    quietBeginsAtMs +
    (weaponHasHandlingTag(def, "pistol")
      ? PISTOL_IDLE_TWIRL_DELAY_MS
      : GENERIC_IDLE_FLOURISH_DELAY_MS + genericPhaseOffsetMs)
  );
}

/** SpriteRig layout offset in body-height units. Only a real pistol+pistol pair gets the raised lead hand. */
export function dualPistolHandYOffset(
  lead: WeaponDef | undefined,
  off: WeaponDef | undefined,
  hand: 0 | 1,
): number {
  if (!weaponHasHandlingTag(lead, "pistol") || !weaponHasHandlingTag(off, "pistol")) return 0;
  return hand === 0 ? -DUAL_PISTOL_HAND_RISE_BODY_FRAC : 0;
}

export type GunHandlingMechanism = "bolt" | "lever" | "pump";

interface GunHandlingCycleState {
  active: boolean;
  acceptedSeq: number;
  mechanism?: GunHandlingMechanism;
  startMs: number;
  weaponId: string;
}

function createGunHandlingCycleState(): GunHandlingCycleState {
  return {
    active: false,
    acceptedSeq: 0,
    startMs: -1e9,
    weaponId: "",
  };
}

export function gunHandlingMechanismFor(
  def: WeaponDef | undefined,
): GunHandlingMechanism | undefined {
  if (!def?.gun) return undefined;
  if (weaponHasHandlingTag(def, "bolt")) return "bolt";
  if (weaponHasHandlingTag(def, "lever")) return "lever";
  if (weaponHasHandlingTag(def, "pump")) return "pump";
  return undefined;
}

export interface GunHandlingHandOffset {
  forward: number;
  lateral: number;
}

/** Keep a complete mechanism stroke inside the accepted trigger cadence. Fast paired levers still get a
 * compact readable cycle per shot instead of accumulating or waiting for a quiet flourish window. */
export function gunHandlingCycleDurationMs(
  mechanism: GunHandlingMechanism | undefined,
  fireRateSeconds: number | undefined,
): number {
  if (!mechanism) return 0;
  const authoredMs = mechanism === "bolt" ? 520 : mechanism === "pump" ? 240 : 220;
  if (!fireRateSeconds || fireRateSeconds <= 0) return authoredMs;
  return Math.min(authoredMs, Math.max(96, fireRateSeconds * 1000 - 24));
}

/** Allocation-free accepted-shot mechanism phases in painted-weapon space. Pump explicitly travels back
 * then forward to home; lever explicitly travels down then up to home; bolt visits four authored extrema:
 * back (unbolt), down (lift), up (re-seat), then forward (ram home) before settling to its painted anchor. */
export function sampleGunHandlingHandOffset(
  mechanism: GunHandlingMechanism | undefined,
  elapsedMs: number,
  durationMs: number,
  displayLength: number,
  reducedMotion: boolean,
  out: GunHandlingHandOffset,
): GunHandlingHandOffset {
  out.forward = 0;
  out.lateral = 0;
  if (!mechanism || reducedMotion || elapsedMs < 0 || durationMs <= 0 || elapsedMs >= durationMs)
    return out;
  const q = clamp01(elapsedMs / durationMs);
  const phasedStroke = (peakAt: number): number =>
    q <= peakAt ? smoothstep01(q / peakAt) : 1 - smoothstep01((q - peakAt) / (1 - peakAt));
  if (mechanism === "bolt") {
    const phases = [
      { q: 0, forward: 0, lateral: 0 },
      { q: 0.3, forward: -0.115, lateral: 0 },
      { q: 0.5, forward: -0.08, lateral: 0.1 },
      { q: 0.68, forward: -0.04, lateral: -0.09 },
      { q: 0.86, forward: 0.08, lateral: 0 },
      { q: 1, forward: 0, lateral: 0 },
    ] as const;
    let phaseIndex = 0;
    while (phaseIndex < phases.length - 2) {
      const next = phases[phaseIndex + 1];
      if (!next || q <= next.q) break;
      phaseIndex++;
    }
    const from = phases[phaseIndex] ?? phases[0];
    const to = phases[phaseIndex + 1] ?? phases[5];
    const t = smoothstep01((q - from.q) / Math.max(0.001, to.q - from.q));
    out.forward = displayLength * (from.forward + (to.forward - from.forward) * t);
    out.lateral = displayLength * (from.lateral + (to.lateral - from.lateral) * t);
    return out;
  }
  if (mechanism === "pump") {
    out.forward = -displayLength * 0.1 * phasedStroke(0.42);
    return out;
  }
  const stroke = phasedStroke(0.4);
  out.forward = -displayLength * 0.035 * stroke;
  out.lateral = displayLength * 0.07 * stroke;
  return out;
}

export interface SecondaryGripTransformInput {
  primaryX: number;
  primaryY: number;
  spriteWidth: number;
  spriteHeight: number;
  scaleX: number;
  scaleY: number;
  rotationRad: number;
  primary: Readonly<{ x: number; y: number }>;
  secondary: Readonly<{ x: number; y: number }>;
  flourishForward: number;
  flourishLateral: number;
}

/** Convert normalized painted anchors into the rig-local hand point after scale, rotation, and flourish. */
export function resolveSecondaryGripPosition(
  input: Readonly<SecondaryGripTransformInput>,
  out: { x: number; y: number },
): { x: number; y: number } {
  const localX =
    (input.secondary.x - input.primary.x) * input.spriteWidth * input.scaleX +
    input.flourishForward;
  const localY =
    (input.secondary.y - input.primary.y) * input.spriteHeight * input.scaleY +
    input.flourishLateral;
  const c = Math.cos(input.rotationRad);
  const s = Math.sin(input.rotationRad);
  out.x = input.primaryX + c * localX - s * localY;
  out.y = input.primaryY + s * localX + c * localY;
  return out;
}

export { secondaryGripHandRendersAbove } from "../sprites/secondary-grip.js";

/** ArenaScene owns these presentation services. The rig consumes them structurally so the accepted remote
 * beat can share the existing authored dispatcher without widening the scene API or duplicating VFX data. */
interface RigAttackPresentationScene extends Phaser.Scene {
  readonly vfxPlayer?: {
    spawnsAtCursor(weaponId: string): boolean;
  };
  spawnSlash?(
    x: number,
    y: number,
    aim: { x: number; y: number },
    weapon: WeaponDef,
    swing: SwingDescriptor,
    exact?: boolean,
    target?: Readonly<{ x: number; y: number }>,
    sourceBladePose?: () => WeaponBladeAttachmentPose | undefined,
  ): void;
  spawnChain?(x: number, y: number, aim: { x: number; y: number }, weapon: WeaponDef): void;
  readonly animClock?: number;
  readonly frozenUntil?: number;
  readonly wasFrozen?: boolean;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothstep01(value: number): number {
  const p = clamp01(value);
  return p * p * (3 - 2 * p);
}

function smootherstep01(value: number): number {
  const p = clamp01(value);
  return p * p * p * (p * (p * 6 - 15) + 10);
}

function cubicOut01(value: number): number {
  const p = clamp01(value);
  return 1 - (1 - p) ** 3;
}

function backOut01(value: number): number {
  const p = clamp01(value) - 1;
  return 1 + p * p * (2.70158 * p + 1.70158);
}

function mixAngle(from: number, to: number, t: number): number {
  const delta = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + delta * clamp01(t);
}

type ComboStageTransitionTiming = Pick<
  RigSwingDescriptor,
  "activeStartSeconds" | "poseSeconds" | "comboTiming"
>;

/** Finish the bridge inside the selected step's authoritative anticipation, capped for unchanged cadence. */
export function comboStageTransitionDurationMs(swing: ComboStageTransitionTiming): number {
  const activeStartSeconds = swing.comboTiming
    ? swing.comboTiming.activeStart * swing.poseSeconds
    : swing.activeStartSeconds;
  return Math.min(COMBO_STAGE_TRANSITION_MAX_MS, Math.max(0, activeStartSeconds * 1000 * 0.8));
}

export function comboStageTransitionBlend(elapsedMs: number, durationMs: number): number {
  if (durationMs <= 0) return 1;
  return smoothstep01(elapsedMs / durationMs);
}

/** The local paper channels bridged at a combo boundary. Root/world position is intentionally absent. */
export interface ComboStagePoseTransform {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

export interface ComboStageParentTransform {
  rotation: number;
  scaleX: number;
  scaleY: number;
}

/** Mutating pure sampler used by SpriteRig and no-discontinuity regression tests. `target` may equal `out`. */
export function blendComboStagePoseTransform(
  previous: Readonly<ComboStagePoseTransform>,
  target: Readonly<ComboStagePoseTransform>,
  elapsedMs: number,
  durationMs: number,
  out: ComboStagePoseTransform,
): void {
  const blend = comboStageTransitionBlend(elapsedMs, durationMs);
  const targetX = target.x;
  const targetY = target.y;
  const targetRotation = target.rotation;
  const targetScaleX = target.scaleX;
  const targetScaleY = target.scaleY;
  out.x = previous.x + (targetX - previous.x) * blend;
  out.y = previous.y + (targetY - previous.y) * blend;
  out.rotation = mixAngle(previous.rotation, targetRotation, blend);
  out.scaleX = previous.scaleX + (targetScaleX - previous.scaleX) * blend;
  out.scaleY = previous.scaleY + (targetScaleY - previous.scaleY) * blend;
}

/**
 * Preserve a presentation-only child's screen orientation while its combat-truth parent rotation changes.
 * Parent translation is deliberately absent: movement/netcode continue to own root x/y without smoothing.
 */
export function blendComboStagePresentationTransform(
  previous: Readonly<ComboStagePoseTransform>,
  previousParent: Readonly<ComboStageParentTransform>,
  target: Readonly<ComboStagePoseTransform>,
  targetParent: Readonly<ComboStageParentTransform>,
  elapsedMs: number,
  durationMs: number,
  out: ComboStagePoseTransform,
): void {
  const previousRootCos = Math.cos(previousParent.rotation);
  const previousRootSin = Math.sin(previousParent.rotation);
  const targetRootCos = Math.cos(targetParent.rotation);
  const targetRootSin = Math.sin(targetParent.rotation);
  const previousScaledX = previous.x * previousParent.scaleX;
  const previousScaledY = previous.y * previousParent.scaleY;
  const previousWorldX = previousScaledX * previousRootCos - previousScaledY * previousRootSin;
  const previousWorldY = previousScaledX * previousRootSin + previousScaledY * previousRootCos;
  const targetParentX = previousWorldX * targetRootCos + previousWorldY * targetRootSin;
  const targetParentY = -previousWorldX * targetRootSin + previousWorldY * targetRootCos;
  const rebasedPreviousX = targetParentX / targetParent.scaleX;
  const rebasedPreviousY = targetParentY / targetParent.scaleY;

  const previousAxisX = Math.cos(previous.rotation) * previousParent.scaleX;
  const previousAxisY = Math.sin(previous.rotation) * previousParent.scaleY;
  const previousAxisWorldX = previousAxisX * previousRootCos - previousAxisY * previousRootSin;
  const previousAxisWorldY = previousAxisX * previousRootSin + previousAxisY * previousRootCos;
  const targetAxisParentX =
    (previousAxisWorldX * targetRootCos + previousAxisWorldY * targetRootSin) / targetParent.scaleX;
  const targetAxisParentY =
    (-previousAxisWorldX * targetRootSin + previousAxisWorldY * targetRootCos) /
    targetParent.scaleY;
  const rebasedPreviousRotation = Math.atan2(targetAxisParentY, targetAxisParentX);

  const blend = comboStageTransitionBlend(elapsedMs, durationMs);
  const targetX = target.x;
  const targetY = target.y;
  const targetRotation = target.rotation;
  const targetScaleX = target.scaleX;
  const targetScaleY = target.scaleY;
  out.x = rebasedPreviousX + (targetX - rebasedPreviousX) * blend;
  out.y = rebasedPreviousY + (targetY - rebasedPreviousY) * blend;
  out.rotation = mixAngle(rebasedPreviousRotation, targetRotation, blend);
  out.scaleX = previous.scaleX + (targetScaleX - previous.scaleX) * blend;
  out.scaleY = previous.scaleY + (targetScaleY - previous.scaleY) * blend;
}

function stepAngleBounded(from: number, to: number, maxDelta: number): number {
  const delta = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + Math.max(-maxDelta, Math.min(maxDelta, delta));
}

function paperPopScaleX(elapsedMs: number, durationMs: number): number {
  const q = clamp01(elapsedMs / durationMs);
  if (q > 0.72) return 1;
  return 0.82 + 0.18 * backOut01(q / 0.72);
}

function paperPopScaleY(elapsedMs: number, durationMs: number): number {
  const q = clamp01(elapsedMs / durationMs);
  if (q <= 0.72) return -0.04 + 1.12 * backOut01(q / 0.72);
  return 1.08 - 0.08 * smoothstep01((q - 0.72) / 0.28);
}

/** Phaser's core display objects have no typed skew; a small counter-rotation supplies the shear cue. */
function paperPopRotation(elapsedMs: number, durationMs: number): number {
  const q = clamp01(elapsedMs / durationMs);
  if (q > 0.72) return 0.045 * (1 - smoothstep01((q - 0.72) / 0.28));
  return 0.045 * (1 - clamp01(backOut01(q / 0.72)));
}

/** Preserve the sign while preventing one invisible edge-on frame. Zero chooses the positive face. */
function signedClamp(value: number, floor: number): number {
  return (value < 0 ? -1 : 1) * Math.max(Math.abs(value), floor);
}

export interface PairCeremonySample {
  readonly active: boolean;
  /** 0 at the ordinary ready pose, 1 at the held chest-height X. */
  readonly crossBlend: number;
  readonly leadScaleX: number;
  readonly offScaleX: number;
  readonly glintAlpha: number;
  readonly ruffle: number;
}

/** The accepted bind's 460 ms paper flip, expressed without Phaser so its timing remains testable. */
export function samplePairCeremony(elapsedMs: number): PairCeremonySample {
  if (elapsedMs < 0 || elapsedMs >= 460) {
    return {
      active: false,
      crossBlend: 0,
      leadScaleX: 1,
      offScaleX: 1,
      glintAlpha: 0,
      ruffle: 0,
    };
  }
  const crossBlend =
    elapsedMs < 90
      ? smoothstep01(elapsedMs / 90) * 0.24
      : elapsedMs < 230
        ? 0.24 + smoothstep01((elapsedMs - 90) / 140) * 0.76
        : elapsedMs < 360
          ? 1
          : 1 - smoothstep01((elapsedMs - 360) / 100);
  const flipScale = (startMs: number, endMs: number): number => {
    if (elapsedMs < startMs) return 1;
    if (elapsedMs < endMs) {
      return signedClamp(Math.cos(Math.PI * ((elapsedMs - startMs) / (endMs - startMs))), 0.055);
    }
    if (elapsedMs < 360) return -1;
    return signedClamp(-Math.cos(Math.PI * ((elapsedMs - 360) / 100)), 0.055);
  };
  const glintAlpha =
    elapsedMs < 220 || elapsedMs >= 360
      ? 0
      : Math.min(1, (elapsedMs - 220) / 18, (360 - elapsedMs) / 26);
  const ruffle = elapsedMs < 360 ? 0 : Math.sin(Math.PI * ((elapsedMs - 360) / 100));
  return {
    active: true,
    crossBlend,
    leadScaleX: flipScale(90, 190),
    offScaleX: flipScale(130, 230),
    glintAlpha,
    ruffle,
  };
}

function attackSignatureColor(element: WeaponDef["tags"]["element"]): number {
  switch (element) {
    case "fire":
      return 0xff6a2a;
    case "frost":
      return 0x6fd6ff;
    case "shock":
      return 0xffe24a;
    case "holy":
      return 0xffe6a0;
    case "toxic":
      return 0x9cff3b;
    case "void":
      return 0xb14bff;
    case "arcane":
      return 0x8f6aff;
    default:
      return 0xd6dde6;
  }
}

/** PROCEDURAL_JIGGLE ownership envelope: anticipation ramps in, active is exact, follow-through hands off. */
function actionOwnershipAt(
  t: number,
  activeStart: number,
  activeEnd: number,
  followEnd: number,
): number {
  if (t < activeStart) return smootherstep01(activeStart > 0 ? t / activeStart : 1);
  if (t <= activeEnd) return 1;
  if (t < followEnd)
    return 1 - smootherstep01((t - activeEnd) / Math.max(1e-6, followEnd - activeEnd));
  return 0;
}

/** Preserve an authored normalized pose while moving its one visible contact onto the immutable descriptor
 * impact. Used only by panel-routed quake carriers; it never changes descriptor or server time. */
function remapPoseTimeAtImpact(
  t: number,
  authoredImpact: number,
  descriptorImpact: number,
): number {
  const source = clamp01(authoredImpact);
  const target = clamp01(descriptorImpact);
  if (Math.abs(source - target) < 1e-6) return t;
  if (t <= target) return source * (target > 1e-6 ? t / target : 1);
  return source + (1 - source) * ((t - target) / Math.max(1e-6, 1 - target));
}

export type CloseBladePoseVariant = Extract<MeleeComboVariant, "dagger" | "claw">;

/** Pure, allocation-free input for the close-blade pose. Distances are world pixels except `aimLocal`. */
export interface CloseBladePoseInput {
  t: number;
  serverActiveStart: number;
  serverActiveEnd: number;
  aimLocal: number;
  effectiveCooldown: number;
  targetTipRadius: number;
  businessLength: number;
  rigScale: number;
  direction: -1 | 0 | 1;
  hand: MeleeComboHand;
  hasRearWeapon: boolean;
  variant: CloseBladePoseVariant;
}

/** Scalar/vector channels sampled by {@link sampleCloseBladePose}; SpriteRig remains the only writer. */
export interface CloseBladePoseSample {
  frontAngle: number;
  backAngle: number;
  frontGripX: number;
  frontGripY: number;
  frontGripBlend: number;
  backGripX: number;
  backGripY: number;
  backGripBlend: number;
  frontOwn: number;
  backOwn: number;
  feetOwn: number;
  frontFootX: number;
  frontFootY: number;
  frontFootBlend: number;
  backFootX: number;
  backFootY: number;
  backFootBlend: number;
  bodyX: number;
  bodyY: number;
  bodyRotation: number;
  bodyScaleX: number;
  bodyScaleY: number;
  artX: number;
  artY: number;
  shadowX: number;
  shadowY: number;
  shadowRotation: number;
  shadowScaleX: number;
  shadowScaleY: number;
}

/** Constructed once per rig (or explicitly by a pure test), never once per animation frame. */
export function createCloseBladePoseInput(): CloseBladePoseInput {
  return {
    t: 0,
    serverActiveStart: 0,
    serverActiveEnd: 1,
    aimLocal: 0,
    effectiveCooldown: 0,
    targetTipRadius: 0,
    businessLength: 0,
    rigScale: 1,
    direction: 1,
    hand: "lead",
    hasRearWeapon: false,
    variant: "claw",
  };
}

/** Constructed once per rig (or explicitly by a pure test), never once per animation frame. */
export function createCloseBladePoseSample(): CloseBladePoseSample {
  return {
    frontAngle: 0,
    backAngle: 0,
    frontGripX: 0,
    frontGripY: 0,
    frontGripBlend: 0,
    backGripX: 0,
    backGripY: 0,
    backGripBlend: 0,
    frontOwn: 0,
    backOwn: 0,
    feetOwn: 0,
    frontFootX: 0,
    frontFootY: 0,
    frontFootBlend: 0,
    backFootX: 0,
    backFootY: 0,
    backFootBlend: 0,
    bodyX: 0,
    bodyY: 0,
    bodyRotation: 0,
    bodyScaleX: 1,
    bodyScaleY: 1,
    artX: 0,
    artY: 0,
    shadowX: 0,
    shadowY: 0,
    shadowRotation: 0,
    shadowScaleX: 1,
    shadowScaleY: 1,
  };
}

/**
 * Full-body close-blade sampler. The selected hand reaches an absolute grip derived from the truthful tip
 * radius; the support hand guards, feet plant/kick, and only the slower third beat receives a tiny paper-art
 * advance. Every lunge channel is identity by `CLOSE_BLADE_RELEASE_T`, so a late remote sample or cadence
 * hold cannot replay/retain reach. Stage 1 keeps one dominant positive-path contact.
 */
export function sampleCloseBladePose(input: CloseBladePoseInput, out: CloseBladePoseSample): void {
  const t = clamp01(input.t);
  const activeStart = clamp01(input.serverActiveStart);
  const activeEnd = Math.max(activeStart + 1e-4, clamp01(input.serverActiveEnd));
  const finisher = input.hand === "both";
  const dagger = input.variant === "dagger";
  const semanticDirection = input.direction < 0 ? -1 : 1;
  const contact = activeStart + (activeEnd - activeStart) * (finisher ? 0.5 : 0.54);
  const retractEnd = Math.min(CLOSE_BLADE_RELEASE_T - 0.04, activeEnd + 0.12);
  let targetBlend = 0;
  let reachMix = 0;
  let commit = 0;
  let activeProgress = 0;
  let recovery = 0;
  if (t < activeStart) {
    const p = smootherstep01(activeStart > 0 ? t / activeStart : 1);
    targetBlend = p;
    commit = 0.24 * p;
  } else if (t < contact) {
    const p = cubicOut01((t - activeStart) / Math.max(1e-4, contact - activeStart));
    targetBlend = 1;
    reachMix = p;
    commit = 0.24 + 0.76 * p;
    activeProgress = (t - activeStart) / (activeEnd - activeStart);
  } else if (t <= activeEnd) {
    activeProgress = (t - activeStart) / (activeEnd - activeStart);
    targetBlend = 1;
    reachMix = 1;
    commit = 1 - 0.08 * smoothstep01((t - contact) / Math.max(1e-4, activeEnd - contact));
  } else if (t < retractEnd) {
    recovery = smoothstep01((t - activeEnd) / Math.max(1e-4, retractEnd - activeEnd));
    targetBlend = 1;
    reachMix = 1 - recovery;
    commit = 0.92 - 0.68 * recovery;
    activeProgress = 1;
  } else if (t < CLOSE_BLADE_RELEASE_T) {
    recovery = 1;
    targetBlend =
      1 - smootherstep01((t - retractEnd) / Math.max(1e-4, CLOSE_BLADE_RELEASE_T - retractEnd));
    commit = 0.24 * targetBlend;
    activeProgress = 1;
  } else {
    recovery = 1;
    activeProgress = 1;
  }

  const fx = Math.cos(input.aimLocal);
  const fy = Math.sin(input.aimLocal);
  const nx = -fy;
  const ny = fx;
  const rigScale = Math.max(1e-4, Math.abs(input.rigScale));
  const worldToLocal = 1 / rigScale;
  const maxArtWorld = finisher
    ? input.effectiveCooldown <= 0.22
      ? 0
      : input.effectiveCooldown <= 0.34
        ? 3
        : 6
    : 0;
  const artWorld = maxArtWorld * commit;
  out.artX = fx * artWorld * worldToLocal;
  out.artY = fy * artWorld * worldToLocal;
  const shadowWorld = Math.min(3, artWorld * 0.62);
  out.shadowX = fx * shadowWorld * worldToLocal;
  out.shadowY = fy * shadowWorld * worldToLocal;
  out.shadowRotation = input.aimLocal * (artWorld > 0 ? 0.025 : 0);
  out.shadowScaleX = 1 + (artWorld / 6) * 0.08;
  out.shadowScaleY = 1 - (artWorld / 6) * 0.06;

  const halfTravel = dagger ? 0.16 : 0.32;
  const chamberTravel = dagger ? 0.36 : 0.62;
  const guardTravel = dagger ? 0.74 : 0.88;
  const primaryEndAngle = input.aimLocal + halfTravel;
  const primaryChamberAngle = input.aimLocal - semanticDirection * chamberTravel;
  const primaryGuardAngle = input.aimLocal + semanticDirection * guardTravel;
  let primaryAngle: number;
  if (t < activeStart) {
    const p = smoothstep01(activeStart > 0 ? t / activeStart : 1);
    primaryAngle = mixAngle(primaryGuardAngle, primaryChamberAngle, p);
  } else if (t < contact) {
    primaryAngle = mixAngle(primaryChamberAngle, input.aimLocal, reachMix);
  } else if (t <= activeEnd) {
    primaryAngle = mixAngle(
      input.aimLocal,
      primaryEndAngle,
      (t - contact) / Math.max(1e-4, activeEnd - contact),
    );
  } else {
    primaryAngle = mixAngle(primaryEndAngle, primaryGuardAngle, recovery);
  }
  const secondaryChamberAngle =
    input.aimLocal + (finisher ? chamberTravel : semanticDirection * 0.72);
  const secondaryGuardAngle = input.aimLocal - semanticDirection * guardTravel;
  const secondaryEndAngle = input.aimLocal + halfTravel * 0.7 + (finisher ? 0.06 : 0);
  let secondaryAngle: number;
  if (t < activeStart) {
    const p = smoothstep01(activeStart > 0 ? t / activeStart : 1);
    secondaryAngle = mixAngle(secondaryGuardAngle, secondaryChamberAngle, p);
  } else if (finisher && t < contact) {
    secondaryAngle = mixAngle(
      secondaryChamberAngle,
      input.aimLocal + 0.06,
      clamp01((reachMix - 0.08) / 0.92),
    );
  } else if (finisher && t <= activeEnd) {
    secondaryAngle = mixAngle(
      input.aimLocal + 0.06,
      secondaryEndAngle,
      (t - contact) / Math.max(1e-4, activeEnd - contact),
    );
  } else if (finisher) {
    secondaryAngle = mixAngle(secondaryEndAngle, secondaryGuardAngle, recovery);
  } else {
    secondaryAngle = secondaryGuardAngle;
  }

  const targetTip = Math.max(0, input.targetTipRadius);
  const guardTip = Math.min(targetTip, TARGET_BODY_H * (dagger ? 0.72 : 0.68));
  const chamberTip = Math.min(targetTip, TARGET_BODY_H * (dagger ? 0.62 : 0.58));
  const baseTip = t <= activeEnd ? chamberTip : guardTip;
  const primaryTip = baseTip + (targetTip - baseTip) * reachMix;
  const secondaryReach = finisher ? clamp01((reachMix - 0.08) / 0.92) : 0;
  const secondaryTip = guardTip + (targetTip * 0.96 - guardTip) * secondaryReach;
  const primaryGripRadius = (primaryTip - input.businessLength) * worldToLocal;
  const secondaryGripRadius = (secondaryTip - input.businessLength) * worldToLocal;
  const primaryGripX = Math.cos(primaryAngle) * primaryGripRadius - out.artX;
  const primaryGripY = Math.sin(primaryAngle) * primaryGripRadius - out.artY;
  const secondaryGripX = Math.cos(secondaryAngle) * secondaryGripRadius - out.artX;
  const secondaryGripY = Math.sin(secondaryAngle) * secondaryGripRadius - out.artY;
  const freeGuardX =
    (fx * TARGET_BODY_H * 0.12 - nx * semanticDirection * TARGET_BODY_H * 0.11) * worldToLocal -
    out.artX;
  const freeGuardY =
    (fy * TARGET_BODY_H * 0.12 - ny * semanticDirection * TARGET_BODY_H * 0.11) * worldToLocal -
    out.artY;

  const offStrikes = input.hand === "off" && input.hasRearWeapon;
  const bothStrike = finisher && input.hasRearWeapon;
  if (offStrikes) {
    out.frontAngle = secondaryGuardAngle;
    out.backAngle = primaryAngle;
    out.frontGripX = secondaryGripX;
    out.frontGripY = secondaryGripY;
    out.frontGripBlend = targetBlend * 0.68;
    out.backGripX = primaryGripX;
    out.backGripY = primaryGripY;
    out.backGripBlend = targetBlend;
  } else {
    out.frontAngle = primaryAngle;
    out.backAngle = secondaryAngle;
    out.frontGripX = primaryGripX;
    out.frontGripY = primaryGripY;
    out.frontGripBlend = targetBlend;
    out.backGripX = input.hasRearWeapon ? secondaryGripX : freeGuardX;
    out.backGripY = input.hasRearWeapon ? secondaryGripY : freeGuardY;
    out.backGripBlend = targetBlend * (bothStrike ? 1 : input.hasRearWeapon ? 0.68 : 0.58);
  }

  const own = actionOwnershipAt(t, activeStart, activeEnd, CLOSE_BLADE_RELEASE_T);
  out.frontOwn = offStrikes ? 0 : own;
  out.backOwn = offStrikes || bothStrike ? own : finisher ? own * 0.55 : 0;
  out.feetOwn = own;

  const cadence =
    input.effectiveCooldown <= 0.22 ? 0.62 : input.effectiveCooldown <= 0.34 ? 0.82 : 1;
  const bodyForwardWorld = (dagger ? (finisher ? 5 : 3) : finisher ? 6 : 4.5) * cadence * commit;
  const bodyLateralWorld = (finisher ? 0 : semanticDirection * 1.8) * cadence * commit;
  out.bodyX = (fx * bodyForwardWorld + nx * bodyLateralWorld) * worldToLocal;
  out.bodyY =
    (fy * bodyForwardWorld +
      ny * bodyLateralWorld +
      (finisher ? 3.2 : dagger ? 1.2 : 2.2) * commit) *
    worldToLocal;
  const crushX = dagger ? (finisher ? 0.08 : 0.045) : finisher ? 0.1 : 0.07;
  const crushY = dagger ? (finisher ? 0.06 : 0.025) : finisher ? 0.06 : 0.04;
  out.bodyScaleX = 1 - crushX * cadence * commit;
  out.bodyScaleY = 1 - crushY * cadence * commit;
  out.bodyRotation =
    (finisher
      ? Math.sin(activeProgress * Math.PI * 2) * 0.035
      : semanticDirection * (dagger ? 0.12 : 0.18) * Math.cos(input.aimLocal)) *
    cadence *
    commit;

  const footBlend = targetBlend;
  const footDrive = Math.min(1, commit * 1.08);
  const plantFront = finisher || input.hand !== "off";
  const plantWorld =
    TARGET_BODY_H * (input.effectiveCooldown <= 0.22 ? 0.12 : finisher ? 0.18 : 0.15);
  const trailWorld = TARGET_BODY_H * (finisher ? 0.12 : 0.1);
  const splitWorld = TARGET_BODY_H * (Math.abs(fy) > 0.78 ? 0.1 : 0.075);
  const coilWorld = TARGET_BODY_H * (finisher ? 0.1 : 0.055) * (1 - reachMix);
  const plantX =
    (fx * plantWorld * footDrive + nx * (plantFront ? 1 : -1) * coilWorld) * worldToLocal;
  const plantY =
    (fy * plantWorld * footDrive + ny * (plantFront ? 1 : -1) * coilWorld) * worldToLocal;
  const trailX =
    (-fx * trailWorld * footDrive - nx * semanticDirection * splitWorld * footDrive) * worldToLocal;
  const trailY =
    (-fy * trailWorld * footDrive - ny * semanticDirection * splitWorld * footDrive) * worldToLocal;
  if (plantFront) {
    out.frontFootX = plantX;
    out.frontFootY = plantY;
    out.backFootX = trailX;
    out.backFootY = trailY;
  } else {
    out.frontFootX = trailX;
    out.frontFootY = trailY;
    out.backFootX = plantX;
    out.backFootY = plantY;
  }
  out.frontFootBlend = footBlend;
  out.backFootBlend = footBlend;
  if (t >= CLOSE_BLADE_RELEASE_T) {
    out.frontGripBlend = 0;
    out.backGripBlend = 0;
    out.frontOwn = 0;
    out.backOwn = 0;
    out.feetOwn = 0;
    out.frontFootX = 0;
    out.frontFootY = 0;
    out.frontFootBlend = 0;
    out.backFootX = 0;
    out.backFootY = 0;
    out.backFootBlend = 0;
    out.bodyX = 0;
    out.bodyY = 0;
    out.bodyRotation = 0;
    out.bodyScaleX = 1;
    out.bodyScaleY = 1;
    out.artX = 0;
    out.artY = 0;
    out.shadowX = 0;
    out.shadowY = 0;
    out.shadowRotation = 0;
    out.shadowScaleX = 1;
    out.shadowScaleY = 1;
  }
}

/** `readyAt + grace`: 120–300ms, scaled by 35% of the accepted/predicted effective cooldown. */
function comboGraceMs(effectiveCooldown: number): number {
  return Math.min(0.3, Math.max(0.12, effectiveCooldown * 0.35)) * 1000;
}

/** Fixed inline Stage-1 state. Records are allocated only with the rig; animate mutates scalar fields. */
interface JigglePartState {
  jx: number;
  jy: number;
  jvx: number;
  jvy: number;
  prevAx: number;
  prevAy: number;
  prevAvx: number;
  prevAvy: number;
  prevOwn: number;
  springReady: boolean;
}

export interface FloatingHeadSpringState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ready: boolean;
}

export interface FloatingHeadSpringInput {
  targetX: number;
  targetY: number;
  authoredOffsetX: number;
  authoredOffsetY: number;
  impulseX: number;
  impulseY: number;
  elapsedSeconds: number;
  reducedMotion: boolean;
  reset: boolean;
}

export interface FloatingHeadSpringTuning {
  angularFrequency: number;
  dampingRatio: number;
  maxOffsetX: number;
  maxOffsetY: number;
  maxVelocity: number;
  reducedAngularFrequency: number;
  reducedMaxOffset: number;
  manifestRestInsetPx: number;
  walkBobPx: number;
  dashLagPx: number;
  slideLagPx: number;
  airHangPx: number;
  landingDipPx: number;
  bigAttackLeadPx: number;
}

/** Slightly slower and more damped than the 10rad/s, 0.32 hand channel: compact mass, not a loose limb. */
export const FLOATING_HEAD_SPRING_TUNING: Readonly<FloatingHeadSpringTuning> = Object.freeze({
  angularFrequency: 8.4,
  dampingRatio: 0.48,
  maxOffsetX: 3,
  maxOffsetY: 1.75,
  maxVelocity: 48,
  reducedAngularFrequency: 30,
  reducedMaxOffset: 0.35,
  manifestRestInsetPx: 4.5,
  walkBobPx: 0.55,
  dashLagPx: 1.4,
  slideLagPx: 1.7,
  airHangPx: 0.75,
  landingDipPx: 0.85,
  bigAttackLeadPx: 1.6,
});

/** One counter-phase step beat. The authored body socket remains the zero/rest geometry. */
export function sampleFloatingHeadWalkBob(
  stridePhase: number,
  gait: number,
  reducedMotion: boolean,
  tuning: Readonly<FloatingHeadSpringTuning> = FLOATING_HEAD_SPRING_TUNING,
): number {
  if (reducedMotion) return 0;
  return -Math.sin(stridePhase * 2) * clamp01(gait) * tuning.walkBobPx;
}

function clampFloatingHeadOffset(
  state: FloatingHeadSpringState,
  targetX: number,
  targetY: number,
  maxX: number,
  maxY: number,
): void {
  const dx = state.x - targetX;
  const dy = state.y - targetY;
  const ellipse = (dx * dx) / (maxX * maxX) + (dy * dy) / (maxY * maxY);
  if (ellipse <= 1) return;
  const scale = 1 / Math.sqrt(ellipse);
  state.x = targetX + dx * scale;
  state.y = targetY + dy * scale;
  const nx = dx / (maxX * maxX);
  const ny = dy / (maxY * maxY);
  const outward = state.vx * nx + state.vy * ny;
  const lengthSq = nx * nx + ny * ny;
  if (outward > 0 && lengthSq > 1e-8) {
    state.vx -= (outward / lengthSq) * nx;
    state.vy -= (outward / lengthSq) * ny;
  }
}

/** Exact bounded follower around the final animated body socket; stable through 50ms render gaps. */
export function stepFloatingHeadSpring(
  state: FloatingHeadSpringState,
  input: Readonly<FloatingHeadSpringInput>,
  tuning: Readonly<FloatingHeadSpringTuning> = FLOATING_HEAD_SPRING_TUNING,
): void {
  const reduced = input.reducedMotion;
  const desiredX = input.targetX + (reduced ? 0 : input.authoredOffsetX);
  const desiredY = input.targetY + (reduced ? 0 : input.authoredOffsetY);
  const maxX = reduced ? tuning.reducedMaxOffset : tuning.maxOffsetX;
  const maxY = reduced ? tuning.reducedMaxOffset : tuning.maxOffsetY;
  if (!state.ready || input.reset) {
    state.x = desiredX;
    state.y = desiredY;
    state.vx = 0;
    state.vy = 0;
    state.ready = true;
    clampFloatingHeadOffset(state, input.targetX, input.targetY, maxX, maxY);
    return;
  }

  const dt = Math.max(0, Math.min(0.05, input.elapsedSeconds));
  if (dt <= 0) return;
  if (!reduced) {
    state.vx += input.impulseX;
    state.vy += input.impulseY;
  }
  const w = reduced ? tuning.reducedAngularFrequency : tuning.angularFrequency;
  const z = reduced ? 1 : tuning.dampingRatio;
  const rx = state.x - desiredX;
  const ry = state.y - desiredY;
  let a00: number;
  let a01: number;
  let a10: number;
  let a11: number;
  if (Math.abs(z - 1) < 1e-4) {
    const decay = Math.exp(-w * dt);
    a00 = decay * (1 + w * dt);
    a01 = decay * dt;
    a10 = decay * (-w * w * dt);
    a11 = decay * (1 - w * dt);
  } else if (z < 1) {
    const damped = w * Math.sqrt(1 - z * z);
    const decay = Math.exp(-z * w * dt);
    const cosine = Math.cos(damped * dt);
    const sine = Math.sin(damped * dt);
    const ratio = (z * w) / damped;
    a00 = decay * (cosine + ratio * sine);
    a01 = decay * (sine / damped);
    a10 = decay * ((-(w * w) * sine) / damped);
    a11 = decay * (cosine - ratio * sine);
  } else {
    const damped = w * Math.sqrt(z * z - 1);
    const decay = Math.exp(-z * w * dt);
    const cosine = Math.cosh(damped * dt);
    const sine = Math.sinh(damped * dt);
    const ratio = (z * w) / damped;
    a00 = decay * (cosine + ratio * sine);
    a01 = decay * (sine / damped);
    a10 = decay * ((-(w * w) * sine) / damped);
    a11 = decay * (cosine - ratio * sine);
  }
  state.x = desiredX + a00 * rx + a01 * state.vx;
  state.y = desiredY + a00 * ry + a01 * state.vy;
  const nextVx = a10 * rx + a11 * state.vx;
  const nextVy = a10 * ry + a11 * state.vy;
  state.vx = nextVx;
  state.vy = nextVy;

  clampFloatingHeadOffset(state, input.targetX, input.targetY, maxX, maxY);
  const velocity = Math.hypot(state.vx, state.vy);
  if (velocity > tuning.maxVelocity) {
    const scale = tuning.maxVelocity / velocity;
    state.vx *= scale;
    state.vy *= scale;
  }
  if (!Number.isFinite(state.x + state.y + state.vx + state.vy)) {
    state.x = input.targetX;
    state.y = input.targetY;
    state.vx = 0;
    state.vy = 0;
  }
}

interface TomePageQuad {
  readonly quad: Phaser.GameObjects.Rectangle;
  startMs: number;
  durationMs: number;
  direction: -1 | 1;
  active: boolean;
}

interface TomeScrap {
  readonly piece: Phaser.GameObjects.Triangle;
  startMs: number;
  direction: -1 | 1;
  seed: number;
  active: boolean;
}

interface TomeVisualState {
  readonly openTextureKey: string;
  readonly closedTextureKey: string;
  readonly closedFrame?: string;
  readonly displayLength: number;
  readonly openRotationOffsetRad: number;
  readonly openGeometry?: WeaponArtStateGeometry;
  readonly pages: readonly [TomePageQuad, TomePageQuad];
  readonly scraps: readonly [TomeScrap, TomeScrap];
  openBaseScale: number;
  openTextureReady: boolean;
  openVisible: boolean;
  hasSeq: boolean;
  lastSeq: number;
  openAtMs: number;
  openUntilMs: number;
  lastFlipAtMs: number;
  pendingPage: boolean;
  pendingPageAtMs: number;
  pendingPageSeq: number;
  settleForUntilMs: number;
}

interface RigHand extends JigglePartState {
  img: Phaser.GameObjects.Image;
  ox: number;
  oy: number;
  front: boolean;
}

interface RigFoot extends JigglePartState {
  img: Phaser.GameObjects.Image;
  ox: number;
  oy: number;
  front: boolean;
}

interface FlourishChannelState {
  active: boolean;
  moment: FlourishMoment;
  startMs: number;
  hand: 0 | 1;
  rotationSign: -1 | 1;
  spec: WeaponFlourishSpec;
}

function createFlourishChannel(hand: 0 | 1): FlourishChannelState {
  return {
    active: false,
    moment: "draw",
    startMs: -1e9,
    hand,
    rotationSign: hand === 0 ? 1 : -1,
    spec: WEAPON_FLOURISH_SPECS["one-hand-blade"],
  };
}

interface FlourishArmState {
  armed: boolean;
  earliestStartMs: number;
  weaponId: string;
}

function createFlourishArmState(): FlourishArmState {
  return { armed: false, earliestStartMs: -1e9, weaponId: "" };
}

interface FlourishStreakState {
  count: number;
  lastAcceptedMs: number;
  weaponId: string;
}

function createFlourishStreakState(): FlourishStreakState {
  return { count: 0, lastAcceptedMs: -1e9, weaponId: "" };
}

interface OutgoingStowProxy {
  img?: Phaser.GameObjects.Image;
  startMs: number;
  destroyAtMs: number;
  hand: 0 | 1;
  rotationSign: -1 | 1;
  spec: WeaponFlourishSpec;
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  aimLocal: number;
}

function createOutgoingStowProxy(hand: 0 | 1): OutgoingStowProxy {
  return {
    startMs: -1e9,
    destroyAtMs: -1e9,
    hand,
    rotationSign: hand === 0 ? -1 : 1,
    spec: WEAPON_FLOURISH_SPECS["one-hand-blade"],
    x: 0,
    y: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    aimLocal: 0,
  };
}

interface GearAttachment extends HatSpringState {
  image: Phaser.GameObjects.Image;
  spec: GearAssemblyPart;
}

/** Rebase on construction/cuts/swaps/LOD sleep. A cut is not acceleration and must add zero energy. */
function resetJigglePart(p: JigglePartState, ax: number, ay: number, own: number): void {
  p.jx = 0;
  p.jy = 0;
  p.jvx = 0;
  p.jvy = 0;
  p.prevAx = ax;
  p.prevAy = ay;
  p.prevAvx = 0;
  p.prevAvy = 0;
  p.prevOwn = own;
  p.springReady = true;
}

/** Late hard constraints (2H haft/orbit) synchronize the hidden state to their final authored point. */
function syncOwnedJigglePart(
  p: JigglePartState,
  ax: number,
  ay: number,
  dtS: number,
  rebase: boolean,
): void {
  if (!p.springReady || rebase || dtS <= 0) {
    resetJigglePart(p, ax, ay, 1);
    return;
  }
  const avx = Math.max(
    -JIGGLE_HANDOFF_MAX_V,
    Math.min(JIGGLE_HANDOFF_MAX_V, (ax - p.prevAx) / dtS),
  );
  const avy = Math.max(
    -JIGGLE_HANDOFF_MAX_V,
    Math.min(JIGGLE_HANDOFF_MAX_V, (ay - p.prevAy) / dtS),
  );
  p.jx = 0;
  p.jy = 0;
  p.jvx = 0;
  p.jvy = 0;
  p.prevAx = ax;
  p.prevAy = ay;
  p.prevAvx = avx;
  p.prevAvy = avy;
  p.prevOwn = 1;
}

/** Exact damped-oscillator transition around a held micro-noise equilibrium; no Euler instability at 100ms. */
function stepJigglePart(
  p: JigglePartState,
  ax: number,
  ay: number,
  own: number,
  dtS: number,
  w: number,
  z: number,
  equilibriumX: number,
  equilibriumY: number,
  impulseX: number,
  impulseY: number,
  maxX: number,
  maxY: number,
  maxV: number,
  planted: boolean,
  rebase: boolean,
): void {
  if (!p.springReady || rebase || dtS <= 0) {
    resetJigglePart(p, ax, ay, own);
    return;
  }
  if (own >= 0.999) {
    syncOwnedJigglePart(p, ax, ay, dtS, false);
    return;
  }

  const avx = Math.max(
    -JIGGLE_HANDOFF_MAX_V,
    Math.min(JIGGLE_HANDOFF_MAX_V, (ax - p.prevAx) / dtS),
  );
  const avy = Math.max(
    -JIGGLE_HANDOFF_MAX_V,
    Math.min(JIGGLE_HANDOFF_MAX_V, (ay - p.prevAy) / dtS),
  );
  if (p.prevOwn >= 0.999) {
    // Energy handoff: preserve the prior exact authored point and its bounded terminal local velocity.
    p.jx = p.prevAx - ax;
    p.jy = p.prevAy - ay;
    p.jvx = p.prevAvx;
    p.jvy = p.prevAvy;
  }
  p.jvx += impulseX;
  p.jvy += impulseY;

  const rx = p.jx - equilibriumX;
  const ry = p.jy - equilibriumY;
  let a00: number;
  let a01: number;
  let a10: number;
  let a11: number;
  if (Math.abs(z - 1) < 1e-4) {
    const d = Math.exp(-w * dtS);
    a00 = d * (1 + w * dtS);
    a01 = d * dtS;
    a10 = d * (-w * w * dtS);
    a11 = d * (1 - w * dtS);
  } else if (z < 1) {
    const wd = w * Math.sqrt(1 - z * z);
    const d = Math.exp(-z * w * dtS);
    const c = Math.cos(wd * dtS);
    const sn = Math.sin(wd * dtS);
    const zwOverWd = (z * w) / wd;
    a00 = d * (c + zwOverWd * sn);
    a01 = d * (sn / wd);
    a10 = d * ((-(w * w) * sn) / wd);
    a11 = d * (c - zwOverWd * sn);
  } else {
    const wd = w * Math.sqrt(z * z - 1);
    const d = Math.exp(-z * w * dtS);
    const c = Math.cosh(wd * dtS);
    const sn = Math.sinh(wd * dtS);
    const zwOverWd = (z * w) / wd;
    a00 = d * (c + zwOverWd * sn);
    a01 = d * (sn / wd);
    a10 = d * ((-(w * w) * sn) / wd);
    a11 = d * (c - zwOverWd * sn);
  }
  const nextX = a00 * rx + a01 * p.jvx;
  const nextY = a00 * ry + a01 * p.jvy;
  const nextVx = a10 * rx + a11 * p.jvx;
  const nextVy = a10 * ry + a11 * p.jvy;
  p.jx = equilibriumX + nextX;
  p.jy = equilibriumY + nextY;
  p.jvx = nextVx;
  p.jvy = nextVy;

  // Elliptical positional ceiling removes corner-sticking; discard only outward boundary velocity.
  const ell = (p.jx * p.jx) / (maxX * maxX) + (p.jy * p.jy) / (maxY * maxY);
  if (ell > 1) {
    const k = 1 / Math.sqrt(ell);
    p.jx *= k;
    p.jy *= k;
    const nx = p.jx / (maxX * maxX);
    const ny = p.jy / (maxY * maxY);
    const outward = p.jvx * nx + p.jvy * ny;
    const nn = nx * nx + ny * ny;
    if (outward > 0 && nn > 1e-8) {
      p.jvx -= (outward / nn) * nx;
      p.jvy -= (outward / nn) * ny;
    }
  }
  const vm = Math.hypot(p.jvx, p.jvy);
  if (vm > maxV) {
    const k = maxV / vm;
    p.jvx *= k;
    p.jvy *= k;
  }
  // A stance foot may lift/catch up, but spring energy may never push it down through the ground plane.
  if (planted && p.jy > 0) {
    p.jy = 0;
    if (p.jvy > 0) p.jvy = 0;
  }
  if (!Number.isFinite(p.jx + p.jy + p.jvx + p.jvy)) resetJigglePart(p, ax, ay, own);
  p.prevAx = ax;
  p.prevAy = ay;
  p.prevAvx = avx;
  p.prevAvy = avy;
  p.prevOwn = own;
}

/** §42 a WORN weapon (gauntlet/claw/glove/knuckles) is worn ON the hand, not held by the cuff: the rig
 *  mounts its pivot where the hand sits INSIDE the glove and renders the art OVER the hand. Matched by
 *  the gauntlet/fist FAMILIES plus worn WORDS in the name (the melee claws hide under "exotic-melee");
 *  word-boundaries keep held gear out ("Knucklebone Censer-Orb" is a censer on a chain, not knuckles). */
export { isWornWeapon };

export interface RigAnim {
  /** Movement direction this frame (≈0 length when idle). */
  moveX: number;
  moveY: number;
  /** Local raw input axes. Flourish cancellation reads these before collision/prediction resolution. */
  desiredMoveX?: number;
  desiredMoveY?: number;
  /** §7 v0.105 RAW render speed (px/s) — drives the gait blend so the walk cycle ramps with actual speed
   *  and fully stops when you do (not a binary flag that runs full-stride for ~1.3s after key-release). */
  speed?: number;
  /** Aim direction toward the cursor (local player only). */
  aimX: number;
  aimY: number;
  /** §37 RAW horizontal cursor offset from the character (px, unnormalized) — drives the facing FLIP so it
   *  commits exactly as the mouse crosses the character's midpoint (a normalized-aim threshold goes sticky
   *  when the cursor is far above/below: |aimX| stays tiny however clearly the midpoint was crossed). */
  aimDxPx?: number;
  /** §9 synced aim angle (radians) — points a REMOTE player's gun (the local player uses aimX/aimY). */
  aimDir: number;
  isSelf: boolean;
  /** §20 momentum (Stage A): the impulse velocity (px/s) shoving the body — drives a lean/jolt flinch.
   *  Optional (enemies have no momentum); defaults to 0. */
  recoilX?: number;
  recoilY?: number;
  /** Jump-feel pose channels. Self supplies predictor truth; remotes supply synced height/vh/stance. */
  jumpVh?: number;
  moveStance?: MoveStance;
  /** Predicted slide phase clock for self. Remotes quantize the same 20 Hz stance edge. */
  slidePhase?: SlidePhase;
  slideTick?: number;
  reducedMotion?: boolean;
  /** Attack-held for guns or fireHeld/authoritative channel state for beams. Presentation only. */
  fireHeld?: boolean;
}

/** Pure ranged-pose envelope. The held window owns the plateau; linger precedes a soft rest-pose settle. */
export function sampleRangedAimBlend(
  nowMs: number,
  raiseAtMs: number,
  activeUntilMs: number,
): number {
  if (nowMs < raiseAtMs) return 0;
  if (nowMs <= activeUntilMs) return smoothstep01((nowMs - raiseAtMs) / RANGED_AIM_RAISE_MS);
  return 1 - smoothstep01((nowMs - activeUntilMs) / RANGED_AIM_SETTLE_MS);
}

/** Client-only schema-26 titan pose channels. Exact danger remains on the telegraph renderer. */
export interface VastagharRigPose {
  active: boolean;
  mode: number;
  actionKind: number;
  actionLive: boolean;
  sourceFoot: number;
  aim: number;
  impactX: number;
  impactY: number;
  actionT: number;
  windupT: number;
  activeT: number;
  recoveryT: number;
  stepT: number;
  responseT: number;
  responseActive: boolean;
  impactActive: boolean;
  transitionActive: boolean;
  downedGuard: boolean;
  desperation: boolean;
  entranceT: number;
  deathT: number;
  worldwheelAngle: number;
}

export type PaperDeathTreatment = "crumple" | "flutter" | "tear" | "lite" | "pit";

interface PaperDeathPartPose {
  readonly img: Phaser.GameObjects.Image;
  readonly x: number;
  readonly y: number;
}

interface PaperDeathState {
  readonly treatment: PaperDeathTreatment;
  readonly durationMs: number;
  readonly x0: number;
  readonly y0: number;
  readonly vx: number;
  readonly vy: number;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly alpha: number;
  readonly rotation: number;
  readonly phase: number;
  readonly bodyX: number;
  readonly bodyY: number;
  readonly bodyScaleX: number;
  readonly bodyScaleY: number;
  readonly bodyRotation: number;
  readonly tearParts: PaperDeathPartPose[];
  readonly tearOther?: Phaser.GameObjects.Image;
  elapsedMs: number;
}

/**
 * Sliced-procedural character/enemy rig (§18, §28.11). Renders a subject's harvest-sliced
 * parts (body + optional detached head + detached hands/feet, cut by tools/artkit/guards/slice.mjs) as separate
 * sprites in a container, then drives them with PURELY PROCEDURAL animation — bob, squash,
 * lean, independent hand/foot drift, walk shuffle, side-profile facing flip, and the front
 * hand reaching toward the cursor (the weapon anchor, §9). No frame animation (§18).
 *
 * Cosmetic + client-side only: decoupled from the authoritative sim (§14), so it can desync
 * harmlessly. The container position is driven by synced state; everything inside is flavour.
 * Works for any build — hands-only floaters and pure blobs just have fewer parts.
 */
export class SpriteRig {
  readonly root: Phaser.GameObjects.Container;
  /** §4 caller-updated scalar render history; avoids replacing one `{x,y}` per rig per frame in the scene. */
  renderPrevX: number;
  renderPrevY: number;
  private readonly scene: Phaser.Scene;
  private readonly isSelf: boolean;
  private readonly bladeAttachmentSourceId: string;
  private scale: number;
  /** Client-only authored envelope correction; never enters shared/server characterScale or authority. */
  private readonly visualEnvelopeScale: number;
  /** Caller-owned gameplay/render multiplier retained separately from the final visual root transform. */
  private callerRigScale = 1;
  /** Rig-level UNIFORM scale multiplier (tough/boss size-up). Applied to BOTH axes every frame so
   *  the facing flip never stretches the sprite — art keeps its painted aspect ratio (§28.4). This is the
   *  composed final scale so weapon/VFX counter-scaling and animation math all see one transform. */
  private baseScale = 1;
  private readonly body: Phaser.GameObjects.Image;
  /** Two retained, body-card-only slide echoes; their slots are recycled for every slide. */
  private readonly slideAfterimageA: Phaser.GameObjects.Image;
  private readonly slideAfterimageB: Phaser.GameObjects.Image;
  private readonly hands: RigHand[] = [];
  private readonly feet: RigFoot[] = [];
  private readonly parts: Phaser.GameObjects.Image[] = [];
  /** One retained floating-head node: character-owned manifest art first, boilerplate gear art when installed. */
  private boilerplateHead?: Phaser.GameObjects.Image;
  /** Source-pixel centroid offset for a sliced character-owned head; body scale converts it to rig space. */
  private readonly manifestHeadOffset?: Readonly<{ x: number; y: number }>;
  private boilerplateManifest?: GearPartsManifest;
  private boilerplateAssembly?: BoilerplateAssembly;
  private boilerplateBodyAssembly?: BoilerplateAssemblyPart;
  private boilerplateHeadAssembly?: BoilerplateAssemblyPart;
  private readonly floatingHeadSpring: FloatingHeadSpringState = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    ready: false,
  };
  private readonly floatingHeadSpringInput: FloatingHeadSpringInput = {
    targetX: 0,
    targetY: 0,
    authoredOffsetX: 0,
    authoredOffsetY: 0,
    impulseX: 0,
    impulseY: 0,
    elapsedSeconds: 0,
    reducedMotion: false,
    reset: true,
  };
  private readonly floatingHeadAttackLead = { x: 0, y: 0 };
  private floatingHeadLodSleeping = true;
  private loadoutHeadTexture: Readonly<ResolvedLoadoutHeadTexture> = DEFAULT_LOADOUT_HEAD_TEXTURE;
  private boilerplateReady = false;
  private gearAssembly?: GearLoadoutAssembly;
  private gearArtComplete = false;
  private gearLoadoutKey = "";
  private gearBakeGeneration = 0;
  private gearBakeLease?: GearTextureBakeLease;
  private gearUsesReplacement = false;
  private gearBakeFailureReported = false;
  private syncedGearUpper = "";
  private syncedGearLower = "";
  private syncedGearPrestige = -1;
  private readonly gearAttachments: GearAttachment[] = [];
  private readonly hatAttachments: GearAttachment[] = [];
  private readonly gearSocketScratch = { x: 0, y: 0 };
  private readonly hatChainInput: HatChainInput = {
    excitation: 0,
    dashLean: 0,
    bodyAngle: 0,
    landingImpulse: 0,
    reducedMotion: false,
    reset: true,
  };
  private hatOverflowLabel?: Phaser.GameObjects.Text;
  private gearLodSleeping = false;
  private readonly label?: Phaser.GameObjects.Text;
  private readonly phase: number;
  /** The flagship owns one idempotent semantic pose sampled from server epochs each rendered frame. */
  private vastagharPose?: VastagharRigPose;
  private vastagharDepthFront = false;
  /** §29 quantized display-list depth last sent to Phaser; unchanged writes force a global re-sort. */
  private lastDepth = Number.NaN;
  private facing: -1 | 1 = 1;
  /** §7 v0.105 de-clunk — smoothed 0..1 GAIT (≈ speed/MOVE_SPEED): scales the stride/lift/lean so the walk
   *  cycle ramps in + fades out instead of snapping on a binary flag (the old check was dead code that kept
   *  the jog running ~1.3s after you stopped). */
  private gait = 0;
  /** §7 v0.105 de-clunk — eased facing (−1..1). The mirror glides through 0 (reads as a TURN) instead of a
   *  one-frame full-body flip; `facing` stays the committed ±1 (drives aim math + keeps the label readable). */
  private facingBlend = 1;
  /** Paper arrival is composed into the live pose writer; no Tween owns root or part transforms. */
  private spawnStartMs = -1;
  private spawnDurationMs = 220;
  /** Dimension Door's departure half. This never moves the logical actor or prediction state. */
  private foldStartMs = -1;
  private foldDurationMs = 120;
  private foldHiddenUntilMs = -1;
  /** Authoritative ultimate row sampled by ArenaScene, plus a short input-only anticipation envelope. */
  private ultimateFamily: UltimateFamilyValue = UltimateFamily.Locked;
  private ultimatePhase: UltimatePhaseValue = UltimatePhase.Idle;
  private ultimateProgress = 0;
  private ultimateReducedMotion = false;
  private ultimateInputAtMs = -1e9;
  private ultimateInputFamily: UltimateFamilyValue = UltimateFamily.Locked;
  /** Detached deaths advance only when ArenaScene advances its freeze-aware paper-death list. */
  private paperDeath?: PaperDeathState;
  /** §7 v0.105 de-clunk — landing squash (0..1, decays) fired when the hop returns to the ground. */
  private landSquash = 0;
  private landingSquashDepth = 0.14;
  private landingKickScale = 1;
  private jumpStartedMs = -1e9;
  private lastPoseHopTarget = 0;
  private peakHopPx = 0;
  private maxFallSpeed = 0;
  private moveStance: MoveStance = STANCE_NONE;
  private airStance: MoveStance = STANCE_NONE;
  private stanceStartedMs = -1e9;
  private landedFromStance: MoveStance = STANCE_NONE;
  private landedAtMs = -1e9;
  private slidePhase: SlidePhase = SLIDE_PHASE_OFF;
  private slideRenderT = 0;
  private slideReverseFace = false;
  private slideEchoSampling = false;
  private slideEchoSampleAtMs = -1e9;
  private slideEchoSampleX = 0;
  private slideEchoSampleY = 0;
  private slideEchoAX = 0;
  private slideEchoAY = 0;
  private slideEchoAAtMs = -1e9;
  private slideEchoBX = 0;
  private slideEchoBY = 0;
  private slideEchoBAtMs = -1e9;
  /** §7 v0.111 TURN-COMMIT ("pull the reins") — the directional WEIGHT lives in the ANIMATION, not the
   *  trajectory. `heading` tracks the smoothed run direction; when it swings hard while moving, `turnCommit`
   *  fires a one-time decaying punch toward the new heading (`turnDir`) — the body plants + leans + the hands
   *  yank into the turn, like a rider hauling the reins before the horse commits. The character's path across
   *  the screen is UNCHANGED; this is pure procedural flourish. */
  private headingX = 1;
  private headingY = 0;
  private turnCommit = 0;
  private turnDirX = 1;
  private turnDirY = 0;
  /** §7 v0.112 procedural gait state: `velX/velY` = fast-smoothed render velocity, `slowVelX/slowVelY` =
   *  slow-smoothed. Their DIFFERENCE is an inertia signal — nonzero only while accelerating / decelerating /
   *  turning — that trails the hands + feet behind the body's motion (limbs with weight, reacting to input,
   *  not a fixed loop). `strideT` is the DISTANCE-accumulated stride phase (radians) so the walk cadence
   *  tracks real speed and stops when you do. */
  private velX = 0;
  private velY = 0;
  private slowVelX = 0;
  private slowVelY = 0;
  private strideT = 0;
  /** Stage-1 excitation conditioner: legacy fast-minus-slow lag is low-passed harder for snapshot rigs, then
   *  distributed as bounded velocity impulses. Root history rejects teleports/clock cuts before they ring. */
  private jiggleSignalX = 0;
  private jiggleSignalY = 0;
  private jigglePrevRootX = 0;
  private jigglePrevRootY = 0;
  private jiggleRootReady = false;
  /** §7 v0.105 de-clunk — last `animate` clock (ms) to derive a frame dt for the eased blends; -1 = first. */
  private prevAnimMs = -1;
  /** §8 parry brace envelope duration (ms) ≈ PARRY_IFRAMES. Hoisted so `triggerBrace` can plateau a chain. */
  private static readonly BRACE_DUR = 450;
  /** Held weapon piece(s) — one per hand (dual-wield = two). Live INSIDE the container so the
   *  hand renders over the hilt and the facing-flip applies automatically. */
  private weapons: {
    img: Phaser.GameObjects.Image;
    hand: { img: Phaser.GameObjects.Image; ox: number; oy: number };
    /** The weapon's own display scale (displayLength/part.w). Applied each frame ÷ baseScale so the weapon
     *  is a FIXED on-screen size regardless of which (larger/smaller) character holds it. */
    baseScale: number;
    closedBaseScale: number;
    def: WeaponDef;
    worn: boolean;
    spriteId: string;
    partIndex: 0 | 1;
    /** Stable local image-facing datum, composed with (never substituted for) the actor-facing root mirror. */
    imageFacingX: 1 | -1;
    /** Geometry is resolved once from the equipped sprite identity; semantic rotation remains uncorrected. */
    artGeometry?: WeaponArtGeometry;
    /** Alpha-measured source-pixel span at the extension join; never authored per weapon. */
    bladeWidthSourcePixels: number;
    closedOriginX: number;
    closedOriginY: number;
    closedTextureKey: string;
    closedTextureFrame?: string;
    firingFrame?: {
      spriteId: string;
      textureKey: string;
      textureFrame?: string;
      sourceScale: number;
      originX: number;
      originY: number;
    };
    firingFrameVisible: boolean;
    semanticRotation: number;
    /** Lazily-created full-tell separation/echo layers. Lite horde tells never allocate them. */
    tellRim?: Phaser.GameObjects.Image;
    tellEcho?: Phaser.GameObjects.Image;
  }[] = [];
  /** B19 worn foot sprites stay separate from held-hand weapon channels, which are intentionally 0/1 only. */
  private wrapFootWeapons: {
    img: Phaser.GameObjects.Image;
    foot: RigFoot;
    baseScale: number;
    imageFacingX: 1 | -1;
    partIndex: 1;
  }[] = [];
  private weaponDef?: WeaponDef;
  /** Session-local art-direction choices are read from Phaser's registry and cached as descriptor refs. */
  private readonly poseVariants = createPoseVariantSelection();
  private poseLeadSpec?: WeaponPoseSpec;
  private poseOffSpec?: WeaponPoseSpec;
  private performanceSpec?: WeaponPerformanceSpec;
  private readonly performanceInput = createWeaponPerformanceInput();
  private readonly performanceSample = createWeaponPerformanceSample();
  private poseTwoHanded = false;
  private readonly movementPostureInput: MovementPostureInput = createMovementPostureInput();
  private readonly movementPostureSample: MovementPostureSample = createMovementPostureSample();
  private flourishLeadSpec?: WeaponFlourishSpec;
  private flourishOffSpec?: WeaponFlourishSpec;
  private poseLeadBladeSize: BladeSizeClass = "standard";
  private bladeNeutralAngle = 0;
  private bladeNeutralReady = false;
  private readonly flourishChannels: [FlourishChannelState, FlourishChannelState] = [
    createFlourishChannel(0),
    createFlourishChannel(1),
  ];
  private readonly flourishInputs: [FlourishInput, FlourishInput] = [
    createFlourishInput(),
    createFlourishInput(),
  ];
  private readonly flourishSamples: [FlourishSample, FlourishSample] = [
    createFlourishSample(),
    createFlourishSample(),
  ];
  private readonly flourishArms: [FlourishArmState, FlourishArmState] = [
    createFlourishArmState(),
    createFlourishArmState(),
  ];
  private readonly flourishStreaks: [FlourishStreakState, FlourishStreakState] = [
    createFlourishStreakState(),
    createFlourishStreakState(),
  ];
  private readonly stowProxies: [OutgoingStowProxy, OutgoingStowProxy] = [
    createOutgoingStowProxy(0),
    createOutgoingStowProxy(1),
  ];
  private readonly stowInputs: [FlourishInput, FlourishInput] = [
    createFlourishInput(),
    createFlourishInput(),
  ];
  private readonly stowSamples: [FlourishSample, FlourishSample] = [
    createFlourishSample(),
    createFlourishSample(),
  ];
  private pendingSwapKey = "";
  private pendingSwapObservedKey = "";
  private pendingSwapEpochMs = -1e9;
  private lastSwapKey = "";
  private lastSwapObservedKey = "";
  private flourishCancelGeneration = 0;
  private flourishHeadX = 0;
  private flourishHeadY = 0;
  private flourishMoveX = 0;
  private flourishMoveY = 0;
  private flourishReducedMotion = false;
  private flourishReducedReady = false;
  private flourishFireHeld = false;
  private flourishAttackIntentHeld = false;
  private idleFlourishEligibleAtMs = Number.POSITIVE_INFINITY;
  private idleFlourishLastPlayedMs = -1e9;
  private idleFlourishOffsetMs = 0;
  private gunRecoveryWallUntilMs = -1e9;
  private readonly poseLeadInput = createPoseLanguageInput();
  private readonly poseLeadSample = createPoseLanguageSample();
  private readonly poseSupportInput = createPoseLanguageInput();
  private readonly poseSupportSample = createPoseLanguageSample();
  private readonly posePoint = { x: 0, y: 0 };
  private readonly idleHandTarget = { x: 0, y: 0 };
  private readonly footPoseOffset = { x: 0, y: 0 };
  private readonly handRoleFrame: {
    phase: PoseActionPhase;
    phaseT: number;
    dualEquipped: boolean;
    pairedAimed: boolean;
    bothHandsOwned: boolean;
    actionOwnedHands: [boolean, boolean];
    visibleHands: [boolean, boolean];
  } = {
    phase: "idle",
    phaseT: 0,
    dualEquipped: false,
    pairedAimed: false,
    bothHandsOwned: false,
    actionOwnedHands: [false, false],
    visibleHands: [true, true],
  };
  private readonly idleHandTargetInput: {
    bodyX: number;
    bodyY: number;
    bodyHeight: number;
    aimLocal: number;
    movementX: number;
    movementY: number;
    microX: number;
    microY: number;
    manifestSocketX: number;
    recoveryT: number | undefined;
    recoveryForward: number | undefined;
    recoveryLateral: number | undefined;
  } = {
    bodyX: 0,
    bodyY: 0,
    bodyHeight: TARGET_BODY_H,
    aimLocal: 0,
    movementX: 0,
    movementY: 0,
    microX: 0,
    microY: 0,
    manifestSocketX: 0,
    recoveryT: undefined,
    recoveryForward: undefined,
    recoveryLateral: undefined,
  };
  private readonly secondaryGripPoint = { x: 0, y: 0 };
  private readonly secondaryGripFlourish: GunHandlingHandOffset = { forward: 0, lateral: 0 };
  private readonly gunHandlingCycles: [GunHandlingCycleState, GunHandlingCycleState] = [
    createGunHandlingCycleState(),
    createGunHandlingCycleState(),
  ];
  private readonly secondaryGripInput: SecondaryGripTransformInput = {
    primaryX: 0,
    primaryY: 0,
    spriteWidth: 0,
    spriteHeight: 0,
    scaleX: 1,
    scaleY: 1,
    rotationRad: 0,
    primary: { x: 0, y: 0 },
    secondary: { x: 0, y: 0 },
    flourishForward: 0,
    flourishLateral: 0,
  };
  private poseRecoilConsumedAtMs = -1e9;
  private loadoutKey = "";
  private pairBaseSeq = 0;
  private pairBaseSeqReady = false;
  private pairBarStep = -1;
  private pairBarExpiresAtMs = -1e9;
  private pairCeremonyStartMs = -1e9;
  private pairWeaponScaleX: [number, number] = [1, 1];
  private pairGlintAlpha = 0;
  /** Optional retained open-book treatment. Shapes are allocated once per equip and reused for every beat. */
  private tome?: TomeVisualState;
  private swingStart = -1e9;
  /** §44 immutable predicted/accepted swing clock. The normalized pose branches below are untouched; only
   *  their `tt` time base comes from this effective-cooldown descriptor. */
  private swing?: RigSwingDescriptor;
  private swingHand: RigSwingHand = 0;
  private swingWeaponDef?: WeaponDef;
  private crossfallActive = false;
  /** §50 Driftblade-model panel: the latest triggered descriptor, ENRICHED with the accepted/predicted
   *  combo step by `triggerSwing`. ArenaScene's owner-side `spawnSlash` reads it so the per-step ribbon
   *  reaches the wielder's own VFX exactly like the remote observed-signature path. */
  get activeSwing(): RigSwingDescriptor | undefined {
    return this.swing;
  }
  get activeSwingHand(): RigSwingHand {
    return this.swingHand;
  }
  get isCrossfallActive(): boolean {
    return this.crossfallActive;
  }
  /** §40 fake-3D ORBIT slash (two-handed melee): 0..1 progress while active, −1 otherwise. Set by the
   *  weapon-angle pass, consumed by the weapon render pass (which overrides position/rotation/scale/depth). */
  private orbitT = -1;
  /** Whether the orbiting blade is currently on the FAR side of the body (rendered behind it). */
  private orbitBehind = false;
  /** §40.3 GAREN-SPIN mode for the orbit pass: full revolutions + the body whirls (signed mirror-turns). */
  private orbitSpin = false;
  /** §41 this swing started while (or right as) the previous one ended — a SPAMMED chain. Spins drop their
   *  wind-in and run linear so back-to-back presses read as ONE continuous whirlwind. Spin-only: ordinary
   *  styles use the accepted-cadence combo state below and never consume this legacy Boolean. */
  private swingChained = false;
  /** §45 predicted accepted-cadence chain. `comboStep` is the live zero-based step; `swingStep/direction`
   *  snapshot it for the in-flight pose so timeout/next-step mutation cannot rewrite a rendered swing. */
  private comboFamily: RigComboFamily = "none";
  private comboStep = 0;
  private comboExpiresAtMs = -1e9;
  /** Latest forward uint32 beat seen through `setAttackBeat`. It orders/deduplicates presentation only. */
  private hasAttackBeatSeq = false;
  private attackBeatSeq = 0;
  private attackBeatWallEpochMs = -1e9;
  /** The firing-frame clock excludes owner prediction and retains the accepted weapon identity. */
  private hasAuthoritativeFiringBeat = false;
  private authoritativeFiringBeatSeq = 0;
  private authoritativeFiringAttackTick = 0;
  private authoritativeFiringClockTick = 0;
  private authoritativeFiringWeaponId = "";
  /** Per-hand accepted snapshots prevent unrelated interleaved beats from advancing the other weapon. */
  private readonly comboChains: [ComboChainState, ComboChainState] = [
    createComboChainState(),
    createComboChainState(),
  ];
  private swingStep = 0;
  private swingDirection: -1 | 0 | 1 = 1;
  private swingFamily: RigComboFamily = "none";
  private swingVariant: MeleeComboVariant = "default";
  /** End-pose snapshot survives the 0.64× pose window through readyAt+grace, then releases over 120ms. */
  private comboHoldPose?: {
    readonly family: MeleeComboFamily;
    readonly variant: MeleeComboVariant;
    readonly step: number;
    readonly direction: -1 | 0 | 1;
    readonly expiresAtMs: number;
  };
  /** G3 final-render bridge between accepted combo stages. World/root position is never captured or moved. */
  private comboStageTransition?: ComboStageTransitionState;
  /** §40 per-frame weapon POSITION offset from the hand (chop lift / thrust lunge). Reset each frame. */
  private swingOffX = 0;
  private swingOffY = 0;
  /** Dual/off-hand counterpart used by alternating rakes, crosses, and the scissor finisher. */
  private swingBackOffX = 0;
  private swingBackOffY = 0;
  /** Resettable signature channels. They move visible paper parts only; `root` and its hurtbox stay grounded. */
  private attackArtOffX = 0;
  private attackArtOffY = 0;
  private attackLiftPx = 0;
  private attackScaleY = 1;
  private weaponLengthScale = 1;
  private attackWeaponDepth: -1 | 0 | 1 = 0;
  private attackShadowX = 0;
  private attackShadowY = 0;
  private attackShadowRotation = 0;
  private attackShadowScaleX = 1;
  private attackShadowScaleY = 1;
  private attackShadowAlpha = 1;
  /** Planted-head/orbit exception: the weapon supplies a grip and the named hand(s) follow it. */
  private attackGripBlend = 0;
  private attackGripX = 0;
  private attackGripY = 0;
  private attackBackGripX = 0;
  private attackBackGripY = 0;
  private attackGripBoth = false;
  private attackHandSpacing = TARGET_BODY_H * 0.42;
  /** Hand-owned close-blade targets. Unlike signature grips, the hand supplies the weapon transform. */
  private attackFrontGripX = 0;
  private attackFrontGripY = 0;
  private attackFrontGripBlend = 0;
  private attackBackGripBlend = 0;
  /** Absolute plant/kick targets suppress gait only while the close-blade pose owns the feet. */
  private attackFrontFootX = 0;
  private attackFrontFootY = 0;
  private attackFrontFootBlend = 0;
  private attackBackFootX = 0;
  private attackBackFootY = 0;
  private attackBackFootBlend = 0;
  /** One retained output record keeps the pure pose sampler allocation-free in the hot path. */
  private readonly closeBladeInput = createCloseBladePoseInput();
  private readonly closeBladePose = createCloseBladePoseSample();
  private readonly kungFuWrapPoseInput = createKungFuWrapPoseInput();
  private readonly kungFuWrapPose = createKungFuWrapPoseSample();
  private readonly katanaChoreographyPose = createKatanaChoreographySample();
  private closeBladePoseActive = false;
  private closeBladeBodyX = 0;
  private closeBladeBodyY = 0;
  private closeBladeBodyRotation = 0;
  private closeBladeBodyScaleX = 1;
  private closeBladeBodyScaleY = 1;
  /** Applied target deltas let lifecycle cuts undo the last sampled pose before another frame runs. */
  private closeBladeFrontHandDx = 0;
  private closeBladeFrontHandDy = 0;
  private closeBladeBackHandDx = 0;
  private closeBladeBackHandDy = 0;
  private closeBladeFrontFootDx = 0;
  private closeBladeFrontFootDy = 0;
  private closeBladeBackFootDx = 0;
  private closeBladeBackFootDy = 0;
  private signatureMotion?: MeleeComboMotion;
  /** One retained aim vector and one pending action slot avoid per-attack rig allocations. The authored scene
   * renderer remains pooled and is flushed only by `animate`, so an attack observed during hit-stop waits. */
  private readonly observedSignatureAim = { x: 1, y: 0 };
  private observedSignaturePending = false;
  private observedSignatureWeapon?: WeaponDef;
  private observedSignatureSwing?: SwingDescriptor;
  private observedSignatureHand: 0 | 1 = 0;
  private observedSignatureAtMs = -1e9;
  private crossfallRibbonPending = false;
  private crossfallRibbonAtMs = -1e9;
  /** Retained remote cast/tome source punctuation; transforms are rewritten in the rig's final pose pass. */
  private readonly observedSourceFlash: Phaser.GameObjects.Ellipse;
  private readonly observedSourceRing: Phaser.GameObjects.Ellipse;
  private observedSourceFlashAtMs = -1e9;
  private observedSourceHand: 0 | 1 = 0;
  /** Alternating gun recoil is retained here; Arena routes muzzle/camera data through the same hand. */
  private gunRecoilAtMs = -1e9;
  private gunRecoilHand: 0 | 1 = 0;
  private rangedAimRaiseAtMs = -1e9;
  private rangedAimActiveUntilMs = -1e9;
  /** §20 world-space aim (radians) captured at swing-start, so the blade sweeps the server's swept arc. */
  private swingAimWorld = Number.NaN;
  private braceStart = -1e9;
  /** Enemy-only parry performance. Synced windup supplies phase; resolve/cancel never start a fresh swing. */
  private meleeTellMode: "none" | "windup" | "resolve" | "cancel" = "none";
  private meleeTellPhase = 0;
  private meleeTellRemainingMs = Number.POSITIVE_INFINITY;
  private meleeTellDurationMs = 1;
  private meleeTellAimWorld = 0;
  private meleeTellLocked = false;
  private meleeTellFull = false;
  private meleeTellArchetype = "duelist";
  private meleeTellStep = 0;
  private meleeTellEdgeAtMs = -1e9;
  private meleeTellGlintFired = false;
  private meleeTellFirstGlintAtMs = -1e9;
  private meleeTellFirstGlintFired = false;
  private meleeTellGold = false;
  private meleeTellAirKeep = false;
  private meleeTellReleaseAtMs = -1e9;
  private meleeTellCancelPhase = 0;
  private meleeTellReleasePose = false;
  /** §51 combo-only presentation channels. ArenaScene samples them exclusively from synced flags/rows and
   *  feeds zeroes every inactive frame, so no private server phase leaks into this rig. */
  private enemyComboOwnsHop = false;
  private enemyComboHopPx = 0;
  private enemyComboOfferPhase = 0;
  private enemyComboAimWorld = 0;
  private enemyComboEmpowered = false;
  private enemyComboReturnAtMs = -1e9;
  private enemyComboLandedAtMs = -1e9;
  private enemyComboStaggerAtMs = -1e9;
  private juggledAtMs = -1e9;
  private juggleFlashActive = false;
  /** §5 jump: px the rendered art is lifted this frame (the hop arc). The container stays grounded so
   *  the camera + depth-sort use the ground position; only the visible parts rise. §7 v0.105 de-clunk:
   *  `hopPx` now EASES toward `hopTarget` (the synced height) so the 20Hz jump doesn't stair-step. */
  private hopPx = 0;
  private hopTarget = 0;
  /** §33 permanent art-lift (local px) for colossus lower-body framing — added to the hop each frame. */
  private baseLift = 0;
  /** §5/§20 ground shadow — stays grounded while the art lifts, so the gap reads as HEIGHT (jump /
   *  parry-launch / death-pop). Shrinks + fades as the rig rises. */
  private readonly shadow: Phaser.GameObjects.Ellipse;
  /** Two-ellipse blur fake: a soft halo appears only as altitude separates the core from the card. */
  private readonly shadowHalo: Phaser.GameObjects.Ellipse;
  private readonly auraGlow: Phaser.GameObjects.Ellipse;
  private readonly auraRing: Phaser.GameObjects.Ellipse;
  private readonly gloveAuraBoltA: Phaser.GameObjects.Rectangle;
  private readonly gloveAuraBoltB: Phaser.GameObjects.Rectangle;
  private readonly paintedAuraFill: readonly Phaser.GameObjects.Image[];
  private readonly paintedAuraParticles: readonly Phaser.GameObjects.Image[];
  private readonly pairGlint: Phaser.GameObjects.Rectangle;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    isSelf: boolean,
    id: string,
    spriteId: string,
    gearManifest?: GearPartsManifest,
  ) {
    const manifest = SPRITES[spriteId as keyof typeof SPRITES] as SpriteManifest | undefined;
    if (!manifest) throw new Error(`SpriteRig: no sprite manifest for "${spriteId}"`);
    this.scene = scene;
    this.isSelf = isSelf;
    this.bladeAttachmentSourceId = id;
    this.scale = TARGET_BODY_H / manifest.body.h;
    this.visualEnvelopeScale = wholeArtCharacterVisualScale(spriteId);
    this.baseScale = this.callerRigScale * this.visualEnvelopeScale;
    // Build parts. Draw order (back→front): back hand, feet, body, front hand. The front
    // hand is the one on the side the art faces (right = +x); the other tucks behind.
    const make = (role: string, trackAsBodyOrLimb = true): Phaser.GameObjects.Image | undefined => {
      const part = manifest.parts.find((p) => p.role === role);
      if (!part) return undefined;
      const tx = partTexture(scene, spriteId, role);
      const img = scene.add.image(part.ox * this.scale, part.oy * this.scale, tx.key, tx.frame);
      img.setOrigin(0.5).setScale(this.scale);
      if (trackAsBodyOrLimb) this.parts.push(img);
      return img;
    };

    // Hands + feet first; the body is resolved separately so it always lands mid-stack
    // (and so we never double-create it from the parts loop).
    for (const p of manifest.parts) {
      if (p.role.startsWith("hand")) {
        const img = make(p.role);
        if (img)
          this.hands.push({
            img,
            ox: p.ox * this.scale,
            oy: p.oy * this.scale,
            front: p.ox >= 0,
            jx: 0,
            jy: 0,
            jvx: 0,
            jvy: 0,
            prevAx: 0,
            prevAy: 0,
            prevAvx: 0,
            prevAvy: 0,
            prevOwn: 0,
            springReady: false,
          });
      } else if (p.role.startsWith("foot")) {
        const img = make(p.role);
        if (img)
          this.feet.push({
            img,
            ox: p.ox * this.scale,
            oy: p.oy * this.scale,
            front: p.ox >= 0,
            jx: 0,
            jy: 0,
            jvx: 0,
            jvy: 0,
            prevAx: 0,
            prevAy: 0,
            prevAvx: 0,
            prevAvy: 0,
            prevOwn: 0,
            springReady: false,
          });
      }
    }
    const bodyImg = make("body");
    if (!bodyImg) throw new Error(`SpriteRig: "${spriteId}" has no body part`);
    this.body = bodyImg;
    const headPart = manifest.parts.find((part) => part.role === "head");
    const headImg = headPart ? make("head", false) : undefined;
    if (headPart && headImg) {
      this.boilerplateHead = headImg;
      this.manifestHeadOffset = { x: headPart.ox, y: headPart.oy };
    }

    const bodyFrame = this.body.frame.name;
    this.slideAfterimageA = scene.add
      .image(this.body.x, this.body.y, this.body.texture.key, bodyFrame)
      .setOrigin(0.5)
      .setScale(this.scale)
      .setTint(0xe8dfce)
      .setTintMode(Phaser.TintModes.FILL)
      .setAlpha(0)
      .setVisible(false);
    this.slideAfterimageB = scene.add
      .image(this.body.x, this.body.y, this.body.texture.key, bodyFrame)
      .setOrigin(0.5)
      .setScale(this.scale)
      .setTint(0xd7cdbb)
      .setTintMode(Phaser.TintModes.FILL)
      .setAlpha(0)
      .setVisible(false);

    const order: Phaser.GameObjects.GameObject[] = [];
    order.push(this.slideAfterimageB, this.slideAfterimageA);
    for (const f of this.feet) order.push(f.img);
    for (const h of this.hands) if (!h.front) order.push(h.img);
    order.push(this.body);
    if (this.boilerplateHead) order.push(this.boilerplateHead);
    for (const h of this.hands) if (h.front) order.push(h.img);

    this.label = isSelf
      ? scene.add
          .text(0, -TARGET_BODY_H * 0.62 - 12, "you", {
            fontSize: "12px",
            color: "#E8E4D8",
          })
          .setOrigin(0.5)
      : undefined;

    // §5/§20 ground shadow at the feet — drawn FIRST (behind everything) so it sits under the rig; it
    // stays put while the art lifts on the hop, so the gap reads as altitude.
    this.shadowHalo = scene.add
      .ellipse(0, TARGET_BODY_H * 0.42, TARGET_BODY_H * 0.6, TARGET_BODY_H * 0.22, 0x000000, 0)
      .setOrigin(0.5);
    this.shadow = scene.add
      .ellipse(0, TARGET_BODY_H * 0.42, TARGET_BODY_H * 0.6, TARGET_BODY_H * 0.22, 0x000000, 0.3)
      .setOrigin(0.5);
    this.auraGlow = scene.add
      .ellipse(0, TARGET_BODY_H * 0.18, 2, 2, 0x33e6ff, 0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false);
    this.auraRing = scene.add
      .ellipse(0, TARGET_BODY_H * 0.18, 2, 2)
      .setStrokeStyle(3, 0x33e6ff, 0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false);
    this.gloveAuraBoltA = scene.add
      .rectangle(0, 0, 16, 2.4, 0xffffff, 0.9)
      .setOrigin(0.15, 0.5)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false);
    this.gloveAuraBoltB = scene.add
      .rectangle(0, 0, 12, 2, 0xffffff, 0.82)
      .setOrigin(0.15, 0.5)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false);
    this.paintedAuraFill = Array.from({ length: 2 }, (_, index) => {
      const image = scene.add
        .image(0, 0, "ptcl:shock-spark", 0)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setVisible(false);
      image.name = `weapon-painted-aura:${index}`;
      return image;
    });
    this.paintedAuraParticles = Array.from({ length: 12 }, (_, index) =>
      scene.add
        .image(0, 0, "ptcl:shock-spark", index % (PARTICLE_PACKS["shock-spark"]?.count ?? 1))
        .setBlendMode(Phaser.BlendModes.ADD)
        .setVisible(false),
    );
    order.unshift(
      this.shadowHalo,
      this.shadow,
      this.auraGlow,
      this.auraRing,
      this.gloveAuraBoltA,
      this.gloveAuraBoltB,
      ...this.paintedAuraFill,
      ...this.paintedAuraParticles,
    );

    this.observedSourceRing = scene.add
      .ellipse(0, 0, 20, 12)
      .setStrokeStyle(2, 0xd6dde6, 0.9)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false);
    this.observedSourceFlash = scene.add
      .ellipse(0, 0, 11, 7, 0xffffff, 0.88)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false);
    this.pairGlint = scene.add
      .rectangle(0, 0, 2, 28, 0xffffff, 1)
      .setOrigin(0.5)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false);
    order.push(this.observedSourceRing, this.observedSourceFlash, this.pairGlint);
    if (this.label) order.push(this.label);

    this.root = scene.add.container(x, y, order).setScale(this.baseScale);
    this.renderPrevX = x;
    this.renderPrevY = y;
    this.jigglePrevRootX = x;
    this.jigglePrevRootY = y;

    // Per-rig phase offset so a crowd doesn't bob in lockstep. Derived from id (stable).
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 1000;
    this.phase = h / 1000;
    this.idleFlourishOffsetMs = Math.floor(this.phase * 701);
    if (gearManifest) this.requestBoilerplate(gearManifest);
  }

  /** Select the fixed blank kit without ever exposing an unresolved texture key. */
  private requestBoilerplate(manifest: GearPartsManifest): void {
    if (this.boilerplateManifest === manifest) return;
    this.boilerplateManifest = manifest;
    this.boilerplateAssembly = assembleBoilerplate(manifest, TARGET_BODY_H);
    this.boilerplateBodyAssembly = undefined;
    this.boilerplateHeadAssembly = undefined;
    for (const part of this.boilerplateAssembly.parts) {
      if (part.source.id === "body") this.boilerplateBodyAssembly = part;
      else if (part.source.id === "head") this.boilerplateHeadAssembly = part;
    }
    if (!this.boilerplateHead) {
      this.boilerplateHead = this.scene.add.image(0, 0, "__WHITE").setVisible(false);
      this.root.add(this.boilerplateHead);
    }
    ensureBoilerplateTextures(this.scene, manifest);
    this.installBoilerplateIfReady();
  }

  /** Texture-only helmet seam: unresolved future head art safely leaves the boilerplate head installed. */
  private applyLoadoutHeadTexture(): void {
    const head = this.boilerplateHead;
    if (!head) return;
    if (this.gearUsesReplacement && this.gearBakeLease) return;
    const requested = this.loadoutHeadTexture;
    const selected = this.scene.textures.exists(requested.textureKey)
      ? requested
      : DEFAULT_LOADOUT_HEAD_TEXTURE;
    head.setTexture(selected.textureKey, selected.frame);
  }

  /** A compatibility scaffold may omit a limb; promote the authored boilerplate part into the normal
   * hand/foot arrays so every pose and jiggle writer sees the same complete five-node base skeleton. */
  private createBoilerplateLimb(part: BoilerplateAssemblyPart): RigHand {
    const img = this.scene.add
      .image(part.x, part.y, boilerplateTextureKey(part.source.id))
      .setOrigin(part.originX, part.originY)
      .setScale(part.scale)
      .setRotation(part.rotation);
    const limb: RigHand = {
      img,
      ox: part.x,
      oy: part.y,
      front: part.source.id.endsWith("-r"),
      jx: 0,
      jy: 0,
      jvx: 0,
      jvy: 0,
      prevAx: 0,
      prevAy: 0,
      prevAvx: 0,
      prevAvy: 0,
      prevOwn: 0,
      springReady: false,
    };
    this.parts.push(img);
    this.root.add(img);
    if (part.source.id.startsWith("hand-")) this.hands.push(limb);
    else this.feet.push(limb);
    return limb;
  }

  /** Atomically retarget the retained skeleton once all six loose textures exist. */
  private installBoilerplateIfReady(): void {
    if (this.boilerplateReady || !this.boilerplateAssembly) return;
    for (const part of this.boilerplateAssembly.parts)
      if (!this.scene.textures.exists(boilerplateTextureKey(part.source.id))) return;

    const assembly = this.boilerplateAssembly;
    const body = this.boilerplateBodyAssembly;
    const head = this.boilerplateHeadAssembly;
    if (!body || !head || !this.boilerplateHead) return;
    this.scale = assembly.scale;
    this.body
      .setTexture(boilerplateTextureKey("body"))
      .setOrigin(body.originX, body.originY)
      .setPosition(body.x, body.y)
      .setScale(body.scale)
      .setRotation(body.rotation);
    this.boilerplateHead
      .setOrigin(head.originX, head.originY)
      .setPosition(head.x, head.y)
      .setScale(head.scale)
      .setRotation(head.rotation)
      .setVisible(true);
    this.applyLoadoutHeadTexture();

    const boilerplateNodes = new Set<Phaser.GameObjects.Image>([this.body]);
    for (const part of assembly.parts) {
      const right = part.source.id.endsWith("-r");
      if (part.source.id.startsWith("hand-")) {
        const hand =
          this.hands.find((candidate) => candidate.front === right) ??
          this.createBoilerplateLimb(part);
        hand.ox = part.x;
        hand.oy = part.y;
        hand.img
          .setTexture(boilerplateTextureKey(part.source.id))
          .setOrigin(part.originX, part.originY)
          .setPosition(part.x, part.y)
          .setScale(part.scale)
          .setRotation(part.rotation);
        boilerplateNodes.add(hand.img);
      } else if (part.source.id.startsWith("foot-")) {
        const foot =
          this.feet.find((candidate) => candidate.front === right) ??
          this.createBoilerplateLimb(part);
        foot.ox = part.x;
        foot.oy = part.y;
        foot.img
          .setTexture(boilerplateTextureKey(part.source.id))
          .setOrigin(part.originX, part.originY)
          .setPosition(part.x, part.y)
          .setScale(part.scale)
          .setRotation(part.rotation);
        boilerplateNodes.add(foot.img);
      }
    }
    for (let index = this.hands.length - 1; index >= 0; index--) {
      const hand = this.hands[index];
      if (!hand || boilerplateNodes.has(hand.img)) continue;
      hand.img.destroy();
      this.hands.splice(index, 1);
    }
    for (let index = this.feet.length - 1; index >= 0; index--) {
      const foot = this.feet[index];
      if (!foot || boilerplateNodes.has(foot.img)) continue;
      foot.img.destroy();
      this.feet.splice(index, 1);
    }
    for (let index = this.parts.length - 1; index >= 0; index--) {
      const image = this.parts[index];
      if (!image || boilerplateNodes.has(image)) continue;
      this.parts.splice(index, 1);
    }
    this.slideAfterimageA
      .setTexture(boilerplateTextureKey("body"))
      .setOrigin(body.originX, body.originY)
      .setScale(body.scale);
    this.slideAfterimageB
      .setTexture(boilerplateTextureKey("body"))
      .setOrigin(body.originX, body.originY)
      .setScale(body.scale);
    this.boilerplateReady = true;
    this.syncWeaponHandReplacement();
    this.resetSecondaryMotion();
    this.rebuildRenderStack();
    this.restTint();
  }

  private clearGearAttachments(): void {
    for (const attachment of this.gearAttachments) attachment.image.destroy();
    this.gearAttachments.length = 0;
    this.hatAttachments.length = 0;
  }

  private syncHatOverflowLabel(assembly: GearLoadoutAssembly): void {
    if (assembly.towerOverflow > 0) {
      this.hatOverflowLabel ??= this.scene.add
        .text(0, 0, `+${assembly.towerOverflow}`, {
          fontFamily: "monospace",
          fontSize: "9px",
          color: "#f3df9d",
          fontStyle: "bold",
          stroke: "#101014",
          strokeThickness: 3,
        })
        .setOrigin(0.5, 1)
        .setVisible(false);
      this.hatOverflowLabel.setText(`+${assembly.towerOverflow}`);
      if (!this.hatOverflowLabel.parentContainer) this.root.add(this.hatOverflowLabel);
    } else if (this.hatOverflowLabel) {
      this.hatOverflowLabel.destroy();
      this.hatOverflowLabel = undefined;
    }
  }

  private restoreBoilerplateTextures(): void {
    if (!this.boilerplateReady) return;
    const body = this.boilerplateBodyAssembly;
    const head = this.boilerplateHeadAssembly;
    if (!body || !head || !this.boilerplateHead) return;
    this.body.setTexture(boilerplateTextureKey("body")).setOrigin(body.originX, body.originY);
    this.boilerplateHead
      .setTexture(boilerplateTextureKey("head"))
      .setOrigin(head.originX, head.originY);
    for (const hand of this.hands) {
      const id = hand.front ? "hand-r" : "hand-l";
      const source = this.boilerplateAssembly?.parts.find((part) => part.source.id === id);
      if (source)
        hand.img.setTexture(boilerplateTextureKey(id)).setOrigin(source.originX, source.originY);
    }
    for (const foot of this.feet) {
      const id = foot.front ? "foot-r" : "foot-l";
      const source = this.boilerplateAssembly?.parts.find((part) => part.source.id === id);
      if (source)
        foot.img.setTexture(boilerplateTextureKey(id)).setOrigin(source.originX, source.originY);
    }
    this.slideAfterimageA
      .setTexture(boilerplateTextureKey("body"))
      .setOrigin(body.originX, body.originY);
    this.slideAfterimageB
      .setTexture(boilerplateTextureKey("body"))
      .setOrigin(body.originX, body.originY);
  }

  /** Apply the shared source-card socket solution to this retained rig's procedural limb rest points. */
  private applyResolvedRigSockets(assembly: GearLoadoutAssembly): void {
    const manifest = this.boilerplateManifest;
    if (!manifest) return;
    const root = manifest.socketFrame.bodyRootSource;
    const sourceToRig =
      this.boilerplateAssembly?.scale ?? TARGET_BODY_H / manifest.socketFrame.bodyHeightL;
    for (const hand of this.hands) {
      const socket = assembly.rigSockets[hand.front ? "hand-r" : "hand-l"];
      hand.ox = (socket.x - root.x) * sourceToRig;
      hand.oy = (socket.y - root.y) * sourceToRig;
      hand.img.setPosition(hand.ox, hand.oy);
    }
    for (const foot of this.feet) {
      const socket = assembly.rigSockets[foot.front ? "foot-r" : "foot-l"];
      foot.ox = (socket.x - root.x) * sourceToRig;
      foot.oy = (socket.y - root.y) * sourceToRig;
      foot.img.setPosition(foot.ox, foot.oy);
    }
    // A torso swap is an intentional mount rebase, not spring input from the prior collar.
    this.floatingHeadLodSleeping = true;
  }

  private commitGearBakeLease(lease: GearTextureBakeLease): boolean {
    this.installBoilerplateIfReady();
    const head = this.boilerplateHead;
    const leftHand = this.hands.find((candidate) => !candidate.front)?.img;
    const rightHand = this.hands.find((candidate) => candidate.front)?.img;
    const leftFoot = this.feet.find((candidate) => !candidate.front)?.img;
    const rightFoot = this.feet.find((candidate) => candidate.front)?.img;
    if (!this.boilerplateReady || !head || !leftHand || !rightHand || !leftFoot || !rightFoot) {
      lease.release();
      return false;
    }
    const handles = lease.handles;
    if (Object.values(handles).some((handle) => !this.scene.textures.exists(handle.textureKey))) {
      lease.release();
      return false;
    }

    // One synchronous commit owns all six writes; Phaser cannot render a half-old loadout between them.
    this.body
      .setTexture(handles.body.textureKey)
      .setOrigin(handles.body.origin.x, handles.body.origin.y);
    head
      .setTexture(handles.head.textureKey)
      .setOrigin(handles.head.origin.x, handles.head.origin.y);
    leftHand
      .setTexture(handles["hand-l"].textureKey)
      .setOrigin(handles["hand-l"].origin.x, handles["hand-l"].origin.y);
    rightHand
      .setTexture(handles["hand-r"].textureKey)
      .setOrigin(handles["hand-r"].origin.x, handles["hand-r"].origin.y);
    leftFoot
      .setTexture(handles["foot-l"].textureKey)
      .setOrigin(handles["foot-l"].origin.x, handles["foot-l"].origin.y);
    rightFoot
      .setTexture(handles["foot-r"].textureKey)
      .setOrigin(handles["foot-r"].origin.x, handles["foot-r"].origin.y);
    this.slideAfterimageA
      .setTexture(handles.body.textureKey)
      .setOrigin(handles.body.origin.x, handles.body.origin.y);
    this.slideAfterimageB
      .setTexture(handles.body.textureKey)
      .setOrigin(handles.body.origin.x, handles.body.origin.y);

    const previousLease = this.gearBakeLease;
    this.gearBakeLease = lease;
    this.gearAssembly = lease.extras;
    this.applyResolvedRigSockets(lease.extras);
    this.gearArtComplete = false;
    this.clearGearAttachments();
    this.syncGearArt();
    this.syncHatOverflowLabel(lease.extras);
    this.gearLodSleeping = true;
    this.rebuildRenderStack();
    this.restTint();
    previousLease?.release();
    return true;
  }

  /**
   * Diff a validated account loadout onto retained gear images. The optional composition is already bounded
   * account data; absent composition repeats the equipped signature hat through unlocked prestige slots.
   */
  equipSyncedGear(
    gearUpper: string,
    gearLower: string,
    manifest: GearPartsManifest,
    prestige = 0,
  ): boolean {
    if (gearUpper.length === 0 || gearLower.length === 0) return false;
    const boundedPrestige = Number.isFinite(prestige)
      ? Math.min(MAX_HAT_SLOTS, Math.max(0, Math.floor(prestige)))
      : 0;
    if (
      gearUpper === this.syncedGearUpper &&
      gearLower === this.syncedGearLower &&
      boundedPrestige === this.syncedGearPrestige &&
      manifest === this.boilerplateManifest
    ) {
      return true;
    }
    this.syncedGearUpper = gearUpper;
    this.syncedGearLower = gearLower;
    this.syncedGearPrestige = boundedPrestige;
    this.equipGearLoadout(decodeGearCosmetics(gearUpper, gearLower), manifest, boundedPrestige);
    return true;
  }

  equipGearLoadout(
    loadout: Readonly<Record<GearSlot, GearId>>,
    manifest: GearPartsManifest,
    prestige = 0,
    towerComposition: readonly GearId[] = [],
    alternativeHead?: Readonly<AlternativeHeadTextureSelection> | null,
  ): void {
    const replacement = isGearReplacementManifest(manifest);
    const nextHeadTexture = replacement
      ? DEFAULT_LOADOUT_HEAD_TEXTURE
      : resolveLoadoutHeadTexture(alternativeHead);
    const headSignature = replacement
      ? "manifest"
      : `${nextHeadTexture.gearId ?? "boilerplate"}:${nextHeadTexture.textureKey}:${nextHeadTexture.frame ?? ""}`;
    const key = `${loadout.hat}|${loadout.glasses}|${loadout.facialHair}|${loadout.head}|${loadout.torso}|${loadout.gloves}|${loadout.boots}|${loadout.cloak}|${prestige}|${towerComposition.join(",")}|head:${headSignature}`;
    if (key === this.gearLoadoutKey && this.boilerplateManifest === manifest) return;
    const generation = ++this.gearBakeGeneration;
    this.gearUsesReplacement = replacement;
    this.loadoutHeadTexture = nextHeadTexture;
    this.requestBoilerplate(manifest);
    if (this.boilerplateReady) this.applyLoadoutHeadTexture();
    this.gearLoadoutKey = key;

    if (replacement) {
      const cache = gearTextureBakeCacheForScene(this.scene);
      void cache
        .acquireForGeneration(
          { manifest, loadout, prestige, towerComposition },
          generation,
          (candidate) => candidate === this.gearBakeGeneration,
        )
        .then((lease) => {
          if (!lease) return;
          if (!this.commitGearBakeLease(lease) && !this.gearBakeFailureReported) {
            this.gearBakeFailureReported = true;
            console.warn(
              "[gear-bake] complete bake could not be committed; preserving the prior complete rig",
            );
          }
        })
        .catch(() => {
          if (generation !== this.gearBakeGeneration || this.gearBakeFailureReported) return;
          this.gearBakeFailureReported = true;
          console.warn(
            "[gear-bake] replacement bake failed; preserving the prior complete rig/boilerplate",
          );
        });
      return;
    }

    const previousLease = this.gearBakeLease;
    this.gearBakeLease = undefined;
    this.restoreBoilerplateTextures();
    this.applyLoadoutHeadTexture();
    previousLease?.release();
    const next = assembleGearLoadout(manifest, loadout, prestige, towerComposition);
    this.gearAssembly = next;
    this.applyResolvedRigSockets(next);
    this.gearArtComplete = false;
    ensureGearAssemblyTextures(this.scene, next);

    for (let index = this.gearAttachments.length - 1; index >= 0; index--) {
      const attachment = this.gearAttachments[index];
      if (!attachment) continue;
      let retained: GearAssemblyPart | undefined;
      for (const spec of next.parts) {
        if (spec.key === attachment.spec.key) {
          retained = spec;
          break;
        }
      }
      if (retained) {
        attachment.spec = retained;
        attachment.angle = 0;
        attachment.velocity = 0;
        continue;
      }
      attachment.image.destroy();
      this.gearAttachments.splice(index, 1);
    }
    this.hatAttachments.length = 0;
    this.syncGearArt();
    this.syncHatOverflowLabel(next);
    this.gearLodSleeping = true;
    this.rebuildRenderStack();
  }

  /** Build only newly-ready descriptors; failed loose files leave that slot transparently absent. */
  private syncGearArt(): void {
    const assembly = this.gearAssembly;
    if (!assembly || !this.boilerplateReady || this.gearArtComplete) return;
    let changed = false;
    let allReady = true;
    for (const spec of assembly.parts) {
      let found: GearAttachment | undefined;
      for (const attachment of this.gearAttachments) {
        if (attachment.spec.key === spec.key) {
          found = attachment;
          break;
        }
      }
      if (found) continue;
      const frame = ensureGearPartFrame(this.scene, spec);
      if (!frame) {
        allReady = false;
        continue;
      }
      const image = this.scene.add
        .image(0, 0, gearTextureKey(spec.item), frame)
        .setOrigin(spec.originX, spec.originY)
        .setVisible(false);
      this.root.add(image);
      this.gearAttachments.push({ image, spec, angle: 0, velocity: 0 });
      changed = true;
    }
    this.gearArtComplete = allReady;
    if (!changed && this.hatAttachments.length > 0) return;
    this.hatAttachments.length = 0;
    for (const attachment of this.gearAttachments)
      if (attachment.spec.stackIndex >= 0) this.hatAttachments.push(attachment);
    this.hatAttachments.sort((a, b) => a.spec.stackIndex - b.spec.stackIndex);
    if (changed) {
      this.syncWeaponHandReplacement();
      this.rebuildRenderStack();
      this.restTint();
    }
  }

  private pushGearPlane(
    stack: Phaser.GameObjects.GameObject[],
    minPlane: number,
    maxPlane = minPlane,
  ): void {
    for (const attachment of this.gearAttachments) {
      const plane = attachment.spec.depth;
      if (plane >= minPlane && plane <= maxPlane) stack.push(attachment.image);
    }
    if (minPlane <= 32 && maxPlane >= 32 && this.hatOverflowLabel)
      stack.push(this.hatOverflowLabel);
  }

  private pushWeaponLayers(
    stack: Phaser.GameObjects.GameObject[],
    weapon: (typeof this.weapons)[number] | undefined,
  ): void {
    if (!weapon) return;
    if (weapon.tellRim) stack.push(weapon.tellRim);
    stack.push(weapon.img);
    if (weapon.tellEcho) stack.push(weapon.tellEcho);
  }

  /** Weapon gloves claim the same retained hand receivers as baked gear gloves. The hand node keeps
   *  animating as the mount/transform authority, but its current boilerplate-or-gear texture is hidden while
   *  a worn weapon occupies that receiver. A glove-pair is the one explicit two-receiver weapon contract. */
  private weaponReplacesHandReceiver(receiver: "hand-l" | "hand-r"): boolean {
    if (this.weapons.some((weapon) => weapon.def.glovePair !== undefined)) return true;
    const handIndex = receiver === "hand-r" ? 0 : 1;
    return this.weapons[handIndex]?.worn === true;
  }

  private weaponReplacesFootReceiver(receiver: "foot-l" | "foot-r"): boolean {
    const front = receiver === "foot-r";
    return this.wrapFootWeapons.some((weapon) => weapon.foot.front === front);
  }

  private syncWeaponHandReplacement(): void {
    for (const hand of this.hands) {
      const receiver = hand.front ? "hand-r" : "hand-l";
      hand.img.setVisible(!this.weaponReplacesHandReceiver(receiver));
    }
    for (const foot of this.feet) {
      const receiver = foot.front ? "foot-r" : "foot-l";
      foot.img.setVisible(!this.weaponReplacesFootReceiver(receiver));
    }
    for (const attachment of this.gearAttachments) {
      const receiver = attachment.spec.source.receiver;
      if (receiver === "hand-l" || receiver === "hand-r") {
        attachment.image.setVisible(!this.weaponReplacesHandReceiver(receiver));
      } else if (receiver === "foot-l" || receiver === "foot-r") {
        attachment.image.setVisible(!this.weaponReplacesFootReceiver(receiver));
      }
    }
  }

  /** One retained back-to-front law shared by weapon and wardrobe descriptor edges. */
  private rebuildRenderStack(): void {
    if (!this.root) return;
    const stack: Phaser.GameObjects.GameObject[] = [
      this.shadowHalo,
      this.shadow,
      this.auraGlow,
      this.auraRing,
      this.gloveAuraBoltA,
      this.gloveAuraBoltB,
      ...this.paintedAuraFill,
      ...this.paintedAuraParticles,
      this.slideAfterimageB,
      this.slideAfterimageA,
    ];
    this.pushGearPlane(stack, -50, -41);
    for (const foot of this.feet) {
      stack.push(foot.img);
      const receiver = foot.front ? "foot-r" : "foot-l";
      for (const attachment of this.gearAttachments)
        if (attachment.spec.source.receiver === receiver) stack.push(attachment.image);
      const wrap = this.wrapFootWeapons.find((candidate) => candidate.foot === foot);
      if (wrap) stack.push(wrap.img);
    }

    const frontHand = this.hands.find((hand) => hand.front);
    const backHand = this.hands.find((hand) => !hand.front);
    const frontWeapon = this.weapons[0];
    const backWeapon = this.weapons[1];
    if (this.orbitBehind) this.pushWeaponLayers(stack, frontWeapon);
    if (!backWeapon && !this.poseTwoHanded && backHand) {
      stack.push(backHand.img);
      for (const attachment of this.gearAttachments)
        if (attachment.spec.source.receiver === "hand-l") stack.push(attachment.image);
    }
    stack.push(this.body);
    if (this.boilerplateHead) stack.push(this.boilerplateHead);
    this.pushGearPlane(stack, 10, 32);

    if (this.poseTwoHanded) {
      const secondaryRole = frontWeapon
        ? resolvedGunGripPoints(frontWeapon.def)?.secondary?.role
        : undefined;
      const secondaryBehind = !!secondaryRole && !secondaryGripHandRendersAbove(secondaryRole);
      if (secondaryBehind && backHand) {
        stack.push(backHand.img);
        for (const attachment of this.gearAttachments)
          if (attachment.spec.source.receiver === "hand-l") stack.push(attachment.image);
      }
      if (!this.orbitBehind) this.pushWeaponLayers(stack, frontWeapon);
      if (!secondaryBehind && backHand) {
        stack.push(backHand.img);
        for (const attachment of this.gearAttachments)
          if (attachment.spec.source.receiver === "hand-l") stack.push(attachment.image);
      }
    } else if (backWeapon && backHand) {
      if (backWeapon.worn) {
        stack.push(backHand.img);
        for (const attachment of this.gearAttachments)
          if (attachment.spec.source.receiver === "hand-l") stack.push(attachment.image);
        this.pushWeaponLayers(stack, backWeapon);
      } else {
        this.pushWeaponLayers(stack, backWeapon);
        stack.push(backHand.img);
        for (const attachment of this.gearAttachments)
          if (attachment.spec.source.receiver === "hand-l") stack.push(attachment.image);
      }
    }

    if (frontHand) {
      if (!frontWeapon?.worn) {
        // The two-hand branch already placed the weapon below its role-aware support hand. Re-pushing it
        // here would cover pump/lever/crank hands despite their explicit above-art layering policy.
        if (frontWeapon && !this.orbitBehind && !this.poseTwoHanded)
          this.pushWeaponLayers(stack, frontWeapon);
        stack.push(frontHand.img);
        for (const attachment of this.gearAttachments)
          if (attachment.spec.source.receiver === "hand-r") stack.push(attachment.image);
      } else {
        stack.push(frontHand.img);
        for (const attachment of this.gearAttachments)
          if (attachment.spec.source.receiver === "hand-r") stack.push(attachment.image);
        this.pushWeaponLayers(stack, frontWeapon);
      }
    }
    if (this.tome) {
      for (const page of this.tome.pages) stack.push(page.quad);
      for (const scrap of this.tome.scraps) stack.push(scrap.piece);
    }
    stack.push(this.observedSourceRing, this.observedSourceFlash, this.pairGlint);
    if (this.label) stack.push(this.label);
    for (const object of stack) if (object.active) this.root.bringToTop(object);
  }

  setPosition(x: number, y: number): void {
    this.root.setPosition(x, y);
  }

  /** Keep parity derivation synced when gun starvation causes the server to rebase the pair epoch. */
  setDualWieldBaseSeq(pairBaseSeq: number): void {
    this.pairBaseSeq = pairBaseSeq >>> 0;
    this.pairBaseSeqReady = true;
  }

  heldWeaponDef(hand: 0 | 1): WeaponDef | undefined {
    return this.weapons[hand]?.def;
  }

  /** Current final affine of a held blade. The legacy name is retained, but the explicit hand parameter
   * carries remote/off-hand routing through the same accessor instead of opening a parallel pose seam. */
  leadWeaponTipPose(hand: 0 | 1 = 0): WeaponBladeAttachmentPose | undefined {
    const held = this.weapons[hand];
    if (!held) return undefined;
    const image = held.img;
    const matrix = image.getWorldTransformMatrix();
    const localTipX = image.width - image.displayOriginX;
    const localTipY = image.height * 0.5 - image.displayOriginY;
    const x = matrix.a * localTipX + matrix.c * localTipY + matrix.tx;
    const y = matrix.b * localTipX + matrix.d * localTipY + matrix.ty;
    const axisScale = Math.hypot(matrix.a, matrix.b);
    const normalScale = Math.hypot(matrix.c, matrix.d);
    if (axisScale <= 1e-6 || normalScale <= 1e-6) return undefined;
    const chain = this.comboChains[hand];
    const nowMs = this.presentationClockNow();
    const comboActive = chain.weaponId === held.def.id && nowMs <= chain.expiresAtMs;
    return {
      sourceId: this.bladeAttachmentSourceId,
      weaponId: held.def.id,
      hand,
      comboId: `${this.bladeAttachmentSourceId}:${hand}:${chain.generation}`,
      comboStep: chain.step,
      comboStartedAtMs: chain.startedAtMs,
      comboExpiresAtMs: chain.expiresAtMs,
      comboActive,
      nowMs,
      wielderX: this.root.x,
      wielderY: this.root.y,
      x,
      y,
      angle: Math.atan2(matrix.b, matrix.a),
      axisX: matrix.a / axisScale,
      axisY: matrix.b / axisScale,
      normalX: matrix.c / normalScale,
      normalY: matrix.d / normalScale,
      physicalBladeLength: Math.max(1, (1 - held.def.gripFrac) * image.width * axisScale),
      bladeWidth: Math.max(1, held.bladeWidthSourcePixels * normalScale),
      depth: this.root.depth,
    };
  }

  /** Refresh descriptor references without allocating; dev showroom changes become visible next frame. */
  private refreshPoseLanguageSelection(rebuildGeometry: boolean, force = false): void {
    const registry = this.scene.game?.registry;
    const pistol = pistolPoseVariantFrom(registry?.get(POSE_PISTOL_VARIANT_REGISTRY_KEY));
    const oneHandBlade = oneHandBladePoseVariantFrom(
      registry?.get(POSE_ONE_HAND_BLADE_VARIANT_REGISTRY_KEY),
    );
    const twoHandAuthority = twoHandPoseAuthorityFrom(
      registry?.get(POSE_TWO_HAND_AUTHORITY_REGISTRY_KEY),
    );
    const changed =
      pistol !== this.poseVariants.pistol ||
      oneHandBlade !== this.poseVariants.oneHandBlade ||
      twoHandAuthority !== this.poseVariants.twoHandAuthority;
    if (!force && !changed) return;

    this.poseVariants.pistol = pistol;
    this.poseVariants.oneHandBlade = oneHandBlade;
    this.poseVariants.twoHandAuthority = twoHandAuthority;
    const priorTwoHanded = this.poseTwoHanded;
    const leadDef = this.weapons[0]?.def ?? this.weaponDef;
    const offDef = this.weapons[1]?.def;
    this.poseLeadSpec = leadDef ? weaponPoseSpecFor(leadDef, this.poseVariants) : undefined;
    this.poseOffSpec = offDef ? weaponPoseSpecFor(offDef, this.poseVariants) : undefined;
    this.performanceSpec = weaponPerformanceSpecFor(leadDef);
    if (leadDef) this.movementPostureInput.spec = movementPostureFor(leadDef);
    this.flourishLeadSpec = leadDef ? weaponFlourishSpecFor(leadDef) : undefined;
    this.flourishOffSpec = offDef ? weaponFlourishSpecFor(offDef) : undefined;
    this.poseLeadBladeSize = leadDef ? bladeSizeClassFor(leadDef) : "standard";
    this.poseTwoHanded = !!leadDef && twoHandedPoseFor(leadDef, twoHandAuthority);
    if (rebuildGeometry && priorTwoHanded !== this.poseTwoHanded) {
      const backHand = this.hands.find((hand) => !hand.front);
      if (backHand) backHand.springReady = false;
      this.rebuildRenderStack();
    }
  }

  private sampleWeaponPose(
    input: PoseLanguageInput,
    out: PoseLanguageSample,
    spec: WeaponPoseSpec,
    timeS: number,
    phase: PoseActionPhase,
    phaseT: number,
    strikingHand: 0 | 1,
    freeHand: 0 | 1 | -1,
    reducedMotion: boolean,
    beamPhase: PoseBeamPhase | undefined,
  ): void {
    input.spec = spec;
    input.timeS = timeS;
    input.gait = this.gait;
    input.moveAmount = this.gait;
    input.phase = phase;
    input.phaseT = phaseT;
    input.strikingHand = strikingHand;
    input.freeHand = freeHand;
    input.reducedMotion = reducedMotion;
    input.beamPhase = beamPhase;
    samplePoseLanguage(input, out);
  }

  /** World-space grip anchor after jiggle, lift, and the container's facing transform. */
  handWorldAnchor(hand: 0 | 1): { x: number; y: number } {
    const held = this.weapons[hand];
    const rigHand = held?.hand ?? this.hands.find((entry) => entry.front === (hand === 0));
    if (!rigHand) return { x: this.root.x, y: this.root.y };
    const point = this.root.getWorldTransformMatrix().transformPoint(rigHand.img.x, rigHand.img.y);
    return { x: point.x, y: point.y };
  }

  /** Final rendered release hand for the accepted attack beat. Thrown delivery uses this presentation
   * origin while its immutable server projectile continues to launch from authoritative player state. */
  throwWorldAnchor(): { x: number; y: number } {
    return this.handWorldAnchor(this.swingHand === 1 ? 1 : 0);
  }

  /** Transform one authored PNG muzzle point through the final live sprite affine. */
  private writeWeaponArtMuzzle(
    point: WeaponArtMuzzlePoint,
    out: { x: number; y: number },
    preferredHand?: 0 | 1,
  ): boolean {
    const preferred = preferredHand === undefined ? undefined : this.weapons[preferredHand];
    const weapon =
      preferred?.partIndex === point.part
        ? preferred
        : this.weapons.find((candidate) => candidate.partIndex === point.part);
    if (!weapon?.img.active || !weapon.img.visible) return false;
    const image = weapon.img;
    const local = weaponSpriteTransform({
      x: image.x,
      y: image.y,
      originX: image.originX * image.width,
      originY: image.originY * image.height,
      rotation: image.rotation,
      scaleX: image.scaleX,
      scaleY: image.scaleY,
    });
    const matrix = this.root.getWorldTransformMatrix();
    const parent: WeaponAffineTransform = {
      a: matrix.a,
      b: matrix.b,
      c: matrix.c,
      d: matrix.d,
      tx: matrix.tx,
      ty: matrix.ty,
    };
    const sourceScale =
      weapon.firingFrameVisible && weapon.firingFrame ? weapon.firingFrame.sourceScale : 1;
    const activeFramePoint =
      sourceScale === 1 ? point : { x: point.x * sourceScale, y: point.y * sourceScale };
    return !!transformWeaponArtPoint(activeFramePoint, composeWeaponTransform(parent, local), out);
  }

  /**
   * Copy a specific physical barrel through position, rotation, scale, mirror, art correction, and recoil.
   * Beam rows use the stable authored point index.
   */
  writeWeaponMuzzle(hand: 0 | 1, out: { x: number; y: number }, pointIndex = 0): boolean {
    const definition = this.weapons[hand]?.def.muzzle ?? this.weaponDef?.muzzle;
    const point = definition?.points[pointIndex] ?? definition?.points[0];
    return point ? this.writeWeaponArtMuzzle(point, out, hand) : false;
  }

  /** Gun flashes/projectile admission use the exact same accepted-beat salvo selection as authority. */
  writeWeaponMuzzleForShot(
    acceptedSeq: number,
    barrelIndex: number,
    out: { x: number; y: number },
  ): boolean {
    const definition = this.weaponDef?.muzzle;
    if (!definition) return false;
    const points = weaponArtMuzzlePointsForShot(definition, acceptedSeq);
    const point = points[barrelIndex] ?? points[0];
    const hand = point?.part === 1 ? 1 : 0;
    return point ? this.writeWeaponArtMuzzle(point, out, hand) : false;
  }

  /** B19 swing punctuation reads the final independent hand/foot worn-sprite affine. */
  writeKungFuWrapMuzzle(
    limb: MeleeComboLimb | undefined,
    side: 0 | 1,
    out: { x: number; y: number },
  ): boolean {
    const definition = this.weaponDef?.muzzle;
    if (!definition) return false;
    const partIndex = limb === "foot" ? 1 : 0;
    const point = definition.points.find((candidate) => candidate.part === partIndex);
    if (!point) return false;
    if (partIndex === 0) return this.writeWeaponArtMuzzle(point, out, side);
    const wrappedFoot = this.wrapFootWeapons.find(
      (candidate) => candidate.foot.front === (side === 0),
    );
    if (!wrappedFoot?.img.active || !wrappedFoot.img.visible) return false;
    const image = wrappedFoot.img;
    const local = weaponSpriteTransform({
      x: image.x,
      y: image.y,
      originX: image.originX * image.width,
      originY: image.originY * image.height,
      rotation: image.rotation,
      scaleX: image.scaleX,
      scaleY: image.scaleY,
    });
    const matrix = this.root.getWorldTransformMatrix();
    const parent: WeaponAffineTransform = {
      a: matrix.a,
      b: matrix.b,
      c: matrix.c,
      d: matrix.d,
      tx: matrix.tx,
      ty: matrix.ty,
    };
    return !!transformWeaponArtPoint(point, composeWeaponTransform(parent, local), out);
  }

  /** Retained per-barrel kick. Camera shake and muzzle styling stay at Arena's hand-aware cue site. */
  triggerGunRecoil(timeMs: number, hand: 0 | 1): void {
    if (!this.weapons[hand]?.def.gun) return;
    this.gunRecoilAtMs = this.presentationEpochForWallEpoch(timeMs);
    this.gunRecoveryWallUntilMs = Math.max(
      this.gunRecoveryWallUntilMs,
      timeMs + RANGED_GUN_RECOVERY_MS,
    );
    this.gunRecoilHand = hand;
  }

  private holdRangedAim(epochMs: number, durationMs: number): void {
    if (!this.weapons.some((weapon) => usesAimedFiringStance(weapon.def))) return;
    if (epochMs > this.rangedAimActiveUntilMs + RANGED_AIM_SETTLE_MS) {
      this.rangedAimRaiseAtMs = epochMs;
    }
    this.rangedAimActiveUntilMs = Math.max(this.rangedAimActiveUntilMs, epochMs + durationMs);
  }

  private offWeaponLean(): number {
    const lead = this.weapons[0]?.def;
    const off = this.weapons[1]?.def;
    if (!lead || !off || lead.displayLength <= 0) return DUAL_BACK_WEAPON_LEAN;
    const lengthRatio = Math.max(0.7, Math.min(1.3, off.displayLength / lead.displayLength));
    return DUAL_BACK_WEAPON_LEAN * lengthRatio;
  }

  private destroyStowProxy(proxy: OutgoingStowProxy): void {
    proxy.img?.destroy();
    proxy.img = undefined;
    proxy.startMs = -1e9;
    proxy.destroyAtMs = -1e9;
  }

  private clearFlourishActivity(clearArms: boolean, clearProxies: boolean): void {
    for (const channel of this.flourishChannels) {
      channel.active = false;
      channel.startMs = -1e9;
    }
    if (clearArms) {
      for (const arm of this.flourishArms) {
        arm.armed = false;
        arm.earliestStartMs = -1e9;
        arm.weaponId = "";
      }
    }
    if (clearProxies) {
      for (const proxy of this.stowProxies) this.destroyStowProxy(proxy);
    }
    this.flourishHeadX = 0;
    this.flourishHeadY = 0;
  }

  private idleFlourishClockDef(): WeaponDef | undefined {
    return (
      this.weapons?.find((weapon) => weaponHasHandlingTag(weapon.def, "pistol"))?.def ??
      this.weaponDef
    );
  }

  /** Quiet time is player-perceived wall time. The flourish animation itself still samples the
   * freeze-aware presentation clock after it starts, so hit-stop holds a visible turn without delaying
   * its requested ~0.5s onset by several seconds. */
  private idleFlourishTimerNow(fallbackMs: number): number {
    const wallNow = this.scene?.time?.now;
    return typeof wallNow === "number" && Number.isFinite(wallNow) ? wallNow : fallbackMs;
  }

  /** Actionable presentation input wins immediately; combat clocks and the broader jiggle system are intact. */
  cancelFlourish(_reason = "input"): void {
    const hadState =
      this.flourishChannels[0].active ||
      this.flourishChannels[1].active ||
      this.flourishArms[0].armed ||
      this.flourishArms[1].armed ||
      !!this.stowProxies[0].img ||
      !!this.stowProxies[1].img;
    this.clearFlourishActivity(true, true);
    if (hadState) this.flourishCancelGeneration++;
    this.idleFlourishEligibleAtMs = idleFlourishEligibleEpoch(
      this.idleFlourishClockDef(),
      this.idleFlourishTimerNow(this.presentationClockNow()),
      this.idleFlourishOffsetMs,
      this.gunRecoveryWallUntilMs,
    );
  }

  /** Test/debug seam: one increment per real cancellation edge, never per polling frame. */
  get flourishCancelEdge(): number {
    return this.flourishCancelGeneration;
  }

  /** Scene retry seam: the observed identity changed, but the incoming art has not attached yet. */
  get weaponSwapPending(): boolean {
    return this.pendingSwapKey.length > 0;
  }

  private resetFlourishState(clearCounters: boolean, preservePendingSwap = false): void {
    this.clearFlourishActivity(true, true);
    if (preservePendingSwap && this.pendingSwapKey) {
      // §FLOURISH a lazy image decode can create the same clock cut as a background-tab hitch. Keep the
      // authoritative identity transition, but rebase its eventual draw to the attachment frame.
      this.pendingSwapEpochMs = Number.NaN;
    } else {
      this.pendingSwapKey = "";
      this.pendingSwapObservedKey = "";
      this.pendingSwapEpochMs = -1e9;
    }
    this.bladeNeutralReady = false;
    this.idleFlourishEligibleAtMs = Number.POSITIVE_INFINITY;
    if (clearCounters) {
      for (const streak of this.flourishStreaks) {
        streak.count = 0;
        streak.lastAcceptedMs = -1e9;
        streak.weaponId = "";
      }
    }
  }

  private beatFor(spec: WeaponFlourishSpec, moment: FlourishMoment) {
    switch (moment) {
      case "draw":
        return spec.draw;
      case "stow":
        return spec.stow;
      case "after-attack":
        return spec.afterAttack;
      default:
        return spec.idleSettle ?? spec.afterAttack;
    }
  }

  private startFlourishChannel(
    hand: 0 | 1,
    moment: FlourishMoment,
    startMs: number,
    spec: WeaponFlourishSpec,
  ): void {
    const channel = this.flourishChannels[hand];
    channel.active = true;
    channel.moment = moment;
    channel.startMs = startMs;
    channel.hand = hand;
    channel.rotationSign = hand === 0 ? 1 : -1;
    channel.spec = spec;
  }

  private startIncomingDraw(epochMs: number): void {
    const lead = this.flourishLeadSpec;
    if (!lead) return;
    this.clearFlourishActivity(true, false);
    this.startFlourishChannel(0, "draw", epochMs, lead);
    if (this.weapons[1] && this.flourishOffSpec) {
      this.startFlourishChannel(
        1,
        "draw",
        epochMs + FLOURISH_DUAL_DRAW_ECHO_MS,
        this.flourishOffSpec,
      );
    }
    this.pairCeremonyStartMs = -1e9;
    this.idleFlourishEligibleAtMs = idleFlourishEligibleEpoch(
      this.idleFlourishClockDef(),
      this.idleFlourishTimerNow(epochMs),
      this.idleFlourishOffsetMs,
    );
  }

  /** Snapshot the old visual before the equip path destroys it. Repeated lazy-art polling is idempotent. */
  beginWeaponSwap(oldWeaponId: string, newWeaponId: string, epochMs: number): void {
    if (!oldWeaponId || oldWeaponId === newWeaponId) return;
    const transitionKey = `${this.loadoutKey || oldWeaponId}->${newWeaponId}`;
    const observedKey = `${oldWeaponId}->${newWeaponId}`;
    if (
      transitionKey === this.pendingSwapKey ||
      transitionKey === this.lastSwapKey ||
      observedKey === this.pendingSwapObservedKey ||
      observedKey === this.lastSwapObservedKey
    )
      return;
    this.cancelFlourish("weapon-swap");
    this.pendingSwapKey = transitionKey;
    this.pendingSwapObservedKey = observedKey;
    this.lastSwapKey = transitionKey;
    this.lastSwapObservedKey = observedKey;
    this.pendingSwapEpochMs = epochMs;

    for (let index = 0; index < this.stowProxies.length; index++) {
      const hand = index as 0 | 1;
      const held = this.weapons[hand];
      const proxy = this.stowProxies[hand];
      this.destroyStowProxy(proxy);
      if (!held) continue;
      const img = this.scene.add
        .image(held.img.x, held.img.y, held.img.texture.key, held.img.frame.name)
        .setOrigin(held.img.originX, held.img.originY)
        .setScale(held.img.scaleX, held.img.scaleY)
        .setRotation(held.img.rotation)
        .setAlpha(held.img.alpha);
      this.root.add(img);
      this.root.moveBelow(img, this.body);
      proxy.img = img;
      proxy.startMs =
        epochMs + (hand === 0 && this.weapons.length > 1 ? FLOURISH_DUAL_STOW_ECHO_MS : 0);
      proxy.destroyAtMs = epochMs + 200;
      proxy.hand = hand;
      proxy.rotationSign = hand === 0 ? -1 : 1;
      proxy.spec = weaponFlourishSpecFor(held.def);
      proxy.x = held.img.x;
      proxy.y = held.img.y;
      proxy.rotation = held.img.rotation;
      proxy.scaleX = held.img.scaleX;
      proxy.scaleY = held.img.scaleY;
      proxy.aimLocal = held.semanticRotation;
    }
  }

  /** Missing art is the only allowed draw delay. A permanent failure closes the retained transition. */
  finishWeaponSwapWithoutArt(): void {
    this.pendingSwapKey = "";
    this.pendingSwapObservedKey = "";
    this.pendingSwapEpochMs = -1e9;
    this.lastSwapKey = "";
    this.lastSwapObservedKey = "";
  }

  private completePendingWeaponSwap(): void {
    if (!this.pendingSwapKey) return;
    const epochMs = Number.isFinite(this.pendingSwapEpochMs)
      ? this.pendingSwapEpochMs
      : this.presentationClockNow();
    this.pendingSwapKey = "";
    this.pendingSwapObservedKey = "";
    this.pendingSwapEpochMs = -1e9;
    this.lastSwapKey = "";
    this.lastSwapObservedKey = "";
    this.startIncomingDraw(epochMs);
  }

  private armAfterAttack(hand: 0 | 1, earliestStartMs: number, def: WeaponDef): void {
    const arm = this.flourishArms[hand];
    arm.armed = true;
    arm.earliestStartMs = earliestStartMs;
    arm.weaponId = def.id;
  }

  private recordAcceptedRangedBeat(hand: 0 | 1, epochMs: number): void {
    const def = this.weapons[hand]?.def ?? (hand === 0 ? this.weaponDef : undefined);
    if (!def) return;
    const mechanism = gunHandlingMechanismFor(def);
    if (mechanism) {
      // V7-HANDS: accepted attackSeq owns this clock directly. It is deliberately independent of the
      // generic flourish/quiet-input arbiter so the aimed firing mount and strafing cannot delay/cancel it.
      const cycle = this.gunHandlingCycles[hand];
      cycle.active = true;
      cycle.acceptedSeq = this.attackBeatSeq;
      cycle.mechanism = mechanism;
      cycle.startMs = epochMs;
      cycle.weaponId = def.id;
      return;
    }
    const spec = hand === 0 ? this.flourishLeadSpec : this.flourishOffSpec;
    if (!spec) return;
    // Caster recovery is body language, not another free-running spell effect. Arm the existing family
    // flourish on each accepted discrete cast; rapid fire keeps cancelling/rearming it until the actor is
    // quiet, so the final staff catch/page turn punctuates the phrase without obscuring its active cadence.
    if (def.tags.classPool === "caster" && !def.beam) {
      this.armAfterAttack(hand, epochMs + 230, def);
      return;
    }
    if (spec.streakThreshold <= 0 || def.beam) return;
    const streak = this.flourishStreaks[hand];
    const cadence = def.gun?.fireRate ?? def.cooldown;
    const gapMs = flourishStreakWindowMs(cadence);
    streak.count = nextFlourishStreakCount(
      streak.count,
      streak.lastAcceptedMs,
      streak.weaponId === def.id,
      epochMs,
      gapMs,
    );
    streak.weaponId = def.id;
    streak.lastAcceptedMs = epochMs;
    if (streak.count >= spec.streakThreshold) {
      streak.count = spec.streakThreshold;
      this.armAfterAttack(hand, epochMs + 140 + 90, def);
    }
  }

  private cancelForAcceptedRangedBeat(hand: 0 | 1): void {
    const preserveOtherArm =
      this.weapons.length > 1 &&
      this.weapons[0]?.def.id === this.weapons[1]?.def.id &&
      this.flourishArms[hand === 0 ? 1 : 0].armed;
    const other = hand === 0 ? 1 : 0;
    const savedOtherArm = preserveOtherArm ? { ...this.flourishArms[other] } : undefined;
    const currentWasArmed = this.flourishArms[hand].armed;
    this.cancelFlourish("accepted-attack");
    if (savedOtherArm) Object.assign(this.flourishArms[other], savedOtherArm);
    if (currentWasArmed) this.flourishStreaks[hand].count = 0;
  }

  private tryStartArmedFlourish(sceneNow: number): void {
    const leadReady =
      this.flourishArms[0].armed && sceneNow >= this.flourishArms[0].earliestStartMs;
    const offReady = this.flourishArms[1].armed && sceneNow >= this.flourishArms[1].earliestStartMs;
    if (!leadReady && !offReady) return;
    const both = leadReady && offReady;
    const nextLead: 0 | 1 =
      both && this.pairBaseSeqReady
        ? dualHandForSeq((this.attackBeatSeq + 1) >>> 0, this.pairBaseSeq)
        : 0;
    const first: 0 | 1 = both ? nextLead : leadReady ? 0 : 1;
    const second: 0 | 1 = first === 0 ? 1 : 0;
    const start = (hand: 0 | 1, atMs: number): void => {
      const spec = hand === 0 ? this.flourishLeadSpec : this.flourishOffSpec;
      if (!spec) return;
      this.startFlourishChannel(hand, "after-attack", atMs, spec);
      this.flourishArms[hand].armed = false;
      this.flourishStreaks[hand].count = 0;
      if (spec.family === "tome" && this.tome) {
        this.tome.pendingPage = true;
        this.tome.pendingPageAtMs = atMs + 55;
        this.tome.pendingPageSeq = this.attackBeatSeq;
        this.tome.openAtMs = Math.min(this.tome.openAtMs, atMs);
        this.tome.openUntilMs = Math.max(
          this.tome.openUntilMs,
          atMs + spec.afterAttack.timing.durationMs,
        );
      }
    };
    start(first, sceneNow);
    if (both) start(second, sceneNow + FLOURISH_DUAL_AFTER_ECHO_MS);
  }

  private sampleFlourishChannel(
    hand: 0 | 1,
    sceneNow: number,
    aimLocal: number,
    reducedMotion: boolean,
  ): FlourishSample {
    const channel = this.flourishChannels[hand];
    const input = this.flourishInputs[hand];
    const out = this.flourishSamples[hand];
    input.spec = this.beatFor(channel.spec, channel.moment);
    input.moment = channel.moment;
    input.elapsedMs = channel.active ? sceneNow - channel.startMs : -1;
    input.aimLocal = aimLocal;
    input.hand = hand;
    input.reducedMotion = reducedMotion;
    input.rotationSign = channel.rotationSign;
    sampleFlourish(input, out);
    if (channel.active && !out.active && input.elapsedMs >= 0) {
      channel.active = false;
      if (channel.moment === "idle-settle") this.idleFlourishLastPlayedMs = sceneNow;
    }
    return out;
  }

  private updateStowProxies(sceneNow: number, reducedMotion: boolean): void {
    for (let index = 0; index < this.stowProxies.length; index++) {
      const hand = index as 0 | 1;
      const proxy = this.stowProxies[hand];
      const img = proxy.img;
      if (!img) continue;
      if (sceneNow >= proxy.destroyAtMs) {
        this.destroyStowProxy(proxy);
        continue;
      }
      const input = this.stowInputs[hand];
      const out = this.stowSamples[hand];
      input.spec = proxy.spec.stow;
      input.moment = "stow";
      input.elapsedMs = sceneNow - proxy.startMs;
      input.aimLocal = proxy.aimLocal;
      input.hand = hand;
      input.reducedMotion = reducedMotion;
      input.rotationSign = proxy.rotationSign;
      sampleFlourish(input, out);
      if (!out.active && input.elapsedMs >= 0) {
        this.destroyStowProxy(proxy);
        continue;
      }
      if (!out.active) continue;
      const c = Math.cos(proxy.aimLocal);
      const s = Math.sin(proxy.aimLocal);
      const dx = (c * out.proxyForward - s * out.proxyLateral) * TARGET_BODY_H;
      const dy = (s * out.proxyForward + c * out.proxyLateral) * TARGET_BODY_H;
      img
        .setPosition(proxy.x + dx, proxy.y + dy)
        .setRotation(proxy.rotation + out.proxyRotationRad)
        .setScale(proxy.scaleX, proxy.scaleY)
        .setAlpha(out.proxyAlpha);
      if (!this.flourishChannels[0].active && !this.flourishChannels[1].active) {
        const bodyDx = (c * out.bodyForward - s * out.bodyLateral) * TARGET_BODY_H;
        const bodyDy = (s * out.bodyForward + c * out.bodyLateral) * TARGET_BODY_H;
        this.body.x += bodyDx;
        this.body.y += bodyDy;
        this.body.rotation += out.bodyTurn;
        const footDx = (c * out.footForward - s * out.footLateral) * TARGET_BODY_H;
        const footDy = (s * out.footForward + c * out.footLateral) * TARGET_BODY_H;
        for (const foot of this.feet) {
          const footSide = foot.front ? 1 : -0.72;
          foot.img.x += footDx * footSide;
          foot.img.y += footDy * footSide;
        }
        this.flourishHeadX = c * out.headForwardPx - s * out.headLateralPx;
        this.flourishHeadY = s * out.headForwardPx + c * out.headLateralPx;
      }
    }
  }

  /** Allocation-free lifetime reset; the next authored anchors rebase before any excitation is accepted. */
  private resetSecondaryMotion(): void {
    this.jiggleSignalX = 0;
    this.jiggleSignalY = 0;
    this.jiggleRootReady = false;
    this.poseRecoilConsumedAtMs = -1e9;
    this.floatingHeadSpring.x = 0;
    this.floatingHeadSpring.y = 0;
    this.floatingHeadSpring.vx = 0;
    this.floatingHeadSpring.vy = 0;
    this.floatingHeadSpring.ready = false;
    this.floatingHeadLodSleeping = true;
    for (const h of this.hands) {
      h.jx = 0;
      h.jy = 0;
      h.jvx = 0;
      h.jvy = 0;
      h.springReady = false;
    }
    for (const f of this.feet) {
      f.jx = 0;
      f.jy = 0;
      f.jvx = 0;
      f.jvy = 0;
      f.springReady = false;
    }
    for (const attachment of this.gearAttachments) {
      attachment.angle = 0;
      attachment.velocity = 0;
    }
    this.gearLodSleeping = true;
  }

  /** Top-down draw order: lower on screen renders in front. */
  setDepth(d: number): void {
    const depth = Math.round(d);
    if (depth === this.lastDepth) return;
    this.lastDepth = depth;
    this.root.setDepth(depth);
  }

  /** §5 jump hop: lift the rendered art by `px` (peak of the arc). The container's logical position is
   *  untouched, so the camera + depth-sort stay grounded — only the visible body/hands/feet/weapon rise. */
  setHop(px: number): void {
    this.hopTarget = px;
  }

  /** Exact cosmetic enemy-arc sample. Unlike player height, this value is already locally reconstructed at
   *  render time; animate applies it without another network-smoothing lag. */
  setEnemyComboPresentation(
    offerPhase: number,
    leapHeight: number,
    empowered: boolean,
    aimWorld: number,
  ): void {
    this.enemyComboOwnsHop = true;
    this.enemyComboHopPx = Math.max(0, leapHeight);
    this.enemyComboOfferPhase = clamp01(offerPhase);
    this.enemyComboEmpowered = empowered;
    this.enemyComboAimWorld = aimWorld;
  }

  triggerEnemyComboReturn(timeMs: number): void {
    this.enemyComboReturnAtMs = timeMs;
  }

  triggerEnemyComboLanding(timeMs: number): void {
    this.enemyComboLandedAtMs = timeMs;
  }

  triggerEnemyComboStagger(timeMs: number): void {
    this.enemyComboStaggerAtMs = timeMs;
  }

  /** Victim-side transition edge. Height/vh remain authoritative; this is only the brief paper tumble. */
  triggerJuggled(timeMs: number): void {
    this.juggledAtMs = timeMs;
  }

  /** §33 COLOSSUS framing: a PERMANENT upward art-lift (in body-heights) so a giant renders feet-at-the-
   *  ground with its torso towering off the top of the screen — "you only see his lower body". Like the hop,
   *  it moves ONLY the visible art (logical position, depth-sort + the grounded shadow stay put). `frac` = how
   *  many body-heights to lift; 0 = normal. */
  setLowerBodyFrame(frac: number): void {
    this.baseLift = frac * TARGET_BODY_H;
  }

  /** Set/clear the seekable flagship pose. The caller reasserts it each frame; no milestone tween owns it. */
  setVastagharPose(pose: VastagharRigPose | undefined): void {
    this.vastagharPose = pose?.active ? pose : undefined;
    if (!this.vastagharPose && this.vastagharDepthFront) {
      for (const foot of this.feet) this.root.moveBelow(foot.img, this.body);
      this.vastagharDepthFront = false;
    }
  }

  /** Arrival envelope is evaluated by `animate()` so facing, combo poses, and jiggle keep transform ownership. */
  playSpawnUnfold(timeMs: number, durationMs = 220): void {
    this.resetFlourishState(false);
    this.foldStartMs = -1;
    this.foldHiddenUntilMs = -1;
    this.spawnDurationMs = Math.max(1, durationMs);
    this.spawnStartMs = timeMs + Math.floor(this.phase * 70);
    this.root.scaleX = this.baseScale * 0.82;
    this.root.scaleY = this.baseScale * -0.04;
    this.root.rotation = 0.045;
  }

  /** Cosmetic-only departure twin of `playSpawnUnfold`; teleport ownership stays entirely server-side. */
  playFoldUp(timeMs: number, durationMs = 120): void {
    this.cancelFlourish("scene-fold");
    this.spawnStartMs = -1;
    this.foldStartMs = timeMs;
    this.foldDurationMs = Math.max(1, durationMs);
    for (const attachment of this.gearAttachments) {
      attachment.angle = 0;
      attachment.velocity = 0;
    }
    // A rejected cast cannot strand the card invisible while the pending-input latch expires.
    this.foldHiddenUntilMs = timeMs + this.foldDurationMs + 360;
  }

  /** Freeze the current printed layers into a lightweight Dimension Door decoy (no logical actor). */
  createPaperCopy(x: number, y: number, tint = 0x8f82d8): Phaser.GameObjects.Container {
    const secondaryLease = this.gearBakeLease?.retain();
    const layers: Phaser.GameObjects.Image[] = [];
    for (const child of this.root.list) {
      if (!(child instanceof Phaser.GameObjects.Image)) continue;
      const layer = this.scene.add
        .image(child.x, child.y, child.texture.key, child.frame.name)
        .setOrigin(child.originX, child.originY)
        .setScale(child.scaleX, child.scaleY)
        .setRotation(child.rotation)
        .setAlpha(Math.min(0.72, child.alpha))
        .setTint(tint)
        .setTintMode(Phaser.TintModes.MULTIPLY);
      layers.push(layer);
    }
    const copy = this.scene.add
      .container(x, y, layers)
      .setScale(this.facing * this.baseScale, this.baseScale)
      .setAlpha(0.58)
      .setDepth(99540);
    if (secondaryLease) copy.once("destroy", () => secondaryLease.release());
    return copy;
  }

  /** Immediate key response only: authoritative phase replaces this as soon as the row advances. */
  triggerUltimateWindup(timeMs: number, family: UltimateFamilyValue): void {
    this.cancelFlourish("ultimate-input");
    this.ultimateInputAtMs = timeMs;
    this.ultimateInputFamily = family;
  }

  /** Drive lasting pose/tint state exclusively from the synced nested UltimateState row. */
  setUltimatePresentation(
    family: UltimateFamilyValue,
    phase: UltimatePhaseValue,
    progress: number,
    reducedMotion: boolean,
  ): void {
    const changed = family !== this.ultimateFamily || phase !== this.ultimatePhase;
    if (phase !== UltimatePhase.Idle) this.cancelFlourish("ultimate");
    this.ultimateFamily = family;
    this.ultimatePhase = phase;
    this.ultimateProgress = clamp01(progress);
    this.ultimateReducedMotion = reducedMotion;
    if (phase !== UltimatePhase.Idle) this.ultimateInputAtMs = -1e9;
    if (changed) this.restTint();
  }

  /** §20 detached death: crumple, through-plane flutter, tear, or the cheap overflow/pit fold. */
  deathPop(vx: number, vy: number, treatment: PaperDeathTreatment = "flutter"): void {
    this.resetFlourishState(true);
    this.resetSwingCombo();
    this.resetSecondaryMotion();
    this.clearMeleeTellState();
    this.spawnStartMs = -1;
    this.root.rotation = 0;

    let tearOther: Phaser.GameObjects.Image | undefined;
    const tearParts: PaperDeathPartPose[] = [];
    if (treatment === "tear") {
      const frameW = Math.max(2, Math.floor(this.body.frame.width));
      const frameH = Math.max(1, Math.floor(this.body.frame.height));
      const split = Math.floor(frameW / 2);
      tearOther = this.scene.add
        .image(this.body.x, this.body.y, this.body.texture.key, this.body.frame.name)
        .setOrigin(this.body.originX, this.body.originY)
        .setScale(this.body.scaleX, this.body.scaleY)
        .setRotation(this.body.rotation)
        .setAlpha(this.body.alpha)
        .setCrop(split, 0, frameW - split, frameH);
      if (this.body.isTinted) tearOther.setTint(this.body.tintTopLeft);
      this.body.setCrop(0, 0, split, frameH);
      this.root.addAt(tearOther, this.root.getIndex(this.body) + 1);
      for (const img of [
        ...this.parts.filter((part) => part !== this.body),
        ...this.weapons.map((weapon) => weapon.img),
      ]) {
        tearParts.push({ img, x: img.x, y: img.y });
      }
      if (this.boilerplateHead)
        tearParts.push({
          img: this.boilerplateHead,
          x: this.boilerplateHead.x,
          y: this.boilerplateHead.y,
        });
      for (const attachment of this.gearAttachments)
        tearParts.push({
          img: attachment.image,
          x: attachment.image.x,
          y: attachment.image.y,
        });
    }

    this.paperDeath = {
      treatment,
      durationMs:
        treatment === "lite" || treatment === "pit"
          ? 160
          : treatment === "crumple"
            ? 240
            : treatment === "tear" && this.baseScale >= 4
              ? 720
              : 520,
      x0: this.root.x,
      y0: this.root.y,
      vx: treatment === "tear" && this.baseScale >= 4 ? vx * 1.4 : vx,
      vy,
      scaleX: this.root.scaleX,
      scaleY: this.root.scaleY,
      alpha: this.root.alpha,
      rotation: this.root.rotation,
      phase: this.phase * Math.PI * 2,
      bodyX: this.body.x,
      bodyY: this.body.y,
      bodyScaleX: this.body.scaleX,
      bodyScaleY: this.body.scaleY,
      bodyRotation: this.body.rotation,
      tearParts,
      tearOther,
      elapsedMs: 0,
    };
  }

  /** Advance a detached paper death. Returns false after it destroys its rig. */
  stepDeathPop(deltaMs: number): boolean {
    const death = this.paperDeath;
    if (!death) return false;
    death.elapsedMs += Math.max(0, Math.min(100, deltaMs));
    const q = clamp01(death.elapsedMs / death.durationMs);

    if (death.treatment === "pit") {
      this.root.x = death.x0;
      this.root.y = death.y0 + 14 * q;
      this.root.scaleX = death.scaleX * (1 - 0.25 * q);
      this.root.scaleY = death.scaleY * Math.cos((Math.PI * q) / 2);
      this.root.rotation = death.rotation + 0.07 * q;
    } else if (death.treatment === "lite") {
      const e = smoothstep01(q);
      this.root.x = death.x0 + death.vx * q * 0.28;
      this.root.y = death.y0 + death.vy * q * 0.28 + 10 * e;
      this.root.scaleX = death.scaleX * (1 - 0.78 * e);
      this.root.scaleY = death.scaleY * (1 - 1.04 * e);
      this.root.rotation = death.rotation + 0.045 * Math.sin(Math.PI * q);
      this.root.alpha = death.alpha * (1 - q);
    } else if (death.treatment === "crumple") {
      if (death.elapsedMs <= 90) {
        const e = smoothstep01(death.elapsedMs / 90);
        this.root.x = death.x0 + death.vx * 0.16 * e;
        this.root.y = death.y0 + death.vy * 0.16 * e;
        this.root.scaleX = death.scaleX * (1 + 0.12 * e);
        this.root.scaleY = death.scaleY * (1 - 0.28 * e);
        this.root.rotation = death.rotation + (death.phase < Math.PI ? -1 : 1) * 0.07 * e;
      } else {
        const e = smoothstep01((death.elapsedMs - 90) / 150);
        this.root.x = death.x0 + death.vx * (0.16 + 0.84 * e);
        this.root.y = death.y0 + death.vy * (0.16 + 0.84 * e) + 12 * e;
        this.root.scaleX = death.scaleX * (1.12 - 0.94 * e);
        this.root.scaleY = death.scaleY * (0.72 - 0.52 * e);
        this.root.rotation = death.rotation + (death.phase < Math.PI ? -1 : 1) * 0.07 * (1 - e);
        this.root.alpha = death.alpha * (1 - e);
      }
    } else {
      // P4: signed scale crosses edge-on three times; rotation is only a restrained paper ruffle.
      this.root.x =
        death.x0 + death.vx * q + 10 * (1 - q) * Math.sin(6 * Math.PI * q + death.phase);
      this.root.y = death.y0 + death.vy * q - 46 * Math.sin(Math.PI * q) + 18 * q * q;
      this.root.scaleX = death.scaleX * Math.cos(3 * Math.PI * q);
      this.root.scaleY = death.scaleY * (1 - 0.22 * Math.sin(Math.PI * q));
      this.root.rotation = death.rotation + 0.07 * Math.sin(4 * Math.PI * q + death.phase);
      this.root.alpha = death.alpha * (1 - q) ** 1.6;

      if (death.treatment === "tear" && death.tearOther) {
        const sep = smoothstep01(Math.min(1, death.elapsedMs / 80));
        const leftX = -9 * sep - 24 * q;
        const rightX = 9 * sep + 24 * q;
        this.body.x = death.bodyX + leftX;
        this.body.y = death.bodyY + 8 * q;
        this.body.scaleX = death.bodyScaleX;
        this.body.scaleY = death.bodyScaleY;
        this.body.rotation = death.bodyRotation + 0.07 * Math.sin(4 * Math.PI * q + death.phase);
        death.tearOther.x = death.bodyX + rightX;
        death.tearOther.y = death.bodyY - 6 * q;
        death.tearOther.scaleX = death.bodyScaleX;
        death.tearOther.scaleY = death.bodyScaleY;
        death.tearOther.rotation =
          death.bodyRotation + 0.07 * Math.sin(4 * Math.PI * q + death.phase + Math.PI);
        for (const part of death.tearParts) {
          const side = part.x < death.bodyX ? -1 : 1;
          part.img.x = part.x + (side < 0 ? leftX : rightX);
          part.img.y = part.y + (side < 0 ? 8 : -6) * q;
        }
      }
    }

    if (q < 1) return true;
    this.paperDeath = undefined;
    this.destroy();
    return false;
  }

  /** Scale the whole rig UNIFORMLY (bosses/toughs are BIGGER, not more detailed — §28.6). Stored so
   *  `animate()` re-applies it to both axes (the facing flip only touches scaleX). */
  setRigScale(mult: number): void {
    if (mult !== this.callerRigScale) {
      this.resetFlourishState(false);
      this.resetSecondaryMotion();
    }
    this.callerRigScale = mult;
    this.baseScale = mult * this.visualEnvelopeScale;
    this.root.setScale(this.baseScale);
  }

  /** Add a pulsing glow behind the body — the §15 "tough = glowier" tell. Lives in the container
   *  so it scales + moves with the rig. */
  addGlow(color: number): void {
    const glow = this.scene.add
      .ellipse(0, -TARGET_BODY_H * 0.35, TARGET_BODY_H * 1.9, TARGET_BODY_H * 1.9, color, 0.3)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.root.addAt(glow, 0); // behind every part
    this.scene.tweens.add({
      targets: glow,
      scale: 1.18,
      alpha: 0.5,
      duration: 620,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    });
  }

  /** Weapon/scene lifetime boundary: no accepted cadence or held guard may cross it. */
  private resetSwingCombo(): void {
    this.releaseAttackVisuals();
    this.swingStart = -1e9;
    this.swing = undefined;
    this.swingHand = 0;
    this.swingWeaponDef = undefined;
    this.crossfallActive = false;
    this.swingAimWorld = Number.NaN;
    this.swingChained = false;
    this.observedSignaturePending = false;
    this.observedSignatureWeapon = undefined;
    this.observedSignatureSwing = undefined;
    this.observedSignatureHand = 0;
    this.observedSignatureAtMs = -1e9;
    this.crossfallRibbonPending = false;
    this.crossfallRibbonAtMs = -1e9;
    this.observedSourceFlashAtMs = -1e9;
    this.observedSourceFlash.setVisible(false);
    this.observedSourceRing.setVisible(false);
    this.resetComboChain(true);
  }

  /** Snapshot only presentation channels. Root/weapon combat transforms stay on the authored accepted clock. */
  private beginComboStageTransition(acceptedAtMs: number, swing: RigSwingDescriptor): void {
    const authoredDurationMs = comboStageTransitionDurationMs(swing);
    const deadlineAtMs = acceptedAtMs + authoredDurationMs;
    const startedAtMs = Math.max(acceptedAtMs, this.presentationClockNow());
    const durationMs = Math.max(0, deadlineAtMs - startedAtMs);
    if (durationMs <= 0) {
      this.comboStageTransition = undefined;
      return;
    }
    const capture = (node: ComboStageTransformNode) => ({
      node,
      previous: {
        x: node.x,
        y: node.y,
        rotation: node.rotation,
        scaleX: node.scaleX,
        scaleY: node.scaleY,
      },
    });
    this.comboStageTransition = {
      acceptedAtMs,
      startedAtMs,
      deadlineAtMs,
      durationMs,
      root: {
        rotation: this.root.rotation,
        scaleX: this.root.scaleX,
        scaleY: this.root.scaleY,
      },
      parts: this.parts.map(capture),
      shadows: [capture(this.shadow), capture(this.shadowHalo)],
    };
  }

  /** Bridge body-only presentation under the authored root. Weapon images are intentionally never captured. */
  private applyComboStageTransition(sceneNow: number): void {
    const transition = this.comboStageTransition;
    if (!transition) return;
    if (
      Math.abs(this.root.scaleX) <= 1e-6 ||
      Math.abs(this.root.scaleY) <= 1e-6 ||
      Math.abs(transition.root.scaleX - this.root.scaleX) > 1e-6 ||
      Math.abs(transition.root.scaleY - this.root.scaleY) > 1e-6
    ) {
      this.comboStageTransition = undefined;
      return;
    }
    const elapsedMs = sceneNow - transition.startedAtMs;
    for (const captured of transition.parts) {
      if (!captured.node.active) continue;
      blendComboStagePresentationTransform(
        captured.previous,
        transition.root,
        captured.node,
        this.root,
        elapsedMs,
        transition.durationMs,
        captured.node,
      );
    }
  }

  /** Attack-shadow channels are authored after gear/VFX followers, so their safe residual is committed last. */
  private applyComboStageShadowTransition(sceneNow: number): void {
    const transition = this.comboStageTransition;
    if (!transition) return;
    const elapsedMs = sceneNow - transition.startedAtMs;
    for (const captured of transition.shadows) {
      if (!captured.node.active) continue;
      blendComboStagePresentationTransform(
        captured.previous,
        transition.root,
        captured.node,
        this.root,
        elapsedMs,
        transition.durationMs,
        captured.node,
      );
    }
    if (elapsedMs >= transition.durationMs) this.comboStageTransition = undefined;
  }

  /** Undo late paper transforms and close-blade target deltas when no subsequent frame can restore identity. */
  private releaseAttackVisuals(): void {
    const attackDy = this.attackArtOffY - this.attackLiftPx;
    for (const part of this.parts) {
      part.x -= this.attackArtOffX;
      part.y -= attackDy;
      part.scaleY /= Math.abs(this.attackScaleY) > 1e-5 ? this.attackScaleY : 1;
    }
    for (let i = 0; i < this.weapons.length; i++) {
      const weapon = this.weapons[i];
      if (!weapon) continue;
      weapon.img.x -= this.attackArtOffX;
      weapon.img.y -= attackDy;
      const ownsScale = this.swingHand === "both" || this.swingHand === i;
      if (ownsScale) {
        weapon.img.scaleX /= Math.abs(this.weaponLengthScale) > 1e-5 ? this.weaponLengthScale : 1;
        weapon.img.scaleY /= Math.abs(this.attackScaleY) > 1e-5 ? this.attackScaleY : 1;
      }
    }
    if (this.closeBladePoseActive) {
      const frontHand = this.hands.find((hand) => hand.front);
      const backHand = this.hands.find((hand) => !hand.front);
      const frontFoot = this.feet.find((foot) => foot.front);
      const backFoot = this.feet.find((foot) => !foot.front);
      if (frontHand) {
        frontHand.img.x -= this.closeBladeFrontHandDx;
        frontHand.img.y -= this.closeBladeFrontHandDy;
      }
      if (backHand) {
        backHand.img.x -= this.closeBladeBackHandDx;
        backHand.img.y -= this.closeBladeBackHandDy;
      }
      if (frontFoot) {
        frontFoot.img.x -= this.closeBladeFrontFootDx;
        frontFoot.img.y -= this.closeBladeFrontFootDy;
      }
      if (backFoot) {
        backFoot.img.x -= this.closeBladeBackFootDx;
        backFoot.img.y -= this.closeBladeBackFootDy;
      }
      this.body.x -= this.closeBladeBodyX;
      this.body.y -= this.closeBladeBodyY;
      this.body.rotation -= this.closeBladeBodyRotation;
      this.body.scaleX /=
        Math.abs(this.closeBladeBodyScaleX) > 1e-5 ? this.closeBladeBodyScaleX : 1;
      this.body.scaleY /=
        Math.abs(this.closeBladeBodyScaleY) > 1e-5 ? this.closeBladeBodyScaleY : 1;
      for (const weapon of this.weapons)
        weapon.img.setPosition(weapon.hand.img.x, weapon.hand.img.y);
    }
    if (this.signatureMotion) this.body.scaleX = Math.abs(this.body.scaleX);
    const shrink = Math.max(0.42, 1 - this.hopPx / 420);
    this.shadow
      .setPosition(0, TARGET_BODY_H * 0.42)
      .setRotation(0)
      .setScale(shrink, shrink)
      .setAlpha(0.3 * shrink);
    this.signatureMotion = undefined;
    this.attackArtOffX = 0;
    this.attackArtOffY = 0;
    this.attackLiftPx = 0;
    this.attackScaleY = 1;
    this.weaponLengthScale = 1;
    this.attackGripBlend = 0;
    this.attackGripX = 0;
    this.attackGripY = 0;
    this.attackBackGripX = 0;
    this.attackBackGripY = 0;
    this.attackFrontGripX = 0;
    this.attackFrontGripY = 0;
    this.attackFrontGripBlend = 0;
    this.attackBackGripBlend = 0;
    this.attackFrontFootX = 0;
    this.attackFrontFootY = 0;
    this.attackBackFootX = 0;
    this.attackBackFootY = 0;
    this.attackFrontFootBlend = 0;
    this.attackBackFootBlend = 0;
    this.attackShadowX = 0;
    this.attackShadowY = 0;
    this.attackShadowRotation = 0;
    this.attackShadowScaleX = 1;
    this.attackShadowScaleY = 1;
    this.attackShadowAlpha = 1;
    this.closeBladePoseActive = false;
    this.closeBladeBodyX = 0;
    this.closeBladeBodyY = 0;
    this.closeBladeBodyRotation = 0;
    this.closeBladeBodyScaleX = 1;
    this.closeBladeBodyScaleY = 1;
    this.closeBladeFrontHandDx = 0;
    this.closeBladeFrontHandDy = 0;
    this.closeBladeBackHandDx = 0;
    this.closeBladeBackHandDy = 0;
    this.closeBladeFrontFootDx = 0;
    this.closeBladeFrontFootDy = 0;
    this.closeBladeBackFootDx = 0;
    this.closeBladeBackFootDy = 0;
  }

  /** Timeout may preserve the old hold long enough to ease it out; swaps clear it immediately. */
  private resetComboChain(clearHold: boolean): void {
    this.comboFamily = "none";
    this.comboStep = 0;
    this.comboExpiresAtMs = -1e9;
    this.swingStep = 0;
    this.swingDirection = 1;
    this.swingFamily = "none";
    this.swingVariant = "default";
    if (clearHold) {
      this.comboHoldPose = undefined;
      this.comboStageTransition = undefined;
      for (const chain of this.comboChains) {
        chain.family = "none";
        chain.step = 0;
        chain.expiresAtMs = -1e9;
        chain.chainExpiresAtMs = -1e9;
        chain.weaponId = "";
        chain.hasAttackSeq = false;
        chain.attackSeq = 0;
        chain.acceptedAtMs = -1e9;
      }
    }
  }

  /** Arena's `animClock` advances only on unfrozen frames. Accepted beats arrive in Phaser wall time, so
   * preserve their relative offset while moving the epoch onto the one freeze-aware presentation clock. */
  private presentationClockNow(): number {
    const sceneClock = (this.scene as RigAttackPresentationScene).animClock;
    if (typeof sceneClock === "number" && Number.isFinite(sceneClock)) return sceneClock;
    return this.prevAnimMs >= 0 ? this.prevAnimMs : (this.scene.time?.now ?? 0);
  }

  private presentationEpochForWallEpoch(epochMs: number): number {
    const wallNow = this.scene.time?.now ?? 0;
    const arena = this.scene as RigAttackPresentationScene;
    const freezeHolding = (arena.frozenUntil ?? -Infinity) > wallNow || arena.wasFrozen === true;
    // A beat accepted while presentation is held begins at the held phase. Authoritative simulation still
    // advances; this only prevents the first unfrozen rig frame from inheriting wall time spent in hit-stop.
    const relativeMs = freezeHolding ? Math.max(0, epochMs - wallNow) : epochMs - wallNow;
    return this.presentationClockNow() + relativeMs;
  }

  /** Flush the one retained remote action intent only from `animate()`. Since Arena skips rig animation
   * during hit-stop, an accepted beat observed inside the freeze cannot let its authored source flourish run
   * ahead of the held actor. The predicting owner keeps ArenaScene's existing immediate dispatcher. */
  private flushObservedAttackSignature(sceneNow: number, outsidePaperView: boolean): void {
    if (!this.observedSignaturePending || sceneNow < this.observedSignatureAtMs) return;
    this.observedSignaturePending = false;
    const weapon = this.observedSignatureWeapon;
    const swing = this.observedSignatureSwing;
    const view = this.scene.cameras.main.worldView;
    const outsideSignatureView =
      this.root.x < view.left - REMOTE_SIGNATURE_LOD_MARGIN_PX ||
      this.root.x > view.right + REMOTE_SIGNATURE_LOD_MARGIN_PX ||
      this.root.y < view.top - REMOTE_SIGNATURE_LOD_MARGIN_PX ||
      this.root.y > view.bottom + REMOTE_SIGNATURE_LOD_MARGIN_PX;
    if (
      !weapon ||
      !swing ||
      outsidePaperView ||
      outsideSignatureView ||
      weapon.gun ||
      weapon.thrown ||
      weapon.cast
    )
      return;
    const elapsedMs = sceneNow - this.observedSignatureAtMs;
    if (elapsedMs > swing.poseSeconds * 1000) return;

    const scene = this.scene as RigAttackPresentationScene;
    const exact = scene.vfxPlayer?.spawnsAtCursor(weapon.id) ?? false;
    const reach = exact ? meleeReach(weapon) : 0;
    const signatureHand = this.observedSignatureHand;
    const anchor = this.handWorldAnchor(signatureHand);
    const x = anchor.x + this.observedSignatureAim.x * reach;
    const y = anchor.y + this.observedSignatureAim.y * reach;
    scene.spawnSlash?.(x, y, this.observedSignatureAim, weapon, swing, exact, undefined, () =>
      this.leadWeaponTipPose(signatureHand),
    );
    if (weapon.chainLightning)
      scene.spawnChain?.(this.root.x, this.root.y, this.observedSignatureAim, weapon);
  }

  /** Crossfall's rear edge is the sanctioned second ribbon, staggered by 0.06 of the pose window. */
  private flushCrossfallRibbon(sceneNow: number, outsidePaperView: boolean): void {
    if (!this.crossfallRibbonPending || sceneNow < this.crossfallRibbonAtMs) return;
    this.crossfallRibbonPending = false;
    if (outsidePaperView) return;
    const weapon = this.weapons[1]?.def;
    const swing = this.swing;
    if (!weapon || !swing || !this.crossfallActive) return;
    const view = this.scene.cameras.main.worldView;
    if (
      this.root.x < view.left - REMOTE_SIGNATURE_LOD_MARGIN_PX ||
      this.root.x > view.right + REMOTE_SIGNATURE_LOD_MARGIN_PX ||
      this.root.y < view.top - REMOTE_SIGNATURE_LOD_MARGIN_PX ||
      this.root.y > view.bottom + REMOTE_SIGNATURE_LOD_MARGIN_PX
    )
      return;
    const scene = this.scene as RigAttackPresentationScene;
    const exact = scene.vfxPlayer?.spawnsAtCursor(weapon.id) ?? false;
    const reach = exact ? meleeReach(weapon) : 0;
    const anchor = this.handWorldAnchor(1);
    scene.spawnSlash?.(
      anchor.x + this.observedSignatureAim.x * reach,
      anchor.y + this.observedSignatureAim.y * reach,
      this.observedSignatureAim,
      weapon,
      swing,
      exact,
      undefined,
      () => this.leadWeaponTipPose(1),
    );
  }

  /** Copy the final held-weapon transform into retained source shapes. This is the remote cast/tome LOD;
   * it never allocates from the render loop and never competes with exact danger geometry. */
  private syncObservedSourceFlash(sceneNow: number, outsidePaperView: boolean): void {
    const elapsedMs = sceneNow - this.observedSourceFlashAtMs;
    const weapon = this.weapons[this.observedSourceHand];
    if (
      this.isSelf ||
      outsidePaperView ||
      !weapon ||
      elapsedMs < 0 ||
      elapsedMs >= REMOTE_SOURCE_FLASH_MS
    ) {
      this.observedSourceFlash.setVisible(false);
      this.observedSourceRing.setVisible(false);
      return;
    }
    const q = clamp01(elapsedMs / REMOTE_SOURCE_FLASH_MS);
    const tip = weapon.img.width * Math.abs(weapon.img.scaleX) * (1 - weapon.img.originX);
    const x = weapon.img.x + Math.cos(weapon.semanticRotation) * tip;
    const y = weapon.img.y + Math.sin(weapon.semanticRotation) * tip;
    this.observedSourceFlash
      .setPosition(x, y)
      .setScale(
        screenTrueScaleX(this.root.scaleX, this.root.scaleY, 0.72 + q * 0.9),
        0.72 + q * 0.42,
      )
      .setAlpha((1 - q) * 0.88)
      .setVisible(true);
    this.observedSourceRing
      .setPosition(x, y)
      .setRotation(weapon.semanticRotation)
      .setScale(
        screenTrueScaleX(this.root.scaleX, this.root.scaleY, 0.5 + q * 1.15),
        0.5 + q * 0.72,
      )
      .setAlpha((1 - q) * 0.78)
      .setVisible(true);
  }

  private destroyTomeVisual(): void {
    const tome = this.tome;
    if (!tome) return;
    for (const page of tome.pages) page.quad.destroy();
    for (const scrap of tome.scraps) scrap.piece.destroy();
    this.tome = undefined;
  }

  private setupTomeVisual(
    spriteId: string,
    def: WeaponDef,
    closedTexture: { key: string; frame?: string },
  ): void {
    const art = tomeOpenArtFor(spriteId);
    const heldWeapon = this.weapons[0];
    if (!art || !heldWeapon) return;
    const makePage = (color: number): TomePageQuad => {
      const quad = this.scene.add
        .rectangle(0, 0, 1, 1, color, 0.9)
        .setOrigin(0, 0.5)
        .setStrokeStyle(0.7, 0x6f4a2b, 0.8)
        .setVisible(false);
      this.root.add(quad);
      this.root.moveTo(quad, this.root.getIndex(heldWeapon.img) + 1);
      return {
        quad,
        startMs: -1e9,
        durationMs: TOME_PAGE_DURATION_MS,
        direction: 1,
        active: false,
      };
    };
    const makeScrap = (color: number): TomeScrap => {
      const piece = this.scene.add
        .triangle(0, 0, 0, 0, 1, 0.16, 0.68, 1, color, 0.92)
        .setOrigin(0.5)
        .setStrokeStyle(0.6, 0x67452b, 0.72)
        .setVisible(false);
      this.root.add(piece);
      this.root.moveTo(piece, this.root.getIndex(heldWeapon.img) + 1);
      return { piece, startMs: -1e9, direction: 1, seed: 0, active: false };
    };
    this.tome = {
      openTextureKey: art.textureKey,
      closedTextureKey: closedTexture.key,
      closedFrame: closedTexture.frame,
      displayLength: def.displayLength,
      openRotationOffsetRad: tomeOpenRotationForAim(spriteId, 0),
      openGeometry: heldWeapon.artGeometry?.open,
      pages: [makePage(0xf1d09a), makePage(0xe5bd80)],
      scraps: [makeScrap(0xe9c88f), makeScrap(0xdab276)],
      openBaseScale: 0,
      openTextureReady: false,
      openVisible: false,
      hasSeq: false,
      lastSeq: 0,
      openAtMs: Number.POSITIVE_INFINITY,
      openUntilMs: -1e9,
      lastFlipAtMs: -1e9,
      pendingPage: false,
      pendingPageAtMs: -1e9,
      pendingPageSeq: 0,
      settleForUntilMs: -1e9,
    };
  }

  /** Feed either a predicted owner beat or an authoritative player beat into retained presentation state.
   *  Uint32 ordering ignores an older confirmation when local prediction already advanced ordinary poses;
   *  firing-frame state is recorded separately and only from an authoritative accepted epoch. */
  setAttackBeat(seq: number, held: boolean, epochMs: number, authoritative = true): void {
    const acceptedWallEpochMs = epochMs;
    epochMs = this.presentationEpochForWallEpoch(epochMs);
    const beat = seq >>> 0;
    if (authoritative) {
      const authorityAdvance = (beat - this.authoritativeFiringBeatSeq) >>> 0;
      if (
        !this.hasAuthoritativeFiringBeat ||
        (authorityAdvance > 0 && authorityAdvance < 0x80000000)
      ) {
        this.hasAuthoritativeFiringBeat = true;
        this.authoritativeFiringBeatSeq = beat;
        this.authoritativeFiringWeaponId = held ? (this.weaponDef?.id ?? "") : "";
      }
      // Accepted beats are ingested even while Arena hit-stop skips animate(). Sample here so a
      // short server release window cannot disappear behind a client presentation freeze.
      this.prepareFiringFrames();
    }
    let advanced = false;
    if (held) {
      this.holdRangedAim(epochMs, ATTACK_HELD_WINDOW * TICK_MS + RANGED_AIM_LINGER_MS);
    }
    if (!this.hasAttackBeatSeq) {
      this.hasAttackBeatSeq = true;
      this.attackBeatSeq = beat;
      this.attackBeatWallEpochMs = acceptedWallEpochMs;
    } else {
      const advance = (beat - this.attackBeatSeq) >>> 0;
      if (advance > 0 && advance < 0x80000000) {
        advanced = true;
        this.attackBeatSeq = beat;
        this.attackBeatWallEpochMs = acceptedWallEpochMs;
      }
    }

    if (
      advanced &&
      this.weaponDef &&
      (this.weaponDef.gun || this.weaponDef.cast || this.weaponDef.beam)
    ) {
      const hand: 0 | 1 =
        this.weapons.length > 1 && this.pairBaseSeqReady
          ? dualHandForSeq(beat, this.pairBaseSeq)
          : 0;
      if (this.weaponDef.gun) this.triggerGunRecoil(acceptedWallEpochMs, hand);
      this.cancelForAcceptedRangedBeat(hand);
      this.recordAcceptedRangedBeat(hand, epochMs);
    }

    const tome = this.tome;
    if (!tome) return;
    if (!tome.hasSeq) {
      tome.hasSeq = true;
      tome.lastSeq = beat;
      if (!held) return;
    } else {
      const advance = (beat - tome.lastSeq) >>> 0;
      if (advance === 0 || advance >= 0x80000000) {
        if (held) {
          tome.openUntilMs = Math.max(
            tome.openUntilMs,
            epochMs + ATTACK_HELD_WINDOW * TICK_MS + TOME_IDLE_CLOSE_MS,
          );
        }
        return;
      }
      tome.lastSeq = beat;
    }

    const now = this.presentationClockNow();
    if (now >= tome.openUntilMs) tome.openAtMs = epochMs;
    else tome.openAtMs = Math.min(tome.openAtMs, epochMs);
    tome.openUntilMs = Math.max(
      tome.openUntilMs,
      epochMs + ATTACK_HELD_WINDOW * TICK_MS + TOME_IDLE_CLOSE_MS,
    );
    // Rapid-fire books coalesce queued edges onto a ~3Hz physical page cadence; every latest attack beat
    // still refreshes the open latch and replaces the pending page rather than allocating overlapping VFX.
    tome.pendingPage = true;
    tome.pendingPageAtMs = Math.max(epochMs, tome.lastFlipAtMs + TOME_PAGE_INTERVAL_MS);
    tome.pendingPageSeq = beat;
    tome.settleForUntilMs = -1e9;
  }

  private hideTomeShapes(tome: TomeVisualState): void {
    for (const page of tome.pages) page.quad.setVisible(false);
    for (const scrap of tome.scraps) scrap.piece.setVisible(false);
  }

  private setTomeClosed(tome: TomeVisualState): void {
    const weapon = this.weapons[0];
    if (weapon && tome.openVisible) {
      weapon.img.setTexture(tome.closedTextureKey, tome.closedFrame);
    }
    tome.openVisible = false;
    this.hideTomeShapes(tome);
  }

  private startTomePage(
    tome: TomeVisualState,
    startMs: number,
    seq: number,
    settling: boolean,
  ): void {
    const a = tome.pages[0];
    const b = tome.pages[1];
    const page = !a.active ? a : !b.active ? b : a.startMs <= b.startMs ? a : b;
    page.startMs = startMs;
    page.durationMs = settling ? TOME_SETTLE_DURATION_MS : TOME_PAGE_DURATION_MS;
    page.direction = (seq & 1) === 0 ? -1 : 1;
    page.active = true;
    tome.lastFlipAtMs = startMs;

    // Deterministic one-in-four beat: a retained triangular scrap uses the same edge-on flutter language as
    // the other paper treatments, but never creates a tween/display object in the render loop.
    if (settling || (seq & 3) !== 0) return;
    const sa = tome.scraps[0];
    const sb = tome.scraps[1];
    const scrap = !sa.active ? sa : !sb.active ? sb : sa.startMs <= sb.startMs ? sa : sb;
    scrap.startMs = startMs + TOME_PAGE_DURATION_MS * 0.32;
    scrap.direction = page.direction;
    scrap.seed = seq;
    scrap.active = true;
  }

  /** Swap retained held textures from the synced server tick window; no local wall-time timer owns it. */
  private prepareFiringFrames(): void {
    for (const weapon of this.weapons) {
      const frame = weapon.firingFrame;
      const acceptedTick =
        frame &&
        this.hasAuthoritativeFiringBeat &&
        this.authoritativeFiringWeaponId === weapon.def.id
          ? this.authoritativeFiringAttackTick
          : undefined;
      const wantsFiringFrame =
        !!frame &&
        firingFrameSpriteAt(weapon.def, acceptedTick, this.authoritativeFiringClockTick) ===
          frame.spriteId &&
        this.scene.textures.exists(frame.textureKey);
      if (wantsFiringFrame === weapon.firingFrameVisible) continue;
      if (wantsFiringFrame && frame) {
        weapon.img
          .setTexture(frame.textureKey, frame.textureFrame)
          .setOrigin(frame.originX, frame.originY)
          .setScale(weapon.img.scaleX / frame.sourceScale, weapon.img.scaleY / frame.sourceScale);
        weapon.baseScale = weapon.closedBaseScale / frame.sourceScale;
      } else {
        const sourceScale = frame?.sourceScale ?? 1;
        weapon.img
          .setTexture(weapon.closedTextureKey, weapon.closedTextureFrame)
          .setOrigin(weapon.closedOriginX, weapon.closedOriginY)
          .setScale(weapon.img.scaleX * sourceScale, weapon.img.scaleY * sourceScale);
        weapon.baseScale = weapon.closedBaseScale;
      }
      weapon.firingFrameVisible = wantsFiringFrame;
    }
  }

  /** Sample the replicated server attack clock; local prediction never writes this tick pair. */
  setAuthoritativeAttackClock(attackTick: number, clockTick: number): void {
    this.authoritativeFiringAttackTick = attackTick >>> 0;
    this.authoritativeFiringClockTick = clockTick >>> 0;
    // Clock ingestion continues through hit-stop. This also guarantees the closed-frame return is
    // applied at the authoritative boundary rather than waiting for animation to resume.
    this.prepareFiringFrames();
  }

  /** Choose the painted held texture and advance scalar page scheduling before weapon pose writes. */
  private prepareTomeVisual(sceneNow: number, outsidePaperView: boolean): void {
    const tome = this.tome;
    const weapon = this.weapons[0];
    if (!tome || !weapon) return;
    if (!tome.openTextureReady && this.scene.textures.exists(tome.openTextureKey)) {
      const frame = this.scene.textures.get(tome.openTextureKey).get();
      const width = frame.realWidth || frame.width;
      if (width > 0) {
        tome.openBaseScale =
          (tome.displayLength * (tome.openGeometry?.displayLengthMul ?? 1)) / width;
        tome.openTextureReady = true;
      }
    }

    const wantsOpen =
      !weapon.def.muzzle &&
      tome.openTextureReady &&
      sceneNow >= tome.openAtMs &&
      sceneNow < tome.openUntilMs;
    if (!wantsOpen) {
      this.setTomeClosed(tome);
      if (sceneNow >= tome.openUntilMs) tome.pendingPage = false;
      return;
    }
    if (!tome.openVisible) {
      weapon.img.setTexture(tome.openTextureKey);
      tome.openVisible = true;
    }

    const settleAt = tome.openUntilMs - TOME_SETTLE_DURATION_MS;
    if (
      !outsidePaperView &&
      tome.pendingPage &&
      sceneNow >= tome.pendingPageAtMs &&
      sceneNow < settleAt &&
      tome.pendingPageAtMs < settleAt
    ) {
      this.startTomePage(tome, tome.pendingPageAtMs, tome.pendingPageSeq, false);
      tome.pendingPage = false;
    }
    if (!outsidePaperView && sceneNow >= settleAt && tome.settleForUntilMs !== tome.openUntilMs) {
      tome.pendingPage = false;
      tome.settleForUntilMs = tome.openUntilMs;
      this.startTomePage(tome, settleAt, tome.lastSeq, true);
    }
  }

  /** Copy the final weapon pose into the retained paper quads/scraps after hop, spawn, and attack offsets. */
  private syncTomeVisual(sceneNow: number, outsidePaperView: boolean): void {
    const tome = this.tome;
    const weapon = this.weapons[0];
    if (!tome || !weapon || !tome.openVisible || outsidePaperView) {
      if (tome) this.hideTomeShapes(tome);
      return;
    }
    const img = weapon.img;
    const rotation = img.rotation;
    const axisSign = img.scaleX < 0 ? -1 : 1;
    const pageScale = tomeOpenArtFor(weapon.spriteId)?.pageScale ?? 1;
    const pageWidth = img.displayWidth * 0.43 * pageScale;
    const pageHeight = img.displayHeight * 0.72 * pageScale;
    const spineOffset = (0.5 - img.originX) * img.displayWidth * axisSign;
    const spineX = img.x + Math.cos(rotation) * spineOffset;
    const spineY = img.y + Math.sin(rotation) * spineOffset;

    for (const page of tome.pages) {
      const elapsed = sceneNow - page.startMs;
      if (!page.active || elapsed < 0) {
        page.quad.setVisible(false);
        continue;
      }
      if (elapsed >= page.durationMs) {
        page.active = false;
        page.quad.setVisible(false);
        continue;
      }
      const q = clamp01(elapsed / page.durationMs);
      const turn = signedClamp(Math.cos(Math.PI * q), 0.055);
      page.quad
        .setPosition(spineX, spineY)
        .setRotation(rotation + page.direction * Math.sin(Math.PI * q) * 0.075)
        .setScale(
          page.direction * pageWidth * turn,
          pageHeight * (0.92 - 0.08 * Math.sin(Math.PI * q)),
        )
        .setAlpha(0.22 + 0.66 * Math.sin(Math.PI * q) ** 0.55)
        .setVisible(true);
    }

    for (const scrap of tome.scraps) {
      const elapsed = sceneNow - scrap.startMs;
      if (!scrap.active || elapsed < 0) {
        scrap.piece.setVisible(false);
        continue;
      }
      if (elapsed >= TOME_SCRAP_DURATION_MS) {
        scrap.active = false;
        scrap.piece.setVisible(false);
        continue;
      }
      const q = clamp01(elapsed / TOME_SCRAP_DURATION_MS);
      const seedPhase = (scrap.seed % 11) * 0.37;
      const along = scrap.direction * pageWidth * (0.08 + 0.58 * q);
      const lift = -pageHeight * (0.05 + 0.72 * q) + Math.sin(q * Math.PI * 3 + seedPhase) * 3;
      const c = Math.cos(rotation);
      const s = Math.sin(rotation);
      const flutter = signedClamp(Math.cos(q * Math.PI * 4 + seedPhase), 0.12);
      scrap.piece
        .setPosition(spineX + c * along - s * lift, spineY + s * along + c * lift)
        .setRotation(rotation + scrap.direction * q * 4.8 + Math.sin(q * Math.PI * 5) * 0.3)
        .setScale((4.2 + (scrap.seed % 3)) * flutter, 6.4 * (1 - q * 0.38))
        .setAlpha((1 - q) ** 1.35)
        .setVisible(true);
    }
  }

  /** Apply client-only painted geometry exactly once, after every semantic/presentation pose writer. */
  private applyWeaponArtGeometry(): void {
    for (let i = 0; i < this.weapons.length; i++) {
      const weapon = this.weapons[i];
      if (!weapon) continue;
      const state =
        i === 0 && this.tome?.openVisible ? weapon.artGeometry?.open : weapon.artGeometry?.closed;
      const authoredPrimary = resolvedGunGripPoints(weapon.def)?.primary;
      const firingFrame = weapon.firingFrameVisible ? weapon.firingFrame : undefined;
      weapon.img.setOrigin(
        firingFrame?.originX ?? authoredPrimary?.x ?? state?.originX ?? weapon.closedOriginX,
        firingFrame?.originY ?? authoredPrimary?.y ?? state?.originY ?? weapon.closedOriginY,
      );
      weapon.semanticRotation = weapon.img.rotation;
      weapon.img.scaleY *= edgeLeadScaleY(weapon.def.performance?.edgeLeadFlip);
      weapon.img.rotation += state?.artAngle ?? 0;
      weapon.img.scaleX *= weapon.imageFacingX;
    }
  }

  /** Copy the final hidden foot receiver transforms onto the visible B19 worn overlays. */
  private syncWrapFootWeapons(): void {
    const sourceScale = this.scale || 1;
    for (const wrapped of this.wrapFootWeapons) {
      const foot = wrapped.foot.img;
      const fixedScale = wrapped.baseScale / (this.baseScale || 1);
      wrapped.img
        .setPosition(foot.x, foot.y)
        .setRotation(foot.rotation)
        .setScale(
          fixedScale * wrapped.imageFacingX * (foot.scaleX / sourceScale),
          fixedScale * (foot.scaleY / sourceScale),
        )
        .setAlpha(foot.alpha)
        .setVisible(true);
    }
  }

  /** Equip (or swap) a weapon — one piece per hand (dual-wield uses both hands + both sprite
   *  parts). Each piece points along semantic +X in its hand, pivoting at the grip, and is inserted just
   *  BELOW that hand in the container so the hand overlays the hilt. */
  equipWeapon(spriteId: string, def: WeaponDef, manifest: SpriteManifest): void {
    const lead: RigLoadoutPiece = { spriteId, def, manifest, partIndex: 0 };
    const off: RigLoadoutPiece | undefined =
      def.glovePair && manifest.parts.length >= 1
        ? { spriteId, def, manifest, partIndex: 0 }
        : def.dual && manifest.parts.length >= 2
          ? { spriteId, def, manifest, partIndex: 1 }
          : undefined;
    this.equipLoadout(lead, off);
  }

  private destroyWrapFootWeapons(): void {
    for (const weapon of this.wrapFootWeapons) weapon.img.destroy();
    this.wrapFootWeapons.length = 0;
  }

  /** Equip one independently-authored part per hand through the final art-geometry correction seam. */
  equipLoadout(lead: RigLoadoutPiece, off?: RigLoadoutPiece, pairBaseSeq?: number): void {
    const spriteId = lead.spriteId;
    const def = lead.def;
    const manifest = lead.manifest;
    const previousKey = this.loadoutKey;
    const previousPaired = this.weapons.length > 1;
    const flourishSwapPending = this.pendingSwapKey.length > 0;
    if (!flourishSwapPending) {
      this.resetFlourishState(true);
      this.lastSwapKey = "";
      this.lastSwapObservedKey = "";
    } else {
      for (const streak of this.flourishStreaks) {
        streak.count = 0;
        streak.lastAcceptedMs = -1e9;
        streak.weaponId = "";
      }
    }
    for (const cycle of this.gunHandlingCycles) {
      cycle.active = false;
      cycle.acceptedSeq = 0;
      cycle.mechanism = undefined;
      cycle.startMs = -1e9;
      cycle.weaponId = "";
    }
    this.destroyMeleeTellLayers();
    this.destroyTomeVisual();
    this.destroyWrapFootWeapons();
    for (const w of this.weapons) w.img.destroy();
    this.weapons = [];
    this.weaponDef = def;
    this.refreshPoseLanguageSelection(false, true);
    this.loadoutKey = `${lead.spriteId}:${lead.def.id}|${off ? `${off.spriteId}:${off.def.id}` : ""}`;
    // §7 v0.105 de-clunk: reset the swing clock on a swap — otherwise elapsed time from the OLD weapon's
    // swing carries into the NEW weapon's timeline. §45 the combo/hold shares that exact lifetime boundary.
    this.resetSwingCombo();
    this.resetSecondaryMotion();
    this.clearMeleeTellState();
    this.pairBarStep = -1;
    this.pairBarExpiresAtMs = -1e9;
    this.gunRecoilAtMs = -1e9;
    this.gunRecoveryWallUntilMs = -1e9;
    this.rangedAimRaiseAtMs = -1e9;
    this.rangedAimActiveUntilMs = -1e9;
    if (off) {
      if (pairBaseSeq !== undefined) this.setDualWieldBaseSeq(pairBaseSeq);
      else if (!previousPaired) {
        this.pairBaseSeq = this.hasAttackBeatSeq ? this.attackBeatSeq : 0;
        this.pairBaseSeqReady = true;
      }
    } else {
      this.pairBaseSeq = 0;
      this.pairBaseSeqReady = false;
      this.pairCeremonyStartMs = -1e9;
      this.pairGlint.setVisible(false);
    }

    const frontHand = this.hands.find((h) => h.front);
    const backHand = this.hands.find((h) => !h.front);
    // §42 WORN gear pivots where the hand sits INSIDE the glove (~40% in from the cuff) instead of at the
    // authored gripFrac (the cuff) — gripFrac-mounting a gauntlet read as holding it by the opening and
    // smacking people with it, duel-challenge style.
    const attach = (
      piece: RigLoadoutPiece | undefined,
      hand: typeof frontHand,
    ): Phaser.GameObjects.Image | undefined => {
      if (!piece) return undefined;
      const partIndex = piece.partIndex ?? 0;
      const part = piece.manifest.parts[partIndex];
      if (!part || !hand) return undefined;
      const tx = partTexture(this.scene, piece.spriteId, part.role);
      const img = this.scene.add.image(hand.img.x, hand.img.y, tx.key, tx.frame);
      const artGeometry = partIndex === 0 ? weaponArtGeometryFor(piece.spriteId) : undefined;
      const closed = artGeometry?.closed;
      const pieceWorn = isWornWeapon(piece.def);
      const authoredPrimary = resolvedGunGripPoints(piece.def)?.primary;
      const imageFacingX = spriteImageFacingX(piece.manifest.imageFacing);
      const originX =
        authoredPrimary?.x ?? closed?.originX ?? (pieceWorn ? 0.4 : piece.def.gripFrac);
      const originY = authoredPrimary?.y ?? closed?.originY ?? 0.5;
      const wScale = (piece.def.displayLength * (closed?.displayLengthMul ?? 1)) / part.w;
      const resolvedFiringFrame = resolveWeaponFiringFrame(piece.def, piece.spriteId);
      const firingPart = resolvedFiringFrame?.manifest.parts[partIndex];
      const firingTexture =
        resolvedFiringFrame && firingPart
          ? partTexture(this.scene, resolvedFiringFrame.spriteId, firingPart.role)
          : undefined;
      img.setOrigin(originX, originY).setScale(wScale * imageFacingX, wScale);
      const getPixelAlpha = this.scene.textures?.getPixelAlpha;
      const bladeWidthSourcePixels = getPixelAlpha
        ? measureBladeWidthAtExtensionJoin(part.w, part.h, piece.def.gripFrac, (x, y) =>
            getPixelAlpha.call(this.scene.textures, x, y, tx.key, tx.frame),
          )
        : Math.max(1, part.h);
      this.root.add(img);
      this.weapons.push({
        img,
        hand,
        baseScale: wScale,
        closedBaseScale: wScale,
        def: piece.def,
        worn: pieceWorn,
        spriteId: piece.spriteId,
        partIndex,
        imageFacingX,
        artGeometry,
        bladeWidthSourcePixels,
        closedOriginX: originX,
        closedOriginY: originY,
        closedTextureKey: tx.key,
        closedTextureFrame: tx.frame,
        firingFrame:
          resolvedFiringFrame && firingTexture
            ? {
                spriteId: resolvedFiringFrame.spriteId,
                textureKey: firingTexture.key,
                textureFrame: firingTexture.frame,
                sourceScale: resolvedFiringFrame.registration.sourceScale,
                originX: resolvedFiringFrame.registration.originX,
                originY: resolvedFiringFrame.registration.originY,
              }
            : undefined,
        firingFrameVisible: false,
        semanticRotation: 0,
      });
      return img;
    };
    const frontWpn = attach(lead, frontHand);
    const backWpn = attach(off, backHand);
    const wrapMounts = wrapRigMountPlan(def, manifest);
    const footPart = manifest.parts[1];
    if (footPart) {
      const footTexture = partTexture(this.scene, spriteId, footPart.role);
      const imageFacingX = spriteImageFacingX(manifest.imageFacing);
      const footScale = def.displayLength / footPart.w;
      for (const mount of wrapMounts) {
        if (mount.partIndex !== 1) continue;
        const front = mount.receiver === "foot-r";
        const foot = this.feet.find((candidate) => candidate.front === front);
        if (!foot) continue;
        const img = this.scene.add
          .image(foot.img.x, foot.img.y, footTexture.key, footTexture.frame)
          .setOrigin(0.5)
          .setScale(footScale * imageFacingX, footScale);
        this.root.add(img);
        this.wrapFootWeapons.push({
          img,
          foot,
          baseScale: footScale,
          imageFacingX,
          partIndex: 1,
        });
      }
    }
    const frontPiece = this.weapons[0];
    const backPiece = this.weapons[1];
    this.syncWeaponHandReplacement();

    // Explicit z-stack (bottom→top): each weapon overlays the BODY but tucks UNDER its hand.
    // Single-wield keeps the back hand behind the body; dual brings it forward so both read.
    const stack: Phaser.GameObjects.GameObject[] = [];
    for (const f of this.feet) stack.push(f.img);
    const pushHandMount = (
      piece: (typeof this.weapons)[number] | undefined,
      hand: typeof frontHand,
    ): void => {
      if (!hand) return;
      if (piece?.worn || piece?.def.renderAboveHands) stack.push(hand.img, piece.img);
      else {
        if (piece) stack.push(piece.img);
        stack.push(hand.img);
      }
    };
    if (this.poseTwoHanded) {
      // 2H: grip-role layering; pump/lever/crank/vertical hands stay above the painted mechanism.
      stack.push(this.body);
      const secondaryRole = frontPiece
        ? resolvedGunGripPoints(frontPiece.def)?.secondary?.role
        : undefined;
      const secondaryBehind = !!secondaryRole && !secondaryGripHandRendersAbove(secondaryRole);
      if (secondaryBehind && backHand) stack.push(backHand.img);
      if (frontWpn) stack.push(frontWpn);
      if (!secondaryBehind && backHand) stack.push(backHand.img);
      if (frontHand) stack.push(frontHand.img);
    } else if (backWpn) {
      stack.push(this.body);
      // §42 worn dual (twin claws): each glove renders OVER its hand — the hand is inside it.
      pushHandMount(backPiece, backHand);
      pushHandMount(frontPiece, frontHand);
    } else {
      if (backHand) stack.push(backHand.img);
      stack.push(this.body);
      // §42 worn single: the glove covers the hand (hand under, weapon on top); held: hand grips the hilt.
      pushHandMount(frontPiece, frontHand);
    }
    stack.push(this.observedSourceRing, this.observedSourceFlash, this.pairGlint);
    if (this.label) stack.push(this.label);
    for (const obj of stack) this.root.bringToTop(obj);
    this.rebuildRenderStack();
    const firstPart = manifest.parts[lead.partIndex ?? 0];
    if (firstPart) {
      this.setupTomeVisual(spriteId, def, partTexture(this.scene, spriteId, firstPart.role));
    }
    this.refreshPoseLanguageSelection(false, true);
    if (
      backWpn &&
      previousKey.length > 0 &&
      previousKey !== this.loadoutKey &&
      !flourishSwapPending
    ) {
      this.pairCeremonyStartMs = this.presentationClockNow();
      this.flash(90);
      const audio = this.scene.game.registry.get("audio") as
        | { play?: (event: string, opts?: { x?: number; amt?: number }) => void }
        | undefined;
      audio?.play?.("pair", { x: this.root.x, amt: this.isSelf ? 1 : 0.65 });
    }
    if (flourishSwapPending) this.completePendingWeaponSwap();
    else
      this.idleFlourishEligibleAtMs = idleFlourishEligibleEpoch(
        this.idleFlourishClockDef(),
        this.idleFlourishTimerNow(this.presentationClockNow()),
        this.idleFlourishOffsetMs,
      );
  }

  /** Start a swing animation (damage is server-authoritative). `timeMs` is the accepted/predicted Phaser
   * wall epoch and is mapped once onto Arena's freeze-aware presentation clock; `aimWorld` freezes aim. */
  triggerSwing(
    timeMs: number,
    aimWorld?: number,
    swing?: RigSwingDescriptor,
    handOverride?: RigSwingHand,
    pairStepOverride?: number,
  ): void {
    this.cancelFlourish("attack-input");
    for (const streak of this.flourishStreaks) streak.count = 0;
    const acceptedAtMs = this.hasAttackBeatSeq ? this.attackBeatWallEpochMs : timeMs;
    timeMs = this.presentationEpochForWallEpoch(timeMs);
    const requestedSwing =
      swing ??
      (this.weaponDef ? swingDescriptorFor(this.weaponDef, this.weaponDef.cooldown) : undefined);
    const openingRibbon = requestedSwing?.comboRibbon;
    if (
      this.weaponDef &&
      openingRibbon?.fanOutStartScale !== undefined &&
      openingRibbon.fanOutEndScale !== undefined
    ) {
      const audit = globalThis as unknown as {
        __ddB18FanMotionAudit?: Array<Record<string, number | string>>;
      };
      const frames = audit.__ddB18FanMotionAudit;
      if (frames) {
        const foldedScale = comboRibbonFanOutScaleAt(openingRibbon, 0);
        frames.push({
          weaponId: this.weaponDef.id,
          comboStep: requestedSwing?.comboStep ?? this.comboStep,
          poseProgress: 0,
          fanOutProgress: 0,
          fanOutScale: foldedScale,
          weaponLengthScale: foldedScale,
        });
      }
    }
    const paired = this.weapons.length > 1;
    const pairedMelee =
      paired &&
      !!this.weaponDef &&
      !this.weaponDef.glovePair &&
      !this.weaponDef.gun &&
      !this.weaponDef.cast &&
      !this.weaponDef.beam;
    const priorPairStep = this.pairBarStep;
    const pairStageContinues =
      pairedMelee && priorPairStep >= 0 && timeMs <= this.pairBarExpiresAtMs;
    let comboStageAdvances = false;
    const explicitPairStep = pairStepOverride ?? swing?.pairStep;
    let pairStep = -1;
    if (pairedMelee) {
      if (explicitPairStep !== undefined) {
        pairStep =
          ((Math.trunc(explicitPairStep) % DUAL_MELEE_SEQUENCE_LENGTH) +
            DUAL_MELEE_SEQUENCE_LENGTH) %
          DUAL_MELEE_SEQUENCE_LENGTH;
      } else {
        pairStep =
          timeMs <= this.pairBarExpiresAtMs
            ? (this.pairBarStep + 1) % DUAL_MELEE_SEQUENCE_LENGTH
            : 0;
      }
      comboStageAdvances = pairStageContinues && pairStep !== priorPairStep;
      this.pairBarStep = pairStep;
      const cadence = requestedSwing?.effectiveCooldown ?? this.weaponDef?.cooldown ?? 0.3;
      this.pairBarExpiresAtMs = timeMs + cadence * 1000 + comboGraceMs(cadence);
    }
    const barHand = pairStep >= 0 ? DUAL_MELEE_PAIR_BAR[pairStep] : undefined;
    let swingHand: RigSwingHand = handOverride ?? swing?.hand ?? 0;
    if (barHand === "both") swingHand = "both";
    else if (barHand === "off") swingHand = 1;
    else if (barHand === "lead") swingHand = 0;
    else if (
      paired &&
      this.weaponDef?.glovePair &&
      handOverride === undefined &&
      swing?.hand === undefined &&
      this.hasAttackBeatSeq
    ) {
      // The matched mitt occupies one slot, not a bind: accepted beats alternate its mirrored hand parts.
      swingHand = dualHandForSeq(this.attackBeatSeq, 0);
    } else if (
      paired &&
      handOverride === undefined &&
      swing?.hand === undefined &&
      this.hasAttackBeatSeq &&
      this.pairBaseSeqReady
    ) {
      swingHand = dualHandForSeq(this.attackBeatSeq, this.pairBaseSeq);
    }
    const handIndex: 0 | 1 = swingHand === 1 ? 1 : 0;
    const activeDef = this.weapons[handIndex]?.def ?? this.weaponDef;
    let terminalFlourishHand: 0 | 1 | undefined;
    const terminalPairBar =
      pairedMelee && isTerminalFlourishStep(pairStep, DUAL_MELEE_PAIR_BAR.length);
    let nextSwing: RigSwingDescriptor | undefined;
    if (activeDef) {
      const effectiveCooldown = requestedSwing?.effectiveCooldown ?? activeDef.cooldown;
      nextSwing = {
        ...requestedSwing,
        ...swingDescriptorFor(activeDef, effectiveCooldown),
        hand: swingHand,
        ...(pairStep >= 0 ? { pairStep } : {}),
      };
    }
    this.swingHand = swingHand;
    this.swingWeaponDef = activeDef;
    this.crossfallActive = swingHand === "both" && paired;
    // §41 SPIN CHAIN remains byte-for-byte the old pose-window+150ms test. Ordinary styles no longer infer
    // continuity from their short 0.64× visual: they advance below from effective accepted cadence+grace.
    if (nextSwing?.style === "spin" && this.swing) {
      const prevDur = this.swing.poseSeconds * 1000;
      this.swingChained = timeMs - this.swingStart <= prevDur + 150;
    } else {
      this.swingChained = false;
    }

    if (this.crossfallActive && nextSwing) {
      nextSwing = {
        ...nextSwing,
        comboFamily: "rake",
        comboVariant: "default",
        comboStep: 2,
        motion: CROSSFALL_STEP.motion,
        comboDirection: 0,
        comboHand: "both",
        comboTiming: CROSSFALL_STEP.timing,
        comboPath: CROSSFALL_STEP.path,
        comboRibbon: CROSSFALL_STEP.ribbon,
      };
      this.comboFamily = "rake";
      this.comboStep = 2;
      this.comboExpiresAtMs = this.pairBarExpiresAtMs;
      this.swingStep = 2;
      this.swingDirection = 0;
      this.swingFamily = "rake";
      this.swingVariant = "default";
      this.comboHoldPose = {
        family: "rake",
        variant: "default",
        step: 2,
        direction: 0,
        expiresAtMs: this.pairBarExpiresAtMs,
      };
    }
    const selection =
      !this.crossfallActive && CLIENT_VISUAL_COMBOS && nextSwing && activeDef
        ? meleeComboSelectionFor(activeDef, nextSwing.style)
        : undefined;
    if (nextSwing && selection && activeDef) {
      const { family, variant, sequence } = selection;
      // Authored kung-fu wraps are one two-hand scroll even though glovePair mirrors the same texture into
      // two worn slots. Their accepted cadence advances one shared three-beat bar; legacy mitts retain the
      // per-hand voltage-boxing chains they shipped with.
      const comboChainHand = activeDef.glovePair && activeDef.impactMuzzle ? 0 : handIndex;
      const chain = this.comboChains[comboChainHand];
      const continues =
        chain.family === family && chain.weaponId === activeDef.id && timeMs <= chain.expiresAtMs;
      const previousStep = chain.step;
      const step =
        pairStep >= 0
          ? Math.min(sequence.length - 1, Math.floor(pairStep / 2))
          : nextSwing.comboStep !== undefined
            ? ((Math.trunc(nextSwing.comboStep) % sequence.length) + sequence.length) %
              sequence.length
            : this.hasAttackBeatSeq
              ? comboStepForChain(
                  this.attackBeatSeq,
                  acceptedAtMs,
                  activeDef.id,
                  family,
                  sequence.length,
                  chain.hasAttackSeq ? chain.attackSeq : undefined,
                  chain.acceptedAtMs,
                  chain.weaponId,
                  chain.family === "none" ? undefined : chain.family,
                  chain.step,
                  chain.chainExpiresAtMs,
                )
              : continues
                ? (chain.step + 1) % sequence.length
                : 0;
      // Compatibility note: the retired global branch was
      // comboStepForAttackSeq(this.attackBeatSeq, sequence.length); weapon/family/time now own the chain.
      const authored = sequence[step];
      if (authored) {
        if (continues && step !== previousStep) comboStageAdvances = true;
        if (isTerminalFlourishStep(step, sequence.length)) terminalFlourishHand = handIndex;
        // Continuity is based on the accepted/predicted START: readyAt=start+effective CD, then the authored
        // grace. Early buffered requests only reach this method when locally fired; Stage 2 will reconcile
        // this same `(weapon,family,step)` snapshot from authoritative swingSeq/comboStep.
        const expiresAtMs =
          timeMs + nextSwing.effectiveCooldown * 1000 + comboGraceMs(nextSwing.effectiveCooldown);
        const chainExpiresAtMs =
          acceptedAtMs +
          nextSwing.effectiveCooldown * 1000 +
          comboGraceMs(nextSwing.effectiveCooldown);
        this.comboFamily = family;
        this.comboStep = step;
        this.comboExpiresAtMs = expiresAtMs;
        chain.family = family;
        chain.step = step;
        chain.expiresAtMs = expiresAtMs;
        chain.chainExpiresAtMs = chainExpiresAtMs;
        chain.weaponId = activeDef.id;
        chain.hasAttackSeq = this.hasAttackBeatSeq;
        chain.attackSeq = this.attackBeatSeq;
        chain.acceptedAtMs = acceptedAtMs;
        if (!continues) {
          chain.generation = (chain.generation + 1) >>> 0;
          chain.startedAtMs = timeMs;
        }
        this.swingStep = step;
        this.swingDirection = authored.direction;
        this.swingFamily = family;
        this.swingVariant = variant;
        this.comboHoldPose = {
          family,
          variant,
          step,
          direction: authored.direction,
          expiresAtMs,
        };
        // Enrich the immutable presentation clock only. Geometry/damage remain the legacy centered sweep.
        nextSwing = swingDescriptorWithComboStep(nextSwing, activeDef, step);
      }
    } else if (nextSwing && activeDef && weaponUsesAuthoritativeEnvelopeCombo(activeDef)) {
      // Extension-only weapons such as Sanctified Headsman may use an orbit style with no authored visual
      // combo sequence. They still require one stable accepted-cadence identity so ignition cannot restart on
      // each repeated hit. This is identity/lifetime plumbing only; no pose family is invented here.
      const chain = this.comboChains[handIndex];
      const continues = chain.weaponId === activeDef.id && timeMs <= chain.expiresAtMs;
      const step = continues ? chain.step + 1 : 0;
      const expiresAtMs =
        timeMs + nextSwing.effectiveCooldown * 1000 + comboGraceMs(nextSwing.effectiveCooldown);
      chain.family = "none";
      chain.step = step;
      chain.expiresAtMs = expiresAtMs;
      chain.chainExpiresAtMs = expiresAtMs;
      chain.weaponId = activeDef.id;
      chain.hasAttackSeq = this.hasAttackBeatSeq;
      chain.attackSeq = this.attackBeatSeq;
      chain.acceptedAtMs = acceptedAtMs;
      if (!continues) {
        chain.generation = (chain.generation + 1) >>> 0;
        chain.startedAtMs = timeMs;
      }
      this.comboStep = step;
      this.comboExpiresAtMs = expiresAtMs;
      nextSwing = { ...nextSwing, comboStep: step };
    } else if (!this.crossfallActive) {
      this.resetComboChain(true);
    }
    if (comboStageAdvances && nextSwing) this.beginComboStageTransition(timeMs, nextSwing);
    this.swingStart = timeMs;
    this.swing = nextSwing;
    this.swingAimWorld = aimWorld ?? Number.NaN;
    if (nextSwing && Number.isFinite(this.swingAimWorld) && activeDef) {
      this.observedSignatureAim.x = Math.cos(this.swingAimWorld);
      this.observedSignatureAim.y = Math.sin(this.swingAimWorld);
      if (this.crossfallActive) {
        this.crossfallRibbonPending = true;
        this.crossfallRibbonAtMs = timeMs + nextSwing.poseSeconds * 1000 * 0.06;
      }
    }
    if (!this.isSelf && nextSwing && Number.isFinite(this.swingAimWorld) && activeDef) {
      this.observedSignaturePending = true;
      this.observedSignatureWeapon = activeDef;
      this.observedSignatureSwing = nextSwing;
      this.observedSignatureHand = handIndex;
      this.observedSignatureAtMs = timeMs;
      if (activeDef.cast) {
        const color = attackSignatureColor(activeDef.tags.element);
        this.observedSourceFlashAtMs = timeMs;
        this.observedSourceHand = handIndex;
        this.observedSourceFlash.setFillStyle(color, 0.88);
        this.observedSourceRing.setStrokeStyle(2, color, 0.9);
      }
    }
    if (nextSwing && activeDef) {
      const earliestStartMs = timeMs + nextSwing.poseSeconds * 1000 + 90;
      if (terminalPairBar) {
        const leadDef = this.weapons[0]?.def;
        const offDef = this.weapons[1]?.def;
        if (leadDef) this.armAfterAttack(0, earliestStartMs, leadDef);
        if (offDef) this.armAfterAttack(1, earliestStartMs, offDef);
      } else if (
        terminalFlourishHand !== undefined ||
        activeDef.tags.classPool === "caster" ||
        weaponPoseSpecFor(activeDef, this.poseVariants).family === "thrown"
      ) {
        this.armAfterAttack(terminalFlourishHand ?? handIndex, earliestStartMs, activeDef);
      }
    }
  }

  /** Sample a horde-melee anticipation directly from the latest reconstructed authoritative phase. */
  setMeleeTell(
    phase: number,
    aimWorld: number,
    remainingMs: number,
    locked: boolean,
    archetype = "duelist",
    step = 0,
    full = true,
    gold = false,
    airKeep = false,
  ): void {
    const sampled = Math.max(0, Math.min(0.985, phase));
    const newEpoch = this.meleeTellMode !== "windup" || sampled + 0.04 < this.meleeTellPhase;
    const goldEpoch = gold && !this.meleeTellGold;
    if (newEpoch || goldEpoch) {
      this.meleeTellGlintFired = false;
      this.meleeTellEdgeAtMs = -1e9;
      this.meleeTellFirstGlintFired = false;
      this.meleeTellFirstGlintAtMs = -1e9;
    }
    this.meleeTellMode = "windup";
    this.meleeTellReleasePose = false;
    this.meleeTellPhase = sampled;
    this.meleeTellRemainingMs = Math.max(0, remainingMs);
    this.meleeTellDurationMs = Math.max(1, remainingMs / Math.max(0.001, 1 - sampled));
    this.meleeTellAimWorld = aimWorld;
    this.meleeTellLocked = locked;
    this.meleeTellArchetype = archetype;
    this.meleeTellStep = Math.max(0, step | 0);
    this.meleeTellFull = full;
    this.meleeTellGold = gold;
    this.meleeTellAirKeep = airKeep;
    const sceneNow = this.presentationClockNow();
    if (full && gold && !this.meleeTellFirstGlintFired && remainingMs <= 450) {
      this.meleeTellFirstGlintFired = true;
      this.meleeTellFirstGlintAtMs = sceneNow;
    }
    if (
      full &&
      !this.meleeTellGlintFired &&
      remainingMs <= MELEE_GLINT_LEAD_MS &&
      (!gold || sceneNow - this.meleeTellFirstGlintAtMs >= 90)
    ) {
      // A late first sample fires one shortened crest immediately; missed Claim frames are never replayed.
      this.meleeTellGlintFired = true;
      this.meleeTellEdgeAtMs = sceneNow;
    }
    if (!full) this.clearMeleeTellTint();
  }

  /** Contact confirmation: keep the loaded vocabulary and run only its short follow-through. */
  resolveMeleeTell(timeMs: number, aimWorld: number): void {
    timeMs = this.presentationEpochForWallEpoch(timeMs);
    this.meleeTellReleasePose = this.meleeTellFull;
    this.meleeTellAimWorld = aimWorld;
    this.meleeTellMode = "resolve";
    this.meleeTellPhase = 1;
    this.meleeTellReleaseAtMs = timeMs;
    this.meleeTellFull = true;
    this.clearMeleeTellTint();
  }

  /** An authoritative reset without `atkSeq`: unwind the sampled chamber without crossing contact. */
  cancelMeleeTell(timeMs: number): void {
    if (this.meleeTellMode === "none") return;
    timeMs = this.presentationEpochForWallEpoch(timeMs);
    this.meleeTellReleasePose = this.meleeTellFull;
    this.meleeTellCancelPhase = this.meleeTellPhase;
    this.meleeTellMode = "cancel";
    this.meleeTellReleaseAtMs = timeMs;
    this.meleeTellFull = false;
    this.clearMeleeTellTint();
  }

  /** World-space striking-third anchor for the stable procedural bracket; returns false for handless rigs. */
  getMeleeTellAnchor(out: { x: number; y: number }): boolean {
    const weapon = this.weapons[0];
    const front = this.hands.find((hand) => hand.front);
    let localX: number;
    let localY: number;
    let hasImplement = false;
    if (weapon) {
      const tip = weapon.img.width * Math.abs(weapon.img.scaleX) * (1 - weapon.img.originX) * 0.78;
      localX = weapon.img.x + Math.cos(weapon.semanticRotation) * tip;
      localY = weapon.img.y + Math.sin(weapon.semanticRotation) * tip;
      hasImplement = true;
    } else if (front) {
      localX = front.img.x;
      localY = front.img.y;
      hasImplement = true;
    } else {
      out.x = this.root.x + Math.cos(this.meleeTellAimWorld) * TARGET_BODY_H * 0.34;
      out.y = this.root.y + Math.sin(this.meleeTellAimWorld) * TARGET_BODY_H * 0.34;
      return false;
    }
    const sx = localX * this.root.scaleX;
    const sy = localY * this.root.scaleY;
    const c = Math.cos(this.root.rotation);
    const s = Math.sin(this.root.rotation);
    out.x = this.root.x + sx * c - sy * s;
    out.y = this.root.y + sx * s + sy * c;
    return hasImplement;
  }

  /** Start a parry BRACE pose (§8) — raise the weapon to a horizontal block, draw the hands up into
   *  a guard, and dip into a brace, held ~the i-frame window. Purely a STANCE (no VFX yet; on-parry
   *  effects arrive with owned parry augments). */
  triggerBrace(timeMs: number): void {
    this.cancelFlourish("brace");
    this.comboStageTransition = undefined; // parry acquisition is an information-bearing sharp takeover
    // §7 v0.105 de-clunk: on a CHAIN parry (a press landing while the guard is still up), don't restart the
    // envelope from 0 — that re-ramps the raise over ~81ms and flickers the guard OFF for a frame right in
    // the Sekiro rhythm. Restart at the PLATEAU time instead so the guard holds continuously.
    this.braceStart =
      timeMs - this.braceStart < SpriteRig.BRACE_DUR ? timeMs - 0.18 * SpriteRig.BRACE_DUR : timeMs;
  }

  /** §8 Brand augment: a persistent ember-orange tint marking a Marked enemy (takes more damage). */
  private branded = false;
  /** §6 DOWNED state — fades + grey-tints the rig (it's a body on the ground until a rez revives it). */
  private downed = false;
  /** §20 one reschedulable impact-flash expiry per rig — prevents timer races and teardown retention. */
  private flashTimer?: Phaser.Time.TimerEvent;

  /** Toggle the §8 Brand tint. Cheap + idempotent — the scene calls it each frame off the synced state. */
  setBranded(on: boolean): void {
    if (on === this.branded) return;
    this.branded = on;
    this.restTint();
  }

  /** §6 DOWNED look: fade + a cold grey tint (a body on the ground), or restore on revive. */
  setDowned(on: boolean): void {
    if (on === this.downed) return;
    this.downed = on;
    this.resetFlourishState(true);
    this.resetSecondaryMotion();
    if (on) {
      this.resetSwingCombo(); // §45 a down/death boundary cannot bank a held finisher for revival
      if (this.tome) {
        this.tome.openUntilMs = -1e9;
        this.tome.pendingPage = false;
        this.setTomeClosed(this.tome);
      }
      this.clearMeleeTellState();
    }
    this.restTint();
  }

  /** Re-apply the resting tint (downed grey > phase-walk ink > Brand ember-orange > none). */
  private restTint(): void {
    const apply = (part: Phaser.GameObjects.Image): void => {
      if (this.downed) part.setTint(0x556070).setTintMode(Phaser.TintModes.MULTIPLY);
      else if (
        this.ultimatePhase === UltimatePhase.Active &&
        this.ultimateFamily === UltimateFamily.EventHorizon
      )
        part.setTint(0x7c6cff).setTintMode(Phaser.TintModes.MULTIPLY);
      else if (
        this.ultimatePhase === UltimatePhase.Active &&
        this.ultimateFamily === UltimateFamily.AlphaStrike
      )
        part.setTint(0xbfefff).setTintMode(Phaser.TintModes.MULTIPLY);
      else if (this.branded) part.setTint(0xff7a4a).setTintMode(Phaser.TintModes.MULTIPLY);
      else part.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    };
    for (const part of this.parts) apply(part);
    if (this.boilerplateHead) apply(this.boilerplateHead);
    for (const attachment of this.gearAttachments) apply(attachment.image);
  }

  /** The pale unprinted face remains the roll opening's exact tell; it never borrows parry white. */
  private applySlideInkTell(on: boolean): void {
    if (!on && !this.slideReverseFace) return;
    this.slideReverseFace = on;
    if (on) {
      for (const part of this.parts) part.setTint(0xeee8dc).setTintMode(Phaser.TintModes.FILL);
      this.boilerplateHead?.setTint(0xeee8dc).setTintMode(Phaser.TintModes.FILL);
      for (const attachment of this.gearAttachments)
        attachment.image.setTint(0xeee8dc).setTintMode(Phaser.TintModes.FILL);
      for (const weapon of this.weapons)
        weapon.img.setTint(0xd8d0c1).setTintMode(Phaser.TintModes.FILL);
      return;
    }
    this.restTint();
    for (const weapon of this.weapons)
      weapon.img.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
  }

  /** Sample two world-space card echoes at 60 ms spacing, then fade their retained images over 120 ms. */
  private updateSlideAfterimages(timeMs: number, reducedMotion: boolean): void {
    const sampling =
      this.moveStance === STANCE_SLIDE &&
      this.slidePhase === SLIDE_PHASE_GROUND &&
      this.slideRenderT <= ROLL_IFRAME_TICKS * ROLL_TICK_SECONDS &&
      !reducedMotion;
    if (sampling && !this.slideEchoSampling) {
      this.slideEchoSampling = true;
      this.slideEchoSampleAtMs = timeMs;
      this.slideEchoSampleX = this.root.x;
      this.slideEchoSampleY = this.root.y;
      this.slideEchoAAtMs = -1e9;
      this.slideEchoBAtMs = -1e9;
    } else if (!sampling) {
      this.slideEchoSampling = false;
    }
    if (sampling && timeMs - this.slideEchoSampleAtMs >= 60) {
      this.slideEchoBX = this.slideEchoAX;
      this.slideEchoBY = this.slideEchoAY;
      this.slideEchoBAtMs = this.slideEchoAAtMs;
      this.slideEchoAX = this.slideEchoSampleX;
      this.slideEchoAY = this.slideEchoSampleY;
      this.slideEchoAAtMs = timeMs;
      this.slideEchoSampleX = this.root.x;
      this.slideEchoSampleY = this.root.y;
      this.slideEchoSampleAtMs = timeMs;
    }
    this.writeSlideAfterimage(
      this.slideAfterimageA,
      this.slideEchoAX,
      this.slideEchoAY,
      timeMs - this.slideEchoAAtMs,
      0.28,
      reducedMotion,
    );
    this.writeSlideAfterimage(
      this.slideAfterimageB,
      this.slideEchoBX,
      this.slideEchoBY,
      timeMs - this.slideEchoBAtMs,
      0.2,
      reducedMotion,
    );
  }

  private writeSlideAfterimage(
    image: Phaser.GameObjects.Image,
    worldX: number,
    worldY: number,
    ageMs: number,
    maxAlpha: number,
    reducedMotion: boolean,
  ): void {
    if (reducedMotion || ageMs < 0 || ageMs >= 120) {
      image.setVisible(false);
      return;
    }
    image
      .setVisible(true)
      .setAlpha(maxAlpha * (1 - ageMs / 120))
      .setPosition(worldX - this.root.x + this.body.x, worldY - this.root.y + this.body.y)
      .setScale(Math.abs(this.body.scaleX), this.body.scaleY)
      .setRotation(this.body.rotation);
  }

  private clearMeleeTellState(): void {
    this.meleeTellMode = "none";
    this.meleeTellPhase = 0;
    this.meleeTellRemainingMs = Number.POSITIVE_INFINITY;
    this.meleeTellDurationMs = 1;
    this.meleeTellLocked = false;
    this.meleeTellFull = false;
    this.meleeTellGlintFired = false;
    this.meleeTellFirstGlintFired = false;
    this.meleeTellFirstGlintAtMs = -1e9;
    this.meleeTellGold = false;
    this.meleeTellAirKeep = false;
    this.meleeTellEdgeAtMs = -1e9;
    this.meleeTellReleaseAtMs = -1e9;
    this.meleeTellReleasePose = false;
    this.clearMeleeTellTint();
  }

  private clearMeleeTellTint(): void {
    for (const weapon of this.weapons) {
      weapon.img.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
      weapon.tellRim?.setVisible(false);
      weapon.tellEcho?.setVisible(false);
    }
  }

  private destroyMeleeTellLayers(): void {
    for (const weapon of this.weapons) {
      weapon.tellRim?.destroy();
      weapon.tellEcho?.destroy();
      weapon.tellRim = undefined;
      weapon.tellEcho = undefined;
    }
  }

  /** Full-tell layers are retained images; scale changes only thickness, never the weapon's painted length. */
  private ensureMeleeTellLayers(weapon: (typeof this.weapons)[number]): void {
    if (weapon.tellRim && weapon.tellEcho) return;
    const frame = weapon.img.frame.name;
    const rim = this.scene.add.image(0, 0, weapon.img.texture.key, frame);
    const echo = this.scene.add.image(0, 0, weapon.img.texture.key, frame);
    rim
      .setOrigin(weapon.img.originX, weapon.img.originY)
      .setTint(0x14100e)
      .setTintMode(Phaser.TintModes.FILL)
      .setVisible(false);
    echo
      .setOrigin(weapon.img.originX, weapon.img.originY)
      .setTint(0xffffff)
      .setTintMode(Phaser.TintModes.FILL)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false);
    this.root.add(rim);
    this.root.add(echo);
    this.root.moveBelow(rim, weapon.img);
    this.root.moveAbove(echo, weapon.img);
    weapon.tellRim = rim;
    weapon.tellEcho = echo;
  }

  private updateMeleeTellWeaponVisuals(sceneNow: number): void {
    const show = this.meleeTellMode === "windup" && this.meleeTellFull;
    const crest =
      show &&
      ((this.meleeTellGlintFired &&
        sceneNow - this.meleeTellEdgeAtMs >= 0 &&
        sceneNow - this.meleeTellEdgeAtMs <= MELEE_GLINT_CREST_MS) ||
        (this.meleeTellFirstGlintFired &&
          sceneNow - this.meleeTellFirstGlintAtMs >= 0 &&
          sceneNow - this.meleeTellFirstGlintAtMs <= MELEE_GLINT_CREST_MS));
    const glintColor = this.meleeTellGold ? 0xffd66e : 0xffffff;
    for (let i = 0; i < this.weapons.length; i++) {
      const weapon = this.weapons[i];
      if (!weapon) continue;
      const ownsTell = this.swingHand === "both" || this.swingHand === i;
      if (!show) {
        if (this.enemyComboEmpowered)
          weapon.img.setTint(0xffd66e).setTintMode(Phaser.TintModes.MULTIPLY);
        else weapon.img.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
        weapon.tellRim?.setVisible(false);
        weapon.tellEcho?.setVisible(false);
        continue;
      }
      if (!ownsTell) {
        weapon.tellRim?.setVisible(false);
        weapon.tellEcho?.setVisible(false);
        continue;
      }
      this.ensureMeleeTellLayers(weapon);
      const rim = weapon.tellRim;
      const echo = weapon.tellEcho;
      if (!rim || !echo) continue;
      echo.setTint(glintColor);
      const displayH = Math.max(1, weapon.img.height * Math.abs(weapon.img.scaleY));
      const rimY = 1 + 5 / displayH;
      const echoY = 1 + (crest ? 5 : 2.4) / displayH;
      const load = smoothstep01(this.meleeTellPhase / 0.65);
      const steady = this.meleeTellRemainingMs <= MELEE_GLINT_LEAD_MS ? 0.42 : 0.12 + load * 0.18;
      rim
        .setPosition(weapon.img.x, weapon.img.y)
        .setRotation(weapon.img.rotation)
        .setScale(weapon.img.scaleX, weapon.img.scaleY * rimY)
        .setAlpha(0.72)
        .setVisible(true);
      echo
        .setPosition(weapon.img.x, weapon.img.y)
        .setRotation(weapon.img.rotation)
        .setScale(weapon.img.scaleX, weapon.img.scaleY * echoY)
        .setAlpha(crest ? 0.95 : steady + (this.meleeTellLocked ? 0.08 : 0))
        .setVisible(true);
      if (crest) weapon.img.setTint(glintColor).setTintMode(Phaser.TintModes.FILL);
      else if (this.meleeTellGold)
        weapon.img.setTint(0xffd66e).setTintMode(Phaser.TintModes.MULTIPLY);
      else weapon.img.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    }
  }

  private updateJuggleFlash(sceneNow: number): void {
    const active = sceneNow - this.juggledAtMs >= 0 && sceneNow - this.juggledAtMs < 80;
    if (active === this.juggleFlashActive) return;
    this.juggleFlashActive = active;
    if (active) {
      for (const part of this.parts) part.setTint(0xe8f5ff).setTintMode(Phaser.TintModes.FILL);
      this.boilerplateHead?.setTint(0xe8f5ff).setTintMode(Phaser.TintModes.FILL);
      for (const attachment of this.gearAttachments)
        attachment.image.setTint(0xe8f5ff).setTintMode(Phaser.TintModes.FILL);
    } else {
      this.restTint();
    }
  }

  /** Brief impact flash on every part (§20 hit feedback / §6 revive pop), then back to the resting tint. */
  flash(ms = 80, color = 0xffffff): void {
    for (const p of this.parts) p.setTint(color).setTintMode(Phaser.TintModes.FILL);
    this.boilerplateHead?.setTint(color).setTintMode(Phaser.TintModes.FILL);
    for (const attachment of this.gearAttachments)
      attachment.image.setTint(color).setTintMode(Phaser.TintModes.FILL);
    // §20 a newer hit owns the flash window: cancel the prior expiry so it cannot clear this tint early.
    this.flashTimer?.remove(false);
    this.flashTimer = this.scene.time.delayedCall(ms, () => {
      this.flashTimer = undefined;
      this.restTint();
    });
  }

  get x(): number {
    return this.root.x;
  }

  get y(): number {
    return this.root.y;
  }

  /** Drop to EMPTY HANDS (the §9 fists fallback) — clears any held weapon sprite but keeps `def` so the
   *  unarmed swing still animates with the fists range/arc. Used when a weapon is dropped/salvaged. */
  unequip(def: WeaponDef, preservePendingSwap = false): void {
    if (!preservePendingSwap) this.resetFlourishState(true);
    else {
      if (this.pendingSwapKey) this.pendingSwapEpochMs = Number.NaN;
      for (const channel of this.flourishChannels) channel.active = false;
      for (const arm of this.flourishArms) arm.armed = false;
    }
    this.destroyMeleeTellLayers();
    this.destroyTomeVisual();
    this.destroyWrapFootWeapons();
    for (const w of this.weapons) w.img.destroy();
    this.weapons = [];
    this.syncWeaponHandReplacement();
    this.weaponDef = def;
    this.refreshPoseLanguageSelection(false, true);
    this.loadoutKey = def.id;
    this.pairBaseSeq = 0;
    this.pairBaseSeqReady = false;
    this.pairBarStep = -1;
    this.pairBarExpiresAtMs = -1e9;
    this.pairCeremonyStartMs = -1e9;
    this.pairGlint.setVisible(false);
    this.resetSwingCombo();
    this.resetSecondaryMotion();
    this.clearMeleeTellState();
    this.rebuildRenderStack();
  }

  destroy(): void {
    this.resetFlourishState(true);
    this.gearBakeGeneration++;
    // §20 the delayed callback closes over this rig; detach it before destroying the visible hierarchy.
    this.flashTimer?.remove(false);
    this.flashTimer = undefined;
    this.destroyMeleeTellLayers();
    this.destroyTomeVisual();
    this.destroyWrapFootWeapons();
    for (const w of this.weapons) w.img.destroy();
    this.hatOverflowLabel?.destroy();
    this.hatOverflowLabel = undefined;
    for (const attachment of this.gearAttachments) attachment.image.destroy();
    this.gearAttachments.length = 0;
    this.hatAttachments.length = 0;
    this.root.destroy();
    this.gearBakeLease?.release();
    this.gearBakeLease = undefined;
  }

  /** Absolute two-foot targets layer under the authored body translation. Ownership reaches zero by the
   * held guard, so gait/jiggle can settle without moving the authoritative root. */
  private setComboFootwork(
    tt: number,
    activeStart: number,
    activeEnd: number,
    followEnd: number,
    aimLocal: number,
    frontForward: number,
    frontLateral: number,
    backForward: number,
    backLateral: number,
  ): void {
    const own = actionOwnershipAt(tt, activeStart, activeEnd, followEnd);
    const fx = Math.cos(aimLocal);
    const fy = Math.sin(aimLocal);
    const nx = -fy;
    const ny = fx;
    this.attackFrontFootX = TARGET_BODY_H * (fx * frontForward + nx * frontLateral);
    this.attackFrontFootY = TARGET_BODY_H * (fy * frontForward + ny * frontLateral);
    this.attackBackFootX = TARGET_BODY_H * (fx * backForward + nx * backLateral);
    this.attackBackFootY = TARGET_BODY_H * (fy * backForward + ny * backLateral);
    this.attackFrontFootBlend = own;
    this.attackBackFootBlend = own;
  }

  /** Place the rear hand at a stable pole pivot and reconstruct the lead hand down the same haft. */
  private setRearPivotGrip(
    angle: number,
    rearX: number,
    rearY: number,
    spacing: number,
    blend: number,
  ): void {
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    this.attackGripX = rearX - ux * spacing;
    this.attackGripY = rearY - uy * spacing;
    this.attackBackGripX = rearX;
    this.attackBackGripY = rearY;
    this.attackHandSpacing = spacing;
    this.attackGripBoth = true;
    this.attackGripBlend = clamp01(blend);
  }

  /** Greatsword Momentum: every exit carries the blade into the next entry; the body travels much less than
   * the steel, with one depth pass and a low skid rather than Driftblade's hilt beat/forward collapse. */
  private applyMomentumCombo(motion: MeleeComboMotion, tt: number, aimLocal: number): number {
    this.signatureMotion = motion;
    const H = TARGET_BODY_H;
    const fx = Math.cos(aimLocal);
    const fy = Math.sin(aimLocal);
    const nx = -fy;
    const ny = fx;
    let angle = aimLocal;
    this.attackHandSpacing = H * 0.44;

    if (motion === "falling-gate") {
      const coil = aimLocal - 1.15;
      const contact = aimLocal + 0.8;
      const guard = forwardMeleeReadyAngle(aimLocal);
      if (tt < 0.22) {
        const p = clamp01(tt / 0.22);
        const e = p * (2 - p);
        angle = aimLocal - 0.62 + (coil - (aimLocal - 0.62)) * e;
        this.attackArtOffX = -fx * H * 0.04 * e;
        this.attackArtOffY = -fy * H * 0.04 * e;
        this.swingOffX = -fx * H * 0.06 * e;
        this.swingOffY = -fy * H * 0.06 * e - H * 0.05 * e;
        this.body.rotation -= 0.08 * e * Math.cos(aimLocal);
        this.body.scaleY *= 1 + 0.04 * e;
      } else if (tt < 0.5) {
        const p = clamp01((tt - 0.22) / 0.28);
        const fall = p * p;
        angle = coil + (contact - coil) * fall;
        const forward = -0.04 + 0.14 * fall;
        const lateral = 0.04 * fall;
        this.attackArtOffX = H * (fx * forward + nx * lateral);
        this.attackArtOffY = H * (fy * forward + ny * lateral);
        this.swingOffX = fx * H * 0.14 * fall - this.attackArtOffX;
        this.swingOffY = fy * H * 0.14 * fall - this.attackArtOffY;
        this.body.rotation += (-0.08 + 0.28 * fall) * Math.cos(aimLocal);
        this.body.scaleY *= 1.04 - 0.14 * fall;
      } else if (tt < 0.78) {
        const p = smoothstep01((tt - 0.5) / 0.28);
        angle = contact + (guard - contact) * p;
        this.attackArtOffX = H * (fx * (0.1 - 0.02 * p) + nx * 0.04);
        this.attackArtOffY = H * (fy * (0.1 - 0.02 * p) + ny * 0.04);
        this.swingOffX = fx * H * (0.14 - 0.03 * p) - this.attackArtOffX;
        this.swingOffY = fy * H * (0.14 - 0.03 * p) - this.attackArtOffY;
        this.body.rotation += 0.2 * Math.cos(aimLocal);
        this.body.scaleY *= 0.9 + 0.03 * p;
      } else {
        angle = guard;
        this.attackArtOffX = H * (fx * 0.08 + nx * 0.04);
        this.attackArtOffY = H * (fy * 0.08 + ny * 0.04);
        this.swingOffX = fx * H * 0.11 - this.attackArtOffX;
        this.swingOffY = fy * H * 0.11 - this.attackArtOffY;
        this.body.rotation += 0.2 * Math.cos(aimLocal);
        this.body.scaleY *= 0.93;
      }
      this.attackShadowRotation = aimLocal + 0.45;
      this.attackShadowScaleX = 1.08;
      this.attackShadowScaleY = 0.88;
      this.setComboFootwork(tt, 0.22, 0.54, 0.78, aimLocal, 0.07, 0.04, -0.03, -0.03);
      return angle;
    }

    if (motion === "backswing-wheel") {
      const start = aimLocal + 0.96;
      const finish = aimLocal + 4.45;
      let wheel = 0;
      if (tt < 0.1) {
        wheel = 0;
        angle = start + 0.08 * smoothstep01(tt / 0.1);
      } else if (tt < 0.44) {
        wheel = smoothstep01((tt - 0.1) / 0.34);
        angle = start + (finish - start) * wheel;
      } else if (tt < 0.77) {
        const p = smoothstep01((tt - 0.44) / 0.33);
        wheel = 1;
        angle = finish + 0.18 * Math.sin(Math.PI * p);
      } else {
        wheel = 1;
        angle = finish;
      }
      const pass = Math.sin(Math.PI * wheel);
      this.weaponLengthScale = Math.max(0.24, Math.abs(Math.cos(Math.PI * wheel)));
      this.attackWeaponDepth = wheel > 0.28 && wheel < 0.78 ? -1 : 1;
      this.attackHandSpacing = H * (0.44 - 0.14 * pass);
      const lateral = 0.07 * pass;
      this.attackArtOffX = nx * H * lateral;
      this.attackArtOffY = ny * H * lateral;
      this.swingOffX = -nx * H * 0.08 * pass;
      this.swingOffY = -ny * H * 0.08 * pass;
      this.body.rotation += (-0.1 * (1 - wheel) + 0.14 * wheel) * Math.cos(aimLocal);
      this.body.scaleY *= 1 - 0.05 * pass;
      this.attackShadowRotation = angle;
      this.attackShadowScaleX = 1 + 0.1 * pass;
      this.attackShadowScaleY = 1 - 0.14 * pass;
      this.setComboFootwork(tt, 0.1, 0.49, 0.77, aimLocal, 0, 0.05, 0, -0.05);
      return angle;
    }

    // Runaway Cleave: ~246 degrees of blade travel, but only a ~100-degree paper-body turn.
    const start = aimLocal - 1.83;
    let turn = 0;
    if (tt < 0.26) {
      const p = smoothstep01(tt / 0.26);
      angle = start - 0.17 * p;
      this.attackArtOffX = -fx * H * 0.03 * p;
      this.attackArtOffY = -fy * H * 0.03 * p;
      this.body.rotation -= 0.12 * p * Math.cos(aimLocal);
      this.body.scaleY *= 1 - 0.04 * p;
    } else if (tt < 0.54) {
      const p = clamp01((tt - 0.26) / 0.28);
      turn = p * p * 0.83;
      angle = start - 0.17 + 3.65 * p * p;
      const forward = -0.03 + 0.11 * p;
      this.attackArtOffX = fx * H * forward;
      this.attackArtOffY = fy * H * forward;
      this.body.rotation += (-0.12 + 0.24 * p) * Math.cos(aimLocal);
      this.body.scaleY *= 0.96 - 0.08 * p;
    } else if (tt < 0.64) {
      const p = smoothstep01((tt - 0.54) / 0.1);
      turn = 0.83 + 0.1 * p;
      angle = start + 3.48 + 0.45 * p;
      this.attackArtOffX = H * (fx * (0.08 + 0.03 * p) + nx * 0.03 * p);
      this.attackArtOffY = H * (fy * (0.08 + 0.03 * p) + ny * 0.03 * p);
      this.body.rotation += 0.12 * Math.cos(aimLocal);
      this.body.scaleY *= 0.88;
    } else if (tt < 0.86) {
      const p = smoothstep01((tt - 0.64) / 0.22);
      turn = 0.93 + 0.07 * p;
      angle = start + 3.93 + 0.3 * p;
      this.attackArtOffX = H * (fx * (0.11 + 0.04 * p) + nx * (0.03 + 0.02 * p));
      this.attackArtOffY = H * (fy * (0.11 + 0.04 * p) + ny * (0.03 + 0.02 * p));
      this.body.rotation += (0.12 + 0.05 * p) * Math.cos(aimLocal);
      this.body.scaleY *= 0.88 + 0.02 * p;
    } else {
      turn = 1;
      angle = start + 4.23;
      this.attackArtOffX = H * (fx * 0.12 + nx * 0.04);
      this.attackArtOffY = H * (fy * 0.12 + ny * 0.04);
      this.body.rotation += 0.17 * Math.cos(aimLocal);
      this.body.scaleY *= 0.9;
    }
    const projected = Math.hypot(Math.cos(angle), Math.sin(angle) * 0.34);
    const recoil = tt >= 0.54 && tt < 0.66 ? Math.sin(((tt - 0.54) / 0.12) * Math.PI) : 0;
    this.weaponLengthScale = projected * (1 + 0.05 * recoil);
    this.attackWeaponDepth = Math.sin(angle) < 0 ? -1 : 1;
    this.attackHandSpacing = H * (0.4 + 0.06 * turn);
    this.body.scaleX *= signedClamp(Math.cos(turn * 1.75), 0.3);
    this.attackShadowRotation = aimLocal;
    this.attackShadowScaleX = 1 + 0.16 * turn;
    this.attackShadowScaleY = 1 - 0.18 * turn;
    this.setComboFootwork(tt, 0.26, 0.64, 0.86, aimLocal, 0.08, 0.02, -0.02, 0.1);
    return angle;
  }

  /** Claymore Breach: broadside guards stay readable throughout; lateral plants and hilt spacing provide the
   * formality, while the finisher releases one edge after a rigid bind rather than promising two hits. */
  private applyBreachCombo(motion: MeleeComboMotion, tt: number, aimLocal: number): number {
    this.signatureMotion = motion;
    const H = TARGET_BODY_H;
    const fx = Math.cos(aimLocal);
    const fy = Math.sin(aimLocal);
    const nx = -fy;
    const ny = fx;
    let angle = aimLocal;
    this.weaponLengthScale = 1;
    this.attackWeaponDepth = 1;

    if (motion === "highland-gate") {
      const open = aimLocal - 1.42;
      const contact = aimLocal + 1.05;
      const guard = forwardMeleeReadyAngle(aimLocal);
      if (tt < 0.18) {
        const p = smoothstep01(tt / 0.18);
        angle = aimLocal - 1.58 + 0.16 * p;
        this.attackHandSpacing = H * (0.38 + 0.08 * p);
        this.body.rotation -= 0.06 * p * Math.cos(aimLocal);
      } else if (tt < 0.49) {
        const p = clamp01((tt - 0.18) / 0.31);
        const e = cubicOut01(p);
        angle = open + (contact - open) * e;
        this.attackHandSpacing = H * 0.46;
        this.attackArtOffX = fx * H * 0.06 * e;
        this.attackArtOffY = fy * H * 0.06 * e;
        this.body.rotation += (-0.06 + 0.2 * e) * Math.cos(aimLocal);
        this.body.scaleY *= 1 - 0.05 * e;
      } else if (tt < 0.8) {
        const p = smoothstep01((tt - 0.49) / 0.31);
        angle = contact + (guard - contact) * p;
        this.attackHandSpacing = H * (0.46 - 0.04 * p);
        this.attackArtOffX = fx * H * 0.06;
        this.attackArtOffY = fy * H * 0.06;
        this.body.rotation += 0.14 * Math.cos(aimLocal);
        this.body.scaleY *= 0.95 + 0.02 * p;
      } else {
        angle = guard;
        this.attackHandSpacing = H * 0.42;
        this.attackArtOffX = fx * H * 0.06;
        this.attackArtOffY = fy * H * 0.06;
        this.body.rotation += 0.14 * Math.cos(aimLocal);
        this.body.scaleY *= 0.97;
      }
      this.attackShadowRotation = aimLocal + Math.PI / 2;
      this.attackShadowScaleX = 1.12;
      this.attackShadowScaleY = 0.9;
      this.setComboFootwork(tt, 0.18, 0.58, 0.8, aimLocal, 0, 0.1, 0, -0.05);
      return angle;
    }

    if (motion === "rising-ward") {
      const hip = aimLocal + 1.2;
      const roof = aimLocal - 1.28;
      const ready = forwardMeleeReadyAngle(aimLocal);
      if (tt < 0.12) {
        const p = smoothstep01(tt / 0.12);
        angle = hip + 0.12 * p;
        this.attackArtOffX = nx * H * 0.03 * p;
        this.attackArtOffY = ny * H * 0.03 * p;
        this.attackHandSpacing = H * 0.42;
        this.body.rotation += 0.1 * p * Math.cos(aimLocal);
      } else if (tt < 0.46) {
        const p = clamp01((tt - 0.12) / 0.34);
        const e = cubicOut01(p);
        angle = hip + 0.12 + (roof - hip - 0.12) * e;
        this.attackArtOffX = nx * H * (0.03 + 0.05 * e);
        this.attackArtOffY = ny * H * (0.03 + 0.05 * e);
        this.attackHandSpacing = H * (0.38 + 0.08 * e);
        this.body.rotation += (0.1 - 0.34 * e) * Math.cos(aimLocal);
        this.body.scaleY *= 1 + 0.05 * e;
      } else if (tt < 0.78) {
        const p = smoothstep01((tt - 0.46) / 0.32);
        angle = mixAngle(roof, ready, p);
        this.attackArtOffX = nx * H * (0.08 - 0.02 * p);
        this.attackArtOffY = ny * H * (0.08 - 0.02 * p);
        this.attackHandSpacing = H * 0.46;
        this.body.rotation -= 0.24 * Math.cos(aimLocal);
        this.body.scaleY *= 1.05;
      } else {
        angle = ready;
        this.attackArtOffX = nx * H * 0.06;
        this.attackArtOffY = ny * H * 0.06;
        this.attackHandSpacing = H * 0.46;
        this.body.rotation -= 0.24 * Math.cos(aimLocal);
        this.body.scaleY *= 1.05;
      }
      this.attackShadowRotation = roof;
      this.attackShadowScaleX = 1.04;
      this.attackShadowScaleY = 0.92;
      this.setComboFootwork(tt, 0.12, 0.52, 0.78, aimLocal, 0, -0.06, 0, 0.06);
      return angle;
    }

    // Bind, Break, Cast Off: a held crossguard barricade precedes one dominant reverse edge.
    const roof = aimLocal - 1.28;
    const barricade = aimLocal + Math.PI / 2;
    const cast = aimLocal - 1.18;
    if (tt < 0.18) {
      const p = smoothstep01(tt / 0.18);
      angle = roof + (barricade - roof) * p;
      this.attackHandSpacing = H * (0.42 - 0.1 * p);
      this.body.scaleX *= 1 - 0.08 * p;
    } else if (tt < 0.3) {
      const p = smoothstep01((tt - 0.18) / 0.12);
      angle = barricade - 0.05 * p;
      this.attackHandSpacing = H * (0.32 - 0.04 * p);
      this.body.scaleX *= 0.92 - 0.06 * Math.sin(Math.PI * p);
      this.body.scaleY *= 1 - 0.03 * p;
    } else if (tt < 0.54) {
      const p = clamp01((tt - 0.3) / 0.24);
      const e = p * p;
      angle = barricade - 0.05 + (cast - barricade + 0.05) * e;
      this.attackHandSpacing = H * (0.28 + 0.2 * e);
      this.attackArtOffX = H * (fx * 0.07 * e + nx * 0.08 * e);
      this.attackArtOffY = H * (fy * 0.07 * e + ny * 0.08 * e);
      this.body.rotation -= 0.22 * e * Math.cos(aimLocal);
      this.body.scaleX *= 0.94 + 0.12 * e;
    } else if (tt < 0.86) {
      const p = smoothstep01((tt - 0.54) / 0.32);
      angle = cast - 0.16 * Math.sin(Math.PI * p);
      this.attackHandSpacing = H * 0.48;
      this.attackArtOffX = H * (fx * 0.07 + nx * 0.08);
      this.attackArtOffY = H * (fy * 0.07 + ny * 0.08);
      this.body.rotation -= 0.22 * Math.cos(aimLocal);
      this.body.scaleX *= 1.06;
      this.body.scaleY *= 0.96;
    } else {
      angle = cast;
      this.attackHandSpacing = H * 0.48;
      this.attackArtOffX = H * (fx * 0.07 + nx * 0.08);
      this.attackArtOffY = H * (fy * 0.07 + ny * 0.08);
      this.body.rotation -= 0.22 * Math.cos(aimLocal);
      this.body.scaleX *= 1.06;
      this.body.scaleY *= 0.96;
    }
    this.attackShadowRotation = cast;
    this.attackShadowScaleX = 1.14;
    this.attackShadowScaleY = 0.86;
    this.setComboFootwork(tt, 0.3, 0.66, 0.86, aimLocal, 0, -0.02, 0, 0.1);
    return angle;
  }

  /** Glaive Compass: hand slides and projected pole length move the distant head around a quiet body. The
   * center remains visually empty and the final orbit locks to a rear-hand pivot instead of becoming spin. */
  private applyCompassCombo(motion: MeleeComboMotion, tt: number, aimLocal: number): number {
    this.signatureMotion = motion;
    const H = TARGET_BODY_H;
    const fx = Math.cos(aimLocal);
    const fy = Math.sin(aimLocal);
    const nx = -fy;
    const ny = fx;
    let angle = aimLocal;

    if (motion === "long-reap") {
      const start = aimLocal - 1.38;
      const end = aimLocal + 1.25;
      if (tt < 0.16) {
        const p = smoothstep01(tt / 0.16);
        angle = aimLocal - 0.95 + (start - (aimLocal - 0.95)) * p;
        this.attackHandSpacing = H * (0.34 + 0.16 * p);
        this.attackArtOffX = -nx * H * 0.05 * p;
        this.attackArtOffY = -ny * H * 0.05 * p;
        this.body.rotation -= 0.06 * p * Math.cos(aimLocal);
      } else if (tt < 0.5) {
        const p = clamp01((tt - 0.16) / 0.34);
        const e = cubicOut01(p);
        angle = start + (end - start) * e;
        this.attackHandSpacing = H * 0.5;
        this.attackArtOffX = -nx * H * 0.05;
        this.attackArtOffY = -ny * H * 0.05;
        this.body.rotation += (-0.06 + 0.18 * e) * Math.cos(aimLocal);
        this.body.scaleY *= 1 - 0.04 * e;
      } else if (tt < 0.78) {
        const p = smoothstep01((tt - 0.5) / 0.28);
        angle = end + 0.12 * Math.sin(Math.PI * p);
        this.attackHandSpacing = H * (0.5 - 0.04 * p);
        this.attackArtOffX = -nx * H * (0.05 - 0.01 * p);
        this.attackArtOffY = -ny * H * (0.05 - 0.01 * p);
        this.body.rotation += 0.12 * Math.cos(aimLocal);
        this.body.scaleY *= 0.96 + 0.02 * p;
      } else {
        angle = end;
        this.attackHandSpacing = H * 0.46;
        this.attackArtOffX = -nx * H * 0.04;
        this.attackArtOffY = -ny * H * 0.04;
        this.body.rotation += 0.12 * Math.cos(aimLocal);
        this.body.scaleY *= 0.98;
      }
      this.weaponLengthScale = 1;
      this.attackWeaponDepth = 1;
      this.attackShadowRotation = angle;
      this.attackShadowScaleX = 1.08;
      this.attackShadowScaleY = 0.9;
      this.setComboFootwork(tt, 0.16, 0.58, 0.78, aimLocal, 0, 0.06, 0, -0.02);
      return angle;
    }

    if (motion === "shaft-switch") {
      const start = aimLocal + 1.25;
      const end = aimLocal - 1.42;
      let pass = 0;
      if (tt < 0.12) {
        const p = smoothstep01(tt / 0.12);
        angle = start + 0.1 * p;
        this.attackHandSpacing = H * (0.46 - 0.2 * p);
      } else if (tt < 0.42) {
        pass = smoothstep01((tt - 0.12) / 0.3);
        angle = start + 0.1 + (end - start - 0.1) * pass;
        this.attackHandSpacing = H * (0.26 + 0.24 * Math.abs(pass * 2 - 1));
      } else if (tt < 0.74) {
        const p = smoothstep01((tt - 0.42) / 0.32);
        pass = 1;
        angle = end - 0.1 * Math.sin(Math.PI * p);
        this.attackHandSpacing = H * (0.5 - 0.04 * p);
      } else {
        pass = 1;
        angle = end;
        this.attackHandSpacing = H * 0.46;
      }
      const compression = Math.sin(Math.PI * pass);
      this.weaponLengthScale = Math.max(0.3, 1 - 0.78 * compression);
      this.attackWeaponDepth = pass > 0.24 && pass < 0.76 ? -1 : 1;
      const forward = 0.05 * Math.sin(Math.PI * pass);
      const lateral = 0.04 * pass;
      this.attackArtOffX = H * (fx * forward + nx * lateral);
      this.attackArtOffY = H * (fy * forward + ny * lateral);
      this.body.rotation += (0.1 - 0.22 * pass) * Math.cos(aimLocal);
      this.body.scaleY *= 1 - 0.04 * compression;
      this.attackShadowRotation = angle;
      this.attackShadowScaleX = 1 + 0.08 * compression;
      this.attackShadowScaleY = 1 - 0.12 * compression;
      this.setComboFootwork(tt, 0.12, 0.48, 0.74, aimLocal, 0, 0.02, 0, -0.02);
      return angle;
    }

    // Compass Rose: almost five-sixths of a turn at the blade head, under a sub-quarter-turn torso.
    const start = aimLocal - 5.15;
    let orbit = 0;
    if (tt < 0.24) {
      const p = smoothstep01(tt / 0.24);
      angle = aimLocal + 1.25 + (start - (aimLocal - Math.PI * 2) - 1.25) * p;
      this.attackArtOffX = -fx * H * 0.03 * p;
      this.attackArtOffY = -fy * H * 0.03 * p;
      this.body.rotation -= 0.08 * p * Math.cos(aimLocal);
      this.attackHandSpacing = H * (0.46 - 0.18 * p);
    } else if (tt < 0.68) {
      const p = clamp01((tt - 0.24) / 0.44);
      orbit = smoothstep01(p);
      angle = start + 5.15 * orbit;
      this.attackArtOffX = H * (fx * (-0.03 + 0.06 * orbit) - nx * 0.025 * orbit);
      this.attackArtOffY = H * (fy * (-0.03 + 0.06 * orbit) - ny * 0.025 * orbit);
      this.body.rotation += (-0.08 + 0.18 * orbit) * Math.cos(aimLocal);
      this.body.scaleX *= Math.max(0.28, Math.cos(orbit * 1.25));
      this.body.scaleY *= 1 - 0.04 * orbit;
      this.attackHandSpacing = H * (0.28 + 0.24 * orbit);
    } else if (tt < 0.88) {
      const p = smoothstep01((tt - 0.68) / 0.2);
      orbit = 1;
      angle = aimLocal;
      this.attackArtOffX = H * (fx * (0.03 - 0.01 * p) - nx * 0.025 * (1 - p));
      this.attackArtOffY = H * (fy * (0.03 - 0.01 * p) - ny * 0.025 * (1 - p));
      this.body.rotation += 0.1 * Math.cos(aimLocal) * (1 - 0.3 * p);
      this.body.scaleX *= 0.32 + 0.18 * p;
      this.body.scaleY *= 0.96 + 0.02 * p;
      this.attackHandSpacing = H * 0.52;
    } else {
      orbit = 1;
      angle = aimLocal;
      this.attackArtOffX = fx * H * 0.02;
      this.attackArtOffY = fy * H * 0.02;
      this.body.rotation += 0.07 * Math.cos(aimLocal);
      this.body.scaleX *= 0.5;
      this.body.scaleY *= 0.98;
      this.attackHandSpacing = H * 0.52;
    }
    const projection = Math.hypot(Math.cos(angle), Math.sin(angle) * 0.34);
    this.weaponLengthScale = Math.max(0.3, projection);
    this.attackWeaponDepth = Math.sin(angle) < 0 ? -1 : 1;
    const gripOwn = actionOwnershipAt(tt, 0.24, 0.68, 0.88);
    const rearX = -fx * H * 0.04 - nx * H * 0.1;
    const rearY = -fy * H * 0.04 - ny * H * 0.1;
    this.setRearPivotGrip(angle, rearX, rearY, this.attackHandSpacing, gripOwn);
    const feetOwn = actionOwnershipAt(tt, 0.24, 0.68, 0.88);
    const footArc = Math.PI * Math.min(1, orbit);
    this.attackFrontFootX = H * (fx * 0.02 + nx * 0.08 * Math.cos(footArc));
    this.attackFrontFootY = H * (fy * 0.02 + ny * 0.08 * Math.cos(footArc));
    this.attackBackFootX = -fx * H * 0.03;
    this.attackBackFootY = -fy * H * 0.03;
    this.attackFrontFootBlend = feetOwn;
    this.attackBackFootBlend = feetOwn;
    this.attackShadowRotation = angle;
    this.attackShadowScaleX = 1.1;
    this.attackShadowScaleY = 0.88;
    return angle;
  }

  /** Bardiche Hookbreak: the head stays broad and heavy, the second beat shortens inward, and the finisher
   * briefly fixes the far head while the haft/hands wrench past it. No extra contact surface is created. */
  private applyHookbreakCombo(motion: MeleeComboMotion, tt: number, aimLocal: number): number {
    this.signatureMotion = motion;
    const H = TARGET_BODY_H;
    const fx = Math.cos(aimLocal);
    const fy = Math.sin(aimLocal);
    const nx = -fy;
    const ny = fx;
    let angle = aimLocal;

    if (motion === "headsmans-drop") {
      const raised = aimLocal - 1.42;
      const buried = aimLocal + 0.28;
      if (tt < 0.26) {
        const p = smoothstep01(tt / 0.26);
        angle = aimLocal - 0.75 + (raised - (aimLocal - 0.75)) * p;
        this.attackHandSpacing = H * (0.4 + 0.08 * p);
        this.swingOffX = -fx * H * 0.04 * p + nx * H * 0.06 * p;
        this.swingOffY = -fy * H * 0.04 * p + ny * H * 0.06 * p;
        this.body.rotation -= 0.1 * p * Math.cos(aimLocal);
        this.body.scaleY *= 1 + 0.04 * p;
      } else if (tt < 0.52) {
        const p = clamp01((tt - 0.26) / 0.26);
        const drop = p * p;
        angle = raised + (buried - raised) * drop;
        this.attackHandSpacing = H * 0.48;
        this.attackArtOffX = fx * H * 0.09 * drop;
        this.attackArtOffY = fy * H * 0.09 * drop;
        this.swingOffX = fx * H * 0.12 * drop - this.attackArtOffX;
        this.swingOffY = fy * H * 0.12 * drop - this.attackArtOffY;
        this.body.rotation += (-0.1 + 0.28 * drop) * Math.cos(aimLocal);
        this.body.scaleY *= 1.04 - 0.15 * drop;
      } else if (tt < 0.74) {
        const p = smoothstep01((tt - 0.52) / 0.22);
        angle = buried + 0.08 * Math.sin(Math.PI * p);
        this.attackHandSpacing = H * 0.48;
        this.attackArtOffX = fx * H * 0.09;
        this.attackArtOffY = fy * H * 0.09;
        this.swingOffX = fx * H * 0.03;
        this.swingOffY = fy * H * 0.03;
        this.body.rotation += 0.18 * Math.cos(aimLocal);
        this.body.scaleY *= 0.89 + 0.02 * p;
      } else {
        angle = buried;
        this.attackHandSpacing = H * 0.48;
        this.attackArtOffX = fx * H * 0.08;
        this.attackArtOffY = fy * H * 0.08;
        this.body.rotation += 0.18 * Math.cos(aimLocal);
        this.body.scaleY *= 0.91;
      }
      this.weaponLengthScale = 1;
      this.attackWeaponDepth = 1;
      this.attackShadowRotation = aimLocal;
      this.attackShadowScaleX = 1.12;
      this.attackShadowScaleY = 0.84;
      this.setComboFootwork(tt, 0.26, 0.56, 0.74, aimLocal, 0.07, 0, -0.03, 0);
      return angle;
    }

    if (motion === "hook-and-haul") {
      const set = aimLocal + 0.28;
      const hauled = aimLocal - 1.12;
      let haul = 0;
      if (tt < 0.1) {
        const p = smoothstep01(tt / 0.1);
        angle = set + 0.12 * p;
        this.attackHandSpacing = H * (0.48 - 0.06 * p);
      } else if (tt < 0.42) {
        haul = cubicOut01((tt - 0.1) / 0.32);
        angle = set + 0.12 + (hauled - set - 0.12) * haul;
        this.attackHandSpacing = H * (0.42 - 0.1 * Math.sin(Math.PI * haul));
      } else if (tt < 0.78) {
        const p = smoothstep01((tt - 0.42) / 0.36);
        haul = 1;
        angle = hauled - 0.1 * Math.sin(Math.PI * p);
        this.attackHandSpacing = H * (0.32 + 0.12 * p);
      } else {
        haul = 1;
        angle = hauled;
        this.attackHandSpacing = H * 0.44;
      }
      const inward = Math.sin(Math.PI * haul);
      this.weaponLengthScale = 1 - 0.32 * inward;
      this.attackWeaponDepth = haul > 0.2 && haul < 0.66 ? -1 : 1;
      const forward = -0.12 * haul;
      const lateral = 0.06 * haul;
      this.attackArtOffX = H * (fx * forward + nx * lateral);
      this.attackArtOffY = H * (fy * forward + ny * lateral);
      this.swingOffX = fx * H * 0.08 * (1 - haul) - nx * H * 0.08 * haul;
      this.swingOffY = fy * H * 0.08 * (1 - haul) - ny * H * 0.08 * haul;
      this.body.rotation += (0.08 - 0.22 * haul) * Math.cos(aimLocal);
      this.body.scaleY *= 1 - 0.06 * haul;
      this.attackShadowRotation = angle;
      this.attackShadowScaleX = 1.08;
      this.attackShadowScaleY = 0.88;
      this.setComboFootwork(tt, 0.1, 0.5, 0.78, aimLocal, -0.02, 0, -0.1, -0.04);
      return angle;
    }

    // Gallows Turn: rack, broad cast, 80ms-normalized catch, then a small sideways pullout.
    const rack = aimLocal - Math.PI / 2;
    const plantAngle = aimLocal + 1.76;
    if (tt < 0.3) {
      const p = smoothstep01(tt / 0.3);
      angle = aimLocal - 1.12 + (rack - (aimLocal - 1.12)) * p;
      this.attackHandSpacing = H * (0.4 + 0.08 * p);
      this.swingOffX = -fx * H * 0.03 * p - nx * H * 0.06 * p;
      this.swingOffY = -fy * H * 0.03 * p - ny * H * 0.06 * p;
      this.body.rotation -= 0.1 * p * Math.cos(aimLocal);
      this.body.scaleY *= 1 + 0.03 * p;
    } else if (tt < 0.64) {
      const p = clamp01((tt - 0.3) / 0.34);
      const cast = cubicOut01(p);
      angle = rack + (plantAngle - rack) * cast;
      this.attackHandSpacing = H * 0.48;
      this.attackArtOffX = H * (fx * 0.04 * cast + nx * 0.12 * cast);
      this.attackArtOffY = H * (fy * 0.04 * cast + ny * 0.12 * cast);
      this.swingOffX = nx * H * 0.1 * cast;
      this.swingOffY = ny * H * 0.1 * cast;
      this.body.rotation += (-0.1 + 0.34 * cast) * Math.cos(aimLocal);
      this.body.scaleY *= 1 - 0.05 * cast;
    } else {
      const front = this.hands.find((hand) => hand.front);
      const baseGripX = (front?.ox ?? 0) + nx * H * 0.1;
      const baseGripY = (front?.oy ?? 0) + ny * H * 0.1;
      const businessLength = Math.max(
        H * 0.65,
        ((1 - (this.weaponDef?.gripFrac ?? 0.08)) * (this.weaponDef?.displayLength ?? H)) /
          (this.baseScale || 1),
      );
      const plantedHeadX = baseGripX + Math.cos(plantAngle) * businessLength;
      const plantedHeadY = baseGripY + Math.sin(plantAngle) * businessLength;
      if (tt < 0.72) {
        const p = smoothstep01((tt - 0.64) / 0.08);
        angle = plantAngle + 0.025 * p;
        const gripX = plantedHeadX - Math.cos(angle) * businessLength;
        const gripY = plantedHeadY - Math.sin(angle) * businessLength;
        this.setRearPivotGrip(
          angle,
          gripX + Math.cos(angle) * H * 0.48,
          gripY + Math.sin(angle) * H * 0.48,
          H * 0.48,
          1,
        );
        this.body.rotation += (0.24 + 0.025 * p) * Math.cos(aimLocal);
      } else if (tt < 0.86) {
        const p = smoothstep01((tt - 0.72) / 0.14);
        angle = plantAngle + 0.025 - 0.16 * p;
        const pulledGripX = baseGripX - nx * H * 0.08 * p;
        const pulledGripY = baseGripY - ny * H * 0.08 * p;
        this.setRearPivotGrip(
          angle,
          pulledGripX + Math.cos(angle) * H * 0.48,
          pulledGripY + Math.sin(angle) * H * 0.48,
          H * 0.48,
          1 - p,
        );
        this.body.rotation += (0.265 - 0.08 * p) * Math.cos(aimLocal);
      } else {
        angle = plantAngle - 0.135;
        this.attackHandSpacing = H * 0.48;
        this.swingOffX = nx * H * 0.02;
        this.swingOffY = ny * H * 0.02;
        this.body.rotation += 0.185 * Math.cos(aimLocal);
      }
      this.attackArtOffX = H * (fx * 0.04 + nx * 0.12);
      this.attackArtOffY = H * (fy * 0.04 + ny * 0.12);
      this.body.scaleY *= 0.95;
    }
    this.weaponLengthScale = 1;
    this.attackWeaponDepth = 1;
    this.attackShadowRotation = angle;
    this.attackShadowScaleX = 1.12;
    this.attackShadowScaleY = 0.86;
    this.setComboFootwork(tt, 0.3, 0.64, 0.86, aimLocal, 0, 0.1, -0.02, -0.04);
    return angle;
  }

  /** Hammer-head fulcrum vault. Canonical .66 contact is remapped onto the immutable Stage-1 impact clock. */
  private applyFulcrumFlip(tt: number, aimLocal: number): number {
    this.signatureMotion = "fulcrum-flip";
    const H = TARGET_BODY_H;
    const fx = Math.cos(aimLocal);
    const fy = Math.sin(aimLocal);
    const s = this.scale;
    const acceptedImpact = Math.max(
      0.36,
      Math.min(
        0.66,
        (this.swing?.impactSeconds ?? CHOP_IMPACT_FRAC) /
          Math.max(1e-6, this.swing?.poseSeconds ?? 1),
      ),
    );
    const activeStart = 0.18 + ((0.5 - 0.18) * (acceptedImpact - 0.18)) / (0.66 - 0.18);
    const followEnd = acceptedImpact + ((1 - acceptedImpact) * (0.82 - 0.66)) / (1 - 0.66);
    const businessLength = Math.max(
      H * 0.52,
      ((1 - (this.weaponDef?.gripFrac ?? 0.1)) * (this.weaponDef?.displayLength ?? H)) /
        (this.baseScale || 1),
    );
    const setGripFromHead = (
      headX: number,
      headY: number,
      angle: number,
      length: number,
      spacing: number,
    ): void => {
      const ux = Math.cos(angle);
      const uy = Math.sin(angle);
      this.attackGripX = headX - ux * businessLength * length;
      this.attackGripY = headY - uy * businessLength * length;
      const lengthSign = length < 0 ? -1 : 1;
      this.attackBackGripX = this.attackGripX - ux * spacing * lengthSign;
      this.attackBackGripY = this.attackGripY - uy * spacing * lengthSign;
      this.attackHandSpacing = spacing;
      this.attackGripBoth = true;
    };

    let angle = aimLocal;
    if (tt < 0.08) {
      const p = smoothstep01(tt / 0.08);
      this.attackArtOffX = -fx * H * 0.03 * p;
      this.attackArtOffY = -fy * H * 0.03 * p;
      this.body.rotation -= 0.12 * Math.cos(aimLocal) * p;
      this.body.scaleY *= 1 - 0.06 * p;
      this.weaponLengthScale = 1;
      angle = aimLocal - 0.72 * (1 - p);
      const headDist = H * (0.22 + 0.3 * p);
      setGripFromHead(fx * headDist, fy * headDist, angle, 1, H * 0.3);
      this.attackGripBlend = p;
      this.attackWeaponDepth = 1;
      this.attackShadowX = this.attackArtOffX;
      this.attackShadowY = this.attackArtOffY;
      this.attackShadowScaleX = 1 + 0.05 * p;
      this.attackShadowScaleY = 1 - 0.08 * p;
    } else if (tt < 0.18) {
      const p = smoothstep01((tt - 0.08) / 0.1);
      const ground = H * (-0.03 + 0.09 * p);
      this.attackArtOffX = fx * ground;
      this.attackArtOffY = fy * ground;
      this.body.scaleY *= 0.94 - 0.04 * p;
      this.body.rotation -= 0.12 * Math.cos(aimLocal) * (1 - p);
      this.weaponLengthScale = 1 - 0.06 * p;
      setGripFromHead(fx * H * 0.52, fy * H * 0.52, angle, this.weaponLengthScale, H * 0.3);
      this.attackGripBlend = 1;
      this.attackWeaponDepth = p > 0.78 ? -1 : 1;
      this.attackShadowX = fx * H * (-0.03 + 0.08 * p);
      this.attackShadowY = fy * H * (-0.03 + 0.08 * p);
      this.attackShadowScaleX = 1.05 + 0.07 * p;
      this.attackShadowScaleY = 0.92 - 0.1 * p;
    } else if (tt < activeStart) {
      const p = clamp01((tt - 0.18) / Math.max(1e-6, activeStart - 0.18));
      const e = smoothstep01(p);
      const ground = H * (0.06 + 0.34 * e);
      const apex = Math.sin(Math.PI * p);
      this.attackArtOffX = fx * ground;
      this.attackArtOffY = fy * ground;
      this.attackLiftPx = H * 0.4 * apex;
      this.attackScaleY = signedClamp(Math.cos(Math.PI * 2 * e), 0.12);
      this.body.rotation += 0.08 * Math.sin(Math.PI * 2 * e) * Math.cos(aimLocal);
      this.weaponLengthScale = signedClamp(Math.cos(Math.PI * e), 0.16);
      const release = smoothstep01((p - 0.72) / 0.28);
      const headX = fx * H * (0.52 - 0.12 * release);
      const headY = fy * H * (0.52 - 0.12 * release) - H * 0.18 * release;
      const spacing = H * (0.3 - 0.12 * apex);
      setGripFromHead(headX, headY, angle, this.weaponLengthScale, Math.max(H * 0.18, spacing));
      this.attackGripBlend = 1;
      this.attackWeaponDepth = p <= 0.72 ? -1 : 1;
      const shadowGround = H * (0.05 + 0.17 * e);
      this.attackShadowX = fx * shadowGround;
      this.attackShadowY = fy * shadowGround;
      this.attackShadowScaleX = 1 - 0.42 * apex;
      this.attackShadowScaleY = 1 - 0.42 * apex;
      this.attackShadowAlpha = 1 - 0.45 * apex;
    } else if (tt < acceptedImpact) {
      const p = clamp01((tt - activeStart) / Math.max(1e-6, acceptedImpact - activeStart));
      const fall = p * p;
      const ground = H * (0.4 - 0.12 * fall);
      this.attackArtOffX = fx * ground;
      this.attackArtOffY = fy * ground;
      this.body.y += H * 0.08 * fall * s;
      this.body.rotation += 0.22 * Math.cos(aimLocal) * fall;
      this.body.scaleY *= 1 - 0.18 * fall;
      this.weaponLengthScale = signedClamp(-1 + 2 * smoothstep01(p), 0.16);
      const headDist = H * (0.4 + 0.14 * fall);
      setGripFromHead(
        fx * headDist,
        fy * headDist - H * 0.18 * (1 - fall),
        angle,
        this.weaponLengthScale,
        H * (0.18 + 0.12 * fall),
      );
      this.attackGripBlend = 1;
      this.attackWeaponDepth = p > 0.88 ? -1 : 1;
      this.attackShadowX = fx * H * (0.22 + 0.06 * fall);
      this.attackShadowY = fy * H * (0.22 + 0.06 * fall);
      this.attackShadowScaleX = 1 + 0.22 * fall;
      this.attackShadowScaleY = 1 - 0.26 * fall;
      this.attackShadowAlpha = 1 + 0.15 * fall;
    } else if (tt < followEnd) {
      const p = clamp01((tt - acceptedImpact) / Math.max(1e-6, followEnd - acceptedImpact));
      this.attackArtOffX = fx * H * 0.28;
      this.attackArtOffY = fy * H * 0.28;
      this.body.y += H * 0.08 * s;
      this.body.rotation += 0.22 * Math.cos(aimLocal);
      this.body.scaleY *= 0.86 + 0.02 * p;
      const recoil = p < 0.2 ? Math.sin((p / 0.2) * Math.PI) : 0;
      this.weaponLengthScale = 1 - 0.06 * recoil;
      angle += 0.1 + 0.03 * Math.sin(p * Math.PI * 6) * (1 - p);
      setGripFromHead(fx * H * 0.54, fy * H * 0.54, angle, this.weaponLengthScale, H * 0.3);
      this.attackGripBlend = 1;
      this.attackWeaponDepth = -1;
      this.attackShadowX = fx * H * 0.28;
      this.attackShadowY = fy * H * 0.28;
      this.attackShadowScaleX = 1.22 - 0.14 * smoothstep01(p);
      this.attackShadowScaleY = 0.74 + 0.16 * smoothstep01(p);
      this.attackShadowAlpha = 1.15 - 0.15 * smoothstep01(p);
    } else {
      const p = smoothstep01((tt - followEnd) / Math.max(1e-6, 1 - followEnd));
      const ground = H * (0.28 - 0.2 * p);
      this.attackArtOffX = fx * ground;
      this.attackArtOffY = fy * ground;
      this.body.y += H * 0.08 * (1 - p) * s;
      this.body.rotation += 0.22 * Math.cos(aimLocal) * (1 - p);
      this.body.scaleY *= 0.88 + 0.12 * p;
      angle = aimLocal + 0.1 - 0.18 * p;
      const ux = Math.cos(angle);
      const uy = Math.sin(angle);
      const headX = fx * H * (0.54 - 0.29 * p);
      const headY = fy * H * (0.54 - 0.29 * p) - H * 0.06 * Math.sin(Math.PI * p);
      this.weaponLengthScale = 1;
      this.attackGripX = headX - ux * businessLength;
      this.attackGripY = headY - uy * businessLength;
      this.attackHandSpacing = H * (0.3 + 0.12 * p);
      this.attackBackGripX = this.attackGripX - ux * this.attackHandSpacing;
      this.attackBackGripY = this.attackGripY - uy * this.attackHandSpacing;
      this.attackGripBoth = true;
      this.attackGripBlend = 1 - p;
      this.attackWeaponDepth = p < 0.45 ? -1 : 1;
      this.attackShadowX = fx * ground;
      this.attackShadowY = fy * ground;
      this.attackShadowScaleX = 1.08 - 0.08 * p;
      this.attackShadowScaleY = 0.9 + 0.1 * p;
    }
    return angle;
  }

  private applyStinger(tt: number, aimLocal: number): number {
    this.signatureMotion = "stinger";
    const H = TARGET_BODY_H;
    const fx = Math.cos(aimLocal);
    const fy = Math.sin(aimLocal);
    const setArt = (distance: number): void => {
      this.attackArtOffX = fx * H * distance;
      this.attackArtOffY = fy * H * distance;
    };
    const setHands = (leadDistance: number, rearDistance: number): void => {
      this.swingOffX = fx * H * leadDistance - this.attackArtOffX;
      this.swingOffY = fy * H * leadDistance - this.attackArtOffY;
      this.swingBackOffX = fx * H * rearDistance - this.attackArtOffX;
      this.swingBackOffY = fy * H * rearDistance - this.attackArtOffY;
    };
    this.attackShadowRotation = aimLocal;
    this.attackHandSpacing = H * 0.3;
    if (tt < 0.12) {
      const p = smoothstep01(tt / 0.12);
      setArt(-0.04 * p);
      setHands(-0.12 * p, -0.04 * p);
      this.body.scaleX *= 1 - 0.1 * p;
      this.body.scaleY *= 1 + 0.03 * p;
      this.body.rotation -= 0.08 * Math.cos(aimLocal) * p;
      this.weaponLengthScale = 1 - 0.08 * p;
      this.attackShadowX = fx * H * -0.03 * p;
      this.attackShadowY = fy * H * -0.03 * p;
      this.attackShadowScaleX = 1 - 0.08 * p;
      this.attackShadowScaleY = 1 + 0.04 * p;
    } else if (tt < 0.24) {
      const p = smoothstep01((tt - 0.12) / 0.12);
      setArt(-0.04 - 0.02 * p);
      setHands(-0.12 - 0.06 * p, -0.04 - 0.025 * p);
      this.body.scaleX *= 0.9 - 0.02 * p;
      this.body.scaleY *= 1.03 - 0.13 * p;
      this.body.rotation -= 0.08 * Math.cos(aimLocal) * (1 - 0.25 * p);
      this.weaponLengthScale = 0.92 - 0.04 * p;
      this.attackShadowX = fx * H * (-0.03 - 0.02 * p);
      this.attackShadowY = fy * H * (-0.03 - 0.02 * p);
      this.attackShadowScaleX = 0.92 + 0.16 * p;
      this.attackShadowScaleY = 1.04 - 0.08 * p;
    } else if (tt < 0.58) {
      const p = clamp01((tt - 0.24) / 0.34);
      const handTravel = cubicOut01(p);
      const bodyTravel = cubicOut01((p - 0.08) / 0.92);
      setArt(0.25 * bodyTravel);
      setHands(0.62 * handTravel, 0.62 * 0.35 * handTravel);
      this.body.scaleX *= 0.88 - 0.04 * bodyTravel;
      this.body.scaleY *= 0.9 + 0.02 * bodyTravel;
      this.body.rotation += 0.11 * Math.cos(aimLocal) * bodyTravel;
      this.weaponLengthScale =
        p < 0.78
          ? 0.88 + 0.2 * smoothstep01(p / 0.78)
          : 1.08 - 0.08 * smoothstep01((p - 0.78) / 0.22);
      this.attackShadowX = fx * H * 0.18 * bodyTravel;
      this.attackShadowY = fy * H * 0.18 * bodyTravel;
      this.attackShadowScaleX = 1.08 + 0.34 * bodyTravel;
      this.attackShadowScaleY = 0.96 - 0.3 * bodyTravel;
    } else if (tt < 0.7) {
      const p = clamp01((tt - 0.58) / 0.12);
      setArt(0.25 - 0.02 * smoothstep01(p));
      setHands(0.62 - 0.04 * smoothstep01(p), 0.217 - 0.025 * smoothstep01(p));
      this.body.scaleX *= 0.84 + 0.06 * smoothstep01(p);
      this.body.scaleY *= 0.92;
      this.weaponLengthScale = 1 - 0.04 * Math.sin(Math.PI * p);
      this.attackShadowX = fx * H * (0.18 - 0.02 * p);
      this.attackShadowY = fy * H * (0.18 - 0.02 * p);
      this.attackShadowScaleX = 1.42 - 0.3 * smoothstep01(p);
      this.attackShadowScaleY = 0.66 + 0.18 * smoothstep01(p);
    } else {
      const p = smoothstep01((tt - 0.7) / 0.3);
      setArt(0.23 - 0.18 * p);
      setHands(0.58 - 0.7 * p, 0.192 - 0.28 * p);
      this.body.scaleX *= 0.9 + 0.1 * p;
      this.body.scaleY *= 0.92 + 0.08 * p;
      this.body.rotation += 0.11 * Math.cos(aimLocal) * (1 - p);
      this.weaponLengthScale = 1;
      this.attackShadowX = fx * H * 0.16 * (1 - p);
      this.attackShadowY = fy * H * 0.16 * (1 - p);
      this.attackShadowScaleX = 1.12 - 0.12 * p;
      this.attackShadowScaleY = 0.84 + 0.16 * p;
    }
    return aimLocal;
  }

  private applyHeroSpin(tt: number, aimLocal: number): number {
    this.signatureMotion = "spin-release";
    const H = TARGET_BODY_H;
    const fx = Math.cos(aimLocal);
    const fy = Math.sin(aimLocal);
    const nx = -fy;
    const ny = fx;
    const front = this.hands.find((hand) => hand.front);
    const SQ = 0.34;
    const tuckAngle = aimLocal - 2.15;
    const tuckX = (front?.ox ?? 0) - fx * H * 0.1 + nx * H * 0.12;
    const tuckY = (front?.oy ?? 0) - fy * H * 0.1 + ny * H * 0.12;
    const setOrbitGrip = (theta: number, radius: number): number => {
      const rx = Math.cos(theta);
      const ry = Math.sin(theta) * SQ;
      const projected = Math.hypot(rx, ry);
      this.attackGripX = rx * radius;
      this.attackGripY = H * 0.06 + ry * radius;
      this.attackGripBlend = 1;
      this.weaponLengthScale = projected;
      this.attackWeaponDepth = Math.sin(theta) < 0 ? -1 : 1;
      const ux = projected > 1e-5 ? rx / projected : 1;
      const uy = projected > 1e-5 ? ry / projected : 0;
      this.swingBackOffX = -ux * H * 0.14;
      this.swingBackOffY = -uy * H * 0.14;
      return Math.atan2(ry, rx);
    };

    let angle = tuckAngle;
    this.attackGripBoth = false;
    if (tt < 0.18) {
      const p = smoothstep01(tt / 0.18);
      this.attackArtOffX = (-fx * 0.03 - nx * 0.05) * H * p;
      this.attackArtOffY = (-fy * 0.03 - ny * 0.05) * H * p;
      this.body.rotation -= 0.16 * p;
      this.body.scaleY *= 1 - 0.09 * p;
      this.attackGripX = tuckX;
      this.attackGripY = tuckY;
      this.attackGripBlend = p;
      this.weaponLengthScale = 1 - 0.06 * p;
      this.attackWeaponDepth = 1;
      this.swingBackOffX = -nx * H * 0.1 * p;
      this.swingBackOffY = -ny * H * 0.1 * p;
      this.attackShadowX = (-fx * 0.04 - nx * 0.03) * H * p;
      this.attackShadowY = (-fy * 0.04 - ny * 0.03) * H * p;
      this.attackShadowScaleX = 1 + 0.08 * p;
      this.attackShadowScaleY = 1 - 0.14 * p;
    } else if (tt < 0.3) {
      const p = (tt - 0.18) / 0.12;
      const tremor = Math.sin(this.presentationClockNow() * 0.018 * Math.PI * 2) * this.scale;
      this.attackArtOffX = (-fx * 0.03 - nx * 0.05) * H;
      this.attackArtOffY = (-fy * 0.03 - ny * 0.05) * H;
      this.body.rotation -= 0.16;
      this.body.scaleY *= 0.91;
      this.attackGripX = tuckX + nx * tremor;
      this.attackGripY = tuckY + ny * tremor;
      this.attackGripBlend = 1;
      this.weaponLengthScale = 0.94;
      this.attackWeaponDepth = 1;
      this.swingBackOffX = -nx * H * 0.1;
      this.swingBackOffY = -ny * H * 0.1;
      const pulse = Math.sin(p * Math.PI * 2) * 0.03;
      this.attackShadowX = (-fx * 0.04 - nx * 0.03) * H;
      this.attackShadowY = (-fy * 0.04 - ny * 0.03) * H;
      this.attackShadowScaleX = 1.08 + pulse;
      this.attackShadowScaleY = 0.86 + pulse;
    } else if (tt < 0.66) {
      const p = clamp01((tt - 0.3) / 0.36);
      const e = cubicOut01(p);
      const theta = tuckAngle + Math.PI * 2 * e;
      const radius = H * (0.18 + 0.12 * smoothstep01(p / 0.18));
      angle = setOrbitGrip(theta, radius);
      this.attackArtOffX = (-fx * 0.03 - nx * 0.05) * H * (1 - p);
      this.attackArtOffY = (-fy * 0.03 - ny * 0.05) * H * (1 - p);
      const profile = signedClamp(Math.cos(Math.PI * 2 * e), 0.18);
      this.body.scaleX *= profile;
      this.body.scaleY *= 0.91;
      this.body.rotation += 0.05 * Math.sin(Math.PI * 4 * e);
      this.attackShadowScaleX = 1.14;
      this.attackShadowScaleY = 0.78;
      this.attackShadowRotation = theta * 0.5;
    } else if (tt < 0.78) {
      const p = smoothstep01((tt - 0.66) / 0.12);
      const theta = tuckAngle + Math.PI * 2 + 0.28 * p;
      angle = setOrbitGrip(theta, H * 0.3);
      this.body.scaleX *= 0.92 + 0.08 * p;
      this.body.scaleY *= 0.91 + 0.03 * p;
      this.body.rotation += 0.12;
      this.attackShadowScaleX = 1.14 - 0.1 * p;
      this.attackShadowScaleY = 0.78 + 0.14 * p;
      this.attackShadowRotation = theta * 0.5;
    } else {
      const p = smoothstep01((tt - 0.78) / 0.22);
      const theta = tuckAngle + Math.PI * 2 + 0.28;
      const rx = Math.cos(theta);
      const ry = Math.sin(theta) * SQ;
      const startX = rx * H * 0.3;
      const startY = H * 0.06 + ry * H * 0.3;
      const lowX = (front?.ox ?? 0) + fx * H * 0.12 - nx * H * 0.1;
      const lowY = (front?.oy ?? 0) + fy * H * 0.12 - ny * H * 0.1;
      this.attackGripX = startX + (lowX - startX) * p;
      this.attackGripY = startY + (lowY - startY) * p;
      this.attackGripBlend = 1 - p;
      this.swingOffX = fx * H * 0.12 - nx * H * 0.1;
      this.swingOffY = fy * H * 0.12 - ny * H * 0.1;
      const projectedAngle = Math.atan2(ry, rx);
      angle = projectedAngle + (aimLocal + Math.PI - 0.35 - projectedAngle) * p;
      this.weaponLengthScale = Math.hypot(rx, ry) + (1 - Math.hypot(rx, ry)) * p;
      this.attackWeaponDepth = p < 0.45 && Math.sin(theta) < 0 ? -1 : 1;
      this.swingBackOffX = -rx * H * 0.14 * (1 - p);
      this.swingBackOffY = -ry * H * 0.14 * (1 - p);
      this.body.rotation += 0.12 - 0.08 * p;
      this.body.scaleX *= 1;
      this.body.scaleY *= 0.94 + 0.06 * p;
      this.attackShadowScaleX = 1.04 - 0.04 * p;
      this.attackShadowScaleY = 0.92 + 0.08 * p;
      this.attackShadowRotation = theta * 0.5 * (1 - p);
    }
    return angle;
  }

  private applyPommelBash(tt: number, aimLocal: number): number {
    this.signatureMotion = "pommel-bash";
    const H = TARGET_BODY_H;
    const fx = Math.cos(aimLocal);
    const fy = Math.sin(aimLocal);
    let angle = aimLocal + Math.PI;
    if (tt < 0.12) {
      const p = smoothstep01(tt / 0.12);
      const drive = H * 0.02 * p;
      this.attackArtOffX = fx * drive;
      this.attackArtOffY = fy * drive;
      this.swingOffX = fx * H * 0.08 * p;
      this.swingOffY = fy * H * 0.08 * p;
      this.body.rotation -= 0.1 * Math.cos(aimLocal) * p;
      this.attackHandSpacing = H * (0.42 - 0.18 * p);
      angle += 0.18 * (1 - p);
      this.attackShadowX = fx * H * 0.03 * p;
      this.attackShadowY = fy * H * 0.03 * p;
      this.attackShadowScaleX = 1 - 0.04 * p;
      this.attackShadowScaleY = 1 + 0.06 * p;
    } else if (tt < 0.3) {
      const p = cubicOut01((tt - 0.12) / 0.18);
      const bodyDrive = H * (0.02 + 0.06 * p);
      this.attackArtOffX = fx * bodyDrive;
      this.attackArtOffY = fy * bodyDrive;
      this.swingOffX = fx * H * (0.08 + 0.16 * p) - this.attackArtOffX;
      this.swingOffY = fy * H * (0.08 + 0.16 * p) - this.attackArtOffY;
      this.body.rotation += (-0.1 + 0.2 * p) * Math.cos(aimLocal);
      this.body.scaleX *= 1 - 0.08 * p;
      this.attackHandSpacing = H * 0.24;
      angle = aimLocal + Math.PI + 0.18 * p;
      this.attackShadowX = fx * H * (0.03 + 0.05 * p);
      this.attackShadowY = fy * H * (0.03 + 0.05 * p);
      this.attackShadowScaleX = 0.96 + 0.12 * p;
      this.attackShadowScaleY = 1.06 - 0.2 * p;
    } else if (tt < 0.44) {
      const p = smoothstep01((tt - 0.3) / 0.14);
      const bodyDrive = H * (0.08 - 0.05 * p);
      this.attackArtOffX = fx * bodyDrive;
      this.attackArtOffY = fy * bodyDrive;
      this.swingOffX = fx * H * (0.24 - 0.05 * p) - this.attackArtOffX;
      this.swingOffY = fy * H * (0.24 - 0.05 * p) - this.attackArtOffY;
      this.body.rotation += 0.1 * Math.cos(aimLocal) * (1 - p);
      this.body.scaleX *= 0.92 + 0.08 * p;
      this.attackHandSpacing = H * (0.24 + 0.08 * p);
      angle = aimLocal + Math.PI + 0.18 + 0.1 * Math.sin(Math.PI * p);
      this.attackShadowX = fx * H * (0.08 - 0.05 * p);
      this.attackShadowY = fy * H * (0.08 - 0.05 * p);
      this.attackShadowScaleX = 1.08 - 0.14 * Math.sin(Math.PI * p);
      this.attackShadowScaleY = 0.86 + 0.18 * Math.sin(Math.PI * p);
    } else {
      const p = smoothstep01((tt - 0.44) / 0.56);
      const loadAngle = forwardMeleeReadyAngle(aimLocal);
      angle = aimLocal + Math.PI + 0.18 + (loadAngle - (aimLocal + Math.PI + 0.18)) * p;
      this.attackArtOffX = fx * H * 0.03 * (1 - p);
      this.attackArtOffY = fy * H * 0.03 * (1 - p);
      this.swingOffX = fx * H * 0.19 * (1 - p);
      this.swingOffY = fy * H * 0.19 * (1 - p) - H * 0.08 * p;
      this.body.scaleY *= 1 + 0.04 * p;
      this.body.rotation -= 0.1 * p;
      this.attackHandSpacing = H * (0.32 + 0.1 * p);
      this.attackShadowX = fx * H * 0.03 * (1 - p);
      this.attackShadowY = fy * H * 0.03 * (1 - p);
      this.attackShadowScaleX = 1;
      this.attackShadowScaleY = 1;
    }
    return angle;
  }

  private applyTrueChargedSlam(tt: number, aimLocal: number): number {
    this.signatureMotion = "true-charged-slam";
    const H = TARGET_BODY_H;
    const fx = Math.cos(aimLocal);
    const fy = Math.sin(aimLocal);
    const behindAngle = aimLocal + Math.PI - 0.35;
    const fallAngle = aimLocal + 0.08;
    let angle = behindAngle;
    if (tt < 0.22) {
      const p = smoothstep01(tt / 0.22);
      this.attackArtOffX = -fx * H * 0.04 * p;
      this.attackArtOffY = -fy * H * 0.04 * p;
      this.swingOffX = -fx * H * 0.1 * p;
      this.swingOffY = -fy * H * 0.1 * p;
      this.body.rotation -= 0.14 * Math.cos(aimLocal) * p;
      this.body.scaleY *= 1 - 0.06 * p;
      this.attackHandSpacing = H * 0.42;
      this.attackWeaponDepth = -1;
      this.attackShadowX = -fx * H * 0.04 * p;
      this.attackShadowY = -fy * H * 0.04 * p;
      this.attackShadowScaleX = 1 + 0.05 * p;
      this.attackShadowScaleY = 1 - 0.1 * p;
    } else if (tt < 0.34) {
      const p = smoothstep01((tt - 0.22) / 0.12);
      const tremor = Math.sin(this.presentationClockNow() * 0.013 * Math.PI * 2) * this.scale;
      this.attackArtOffX = -fx * H * 0.04;
      this.attackArtOffY = -fy * H * 0.04;
      this.swingOffX = -fx * H * 0.1 + -fy * tremor;
      this.swingOffY = -fy * H * 0.1 + fx * tremor;
      this.body.rotation -= 0.14 * Math.cos(aimLocal) * (1 + 0.25 * p);
      this.body.scaleY *= 0.94 + 0.12 * p;
      this.weaponLengthScale = 1 - 0.78 * p;
      this.attackLiftPx = H * 0.05 * p;
      this.attackHandSpacing = H * 0.42;
      this.attackWeaponDepth = p < 0.72 ? -1 : 1;
      this.attackShadowX = -fx * H * 0.04;
      this.attackShadowY = -fy * H * 0.04;
      this.attackShadowScaleX = 1.05 - 0.15 * p;
      this.attackShadowScaleY = 0.9 - 0.1 * p;
      this.attackShadowAlpha = 1 - 0.12 * p;
    } else if (tt < 0.46) {
      const p = smoothstep01((tt - 0.34) / 0.12);
      this.attackArtOffX = fx * H * (-0.04 + 0.2 * p);
      this.attackArtOffY = fy * H * (-0.04 + 0.2 * p);
      this.swingOffX = fx * H * (-0.1 + 0.18 * p);
      this.swingOffY = fy * H * (-0.1 + 0.18 * p);
      this.body.rotation -= 0.175 * Math.cos(aimLocal) * (1 - p);
      this.body.scaleY *= 1.06 - 0.02 * p;
      angle = behindAngle + (fallAngle - behindAngle) * p;
      this.weaponLengthScale = 0.22 + 0.5 * p;
      this.attackLiftPx = H * 0.05 * (1 - p);
      this.attackHandSpacing = H * (0.42 - 0.08 * p);
      this.attackWeaponDepth = 1;
      this.attackShadowX = fx * H * (-0.04 + 0.16 * p);
      this.attackShadowY = fy * H * (-0.04 + 0.16 * p);
      this.attackShadowRotation = aimLocal;
      this.attackShadowScaleX = 0.9 + 0.28 * p;
      this.attackShadowScaleY = 0.8 - 0.04 * p;
      this.attackShadowAlpha = 0.88 + 0.12 * p;
    } else if (tt < 0.61) {
      const p = clamp01((tt - 0.46) / 0.15);
      const fall = p * p;
      this.attackArtOffX = fx * H * (0.16 + 0.08 * fall);
      this.attackArtOffY = fy * H * (0.16 + 0.08 * fall);
      this.swingOffX = fx * H * (0.08 + 0.26 * fall) - this.attackArtOffX;
      this.swingOffY = fy * H * (0.08 + 0.26 * fall) - this.attackArtOffY;
      this.body.rotation += (-0.02 + 0.22 * fall) * Math.cos(aimLocal);
      this.body.scaleY *= 1.04 - 0.18 * fall;
      angle = fallAngle;
      this.weaponLengthScale = 0.72 + 0.32 * fall;
      this.attackHandSpacing = H * 0.34;
      this.attackWeaponDepth = fall > 0.82 ? -1 : 1;
      this.attackShadowX = fx * H * (0.12 + 0.12 * fall);
      this.attackShadowY = fy * H * (0.12 + 0.12 * fall);
      this.attackShadowRotation = aimLocal;
      this.attackShadowScaleX = 1.18;
      this.attackShadowScaleY = 0.76;
    } else if (tt < 0.64) {
      const p = clamp01((tt - 0.61) / 0.03);
      this.attackArtOffX = fx * H * 0.24;
      this.attackArtOffY = fy * H * 0.24;
      this.body.rotation += 0.2 * Math.cos(aimLocal);
      this.body.scaleY *= 0.86;
      angle = fallAngle;
      this.weaponLengthScale = 1.04 - 0.1 * Math.sin(Math.PI * p) - 0.04 * p;
      this.attackHandSpacing = H * 0.34;
      this.attackWeaponDepth = -1;
      this.attackShadowX = fx * H * 0.24;
      this.attackShadowY = fy * H * 0.24;
      this.attackShadowScaleX = 1.18;
      this.attackShadowScaleY = 0.76;
    } else if (tt < 0.8) {
      const p = smoothstep01((tt - 0.64) / 0.16);
      this.attackArtOffX = fx * H * 0.24;
      this.attackArtOffY = fy * H * 0.24;
      this.body.rotation += 0.2 * Math.cos(aimLocal);
      this.body.scaleY *= 0.88;
      angle = fallAngle;
      this.weaponLengthScale = 1;
      this.attackHandSpacing = H * (0.34 + 0.08 * Math.max(0, (p - 0.62) / 0.38));
      this.attackWeaponDepth = -1;
      this.attackShadowX = fx * H * 0.24;
      this.attackShadowY = fy * H * 0.24;
      this.attackShadowScaleX = 1.18 - 0.1 * p;
      this.attackShadowScaleY = 0.76 + 0.12 * p;
    } else {
      const p = smoothstep01((tt - 0.8) / 0.2);
      this.attackArtOffX = fx * H * (0.24 - 0.19 * p);
      this.attackArtOffY = fy * H * (0.24 - 0.19 * p);
      this.body.rotation += 0.2 * Math.cos(aimLocal) * (1 - p);
      this.body.scaleY *= 0.88 + 0.06 * p;
      angle = fallAngle - 0.12 * p;
      this.swingOffY -= H * 0.05 * Math.sin(Math.PI * p);
      this.weaponLengthScale = 1;
      this.attackHandSpacing = H * 0.42;
      this.attackWeaponDepth = p < 0.45 ? -1 : 1;
      this.attackShadowX = fx * H * (0.24 - 0.19 * p);
      this.attackShadowY = fy * H * (0.24 - 0.19 * p);
      this.attackShadowScaleX = 1.08 - 0.08 * p;
      this.attackShadowScaleY = 0.88 + 0.12 * p;
    }
    return angle;
  }

  /** Gravechill Nodachi "Cold Court" + the shared hang-then-fall payoff chassis (§50 Driftblade-model
   * panel). Where Driftblade flows, Gravechill deliberates: a reversed rising draw, a tall guard check
   * whose exit travels upward into the executioner's raise, then an overhead hang and a p² sentence.
   * Voltfang's `thunder-fall` rides the same fall chassis parameterized — shorter hang, 0.4× tremor, a
   * single depth swap instead of the length collapse, and a low forward point instead of a plant. All
   * travel stays on the visual channels (swingOff/attackArtOff/shadow/lift), never the root. */
  private applyGravechillCombo(motion: MeleeComboMotion, tt: number, aimLocal: number): number {
    this.signatureMotion = motion;
    const H = TARGET_BODY_H;
    const fx = Math.cos(aimLocal);
    const fy = Math.sin(aimLocal);
    const nx = -fy;
    const ny = fx;
    let angle = aimLocal;

    if (motion === "draw-cut") {
      // Drawn Frost: reversed opener — a rising draw from a low near-hip line to high across aim, blade
      // broadside the whole way. Wide formal 0.44H spacing; the exit hangs high over the check's entry.
      const low = aimLocal + 1.42;
      const high = aimLocal - 1.12;
      this.attackHandSpacing = H * 0.44;
      if (tt < 0.26) {
        const p = smoothstep01(tt / 0.26);
        angle = low + 0.12 * p;
        this.attackArtOffX = (-fx * 0.03 + nx * 0.02) * H * p;
        this.attackArtOffY = (-fy * 0.03 + ny * 0.02) * H * p;
        this.swingOffX = -fx * H * 0.05 * p;
        this.swingOffY = -fy * H * 0.05 * p + H * 0.03 * p;
        this.body.rotation += 0.1 * p * Math.cos(aimLocal);
        this.body.scaleY *= 1 - 0.04 * p;
      } else if (tt < 0.54) {
        const p = clamp01((tt - 0.26) / 0.28);
        const e = p * p;
        angle = low + 0.12 + (high - low - 0.12) * e;
        const forward = -0.03 + 0.12 * e;
        this.attackArtOffX = H * (fx * forward - nx * 0.02 * e);
        this.attackArtOffY = H * (fy * forward - ny * 0.02 * e);
        this.swingOffX = fx * H * 0.1 * e - this.attackArtOffX;
        this.swingOffY = fy * H * 0.1 * e - this.attackArtOffY - H * 0.05 * e;
        this.body.rotation += (0.1 - 0.26 * e) * Math.cos(aimLocal);
        this.body.scaleY *= 0.96 + 0.08 * e;
      } else if (tt < 0.68) {
        const p = smoothstep01((tt - 0.54) / 0.14);
        angle = high - 0.06 * p;
        this.attackArtOffX = H * (fx * 0.09 - nx * 0.02);
        this.attackArtOffY = H * (fy * 0.09 - ny * 0.02);
        this.swingOffX = fx * H * 0.1 - this.attackArtOffX;
        this.swingOffY = fy * H * 0.1 - this.attackArtOffY - H * 0.05;
        this.body.rotation -= 0.16 * Math.cos(aimLocal);
        this.body.scaleY *= 1.04;
      } else {
        // The courtroom pause: blade held high on the off side, directly over the Tsuba Check's start.
        angle = high - 0.06;
        this.attackArtOffX = H * (fx * 0.07 - nx * 0.02);
        this.attackArtOffY = H * (fy * 0.07 - ny * 0.02);
        this.swingOffX = fx * H * 0.08 - this.attackArtOffX;
        this.swingOffY = fy * H * 0.08 - this.attackArtOffY - H * 0.05;
        this.body.rotation -= 0.16 * Math.cos(aimLocal);
        this.body.scaleY *= 1.04;
      }
      this.attackShadowRotation = aimLocal - 0.35;
      this.attackShadowScaleX = 1.06;
      this.attackShadowScaleY = 0.9;
      this.setComboFootwork(tt, 0.26, 0.54, 0.68, aimLocal, 0.05, -0.03, -0.04, 0.02);
      return angle;
    }

    if (motion === "guard-check") {
      // Shared compact chassis (Tsuba Check / Widow's Knock): the crossguard leads a short body-driven
      // jab down aim. NOT a pommel bash — the blade never reverses, the body stays tall (no crunch),
      // and the exit travels UPWARD into the two-hand raise rather than into a rear load.
      const overhead = -Math.PI / 2 - 0.42;
      const ready = forwardMeleeReadyAngle(aimLocal);
      if (tt < 0.14) {
        const p = smoothstep01(tt / 0.14);
        angle = aimLocal + 0.14 * (1 - p);
        this.attackHandSpacing = H * (0.44 - 0.22 * p);
        this.swingOffX = -fx * H * 0.04 * p;
        this.swingOffY = -fy * H * 0.04 * p;
        this.body.scaleY *= 1 + 0.02 * p; // tall and formal — no crunch
      } else if (tt < 0.3) {
        const p = cubicOut01((tt - 0.14) / 0.16);
        angle = aimLocal;
        this.attackHandSpacing = H * 0.22;
        const drive = H * 0.045 * p;
        this.attackArtOffX = fx * drive;
        this.attackArtOffY = fy * drive;
        this.swingOffX = fx * H * (-0.04 + 0.2 * p) - this.attackArtOffX;
        this.swingOffY = fy * H * (-0.04 + 0.2 * p) - this.attackArtOffY;
        this.body.rotation += 0.06 * p * Math.cos(aimLocal);
        this.attackShadowX = fx * H * 0.04 * p;
        this.attackShadowY = fy * H * 0.04 * p;
      } else if (tt < 0.46) {
        const p = smoothstep01((tt - 0.3) / 0.16);
        angle = aimLocal + (overhead - aimLocal) * p;
        this.attackHandSpacing = H * (0.22 + 0.14 * p);
        this.attackArtOffX = fx * H * 0.045 * (1 - p);
        this.attackArtOffY = fy * H * 0.045 * (1 - p);
        this.swingOffX = fx * H * 0.16 * (1 - p);
        this.swingOffY = fy * H * 0.16 * (1 - p) - H * 0.08 * p;
        this.attackLiftPx = H * 0.04 * p;
        this.body.rotation -= 0.08 * p * Math.cos(aimLocal);
        this.body.scaleY *= 1 + 0.03 * p;
      } else {
        const p = smoothstep01((tt - 0.46) / 0.2);
        angle = mixAngle(overhead, ready, p);
        this.attackHandSpacing = H * 0.36;
        this.swingOffY = -H * 0.08 * (1 - p);
        this.attackLiftPx = H * 0.04 * (1 - p);
        this.body.rotation -= 0.08 * Math.cos(aimLocal) * (1 - p);
        this.body.scaleY *= 1 + 0.03 * (1 - p);
      }
      this.setComboFootwork(tt, 0.14, 0.3, 0.46, aimLocal, 0.06, 0, -0.02, 0);
      return angle;
    }

    // sentence-fall / thunder-fall: the parameterized hang-then-fall payoff.
    const thunder = motion === "thunder-fall";
    const hangEnd = thunder ? 0.48 : 0.5; // authored activeStart
    const impactAt = thunder ? 0.56 : 0.63; // authored impact
    const deformEnd = impactAt + (thunder ? 0.025 : 0.03); // ≤0.03-pose deformation beat
    const holdEnd = thunder ? 0.78 : 0.84; // authored followEnd
    const overhead = -Math.PI / 2 - 0.12;
    const plant = thunder ? aimLocal + 0.18 : 0.85; // low forward point vs centered low plant
    const raiseEnd = 0.34;
    this.attackHandSpacing = H * 0.4;
    if (tt < raiseEnd) {
      // Raise out of the check's high exit into the full two-hand hold.
      const p = smoothstep01(tt / raiseEnd);
      angle = overhead - 0.14 * (1 - p);
      this.attackLiftPx = H * 0.06 * p * (thunder ? 0.6 : 1);
      this.swingOffY = -H * (0.08 + 0.04 * p);
      this.body.rotation -= 0.1 * Math.cos(aimLocal) * p;
      this.body.scaleY *= 1 + 0.05 * p;
      this.attackShadowScaleX = 1 - 0.08 * p;
      this.attackShadowScaleY = 1 - 0.12 * p;
      this.attackShadowAlpha = 1 - 0.1 * p;
    } else if (tt < hangEnd) {
      // The hang: the TCS charge tremor generator at reduced amplitude (0.6× court, 0.4× volt).
      const tremor =
        Math.sin(this.presentationClockNow() * 0.013 * Math.PI * 2) *
        this.scale *
        (thunder ? 0.4 : 0.6);
      angle = overhead;
      this.attackLiftPx = H * 0.06 * (thunder ? 0.6 : 1);
      this.swingOffX = nx * tremor;
      this.swingOffY = -H * 0.12 + ny * tremor;
      this.body.rotation -= 0.12 * Math.cos(aimLocal);
      this.body.scaleY *= 1.06;
      if (!thunder)
        this.weaponLengthScale = 1 - 0.1 * smoothstep01((tt - raiseEnd) / (hangEnd - raiseEnd));
      this.attackShadowScaleX = 0.92;
      this.attackShadowScaleY = 0.88;
      this.attackShadowAlpha = 0.9;
    } else if (tt < impactAt) {
      // The fall: p² through the overhead-to-forward projection. One fake-3D trick only — the court's
      // length collapse (1 → 0.30 → 1.03, blade briefly seen point-on) OR the volt's single depth swap.
      const p = clamp01((tt - hangEnd) / (impactAt - hangEnd));
      const fall = p * p;
      angle = overhead + (plant - overhead) * fall;
      this.attackLiftPx = H * 0.06 * (1 - fall) * (thunder ? 0.6 : 1);
      this.attackArtOffX = fx * H * 0.14 * fall;
      this.attackArtOffY = fy * H * 0.14 * fall;
      this.swingOffX = fx * H * 0.22 * fall - this.attackArtOffX;
      this.swingOffY = fy * H * 0.22 * fall - this.attackArtOffY;
      this.body.rotation += (-0.12 + 0.34 * fall) * Math.cos(aimLocal);
      this.body.scaleY *= 1.06 - 0.2 * fall;
      if (thunder) {
        this.attackWeaponDepth = fall > 0.5 ? 1 : -1;
      } else {
        this.weaponLengthScale =
          p < 0.5
            ? 0.9 - (0.9 - 0.3) * smoothstep01(p / 0.5)
            : 0.3 + 0.73 * smoothstep01((p - 0.5) / 0.5);
      }
      this.attackShadowX = fx * H * 0.14 * fall;
      this.attackShadowY = fy * H * 0.14 * fall;
      this.attackShadowRotation = aimLocal;
      this.attackShadowScaleX = 0.92 + 0.3 * fall;
      this.attackShadowScaleY = 0.88 - 0.1 * fall;
      this.attackShadowAlpha = 0.9 + 0.1 * fall;
    } else if (tt < deformEnd) {
      // Contact-deformation micro-beat, same width as the model's 0.61–0.64.
      const p = clamp01((tt - impactAt) / (deformEnd - impactAt));
      angle = plant;
      this.attackArtOffX = fx * H * 0.14;
      this.attackArtOffY = fy * H * 0.14;
      this.body.rotation += 0.22 * Math.cos(aimLocal);
      this.body.scaleY *= 0.86;
      this.weaponLengthScale = (thunder ? 1 : 1.03) - 0.08 * Math.sin(Math.PI * p);
      this.attackShadowX = fx * H * 0.14;
      this.attackShadowY = fy * H * 0.14;
      this.attackShadowScaleX = 1.22;
      this.attackShadowScaleY = 0.78;
    } else if (tt < holdEnd) {
      // The hold: the court's plant is the longest in the family; the volt points low down aim.
      angle = plant;
      this.attackArtOffX = fx * H * 0.14;
      this.attackArtOffY = fy * H * 0.14;
      this.body.rotation += 0.22 * Math.cos(aimLocal);
      this.body.scaleY *= 0.9;
      this.weaponLengthScale = thunder ? 1 : 1.03;
      this.attackShadowX = fx * H * 0.14;
      this.attackShadowY = fy * H * 0.14;
      this.attackShadowScaleX = 1.14;
      this.attackShadowScaleY = 0.84;
    } else {
      // The court adjourns slowly; the volt releases briskly toward the next fang.
      const p = smoothstep01((tt - holdEnd) / Math.max(0.01, 1 - holdEnd));
      angle = plant - 0.1 * p;
      this.attackArtOffX = fx * H * 0.14 * (1 - 0.6 * p);
      this.attackArtOffY = fy * H * 0.14 * (1 - 0.6 * p);
      this.body.rotation += 0.22 * Math.cos(aimLocal) * (1 - p);
      this.body.scaleY *= 0.9 + 0.08 * p;
      this.weaponLengthScale = 1;
      this.attackShadowX = fx * H * 0.14 * (1 - 0.6 * p);
      this.attackShadowY = fy * H * 0.14 * (1 - 0.6 * p);
      this.attackShadowScaleX = 1.14 - 0.1 * p;
      this.attackShadowScaleY = 0.84 + 0.12 * p;
    }
    this.setComboFootwork(tt, hangEnd, impactAt, holdEnd, aimLocal, 0.08, 0.02, -0.02, -0.02);
    return angle;
  }

  /** Stormpetal Odachi "Petalfall" (§50 Driftblade-model panel): wind through a flowering tree. The
   * compact beat is a choked blade FLIP (the model's fake-3D budget deliberately relocated from beat 3
   * to beat 2), and the finisher is a single-window S-cut that settles into a light high guard with one
   * visible breath — the anti-Sentence. Crosswind (beat 1, reused `slash`) rides the generic branch. */
  private applyStormpetalCombo(motion: MeleeComboMotion, tt: number, aimLocal: number): number {
    this.signatureMotion = motion;
    const H = TARGET_BODY_H;
    const fx = Math.cos(aimLocal);
    const fy = Math.sin(aimLocal);
    const nx = -fy;
    const ny = fx;
    let angle = aimLocal;

    if (motion === "choked-turn") {
      // Leaf Turn: grip chokes 0.42H → 0.20H and the odachi twirls ONCE about the grip (dir −1), the
      // length scale dipping to 0.50 at the edge-on frames. Exit leaves the blade reversed and low
      // behind the off hip — Petalfall's entry.
      const start = aimLocal + 0.4;
      const exit = aimLocal + Math.PI - 0.35;
      if (tt < 0.1) {
        const p = smoothstep01(tt / 0.1);
        angle = start * p + aimLocal * (1 - p);
        this.attackHandSpacing = H * (0.42 - 0.22 * p);
        this.swingOffY = -H * 0.03 * p;
        this.body.scaleY *= 1 - 0.02 * p;
      } else if (tt < 0.26) {
        const p = clamp01((tt - 0.1) / 0.16);
        const e = cubicOut01(p);
        angle = start - Math.PI * 2 * e;
        this.attackHandSpacing = H * 0.2;
        this.weaponLengthScale = Math.max(0.5, Math.abs(Math.cos(Math.PI * 2 * e)));
        this.attackWeaponDepth = e > 0.25 && e < 0.75 ? -1 : 1;
        this.swingOffX = nx * H * 0.04 * Math.sin(Math.PI * p);
        this.swingOffY = -H * 0.03 + ny * H * 0.04 * Math.sin(Math.PI * p);
        this.body.rotation -= 0.06 * Math.sin(Math.PI * p) * Math.cos(aimLocal);
        this.attackShadowScaleX = 1 - 0.08 * Math.sin(Math.PI * p);
        this.attackShadowScaleY = 1 - 0.04 * Math.sin(Math.PI * p);
      } else if (tt < 0.42) {
        const p = smoothstep01((tt - 0.26) / 0.16);
        angle = start - Math.PI * 2 + (exit - (start - Math.PI * 2)) * p;
        this.attackHandSpacing = H * (0.2 + 0.06 * p);
        this.weaponLengthScale = 1;
        this.swingOffX = -fx * H * 0.06 * p;
        this.swingOffY = -fy * H * 0.06 * p + H * 0.04 * p;
        this.body.rotation += 0.04 * p * Math.cos(aimLocal);
      } else {
        angle = exit;
        this.attackHandSpacing = H * 0.26;
        this.swingOffX = -fx * H * 0.06;
        this.swingOffY = -fy * H * 0.06 + H * 0.04;
        this.body.rotation += 0.04 * Math.cos(aimLocal);
      }
      this.setComboFootwork(tt, 0.1, 0.26, 0.42, aimLocal, 0.03, 0.03, -0.02, 0.02);
      return angle;
    }

    // Petalfall: a single-window S-cut — reverse rise for the first 40% of active travel, then a
    // forehand fall through aim. Torso stays tall; reach comes from the art, not a lunge.
    const reversedLow = aimLocal + Math.PI - 0.35;
    const apex = aimLocal - 1.35;
    const through = aimLocal + 1.15;
    this.attackHandSpacing = H * 0.4;
    if (tt < 0.24) {
      const p = smoothstep01(tt / 0.24);
      angle = reversedLow + 0.1 * p;
      this.swingOffX = -fx * H * 0.05 * p;
      this.swingOffY = -fy * H * 0.05 * p + H * 0.04 * p;
      this.body.rotation += 0.06 * p * Math.cos(aimLocal);
      this.body.scaleY *= 1 - 0.02 * p;
    } else if (tt < 0.44) {
      const p = smoothstep01((tt - 0.24) / 0.2);
      angle = reversedLow + 0.1 + (apex - (reversedLow + 0.1)) * p * 0.55;
      this.swingOffX = -fx * H * 0.05 * (1 - p);
      this.swingOffY = -fy * H * 0.05 * (1 - p) - H * 0.04 * p;
      this.body.rotation += (0.06 - 0.1 * p) * Math.cos(aimLocal);
      this.body.scaleY *= 0.98 + 0.04 * p;
    } else if (tt < 0.62) {
      const p = clamp01((tt - 0.44) / 0.18);
      if (p < 0.4) {
        // First stroke of the S: the rise completes in reverse.
        const q = p / 0.4;
        const riseFrom = reversedLow + 0.1 + (apex - (reversedLow + 0.1)) * 0.55;
        angle = riseFrom + (apex - riseFrom) * smoothstep01(q);
        this.swingOffY = -H * (0.04 + 0.04 * q);
        this.body.rotation -= 0.04 * Math.cos(aimLocal);
        this.body.scaleY *= 1.02;
      } else {
        // Second stroke: forehand fall through aim; two-frame overshoot 1.00 → 1.04 → 0.99.
        const q = (p - 0.4) / 0.6;
        const e = q * q;
        angle = apex + (through - apex) * e;
        this.attackArtOffX = fx * H * 0.06 * e;
        this.attackArtOffY = fy * H * 0.06 * e;
        this.swingOffX = fx * H * 0.1 * e - this.attackArtOffX;
        this.swingOffY = fy * H * 0.1 * e - this.attackArtOffY - H * 0.08 * (1 - e);
        this.body.rotation += (-0.04 + 0.18 * e) * Math.cos(aimLocal);
        this.body.scaleY *= 1.02 - 0.06 * e; // 0.96y at contact — tall, no crunch
        this.weaponLengthScale = q > 0.8 ? 1 + 0.04 * Math.sin(Math.PI * ((q - 0.8) / 0.2)) : 1;
      }
      this.attackShadowRotation = aimLocal + 0.3;
      this.attackShadowScaleX = 1.08;
      this.attackShadowScaleY = 0.9;
    } else if (tt < 0.82) {
      // Exhale settle into a light high guard — no plant, no crunch.
      const p = smoothstep01((tt - 0.62) / 0.2);
      const guard = forwardMeleeReadyAngle(aimLocal);
      angle = through + (guard - through) * p;
      this.weaponLengthScale = 0.99 + 0.01 * p;
      this.attackArtOffX = fx * H * 0.06 * (1 - p);
      this.attackArtOffY = fy * H * 0.06 * (1 - p);
      this.swingOffX = fx * H * 0.04 * (1 - p);
      this.swingOffY = fy * H * 0.04 * (1 - p) - H * 0.05 * p;
      this.body.rotation += 0.14 * (1 - p) * Math.cos(aimLocal);
      this.body.scaleY *= 0.96 + 0.05 * p;
    } else {
      // One visible breath: a light spring settle in the high guard.
      const p = clamp01((tt - 0.82) / 0.18);
      const breath = Math.sin(Math.PI * p) * 0.02;
      angle = forwardMeleeReadyAngle(aimLocal) + breath;
      this.swingOffY = -H * (0.05 + breath);
      this.body.scaleY *= 1.01 + breath;
    }
    this.setComboFootwork(tt, 0.44, 0.62, 0.82, aimLocal, 0.04, 0.02, -0.02, 0.03);
    return angle;
  }

  /** Late additive movement pose: it composes after weapon authorship and before the shared lift/shadow pass. */
  private applyJumpFeelPose(timeMs: number, anim: RigAnim): void {
    const vh = anim.jumpVh ?? 0;
    const reduced = anim.reducedMotion === true;
    const stanceElapsed = Math.max(0, timeMs - this.stanceStartedMs);
    this.slidePhase =
      this.moveStance === STANCE_SLIDE ? (anim.slidePhase ?? SLIDE_PHASE_OFF) : SLIDE_PHASE_OFF;
    this.slideRenderT =
      this.moveStance === STANCE_SLIDE
        ? (anim.slideTick ?? Math.floor(stanceElapsed / TICK_MS) + 1) * ROLL_TICK_SECONDS
        : 0;

    if (this.moveStance === STANCE_POUND) {
      if (stanceElapsed <= 120 && !reduced) {
        const e = clamp01(stanceElapsed / 120);
        this.attackScaleY *= signedClamp(Math.cos(Math.PI * 2 * e), 0.14);
        this.body.scaleX *= 1 - 0.2 * Math.max(0, 1 - Math.abs(Math.cos(Math.PI * 2 * e)));
        this.attackLiftPx += 6 * Math.sin(Math.PI * e);
        const pulse = 1 + 0.18 * Math.sin(Math.PI * e);
        this.attackShadowScaleX *= pulse;
        this.attackShadowScaleY *= pulse;
        this.attackShadowAlpha *= 1 + 0.08 * Math.sin(Math.PI * e);
      } else if (vh < 0) {
        const stretch = reduced ? 1.08 : 1.18;
        this.body.scaleY *= stretch;
        this.body.scaleX *= 2 - stretch;
        for (const foot of this.feet) foot.img.y += 10;
        for (const hand of this.hands) hand.img.y -= 8;
        this.attackShadowAlpha *= 1.14;
      }
    } else if (this.moveStance === STANCE_SLIDE) {
      const slidePhase = anim.slidePhase ?? SLIDE_PHASE_OFF;
      const heading = anim.moveX < -0.05 ? -1 : 1;
      if (slidePhase === SLIDE_PHASE_GROUND) {
        const progress = clamp01(this.slideRenderT / ROLL_DURATION);
        const tuck = Math.sin(Math.PI * progress);
        this.root.rotation += rollTumbleRotation(progress, heading, reduced);
        this.body.scaleY *= 1 - (reduced ? 0.12 : 0.23) * tuck;
        this.body.scaleX *= 1 + (reduced ? 0.05 : 0.12) * tuck;
        this.body.rotation += heading * 0.18 * tuck;
        this.body.y += TARGET_BODY_H * 0.12 * tuck;
        for (const foot of this.feet) {
          foot.img.x -= heading * TARGET_BODY_H * 0.06 * tuck;
          foot.img.y -= TARGET_BODY_H * 0.1 * tuck;
        }
        for (const hand of this.hands) {
          hand.img.x += heading * TARGET_BODY_H * 0.04 * tuck;
          hand.img.y += TARGET_BODY_H * 0.08 * tuck;
        }
      }
      for (const weapon of this.weapons) {
        weapon.img.rotation -= heading * 0.08;
        weapon.img.x -= heading * TARGET_BODY_H * 0.06;
        weapon.img.y += TARGET_BODY_H * 0.04;
      }
      this.attackShadowScaleX *= 1.12;
      this.attackShadowScaleY *= 0.82;
    } else if (this.moveStance === STANCE_DASH) {
      const launch = clamp01(stanceElapsed / 83);
      const extreme = reduced ? 1.12 : 1.3;
      const stretch = stanceElapsed < 83 ? extreme + (1.06 - extreme) * smoothstep01(launch) : 1.06;
      this.body.scaleY *= stretch;
      this.body.scaleX *= 2 - stretch;
      this.body.rotation += Math.max(-0.22, Math.min(0.22, anim.moveX * 0.22));
      this.attackShadowScaleX *= 1 + Math.abs(anim.moveX) * 0.18;
      this.attackShadowScaleY *= 1 + Math.abs(anim.moveY) * 0.18;
      for (const hand of this.hands) {
        hand.img.x -= anim.moveX * TARGET_BODY_H * 0.1;
        hand.img.y -= anim.moveY * TARGET_BODY_H * 0.1;
      }
    } else if (this.hopPx > 0.01) {
      const sinceLaunch = timeMs - this.jumpStartedMs;
      if (sinceLaunch >= 0 && sinceLaunch < 33) {
        const squash = reduced ? 0.05 : 0.1;
        this.body.scaleY *= 1 - squash * (1 - sinceLaunch / 33);
        this.body.scaleX *= 1 + squash * 0.6 * (1 - sinceLaunch / 33);
        this.attackShadowScaleX *= 1.04;
        this.attackShadowScaleY *= 1.04;
      }
      if (vh > GRAVITY_APEX_BAND) {
        const amount = (reduced ? 0.08 : 0.16) * clamp01(vh / JUMP_VELOCITY);
        this.body.scaleY *= 1 + amount;
        this.body.scaleX *= 1 - amount;
      } else if (Math.abs(vh) <= GRAVITY_APEX_BAND) {
        const breath = (reduced ? 0.01 : 0.02) * (0.5 + 0.5 * Math.sin(timeMs * 0.025));
        this.body.scaleY *= 1.02 + breath;
        this.body.rotation *= 0.82;
      } else {
        const amount = (reduced ? 0.03 : 0.06) * clamp01(-vh / JUMP_VELOCITY);
        this.body.scaleY *= 1 - amount;
        this.body.scaleX *= 1 + amount * 0.6;
        this.body.rotation += Math.max(-0.05, Math.min(0.05, anim.moveX * 0.05));
        for (const foot of this.feet) foot.img.y -= 6;
      }
    }

    const sinceLanding = timeMs - this.landedAtMs;
    if (this.landedFromStance === STANCE_POUND && sinceLanding >= 0 && sinceLanding < 280) {
      const recovery =
        sinceLanding < 80 ? 0.78 : 0.78 + 0.22 * backOut01((sinceLanding - 80) / 200);
      this.body.scaleY *= reduced ? Math.max(0.88, recovery) : recovery;
      this.body.scaleX *= 2 - recovery;
    } else if (this.landedFromStance === STANCE_DASH && sinceLanding >= 0 && sinceLanding < 180) {
      const q = 1 - smoothstep01(sinceLanding / 180);
      this.body.rotation -= Math.max(-0.12, Math.min(0.12, anim.moveX * 0.12)) * q;
      this.body.scaleY *= 1 - 0.12 * q;
      this.body.scaleX *= 1 + 0.07 * q;
    } else if (this.landedFromStance === STANCE_SLIDE && sinceLanding >= 0 && sinceLanding < 180) {
      const q = 1 - smoothstep01(sinceLanding / 180);
      this.body.rotation -= Math.max(-0.15, Math.min(0.15, anim.moveX * 0.15)) * q;
      this.body.scaleY *= 1 - 0.1 * q;
      this.body.scaleX *= 1 + 0.08 * q;
    }

    // Hands moved after the ordinary weapon mount pass; re-seat held art onto those final grip points.
    for (const weapon of this.weapons) weapon.img.setPosition(weapon.hand.img.x, weapon.hand.img.y);
  }

  /** §51 late additive combo grammar. Every clock is presentation-only; root position and damaging geometry
   * remain owned by snapshots/telegraphs. This pass is retained-transform work and allocates nothing. */
  private applyEnemyComboPresentationPose(timeMs: number): void {
    const offer = smoothstep01(this.enemyComboOfferPhase);
    const aimLocal = Math.atan2(
      Math.sin(this.enemyComboAimWorld),
      Math.cos(this.enemyComboAimWorld) * this.facing,
    );
    if (offer > 0) {
      // Duel offer: deep, still crouch; weapon closes across the body while the head/card commits to aim.
      this.body.y += TARGET_BODY_H * 0.14 * offer;
      this.body.scaleY *= 1 - 0.25 * offer;
      this.body.scaleX *= 1 + 0.12 * offer;
      this.body.rotation += Math.cos(aimLocal) * 0.12 * offer;
      for (const foot of this.feet)
        foot.img.x += (foot.front ? 1 : -1) * TARGET_BODY_H * 0.08 * offer;
      for (const hand of this.hands) {
        hand.img.x -= Math.cos(aimLocal) * TARGET_BODY_H * 0.06 * offer;
        hand.img.y += TARGET_BODY_H * 0.08 * offer;
      }
      for (const weapon of this.weapons) {
        weapon.img.setPosition(weapon.hand.img.x, weapon.hand.img.y);
        weapon.img.rotation = mixAngle(
          weapon.img.rotation,
          forwardMeleeReadyAngle(aimLocal),
          offer,
        );
      }
    }

    const sinceLanding = timeMs - this.enemyComboLandedAtMs;
    if (sinceLanding >= 0 && sinceLanding < 250) {
      // Sacred settle: one knee absorbs the flight, then the weapon returns to a quiet guard. No attack
      // clock starts here; the server's zero windup is the source of that honesty.
      const q = clamp01(sinceLanding / 250);
      const dip = Math.sin(Math.PI * q);
      const guard = smoothstep01(q);
      this.body.y += TARGET_BODY_H * 0.12 * dip;
      this.body.scaleY *= 1 - 0.2 * dip;
      this.body.scaleX *= 1 + 0.1 * dip;
      for (const foot of this.feet)
        foot.img.y += (foot.front ? 1 : 0.45) * TARGET_BODY_H * 0.06 * dip;
      for (const weapon of this.weapons) {
        weapon.img.rotation = mixAngle(
          weapon.img.rotation,
          forwardMeleeReadyAngle(aimLocal),
          guard,
        );
      }
    }

    const sinceReturn = timeMs - this.enemyComboReturnAtMs;
    if (this.enemyComboEmpowered && sinceReturn >= 0 && sinceReturn < 400) {
      // The 0.4s displaced hold proves the parry had mass: heels drag, torso counter-leans, gold edge stays
      // awake. The later windup/dash inherits the ordinary melee pose with its gold/heavy modifiers.
      const q = clamp01(sinceReturn / 400);
      const hold = 1 - smoothstep01(q);
      const fx = Math.cos(aimLocal);
      const fy = Math.sin(aimLocal);
      this.body.rotation -= Math.cos(aimLocal) * 0.24 * hold;
      this.body.y += TARGET_BODY_H * 0.09 * hold;
      this.body.scaleY *= 1 - 0.14 * hold;
      this.body.scaleX *= 1 + 0.08 * hold;
      for (const foot of this.feet) {
        foot.img.x -= fx * TARGET_BODY_H * (foot.front ? 0.12 : 0.05) * hold;
        foot.img.y -= fy * TARGET_BODY_H * (foot.front ? 0.12 : 0.05) * hold;
      }
    }

    const sinceStagger = timeMs - this.enemyComboStaggerAtMs;
    if (sinceStagger >= 0 && sinceStagger < 620) {
      // Second-parry payoff: a sharper authored buckle that visibly ends the gold sentence.
      const q = clamp01(sinceStagger / 620);
      const buckle = 1 - smoothstep01(q);
      this.body.rotation -= Math.cos(aimLocal) * 0.38 * buckle;
      this.body.y += TARGET_BODY_H * 0.18 * buckle;
      this.body.scaleY *= 1 - 0.26 * buckle;
      this.body.scaleX *= 1 + 0.14 * buckle;
      for (const hand of this.hands) hand.img.y += TARGET_BODY_H * 0.12 * buckle;
      for (const weapon of this.weapons) weapon.img.rotation += 0.5 * this.facing * buckle;
    }

    const sinceJuggle = timeMs - this.juggledAtMs;
    if (sinceJuggle >= 0 && sinceJuggle < 240) {
      const q = clamp01(sinceJuggle / 240);
      const tumble = Math.sin(Math.PI * q);
      this.body.rotation += this.facing * 0.34 * tumble;
      this.body.scaleX *= 1 + 0.08 * tumble;
      this.body.scaleY *= 1 - 0.06 * tumble;
      for (const hand of this.hands)
        hand.img.x += (hand.front ? 1 : -1) * TARGET_BODY_H * 0.06 * tumble;
      for (const foot of this.feet) foot.img.y -= TARGET_BODY_H * 0.06 * tumble;
    }

    // Hands may have moved after the weapon mount pass; keep the implement physically attached.
    for (const weapon of this.weapons) weapon.img.setPosition(weapon.hand.img.x, weapon.hand.img.y);
  }

  private applyUltimateRootPresentation(timeMs: number): void {
    let alpha = this.downed ? 0.5 : 1;
    if (!this.downed && this.ultimatePhase === UltimatePhase.Active) {
      if (this.ultimateFamily === UltimateFamily.EventHorizon) alpha = 0.42;
      else if (this.ultimateFamily === UltimateFamily.AlphaStrike) alpha = 0.24;
    }
    if (
      this.ultimatePhase === UltimatePhase.Active &&
      this.ultimateFamily === UltimateFamily.EventHorizon
    ) {
      const plane = this.ultimateReducedMotion
        ? 0.72
        : signedClamp(Math.cos(this.ultimateProgress * Math.PI * 2), 0.04);
      this.root.scaleX *= plane;
    } else if (
      this.ultimatePhase === UltimatePhase.Active &&
      this.ultimateFamily === UltimateFamily.AlphaStrike &&
      !this.ultimateReducedMotion
    ) {
      this.root.scaleX *= 1 + Math.sin(this.ultimateProgress * Math.PI * 12) * 0.12;
    }

    if (this.foldStartMs >= 0) {
      const elapsed = timeMs - this.foldStartMs;
      if (elapsed < this.foldDurationMs) {
        const q = smoothstep01(Math.max(0, elapsed) / this.foldDurationMs);
        this.root.scaleX *= 1 - q * 0.82;
        this.root.scaleY *= Math.max(0.025, 1 - q);
        this.root.rotation += q * 0.055;
        alpha *= Math.max(0.04, 1 - q);
      } else if (timeMs < this.foldHiddenUntilMs) {
        this.root.scaleY *= 0.025;
        alpha *= 0.03;
      } else {
        this.foldStartMs = -1;
        this.foldHiddenUntilMs = -1;
      }
    }
    this.root.setAlpha(alpha);
  }

  /** Late additive paper pose: never changes the actor root position, targetability, or collision geometry. */
  private applyUltimatePose(timeMs: number): void {
    const inputElapsed = timeMs - this.ultimateInputAtMs;
    const inputWindup =
      this.ultimatePhase === UltimatePhase.Idle &&
      inputElapsed >= 0 &&
      inputElapsed < 180 &&
      this.ultimateInputFamily !== UltimateFamily.Locked;
    const family = inputWindup ? this.ultimateInputFamily : this.ultimateFamily;
    const windup =
      this.ultimatePhase === UltimatePhase.Windup
        ? 1 - this.ultimateProgress * 0.35
        : inputWindup
          ? Math.sin(Math.PI * (inputElapsed / 180))
          : 0;
    if (windup > 0) {
      const strength = this.ultimateReducedMotion ? windup * 0.45 : windup;
      const squash = family === UltimateFamily.EventHorizon ? 0.2 : 0.14;
      this.attackScaleY *= 1 - squash * strength;
      this.body.y += TARGET_BODY_H * 0.08 * strength;
      this.body.rotation +=
        this.facing * (family === UltimateFamily.AlphaStrike ? 0.18 : 0.1) * strength;
      for (const hand of this.hands) {
        hand.img.x -= this.facing * TARGET_BODY_H * 0.04 * strength;
        hand.img.y += TARGET_BODY_H * 0.05 * strength;
      }
    }

    if (this.ultimatePhase !== UltimatePhase.Active) return;
    const p = this.ultimateProgress;
    if (family === UltimateFamily.Seismarch) {
      this.attackLiftPx += Math.sin(Math.PI * p) * (this.ultimateReducedMotion ? 34 : 92);
      this.attackScaleY *= 0.82 + Math.sin(Math.PI * p) * 0.18;
    } else if (family === UltimateFamily.AlphaStrike) {
      this.attackScaleY *= 0.76 + 0.12 * Math.sin(p * Math.PI * 12);
      this.body.rotation += this.facing * Math.sin(p * Math.PI * 12) * 0.16;
    } else if (family === UltimateFamily.EventHorizon) {
      this.attackScaleY *= 0.9;
      this.body.rotation += this.facing * Math.sin(p * Math.PI * 2) * 0.08;
    }
  }

  private vastagharFoot(sourceFoot: number): RigFoot | undefined {
    // Wire order is outer-left, outer-right, inner-left, inner-right; art order is left outer→inner→right.
    const artIndex =
      sourceFoot === VastagharFoot.OuterLeft
        ? 0
        : sourceFoot === VastagharFoot.OuterRight
          ? 3
          : sourceFoot === VastagharFoot.InnerLeft
            ? 1
            : 2;
    return this.feet[artIndex];
  }

  /** Boss-local paper theatre sampled from immutable action epochs; never moves the authoritative root. */
  private applyVastagharPose(reducedMotion: boolean): void {
    const pose = this.vastagharPose;
    if (!pose) return;
    const source =
      pose.sourceFoot === VastagharFoot.Body ? undefined : this.vastagharFoot(pose.sourceFoot);
    const action = pose.actionLive ? pose.actionKind : VastagharActionKind.None;
    const footfallAction =
      action === VastagharActionKind.Crownstep ||
      action === VastagharActionKind.ThreefoldMarch ||
      action === VastagharActionKind.TwinTread ||
      action === VastagharActionKind.FinalTread;
    const entrance = clamp01(pose.entranceT);

    // Arrival is a two-piece bottom hinge: feet become broadside first, torso follows one short beat later.
    if (pose.mode === VastagharMode.Entrance && entrance < 1) {
      const feetOpen = reducedMotion ? (entrance > 0 ? 1 : 0.08) : smoothstep01(entrance / 0.82);
      const bodyOpen = reducedMotion ? feetOpen : smoothstep01(Math.max(0, entrance - 0.15) / 0.85);
      for (const foot of this.feet) foot.img.scaleY *= signedClamp(feetOpen, 0.045);
      this.body.scaleY *= signedClamp(bodyOpen, 0.045);
      this.body.rotation += (1 - bodyOpen) * 0.055;
    }

    // The named source foot owns its fixed authoritative plant throughout lift/drop. Correct for the
    // permanent lower-body art lift so the visible sole and the schema impact point coincide at resolve.
    if (source && footfallAction && pose.impactX !== 0 && pose.impactY !== 0) {
      const dx = pose.impactX - this.root.x;
      const dy = pose.impactY - this.root.y;
      const c = Math.cos(-this.root.rotation);
      const s = Math.sin(-this.root.rotation);
      const localX = (dx * c - dy * s) / signedClamp(this.root.scaleX, 0.04);
      const localY = (dx * s + dy * c) / signedClamp(this.root.scaleY, 0.04);
      const load = smoothstep01(pose.stepT / 0.72);
      const drop = pose.responseActive ? 1 - smoothstep01(pose.responseT) : pose.stepT < 1 ? 1 : 0;
      const lift = load * drop;
      const leftFoot =
        pose.sourceFoot === VastagharFoot.OuterLeft || pose.sourceFoot === VastagharFoot.InnerLeft;
      source.img.x = localX;
      source.img.y = localY + this.baseLift - TARGET_BODY_H * 0.18 * lift;
      source.img.rotation += (leftFoot ? -1 : 1) * 0.08 * lift;
      this.body.x += (leftFoot ? 1 : -1) * 5 * lift;
      this.body.y += 4 * load;
      this.body.rotation += (leftFoot ? 1 : -1) * 0.045 * load;
      if (pose.impactActive) {
        this.body.y += 5;
        this.body.scaleY *= 0.94;
      }
    }

    // Heel Reap and Worldwheel put the attacking foot on the sampled annular edge. The protected exact
    // capsule remains the fairness carrier; this makes the paper weapon visibly travel with it.
    if (
      source &&
      (action === VastagharActionKind.HeelReap || action === VastagharActionKind.Worldwheel)
    ) {
      const sweepRadius = action === VastagharActionKind.Worldwheel ? 590 : 520;
      const angle = pose.worldwheelAngle;
      const worldX = this.root.x + Math.cos(angle) * sweepRadius;
      const worldY = this.root.y + Math.sin(angle) * sweepRadius;
      const dx = worldX - this.root.x;
      const dy = worldY - this.root.y;
      source.img.x = dx / signedClamp(this.root.scaleX, 0.04);
      source.img.y = dy / signedClamp(this.root.scaleY, 0.04) + this.baseLift;
      source.img.rotation = angle * this.facing;
      const tuck = 1 - smoothstep01(pose.windupT);
      this.body.y += 5 * (1 - tuck);
      this.body.scaleY *= 0.92 + 0.08 * tuck;
      if (
        action === VastagharActionKind.Worldwheel &&
        pose.activeT > 0 &&
        pose.activeT < 1 &&
        !reducedMotion
      ) {
        const plane = signedClamp(Math.cos(angle), 0.06);
        this.body.scaleX *= plane;
        for (const foot of this.feet) foot.img.scaleX *= plane;
        const foreground = Math.sin(angle) >= 0;
        if (foreground !== this.vastagharDepthFront) {
          if (foreground) this.root.moveAbove(source.img, this.body);
          else this.root.moveBelow(source.img, this.body);
          this.vastagharDepthFront = foreground;
        }
      }
      if (pose.recoveryT > 0) {
        this.body.rotation += 0.12 * (1 - smoothstep01(pose.recoveryT));
        source.img.x += 4 * (1 - pose.recoveryT);
      }
    } else if (this.vastagharDepthFront) {
      for (const foot of this.feet) this.root.moveBelow(foot.img, this.body);
      this.vastagharDepthFront = false;
    }

    // Dodge-only cards brace/pitch without borrowing the response-white foot language.
    if (action === VastagharActionKind.ShedMountain) {
      const brace = 1 - Math.abs(pose.windupT * 2 - 1);
      this.body.y += 5 * brace;
      this.body.scaleY *= 1 - 0.05 * brace;
      for (const foot of this.feet) foot.img.rotation *= 0.2;
    } else if (action === VastagharActionKind.LandmarkBreak) {
      const load = smoothstep01(pose.windupT);
      this.body.rotation -= 0.1 * load;
      this.body.scaleY *= 1 - 0.08 * load;
    }

    // The authored 16-tick breaks stay boss-local: a crease/through-plane turn, never a screen takeover.
    if (pose.transitionActive) {
      const q = smoothstep01(pose.windupT);
      if (action === VastagharActionKind.PhaseStuckStep) {
        this.body.rotation += 0.16 * Math.sin(q * Math.PI);
        this.body.scaleX *= signedClamp(Math.cos(q * Math.PI), reducedMotion ? 0.45 : 0.06);
      } else if (action === VastagharActionKind.PhaseWorldTurn) {
        const plane = reducedMotion ? 0.72 : signedClamp(Math.cos(q * Math.PI), 0.06);
        this.body.scaleX *= plane;
        for (const foot of this.feet) foot.img.scaleX *= plane;
      }
    }

    // Three earned pips produce a unmistakable folded hold for the complete 64-tick damage window.
    if (pose.downedGuard || action === VastagharActionKind.StrideBreak) {
      const replant = smoothstep01((pose.actionT - (1 - 9 / 64)) / (9 / 64));
      const fold = 1 - replant;
      this.body.y += 9 * fold;
      this.body.scaleY *= 1 - 0.14 * fold;
      this.body.rotation += 0.055 * fold;
      const innerLeft = this.feet[1];
      const innerRight = this.feet[2];
      const outerLeft = this.feet[0];
      const outerRight = this.feet[3];
      if (innerLeft) {
        innerLeft.img.y += 8 * fold;
        innerLeft.img.rotation -= 0.22 * fold;
      }
      if (innerRight) innerRight.img.rotation += 0.12 * fold;
      if (outerLeft) {
        outerLeft.img.x -= 7 * fold;
        outerLeft.img.rotation -= 0.16 * fold;
      }
      if (outerRight) {
        outerRight.img.x += 7 * fold;
        outerRight.img.rotation += 0.16 * fold;
      }
      this.attackShadowScaleX *= 1 + 0.3 * fold;
      this.attackShadowScaleY *= 1 - 0.32 * fold;
      this.attackShadowAlpha *= 1 - 0.1 * fold;
    }

    if (pose.desperation && pose.mode !== VastagharMode.Victory) {
      const tighten = 0.04 + 0.025 * Math.sin(pose.stepT * Math.PI);
      for (const foot of this.feet) {
        foot.img.x *= 1 - tighten;
        foot.img.y *= 1 - tighten * 0.35;
      }
      this.body.rotation += Math.sin(pose.stepT * Math.PI * 4) * 0.012;
    }
  }

  private sampleFloatingHeadAttackLead(
    sceneNow: number,
    anim: RigAnim,
    reducedMotion: boolean,
  ): void {
    const out = this.floatingHeadAttackLead;
    out.x = 0;
    out.y = 0;
    const swing = this.swing;
    if (reducedMotion || !swing) return;
    const elapsed = (sceneNow - this.swingStart) / 1000;
    const crest = Math.max(0.04, swing.activeStartSeconds);
    const release = Math.max(crest + 0.04, Math.min(swing.impactSeconds, swing.poseSeconds));
    if (elapsed < 0 || elapsed >= release) return;
    const def = this.swingWeaponDef ?? this.weaponDef;
    const majorStyle = swing.style === "chop" || swing.style === "orbit" || swing.style === "spin";
    const combo = swing.comboStep !== undefined;
    if (!majorStyle && !def?.twoHanded && !combo) return;
    const anticipation =
      elapsed <= crest
        ? smoothstep01(elapsed / crest)
        : 1 - smoothstep01((elapsed - crest) / (release - crest));
    const worldAim = Number.isNaN(this.swingAimWorld)
      ? anim.isSelf
        ? Math.atan2(anim.aimY, anim.aimX)
        : anim.aimDir
      : this.swingAimWorld;
    const localAim = Math.atan2(Math.sin(worldAim), Math.cos(worldAim) * this.facing);
    const distance =
      FLOATING_HEAD_SPRING_TUNING.bigAttackLeadPx * (combo && !majorStyle ? 0.72 : 1);
    out.x = Math.cos(localAim) * distance * anticipation;
    out.y = Math.sin(localAim) * distance * anticipation * 0.72;
  }

  private syncFloatingHeadPose(
    elapsedSeconds: number,
    outsidePaperView: boolean,
    rebase: boolean,
    reducedMotion: boolean,
    localMoveX: number,
    moveY: number,
    localSpringSignalX: number,
    springSignalY: number,
    landed: boolean,
    movementHeadBobPx: number,
  ): void {
    const head = this.boilerplateHead;
    const boilerplateSource = this.boilerplateReady ? this.boilerplateHeadAssembly : undefined;
    const manifestSource = this.manifestHeadOffset;
    if (!head || (!boilerplateSource && !manifestSource)) return;
    if (outsidePaperView) {
      this.floatingHeadLodSleeping = true;
      return;
    }
    const assemblyScale = this.boilerplateAssembly?.scale ?? 1;
    const root = boilerplateSource
      ? this.boilerplateManifest?.socketFrame.bodyRootSource
      : undefined;
    const resolvedSocket = boilerplateSource ? this.gearAssembly?.rigSockets.head : undefined;
    // The equipped torso's post-normalization alpha top/center owns the rest socket. Falling back to the
    // boilerplate assembly preserves pre-load behavior. A sliced character head instead retains the exact
    // source-space centroid offset emitted beside its body by the existing ArtKit component slicer.
    const localX = boilerplateSource
      ? resolvedSocket && root
        ? resolvedSocket.x - root.x
        : boilerplateSource.x / assemblyScale
      : (manifestSource?.x ?? 0);
    const localY = boilerplateSource
      ? resolvedSocket && root
        ? resolvedSocket.y - root.y
        : boilerplateSource.y / assemblyScale
      : (manifestSource?.y ?? 0) +
        FLOATING_HEAD_SPRING_TUNING.manifestRestInsetPx / Math.max(this.scale, 1e-6);
    const dx = localX * this.body.scaleX;
    const dy = localY * this.body.scaleY;
    const cosine = Math.cos(this.body.rotation);
    const sine = Math.sin(this.body.rotation);
    const targetX = this.body.x + cosine * dx - sine * dy;
    const targetY = this.body.y + sine * dx + cosine * dy;
    const movementLength = Math.hypot(localMoveX, moveY);
    const stanceLag =
      this.moveStance === STANCE_SLIDE
        ? FLOATING_HEAD_SPRING_TUNING.slideLagPx
        : this.moveStance === STANCE_DASH
          ? FLOATING_HEAD_SPRING_TUNING.dashLagPx
          : 0;
    const directionX = movementLength > 0.05 ? localMoveX / movementLength : 1;
    const directionY = movementLength > 0.05 ? moveY / movementLength : 0;
    const airMix = smoothstep01(this.hopPx / 14);
    const input = this.floatingHeadSpringInput;
    input.targetX = targetX;
    input.targetY = targetY;
    input.authoredOffsetX =
      this.floatingHeadAttackLead.x - directionX * stanceLag + this.flourishHeadX;
    input.authoredOffsetY =
      movementHeadBobPx +
      this.floatingHeadAttackLead.y -
      directionY * stanceLag * 0.7 -
      FLOATING_HEAD_SPRING_TUNING.airHangPx * airMix +
      FLOATING_HEAD_SPRING_TUNING.landingDipPx * this.landSquash +
      this.flourishHeadY;
    input.impulseX = -localSpringSignalX * 72 * elapsedSeconds;
    input.impulseY =
      -springSignalY * 64 * elapsedSeconds +
      (landed ? 7 * Math.min(1.5, this.landingKickScale) : 0);
    input.elapsedSeconds = elapsedSeconds;
    input.reducedMotion = reducedMotion;
    input.reset = rebase || this.floatingHeadLodSleeping;
    stepFloatingHeadSpring(this.floatingHeadSpring, input);
    this.floatingHeadLodSleeping = false;
    const determinantSign = this.body.scaleX * this.body.scaleY < 0 ? -1 : 1;
    const headMountScale = boilerplateSource
      ? (this.gearAssembly?.headMountScale ??
        boilerplateSource.source.mountScale ??
        HEAD_MOUNT_SCALE)
      : 1;
    head
      .setPosition(this.floatingHeadSpring.x, this.floatingHeadSpring.y)
      .setRotation(this.body.rotation + determinantSign * (boilerplateSource?.rotation ?? 0))
      .setScale(this.body.scaleX * headMountScale, this.body.scaleY * headMountScale)
      .setVisible(true);
  }

  /** Head/face receivers layer their own angular springs over the final sprung head transform. */
  private placeHeadGear(attachment: GearAttachment): void {
    const manifest = this.boilerplateManifest;
    const head = this.boilerplateHead;
    const headSource = this.boilerplateHeadAssembly;
    if (!manifest || !head || !headSource) return;
    const spec = attachment.spec;
    const anchor = headSource.source.receiverAnchor;
    const localX = (spec.source.receiverAnchor.xL - anchor.xL) * manifest.socketFrame.bodyHeightL;
    const localY = (spec.source.receiverAnchor.yL - anchor.yL) * manifest.socketFrame.bodyHeightL;
    // Hats use the base-head authoring band, so divide out the same effective scale applied to the
    // replacement head. Face riders deliberately keep it and therefore follow the normalized face.
    const headMountScale =
      this.gearAssembly?.headMountScale ?? headSource.source.mountScale ?? HEAD_MOUNT_SCALE;
    const parentScaleX =
      spec.source.receiver === "head" ? head.scaleX / headMountScale : head.scaleX;
    const parentScaleY =
      spec.source.receiver === "head" ? head.scaleY / headMountScale : head.scaleY;
    const dx = localX * parentScaleX;
    const dy = localY * parentScaleY;
    const cosine = Math.cos(head.rotation);
    const sine = Math.sin(head.rotation);
    const determinantSign = parentScaleX * parentScaleY < 0 ? -1 : 1;
    attachment.image
      .setPosition(head.x + cosine * dx - sine * dy, head.y + sine * dx + cosine * dy)
      .setRotation(head.rotation + determinantSign * (spec.rotation + attachment.angle))
      .setScale(
        parentScaleX * spec.source.mountScale * spec.stackScale,
        parentScaleY * spec.source.mountScale * spec.stackScale,
      )
      .setVisible(true);
  }

  private placeBodyGear(attachment: GearAttachment): void {
    const manifest = this.boilerplateManifest;
    if (!manifest) return;
    const spec = attachment.spec;
    const localX = spec.source.receiverAnchor.xL * manifest.socketFrame.bodyHeightL;
    const localY = spec.source.receiverAnchor.yL * manifest.socketFrame.bodyHeightL;
    const dx = localX * this.body.scaleX;
    const dy = localY * this.body.scaleY;
    const cosine = Math.cos(this.body.rotation);
    const sine = Math.sin(this.body.rotation);
    const determinantSign = this.body.scaleX * this.body.scaleY < 0 ? -1 : 1;
    attachment.image
      .setPosition(this.body.x + cosine * dx - sine * dy, this.body.y + sine * dx + cosine * dy)
      .setRotation(this.body.rotation + determinantSign * (spec.rotation + attachment.angle))
      .setScale(
        this.body.scaleX * spec.source.mountScale * spec.stackScale,
        this.body.scaleY * spec.source.mountScale * spec.stackScale,
      )
      .setVisible(true);
  }

  private placeNodeGear(attachment: GearAttachment): void {
    const receiver = attachment.spec.source.receiver;
    const handReplaced =
      (receiver === "hand-l" || receiver === "hand-r") && this.weaponReplacesHandReceiver(receiver);
    let node: Phaser.GameObjects.Image | undefined;
    if (receiver === "hand-l" || receiver === "hand-r") {
      const front = receiver === "hand-r";
      for (const hand of this.hands) {
        if (hand.front !== front) continue;
        node = hand.img;
        break;
      }
    } else if (receiver === "foot-l" || receiver === "foot-r") {
      const front = receiver === "foot-r";
      for (const foot of this.feet) {
        if (foot.front !== front) continue;
        node = foot.img;
        break;
      }
    }
    if (!node) return;
    const determinantSign = node.scaleX * node.scaleY < 0 ? -1 : 1;
    attachment.image
      .setPosition(node.x, node.y)
      .setRotation(node.rotation + determinantSign * (attachment.spec.rotation + attachment.angle))
      .setScale(
        node.scaleX * attachment.spec.source.mountScale,
        node.scaleY * attachment.spec.source.mountScale,
      )
      .setVisible(!handReplaced);
  }

  private topSocketPosition(attachment: GearAttachment, out: { x: number; y: number }): void {
    const top = attachment.spec.topSocketSource;
    if (!top) {
      out.x = attachment.image.x;
      out.y = attachment.image.y - TARGET_BODY_H * attachment.spec.stackScale * 0.5;
      return;
    }
    const localX = (top.x - attachment.spec.source.pivotSource.x) * attachment.image.scaleX;
    const localY = (top.y - attachment.spec.source.pivotSource.y) * attachment.image.scaleY;
    const cosine = Math.cos(attachment.image.rotation);
    const sine = Math.sin(attachment.image.rotation);
    out.x = attachment.image.x + cosine * localX - sine * localY;
    out.y = attachment.image.y + sine * localX + cosine * localY;
  }

  /** Final-pose wardrobe pass. Offscreen rigs retain their last transforms and rebase springs on wake. */
  private syncGearPose(
    elapsedSeconds: number,
    outsidePaperView: boolean,
    rebase: boolean,
    reducedMotion: boolean,
    excitation: number,
    dashLean: number,
    landed: boolean,
  ): void {
    if (!this.boilerplateReady) return;
    this.syncGearArt();
    if (outsidePaperView) {
      this.gearLodSleeping = true;
      return;
    }
    const waking = this.gearLodSleeping;
    this.gearLodSleeping = false;

    for (const attachment of this.gearAttachments) {
      if (attachment.spec.stackIndex >= 0) continue;
      const spring = attachment.spec.source.spring;
      if (spring) {
        const limit = (spring.maxDeg * Math.PI) / 180;
        const target = reducedMotion
          ? 0
          : Math.max(-limit, Math.min(limit, excitation * limit * spring.dragGain));
        if (rebase || waking) {
          attachment.angle = 0;
          attachment.velocity = 0;
        } else {
          stepGearAngularSpring(attachment, target, elapsedSeconds, spring.hz, spring.dampingRatio);
        }
      }
      const receiver = attachment.spec.source.receiver;
      if (
        receiver === "hand-l" ||
        receiver === "hand-r" ||
        receiver === "foot-l" ||
        receiver === "foot-r"
      )
        this.placeNodeGear(attachment);
      else if (receiver === "head" || receiver === "face.eyes" || receiver === "face.mouth")
        this.placeHeadGear(attachment);
      else this.placeBodyGear(attachment);
    }

    const head = this.boilerplateHead;
    const headSource = this.boilerplateHeadAssembly;
    const chainInput = this.hatChainInput;
    chainInput.excitation = excitation;
    chainInput.dashLean = dashLean;
    chainInput.bodyAngle = head?.rotation ?? this.body.rotation;
    chainInput.landingImpulse = landed ? -0.42 : 0;
    chainInput.reducedMotion = reducedMotion;
    chainInput.reset = rebase || waking;
    stepHatSpringChain(this.hatAttachments, elapsedSeconds, chainInput);
    const socket = this.gearSocketScratch;
    for (let index = 0; index < this.hatAttachments.length; index++) {
      const attachment = this.hatAttachments[index];
      if (!attachment) continue;
      if (index === 0) this.placeHeadGear(attachment);
      else {
        const below = this.hatAttachments[index - 1];
        if (!below || !head || !headSource) continue;
        this.topSocketPosition(below, socket);
        const headMountScale =
          this.gearAssembly?.headMountScale ?? headSource.source.mountScale ?? HEAD_MOUNT_SCALE;
        const basisScaleX = head.scaleX / headMountScale;
        const basisScaleY = head.scaleY / headMountScale;
        const determinantSign = basisScaleX * basisScaleY < 0 ? -1 : 1;
        attachment.image
          .setPosition(socket.x, socket.y)
          .setRotation(
            head.rotation + determinantSign * (attachment.spec.rotation + attachment.angle),
          )
          .setScale(
            basisScaleX * attachment.spec.source.mountScale * attachment.spec.stackScale,
            basisScaleY * attachment.spec.source.mountScale * attachment.spec.stackScale,
          )
          .setVisible(true);
      }
    }
    const cap = this.hatOverflowLabel;
    const topHat = this.hatAttachments[this.hatAttachments.length - 1];
    if (cap && topHat) {
      this.topSocketPosition(topHat, socket);
      const inv = 1 / (this.baseScale || 1);
      cap
        .setPosition(socket.x, socket.y - 2)
        .setRotation(-this.root.rotation)
        .setScale(screenTrueScaleX(this.root.scaleX, this.root.scaleY, inv), inv)
        .setVisible(true);
    } else cap?.setVisible(false);
  }

  animate(timeMs: number, anim: RigAnim): void {
    this.installBoilerplateIfReady();
    this.refreshPoseLanguageSelection(true);
    const t = timeMs / 1000 + this.phase;
    // §7 v0.105 de-clunk: derive a frame dt from the (freeze-paused) animation clock for the eased blends,
    // clamped so a hit-stop gap or first frame can't produce a jump.
    // §7 v0.112 clamp to [0,100]: a scene restart / clock reset can make timeMs < prevAnimMs → a NEGATIVE dt
    // that would flip the exponential-blend signs and blow every eased value to infinity. Never allow that.
    const firstAnim = this.prevAnimMs < 0;
    const rawDtMs = firstAnim ? 16 : timeMs - this.prevAnimMs;
    const dtMs = Math.max(0, Math.min(100, rawDtMs));
    this.prevAnimMs = timeMs;
    const s = this.scale;
    const sceneNow = timeMs;
    const springDtS = Math.min(JIGGLE_MAX_DT_S, dtMs / 1000);
    const rootDx = this.root.x - this.jigglePrevRootX;
    const rootDy = this.root.y - this.jigglePrevRootY;
    const rootCut = Math.hypot(rootDx, rootDy) > INTERP_SNAP_PLAYER;
    const jiggleRebase = firstAnim || rawDtMs <= 0 || rawDtMs > JIGGLE_MAX_DT_S * 1000 || rootCut;
    this.jigglePrevRootX = this.root.x;
    this.jigglePrevRootY = this.root.y;
    const view = this.scene.cameras.main.worldView;
    const outsidePaperView =
      !anim.isSelf &&
      (this.root.x < view.left - JIGGLE_LOD_MARGIN_PX ||
        this.root.x > view.right + JIGGLE_LOD_MARGIN_PX ||
        this.root.y < view.top - JIGGLE_LOD_MARGIN_PX ||
        this.root.y > view.bottom + JIGGLE_LOD_MARGIN_PX);
    const jiggleLodSkip = PROCEDURAL_JIGGLE && outsidePaperView;
    const currentMoveLength = Math.hypot(anim.moveX, anim.moveY);
    const currentMoveActive = currentMoveLength > 0.15 || (anim.speed ?? 0) > MOVE_SPEED * 0.12;
    const cancellationMoveX = anim.isSelf ? (anim.desiredMoveX ?? 0) : anim.moveX;
    const cancellationMoveY = anim.isSelf ? (anim.desiredMoveY ?? 0) : anim.moveY;
    const cancellationMoveLength = Math.hypot(cancellationMoveX, cancellationMoveY);
    const cancellationMoveActive = cancellationMoveLength > 0.001;
    const cancellationMoveUnitX = cancellationMoveActive
      ? cancellationMoveX / cancellationMoveLength
      : 0;
    const cancellationMoveUnitY = cancellationMoveActive
      ? cancellationMoveY / cancellationMoveLength
      : 0;
    const localAttackIntent =
      anim.isSelf && this.scene.input?.activePointer?.rightButtonDown?.() === true;
    const flourishAttackIntent = anim.fireHeld === true || localAttackIntent;
    const flourishAttackReleased = this.flourishAttackIntentHeld && !flourishAttackIntent;
    this.flourishAttackIntentHeld = flourishAttackIntent;
    const flourishActive = this.flourishChannels[0].active || this.flourishChannels[1].active;
    const flourishArmed = this.flourishArms[0].armed || this.flourishArms[1].armed;
    const movementOnsetOrHardChange =
      !anim.isSelf &&
      flourishActive &&
      flourishMovementIntent(
        this.flourishMoveX,
        this.flourishMoveY,
        cancellationMoveUnitX,
        cancellationMoveUnitY,
      );
    const reducedMotion = anim.reducedMotion === true;
    const idleFlourishWallNow = this.idleFlourishTimerNow(sceneNow);
    if (!this.flourishReducedReady) {
      this.flourishReducedMotion = reducedMotion;
      this.flourishReducedReady = true;
    } else if (this.flourishReducedMotion !== reducedMotion) {
      this.flourishReducedMotion = reducedMotion;
      if (flourishActive) {
        for (const channel of this.flourishChannels) if (channel.active) channel.startMs = sceneNow;
      }
      for (const proxy of this.stowProxies) if (proxy.img) proxy.startMs = sceneNow;
    }
    const beamEnded = this.flourishFireHeld && !anim.fireHeld && !!this.weaponDef?.beam;
    this.flourishFireHeld = anim.fireHeld === true;
    if (cancellationMoveActive || flourishAttackIntent || flourishAttackReleased) {
      this.idleFlourishEligibleAtMs = idleFlourishEligibleEpoch(
        this.idleFlourishClockDef(),
        idleFlourishWallNow,
        this.idleFlourishOffsetMs,
        this.gunRecoveryWallUntilMs,
      );
    }
    const flourishClockCut =
      outsidePaperView || rootCut || rawDtMs <= 0 || rawDtMs > JIGGLE_MAX_DT_S * 1000;
    if (flourishClockCut || this.downed || this.ultimatePhase !== UltimatePhase.Idle) {
      this.resetFlourishState(false, flourishClockCut);
      if (this.downed || this.ultimatePhase !== UltimatePhase.Idle)
        this.comboStageTransition = undefined;
    } else if (
      flourishAttackIntent ||
      movementOnsetOrHardChange ||
      (flourishArmed && cancellationMoveActive) ||
      (anim.moveStance ?? STANCE_NONE) !== STANCE_NONE
    ) {
      this.cancelFlourish("anim-input");
    }
    this.flourishMoveX = cancellationMoveUnitX;
    this.flourishMoveY = cancellationMoveUnitY;
    if (beamEnded && !outsidePaperView && this.weaponDef) {
      this.armAfterAttack(0, sceneNow + 90, this.weaponDef);
    }
    this.flushObservedAttackSignature(sceneNow, outsidePaperView);
    this.prepareFiringFrames();
    this.prepareTomeVisual(sceneNow, outsidePaperView);

    // Landing is measured before part integration so the one-shot compression enters this frame's springs;
    // the final art lift/shadow pass remains last. With the rollback flag off the arithmetic/order of writes
    // is unchanged because no earlier target reads hopPx or landSquash.
    const nextStance = anim.moveStance ?? STANCE_NONE;
    let slideRecovered = false;
    if (nextStance !== this.moveStance) {
      if (this.moveStance === STANCE_SLIDE) {
        slideRecovered = true;
        this.landedFromStance = STANCE_SLIDE;
        this.landedAtMs = timeMs;
      }
      if (this.moveStance !== STANCE_NONE && this.moveStance !== STANCE_SLIDE)
        this.airStance = this.moveStance;
      this.moveStance = nextStance;
      this.stanceStartedMs = timeMs;
      if (nextStance !== STANCE_NONE) this.comboStageTransition = undefined;
    }
    if (this.enemyComboOwnsHop) this.hopTarget = this.enemyComboHopPx;
    if (this.hopTarget > GROUND_EPSILON && this.lastPoseHopTarget <= GROUND_EPSILON) {
      this.jumpStartedMs = timeMs;
      this.peakHopPx = this.hopTarget;
      this.maxFallSpeed = 0;
    }
    this.lastPoseHopTarget = this.hopTarget;
    this.peakHopPx = Math.max(this.peakHopPx, this.hopTarget, this.hopPx);
    if ((anim.jumpVh ?? 0) < 0)
      this.maxFallSpeed = Math.max(this.maxFallSpeed, -(anim.jumpVh ?? 0));
    if (nextStance !== STANCE_NONE && this.hopTarget > GROUND_EPSILON) this.airStance = nextStance;

    const prevHop = this.hopPx;
    if (this.enemyComboOwnsHop) this.hopPx = this.hopTarget;
    else this.hopPx += (this.hopTarget - this.hopPx) * (1 - Math.exp((-22 * dtMs) / 1000));
    if (this.hopPx < 0.05 && this.hopTarget < 0.05) this.hopPx = 0;
    const landed = prevHop > 6 && this.hopPx <= 6 && this.hopTarget < 1;
    if (landed) {
      const landingStance = this.airStance;
      const tier = landingThumpTier(
        this.maxFallSpeed,
        landingStance === STANCE_DASH ? MOVE_SPEED : 0,
        landingStance === STANCE_DASH || landingStance === STANCE_POUND,
      );
      this.landSquash = 1;
      this.landingSquashDepth = tier === 1 ? 0.1 : tier === 2 ? 0.18 : 0.26;
      this.landingKickScale = tier === 1 ? 1 : tier === 2 ? 1.4 : 2;
      this.landedFromStance = landingStance;
      this.landedAtMs = timeMs;
      this.airStance = STANCE_NONE;
      this.peakHopPx = 0;
      this.maxFallSpeed = 0;
    }
    this.landSquash = Math.max(0, this.landSquash - dtMs / 150);
    // The active counter resets as soon as readyAt+grace lapses. Its last authored guard remains only as a
    // 120ms cosmetic release; it cannot make a late trigger continue because family/weapon are already clear.
    if (this.comboFamily !== "none" && sceneNow > this.comboExpiresAtMs)
      this.resetComboChain(false);
    if (this.comboHoldPose && sceneNow >= this.comboHoldPose.expiresAtMs + COMBO_HOLD_RELEASE_MS)
      this.comboHoldPose = undefined;

    // §7 v0.105 GAIT: ease a 0..1 gait toward the real render speed (speed/MOVE_SPEED). Stride/lift/lean all
    // scale by it, so the walk ramps in + fully fades out with speed instead of a binary flag that ran the
    // full-stride jog for ~1.3s after key-release (and teleported a foot on the flip to idle).
    const targetGait = Math.min(1, (anim.speed ?? 0) / MOVE_SPEED);
    this.gait += (targetGait - this.gait) * (1 - Math.exp((-8 * dtMs) / 1000)); // τ≈125ms
    const gait = this.gait;

    // §7 v0.111 TURN-COMMIT ("pull the reins"): when the run HEADING swings hard, fire a one-time decaying
    // punch toward the new direction — the WEIGHT of committing to a turn, shown in animation (the trajectory
    // is untouched). Refractory via `turnCommit` so it fires ONCE per turn, not every frame while the tracked
    // heading catches up. Sharper turn (smaller dot) → bigger pull; a full reversal → a full-strength haul.
    let turnTriggered = false;
    this.turnCommit = Math.max(0, this.turnCommit - dtMs / 1000 / 0.24); // decays over ~0.24s
    const mvLen = Math.hypot(anim.moveX, anim.moveY);
    if (mvLen > 0.15) {
      const nx = anim.moveX / mvLen;
      const ny = anim.moveY / mvLen;
      // A start from rest establishes heading without treating left as a reversal of the +X constructor
      // default. Only an already-established moving heading can trigger the turn-commit performance.
      if (firstAnim || gait <= 0.4) {
        this.headingX = nx;
        this.headingY = ny;
      } else {
        const dot = nx * this.headingX + ny * this.headingY; // 1 = same way … −1 = reversal
        if (dot < 0.72 && this.turnCommit < 0.06) {
          turnTriggered = true;
          this.turnCommit = Math.min(1, (1 - dot) * 0.9);
          this.turnDirX = nx;
          this.turnDirY = ny;
          this.headingX = nx; // snap the tracked heading so the change doesn't re-trigger next frame
          this.headingY = ny;
        }
        const hk = 1 - Math.exp((-6 * dtMs) / 1000);
        this.headingX += (nx - this.headingX) * hk;
        this.headingY += (ny - this.headingY) * hk;
      }
    }
    const commit = this.turnCommit;

    // §7 v0.112 PROCEDURAL GAIT: track the render velocity at two smoothings; their difference is an inertia
    // signal (nonzero only while the speed is CHANGING) that trails the limbs behind the body — free-moving
    // weight that reacts to input, not a hard-set loop. `strideT` accumulates by DISTANCE so the step cadence
    // matches real speed exactly (and freezes when you stop). `lagX/Y` are ~[-1,1] world-space inertia.
    const dtS = Math.max(0.001, dtMs / 1000);
    const spd = anim.speed ?? 0;
    const rvx = anim.moveX * spd;
    const rvy = anim.moveY * spd;
    this.velX += (rvx - this.velX) * (1 - Math.exp(-26 * dtS)); // fast (τ≈38ms)
    this.velY += (rvy - this.velY) * (1 - Math.exp(-26 * dtS));
    this.slowVelX += (rvx - this.slowVelX) * (1 - Math.exp(-7 * dtS)); // slow (τ≈140ms)
    this.slowVelY += (rvy - this.slowVelY) * (1 - Math.exp(-7 * dtS));
    const lagX = Math.max(-1.4, Math.min(1.4, (this.velX - this.slowVelX) / MOVE_SPEED));
    const lagY = Math.max(-1.4, Math.min(1.4, (this.velY - this.slowVelY) / MOVE_SPEED));
    let springSignalX = 0;
    let springSignalY = 0;
    if (PROCEDURAL_JIGGLE) {
      if (!this.jiggleRootReady || jiggleRebase || jiggleLodSkip) {
        this.jiggleSignalX = 0;
        this.jiggleSignalY = 0;
        this.jiggleRootReady = true;
      } else {
        // Snapshot rigs get the panel's slower 14/s conditioner; self prediction keeps the current 26/s feel.
        const filterHz = anim.isSelf ? JIGGLE_SELF_FILTER_HZ : JIGGLE_REMOTE_FILTER_HZ;
        const k = 1 - Math.exp(-filterHz * springDtS);
        this.jiggleSignalX += (lagX - this.jiggleSignalX) * k;
        this.jiggleSignalY += (lagY - this.jiggleSignalY) * k;
        springSignalX =
          Math.abs(this.jiggleSignalX) < JIGGLE_SIGNAL_DEAD_ZONE ? 0 : this.jiggleSignalX;
        springSignalY =
          Math.abs(this.jiggleSignalY) < JIGGLE_SIGNAL_DEAD_ZONE ? 0 : this.jiggleSignalY;
      }
    }
    this.strideT += ((spd * dtS) / this.movementPostureInput.spec.strideLengthPx) * Math.PI * 2;
    if (this.strideT > Math.PI * 2e6) this.strideT -= Math.PI * 2e6; // keep it bounded over a long session
    const legPh = this.strideT;

    // Facing: toward the cursor for the local player, else toward movement (but a GUN-holder faces their
    // AIM even remotely, so the barrel + body read as pointing where they shoot). Mirror the whole
    // container; per-part offsets/aim are computed in local space so the flip stays coherent.
    const tellFacesAim =
      (this.meleeTellMode === "windup" && this.meleeTellFull) ||
      ((this.meleeTellMode === "resolve" || this.meleeTellMode === "cancel") &&
        this.meleeTellReleasePose);
    const comboFacesAim = this.enemyComboOfferPhase > 0 || this.enemyComboEmpowered;
    const dirX =
      tellFacesAim || comboFacesAim
        ? Math.cos(tellFacesAim ? this.meleeTellAimWorld : this.enemyComboAimWorld)
        : anim.isSelf
          ? anim.aimX
          : this.weaponDef && usesAimedFiringStance(this.weaponDef)
            ? Math.cos(anim.aimDir)
            : anim.moveX;
    // §37 facing flip. SELF: commit on the RAW pixel offset of the cursor from the character's midpoint
    // (±6px hysteresis kills strobe at the exact centre) — a normalized-|aimX| threshold went sticky when the
    // cursor sat far above/below (|aimX|≈0 however clearly the midpoint was crossed). Remotes/enemies keep the
    // small normalized deadzone (they aim from synced angles/movement, not a cursor).
    if (anim.isSelf && anim.aimDxPx !== undefined) {
      if (Math.abs(anim.aimDxPx) > 6) this.facing = anim.aimDxPx >= 0 ? 1 : -1;
    } else if (Math.abs(dirX) > 0.05) {
      this.facing = dirX >= 0 ? 1 : -1;
    }
    // §7 v0.105 de-clunk: EASE the visual mirror toward the committed facing, passing through scaleX≈0 —
    // that reads as a TURN, not a one-frame full-body flip. UNIFORM baseScale on both axes = a pure mirror,
    // never a stretch, so the hand-painted art keeps its aspect ratio at any size (§28.4).
    if (firstAnim) this.facingBlend = this.facing;
    else this.facingBlend += (this.facing - this.facingBlend) * (1 - Math.exp((-12 * dtMs) / 1000));
    const movementInput = this.movementPostureInput;
    movementInput.facing = this.facing;
    movementInput.moveX = anim.moveX;
    movementInput.lagX = lagX;
    movementInput.lagY = lagY;
    movementInput.gait = gait;
    movementInput.stridePhase = legPh;
    movementInput.reducedMotion = reducedMotion;
    const movementPose = sampleMovementPosture(movementInput, this.movementPostureSample);
    if (outsidePaperView && this.spawnStartMs >= 0) this.spawnStartMs = -1;
    const spawnElapsedMs =
      this.spawnStartMs >= 0 ? timeMs - this.spawnStartMs : Number.POSITIVE_INFINITY;
    const spawnActive = spawnElapsedMs < this.spawnDurationMs + 38;
    const spawnScaleX = spawnActive ? paperPopScaleX(spawnElapsedMs, this.spawnDurationMs) : 1;
    const spawnScaleY = spawnActive ? paperPopScaleY(spawnElapsedMs, this.spawnDurationMs) : 1;
    const spawnRotation = spawnActive ? paperPopRotation(spawnElapsedMs, this.spawnDurationMs) : 0;
    if (!spawnActive && this.spawnStartMs >= 0) this.spawnStartMs = -1;
    this.root.scaleX = this.facingBlend * this.baseScale * spawnScaleX;
    this.root.scaleY = this.baseScale * spawnScaleY;
    this.root.rotation = spawnRotation;
    this.applyUltimateRootPresentation(timeMs);
    // Keep the "you" label a FIXED on-screen size + readable regardless of the character's rig scale: the
    // label is a child of the root (scaled by baseScale), so counter baseScale on both axes — else a bigger
    // character blows the text up (weapons counter the same way, §29). scaleX also counters the facing mirror.
    if (this.label) {
      const inv = 1 / (this.baseScale || 1);
      this.label.scaleX = screenTrueScaleX(this.root.scaleX, this.root.scaleY, inv);
      this.label.scaleY = inv;
    }

    // Vertical "look" toward the cursor — local player only (others have no synced aim). aimY is screen
    // space (−up / +down) and is NOT touched by the facing mirror, so it leans correctly both ways.
    const lookY = anim.isSelf ? Math.max(-1, Math.min(1, anim.aimY)) : 0;

    // §7 v0.112 Bob + squash/stretch: the bob is STRIDE-synced when moving (two dips per stride = one per
    // footfall) and a slow breathing sway when idle — so it never runs a fixed loop out of step with the feet.
    const idleBob = reducedMotion ? 0 : (1 - gait) * Math.sin(t * 2.2) * 0.55;
    // Signed attack pitch is applied late; reset detached-part scale so it never compounds frame-to-frame.
    for (const hand of this.hands) hand.img.setScale(s);
    for (const foot of this.feet) foot.img.setScale(s);
    this.body.x = 0;
    this.body.y = (movementPose.bodyBobPx + idleBob * 12) * s;
    this.body.scaleX =
      s * (1 + movementPose.bodyBounce * movementInput.spec.bodyBounceX + idleBob * 0.04);
    this.body.scaleY =
      s * (1 - movementPose.bodyBounce * movementInput.spec.bodyBounceY - idleBob * 0.06);
    // Local movement/lag own the paper-card pitch; the root's signed scale performs the only mirror.
    this.body.rotation = movementPose.bodyRotationRad + lookY * BODY_LOOK_LEAN;

    // §20 momentum FLINCH (Stage A): the torso leans + jolts with the impulse shove (gun recoil / hit
    // knockback). The whole body already slides via the server position; this is the additive flinch on
    // top so the push reads as weight, not a teleport. Same world axes as the movement lean above.
    const rcx = anim.recoilX ?? 0;
    const rcy = anim.recoilY ?? 0;
    const rk = Math.min(1, Math.hypot(rcx, rcy) / 520);
    if (rk > 0.01) {
      this.comboStageTransition = undefined; // damage recoil must read on the first presented frame
      this.body.rotation += Math.max(-1, Math.min(1, rcx / 520)) * 0.22;
      this.body.y += Math.max(-1, Math.min(1, rcy / 520)) * 5 * s;
      this.body.scaleX *= 1 + rk * 0.06;
    }

    // §7 v0.111 turn-commit BODY: an exaggerated one-time lean + plant-dip into the new heading (decays), on
    // top of the steady movement lean above — reads as the rider hauling into the turn, then settling.
    if (commit > 0.01) {
      this.body.rotation += this.turnDirX * this.facing * commit * 0.5;
      this.body.y += (3 + this.turnDirY * 4) * commit * s; // plant/dip (a touch more when turning downward)
      this.body.scaleY *= 1 - commit * 0.06; // brief squash as the weight lands
    }

    // Parry BRACE (§8): a quick snap into a guard, hold through the i-frame window, ease out. Folds
    // into the weapon angle + hand positions below so the whole body reads as a block.
    let brace = 0;
    {
      const bel = timeMs - this.braceStart;
      const bdur = SpriteRig.BRACE_DUR; // ≈ PARRY_IFRAMES (0.45s)
      if (bel >= 0 && bel < bdur) {
        const tt = bel / bdur;
        brace = tt < 0.18 ? tt / 0.18 : tt > 0.7 ? 1 - (tt - 0.7) / 0.3 : 1;
      }
    }
    if (brace > 0) {
      this.body.y += brace * s * 7; // dip into the brace
      this.body.scaleY *= 1 - brace * 0.05; // slight squash
    }

    // Weapon angle — guns and melee both honor semantic +X/aim. Swing choreography may travel through
    // vertical, but neutral and held guards return to a small forward cant.
    let weaponAngle = 0;
    let weaponThicknessSign: -1 | 1 = 1;
    let backWeaponAngle = Number.NaN;
    let ownFront = 0;
    let ownBack = 0;
    let ownFeet = 0;
    let rangedAimBlend = 0;
    let activeBladeStance: BladeSizeStance | NamedWeaponStance | undefined;
    let activeNamedStance: NamedWeaponStance | undefined;
    const leadFiringStance = this.weaponDef ? firingStanceFor(this.weaponDef) : undefined;
    const hasAimedFiringWeapon = this.weapons.some((weapon) => usesAimedFiringStance(weapon.def));
    this.orbitT = -1; // §40 re-armed below only while an orbit-style swing window is live
    this.orbitSpin = false;
    this.swingOffX = 0;
    this.swingOffY = 0;
    this.swingBackOffX = 0;
    this.swingBackOffY = 0;
    this.pairWeaponScaleX[0] = 1;
    this.pairWeaponScaleX[1] = 1;
    this.pairGlintAlpha = 0;
    this.attackArtOffX = 0;
    this.attackArtOffY = 0;
    this.attackLiftPx = 0;
    this.attackScaleY = 1;
    this.weaponLengthScale = 1;
    this.attackWeaponDepth = 0;
    this.attackShadowX = 0;
    this.attackShadowY = 0;
    this.attackShadowRotation = 0;
    this.attackShadowScaleX = 1;
    this.attackShadowScaleY = 1;
    this.attackShadowAlpha = 1;
    this.attackGripBlend = 0;
    this.attackGripX = 0;
    this.attackGripY = 0;
    this.attackBackGripX = 0;
    this.attackBackGripY = 0;
    this.attackGripBoth = false;
    this.attackHandSpacing = TARGET_BODY_H * (this.poseLeadSpec?.gripSpacing ?? 0.42);
    this.attackFrontGripX = 0;
    this.attackFrontGripY = 0;
    this.attackFrontGripBlend = 0;
    this.attackBackGripBlend = 0;
    this.attackFrontFootX = 0;
    this.attackFrontFootY = 0;
    this.attackFrontFootBlend = 0;
    this.attackBackFootX = 0;
    this.attackBackFootY = 0;
    this.attackBackFootBlend = 0;
    this.closeBladePoseActive = false;
    this.closeBladeBodyX = 0;
    this.closeBladeBodyY = 0;
    this.closeBladeBodyRotation = 0;
    this.closeBladeBodyScaleX = 1;
    this.closeBladeBodyScaleY = 1;
    this.closeBladeFrontHandDx = 0;
    this.closeBladeFrontHandDy = 0;
    this.closeBladeBackHandDx = 0;
    this.closeBladeBackHandDy = 0;
    this.closeBladeFrontFootDx = 0;
    this.closeBladeFrontFootDy = 0;
    this.closeBladeBackFootDx = 0;
    this.closeBladeBackFootDy = 0;
    this.signatureMotion = undefined;
    if (this.meleeTellMode === "resolve" && sceneNow - this.meleeTellReleaseAtMs > 180) {
      this.clearMeleeTellState();
    } else if (this.meleeTellMode === "cancel" && sceneNow - this.meleeTellReleaseAtMs > 90) {
      this.clearMeleeTellState();
    }
    const meleePoseActive =
      (this.meleeTellMode === "windup" && this.meleeTellFull) ||
      ((this.meleeTellMode === "resolve" || this.meleeTellMode === "cancel") &&
        this.meleeTellReleasePose);
    const heldAimWorld = anim.isSelf ? Math.atan2(anim.aimY, anim.aimX) : anim.aimDir;
    const heldAimLocal = Math.atan2(Math.sin(heldAimWorld), Math.cos(heldAimWorld) * this.facing);
    if (meleePoseActive) {
      // Enemy attack archetype owns the pose before the randomly-assigned held weapon. This also suppresses
      // a gun's ordinary muzzle-aim branch while a zoner chambers the stock for its parryable contact lunge.
      const aimLocal = Math.atan2(
        Math.sin(this.meleeTellAimWorld),
        Math.cos(this.meleeTellAimWorld) * this.facing,
      );
      const restA = forwardMeleeReadyAngle(aimLocal);
      const resolveT =
        this.meleeTellMode === "resolve"
          ? clamp01((sceneNow - this.meleeTellReleaseAtMs) / 150)
          : 0;
      const cancelBlend =
        this.meleeTellMode === "cancel"
          ? 1 - smoothstep01((sceneNow - this.meleeTellReleaseAtMs) / 80)
          : 1;
      const phase =
        this.meleeTellMode === "cancel" ? this.meleeTellCancelPhase : this.meleeTellPhase;
      const glintPhase = Math.max(
        0.05,
        Math.min(0.7, 1 - MELEE_GLINT_LEAD_MS / this.meleeTellDurationMs),
      );
      const load = smoothstep01(phase / glintPhase);
      let incoming = 0;
      if (this.meleeTellRemainingMs < MELEE_GLINT_LEAD_MS) {
        incoming =
          this.meleeTellRemainingMs > 90
            ? ((MELEE_GLINT_LEAD_MS - this.meleeTellRemainingMs) / (MELEE_GLINT_LEAD_MS - 90)) *
              0.28
            : 0.28 + ((90 - this.meleeTellRemainingMs) / 90) * 0.67;
      }
      if (this.meleeTellMode === "resolve") incoming = 1;
      incoming = clamp01(incoming);
      const direction = this.meleeTellStep % 3 === 1 ? -1 : 1;
      const finalStep = this.meleeTellStep % 3 === 2;
      const direct = this.meleeTellArchetype === "rusher" || this.meleeTellArchetype === "swarm";
      const shove = this.meleeTellArchetype === "zoner";
      const heavy = this.poseTwoHanded;
      let loadedA: number;
      let contactA = aimLocal;
      let followA: number;
      if (this.meleeTellAirKeep) {
        loadedA = aimLocal + direction * 1.34;
        contactA = aimLocal - direction * 0.42;
        followA = aimLocal - direction * 0.82;
      } else if (direct) {
        loadedA = aimLocal;
        followA = aimLocal;
      } else if (heavy || finalStep) {
        loadedA = finalStep ? -Math.PI / 2 - direction * 0.58 : aimLocal - direction * 1.4;
        contactA = aimLocal + direction * 0.08;
        followA = aimLocal + direction * 0.82;
      } else if (shove) {
        loadedA = aimLocal - direction * 1.02;
        contactA = aimLocal + direction * 0.12;
        followA = aimLocal + direction * 0.68;
      } else {
        loadedA = aimLocal - direction * 1.22;
        contactA = aimLocal + direction * 0.1;
        followA = aimLocal + direction * 0.74;
      }
      let posedA = mixAngle(restA, loadedA, load);
      if (incoming > 0) posedA = mixAngle(loadedA, contactA, incoming);
      if (this.meleeTellMode === "resolve")
        posedA = mixAngle(contactA, followA, smoothstep01(resolveT));
      weaponAngle = mixAngle(restA, posedA, cancelBlend);

      const fx = Math.cos(aimLocal);
      const fy = Math.sin(aimLocal);
      const retract = direct ? 0.24 : shove ? 0.18 : 0.2;
      const advance = direct ? 0.24 : 0.12;
      const travel =
        (-retract * load * (1 - incoming) + advance * incoming + 0.08 * resolveT) *
        TARGET_BODY_H *
        cancelBlend;
      this.swingOffX = fx * travel;
      this.swingOffY = fy * travel - (finalStep ? TARGET_BODY_H * 0.12 * load : 0) * cancelBlend;
      const ownership =
        (this.meleeTellMode === "resolve"
          ? 1 - smoothstep01(resolveT)
          : smoothstep01(phase / Math.max(0.08, glintPhase))) * cancelBlend;
      ownFront = ownership;
      ownBack = heavy ? ownership : Math.max(ownBack, ownership * 0.35);
      ownFeet = ownership;
      this.body.rotation +=
        (-direction * 0.1 * load + direction * 0.24 * incoming + direction * 0.08 * resolveT) *
        cancelBlend;
      this.body.y += (3 * load + 4 * incoming - 2 * resolveT) * s * cancelBlend;
      this.body.scaleY *= 1 - (0.035 * load + 0.07 * incoming) * cancelBlend;
      if (finalStep) this.body.scaleY *= 1 + 0.055 * load * cancelBlend;
      if (this.meleeTellGold) {
        // Escalation is heavier, not hurried: a deeper load and committed forward lean ride the SAME
        // synced windup clock. The root never moves here; bounded server snapshots remain travel truth.
        this.swingOffX -= fx * TARGET_BODY_H * 0.08 * load * cancelBlend;
        this.swingOffY -= fy * TARGET_BODY_H * 0.08 * load * cancelBlend;
        this.body.rotation += direction * 0.08 * load * cancelBlend;
        this.body.y += TARGET_BODY_H * 0.045 * load * cancelBlend;
        this.body.scaleY *= 1 - 0.06 * load * cancelBlend;
        this.body.scaleX *= 1 + 0.04 * load * cancelBlend;
      }
      if (this.meleeTellAirKeep) {
        // Ground-to-sky read: the card and implement rise through contact while both feet stay visibly
        // committed underneath the victim's synced shadow.
        this.attackLiftPx += TARGET_BODY_H * (0.04 * load + 0.16 * incoming) * cancelBlend;
        this.body.scaleY *= 1 + 0.1 * incoming * cancelBlend;
        this.body.scaleX *= 1 - 0.05 * incoming * cancelBlend;
        for (const foot of this.feet) foot.img.y += TARGET_BODY_H * 0.045 * load * cancelBlend;
      }
    } else if (hasAimedFiringWeapon && this.weaponDef && leadFiringStance) {
      if (anim.fireHeld) this.holdRangedAim(sceneNow, RANGED_AIM_LINGER_MS);
      rangedAimBlend = sampleRangedAimBlend(
        sceneNow,
        this.rangedAimRaiseAtMs,
        this.rangedAimActiveUntilMs,
      );
      ownFront = 1; // gun grip/barrel truth is load-bearing; the aim hand never receives spring residual
      if (this.poseTwoHanded || this.weapons.length > 1 || leadFiringStance.castingHand)
        ownBack = 1;
      // GUN: point the BARREL along the aim (live cursor for self, synced `aimDir` for others). No swing —
      // the shot is the muzzle flash. Into the rig's LOCAL space (the container mirror flips x), so the
      // barrel tracks the cursor whichever way the body faces.
      weaponAngle = heldAimLocal;
      if (this.weapons.length > 1) backWeaponAngle = heldAimLocal - this.offWeaponLean();
      if (this.poseTwoHanded && leadFiringStance.family !== "tome") {
        const restSpacing = this.poseLeadSpec?.gripSpacing ?? 0.42;
        this.attackHandSpacing =
          TARGET_BODY_H *
          (restSpacing + (leadFiringStance.twoHandSpacing - restSpacing) * rangedAimBlend);
      }
      this.body.x += TARGET_BODY_H * leadFiringStance.bodyAdvance * rangedAimBlend;
      const hasFistGun = this.weapons.some(
        (weapon) => firingStanceFor(weapon.def).family === "fist-gun",
      );
      this.body.rotation += (hasFistGun ? 0 : leadFiringStance.bodyTurn) * rangedAimBlend;
      const recoilElapsed = sceneNow - this.gunRecoilAtMs;
      if (recoilElapsed >= 0 && recoilElapsed < GUN_RECOIL_ACTIVE_MS) {
        const recoilDef = this.weapons[this.gunRecoilHand]?.def ?? this.weaponDef;
        const recoilStrength = Math.min(1.35, (recoilDef.gun?.recoil ?? 0.0017) / 0.004);
        const shotEnvelope = Math.sin(Math.PI * (recoilElapsed / GUN_RECOIL_ACTIVE_MS));
        const recoil = shotEnvelope * recoilStrength;
        if (firingStanceFor(recoilDef).family === "fist-gun" && this.weapons.length > 1) {
          const lead = fistGunShotHandOffset(0, this.gunRecoilHand, heldAimLocal, shotEnvelope);
          const off = fistGunShotHandOffset(1, this.gunRecoilHand, heldAimLocal, shotEnvelope);
          this.swingOffX = lead.x * TARGET_BODY_H;
          this.swingOffY = lead.y * TARGET_BODY_H;
          this.swingBackOffX = off.x * TARGET_BODY_H;
          this.swingBackOffY = off.y * TARGET_BODY_H;
          if (this.gunRecoilHand === 0) ownBack = 0.78;
          else ownFront = 0.78;
          this.body.rotation += (this.gunRecoilHand === 1 ? -1 : 1) * 0.018 * recoil;
        } else {
          const kick = TARGET_BODY_H * 0.045 * recoil;
          const kickX = -Math.cos(heldAimLocal) * kick;
          const kickY = -Math.sin(heldAimLocal) * kick;
          if (this.gunRecoilHand === 1 && this.weapons.length > 1) {
            this.swingBackOffX = kickX;
            this.swingBackOffY = kickY;
            ownFront = 0.78;
          } else {
            this.swingOffX = kickX;
            this.swingOffY = kickY;
            ownBack = this.weapons.length > 1 ? 0.78 : ownBack;
          }
          this.body.rotation += (this.gunRecoilHand === 1 ? -1 : 1) * 0.018 * recoil;
        }
      }
    } else if (
      this.weaponDef &&
      !this.performanceSpec?.suppressSwing &&
      (this.weapons.length > 0 || (CLIENT_VISUAL_COMBOS && this.weaponDef.id === "fists"))
    ) {
      const def = this.swingWeaponDef ?? this.weaponDef;
      // Rest is aim-relative and constant: no family can silently reintroduce an upright idle policy.
      const restA = forwardMeleeReadyAngle(heldAimLocal);
      weaponAngle = restA;
      // The accepted wall epoch was mapped once; retained combo/tome/source art resumes from the held
      // presentation phase instead of spending hit-stop wall time.
      const el = sceneNow - this.swingStart;
      const style = this.swing?.style;
      const dur = Math.max(
        (this.swing?.poseSeconds ?? 0) * 1000,
        isMonkGloveWeapon(def) ? MONK_FLURRY_MIN_POSE_MS : 0,
      );
      let tt = -1;
      let poseBlend = 1;
      let comboPose: Readonly<MeleeComboStep> | undefined;
      let poseDirection: -1 | 0 | 1 = 1;
      let poseVariant: MeleeComboVariant = "default";
      const hold = this.comboHoldPose;
      const family: RigComboFamily =
        this.swingFamily !== "none" ? this.swingFamily : (hold?.family ?? "none");
      if (this.crossfallActive && hold && el >= 0) {
        comboPose = CROSSFALL_STEP;
        poseVariant = "default";
        poseDirection = 0;
        if (dur > 0 && el < dur) tt = el / dur;
        else if (sceneNow <= hold.expiresAtMs) tt = 1;
        else if (sceneNow < hold.expiresAtMs + COMBO_HOLD_RELEASE_MS) {
          tt = 1;
          poseBlend = 1 - (sceneNow - hold.expiresAtMs) / COMBO_HOLD_RELEASE_MS;
        }
      } else if (CLIENT_VISUAL_COMBOS && family !== "none" && hold?.family === family && el >= 0) {
        const live = this.comboFamily === family;
        const snapshotStep = live ? this.swingStep : hold.step;
        const snapshotVariant = live ? this.swingVariant : hold.variant;
        poseVariant = snapshotVariant;
        poseDirection = live ? this.swingDirection : hold.direction;
        const weaponSelection = meleeComboSelectionFor(def, style);
        const poseSequence =
          weaponSelection?.family === family && weaponSelection.variant === snapshotVariant
            ? weaponSelection.sequence
            : meleeComboSequenceFor(family, snapshotVariant);
        comboPose = poseSequence[snapshotStep];
        if (dur > 0 && el < dur) tt = el / dur;
        else if (sceneNow <= hold.expiresAtMs) tt = 1;
        else if (sceneNow < hold.expiresAtMs + COMBO_HOLD_RELEASE_MS) {
          tt = 1;
          poseBlend = 1 - (sceneNow - hold.expiresAtMs) / COMBO_HOLD_RELEASE_MS;
        }
      } else if (style && el >= 0 && el < dur) {
        tt = el / dur;
      }
      const panelQuakePose =
        poseVariant === "greatsword" ||
        poseVariant === "greatsword-momentum" ||
        poseVariant === "claymore-breach" ||
        poseVariant === "glaive-compass" ||
        poseVariant === "bardiche-hookbreak" ||
        // §50 Driftblade-model adopters: gravechill is a quake carrier — its variant MUST stay in this
        // list or the ground crack detonates on the wrong pose frame. Petalfall carries no quake today;
        // its entry is inert behind the `def.quake` guard but future-safe.
        poseVariant === "nodachi-coldcourt" ||
        poseVariant === "nodachi-petalfall";
      if (comboPose?.timing.impact !== undefined && def.quake && panelQuakePose && tt >= 0) {
        const descriptorImpact = clamp01(
          (this.swing?.impactSeconds ?? 0) / Math.max(1e-6, this.swing?.poseSeconds ?? 1),
        );
        tt = remapPoseTimeAtImpact(tt, comboPose.timing.impact, descriptorImpact);
      }
      const poseHand = comboPose?.choreography?.hand ?? comboPose?.hand;
      if (style && tt >= 0) {
        // Combo parts follow the procedural-jiggle ownership contract: anticipation ramps in, danger is
        // exact, follow-through releases energy, and the cadence hold owns nothing.
        if (comboPose) {
          let ownActiveStart = comboPose.timing.activeStart;
          let ownActiveEnd = comboPose.timing.activeEnd;
          let ownFollowEnd = comboPose.timing.followEnd;
          if (comboPose.motion === "fulcrum-flip") {
            const acceptedImpact = clamp01(
              (this.swing?.impactSeconds ?? 0) / Math.max(1e-6, this.swing?.poseSeconds ?? 1),
            );
            ownActiveEnd = acceptedImpact;
            ownActiveStart = 0.18 + ((0.5 - 0.18) * (acceptedImpact - 0.18)) / (0.66 - 0.18);
            ownFollowEnd = acceptedImpact + ((1 - acceptedImpact) * (0.82 - 0.66)) / (1 - 0.66);
          }
          const own = actionOwnershipAt(tt, ownActiveStart, ownActiveEnd, ownFollowEnd);
          ownFeet = own;
          if (poseHand === "lead" || poseHand === "both") ownFront = own;
          if (poseHand === "off" || poseHand === "both") ownBack = own;
        } else {
          ownFront = 1;
          ownBack = 1;
          ownFeet = 1;
        }
        // §40 SWING-STYLE dispatch — one weapon, ONE animation, drawn from the per-type vocabulary
        // (arc / orbit / chop / pivot / thrust / spin). World aim → local (mirrored) shared by every style.
        const aimW = Number.isNaN(this.swingAimWorld)
          ? anim.isSelf
            ? Math.atan2(anim.aimY, anim.aimX)
            : anim.aimDir
          : this.swingAimWorld;
        const aimLocal = Math.atan2(Math.sin(aimW), Math.cos(aimW) * this.facing);
        const idleWeaponAngle = weaponAngle;
        const bodyBaseRotation = this.body.rotation;
        const bodyBaseY = this.body.y;
        const bodyBaseScaleX = this.body.scaleX;
        const bodyBaseScaleY = this.body.scaleY;
        let swingChannelsRouted = false;
        const poseStyle = comboPose ? comboPresentationStyleFor(family, comboPose.motion) : style;
        // KNOWN STAGE-1 RESIDUAL: every signed reverse/dual/overhead comboPose below is presentation-only;
        // server damage still advances once through its untouched centered, positive single-sweep descriptor.
        if (comboPose?.choreography) {
          sampleKatanaChoreography(comboPose, tt, this.katanaChoreographyPose);
          const sampled = this.katanaChoreographyPose;
          const fx = Math.cos(aimLocal);
          const fy = Math.sin(aimLocal);
          const nx = -fy;
          const ny = fx;
          const weaponX = TARGET_BODY_H * (fx * sampled.weaponForward + nx * sampled.weaponLateral);
          const weaponY = TARGET_BODY_H * (fy * sampled.weaponForward + ny * sampled.weaponLateral);
          const sampledAngle = aimLocal + sampled.weaponAngleOffset;
          if (this.weapons.length > 1 && poseHand === "off") {
            weaponAngle = restA;
            backWeaponAngle = sampledAngle - this.offWeaponLean();
            this.swingBackOffX = weaponX;
            this.swingBackOffY = weaponY;
            swingChannelsRouted = true;
          } else {
            weaponAngle = sampledAngle;
            this.swingOffX = weaponX;
            this.swingOffY = weaponY;
            if (this.weapons.length > 1 && poseHand === "both") {
              backWeaponAngle = sampledAngle + Math.PI - this.offWeaponLean();
              this.swingBackOffX = weaponX - nx * TARGET_BODY_H * 0.14;
              this.swingBackOffY = weaponY - ny * TARGET_BODY_H * 0.14;
              swingChannelsRouted = true;
            }
          }
          this.body.x += TARGET_BODY_H * (fx * sampled.bodyForward + nx * sampled.bodyLateral);
          this.body.y += TARGET_BODY_H * (fy * sampled.bodyForward + ny * sampled.bodyLateral);
          this.body.rotation += sampled.bodyTurn;
          this.body.scaleX *= sampled.bodyScaleX;
          this.body.scaleY *= sampled.bodyScaleY;
          this.attackLiftPx += TARGET_BODY_H * sampled.bodyLift;
          this.root.rotation += sampled.paperRotation;
          this.attackHandSpacing = TARGET_BODY_H * sampled.handSpacing;
          this.weaponLengthScale = sampled.weaponLengthScale;
          if (
            comboPose.ribbon?.fanOutStartScale !== undefined &&
            comboPose.ribbon.fanOutEndScale !== undefined
          ) {
            const fanOutProgress = Phaser.Math.Clamp(
              (tt - comboPose.timing.activeStart) /
                Math.max(0.01, comboPose.timing.activeEnd - comboPose.timing.activeStart),
              0,
              1,
            );
            const audit = globalThis as unknown as {
              __ddB18FanMotionAudit?: Array<Record<string, number | string>>;
            };
            const frames = audit.__ddB18FanMotionAudit;
            if (frames) {
              if (
                !frames.some(
                  (frame) =>
                    frame.weaponId === def.id &&
                    frame.comboStep === this.comboStep &&
                    frame.fanOutProgress === 0,
                )
              ) {
                const foldedScale = comboRibbonFanOutScaleAt(comboPose.ribbon, 0);
                frames.push({
                  weaponId: def.id,
                  comboStep: this.comboStep,
                  poseProgress: 0,
                  fanOutProgress: 0,
                  fanOutScale: foldedScale,
                  weaponLengthScale: foldedScale,
                });
              }
              frames.push({
                weaponId: def.id,
                comboStep: this.comboStep,
                poseProgress: tt,
                fanOutProgress,
                fanOutScale: comboRibbonFanOutScaleAt(comboPose.ribbon, fanOutProgress),
                weaponLengthScale: this.weaponLengthScale,
              });
              if (frames.length > 2_048) frames.splice(0, frames.length - 2_048);
            }
          }
          this.attackWeaponDepth = sampled.weaponDepth;
          this.attackFrontFootX =
            TARGET_BODY_H * (fx * sampled.frontFootForward + nx * sampled.frontFootLateral);
          this.attackFrontFootY =
            TARGET_BODY_H * (fy * sampled.frontFootForward + ny * sampled.frontFootLateral);
          this.attackBackFootX =
            TARGET_BODY_H * (fx * sampled.backFootForward + nx * sampled.backFootLateral);
          this.attackBackFootY =
            TARGET_BODY_H * (fy * sampled.backFootForward + ny * sampled.backFootLateral);
          this.attackFrontFootBlend = Math.max(this.attackFrontFootBlend, ownFeet);
          this.attackBackFootBlend = Math.max(this.attackBackFootBlend, ownFeet);
          this.attackShadowX =
            TARGET_BODY_H * (fx * sampled.shadowForward + nx * sampled.shadowLateral);
          this.attackShadowY =
            TARGET_BODY_H * (fy * sampled.shadowForward + ny * sampled.shadowLateral);
          this.attackShadowRotation = aimLocal + sampled.shadowRotation;
          this.attackShadowScaleX = sampled.shadowScaleX;
          this.attackShadowScaleY = sampled.shadowScaleY;
          this.signatureMotion = comboPose.motion;
        } else if (def.performance?.twirl) {
          // Named twirls own the continuous orbit seam, even when an older presentation combo remains.
          this.orbitT = tt;
          this.orbitSpin = true;
        } else if (
          comboPose?.motion === "falling-gate" ||
          comboPose?.motion === "backswing-wheel" ||
          comboPose?.motion === "runaway-cleave"
        ) {
          weaponAngle = this.applyMomentumCombo(comboPose.motion, tt, aimLocal);
        } else if (
          comboPose?.motion === "highland-gate" ||
          comboPose?.motion === "rising-ward" ||
          comboPose?.motion === "bind-break-cast-off"
        ) {
          weaponAngle = this.applyBreachCombo(comboPose.motion, tt, aimLocal);
        } else if (
          comboPose?.motion === "long-reap" ||
          comboPose?.motion === "shaft-switch" ||
          comboPose?.motion === "compass-rose"
        ) {
          weaponAngle = this.applyCompassCombo(comboPose.motion, tt, aimLocal);
        } else if (
          comboPose?.motion === "headsmans-drop" ||
          comboPose?.motion === "hook-and-haul" ||
          comboPose?.motion === "gallows-turn"
        ) {
          weaponAngle = this.applyHookbreakCombo(comboPose.motion, tt, aimLocal);
        } else if (
          comboPose?.motion === "draw-cut" ||
          comboPose?.motion === "guard-check" ||
          comboPose?.motion === "sentence-fall" ||
          comboPose?.motion === "thunder-fall"
        ) {
          // Cold Court verbs + the shared hang-then-fall chassis (the designer's one-branch, two-paints
          // rule: Voltfang's Thunder is the Sentence with a shorter hang and no length collapse).
          weaponAngle = this.applyGravechillCombo(comboPose.motion, tt, aimLocal);
        } else if (comboPose?.motion === "choked-turn" || comboPose?.motion === "petalfall") {
          weaponAngle = this.applyStormpetalCombo(comboPose.motion, tt, aimLocal);
        } else if (comboPose?.motion === "fulcrum-flip") {
          weaponAngle = this.applyFulcrumFlip(tt, aimLocal);
        } else if (comboPose?.motion === "stinger") {
          weaponAngle = this.applyStinger(tt, aimLocal);
        } else if (comboPose?.motion === "spin-release") {
          weaponAngle = this.applyHeroSpin(tt, aimLocal);
        } else if (comboPose?.motion === "pommel-bash") {
          weaponAngle = this.applyPommelBash(tt, aimLocal);
        } else if (comboPose?.motion === "true-charged-slam") {
          weaponAngle = this.applyTrueChargedSlam(tt, aimLocal);
        } else if (poseStyle === "orbit") {
          // Fake-3D WAIST ORBIT (the facing flip's scale-through-a-plane trick generalized) — flagged here,
          // fully rendered by the weapon pass below (position + rotation + foreshortening + depth swap).
          this.orbitT = tt;
        } else if (poseStyle === "spin") {
          // §40.3 GAREN SPIN — the orbit machinery in whirlwind mode: full revolutions, body mirror-turns.
          this.orbitT = tt;
          this.orbitSpin = true;
        } else if (poseStyle === "chop") {
          // §45 CHOP: shoulder diagonal → reverse rising load → execution slam. Each variation retains the
          // existing lift/drive/squash vocabulary, but its section-B fractions and end guard are authored.
          const pose = comboPose ?? MELEE_COMBO_SEQUENCES.chop[0];
          const reverse = pose?.motion === "reverse-chop";
          const raiseA = reverse ? -Math.PI / 2 + 0.85 : -Math.PI / 2 - 0.85;
          const slamA = (reverse ? Math.PI - 0.85 : 0.85) + lookY * 0.25;
          const lowGuardA = slamA - 0.18;
          const lift = TARGET_BODY_H * 0.2;
          if (pose?.motion === "rising-chop") {
            weaponThicknessSign = comboWeaponThicknessSign(pose);
            const a = pose.timing.activeStart;
            const b = pose.timing.activeEnd;
            if (tt < a) {
              const p = tt / a;
              weaponAngle = lowGuardA + 0.18 * Math.sin(Math.PI * p); // load from step-1's low guard
              this.swingOffY = TARGET_BODY_H * 0.06 * (1 - p * 0.35);
              this.body.rotation += 0.13 * (1 - p) + 0.06 * p;
              this.body.y += (5 + 2 * p) * s;
              this.body.scaleY *= 0.92 + 0.03 * p;
            } else if (tt < b) {
              const p = (tt - a) / (b - a);
              const e = 1 - (1 - p) ** 2;
              weaponAngle = lowGuardA + (raiseA - lowGuardA) * e;
              this.swingOffY = TARGET_BODY_H * 0.04 - (lift + TARGET_BODY_H * 0.04) * e;
              this.body.rotation += 0.06 - 0.25 * e; // mirrored unwind: low/right → high/left
              this.body.y += (7 - 10 * e) * s;
              this.body.scaleY *= 0.95 + 0.1 * e;
            } else {
              const carry = Math.min(1, (tt - b) / (pose.timing.followEnd - b));
              weaponAngle = mixAngle(raiseA, forwardMeleeReadyAngle(aimLocal), carry);
              this.swingOffY = -lift * (1 - carry);
              this.body.rotation -= 0.19 * (1 - carry);
              this.body.y -= 3 * s * (1 - carry);
              this.body.scaleY *= 1 + 0.05 * (1 - carry);
            }
          } else {
            const execution = pose?.motion === "execution-slam";
            const a = pose?.timing.activeStart ?? 0.24;
            const b = pose?.timing.activeEnd ?? CHOP_IMPACT_FRAC;
            const follow = pose?.timing.followEnd ?? 0.66;
            const coilA = execution ? raiseA : -Math.PI / 2 - 0.35; // hang overhead vs weapon shoulder
            const fromA = execution
              ? raiseA
              : pose?.motion === "rest-downswing"
                ? restA
                : lowGuardA;
            if (tt < a) {
              const p = tt / a;
              const e = p * (2 - p);
              weaponAngle = fromA + (coilA - fromA) * e;
              this.swingOffY = execution
                ? -lift * (1 + 0.08 * Math.sin(Math.PI * p))
                : -lift * 0.55 * p;
              this.body.rotation += execution ? -0.18 : 0.12 - 0.25 * e;
              this.body.y += (execution ? -4 - 1.5 * Math.sin(Math.PI * p) : 5 - 7.5 * e) * s;
              this.body.scaleY *= 1 + (execution ? 0.08 : 0.04) * e;
            } else if (tt < b) {
              const p = (tt - a) / (b - a);
              const e = p * p;
              weaponAngle = coilA + (slamA - coilA) * e;
              this.swingOffY = -lift + (lift + TARGET_BODY_H * 0.06) * e;
              this.body.rotation += -0.18 + (execution ? 0.46 : 0.38) * e;
              this.body.y += (-4 + (execution ? 12 : 10) * e) * s;
              this.body.scaleY *= 1.08 - (execution ? 0.2 : 0.17) * e;
            } else if (tt < follow) {
              weaponAngle = slamA;
              this.swingOffY = TARGET_BODY_H * 0.06;
              this.body.rotation += execution ? 0.28 : 0.2;
              this.body.y += (execution ? 8 : 6) * s;
              this.body.scaleY *= execution ? 0.88 : 0.91;
            } else {
              const p = (tt - follow) / (1 - follow);
              const e = p * (2 - p);
              weaponAngle = mixAngle(slamA, forwardMeleeReadyAngle(aimLocal), e);
              this.swingOffY = TARGET_BODY_H * 0.06 * (1 - 0.35 * e);
              this.body.rotation += (execution ? 0.28 : 0.2) - (execution ? 0.16 : 0.08) * e;
              this.body.y += ((execution ? 8 : 6) - (execution ? 3 : 1) * e) * s;
              this.body.scaleY *= (execution ? 0.88 : 0.91) + 0.04 * e;
            }
          }
        } else if (poseStyle === "pivot") {
          // §45 RAKE: the existing diagonal arm-whip alternates lead/off hand, then runs both copies on the
          // authored stagger for a scissor. Dual claws move the actual rear glove; a single claw mirrors its
          // visible arm. Both paths remain cosmetic and share the server's ONE legacy hit application.
          const pose = comboPose ?? MELEE_COMBO_SEQUENCES.rake[0];
          if (pose && (poseVariant === "dagger" || poseVariant === "claw")) {
            const poseSeconds = Math.max(1e-6, this.swing?.poseSeconds ?? 1);
            const serverActiveStart = clamp01(
              (this.swing?.activeStartSeconds ?? poseSeconds * pose.timing.activeStart) /
                poseSeconds,
            );
            const serverActiveEnd = clamp01(
              (this.swing?.activeEndSeconds ?? poseSeconds * pose.timing.activeEnd) / poseSeconds,
            );
            const mountOrigin = isWornWeapon(def) ? 0.4 : def.gripFrac;
            const tipRadius = Math.min(meleeReach(def), PLAYER_RADIUS + TARGET_BODY_H);
            const poseInput = this.closeBladeInput;
            poseInput.t = tt;
            poseInput.serverActiveStart = serverActiveStart;
            poseInput.serverActiveEnd = serverActiveEnd;
            poseInput.aimLocal = aimLocal;
            poseInput.effectiveCooldown = this.swing?.effectiveCooldown ?? def.cooldown;
            poseInput.targetTipRadius = tipRadius;
            poseInput.businessLength = (1 - mountOrigin) * def.displayLength;
            poseInput.rigScale = this.baseScale;
            poseInput.direction = poseDirection;
            poseInput.hand = this.swingHand === 1 ? "off" : pose.hand;
            poseInput.hasRearWeapon = this.weapons.length > 1;
            poseInput.variant = poseVariant;
            sampleCloseBladePose(poseInput, this.closeBladePose);
            const sampled = this.closeBladePose;
            const interruptBlend = 1 - brace;
            weaponAngle = sampled.frontAngle;
            if (this.weapons.length > 1) backWeaponAngle = sampled.backAngle - this.offWeaponLean();
            this.attackFrontGripX = sampled.frontGripX;
            this.attackFrontGripY = sampled.frontGripY;
            this.attackFrontGripBlend = sampled.frontGripBlend * interruptBlend;
            this.attackBackGripX = sampled.backGripX;
            this.attackBackGripY = sampled.backGripY;
            this.attackBackGripBlend = sampled.backGripBlend * interruptBlend;
            this.attackFrontFootX = sampled.frontFootX;
            this.attackFrontFootY = sampled.frontFootY;
            this.attackFrontFootBlend = sampled.frontFootBlend * interruptBlend;
            this.attackBackFootX = sampled.backFootX;
            this.attackBackFootY = sampled.backFootY;
            this.attackBackFootBlend = sampled.backFootBlend * interruptBlend;
            ownFront = sampled.frontOwn * interruptBlend;
            ownBack = sampled.backOwn * interruptBlend;
            swingChannelsRouted = true;
            ownFeet = sampled.feetOwn * interruptBlend;
            this.attackArtOffX = sampled.artX * interruptBlend;
            this.attackArtOffY = sampled.artY * interruptBlend;
            this.attackShadowX = sampled.shadowX * interruptBlend;
            this.attackShadowY = sampled.shadowY * interruptBlend;
            this.attackShadowRotation = sampled.shadowRotation * interruptBlend;
            this.attackShadowScaleX = 1 + (sampled.shadowScaleX - 1) * interruptBlend;
            this.attackShadowScaleY = 1 + (sampled.shadowScaleY - 1) * interruptBlend;
            this.closeBladeBodyX = sampled.bodyX * interruptBlend;
            this.closeBladeBodyY = sampled.bodyY * interruptBlend;
            this.closeBladeBodyRotation = sampled.bodyRotation * interruptBlend;
            this.closeBladeBodyScaleX = 1 + (sampled.bodyScaleX - 1) * interruptBlend;
            this.closeBladeBodyScaleY = 1 + (sampled.bodyScaleY - 1) * interruptBlend;
            this.body.x += this.closeBladeBodyX;
            this.body.y += this.closeBladeBodyY;
            this.body.rotation += this.closeBladeBodyRotation;
            this.body.scaleX *= this.closeBladeBodyScaleX;
            this.body.scaleY *= this.closeBladeBodyScaleY;
            this.closeBladePoseActive =
              interruptBlend > 0 &&
              (tt < CLOSE_BLADE_RELEASE_T ||
                this.attackFrontGripBlend > 0 ||
                this.attackBackGripBlend > 0);
          } else {
            const spin = Math.max(def.swingArc * 1.1, 2.6);
            const px = -Math.sin(aimLocal);
            const py = Math.cos(aimLocal);
            const rakePath = (
              direction: -1 | 1,
              activeStart: number,
              activeEnd: number,
              followEnd: number,
            ): { angle: number; x: number; y: number; drive: number } => {
              const start = aimLocal - direction * spin * 0.6;
              const end = aimLocal + direction * spin * 0.4;
              const prior = direction > 0 ? aimLocal + spin * 0.55 : aimLocal + spin * 0.4;
              let prog = 0;
              let angle: number;
              if (tt < activeStart) {
                const p = tt / activeStart;
                angle = prior + (start - prior) * (p * (2 - p));
              } else if (tt < activeEnd) {
                prog = 1 - (1 - (tt - activeStart) / (activeEnd - activeStart)) ** 3;
                angle = start + (end - start) * prog;
              } else if (tt < followEnd) {
                prog = 1;
                const p = (tt - activeEnd) / (followEnd - activeEnd);
                angle = end + direction * 0.1 * Math.sin(Math.PI * p);
              } else {
                prog = 1;
                angle = end; // crossed guard held through accepted readyAt+grace
              }
              const wind = tt < activeStart ? tt / activeStart : 1;
              const lat = TARGET_BODY_H * 0.26 * direction * (1 - 2 * prog) * wind;
              const out = TARGET_BODY_H * (0.12 + 0.2 * Math.sin(Math.PI * prog)) * wind;
              const drive = Math.sin(
                Math.PI * Math.min(1, Math.max(0, (tt - activeStart) / (activeEnd - activeStart))),
              );
              return {
                angle,
                x: px * lat + Math.cos(aimLocal) * out,
                y: py * lat + Math.sin(aimLocal) * out,
                drive,
              };
            };

            if (pose?.motion === "scissor") {
              const first = rakePath(
                1,
                pose.timing.activeStart,
                pose.timing.activeEnd,
                pose.timing.followEnd,
              );
              const second = rakePath(
                -1,
                pose.timing.secondaryActiveStart ?? 0.24,
                pose.timing.secondaryActiveEnd ?? 0.58,
                pose.timing.followEnd,
              );
              weaponAngle = first.angle;
              backWeaponAngle = second.angle;
              this.swingOffX = first.x;
              this.swingOffY = first.y;
              this.swingBackOffX = second.x;
              this.swingBackOffY = second.y;
              const cross = Math.max(0, 1 - Math.abs(tt - (pose.timing.impact ?? 0.43)) / 0.25);
              this.body.scaleX *= 1 - 0.2 * cross;
              this.body.scaleY *= 1 - 0.07 * cross;
              this.body.rotation += 0.045 * Math.sin((tt - 0.43) * Math.PI * 4) * cross;
              this.body.y += 4.5 * s * cross;
            } else if (pose) {
              const direction = poseDirection < 0 ? -1 : 1;
              const rake = rakePath(
                direction,
                pose.timing.activeStart,
                pose.timing.activeEnd,
                pose.timing.followEnd,
              );
              const offUsesBack = pose.hand === "off" && this.weapons.length > 1;
              if (offUsesBack) {
                // Lead glove settles from its prior crossed hold while the rear glove owns the reverse path.
                const settle = Math.min(1, tt / pose.timing.activeStart);
                weaponAngle = aimLocal + spin * 0.4 + (restA - aimLocal - spin * 0.4) * settle;
                backWeaponAngle = rake.angle;
                this.swingBackOffX = rake.x;
                this.swingBackOffY = rake.y;
              } else {
                weaponAngle = rake.angle;
                if (this.weapons.length > 1) backWeaponAngle = restA;
                this.swingOffX = rake.x;
                this.swingOffY = rake.y;
              }
              // Reverse rakes mirror the paper-twist/lean instead of replaying the lead-hand body envelope.
              this.body.scaleX *= 1 - 0.14 * rake.drive;
              this.body.rotation += direction * 0.11 * rake.drive * Math.cos(aimLocal);
              this.body.y += 2 * s * rake.drive;
            }
          }
        } else if (poseStyle === "punch") {
          // §45 PUNCH reuses the existing chamber/extension/hip-drive vocabulary as jab → rear cross →
          // haymaker. Empty fists enter here behind CLIENT_VISUAL_COMBOS; no sprite is required for hands/body.
          const pose = comboPose ?? MELEE_COMBO_SEQUENCES.punch[0];
          if (pose && isKungFuWrapMotion(pose.motion)) {
            const input = this.kungFuWrapPoseInput;
            input.motion = pose.motion;
            input.hand = pose.hand;
            input.direction = poseDirection;
            input.timing = pose.timing;
            input.t = tt;
            const sampled = sampleKungFuWrapPose(input, this.kungFuWrapPose);
            aimRelativePoint(sampled.handForward, sampled.handLateral, aimLocal, this.posePoint);
            const leadX = this.posePoint.x * TARGET_BODY_H;
            const leadY = this.posePoint.y * TARGET_BODY_H;
            aimRelativePoint(
              sampled.rearHandForward,
              sampled.rearHandLateral,
              aimLocal,
              this.posePoint,
            );
            const rearX = this.posePoint.x * TARGET_BODY_H;
            const rearY = this.posePoint.y * TARGET_BODY_H;
            if (pose.hand === "off") {
              weaponAngle = restA;
              backWeaponAngle = aimLocal + sampled.handAngleOffset;
              this.swingBackOffX = leadX;
              this.swingBackOffY = leadY;
              this.swingOffX = rearX;
              this.swingOffY = rearY;
              swingChannelsRouted = true;
            } else {
              weaponAngle = aimLocal + sampled.handAngleOffset;
              this.swingOffX = leadX;
              this.swingOffY = leadY;
              if (this.weapons.length > 1) {
                backWeaponAngle = aimLocal + sampled.rearHandAngleOffset;
                this.swingBackOffX = rearX;
                this.swingBackOffY = rearY;
              }
            }
            aimRelativePoint(sampled.bodyForward, sampled.bodyLateral, aimLocal, this.posePoint);
            this.body.x += this.posePoint.x * TARGET_BODY_H;
            this.body.y += this.posePoint.y * TARGET_BODY_H - sampled.bodyLift * TARGET_BODY_H;
            this.body.rotation += sampled.bodyRotation * Math.cos(aimLocal);
            this.body.scaleX *= sampled.bodyScaleX;
            this.body.scaleY *= sampled.bodyScaleY;
            const liftSign = Math.cos(aimLocal) < 0 ? 1 : -1;
            aimRelativePoint(
              sampled.frontFootForward,
              sampled.frontFootLateral + sampled.frontFootLift * liftSign,
              aimLocal,
              this.posePoint,
            );
            this.attackFrontFootX = this.posePoint.x * TARGET_BODY_H;
            this.attackFrontFootY = this.posePoint.y * TARGET_BODY_H;
            aimRelativePoint(
              sampled.backFootForward,
              sampled.backFootLateral + sampled.backFootLift * liftSign,
              aimLocal,
              this.posePoint,
            );
            this.attackBackFootX = this.posePoint.x * TARGET_BODY_H;
            this.attackBackFootY = this.posePoint.y * TARGET_BODY_H;
            this.attackFrontFootBlend = sampled.footBlend;
            this.attackBackFootBlend = sampled.footBlend;
            ownFeet = sampled.footBlend;
            const impactHand = pose.hand === "off" ? 1 : 0;
            this.pairWeaponScaleX[impactHand] = 1 + sampled.impactSnap * 0.24;
            if (pose.hand === "both") this.pairWeaponScaleX[1] = 1 + sampled.impactSnap * 0.18;
            this.pairGlintAlpha = Math.max(
              this.pairGlintAlpha,
              sampled.impactSnap * (pose.motion === "chain-punch" ? 0.72 : 0.9),
            );
          } else {
            const monkFlurry = isMonkGloveWeapon(def);
            const heavy = twoHandedPoseFor(def, this.poseVariants.twoHandAuthority) ? 1 : 0;
            const isCross = pose?.motion === "cross";
            const straight = monkFlurry || pose?.motion === "jab" || isCross;
            const reach =
              TARGET_BODY_H *
              (monkFlurry
                ? 1
                : pose?.motion === "jab"
                  ? 0.48
                  : isCross
                    ? 0.68 + 0.18 * heavy
                    : 0.55 + 0.25 * heavy);
            const wind = pose?.timing.activeStart ?? 0.1;
            const imp = pose?.timing.activeEnd ?? CHOP_IMPACT_FRAC;
            const follow = pose?.timing.followEnd ?? 0.44;
            const pairedMonkStrike = monkFlurry && this.weapons.length > 1;
            const pairOffStrike = pairedMonkStrike && this.swingHand === 1;
            const authoredOffStrike =
              !pairedMonkStrike &&
              pose?.hand === "off" &&
              (this.weapons.length > 1 ||
                def.id === "fists" ||
                (monkFlurry && def.poseLanguage?.idle === undefined));
            const offUsesBack = pairOffStrike || authoredOffStrike;
            const direction = monkFlurry ? (offUsesBack ? -1 : 1) : poseDirection < 0 ? -1 : 1;
            let th = aimLocal; // fist direction from the shoulder
            let r = 0; // fist extension
            let drive = 0; // 0..1 body-commitment envelope
            let lateral = 0;
            if (straight) {
              if (tt < wind) {
                const p = tt / wind;
                r = monkFlurry
                  ? reach * (0.04 - 0.3 * p)
                  : reach * ((isCross ? -0.24 : -0.14) - (isCross ? 0.16 : 0.12) * p);
                lateral =
                  TARGET_BODY_H * (monkFlurry ? direction * 0.11 : isCross ? -0.12 : 0.08) * p;
                drive = (monkFlurry ? 0.32 : isCross ? 0.38 : 0.18) * p;
              } else if (tt < imp) {
                const p = (tt - wind) / (imp - wind);
                const e = 1 - (1 - p) ** 3;
                r = monkFlurry
                  ? reach * (-0.26 + 1.26 * e)
                  : reach * ((isCross ? -0.4 : -0.26) + (isCross ? 1.4 : 1.26) * e);
                lateral =
                  TARGET_BODY_H *
                  (monkFlurry ? direction * 0.11 : isCross ? -0.12 : 0.08) *
                  (1 - e);
                drive =
                  (monkFlurry ? 0.32 : isCross ? 0.38 : 0.18) +
                  (monkFlurry ? 0.68 : isCross ? 0.62 : 0.72) * e;
              } else if (tt < follow) {
                r = reach;
                drive = monkFlurry || isCross ? 1 : 0.9;
              } else {
                const p = (tt - follow) / (1 - follow);
                const e = p * (2 - p);
                r = monkFlurry ? reach * (1 - 0.96 * e) : reach * (1 - (isCross ? 1.22 : 1.14) * e);
                lateral =
                  -TARGET_BODY_H * (monkFlurry ? direction * 0.08 : isCross ? 0.12 : 0.08) * e;
                drive =
                  (monkFlurry || isCross ? 1 : 0.9) * (1 - e) +
                  (monkFlurry ? 0.16 : isCross ? 0.2 : 0.12) * e;
              }
            } else {
              const haymaker = pose?.motion === "haymaker";
              const hook = (haymaker ? 1.05 : 0.62) + 0.45 * heavy;
              if (tt < wind) {
                const p = tt / wind;
                th = aimLocal - direction * hook * p;
                r = reach * (0.12 + 0.2 * p);
                drive = (haymaker ? 0.42 : 0.3) * p;
              } else if (tt < imp) {
                const p = (tt - wind) / (imp - wind);
                const e = 1 - (1 - p) ** 3;
                th = aimLocal + direction * hook * (-1 + (haymaker ? 1.5 : 1.35) * e);
                r = reach * (0.32 + 0.68 * e);
                drive = 0.3 + 0.7 * e;
              } else if (tt < follow) {
                const p = (tt - imp) / (follow - imp);
                th = aimLocal + direction * hook * (haymaker ? 0.5 + 0.16 * p : 0.35 + 0.12 * p);
                r = reach * (1 - 0.12 * p);
                drive = 1 - 0.12 * p;
              } else {
                const p = (tt - follow) / (1 - follow);
                const e = p * (2 - p);
                const hold = haymaker && heavy ? 0.72 : 0.22;
                th = aimLocal + direction * hook * ((haymaker ? 0.66 : 0.47) * (1 - e) + hold * e);
                r = reach * (0.88 * (1 - e) + 0.16 * e);
                drive = 0.88 * (1 - e) + (haymaker ? 0.3 : 0.18) * e;
              }
            }
            weaponAngle = th; // the fist leads along its own travel
            const ox = Math.cos(th) * r - Math.sin(aimLocal) * lateral;
            const oy = Math.sin(th) * r + Math.cos(aimLocal) * lateral;
            if (offUsesBack) {
              backWeaponAngle = th;
              weaponAngle = restA;
              this.swingBackOffX = ox;
              this.swingBackOffY = oy;
              swingChannelsRouted = true;
            } else {
              this.swingOffX = ox;
              this.swingOffY = oy;
              if (this.weapons.length > 1) backWeaponAngle = restA;
            }
            // Body: the punch comes from the HIPS — paper-twist (shoulders turning through), lean into the
            // blow, a dug-in crouch. The rear cross mirrors the lean; the finisher commits the whole frame.
            const commitScale = monkFlurry
              ? 1.12
              : pose?.motion === "jab"
                ? 0.55
                : isCross
                  ? 1.18
                  : pose?.motion === "haymaker"
                    ? 1.2
                    : 0.85;
            this.body.scaleX *= 1 - (0.12 + 0.1 * heavy) * drive * commitScale;
            this.body.rotation +=
              direction * (0.1 + 0.09 * heavy) * drive * commitScale * Math.cos(aimLocal);
            this.body.y += (2.5 + 2.5 * heavy) * s * drive * commitScale;
            if (monkFlurry) {
              // Presentation only: the shoulder/hip step keeps detached fists connected to the paper body.
              // It never moves the rig root; only an explicit server-authored movement datum may do that.
              this.attackArtOffX += Math.cos(aimLocal) * TARGET_BODY_H * 0.055 * drive;
              this.attackArtOffY += Math.sin(aimLocal) * TARGET_BODY_H * 0.055 * drive;
            }
            if (heavy || pose?.motion === "haymaker")
              this.body.scaleY *= 1 - 0.06 * drive * commitScale;
            if (
              (poseVariant === "sparkknuckle-voltage-boxing" ||
                poseVariant === "coyote-voltage-boxing") &&
              pose?.timing.impact !== undefined
            ) {
              const impactFrame = Math.max(0, 1 - Math.abs(tt - pose.timing.impact) / 0.055);
              const snap = impactFrame * impactFrame;
              this.pairWeaponScaleX[pose.hand === "off" ? 1 : 0] = 1 + snap * 0.28;
              this.pairGlintAlpha = Math.max(this.pairGlintAlpha, snap * 0.82);
              this.body.rotation += direction * snap * 0.09 * Math.cos(aimLocal);
              this.body.scaleY *= 1 - snap * 0.08;
            }
          }
        } else if (poseStyle === "thrust") {
          // §45 THRUST keeps the existing locked-blade lunge envelope, with an outside draw, mirrored
          // disengage circle, and longer step-through/stick. Signed body tilt makes step 2 read distinctly.
          const pose = comboPose ?? MELEE_COMBO_SEQUENCES.thrust[0];
          weaponAngle = aimLocal;
          const a = pose?.timing.activeStart ?? 0.14;
          const b = pose?.timing.activeEnd ?? 0.42;
          const follow = pose?.timing.followEnd ?? 0.5;
          const impale = pose?.motion === "impale";
          const disengage = pose?.motion === "disengage";
          const direction = poseDirection < 0 ? -1 : 1;
          const lunge = TARGET_BODY_H * 0.55 * (impale ? 1.2 : 1);
          let env: number;
          let lateral = 0;
          if (tt < a) {
            const p = tt / a;
            env = -(impale ? 0.28 : 0.18) * p;
            // A compact ellipse around the imagined guard; bounded well inside the blade half-width.
            if (disengage) lateral = direction * TARGET_BODY_H * 0.09 * Math.sin(Math.PI * 2 * p);
          } else if (tt < b) {
            const p = (tt - a) / (b - a);
            const e = p * p * (3 - 2 * p);
            env = -(impale ? 0.28 : 0.18) + (impale ? 1.28 : 1.18) * e;
            if (disengage) lateral = direction * TARGET_BODY_H * 0.035 * (1 - e);
          } else if (tt < follow) {
            env = 1; // puncture/stick beat at authored full reach
          } else {
            const p = (tt - follow) / (1 - follow);
            const e = p * (2 - p);
            const guard = direction * (impale ? -0.2 : -0.12);
            env = 1 + (guard - 1) * e;
            lateral = disengage ? -direction * TARGET_BODY_H * 0.045 * e : 0;
          }
          this.swingOffX = Math.cos(aimLocal) * lunge * env - Math.sin(aimLocal) * lateral;
          this.swingOffY = Math.sin(aimLocal) * lunge * env + Math.cos(aimLocal) * lateral;
          if (pose?.hand === "both") {
            this.swingBackOffX = this.swingOffX * 0.35;
            this.swingBackOffY = this.swingOffY * 0.35;
          }
          // §40.1 body: the fencer LUNGES behind the stab — lean into the aim + a paper-stretch of the
          // torso along the thrust (scaleX up, scaleY in), sinking slightly as the front leg plants.
          const e = Math.max(0, env);
          const commitScale = impale ? 1.35 : 1;
          this.body.rotation += direction * 0.15 * e * commitScale * Math.cos(aimLocal);
          this.body.scaleX *= 1 + 0.07 * e * commitScale;
          this.body.scaleY *= 1 - 0.05 * e * commitScale;
          this.body.y += 2.5 * s * e * commitScale;
        } else {
          // §45 ARC: signed forehand → reverse → overhead diagonal, all using the existing angle/lean/lift
          // envelopes and frozen aim.
          const pose = comboPose ?? MELEE_COMBO_SEQUENCES.arc[0];
          const a = pose?.timing.activeStart ?? 0.16;
          const b = pose?.timing.activeEnd ?? 0.66;
          const follow = pose?.timing.followEnd ?? 0.8;
          if (pose?.motion === "overhead") {
            const raiseA = -Math.PI / 2 - 0.8;
            const fromA = aimLocal - def.swingArc * 0.5; // step-2 high/crossed hold
            const plantA = aimLocal + def.swingArc * 0.625;
            const lift = TARGET_BODY_H * 0.16;
            if (tt < a) {
              const p = tt / a;
              const e = p * (2 - p);
              weaponAngle = fromA + (raiseA - fromA) * e;
              this.swingOffY = -lift * e;
              this.body.rotation += -0.08 - 0.1 * e;
              this.body.y -= 3.5 * s * e;
              this.body.scaleY *= 1 + 0.06 * e;
            } else if (tt < b) {
              const p = (tt - a) / (b - a);
              const e = p * p;
              weaponAngle = raiseA + (plantA - raiseA) * e;
              this.swingOffY = -lift + (lift + TARGET_BODY_H * 0.05) * e;
              this.body.rotation += -0.18 + 0.4 * e;
              this.body.y += (-3.5 + 10 * e) * s;
              this.body.scaleY *= 1.06 - 0.15 * e;
            } else if (tt < follow) {
              weaponAngle = plantA;
              this.swingOffY = TARGET_BODY_H * 0.05;
              this.body.rotation += 0.22;
              this.body.y += 6.5 * s;
              this.body.scaleY *= 0.91;
            } else {
              const p = (tt - follow) / (1 - follow);
              const e = p * (2 - p);
              weaponAngle = mixAngle(plantA, forwardMeleeReadyAngle(aimLocal), e);
              this.swingOffY = TARGET_BODY_H * 0.05 * (1 - 0.25 * e);
              this.body.rotation += 0.22 - 0.04 * e;
              this.body.y += (6.5 - 1.5 * e) * s;
              this.body.scaleY *= 0.91 + 0.03 * e;
            }
          } else {
            const direction = poseDirection < 0 ? -1 : 1;
            const start =
              direction > 0 ? aimLocal - def.swingArc * 0.55 : aimLocal + def.swingArc * 0.5;
            const end =
              direction > 0 ? aimLocal + def.swingArc * 0.45 : aimLocal - def.swingArc * 0.5;
            const back = start - direction * 0.3;
            const prior =
              direction < 0 ? aimLocal + def.swingArc * 0.45 : aimLocal + def.swingArc * 0.545; // finisher's planted low guard
            if (tt < a) {
              const p = tt / a;
              const e = p * (2 - p);
              weaponAngle = prior + (back - prior) * e;
              const startLean = direction > 0 ? 0.18 : 0.08;
              this.body.rotation += startLean + (-direction * 0.1 - startLean) * e;
            } else if (tt < b) {
              const p = (tt - a) / (b - a);
              const e = 1 - (1 - p) ** 2;
              weaponAngle = back + (end - back) * e;
              this.body.rotation += -direction * 0.1 + direction * 0.18 * e;
            } else if (tt < follow) {
              const p = (tt - b) / (follow - b);
              weaponAngle = end + direction * 0.08 * Math.sin(Math.PI * p);
              this.body.rotation += direction * (0.08 + 0.025 * Math.sin(Math.PI * p));
            } else {
              weaponAngle = end; // crossed/high guard held for the next accepted cadence step
              this.body.rotation += direction * 0.08;
            }
          }
        }

        if (this.swingHand === 1 && !swingChannelsRouted && !this.crossfallActive) {
          const routed = routeSwingChannels(
            {
              weaponAngle,
              backWeaponAngle,
              swingOffX: this.swingOffX,
              swingOffY: this.swingOffY,
              swingBackOffX: this.swingBackOffX,
              swingBackOffY: this.swingBackOffY,
              ownFront,
              ownBack,
            },
            1,
            restA,
            this.offWeaponLean(),
          );
          weaponAngle = routed.weaponAngle;
          backWeaponAngle = routed.backWeaponAngle;
          this.swingOffX = routed.swingOffX;
          this.swingOffY = routed.swingOffY;
          this.swingBackOffX = routed.swingBackOffX;
          this.swingBackOffY = routed.swingBackOffY;
          ownFront = routed.ownFront;
          ownBack = routed.ownBack;
        }

        // A combo may travel through any authored angle, but its cadence guard must present the business
        // end down aim. Blend only after authored follow-through so contact timing and sweep behavior stay
        // untouched; a retained tt=1 hold lands exactly on the shared forward-ready law.
        if (comboPose && tt >= comboPose.timing.followEnd) {
          const holdT = smoothstep01(
            (tt - comboPose.timing.followEnd) / Math.max(0.01, 1 - comboPose.timing.followEnd),
          );
          const ready = forwardMeleeReadyAngle(aimLocal);
          weaponAngle = mixAngle(weaponAngle, ready, holdT);
          if (!Number.isNaN(backWeaponAngle))
            backWeaponAngle = mixAngle(backWeaponAngle, ready, holdT);
        }

        const comboForwardPx = def.performance?.comboForwardPx ?? 0;
        if (comboPose && comboForwardPx > 0) {
          const drive =
            comboForwardPx *
            actionOwnershipAt(
              tt,
              comboPose.timing.activeStart,
              comboPose.timing.activeEnd,
              comboPose.timing.followEnd,
            );
          this.swingOffX += Math.cos(aimLocal) * drive;
          this.swingOffY += Math.sin(aimLocal) * drive;
          if (comboPose.hand === "both") {
            this.swingBackOffX += Math.cos(aimLocal) * drive;
            this.swingBackOffY += Math.sin(aimLocal) * drive;
          }
        }

        // Once grace lapses, blend every additive fake-3D contribution back to the exact resting frame.
        // Active/held poses run at 1; orbit/spin never enter comboPose and remain completely unchanged.
        if (comboPose && poseBlend < 1) {
          weaponAngle = idleWeaponAngle + (weaponAngle - idleWeaponAngle) * poseBlend;
          if (!Number.isNaN(backWeaponAngle))
            backWeaponAngle = idleWeaponAngle + (backWeaponAngle - idleWeaponAngle) * poseBlend;
          this.swingOffX *= poseBlend;
          this.swingOffY *= poseBlend;
          this.swingBackOffX *= poseBlend;
          this.swingBackOffY *= poseBlend;
          this.body.rotation =
            bodyBaseRotation + (this.body.rotation - bodyBaseRotation) * poseBlend;
          this.body.y = bodyBaseY + (this.body.y - bodyBaseY) * poseBlend;
          this.body.scaleX = bodyBaseScaleX + (this.body.scaleX - bodyBaseScaleX) * poseBlend;
          this.body.scaleY = bodyBaseScaleY + (this.body.scaleY - bodyBaseScaleY) * poseBlend;
          this.attackArtOffX *= poseBlend;
          this.attackArtOffY *= poseBlend;
          this.attackLiftPx *= poseBlend;
          this.attackScaleY = 1 + (this.attackScaleY - 1) * poseBlend;
          this.weaponLengthScale = 1 + (this.weaponLengthScale - 1) * poseBlend;
          this.attackShadowX *= poseBlend;
          this.attackShadowY *= poseBlend;
          this.attackShadowRotation *= poseBlend;
          this.attackShadowScaleX = 1 + (this.attackShadowScaleX - 1) * poseBlend;
          this.attackShadowScaleY = 1 + (this.attackShadowScaleY - 1) * poseBlend;
          this.attackShadowAlpha = 1 + (this.attackShadowAlpha - 1) * poseBlend;
          this.attackGripBlend *= poseBlend;
          this.attackFrontGripBlend *= poseBlend;
          this.attackBackGripBlend *= poseBlend;
          this.attackFrontFootBlend *= poseBlend;
          this.attackBackFootBlend *= poseBlend;
          const restSpacing = TARGET_BODY_H * (this.poseLeadSpec?.gripSpacing ?? 0.42);
          this.attackHandSpacing = restSpacing + (this.attackHandSpacing - restSpacing) * poseBlend;
          if (poseBlend < 0.5) this.attackWeaponDepth = 0;
        }
      }
    }
    // Family pose proposes the equilibrium underneath every authored action owner. Its phase is sampled
    // from the accepted swing/recoil/page clocks; no parallel attack timer exists.
    let posePhase: PoseActionPhase = "idle";
    let posePhaseT = 0;
    const poseSwingDurationMs = Math.max(0, (this.swing?.poseSeconds ?? 0) * 1000);
    const poseSwingElapsedMs = sceneNow - this.swingStart;
    if (this.swing && poseSwingDurationMs > 0 && poseSwingElapsedMs >= 0) {
      const swingT = clamp01(poseSwingElapsedMs / poseSwingDurationMs);
      const activeStart = clamp01(
        this.swing.activeStartSeconds / Math.max(1e-6, this.swing.poseSeconds),
      );
      const activeEnd = clamp01(
        this.swing.activeEndSeconds / Math.max(1e-6, this.swing.poseSeconds),
      );
      if (swingT < activeStart) {
        posePhase = "anticipation";
        posePhaseT = activeStart > 0 ? swingT / activeStart : 1;
      } else if (swingT <= activeEnd) {
        posePhase = "active";
        posePhaseT = (swingT - activeStart) / Math.max(1e-6, activeEnd - activeStart);
      } else if (swingT < 1) {
        posePhase = "recovery";
        posePhaseT = (swingT - activeEnd) / Math.max(1e-6, 1 - activeEnd);
      }
    }

    const poseRecoilElapsedMs = sceneNow - this.gunRecoilAtMs;
    if (poseRecoilElapsedMs >= 0 && poseRecoilElapsedMs < GUN_RECOIL_ACTIVE_MS) {
      posePhase = "active";
      posePhaseT = poseRecoilElapsedMs / GUN_RECOIL_ACTIVE_MS;
    } else if (
      poseRecoilElapsedMs >= GUN_RECOIL_ACTIVE_MS &&
      poseRecoilElapsedMs < RANGED_GUN_RECOVERY_MS
    ) {
      posePhase = "recovery";
      posePhaseT = (poseRecoilElapsedMs - GUN_RECOIL_ACTIVE_MS) / RANGED_AIM_SETTLE_MS;
    }

    // Tome trace/tap follows the accepted page scheduler rather than a free-running decorative timer. Last
    // Word owns that same scheduler while active, so its own pending page must not become a stronger owner
    // and cancel the flourish on the following frame.
    const tomeFlourishOwnsPage =
      (this.flourishChannels[0].active &&
        this.flourishChannels[0].moment === "after-attack" &&
        this.flourishChannels[0].spec.family === "tome") ||
      (this.flourishChannels[1].active &&
        this.flourishChannels[1].moment === "after-attack" &&
        this.flourishChannels[1].spec.family === "tome");
    if (this.poseLeadSpec?.family === "tome" && this.tome && !tomeFlourishOwnsPage) {
      const untilPageMs = this.tome.pendingPageAtMs - sceneNow;
      const pageAgeMs = sceneNow - this.tome.lastFlipAtMs;
      if (this.tome.pendingPage && untilPageMs >= 0 && untilPageMs <= TOME_PAGE_INTERVAL_MS) {
        posePhase = "anticipation";
        posePhaseT = 1 - untilPageMs / TOME_PAGE_INTERVAL_MS;
      } else if (pageAgeMs >= 0 && pageAgeMs < TOME_PAGE_DURATION_MS * 0.62) {
        posePhase = "active";
        posePhaseT = pageAgeMs / (TOME_PAGE_DURATION_MS * 0.62);
      } else if (pageAgeMs >= 0 && pageAgeMs < TOME_PAGE_DURATION_MS) {
        posePhase = "recovery";
        posePhaseT = (pageAgeMs - TOME_PAGE_DURATION_MS * 0.62) / (TOME_PAGE_DURATION_MS * 0.38);
      }
    }

    let poseBeamPhase: PoseBeamPhase | undefined;
    if (this.weaponDef?.beam || this.weaponDef?.groundZone?.trigger === "channel") {
      if (anim.fireHeld) {
        poseBeamPhase = rangedAimBlend < 0.94 ? "charging" : "active";
        if (posePhase === "idle") {
          posePhase = rangedAimBlend < 0.94 ? "anticipation" : "active";
          posePhaseT = rangedAimBlend;
        }
      } else if (rangedAimBlend > 0) {
        poseBeamPhase = "cooling";
        posePhase = "recovery";
        posePhaseT = 1 - rangedAimBlend;
      }
    }

    let performancePoseActive = false;
    let performanceWhirlActive = false;
    if (this.performanceSpec) {
      this.performanceInput.spec = this.performanceSpec;
      this.performanceInput.timeS = t;
      this.performanceInput.aimLocal = heldAimLocal;
      this.performanceInput.phase = posePhase;
      this.performanceInput.phaseT = posePhaseT;
      this.performanceInput.fireHeld = anim.fireHeld === true;
      this.performanceInput.reducedMotion = anim.reducedMotion === true || outsidePaperView;
      this.performanceInput.gait = gait;
      this.performanceInput.stridePhase = legPh;
      sampleWeaponPerformance(this.performanceInput, this.performanceSample);
      this.root.rotation += this.performanceSample.wholeBodyRotation;
      this.attackLiftPx += this.performanceSample.wholeBodyLift * TARGET_BODY_H;
      performancePoseActive = this.performanceSample.active;
      if (performancePoseActive) {
        weaponAngle = this.performanceSample.weaponAngle;
        if (Number.isFinite(this.performanceSample.backWeaponAngle))
          backWeaponAngle = this.performanceSample.backWeaponAngle;
        this.swingOffX += this.performanceSample.offsetX * TARGET_BODY_H;
        this.swingOffY += this.performanceSample.offsetY * TARGET_BODY_H;
        ownFront = Math.max(ownFront, this.performanceSample.ownership);
        if (this.poseTwoHanded) ownBack = Math.max(ownBack, this.performanceSample.ownership);
      }
      const twirlAxis = continuousTwirlAxisFor(this.performanceSpec);
      const whirlPhase = continuousWhirlPhase(
        this.performanceSpec,
        anim.fireHeld === true,
        anim.reducedMotion === true || outsidePaperView,
        t,
        this.weaponDef?.cooldown ?? 0.4,
      );
      if (whirlPhase >= 0) {
        const twirl = this.performanceSpec.twirl;
        const direction = twirl ? twirlDirectionForBeat(twirl.direction, this.attackBeatSeq) : 1;
        const turns =
          twirl?.visualRevolutions ??
          Math.max(1, Math.round((this.weaponDef?.swingArc ?? Math.PI * 2) / (Math.PI * 2)));
        if (twirlAxis === "pitch") {
          // B8 amendment: rotate the shared paper rig, so body, limbs, and held buster frontflip as one.
          // Do not arm orbitSpin: its scaleX mirror-turn is the rejected ground-plane yaw choreography.
          this.root.rotation += continuousFrontflipAngle(whirlPhase, turns, direction, this.facing);
        } else {
          this.orbitT = whirlPhase;
          this.orbitSpin = true;
          performanceWhirlActive = true;
        }
      }
    }

    const strikingHand: 0 | 1 =
      poseRecoilElapsedMs >= 0 && poseRecoilElapsedMs < 140
        ? this.gunRecoilHand
        : this.swingHand === 1
          ? 1
          : 0;
    const pairedAimed =
      !!this.weapons[0] &&
      !!this.weapons[1] &&
      usesAimedFiringStance(this.weapons[0].def) &&
      usesAimedFiringStance(this.weapons[1].def);
    const poseSupportHand = poseSupportHandFor(
      strikingHand,
      posePhase !== "idle",
      this.poseTwoHanded,
      this.crossfallActive || this.swingHand === "both",
      pairedAimed,
    );

    const poseCloseBladeSuppressed =
      this.closeBladePoseActive ||
      (!!this.poseLeadSpec && this.poseLeadSpec.family === "close-blade" && posePhase !== "idle");
    const poseWholeRigSuppressed =
      poseCloseBladeSuppressed || this.crossfallActive || meleePoseActive || brace > 0;
    let poseHandSample: PoseLanguageSample | undefined;
    if (this.poseLeadSpec) {
      const poseMotionSuppressed = anim.reducedMotion === true || outsidePaperView;
      this.sampleWeaponPose(
        this.poseLeadInput,
        this.poseLeadSample,
        this.poseLeadSpec,
        t,
        posePhase,
        posePhaseT,
        strikingHand,
        poseSupportHand,
        poseMotionSuppressed,
        poseBeamPhase,
      );
      const supportSpec =
        poseSupportHand === 0
          ? this.poseLeadSpec
          : poseSupportHand === 1
            ? (this.poseOffSpec ?? this.poseLeadSpec)
            : this.poseLeadSpec;
      this.sampleWeaponPose(
        this.poseSupportInput,
        this.poseSupportSample,
        supportSpec,
        t,
        posePhase,
        posePhaseT,
        strikingHand,
        poseSupportHand,
        poseMotionSuppressed,
        poseBeamPhase,
      );
      poseHandSample = this.poseSupportSample;

      if (!poseWholeRigSuppressed) {
        aimRelativePoint(
          this.poseLeadSample.bodyForward,
          this.poseLeadSample.bodyLateral,
          heldAimLocal,
          this.posePoint,
        );
        this.body.x += this.posePoint.x * TARGET_BODY_H;
        this.body.y += this.posePoint.y * TARGET_BODY_H;
        this.body.rotation += this.poseLeadSample.bodyTurn;
      }
      if (this.poseTwoHanded) {
        const spacingMicro =
          (this.poseLeadSample.gripSpacing - this.poseLeadSpec.gripSpacing) * TARGET_BODY_H;
        this.attackHandSpacing += spacingMicro * (1 - Math.max(ownFront, ownBack));
      }
    }
    const poseRecoilImpulse =
      poseSupportHand >= 0 &&
      !!poseHandSample &&
      poseHandSample.offOwn < 0.999 &&
      poseImpulsePending(sceneNow, this.gunRecoilAtMs, this.poseRecoilConsumedAtMs);
    if (poseRecoilImpulse) this.poseRecoilConsumedAtMs = this.gunRecoilAtMs;

    const crossfallOwnsFlourish =
      this.crossfallActive &&
      (posePhase !== "idle" || ownFront > 0.01 || ownBack > 0.01 || ownFeet > 0.01);
    const idleLeadPistol = weaponHasHandlingTag(this.weapons[0]?.def ?? this.weaponDef, "pistol");
    const idleOffPistol = weaponHasHandlingTag(this.weapons[1]?.def, "pistol");
    const pistolIdleTwirl = idleLeadPistol || idleOffPistol;
    const hardFlourishOwner =
      meleePoseActive ||
      this.closeBladePoseActive ||
      crossfallOwnsFlourish ||
      brace > 0 ||
      (!hasAimedFiringWeapon && (ownFront > 0.01 || ownBack > 0.01 || ownFeet > 0.01));
    const strongerFlourishOwner = hardFlourishOwner || posePhase !== "idle" || rangedAimBlend > 0;
    const activePistolIdleTwirl =
      pistolIdleTwirl &&
      this.flourishChannels.some((channel) => channel.active && channel.moment === "idle-settle");
    if (
      (activePistolIdleTwirl ? hardFlourishOwner : strongerFlourishOwner) &&
      (this.flourishChannels[0].active || this.flourishChannels[1].active)
    ) {
      this.cancelFlourish("stronger-owner");
    }
    const quietForEarnedFlourish =
      !strongerFlourishOwner &&
      !cancellationMoveActive &&
      !flourishAttackIntent &&
      this.moveStance === STANCE_NONE &&
      !outsidePaperView &&
      !this.downed;
    if (quietForEarnedFlourish) this.tryStartArmedFlourish(sceneNow);

    const anyFlourishActive = this.flourishChannels[0].active || this.flourishChannels[1].active;
    const anyFlourishArmed = this.flourishArms[0].armed || this.flourishArms[1].armed;
    const anyStowActive = !!this.stowProxies[0].img || !!this.stowProxies[1].img;
    const hasIdleFlourish = pistolIdleTwirl
      ? (idleLeadPistol && !!this.flourishLeadSpec?.idleSettle) ||
        (idleOffPistol && !!this.flourishOffSpec?.idleSettle)
      : !!this.flourishLeadSpec?.idleSettle;
    if (
      !reducedMotion &&
      !outsidePaperView &&
      !(pistolIdleTwirl ? hardFlourishOwner : strongerFlourishOwner) &&
      !anyFlourishActive &&
      !anyFlourishArmed &&
      !anyStowActive &&
      (pistolIdleTwirl || gait < 0.12) &&
      !cancellationMoveActive &&
      !flourishAttackIntent &&
      !this.comboHoldPose &&
      idleFlourishWallNow >= this.idleFlourishEligibleAtMs &&
      (pistolIdleTwirl || sceneNow - this.idleFlourishLastPlayedMs >= 6500) &&
      hasIdleFlourish
    ) {
      if (pistolIdleTwirl) {
        if (idleLeadPistol && this.flourishLeadSpec)
          this.startFlourishChannel(0, "idle-settle", sceneNow, this.flourishLeadSpec);
        if (idleOffPistol && this.flourishOffSpec)
          this.startFlourishChannel(
            1,
            "idle-settle",
            sceneNow + (idleLeadPistol ? PISTOL_DUAL_TWIRL_STAGGER_MS : 0),
            this.flourishOffSpec,
          );
      } else if (this.flourishLeadSpec) {
        this.startFlourishChannel(0, "idle-settle", sceneNow, this.flourishLeadSpec);
      }
      this.idleFlourishEligibleAtMs = Number.POSITIVE_INFINITY;
    }

    const bladeFamily = this.poseLeadSpec?.family;
    const bladeStanceEligible =
      !strongerFlourishOwner &&
      (bladeFamily === "one-hand-blade" || bladeFamily === "two-hand-sword");
    if (bladeStanceEligible) {
      activeNamedStance = namedWeaponStanceFor(this.weaponDef);
      activeBladeStance = activeNamedStance ?? BLADE_SIZE_STANCES[this.poseLeadBladeSize];
      let bladeTarget =
        activeNamedStance?.angleReference === "screen"
          ? activeBladeStance.restAngleRad
          : heldAimLocal + activeBladeStance.restAngleRad;
      if (
        !activeNamedStance &&
        (this.poseLeadBladeSize === "great" || this.poseLeadBladeSize === "colossal") &&
        gait > 0.2 &&
        currentMoveActive
      ) {
        const reverseMoveLocal = Math.atan2(anim.moveY, anim.moveX * this.facing) + Math.PI;
        const movementBias = clamp01((gait - 0.2) / 0.8) * 0.68;
        bladeTarget = mixAngle(bladeTarget, reverseMoveLocal, movementBias);
        const trailDirection = Math.sign(
          Math.atan2(
            Math.sin(reverseMoveLocal - bladeTarget),
            Math.cos(reverseMoveLocal - bladeTarget),
          ),
        );
        bladeTarget -= trailDirection * activeBladeStance.movementTrailRad * gait * 0.45;
      }
      if (!this.bladeNeutralReady) {
        this.bladeNeutralAngle = bladeTarget;
        this.bladeNeutralReady = true;
      } else {
        this.bladeNeutralAngle = stepAngleBounded(
          this.bladeNeutralAngle,
          bladeTarget,
          Math.max(0.035, dtS * (gait > 0.2 ? 5.5 : 3.8)),
        );
      }
      weaponAngle = this.bladeNeutralAngle;
      if (this.poseTwoHanded)
        this.attackHandSpacing = activeBladeStance.gripSpacing * TARGET_BODY_H;
      aimRelativePoint(activeBladeStance.bodyForward, 0, heldAimLocal, this.posePoint);
      this.body.x += this.posePoint.x * TARGET_BODY_H;
      this.body.y += this.posePoint.y * TARGET_BODY_H;
      this.body.rotation += activeBladeStance.bodyTurn - (this.poseLeadSample.bodyTurn || 0);
      if (this.poseLeadBladeSize === "great" || this.poseLeadBladeSize === "colossal") {
        this.body.y += gait * TARGET_BODY_H * 0.018;
      }
    }

    this.flourishHeadX = 0;
    this.flourishHeadY = 0;
    const renderPistolIdleTwirl =
      pistolIdleTwirl &&
      this.flourishChannels.some((channel) => channel.active && channel.moment === "idle-settle");
    if (!(renderPistolIdleTwirl ? hardFlourishOwner : strongerFlourishOwner)) {
      const leadBaseAngle = weaponAngle;
      const offBaseAngle = Number.isNaN(backWeaponAngle)
        ? weaponAngle - this.offWeaponLean()
        : backWeaponAngle;
      let leadRotation = 0;
      let offRotation = 0;
      let leadRotates = false;
      let offRotates = false;
      const bothChannelsActive = this.flourishChannels[0].active && this.flourishChannels[1].active;
      for (let index = 0; index < this.flourishChannels.length; index++) {
        const hand = index as 0 | 1;
        const sample = this.sampleFlourishChannel(hand, sceneNow, heldAimLocal, reducedMotion);
        if (!sample.active) continue;
        if (hand === 0) {
          leadRotation = sample.weaponRotationRad;
          leadRotates = true;
        } else {
          offRotation = sample.weaponRotationRad;
          offRotates = true;
        }
        aimRelativePoint(sample.handForward, sample.handLateral, heldAimLocal, this.posePoint);
        if (hand === 0) {
          this.swingOffX += this.posePoint.x * TARGET_BODY_H;
          this.swingOffY += this.posePoint.y * TARGET_BODY_H;
          ownFront = Math.max(ownFront, sample.ownership);
        } else {
          this.swingBackOffX += this.posePoint.x * TARGET_BODY_H;
          this.swingBackOffY += this.posePoint.y * TARGET_BODY_H;
          ownBack = Math.max(ownBack, sample.ownership);
        }
        if (!bothChannelsActive) {
          aimRelativePoint(
            sample.supportHandForward,
            sample.supportHandLateral,
            heldAimLocal,
            this.posePoint,
          );
          if (hand === 0) {
            this.swingBackOffX += this.posePoint.x * TARGET_BODY_H;
            this.swingBackOffY += this.posePoint.y * TARGET_BODY_H;
            ownBack = Math.max(ownBack, sample.ownership * 0.86);
          } else {
            this.swingOffX += this.posePoint.x * TARGET_BODY_H;
            this.swingOffY += this.posePoint.y * TARGET_BODY_H;
            ownFront = Math.max(ownFront, sample.ownership * 0.86);
          }
        }
        const bodyShare = bothChannelsActive ? 0.58 : 1;
        aimRelativePoint(sample.bodyForward, sample.bodyLateral, heldAimLocal, this.posePoint);
        this.body.x += this.posePoint.x * TARGET_BODY_H * bodyShare;
        this.body.y += this.posePoint.y * TARGET_BODY_H * bodyShare;
        this.body.rotation += sample.bodyTurn * bodyShare;
        aimRelativePoint(sample.footForward, sample.footLateral, heldAimLocal, this.posePoint);
        this.attackFrontFootX += this.posePoint.x * TARGET_BODY_H * bodyShare;
        this.attackFrontFootY += this.posePoint.y * TARGET_BODY_H * bodyShare;
        this.attackBackFootX -= this.posePoint.x * TARGET_BODY_H * 0.72 * bodyShare;
        this.attackBackFootY -= this.posePoint.y * TARGET_BODY_H * 0.72 * bodyShare;
        this.attackFrontFootBlend = Math.max(this.attackFrontFootBlend, sample.ownership);
        this.attackBackFootBlend = Math.max(this.attackBackFootBlend, sample.ownership * 0.9);
        ownFeet = Math.max(ownFeet, sample.ownership * 0.9);
        this.attackLiftPx += sample.paperHop * TARGET_BODY_H * bodyShare;
        aimRelativePoint(
          sample.headForwardPx / TARGET_BODY_H,
          sample.headLateralPx / TARGET_BODY_H,
          heldAimLocal,
          this.posePoint,
        );
        this.flourishHeadX += this.posePoint.x * TARGET_BODY_H * bodyShare;
        this.flourishHeadY += this.posePoint.y * TARGET_BODY_H * bodyShare;
      }
      if (leadRotates) weaponAngle = leadBaseAngle + leadRotation;
      if (offRotates) backWeaponAngle = offBaseAngle + offRotation;
      const headMagnitude = Math.hypot(this.flourishHeadX, this.flourishHeadY);
      if (headMagnitude > 3.5) {
        const headScale = 3.5 / headMagnitude;
        this.flourishHeadX *= headScale;
        this.flourishHeadY *= headScale;
      }
    }

    // Brace overrides the swing with the same aim-relative forward guard used by neutral/held poses.
    if (brace > 0) {
      ownFront = 1;
      ownBack = 1;
      ownFeet = 1;
      const guardAim = meleePoseActive
        ? Math.atan2(
            Math.sin(this.meleeTellAimWorld),
            Math.cos(this.meleeTellAimWorld) * this.facing,
          )
        : heldAimLocal;
      const guard = forwardMeleeReadyAngle(guardAim);
      weaponAngle += (guard - weaponAngle) * brace;
    }
    const ceremony = samplePairCeremony(sceneNow - this.pairCeremonyStartMs);
    if (ceremony.active && this.weapons.length > 1 && !outsidePaperView) {
      const frontHand = this.hands.find((hand) => hand.front);
      const backHand = this.hands.find((hand) => !hand.front);
      const crossLead = heldAimLocal - 0.72;
      const crossOff = heldAimLocal + 0.72 - this.offWeaponLean();
      weaponAngle = mixAngle(weaponAngle, crossLead, ceremony.crossBlend);
      backWeaponAngle = mixAngle(
        Number.isNaN(backWeaponAngle) ? weaponAngle - this.offWeaponLean() : backWeaponAngle,
        crossOff,
        ceremony.crossBlend,
      );
      if (frontHand) {
        this.swingOffX += (TARGET_BODY_H * 0.09 - frontHand.ox) * ceremony.crossBlend;
        this.swingOffY += (-TARGET_BODY_H * 0.03 - frontHand.oy) * ceremony.crossBlend;
      }
      if (backHand) {
        this.swingBackOffX += (-TARGET_BODY_H * 0.09 - backHand.ox) * ceremony.crossBlend;
        this.swingBackOffY += (-TARGET_BODY_H * 0.03 - backHand.oy) * ceremony.crossBlend;
      }
      this.pairWeaponScaleX[0] = ceremony.leadScaleX;
      this.pairWeaponScaleX[1] = ceremony.offScaleX;
      this.pairGlintAlpha = ceremony.glintAlpha;
      ownFront = 1;
      ownBack = 1;
      this.body.rotation += Math.sin(ceremony.ruffle * Math.PI * 2) * 0.025;
      this.body.scaleX *= 1 + ceremony.ruffle * 0.045;
      this.body.scaleY *= 1 - ceremony.ruffle * 0.035;
    }
    if (this.poseTwoHanded) {
      // The rear grip is a hard geometric child of the lead/haft, never an independently wobbling oscillator.
      ownBack = Math.max(ownBack, ownFront);
    }

    // §7 v0.112 Hands: the front hand still reaches toward the cursor (the aim anchor, direct — no lag on
    // aiming), but the SECONDARY motion is now procedural + input-driven: a fore-aft ARM SWING synced to the
    // stride (opposite its leg), a slow breathing sway when idle, and an INERTIA TRAIL that drags the hands
    // behind the body on any speed/direction change — so the arms read as free-moving weight, not a fixed loop.
    const reach = TARGET_BODY_H * (this.weapons.length > 0 ? 0.1 : 0.28);
    const sizeFreq = Math.max(
      JIGGLE_SIZE_FREQ_MIN,
      Math.min(JIGGLE_SIZE_FREQ_MAX, (this.baseScale || 1) ** JIGGLE_SIZE_FREQ_POWER),
    );
    const excitationScale =
      (MOVE_SPEED * JIGGLE_SIGNAL_IMPULSE_HZ * springDtS) / (this.baseScale || 1);
    const tomeCastingHandActive =
      rangedAimBlend > 0 &&
      !!leadFiringStance?.castingHand &&
      !!this.weaponDef &&
      usesAimedFiringStance(this.weaponDef);
    const semanticDef = this.weapons[0]?.def ?? this.weaponDef;
    this.handRoleFrame.phase = posePhase;
    this.handRoleFrame.phaseT = posePhaseT;
    this.handRoleFrame.dualEquipped = this.weapons.length > 1;
    this.handRoleFrame.pairedAimed = pairedAimed;
    this.handRoleFrame.bothHandsOwned =
      this.crossfallActive || this.swingHand === "both" || brace > 0;
    const semanticActionPhase = posePhase === "anticipation" || posePhase === "active";
    this.handRoleFrame.actionOwnedHands[0] =
      semanticActionPhase && (ownFront > 0.01 || performancePoseActive);
    this.handRoleFrame.actionOwnedHands[1] =
      semanticActionPhase &&
      (ownBack > 0.01 || (performancePoseActive && this.performanceSample.backHandBlend > 0));
    this.handRoleFrame.visibleHands[0] = this.hands.some((hand) => hand.front);
    this.handRoleFrame.visibleHands[1] = this.hands.some((hand) => !hand.front);
    for (const hnd of this.hands) {
      const handPhaseSign = hnd.front ? 1 : -1;
      const swingX = movementPose.handSwingPx * handPhaseSign * s;
      const bobY = movementPose.handBobPx * s;
      const idleY =
        anim.reducedMotion === true || outsidePaperView
          ? 0
          : Math.sin(t * 2 + (hnd.front ? 0 : 1.3)) * s * 2.5 * (1 - gait); // breathing when idle
      let hx = hnd.ox + swingX + movementPose.handTrailXPx * s;
      let hy = hnd.oy + bobY + movementPose.handTrailYPx * s;
      if (!PROCEDURAL_JIGGLE) {
        hy += idleY;
      }
      const handIndex = hnd.front ? 0 : 1;
      const semanticRole = classifyHandRole(semanticDef, this.handRoleFrame, handIndex);
      const heldFiringDef = this.weapons[handIndex]?.def;
      const castsFromFreeHand = !hnd.front && !heldFiringDef && tomeCastingHandActive;
      const posedFiringDef = heldFiringDef ?? (castsFromFreeHand ? this.weaponDef : undefined);
      if (heldFiringDef) {
        hx +=
          (movementPose.weaponCarryForwardPx + movementPose.weaponTrailSwayPx * handPhaseSign) * s;
        hy -= movementPose.weaponCarryUpPx * s;
      }
      if (
        semanticDef &&
        handIndex === poseSupportHand &&
        poseHandSample &&
        !poseCloseBladeSuppressed &&
        !this.crossfallActive &&
        (semanticRole === "authored-idle" || semanticRole === "recovering")
      ) {
        const targetInput = this.idleHandTargetInput;
        targetInput.bodyX = this.body.x;
        targetInput.bodyY = this.body.y;
        targetInput.bodyHeight = TARGET_BODY_H;
        targetInput.aimLocal = heldAimLocal;
        targetInput.movementX = swingX + movementPose.handTrailXPx * s;
        targetInput.movementY = bobY + movementPose.handTrailYPx * s + idleY;
        targetInput.microX = 0;
        targetInput.microY = 0;
        targetInput.manifestSocketX = hnd.ox;
        targetInput.recoveryT = semanticRole === "recovering" ? posePhaseT : undefined;
        targetInput.recoveryForward =
          semanticRole === "recovering" ? (poseHandSample?.offForward ?? undefined) : undefined;
        targetInput.recoveryLateral =
          semanticRole === "recovering" ? (poseHandSample?.offLateral ?? undefined) : undefined;
        resolveIdleHandTarget(semanticDef, targetInput, this.idleHandTarget);
        hx = this.idleHandTarget.x;
        hy = this.idleHandTarget.y;
      } else if (
        handIndex === poseSupportHand &&
        poseHandSample &&
        (semanticRole === "action-owned" ||
          (semanticRole === "hard-constrained" &&
            posePhase !== "idle" &&
            this.weapons.length > 1)) &&
        !poseCloseBladeSuppressed &&
        !this.crossfallActive
      ) {
        aimRelativePoint(
          poseHandSample.offForward,
          poseHandSample.offLateral,
          heldAimLocal,
          this.posePoint,
        );
        const targetX = this.body.x + this.posePoint.x * TARGET_BODY_H;
        const targetY = this.body.y + this.posePoint.y * TARGET_BODY_H;
        hx += (targetX - hx) * poseHandSample.offBlend;
        hy += (targetY - hy) * poseHandSample.offBlend;
      }
      if (hnd.front && performancePoseActive) {
        const targetX = this.body.x + this.performanceSample.handX * TARGET_BODY_H;
        const targetY = this.body.y + this.performanceSample.handY * TARGET_BODY_H;
        hx += (targetX - hx) * this.performanceSample.handBlend;
        hy += (targetY - hy) * this.performanceSample.handBlend;
      } else if (!hnd.front && performancePoseActive && this.performanceSample.backHandBlend > 0) {
        const targetX = this.body.x + this.performanceSample.backHandX * TARGET_BODY_H;
        const targetY = this.body.y + this.performanceSample.backHandY * TARGET_BODY_H;
        hx += (targetX - hx) * this.performanceSample.backHandBlend;
        hy += (targetY - hy) * this.performanceSample.backHandBlend;
      }
      if (
        rangedAimBlend > 0 &&
        posedFiringDef &&
        (castsFromFreeHand || usesAimedFiringStance(posedFiringDef))
      ) {
        const role = castsFromFreeHand ? "casting" : hnd.front ? "lead" : "off";
        const target = firingHandTarget(posedFiringDef, role, heldAimLocal);
        const targetX = target.x * TARGET_BODY_H;
        const targetY = target.y * TARGET_BODY_H;
        hx += (targetX - hx) * rangedAimBlend;
        hy += (targetY - hy) * rangedAimBlend;
      }
      if (hnd.front && anim.isSelf && Math.abs(anim.aimX) + Math.abs(anim.aimY) > 0.01) {
        hx += anim.aimX * this.facing * reach; // aim reach is DIRECT (no spring) so the barrel tracks true
        hy += anim.aimY * reach;
      }
      if (activeBladeStance && hnd.front) {
        if (activeNamedStance?.handReference === "screen") {
          hx = this.body.x + activeBladeStance.handForward * TARGET_BODY_H;
          hy = this.body.y + activeBladeStance.handLateral * TARGET_BODY_H;
        } else {
          aimRelativePoint(
            activeBladeStance.handForward,
            activeBladeStance.handLateral,
            heldAimLocal,
            this.posePoint,
          );
          hx = this.body.x + this.posePoint.x * TARGET_BODY_H;
          hy = this.body.y + this.posePoint.y * TARGET_BODY_H;
        }
      }
      // §40.1/§45 each hand carries its authored style offset. Most attacks drive the front; alternating rake/
      // cross/scissor steps populate the rear channel. The 2H block below still chains the haft after this.
      if (hnd.front) {
        hx += this.swingOffX;
        hy += this.swingOffY;
      } else {
        hx += this.swingBackOffX;
        hy += this.swingBackOffY;
      }
      // §7 v0.111 turn-commit HANDS ("pull the reins"): yank both hands toward the new heading on a hard turn.
      if (commit > 0.01) {
        hx += this.turnDirX * this.facing * commit * s * 13;
        hy += this.turnDirY * commit * s * 13;
      }
      // Brace: draw both hands forward + up into a guard in front of the body.
      if (brace > 0) {
        const bx = TARGET_BODY_H * 0.16;
        const by = hnd.oy - TARGET_BODY_H * 0.08;
        hx += (bx - hx) * brace;
        hy += (by - hy) * brace;
      }
      const gripBlend = hnd.front
        ? clamp01(this.attackFrontGripBlend)
        : clamp01(this.attackBackGripBlend);
      if (gripBlend > 0) {
        const beforeX = hx;
        const beforeY = hy;
        const targetX = hnd.front ? this.attackFrontGripX : this.attackBackGripX;
        const targetY = hnd.front ? this.attackFrontGripY : this.attackBackGripY;
        hx += (targetX - hx) * gripBlend;
        hy += (targetY - hy) * gripBlend;
        if (hnd.front) {
          this.closeBladeFrontHandDx = hx - beforeX;
          this.closeBladeFrontHandDy = hy - beforeY;
        } else {
          this.closeBladeBackHandDx = hx - beforeX;
          this.closeBladeBackHandDy = hy - beforeY;
        }
      }
      if (PROCEDURAL_JIGGLE) {
        const authoredOwn = hnd.front ? ownFront : ownBack;
        const own =
          handIndex === poseSupportHand && poseHandSample && !poseCloseBladeSuppressed
            ? Math.max(authoredOwn, poseHandSample.offOwn)
            : authoredOwn;
        // Orbit and the rear 2H grip have authoritative late writers; synchronize at those final seams below.
        const deferToConstraint =
          this.orbitT >= 0 || (!hnd.front && this.poseTwoHanded && !tomeCastingHandActive);
        if (!deferToConstraint) {
          const holdsWeapon = hnd.front ? this.weapons.length > 0 : this.weapons.length > 1;
          const inertia = holdsWeapon ? JIGGLE_WEAPON_HAND_INERTIA : JIGGLE_FREE_HAND_INERTIA;
          const rolePhase = this.phase * Math.PI * 2 + (hnd.front ? 0.7 : 2.9);
          const idleMix = anim.reducedMotion === true || outsidePaperView ? 0 : 1 - gait;
          const equilibriumX =
            Math.sin(t * Math.PI * 2 * 0.57 + rolePhase) * JIGGLE_HAND_IDLE_X * idleMix;
          const equilibriumY =
            Math.sin(t * Math.PI * 2 * 1.13 + rolePhase * 1.7) * JIGGLE_HAND_IDLE_Y * idleMix;
          let impulseX = -springSignalX * this.facing * excitationScale * inertia;
          let impulseY = -springSignalY * excitationScale * inertia;
          if (turnTriggered) {
            impulseX += this.turnDirX * this.facing * JIGGLE_TURN_HAND_KICK;
            impulseY += this.turnDirY * JIGGLE_TURN_HAND_KICK;
          }
          if (poseRecoilImpulse && handIndex === poseSupportHand) {
            const catchImpulse = this.poseLeadSpec?.offHandVerb === "recoil-catch" ? 18 : 10;
            impulseX += Math.cos(heldAimLocal) * catchImpulse;
            impulseY += Math.sin(heldAimLocal) * catchImpulse;
          }
          if (landed) impulseY += JIGGLE_LAND_HAND_KICK * this.landingKickScale;
          if (slideRecovered) impulseY += JIGGLE_LAND_HAND_KICK * 1.4;
          stepJigglePart(
            hnd,
            hx,
            hy,
            own,
            springDtS,
            JIGGLE_HAND_W * sizeFreq,
            JIGGLE_HAND_Z,
            equilibriumX,
            equilibriumY,
            impulseX,
            impulseY,
            JIGGLE_HAND_MAX_X,
            JIGGLE_HAND_MAX_Y,
            JIGGLE_HAND_MAX_V,
            false,
            jiggleRebase || jiggleLodSkip,
          );
          hx += (1 - own) * hnd.jx;
          hy += (1 - own) * hnd.jy;
        }
      }
      // Authored-idle is the only semantic state with the universal late post-condition. All action,
      // grip, mechanism, channel, flourish, and non-terminal recovery owners have already bypassed it.
      if (semanticRole === "authored-idle") {
        hx = Math.max(hx, this.body.x + TARGET_BODY_H * 0.03 + 1e-9);
      }
      hnd.img.x = hx;
      hnd.img.y = hy;
    }

    // Gun/beam sprite placement is spatial gameplay truth: mount each real hand at the exact shared
    // grip/recoil pose that authority uses, then let the ordinary weapon pass draw the PNG from that hand.
    if (hasAimedFiringWeapon) {
      // The paper-card turn squash is presentation-only and has no authoritative clock. A live ranged
      // implement commits the mirror so its complete parent affine is reproducible on the server.
      this.root.setScale(this.facing * this.baseScale, this.baseScale);
      for (let handIndex = 0; handIndex < this.weapons.length; handIndex++) {
        const held = this.weapons[handIndex];
        if (!held || !usesAimedFiringStance(held.def)) continue;
        const gripPose = weaponMuzzleGripOffset(held.def, held.partIndex, {
          aimX: Math.cos(heldAimLocal),
          aimY: Math.sin(heldAimLocal),
          facing: 1,
          hand: handIndex === 1 ? 1 : 0,
          recoilElapsedMs: sceneNow - this.gunRecoilAtMs,
          recoilHand: this.gunRecoilHand,
        });
        held.hand.img.x = gripPose.x;
        held.hand.img.y = gripPose.y;
      }
    }

    // Two-handed grip: place the back hand UP the haft from the front grip (along the weapon).
    // §40: skipped while an ORBIT slash is live — the orbit pass below owns both hands.
    if (this.poseTwoHanded && this.orbitT < 0 && !tomeCastingHandActive) {
      const front = this.hands.find((h) => h.front);
      const back = this.hands.find((h) => !h.front);
      if (front && back) {
        const held = this.weapons[0];
        const grips = held ? resolvedGunGripPoints(held.def) : undefined;
        if (held && grips?.secondary) {
          const ownsSwingScale = this.swingHand === "both" || this.swingHand === 0;
          const base = held.baseScale / (this.baseScale || 1);
          const handling = gunHandlingMechanismFor(held.def);
          const cycle = this.gunHandlingCycles[0];
          const cycleDurationMs = gunHandlingCycleDurationMs(handling, held.def.gun?.fireRate);
          const cycleElapsedMs = sceneNow - cycle.startMs;
          const cycleMatches =
            cycle.active &&
            cycle.weaponId === held.def.id &&
            cycle.mechanism === handling &&
            cycle.acceptedSeq === this.attackBeatSeq;
          sampleGunHandlingHandOffset(
            cycleMatches ? handling : undefined,
            cycleMatches ? cycleElapsedMs : -1,
            cycleDurationMs,
            held.def.displayLength / (this.baseScale || 1),
            reducedMotion,
            this.secondaryGripFlourish,
          );
          if (cycleMatches && cycleElapsedMs >= cycleDurationMs) cycle.active = false;
          const gripInput = this.secondaryGripInput;
          gripInput.primaryX = front.img.x;
          gripInput.primaryY = front.img.y;
          gripInput.spriteWidth = held.img.width;
          gripInput.spriteHeight = held.img.height;
          gripInput.scaleX = base * (ownsSwingScale ? this.weaponLengthScale : 1);
          gripInput.scaleY = base * (ownsSwingScale ? this.attackScaleY : 1);
          gripInput.rotationRad = weaponAngle;
          gripInput.primary = grips.primary;
          gripInput.secondary = grips.secondary;
          gripInput.flourishForward = this.secondaryGripFlourish.forward;
          gripInput.flourishLateral = this.secondaryGripFlourish.lateral;
          resolveSecondaryGripPosition(gripInput, this.secondaryGripPoint);
          back.img.x = this.secondaryGripPoint.x;
          back.img.y = this.secondaryGripPoint.y;
        } else {
          // No authored secondary point means byte-for-byte legacy two-hand spacing behavior.
          const haft = this.attackHandSpacing;
          back.img.x = front.img.x + Math.cos(weaponAngle) * haft;
          back.img.y = front.img.y + Math.sin(weaponAngle) * haft;
        }
        back.img.rotation = 0;
        if (PROCEDURAL_JIGGLE)
          syncOwnedJigglePart(
            back,
            back.img.x,
            back.img.y,
            springDtS,
            jiggleRebase || jiggleLodSkip,
          );
      }
    }

    // V3G1: a true pistol pair uses a deliberately asymmetric silhouette; unrelated dual loadouts are
    // untouched. The weapon pass below follows these hand anchors, so the guns separate with the hands.
    if (this.weapons.length > 1 && !hasAimedFiringWeapon) {
      const front = this.hands.find((hand) => hand.front);
      const back = this.hands.find((hand) => !hand.front);
      if (front)
        front.img.y +=
          dualPistolHandYOffset(this.weapons[0]?.def, this.weapons[1]?.def, 0) * TARGET_BODY_H;
      if (back)
        back.img.y +=
          dualPistolHandYOffset(this.weapons[0]?.def, this.weapons[1]?.def, 1) * TARGET_BODY_H;
    }

    // Feet: alternating walk (lift + a small forward/back stride + a toe pivot) BLENDED by gait with a
    // gentle idle float. §7 v0.105 de-clunk: everything scales by `gait`, so the stride/lift/pivot shrink
    // smoothly to zero as you stop (no full-stride jog for a second after release, no foot teleport on the
    // walk↔idle flip); the idle float fades in as (1−gait).
    // §7 v0.112 the step CADENCE is driven by `legPh` (accumulated by DISTANCE, so it matches real speed and
    // freezes when you stop — no jog-in-place). Each foot lifts + strides fore-aft, plus an INERTIA TRAIL that
    // drags the planted foot as the body accelerates/turns (weight), and a breathing float when idle.
    for (let i = 0; i < this.feet.length; i++) {
      const ft = this.feet[i];
      if (!ft) continue;
      const ph = legPh + i * Math.PI; // legs out of phase
      const planted = Math.sin(ph) <= 0;
      const idle =
        anim.reducedMotion === true || outsidePaperView
          ? 0
          : Math.sin(t * 2.6 + i) * s * 3.5 * (1 - gait);
      const footPhaseSign = i % 2 === 0 ? 1 : -1;
      const footLift =
        i % 2 === 0
          ? movementPose.footLiftPx
          : reducedMotion
            ? 0
            : Math.max(0, -Math.sin(legPh)) * movementInput.spec.footLiftPx * gait;
      let fy = ft.oy - footLift * s + movementPose.footTrailYPx * s;
      let fx =
        ft.ox + movementPose.footStridePx * footPhaseSign * s + movementPose.footTrailXPx * s;
      if (!PROCEDURAL_JIGGLE) {
        fy += idle;
      }
      if (semanticDef && !poseCloseBladeSuppressed && !this.crossfallActive) {
        // A blade-size or named stance is the single neutral profile for this frame. It replaces the
        // family profile instead of being double-added, and remains independent of upper-body aim.
        resolveWeaponFootPoseOffset(
          semanticDef,
          activeBladeStance,
          ft.front,
          gait,
          TARGET_BODY_H,
          this.footPoseOffset,
        );
        fx += this.footPoseOffset.x;
        fy += this.footPoseOffset.y;
      }
      const footBlend = ft.front
        ? clamp01(this.attackFrontFootBlend)
        : clamp01(this.attackBackFootBlend);
      if (footBlend > 0) {
        const beforeX = fx;
        const beforeY = fy;
        const targetX = ft.ox + (ft.front ? this.attackFrontFootX : this.attackBackFootX);
        const targetY = ft.oy + (ft.front ? this.attackFrontFootY : this.attackBackFootY);
        fx += (targetX - fx) * footBlend;
        fy += (targetY - fy) * footBlend;
        if (ft.front) {
          this.closeBladeFrontFootDx = fx - beforeX;
          this.closeBladeFrontFootDy = fy - beforeY;
        } else {
          this.closeBladeBackFootDx = fx - beforeX;
          this.closeBladeBackFootDy = fy - beforeY;
        }
      }
      if (PROCEDURAL_JIGGLE) {
        const inertia = planted ? JIGGLE_FOOT_PLANT_INERTIA : JIGGLE_FOOT_AIR_INERTIA;
        const rolePhase = this.phase * Math.PI * 2 + i * 2.1 + 4.3;
        const idleMix = anim.reducedMotion === true || outsidePaperView ? 0 : 1 - gait;
        const equilibriumX =
          Math.sin(t * Math.PI * 2 * 0.73 + rolePhase) * JIGGLE_FOOT_IDLE_X * idleMix;
        const equilibriumY =
          Math.sin(t * Math.PI * 2 * 1.37 + rolePhase * 1.3) * JIGGLE_FOOT_IDLE_Y * idleMix;
        let impulseX = -springSignalX * this.facing * excitationScale * inertia;
        let impulseY = -springSignalY * excitationScale * inertia;
        if (turnTriggered) {
          impulseX += this.turnDirX * this.facing * JIGGLE_TURN_FOOT_KICK;
          impulseY += this.turnDirY * JIGGLE_TURN_FOOT_KICK;
        }
        stepJigglePart(
          ft,
          fx,
          fy,
          ownFeet,
          springDtS,
          (planted ? JIGGLE_FOOT_PLANT_W : JIGGLE_FOOT_AIR_W) * sizeFreq,
          planted ? JIGGLE_FOOT_PLANT_Z : JIGGLE_FOOT_AIR_Z,
          equilibriumX,
          equilibriumY,
          impulseX,
          impulseY,
          JIGGLE_FOOT_MAX_X,
          JIGGLE_FOOT_MAX_Y,
          JIGGLE_FOOT_MAX_V,
          planted,
          jiggleRebase || jiggleLodSkip || (landed && planted),
        );
        fx += (1 - ownFeet) * ft.jx;
        fy += (1 - ownFeet) * ft.jy;
      }
      ft.img.y = fy; // §MADNESS higher foot lift
      ft.img.x = fx; // stride + drag
      ft.img.rotation = PROCEDURAL_JIGGLE
        ? movementPose.footPivotRad * footPhaseSign - (ft.jx / JIGGLE_FOOT_MAX_X) * 0.18
        : movementPose.footPivotRad * footPhaseSign;
    }

    this.applyUltimatePose(timeMs);

    // Weapon(s): held in hand at the angle computed above (upright at rest → chop on swing).
    for (let i = 0; i < this.weapons.length; i++) {
      const w = this.weapons[i];
      if (!w) continue;
      const heldScale = i === 0 && this.tome?.openVisible ? this.tome.openBaseScale : w.baseScale;
      const base = heldScale / (this.baseScale || 1); // fixed on-screen weapon size (§29)
      if (i === 0 && this.signatureMotion && this.attackGripBlend > 0) {
        // Fulcrum/hero-spin exception: the authored weapon path supplies the grip, then the hand follows.
        const front = this.hands.find((hand) => hand.front);
        const back = this.hands.find((hand) => !hand.front);
        const fromX = front?.img.x ?? w.hand.img.x;
        const fromY = front?.img.y ?? w.hand.img.y;
        const grip = clamp01(this.attackGripBlend);
        const gx = fromX + (this.attackGripX - fromX) * grip;
        const gy = fromY + (this.attackGripY - fromY) * grip;
        w.img.setPosition(gx, gy);
        w.img.rotation = weaponAngle;
        w.img.setScale(base * this.weaponLengthScale, base * this.attackScaleY);
        if (front) front.img.setPosition(gx, gy);
        if (back && this.attackGripBoth) {
          back.img.setPosition(
            back.img.x + (this.attackBackGripX - back.img.x) * grip,
            back.img.y + (this.attackBackGripY - back.img.y) * grip,
          );
          back.img.rotation = 0;
        }
        if (PROCEDURAL_JIGGLE) {
          if (front)
            syncOwnedJigglePart(
              front,
              front.img.x,
              front.img.y,
              springDtS,
              jiggleRebase || jiggleLodSkip,
            );
          if (back && this.attackGripBoth)
            syncOwnedJigglePart(
              back,
              back.img.x,
              back.img.y,
              springDtS,
              jiggleRebase || jiggleLodSkip,
            );
        }
        const behind = this.attackWeaponDepth < 0;
        if (behind !== this.orbitBehind) {
          this.orbitBehind = behind;
          this.rebuildRenderStack();
        }
        continue;
      }
      if (this.orbitT >= 0 && i === 0 && this.weaponDef) {
        // §40 FAKE-3D WAIST-ORBIT SLASH — the facing flip's "scale through a plane" trick generalized.
        // The grip travels an ELLIPSE around the waist (the ground circle seen by the game's tilted camera:
        // x = cosθ, y = sinθ·SQ) while the blade points RADIALLY outward. On screen a radial ground vector
        // projects to (cosθ, sinθ·SQ), so the blade's rotation follows that direction and its LENGTH scales
        // by that vector's magnitude — full profile when sweeping left/right, foreshortened "paper sword"
        // pointing toward/away from camera. The far half renders BEHIND the body. Sweep is centred on the
        // frozen aim so the blade still passes through exactly the arc the server damages (§20 WYSIWYG).
        const def = this.weaponDef;
        const SQ = 0.34; // camera tilt: how much a ground circle squashes vertically
        const aimW = Number.isNaN(this.swingAimWorld)
          ? anim.isSelf
            ? Math.atan2(anim.aimY, anim.aimX)
            : anim.aimDir
          : this.swingAimWorld;
        const aimLocal = Math.atan2(Math.sin(aimW), Math.cos(aimW) * this.facing);
        // The aim's azimuth on the GROUND circle (un-squash the screen direction).
        const azAim = Math.atan2(Math.sin(aimLocal) / SQ, Math.cos(aimLocal));
        const tt = this.orbitT;
        const twirl = def.performance?.twirl;
        const spinDirection = twirl
          ? twirlDirectionForBeat(twirl.direction, this.attackBeatSeq)
          : 1;
        let th: number;
        if (this.orbitSpin) {
          // §40.3 WHIRLWIND: full revolutions matching the weapon's full-circle swingArc (2π per turn) —
          // the visual blade edge sweeps exactly what the server's swept damage does. Starts at the aim.
          // §41 SEAMLESS SPAM: a fresh spin eases in then runs LINEAR (constant whirl, no settle-out); a
          // CHAINED spin (spammed/held trigger) is pure linear — since each spin is integer revolutions, the
          // next one starts exactly where this one ends, angle- AND speed-continuous. One endless whirlwind.
          const a = 0.18; // ease-in fraction (C1-continuous into the linear run)
          const e =
            this.swingChained || performanceWhirlActive
              ? tt
              : tt < a
                ? (tt * tt) / (a * (2 - a))
                : (2 * tt - a) / (2 - a);
          const turns =
            twirl?.visualRevolutions ?? Math.max(1, Math.round(def.swingArc / (Math.PI * 2)));
          th = continuousWhirlAngle(e, turns, spinDirection, azAim);
        } else {
          const e = tt * tt * (3 - 2 * tt); // smoothstep — wind in, whip through, settle out
          const windup = 1.5; // start this far behind the damage arc…
          const follow = 0.9; // …and carry through past it
          th = azAim - def.swingArc / 2 - windup + (def.swingArc + windup + follow) * e;
        }
        if (twirl?.plane === "screen-circle") {
          const screenAngle = aimLocal + (th - azAim);
          const localLength = def.displayLength / Math.max(0.01, this.baseScale);
          const pivot =
            twirl.pivot === "shaft-midpoint"
              ? shaftMidpointPivotTransform(0, 0, screenAngle, localLength, def.gripFrac)
              : { x: 0, y: 0, rotation: screenAngle };
          w.img.setPosition(pivot.x, pivot.y);
          w.img.rotation = pivot.rotation;
          w.img.setScale(base, base);
          const front = this.hands.find((h) => h.front);
          const back = this.hands.find((h) => !h.front);
          const handHalfSpan = Math.min(TARGET_BODY_H * 0.18, localLength * 0.08);
          if (front)
            front.img.setPosition(
              -Math.cos(screenAngle) * handHalfSpan,
              -Math.sin(screenAngle) * handHalfSpan,
            );
          if (back) {
            back.img.setPosition(
              Math.cos(screenAngle) * handHalfSpan,
              Math.sin(screenAngle) * handHalfSpan,
            );
            back.img.rotation = 0;
          }
          if (PROCEDURAL_JIGGLE) {
            if (front)
              syncOwnedJigglePart(
                front,
                front.img.x,
                front.img.y,
                springDtS,
                jiggleRebase || jiggleLodSkip,
              );
            if (back)
              syncOwnedJigglePart(
                back,
                back.img.x,
                back.img.y,
                springDtS,
                jiggleRebase || jiggleLodSkip,
              );
          }
          if (this.orbitBehind) {
            this.orbitBehind = false;
            this.rebuildRenderStack();
          }
          continue;
        }
        const rx = Math.cos(th);
        const ry = Math.sin(th) * SQ;
        const rlen = Math.hypot(rx, ry); // projected radial length: 1 sideways → SQ toward/away
        const rot = Math.atan2(ry, rx);
        const waistY = TARGET_BODY_H * 0.06;
        const gripR = TARGET_BODY_H * 0.3;
        const gx = rx * gripR;
        const gy = waistY + ry * gripR;
        w.img.setPosition(gx, gy);
        w.img.rotation = rot;
        w.img.setScale(base * rlen, base); // foreshorten the LENGTH only — the paper-sword effect
        // Both hands ride the haft (the orbit owns them during the spin). §40.1 the back hand's spacing keeps
        // a MINIMUM separation — a fully foreshortened radial collapsed both grips onto one point, reading as
        // a one-handed swing; clamping the projected haft (plus a tiny fixed split) keeps two visible grips.
        const front = this.hands.find((h) => h.front);
        const back = this.hands.find((h) => !h.front);
        if (front) front.img.setPosition(gx, gy);
        if (back) {
          const haft = TARGET_BODY_H * 0.42 * Math.max(rlen, 0.5);
          const ux = rlen > 1e-4 ? rx / rlen : 1;
          const uy = rlen > 1e-4 ? ry / rlen : 0;
          back.img.setPosition(gx + ux * haft, gy + uy * haft - TARGET_BODY_H * 0.05);
          back.img.rotation = 0;
        }
        if (PROCEDURAL_JIGGLE) {
          if (front)
            syncOwnedJigglePart(
              front,
              front.img.x,
              front.img.y,
              springDtS,
              jiggleRebase || jiggleLodSkip,
            );
          if (back)
            syncOwnedJigglePart(
              back,
              back.img.x,
              back.img.y,
              springDtS,
              jiggleRebase || jiggleLodSkip,
            );
        }
        // §40.1/§40.3 the BODY spins the swing (paper-character posing, additive on the frame's base).
        // §41 spins HOLD the whirl to the very end (each revolution set lands facing-normal, so there's no
        // pop) — and a CHAINED spin skips the entry ramp entirely, keeping the body whirling through spam.
        const spinT = this.orbitSpin
          ? this.swingChained || performanceWhirlActive
            ? 1
            : Math.min(1, this.orbitT / 0.12)
          : Math.sin(Math.PI * Math.min(1, this.orbitT / 0.9)); // rises, peaks mid-swing, settles
        if (this.orbitSpin) {
          // §40.3 GAREN SPIN — the body WHIRLS with the blade: the facing flip's signed scale-through-zero,
          // continuously. cos(θ) sweeps +1 → 0 → −1 → 0 → +1 each revolution: the torso narrows edge-on and
          // MIRRORS on the far half — on paper art that reads as the character turning full circles. A hard
          // athletic crouch + a dizzy wobble sell the commitment; the label/root are untouched (no UI flip).
          const c = Math.cos(th);
          this.body.scaleX *=
            (Math.abs(c) < 0.18 ? 0.18 : Math.abs(c)) * (c < 0 ? -1 : 1) * spinT + (1 - spinT); // blend the whirl in/out so entry/exit don't pop
          this.body.rotation += 0.06 * Math.sin(th * 2) * spinT; // slight wobble
          this.body.y += 5.5 * s * spinT; // dug-in crouch
          this.body.scaleY *= 1 - 0.09 * spinT;
        } else {
          // ORBIT: the chest TURNS WITH the blade — scale-through-a-plane on the torso (full profile when
          // the blade sweeps the sides, narrowed crossing front/back) + a crouch + lean toward the blade.
          this.body.scaleX *= 1 - 0.24 * (1 - Math.abs(rx)) * spinT; // paper-twist: chest follows the blade
          this.body.rotation += 0.1 * Math.sin(th) * spinT + 0.05 * rx * spinT; // lean toward the blade
          this.body.y += 4.5 * s * spinT; // crouch into the spin
          this.body.scaleY *= 1 - 0.07 * spinT;
        }
        // Depth: the far half of the orbit passes BEHIND the body.
        const behind = Math.sin(th) < 0;
        if (behind !== this.orbitBehind) {
          this.orbitBehind = behind;
          this.rebuildRenderStack();
        }
        continue;
      }
      // Orbit just ended → restore the weapon above the body once.
      if (this.orbitBehind && this.orbitT < 0) {
        this.orbitBehind = false;
        this.rebuildRenderStack();
      }
      const off = i === 1 ? this.offWeaponLean() : 0;
      // §40.1 the FRONT HAND already carries swingOff (it grips the weapon through the motion) — the weapon
      // just rides its hand, so blade + both hands travel together.
      w.img.setPosition(w.hand.img.x, w.hand.img.y);
      w.img.rotation =
        (i === 1 && !Number.isNaN(backWeaponAngle) ? backWeaponAngle : weaponAngle) +
        off +
        (i === 0 && this.tome?.openVisible ? this.tome.openRotationOffsetRad : 0);
      // Fixed on-screen weapon size: counter the rig's baseScale (characterScale/tough size-up) so the same
      // weapon reads the SAME size in every hand — the root mirror still flips it for facing.
      const ownsSwingScale = this.swingHand === "both" || this.swingHand === i;
      const lengthScale = ownsSwingScale ? this.weaponLengthScale : 1;
      const thicknessScale = ownsSwingScale ? this.attackScaleY : 1;
      w.img.setScale(
        base * lengthScale * (this.pairWeaponScaleX[i] ?? 1),
        base * thicknessScale * (i === 0 && ownsSwingScale ? weaponThicknessSign : 1),
      );
      if (i === 0 && this.attackWeaponDepth !== 0) {
        const behind = this.attackWeaponDepth < 0;
        if (behind !== this.orbitBehind) {
          this.orbitBehind = behind;
          this.rebuildRenderStack();
        }
      }
    }

    this.applyJumpFeelPose(timeMs, anim);
    this.applyEnemyComboPresentationPose(timeMs);
    this.applyVastagharPose(anim.reducedMotion === true);

    // §5 jump hop was integrated at frame start so touchdown could excite springs; final art lift stays last.
    // After every part is positioned, lift the whole rig's ART up the arc. Feet lift most (they leave the
    // ground), so the silhouette reads as "off the ground" rather than just sliding up.
    // §33 the JUMP hop plus the permanent COLOSSUS lower-body lift both raise the art (never the shadow).
    const lift = this.hopPx + this.baseLift + this.attackLiftPx;
    if (lift > 0.01 || Math.abs(this.attackArtOffX) > 0.01 || Math.abs(this.attackArtOffY) > 0.01) {
      for (const p of this.parts) {
        p.x += this.attackArtOffX;
        p.y += this.attackArtOffY - lift;
      }
      // The slight per-part shear opens daylight under the card: feet leave most, torso trails a touch.
      this.body.y += lift * 0.02;
      for (const foot of this.feet) foot.img.y -= lift * 0.1;
      for (const w of this.weapons) {
        w.img.x += this.attackArtOffX;
        w.img.y += this.attackArtOffY - lift;
      }
    }
    if (this.attackScaleY !== 1) {
      for (const p of this.parts) p.scaleY *= this.attackScaleY;
    }
    if (this.landSquash > 0.01) {
      this.body.scaleY *= 1 - this.landingSquashDepth * this.landSquash;
      this.body.scaleX *= 1 + this.landingSquashDepth * 0.6 * this.landSquash;
    }
    if (spawnActive) {
      // Attachments open after the body card; only visible transforms change, so jiggle ownership is intact.
      const handElapsed = spawnElapsedMs - 24;
      const handScaleX = paperPopScaleX(handElapsed, this.spawnDurationMs);
      const handScaleY = paperPopScaleY(handElapsed, this.spawnDurationMs);
      const handRotation = paperPopRotation(handElapsed, this.spawnDurationMs);
      for (const hand of this.hands) {
        hand.img.scaleX *= handScaleX;
        hand.img.scaleY *= handScaleY;
        hand.img.rotation += handRotation;
      }
      const weaponElapsed = spawnElapsedMs - 38;
      const weaponScaleX = paperPopScaleX(weaponElapsed, this.spawnDurationMs);
      const weaponScaleY = paperPopScaleY(weaponElapsed, this.spawnDurationMs);
      const weaponRotation = paperPopRotation(weaponElapsed, this.spawnDurationMs);
      for (const weapon of this.weapons) {
        weapon.img.scaleX *= weaponScaleX;
        weapon.img.scaleY *= weaponScaleY;
        weapon.img.rotation += weaponRotation;
      }
    }
    this.updateStowProxies(sceneNow, reducedMotion);
    // Copy the FINAL authored/jiggle/spawn transform. No tween or external caller competes for weapon state.
    this.applyWeaponArtGeometry();
    this.applyComboStageTransition(sceneNow);
    // Dual mechanism hands are trigger hands and mechanism hands at once. Every late pose/lift pass has
    // already re-seated held art onto its canonical aimed hand, so displace only the rendered hand here:
    // each accepted alternating Sidewinder shot gets an independent lever cycle while both gun/muzzle
    // affines remain byte-for-byte at the authoritative mount.
    if (this.weapons.length > 1 && this.orbitT < 0) {
      for (let handIndex = 0; handIndex < this.weapons.length; handIndex++) {
        const held = this.weapons[handIndex];
        if (!held) continue;
        const handling = gunHandlingMechanismFor(held.def);
        if (!handling) continue;
        const cycle = this.gunHandlingCycles[handIndex] ?? this.gunHandlingCycles[0];
        const cycleDurationMs = gunHandlingCycleDurationMs(handling, held.def.gun?.fireRate);
        const cycleElapsedMs = sceneNow - cycle.startMs;
        const cycleMatches =
          cycle.active &&
          cycle.weaponId === held.def.id &&
          cycle.mechanism === handling &&
          cycle.acceptedSeq === this.attackBeatSeq;
        sampleGunHandlingHandOffset(
          cycleMatches ? handling : undefined,
          cycleMatches ? cycleElapsedMs : -1,
          cycleDurationMs,
          held.def.displayLength / (this.baseScale || 1),
          reducedMotion,
          this.secondaryGripFlourish,
        );
        if (cycleMatches && cycleElapsedMs >= cycleDurationMs) cycle.active = false;
        const c = Math.cos(held.img.rotation);
        const s = Math.sin(held.img.rotation);
        held.hand.img.x +=
          c * this.secondaryGripFlourish.forward - s * this.secondaryGripFlourish.lateral;
        held.hand.img.y +=
          s * this.secondaryGripFlourish.forward + c * this.secondaryGripFlourish.lateral;
      }
    }
    const localMoveX = anim.moveX * this.facing;
    this.sampleFloatingHeadAttackLead(sceneNow, anim, anim.reducedMotion === true);
    this.syncFloatingHeadPose(
      springDtS,
      outsidePaperView,
      jiggleRebase,
      anim.reducedMotion === true,
      localMoveX,
      anim.moveY,
      springSignalX * this.facing,
      springSignalY,
      landed,
      movementPose.headBobPx,
    );
    const dashLean =
      this.moveStance === STANCE_DASH
        ? -Math.sign(Math.abs(localMoveX) > 0.05 ? localMoveX : 1) * (0.72 + commit * 0.28)
        : 0;
    this.syncGearPose(
      springDtS,
      outsidePaperView,
      jiggleRebase,
      anim.reducedMotion === true,
      -springSignalX * this.facing + (turnTriggered ? -this.turnDirX * this.facing * 0.7 : 0),
      dashLean,
      landed,
    );
    this.syncWrapFootWeapons();
    const leadWeapon = this.weapons[0];
    const offWeapon = this.weapons[1];
    if (this.pairGlintAlpha > 0 && leadWeapon && offWeapon && !outsidePaperView) {
      this.pairGlint
        .setPosition(
          (leadWeapon.img.x + offWeapon.img.x) * 0.5,
          (leadWeapon.img.y + offWeapon.img.y) * 0.5,
        )
        .setRotation((leadWeapon.semanticRotation + offWeapon.semanticRotation) * 0.5 + Math.PI / 2)
        .setScale(
          screenTrueScaleX(this.root.scaleX, this.root.scaleY, 0.72 + this.pairGlintAlpha * 0.5),
          0.7 + this.pairGlintAlpha * 0.3,
        )
        .setAlpha(this.pairGlintAlpha)
        .setVisible(true);
    } else {
      this.pairGlint.setVisible(false);
    }
    this.syncTomeVisual(sceneNow, outsidePaperView);
    this.syncObservedSourceFlash(sceneNow, outsidePaperView);
    this.flushCrossfallRibbon(sceneNow, outsidePaperView);
    this.updateMeleeTellWeaponVisuals(sceneNow);
    this.applySlideInkTell(
      this.moveStance === STANCE_SLIDE &&
        this.slidePhase === SLIDE_PHASE_GROUND &&
        this.slideRenderT <= ROLL_IFRAME_TICKS * ROLL_TICK_SECONDS,
    );
    this.updateJuggleFlash(sceneNow);
    this.updateSlideAfterimages(sceneNow, anim.reducedMotion === true || outsidePaperView);
    // §5/§20 the grounded shadow shrinks + fades as the rig rises, so height reads as altitude (the gap
    // between the lifted art and the planted shadow). The shadow itself never lifts.
    const performanceAura = this.performanceSpec?.aura;
    const gloveAura = this.weaponDef?.glovePair;
    const auraRadius = performanceAura?.radius ?? gloveAura?.auraRadius;
    const auraColor = performanceAura?.color ?? gloveAura?.auraColor;
    const auraActive =
      auraRadius !== undefined && auraColor !== undefined && anim.fireHeld === true && !this.downed;
    const gloveAuraActive = !!gloveAura && auraActive;
    const paintedAura = resolveWeaponAuraVfxRecipe(this.weaponDef);
    const paintedAuraTreatment = weaponPaintedAuraFor(this.weaponDef?.id);
    const paintedAuraActive =
      auraActive && (paintedAura !== undefined || paintedAuraTreatment !== undefined);
    this.auraGlow.setVisible(auraActive && !paintedAuraActive);
    this.auraRing.setVisible(auraActive && !paintedAuraActive);
    this.gloveAuraBoltA.setVisible(gloveAuraActive && !paintedAuraActive);
    this.gloveAuraBoltB.setVisible(gloveAuraActive && !paintedAuraActive);
    for (const fill of this.paintedAuraFill) fill.setVisible(false);
    for (const particle of this.paintedAuraParticles) particle.setVisible(false);
    if (paintedAuraActive) {
      const inverseRigScale = 1 / Math.max(0.01, this.baseScale || 1);
      const centerY = TARGET_BODY_H * 0.18;
      if (paintedAuraTreatment) {
        const worldDiameter = auraRadius * 2 * paintedAuraTreatment.diameterMultiplier;
        // The retained field is damage geometry, not body squash/spawn art. Counter the root's live
        // per-axis scale so its outer layer remains the exact aura envelope on every animation frame.
        const localDiameterX = worldDiameter / Math.max(0.01, Math.abs(this.root.scaleX));
        const localDiameterY = worldDiameter / Math.max(0.01, Math.abs(this.root.scaleY));
        for (
          let i = 0;
          i < Math.min(paintedAuraTreatment.layers.length, this.paintedAuraFill.length);
          i++
        ) {
          const fill = this.paintedAuraFill[i];
          const layerScale = paintedAuraTreatment.layers[i];
          if (!fill || layerScale === undefined) continue;
          const turn =
            anim.reducedMotion === true ? 0 : t * (i === 0 ? 0.17 : -0.23) + i * Math.PI * 0.37;
          fill
            .setTexture(paintedAuraTreatment.textureKey)
            .setPosition(0, centerY)
            .setRotation(turn)
            .setDisplaySize(
              localDiameterX * layerScale,
              localDiameterY * layerScale * paintedAuraTreatment.verticalScale,
            )
            .setAlpha(paintedAuraTreatment.alpha * (i === 0 ? 1 : 0.72))
            .setVisible(true);
        }
      }
      const stillPhase =
        anim.reducedMotion === true || !paintedAura ? 0 : t * Math.PI * 2 * paintedAura.spinHz;
      for (
        let i = 0;
        paintedAura && i < Math.min(paintedAura.count, this.paintedAuraParticles.length);
        i++
      ) {
        const particle = this.paintedAuraParticles[i];
        const packId = paintedAura.packs[i % paintedAura.packs.length];
        const pack = packId ? PARTICLE_PACKS[packId] : undefined;
        if (!particle || !pack || !packId) continue;
        const phase = stillPhase + i * 2.399 + Math.sin(t * 5.2 + i * 1.71) * 0.16;
        const orbit =
          auraRadius * paintedAura.extent * (0.72 + ((i * 37) % 5) * 0.055) * inverseRigScale;
        const frame = (Math.floor(t * 11) + i * 3) % pack.count;
        particle
          .setTexture(`ptcl:${packId}`, frame)
          .setPosition(Math.cos(phase) * orbit, centerY + Math.sin(phase) * orbit * 0.56)
          .setRotation(phase + Math.PI * 0.44)
          .setScale(
            paintedParticleScale(
              packId,
              paintedParticleDominance(
                (this.weaponDef?.displayLength ?? auraRadius * 2) *
                  (paintedAura.particleReferenceMultiplier ?? 1),
                paintedAura.particleDominance,
                paintedAura.minParticlePx,
                paintedAura.maxParticlePx,
              ),
            ) *
              inverseRigScale *
              (0.86 + (i % 3) * 0.08),
          )
          .setAlpha(0.54 + ((i * 29) % 4) * 0.1)
          .setVisible(true);
      }
    } else if (auraActive) {
      const pulse = anim.reducedMotion === true ? 0 : Math.sin(t * Math.PI * 4.4) * 0.035;
      const inverseRigScale = 1 / Math.max(0.01, this.baseScale || 1);
      const diameter = auraRadius * 2 * (1 + pulse) * inverseRigScale;
      this.auraGlow
        .setFillStyle(auraColor, gloveAuraActive ? 0.1 : 0.13)
        .setDisplaySize(diameter, diameter * 0.56)
        .setAlpha(0.72);
      this.auraRing
        .setStrokeStyle(gloveAuraActive ? 2 : 3, auraColor, 0.72)
        .setDisplaySize(diameter * 0.96, diameter * 0.54)
        .setAlpha(0.82);
      if (gloveAuraActive) {
        const phase = anim.reducedMotion === true ? 0 : t * Math.PI * 9;
        const boltRadius = diameter * 0.36;
        const centerY = TARGET_BODY_H * 0.18;
        this.gloveAuraBoltA
          .setPosition(Math.cos(phase) * boltRadius, centerY + Math.sin(phase) * boltRadius * 0.48)
          .setRotation(phase + Math.PI * 0.58)
          .setFillStyle(auraColor, 0.9)
          .setAlpha(0.68 + Math.sin(phase * 1.7) * 0.2);
        this.gloveAuraBoltB
          .setPosition(
            Math.cos(phase + Math.PI) * boltRadius,
            centerY + Math.sin(phase + Math.PI) * boltRadius * 0.48,
          )
          .setRotation(phase - Math.PI * 0.42)
          .setFillStyle(auraColor, 0.82)
          .setAlpha(0.62 + Math.cos(phase * 1.3) * 0.22);
      }
    }

    let shrink = Math.max(0.34, 1 - this.hopPx / 560);
    if (this.moveStance === STANCE_DASH) shrink = Math.max(0.85, shrink);
    if (this.moveStance === STANCE_SLIDE) shrink = Math.max(0.88, shrink) * 1.08;
    const shadowOpen = spawnActive ? smoothstep01(spawnElapsedMs / 170) : 1;
    const shadowSpawnX = 0.45 + 0.55 * shadowOpen;
    const shadowSpawnY = 0.25 + 0.75 * shadowOpen;
    const shadowAlpha = 0.08 + 0.22 * shadowOpen;
    const shadowRootX = spawnActive ? Math.max(0.04, spawnScaleX) : 1;
    const shadowRootY = spawnActive ? signedClamp(spawnScaleY, 0.04) : 1;
    this.shadow
      .setPosition(
        this.attackShadowX / shadowRootX,
        (TARGET_BODY_H * 0.42 + this.attackShadowY) / shadowRootY,
      )
      .setRotation(this.attackShadowRotation - spawnRotation)
      .setScale(
        (shrink * this.attackShadowScaleX * shadowSpawnX) / shadowRootX,
        (shrink * this.attackShadowScaleY * shadowSpawnY) / shadowRootY,
      )
      .setAlpha(Math.max(0.1, shadowAlpha * shrink) * this.attackShadowAlpha);
    const haloAlpha = this.hopPx > 0.01 ? 0.05 * (1 - shrink) * shadowOpen : 0;
    this.shadowHalo
      .setPosition(
        this.attackShadowX / shadowRootX,
        (TARGET_BODY_H * 0.42 + this.attackShadowY) / shadowRootY,
      )
      .setRotation(this.attackShadowRotation - spawnRotation)
      .setScale(
        (shrink * 1.9 * this.attackShadowScaleX * shadowSpawnX) / shadowRootX,
        (shrink * 1.9 * this.attackShadowScaleY * shadowSpawnY) / shadowRootY,
      )
      .setAlpha(haloAlpha * this.attackShadowAlpha);
    this.applyComboStageShadowTransition(sceneNow);
  }
}
