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
import {
  chargeHoldsTomeOpen,
  tomeOpenArtFor,
  tomeOpenRotationForAim,
  writeTomeCenterWorldPoint,
} from "../../sprites/tome-open-art.js";
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

export type GunHandlingHand = "primary" | "secondary";

/**
 * Resolve which painted hand owns a mechanism without weapon-id routing. Dual implements cycle the
 * fired trigger hand. A two-hand lever whose secondary role is the barrel/foregrip leaves that support
 * hand planted and cycles the trigger hand; ordinary pump/lever/bolt definitions retain support-hand
 * ownership.
 */
export function gunHandlingHandFor(def: WeaponDef | undefined): GunHandlingHand | undefined {
  const mechanism = gunHandlingMechanismFor(def);
  if (!mechanism || mechanism === "break") return undefined;
  if (def?.dual) return "primary";
  if (mechanism === "lever" && def?.gripPoints?.secondary?.role !== "lever") return "primary";
  return "secondary";
}

/** B29 fan beats ordinarily animate the gun hand; an authored hammer grip delegates the fan to the
 * planted two-hand support hand instead. */
export function revolverHammerHandFor(def: WeaponDef | undefined): GunHandlingHand | undefined {
  if (!def?.gun || !weaponHasHandlingTag(def, "revolver")) return undefined;
  return def.gripPoints?.secondary?.role === "hammer" ? "secondary" : "primary";
}

/** Preserve the legacy neutral hand angle unless the painted secondary mechanism authors one. */
export function secondaryGripHandRotationFor(
  def: WeaponDef | undefined,
  weaponAngleRad: number,
): number {
  const authored = def?.gripPoints?.secondary?.angleRad;
  return authored === undefined ? 0 : weaponAngleRad + authored;
}

