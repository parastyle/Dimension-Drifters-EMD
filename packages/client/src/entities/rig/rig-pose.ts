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
  type WeaponLimb,
  resolveWeaponElementTransform,
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
} from "../kung-fu-wrap-pose.js";import { SPRITE_ATLAS, partTexture, TARGET_BODY_H, BODY_LOOK_LEAN, MELEE_FORWARD_READY_CANT, forwardMeleeReadyAngle, PARRY_GUARD_ANGLE_OFFSETS, PARRY_GUARD_HAND_FORWARD, PARRY_GUARD_HAND_LIFT, CLIENT_VISUAL_COMBOS, COMBO_HOLD_RELEASE_MS, MONK_FLURRY_MIN_POSE_MS, COMBO_STAGE_TRANSITION_MAX_MS, MELEE_GLINT_LEAD_MS, MELEE_GLINT_CREST_MS, TOME_IDLE_CLOSE_MS, TOME_PAGE_INTERVAL_MS, TOME_PAGE_DURATION_MS, TOME_SETTLE_DURATION_MS, TOME_SCRAP_DURATION_MS, REMOTE_SIGNATURE_LOD_MARGIN_PX, REMOTE_SOURCE_FLASH_MS, RANGED_AIM_LINGER_MS, RANGED_AIM_RAISE_MS, RANGED_AIM_SETTLE_MS, GUN_RECOIL_ACTIVE_MS, RANGED_GUN_RECOVERY_MS, DUAL_BACK_WEAPON_LEAN, CLOSE_BLADE_RELEASE_T, authoredWeaponRenderPlan, opposedWhirlwindPose, NO_WRAP_RIG_MOUNTS, FOUR_LIMB_WRAP_RIG_MOUNTS, wrapRigMountPlan, wrapRigFacingSign, wrapRigReceiverRelativeScale, strikeOverlayImpactVisible, measureBladeWidthAtExtensionJoin, createComboChainState, CROSSFALL_STEP, routeSwingChannels, isTerminalFlourishStep, flourishStreakWindowMs, flourishMovementIntent, rawFlourishIntentCancels, nextFlourishStreakCount, PISTOL_IDLE_TWIRL_DELAY_MS, PISTOL_DUAL_TWIRL_STAGGER_MS, GENERIC_IDLE_FLOURISH_DELAY_MS, DUAL_PISTOL_HAND_RISE_BODY_FRAC, idleFlourishEligibleEpoch, flourishCanOverridePersistentGunAim, authoredDualPistolHandYOffset, createGunHandlingCycleState, gunHandlingMechanismFor, gunHandlingCycleDurationMs, sampleGunHandlingHandOffset, resolveSecondaryGripPosition, resolveBreakActionSecondaryGripPosition, clamp01, smoothstep01, mixRgb, smootherstep01, cubicOut01, backOut01, mixAngle, comboStageTransitionDurationMs, comboStageTransitionBlend, blendComboStagePoseTransform, blendComboStagePresentationTransform, stepAngleBounded, paperPopScaleX, paperPopScaleY, paperPopRotation, signedClamp, sampleAuthoredDualCeremony, attackSignatureColor, actionOwnershipAt, remapPoseTimeAtImpact, createCloseBladePoseInput, createCloseBladePoseSample, sampleCloseBladePose, comboGraceMs, FLOATING_HEAD_SPRING_TUNING, sampleFloatingHeadWalkBob, clampFloatingHeadOffset, stepFloatingHeadSpring, createFlourishChannel, createFlourishArmState, createFlourishStreakState, createOutgoingStowProxy, resetJigglePart, syncOwnedJigglePart, stepJigglePart, sampleRangedAimBlend, facingLayoutSign, stepFacingFlip, SPRITE_RIG_STATICS as SpriteRig } from "./rig-core.js";
import type { RigComboFamily, RigSwingHand, RigLoadoutPiece, OpposedWhirlwindPose, WrapRigReceiver, WrapRigMount, WrapRigScaleInput, RigSwingDescriptor, WeaponBladeAttachmentPose, ComboChainState, ComboStageTransitionState, ComboStageTransformNode, SwingChannelSample, RawFlourishIntent, GunHandlingMechanism, GunHandlingCycleState, GunHandlingHandOffset, SecondaryGripTransformInput, RigAttackPresentationScene, ComboStageTransitionTiming, ComboStagePoseTransform, ComboStageParentTransform, AuthoredDualCeremonySample, CloseBladePoseVariant, CloseBladePoseInput, CloseBladePoseSample, JigglePartState, FloatingHeadSpringState, FloatingHeadSpringInput, FloatingHeadSpringTuning, TomePageQuad, TomeScrap, TomeVisualState, RigHand, RigFoot, BreakActionAttachment, FlourishChannelState, FlourishArmState, FlourishStreakState, OutgoingStowProxy, GearAttachment, RigAnim, VastagharRigPose, PaperDeathTreatment, PaperDeathPartPose, PaperDeathState, SpriteRigContext } from "./rig-core.js";
import {
  gunHandlingHandFor,
  revolverHammerHandFor,
  secondaryGripHandRotationFor,
} from "./rig-gun-mechanisms.js";
import type { PresentedActorState } from "./rig-presentation.js";

