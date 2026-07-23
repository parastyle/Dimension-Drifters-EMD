import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type ArenaMap,
  type ArenaState,
  type Attr,
  AUGMENTS,
  affixById,
  BAG_CAP,
  BEAM_MIN_CHARGE_SECONDS,
  BELT_Y0,
  BeamPhase,
  type BeltLevel,
  BOSS_DEF_IDS,
  BOSSES,
  beltBounds,
  beltLevelFor,
  bossSpawnAt,
  CAM_FOLLOW_TAU,
  CAM_SNAP_DIST,
  type CarrySelectionV1,
  CHAIN_MAX_RANGE,
  type ChainCandidate,
  COMBO_FLAG_AIRBORNE,
  COMBO_FLAG_EMPOWERED,
  COMBO_FLAG_JUGGLE,
  COMBO_LEAP_AIR_TICKS,
  COMBO_LEAP_OFFER_TICKS,
  COMBO_LEAP_RANGE,
  CombatDelivery,
  characterScale,
  clampQuakeEpicenter,
  DEBUG_SPAWN_MAX,
  DEFAULT_DIMENSION,
  DEFAULT_PORT,
  DEFAULT_WEAPON,
  DEFLECT_TTL,
  DEPTH_MAX,
  damageMultFromGrades,
  depthHpScale,
  EMBERGUARD_HALF_ARC,
  EMBERGUARD_RANGE,
  EMPTY_META,
  ENEMY_KINDS,
  ENEMY_RADIUS,
  type EnemyKind,
  EXTRACT_RADIUS,
  effectiveMelee,
  enemyHpScale,
  FISTS_WEAPON,
  GEAR_CATALOG,
  type GearId,
  GROUND_EPSILON,
  generateArena,
  getDimension,
  gunLocomotionRecoilFor,
  hasAugment,
  INTERP_DELAY_MS,
  INTERP_SNAP_ENEMY,
  INTERP_SNAP_PLAYER,
  inMeleeArc,
  isPetId,
  isPitAtPx,
  isThrownProjectileKind,
  LEVELUP_WINDOW_SECONDS,
  landingThumpTier,
  lootCooldownMult,
  lootDamageMult,
  META_UPGRADES,
  type MetaAccountV4,
  type MetaLevels,
  type MoveStance,
  meleeReach,
  nextUpgradeCost,
  PARRY_CHAIN_CD,
  PARRY_CHAIN_RIPOSTE_AT,
  PARRY_CHAIN_WINDOW,
  PARRY_COOLDOWN,
  PARRY_IFRAMES,
  type PetProgressReceipt,
  type PetStageBand,
  PICKUP_RADIUS,
  type PlayerState,
  POUND_RADIUS,
  pairEligible,
  pairRequirementPenalty,
  petLevelForXp,
  petModsForLevel,
  QUAKE_REACH,
  RARITIES,
  RARITY_CURSED,
  RING_BAND_HALF,
  ROLL_COOLDOWN,
  ROLL_SPEED_CURVE,
  ROLL_TICK_SECONDS,
  ROOM_NAME,
  requirementPenalty,
  SALVAGE_HOLD_SECONDS,
  SCHEMA_VERSION,
  SHOP_RADIUS,
  SLIDE_PHASE_GROUND,
  SLIDE_PHASE_OFF,
  type SlidePhase,
  STANCE_DASH,
  STANCE_NONE,
  STANCE_POUND,
  STANCE_SLIDE,
  type SwingDescriptor,
  salvageValue,
  sanitizeMetaLevels,
  scripValue,
  selectChainTargets,
  stepBeamAngle,
  swingDescriptorFor,
  TgShape,
  TICK_MS,
  TOUGH_SCALE,
  thrownProjectileRotationPolicy,
  ULT_RECOVERY_TICKS,
  UltimateFamily,
  UltimatePhase,
  type UltimatePhaseValue,
  ultimateFamilyForCode,
  VASTAGHAR_ENCOUNTER,
  type VastagharActionDef,
  VastagharActionKind,
  VastagharMode,
  VastagharPhase,
  VFX_RADIUS_DEFAULT,
  WEAPON_IDS,
  WEAPONS,
  type WeaponDef,
  weaponArtMuzzlePointsForShot,
  weaponDisplaySpriteId,
  weaponEffectCueSeconds,
  weaponEffectEmitterPoint,
  weaponMuzzleWorldPoint,
  weaponMuzzleWorldPointsForShot,
  weaponSetBonus,
  ZoneKind,
} from "@dd/shared";
import { Client, type Room } from "colyseus.js";
import Phaser from "phaser";
import { AudioBus } from "../audio/AudioBus.js";
import { budgetedCameraShakeIntensity, type CameraShakeSource } from "../camera-shake.js";
import {
  CombatFeedback,
  type CombatReceiptRows,
  type DamageNumberEvent,
  type HitContactEvent,
} from "../combat-feedback.js";
import { PetRig, playPetEvolutionCeremony } from "../entities/PetRig.js";
import {
  GEAR_PARTS_MANIFEST,
  type PaperDeathTreatment,
  partTexture,
  type RawFlourishIntent,
  type RigAnim,
  rawFlourishIntentCancels,
  SPRITE_ATLAS,
  SpriteRig,
  type WeaponBladeAttachmentPose,
} from "../entities/SpriteRig.js";
import { WormRig } from "../entities/WormRig.js";
import {
  type OwnerNoteType,
  routeArmoryUiInput,
  routeOwnerNoteInput,
  routeWeaponInput,
  type WeaponInputMode,
} from "../input-routing.js";
import {
  type PredCmd,
  SelfPredictor,
  type ServerView,
  SpaceGestureClassifier,
  slideHeldFromBindings,
  slidePressedFromBindings,
} from "../net/prediction.js";
import { SnapshotBuffer, TimelineSync } from "../net/snapshots.js";
import { RENDER_DPR } from "../render-dpr.js";
import {
  type FeedbackSettings,
  loadSettings,
  onSettingsChange,
  updateSettings,
} from "../settings.js";
import { CARD_ART_IDS } from "../sprites/card-manifest.js";
import { gearClickVisibilityNotice } from "../sprites/gear-parts.js";
import { SPRITES } from "../sprites/manifest.js";
import { loadPetPartsManifest, type PetPartsManifest } from "../sprites/pet-parts.js";
import {
  nextPoseShowroomOption,
  poseShowroomVariantSetFor,
  weaponPoseFamilyFor,
} from "../sprites/pose-language.js";
import { tomeOpenArtFor } from "../sprites/tome-open-art.js";
import {
  ensureWholeArtCharacterTextures,
  isWholeArtCharacterId,
} from "../sprites/whole-art-character.js";
import { backpackTileIntent } from "../ui/armory/backpack-actions.js";
import {
  ARMORY_COLORS,
  ARMORY_CSS_COLORS,
  armoryTextStyle,
  drawArmoryPanel,
  rarityMark,
} from "../ui/armory-ui/tokens.js";
import { DamageNumberRenderer } from "../ui/damage-numbers.js";
import { driveCostView, driveHudView } from "../ui/drive-hud.js";
import { spawnLevelConfirmEffect } from "../ui/level-up-effects.js";
import { type LevelUpMode, levelUpLayout, levelUpLayoutKey } from "../ui/level-up-layout.js";
import {
  attributeChoiceViews,
  augmentChoiceViews,
  type LevelChoiceView,
  levelBuildContext,
} from "../ui/level-up-model.js";
import {
  type ObjectiveHudRect,
  objectiveHudCopy,
  objectiveHudLayout,
} from "../ui/objective-hud-layout.js";
import { OwnerNoteOverlay } from "../ui/owner-note-overlay.js";
import { type PairPreviewItem, pairPreview } from "../ui/pair-preview.js";
import {
  formatPetProgressReceipt,
  loadPetMetaAccount,
  petEvolutionLabel,
  savePetMetaAccount,
} from "../ui/pet-select.js";
import { type RemoteGearLoadout, syncRemoteGearLoadouts } from "../ui/remote-gear.js";
import {
  type SettlementPresentation,
  settlementPresentation,
  type WeaponSettlementReceiptView,
} from "../ui/settlement.js";
import { ultimateHudLayout } from "../ui/ultimate-hud-layout.js";
import {
  canReleaseUltimateReveal,
  playUltimateReveal,
  playUltimateStamp,
  type UltimateRevealDescriptor,
  ultimateInputAffordance,
  ultimateRevealDescriptor,
  ultimateSeqEdge,
} from "../ui/ultimate-reveal.js";
import { type ContextHintId, VerbLegendManager } from "../ui/verb-legend.js";
import {
  backpackModalLayout,
  type LoadoutEntryView,
  loadoutEntryView,
  type WeaponDockLayout,
  weaponDockLayout,
  wrappedDockOffset,
} from "../ui/weapon-dock-layout.js";
import {
  type BeamMuzzlePose,
  BeamRenderer,
  type BeamRenderRows,
  type BeamRenderState,
  type PredictedBeamCharge,
} from "../vfx/BeamRenderer.js";
import {
  makeCasterProjectile,
  preloadCasterPaintedArt,
  spawnCasterCast,
  spawnCasterImpact,
} from "../vfx/caster-vfx.js";
import { type CasterVfxRecipe, resolveCasterVfxRecipe } from "../vfx/caster-vfx-recipes.js";
import {
  colorblindShapesEnabled,
  MELEE_FINAL_GLINT_LEAD_MS,
  MELEE_FIRST_GLINT_LEAD_MS,
  meleeTellUsesDoublePulse,
  parryDoublePulseStrength,
} from "../vfx/colorblind-assist.js";
import { playFxPack } from "../vfx/fx-composer.js";
import { preloadGeneratedGunProjectiles } from "../vfx/gun-projectile-art.js";
import { HitEffectRenderer, IMPACT_RING_DEPTH, SPEED_LINE_DEPTH } from "../vfx/hit-effects.js";
import {
  enemyComboLeapHeight,
  enemyComboLeapVelocity,
  enemyComboOfferPhase,
  JumpEffectRenderer,
} from "../vfx/jump-effects.js";
import { pageProjectileArtFor, preloadPageProjectileArt } from "../vfx/page-projectile-art.js";
import {
  elementPack,
  paintedParticlePixels,
  particleBurst,
  preloadParticlePacks,
} from "../vfx/particles.js";
import { preloadProjectileExplosionArt } from "../vfx/projectile-explosion-vfx-recipes.js";
import { UltimateVfx } from "../vfx/ultimate-vfx.js";
import { VfxPlayer } from "../vfx/VfxPlayer.js";
import {
  type VastagharPresentationFrame,
  VastagharShakeBudget,
  VastagharVfx,
} from "../vfx/vastaghar-vfx.js";
import {
  resolveWeaponEffectRecipe,
  shouldSpawnLegacyQuakeVfx,
  type WeaponEffectRecipe,
  weaponEffectCuePoint,
} from "../vfx/weapon-effect-recipes.js";
import {
  spawnScatteredPages,
  spawnTeslaWarpArrival,
  spawnTeslaWarpDeparture,
  spawnWeaponProjectileImpact,
  spawnWeaponRadialIdentity,
  spawnWeaponSwingIdentity,
} from "../vfx/weapon-effect-vfx.js";
import { type XpMotePoint, type XpMoteReceipt, XpMoteRenderer } from "../vfx/xp-motes.js";
import { localAttackCooldownSeconds } from "./arena/attack-cadence.js";
import {
  bakeCardArt,
  bakeSplitDockArt,
  buildCard,
  buildDockChip,
  buildDockJunction,
  type Card,
  type DockChip,
  type DockJunction,
  drawIcon,
  drawTierPips,
  layoutDockChip,
  layoutDockJunction,
  rebindDockChip,
  setDockJunctionLoadout,
  WEAPON_ACCENT,
} from "./arena/card-art.js";
import { boltPoints, strokeBolt } from "./arena/draw-util.js";
import {
  buildArenaFloor,
  buildPois,
  dimensionPropPack,
  drawArena,
  GATE_GROUND_DEPTH,
  GATE_PROTECTED_DEPTH,
  gateNeedsEdgeLocator,
  type PoiSprite,
  terrainRimKey,
  terrainTileKey,
} from "./arena/floor-renderer.js";
import { makeGroundZonePatch, syncGroundZonePatch } from "./arena/ground-zone-renderer.js";
import {
  baseKind,
  GUN_FX,
  gunFx,
  makeBullet,
  makeCounter,
  makeGunIdentityProjectile,
  makeMagma,
  makeSpit,
  makeThrownWeapon,
} from "./arena/projectile-factory.js";
import { sampleProjectileWaveformFromAuthoritative } from "./arena/projectile-waveform.js";
import {
  preloadImpactFlipbooks,
  spawnBulletImpact,
  spawnExplosion,
  spawnFallStreak,
  spawnImpactFlipbook,
  spawnMuzzleFlash,
  spawnPoof,
  spawnQuake,
  spawnSonicBoomRing,
  spawnSplat,
  spawnWeaponKillFx,
  TelegraphForeshadowPool,
} from "./arena/vfx.js";

const VASTAGHAR_ACTIONS: Readonly<Partial<Record<number, VastagharActionDef>>> =
  VASTAGHAR_ENCOUNTER.actions;

/** Which sprite manifest the player renders as (§23: melee class, one character for M0). */
const PLAYER_SPRITE = "drifter";

// §6 horde-hit object budget: ordinary combat stays bit-for-bit on the full path; a single-frame AoE storm
// gets ten authored contact stacks and at most 24 pooled labels, while every remaining target still flashes.
const HIT_VFX_BUDGET = 10;
const PAPER_DEATH_FULL_BUDGET = 12;
const PAPER_DEATH_ORDINARY_BUDGET = 10; // reserve two slots for tough/boss deaths
const PAPER_PICKUP_EXIT_BUDGET = 8;
const PAPER_SNAPSHOT_MAX_W = 1600;
const PAPER_SNAPSHOT_MAX_H = 900;

export interface SummonMenuLayout {
  panel: { x: number; y: number; width: number; height: number };
  columns: number;
  gap: number;
  buttonWidth: number;
  buttonHeight: number;
  rowGap: number;
  titleY: number;
  hintY: number;
  controlsY: number;
  enemyLabelY: number;
  enemyStartY: number;
  bossLabelY: number;
  bossStartY: number;
  bossPageSize: number;
  pagerY: number;
  footerY: number;
}

/** §21 pure CSS-pixel geometry for the Testing-Grounds summon sheet. At 1280×720 the fixed header,
 *  two enemy rows, two paged boss rows, pager, and footer all stay inside a 650px safe panel. */
export function summonMenuLayout(screenWidth: number, screenHeight: number): SummonMenuLayout {
  const width = Math.max(1, screenWidth);
  const height = Math.max(1, screenHeight);
  const panelWidth = Math.min(960, Math.max(640, width - 48));
  const panelHeight = Math.min(650, Math.max(620, height - 40));
  const panel = {
    x: (width - panelWidth) / 2,
    y: (height - panelHeight) / 2,
    width: panelWidth,
    height: panelHeight,
  };
  const columns = 4;
  const gap = 12;
  const buttonWidth = (panelWidth - 48 - gap * (columns - 1)) / columns;
  const buttonHeight = 48;
  const rowGap = 58;
  return {
    panel,
    columns,
    gap,
    buttonWidth,
    buttonHeight,
    rowGap,
    titleY: panel.y + 30,
    hintY: panel.y + 61,
    controlsY: panel.y + 102,
    enemyLabelY: panel.y + 143,
    enemyStartY: panel.y + 184,
    bossLabelY: panel.y + 301,
    bossStartY: panel.y + 342,
    bossPageSize: columns * 2,
    pagerY: panel.y + 474,
    footerY: panel.y + 616,
  };
}

function paperClamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function paperSmoothstep(value: number): number {
  const p = paperClamp01(value);
  return p * p * (3 - 2 * p);
}

function paperCubicOut(value: number): number {
  const p = paperClamp01(value);
  return 1 - (1 - p) ** 3;
}

function paperBackOut(value: number): number {
  const p = paperClamp01(value) - 1;
  return 1 + p * p * (2.70158 * p + 1.70158);
}

function paperPopScaleX(elapsedMs: number, durationMs: number): number {
  const q = paperClamp01(elapsedMs / durationMs);
  if (q > 0.72) return 1;
  return 0.82 + 0.18 * paperBackOut(q / 0.72);
}

function paperPopScaleY(elapsedMs: number, durationMs: number): number {
  const q = paperClamp01(elapsedMs / durationMs);
  if (q <= 0.72) return -0.04 + 1.12 * paperBackOut(q / 0.72);
  return 1.08 - 0.08 * paperSmoothstep((q - 0.72) / 0.28);
}

function paperPopRotation(elapsedMs: number, durationMs: number): number {
  const q = paperClamp01(elapsedMs / durationMs);
  if (q > 0.72) return 0.045 * (1 - paperSmoothstep((q - 0.72) / 0.28));
  return 0.045 * (1 - paperClamp01(paperBackOut(q / 0.72)));
}

function prefersReducedPaperMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

/** §29 belt-scroller render tuning. FORESHORTEN compresses the world DEPTH band onto the screen plane (a
 *  shallow ¾ view). BELT_VIEW_H = the visible world-height the camera fits (band + sky + lip). BELT_SKY =
 *  world px of sky above the band top. All client-only presentation. */
const BELT_FORESHORTEN = 0.5;
// §37 the world-height fit to the screen = SKY (176) + projected deck (DEPTH_MAX·FORESHORTEN = 650) + a thin
// hull LIP (~54) = 880. 1060 left ~22% of the screen as dead gray hull below the deck; 880 fills it with the
// deck + just a sliver of depth-lip, and zooms the characters up a touch as a bonus.
const BELT_VIEW_H = 880;
const BELT_SKY = 176;
const PLAYER_SHADOW_LOCAL_Y = 76 * 0.42;

/** Existing kindTag wire values, named locally so the first layered pass stays protocol-neutral. */
const TelegraphKindTag = {
  Slam: 0,
  Pool: 1,
  Summon: 2,
  Radial: 3,
  Charge: 4,
  ExpandingRing: 5,
  Melee: 6,
  Quake: 7,
  Eruption: 8,
  WormSweep: 9,
  TitanSweep: 10,
  TitanLandmark: 11,
} as const;

const MELEE_TELEGRAPH_PREFIX = "melee:";
const MELEE_FULL_TELL_COUNT = 6;
const MELEE_GLINT_CREST_MS = 60;
const ENEMY_COMBO_LEAP_PEAK = 48;
const ENEMY_COMBO_LEAP_MS = COMBO_LEAP_AIR_TICKS * TICK_MS;
/** A live muzzle admission is presentation truth for the opening flight. The authoritative row can already
 * be several simulation ticks ahead when first observed, so defer correction until the shot visibly clears
 * the implement, then catch up at a bounded rate instead of snapping toward that advanced row. */
const MUZZLE_FLIGHT_AUTHORITY_GRACE_SECONDS = 0.4;
const MUZZLE_FLIGHT_AUTHORITY_CONVERGENCE_PER_SECOND = 8;
const MUZZLE_FLIGHT_AUTHORITY_MAX_CATCHUP_PX_PER_SECOND = 500;
const MUZZLE_FLIGHT_AUTHORITY_SETTLED_PX = 1;

interface EnemyWindupSample {
  serverT: number;
  previousT: number;
  serverTick: number;
  previousTick: number;
  observedAtMs: number;
  ratePerSecond: number;
  shownT: number;
  remainingMs: number;
  durationMs: number;
  lastAtkSeq: number;
  step: number;
  active: boolean;
  aimWorld: number;
  locked: boolean;
  glintAtMs: number;
  firstGlintAtMs: number;
  gold: boolean;
}

interface EnemyComboPresentation {
  observedSeq: number;
  observedFlags: number;
  presentedSeq: number;
  presentedFlags: number;
  pendingSeq: number;
  pendingFlags: number;
  pendingTick: number;
  pendingStagger: boolean;
  hasPending: boolean;
  leapStartTick: number;
  markerId: string;
  markerX: number;
  markerY: number;
  markerRadius: number;
  launchX: number;
  launchY: number;
}

interface JugglePresentationState {
  seq: number;
  lastAtMs: number;
}

interface JumpPresentationState {
  height: number;
  vh: number;
  stance: MoveStance;
  slidePhase: SlidePhase;
  poundSeq: number;
  coilSecondPlayed: boolean;
  stanceStartedMs: number;
}

interface GateVisual {
  ground: Phaser.GameObjects.Container;
  protectedRead: Phaser.GameObjects.Container;
}

function poundRingColor(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 33 + id.charCodeAt(i)) >>> 0;
  switch (hash & 3) {
    case 0:
      return 0x72d9ff;
    case 1:
      return 0xffd66e;
    case 2:
      return 0xb891ff;
    default:
      return 0x78e3a4;
  }
}

interface LevelChoiceControl {
  root: Phaser.GameObjects.Container;
  face: Phaser.GameObjects.Rectangle;
  focusRing: Phaser.GameObjects.Graphics;
  zone: Phaser.GameObjects.Rectangle;
  restY: number;
  side: number;
  view: LevelChoiceView;
  send: () => void;
}

type CarouselDockState = "dormant" | "peek" | "focused" | "fading";

interface CarouselDock {
  root: Phaser.GameObjects.Container;
  /** Elbow + arms + tabs: the part that rides the idle 0.72→1 scale (dockux-panel §1.2). The focus
   *  inspector (`detailLayer`) sits outside it and never scales. */
  body: Phaser.GameObjects.Container;
  rails: Phaser.GameObjects.Container;
  bottomArm: Phaser.GameObjects.Container;
  rightArm: Phaser.GameObjects.Container;
  ticks: Phaser.GameObjects.Graphics;
  bottomTab: Phaser.GameObjects.Text;
  rightTab: Phaser.GameObjects.Text;
  elbow: Phaser.GameObjects.Container;
  junction: DockJunction;
  detailLayer: Phaser.GameObjects.Container;
  chips: DockChip[];
  detailCards: Map<string, Card>;
  detailLru: string[];
  currentDetailId: string;
  selectedId: string;
  selectedIndex: number;
  layoutSig: string;
  activeSig: string;
  heldSig: string;
  liveSig: string;
  layout?: WeaponDockLayout;
  state: CarouselDockState;
  fadeProgress: number;
  fadeEvent?: Phaser.Time.TimerEvent;
  fadeTween?: Phaser.Tweens.Tween;
  focusTween?: Phaser.Tweens.Tween;
  inspectKey?: "Q";
  inspectStartedAt: number;
  blocked: boolean;
}

type PairCandidateSelection = {
  source: "slot" | "bag";
  index: number;
  identity: string;
};

interface MeleeTellCandidate {
  id: string;
  containsSelf: boolean;
  distance: number;
  remainingMs: number;
}

function compareMeleeTellCandidates(a: MeleeTellCandidate, b: MeleeTellCandidate): number {
  return (
    Number(b.containsSelf) - Number(a.containsSelf) ||
    a.distance - b.distance ||
    a.remainingMs - b.remainingMs ||
    a.id.localeCompare(b.id)
  );
}

interface BeamFeedbackState {
  seq: number;
  phase: number;
  x: number;
}

interface OwnerWeaponManifestEntry {
  entryId: string;
  kind: "single" | "pair";
  origin: "committed" | "found";
  location: "active" | "pack" | "field";
  start: number;
  instanceIds: string[];
  weaponIds: string[];
}

interface DamageRecapEntry {
  sourceKind: string;
  sourceId: string;
  sourceLabel: string;
  damageType: string;
  amount: number;
  parryable: -1 | 0 | 1;
  telegraphKind: string;
  receiptKey: string;
  tick: number;
  recordedAtMs: number;
}

interface SyncedDamageAttribution {
  lastDamageSeq?: number;
  damageSeq?: number;
  deathSeq?: number;
  lastDamageSource?: string;
  lastDamageKind?: string;
  deathSource?: string;
  downedByKind?: string;
  lastDamageSourceKind?: string;
  damageSourceKind?: string;
  deathSourceKind?: string;
  lastDamageSourceId?: string;
  damageSourceId?: string;
  deathSourceId?: string;
  downedById?: string;
  lastDamageSourceLabel?: string;
  damageSourceLabel?: string;
  deathSourceLabel?: string;
  lastDamageType?: string;
  damageType?: string;
  deathDamageType?: string;
  lastDamageAmount?: number;
  damageAmount?: number;
  deathDamage?: number;
  downedByDamage?: number;
  lastDamageParryable?: boolean | number;
  damageParryable?: boolean | number;
  deathParryable?: boolean | number;
  downedByParryable?: boolean | number;
  lastDamageTelegraphKind?: string | number;
  damageTelegraphKind?: string | number;
  deathTelegraphKind?: string | number;
}

interface SyncedDamageReceipt {
  seq?: number;
  tick?: number;
  targetId?: string;
  targetPlayerId?: string;
  target?: string;
  sourceKind?: string;
  kind?: string;
  sourceId?: string;
  sourcePlayerId?: string;
  sourceLabel?: string;
  source?: string;
  weaponId?: string;
  delivery?: string | number;
  element?: string;
  dirX?: number;
  dirY?: number;
  damageType?: string;
  damage?: number;
  amount?: number;
  value?: number;
  parryable?: boolean | number;
  telegraphKind?: string | number;
  crit?: boolean;
  finalBlow?: boolean;
}

interface SyncedDamageReceiptRows {
  forEach(callback: (row: SyncedDamageReceipt, id: string | number) => void): void;
}

interface ArenaDamageAttribution {
  damageReceipts?: SyncedDamageReceiptRows;
  hitReceipts?: SyncedDamageReceiptRows;
  combatReceipts?: SyncedDamageReceiptRows;
}

interface EnemyFlinchState {
  x: number;
  y: number;
  appliedX: number;
  appliedY: number;
}

interface PredictedMeleeContact {
  atAnimMs: number;
  weaponId: string;
  aimX: number;
  aimY: number;
  range: number;
  halfArc: number;
  element: string;
}

interface FinalBlowPresentation {
  dirX: number;
  dirY: number;
  weaponId: string;
  element: string;
  selfHit: boolean;
}

function damageDeliveryKind(delivery: string | number | undefined): string {
  if (typeof delivery === "string") return delivery;
  switch (delivery) {
    case CombatDelivery.Melee:
      return "melee";
    case CombatDelivery.Gun:
      return "gun";
    case CombatDelivery.Cast:
      return "cast";
    case CombatDelivery.Thrown:
      return "thrown";
    case CombatDelivery.Beam:
      return "beam";
    case CombatDelivery.Quake:
      return "quake";
    case CombatDelivery.Chain:
      return "chain";
    case CombatDelivery.Parry:
      return "parry";
    case CombatDelivery.Scatter:
      return "scatter";
    default:
      return "";
  }
}

function meleeTelegraphOwner(id: string): string | undefined {
  return id.startsWith(MELEE_TELEGRAPH_PREFIX)
    ? id.slice(MELEE_TELEGRAPH_PREFIX.length)
    : undefined;
}

interface TelegraphEdgePath {
  points: { x: number; y: number }[];
  /** A second path no more than two screen pixels into the dangerous side of the exact boundary. */
  echo: { x: number; y: number }[];
  closed: boolean;
}

interface TelegraphGeometry {
  edges: TelegraphEdgePath[];
  centerX: number;
  centerY: number;
}

function telegraphGeometryContains(geometry: TelegraphGeometry, x: number, y: number): boolean {
  let inside = false;
  for (const edge of geometry.edges) {
    if (!edge.closed || edge.points.length < 3) continue;
    let edgeInside = false;
    let previous = edge.points[edge.points.length - 1];
    if (!previous) continue;
    for (const point of edge.points) {
      if (
        point.y > y !== previous.y > y &&
        x < ((previous.x - point.x) * (y - point.y)) / (previous.y - point.y || 1) + point.x
      )
        edgeInside = !edgeInside;
      previous = point;
    }
    if (edgeInside) inside = !inside;
  }
  return inside;
}

function telegraphDamageKind(kindTag: number): string {
  switch (kindTag) {
    case TelegraphKindTag.Pool:
      return "pool";
    case TelegraphKindTag.Summon:
      return "summon";
    case TelegraphKindTag.Radial:
      return "radial";
    case TelegraphKindTag.Charge:
      return "charge";
    case TelegraphKindTag.ExpandingRing:
      return "ring";
    case TelegraphKindTag.Melee:
      return "melee";
    case TelegraphKindTag.Quake:
      return "quake";
    default:
      return "slam";
  }
}

interface PaperDeathEntry {
  readonly rig: SpriteRig;
  readonly full: boolean;
}

interface PaperWorldFold {
  readonly textureKey: string;
  readonly snapshot: Phaser.GameObjects.RenderTexture;
  readonly top: Phaser.GameObjects.Image;
  readonly bottom: Phaser.GameObjects.Image;
  readonly crease: Phaser.GameObjects.Rectangle;
  readonly screenW: number;
  readonly screenH: number;
  readonly captureScale: number;
  readonly topScaleX: number;
  readonly topScaleY: number;
  readonly bottomScaleX: number;
  readonly bottomScaleY: number;
  readonly telegraphGroundDepth: number;
  tween?: Phaser.Tweens.Tween;
}

function projectTelegraphY(y: number, projectionYScale: number): number {
  return BELT_Y0 + (y - BELT_Y0) * projectionYScale;
}

function adaptiveArcSamples(radius: number, span: number, zoom: number): number {
  const screenRadius = Math.max(1, Math.abs(radius) * zoom);
  const step = 2 * Math.acos(Math.max(-1, Math.min(1, 1 - 1 / screenRadius)));
  return Math.max(24, Math.min(96, Math.ceil(span / Math.max(0.02, step))));
}

function telegraphHash01(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 0x100000000;
}

function insetPoint(
  x: number,
  y: number,
  towardX: number,
  towardY: number,
  inset: number,
): { x: number; y: number } {
  const dx = towardX - x;
  const dy = towardY - y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: x + (dx / len) * inset, y: y + (dy / len) * inset };
}

function ellipseEdge(
  worldX: number,
  worldY: number,
  radius: number,
  start: number,
  end: number,
  projectionYScale: number,
  zoom: number,
  echoTowardCenter: boolean,
  closed: boolean,
): TelegraphEdgePath {
  const centerY = projectTelegraphY(worldY, projectionYScale);
  const count = adaptiveArcSamples(radius, Math.abs(end - start), zoom);
  const points: { x: number; y: number }[] = [];
  const echo: { x: number; y: number }[] = [];
  const inset = 2 / Math.max(0.01, zoom);
  for (let i = 0; i <= count; i++) {
    const angle = start + ((end - start) * i) / count;
    const x = worldX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius * projectionYScale;
    points.push({ x, y });
    const towardX = echoTowardCenter ? worldX : x + (x - worldX);
    const towardY = echoTowardCenter ? centerY : y + (y - centerY);
    echo.push(insetPoint(x, y, towardX, towardY, inset));
  }
  return { points, echo, closed };
}

function polygonEdge(
  points: { x: number; y: number }[],
  centerX: number,
  centerY: number,
  zoom: number,
): TelegraphEdgePath {
  const inset = 2 / Math.max(0.01, zoom);
  return {
    points,
    echo: points.map((p) => insetPoint(p.x, p.y, centerX, centerY, inset)),
    closed: true,
  };
}

/** TG-1: construct in world space, then project every vertex/axis through the same affine y transform. */
function buildTelegraphGeometry(
  shape: number,
  x: number,
  y: number,
  a: number,
  b: number,
  rot: number,
  kindTag: number,
  projectionYScale: number,
  zoom: number,
): TelegraphGeometry {
  const centerY = projectTelegraphY(y, projectionYScale);
  const edges: TelegraphEdgePath[] = [];
  if (shape === TgShape.Rect || shape === TgShape.ArcSweep) {
    const ux = Math.cos(rot);
    const uy = Math.sin(rot);
    const nx = -uy;
    const ny = ux;
    const world = [
      { x: x + nx * b, y: y + ny * b },
      { x: x + ux * a + nx * b, y: y + uy * a + ny * b },
      { x: x + ux * a - nx * b, y: y + uy * a - ny * b },
      { x: x - nx * b, y: y - ny * b },
    ];
    const points = world.map((p) => ({
      x: p.x,
      y: projectTelegraphY(p.y, projectionYScale),
    }));
    let cx = 0;
    let cy = 0;
    for (const p of points) {
      cx += p.x;
      cy += p.y;
    }
    edges.push(polygonEdge(points, cx / points.length, cy / points.length, zoom));
  } else if (shape === TgShape.Cone) {
    const points: { x: number; y: number }[] = [{ x, y: centerY }];
    const count = adaptiveArcSamples(a, Math.max(0.01, b * 2), zoom);
    for (let i = 0; i <= count; i++) {
      const angle = rot - b + (b * 2 * i) / count;
      points.push({
        x: x + Math.cos(angle) * a,
        y: projectTelegraphY(y + Math.sin(angle) * a, projectionYScale),
      });
    }
    let cx = 0;
    let cy = 0;
    for (const p of points) {
      cx += p.x;
      cy += p.y;
    }
    edges.push(polygonEdge(points, cx / points.length, cy / points.length, zoom));
  } else if (shape === TgShape.Ring && kindTag === TelegraphKindTag.ExpandingRing) {
    const outerR = Math.max(0, a + RING_BAND_HALF);
    const innerR = Math.max(0, a - RING_BAND_HALF);
    const start = rot + Math.max(0, b);
    const end = rot - Math.max(0, b) + Math.PI * 2;
    edges.push(ellipseEdge(x, y, outerR, start, end, projectionYScale, zoom, true, false));
    if (innerR > 0.5) {
      edges.push(ellipseEdge(x, y, innerR, start, end, projectionYScale, zoom, false, false));
    }
    const capInset = 2 / Math.max(0.01, zoom);
    const addCap = (angle: number, intoAngle: number): void => {
      const outer = {
        x: x + Math.cos(angle) * outerR,
        y: projectTelegraphY(y + Math.sin(angle) * outerR, projectionYScale),
      };
      const inner =
        innerR > 0.5
          ? {
              x: x + Math.cos(angle) * innerR,
              y: projectTelegraphY(y + Math.sin(angle) * innerR, projectionYScale),
            }
          : { x, y: centerY };
      const outerToward = {
        x: x + Math.cos(intoAngle) * outerR,
        y: projectTelegraphY(y + Math.sin(intoAngle) * outerR, projectionYScale),
      };
      const innerToward =
        innerR > 0.5
          ? {
              x: x + Math.cos(intoAngle) * innerR,
              y: projectTelegraphY(y + Math.sin(intoAngle) * innerR, projectionYScale),
            }
          : {
              x: x + Math.cos(intoAngle) * 2,
              y: centerY + Math.sin(intoAngle) * 2,
            };
      edges.push({
        points: [outer, inner],
        echo: [
          insetPoint(outer.x, outer.y, outerToward.x, outerToward.y, capInset),
          insetPoint(inner.x, inner.y, innerToward.x, innerToward.y, capInset),
        ],
        closed: false,
      });
    };
    const angularInset = 4 / Math.max(outerR, 4);
    addCap(start, start + angularInset);
    addCap(end, end - angularInset);
  } else if (shape === TgShape.Ring && kindTag === TelegraphKindTag.Radial) {
    edges.push(ellipseEdge(x, y, a, 0, Math.PI * 2, projectionYScale, zoom, true, true));
    if (b > 0.5)
      edges.push(ellipseEdge(x, y, b, 0, Math.PI * 2, projectionYScale, zoom, false, true));
  } else {
    const radius = Math.max(2, a);
    edges.push(ellipseEdge(x, y, radius, 0, Math.PI * 2, projectionYScale, zoom, true, true));
  }
  return { edges, centerX: x, centerY };
}

/** Schema-owned titan sweep: the live capsule begins at the frozen inner range, never at the body root. */
function buildVastagharSweepGeometry(
  x: number,
  y: number,
  innerRange: number,
  outerRange: number,
  halfWidth: number,
  rot: number,
  projectionYScale: number,
  zoom: number,
): TelegraphGeometry {
  const ux = Math.cos(rot);
  const uy = Math.sin(rot);
  const innerX = x + ux * innerRange;
  const innerY = y + uy * innerRange;
  const outerX = x + ux * outerRange;
  const outerY = y + uy * outerRange;
  const capSamples = Math.max(8, Math.min(16, Math.ceil((Math.PI * halfWidth * zoom) / 8)));
  const world: { x: number; y: number }[] = [];
  // One closed radial capsule: outer cap faces travel, inner cap faces the planted pivot. Rounded caps keep
  // the protected edge faithful to the server's annular-capsule half-width instead of underdrawing corners.
  for (let i = 0; i <= capSamples; i++) {
    const angle = rot + Math.PI / 2 - (Math.PI * i) / capSamples;
    world.push({
      x: outerX + Math.cos(angle) * halfWidth,
      y: outerY + Math.sin(angle) * halfWidth,
    });
  }
  for (let i = 0; i <= capSamples; i++) {
    const angle = rot - Math.PI / 2 - (Math.PI * i) / capSamples;
    world.push({
      x: innerX + Math.cos(angle) * halfWidth,
      y: innerY + Math.sin(angle) * halfWidth,
    });
  }
  const points = world.map((point) => ({
    x: point.x,
    y: projectTelegraphY(point.y, projectionYScale),
  }));
  let centerX = 0;
  let centerY = 0;
  for (const point of points) {
    centerX += point.x;
    centerY += point.y;
  }
  centerX /= points.length;
  centerY /= points.length;
  return { edges: [polygonEdge(points, centerX, centerY, zoom)], centerX, centerY };
}

/** §17 stand-in sprite per archetype — used when a themed-dimension enemy's BESPOKE art hasn't been
 *  harvest-installed yet (its manifest id isn't in SPRITES). Keeps every new dimension playable on day one
 *  with an archetype-matched Wild-West rig (the same POC pattern as old-rust/ronin/gatlin → boothill); once
 *  the real sprite lands in the manifest, `resolveEnemySprite` picks it automatically. All targets are
 *  always-installed base sprites. */
const ENEMY_FALLBACK_SPRITE: Record<string, string> = {
  rusher: "critter",
  swarm: "mote-swarm",
  zoner: "pricklepulp",
  spitter: "boothill",
  duelist: "boothill",
  tough: "boothill",
  boss: "boothill",
  dummy: "pricklepulp",
};

/** Resolve the sprite manifest id to render for an enemy kind: the bespoke sprite if its art is installed,
 *  else the archetype stand-in (so an un-rendered themed enemy doesn't crash SpriteRig). */
function resolveEnemySprite(kind: EnemyKind | undefined, rawKind: string): string {
  // The schema-26 flagship owns installed four-foot art even while the shared legacy fallback remains grull.
  if (rawKind === "world-titan" && SPRITES["world-titan"]) return rawKind;
  const want = kind?.sprite ?? rawKind;
  if (SPRITES[want as keyof typeof SPRITES]) return want;
  return ENEMY_FALLBACK_SPRITE[kind?.archetype ?? "rusher"] ?? "critter";
}

/**
 * Player-core scene (build order §27.3 step 3, building on step 2's netcode).
 *
 * Connects to the Colyseus room, renders every Tier-1 player as a procedural limbless
 * character (§18), interpolates each toward its server-authoritative position, sends WASD
 * input, and aims the local player at the cursor (§9). Body collision is resolved
 * server-side (§5); the camera free-roams on the local player (§5 independent cameras).
 */
export class ArenaScene extends Phaser.Scene {
  private room?: Room<ArenaState>;
  /** §4 scene-lifecycle generation: every create/shutdown invalidates in-flight connection work. */
  private connectionGeneration = 0;
  /** §4 exact Colyseus callback removers for the currently installed room. */
  private roomStateDisposers: (() => void)[] = [];
  /** §4 raw/global listener references — Phaser cannot remove listeners it did not install. */
  private pointerMoveHandler: ((event: MouseEvent) => void) | null = null;
  private contextMenuHandler: ((event: MouseEvent) => void) | null = null;
  private resizeHandler: ((size: Phaser.Structs.Size) => void) | null = null;
  private resumeAudioPointerHandler: (() => void) | null = null;
  private resumeAudioKeyHandler: (() => void) | null = null;
  private readonly blobs = new Map<string, SpriteRig>();
  /** Client-only followers reconcile from PlayerState descriptors and the already-rendered owner roots. */
  private readonly petRigs = new Map<string, PetRig>();
  private readonly petOwnerHp = new Map<string, number>();
  private petManifest: PetPartsManifest | null | undefined;
  private petMetaAccount!: MetaAccountV4;
  private selectedPetId: MetaAccountV4["selectedPetId"] = "verdant-wing";
  private pendingCarry?: CarrySelectionV1;
  private readonly petPickupEligibility = new Set<string>();
  private petResultLine = "";
  private lastPetReceiptKey = "";
  /** Owner-private at-stake topology; identities never enter PlayerState's public schema. */
  private readonly weaponManifest = new Map<string, OwnerWeaponManifestEntry>();
  private weaponManifestRunId = "";
  private settlementResult?: SettlementPresentation;
  private lastSettlementKey = "";
  /** Wave 4 data-only seam. Wave 5 may consume this map from the rig attachment pass. */
  private readonly syncedGearLoadouts = new Map<string, RemoteGearLoadout>();
  private readonly petAvoidanceScratch = { x: 0, y: 0, alpha: 1 };
  private readonly enemies = new Map<string, SpriteRig>();
  /** Serraketh is one owner, one batch timeline, and one pooled renderer—not twelve ordinary enemy rigs. */
  private wormRig: WormRig | null = null;
  /** Horde paper effects stay scalar/live or bounded/detached; priority 2=boss, 1=tough, 0=ordinary. */
  private readonly enemyPaperPriority = new Map<string, 0 | 1 | 2>();
  private readonly paperDeaths: PaperDeathEntry[] = [];
  private readonly closingPickups = new Set<Phaser.GameObjects.Container>();
  private paperWorldFold?: PaperWorldFold;
  private paperPagePool?: {
    readonly top: Phaser.GameObjects.Image;
    readonly bottom: Phaser.GameObjects.Image;
    readonly crease: Phaser.GameObjects.Rectangle;
  };
  private paperWorldFoldSeq = 0;
  private paperPeakObjects = 0;
  /** Plays each weapon's authored VFX suite (§14 CODE-8) on its swing via the shared renderer. */
  private vfxPlayer!: VfxPlayer;
  private beamRenderer!: BeamRenderer;
  private ultimateVfx!: UltimateVfx;
  /** One fixed-pool flagship director; semantic epochs never compete with player VFX surfaces. */
  private vastagharVfx!: VastagharVfx;
  private readonly vastagharShakeBudget = new VastagharShakeBudget();
  private readonly lastUltimateSeq = new Map<string, number>();
  private readonly lastUltimateArchetype = new Map<string, number>();
  private ultimateCastPendingUntil = -1e9;
  private ultimateHudPulseUntil = -1e9;
  private queuedUltimateReveal?: UltimateRevealDescriptor;
  private queuedUltimateTemper = false;
  private ultimateRevealBusyUntil = -1e9;
  private lastUltimateSelfLevel = -1;
  private beamPredictionStartSeq = -1;
  private beamPredictionHeld = false;
  private beamPredictionAccepted = false;
  private beamPredictionAngle = 0;
  private beamPredictionProgress = 0;
  private beamPredictionFadeAt = -1;
  private beamHelpShown = false;
  private readonly beamPredictionPending: { seq: number; aimX: number; aimY: number }[] = [];
  private lastMintedInputSeq = 0;
  private readonly beamFeedback = new Map<string, BeamFeedbackState>();
  private readonly beamFeedbackSeen = new Set<string>();
  private readonly predictedBeam: PredictedBeamCharge = {
    ownerId: "",
    weaponId: "",
    startSeq: 0,
    originX: 0,
    originY: 0,
    angle: 0,
    progress: 0,
    opacity: 1,
    element: "physical",
  };
  /** Rebase beams onto the final rendered weapon tip this frame (predicted self / delayed remote). */
  private readonly writeBeamMuzzlePose = (
    ownerId: string,
    weaponId: string,
    rowKey: string,
    _angle: number,
    out: BeamMuzzlePose,
  ): boolean => {
    const rig = this.blobs.get(ownerId);
    if (!rig || rig.heldWeaponDef(0)?.id !== weaponId) return false;
    const barrelMatch = /:barrel:(\d+)$/.exec(rowKey);
    const barrelIndex = barrelMatch ? Number(barrelMatch[1]) : 0;
    if (!rig.writeWeaponMuzzle(0, out, barrelIndex)) return false;
    if (this.belt) out.y = BELT_Y0 + (out.y - BELT_Y0) / BELT_FORESHORTEN;
    return true;
  };
  private readonly beamAimCommand = { aimX: 1, aimY: 0, targetX: 0, targetY: 0 };
  /** Bounded painted renderer for the server-authoritative kill-XP Echo map. */
  private xpMotes!: XpMoteRenderer;
  private vastagharCrownCaught = false;
  /** §19 v0.108 procedural audio — the whole game's SFX play through this (see AudioBus). Shared across
   *  scene re-entries via the registry so the volume/mute setting + context survive a menu round-trip. */
  private audio!: AudioBus;
  private combatFeedback!: CombatFeedback;
  private damageNumberRenderer!: DamageNumberRenderer;
  private hitEffectRenderer!: HitEffectRenderer;
  private jumpEffectRenderer!: JumpEffectRenderer;
  private feedbackSettings!: FeedbackSettings;
  private removeFeedbackSettingsListener?: () => void;
  /** §TELEGRAPH exact danger edges above terrain/zones and below actor rigs. Never quality-gated. */
  private telegraphGroundGfx!: Phaser.GameObjects.Graphics;
  /** Protected response-edge/source layer above combat VFX and below HUD. */
  private telegraphGfx!: Phaser.GameObjects.Graphics;
  /** §TELEGRAPH optional painted world preludes; exact geometry does not depend on this pool. */
  private telegraphForeshadows!: TelegraphForeshadowPool;
  /** H10 §20 parry-state ring under the LOCAL drifter — active i-frame flash + cooldown-recovery arc. */
  private parryGfx!: Phaser.GameObjects.Graphics;
  /** H10 `time.now` of the last parry press, so the ring can flash bright through the i-frame window. */
  private lastParryPress = -9999;
  /** §17 v0.102 placed landmark sprites — faded when the local player walks behind one (see-through cover). */
  private poiSprites: PoiSprite[] = [];
  /** §16 v0.116 Polish B — a screen-space AMBIENT DUST layer (drifting motes tinted the dimension's dust
   *  colour) that lends the arena atmosphere. Lazily built on the first update; purely cosmetic. */
  private dustG?: Phaser.GameObjects.Graphics;
  private readonly dust: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    r: number;
    a: number;
    ph: number;
  }[] = [];
  /** §17 v0.102 off-screen extraction-portal locator (a 4800² arena needs a pointer, not just copy). */
  private portalArrow: Phaser.GameObjects.Container | null = null;
  /** §6 v0.103 the matching violet locator for the DEEPER rift. */
  private riftArrow: Phaser.GameObjects.Container | null = null;
  private portalLocatorPulseUntil = -1;
  private riftLocatorPulseUntil = -1;
  /** Last rendered boss ground point; the portal-open edge uses it for the short corpse→relocated-gate beam. */
  private lastBossX = Number.NaN;
  private lastBossY = Number.NaN;
  /** §8 last-seen `parriedSeq` per player, to fire the white parry flash on a successful parry. */
  private readonly lastParried = new Map<string, number>();
  /** Slide null-whiffs have a separate cosmetic edge and never enter the parry reward presentation. */
  private readonly lastDodged = new Map<string, number>();
  /** §6 last-seen `revivedSeq` per player, to fire the green revive pop when a rez brings them back. */
  private readonly lastRevived = new Map<string, number>();
  /** Last routed authoritative attack edge/latch per session. Local edges confirm prediction; remote edges
   *  start the owning rig against the delayed server-tick render timeline. */
  private readonly lastAttackSeq = new Map<string, number>();
  private readonly lastAttackHeld = new Map<string, boolean>();
  /** §16 v0.109 last-seen geometry of each synced telegraph row, so when a row is REMOVED (the attack
   *  resolved) we can edge-fire its impact VFX from the cached shape even though the row is already gone
   *  from state. Keyed by telegraph id; pruned as rows vanish. */
  private readonly telegraphCache = new Map<
    string,
    {
      t: number;
      shape: number;
      x: number;
      y: number;
      a: number;
      b: number;
      rot: number;
      danger: number;
      kindTag: number;
      ownerId: string;
      castSeq: number;
      sawFull: boolean;
      seenFrame: number;
      projectionYScale: number;
      zoom: number;
      hash: number;
      geometry: TelegraphGeometry;
    }
  >();
  private telegraphFrame = 0;
  /** §TELEGRAPH single-boss, protocol-neutral pose resolver scratch. */
  private readonly bossTelegraphPose = {
    active: false,
    id: "",
    shape: 0,
    x: 0,
    y: 0,
    rot: 0,
    t: 0,
    danger: 1,
    kindTag: 0,
    score: -1,
  };
  private bossPoseRowId = "";
  private bossPoseBeatMask = 0;
  /** §4 hot-loop scratch: one sample + animation input per call site; each loop consumes it synchronously. */
  private readonly playerSample = { x: 0, y: 0 };
  private readonly enemySample = { x: 0, y: 0 };
  private readonly playerAnimInput: RigAnim = {
    moveX: 0,
    moveY: 0,
    speed: 0,
    aimX: 0,
    aimY: 0,
    aimDir: 0,
    isSelf: false,
    recoilX: 0,
    recoilY: 0,
  };
  private readonly enemyAnimInput: RigAnim = {
    moveX: 0,
    moveY: 0,
    speed: 0,
    aimX: 0,
    aimY: 0,
    aimDir: 0,
    isSelf: false,
  };
  /** One-tick-bounded presentation sampler. It can smooth the 20 Hz stairs but cannot declare contact. */
  private readonly enemyWindup = new Map<string, EnemyWindupSample>();
  /** §51 delayed-edge cursors: combo flags/seq are applied when the snapshot render timeline reaches their
   * server tick, keeping the cosmetic arc attached to the authoritative horizontal ground track. */
  private readonly enemyComboPresentation = new Map<string, EnemyComboPresentation>();
  private readonly comboMarkerClaims = new Set<string>();
  /** Stable nearest-six source salience plus uncullable local intersections/near-term threats. */
  private meleeFullTells = new Set<string>();
  private meleeFullTellNext = new Set<string>();
  private readonly meleeTellCandidates: MeleeTellCandidate[] = [];
  private readonly meleeTellAnchor = { x: 0, y: 0 };
  private keys!: Record<
    | "W"
    | "A"
    | "S"
    | "D"
    | "R"
    | "P"
    | "Q"
    | "E"
    | "Z"
    | "X"
    | "F"
    | "G"
    | "H"
    | "T"
    | "B"
    | "C"
    | "M"
    | "TAB"
    | "ESC"
    | "SPACE"
    | "SHIFT"
    | "CTRL"
    | "ONE"
    | "TWO"
    | "THREE"
    | "FOUR"
    | "FIVE"
    | "LEFT"
    | "RIGHT"
    | "UP"
    | "DOWN"
    | "ENTER",
    Phaser.Input.Keyboard.Key
  >;
  /** §29 v0.118 BELT-SCROLLER mode (`?belt=1` or the menu's belt launch): renders the SAME game (all systems
   *  intact) in the 2.5D beat-'em-up view. Purely a render/camera/floor swap — the sim runs belt-shaped. */
  private belt = new URLSearchParams(location.search).has("belt");
  /** §29 the authored belt level (floor profile + obstacles) — set when belt mode is on; drives the deck
   *  render + is handed to the predictor so client collision matches the server. */
  private beltLevel: BeltLevel | null = null;
  /** §29 the room-gate barrier graphic (drawn at the synced lock x) + last-seen room name for the banner. */
  private beltGate: Phaser.GameObjects.Graphics | null = null;
  private lastBeltRoom = "";
  /** §29 the Codex-rendered sky-carrier backdrop image (pinned + sized to the viewport each frame). */
  private beltBackdrop: Phaser.GameObjects.Image | null = null;
  /** §29 drifting-cloud parallax band over the upper sky — a procedural (transparent) tile that scrolls
   *  slower than the camera + drifts on its own, so the sky feels alive ("clouds passing by"). */
  private beltClouds: Phaser.GameObjects.TileSprite | null = null;
  private beltCloudDrift = 0;
  // ── §4 v0.107 online netcode (docs/NETCODE_DESIGN.md) ──
  /** Client-side prediction for the LOCAL player: created on the first patch that carries our player,
   *  ticked once per 50ms input command, reconciled on every patch. The self rig renders THIS. */
  private predictor: SelfPredictor | null = null;
  /** Fixed 50ms input-command accumulator (clamped ≤3 ticks/frame — a tab-throttle wake must not burst
   *  20 commands; a >250ms frame gap resets it and hard-resyncs, mirroring the server's own dt clamp). */
  private inputAccMs = 0;
  /** A classified tap released since the last command — jump rides the next numbered input. */
  private jumpQueued = false;
  /** Space tap/hold/pound classifier + command-stream latches (tap emits on release). */
  private readonly spaceGesture = new SpaceGestureClassifier();
  private crouchHeld = false;
  private poundQueued = false;
  /** Shift/Ctrl keydown edge waiting for the next forced-immediate numbered command. */
  private slideQueued = false;
  private slideDryWindowAt = -1e9;
  private slideDryPresses = 0;
  private slideDryToastShown = false;
  /** This frame's sampled WASD direction (drives the command mint AND the predictor's frame preview). */
  private curDx = 0;
  private curDy = 0;
  /** Retained raw Arena sample; one decision per frame, with no hot-loop allocation. */
  private readonly rawFlourishIntent: RawFlourishIntent = {
    attack: false,
    parryOrBrace: false,
    jumpOrDodge: false,
    interaction: false,
    weaponSelection: false,
    desiredMoveX: 0,
    desiredMoveY: 0,
  };
  /** Self height from the predictor this frame (the rig hop for SELF; remotes use synced height). */
  private selfPredHeight = 0;
  private selfPredVh = 0;
  private selfPredStance: MoveStance = STANCE_NONE;
  private selfPredSlidePhase: SlidePhase = SLIDE_PHASE_OFF;
  private selfPredSlideTick = 0;
  private readonly jumpPresentation = new Map<string, JumpPresentationState>();
  private readonly jugglePresentation = new Map<string, JugglePresentationState>();
  /** Whether the previous frame was hit-stop-frozen — on the unfreeze edge the accrued prediction
   *  displacement folds into the error offset so it glides instead of popping (review #11). */
  private wasFrozen = false;
  /** Server-tick timeline mapper + per-entity snapshot rings for REMOTE players and enemies. */
  private readonly timeline = new TimelineSync();
  private readonly playerBufs = new Map<string, SnapshotBuffer>();
  private readonly enemyBufs = new Map<string, SnapshotBuffer>();
  /** Last-seen fellSeq per REMOTE player — a pit snap-back purges + reseeds their snapshot ring so the
   *  interpolator can't re-walk them into the pit (review #10). (Self dust/flash stays in checkFalls.) */
  private readonly snapFell = new Map<string, number>();
  /** Suppress the state-driven muzzle flash for SELF for a beat after a locally-predicted one. */
  private lastSelfMuzzleAt = -9999;
  /** §19 v0.108 polish — low-HP red screen vignette (built in create, alpha driven each frame) + a 0..1
   *  hurt punch that spikes on a hit and decays, so both danger and impact read at the screen edges. */
  private dangerVignette!: Phaser.GameObjects.Graphics;
  private juggleVignette!: Phaser.GameObjects.Graphics;
  private verbUi?: VerbLegendManager;
  private ownerNoteUi?: OwnerNoteOverlay;
  private ownerNoteKeyboardPaused = false;
  private jugglePulseUntil = -1e9;
  private hurtFlash = 0;
  /** §19 v0.108 polish — smoothed bar fills (lerp toward the true ratio), so hits/heals/XP read as
   *  motion, not a per-patch jump. -1 = uninitialised (snap on the first frame). */
  private hpShown = -1;
  private xpShown = -1;
  /** 0..1 receipt punch; changes XP-bar height/brightness, never its authoritative width. */
  private xpPulse = 0;
  private xpAudioStreak = 0;
  private xpAudioLastAt = -9999;
  private xpReceiptLastAt = -9999;
  private readonly xpReceiptBatches = new Map<
    string,
    { value: number; x: number; y: number; lastAt: number }
  >();
  private bossShown = -1;
  private selfAim = { x: 1, y: 0 };
  /** §7 v0.105 de-clunk — spectate camera easing: which teammate we're trailing while downed, plus a
   *  from-point + 0..1 blend so a switch to a new target GLIDES (~0.32s) instead of hard-cutting the view. */
  private spectateId = "";
  private camFrom = { x: 0, y: 0 };
  private camBlend = 1;
  /** §7 v0.117 smoothed camera focus (world px) — the point the camera eases toward each frame instead of
   *  hard-locking on the player. Null until the first follow; snaps on a teleport-sized jump. */
  private camFocus: { x: number; y: number } | null = null;
  /** Pointer position read straight off the DOM (robust aim — bypasses Phaser's input pipeline,
   *  which was dropping mouse movement that began while a key was held). */
  private readonly pointerScreen = { x: 0, y: 0, set: false };
  private pointerMoves = 0;
  /** Suppresses LMB/RMB combat while the pointer is over a clickable HUD or modal control. */
  private pointerOverInteractiveUi = false;
  private prevSelfHp = -1;
  private lastHurt = 0;
  private observedSelfFellSeq = 0;
  private lastDamageReceiptKey = "";
  private readonly damageReceiptSeqBySlot = new Map<string | number, number>();
  private readonly deathRecap: [DamageRecapEntry, DamageRecapEntry] = [
    {
      sourceKind: "",
      sourceId: "",
      sourceLabel: "",
      damageType: "",
      amount: 0,
      parryable: -1,
      telegraphKind: "",
      receiptKey: "",
      tick: 0,
      recordedAtMs: -9999,
    },
    {
      sourceKind: "",
      sourceId: "",
      sourceLabel: "",
      damageType: "",
      amount: 0,
      parryable: -1,
      telegraphKind: "",
      receiptKey: "",
      tick: 0,
      recordedAtMs: -9999,
    },
  ];
  private recentResolvedDangerKind = "";
  private recentResolvedDangerAt = -9999;
  private localAtkCd = 0;
  /** Highest attack sequence for which the owning client has already played prediction. Confirmations at or
   *  below this contiguous high-water mark must not restart the local rig/tome page. */
  private localPredictedAttackSeq = 0;
  /** Exact predictor candidate consumed by the owner rig this frame; diagnostics only, never fed back. */
  private selfPredictionCandidateX = Number.NaN;
  private selfPredictionCandidateY = Number.NaN;
  private localParryCd = 0;
  /** §8 v0.114 PARRY COMBO — client-inferred chain counter for the local drifter (no synced field): each
   *  own-parry within `PARRY_CHAIN_WINDOW` of the last bumps `parryChain`; a lapse resets it. Drives the
   *  floating "PARRY ×N" pop that mirrors the server's heal/riposte escalation. */
  private parryChain = 0;
  private parryChainAt = 0;
  private frozenUntil = 0;
  /** §7 v0.105 de-clunk — animation clock (ms) that does NOT advance during a hit-stop freeze. Rig swing /
   *  brace timing rides this instead of the wall clock so a freeze never skips frames of a swing/guard. */
  private animClock = 0;
  /** §7 v0.105 de-clunk — prioritized camera-shake bookkeeping (see `shakeCam`): a weaker shake never
   *  stomps a stronger one still running, and every shake FORCE-restarts past Phaser's drop-if-busy guard. */
  private shakeUntil = 0;
  private shakeIntensity = 0;
  /** One synchronous explosion call can attenuate its ally-ultimate camera weather by distance/duty. */
  private ultimateExplosionShakeScale = 1;
  private lastUltimateWeatherShakeAt = -1e9;
  /** §7 v0.105 de-clunk — hit-stop budget (leaky bucket): non-priority freezes (kill crunches) may spend at
   *  most FREEZE_BUDGET_MS of every FREEZE_WINDOW_MS, so a horde clear can't freeze ~40% of the time. */
  private freezeSpent = 0;
  private freezeSpentAt = 0;
  /** H3 hit-stop throttle — kills crunch at most this often so a horde-clearing AoE can't lock the screen. */
  private lastKillStop = 0;
  private deltaSec = 0;
  private readonly enemyHp = new Map<string, number>();
  /** §30 last-seen crit-flash counter per enemy — a change (with an hp drop) means this hit CRIT. */
  private readonly enemyCrit = new Map<string, number>();
  private hitVfxSpent = 0;
  private readonly enemyFlinches = new Map<string, EnemyFlinchState>();
  private readonly predictedMeleeContacts: PredictedMeleeContact[] = [];
  private readonly finalBlowPresentations = new Map<string, FinalBlowPresentation>();
  private readonly finalDeltaTargets = new Set<string>();
  private readonly feedbackStopAt = new Map<number, number>();
  private feedbackStopMs = 0;
  private feedbackStopTier = 0;
  private feedbackStopCount = 0;
  private feedbackFinalBlows = 0;
  private feedbackShakeDuration = 0;
  private feedbackShakeIntensity = 0;
  private feedbackPunchX = 0;
  private feedbackPunchY = 0;
  private cameraPunchX = 0;
  private cameraPunchY = 0;
  private lastCameraPunchAt = -9999;
  /** Last-seen duelist `atkSeq` per enemy — trigger a swing animation when it increments. */
  private readonly enemyAtk = new Map<string, number>();
  private readonly equipped = new Map<string, string>();
  /** §DUAL render identity mirrors the nested off-hand link so stable pairs keep the frame hot path cheap. */
  private readonly equippedOffhand = new Map<string, string>();
  /** §7 last-rendered character skin per player — recreate the rig when it changes (C-key swap). */
  private readonly charOf = new Map<string, string>();
  private readonly pickups = new Map<string, Phaser.GameObjects.Container>();
  /** Rendered enemy projectiles (§15 spit), dead-reckoned from server (x,y,vx,vy). */
  private readonly projectiles = new Map<string, Phaser.GameObjects.Container>();
  /** Rendered zoner puddles (§15 area denial). */
  private readonly zones = new Map<string, Phaser.GameObjects.Container>();
  /** §17 the procgen arena, regenerated client-side from the synced seeds (identical to the server's), +
   *  the baked floor graphics. Built once the seeds arrive. */
  private arenaMap?: ArenaMap;
  /** §6 chain (v0.103): the seed+dimension fingerprint the CURRENT floor was baked from — when the synced
   *  values diverge (rift descent / run restart re-mints the map), the floor is torn down and rebuilt. */
  private lastSeedKey = "";
  /** Every game object the floor bake created, so a rebuild can destroy the lot. */
  private floorObjs: Phaser.GameObjects.GameObject[] = [];
  /** §6 v0.103: until this clock, enemy-REMOVAL VFX are muted — a rift descent bulk-clears the old
   *  dimension's horde and the removals must read as "left behind", not a mass death celebration. */
  private removalFxMuteUntil = 0;
  /** §10 v0.104 last-seen held-loot fingerprint — the mystery-grab REVEAL banner fires when it changes. */
  private prevHeldLoot = "";
  /** §13 v0.104 expansion sprites already queued for runtime lazy-load (don't double-queue). */
  private readonly pendingArt = new Set<string>();
  /** §13 v0.104 sprites whose lazy-load FAILED (missing on disk / 404) — equip falls through to empty
   *  hands instead of retrying forever with an invisible weapon (adversarial-verify hardening). */
  private readonly failedArt = new Set<string>();
  /** Open-tome companions are optional loose textures and have an independent lazy-load lifetime: closed
   *  weapon parts remain usable if an `open.png` is missing or still decoding. */
  private readonly pendingTomeArt = new Set<string>();
  private readonly failedTomeArt = new Set<string>();
  /** §17 optional terrain/prop files that failed to load — skip/fall back and never retry every frame. */
  private readonly floorArtMissing = new Set<string>();
  /** §17 last-seen `fellSeq` per player — fire the fall VFX (dust poof + a local red flash) when it ticks. */
  private readonly lastFell = new Map<string, number>();
  private weaponText!: Phaser.GameObjects.Text;
  private augmentText!: Phaser.GameObjects.Text;
  private objectiveHudGfx!: Phaser.GameObjects.Graphics;
  private objectiveText!: Phaser.GameObjects.Text;
  private objectiveLocationText!: Phaser.GameObjects.Text;
  private objectiveEconomyText!: Phaser.GameObjects.Text;
  private objectiveNoticeText!: Phaser.GameObjects.Text;
  private objectiveHudLayoutSig = "";
  private objectiveProgressTop = 96;
  private objectiveProgressWidth = 520;
  private hpBarBg!: Phaser.GameObjects.Rectangle;
  private hpBarFill!: Phaser.GameObjects.Rectangle;
  private hpText!: Phaser.GameObjects.Text;
  private xpBarBg!: Phaser.GameObjects.Rectangle;
  private xpBarFill!: Phaser.GameObjects.Rectangle;
  private driveHudGfx?: Phaser.GameObjects.Graphics;
  private driveHudText?: Phaser.GameObjects.Text;
  private driveLocked = false;
  private ultimateHudGfx?: Phaser.GameObjects.Graphics;
  private ultimateHudText?: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private prevLevel = -1;
  // §16 boss/extraction run loop.
  private bossBarBg!: Phaser.GameObjects.Rectangle;
  private bossBarFill!: Phaser.GameObjects.Rectangle;
  /** §16 v0.116 Polish B — phase-threshold tick marks drawn over the boss bar (redrawn when the boss/kind
   *  changes) so the player can SEE the HP gates where the fight escalates. */
  private bossBarSegments!: Phaser.GameObjects.Graphics;
  private bossText!: Phaser.GameObjects.Text;
  private victoryText!: Phaser.GameObjects.Text;
  private portal?: GateVisual;
  /** §6 chain (v0.103): the violet DEEPER rift — the other half of the extract-vs-push decision. */
  private rift?: GateVisual;
  private bannerShownFor = "";
  /** §7 v0.105 de-clunk — banner stacking: rotating vertical slot + last-shown clock so banners that land
   *  within the fade window stack instead of overprinting the same point. */
  private bannerSlot = 0;
  private lastBannerAt = -9999;
  private prevBossPresent = false;
  /** §19 v0.108 last-seen victory state — fire the extract sting once on the transition, not every frame. */
  private prevWon = false;
  /** §20/§28 4K-widescreen UI: last-applied HUD scale factor (-1 = not yet applied). The HUD is authored at
   *  a 1× baseline and `applyHudScale` grows every element on big viewports so it stays proportionate; we
   *  only re-apply when `uiScale()` actually changes (a resize), not every frame. */
  private hudScale = -1;
  // §12 level-up window (attribute allocation).
  private levelWinObjects: Phaser.GameObjects.GameObject[] = [];
  private levelWinKey = "";
  private levelWinMode: LevelUpMode | "" = "";
  private levelWinTimerBar?: Phaser.GameObjects.Rectangle;
  private levelWinTimerText?: Phaser.GameObjects.Text;
  private levelWinStatusText?: Phaser.GameObjects.Text;
  private levelWinTimerWidth = 0;
  private levelWinTimerSampleDs = -1;
  private levelWinTimerSampleAt = 0;
  private levelWinAutoLabel = "";
  private levelWinDim?: Phaser.GameObjects.Rectangle;
  private levelWinLower?: Phaser.GameObjects.Container;
  private levelWinUpper?: Phaser.GameObjects.Container;
  private levelWinChoices: LevelChoiceControl[] = [];
  private levelWinFocus = 0;
  private levelWinAwaitingRelease = true;
  /** Counter tweens target plain values, so the modal must explicitly remove them at every offer edge. */
  private levelWinPaperCounters: Phaser.Tweens.Tween[] = [];
  private levelWinSelectionSent = false;
  private levelWinInputReleaseLatch = false;
  private deathText!: Phaser.GameObjects.Text;
  private restartBtn!: Phaser.GameObjects.Text;
  // §21 Testing-Grounds Tab summon menu (dev): pick a monster kind + a multiplier to conjure it.
  private summonObjects: Phaser.GameObjects.GameObject[] = [];
  private summonOpen = false;
  private summonCount = 1; // the multiplier (× this many per spawn click)
  private summonTough = false;
  private summonBossPage = 0;
  // §9/§13 drop & salvage (R): tap = drop the held weapon, HOLD = salvage it. `rHold` = seconds R has
  // been down; `rSalvaged` guards the one-shot salvage so a long hold doesn't fire it every frame.
  private rHold = 0;
  private rSalvaged = false;
  /** Nearest grabbable pickup this frame (world px), for the E prompt and highlight ring. */
  private grabTarget: { x: number; y: number } | null = null;
  private grabTargetId = "";
  private galleryLabelFocusId = "";
  private grabRadius = PICKUP_RADIUS;
  /** The pulsing amber ring drawn on the pickup E will take. */
  private grabGfx!: Phaser.GameObjects.Graphics;
  private grabPromptText!: Phaser.GameObjects.Text;
  private dropBar?: Phaser.GameObjects.Graphics;
  private dropBarLabel?: Phaser.GameObjects.Text;
  // §9 non-belt navigator: a fixed mirrored-L dock, virtualized passive chips, and one lazy keyboard
  // inspector. The synchronized player row is always the source of the elbow's identity and resources.
  private carouselDock?: CarouselDock;
  // §29 belt arsenal HUD (replaces the carousel in belt mode): 3 slot chips + scrip/bag readout, and a
  // Tab-toggled bag panel with clickable entries (click a bag weapon → equip into the active slot; click a
  // slot → stash to bag). Immediate-mode Graphics + pooled Text; interactive zones rebuilt when the panel opens.
  private arsenalG: Phaser.GameObjects.Graphics | null = null;
  private arsenalTexts: Phaser.GameObjects.Text[] = [];
  private arsenalPairArt: Phaser.GameObjects.Image | null = null;
  private bagOpen = false;
  private bagG: Phaser.GameObjects.Graphics | null = null;
  private bagTexts: Phaser.GameObjects.Text[] = [];
  private bagZones: Phaser.GameObjects.Rectangle[] = [];
  private slotZones: Phaser.GameObjects.Rectangle[] = [];
  private pairSlotZones: Phaser.GameObjects.Rectangle[] = [];
  private bagPairZones: Phaser.GameObjects.Rectangle[] = [];
  private pairConfirmZone: Phaser.GameObjects.Rectangle | null = null;
  private unbindZone: Phaser.GameObjects.Rectangle | null = null;
  private pairCandidate: PairCandidateSelection | null = null;
  private pairRequestLockedUntil = 0;
  private lastPairKey = "";
  // dockux-panel §3: Backpack item-card pooled art thumbnails, the display-order sort mapping (server bag
  // order stays authoritative for messages), hover state, and the open/close choreography clocks.
  private bagArts: Phaser.GameObjects.Image[] = [];
  private bagDisplayOrder: number[] = [];
  private bagHoverCell = -1; // visual cell index (−1 = none); resolved via bagDisplayOrder at render
  private bagPanelShown = false;
  private bagPanelOpenAt = 0;
  private bagPanelCloseAt = 0; // >0 while the 150 ms close drop is playing (zones already disabled)
  private bagPanelMode: "bag" | "shop" = "bag";
  private bagWorkflow: "inventory" | "sell" | "bind" | "upgrades" = "inventory";
  private bagFocusCell = 0;
  private bagSelected: { source: "bag" | "slot"; index: number } | null = null;
  private bagTabZones: Phaser.GameObjects.Rectangle[] = [];
  private bagActionZone: Phaser.GameObjects.Rectangle | null = null;
  private bagRenderSignature = "";
  // §29 shopkeeper: a world-space vendor drawn at state.beltShopX; `shopOpen` is the SELL overlay (F near
  // the vendor). When open, the same slot/bag zones sell for scrip instead of swapping/equipping.
  private shopNpcG: Phaser.GameObjects.Graphics | null = null;
  private shopPromptText: Phaser.GameObjects.Text | null = null;
  private shopOpen = false;
  private lastScrip = -1; // §29 track scrip to flash a "+N" confirmation on a sale (−1 = uninitialised)
  private lastUpgradeSig = ""; // §31 track upgrade levels to persist on purchase
  private buyZones: Phaser.GameObjects.Rectangle[] = []; // §31 shop upgrade-buy click zones
  private readonly debugEl = document.getElementById("debug");

  constructor() {
    super("arena");
  }

  /** §17 the dimension chosen at the menu (MenuScene → `scene.start("arena", { dimensionId })`). Passed to
   *  the room as a join option — only the room CREATOR's pick takes effect; joiners inherit the host's
   *  synced `dimensionId`. Defaults to Wild West when the arena is launched directly (no menu). */
  private selectedDimension: string = DEFAULT_DIMENSION;
  /** §36 the belt level chosen at the menu (level-select). Threaded to the server + used for prediction. */
  private selectedBeltLevel = "sky-carrier";
  /** §16 v0.116 the menu launched BOSS RUSH — forwarded as a join option (only the room CREATOR's flag
   *  takes effect; joiners inherit the host's synced `mode`). */
  private bossRush = false;
  /** §39 pending dev-portal deep-link (boss/weapon/char/gear/pet); applied once, then nulled. */
  private devLaunch: string | null = null;

  init(data?: {
    dimensionId?: string;
    bossRush?: boolean;
    belt?: boolean;
    beltLevel?: string;
    dev?: string;
    selectedPetId?: MetaAccountV4["selectedPetId"];
    carry?: CarrySelectionV1;
  }): void {
    // §4 Phaser reuses this Scene instance: launch options must be derived afresh, never inherited from the
    // previous run (notably a belt launch followed by a normal top-down launch).
    this.selectedDimension = data?.dimensionId ?? DEFAULT_DIMENSION;
    this.bossRush = data?.bossRush ?? false;
    const params = new URLSearchParams(location.search);
    this.belt = data?.belt ?? params.has("belt"); // §29 menu belt-launch (URL `?belt=1` is the other trigger)
    // §36 the SELECTED belt level (menu level-select). URL `?belt=<id>` also picks it.
    const urlLevel = params.get("belt");
    this.selectedBeltLevel =
      data?.beltLevel ?? (urlLevel && urlLevel !== "1" ? urlLevel : "sky-carrier");
    this.petMetaAccount = loadPetMetaAccount();
    this.selectedPetId = data?.selectedPetId ?? this.petMetaAccount.selectedPetId;
    this.pendingCarry = data?.carry;
    // §39 dev-portal deep-link (boss/weapon/char/gear/pet), applied once after the room connects.
    this.devLaunch = data?.dev ?? params.get("dev") ?? null;
  }

  /** Load the sprite art. §28: ONE packed multiatlas (tools/artkit/pack-atlas.mjs) holds every non-expansion
   *  part as the frame "<id>/<role>", so the WebGL batcher binds a single texture for a whole screen of rigs
   *  instead of one per part (the genre's standard horde-render fix). SpriteRig reads frames via `partTexture`. */
  preload(): void {
    // MenuScene owns the cold boot load; scene transitions share one TextureManager, so queueing the same
    // atlas again is both wasted I/O and a real Phaser console error under the e2e error gate.
    if (!this.textures.exists(SPRITE_ATLAS)) {
      this.load.multiatlas(SPRITE_ATLAS, "sprites/dd-sprites.json", "sprites");
    }
    preloadParticlePacks(this); // §41 the painted element×shape particle packs (Codex factory)
    preloadCasterPaintedArt(this);
    preloadGeneratedGunProjectiles(this);
    preloadProjectileExplosionArt(this);
    preloadPageProjectileArt(this);
    preloadImpactFlipbooks(this); // optional per-element 6-frame hit blooms; missing strips stay silent
    if (this.belt) {
      // §29 sky-carrier alone owns its four room backdrops + deck; themed levels must not download them.
      if (this.selectedBeltLevel === "sky-carrier") {
        this.load.image("belt-sky", "belt/sky-carrier.png");
        this.load.image("belt-sky-bridge", "belt/sky-bridge.png");
        this.load.image("belt-sky-catwalk", "belt/sky-catwalk.png"); // §31 per-room backdrops (Codex)
        this.load.image("belt-sky-arena-mouth", "belt/sky-arena-mouth.png");
        this.load.image("belt-deck", "belt/deck.png");
      }
      // §37 themed-level Codex art (gen-belt-backdrops.mjs + gen-belt-decks.mjs) — a vista + a deck-plating
      // strip per non-sky-carrier level. init() ran before preload, so the selected level is known; only its
      // own art loads. Keys are PER-LEVEL (texture keys outlive scene restarts — a shared key would show the
      // previous level's art on the next run).
      if (this.selectedBeltLevel !== "sky-carrier") {
        this.load.image(
          `belt-bg:${this.selectedBeltLevel}`,
          `belt/bg-${this.selectedBeltLevel}.png`,
        );
        this.load.image(
          `belt-deck:${this.selectedBeltLevel}`,
          `belt/deck-${this.selectedBeltLevel}.png`,
        );
      }
    }
    for (const manifest of Object.values(SPRITES)) {
      // §13 the +300 EXPANSION weapons (id `x2-…`) are held OUT of the atlas + gated: not boot-loaded (they'd
      // bloat VRAM). Only a CURATED one (expansion flag cleared) boot-loads its loose parts — SpriteRig then
      // falls back to the per-part texture since it isn't in the atlas. Everything non-expansion is in the atlas.
      if (!manifest.id.startsWith("x2-") || WEAPONS[manifest.id]?.expansion) continue;
      for (const part of manifest.parts) {
        this.load.image(`${manifest.id}:${part.role}`, `sprites/${manifest.id}/${part.file}`);
      }
    }
    // Weapon VFX hero skins (§14 Codex art, authored in the Weaponsmith). Game-res, pre-sized.
    this.load.image("vfx-quake-tombstone", "vfx/quake-tombstone.png");
    // Weapon card art (§14 two-pass / §28.5) for the §9 carousel — ONLY ids with bespoke art on disk
    // (CARD_ART_IDS, regenerated by gen-card-manifest). Others fall back to the sprite/icon card, so we
    // never queue 404s that flood the console and bury real errors. Expansion cards also load on-demand.
    for (const id of CARD_ART_IDS) {
      if (WEAPONS[id]?.expansion) continue;
      this.load.image(`card-${id}`, `cards/${id}.jpg`);
    }
    // Authored per-weapon VFX assets — painted hero skins + scatter sheets (§14 CODE-8).
    VfxPlayer.preloadAssets(this);
    // §17 Codex SEAMLESS terrain tiles (tools/artkit/gen-tiles.mjs). Optional — if a file is absent the
    // dev server returns index.html, which fails to decode; `loaderror` flags it so the floor falls back
    // to the flat fill instead of TileSpriting a broken stub.
    this.load.image("tile-ground", "tiles/ground.jpg");
    // §17 P0.1 DIMENSION TERRAIN: init() has already selected the requested active dimension, so preload
    // only its four 512px variants + one 1024×256 rim (the menu owns the sixth texture, its key-art JPG).
    // Missing/half-rendered kits are optional. Override only these files' decode-error hook because Vite may
    // answer a missing public asset with index.html (HTTP 200): Phaser's default hook logs each bad decode.
    const terrainDimensionId = getDimension(this.selectedDimension).id;
    for (let i = 0; i < 4; i++) {
      const key = terrainTileKey(terrainDimensionId, i);
      if (!this.textures.exists(key) && !this.floorArtMissing.has(key)) {
        this.queueOptionalFloorArt(key, `tiles/${terrainDimensionId}/tile-${i}.png`);
      }
    }
    const rimKey = terrainRimKey(terrainDimensionId);
    if (!this.textures.exists(rimKey) && !this.floorArtMissing.has(rimKey)) {
      this.queueOptionalFloorArt(rimKey, `tiles/${terrainDimensionId}/rim.png`);
    }
    // §17 P4 active-dimension prop pack: DECAL ground litter + POI landmarks. A joiner/rift whose synced
    // dimension differs is covered by maybeBuildFloor's identical lazy-load gate below.
    const propPack = dimensionPropPack(terrainDimensionId);
    for (const id of propPack.decalIds) {
      if (!this.textures.exists(id) && !this.floorArtMissing.has(id)) {
        this.queueOptionalFloorArt(id, `${propPack.decalDir}/${id}.png`);
      }
    }
    for (const id of propPack.poiIds) {
      if (!this.textures.exists(id) && !this.floorArtMissing.has(id)) {
        this.queueOptionalFloorArt(id, `${propPack.poiDir}/${id}.png`);
      }
    }
    this.load.on("loaderror", (file: Phaser.Loader.File) => {
      if (/^(tile|decal|poi)-/.test(file.key) || file.key.startsWith("terrain:")) {
        this.floorArtMissing.add(file.key);
      }
    });
  }

  /** Queue optional floor art with a silent decode-error path (Vite may return index.html with HTTP 200). */
  private queueOptionalFloorArt(key: string, url: string): void {
    const file = new Phaser.Loader.FileTypes.ImageFile(this.load, key, url);
    file.onProcessError = () => {
      this.floorArtMissing.add(key);
      file.state = Phaser.Loader.FILE_ERRORED;
      file.loader.fileProcessComplete(file);
    };
    this.load.addFile(file);
  }

  /** §17 a Codex tile texture is usable only if it loaded AND isn't a missing-file stub. */
  private hasTile(key: string): boolean {
    if (this.floorArtMissing.has(key) || !this.textures.exists(key)) return false;
    const w = this.textures.get(key).getSourceImage()?.width ?? 0;
    return w > 8;
  }

  /** §4 remove every callback installed on the active Colyseus state signal. */
  private disposeRoomStateCallbacks(): void {
    for (const dispose of this.roomStateDisposers.splice(0)) dispose();
  }

  /** §4 remove listeners whose owners outlive a Scene shutdown (DOM, ScaleManager, and input globals). */
  private removeSceneListeners(): void {
    if (this.pointerMoveHandler) {
      window.removeEventListener("pointermove", this.pointerMoveHandler, true);
      window.removeEventListener("mousemove", this.pointerMoveHandler, true);
      this.pointerMoveHandler = null;
    }
    if (this.contextMenuHandler) {
      this.game.canvas.removeEventListener("contextmenu", this.contextMenuHandler);
      this.contextMenuHandler = null;
    }
    if (this.resizeHandler) {
      this.scale.off("resize", this.resizeHandler);
      this.resizeHandler = null;
    }
    if (this.resumeAudioPointerHandler) {
      this.input.off("pointerdown", this.resumeAudioPointerHandler);
      this.resumeAudioPointerHandler = null;
    }
    if (this.resumeAudioKeyHandler) {
      this.input.keyboard?.off("keydown", this.resumeAudioKeyHandler);
      this.resumeAudioKeyHandler = null;
    }
    this.ownerNoteUi?.destroy();
    this.ownerNoteUi = undefined;
    this.restoreOwnerNoteKeyboard();
    this.input.keyboard?.removeCapture("TAB");
    this.input.keyboard?.removeCapture("ESC");
  }

  /** §4 leave the installed room after detaching callbacks, so no leave-time patch can touch this Scene. */
  private leaveCurrentRoom(): void {
    this.disposeRoomStateCallbacks();
    const room = this.room;
    this.room = undefined;
    if (room) {
      void room
        .leave()
        .catch((err: unknown) =>
          console.warn("[client] room leave during scene cleanup failed", err),
        );
    }
  }

  /**
   * §4 scene-reuse reset. Phaser destroys display objects on shutdown but retains this class instance, so
   * every run-owned reference, collection, clock, latch, and camera/net accumulator must return to its
   * declaration-time value before the replacement run builds anything.
   */
  private resetSceneState(): void {
    // Defensive as well as shutdown-driven: a direct create cannot inherit global listeners or a room.
    this.xpMotes?.destroy();
    this.beamRenderer?.destroy();
    this.ultimateVfx?.destroy();
    this.vastagharVfx?.destroy();
    this.damageNumberRenderer?.destroy();
    this.hitEffectRenderer?.destroy();
    this.combatFeedback?.reset();
    this.verbUi?.destroy();
    this.removeFeedbackSettingsListener?.();
    this.removeFeedbackSettingsListener = undefined;
    this.wormRig?.destroy();
    this.wormRig = null;
    this.vastagharShakeBudget.reset();
    for (const rig of this.petRigs.values()) rig.destroy();
    this.removeSceneListeners();
    this.leaveCurrentRoom();
    this.destroyPaperPagePool();
    this.clearLevelPaperCounters();

    // Entity, reconciliation, and event-history collections.
    this.blobs.clear();
    this.petRigs.clear();
    this.petOwnerHp.clear();
    this.petPickupEligibility.clear();
    this.enemies.clear();
    this.enemyPaperPriority.clear();
    this.paperDeaths.length = 0;
    this.closingPickups.clear();
    this.lastParried.clear();
    this.lastDodged.clear();
    this.lastRevived.clear();
    this.lastAttackSeq.clear();
    this.lastAttackHeld.clear();
    this.lastUltimateSeq.clear();
    this.lastUltimateArchetype.clear();
    this.beamFeedback.clear();
    this.beamFeedbackSeen.clear();
    this.telegraphCache.clear();
    this.telegraphForeshadows?.clear();
    this.enemyWindup.clear();
    this.enemyComboPresentation.clear();
    this.comboMarkerClaims.clear();
    this.meleeFullTells.clear();
    this.meleeFullTellNext.clear();
    this.meleeTellCandidates.length = 0;
    this.playerBufs.clear();
    this.enemyBufs.clear();
    this.snapFell.clear();
    this.enemyHp.clear();
    this.vastagharCrownCaught = false;
    this.enemyCrit.clear();
    this.enemyFlinches.clear();
    this.predictedMeleeContacts.length = 0;
    this.finalBlowPresentations.clear();
    this.finalDeltaTargets.clear();
    this.feedbackStopAt.clear();
    this.enemyAtk.clear();
    this.equipped.clear();
    this.equippedOffhand.clear();
    this.charOf.clear();
    this.pickups.clear();
    this.projectiles.clear();
    this.zones.clear();
    this.xpReceiptBatches.clear();
    this.lastFell.clear();
    this.jugglePresentation.clear();
    this.pendingArt.clear();
    this.pendingTomeArt.clear();
    // Failed/missing-art sets deliberately follow Phaser's game-wide texture cache, not a run.

    // Display-object/UI pools and handles. The previous objects are already destroyed by Phaser.
    this.poiSprites = [];
    this.dust.length = 0;
    this.floorObjs = [];
    this.levelWinObjects = [];
    this.levelWinChoices = [];
    this.summonObjects = [];
    this.carouselDock = undefined;
    this.arsenalTexts = [];
    this.arsenalPairArt = null;
    this.bagTexts = [];
    this.bagZones = [];
    this.bagTabZones = [];
    this.bagActionZone = null;
    this.bagRenderSignature = "";
    this.bagSelected = null;
    this.bagFocusCell = 0;
    this.bagWorkflow = "inventory";
    this.slotZones = [];
    this.pairSlotZones = [];
    this.bagPairZones = [];
    this.pairConfirmZone = null;
    this.unbindZone = null;
    this.pairCandidate = null;
    this.pairRequestLockedUntil = 0;
    this.lastPairKey = "";
    this.buyZones = [];
    this.bagArts = [];
    this.bagDisplayOrder = [];
    this.bagHoverCell = -1;
    this.bagPanelShown = false;
    this.bagPanelOpenAt = 0;
    this.bagPanelCloseAt = 0;
    this.vfxPlayer = undefined!;
    this.beamRenderer = undefined!;
    this.ultimateVfx = undefined as unknown as UltimateVfx;
    this.vastagharVfx = undefined as unknown as VastagharVfx;
    this.xpMotes = undefined!;
    this.damageNumberRenderer = undefined!;
    this.hitEffectRenderer = undefined!;
    this.combatFeedback = undefined!;
    this.telegraphGroundGfx = undefined!;
    this.telegraphGfx = undefined!;
    this.telegraphForeshadows = undefined!;
    this.parryGfx = undefined!;
    this.dustG = undefined;
    this.portalArrow = null;
    this.riftArrow = null;
    this.portalLocatorPulseUntil = -1;
    this.riftLocatorPulseUntil = -1;
    this.lastBossX = Number.NaN;
    this.lastBossY = Number.NaN;
    this.keys = undefined!;
    this.beltGate = null;
    this.beltBackdrop = null;
    this.beltClouds = null;
    this.dangerVignette = undefined!;
    this.juggleVignette = undefined!;
    this.verbUi = undefined;
    this.ownerNoteUi = undefined;
    this.ownerNoteKeyboardPaused = false;
    this.weaponText = undefined!;
    this.augmentText = undefined!;
    this.objectiveHudGfx = undefined!;
    this.objectiveText = undefined!;
    this.objectiveLocationText = undefined!;
    this.objectiveEconomyText = undefined!;
    this.objectiveNoticeText = undefined!;
    this.objectiveHudLayoutSig = "";
    this.objectiveProgressTop = 96;
    this.objectiveProgressWidth = 520;
    this.hpBarBg = undefined!;
    this.hpBarFill = undefined!;
    this.hpText = undefined!;
    this.xpBarBg = undefined!;
    this.xpBarFill = undefined!;
    this.driveHudGfx = undefined;
    this.driveHudText = undefined;
    this.ultimateHudGfx = undefined;
    this.ultimateHudText = undefined;
    this.levelText = undefined!;
    this.bossBarBg = undefined!;
    this.bossBarFill = undefined!;
    this.bossBarSegments = undefined!;
    this.bossText = undefined!;
    this.victoryText = undefined!;
    this.portal = undefined;
    this.rift = undefined;
    this.levelWinTimerBar = undefined;
    this.levelWinTimerText = undefined;
    this.levelWinStatusText = undefined;
    this.levelWinDim = undefined;
    this.levelWinLower = undefined;
    this.levelWinUpper = undefined;
    this.deathText = undefined!;
    this.restartBtn = undefined!;
    this.grabGfx = undefined!;
    this.grabPromptText = undefined!;
    this.dropBar = undefined;
    this.dropBarLabel = undefined;
    this.arsenalG = null;
    this.bagG = null;
    this.shopNpcG = null;
    this.shopPromptText = null;

    // Net/prediction, arena identity, clocks, one-shot latches, and camera state.
    this.lastParryPress = -9999;
    this.telegraphFrame = 0;
    this.bossTelegraphPose.active = false;
    this.bossTelegraphPose.id = "";
    this.bossTelegraphPose.score = -1;
    this.bossPoseRowId = "";
    this.bossPoseBeatMask = 0;
    this.beltLevel = null;
    this.lastBeltRoom = "";
    this.beltCloudDrift = 0;
    this.predictor = null;
    this.timeline.reset();
    this.inputAccMs = 0;
    this.jumpQueued = false;
    this.spaceGesture.reset();
    this.crouchHeld = false;
    this.poundQueued = false;
    this.slideQueued = false;
    this.slideDryWindowAt = -1e9;
    this.slideDryPresses = 0;
    this.slideDryToastShown = false;
    this.curDx = 0;
    this.curDy = 0;
    this.selfPredHeight = 0;
    this.selfPredVh = 0;
    this.selfPredStance = STANCE_NONE;
    this.selfPredSlidePhase = SLIDE_PHASE_OFF;
    this.selfPredSlideTick = 0;
    this.jumpPresentation.clear();
    this.wasFrozen = false;
    this.lastSelfMuzzleAt = -9999;
    this.beamPredictionStartSeq = -1;
    this.beamPredictionHeld = false;
    this.beamPredictionAccepted = false;
    this.beamPredictionAngle = 0;
    this.beamPredictionProgress = 0;
    this.beamPredictionFadeAt = -1;
    this.beamHelpShown = false;
    this.beamPredictionPending.length = 0;
    this.lastMintedInputSeq = 0;
    this.observedSelfFellSeq = 0;
    this.lastDamageReceiptKey = "";
    this.resetDeathRecap();
    this.recentResolvedDangerKind = "";
    this.recentResolvedDangerAt = -9999;
    this.hurtFlash = 0;
    this.jugglePulseUntil = -1e9;
    this.hpShown = -1;
    this.xpShown = -1;
    this.xpPulse = 0;
    this.xpAudioStreak = 0;
    this.xpAudioLastAt = -9999;
    this.xpReceiptLastAt = -9999;
    this.bossShown = -1;
    this.selfAim.x = 1;
    this.selfAim.y = 0;
    this.spectateId = "";
    this.camFrom = { x: 0, y: 0 };
    this.camBlend = 1;
    this.camFocus = null;
    this.pointerScreen.x = 0;
    this.pointerScreen.y = 0;
    this.pointerScreen.set = false;
    this.pointerMoves = 0;
    this.pointerOverInteractiveUi = false;
    this.prevSelfHp = -1;
    this.lastHurt = 0;
    this.localAtkCd = 0;
    this.localPredictedAttackSeq = 0;
    this.localParryCd = 0;
    this.parryChain = 0;
    this.parryChainAt = 0;
    this.frozenUntil = 0;
    this.animClock = 0;
    this.shakeUntil = 0;
    this.shakeIntensity = 0;
    this.ultimateExplosionShakeScale = 1;
    this.lastUltimateWeatherShakeAt = -1e9;
    this.freezeSpent = 0;
    this.freezeSpentAt = 0;
    this.lastKillStop = 0;
    this.feedbackStopMs = 0;
    this.feedbackStopTier = 0;
    this.feedbackStopCount = 0;
    this.feedbackFinalBlows = 0;
    this.feedbackShakeDuration = 0;
    this.feedbackShakeIntensity = 0;
    this.feedbackPunchX = 0;
    this.feedbackPunchY = 0;
    this.cameraPunchX = 0;
    this.cameraPunchY = 0;
    this.lastCameraPunchAt = -9999;
    this.deltaSec = 0;
    this.arenaMap = undefined;
    this.lastSeedKey = "";
    this.removalFxMuteUntil = 0;
    this.paperWorldFoldSeq = 0;
    this.paperPeakObjects = 0;
    this.prevHeldLoot = "";
    this.prevLevel = -1;
    this.bannerShownFor = "";
    this.bannerSlot = 0;
    this.lastBannerAt = -9999;
    this.prevBossPresent = false;
    this.prevWon = false;
    this.hudScale = -1;
    this.levelWinKey = "";
    this.levelWinMode = "";
    this.levelWinSelectionSent = false;
    this.levelWinInputReleaseLatch = false;
    this.levelWinFocus = 0;
    this.levelWinAwaitingRelease = true;
    this.levelWinTimerSampleDs = -1;
    this.summonOpen = false;
    this.summonCount = 1;
    this.summonTough = false;
    this.summonBossPage = 0;
    this.rHold = 0;
    this.rSalvaged = false;
    this.grabTarget = null;
    this.grabTargetId = "";
    this.grabRadius = PICKUP_RADIUS;
    this.bagOpen = false;
    this.shopOpen = false;
    this.lastScrip = -1;
    this.lastUpgradeSig = "";
    this.petManifest = undefined;
    this.petResultLine = "";
    this.lastPetReceiptKey = "";
    this.weaponManifest.clear();
    this.weaponManifestRunId = "";
    this.settlementResult = undefined;
    this.lastSettlementKey = "";
    this.syncedGearLoadouts.clear();
    this.driveLocked = false;
    this.ultimateCastPendingUntil = -1e9;
    this.ultimateHudPulseUntil = -1e9;
    this.queuedUltimateReveal = undefined;
    this.queuedUltimateTemper = false;
    this.ultimateRevealBusyUntil = -1e9;
    this.lastUltimateSelfLevel = -1;
  }

  /** §4 the single shutdown path for globals and network ownership. */
  private shutdownScene(): void {
    this.connectionGeneration++;
    this.xpMotes?.destroy();
    this.xpMotes = undefined!;
    this.beamRenderer?.destroy();
    this.beamRenderer = undefined!;
    this.ultimateVfx?.destroy();
    this.ultimateVfx = undefined as unknown as UltimateVfx;
    this.vastagharVfx?.destroy();
    this.vastagharVfx = undefined as unknown as VastagharVfx;
    this.damageNumberRenderer?.destroy();
    this.damageNumberRenderer = undefined!;
    this.hitEffectRenderer?.destroy();
    this.hitEffectRenderer = undefined!;
    this.combatFeedback?.reset();
    this.combatFeedback = undefined!;
    this.verbUi?.destroy();
    this.verbUi = undefined;
    this.removeFeedbackSettingsListener?.();
    this.removeFeedbackSettingsListener = undefined;
    this.wormRig?.destroy();
    this.wormRig = null;
    for (const rig of this.petRigs.values()) rig.destroy();
    this.petRigs.clear();
    this.petOwnerHp.clear();
    this.petPickupEligibility.clear();
    this.destroyPaperPagePool();
    this.clearLevelPaperCounters();
    this.removeSceneListeners();
    this.leaveCurrentRoom();
  }

  create(): void {
    this.resetSceneState();
    const connectionGeneration = ++this.connectionGeneration;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdownScene, this);
    void loadPetPartsManifest().then((manifest) => {
      if (connectionGeneration === this.connectionGeneration) this.petManifest = manifest;
    });

    // The themed floor (bed/grid/rail + pits/rim) is drawn in `maybeBuildFloor` once the server's seeds +
    // `dimensionId` sync — so it uses the ACTIVE §17 dimension's palette, not a guessed default.
    this.vfxPlayer = new VfxPlayer(this);
    this.beamRenderer = new BeamRenderer(this);
    this.ultimateVfx = new UltimateVfx(this, {
      actor: (ownerId, out) => {
        const rig = this.blobs.get(ownerId);
        if (!rig) return false;
        out.x = rig.root.x;
        out.y = rig.root.y;
        return true;
      },
      target: (targetId, out) => this.resolveFeedbackTarget(targetId, out),
      projectY: (worldY) => (this.belt ? this.beltY(worldY) : worldY),
      projectionYScale: () => (this.belt ? BELT_FORESHORTEN : 1),
      visible: (x, y) => this.cameras.main.worldView.contains(x, y),
      audio: (cue, x, amount) => this.audio.play(cue, { x, amt: amount }),
      arrival: (ownerId, clockMs) => this.blobs.get(ownerId)?.playSpawnUnfold(clockMs, 220),
      paperCopy: (ownerId, x, y) => this.blobs.get(ownerId)?.createPaperCopy(x, y),
      connectAccent: (family, _x, _y, stopMs) => {
        this.hitStop(stopMs, true);
        // Sunspite's authoritative explosion pack owns its one camera kick.
        if (family !== UltimateFamily.SunspiteComet)
          this.shakeCam(
            75,
            this.feedbackSettings.flashes === "reduced" ? 0.00225 : 0.0045,
            "world",
          );
      },
    });
    // §TELEGRAPH the exact, quality-invariant footprint sits with ground gameplay markings, not over actors.
    this.telegraphGroundGfx = this.add.graphics().setDepth(3);
    this.telegraphForeshadows = new TelegraphForeshadowPool(this);
    // Thin response boundaries and compact source cues stay above beams/XP, below HUD.
    this.telegraphGfx = this.add.graphics().setDepth(99997);
    // H10: the local player's parry-state ring. Just under the white-tell layer + above the bodies, so the
    // "ready vs recovering vs i-frames-up" read sits right on your own drifter.
    this.parryGfx = this.add.graphics().setDepth(99989);
    // The grab-highlight ring and prompt mark the pickup E will take (just under the parry ring).
    this.grabGfx = this.add.graphics().setDepth(99988);
    this.grabPromptText = this.add
      .text(0, 0, "[E] Pick up", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#fff0b0",
        fontStyle: "bold",
        backgroundColor: "#090805",
        padding: { x: 5, y: 3 },
      })
      .setOrigin(0.5, 1)
      .setDepth(99989)
      .setVisible(false);
    // §19 v0.108 low-HP danger vignette — a screen-space red edge glow (under HUD text), alpha 0 at rest.
    this.dangerVignette = this.add.graphics().setScrollFactor(0).setDepth(99998).setAlpha(0);
    // §51 victim-side juggle read: one retained cool-white edge. The shared verb manager owns the pooled
    // contextual label, so no hit allocates a HUD object or tween.
    this.juggleVignette = this.add.graphics().setScrollFactor(0).setDepth(99998).setAlpha(0);
    this.hurtFlash = 0;
    this.hpShown = -1;
    this.xpShown = -1;
    this.bossShown = -1;

    // §19 v0.108 audio — ONE AudioBus shared across scene re-entries via the game registry (so the
    // volume/mute setting + the live AudioContext survive a menu round-trip). Resumed on the first user
    // gesture below (autoplay policy).
    this.audio = (this.game.registry.get("audio") as AudioBus | undefined) ?? new AudioBus();
    this.game.registry.set("audio", this.audio);
    const settings = loadSettings();
    this.feedbackSettings = settings.feedback;
    this.beamRenderer.setColorblindAssist(settings.feedback.colorblindAssist);
    this.vastagharVfx = new VastagharVfx(this, {
      audio: (cue, x, amount) => this.audio.play(cue, { x, amt: amount }),
      pack: (name, x, y, radius) => playFxPack(this, name, x, y, { radius }),
      score: (state) => this.audio.setBossScore(state),
      duckScore: (db, durationSeconds) => this.audio.duckBossScore(db, durationSeconds),
      shake: (x, y, durationMs, intensity, tier, localThreatened) =>
        this.requestVastagharShake(x, y, durationMs, intensity, tier, localThreatened),
    });
    this.verbUi = new VerbLegendManager({
      scene: this,
      onboarding: settings.onboarding,
      persist: (onboarding) => updateSettings({ onboarding }),
      reducedMotion: prefersReducedPaperMotion(),
    });
    this.verbs.update(this.time.now, this.screenW(), this.screenH());
    this.verbs.showFirstRun(this.time.now);
    this.audio.setConfirmVolume(this.feedbackSettings.confirmVolume ?? 1, false);
    this.combatFeedback = new CombatFeedback();
    this.hitEffectRenderer = new HitEffectRenderer(this, (targetId, out) =>
      this.resolveFeedbackTarget(targetId, out),
    );
    this.jumpEffectRenderer = new JumpEffectRenderer(this);
    this.damageNumberRenderer = new DamageNumberRenderer(
      this,
      this.feedbackSettings,
      (targetId, out) => {
        if (!this.resolveFeedbackTarget(targetId, out)) return false;
        out.y -= 26;
        return true;
      },
      RENDER_DPR,
    );
    this.combatFeedback.subscribeContact((event) => this.onCombatFeedbackContact(event));
    this.combatFeedback.subscribeDamage((event) => this.onDamageNumberEvent(event));
    this.combatFeedback.subscribeConfirm((event) => {
      if (this.feedbackSettings.hitConfirmAudio) this.audio.play(event.cue, { amt: event.amount });
    });
    this.removeFeedbackSettingsListener = onSettingsChange((settings) => {
      this.feedbackSettings = settings.feedback;
      this.beamRenderer.setColorblindAssist(settings.feedback.colorblindAssist);
      this.setZoneAssistVisibility();
      this.audio.setConfirmVolume(settings.feedback.confirmVolume ?? 1, false);
      this.damageNumberRenderer.applySettings(settings.feedback);
    });
    this.xpMotes = new XpMoteRenderer(this, {
      target: (collectorId, out) => this.xpCatchPoint(collectorId, out),
      project: (x, y, out) => this.projectXpPoint(x, y, out),
      receipt: (event) => this.onXpReceipt(event),
    });

    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error("Keyboard input unavailable");
    this.keys = keyboard.addKeys(
      "W,A,S,D,R,P,Q,E,Z,X,F,G,H,T,B,C,M,TAB,ESC,SPACE,SHIFT,CTRL,ONE,TWO,THREE,FOUR,FIVE,LEFT,RIGHT,UP,DOWN,ENTER",
    ) as Record<
      | "W"
      | "A"
      | "S"
      | "D"
      | "R"
      | "P"
      | "Q"
      | "E"
      | "Z"
      | "X"
      | "F"
      | "G"
      | "H"
      | "T"
      | "B"
      | "C"
      | "M"
      | "TAB"
      | "ESC"
      | "SPACE"
      | "SHIFT"
      | "CTRL"
      | "ONE"
      | "TWO"
      | "THREE"
      | "FOUR"
      | "FIVE"
      | "LEFT"
      | "RIGHT"
      | "UP"
      | "DOWN"
      | "ENTER",
      Phaser.Input.Keyboard.Key
    >;
    // Tab would otherwise move browser focus off the canvas — capture it so the summon menu owns it.
    keyboard.addCapture("TAB");
    keyboard.addCapture("ESC");
    this.ownerNoteUi = new OwnerNoteOverlay({
      onSubmit: (context, note) => {
        this.room?.send("ownerNote", { type: context.type, note });
      },
      onClose: () => this.restoreOwnerNoteKeyboard(),
    });
    this.input.setDefaultCursor("crosshair");
    // Create/resume the AudioContext on the first real gesture (click or key) — the browser autoplay
    // policy blocks it otherwise. Idempotent + cheap, so wiring it to both is harmless.
    this.resumeAudioPointerHandler = () => this.audio.resume();
    this.resumeAudioKeyHandler = () => this.audio.resume();
    this.input.on("pointerdown", this.resumeAudioPointerHandler);
    keyboard.on("keydown", this.resumeAudioKeyHandler);

    // Read the cursor straight from the DOM for aiming. Phaser's pointer pipeline was dropping
    // mouse movement that *started* while a movement key was held; raw window listeners don't.
    this.pointerMoveHandler = (e: MouseEvent): void => {
      const rect = this.game.canvas.getBoundingClientRect();
      // §37 DPR FIX: game-space coords = CSS px × (internal buffer / CSS size). The §28 hi-DPI buffer is
      // window×RENDER_DPR displayed at CSS size (main.ts zoom=1/DPR), so the raw clientX/Y MUST be scaled —
      // unscaled, every cursor-derived point (projectile target tx/ty, the facing-flip line, quake epicenter)
      // landed short of the true cursor by the DPR factor on any scaled display (Windows 125%/150%, 4K).
      // Phaser's own pointer.x does this transform; this raw DOM listener (CODE-7 aim-freeze fix) didn't.
      const sx = rect.width > 0 ? this.scale.width / rect.width : 1;
      const sy = rect.height > 0 ? this.scale.height / rect.height : 1;
      this.pointerScreen.x = (e.clientX - rect.left) * sx;
      this.pointerScreen.y = (e.clientY - rect.top) * sy;
      this.pointerScreen.set = true;
      this.pointerMoves++;
    };
    // Capture phase so we see the event before Phaser's own canvas handler can consume it.
    window.addEventListener("pointermove", this.pointerMoveHandler, {
      passive: true,
      capture: true,
    });
    window.addEventListener("mousemove", this.pointerMoveHandler, {
      passive: true,
      capture: true,
    });
    // RMB fires the weapon (§9) — suppress the browser context menu on the canvas.
    this.contextMenuHandler = (e: MouseEvent) => e.preventDefault();
    this.game.canvas.addEventListener("contextmenu", this.contextMenuHandler);

    // §7 v0.105 de-clunk: NO setBounds. Phaser's per-frame bounds clamp uses origin-0.5 math, but this scene
    // renders with camera origin (0,0) + a RENDER_DPR zoom, so at DPR>1 it clamps max-scroll short by
    // viewW·(DPR−1)/2 — the local player walks off-screen near the right/bottom walls. `centerCam` already
    // does a correct zoom-aware arena clamp (and centres the field on 4K/ultrawide), so bounds are both
    // redundant AND the source of the hi-DPI edge bug. Leave scroll entirely to centerCam.
    this.cameras.main.setBackgroundColor("#17140f"); // dark earth beyond the arena
    // §28 hi-DPI: the camera viewport == the DPR-scaled drawing buffer; zooming by RENDER_DPR keeps the
    // visible world area identical (worldView stays the CSS size) but renders it at device resolution.
    // origin (0,0) so screen-space UI maps 1:1 to CSS coords (no centre-pivot shift); UI uses screenW/H.
    this.cameras.main.setZoom(RENDER_DPR).setOrigin(0, 0);

    // Keep the camera viewport == the canvas buffer as it resizes, re-applying the hi-DPI zoom.
    this.resizeHandler = (size: Phaser.Structs.Size) => {
      this.cameras.main.setSize(size.width, size.height);
      this.cameras.main.setZoom(RENDER_DPR).setOrigin(0, 0);
      this.drawVignette(); // §19 v0.108 re-fit the screen-space danger vignette to the new viewport
      this.drawJuggleVignette();
    };
    this.scale.on("resize", this.resizeHandler);

    this.buildHud();
    this.buildCarousel();
    this.drawVignette();
    this.drawJuggleVignette();
    // §19 v0.108 every run start feels intentional — a short black fade-in.
    this.cameras.main.fadeIn(420, 0, 0, 0);
    void this.connect(connectionGeneration);
  }

  /** §19 v0.108 (re)draw the low-HP DANGER vignette to the current screen size — four red edge gradients
   *  fading inward. One Graphics object; its `alpha` is what animates (driven in updateHud), so this only
   *  runs on build + resize (cheap). */
  private drawVignette(): void {
    const g = this.dangerVignette;
    if (!g) return;
    const w = this.screenW();
    const h = this.screenH();
    const band = Math.min(w, h) * 0.24;
    const red = 0xff2a1e;
    g.clear();
    g.fillGradientStyle(red, red, red, red, 0.85, 0.85, 0, 0); // top: opaque edge → clear inward
    g.fillRect(0, 0, w, band);
    g.fillGradientStyle(red, red, red, red, 0, 0, 0.85, 0.85); // bottom
    g.fillRect(0, h - band, w, band);
    g.fillGradientStyle(red, red, red, red, 0.85, 0, 0.85, 0); // left
    g.fillRect(0, 0, band, h);
    g.fillGradientStyle(red, red, red, red, 0, 0.85, 0, 0.85); // right
    g.fillRect(w - band, 0, band, h);
  }

  private drawJuggleVignette(): void {
    const g = this.juggleVignette;
    if (!g) return;
    const w = this.screenW();
    const h = this.screenH();
    const band = Math.min(w, h) * 0.1;
    const pale = 0xbfe8ff;
    g.clear();
    g.fillGradientStyle(pale, pale, pale, pale, 0.68, 0.68, 0, 0);
    g.fillRect(0, 0, w, band);
    g.fillGradientStyle(pale, pale, pale, pale, 0, 0, 0.68, 0.68);
    g.fillRect(0, h - band, w, band);
    g.fillGradientStyle(pale, pale, pale, pale, 0.68, 0, 0.68, 0);
    g.fillRect(0, 0, band, h);
    g.fillGradientStyle(pale, pale, pale, pale, 0, 0.68, 0, 0.68);
    g.fillRect(w - band, 0, band, h);
  }

  /** Screen-space UI width/height in CSS px (§28 hi-DPI). The camera viewport is the DPR-scaled buffer,
   *  so UI anchored to the screen edges must use `viewport / RENDER_DPR` — i.e. the visible CSS size. */
  private screenW(): number {
    return this.cameras.main.width / RENDER_DPR;
  }
  private screenH(): number {
    return this.cameras.main.height / RENDER_DPR;
  }

  /** §28 4K-widescreen UI scale. The HUD is authored at a 1× baseline (≈1600px wide); on bigger viewports it
   *  grows so fixed-px bars/text don't read tiny on a 4K/ultrawide panel, clamped to [1, 2.1] so a laptop
   *  keeps the baseline and a 4K never balloons. Drives `applyHudScale` (sizes) + the per-frame HUD layout. */
  private uiScale(): number {
    return Math.max(1, Math.min(2.1, this.screenW() / 1600));
  }

  /** Grow every HUD element to the current `uiScale` — bar sizes + font sizes. Called only when the scale
   *  actually changes (a resize), so per-frame `updateHud` stays cheap. Fill widths are re-derived each
   *  frame from the ratio × scaled base, so setting them here is just the initial full-width state. */
  private applyHudScale(s: number): void {
    this.hpBarBg.setSize(240 * s, 18 * s);
    this.hpBarFill.setSize(236 * s, 12 * s);
    this.xpBarBg.setSize(240 * s, 8 * s);
    this.xpBarFill.setSize(236 * s, 4 * s);
    this.bossBarBg.setSize(520 * s, 16 * s);
    this.bossBarFill.setSize(516 * s, 12 * s);
    this.hpText.setFontSize(12 * s);
    this.levelText.setFontSize(13 * s);
    this.weaponText.setFontSize(13 * s);
    this.augmentText.setFontSize(12 * s);
    this.objectiveText.setFontSize(Math.max(15, 16 * s));
    this.objectiveLocationText.setFontSize(Math.max(10, 11 * s));
    this.objectiveEconomyText.setFontSize(Math.max(10, 11 * s));
    this.objectiveNoticeText.setFontSize(Math.max(10, 11 * s));
    this.driveHudText?.setFontSize(Math.max(9, 10 * s));
    this.ultimateHudText?.setFontSize(9 * s);
    this.bossText.setFontSize(14 * s);
    this.restartBtn.setFontSize(14 * s);
    this.deathText.setFontSize(26 * s);
    this.victoryText.setFontSize(28 * s);
  }

  /** Screen-space HUD: HP bar + downed overlay (§20). Fixed to the camera (scrollFactor 0). */
  private buildHud(): void {
    this.hpBarBg = this.add
      .rectangle(0, 0, 240, 18, 0x22252b, 0.85)
      .setScrollFactor(0)
      .setOrigin(0, 0.5)
      .setStrokeStyle(2, 0x000000)
      .setDepth(100000);
    this.hpBarFill = this.add
      .rectangle(0, 0, 236, 12, 0x9cff3b)
      .setScrollFactor(0)
      .setOrigin(0, 0.5)
      .setDepth(100001);
    this.hpText = this.add
      .text(0, 0, "", { fontSize: "12px", color: "#E8E4D8", fontStyle: "bold" })
      .setScrollFactor(0)
      .setOrigin(0, 0.5)
      .setDepth(100002);

    // XP bar (thin, sits above the HP bar) + level badge (§12).
    this.xpBarBg = this.add
      .rectangle(0, 0, 240, 8, 0x1c2230, 0.85)
      .setScrollFactor(0)
      .setOrigin(0, 0.5)
      .setStrokeStyle(2, 0x000000)
      .setDepth(100000);
    this.xpBarFill = this.add
      .rectangle(0, 0, 236, 4, 0x6fd6ff)
      .setScrollFactor(0)
      .setOrigin(0, 0.5)
      .setDepth(100001);
    this.driveHudGfx = this.add.graphics().setScrollFactor(0).setDepth(100005);
    this.driveHudText = this.add
      .text(0, 0, "", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#d9fbff",
        fontStyle: "bold",
        align: "center",
      })
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(100006)
      .setVisible(false);
    this.ultimateHudGfx = this.add.graphics().setScrollFactor(0).setDepth(100005);
    this.ultimateHudText = this.add
      .text(0, 0, "", {
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#9fd9df",
        fontStyle: "bold",
      })
      .setScrollFactor(0)
      .setOrigin(1, 1)
      .setDepth(100006)
      .setVisible(false);
    this.levelText = this.add
      .text(0, 0, "", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#ffd479",
        fontStyle: "bold",
        backgroundColor: "#0a0805",
        padding: { x: 4, y: 2 },
      })
      .setScrollFactor(0)
      .setOrigin(0, 1)
      .setShadow(0, 1, "#000000", 2, true, true)
      .setResolution(Math.max(2, Math.ceil(RENDER_DPR)))
      .setDepth(100002);
    this.deathText = this.add
      .text(0, 0, "DOWNED — respawning…\n(click Restart Run, top-right)", {
        fontSize: "26px",
        color: "#FF5D5D",
        fontStyle: "bold",
        align: "center",
      })
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(100002)
      .setVisible(false);

    // Playtest control: restart the run. Top-right corner (R is now drop/salvage, §9/§13).
    this.restartBtn = this.add
      .text(0, 0, "⟳ Restart Run", {
        fontSize: "14px",
        color: "#E8E4D8",
        backgroundColor: "#3a4049",
        padding: { x: 9, y: 6 },
      })
      .setScrollFactor(0)
      .setOrigin(1, 0)
      .setDepth(100002)
      .setInteractive({ useHandCursor: true });
    this.restartBtn.on("pointerdown", () => {
      const room = this.room;
      if (!room) return;
      if (room.state.outcome === "active") {
        room.send("restart");
        return;
      }
      this.scene.pause();
      this.scene.launch("menu", {
        prestigeRoom: room,
        prestigeGameCleared: room.state.outcome === "victory",
      });
    });

    // §9/§13 drop/salvage hold bar — fills while R is held; release before full = drop, full = salvage.
    this.dropBar = this.add.graphics().setScrollFactor(0).setDepth(100003).setVisible(false);
    this.dropBarLabel = this.add
      .text(0, 0, "", {
        fontSize: "12px",
        color: "#ffe7a8",
        fontStyle: "bold",
        align: "center",
      })
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(100003)
      .setVisible(false);

    // Equipped-weapon readout (sits just above the HP bar).
    this.weaponText = this.add
      .text(0, 0, "", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#9cff3b",
        fontStyle: "bold",
        backgroundColor: "#0a0805",
        padding: { x: 4, y: 2 },
      })
      .setScrollFactor(0)
      .setOrigin(0, 1)
      .setShadow(0, 1, "#000000", 2, true, true)
      .setResolution(Math.max(2, Math.ceil(RENDER_DPR)))
      .setDepth(100002);

    // §8 owned parry-augment readout (sits just above the weapon readout).
    this.augmentText = this.add
      .text(0, 0, "", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#b07bd6",
        fontStyle: "bold",
        backgroundColor: "#0a0805",
        padding: { x: 4, y: 2 },
      })
      .setScrollFactor(0)
      .setOrigin(0, 1)
      .setShadow(0, 1, "#000000", 2, true, true)
      .setResolution(Math.max(2, Math.ceil(RENDER_DPR)))
      .setDepth(100002);

    // Finding #11: retained top HUD = objective/progress, session-vital chips, and a resolving notice chip.
    // Every glyph rides a dark plate; objective copy is width-bound and may use at most two lines.
    this.objectiveHudGfx = this.add.graphics().setScrollFactor(0).setDepth(100000);
    const objectiveResolution = Math.max(2, Math.ceil(RENDER_DPR));
    this.objectiveText = this.add
      .text(0, 0, "", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#f1e8cf",
        fontStyle: "bold",
        align: "center",
        maxLines: 2,
      })
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setShadow(0, 1, "#000000", 2, true, true)
      .setResolution(objectiveResolution)
      .setDepth(100002);
    const chipStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: "monospace",
      fontSize: "11px",
      color: "#cfc6ae",
      fontStyle: "bold",
      align: "center",
      maxLines: 1,
    };
    const buildChipText = (color: string) =>
      this.add
        .text(0, 0, "", { ...chipStyle, color })
        .setScrollFactor(0)
        .setOrigin(0.5)
        .setShadow(0, 1, "#000000", 2, true, true)
        .setResolution(objectiveResolution)
        .setDepth(100002);
    this.objectiveLocationText = buildChipText("#cfc6ae");
    this.objectiveEconomyText = buildChipText("#d9c78f");
    this.objectiveNoticeText = buildChipText("#ffb26b").setVisible(false);

    // Boss health bar (§16) — a wide bar under a name plate at the top, shown only during the fight.
    this.bossBarBg = this.add
      .rectangle(0, 0, 520, 16, 0x2a1414, 0.9)
      .setScrollFactor(0)
      .setOrigin(0.5, 0)
      .setStrokeStyle(2, 0x000000)
      .setDepth(100001)
      .setVisible(false);
    this.bossBarFill = this.add
      .rectangle(0, 0, 516, 12, 0xff5d3b)
      .setScrollFactor(0)
      .setOrigin(0, 0.5)
      .setDepth(100002)
      .setVisible(false);
    // §16 v0.116 Polish B — phase-threshold ticks over the bar (drawn in run-space; positioned each frame).
    this.bossBarSegments = this.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(100002)
      .setVisible(false);
    this.bossText = this.add
      .text(0, 0, "OLD RUST", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#ffb23b",
        fontStyle: "bold",
        backgroundColor: "#0a0805",
        padding: { x: 5, y: 2 },
      })
      .setScrollFactor(0)
      .setOrigin(0.5, 1)
      .setShadow(0, 1, "#000000", 2, true, true)
      .setResolution(Math.max(2, Math.ceil(RENDER_DPR)))
      .setDepth(100002)
      .setVisible(false);

    // Victory banner (§16) — shown once a player extracts. §6 v0.103: the LIVE text (depth reached +
    // total banked) is set in updateRunState; this is just the placeholder styling.
    this.victoryText = this.add
      .text(0, 0, "", {
        fontSize: "28px",
        color: "#ffd479",
        fontStyle: "bold",
        align: "center",
      })
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(100003)
      .setVisible(false);
  }

  /** Render weapon pickups — a FANCY faux-3D display: the weapon spins on its vertical axis (scaleX
   *  through 0 = a 3D-ish turn), floats with a rarity-tinted glow + light beam + ground halo, and throws
   *  a bright SHINE glint each time it rotates to face the player. (True polygonal 3D would need a
   *  separate renderer + clash with the flat art; this reads as the fancy-shiny pickup Mike wants.) */
  private syncPickups(): void {
    if (!this.room) return;
    const TAU = Math.PI * 2;
    const ADD = Phaser.BlendModes.ADD;
    const state = this.room.state.pickups;
    const reducedMotion = prefersReducedPaperMotion();
    state.forEach((pk, id) => {
      const existing0 = this.pickups.get(id);
      if (existing0) {
        const renderedWeapon = existing0.getData("pickupWeapon") as string | undefined;
        if (id.startsWith("pk:") && renderedWeapon !== pk.weaponPublic) {
          this.destroyPickup(existing0);
          this.pickups.delete(id);
        } else {
          // §41 lazy-art RETRO-UPGRADE: a pickup built while its weapon art was still loading rendered the
          // tier-bundle fallback FOREVER (a fresh showroom page of 42 expansion weapons showed all blobs —
          // "assets missing"). Once the texture lands, rebuild the pickup with its real art.
          const wantArt = existing0.getData("pendingArt") as string | undefined;
          const wantRole = SPRITES[wantArt as keyof typeof SPRITES]?.parts[0]?.role;
          if (
            !wantArt ||
            !wantRole ||
            !this.textures.exists(partTexture(this, wantArt, wantRole).key)
          ) {
            return;
          }
          this.destroyPickup(existing0);
          this.pickups.delete(id); // fall through — recreated below with the loaded art
        }
      }
      const isGallery = id.startsWith("pk:");
      const isMystery = !pk.known;
      const weapon = pk.weaponPublic;
      const manifest = SPRITES[weapon as keyof typeof SPRITES];
      const def = WEAPONS[weapon];
      // §10/§13 v0.104 LOOT identity: a MYSTERY drop (known=false) telegraphs TYPE + RARITY but hides
      // which weapon until grabbed; a known pickup with rolled rarity shows its tier color + affix.
      // Cursed = the ghostly-purple gamble cue (§10), pulsing so it reads as "knowingly haunted".
      const rarity = RARITIES[pk.rarity] ?? {
        name: "Common",
        color: 0x9aa5b1,
        dmg: 1,
        weight: 0,
        salvage: 1,
        id: "common",
      };
      // A KNOWN pickup renders its real art — but an expansion weapon's parts lazy-load at runtime, so
      // fall back to the tier-tinted bundle (with the true name label) until/unless the art exists.
      const part = isMystery || !this.ensureWeaponArt(weapon) ? undefined : manifest?.parts[0];
      const accent =
        isMystery || pk.rarity > 0 ? rarity.color : (WEAPON_ACCENT[weapon] ?? 0xffd479);
      const accentHex = `#${accent.toString(16).padStart(6, "0")}`;
      const baseScale = part ? 72 / part.w : 1;

      const beam = this.add.rectangle(0, -10, 34, 104, accent, 0.08).setBlendMode(ADD); // pedestal light
      const halo = this.add.ellipse(0, 30, 100, 34, accent, 0.22).setBlendMode(ADD); // ground glow
      const glow = this.add.ellipse(0, 0, 78, 78, accent, 0.32).setBlendMode(ADD);
      const edge = this.add.rectangle(0, 0, 2, 44, 0xffffff, 0).setBlendMode(ADD);
      const tx = part ? partTexture(this, weapon, part.role) : null;
      // Mystery = a rarity-tinted sealed ORB (+ "?"), NOT the weapon art. A circle spins cleanly under
      // the faux-3D scaleX tween (a rotated rect collapsed into a diagonal sliver — verify finding).
      const img =
        part && tx
          ? this.add.image(0, 0, tx.key, tx.frame).setScale(baseScale)
          : this.add.circle(0, 0, 20, accent, 0.9).setStrokeStyle(2, 0x1a1410, 0.6);
      const mysteryMark = isMystery
        ? this.add
            .text(0, 0, "?", {
              fontSize: "22px",
              color: "#1a1410",
              fontStyle: "bold",
            })
            .setOrigin(0.5)
        : null;
      const shine =
        part && tx
          ? this.add
              .image(0, 0, tx.key, tx.frame)
              .setScale(baseScale)
              .setTint(0xffffff)
              .setTintMode(Phaser.TintModes.FILL)
              .setBlendMode(ADD)
              .setAlpha(0)
          : null;
      // Label: mystery → tier + weapon CLASS glyph (type is telegraphed, identity isn't); known → name
      // (+ its rolled affix). §13 "type + rarity via visual cues but not exactly which weapon."
      const weaponClass = isMystery ? pk.weaponClass : def?.tags.classPool;
      const classGlyph = weaponClass === "ranged" ? "➶" : weaponClass === "caster" ? "✦" : "⚔";
      const affixName = pk.affixPublic ? affixById(pk.affixPublic).name : "";
      const galleryIndex = Number(id.split(":", 5)[3]);
      const galleryPlate = `#${String(Number.isInteger(galleryIndex) ? galleryIndex + 1 : 1).padStart(2, "0")}`;
      const labelText = isMystery
        ? `${rarity.name} ${classGlyph}`
        : `${def?.name ?? weapon}${affixName ? ` · ${affixName}` : ""}${pk.rarity > 0 ? ` (${rarity.name})` : ""}`;
      const label = this.add
        .text(0, 42, isGallery ? galleryPlate : labelText, {
          fontSize: "14px",
          color: accentHex,
          fontStyle: "bold",
          align: "center",
          backgroundColor: isGallery ? "#090805" : undefined,
          padding: isGallery ? { x: 4, y: 2 } : undefined,
          wordWrap: isGallery ? { width: 132, useAdvancedWrap: true } : undefined,
        })
        .setOrigin(0.5);
      const spinnerKids: Phaser.GameObjects.GameObject[] = [glow, img, edge];
      if (shine) spinnerKids.push(shine);
      if (mysteryMark) spinnerKids.push(mysteryMark);
      const spinner = this.add.container(0, 0, spinnerKids);
      const container = this.add.container(pk.x, pk.y, [beam, halo, spinner, label]).setDepth(2);
      container.setData({
        spinner,
        spinImg: img,
        spinGlow: glow,
        spinShine: shine,
        spinEdge: edge,
        mysteryMark,
        pickupLabel: label,
        pickupLabelShort: isGallery ? galleryPlate : labelText,
        pickupLabelFull: labelText,
        pickupWeapon: pk.weaponPublic,
        baseScale,
        spinTheta: 0,
      });
      if (!reducedMotion) {
        const spawnTween = this.tweens.addCounter({
          from: 0,
          to: 220,
          duration: 220,
          onUpdate: (tw) => {
            const elapsed = tw.getValue() ?? 0;
            spinner.scaleX = paperPopScaleX(elapsed, 220);
            spinner.scaleY = paperPopScaleY(elapsed, 220);
            spinner.rotation = paperPopRotation(elapsed, 220);
          },
          onComplete: () => {
            spinner.setScale(1).setRotation(0);
            container.setData("spawnTween", undefined);
          },
        });
        container.setData("spawnTween", spawnTween);
      }
      // §41 built with the fallback while the art is still lazy-loading → tag it so the sync pass rebuilds
      // this pickup with its real art the moment the texture lands (see the retro-upgrade above).
      if (!isMystery && manifest && !part && !this.failedArt.has(weapon)) {
        container.setData("pendingArt", weapon);
      }
      // §10 cursed gamble cue: the whole pickup breathes a ghostly fade — haunted, and it knows you know.
      if (pk.rarity === RARITY_CURSED) {
        this.tweens.add({
          targets: container,
          alpha: 0.45,
          duration: 950,
          yoyo: true,
          repeat: -1,
          ease: "Sine.inOut",
        });
      }

      this.tweens.add({
        targets: spinner,
        y: -14,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: "Sine.inOut",
      });
      this.tweens.add({
        targets: halo,
        scaleX: 1.14,
        scaleY: 1.14,
        alpha: 0.34,
        duration: 1100,
        yoyo: true,
        repeat: -1,
        ease: "Sine.inOut",
      });
      if (!reducedMotion) {
        const spinTween = this.tweens.addCounter({
          from: 0,
          to: TAU,
          duration: 1700,
          repeat: -1,
          onUpdate: (tw) => {
            const theta = tw.getValue() ?? 0;
            const c = Math.cos(theta);
            const edgeAlpha = paperClamp01((0.12 - Math.abs(c)) / 0.12) * 0.9;
            container.setData("spinTheta", theta);
            img.scaleX = baseScale * c; // faux-3D Y-axis spin (squashes through edge-on)
            glow.setScale(0.85 + 0.2 * Math.abs(c), 1);
            edge.setAlpha(edgeAlpha).setScale(1, 0.75 + 0.25 * Math.abs(Math.sin(theta)));
            if (mysteryMark) {
              mysteryMark.scaleX = Math.max(0.04, Math.abs(c));
              mysteryMark.setAlpha(Math.max(0, c));
            }
            if (shine) {
              shine.scaleX = baseScale * c;
              shine.setAlpha(Math.max(0, c) ** 5 * 0.75); // bright glint as it turns to face you
            }
          },
        });
        // §41 pickup spin owns a COUNTER tween whose target is Phaser's private `{ value }`, not the visible
        // Container — destroying the pickup cannot auto-prune it. Keep the handle on the owner for both exits.
        container.setData("spinTween", spinTween);
      }
      this.pickups.set(id, container);
    });
    for (const id of this.pickups.keys()) {
      if (!state.has(id)) {
        const pickup = this.pickups.get(id);
        if (pickup) this.beginPickupExit(pickup);
        this.pickups.delete(id);
      }
    }
  }

  /** §41 destroy a pickup AND its plain-object spin counter; Phaser cannot infer that ownership itself. */
  private destroyPickup(pickup: Phaser.GameObjects.Container): void {
    this.closingPickups.delete(pickup);
    for (const key of ["spawnTween", "spinTween", "exitTween"]) {
      const tween = pickup.getData(key) as Phaser.Tweens.Tween | undefined;
      if (tween) {
        tween.stop();
        tween.remove();
      }
    }
    pickup.destroy();
  }

  /** Authoritative removal folds only the inner art/label; the pickup target ring was already removed. */
  private beginPickupExit(pickup: Phaser.GameObjects.Container): void {
    if (this.closingPickups.has(pickup)) return;
    const visible = Phaser.Geom.Rectangle.Contains(this.cameras.main.worldView, pickup.x, pickup.y);
    if (
      prefersReducedPaperMotion() ||
      !visible ||
      this.closingPickups.size >= PAPER_PICKUP_EXIT_BUDGET
    ) {
      this.destroyPickup(pickup);
      return;
    }

    for (const key of ["spawnTween", "spinTween"]) {
      const tween = pickup.getData(key) as Phaser.Tweens.Tween | undefined;
      if (tween) {
        tween.stop();
        tween.remove();
        pickup.setData(key, undefined);
      }
    }
    const spinner = pickup.getData("spinner") as Phaser.GameObjects.Container;
    const img = pickup.getData("spinImg") as Phaser.GameObjects.Image | Phaser.GameObjects.Arc;
    const glow = pickup.getData("spinGlow") as Phaser.GameObjects.Arc;
    const shine = pickup.getData("spinShine") as Phaser.GameObjects.Image | null;
    const edge = pickup.getData("spinEdge") as Phaser.GameObjects.Rectangle;
    const mysteryMark = pickup.getData("mysteryMark") as Phaser.GameObjects.Text | null;
    const label = pickup.getData("pickupLabel") as Phaser.GameObjects.Text;
    const baseScale = pickup.getData("baseScale") as number;
    const theta0 = (pickup.getData("spinTheta") as number | undefined) ?? 0;
    const theta1 = Math.PI / 2 + (Math.floor((theta0 - Math.PI / 2) / Math.PI) + 1) * Math.PI;
    spinner.setScale(1).setRotation(0);
    const labelCenterY = label.y;
    label.setOrigin(0.5, 0).setY(labelCenterY - label.height * 0.5);
    this.closingPickups.add(pickup);
    this.paperPeakObjects = Math.max(
      this.paperPeakObjects,
      this.paperDeaths.length + this.closingPickups.size + (this.paperWorldFold ? 4 : 0),
    );
    const exitTween = this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 120,
      onUpdate: (tw) => {
        const q = paperSmoothstep(tw.getValue() ?? 0);
        const theta = theta0 + (theta1 - theta0) * q;
        const c = Math.cos(theta);
        img.scaleX = baseScale * c;
        glow.setScale(0.85 + 0.2 * Math.abs(c), 1);
        edge
          .setAlpha(paperClamp01((0.12 - Math.abs(c)) / 0.12) * 0.9)
          .setScale(1, 0.75 + 0.25 * Math.abs(Math.sin(theta)));
        if (shine) {
          shine.scaleX = baseScale * c;
          shine.setAlpha(Math.max(0, c) ** 5 * 0.75);
        }
        if (mysteryMark) {
          mysteryMark.scaleX = Math.max(0.04, Math.abs(c));
          mysteryMark.setAlpha(Math.max(0, c));
        }
        label.scaleY = 1 - q;
      },
      onComplete: () => {
        pickup.setData("exitTween", undefined);
        this.destroyPickup(pickup);
      },
    });
    pickup.setData("exitTween", exitTween);
  }

  /** Make each player rig hold the weapon its authoritative state says it has (re-equip on change). */
  /** Queue an optional painted open-book companion without making closed weapon readiness depend on it. */
  private ensureTomeOpenArt(spriteId: string): void {
    const art = tomeOpenArtFor(spriteId);
    if (
      !art ||
      this.textures.exists(art.textureKey) ||
      this.failedTomeArt.has(spriteId) ||
      this.pendingTomeArt.has(spriteId)
    )
      return;
    this.pendingTomeArt.add(spriteId);
    this.load.image(art.textureKey, art.url);
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      this.pendingTomeArt.delete(spriteId);
      if (!this.textures.exists(art.textureKey)) {
        this.failedTomeArt.add(spriteId);
        console.warn(`[dd] optional open tome art failed to lazy-load: ${spriteId}`);
      }
    });
  }

  /** §13 v0.104 lazy-load a weapon's sliced parts at RUNTIME (the +300 expansion arsenal is not
   *  boot-loaded — a mystery drop is the first time the client learns it needs this art). Returns true
   *  when the art is ready; false while the load is in flight (caller retries next frame — equipWeapons
   *  and syncPickups both re-run per frame, so the art pops in within a beat). */
  private ensureWeaponArt(spriteId: string): boolean {
    const manifest = SPRITES[spriteId as keyof typeof SPRITES];
    if (!manifest) return false;
    const first = manifest.parts[0];
    if (!first) return false;
    const allPartsReady = manifest.parts.every((part) => {
      const tx = partTexture(this, spriteId, part.role);
      return this.textures.exists(tx.key);
    });
    if (allPartsReady) {
      const wasPending = this.pendingTomeArt.has(spriteId);
      this.ensureTomeOpenArt(spriteId);
      if (!wasPending && this.pendingTomeArt.has(spriteId)) this.load.start();
      return true;
    }
    if (this.failedArt.has(spriteId)) return false; // 404'd — don't retry forever
    if (!this.pendingArt.has(spriteId)) {
      this.pendingArt.add(spriteId);
      for (const part of manifest.parts) {
        this.load.image(`${spriteId}:${part.role}`, `sprites/${spriteId}/${part.file}`);
      }
      this.ensureTomeOpenArt(spriteId);
      // A missing file (packaging drift) must not stall the equip loop forever: mark the sprite FAILED so
      // equipWeapons falls through to empty hands (the weapon still works — it's just not drawn in hand).
      this.load.once(Phaser.Loader.Events.COMPLETE, () => {
        if (manifest.parts.some((part) => !this.textures.exists(`${spriteId}:${part.role}`))) {
          this.failedArt.add(spriteId);
          console.warn(`[dd] weapon art failed to lazy-load: ${spriteId}`);
        }
      });
      this.load.start(); // Phaser allows queueing loads after boot; fires normally
    }
    return false;
  }

  private equipWeapons(): void {
    if (!this.room) return;
    this.room.state.players.forEach((player, id) => {
      const rig = this.blobs.get(id);
      if (!rig) return;
      const previousWeaponId = this.equipped.get(id);
      const previousOffhandWeaponId = this.equippedOffhand.get(id) ?? "";
      // REFLECTION LAW: decoded client rows have no root-level offhandSlot/pairBaseSeq compatibility getters.
      const offhandSlot = player.dualWield?.offhandSlot ?? 255;
      const offhandRow =
        offhandSlot !== 255 && offhandSlot !== player.activeSlot
          ? player.slots[offhandSlot]
          : undefined;
      const offhandWeaponId =
        offhandRow?.weapon && offhandRow.weapon !== player.weapon ? offhandRow.weapon : "";
      const def = WEAPONS[player.weapon];
      // §6 a weapon may borrow another's sprite as placeholder art (e.g. the Gravedigger's Spade) via `sprite`.
      const spriteId = def ? weaponDisplaySpriteId(def) : player.weapon;
      const manifest = SPRITES[spriteId as keyof typeof SPRITES];
      const offhandDef = offhandWeaponId ? WEAPONS[offhandWeaponId] : undefined;
      const offhandSpriteId = offhandDef ? weaponDisplaySpriteId(offhandDef) : offhandWeaponId;
      const offhandManifest = offhandWeaponId
        ? SPRITES[offhandSpriteId as keyof typeof SPRITES]
        : undefined;
      const offhandRenderable =
        !!offhandWeaponId &&
        !!offhandDef &&
        !!offhandManifest &&
        !this.failedArt.has(offhandSpriteId);
      const identitiesStable =
        previousWeaponId === player.weapon && previousOffhandWeaponId === offhandWeaponId;
      const heldLeadMatches = rig.heldWeaponDef(0)?.id === player.weapon;
      const heldOffMatches = offhandRenderable
        ? rig.heldWeaponDef(1)?.id === offhandWeaponId
        : def?.dual || def?.glovePair
          ? rig.heldWeaponDef(1)?.id === player.weapon
          : !rig.heldWeaponDef(1);
      const retryingLazyArt =
        identitiesStable &&
        !!def &&
        !!manifest &&
        !this.failedArt.has(spriteId) &&
        (!heldLeadMatches || !heldOffMatches) &&
        (rig.weaponSwapPending ||
          this.pendingArt.has(spriteId) ||
          (!!offhandWeaponId && this.pendingArt.has(offhandSpriteId)));
      if (offhandWeaponId) {
        rig.setDualWieldBaseSeq(player.dualWield?.pairBaseSeq ?? 0);
      }
      if (identitiesStable && !retryingLazyArt) return;
      if (!identitiesStable) {
        if (previousWeaponId) {
          const previousLoadoutId = previousOffhandWeaponId
            ? `${previousWeaponId}|${previousOffhandWeaponId}`
            : previousWeaponId;
          const nextLoadoutId = offhandWeaponId
            ? `${player.weapon}|${offhandWeaponId}`
            : player.weapon;
          rig.beginWeaponSwap(previousLoadoutId, nextLoadoutId, this.animClock);
        }
        // Identity truth advances before lazy-art retries. A -> B(lazy) -> A must replace B's pending
        // transition instead of comparing A with A forever while the rig remains empty-handed.
        this.equipped.set(id, player.weapon);
        this.equippedOffhand.set(id, offhandWeaponId);
      }
      if (def && manifest && !this.failedArt.has(spriteId)) {
        // §13 v0.104 expansion art loads on demand for BOTH linked rows. The rig converges only once every
        // required hand is ready, so a lazy off-hand cannot accidentally complete the draw as a single stance.
        const offhandArtReady =
          !offhandWeaponId ||
          !offhandDef ||
          !offhandManifest ||
          this.failedArt.has(offhandSpriteId) ||
          this.ensureWeaponArt(offhandSpriteId);
        if (!this.ensureWeaponArt(spriteId)) {
          // §7 v0.105 de-clunk: don't keep drawing + SWINGING the OLD weapon while the new art loads (the rig
          // was mid-swap running the stale weapon's timing during the loot celebration). Drop to the new
          // weapon's empty-hands pose now; the sprite pops in a beat later once its art lands.
          rig.unequip(def, true);
          return;
        }
        if (!offhandArtReady) {
          rig.unequip(def, true);
          return;
        }
        if (
          offhandWeaponId &&
          offhandDef &&
          offhandManifest &&
          !this.failedArt.has(offhandSpriteId)
        ) {
          rig.equipLoadout(
            { spriteId, def, manifest, partIndex: 0 },
            {
              spriteId: offhandSpriteId,
              def: offhandDef,
              manifest: offhandManifest,
              partIndex: 0,
            },
            player.dualWield?.pairBaseSeq ?? 0,
          );
        } else {
          rig.equipWeapon(spriteId, def, manifest);
        }
        rig.setAttackBeat(
          player.attackSeq,
          player.attackHeld,
          this.attackClientEpoch(player.attackTick, id !== this.room?.sessionId),
        );
      } else if (def) {
        rig.unequip(def, !!previousWeaponId); // §9 fists / missing-art fallback / no held sprite → empty hands
        rig.finishWeaponSwapWithoutArt();
      }
    });
  }

  /** Invert the existing delayed server-timeline mapper so an authoritative tick becomes a scene-clock
   *  epoch. Remote poses deliberately include INTERP_DELAY_MS: their attack meets the interpolated body at
   *  the same rendered tick. The rare unpredicted local fallback removes that delay. */
  private attackClientEpoch(attackTick: number, remote: boolean): number {
    const now = this.time.now;
    if (!this.timeline.ready) return now;
    const epoch = now + attackTick * TICK_MS - this.timeline.renderTime(now);
    return remote ? epoch : epoch - INTERP_DELAY_MS;
  }

  /** Route each accepted player attack exactly once. The owner predicts first and consumes its synced edge
   *  as confirmation; observers reconstruct the immutable descriptor from synced weapon/affix and start the
   *  remote rig on the mapped acceptance epoch. */
  private routePlayerAttacks(): void {
    const room = this.room;
    if (!room) return;
    const selfId = room.sessionId;
    room.state.players.forEach((player, id) => {
      const rig = this.blobs.get(id);
      if (!rig) return;
      const seq = player.attackSeq >>> 0;
      const previous = this.lastAttackSeq.get(id);
      const previousHeld = this.lastAttackHeld.get(id);
      const remote = id !== selfId;

      if (previous === undefined) {
        this.lastAttackSeq.set(id, seq);
        this.lastAttackHeld.set(id, player.attackHeld);
        if (!remote) this.localPredictedAttackSeq = seq;
        const epoch = this.attackClientEpoch(player.attackTick, remote);
        rig.setAttackBeat(seq, player.attackHeld, epoch);
        // A join can land inside the short authoritative latch. Let a newly-observed remote catch up to the
        // live pose, but never manufacture a second owner swing on scene attach.
        if (!remote || !player.attackHeld || seq === 0) return;
        this.triggerAcceptedRigAttack(rig, player, epoch);
        return;
      }

      const seqChanged = previous !== seq;
      const heldChanged = previousHeld !== player.attackHeld;
      if (!seqChanged && !heldChanged) return;
      this.lastAttackHeld.set(id, player.attackHeld);
      const epoch = this.attackClientEpoch(player.attackTick, remote);
      rig.setAttackBeat(seq, player.attackHeld, epoch);
      if (!seqChanged) return;
      this.lastAttackSeq.set(id, seq);

      if (!remote) {
        const confirmed = (seq - previous) >>> 0;
        const predicted = (this.localPredictedAttackSeq - previous) >>> 0;
        const predictionCovers = confirmed > 0 && predicted < 0x80000000 && confirmed <= predicted;
        if (predictionCovers) return;
        // This can happen after reconnect/state bootstrap or if another local action path lacked prediction.
        this.localPredictedAttackSeq = seq;
      }
      this.triggerAcceptedRigAttack(rig, player, epoch);
    });
  }

  /** Consume the dual-purpose uint16 seq: READY is classified from the post-edge authoritative row. */
  private routeUltimates(): void {
    const room = this.room;
    if (!room) return;
    const selfId = room.sessionId;
    room.state.players.forEach((player, id) => {
      const row = player.ultimate;
      const code = row.archetype;
      const oldCode = this.lastUltimateArchetype.get(id) ?? 0;
      if (id === selfId && oldCode === 0 && code !== 0) {
        this.queuedUltimateReveal = ultimateRevealDescriptor(code);
      }
      this.lastUltimateArchetype.set(id, code);

      if (id === selfId) {
        if (
          this.lastUltimateSelfLevel >= 0 &&
          this.lastUltimateSelfLevel < 11 &&
          player.level >= 11 &&
          code !== 0
        ) {
          this.queuedUltimateTemper = true;
        }
        this.lastUltimateSelfLevel = player.level;
      }

      const seq = row.seq & 0xffff;
      const previous = this.lastUltimateSeq.get(id);
      const edge = ultimateSeqEdge(previous, seq, row.charge, row.phase);
      this.lastUltimateSeq.set(id, seq);
      if (previous === undefined) {
        // A late join still receives a live cast's complete epoch-driven presentation.
        if (row.phase !== UltimatePhase.Idle)
          this.ultimateVfx.cueCast({
            ownerId: id,
            seq,
            code,
            phase: row.phase,
            startTick: row.startTick,
            resolveTick: row.resolveTick,
            endTick: row.endTick,
            targetX: row.targetX,
            targetY: row.targetY,
            originX: this.blobs.get(id)?.x ?? player.x,
            originY: this.ultimateActorWorldY(id, player.y),
            isSelf: id === selfId,
            nowMs: this.time.now,
          });
        return;
      }
      if (edge === "ready") {
        if (id === selfId) {
          this.audio.play("ult:ready");
          this.offerContextHint("ultimateReady");
        }
        return;
      }
      if (edge !== "cast") return;
      if (id === selfId) this.ultimateCastPendingUntil = -1e9;
      this.ultimateVfx.cueCast({
        ownerId: id,
        seq,
        code,
        phase: row.phase,
        startTick: row.startTick,
        resolveTick: row.resolveTick,
        endTick: row.endTick,
        targetX: row.targetX,
        targetY: row.targetY,
        originX: this.blobs.get(id)?.x ?? player.x,
        originY: this.ultimateActorWorldY(id, player.y),
        isSelf: id === selfId,
        nowMs: this.time.now,
      });
    });
  }

  private ultimateActorWorldY(id: string, fallback: number): number {
    const renderedY = this.blobs.get(id)?.y;
    if (renderedY === undefined) return fallback;
    return this.belt ? BELT_Y0 + (renderedY - BELT_Y0) / BELT_FORESHORTEN : renderedY;
  }

  private maybePlayUltimateReveal(self: PlayerState | undefined): void {
    const pending = !!this.queuedUltimateReveal || this.queuedUltimateTemper;
    if (
      !canReleaseUltimateReveal(
        pending,
        this.inLevelWindow(self),
        this.levelWinInputReleaseLatch || this.verbs.isModalBlocking(),
        !!self?.alive,
      ) ||
      this.time.now < this.ultimateRevealBusyUntil
    )
      return;
    if (this.queuedUltimateReveal) {
      const reveal = this.queuedUltimateReveal;
      this.queuedUltimateReveal = undefined;
      playUltimateReveal(this, this.screenW(), this.screenH(), reveal, prefersReducedPaperMotion());
      this.audio.play("ult:unlock");
      this.ultimateRevealBusyUntil = this.time.now + 1_900;
      return;
    }
    this.queuedUltimateTemper = false;
    const family = ultimateFamilyForCode(self?.ultimate.archetype ?? 0);
    playUltimateStamp(
      this,
      this.screenW(),
      this.screenH(),
      `10TH ATTUNEMENT · ${family === UltimateFamily.Locked ? "TEMPERED" : "VARIANT TEMPERED"}`,
    );
    this.audio.play("ult:temper");
    this.ultimateRevealBusyUntil = this.time.now + 1_050;
  }

  private updateUltimateVfx(): void {
    const room = this.room;
    if (!room) return;
    const renderTime = this.timeline.ready
      ? this.timeline.renderTime(this.time.now)
      : Math.max(0, room.state.tick * TICK_MS - INTERP_DELAY_MS);
    this.ultimateVfx.update(
      room.state.players,
      room.sessionId,
      room.state.tick,
      Math.max(0, Math.floor(renderTime / TICK_MS)),
      this.time.now,
      this.animClock,
      prefersReducedPaperMotion(),
      this.feedbackSettings.flashes === "reduced",
    );
  }

  private ultimatePresentationPhase(
    row: PlayerState["ultimate"],
    tick: number,
  ): UltimatePhaseValue {
    if (row.phase === UltimatePhase.Idle || !this.tickAtOrAfter(tick, row.startTick))
      return UltimatePhase.Idle;
    if (!this.tickAtOrAfter(tick, row.resolveTick)) return UltimatePhase.Windup;
    const activeEnd = (row.endTick - ULT_RECOVERY_TICKS) >>> 0;
    if (!this.tickAtOrAfter(tick, activeEnd)) return UltimatePhase.Active;
    if (!this.tickAtOrAfter(tick, row.endTick)) return UltimatePhase.Recovery;
    return UltimatePhase.Idle;
  }

  private tickAtOrAfter(tick: number, target: number): boolean {
    return (tick - target) >>> 0 < 0x8000_0000;
  }

  private ultimatePhaseProgress(
    row: PlayerState["ultimate"],
    tick: number,
    phase: UltimatePhaseValue,
  ): number {
    let start = row.startTick;
    let end = row.resolveTick;
    if (phase === UltimatePhase.Active) {
      start = row.resolveTick;
      end = (row.endTick - ULT_RECOVERY_TICKS) >>> 0;
    } else if (phase === UltimatePhase.Recovery) {
      start = (row.endTick - ULT_RECOVERY_TICKS) >>> 0;
      end = row.endTick;
    }
    const duration = Math.max(1, (end - start) >>> 0);
    return Math.max(0, Math.min(1, ((tick - start) >>> 0) / duration));
  }

  private triggerAcceptedRigAttack(rig: SpriteRig, player: PlayerState, epoch: number): void {
    const weapon = WEAPONS[player.weapon] ?? WEAPONS[DEFAULT_WEAPON];
    if (!weapon) return;
    if (weapon.warp) {
      const arrivalY = this.belt ? this.beltY(player.y) : player.y;
      if (player.id !== this.room?.sessionId) spawnTeslaWarpDeparture(this, rig.x, rig.y);
      spawnTeslaWarpArrival(this, player.x, arrivalY);
      spawnExplosion(this, player.x, arrivalY, weapon.warp.burstRadius, "shock", "player-weapon");
      this.audio.play("shot:spark", {
        x: player.x,
        amt: player.id === this.room?.sessionId ? 1 : 0.65,
      });
      return;
    }
    const swing = swingDescriptorFor(
      weapon,
      weapon.cooldown * lootCooldownMult(player.weaponAffix),
    );
    if (weapon.tags.classPool === "caster" && !weapon.performance?.aura)
      this.cueAttackCasterSource(weapon, swing, player.id, rig, player.aimDir);
    // Guns use projectile/muzzle state instead of a melee swing. Cast/tome and ordinary melee rigs share
    // this descriptor path, including the authoritative affix-adjusted cadence.
    if (weapon.gun || weapon.performance?.aura) return;
    rig.triggerSwing(epoch, player.aimDir, swing);
    this.cueWeaponSwingIdentity(
      rig,
      player.id,
      weapon,
      player.aimDir,
      rig.activeSwing ?? swing,
      undefined,
      {
        x: player.x,
        y: player.y,
      },
    );
    if (weapon.chainLightning) {
      const aim = { x: Math.cos(player.aimDir), y: Math.sin(player.aimDir) };
      this.spawnChain(rig.x, rig.y, aim, weapon, rig.activeSwing ?? swing);
    }
    this.playWeaponSourceAudio(weapon, rig.x, player.id === this.room?.sessionId);
  }

  private cueWeaponSwingIdentity(
    rig: SpriteRig,
    playerId: string,
    weapon: WeaponDef,
    aimAngle: number,
    swing: SwingDescriptor,
    targetWorld?: Readonly<{ x: number; y: number }>,
    actorWorld?: Readonly<{ x: number; y: number }>,
  ): void {
    const recipe = resolveWeaponEffectRecipe(weapon);
    if (!recipe?.swingPack && !recipe?.impactPack && !recipe?.musicalNotes) return;
    const cueSeconds = this.destinationReadyCueSeconds(
      weapon,
      swing,
      weaponEffectCueSeconds(weapon, swing),
    );
    this.time.delayedCall(cueSeconds * 1000, () => {
      const impactAnchored = recipe.impactAnchor === "target";
      const destinationAuthority =
        weapon.performance?.lunge?.impactAtDestination === true
          ? this.room?.state.players.get(playerId)
          : undefined;
      const destinationActor = destinationAuthority
        ? {
            x: destinationAuthority.x,
            y: this.belt ? this.beltY(destinationAuthority.y) : destinationAuthority.y,
          }
        : undefined;
      const actor =
        destinationActor ?? (impactAnchored && actorWorld ? actorWorld : { x: rig.x, y: rig.y });
      const point = weaponEffectCuePoint(
        recipe,
        weapon,
        actor,
        targetWorld,
        aimAngle,
        swing,
        cueSeconds,
      );
      const vfxForwardPx = impactAnchored ? 0 : (weapon.performance?.vfxForwardPx ?? 0);
      const motionOrigin = {
        x: actor.x + Math.cos(aimAngle) * vfxForwardPx,
        y: actor.y + Math.sin(aimAngle) * vfxForwardPx,
      };
      const motionPoint = impactAnchored
        ? point
        : {
            ...point,
            x: point.x + Math.cos(aimAngle) * vfxForwardPx,
            y: point.y + Math.sin(aimAngle) * vfxForwardPx,
          };
      const renderY = impactAnchored && this.belt ? this.beltY(motionPoint.y) : motionPoint.y;
      const audit = globalThis as unknown as {
        __ddV6GAnchorCapture?: boolean;
        __ddV6GAnchorEvents?: Array<Record<string, unknown>>;
      };
      if (audit.__ddV6GAnchorCapture) {
        audit.__ddV6GAnchorEvents ??= [];
        const events = audit.__ddV6GAnchorEvents;
        events.push({
          kind: "weapon-effect-recipe",
          weaponId: weapon.id,
          recipeId: recipe.id,
          anchor: impactAnchored ? "target" : recipe.emitter,
          x: motionPoint.x,
          y: renderY,
          targetX: targetWorld?.x,
          targetY: targetWorld
            ? this.belt
              ? this.beltY(targetWorld.y)
              : targetWorld.y
            : undefined,
          pack: recipe.impactPack ?? recipe.swingPack,
          count: recipe.swingCount,
        });
        if (events.length > 256) events.splice(0, events.length - 256);
      }
      if (recipe.radialDistribution === "full-circle") {
        spawnWeaponRadialIdentity(
          this,
          recipe,
          motionOrigin.x,
          motionOrigin.y,
          meleeReach(weapon),
          motionPoint.angle,
          weapon.displayLength,
        );
      } else {
        spawnWeaponSwingIdentity(
          this,
          recipe,
          motionPoint.x,
          renderY,
          motionPoint.angle,
          weapon.displayLength,
        );
      }
    });
  }

  /** Destination-bound attack accents may never precede the collision-clamped server arrival. */
  private destinationReadyCueSeconds(
    weapon: WeaponDef,
    swing: SwingDescriptor,
    requestedSeconds: number,
  ): number {
    const lunge = weapon.performance?.lunge;
    if (lunge?.impactAtDestination !== true) return requestedSeconds;
    return Math.max(
      requestedSeconds,
      swing.activeStartSeconds + (lunge.durationSeconds ?? TICK_MS / 1000),
    );
  }

  /** Keep caster-source paint on the authoritative dash destination instead of the click-time rig root. */
  private cueAttackCasterSource(
    weapon: WeaponDef,
    swing: SwingDescriptor,
    playerId: string,
    rig: SpriteRig,
    angle: number,
    onCue?: () => void,
  ): void {
    const destinationBound = weapon.performance?.lunge?.impactAtDestination === true;
    const requestedSeconds = weapon.performance?.vfxAt === "impact" ? swing.impactSeconds : 0;
    const cueSeconds = this.destinationReadyCueSeconds(weapon, swing, requestedSeconds);
    const cue = () => {
      const authority = destinationBound ? this.room?.state.players.get(playerId) : undefined;
      this.spawnCasterSource(
        weapon,
        authority?.x ?? rig.x,
        authority ? (this.belt ? this.beltY(authority.y) : authority.y) : rig.y,
        angle,
      );
      onCue?.();
    };
    if (cueSeconds > 0) this.time.delayedCall(cueSeconds * 1000, cue);
    else cue();
  }

  /** One presentation-only recipe cue at the held implement tip. */
  private spawnCasterSource(
    weapon: WeaponDef,
    actorX: number,
    actorY: number,
    angle: number,
  ): void {
    const recipe = resolveCasterVfxRecipe(weapon);
    if (!recipe) return;
    const muzzle = weapon.muzzle
      ? weaponMuzzleWorldPoint(weapon, {
          x: actorX,
          y: actorY,
          aimX: Math.cos(angle),
          aimY: Math.sin(angle),
        })
      : { x: actorX, y: actorY };
    spawnCasterCast(
      this,
      muzzle.x,
      muzzle.y,
      angle,
      recipe,
      prefersReducedPaperMotion() || this.feedbackSettings.flashes === "reduced",
    );
  }

  /** Accepted source/whiff sound; impact remains independently driven by authoritative HP loss. */
  private playWeaponSourceAudio(weapon: WeaponDef, x: number, local: boolean): void {
    if (weapon.gun || weapon.beam || weapon.thrown) return;
    const family = weapon.tags.family.toLowerCase();
    let cue = "melee:light";
    if (
      weapon.cast ||
      weapon.tags.classPool === "caster" ||
      family.includes("staff") ||
      family.includes("wand") ||
      family.includes("tome") ||
      family.includes("rod")
    )
      cue = "melee:arcane";
    else if (
      family.includes("claw") ||
      family.includes("talon") ||
      family.includes("fist") ||
      family.includes("dagger") ||
      family.includes("knife")
    )
      cue = "melee:claw";
    else if (
      family.includes("maul") ||
      family.includes("mace") ||
      family.includes("hammer") ||
      family.includes("flail") ||
      family.includes("spade") ||
      family.includes("club")
    )
      cue = "melee:blunt";
    else if (
      weapon.twoHanded ||
      weapon.tags.grip === "2H" ||
      weapon.tags.size === "L" ||
      weapon.tags.size === "XL"
    )
      cue = "melee:heavy";
    this.audio.play(cue, { x, amt: local ? 1 : 0.36 });
  }

  /** Curated world-only capture list: HUD and exact telegraphs remain live above the folding sheet. */
  private paperWorldObjects(): Phaser.GameObjects.GameObject[] {
    const out: Phaser.GameObjects.GameObject[] = [...this.floorObjs];
    for (const rig of this.blobs.values()) out.push(rig.root);
    for (const rig of this.petRigs.values()) out.push(rig.root);
    for (const rig of this.enemies.values()) out.push(rig.root);
    for (const pickup of this.pickups.values()) out.push(pickup);
    for (const projectile of this.projectiles.values()) out.push(projectile);
    for (const zone of this.zones.values()) out.push(zone);
    if (this.portal) out.push(this.portal.ground);
    if (this.rift) out.push(this.rift.ground);
    const camera = this.cameras.main;
    return camera
      .cull(out.filter((obj) => obj.active && obj.willRender(camera)))
      .sort(
        (a, b) =>
          ((a as Phaser.GameObjects.GameObject & { depth?: number }).depth ?? 0) -
          ((b as Phaser.GameObjects.GameObject & { depth?: number }).depth ?? 0),
      );
  }

  /** Render one bounded snapshot with the live camera transform; no UI, masks, or per-rig textures. */
  private drawPaperWorldSnapshot(fold: PaperWorldFold): void {
    const camera = this.cameras.main;
    fold.snapshot.clear().fill(0x17140f, 1);
    fold.snapshot.camera
      .setScroll(camera.scrollX, camera.scrollY)
      .setZoom(camera.zoom * fold.captureScale);
    for (const obj of this.paperWorldObjects()) fold.snapshot.draw(obj);
    fold.snapshot.render();
  }

  /** Capture the accepted old world before its floor objects are torn down. */
  private capturePaperWorldFold(): PaperWorldFold | undefined {
    this.releasePaperWorldFold();
    const screenW = Math.max(2, Math.round(this.screenW()));
    const screenH = Math.max(2, Math.round(this.screenH()));
    const captureScale = Math.min(
      1,
      PAPER_SNAPSHOT_MAX_W / screenW,
      PAPER_SNAPSHOT_MAX_H / screenH,
    );
    const captureW = Math.max(2, Math.floor((screenW * captureScale) / 2) * 2);
    const captureH = Math.max(2, Math.floor((screenH * captureScale) / 2) * 2);
    const actualScale = Math.min(captureW / screenW, captureH / screenH);
    const halfH = Math.floor(captureH / 2);
    const textureKey = `paper-world-fold:${++this.paperWorldFoldSeq}`;
    let snapshot: Phaser.GameObjects.RenderTexture | undefined;
    let top: Phaser.GameObjects.Image | undefined;
    let bottom: Phaser.GameObjects.Image | undefined;
    let crease: Phaser.GameObjects.Rectangle | undefined;
    try {
      snapshot = this.add.renderTexture(0, 0, captureW, captureH).setOrigin(0).setVisible(false);
      const saved = snapshot.saveTexture(textureKey);
      saved.add("top", 0, 0, 0, captureW, halfH);
      saved.add("bottom", 0, 0, halfH, captureW, captureH - halfH);
      if (!this.paperPagePool) {
        this.paperPagePool = {
          top: this.add.image(0, 0, "__WHITE").setVisible(false),
          bottom: this.add.image(0, 0, "__WHITE").setVisible(false),
          crease: this.add.rectangle(0, 0, 2, 10, 0x8e4bd6, 0).setVisible(false),
        };
      }
      top = this.paperPagePool.top
        .setTexture(textureKey, "top")
        .setPosition(screenW / 2, screenH / 2)
        .setOrigin(0.5, 1)
        .setScrollFactor(0)
        .setDepth(99980)
        .setDisplaySize(screenW, screenH / 2)
        .setRotation(0)
        .setAlpha(1)
        .setVisible(true);
      bottom = this.paperPagePool.bottom
        .setTexture(textureKey, "bottom")
        .setPosition(screenW / 2, screenH / 2)
        .setOrigin(0.5, 0)
        .setScrollFactor(0)
        .setDepth(99980)
        .setDisplaySize(screenW, screenH / 2)
        .setRotation(0)
        .setAlpha(1)
        .setVisible(true);
      crease = this.paperPagePool.crease
        .setPosition(screenW / 2, screenH / 2)
        .setDisplaySize(screenW, 10)
        .setFillStyle(0x8e4bd6, 1)
        .setAlpha(0)
        .setVisible(true)
        .setScrollFactor(0)
        .setDepth(99981);
      const fold: PaperWorldFold = {
        textureKey,
        snapshot,
        top,
        bottom,
        crease,
        screenW,
        screenH,
        captureScale: actualScale,
        topScaleX: top.scaleX,
        topScaleY: top.scaleY,
        bottomScaleX: bottom.scaleX,
        bottomScaleY: bottom.scaleY,
        telegraphGroundDepth: this.telegraphGroundGfx.depth,
      };
      this.paperWorldFold = fold;
      // Exact ground danger remains mathematically literal above the page during the accepted transition.
      this.telegraphGroundGfx.setDepth(99989);
      this.drawPaperWorldSnapshot(fold);
      this.paperPeakObjects = Math.max(
        this.paperPeakObjects,
        this.paperDeaths.length + this.closingPickups.size + 4,
      );
      return fold;
    } catch (err) {
      console.warn("[paper] world snapshot failed; using the transition flash", err);
      if (this.paperWorldFold) this.releasePaperWorldFold();
      else {
        top?.setVisible(false).setTexture("__WHITE");
        bottom?.setVisible(false).setTexture("__WHITE");
        crease?.setVisible(false);
        if (this.textures.exists(textureKey)) this.textures.remove(textureKey);
        snapshot?.destroy();
      }
      return undefined;
    }
  }

  private announcePaperDescent(depth: number, dimensionName: string): void {
    this.audio.play("descent");
    this.flashBanner(`⇓ Depth ${depth} — ${dimensionName}`, "#b478ff");
  }

  /** Close the old snapshot, swap its pixels only while edge-on, then unfold the accepted new world. */
  private playPaperWorldFold(fold: PaperWorldFold, depth: number, dimensionName: string): void {
    if (prefersReducedPaperMotion()) {
      fold.tween = this.tweens.add({
        targets: [fold.top, fold.bottom, fold.crease],
        alpha: 0,
        duration: 100,
        ease: "Quad.easeOut",
        onComplete: () => {
          fold.tween = undefined;
          this.announcePaperDescent(depth, dimensionName);
          this.releasePaperWorldFold(fold);
        },
      });
      return;
    }

    fold.tween = this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 170,
      onUpdate: (tw) => {
        const q = paperSmoothstep(tw.getValue() ?? 0);
        const foldY = 1 - 1.035 * q;
        fold.top.scaleY = fold.topScaleY * foldY;
        fold.bottom.scaleY = fold.bottomScaleY * foldY;
        fold.top.y = fold.screenH / 2 + 5 * q;
        fold.bottom.y = fold.screenH / 2 - 5 * q;
        fold.top.rotation = 0.035 * q;
        fold.bottom.rotation = -0.035 * q;
        fold.crease.setAlpha(Math.sin(Math.PI * q) * 0.85);
      },
      onComplete: () => {
        fold.tween = undefined;
        if (this.paperWorldFold !== fold) return;
        // The old/new texture handoff happens at |scaleY|=.035: the page is visually edge-on.
        this.drawPaperWorldSnapshot(fold);
        fold.top.scaleY = fold.topScaleY * -0.035;
        fold.bottom.scaleY = fold.bottomScaleY * -0.035;
        fold.top.y = fold.screenH / 2;
        fold.bottom.y = fold.screenH / 2;
        fold.top.rotation = 0;
        fold.bottom.rotation = 0;
        let announced = false;
        fold.tween = this.tweens.addCounter({
          from: 0,
          to: 1,
          duration: 250,
          onUpdate: (tw) => {
            const raw = tw.getValue() ?? 0;
            const q = paperCubicOut(raw);
            const openY = -0.035 + 1.035 * q;
            fold.top.scaleY = fold.topScaleY * openY;
            fold.bottom.scaleY = fold.bottomScaleY * openY;
            fold.top.rotation = 0.035 * Math.sin(Math.PI * raw);
            fold.bottom.rotation = -0.035 * Math.sin(Math.PI * raw);
            fold.crease.setAlpha(Math.sin(Math.PI * raw) * 0.7);
            if (!announced && raw >= 0.7) {
              announced = true;
              this.announcePaperDescent(depth, dimensionName);
            }
          },
          onComplete: () => {
            fold.tween = undefined;
            if (!announced) this.announcePaperDescent(depth, dimensionName);
            this.releasePaperWorldFold(fold);
          },
        });
      },
    });
  }

  /** Release consumers before their aliased DynamicTexture; a newer transition may replace an old one. */
  private releasePaperWorldFold(fold = this.paperWorldFold): void {
    if (!fold) return;
    if (this.paperWorldFold === fold) this.paperWorldFold = undefined;
    if (fold.tween) {
      fold.tween.stop();
      fold.tween.remove();
      fold.tween = undefined;
    }
    if (this.telegraphGroundGfx?.active)
      this.telegraphGroundGfx.setDepth(fold.telegraphGroundDepth);
    if (fold.top.active) fold.top.setVisible(false).setAlpha(1).setTexture("__WHITE");
    if (fold.bottom.active) fold.bottom.setVisible(false).setAlpha(1).setTexture("__WHITE");
    if (fold.crease.active) fold.crease.setVisible(false).setAlpha(0);
    if (this.textures.exists(fold.textureKey)) this.textures.remove(fold.textureKey);
    if (fold.snapshot.active) fold.snapshot.destroy();
  }

  private destroyPaperPagePool(): void {
    this.releasePaperWorldFold();
    const pool = this.paperPagePool;
    this.paperPagePool = undefined;
    if (!pool) return;
    if (pool.top.active) pool.top.destroy();
    if (pool.bottom.active) pool.bottom.destroy();
    if (pool.crease.active) pool.crease.destroy();
  }

  /** Regenerate the synced floor once; accepted rift seed changes fold one bounded world snapshot. */
  private maybeBuildFloor(): void {
    if (!this.room) return;
    const s = this.room.state;
    if (!s.seedTerrain) return; // seeds not synced yet (0 = "no map")
    const dimension = getDimension(s.dimensionId);
    const propPack = dimensionPropPack(dimension.id);
    // §17 a joiner can inherit the host's dimension, and a §6 rift changes it mid-scene. Preload covered the
    // requested starting dimension; here the floor gate lazily queues its terrain + props before teardown.
    // Network failures hit preload's loaderror guard; HTTP-200/non-image stubs use this silent decode hook.
    const floorArtFiles = [
      ...Array.from({ length: 4 }, (_, i) => ({
        key: terrainTileKey(dimension.id, i),
        url: `tiles/${dimension.id}/tile-${i}.png`,
      })),
      {
        key: terrainRimKey(dimension.id),
        url: `tiles/${dimension.id}/rim.png`,
      },
      ...propPack.decalIds.map((id) => ({
        key: id,
        url: `${propPack.decalDir}/${id}.png`,
      })),
      ...propPack.poiIds.map((id) => ({
        key: id,
        url: `${propPack.poiDir}/${id}.png`,
      })),
    ];
    const floorArtPending = floorArtFiles.filter(
      ({ key }) => !this.textures.exists(key) && !this.floorArtMissing.has(key),
    );
    if (floorArtPending.length > 0) {
      if (!this.load.isLoading()) {
        for (const { key, url } of floorArtPending) {
          this.queueOptionalFloorArt(key, url);
        }
        this.load.start();
      }
      return;
    }
    const seedKey = `${s.seedTerrain}:${s.seedHazard}:${s.seedTheme}:${s.seedDecor}:${s.dimensionId}`;
    if (seedKey === this.lastSeedKey) return; // current floor is the right one
    const descending = this.lastSeedKey !== ""; // not the first build → a rift descent / restart
    const riftDescent = descending && s.depth > 1;
    const worldFold = riftDescent ? this.capturePaperWorldFold() : undefined;
    for (const o of this.floorObjs) o.destroy();
    this.floorObjs = [];
    this.poiSprites = [];
    this.arenaMap = generateArena({
      seedTerrain: s.seedTerrain,
      seedHazard: s.seedHazard,
      seedTheme: s.seedTheme,
      seedDecor: s.seedDecor,
    });
    // §17 the active dimension's floor palette (re-skin of "Dust & The Drop"); unknown id → Wild West.
    const palette = dimension.palette;
    if (this.belt) {
      // §29 belt: build the authored DECK from the level's floor profile + obstacles (WYSIWYG collision), and
      // hand the level to the predictor (no POI map) so local collision matches the server exactly.
      this.beltLevel = beltLevelFor(this.selectedBeltLevel);
      // §37 never let a floor-build failure (e.g. a themed-level texture/canvas issue on some GPUs) throw out
      // of create() and black the whole scene — log it so it's diagnosable, and keep the level playable.
      try {
        this.buildBeltFloor();
      } catch (e) {
        console.error("[belt] buildBeltFloor failed — level renders without its floor art", e);
        this.cameras.main.setBackgroundColor(this.beltTheme().sky);
      }
      this.predictor?.setMap(undefined);
      this.predictor?.setBeltLevel(this.beltLevel);
    } else {
      this.floorObjs.push(
        ...drawArena(this, this.arenaMap, dimension.id, (k) => this.hasTile(k), palette),
      );
      this.floorObjs.push(
        ...buildArenaFloor(this, this.arenaMap, dimension.id, (k) => this.hasTile(k), palette),
      );
      const pois = buildPois(this, this.arenaMap, dimension.id);
      this.poiSprites = pois.sprites;
      this.floorObjs.push(...pois.objs);
      // §4 v0.107: a re-minted map = a new world — the predictor must collide against the NEW landmarks
      // (review #15) and every snapshot ring holds coordinates from the OLD map (review #16). Swap + clear.
      this.predictor?.setMap(this.arenaMap);
    }
    this.lastSeedKey = seedKey;
    this.playerBufs.clear();
    this.enemyBufs.clear();
    if (descending) {
      if (!worldFold) {
        if (riftDescent) this.cameras.main.flash(260, 96, 48, 160);
        else this.cameras.main.flash(220, 28, 22, 18);
      }
      // Mute the enemy-REMOVAL VFX briefly: the server just bulk-cleared the old dimension's horde, and
      // without this every cleared enemy death-pops at old-map coordinates on the new floor (corpse storm).
      this.removalFxMuteUntil = this.time.now + 900;
      // The descent banner is only true copy for an actual rift descent (depth ≥ 2) — a run RESTART also
      // re-mints the map (fresh terrain each run) but starts back at depth 1.
      if (riftDescent && !worldFold) {
        this.audio.play("descent"); // §19 the downward whoosh into the next dimension
        this.flashBanner(`⇓ Depth ${s.depth} — ${getDimension(s.dimensionId).name}`, "#b478ff");
      }
      if (worldFold) this.playPaperWorldFold(worldFold, s.depth, dimension.name);
    }
  }

  /** §17 fire the fall VFX when a player's synced `fellSeq` ticks: a dust poof at the landing tile, plus a
   *  brief red flash + shake for the LOCAL player so the chip-damage fall has weight. */
  private checkFalls(): void {
    const st = this.room?.state;
    if (!st) return;
    const selfId = this.room?.sessionId;
    st.players.forEach((player, id) => {
      const prev = this.lastFell.get(id);
      this.lastFell.set(id, player.fellSeq);
      if (prev === undefined || prev === player.fellSeq) return;
      // §17/§7 v0.105 de-clunk: the fall + the snap-back arrive in the SAME patch, so the rig is still
      // rendered out over the pit (pre-snap) right now. Play the sink-dust HERE (over the pit, where you
      // actually fell), then hard-snap the rig to the authoritative safe tile so the following interpolate
      // doesn't rubber-band you backwards out of the void over ~350ms. Runs before interpolate() (see update).
      const rig = this.blobs.get(id);
      if (rig) {
        spawnFallStreak(this, rig.x, rig.y);
        rig.setPosition(player.x, player.y);
        rig.renderPrevX = player.x;
        rig.renderPrevY = player.y;
      } else {
        spawnFallStreak(this, player.x, player.y);
      }
      if (id === selfId) {
        this.cameras.main.flash(170, 90, 16, 16);
        this.shakeCam(150, 0.006, "world");
        this.audio.play("fall"); // §19 void whoosh + a thud on the snap-back landing
        this.offerContextHint("pitFall");
      }
    });
  }

  private async connect(generation: number): Promise<void> {
    const status = document.getElementById("status");
    // §4 secure deployments must use WSS; localhost/http development remains the same WS endpoint.
    const scheme = location.protocol === "https:" ? "wss" : "ws";
    // Dev escape hatch: `?port=2568` points this client at a private game server so an interactive
    // session never fights an e2e harness for DEFAULT_PORT. Ignored outside dev builds.
    const portOverride = import.meta.env.DEV
      ? Number(new URLSearchParams(location.search).get("port"))
      : Number.NaN;
    const port = Number.isInteger(portOverride) && portOverride > 0 ? portOverride : DEFAULT_PORT;
    const client = new Client(`${scheme}://${location.hostname}:${port}`);

    // Retry with backoff: on a cold `pnpm dev`, the Vite client is ready seconds before
    // the Colyseus server finishes starting. Without retry, the first load throws and
    // shows no player until a manual refresh. This self-heals as soon as the server is up.
    const maxAttempts = 30;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // §17 pass the menu's dimension pick as a join option (the room creator scopes the run to it; a
        // joiner inherits the host's synced dimension — `getDimension` server-side rejects an unknown id).
        const joinOpts = {
          metaAccount: this.petMetaAccount,
          carry: this.pendingCarry,
          selectedPetId: this.selectedPetId,
          dimensionId: this.selectedDimension,
          bossRush: this.bossRush, // §16 v0.116 the room creator's BOSS RUSH pick scopes the run's mode
          belt: this.belt, // §29 belt-scroller mode — the server shapes the sim into a belt band
          beltLevel: this.belt ? this.selectedBeltLevel : undefined, // §36 which belt level to load
          scrip: this.belt ? this.loadBankedScrip() : 0, // §29 restore the player's persisted meta-scrip
          up: this.belt ? this.loadUpgrades() : undefined, // §31 restore permanent upgrade levels
        };
        // §39 a DEV-PORTAL deep-link gets its OWN fresh room via create() (never joinOrCreate) — otherwise it
        // lands in a live/other-tab co-op room as a NON-host, and the host-only dev messages (spawnBossDef,
        // toggleTraining) are silently dropped (looks like "boss never spawned / empty arena").
        const room = this.devLaunch
          ? await client.create<ArenaState>(ROOM_NAME, joinOpts)
          : await client.joinOrCreate<ArenaState>(ROOM_NAME, joinOpts);
        // The Scene may have shut down while the join handshake was in flight. Never install that room.
        if (generation !== this.connectionGeneration) {
          void room
            .leave()
            .catch((leaveErr: unknown) =>
              console.warn("[client] stale joined room leave failed", leaveErr),
            );
          return;
        }
        this.room = room;
        const disposeMetaAccount = room.onMessage<unknown>("metaAccount", (payload) => {
          if (generation !== this.connectionGeneration || this.room !== room) return;
          this.petMetaAccount = savePetMetaAccount(payload);
          this.selectedPetId = this.petMetaAccount.selectedPetId;
        }) as () => void;
        const disposePetProgress = room.onMessage<unknown>("petProgressReceipt", (payload) => {
          if (generation !== this.connectionGeneration || this.room !== room) return;
          this.onPetProgressReceipt(payload);
        }) as () => void;
        const disposePetPickup = room.onMessage<{ ids?: unknown }>(
          "petPickupEligibility",
          (payload) => {
            if (generation !== this.connectionGeneration || this.room !== room) return;
            this.petPickupEligibility.clear();
            if (!Array.isArray(payload?.ids)) return;
            for (let i = 0; i < Math.min(128, payload.ids.length); i++) {
              const id = payload.ids[i];
              if (typeof id === "string") this.petPickupEligibility.add(id);
            }
          },
        ) as () => void;
        const disposeWeaponManifest = room.onMessage<unknown>("weaponManifest", (payload) => {
          if (generation !== this.connectionGeneration || this.room !== room) return;
          this.onWeaponManifest(payload);
        }) as () => void;
        const disposeWeaponSettlement = room.onMessage<unknown>(
          "weaponSettlementReceipt",
          (payload) => {
            if (generation !== this.connectionGeneration || this.room !== room) return;
            this.onWeaponSettlementReceipt(payload);
          },
        ) as () => void;
        const disposeOwnerNoteAck = room.onMessage<{ saved?: unknown; reason?: unknown }>(
          "ownerNoteAck",
          (payload) => {
            if (generation !== this.connectionGeneration || this.room !== room) return;
            if (payload?.saved === true) {
              this.flashBanner("✓ OWNER NOTE SAVED", "#9cff6a");
            } else {
              const reason =
                typeof payload?.reason === "string" ? payload.reason : "server rejected";
              this.flashBanner(`NOTE NOT SAVED · ${reason}`, "#ff8a6b");
            }
          },
        ) as () => void;
        this.roomStateDisposers.push(
          disposeMetaAccount,
          disposePetProgress,
          disposePetPickup,
          disposeWeaponManifest,
          disposeWeaponSettlement,
          disposeOwnerNoteAck,
        );
        // §4 schema handshake (audit): if the server's schema version ≠ ours, our compiled state schema is
        // stale → Colyseus would decode patches with corrupted field offsets. Detect on the first state and
        // tell the player to hard-reload instead of silently rendering garbage.
        let initialStateSubscribed = true;
        const onInitialState = (state: ArenaState): void => {
          // Colyseus's `once()` hides its wrapper, so use an explicitly removable one-shot callback.
          if (initialStateSubscribed) {
            initialStateSubscribed = false;
            room.onStateChange.remove(onInitialState);
          }
          if (generation !== this.connectionGeneration || this.room !== room) return;
          const sv = state.schemaVersion;
          if (sv && sv !== SCHEMA_VERSION) {
            const msg = `⚠ version mismatch (server schema ${sv} ≠ client ${SCHEMA_VERSION}) — hard-reload this page (Ctrl+Shift+R)`;
            if (status) status.textContent = msg;
            console.error(`[client] ${msg}`);
          }
          this.applyDevLaunch(); // §39 dev-portal deep-link → training sandbox + the requested asset
        };
        room.onStateChange(onInitialState);
        this.roomStateDisposers.push(() => {
          if (!initialStateSubscribed) return;
          initialStateSubscribed = false;
          room.onStateChange.remove(onInitialState);
        });
        // §4 v0.107: every patch is one completed server tick (tick-locked broadcast) — stamp the
        // snapshot timeline + rings and reconcile the self predictor. DATA ONLY in here (never move a
        // rig from inside a patch callback — the render step owns positions; review #10).
        const onStateChange = (state: ArenaState): void => {
          if (generation === this.connectionGeneration && this.room === room) this.onPatch(state);
        };
        room.onStateChange(onStateChange);
        let stateSubscribed = true;
        this.roomStateDisposers.push(() => {
          if (!stateSubscribed) return;
          stateSubscribed = false;
          room.onStateChange.remove(onStateChange);
        });
        if (status) status.textContent = `connected · you are ${room.sessionId.slice(0, 4)}`;
        return;
      } catch (err) {
        if (generation !== this.connectionGeneration) return;
        console.warn(`[client] join attempt ${attempt}/${maxAttempts} failed, retrying…`, err);
        if (status) status.textContent = `connecting… (waiting for server, attempt ${attempt})`;
        await new Promise((resolve) => setTimeout(resolve, 1000));
        if (generation !== this.connectionGeneration) return;
      }
    }

    if (generation === this.connectionGeneration && status) {
      status.textContent = "connection failed — is the server running? (pnpm dev:server)";
    }
  }

  private addBlob(player: PlayerState, id: string): void {
    const isSelf = id === this.room?.sessionId;
    const charId =
      player.character && SPRITES[player.character as keyof typeof SPRITES]
        ? player.character
        : PLAYER_SPRITE;
    const manifest = GEAR_PARTS_MANIFEST;
    // REFLECTION LAW: the room joins without a root-schema constructor, so decoded rows carry ONLY
    // wire fields — PlayerState's server-side compatibility getters (gearUpper/prestige/…) do not
    // exist here. Client code must read the nested dualWield row (see loadout-entry-view's idiom);
    // an unguarded `player.gearUpper.length` black-screened every e2e join.
    const gearUpper = player.dualWield?.gearUpper ?? "";
    const gearLower = player.dualWield?.gearLower ?? "";
    const gearSynced = !!manifest && gearUpper.length > 0 && gearLower.length > 0;
    // Whole-art characters (the new prototype/roster direction, e.g. proto-*) render their OWN complete
    // sprite and IGNORE the wardrobe gear overlay — this is what finally lets `player.character` drive the
    // VISUAL, not just stats. Legacy drifter-skeleton players still use the synced gear. (Wardrobe is being
    // retired; when the whole cast is authored art, this collapses to "always render your character".)
    const isWholeArtCharacter = isWholeArtCharacterId(charId);
    // A whole-art rig is created only after all six loose cuts are in TextureManager. syncBlobs retries on
    // the next render frame, giving the async loader a natural ready barrier with no boilerplate flash.
    if (isWholeArtCharacter && ensureWholeArtCharacterTextures(this, charId) !== "ready") {
      return;
    }
    const useGear = gearSynced && !isWholeArtCharacter;
    const rigSpriteId = useGear ? PLAYER_SPRITE : charId;
    const rig = new SpriteRig(
      this,
      player.x,
      player.y,
      isSelf,
      id,
      rigSpriteId,
      useGear ? manifest : undefined,
    );
    if (useGear && manifest)
      rig.equipSyncedGear(
        gearUpper,
        gearLower,
        manifest,
        isSelf ? this.petMetaAccount.prestige : (player.dualWield?.prestige ?? 0),
      );
    // Boilerplate and compatibility kits obey the identical per-character silhouette law.
    rig.setRigScale(characterScale(charId));
    this.blobs.set(id, rig);
    this.charOf.set(id, player.character);
    if (isSelf) this.centerCam(player.x, player.y);
  }

  private removeBlob(id: string): void {
    this.blobs.get(id)?.destroy();
    this.blobs.delete(id);
    this.petRigs.get(id)?.destroy();
    this.petRigs.delete(id);
    this.petOwnerHp.delete(id);
    this.equipped.delete(id);
    this.equippedOffhand.delete(id);
    this.charOf.delete(id);
    this.playerBufs.delete(id); // §4 v0.107 snapshot ring + fell watcher go with the player
    this.snapFell.delete(id);
    // §8/§6/§17 edge-trigger cursors are session-scoped too — a departed id must not live in these maps.
    this.lastParried.delete(id);
    this.lastDodged.delete(id);
    this.lastRevived.delete(id);
    this.lastAttackSeq.delete(id);
    this.lastAttackHeld.delete(id);
    this.lastUltimateSeq.delete(id);
    this.lastUltimateArchetype.delete(id);
    this.lastFell.delete(id);
    this.jumpPresentation.delete(id);
    this.jugglePresentation.delete(id);
  }

  override update(_time: number, deltaMs: number): void {
    const preSelf = this.room?.state.players?.get(this.room.sessionId);
    const competingLevelModal = this.inLevelWindow(preSelf) || this.levelWinInputReleaseLatch;
    const ownerNoteModalOpen = !!this.ownerNoteUi?.isOpen();
    if (competingLevelModal) {
      if (ownerNoteModalOpen) this.ownerNoteUi?.close();
      this.verbs.closeForCompetingModal(this.time.now);
      this.verbs.retireHint();
    } else if (!ownerNoteModalOpen && Phaser.Input.Keyboard.JustDown(this.keys.H)) {
      if (!this.verbs.isLegendOpen()) {
        this.bagOpen = false;
        this.shopOpen = false;
        if (this.summonOpen) this.closeSummonMenu();
      }
      this.verbs.toggleLegend(this.time.now);
    }
    if (this.verbs.hasInputReleaseLatch()) {
      this.verbs.releaseInputLatchIf(this.legendInputsReleased());
    }
    this.verbs.update(this.time.now, this.screenW(), this.screenH());

    // §39 the room resolves BEFORE its first state patch — in that window state.players is still undefined,
    // and an unguarded read threw every frame (killing the scene's step = permanent black screen; hit on real
    // machines where the first patch lands a frame late, never in the fast local preview). Wait for the sync.
    if (!this.room?.state.players) return;

    this.deltaSec = deltaMs / 1000;
    // §19 v0.108 refresh the audio pan reference to the camera's world centre BEFORE this frame's play()
    // calls (so a sound's stereo position tracks where it happens on screen; end-of-update ordering panned
    // against the prior frame + origin-0 on frame one — adversarial-verify finding).
    const cam = this.cameras.main;
    this.audio.setListener(cam.scrollX + cam.width / cam.zoom / 2, cam.width / cam.zoom / 2);
    // Weapon verbs stay physically distinct: E interacts, Q cycles, Z/X page the training gallery, and
    // R owns only drop/salvage. G/T become hard-modal owner notes only inside Testing Grounds; T retains
    // its enter-Testing-Grounds verb outside. Restart remains the on-screen button, top-right.
    const selfP = this.room.state.players.get(this.room.sessionId);
    const alive = !!selfP && selfP.alive;
    const ultimatePressed = Phaser.Input.Keyboard.JustDown(this.keys.F);
    const beltShopX = this.belt ? (this.room.state.beltShopX ?? 0) : 0;
    const nearBeltShop =
      this.belt && !!selfP && beltShopX > 0 && Math.abs(selfP.x - beltShopX) <= SHOP_RADIUS;
    const levelWindowOpen = this.inLevelWindow(selfP);
    if (!levelWindowOpen && this.levelWinInputReleaseLatch && this.levelWindowInputsReleased()) {
      this.levelWinInputReleaseLatch = false;
    }
    if (levelWindowOpen) this.handleLevelWindowInput();
    if (this.summonOpen && this.room.state.mode !== "training") this.closeSummonMenu();
    const summonClosePressed =
      this.summonOpen &&
      (Phaser.Input.Keyboard.JustDown(this.keys.TAB) ||
        Phaser.Input.Keyboard.JustDown(this.keys.ESC));
    if (summonClosePressed) this.closeSummonMenu();
    if (this.ownerNoteUi?.isOpen() && this.room.state.mode !== "training") {
      this.ownerNoteUi.close();
    }
    const weaponInputMode: WeaponInputMode = this.belt
      ? "belt"
      : this.room.state.mode === "training"
        ? "training"
        : "arena";
    if (this.shopOpen && !nearBeltShop) this.closeBackpackModal();
    const armoryModalOpen = this.bagOpen || this.shopOpen;
    const higherModalOpen =
      levelWindowOpen ||
      this.levelWinInputReleaseLatch ||
      this.verbs.isModalBlocking() ||
      this.summonOpen ||
      summonClosePressed ||
      !!this.ownerNoteUi?.isOpen();
    if (armoryModalOpen) {
      const digit = Phaser.Input.Keyboard.JustDown(this.keys.ONE)
        ? 1
        : Phaser.Input.Keyboard.JustDown(this.keys.TWO)
          ? 2
          : Phaser.Input.Keyboard.JustDown(this.keys.THREE)
            ? 3
            : null;
      const armoryInput = routeArmoryUiInput({
        context: "backpack",
        modalOpen: higherModalOpen,
        textInputFocused: false,
        leftPressed: Phaser.Input.Keyboard.JustDown(this.keys.LEFT),
        rightPressed: Phaser.Input.Keyboard.JustDown(this.keys.RIGHT),
        upPressed: Phaser.Input.Keyboard.JustDown(this.keys.UP),
        downPressed: Phaser.Input.Keyboard.JustDown(this.keys.DOWN),
        enterPressed: Phaser.Input.Keyboard.JustDown(this.keys.ENTER),
        escapePressed: Phaser.Input.Keyboard.JustDown(this.keys.ESC),
        closePressed: Phaser.Input.Keyboard.JustDown(this.keys.TAB),
        previousContextPressed: Phaser.Input.Keyboard.JustDown(this.keys.Q),
        nextContextPressed: false,
        previousPagePressed: Phaser.Input.Keyboard.JustDown(this.keys.Z),
        nextPagePressed: Phaser.Input.Keyboard.JustDown(this.keys.X),
        resetPressed: false,
        digitPressed: digit,
      });
      if (armoryInput.move) this.moveBackpackFocus(armoryInput.move, selfP);
      if (armoryInput.contextDelta !== 0 && selfP) this.cycleBeltLoadout(selfP, 1);
      if (armoryInput.activeSlot !== null && selfP) {
        this.selectBeltSlot(selfP, armoryInput.activeSlot - 1);
        this.bagSelected = { source: "slot", index: armoryInput.activeSlot - 1 };
        this.bagRenderSignature = "";
      }
      if (armoryInput.workflowDelta !== 0) this.moveBackpackWorkflow(armoryInput.workflowDelta);
      if (armoryInput.primary && selfP) this.activateBackpackSelection(selfP);
      if (armoryInput.close || (this.shopOpen && ultimatePressed)) this.closeBackpackModal();
    }
    const competingModalOpen =
      levelWindowOpen ||
      this.levelWinInputReleaseLatch ||
      this.verbs.isModalBlocking() ||
      this.summonOpen ||
      summonClosePressed ||
      armoryModalOpen;
    const ownerNoteInput = routeOwnerNoteInput({
      mode: weaponInputMode,
      modalOpen: competingModalOpen || !!this.ownerNoteUi?.isOpen(),
      gameNotePressed: Phaser.Input.Keyboard.JustDown(this.keys.G),
      weaponNotePressed: Phaser.Input.Keyboard.JustDown(this.keys.T),
    });
    if (ownerNoteInput.openNote && selfP) this.openOwnerNote(ownerNoteInput.openNote, selfP);
    if (ownerNoteInput.toggleTraining) this.room.send("toggleTraining");
    const levelWindowInputBlocked =
      competingModalOpen || !ownerNoteInput.gameplayEnabled || !!this.ownerNoteUi?.isOpen();
    this.pointerOverInteractiveUi = this.input.hitTestPointer(this.input.activePointer).length > 0;
    const predictedAirborne = this.predictor
      ? this.selfPredHeight > GROUND_EPSILON
      : (selfP?.height ?? 0) > GROUND_EPSILON;
    const spacePressed = Phaser.Input.Keyboard.JustDown(this.keys.SPACE);
    const spaceReleased = Phaser.Input.Keyboard.JustUp(this.keys.SPACE);
    const space = this.spaceGesture.sample(
      this.time.now,
      this.keys.SPACE.isDown,
      spacePressed,
      spaceReleased,
      predictedAirborne,
      alive && !levelWindowInputBlocked,
      this.predictor?.isGroundSliding ?? false,
    );
    if (space.jump) this.jumpQueued = true;
    if (space.pound) this.poundQueued = true;
    this.crouchHeld = space.crouchHeld;
    const shiftSlidePressed = Phaser.Input.Keyboard.JustDown(this.keys.SHIFT);
    const ctrlSlidePressed = Phaser.Input.Keyboard.JustDown(this.keys.CTRL);
    const rawFlourishIntent = this.rawFlourishIntent;
    rawFlourishIntent.attack =
      alive &&
      !levelWindowInputBlocked &&
      !this.pointerOverInteractiveUi &&
      this.input.activePointer.rightButtonDown();
    rawFlourishIntent.parryOrBrace =
      alive &&
      !levelWindowInputBlocked &&
      !this.pointerOverInteractiveUi &&
      this.input.activePointer.leftButtonDown();
    rawFlourishIntent.jumpOrDodge =
      alive &&
      !levelWindowInputBlocked &&
      (this.keys.SPACE.isDown ||
        space.jump ||
        space.pound ||
        shiftSlidePressed ||
        ctrlSlidePressed);
    rawFlourishIntent.interaction = false;
    rawFlourishIntent.weaponSelection = false;
    if (
      slidePressedFromBindings(shiftSlidePressed, ctrlSlidePressed) &&
      alive &&
      !levelWindowInputBlocked
    ) {
      const parryWindowOpen = (this.time.now - this.lastParryPress) / 1000 < PARRY_IFRAMES;
      if (!parryWindowOpen) {
        // Always deliver one physical edge. Prediction still refuses an ineligible local roll, while
        // authority decides whether its cooldown/recovery treaty accepts or rejects the request.
        this.slideQueued = true;
        // Both bindings are latency-critical; stepNetInput sees this latch and mints an immediate command.
        if (this.predictor?.canSlide) {
          this.slideDryPresses = 0;
          this.slideDryWindowAt = -1e9;
        } else if ((this.predictor?.slideCooldownRemaining ?? 0) > 0) {
          if (this.time.now - this.slideDryWindowAt > 2_000) {
            this.slideDryWindowAt = this.time.now;
            this.slideDryPresses = 0;
          }
          this.slideDryPresses++;
          if (this.slideDryPresses === 3 && !this.slideDryToastShown) {
            this.slideDryToastShown = true;
            this.flashBanner("Roll cooling down", "#c7a66c");
          }
          if (this.slideDryPresses <= 3) {
            const rig = this.room ? this.blobs.get(this.room.sessionId) : undefined;
            if (rig)
              this.jumpEffectRenderer.spawnSlideDry(
                rig.x,
                (this.belt ? this.beltY(rig.y) : rig.y) + PLAYER_SHADOW_LOCAL_Y,
                this.belt ? BELT_FORESHORTEN : 1,
              );
            this.audio.play("slide:dry", { x: rig?.x, amt: 0.35 });
          }
        }
      }
    }
    let canSalvage = false;
    this.grabTarget = null;
    this.grabRadius = PICKUP_RADIUS;
    if (!levelWindowInputBlocked) {
      const holdingWeapon = !!selfP && selfP.weapon !== FISTS_WEAPON;
      // The nearest grabbable pickup within arm's reach drives one visible E prompt and one exact target id.
      let nearPickup = false;
      let grabPickupId = "";
      if (selfP && alive) {
        let bestD = Number.POSITIVE_INFINITY;
        this.room.state.pickups.forEach((pk, id) => {
          const dx = pk.x - selfP.x;
          const dy = pk.y - selfP.y;
          const d = dx * dx + dy * dy;
          const radius = this.petPickupEligibility.has(id)
            ? this.copperPickupPromptRadius()
            : PICKUP_RADIUS;
          if (d <= radius * radius && d <= bestD) {
            bestD = d;
            nearPickup = true;
            grabPickupId = id;
            this.grabTargetId = id;
            this.grabTarget = { x: pk.x, y: pk.y };
            this.grabRadius = radius;
          }
        });
      }
      canSalvage = alive && holdingWeapon && !nearPickup;
      if (this.keys.R.isDown && canSalvage) {
        this.rHold += this.deltaSec;
        if (this.rHold >= SALVAGE_HOLD_SECONDS && !this.rSalvaged) {
          this.room.send("salvageWeapon");
          this.rSalvaged = true;
        }
      }
      if (Phaser.Input.Keyboard.JustUp(this.keys.R)) {
        if (
          !this.rSalvaged &&
          !nearPickup &&
          this.rHold > 0.02 &&
          this.rHold < SALVAGE_HOLD_SECONDS &&
          holdingWeapon
        ) {
          this.room.send("dropWeapon"); // a quick tap (not a grab, not a salvage-hold) = drop
        }
        this.rHold = 0;
        this.rSalvaged = false;
      }
      // Jump-feel Space routing is sampled above the context block so a level-window edge also clears the
      // hold latch. Tap emits on release; held state and airborne pound ride the next numbered command.
      const interactPressed = Phaser.Input.Keyboard.JustDown(this.keys.E);
      const cyclePressed = Phaser.Input.Keyboard.JustDown(this.keys.Q);
      const previousPagePressed = Phaser.Input.Keyboard.JustDown(this.keys.Z);
      const nextPagePressed = Phaser.Input.Keyboard.JustDown(this.keys.X);
      const weaponInput = routeWeaponInput({
        mode: weaponInputMode,
        modalOpen: levelWindowInputBlocked,
        alive,
        pickupPromptVisible: nearPickup,
        interactPressed,
        cyclePressed,
        previousPagePressed,
        nextPagePressed,
      });
      if (weaponInput.pickup && grabPickupId) {
        this.room.send("grabWeapon", { pickupId: grabPickupId });
        this.wakeCarouselDock();
        this.audio.play("grab");
      }
      rawFlourishIntent.interaction = weaponInput.pickup;
      rawFlourishIntent.weaponSelection = !!selfP && weaponInput.cycle;
      // Belt: Q advances through occupied arsenal entries; 1/2/3 jump straight to a slot.
      if (this.belt) {
        const oneDown = Phaser.Input.Keyboard.JustDown(this.keys.ONE);
        const twoDown = Phaser.Input.Keyboard.JustDown(this.keys.TWO);
        const threeDown = Phaser.Input.Keyboard.JustDown(this.keys.THREE);
        rawFlourishIntent.weaponSelection ||= !!selfP && (oneDown || twoDown || threeDown);
        if (weaponInput.cycle && selfP) this.cycleBeltLoadout(selfP, 1);
        if (oneDown && selfP) this.selectBeltSlot(selfP, 0);
        if (twoDown && selfP) this.selectBeltSlot(selfP, 1);
        if (threeDown && selfP) this.selectBeltSlot(selfP, 2);
      } else {
        if (weaponInput.cycle) {
          this.room.send("cycleWeapon", { dir: 1 });
          this.wakeCarouselDock("Q");
        }
      }
      if (weaponInput.galleryPage !== 0) {
        this.room.send("galleryPage", { dir: weaponInput.galleryPage });
      }
      if (weaponInputMode === "training") {
        if (import.meta.env.DEV && Phaser.Input.Keyboard.JustDown(this.keys.P) && selfP) {
          const def = WEAPONS[selfP.weapon];
          if (def) this.cyclePoseShowroom(def);
        }
      }
      if (Phaser.Input.Keyboard.JustDown(this.keys.B)) this.room?.send("spawnBoss");
      // §19 v0.108 M toggles audio mute (persisted) + a confirming toast.
      if (Phaser.Input.Keyboard.JustDown(this.keys.M)) {
        const muted = this.audio.toggleMute();
        this.flashBanner(muted ? "🔇 Audio off" : "🔊 Audio on", "#8fdcff");
      }
      // Tab: §29 belt opens the ARSENAL BAG overlay; elsewhere it's the §21 dev summon menu (Testing Grounds).
      if (Phaser.Input.Keyboard.JustDown(this.keys.TAB)) {
        if (this.belt) {
          this.bagOpen = !this.bagOpen;
          if (this.bagOpen) {
            this.shopOpen = false; // one overlay at a time
            this.openBackpackWorkflow("inventory");
          }
        } else {
          const training = this.room?.state.mode === "training";
          if (training && !this.summonOpen) this.openSummonMenu();
          else this.closeSummonMenu();
        }
      }
      // §29 F = trade with the shopkeeper when standing near them; walking away auto-closes the SELL overlay.
      if (this.belt) {
        if (ultimatePressed && nearBeltShop) {
          this.shopOpen = !this.shopOpen;
          if (this.shopOpen) {
            this.bagOpen = false;
            this.openBackpackWorkflow("sell");
          }
        }
        if (!nearBeltShop) this.shopOpen = false;
      }
      if (ultimatePressed && !nearBeltShop) this.sendUltimate();
      if (Phaser.Input.Keyboard.JustDown(this.keys.C)) this.room?.send("cycleCharacter"); // §7 swap skin
    }
    this.updateDropBar(canSalvage);
    this.renderGrabHighlight();

    rawFlourishIntent.desiredMoveX = levelWindowInputBlocked
      ? 0
      : (this.keys.D.isDown ? 1 : 0) - (this.keys.A.isDown ? 1 : 0);
    rawFlourishIntent.desiredMoveY = levelWindowInputBlocked
      ? 0
      : (this.keys.S.isDown ? 1 : 0) - (this.keys.W.isDown ? 1 : 0);
    const cancelFlourishThisFrame = rawFlourishIntentCancels(
      rawFlourishIntent,
      this.curDx,
      this.curDy,
    );

    this.maybeBuildFloor(); // §17 bake the procgen floor once the seeds arrive
    this.stepNetInput(
      deltaMs,
      levelWindowInputBlocked,
      ultimatePressed && !nearBeltShop && !levelWindowInputBlocked,
      rawFlourishIntent.desiredMoveX,
      rawFlourishIntent.desiredMoveY,
    ); // §4 v0.107 mint/send/predict this frame's input commands
    this.syncBlobs();
    this.syncPetRigs();
    this.checkFalls(); // §17 fall VFX (after blobs so the landing poof lands right)
    this.equipWeapons();
    this.routePlayerAttacks();
    this.routeUltimates();
    this.maybePlayUltimateReveal(selfP);
    // Receipts must drain while last frame's target rigs still exist. This both preserves the death contact
    // point and makes the one-frame receiptTouched interlock line up with the HP-delta pass below.
    this.beginCombatFeedbackFrame();
    this.drainCombatFeedback();
    this.syncEnemies();
    this.updateVastagharPresentation(deltaMs);
    this.syncPickups();
    this.syncProjectiles();
    this.syncZones();
    this.syncPortal();
    this.jumpEffectRenderer.beginFrame();
    if (cancelFlourishThisFrame) {
      this.blobs.get(this.room.sessionId)?.cancelFlourish("raw-arena-input");
    }
    // Hit-stop (§20): briefly freeze the visuals on impactful events for weight. Input/sync keep
    // running so it doesn't feel laggy; positions/poses catch up when the freeze lifts.
    if (this.time.now >= this.frozenUntil) {
      // §4 v0.107 UNFREEZE edge: the predictor kept ticking through the freeze but the rig didn't move —
      // fold the accrued displacement into the error offset so the catch-up GLIDES instead of popping
      // ~42px on the exact frame that was supposed to feel weighty (review #11).
      if (this.wasFrozen && this.predictor) {
        const selfRig = this.room ? this.blobs.get(this.room.sessionId) : undefined;
        if (selfRig) {
          const r = this.predictor.renderPos(this.curDx, this.curDy, this.inputAccMs / 1000);
          this.predictor.foldError(selfRig.x - r.x, selfRig.y - r.y);
        }
      }
      this.wasFrozen = false;
      // §7 v0.105 de-clunk: advance the ANIMATION clock only on UNFROZEN frames, so a hit-stop pauses the
      // rig's swing/brace/idle timing too (they ride `animClock`) instead of skipping ~a third of a swing.
      this.animClock += deltaMs;
      this.updatePaperDeaths(deltaMs);
      this.interpolate(deltaMs);
      this.interpolateEnemies(deltaMs);
      this.interpolateWorm(deltaMs);
      this.processPredictedMeleeContacts();
      this.moveProjectiles(this.deltaSec);
      this.animateBlobs(deltaMs);
      this.animateEnemies(deltaMs);
      this.updatePetRigs(deltaMs);
      this.projectBelt(); // §29 belt mode: remap floor objects onto the depth band + depth-sort (no-op otherwise)
      this.renderProjectileTells(); // M2: parry tell on incoming hostile shots (drawn on the white-tell layer)
    } else {
      this.wasFrozen = true;
    }
    // XP motion is server-timed and continues through local hit-stop; a frozen rig is a stable catch target.
    this.updateUltimateVfx();
    this.updateBeams();
    this.updateXpMotes(deltaMs);
    this.updateXpReceiptLabels();
    this.followSelf();
    this.sendAttack();
    this.sendParry();
    this.renderParryState();
    this.updatePoiOcclusion(); // §17 v0.102 fade a landmark the local player is hidden behind
    this.updatePortalArrow(); // §17 v0.102 edge-of-screen pointer to an off-screen open portal
    this.updateAmbientDust(); // §16 v0.116 Polish B — drifting atmosphere motes
    this.updateCombatFx();
    this.combatFeedback.endFrame(this.time.now);
    const presentationDelta = this.time.now >= this.frozenUntil ? deltaMs : 0;
    this.hitEffectRenderer.update(
      presentationDelta,
      this.animClock,
      this.feedbackSettings.flashes === "reduced",
    );
    this.jumpEffectRenderer.update(presentationDelta);
    this.stepEnemyFlinches(presentationDelta);
    this.stepCameraPunch(presentationDelta);
    this.damageNumberRenderer.update(deltaMs, this.time.now, prefersReducedPaperMotion());
    this.updateHud();
    this.updateRunState();
    this.updateLevelWindow();
    this.updateCarousel();
    this.updateDebug();
  }

  private projectXpPoint(x: number, y: number, out: XpMotePoint): void {
    out.x = x;
    out.y = this.belt ? this.beltY(y) : y;
  }

  /** Stable reward socket derived from the rendered rig root; avoids targeting stale server coordinates. */
  private xpCatchPoint(collectorId: string, out: XpMotePoint): boolean {
    const rig = this.blobs.get(collectorId);
    if (!rig) return false;
    out.x = rig.root.x;
    out.y = rig.root.y - 25 * Math.max(0.7, Math.abs(rig.root.scaleY));
    return true;
  }

  private updateXpMotes(deltaMs: number): void {
    if (!this.room || !this.xpMotes || !this.room.state.xpEchoes) return;
    const timelineMs = this.timeline.ready
      ? this.timeline.renderTime(this.time.now)
      : this.room.state.tick * TICK_MS - INTERP_DELAY_MS;
    this.xpMotes.update(
      this.room.state.xpEchoes,
      XpMoteRenderer.renderTick(timelineMs),
      deltaMs,
      prefersReducedPaperMotion(),
    );
  }

  /** One delivered patch owns the catch ring, squad HUD pulse, pitch bucket, and optional +N label. */
  private onXpReceipt(event: XpMoteReceipt): void {
    const now = this.time.now;
    const vastaghar = this.room?.state.vastaghar;
    if (
      !this.vastagharCrownCaught &&
      vastaghar?.active &&
      vastaghar.victoryXp > 0 &&
      event.value >= vastaghar.victoryXp
    ) {
      this.vastagharCrownCaught = true;
      this.audio.duckBossScore(5, 0.34);
    }
    this.xpPulse = Math.min(1, Math.max(this.xpPulse, 0.56 + Math.log2(1 + event.value) * 0.1));
    let batch = this.xpReceiptBatches.get(event.collectorId);
    if (!batch || now - batch.lastAt > 200) {
      batch = { value: 0, x: event.x, y: event.y, lastAt: now };
      this.xpReceiptBatches.set(event.collectorId, batch);
    }
    batch.value += event.value;
    batch.x = event.x;
    batch.y = event.y;
    batch.lastAt = now;

    if (now - this.xpReceiptLastAt > 320) this.xpAudioStreak = 0;
    this.xpReceiptLastAt = now;
    const self = this.room?.state.players.get(this.room.sessionId);
    const levelEdge = !!self && this.prevLevel >= 0 && self.level > this.prevLevel;
    if (!levelEdge && now - this.xpAudioLastAt >= 70) {
      // A single low-priority receipt note rises across the catch streak; loot keeps its own rare arpeggio.
      this.audio.play("xpTick", {
        x: event.x,
        amt: Math.min(1, this.xpAudioStreak * 0.06 + Math.log2(1 + event.value) * 0.12),
      });
      this.xpAudioStreak = Math.min(16, this.xpAudioStreak + 1);
      this.xpAudioLastAt = now;
    }
  }

  private updateXpReceiptLabels(): void {
    const now = this.time.now;
    for (const [collectorId, batch] of this.xpReceiptBatches) {
      if (now - batch.lastAt < 200) continue;
      this.xpReceiptBatches.delete(collectorId);
      if (batch.value < 5) continue;
      if (batch.value >= 12)
        this.audio.play("xpCadence", {
          x: batch.x,
          amt: Math.min(1, Math.log2(1 + batch.value) / 6),
        });
      const txt = this.add
        .text(batch.x, batch.y - 34, `+${batch.value} XP`, {
          fontFamily: "monospace",
          fontSize: "14px",
          color: "#c9f8ff",
          fontStyle: "bold",
          stroke: "#07131d",
          strokeThickness: 4,
        })
        .setOrigin(0.5)
        .setDepth(99996);
      this.tweens.add({
        targets: txt,
        y: batch.y - 60,
        alpha: 0,
        duration: 520,
        ease: "Cubic.easeOut",
        onComplete: () => txt.destroy(),
      });
    }
  }

  /** Reconcile the always-allocated worm state to exactly one batch rig and suppress its compatibility root. */
  private syncWormRig(): void {
    const state = this.room?.state.wormBoss;
    if (!this.room || !state?.active || !state.ownerId) {
      this.wormRig?.destroy();
      this.wormRig = null;
      return;
    }
    if (!this.wormRig || this.wormRig.ownerId !== state.ownerId) {
      this.wormRig?.destroy();
      this.wormRig = new WormRig(this, state, this.room.state.tick);
      this.wormRig.setProjection(this.belt ? BELT_Y0 : 0, this.belt ? BELT_FORESHORTEN : 1);
    }
    const duplicateRoot = this.enemies.get(state.ownerId);
    if (duplicateRoot) {
      duplicateRoot.destroy();
      this.enemies.delete(state.ownerId);
      this.enemyPaperPriority.delete(state.ownerId);
      this.enemyAtk.delete(state.ownerId);
      this.enemyWindup.delete(state.ownerId);
      this.meleeFullTells.delete(state.ownerId);
      this.enemyBufs.delete(state.ownerId);
    }
  }

  /** Reconcile rendered enemies against authoritative state (same race-proof pattern as blobs). */
  private syncEnemies(): void {
    const room = this.room;
    if (!room) return;
    this.syncWormRig();
    const enemies = room.state.enemies;
    const wormOwner = room.state.wormBoss.active ? room.state.wormBoss.ownerId : "";
    const vastagharOwner = room.state.vastaghar.active ? room.state.vastaghar.ownerId : "";
    const reducedMotion = prefersReducedPaperMotion();
    enemies.forEach((enemy, id) => {
      if (id === wormOwner) return;
      if (ENEMY_KINDS[enemy.kind]?.archetype === "boss") {
        this.lastBossX = enemy.x;
        this.lastBossY = enemy.y;
      }
      if (!this.enemies.has(id)) {
        const kind = ENEMY_KINDS[enemy.kind];
        const rig = new SpriteRig(
          this,
          enemy.x,
          enemy.y,
          false,
          id,
          resolveEnemySprite(kind, enemy.kind),
        );
        // Bosses use their own scale; tough kin scale up + glow (§15/§28.6 bigger not detailed).
        if (kind?.renderScale) rig.setRigScale(kind.renderScale);
        else if (enemy.tough) rig.setRigScale(TOUGH_SCALE);
        // §33 a truly colossal boss (renderScale ≥10) frames feet-at-ground with its torso off the top —
        // "you only see his lower body". ~0.45 body-heights lifts the torso up so the legs sit at ground
        // level (0.5 = the very bottom at the ground line). Tunable knob if it wants more/less leg on screen.
        if ((kind?.renderScale ?? 0) >= 10) rig.setLowerBodyFrame(0.45);
        if (enemy.tough) rig.addGlow(0xff5d3b);
        // §15 duelist (ronin): visibly WIELD its sword (held-sprite on the enemy rig).
        if (kind?.wieldsWeapon) {
          const wdef = WEAPONS[kind.wieldsWeapon];
          const wman = SPRITES[kind.wieldsWeapon as keyof typeof SPRITES];
          if (wdef && wman) rig.equipWeapon(kind.wieldsWeapon, wdef, wman);
        }
        const paperPriority: 0 | 1 | 2 = kind?.archetype === "boss" ? 2 : enemy.tough ? 1 : 0;
        this.enemyPaperPriority.set(id, paperPriority);
        if (!reducedMotion && id !== vastagharOwner)
          rig.playSpawnUnfold(this.animClock, paperPriority > 0 ? 280 : 220);
        this.enemies.set(id, rig);
        this.enemyAtk.set(id, enemy.atkSeq);
        if (vastagharOwner && enemy.kind === "mote-swarm")
          this.vastagharVfx.emitAddEntrance(
            enemy.x,
            enemy.y,
            (room.state.tick ^ (telegraphHash01(id) * 0xffff_ffff)) >>> 0,
            reducedMotion,
          );
      }
      // `atkSeq` is the authoritative contact edge. Continue from the sampled loaded pose; never replay a
      // complete swing from idle after the damage patch has already landed.
      if (enemy.atkSeq !== this.enemyAtk.get(id)) {
        this.enemyAtk.set(id, enemy.atkSeq);
        const sample = this.enemyWindup.get(id);
        let aimWorld = sample?.aimWorld ?? 0;
        if (!sample) {
          let bestD = Number.POSITIVE_INFINITY;
          this.room?.state.players.forEach((p) => {
            if (!p.alive) return;
            const d = (p.x - enemy.x) ** 2 + (p.y - enemy.y) ** 2;
            if (d < bestD) {
              bestD = d;
              aimWorld = Math.atan2(p.y - enemy.y, p.x - enemy.x);
            }
          });
        }
        if (sample?.active) this.enemies.get(id)?.resolveMeleeTell(this.time.now, aimWorld);
        if (sample) {
          const melee = effectiveMelee(ENEMY_KINDS[enemy.kind]);
          sample.step = melee ? (sample.step + 1) % melee.hits : 0;
          sample.lastAtkSeq = enemy.atkSeq;
          sample.serverT = 0;
          sample.previousT = 0;
          sample.shownT = 0;
          sample.remainingMs = 0;
          sample.active = false;
          sample.locked = false;
        }
      }
    });
    for (const id of this.enemies.keys()) {
      if (!enemies.has(id)) {
        // Enemy gone from authoritative state → it died (or left view). Detach it from the animated set
        // FIRST, then either fall into the void (§17 pit) or get the §20 DEATH-POP (launch + tumble).
        const rig = this.enemies.get(id);
        const paperPriority = this.enemyPaperPriority.get(id) ?? 0;
        if (rig && paperPriority === 2) {
          this.lastBossX = rig.x;
          this.lastBossY = rig.y;
        }
        const finalPresentation = this.finalBlowPresentations.get(id);
        const previousHp = this.enemyHp.get(id);
        if (
          rig &&
          previousHp !== undefined &&
          previousHp > 0 &&
          this.time.now >= this.removalFxMuteUntil &&
          !this.finalDeltaTargets.has(id)
        ) {
          this.finalDeltaTargets.add(id);
          this.combatFeedback.ingestHpDelta(
            {
              targetId: id,
              damage: previousHp,
              x: rig.x,
              y: rig.y - 26,
              visible: this.cameras.main.worldView.contains(rig.x, rig.y),
            },
            this.time.now,
          );
        }
        this.damageNumberRenderer.targetGone(id);
        this.hitEffectRenderer.targetGone(id);
        this.enemyFlinches.delete(id);
        this.enemies.delete(id);
        this.enemyPaperPriority.delete(id);
        this.enemyHp.delete(id);
        this.enemyCrit.delete(id);
        this.enemyAtk.delete(id);
        this.enemyWindup.delete(id);
        this.enemyComboPresentation.delete(id);
        this.meleeFullTells.delete(id);
        this.enemyBufs.delete(id); // §4 v0.107 ids RECYCLE (restart resets enemySeq) — never bracket stale snaps
        if (rig) {
          // §6 v0.103: a rift descent bulk-clears the horde — those removals are "left behind", not
          // kills. During the mute window they vanish silently (no pop/poof/hit-stop celebration).
          if (this.time.now < this.removalFxMuteUntil) {
            rig.destroy();
            continue;
          }
          if (this.arenaMap && isPitAtPx(this.arenaMap, rig.x, rig.y)) {
            spawnFallStreak(this, rig.x, rig.y); // fell over a pit → sinks into the void, no pop
            this.audio.play("pitdeath", { x: rig.x }); // §19 downward "whoo" into the void
            rig.deathPop(0, 0, "pit");
            this.paperDeaths.push({ rig, full: false });
          } else {
            const flagshipDeath =
              id === vastagharOwner && room.state.vastaghar.mode === VastagharMode.Victory;
            if (flagshipDeath) {
              const visible = this.cameras.main.worldView.contains(rig.x, rig.y);
              if (visible) {
                const full = !reducedMotion;
                rig.deathPop(0, 0, full ? "tear" : "lite");
                this.paperDeaths.push({ rig, full });
              } else {
                rig.destroy();
              }
              continue; // the epoch director owns the one death sound, pack stack, shake, and crown order
            }
            spawnPoof(this, rig.x, rig.y); // dust at the kill point
            this.audio.play("death", { x: rig.x }); // §19 kill crunch (throttled for horde clears)
            // §20 death-pop: fling the corpse AWAY from the nearest living player (≈ the killer) + up.
            const deathSeed = telegraphHash01(id);
            let ax = finalPresentation?.dirX ?? Math.cos(deathSeed * Math.PI * 2);
            let ay = finalPresentation?.dirY ?? Math.sin(deathSeed * Math.PI * 2);
            let best = Number.POSITIVE_INFINITY;
            let killWeapon: WeaponDef | undefined = finalPresentation
              ? WEAPONS[finalPresentation.weaponId]
              : undefined;
            if (!finalPresentation)
              this.room?.state.players.forEach((p) => {
                if (!p.alive) return;
                const d = Math.hypot(rig.x - p.x, rig.y - p.y);
                if (d < best) {
                  best = d;
                  ax = rig.x - p.x;
                  ay = rig.y - p.y;
                  killWeapon = WEAPONS[p.weapon];
                }
              });
            // §49 state does not serialize a final-blow owner; reuse the established nearest-live-player
            // killer approximation that already drives corpse launch, then let the pack's own frame gate
            // keep storm/tesla, buzzsaw and tide-family horde clears subtle + bounded.
            spawnWeaponKillFx(this, rig.x, rig.y, killWeapon);
            const al = Math.hypot(ax, ay) || 1;
            const dist = 70 + deathSeed * 60;
            const visible = Phaser.Geom.Rectangle.Contains(
              this.cameras.main.worldView,
              rig.x,
              rig.y,
            );
            const fullActive = this.paperDeaths.reduce(
              (count, death) => count + (death.full ? 1 : 0),
              0,
            );
            const fullLimit =
              paperPriority > 0 ? PAPER_DEATH_FULL_BUDGET : PAPER_DEATH_ORDINARY_BUDGET;
            const full = visible && !reducedMotion && fullActive < fullLimit;
            const variants: readonly PaperDeathTreatment[] = ["crumple", "flutter", "tear"];
            const treatment: PaperDeathTreatment = full
              ? paperPriority > 0
                ? "tear"
                : (variants[Math.floor(deathSeed * variants.length)] ?? "crumple")
              : "lite";
            if (visible) {
              rig.deathPop((ax / al) * dist, (ay / al) * dist, treatment);
              this.paperDeaths.push({ rig, full });
              this.paperPeakObjects = Math.max(
                this.paperPeakObjects,
                this.paperDeaths.length + this.closingPickups.size + (this.paperWorldFold ? 4 : 0),
              );
            } else {
              rig.destroy();
            }
            // H3 §20 hit-stop: a brief crunch when a kill lands near YOU (≈ your kill). Throttled so a
            // horde-clearing AoE can't chain freezes into lag; parry/quake stops override via Math.max.
            const selfId = this.room?.sessionId;
            const me = selfId ? this.room?.state.players.get(selfId) : undefined;
            if (
              !finalPresentation &&
              me?.alive &&
              Math.hypot(rig.x - me.x, rig.y - me.y) < 420 &&
              this.time.now - this.lastKillStop >= 110
            ) {
              this.lastKillStop = this.time.now;
              this.hitStop(45);
            }
          }
        }
      }
    }
  }

  /** Detached corpses share the rig clock's freeze policy without adding Tween-manager records. */
  private updatePaperDeaths(deltaMs: number): void {
    for (let i = this.paperDeaths.length - 1; i >= 0; i--) {
      const death = this.paperDeaths[i];
      if (!death || death.rig.stepDeathPop(deltaMs)) continue;
      this.paperDeaths.splice(i, 1);
    }
  }

  private interpolateEnemies(_deltaMs: number): void {
    if (!this.room) return;
    // §4 v0.107: the horde renders its snapshot rings at the delayed server-tick timeline — smooth,
    // faithful motion between real 20Hz positions (no τ-trail, no jitter rubber-band). A bracket gap
    // wider than INTERP_SNAP_ENEMY (a reposition; parry-knock ~154px/tick stays under it) CUTS instead
    // of tweening. Fallback = raw state while the timeline warms up.
    const rt = this.timeline.ready ? this.timeline.renderTime(this.time.now) : -1;
    this.room.state.enemies.forEach((enemy, id) => {
      const rig = this.enemies.get(id);
      if (!rig) return;
      const s =
        rt >= 0
          ? this.enemyBufs.get(id)?.sampleInto(rt, INTERP_SNAP_ENEMY, this.enemySample)
          : null;
      if (s) rig.setPosition(s.x, s.y);
      else rig.setPosition(enemy.x, enemy.y);
    });
  }

  /** Sample every worm slot from one delayed batch bracket; the rig owns all topology/action presentation. */
  private interpolateWorm(deltaMs: number): void {
    const state = this.room?.state;
    if (!state || !this.wormRig || !state.wormBoss.active) return;
    const renderTime = this.timeline.ready
      ? this.timeline.renderTime(this.time.now)
      : Math.max(0, state.tick * TICK_MS - INTERP_DELAY_MS);
    this.wormRig.update(renderTime, state.wormBoss, state.tick, this.time.now, deltaMs);
  }

  /** Exact local danger cancels spectacle camera weather; no Vastaghar path ever pans or zooms ownership. */
  private localPlayerInVastagharDanger(): boolean {
    const room = this.room;
    if (!room || !room.state.vastaghar.active) return false;
    const self = room.state.players.get(room.sessionId);
    if (!self?.alive) return true;
    const ownerId = room.state.vastaghar.ownerId;
    const projectionYScale = this.belt ? BELT_FORESHORTEN : 1;
    const selfY = projectTelegraphY(self.y, projectionYScale);
    for (const cached of this.telegraphCache.values()) {
      if (cached.ownerId !== ownerId || cached.t >= 0.999) continue;
      if (telegraphGeometryContains(cached.geometry, self.x, selfY)) return true;
    }
    const frame = this.vastagharVfx.presentation;
    const action = VASTAGHAR_ACTIONS[frame.actionKind];
    const radius = action?.stepRadii[frame.stepIndex] ?? action?.stepRadii[0] ?? 0;
    return (
      frame.responseActive &&
      radius > 0 &&
      Math.hypot(self.x - frame.impactX, self.y - frame.impactY) <= radius
    );
  }

  private updateVastagharPresentation(deltaMs: number): void {
    const room = this.room;
    if (!room || !this.vastagharVfx) return;
    const state = room.state.vastaghar;
    const owner = state.ownerId ? room.state.enemies.get(state.ownerId) : undefined;
    const rig = state.ownerId ? this.enemies.get(state.ownerId) : undefined;
    const self = room.state.players.get(room.sessionId);
    const selfRig = this.blobs.get(room.sessionId);
    const fallbackBossX = Number.isFinite(this.lastBossX) ? this.lastBossX : 0;
    const fallbackBossY = Number.isFinite(this.lastBossY) ? this.lastBossY : 0;
    // Limbs and answer glints use the estimated current server timeline. Remote root translation keeps its
    // ordinary interpolation delay, but delaying a five-tick response surface would make the body lie.
    const estimatedPresentationMs = this.timeline.ready
      ? this.timeline.renderTime(this.time.now) + INTERP_DELAY_MS
      : room.state.tick * TICK_MS;
    const authorityMs = room.state.tick * TICK_MS;
    const presentationMs = Math.max(
      authorityMs,
      Math.min(authorityMs + TICK_MS, estimatedPresentationMs),
    );
    this.vastagharVfx.update(
      {
        state,
        authorityTick: room.state.tick,
        renderTick: presentationMs / TICK_MS,
        bossX: rig?.x ?? owner?.x ?? fallbackBossX,
        bossY: rig?.y ?? owner?.y ?? fallbackBossY,
        localX: selfRig?.x ?? self?.x ?? 0,
        localY: selfRig?.y ?? self?.y ?? 0,
        localThreatened: this.localPlayerInVastagharDanger(),
        reducedMotion: prefersReducedPaperMotion() || this.feedbackSettings.flashes === "reduced",
      },
      deltaMs,
    );
  }

  private applyVastagharRigPose(
    rig: SpriteRig,
    frame: VastagharPresentationFrame,
    anim: RigAnim,
  ): void {
    rig.setVastagharPose(frame);
    const ownsBody =
      frame.transitionActive ||
      frame.downedGuard ||
      (frame.actionKind !== VastagharActionKind.None && frame.actionT < 1);
    if (!ownsBody) return;
    anim.speed = 0;
    anim.moveX = Math.cos(frame.aim);
    anim.moveY = Math.sin(frame.aim);
    anim.aimDir = frame.aim;
  }

  /** Select one authoritative boss anticipation clock; concurrent casts never blend contradictory poses. */
  private resolveBossTelegraphPose(): void {
    const pose = this.bossTelegraphPose;
    pose.active = false;
    pose.id = "";
    pose.score = -1;
    const state = this.room?.state;
    if (!state?.bossKind) return;
    state.telegraphs.forEach((row, id) => {
      if (row.t >= 0.999) return; // active hazards/recovery must not hold the source in anticipation
      const priority =
        row.kindTag === TelegraphKindTag.Melee || row.kindTag === TelegraphKindTag.Quake
          ? 7
          : row.kindTag === TelegraphKindTag.Charge
            ? 6
            : row.kindTag === TelegraphKindTag.Slam
              ? 5
              : row.kindTag === TelegraphKindTag.Radial ||
                  row.kindTag === TelegraphKindTag.ExpandingRing
                ? 4
                : 3;
      const score = row.t * 1000 + priority;
      if (score <= pose.score) return;
      pose.active = true;
      pose.id = id;
      pose.shape = row.shape;
      pose.x = row.x;
      pose.y = row.y;
      pose.rot = row.rot;
      pose.t = row.t;
      pose.danger = row.danger;
      pose.kindTag = row.kindTag;
      pose.score = score;
    });
  }

  /**
   * §TELEGRAPH drive a cheap planted boss silhouette through SpriteRig's existing public animation hooks.
   * Nul/Quickdraw's bare rect captures the row axis directly: no nearest-player reacquisition is allowed.
   */
  private applyBossTelegraphPose(rig: SpriteRig, bossKind: string, anim: RigAnim): void {
    const pose = this.bossTelegraphPose;
    if (!pose.active) return;
    if (pose.id !== this.bossPoseRowId) {
      this.bossPoseRowId = pose.id;
      this.bossPoseBeatMask = 0;
    }

    let aimWorld = pose.rot;
    const directional =
      pose.shape === TgShape.Rect || pose.shape === TgShape.ArcSweep || pose.shape === TgShape.Cone;
    if (!directional && pose.kindTag !== TelegraphKindTag.Radial) {
      const dx = pose.x - rig.x;
      const dy = pose.y - rig.y;
      if (Math.abs(dx) + Math.abs(dy) > 0.01) aimWorld = Math.atan2(dy, dx);
    }
    const projectionYScale = this.belt ? BELT_FORESHORTEN : 1;
    let aimX = Math.cos(aimWorld);
    let aimY = Math.sin(aimWorld) * projectionYScale;
    const aimLen = Math.hypot(aimX, aimY) || 1;
    aimX /= aimLen;
    aimY /= aimLen;

    // Plant locomotion and feed the captured screen-plane axis through the existing aim contract. Directional
    // rows visibly own their lane; symmetric gathers retain facing but still enter the two-hand brace pose.
    anim.moveX = directional ? aimX : 0;
    anim.moveY = directional ? aimY : 0;
    anim.speed = 0;
    anim.aimX = directional ? aimX * (0.45 + pose.t * 0.55) : 0;
    anim.aimY = directional ? aimY * (0.45 + pose.t * 0.55) : 0;
    anim.aimDxPx = directional ? aimX * 100 : undefined;
    anim.aimDir = Math.atan2(aimY, aimX);
    anim.isSelf = true;

    // The public brace envelope owns body squash, both hands, and planted feet. Sampling it at Claim and
    // Lock gives late patches an immediate catch-up pose and leaves its authored ~135ms release as recovery.
    const lockAt = pose.kindTag === TelegraphKindTag.Charge ? 0.58 : 0.62;
    if ((this.bossPoseBeatMask & 1) === 0) {
      rig.triggerBrace(this.animClock);
      this.bossPoseBeatMask |= 1;
    }
    if (pose.t >= 0.32 && (this.bossPoseBeatMask & 2) === 0) {
      rig.triggerBrace(this.animClock);
      this.bossPoseBeatMask |= 2;
    }
    if (pose.t >= lockAt && (this.bossPoseBeatMask & 4) === 0) {
      rig.triggerBrace(this.animClock);
      this.bossPoseBeatMask |= 4;
    }

    // Nul's Sightline Compression is the panel's bare-rectangle hero case: the authoritative rect axis is
    // already driving the eye/body turn above, while repeated Claim/Load/Lock braces compress its sliced
    // hands/body and suppress all ordinary gait for the full charge. Quickdraw shares the same lane hook.
    if (bossKind === "nul-sightline" || bossKind === "quickdraw-vane") anim.speed = 0;
  }

  /** Match the only danger-0/kind-2 circle vocabulary to a combo leaper. The authoritative row supplies
   * x/y/radius; nearest unclaimed ownership is merely presentation association and never re-derives it. */
  private claimEnemyComboMarker(
    enemy: { kind: string; x: number; y: number },
    presentation: EnemyComboPresentation,
  ): void {
    const state = this.room?.state;
    if (!state || !ENEMY_KINDS[enemy.kind]?.comboLeap) return;
    if (presentation.markerId) {
      const retained = state.telegraphs.get(presentation.markerId);
      if (retained) {
        presentation.markerX = retained.x;
        presentation.markerY = retained.y;
        presentation.markerRadius = retained.a;
        this.comboMarkerClaims.add(presentation.markerId);
        return;
      }
      const stillPresenting =
        (presentation.presentedFlags & COMBO_FLAG_AIRBORNE) !== 0 ||
        (presentation.hasPending && (presentation.pendingFlags & COMBO_FLAG_AIRBORNE) !== 0) ||
        (presentation.observedFlags & COMBO_FLAG_AIRBORNE) !== 0;
      if (stillPresenting) return;
      presentation.markerId = "";
    }

    let bestId = "";
    let bestDistance = Number.POSITIVE_INFINITY;
    state.telegraphs.forEach((row, markerId) => {
      if (
        this.comboMarkerClaims.has(markerId) ||
        row.shape !== TgShape.Circle ||
        row.danger !== 0 ||
        row.kindTag !== 2
      )
        return;
      const distance = Math.hypot(row.x - enemy.x, row.y - enemy.y);
      if (
        distance > COMBO_LEAP_RANGE + 80 ||
        distance > bestDistance ||
        (distance === bestDistance && bestId !== "" && markerId >= bestId)
      )
        return;
      bestDistance = distance;
      bestId = markerId;
    });
    if (!bestId) return;
    const row = state.telegraphs.get(bestId);
    if (!row) return;
    presentation.markerId = bestId;
    presentation.markerX = row.x;
    presentation.markerY = row.y;
    presentation.markerRadius = row.a;
    this.comboMarkerClaims.add(bestId);
  }

  private enemyComboAimWorld(
    enemy: { x: number; y: number },
    presentation: EnemyComboPresentation,
  ): number {
    let aimWorld = 0;
    let best = Number.POSITIVE_INFINITY;
    this.room?.state.players.forEach((player) => {
      if (!player.alive) return;
      // During the offer, the challenged victim is normally the living player nearest the committed
      // footprint; afterward the nearest live body is the best synced head/lean anchor available.
      const anchorX = presentation.markerId ? presentation.markerX : enemy.x;
      const anchorY = presentation.markerId ? presentation.markerY : enemy.y;
      const distance = (player.x - anchorX) ** 2 + (player.y - anchorY) ** 2;
      if (distance >= best) return;
      best = distance;
      aimWorld = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    });
    return aimWorld;
  }

  /** Apply queued seq/flag edges on the same delayed server timeline as the enemy's snapshot position. */
  private presentEnemyCombo(
    id: string,
    rig: SpriteRig,
    enemy: { kind: string; x: number; y: number; comboSeq: number; comboFlags: number },
    moveX: number,
    moveY: number,
    reducedMotion: boolean,
    anim: RigAnim,
  ): void {
    let presentation = this.enemyComboPresentation.get(id);
    if (!presentation) {
      presentation = {
        observedSeq: enemy.comboSeq,
        observedFlags: enemy.comboFlags,
        presentedSeq: enemy.comboSeq,
        presentedFlags: enemy.comboFlags,
        pendingSeq: enemy.comboSeq,
        pendingFlags: enemy.comboFlags,
        pendingTick: this.room?.state.tick ?? 0,
        pendingStagger: false,
        hasPending: false,
        leapStartTick: this.room?.state.tick ?? 0,
        markerId: "",
        markerX: enemy.x,
        markerY: enemy.y,
        markerRadius: ENEMY_RADIUS + 10,
        launchX: rig.x,
        launchY: rig.y,
      };
      this.enemyComboPresentation.set(id, presentation);
    }
    this.claimEnemyComboMarker(enemy, presentation);
    const presentationSignals =
      presentation.observedFlags | presentation.presentedFlags | presentation.pendingFlags;
    if (!presentation.markerId && presentationSignals === 0 && !presentation.hasPending) {
      anim.jumpVh = 0;
      rig.setEnemyComboPresentation(0, 0, false, 0);
      return;
    }
    const renderTime = this.timeline.ready
      ? this.timeline.renderTime(this.time.now)
      : (this.room?.state.tick ?? 0) * TICK_MS;
    const aimWorld = this.enemyComboAimWorld(enemy, presentation);
    const projectionYScale = this.belt ? BELT_FORESHORTEN : 1;
    const markerY = this.belt ? this.beltY(presentation.markerY) : presentation.markerY;
    const rigY = this.belt ? this.beltY(rig.y) : rig.y;
    const markerVisible =
      !!presentation.markerId &&
      this.cameras.main.worldView.contains(presentation.markerX, presentation.markerY);
    const visible = markerVisible || this.cameras.main.worldView.contains(rig.x, rig.y);

    if (presentation.hasPending && renderTime >= presentation.pendingTick * TICK_MS) {
      const priorFlags = presentation.presentedFlags;
      presentation.presentedSeq = presentation.pendingSeq;
      presentation.presentedFlags = presentation.pendingFlags;
      presentation.hasPending = false;
      const launched =
        (priorFlags & COMBO_FLAG_AIRBORNE) === 0 &&
        (presentation.presentedFlags & COMBO_FLAG_AIRBORNE) !== 0;
      const landed =
        (priorFlags & COMBO_FLAG_AIRBORNE) !== 0 &&
        (presentation.presentedFlags & COMBO_FLAG_AIRBORNE) === 0;
      const empowered =
        (priorFlags & COMBO_FLAG_EMPOWERED) === 0 &&
        (presentation.presentedFlags & COMBO_FLAG_EMPOWERED) !== 0;
      const empowermentEnded =
        (priorFlags & COMBO_FLAG_EMPOWERED) !== 0 &&
        (presentation.presentedFlags & COMBO_FLAG_EMPOWERED) === 0;
      if (launched) {
        presentation.leapStartTick = presentation.pendingTick;
        presentation.launchX = rig.x;
        presentation.launchY = rig.y;
        this.audio.play("enemy-combo:leap-launch", { x: rig.x, amt: visible ? 0.7 : 0.25 });
      }
      if (landed) {
        rig.triggerEnemyComboLanding(this.animClock);
        if (presentation.markerId) {
          if (visible)
            this.jumpEffectRenderer.spawnEnemyComboLanding(
              presentation.markerX,
              markerY,
              presentation.markerRadius,
              reducedMotion,
              projectionYScale,
            );
          this.audio.play("enemy-combo:leap-land", {
            x: presentation.markerX,
            amt: visible ? 0.72 : 0.24,
          });
          if (visible && !reducedMotion) this.shakeCam(85, 0.0042, "world");
        }
        presentation.markerId = "";
      }
      if (empowered) {
        rig.triggerEnemyComboReturn(this.animClock);
        let skidX = moveX;
        let skidY = moveY;
        if (Math.hypot(skidX, skidY) < 0.05) {
          skidX = -Math.cos(aimWorld);
          skidY = -Math.sin(aimWorld);
        }
        if (visible)
          this.jumpEffectRenderer.spawnEnemyReturnSkid(
            rig.x,
            rigY + PLAYER_SHADOW_LOCAL_Y,
            skidX,
            skidY,
            reducedMotion,
            projectionYScale,
            colorblindShapesEnabled(this.feedbackSettings.colorblindAssist),
          );
        this.audio.play("enemy-combo:return-tell", { x: rig.x, amt: visible ? 0.78 : 0.24 });
        if (visible) this.offerContextHint("empoweredReturn");
      }
      if (empowermentEnded && presentation.pendingStagger) {
        rig.triggerEnemyComboStagger(this.animClock);
        if (visible && !reducedMotion) this.shakeCam(70, 0.0036, "world");
      }
      presentation.pendingStagger = false;
    }

    const markerRow = presentation.markerId
      ? this.room?.state.telegraphs.get(presentation.markerId)
      : undefined;
    const airborne = (presentation.presentedFlags & COMBO_FLAG_AIRBORNE) !== 0;
    const leapFraction = airborne
      ? Math.max(
          0,
          Math.min(1, (renderTime - presentation.leapStartTick * TICK_MS) / ENEMY_COMBO_LEAP_MS),
        )
      : 0;
    const offerPhase =
      !airborne && markerRow
        ? enemyComboOfferPhase(markerRow.t, COMBO_LEAP_OFFER_TICKS, COMBO_LEAP_AIR_TICKS)
        : 0;
    const leapHeight = airborne ? enemyComboLeapHeight(leapFraction, ENEMY_COMBO_LEAP_PEAK) : 0;
    anim.jumpVh = airborne
      ? enemyComboLeapVelocity(leapFraction, ENEMY_COMBO_LEAP_MS, ENEMY_COMBO_LEAP_PEAK)
      : 0;
    rig.setEnemyComboPresentation(
      offerPhase,
      leapHeight,
      (presentation.presentedFlags & COMBO_FLAG_EMPOWERED) !== 0,
      aimWorld,
    );
    if (presentation.markerId && visible)
      this.jumpEffectRenderer.drawEnemyComboPromise(
        presentation.launchX,
        this.belt ? this.beltY(presentation.launchY) : presentation.launchY,
        presentation.markerX,
        markerY,
        presentation.markerRadius,
        leapFraction,
        offerPhase,
        airborne && !markerRow,
        reducedMotion,
        projectionYScale,
      );
  }

  /** Drive each enemy's procedural animation from its render-velocity (faces its travel dir). */
  private animateEnemies(deltaMs: number): void {
    this.telegraphGroundGfx.clear();
    this.telegraphGfx.clear(); // §8 redraw compact source/projectile timing cues fresh each frame
    this.resolveBossTelegraphPose();
    const state = this.room?.state;
    const now = this.time.now;
    const tick = state?.tick ?? 0;
    const self = state && this.room ? state.players.get(this.room.sessionId) : undefined;
    const reducedMotion = prefersReducedPaperMotion();
    this.meleeTellCandidates.length = 0;
    this.comboMarkerClaims.clear();
    if (state)
      for (const presentation of this.enemyComboPresentation.values()) {
        if (presentation.markerId && state.telegraphs.has(presentation.markerId))
          this.comboMarkerClaims.add(presentation.markerId);
      }

    // Sample every phase and rank salience once before any rig consumes it. Local intersections and attacks
    // that can reach self imminently are uncullable; distant horde tells collapse to one source bracket.
    if (state) {
      state.enemies.forEach((enemy, id) => {
        const kind = ENEMY_KINDS[enemy.kind];
        const melee = effectiveMelee(kind);
        if (!melee) return;
        const sample = this.sampleEnemyWindup(id, enemy, melee, tick, now);
        if (!sample?.active || kind?.archetype === "boss") return;
        const row = state.telegraphs.get(`${MELEE_TELEGRAPH_PREFIX}${id}`);
        const cx = row?.x ?? enemy.x;
        const cy = row?.y ?? enemy.y;
        let containsSelf = false;
        let distance = Number.POSITIVE_INFINITY;
        if (self?.alive) {
          const dx = self.x - cx;
          const dy = self.y - cy;
          const radial = Math.hypot(dx, dy);
          if (row) {
            containsSelf = inMeleeArc(
              { x: cx, y: cy },
              Math.cos(row.rot),
              Math.sin(row.rot),
              self,
              melee.range,
              melee.halfArc,
            );
            const angular = Math.abs(
              Math.atan2(
                Math.sin(Math.atan2(dy, dx) - row.rot),
                Math.cos(Math.atan2(dy, dx) - row.rot),
              ),
            );
            distance = Math.hypot(
              Math.max(0, radial - melee.range),
              Math.max(0, angular - melee.halfArc) * Math.min(radial, melee.range),
            );
          } else {
            containsSelf = radial <= melee.range + melee.step;
            distance = Math.max(0, radial - (melee.range + melee.step));
          }
        }
        this.meleeTellCandidates.push({
          id,
          containsSelf,
          distance,
          remainingMs: sample.remainingMs,
        });
      });
    }
    this.selectMeleeFullTells();

    const invDt = deltaMs > 0 ? 1000 / deltaMs : 0; // px/frame → px/s for the §5 gait
    for (const [id, rig] of this.enemies) {
      let mx = rig.x - rig.renderPrevX;
      let my = rig.y - rig.renderPrevY;
      const speed = Math.hypot(mx, my) * invDt; // §7 v0.105 raw render speed (px/s) drives the gait blend
      const ml = Math.hypot(mx, my);
      if (ml > 0.001) {
        mx /= ml;
        my /= ml;
      } else {
        mx = 0;
        my = 0;
      }
      rig.renderPrevX = rig.x;
      rig.renderPrevY = rig.y;
      const anim = this.enemyAnimInput;
      anim.moveX = mx;
      anim.moveY = my;
      anim.speed = speed;
      anim.aimX = 0;
      anim.aimY = 0;
      anim.aimDxPx = undefined;
      anim.aimDir = 0;
      anim.isSelf = false;
      anim.jumpVh = 0;
      anim.reducedMotion = reducedMotion;
      const es = this.room?.state.enemies.get(id);
      const windup = this.enemyWindup.get(id);
      if (es) this.presentEnemyCombo(id, rig, es, mx, my, reducedMotion, anim);
      if (es && windup?.active) {
        const kind = ENEMY_KINDS[es.kind];
        const comboFlags =
          this.enemyComboPresentation.get(id)?.presentedFlags ?? es.comboFlags ?? 0;
        const gold = (comboFlags & COMBO_FLAG_EMPOWERED) !== 0;
        rig.setMeleeTell(
          windup.shownT,
          windup.aimWorld,
          windup.remainingMs,
          windup.locked,
          kind?.archetype ?? "duelist",
          windup.step,
          kind?.archetype === "boss" || this.meleeFullTells.has(id),
          gold,
          (comboFlags & COMBO_FLAG_JUGGLE) !== 0,
        );
      }
      const vastaghar = this.room?.state.vastaghar;
      if (vastaghar?.active && id === vastaghar.ownerId) {
        this.applyVastagharRigPose(rig, this.vastagharVfx.presentation, anim);
      } else {
        rig.setVastagharPose(undefined);
        if (es && es.kind === this.room?.state.bossKind)
          this.applyBossTelegraphPose(rig, es.kind, anim);
      }
      rig.animate(this.animClock, anim);
      // §8 Brand tint — and §16 OLD RUST glows the same heat-orange at P3 ENRAGE (overheating).
      const enraged = es?.kind === "old-rust" && (this.room?.state.bossPhase ?? 0) >= 3;
      rig.setBranded((es?.branded ?? 0) > 0 || enraged);
      if (es && windup?.active) {
        const melee = effectiveMelee(ENEMY_KINDS[es.kind]);
        if (melee) {
          const row = state?.telegraphs.get(`${MELEE_TELEGRAPH_PREFIX}${id}`);
          const full = ENEMY_KINDS[es.kind]?.archetype === "boss" || this.meleeFullTells.has(id);
          const pulse =
            (now - windup.glintAtMs >= 0 && now - windup.glintAtMs <= MELEE_GLINT_CREST_MS) ||
            (now - windup.firstGlintAtMs >= 0 &&
              now - windup.firstGlintAtMs <= MELEE_GLINT_CREST_MS);
          const comboFlags =
            this.enemyComboPresentation.get(id)?.presentedFlags ?? es.comboFlags ?? 0;
          const gold = (comboFlags & COMBO_FLAG_EMPOWERED) !== 0;
          // A synced row already supplies the exact footprint below. The fallback ruler exists only before
          // that row arrives, so no selected windup draws both full ground geometries.
          if (full && !row)
            this.drawMeleeRangeRing(
              es.x,
              es.y,
              melee.range,
              melee.halfArc,
              windup.aimWorld,
              windup.shownT,
              windup.remainingMs,
              windup.remainingMs <= PARRY_IFRAMES * 1000,
              pulse,
              false,
            );
          this.drawMeleeImplementBracket(rig, windup.aimWorld, windup.shownT, pulse && full, gold);
        }
      }
      rig.setDepth(rig.y);
    }
    this.renderTelegraphs();
  }

  private sampleEnemyWindup(
    id: string,
    enemy: { windup: number; atkSeq: number; x: number; y: number; comboFlags?: number },
    melee: { windup: number; swingGap: number; hits: number },
    tick: number,
    now: number,
  ): EnemyWindupSample | undefined {
    const synced = Math.max(0, Math.min(1, enemy.windup));
    let sample = this.enemyWindup.get(id);
    if (synced <= 0) {
      if (sample?.active) {
        // `syncEnemies` marks a real `atkSeq` resolve inactive before this pass. Anything still active here
        // is a cancel/stagger and must not cross the contact keyframe.
        this.enemies.get(id)?.cancelMeleeTell(now);
        sample.active = false;
        sample.step = 0;
        sample.serverT = 0;
        sample.shownT = 0;
      }
      return sample;
    }

    const step = sample?.step ?? enemy.atkSeq % Math.max(1, melee.hits);
    let durationMs = (step === 0 ? melee.windup : melee.swingGap) * 1000;
    if (((enemy.comboFlags ?? 0) & COMBO_FLAG_EMPOWERED) !== 0)
      durationMs = Math.max(durationMs, 850);
    const newEpoch = !sample?.active || synced + 0.001 < sample.serverT;
    if (!sample) {
      sample = {
        serverT: synced,
        previousT: synced,
        serverTick: tick,
        previousTick: tick,
        observedAtMs: now,
        ratePerSecond: 1000 / Math.max(1, durationMs),
        shownT: synced,
        remainingMs: (1 - synced) * durationMs,
        durationMs,
        lastAtkSeq: enemy.atkSeq,
        step,
        active: true,
        aimWorld: 0,
        locked: false,
        glintAtMs: -1e9,
        firstGlintAtMs: -1e9,
        gold: false,
      };
      this.enemyWindup.set(id, sample);
    } else if (newEpoch) {
      sample.serverT = synced;
      sample.previousT = synced;
      sample.serverTick = tick;
      sample.previousTick = tick;
      sample.observedAtMs = now;
      sample.ratePerSecond = 1000 / Math.max(1, durationMs);
      sample.shownT = synced;
      sample.durationMs = durationMs;
      sample.remainingMs = (1 - synced) * durationMs;
      sample.lastAtkSeq = enemy.atkSeq;
      sample.active = true;
      sample.glintAtMs = -1e9;
      sample.firstGlintAtMs = -1e9;
      sample.gold = false;
    } else if (tick !== sample.serverTick) {
      const tickDelta = (tick - sample.serverTick) >>> 0;
      if (synced > sample.serverT && tickDelta > 0) {
        sample.ratePerSecond = (synced - sample.serverT) / ((tickDelta * TICK_MS) / 1000);
      }
      sample.previousT = sample.serverT;
      sample.previousTick = sample.serverTick;
      sample.serverT = synced;
      sample.serverTick = tick;
      sample.observedAtMs = now;
      if (sample.ratePerSecond > 0.001)
        durationMs = Math.max(300, Math.min(2_000, 1_000 / sample.ratePerSecond));
      sample.durationMs = durationMs;
    }
    durationMs = sample.durationMs;
    const extrapolateMs = Math.max(0, Math.min(TICK_MS, now - sample.observedAtMs));
    sample.shownT = Math.max(
      sample.serverT,
      Math.min(0.985, sample.serverT + sample.ratePerSecond * (extrapolateMs / 1000)),
    );
    const priorRemaining = sample.remainingMs;
    sample.remainingMs = Math.max(0, (1 - sample.shownT) * durationMs);
    const row = this.room?.state.telegraphs.get(`${MELEE_TELEGRAPH_PREFIX}${id}`);
    const gold = ((enemy.comboFlags ?? 0) & COMBO_FLAG_EMPOWERED) !== 0;
    const goldEpoch = gold && !sample.gold;
    if (goldEpoch) {
      // The empowerment edge can arrive mid-windup. Restart the retained crest cursor so a late edge still
      // produces two separated gold flashes rather than merging into the ordinary white crest.
      sample.glintAtMs = -1e9;
      sample.firstGlintAtMs = -1e9;
    }
    sample.gold = gold;
    const doublePulse = meleeTellUsesDoublePulse(this.feedbackSettings.colorblindAssist, gold);
    if (
      doublePulse &&
      sample.firstGlintAtMs < 0 &&
      sample.remainingMs <= MELEE_FIRST_GLINT_LEAD_MS &&
      (newEpoch || priorRemaining > MELEE_FIRST_GLINT_LEAD_MS || goldEpoch)
    )
      sample.firstGlintAtMs = now;
    if (
      sample.glintAtMs < 0 &&
      sample.remainingMs <= MELEE_FINAL_GLINT_LEAD_MS &&
      (newEpoch || priorRemaining > MELEE_FINAL_GLINT_LEAD_MS || doublePulse) &&
      (!doublePulse || now - sample.firstGlintAtMs >= 90)
    ) {
      sample.glintAtMs = now;
    }

    if (row) {
      sample.aimWorld = row.rot;
      sample.locked = true;
    } else {
      let best = Number.POSITIVE_INFINITY;
      this.room?.state.players.forEach((player) => {
        if (!player.alive) return;
        const d = (player.x - enemy.x) ** 2 + (player.y - enemy.y) ** 2;
        if (d < best) {
          best = d;
          sample!.aimWorld = Math.atan2(player.y - enemy.y, player.x - enemy.x);
        }
      });
      sample.locked = false;
    }
    return sample;
  }

  /** Keep intersections/near-term reaches plus a stable nearest-six budget for all remaining horde tells. */
  private selectMeleeFullTells(): void {
    this.meleeTellCandidates.sort(compareMeleeTellCandidates);
    const next = this.meleeFullTellNext;
    next.clear();
    for (const candidate of this.meleeTellCandidates) {
      if (
        candidate.containsSelf ||
        (candidate.distance <= 42 && candidate.remainingMs <= MELEE_FINAL_GLINT_LEAD_MS + 120)
      )
        next.add(candidate.id);
    }
    const targetSize = Math.max(MELEE_FULL_TELL_COUNT, next.size);
    for (const id of this.meleeFullTells) {
      if (next.size >= targetSize) break;
      for (const candidate of this.meleeTellCandidates) {
        if (candidate.id === id) {
          next.add(id);
          break;
        }
      }
    }
    for (const candidate of this.meleeTellCandidates) {
      if (next.size >= targetSize) break;
      next.add(candidate.id);
    }
    for (const challenger of this.meleeTellCandidates) {
      if (next.has(challenger.id) || next.size < targetSize) continue;
      let worst: MeleeTellCandidate | undefined;
      for (const incumbentId of next) {
        let incumbent: MeleeTellCandidate | undefined;
        for (const candidate of this.meleeTellCandidates) {
          if (candidate.id === incumbentId) {
            incumbent = candidate;
            break;
          }
        }
        if (
          incumbent &&
          !incumbent.containsSelf &&
          !(incumbent.distance <= 42 && incumbent.remainingMs <= MELEE_FINAL_GLINT_LEAD_MS + 120) &&
          (!worst || compareMeleeTellCandidates(incumbent, worst) > 0)
        )
          worst = incumbent;
      }
      if (!worst) continue;
      const priorityJump = challenger.containsSelf && !worst.containsSelf;
      const materiallyCloser =
        challenger.containsSelf === worst.containsSelf &&
        challenger.distance < worst.distance * 0.8;
      if (priorityJump || materiallyCloser) {
        next.delete(worst.id);
        next.add(challenger.id);
      }
    }
    this.meleeFullTellNext = this.meleeFullTells;
    this.meleeFullTells = next;
  }

  /** Stable real-reach ruler plus a separate inward beat; the full circle is visibly broken/approximate. */
  private drawMeleeRangeRing(
    x: number,
    y: number,
    range: number,
    halfArc: number,
    rot: number,
    t: number,
    remainingMs: number,
    armed: boolean,
    pulse: boolean,
    locked: boolean,
  ): void {
    const g = this.telegraphGroundGfx;
    const zoom = Math.max(0.01, this.cameras.main.zoom);
    const projectionYScale = this.belt ? BELT_FORESHORTEN : 1;
    const gap = 0.18;
    const segment = (Math.PI * 2) / 8;
    for (let pass = 0; pass < 2; pass++) {
      g.lineStyle(
        (pass === 0 ? 3.6 : pulse ? 2.7 : 1.35) / zoom,
        pass === 0 ? 0x17120f : 0xffffff,
        pass === 0 ? 0.3 : 0.13 + t * 0.16 + (armed ? 0.09 : 0) + (pulse ? 0.42 : 0),
      );
      for (let i = 0; i < 8; i++) {
        const start = rot + i * segment + gap;
        this.traceProjectedArc(
          g,
          x,
          y,
          range,
          start,
          rot + (i + 1) * segment - gap,
          projectionYScale,
          zoom,
        );
      }
    }
    // The weapon-facing interval is solid, while the rear/side envelope stays broken and secondary.
    g.lineStyle(3.8 / zoom, 0x17120f, 0.34);
    this.traceProjectedArc(g, x, y, range, rot - halfArc, rot + halfArc, projectionYScale, zoom);
    g.lineStyle((pulse ? 3 : 1.8) / zoom, 0xffffff, 0.22 + t * 0.22 + (pulse ? 0.42 : 0));
    this.traceProjectedArc(g, x, y, range, rot - halfArc, rot + halfArc, projectionYScale, zoom);
    // Bright completion travels symmetrically from the sector ends toward the forward notch.
    g.lineStyle((pulse ? 3.4 : 2.2) / zoom, 0xffffff, 0.32 + t * 0.42);
    this.traceProjectedArc(
      g,
      x,
      y,
      range,
      rot - halfArc,
      rot - halfArc + halfArc * t,
      projectionYScale,
      zoom,
    );
    this.traceProjectedArc(
      g,
      x,
      y,
      range,
      rot + halfArc - halfArc * t,
      rot + halfArc,
      projectionYScale,
      zoom,
    );

    // The final three server ticks pull a second ring inward; the fixed notched reach ruler remains behind.
    if (remainingMs <= 150) {
      const beat = Math.max(0, Math.min(1, remainingMs / 150));
      const beatRange = range * (0.18 + beat * 0.82);
      g.lineStyle((pulse ? 3 : 1.8) / zoom, 0xffffff, 0.24 + (1 - beat) * 0.34);
      this.traceProjectedArc(
        g,
        x,
        y,
        beatRange,
        rot - halfArc,
        rot + halfArc,
        projectionYScale,
        zoom,
      );
    }
    this.drawMeleeRangeNotches(g, x, y, range, rot, projectionYScale, zoom, t, armed, locked);
  }

  private traceProjectedArc(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    range: number,
    start: number,
    end: number,
    projectionYScale: number,
    zoom: number,
  ): void {
    const span = Math.abs(end - start);
    const samples = Math.max(2, Math.min(24, Math.ceil((span * Math.max(1, range * zoom)) / 12)));
    g.beginPath();
    g.moveTo(
      x + Math.cos(start) * range,
      projectTelegraphY(y + Math.sin(start) * range, projectionYScale),
    );
    for (let i = 0; i <= samples; i++) {
      const angle = start + ((end - start) * i) / samples;
      g.lineTo(
        x + Math.cos(angle) * range,
        projectTelegraphY(y + Math.sin(angle) * range, projectionYScale),
      );
    }
    g.strokePath();
  }

  private drawMeleeRangeNotches(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    range: number,
    rot: number,
    projectionYScale: number,
    zoom: number,
    t: number,
    armed: boolean,
    locked: boolean,
  ): void {
    const len = (locked ? 9 : 7) / zoom;
    for (let pass = 0; pass < 2; pass++) {
      g.lineStyle(
        (pass === 0 ? 4 : armed ? 2.2 : 1.8) / zoom,
        pass === 0 ? 0x17120f : 0xffffff,
        pass === 0 ? 0.35 : 0.3 + t * 0.4 + (armed ? 0.12 : 0),
      );
      g.beginPath();
      for (let i = 0; i < 4; i++) {
        const angle = rot + i * (Math.PI / 2);
        const outerX = x + Math.cos(angle) * range;
        const outerY = projectTelegraphY(y + Math.sin(angle) * range, projectionYScale);
        const innerX = x + Math.cos(angle) * (range - len);
        const innerY = projectTelegraphY(y + Math.sin(angle) * (range - len), projectionYScale);
        g.moveTo(outerX, outerY);
        g.lineTo(innerX, innerY);
      }
      g.strokePath();
    }
  }

  private drawMeleeTravelStem(fromX: number, fromY: number, toX: number, toY: number): void {
    const g = this.telegraphGroundGfx;
    const zoom = Math.max(0.01, this.cameras.main.zoom);
    const sy = this.belt ? this.beltY(fromY) : fromY;
    const ty = this.belt ? this.beltY(toY) : toY;
    const dx = toX - fromX;
    const dy = ty - sy;
    for (let i = 0; i < 4; i++) {
      const a = i / 4;
      const b = Math.min(1, a + 0.13);
      g.lineStyle(1.2 / zoom, 0xffffff, 0.13);
      g.beginPath();
      g.moveTo(fromX + dx * a, sy + dy * a);
      g.lineTo(fromX + dx * b, sy + dy * b);
      g.strokePath();
    }
  }

  private drawMeleeImplementBracket(
    rig: SpriteRig,
    aimWorld: number,
    phase: number,
    pulse: boolean,
    gold = false,
  ): void {
    rig.getMeleeTellAnchor(this.meleeTellAnchor);
    const x = this.meleeTellAnchor.x;
    const y = this.belt
      ? this.beltY(rig.y) + (this.meleeTellAnchor.y - rig.y)
      : this.meleeTellAnchor.y;
    const zoom = Math.max(0.01, this.cameras.main.zoom);
    const nx = -Math.sin(aimWorld);
    const ny = Math.cos(aimWorld);
    const radius = (pulse ? 14 : 11 + phase * 2) / zoom;
    const g = this.telegraphGfx;
    const accent = gold ? 0xffd66e : 0xffffff;
    for (let pass = 0; pass < 2; pass++) {
      g.lineStyle(
        (pass === 0 ? 5 : pulse ? 3 : 1.8) / zoom,
        pass === 0 ? 0x17120f : accent,
        pass === 0 ? 0.72 : pulse ? 0.98 : 0.42 + phase * 0.28,
      );
      g.beginPath();
      g.moveTo(x + nx * radius, y + ny * radius);
      g.lineTo(x + nx * radius * 0.34, y + ny * radius * 0.34);
      g.moveTo(x - nx * radius, y - ny * radius);
      g.lineTo(x - nx * radius * 0.34, y - ny * radius * 0.34);
      g.strokePath();
    }
    if (pulse) {
      g.fillStyle(accent, 0.95);
      g.fillCircle(x, y, 3.2 / zoom);
    }
    if (!colorblindShapesEnabled(this.feedbackSettings.colorblindAssist)) return;
    if (gold) {
      const ux = Math.cos(aimWorld);
      const uy = Math.sin(aimWorld);
      this.strokeAssistChevrons(g, x + ux * radius, y + uy * radius, ux, uy, zoom, accent);
      return;
    }
    // Two hollow diamonds remain beside the source between crests: the parry tell promises two pulses even
    // when flash intensity or white/gold hue is unavailable.
    g.lineStyle((pulse ? 2.4 : 1.5) / zoom, accent, pulse ? 0.98 : 0.7);
    for (const side of [-1, 1]) {
      const cx = x + nx * side * (radius + 5 / zoom);
      const cy = y + ny * side * (radius + 5 / zoom);
      const r = (pulse ? 3.8 : 3.2) / zoom;
      g.beginPath();
      g.moveTo(cx, cy - r);
      g.lineTo(cx + r, cy);
      g.lineTo(cx, cy + r);
      g.lineTo(cx - r, cy);
      g.closePath();
      g.strokePath();
    }
  }

  private strokeAssistChevrons(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    dirX: number,
    dirY: number,
    zoom: number,
    color: number,
  ): void {
    const length = Math.hypot(dirX, dirY) || 1;
    const ux = dirX / length;
    const uy = dirY / length;
    const px = -uy;
    const py = ux;
    for (let pass = 0; pass < 2; pass++) {
      g.lineStyle((pass === 0 ? 4.2 : 1.8) / zoom, pass === 0 ? 0x17120f : color, 0.9);
      g.beginPath();
      for (let i = 0; i < 2; i++) {
        const offset = (i * 9) / zoom;
        const apexX = x + ux * offset;
        const apexY = y + uy * offset;
        const backX = apexX - ux * (7 / zoom);
        const backY = apexY - uy * (7 / zoom);
        g.moveTo(apexX, apexY);
        g.lineTo(backX + px * (4 / zoom), backY + py * (4 / zoom));
        g.moveTo(apexX, apexY);
        g.lineTo(backX - px * (4 / zoom), backY - py * (4 / zoom));
      }
      g.strokePath();
    }
  }

  /** §TELEGRAPH exact hybrid renderer: invariant thin geometry plus optional retained painted preludes. */
  private renderTelegraphs(): void {
    const st = this.room?.state;
    this.telegraphForeshadows.beginFrame();
    if (!st) {
      this.telegraphForeshadows.endFrame();
      return;
    }
    const g = this.telegraphGroundGfx;
    const projectionYScale = this.belt ? BELT_FORESHORTEN : 1;
    const zoom = Math.max(0.01, this.cameras.main.zoom);
    const frame = ++this.telegraphFrame;
    st.telegraphs.forEach((row, id) => {
      const meleeOwner = meleeTelegraphOwner(id);
      const meleeEnemy = meleeOwner ? st.enemies.get(meleeOwner) : undefined;
      const bossMelee = !!meleeEnemy && ENEMY_KINDS[meleeEnemy.kind]?.archetype === "boss";
      const meleeSample = meleeOwner ? this.enemyWindup.get(meleeOwner) : undefined;
      const effectiveT = meleeOwner
        ? (meleeSample?.shownT ?? st.enemies.get(meleeOwner)?.windup ?? row.t)
        : row.t;
      const meleePulse =
        !!meleeOwner &&
        !!meleeSample &&
        ((this.time.now - meleeSample.glintAtMs >= 0 &&
          this.time.now - meleeSample.glintAtMs <= MELEE_GLINT_CREST_MS) ||
          (this.time.now - meleeSample.firstGlintAtMs >= 0 &&
            this.time.now - meleeSample.firstGlintAtMs <= MELEE_GLINT_CREST_MS));
      const goldMelee =
        !!meleeOwner &&
        ((this.enemyComboPresentation.get(meleeOwner)?.presentedFlags ?? 0) &
          COMBO_FLAG_EMPOWERED) !==
          0;
      const vastagharOwned = st.vastaghar.active && row.ownerId === st.vastaghar.ownerId;
      const vastagharSweep =
        vastagharOwned && row.kindTag === TelegraphKindTag.TitanSweep
          ? VASTAGHAR_ACTIONS[st.vastaghar.actionKind]
          : undefined;
      const buildCurrentGeometry = (): TelegraphGeometry =>
        vastagharSweep
          ? buildVastagharSweepGeometry(
              row.x,
              row.y,
              vastagharSweep.innerRange,
              vastagharSweep.outerRange,
              vastagharSweep.halfWidth,
              row.rot,
              projectionYScale,
              zoom,
            )
          : buildTelegraphGeometry(
              row.shape,
              row.x,
              row.y,
              row.a,
              row.b,
              row.rot,
              row.kindTag,
              projectionYScale,
              zoom,
            );
      let cached = this.telegraphCache.get(id);
      const geometryChanged =
        !cached ||
        cached.shape !== row.shape ||
        cached.x !== row.x ||
        cached.y !== row.y ||
        cached.a !== row.a ||
        cached.b !== row.b ||
        cached.rot !== row.rot ||
        cached.kindTag !== row.kindTag ||
        cached.ownerId !== row.ownerId ||
        cached.castSeq !== row.castSeq ||
        cached.projectionYScale !== projectionYScale ||
        cached.zoom !== zoom;
      if (!cached) {
        cached = {
          t: effectiveT,
          shape: row.shape,
          x: row.x,
          y: row.y,
          a: row.a,
          b: row.b,
          rot: row.rot,
          danger: row.danger,
          kindTag: row.kindTag,
          ownerId: row.ownerId,
          castSeq: row.castSeq,
          sawFull: false,
          seenFrame: frame,
          projectionYScale,
          zoom,
          hash: telegraphHash01(id),
          geometry: buildCurrentGeometry(),
        };
        this.telegraphCache.set(id, cached);
      } else if (geometryChanged) {
        cached.geometry = buildCurrentGeometry();
      }
      if (!meleeOwner || bossMelee || this.meleeFullTells.has(meleeOwner))
        this.drawTelegraph(
          g,
          cached.geometry,
          effectiveT,
          row.danger,
          row.kindTag,
          cached.hash,
          meleePulse,
          !!meleeOwner,
          goldMelee,
        );
      if (!meleeOwner || bossMelee)
        this.drawProtectedTelegraphEdge(
          this.telegraphGfx,
          cached.geometry,
          effectiveT,
          row.danger,
          zoom,
          cached.hash,
        );
      // Horde source charm is nearest-N rig-owned. Boss melee and every other row keep the shared paint pool.
      if (!meleeOwner)
        this.telegraphForeshadows.update(
          id,
          row.shape,
          row.kindTag,
          row.x,
          projectTelegraphY(row.y, projectionYScale),
          row.a,
          row.b,
          row.rot,
          effectiveT,
          projectionYScale,
        );
      // `sawFull` sticks once the server pins the row to full fill (t=1) on the resolve tick — the server
      // LINGERS a resolved row one tick at t=1 so we observe it, while a CANCEL (phase-change/boss death)
      // removes the row without ever reaching t=1. So `sawFull` cleanly separates "it fired" from "cancelled".
      cached.t = effectiveT;
      cached.shape = row.shape;
      cached.x = row.x;
      cached.y = row.y;
      cached.a = row.a;
      cached.b = row.b;
      cached.rot = row.rot;
      cached.danger = row.danger;
      cached.kindTag = row.kindTag;
      cached.ownerId = row.ownerId;
      cached.castSeq = row.castSeq;
      if (
        !cached.sawFull &&
        vastagharOwned &&
        row.kindTag === TelegraphKindTag.Quake &&
        effectiveT >= 0.999
      ) {
        const self = this.room ? st.players.get(this.room.sessionId) : undefined;
        const localThreatened =
          !!self &&
          telegraphGeometryContains(
            cached.geometry,
            self.x,
            projectTelegraphY(self.y, projectionYScale),
          );
        this.vastagharVfx.resolveQuake({
          encounterSeq: st.vastaghar.encounterSeq,
          castSeq: row.castSeq,
          actionKind: st.vastaghar.actionKind,
          x: row.x,
          y: row.y,
          radius: row.a,
          localThreatened,
          reducedMotion: prefersReducedPaperMotion() || this.feedbackSettings.flashes === "reduced",
        });
      }
      cached.sawFull ||= !meleeOwner && effectiveT >= 0.999;
      cached.seenFrame = frame;
      cached.projectionYScale = projectionYScale;
      cached.zoom = zoom;
    });
    this.telegraphForeshadows.endFrame();
    // A cached row no longer live = removed. Edge-fire the impact ONLY if it completed (sawFull) — never for
    // a cancel — and branch the VFX by kindTag so a corrosive/summon/burst telegraph doesn't fake a slam.
    for (const [id, c] of this.telegraphCache) {
      if (c.seenFrame === frame) continue;
      this.telegraphCache.delete(id);
      if (!c.sawFull) continue; // cancelled mid-windup → no phantom impact
      const impactY = projectTelegraphY(c.y, projectionYScale);
      const self = this.room ? st.players.get(this.room.sessionId) : undefined;
      if (
        self &&
        telegraphGeometryContains(c.geometry, self.x, projectTelegraphY(self.y, projectionYScale))
      ) {
        this.recentResolvedDangerKind = telegraphDamageKind(c.kindTag);
        this.recentResolvedDangerAt = this.time.now;
      }
      if (c.ownerId === st.vastaghar.ownerId && c.kindTag === TelegraphKindTag.Quake) {
      } else if (c.kindTag === TelegraphKindTag.Slam) {
        // slam / landing-zone — the full impact: burst + camera shake + the deep boom. v0.117: scale the
        // shake + boom by the crater RADIUS (baseline 150px) so the colossus's 220px world-enders shake the
        // screen harder than a normal slam — a big body hits like a big body (WYSIWYG weight).
        const scale = Math.max(0.8, Math.min(1.7, c.a / 150));
        spawnExplosion(this, c.x, impactY, Math.max(24, c.a), "fire", "world");
        this.shakeCam(200 * scale, 0.014 * scale, "world");
        this.audio.play("bossslam", { x: c.x, amt: Math.min(1, scale) }); // §19 the deep boom under the shake
      } else if (c.kindTag === TelegraphKindTag.Pool) {
        // corrosive pool — the puddle (a ZoneState) renders itself; just a soft splash, no shake/boom.
        spawnExplosion(this, c.x, impactY, Math.min(40, c.a * 0.4), "fire", "world");
      } else if (c.kindTag === TelegraphKindTag.Summon || c.kindTag === TelegraphKindTag.Radial) {
        // summon marker / bullet-burst pre-flash — a small pop where the adds/bullets erupt, no shake/boom.
        spawnExplosion(this, c.x, impactY, 22, "fire", "world");
      } else if (c.kindTag === TelegraphKindTag.Quake) {
        // §33 FOOTFALL QUAKE landing — the giant's step hits: a big shock ring + dust burst + a HEAVY, low
        // screen-quake and the deep boom. The whole screen jolts so the footstep reads as a footstep.
        const ix = c.x;
        const iy = impactY;
        spawnExplosion(this, ix, iy, Math.max(40, c.a * 0.5), "fire", "world");
        this.spawnImpactRing(ix, iy);
        this.shakeCam(280, 0.03, "world"); // heavier + longer than a slam — the ground itself buckles
        this.audio.play("bossslam", { x: c.x, amt: 1 });
      }
      // kindTag 4 (beam/dash) + 5 (ring) end silently — the sweeping/expanding hazard was its own visual.
    }
  }

  /** Draw one cached exact boundary. t changes energy/cadence only; threatened coverage never grows. */
  private drawTelegraph(
    g: Phaser.GameObjects.Graphics,
    geometry: TelegraphGeometry,
    t: number,
    danger: number,
    kindTag: number,
    hash: number,
    meleePulse = false,
    meleeOwner = false,
    goldMelee = false,
  ): void {
    if (danger === 0 && (kindTag === TelegraphKindTag.Melee || meleeOwner)) {
      this.drawMeleeExactFootprint(g, geometry, t, meleePulse, goldMelee);
      return;
    }
    const zoom = Math.max(0.01, this.cameras.main.zoom);
    const lockAt =
      kindTag === TelegraphKindTag.Charge
        ? 0.58
        : kindTag === TelegraphKindTag.Slam ||
            kindTag === TelegraphKindTag.Radial ||
            kindTag === TelegraphKindTag.ExpandingRing ||
            kindTag === TelegraphKindTag.Quake
          ? 0.62
          : 0.65;
    const lock = Phaser.Math.Clamp((t - lockAt) / (0.88 - lockAt), 0, 1);
    const cadence = 0.5 + Math.sin(t * (danger === 0 ? 34 : 23) + hash * Math.PI * 2) * 0.5;
    const line = danger === 0 ? 0xffffff : 0xd96a4f;
    const alpha =
      danger === 0
        ? 0.18 + lock * 0.2 + cadence * (0.04 + lock * 0.08)
        : 0.11 + lock * 0.1 + cadence * 0.025;

    // One dark terrain keyline and one exact response line remain continuous at every quality tier.
    for (const edge of geometry.edges) {
      g.lineStyle(4 / zoom, 0x17120f, 0.34);
      this.strokeTelegraphPath(g, edge.points, edge.closed);
      g.lineStyle(1.8 / zoom, line, alpha);
      this.strokeTelegraphPath(g, edge.points, edge.closed);
      if (danger === 0) {
        // White/parry = continuous inner echo; dodge uses broken brush/chevrons below instead.
        g.lineStyle(1.1 / zoom, line, alpha * 0.58);
        this.strokeTelegraphPath(g, edge.echo, edge.closed);
      }
    }
    this.drawTelegraphCadence(g, geometry, t, danger, hash, line, alpha, zoom);
  }

  /** Protected response channel: exact outer boundary only, above beams/XP and below screen-space HUD. */
  private drawProtectedTelegraphEdge(
    g: Phaser.GameObjects.Graphics,
    geometry: TelegraphGeometry,
    t: number,
    danger: number,
    zoom: number,
    hash: number,
  ): void {
    const assistShapes = colorblindShapesEnabled(this.feedbackSettings.colorblindAssist);
    const doublePulse = assistShapes && danger === 0 ? parryDoublePulseStrength(t) : 0;
    const color = danger === 0 ? 0xffffff : 0xff755b;
    const alpha = Math.min(1, 0.5 + Math.max(0, Math.min(1, t)) * 0.34 + doublePulse * 0.16);
    for (const edge of geometry.edges) {
      g.lineStyle(5 / zoom, 0x100b09, 0.72);
      this.strokeTelegraphPath(g, edge.points, edge.closed);
      g.lineStyle((2.2 + doublePulse * 1.4) / zoom, color, alpha);
      this.strokeTelegraphPath(g, edge.points, edge.closed);
    }
    if (assistShapes) this.drawTelegraphCadence(g, geometry, t, danger, hash, color, alpha, zoom);
  }

  /** The fairness layer: full static sector boundary, dominant range arc, forward notch, inward completion. */
  private drawMeleeExactFootprint(
    g: Phaser.GameObjects.Graphics,
    geometry: TelegraphGeometry,
    t: number,
    pulse: boolean,
    gold = false,
  ): void {
    const edge = geometry.edges[0];
    if (!edge || edge.points.length < 4) return;
    const zoom = Math.max(0.01, this.cameras.main.zoom);
    const points = edge.points;
    const echo = edge.echo;
    const firstArc = 1;
    const lastArc = points.length - 1;
    const midArc = Math.floor((firstArc + lastArc) / 2);
    const alpha = 0.24 + t * 0.28 + (pulse ? 0.28 : 0);
    const accent = gold ? 0xffd66e : 0xffffff;

    // Exact sides remain visible but subordinate; the outer reach arc owns the floor read.
    g.lineStyle(4 / zoom, 0x17120f, 0.38);
    this.strokeTelegraphPath(g, points, true);
    g.lineStyle(1.5 / zoom, accent, alpha * 0.65);
    this.strokeTelegraphPath(g, points, true);
    g.lineStyle(1.1 / zoom, accent, alpha * 0.42);
    this.strokeTelegraphPath(g, echo, true);
    g.lineStyle((pulse ? 3.2 : 2) / zoom, accent, alpha + 0.1);
    this.strokeTelegraphPointRange(g, points, firstArc, lastArc);

    // Progress advances from both angular limits and meets at the committed aim notch on contact.
    const sideCount = Math.max(1, midArc - firstArc);
    const fill = Math.min(sideCount, Math.ceil(sideCount * Math.max(0, Math.min(1, t))));
    g.lineStyle((pulse ? 3.5 : 2.4) / zoom, accent, 0.42 + t * 0.42);
    this.strokeTelegraphPointRange(g, points, firstArc, firstArc + fill);
    this.strokeTelegraphPointRange(g, points, lastArc - fill, lastArc);

    const origin = points[0]!;
    const notch = points[midArc]!;
    const ndx = origin.x - notch.x;
    const ndy = origin.y - notch.y;
    const nl = Math.hypot(ndx, ndy) || 1;
    g.lineStyle((pulse ? 3.3 : 2) / zoom, accent, 0.55 + t * 0.35);
    g.beginPath();
    g.moveTo(notch.x, notch.y);
    g.lineTo(notch.x + (ndx / nl) * (10 / zoom), notch.y + (ndy / nl) * (10 / zoom));
    // Three paired ticks converge along the exact outer perimeter; structure/motion survives grayscale.
    for (let i = 1; i <= 3; i++) {
      const travel = Math.min(sideCount - 1, Math.floor(sideCount * t * (0.28 + i * 0.16)));
      for (const index of [firstArc + travel, lastArc - travel]) {
        const p = points[index];
        if (!p) continue;
        const ix = origin.x - p.x;
        const iy = origin.y - p.y;
        const il = Math.hypot(ix, iy) || 1;
        g.moveTo(p.x, p.y);
        g.lineTo(p.x + (ix / il) * (5.5 / zoom), p.y + (iy / il) * (5.5 / zoom));
      }
    }
    g.strokePath();
    if (gold && colorblindShapesEnabled(this.feedbackSettings.colorblindAssist)) {
      this.strokeAssistChevrons(g, notch.x, notch.y, ndx, ndy, zoom, accent);
    }
  }

  private strokeTelegraphPointRange(
    g: Phaser.GameObjects.Graphics,
    points: readonly { x: number; y: number }[],
    start: number,
    end: number,
  ): void {
    const first = points[Math.max(0, Math.min(points.length - 1, start))];
    if (!first) return;
    g.beginPath();
    g.moveTo(first.x, first.y);
    for (let i = start + 1; i <= end && i < points.length; i++) {
      const point = points[i];
      if (point) g.lineTo(point.x, point.y);
    }
    g.strokePath();
  }

  private strokeTelegraphPath(
    g: Phaser.GameObjects.Graphics,
    points: readonly { x: number; y: number }[],
    closed: boolean,
  ): void {
    const first = points[0];
    if (!first) return;
    g.beginPath();
    g.moveTo(first.x, first.y);
    for (let i = 1; i < points.length; i++) {
      const p = points[i];
      if (p) g.lineTo(p.x, p.y);
    }
    if (closed) g.closePath();
    g.strokePath();
  }

  /** White ticks converge inward; warm dodge brush and chevrons advance outward without replacing the edge. */
  private drawTelegraphCadence(
    g: Phaser.GameObjects.Graphics,
    geometry: TelegraphGeometry,
    t: number,
    danger: number,
    hash: number,
    color: number,
    alpha: number,
    zoom: number,
  ): void {
    const spacing = (danger === 0 ? 42 : 34) / zoom;
    const phase = ((hash + t * (danger === 0 ? 1.7 : 2.2)) % 1) * spacing;
    g.lineStyle((danger === 0 ? 1.4 : 2.1) / zoom, color, alpha * 0.62);
    g.beginPath();
    for (const edge of geometry.edges) {
      const segmentCount = edge.closed ? edge.points.length : edge.points.length - 1;
      for (let i = 0; i < segmentCount; i++) {
        const j = (i + 1) % edge.points.length;
        const p0 = edge.points[i];
        const p1 = edge.points[j];
        const e0 = edge.echo[i];
        const e1 = edge.echo[j];
        if (!p0 || !p1 || !e0 || !e1) continue;
        const dx = e1.x - e0.x;
        const dy = e1.y - e0.y;
        const len = Math.hypot(dx, dy);
        if (len < 0.01) continue;
        const tx = dx / len;
        const ty = dy / len;
        for (let dist = (phase + i * spacing * 0.37) % spacing; dist < len; dist += spacing) {
          const frac = dist / len;
          const ex = e0.x + dx * frac;
          const ey = e0.y + dy * frac;
          const bx = p0.x + (p1.x - p0.x) * frac;
          const by = p0.y + (p1.y - p0.y) * frac;
          let nx = ex - bx;
          let ny = ey - by;
          const nl = Math.hypot(nx, ny) || 1;
          nx /= nl;
          ny /= nl;
          if (danger === 0) {
            const inward = (5 + t * 3) / zoom;
            g.moveTo(bx + nx / zoom, by + ny / zoom);
            g.lineTo(bx + nx * inward, by + ny * inward);
          } else {
            const dash = Math.min(9 / zoom, len - dist);
            g.moveTo(ex, ey);
            g.lineTo(ex + tx * dash, ey + ty * dash);
            const apexX = bx + nx * (2 / zoom);
            const apexY = by + ny * (2 / zoom);
            const wing = 3 / zoom;
            const depth = 7 / zoom;
            g.moveTo(apexX, apexY);
            g.lineTo(apexX + nx * depth + tx * wing, apexY + ny * depth + ty * wing);
            g.moveTo(apexX, apexY);
            g.lineTo(apexX + nx * depth - tx * wing, apexY + ny * depth - ty * wing);
          }
        }
      }
    }
    g.strokePath();
  }

  /** Reconcile rendered projectiles vs authoritative state; splat on removal (hit/expire). */
  private syncProjectiles(): void {
    if (!this.room) return;
    const room = this.room; // stable through the forEach callbacks below; disconnect swaps it after this tick
    const state = room.state.projectiles;
    const flashedRounds = new Set<string>(); // one cue per shooter + authoritative born tick
    state.forEach((pr, id) => {
      const existing = this.projectiles.get(id);
      if (existing) {
        // §8 v0.117 a bullet can flip `kind` mid-flight when PARRIED (hostile spit → friendly counter):
        // rebuild its visual so the deflect is visible — it visibly rockets back out as a cyan counter
        // streak. (The parriedSeq handler already popped the white flash + the crisp parry ding.)
        if (existing.getData("kind") === pr.kind) return;
        existing.destroy();
        this.projectiles.delete(id);
      }
      // Launch ownership is immutable on the row: recipe art must be selected on the first rendered frame,
      // even when a fast projectile's first snapshot is already outside the old nearest-shooter radius.
      let shooter: string | null = pr.sourcePlayerId || null;
      if (!shooter && !pr.hostile) {
        let best = 220;
        room.state.players.forEach((p, pid) => {
          const d = Math.hypot(p.x - pr.x, p.y - pr.y);
          if (d < best) {
            best = d;
            shooter = pid;
          }
        });
      }
      const sourcePlayer = shooter ? room.state.players.get(shooter) : undefined;
      const sourceWeaponId = pr.sourceWeaponId || sourcePlayer?.weapon || "";
      const sourceWeapon = WEAPONS[sourceWeaponId];
      const weaponEffectRecipe = resolveWeaponEffectRecipe(sourceWeapon);
      const projectileKind = baseKind(pr.kind);
      const comet = projectileKind === "fireball";
      const casterOwnsKind =
        sourceWeapon?.tags.classPool === "caster" &&
        !comet &&
        ((!!sourceWeapon.cast && projectileKind === "orb") ||
          (!!sourceWeapon.scatter && projectileKind === "magma") ||
          (!!sourceWeapon.gun && projectileKind === baseKind(sourceWeapon.gun.bulletKind)));
      const casterRecipe = casterOwnsKind ? resolveCasterVfxRecipe(sourceWeapon) : undefined;
      const fx = comet ? gunFx("orb:fire") : GUN_FX[projectileKind];
      const gunIdentity = sourceWeapon?.gun
        ? makeGunIdentityProjectile(
            this,
            pr,
            sourceWeaponId,
            sourceWeapon.gun.projectileVisualScale ?? 1,
          )
        : null;
      const container =
        gunIdentity ??
        (weaponEffectRecipe?.projectile === "electric-bolt"
          ? makeBullet(this, pr, sourceWeapon?.gun?.projectileVisualScale ?? 1, weaponEffectRecipe)
          : weaponEffectRecipe?.projectile === "crystal-shard-orb"
            ? makeMagma(this, pr, weaponEffectRecipe)
            : casterRecipe
              ? makeCasterProjectile(
                  this,
                  pr,
                  casterRecipe,
                  prefersReducedPaperMotion() || this.feedbackSettings.flashes === "reduced",
                  sourceWeapon?.gun?.projectileVisualScale ?? 1,
                )
              : fx
                ? makeBullet(this, pr, sourceWeapon?.gun?.projectileVisualScale ?? 1)
                : isThrownProjectileKind(pr.kind)
                  ? makeThrownWeapon(this, pr)
                  : baseKind(pr.kind) === "magma" // §41 scatter balls carry ":<element>" (frost/void/… casters)
                    ? makeMagma(this, pr)
                    : pr.kind === "counter" || pr.kind === "deflect"
                      ? makeCounter(this, pr) // §8 parry projectile (bounce-back counter OR Superman side-glance)
                      : makeSpit(this, pr));
      const sourceRig = shooter ? this.blobs.get(shooter) : undefined;
      const spawnAnchorKind = sourceWeapon?.gun
        ? "muzzle"
        : sourceWeapon?.thrown && isThrownProjectileKind(pr.kind)
          ? "throw"
          : undefined;
      const spawnAnchor =
        sourcePlayer && sourceWeapon && sourceRig
          ? spawnAnchorKind === "muzzle"
            ? this.writeLiveGunRoundMuzzle(pr, sourcePlayer, sourceWeapon, sourceRig)
            : spawnAnchorKind === "throw"
              ? this.writeLiveThrownOrigin(sourceRig)
              : undefined
          : undefined;
      if (spawnAnchor) {
        // The wire row is already one or more 50 ms simulation steps downrange when it first renders.
        // Begin this presentation at the final live held muzzle or throw hand. Its opening flight owns a
        // short-lived presentation offset so generic authority attraction cannot pull it off the source.
        container.setData("authoritativeFirstX", pr.x);
        container.setData("authoritativeFirstY", pr.y);
        container.setPosition(spawnAnchor.x, spawnAnchor.y);
        container.setData("spawnOriginX", container.x);
        container.setData("spawnOriginY", container.y);
        container.setData("spawnAnchorKind", spawnAnchorKind);
        if (spawnAnchorKind === "muzzle") {
          container.setData("spawnMuzzleX", spawnAnchor.x);
          container.setData("spawnMuzzleY", spawnAnchor.y);
        } else {
          container.setData("spawnThrowX", spawnAnchor.x);
          container.setData("spawnThrowY", spawnAnchor.y);
        }
        container.setData("spawnBornTick", pr.bornTick);
        container.setData("muzzleAnchoredFlight", true);
        container.setData("muzzleFlightAgeSeconds", 0);
        container.setData("skipFirstMuzzleFlightStep", true);
      }
      container.setData("kind", pr.kind);
      container.setData("hostile", pr.hostile);
      container.setData("weaponEffectRecipe", weaponEffectRecipe);
      container.setData("ultimateProjectile", comet);
      // §8 v0.117 a BASE-parry "deflect" spark glances off + FADES OUT (bullet-off-Superman): tween its
      // alpha + scale down over the deflect lifetime so it dissipates rather than flying off like a shot.
      if (pr.kind === "deflect") {
        this.tweens.add({
          targets: container,
          alpha: 0,
          scale: 0.4,
          duration: DEFLECT_TTL * 1000,
          ease: "Quad.easeOut",
        });
      }
      container.setData("explodeR", pr.explodeR); // §14 WYSIWYG: render the blast at the real radius
      if (fx) container.setData("ang", Math.atan2(pr.vy, pr.vx)); // flight angle for the oriented impact
      this.projectiles.set(id, container);
      if (sourceWeaponId) container.setData("sourceWeapon", sourceWeaponId);
      if (shooter) container.setData("sourcePlayer", shooter);
      // Muzzle flash a freshly-fired gun bullet at the SHOOTER's barrel (nearest player), one per shot.
      if (fx) {
        const flashKey = shooter ? `${shooter}:${pr.bornTick}` : "";
        if (shooter && !flashedRounds.has(flashKey)) {
          flashedRounds.add(flashKey);
          // §4 v0.107: SELF already flashed at click time (predicted, sendAttack) — don't double-flash
          // when the authoritative projectile lands a round-trip later.
          const isSelf = shooter === room.sessionId;
          const suppressed = isSelf && this.time.now - this.lastSelfMuzzleAt < 150;
          const p = room.state.players.get(shooter);
          if (p && !suppressed) {
            const ang = Math.atan2(pr.vy, pr.vx);
            const aimX = Math.cos(ang);
            const aimY = Math.sin(ang);
            const srig = this.blobs.get(shooter);
            const flashWeapon = sourceWeapon ?? WEAPONS[p.weapon] ?? WEAPONS[DEFAULT_WEAPON];
            const muzzles =
              flashWeapon && srig
                ? this.writeLiveGunMuzzles(p, flashWeapon, srig, p.attackSeq, aimX, aimY)
                : flashWeapon?.muzzle
                  ? weaponMuzzleWorldPointsForShot(
                      flashWeapon,
                      {
                        x: p.x,
                        y: p.y,
                        aimX,
                        aimY,
                        renderScale: characterScale(p.character),
                      },
                      p.attackSeq,
                    )
                  : [];
            srig?.triggerGunRecoil(this.time.now, 0);
            if (!casterRecipe) {
              for (const muzzle of muzzles) {
                spawnMuzzleFlash(
                  this,
                  muzzle.x,
                  muzzle.y,
                  ang,
                  fx.size,
                  fx.color,
                  flashWeapon?.gun?.muzzle ?? fx.style,
                  flashWeapon?.id,
                );
                if (flashWeapon?.gun?.sonicBoomRing)
                  spawnSonicBoomRing(this, muzzle.x, muzzle.y, ang, fx.color);
              }
            } else if (srig && flashWeapon) {
              this.spawnCasterSource(flashWeapon, srig.x, srig.y, ang);
            }
            // §19 a REMOTE shooter's gun sound (self already played its predicted shot at click time —
            // `suppressed` gates this the same way it gates the flash, so self never double-fires).
            if (!comet) this.audio.play(`shot:${baseKind(pr.kind)}`, { x: p.x });
          }
          if (isSelf && comet) this.audio.play("ult:fire:launch", { x: p?.x, amt: 1 });
        }
      }
    });
    for (const id of this.projectiles.keys()) {
      if (!state.has(id)) {
        const c = this.projectiles.get(id);
        if (c) {
          const k = c.getData("kind") as string;
          const bk = baseKind(k); // §35 element-tint suffix stripped for the impact dispatch
          const er = (c.getData("explodeR") as number) ?? 0;
          const casterRecipe = c.getData("casterRecipe") as CasterVfxRecipe | undefined;
          const weaponEffectRecipe = c.getData("weaponEffectRecipe") as
            | WeaponEffectRecipe
            | undefined;
          const impactAngle = (c.getData("ang") as number) ?? 0;
          spawnWeaponProjectileImpact(this, weaponEffectRecipe, c.x, c.y, impactAngle);
          if (er > 0) {
            // §41 ANY exploding projectile erupts (was magma-only — explosive gun rounds got a plain
            // bullet ping). Prefer its observed shooter's live WeaponDef tag; the wire suffix remains the
            // fallback for a projectile first observed too far from its owner.
            const ci = k.indexOf(":");
            const sourceWeapon = WEAPONS[c.getData("sourceWeapon") as string];
            const element = sourceWeapon?.tags.element ?? (ci < 0 ? "fire" : k.slice(ci + 1));
            const ultimateProjectile = c.getData("ultimateProjectile") === true;
            const local = c.getData("sourcePlayer") === room.sessionId;
            if (ultimateProjectile)
              this.ultimateExplosionShakeScale =
                this.feedbackSettings.flashes === "reduced" ? 0.5 : 1;
            if (ultimateProjectile && !local) {
              const selfRig = this.blobs.get(room.sessionId);
              const distance = selfRig
                ? Math.hypot(c.x - selfRig.x, c.y - selfRig.y)
                : Number.POSITIVE_INFINITY;
              const dutyOpen = this.time.now - this.lastUltimateWeatherShakeAt >= 700;
              this.ultimateExplosionShakeScale *= dutyOpen
                ? Math.max(0, 1 - distance / 760) * 0.5
                : 0;
              if (this.ultimateExplosionShakeScale > 0)
                this.lastUltimateWeatherShakeAt = this.time.now;
            }
            try {
              if (!casterRecipe?.paintedImpact)
                spawnExplosion(
                  this,
                  c.x,
                  c.y,
                  er,
                  element,
                  ultimateProjectile || c.getData("hostile") === true ? "world" : "player-weapon",
                  sourceWeapon?.id,
                );
            } finally {
              this.ultimateExplosionShakeScale = 1;
            }
            if (ultimateProjectile) {
              this.audio.play("ult:fire:impact", { x: c.x, amt: local ? 1 : 0.35 });
            }
            if (casterRecipe) {
              spawnCasterImpact(
                this,
                c.x,
                c.y,
                impactAngle,
                casterRecipe,
                prefersReducedPaperMotion() || this.feedbackSettings.flashes === "reduced",
              );
            }
          } else if (weaponEffectRecipe?.projectile) {
            // The authored projectile recipe already supplied its complete impact punctuation above.
          } else if (casterRecipe) {
            spawnCasterImpact(
              this,
              c.x,
              c.y,
              impactAngle,
              casterRecipe,
              prefersReducedPaperMotion() || this.feedbackSettings.flashes === "reduced",
            );
          } else if (GUN_FX[bk]) {
            spawnBulletImpact(this, c.x, c.y, k, impactAngle); // pass k to element tint
          } else {
            spawnSplat(this, c.x, c.y, k);
          }
        }
        c?.destroy();
        this.projectiles.delete(id);
      }
    }
  }

  /** Final rendered art-space muzzle salvo, with the shared canonical affine as the lazy-art fallback. */
  private writeLiveGunMuzzles(
    player: PlayerState,
    weapon: WeaponDef,
    rig: SpriteRig,
    acceptedSeq: number,
    aimX: number,
    aimY: number,
  ): Array<{ x: number; y: number }> {
    if (!weapon.muzzle) return [];
    const selected = weaponArtMuzzlePointsForShot(weapon.muzzle, acceptedSeq);
    const canonical = weaponMuzzleWorldPointsForShot(
      weapon,
      {
        x: rig.x,
        y: rig.y,
        aimX,
        aimY,
        renderScale: characterScale(player.character),
      },
      acceptedSeq,
    );
    return selected.map((_point, index) => {
      const out = { x: canonical[index]?.x ?? rig.x, y: canonical[index]?.y ?? rig.y };
      rig.writeWeaponMuzzleForShot(acceptedSeq, index, out);
      if (this.belt) out.y = BELT_Y0 + (out.y - BELT_Y0) / BELT_FORESHORTEN;
      return out;
    });
  }

  /** Resolve one newly observed authoritative gun row onto the shooter's final rendered implement tip.
   * Multi-barrel rows select the shared art point closest to the recovered authoritative fire origin. */
  private writeLiveGunRoundMuzzle(
    projectile: { x: number; y: number; vx: number; vy: number; bornTick: number },
    player: PlayerState,
    weapon: WeaponDef,
    rig: SpriteRig,
  ): { x: number; y: number } | undefined {
    if (!weapon.gun) return undefined;
    const speed = Math.hypot(projectile.vx, projectile.vy);
    if (speed <= 1e-4) return undefined;
    const aimX = projectile.vx / speed;
    const aimY = projectile.vy / speed;
    const liveMuzzles = this.writeLiveGunMuzzles(player, weapon, rig, player.attackSeq, aimX, aimY);
    if (liveMuzzles.length <= 1) return liveMuzzles[0];

    const currentTick = this.room?.state.tick ?? projectile.bornTick;
    const ageTicks = (currentTick - projectile.bornTick) >>> 0;
    const integratedSteps = ageTicks + 1;
    const originX = projectile.x - projectile.vx * integratedSteps * (TICK_MS / 1000);
    const originY = projectile.y - projectile.vy * integratedSteps * (TICK_MS / 1000);
    const authorityMuzzles = weaponMuzzleWorldPointsForShot(
      weapon,
      {
        x: player.x,
        y: player.y,
        aimX,
        aimY,
        renderScale: characterScale(player.character),
      },
      player.attackSeq,
    );
    let selectedIndex = 0;
    let best = Number.POSITIVE_INFINITY;
    for (let index = 0; index < authorityMuzzles.length; index++) {
      const candidate = authorityMuzzles[index]!;
      const distance = (candidate.x - originX) ** 2 + (candidate.y - originY) ** 2;
      if (distance >= best) continue;
      best = distance;
      selectedIndex = index;
    }
    return liveMuzzles[selectedIndex] ?? liveMuzzles[0];
  }

  /** Resolve an own-sprite thrown row onto the accepted beat's final rendered release hand. */
  private writeLiveThrownOrigin(rig: SpriteRig): { x: number; y: number } {
    const out = rig.throwWorldAnchor();
    if (this.belt) out.y = BELT_Y0 + (out.y - BELT_Y0) / BELT_FORESHORTEN;
    return out;
  }

  /** Dead-reckon each projectile along its velocity, gently corrected toward the server position
   *  (straight-line bullets look crisper extrapolated than lerped between 20Hz snapshots). */
  private moveProjectiles(dtSec: number): void {
    if (!this.room) return;
    const room = this.room;
    this.ultimateVfx.beginProjectileFrame();
    room.state.projectiles.forEach((pr, id) => {
      const c = this.projectiles.get(id);
      if (!c) return;
      const weaponId = (c.getData("sourceWeapon") as string | undefined) ?? "";
      const weapon = WEAPONS[weaponId];
      const waveform = weapon?.cast?.projectileWaveform;
      const muzzleAnchoredFlight = c.getData("muzzleAnchoredFlight") === true;
      if (muzzleAnchoredFlight) {
        if (c.getData("skipFirstMuzzleFlightStep") === true) {
          c.setData("skipFirstMuzzleFlightStep", false);
          if (this.belt) c.setData("beltWorldY", c.y);
        } else {
          const ageSeconds =
            ((c.getData("muzzleFlightAgeSeconds") as number | undefined) ?? 0) + dtSec;
          const worldY = this.belt ? ((c.getData("beltWorldY") as number | undefined) ?? c.y) : c.y;
          let nextX = c.x + pr.vx * dtSec;
          let nextY = worldY + pr.vy * dtSec;
          if (ageSeconds > MUZZLE_FLIGHT_AUTHORITY_GRACE_SECONDS) {
            const correctionX = pr.x - nextX;
            const correctionY = pr.y - nextY;
            const correctionDistance = Math.hypot(correctionX, correctionY);
            if (correctionDistance <= MUZZLE_FLIGHT_AUTHORITY_SETTLED_PX) {
              nextX = pr.x;
              nextY = pr.y;
              c.setData("muzzleAnchoredFlight", false);
            } else {
              const exponentialDistance =
                correctionDistance *
                (1 - Math.exp(-MUZZLE_FLIGHT_AUTHORITY_CONVERGENCE_PER_SECOND * dtSec));
              const correctionStep = Math.min(
                exponentialDistance,
                MUZZLE_FLIGHT_AUTHORITY_MAX_CATCHUP_PX_PER_SECOND * dtSec,
              );
              nextX += (correctionX / correctionDistance) * correctionStep;
              nextY += (correctionY / correctionDistance) * correctionStep;
            }
          }
          c.setData("muzzleFlightAgeSeconds", ageSeconds);
          if (this.belt) c.setData("beltWorldY", nextY);
          c.setPosition(nextX, nextY);
        }
      } else if (waveform) {
        const authoritativeElapsed = pr.flightAgeTicks * (TICK_MS / 1000);
        const displayElapsed = Math.max(
          authoritativeElapsed,
          ((c.getData("waveformElapsed") as number | undefined) ?? authoritativeElapsed) + dtSec,
        );
        const sample = sampleProjectileWaveformFromAuthoritative(
          pr,
          waveform,
          authoritativeElapsed,
          displayElapsed,
        );
        c.setData("waveformElapsed", displayElapsed);
        if (this.belt) c.setData("beltWorldY", sample.y);
        c.setPosition(sample.x, sample.y);
      } else if (this.belt) {
        // §36 belt: dead-reckon in WORLD space. x is never projected (container x == world x), but projectBelt
        // overwrites the container y with the projected SCREEN y every frame — so read the WORLD y back from
        // the tracked data (not c.y) or the projection compounds and bullets drift toward the deck back,
        // missing the cursor. Write the new world coords; projectBelt re-projects them this frame.
        const wyPrev = (c.getData("beltWorldY") as number | undefined) ?? pr.y;
        const wx = Phaser.Math.Linear(c.x + pr.vx * dtSec, pr.x, 0.18);
        const wy = Phaser.Math.Linear(wyPrev + pr.vy * dtSec, pr.y, 0.18);
        c.setPosition(wx, wy);
      } else {
        const px = c.x + pr.vx * dtSec;
        const py = c.y + pr.vy * dtSec;
        c.setPosition(Phaser.Math.Linear(px, pr.x, 0.18), Phaser.Math.Linear(py, pr.y, 0.18));
      }
      const thrown = isThrownProjectileKind(pr.kind);
      const payload = c.getData("arcPayload") as Phaser.GameObjects.Container | undefined;
      if (thrown) {
        const rotating = payload ?? c;
        if (thrownProjectileRotationPolicy(pr.kind) === "point-forward")
          rotating.rotation = Math.atan2(pr.vy, pr.vx);
        else rotating.rotation += dtSec * 22;
      }
      const arcHeight = pr.arcHeight ?? 0;
      if (payload && arcHeight > 0 && pr.flightTicks > 0) {
        const totalTicks = pr.flightTicks;
        const ageTicks = pr.flightAgeTicks;
        const progress = Phaser.Math.Clamp(ageTicks / totalTicks, 0, 1);
        payload.y = -Math.sin(progress * Math.PI) * arcHeight;
        if (!thrown) payload.rotation += dtSec * 3.4;
      }
      if (baseKind(pr.kind) === "fireball") this.ultimateVfx.trackComet(id, c.x, c.y, pr.vx, pr.vy);
      if (
        !pr.hostile &&
        baseKind(pr.kind) !== "fireball" &&
        c.getData("sourcePlayer") === room.sessionId &&
        c.getData("feedbackContact") !== true
      ) {
        const worldY = this.belt ? ((c.getData("beltWorldY") as number | undefined) ?? pr.y) : c.y;
        let targetId = "";
        let targetX = 0;
        let targetY = 0;
        let best = Number.POSITIVE_INFINITY;
        room.state.enemies.forEach((enemy, enemyId) => {
          const radius =
            (ENEMY_KINDS[enemy.kind]?.radius ?? ENEMY_RADIUS) * (enemy.tough ? TOUGH_SCALE : 1) +
            10;
          const distance = (enemy.x - c.x) ** 2 + (enemy.y - worldY) ** 2;
          if (distance > radius * radius || distance >= best) return;
          best = distance;
          targetId = enemyId;
          const targetRig = this.enemies.get(enemyId);
          targetX = targetRig?.x ?? enemy.x;
          targetY = targetRig?.y ?? (this.belt ? this.beltY(enemy.y) : enemy.y);
        });
        if (targetId) {
          c.setData("feedbackContact", true);
          const weaponId = (c.getData("sourceWeapon") as string | undefined) ?? "";
          const weapon = WEAPONS[weaponId];
          const length = Math.hypot(pr.vx, pr.vy) || 1;
          const base = baseKind(pr.kind);
          const delivery = isThrownProjectileKind(pr.kind)
            ? CombatDelivery.Thrown
            : base === "magma"
              ? CombatDelivery.Scatter
              : CombatDelivery.Gun;
          this.combatFeedback.onPredictedContact(
            {
              targetId,
              delivery,
              weaponId,
              element: weapon?.tags.element ?? "physical",
              dirX: pr.vx / length,
              dirY: pr.vy / length,
              x: targetX,
              y: targetY,
            },
            this.time.now,
          );
        }
      }
    });
  }

  /** Reconcile rendered zoner puddles (§15 area denial) — a corrosive acid pool on the ground. */
  private syncZones(): void {
    if (!this.room) return;
    const state = this.room.state.zones;
    state.forEach((zone, id) => {
      const existing = this.zones.get(id);
      if (existing) {
        if (existing.getData("weaponGroundZone") === true) syncGroundZonePatch(existing, zone);
        return;
      }
      if (zone.kind === ZoneKind.Weapon) {
        const patch = makeGroundZonePatch(this, zone);
        patch.setAlpha(0);
        this.tweens.add({ targets: patch, alpha: 1, duration: 160 });
        this.zones.set(id, patch);
        return;
      }
      const rx = zone.radius;
      const ry = zone.radius * 0.62; // top-down squish
      // §8/§15: UNPARRYABLE zones speak RED/ORANGE danger (never white/neon-friendly). Reads as a
      // poison pool against the dust (§28.7).
      const fill = this.add.ellipse(0, 0, rx * 2, ry * 2, 0x8f2d18, 0.44);
      const inner = this.add.ellipse(0, 0, rx * 1.25, ry * 1.25, 0xff5d2e, 0.32);
      const rim = this.add.ellipse(0, 0, rx * 2, ry * 2).setStrokeStyle(4, 0xff7a3a, 0.95);
      const assistPattern = this.add.graphics();
      this.drawZoneAssistPattern(assistPattern, rx, ry);
      assistPattern.setVisible(colorblindShapesEnabled(this.feedbackSettings.colorblindAssist));
      const c = this.add.container(zone.x, zone.y, [fill, inner, rim, assistPattern]).setDepth(1);
      c.setData("colorblindPattern", assistPattern);
      // Fade in, then bubble; the server owns the actual lifetime/expiry.
      c.setAlpha(0);
      this.tweens.add({ targets: c, alpha: 1, duration: 220 });
      this.tweens.add({
        targets: inner,
        scale: 1.25,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: "Sine.inOut",
      });
      this.zones.set(id, c);
    });
    for (const id of this.zones.keys()) {
      if (!state.has(id)) {
        this.zones.get(id)?.destroy();
        this.zones.delete(id);
      }
    }
  }

  private setZoneAssistVisibility(): void {
    const visible = colorblindShapesEnabled(this.feedbackSettings.colorblindAssist);
    for (const zone of this.zones.values()) {
      const pattern = zone.getData("colorblindPattern") as Phaser.GameObjects.Graphics | undefined;
      pattern?.setVisible(visible);
    }
  }

  /** Dashed perimeter plus clipped diagonal hatching: persistent MOVE-OUT zones never rely on red fill. */
  private drawZoneAssistPattern(g: Phaser.GameObjects.Graphics, rx: number, ry: number): void {
    const trace = (): void => {
      g.beginPath();
      const dashCount = 28;
      const dashSpan = (Math.PI * 2) / dashCount;
      for (let i = 0; i < dashCount; i += 2) {
        const start = i * dashSpan;
        const end = start + dashSpan * 0.78;
        g.moveTo(Math.cos(start) * rx, Math.sin(start) * ry);
        g.lineTo(Math.cos(end) * rx, Math.sin(end) * ry);
      }
      const dx = Math.SQRT1_2;
      const dy = -Math.SQRT1_2;
      const px = -dy;
      const py = dx;
      for (const offset of [-0.66, -0.22, 0.22, 0.66]) {
        const half = Math.sqrt(Math.max(0, 1 - offset * offset));
        g.moveTo((px * offset - dx * half) * rx, (py * offset - dy * half) * ry);
        g.lineTo((px * offset + dx * half) * rx, (py * offset + dy * half) * ry);
      }
      g.strokePath();
    };
    g.lineStyle(5, 0x1b100c, 0.78);
    trace();
    g.lineStyle(2, 0xffb066, 0.96);
    trace();
  }

  /** Build one QOL-04 gate: broad disc/core are honest ground art below actors; the thin halo, icon, and
   *  decision copy live in the protected world-response layer above POIs/bodies but below the HUD. */
  private buildGate(
    x: number,
    y: number,
    ring: number,
    core: number,
    text: string,
    textColor: string,
    icon: string,
  ): GateVisual {
    const outer = this.add.circle(0, 0, EXTRACT_RADIUS, ring, 0.16).setStrokeStyle(3, ring, 0.7);
    const inner = this.add
      .circle(0, 0, EXTRACT_RADIUS * 0.5, core, 0.22)
      .setStrokeStyle(2, core, 0.9);
    const ground = this.add.container(x, y, [outer, inner]).setDepth(GATE_GROUND_DEPTH);
    const halo = this.add.circle(0, 0, EXTRACT_RADIUS).setStrokeStyle(3, ring, 0.95);
    const iconRead = this.add
      .text(0, 0, icon, {
        fontSize: "24px",
        color: textColor,
        fontStyle: "bold",
        stroke: "#17140f",
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    const label = this.add
      .text(0, -EXTRACT_RADIUS - 16, text, {
        fontSize: "16px",
        color: textColor,
        fontStyle: "bold",
        stroke: "#17140f",
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    const protectedRead = this.add
      .container(x, y, [halo, iconRead, label])
      .setDepth(GATE_PROTECTED_DEPTH);
    this.tweens.add({
      targets: inner,
      scale: 1.35,
      duration: 760,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    });
    this.tweens.add({
      targets: halo,
      scale: 1.04,
      duration: 760,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    });
    return { ground, protectedRead };
  }

  private destroyGate(gate: GateVisual): void {
    gate.ground.destroy();
    gate.protectedRead.destroy();
  }

  /** Preserve the kill→reward bearing when full-footprint safety relocates extract away from the corpse. */
  private showPortalRelocationBeam(x: number, y: number): void {
    if (!Number.isFinite(this.lastBossX) || !Number.isFinite(this.lastBossY)) return;
    if (Math.hypot(x - this.lastBossX, y - this.lastBossY) < 12) return;
    const beam = this.add.graphics().setDepth(GATE_PROTECTED_DEPTH - 1);
    beam.lineStyle(5, 0xffd479, 0.88);
    beam.lineBetween(this.lastBossX, this.lastBossY, x, y);
    this.tweens.add({
      targets: beam,
      alpha: 0,
      duration: 1100,
      ease: "Cubic.easeOut",
      onComplete: () => beam.destroy(),
    });
  }

  /** Show/hide BOTH gates of the §6 greed decision at their authoritative positions: the amber EXTRACT
   *  portal (bank & end) and the violet DEEPER rift (v0.103 — descend to the next dimension, harder). */
  private syncPortal(): void {
    if (!this.room) return;
    const st = this.room.state;
    if (st.portalOpen && !this.portal) {
      this.portal = this.buildGate(
        st.portalX,
        st.portalY,
        0x6fd6ff,
        0xffd479,
        "HOLD TO EXTRACT — BANK & END",
        "#ffd479",
        "▼",
      );
      this.portalLocatorPulseUntil = this.time.now + 3000;
      this.showPortalRelocationBeam(st.portalX, st.portalY);
    }
    if (!st.portalOpen && this.portal) {
      this.destroyGate(this.portal);
      this.portal = undefined;
    }
    if (st.riftOpen && !this.rift) {
      this.rift = this.buildGate(
        st.riftX,
        st.riftY,
        0xb478ff,
        0x8a4dff,
        "⇓ RIFT — push deeper (harder, richer)",
        "#b478ff",
        "⇓",
      );
      this.riftLocatorPulseUntil = this.time.now + 3000;
    }
    if (!st.riftOpen && this.rift) {
      this.destroyGate(this.rift);
      this.rift = undefined;
    }
  }

  /** §16 v0.116 Polish B — the ambient DUST layer: ~48 screen-space motes drift on a gentle wind + bob,
   *  wrapping around the viewport, tinted the dimension's `dustDrift` colour at a low alpha. Lazily built on
   *  the first frame; pure atmosphere (no gameplay effect). */
  private updateAmbientDust(): void {
    if (!this.room) return;
    const W = this.screenW();
    const H = this.screenH();
    if (!this.dustG) {
      this.dustG = this.add.graphics().setScrollFactor(0).setDepth(90);
      for (let i = 0; i < 48; i++) {
        this.dust.push({
          x: Math.random() * W,
          y: Math.random() * H,
          vx: 6 + Math.random() * 14, // a slow prevailing wind (rightward)
          vy: (Math.random() * 2 - 1) * 5,
          r: 0.8 + Math.random() * 1.9,
          a: 0.05 + Math.random() * 0.12,
          ph: Math.random() * Math.PI * 2,
        });
      }
    }
    const color = getDimension(this.room.state.dimensionId).palette.dustDrift;
    const dt = Math.min(0.05, this.deltaSec);
    const t = this.time.now / 1000;
    const g = this.dustG;
    g.clear();
    for (const d of this.dust) {
      d.x += d.vx * dt;
      d.y += (d.vy + Math.sin(t * 0.6 + d.ph) * 6) * dt; // gentle vertical wander
      if (d.x > W + 8) d.x = -8;
      if (d.y < -8) d.y = H + 8;
      else if (d.y > H + 8) d.y = -8;
      g.fillStyle(color, d.a);
      g.fillCircle(d.x, d.y, d.r);
    }
  }

  private onWeaponManifest(payload: unknown): void {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return;
    const row = payload as { runId?: unknown; entries?: unknown };
    if (typeof row.runId !== "string" || !Array.isArray(row.entries) || row.entries.length > 32)
      return;
    const next = new Map<string, OwnerWeaponManifestEntry>();
    for (const raw of row.entries) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
      const entry = raw as Partial<OwnerWeaponManifestEntry>;
      if (
        typeof entry.entryId !== "string" ||
        (entry.kind !== "single" && entry.kind !== "pair") ||
        (entry.origin !== "committed" && entry.origin !== "found") ||
        (entry.location !== "active" && entry.location !== "pack" && entry.location !== "field") ||
        !Number.isInteger(entry.start) ||
        !Array.isArray(entry.instanceIds)
      )
        continue;
      next.set(entry.entryId, {
        entryId: entry.entryId,
        kind: entry.kind,
        origin: entry.origin,
        location: entry.location,
        start: Number(entry.start),
        instanceIds: entry.instanceIds
          .filter((id): id is string => typeof id === "string")
          .slice(0, 2),
        weaponIds: this.weaponManifest.get(entry.entryId)?.weaponIds ?? [],
      });
    }
    this.weaponManifest.clear();
    for (const [id, entry] of next) this.weaponManifest.set(id, entry);
    this.weaponManifestRunId = row.runId;
    const self = this.room?.state.players.get(this.room.sessionId);
    if (self) this.hydrateWeaponManifest(self);
  }

  private hydrateWeaponManifest(self: PlayerState): void {
    for (const entry of this.weaponManifest.values()) {
      if (entry.location === "field") continue;
      const source = entry.location === "active" ? self.slots : self.bag;
      const physical = entry.kind === "pair" ? 2 : 1;
      const ids: string[] = [];
      for (let offset = 0; offset < physical; offset++) {
        const id = source[entry.start + offset]?.weapon;
        if (id) ids.push(id);
      }
      if (ids.length > 0) entry.weaponIds = ids;
    }
  }

  private manifestEntryAt(
    location: "active" | "pack",
    index: number,
  ): OwnerWeaponManifestEntry | undefined {
    for (const entry of this.weaponManifest.values()) {
      if (entry.location !== location) continue;
      const span = entry.kind === "pair" ? 2 : 1;
      if (index >= entry.start && index < entry.start + span) return entry;
    }
    return undefined;
  }

  private onWeaponSettlementReceipt(payload: unknown): void {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return;
    const row = payload as Partial<WeaponSettlementReceiptView>;
    if (
      row.ok !== true ||
      (row.outcome !== "victory" && row.outcome !== "defeat") ||
      !Number.isFinite(row.returnedEntries) ||
      !Number.isFinite(row.returnedPhysical) ||
      !Number.isFinite(row.intakeEntries) ||
      !Number.isFinite(row.lostEntries) ||
      !Number.isFinite(row.lostPhysical)
    )
      return;
    const key = `${this.weaponManifestRunId}:${row.outcome}:${row.returnedPhysical}:${row.lostPhysical}`;
    if (key === this.lastSettlementKey) return;
    this.lastSettlementKey = key;
    this.settlementResult = settlementPresentation(
      payload as WeaponSettlementReceiptView,
      this.petMetaAccount.weaponBank.expedition,
      [...this.weaponManifest.values()].map((entry) => ({
        entryId: entry.entryId,
        origin: entry.origin,
        location: entry.location,
        physical: entry.kind === "pair" ? 2 : 1,
        weaponNames: entry.weaponIds.map((id) => WEAPONS[id]?.name ?? "Unknown weapon"),
      })),
    );
    this.audio.play(row.outcome === "victory" ? "settlement:kept" : "settlement:lost");
  }

  /** Boss health bar + approach banner + victory screen (§16). */
  private onPetProgressReceipt(payload: unknown): void {
    if (!payload || typeof payload !== "object") return;
    const row = payload as Partial<PetProgressReceipt>;
    if (
      !isPetId(row.petId) ||
      (row.outcome !== "victory" && row.outcome !== "defeat") ||
      !Number.isFinite(row.awardedBondXp) ||
      !Number.isFinite(row.oldLevel) ||
      !Number.isFinite(row.newLevel) ||
      (row.oldStageBand !== 1 && row.oldStageBand !== 2 && row.oldStageBand !== 3) ||
      (row.newStageBand !== 1 && row.newStageBand !== 2 && row.newStageBand !== 3)
    )
      return;
    const receipt = payload as PetProgressReceipt;
    const key = `${receipt.petId}:${receipt.oldBondXp}:${receipt.newBondXp}:${receipt.outcome}`;
    if (key === this.lastPetReceiptKey) return;
    this.lastPetReceiptKey = key;
    this.petResultLine = formatPetProgressReceipt(receipt);
    if (receipt.slateTortoiseAwarded)
      this.petResultLine += "\nSlate Tortoise joined your Companions folio.";
    const evolution = receipt.oldStageBand !== receipt.newStageBand || receipt.reachedCapstone;
    this.audio.play(
      evolution
        ? receipt.newStageBand === 2
          ? "pet:evolve:awakened"
          : "pet:evolve:ascendant"
        : "pet:bond-progress",
    );
    if (!evolution) return;
    const generation = this.connectionGeneration;
    const play = (manifest: PetPartsManifest | null): void => {
      if (!manifest || generation !== this.connectionGeneration) return;
      playPetEvolutionCeremony(
        this,
        manifest,
        receipt.petId,
        receipt.oldStageBand,
        receipt.newStageBand,
        petEvolutionLabel(receipt),
      );
    };
    if (this.petManifest !== undefined) play(this.petManifest);
    else void loadPetPartsManifest().then(play);
  }

  private updateRunState(): void {
    if (!this.room) return;
    // Locate the boss (if any) — §17 ANY dimension's boss (archetype "boss"), not just OLD RUST — and total
    // its max HP from the roster. The nameplate + approach toast read the active dimension's name.
    let boss: { hp: number; kind: string; x: number; y: number } | undefined;
    this.room.state.enemies.forEach((e) => {
      if (ENEMY_KINDS[e.kind]?.archetype === "boss") boss = e;
    });
    const s = this.uiScale();
    const wormDef = this.room.state.wormBoss.active
      ? BOSSES[this.room.state.bossKind]?.worm
      : undefined;
    const vastaghar = this.room.state.vastaghar;
    const bossMax = boss
      ? vastaghar.active && boss.kind === "world-titan" && vastaghar.maxHp > 0
        ? vastaghar.maxHp
        : wormDef
          ? wormDef.baseCoreHp *
            enemyHpScale(this.room.state.players.size) *
            depthHpScale(this.room.state.depth)
          : (ENEMY_KINDS[boss.kind]?.hp ?? 420)
      : 420;
    const dimName = getDimension(this.room.state.dimensionId).name;
    // §16 v0.109 label with the boss DEF's name when it's a bespoke boss; else the dimension's generic boss.
    const bossDefName = BOSSES[this.room.state.bossKind]?.name;
    const present = !!boss;
    if (present && boss) {
      const bossRatio = Math.max(0, Math.min(1, boss.hp / bossMax));
      // §19 v0.108 A8: the boss bar DRAINS smoothly instead of stepping down per 20Hz patch.
      if (this.bossShown < 0) {
        this.bossShown = bossRatio;
        // §16 v0.117 boss ENTRANCE juice — the first frame a boss appears, the ground quakes + the screen
        // flashes + a deep boom announces it. The COLOSSUS (renderScale ≥5) gets a far heavier, longer quake
        // so a "massive boss" ARRIVES like a cataclysm, not just another spawn.
        if (!(vastaghar.active && boss.kind === "world-titan")) {
          const rs = ENEMY_KINDS[boss.kind]?.renderScale ?? 1;
          const titanic = rs >= 5;
          this.shakeCam(titanic ? 700 : 360, titanic ? 0.02 : 0.011, "world");
          this.cameras.main.flash(titanic ? 420 : 240, titanic ? 130 : 80, titanic ? 32 : 20, 18);
          this.audio.play("bossslam", { x: boss.x, amt: 1 });
        }
      }
      // Schema-26's frozen max HP makes the flagship bar authoritative: no smoothing lag may conceal or
      // visually cross the 70/35/8% phase edges after the server has committed them.
      this.bossShown =
        vastaghar.active && boss.kind === "world-titan"
          ? bossRatio
          : Phaser.Math.Linear(this.bossShown, bossRatio, 0.2);
      const progressTop = this.objectiveProgressTop;
      const progressWidth = this.objectiveProgressWidth;
      const progressInnerWidth = Math.max(1, progressWidth - 4 * s);
      this.bossBarBg
        .setSize(progressWidth, 16 * s)
        .setPosition(this.screenW() / 2, progressTop)
        .setVisible(true);
      const barLeft = this.screenW() / 2 - progressInnerWidth / 2;
      this.bossBarFill.setPosition(barLeft, progressTop + 8 * s).setVisible(true);
      this.bossBarFill.width = progressInnerWidth * this.bossShown;
      const vastagharPhaseName =
        vastaghar.phase === VastagharPhase.LearnWeight
          ? "Learn the Weight"
          : vastaghar.phase === VastagharPhase.BreakStride
            ? "Break the Stride"
            : vastaghar.phase === VastagharPhase.UnderHeel
              ? "Under the Heel"
              : vastaghar.phase === VastagharPhase.FinalTread
                ? "Final Tread"
                : "";
      this.bossText
        .setPosition(this.screenW() / 2, progressTop - 2 * s)
        .setText(
          vastaghar.active
            ? `Vastaghar, the World-Tread · ${vastagharPhaseName}`
            : bossDefName
              ? bossDefName
              : `${dimName} boss`,
        )
        .setVisible(true);
      // §16 v0.116 Polish B — draw a tick at each PHASE threshold so the escalation gates are visible on the
      // bar. The def's phases[i].hpAbove is the HP fraction where phase i+1 begins; skip the final 0-floor.
      const phaseThresholds = vastaghar.active
        ? VASTAGHAR_ENCOUNTER.thresholds
        : (BOSSES[this.room.state.bossKind]?.phases ?? []).map((phase) => phase.hpAbove);
      this.bossBarSegments.setVisible(true).clear();
      for (const threshold of phaseThresholds) {
        if (threshold <= 0 || threshold >= 1) continue;
        const x = barLeft + progressInnerWidth * threshold;
        // A crossed threshold (fill drained past it) dims; an upcoming one glows — reads the fight's progress.
        const passed = this.bossShown <= threshold;
        this.bossBarSegments.lineStyle(2 * s, passed ? 0x6a2a1a : 0x1a0d08, passed ? 0.7 : 0.95);
        this.bossBarSegments.lineBetween(x, progressTop + 2 * s, x, progressTop + 14 * s);
      }
      if (vastaghar.active) {
        const pipY = progressTop + 22 * s;
        for (let i = 0; i < VASTAGHAR_ENCOUNTER.strideBreakPips; i++) {
          const pipX = this.screenW() / 2 + (i - 1) * 24 * s;
          const earned = i < vastaghar.stridePips;
          const downed = vastaghar.mode === VastagharMode.StrideBreak;
          this.bossBarSegments.fillStyle(
            downed ? 0xffd978 : earned ? 0xd8b665 : 0x352d27,
            downed ? 0.95 : earned ? 0.9 : 0.75,
          );
          this.bossBarSegments.fillCircle(pipX, pipY, 7 * s);
          this.bossBarSegments.lineStyle(1.5 * s, 0x17120f, 0.8);
          this.bossBarSegments.lineBetween(pipX - 4 * s, pipY - 5 * s, pipX, pipY);
          this.bossBarSegments.lineBetween(pipX, pipY, pipX + 4 * s, pipY + 5 * s);
        }
      }
      if (this.wormRig && this.room.state.wormBoss.active) {
        this.wormRig.drawBossBarNotches(
          this.bossBarSegments,
          this.room.state.wormBoss,
          barLeft,
          progressInnerWidth,
          progressTop + 2 * s,
          progressTop + 14 * s,
          s,
        );
      }
    } else {
      this.bossShown = -1;
      this.bossBarBg.setVisible(false);
      this.bossBarFill.setVisible(false);
      this.bossBarSegments.setVisible(false);
      this.bossText.setVisible(false);
    }
    // Boss-approach toast on first appearance.
    if (present && !vastaghar.active && !this.prevBossPresent && this.bannerShownFor !== "boss") {
      this.bannerShownFor = "boss";
      this.flashBanner(`⚠ The ${dimName} boss approaches`, "#ff5d3b");
    }
    if (!present) this.bannerShownFor = "";
    this.prevBossPresent = present;

    // Victory screen — §6 v0.103: report the extraction's REAL payload (depth reached + total banked).
    const won = this.room.state.outcome === "victory";
    // §19 v0.108 an ascending triumphant sting the moment the run is banked (once, on the transition).
    if (won && !this.prevWon) this.audio.play("extract");
    this.prevWon = won;
    this.victoryText.setVisible(won);
    if (won) {
      const ceremony = this.settlementResult;
      const outcome = ceremony
        ? `${ceremony.heading}\n${ceremony.primary}\n${ceremony.detail}`
        : "BANKING CARRY · awaiting settlement receipt";
      this.victoryText
        .setText(
          this.room.state.mode === "bossrush"
            ? `☠  GAUNTLET CLEARED  ☠\n${outcome}\n(Wardrobe — top-right)`
            : `EXTRACTED · DEPTH ${this.room.state.depth}\n${outcome}\n(Wardrobe — top-right)`,
        )
        .setText(`${this.victoryText.text}${this.petResultLine ? `\n${this.petResultLine}` : ""}`)
        .setPosition(this.screenW() / 2, this.screenH() / 2);
    }
  }

  /** Dev-only Testing-Grounds art-direction switch; registry state dies with the client session. */
  private cyclePoseShowroom(def: WeaponDef): void {
    const variants = poseShowroomVariantSetFor(def);
    if (!variants?.registryKey) {
      const family = weaponPoseFamilyFor(def).replaceAll("-", " ");
      this.flashBanner(`POSE · ${family}: panel default`, "#33e6ff");
      return;
    }
    const current = this.game.registry.get(variants.registryKey);
    const next = nextPoseShowroomOption(variants, current);
    if (!next) return;
    this.game.registry.set(variants.registryKey, next.value);
    this.flashBanner(`POSE · ${next.label}`, "#33e6ff");
  }

  /** Pooled-lifetime notice plate: width-bound, two lines maximum, and always self-retiring. */
  private flashBanner(msg: string, color: string): void {
    // §7 v0.105 de-clunk: STACK banners that land within the fade window instead of overprinting the exact
    // same point (a loot reveal + a depth banner used to render on top of each other, unreadable). Reset the
    // slot once enough time has passed that the previous banner has faded.
    const now = this.time.now;
    this.bannerSlot = now - this.lastBannerAt > 2200 ? 0 : (this.bannerSlot + 1) % 4;
    this.lastBannerAt = now;
    const scale = this.uiScale();
    const baseY = this.screenH() / 2 - 80 * scale + this.bannerSlot * 54 * scale;
    const maxPlateWidth = Math.max(160, Math.min(620 * scale, this.screenW() - 32 * scale));
    const text = this.add
      .text(0, 0, msg, {
        fontFamily: "monospace",
        fontSize: `${Math.max(18, 24 * scale)}px`,
        color,
        fontStyle: "bold",
        align: "center",
        wordWrap: { width: Math.max(120, maxPlateWidth - 32 * scale), useAdvancedWrap: true },
        maxLines: 2,
      })
      .setOrigin(0.5)
      .setShadow(0, 1, "#000000", 2, true, true)
      .setResolution(Math.max(2, Math.ceil(RENDER_DPR)));
    const plateWidth = Math.min(maxPlateWidth, Math.max(160, text.width + 32 * scale));
    const plateHeight = text.height + 20 * scale;
    const plate = this.add.graphics();
    plate
      .fillStyle(0x000000, 0.46)
      .fillRoundedRect(
        -plateWidth / 2 + 2 * scale,
        -plateHeight / 2 + 3 * scale,
        plateWidth,
        plateHeight,
        8 * scale,
      )
      .fillStyle(0x0a0805, 0.92)
      .fillRoundedRect(-plateWidth / 2, -plateHeight / 2, plateWidth, plateHeight, 8 * scale)
      .lineStyle(Math.max(1, scale), Phaser.Display.Color.HexStringToColor(color).color, 0.68)
      .strokeRoundedRect(-plateWidth / 2, -plateHeight / 2, plateWidth, plateHeight, 8 * scale);
    const root = this.add
      .container(this.screenW() / 2, baseY, [plate, text])
      .setScrollFactor(0)
      .setDepth(100003);
    const retire = () => {
      if (root.active) root.destroy(true);
    };
    if (prefersReducedPaperMotion()) {
      // Reduced motion keeps the same readable dwell, then snaps off at the lifetime endpoint.
      root.setAlpha(1).setScale(1);
      this.time.delayedCall(2280, retire);
      return;
    }
    root.setScale(1.12).setAlpha(0);
    // §19 v0.108 A10: a snappy entrance POP (overshoot-in) before the long fade — lifts every transient
    // banner (boss approach, loot reveal, depth) from "appears" to "arrives".
    this.tweens.add({
      targets: root,
      scale: 1,
      alpha: 1,
      duration: 180,
      ease: "Back.easeOut",
      onComplete: () => {
        this.tweens.add({
          targets: root,
          y: baseY - 24,
          alpha: 0,
          duration: 2100,
          ease: "Cubic.easeIn",
          onComplete: retire,
        });
      },
    });
    // §7 v0.105 de-clunk: NO camera shake on a banner. Shaking the whole screen for a pure UI event (boss
    // approach, loot reveal, depth) fought the gun/hit shakes for the same channel and read as noise.
  }

  private clearLevelPaperCounters(): void {
    for (const tween of this.levelWinPaperCounters.splice(0)) {
      tween.stop();
      tween.remove();
    }
  }

  /** P3 shell backing only; title, countdown, choice copy, and hit geometry stay face-on and literal. */
  private animateLevelFolio(
    dim: Phaser.GameObjects.Rectangle,
    lower: Phaser.GameObjects.Container,
    upper: Phaser.GameObjects.Container,
  ): void {
    if (prefersReducedPaperMotion()) return;
    dim.setAlpha(0);
    this.tweens.add({ targets: dim, alpha: 1, duration: 100 });
    lower.setScale(0.82, -0.04).setRotation(0.045);
    upper.setScale(1, -0.92).setRotation(-0.05);
    let depthSwapped = false;
    const counter = this.tweens.addCounter({
      from: 0,
      to: 320,
      duration: 320,
      onUpdate: (tw) => {
        const elapsed = tw.getValue() ?? 0;
        lower.scaleX = paperPopScaleX(elapsed, 210);
        lower.scaleY = paperPopScaleY(elapsed, 210);
        lower.rotation = paperPopRotation(elapsed, 210);
        const u = paperSmoothstep((elapsed - 70) / 250);
        upper.scaleY = -0.92 + 1.92 * u;
        upper.rotation = 0.05 * Math.sin(Math.PI * u);
        if (!depthSwapped && u >= 0.479) {
          depthSwapped = true;
          upper.setDepth(100010.7);
        }
      },
      onComplete: () => {
        lower.setScale(1).setRotation(0);
        upper.setScale(1).setRotation(0);
      },
    });
    this.levelWinPaperCounters.push(counter);
  }

  private inLevelWindow(self: PlayerState | undefined): boolean {
    return !!self && (self.flexPending > 0 || self.sigPending > 0);
  }

  private get verbs(): VerbLegendManager {
    if (!this.verbUi) throw new Error("Verb UI unavailable");
    return this.verbUi;
  }

  private openOwnerNote(type: OwnerNoteType, self: PlayerState): void {
    const opened = this.ownerNoteUi?.open({
      type,
      activeSlot: self.activeSlot,
      weaponId: type === "weapon" ? self.weapon : undefined,
      weaponName: type === "weapon" ? (WEAPONS[self.weapon]?.name ?? self.weapon) : undefined,
    });
    if (!opened) return;
    const keyboard = this.input.keyboard;
    if (keyboard) {
      keyboard.resetKeys();
      keyboard.disableGlobalCapture();
      keyboard.manager.enabled = false;
      keyboard.enabled = false;
      this.ownerNoteKeyboardPaused = true;
    }
    this.rHold = 0;
    this.rSalvaged = false;
    this.jumpQueued = false;
    this.poundQueued = false;
    this.slideQueued = false;
    this.crouchHeld = false;
  }

  private restoreOwnerNoteKeyboard(): void {
    if (!this.ownerNoteKeyboardPaused) return;
    const keyboard = this.input.keyboard;
    if (keyboard) {
      keyboard.manager.enabled = true;
      keyboard.enabled = true;
      keyboard.resetKeys();
      keyboard.enableGlobalCapture();
    }
    this.ownerNoteKeyboardPaused = false;
  }

  private sortedBackpackOrder(self: PlayerState): number[] {
    return self.bag
      .map((_, index) => index)
      .sort((a, b) => {
        const left = self.bag[a];
        const right = self.bag[b];
        const rarity = (right?.rarity ?? 0) - (left?.rarity ?? 0);
        if (rarity !== 0) return rarity;
        return (
          (WEAPONS[left?.weapon ?? ""]?.name ?? "").localeCompare(
            WEAPONS[right?.weapon ?? ""]?.name ?? "",
          ) || a - b
        );
      });
  }

  private openBackpackWorkflow(workflow: "inventory" | "sell"): void {
    this.bagWorkflow = workflow;
    this.bagFocusCell = 0;
    this.bagSelected = null;
    this.bagHoverCell = -1;
    this.bagRenderSignature = "";
  }

  private closeBackpackModal(): void {
    this.bagOpen = false;
    this.shopOpen = false;
    this.bagSelected = null;
    this.bagHoverCell = -1;
    this.bagRenderSignature = "";
  }

  private moveBackpackFocus(
    move: "left" | "right" | "up" | "down",
    self: PlayerState | undefined,
  ): void {
    const row = Math.floor(this.bagFocusCell / 4);
    const column = this.bagFocusCell % 4;
    const nextRow = move === "up" ? (row + 2) % 3 : move === "down" ? (row + 1) % 3 : row;
    const nextColumn =
      move === "left" ? (column + 3) % 4 : move === "right" ? (column + 1) % 4 : column;
    this.bagFocusCell = nextRow * 4 + nextColumn;
    const bagIndex = self ? this.sortedBackpackOrder(self)[this.bagFocusCell] : undefined;
    this.bagSelected = bagIndex === undefined ? null : { source: "bag", index: bagIndex };
    this.bagRenderSignature = "";
  }

  private moveBackpackWorkflow(delta: -1 | 1): void {
    if (!this.shopOpen) return;
    const workflows = ["sell", "bind", "upgrades"] as const;
    const index = Math.max(0, workflows.indexOf(this.bagWorkflow as (typeof workflows)[number]));
    this.bagWorkflow = workflows[(index + delta + workflows.length) % workflows.length] ?? "sell";
    this.bagSelected = null;
    this.bagRenderSignature = "";
  }

  private activateBackpackSelection(self: PlayerState): void {
    if (this.bagWorkflow === "upgrades") {
      const upgrade = META_UPGRADES[this.bagFocusCell % META_UPGRADES.length];
      if (upgrade) this.room?.send("buyUpgrade", { id: upgrade.id });
      return;
    }
    const selected = this.bagSelected;
    if (!selected) return;
    if (this.bagWorkflow === "inventory") {
      if (selected.source === "bag") {
        this.room?.send("bagEquip", { index: selected.index, slot: self.activeSlot });
      } else if (self.bag.length >= BAG_CAP) {
        this.flashBanner(`Pack full — ${BAG_CAP}/${BAG_CAP}`, ARMORY_CSS_COLORS.warning);
      } else {
        this.room?.send("bagStore", { slot: selected.index });
      }
      return;
    }
    if (this.bagWorkflow === "sell") {
      this.room?.send("sellWeapon", { from: selected.source, index: selected.index });
      this.bagSelected = null;
      this.bagRenderSignature = "";
      return;
    }
    const entry = loadoutEntryView(self);
    if (entry.offId) {
      this.room?.send("unbindPair");
      return;
    }
    const candidate =
      selected.source === "bag"
        ? this.bagPairItem(self, selected.index)
        : this.slotPairItem(self, selected.index);
    if (!candidate || !pairEligible(WEAPONS[entry.leadId], WEAPONS[candidate.weaponId])) {
      this.flashBanner("Select a compatible weapon to bind", ARMORY_CSS_COLORS.warning);
      return;
    }
    this.pairCandidate = {
      source: selected.source,
      index: selected.index,
      identity: this.pairItemIdentity(candidate),
    };
    this.confirmPair(self);
  }

  private inputModalBlocked(self: PlayerState | undefined): boolean {
    return (
      this.inLevelWindow(self) ||
      this.levelWinInputReleaseLatch ||
      this.verbs.isModalBlocking() ||
      this.summonOpen ||
      this.bagOpen ||
      this.shopOpen ||
      !!this.ownerNoteUi?.isOpen()
    );
  }

  private legendInputsReleased(): boolean {
    return (
      this.levelWindowInputsReleased() &&
      !this.keys.H.isDown &&
      !this.keys.R.isDown &&
      !this.keys.Q.isDown &&
      !this.keys.E.isDown &&
      !this.keys.Z.isDown &&
      !this.keys.X.isDown &&
      !this.keys.G.isDown &&
      !this.keys.T.isDown &&
      !this.keys.C.isDown &&
      !this.keys.TAB.isDown &&
      !this.keys.CTRL.isDown
    );
  }

  private offerContextHint(id: ContextHintId): void {
    const self = this.room?.state.players.get(this.room.sessionId);
    if (this.inputModalBlocked(self) || this.summonOpen || this.bagOpen || this.shopOpen) {
      return;
    }
    this.verbs.offerHint(id, this.time.now);
  }

  private retireLevelWindow(animateClose: boolean): void {
    this.clearLevelPaperCounters();
    const objects = this.levelWinObjects.splice(0);
    const choices = this.levelWinChoices.splice(0);
    const zones = new Set<Phaser.GameObjects.GameObject>(choices.map((choice) => choice.zone));
    const dim = this.levelWinDim;
    const lower = this.levelWinLower;
    const upper = this.levelWinUpper;
    for (const choice of choices) {
      choice.zone.disableInteractive();
      choice.zone.destroy();
    }
    this.levelWinTimerBar = undefined;
    this.levelWinTimerText = undefined;
    this.levelWinStatusText = undefined;
    this.levelWinDim = undefined;
    this.levelWinLower = undefined;
    this.levelWinUpper = undefined;

    const remaining = objects.filter((object) => !zones.has(object));
    if (!animateClose || prefersReducedPaperMotion() || remaining.length === 0) {
      for (const object of remaining) object.destroy();
      return;
    }

    const paper = new Set<Phaser.GameObjects.GameObject>(
      [dim, lower, upper].filter(Boolean) as Phaser.GameObjects.GameObject[],
    );
    const fadeTargets = remaining.filter((object) => !paper.has(object));
    this.tweens.add({ targets: fadeTargets, alpha: 0, duration: 110, ease: "Sine.easeIn" });
    if (dim) this.tweens.add({ targets: dim, alpha: 0, duration: 140 });
    if (lower)
      this.tweens.add({
        targets: lower,
        scaleY: -0.04,
        duration: 180,
        ease: "Cubic.easeIn",
      });
    if (upper)
      this.tweens.add({
        targets: upper,
        scaleY: -0.04,
        duration: 180,
        ease: "Cubic.easeIn",
      });
    this.time.delayedCall(185, () => {
      for (const object of remaining) object.destroy();
    });
  }

  /** Show FLEX before Signature; resize/offer edges rebuild without replaying the full folio. */
  private updateLevelWindow(): void {
    if (!this.room) return;
    const self = this.room.state.players.get(this.room.sessionId);
    const flex = !!self && self.flexPending > 0;
    const sig = !!self && self.sigPending > 0 && !flex;
    const open = flex || sig;
    const mode: LevelUpMode | "" = flex ? "flex" : sig ? "signature" : "";
    const key =
      open && self
        ? `${self.level}:${mode}:${self.flexPending}:${self.sigPending}:${self.sigOffer}:${levelUpLayoutKey(this.screenW(), this.screenH())}`
        : "";
    if (key !== this.levelWinKey) {
      const wasOpen = this.levelWinMode !== "";
      this.retireLevelWindow(!open && wasOpen);
      this.levelWinKey = key;
      this.levelWinMode = mode;
      this.levelWinSelectionSent = false;
      this.levelWinAwaitingRelease = true;
      if (self && mode === "flex") this.buildLevelWindow(self, !wasOpen);
      else if (self && mode === "signature") this.buildAugmentWindow(self, !wasOpen);
    }
    if (!open || !self || !this.levelWinTimerBar || !this.levelWinTimerText) return;

    if (self.flexTimerDs !== this.levelWinTimerSampleDs) {
      this.levelWinTimerSampleDs = self.flexTimerDs;
      this.levelWinTimerSampleAt = this.time.now;
    }
    const authoritativeSeconds = self.flexTimerDs / 10;
    const seconds = Math.max(
      0,
      Math.min(
        authoritativeSeconds,
        authoritativeSeconds - (this.time.now - this.levelWinTimerSampleAt) / 1000,
      ),
    );
    const ratio = Math.max(0, Math.min(1, seconds / LEVELUP_WINDOW_SECONDS));
    const color = seconds <= 1.5 ? 0xf05b3b : seconds <= 3 ? 0xffa62b : 0xffd479;
    this.levelWinTimerBar.width = this.levelWinTimerWidth * ratio;
    this.levelWinTimerBar.setFillStyle(color);
    this.levelWinTimerText.setText(
      seconds > 0 ? `AUTO: ${this.levelWinAutoLabel} IN ${seconds.toFixed(1)}s` : "AUTO-SELECTING…",
    );
  }

  private levelWindowText(
    x: number,
    y: number,
    text: string,
    style: Phaser.Types.GameObjects.Text.TextStyle,
  ): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, text, style)
      .setScrollFactor(0)
      .setResolution(Math.max(2, Math.ceil(RENDER_DPR)));
  }

  /** The shared paper shell. Only cardstock folds; copy and hit geometry stay face-on. */
  private buildLevelShell(
    self: PlayerState,
    mode: LevelUpMode,
    choiceCount: number,
    fullEntrance: boolean,
  ): ReturnType<typeof levelUpLayout> {
    const layout = levelUpLayout(this.screenW(), this.screenH(), mode, choiceCount);
    const cx = this.screenW() / 2;
    const cy = this.screenH() / 2;
    const context = levelBuildContext(self);
    const dim = this.add
      .rectangle(cx, cy, this.screenW(), this.screenH(), 0x05040a, 0.48)
      .setScrollFactor(0)
      .setDepth(100010)
      .setInteractive();

    const pg = this.add.graphics();
    pg.fillStyle(0x0a0812, 0.95).fillRoundedRect(
      layout.panelX,
      layout.panelY,
      layout.panelWidth,
      layout.panelHeight,
      14,
    );
    this.drawPanelFrame(pg, layout.panelX, layout.panelY, layout.panelWidth, layout.panelHeight, 1);
    const lowerHingeY = layout.panelY + layout.panelHeight;
    pg.setPosition(-cx, -lowerHingeY);
    const lower = this.add.container(cx, lowerHingeY, [pg]).setScrollFactor(0).setDepth(100010.5);
    const seamY = layout.timerY + 19;
    const upperG = this.add.graphics();
    upperG
      .fillStyle(0x0a0812, 0.98)
      .fillRoundedRect(layout.panelX, layout.panelY, layout.panelWidth, seamY - layout.panelY, 14);
    this.drawPanelFrame(
      upperG,
      layout.panelX,
      layout.panelY,
      layout.panelWidth,
      seamY - layout.panelY,
      1,
    );
    upperG.setPosition(-cx, -seamY);
    const upper = this.add.container(cx, seamY, [upperG]).setScrollFactor(0).setDepth(100010.4);

    const hasFollowup = mode === "flex" && self.sigPending > 0;
    const step = hasFollowup
      ? "1/2 · GROWTH"
      : mode === "signature" && self.level % 5 === 0
        ? "2/2 · SIGNATURE"
        : mode === "flex"
          ? "GROWTH"
          : "SIGNATURE";
    const burden =
      mode === "flex" && self.flexPending > 1 ? ` · ${self.flexPending} MARKS LEFT` : "";
    const title = this.levelWindowText(
      cx,
      layout.titleY,
      `LEVEL ${self.level} · ${step} · CHOOSE 1${burden}`,
      {
        fontSize: layout.tier === "wide" ? "27px" : "20px",
        color: "#f7e4aa",
        fontStyle: "bold",
        align: "center",
      },
    )
      .setOrigin(0.5)
      .setDepth(100011);
    const contextCopy =
      mode === "flex"
        ? `${context.allocationLaw}${hasFollowup ? " • SIGNATURE FOLLOWS" : ""}`
        : `SIGNATURE • ${layout.tier === "wide" ? context.rail : context.compactRail}`;
    const contextText = this.levelWindowText(cx, layout.contextY, contextCopy, {
      fontSize: "14px",
      color: "#cfc8b6",
      fontStyle: "bold",
      align: "center",
      wordWrap: { width: layout.panelWidth - 32 },
      maxLines: 1,
    })
      .setOrigin(0.5)
      .setDepth(100011);
    const timerBg = this.add
      .rectangle(layout.timerLeft, layout.timerY, layout.timerWidth, 12, 0x2a2620, 0.96)
      .setScrollFactor(0)
      .setOrigin(0, 0.5)
      .setDepth(100011);
    this.levelWinTimerBar = this.add
      .rectangle(layout.timerLeft, layout.timerY, layout.timerWidth, 12, 0xffd479)
      .setScrollFactor(0)
      .setOrigin(0, 0.5)
      .setDepth(100012);
    this.levelWinTimerText = this.levelWindowText(cx, layout.timerY, "", {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#171108",
      backgroundColor: "#f7e4aa",
      padding: { x: 7, y: 2 },
      fontStyle: "bold",
    })
      .setOrigin(0.5)
      .setDepth(100012.5);
    const numberShortcut = choiceCount > 1 ? `1–${choiceCount}` : "1";
    const shortcutCopy =
      layout.tier === "compact"
        ? `WORLD LIVE • ${numberShortcut} PICK • ←/→ FOCUS • ENTER`
        : layout.tier === "medium"
          ? `${context.compactRail} • ${numberShortcut} • ←/→ • ENTER`
          : `${context.rail} • ${numberShortcut} PICK • ←/→ • ENTER/SPACE`;
    const footer = this.levelWindowText(cx, layout.footerY, shortcutCopy, {
      fontSize: "14px",
      color: "#9fb0c2",
      align: "center",
      wordWrap: { width: layout.panelWidth - 28 },
      maxLines: 1,
    })
      .setOrigin(0.5)
      .setDepth(100011);
    this.levelWinStatusText = this.levelWindowText(cx, layout.timerY + 17, "", {
      fontSize: "14px",
      color: "#ffb24a",
      fontStyle: "bold",
      align: "center",
    })
      .setOrigin(0.5)
      .setDepth(100012);

    this.levelWinDim = dim;
    this.levelWinLower = lower;
    this.levelWinUpper = upper;
    this.levelWinTimerWidth = layout.timerWidth;
    this.levelWinTimerSampleDs = self.flexTimerDs;
    this.levelWinTimerSampleAt = this.time.now;
    if (fullEntrance) this.animateLevelFolio(dim, lower, upper);
    this.levelWinObjects.push(
      dim,
      lower,
      upper,
      title,
      contextText,
      timerBg,
      this.levelWinTimerBar,
      this.levelWinTimerText,
      footer,
      this.levelWinStatusText,
    );
    return layout;
  }

  /** Choice copy stays face-on; the backing turns and the scene-level rectangle owns input. */
  private prepareLevelCard(control: LevelChoiceControl, index: number): void {
    const { root, face, zone, restY, side } = control;
    const focused = index === this.levelWinFocus;
    const horizontal = !!root.getData("horizontal");
    const focusY = focused && !horizontal ? restY - 6 : restY;
    if (prefersReducedPaperMotion()) {
      root.setY(focusY);
    } else {
      root.setY(restY + 12).setAlpha(0);
      face.setScale(-0.06, 0.94).setRotation(side * 0.035);
      this.tweens.add({
        targets: root,
        y: focusY,
        alpha: 1,
        duration: 180,
        delay: 90 + index * 42,
        ease: "Back.easeOut",
      });
      this.tweens.add({
        targets: face,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        duration: 180,
        delay: 90 + index * 42,
        ease: "Back.easeOut",
      });
    }
    zone.on("pointerover", () => this.setLevelWindowFocus(index));
    zone.on("pointerdown", () => this.activateLevelChoice(index));
  }

  private setLevelWindowFocus(index: number): void {
    if (index < 0 || index >= this.levelWinChoices.length || index === this.levelWinFocus) return;
    this.levelWinFocus = index;
    const reduced = prefersReducedPaperMotion();
    for (let i = 0; i < this.levelWinChoices.length; i++) {
      const control = this.levelWinChoices[i];
      if (!control) continue;
      const selected = i === index;
      const horizontal = !!control.root.getData("horizontal");
      control.focusRing.setAlpha(selected ? 1 : 0);
      this.tweens.killTweensOf(control.root);
      const y = selected && !horizontal ? control.restY - 6 : control.restY;
      const scale = selected && !horizontal ? 1.035 : 1;
      const rotation = selected && !horizontal ? control.side * 0.012 : 0;
      if (reduced) control.root.setY(y).setScale(scale).setRotation(0);
      else
        this.tweens.add({
          targets: control.root,
          y,
          scale,
          rotation,
          duration: 90,
          ease: "Sine.easeOut",
        });
    }
  }

  private activateLevelChoice(index: number): void {
    if (this.levelWinSelectionSent) return;
    const selected = this.levelWinChoices[index];
    if (!selected) return;
    this.levelWinSelectionSent = true;
    this.levelWinInputReleaseLatch = true;
    for (const choice of this.levelWinChoices) choice.zone.disableInteractive();
    this.levelWinStatusText?.setText("APPLYING CHOICE…");
    selected.send();
    this.audio.play("grab");
    const reduced = prefersReducedPaperMotion();
    spawnLevelConfirmEffect(
      this,
      selected.root.x,
      selected.root.y,
      selected.zone.width,
      selected.zone.height,
      selected.view.accent,
      selected.view.particlePack,
      reduced,
    );
    if (!reduced) {
      this.tweens.add({
        targets: selected.root,
        scaleY: 0.94,
        duration: 45,
        yoyo: true,
        ease: "Quad.easeOut",
      });
      this.tweens.add({
        targets: selected.face,
        scaleX: 0.02,
        duration: 130,
        delay: 45,
        ease: "Cubic.easeIn",
      });
      for (const choice of this.levelWinChoices) {
        if (choice === selected) continue;
        this.tweens.add({
          targets: choice.root,
          alpha: 0.28,
          duration: 90,
          ease: "Cubic.easeIn",
        });
      }
    }
  }

  private levelWindowModalKeys(): Phaser.Input.Keyboard.Key[] {
    return [
      this.keys.W,
      this.keys.A,
      this.keys.S,
      this.keys.D,
      this.keys.SPACE,
      this.keys.SHIFT,
      this.keys.ONE,
      this.keys.TWO,
      this.keys.THREE,
      this.keys.FOUR,
      this.keys.FIVE,
      this.keys.LEFT,
      this.keys.RIGHT,
      this.keys.UP,
      this.keys.DOWN,
      this.keys.ENTER,
    ];
  }

  private levelWindowInputsReleased(): boolean {
    return (
      this.levelWindowModalKeys().every((key) => !key.isDown) &&
      !this.keys.F.isDown &&
      !this.input.activePointer.leftButtonDown() &&
      !this.input.activePointer.rightButtonDown()
    );
  }

  private handleLevelWindowInput(): void {
    if (this.levelWinChoices.length === 0) return;
    if (this.levelWinAwaitingRelease) {
      if (this.levelWindowInputsReleased()) this.levelWinAwaitingRelease = false;
      return;
    }
    if (this.levelWinSelectionSent) return;
    const numberKeys = [
      this.keys.ONE,
      this.keys.TWO,
      this.keys.THREE,
      this.keys.FOUR,
      this.keys.FIVE,
    ];
    for (let i = 0; i < numberKeys.length; i++) {
      const key = numberKeys[i];
      if (key && Phaser.Input.Keyboard.JustDown(key) && i < this.levelWinChoices.length) {
        this.setLevelWindowFocus(i);
        this.activateLevelChoice(i);
        return;
      }
    }
    const previous =
      Phaser.Input.Keyboard.JustDown(this.keys.LEFT) ||
      Phaser.Input.Keyboard.JustDown(this.keys.UP) ||
      Phaser.Input.Keyboard.JustDown(this.keys.A) ||
      Phaser.Input.Keyboard.JustDown(this.keys.W);
    const next =
      Phaser.Input.Keyboard.JustDown(this.keys.RIGHT) ||
      Phaser.Input.Keyboard.JustDown(this.keys.DOWN) ||
      Phaser.Input.Keyboard.JustDown(this.keys.D) ||
      Phaser.Input.Keyboard.JustDown(this.keys.S);
    if (previous) {
      this.setLevelWindowFocus(
        (this.levelWinFocus - 1 + this.levelWinChoices.length) % this.levelWinChoices.length,
      );
    } else if (next) {
      this.setLevelWindowFocus((this.levelWinFocus + 1) % this.levelWinChoices.length);
    } else if (
      Phaser.Input.Keyboard.JustDown(this.keys.ENTER) ||
      Phaser.Input.Keyboard.JustDown(this.keys.SPACE)
    ) {
      this.activateLevelChoice(this.levelWinFocus);
    }
  }

  private createLevelChoiceCard(
    view: LevelChoiceView,
    slot: ReturnType<typeof levelUpLayout>["cards"][number],
    index: number,
    send: () => void,
  ): void {
    const width = slot.width;
    const height = slot.height;
    const accentHex = `#${view.accent.toString(16).padStart(6, "0")}`;
    const shadow = this.add.graphics();
    shadow
      .fillStyle(0x000000, 0.5)
      .fillRoundedRect(-width / 2 + 5, -height / 2 + 7, width, height, 12);
    const face = this.add
      .rectangle(0, 0, width, height, 0x17130f, 0.99)
      .setStrokeStyle(3, view.accent, 0.95);
    const dressing = this.add.graphics();
    dressing
      .lineStyle(1, 0xfff2c0, 0.28)
      .strokeRoundedRect(-width / 2 + 6, -height / 2 + 6, width - 12, height - 12, 8);
    dressing.fillStyle(view.accent, 0.8).fillRect(-width / 2 + 12, -height / 2 + 10, 30, 3);
    dressing
      .fillStyle(view.accent, 0.2)
      .fillRoundedRect(-width / 2 + 10, height / 2 - 37, width - 20, 25, 6);
    const focusRing = this.add.graphics().setAlpha(index === this.levelWinFocus ? 1 : 0);
    focusRing
      .lineStyle(2, 0xfff2c0, 1)
      .strokeRoundedRect(-width / 2 + 3, -height / 2 + 3, width - 6, height - 6, 10);
    const icon = this.add.graphics();
    const input = this.levelWindowText(-width / 2 + 12, -height / 2 + 10, String(index + 1), {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#fff3c4",
      fontStyle: "bold",
    }).setOrigin(0, 0);

    let category: Phaser.GameObjects.Text;
    let name: Phaser.GameObjects.Text;
    let outcome: Phaser.GameObjects.Text;
    let context: Phaser.GameObjects.Text;
    if (slot.horizontal) {
      const iconX = -width / 2 + 43;
      const copyX = -width / 2 + 76;
      const copyWidth = width - 90;
      drawIcon(icon, view.icon, iconX, 2, Math.min(15, height * 0.16), view.accent);
      category = this.levelWindowText(copyX, -height / 2 + 10, view.category, {
        fontSize: "12px",
        color: accentHex,
        fontStyle: "bold",
      }).setOrigin(0, 0);
      name = this.levelWindowText(copyX, -height / 2 + 27, view.name, {
        fontSize: "16px",
        color: "#f0ead8",
        fontStyle: "bold",
        wordWrap: { width: copyWidth },
        maxLines: 1,
      }).setOrigin(0, 0);
      const outcomeCopy = view.outcome.replace(/\s+\(\+[^)]*\)$/, "");
      outcome = this.levelWindowText(copyX, 7, outcomeCopy, {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#b8ff6a",
        fontStyle: "bold",
        wordWrap: { width: copyWidth },
        maxLines: 1,
      }).setOrigin(0, 0.5);
      context = this.levelWindowText(0, height / 2 - 24, view.context, {
        fontSize: "14px",
        color: "#d2c9b5",
        fontStyle: "bold",
        align: "center",
        wordWrap: { width: width - 28 },
        maxLines: 1,
      }).setOrigin(0.5);
    } else {
      drawIcon(icon, view.icon, 0, -height * 0.25, Math.min(22, width * 0.12), view.accent);
      category = this.levelWindowText(0, -height / 2 + 17, view.category, {
        fontSize: "13px",
        color: accentHex,
        fontStyle: "bold",
      }).setOrigin(0.5);
      name = this.levelWindowText(0, -height * 0.07, view.name, {
        fontSize: width < 190 ? "18px" : "20px",
        color: "#f0ead8",
        fontStyle: "bold",
        align: "center",
        wordWrap: { width: width - 28 },
        maxLines: 2,
      }).setOrigin(0.5);
      outcome = this.levelWindowText(0, height * 0.2, view.outcome, {
        fontFamily: "monospace",
        fontSize: width < 190 ? "14px" : "16px",
        color: "#b8ff6a",
        fontStyle: "bold",
        align: "center",
        wordWrap: { width: width - 24 },
        maxLines: 2,
      }).setOrigin(0.5);
      context = this.levelWindowText(0, height / 2 - 24, view.context, {
        fontSize: "14px",
        color: "#d2c9b5",
        fontStyle: "bold",
        align: "center",
        wordWrap: { width: width - 28 },
        maxLines: 1,
      }).setOrigin(0.5);
    }
    const root = this.add
      .container(slot.x, slot.y, [
        shadow,
        face,
        dressing,
        focusRing,
        icon,
        input,
        category,
        name,
        outcome,
        context,
      ])
      .setScrollFactor(0)
      .setDepth(100011)
      .setData("horizontal", slot.horizontal);
    // P0: deliberately SCENE-LEVEL + fixed-screen. A Zone inside this container hit-tests in world space
    // once the camera scrolls, even though the visible card remains in screen space. Wide-card bounds also
    // include the complete focused lift/scale so no animated edge becomes a dead click strip.
    const focusScale = slot.horizontal ? 1 : 1.035;
    const hitY = slot.horizontal ? slot.y : slot.y - 6;
    const zone = this.add
      .rectangle(
        slot.x,
        hitY,
        width * focusScale,
        Math.max(44, height * focusScale),
        0xffffff,
        0.001,
      )
      .setScrollFactor(0)
      .setDepth(100013)
      .setInteractive({ useHandCursor: true });
    const control: LevelChoiceControl = {
      root,
      face,
      focusRing,
      zone,
      restY: slot.y,
      side: slot.x < this.screenW() / 2 ? -1 : 1,
      view,
      send,
    };
    this.levelWinChoices.push(control);
    this.prepareLevelCard(control, index);
    this.levelWinObjects.push(root, zone);
  }

  /** Build the authoritative Signature spread; tag color is category, never fictional rarity. */
  private buildAugmentWindow(self: PlayerState, fullEntrance: boolean): void {
    const choices = augmentChoiceViews(self);
    this.levelWinFocus = 0;
    const layout = this.buildLevelShell(self, "signature", choices.length, fullEntrance);
    this.levelWinAutoLabel = choices[0]?.name.toUpperCase() ?? "SERVER PICK";
    choices.forEach((view, index) => {
      const slot = layout.cards[index];
      if (!slot) return;
      this.createLevelChoiceCard(view, slot, index, () =>
        this.room?.send("chooseAugment", { id: view.id }),
      );
    });
  }

  /** Build the five exact-outcome FLEX choices from synced state and shared tuning functions. */
  private buildLevelWindow(self: PlayerState, fullEntrance: boolean): void {
    let squadBestLuk = self.luk;
    this.room?.state.players.forEach((player) => {
      squadBestLuk = Math.max(squadBestLuk, player.luk);
    });
    const choices = attributeChoiceViews(self, squadBestLuk);
    const context = levelBuildContext(self);
    this.levelWinFocus = Math.max(
      0,
      choices.findIndex((choice) => choice.id === context.defaultAttribute),
    );
    const layout = this.buildLevelShell(self, "flex", choices.length, fullEntrance);
    this.levelWinAutoLabel = context.timeoutAllocation;
    choices.forEach((view, index) => {
      const slot = layout.cards[index];
      if (!slot) return;
      this.createLevelChoiceCard(view, slot, index, () =>
        this.room?.send("chooseAttribute", { attr: view.id }),
      );
    });
  }

  /** §21 Testing-Grounds Tab menu — the summonable roster (boss + dummy excluded; tough is a toggle). */
  private static readonly SUMMON_KINDS: { id: string; label: string }[] = [
    { id: "critter", label: "Critter (rusher)" },
    { id: "mote-swarm", label: "Mote (swarm)" },
    { id: "pricklepulp", label: "Pricklepulp (zoner)" },
    { id: "boothill", label: "Boothill (spitter)" },
    { id: "gatlin", label: "Gatlin (scatter)" },
    { id: "ronin", label: "Ronin (duelist)" },
    { id: "vault-ronin", label: "Vault-Ronin (leaper)" },
    { id: "dust-ranger", label: "Dust-Ranger (dodge)" },
  ];

  /** Tear down the summon overlay. */
  private closeSummonMenu(): void {
    for (const o of this.summonObjects) o.destroy();
    this.summonObjects = [];
    this.summonOpen = false;
  }

  /** Open (or rebuild) the dev summon menu. Enemies stay on one compact grid; bosses page eight at a time,
   *  so the final-size hit areas and labels remain disjoint at the 1280×720 support floor. */
  private openSummonMenu(): void {
    this.closeSummonMenu();
    this.summonOpen = true;
    const screenWidth = this.screenW();
    const screenHeight = this.screenH();
    const layout = summonMenuLayout(screenWidth, screenHeight);
    const cx = screenWidth / 2;
    const panelCx = layout.panel.x + layout.panel.width / 2;
    const panelCy = layout.panel.y + layout.panel.height / 2;
    const dim = this.add
      .rectangle(cx, screenHeight / 2, screenWidth, screenHeight, 0x05040a, 0.72)
      .setScrollFactor(0)
      .setDepth(100020)
      .setInteractive();
    const panel = this.add
      .rectangle(panelCx, panelCy, layout.panel.width, layout.panel.height, 0x100e0b, 0.98)
      .setScrollFactor(0)
      .setStrokeStyle(2, 0x33e6ff, 0.85)
      .setDepth(100021)
      .setInteractive();
    const title = this.add
      .text(cx, layout.titleY, "SUMMON — Testing Grounds", {
        fontSize: "24px",
        color: "#33e6ff",
        fontStyle: "bold",
      })
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(100021);
    const hint = this.add
      .text(cx, layout.hintY, "Click to summon · Tab / Esc to close", {
        fontSize: "13px",
        color: "#cfc8b6",
      })
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(100021);
    this.summonObjects.push(dim, panel, title, hint);

    // Multiplier row (×1 … ×DEBUG_SPAWN_MAX) + a Tough toggle. Both rebuild only after their full-size
    // pointer target fires, so the displayed and interactive geometry always agree.
    const mults = [1, 5, 10, DEBUG_SPAWN_MAX].filter((n, i, a) => a.indexOf(n) === i);
    const chipW = 54;
    const chipGap = 8;
    const controlsWidth = 34 + mults.length * chipW + (mults.length - 1) * chipGap + 18 + 104;
    const controlsLeft = cx - controlsWidth / 2;
    const mStartX = controlsLeft + 34 + chipW / 2;
    const my = layout.controlsY;
    const mLabel = this.add
      .text(controlsLeft, my, "COUNT", {
        fontSize: "11px",
        color: "#9a9486",
        fontStyle: "bold",
      })
      .setScrollFactor(0)
      .setOrigin(0, 0.5)
      .setDepth(100021);
    this.summonObjects.push(mLabel);
    mults.forEach((n, i) => {
      const x = mStartX + i * (chipW + chipGap);
      const on = this.summonCount === n;
      const chip = this.add
        .rectangle(x, my, chipW, 30, on ? 0x1f6b78 : 0x1b1812, 0.98)
        .setScrollFactor(0)
        .setStrokeStyle(2, on ? 0x33e6ff : 0x4a443a)
        .setDepth(100021)
        .setInteractive({ useHandCursor: true });
      const t = this.add
        .text(x, my, `${n}`, {
          fontSize: "16px",
          color: on ? "#bdf6ff" : "#cfc8b6",
          fontStyle: "bold",
        })
        .setScrollFactor(0)
        .setOrigin(0.5)
        .setDepth(100022);
      chip.on("pointerdown", () => {
        this.summonCount = n;
        this.openSummonMenu(); // rebuild to refresh the selected highlight
      });
      this.summonObjects.push(chip, t);
    });
    const tx = mStartX + (mults.length - 1) * (chipW + chipGap) + chipW / 2 + 18 + 52;
    const tough = this.add
      .rectangle(tx, my, 104, 30, this.summonTough ? 0x6b4a1f : 0x1b1812, 0.98)
      .setScrollFactor(0)
      .setStrokeStyle(2, this.summonTough ? 0xffb24a : 0x4a443a)
      .setDepth(100021)
      .setInteractive({ useHandCursor: true });
    const toughT = this.add
      .text(tx, my, this.summonTough ? "TOUGH ✓" : "tough", {
        fontSize: "14px",
        color: this.summonTough ? "#ffd9a8" : "#9a9486",
        fontStyle: "bold",
      })
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(100022);
    tough.on("pointerdown", () => {
      this.summonTough = !this.summonTough;
      this.openSummonMenu();
    });
    this.summonObjects.push(tough, toughT);

    const sectionX = layout.panel.x + 24;
    const enemyLabel = this.add
      .text(sectionX, layout.enemyLabelY, "ENEMIES — count and Tough apply", {
        fontSize: "12px",
        color: "#9eefff",
        fontStyle: "bold",
      })
      .setScrollFactor(0)
      .setOrigin(0, 0.5)
      .setDepth(100022);
    this.summonObjects.push(enemyLabel);

    // Eight enemies occupy exactly two rows. Character identities are deliberately absent: wardrobe gear
    // owns the boilerplate player rig; this dev surface is only for field actors.
    const kinds = ArenaScene.SUMMON_KINDS;
    const W = layout.buttonWidth;
    const H = layout.buttonHeight;
    const gap = layout.gap;
    const perRow = layout.columns;
    kinds.forEach((k, i) => {
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      const x = sectionX + W / 2 + col * (W + gap);
      const y = layout.enemyStartY + row * layout.rowGap;
      const btn = this.add
        .rectangle(x, y, W, H, 0x1b1812, 0.98)
        .setScrollFactor(0)
        .setStrokeStyle(2, 0x33e6ff)
        .setDepth(100021)
        .setInteractive({ useHandCursor: true });
      const t = this.add
        .text(x, y, k.label, {
          fontSize: "14px",
          color: "#e6f8ff",
          align: "center",
          wordWrap: { width: W - 16, useAdvancedWrap: true },
        })
        .setScrollFactor(0)
        .setOrigin(0.5)
        .setDepth(100022);
      btn.on("pointerover", () => btn.setFillStyle(0x26221a, 1));
      btn.on("pointerout", () => btn.setFillStyle(0x1b1812, 0.98));
      btn.on("pointerdown", () =>
        this.room?.send("debugSpawn", {
          kind: k.id,
          count: this.summonCount,
          tough: this.summonTough,
        }),
      );
      this.summonObjects.push(btn, t);
    });

    // §16 v0.109 BOSS PICKER — Old Rust plus every bespoke definition, paged so no row escapes the panel.
    const bossIds = ["old-rust", ...BOSS_DEF_IDS.filter((id) => id !== "old-rust")];
    const bossPages = Math.max(1, Math.ceil(bossIds.length / layout.bossPageSize));
    this.summonBossPage = ((this.summonBossPage % bossPages) + bossPages) % bossPages;
    const bossStart = this.summonBossPage * layout.bossPageSize;
    const shownBosses = bossIds.slice(bossStart, bossStart + layout.bossPageSize);
    const bossLabel = this.add
      .text(
        sectionX,
        layout.bossLabelY,
        `BOSSES — page ${this.summonBossPage + 1}/${bossPages} · replaces the live boss`,
        {
          fontSize: "12px",
          color: "#ffb24a",
          fontStyle: "bold",
        },
      )
      .setScrollFactor(0)
      .setOrigin(0, 0.5)
      .setDepth(100022);
    this.summonObjects.push(bossLabel);
    shownBosses.forEach((id, i) => {
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      const x = sectionX + W / 2 + col * (W + gap);
      const y = layout.bossStartY + row * layout.rowGap;
      const btn = this.add
        .rectangle(x, y, W, H, 0x241a10, 0.98)
        .setScrollFactor(0)
        .setStrokeStyle(2, 0xffb24a)
        .setDepth(100021)
        .setInteractive({ useHandCursor: true });
      const t = this.add
        .text(x, y, id === "old-rust" ? "Old Rust" : (BOSSES[id]?.name ?? id), {
          fontSize: "13px",
          color: "#ffe0b0",
          align: "center",
          wordWrap: { width: W - 16, useAdvancedWrap: true },
        })
        .setScrollFactor(0)
        .setOrigin(0.5)
        .setDepth(100022);
      btn.on("pointerover", () => btn.setFillStyle(0x352513, 1));
      btn.on("pointerout", () => btn.setFillStyle(0x241a10, 0.98));
      btn.on("pointerdown", () => this.room?.send("spawnBossDef", { kind: id }));
      this.summonObjects.push(btn, t);
    });

    if (bossPages > 1) {
      const makePager = (x: number, label: string, dir: number): void => {
        const btn = this.add
          .rectangle(x, layout.pagerY, 72, 32, 0x1b1812, 0.98)
          .setScrollFactor(0)
          .setStrokeStyle(2, 0xffb24a)
          .setDepth(100021)
          .setInteractive({ useHandCursor: true });
        const text = this.add
          .text(x, layout.pagerY, label, {
            fontSize: "14px",
            color: "#ffe0b0",
            fontStyle: "bold",
          })
          .setScrollFactor(0)
          .setOrigin(0.5)
          .setDepth(100022);
        btn.on("pointerdown", () => {
          this.summonBossPage += dir;
          this.openSummonMenu();
        });
        this.summonObjects.push(btn, text);
      };
      makePager(cx - 104, "‹ Prev", -1);
      makePager(cx + 104, "Next ›", 1);
      const pageText = this.add
        .text(cx, layout.pagerY, `${this.summonBossPage + 1} / ${bossPages}`, {
          fontSize: "13px",
          color: "#cfc8b6",
          fontStyle: "bold",
        })
        .setScrollFactor(0)
        .setOrigin(0.5)
        .setDepth(100022);
      this.summonObjects.push(pageText);
    }

    const footer = this.add
      .text(
        cx,
        layout.footerY,
        "Player identities are wardrobe-only · boilerplate rig · enemy and boss summons only",
        { fontSize: "11px", color: "#7f796d", align: "center" },
      )
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(100022);
    this.summonObjects.push(footer);
  }

  /**
   * Reconcile rendered blobs against authoritative state every frame: create a blob for
   * any player that lacks one, destroy any blob whose player has left. Race-proof — does
   * not depend on onAdd/onRemove firing at the right moment on a cold connect.
   */
  private syncBlobs(): void {
    if (!this.room) return;
    const players = this.room.state.players;
    players.forEach((player, id) => {
      if (!this.blobs.has(id)) this.addBlob(player, id);
      else {
        const rig = this.blobs.get(id);
        const previousCharacter = this.charOf.get(id);
        const isWholeArtCharacter = isWholeArtCharacterId(player.character);
        const wasWholeArtCharacter = isWholeArtCharacterId(previousCharacter);
        const characterChanged = previousCharacter !== player.character;
        // Crossing either side of the whole-art boundary changes the retained skeleton's texture contract.
        // Rebuild before any wardrobe call so a character-owned rig can never be retargeted to gear-bake.
        if (characterChanged && (isWholeArtCharacter || wasWholeArtCharacter)) {
          this.removeBlob(id);
          this.addBlob(player, id);
          return;
        }
        // Whole-art rigs never enter the boilerplate/gear-bake pipeline, including on later sync frames.
        if (isWholeArtCharacter) return;
        // Reflection law (see addBlob): only the nested dualWield row exists on decoded client rows.
        const gearSynced =
          !!rig &&
          !!GEAR_PARTS_MANIFEST &&
          rig.equipSyncedGear(
            player.dualWield?.gearUpper ?? "",
            player.dualWield?.gearLower ?? "",
            GEAR_PARTS_MANIFEST,
            id === this.room?.sessionId
              ? this.petMetaAccount.prestige
              : (player.dualWield?.prestige ?? 0),
          );
        // Compatibility rooms without the gear tail still render their selected legacy manifest.
        if (!gearSynced && characterChanged) {
          this.removeBlob(id);
          this.addBlob(player, id);
        }
      }
    });
    for (const id of this.blobs.keys()) {
      if (!players.has(id)) this.removeBlob(id);
    }
  }

  /** Reconcile every public pet descriptor beside, but never inside, the schema entity collections. */
  private syncPetRigs(): void {
    if (!this.room || !this.petManifest) return;
    let partySlot = 0;
    this.room.state.players.forEach((player, id) => {
      const rawBand = player.petLevelBand;
      const validBand = rawBand === 1 || rawBand === 2 || rawBand === 3;
      if (!isPetId(player.petId) || !validBand) {
        this.petRigs.get(id)?.destroy();
        this.petRigs.delete(id);
        this.petOwnerHp.delete(id);
        partySlot++;
        return;
      }
      const band = rawBand as PetStageBand;
      let rig = this.petRigs.get(id);
      if (!rig) {
        rig = new PetRig(
          this,
          this.petManifest!,
          id,
          player.petId,
          band,
          id === this.room?.sessionId,
          partySlot,
        );
        rig.setProjection(this.belt ? BELT_Y0 : 0, this.belt ? BELT_FORESHORTEN : 1);
        this.petRigs.set(id, rig);
      } else {
        rig.setDescriptor(player.petId, band);
      }
      partySlot++;
    });
    for (const [id, rig] of this.petRigs) {
      if (this.room.state.players.has(id)) continue;
      rig.destroy();
      this.petRigs.delete(id);
      this.petOwnerHp.delete(id);
    }
  }

  private interpolate(deltaMs: number): void {
    if (!this.room) return;
    // §4 v0.107: SELF renders the PREDICTOR (instant response — no lerp, no round-trip); REMOTES render
    // their snapshot rings at the delayed server-tick timeline (faithful motion under jitter — no
    // τ-trailing, no rubber-banding). Teleport cuts live inside both paths (predictor hard-resync on
    // teleportSeq / ring gap-snap + fellSeq reset). Fallback = raw state (pre-timeline first frames).
    const selfId = this.room.sessionId;
    const rt = this.timeline.ready ? this.timeline.renderTime(this.time.now) : -1;
    this.room.state.players.forEach((player, id) => {
      const blob = this.blobs.get(id);
      if (!blob) return;
      if (id === selfId && this.predictor) {
        this.predictor.decayError(deltaMs / 1000, this.curDx, this.curDy);
        const r = this.predictor.renderPos(this.curDx, this.curDy, this.inputAccMs / 1000);
        const weapon = WEAPONS[player.weapon];
        const presentationOnlyGunRecoil =
          !!weapon?.gun && gunLocomotionRecoilFor(weapon).impulse <= 0;
        const candidate = presentationOnlyGunRecoil
          ? this.predictor.boundLocomotionPresentation(player.x, player.y, r.x, r.y)
          : r;
        this.selfPredictionCandidateX = candidate.x;
        this.selfPredictionCandidateY = candidate.y;
        const presented = this.predictor.constrainRenderStep(
          blob.x,
          blob.y,
          candidate.x,
          candidate.y,
          this.curDx,
          this.curDy,
          r.stance === STANCE_NONE && !presentationOnlyGunRecoil,
        );
        blob.setPosition(presented.x, presented.y);
        this.selfPredHeight = r.height;
        this.selfPredVh = r.vh;
        this.selfPredStance = r.stance;
        this.selfPredSlidePhase = r.slidePhase;
        this.selfPredSlideTick = r.slideTick;
        return;
      }
      const s =
        rt >= 0
          ? this.playerBufs.get(id)?.sampleInto(rt, INTERP_SNAP_PLAYER, this.playerSample)
          : null;
      if (s) blob.setPosition(s.x, s.y);
      else blob.setPosition(player.x, player.y);
    });
  }

  /** Keep the camera locked on the local player every frame (robust vs startFollow drift). */
  /** §29 belt DEPTH projection: world y → foreshortened screen-plane y (world units). Pure. */
  private beltY(worldY: number): number {
    return BELT_Y0 + (worldY - BELT_Y0) * BELT_FORESHORTEN;
  }

  /** §36 per-level belt palette (sky bg + vector-deck fill), keyed by the level's dimension so the four
   *  levels read distinct without per-level art. Sky Carrier keeps its Codex backdrop on top of this. */
  private beltTheme(): { sky: number; deck: number } {
    const dim = (this.beltLevel ?? beltLevelFor(this.selectedBeltLevel)).dimensionId;
    const map: Record<string, { sky: number; deck: number }> = {
      "wild-west": { sky: 0x79bce9, deck: 0x454c56 },
      frostfell: { sky: 0x9fc4e0, deck: 0x4a5560 },
      "verdant-ruins": { sky: 0x2f4a34, deck: 0x3f4a3a },
      ashlands: { sky: 0x3a2622, deck: 0x4a3a32 },
      "neon-cyber": { sky: 0x141220, deck: 0x2a2f3c },
    };
    return map[dim] ?? map["wild-west"]!;
  }

  /** §29 draw the belt DECK from the authored floor PROFILE — the walkable shape follows the exact
   *  near/far collision edges (WYSIWYG: the railing you see is the edge you can't cross). Plus obstacles as
   *  depth-sorted props + a sky. Everything world-space so it scrolls with the belt; depth below the actors. */
  /** §29 build the horizontally-tileable, transparent cloud strip used by the parallax band. Soft white
   *  radial puffs on a clear canvas, wrapped across the seam so tilePositionX scrolls seamlessly, and faded
   *  to nothing at the bottom so the band melts into the painted sky rather than ending on a hard line. */
  private ensureCloudTexture(): void {
    if (this.textures.exists("belt-clouds")) return;
    const W = 1024;
    const H = 256;
    const canvas = this.textures.createCanvas("belt-clouds", W, H);
    if (!canvas) return;
    const ctx = canvas.getContext();
    ctx.clearRect(0, 0, W, H);
    const puff = (cx: number, cy: number, r: number, a: number) => {
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grd.addColorStop(0, `rgba(255,255,255,${a})`);
      grd.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    };
    // A dozen clumps, each a few overlapping puffs. Draw any clump near an edge a second time wrapped by ±W
    // so the strip is seamless when tiled. Weighted toward the top so the bottom stays clear.
    for (let i = 0; i < 12; i++) {
      const bx = Math.random() * W;
      const by = 20 + Math.random() * (H * 0.5);
      const base = 34 + Math.random() * 40;
      for (let j = 0; j < 5; j++) {
        const dx = (Math.random() - 0.5) * base * 2;
        const dy = (Math.random() - 0.5) * base;
        const r = base * (0.5 + Math.random() * 0.6);
        for (const off of [0, -W, W]) puff(bx + dx + off, by + dy, r, 0.16);
      }
    }
    // Vertical fade-out toward the bottom (multiply alpha) so the band dissolves into the sky.
    ctx.globalCompositeOperation = "destination-out";
    const fade = ctx.createLinearGradient(0, 0, 0, H);
    fade.addColorStop(0, "rgba(0,0,0,0)");
    fade.addColorStop(0.6, "rgba(0,0,0,0)");
    fade.addColorStop(1, "rgba(0,0,0,1)");
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "source-over";
    canvas.refresh();
  }

  private buildBeltFloor(): void {
    const theme = this.beltTheme();
    this.cameras.main.setBackgroundColor(theme.sky); // §36 dimension-themed sky (behind any backdrop)
    // §29/§36/§37 Codex backdrops: sky-carrier keeps its per-room sky set + drifting clouds; every other
    // level now gets its OWN Codex vista (belt/bg-<levelId>.png, gen-belt-backdrops.mjs), with the palette
    // sky as the fallback if the art didn't load.
    const skyCarrier = this.selectedBeltLevel === "sky-carrier";
    if (skyCarrier && this.textures.exists("belt-sky")) {
      this.beltBackdrop = this.add.image(0, 0, "belt-sky").setOrigin(0, 0).setDepth(-200);
      this.floorObjs.push(this.beltBackdrop);
      // §29 parallax cloud band drifting across the upper sky (procedural, transparent → no art dependency).
      this.ensureCloudTexture();
      this.beltClouds = this.add
        .tileSprite(0, 0, 1, 1, "belt-clouds")
        .setOrigin(0, 0)
        .setDepth(-190)
        .setAlpha(0.32);
      this.floorObjs.push(this.beltClouds);
    } else if (!skyCarrier && this.textures.exists(`belt-bg:${this.selectedBeltLevel}`)) {
      this.beltBackdrop = this.add
        .image(0, 0, `belt-bg:${this.selectedBeltLevel}`)
        .setOrigin(0, 0)
        .setDepth(-200);
      this.floorObjs.push(this.beltBackdrop);
    }
    const level = this.beltLevel ?? beltLevelFor(this.selectedBeltLevel);
    const w = level.length;
    // Sample the near/far edges across the belt and build the deck polygon in projected (screen-plane) space.
    const step = 48;
    const far: { x: number; y: number }[] = []; // back edge (yMin)
    const near: { x: number; y: number }[] = []; // front edge (yMax)
    for (let x = 0; x <= w; x += step) {
      const b = beltBounds(level, x);
      far.push({ x, y: this.beltY(BELT_Y0 + b.yMin) });
      near.push({ x, y: this.beltY(BELT_Y0 + b.yMax) });
    }
    // Deck polygon (far edge L→R, then near edge R→L) — used BOTH as the plain fill and as the texture mask.
    const deckPoly = (gg: Phaser.GameObjects.Graphics) => {
      gg.beginPath();
      gg.moveTo(far[0]!.x, far[0]!.y);
      for (const p of far) gg.lineTo(p.x, p.y);
      for (let i = near.length - 1; i >= 0; i--) gg.lineTo(near[i]!.x, near[i]!.y);
      gg.closePath();
    };
    // §36 the deck is "the ground" — it must sit BELOW ground-level VFX (quake eruptions depth 4-8, splats,
    // zones) and entities (depth = projected worldY, ~2000+), exactly like the top-down floor (groundBed -20).
    // At the old +60 it occluded every low-depth ground VFX in belt (they render "under the map"). Above the
    // sky backdrop (-200) / clouds (-190), below everything on the deck.
    const g = this.add.graphics().setDepth(-20);
    // dark hull/void below the whole thing
    g.fillStyle(0x22262c, 1).fillRect(0, this.beltY(BELT_Y0 + DEPTH_MAX) - 40, w, 3000);
    // Walkable deck BASE fill — a crisp, collision-accurate trapezoid following the exact floor profile.
    // Stays under the plating bake as the fallback (and covers any hairline the clip might miss).
    g.fillStyle(theme.deck, 1); // §36 dimension-themed deck fill
    deckPoly(g);
    g.fillPath();
    this.floorObjs.push(g);
    // §37 CODEX PLATING: paint the level's authored deck texture INSIDE the trapezoid via a one-time canvas
    // bake (canvas 2D clip + repeating pattern), sidestepping the old Phaser-4 GeometryMask2-on-TileSprite
    // blocker entirely. Sky-carrier uses its original deck.png; themed levels their deck-<id>.png strips.
    const deckKey = skyCarrier ? "belt-deck" : `belt-deck:${this.selectedBeltLevel}`;
    // §37 the canvas bake uploads big textures — on a low-VRAM GPU that can throw. NEVER let it abort the
    // floor build (that blacked out themed levels); on any failure fall back to the procedural vector deck.
    let plated = false;
    try {
      plated = this.textures.exists(deckKey) && this.bakeDeckPlating(deckKey, far, near, w);
    } catch (e) {
      console.warn("[belt] deck plating bake failed — using the vector deck", e);
      plated = false;
    }
    // Gameplay markings + telegraphs live ABOVE the plating (its own layer at -18).
    const gl = this.add.graphics().setDepth(-18);
    // centreline marking (mid-depth) + railings on both edges (the collision boundary, drawn)
    gl.lineStyle(6, 0xffd24a, 0.55).beginPath();
    for (let i = 0; i < far.length; i++) {
      gl.lineTo(far[i]!.x, (far[i]!.y + near[i]!.y) / 2);
    }
    gl.strokePath();
    gl.lineStyle(5, 0x2f3742, 1).beginPath(); // far railing
    gl.moveTo(far[0]!.x, far[0]!.y);
    for (const p of far) gl.lineTo(p.x, p.y);
    gl.strokePath();
    gl.lineStyle(6, 0xffd24a, 0.9).beginPath(); // near safety lip
    gl.moveTo(near[0]!.x, near[0]!.y);
    for (const p of near) gl.lineTo(p.x, p.y);
    gl.strokePath();
    if (!plated) {
      // §31 PROCEDURAL plating detail — only when no authored texture landed (the pre-§37 look): panel seams
      // following the perspective + transverse plate joints at a regular pitch.
      const deckYAt = (i: number, f: number) => far[i]!.y + (near[i]!.y - far[i]!.y) * f;
      gl.lineStyle(2, 0x363c45, 0.55); // subtle darker seam
      for (const f of [0.22, 0.44, 0.66, 0.86]) {
        gl.beginPath();
        gl.moveTo(far[0]!.x, deckYAt(0, f));
        for (let i = 1; i < far.length; i++) gl.lineTo(far[i]!.x, deckYAt(i, f));
        gl.strokePath();
      }
      for (let i = 0; i < far.length; i += 3) {
        // a transverse plate joint every ~144px of belt, from just inside the far rail to the near lip
        gl.lineStyle(1.5, 0x363c45, 0.4);
        gl.beginPath();
        gl.moveTo(far[i]!.x, deckYAt(i, 0.08));
        gl.lineTo(near[i]!.x, deckYAt(i, 0.94));
        gl.strokePath();
      }
    }
    // §29 PIT GAPS — cut the void into the deck at each authored pit x-range (WYSIWYG: the hole you see is
    // the gap you fall through), edged with hazard stripes. Drawn over the plating so the hole punches through.
    for (const pit of level.pits) {
      const b = beltBounds(level, (pit.x0 + pit.x1) / 2);
      const top = this.beltY(BELT_Y0 + b.yMin);
      const bot = this.beltY(BELT_Y0 + b.yMax);
      gl.fillStyle(0x0c1017, 1).fillRect(pit.x0, top - 4, pit.x1 - pit.x0, bot - top + 12); // void
      gl.fillStyle(0x161b22, 1).fillRect(pit.x0, bot - 6, pit.x1 - pit.x0, 10); // far inner shading
      gl.lineStyle(5, 0xffb02e, 0.9); // hazard-stripe edges
      gl.beginPath();
      gl.moveTo(pit.x0, top);
      gl.lineTo(pit.x0, bot);
      gl.moveTo(pit.x1, top);
      gl.lineTo(pit.x1, bot);
      gl.strokePath();
    }
    this.floorObjs.push(gl);
  }

  /** §37 one-time CANVAS BAKE of the level's Codex deck texture, clipped to the deck trapezoid: per ≤2048px
   *  chunk, clip the polygon path on a 2D canvas, fill with the texture as a world-anchored repeating
   *  pattern, and add it as an image at plating depth (-19, between the base fill and the markings). Canvas
   *  clip+pattern replaces the unavailable GeometryMask2-on-TileSprite. Returns false if the bake can't run
   *  (no 2D context / bad texture) so the caller keeps the procedural seams. */
  private bakeDeckPlating(
    key: string,
    far: { x: number; y: number }[],
    near: { x: number; y: number }[],
    w: number,
  ): boolean {
    const src = this.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const sw = src.width;
    const sh = src.height;
    if (!sw || !sh) return false;
    const step = 48; // must match the far/near sample stride above
    const CHUNK = 2048; // stay under conservative GPU texture limits
    // Anchor the pattern's vertical phase to ONE fixed projected y so all chunks align seamlessly.
    const anchorY = Math.floor(this.beltY(BELT_Y0));
    for (let cx = 0; cx < w; cx += CHUNK) {
      const cw = Math.min(CHUNK, w - cx);
      const i0 = Math.max(0, Math.floor(cx / step) - 1);
      const i1 = Math.min(far.length - 1, Math.ceil((cx + cw) / step) + 1);
      let top = Number.POSITIVE_INFINITY;
      let bot = Number.NEGATIVE_INFINITY;
      for (let i = i0; i <= i1; i++) {
        top = Math.min(top, far[i]!.y);
        bot = Math.max(bot, near[i]!.y);
      }
      top = Math.floor(top) - 2;
      bot = Math.ceil(bot) + 2;
      const canvas = document.createElement("canvas");
      canvas.width = cw;
      canvas.height = bot - top;
      const ctx = canvas.getContext("2d");
      if (!ctx) return false;
      ctx.beginPath();
      ctx.moveTo(far[i0]!.x - cx, far[i0]!.y - top);
      for (let i = i0; i <= i1; i++) ctx.lineTo(far[i]!.x - cx, far[i]!.y - top);
      for (let i = i1; i >= i0; i--) ctx.lineTo(near[i]!.x - cx, near[i]!.y - top);
      ctx.closePath();
      ctx.clip();
      const pat = ctx.createPattern(src, "repeat");
      if (!pat) return false;
      // Shift so pattern space aligns with WORLD space (x) + the fixed anchor (y) — chunk borders then match.
      const dx = ((cx % sw) + sw) % sw;
      const dy = (((top - anchorY) % sh) + sh) % sh;
      ctx.translate(-dx, -dy);
      ctx.fillStyle = pat;
      ctx.fillRect(0, 0, cw + sw, bot - top + sh);
      const texKey = `deckbake:${this.selectedBeltLevel}:${cx}`;
      if (this.textures.exists(texKey)) this.textures.remove(texKey); // scene restarts re-bake cleanly
      this.textures.addCanvas(texKey, canvas);
      this.floorObjs.push(this.add.image(cx, top, texKey).setOrigin(0, 0).setDepth(-19));
    }
    return true;
  }

  /** §29 belt render post-pass — after all positioning (which sets ABSOLUTE world coords each frame), remap
   *  every floor object's Y onto the belt band and DEPTH-SORT by world y (nearer = larger y = in front). Purely
   *  visual + recomputed each frame, so it can't corrupt the interpolation's world-space velocity tracking. */
  private projectBelt(): void {
    if (!this.belt) return;
    // LIVE actors (rigs/enemies) re-establish their WORLD y every frame in interpolate()/animateBlobs() just
    // before us, so their current .y IS the world y — project it directly.
    const projectLive = (o: { x: number; y: number; setPosition(x: number, y: number): void }) => {
      const wy = o.y;
      o.setPosition(o.x, this.beltY(wy));
    };
    // TRACKED containers (projectiles move via data; pickups/zones are static) are NOT repositioned to a fresh
    // world y every frame — so if we projected off their .y we'd re-project our OWN output next frame and the
    // value would compound (drift toward BELT_Y0). Keep the world y in data and only adopt a NEW .y when the
    // owner actually moved the object (o.y changed since our last projection).
    const projectTracked = (c: Phaser.GameObjects.Container) => {
      const lastScreen = c.getData("beltScreenY") as number | undefined;
      const wy =
        lastScreen !== undefined && c.y === lastScreen ? (c.getData("beltWorldY") as number) : c.y;
      const sy = this.beltY(wy);
      c.setData("beltWorldY", wy);
      c.setData("beltScreenY", sy);
      c.setPosition(c.x, sy);
      const depth = Math.round(wy);
      if (c.getData("beltDepth") !== depth) {
        c.setData("beltDepth", depth);
        c.setDepth(depth);
      }
    };
    this.blobs.forEach((rig) => {
      projectLive(rig);
    });
    this.enemies.forEach((rig) => {
      projectLive(rig);
    }); // includes the boss rig
    this.projectiles.forEach((c) => {
      projectTracked(c);
    });
    this.pickups.forEach((c) => {
      projectTracked(c);
    });
    this.zones.forEach((c) => {
      projectTracked(c);
    });
  }

  /** §29 belt camera: scroll horizontally to follow the player (world x), lock the vertical to the deck, and
   *  fit BELT_VIEW_H world-height to the screen. The player's world x is `rig.x` (only Y is projected). */
  private beltCamera(): void {
    const id = this.room?.sessionId;
    if (!id) return;
    const self = this.blobs.get(id);
    if (!self) return;
    const cam = this.cameras.main;
    const zoom = cam.height / BELT_VIEW_H;
    if (Math.abs(cam.zoom - zoom) > 1e-4) cam.setZoom(zoom); // only on resize, not every frame
    const viewW = cam.width / zoom;
    // §29 a closed room gate (beltLockX>0) caps the camera's right reach so the barrier sits at the edge.
    const lock = this.room?.state.beltLockX ?? 0;
    const rightLimit = lock > 0 ? lock : (this.beltLevel?.length ?? ARENA_WIDTH);
    const maxX = Math.max(0, rightLimit - viewW);
    const wantX = Math.min(maxX, Math.max(0, self.x - viewW * 0.42));
    if (!this.camFocus) this.camFocus = { x: wantX, y: 0 };
    const a = 1 - Math.exp(-this.deltaSec / CAM_FOLLOW_TAU);
    this.camFocus.x += (wantX - this.camFocus.x) * a;
    cam.setScroll(this.camFocus.x, BELT_Y0 - BELT_SKY);
    // Fill the viewport with the sky-carrier backdrop (world-space, repositioned to the scroll each frame).
    this.beltBackdrop
      ?.setPosition(this.camFocus.x, BELT_Y0 - BELT_SKY)
      .setDisplaySize(viewW, BELT_VIEW_H);
    // §29 cloud band fills the upper ~48% of the sky; scrolls at 0.35× camera (distant parallax) plus a slow
    // self-drift, so clouds keep passing even when the player is standing still.
    if (this.beltClouds) {
      const bandH = BELT_VIEW_H * 0.48;
      this.beltCloudDrift += this.deltaSec * 9;
      this.beltClouds.setPosition(this.camFocus.x, BELT_Y0 - BELT_SKY).setSize(viewW, bandH);
      this.beltClouds.tilePositionX = this.camFocus.x * 0.35 + this.beltCloudDrift;
    }
    this.drawBeltGate(lock);
    // §29 room banner on entering a new room + swap to the storm BRIDGE backdrop for the boss room.
    const roomName = this.room?.state.beltRoomName ?? "";
    if (roomName && roomName !== this.lastBeltRoom) this.flashBanner(`▶ ${roomName}`, "#ffd24a");
    this.lastBeltRoom = roomName;
    if (this.beltBackdrop && this.selectedBeltLevel === "sky-carrier") {
      // §31 each SKY-CARRIER room gets its own Codex backdrop (Flight Deck → Catwalk → Arena Mouth → the
      // storm Bridge). §37: gated to sky-carrier — the room names would never match on a themed level and the
      // fallback would stomp its bg-<level> vista with the sky-carrier sky.
      const key =
        roomName === "The Bridge"
          ? "belt-sky-bridge"
          : roomName === "The Catwalk"
            ? "belt-sky-catwalk"
            : roomName === "Arena Mouth"
              ? "belt-sky-arena-mouth"
              : "belt-sky";
      if (this.beltBackdrop.texture.key !== key && this.textures.exists(key))
        this.beltBackdrop.setTexture(key);
    }
  }

  /** §29 draw the room GATE barrier at the locked x (a shimmering bulkhead across the deck) — hidden when
   *  the gate is open (lock 0). A synced-state read, so all clients see the same lock. */
  private drawBeltGate(lockX: number): void {
    if (!this.beltGate) this.beltGate = this.add.graphics().setDepth(BELT_Y0 + DEPTH_MAX + 50);
    const g = this.beltGate;
    g.clear();
    if (lockX <= 0 || !this.beltLevel) return;
    const b = beltBounds(this.beltLevel, lockX);
    const top = this.beltY(BELT_Y0 + b.yMin) - 40;
    const bot = this.beltY(BELT_Y0 + b.yMax) + 8;
    g.fillStyle(0xff5a2e, 0.16).fillRect(lockX - 10, top, 20, bot - top);
    g.lineStyle(4, 0xffb02e, 0.9);
    for (let y = top; y < bot; y += 26) g.strokeRect(lockX - 5, y, 10, 16);
  }

  private followSelf(): void {
    const id = this.room?.sessionId;
    if (!id) return;
    if (this.belt) {
      this.beltCamera();
      return;
    }
    // §6 spectate-follow: while DOWNED, the camera trails a living squadmate (you watch the squad until a
    // teammate with a rez weapon revives you). §7 v0.105 de-clunk: pick the NEAREST living teammate (not
    // whoever happens to be first in map order) and, on a target SWITCH, glide from the current view to the
    // new focus over ~0.32s instead of hard-cutting across the map.
    const me = this.room?.state.players.get(id);
    if (me && !me.alive) {
      let bx = 0;
      let by = 0;
      let bestD = Number.POSITIVE_INFINITY;
      let bestId = "";
      this.room?.state.players.forEach((p, pid) => {
        if (!p.alive || pid === id) return;
        const rig = this.blobs.get(pid);
        if (!rig) return;
        const d = (rig.x - me.x) ** 2 + (rig.y - me.y) ** 2;
        if (d < bestD) {
          bestD = d;
          bx = rig.x;
          by = rig.y;
          bestId = pid;
        }
      });
      if (bestId) {
        if (bestId !== this.spectateId) {
          const cam = this.cameras.main;
          // start the glide from wherever the camera currently looks (its world-centre)
          this.camFrom = {
            x: cam.scrollX + cam.width / cam.zoom / 2,
            y: cam.scrollY + cam.height / cam.zoom / 2,
          };
          this.camBlend = 0;
          this.spectateId = bestId;
        }
        this.camBlend = Math.min(1, this.camBlend + this.deltaSec / 0.32);
        const e = this.camBlend * (2 - this.camBlend); // easeOutQuad — snappy start, soft arrival
        const fx = Phaser.Math.Linear(this.camFrom.x, bx, e);
        const fy = Phaser.Math.Linear(this.camFrom.y, by, e);
        this.camFocus = { x: fx, y: fy }; // keep in sync so the eased follow resumes cleanly on revive
        this.centerCam(fx, fy);
        return;
      }
    }
    this.spectateId = "";
    this.camBlend = 1;
    const self = this.blobs.get(id);
    if (!self) return;
    // §7 v0.117 EASED follow (was a hard per-frame lock): the focus glides toward the player with a
    // frame-rate-independent exponential smoothing so the camera reads as a real camera, not a rail. NO
    // look-ahead — it just gracefully trails the character (playtest: don't lead toward the aim/move dir).
    // A teleport-sized jump snaps (no map-wide fly-by).
    const tx = self.x;
    const ty = self.y;
    if (!this.camFocus) this.camFocus = { x: tx, y: ty };
    const dx = tx - this.camFocus.x;
    const dy = ty - this.camFocus.y;
    if (dx * dx + dy * dy > CAM_SNAP_DIST * CAM_SNAP_DIST) {
      this.camFocus.x = tx;
      this.camFocus.y = ty;
    } else {
      const a = 1 - Math.exp(-this.deltaSec / CAM_FOLLOW_TAU);
      this.camFocus.x += dx * a;
      this.camFocus.y += dy * a;
    }
    this.centerCam(this.camFocus.x + this.cameraPunchX, this.camFocus.y + this.cameraPunchY);
  }

  /** Center the camera on (x,y) — ZOOM-AWARE + arena-clamped. Phaser's `centerOn` divides by the
   *  viewport not the zoom, so under the §28 hi-DPI camera zoom it offsets the player by a fraction of
   *  the screen; we scroll by the visible WORLD half-extent (`width / zoom / 2`) instead. */
  private centerCam(x: number, y: number): void {
    const cam = this.cameras.main;
    const viewW = cam.width / cam.zoom;
    const viewH = cam.height / cam.zoom;
    // Follow + arena-clamp, but on a viewport LARGER than the arena (4K / ultrawide) the clamp would pin
    // the arena to a corner — instead CENTRE it (a negative scroll), so the playfield sits middle-screen
    // and the painted ground margin fills the surround.
    const axis = (target: number, view: number, world: number): number =>
      view >= world ? (world - view) / 2 : Math.max(0, Math.min(world - view, target));
    cam.setScroll(
      axis(x - viewW / 2, viewW, ARENA_WIDTH),
      axis(y - viewH / 2, viewH, ARENA_HEIGHT),
    );
  }

  /** Drive each character's procedural animation from its render-velocity + the cursor aim. */
  private animateBlobs(deltaMs: number): void {
    const selfId = this.room?.sessionId;
    const cam = this.cameras.main;
    const pointer = this.input.activePointer;
    const remoteUltimateTick = Math.max(
      0,
      Math.floor(
        (this.timeline.ready
          ? this.timeline.renderTime(this.time.now)
          : (this.room?.state.tick ?? 0) * TICK_MS - INTERP_DELAY_MS) / TICK_MS,
      ),
    );
    const invDt = deltaMs > 0 ? 1000 / deltaMs : 0; // px/frame → px/s for the §5 gait blend
    const reducedMotion = prefersReducedPaperMotion();

    let aimX = 0;
    let aimY = 0;
    let aimDxPx = 0; // §37 raw horizontal cursor offset from the character (drives the facing flip)
    const self = selfId ? this.blobs.get(selfId) : undefined;
    if (self) {
      const px = this.pointerScreen.set ? this.pointerScreen.x : pointer.x;
      const py = this.pointerScreen.set ? this.pointerScreen.y : pointer.y;
      let ax: number;
      let ay: number;
      if (this.belt) {
        // §34 AIM FIX: this runs in animateBlobs, BEFORE projectBelt — so `self.y` is the WORLD depth
        // (interpolate set it) while the cursor `wp.y` is in the PROJECTED screen plane (where the deck is
        // drawn). `selfAim` is the on-SCREEN aim (points the rig + all VFX straight at the cursor), so
        // project self.y to compare like-for-like. The un-project to true sim-direction happens once, at
        // SEND time (stepNetInput), so the server's projectile/melee direction still flows to the cursor.
        // (The old code mixed a projected cursor with a world self and /FORESHORTEN'd it — every aim slewed
        // steeply up/down.) Facing still flips over the CHARACTER, not the screen midpoint.
        const wp = cam.getWorldPoint(px, py);
        ax = wp.x - self.x;
        ay = wp.y - this.beltY(self.y);
      } else {
        // §39 TOP-DOWN aim through getWorldPoint too: `px + scrollX` was only correct while the pointer was
        // CSS px and the RENDER_DPR camera zoom cancelled it — the §37 DPR listener fix (pointer now in
        // internal px) made the shortcut off by the DPR factor on scaled displays, so the facing flip line sat
        // far from the character and cursor aim skewed. getWorldPoint handles zoom/scroll/origin exactly.
        const wp = cam.getWorldPoint(px, py);
        ax = wp.x - self.x;
        ay = wp.y - self.y;
      }
      aimDxPx = ax; // raw px — the facing flip commits on the sign of THIS, at the character's midpoint
      const len = Math.hypot(ax, ay);
      if (len > 0.001) {
        aimX = ax / len;
        aimY = ay / len;
        this.selfAim.x = aimX; // remembered for the attack message
        this.selfAim.y = aimY;
      }
    }

    for (const [id, blob] of this.blobs) {
      let mx = blob.x - blob.renderPrevX;
      let my = blob.y - blob.renderPrevY;
      const speed = Math.hypot(mx, my) * invDt; // §7 v0.105 raw render speed (px/s) for the gait blend
      const ml = Math.hypot(mx, my);
      if (ml > 0.001) {
        mx /= ml;
        my /= ml;
      } else {
        mx = 0;
        my = 0;
      }
      blob.renderPrevX = blob.x;
      blob.renderPrevY = blob.y;

      // §5/§20 (Stage B): lift the rig by the HEIGHT arc. §4 v0.107: SELF rides the PREDICTED arc (the
      // hop starts the frame you press SPACE — no round-trip); remotes ride the synced height (smoothed
      // by the v0.105 hop lerp in the rig).
      const pl = this.room?.state.players.get(id);
      const isSelfPred = id === selfId && this.predictor !== null;
      const jumpHeight = isSelfPred ? this.selfPredHeight : (pl?.height ?? 0);
      const jumpVh = isSelfPred ? this.selfPredVh : (pl?.vh ?? 0);
      const moveStance = isSelfPred
        ? this.selfPredStance
        : ((pl?.moveStance ?? STANCE_NONE) as MoveStance);
      const slidePhase = isSelfPred
        ? this.selfPredSlidePhase
        : ((pl?.slidePhase ?? SLIDE_PHASE_OFF) as SlidePhase);
      const slideTick = isSelfPred ? this.selfPredSlideTick : (pl?.slidePhaseTick ?? 0);
      const juggledSeq = pl?.juggledSeq ?? 0;
      let juggle = this.jugglePresentation.get(id);
      if (!juggle) {
        juggle = { seq: juggledSeq, lastAtMs: -1e9 };
        this.jugglePresentation.set(id, juggle);
      } else if (juggledSeq !== juggle.seq) {
        const airKeep = this.time.now - juggle.lastAtMs <= 2_100;
        juggle.seq = juggledSeq;
        juggle.lastAtMs = this.time.now;
        blob.triggerJuggled(this.animClock);
        const projectedY = this.belt ? this.beltY(blob.y) : blob.y;
        const visible = id === selfId || this.cameras.main.worldView.contains(blob.x, blob.y);
        if (visible)
          this.jumpEffectRenderer.spawnAirKeepHit(
            blob.x,
            projectedY + PLAYER_SHADOW_LOCAL_Y,
            reducedMotion,
            this.belt ? BELT_FORESHORTEN : 1,
          );
        if (airKeep)
          this.audio.play("enemy-combo:airkeep-hit", {
            x: blob.x,
            amt: id === selfId ? 0.85 : visible ? 0.42 : 0.2,
          });
        if (id === selfId) {
          this.jugglePulseUntil = this.time.now + 420;
          this.offerContextHint("juggle");
        }
      }
      blob.setHop(jumpHeight);
      this.presentJumpFeel(
        id,
        blob,
        jumpHeight,
        jumpVh,
        moveStance,
        slidePhase,
        slideTick,
        pl?.poundSeq ?? 0,
        mx,
        my,
        speed,
        id === selfId,
        reducedMotion,
      );

      // §6 DOWNED look + revive pop. A downed body greys out + fades; a rez (revivedSeq tick) pops it green.
      const alive = pl?.alive ?? true;
      blob.setDowned(!alive);
      const rs = pl?.revivedSeq ?? 0;
      if (this.lastRevived.get(id) !== rs) {
        if (this.lastRevived.has(id) && alive) {
          blob.flash(170, 0x9cff3b);
          this.audio.play("revive", { x: blob.x }); // §19 a warm rising 2-note chord = life
          if (id === selfId) {
            this.resetDeathRecap();
            this.lastDamageReceiptKey = "";
          }
        }
        this.lastRevived.set(id, rs);
      }

      const isSelf = id === selfId;
      const anim = this.playerAnimInput;
      anim.moveX = mx;
      anim.moveY = my;
      anim.desiredMoveX = isSelf ? this.curDx : undefined;
      anim.desiredMoveY = isSelf ? this.curDy : undefined;
      anim.speed = speed;
      anim.aimX = isSelf ? aimX : 0;
      anim.aimY = isSelf ? aimY : 0;
      anim.aimDxPx = isSelf ? aimDxPx : undefined; // §37 raw offset → the flip commits at the midpoint
      anim.aimDir = pl?.aimDir ?? 0; // §9 remote gun pose tracks the synced aim
      anim.isSelf = isSelf;
      anim.recoilX = pl?.vx ?? 0; // §20 momentum flinch (gun recoil / hit knockback)
      anim.recoilY = pl?.vy ?? 0;
      anim.jumpVh = jumpVh;
      anim.moveStance = moveStance;
      anim.slidePhase = slidePhase;
      anim.slideTick = slideTick;
      anim.reducedMotion = reducedMotion;
      const beam = this.room?.state.beams.get(id);
      const beamChannelLive =
        beam?.phase === BeamPhase.Charging || beam?.phase === BeamPhase.Active;
      const localChannelHeld =
        isSelf &&
        !!pl?.alive &&
        !this.pointerOverInteractiveUi &&
        !!(pl && (WEAPONS[pl.weapon]?.beam || WEAPONS[pl.weapon]?.performance?.continuous)) &&
        (!WEAPONS[pl.weapon]?.performance?.aura ||
          Math.floor(Number(pl.dualWield?.weaponResource?.valueQ) || 0) > 0) &&
        pointer.rightButtonDown();
      anim.fireHeld = pl?.attackHeld === true || beamChannelLive || localChannelHeld;
      if (pl) {
        const ultimateTick = isSelf ? (this.room?.state.tick ?? 0) : remoteUltimateTick;
        const ultimatePhase = isSelf
          ? (pl.ultimate.phase as UltimatePhaseValue)
          : this.ultimatePresentationPhase(pl.ultimate, ultimateTick);
        blob.setUltimatePresentation(
          ultimateFamilyForCode(pl.ultimate.archetype),
          ultimatePhase,
          this.ultimatePhaseProgress(pl.ultimate, ultimateTick, ultimatePhase),
          reducedMotion,
        );
      }
      blob.animate(this.animClock, anim);
      blob.setDepth(blob.y);
    }
  }

  private updatePetRigs(deltaMs: number): void {
    if (!this.room) return;
    const selfId = this.room.sessionId;
    const reducedMotion = prefersReducedPaperMotion();
    this.room.state.players.forEach((player, id) => {
      const pet = this.petRigs.get(id);
      const owner = this.blobs.get(id);
      if (!pet || !owner) return;
      const previousHp = this.petOwnerHp.get(id);
      if (previousHp !== undefined && player.hp < previousHp - 0.01)
        pet.onOwnerHit(player.vx, player.vy, this.time.now);
      this.petOwnerHp.set(id, player.hp);
      const isSelf = id === selfId;
      const stance =
        isSelf && this.predictor ? this.selfPredStance : (player.moveStance as MoveStance);
      const aimX = isSelf ? this.selfAim.x : Math.cos(player.aimDir);
      const aimY = isSelf ? this.selfAim.y : Math.sin(player.aimDir);
      pet.update(
        this.time.now,
        deltaMs,
        owner.x,
        owner.y,
        aimX,
        aimY,
        stance,
        player.teleportSeq,
        player.attackSeq,
        !player.alive,
        reducedMotion,
      );
      this.writePetTelegraphAvoidance(
        pet.screenX,
        pet.screenY,
        pet.radius,
        this.petAvoidanceScratch,
      );
      pet.setAvoidance(
        this.petAvoidanceScratch.x,
        this.petAvoidanceScratch.y,
        this.petAvoidanceScratch.alpha,
      );
    });
  }

  /** Expand truth edges by the pet radius + 14px, detour at most 28px, then hide if no legal tangent exists. */
  private writePetTelegraphAvoidance(
    x: number,
    y: number,
    radius: number,
    out: { x: number; y: number; alpha: number },
  ): void {
    out.x = 0;
    out.y = 0;
    out.alpha = 1;
    const clearance = radius + 14;
    let bestNeed = 0;
    let bestX = 0;
    let bestY = 0;
    for (const cached of this.telegraphCache.values()) {
      if (cached.seenFrame !== this.telegraphFrame) continue;
      const geometry = cached.geometry;
      const inside = telegraphGeometryContains(geometry, x, y);
      let closestSq = Number.POSITIVE_INFINITY;
      let closestX = x;
      let closestY = y;
      for (const edge of geometry.edges) {
        const points = edge.points;
        const segmentCount = edge.closed ? points.length : points.length - 1;
        for (let index = 0; index < segmentCount; index++) {
          const start = points[index];
          const end = points[(index + 1) % points.length];
          if (!start || !end) continue;
          const dx = end.x - start.x;
          const dy = end.y - start.y;
          const lengthSq = dx * dx + dy * dy;
          const t =
            lengthSq > 1e-8
              ? Math.max(0, Math.min(1, ((x - start.x) * dx + (y - start.y) * dy) / lengthSq))
              : 0;
          const px = start.x + dx * t;
          const py = start.y + dy * t;
          const distanceSq = (x - px) ** 2 + (y - py) ** 2;
          if (distanceSq >= closestSq) continue;
          closestSq = distanceSq;
          closestX = px;
          closestY = py;
        }
      }
      const distance = Math.sqrt(closestSq);
      if (!inside && !(distance < clearance)) continue;
      const need = inside ? distance + clearance : clearance - distance;
      if (need > 28) {
        out.alpha = 0;
        return;
      }
      if (need <= bestNeed) continue;
      let directionX = inside ? closestX - x : x - closestX;
      let directionY = inside ? closestY - y : y - closestY;
      let length = Math.hypot(directionX, directionY);
      if (length < 1e-5) {
        directionX = x - geometry.centerX;
        directionY = y - geometry.centerY;
        length = Math.hypot(directionX, directionY) || 1;
      }
      bestNeed = need;
      bestX = (directionX / length) * need;
      bestY = (directionY / length) * need;
    }
    if (bestNeed <= 0) return;
    out.x = bestX;
    out.y = bestY;
    if (this.petOverlapsTelegraph(x + bestX, y + bestY, clearance)) out.alpha = 0;
  }

  private petOverlapsTelegraph(x: number, y: number, clearance: number): boolean {
    const clearanceSq = clearance * clearance;
    for (const cached of this.telegraphCache.values()) {
      if (cached.seenFrame !== this.telegraphFrame) continue;
      const geometry = cached.geometry;
      if (telegraphGeometryContains(geometry, x, y)) return true;
      for (const edge of geometry.edges) {
        const points = edge.points;
        const segmentCount = edge.closed ? points.length : points.length - 1;
        for (let index = 0; index < segmentCount; index++) {
          const start = points[index];
          const end = points[(index + 1) % points.length];
          if (!start || !end) continue;
          const dx = end.x - start.x;
          const dy = end.y - start.y;
          const lengthSq = dx * dx + dy * dy;
          const t =
            lengthSq > 1e-8
              ? Math.max(0, Math.min(1, ((x - start.x) * dx + (y - start.y) * dy) / lengthSq))
              : 0;
          const px = start.x + dx * t;
          const py = start.y + dy * t;
          if ((x - px) ** 2 + (y - py) ** 2 < clearanceSq) return true;
        }
      }
    }
    return false;
  }

  /** One presentation edge tracker per player; all spawned geometry lands in fixed JumpEffectRenderer pools. */
  private presentJumpFeel(
    id: string,
    blob: SpriteRig,
    height: number,
    vh: number,
    stance: MoveStance,
    slidePhase: SlidePhase,
    slideTick: number,
    poundSeq: number,
    moveX: number,
    moveY: number,
    speed: number,
    isSelf: boolean,
    reducedMotion: boolean,
  ): void {
    let previous = this.jumpPresentation.get(id);
    if (!previous) {
      previous = {
        height,
        vh,
        stance,
        slidePhase,
        poundSeq,
        coilSecondPlayed: false,
        stanceStartedMs: this.animClock,
      };
      this.jumpPresentation.set(id, previous);
    }
    const x = blob.x;
    const y = this.belt ? this.beltY(blob.y) : blob.y;
    const visible = isSelf || this.cameras.main.worldView.contains(blob.x, blob.y);
    const localAmt = isSelf ? 1 : 0.35;
    const stanceChanged = stance !== previous.stance;
    const slidePhaseChanged = slidePhase !== previous.slidePhase;
    if (stanceChanged || slidePhaseChanged) {
      previous.stanceStartedMs = this.animClock;
      previous.coilSecondPlayed = false;
      if (stance === STANCE_POUND) this.audio.play("pound:tuck", { x, amt: localAmt });
      if (stance === STANCE_SLIDE && slidePhase === SLIDE_PHASE_GROUND) {
        this.jumpEffectRenderer.spawnSlideBurst(
          x,
          y + PLAYER_SHADOW_LOCAL_Y,
          moveX,
          moveY,
          reducedMotion || !visible,
          this.belt ? BELT_FORESHORTEN : 1,
        );
        this.audio.play("slide", { x, amt: localAmt });
      } else if (previous.stance === STANCE_SLIDE && previous.slidePhase === SLIDE_PHASE_GROUND) {
        this.jumpEffectRenderer.spawnSlidePlant(
          x,
          y + PLAYER_SHADOW_LOCAL_Y,
          moveX,
          moveY,
          reducedMotion || !visible,
          this.belt ? BELT_FORESHORTEN : 1,
        );
      }
    }
    if (visible && stance === STANCE_SLIDE && slidePhase === SLIDE_PHASE_GROUND)
      this.audio.play("slide:scrape", {
        x,
        amt: Math.min(1, Math.max(0, speed / (ROLL_SPEED_CURVE[0] ?? 1))) * localAmt,
        ownerId: id,
      });
    if (stance === STANCE_POUND && vh < 0 && previous.vh >= 0)
      this.audio.play("pound:drop", { x, amt: localAmt });

    const authoritativePound = poundSeq !== previous.poundSeq;
    if (authoritativePound) {
      this.jumpEffectRenderer.spawnPoundImpact(
        x,
        y,
        POUND_RADIUS,
        poundRingColor(id),
        reducedMotion || !visible,
        this.belt ? BELT_FORESHORTEN : 1,
      );
      this.audio.play("pound:hit", { x, amt: localAmt });
      if (isSelf) {
        this.shakeCam(90, 0.0072, "world");
      } else {
        const self = this.room ? this.blobs.get(this.room.sessionId) : undefined;
        const falloff = self
          ? Math.max(0, 1 - Math.hypot(blob.x - self.x, blob.y - self.y) / 760)
          : 0;
        if (falloff > 0) this.shakeCam(90 * falloff, 0.0072 * falloff, "world");
      }
    }

    const launched = previous.height <= GROUND_EPSILON && height > GROUND_EPSILON;
    if (launched) {
      if (stance === STANCE_DASH) this.audio.play("leap:launch", { x, amt: localAmt });
      else this.audio.play("jump", { x, amt: localAmt });
    }
    const landed = previous.height > GROUND_EPSILON && height <= GROUND_EPSILON;
    if (landed) {
      const landingStance = previous.stance;
      const forcedHeavy = landingStance === STANCE_DASH || landingStance === STANCE_POUND;
      const tier = landingThumpTier(
        previous.vh,
        landingStance === STANCE_DASH ? speed : 0,
        forcedHeavy,
      );
      this.jumpEffectRenderer.spawnLanding(
        x,
        y + PLAYER_SHADOW_LOCAL_Y,
        tier,
        moveX,
        moveY,
        landingStance === STANCE_DASH,
        reducedMotion || !visible,
        this.belt ? BELT_FORESHORTEN : 1,
      );
      if (landingStance !== STANCE_POUND && !authoritativePound)
        this.audio.play("land", { x, amt: (tier / 3) * localAmt });
      if (landingStance === STANCE_DASH) this.audio.play("leap:skid", { x, amt: localAmt });
      else if (tier === 3 && landingStance !== STANCE_POUND && isSelf)
        this.shakeCam(75, 0.0045, "world");
    }

    if (visible && stance === STANCE_POUND && vh < 0)
      this.jumpEffectRenderer.drawPoundStreak(x, y, height, -vh, reducedMotion);
    if (visible && stance === STANCE_SLIDE && slidePhase === SLIDE_PHASE_GROUND)
      this.jumpEffectRenderer.drawSlideWake(
        x,
        y,
        moveX,
        moveY,
        slideTick * ROLL_TICK_SECONDS,
        reducedMotion,
      );

    previous.height = height;
    previous.vh = vh;
    previous.stance = stance;
    previous.slidePhase = slidePhase;
    previous.poundSeq = poundSeq;
  }

  /** RMB held → fire the equipped weapon toward the cursor (§9). Server gates damage by cooldown;
   *  the client mirrors the cooldown locally to fire the swing animation in sync (cosmetic). */
  /** F keydown is a one-shot, budgeted action. All displacement/damage remains server-authoritative. */
  private sendUltimate(): void {
    if (!this.room) return;
    const selfId = this.room.sessionId;
    const self = this.room.state.players.get(selfId);
    if (!self) return;
    const row = self.ultimate;
    const family = ultimateFamilyForCode(row.archetype);
    const doorReturn =
      family === UltimateFamily.DimensionDoor &&
      this.ultimateVfx.hasDoorTicket(selfId, this.room.state.tick);
    const affordance = ultimateInputAffordance({
      alive: self.alive,
      modal: this.inputModalBlocked(self),
      nearShop: false,
      unlocked: family !== UltimateFamily.Locked,
      charge: row.charge,
      phase: row.phase,
      pending: this.time.now < this.ultimateCastPendingUntil,
      doorReturn,
    });
    const rig = this.blobs.get(selfId);
    if (affordance === "blocked") return;
    if (affordance === "dry") {
      this.ultimateHudPulseUntil = this.time.now + 240;
      this.audio.play("ult:dry", { x: rig?.x ?? self.x, amt: 0.35 });
      this.ultimateVfx.fizzlePrediction(selfId, rig?.x ?? self.x, rig?.y ?? self.y);
      return;
    }

    const cam = this.cameras.main;
    const px = this.pointerScreen.set ? this.pointerScreen.x : this.input.activePointer.x;
    const py = this.pointerScreen.set ? this.pointerScreen.y : this.input.activePointer.y;
    const world = cam.getWorldPoint(px, py);
    const targetX = world.x;
    const targetY = this.belt ? BELT_Y0 + (world.y - BELT_Y0) / BELT_FORESHORTEN : world.y;
    const aimLength = Math.hypot(targetX - self.x, targetY - self.y) || 1;
    const actionAimX = (targetX - self.x) / aimLength;
    const actionAimY = (targetY - self.y) / aimLength;
    this.room.send("ultimate", {
      aimX: actionAimX,
      aimY: actionAimY,
      tx: targetX,
      ty: targetY,
    });
    this.ultimateCastPendingUntil = this.time.now + 400;
    rig?.triggerUltimateWindup(this.animClock, family);
    if (family === UltimateFamily.DimensionDoor) rig?.playFoldUp(this.animClock, 120);
    this.ultimateVfx.cuePrediction(
      selfId,
      family,
      rig?.x ?? self.x,
      rig?.y ?? (this.belt ? this.beltY(self.y) : self.y),
      targetX,
      targetY,
      this.time.now,
      prefersReducedPaperMotion(),
    );
    if (family === UltimateFamily.SunspiteComet) {
      const visualOriginY = rig?.y ?? (this.belt ? this.beltY(self.y) : self.y);
      const angle = Math.atan2(world.y - visualOriginY, world.x - (rig?.x ?? self.x));
      const weapon = WEAPONS[self.weapon] ?? WEAPONS[DEFAULT_WEAPON];
      const muzzle = { x: rig?.x ?? self.x, y: visualOriginY };
      if (weapon?.muzzle) {
        if (!rig?.writeWeaponMuzzleForShot(self.attackSeq, 0, muzzle)) {
          const canonical = weaponMuzzleWorldPoint(weapon, {
            x: muzzle.x,
            y: muzzle.y,
            aimX: Math.cos(angle),
            aimY: Math.sin(angle),
            renderScale: characterScale(self.character),
          });
          muzzle.x = canonical.x;
          muzzle.y = canonical.y;
        }
      }
      const fx = gunFx("orb:fire");
      spawnMuzzleFlash(this, muzzle.x, muzzle.y, angle, fx.size, fx.color, fx.style);
      this.lastSelfMuzzleAt = this.time.now;
    }
  }

  private sendAttack(): void {
    if (!this.room) return;
    this.localAtkCd = Math.max(0, this.localAtkCd - this.deltaSec);
    const selfId = this.room.sessionId;
    const self = this.room.state.players.get(selfId);
    if (!self?.alive || this.inputModalBlocked(self)) return;
    if (this.predictor?.slideAttackLocked) return;
    if (
      this.pointerOverInteractiveUi ||
      !this.input.activePointer.rightButtonDown() ||
      this.localAtkCd > 0
    )
      return;
    const weapon = WEAPONS[self.weapon] ?? WEAPONS[DEFAULT_WEAPON];
    if (weapon?.beam || weapon?.groundZone?.trigger === "channel" || weapon?.performance?.aura)
      return;
    if (!weapon?.warp) {
      const predictionLead = (this.localPredictedAttackSeq - self.attackSeq) >>> 0;
      if (predictionLead >= 0x80000000) {
        this.localPredictedAttackSeq = self.attackSeq >>> 0;
      } else if (predictionLead > 0) {
        // The presentation high-water mark has one outstanding acceptance. Keep held fire live and retry
        // next frame after authority catches up instead of opening a second speculative beat: under latency
        // that second slot can outlive a Drive rejection and leave the firing rig permanently ahead.
        return;
      }
    }
    // Schema 30: thrown weapons + guns bill the Drive bar — don't animate/fire when the next shot is
    // unaffordable (the server's spend seam rejects it too). Replaces the retired `charges` gate.
    if (weapon?.thrown || weapon?.gun || weapon?.warp) {
      const drive = Math.floor(Number(self.dualWield?.weaponResource?.valueQ) || 0) / 100;
      if (drive + 1e-9 < driveCostView(weapon.id).cost) return;
    }
    // §10 v0.104 de-clunk: fold in the held weapon's affix cooldown multiplier — the SERVER gates fire on
    // `cooldown × lootCooldownMult`, so if the client's send cadence ignores it, a Heavy/slow weapon sends
    // faster than the server accepts (half the swings become ghosts) and a Swift/fast one can never send at
    // its real rate. Matching it here makes the local swing cadence WYSIWYG with the damage the server deals.
    const cdMul = lootCooldownMult(self.weaponAffix);
    this.localAtkCd = localAttackCooldownSeconds(weapon, cdMul);
    // §44 one PREDICTED descriptor/epoch for every local swing consumer. The server constructs the identical
    // effective-cooldown descriptor only on acceptance; buffering/network delay remains until swing-seq sync.
    const swing = weapon ? swingDescriptorFor(weapon, weapon.cooldown * cdMul) : undefined;
    const rig = this.blobs.get(selfId);
    // Predict the next contiguous accepted beat alongside the existing pose. The authoritative edge later
    // consumes this high-water slot as confirmation, so neither the swing nor an open-tome page restarts.
    if (!weapon?.warp) {
      this.localPredictedAttackSeq = (this.localPredictedAttackSeq + 1) >>> 0;
      rig?.setAttackBeat(this.localPredictedAttackSeq, true, this.time.now);
    }
    // §20 WYSIWYG: freeze the aim at swing-start so the blade sweeps the SAME arc the server's swept hitbox
    // uses. Guns don't melee-swing — the shot is the muzzle flash.
    if (!weapon?.gun && !weapon?.warp && swing) {
      rig?.triggerSwing(this.time.now, Math.atan2(this.selfAim.y, this.selfAim.x), swing);
    }
    if (
      weapon &&
      swing &&
      !weapon.gun &&
      !weapon.warp &&
      !weapon.quake &&
      !weapon.cast &&
      !weapon.thrown
    ) {
      const aimLength = Math.hypot(this.selfAim.x, this.selfAim.y) || 1;
      this.predictedMeleeContacts.push({
        atAnimMs: this.animClock + swing.impactSeconds * 1000,
        weaponId: weapon.id,
        aimX: this.selfAim.x / aimLength,
        aimY: this.selfAim.y / aimLength,
        range: meleeReach(weapon),
        halfArc: weapon.halfArc,
        element: weapon.tags.element ?? "physical",
      });
    }
    if (weapon && !weapon.warp) this.playWeaponSourceAudio(weapon, rig?.x ?? self.x, true);
    // Cursor world position (for slam-at-cursor weapons).
    const cam = this.cameras.main;
    const px = this.pointerScreen.set ? this.pointerScreen.x : this.input.activePointer.x;
    const py = this.pointerScreen.set ? this.pointerScreen.y : this.input.activePointer.y;
    // §29/§39 the cursor's WORLD position via the camera transform in BOTH modes (belt additionally
    // un-projects depth). The old top-down `px + scrollX` shortcut was only correct while the pointer was
    // CSS px and the RENDER_DPR zoom cancelled it — post-§37 (pointer in internal px) it skewed attack
    // targets by the DPR factor on scaled displays.
    let cwx: number;
    let cwy: number;
    let selfWy: number;
    if (this.belt) {
      const wp = cam.getWorldPoint(px, py);
      cwx = wp.x;
      cwy = BELT_Y0 + (wp.y - BELT_Y0) / BELT_FORESHORTEN;
      selfWy = BELT_Y0 + ((rig?.y ?? self.y) - BELT_Y0) / BELT_FORESHORTEN;
    } else {
      const wp = cam.getWorldPoint(px, py);
      cwx = wp.x;
      cwy = wp.y;
      selfWy = rig?.y ?? self.y;
    }
    if (weapon && rig && !weapon.gun && !weapon.warp && swing)
      this.cueWeaponSwingIdentity(
        rig,
        selfId,
        weapon,
        Math.atan2(this.selfAim.y, this.selfAim.x),
        rig.activeSwing ?? swing,
        { x: cwx, y: cwy },
        { x: rig.x, y: selfWy },
      );
    if (weapon?.warp && rig) spawnTeslaWarpDeparture(this, rig.x, rig.y);
    if (
      weapon?.tags.classPool === "caster" &&
      !weapon.warp &&
      rig &&
      !weapon.performance?.aura &&
      swing
    )
      this.cueAttackCasterSource(
        weapon,
        swing,
        selfId,
        rig,
        Math.atan2(this.selfAim.y, this.selfAim.x),
        () => {
          this.lastSelfMuzzleAt = this.time.now;
        },
      );
    if (weapon?.quake && swing) {
      // Epicenter = cursor, clamped to QUAKE_REACH from the character — the SAME shared clamp (in WORLD
      // space) the server's damage uses. §37: the VFX renders on the PROJECTED plane, so belt-project the
      // epicenter's y for the draw — unprojected it erupted visibly BELOW the cursor.
      const ep = clampQuakeEpicenter(
        { x: rig?.x ?? self.x, y: selfWy },
        { x: cwx, y: cwy },
        QUAKE_REACH,
      );
      // §44 the eruption samples the SAME descriptor/scene epoch as rig + authored VFX; the server samples
      // this fraction from its accepted epoch, leaving only the explicitly documented protocol residual.
      const quake = weapon.quake;
      const quakeCueSeconds = this.destinationReadyCueSeconds(weapon, swing, swing.impactSeconds);
      this.time.delayedCall(quakeCueSeconds * 1000, () => {
        if (!this.room) return;
        const authoritativeDestination =
          weapon.performance?.lunge?.impactAtDestination === true
            ? this.room.state.players.get(selfId)
            : undefined;
        const impact = authoritativeDestination
          ? { x: authoritativeDestination.x, y: authoritativeDestination.y }
          : ep;
        const impactRenderY = this.belt ? this.beltY(impact.y) : impact.y;
        const quakeIdentity = resolveWeaponEffectRecipe(weapon);
        if (quakeIdentity?.quakeExplosionPaintedOnlyWeaponIds?.includes(weapon.id))
          playFxPack(this, "void-implosion", impact.x, impactRenderY, {
            radius: quake.radius,
          });
        else if (quakeIdentity?.quakeExplosionElement)
          spawnExplosion(
            this,
            impact.x,
            impactRenderY,
            quake.radius,
            quakeIdentity.quakeExplosionElement,
            "player-weapon",
          );
        else if (shouldSpawnLegacyQuakeVfx(weapon))
          spawnQuake(
            this,
            impact.x,
            impactRenderY,
            quake,
            weapon,
            this.belt ? BELT_FORESHORTEN : 1,
          );
        // §7 v0.105 de-clunk: only freeze if the quake actually CONNECTED (an enemy inside the AoE) — a
        // real impact is a skill beat → priority (bypasses the freeze budget).
        const qr = quake.radius;
        let connectedId = "";
        let connectedX = 0;
        let connectedY = 0;
        let connectedWorldX = 0;
        let connectedWorldY = 0;
        let best = Number.POSITIVE_INFINITY;
        this.room.state.enemies.forEach((en, enemyId) => {
          const distance = (en.x - impact.x) ** 2 + (en.y - impact.y) ** 2;
          if (distance > qr * qr || distance >= best) return;
          best = distance;
          connectedId = enemyId;
          connectedWorldX = en.x;
          connectedWorldY = en.y;
          const targetRig = this.enemies.get(enemyId);
          connectedX = targetRig?.x ?? en.x;
          connectedY = targetRig?.y ?? (this.belt ? this.beltY(en.y) : en.y);
        });
        if (connectedId) {
          const directionLength =
            Math.hypot(connectedWorldX - impact.x, connectedWorldY - impact.y) || 1;
          this.combatFeedback.onPredictedContact(
            {
              targetId: connectedId,
              delivery: CombatDelivery.Quake,
              weaponId: weapon.id,
              element: weapon.tags.element ?? "physical",
              dirX: (connectedWorldX - impact.x) / directionLength,
              dirY: (connectedWorldY - impact.y) / directionLength,
              x: connectedX,
              y: connectedY,
            },
            this.time.now,
          );
          this.hitStop(130, true);
        }
      });
    } else if (weapon?.gun) {
      // Gun recoil — a per-gun camera kick (heavy slug THUMPS, gatling barely buzzes). The shake duration
      // is capped to the fire-rate so a fast auto's kicks decay before the next shot (no jitter stacking).
      this.shakeCam(
        Math.min(70, weapon.gun.fireRate * 700),
        weapon.gun.recoil ?? 0.0017,
        "player-weapon",
      );
      // §4 v0.107 PREDICTED muzzle flash: fire feedback on the CLICK at the rendered barrel (the old
      // path waited a full round-trip for the synced projectile — ~60-125ms of "did it fire?" online).
      // The authoritative bullet still renders from state; syncProjectiles suppresses its duplicate
      // flash for self for a beat. Cosmetic only — damage is server-side.
      if (rig) {
        const ang = Math.atan2(this.selfAim.y, this.selfAim.x);
        if (weapon.tags.classPool !== "caster") {
          // §35 tint the predicted muzzle flash to the weapon's element too (matches the bullet).
          const el = weapon.tags?.element;
          const fx = gunFx(
            el && el !== "physical" ? `${weapon.gun.bulletKind}:${el}` : weapon.gun.bulletKind,
          );
          const aimX = Math.cos(ang);
          const aimY = Math.sin(ang);
          const muzzles = this.writeLiveGunMuzzles(
            self,
            weapon,
            rig,
            this.localPredictedAttackSeq,
            aimX,
            aimY,
          );
          for (const muzzle of muzzles) {
            spawnMuzzleFlash(
              this,
              muzzle.x,
              muzzle.y,
              ang,
              fx.size,
              fx.color,
              weapon.gun.muzzle ?? fx.style,
              weapon.id,
            );
            if (weapon.gun.sonicBoomRing)
              spawnSonicBoomRing(this, muzzle.x, muzzle.y, ang, fx.color);
          }
        }
        this.audio.play(`shot:${weapon.gun.bulletKind}`, { x: rig.x }); // §19 predicted shot sound
        this.lastSelfMuzzleAt = this.time.now;
      }
    } else if (weapon?.cast && weapon.tags.classPool !== "caster") {
      // §38 predicted CAST feedback: a small arcane flash at the staff tip on the click (the real piercing
      // orb renders from state a round-trip later). Tinted to the weapon's element — no gunpowder look.
      if (rig) {
        const ang = Math.atan2(this.selfAim.y, this.selfAim.x);
        const el = weapon.tags?.element;
        const fx = gunFx(el && el !== "physical" ? `orb:${el}` : "orb");
        const muzzle = weapon.muzzle
          ? weaponMuzzleWorldPoint(weapon, {
              x: rig.x,
              y: rig.y,
              aimX: Math.cos(ang),
              aimY: Math.sin(ang),
              renderScale: characterScale(self.character),
            })
          : { x: rig.x, y: rig.y };
        spawnMuzzleFlash(this, muzzle.x, muzzle.y, ang, fx.size, fx.color, fx.style);
        this.lastSelfMuzzleAt = this.time.now;
      }
    } else if (weapon && !weapon.warp && !weapon.thrown && swing) {
      // Plain melee swing → the weapon's authored swing VFX (§14). If the weapon is authored "spawn at
      // cursor" (Weaponsmith), the VFX erupts at the clamped cursor (greatsword-quake style) instead.
      const rx = rig?.x ?? self.x;
      const ry = rig?.y ?? self.y;
      const bladeHand = rig?.activeSwingHand === 1 ? 1 : 0;
      const bladePose = rig ? () => rig.leadWeaponTipPose(bladeHand) : undefined;
      if (this.vfxPlayer.spawnsAtCursor(weapon.id)) {
        // §37 clamp in WORLD space (selfWy, not the projected rig y — mixed spaces skewed the radius), then
        // belt-project the epicenter for the draw so the eruption sits ON the cursor, not below it.
        const ep = clampQuakeEpicenter({ x: rx, y: selfWy }, { x: cwx, y: cwy }, QUAKE_REACH);
        this.spawnSlash(
          ep.x,
          this.belt ? this.beltY(ep.y) : ep.y,
          this.selfAim,
          weapon,
          // §50 the rig's descriptor was enriched with the accepted/predicted combo step by triggerSwing
          // above; passing it (not the base descriptor) lets the wielder see their own per-step ribbon,
          // matching the remote observed-signature path.
          rig?.activeSwing ?? swing,
          true,
          undefined,
          bladePose,
        );
      } else {
        const ep = clampQuakeEpicenter(
          { x: rx, y: selfWy },
          { x: cwx, y: cwy },
          meleeReach(weapon),
        );
        this.spawnSlash(
          rx,
          ry,
          this.selfAim,
          weapon,
          rig?.activeSwing ?? swing,
          false,
          {
            x: ep.x,
            y: this.belt ? this.beltY(ep.y) : ep.y,
          },
          bladePose,
        );
      }
      // Chain-lightning on-hit proc (§10) — teal bolt leaps to the nearest enemies (server owns the damage).
      if (weapon.chainLightning)
        this.spawnChain(rx, ry, this.selfAim, weapon, rig?.activeSwing ?? swing);
    }
    // §34 the server aims in SIM space (belt y = depth), so un-project the on-screen aim's depth component
    // before sending — a projectile/melee then travels to the cursor's real world position, not a
    // foreshortened one. (x is never projected; top-down needs no conversion.)
    let saX = this.selfAim.x;
    let saY = this.selfAim.y;
    if (this.belt) {
      saY /= BELT_FORESHORTEN;
      const l = Math.hypot(saX, saY) || 1;
      saX /= l;
      saY /= l;
    }
    if (weapon?.gun) {
      this.predictGunRoundRecoil(weapon, saX, saY);
      const burst = weapon.gun.burst;
      const predictedSeq = this.localPredictedAttackSeq;
      if (burst && burst.count > 1) {
        for (let round = 1; round < burst.count; round++) {
          this.time.delayedCall(burst.intervalSeconds * round * 1000, () => {
            if (!this.room || this.localPredictedAttackSeq !== predictedSeq) return;
            const liveSelf = this.room.state.players.get(this.room.sessionId);
            const liveRig = this.blobs.get(this.room.sessionId);
            if (!liveSelf?.alive || liveSelf.weapon !== weapon.id || !liveRig) return;
            let aimX = this.selfAim.x;
            let aimY = this.selfAim.y;
            if (this.belt) aimY /= BELT_FORESHORTEN;
            const aimLength = Math.hypot(aimX, aimY) || 1;
            aimX /= aimLength;
            aimY /= aimLength;
            this.predictGunRoundRecoil(weapon, aimX, aimY);
            this.cuePredictedBurstRound(liveSelf, weapon, liveRig, aimX, aimY, predictedSeq);
          });
        }
      }
    }
    this.room.send("attack", { aimX: saX, aimY: saY, tx: cwx, ty: cwy });
  }

  /** Mirror only recoil that authority declares locomotion-owning. Presentation-only gun recoil remains
   * on the rig/camera clocks above and can never enter the predictor position sampled by later muzzles. */
  private predictGunRoundRecoil(weapon: WeaponDef, aimX: number, aimY: number): void {
    const recoil = gunLocomotionRecoilFor(weapon);
    if (recoil.impulse <= 0) return;
    this.predictor?.addPredictedImpulse(
      -aimX * recoil.impulse,
      -aimY * recoil.impulse,
      recoil.maxImpulse,
    );
  }

  /** Replay follow-up burst punctuation from the current rendered implement, never the trigger snapshot. */
  private cuePredictedBurstRound(
    player: PlayerState,
    weapon: WeaponDef,
    rig: SpriteRig,
    aimX: number,
    aimY: number,
    predictedSeq: number,
  ): void {
    const angle = Math.atan2(aimY, aimX);
    rig.triggerGunRecoil(this.time.now, 0);
    if (weapon.tags.classPool === "caster") {
      this.spawnCasterSource(weapon, rig.x, rig.y, angle);
    } else if (weapon.gun) {
      const element = weapon.tags.element;
      const fx = gunFx(
        element && element !== "physical"
          ? `${weapon.gun.bulletKind}:${element}`
          : weapon.gun.bulletKind,
      );
      for (const muzzle of this.writeLiveGunMuzzles(
        player,
        weapon,
        rig,
        predictedSeq,
        aimX,
        aimY,
      )) {
        spawnMuzzleFlash(
          this,
          muzzle.x,
          muzzle.y,
          angle,
          fx.size,
          fx.color,
          weapon.gun.muzzle ?? fx.style,
          weapon.id,
        );
        if (weapon.gun.sonicBoomRing) spawnSonicBoomRing(this, muzzle.x, muzzle.y, angle, fx.color);
      }
    }
    this.audio.play(`shot:${weapon.gun?.bulletKind ?? "slug"}`, { x: rig.x });
    this.lastSelfMuzzleAt = this.time.now;
  }

  private processPredictedMeleeContacts(): void {
    if (!this.room || this.predictedMeleeContacts.length === 0) return;
    const self = this.blobs.get(this.room.sessionId);
    if (!self) {
      this.predictedMeleeContacts.length = 0;
      return;
    }
    for (let index = this.predictedMeleeContacts.length - 1; index >= 0; index--) {
      const contact = this.predictedMeleeContacts[index];
      if (!contact || this.animClock < contact.atAnimMs) continue;
      this.predictedMeleeContacts.splice(index, 1);
      let targetId = "";
      let targetX = 0;
      let targetY = 0;
      let best = Number.POSITIVE_INFINITY;
      this.enemies.forEach((enemy, enemyId) => {
        if (
          !inMeleeArc(
            { x: self.x, y: self.y },
            contact.aimX,
            contact.aimY,
            enemy,
            contact.range,
            contact.halfArc,
          )
        )
          return;
        const distance = (enemy.x - self.x) ** 2 + (enemy.y - self.y) ** 2;
        if (distance >= best) return;
        best = distance;
        targetId = enemyId;
        targetX = enemy.x;
        targetY = enemy.y;
      });
      if (!targetId) continue;
      const directionLength = Math.hypot(targetX - self.x, targetY - self.y) || 1;
      this.combatFeedback.onPredictedContact(
        {
          targetId,
          delivery: CombatDelivery.Melee,
          weaponId: contact.weaponId,
          element: contact.element,
          dirX: (targetX - self.x) / directionLength,
          dirY: (targetY - self.y) / directionLength,
          x: targetX,
          y: targetY,
        },
        this.time.now,
      );
    }
  }

  /** LMB → the melee Parry signature (§7/§8). Server grants i-frames + knockback. NO VFX yet — the
   *  parry reads purely as a BLOCK/BRACE stance (weapon raised, hands guarding, slight crouch) until
   *  level-up augments add on-parry effects. Mirrors the server cooldown so the brace fires in sync. */
  private sendParry(): void {
    if (!this.room) return;
    this.localParryCd = Math.max(0, this.localParryCd - this.deltaSec);
    const selfId = this.room.sessionId;
    const self = this.room.state.players.get(selfId);
    if (!self?.alive || this.inputModalBlocked(self)) return;
    if (this.predictor?.slideParryLocked) return;
    if (
      this.pointerOverInteractiveUi ||
      !this.input.activePointer.leftButtonDown() ||
      this.localParryCd > 0
    )
      return;
    this.localParryCd = PARRY_COOLDOWN;
    this.lastParryPress = this.time.now; // H10: open the i-frame-window flash on the parry ring
    this.room.send("parry");
    const rig = this.blobs.get(selfId);
    rig?.triggerBrace(this.animClock);
    // §8 local-player parry-augment VFX (server owns the damage; this reads the owned set + live aim).
    if (rig && self.augments) this.spawnParryFx(rig.x, rig.y, self.augments);
  }

  private updateGalleryPickupLabel(targetId: string): void {
    if (targetId === this.galleryLabelFocusId) return;
    const previous = this.pickups.get(this.galleryLabelFocusId);
    const previousLabel = previous?.getData("pickupLabel") as Phaser.GameObjects.Text | undefined;
    const previousShort = previous?.getData("pickupLabelShort") as string | undefined;
    if (previousLabel && previousShort) {
      previousLabel
        .setText(previousShort)
        .setFontSize(14)
        .setWordWrapWidth(132)
        .setPadding(4, 2, 4, 2);
    }
    this.galleryLabelFocusId = targetId.startsWith("pk:") ? targetId : "";
    const focused = this.pickups.get(this.galleryLabelFocusId);
    const focusedLabel = focused?.getData("pickupLabel") as Phaser.GameObjects.Text | undefined;
    const focusedFull = focused?.getData("pickupLabelFull") as string | undefined;
    if (focusedLabel && focusedFull) {
      focusedLabel
        .setText(`${focusedFull}\n[E] PICK UP`)
        .setFontSize(14)
        .setWordWrapWidth(176)
        .setPadding(8, 5, 8, 5);
    }
  }

  /** E pickup affordance: one pulsing ring plus one prompt on the exact nearest reachable weapon. */
  private renderGrabHighlight(): void {
    const g = this.grabGfx;
    g.clear();
    const t = this.grabTarget;
    this.updateGalleryPickupLabel(this.grabTargetId);
    if (!t) {
      this.grabPromptText.setVisible(false);
      return;
    }
    const pulse = 0.5 + 0.5 * Math.sin(this.time.now * 0.008);
    g.lineStyle(2.5 + pulse, 0xffd479, 0.55 + 0.35 * pulse);
    g.strokeCircle(t.x, t.y, this.grabRadius * (0.7 + 0.06 * pulse));
    this.grabPromptText.setPosition(t.x, t.y - 45).setVisible(true);
  }

  private copperPickupPromptRadius(): number {
    const bondXp = this.petMetaAccount?.pets["copper-snail"]?.bondXp ?? 0;
    return Math.max(
      PICKUP_RADIUS,
      petModsForLevel("copper-snail", petLevelForXp(bondXp)).earnedPickupRadius,
    );
  }

  /** H10 §20 parry-state ring under the LOCAL drifter so the timing is learnable: a bright flash through the
   *  active i-frame window after a press (you're invulnerable NOW), a dim arc sweeping back to a full ring as
   *  the cooldown drains after a whiff, and a faint "ready" ring at rest. Mirrors the press + the shared
   *  PARRY_IFRAMES / PARRY_COOLDOWN (the server owns the real i-frames). */
  private renderParryState(): void {
    const g = this.parryGfx;
    g.clear();
    const selfId = this.room?.sessionId;
    const self = selfId ? this.room?.state.players.get(selfId) : undefined;
    const rig = selfId ? this.blobs.get(selfId) : undefined;
    if (!self?.alive || !rig || this.inputModalBlocked(self)) return; // hide behind a modal
    const x = rig.x;
    const y = rig.y;
    const R = 30;
    const sinceParry = (this.time.now - this.lastParryPress) / 1000;
    if (sinceParry < PARRY_IFRAMES) {
      // ACTIVE i-frame window — a bright white ring that fades as the window closes.
      const k = 1 - sinceParry / PARRY_IFRAMES;
      g.lineStyle(3.5, 0xffffff, 0.35 + 0.5 * k);
      g.strokeCircle(x, y, R);
    } else if (this.localParryCd > 0) {
      // RECOVERING — a dim arc filling clockwise from the top back to a full ring as the cooldown drains.
      const frac = 1 - this.localParryCd / PARRY_COOLDOWN; // 0 = just whiffed, 1 = ready
      g.lineStyle(3, 0x3aa0c0, 0.5);
      g.beginPath();
      g.arc(x, y, R, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
      g.strokePath();
    } else {
      // READY — a faint full ring (parry available).
      g.lineStyle(2, 0x8fdcff, 0.28);
      g.strokeCircle(x, y, R);
    }

    // The carried-over pip now shows the fixed roll cooldown.
    const slideCd = this.predictor?.slideCooldownRemaining ?? 0;
    const pipX = x + 27;
    const pipY = y + 20;
    if (slideCd > 0) {
      const ready = 1 - Math.min(1, slideCd / ROLL_COOLDOWN);
      g.lineStyle(2, 0xc7a66c, 0.52);
      g.beginPath();
      g.arc(pipX, pipY, 5, -Math.PI / 2, -Math.PI / 2 + ready * Math.PI * 2);
      g.strokePath();
    } else {
      g.fillStyle(0xe8d7b8, 0.32);
      g.fillCircle(pipX, pipY, 2.25);
    }
  }

  /** M2 §15/§16 ranged parry tell: a bright core + a ring that tightens onto each HOSTILE projectile (enemy
   *  spit + the boss bullet-wall — both kind "spit") as it closes on a player. Teaches "ranged = parryable,
   *  not just dodge." Constant velocity makes the timing honest. Drawn on the white-tell layer (same
   *  language as the melee windup ring); the parry itself already flashes the player's white spark via
   *  parriedSeq. */
  private renderProjectileTells(): void {
    if (!this.room) return;
    const g = this.telegraphGfx;
    const TELL = 150; // begin the cue ~150px out — a readable beat at bullet speed
    this.room.state.projectiles.forEach((pr, id) => {
      if (pr.kind !== "spit") return; // friendly gun/thrown/magma/counter shots aren't a threat to parry
      const c = this.projectiles.get(id);
      const px = c?.x ?? pr.x;
      const py = c?.y ?? pr.y;
      let best = TELL;
      this.room?.state.players.forEach((p) => {
        if (!p.alive) return;
        const d = Math.hypot(p.x - px, p.y - py);
        if (d < best) best = d;
      });
      if (best >= TELL) return; // not near anyone yet — no cue
      const k = 1 - best / TELL; // 0 far → 1 right on the player (parry NOW)
      g.fillStyle(0xffffff, 0.22 + 0.5 * k);
      g.fillCircle(px, py, 4 + 3 * k);
      g.lineStyle(2 + 1.5 * k, 0xffffff, 0.35 + 0.5 * k);
      g.strokeCircle(px, py, 22 - 13 * k); // ring tightens onto the slug as it arrives
    });
    // §6 v0.103 rift CHANNEL readout: the descent is a hold, not a tripwire — draw the synced 0→1 charge
    // as a violet arc filling clockwise around the rift while someone stands in it.
    const st = this.room.state;
    if (st.riftOpen && st.riftCharge > 0) {
      g.lineStyle(7, 0xb478ff, 0.95);
      g.beginPath();
      g.arc(
        st.riftX,
        st.riftY,
        EXTRACT_RADIUS + 10,
        -Math.PI / 2,
        -Math.PI / 2 + st.riftCharge * Math.PI * 2,
      );
      g.strokePath();
    }
  }

  /** §17 v0.102 landmark occlusion fade: an L/XL structure is taller than the viewport, so when the LOCAL
   *  player walks behind one (inside the sprite's bounds, above its base), it eases to ~45% alpha — cover
   *  you can see yourself behind, the standard top-down-action treatment. Eases back to opaque when clear. */
  private updatePoiOcclusion(): void {
    const selfId = this.room?.sessionId;
    const self = selfId ? this.room?.state.players.get(selfId) : undefined;
    // §4 v0.107: read the RENDERED self position (the predicted rig), not raw state — post-prediction the
    // rig LEADS state by ~RTT/2, so a state-based fade would start visibly late walking behind a landmark.
    const rig = selfId ? this.blobs.get(selfId) : undefined;
    const sx = rig?.x ?? self?.x ?? 0;
    const sy = rig?.y ?? self?.y ?? 0;
    // §16 v0.117 Polish B — a gentle wind SWAY: the bottom-origin landmarks lean ±~1° on a slow sine, each
    // offset by its position so they don't sway in lockstep. Subtle enough to read as wind, not a wobble.
    const sway = this.time.now / 1000;
    for (const p of this.poiSprites) {
      let target = 1;
      if (self?.alive) {
        const halfW = p.img.displayWidth / 2;
        const top = p.y - p.img.displayHeight;
        // "Behind" = horizontally within the sprite and standing between its top and its base line.
        if (sy < p.y && sy > top && Math.abs(sx - p.x) < halfW) target = 0.45;
      }
      p.img.alpha = Phaser.Math.Linear(p.img.alpha, target, 0.18);
      p.img.rotation = Math.sin(sway * 0.6 + p.x * 0.013) * 0.018;
    }
  }

  /** One gate locator chevron. It persists until the complete circle clears the padded safe viewport and
   *  pulses for the first three seconds even when the target centre was already technically on-screen. */
  private updateEdgeArrow(
    slot: "portalArrow" | "riftArrow",
    open: boolean,
    tx: number,
    ty: number,
    color: number,
    colorCss: string,
    word: string,
    pulseUntil: number,
  ): void {
    const selfId = this.room?.sessionId;
    const self = selfId ? this.room?.state.players.get(selfId) : undefined;
    const cam = this.cameras.main;
    const forcePulse = this.time.now < pulseUntil;
    const needsLocator = gateNeedsEdgeLocator(
      open,
      tx,
      ty,
      EXTRACT_RADIUS,
      cam.worldView,
      forcePulse,
    );
    if (!needsLocator || !self?.alive) {
      this[slot]?.setVisible(false);
      return;
    }
    if (!this[slot]) {
      const tri = this.add.triangle(0, 0, 0, -13, 11, 9, -11, 9, color, 0.95);
      const label = this.add
        .text(0, 26, "", {
          fontSize: "13px",
          color: colorCss,
          fontStyle: "bold",
        })
        .setOrigin(0.5);
      this[slot] = this.add.container(0, 0, [tri, label]).setDepth(99997).setScrollFactor(0);
    }
    const arrow = this[slot] as Phaser.GameObjects.Container;
    // §4 v0.107: bearing/distance from the RENDERED self (predicted rig), not the ~RTT/2-stale state.
    const rig = selfId ? this.blobs.get(selfId) : undefined;
    const dx = tx - (rig?.x ?? self.x);
    const dy = ty - (rig?.y ?? self.y);
    const ang = Math.atan2(dy, dx);
    // Pin to the screen edge along the bearing (padded), rotate the chevron to point at the target.
    const pad = 46;
    const w = this.screenW();
    const h = this.screenH();
    const cx = w / 2;
    const cy = h / 2;
    const xEdgeT = Math.abs((dx >= 0 ? w - pad - cx : pad - cx) / (Math.cos(ang) || 1e-6));
    const yEdgeT = Math.abs((dy >= 0 ? h - pad - cy : pad - cy) / (Math.sin(ang) || 1e-6));
    const t = Math.min(xEdgeT, yEdgeT);
    let arrowX = cx + Math.cos(ang) * t;
    let arrowY = cy + Math.sin(ang) * t;
    // Keep edge locators out of the mirrored-L corridor without changing their true bearing/rotation.
    const dock = this.carouselDock;
    const layout = dock?.layout;
    if (layout && dock.root.visible && !this.belt) {
      const clearance = 16 * layout.scale;
      const hitsBottom = dy >= 0 && yEdgeT <= xEdgeT;
      const hitsRight = dx >= 0 && xEdgeT <= yEdgeT;
      if (hitsBottom && arrowX >= layout.bottomOccupiedLeft - clearance) {
        arrowX = layout.bottomOccupiedLeft - clearance;
      }
      if (hitsRight && arrowY >= layout.rightOccupiedTop - clearance) {
        arrowY = layout.rightOccupiedTop - clearance;
      }
    }
    const pulseScale = forcePulse ? 1.08 + Math.sin(this.time.now * 0.012) * 0.1 : 1;
    arrow.setVisible(true).setPosition(arrowX, arrowY).setScale(pulseScale);
    (arrow.list[0] as Phaser.GameObjects.Triangle).setRotation(ang + Math.PI / 2);
    (arrow.list[1] as Phaser.GameObjects.Text).setText(
      `${word} ${Math.round(Math.hypot(dx, dy) / 100) / 10}k`,
    );
  }

  /** §17/§6 off-screen locators: the amber EXTRACT portal + the violet DEEPER rift each get an edge
   *  chevron when open + out of view, so the greed decision has directions, not just copy. */
  private updatePortalArrow(): void {
    const st = this.room?.state;
    if (!st) return;
    this.updateEdgeArrow(
      "portalArrow",
      st.portalOpen,
      st.portalX,
      st.portalY,
      0xffd479,
      "#ffd479",
      "bank",
      this.portalLocatorPulseUntil,
    );
    this.updateEdgeArrow(
      "riftArrow",
      st.riftOpen,
      st.riftX,
      st.riftY,
      0xb478ff,
      "#b478ff",
      "rift",
      this.riftLocatorPulseUntil,
    );
  }

  /** §8 cosmetic on-parry VFX for the augments that read at the parrier: Bulwark's absorb ring + Emberguard's
   *  fire-wave cone (toward the live cursor aim). Counterblade's blades + the damage are server-spawned. */
  private spawnParryFx(x: number, y: number, owned: string): void {
    if (hasAugment(owned, "bulwark")) {
      const ring = this.add.circle(x, y, 30).setStrokeStyle(4, 0x6fe6ff, 0.9).setDepth(99996);
      this.tweens.add({
        targets: ring,
        scale: 1.7,
        alpha: 0,
        duration: 380,
        ease: "Quad.easeOut",
        onComplete: () => ring.destroy(),
      });
    }
    if (hasAugment(owned, "emberguard")) {
      const ang = Math.atan2(this.selfAim.y, this.selfAim.x);
      const ADD = Phaser.BlendModes.ADD;
      const base = this.add
        .ellipse(x, y, EMBERGUARD_RANGE, EMBERGUARD_RANGE * 0.55, 0xff5a1e, 0.18)
        .setRotation(ang)
        .setBlendMode(ADD)
        .setDepth(99994);
      this.tweens.add({
        targets: base,
        alpha: 0,
        scale: 1.2,
        duration: 240,
        onComplete: () => base.destroy(),
      });
      for (let i = 0; i < 7; i++) {
        const a = ang + (i / 6 - 0.5) * EMBERGUARD_HALF_ARC * 2;
        const ember = this.add.circle(x, y, 7, 0xff7a2a, 0.9).setBlendMode(ADD).setDepth(99995);
        this.tweens.add({
          targets: ember,
          x: x + Math.cos(a) * EMBERGUARD_RANGE,
          y: y + Math.sin(a) * EMBERGUARD_RANGE,
          alpha: 0,
          scale: 2,
          duration: 280 + Math.random() * 80,
          ease: "Quad.easeOut",
          onComplete: () => ember.destroy(),
        });
      }
    }
  }

  /** Hit-stop (§20): hold the visuals for `ms` on impactful events. §7 v0.105 de-clunk: `priority` events
   *  (the parry beat, a quake activation that connected) always freeze; NON-priority ones (kill crunches)
   *  spend from a rolling budget (FREEZE_BUDGET_MS per FREEZE_WINDOW_MS, a leaky bucket) so a horde clear
   *  can't chain 45ms crunches into ~40%-of-the-time frozen judder. */
  private static readonly FREEZE_BUDGET_MS = 250;
  private static readonly FREEZE_WINDOW_MS = 1000;
  /** §36 element→contact-spark colour (mirrors the gun-bullet element tints in projectile-factory so a
   *  weapon's melee sparks and its bullets read the same hue). "physical"/unknown falls through to steel. */
  private static readonly ELEMENT_SPARK: Record<string, number> = {
    fire: 0xff6a2a,
    frost: 0x6fd6ff,
    shock: 0xffe24a,
    holy: 0xffe6a0,
    toxic: 0x9cff3b,
    void: 0xb14bff,
    arcane: 0x8f6aff,
  };

  private beginCombatFeedbackFrame(): void {
    this.hitVfxSpent = 0;
    this.feedbackStopMs = 0;
    this.feedbackStopTier = 0;
    this.feedbackStopCount = 0;
    this.feedbackFinalBlows = 0;
    this.feedbackShakeDuration = 0;
    this.feedbackShakeIntensity = 0;
    this.feedbackPunchX = 0;
    this.feedbackPunchY = 0;
    this.finalBlowPresentations.clear();
    this.finalDeltaTargets.clear();
    this.combatFeedback.beginFrame(this.time.now);
    this.damageNumberRenderer.beginFrame();
  }

  private drainCombatFeedback(): void {
    if (!this.room) return;
    const state = this.room.state as ArenaState & ArenaDamageAttribution;
    this.combatFeedback.drainReceipts(
      state.combatReceipts as unknown as CombatReceiptRows | undefined,
      this.room.sessionId,
      this.time.now,
    );
    this.flushReceiptFeel();
  }

  private resolveFeedbackTarget(targetId: string, out: { x: number; y: number }): boolean {
    const enemy = this.enemies.get(targetId);
    if (enemy) {
      out.x = enemy.x;
      out.y = enemy.y;
      return true;
    }
    const player = this.blobs.get(targetId);
    if (player) {
      out.x = player.x;
      out.y = player.y;
      return true;
    }
    if (!targetId.startsWith("worm:")) return false;
    const parts = targetId.split(":");
    const slot = Number.parseInt(parts[1] ?? "", 10);
    const generation = Number.parseInt(parts[2] ?? "", 10);
    const row = Number.isFinite(slot) ? this.room?.state.wormBoss.segments[slot] : undefined;
    if (!row || row.generation !== generation) return false;
    out.x = row.x;
    out.y = this.belt ? this.beltY(row.y) : row.y;
    return true;
  }

  private onDamageNumberEvent(event: DamageNumberEvent): void {
    this.damageNumberRenderer.add(event, this.time.now);
  }

  /** Receipt-owned lightning link. The server receipt's direction is measured from the projectile-contact
   * seed to this hop, so the arc remains authoritative without inventing a client-side target chain. */
  private spawnChainLightningReceipt(event: HitContactEvent, x: number, y: number): void {
    const color = WEAPONS[event.weaponId]?.gun?.projectileColor ?? 0x5dd6ff;
    const length = 90;
    const dirLength = Math.hypot(event.dirX, event.dirY) || 1;
    const dx = event.dirX / dirLength;
    const dy = event.dirY / dirLength;
    const startX = x - dx * length;
    const startY = y - dy * length;
    const points: Array<{ x: number; y: number }> = [];
    for (let index = 0; index <= 7; index++) {
      const fraction = index / 7;
      const jitter =
        index === 0 || index === 7
          ? 0
          : Math.sin(event.tick * 0.91 + index * 4.37 + event.targetId.length) * 8;
      points.push({
        x: startX + dx * length * fraction - dy * jitter,
        y: startY + dy * length * fraction + dx * jitter,
      });
    }
    const graphics = this.add
      .graphics()
      .setDepth(IMPACT_RING_DEPTH + 1)
      .setBlendMode(Phaser.BlendModes.ADD);
    const stroke = (width: number, strokeColor: number, alpha: number) => {
      graphics.lineStyle(width, strokeColor, alpha).beginPath().moveTo(points[0]!.x, points[0]!.y);
      for (let index = 1; index < points.length; index++)
        graphics.lineTo(points[index]!.x, points[index]!.y);
      graphics.strokePath();
    };
    stroke(7, color, 0.28);
    stroke(2, 0xe9f7ff, 0.92);
    this.tweens.add({
      targets: graphics,
      alpha: 0,
      duration: Math.max(90, WEAPONS[event.weaponId]?.chainLightning?.vfx?.life ?? 160),
      onComplete: () => graphics.destroy(),
    });
  }

  private onCombatFeedbackContact(event: HitContactEvent): void {
    if (event.finalBlow && event.sourcePlayerId)
      this.petRigs.get(event.sourcePlayerId)?.onOwnerKill(this.time.now);
    const point = this.enemySample;
    const resolved = this.resolveFeedbackTarget(event.targetId, point);
    const x = resolved ? point.x : event.x;
    const y = resolved ? point.y : event.y;
    if (!resolved && event.x === 0 && event.y === 0) return;
    const rig = this.enemies.get(event.targetId);
    const reducedFlash = this.feedbackSettings.flashes === "reduced";
    const color = ArenaScene.ELEMENT_SPARK[event.element] ?? 0xd6dde6;
    if (event.delivery === CombatDelivery.Chain && this.feedbackSettings.hitSparks)
      this.spawnChainLightningReceipt(event, x, y);
    this.ultimateVfx.onReceipt({
      sourcePlayerId: event.sourcePlayerId,
      targetId: event.targetId,
      weaponId: event.weaponId,
      delivery: event.delivery,
      tick: event.tick,
      crit: event.crit,
      finalBlow: event.finalBlow,
      x,
      y,
    });

    if (event.layer === "instant") {
      if (this.feedbackSettings.hitSparks)
        this.hitEffectRenderer.spark(
          x,
          y,
          event.dirX,
          event.dirY,
          color,
          false,
          reducedFlash,
          0.72,
        );
      rig?.flash(reducedFlash ? 45 : 65, reducedFlash ? 0xdedede : 0xffffff);
      return;
    }

    this.applyReceiptFlinch(event, rig);
    const mode = this.hitEffectRenderer.registerContact(
      event.targetId,
      x,
      y,
      event.dirX,
      event.dirY,
      color,
      this.animClock,
    );
    const fullReceipt = event.layer === "full" || event.layer === "ambient";
    const breakthrough = event.crit || event.finalBlow;
    const visible = this.cameras.main.worldView.contains(x, y);

    const impactRecipe = resolveWeaponEffectRecipe(WEAPONS[event.weaponId]);
    if (fullReceipt && impactRecipe?.impactAnchor === "target")
      spawnWeaponProjectileImpact(this, impactRecipe, x, y, Math.atan2(event.dirY, event.dirX));

    if (fullReceipt) {
      if (mode === "shimmer") rig?.flash(350, reducedFlash ? 0xdedede : color);
      else rig?.flash(reducedFlash ? 55 : 80, reducedFlash ? 0xdedede : 0xffffff);
      if (mode !== "shimmer" || breakthrough)
        this.audio.play(event.damage >= 40 || event.crit ? "bighit" : "hit", {
          x,
          amt: Math.min(1, event.damage / 45),
        });
    }

    if (this.feedbackSettings.hitSparks && (breakthrough || (fullReceipt && mode !== "shimmer"))) {
      const scale = (mode === "thinned" ? 0.7 : 1) * (event.selfHit ? 1 : 0.85);
      this.hitEffectRenderer.spark(
        x,
        y,
        event.dirX,
        event.dirY,
        color,
        event.crit,
        reducedFlash,
        scale,
      );
    }
    if (
      fullReceipt &&
      mode === "discrete" &&
      visible &&
      this.feedbackSettings.hitSparks &&
      this.hitVfxSpent < HIT_VFX_BUDGET
    ) {
      const enemyState = this.room?.state.enemies.get(event.targetId);
      const radius = enemyState
        ? (ENEMY_KINDS[enemyState.kind]?.radius ?? ENEMY_RADIUS) *
          (enemyState.tough ? TOUGH_SCALE : 1)
        : ENEMY_RADIUS;
      spawnImpactFlipbook(this, x, y, radius, event.element);
      this.hitVfxSpent++;
    }

    if (event.crit && this.feedbackSettings.hitSparks) {
      this.hitEffectRenderer.critStar(
        event.targetId,
        x,
        y,
        event.dirX,
        event.dirY,
        this.animClock,
        reducedFlash,
      );
      rig?.flash(reducedFlash ? 90 : 150, reducedFlash ? 0xdedede : 0xffdb63);
      if (event.selfHit) {
        this.spawnImpactRing(x, y);
        if (!reducedFlash) this.spawnSpeedLines(x, y, true);
      }
    } else if (event.damage >= 40 && fullReceipt && event.selfHit) {
      this.spawnImpactRing(x, y);
      if (!reducedFlash) this.spawnSpeedLines(x, y, false);
    }

    if (event.finalBlow) {
      this.finalBlowPresentations.set(event.targetId, {
        dirX: event.dirX,
        dirY: event.dirY,
        weaponId: event.weaponId,
        element: event.element,
        selfHit: event.selfHit,
      });
      // A removed row has an authoritative terminal HP of zero. The shown amount is the last observed
      // authoritative HP -> zero transition, never receipt.damage (which may overkill).
      const previousHp = this.enemyHp.get(event.targetId);
      if (
        previousHp !== undefined &&
        previousHp > 0 &&
        !this.room?.state.enemies.has(event.targetId) &&
        !this.finalDeltaTargets.has(event.targetId)
      ) {
        this.finalDeltaTargets.add(event.targetId);
        this.combatFeedback.ingestHpDelta(
          {
            targetId: event.targetId,
            damage: previousHp,
            x,
            y: y - 26,
            visible,
          },
          this.time.now,
        );
      }
    }
    if (event.selfHit) this.queueReceiptFeel(event);
  }

  private applyReceiptFlinch(event: HitContactEvent, rig: SpriteRig | undefined): void {
    if (!rig) return;
    const length = Math.hypot(event.dirX, event.dirY) || 1;
    const rapid = this.isRapidDelivery(event.delivery);
    const magnitude = event.crit ? 11 : rapid ? 3 : event.damage >= 40 ? 8 : 5;
    let state = this.enemyFlinches.get(event.targetId);
    if (!state) {
      state = { x: 0, y: 0, appliedX: 0, appliedY: 0 };
      this.enemyFlinches.set(event.targetId, state);
    }
    const oldAppliedX = state.appliedX;
    const oldAppliedY = state.appliedY;
    state.x += (event.dirX / length) * magnitude;
    state.y += (event.dirY / length) * magnitude;
    const total = Math.hypot(state.x, state.y);
    if (total > 14) {
      state.x = (state.x / total) * 14;
      state.y = (state.y / total) * 14;
    }
    rig.root.x += state.x - oldAppliedX;
    rig.root.y += state.y - oldAppliedY;
    state.appliedX = state.x;
    state.appliedY = state.y;
  }

  private stepEnemyFlinches(deltaMs: number): void {
    const decay = Math.exp(-Math.max(0, deltaMs) / 45);
    for (const [targetId, state] of this.enemyFlinches) {
      const rig = this.enemies.get(targetId);
      if (!rig) {
        this.enemyFlinches.delete(targetId);
        continue;
      }
      state.appliedX = 0;
      state.appliedY = 0;
      state.x *= decay;
      state.y *= decay;
      if (Math.hypot(state.x, state.y) < 0.05) {
        this.enemyFlinches.delete(targetId);
        continue;
      }
      rig.root.x += state.x;
      rig.root.y += state.y;
      state.appliedX = state.x;
      state.appliedY = state.y;
    }
  }

  private isRapidDelivery(delivery: number): boolean {
    return (
      delivery === CombatDelivery.Beam ||
      delivery === CombatDelivery.Ultimate ||
      delivery === CombatDelivery.Scatter ||
      delivery === CombatDelivery.Gun ||
      delivery === CombatDelivery.Chain ||
      delivery === CombatDelivery.Cast
    );
  }

  private queueReceiptFeel(event: HitContactEvent): void {
    const paperPriority = event.targetId.startsWith("worm:")
      ? 2
      : (this.enemyPaperPriority.get(event.targetId) ?? 0);
    const directionLength = Math.hypot(event.dirX, event.dirY) || 1;
    let shakeDuration = 0;
    let shakeIntensity = 0;
    let punch = 0;
    if (event.finalBlow) {
      shakeDuration = paperPriority >= 1 ? 110 : 70;
      shakeIntensity = paperPriority >= 1 ? 0.0045 : 0.003;
      punch = paperPriority >= 2 ? 8 : 5;
      if (!this.isRapidDelivery(event.delivery)) this.feedbackFinalBlows++;
    } else if (event.crit) {
      shakeDuration = 90;
      shakeIntensity = 0.0038;
      punch = 4;
    } else if (event.damage >= 40) {
      shakeDuration = 60;
      shakeIntensity = 0.0022;
      punch = 3;
    }
    if (shakeIntensity > this.feedbackShakeIntensity) {
      this.feedbackShakeDuration = shakeDuration;
      this.feedbackShakeIntensity = shakeIntensity;
    }
    if (punch > Math.hypot(this.feedbackPunchX, this.feedbackPunchY)) {
      this.feedbackPunchX = (event.dirX / directionLength) * punch;
      this.feedbackPunchY = (event.dirY / directionLength) * punch;
    }

    // T0 is absolute: beam and rapid delivery receipts can shimmer, flinch, sound and shake, but freeze 0ms.
    if (this.isRapidDelivery(event.delivery)) return;
    if (paperPriority >= 2 && event.finalBlow) {
      this.hitStop(160, true);
      return;
    }
    let duration = 0;
    let tier = 0;
    if (event.finalBlow) {
      duration = paperPriority === 1 ? 80 : 45;
      tier = 4;
    } else if (event.delivery === CombatDelivery.Quake || event.delivery === CombatDelivery.Parry) {
      return;
    } else if (event.crit) {
      duration = 70;
      tier = 3;
    } else if (event.damage >= 40) {
      duration = 50;
      tier = 2;
    } else if (event.delivery === CombatDelivery.Melee) {
      duration = 30;
      tier = 1;
    }
    if (duration <= 0) return;
    this.feedbackStopCount++;
    if (duration > this.feedbackStopMs) {
      this.feedbackStopMs = duration;
      this.feedbackStopTier = tier;
    }
  }

  private flushReceiptFeel(): void {
    const now = this.time.now;
    if (this.feedbackFinalBlows >= 3) {
      this.feedbackStopMs = 95;
      this.feedbackStopTier = 5;
      this.feedbackStopCount = Math.max(this.feedbackStopCount, this.feedbackFinalBlows);
      this.feedbackShakeDuration = 140;
      this.feedbackShakeIntensity = 0.006;
    }
    if (this.feedbackStopMs > 0) {
      const refractory = this.feedbackStopTier === 5 ? 250 : this.feedbackStopTier === 4 ? 110 : 90;
      const lastAt = this.feedbackStopAt.get(this.feedbackStopTier) ?? -1e9;
      if (now - lastAt >= refractory) {
        const extra = Math.min(24, Math.max(0, this.feedbackStopCount - 1) * 8);
        this.feedbackStopAt.set(this.feedbackStopTier, now);
        this.hitStop(Math.min(95, this.feedbackStopMs + extra));
      }
    }
    if (this.feedbackShakeIntensity > 0)
      this.shakeCam(this.feedbackShakeDuration, this.feedbackShakeIntensity, "player-weapon");
    if (
      Math.hypot(this.feedbackPunchX, this.feedbackPunchY) > 0 &&
      now - this.lastCameraPunchAt >= 90
    ) {
      // Directional hit-confirm punch is camera motion too; budget it beside stochastic shake so a future
      // receipt cannot restore the heavy player-weapon jolt through this non-Phaser channel.
      this.cameraPunchX = budgetedCameraShakeIntensity(this.feedbackPunchX, "player-weapon");
      this.cameraPunchY = budgetedCameraShakeIntensity(this.feedbackPunchY, "player-weapon");
      this.lastCameraPunchAt = now;
    }
  }

  private stepCameraPunch(deltaMs: number): void {
    const decay = Math.exp(-Math.max(0, deltaMs) / 35);
    this.cameraPunchX *= decay;
    this.cameraPunchY *= decay;
    if (Math.hypot(this.cameraPunchX, this.cameraPunchY) < 0.02) {
      this.cameraPunchX = 0;
      this.cameraPunchY = 0;
    }
  }

  private hitStop(ms: number, priority = false): void {
    if (!this.feedbackSettings?.hitStop || prefersReducedPaperMotion()) return;
    ms = Math.max(0, Math.min(160, ms));
    const now = this.time.now;
    if (!priority) {
      // Refill the bucket at BUDGET/WINDOW per ms since the last spend, then reject if this freeze would
      // overflow it. (Priority freezes bypass the bucket AND don't deplete it — the skill beats are sacred.)
      const refill =
        ((now - this.freezeSpentAt) * ArenaScene.FREEZE_BUDGET_MS) / ArenaScene.FREEZE_WINDOW_MS;
      this.freezeSpent = Math.max(0, this.freezeSpent - refill);
      this.freezeSpentAt = now;
      if (this.freezeSpent + ms > ArenaScene.FREEZE_BUDGET_MS) return; // over budget — skip this crunch
      this.freezeSpent += ms;
    }
    this.frozenUntil = Math.max(this.frozenUntil, now + ms);
  }

  /** §7 v0.105 de-clunk — PRIORITIZED camera shake. Phaser's `ShakeEffect` ignores a new shake while one is
   *  already running unless `force` is passed, and every call site omitted it — so while the gun's per-shot
   *  shake ran (up to 70% duty on a gatling), got-hit / boss-slam / fall / explosion shakes were silently
   *  swallowed. Route every shake here: one at least as strong as the running shake FORCE-restarts (the
   *  important hit always lands); a weaker one is dropped (a tracer stream can't stomp a boss slam). */
  private requestVastagharShake(
    x: number,
    y: number,
    durationMs: number,
    intensity: number,
    tier: 1 | 2 | 3,
    localThreatened: boolean,
  ): void {
    // Camera ownership is never reassigned. A local danger read also suppresses boss weather entirely so
    // dodge/parry/hurt feedback keeps the camera; distant impacts fall off like ally-ultimate weather.
    if (localThreatened) return;
    const view = this.cameras.main.worldView;
    const distance = Math.hypot(x - view.centerX, y - view.centerY);
    const falloff = Math.max(0, Math.min(1, 1 - distance / 1_050));
    if (falloff <= 0.08) return;
    const scaledDuration = durationMs * (0.55 + falloff * 0.45);
    const scaledIntensity = intensity * falloff;
    if (!this.vastagharShakeBudget.accept(this.time.now, scaledDuration, scaledIntensity, tier))
      return;
    this.shakeCam(scaledDuration, scaledIntensity, "world");
  }

  /** V5G1 global camera mixer. Every caller declares its origin; only player-weapon requests spend the
   * owner-mandated 5% amplitude budget. World shakes (bosses, movement, hurt, enemy attacks, ultimates) are
   * intentionally unchanged, and priority compares the final admitted amplitudes. */
  shakeCam(duration: number, rawIntensity: number, source: CameraShakeSource): void {
    const motionScale = prefersReducedPaperMotion() ? 0 : (this.feedbackSettings?.screenShake ?? 1);
    const intensity =
      budgetedCameraShakeIntensity(rawIntensity, source) *
      motionScale *
      this.ultimateExplosionShakeScale;
    if (intensity <= 0) return;
    const now = this.time.now;
    if (now >= this.shakeUntil || intensity >= this.shakeIntensity) {
      this.cameras.main.shake(duration, intensity, true);
      this.shakeUntil = now + duration;
      this.shakeIntensity = intensity;
    }
  }

  private clearDamageRecapEntry(entry: DamageRecapEntry): void {
    entry.sourceKind = "";
    entry.sourceId = "";
    entry.sourceLabel = "";
    entry.damageType = "";
    entry.amount = 0;
    entry.parryable = -1;
    entry.telegraphKind = "";
    entry.receiptKey = "";
    entry.tick = 0;
    entry.recordedAtMs = -9999;
  }

  private resetDeathRecap(): void {
    this.clearDamageRecapEntry(this.deathRecap[0]);
    this.clearDamageRecapEntry(this.deathRecap[1]);
    this.lastDamageReceiptKey = "";
    this.damageReceiptSeqBySlot.clear();
  }

  private copyDamageRecapEntry(target: DamageRecapEntry, source: DamageRecapEntry): void {
    target.sourceKind = source.sourceKind;
    target.sourceId = source.sourceId;
    target.sourceLabel = source.sourceLabel;
    target.damageType = source.damageType;
    target.amount = source.amount;
    target.parryable = source.parryable;
    target.telegraphKind = source.telegraphKind;
    target.receiptKey = source.receiptKey;
    target.tick = source.tick;
    target.recordedAtMs = source.recordedAtMs;
  }

  private recordDamageRecap(
    sourceKind: string,
    sourceId: string,
    sourceLabel: string,
    damageType: string,
    amount: number,
    parryable: boolean | number | undefined,
    telegraphKind: string | number | undefined,
    receiptKey: string,
    tick: number,
  ): void {
    if (receiptKey && receiptKey === this.lastDamageReceiptKey) return;
    const latest = this.deathRecap[0];
    if (tick > 0 && latest.tick > tick) return;
    this.copyDamageRecapEntry(this.deathRecap[1], latest);
    latest.sourceKind = sourceKind;
    latest.sourceId = sourceId;
    latest.sourceLabel = sourceLabel;
    latest.damageType = damageType;
    latest.amount = Math.max(0, amount);
    latest.parryable =
      parryable === undefined
        ? -1
        : parryable === true || (typeof parryable === "number" && parryable > 0)
          ? 1
          : 0;
    latest.telegraphKind = telegraphKind === undefined ? "" : String(telegraphKind);
    latest.receiptKey = receiptKey;
    latest.tick = tick;
    latest.recordedAtMs = this.time.now;
    this.lastDamageReceiptKey = receiptKey;
  }

  /** Accept either the dedicated damage ring or the broader hit ring being added by the server wave. */
  private captureSyncedDamageReceipts(selfId: string): void {
    const state = this.room?.state as (ArenaState & ArenaDamageAttribution) | undefined;
    const rows = state?.damageReceipts ?? state?.hitReceipts ?? state?.combatReceipts;
    if (!rows) return;
    rows.forEach((row, id) => {
      if ((row.targetPlayerId ?? row.targetId ?? row.target) !== selfId) return;
      const amount = row.damage ?? row.amount ?? row.value ?? 0;
      if (!(amount > 0)) return;
      const tick = row.tick ?? state?.tick ?? 0;
      const seq = row.seq ?? tick;
      if (seq === 0) return;
      if (this.damageReceiptSeqBySlot.get(id) === seq) return;
      if (!this.damageReceiptSeqBySlot.has(id) && this.damageReceiptSeqBySlot.size >= 64)
        this.damageReceiptSeqBySlot.clear();
      this.damageReceiptSeqBySlot.set(id, seq);
      const receiptKey = `receipt:${id}:${seq}`;
      const delivery = damageDeliveryKind(row.delivery);
      const weaponName = row.weaponId ? (WEAPONS[row.weaponId]?.name ?? "") : "";
      this.recordDamageRecap(
        row.sourceKind || row.kind || delivery || row.damageType || "attack",
        row.sourceId || row.sourcePlayerId || "",
        row.sourceLabel || row.source || weaponName,
        row.damageType || delivery,
        amount,
        row.parryable,
        row.telegraphKind,
        receiptKey,
        tick,
      );
    });
  }

  /** Read the append-only PlayerState variant without requiring this client wave to own shared schema. */
  private capturePlayerDamageAttribution(self: PlayerState, amount: number): boolean {
    const row = self as PlayerState & SyncedDamageAttribution;
    const sourceKind =
      row.lastDamageSourceKind ??
      row.damageSourceKind ??
      row.deathSourceKind ??
      row.lastDamageKind ??
      row.lastDamageSource ??
      row.deathSource ??
      row.downedByKind ??
      "";
    const sourceId =
      row.lastDamageSourceId ?? row.damageSourceId ?? row.deathSourceId ?? row.downedById ?? "";
    const sourceLabel =
      row.lastDamageSourceLabel ?? row.damageSourceLabel ?? row.deathSourceLabel ?? "";
    const damageType = row.lastDamageType ?? row.damageType ?? row.deathDamageType ?? "";
    const candidateAmount =
      row.lastDamageAmount ?? row.damageAmount ?? row.deathDamage ?? row.downedByDamage;
    const syncedAmount =
      candidateAmount !== undefined && candidateAmount > 0 ? candidateAmount : amount;
    const parryable =
      row.lastDamageParryable ??
      row.damageParryable ??
      row.deathParryable ??
      row.downedByParryable ??
      undefined;
    const telegraphKind =
      row.lastDamageTelegraphKind ?? row.damageTelegraphKind ?? row.deathTelegraphKind ?? undefined;
    if (!sourceKind && !sourceId && !sourceLabel && !damageType) return false;
    const tick = this.room?.state.tick ?? 0;
    const recent = this.deathRecap[0];
    if (recent.receiptKey.startsWith("receipt:") && tick - recent.tick <= 1) return true;
    const seq = row.lastDamageSeq ?? row.damageSeq ?? row.deathSeq ?? tick;
    this.recordDamageRecap(
      sourceKind || damageType || "attack",
      sourceId,
      sourceLabel,
      damageType,
      syncedAmount,
      parryable,
      telegraphKind,
      `player:${seq}:${tick}`,
      tick,
    );
    return true;
  }

  /** Best client-side fallback for old servers: pit edge, resolved footprint, pool, then nearby contact. */
  private inferDamageAttribution(self: PlayerState, amount: number): void {
    const tick = this.room?.state.tick ?? 0;
    if (self.fellSeq !== this.observedSelfFellSeq) {
      this.recordDamageRecap(
        "pit",
        "",
        "Pit Fall",
        "fall",
        amount,
        false,
        undefined,
        `inferred:pit:${self.fellSeq}`,
        tick,
      );
      return;
    }
    if (this.time.now - this.recentResolvedDangerAt <= TICK_MS * 3) {
      const kind = this.recentResolvedDangerKind;
      this.recordDamageRecap(
        kind,
        "",
        "",
        kind,
        amount,
        kind === "melee" || kind === "quake",
        kind,
        `inferred:telegraph:${tick}`,
        tick,
      );
      return;
    }
    let zoneId = "";
    this.room?.state.zones.forEach((zone, id) => {
      if (!zoneId && (self.x - zone.x) ** 2 + (self.y - zone.y) ** 2 <= zone.radius ** 2)
        zoneId = id;
    });
    if (zoneId) {
      this.recordDamageRecap(
        "pool",
        zoneId,
        "Acid Pool",
        "zone",
        amount,
        false,
        "pool",
        `inferred:pool:${tick}`,
        tick,
      );
      return;
    }
    let enemyId = "";
    let best = Number.POSITIVE_INFINITY;
    this.room?.state.enemies.forEach((enemy, id) => {
      const radius = (ENEMY_KINDS[enemy.kind]?.radius ?? ENEMY_RADIUS) + 52;
      const distance = (self.x - enemy.x) ** 2 + (self.y - enemy.y) ** 2;
      if (distance <= radius * radius && distance < best) {
        best = distance;
        enemyId = id;
      }
    });
    this.recordDamageRecap(
      enemyId ? "contact" : "attack",
      enemyId,
      "",
      enemyId ? "contact" : "",
      amount,
      enemyId ? false : undefined,
      undefined,
      `inferred:${enemyId || "attack"}:${tick}`,
      tick,
    );
  }

  /** Hit feedback driven off authoritative state diffs: enemy hp drops → flash + damage number;
   *  local player hp drops → flash + screen shake (§20 game-feel from day one). */
  private updateCombatFx(): void {
    if (!this.room) return;
    const hits: Array<{
      id: string;
      rig: SpriteRig;
      dmg: number;
      crit: boolean;
      visible: boolean;
    }> = [];
    this.room.state.enemies.forEach((enemy, id) => {
      const prev = this.enemyHp.get(id);
      if (prev !== undefined && enemy.hp < prev) {
        const rig = this.enemies.get(id);
        if (rig) {
          const dmg = prev - enemy.hp;
          // §30 CRIT: the synced critFlash counter ticked this frame → this hit was a critical. Gold number,
          // a gold flash, extra hit-stop + a shock ring — a crit lands with weight even on a small number.
          const crit = (this.enemyCrit.get(id) ?? enemy.critFlash) !== enemy.critFlash;
          hits.push({
            id,
            rig,
            dmg,
            crit,
            visible: this.cameras.main.worldView.contains(rig.x, rig.y),
          });
        }
      }
      this.enemyHp.set(id, enemy.hp);
      this.enemyCrit.set(id, enemy.critFlash);
    });
    // Only horde-scale frames reorder: on-camera hits spend the finite full-stack + label budgets before
    // invisible enemies. Stable sort preserves authoritative iteration order within each visibility band.
    if (hits.length > HIT_VFX_BUDGET) hits.sort((a, b) => Number(b.visible) - Number(a.visible));
    for (const { id, rig, dmg, crit, visible } of hits) {
      // DIGIT HONESTY: this exact authoritative state delta is the sole arithmetic input. Receipts have
      // already been drained and may decorate it, but receipt.damage can never construct a label.
      this.combatFeedback.ingestHpDelta(
        {
          targetId: id,
          damage: dmg,
          x: rig.x,
          y: rig.y - 26,
          visible,
        },
        this.time.now,
      );

      // A receipt and its HP mutation share one patch. The receipt-driven path already spent the contact
      // stack, so the legacy diff path becomes a residual/old-server fallback instead of a double effect.
      if (this.combatFeedback.wasReceiptTouched(id)) continue;
      const big = dmg >= 40; // top damage band — a crushing blow (visual/audio ONLY, no balance change)
      const reducedFlash = this.feedbackSettings.flashes === "reduced";
      rig.flash(
        reducedFlash ? 55 : crit ? 150 : big ? 120 : 80,
        reducedFlash ? 0xdedede : crit ? 0xffdb63 : 0xffffff,
      );
      let bx = rig.x - 100;
      let by = rig.y;
      let best = Number.POSITIVE_INFINITY;
      let nearestId = "";
      this.blobs.forEach((b, bid) => {
        const d = (rig.x - b.x) ** 2 + (rig.y - b.y) ** 2;
        if (d < best) {
          best = d;
          bx = b.x;
          by = b.y;
          nearestId = bid;
        }
      });
      // The synced nearest player is the same best-available attacker attribution used for blow direction;
      // resolve THAT equipped weapon's element for both the old sparks and the new direct-hit flipbook.
      const attacker = this.room?.state.players.get(nearestId);
      const hitWeapon = attacker ? WEAPONS[attacker.weapon] : undefined;
      const hitEl = hitWeapon?.tags?.element;
      const tint = ArenaScene.ELEMENT_SPARK[hitEl ?? ""] ?? 0xfff2c0;
      const directionLength = Math.hypot(rig.x - bx, rig.y - by) || 1;
      const dirX = (rig.x - bx) / directionLength;
      const dirY = (rig.y - by) / directionLength;
      const mode = this.hitEffectRenderer.registerContact(
        id,
        rig.x,
        rig.y,
        dirX,
        dirY,
        tint,
        this.animClock,
      );
      if (mode !== "shimmer")
        this.audio.play(crit || big ? "bighit" : "hit", {
          x: rig.x,
          amt: Math.min(1, dmg / 45),
        });
      if (this.feedbackSettings.hitSparks && mode !== "shimmer")
        this.hitEffectRenderer.spark(
          rig.x,
          rig.y,
          dirX,
          dirY,
          tint,
          crit,
          reducedFlash,
          mode === "thinned" ? 0.7 : 1,
        );
      if (this.feedbackSettings.hitSparks && crit)
        this.hitEffectRenderer.critStar(id, rig.x, rig.y, dirX, dirY, this.animClock, reducedFlash);
    }

    // Slide null-whiffs have their own quiet edge. They never share parry sparks, audio, chain, or run-up.
    this.room.state.players.forEach((p, id) => {
      const previous = this.lastDodged.get(id);
      this.lastDodged.set(id, p.dodgedSeq);
      if (previous === undefined || previous === p.dodgedSeq) return;
      const rig = this.blobs.get(id);
      this.jumpEffectRenderer.spawnSlideWhiff(
        rig?.x ?? p.x,
        (rig?.y ?? (this.belt ? this.beltY(p.y) : p.y)) + PLAYER_SHADOW_LOCAL_Y,
        this.belt ? BELT_FORESHORTEN : 1,
      );
      this.audio.play("slide:whiff", {
        x: rig?.x ?? p.x,
        amt: id === this.room?.sessionId ? 0.55 : 0.24,
      });
    });

    // §8 successful-parry flash (Stage C): a white burst when ANY player parries a telegraphed attack;
    // the LOCAL player's parry cooldown refreshes (§8 flow) so they can immediately parry the next swing.
    this.room.state.players.forEach((p, id) => {
      const prev = this.lastParried.get(id);
      this.lastParried.set(id, p.parriedSeq);
      if (prev !== undefined && prev !== p.parriedSeq) {
        this.spawnParrySpark(p.x, p.y);
        const isSelf = id === this.room?.sessionId;
        // §19 the parry ding is the crispest sound in the game — full for your own, quieter for a mate's.
        this.audio.play("parry", { x: p.x, amt: isSelf ? 1 : 0.4 });
        if (isSelf) {
          this.localParryCd = Math.min(this.localParryCd, PARRY_CHAIN_CD);
          this.hitStop(100, true); // H3 §20: the parry is the skill beat — always freeze (bypass the budget)
          // §8 v0.114 PARRY COMBO — mirror the server's chain: a parry within the window extends it; a lapse
          // restarts at 1. From 2 up we pop "PARRY ×N" (brighter/bigger as it climbs) so the chain reads,
          // and at RIPOSTE_AT the flourish reads as the riposte moment the server just dealt.
          const now = this.time.now;
          this.parryChain =
            now - this.parryChainAt <= PARRY_CHAIN_WINDOW * 1000 ? this.parryChain + 1 : 1;
          this.parryChainAt = now;
          if (this.parryChain >= 2) this.spawnComboPop(p.x, p.y, this.parryChain);
        }
      }
    });

    const selfId = this.room.sessionId;
    const self = selfId ? this.room.state.players.get(selfId) : undefined;
    if (self) {
      this.captureSyncedDamageReceipts(selfId);
      const damageTaken = this.prevSelfHp >= 0 ? this.prevSelfHp - self.hp : 0;
      if (damageTaken > 0.01) {
        const selfRig = this.blobs.get(selfId);
        if (selfRig)
          this.combatFeedback.ingestHpDelta(
            {
              targetId: selfId,
              damage: damageTaken,
              x: selfRig.x,
              y: selfRig.y - 26,
              visible: true,
              selfDamage: true,
            },
            this.time.now,
          );
        const attributed = this.capturePlayerDamageAttribution(self, damageTaken);
        const latest = this.deathRecap[0];
        if (
          !attributed &&
          !(latest.receiptKey.startsWith("receipt:") && this.time.now - latest.recordedAtMs <= 120)
        )
          this.inferDamageAttribution(self, damageTaken);
      }
      if (
        this.prevSelfHp >= 0 &&
        self.hp < this.prevSelfHp - 0.01 &&
        this.time.now - this.lastHurt > 180
      ) {
        this.blobs.get(selfId)?.flash();
        this.shakeCam(100, 0.005, "world");
        // §19 a muffled "oof" scaled by the damage taken; §20 punch the low-HP vignette on the hit.
        this.audio.play("hurt", {
          amt: Math.min(1, (this.prevSelfHp - self.hp) / self.maxHp / 0.2),
        });
        this.hurtFlash = 1;
        this.lastHurt = this.time.now;
      }
      this.prevSelfHp = self.hp;
      this.observedSelfFellSeq = self.fellSeq;

      // Level-up celebration (§12): gold burst on the drifter + a screen toast.
      if (this.prevLevel >= 0 && self.level > this.prevLevel) {
        const rig = this.blobs.get(selfId);
        if (rig) this.spawnLevelUp(rig.x, rig.y);
        this.audio.play("levelup");
      }
      this.prevLevel = self.level;

      // §10 v0.104 the mystery-grab REVEAL: when the held loot identity changes to something with a
      // tier OR an affix, banner it in the tier's color — "RARE KEEN NEON KATANA" is the dopamine beat.
      // (An affixed Common still reveals — ~a third of drops are Common with a real affix.)
      const heldKey = `${self.weapon}:${self.weaponRarity}:${self.weaponAffix}`;
      if (!this.beamHelpShown && WEAPONS[self.weapon]?.beam) {
        this.beamHelpShown = true;
        this.flashBanner(
          "[RMB] Hold to charge and channel\nRelease before Drive empties · Refill to restart",
          "#8fe9ff",
        );
      }
      if (
        this.prevHeldLoot !== "" &&
        heldKey !== this.prevHeldLoot &&
        (self.weaponRarity > 0 || self.weaponAffix !== "")
      ) {
        const rar = RARITIES[self.weaponRarity];
        const tierName = self.weaponRarity > 0 ? `${rar?.name ?? ""} ` : "";
        const affix = self.weaponAffix ? `${affixById(self.weaponAffix).name} ` : "";
        const name = WEAPONS[self.weapon]?.name ?? self.weapon;
        this.flashBanner(
          `${tierName}${affix}${name}`,
          `#${(rar?.color ?? 0xffd479).toString(16).padStart(6, "0")}`,
        );
        // §19 the loot chime rises in pitch with rarity — a Legendary literally sounds better than a Common.
        this.audio.play("loot", { amt: self.weaponRarity / 6 });
      }
      this.prevHeldLoot = heldKey;
    }
  }

  /** §19 v0.108 a crushing-blow shock ring — a quick white expanding ring on a top-band (BIG-HIT) damage
   *  instance, so a heavy hit reads at a glance. Cosmetic; fired only on the ≥40 damage band. */
  private spawnImpactRing(x: number, y: number): void {
    const ring = this.add
      .circle(x, y, 14)
      .setStrokeStyle(4, 0xfff2c0, 0.9)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(IMPACT_RING_DEPTH);
    this.tweens.add({
      targets: ring,
      scale: 2.8,
      alpha: 0,
      duration: 240,
      ease: "Quad.easeOut",
      onComplete: () => ring.destroy(),
    });
  }

  /** §36 v0.118 (game-feel research) — a DIRECTIONAL contact spark on every damaging hit: a short fan of
   *  additive steel slivers thrown along the blow vector + a tiny white core pop, so even a small number
   *  reads as steel biting. Gold + a wider/hotter fan on crits. The impact RING (spawnImpactRing) stays
   *  reserved for the big/crit crunch; this is the per-hit contact beat. Cheap (4–6 short-lived quads).
   *  (Uses Math.random — this is pure client render, not the deterministic sim.) */
  private spawnHitSpark(
    x: number,
    y: number,
    dirRad: number,
    crit: boolean,
    tint = 0xfff2c0,
    element?: string,
  ): void {
    const ADD = Phaser.BlendModes.ADD;
    const col = crit ? 0xffdb63 : tint; // crit gold always wins; else the weapon's element tint (steel default)
    const n = crit ? 6 : 4;
    // §41 PAINTED element shards fly with the procedural slivers — a fire hit throws painted embers, frost
    // throws ice shards, physical/unknown throws hot steel (elementPack falls back). No-op until packs load.
    particleBurst(this, elementPack(element, "shard"), x, y, {
      count: crit ? 4 : 2,
      dirRad,
      spread: 0.7,
      speed: 190,
      scaleContract: paintedParticlePixels(crit ? 48 : 36.48),
      lifeMs: 340,
      sink: 10,
    });
    const core = this.add
      .circle(x, y, crit ? 7 : 5, 0xffffff, 0.85)
      .setBlendMode(ADD)
      .setDepth(99995);
    this.tweens.add({
      targets: core,
      scale: 1.8,
      alpha: 0,
      duration: 130,
      onComplete: () => core.destroy(),
    });
    for (let i = 0; i < n; i++) {
      const a = dirRad + (Math.random() - 0.5) * (crit ? 1.6 : 1.2); // cone around the blow vector
      const len = (crit ? 26 : 20) + Math.random() * 16;
      const s = this.add
        .rectangle(x, y, 12, 2.2, col, 0.95)
        .setRotation(a)
        .setBlendMode(ADD)
        .setDepth(99996);
      this.tweens.add({
        targets: s,
        x: x + Math.cos(a) * len,
        y: y + Math.sin(a) * len,
        alpha: 0,
        duration: 150 + Math.random() * 90,
        ease: "Quad.easeOut",
        onComplete: () => s.destroy(),
      });
    }
  }

  /** §36 v0.118 (game-feel research §7) — a brief "focus" burst of radial speed-lines CONVERGING on a heavy
   *  hit: a ring of thin additive streaks that rush inward toward the impact point over ~4–6 frames and fade,
   *  the anime/AAA cue that says "this one mattered". Reserved for big/crit so it never dilutes routine hits;
   *  gold on crit, hot-white otherwise. Screen-space-cheap (8–10 short-lived quads, no camera/zoom math). */
  private spawnSpeedLines(x: number, y: number, crit: boolean): void {
    const ADD = Phaser.BlendModes.ADD;
    const col = crit ? 0xffe27a : 0xffffff;
    const n = crit ? 10 : 8;
    const r0 = 70; // streaks start out here...
    const r1 = 30; // ...and rush in to here as they fade (converging = "focus")
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const line = this.add
        .rectangle(x + c * r0, y + s * r0, 20, 2.4, col, 0.85)
        .setRotation(a) // aligned radially so it reads as a streak pointing at the impact
        .setBlendMode(ADD)
        .setDepth(SPEED_LINE_DEPTH);
      this.tweens.add({
        targets: line,
        x: x + c * r1,
        y: y + s * r1,
        alpha: 0,
        duration: 110 + Math.random() * 50,
        ease: "Quad.easeIn",
        onComplete: () => line.destroy(),
      });
    }
  }

  /** §8 successful-parry flash (Stage C) — a crisp WHITE ring burst + sparks where a player parried a
   *  telegraphed attack (the §8 white parry-language: white = the parry connected). */
  private spawnParrySpark(x: number, y: number): void {
    const ADD = Phaser.BlendModes.ADD;
    const ring = this.add
      .circle(x, y, 16)
      .setStrokeStyle(4, 0xffffff, 0.95)
      .setBlendMode(ADD)
      .setDepth(99996);
    this.tweens.add({
      targets: ring,
      scale: 2.6,
      alpha: 0,
      duration: 260,
      ease: "Quad.easeOut",
      onComplete: () => ring.destroy(),
    });
    const flash = this.add.circle(x, y, 22, 0xffffff, 0.5).setBlendMode(ADD).setDepth(99995);
    this.tweens.add({
      targets: flash,
      scale: 1.4,
      alpha: 0,
      duration: 160,
      onComplete: () => flash.destroy(),
    });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const s = this.add
        .rectangle(x, y, 13, 2.4, 0xffffff, 0.95)
        .setRotation(a)
        .setBlendMode(ADD)
        .setDepth(99996);
      this.tweens.add({
        targets: s,
        x: x + Math.cos(a) * 34,
        y: y + Math.sin(a) * 34,
        alpha: 0,
        duration: 200,
        ease: "Quad.easeOut",
        onComplete: () => s.destroy(),
      });
    }
  }

  /** §8 v0.114 PARRY COMBO pop — a floating "PARRY ×N" that punches up over the drifter, growing bolder as
   *  the chain climbs and flipping to a gold "RIPOSTE!" once the chain reaches the counter-strike threshold. */
  private spawnComboPop(x: number, y: number, chain: number): void {
    const riposte = chain >= PARRY_CHAIN_RIPOSTE_AT;
    const label = riposte ? `RIPOSTE ×${chain}` : `PARRY ×${chain}`;
    const color = riposte ? "#ffd479" : "#bfefff";
    const size = Math.min(15 + chain * 3, 34);
    const txt = this.add
      .text(x, y - 42, label, {
        fontFamily: "monospace",
        fontSize: `${size}px`,
        color,
        fontStyle: "bold",
        stroke: "#0a0a12",
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(99998)
      .setScale(0.5);
    this.tweens.add({
      targets: txt,
      y: y - 78,
      scale: 1,
      duration: 260,
      ease: "Back.easeOut",
    });
    this.tweens.add({
      targets: txt,
      alpha: 0,
      delay: 480,
      duration: 320,
      onComplete: () => txt.destroy(),
    });
  }

  /** Level-up VFX: an expanding gold ring on the player + a brief "LEVEL N" toast. */
  private spawnLevelUp(x: number, y: number): void {
    const ring = this.add.circle(x, y, 24).setStrokeStyle(5, 0xffd479, 0.95).setDepth(99997);
    this.tweens.add({
      targets: ring,
      scale: 4,
      alpha: 0,
      duration: 520,
      ease: "Cubic.easeOut",
      onComplete: () => ring.destroy(),
    });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const spark = this.add.circle(x, y, 4, 0xffe9a8).setDepth(99999);
      this.tweens.add({
        targets: spark,
        x: x + Math.cos(a) * 70,
        y: y + Math.sin(a) * 70 - 20,
        alpha: 0,
        duration: 480,
        ease: "Quad.easeOut",
        onComplete: () => spark.destroy(),
      });
    }
    // §7 v0.105 de-clunk: render ABOVE the level-up modal dim (depth 100010) — the toast used to spawn the
    // same frame the 0.66-alpha dim opens at depth 100003, so ~66% of the celebration was greyed out. No
    // camera shake either: a level-up is a UI beat, not an impact (it fought the combat shake channel).
    const toast = this.add
      .text(this.screenW() / 2, this.screenH() / 2 - 120, "LEVEL UP!", {
        fontSize: "30px",
        color: "#ffd479",
        fontStyle: "bold",
      })
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(100013);
    this.tweens.add({
      targets: toast,
      y: this.screenH() / 2 - 150,
      alpha: 0,
      duration: 900,
      ease: "Cubic.easeOut",
      onComplete: () => toast.destroy(),
    });
  }

  /** One authoritative horizontal Drive bar. Ammo rows, reload copy, and the beam heat arc retire here. */
  private renderDriveHud(
    self: PlayerState | undefined,
    weapon: WeaponDef | undefined,
    barX: number,
    xpY: number,
    scale: number,
  ): void {
    const g = this.driveHudGfx;
    const label = this.driveHudText;
    if (!g || !label) return;
    g.clear();
    label.setVisible(false);
    if (!self || !weapon) return;
    // Reflection law (see addBlob): decoded rows expose only wire fields — read the nested tail row.
    const resource = self.dualWield?.weaponResource;
    if (!resource) return;
    const tick = this.room?.state.tick ?? 0;
    const beamRow = this.room?.state.beams.get(self.id);
    const view = driveHudView({
      valueQ: resource.valueQ,
      regenMode: resource.regenMode,
      beamLockEndTick: resource.beamLockEndTick,
      tick,
      weaponId: weapon.id,
      beamRequireRelease:
        !!weapon.beam &&
        (beamRow?.phase === BeamPhase.Overheated ||
          (beamRow?.phase === BeamPhase.Cooling && resource.valueQ <= 0)),
    });
    let width = 240 * scale;
    let x = barX;
    let y = xpY - 58 * scale;
    const layout = !this.belt ? this.carouselDock?.layout : undefined;
    if (layout) {
      const dockScale = this.carouselDock?.body.scaleX ?? 1;
      width = Math.max(150 * layout.scale, 188 * layout.scale * dockScale);
      x = layout.cornerLeft - width - 12 * layout.scale;
      y = layout.cornerTop + 7 * layout.scale;
    } else if (this.belt) {
      width = Math.min(320 * scale, this.screenW() - 48 * scale);
      x = this.screenW() / 2 - width / 2;
      y = this.screenH() - 126 * scale;
    }
    const height = 12 * scale;
    const fill = Math.max(0, width * view.fraction);
    const preview = Math.max(0, Math.min(fill, width * view.debitFraction));
    const color = view.locked ? 0xff5d5d : view.low ? 0xff9a45 : 0x6fd6ff;
    g.fillStyle(0x06080b, 0.96).fillRoundedRect(
      x - 2 * scale,
      y - 2 * scale,
      width + 4 * scale,
      height + 4 * scale,
      4 * scale,
    );
    g.fillStyle(0x26313a, 0.95).fillRoundedRect(x, y, width, height, 3 * scale);
    if (fill > 0) g.fillStyle(color, 0.96).fillRoundedRect(x, y, fill, height, 3 * scale);
    if (preview > 0) {
      g.fillStyle(0xffffff, 0.24).fillRect(x + fill - preview, y, preview, height);
    }
    g.lineStyle(Math.max(1, scale), color, 0.9).strokeRoundedRect(x, y, width, height, 3 * scale);
    for (let index = 0; index < view.chevrons; index++) {
      const cx = x + width + (8 + index * 7) * scale;
      g.lineStyle(2 * scale, view.chevrons === 2 ? 0x9cff6a : 0x6fd6ff, 0.95)
        .lineBetween(cx - 3 * scale, y + 2 * scale, cx + 1 * scale, y + height / 2)
        .lineBetween(cx + 1 * scale, y + height / 2, cx - 3 * scale, y + height - 2 * scale);
    }
    const copy = view.overlay || `DRIVE ${Math.floor(view.value)} · COST ${view.cost.copy}`;
    label
      .setPosition(x + width / 2, y - 7 * scale)
      .setText(copy)
      .setColor(view.locked ? "#ff5d5d" : view.low ? "#ffb24a" : "#d9fbff")
      .setVisible(true);
    if (view.locked && !this.driveLocked) {
      this.flashBanner("DRIVE EMPTY · RELEASE", "#ff5d5d");
      this.audio.play("drive:empty");
    }
    this.driveLocked = view.locked;
  }

  /** Authoritative-only charge arc, mirrored onto the dock junction's opposite (upper-left) shoulder. */
  private renderUltimateHud(
    self: PlayerState | undefined,
    barX: number,
    xpY: number,
    scale: number,
  ): void {
    const g = this.ultimateHudGfx;
    const label = this.ultimateHudText;
    if (!g || !label) return;
    g.clear();
    label.setVisible(false);
    const row = self?.ultimate;
    if (!self || !row || row.archetype === 0) return;
    const layout = ultimateHudLayout({
      screenWidth: this.screenW(),
      screenHeight: this.screenH(),
      barX,
      xpY,
      uiScale: scale,
      belt: this.belt,
      dock: !this.belt ? this.carouselDock?.layout : undefined,
      dockBodyScale: this.carouselDock?.body.scaleX,
    });
    const start = Math.PI * 0.72;
    const span = Math.PI * 1.56;
    const charge = Math.max(0, Math.min(100, row.charge));
    const fraction = charge / 100;
    const ready = charge >= 100 && row.phase === UltimatePhase.Idle;
    const pulse =
      this.time.now < this.ultimateHudPulseUntil
        ? 1 + Math.sin((this.ultimateHudPulseUntil - this.time.now) / 24) * 0.28
        : 1;
    const line = Math.max(2, 2.4 * scale) * pulse;
    g.lineStyle(line + 2, 0x080a0d, 0.82);
    g.beginPath();
    g.arc(layout.x, layout.y, layout.radius, start, start + span, false);
    g.strokePath();
    g.lineStyle(line, 0x52616c, 0.64);
    g.beginPath();
    g.arc(layout.x, layout.y, layout.radius, start, start + span, false);
    g.strokePath();
    if (fraction > 0) {
      const breath =
        ready && !prefersReducedPaperMotion() ? 0.82 + Math.sin(this.time.now / 420) * 0.14 : 0.94;
      g.lineStyle(line, ready ? 0xa8f1e8 : 0x78c9df, breath);
      g.beginPath();
      g.arc(layout.x, layout.y, layout.radius, start, start + span * fraction, false);
      g.strokePath();
    }
    const remaining = this.ultimateVfx.doorTicketRemaining(self.id, this.room?.state.tick ?? 0);
    const copy =
      remaining > 0 ? `F RETURN ${remaining.toFixed(1)}` : ready ? "F READY" : `${charge}%`;
    label
      .setPosition(layout.labelX, layout.labelY)
      .setText(copy)
      .setColor(ready || remaining > 0 ? "#a8f1e8" : "#78aeba")
      .setVisible(true);
  }

  private humanizeDamageId(value: string): string {
    return value
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
      .trim();
  }

  private deathSourceLabel(entry: DamageRecapEntry): string {
    if (entry.sourceLabel) return entry.sourceLabel;
    const enemy = entry.sourceId ? this.room?.state.enemies.get(entry.sourceId) : undefined;
    const enemyKind = enemy?.kind ?? "";
    const bossId =
      (BOSSES[entry.sourceId] ? entry.sourceId : "") ||
      (BOSSES[enemyKind] ? enemyKind : "") ||
      (BOSSES[entry.sourceKind] ? entry.sourceKind : "");
    if (bossId) return BOSSES[bossId]?.name ?? this.humanizeDamageId(bossId);
    if (enemyKind) return this.humanizeDamageId(enemyKind);
    const kind = `${entry.sourceKind} ${entry.damageType}`.toLowerCase();
    if (kind.includes("pit") || kind.includes("fall")) return "Pit Fall";
    if (kind.includes("pool") || kind.includes("zone") || kind.includes("acid")) return "Acid Pool";
    if (kind.includes("projectile") || kind.includes("spit") || kind.includes("bullet"))
      return "Projectile";
    if (kind.includes("contact")) return "Enemy Contact";
    if (kind.includes("melee") || kind.includes("lunge")) return "Melee Strike";
    if (kind.includes("quake")) return "Ground Quake";
    if (kind.includes("ring")) return "Shockwave Ring";
    if (kind.includes("beam")) return "Sweeping Beam";
    if (kind.includes("charge") || kind.includes("dash")) return "Charge Lane";
    if (kind.includes("slam") || kind.includes("aoe") || kind.includes("radial"))
      return "Boss Slam";
    return entry.sourceKind ? this.humanizeDamageId(entry.sourceKind) : "Hostile Attack";
  }

  private deathRecapLine(entry: DamageRecapEntry, prefix: string): string {
    const response =
      entry.parryable < 0 ? "" : entry.parryable === 1 ? " (parryable)" : " (unparryable)";
    const amount = entry.amount > 0 ? `, ${Math.max(1, Math.round(entry.amount))} damage` : "";
    return `${prefix}${this.deathSourceLabel(entry)}${response}${amount}`;
  }

  private deathCounter(entry: DamageRecapEntry): string {
    const kind = `${entry.sourceKind} ${entry.damageType} ${entry.telegraphKind}`.toLowerCase();
    if (kind.includes("pit") || kind.includes("fall"))
      return "Counter: jump before crossing fractured ground.";
    if (kind.includes("pool") || kind.includes("zone") || kind.includes("acid"))
      return "Counter: move out of the red ground pool.";
    if (entry.parryable === 1) return "Counter: parry the white timing edge.";
    if (
      kind.includes("slam") ||
      kind.includes("ring") ||
      kind.includes("beam") ||
      kind.includes("charge") ||
      kind.includes("radial")
    )
      return "Counter: leave the protected red footprint before it resolves.";
    if (kind.includes("projectile") || kind.includes("spit") || kind.includes("bullet"))
      return entry.parryable === 0
        ? "Counter: dodge or break the firing lane."
        : "Counter: parry the bright projectile or dodge its lane.";
    if (kind.includes("contact")) return "Counter: make space from the enemy body after its swing.";
    return "Counter: watch the final white/red response edge.";
  }

  private drawObjectiveHudPlate(
    graphics: Phaser.GameObjects.Graphics,
    rect: ObjectiveHudRect,
    stroke: number,
    strokeAlpha: number,
    scale: number,
  ): void {
    const radius = Math.min(8 * scale, rect.height * 0.25);
    graphics
      .fillStyle(0x000000, 0.42)
      .fillRoundedRect(rect.x + 2 * scale, rect.y + 3 * scale, rect.width, rect.height, radius)
      .fillStyle(0x0a0805, 0.9)
      .fillRoundedRect(rect.x, rect.y, rect.width, rect.height, radius)
      .lineStyle(Math.max(1, scale), stroke, strokeAlpha)
      .strokeRoundedRect(rect.x, rect.y, rect.width, rect.height, radius);
  }

  /** Finding #11: one objective, supporting session truths, and one resolving connection notice. */
  private renderObjectiveHud(scale: number): void {
    const state = this.room?.state;
    const depth = state?.depth ?? 1;
    let carriedSalvage = 0;
    state?.players.forEach((player) => {
      carriedSalvage += player.salvaged;
    });
    const bossActive = (state?.bossPhase ?? 0) >= 1;
    const lagging =
      this.predictor !== null && (this.predictor.isStalled || this.predictor.stats.pending > 24);
    const mode =
      state?.mode === "training"
        ? "training"
        : this.belt
          ? "belt"
          : state?.mode === "bossrush"
            ? "bossrush"
            : "arena";
    const copy = objectiveHudCopy({
      mode,
      dimensionName: getDimension(state?.dimensionId).name,
      depth,
      bossActive,
      portalOpen: !!state?.portalOpen,
      bossEtaSeconds: Math.max(0, bossSpawnAt(depth) - (state?.elapsedSeconds ?? 0)),
      carriedSalvage,
      bankedSalvage: state?.bankedSalvage ?? 0,
      beltRoomName: state?.beltRoomName,
      beltLocked: (state?.beltLockX ?? 0) > 0,
      lagging,
    });
    if (mode === "training") {
      let galleryPage = 0;
      let galleryPages = 0;
      let galleryWeapons = 0;
      state?.pickups.forEach((_pickup, id) => {
        if (!id.startsWith("pk:")) return;
        galleryWeapons++;
        if (galleryPage > 0) return;
        const [, rawPage, rawPages] = id.split(":", 4);
        const page = Number(rawPage);
        const pages = Number(rawPages);
        if (Number.isInteger(page) && page > 0 && Number.isInteger(pages) && pages >= page) {
          galleryPage = page;
          galleryPages = pages;
        }
      });
      if (galleryPage > 0) {
        copy.location = `${copy.location} · Page ${galleryPage}/${galleryPages} · ${galleryWeapons} weapons · [Z/X] Prev/Next · [G] Game note · [T] Weapon note`;
      } else {
        copy.location = `${copy.location} · [G] Game note · [T] Weapon note`;
      }
    }
    if (mode === "training") {
      let page = 0;
      let pages = 0;
      let count = 0;
      state?.pickups.forEach((_pickup, id) => {
        if (!id.startsWith("pk:")) return;
        count++;
        if (page > 0) return;
        const [, rawPage, rawPages] = id.split(":", 4);
        page = Number(rawPage) || 0;
        pages = Number(rawPages) || 0;
      });
      if (page > 0) {
        copy.location = `WEAPON EVALUATION  ·  PAGE ${String(page).padStart(2, "0")}/${String(pages).padStart(2, "0")}  ·  ${count} WEAPONS  ·  [Z/X] PAGE  ·  [Q] CYCLE  ·  [E] PICK UP  ·  [R] DROP/HOLD SALVAGE  ·  [/] PORTAL SEARCH  ·  [G/T] OWNER NOTES`;
      }
    }
    const layout = objectiveHudLayout({
      screenWidth: this.screenW(),
      uiScale: scale,
      showEconomy: copy.economy !== undefined,
      showNotice: copy.notice !== undefined,
    });
    this.objectiveProgressTop = layout.progressTop;
    this.objectiveProgressWidth = layout.progressWidth;

    const layoutSig = [
      layout.objective.x,
      layout.objective.width,
      layout.objective.height,
      layout.location.x,
      layout.location.width,
      layout.economy?.x ?? -1,
      layout.economy?.width ?? -1,
      layout.notice?.x ?? -1,
      layout.notice?.width ?? -1,
      copy.accent,
    ].join(":");
    if (layoutSig !== this.objectiveHudLayoutSig) {
      this.objectiveHudLayoutSig = layoutSig;
      const graphics = this.objectiveHudGfx.clear();
      this.drawObjectiveHudPlate(graphics, layout.objective, copy.accent, 0.72, scale);
      this.drawObjectiveHudPlate(graphics, layout.location, 0xcfc6ae, 0.35, scale);
      if (layout.economy)
        this.drawObjectiveHudPlate(graphics, layout.economy, 0xd9c78f, 0.42, scale);
      if (layout.notice) this.drawObjectiveHudPlate(graphics, layout.notice, 0xff8a2b, 0.75, scale);
    }

    this.objectiveText
      .setPosition(
        layout.objective.x + layout.objective.width / 2,
        layout.objective.y + layout.objective.height / 2,
      )
      .setWordWrapWidth(Math.max(80, layout.objective.width - 20 * scale))
      .setText(copy.objective)
      .setColor(copy.color);
    this.objectiveLocationText
      .setPosition(
        layout.location.x + layout.location.width / 2,
        layout.location.y + layout.location.height / 2,
      )
      .setWordWrapWidth(Math.max(60, layout.location.width - 12 * scale))
      .setText(copy.location);
    this.objectiveEconomyText.setVisible(!!layout.economy && copy.economy !== undefined);
    if (layout.economy && copy.economy !== undefined) {
      this.objectiveEconomyText
        .setPosition(
          layout.economy.x + layout.economy.width / 2,
          layout.economy.y + layout.economy.height / 2,
        )
        .setWordWrapWidth(Math.max(60, layout.economy.width - 12 * scale))
        .setText(copy.economy);
    }
    this.objectiveNoticeText.setVisible(!!layout.notice && copy.notice !== undefined);
    if (layout.notice && copy.notice !== undefined) {
      this.objectiveNoticeText
        .setPosition(
          layout.notice.x + layout.notice.width / 2,
          layout.notice.y + layout.notice.height / 2,
        )
        .setWordWrapWidth(Math.max(60, layout.notice.width - 12 * scale))
        .setText(copy.notice);
    }
  }

  /** HP bar + downed overlay, repositioned each frame against the live viewport size. */
  private updateHud(): void {
    const selfId = this.room?.sessionId;
    const self = selfId ? this.room?.state.players.get(selfId) : undefined;

    // §28 4K-widescreen UI: grow the whole HUD on big viewports (only re-sizing elements when the scale
    // actually changes — a resize — to keep the per-frame path cheap).
    const s = this.uiScale();
    if (s !== this.hudScale) {
      this.hudScale = s;
      this.applyHudScale(s);
    }

    const barX = 20 * s;
    const barY = this.screenH() - 24 * s;
    const xpY = barY - 15 * s;
    this.hpBarBg.setPosition(barX, barY);
    this.hpBarFill.setPosition(barX + 2 * s, barY);
    this.hpText.setPosition(barX + 8 * s, barY);

    const hp = self ? Math.max(0, self.hp) : 0;
    const maxHp = self ? self.maxHp : 100;
    const ratio = maxHp > 0 ? hp / maxHp : 0;
    // §19 v0.108 A8: the fill LERPS toward the true ratio (hits/heals read as motion, not a jump); the
    // COLOR flips off the true ratio so the threshold read stays crisp.
    if (this.hpShown < 0) this.hpShown = ratio;
    this.hpShown = Phaser.Math.Linear(this.hpShown, ratio, 0.25);
    this.hpBarFill.width = 236 * s * this.hpShown;
    // Green → amber → red as it drains.
    this.hpBarFill.fillColor = ratio > 0.5 ? 0x9cff3b : ratio > 0.25 ? 0xff8a2b : 0xff5d5d;
    this.hpText.setText(`${Math.ceil(hp)} / ${maxHp}`);

    // §19 v0.108 A7: low-HP DANGER vignette + hurt punch. Below 30% HP the screen edges glow red (with a
    // heartbeat pulse under 25%); a fresh hit spikes `hurtFlash` (set in updateCombatFx) for a punch that
    // reads even at full HP. Reads HP only — changes nothing.
    this.hurtFlash = Math.max(0, this.hurtFlash - (this.deltaSec || 0.016) * 3.5);
    const aliveSelf = !!self && self.alive;
    let vig = aliveSelf && ratio < 0.3 ? Math.min(1, (0.3 - ratio) / 0.3) * 0.5 : 0;
    if (aliveSelf && ratio < 0.25) vig *= 0.72 + 0.28 * Math.sin(this.time.now / 220);
    vig = Math.max(vig, aliveSelf ? this.hurtFlash * 0.32 : 0);
    this.dangerVignette.setAlpha(Phaser.Math.Linear(this.dangerVignette.alpha, vig, 0.18));
    const juggleLeft = Math.max(0, this.jugglePulseUntil - this.time.now);
    const juggleFade = aliveSelf ? Math.min(1, juggleLeft / 420) : 0;
    const juggleBeat = prefersReducedPaperMotion()
      ? 1
      : 0.78 + 0.22 * Math.sin((this.time.now / 1000) * Math.PI * 8);
    this.juggleVignette.setAlpha(
      Phaser.Math.Linear(this.juggleVignette.alpha, juggleFade * juggleBeat * 0.24, 0.24),
    );

    // XP bar + level badge (§12).
    this.xpBarBg.setPosition(barX, xpY);
    this.xpBarFill.setPosition(barX + 2 * s, xpY);
    const xpRatio = self && self.xpToNext > 0 ? Math.min(1, self.xp / self.xpToNext) : 0;
    // §19 v0.108 A8: XP fill eases up on a kill (satisfying), but SNAPS on a level reset (ratio drops).
    if (this.xpShown < 0 || xpRatio < this.xpShown - 0.05) this.xpShown = xpRatio;
    else this.xpShown = Phaser.Math.Linear(this.xpShown, xpRatio, 0.25);
    this.xpPulse = Math.max(0, this.xpPulse - (this.deltaSec || 0.016) / 0.12);
    this.xpBarFill.width = 236 * s * this.xpShown;
    // Receipt pulse changes thickness/brightness only; the authoritative XP ratio remains the sole width.
    this.xpBarFill.height = (4 + this.xpPulse * 3) * s;
    this.xpBarFill.fillColor = this.xpPulse > 0.05 ? 0xd9fbff : 0x6fd6ff;
    this.xpBarFill.setAlpha(0.92 + this.xpPulse * 0.08);
    this.levelText
      .setPosition(barX, xpY - 9 * s)
      .setText(self ? `Level ${self.level} · XP ${self.xp}/${self.xpToNext}` : "");

    this.restartBtn
      .setPosition(this.screenW() - 14 * s, 14 * s)
      .setText(this.room?.state.outcome === "active" ? "⟳ Restart Run" : "⌂ Wardrobe");
    const heldWeapon = self ? WEAPONS[self.weapon] : undefined;
    const driveCost = heldWeapon ? driveCostView(heldWeapon.id) : undefined;
    // Loot identity and the generated neutral Drive debit share one line; no per-weapon ammo clock remains.
    const heldRar = self && self.weaponRarity > 0 ? RARITIES[self.weaponRarity] : undefined;
    const heldAffix = self?.weaponAffix ? affixById(self.weaponAffix).name : "";
    const lootPrefix = [heldRar?.name ?? "", heldAffix].filter(Boolean).join(" ");
    const heldManifest = self ? this.manifestEntryAt("active", self.activeSlot) : undefined;
    const atRisk = heldManifest?.origin === "found" ? " · FOUND · AT RISK" : "";
    this.weaponText
      .setPosition(barX, xpY - 24 * s)
      .setText(
        self
          ? `⚔ ${lootPrefix ? `${lootPrefix} ` : ""}${heldWeapon?.name ?? "Unknown weapon"}${driveCost ? ` · DRIVE ${driveCost.pipText} ${driveCost.copy}` : ""}${atRisk}`
          : "",
      );
    if (heldManifest?.origin === "found") {
      this.weaponText.setColor("#ffb24a");
    } else if (heldRar) {
      this.weaponText.setColor(`#${heldRar.color.toString(16).padStart(6, "0")}`);
    } else {
      this.weaponText.setColor("#9cff3b");
    }
    this.renderDriveHud(self, heldWeapon, barX, xpY, s);
    this.renderUltimateHud(self, barX, xpY, s);

    // §8 owned parry augments — a compact "name ×count" summary above the weapon readout.
    if (self?.augments) {
      const counts = new Map<string, number>();
      for (const a of self.augments.split(",").filter(Boolean))
        counts.set(a, (counts.get(a) ?? 0) + 1);
      const parts = [...counts].map(([id, n]) => {
        const name = AUGMENTS[id]?.name ?? id;
        return n > 1 ? `${name} ×${n}` : name;
      });
      this.augmentText
        .setPosition(barX, xpY - 42 * s)
        .setText(`✦ ${parts.join(" · ")}`)
        .setVisible(true);
    } else {
      this.augmentText.setVisible(false);
    }

    // Character, kit, attributes, and controls belong to the weapon/level or contextual verb surfaces.
    this.renderObjectiveHud(s);

    // §6 rez-or-dead: a downed player waits for a rez (no respawn); a full wipe ends the run.
    const downed = !!self && !self.alive;
    this.deathText.setVisible(downed);
    if (downed) {
      const wiped = this.room?.state.outcome === "defeat";
      const latest = this.deathRecap[0];
      const previous = this.deathRecap[1];
      const hasCause = !!(
        latest.sourceKind ||
        latest.sourceId ||
        latest.sourceLabel ||
        latest.damageType
      );
      const cause = hasCause
        ? `${this.deathRecapLine(latest, "Downed by ")}\n${this.deathCounter(latest)}`
        : "Cause unavailable from this server snapshot.\nCounter: watch the final white/red response edge.";
      const prior = previous.receiptKey
        ? `\n${this.deathRecapLine(previous, "Previous hit: ")}`
        : "";
      const recovery = wiped
        ? "(open Wardrobe, top-right)"
        : "A squadmate with Gravedigger's Spade can revive you.";
      const stakes =
        wiped && this.settlementResult
          ? `\n${this.settlementResult.heading}\n${this.settlementResult.primary}\n${this.settlementResult.detail}`
          : wiped
            ? "\nCLOSING THE CARRY · awaiting settlement receipt"
            : "";
      this.deathText
        .setText(
          `${wiped ? "DEFEATED — THE SQUAD IS DOWN" : "DOWNED"}\n${cause}${prior}\n${recovery}${stakes}`,
        )
        .setText(
          `${this.deathText.text}${wiped && this.petResultLine ? `\n${this.petResultLine}` : ""}`,
        )
        .setFontSize(20 * s)
        .setWordWrapWidth(Math.min(this.screenW() - 80 * s, 820 * s))
        .setColor(wiped ? "#ff5d5d" : "#ffd479")
        .setPosition(this.screenW() / 2, this.screenH() / 2);
    }
  }

  /** §9 mirrored-L weapon dock. Passive entries are lightweight and the full card is built lazily. */
  private buildCarousel(): void {
    const root = this.add.container(0, 0).setScrollFactor(0).setDepth(100004);
    const rails = this.add.container(0, 0);
    const bottomArm = this.add.container(0, 0);
    const rightArm = this.add.container(0, 0);
    const ticks = this.add.graphics();
    const tabStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: "monospace",
      fontSize: "11px",
      color: "#f1e8cf",
      fontStyle: "bold",
    };
    const textResolution = Math.max(2, Math.ceil(RENDER_DPR));
    const bottomTab = this.add
      .text(0, 0, "PREV", tabStyle)
      .setOrigin(1, 0.5)
      .setShadow(0, 1, "#000000", 2, true, true)
      .setResolution(textResolution);
    const rightTab = this.add
      .text(0, 0, "[Q] NEXT", tabStyle)
      .setOrigin(0.5, 1)
      .setShadow(0, 1, "#000000", 2, true, true)
      .setResolution(textResolution);
    const elbow = this.add.container(0, 0);
    const junction = buildDockJunction(this);
    elbow.add(junction.container);
    const detailLayer = this.add.container(0, 0);
    rails.add([bottomArm, rightArm, ticks]);
    // `body` = elbow + arms + tabs: everything that rides the idle 0.72→1 scale (dockux-panel §1.2).
    // The focus inspector stays outside so the 212×296 card never shrinks with the resting dock.
    const body = this.add.container(0, 0, [rails, bottomTab, rightTab, elbow]);
    root.add([body, detailLayer]);

    const chips: DockChip[] = [];
    for (let index = 0; index < 4; index++) {
      const chip = buildDockChip(this, FISTS_WEAPON);
      chip.container.setVisible(false);
      bottomArm.add(chip.container);
      chips.push(chip);
    }
    this.carouselDock = {
      root,
      body,
      rails,
      bottomArm,
      rightArm,
      ticks,
      bottomTab,
      rightTab,
      elbow,
      junction,
      detailLayer,
      chips,
      detailCards: new Map(),
      detailLru: [],
      currentDetailId: "",
      selectedId: "",
      selectedIndex: -1,
      layoutSig: "",
      activeSig: "",
      heldSig: "",
      liveSig: "",
      state: "dormant",
      fadeProgress: 0,
      inspectStartedAt: 0,
      blocked: false,
    };
    this.applyCarouselDockFade(0);
    if (this.belt) root.setVisible(false);
  }

  /** §9/§13 draw the drop/salvage HOLD bar while R is held — a bar above the card carousel filling
   *  0→1 over SALVAGE_HOLD_SECONDS. Release before full = DROP the weapon; hold to full = SALVAGE it. */
  private updateDropBar(canDrop: boolean): void {
    const bar = this.dropBar;
    const label = this.dropBarLabel;
    if (!bar || !label) return;
    const holding = canDrop && this.keys.R.isDown && this.rHold > 0.02;
    if (!holding) {
      bar.setVisible(false);
      label.setVisible(false);
      return;
    }
    const frac = Math.min(1, this.rHold / SALVAGE_HOLD_SECONDS);
    const w = 180;
    const h = 12;
    const x = this.screenW() / 2 - w / 2;
    const y = this.screenH() - 132;
    const done = frac >= 1;
    bar.clear();
    bar.fillStyle(0x000000, 0.55).fillRoundedRect(x - 2, y - 2, w + 4, h + 4, 5);
    bar.fillStyle(0x2a2a2a, 1).fillRoundedRect(x, y, w, h, 4);
    bar.fillStyle(done ? 0xff5a4a : 0xffb24a, 1).fillRoundedRect(x, y, w * frac, h, 4);
    bar.setVisible(true);
    // dockux-panel §2.2: key-hint grammar, and the payout on completion — the bar's whole point is the
    // greed decision, so show what salvaging just paid.
    const self = this.room?.state.players.get(this.room?.sessionId ?? "");
    label
      .setText(
        done
          ? `Salvaged +${salvageValue(self?.weaponRarity ?? 0)}`
          : "[R] Hold to salvage · Release to drop",
      )
      .setColor(done ? "#ff8a5a" : "#ffe7a8")
      .setPosition(this.screenW() / 2, y - 12)
      .setVisible(true);
  }

  private stopCarouselDockFade(dock: CarouselDock): void {
    dock.fadeEvent?.remove(false);
    dock.fadeEvent = undefined;
    if (dock.fadeTween) {
      dock.fadeTween.stop();
      dock.fadeTween.remove();
      dock.fadeTween = undefined;
    }
  }

  private applyCarouselDockFade(progress: number): void {
    const dock = this.carouselDock;
    if (!dock) return;
    const p = paperClamp01(progress);
    dock.fadeProgress = p;
    dock.rails.setAlpha(0.1 + 0.9 * p);
    dock.bottomTab.setAlpha(0.18 + 0.82 * p);
    dock.rightTab.setAlpha(0.18 + 0.82 * p);
    dock.junction.art.setAlpha(0.18 + 0.82 * p);
    dock.junction.chrome.setAlpha(0.3 + 0.7 * p);
    // Active identity, rarity treatment, and current resource state are combat truth and never fade.
    dock.junction.truth.setAlpha(1);
    // dockux-panel §1.2: the whole dock body rides the SAME fade — awake earns the big pixels, idle
    // shrinks below today's footprint. Anchored at the bottom-right corner point so it stays edge-flush.
    // No new tween/timing; with prefers-reduced-motion the scale snaps between the endpoints instead.
    const layout = dock.layout;
    const idleScale = layout?.idleScale ?? 116 / 152;
    const scale = prefersReducedPaperMotion()
      ? p >= 0.5
        ? 1
        : idleScale
      : idleScale + (1 - idleScale) * p;
    if (layout) {
      const anchorX = layout.cornerLeft + layout.junctionSize;
      const anchorY = layout.cornerTop + layout.junctionSize;
      dock.body.setScale(scale).setPosition(anchorX * (1 - scale), anchorY * (1 - scale));
    }
  }

  /** Explicit non-aim activity wakes the compact rails; Q arms the weapon inspector. */
  private wakeCarouselDock(inspectKey?: "Q"): void {
    const dock = this.carouselDock;
    if (!dock || this.belt || dock.blocked) return;
    if (inspectKey) {
      dock.inspectKey = inspectKey;
      dock.inspectStartedAt = this.time.now;
    }
    this.stopCarouselDockFade(dock);
    if (dock.state === "focused") {
      this.applyCarouselDockFade(1);
      return;
    }
    dock.state = "peek";
    const duration = Math.max(1, 120 * (1 - dock.fadeProgress));
    dock.fadeTween = this.tweens.add({
      targets: dock,
      fadeProgress: 1,
      duration,
      ease: "Cubic.easeOut",
      onUpdate: () => this.applyCarouselDockFade(dock.fadeProgress),
      onComplete: () => {
        dock.fadeTween = undefined;
      },
    });
    dock.fadeEvent = this.time.delayedCall(2400, () => this.fadeCarouselDock());
  }

  private fadeCarouselDock(): void {
    const dock = this.carouselDock;
    if (!dock || dock.blocked || dock.state === "focused") return;
    this.stopCarouselDockFade(dock);
    dock.state = "fading";
    dock.fadeTween = this.tweens.add({
      targets: dock,
      fadeProgress: 0,
      duration: 650,
      ease: paperSmoothstep,
      onUpdate: () => this.applyCarouselDockFade(dock.fadeProgress),
      onComplete: () => {
        dock.fadeTween = undefined;
        dock.state = "dormant";
        this.applyCarouselDockFade(0);
      },
    });
  }

  private setCarouselDockBlocked(blocked: boolean): void {
    const dock = this.carouselDock;
    if (!dock || blocked === dock.blocked) return;
    dock.blocked = blocked;
    this.stopCarouselDockFade(dock);
    dock.inspectKey = undefined;
    if (blocked) {
      this.collapseCarouselDockFocus(true);
      dock.state = "dormant";
      this.applyCarouselDockFade(0);
      dock.root.setVisible(false);
    } else {
      dock.root.setVisible(true);
      dock.state = "dormant";
      this.applyCarouselDockFade(0);
    }
  }

  private carouselDockAccent(entry: LoadoutEntryView): number {
    return RARITIES[entry.rarity]?.color ?? WEAPON_ACCENT[entry.leadId] ?? 0xb9975b;
  }

  private layoutCarouselDock(
    self: PlayerState,
    layout: WeaponDockLayout,
    bottomIds: string[],
    rightIds: string[],
  ): void {
    const dock = this.carouselDock;
    if (!dock) return;
    const entry = loadoutEntryView(self);
    for (const chip of dock.chips) {
      if (chip.container.visible) chip.container.setVisible(false);
    }
    let poolIndex = 0;
    const place = (
      id: string,
      target: Phaser.GameObjects.Container,
      point: { x: number; y: number },
      width: number,
      height: number,
      order: string,
    ) => {
      const chip = dock.chips[poolIndex++];
      if (!chip) return;
      rebindDockChip(this, chip, id);
      if (chip.container.parentContainer !== target) {
        chip.container.parentContainer?.remove(chip.container);
        target.add(chip.container);
      }
      layoutDockChip(chip, width, height, order, layout.scale);
      chip.container.setPosition(point.x, point.y).setRotation(0).setVisible(true);
    };
    // Previous chips are history only; Q is the sole active cycle binding on the next arm.
    layout.bottom.forEach((point, index) => {
      const id = bottomIds[index];
      if (id)
        place(
          id,
          dock.bottomArm,
          point,
          layout.bottomChipWidth,
          layout.bottomChipHeight,
          `−${index + 1}`,
        );
    });
    layout.right.forEach((point, index) => {
      const id = rightIds[index];
      if (id)
        place(
          id,
          dock.rightArm,
          point,
          layout.rightChipWidth,
          layout.rightChipHeight,
          index === 0 ? "Q" : `Q${index + 1}`,
        );
    });

    const bottomCulled = Math.max(0, bottomIds.length - layout.bottom.length);
    const rightCulled = Math.max(0, rightIds.length - layout.right.length);
    dock.bottomTab
      .setText(bottomCulled > 0 ? `PREV +${bottomCulled}` : "PREV")
      .setPosition(layout.bottomTab.x, layout.bottomTab.y)
      .setFontSize(14);
    dock.rightTab
      .setText(rightCulled > 0 ? `[Q] NEXT +${rightCulled}` : "[Q] NEXT")
      .setPosition(layout.rightTab.x, layout.rightTab.y)
      .setFontSize(14);

    const n = WEAPON_IDS.length;
    const accent = this.carouselDockAccent(entry);
    const bar = layout.positionBar ?? {
      x: layout.junction.x - 104,
      y: layout.junction.y + layout.junctionSize / 2 + 12,
      width: 208,
      height: 4,
    };
    const fraction = n > 1 && dock.selectedIndex >= 0 ? dock.selectedIndex / (n - 1) : 0;
    dock.ticks.clear();
    dock.ticks
      .fillStyle(0x0e1117, 0.94)
      .fillRoundedRect(bar.x, bar.y, bar.width, bar.height, bar.height / 2)
      .fillStyle(0x59616d, 0.72)
      .fillRoundedRect(bar.x + 2, bar.y + 2, bar.width - 4, Math.max(2, bar.height - 4), 2)
      .fillStyle(accent, 1)
      .fillCircle(bar.x + 3 + (bar.width - 6) * fraction, bar.y + bar.height / 2, 5);

    dock.elbow.setPosition(layout.junction.x, layout.junction.y);
    layoutDockJunction(
      dock.junction,
      layout.junctionSize,
      accent,
      entry.leadId === FISTS_WEAPON,
      layout.scale,
      entry.rarity,
      entry.offRarity === undefined
        ? undefined
        : (RARITIES[entry.offRarity]?.color ?? WEAPON_ACCENT[entry.offId ?? ""] ?? 0xb9975b),
    );
    dock.layout = layout;
    // The idle-scale anchor moved with the layout — re-apply the current fade so the body stays flush.
    this.applyCarouselDockFade(dock.fadeProgress);
    const focused = dock.currentDetailId ? dock.detailCards.get(dock.currentDetailId) : undefined;
    if (focused?.container.visible) {
      focused.container
        .setPosition(layout.focus.x, layout.focus.y)
        .setScale((layout.focus.width ?? 360) / 360, (layout.focus.height ?? 520) / 520)
        .setRotation(0);
    }
  }

  private updateCarouselDockJunction(self: PlayerState): void {
    const dock = this.carouselDock;
    if (!dock) return;
    const entry = loadoutEntryView(self);
    const unarmed = entry.leadId === FISTS_WEAPON;
    const def = WEAPONS[entry.leadId];
    const offDef = entry.offId ? WEAPONS[entry.offId] : undefined;
    const rarity = entry.rarity > 0 ? RARITIES[entry.rarity] : undefined;
    const offRarity = entry.offRarity === undefined ? undefined : RARITIES[entry.offRarity];
    const affix = entry.affix ? affixById(entry.affix).name : "";
    const offAffix = entry.offAffix ? affixById(entry.offAffix).name : "";
    const accent = this.carouselDockAccent(entry);
    dock.junction.index.setText(
      dock.selectedIndex >= 0
        ? `${dock.selectedIndex + 1}/${WEAPON_IDS.length}`
        : `—/${WEAPON_IDS.length}`,
    );
    // dockux-panel §2.2: sentence-case state, no id leaks, tier · affix with the interpunct. Pair
    // names keep the dock's 17-char ellipsis contract so the second hand never pushes Drive truth
    // off the junction.
    const leadName = unarmed ? "Unarmed" : (def?.name ?? "Unknown weapon");
    const offName = offDef?.name ?? (entry.offId ? "Unknown weapon" : "");
    const rawName = offName ? `${leadName} × ${offName}` : leadName;
    dock.junction.name.setText(rawName.length > 17 ? `${rawName.slice(0, 16)}…` : rawName);
    dock.junction.loot
      .setText(
        [
          [rarity?.name ?? "", affix].filter(Boolean).join(" · "),
          offDef ? [offRarity?.name ?? "", offAffix].filter(Boolean).join(" · ") : "",
        ]
          .filter(Boolean)
          .join(" / "),
      )
      .setColor(rarity ? `#${rarity.color.toString(16).padStart(6, "0")}` : "#d8cfb8");
    const leadCost = driveCostView(entry.leadId);
    dock.junction.resource
      .setText(`DRIVE ${leadCost.pipText} ${leadCost.copy}`)
      .setColor("#d9fbff")
      .setAlpha(entry.nextHand === 0 ? 1 : 0.78)
      .setData("fraction", 0);
    if (entry.offId) {
      const offCost = driveCostView(entry.offId);
      dock.junction.resource2
        .setText(`OFF ${offCost.pipText} ${offCost.copy}`)
        .setColor("#a9cbd1")
        .setAlpha(entry.nextHand === 1 ? 1 : 0.72)
        .setData("fraction", 0);
    } else if (this.manifestEntryAt("active", entry.leadSlot)?.origin === "found") {
      dock.junction.resource2
        .setText("FOUND · AT RISK")
        .setColor("#ffb24a")
        .setAlpha(1)
        .setData("fraction", 0);
    } else {
      dock.junction.resource2.setText("").setData("fraction", 0);
    }
    if (dock.layout) {
      layoutDockJunction(
        dock.junction,
        dock.layout.junctionSize,
        accent,
        unarmed,
        dock.layout.scale,
        entry.rarity,
        entry.offRarity === undefined
          ? undefined
          : (RARITIES[entry.offRarity]?.color ?? WEAPON_ACCENT[entry.offId ?? ""] ?? 0xb9975b),
      );
    }
  }

  private carouselDockDetail(id: string): Card {
    const dock = this.carouselDock as CarouselDock;
    let card = dock.detailCards.get(id);
    if (!card) {
      card = buildCard(this, id);
      card.container.setVisible(false).setDepth(0);
      dock.detailLayer.add(card.container);
      dock.detailCards.set(id, card);
    }
    dock.detailLru = dock.detailLru.filter((entry) => entry !== id);
    dock.detailLru.push(id);
    while (dock.detailLru.length > 3) {
      const evicted = dock.detailLru.shift();
      if (!evicted || evicted === id) continue;
      const old = dock.detailCards.get(evicted);
      old?.container.destroy(true);
      dock.detailCards.delete(evicted);
    }
    return card;
  }

  private showCarouselDockFocus(): void {
    const dock = this.carouselDock;
    if (!dock || dock.blocked || !dock.layout || !dock.selectedId) return;
    this.stopCarouselDockFade(dock);
    if (dock.focusTween) {
      dock.focusTween.stop();
      dock.focusTween.remove();
      dock.focusTween = undefined;
    }
    if (dock.currentDetailId && dock.currentDetailId !== dock.selectedId) {
      dock.detailCards.get(dock.currentDetailId)?.container.setVisible(false);
    }
    const card = this.carouselDockDetail(dock.selectedId);
    dock.currentDetailId = dock.selectedId;
    dock.liveSig = "";
    dock.state = "focused";
    this.applyCarouselDockFade(1);
    const { focus, junction } = dock.layout;
    card.container.setVisible(true);
    if (prefersReducedPaperMotion()) {
      card.container
        .setPosition(focus.x, focus.y)
        .setScale((focus.width ?? 360) / 360, (focus.height ?? 520) / 520)
        .setRotation(0)
        .setAlpha(1);
      return;
    }
    card.container
      .setPosition(junction.x, junction.y)
      .setScale(0.22)
      .setRotation(-0.0436)
      .setAlpha(0);
    dock.focusTween = this.tweens.add({
      targets: card.container,
      x: focus.x,
      y: focus.y,
      scaleX: (focus.width ?? 360) / 360,
      scaleY: (focus.height ?? 520) / 520,
      rotation: 0,
      alpha: 1,
      duration: 190,
      ease: "Cubic.easeOut",
      onComplete: () => {
        dock.focusTween = undefined;
      },
    });
  }

  private collapseCarouselDockFocus(immediate = false): void {
    const dock = this.carouselDock;
    if (!dock) return;
    if (dock.focusTween) {
      dock.focusTween.stop();
      dock.focusTween.remove();
      dock.focusTween = undefined;
    }
    const id = dock.currentDetailId;
    const card = id ? dock.detailCards.get(id) : undefined;
    dock.currentDetailId = "";
    dock.liveSig = "";
    if (!card) return;
    if (immediate || prefersReducedPaperMotion() || !dock.layout) {
      card.container.setVisible(false).setAlpha(0).setRotation(0);
      return;
    }
    dock.focusTween = this.tweens.add({
      targets: card.container,
      x: dock.layout.junction.x,
      y: dock.layout.junction.y,
      scaleX: 0.22,
      scaleY: 0.22,
      rotation: 0,
      alpha: 0,
      duration: 150,
      ease: "Cubic.easeIn",
      onComplete: () => {
        card.container.setVisible(false);
        dock.focusTween = undefined;
      },
    });
  }

  private updateCarouselDockInspect(): void {
    const dock = this.carouselDock;
    const keyName = dock?.inspectKey;
    if (!dock || !keyName || dock.blocked) return;
    if (!this.keys[keyName].isDown) {
      dock.inspectKey = undefined;
      if (dock.state === "focused") {
        this.collapseCarouselDockFocus();
        dock.state = "peek";
        this.wakeCarouselDock();
      }
      return;
    }
    if (dock.state !== "focused" && this.time.now - dock.inspectStartedAt >= 320) {
      this.showCarouselDockFocus();
    }
  }

  /** Preserve the original WYSIWYG equations; only the one visible inspector is ever refreshed. */
  private refreshCarouselDockCard(card: Card, def: WeaponDef | undefined, self: PlayerState): void {
    const entry = loadoutEntryView(self);
    const attrs: Record<Attr, number> = {
      str: self.str,
      dex: self.dex,
      int: self.int,
      con: self.con,
      luk: self.luk,
    };
    const fmt = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));
    const offDef = entry.offId ? WEAPONS[entry.offId] : undefined;
    const activePairCard = card.id === entry.leadId && !!def && !!offDef;
    const penalty = def
      ? activePairCard
        ? pairRequirementPenalty(def, offDef, attrs)
        : requirementPenalty(def, attrs)
      : 1;
    const loot = card.id === entry.leadId ? lootDamageMult(entry.rarity, entry.affix) : 1;
    for (const source of card.sources) {
      const mult = damageMultFromGrades(source.src.grades, attrs) * penalty * loot;
      const total = source.src.base * mult;
      source.text.setText(
        `${fmt(source.src.base)} + ${fmt(total - source.src.base)} = ${fmt(total)}`,
      );
      source.text.setColor(penalty < 1 ? "#ffb24a" : loot > 1 ? "#b8ff6a" : "#ffd479");
    }
    for (const token of card.reqTokens) {
      // dockux-panel §4: met/unmet was green-vs-red only — prefix ✓/✗ so the verdict survives colourblindness.
      const met = (attrs[token.attr] ?? 1) >= token.need;
      token.text.setText(`${met ? "✓" : "✗"} ${token.need}`);
      token.text.setColor(met ? "#9cff3b" : "#ff5a4a");
    }
    const cost = driveCostView(card.id);
    card.resource.setText(`DRIVE ${cost.pipText} · ${cost.copy}`);
    const artState = this.failedArt.has(card.id)
      ? "ART UNAVAILABLE"
      : this.pendingArt.has(card.id)
        ? "ART RENDERING…"
        : "ART READY";
    card.resource.setText(`${card.resource.text}\n${artState}`);
    if (activePairCard && offDef && entry.offId) {
      const preview = pairPreview({
        lead: {
          weaponId: entry.leadId,
          rarity: entry.rarity,
          affix: entry.affix,
          earned: entry.earned,
        },
        off: {
          weaponId: entry.offId,
          rarity: entry.offRarity ?? 0,
          affix: entry.offAffix ?? "",
          earned: entry.offEarned ?? false,
        },
        attrs,
        loadoutIds: [0, 1, 2].map((slot) => this.slotView(self, slot, entry).wid),
      });
      const rarity = RARITIES[entry.offRarity ?? 0];
      const color = rarity?.color ?? WEAPON_ACCENT[entry.offId] ?? 0xcfc6ae;
      const grades = Object.entries(offDef.scalingGrades ?? { str: "B" })
        .map(([attr, grade]) => `${attr.toUpperCase()} ${grade}`)
        .join(" · ");
      card.offSummaryPaper
        .clear()
        .fillStyle(0x070503, 0.97)
        .fillRect(-103, 80, 206, 64)
        .lineStyle(2, color, 0.86)
        .lineBetween(-102, 80, 102, 80);
      card.offName.setText(`⚯ ${offDef.name}`).setColor(`#${color.toString(16).padStart(6, "0")}`);
      card.offStats.setText(
        `Damage ${fmt(preview.offDamage)} · Cadence ${preview.offGapSeconds.toFixed(2)}s`,
      );
      card.offGrades.setText(`Grades ${grades} · Pair ${fmt(preview.combinedDps)}/s`);
      card.offSummary.setVisible(true);
    } else {
      card.offSummary.setVisible(false);
    }
  }

  /** Synchronize the fixed dock. Stable idle frames compare signatures and mutate no dock objects. */
  private updateCarousel(): void {
    const dock = this.carouselDock;
    if (!this.room || !dock) return;
    // Belt play remains a separate three-slot/bag product and owns all existing interaction contracts.
    if (this.belt) {
      if (dock.root.visible) {
        this.collapseCarouselDockFocus(true);
        dock.root.setVisible(false);
      }
      this.updateArsenalHud();
      return;
    }
    const self = this.room.state.players.get(this.room.sessionId);
    if (!self) return;
    const entry = loadoutEntryView(self);
    const blocked =
      this.inputModalBlocked(self) ||
      this.summonOpen ||
      !self.alive ||
      this.room.state.outcome !== "active";
    this.setCarouselDockBlocked(blocked);

    const ids = WEAPON_IDS;
    const n = ids.length;
    const selectedId = entry.leadId;
    const selectedIndex = ids.indexOf(selectedId);
    const selectionChanged = selectedId !== dock.selectedId || selectedIndex !== dock.selectedIndex;
    if (selectionChanged) {
      dock.selectedId = selectedId;
      dock.selectedIndex = selectedIndex;
      dock.layoutSig = "";
      dock.liveSig = "";
      setDockJunctionLoadout(this, dock.junction, selectedId, entry.offId);
      dock.junction.art.setVisible(selectedId !== FISTS_WEAPON);
    }

    const bottomIds: string[] = [];
    const rightIds: string[] = [];
    if (selectedIndex >= 0) {
      const offsets = ids
        .map((id, index) => ({ id, offset: wrappedDockOffset(index, selectedIndex, n) }))
        .filter(({ offset }) => offset !== 0 && Math.abs(offset) <= 2);
      bottomIds.push(
        ...offsets
          .filter(({ offset }) => offset < 0)
          .sort((a, b) => Math.abs(a.offset) - Math.abs(b.offset))
          .map(({ id }) => id),
      );
      rightIds.push(
        ...offsets
          .filter(({ offset }) => offset > 0)
          .sort((a, b) => a.offset - b.offset)
          .map(({ id }) => id),
      );
    } else {
      const used = new Set<string>();
      for (let index = 0; index < Math.min(2, n); index++) {
        const id = ids[index];
        if (id) {
          rightIds.push(id);
          used.add(id);
        }
      }
      for (let index = n - 1; index >= 0 && bottomIds.length < 2; index--) {
        const id = ids[index];
        if (id && !used.has(id)) bottomIds.push(id);
      }
    }

    const width = this.screenW();
    const height = this.screenH();
    const dockScale = Math.max(0.78, Math.min(1.25, Math.min(width / 1600, height / 900)));
    const hudRight = Math.max(
      20 * this.uiScale() + 240 * this.uiScale(),
      this.levelText.x + this.levelText.displayWidth,
      this.weaponText.x + this.weaponText.displayWidth,
      this.augmentText.visible ? this.augmentText.x + this.augmentText.displayWidth : 0,
    );
    const leftStop = Math.max(16 * dockScale, hudRight + 16 * dockScale);
    const topStop = Math.max(
      56 * dockScale,
      this.restartBtn.y + this.restartBtn.displayHeight + 12 * dockScale,
    );
    const layoutSig = [
      Math.round(width * 2),
      Math.round(height * 2),
      selectedId,
      selectedIndex,
      Math.round(leftStop * 2),
      Math.round(topStop * 2),
      bottomIds.join(","),
      rightIds.join(","),
    ].join(":");
    if (layoutSig !== dock.layoutSig) {
      dock.layoutSig = layoutSig;
      const layout = weaponDockLayout({
        screenWidth: width,
        screenHeight: height,
        rosterCount: n,
        bottomVisible: bottomIds.length,
        rightVisible: rightIds.length,
        leftStop,
        topStop,
      });
      this.layoutCarouselDock(self, layout, bottomIds, rightIds);
    }

    const activeSig = [
      entry.pairKey,
      entry.rarity,
      entry.affix,
      entry.charges,
      entry.maxCharges,
      entry.offRarity,
      entry.offAffix,
      entry.offCharges,
      entry.offMaxCharges,
      entry.nextHand,
      this.manifestEntryAt("active", entry.leadSlot)?.origin ?? "",
    ].join(":");
    if (activeSig !== dock.activeSig) {
      dock.activeSig = activeSig;
      setDockJunctionLoadout(this, dock.junction, entry.leadId, entry.offId);
      this.updateCarouselDockJunction(self);
    }
    const heldSig = `${entry.pairKey}:${entry.rarity}:${entry.affix}:${entry.offRarity}:${entry.offAffix}`;
    if (heldSig !== dock.heldSig) {
      dock.heldSig = heldSig;
      this.wakeCarouselDock();
    }
    if (selectionChanged && dock.state === "focused") this.showCarouselDockFocus();
    if (blocked) return;

    this.updateCarouselDockInspect();
    if (dock.state === "focused" && dock.currentDetailId) {
      const liveSig = [
        dock.currentDetailId,
        self.str,
        self.dex,
        self.int,
        self.con,
        self.luk,
        entry.pairKey,
        entry.rarity,
        entry.affix,
        entry.charges,
        entry.maxCharges,
        entry.offRarity,
        entry.offAffix,
        entry.offCharges,
        entry.offMaxCharges,
      ].join(":");
      if (liveSig !== dock.liveSig) {
        dock.liveSig = liveSig;
        const card = dock.detailCards.get(dock.currentDetailId);
        if (card) this.refreshCarouselDockCard(card, WEAPONS[card.id], self);
      }
    }
  }

  /** §29 meta-progression bank: the player's SCRIP persisted in localStorage, restored on belt join and
   *  re-saved whenever it changes. MVP persistence (client-local, single-machine) — a server/account bank
   *  can replace it later without touching the earn/sell loop. Clamped to the uint16 sync ceiling. */
  private loadBankedScrip(): number {
    try {
      const v = Number.parseInt(localStorage.getItem("dd.beltScrip") ?? "0", 10);
      return Number.isFinite(v) ? Math.max(0, Math.min(65535, v)) : 0;
    } catch {
      return 0; // storage blocked (private mode / sandbox) → start fresh, no crash
    }
  }
  private saveBankedScrip(scrip: number): void {
    try {
      localStorage.setItem("dd.beltScrip", String(Math.max(0, Math.min(65535, Math.floor(scrip)))));
    } catch {
      /* storage blocked — non-fatal, scrip just won't persist this session */
    }
  }

  /** §31 the persisted permanent-upgrade levels (the meta "account"), restored on belt join + re-saved on
   *  purchase. Client-local MVP (matches the scrip bank); a server/account store can replace the transport. */
  private loadUpgrades(): MetaLevels {
    try {
      return sanitizeMetaLevels(JSON.parse(localStorage.getItem("dd.beltUpgrades") ?? "{}"));
    } catch {
      return { ...EMPTY_META };
    }
  }
  private saveUpgrades(levels: MetaLevels): void {
    try {
      localStorage.setItem("dd.beltUpgrades", JSON.stringify(sanitizeMetaLevels(levels)));
    } catch {
      /* storage blocked — non-fatal */
    }
  }

  /** §29 a pooled, screen-pinned HUD text (lazily created), used by the arsenal + bag readouts. */
  private hudText(
    pool: Phaser.GameObjects.Text[],
    i: number,
    depth: number,
  ): Phaser.GameObjects.Text {
    let t = pool[i];
    if (!t) {
      t = this.add
        .text(0, 0, "", { fontFamily: "monospace", color: "#e8eef6" })
        .setScrollFactor(0)
        .setDepth(depth)
        .setResolution(Math.max(2, Math.ceil(RENDER_DPR))); // dockux-panel §4 text crispness
      pool[i] = t;
    }
    return t;
  }

  private selectBeltSlot(self: PlayerState, slot: number): void {
    const entry = loadoutEntryView(self);
    if (entry.offSlot === slot) {
      this.flashBanner("That weapon is bound as the off-hand", "#ff8a2b");
      return;
    }
    if (slot !== entry.leadSlot) this.room?.send("swapSlot", { slot });
  }

  /** Q sees a bound pair as one entry and never lands on its linked off-hand slot. */
  private cycleBeltLoadout(self: PlayerState, dir: -1 | 1): void {
    const entry = loadoutEntryView(self);
    for (let step = 1; step < 3; step++) {
      const slot = (((entry.leadSlot + dir * step) % 3) + 3) % 3;
      if (slot === entry.offSlot || !self.slots[slot]?.weapon) continue;
      this.room?.send("swapSlot", { slot });
      return;
    }
  }

  /** Active identity is projected through loadoutEntryView; the linked off row is display-only. */
  private slotView(
    self: PlayerState,
    i: number,
    entry = loadoutEntryView(self),
  ): { wid: string; rarity: number; linkedOff: boolean; paired: boolean } {
    if (i === entry.leadSlot) {
      return { wid: entry.leadId, rarity: entry.rarity, linkedOff: false, paired: !!entry.offId };
    }
    if (i === entry.offSlot) {
      return {
        wid: entry.offId ?? "",
        rarity: entry.offRarity ?? 0,
        linkedOff: true,
        paired: true,
      };
    }
    const sl = self.slots[i];
    return { wid: sl?.weapon ?? "", rarity: sl?.rarity ?? 0, linkedOff: false, paired: false };
  }

  private pairItemIdentity(item: PairPreviewItem): string {
    return `${item.weaponId}|${item.rarity}|${item.affix}|${Number(item.earned)}`;
  }

  private slotPairItem(self: PlayerState, slot: number): PairPreviewItem | undefined {
    if (slot === self.activeSlot) {
      const entry = loadoutEntryView(self);
      return {
        weaponId: entry.leadId,
        rarity: entry.rarity,
        affix: entry.affix,
        earned: entry.earned,
      };
    }
    const item = self.slots[slot];
    if (!item?.weapon) return undefined;
    return { weaponId: item.weapon, rarity: item.rarity, affix: item.affix, earned: item.earned };
  }

  private bagPairItem(self: PlayerState, index: number): PairPreviewItem | undefined {
    const item = self.bag[index];
    if (!item?.weapon) return undefined;
    return { weaponId: item.weapon, rarity: item.rarity, affix: item.affix, earned: item.earned };
  }

  private selectedPairItem(self: PlayerState): PairPreviewItem | undefined {
    const selected = this.pairCandidate;
    if (!selected) return undefined;
    const item =
      selected.source === "slot"
        ? this.slotPairItem(self, selected.index)
        : this.bagPairItem(self, selected.index);
    if (!item || this.pairItemIdentity(item) !== selected.identity) {
      this.pairCandidate = null;
      return undefined;
    }
    return item;
  }

  /** §29 belt ARSENAL HUD — 3 slot chips (active raised + bright rarity border, others dim) showing the
   *  weapon name tinted by rarity + the slot key, plus a scrip + bag readout. Click a chip to swap to it (or,
   *  with the bag open, to stash it). Immediate-mode Graphics + pooled Text + persistent click zones. */
  private updateArsenalHud(): void {
    const self = this.room?.state.players.get(this.room?.sessionId ?? "");
    if (!self) return;
    const entry = loadoutEntryView(self);
    const s = this.uiScale();
    if (!this.arsenalG) this.arsenalG = this.add.graphics().setScrollFactor(0).setDepth(100048);
    const g = this.arsenalG;
    g.clear();
    const panelUp = this.bagOpen || this.shopOpen;
    const modal = backpackModalLayout(this.screenW(), this.screenH());
    const chipW = panelUp ? Math.min(344, (modal.dock.width - 240) / 3) : 220;
    const chipH = panelUp ? (modal.mode === "wide" ? 72 : 64) : 64;
    const gap = panelUp ? 12 : 10;
    const total = 3 * chipW + 2 * gap;
    const x0 = this.screenW() / 2 - total / 2;
    const baseY = panelUp ? modal.dock.y + 18 : this.screenH() - chipH - 20;
    this.arsenalPairArt?.setVisible(false);
    for (let i = 0; i < 3; i++) {
      const active = i === entry.leadSlot;
      const { wid, rarity, linkedOff, paired } = this.slotView(self, i, entry);
      const empty = !wid || wid === "fists";
      const col = empty ? 0x39424e : (RARITIES[rarity]?.color ?? 0x9aa5b1);
      const x = x0 + i * (chipW + gap);
      const y = baseY - (active ? 8 : 0);
      g.fillStyle(0x0c1016, active ? 0.9 : 0.66).fillRoundedRect(x, y, chipW, chipH, 7 * s);
      g.lineStyle(active ? 3 * s : 1.5 * s, col, active ? 1 : 0.6).strokeRoundedRect(
        x,
        y,
        chipW,
        chipH,
        7 * s,
      );
      if (active && entry.offId) {
        const offCol = RARITIES[entry.offRarity ?? 0]?.color ?? 0xcfc6ae;
        g.lineStyle(2 * s, offCol, 0.95).lineBetween(x, y + chipH, x + chipW, y);
        const artKey = bakeSplitDockArt(this, entry.leadId, entry.offId);
        if (!this.arsenalPairArt) {
          this.arsenalPairArt = this.add.image(0, 0, artKey).setScrollFactor(0).setDepth(100049);
        } else if (this.arsenalPairArt.texture.key !== artKey) {
          this.arsenalPairArt.setTexture(artKey);
        }
        const artSize = 34 * s;
        const artX = x + 30 * s;
        const artY = y + chipH / 2;
        this.arsenalPairArt
          .setDisplaySize(artSize, artSize)
          .setPosition(artX, artY)
          .setVisible(true);
        g.lineStyle(1.5 * s, col, 1)
          .lineBetween(
            artX - artSize / 2,
            artY - artSize / 2,
            artX + artSize / 2,
            artY - artSize / 2,
          )
          .lineBetween(
            artX - artSize / 2,
            artY - artSize / 2,
            artX - artSize / 2,
            artY + artSize / 2,
          )
          .lineStyle(1.5 * s, offCol, 1)
          .lineBetween(
            artX + artSize / 2,
            artY - artSize / 2,
            artX + artSize / 2,
            artY + artSize / 2,
          )
          .lineBetween(
            artX - artSize / 2,
            artY + artSize / 2,
            artX + artSize / 2,
            artY + artSize / 2,
          );
      }
      // slot key
      const key = this.hudText(this.arsenalTexts, i, 100049)
        .setText(String(i + 1))
        .setColor(active ? "#ffe27a" : "#5c6672")
        .setPosition(x + 8 * s, y + 5 * s);
      key.setFontSize(14).setOrigin(0, 0);
      // weapon name (rarity-tinted); an empty slot says so instead of a dash that reads as a bug
      const leadName = WEAPONS[wid]?.name ?? "Unknown weapon";
      const nm = linkedOff
        ? `Bound to slot ${entry.leadSlot + 1}`
        : active && entry.offId
          ? `${leadName} × ${WEAPONS[entry.offId]?.name ?? "Unknown weapon"}`
          : empty
            ? "Empty"
            : leadName;
      const name = this.hudText(this.arsenalTexts, 3 + i, 100049)
        .setText(nm)
        .setColor(empty ? "#5c6672" : `#${col.toString(16).padStart(6, "0")}`)
        .setPosition(
          active && entry.offId ? x + chipW * 0.66 : x + chipW / 2,
          y + chipH / 2 + 3 * s,
        );
      name.setFontSize(nm.length > 22 ? 14 : 16).setOrigin(0.5, 0.5);
      const pairGlyph = this.hudText(this.arsenalTexts, 10 + i, 100049)
        .setText("⚯")
        .setColor(linkedOff ? "#7a8290" : "#f1e8cf")
        .setPosition(x + chipW - 7 * s, y + chipH - 3 * s)
        .setVisible(paired);
      pairGlyph.setFontSize(14).setOrigin(1, 1);
      const cost = empty ? undefined : driveCostView(wid);
      const found = this.manifestEntryAt("active", i)?.origin === "found";
      this.hudText(this.arsenalTexts, 13 + i, 100049)
        .setText(cost ? `${cost.pipText} ${cost.copy}${found ? " · FOUND · AT RISK" : ""}` : "")
        .setColor(found ? "#ffb24a" : "#a9cbd1")
        .setPosition(x + chipW / 2, y + chipH - 3 * s)
        .setFontSize(14)
        .setOrigin(0.5, 1)
        .setVisible(!!cost);
      // dockux-panel §3.4: while the panel is open, the slot chip itself says what a click does.
      const tag = this.hudText(this.arsenalTexts, 7 + i, 100049)
        .setText(
          paired
            ? linkedOff
              ? "Off-hand"
              : "Atomic pair"
            : this.bagWorkflow === "inventory"
              ? "STOW"
              : "SELECT",
        )
        .setColor(this.shopOpen ? "#ffd24a" : "#9fb0c2")
        .setPosition(x + chipW - 6 * s, y + 4 * s)
        .setVisible(panelUp);
      tag.setFontSize(14).setOrigin(1, 0);
      // click zone (swap to this slot, or stash it when the bag is open)
      let z = this.slotZones[i];
      if (!z) {
        z = this.add
          .rectangle(0, 0, 1, 1, 0xffffff, 0.001)
          .setScrollFactor(0)
          .setDepth(100047)
          .setInteractive();
        z.on("pointerdown", () => {
          const me = this.room?.state.players.get(this.room?.sessionId ?? "");
          if (!me) return;
          const live = loadoutEntryView(me);
          if (i === live.leadSlot && live.offId) {
            this.flashBanner(
              "Unbind for free at the Trading Post before moving either half",
              "#ff8a2b",
            );
            return;
          }
          if (i === live.offSlot) {
            this.flashBanner("The off-hand is part of one atomic pair", "#ff8a2b");
            return;
          }
          if (this.bagOpen && backpackTileIntent(this.bagWorkflow, "slot") === "stow") {
            // dockux-panel §2.2: say WHY a stow did nothing instead of failing silently.
            if (me.bag.length >= BAG_CAP)
              this.flashBanner(`Pack full — ${BAG_CAP}/${BAG_CAP}`, "#ff8a2b");
            else this.room?.send("bagStore", { slot: i });
          } else if (this.bagOpen || this.shopOpen) {
            this.bagSelected = { source: "slot", index: i };
            this.bagRenderSignature = "";
          } else {
            this.selectBeltSlot(me, i);
          }
        });
        this.slotZones[i] = z;
      }
      z.setPosition(x + chipW / 2, y + chipH / 2).setSize(chipW, chipH);

      const canPairSlot = false;
      const slotPairItem = canPairSlot ? this.slotPairItem(self, i) : undefined;
      const pairSlotSelected =
        !!slotPairItem &&
        this.pairCandidate?.source === "slot" &&
        this.pairCandidate.index === i &&
        this.pairCandidate.identity === this.pairItemIdentity(slotPairItem);
      let pairZone = this.pairSlotZones[i];
      if (!pairZone) {
        pairZone = this.add
          .rectangle(0, 0, 1, 1, 0xffffff, 0.001)
          .setScrollFactor(0)
          .setDepth(100050)
          .setInteractive();
        pairZone.on("pointerdown", () => {
          if (!this.shopOpen) return;
          const me = this.room?.state.players.get(this.room?.sessionId ?? "");
          const item = me ? this.slotPairItem(me, i) : undefined;
          const lead = me ? loadoutEntryView(me) : undefined;
          if (!item || !lead || !pairEligible(WEAPONS[lead.leadId], WEAPONS[item.weaponId])) return;
          this.pairCandidate = {
            source: "slot",
            index: i,
            identity: this.pairItemIdentity(item),
          };
        });
        this.pairSlotZones[i] = pairZone;
      }
      pairZone
        .setVisible(canPairSlot)
        .setPosition(x + chipW - 19 * s, y + chipH - 15 * s)
        .setSize(38 * s, 30 * s);
      if (canPairSlot) {
        g.fillStyle(0x0a0805, 0.92)
          .fillRoundedRect(x + chipW - 36 * s, y + chipH - 27 * s, 30 * s, 21 * s, 5 * s)
          .lineStyle(1.5 * s, pairSlotSelected ? 0x9cff6a : 0xffd479, 0.95)
          .strokeRoundedRect(x + chipW - 36 * s, y + chipH - 27 * s, 30 * s, 21 * s, 5 * s);
        pairGlyph.setColor(pairSlotSelected ? "#9cff6a" : "#ffd479").setVisible(true);
      }
    }
    // §30 class set-bonus for the current loadout (active slot = live held weapon, others = stored).
    const loadout = [0, 1, 2].map((i) => this.slotView(self, i, entry).wid);
    const setB = weaponSetBonus(loadout, entry.leadId);
    // scrip + pack + set-bonus readout above the chips (dockux-panel §2.2 vocabulary). While the panel
    // is open the capacity lives in the panel title instead (§3.2) — no duplicate Pack readout.
    const parts = ["[Q] Next slot", `◈ ${self.scrip} Scrip`];
    if (!(this.bagOpen || this.shopOpen))
      parts.push(`Pack ${self.bag.length}/${BAG_CAP}`, "[Tab] Backpack");
    if (setB > 1) parts.push(`⚔ Set bonus +${Math.round((setB - 1) * 100)}%`);
    const info = this.hudText(this.arsenalTexts, 6, 100049)
      .setText(parts.join(" · "))
      .setColor("#9fb0c2")
      .setPosition(this.screenW() / 2, baseY - 16 * s);
    info.setFontSize(14).setOrigin(0.5, 1);
    if (this.lastPairKey && entry.pairKey !== this.lastPairKey) {
      if (entry.offId) {
        this.pairCandidate = null;
        this.pairRequestLockedUntil = 0;
        const leadName = WEAPONS[entry.leadId]?.name ?? "Unknown weapon";
        const offName = WEAPONS[entry.offId]?.name ?? "Unknown weapon";
        this.flashBanner(`Bound — ${leadName} × ${offName}`, "#ffd479");
        this.audio.play("grab");
      } else if (this.lastPairKey.includes("|")) {
        this.pairCandidate = null;
        this.flashBanner("Unbound — no fee", "#9cff6a");
      }
    }
    this.lastPairKey = entry.pairKey;
    // §29 sale feedback: flash the scrip gained + a pickup blip when the total ticks up, and PERSIST the
    // running scrip bank so it carries to the next run (meta-progression — "send stuff back").
    if (self.scrip !== this.lastScrip) {
      if (this.lastScrip >= 0 && self.scrip > this.lastScrip) {
        this.flashBanner(`+◈ ${self.scrip - this.lastScrip} Scrip`, "#ffe27a");
        this.audio.play("grab");
      }
      this.saveBankedScrip(self.scrip);
      this.lastScrip = self.scrip;
    }
    // §31 persist permanent-upgrade levels whenever a purchase lands (the synced levels tick up).
    const upSig = `${self.upVitality},${self.upFortune},${self.upPower}`;
    if (upSig !== this.lastUpgradeSig) {
      this.saveUpgrades({
        vitality: self.upVitality,
        fortune: self.upFortune,
        power: self.upPower,
      });
      this.lastUpgradeSig = upSig;
    }
    this.updateShopkeeper(self, s);
    // dockux-panel §3.5 open/close choreography — the dock's deliberate pair (120 ms cubic-out rise /
    // 150 ms cubic-in drop). Zones disable on frame 0 of the close; reduced motion snaps both.
    const wantPanel = this.bagOpen || this.shopOpen;
    if (wantPanel) {
      if (!this.bagPanelShown) {
        this.bagPanelShown = true;
        this.bagPanelOpenAt = this.time.now;
      }
      this.bagPanelCloseAt = 0;
      this.bagPanelMode = this.shopOpen ? "shop" : "bag";
      this.renderArmoryBackpackPanel(self);
    } else if (this.bagPanelShown) {
      if (this.bagPanelCloseAt === 0) {
        this.bagPanelCloseAt = this.time.now;
        for (const z of this.bagZones) z.setVisible(false);
        for (const z of this.buyZones) z.setVisible(false);
        for (const z of this.pairSlotZones) z.setVisible(false);
        for (const z of this.bagPairZones) z.setVisible(false);
        this.pairConfirmZone?.setVisible(false);
        this.unbindZone?.setVisible(false);
        this.bagHoverCell = -1;
      }
      const done = prefersReducedPaperMotion() || this.time.now - this.bagPanelCloseAt >= 150;
      if (done) {
        this.bagPanelShown = false;
        this.bagPanelCloseAt = 0;
        this.hideBagPanel();
      } else {
        this.renderArmoryBackpackPanel(self);
      }
    }
  }

  /** §29 draw the world-space SHOPKEEPER at state.beltShopX (a lit market stall + keeper), a "Press F"
   *  prompt when the local player is in range, and re-tint when the SELL overlay is open. */
  private updateShopkeeper(self: PlayerState, _s: number): void {
    const shopX = this.room?.state.beltShopX ?? 0;
    if (shopX <= 0 || !this.beltLevel) {
      this.shopNpcG?.setVisible(false);
      this.shopPromptText?.setVisible(false);
      return;
    }
    if (!this.shopNpcG) {
      // WORLD space (scrolls with the camera) — depth just above the deck so the stall sits on the floor.
      this.shopNpcG = this.add.graphics().setDepth(BELT_Y0 + DEPTH_MAX + 5);
      const midDepth = BELT_Y0 + DEPTH_MAX * 0.5;
      const gy = this.beltY(midDepth); // screen-plane ground line at the stall's depth
      const gx = shopX;
      const g = this.shopNpcG;
      // awning
      g.fillStyle(0x8a2f3a, 1).fillRect(gx - 54, gy - 150, 108, 20);
      for (let i = 0; i < 6; i++)
        g.fillStyle(i % 2 ? 0xf2e6c8 : 0xd8b448, 1).fillRect(gx - 54 + i * 18, gy - 132, 18, 12);
      // posts + counter
      g.fillStyle(0x5a4632, 1)
        .fillRect(gx - 52, gy - 130, 6, 130)
        .fillRect(gx + 46, gy - 130, 6, 130);
      g.fillStyle(0x6b503a, 1).fillRect(gx - 56, gy - 44, 112, 16);
      // keeper (head + cloak)
      g.fillStyle(0x2a3550, 1).fillRect(gx - 16, gy - 96, 32, 52);
      g.fillStyle(0xe3b58f, 1).fillCircle(gx, gy - 104, 13);
      g.fillStyle(0x1d2740, 1).fillRect(gx - 15, gy - 118, 30, 10); // hood brim
      // sign (wide enough for TRADING POST — dockux-panel §2.1 canonical vendor name)
      g.fillStyle(0x101722, 0.9).fillRect(gx - 52, gy - 176, 104, 20);
      this.shopPromptText = this.add
        .text(gx, gy - 166, "TRADING POST", {
          fontFamily: "monospace",
          color: "#ffd479",
        })
        .setOrigin(0.5, 0.5)
        .setDepth(BELT_Y0 + DEPTH_MAX + 6);
      this.shopPromptText.setFontSize(12);
    }
    this.shopNpcG.setVisible(true);
    // Proximity prompt (screen-pinned would need a second object; reuse the world sign text swapping label).
    // Open = the stall name stays up, green (the open panel already shows the state); near = the key hint.
    const near = Math.abs(self.x - shopX) <= SHOP_RADIUS;
    if (this.shopPromptText) {
      this.shopPromptText
        .setText(this.shopOpen ? "TRADING POST" : near ? "[F] Trade" : "TRADING POST")
        .setColor(this.shopOpen || near ? "#9cff6a" : "#ffd479");
    }
  }

  /** §29 the Tab bag overlay — a grid of the bag's weapons; click one to EQUIP it into the active slot
   *  (swapping whatever was there back to the bag). Click a slot chip (below) to STASH it. Zones are pooled
   *  and repositioned each frame the panel is open; the unused tail is hidden. */
  /** §37 CLEAN MINIMAL panel border (the chosen UI frame) — drawn procedurally so it's crisp at any panel
   *  size + resolution: a thin double outline, four accent corner ticks, and one accent hairline across the
   *  top. Vector, no texture (the rendered art frames are ornate styles for later; minimal reads best drawn).
   *  Call right after the panel's fill, into the same immediate-mode Graphics `g`. */
  private drawPanelFrame(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    s: number,
  ): void {
    const ink = 0xcfd6de;
    const accent = 0x33e6ff;
    const r = 10 * s;
    // thin double line
    g.lineStyle(1.5 * s, ink, 0.85).strokeRoundedRect(x, y, w, h, r);
    g.lineStyle(1 * s, ink, 0.35).strokeRoundedRect(
      x + 4 * s,
      y + 4 * s,
      w - 8 * s,
      h - 8 * s,
      r - 2 * s,
    );
    // accent corner ticks — a short L just inside each corner
    const t = 14 * s;
    const o = 9 * s;
    g.lineStyle(2 * s, accent, 0.95);
    const corners: [number, number, number, number][] = [
      [x + o, y + o, 1, 1],
      [x + w - o, y + o, -1, 1],
      [x + o, y + h - o, 1, -1],
      [x + w - o, y + h - o, -1, -1],
    ];
    for (const [cx, cy, sx, sy] of corners) {
      g.beginPath();
      g.moveTo(cx + sx * t, cy);
      g.lineTo(cx, cy);
      g.lineTo(cx, cy + sy * t);
      g.strokePath();
    }
    // one accent hairline across the top
    g.lineStyle(1 * s, accent, 0.45);
    g.beginPath();
    g.moveTo(x + 22 * s, y + 2.5 * s);
    g.lineTo(x + w - 22 * s, y + 2.5 * s);
    g.strokePath();
  }

  /** Dashed outline for an empty Backpack socket (dockux-panel §3.1) — Graphics has no native dash. */
  private dashedRect(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    dash: number,
    gap: number,
  ): void {
    const edges: [number, number, number, number][] = [
      [x, y, x + w, y],
      [x + w, y, x + w, y + h],
      [x + w, y + h, x, y + h],
      [x, y + h, x, y],
    ];
    for (const [x1, y1, x2, y2] of edges) {
      const len = Math.hypot(x2 - x1, y2 - y1);
      const ux = (x2 - x1) / len;
      const uy = (y2 - y1) / len;
      for (let d = 0; d < len; d += dash + gap) {
        const e = Math.min(len, d + dash);
        g.lineBetween(x1 + ux * d, y1 + uy * d, x1 + ux * e, y1 + uy * e);
      }
    }
  }

  private renderArmoryBackpackPanel(self: PlayerState): void {
    const layout = backpackModalLayout(this.screenW(), this.screenH());
    this.bagDisplayOrder = this.sortedBackpackOrder(self);
    if (!this.bagSelected) {
      const first = this.bagDisplayOrder[this.bagFocusCell] ?? this.bagDisplayOrder[0];
      if (first !== undefined) this.bagSelected = { source: "bag", index: first };
    }
    const entry = loadoutEntryView(self);
    const bagIdentity = self.bag
      .map((item) => `${item.weapon}:${item.rarity}:${item.affix}:${item.earned}`)
      .join("|");
    const signature = [
      this.screenW(),
      this.screenH(),
      this.bagWorkflow,
      bagIdentity,
      entry.pairKey,
      entry.leadSlot,
      self.scrip,
      self.upVitality,
      self.upFortune,
      self.upPower,
      this.bagSelected?.source,
      this.bagSelected?.index,
      this.bagFocusCell,
      this.bagHoverCell,
    ].join(":");
    if (signature === this.bagRenderSignature) return;
    this.bagRenderSignature = signature;
    if (!this.bagG) this.bagG = this.add.graphics().setScrollFactor(0).setDepth(100044);
    const g = this.bagG.setVisible(true).setAlpha(1).clear();
    for (const text of this.bagTexts) text?.setVisible(false);
    for (const art of this.bagArts) art?.setVisible(false);
    for (const zone of this.buyZones) zone.setVisible(false);
    for (const zone of this.pairSlotZones) zone.setVisible(false);
    for (const zone of this.bagPairZones) zone.setVisible(false);
    this.pairConfirmZone?.setVisible(false);
    this.unbindZone?.setVisible(false);

    g.fillStyle(ARMORY_COLORS.bg, 0.66).fillRect(0, 0, this.screenW(), this.screenH());
    drawArmoryPanel(g, layout.panel.x, layout.panel.y, layout.panel.width, layout.panel.height, {
      fill: ARMORY_COLORS.surface0,
    });
    drawArmoryPanel(
      g,
      layout.header.x,
      layout.header.y,
      layout.header.width,
      layout.header.height,
      {
        fill: ARMORY_COLORS.surface1,
        major: false,
      },
    );
    drawArmoryPanel(
      g,
      layout.detail.x,
      layout.detail.y,
      layout.detail.width,
      layout.detail.height,
      {
        fill: ARMORY_COLORS.surface1,
      },
    );
    drawArmoryPanel(g, layout.dock.x, layout.dock.y, layout.dock.width, layout.dock.height, {
      fill: ARMORY_COLORS.surface1,
      major: false,
    });

    const title = this.hudText(this.bagTexts, 0, 100046)
      .setText(`BACKPACK  ${self.bag.length}/${BAG_CAP}`)
      .setPosition(layout.header.x + 24, layout.header.y + layout.header.height / 2)
      .setColor(ARMORY_CSS_COLORS.textPrimary)
      .setFontSize(24)
      .setFontStyle("bold")
      .setOrigin(0, 0.5)
      .setVisible(true);
    void title;
    this.hudText(this.bagTexts, 1, 100046)
      .setText("WORLD LIVE")
      .setPosition(layout.header.x + layout.header.width - 24, layout.header.y + 14)
      .setColor(ARMORY_CSS_COLORS.success)
      .setBackgroundColor(ARMORY_CSS_COLORS.surface3)
      .setPadding(10, 5, 10, 5)
      .setFontSize(14)
      .setFontStyle("bold")
      .setOrigin(1, 0)
      .setVisible(true);

    const workflows = ["inventory", "sell", "bind", "upgrades"] as const;
    const tabWidth = layout.mode === "wide" ? 132 : 108;
    workflows.forEach((workflow, index) => {
      const x = layout.header.x + 250 + index * (tabWidth + 8);
      const y = layout.header.y + layout.header.height / 2;
      const enabled = workflow === "inventory" || this.shopOpen;
      drawArmoryPanel(g, x, y - 23, tabWidth, 46, {
        major: false,
        selected: this.bagWorkflow === workflow,
        fill: enabled ? ARMORY_COLORS.surface2 : ARMORY_COLORS.surface0,
        accent: enabled ? undefined : ARMORY_COLORS.border,
      });
      this.hudText(this.bagTexts, 70 + index, 100046)
        .setText(workflow.toUpperCase())
        .setPosition(x + tabWidth / 2, y)
        .setColor(
          !enabled
            ? ARMORY_CSS_COLORS.textMuted
            : this.bagWorkflow === workflow
              ? ARMORY_CSS_COLORS.accent
              : ARMORY_CSS_COLORS.textSecondary,
        )
        .setFontSize(14)
        .setFontStyle("bold")
        .setOrigin(0.5)
        .setVisible(true);
      let zone = this.bagTabZones[index];
      if (!zone) {
        zone = this.add
          .rectangle(0, 0, 1, 1, 0xffffff, 0.001)
          .setScrollFactor(0)
          .setDepth(100052)
          .setInteractive({ useHandCursor: true });
        zone.on("pointerdown", () => {
          const target = workflows[index];
          if (!target || (target !== "inventory" && !this.shopOpen)) return;
          this.bagWorkflow = target;
          this.bagSelected = null;
          this.bagRenderSignature = "";
        });
        this.bagTabZones[index] = zone;
      }
      zone
        .setVisible(enabled)
        .setPosition(x + tabWidth / 2, y)
        .setSize(tabWidth, 46);
    });

    for (let cellIndex = 0; cellIndex < 12; cellIndex++) {
      const rect = layout.cells[cellIndex]!;
      const bagIndex = this.bagDisplayOrder[cellIndex];
      const item = bagIndex === undefined ? undefined : self.bag[bagIndex];
      const selected =
        !!item && this.bagSelected?.source === "bag" && this.bagSelected.index === bagIndex;
      const focused = cellIndex === this.bagFocusCell || cellIndex === this.bagHoverCell;
      if (!item?.weapon) {
        g.lineStyle(1, ARMORY_COLORS.border, 0.8);
        this.dashedRect(g, rect.x, rect.y, rect.width, rect.height, 8, 6);
        this.hudText(this.bagTexts, 10 + cellIndex, 100046)
          .setText(`EMPTY ${String(cellIndex + 1).padStart(2, "0")}`)
          .setPosition(rect.x + rect.width / 2, rect.y + rect.height / 2)
          .setColor(ARMORY_CSS_COLORS.textMuted)
          .setFontSize(14)
          .setOrigin(0.5)
          .setVisible(true);
        this.bagZones[cellIndex]?.setVisible(false);
        continue;
      }
      const rarityName = RARITIES[item.rarity]?.name ?? "Common";
      const rarityColor = RARITIES[item.rarity]?.color ?? ARMORY_COLORS.textSecondary;
      drawArmoryPanel(g, rect.x, rect.y, rect.width, rect.height, {
        major: false,
        selected: selected || focused,
        fill: ARMORY_COLORS.surface2,
        accent: selected ? ARMORY_COLORS.action : focused ? ARMORY_COLORS.accent : rarityColor,
      });
      const artKey = bakeCardArt(this, item.weapon, 212, 296, 14);
      let art = this.bagArts[cellIndex];
      if (!art) {
        art = this.add.image(0, 0, artKey).setScrollFactor(0).setDepth(100045);
        this.bagArts[cellIndex] = art;
      } else if (art.texture.key !== artKey) art.setTexture(artKey);
      const artWidth = layout.mode === "wide" ? 104 : 72;
      art
        .setCrop(0, 0, 212, 212)
        .setDisplaySize(artWidth, artWidth)
        .setPosition(rect.x + 10 + artWidth / 2, rect.y + 10 + artWidth / 2)
        .setVisible(true);
      const name = WEAPONS[item.weapon]?.name ?? "Unknown weapon";
      this.hudText(this.bagTexts, 10 + cellIndex, 100046)
        .setText(name.length > 24 ? `${name.slice(0, 23)}…` : name)
        .setPosition(rect.x + artWidth + 20, rect.y + 14)
        .setWordWrapWidth(rect.width - artWidth - 30)
        .setColor(`#${rarityColor.toString(16).padStart(6, "0")}`)
        .setFontSize(layout.mode === "wide" ? 16 : 14)
        .setFontStyle("bold")
        .setOrigin(0, 0)
        .setVisible(true);
      this.hudText(this.bagTexts, 30 + cellIndex, 100046)
        .setText(
          `${rarityMark(rarityName)}\n${item.affix ? affixById(item.affix).name : "No affix"}`,
        )
        .setPosition(rect.x + artWidth + 20, rect.y + (layout.mode === "wide" ? 68 : 52))
        .setWordWrapWidth(rect.width - artWidth - 30)
        .setColor(ARMORY_CSS_COLORS.textSecondary)
        .setFontSize(14)
        .setOrigin(0, 0)
        .setVisible(true);
      let zone = this.bagZones[cellIndex];
      if (!zone) {
        zone = this.add
          .rectangle(0, 0, 1, 1, 0xffffff, 0.001)
          .setScrollFactor(0)
          .setDepth(100051)
          .setInteractive({ useHandCursor: true });
        zone.on("pointerover", () => {
          this.bagHoverCell = cellIndex;
          this.bagFocusCell = cellIndex;
          this.bagRenderSignature = "";
        });
        zone.on("pointerout", () => {
          if (this.bagHoverCell === cellIndex) this.bagHoverCell = -1;
          this.bagRenderSignature = "";
        });
        zone.on("pointerdown", () => {
          const me = this.room?.state.players.get(this.room?.sessionId ?? "");
          const index = this.bagDisplayOrder[cellIndex];
          if (!me || index === undefined || index >= me.bag.length) return;
          this.bagSelected = { source: "bag", index };
          this.bagFocusCell = cellIndex;
          this.bagRenderSignature = "";
          if (backpackTileIntent(this.bagWorkflow, "bag") === "equip") {
            this.activateBackpackSelection(me);
          }
        });
        this.bagZones[cellIndex] = zone;
      }
      zone
        .setVisible(true)
        .setPosition(rect.x + rect.width / 2, rect.y + rect.height / 2)
        .setSize(rect.width, rect.height);
    }

    let selectedWeaponId = "";
    let selectedRarity = 0;
    let selectedAffix = "";
    let selectedEarned = false;
    if (this.bagSelected?.source === "bag") {
      const selected = self.bag[this.bagSelected.index];
      selectedWeaponId = selected?.weapon ?? "";
      selectedRarity = selected?.rarity ?? 0;
      selectedAffix = selected?.affix ?? "";
      selectedEarned = selected?.earned ?? false;
    } else if (this.bagSelected?.source === "slot") {
      const selected = this.slotPairItem(self, this.bagSelected.index);
      selectedWeaponId = selected?.weaponId ?? "";
      selectedRarity = selected?.rarity ?? 0;
      selectedAffix = selected?.affix ?? "";
      selectedEarned = selected?.earned ?? false;
    }
    const weapon = WEAPONS[selectedWeaponId];
    const rarityName = RARITIES[selectedRarity]?.name ?? "Common";
    const detailX = layout.detail.x + 20;
    const detailWidth = layout.detail.width - 40;
    this.hudText(this.bagTexts, 50, 100046)
      .setText(
        this.bagWorkflow === "upgrades" ? "PERMANENT UPGRADE" : (weapon?.name ?? "SELECT AN ITEM"),
      )
      .setPosition(detailX, layout.detail.y + 20)
      .setWordWrapWidth(detailWidth)
      .setColor(ARMORY_CSS_COLORS.textPrimary)
      .setFontSize(18)
      .setFontStyle("bold")
      .setOrigin(0, 0)
      .setVisible(true);

    let detailCopy =
      "Choose a tile with arrows or pointer. Selection stays here while you compare.";
    let actionLabel = "SELECT AN ITEM";
    let actionEnabled = false;
    if (this.bagWorkflow === "upgrades") {
      const upgradeIndex = this.bagFocusCell % META_UPGRADES.length;
      const upgrade = META_UPGRADES[upgradeIndex];
      const level =
        upgrade?.id === "vitality"
          ? self.upVitality
          : upgrade?.id === "fortune"
            ? self.upFortune
            : self.upPower;
      const cost = upgrade ? nextUpgradeCost(upgrade.id, level) : null;
      detailCopy = upgrade
        ? `${upgrade.name}  ${level}/${upgrade.maxLevel}\n${upgrade.desc}\n\nPermanent across runs.\nScrip available  ◈${self.scrip}`
        : "No upgrade selected";
      actionLabel = cost === null ? "MAXIMUM RANK" : `BUY ${upgrade?.name.toUpperCase()}  ◈${cost}`;
      actionEnabled = cost !== null && self.scrip >= cost;
    } else if (weapon) {
      const value = scripValue(selectedRarity, selectedEarned);
      detailCopy = `${rarityMark(rarityName)}\n${selectedAffix ? affixById(selectedAffix).name : "No affix"}\n\n${this.bagSelected?.source === "slot" ? `Active cell ${(this.bagSelected.index ?? 0) + 1}` : "Stored in backpack"}\nValue  ◈${value}\n\n${this.bagWorkflow === "sell" ? "Selling is final for this run." : this.bagWorkflow === "bind" ? "Binding creates one atomic two-cell pair." : `Equips into active cell ${self.activeSlot + 1}.`}`;
      if (this.bagWorkflow === "inventory") {
        actionLabel =
          this.bagSelected?.source === "slot"
            ? "STOW IN BACKPACK"
            : `EQUIP IN ACTIVE ${self.activeSlot + 1}`;
        actionEnabled = true;
      } else if (this.bagWorkflow === "sell") {
        actionLabel = value > 0 ? `SELL FOR ◈${value}` : "NO SELL VALUE";
        actionEnabled = value > 0;
      } else {
        actionLabel = entry.offId ? "UNBIND PAIR — FREE" : "BIND SELECTED PAIR";
        actionEnabled = !!entry.offId || pairEligible(WEAPONS[entry.leadId], weapon);
      }
    } else if (this.bagWorkflow === "bind" && entry.offId) {
      detailCopy = `${WEAPONS[entry.leadId]?.name ?? "Lead"} × ${WEAPONS[entry.offId]?.name ?? "Off-hand"}\n\nAtomic pair occupies two active cells.`;
      actionLabel = "UNBIND PAIR — FREE";
      actionEnabled = true;
    }
    this.hudText(this.bagTexts, 51, 100046)
      .setText(detailCopy)
      .setPosition(detailX, layout.detail.y + 62)
      .setWordWrapWidth(detailWidth)
      .setColor(ARMORY_CSS_COLORS.textSecondary)
      .setFontSize(14)
      .setLineSpacing(5)
      .setOrigin(0, 0)
      .setVisible(true);
    const actionRect = {
      x: layout.detail.x + 20,
      y: layout.detail.y + layout.detail.height - 72,
      width: layout.detail.width - 40,
      height: 52,
    };
    drawArmoryPanel(g, actionRect.x, actionRect.y, actionRect.width, actionRect.height, {
      major: false,
      fill: actionEnabled ? 0x342b1a : ARMORY_COLORS.surface2,
      accent: actionEnabled ? ARMORY_COLORS.action : ARMORY_COLORS.border,
    });
    this.hudText(this.bagTexts, 52, 100053)
      .setText(actionLabel)
      .setPosition(actionRect.x + actionRect.width / 2, actionRect.y + actionRect.height / 2)
      .setColor(actionEnabled ? ARMORY_CSS_COLORS.action : ARMORY_CSS_COLORS.textMuted)
      .setFontSize(14)
      .setFontStyle("bold")
      .setOrigin(0.5)
      .setVisible(true);
    if (!this.bagActionZone) {
      this.bagActionZone = this.add
        .rectangle(0, 0, 1, 1, 0xffffff, 0.001)
        .setScrollFactor(0)
        .setDepth(100054)
        .setInteractive({ useHandCursor: true });
      this.bagActionZone.on("pointerdown", () => {
        const me = this.room?.state.players.get(this.room?.sessionId ?? "");
        if (me) this.activateBackpackSelection(me);
      });
    }
    this.bagActionZone
      .setVisible(actionEnabled)
      .setPosition(actionRect.x + actionRect.width / 2, actionRect.y + actionRect.height / 2)
      .setSize(actionRect.width, actionRect.height);
    this.hudText(this.bagTexts, 53, 100046)
      .setText(
        `[Q] ACTIVE SLOT  ·  [1–3] DIRECT  ·  [Z/X] WORKFLOW  ·  [ENTER] ACTION  ·  [TAB/ESC] CLOSE  ·  ◈${self.scrip}`,
      )
      .setPosition(layout.dock.x + layout.dock.width - 24, layout.dock.y + layout.dock.height - 18)
      .setColor(ARMORY_CSS_COLORS.textSecondary)
      .setFontSize(14)
      .setOrigin(1, 1)
      .setVisible(true);
  }

  private renderBagPanel(self: PlayerState, s: number): void {
    if (!this.bagG) this.bagG = this.add.graphics().setScrollFactor(0).setDepth(100044);
    const g = this.bagG.setVisible(true);
    g.clear();
    const shop = this.bagPanelMode === "shop";
    const entry = loadoutEntryView(self);
    // §3.5 choreography: 120 ms cubic-out rise on open, 150 ms cubic-in drop on close (zones are
    // already disabled by the caller on close frame 0). Reduced motion snaps.
    const reduced = prefersReducedPaperMotion();
    const closing = this.bagPanelCloseAt > 0;
    let panelAlpha = 1;
    let rise = 0;
    if (closing) {
      const q = paperClamp01((this.time.now - this.bagPanelCloseAt) / 150);
      const e = q * q * q; // Cubic.easeIn
      panelAlpha = 1 - e;
      rise = 8 * s * e;
    } else if (!reduced) {
      const e = paperCubicOut((this.time.now - this.bagPanelOpenAt) / 120);
      panelAlpha = e;
      rise = 8 * s * (1 - e);
    }
    const zonesActive = !closing;
    g.setAlpha(panelAlpha);
    const show = (t: Phaser.GameObjects.Text) => t.setVisible(true).setAlpha(panelAlpha);

    const panelW = Math.min(this.screenW() - 80 * s, 720 * s);
    const upgradeBandH = shop ? 74 * s : 0;
    const pairBandH = shop ? 100 * s : 0;
    const bandH = upgradeBandH + pairBandH;
    const headerH = 34 * s;
    const cellH = 56 * s;
    const rowGap = 8 * s;
    const panelH = headerH + bandH + 3 * (cellH + rowGap) + 14 * s;
    const px = this.screenW() / 2 - panelW / 2;
    const py = this.screenH() - 84 * s - panelH - 18 * s + rise;
    g.fillStyle(0x070a0f, 0.92).fillRoundedRect(px, py, panelW, panelH, 10 * s);
    this.drawPanelFrame(g, px, py, panelW, panelH, s); // §37 Clean Minimal border

    // §3.2 capacity lives in the title and turns amber at full; §3.4 one key hint per mode.
    const full = self.bag.length >= BAG_CAP;
    const title = this.hudText(this.bagTexts, 0, 100046)
      .setText(shop ? "TRADING POST" : `BACKPACK ${self.bag.length}/${BAG_CAP}`)
      .setColor(shop ? "#ffd479" : full ? "#ff8a2b" : "#9fb0c2")
      .setPosition(px + 16 * s, py + 10 * s);
    title
      .setFontSize(13 * s)
      .setOrigin(0, 0)
      .setFontStyle("bold");
    show(title);
    const hint = this.hudText(this.bagTexts, 1, 100046)
      .setText(shop ? "[Click] Sell · [F] Close" : "[Click] Equip · [Tab] Close")
      .setColor("#7a8290")
      .setPosition(px + panelW - 16 * s, py + 12 * s);
    hint
      .setFontSize(10 * s)
      .setOrigin(1, 0)
      .setFontStyle("normal");
    show(hint);

    if (shop) {
      this.renderUpgradeBand(self, s, px, py + headerH, panelW, panelAlpha, zonesActive);
      this.renderBindBand(
        self,
        s,
        px,
        py + headerH + upgradeBandH,
        panelW,
        pairBandH,
        panelAlpha,
        zonesActive,
      );
    } else {
      // Bag mode: make sure the shop's upgrade band (zones + texts) is hidden so it can't intercept clicks.
      for (const z of this.buyZones) z.setVisible(false);
      for (const z of this.pairSlotZones) z.setVisible(false);
      for (const z of this.bagPairZones) z.setVisible(false);
      this.pairConfirmZone?.setVisible(false);
      this.unbindZone?.setVisible(false);
      for (let i = 70; i <= 80; i++) this.bagTexts[i]?.setVisible(false);
      for (let i = 82; i <= 89; i++) this.bagTexts[i]?.setVisible(false);
    }

    // §3.2 display-order sort (tier desc → name asc → stable). The server's bag array order stays
    // authoritative for messages: visual cell k targets index bagDisplayOrder[k], rebuilt in the same
    // pass as the zones so a sort can never retarget a click mid-flight.
    this.bagDisplayOrder = self.bag
      .map((_, idx) => idx)
      .sort((a, b) => {
        const ia = self.bag[a];
        const ib = self.bag[b];
        const tierDelta = (ib?.rarity ?? 0) - (ia?.rarity ?? 0);
        if (tierDelta !== 0) return tierDelta;
        const nameA = WEAPONS[ia?.weapon ?? ""]?.name ?? "Unknown weapon";
        const nameB = WEAPONS[ib?.weapon ?? ""]?.name ?? "Unknown weapon";
        return nameA.localeCompare(nameB) || a - b;
      });

    const cols = 4;
    const cellW = (panelW - 32 * s) / cols;
    const gx = px + 16 * s;
    const gy = py + headerH + bandH;
    let hoverLine = "";
    for (let k = 0; k < BAG_CAP; k++) {
      const bagIndex = this.bagDisplayOrder[k];
      const item = bagIndex === undefined ? undefined : self.bag[bagIndex];
      const zone = (() => {
        let z = this.bagZones[k];
        if (!z) {
          z = this.add
            .rectangle(0, 0, 1, 1, 0xffffff, 0.001)
            .setScrollFactor(0)
            .setDepth(100045)
            .setInteractive();
          z.on("pointerdown", () => {
            const idx = this.bagDisplayOrder[k];
            const me = this.room?.state.players.get(this.room?.sessionId ?? "");
            if (idx === undefined || !me || idx >= me.bag.length) return;
            if (this.shopOpen) this.room?.send("sellWeapon", { from: "bag", index: idx });
            else if (this.bagOpen) this.room?.send("bagEquip", { index: idx, slot: me.activeSlot });
          });
          z.on("pointerover", () => {
            this.bagHoverCell = k;
          });
          z.on("pointerout", () => {
            if (this.bagHoverCell === k) this.bagHoverCell = -1;
          });
          this.bagZones[k] = z;
        }
        return z;
      })();
      const cx = gx + (k % cols) * cellW;
      const cy = gy + Math.floor(k / cols) * (cellH + rowGap);
      const w = cellW - 8 * s;
      if (!item?.weapon) {
        // §3.1 empty cells RENDER: the player sees 12 sockets, 7 full — capacity stays readable.
        zone.setVisible(false);
        g.lineStyle(Math.max(1, 1 * s), 0x3a3f47, 0.5);
        this.dashedRect(g, cx, cy, w, cellH, 6 * s, 4 * s);
        this.bagArts[k]?.setVisible(false);
        this.bagTexts[10 + k]?.setVisible(false);
        this.bagTexts[25 + k]?.setVisible(false);
        this.bagTexts[40 + k]?.setVisible(false);
        this.bagTexts[100 + k]?.setVisible(false);
        this.bagPairZones[k]?.setVisible(false);
        continue;
      }
      const bagItem: PairPreviewItem = {
        weaponId: item.weapon,
        rarity: item.rarity,
        affix: item.affix,
        earned: item.earned,
      };
      const pairable =
        shop && !entry.offId && pairEligible(WEAPONS[entry.leadId], WEAPONS[item.weapon]);
      const pairSelected =
        pairable &&
        this.pairCandidate?.source === "bag" &&
        this.pairCandidate.index === bagIndex &&
        this.pairCandidate.identity === this.pairItemIdentity(bagItem);
      const hovered = zonesActive && this.bagHoverCell === k;
      const col = RARITIES[item.rarity]?.color ?? 0x9aa5b1;
      const colHex = `#${col.toString(16).padStart(6, "0")}`;
      g.fillStyle(0x121821, 0.95).fillRoundedRect(cx, cy, w, cellH, 6 * s);
      // §3.3 the border shifts to amber on hover in Trading mode — this click sells.
      g.lineStyle(
        (pairSelected ? 2.5 : 1.5) * s,
        pairSelected ? 0x9cff6a : shop && hovered ? 0xffd24a : col,
        hovered || pairSelected ? 1 : 0.8,
      ).strokeRoundedRect(cx, cy, w, cellH, 6 * s);
      // §3.1 item card in the dock's visual language: 44×44 art thumbnail off the shared cardbg bake.
      const artKey = bakeCardArt(this, item.weapon, 212, 296, 14);
      let art = this.bagArts[k];
      if (!art) {
        art = this.add.image(0, 0, artKey).setScrollFactor(0).setDepth(100045);
        this.bagArts[k] = art;
      } else if (art.texture.key !== artKey) {
        art.setTexture(artKey);
      }
      const artSize = 44 * s;
      const dispH = (artSize * 296) / 212; // crop shows the top 212 square of the 212×296 bake
      art
        .setCrop(0, 0, 212, 212)
        .setDisplaySize(artSize, dispH)
        .setPosition(cx + 6 * s + artSize / 2, cy + 6 * s + dispH / 2)
        .setVisible(true)
        .setAlpha(panelAlpha);
      const baseName = WEAPONS[item.weapon]?.name ?? "Unknown weapon";
      const shownName = baseName.length > 16 ? `${baseName.slice(0, 15)}…` : baseName;
      const nameT = this.hudText(this.bagTexts, 10 + k, 100046)
        .setText(shownName)
        .setColor(colHex)
        .setPosition(cx + 6 * s + artSize + 6 * s, cy + 7 * s);
      nameT
        .setFontSize(12 * s)
        .setOrigin(0, 0)
        .setFontStyle("bold");
      show(nameT);
      const affixName = item.affix ? affixById(item.affix).name : "";
      const tierLine = [RARITIES[item.rarity]?.name ?? "", affixName].filter(Boolean).join(" · ");
      const tierT = this.hudText(this.bagTexts, 25 + k, 100046)
        .setText(tierLine)
        .setColor(colHex)
        .setPosition(cx + 6 * s + artSize + 6 * s, cy + 24 * s);
      tierT
        .setFontSize(10 * s)
        .setOrigin(0, 0)
        .setFontStyle("normal");
      show(tierT);
      // §4 redundant tier pips beside the tier name.
      if (item.rarity > 0 && tierLine) {
        const pipR = Math.max(2, 2.2 * s);
        drawTierPips(
          g,
          tierT.x + tierT.displayWidth + 4 * s + pipR,
          cy + 24 * s + tierT.displayHeight / 2,
          item.rarity,
          pipR,
        );
      }
      // §3.3 value chip — Trading mode only; price is trade-context information.
      const price = scripValue(item.rarity, item.earned);
      if (shop) {
        const valueT = this.hudText(this.bagTexts, 40 + k, 100046)
          .setText(price > 0 ? `◈ ${price}` : "No value")
          .setColor(price > 0 ? "#9cff6a" : "#5a6472")
          .setPosition(cx + w - 6 * s, cy + cellH - 4 * s);
        valueT
          .setFontSize((price > 0 ? 11 : 10) * s)
          .setOrigin(1, 1)
          .setFontStyle(price > 0 ? "bold" : "normal");
        show(valueT);
      } else {
        this.bagTexts[40 + k]?.setVisible(false);
      }
      const pairBadge = this.hudText(this.bagTexts, 100 + k, 100051)
        .setText("⚯")
        .setColor(pairSelected ? "#9cff6a" : "#ffd479")
        .setPosition(cx + w - 7 * s, cy + 5 * s)
        .setVisible(pairable)
        .setAlpha(panelAlpha);
      pairBadge.setFontSize(14 * s).setOrigin(1, 0);
      let pairZone = this.bagPairZones[k];
      if (!pairZone) {
        pairZone = this.add
          .rectangle(0, 0, 1, 1, 0xffffff, 0.001)
          .setScrollFactor(0)
          .setDepth(100052)
          .setInteractive();
        pairZone.on("pointerdown", () => {
          if (!this.shopOpen) return;
          const idx = this.bagDisplayOrder[k];
          const me = this.room?.state.players.get(this.room?.sessionId ?? "");
          const selected = idx === undefined || !me ? undefined : this.bagPairItem(me, idx);
          const lead = me ? loadoutEntryView(me) : undefined;
          if (
            idx === undefined ||
            !selected ||
            !lead ||
            !pairEligible(WEAPONS[lead.leadId], WEAPONS[selected.weaponId])
          )
            return;
          this.pairCandidate = {
            source: "bag",
            index: idx,
            identity: this.pairItemIdentity(selected),
          };
        });
        this.bagPairZones[k] = pairZone;
      }
      pairZone
        .setVisible(pairable && zonesActive)
        .setPosition(cx + w - 18 * s, cy + 17 * s)
        .setSize(36 * s, 34 * s);
      if (pairable) {
        g.fillStyle(0x0a0805, 0.9)
          .fillRoundedRect(cx + w - 34 * s, cy + 4 * s, 28 * s, 24 * s, 5 * s)
          .lineStyle(1 * s, pairSelected ? 0x9cff6a : 0xffd479, 0.9)
          .strokeRoundedRect(cx + w - 34 * s, cy + 4 * s, 28 * s, 24 * s, 5 * s);
      }
      if (hovered) {
        hoverLine = shop
          ? price > 0
            ? `Sell ${baseName} for ◈ ${price}`
            : `${baseName} has no sell value`
          : `Equip ${baseName} — swaps with slot ${self.activeSlot + 1}`;
      }
      zone
        .setVisible(zonesActive)
        .setPosition(cx + w / 2, cy + cellH / 2)
        .setSize(w, cellH);
    }

    // §2.2 empty-state: an empty pack says so instead of rendering an unexplained hole.
    const emptyMain = this.hudText(this.bagTexts, 2, 100046);
    const emptySub = this.hudText(this.bagTexts, 3, 100046);
    if (self.bag.length === 0) {
      const gridMidY = gy + (3 * (cellH + rowGap) - rowGap) / 2;
      emptyMain
        .setText("Your pack is empty")
        .setColor("#9fb0c2")
        .setPosition(px + panelW / 2, gridMidY - 10 * s)
        .setFontSize(13 * s)
        .setOrigin(0.5, 1)
        .setFontStyle("bold");
      show(emptyMain);
      emptySub
        .setText(shop ? "Nothing to sell" : "Click a slot below to stow its weapon")
        .setColor("#7a8290")
        .setPosition(px + panelW / 2, gridMidY + 4 * s)
        .setFontSize(10 * s)
        .setOrigin(0.5, 0)
        .setFontStyle("normal");
      show(emptySub);
    } else {
      emptyMain.setVisible(false);
      emptySub.setVisible(false);
    }

    // §3.4 hover footer — the affordance lives on the thing, spelled out once at the panel foot.
    const footer = this.hudText(this.bagTexts, 4, 100046);
    if (hoverLine) {
      footer
        .setText(hoverLine)
        .setColor("#cfd6de")
        .setPosition(px + panelW / 2, py + panelH - 5 * s)
        .setFontSize(11 * s)
        .setOrigin(0.5, 1)
        .setFontStyle("normal");
      show(footer);
    } else {
      footer.setVisible(false);
    }
  }

  private confirmPair(self: PlayerState): void {
    if (this.time.now < this.pairRequestLockedUntil) return;
    const entry = loadoutEntryView(self);
    if (entry.offId) return;
    const candidate = this.selectedPairItem(self);
    if (!candidate) return;
    const lead: PairPreviewItem = {
      weaponId: entry.leadId,
      rarity: entry.rarity,
      affix: entry.affix,
      earned: entry.earned,
    };
    const preview = pairPreview({
      lead,
      off: candidate,
      attrs: { str: self.str, dex: self.dex, int: self.int, con: self.con, luk: self.luk },
      loadoutIds: [0, 1, 2].map((slot) => this.slotView(self, slot, entry).wid),
    });
    if (!preview.eligible) {
      this.flashBanner("These weapons cannot be bound", "#ff8a2b");
      return;
    }
    if (self.scrip < preview.fee) {
      this.flashBanner(`Not enough Scrip — need ◈ ${preview.fee}`, "#ff8a2b");
      return;
    }
    const selected = this.pairCandidate;
    if (!selected) return;
    this.pairRequestLockedUntil = this.time.now + 1200;
    if (selected.source === "slot") {
      this.room?.send("bindPair", { off: selected.index });
    } else {
      const offSlots = [0, 1, 2]
        .filter((slot) => slot !== entry.leadSlot)
        .sort((a, b) => Number(!!self.slots[a]?.weapon) - Number(!!self.slots[b]?.weapon) || a - b);
      const target = offSlots[0];
      if (target === undefined) return;
      // Colyseus preserves message order: first move the chosen pack identity into its deterministic
      // arsenal row, then bind that row. The preview remains exact and no mutation happens before confirm.
      this.room?.send("bagEquip", { index: selected.index, slot: target });
      this.room?.send("bindPair", { off: target });
    }
  }

  private renderBindBand(
    self: PlayerState,
    s: number,
    px: number,
    y: number,
    panelW: number,
    h: number,
    panelAlpha: number,
    zonesActive: boolean,
  ): void {
    const g = this.bagG;
    if (!g) return;
    const entry = loadoutEntryView(self);
    const lead: PairPreviewItem = {
      weaponId: entry.leadId,
      rarity: entry.rarity,
      affix: entry.affix,
      earned: entry.earned,
    };
    const candidate = entry.offId ? undefined : this.selectedPairItem(self);
    const preview = candidate
      ? pairPreview({
          lead,
          off: candidate,
          attrs: { str: self.str, dex: self.dex, int: self.int, con: self.con, luk: self.luk },
          loadoutIds: [0, 1, 2].map((slot) => this.slotView(self, slot, entry).wid),
        })
      : undefined;
    const eligibleCount = entry.offId
      ? 0
      : [
          ...[0, 1, 2]
            .filter((slot) => slot !== entry.leadSlot)
            .map((slot) => self.slots[slot]?.weapon ?? ""),
          ...self.bag.map((item) => item.weapon),
        ].filter((id) => pairEligible(WEAPONS[entry.leadId], WEAPONS[id])).length;
    const bx = px + 16 * s;
    const bw = panelW - 32 * s;
    const buttonW = 132 * s;
    const buttonH = 42 * s;
    const buttonX = bx + bw - buttonW;
    const buttonY = y + (h - buttonH) / 2;
    g.fillStyle(0x0d1219, 0.98)
      .fillRoundedRect(bx, y + 4 * s, bw, h - 8 * s, 7 * s)
      .lineStyle(1.5 * s, entry.offId ? 0x9cff6a : 0xffd479, 0.75)
      .strokeRoundedRect(bx, y + 4 * s, bw, h - 8 * s, 7 * s);
    const show = (text: Phaser.GameObjects.Text) => text.setVisible(true).setAlpha(panelAlpha);
    const title = this.hudText(this.bagTexts, 82, 100046)
      .setText(entry.offId ? "BOUND PAIR" : "BIND")
      .setColor(entry.offId ? "#9cff6a" : "#ffd479")
      .setPosition(bx + 10 * s, y + 10 * s)
      .setFontSize(11 * s)
      .setFontStyle("bold");
    show(title);

    const line1 = this.hudText(this.bagTexts, 83, 100046)
      .setPosition(bx + 10 * s, y + 29 * s)
      .setFontSize(12 * s)
      .setFontStyle("bold");
    const line2 = this.hudText(this.bagTexts, 84, 100046)
      .setPosition(bx + 10 * s, y + 48 * s)
      .setFontSize(10 * s);
    const line3 = this.hudText(this.bagTexts, 85, 100046)
      .setPosition(bx + 10 * s, y + 64 * s)
      .setFontSize(10 * s);
    const truth = this.hudText(this.bagTexts, 86, 100046)
      .setPosition(bx + 10 * s, y + 80 * s)
      .setFontSize(9 * s)
      .setColor("#7a8290");
    const fmt = (value: number) =>
      Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");

    if (entry.offId) {
      const leadName = WEAPONS[entry.leadId]?.name ?? "Unknown weapon";
      const offName = WEAPONS[entry.offId]?.name ?? "Unknown weapon";
      line1.setText(`${leadName} × ${offName}`).setColor("#f1e8cf");
      line2.setText("One atomic loadout entry · alternating hands").setColor("#cfd6de");
      line3.setText("Unbind fee ◈ 0").setColor("#9cff6a");
      truth.setText(
        "Both halves keep their exact tier, affix, cadence debt, and one shared Drive bar.",
      );
    } else if (candidate && preview?.eligible) {
      const leadName = WEAPONS[lead.weaponId]?.name ?? "Unknown weapon";
      const offName = WEAPONS[candidate.weaponId]?.name ?? "Unknown weapon";
      line1.setText(`${leadName} × ${offName}`).setColor("#f1e8cf");
      line2
        .setText(
          `Damage ${fmt(preview.leadDamage)} + ${fmt(preview.offDamage)} · Pair ${fmt(preview.combinedDps)}/s`,
        )
        .setColor("#cfd6de");
      line3
        .setText(
          `Cadence ${preview.leadGapSeconds.toFixed(2)}s / ${preview.offGapSeconds.toFixed(2)}s${preview.separateMagazines ? " · Separate magazines" : ""}`,
        )
        .setColor("#cfd6de");
      truth.setText(
        `Fee ◈ ${preview.fee} — better half's sell value · Preview is final; no rerolls.`,
      );
    } else {
      line1
        .setText(
          eligibleCount > 0
            ? "Choose an ⚯ weapon from your slots or pack"
            : "No compatible carried weapon",
        )
        .setColor(eligibleCount > 0 ? "#f1e8cf" : "#7a8290");
      line2.setText("The held weapon stays in the lead hand.").setColor("#cfd6de");
      line3
        .setText("Requires a different one-handed weapon of the same class and delivery.")
        .setColor("#7a8290");
      truth.setText("Nothing changes until you review the preview and confirm.");
    }
    show(line1);
    show(line2);
    show(line3);
    show(truth);

    const buttonEnabled = entry.offId || !!preview?.eligible;
    const requestPending = !entry.offId && this.time.now < this.pairRequestLockedUntil;
    const affordable = entry.offId || !preview || self.scrip >= preview.fee;
    g.fillStyle(buttonEnabled ? 0x151d24 : 0x0a0d11, 0.98)
      .fillRoundedRect(buttonX, buttonY, buttonW, buttonH, 7 * s)
      .lineStyle(2 * s, buttonEnabled ? (affordable ? 0xffd479 : 0xff8a2b) : 0x39424e, 0.9)
      .strokeRoundedRect(buttonX, buttonY, buttonW, buttonH, 7 * s);
    const button = this.hudText(this.bagTexts, 87, 100053)
      .setText(
        entry.offId
          ? "Unbind — Free"
          : requestPending
            ? "Binding…"
            : preview
              ? `Bind — ◈ ${preview.fee}`
              : "Select off-hand",
      )
      .setColor(buttonEnabled ? (affordable ? "#f1e8cf" : "#ff8a2b") : "#5c6672")
      .setPosition(buttonX + buttonW / 2, buttonY + buttonH / 2)
      .setFontSize(11 * s)
      .setFontStyle("bold")
      .setOrigin(0.5);
    show(button);

    if (!this.pairConfirmZone) {
      this.pairConfirmZone = this.add
        .rectangle(0, 0, 1, 1, 0xffffff, 0.001)
        .setScrollFactor(0)
        .setDepth(100054)
        .setInteractive();
      this.pairConfirmZone.on("pointerdown", () => {
        const me = this.room?.state.players.get(this.room?.sessionId ?? "");
        if (this.shopOpen && me) this.confirmPair(me);
      });
    }
    if (!this.unbindZone) {
      this.unbindZone = this.add
        .rectangle(0, 0, 1, 1, 0xffffff, 0.001)
        .setScrollFactor(0)
        .setDepth(100054)
        .setInteractive();
      this.unbindZone.on("pointerdown", () => {
        if (this.shopOpen) this.room?.send("unbindPair");
      });
    }
    this.pairConfirmZone
      .setVisible(zonesActive && !entry.offId && !!preview?.eligible && !requestPending)
      .setPosition(buttonX + buttonW / 2, buttonY + buttonH / 2)
      .setSize(buttonW, buttonH);
    this.unbindZone
      .setVisible(zonesActive && !!entry.offId)
      .setPosition(buttonX + buttonW / 2, buttonY + buttonH / 2)
      .setSize(buttonW, buttonH);
  }

  /** §31 the shop's permanent-upgrade BUY band: one card per META_UPGRADE with its owned level, effect, and
   *  next-level scrip cost. Click to buy (server-authoritative). Amber = affordable, grey = broke, dim = maxed. */
  private renderUpgradeBand(
    self: PlayerState,
    s: number,
    px: number,
    y: number,
    panelW: number,
    panelAlpha: number,
    zonesActive: boolean,
  ): void {
    const g = this.bagG;
    if (!g) return;
    const n = META_UPGRADES.length;
    const colW = (panelW - 32 * s) / n;
    const bx = px + 16 * s;
    const h = 62 * s;
    const curOf = (id: string) =>
      id === "vitality" ? self.upVitality : id === "fortune" ? self.upFortune : self.upPower;
    for (let i = 0; i < n; i++) {
      const u = META_UPGRADES[i]!;
      const cur = curOf(u.id);
      const cost = nextUpgradeCost(u.id, cur);
      const maxed = cost === null;
      const afford = cost !== null && self.scrip >= cost;
      const cx = bx + i * colW;
      const w = colW - 8 * s;
      g.fillStyle(0x121821, 0.95).fillRoundedRect(cx, y, w, h, 6 * s);
      g.lineStyle(1.5 * s, maxed ? 0x5a6472 : afford ? 0xffd24a : 0x3a3f47, 0.95).strokeRoundedRect(
        cx,
        y,
        w,
        h,
        6 * s,
      );
      const label = this.hudText(this.bagTexts, 70 + i, 100046)
        .setText(`${u.name}  ${cur}/${u.maxLevel}\n${u.desc}`)
        .setColor("#cfe0f0")
        .setVisible(true)
        .setAlpha(panelAlpha)
        .setPosition(cx + w / 2, y + 8 * s);
      label
        .setFontSize(10.5 * s)
        .setOrigin(0.5, 0)
        .setAlign("center");
      const costT = this.hudText(this.bagTexts, 75 + i, 100046)
        .setText(maxed ? "Maxed" : `◈ ${cost}`)
        .setColor(maxed ? "#5a6472" : afford ? "#9cff6a" : "#7a8290")
        .setVisible(true)
        .setAlpha(panelAlpha)
        .setPosition(cx + w / 2, y + h - 7 * s);
      costT.setFontSize(11 * s).setOrigin(0.5, 1);
      let z = this.buyZones[i];
      if (!z) {
        z = this.add
          .rectangle(0, 0, 1, 1, 0xffffff, 0.001)
          .setScrollFactor(0)
          .setDepth(100045)
          .setInteractive();
        z.on("pointerdown", () => {
          if (!this.shopOpen) return;
          // dockux-panel §2.2: an unaffordable click gets told, not swallowed.
          const me = this.room?.state.players.get(this.room?.sessionId ?? "");
          const up = META_UPGRADES[i];
          if (me && up) {
            const live =
              up.id === "vitality"
                ? me.upVitality
                : up.id === "fortune"
                  ? me.upFortune
                  : me.upPower;
            const liveCost = nextUpgradeCost(up.id, live);
            if (liveCost !== null && me.scrip < liveCost) {
              this.flashBanner("Not enough Scrip", "#ff8a2b");
              return;
            }
          }
          this.room?.send("buyUpgrade", { id: META_UPGRADES[i]?.id });
        });
        this.buyZones[i] = z;
      }
      z.setVisible(zonesActive)
        .setPosition(cx + w / 2, y + h / 2)
        .setSize(w, h);
    }
    // §2.2 the permanence promise moves out of the old run-on title into one quiet sub-line.
    const sub = this.hudText(this.bagTexts, 80, 100046)
      .setText("Upgrades are permanent — they carry across runs")
      .setColor("#7a8290")
      .setVisible(true)
      .setAlpha(panelAlpha)
      .setPosition(px + panelW / 2, y + h + 2 * s);
    sub
      .setFontSize(9 * s)
      .setOrigin(0.5, 0)
      .setFontStyle("normal");
  }

  /** Hide the bag overlay + its zones/texts/art thumbnails (panel closed). */
  private hideBagPanel(): void {
    this.bagG?.setVisible(false);
    for (const z of this.bagZones) z.setVisible(false);
    for (const z of this.bagTabZones) z.setVisible(false);
    this.bagActionZone?.setVisible(false);
    for (const z of this.buyZones) z.setVisible(false);
    for (const z of this.pairSlotZones) z.setVisible(false);
    for (const z of this.bagPairZones) z.setVisible(false);
    this.pairConfirmZone?.setVisible(false);
    this.unbindZone?.setVisible(false);
    for (const a of this.bagArts) a?.setVisible(false);
    for (let i = 1; i < this.bagTexts.length; i++) this.bagTexts[i]?.setVisible(false);
    this.bagTexts[0]?.setVisible(false);
    this.bagHoverCell = -1;
  }

  /** Chain-lightning VFX (§10 on-hit proc, §14 client-predicted): a jagged teal bolt from the weapon
   *  through the struck enemy and on to the nearest unhit enemies — mirroring the server's chain so the
   *  visual matches the damage. Cosmetic only; the server (`weapon.chainLightning`) owns all damage. */
  private spawnChain(
    sx: number,
    sy: number,
    aim: { x: number; y: number },
    weapon: WeaponDef,
    swing?: SwingDescriptor,
  ): void {
    const cl = weapon.chainLightning;
    if (!cl || !this.room) return;
    const vfx = cl.vfx ?? { color: 0.5, jag: 0.3, life: 180 };
    const VR = (globalThis as { VFXRENDER?: { lerpHue?: (h: number) => number } }).VFXRENDER;
    const col = VR?.lerpHue ? VR.lerpHue(vfx.color) : 0x6fd6ff; // 0.5 → teal (sword accent)
    const enemies = this.room.state.enemies;
    const posOf = (id: string, ex: number, ey: number) => {
      const rig = this.enemies.get(id); // smoothed render position if present
      return { x: rig?.x ?? ex, y: rig?.y ?? ey };
    };
    // Build candidates + find the SEED (nearest arc-hit enemy); mark every arc-hit so the chain leaps to
    // OTHERS. Target selection uses the SAME shared `selectChainTargets` the server runs (no divergence).
    const candidates: ChainCandidate[] = [];
    const used = new Set<string>();
    let seedX = sx;
    let seedY = sy;
    let seedFound = false;
    let seedBestD = Infinity;
    enemies.forEach((e, id) => {
      const p = posOf(id, e.x, e.y);
      candidates.push({ id, x: p.x, y: p.y });
      if (inMeleeArc({ x: sx, y: sy }, aim.x, aim.y, p, weapon.range, weapon.halfArc)) {
        used.add(id);
        const d = (p.x - sx) ** 2 + (p.y - sy) ** 2;
        if (d < seedBestD) {
          seedBestD = d;
          seedX = p.x;
          seedY = p.y;
          seedFound = true;
        }
      }
    });
    if (!seedFound) return; // nothing struck → no chain bolt (the swing's own electric layer still plays)

    const links = selectChainTargets(
      { x: seedX, y: seedY },
      candidates,
      cl.jumps,
      Math.min(cl.range, CHAIN_MAX_RANGE),
      used,
    );

    // weapon → struck target → each chain link. Re-jagged every frame = a crackling bolt; bloom glows it.
    const source = weaponEffectEmitterPoint(
      weapon,
      { x: sx, y: sy },
      Math.atan2(aim.y, aim.x),
      swing,
      swing?.activeStartSeconds ?? 0,
    );
    const nodes = [
      { x: source.x, y: source.y },
      { x: seedX, y: seedY },
      ...links.map((l) => ({ x: l.x, y: l.y })),
    ];
    const weaponEffectRecipe = resolveWeaponEffectRecipe(weapon);
    if (weaponEffectRecipe?.chain === "scattered-pages") {
      spawnScatteredPages(this, nodes, vfx.life, weapon.id);
      return;
    }
    const g = this.add.graphics();
    this.vfxPlayer.bloomRoot.add(g);
    const t0 = this.time.now;
    this.tweens.addCounter({
      from: 1,
      to: 0,
      duration: vfx.life,
      onUpdate: (tw) => {
        const a = tw.getValue() ?? 0;
        const flick = 0.55 + 0.45 * Math.sin((this.time.now - t0) * 0.09);
        g.clear();
        for (let i = 0; i < nodes.length - 1; i++) {
          const a0 = nodes[i];
          const b0 = nodes[i + 1];
          if (!a0 || !b0) continue;
          const pts = boltPoints(a0.x, a0.y, b0.x, b0.y, vfx.jag);
          g.lineStyle(3, col, a * flick);
          strokeBolt(g, pts);
          g.lineStyle(1, 0xffffff, a * flick * 0.9); // hot white core
          strokeBolt(g, pts);
        }
      },
      onComplete: () => g.destroy(),
    });
  }

  /** Melee swing VFX (§14, CODE-8): play the weapon's AUTHORED suite (painted hero + engine layers) via
   *  the shared renderer at the strike point, oriented to aim. Un-authored weapons get a default slash.
   *  The effect sits at ~60% of the swing reach so the arc reads where the weapon connects. */
  private spawnSlash(
    x: number,
    y: number,
    aim: { x: number; y: number },
    weapon: WeaponDef,
    swing: SwingDescriptor,
    exact = false,
    target?: Readonly<{ x: number; y: number }>,
    sourceBladePose?: () => WeaponBladeAttachmentPose | undefined,
  ): void {
    if (weapon.suppressVfx) return;
    const ang = Math.atan2(aim.y, aim.x);
    // Destination-authored lunges use their one delayed recipe cue, sampled from server position. Starting
    // the generic suite here would leave a second impact at the click-time origin.
    if (
      weapon.performance?.lunge?.impactAtDestination === true &&
      resolveWeaponEffectRecipe(weapon)
    )
      return;
    if (weapon.tags.classPool === "melee" && weapon.performance?.action === "page-flip") {
      this.spawnPageFlutterArc(x, y, ang, weapon);
      return;
    }
    const effectRecipe = resolveWeaponEffectRecipe(weapon);
    if (effectRecipe?.chain === "scattered-pages") {
      // Twin Whispervolumes must visibly fire a page even when the arc finds no chain seed. A confirmed
      // chain still adds its own page trail through `spawnChain`; this lead volley is presentation-only.
      const source = weaponEffectEmitterPoint(
        weapon,
        { x, y },
        ang,
        swing,
        swing.activeStartSeconds,
      );
      spawnScatteredPages(
        this,
        [source, { x: source.x + aim.x * weapon.range, y: source.y + aim.y * weapon.range }],
        weapon.chainLightning?.vfx?.life ?? 180,
        weapon.id,
      );
    }
    // §14 `exact` (cursor-spawn) places the VFX right at (x,y); otherwise it sits ~60% along the swing reach.
    const reach = exact ? 0 : (weapon.range ?? 100) * 0.6;
    const sx = x + Math.cos(ang) * reach;
    const sy = y + Math.sin(ang) * reach;
    // SIZE: the weapon's authored fixed vfxRadius (resolved in VfxPlayer); this is only the fallback for
    // weapons with no baked VFX entry. Fixed per §14 — never derived from range/level/stat.
    this.vfxPlayer.playSwing(
      weapon.id,
      sx,
      sy,
      ang,
      VFX_RADIUS_DEFAULT,
      swing,
      weapon.tags?.element,
      target?.x ?? sx,
      target?.y ?? sy,
      sourceBladePose,
    );
  }

  /** §39 DEV PORTAL: apply a `?dev=` deep-link once the room is live — enter Testing Grounds, then spawn the
   * boss / equip the weapon / wear the character requested. Gear and pet were already applied to the normal
   * join account by MenuScene, so reaching this target confirms the inspection after training mode syncs. */
  /** Verdigris's paper is the melee tell: page scraps trace the authored sweep instead of layering an
   * unrelated generic slash over the open-book attack. Damage remains the server's swept edge. */
  private spawnPageFlutterArc(x: number, y: number, aimAngle: number, weapon: WeaponDef): void {
    const art = pageProjectileArtFor(weapon.id);
    if (!art || !this.textures.exists(art.textureKey)) return;
    const count = 9;
    for (let i = 0; i < count; i++) {
      const progress = (i + 0.5) / count;
      const angle = aimAngle - weapon.swingArc * 0.5 + weapon.swingArc * progress;
      const radius = weapon.range * (0.28 + progress * 0.58);
      const page = this.add
        .image(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, art.textureKey)
        .setDisplaySize(art.displayWidth, art.displayHeight)
        .setRotation(angle + (i % 2 === 0 ? 0.28 : -0.32))
        .setDepth(100100);
      this.tweens.add({
        targets: page,
        x: page.x + Math.cos(angle) * 26,
        y: page.y + Math.sin(angle) * 20 - 8,
        rotation: page.rotation + (i % 2 === 0 ? 1.2 : -1.05),
        alpha: 0,
        delay: i * 18,
        duration: 300 + i * 12,
        ease: "Cubic.out",
        onComplete: () => page.destroy(),
      });
    }
  }

  private applyDevLaunch(): void {
    if (!this.devLaunch || !this.room) return;
    const spec = this.devLaunch;
    this.devLaunch = null;
    const i = spec.indexOf(":");
    const kind = i < 0 ? spec : spec.slice(0, i);
    const arg = i < 0 ? "" : spec.slice(i + 1);
    const target = (): void => {
      const room = this.room;
      if (!room) return;
      if (kind === "boss" && arg) room.send("spawnBossDef", { kind: arg });
      else if (kind === "weapon" && arg) room.send("devEquip", { weapon: arg });
      else if (kind === "char" && arg) room.send("devEquip", { character: arg });
      else if (kind === "enemy" && arg) room.send("debugSpawn", { kind: arg, count: 3 });
      const gearNotice =
        kind === "gear" && arg in GEAR_CATALOG
          ? gearClickVisibilityNotice(GEAR_PARTS_MANIFEST, arg as GearId)
          : null;
      this.flashBanner(gearNotice ?? `▶ Dev: ${kind} ${arg}`, gearNotice ? "#ffb24a" : "#33e6ff");
    };
    // toggleTraining is a TOGGLE — send it AT MOST ONCE (re-sending before the mode syncs back over the
    // round-trip flips it back and forth). Then just WAIT for the synced confirmation before firing the target.
    if (this.room.state.mode === "training") {
      this.time.delayedCall(250, target);
      return;
    }
    this.room.send("toggleTraining");
    let tries = 0;
    const wait = (): void => {
      if (!this.room || tries++ > 40) return;
      if (this.room.state.mode === "training") target();
      else this.time.delayedCall(100, wait);
    };
    this.time.delayedCall(100, wait);
  }

  /** Live on-screen readout so the game loop's health is visible without a dev console. */
  private updateDebug(): void {
    if (!this.debugEl) return;
    const players = this.room ? this.room.state.players.size : 0;
    const enemies = this.room ? this.room.state.enemies.size : 0;
    const elapsed = this.room?.state.elapsedSeconds ?? 0;
    const fps = Math.round(this.game.loop.actualFps);
    // §4 v0.107 netcode health: un-acked command depth (≈ RTT in ticks) + current reconcile error (px).
    const net = this.predictor
      ? ` · net ${this.predictor.stats.pending}q/${this.predictor.stats.errPx.toFixed(0)}px`
      : "";
    const fullDeaths = this.paperDeaths.reduce((count, death) => count + (death.full ? 1 : 0), 0);
    const snapshot = this.paperWorldFold
      ? `${this.paperWorldFold.snapshot.width}x${this.paperWorldFold.snapshot.height}`
      : "off";
    const paper = ` · paper ${fullDeaths}/${this.paperDeaths.length}d ${this.closingPickups.size}p rt:${snapshot} peak:${this.paperPeakObjects}`;
    this.debugEl.textContent = `run ${elapsed}s · fps ${fps} · players ${players} · enemies ${enemies} · mouseMoves ${this.pointerMoves}${net}${paper}`;
  }

  /** §4 v0.107 one PATCH = one completed server tick. Stamp the snapshot timeline + remote rings and
   *  reconcile the self predictor. Data only — rigs are moved by the render step, never from here. */
  private captureEnemyComboPatch(
    state: ArenaState,
    id: string,
    enemy: { x: number; y: number; comboSeq: number; comboFlags: number },
  ): void {
    let presentation = this.enemyComboPresentation.get(id);
    if (!presentation) {
      let leapStartTick = state.tick;
      if ((enemy.comboFlags & COMBO_FLAG_AIRBORNE) !== 0) {
        let bestDistance = Number.POSITIVE_INFINITY;
        state.telegraphs.forEach((row) => {
          if (row.shape !== TgShape.Circle || row.danger !== 0 || row.kindTag !== 2) return;
          const distance = Math.hypot(row.x - enemy.x, row.y - enemy.y);
          if (distance >= bestDistance) return;
          bestDistance = distance;
          const totalTicks = COMBO_LEAP_OFFER_TICKS + COMBO_LEAP_AIR_TICKS;
          const airFraction = Math.max(
            0,
            Math.min(1, (row.t * totalTicks - COMBO_LEAP_OFFER_TICKS) / COMBO_LEAP_AIR_TICKS),
          );
          leapStartTick = (state.tick - Math.round(airFraction * COMBO_LEAP_AIR_TICKS)) >>> 0;
        });
      }
      presentation = {
        observedSeq: enemy.comboSeq,
        observedFlags: enemy.comboFlags,
        presentedSeq: enemy.comboSeq,
        presentedFlags: enemy.comboFlags,
        pendingSeq: enemy.comboSeq,
        pendingFlags: enemy.comboFlags,
        pendingTick: state.tick,
        pendingStagger: false,
        hasPending: false,
        leapStartTick,
        markerId: "",
        markerX: enemy.x,
        markerY: enemy.y,
        markerRadius: ENEMY_RADIUS + 10,
        launchX: enemy.x,
        launchY: enemy.y,
      };
      this.enemyComboPresentation.set(id, presentation);
      return;
    }
    if (
      enemy.comboSeq === presentation.observedSeq &&
      enemy.comboFlags === presentation.observedFlags
    )
      return;

    let parriedReturn = false;
    if (
      (presentation.observedFlags & COMBO_FLAG_EMPOWERED) !== 0 &&
      (enemy.comboFlags & COMBO_FLAG_EMPOWERED) === 0
    ) {
      const cached = this.telegraphCache.get(`${MELEE_TELEGRAPH_PREFIX}${id}`);
      state.players.forEach((player, playerId) => {
        const previous = this.lastParried.get(playerId);
        if (previous === undefined || previous === player.parriedSeq) return;
        const projectedY = projectTelegraphY(
          player.y,
          cached?.projectionYScale ?? (this.belt ? BELT_FORESHORTEN : 1),
        );
        if (
          cached
            ? telegraphGeometryContains(cached.geometry, player.x, projectedY)
            : Math.hypot(player.x - enemy.x, player.y - enemy.y) <= 420
        )
          parriedReturn = true;
      });
    }
    presentation.observedSeq = enemy.comboSeq;
    presentation.observedFlags = enemy.comboFlags;
    presentation.pendingSeq = enemy.comboSeq;
    presentation.pendingFlags = enemy.comboFlags;
    presentation.pendingTick = state.tick;
    presentation.pendingStagger = parriedReturn;
    presentation.hasPending = true;
  }

  private onPatch(state: ArenaState): void {
    const now = this.time.now;
    if (state.tick <= 0) return; // pre-sim state (menu/handshake)
    const gearRows: Array<[string, { gearUpper: unknown; gearLower: unknown; prestige: unknown }]> =
      [];
    state.players.forEach((player, id) => {
      gearRows.push([
        id,
        {
          // Reflection law (see addBlob): only the nested dualWield row exists on decoded rows.
          gearUpper: player.dualWield?.gearUpper ?? "",
          gearLower: player.dualWield?.gearLower ?? "",
          prestige: player.dualWield?.prestige ?? 0,
        },
      ]);
    });
    syncRemoteGearLoadouts(this.syncedGearLoadouts, gearRows);
    this.timeline.onPatch(state.tick, now);
    const t = state.tick * TICK_MS;
    const selfId = this.room?.sessionId;
    state.players.forEach((p, id) => {
      if (id === selfId) return; // self renders from the predictor, not snapshots
      let buf = this.playerBufs.get(id);
      if (!buf) {
        buf = new SnapshotBuffer();
        this.playerBufs.set(id, buf);
      }
      // A pit snap-back must CUT the remote's ring, not leave a path back into the pit (review #10).
      const prevFell = this.snapFell.get(id);
      if (prevFell !== undefined && prevFell !== p.fellSeq) buf.reset(t, p.x, p.y);
      else buf.push(t, p.x, p.y);
      this.snapFell.set(id, p.fellSeq);
    });
    state.enemies.forEach((e, id) => {
      if (state.wormBoss.active && id === state.wormBoss.ownerId) return;
      let buf = this.enemyBufs.get(id);
      if (!buf) {
        buf = new SnapshotBuffer();
        this.enemyBufs.set(id, buf);
      }
      buf.push(t, e.x, e.y);
      this.captureEnemyComboPatch(state, id, e);
    });
    this.wormRig?.capture(state.wormBoss, state.tick);
    // Self: create the predictor on the first patch that carries us, then reconcile every patch.
    if (selfId) {
      const self = state.players.get(selfId);
      if (self) {
        this.hydrateWeaponManifest(self);
        const view = ArenaScene.serverView(self);
        if (this.predictor) {
          this.predictor.reconcile(view);
        } else {
          this.predictor = new SelfPredictor(view);
          this.selfPredHeight = view.height;
          this.selfPredVh = view.vh;
          this.selfPredStance = view.moveStance ?? STANCE_NONE;
          this.selfPredSlidePhase = (view.slidePhase ?? SLIDE_PHASE_OFF) as SlidePhase;
          this.selfPredSlideTick = view.slidePhaseTick ?? 0;
          if (this.belt) {
            this.predictor.setMap(undefined);
            this.predictor.setBeltLevel(this.beltLevel ?? beltLevelFor("sky-carrier"));
          } else {
            this.predictor.setMap(this.arenaMap);
          }
        }
        this.reconcileBeamPrediction(state, self);
      }
    }
  }

  /** The predictor's slice of the synced self row (frozen = the §12 level-window movement pause). */
  private static serverView(p: PlayerState): ServerView {
    return {
      x: p.x,
      y: p.y,
      mvx: p.mvx,
      mvy: p.mvy,
      vx: p.vx,
      vy: p.vy,
      height: p.height,
      vh: p.vh,
      ackSeq: p.ackSeq,
      teleportSeq: p.teleportSeq,
      moveStance: p.moveStance as MoveStance,
      stanceSeq: p.stanceSeq,
      momentumX: p.momentumX,
      momentumY: p.momentumY,
      slidePhase: p.slidePhase,
      slidePhaseTick: p.slidePhaseTick,
      alive: p.alive,
      frozen: p.flexPending > 0 || p.sigPending > 0,
    };
  }

  /** §4 v0.107 the fixed 50ms INPUT-COMMAND loop: sample WASD once per frame, mint + send + predict one
   *  sequence-numbered command per elapsed 50ms (clamped ≤3/frame — a throttled-tab wake must not burst
   *  its whole backlog; the server would drain-to-newest anyway, and the predictor hard-resyncs). */
  /** Stable scratch shared by fixed input and the owner's non-damaging pre-acceptance charge. */
  private currentBeamAim(): typeof this.beamAimCommand {
    const out = this.beamAimCommand;
    let aimX = this.selfAim.x;
    let aimY = this.selfAim.y;
    if (this.belt) {
      aimY /= BELT_FORESHORTEN;
      const length = Math.hypot(aimX, aimY) || 1;
      aimX /= length;
      aimY /= length;
    }
    const self = this.room?.state.players.get(this.room?.sessionId ?? "");
    const px = this.pointerScreen.set ? this.pointerScreen.x : this.input.activePointer.x;
    const py = this.pointerScreen.set ? this.pointerScreen.y : this.input.activePointer.y;
    const world = this.cameras.main.getWorldPoint(px, py);
    out.aimX = Number.isFinite(aimX) ? aimX : 1;
    out.aimY = Number.isFinite(aimY) ? aimY : 0;
    out.targetX = world.x;
    out.targetY = this.belt ? BELT_Y0 + (world.y - BELT_Y0) / BELT_FORESHORTEN : world.y;
    if (!Number.isFinite(out.targetX)) out.targetX = self?.x ?? 0;
    if (!Number.isFinite(out.targetY)) out.targetY = self?.y ?? 0;
    return out;
  }

  /** Rebase the owner's harmless charge preview on the accepted row, discard acknowledged aim commands,
   * then replay only the unacknowledged tail with the same shared turn step as authority. */
  private reconcileBeamPrediction(state: ArenaState, self: PlayerState): void {
    if (this.beamPredictionStartSeq < 0) return;
    const acked = (seq: number) => (self.ackSeq - seq) >>> 0 < 0x80000000;
    while (this.beamPredictionPending.length > 0 && acked(this.beamPredictionPending[0]!.seq)) {
      this.beamPredictionPending.shift();
    }
    const row = state.beams.get(self.id);
    if (row?.startSeq === this.beamPredictionStartSeq) {
      this.beamPredictionAccepted = true;
      if (row.phase !== BeamPhase.Charging) return; // ignition and later phases are server-only visuals
      if (this.beamPredictionHeld) this.beamPredictionFadeAt = -1;
      const weapon = WEAPONS[row.weaponId];
      if (!weapon?.beam) return;
      this.beamPredictionAngle = row.angle;
      this.beamPredictionProgress = row.intensity;
      for (const cmd of this.beamPredictionPending) {
        this.beamPredictionAngle = stepBeamAngle(
          this.beamPredictionAngle,
          Math.atan2(cmd.aimY, cmd.aimX),
          weapon.beam.sweepLagSeconds,
          TICK_MS / 1000,
        );
        this.beamPredictionProgress = Math.min(
          0.95,
          this.beamPredictionProgress +
            TICK_MS /
              1000 /
              Math.max(
                BEAM_MIN_CHARGE_SECONDS,
                weapon.beam.chargeSeconds * lootCooldownMult(self.weaponAffix),
              ),
        );
      }
      return;
    }
    // The start command was consumed but no matching row exists: dead/frozen/heat/swap rejected it.
    if (acked(this.beamPredictionStartSeq) && this.beamPredictionFadeAt < 0) {
      this.beamPredictionFadeAt = this.time.now;
    }
  }

  /** Advance the non-damaging owner preview from the exact fixed command sent to the room. */
  private stepBeamPrediction(
    cmd: { seq: number; fireHeld: boolean; aimX: number; aimY: number },
    self: PlayerState | undefined,
    weapon: WeaponDef | undefined,
  ): void {
    this.lastMintedInputSeq = cmd.seq;
    if (!cmd.fireHeld || !self || !weapon?.beam) {
      if (this.beamPredictionStartSeq >= 0 && this.beamPredictionFadeAt < 0) {
        this.beamPredictionFadeAt = this.time.now;
      }
      return;
    }
    if (this.beamPredictionStartSeq < 0 || this.beamPredictionFadeAt >= 0) return;
    this.beamPredictionPending.push({ seq: cmd.seq, aimX: cmd.aimX, aimY: cmd.aimY });
    if (this.beamPredictionPending.length > 64) this.beamPredictionPending.shift();
    this.beamPredictionAngle = stepBeamAngle(
      this.beamPredictionAngle,
      Math.atan2(cmd.aimY, cmd.aimX),
      weapon.beam.sweepLagSeconds,
      TICK_MS / 1000,
    );
    this.beamPredictionProgress = Math.min(
      0.95,
      this.beamPredictionProgress +
        TICK_MS /
          1000 /
          Math.max(
            BEAM_MIN_CHARGE_SECONDS,
            weapon.beam.chargeSeconds * lootCooldownMult(self.weaponAffix),
          ),
    );
  }

  /** Replicated exact geometry for everyone; only the owner's non-damaging charge knot is predicted. */
  private updateBeams(): void {
    const room = this.room;
    if (!room || !this.beamRenderer) return;
    const self = room.state.players.get(room.sessionId);
    const weapon = self ? WEAPONS[self.weapon] : undefined;
    const held =
      !!self?.alive &&
      !this.inputModalBlocked(self) &&
      !this.pointerOverInteractiveUi &&
      !!(
        weapon?.beam ||
        weapon?.performance?.aura ||
        weapon?.groundZone?.trigger === "channel" ||
        weapon?.performance?.continuous
      ) &&
      this.input.activePointer.rightButtonDown();
    const rising = held && !this.beamPredictionHeld;
    if (rising && self && weapon?.beam) {
      const aim = this.currentBeamAim();
      this.beamPredictionStartSeq = (this.lastMintedInputSeq + 1) >>> 0;
      this.beamPredictionAccepted = false;
      this.beamPredictionAngle = Math.atan2(aim.aimY, aim.aimX);
      this.beamPredictionProgress = 0;
      this.beamPredictionFadeAt = -1;
      this.beamPredictionPending.length = 0;
      this.audio.play("beam:charge", { x: self.x, amt: 1, ownerId: room.sessionId });
    } else if (!held && this.beamPredictionStartSeq >= 0 && this.beamPredictionFadeAt < 0) {
      this.beamPredictionFadeAt = this.time.now;
    }

    let predicted: PredictedBeamCharge | undefined;
    const fade =
      this.beamPredictionFadeAt < 0 ? 1 : 1 - (this.time.now - this.beamPredictionFadeAt) / 80;
    const selfBeam = room.state.beams.get(room.sessionId);
    const awaitingRelease =
      !held &&
      selfBeam?.startSeq === this.beamPredictionStartSeq &&
      (selfBeam.phase === BeamPhase.Charging || selfBeam.phase === BeamPhase.Active);
    if (fade <= 0 && !awaitingRelease) {
      this.beamPredictionStartSeq = -1;
      this.beamPredictionAccepted = false;
      this.beamPredictionProgress = 0;
      this.beamPredictionFadeAt = -1;
      this.beamPredictionPending.length = 0;
    } else if (self && weapon?.beam && this.beamPredictionStartSeq >= 0) {
      const predictedPos = this.predictor?.renderPos(
        this.curDx,
        this.curDy,
        this.inputAccMs / 1000,
      );
      const angle = this.beamPredictionAngle;
      const muzzle = weaponMuzzleWorldPoint(weapon, {
        x: predictedPos?.x ?? self.x,
        y: predictedPos?.y ?? self.y,
        aimX: Math.cos(angle),
        aimY: Math.sin(angle),
        renderScale: characterScale(self.character),
      });
      this.predictedBeam.ownerId = room.sessionId;
      this.predictedBeam.weaponId = weapon.id;
      this.predictedBeam.startSeq = this.beamPredictionStartSeq;
      this.predictedBeam.originX = muzzle.x;
      this.predictedBeam.originY = muzzle.y;
      this.predictedBeam.angle = angle;
      this.predictedBeam.progress = this.beamPredictionProgress;
      this.predictedBeam.opacity = Math.max(0, Math.min(1, fade));
      this.predictedBeam.element = weapon.tags.element;
      predicted = this.predictedBeam;
    }
    this.updateBeamFeedback(room.state.beams, room.sessionId);
    const seraphCursor =
      weapon?.id === "x2-seraph-s-knuckle-reliquary" ? this.currentBeamAim() : undefined;
    this.beamRenderer.update(
      room.state.beams,
      room.sessionId,
      this.time.now,
      this.deltaSec,
      BELT_Y0,
      this.belt ? BELT_FORESHORTEN : 1,
      predicted,
      prefersReducedPaperMotion() || this.feedbackSettings.flashes === "reduced",
      this.writeBeamMuzzlePose,
      seraphCursor ? { x: seraphCursor.targetX, y: seraphCursor.targetY } : undefined,
    );
    this.beamPredictionHeld = held;
  }

  /** Consume authoritative phase edges once per owner; sustained pressure is throttled inside AudioBus. */
  private updateBeamFeedback(rows: BeamRenderRows, selfId: string): void {
    this.beamFeedbackSeen.clear();
    rows.forEach((row, rowKey) => {
      const ownerId = row.ownerId || rowKey;
      if (rowKey !== ownerId) return;
      this.beamFeedbackSeen.add(ownerId);
      const local = ownerId === selfId;
      let previous = this.beamFeedback.get(ownerId);
      const newEpoch = !previous || previous.seq !== row.seq;
      const phaseChanged = !previous || previous.phase !== row.phase;
      if (newEpoch || phaseChanged) {
        if (row.phase === BeamPhase.Charging) {
          if (!(local && row.seq === this.beamPredictionStartSeq))
            this.audio.play("beam:charge", {
              x: row.originX,
              amt: local ? 1 : 0.32,
              ownerId,
            });
        } else if (row.phase === BeamPhase.Active) {
          this.audio.play("beam:ignite", {
            x: row.originX,
            amt: local ? 1 : 0.4,
            ownerId,
          });
          if (local) this.shakeCam(55, 0.0028, "player-weapon");
        } else if (row.phase === BeamPhase.Overheated) {
          this.audio.play("beam:overheat", {
            x: row.originX,
            amt: local ? 1 : 0.38,
            ownerId,
          });
          if (local) {
            this.shakeCam(120, 0.006, "player-weapon");
            this.offerContextHint("beamOverheat");
          }
        } else if (
          row.phase === BeamPhase.Cooling &&
          previous &&
          (previous.phase === BeamPhase.Active ||
            previous.phase === BeamPhase.Charging ||
            previous.phase === BeamPhase.Overheated)
        ) {
          this.audio.play("beam:release", {
            x: row.originX,
            amt: local ? 0.82 : 0.25,
            ownerId,
          });
        }
      }
      if (!previous) {
        previous = { seq: row.seq, phase: row.phase, x: row.originX };
        this.beamFeedback.set(ownerId, previous);
      }
      previous.seq = row.seq;
      previous.phase = row.phase;
      previous.x = row.originX;
      if (row.phase === BeamPhase.Active) {
        this.audio.play("beam:sustain", {
          x: row.originX,
          amt: local ? 0.58 + row.heat * 0.42 : 0.16 + row.heat * 0.22,
          ownerId,
        });
        if (local && row.heat >= 0.8)
          this.audio.play("beam:redline", { x: row.originX, amt: row.heat });
      }
    });
    for (const [ownerId, previous] of this.beamFeedback) {
      if (this.beamFeedbackSeen.has(ownerId)) continue;
      if (previous.phase === BeamPhase.Active || previous.phase === BeamPhase.Charging)
        this.audio.play("beam:release", {
          x: previous.x,
          amt: ownerId === selfId ? 0.82 : 0.25,
          ownerId,
        });
      this.beamFeedback.delete(ownerId);
    }
  }

  private dispatchNetInput(
    cmd: PredCmd & {
      fireHeld: boolean;
      aimX: number;
      aimY: number;
      targetX: number;
      targetY: number;
    },
    self: PlayerState | undefined,
    weapon: WeaponDef | undefined,
    predictTick: boolean,
  ): void {
    if (!this.room || !this.predictor) return;
    const beamHeld = cmd.fireHeld && !!weapon?.beam;
    const beamWasHeld = this.beamPredictionHeld;
    if (
      beamHeld &&
      self &&
      weapon?.beam &&
      this.beamPredictionFadeAt < 0 &&
      (this.beamPredictionStartSeq < 0 ||
        (!this.beamPredictionAccepted && this.beamPredictionPending.length === 0))
    ) {
      this.beamPredictionStartSeq = cmd.seq;
      this.beamPredictionAccepted = false;
      this.beamPredictionAngle = Math.atan2(cmd.aimY, cmd.aimX);
      this.beamPredictionProgress = 0;
      this.beamPredictionFadeAt = -1;
      this.beamPredictionPending.length = 0;
      if (!beamWasHeld)
        this.audio.play("beam:charge", { x: self.x, amt: 1, ownerId: this.room.sessionId });
    }
    this.beamPredictionHeld = beamHeld;
    this.stepBeamPrediction({ ...cmd, fireHeld: beamHeld }, self, weapon);
    this.room.send("input", cmd);
    if (predictTick) this.predictor.tick(cmd);
  }

  private stepNetInput(
    deltaMs: number,
    levelWindowOpen: boolean,
    ultimatePressed: boolean,
    nextDx: number,
    nextDy: number,
  ): void {
    if (levelWindowOpen) {
      this.jumpQueued = false;
      this.poundQueued = false;
      this.slideQueued = false;
      this.crouchHeld = false;
    }
    if (!this.room || !this.predictor) {
      this.curDx = nextDx;
      this.curDy = nextDy;
      return;
    }
    let elapsedForInput = deltaMs;
    if (deltaMs > 250) {
      // A real frame stall (throttled tab wake / GC pause): drop the input backlog AND hard-resync the
      // predictor on the next patch — its pending window is stale by the whole gap (amendment #12).
      this.inputAccMs = 0;
      elapsedForInput = 0;
      this.predictor.forceResync();
    }
    const self = this.room.state.players.get(this.room.sessionId);
    const weapon = self ? WEAPONS[self.weapon] : undefined;
    const fireHeld =
      !!self?.alive &&
      !levelWindowOpen &&
      !this.levelWinInputReleaseLatch &&
      !this.pointerOverInteractiveUi &&
      !!(
        weapon?.beam ||
        weapon?.groundZone?.trigger === "channel" ||
        weapon?.performance?.aura ||
        weapon?.performance?.continuous
      ) &&
      this.input.activePointer.rightButtonDown();
    const aim = this.currentBeamAim();
    const slideHeld =
      !levelWindowOpen &&
      !this.levelWinInputReleaseLatch &&
      slideHeldFromBindings(this.keys.SHIFT.isDown, this.keys.CTRL.isDown);
    this.inputAccMs = Math.min(this.inputAccMs + elapsedForInput, TICK_MS * 3);

    // Catch-up remains a fixed-timestep simulation: each elapsed 50ms heartbeat advances prediction once.
    // Transport-only edges below may lower input latency, but never create additional movement time.
    while (this.inputAccMs >= TICK_MS) {
      this.inputAccMs -= TICK_MS;
      const cmd = {
        ...this.predictor.mintCmd(
          nextDx,
          nextDy,
          this.jumpQueued,
          this.crouchHeld,
          this.poundQueued,
          aim.aimX,
          aim.aimY,
          this.slideQueued,
          slideHeld,
        ),
        fireHeld,
        aimX: aim.aimX,
        aimY: aim.aimY,
        targetX: aim.targetX,
        targetY: aim.targetY,
      };
      this.jumpQueued = false;
      this.poundQueued = false;
      this.slideQueued = false;
      this.predictor.noteInputHeartbeat(nextDx, nextDy, this.crouchHeld, slideHeld, fireHeld);
      this.dispatchNetInput(cmd, self, weapon, true);
    }

    // The fresh sample drives the render preview now and reaches the server as a transport edge. It must
    // not mint a second 50ms prediction step; the next heartbeat owns that step on both simulations.
    this.curDx = nextDx;
    this.curDy = nextDy;
    const immediate = this.predictor.shouldMintImmediateInput(
      nextDx,
      nextDy,
      this.jumpQueued,
      this.crouchHeld,
      this.poundQueued,
      this.slideQueued,
      slideHeld,
      fireHeld,
      ultimatePressed,
    );
    if (immediate) {
      const cmd = {
        ...this.predictor.mintCmd(
          nextDx,
          nextDy,
          this.jumpQueued,
          this.crouchHeld,
          this.poundQueued,
          aim.aimX,
          aim.aimY,
          this.slideQueued,
          slideHeld,
        ),
        fireHeld,
        aimX: aim.aimX,
        aimY: aim.aimY,
        targetX: aim.targetX,
        targetY: aim.targetY,
      };
      this.jumpQueued = false;
      this.poundQueued = false;
      this.slideQueued = false;
      // Movement-only edges are transport samples, not time. One-shot traversal edges keep their existing
      // local-first prediction so jump/slide feedback is not delayed until the next heartbeat.
      this.dispatchNetInput(
        cmd,
        self,
        weapon,
        cmd.jump || cmd.pound === true || cmd.slide === true || cmd.crouchHeld === true,
      );
    }
  }
}
