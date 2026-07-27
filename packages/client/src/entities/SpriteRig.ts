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
  MOVE_TURN_PRESENTATION_MIN_ANGLE,
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
  PROCEDURAL_LIMB_PHYSICS,
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
} from "../sprites/art-geometry.generated.js";
import { firingFrameSpriteAt, resolveWeaponFiringFrame } from "../sprites/firing-frame.js";
import {
  firingHandTarget,
  firingStanceFor,
  fistGunShotHandOffset,
  gunCheekWeldPoseFor,
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
} from "./kung-fu-wrap-pose.js";import { SPRITE_ATLAS, partTexture, TARGET_BODY_H, BODY_LOOK_LEAN, MELEE_FORWARD_READY_CANT, forwardMeleeReadyAngle, PARRY_GUARD_ANGLE_OFFSETS, PARRY_GUARD_HAND_FORWARD, PARRY_GUARD_HAND_LIFT, CLIENT_VISUAL_COMBOS, COMBO_HOLD_RELEASE_MS, MONK_FLURRY_MIN_POSE_MS, COMBO_STAGE_TRANSITION_MAX_MS, MELEE_GLINT_LEAD_MS, MELEE_GLINT_CREST_MS, TOME_IDLE_CLOSE_MS, TOME_PAGE_INTERVAL_MS, TOME_PAGE_DURATION_MS, TOME_SETTLE_DURATION_MS, TOME_SCRAP_DURATION_MS, REMOTE_SIGNATURE_LOD_MARGIN_PX, REMOTE_SOURCE_FLASH_MS, RANGED_AIM_LINGER_MS, RANGED_AIM_RAISE_MS, RANGED_AIM_SETTLE_MS, GUN_RECOIL_ACTIVE_MS, RANGED_GUN_RECOVERY_MS, DUAL_BACK_WEAPON_LEAN, CLOSE_BLADE_RELEASE_T, authoredWeaponRenderPlan, opposedWhirlwindPose, NO_WRAP_RIG_MOUNTS, FOUR_LIMB_WRAP_RIG_MOUNTS, wrapRigMountPlan, wrapRigFacingSign, wrapRigReceiverRelativeScale, strikeOverlayImpactVisible, measureBladeWidthAtExtensionJoin, createComboChainState, CROSSFALL_STEP, routeSwingChannels, isTerminalFlourishStep, flourishStreakWindowMs, flourishMovementIntent, rawFlourishIntentCancels, nextFlourishStreakCount, PISTOL_IDLE_TWIRL_DELAY_MS, PISTOL_DUAL_TWIRL_STAGGER_MS, GENERIC_IDLE_FLOURISH_DELAY_MS, DUAL_PISTOL_HAND_RISE_BODY_FRAC, idleFlourishEligibleEpoch, flourishCanOverridePersistentGunAim, authoredDualPistolHandYOffset, createGunHandlingCycleState, gunHandlingMechanismFor, gunHandlingCycleDurationMs, sampleGunHandlingHandOffset, resolveSecondaryGripPosition, resolveBreakActionSecondaryGripPosition, clamp01, smoothstep01, mixRgb, smootherstep01, cubicOut01, backOut01, mixAngle, comboStageTransitionDurationMs, comboStageTransitionBlend, blendComboStagePoseTransform, blendComboStagePresentationTransform, stepAngleBounded, paperPopScaleX, paperPopScaleY, paperPopRotation, signedClamp, sampleAuthoredDualCeremony, attackSignatureColor, actionOwnershipAt, remapPoseTimeAtImpact, createCloseBladePoseInput, createCloseBladePoseSample, sampleCloseBladePose, comboGraceMs, FLOATING_HEAD_SPRING_TUNING, sampleFloatingHeadWalkBob, clampFloatingHeadOffset, stepFloatingHeadSpring, createFlourishChannel, createFlourishArmState, createFlourishStreakState, createOutgoingStowProxy, resetJigglePart, syncOwnedJigglePart, stepJigglePart, sampleRangedAimBlend, facingLayoutSign, stepFacingFlip, rigCoreMethods, SPRITE_RIG_STATICS } from "./rig/rig-core.js";
import type { RigComboFamily, RigSwingHand, RigLoadoutPiece, OpposedWhirlwindPose, WrapRigReceiver, WrapRigMount, WrapRigScaleInput, RigSwingDescriptor, WeaponBladeAttachmentPose, ComboChainState, ComboStageTransitionState, ComboStageTransformNode, SwingChannelSample, RawFlourishIntent, GunHandlingMechanism, GunHandlingCycleState, GunHandlingHandOffset, SecondaryGripTransformInput, RigAttackPresentationScene, ComboStageTransitionTiming, ComboStagePoseTransform, ComboStageParentTransform, AuthoredDualCeremonySample, CloseBladePoseVariant, CloseBladePoseInput, CloseBladePoseSample, JigglePartState, FloatingHeadSpringState, FloatingHeadSpringInput, FloatingHeadSpringTuning, TomePageQuad, TomeScrap, TomeVisualState, RigHand, RigFoot, BreakActionAttachment, FlourishChannelState, FlourishArmState, FlourishStreakState, OutgoingStowProxy, GearAttachment, RigAnim, VastagharRigPose, PaperDeathTreatment, PaperDeathPartPose, PaperDeathState } from "./rig/rig-core.js";
import { rigPoseMethods } from "./rig/rig-pose.js";
import { rigCombatMethods } from "./rig/rig-combat.js";
import { rigGunMechanismMethods } from "./rig/rig-gun-mechanisms.js";
import { rigFlourishMethods } from "./rig/rig-flourish.js";
import { rigGearMethods } from "./rig/rig-gear.js";
import { LimbPriorityResolver } from "./rig/rig-limb-priority.js";


export { GEAR_PARTS_MANIFEST } from "../sprites/gear-parts.js";
export {
  createRevolverHammerBeatSample,
  revolverHammerBeatDurationMs,
  sampleRevolverHammerBeat,
} from "../sprites/pose-language.js";

export { secondaryGripHandRendersAbove } from "../sprites/secondary-grip.js";

