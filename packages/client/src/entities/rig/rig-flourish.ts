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
} from "../kung-fu-wrap-pose.js";import { SPRITE_ATLAS, partTexture, TARGET_BODY_H, BODY_LOOK_LEAN, MELEE_FORWARD_READY_CANT, forwardMeleeReadyAngle, PARRY_GUARD_ANGLE_OFFSETS, PARRY_GUARD_HAND_FORWARD, PARRY_GUARD_HAND_LIFT, CLIENT_VISUAL_COMBOS, COMBO_HOLD_RELEASE_MS, MONK_FLURRY_MIN_POSE_MS, COMBO_STAGE_TRANSITION_MAX_MS, MELEE_GLINT_LEAD_MS, MELEE_GLINT_CREST_MS, TOME_IDLE_CLOSE_MS, TOME_PAGE_INTERVAL_MS, TOME_PAGE_DURATION_MS, TOME_SETTLE_DURATION_MS, TOME_SCRAP_DURATION_MS, REMOTE_SIGNATURE_LOD_MARGIN_PX, REMOTE_SOURCE_FLASH_MS, RANGED_AIM_LINGER_MS, RANGED_AIM_RAISE_MS, RANGED_AIM_SETTLE_MS, GUN_RECOIL_ACTIVE_MS, RANGED_GUN_RECOVERY_MS, DUAL_BACK_WEAPON_LEAN, CLOSE_BLADE_RELEASE_T, authoredWeaponRenderPlan, opposedWhirlwindPose, NO_WRAP_RIG_MOUNTS, FOUR_LIMB_WRAP_RIG_MOUNTS, wrapRigMountPlan, wrapRigFacingSign, wrapRigReceiverRelativeScale, strikeOverlayImpactVisible, measureBladeWidthAtExtensionJoin, createComboChainState, CROSSFALL_STEP, routeSwingChannels, isTerminalFlourishStep, flourishStreakWindowMs, flourishMovementIntent, rawFlourishIntentCancels, nextFlourishStreakCount, PISTOL_IDLE_TWIRL_DELAY_MS, PISTOL_DUAL_TWIRL_STAGGER_MS, GENERIC_IDLE_FLOURISH_DELAY_MS, DUAL_PISTOL_HAND_RISE_BODY_FRAC, idleFlourishEligibleEpoch, flourishCanOverridePersistentGunAim, authoredDualPistolHandYOffset, createGunHandlingCycleState, gunHandlingMechanismFor, gunHandlingCycleDurationMs, sampleGunHandlingHandOffset, resolveSecondaryGripPosition, resolveBreakActionSecondaryGripPosition, clamp01, smoothstep01, mixRgb, smootherstep01, cubicOut01, backOut01, mixAngle, comboStageTransitionDurationMs, comboStageTransitionBlend, blendComboStagePoseTransform, blendComboStagePresentationTransform, stepAngleBounded, paperPopScaleX, paperPopScaleY, paperPopRotation, signedClamp, sampleAuthoredDualCeremony, attackSignatureColor, actionOwnershipAt, remapPoseTimeAtImpact, createCloseBladePoseInput, createCloseBladePoseSample, sampleCloseBladePose, comboGraceMs, FLOATING_HEAD_SPRING_TUNING, sampleFloatingHeadWalkBob, clampFloatingHeadOffset, stepFloatingHeadSpring, createFlourishChannel, createFlourishArmState, createFlourishStreakState, createOutgoingStowProxy, resetJigglePart, syncOwnedJigglePart, stepJigglePart, sampleRangedAimBlend } from "./rig-core.js";
import type { RigComboFamily, RigSwingHand, RigLoadoutPiece, OpposedWhirlwindPose, WrapRigReceiver, WrapRigMount, WrapRigScaleInput, RigSwingDescriptor, WeaponBladeAttachmentPose, ComboChainState, ComboStageTransitionState, ComboStageTransformNode, SwingChannelSample, RawFlourishIntent, GunHandlingMechanism, GunHandlingCycleState, GunHandlingHandOffset, SecondaryGripTransformInput, RigAttackPresentationScene, ComboStageTransitionTiming, ComboStagePoseTransform, ComboStageParentTransform, AuthoredDualCeremonySample, CloseBladePoseVariant, CloseBladePoseInput, CloseBladePoseSample, JigglePartState, FloatingHeadSpringState, FloatingHeadSpringInput, FloatingHeadSpringTuning, TomePageQuad, TomeScrap, TomeVisualState, RigHand, RigFoot, BreakActionAttachment, FlourishChannelState, FlourishArmState, FlourishStreakState, OutgoingStowProxy, GearAttachment, RigAnim, VastagharRigPose, PaperDeathTreatment, PaperDeathPartPose, PaperDeathState, SpriteRigContext } from "./rig-core.js";

