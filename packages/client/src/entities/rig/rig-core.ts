import {
  ATTACK_HELD_WINDOW,
  BLADE_EXTENSION_OVERLAP_FRACTION,
  CHOP_IMPACT_FRAC,
  comboRibbonFanOutScaleAt,
  comboStepForChain,
  composeWeaponTransform,
  createKatanaChoreographySample,
  type BreakActionClockSample,
  type BreakActionPhase,
  AUTHORED_DUAL_MELEE_BAR,
  AUTHORED_DUAL_MELEE_SEQUENCE_LENGTH,
  decodeGearCosmetics,
  authoredDualHandForSeq,
  type GearId,
  type GearSlot,
  GRAVITY_APEX_BAND,
  GROUND_EPSILON,
  INTERP_SNAP_PLAYER,
  isMonkGloveWeapon,
  isBreakActionWeapon,
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
  meleeComboGraceMs,
  type MeleeComboFamily,
  type MeleeComboHand,
  type MeleeComboLimb,
  type MeleeComboMotion,
  type MeleeComboStep,
  type MeleeComboVariant,
  MOVE_HITCH_MIN_ANGLE,
  MOVE_SPEED,
  PARRY_ABOVE_BRACE_SECONDS,
  type ParryGuardPose,
  ParryReaction,
  type ParryReactionValue,
  type MoveStance,
  meleeComboSelectionFor,
  meleeComboSequenceFor,
  meleeReach,
  PLAYER_RADIUS,
  PROCEDURAL_JIGGLE,
  rapidThrustExtensionAt,
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
  sampleBreakActionClock,
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
  type WeaponElementId,
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
} from "../../sprites/art-geometry.generated.js";
import { firingFrameSpriteAt, resolveWeaponFiringFrame } from "../../sprites/firing-frame.js";
import {
  firingHandTarget,
  firingStanceFor,
  fistGunShotHandOffset,
  gunCheekWeldPoseFor,
  usesAimedFiringStance,
} from "../../sprites/firing-stance.js";
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
} from "../../sprites/gear-parts.js";
import {
  type GearTextureBakeLease,
  gearTextureBakeCacheForScene,
} from "../../sprites/gear-texture-baker.js";
import { resolvedGunGripPoints } from "../../sprites/gun-grip-points.js";
import { SPRITES, type SpriteManifest, spriteImageFacingX } from "../../sprites/manifest.js";
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
  createRevolverHammerBeatSample,
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
  isMartialIdleHandPose,
  martialIdleHandAngleFor,
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
  sampleRevolverHammerBeat,
  sampleWeaponPerformance,
  shaftMidpointPivotTransform,
  twirlDirectionForBeat,
  twoHandedPoseFor,
  twoHandPoseAuthorityFrom,
  WEAPON_FLOURISH_SPECS,
  type WeaponFlourishSpec,
  type WeaponPerformanceSpec,
  type WeaponPoseSpec,
  weaponFlourishPivotFor,
  weaponFlourishSpecFor,
  weaponPerformanceSpecFor,
  weaponPoseSpecFor,
} from "../../sprites/pose-language.js";
import { secondaryGripHandRendersAbove } from "../../sprites/secondary-grip.js";
import { tomeOpenArtFor, tomeOpenRotationForAim } from "../../sprites/tome-open-art.js";
import {
  isWholeArtCharacterId,
  isWholeArtCharacterPartRole,
  wholeArtCharacterTextureKey,
  wholeArtCharacterVisualScale,
} from "../../sprites/whole-art-character.js";
import { rollTumbleRotation } from "../../vfx/jump-effects.js";
import { PARTICLE_PACKS } from "../../vfx/particle-manifest.js";
import { paintedParticleDominance, paintedParticleScale } from "../../vfx/particles.js";
import { screenTrueScaleX } from "../../vfx/screen-true-transform.js";
import { resolveWeaponAuraVfxRecipe } from "../../vfx/weapon-effect-recipes.js";
import { weaponPaintedAuraFor } from "../../vfx/weapon-vfx-suite.js";
import {
  createKungFuWrapPoseInput,
  createKungFuWrapPoseSample,
  isKungFuWrapMotion,
  sampleKungFuWrapPose,
} from "../kung-fu-wrap-pose.js";import type { KatanaChoreographySample } from "@dd/shared";
import type {
  FlourishBeatSpec,
  PoseVariantSelection,
  RevolverHammerBeatSample,
  WeaponPerformanceInput,
  WeaponPerformanceSample,
} from "../../sprites/pose-language.js";
import type { KungFuWrapPoseInput, KungFuWrapPoseSample } from "../kung-fu-wrap-pose.js";


export { GEAR_PARTS_MANIFEST } from "../../sprites/gear-parts.js";
export {
  createRevolverHammerBeatSample,
  revolverHammerBeatDurationMs,
  sampleRevolverHammerBeat,
} from "../../sprites/pose-language.js";

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
export const TARGET_BODY_H = 76; // §37 slightly smaller characters (was 84) — reads better in the zoomed-out belt
/** Vertical "look" toward the cursor (local player): how far the torso leans with the aim's up/down. */
export const BODY_LOOK_LEAN = 0.14;
/** Pointed weapons obey semantic +X. The one neutral exception to laser-flat aim is this small ready cant. */
export const MELEE_FORWARD_READY_CANT = -Math.PI / 15;

export function forwardMeleeReadyAngle(aimLocal: number): number {
  return aimLocal + MELEE_FORWARD_READY_CANT;
}
export const PARRY_GUARD_ANGLE_OFFSETS = [-0.62, 0, 0.58] as const;
export const PARRY_GUARD_HAND_FORWARD = [0.1, 0.16, 0.12] as const;
export const PARRY_GUARD_HAND_LIFT = [0.21, 0.08, -0.03] as const;
/** §45 rollback switch for Stage-1 presentation, including empty-hand fist dispatch. No gameplay reads it. */
export const CLIENT_VISUAL_COMBOS = true;
/** The authored guard eases to neutral only after accepted-cadence grace lapses. */
export const COMBO_HOLD_RELEASE_MS = 120;
/** Sparkmitt accepts a new hand every 120 ms, but its former 76.8 ms pose could begin and end between
 * low-rate rendered frames. Cadence remains authoritative; this only keeps each monk strike readable. */
export const MONK_FLURRY_MIN_POSE_MS = 240;
/** G3 presentation-only bridge. It is capped below one tenth of a second and never retimes a descriptor. */
export const COMBO_STAGE_TRANSITION_MAX_MS = 80;
export const MELEE_GLINT_LEAD_MS = 280;
export const MELEE_GLINT_CREST_MS = 60;
/** Open books bridge the authoritative held latch, then remain readable for one quiet settling beat. */
export const TOME_IDLE_CLOSE_MS = 600;
export const TOME_PAGE_INTERVAL_MS = 300;
export const TOME_PAGE_DURATION_MS = 320;
export const TOME_SETTLE_DURATION_MS = 260;
export const TOME_SCRAP_DURATION_MS = 540;
/** Remote accepted attacks reuse the authored renderer only while their source can affect the camera read. */
export const REMOTE_SIGNATURE_LOD_MARGIN_PX = 220;
/** Retained cast/tome source punctuation. It is sampled on the hit-stop-paused rig clock. */
export const REMOTE_SOURCE_FLASH_MS = 150;
/** Ranged implements stay shouldered for one readable beat after the fire latch releases. */
export const RANGED_AIM_LINGER_MS = 250;
export const RANGED_AIM_RAISE_MS = 90;
export const RANGED_AIM_SETTLE_MS = 180;
export const GUN_RECOIL_ACTIVE_MS = 140;
/** A pistol is not quiet while its accepted shot is still in the retained recoil/recovery pose. */
export const RANGED_GUN_RECOVERY_MS = GUN_RECOIL_ACTIVE_MS + RANGED_AIM_SETTLE_MS;
/** The rear held blade's ordinary idle lean is added by the weapon pass. Close-blade poses compensate it. */
export const DUAL_BACK_WEAPON_LEAN = 0.32;
/** Close-blade lunges are fully released before a cadence hold can sample `tt = 1`. */
export const CLOSE_BLADE_RELEASE_T = 0.92;