export interface AuthoredRigElementSnapshot {
  elementId: WeaponElementId;
  facing: 1 | -1;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** §42 a WORN weapon (gauntlet/claw/glove/knuckles) is worn ON the hand, not held by the cuff: the rig
 *  mounts its pivot where the hand sits INSIDE the glove and renders the art OVER the hand. Matched by
 *  the gauntlet/fist FAMILIES plus worn WORDS in the name (the melee claws hide under "exotic-melee");
 *  word-boundaries keep held gear out ("Knucklebone Censer-Orb" is a censer on a chain, not knuckles). */
export { isWornWeapon };export { SPRITE_ATLAS, partTexture, MELEE_FORWARD_READY_CANT, forwardMeleeReadyAngle, COMBO_STAGE_TRANSITION_MAX_MS, RANGED_AIM_LINGER_MS, RANGED_AIM_RAISE_MS, RANGED_AIM_SETTLE_MS, RANGED_GUN_RECOVERY_MS, authoredWeaponRenderPlan, opposedWhirlwindPose, wrapRigMountPlan, wrapRigFacingSign, wrapRigReceiverRelativeScale, strikeOverlayImpactVisible, measureBladeWidthAtExtensionJoin, routeSwingChannels, isTerminalFlourishStep, flourishStreakWindowMs, flourishMovementIntent, rawFlourishIntentCancels, nextFlourishStreakCount, PISTOL_IDLE_TWIRL_DELAY_MS, PISTOL_DUAL_TWIRL_STAGGER_MS, DUAL_PISTOL_HAND_RISE_BODY_FRAC, idleFlourishEligibleEpoch, flourishCanOverridePersistentGunAim, authoredDualPistolHandYOffset, gunHandlingMechanismFor, gunHandlingCycleDurationMs, sampleGunHandlingHandOffset, resolveSecondaryGripPosition, resolveBreakActionSecondaryGripPosition, comboStageTransitionDurationMs, comboStageTransitionBlend, blendComboStagePoseTransform, blendComboStagePresentationTransform, sampleAuthoredDualCeremony, createCloseBladePoseInput, createCloseBladePoseSample, sampleCloseBladePose, FLOATING_HEAD_SPRING_TUNING, sampleFloatingHeadWalkBob, stepFloatingHeadSpring, sampleRangedAimBlend, FACING_FLIP_MAX_SPEED, facingLayoutSign, stepFacingFlip } from "./rig/rig-core.js";
export {
  gunHandlingHandFor,
  revolverHammerHandFor,
  secondaryGripHandRotationFor,
} from "./rig/rig-gun-mechanisms.js";
export type { RigSwingHand, RigLoadoutPiece, OpposedWhirlwindPose, WrapRigReceiver, WrapRigMount, WrapRigScaleInput, RigSwingDescriptor, WeaponBladeAttachmentPose, SwingChannelSample, RawFlourishIntent, GunHandlingMechanism, GunHandlingHandOffset, SecondaryGripTransformInput, ComboStagePoseTransform, ComboStageParentTransform, AuthoredDualCeremonySample, CloseBladePoseVariant, CloseBladePoseInput, CloseBladePoseSample, FloatingHeadSpringState, FloatingHeadSpringInput, FloatingHeadSpringTuning, RigAnim, VastagharRigPose, PaperDeathTreatment } from "./rig/rig-core.js";
export type { PresentedActorState, PresentationFrame } from "./rig/rig-presentation.js";


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
  /** Retained render-only mirror state; velocity survives rapid target reversals instead of restarting. */
  private readonly facingFlip = { visual: 1, velocity: 0 };
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
  /** B68 one final owner per visual limb. Candidate modules never commit by execution order. */
  private readonly limbPriority = new LimbPriorityResolver();
  /** §8 parry brace envelope duration (ms) ≈ PARRY_IFRAMES. Hoisted so `triggerBrace` can plateau a chain. */
    private static readonly BRACE_DUR = SPRITE_RIG_STATICS.BRACE_DUR;
    private static readonly PARRY_SUCCESS_DUR = SPRITE_RIG_STATICS.PARRY_SUCCESS_DUR;
  /** Held weapon piece(s) — one per hand for an authored pre-made dual. Live INSIDE the container so the
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
  /** Frostbore-only registered part-2 layer; it is not a second held weapon/hand. */
  private breakActionAttachment?: BreakActionAttachment;
  private breakActionSample: BreakActionClockSample = {
    active: false,
    angleRad: 0,
    ejectStrength: 0,
    elapsedTicks: 0,
    muzzleAllowed: true,
    phase: "closed",
    progress: 1,
    totalTicks: 0,
  };
  private breakActionAudioPhase: BreakActionPhase = "closed";
  private breakActionAudioActive = false;
  private authoritativeGunCharges = 0;
  private authoritativeGunMaxCharges = 0;
  /** B19 worn foot sprites stay separate from held-hand weapon channels, which are intentionally 0/1 only. */
  private wrapFootWeapons: {
    img: Phaser.GameObjects.Image;
    foot: RigFoot;
    baseScale: number;
    imageFacingX: 1 | -1;
    partIndex: 1;
  }[] = [];
  /** Same-registration recovered flame art, hidden except on the selected striking hand's impact frames. */
  private strikeOverlays: {
    img: Phaser.GameObjects.Image;
    hand: 0 | 1;
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
    hand: 0 | 1;
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
    hand: 0,
    recoveryT: undefined,
    recoveryForward: undefined,
    recoveryLateral: undefined,
  };
  private readonly secondaryGripPoint = { x: 0, y: 0 };
  private readonly secondaryGripFlourish: GunHandlingHandOffset = { forward: 0, lateral: 0 };
  private readonly revolverHammerBeat = createRevolverHammerBeatSample();
  /** Accepted revolver hammer motion temporarily shares the explicit above-art hand policy used by
   *  pump/lever/crank grips. Undefined restores the ordinary retained hand/weapon stack. */
  private revolverHammerLayerHand: 0 | 1 | undefined;
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
  private authoredDualBaseSeq = 0;
  private authoredDualBaseSeqReady = false;
  private authoredDualBarStep = -1;
  private authoredDualBarExpiresAtMs = -1e9;
  private authoredDualCeremonyStartMs = -1e9;
  private authoredDualWeaponScaleX: [number, number] = [1, 1];
  /** B25 signature kicks stretch the independently-mounted worn feet, then snap to identity. */
  private authoredDualFootWeaponScaleX: [number, number] = [1, 1];
  private authoredDualGlintAlpha = 0;
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
    declare readonly activeSwing: typeof rigCombatMethods.activeSwing;
    declare readonly activeSwingHand: typeof rigCombatMethods.activeSwingHand;
    declare readonly isCrossfallActive: typeof rigCombatMethods.isCrossfallActive;
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
  private authoritativeFiringInputHeld: boolean | undefined;
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
  /**
   * Retained high-water marks from frames the rig actually rendered. The live gate resets this
   * record between captures so sub-frame theatrical beats remain auditable at throttled browser
   * polling rates without changing their authored timing.
   */
  private readonly kungFuWrapRenderEvidence = {
    renderedSamples: 0,
    minPaperTurnScaleX: 1,
    maxFlipProgress: -1,
    maxFlipAbsRotation: 0,
    maxHandStretch: 1,
    maxRearHandStretch: 1,
    maxFrontFootStretch: 1,
    maxBackFootStretch: 1,
    maxHoldStrength: 0,
    holdPoses: [] as string[],
  };
  /**
   * Raw requested paper-turn telemetry complements Phaser's wrapped `rotation` property. Phaser
   * normalizes every assigned angle to +/-PI, so a completed 2PI turn cannot be distinguished from
   * rest by sampling the container alone.
   */
  private readonly authoredComboFlipRenderEvidence = {
    renderedSamples: 0,
    maxProgress: -1,
    maxAbsRotation: 0,
  };
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
  /** B26 authoritative successful-block payload; the receipt edge arms one shared remote/local pose clock. */
  private parrySuccessStart = -1e9;
  /** Priority hitstop skips animation ticks; retain the success until one frame can actually pose it. */
  private parrySuccessPending = false;
  private parryGuardPose: ParryGuardPose = 0;
  private parryReaction: ParryReactionValue = ParryReaction.None;
  /** Enemy-only parry performance. Synced windup supplies phase; resolve/cancel never start a fresh swing. */
  private meleeTellMode: "none" | "windup" | "commit" | "resolve" | "cancel" = "none";
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
  /** B33 enemy-body telegraph. Accent is a multiply ramp; commit is a one-frame white fill. */
  private enemyMeleeTintPhase = 0;
  private enemyMeleeAccent = 0xffffff;
  private enemyMeleePopUntilMs = -1e9;
  private enemyMeleeTintKey = -1;
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
  private readonly paintedAuraFill: readonly Phaser.GameObjects.Image[];
  private readonly paintedAuraParticles: readonly Phaser.GameObjects.Image[];
  private readonly authoredDualGlint: Phaser.GameObjects.Rectangle;

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
            elementId: p.role as Extract<
              WeaponElementId,
              "hand-l" | "hand-r" | "foot-l" | "foot-r"
            >,
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
            elementId: p.role as Extract<
              WeaponElementId,
              "hand-l" | "hand-r" | "foot-l" | "foot-r"
            >,
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
    this.authoredDualGlint = scene.add
      .rectangle(0, 0, 2, 28, 0xffffff, 1)
      .setOrigin(0.5)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false);
    order.push(this.observedSourceRing, this.observedSourceFlash, this.authoredDualGlint);
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

  /** Pose Studio read-only hit geometry for the exact final images rendered by this rig. */
  authoredElementSnapshots(): AuthoredRigElementSnapshot[] {
    const snapshots: AuthoredRigElementSnapshot[] = [];
    const add = (elementId: WeaponElementId, image: Phaser.GameObjects.Image | undefined): void => {
      if (!image?.active || !image.visible || image.alpha <= 0.01) return;
      const bounds = image.getBounds();
      if (!(bounds.width > 0 && bounds.height > 0)) return;
      snapshots.push({
        elementId,
        facing: this.facing,
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
      });
    };
    add("head", this.boilerplateHead);
    for (const hand of this.hands) add(hand.elementId, hand.img);
    for (const foot of this.feet) add(foot.elementId, foot.img);
    for (const weapon of this.weapons) add(`part-${weapon.partIndex + 1}`, weapon.img);
    add("part-2", this.breakActionAttachment?.barrel);
    for (const weapon of this.wrapFootWeapons) add(`part-${weapon.partIndex + 1}`, weapon.img);
    if (this.weaponDef?.strikeOverlayPart) {
      for (const overlay of this.strikeOverlays) {
        add(`part-${this.weaponDef.strikeOverlayPart}`, overlay.img);
      }
    }
    return snapshots;
  }

  /** Read-only B68 probe surface: exactly one resolved owner and blend weight per rendered limb. */
  limbPrioritySnapshot() {
    return this.limbPriority.snapshot();
  }

  /** Select the fixed blank kit without ever exposing an unresolved texture key. */
    private declare requestBoilerplate: OmitThisParameter<typeof rigGearMethods.requestBoilerplate>;

  /** Texture-only helmet seam: unresolved future head art safely leaves the boilerplate head installed. */
    private declare applyLoadoutHeadTexture: OmitThisParameter<typeof rigGearMethods.applyLoadoutHeadTexture>;

  /** A compatibility scaffold may omit a limb; promote the authored boilerplate part into the normal
   * hand/foot arrays so every pose and limb-physics writer sees the same complete five-node base skeleton. */
    private declare createBoilerplateLimb: OmitThisParameter<typeof rigGearMethods.createBoilerplateLimb>;

  /** Atomically retarget the retained skeleton once all six loose textures exist. */
    private declare installBoilerplateIfReady: OmitThisParameter<typeof rigGearMethods.installBoilerplateIfReady>;

    private declare clearGearAttachments: OmitThisParameter<typeof rigGearMethods.clearGearAttachments>;

    private declare syncHatOverflowLabel: OmitThisParameter<typeof rigGearMethods.syncHatOverflowLabel>;

    private declare restoreBoilerplateTextures: OmitThisParameter<typeof rigGearMethods.restoreBoilerplateTextures>;

  /** Apply the shared source-card socket solution to this retained rig's procedural limb rest points. */
    private declare applyResolvedRigSockets: OmitThisParameter<typeof rigGearMethods.applyResolvedRigSockets>;

    private declare commitGearBakeLease: OmitThisParameter<typeof rigGearMethods.commitGearBakeLease>;

  /**
   * Diff a validated account loadout onto retained gear images. The optional composition is already bounded
   * account data; absent composition repeats the equipped signature hat through unlocked prestige slots.
   */
    declare equipSyncedGear: OmitThisParameter<typeof rigGearMethods.equipSyncedGear>;

    declare equipGearLoadout: OmitThisParameter<typeof rigGearMethods.equipGearLoadout>;

  /** Build only newly-ready descriptors; failed loose files leave that slot transparently absent. */
    private declare syncGearArt: OmitThisParameter<typeof rigGearMethods.syncGearArt>;

    private declare pushGearPlane: OmitThisParameter<typeof rigGearMethods.pushGearPlane>;

    private declare pushWeaponLayers: OmitThisParameter<typeof rigGearMethods.pushWeaponLayers>;

  /** Weapon gloves claim the same retained hand receivers as baked gear gloves. The hand node keeps
   *  animating as the mount/transform authority, but its current boilerplate-or-gear texture is hidden while
   *  a worn weapon occupies that receiver. A glove-pair is the one explicit two-receiver weapon contract. */
    private declare weaponReplacesHandReceiver: OmitThisParameter<typeof rigGearMethods.weaponReplacesHandReceiver>;

    private declare weaponReplacesFootReceiver: OmitThisParameter<typeof rigGearMethods.weaponReplacesFootReceiver>;

    private declare syncWeaponHandReplacement: OmitThisParameter<typeof rigGearMethods.syncWeaponHandReplacement>;

  /** One retained back-to-front law shared by weapon and wardrobe descriptor edges. */
    private declare rebuildRenderStack: OmitThisParameter<typeof rigGearMethods.rebuildRenderStack>;

  /** Re-sort only on hammer ownership edges: start, alternating paired hand, and return to rest. */
    private declare syncRevolverHammerLayer: OmitThisParameter<typeof rigGunMechanismMethods.syncRevolverHammerLayer>;

    declare setPosition: OmitThisParameter<typeof rigCoreMethods.setPosition>;

    declare heldWeaponDef: OmitThisParameter<typeof rigCoreMethods.heldWeaponDef>;

  /** Current final affine of a held blade. The legacy name is retained, but the explicit hand parameter
   * carries remote/off-hand routing through the same accessor instead of opening a parallel pose seam. */
    declare leadWeaponTipPose: OmitThisParameter<typeof rigGunMechanismMethods.leadWeaponTipPose>;

  /** Refresh descriptor references without allocating; dev showroom changes become visible next frame. */
    private declare refreshPoseLanguageSelection: OmitThisParameter<typeof rigPoseMethods.refreshPoseLanguageSelection>;

    private declare sampleWeaponPose: OmitThisParameter<typeof rigPoseMethods.sampleWeaponPose>;

  /** World-space grip anchor after jiggle, lift, and the container's facing transform. */
    declare handWorldAnchor: OmitThisParameter<typeof rigGunMechanismMethods.handWorldAnchor>;

  /** Final rendered release hand for the accepted attack beat. Thrown delivery uses this presentation
   * origin while its immutable server projectile continues to launch from authoritative player state. */
    declare throwWorldAnchor: OmitThisParameter<typeof rigGunMechanismMethods.throwWorldAnchor>;

  /** Transform one authored PNG muzzle point through the final live sprite affine. */
    private declare writeWeaponArtMuzzle: OmitThisParameter<typeof rigGunMechanismMethods.writeWeaponArtMuzzle>;

  /**
   * Copy a specific physical barrel through position, rotation, scale, mirror, art correction, and recoil.
   * Beam rows use the stable authored point index.
   */
    declare writeWeaponMuzzle: OmitThisParameter<typeof rigGunMechanismMethods.writeWeaponMuzzle>;

  /** Gun flashes/projectile admission use the exact same accepted-beat salvo selection as authority. */
    declare writeWeaponMuzzleForShot: OmitThisParameter<typeof rigGunMechanismMethods.writeWeaponMuzzleForShot>;

  /** Anchor held charge art to the visible center gutter of an open tome in either facing. */
    declare writeTomeCenter: OmitThisParameter<typeof rigGunMechanismMethods.writeTomeCenter>;

  /** B19 swing punctuation reads the final independent hand/foot worn-sprite affine. */
    declare writeKungFuWrapMuzzle: OmitThisParameter<typeof rigGunMechanismMethods.writeKungFuWrapMuzzle>;

  /** Retained per-barrel kick. Camera shake and muzzle styling stay at Arena's hand-aware cue site. */
    declare triggerGunRecoil: OmitThisParameter<typeof rigGunMechanismMethods.triggerGunRecoil>;

    private declare holdRangedAim: OmitThisParameter<typeof rigGunMechanismMethods.holdRangedAim>;

    private declare offWeaponLean: OmitThisParameter<typeof rigGunMechanismMethods.offWeaponLean>;

    private declare destroyStowProxy: OmitThisParameter<typeof rigFlourishMethods.destroyStowProxy>;

    private declare clearFlourishActivity: OmitThisParameter<typeof rigFlourishMethods.clearFlourishActivity>;

    private declare idleFlourishClockDef: OmitThisParameter<typeof rigFlourishMethods.idleFlourishClockDef>;

  /** Quiet time is player-perceived wall time. The flourish animation itself still samples the
   * freeze-aware presentation clock after it starts, so hit-stop holds a visible turn without delaying
   * its requested ~0.5s onset by several seconds. */
    private declare idleFlourishTimerNow: OmitThisParameter<typeof rigFlourishMethods.idleFlourishTimerNow>;

  /** Actionable presentation input wins immediately; combat clocks and head/hand/foot physics stay intact. */
    declare cancelFlourish: OmitThisParameter<typeof rigFlourishMethods.cancelFlourish>;

  /** Test/debug seam: one increment per real cancellation edge, never per polling frame. */
    declare readonly flourishCancelEdge: typeof rigFlourishMethods.flourishCancelEdge;

  /** Scene retry seam: the observed identity changed, but the incoming art has not attached yet. */
    declare readonly weaponSwapPending: typeof rigFlourishMethods.weaponSwapPending;

    private declare resetFlourishState: OmitThisParameter<typeof rigFlourishMethods.resetFlourishState>;

    private declare beatFor: OmitThisParameter<typeof rigFlourishMethods.beatFor>;

    private declare startFlourishChannel: OmitThisParameter<typeof rigFlourishMethods.startFlourishChannel>;

    private declare startIncomingDraw: OmitThisParameter<typeof rigFlourishMethods.startIncomingDraw>;

  /** Snapshot the old visual before the equip path destroys it. Repeated lazy-art polling is idempotent. */
    declare beginWeaponSwap: OmitThisParameter<typeof rigFlourishMethods.beginWeaponSwap>;

  /** Missing art is the only allowed draw delay. A permanent failure closes the retained transition. */
    declare finishWeaponSwapWithoutArt: OmitThisParameter<typeof rigFlourishMethods.finishWeaponSwapWithoutArt>;

    private declare completePendingWeaponSwap: OmitThisParameter<typeof rigFlourishMethods.completePendingWeaponSwap>;

    private declare armAfterAttack: OmitThisParameter<typeof rigFlourishMethods.armAfterAttack>;

    private declare recordAcceptedRangedBeat: OmitThisParameter<typeof rigFlourishMethods.recordAcceptedRangedBeat>;

    private declare cancelForAcceptedRangedBeat: OmitThisParameter<typeof rigFlourishMethods.cancelForAcceptedRangedBeat>;

    private declare tryStartArmedFlourish: OmitThisParameter<typeof rigFlourishMethods.tryStartArmedFlourish>;

    private declare sampleFlourishChannel: OmitThisParameter<typeof rigFlourishMethods.sampleFlourishChannel>;

    private declare updateStowProxies: OmitThisParameter<typeof rigFlourishMethods.updateStowProxies>;

  /** Allocation-free lifetime reset; the next authored anchors rebase before any excitation is accepted. */
    private declare resetSecondaryMotion: OmitThisParameter<typeof rigCoreMethods.resetSecondaryMotion>;

  /** Top-down draw order: lower on screen renders in front. */
    declare setDepth: OmitThisParameter<typeof rigCoreMethods.setDepth>;

  /** §5 jump hop: lift the rendered art by `px` (peak of the arc). The container's logical position is
   *  untouched, so the camera + depth-sort stay grounded — only the visible body/hands/feet/weapon rise. */
    declare setHop: OmitThisParameter<typeof rigCoreMethods.setHop>;

  /** Exact cosmetic enemy-arc sample. Unlike player height, this value is already locally reconstructed at
   *  render time; animate applies it without another network-smoothing lag. */
    declare setEnemyComboPresentation: OmitThisParameter<typeof rigCombatMethods.setEnemyComboPresentation>;

    declare triggerEnemyComboReturn: OmitThisParameter<typeof rigCombatMethods.triggerEnemyComboReturn>;

    declare triggerEnemyComboLanding: OmitThisParameter<typeof rigCombatMethods.triggerEnemyComboLanding>;

    declare triggerEnemyComboStagger: OmitThisParameter<typeof rigCombatMethods.triggerEnemyComboStagger>;

  /** Victim-side transition edge. Height/vh remain authoritative; this is only the brief paper tumble. */
    declare triggerJuggled: OmitThisParameter<typeof rigCombatMethods.triggerJuggled>;

  /** §33 COLOSSUS framing: a PERMANENT upward art-lift (in body-heights) so a giant renders feet-at-the-
   *  ground with its torso towering off the top of the screen — "you only see his lower body". Like the hop,
   *  it moves ONLY the visible art (logical position, depth-sort + the grounded shadow stay put). `frac` = how
   *  many body-heights to lift; 0 = normal. */
    declare setLowerBodyFrame: OmitThisParameter<typeof rigCombatMethods.setLowerBodyFrame>;

  /** Set/clear the seekable flagship pose. The caller reasserts it each frame; no milestone tween owns it. */
    declare setVastagharPose: OmitThisParameter<typeof rigCoreMethods.setVastagharPose>;

  /** Arrival envelope is evaluated by `animate()` so facing, combo poses, and limb physics keep ownership. */
    declare playSpawnUnfold: OmitThisParameter<typeof rigCoreMethods.playSpawnUnfold>;

  /** Cosmetic-only departure twin of `playSpawnUnfold`; teleport ownership stays entirely server-side. */
    declare playFoldUp: OmitThisParameter<typeof rigCoreMethods.playFoldUp>;

  /** Freeze the current printed layers into a lightweight Dimension Door decoy (no logical actor). */
    declare createPaperCopy: OmitThisParameter<typeof rigCoreMethods.createPaperCopy>;

  /** Immediate key response only: authoritative phase replaces this as soon as the row advances. */
    declare triggerUltimateWindup: OmitThisParameter<typeof rigCoreMethods.triggerUltimateWindup>;

  /** Drive lasting pose/tint state exclusively from the synced nested UltimateState row. */
    declare setUltimatePresentation: OmitThisParameter<typeof rigCoreMethods.setUltimatePresentation>;

  /** §20 detached death: crumple, through-plane flutter, tear, or the cheap overflow/pit fold. */
    declare deathPop: OmitThisParameter<typeof rigCoreMethods.deathPop>;

  /** Advance a detached paper death. Returns false after it destroys its rig. */
    declare stepDeathPop: OmitThisParameter<typeof rigCoreMethods.stepDeathPop>;

  /** Scale the whole rig UNIFORMLY (bosses/toughs are BIGGER, not more detailed — §28.6). Stored so
   *  `animate()` re-applies it to both axes (the facing flip only touches scaleX). */
    declare setRigScale: OmitThisParameter<typeof rigCoreMethods.setRigScale>;

  /** Add a pulsing glow behind the body — the §15 "tough = glowier" tell. Lives in the container
   *  so it scales + moves with the rig. */
    declare addGlow: OmitThisParameter<typeof rigCoreMethods.addGlow>;

  /** Weapon/scene lifetime boundary: no accepted cadence or held guard may cross it. */
    private declare resetSwingCombo: OmitThisParameter<typeof rigCombatMethods.resetSwingCombo>;

  /** Snapshot only presentation channels. Root/weapon combat transforms stay on the authored accepted clock. */
    private declare beginComboStageTransition: OmitThisParameter<typeof rigCombatMethods.beginComboStageTransition>;

  /** Bridge body-only presentation under the authored root. Weapon images are intentionally never captured. */
    private declare applyComboStageTransition: OmitThisParameter<typeof rigCombatMethods.applyComboStageTransition>;

  /** Attack-shadow channels are authored after gear/VFX followers, so their safe residual is committed last. */
    private declare applyComboStageShadowTransition: OmitThisParameter<typeof rigCombatMethods.applyComboStageShadowTransition>;

  /** Undo late paper transforms and close-blade target deltas when no subsequent frame can restore identity. */
    private declare releaseAttackVisuals: OmitThisParameter<typeof rigCombatMethods.releaseAttackVisuals>;

  /** Timeout may preserve the old hold long enough to ease it out; swaps clear it immediately. */
    private declare resetComboChain: OmitThisParameter<typeof rigCombatMethods.resetComboChain>;

  /** Arena's `animClock` advances only on unfrozen frames. Accepted beats arrive in Phaser wall time, so
   * preserve their relative offset while moving the epoch onto the one freeze-aware presentation clock. */
    private declare presentationClockNow: OmitThisParameter<typeof rigCombatMethods.presentationClockNow>;

    private declare presentationEpochForWallEpoch: OmitThisParameter<typeof rigCombatMethods.presentationEpochForWallEpoch>;

  /** Flush the one retained remote action intent only from `animate()`. Since Arena skips rig animation
   * during hit-stop, an accepted beat observed inside the freeze cannot let its authored source flourish run
   * ahead of the held actor. The predicting owner keeps ArenaScene's existing immediate dispatcher. */
    private declare flushObservedAttackSignature: OmitThisParameter<typeof rigCombatMethods.flushObservedAttackSignature>;

  /** Crossfall's rear edge is the sanctioned second ribbon, staggered by 0.06 of the pose window. */
    private declare flushCrossfallRibbon: OmitThisParameter<typeof rigCombatMethods.flushCrossfallRibbon>;

  /** Copy the final held-weapon transform into retained source shapes. This is the remote cast/tome LOD;
   * it never allocates from the render loop and never competes with exact danger geometry. */
    private declare syncObservedSourceFlash: OmitThisParameter<typeof rigCombatMethods.syncObservedSourceFlash>;

    private declare destroyTomeVisual: OmitThisParameter<typeof rigGunMechanismMethods.destroyTomeVisual>;

    private declare setupTomeVisual: OmitThisParameter<typeof rigGunMechanismMethods.setupTomeVisual>;

  /** Feed either a predicted owner beat or an authoritative player beat into retained presentation state.
   *  Uint32 ordering ignores an older confirmation when local prediction already advanced ordinary poses;
   *  firing-frame state is recorded separately and only from an authoritative accepted epoch. */
    declare setAttackBeat: OmitThisParameter<typeof rigGunMechanismMethods.setAttackBeat>;

    private declare hideTomeShapes: OmitThisParameter<typeof rigGunMechanismMethods.hideTomeShapes>;

    private declare setTomeClosed: OmitThisParameter<typeof rigGunMechanismMethods.setTomeClosed>;

    private declare startTomePage: OmitThisParameter<typeof rigGunMechanismMethods.startTomePage>;

  /** Swap retained held textures from the synced server tick window; no local wall-time timer owns it. */
    private declare prepareFiringFrames: OmitThisParameter<typeof rigGunMechanismMethods.prepareFiringFrames>;

    private declare refreshBreakActionClock: OmitThisParameter<typeof rigGunMechanismMethods.refreshBreakActionClock>;

  /** Read-only live-gate surface for the authoritative break pose and registered barrel layer. */
    declare breakActionEvidence: OmitThisParameter<typeof rigGunMechanismMethods.breakActionEvidence>;

  /** Sample the replicated server attack/resource clock; local prediction never writes this tuple. */
    declare setAuthoritativeAttackClock: OmitThisParameter<typeof rigGunMechanismMethods.setAuthoritativeAttackClock>;

  /** Choose the painted held texture and advance scalar page scheduling before weapon pose writes. */
    private declare prepareTomeVisual: OmitThisParameter<typeof rigGunMechanismMethods.prepareTomeVisual>;

  /** Copy the final weapon pose into the retained paper quads/scraps after hop, spawn, and attack offsets. */
    private declare syncTomeVisual: OmitThisParameter<typeof rigGunMechanismMethods.syncTomeVisual>;

  /** Apply client-only painted geometry exactly once, after every semantic/presentation pose writer. */
    private declare applyWeaponArtGeometry: OmitThisParameter<typeof rigGearMethods.applyWeaponArtGeometry>;

  /** Copy the receiver's final affine onto the registered barrel layer, then pivot only part 2. */
    private declare applyBreakActionGeometry: OmitThisParameter<typeof rigGunMechanismMethods.applyBreakActionGeometry>;

  /** Copy the final hidden foot receiver transforms onto the visible B19 worn overlays. */
    private declare syncWrapFootWeapons: OmitThisParameter<typeof rigGearMethods.syncWrapFootWeapons>;

  /** Equip (or swap) one weapon. Authored pre-made duals use both hands and both sprite parts. Each piece
   * points along semantic +X in its hand, pivoting at the grip, and is inserted just
   *  BELOW that hand in the container so the hand overlays the hilt. */
    declare equipWeapon: OmitThisParameter<typeof rigGearMethods.equipWeapon>;

    private declare destroyWrapFootWeapons: OmitThisParameter<typeof rigGearMethods.destroyWrapFootWeapons>;

    private declare destroyStrikeOverlays: OmitThisParameter<typeof rigGearMethods.destroyStrikeOverlays>;

    private declare setupStrikeOverlays: OmitThisParameter<typeof rigGearMethods.setupStrikeOverlays>;

    private declare syncStrikeOverlays: OmitThisParameter<typeof rigGearMethods.syncStrikeOverlays>;

    private declare destroyBreakActionAttachment: OmitThisParameter<typeof rigGunMechanismMethods.destroyBreakActionAttachment>;

    private declare setupBreakActionAttachment: OmitThisParameter<typeof rigGunMechanismMethods.setupBreakActionAttachment>;

  /** Equip the complete render plan for one authored weapon. */
    private declare equipAuthoredWeapon: OmitThisParameter<typeof rigGearMethods.equipAuthoredWeapon>;

  /** Start a swing animation (damage is server-authoritative). `timeMs` is the accepted/predicted Phaser
   * wall epoch and is mapped once onto Arena's freeze-aware presentation clock; `aimWorld` freezes aim. */
    declare triggerSwing: OmitThisParameter<typeof rigCombatMethods.triggerSwing>;

  /** Sample a horde-melee anticipation directly from the latest reconstructed authoritative phase. */
    declare setMeleeTell: OmitThisParameter<typeof rigCombatMethods.setMeleeTell>;

  /** B33 full-body wind-up channel. All rigs use their palette accent; no world/floor geometry participates. */
    declare setEnemyMeleeTelegraph: OmitThisParameter<typeof rigCombatMethods.setEnemyMeleeTelegraph>;

  /** The universal commit edge: one crisp white body frame and a tiny hue-independent squash. */
    declare commitMeleeTell: OmitThisParameter<typeof rigCombatMethods.commitMeleeTell>;

  /** Contact confirmation: keep the loaded vocabulary and run only its short follow-through. */
    declare resolveMeleeTell: OmitThisParameter<typeof rigCombatMethods.resolveMeleeTell>;

  /** An authoritative reset without `atkSeq`: unwind the sampled chamber without crossing contact. */
    declare cancelMeleeTell: OmitThisParameter<typeof rigCombatMethods.cancelMeleeTell>;

  /** World-space striking-third anchor for the stable procedural bracket; returns false for handless rigs. */
    declare getMeleeTellAnchor: OmitThisParameter<typeof rigCombatMethods.getMeleeTellAnchor>;

  /** Start a parry BRACE pose (§8) — raise the weapon to a horizontal block, draw the hands up into
   *  a guard, and dip into a brace, held ~the i-frame window. Purely a STANCE (no VFX yet; on-parry
   *  effects arrive with owned parry augments). */
    declare triggerBrace: OmitThisParameter<typeof rigCombatMethods.triggerBrace>;

  /** Snap the held implement and hands to the server-selected high/mid/low guard on a success receipt. */
    declare triggerParrySuccess: OmitThisParameter<typeof rigCombatMethods.triggerParrySuccess>;

  /** §8 Brand augment: a persistent ember-orange tint marking a Marked enemy (takes more damage). */
  private branded = false;
  /** §6 DOWNED state — fades + grey-tints the rig (it's a body on the ground until a rez revives it). */
  private downed = false;
  /** §20 one reschedulable impact-flash expiry per rig — prevents timer races and teardown retention. */
  private flashTimer?: Phaser.Time.TimerEvent;

  /** Toggle the §8 Brand tint. Cheap + idempotent — the scene calls it each frame off the synced state. */
    declare setBranded: OmitThisParameter<typeof rigCoreMethods.setBranded>;

  /** §6 DOWNED look: fade + a cold grey tint (a body on the ground), or restore on revive. */
    declare setDowned: OmitThisParameter<typeof rigCoreMethods.setDowned>;

  /** Re-apply the resting tint. B33's enemy-body tell overrides ordinary live-state tints. */
    private declare restTint: OmitThisParameter<typeof rigCoreMethods.restTint>;

  /** The pale unprinted face remains the roll opening's exact tell; it never borrows parry white. */
    private declare applySlideInkTell: OmitThisParameter<typeof rigCombatMethods.applySlideInkTell>;

  /** Sample two world-space card echoes at 60 ms spacing, then fade their retained images over 120 ms. */
    private declare updateSlideAfterimages: OmitThisParameter<typeof rigCombatMethods.updateSlideAfterimages>;

    private declare writeSlideAfterimage: OmitThisParameter<typeof rigCombatMethods.writeSlideAfterimage>;

    private declare clearMeleeTellState: OmitThisParameter<typeof rigCombatMethods.clearMeleeTellState>;

    private declare clearMeleeTellTint: OmitThisParameter<typeof rigCombatMethods.clearMeleeTellTint>;

    private declare destroyMeleeTellLayers: OmitThisParameter<typeof rigCombatMethods.destroyMeleeTellLayers>;

  /** Full-tell layers are retained images; scale changes only thickness, never the weapon's painted length. */
    private declare ensureMeleeTellLayers: OmitThisParameter<typeof rigCombatMethods.ensureMeleeTellLayers>;

    private declare updateMeleeTellWeaponVisuals: OmitThisParameter<typeof rigCombatMethods.updateMeleeTellWeaponVisuals>;

    private declare updateJuggleFlash: OmitThisParameter<typeof rigCombatMethods.updateJuggleFlash>;

  /** Brief impact flash on every part (§20 hit feedback / §6 revive pop), then back to the resting tint. */
    declare flash: OmitThisParameter<typeof rigCombatMethods.flash>;

    declare readonly x: typeof rigCoreMethods.x;

    declare readonly y: typeof rigCoreMethods.y;

  /** Drop to EMPTY HANDS (the §9 fists fallback) — clears any held weapon sprite but keeps `def` so the
   *  unarmed swing still animates with the fists range/arc. Used when a weapon is dropped/salvaged. */
    declare unequip: OmitThisParameter<typeof rigCoreMethods.unequip>;

    declare destroy: OmitThisParameter<typeof rigCoreMethods.destroy>;

  /** Absolute two-foot targets layer under the authored body translation. Ownership reaches zero by the
   * held guard, so gait/limb physics can settle without moving the authoritative root. */
    private declare setComboFootwork: OmitThisParameter<typeof rigCombatMethods.setComboFootwork>;

  /** Place the rear hand at a stable pole pivot and reconstruct the lead hand down the same haft. */
    private declare setRearPivotGrip: OmitThisParameter<typeof rigCombatMethods.setRearPivotGrip>;

  /** Greatsword Momentum: every exit carries the blade into the next entry; the body travels much less than
   * the steel, with one depth pass and a low skid rather than Driftblade's hilt beat/forward collapse. */
    private declare applyMomentumCombo: OmitThisParameter<typeof rigCombatMethods.applyMomentumCombo>;

  /** Claymore Breach: broadside guards stay readable throughout; lateral plants and hilt spacing provide the
   * formality, while the finisher releases one edge after a rigid bind rather than promising two hits. */
    private declare applyBreachCombo: OmitThisParameter<typeof rigCombatMethods.applyBreachCombo>;

  /** Glaive Compass: hand slides and projected pole length move the distant head around a quiet body. The
   * center remains visually empty and the final orbit locks to a rear-hand pivot instead of becoming spin. */
    private declare applyCompassCombo: OmitThisParameter<typeof rigCombatMethods.applyCompassCombo>;

  /** Bardiche Hookbreak: the head stays broad and heavy, the second beat shortens inward, and the finisher
   * briefly fixes the far head while the haft/hands wrench past it. No extra contact surface is created. */
    private declare applyHookbreakCombo: OmitThisParameter<typeof rigCombatMethods.applyHookbreakCombo>;

  /** Hammer-head fulcrum vault. Canonical .66 contact is remapped onto the immutable Stage-1 impact clock. */
    private declare applyFulcrumFlip: OmitThisParameter<typeof rigCombatMethods.applyFulcrumFlip>;

    private declare applyStinger: OmitThisParameter<typeof rigCombatMethods.applyStinger>;

    private declare applyHeroSpin: OmitThisParameter<typeof rigCombatMethods.applyHeroSpin>;

    private declare applyPommelBash: OmitThisParameter<typeof rigCombatMethods.applyPommelBash>;

    private declare applyTrueChargedSlam: OmitThisParameter<typeof rigCombatMethods.applyTrueChargedSlam>;

  /** Gravechill Nodachi "Cold Court" + the shared hang-then-fall payoff chassis (§50 Driftblade-model
   * panel). Where Driftblade flows, Gravechill deliberates: a reversed rising draw, a tall guard check
   * whose exit travels upward into the executioner's raise, then an overhead hang and a p² sentence.
   * Voltfang's `thunder-fall` rides the same fall chassis parameterized — shorter hang, 0.4× tremor, a
   * single depth swap instead of the length collapse, and a low forward point instead of a plant. All
   * travel stays on the visual channels (swingOff/attackArtOff/shadow/lift), never the root. */
    private declare applyGravechillCombo: OmitThisParameter<typeof rigCombatMethods.applyGravechillCombo>;

  /** Stormpetal Odachi "Petalfall" (§50 Driftblade-model panel): wind through a flowering tree. The
   * compact beat is a choked blade FLIP (the model's fake-3D budget deliberately relocated from beat 3
   * to beat 2), and the finisher is a single-window S-cut that settles into a light high guard with one
   * visible breath — the anti-Sentence. Crosswind (beat 1, reused `slash`) rides the generic branch. */
    private declare applyStormpetalCombo: OmitThisParameter<typeof rigCombatMethods.applyStormpetalCombo>;

  /** Late additive movement pose: it composes after weapon authorship and before the shared lift/shadow pass. */
    private declare applyJumpFeelPose: OmitThisParameter<typeof rigPoseMethods.applyJumpFeelPose>;

  /** §51 late additive combo grammar. Every clock is presentation-only; root position and damaging geometry
   * remain owned by snapshots/telegraphs. This pass is retained-transform work and allocates nothing. */
    private declare applyEnemyComboPresentationPose: OmitThisParameter<typeof rigCombatMethods.applyEnemyComboPresentationPose>;

    private declare applyUltimateRootPresentation: OmitThisParameter<typeof rigCombatMethods.applyUltimateRootPresentation>;

  /** Late additive paper pose: never changes the actor root position, targetability, or collision geometry. */
    private declare applyUltimatePose: OmitThisParameter<typeof rigCombatMethods.applyUltimatePose>;

    private declare vastagharFoot: OmitThisParameter<typeof rigCombatMethods.vastagharFoot>;

  /** Boss-local paper theatre sampled from immutable action epochs; never moves the authoritative root. */
    private declare applyVastagharPose: OmitThisParameter<typeof rigCombatMethods.applyVastagharPose>;

    private declare sampleFloatingHeadAttackLead: OmitThisParameter<typeof rigGearMethods.sampleFloatingHeadAttackLead>;

    private declare syncFloatingHeadPose: OmitThisParameter<typeof rigGearMethods.syncFloatingHeadPose>;

  /** Head/face receivers layer their own angular springs over the final sprung head transform. */
    private declare placeHeadGear: OmitThisParameter<typeof rigGearMethods.placeHeadGear>;

    private declare placeBodyGear: OmitThisParameter<typeof rigGearMethods.placeBodyGear>;

    private declare placeNodeGear: OmitThisParameter<typeof rigGearMethods.placeNodeGear>;

    private declare topSocketPosition: OmitThisParameter<typeof rigGearMethods.topSocketPosition>;

  /** Final-pose wardrobe pass. Offscreen rigs retain their last transforms and rebase springs on wake. */
    private declare syncGearPose: OmitThisParameter<typeof rigGearMethods.syncGearPose>;

    declare animate: OmitThisParameter<typeof rigPoseMethods.animate>;
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