export const rigGunMechanismMethods = {

  /** Re-sort only on hammer ownership edges: start, alternating paired hand, and return to rest. */
  syncRevolverHammerLayer(this: SpriteRigContext): void {
    const hammerDef = this.weapons?.[this.gunRecoilHand]?.def;
    const next =
      this.revolverHammerBeat.active && revolverHammerHandFor(hammerDef) === "secondary"
        ? 1
        : this.revolverHammerBeat.active
          ? this.gunRecoilHand
          : undefined;
    if (next === this.revolverHammerLayerHand) return;
    this.revolverHammerLayerHand = next;
    this.rebuildRenderStack();
  },

  /** Current final affine of a held blade. The legacy name is retained, but the explicit hand parameter
   * carries remote/off-hand routing through the same accessor instead of opening a parallel pose seam. */
  leadWeaponTipPose(this: SpriteRigContext, hand: 0 | 1 = 0): WeaponBladeAttachmentPose | undefined {
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
  },

  /** World-space grip anchor after jiggle, lift, and the container's facing transform. */
  handWorldAnchor(this: SpriteRigContext, hand: 0 | 1): { x: number; y: number } {
    const held = this.weapons[hand];
    const rigHand = held?.hand ?? this.hands.find((entry) => entry.front === (hand === 0));
    if (!rigHand) return { x: this.root.x, y: this.root.y };
    const point = this.root.getWorldTransformMatrix().transformPoint(rigHand.img.x, rigHand.img.y);
    return { x: point.x, y: point.y };
  },

  /** Final rendered release hand for the accepted attack beat. Thrown delivery uses this presentation
   * origin while its immutable server projectile continues to launch from authoritative player state. */
  throwWorldAnchor(this: SpriteRigContext): { x: number; y: number } {
    return this.handWorldAnchor(this.swingHand === 1 ? 1 : 0);
  },

  /** Transform one authored PNG muzzle point through the final live sprite affine. */
  writeWeaponArtMuzzle(this: SpriteRigContext,
    point: WeaponArtMuzzlePoint,
    out: { x: number; y: number },
    preferredHand?: 0 | 1,
  ): boolean {
    const breakActionBarrel =
      point.part === 1 && isBreakActionWeapon(this.weaponDef)
        ? this.breakActionAttachment?.barrel
        : undefined;
    if (point.part === 1 && isBreakActionWeapon(this.weaponDef)) {
      if (
        !this.breakActionSample.muzzleAllowed ||
        !breakActionBarrel?.active ||
        !breakActionBarrel.visible
      )
        return false;
    }
    const preferred = preferredHand === undefined ? undefined : this.weapons[preferredHand];
    const weapon = breakActionBarrel
      ? this.weapons[0]
      : preferred?.partIndex === point.part
        ? preferred
        : this.weapons.find((candidate) => candidate.partIndex === point.part);
    if (!weapon?.img.active || !weapon.img.visible) return false;
    const image = breakActionBarrel ?? weapon.img;
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
  },

  /**
   * Copy a specific physical barrel through position, rotation, scale, mirror, art correction, and recoil.
   * Beam rows use the stable authored point index.
   */
  writeWeaponMuzzle(this: SpriteRigContext, hand: 0 | 1, out: { x: number; y: number }, pointIndex = 0): boolean {
    const definition = this.weapons[hand]?.def.muzzle ?? this.weaponDef?.muzzle;
    const point = definition?.points[pointIndex] ?? definition?.points[0];
    return point ? this.writeWeaponArtMuzzle(point, out, hand) : false;
  },

  /** Gun flashes/projectile admission use the exact same accepted-beat salvo selection as authority. */
  writeWeaponMuzzleForShot(this: SpriteRigContext,
    acceptedSeq: number,
    barrelIndex: number,
    out: { x: number; y: number },
    salvoIndex?: number,
  ): boolean {
    const definition = this.weaponDef?.muzzle;
    if (!definition) return false;
    const points = weaponArtMuzzlePointsForShot(definition, acceptedSeq, salvoIndex);
    const point = points[barrelIndex] ?? points[0];
    const hand = isBreakActionWeapon(this.weaponDef) ? 0 : point?.part === 1 ? 1 : 0;
    return point ? this.writeWeaponArtMuzzle(point, out, hand) : false;
  },

  /** Transform the visible open-book gutter through the final held-sprite affine. */
  writeTomeCenter(this: SpriteRigContext, out: { x: number; y: number }): boolean {
    const tome = this.tome;
    const image = this.weapons[0]?.img;
    if (!tome?.openVisible || tome.proceduralSplay || !image?.active || !image.visible) return false;
    return writeTomeCenterWorldPoint(image.getWorldTransformMatrix(), image, out);
  },

  /** B19 swing punctuation reads the final independent hand/foot worn-sprite affine. */
  writeKungFuWrapMuzzle(this: SpriteRigContext,
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
  },

  /** Retained per-barrel kick. Camera shake and muzzle styling stay at Arena's hand-aware cue site. */
  triggerGunRecoil(this: SpriteRigContext, timeMs: number, hand: 0 | 1): void {
    if (!this.weapons[hand]?.def.gun) return;
    this.gunRecoilAtMs = this.presentationEpochForWallEpoch(timeMs);
    this.gunRecoveryWallUntilMs = Math.max(
      this.gunRecoveryWallUntilMs,
      timeMs + RANGED_GUN_RECOVERY_MS,
    );
    this.gunRecoilHand = hand;
  },

  holdRangedAim(this: SpriteRigContext, epochMs: number, durationMs: number): void {
    if (!this.weapons.some((weapon) => usesAimedFiringStance(weapon.def))) return;
    if (epochMs > this.rangedAimActiveUntilMs + RANGED_AIM_SETTLE_MS) {
      this.rangedAimRaiseAtMs = epochMs;
    }
    this.rangedAimActiveUntilMs = Math.max(this.rangedAimActiveUntilMs, epochMs + durationMs);
  },

  offWeaponLean(this: SpriteRigContext): number {
    const lead = this.weapons[0]?.def;
    const off = this.weapons[1]?.def;
    if (!lead || !off || lead.displayLength <= 0) return DUAL_BACK_WEAPON_LEAN;
    const lengthRatio = Math.max(0.7, Math.min(1.3, off.displayLength / lead.displayLength));
    return DUAL_BACK_WEAPON_LEAN * lengthRatio;
  },

  destroyTomeVisual(this: SpriteRigContext): void {
    const tome = this.tome;
    if (!tome) return;
    for (const page of tome.pages) page.quad.destroy();
    for (const scrap of tome.scraps) scrap.piece.destroy();
    for (const leaf of tome.proceduralLeaves ?? []) leaf.destroy();
    this.tome = undefined;
  },

  setupTomeVisual(this: SpriteRigContext,
    spriteId: string,
    def: WeaponDef,
    closedTexture: { key: string; frame?: string },
  ): void {
    const art = tomeOpenArtFor(spriteId);
    const heldWeapon = this.weapons[0];
    if (!art || !heldWeapon) return;
    const makeProceduralLeaf = (): Phaser.GameObjects.Image => {
      const leaf = this.scene.add
        .image(0, 0, closedTexture.key, closedTexture.frame)
        .setOrigin(heldWeapon.img.originX, heldWeapon.img.originY)
        .setVisible(false);
      this.root.add(leaf);
      this.root.moveTo(leaf, this.root.getIndex(heldWeapon.img) + 1);
      return leaf;
    };
    const proceduralLeaves = art.proceduralSplay
      ? ([makeProceduralLeaf(), makeProceduralLeaf()] as const)
      : undefined;
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
      proceduralSplay: art.proceduralSplay === true,
      suppressPageTurnEffects: art.suppressPageTurnEffects === true,
      proceduralLeaves,
      pages: [makePage(0xf1d09a), makePage(0xe5bd80)],
      scraps: [makeScrap(0xe9c88f), makeScrap(0xdab276)],
      openBaseScale: art.proceduralSplay ? heldWeapon.baseScale : 0,
      openTextureReady: art.proceduralSplay === true,
      openVisible: false,
      chargeOpenActive: false,
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
  },

  /** Feed either a predicted owner beat or an authoritative player beat into retained presentation state.
   *  Uint32 ordering ignores an older confirmation when local prediction already advanced ordinary poses;
   *  firing-frame state is recorded separately and only from an authoritative accepted epoch. */
  setAttackBeat(this: SpriteRigContext, seq: number, held: boolean, epochMs: number, authoritative = true): void {
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
        this.authoritativeFiringWeaponId = this.weaponDef?.id ?? "";
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
      // A rig may attach after the neutral seq=0 snapshot. If its first observed row is already held,
      // that row is the first accepted shot, not a baseline to discard: every revolver shot needs a beat.
      advanced = held;
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
        this.weapons.length > 1 && this.authoredDualBaseSeqReady
          ? authoredDualHandForSeq(beat, this.authoredDualBaseSeq)
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
    if (tome.suppressPageTurnEffects) {
      tome.pendingPage = false;
      tome.settleForUntilMs = tome.openUntilMs;
      return;
    }
    // Rapid-fire books coalesce queued edges onto a ~3Hz physical page cadence; every latest attack beat
    // still refreshes the open latch and replaces the pending page rather than allocating overlapping VFX.
    tome.pendingPage = true;
    tome.pendingPageAtMs = Math.max(epochMs, tome.lastFlipAtMs + TOME_PAGE_INTERVAL_MS);
    tome.pendingPageSeq = beat;
    tome.settleForUntilMs = -1e9;
  },

  hideTomeShapes(this: SpriteRigContext, tome: TomeVisualState): void {
    for (const page of tome.pages) page.quad.setVisible(false);
    for (const scrap of tome.scraps) scrap.piece.setVisible(false);
  },

  setTomeClosed(this: SpriteRigContext, tome: TomeVisualState): void {
    const weapon = this.weapons[0];
    if (weapon && tome.openVisible) {
      weapon.img.setTexture(tome.closedTextureKey, tome.closedFrame).setVisible(true);
    }
    for (const leaf of tome.proceduralLeaves ?? []) leaf.setVisible(false);
    tome.openVisible = false;
    this.hideTomeShapes(tome);
  },

  startTomePage(this: SpriteRigContext,
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
  },

  /** Swap retained held textures from the synced server tick window; no local wall-time timer owns it. */
  prepareFiringFrames(this: SpriteRigContext): void {
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
        firingFrameSpriteAt(
          weapon.def,
          acceptedTick,
          this.authoritativeFiringClockTick,
          this.authoritativeFiringInputHeld,
        ) ===
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
  },

  refreshBreakActionClock(this: SpriteRigContext): void {
    const priorPhase = this.breakActionAudioPhase;
    const priorActive = this.breakActionAudioActive;
    this.breakActionSample = sampleBreakActionClock(
      this.weaponDef,
      this.authoritativeFiringAttackTick,
      this.authoritativeFiringClockTick,
      this.authoritativeGunCharges,
      this.authoritativeGunMaxCharges,
    );
    const sample = this.breakActionSample;
    let cue: "gun:break-close" | "gun:break-open" | undefined;
    if (
      sample.active &&
      (sample.phase === "opening" || sample.phase === "eject") &&
      (!priorActive || priorPhase === "closed")
    ) {
      cue = "gun:break-open";
    } else if (sample.active && sample.phase === "closing" && priorPhase !== "closing") {
      cue = "gun:break-close";
    }
    if (cue) {
      const audio = this.scene.game?.registry?.get("audio") as
        | { play?: (event: string, opts?: { x?: number; amt?: number }) => void }
        | undefined;
      audio?.play?.(cue, { x: this.root.x, amt: this.isSelf ? 1 : 0.55 });
    }
    this.breakActionAudioPhase = sample.phase;
    this.breakActionAudioActive = sample.active;
  },

  /** Read-only live-gate surface for the authoritative break pose and registered barrel layer. */
  breakActionEvidence(this: SpriteRigContext): Readonly<{
    active: boolean;
    angleRad: number;
    barrelRotationRad: number;
    ejectStrength: number;
    muzzleAllowed: boolean;
    phase: BreakActionPhase;
    shellCount: number;
  }> {
    const attachment = this.breakActionAttachment;
    return {
      active: this.breakActionSample.active,
      angleRad: this.breakActionSample.angleRad,
      barrelRotationRad: attachment?.barrel.rotation ?? 0,
      ejectStrength: this.breakActionSample.ejectStrength,
      muzzleAllowed: this.breakActionSample.muzzleAllowed,
      phase: this.breakActionSample.phase,
      shellCount: attachment?.shells.filter((shell) => shell.visible).length ?? 0,
    };
  },

  /** Sample the replicated server attack/resource clock; local prediction never writes this tuple. */
  setAuthoritativeAttackClock(this: SpriteRigContext,
    attackTick: number,
    clockTick: number,
    charges = 0,
    maxCharges = 0,
    fireInputHeld?: boolean,
    chargedProjectileActive = false,
  ): void {
    this.authoritativeFiringAttackTick = attackTick >>> 0;
    this.authoritativeFiringClockTick = clockTick >>> 0;
    this.authoritativeGunCharges = Math.max(0, charges);
    this.authoritativeGunMaxCharges = Math.max(0, maxCharges);
    this.authoritativeFiringInputHeld = fireInputHeld;
    if (this.tome) {
      this.tome.chargeOpenActive = chargeHoldsTomeOpen(
        chargedProjectileActive,
        this.weaponDef?.chargedProjectile !== undefined,
      );
    }
    this.refreshBreakActionClock();
    // Clock ingestion continues through hit-stop. This also guarantees the closed-frame return is
    // applied at the authoritative boundary rather than waiting for animation to resume.
    this.prepareFiringFrames();
  },

  /** Choose the painted held texture and advance scalar page scheduling before weapon pose writes. */
  prepareTomeVisual(this: SpriteRigContext, sceneNow: number, outsidePaperView: boolean): void {
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

    const timedOpen = sceneNow >= tome.openAtMs && sceneNow < tome.openUntilMs;
    const wantsOpen =
      tome.openTextureReady && (tome.chargeOpenActive || (!weapon.def.muzzle && timedOpen));
    if (!wantsOpen) {
      this.setTomeClosed(tome);
      if (sceneNow >= tome.openUntilMs) tome.pendingPage = false;
      return;
    }
    if (!tome.openVisible) {
      if (tome.proceduralSplay) {
        weapon.img.setVisible(false);
        for (const leaf of tome.proceduralLeaves ?? []) leaf.setVisible(true);
      } else {
        weapon.img.setTexture(tome.openTextureKey);
      }
      tome.openVisible = true;
    }

    if (tome.chargeOpenActive || tome.suppressPageTurnEffects) {
      this.hideTomeShapes(tome);
      return;
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
  },

  /** Copy the final weapon pose into the retained paper quads/scraps after hop, spawn, and attack offsets. */
  syncTomeVisual(this: SpriteRigContext, sceneNow: number, outsidePaperView: boolean): void {
    const tome = this.tome;
    const weapon = this.weapons[0];
    if (!tome || !weapon || !tome.openVisible || outsidePaperView) {
      if (tome) this.hideTomeShapes(tome);
      return;
    }
    if (tome.suppressPageTurnEffects) {
      this.hideTomeShapes(tome);
      return;
    }
    const img = weapon.img;
    const rotation = img.rotation;
    const axisSign = img.scaleX < 0 ? -1 : 1;
    if (tome.proceduralLeaves) {
      const width = img.displayWidth;
      const alongX = Math.cos(rotation) * width * 0.14 * axisSign;
      const alongY = Math.sin(rotation) * width * 0.14 * axisSign;
      const [upper, lower] = tome.proceduralLeaves;
      upper
        .setPosition(img.x - alongX, img.y - alongY)
        .setRotation(rotation - 0.3 * axisSign)
        .setScale(img.scaleX * 0.58, img.scaleY * 0.92)
        .setAlpha(img.alpha)
        .setVisible(true);
      lower
        .setPosition(img.x + alongX, img.y + alongY)
        .setRotation(rotation + 0.3 * axisSign)
        .setScale(img.scaleX * 0.58, img.scaleY * 0.92)
        .setAlpha(img.alpha)
        .setVisible(true);
    }
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
  },

  /** Copy the receiver's final affine onto the registered barrel layer, then pivot only part 2. */
  applyBreakActionGeometry(this: SpriteRigContext): void {
    const attachment = this.breakActionAttachment;
    const receiver = this.weapons[0];
    if (!attachment || !receiver || !isBreakActionWeapon(receiver.def)) return;
    const image = receiver.img;
    const hinge = receiver.def.breakAction.hinge;
    const sourceHingeX = (hinge.x - image.originX) * image.width * image.scaleX;
    const sourceHingeY = (hinge.y - image.originY) * image.height * image.scaleY;
    const receiverC = Math.cos(image.rotation);
    const receiverS = Math.sin(image.rotation);
    const hingeX = image.x + receiverC * sourceHingeX - receiverS * sourceHingeY;
    const hingeY = image.y + receiverS * sourceHingeX + receiverC * sourceHingeY;
    const barrelRotation = image.rotation + this.breakActionSample.angleRad;
    attachment.barrel
      .setOrigin(hinge.x, hinge.y)
      .setPosition(hingeX, hingeY)
      .setRotation(barrelRotation)
      .setScale(image.scaleX, image.scaleY)
      .setAlpha(image.alpha)
      .setVisible(image.visible);

    const eject = this.breakActionSample.ejectStrength;
    for (const [index, shell] of attachment.shells.entries()) {
      if (eject <= 0.015 || !image.visible) {
        shell.setVisible(false);
        continue;
      }
      const localX = -4 - eject * 22;
      const localY = (index === 0 ? -2.4 : 2.4) - eject * 11;
      shell
        .setPosition(
          hingeX + receiverC * localX - receiverS * localY,
          hingeY + receiverS * localX + receiverC * localY,
        )
        .setRotation(image.rotation + (index === 0 ? -0.5 : 0.35) * eject)
        .setAlpha(Math.min(1, eject * 1.8))
        .setVisible(true);
    }
  },

  destroyBreakActionAttachment(this: SpriteRigContext): void {
    const attachment = this.breakActionAttachment;
    if (!attachment) return;
    attachment.barrel.destroy();
    for (const shell of attachment.shells) shell.destroy();
    this.breakActionAttachment = undefined;
    this.breakActionSample = sampleBreakActionClock(undefined, 0, 0, 0, 0);
    this.breakActionAudioPhase = "closed";
    this.breakActionAudioActive = false;
  },

  setupBreakActionAttachment(this: SpriteRigContext,
    spriteId: string,
    def: WeaponDef,
    manifest: SpriteManifest,
  ): void {
    if (!isBreakActionWeapon(def)) return;
    const part = manifest.parts[1];
    if (!part) return;
    const texture = partTexture(this.scene, spriteId, part.role);
    const barrel = this.scene.add
      .image(0, 0, texture.key, texture.frame)
      .setOrigin(def.breakAction.hinge.x, def.breakAction.hinge.y)
      .setVisible(false);
    const shellA = this.scene.add
      .rectangle(0, 0, 5.2, 2.1, 0xd2a14a)
      .setStrokeStyle(0.7, 0x704b24, 1)
      .setVisible(false);
    const shellB = this.scene.add
      .rectangle(0, 0, 5.2, 2.1, 0xd2a14a)
      .setStrokeStyle(0.7, 0x704b24, 1)
      .setVisible(false);
    this.root.add([barrel, shellA, shellB]);
    this.breakActionAttachment = { barrel, shells: [shellA, shellB] };
    this.refreshBreakActionClock();
  },
} satisfies ThisType<SpriteRigContext>;