export type RigComboFamily = MeleeComboFamily | "none";

export type RigSwingHand = 0 | 1 | "both";

export interface RigLoadoutPiece {
  readonly spriteId: string;
  readonly def: WeaponDef;
  readonly manifest: SpriteManifest;
  /** Authored twin sprites select part 1 for their second hand. */
  readonly partIndex?: 0 | 1;
  /** A pre-made dual may mirror its sole authored sprite into the off hand. */
  readonly mirrorX?: boolean;
}

/** Resolve the one catalog weapon into its complete authored held render. Independent weapons are never
 * accepted here, so a second piece can only come from the same pre-made definition. */
export function authoredWeaponRenderPlan(
  spriteId: string,
  def: WeaponDef,
  manifest: SpriteManifest,
): readonly [RigLoadoutPiece] | readonly [RigLoadoutPiece, RigLoadoutPiece] {
  const lead: RigLoadoutPiece = { spriteId, def, manifest, partIndex: 0 };
  if (def.glovePair && manifest.parts.length >= 1) {
    return [lead, { spriteId, def, manifest, partIndex: 0 }];
  }
  if (def.dual && manifest.parts.length >= 2) {
    return [lead, { spriteId, def, manifest, partIndex: 1 }];
  }
  if (def.dual && manifest.parts.length === 1) {
    return [lead, { spriteId, def, manifest, partIndex: 0, mirrorX: true }];
  }
  return [lead];
}

export interface OpposedWhirlwindPose {
  readonly lead: Readonly<{ x: number; y: number }>;
  readonly off: Readonly<{ x: number; y: number }>;
  readonly rotation: number;
  readonly projectedLength: number;
}

/** Two premade swords occupy exactly opposite radii of the same ground-plane revolution. */
export function opposedWhirlwindPose(
  angle: number,
  squash: number,
  waistY: number,
  gripRadius: number,
): OpposedWhirlwindPose {
  const rx = Math.cos(angle);
  const ry = Math.sin(angle) * squash;
  const x = rx * gripRadius;
  const y = ry * gripRadius;
  return Object.freeze({
    lead: Object.freeze({ x, y: waistY + y }),
    off: Object.freeze({ x: -x, y: waistY - y }),
    rotation: Math.atan2(ry, rx),
    projectedLength: Math.hypot(rx, ry),
  });
}

export type WrapRigReceiver = "hand-r" | "hand-l" | "foot-r" | "foot-l";

export interface WrapRigMount {
  readonly receiver: WrapRigReceiver;
  readonly partIndex: 0 | 1;
}