export const rigFlourishMethods = {

  destroyStowProxy(this: SpriteRigContext, proxy: OutgoingStowProxy): void {
    proxy.img?.destroy();
    proxy.img = undefined;
    proxy.startMs = -1e9;
    proxy.destroyAtMs = -1e9;
  },

  clearFlourishActivity(this: SpriteRigContext, clearArms: boolean, clearProxies: boolean): void {
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
  },

  idleFlourishClockDef(this: SpriteRigContext): WeaponDef | undefined {
    return (
      this.weapons?.find((weapon) => weaponHasHandlingTag(weapon.def, "pistol"))?.def ??
      this.weaponDef
    );
  },

  /** Quiet time is player-perceived wall time. The flourish animation itself still samples the
   * freeze-aware presentation clock after it starts, so hit-stop holds a visible turn without delaying
   * its requested ~0.5s onset by several seconds. */
  idleFlourishTimerNow(this: SpriteRigContext, fallbackMs: number): number {
    const wallNow = this.scene?.time?.now;
    return typeof wallNow === "number" && Number.isFinite(wallNow) ? wallNow : fallbackMs;
  },

  /** Actionable presentation input wins immediately; combat clocks and the broader jiggle system are intact. */
  cancelFlourish(this: SpriteRigContext, _reason = "input"): void {
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
  },

  /** Test/debug seam: one increment per real cancellation edge, never per polling frame. */
  get flourishCancelEdge(): number {
    return this.flourishCancelGeneration;
  },

  /** Scene retry seam: the observed identity changed, but the incoming art has not attached yet. */
  get weaponSwapPending(): boolean {
    return this.pendingSwapKey.length > 0;
  },

  resetFlourishState(this: SpriteRigContext,
    clearCounters: boolean,
    preservePendingSwap = false,
    preserveArms = false,
  ): void {
    // An accepted attack arm is gameplay/presentation intent, not an in-flight render sample. Transient
    // animation-clock cuts must discard partial channels and proxies without erasing that earned punctuation.
    // Semantic resets (input, swap, downed/ultimate, destroy) retain the default and clear the arms.
    if (preserveArms) {
      const restartAtMs = this.presentationClockNow();
      for (const hand of [0, 1] as const) {
        const channel = this.flourishChannels[hand];
        const arm = this.flourishArms[hand];
        if (!channel.active || channel.moment !== "after-attack" || arm.armed) continue;
        const def = this.weapons[hand]?.def ?? (hand === 0 ? this.weaponDef : undefined);
        if (def) this.armAfterAttack(hand, restartAtMs, def);
      }
    }
    this.clearFlourishActivity(!preserveArms, true);
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
  },

  beatFor(this: SpriteRigContext, spec: WeaponFlourishSpec, moment: FlourishMoment) {
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
  },

  // Extraction trace: private startFlourishChannel(
  startFlourishChannel(this: SpriteRigContext,
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
  },

  /** Allocation-free lifetime reset seam retained for source-ownership checks after extraction. */
  startIncomingDraw(this: SpriteRigContext, epochMs: number): void {
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
    this.authoredDualCeremonyStartMs = -1e9;
    this.idleFlourishEligibleAtMs = idleFlourishEligibleEpoch(
      this.idleFlourishClockDef(),
      this.idleFlourishTimerNow(epochMs),
      this.idleFlourishOffsetMs,
    );
  },

  /** Snapshot the old visual before the equip path destroys it. Repeated lazy-art polling is idempotent. */
  beginWeaponSwap(this: SpriteRigContext, oldWeaponId: string, newWeaponId: string, epochMs: number): void {
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
  },

  /** Missing art is the only allowed draw delay. A permanent failure closes the retained transition. */
  finishWeaponSwapWithoutArt(this: SpriteRigContext): void {
    this.pendingSwapKey = "";
    this.pendingSwapObservedKey = "";
    this.pendingSwapEpochMs = -1e9;
    this.lastSwapKey = "";
    this.lastSwapObservedKey = "";
  },

  // Extraction trace: private completePendingWeaponSwap(): void
  completePendingWeaponSwap(this: SpriteRigContext): void {
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
  },

  // Extraction trace: private armAfterAttack(
  armAfterAttack(this: SpriteRigContext, hand: 0 | 1, earliestStartMs: number, def: WeaponDef): void {
    const arm = this.flourishArms[hand];
    arm.armed = true;
    arm.earliestStartMs = earliestStartMs;
    arm.weaponId = def.id;
  },

  recordAcceptedRangedBeat(this: SpriteRigContext, hand: 0 | 1, epochMs: number): void {
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
  },

  cancelForAcceptedRangedBeat(this: SpriteRigContext, hand: 0 | 1): void {
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
  },

  tryStartArmedFlourish(this: SpriteRigContext, sceneNow: number): void {
    const leadReady =
      this.flourishArms[0].armed && sceneNow >= this.flourishArms[0].earliestStartMs;
    const offReady = this.flourishArms[1].armed && sceneNow >= this.flourishArms[1].earliestStartMs;
    if (!leadReady && !offReady) return;
    const both = leadReady && offReady;
    const nextLead: 0 | 1 =
      both && this.authoredDualBaseSeqReady
        ? authoredDualHandForSeq((this.attackBeatSeq + 1) >>> 0, this.authoredDualBaseSeq)
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
  },

  sampleFlourishChannel(this: SpriteRigContext,
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
  },

  updateStowProxies(this: SpriteRigContext, sceneNow: number, reducedMotion: boolean): void {
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
  },
} satisfies ThisType<SpriteRigContext>;
