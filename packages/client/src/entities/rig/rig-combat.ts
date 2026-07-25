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
} from "../kung-fu-wrap-pose.js";import { SPRITE_ATLAS, partTexture, TARGET_BODY_H, BODY_LOOK_LEAN, MELEE_FORWARD_READY_CANT, forwardMeleeReadyAngle, PARRY_GUARD_ANGLE_OFFSETS, PARRY_GUARD_HAND_FORWARD, PARRY_GUARD_HAND_LIFT, CLIENT_VISUAL_COMBOS, COMBO_HOLD_RELEASE_MS, MONK_FLURRY_MIN_POSE_MS, COMBO_STAGE_TRANSITION_MAX_MS, MELEE_GLINT_LEAD_MS, MELEE_GLINT_CREST_MS, TOME_IDLE_CLOSE_MS, TOME_PAGE_INTERVAL_MS, TOME_PAGE_DURATION_MS, TOME_SETTLE_DURATION_MS, TOME_SCRAP_DURATION_MS, REMOTE_SIGNATURE_LOD_MARGIN_PX, REMOTE_SOURCE_FLASH_MS, RANGED_AIM_LINGER_MS, RANGED_AIM_RAISE_MS, RANGED_AIM_SETTLE_MS, GUN_RECOIL_ACTIVE_MS, RANGED_GUN_RECOVERY_MS, DUAL_BACK_WEAPON_LEAN, CLOSE_BLADE_RELEASE_T, authoredWeaponRenderPlan, opposedWhirlwindPose, NO_WRAP_RIG_MOUNTS, FOUR_LIMB_WRAP_RIG_MOUNTS, wrapRigMountPlan, wrapRigFacingSign, wrapRigReceiverRelativeScale, strikeOverlayImpactVisible, measureBladeWidthAtExtensionJoin, createComboChainState, CROSSFALL_STEP, routeSwingChannels, isTerminalFlourishStep, flourishStreakWindowMs, flourishMovementIntent, rawFlourishIntentCancels, nextFlourishStreakCount, PISTOL_IDLE_TWIRL_DELAY_MS, PISTOL_DUAL_TWIRL_STAGGER_MS, GENERIC_IDLE_FLOURISH_DELAY_MS, DUAL_PISTOL_HAND_RISE_BODY_FRAC, idleFlourishEligibleEpoch, flourishCanOverridePersistentGunAim, authoredDualPistolHandYOffset, createGunHandlingCycleState, gunHandlingMechanismFor, gunHandlingCycleDurationMs, sampleGunHandlingHandOffset, resolveSecondaryGripPosition, resolveBreakActionSecondaryGripPosition, clamp01, smoothstep01, mixRgb, smootherstep01, cubicOut01, backOut01, mixAngle, comboStageTransitionDurationMs, comboStageTransitionBlend, blendComboStagePoseTransform, blendComboStagePresentationTransform, stepAngleBounded, paperPopScaleX, paperPopScaleY, paperPopRotation, signedClamp, sampleAuthoredDualCeremony, attackSignatureColor, actionOwnershipAt, remapPoseTimeAtImpact, createCloseBladePoseInput, createCloseBladePoseSample, sampleCloseBladePose, comboGraceMs, FLOATING_HEAD_SPRING_TUNING, sampleFloatingHeadWalkBob, clampFloatingHeadOffset, stepFloatingHeadSpring, createFlourishChannel, createFlourishArmState, createFlourishStreakState, createOutgoingStowProxy, resetJigglePart, syncOwnedJigglePart, stepJigglePart, sampleRangedAimBlend, SPRITE_RIG_STATICS as SpriteRig } from "./rig-core.js";
import type { RigComboFamily, RigSwingHand, RigLoadoutPiece, OpposedWhirlwindPose, WrapRigReceiver, WrapRigMount, WrapRigScaleInput, RigSwingDescriptor, WeaponBladeAttachmentPose, ComboChainState, ComboStageTransitionState, ComboStageTransformNode, SwingChannelSample, RawFlourishIntent, GunHandlingMechanism, GunHandlingCycleState, GunHandlingHandOffset, SecondaryGripTransformInput, RigAttackPresentationScene, ComboStageTransitionTiming, ComboStagePoseTransform, ComboStageParentTransform, AuthoredDualCeremonySample, CloseBladePoseVariant, CloseBladePoseInput, CloseBladePoseSample, JigglePartState, FloatingHeadSpringState, FloatingHeadSpringInput, FloatingHeadSpringTuning, TomePageQuad, TomeScrap, TomeVisualState, RigHand, RigFoot, BreakActionAttachment, FlourishChannelState, FlourishArmState, FlourishStreakState, OutgoingStowProxy, GearAttachment, RigAnim, VastagharRigPose, PaperDeathTreatment, PaperDeathPartPose, PaperDeathState, SpriteRigContext } from "./rig-core.js";