installPrototypeMembers(SpriteRig, [
  [rigCombatMethods, "activeSwing"],
  [rigCombatMethods, "activeSwingHand"],
  [rigCombatMethods, "isCrossfallActive"],
  [rigGearMethods, "requestBoilerplate"],
  [rigGearMethods, "applyLoadoutHeadTexture"],
  [rigGearMethods, "createBoilerplateLimb"],
  [rigGearMethods, "installBoilerplateIfReady"],
  [rigGearMethods, "clearGearAttachments"],
  [rigGearMethods, "syncHatOverflowLabel"],
  [rigGearMethods, "restoreBoilerplateTextures"],
  [rigGearMethods, "applyResolvedRigSockets"],
  [rigGearMethods, "commitGearBakeLease"],
  [rigGearMethods, "equipSyncedGear"],
  [rigGearMethods, "equipGearLoadout"],
  [rigGearMethods, "syncGearArt"],
  [rigGearMethods, "pushGearPlane"],
  [rigGearMethods, "pushWeaponLayers"],
  [rigGearMethods, "weaponReplacesHandReceiver"],
  [rigGearMethods, "weaponReplacesFootReceiver"],
  [rigGearMethods, "syncWeaponHandReplacement"],
  [rigGearMethods, "rebuildRenderStack"],
  [rigGunMechanismMethods, "syncRevolverHammerLayer"],
  [rigCoreMethods, "setPosition"],
  [rigCoreMethods, "heldWeaponDef"],
  [rigGunMechanismMethods, "leadWeaponTipPose"],
  [rigPoseMethods, "refreshPoseLanguageSelection"],
  [rigPoseMethods, "sampleWeaponPose"],
  [rigGunMechanismMethods, "handWorldAnchor"],
  [rigGunMechanismMethods, "throwWorldAnchor"],
  [rigGunMechanismMethods, "writeWeaponArtMuzzle"],
  [rigGunMechanismMethods, "writeWeaponMuzzle"],
  [rigGunMechanismMethods, "writeWeaponMuzzleForShot"],
  [rigGunMechanismMethods, "writeTomeCenter"],
  [rigGunMechanismMethods, "writeKungFuWrapMuzzle"],
  [rigGunMechanismMethods, "triggerGunRecoil"],
  [rigGunMechanismMethods, "holdRangedAim"],
  [rigGunMechanismMethods, "offWeaponLean"],
  [rigFlourishMethods, "destroyStowProxy"],
  [rigFlourishMethods, "clearFlourishActivity"],
  [rigFlourishMethods, "idleFlourishClockDef"],
  [rigFlourishMethods, "idleFlourishTimerNow"],
  [rigFlourishMethods, "cancelFlourish"],
  [rigFlourishMethods, "flourishCancelEdge"],
  [rigFlourishMethods, "weaponSwapPending"],
  [rigFlourishMethods, "resetFlourishState"],
  [rigFlourishMethods, "beatFor"],
  [rigFlourishMethods, "startFlourishChannel"],
  [rigFlourishMethods, "startIncomingDraw"],
  [rigFlourishMethods, "beginWeaponSwap"],
  [rigFlourishMethods, "finishWeaponSwapWithoutArt"],
  [rigFlourishMethods, "completePendingWeaponSwap"],
  [rigFlourishMethods, "armAfterAttack"],
  [rigFlourishMethods, "recordAcceptedRangedBeat"],
  [rigFlourishMethods, "cancelForAcceptedRangedBeat"],
  [rigFlourishMethods, "tryStartArmedFlourish"],
  [rigFlourishMethods, "sampleFlourishChannel"],
  [rigFlourishMethods, "updateStowProxies"],
  [rigCoreMethods, "resetSecondaryMotion"],
  [rigCoreMethods, "setDepth"],
  [rigCoreMethods, "setHop"],
  [rigCombatMethods, "setEnemyComboPresentation"],
  [rigCombatMethods, "triggerEnemyComboReturn"],
  [rigCombatMethods, "triggerEnemyComboLanding"],
  [rigCombatMethods, "triggerEnemyComboStagger"],
  [rigCombatMethods, "triggerJuggled"],
  [rigCombatMethods, "setLowerBodyFrame"],
  [rigCoreMethods, "setVastagharPose"],
  [rigCoreMethods, "playSpawnUnfold"],
  [rigCoreMethods, "playFoldUp"],
  [rigCoreMethods, "createPaperCopy"],
  [rigCoreMethods, "triggerUltimateWindup"],
  [rigCoreMethods, "setUltimatePresentation"],
  [rigCoreMethods, "deathPop"],
  [rigCoreMethods, "stepDeathPop"],
  [rigCoreMethods, "setRigScale"],
  [rigCoreMethods, "addGlow"],
  [rigCombatMethods, "resetSwingCombo"],
  [rigCombatMethods, "beginComboStageTransition"],
  [rigCombatMethods, "applyComboStageTransition"],
  [rigCombatMethods, "applyComboStageShadowTransition"],
  [rigCombatMethods, "releaseAttackVisuals"],
  [rigCombatMethods, "resetComboChain"],
  [rigCombatMethods, "presentationClockNow"],
  [rigCombatMethods, "presentationEpochForWallEpoch"],
  [rigCombatMethods, "flushObservedAttackSignature"],
  [rigCombatMethods, "flushCrossfallRibbon"],
  [rigCombatMethods, "syncObservedSourceFlash"],
  [rigGunMechanismMethods, "destroyTomeVisual"],
  [rigGunMechanismMethods, "setupTomeVisual"],
  [rigGunMechanismMethods, "setAttackBeat"],
  [rigGunMechanismMethods, "hideTomeShapes"],
  [rigGunMechanismMethods, "setTomeClosed"],
  [rigGunMechanismMethods, "startTomePage"],
  [rigGunMechanismMethods, "prepareFiringFrames"],
  [rigGunMechanismMethods, "refreshBreakActionClock"],
  [rigGunMechanismMethods, "breakActionEvidence"],
  [rigGunMechanismMethods, "setAuthoritativeAttackClock"],
  [rigGunMechanismMethods, "prepareTomeVisual"],
  [rigGunMechanismMethods, "syncTomeVisual"],
  [rigGearMethods, "applyWeaponArtGeometry"],
  [rigGunMechanismMethods, "applyBreakActionGeometry"],
  [rigGearMethods, "syncWrapFootWeapons"],
  [rigGearMethods, "equipWeapon"],
  [rigGearMethods, "destroyWrapFootWeapons"],
  [rigGearMethods, "destroyStrikeOverlays"],
  [rigGearMethods, "setupStrikeOverlays"],
  [rigGearMethods, "syncStrikeOverlays"],
  [rigGunMechanismMethods, "destroyBreakActionAttachment"],
  [rigGunMechanismMethods, "setupBreakActionAttachment"],
  [rigGearMethods, "equipAuthoredWeapon"],
  [rigCombatMethods, "triggerSwing"],
  [rigCombatMethods, "setMeleeTell"],
  [rigCombatMethods, "setEnemyMeleeTelegraph"],
  [rigCombatMethods, "commitMeleeTell"],
  [rigCombatMethods, "resolveMeleeTell"],
  [rigCombatMethods, "cancelMeleeTell"],
  [rigCombatMethods, "getMeleeTellAnchor"],
  [rigCombatMethods, "triggerBrace"],
  [rigCombatMethods, "triggerParrySuccess"],
  [rigCoreMethods, "setBranded"],
  [rigCoreMethods, "setDowned"],
  [rigCoreMethods, "restTint"],
  [rigCombatMethods, "applySlideInkTell"],
  [rigCombatMethods, "updateSlideAfterimages"],
  [rigCombatMethods, "writeSlideAfterimage"],
  [rigCombatMethods, "clearMeleeTellState"],
  [rigCombatMethods, "clearMeleeTellTint"],
  [rigCombatMethods, "destroyMeleeTellLayers"],
  [rigCombatMethods, "ensureMeleeTellLayers"],
  [rigCombatMethods, "updateMeleeTellWeaponVisuals"],
  [rigCombatMethods, "updateJuggleFlash"],
  [rigCombatMethods, "flash"],
  [rigCoreMethods, "x"],
  [rigCoreMethods, "y"],
  [rigCoreMethods, "unequip"],
  [rigCoreMethods, "destroy"],
  [rigCombatMethods, "setComboFootwork"],
  [rigCombatMethods, "setRearPivotGrip"],
  [rigCombatMethods, "applyMomentumCombo"],
  [rigCombatMethods, "applyBreachCombo"],
  [rigCombatMethods, "applyCompassCombo"],
  [rigCombatMethods, "applyHookbreakCombo"],
  [rigCombatMethods, "applyFulcrumFlip"],
  [rigCombatMethods, "applyStinger"],
  [rigCombatMethods, "applyHeroSpin"],
  [rigCombatMethods, "applyPommelBash"],
  [rigCombatMethods, "applyTrueChargedSlam"],
  [rigCombatMethods, "applyGravechillCombo"],
  [rigCombatMethods, "applyStormpetalCombo"],
  [rigPoseMethods, "applyJumpFeelPose"],
  [rigCombatMethods, "applyEnemyComboPresentationPose"],
  [rigCombatMethods, "applyUltimateRootPresentation"],
  [rigCombatMethods, "applyUltimatePose"],
  [rigCombatMethods, "vastagharFoot"],
  [rigCombatMethods, "applyVastagharPose"],
  [rigGearMethods, "sampleFloatingHeadAttackLead"],
  [rigGearMethods, "syncFloatingHeadPose"],
  [rigGearMethods, "placeHeadGear"],
  [rigGearMethods, "placeBodyGear"],
  [rigGearMethods, "placeNodeGear"],
  [rigGearMethods, "topSocketPosition"],
  [rigGearMethods, "syncGearPose"],
  [rigPoseMethods, "animate"],
]);