export const NO_WRAP_RIG_MOUNTS = Object.freeze([] as readonly WrapRigMount[]);
export const FOUR_LIMB_WRAP_RIG_MOUNTS = Object.freeze([
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

export interface WrapRigScaleInput {
  readonly sourceWidth: number;
  readonly sourceHeight: number;
  readonly receiverWidth: number;
  readonly receiverHeight: number;
  readonly receiverScaleX: number;
  readonly receiverScaleY: number;
  readonly rigScaleX: number;
  readonly rigScaleY: number;
  readonly padding: number;
}

/**
 * Worn wrap art is clothing, not a fixed-size held prop. Fit its complete canvas inside a lightly padded
 * copy of the receiver's current on-screen envelope so transparent 512px source canvases can never make a
 * fist or boot character-sized.
 */
export function wrapRigReceiverRelativeScale(input: Readonly<WrapRigScaleInput>): number {
  const sourceWidth = Math.max(1, Math.abs(input.sourceWidth));
  const sourceHeight = Math.max(1, Math.abs(input.sourceHeight));
  const padding = Math.max(1, Math.min(1.25, input.padding));
  const receiverWorldWidth =
    Math.max(1, Math.abs(input.receiverWidth * input.receiverScaleX * input.rigScaleX)) * padding;
  const receiverWorldHeight =
    Math.max(1, Math.abs(input.receiverHeight * input.receiverScaleY * input.rigScaleY)) * padding;
  return Math.min(receiverWorldWidth / sourceWidth, receiverWorldHeight / sourceHeight);
}

/** Flame sheaths are an impact-frame composite, never an ambient particle lifetime. */
export function strikeOverlayImpactVisible(
  elapsedSeconds: number,
  impactSeconds: number,
  strikingHand: RigSwingHand,
  overlayHand: 0 | 1,
): boolean {
  const ownsHand = strikingHand === "both" || strikingHand === overlayHand;
  return (
    ownsHand &&
    elapsedSeconds >= impactSeconds - 0.035 &&
    elapsedSeconds <= impactSeconds + 0.075
  );
}

/** Optional rig-only routing metadata. Shared combat truth remains the immutable SwingDescriptor payload. */
export interface RigSwingDescriptor extends SwingDescriptor {
  readonly hand?: RigSwingHand;
  readonly authoredDualStep?: number;
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

export interface ComboChainState {
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

export interface ComboStageTransitionState {
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

export interface ComboStageTransformNode extends ComboStagePoseTransform {
  readonly active: boolean;
}

export function createComboChainState(): ComboChainState {
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

export const CROSSFALL_STEP = Object.freeze({
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
export const GENERIC_IDLE_FLOURISH_DELAY_MS = 1_600;
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

/** B35 keeps guns shouldered at rest. An accepted flourish may briefly take that same idle ownership,
 * while unearned idle motion and every live attack phase continue to yield to the aimed stance. */
export function flourishCanOverridePersistentGunAim(
  hasGunHeld: boolean,
  poseIsIdle: boolean,
  flourishArmedOrActive: boolean,
): boolean {
  return hasGunHeld && poseIsIdle && flourishArmedOrActive;
}

/** Layout offset for one authored dual-pistol definition. */
export function authoredDualPistolHandYOffset(weapon: WeaponDef | undefined, hand: 0 | 1): number {
  if (!weapon?.dual || !weaponHasHandlingTag(weapon, "pistol")) return 0;
  return hand === 0 ? -DUAL_PISTOL_HAND_RISE_BODY_FRAC : 0;
}

export type GunHandlingMechanism = "bolt" | "break" | "lever" | "pump";

export interface GunHandlingCycleState {
  active: boolean;
  acceptedSeq: number;
  mechanism?: GunHandlingMechanism;
  startMs: number;
  weaponId: string;
}

export function createGunHandlingCycleState(): GunHandlingCycleState {
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
  if (weaponHasHandlingTag(def, "break")) return "break";
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
  if (mechanism === "break") return 0;
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
  if (mechanism === "break") return out;
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

/** Follow a secondary fore-wrap point on a rigid barrel that pivots around an authored source-space hinge. */
export function resolveBreakActionSecondaryGripPosition(
  input: Readonly<SecondaryGripTransformInput>,
  hinge: Readonly<{ x: number; y: number }>,
  angleRad: number,
  out: { x: number; y: number },
): { x: number; y: number } {
  const hingeX = (hinge.x - input.primary.x) * input.spriteWidth * input.scaleX;
  const hingeY = (hinge.y - input.primary.y) * input.spriteHeight * input.scaleY;
  const secondaryX = (input.secondary.x - input.primary.x) * input.spriteWidth * input.scaleX;
  const secondaryY = (input.secondary.y - input.primary.y) * input.spriteHeight * input.scaleY;
  const breakC = Math.cos(angleRad);
  const breakS = Math.sin(angleRad);
  const relativeX = secondaryX - hingeX;
  const relativeY = secondaryY - hingeY;
  const localX = hingeX + breakC * relativeX - breakS * relativeY + input.flourishForward;
  const localY = hingeY + breakS * relativeX + breakC * relativeY + input.flourishLateral;
  const c = Math.cos(input.rotationRad);
  const s = Math.sin(input.rotationRad);
  out.x = input.primaryX + c * localX - s * localY;
  out.y = input.primaryY + s * localX + c * localY;
  return out;
}

export { secondaryGripHandRendersAbove } from "../../sprites/secondary-grip.js";

/** ArenaScene owns these presentation services. The rig consumes them structurally so the accepted remote
 * beat can share the existing authored dispatcher without widening the scene API or duplicating VFX data. */
export interface RigAttackPresentationScene extends Phaser.Scene {
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

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function smoothstep01(value: number): number {
  const p = clamp01(value);
  return p * p * (3 - 2 * p);
}

export function mixRgb(from: number, to: number, t: number): number {
  const p = clamp01(t);
  const fromR = (from >>> 16) & 0xff;
  const fromG = (from >>> 8) & 0xff;
  const fromB = from & 0xff;
  const r = Math.round(fromR + (((to >>> 16) & 0xff) - fromR) * p);
  const g = Math.round(fromG + (((to >>> 8) & 0xff) - fromG) * p);
  const b = Math.round(fromB + ((to & 0xff) - fromB) * p);
  return (r << 16) | (g << 8) | b;
}

export function smootherstep01(value: number): number {
  const p = clamp01(value);
  return p * p * p * (p * (p * 6 - 15) + 10);
}

export function cubicOut01(value: number): number {
  const p = clamp01(value);
  return 1 - (1 - p) ** 3;
}

export function backOut01(value: number): number {
  const p = clamp01(value) - 1;
  return 1 + p * p * (2.70158 * p + 1.70158);
}

export function mixAngle(from: number, to: number, t: number): number {
  const delta = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + delta * clamp01(t);
}

export type ComboStageTransitionTiming = Pick<
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

export function stepAngleBounded(from: number, to: number, maxDelta: number): number {
  const delta = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + Math.max(-maxDelta, Math.min(maxDelta, delta));
}

export function paperPopScaleX(elapsedMs: number, durationMs: number): number {
  const q = clamp01(elapsedMs / durationMs);
  if (q > 0.72) return 1;
  return 0.82 + 0.18 * backOut01(q / 0.72);
}

export function paperPopScaleY(elapsedMs: number, durationMs: number): number {
  const q = clamp01(elapsedMs / durationMs);
  if (q <= 0.72) return -0.04 + 1.12 * backOut01(q / 0.72);
  return 1.08 - 0.08 * smoothstep01((q - 0.72) / 0.28);
}

/** Phaser's core display objects have no typed skew; a small counter-rotation supplies the shear cue. */
export function paperPopRotation(elapsedMs: number, durationMs: number): number {
  const q = clamp01(elapsedMs / durationMs);
  if (q > 0.72) return 0.045 * (1 - smoothstep01((q - 0.72) / 0.28));
  return 0.045 * (1 - clamp01(backOut01(q / 0.72)));
}

/** Preserve the sign while preventing one invisible edge-on frame. Zero chooses the positive face. */
export function signedClamp(value: number, floor: number): number {
  return (value < 0 ? -1 : 1) * Math.max(Math.abs(value), floor);
}

export interface AuthoredDualCeremonySample {
  readonly active: boolean;
  /** 0 at the ordinary ready pose, 1 at the held chest-height X. */
  readonly crossBlend: number;
  readonly leadScaleX: number;
  readonly offScaleX: number;
  readonly glintAlpha: number;
  readonly ruffle: number;
}

/** A pre-made dual's 460 ms paper flip, expressed without Phaser so its timing remains testable. */
export function sampleAuthoredDualCeremony(elapsedMs: number): AuthoredDualCeremonySample {
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

export function attackSignatureColor(element: WeaponDef["tags"]["element"]): number {
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
export function actionOwnershipAt(
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
export function remapPoseTimeAtImpact(
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
export function comboGraceMs(effectiveCooldown: number): number {
  return Math.min(0.3, Math.max(0.12, effectiveCooldown * 0.35)) * 1000;
}

/** Fixed inline Stage-1 state. Records are allocated only with the rig; animate mutates scalar fields. */
export interface JigglePartState {
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

export function clampFloatingHeadOffset(
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

export interface TomePageQuad {
  readonly quad: Phaser.GameObjects.Rectangle;
  startMs: number;
  durationMs: number;
  direction: -1 | 1;
  active: boolean;
}

export interface TomeScrap {
  readonly piece: Phaser.GameObjects.Triangle;
  startMs: number;
  direction: -1 | 1;
  seed: number;
  active: boolean;
}

export interface TomeVisualState {
  readonly openTextureKey: string;
  readonly closedTextureKey: string;
  readonly closedFrame?: string;
  readonly displayLength: number;
  readonly openRotationOffsetRad: number;
  readonly openGeometry?: WeaponArtStateGeometry;
  readonly proceduralSplay: boolean;
  readonly proceduralLeaves?: readonly [
    Phaser.GameObjects.Image,
    Phaser.GameObjects.Image,
  ];
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

export interface RigHand extends JigglePartState {
  img: Phaser.GameObjects.Image;
  elementId: Extract<WeaponElementId, "hand-l" | "hand-r" | "foot-l" | "foot-r">;
  ox: number;
  oy: number;
  front: boolean;
}

export interface RigFoot extends JigglePartState {
  img: Phaser.GameObjects.Image;
  elementId: Extract<WeaponElementId, "hand-l" | "hand-r" | "foot-l" | "foot-r">;
  ox: number;
  oy: number;
  front: boolean;
}

export interface BreakActionAttachment {
  readonly barrel: Phaser.GameObjects.Image;
  readonly shells: readonly [Phaser.GameObjects.Rectangle, Phaser.GameObjects.Rectangle];
}

export interface FlourishChannelState {
  active: boolean;
  moment: FlourishMoment;
  startMs: number;
  hand: 0 | 1;
  rotationSign: -1 | 1;
  spec: WeaponFlourishSpec;
}

export function createFlourishChannel(hand: 0 | 1): FlourishChannelState {
  return {
    active: false,
    moment: "draw",
    startMs: -1e9,
    hand,
    rotationSign: hand === 0 ? 1 : -1,
    spec: WEAPON_FLOURISH_SPECS["one-hand-blade"],
  };
}

export interface FlourishArmState {
  armed: boolean;
  earliestStartMs: number;
  weaponId: string;
}

export function createFlourishArmState(): FlourishArmState {
  return { armed: false, earliestStartMs: -1e9, weaponId: "" };
}

export interface FlourishStreakState {
  count: number;
  lastAcceptedMs: number;
  weaponId: string;
}

export function createFlourishStreakState(): FlourishStreakState {
  return { count: 0, lastAcceptedMs: -1e9, weaponId: "" };
}

export interface OutgoingStowProxy {
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

export function createOutgoingStowProxy(hand: 0 | 1): OutgoingStowProxy {
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

export interface GearAttachment extends HatSpringState {
  image: Phaser.GameObjects.Image;
  spec: GearAssemblyPart;
}

/** Rebase on construction/cuts/swaps/LOD sleep. A cut is not acceleration and must add zero energy. */
export function resetJigglePart(p: JigglePartState, ax: number, ay: number, own: number): void {
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
export function syncOwnedJigglePart(
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
export function stepJigglePart(
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

export interface PaperDeathPartPose {
  readonly img: Phaser.GameObjects.Image;
  readonly x: number;
  readonly y: number;
}

export interface PaperDeathState {
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
export const SPRITE_RIG_STATICS = Object.freeze({
  BRACE_DUR: 450,
  PARRY_SUCCESS_DUR: PARRY_ABOVE_BRACE_SECONDS * 1000,
});
export interface SpriteRigContext {
  readonly root: Phaser.GameObjects.Container;
  renderPrevX: number;
  renderPrevY: number;
  readonly scene: Phaser.Scene;
  readonly isSelf: boolean;
  readonly bladeAttachmentSourceId: string;
  scale: number;
  readonly visualEnvelopeScale: number;
  callerRigScale: number;
  baseScale: number;
  readonly body: Phaser.GameObjects.Image;
  readonly slideAfterimageA: Phaser.GameObjects.Image;
  readonly slideAfterimageB: Phaser.GameObjects.Image;
  readonly hands: RigHand[];
  readonly feet: RigFoot[];
  readonly parts: Phaser.GameObjects.Image[];
  boilerplateHead?: Phaser.GameObjects.Image;
  readonly manifestHeadOffset?: Readonly<{ x: number; y: number }>;
  boilerplateManifest?: GearPartsManifest;
  boilerplateAssembly?: BoilerplateAssembly;
  boilerplateBodyAssembly?: BoilerplateAssemblyPart;
  boilerplateHeadAssembly?: BoilerplateAssemblyPart;
  readonly floatingHeadSpring: FloatingHeadSpringState;
  readonly floatingHeadSpringInput: FloatingHeadSpringInput;
  readonly floatingHeadAttackLead: { x: number; y: number; };
  floatingHeadLodSleeping: boolean;
  loadoutHeadTexture: Readonly<ResolvedLoadoutHeadTexture>;
  boilerplateReady: boolean;
  gearAssembly?: GearLoadoutAssembly;
  gearArtComplete: boolean;
  gearLoadoutKey: string;
  gearBakeGeneration: number;
  gearBakeLease?: GearTextureBakeLease;
  gearUsesReplacement: boolean;
  gearBakeFailureReported: boolean;
  syncedGearUpper: string;
  syncedGearLower: string;
  syncedGearPrestige: number;
  readonly gearAttachments: GearAttachment[];
  readonly hatAttachments: GearAttachment[];
  readonly gearSocketScratch: { x: number; y: number; };
  readonly hatChainInput: HatChainInput;
  hatOverflowLabel?: Phaser.GameObjects.Text;
  gearLodSleeping: boolean;
  readonly label?: Phaser.GameObjects.Text;
  readonly phase: number;
  vastagharPose?: VastagharRigPose;
  vastagharDepthFront: boolean;
  lastDepth: number;
  facing: -1 | 1;
  gait: number;
  facingBlend: number;
  spawnStartMs: number;
  spawnDurationMs: number;
  foldStartMs: number;
  foldDurationMs: number;
  foldHiddenUntilMs: number;
  ultimateFamily: UltimateFamilyValue;
  ultimatePhase: UltimatePhaseValue;
  ultimateProgress: number;
  ultimateReducedMotion: boolean;
  ultimateInputAtMs: number;
  ultimateInputFamily: UltimateFamilyValue;
  paperDeath?: PaperDeathState;
  landSquash: number;
  landingSquashDepth: number;
  landingKickScale: number;
  jumpStartedMs: number;
  lastPoseHopTarget: number;
  peakHopPx: number;
  maxFallSpeed: number;
  moveStance: MoveStance;
  airStance: MoveStance;
  stanceStartedMs: number;
  landedFromStance: MoveStance;
  landedAtMs: number;
  slidePhase: SlidePhase;
  slideRenderT: number;
  slideReverseFace: boolean;
  slideEchoSampling: boolean;
  slideEchoSampleAtMs: number;
  slideEchoSampleX: number;
  slideEchoSampleY: number;
  slideEchoAX: number;
  slideEchoAY: number;
  slideEchoAAtMs: number;
  slideEchoBX: number;
  slideEchoBY: number;
  slideEchoBAtMs: number;
  headingX: number;
  headingY: number;
  turnCommit: number;
  turnDirX: number;
  turnDirY: number;
  velX: number;
  velY: number;
  slowVelX: number;
  slowVelY: number;
  strideT: number;
  jiggleSignalX: number;
  jiggleSignalY: number;
  jigglePrevRootX: number;
  jigglePrevRootY: number;
  jiggleRootReady: boolean;
  prevAnimMs: number;
  weapons: {
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
  }[];
  breakActionAttachment?: BreakActionAttachment;
  breakActionSample: BreakActionClockSample;
  breakActionAudioPhase: BreakActionPhase;
  breakActionAudioActive: boolean;
  authoritativeGunCharges: number;
  authoritativeGunMaxCharges: number;
  wrapFootWeapons: {
    img: Phaser.GameObjects.Image;
    foot: RigFoot;
    baseScale: number;
    imageFacingX: 1 | -1;
    partIndex: 1;
  }[];
  strikeOverlays: {
    img: Phaser.GameObjects.Image;
    hand: 0 | 1;
  }[];
  weaponDef?: WeaponDef;
  readonly poseVariants: PoseVariantSelection;
  poseLeadSpec?: WeaponPoseSpec;
  poseOffSpec?: WeaponPoseSpec;
  performanceSpec?: WeaponPerformanceSpec;
  readonly performanceInput: WeaponPerformanceInput;
  readonly performanceSample: WeaponPerformanceSample;
  poseTwoHanded: boolean;
  readonly movementPostureInput: MovementPostureInput;
  readonly movementPostureSample: MovementPostureSample;
  flourishLeadSpec?: WeaponFlourishSpec;
  flourishOffSpec?: WeaponFlourishSpec;
  poseLeadBladeSize: BladeSizeClass;
  bladeNeutralAngle: number;
  bladeNeutralReady: boolean;
  readonly flourishChannels: [FlourishChannelState, FlourishChannelState];
  readonly flourishInputs: [FlourishInput, FlourishInput];
  readonly flourishSamples: [FlourishSample, FlourishSample];
  readonly flourishArms: [FlourishArmState, FlourishArmState];
  readonly flourishStreaks: [FlourishStreakState, FlourishStreakState];
  readonly stowProxies: [OutgoingStowProxy, OutgoingStowProxy];
  readonly stowInputs: [FlourishInput, FlourishInput];
  readonly stowSamples: [FlourishSample, FlourishSample];
  pendingSwapKey: string;
  pendingSwapObservedKey: string;
  pendingSwapEpochMs: number;
  lastSwapKey: string;
  lastSwapObservedKey: string;
  flourishCancelGeneration: number;
  flourishHeadX: number;
  flourishHeadY: number;
  flourishMoveX: number;
  flourishMoveY: number;
  flourishReducedMotion: boolean;
  flourishReducedReady: boolean;
  flourishFireHeld: boolean;
  flourishAttackIntentHeld: boolean;
  idleFlourishEligibleAtMs: number;
  idleFlourishLastPlayedMs: number;
  idleFlourishOffsetMs: number;
  gunRecoveryWallUntilMs: number;
  readonly poseLeadInput: PoseLanguageInput;
  readonly poseLeadSample: PoseLanguageSample;
  readonly poseSupportInput: PoseLanguageInput;
  readonly poseSupportSample: PoseLanguageSample;
  readonly posePoint: { x: number; y: number; };
  readonly idleHandTarget: { x: number; y: number; };
  readonly footPoseOffset: { x: number; y: number; };
  readonly handRoleFrame: {
    phase: PoseActionPhase;
    phaseT: number;
    dualEquipped: boolean;
    pairedAimed: boolean;
    bothHandsOwned: boolean;
    actionOwnedHands: [boolean, boolean];
    visibleHands: [boolean, boolean];
  };
  readonly idleHandTargetInput: {
    bodyX: number;
    bodyY: number;
    bodyHeight: number;
    aimLocal: number;
    movementX: number;
    movementY: number;
    microX: number;
    microY: number;
    manifestSocketX: number;
    hand: 0 | 1;
    recoveryT: number | undefined;
    recoveryForward: number | undefined;
    recoveryLateral: number | undefined;
  };
  readonly secondaryGripPoint: { x: number; y: number; };
  readonly secondaryGripFlourish: GunHandlingHandOffset;
  readonly revolverHammerBeat: RevolverHammerBeatSample;
  revolverHammerLayerHand: 0 | 1 | undefined;
  readonly gunHandlingCycles: [GunHandlingCycleState, GunHandlingCycleState];
  readonly secondaryGripInput: SecondaryGripTransformInput;
  poseRecoilConsumedAtMs: number;
  loadoutKey: string;
  authoredDualBaseSeq: number;
  authoredDualBaseSeqReady: boolean;
  authoredDualBarStep: number;
  authoredDualBarExpiresAtMs: number;
  authoredDualCeremonyStartMs: number;
  authoredDualWeaponScaleX: [number, number];
  authoredDualFootWeaponScaleX: [number, number];
  authoredDualGlintAlpha: number;
  tome?: TomeVisualState;
  swingStart: number;
  swing?: RigSwingDescriptor;
  swingHand: RigSwingHand;
  swingWeaponDef?: WeaponDef;
  crossfallActive: boolean;
  readonly activeSwing: RigSwingDescriptor | undefined;
  readonly activeSwingHand: RigSwingHand;
  readonly isCrossfallActive: boolean;
  orbitT: number;
  orbitBehind: boolean;
  orbitSpin: boolean;
  swingChained: boolean;
  comboFamily: RigComboFamily;
  comboStep: number;
  comboExpiresAtMs: number;
  hasAttackBeatSeq: boolean;
  attackBeatSeq: number;
  attackBeatWallEpochMs: number;
  hasAuthoritativeFiringBeat: boolean;
  authoritativeFiringBeatSeq: number;
  authoritativeFiringAttackTick: number;
  authoritativeFiringClockTick: number;
  authoritativeFiringWeaponId: string;
  authoritativeFiringInputHeld: boolean | undefined;
  readonly comboChains: [ComboChainState, ComboChainState];
  swingStep: number;
  swingDirection: -1 | 0 | 1;
  swingFamily: RigComboFamily;
  swingVariant: MeleeComboVariant;
  comboHoldPose?: {
    readonly family: MeleeComboFamily;
    readonly variant: MeleeComboVariant;
    readonly step: number;
    readonly direction: -1 | 0 | 1;
    readonly expiresAtMs: number;
  };
  comboStageTransition?: ComboStageTransitionState;
  swingOffX: number;
  swingOffY: number;
  swingBackOffX: number;
  swingBackOffY: number;
  attackArtOffX: number;
  attackArtOffY: number;
  attackLiftPx: number;
  attackScaleY: number;
  weaponLengthScale: number;
  attackWeaponDepth: -1 | 0 | 1;
  attackShadowX: number;
  attackShadowY: number;
  attackShadowRotation: number;
  attackShadowScaleX: number;
  attackShadowScaleY: number;
  attackShadowAlpha: number;
  attackGripBlend: number;
  attackGripX: number;
  attackGripY: number;
  attackBackGripX: number;
  attackBackGripY: number;
  attackGripBoth: boolean;
  attackHandSpacing: number;
  attackFrontGripX: number;
  attackFrontGripY: number;
  attackFrontGripBlend: number;
  attackBackGripBlend: number;
  attackFrontFootX: number;
  attackFrontFootY: number;
  attackFrontFootBlend: number;
  attackBackFootX: number;
  attackBackFootY: number;
  attackBackFootBlend: number;
  readonly closeBladeInput: CloseBladePoseInput;
  readonly closeBladePose: CloseBladePoseSample;
  readonly kungFuWrapPoseInput: KungFuWrapPoseInput;
  readonly kungFuWrapPose: KungFuWrapPoseSample;
  readonly kungFuWrapRenderEvidence: { renderedSamples: number; minPaperTurnScaleX: number; maxFlipProgress: number; maxFlipAbsRotation: number; maxHandStretch: number; maxRearHandStretch: number; maxFrontFootStretch: number; maxBackFootStretch: number; maxHoldStrength: number; holdPoses: string[]; };
  readonly authoredComboFlipRenderEvidence: { renderedSamples: number; maxProgress: number; maxAbsRotation: number; };
  readonly katanaChoreographyPose: KatanaChoreographySample;
  closeBladePoseActive: boolean;
  closeBladeBodyX: number;
  closeBladeBodyY: number;
  closeBladeBodyRotation: number;
  closeBladeBodyScaleX: number;
  closeBladeBodyScaleY: number;
  closeBladeFrontHandDx: number;
  closeBladeFrontHandDy: number;
  closeBladeBackHandDx: number;
  closeBladeBackHandDy: number;
  closeBladeFrontFootDx: number;
  closeBladeFrontFootDy: number;
  closeBladeBackFootDx: number;
  closeBladeBackFootDy: number;
  signatureMotion?: MeleeComboMotion;
  readonly observedSignatureAim: { x: number; y: number; };
  observedSignaturePending: boolean;
  observedSignatureWeapon?: WeaponDef;
  observedSignatureSwing?: SwingDescriptor;
  observedSignatureHand: 0 | 1;
  observedSignatureAtMs: number;
  crossfallRibbonPending: boolean;
  crossfallRibbonAtMs: number;
  readonly observedSourceFlash: Phaser.GameObjects.Ellipse;
  readonly observedSourceRing: Phaser.GameObjects.Ellipse;
  observedSourceFlashAtMs: number;
  observedSourceHand: 0 | 1;
  gunRecoilAtMs: number;
  gunRecoilHand: 0 | 1;
  rangedAimRaiseAtMs: number;
  rangedAimActiveUntilMs: number;
  swingAimWorld: number;
  braceStart: number;
  parrySuccessStart: number;
  parrySuccessPending: boolean;
  parryGuardPose: ParryGuardPose;
  parryReaction: ParryReactionValue;
  meleeTellMode: "none" | "windup" | "commit" | "resolve" | "cancel";
  meleeTellPhase: number;
  meleeTellRemainingMs: number;
  meleeTellDurationMs: number;
  meleeTellAimWorld: number;
  meleeTellLocked: boolean;
  meleeTellFull: boolean;
  meleeTellArchetype: string;
  meleeTellStep: number;
  meleeTellEdgeAtMs: number;
  meleeTellGlintFired: boolean;
  meleeTellFirstGlintAtMs: number;
  meleeTellFirstGlintFired: boolean;
  meleeTellGold: boolean;
  meleeTellAirKeep: boolean;
  meleeTellReleaseAtMs: number;
  meleeTellCancelPhase: number;
  meleeTellReleasePose: boolean;
  enemyMeleeTintPhase: number;
  enemyMeleeAccent: number;
  enemyMeleePopUntilMs: number;
  enemyMeleeTintKey: number;
  enemyComboOwnsHop: boolean;
  enemyComboHopPx: number;
  enemyComboOfferPhase: number;
  enemyComboAimWorld: number;
  enemyComboEmpowered: boolean;
  enemyComboReturnAtMs: number;
  enemyComboLandedAtMs: number;
  enemyComboStaggerAtMs: number;
  juggledAtMs: number;
  juggleFlashActive: boolean;
  hopPx: number;
  hopTarget: number;
  baseLift: number;
  readonly shadow: Phaser.GameObjects.Ellipse;
  readonly shadowHalo: Phaser.GameObjects.Ellipse;
  readonly auraGlow: Phaser.GameObjects.Ellipse;
  readonly auraRing: Phaser.GameObjects.Ellipse;
  readonly paintedAuraFill: readonly Phaser.GameObjects.Image[];
  readonly paintedAuraParticles: readonly Phaser.GameObjects.Image[];
  readonly authoredDualGlint: Phaser.GameObjects.Rectangle;
  requestBoilerplate(manifest: GearPartsManifest): void;
  applyLoadoutHeadTexture(): void;
  createBoilerplateLimb(part: BoilerplateAssemblyPart): RigHand;
  installBoilerplateIfReady(): void;
  clearGearAttachments(): void;
  syncHatOverflowLabel(assembly: GearLoadoutAssembly): void;
  restoreBoilerplateTextures(): void;
  applyResolvedRigSockets(assembly: GearLoadoutAssembly): void;
  commitGearBakeLease(lease: GearTextureBakeLease): boolean;
  equipSyncedGear(gearUpper: string, gearLower: string, manifest: GearPartsManifest, prestige?: number): boolean;
  equipGearLoadout(loadout: Readonly<Record<GearSlot, GearId>>, manifest: GearPartsManifest, prestige?: number, towerComposition?: readonly GearId[], alternativeHead?: Readonly<AlternativeHeadTextureSelection> | null): void;
  syncGearArt(): void;
  pushGearPlane(stack: Phaser.GameObjects.GameObject[], minPlane: number, maxPlane?: number): void;
  pushWeaponLayers(stack: Phaser.GameObjects.GameObject[], weapon: (SpriteRigContext["weapons"])[number] | undefined): void;
  weaponReplacesHandReceiver(receiver: "hand-l" | "hand-r"): boolean;
  weaponReplacesFootReceiver(receiver: "foot-l" | "foot-r"): boolean;
  syncWeaponHandReplacement(): void;
  rebuildRenderStack(): void;
  syncRevolverHammerLayer(): void;
  setPosition(x: number, y: number): void;
  heldWeaponDef(hand: 0 | 1): WeaponDef | undefined;
  leadWeaponTipPose(hand?: 0 | 1): WeaponBladeAttachmentPose | undefined;
  refreshPoseLanguageSelection(rebuildGeometry: boolean, force?: boolean): void;
  sampleWeaponPose(input: PoseLanguageInput, out: PoseLanguageSample, spec: WeaponPoseSpec, timeS: number, phase: PoseActionPhase, phaseT: number, strikingHand: 0 | 1, freeHand: 0 | 1 | -1, reducedMotion: boolean, beamPhase: PoseBeamPhase | undefined): void;
  handWorldAnchor(hand: 0 | 1): { x: number; y: number };
  throwWorldAnchor(): { x: number; y: number };
  writeWeaponArtMuzzle(point: WeaponArtMuzzlePoint, out: { x: number; y: number }, preferredHand?: 0 | 1): boolean;
  writeWeaponMuzzle(hand: 0 | 1, out: { x: number; y: number }, pointIndex?: number): boolean;
  writeWeaponMuzzleForShot(acceptedSeq: number, barrelIndex: number, out: { x: number; y: number }, salvoIndex?: number): boolean;
  writeKungFuWrapMuzzle(limb: MeleeComboLimb | undefined, side: 0 | 1, out: { x: number; y: number }): boolean;
  triggerGunRecoil(timeMs: number, hand: 0 | 1): void;
  holdRangedAim(epochMs: number, durationMs: number): void;
  offWeaponLean(): number;
  destroyStowProxy(proxy: OutgoingStowProxy): void;
  clearFlourishActivity(clearArms: boolean, clearProxies: boolean): void;
  idleFlourishClockDef(): WeaponDef | undefined;
  idleFlourishTimerNow(fallbackMs: number): number;
  cancelFlourish(_reason?: string): void;
  readonly flourishCancelEdge: number;
  readonly weaponSwapPending: boolean;
  resetFlourishState(clearCounters: boolean, preservePendingSwap?: boolean, preserveArms?: boolean): void;
  beatFor(spec: WeaponFlourishSpec, moment: FlourishMoment): FlourishBeatSpec;
  startFlourishChannel(hand: 0 | 1, moment: FlourishMoment, startMs: number, spec: WeaponFlourishSpec): void;
  startIncomingDraw(epochMs: number): void;
  beginWeaponSwap(oldWeaponId: string, newWeaponId: string, epochMs: number): void;
  finishWeaponSwapWithoutArt(): void;
  completePendingWeaponSwap(): void;
  armAfterAttack(hand: 0 | 1, earliestStartMs: number, def: WeaponDef): void;
  recordAcceptedRangedBeat(hand: 0 | 1, epochMs: number): void;
  cancelForAcceptedRangedBeat(hand: 0 | 1): void;
  tryStartArmedFlourish(sceneNow: number): void;
  sampleFlourishChannel(hand: 0 | 1, sceneNow: number, aimLocal: number, reducedMotion: boolean): FlourishSample;
  updateStowProxies(sceneNow: number, reducedMotion: boolean): void;
  resetSecondaryMotion(): void;
  setDepth(d: number): void;
  setHop(px: number): void;
  setEnemyComboPresentation(offerPhase: number, leapHeight: number, empowered: boolean, aimWorld: number): void;
  triggerEnemyComboReturn(timeMs: number): void;
  triggerEnemyComboLanding(timeMs: number): void;
  triggerEnemyComboStagger(timeMs: number): void;
  triggerJuggled(timeMs: number): void;
  setLowerBodyFrame(frac: number): void;
  setVastagharPose(pose: VastagharRigPose | undefined): void;
  playSpawnUnfold(timeMs: number, durationMs?: number): void;
  playFoldUp(timeMs: number, durationMs?: number): void;
  createPaperCopy(x: number, y: number, tint?: number): Phaser.GameObjects.Container;
  triggerUltimateWindup(timeMs: number, family: UltimateFamilyValue): void;
  setUltimatePresentation(family: UltimateFamilyValue, phase: UltimatePhaseValue, progress: number, reducedMotion: boolean): void;
  deathPop(vx: number, vy: number, treatment?: PaperDeathTreatment): void;
  stepDeathPop(deltaMs: number): boolean;
  setRigScale(mult: number): void;
  addGlow(color: number): void;
  resetSwingCombo(): void;
  beginComboStageTransition(acceptedAtMs: number, swing: RigSwingDescriptor): void;
  applyComboStageTransition(sceneNow: number): void;
  applyComboStageShadowTransition(sceneNow: number): void;
  releaseAttackVisuals(): void;
  resetComboChain(clearHold: boolean): void;
  presentationClockNow(): number;
  presentationEpochForWallEpoch(epochMs: number): number;
  flushObservedAttackSignature(sceneNow: number, outsidePaperView: boolean): void;
  flushCrossfallRibbon(sceneNow: number, outsidePaperView: boolean): void;
  syncObservedSourceFlash(sceneNow: number, outsidePaperView: boolean): void;
  destroyTomeVisual(): void;
  setupTomeVisual(spriteId: string, def: WeaponDef, closedTexture: { key: string; frame?: string }): void;
  setAttackBeat(seq: number, held: boolean, epochMs: number, authoritative?: boolean): void;
  hideTomeShapes(tome: TomeVisualState): void;
  setTomeClosed(tome: TomeVisualState): void;
  startTomePage(tome: TomeVisualState, startMs: number, seq: number, settling: boolean): void;
  prepareFiringFrames(): void;
  refreshBreakActionClock(): void;
  breakActionEvidence(): Readonly<{
    active: boolean;
    angleRad: number;
    barrelRotationRad: number;
    ejectStrength: number;
    muzzleAllowed: boolean;
    phase: BreakActionPhase;
    shellCount: number;
  }>;
  setAuthoritativeAttackClock(attackTick: number, clockTick: number, charges?: number, maxCharges?: number, fireInputHeld?: boolean): void;
  prepareTomeVisual(sceneNow: number, outsidePaperView: boolean): void;
  syncTomeVisual(sceneNow: number, outsidePaperView: boolean): void;
  applyWeaponArtGeometry(): void;
  applyBreakActionGeometry(): void;
  syncWrapFootWeapons(): void;
  equipWeapon(spriteId: string, def: WeaponDef, manifest: SpriteManifest): void;
  destroyWrapFootWeapons(): void;
  destroyStrikeOverlays(): void;
  setupStrikeOverlays(spriteId: string, def: WeaponDef, manifest: SpriteManifest): void;
  syncStrikeOverlays(sceneNow: number, outsidePaperView: boolean): void;
  destroyBreakActionAttachment(): void;
  setupBreakActionAttachment(spriteId: string, def: WeaponDef, manifest: SpriteManifest): void;
  equipAuthoredWeapon(lead: RigLoadoutPiece, off?: RigLoadoutPiece): void;
  triggerSwing(timeMs: number, aimWorld?: number, swing?: RigSwingDescriptor, handOverride?: RigSwingHand, authoredDualStepOverride?: number): void;
  setMeleeTell(phase: number, aimWorld: number, remainingMs: number, locked: boolean, archetype?: string, step?: number, full?: boolean, gold?: boolean, airKeep?: boolean): void;
  setEnemyMeleeTelegraph(phase: number, accent: number): void;
  commitMeleeTell(timeMs: number, aimWorld: number): void;
  resolveMeleeTell(timeMs: number, aimWorld: number): void;
  cancelMeleeTell(timeMs: number): void;
  getMeleeTellAnchor(out: { x: number; y: number }): boolean;
  triggerBrace(timeMs: number): void;
  triggerParrySuccess(timeMs: number, guardPose: ParryGuardPose, reaction: ParryReactionValue): void;
  branded: boolean;
  downed: boolean;
  flashTimer?: Phaser.Time.TimerEvent;
  setBranded(on: boolean): void;
  setDowned(on: boolean): void;
  restTint(): void;
  applySlideInkTell(on: boolean): void;
  updateSlideAfterimages(timeMs: number, reducedMotion: boolean): void;
  writeSlideAfterimage(image: Phaser.GameObjects.Image, worldX: number, worldY: number, ageMs: number, maxAlpha: number, reducedMotion: boolean): void;
  clearMeleeTellState(): void;
  clearMeleeTellTint(): void;
  destroyMeleeTellLayers(): void;
  ensureMeleeTellLayers(weapon: (SpriteRigContext["weapons"])[number]): void;
  updateMeleeTellWeaponVisuals(sceneNow: number): void;
  updateJuggleFlash(sceneNow: number): void;
  flash(ms?: number, color?: number): void;
  readonly x: number;
  readonly y: number;
  unequip(def: WeaponDef, preservePendingSwap?: boolean): void;
  destroy(): void;
  setComboFootwork(tt: number, activeStart: number, activeEnd: number, followEnd: number, aimLocal: number, frontForward: number, frontLateral: number, backForward: number, backLateral: number): void;
  setRearPivotGrip(angle: number, rearX: number, rearY: number, spacing: number, blend: number): void;
  applyMomentumCombo(motion: MeleeComboMotion, tt: number, aimLocal: number): number;
  applyBreachCombo(motion: MeleeComboMotion, tt: number, aimLocal: number): number;
  applyCompassCombo(motion: MeleeComboMotion, tt: number, aimLocal: number): number;
  applyHookbreakCombo(motion: MeleeComboMotion, tt: number, aimLocal: number): number;
  applyFulcrumFlip(tt: number, aimLocal: number): number;
  applyStinger(tt: number, aimLocal: number): number;
  applyHeroSpin(tt: number, aimLocal: number): number;
  applyPommelBash(tt: number, aimLocal: number): number;
  applyTrueChargedSlam(tt: number, aimLocal: number): number;
  applyGravechillCombo(motion: MeleeComboMotion, tt: number, aimLocal: number): number;
  applyStormpetalCombo(motion: MeleeComboMotion, tt: number, aimLocal: number): number;
  applyJumpFeelPose(timeMs: number, anim: RigAnim): void;
  applyEnemyComboPresentationPose(timeMs: number): void;
  applyUltimateRootPresentation(timeMs: number): void;
  applyUltimatePose(timeMs: number): void;
  vastagharFoot(sourceFoot: number): RigFoot | undefined;
  applyVastagharPose(reducedMotion: boolean): void;
  sampleFloatingHeadAttackLead(sceneNow: number, anim: RigAnim, reducedMotion: boolean): void;
  syncFloatingHeadPose(elapsedSeconds: number, outsidePaperView: boolean, rebase: boolean, reducedMotion: boolean, localMoveX: number, moveY: number, localSpringSignalX: number, springSignalY: number, landed: boolean, movementHeadBobPx: number): void;
  placeHeadGear(attachment: GearAttachment): void;
  placeBodyGear(attachment: GearAttachment): void;
  placeNodeGear(attachment: GearAttachment): void;
  topSocketPosition(attachment: GearAttachment, out: { x: number; y: number }): void;
  syncGearPose(elapsedSeconds: number, outsidePaperView: boolean, rebase: boolean, reducedMotion: boolean, excitation: number, dashLean: number, landed: boolean): void;
  animate(timeMs: number, anim: RigAnim): void;
}
const SpriteRig = SPRITE_RIG_STATICS;

export const rigCoreMethods = {

  setPosition(this: SpriteRigContext, x: number, y: number): void {
    this.root.setPosition(x, y);
  },

  heldWeaponDef(this: SpriteRigContext, hand: 0 | 1): WeaponDef | undefined {
    return this.weapons[hand]?.def;
  },

  /** Allocation-free lifetime reset; the next authored anchors rebase before any excitation is accepted. */
  resetSecondaryMotion(this: SpriteRigContext): void {
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
  },

  /** Top-down draw order: lower on screen renders in front. */
  setDepth(this: SpriteRigContext, d: number): void {
    const depth = Math.round(d);
    if (depth === this.lastDepth) return;
    this.lastDepth = depth;
    this.root.setDepth(depth);
  },

  /** §5 jump hop: lift the rendered art by `px` (peak of the arc). The container's logical position is
   *  untouched, so the camera + depth-sort stay grounded — only the visible body/hands/feet/weapon rise. */
  setHop(this: SpriteRigContext, px: number): void {
    this.hopTarget = px;
  },

  /** Set/clear the seekable flagship pose. The caller reasserts it each frame; no milestone tween owns it. */
  setVastagharPose(this: SpriteRigContext, pose: VastagharRigPose | undefined): void {
    this.vastagharPose = pose?.active ? pose : undefined;
    if (!this.vastagharPose && this.vastagharDepthFront) {
      for (const foot of this.feet) this.root.moveBelow(foot.img, this.body);
      this.vastagharDepthFront = false;
    }
  },

  /** Arrival envelope is evaluated by `animate()` so facing, combo poses, and jiggle keep transform ownership. */
  playSpawnUnfold(this: SpriteRigContext, timeMs: number, durationMs = 220): void {
    this.resetFlourishState(false);
    this.foldStartMs = -1;
    this.foldHiddenUntilMs = -1;
    this.spawnDurationMs = Math.max(1, durationMs);
    this.spawnStartMs = timeMs + Math.floor(this.phase * 70);
    this.root.scaleX = this.baseScale * 0.82;
    this.root.scaleY = this.baseScale * -0.04;
    this.root.rotation = 0.045;
  },

  /** Cosmetic-only departure twin of `playSpawnUnfold`; teleport ownership stays entirely server-side. */
  playFoldUp(this: SpriteRigContext, timeMs: number, durationMs = 120): void {
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
  },

  /** Freeze the current printed layers into a lightweight Dimension Door decoy (no logical actor). */
  createPaperCopy(this: SpriteRigContext, x: number, y: number, tint = 0x8f82d8): Phaser.GameObjects.Container {
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
  },

  /** Immediate key response only: authoritative phase replaces this as soon as the row advances. */
  triggerUltimateWindup(this: SpriteRigContext, timeMs: number, family: UltimateFamilyValue): void {
    this.cancelFlourish("ultimate-input");
    this.ultimateInputAtMs = timeMs;
    this.ultimateInputFamily = family;
  },

  /** Drive lasting pose/tint state exclusively from the synced nested UltimateState row. */
  setUltimatePresentation(this: SpriteRigContext,
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
  },

  /** §20 detached death: crumple, through-plane flutter, tear, or the cheap overflow/pit fold. */
  deathPop(this: SpriteRigContext, vx: number, vy: number, treatment: PaperDeathTreatment = "flutter"): void {
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
  },

  /** Advance a detached paper death. Returns false after it destroys its rig. */
  stepDeathPop(this: SpriteRigContext, deltaMs: number): boolean {
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
  },

  /** Scale the whole rig UNIFORMLY (bosses/toughs are BIGGER, not more detailed — §28.6). Stored so
   *  `animate()` re-applies it to both axes (the facing flip only touches scaleX). */
  setRigScale(this: SpriteRigContext, mult: number): void {
    if (mult !== this.callerRigScale) {
      this.resetFlourishState(false);
      this.resetSecondaryMotion();
    }
    this.callerRigScale = mult;
    this.baseScale = mult * this.visualEnvelopeScale;
    this.root.setScale(this.baseScale);
  },

  /** Add a pulsing glow behind the body — the §15 "tough = glowier" tell. Lives in the container
   *  so it scales + moves with the rig. */
  addGlow(this: SpriteRigContext, color: number): void {
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
  },

  /** Toggle the §8 Brand tint. Cheap + idempotent — the scene calls it each frame off the synced state. */
  setBranded(this: SpriteRigContext, on: boolean): void {
    if (on === this.branded) return;
    this.branded = on;
    this.restTint();
  },

  /** §6 DOWNED look: fade + a cold grey tint (a body on the ground), or restore on revive. */
  setDowned(this: SpriteRigContext, on: boolean): void {
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
  },

  /** Re-apply the resting tint. B33's enemy-body tell overrides ordinary live-state tints. */
  restTint(this: SpriteRigContext): void {
    const meleeWhitePop = this.presentationClockNow() < this.enemyMeleePopUntilMs;
    const meleeRamp = smoothstep01(this.enemyMeleeTintPhase);
    const meleeTint = mixRgb(0xffffff, this.enemyMeleeAccent, meleeRamp);
    const apply = (part: Phaser.GameObjects.Image): void => {
      if (this.downed) part.setTint(0x556070).setTintMode(Phaser.TintModes.MULTIPLY);
      else if (meleeWhitePop) part.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
      else if (meleeRamp > 0)
        part.setTint(meleeTint).setTintMode(Phaser.TintModes.MULTIPLY);
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
  },

  get x(): number {
    return this.root.x;
  },

  get y(): number {
    return this.root.y;
  },

  /** Drop to EMPTY HANDS (the §9 fists fallback) — clears any held weapon sprite but keeps `def` so the
   *  unarmed swing still animates with the fists range/arc. Used when a weapon is dropped/salvaged. */
  unequip(this: SpriteRigContext, def: WeaponDef, preservePendingSwap = false): void {
    if (!preservePendingSwap) this.resetFlourishState(true);
    else {
      if (this.pendingSwapKey) this.pendingSwapEpochMs = Number.NaN;
      for (const channel of this.flourishChannels) channel.active = false;
      for (const arm of this.flourishArms) arm.armed = false;
    }
    this.destroyMeleeTellLayers();
    this.destroyTomeVisual();
    this.destroyWrapFootWeapons();
    this.destroyStrikeOverlays();
    this.destroyBreakActionAttachment();
    for (const w of this.weapons) w.img.destroy();
    this.weapons = [];
    this.syncWeaponHandReplacement();
    this.weaponDef = def;
    this.refreshPoseLanguageSelection(false, true);
    this.loadoutKey = def.id;
    this.authoredDualBaseSeq = 0;
    this.authoredDualBaseSeqReady = false;
    this.authoredDualBarStep = -1;
    this.authoredDualBarExpiresAtMs = -1e9;
    this.authoredDualCeremonyStartMs = -1e9;
    this.authoredDualGlint.setVisible(false);
    this.resetSwingCombo();
    this.resetSecondaryMotion();
    this.revolverHammerLayerHand = undefined;
    this.clearMeleeTellState();
    this.rebuildRenderStack();
  },

  destroy(this: SpriteRigContext): void {
    this.resetFlourishState(true);
    this.gearBakeGeneration++;
    // §20 the delayed callback closes over this rig; detach it before destroying the visible hierarchy.
    this.flashTimer?.remove(false);
    this.flashTimer = undefined;
    this.destroyMeleeTellLayers();
    this.destroyTomeVisual();
    this.destroyWrapFootWeapons();
    this.destroyStrikeOverlays();
    this.destroyBreakActionAttachment();
    for (const w of this.weapons) w.img.destroy();
    this.hatOverflowLabel?.destroy();
    this.hatOverflowLabel = undefined;
    for (const attachment of this.gearAttachments) attachment.image.destroy();
    this.gearAttachments.length = 0;
    this.hatAttachments.length = 0;
    this.root.destroy();
    this.gearBakeLease?.release();
    this.gearBakeLease = undefined;
  },
} satisfies ThisType<SpriteRigContext>;