export const rigCombatMethods = {
  /** §50 Driftblade-model panel: the latest triggered descriptor, ENRICHED with the accepted/predicted
   *  combo step by `triggerSwing`. ArenaScene's owner-side `spawnSlash` reads it so the per-step ribbon
   *  reaches the wielder's own VFX exactly like the remote observed-signature path. */
  get activeSwing(): RigSwingDescriptor | undefined {
    return this.swing;
  },
  get activeSwingHand(): RigSwingHand {
    return this.swingHand;
  },
  get isCrossfallActive(): boolean {
    return this.crossfallActive;
  },

  /** Exact cosmetic enemy-arc sample. Unlike player height, this value is already locally reconstructed at
   *  render time; animate applies it without another network-smoothing lag. */
  setEnemyComboPresentation(this: SpriteRigContext,
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
  },

  triggerEnemyComboReturn(this: SpriteRigContext, timeMs: number): void {
    this.enemyComboReturnAtMs = timeMs;
  },

  triggerEnemyComboLanding(this: SpriteRigContext, timeMs: number): void {
    this.enemyComboLandedAtMs = timeMs;
  },

  triggerEnemyComboStagger(this: SpriteRigContext, timeMs: number): void {
    this.enemyComboStaggerAtMs = timeMs;
  },

  /** Victim-side transition edge. Height/vh remain authoritative; this is only the brief paper tumble. */
  triggerJuggled(this: SpriteRigContext, timeMs: number): void {
    this.juggledAtMs = timeMs;
  },

  /** §33 COLOSSUS framing: a PERMANENT upward art-lift (in body-heights) so a giant renders feet-at-the-
   *  ground with its torso towering off the top of the screen — "you only see his lower body". Like the hop,
   *  it moves ONLY the visible art (logical position, depth-sort + the grounded shadow stay put). `frac` = how
   *  many body-heights to lift; 0 = normal. */
  setLowerBodyFrame(this: SpriteRigContext, frac: number): void {
    this.baseLift = frac * TARGET_BODY_H;
  },

  /** Weapon/scene lifetime boundary: no accepted cadence or held guard may cross it. */
  resetSwingCombo(this: SpriteRigContext): void {
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
  },

  /** Snapshot only presentation channels. Root/weapon combat transforms stay on the authored accepted clock. */
  beginComboStageTransition(this: SpriteRigContext, acceptedAtMs: number, swing: RigSwingDescriptor): void {
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
  },

  /** Bridge body-only presentation under the authored root. Weapon images are intentionally never captured. */
  applyComboStageTransition(this: SpriteRigContext, sceneNow: number): void {
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
  },

  /** Attack-shadow channels are authored after gear/VFX followers, so their safe residual is committed last. */
  applyComboStageShadowTransition(this: SpriteRigContext, sceneNow: number): void {
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
  },

  /** Undo late paper transforms and close-blade target deltas when no subsequent frame can restore identity. */
  releaseAttackVisuals(this: SpriteRigContext): void {
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
  },

  /** Timeout may preserve the old hold long enough to ease it out; swaps clear it immediately. */
  resetComboChain(this: SpriteRigContext, clearHold: boolean): void {
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
  },

  /** Arena's `animClock` advances only on unfrozen frames. Accepted beats arrive in Phaser wall time, so
   * preserve their relative offset while moving the epoch onto the one freeze-aware presentation clock. */
  presentationClockNow(this: SpriteRigContext): number {
    const sceneClock = (this.scene as RigAttackPresentationScene).animClock;
    if (typeof sceneClock === "number" && Number.isFinite(sceneClock)) return sceneClock;
    return this.prevAnimMs >= 0 ? this.prevAnimMs : (this.scene.time?.now ?? 0);
  },

  // Extraction trace: private presentationEpochForWallEpoch(epochMs: number)
  presentationEpochForWallEpoch(this: SpriteRigContext, epochMs: number): number {
    const wallNow = this.scene.time?.now ?? 0;
    const arena = this.scene as RigAttackPresentationScene;
    const freezeHolding = (arena.frozenUntil ?? -Infinity) > wallNow || arena.wasFrozen === true;
    // A beat accepted while presentation is held begins at the held phase. Authoritative simulation still
    // advances; this only prevents the first unfrozen rig frame from inheriting wall time spent in hit-stop.
    const relativeMs = freezeHolding ? Math.max(0, epochMs - wallNow) : epochMs - wallNow;
    return this.presentationClockNow() + relativeMs;
  },

  /** Flush the one retained remote action intent only from `animate()`. Since Arena skips rig animation
   * during hit-stop, an accepted beat observed inside the freeze cannot let its authored source flourish run
   * ahead of the held actor. The predicting owner keeps ArenaScene's existing immediate dispatcher. */
  // Extraction trace: private flushObservedAttackSignature(
  flushObservedAttackSignature(this: SpriteRigContext, sceneNow: number, outsidePaperView: boolean): void {
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
  },

  /** Crossfall's rear edge is the sanctioned second ribbon, staggered by 0.06 of the pose window. */
  flushCrossfallRibbon(this: SpriteRigContext, sceneNow: number, outsidePaperView: boolean): void {
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
  },

  /** Copy the final held-weapon transform into retained source shapes. This is the remote cast/tome LOD;
   * it never allocates from the render loop and never competes with exact danger geometry. */
  // Extraction trace: private syncObservedSourceFlash(
  syncObservedSourceFlash(this: SpriteRigContext, sceneNow: number, outsidePaperView: boolean): void {
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
  },

  /** Start a swing animation (damage is server-authoritative). `timeMs` is the accepted/predicted Phaser
   * wall epoch and is mapped once onto Arena's freeze-aware presentation clock; `aimWorld` freezes aim. */
  triggerSwing(this: SpriteRigContext,
    timeMs: number,
    aimWorld?: number,
    swing?: RigSwingDescriptor,
    handOverride?: RigSwingHand,
    authoredDualStepOverride?: number,
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
    const authoredDualMelee =
      paired &&
      !!this.weaponDef &&
      !this.weaponDef.glovePair &&
      !this.weaponDef.gun &&
      !this.weaponDef.cast &&
      !this.weaponDef.beam;
    const alternatingComboDual =
      authoredDualMelee && this.weaponDef?.comboVariant === "wyrmscale-inferno-talons";
    const authoredDualSequenceLength = alternatingComboDual
      ? 4
      : AUTHORED_DUAL_MELEE_SEQUENCE_LENGTH;
    const priorAuthoredDualStep = this.authoredDualBarStep;
    const authoredDualStageContinues =
      authoredDualMelee && priorAuthoredDualStep >= 0 && timeMs <= this.authoredDualBarExpiresAtMs;
    let comboStageAdvances = false;
    const explicitAuthoredDualStep = authoredDualStepOverride ?? swing?.authoredDualStep;
    let authoredDualStep = -1;
    if (authoredDualMelee) {
      if (explicitAuthoredDualStep !== undefined) {
        authoredDualStep =
          ((Math.trunc(explicitAuthoredDualStep) % authoredDualSequenceLength) +
            authoredDualSequenceLength) %
          authoredDualSequenceLength;
      } else {
        authoredDualStep =
          timeMs <= this.authoredDualBarExpiresAtMs
            ? (this.authoredDualBarStep + 1) % authoredDualSequenceLength
            : 0;
      }
      comboStageAdvances = authoredDualStageContinues && authoredDualStep !== priorAuthoredDualStep;
      this.authoredDualBarStep = authoredDualStep;
      const cadence = requestedSwing?.effectiveCooldown ?? this.weaponDef?.cooldown ?? 0.3;
      this.authoredDualBarExpiresAtMs = timeMs + cadence * 1000 + comboGraceMs(cadence);
    }
    const barHand =
      authoredDualStep < 0
        ? undefined
        : alternatingComboDual
          ? authoredDualStep % 2 === 0
            ? "lead"
            : "off"
          : AUTHORED_DUAL_MELEE_BAR[authoredDualStep];
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
      swingHand = authoredDualHandForSeq(this.attackBeatSeq, 0);
    } else if (
      paired &&
      handOverride === undefined &&
      swing?.hand === undefined &&
      this.hasAttackBeatSeq &&
      this.authoredDualBaseSeqReady
    ) {
      swingHand = authoredDualHandForSeq(this.attackBeatSeq, this.authoredDualBaseSeq);
    }
    const handIndex: 0 | 1 = swingHand === 1 ? 1 : 0;
    const activeDef = this.weapons[handIndex]?.def ?? this.weaponDef;
    let terminalFlourishHand: 0 | 1 | undefined;
    const terminalAuthoredDualBar =
      authoredDualMelee &&
      !alternatingComboDual &&
      isTerminalFlourishStep(authoredDualStep, AUTHORED_DUAL_MELEE_BAR.length);
    let nextSwing: RigSwingDescriptor | undefined;
    if (activeDef) {
      const effectiveCooldown = requestedSwing?.effectiveCooldown ?? activeDef.cooldown;
      nextSwing = {
        ...requestedSwing,
        ...swingDescriptorFor(activeDef, effectiveCooldown),
        hand: swingHand,
        ...(authoredDualStep >= 0 ? { authoredDualStep } : {}),
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
      this.comboExpiresAtMs = this.authoredDualBarExpiresAtMs;
      this.swingStep = 2;
      this.swingDirection = 0;
      this.swingFamily = "rake";
      this.swingVariant = "default";
      this.comboHoldPose = {
        family: "rake",
        variant: "default",
        step: 2,
        direction: 0,
        expiresAtMs: this.authoredDualBarExpiresAtMs,
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
      const comboChainHand =
        activeDef.glovePair && (activeDef.impactMuzzle || activeDef.glovePair.sharedCombo)
          ? 0
          : handIndex;
      const chain = this.comboChains[comboChainHand];
      const continues =
        chain.family === family && chain.weaponId === activeDef.id && timeMs <= chain.expiresAtMs;
      const previousStep = chain.step;
      const step =
        authoredDualStep >= 0
          ? alternatingComboDual
            ? authoredDualStep % sequence.length
            : Math.min(sequence.length - 1, Math.floor(authoredDualStep / 2))
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
        const sharedGraceMs = meleeComboGraceMs(nextSwing.effectiveCooldown, sequence);
        const expiresAtMs = timeMs + nextSwing.effectiveCooldown * 1000 + sharedGraceMs;
        const chainExpiresAtMs = acceptedAtMs + nextSwing.effectiveCooldown * 1000 + sharedGraceMs;
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
      if (terminalAuthoredDualBar) {
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
  },

  /** Sample a horde-melee anticipation directly from the latest reconstructed authoritative phase. */
  setMeleeTell(this: SpriteRigContext,
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
  },

  /** B33 full-body wind-up channel. All rigs use their palette accent; no world/floor geometry participates. */
  setEnemyMeleeTelegraph(this: SpriteRigContext, phase: number, accent: number): void {
    this.enemyMeleeTintPhase = clamp01(phase);
    this.enemyMeleeAccent = accent & 0xffffff;
    const popping = this.presentationClockNow() < this.enemyMeleePopUntilMs;
    const key =
      (popping ? 1 << 30 : 0) |
      ((Math.round(this.enemyMeleeTintPhase * 32) & 0x3f) << 24) |
      this.enemyMeleeAccent;
    if (key === this.enemyMeleeTintKey) return;
    this.enemyMeleeTintKey = key;
    this.restTint();
  },

  /** The universal commit edge: one crisp white body frame and a tiny hue-independent squash. */
  commitMeleeTell(this: SpriteRigContext, timeMs: number, aimWorld: number): void {
    timeMs = this.presentationEpochForWallEpoch(timeMs);
    this.meleeTellReleasePose = true;
    this.meleeTellAimWorld = aimWorld;
    this.meleeTellMode = "commit";
    this.meleeTellPhase = 1;
    this.meleeTellRemainingMs = 200;
    this.meleeTellReleaseAtMs = timeMs;
    this.meleeTellFull = true;
    this.enemyMeleeTintPhase = 0;
    this.enemyMeleePopUntilMs = timeMs + 50;
    this.enemyMeleeTintKey = -1;
    this.clearMeleeTellTint();
    this.restTint();
  },

  /** Contact confirmation: keep the loaded vocabulary and run only its short follow-through. */
  resolveMeleeTell(this: SpriteRigContext, timeMs: number, aimWorld: number): void {
    timeMs = this.presentationEpochForWallEpoch(timeMs);
    this.meleeTellReleasePose = this.meleeTellFull;
    this.meleeTellAimWorld = aimWorld;
    this.meleeTellMode = "resolve";
    this.meleeTellPhase = 1;
    this.meleeTellReleaseAtMs = timeMs;
    this.meleeTellFull = true;
    this.clearMeleeTellTint();
  },

  /** An authoritative reset without `atkSeq`: unwind the sampled chamber without crossing contact. */
  cancelMeleeTell(this: SpriteRigContext, timeMs: number): void {
    if (this.meleeTellMode === "none") return;
    timeMs = this.presentationEpochForWallEpoch(timeMs);
    this.meleeTellReleasePose = this.meleeTellFull;
    this.meleeTellCancelPhase = this.meleeTellPhase;
    this.meleeTellMode = "cancel";
    this.meleeTellReleaseAtMs = timeMs;
    this.meleeTellFull = false;
    this.clearMeleeTellTint();
  },

  /** World-space striking-third anchor for the stable procedural bracket; returns false for handless rigs. */
  getMeleeTellAnchor(this: SpriteRigContext, out: { x: number; y: number }): boolean {
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
  },

  /** Start a parry BRACE pose (§8) — raise the weapon to a horizontal block, draw the hands up into
   *  a guard, and dip into a brace, held ~the i-frame window. Purely a STANCE (no VFX yet; on-parry
   *  effects arrive with owned parry augments). */
  triggerBrace(this: SpriteRigContext, timeMs: number): void {
    this.cancelFlourish("brace");
    this.comboStageTransition = undefined; // parry acquisition is an information-bearing sharp takeover
    // §7 v0.105 de-clunk: on a CHAIN parry (a press landing while the guard is still up), don't restart the
    // envelope from 0 — that re-ramps the raise over ~81ms and flickers the guard OFF for a frame right in
    // the Sekiro rhythm. Restart at the PLATEAU time instead so the guard holds continuously.
    this.braceStart =
      timeMs - this.braceStart < SpriteRig.BRACE_DUR ? timeMs - 0.18 * SpriteRig.BRACE_DUR : timeMs;
  },

  /** Snap the held implement and hands to the server-selected high/mid/low guard on a success receipt. */
  triggerParrySuccess(this: SpriteRigContext,
    timeMs: number,
    guardPose: ParryGuardPose,
    reaction: ParryReactionValue,
  ): void {
    this.triggerBrace(timeMs);
    this.parrySuccessStart = timeMs;
    this.parrySuccessPending = true;
    this.parryGuardPose = guardPose;
    this.parryReaction = reaction;
    for (const weapon of this.weapons)
      weapon.img.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
  },

  /** The pale unprinted face remains the roll opening's exact tell; it never borrows parry white. */
  applySlideInkTell(this: SpriteRigContext, on: boolean): void {
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
  },

  /** Sample two world-space card echoes at 60 ms spacing, then fade their retained images over 120 ms. */
  updateSlideAfterimages(this: SpriteRigContext, timeMs: number, reducedMotion: boolean): void {
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
  },

  writeSlideAfterimage(this: SpriteRigContext,
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
  },

  clearMeleeTellState(this: SpriteRigContext): void {
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
  },

  clearMeleeTellTint(this: SpriteRigContext): void {
    for (const weapon of this.weapons) {
      weapon.img.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
      weapon.tellRim?.setVisible(false);
      weapon.tellEcho?.setVisible(false);
    }
  },

  destroyMeleeTellLayers(this: SpriteRigContext): void {
    for (const weapon of this.weapons) {
      weapon.tellRim?.destroy();
      weapon.tellEcho?.destroy();
      weapon.tellRim = undefined;
      weapon.tellEcho = undefined;
    }
  },

  /** Full-tell layers are retained images; scale changes only thickness, never the weapon's painted length. */
  ensureMeleeTellLayers(this: SpriteRigContext, weapon: (typeof this.weapons)[number]): void {
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
  },

  updateMeleeTellWeaponVisuals(this: SpriteRigContext, sceneNow: number): void {
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
  },

  updateJuggleFlash(this: SpriteRigContext, sceneNow: number): void {
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
  },

  /** Brief impact flash on every part (§20 hit feedback / §6 revive pop), then back to the resting tint. */
  flash(this: SpriteRigContext, ms = 80, color = 0xffffff): void {
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
  },

  /** Absolute two-foot targets layer under the authored body translation. Ownership reaches zero by the
   * held guard, so gait/jiggle can settle without moving the authoritative root. */
  setComboFootwork(this: SpriteRigContext,
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
  },

  /** Place the rear hand at a stable pole pivot and reconstruct the lead hand down the same haft. */
  setRearPivotGrip(this: SpriteRigContext,
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
  },

  /** Greatsword Momentum: every exit carries the blade into the next entry; the body travels much less than
   * the steel, with one depth pass and a low skid rather than Driftblade's hilt beat/forward collapse. */
  // Extraction trace: private applyMomentumCombo(
  applyMomentumCombo(this: SpriteRigContext, motion: MeleeComboMotion, tt: number, aimLocal: number): number {
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
  },

  /** Claymore Breach: broadside guards stay readable throughout; lateral plants and hilt spacing provide the
   * formality, while the finisher releases one edge after a rigid bind rather than promising two hits. */
  // Extraction trace: private applyBreachCombo(
  applyBreachCombo(this: SpriteRigContext, motion: MeleeComboMotion, tt: number, aimLocal: number): number {
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
  },

  /** Glaive Compass: hand slides and projected pole length move the distant head around a quiet body. The
   * center remains visually empty and the final orbit locks to a rear-hand pivot instead of becoming spin. */
  // Extraction trace: private applyCompassCombo(
  applyCompassCombo(this: SpriteRigContext, motion: MeleeComboMotion, tt: number, aimLocal: number): number {
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
  },

  /** Bardiche Hookbreak: the head stays broad and heavy, the second beat shortens inward, and the finisher
   * briefly fixes the far head while the haft/hands wrench past it. No extra contact surface is created. */
  // Extraction trace: private applyHookbreakCombo(
  applyHookbreakCombo(this: SpriteRigContext, motion: MeleeComboMotion, tt: number, aimLocal: number): number {
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
  },

  /** Hammer-head fulcrum vault. Canonical .66 contact is remapped onto the immutable Stage-1 impact clock. */
  applyFulcrumFlip(this: SpriteRigContext, tt: number, aimLocal: number): number {
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
  },

  applyStinger(this: SpriteRigContext, tt: number, aimLocal: number): number {
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
  },

  applyHeroSpin(this: SpriteRigContext, tt: number, aimLocal: number): number {
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
  },

  applyPommelBash(this: SpriteRigContext, tt: number, aimLocal: number): number {
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
  },

  applyTrueChargedSlam(this: SpriteRigContext, tt: number, aimLocal: number): number {
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
  },

  /** Gravechill Nodachi "Cold Court" + the shared hang-then-fall payoff chassis (§50 Driftblade-model
   * panel). Where Driftblade flows, Gravechill deliberates: a reversed rising draw, a tall guard check
   * whose exit travels upward into the executioner's raise, then an overhead hang and a p² sentence.
   * Voltfang's `thunder-fall` rides the same fall chassis parameterized — shorter hang, 0.4× tremor, a
   * single depth swap instead of the length collapse, and a low forward point instead of a plant. All
   * travel stays on the visual channels (swingOff/attackArtOff/shadow/lift), never the root. */
  applyGravechillCombo(this: SpriteRigContext, motion: MeleeComboMotion, tt: number, aimLocal: number): number {
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
  },

  /** Stormpetal Odachi "Petalfall" (§50 Driftblade-model panel): wind through a flowering tree. The
   * compact beat is a choked blade FLIP (the model's fake-3D budget deliberately relocated from beat 3
   * to beat 2), and the finisher is a single-window S-cut that settles into a light high guard with one
   * visible breath — the anti-Sentence. Crosswind (beat 1, reused `slash`) rides the generic branch. */
  applyStormpetalCombo(this: SpriteRigContext, motion: MeleeComboMotion, tt: number, aimLocal: number): number {
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
  },

  /** §51 late additive combo grammar. Every clock is presentation-only; root position and damaging geometry
   * remain owned by snapshots/telegraphs. This pass is retained-transform work and allocates nothing. */
  applyEnemyComboPresentationPose(this: SpriteRigContext, timeMs: number): void {
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
  },

  applyUltimateRootPresentation(this: SpriteRigContext, timeMs: number): void {
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
  },

  /** Late additive paper pose: never changes the actor root position, targetability, or collision geometry. */
  applyUltimatePose(this: SpriteRigContext, timeMs: number): void {
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
  },

  vastagharFoot(this: SpriteRigContext, sourceFoot: number): RigFoot | undefined {
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
  },

  /** Boss-local paper theatre sampled from immutable action epochs; never moves the authoritative root. */
  applyVastagharPose(this: SpriteRigContext, reducedMotion: boolean): void {
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
  },
} satisfies ThisType<SpriteRigContext>;
