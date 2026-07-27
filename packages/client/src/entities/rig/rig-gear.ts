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

export const rigGearMethods = {

  /** Select the fixed blank kit without ever exposing an unresolved texture key. */
  requestBoilerplate(this: SpriteRigContext, manifest: GearPartsManifest): void {
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
  },

  /** Texture-only helmet seam: unresolved future head art safely leaves the boilerplate head installed. */
  applyLoadoutHeadTexture(this: SpriteRigContext): void {
    const head = this.boilerplateHead;
    if (!head) return;
    if (this.gearUsesReplacement && this.gearBakeLease) return;
    const requested = this.loadoutHeadTexture;
    const selected = this.scene.textures.exists(requested.textureKey)
      ? requested
      : DEFAULT_LOADOUT_HEAD_TEXTURE;
    head.setTexture(selected.textureKey, selected.frame);
  },

  /** A compatibility scaffold may omit a limb; promote the authored boilerplate part into the normal
   * hand/foot arrays so every pose and limb-physics writer sees the same complete five-node base skeleton. */
  createBoilerplateLimb(this: SpriteRigContext, part: BoilerplateAssemblyPart): RigHand {
    const img = this.scene.add
      .image(part.x, part.y, boilerplateTextureKey(part.source.id))
      .setOrigin(part.originX, part.originY)
      .setScale(part.scale)
      .setRotation(part.rotation);
    const limb: RigHand = {
      img,
      elementId: part.source.id as RigHand["elementId"],
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
  },

  /** Atomically retarget the retained skeleton once all six loose textures exist. */
  installBoilerplateIfReady(this: SpriteRigContext): void {
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
  },

  clearGearAttachments(this: SpriteRigContext): void {
    for (const attachment of this.gearAttachments) attachment.image.destroy();
    this.gearAttachments.length = 0;
    this.hatAttachments.length = 0;
  },

  syncHatOverflowLabel(this: SpriteRigContext, assembly: GearLoadoutAssembly): void {
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
  },

  restoreBoilerplateTextures(this: SpriteRigContext): void {
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
  },

  /** Apply the shared source-card socket solution to this retained rig's procedural limb rest points. */
  applyResolvedRigSockets(this: SpriteRigContext, assembly: GearLoadoutAssembly): void {
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
  },

  commitGearBakeLease(this: SpriteRigContext, lease: GearTextureBakeLease): boolean {
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
  },

  /**
   * Diff a validated account loadout onto retained gear images. The optional composition is already bounded
   * account data; absent composition repeats the equipped signature hat through unlocked prestige slots.
   */
  equipSyncedGear(this: SpriteRigContext,
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
  },

  equipGearLoadout(this: SpriteRigContext,
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
  },

  /** Build only newly-ready descriptors; failed loose files leave that slot transparently absent. */
  syncGearArt(this: SpriteRigContext): void {
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
  },

  pushGearPlane(this: SpriteRigContext,
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
  },

  pushWeaponLayers(this: SpriteRigContext,
    stack: Phaser.GameObjects.GameObject[],
    weapon: (typeof this.weapons)[number] | undefined,
  ): void {
    if (!weapon) return;
    if (weapon.tellRim) stack.push(weapon.tellRim);
    stack.push(weapon.img);
    if (weapon === this.weapons[0] && this.breakActionAttachment) {
      stack.push(this.breakActionAttachment.barrel, ...this.breakActionAttachment.shells);
    }
    if (weapon.tellEcho) stack.push(weapon.tellEcho);
  },

  /** Weapon gloves claim the same retained hand receivers as baked gear gloves. The hand node keeps
   *  animating as the mount/transform authority, but its current boilerplate-or-gear texture is hidden while
   *  a worn weapon occupies that receiver. A glove-pair is the one explicit two-receiver weapon contract. */
  weaponReplacesHandReceiver(this: SpriteRigContext, receiver: "hand-l" | "hand-r"): boolean {
    if (this.weapons.some((weapon) => weapon.def.glovePair !== undefined)) return true;
    const handIndex = receiver === "hand-r" ? 0 : 1;
    return this.weapons[handIndex]?.worn === true;
  },

  weaponReplacesFootReceiver(this: SpriteRigContext, receiver: "foot-l" | "foot-r"): boolean {
    const front = receiver === "foot-r";
    return this.wrapFootWeapons.some((weapon) => weapon.foot.front === front);
  },

  syncWeaponHandReplacement(this: SpriteRigContext): void {
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
  },

  /** One retained back-to-front law shared by weapon and wardrobe descriptor edges. */
  rebuildRenderStack(this: SpriteRigContext): void {
    if (!this.root) return;
    const stack: Phaser.GameObjects.GameObject[] = [
      this.shadowHalo,
      this.shadow,
      this.auraGlow,
      this.auraRing,
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
    const hammerLayerHand = this.revolverHammerLayerHand;
    const hammerHand =
      hammerLayerHand === 0 ? frontHand : hammerLayerHand === 1 ? backHand : undefined;
    if (
      hammerHand &&
      hammerLayerHand !== undefined &&
      (this.weapons[hammerLayerHand] || (hammerLayerHand === 1 && this.poseTwoHanded))
    ) {
      // Like a mechanism-owned support hand, the accepted hammer hand must finish after every gun layer.
      // Re-pushing the retained node is deliberate: Twin-Maw's rear hand must also clear the lead gun.
      stack.push(hammerHand.img);
      const receiver = hammerLayerHand === 0 ? "hand-r" : "hand-l";
      for (const attachment of this.gearAttachments)
        if (attachment.spec.source.receiver === receiver) stack.push(attachment.image);
    }
    if (this.tome) {
      for (const page of this.tome.pages) stack.push(page.quad);
      for (const scrap of this.tome.scraps) stack.push(scrap.piece);
    }
    for (const overlay of this.strikeOverlays) stack.push(overlay.img);
    stack.push(this.observedSourceRing, this.observedSourceFlash, this.authoredDualGlint);
    if (this.label) stack.push(this.label);
    for (const object of stack) if (object.active) this.root.bringToTop(object);
  },

  /** Apply client-only painted geometry exactly once, after every semantic/presentation pose writer. */
  applyWeaponArtGeometry(this: SpriteRigContext): void {
    for (let i = 0; i < this.weapons.length; i++) {
      const weapon = this.weapons[i];
      if (!weapon) continue;
      const state =
        i === 0 && this.tome?.openVisible ? weapon.artGeometry?.open : weapon.artGeometry?.closed;
      const authoredPrimary = resolvedGunGripPoints(weapon.def)?.primary;
      const firingFrame = weapon.firingFrameVisible ? weapon.firingFrame : undefined;
      const flourish = this.flourishChannels[i as 0 | 1];
      const flourishPivot = flourish
        ? weaponFlourishPivotFor(weapon.def, flourish.moment, flourish.active)
        : undefined;
      weapon.img.setOrigin(
        flourishPivot?.x ??
          firingFrame?.originX ??
          authoredPrimary?.x ??
          state?.originX ??
          weapon.closedOriginX,
        flourishPivot?.y ??
          firingFrame?.originY ??
          authoredPrimary?.y ??
          state?.originY ??
          weapon.closedOriginY,
      );
      weapon.semanticRotation = weapon.img.rotation;
      weapon.img.scaleY *= edgeLeadScaleY(weapon.def.performance?.edgeLeadFlip);
      weapon.img.rotation += state?.artAngle ?? 0;
      weapon.img.scaleX *= weapon.imageFacingX;
    }
  },

  /** Copy the final hidden foot receiver transforms onto the visible B19 worn overlays. */
  syncWrapFootWeapons(this: SpriteRigContext): void {
    const sourceScale = this.scale || 1;
    for (const wrapped of this.wrapFootWeapons) {
      const foot = wrapped.foot.img;
      const fixedScale = wrapped.baseScale / (this.baseScale || 1);
      wrapped.img
        .setPosition(foot.x, foot.y)
        .setRotation(foot.rotation)
        .setScale(
          fixedScale *
            wrapped.imageFacingX *
            (foot.scaleX / sourceScale) *
            this.authoredDualFootWeaponScaleX[wrapped.foot.front ? 0 : 1],
          fixedScale * (foot.scaleY / sourceScale),
        )
        .setAlpha(foot.alpha)
        .setVisible(true);
    }
  },

  /** Equip (or swap) one weapon. Authored pre-made duals use both hands and both sprite parts. Each piece
   * points along semantic +X in its hand, pivoting at the grip, and is inserted just
   *  BELOW that hand in the container so the hand overlays the hilt. */
  equipWeapon(this: SpriteRigContext, spriteId: string, def: WeaponDef, manifest: SpriteManifest): void {
    const plan = authoredWeaponRenderPlan(spriteId, def, manifest);
    this.equipAuthoredWeapon(plan[0], plan[1]);
  },

  destroyWrapFootWeapons(this: SpriteRigContext): void {
    for (const weapon of this.wrapFootWeapons) weapon.img.destroy();
    this.wrapFootWeapons.length = 0;
  },

  destroyStrikeOverlays(this: SpriteRigContext): void {
    for (const overlay of this.strikeOverlays) overlay.img.destroy();
    this.strikeOverlays.length = 0;
  },

  setupStrikeOverlays(this: SpriteRigContext,
    spriteId: string,
    def: WeaponDef,
    manifest: SpriteManifest,
  ): void {
    if (!def.strikeOverlayPart) return;
    const part = manifest.parts[def.strikeOverlayPart - 1];
    if (!part) return;
    const texture = partTexture(this.scene, spriteId, part.role);
    for (let handIndex = 0; handIndex < this.weapons.length; handIndex++) {
      const hand = handIndex as 0 | 1;
      const weapon = this.weapons[hand];
      if (!weapon) continue;
      const img = this.scene.add
        .image(weapon.img.x, weapon.img.y, texture.key, texture.frame)
        .setOrigin(weapon.img.originX, weapon.img.originY)
        .setScale(weapon.img.scaleX, weapon.img.scaleY)
        .setVisible(false);
      this.root.add(img);
      this.strikeOverlays.push({ img, hand });
    }
  },

  syncStrikeOverlays(this: SpriteRigContext, sceneNow: number, outsidePaperView: boolean): void {
    const swing = this.swing;
    const elapsed = (sceneNow - this.swingStart) / 1000;
    for (const overlay of this.strikeOverlays) {
      const weapon = this.weapons[overlay.hand];
      const visible =
        !outsidePaperView &&
        !!swing &&
        !!weapon &&
        strikeOverlayImpactVisible(elapsed, swing.impactSeconds, this.swingHand, overlay.hand);
      if (!visible || !weapon) {
        overlay.img.setVisible(false);
        continue;
      }
      overlay.img
        .setOrigin(weapon.img.originX, weapon.img.originY)
        .setPosition(weapon.img.x, weapon.img.y)
        .setRotation(weapon.img.rotation)
        .setScale(weapon.img.scaleX, weapon.img.scaleY)
        .setAlpha(weapon.img.alpha)
        .setVisible(weapon.img.visible);
    }
  },

  /** Equip the complete render plan for one authored weapon. */
  equipAuthoredWeapon(this: SpriteRigContext, lead: RigLoadoutPiece, off?: RigLoadoutPiece): void {
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
    this.destroyStrikeOverlays();
    this.destroyBreakActionAttachment();
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
    this.authoredDualBarStep = -1;
    this.authoredDualBarExpiresAtMs = -1e9;
    this.gunRecoilAtMs = -1e9;
    this.revolverHammerLayerHand = undefined;
    this.gunRecoveryWallUntilMs = -1e9;
    this.rangedAimRaiseAtMs = -1e9;
    this.rangedAimActiveUntilMs = -1e9;
    if (off) {
      if (!previousPaired) {
        this.authoredDualBaseSeq = this.hasAttackBeatSeq ? this.attackBeatSeq : 0;
        this.authoredDualBaseSeqReady = true;
      }
    } else {
      this.authoredDualBaseSeq = 0;
      this.authoredDualBaseSeqReady = false;
      this.authoredDualCeremonyStartMs = -1e9;
      this.authoredDualGlint.setVisible(false);
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
      const wornWrap = piece.def.glovePair?.wrapsFeet === true && partIndex === 0;
      const authoredPrimary = resolvedGunGripPoints(piece.def)?.primary;
      const sourceFacingX = spriteImageFacingX(piece.manifest.imageFacing);
      const imageFacingX: -1 | 1 = piece.mirrorX
        ? sourceFacingX === 1
          ? -1
          : 1
        : sourceFacingX;
      const originX =
        authoredPrimary?.x ??
        closed?.originX ??
        (wornWrap ? 0.5 : pieceWorn ? 0.4 : piece.def.gripFrac);
      const originY = authoredPrimary?.y ?? closed?.originY ?? 0.5;
      const wScale = wornWrap
        ? wrapRigReceiverRelativeScale({
            sourceWidth: part.w,
            sourceHeight: part.h,
            receiverWidth: hand.img.width,
            receiverHeight: hand.img.height,
            receiverScaleX: hand.img.scaleX,
            receiverScaleY: hand.img.scaleY,
            rigScaleX: this.baseScale,
            rigScaleY: this.baseScale,
            padding: 1.16,
          })
        : (piece.def.displayLength * (closed?.displayLengthMul ?? 1)) / part.w;
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
    this.setupStrikeOverlays(spriteId, def, manifest);
    this.setupBreakActionAttachment(spriteId, def, manifest);
    const wrapMounts = wrapRigMountPlan(def, manifest);
    const footPart = manifest.parts[1];
    if (footPart) {
      const footTexture = partTexture(this.scene, spriteId, footPart.role);
      const imageFacingX = spriteImageFacingX(manifest.imageFacing);
      for (const mount of wrapMounts) {
        if (mount.partIndex !== 1) continue;
        const front = mount.receiver === "foot-r";
        const foot = this.feet.find((candidate) => candidate.front === front);
        if (!foot) continue;
        const footScale = wrapRigReceiverRelativeScale({
          sourceWidth: footPart.w,
          sourceHeight: footPart.h,
          receiverWidth: foot.img.width,
          receiverHeight: foot.img.height,
          receiverScaleX: foot.img.scaleX,
          receiverScaleY: foot.img.scaleY,
          rigScaleX: this.baseScale,
          rigScaleY: this.baseScale,
          padding: 1.12,
        });
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
    for (const overlay of this.strikeOverlays) stack.push(overlay.img);
    stack.push(this.observedSourceRing, this.observedSourceFlash, this.authoredDualGlint);
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
      this.authoredDualCeremonyStartMs = this.presentationClockNow();
      this.flash(90);
      const audio = this.scene.game.registry.get("audio") as
        | { play?: (event: string, opts?: { x?: number; amt?: number }) => void }
        | undefined;
      audio?.play?.("weapon:authored-dual", { x: this.root.x, amt: this.isSelf ? 1 : 0.65 });
    }
    if (flourishSwapPending) this.completePendingWeaponSwap();
    else
      this.idleFlourishEligibleAtMs = idleFlourishEligibleEpoch(
        this.idleFlourishClockDef(),
        this.idleFlourishTimerNow(this.presentationClockNow()),
        this.idleFlourishOffsetMs,
      );
  },

  sampleFloatingHeadAttackLead(this: SpriteRigContext,
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
  },

  // Extraction trace: private syncFloatingHeadPose(
  syncFloatingHeadPose(this: SpriteRigContext,
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
    // Idle is not a statue: the head's tiny two-axis equilibrium keeps moving through this same critically
    // damped follower. It is deliberately independent of gait phase and disappears under reduced motion.
    const idleMix =
      reducedMotion || rebase || !this.floatingHeadSpring.ready ? 0 : Math.max(0, 1 - this.gait);
    const idleTime = this.presentationClockNow() / 1000 + this.phase;
    const idleX =
      Math.sin(idleTime * Math.PI * 2 * 0.43 + this.phase * 1.7) *
      FLOATING_HEAD_SPRING_TUNING.idleDriftXPx *
      idleMix;
    const idleY =
      Math.sin(idleTime * Math.PI * 2 * 0.79 + this.phase * 2.3) *
      FLOATING_HEAD_SPRING_TUNING.idleDriftYPx *
      idleMix;
    const input = this.floatingHeadSpringInput;
    input.targetX = targetX;
    input.targetY = targetY;
    input.authoredOffsetX =
      idleX + this.floatingHeadAttackLead.x - directionX * stanceLag + this.flourishHeadX;
    input.authoredOffsetY =
      idleY +
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
  },

  /** Head/face receivers layer their own angular springs over the final sprung head transform. */
  placeHeadGear(this: SpriteRigContext, attachment: GearAttachment): void {
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
  },

  placeBodyGear(this: SpriteRigContext, attachment: GearAttachment): void {
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
  },

  placeNodeGear(this: SpriteRigContext, attachment: GearAttachment): void {
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
  },

  // Extraction trace: private topSocketPosition(
  topSocketPosition(this: SpriteRigContext, attachment: GearAttachment, out: { x: number; y: number }): void {
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
  },

  /** Final-pose wardrobe pass. Offscreen rigs retain their last transforms and rebase springs on wake. */
  syncGearPose(this: SpriteRigContext,
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
  },
} satisfies ThisType<SpriteRigContext>;