export const rigPoseMethods = {

  /** Refresh descriptor references without allocating; dev showroom changes become visible next frame. */
  refreshPoseLanguageSelection(this: SpriteRigContext, rebuildGeometry: boolean, force = false): void {
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
  },

  sampleWeaponPose(this: SpriteRigContext,
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
  },

  /** Late additive movement pose: it composes after weapon authorship and before the shared lift/shadow pass. */
  applyJumpFeelPose(this: SpriteRigContext, timeMs: number, anim: RigAnim): void {
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
  },

  // Extraction trace: animate(state: PresentedActorState): void
  animate(this: SpriteRigContext, anim: PresentedActorState): void {
    this.installBoilerplateIfReady();
    this.refreshPoseLanguageSelection(true);
    const timeMs = anim.frame.nowMs;
    const t = timeMs / 1000 + this.phase;
    // §7 v0.105 de-clunk: derive a frame dt from the (freeze-paused) animation clock for the eased blends,
    // clamped so a hit-stop gap or first frame can't produce a jump.
    // §7 v0.112 clamp to [0,100]: a scene restart / clock reset can make timeMs < prevAnimMs → a NEGATIVE dt
    // that would flip the exponential-blend signs and blow every eased value to infinity. Never allow that.
    const firstAnim = this.prevAnimMs < 0;
    const rawDtMs = anim.frame.deltaMs;
    const dtMs = Math.max(0, Math.min(100, rawDtMs));
    this.prevAnimMs = timeMs;
    const s = this.scale;
    const sceneNow = timeMs;
    const springDtS = Math.min(JIGGLE_MAX_DT_S, dtMs / 1000);
    const rootDx = this.root.x - this.jigglePrevRootX;
    const rootDy = this.root.y - this.jigglePrevRootY;
    const rootCut = Math.hypot(rootDx, rootDy) > INTERP_SNAP_PLAYER;
    const jiggleRebase = firstAnim || anim.frame.cut || rootCut;
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
    const flourishAttackIntent = anim.fireHeld === true;
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
    const flourishTimingCut = rootCut || anim.frame.cut;
    const flourishClockCut = outsidePaperView || flourishTimingCut;
    const preserveEndHookArmThroughAttackIntent =
      this.weaponDef?.performance?.flourishStyle === "pistol-end-hook" && flourishArmed;
    const flourishSemanticallyInterrupted =
      this.downed || this.ultimatePhase !== UltimatePhase.Idle;
    if (flourishClockCut || flourishSemanticallyInterrupted) {
      this.resetFlourishState(
        false,
        flourishClockCut,
        flourishTimingCut && !outsidePaperView && !flourishSemanticallyInterrupted,
      );
      if (flourishSemanticallyInterrupted) this.comboStageTransition = undefined;
    } else if (
      (flourishAttackIntent && !preserveEndHookArmThroughAttackIntent) ||
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
    const dtS = dtMs / 1000;
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
      ((this.meleeTellMode === "windup" || this.meleeTellMode === "commit") &&
        this.meleeTellFull) ||
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
    // B53: retain mirror velocity across target interruption and rate-limit pivot travel. The signed
    // layout-facing offsets below switch only as the card crosses edge-on.
    if (firstAnim) {
      this.facingBlend = this.facing;
      this.facingFlip.visual = this.facing;
      this.facingFlip.velocity = 0;
    } else {
      this.facingFlip.visual = this.facingBlend;
      stepFacingFlip(this.facingFlip, this.facing, dtMs);
      this.facingBlend = this.facingFlip.visual;
    }
    const layoutFacing = facingLayoutSign(this.facingBlend, this.facing);
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
    if (this.parrySuccessPending) {
      this.parrySuccessStart = timeMs;
      this.parrySuccessPending = false;
    }
    const parrySuccessElapsed = timeMs - this.parrySuccessStart;
    const parrySuccess =
      parrySuccessElapsed >= 0 && parrySuccessElapsed < SpriteRig.PARRY_SUCCESS_DUR
        ? parrySuccessElapsed < SpriteRig.PARRY_SUCCESS_DUR * 0.72
          ? 1
          : 1 -
            (parrySuccessElapsed - SpriteRig.PARRY_SUCCESS_DUR * 0.72) /
              (SpriteRig.PARRY_SUCCESS_DUR * 0.28)
        : 0;
    const guardBlend = Math.max(brace, parrySuccess);
    if (guardBlend > 0) {
      this.body.y += guardBlend * s * 7; // dip into the guard
      this.body.scaleY *= 1 - guardBlend * 0.05; // slight squash
    }
    if (parrySuccess > 0 && this.parryReaction === ParryReaction.FromAbove) {
      this.body.y += parrySuccess * s * 9;
      this.body.scaleY *= 1 - parrySuccess * 0.13;
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
    const heldGunDef = this.weapons.find((weapon) => weapon.def.gun !== undefined)?.def;
    const hasGunHeld = heldGunDef !== undefined;
    const gunCheekWeldPose = gunCheekWeldPoseFor(heldGunDef);
    this.orbitT = -1; // §40 re-armed below only while an orbit-style swing window is live
    this.orbitSpin = false;
    this.swingOffX = 0;
    this.swingOffY = 0;
    this.swingBackOffX = 0;
    this.swingBackOffY = 0;
    this.authoredDualWeaponScaleX[0] = 1;
    this.authoredDualWeaponScaleX[1] = 1;
    this.authoredDualFootWeaponScaleX[0] = 1;
    this.authoredDualFootWeaponScaleX[1] = 1;
    this.authoredDualGlintAlpha = 0;
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
    if (this.meleeTellMode === "commit" && sceneNow - this.meleeTellReleaseAtMs > 260) {
      this.clearMeleeTellState();
    } else if (this.meleeTellMode === "resolve" && sceneNow - this.meleeTellReleaseAtMs > 180) {
      this.clearMeleeTellState();
    } else if (this.meleeTellMode === "cancel" && sceneNow - this.meleeTellReleaseAtMs > 90) {
      this.clearMeleeTellState();
    }
    const meleePoseActive =
      ((this.meleeTellMode === "windup" || this.meleeTellMode === "commit") &&
        this.meleeTellFull) ||
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
      if (this.meleeTellMode === "commit" || this.meleeTellMode === "resolve") incoming = 1;
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
      if (this.meleeTellMode === "commit") {
        const pop = 1 - smoothstep01((sceneNow - this.meleeTellReleaseAtMs) / 50);
        this.body.y += 3 * pop * s;
        this.body.scaleX *= 1 + 0.05 * pop;
        this.body.scaleY *= 1 - 0.08 * pop;
      }
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
      // Guns rise and remain at the shoulder while held; non-gun casting implements retain their
      // attack-held envelope.
      if (hasGunHeld || anim.fireHeld) this.holdRangedAim(sceneNow, RANGED_AIM_LINGER_MS);
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
        // Generic authored melee flips share the movement kit's one-revolution paper tumble. Martial-wrap
        // flips already own a richer limb sampler below; every other combo may opt in declaratively.
        if (
          comboPose?.theatrics?.flip &&
          poseStyle !== "punch"
        ) {
          const flipStart = comboPose.timing.activeStart;
          const flipEnd = Math.max(
            flipStart + 0.001,
            comboPose.theatrics.flipEnd ??
              comboPose.timing.impact ??
              comboPose.timing.activeEnd,
          );
          const flipProgress = clamp01((tt - flipStart) / (flipEnd - flipStart));
          const flipDirection = comboPose.theatrics.flip === "front" ? 1 : -1;
          const flipRotation = rollTumbleRotation(
            flipProgress,
            flipDirection * this.facing,
            anim.reducedMotion === true || outsidePaperView,
          );
          this.root.rotation += flipRotation;
          const renderEvidence = this.authoredComboFlipRenderEvidence;
          renderEvidence.renderedSamples += 1;
          renderEvidence.maxProgress = Math.max(renderEvidence.maxProgress, flipProgress);
          renderEvidence.maxAbsRotation = Math.max(
            renderEvidence.maxAbsRotation,
            Math.abs(flipRotation),
          );
          this.attackLiftPx += Math.sin(Math.PI * flipProgress) * TARGET_BODY_H * 0.28;
        }
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
            input.limb = pose.limb ?? "hand";
            input.direction = poseDirection;
            input.timing = pose.timing;
            input.theatrics = pose.theatrics;
            input.strikeReachBodyHeights =
              (meleeReach(def) * pose.path.rangeMultiplier) / TARGET_BODY_H;
            input.t = tt;
            const sampled = sampleKungFuWrapPose(input, this.kungFuWrapPose);
            const renderEvidence = this.kungFuWrapRenderEvidence;
            renderEvidence.renderedSamples += 1;
            renderEvidence.minPaperTurnScaleX = Math.min(
              renderEvidence.minPaperTurnScaleX,
              sampled.paperTurnScaleX,
            );
            renderEvidence.maxFlipProgress = Math.max(
              renderEvidence.maxFlipProgress,
              sampled.flipProgress,
            );
            renderEvidence.maxHandStretch = Math.max(
              renderEvidence.maxHandStretch,
              sampled.handStretch,
            );
            renderEvidence.maxRearHandStretch = Math.max(
              renderEvidence.maxRearHandStretch,
              sampled.rearHandStretch,
            );
            renderEvidence.maxFrontFootStretch = Math.max(
              renderEvidence.maxFrontFootStretch,
              sampled.frontFootStretch,
            );
            renderEvidence.maxBackFootStretch = Math.max(
              renderEvidence.maxBackFootStretch,
              sampled.backFootStretch,
            );
            renderEvidence.maxHoldStrength = Math.max(
              renderEvidence.maxHoldStrength,
              sampled.holdStrength,
            );
            if (
              sampled.holdPose !== undefined &&
              !renderEvidence.holdPoses.includes(sampled.holdPose)
            ) {
              renderEvidence.holdPoses.push(sampled.holdPose);
            }
            if (sampled.flipProgress >= 0) {
              const flipRotation = rollTumbleRotation(
                sampled.flipProgress,
                sampled.flipDirection * this.facing,
                anim.reducedMotion === true || outsidePaperView,
              );
              this.root.rotation += flipRotation;
              renderEvidence.maxFlipAbsRotation = Math.max(
                renderEvidence.maxFlipAbsRotation,
                Math.abs(flipRotation),
              );
              this.attackLiftPx += sampled.wholeBodyLift * TARGET_BODY_H;
            }
            if (sampled.paperTurnProgress >= 0) {
              this.root.scaleX *= sampled.paperTurnScaleX;
              if (this.label) {
                const inv = 1 / (this.baseScale || 1);
                this.label.scaleX = screenTrueScaleX(this.root.scaleX, this.root.scaleY, inv);
              }
            }
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
            this.authoredDualWeaponScaleX[impactHand] = 1 + sampled.impactSnap * 0.24;
            if (pose.hand === "both")
              this.authoredDualWeaponScaleX[1] = 1 + sampled.impactSnap * 0.18;
            if (pose.theatrics?.limbStretch !== undefined) {
              if (pose.limb === "foot") {
                this.authoredDualFootWeaponScaleX[0] = sampled.frontFootStretch;
                this.authoredDualFootWeaponScaleX[1] = sampled.backFootStretch;
              } else {
                this.authoredDualWeaponScaleX[impactHand] *= sampled.handStretch;
                if (pose.hand === "both")
                  this.authoredDualWeaponScaleX[1] *= sampled.rearHandStretch;
              }
            }
            this.authoredDualGlintAlpha = Math.max(
              this.authoredDualGlintAlpha,
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
              this.authoredDualWeaponScaleX[pose.hand === "off" ? 1 : 0] = 1 + snap * 0.28;
              this.authoredDualGlintAlpha = Math.max(this.authoredDualGlintAlpha, snap * 0.82);
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
          const rapidThrustEnv = rapidThrustExtensionAt(def.rapidThrust, tt);
          if (rapidThrustEnv !== undefined) {
            env = rapidThrustEnv;
            const audit = globalThis as unknown as {
              __ddOwnerQuickfixRapidThrustAudit?: Array<Record<string, number | string>>;
            };
            const samples = audit.__ddOwnerQuickfixRapidThrustAudit;
            if (samples) {
              samples.push({
                weaponId: def.id,
                timeMs: sceneNow,
                poseProgress: tt,
                extension: rapidThrustEnv,
                facing: this.facing,
                attackBeatSeq: this.attackBeatSeq,
              });
              if (samples.length > 600) samples.shift();
            }
          } else if (tt < a) {
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
        aimRelativePoint(
          this.performanceSample.bodyForward,
          this.performanceSample.bodyLateral,
          heldAimLocal,
          this.posePoint,
        );
        this.body.x += this.posePoint.x * TARGET_BODY_H;
        this.body.y += this.posePoint.y * TARGET_BODY_H;
        this.body.rotation += this.performanceSample.bodyTurn;
        aimRelativePoint(
          this.performanceSample.frontFootForward,
          this.performanceSample.frontFootLateral,
          heldAimLocal,
          this.posePoint,
        );
        this.attackFrontFootX += this.posePoint.x * TARGET_BODY_H;
        this.attackFrontFootY += this.posePoint.y * TARGET_BODY_H;
        aimRelativePoint(
          this.performanceSample.backFootForward,
          this.performanceSample.backFootLateral,
          heldAimLocal,
          this.posePoint,
        );
        this.attackBackFootX += this.posePoint.x * TARGET_BODY_H;
        this.attackBackFootY += this.posePoint.y * TARGET_BODY_H;
        this.attackFrontFootBlend = Math.max(
          this.attackFrontFootBlend,
          this.performanceSample.footBlend,
        );
        this.attackBackFootBlend = Math.max(
          this.attackBackFootBlend,
          this.performanceSample.footBlend,
        );
        ownFeet = Math.max(ownFeet, this.performanceSample.footBlend);
      }
      const twirlAxis = continuousTwirlAxisFor(this.performanceSpec);
      const whirlPhase = continuousWhirlPhase(
        this.performanceSpec,
        anim.fireHeld === true,
        anim.reducedMotion === true || outsidePaperView,
        t,
        this.performanceSpec.twirl?.cadenceSeconds ?? this.weaponDef?.cooldown ?? 0.4,
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
    const endHookFlourishCanOwnIdle =
      this.weaponDef?.performance?.flourishStyle === "pistol-end-hook" && posePhase === "idle";
    const hardFlourishOwner =
      meleePoseActive ||
      this.closeBladePoseActive ||
      crossfallOwnsFlourish ||
      brace > 0 ||
      (!hasAimedFiringWeapon &&
        !endHookFlourishCanOwnIdle &&
        (ownFront > 0.01 || ownBack > 0.01 || ownFeet > 0.01));
    const flourishOverridesPersistentGunAim = flourishCanOverridePersistentGunAim(
      hasGunHeld,
      posePhase === "idle",
      flourishArmed || this.flourishChannels[0].active || this.flourishChannels[1].active,
    );
    const strongerFlourishOwner =
      hardFlourishOwner ||
      posePhase !== "idle" ||
      (rangedAimBlend > 0 && !flourishOverridesPersistentGunAim);
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

    // Successful guards snap to three server-selected contact heights; an open brace keeps the mid guard.
    if (guardBlend > 0) {
      ownFront = 1;
      ownBack = 1;
      ownFeet = 1;
      const guardAim = meleePoseActive
        ? Math.atan2(
            Math.sin(this.meleeTellAimWorld),
            Math.cos(this.meleeTellAimWorld) * this.facing,
          )
        : heldAimLocal;
      const poseOffset = parrySuccess > 0 ? PARRY_GUARD_ANGLE_OFFSETS[this.parryGuardPose] : 0;
      const guard = forwardMeleeReadyAngle(guardAim) + poseOffset;
      weaponAngle += (guard - weaponAngle) * guardBlend;
      if (this.weapons.length > 1) {
        const rearGuard = guard + (this.parryGuardPose === 1 ? -0.24 : -poseOffset * 0.45);
        const rearBase = Number.isNaN(backWeaponAngle)
          ? weaponAngle - this.offWeaponLean()
          : backWeaponAngle;
        backWeaponAngle = rearBase + (rearGuard - rearBase) * guardBlend;
      }
    }
    const ceremony = sampleAuthoredDualCeremony(sceneNow - this.authoredDualCeremonyStartMs);
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
      this.authoredDualWeaponScaleX[0] = ceremony.leadScaleX;
      this.authoredDualWeaponScaleX[1] = ceremony.offScaleX;
      this.authoredDualGlintAlpha = ceremony.glintAlpha;
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
      this.crossfallActive || this.swingHand === "both" || guardBlend > 0;
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
      const martialIdle =
        posePhase === "idle" &&
        semanticDef?.glovePair !== undefined &&
        isMartialIdleHandPose(semanticDef.poseLanguage?.idle);
      const heldFiringDef = this.weapons[handIndex]?.def;
      const castsFromFreeHand = !hnd.front && !heldFiringDef && tomeCastingHandActive;
      const posedFiringDef = heldFiringDef ?? (castsFromFreeHand ? this.weaponDef : undefined);
      if (heldFiringDef) {
        hx +=
          (movementPose.weaponCarryForwardPx + movementPose.weaponTrailSwayPx * handPhaseSign) * s;
        hy -= movementPose.weaponCarryUpPx * s;
      }
      if (martialIdle && semanticDef) {
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
        targetInput.hand = handIndex;
        targetInput.recoveryT = undefined;
        targetInput.recoveryForward = undefined;
        targetInput.recoveryLateral = undefined;
        resolveIdleHandTarget(semanticDef, targetInput, this.idleHandTarget);
        hx = this.idleHandTarget.x;
        hy = this.idleHandTarget.y;
      } else if (
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
        targetInput.hand = handIndex;
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
      if (!martialIdle && hnd.front && performancePoseActive) {
        const targetX = this.body.x + this.performanceSample.handX * TARGET_BODY_H;
        const targetY = this.body.y + this.performanceSample.handY * TARGET_BODY_H;
        hx += (targetX - hx) * this.performanceSample.handBlend;
        hy += (targetY - hy) * this.performanceSample.handBlend;
      } else if (
        !martialIdle &&
        !hnd.front &&
        performancePoseActive &&
        this.performanceSample.backHandBlend > 0
      ) {
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
      // Brace: draw both hands to the selected high/mid/low weapon contact.
      if (guardBlend > 0) {
        const pose = parrySuccess > 0 ? this.parryGuardPose : 1;
        const handSide = hnd.front ? 1 : -1;
        const bx =
          TARGET_BODY_H *
          (PARRY_GUARD_HAND_FORWARD[pose] + handSide * (pose === 1 ? 0.015 : 0.035));
        const by = hnd.oy - TARGET_BODY_H * PARRY_GUARD_HAND_LIFT[pose];
        hx += (bx - hx) * guardBlend;
        hy += (by - hy) * guardBlend;
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
      // Keep the same continuous parent mirror used by every other pose. Live muzzle VFX samples the final
      // rendered implement matrix; authority continues to use its separate canonical muzzle fallback.
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
          const handlingHand = gunHandlingHandFor(held.def);
          const cycle = this.gunHandlingCycles[0];
          const cycleDurationMs = gunHandlingCycleDurationMs(handling, held.def.gun?.fireRate);
          const cycleElapsedMs = sceneNow - cycle.startMs;
          const cycleMatches =
            cycle.active &&
            cycle.weaponId === held.def.id &&
            cycle.mechanism === handling &&
            cycle.acceptedSeq === this.attackBeatSeq;
          sampleGunHandlingHandOffset(
            cycleMatches && handlingHand === "secondary" ? handling : undefined,
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
          if (isBreakActionWeapon(held.def)) {
            resolveBreakActionSecondaryGripPosition(
              gripInput,
              held.def.breakAction.hinge,
              this.breakActionSample.angleRad,
              this.secondaryGripPoint,
            );
          } else {
            resolveSecondaryGripPosition(gripInput, this.secondaryGripPoint);
          }
          back.img.x = this.secondaryGripPoint.x;
          back.img.y = this.secondaryGripPoint.y;
        } else {
          // No authored secondary point means byte-for-byte legacy two-hand spacing behavior.
          const haft = this.attackHandSpacing;
          back.img.x = front.img.x + Math.cos(weaponAngle) * haft;
          back.img.y = front.img.y + Math.sin(weaponAngle) * haft;
        }
        back.img.rotation = secondaryGripHandRotationFor(held?.def, weaponAngle);
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

    // Authored dual pistols use a deliberately asymmetric silhouette. The weapon pass below follows these
    // hand anchors, so the guns separate with the hands.
    if (this.weapons.length > 1 && !hasAimedFiringWeapon) {
      const front = this.hands.find((hand) => hand.front);
      const back = this.hands.find((hand) => !hand.front);
      if (front) front.img.y += authoredDualPistolHandYOffset(this.weaponDef, 0) * TARGET_BODY_H;
      if (back) back.img.y += authoredDualPistolHandYOffset(this.weaponDef, 1) * TARGET_BODY_H;
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

    if (
      posePhase === "idle" &&
      semanticDef?.glovePair !== undefined &&
      isMartialIdleHandPose(semanticDef.poseLanguage?.idle) &&
      !anyFlourishActive
    ) {
      const leadAngle = martialIdleHandAngleFor(semanticDef, 0);
      const offAngle = martialIdleHandAngleFor(semanticDef, 1);
      if (leadAngle !== undefined) weaponAngle = leadAngle;
      if (offAngle !== undefined) backWeaponAngle = offAngle - this.offWeaponLean();
    }

    this.applyUltimatePose(timeMs);

    const hammerDef = this.weapons[this.gunRecoilHand]?.def;
    sampleRevolverHammerBeat(
      hammerDef,
      sceneNow - this.gunRecoilAtMs,
      (hammerDef?.displayLength ?? 0) / (this.baseScale || 1),
      reducedMotion,
      this.revolverHammerBeat,
    );
    this.syncRevolverHammerLayer();

    // Weapon(s): held in hand at the angle computed above (upright at rest → chop on swing).
    let dualWhirlwindOwnsOffWeapon = false;
    for (let i = 0; i < this.weapons.length; i++) {
      const w = this.weapons[i];
      if (!w) continue;
      if (i === 1 && dualWhirlwindOwnsOffWeapon) continue;
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
        const waistY = TARGET_BODY_H * 0.06;
        const gripR = TARGET_BODY_H * 0.3;
        const opposed = opposedWhirlwindPose(th, SQ, waistY, gripR);
        const rlen = opposed.projectedLength; // projected radial length: 1 sideways → SQ toward/away
        const rot = opposed.rotation;
        const gx = opposed.lead.x;
        const gy = opposed.lead.y;
        w.img.setPosition(gx, gy);
        w.img.rotation = rot;
        w.img.setScale(base * rlen, base); // foreshorten the LENGTH only — the paper-sword effect
        // Both hands ride the haft (the orbit owns them during the spin). §40.1 the back hand's spacing keeps
        // a MINIMUM separation — a fully foreshortened radial collapsed both grips onto one point, reading as
        // a one-handed swing; clamping the projected haft (plus a tiny fixed split) keeps two visible grips.
        const front = this.hands.find((h) => h.front);
        const back = this.hands.find((h) => !h.front);
        if (front) front.img.setPosition(gx, gy);
        const offWeapon = this.orbitSpin && def.dual ? this.weapons[1] : undefined;
        if (offWeapon && back) {
          const offBase = offWeapon.baseScale / (this.baseScale || 1);
          offWeapon.img.setPosition(opposed.off.x, opposed.off.y);
          // The off-side source image is mirrored, so this shared semantic rotation points it opposite.
          offWeapon.img.rotation = rot;
          offWeapon.img.setScale(offBase * rlen, offBase);
          back.img.setPosition(opposed.off.x, opposed.off.y);
          back.img.rotation = 0;
          dualWhirlwindOwnsOffWeapon = true;
        } else if (back) {
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
        base * lengthScale * (this.authoredDualWeaponScaleX[i] ?? 1),
        base * thicknessScale * (i === 0 && ownsSwingScale ? weaponThicknessSign : 1),
      );
      if (i === this.gunRecoilHand && this.revolverHammerBeat.active) {
        const c = Math.cos(w.img.rotation);
        const s = Math.sin(w.img.rotation);
        w.img.x +=
          c * this.revolverHammerBeat.weaponForward -
          s * this.revolverHammerBeat.weaponLateral;
        w.img.y +=
          s * this.revolverHammerBeat.weaponForward +
          c * this.revolverHammerBeat.weaponLateral;
        w.img.rotation += this.revolverHammerBeat.weaponRotationRad;
      }
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
    this.applyBreakActionGeometry();
    this.applyComboStageTransition(sceneNow);
    const revolverWeapon = this.weapons[this.gunRecoilHand];
    if (revolverWeapon && this.revolverHammerBeat.active) {
      const hammerHand =
        revolverHammerHandFor(revolverWeapon.def) === "secondary"
          ? this.hands.find((hand) => !hand.front)
          : revolverWeapon.hand;
      const c = Math.cos(revolverWeapon.semanticRotation);
      const s = Math.sin(revolverWeapon.semanticRotation);
      if (hammerHand) {
        hammerHand.img.x +=
          c * this.revolverHammerBeat.handForward - s * this.revolverHammerBeat.handLateral;
        hammerHand.img.y +=
          s * this.revolverHammerBeat.handForward + c * this.revolverHammerBeat.handLateral;
      }
    }
    // Trigger-owned mechanisms include dual guns and two-hand levers whose other hand is explicitly
    // planted on the barrel. Every late pose/lift pass has already re-seated held art onto its canonical
    // aimed hand, so displace only the rendered trigger hand while gun/muzzle affines stay authoritative.
    if (this.orbitT < 0) {
      for (let handIndex = 0; handIndex < this.weapons.length; handIndex++) {
        const held = this.weapons[handIndex];
        if (!held) continue;
        const handling = gunHandlingMechanismFor(held.def);
        if (!handling || gunHandlingHandFor(held.def) !== "primary") continue;
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

    // B68 final-channel arbitration. The existing modules author candidate transforms above; this is the
    // only commit gate. B54 claims scope attacks to their declared limbs, then a total priority order and
    // retained crossfade remove execution-order ownership and hard release pops.
    const actionActive =
      posePhase !== "idle" || ownFront > 0.001 || ownBack > 0.001 || ownFeet > 0.001;
    const activeBeat =
      this.swing?.comboStep ?? (this.comboFamily !== "none" ? this.swingStep : undefined);
    const heldClaims = this.weaponDef?.limbClaims?.held;
    const beatClaims =
      activeBeat === undefined
        ? undefined
        : (this.weaponDef?.limbClaims?.comboBeats[activeBeat] ??
          this.weaponDef?.limbClaims?.comboBeats[Math.max(0, activeBeat - 1)]);
    const claimWeight = (limb: WeaponLimb, fallback: number): number => {
      if (!actionActive) return 0;
      if (!heldClaims && !beatClaims) return fallback;
      return heldClaims?.some((claim) => claim.limb === limb) ||
        beatClaims?.some((claim) => claim.limb === limb)
        ? Math.max(fallback, 0.001)
        : 0;
    };
    const heldConstraint = (limb: WeaponLimb): number =>
      !actionActive && heldClaims?.some((claim) => claim.limb === limb) ? 1 : 0;
    const hardConstraint =
      this.downed || this.ultimatePhase !== UltimatePhase.Idle || this.orbitT >= 0 ? 1 : 0;
    const flourishBodyWeight = anyFlourishActive ? 1 : 0;
    const mechanismActive =
      this.revolverHammerBeat.active || this.gunHandlingCycles.some((cycle) => cycle.active);

    this.limbPriority.applyWeights(
      "body-lean",
      this.body,
      sceneNow,
      hardConstraint,
      claimWeight("body-lean", Math.max(ownFront, ownBack, ownFeet)),
      0,
      flourishBodyWeight,
      gait,
    );
    for (const hand of this.hands) {
      const limb = hand.elementId as WeaponLimb;
      if (limb !== "hand-l" && limb !== "hand-r") continue;
      const beforeX = hand.img.x;
      const beforeY = hand.img.y;
      const authoredOwn = hand.front ? ownFront : ownBack;
      const channel = this.flourishChannels[hand.front ? 0 : 1];
      const handMechanism =
        mechanismActive &&
        (this.weapons.some((weapon) => weapon.hand === hand) ||
          (this.revolverHammerBeat.active &&
            revolverHammerHandFor(this.weaponDef) === "secondary"))
          ? 1
          : 0;
      this.limbPriority.applyWeights(
        limb,
        hand.img,
        sceneNow,
        Math.max(hardConstraint, heldConstraint(limb)),
        claimWeight(limb, authoredOwn),
        handMechanism,
        channel?.active ? 1 : 0,
        gait,
      );
      const dx = hand.img.x - beforeX;
      const dy = hand.img.y - beforeY;
      if (Math.abs(dx) + Math.abs(dy) > 1e-6) {
        for (const weapon of this.weapons) {
          if (weapon.hand !== hand) continue;
          weapon.img.x += dx;
          weapon.img.y += dy;
        }
      }
    }
    for (const foot of this.feet) {
      const limb = foot.elementId as WeaponLimb;
      if (limb !== "foot-l" && limb !== "foot-r") continue;
      this.limbPriority.applyWeights(
        limb,
        foot.img,
        sceneNow,
        hardConstraint,
        claimWeight(limb, ownFeet),
        0,
        0,
        gait,
      );
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
    if (this.weaponDef?.elementTransforms) {
      const authoredPose = posePhase === "idle" ? "idle" : "held";
      const authoredBeat =
        posePhase === "idle"
          ? undefined
          : (this.swing?.comboStep ?? (this.comboFamily !== "none" ? this.swingStep : undefined));
      const applyAuthored = (
        elementId: WeaponElementId,
        image: Phaser.GameObjects.Image | undefined,
        definition: WeaponDef | undefined = this.weaponDef,
      ): void => {
        if (!image || !definition?.elementTransforms) return;
        const transform = resolveWeaponElementTransform(
          definition.elementTransforms,
          elementId,
          authoredPose,
          authoredBeat,
          layoutFacing,
        );
        if (!transform) return;
        image.x += transform.dx;
        image.y += transform.dy;
        image.rotation += transform.rotationRad;
        image.scaleX *= transform.scale;
        image.scaleY *= transform.scale;
      };
      applyAuthored("head", this.boilerplateHead);
      for (const hand of this.hands) applyAuthored(hand.elementId, hand.img);
      for (const foot of this.feet) applyAuthored(foot.elementId, foot.img);
      for (const weapon of this.weapons) {
        applyAuthored(`part-${weapon.partIndex + 1}`, weapon.img, weapon.def);
      }
      applyAuthored("part-2", this.breakActionAttachment?.barrel);
    }
    if (hasGunHeld && gunCheekWeldPose && this.boilerplateHead) {
      const determinantSign =
        this.boilerplateHead.scaleX * this.boilerplateHead.scaleY < 0 ? -1 : 1;
      // Apply the catalog-scaled drop after the floating-head spring has resolved, then let the existing
      // gear pass inherit the same final head transform. rangedAimBlend provides the authored smooth
      // raise/lower envelope, and determinantSign keeps the nod visually downward through either facing.
      this.boilerplateHead.y += gunCheekWeldPose.dropPx * rangedAimBlend;
      this.boilerplateHead.rotation += determinantSign * gunCheekWeldPose.nodRad * rangedAimBlend;
    }
    if (this.boilerplateHead) {
      this.limbPriority.applyWeights(
        "head",
        this.boilerplateHead,
        sceneNow,
        hardConstraint,
        claimWeight("head", Math.max(ownFront, ownBack)),
        0,
        anyFlourishActive ? 1 : 0,
        gait,
      );
    }
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
    if (this.weaponDef?.elementTransforms) {
      const authoredPose = posePhase === "idle" ? "idle" : "held";
      const authoredBeat =
        posePhase === "idle"
          ? undefined
          : (this.swing?.comboStep ?? (this.comboFamily !== "none" ? this.swingStep : undefined));
      for (const weapon of this.wrapFootWeapons) {
        const transform = resolveWeaponElementTransform(
          this.weaponDef.elementTransforms,
          `part-${weapon.partIndex + 1}`,
          authoredPose,
          authoredBeat,
          layoutFacing,
        );
        if (!transform) continue;
        weapon.img.x += transform.dx;
        weapon.img.y += transform.dy;
        weapon.img.rotation += transform.rotationRad;
        weapon.img.scaleX *= transform.scale;
        weapon.img.scaleY *= transform.scale;
      }
    }
    const leadWeapon = this.weapons[0];
    const offWeapon = this.weapons[1];
    if (this.authoredDualGlintAlpha > 0 && leadWeapon && offWeapon && !outsidePaperView) {
      this.authoredDualGlint
        .setPosition(
          (leadWeapon.img.x + offWeapon.img.x) * 0.5,
          (leadWeapon.img.y + offWeapon.img.y) * 0.5,
        )
        .setRotation((leadWeapon.semanticRotation + offWeapon.semanticRotation) * 0.5 + Math.PI / 2)
        .setScale(
          screenTrueScaleX(
            this.root.scaleX,
            this.root.scaleY,
            0.72 + this.authoredDualGlintAlpha * 0.5,
          ),
          0.7 + this.authoredDualGlintAlpha * 0.3,
        )
        .setAlpha(this.authoredDualGlintAlpha)
        .setVisible(true);
    } else {
      this.authoredDualGlint.setVisible(false);
    }
    this.syncTomeVisual(sceneNow, outsidePaperView);
    this.syncStrikeOverlays(sceneNow, outsidePaperView);
    if (this.weaponDef?.elementTransforms && this.weaponDef.strikeOverlayPart) {
      const authoredPose = posePhase === "idle" ? "idle" : "held";
      const authoredBeat =
        posePhase === "idle"
          ? undefined
          : (this.swing?.comboStep ?? (this.comboFamily !== "none" ? this.swingStep : undefined));
      const transform = resolveWeaponElementTransform(
        this.weaponDef.elementTransforms,
        `part-${this.weaponDef.strikeOverlayPart}`,
        authoredPose,
        authoredBeat,
        layoutFacing,
      );
      if (transform) {
        for (const overlay of this.strikeOverlays) {
          overlay.img.x += transform.dx;
          overlay.img.y += transform.dy;
          overlay.img.rotation += transform.rotationRad;
          overlay.img.scaleX *= transform.scale;
          overlay.img.scaleY *= transform.scale;
        }
      }
    }
    this.syncObservedSourceFlash(sceneNow, outsidePaperView);
    this.flushCrossfallRibbon(sceneNow, outsidePaperView);
    this.updateMeleeTellWeaponVisuals(sceneNow);
    this.applySlideInkTell(
      this.moveStance === STANCE_SLIDE &&
        this.slidePhase === SLIDE_PHASE_GROUND &&
        this.slideRenderT <= ROLL_IFRAME_TICKS * ROLL_TICK_SECONDS,
    );
    this.updateJuggleFlash(sceneNow);
    if (parrySuccessElapsed >= 0 && parrySuccessElapsed < 90) {
      for (const weapon of this.weapons)
        weapon.img.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    }
    this.updateSlideAfterimages(sceneNow, anim.reducedMotion === true || outsidePaperView);
    // §5/§20 the grounded shadow shrinks + fades as the rig rises, so height reads as altitude (the gap
    // between the lifted art and the planted shadow). The shadow itself never lifts.
    // Standing law: worn weapons never create player-root aura/glow layers. Only an explicit
    // server-authored aura delivery may publish its gameplay field here.
    const performanceAura = this.performanceSpec?.aura;
    const auraRadius = performanceAura?.radius;
    const auraColor = performanceAura?.color;
    const auraActive =
      auraRadius !== undefined && auraColor !== undefined && anim.fireHeld === true && !this.downed;
    const paintedAura = resolveWeaponAuraVfxRecipe(this.weaponDef);
    const paintedAuraTreatment = weaponPaintedAuraFor(this.weaponDef?.id);
    const paintedAuraActive =
      auraActive && (paintedAura !== undefined || paintedAuraTreatment !== undefined);
    this.auraGlow.setVisible(auraActive && !paintedAuraActive);
    this.auraRing.setVisible(auraActive && !paintedAuraActive);
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
        .setFillStyle(auraColor, 0.13)
        .setDisplaySize(diameter, diameter * 0.56)
        .setAlpha(0.72);
      this.auraRing
        .setStrokeStyle(3, auraColor, 0.72)
        .setDisplaySize(diameter * 0.96, diameter * 0.54)
        .setAlpha(0.82);
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
  },
} satisfies ThisType<SpriteRigContext>;
