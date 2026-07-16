import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type ArenaMap,
  type ArenaState,
  type Attr,
  AUGMENTS,
  affixById,
  BELT_Y0,
  type BeltLevel,
  BAG_CAP,
  beltBounds,
  beltLevelFor,
  BOSS_DEF_IDS,
  BOSSES,
  bossSpawnAt,
  CAM_FOLLOW_TAU,
  CAM_SNAP_DIST,
  CHAIN_MAX_RANGE,
  type ChainCandidate,
  characterName,
  characterScale,
  classForCharacter,
  clampQuakeEpicenter,
  critChanceFor,
  DEBUG_SPAWN_MAX,
  DEPTH_MAX,
  DEFLECT_TTL,
  DEFAULT_DIMENSION,
  DEFAULT_PORT,
  DEFAULT_WEAPON,
  damageMultFromGrades,
  EMBERGUARD_HALF_ARC,
  EMBERGUARD_RANGE,
  ENEMY_KINDS,
  ENEMY_RADIUS,
  type EnemyKind,
  EXTRACT_RADIUS,
  effectiveMelee,
  FISTS_WEAPON,
  generateArena,
  getDimension,
  gunMuzzleReach,
  hasAugment,
  INTERP_DELAY_MS,
  INTERP_SNAP_ENEMY,
  INTERP_SNAP_PLAYER,
  inMeleeArc,
  isPitAtPx,
  LEVELUP_WINDOW_SECONDS,
  lootCooldownMult,
  lootDamageMult,
  PARRY_CHAIN_CD,
  PARRY_CHAIN_RIPOSTE_AT,
  PARRY_CHAIN_WINDOW,
  PARRY_COOLDOWN,
  PARRY_IFRAMES,
  PICKUP_RADIUS,
  type PlayerState,
  QUAKE_REACH,
  EMPTY_META,
  META_UPGRADES,
  type MetaLevels,
  nextUpgradeCost,
  RARITIES,
  RARITY_CURSED,
  sanitizeMetaLevels,
  scripValue,
  SHOP_RADIUS,
  weaponSetBonus,
  RING_BAND_HALF,
  ROOM_NAME,
  requirementPenalty,
  SALVAGE_HOLD_SECONDS,
  SCHEMA_VERSION,
  selectChainTargets,
  swingDescriptorFor,
  type SwingDescriptor,
  TgShape,
  TICK_MS,
  TOUGH_SCALE,
  VFX_RADIUS_DEFAULT,
  WEAPON_IDS,
  WEAPONS,
  type WeaponDef,
} from "@dd/shared";
import { Client, type Room } from "colyseus.js";
import Phaser from "phaser";
import { AudioBus } from "../audio/AudioBus.js";
import {
  type PaperDeathTreatment,
  partTexture,
  type RigAnim,
  SPRITE_ATLAS,
  SpriteRig,
} from "../entities/SpriteRig.js";
import { SelfPredictor, type ServerView } from "../net/prediction.js";
import { SnapshotBuffer, TimelineSync } from "../net/snapshots.js";
import { RENDER_DPR } from "../render-dpr.js";
import { CARD_ART_IDS } from "../sprites/card-manifest.js";
import { SPRITES } from "../sprites/manifest.js";
import {
  elementPack,
  particleBurst,
  preloadParticlePacks,
} from "../vfx/particles.js";
import { VfxPlayer } from "../vfx/VfxPlayer.js";
import {
  type XpMotePoint,
  type XpMoteReceipt,
  XpMoteRenderer,
} from "../vfx/xp-motes.js";
import {
  buildCard,
  type Card,
  drawIcon,
  WEAPON_ACCENT,
} from "./arena/card-art.js";
import { boltPoints, strokeBolt } from "./arena/draw-util.js";
import {
  buildArenaFloor,
  buildPois,
  dimensionPropPack,
  drawArena,
  type PoiSprite,
  terrainRimKey,
  terrainTileKey,
} from "./arena/floor-renderer.js";
import {
  baseKind,
  GUN_FX,
  gunFx,
  makeBullet,
  makeCounter,
  makeMagma,
  makeSpit,
  makeThrownCleaver,
} from "./arena/projectile-factory.js";
import {
  preloadImpactFlipbooks,
  spawnBulletImpact,
  spawnDamageNumber,
  spawnExplosion,
  spawnFallStreak,
  spawnImpactFlipbook,
  spawnMuzzleFlash,
  spawnPoof,
  spawnQuake,
  spawnSplat,
  TelegraphForeshadowPool,
  spawnWeaponKillFx,
} from "./arena/vfx.js";

/** Which sprite manifest the player renders as (§23: melee class, one character for M0). */
const PLAYER_SPRITE = "drifter";

// §6 horde-hit object budget: ordinary combat stays bit-for-bit on the full path; a single-frame AoE storm
// gets ten authored contact stacks and at most 24 pooled labels, while every remaining target still flashes.
const HIT_VFX_BUDGET = 10;
const DAMAGE_NUMBER_BUDGET = 24;
const PAPER_DEATH_FULL_BUDGET = 12;
const PAPER_DEATH_ORDINARY_BUDGET = 10; // reserve two slots for tough/boss deaths
const PAPER_PICKUP_EXIT_BUDGET = 8;
const PAPER_SNAPSHOT_MAX_W = 1600;
const PAPER_SNAPSHOT_MAX_H = 900;

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
} as const;

const MELEE_TELEGRAPH_PREFIX = "melee:";
const MELEE_FULL_TELL_COUNT = 6;
const MELEE_GLINT_LEAD_MS = 280;
const MELEE_GLINT_CREST_MS = 60;

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
}

interface MeleeTellCandidate {
  id: string;
  containsSelf: boolean;
  distance: number;
  remainingMs: number;
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

function adaptiveArcSamples(
  radius: number,
  span: number,
  zoom: number,
): number {
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
    edges.push(
      polygonEdge(points, cx / points.length, cy / points.length, zoom),
    );
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
    edges.push(
      polygonEdge(points, cx / points.length, cy / points.length, zoom),
    );
  } else if (
    shape === TgShape.Ring &&
    kindTag === TelegraphKindTag.ExpandingRing
  ) {
    const outerR = Math.max(0, a + RING_BAND_HALF);
    const innerR = Math.max(0, a - RING_BAND_HALF);
    const start = rot + Math.max(0, b);
    const end = rot - Math.max(0, b) + Math.PI * 2;
    edges.push(
      ellipseEdge(
        x,
        y,
        outerR,
        start,
        end,
        projectionYScale,
        zoom,
        true,
        false,
      ),
    );
    if (innerR > 0.5) {
      edges.push(
        ellipseEdge(
          x,
          y,
          innerR,
          start,
          end,
          projectionYScale,
          zoom,
          false,
          false,
        ),
      );
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
              y: projectTelegraphY(
                y + Math.sin(angle) * innerR,
                projectionYScale,
              ),
            }
          : { x, y: centerY };
      const outerToward = {
        x: x + Math.cos(intoAngle) * outerR,
        y: projectTelegraphY(
          y + Math.sin(intoAngle) * outerR,
          projectionYScale,
        ),
      };
      const innerToward =
        innerR > 0.5
          ? {
              x: x + Math.cos(intoAngle) * innerR,
              y: projectTelegraphY(
                y + Math.sin(intoAngle) * innerR,
                projectionYScale,
              ),
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
    edges.push(
      ellipseEdge(x, y, a, 0, Math.PI * 2, projectionYScale, zoom, true, true),
    );
    if (b > 0.5)
      edges.push(
        ellipseEdge(
          x,
          y,
          b,
          0,
          Math.PI * 2,
          projectionYScale,
          zoom,
          false,
          true,
        ),
      );
  } else {
    const radius = Math.max(2, a);
    edges.push(
      ellipseEdge(
        x,
        y,
        radius,
        0,
        Math.PI * 2,
        projectionYScale,
        zoom,
        true,
        true,
      ),
    );
  }
  return { edges, centerX: x, centerY };
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
function resolveEnemySprite(
  kind: EnemyKind | undefined,
  rawKind: string,
): string {
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
  private readonly enemies = new Map<string, SpriteRig>();
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
  /** Bounded painted renderer for the server-authoritative kill-XP Echo map. */
  private xpMotes!: XpMoteRenderer;
  /** §19 v0.108 procedural audio — the whole game's SFX play through this (see AudioBus). Shared across
   *  scene re-entries via the registry so the volume/mute setting + context survive a menu round-trip. */
  private audio!: AudioBus;
  /** §TELEGRAPH exact danger edges above terrain/zones and below actor rigs. Never quality-gated. */
  private telegraphGroundGfx!: Phaser.GameObjects.Graphics;
  /** §8 white source/rhythm layer — retained high so parry semantics survive body/projectile clutter. */
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
  /** §8 last-seen `parriedSeq` per player, to fire the white parry flash on a successful parry. */
  private readonly lastParried = new Map<string, number>();
  /** §6 last-seen `revivedSeq` per player, to fire the green revive pop when a rez brings them back. */
  private readonly lastRevived = new Map<string, number>();
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
  /** Stable nearest-six source salience; exact ground geometry is never culled. */
  private meleeFullTells = new Set<string>();
  private readonly meleeTellCandidates: MeleeTellCandidate[] = [];
  private readonly meleeTellAnchor = { x: 0, y: 0 };
  private keys!: Record<
    | "W"
    | "A"
    | "S"
    | "D"
    | "R"
    | "Q"
    | "E"
    | "F"
    | "T"
    | "B"
    | "C"
    | "M"
    | "TAB"
    | "SPACE"
    | "ONE"
    | "TWO"
    | "THREE",
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
  /** SPACE pressed since the last minted command — the jump intent rides the next {seq,dx,dy,jump}. */
  private jumpQueued = false;
  /** This frame's sampled WASD direction (drives the command mint AND the predictor's frame preview). */
  private curDx = 0;
  private curDy = 0;
  /** Self height from the predictor this frame (the rig hop for SELF; remotes use synced height). */
  private selfPredHeight = 0;
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
  private prevSelfHp = -1;
  private lastHurt = 0;
  private localAtkCd = 0;
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
  private damageNumbersSpent = 0;
  private readonly damageNumberEnemies = new Set<string>();
  /** Last-seen duelist `atkSeq` per enemy — trigger a swing animation when it increments. */
  private readonly enemyAtk = new Map<string, number>();
  private readonly equipped = new Map<string, string>();
  /** §7 last-rendered character skin per player — recreate the rig when it changes (C-key swap). */
  private readonly charOf = new Map<string, string>();
  private readonly pickups = new Map<string, Phaser.GameObjects.Container>();
  /** Rendered enemy projectiles (§15 spit), dead-reckoned from server (x,y,vx,vy). */
  private readonly projectiles = new Map<
    string,
    Phaser.GameObjects.Container
  >();
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
  /** §17 optional terrain/prop files that failed to load — skip/fall back and never retry every frame. */
  private readonly floorArtMissing = new Set<string>();
  /** §17 last-seen `fellSeq` per player — fire the fall VFX (dust poof + a local red flash) when it ticks. */
  private readonly lastFell = new Map<string, number>();
  private weaponText!: Phaser.GameObjects.Text;
  private augmentText!: Phaser.GameObjects.Text;
  private modeText!: Phaser.GameObjects.Text;
  private hpBarBg!: Phaser.GameObjects.Rectangle;
  private hpBarFill!: Phaser.GameObjects.Rectangle;
  private hpText!: Phaser.GameObjects.Text;
  private xpBarBg!: Phaser.GameObjects.Rectangle;
  private xpBarFill!: Phaser.GameObjects.Rectangle;
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
  private portal?: Phaser.GameObjects.Container;
  /** §6 chain (v0.103): the violet DEEPER rift — the other half of the extract-vs-push decision. */
  private rift?: Phaser.GameObjects.Container;
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
  private levelWinTimerBar?: Phaser.GameObjects.Rectangle;
  /** Counter tweens target plain values, so the modal must explicitly remove them at every offer edge. */
  private levelWinPaperCounters: Phaser.Tweens.Tween[] = [];
  private levelWinSelectionSent = false;
  private deathText!: Phaser.GameObjects.Text;
  private restartBtn!: Phaser.GameObjects.Text;
  // §21 Testing-Grounds Tab summon menu (dev): pick a monster kind + a multiplier to conjure it.
  private summonObjects: Phaser.GameObjects.GameObject[] = [];
  private summonOpen = false;
  private summonCount = 1; // the multiplier (× this many per spawn click)
  private summonTough = false;
  // §9/§13 drop & salvage (R): tap = drop the held weapon, HOLD = salvage it. `rHold` = seconds R has
  // been down; `rSalvaged` guards the one-shot salvage so a long hold doesn't fire it every frame.
  private rHold = 0;
  private rSalvaged = false;
  /** §13 v0.106 (A11): latch so a JustDown grab suppresses the release-time drop (one press = one grab). */
  private rGrabbed = false;
  /** §13 v0.106 (A11): the nearest grabbable pickup this frame (world px), for the highlight ring. */
  private grabTarget: { x: number; y: number } | null = null;
  /** §13 v0.106 (A11): the pulsing amber ring drawn on the pickup R will take. */
  private grabGfx!: Phaser.GameObjects.Graphics;
  private dropBar?: Phaser.GameObjects.Graphics;
  private dropBarLabel?: Phaser.GameObjects.Text;
  // §9 card carousel — held card big with full stats. Each card holds its LIVE elements (one equation
  // line per §14 damage source, the requirement tokens, the charges/durability readout), recomputed
  // from the player's current attributes every frame so the numbers track levelling.
  private carousel: Card[] = [];
  /** §9 carousel z-order changes only with the held weapon; stable frames must not dirty display-list sort. */
  private carouselDepthSelection = -1;
  // §29 belt arsenal HUD (replaces the carousel in belt mode): 3 slot chips + scrip/bag readout, and a
  // Tab-toggled bag panel with clickable entries (click a bag weapon → equip into the active slot; click a
  // slot → stash to bag). Immediate-mode Graphics + pooled Text; interactive zones rebuilt when the panel opens.
  private arsenalG: Phaser.GameObjects.Graphics | null = null;
  private arsenalTexts: Phaser.GameObjects.Text[] = [];
  private bagOpen = false;
  private bagG: Phaser.GameObjects.Graphics | null = null;
  private bagTexts: Phaser.GameObjects.Text[] = [];
  private bagZones: Phaser.GameObjects.Rectangle[] = [];
  private slotZones: Phaser.GameObjects.Rectangle[] = [];
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
  /** §39 pending dev-portal deep-link ("boss:<kind>" | "weapon:<id>" | "char:<id>"); applied once, then nulled. */
  private devLaunch: string | null = null;

  init(data?: {
    dimensionId?: string;
    bossRush?: boolean;
    belt?: boolean;
    beltLevel?: string;
    dev?: string;
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
      data?.beltLevel ??
      (urlLevel && urlLevel !== "1" ? urlLevel : "sky-carrier");
    // §39 dev-portal deep-link (boss:<kind> | weapon:<id> | char:<id>), applied once after the room connects.
    this.devLaunch = data?.dev ?? params.get("dev") ?? null;
  }

  /** Load the sprite art. §28: ONE packed multiatlas (tools/artkit/pack-atlas.mjs) holds every non-expansion
   *  part as the frame "<id>/<role>", so the WebGL batcher binds a single texture for a whole screen of rigs
   *  instead of one per part (the genre's standard horde-render fix). SpriteRig reads frames via `partTexture`. */
  preload(): void {
    this.load.multiatlas(SPRITE_ATLAS, "sprites/dd-sprites.json", "sprites");
    preloadParticlePacks(this); // §41 the painted element×shape particle packs (Codex factory)
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
      if (!manifest.id.startsWith("x2-") || WEAPONS[manifest.id]?.expansion)
        continue;
      for (const part of manifest.parts) {
        this.load.image(
          `${manifest.id}:${part.role}`,
          `sprites/${manifest.id}/${part.file}`,
        );
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
        this.queueOptionalFloorArt(
          key,
          `tiles/${terrainDimensionId}/tile-${i}.png`,
        );
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
      if (
        /^(tile|decal|poi)-/.test(file.key) ||
        file.key.startsWith("terrain:")
      ) {
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
    if (this.floorArtMissing.has(key) || !this.textures.exists(key))
      return false;
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
      this.game.canvas.removeEventListener(
        "contextmenu",
        this.contextMenuHandler,
      );
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
    this.input.keyboard?.removeCapture("TAB");
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
    this.removeSceneListeners();
    this.leaveCurrentRoom();
    this.destroyPaperPagePool();
    this.clearLevelPaperCounters();

    // Entity, reconciliation, and event-history collections.
    this.blobs.clear();
    this.enemies.clear();
    this.enemyPaperPriority.clear();
    this.paperDeaths.length = 0;
    this.closingPickups.clear();
    this.lastParried.clear();
    this.lastRevived.clear();
    this.telegraphCache.clear();
    this.telegraphForeshadows?.clear();
    this.enemyWindup.clear();
    this.meleeFullTells.clear();
    this.meleeTellCandidates.length = 0;
    this.playerBufs.clear();
    this.enemyBufs.clear();
    this.snapFell.clear();
    this.enemyHp.clear();
    this.enemyCrit.clear();
    this.enemyAtk.clear();
    this.equipped.clear();
    this.charOf.clear();
    this.pickups.clear();
    this.projectiles.clear();
    this.zones.clear();
    this.xpReceiptBatches.clear();
    this.lastFell.clear();
    this.pendingArt.clear();
    // `failedArt` and `floorArtMissing` deliberately follow Phaser's game-wide texture cache, not a run.

    // Display-object/UI pools and handles. The previous objects are already destroyed by Phaser.
    this.poiSprites = [];
    this.dust.length = 0;
    this.floorObjs = [];
    this.levelWinObjects = [];
    this.summonObjects = [];
    this.carousel = [];
    this.carouselDepthSelection = -1;
    this.arsenalTexts = [];
    this.bagTexts = [];
    this.bagZones = [];
    this.slotZones = [];
    this.buyZones = [];
    this.vfxPlayer = undefined!;
    this.xpMotes = undefined!;
    this.telegraphGroundGfx = undefined!;
    this.telegraphGfx = undefined!;
    this.telegraphForeshadows = undefined!;
    this.parryGfx = undefined!;
    this.dustG = undefined;
    this.portalArrow = null;
    this.riftArrow = null;
    this.keys = undefined!;
    this.beltGate = null;
    this.beltBackdrop = null;
    this.beltClouds = null;
    this.dangerVignette = undefined!;
    this.weaponText = undefined!;
    this.augmentText = undefined!;
    this.modeText = undefined!;
    this.hpBarBg = undefined!;
    this.hpBarFill = undefined!;
    this.hpText = undefined!;
    this.xpBarBg = undefined!;
    this.xpBarFill = undefined!;
    this.levelText = undefined!;
    this.bossBarBg = undefined!;
    this.bossBarFill = undefined!;
    this.bossBarSegments = undefined!;
    this.bossText = undefined!;
    this.victoryText = undefined!;
    this.portal = undefined;
    this.rift = undefined;
    this.levelWinTimerBar = undefined;
    this.deathText = undefined!;
    this.restartBtn = undefined!;
    this.grabGfx = undefined!;
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
    this.curDx = 0;
    this.curDy = 0;
    this.selfPredHeight = 0;
    this.wasFrozen = false;
    this.lastSelfMuzzleAt = -9999;
    this.hurtFlash = 0;
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
    this.prevSelfHp = -1;
    this.lastHurt = 0;
    this.localAtkCd = 0;
    this.localParryCd = 0;
    this.parryChain = 0;
    this.parryChainAt = 0;
    this.frozenUntil = 0;
    this.animClock = 0;
    this.shakeUntil = 0;
    this.shakeIntensity = 0;
    this.freezeSpent = 0;
    this.freezeSpentAt = 0;
    this.lastKillStop = 0;
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
    this.levelWinSelectionSent = false;
    this.summonOpen = false;
    this.summonCount = 1;
    this.summonTough = false;
    this.rHold = 0;
    this.rSalvaged = false;
    this.rGrabbed = false;
    this.grabTarget = null;
    this.bagOpen = false;
    this.shopOpen = false;
    this.lastScrip = -1;
    this.lastUpgradeSig = "";
  }

  /** §4 the single shutdown path for globals and network ownership. */
  private shutdownScene(): void {
    this.connectionGeneration++;
    this.xpMotes?.destroy();
    this.xpMotes = undefined!;
    this.destroyPaperPagePool();
    this.clearLevelPaperCounters();
    this.removeSceneListeners();
    this.leaveCurrentRoom();
  }

  create(): void {
    this.resetSceneState();
    const connectionGeneration = ++this.connectionGeneration;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdownScene, this);

    // The themed floor (bed/grid/rail + pits/rim) is drawn in `maybeBuildFloor` once the server's seeds +
    // `dimensionId` sync — so it uses the ACTIVE §17 dimension's palette, not a guessed default.
    this.vfxPlayer = new VfxPlayer(this);
    // §TELEGRAPH the exact, quality-invariant footprint sits with ground gameplay markings, not over actors.
    this.telegraphGroundGfx = this.add.graphics().setDepth(3);
    this.telegraphForeshadows = new TelegraphForeshadowPool(this);
    // §8 white source/rhythm layer: compact parry timing stays high enough to read over bodies.
    this.telegraphGfx = this.add.graphics().setDepth(99990);
    // H10: the local player's parry-state ring. Just under the white-tell layer + above the bodies, so the
    // "ready vs recovering vs i-frames-up" read sits right on your own drifter.
    this.parryGfx = this.add.graphics().setDepth(99989);
    // §13 v0.106 (A11): the grab-highlight ring on the pickup R will take (just under the parry ring).
    this.grabGfx = this.add.graphics().setDepth(99988);
    // §19 v0.108 low-HP danger vignette — a screen-space red edge glow (under HUD text), alpha 0 at rest.
    this.dangerVignette = this.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(99998)
      .setAlpha(0);
    this.hurtFlash = 0;
    this.hpShown = -1;
    this.xpShown = -1;
    this.bossShown = -1;

    // §19 v0.108 audio — ONE AudioBus shared across scene re-entries via the game registry (so the
    // volume/mute setting + the live AudioContext survive a menu round-trip). Resumed on the first user
    // gesture below (autoplay policy).
    this.audio =
      (this.game.registry.get("audio") as AudioBus | undefined) ??
      new AudioBus();
    this.game.registry.set("audio", this.audio);
    this.xpMotes = new XpMoteRenderer(this, {
      target: (collectorId, out) => this.xpCatchPoint(collectorId, out),
      project: (x, y, out) => this.projectXpPoint(x, y, out),
      receipt: (event) => this.onXpReceipt(event),
    });

    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error("Keyboard input unavailable");
    this.keys = keyboard.addKeys(
      "W,A,S,D,R,Q,E,F,T,B,C,M,TAB,SPACE,ONE,TWO,THREE",
    ) as Record<
      | "W"
      | "A"
      | "S"
      | "D"
      | "R"
      | "Q"
      | "E"
      | "F"
      | "T"
      | "B"
      | "C"
      | "M"
      | "TAB"
      | "SPACE"
      | "ONE"
      | "TWO"
      | "THREE",
      Phaser.Input.Keyboard.Key
    >;
    // Tab would otherwise move browser focus off the canvas — capture it so the summon menu owns it.
    keyboard.addCapture("TAB");
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
    };
    this.scale.on("resize", this.resizeHandler);

    this.buildHud();
    this.buildCarousel();
    this.drawVignette();
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
    this.modeText.setFontSize(15 * s);
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
    this.levelText = this.add
      .text(0, 0, "", { fontSize: "13px", color: "#ffd479", fontStyle: "bold" })
      .setScrollFactor(0)
      .setOrigin(0, 1)
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
    this.restartBtn.on("pointerdown", () => this.room?.send("restart"));

    // §9/§13 drop/salvage hold bar — fills while R is held; release before full = drop, full = salvage.
    this.dropBar = this.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(100003)
      .setVisible(false);
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
      .text(0, 0, "", { fontSize: "13px", color: "#9cff3b", fontStyle: "bold" })
      .setScrollFactor(0)
      .setOrigin(0, 1)
      .setDepth(100002);

    // §8 owned parry-augment readout (sits just above the weapon readout).
    this.augmentText = this.add
      .text(0, 0, "", { fontSize: "12px", color: "#b07bd6", fontStyle: "bold" })
      .setScrollFactor(0)
      .setOrigin(0, 1)
      .setDepth(100002);

    // Mode banner (top-center) — shows the Testing Grounds hint, and "T" toggle either way.
    this.modeText = this.add
      .text(0, 0, "", {
        fontSize: "15px",
        color: "#33e6ff",
        fontStyle: "bold",
        align: "center",
      })
      .setScrollFactor(0)
      .setOrigin(0.5, 0)
      .setDepth(100002);

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
        fontSize: "14px",
        color: "#ffb23b",
        fontStyle: "bold",
      })
      .setScrollFactor(0)
      .setOrigin(0.5, 1)
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
        // §41 lazy-art RETRO-UPGRADE: a pickup built while its weapon art was still loading rendered the
        // tier-bundle fallback FOREVER (a fresh showroom page of 42 expansion weapons showed all blobs —
        // "assets missing"). Once the texture lands, rebuild the pickup with its real art.
        const wantArt = existing0.getData("pendingArt") as string | undefined;
        const wantRole =
          SPRITES[wantArt as keyof typeof SPRITES]?.parts[0]?.role;
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
      const part =
        isMystery || !this.ensureWeaponArt(weapon)
          ? undefined
          : manifest?.parts[0];
      const accent =
        isMystery || pk.rarity > 0
          ? rarity.color
          : (WEAPON_ACCENT[weapon] ?? 0xffd479);
      const accentHex = `#${accent.toString(16).padStart(6, "0")}`;
      const baseScale = part ? 72 / part.w : 1;

      const beam = this.add
        .rectangle(0, -10, 34, 104, accent, 0.08)
        .setBlendMode(ADD); // pedestal light
      const halo = this.add
        .ellipse(0, 30, 100, 34, accent, 0.22)
        .setBlendMode(ADD); // ground glow
      const glow = this.add
        .ellipse(0, 0, 78, 78, accent, 0.32)
        .setBlendMode(ADD);
      const edge = this.add
        .rectangle(0, 0, 2, 44, 0xffffff, 0)
        .setBlendMode(ADD);
      const tx = part ? partTexture(this, weapon, part.role) : null;
      // Mystery = a rarity-tinted sealed ORB (+ "?"), NOT the weapon art. A circle spins cleanly under
      // the faux-3D scaleX tween (a rotated rect collapsed into a diagonal sliver — verify finding).
      const img =
        part && tx
          ? this.add.image(0, 0, tx.key, tx.frame).setScale(baseScale)
          : this.add
              .circle(0, 0, 20, accent, 0.9)
              .setStrokeStyle(2, 0x1a1410, 0.6);
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
      const classGlyph =
        weaponClass === "ranged" ? "➶" : weaponClass === "caster" ? "✦" : "⚔";
      const affixName = pk.affixPublic ? affixById(pk.affixPublic).name : "";
      const labelText = isMystery
        ? `${rarity.name} ${classGlyph}`
        : `${def?.name ?? weapon}${affixName ? ` · ${affixName}` : ""}${pk.rarity > 0 ? ` (${rarity.name})` : ""}`;
      const label = this.add
        .text(0, 42, labelText, {
          fontSize: "11px",
          color: accentHex,
          fontStyle: "bold",
        })
        .setOrigin(0.5);
      const spinnerKids: Phaser.GameObjects.GameObject[] = [glow, img, edge];
      if (shine) spinnerKids.push(shine);
      if (mysteryMark) spinnerKids.push(mysteryMark);
      const spinner = this.add.container(0, 0, spinnerKids);
      const container = this.add
        .container(pk.x, pk.y, [beam, halo, spinner, label])
        .setDepth(2);
      container.setData({
        spinner,
        spinImg: img,
        spinGlow: glow,
        spinShine: shine,
        spinEdge: edge,
        mysteryMark,
        pickupLabel: label,
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
            edge
              .setAlpha(edgeAlpha)
              .setScale(1, 0.75 + 0.25 * Math.abs(Math.sin(theta)));
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
    const visible = Phaser.Geom.Rectangle.Contains(
      this.cameras.main.worldView,
      pickup.x,
      pickup.y,
    );
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
    const img = pickup.getData("spinImg") as
      Phaser.GameObjects.Image | Phaser.GameObjects.Arc;
    const glow = pickup.getData("spinGlow") as Phaser.GameObjects.Arc;
    const shine = pickup.getData(
      "spinShine",
    ) as Phaser.GameObjects.Image | null;
    const edge = pickup.getData("spinEdge") as Phaser.GameObjects.Rectangle;
    const mysteryMark = pickup.getData(
      "mysteryMark",
    ) as Phaser.GameObjects.Text | null;
    const label = pickup.getData("pickupLabel") as Phaser.GameObjects.Text;
    const baseScale = pickup.getData("baseScale") as number;
    const theta0 = (pickup.getData("spinTheta") as number | undefined) ?? 0;
    const theta1 =
      Math.PI / 2 +
      (Math.floor((theta0 - Math.PI / 2) / Math.PI) + 1) * Math.PI;
    spinner.setScale(1).setRotation(0);
    const labelCenterY = label.y;
    label.setOrigin(0.5, 0).setY(labelCenterY - label.height * 0.5);
    this.closingPickups.add(pickup);
    this.paperPeakObjects = Math.max(
      this.paperPeakObjects,
      this.paperDeaths.length +
        this.closingPickups.size +
        (this.paperWorldFold ? 4 : 0),
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
  /** §13 v0.104 lazy-load a weapon's sliced parts at RUNTIME (the +300 expansion arsenal is not
   *  boot-loaded — a mystery drop is the first time the client learns it needs this art). Returns true
   *  when the art is ready; false while the load is in flight (caller retries next frame — equipWeapons
   *  and syncPickups both re-run per frame, so the art pops in within a beat). */
  private ensureWeaponArt(spriteId: string): boolean {
    const manifest = SPRITES[spriteId as keyof typeof SPRITES];
    if (!manifest) return false;
    const first = manifest.parts[0];
    if (!first) return false;
    const tx = partTexture(this, spriteId, first.role);
    if (this.textures.exists(tx.key)) return true;
    if (this.failedArt.has(spriteId)) return false; // 404'd — don't retry forever
    if (!this.pendingArt.has(spriteId)) {
      this.pendingArt.add(spriteId);
      for (const part of manifest.parts) {
        this.load.image(
          `${spriteId}:${part.role}`,
          `sprites/${spriteId}/${part.file}`,
        );
      }
      // A missing file (packaging drift) must not stall the equip loop forever: mark the sprite FAILED so
      // equipWeapons falls through to empty hands (the weapon still works — it's just not drawn in hand).
      this.load.once(Phaser.Loader.Events.COMPLETE, () => {
        if (!this.textures.exists(`${spriteId}:${first.role}`)) {
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
      if (this.equipped.get(id) === player.weapon) return;
      const def = WEAPONS[player.weapon];
      // §6 a weapon may borrow another's sprite as placeholder art (e.g. the Gravedigger's Spade) via `sprite`.
      const spriteId = def?.sprite ?? player.weapon;
      const manifest = SPRITES[spriteId as keyof typeof SPRITES];
      if (def && manifest && !this.failedArt.has(spriteId)) {
        // §13 v0.104 an expansion drop's art loads on demand — hold off equipping until it lands
        // (this runs per frame, so the weapon appears in hand a beat after the grab).
        if (!this.ensureWeaponArt(spriteId)) {
          // §7 v0.105 de-clunk: don't keep drawing + SWINGING the OLD weapon while the new art loads (the rig
          // was mid-swap running the stale weapon's timing during the loot celebration). Drop to the new
          // weapon's empty-hands pose now; the sprite pops in a beat later once its art lands.
          rig.unequip(def);
          return;
        }
        rig.equipWeapon(spriteId, def, manifest);
        this.equipped.set(id, player.weapon);
      } else if (def) {
        rig.unequip(def); // §9 fists / missing-art fallback / no held sprite → empty hands
        this.equipped.set(id, player.weapon);
      }
    });
  }

  /** Curated world-only capture list: HUD and exact telegraphs remain live above the folding sheet. */
  private paperWorldObjects(): Phaser.GameObjects.GameObject[] {
    const out: Phaser.GameObjects.GameObject[] = [...this.floorObjs];
    for (const rig of this.blobs.values()) out.push(rig.root);
    for (const rig of this.enemies.values()) out.push(rig.root);
    for (const pickup of this.pickups.values()) out.push(pickup);
    for (const projectile of this.projectiles.values()) out.push(projectile);
    for (const zone of this.zones.values()) out.push(zone);
    if (this.portal) out.push(this.portal);
    if (this.rift) out.push(this.rift);
    const camera = this.cameras.main;
    return camera
      .cull(out.filter((obj) => obj.active && obj.willRender(camera)))
      .sort(
        (a, b) =>
          ((a as Phaser.GameObjects.GameObject & { depth?: number }).depth ??
            0) -
          ((b as Phaser.GameObjects.GameObject & { depth?: number }).depth ??
            0),
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
      snapshot = this.add
        .renderTexture(0, 0, captureW, captureH)
        .setOrigin(0)
        .setVisible(false);
      const saved = snapshot.saveTexture(textureKey);
      saved.add("top", 0, 0, 0, captureW, halfH);
      saved.add("bottom", 0, 0, halfH, captureW, captureH - halfH);
      if (!this.paperPagePool) {
        this.paperPagePool = {
          top: this.add.image(0, 0, "__WHITE").setVisible(false),
          bottom: this.add.image(0, 0, "__WHITE").setVisible(false),
          crease: this.add
            .rectangle(0, 0, 2, 10, 0x8e4bd6, 0)
            .setVisible(false),
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
      console.warn(
        "[paper] world snapshot failed; using the transition flash",
        err,
      );
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
    this.flashBanner(
      `⇓  DEPTH ${depth} — ${dimensionName.toUpperCase()}  ⇓`,
      "#b478ff",
    );
  }

  /** Close the old snapshot, swap its pixels only while edge-on, then unfold the accepted new world. */
  private playPaperWorldFold(
    fold: PaperWorldFold,
    depth: number,
    dimensionName: string,
  ): void {
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
    if (fold.top.active)
      fold.top.setVisible(false).setAlpha(1).setTexture("__WHITE");
    if (fold.bottom.active)
      fold.bottom.setVisible(false).setAlpha(1).setTexture("__WHITE");
    if (fold.crease.active) fold.crease.setVisible(false).setAlpha(0);
    if (this.textures.exists(fold.textureKey))
      this.textures.remove(fold.textureKey);
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
        console.error(
          "[belt] buildBeltFloor failed — level renders without its floor art",
          e,
        );
        this.cameras.main.setBackgroundColor(this.beltTheme().sky);
      }
      this.predictor?.setMap(undefined);
      this.predictor?.setBeltLevel(this.beltLevel);
    } else {
      this.floorObjs.push(
        ...drawArena(
          this,
          this.arenaMap,
          dimension.id,
          (k) => this.hasTile(k),
          palette,
        ),
      );
      this.floorObjs.push(
        ...buildArenaFloor(
          this,
          this.arenaMap,
          dimension.id,
          (k) => this.hasTile(k),
          palette,
        ),
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
        this.flashBanner(
          `⇓  DEPTH ${s.depth} — ${getDimension(s.dimensionId).name.toUpperCase()}  ⇓`,
          "#b478ff",
        );
      }
      if (worldFold)
        this.playPaperWorldFold(worldFold, s.depth, dimension.name);
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
        this.shakeCam(150, 0.006);
        this.audio.play("fall"); // §19 void whoosh + a thud on the snap-back landing
      }
    });
  }

  private async connect(generation: number): Promise<void> {
    const status = document.getElementById("status");
    // §4 secure deployments must use WSS; localhost/http development remains the same WS endpoint.
    const scheme = location.protocol === "https:" ? "wss" : "ws";
    const client = new Client(
      `${scheme}://${location.hostname}:${DEFAULT_PORT}`,
    );

    // Retry with backoff: on a cold `pnpm dev`, the Vite client is ready seconds before
    // the Colyseus server finishes starting. Without retry, the first load throws and
    // shows no player until a manual refresh. This self-heals as soon as the server is up.
    const maxAttempts = 30;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // §17 pass the menu's dimension pick as a join option (the room creator scopes the run to it; a
        // joiner inherits the host's synced dimension — `getDimension` server-side rejects an unknown id).
        const joinOpts = {
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
          if (generation !== this.connectionGeneration || this.room !== room)
            return;
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
          if (generation === this.connectionGeneration && this.room === room)
            this.onPatch(state);
        };
        room.onStateChange(onStateChange);
        let stateSubscribed = true;
        this.roomStateDisposers.push(() => {
          if (!stateSubscribed) return;
          stateSubscribed = false;
          room.onStateChange.remove(onStateChange);
        });
        if (status)
          status.textContent = `connected · you are ${room.sessionId.slice(0, 4)}`;
        return;
      } catch (err) {
        if (generation !== this.connectionGeneration) return;
        console.warn(
          `[client] join attempt ${attempt}/${maxAttempts} failed, retrying…`,
          err,
        );
        if (status)
          status.textContent = `connecting… (waiting for server, attempt ${attempt})`;
        await new Promise((resolve) => setTimeout(resolve, 1000));
        if (generation !== this.connectionGeneration) return;
      }
    }

    if (generation === this.connectionGeneration && status) {
      status.textContent =
        "connection failed — is the server running? (pnpm dev:server)";
    }
  }

  private addBlob(player: PlayerState, id: string): void {
    const isSelf = id === this.room?.sessionId;
    const charId =
      player.character && SPRITES[player.character as keyof typeof SPRITES]
        ? player.character
        : PLAYER_SPRITE;
    const rig = new SpriteRig(this, player.x, player.y, isSelf, id, charId);
    rig.setRigScale(characterScale(charId)); // §7 bump small-footprint skins so none read as tiny
    this.blobs.set(id, rig);
    this.charOf.set(id, player.character);
    if (isSelf) this.centerCam(player.x, player.y);
  }

  private removeBlob(id: string): void {
    this.blobs.get(id)?.destroy();
    this.blobs.delete(id);
    this.equipped.delete(id);
    this.charOf.delete(id);
    this.playerBufs.delete(id); // §4 v0.107 snapshot ring + fell watcher go with the player
    this.snapFell.delete(id);
    // §8/§6/§17 edge-trigger cursors are session-scoped too — a departed id must not live in these maps.
    this.lastParried.delete(id);
    this.lastRevived.delete(id);
    this.lastFell.delete(id);
  }

  override update(_time: number, deltaMs: number): void {
    // §39 the room resolves BEFORE its first state patch — in that window state.players is still undefined,
    // and an unguarded read threw every frame (killing the scene's step = permanent black screen; hit on real
    // machines where the first patch lands a frame late, never in the fast local preview). Wait for the sync.
    if (!this.room || !this.room.state.players) return;

    this.deltaSec = deltaMs / 1000;
    // §19 v0.108 refresh the audio pan reference to the camera's world centre BEFORE this frame's play()
    // calls (so a sound's stereo position tracks where it happens on screen; end-of-update ordering panned
    // against the prior frame + origin-0 on frame one — adversarial-verify finding).
    const cam = this.cameras.main;
    this.audio.setListener(
      cam.scrollX + cam.width / cam.zoom / 2,
      cam.width / cam.zoom / 2,
    );
    // §9/§13 R — context-sensitive: if a dropped weapon is within reach, TAP = GRAB it (equip). Otherwise,
    // with a weapon held, TAP = drop it on the floor and HOLD = salvage it into the bag. Spacebar = jump.
    // (Restart the run is now the on-screen button, top-right.)
    const selfP = this.room.state.players.get(this.room.sessionId);
    const alive = !!selfP && selfP.alive;
    const holdingWeapon = !!selfP && selfP.weapon !== FISTS_WEAPON;
    // The NEAREST grabbable pickup within arm's reach (then R means "grab", not "drop/salvage"), tracked so
    // the §13 v0.106 (A11) highlight ring can show WHICH one R will take.
    let nearPickup = false;
    this.grabTarget = null;
    if (selfP && alive) {
      let bestD = PICKUP_RADIUS * PICKUP_RADIUS;
      this.room.state.pickups.forEach((pk) => {
        const dx = pk.x - selfP.x;
        const dy = pk.y - selfP.y;
        const d = dx * dx + dy * dy;
        if (d <= bestD) {
          bestD = d;
          nearPickup = true;
          this.grabTarget = { x: pk.x, y: pk.y };
        }
      });
    }
    const canSalvage = alive && holdingWeapon && !nearPickup; // hold-to-salvage only when not grabbing
    // §13 v0.106 (A11): grab on JustDOWN, not release — grabbing on JustUp added your whole hold time as
    // pickup latency. The `rGrabbed` latch suppresses the release-time drop so one press = one grab.
    if (Phaser.Input.Keyboard.JustDown(this.keys.R) && alive && nearPickup) {
      this.room.send("grabWeapon");
      this.rGrabbed = true;
      this.audio.play("grab"); // §19 a soft two-note pickup blip
    }
    // `!rGrabbed`: if this R-press already fired a grab (JustDown), it does nothing else for the rest of the
    // hold — one press = one grab, so walking off a pickup mid-hold can't then accidentally salvage the
    // weapon you just picked up.
    if (this.keys.R.isDown && canSalvage && !this.rGrabbed) {
      this.rHold += this.deltaSec;
      if (this.rHold >= SALVAGE_HOLD_SECONDS && !this.rSalvaged) {
        this.room.send("salvageWeapon");
        this.rSalvaged = true;
      }
    }
    if (Phaser.Input.Keyboard.JustUp(this.keys.R)) {
      if (
        !this.rGrabbed &&
        !this.rSalvaged &&
        this.rHold > 0.02 &&
        this.rHold < SALVAGE_HOLD_SECONDS &&
        holdingWeapon
      ) {
        this.room.send("dropWeapon"); // a quick tap (not a grab, not a salvage-hold) = drop
      }
      this.rHold = 0;
      this.rSalvaged = false;
      this.rGrabbed = false;
    }
    this.updateDropBar(canSalvage);
    this.renderGrabHighlight();
    // §5 traversal hop — §4 v0.107: the jump intent RIDES the next sequence-numbered input command (so
    // its consume tick is part of the acked timeline) and the predictor hops the rig instantly.
    if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE) && alive)
      this.jumpQueued = true;
    // §42 E is the INTERACT key players instinctively press on a ground weapon — if one is in reach, E
    // GRABS it (same as R). Before this, E near a pickup flipped the showroom PAGE (respawning every
    // pickup in the grid as a DIFFERENT weapon at the same spot) or cycled the held roster — so "pick
    // up with E" handed you a seemingly random weapon. Cycle/browse stays on E only when clear of pickups.
    const eDown = Phaser.Input.Keyboard.JustDown(this.keys.E);
    if (eDown && alive && nearPickup) {
      this.room.send("grabWeapon");
      this.audio.play("grab");
    }
    const eFree = eDown && !(alive && nearPickup);
    // §29 belt: Q/E cycle the 3-slot ARSENAL (not the whole roster) + 1/2/3 jump straight to a slot; arena
    // keeps the roster carousel.
    if (this.belt) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.Q))
        this.room?.send("cycleSlot", { dir: 1 });
      if (eFree) this.room?.send("cycleSlot", { dir: -1 });
      if (Phaser.Input.Keyboard.JustDown(this.keys.ONE))
        this.room?.send("swapSlot", { slot: 0 });
      if (Phaser.Input.Keyboard.JustDown(this.keys.TWO))
        this.room?.send("swapSlot", { slot: 1 });
      if (Phaser.Input.Keyboard.JustDown(this.keys.THREE))
        this.room?.send("swapSlot", { slot: 2 });
    } else if (this.room?.state.mode === "training") {
      // §31 Testing-Grounds SHOWROOM: Q/E browse the weapon-gallery PAGES (all 300+ arted weapons).
      if (Phaser.Input.Keyboard.JustDown(this.keys.Q))
        this.room?.send("galleryPage", { dir: 1 });
      if (eFree) this.room?.send("galleryPage", { dir: -1 });
    } else {
      if (Phaser.Input.Keyboard.JustDown(this.keys.Q))
        this.room?.send("cycleWeapon", { dir: 1 });
      if (eFree) this.room?.send("cycleWeapon", { dir: -1 });
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.T))
      this.room?.send("toggleTraining");
    if (Phaser.Input.Keyboard.JustDown(this.keys.B))
      this.room?.send("spawnBoss");
    // §19 v0.108 M toggles audio mute (persisted) + a confirming toast.
    if (Phaser.Input.Keyboard.JustDown(this.keys.M)) {
      const muted = this.audio.toggleMute();
      this.flashBanner(muted ? "🔇 AUDIO OFF" : "🔊 AUDIO ON", "#8fdcff");
    }
    // Tab: §29 belt opens the ARSENAL BAG overlay; elsewhere it's the §21 dev summon menu (Testing Grounds).
    if (Phaser.Input.Keyboard.JustDown(this.keys.TAB)) {
      if (this.belt) {
        this.bagOpen = !this.bagOpen;
        if (this.bagOpen) this.shopOpen = false; // one overlay at a time
      } else {
        const training = this.room?.state.mode === "training";
        if (training && !this.summonOpen) this.openSummonMenu();
        else this.closeSummonMenu();
      }
    }
    // §29 F = trade with the shopkeeper when standing near them; walking away auto-closes the SELL overlay.
    if (this.belt) {
      const shopX = this.room?.state.beltShopX ?? 0;
      const selfX =
        this.room?.state.players.get(this.room?.sessionId ?? "")?.x ?? 0;
      const nearShop = shopX > 0 && Math.abs(selfX - shopX) <= SHOP_RADIUS;
      if (Phaser.Input.Keyboard.JustDown(this.keys.F) && nearShop) {
        this.shopOpen = !this.shopOpen;
        if (this.shopOpen) this.bagOpen = false;
      }
      if (!nearShop) this.shopOpen = false;
    }
    if (this.summonOpen && this.room?.state.mode !== "training")
      this.closeSummonMenu();
    if (Phaser.Input.Keyboard.JustDown(this.keys.C))
      this.room?.send("cycleCharacter"); // §7 swap skin

    this.maybeBuildFloor(); // §17 bake the procgen floor once the seeds arrive
    this.stepNetInput(deltaMs); // §4 v0.107 mint/send/predict this frame's input commands
    this.syncBlobs();
    this.checkFalls(); // §17 fall VFX (after blobs so the landing poof lands right)
    this.equipWeapons();
    this.syncEnemies();
    this.syncPickups();
    this.syncProjectiles();
    this.syncZones();
    this.syncPortal();
    // Hit-stop (§20): briefly freeze the visuals on impactful events for weight. Input/sync keep
    // running so it doesn't feel laggy; positions/poses catch up when the freeze lifts.
    if (this.time.now >= this.frozenUntil) {
      // §4 v0.107 UNFREEZE edge: the predictor kept ticking through the freeze but the rig didn't move —
      // fold the accrued displacement into the error offset so the catch-up GLIDES instead of popping
      // ~42px on the exact frame that was supposed to feel weighty (review #11).
      if (this.wasFrozen && this.predictor) {
        const selfRig = this.room
          ? this.blobs.get(this.room.sessionId)
          : undefined;
        if (selfRig) {
          const r = this.predictor.renderPos(
            this.curDx,
            this.curDy,
            this.inputAccMs / 1000,
          );
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
      this.moveProjectiles(this.deltaSec);
      this.animateBlobs(deltaMs);
      this.animateEnemies(deltaMs);
      this.projectBelt(); // §29 belt mode: remap floor objects onto the depth band + depth-sort (no-op otherwise)
      this.renderProjectileTells(); // M2: parry tell on incoming hostile shots (drawn on the white-tell layer)
    } else {
      this.wasFrozen = true;
    }
    // XP motion is server-timed and continues through local hit-stop; a frozen rig is a stable catch target.
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
      // AudioBus's reward voice already rises with `amt`; one 70ms bucket speaks for every same-frame catch.
      this.audio.play("loot", {
        x: event.x,
        amt: Math.min(1, this.xpAudioStreak * 0.075),
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

  /** Reconcile rendered enemies against authoritative state (same race-proof pattern as blobs). */
  private syncEnemies(): void {
    if (!this.room) return;
    const enemies = this.room.state.enemies;
    const reducedMotion = prefersReducedPaperMotion();
    enemies.forEach((enemy, id) => {
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
        const paperPriority: 0 | 1 | 2 =
          kind?.archetype === "boss" ? 2 : enemy.tough ? 1 : 0;
        this.enemyPaperPriority.set(id, paperPriority);
        if (!reducedMotion)
          rig.playSpawnUnfold(this.animClock, paperPriority > 0 ? 280 : 220);
        this.enemies.set(id, rig);
        this.enemyAtk.set(id, enemy.atkSeq);
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
        if (sample?.active)
          this.enemies.get(id)?.resolveMeleeTell(this.time.now, aimWorld);
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
        this.enemies.delete(id);
        this.enemyPaperPriority.delete(id);
        this.enemyHp.delete(id);
        this.enemyCrit.delete(id);
        this.enemyAtk.delete(id);
        this.enemyWindup.delete(id);
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
            spawnPoof(this, rig.x, rig.y); // dust at the kill point
            this.audio.play("death", { x: rig.x }); // §19 kill crunch (throttled for horde clears)
            // §20 death-pop: fling the corpse AWAY from the nearest living player (≈ the killer) + up.
            const deathSeed = telegraphHash01(id);
            let ax = Math.cos(deathSeed * Math.PI * 2);
            let ay = Math.sin(deathSeed * Math.PI * 2);
            let best = Number.POSITIVE_INFINITY;
            let killWeapon: WeaponDef | undefined;
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
              paperPriority > 0
                ? PAPER_DEATH_FULL_BUDGET
                : PAPER_DEATH_ORDINARY_BUDGET;
            const full = visible && !reducedMotion && fullActive < fullLimit;
            const variants: readonly PaperDeathTreatment[] = [
              "crumple",
              "flutter",
              "tear",
            ];
            const treatment: PaperDeathTreatment = full
              ? paperPriority > 0
                ? "tear"
                : (variants[Math.floor(deathSeed * variants.length)] ??
                  "crumple")
              : "lite";
            if (visible) {
              rig.deathPop((ax / al) * dist, (ay / al) * dist, treatment);
              this.paperDeaths.push({ rig, full });
              this.paperPeakObjects = Math.max(
                this.paperPeakObjects,
                this.paperDeaths.length +
                  this.closingPickups.size +
                  (this.paperWorldFold ? 4 : 0),
              );
            } else {
              rig.destroy();
            }
            // H3 §20 hit-stop: a brief crunch when a kill lands near YOU (≈ your kill). Throttled so a
            // horde-clearing AoE can't chain freezes into lag; parry/quake stops override via Math.max.
            const selfId = this.room?.sessionId;
            const me = selfId
              ? this.room?.state.players.get(selfId)
              : undefined;
            if (
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
    const rt = this.timeline.ready
      ? this.timeline.renderTime(this.time.now)
      : -1;
    this.room.state.enemies.forEach((enemy, id) => {
      const rig = this.enemies.get(id);
      if (!rig) return;
      const s =
        rt >= 0
          ? this.enemyBufs
              .get(id)
              ?.sampleInto(rt, INTERP_SNAP_ENEMY, this.enemySample)
          : null;
      if (s) rig.setPosition(s.x, s.y);
      else rig.setPosition(enemy.x, enemy.y);
    });
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
        row.kindTag === TelegraphKindTag.Melee ||
        row.kindTag === TelegraphKindTag.Quake
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
  private applyBossTelegraphPose(
    rig: SpriteRig,
    bossKind: string,
    anim: RigAnim,
  ): void {
    const pose = this.bossTelegraphPose;
    if (!pose.active) return;
    if (pose.id !== this.bossPoseRowId) {
      this.bossPoseRowId = pose.id;
      this.bossPoseBeatMask = 0;
    }

    let aimWorld = pose.rot;
    const directional =
      pose.shape === TgShape.Rect ||
      pose.shape === TgShape.ArcSweep ||
      pose.shape === TgShape.Cone;
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
    if (bossKind === "nul-sightline" || bossKind === "quickdraw-vane")
      anim.speed = 0;
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
    this.meleeTellCandidates.length = 0;

    // Sample every phase and rank salience once before any rig consumes it. Geometry/rhythm is never culled.
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
              Math.atan2(Math.sin(Math.atan2(dy, dx) - row.rot), Math.cos(Math.atan2(dy, dx) - row.rot)),
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
      const es = this.room?.state.enemies.get(id);
      const windup = this.enemyWindup.get(id);
      if (es && windup?.active) {
        const kind = ENEMY_KINDS[es.kind];
        rig.setMeleeTell(
          windup.shownT,
          windup.aimWorld,
          windup.remainingMs,
          windup.locked,
          kind?.archetype ?? "duelist",
          windup.step,
          this.meleeFullTells.has(id),
        );
      }
      if (es && es.kind === this.room?.state.bossKind)
        this.applyBossTelegraphPose(rig, es.kind, anim);
      rig.animate(this.animClock, anim);
      // §8 Brand tint — and §16 OLD RUST glows the same heat-orange at P3 ENRAGE (overheating).
      const enraged =
        es?.kind === "old-rust" && (this.room?.state.bossPhase ?? 0) >= 3;
      rig.setBranded((es?.branded ?? 0) > 0 || enraged);
      if (es && windup?.active) {
        const melee = effectiveMelee(ENEMY_KINDS[es.kind]);
        if (melee) {
          const row = state?.telegraphs.get(`${MELEE_TELEGRAPH_PREFIX}${id}`);
          const pulse = now - windup.glintAtMs >= 0 && now - windup.glintAtMs <= MELEE_GLINT_CREST_MS;
          this.drawMeleeRangeRing(
            row?.x ?? es.x,
            row?.y ?? es.y,
            melee.range,
            melee.halfArc,
            row?.rot ?? windup.aimWorld,
            windup.shownT,
            windup.remainingMs,
            windup.remainingMs <= PARRY_IFRAMES * 1000,
            pulse,
            !!row,
          );
          if (row) this.drawMeleeTravelStem(es.x, es.y, row.x, row.y);
          if (this.meleeFullTells.has(id))
            this.drawMeleeImplementBracket(rig, windup.aimWorld, windup.shownT, pulse);
        }
      }
      rig.setDepth(rig.y);
    }
    this.renderTelegraphs();
  }

  private sampleEnemyWindup(
    id: string,
    enemy: { windup: number; atkSeq: number; x: number; y: number },
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
    const durationMs = (step === 0 ? melee.windup : melee.swingGap) * 1000;
    const newEpoch = !sample || !sample.active || synced + 0.001 < sample.serverT;
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
    } else if (tick !== sample.serverTick) {
      const tickDelta = (tick - sample.serverTick) >>> 0;
      if (synced > sample.serverT && tickDelta > 0) {
        sample.ratePerSecond =
          (synced - sample.serverT) / ((tickDelta * TICK_MS) / 1000);
      }
      sample.previousT = sample.serverT;
      sample.previousTick = sample.serverTick;
      sample.serverT = synced;
      sample.serverTick = tick;
      sample.observedAtMs = now;
      sample.durationMs = durationMs;
    }
    const extrapolateMs = Math.max(0, Math.min(TICK_MS, now - sample.observedAtMs));
    sample.shownT = Math.max(
      sample.serverT,
      Math.min(0.985, sample.serverT + sample.ratePerSecond * (extrapolateMs / 1000)),
    );
    const priorRemaining = sample.remainingMs;
    sample.remainingMs = Math.max(0, (1 - sample.shownT) * durationMs);
    if (
      sample.glintAtMs < 0 &&
      sample.remainingMs <= MELEE_GLINT_LEAD_MS &&
      (newEpoch || priorRemaining > MELEE_GLINT_LEAD_MS)
    ) {
      sample.glintAtMs = now;
    }

    const row = this.room?.state.telegraphs.get(`${MELEE_TELEGRAPH_PREFIX}${id}`);
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

  /** Keep incumbents unless a materially closer threat challenges; prevents the six source tells churning. */
  private selectMeleeFullTells(): void {
    const compare = (a: MeleeTellCandidate, b: MeleeTellCandidate): number =>
      Number(b.containsSelf) - Number(a.containsSelf) ||
      a.distance - b.distance ||
      a.remainingMs - b.remainingMs ||
      a.id.localeCompare(b.id);
    this.meleeTellCandidates.sort(compare);
    const next = new Set<string>();
    for (const id of this.meleeFullTells) {
      if (next.size >= MELEE_FULL_TELL_COUNT) break;
      if (this.meleeTellCandidates.some((candidate) => candidate.id === id)) next.add(id);
    }
    for (const candidate of this.meleeTellCandidates) {
      if (next.size >= MELEE_FULL_TELL_COUNT) break;
      next.add(candidate.id);
    }
    for (const challenger of this.meleeTellCandidates) {
      if (next.has(challenger.id) || next.size < MELEE_FULL_TELL_COUNT) continue;
      let worst: MeleeTellCandidate | undefined;
      for (const incumbentId of next) {
        const incumbent = this.meleeTellCandidates.find((candidate) => candidate.id === incumbentId);
        if (incumbent && (!worst || compare(incumbent, worst) > 0)) worst = incumbent;
      }
      if (!worst) continue;
      const priorityJump = challenger.containsSelf && !worst.containsSelf;
      const materiallyCloser =
        challenger.containsSelf === worst.containsSelf && challenger.distance < worst.distance * 0.8;
      if (priorityJump || materiallyCloser) {
        next.delete(worst.id);
        next.add(challenger.id);
      }
    }
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
        pass === 0
          ? 0.3
          : 0.13 + t * 0.16 + (armed ? 0.09 : 0) + (pulse ? 0.42 : 0),
      );
      for (let i = 0; i < 8; i++) {
        const start = rot + i * segment + gap;
        this.traceProjectedArc(g, x, y, range, start, rot + (i + 1) * segment - gap, projectionYScale, zoom);
      }
    }
    // The weapon-facing interval is solid, while the rear/side envelope stays broken and secondary.
    g.lineStyle(3.8 / zoom, 0x17120f, 0.34);
    this.traceProjectedArc(g, x, y, range, rot - halfArc, rot + halfArc, projectionYScale, zoom);
    g.lineStyle((pulse ? 3 : 1.8) / zoom, 0xffffff, 0.22 + t * 0.22 + (pulse ? 0.42 : 0));
    this.traceProjectedArc(g, x, y, range, rot - halfArc, rot + halfArc, projectionYScale, zoom);
    // Bright completion travels symmetrically from the sector ends toward the forward notch.
    g.lineStyle((pulse ? 3.4 : 2.2) / zoom, 0xffffff, 0.32 + t * 0.42);
    this.traceProjectedArc(g, x, y, range, rot - halfArc, rot - halfArc + halfArc * t, projectionYScale, zoom);
    this.traceProjectedArc(g, x, y, range, rot + halfArc - halfArc * t, rot + halfArc, projectionYScale, zoom);

    // The final three server ticks pull a second ring inward; the fixed notched reach ruler remains behind.
    if (remainingMs <= 150) {
      const beat = Math.max(0, Math.min(1, remainingMs / 150));
      const beatRange = range * (0.18 + beat * 0.82);
      g.lineStyle((pulse ? 3 : 1.8) / zoom, 0xffffff, 0.24 + (1 - beat) * 0.34);
      this.traceProjectedArc(g, x, y, beatRange, rot - halfArc, rot + halfArc, projectionYScale, zoom);
    }
    this.drawMeleeRangeNotches(
      g,
      x,
      y,
      range,
      rot,
      projectionYScale,
      zoom,
      t,
      armed,
      locked,
    );
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
    const samples = Math.max(
      2,
      Math.min(24, Math.ceil((span * Math.max(1, range * zoom)) / 12)),
    );
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
    for (let pass = 0; pass < 2; pass++) {
      g.lineStyle(
        (pass === 0 ? 5 : pulse ? 3 : 1.8) / zoom,
        pass === 0 ? 0x17120f : 0xffffff,
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
      g.fillStyle(0xffffff, 0.95);
      g.fillCircle(x, y, 3.2 / zoom);
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
      const meleeSample = meleeOwner ? this.enemyWindup.get(meleeOwner) : undefined;
      const effectiveT = meleeOwner
        ? (meleeSample?.shownT ?? st.enemies.get(meleeOwner)?.windup ?? row.t)
        : row.t;
      const meleePulse =
        !!meleeOwner &&
        !!meleeSample &&
        this.time.now - meleeSample.glintAtMs >= 0 &&
        this.time.now - meleeSample.glintAtMs <= MELEE_GLINT_CREST_MS;
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
          sawFull: false,
          seenFrame: frame,
          projectionYScale,
          zoom,
          hash: telegraphHash01(id),
          geometry: buildTelegraphGeometry(
            row.shape,
            row.x,
            row.y,
            row.a,
            row.b,
            row.rot,
            row.kindTag,
            projectionYScale,
            zoom,
          ),
        };
        this.telegraphCache.set(id, cached);
      } else if (geometryChanged) {
        cached.geometry = buildTelegraphGeometry(
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
      }
      this.drawTelegraph(
        g,
        cached.geometry,
        effectiveT,
        row.danger,
        row.kindTag,
        cached.hash,
        meleePulse,
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
      if (c.kindTag === TelegraphKindTag.Slam) {
        // slam / landing-zone — the full impact: burst + camera shake + the deep boom. v0.117: scale the
        // shake + boom by the crater RADIUS (baseline 150px) so the colossus's 220px world-enders shake the
        // screen harder than a normal slam — a big body hits like a big body (WYSIWYG weight).
        const scale = Math.max(0.8, Math.min(1.7, c.a / 150));
        spawnExplosion(this, c.x, impactY, Math.max(24, c.a));
        this.shakeCam(200 * scale, 0.014 * scale);
        this.audio.play("bossslam", { x: c.x, amt: Math.min(1, scale) }); // §19 the deep boom under the shake
      } else if (c.kindTag === TelegraphKindTag.Pool) {
        // corrosive pool — the puddle (a ZoneState) renders itself; just a soft splash, no shake/boom.
        spawnExplosion(this, c.x, impactY, Math.min(40, c.a * 0.4));
      } else if (
        c.kindTag === TelegraphKindTag.Summon ||
        c.kindTag === TelegraphKindTag.Radial
      ) {
        // summon marker / bullet-burst pre-flash — a small pop where the adds/bullets erupt, no shake/boom.
        spawnExplosion(this, c.x, impactY, 22);
      } else if (c.kindTag === TelegraphKindTag.Quake) {
        // §33 FOOTFALL QUAKE landing — the giant's step hits: a big shock ring + dust burst + a HEAVY, low
        // screen-quake and the deep boom. The whole screen jolts so the footstep reads as a footstep.
        const ix = c.x;
        const iy = impactY;
        spawnExplosion(this, ix, iy, Math.max(40, c.a * 0.5));
        this.spawnImpactRing(ix, iy);
        this.shakeCam(280, 0.03); // heavier + longer than a slam — the ground itself buckles
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
  ): void {
    if (danger === 0 && kindTag === TelegraphKindTag.Melee) {
      this.drawMeleeExactFootprint(g, geometry, t, meleePulse);
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
    const cadence =
      0.5 + Math.sin(t * (danger === 0 ? 34 : 23) + hash * Math.PI * 2) * 0.5;
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

  /** The fairness layer: full static sector boundary, dominant range arc, forward notch, inward completion. */
  private drawMeleeExactFootprint(
    g: Phaser.GameObjects.Graphics,
    geometry: TelegraphGeometry,
    t: number,
    pulse: boolean,
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

    // Exact sides remain visible but subordinate; the outer reach arc owns the floor read.
    g.lineStyle(4 / zoom, 0x17120f, 0.38);
    this.strokeTelegraphPath(g, points, true);
    g.lineStyle(1.5 / zoom, 0xffffff, alpha * 0.65);
    this.strokeTelegraphPath(g, points, true);
    g.lineStyle(1.1 / zoom, 0xffffff, alpha * 0.42);
    this.strokeTelegraphPath(g, echo, true);
    g.lineStyle((pulse ? 3.2 : 2) / zoom, 0xffffff, alpha + 0.1);
    this.strokeTelegraphPointRange(g, points, firstArc, lastArc);

    // Progress advances from both angular limits and meets at the committed aim notch on contact.
    const sideCount = Math.max(1, midArc - firstArc);
    const fill = Math.min(sideCount, Math.ceil(sideCount * Math.max(0, Math.min(1, t))));
    g.lineStyle((pulse ? 3.5 : 2.4) / zoom, 0xffffff, 0.42 + t * 0.42);
    this.strokeTelegraphPointRange(g, points, firstArc, firstArc + fill);
    this.strokeTelegraphPointRange(g, points, lastArc - fill, lastArc);

    const origin = points[0]!;
    const notch = points[midArc]!;
    const ndx = origin.x - notch.x;
    const ndy = origin.y - notch.y;
    const nl = Math.hypot(ndx, ndy) || 1;
    g.lineStyle((pulse ? 3.3 : 2) / zoom, 0xffffff, 0.55 + t * 0.35);
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
      const segmentCount = edge.closed
        ? edge.points.length
        : edge.points.length - 1;
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
        for (
          let dist = (phase + i * spacing * 0.37) % spacing;
          dist < len;
          dist += spacing
        ) {
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
            g.lineTo(
              apexX + nx * depth + tx * wing,
              apexY + ny * depth + ty * wing,
            );
            g.moveTo(apexX, apexY);
            g.lineTo(
              apexX + nx * depth - tx * wing,
              apexY + ny * depth - ty * wing,
            );
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
    const flashedShooters = new Set<string>(); // one muzzle flash per shooter per frame (= per shot)
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
      const fx = GUN_FX[baseKind(pr.kind)]; // §35 strip the ":element" tint suffix for the kind lookup
      const container = fx
        ? makeBullet(this, pr)
        : pr.kind === "cleaver"
          ? makeThrownCleaver(this, pr)
          : baseKind(pr.kind) === "magma" // §41 scatter balls carry ":<element>" (frost/void/… casters)
            ? makeMagma(this, pr)
            : pr.kind === "counter" || pr.kind === "deflect"
              ? makeCounter(this, pr) // §8 parry projectile (bounce-back counter OR Superman side-glance)
              : makeSpit(this, pr);
      container.setData("kind", pr.kind);
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
      // §49 projectile rows do not sync an owner. Capture the nearest friendly shooter while the row is
      // fresh so its WeaponDef.tags.element still exists when the projectile later dies and dispatches a pack.
      let shooter: string | null = null;
      if (!pr.hostile) {
        let best = 220;
        room.state.players.forEach((p, pid) => {
          const d = Math.hypot(p.x - pr.x, p.y - pr.y);
          if (d < best) {
            best = d;
            shooter = pid;
          }
        });
      }
      const sourcePlayer = shooter
        ? room.state.players.get(shooter)
        : undefined;
      if (sourcePlayer) container.setData("sourceWeapon", sourcePlayer.weapon);
      // Muzzle flash a freshly-fired gun bullet at the SHOOTER's barrel (nearest player), one per shot.
      if (fx) {
        if (shooter && !flashedShooters.has(shooter)) {
          flashedShooters.add(shooter);
          // §4 v0.107: SELF already flashed at click time (predicted, sendAttack) — don't double-flash
          // when the authoritative projectile lands a round-trip later.
          const isSelf = shooter === room.sessionId;
          const suppressed =
            isSelf && this.time.now - this.lastSelfMuzzleAt < 150;
          const p = room.state.players.get(shooter);
          if (p && !suppressed) {
            const ang = Math.atan2(pr.vy, pr.vx);
            // Flash at the shooter's RENDERED barrel tip (per-gun reach × the holder's rig scale) — the
            // rig, not raw state, so the flash doesn't float off the barrel by the render offset.
            const srig = this.blobs.get(shooter);
            const reach = gunMuzzleReach(
              WEAPONS[p.weapon] ?? WEAPONS[DEFAULT_WEAPON],
            ); // §29 fixed-size weapon
            spawnMuzzleFlash(
              this,
              (srig?.x ?? p.x) + Math.cos(ang) * reach,
              (srig?.y ?? p.y) + Math.sin(ang) * reach,
              ang,
              fx.size,
              fx.color,
              fx.style,
            );
            // §19 a REMOTE shooter's gun sound (self already played its predicted shot at click time —
            // `suppressed` gates this the same way it gates the flash, so self never double-fires).
            this.audio.play(`shot:${baseKind(pr.kind)}`, { x: p.x });
          }
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
          if (er > 0) {
            // §41 ANY exploding projectile erupts (was magma-only — explosive gun rounds got a plain
            // bullet ping). Prefer its observed shooter's live WeaponDef tag; the wire suffix remains the
            // fallback for a projectile first observed too far from its owner.
            const ci = k.indexOf(":");
            const sourceWeapon = WEAPONS[c.getData("sourceWeapon") as string];
            const element =
              sourceWeapon?.tags.element ?? (ci < 0 ? "fire" : k.slice(ci + 1));
            spawnExplosion(this, c.x, c.y, er, element);
          } else if (GUN_FX[bk])
            spawnBulletImpact(
              this,
              c.x,
              c.y,
              k,
              (c.getData("ang") as number) ?? 0,
            ); // pass k → element tint
          else spawnSplat(this, c.x, c.y, k);
        }
        c?.destroy();
        this.projectiles.delete(id);
      }
    }
  }

  /** Dead-reckon each projectile along its velocity, gently corrected toward the server position
   *  (straight-line bullets look crisper extrapolated than lerped between 20Hz snapshots). */
  private moveProjectiles(dtSec: number): void {
    if (!this.room) return;
    this.room.state.projectiles.forEach((pr, id) => {
      const c = this.projectiles.get(id);
      if (!c) return;
      if (this.belt) {
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
        c.setPosition(
          Phaser.Math.Linear(px, pr.x, 0.18),
          Phaser.Math.Linear(py, pr.y, 0.18),
        );
      }
      if (pr.kind === "cleaver") c.rotation += dtSec * 22; // spin the blade
    });
  }

  /** Reconcile rendered zoner puddles (§15 area denial) — a corrosive acid pool on the ground. */
  private syncZones(): void {
    if (!this.room) return;
    const state = this.room.state.zones;
    state.forEach((zone, id) => {
      if (this.zones.has(id)) return;
      const rx = zone.radius;
      const ry = zone.radius * 0.62; // top-down squish
      // §8/§15: UNPARRYABLE zones speak RED/ORANGE danger (never white/neon-friendly). Reads as a
      // poison pool against the dust (§28.7).
      const fill = this.add.ellipse(0, 0, rx * 2, ry * 2, 0x8f2d18, 0.44);
      const inner = this.add.ellipse(
        0,
        0,
        rx * 1.25,
        ry * 1.25,
        0xff5d2e,
        0.32,
      );
      const rim = this.add
        .ellipse(0, 0, rx * 2, ry * 2)
        .setStrokeStyle(4, 0xff7a3a, 0.95);
      const c = this.add
        .container(zone.x, zone.y, [fill, inner, rim])
        .setDepth(1);
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

  /** Build one pulsing gate marker (shared by the extraction portal + the §6 deeper rift). */
  private buildGate(
    x: number,
    y: number,
    ring: number,
    core: number,
    text: string,
    textColor: string,
  ): Phaser.GameObjects.Container {
    const outer = this.add
      .circle(0, 0, EXTRACT_RADIUS, ring, 0.16)
      .setStrokeStyle(3, ring, 0.7);
    const inner = this.add
      .circle(0, 0, EXTRACT_RADIUS * 0.5, core, 0.22)
      .setStrokeStyle(2, core, 0.9);
    const label = this.add
      .text(0, -EXTRACT_RADIUS - 16, text, {
        fontSize: "16px",
        color: textColor,
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    const c = this.add.container(x, y, [outer, inner, label]).setDepth(1);
    this.tweens.add({
      targets: inner,
      scale: 1.35,
      duration: 760,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    });
    return c;
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
        "▼ EXTRACT — bank salvage & end run",
        "#ffd479",
      );
    }
    if (!st.portalOpen && this.portal) {
      this.portal.destroy();
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
      );
    }
    if (!st.riftOpen && this.rift) {
      this.rift.destroy();
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

  /** Boss health bar + approach banner + victory screen (§16). */
  private updateRunState(): void {
    if (!this.room) return;
    // Locate the boss (if any) — §17 ANY dimension's boss (archetype "boss"), not just OLD RUST — and total
    // its max HP from the roster. The nameplate + approach toast read the active dimension's name.
    let boss: { hp: number; kind: string; x: number; y: number } | undefined;
    this.room.state.enemies.forEach((e) => {
      if (ENEMY_KINDS[e.kind]?.archetype === "boss") boss = e;
    });
    const s = this.uiScale();
    const bossMax = boss ? (ENEMY_KINDS[boss.kind]?.hp ?? 420) : 420;
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
        const rs = ENEMY_KINDS[boss.kind]?.renderScale ?? 1;
        const titanic = rs >= 5;
        this.shakeCam(titanic ? 700 : 360, titanic ? 0.02 : 0.011);
        this.cameras.main.flash(
          titanic ? 420 : 240,
          titanic ? 130 : 80,
          titanic ? 32 : 20,
          18,
        );
        this.audio.play("bossslam", { x: boss.x, amt: 1 });
        // §33 teach the colossus's footstep mechanic the moment he looms in — you can't out-DPS a quake.
        if (boss.kind === "world-titan") {
          this.time.delayedCall(900, () =>
            this.flashBanner("⚠ JUMP or PARRY his footsteps", "#ffd24a"),
          );
        }
      }
      this.bossShown = Phaser.Math.Linear(this.bossShown, bossRatio, 0.2);
      this.bossBarBg.setPosition(this.screenW() / 2, 40 * s).setVisible(true);
      const barLeft = this.screenW() / 2 - 258 * s;
      this.bossBarFill.setPosition(barLeft, 48 * s).setVisible(true);
      this.bossBarFill.width = 516 * s * this.bossShown;
      this.bossText
        .setPosition(this.screenW() / 2, 38 * s)
        .setText(
          bossDefName
            ? bossDefName.toUpperCase()
            : `${dimName.toUpperCase()} BOSS`,
        )
        .setVisible(true);
      // §16 v0.116 Polish B — draw a tick at each PHASE threshold so the escalation gates are visible on the
      // bar. The def's phases[i].hpAbove is the HP fraction where phase i+1 begins; skip the final 0-floor.
      const phases = BOSSES[this.room.state.bossKind]?.phases ?? [];
      this.bossBarSegments.setVisible(true).clear();
      for (const ph of phases) {
        if (ph.hpAbove <= 0 || ph.hpAbove >= 1) continue;
        const x = barLeft + 516 * s * ph.hpAbove;
        // A crossed threshold (fill drained past it) dims; an upcoming one glows — reads the fight's progress.
        const passed = this.bossShown <= ph.hpAbove;
        this.bossBarSegments.lineStyle(
          2 * s,
          passed ? 0x6a2a1a : 0x1a0d08,
          passed ? 0.7 : 0.95,
        );
        this.bossBarSegments.lineBetween(x, 42 * s, x, 54 * s);
      }
    } else {
      this.bossShown = -1;
      this.bossBarBg.setVisible(false);
      this.bossBarFill.setVisible(false);
      this.bossBarSegments.setVisible(false);
      this.bossText.setVisible(false);
    }
    // Boss-approach toast on first appearance.
    if (present && !this.prevBossPresent && this.bannerShownFor !== "boss") {
      this.bannerShownFor = "boss";
      this.flashBanner(
        `⚠  THE ${dimName.toUpperCase()} BOSS APPROACHES  ⚠`,
        "#ff5d3b",
      );
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
      // §16 v0.116 Polish B — a distinct end-card for the BOSS RUSH gauntlet vs a normal extraction.
      const bankedNow = this.room.state.bankedSalvage;
      this.victoryText
        .setText(
          this.room.state.mode === "bossrush"
            ? `☠  GAUNTLET CLEARED  ☠\nall 10 bosses down ✦ ${bankedNow} salvage banked\n(Restart Run — top-right)`
            : `EXTRACTED at depth ${this.room.state.depth} ✦ ${bankedNow} salvage banked\n(Restart Run — top-right)`,
        )
        .setPosition(this.screenW() / 2, this.screenH() / 2);
    }
  }

  /** A big transient centered banner that fades (boss approach, etc.). */
  private flashBanner(msg: string, color: string): void {
    // §7 v0.105 de-clunk: STACK banners that land within the fade window instead of overprinting the exact
    // same point (a loot reveal + a depth banner used to render on top of each other, unreadable). Reset the
    // slot once enough time has passed that the previous banner has faded.
    const now = this.time.now;
    this.bannerSlot =
      now - this.lastBannerAt > 2200 ? 0 : (this.bannerSlot + 1) % 4;
    this.lastBannerAt = now;
    const baseY = this.screenH() / 2 - 80 + this.bannerSlot * 40;
    const t = this.add
      .text(this.screenW() / 2, baseY, msg, {
        fontSize: "32px",
        color,
        fontStyle: "bold",
      })
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(100003)
      .setScale(1.25)
      .setAlpha(0);
    // §19 v0.108 A10: a snappy entrance POP (overshoot-in) before the long fade — lifts every transient
    // banner (boss approach, loot reveal, depth) from "appears" to "arrives".
    this.tweens.add({
      targets: t,
      scale: 1,
      alpha: 1,
      duration: 180,
      ease: "Back.easeOut",
      onComplete: () => {
        this.tweens.add({
          targets: t,
          y: baseY - 24,
          alpha: 0,
          duration: 2100,
          ease: "Cubic.easeIn",
          onComplete: () => t.destroy(),
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

  /** Show the owed FLEX pick, then the signature draft; the offer fingerprint owns every rebuild. */
  private updateLevelWindow(): void {
    if (!this.room) return;
    const self = this.room.state.players.get(this.room.sessionId);
    const flex = !!self && self.flexPending > 0;
    const sig = !!self && self.sigPending > 0 && !flex; // the augment pick follows the stat pick
    const open = flex || sig;
    const key =
      open && self
        ? `${self.level}:${flex ? "F" : "S"}:${self.flexPending}:${self.sigPending}:${self.sigOffer}`
        : "";
    if (key !== this.levelWinKey) {
      this.levelWinKey = key;
      this.clearLevelPaperCounters();
      this.levelWinSelectionSent = false;
      for (const o of this.levelWinObjects) o.destroy();
      this.levelWinObjects = [];
      this.levelWinTimerBar = undefined;
      if (self && flex) this.buildLevelWindow(self);
      else if (self && sig) this.buildAugmentWindow(self);
    }
    if (open && self && this.levelWinTimerBar) {
      this.levelWinTimerBar.width =
        380 *
        Math.max(
          0,
          Math.min(1, self.flexTimerDs / 10 / LEVELUP_WINDOW_SECONDS),
        );
    }
  }

  /** The five attributes (§11) — name, effect, accent colour (§28.2). */
  private static readonly ATTR_INFO: Record<
    string,
    { name: string; desc: string; color: number }
  > = {
    str: { name: "STR", desc: "+ melee damage", color: 0xff8a2b },
    dex: { name: "DEX", desc: "+ ranged dmg & crit", color: 0x6fd6ff },
    int: { name: "INT", desc: "+ spell / signature power", color: 0xb07bd6 },
    con: { name: "CON", desc: "+ max HP & regen", color: 0x9cff3b },
    luk: { name: "LUK", desc: "+ rarity, crit & harvest", color: 0xffd479 },
  };

  /** §8 augment flavor-tag → accent colour (riposte STR-orange · aegis CON-green · hex INT-purple). */
  private static readonly AUG_TAG_COL: Record<string, number> = {
    riposte: 0xff8a2b,
    aegis: 0x9cff3b,
    hex: 0xb07bd6,
  };

  /** The shared dim overlay + title + subtitle + countdown bar for either level-window mode. */
  private buildLevelShell(
    self: PlayerState,
    sub: string,
  ): { cx: number; cy: number } {
    const cx = this.screenW() / 2;
    const cy = this.screenH() / 2;
    const dim = this.add
      .rectangle(cx, cy, this.screenW(), this.screenH(), 0x05040a, 0.66)
      .setScrollFactor(0)
      .setDepth(100010)
      .setInteractive();
    // §37 a framed backdrop panel (Clean Minimal) behind the title + cards, so the level-up window carries the
    // same border identity as the bag/shop. Sits above the dim, below the interactive cards.
    const pw = Math.min(this.screenW() - 60, 780);
    const ph = 400;
    const pgx = cx - pw / 2;
    const pgy = cy - 208;
    const pg = this.add.graphics().setScrollFactor(0).setDepth(100010.5);
    pg.fillStyle(0x0a0812, 0.92).fillRoundedRect(pgx, pgy, pw, ph, 14);
    this.drawPanelFrame(pg, pgx, pgy, pw, ph, 1);
    const title = this.add
      .text(cx, cy - 170, `LEVEL ${self.level}`, {
        fontSize: "30px",
        color: "#ffd479",
        fontStyle: "bold",
      })
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(100011);
    const subT = this.add
      .text(cx, cy - 138, sub, { fontSize: "15px", color: "#cfc8b6" })
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(100011);
    const barBg = this.add
      .rectangle(cx, cy - 112, 380, 6, 0x2a2620)
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(100011);
    this.levelWinTimerBar = this.add
      .rectangle(cx - 190, cy - 112, 380, 6, 0xffd479)
      .setScrollFactor(0)
      .setOrigin(0, 0.5)
      .setDepth(100012);
    const lowerHingeY = cy + 192;
    pg.setPosition(-cx, -lowerHingeY);
    const lower = this.add
      .container(cx, lowerHingeY, [pg])
      .setScrollFactor(0)
      .setDepth(100010.5);
    const seamY = cy - 16;
    const upperG = this.add.graphics();
    upperG
      .fillStyle(0x0a0812, 0.96)
      .fillRoundedRect(pgx, pgy, pw, seamY - pgy, 14);
    this.drawPanelFrame(upperG, pgx, pgy, pw, seamY - pgy, 1);
    upperG.setPosition(-cx, -seamY);
    const upper = this.add
      .container(cx, seamY, [upperG])
      .setScrollFactor(0)
      .setDepth(100010.4);
    this.animateLevelFolio(dim, lower, upper);
    this.levelWinObjects.push(
      dim,
      lower,
      upper,
      title,
      subT,
      barBg,
      this.levelWinTimerBar,
    );
    return { cx, cy };
  }

  /** Choice copy and the fixed Zone stay face-on; only the cardstock backing turns through the plane. */
  private prepareLevelCard(
    root: Phaser.GameObjects.Container,
    face: Phaser.GameObjects.Rectangle,
    zone: Phaser.GameObjects.Rectangle, // §50 scene-level hit rect (was a Zone-in-container — see P0 fix)
    index: number,
    side: number,
    send: () => void,
  ): void {
    const restY = root.y;
    root.setData("levelChoiceZone", zone);
    if (!prefersReducedPaperMotion()) {
      face.setScale(-0.06, 0.94).setRotation(side * 0.035);
      this.tweens.add({
        targets: face,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        duration: 180,
        delay: index * 42,
        ease: "Back.easeOut",
      });
    }
    zone.on("pointerover", () => {
      this.tweens.killTweensOf([root, face]);
      this.tweens.add({ targets: root, y: restY - 4, duration: 80 });
      this.tweens.add({
        targets: face,
        scaleX: 0.965,
        rotation: side * 0.04,
        duration: 80,
      });
    });
    zone.on("pointerout", () => {
      this.tweens.killTweensOf([root, face]);
      this.tweens.add({
        targets: root,
        y: restY,
        duration: 110,
        ease: "Sine.easeOut",
      });
      this.tweens.add({
        targets: face,
        scaleX: 1,
        rotation: 0,
        duration: 110,
        ease: "Sine.easeOut",
      });
    });
    zone.on("pointerdown", () => {
      if (this.levelWinSelectionSent) return;
      this.levelWinSelectionSent = true;
      for (const obj of this.levelWinObjects) {
        if (!(obj instanceof Phaser.GameObjects.Container)) continue;
        const choiceZone = obj.getData("levelChoiceZone") as
          Phaser.GameObjects.Zone | undefined;
        choiceZone?.disableInteractive();
      }
      send(); // immediate; the authoritative offer edge owns the actual close
    });
  }

  /** §8 build the dim overlay + 3 augment cards for the signature draft (every 5th level). */
  private buildAugmentWindow(self: PlayerState): void {
    const { cx, cy } = this.buildLevelShell(
      self,
      "SIGNATURE — pick a parry augment (§8)",
    );
    const offer = self.sigOffer.split(",").filter(Boolean);
    const W = 196;
    const H = 214;
    const gap = 22;
    const startX = cx - (offer.length * (W + gap) - gap) / 2 + W / 2;
    offer.forEach((id, i) => {
      const def = AUGMENTS[id];
      if (!def) return;
      const col = ArenaScene.AUG_TAG_COL[def.tag] ?? 0xb9975b;
      const x = startX + i * (W + gap);
      const card = this.add
        .rectangle(x, cy + 30, W, H, 0x1b1812, 0.98)
        .setScrollFactor(0)
        .setStrokeStyle(3, col)
        .setDepth(100011)
        .setInteractive({ useHandCursor: true });
      const icon = this.add.graphics().setScrollFactor(0).setDepth(100012);
      drawIcon(icon, def.icon, x, cy - 46, 13, col);
      const name = this.add
        .text(x, cy - 8, def.name, {
          fontSize: "20px",
          color: "#f0ead8",
          fontStyle: "bold",
        })
        .setScrollFactor(0)
        .setOrigin(0.5)
        .setDepth(100012);
      const tag = this.add
        .text(x, cy + 16, def.tag.toUpperCase(), {
          fontSize: "12px",
          color: `#${col.toString(16).padStart(6, "0")}`,
          fontStyle: "bold",
        })
        .setScrollFactor(0)
        .setOrigin(0.5)
        .setDepth(100012);
      const desc = this.add
        .text(x, cy + 58, def.desc, {
          fontSize: "13px",
          color: "#cfc8b6",
          align: "center",
          wordWrap: { width: W - 26 },
        })
        .setScrollFactor(0)
        .setOrigin(0.5)
        .setDepth(100012);
      card.disableInteractive().setPosition(0, 0);
      icon.setPosition(-x, -(cy + 30));
      name.setPosition(0, -38);
      tag.setPosition(0, -14);
      desc.setPosition(0, 28);
      // §50 P0 FIX: a Zone INSIDE a scrollFactor(0) container hit-tests in WORLD space while the card
      // renders in SCREEN space — clicks only landed when the camera sat at the origin (the menu), never
      // mid-run. Screen-space UI input must live at SCENE level: an invisible scrollFactor(0) rect at the
      // card's fixed screen position carries the input and drives the container's fold/hover animation.
      const zone = this.add
        .rectangle(x, cy + 30, W, H, 0xffffff, 0.001)
        .setScrollFactor(0)
        .setDepth(100013)
        .setInteractive({ useHandCursor: true });
      const root = this.add
        .container(x, cy + 30, [card, icon, name, tag, desc])
        .setScrollFactor(0)
        .setDepth(100011);
      this.prepareLevelCard(root, card, zone, i, x < cx ? -1 : 1, () =>
        this.room?.send("chooseAugment", { id }),
      );
      this.levelWinObjects.push(root, zone);
    });
  }

  /** Build the dim overlay + 5 attribute buttons for the §12 flex-point pick. */
  private buildLevelWindow(self: PlayerState): void {
    const { cx, cy } = this.buildLevelShell(
      self,
      "+1 STR  +1 CON (auto) · spend your FLEX point",
    );
    const attrs: Attr[] = ["str", "dex", "int", "con", "luk"];
    const W = 150;
    const H = 200;
    const gap = 16;
    const startX = cx - (attrs.length * (W + gap) - gap) / 2 + W / 2;
    attrs.forEach((attr, i) => {
      const info = ArenaScene.ATTR_INFO[attr];
      if (!info) return;
      const cur = self[attr]; // PlayerState[Attr] → number (no cast needed)
      const x = startX + i * (W + gap);
      const card = this.add
        .rectangle(x, cy + 30, W, H, 0x1b1812, 0.98)
        .setScrollFactor(0)
        .setStrokeStyle(3, info.color)
        .setDepth(100011)
        .setInteractive({ useHandCursor: true });
      const name = this.add
        .text(x, cy - 34, info.name, {
          fontSize: "26px",
          color: "#f0ead8",
          fontStyle: "bold",
        })
        .setScrollFactor(0)
        .setOrigin(0.5)
        .setDepth(100012);
      const val = this.add
        .text(x, cy + 4, `${cur} → ${cur + 1}`, {
          fontSize: "16px",
          color: `#${info.color.toString(16).padStart(6, "0")}`,
          fontStyle: "bold",
        })
        .setScrollFactor(0)
        .setOrigin(0.5)
        .setDepth(100012);
      const desc = this.add
        .text(x, cy + 48, info.desc, {
          fontSize: "13px",
          color: "#cfc8b6",
          align: "center",
          wordWrap: { width: W - 22 },
        })
        .setScrollFactor(0)
        .setOrigin(0.5)
        .setDepth(100012);
      card.disableInteractive().setPosition(0, 0);
      name.setPosition(0, -64);
      val.setPosition(0, -26);
      desc.setPosition(0, 18);
      // §50 P0 FIX: scene-level hit rect (see buildAugmentWindow) — zone-in-scrollFactor(0)-container
      // hit-tests in world space and never matched the screen-space card once the camera scrolled.
      const zone = this.add
        .rectangle(x, cy + 30, W, H, 0xffffff, 0.001)
        .setScrollFactor(0)
        .setDepth(100013)
        .setInteractive({ useHandCursor: true });
      const root = this.add
        .container(x, cy + 30, [card, name, val, desc])
        .setScrollFactor(0)
        .setDepth(100011);
      this.prepareLevelCard(root, card, zone, i, x < cx ? -1 : 1, () =>
        this.room?.send("chooseAttribute", { attr }),
      );
      this.levelWinObjects.push(root, zone);
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
    { id: "old-rust", label: "OLD RUST (boss)" },
  ];

  /** Tear down the summon overlay. */
  private closeSummonMenu(): void {
    for (const o of this.summonObjects) o.destroy();
    this.summonObjects = [];
    this.summonOpen = false;
  }

  /** Open (or rebuild) the dev summon menu: a multiplier row + a Tough toggle + one button per kind.
   *  Clicking a kind sends `debugSpawn` and leaves the menu up so you can keep conjuring. */
  private openSummonMenu(): void {
    this.closeSummonMenu();
    this.summonOpen = true;
    const cx = this.screenW() / 2;
    const cy = this.screenH() / 2;
    const dim = this.add
      .rectangle(cx, cy, this.screenW(), this.screenH(), 0x05040a, 0.55)
      .setScrollFactor(0)
      .setDepth(100020)
      .setInteractive();
    const title = this.add
      .text(cx, cy - 196, "SUMMON — Testing Grounds", {
        fontSize: "26px",
        color: "#33e6ff",
        fontStyle: "bold",
      })
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(100021);
    const hint = this.add
      .text(cx, cy - 166, "click a monster to spawn · Tab to close", {
        fontSize: "13px",
        color: "#cfc8b6",
      })
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(100021);
    this.summonObjects.push(dim, title, hint);

    // Multiplier row (×1 … ×DEBUG_SPAWN_MAX) + a Tough toggle on the right.
    const mults = [1, 5, 10, DEBUG_SPAWN_MAX].filter(
      (n, i, a) => a.indexOf(n) === i,
    );
    const chipW = 58;
    const chipGap = 10;
    const rowW = mults.length * (chipW + chipGap) - chipGap;
    const mStartX = cx - rowW / 2 + chipW / 2 - 70;
    const my = cy - 122;
    const mLabel = this.add
      .text(mStartX - chipW / 2 - 14, my, "×", {
        fontSize: "18px",
        color: "#9a9486",
      })
      .setScrollFactor(0)
      .setOrigin(1, 0.5)
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
    // Tough toggle.
    const tx = mStartX + mults.length * (chipW + chipGap) + 40;
    const tough = this.add
      .rectangle(tx, my, 96, 30, this.summonTough ? 0x6b4a1f : 0x1b1812, 0.98)
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

    // Monster buttons — a centered grid (4 per row).
    const kinds = ArenaScene.SUMMON_KINDS;
    const W = 196;
    const H = 52;
    const gap = 14;
    const perRow = 4;
    kinds.forEach((k, i) => {
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      const rowCount = Math.min(perRow, kinds.length - row * perRow);
      const rowWidth = rowCount * (W + gap) - gap;
      const x = cx - rowWidth / 2 + W / 2 + col * (W + gap);
      const y = cy - 56 + row * (H + gap);
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

    // §16 v0.109 BOSS PICKER row — spawn any bespoke boss def to playtest its style (host-gated server-side).
    const gridRows = Math.ceil(kinds.length / perRow);
    const bossRowY = cy - 56 + gridRows * (H + gap) + 18;
    const bossLabel = this.add
      .text(
        cx,
        bossRowY - 4,
        "BOSS PICKER — click to summon (swaps any live boss)",
        {
          fontSize: "13px",
          color: "#ffb24a",
          fontStyle: "bold",
        },
      )
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(100022);
    this.summonObjects.push(bossLabel);
    const bossIds = BOSS_DEF_IDS;
    const BW = 208;
    bossIds.forEach((id, i) => {
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      const rowCount = Math.min(perRow, bossIds.length - row * perRow);
      const rowWidth = rowCount * (BW + gap) - gap;
      const x = cx - rowWidth / 2 + BW / 2 + col * (BW + gap);
      const y = bossRowY + 24 + row * (H + gap);
      const btn = this.add
        .rectangle(x, y, BW, H, 0x241a10, 0.98)
        .setScrollFactor(0)
        .setStrokeStyle(2, 0xffb24a)
        .setDepth(100021)
        .setInteractive({ useHandCursor: true });
      const t = this.add
        .text(x, y, BOSSES[id]?.name ?? id, {
          fontSize: "13px",
          color: "#ffe0b0",
          align: "center",
          wordWrap: { width: BW - 16 },
        })
        .setScrollFactor(0)
        .setOrigin(0.5)
        .setDepth(100022);
      btn.on("pointerover", () => btn.setFillStyle(0x352513, 1));
      btn.on("pointerout", () => btn.setFillStyle(0x241a10, 0.98));
      btn.on("pointerdown", () =>
        this.room?.send("spawnBossDef", { kind: id }),
      );
      this.summonObjects.push(btn, t);
    });
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
      // §7 character swap (C key) — rebuild the rig with the new skin (re-equips next frame).
      else if (this.charOf.get(id) !== player.character) {
        this.removeBlob(id);
        this.addBlob(player, id);
      }
    });
    for (const id of this.blobs.keys()) {
      if (!players.has(id)) this.removeBlob(id);
    }
  }

  private interpolate(deltaMs: number): void {
    if (!this.room) return;
    // §4 v0.107: SELF renders the PREDICTOR (instant response — no lerp, no round-trip); REMOTES render
    // their snapshot rings at the delayed server-tick timeline (faithful motion under jitter — no
    // τ-trailing, no rubber-banding). Teleport cuts live inside both paths (predictor hard-resync on
    // teleportSeq / ring gap-snap + fellSeq reset). Fallback = raw state (pre-timeline first frames).
    const selfId = this.room.sessionId;
    const rt = this.timeline.ready
      ? this.timeline.renderTime(this.time.now)
      : -1;
    this.room.state.players.forEach((player, id) => {
      const blob = this.blobs.get(id);
      if (!blob) return;
      if (id === selfId && this.predictor) {
        this.predictor.decayError(deltaMs / 1000);
        const r = this.predictor.renderPos(
          this.curDx,
          this.curDy,
          this.inputAccMs / 1000,
        );
        blob.setPosition(r.x, r.y);
        this.selfPredHeight = r.height;
        return;
      }
      const s =
        rt >= 0
          ? this.playerBufs
              .get(id)
              ?.sampleInto(rt, INTERP_SNAP_PLAYER, this.playerSample)
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
    const dim = (this.beltLevel ?? beltLevelFor(this.selectedBeltLevel))
      .dimensionId;
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
      this.beltBackdrop = this.add
        .image(0, 0, "belt-sky")
        .setOrigin(0, 0)
        .setDepth(-200);
      this.floorObjs.push(this.beltBackdrop);
      // §29 parallax cloud band drifting across the upper sky (procedural, transparent → no art dependency).
      this.ensureCloudTexture();
      this.beltClouds = this.add
        .tileSprite(0, 0, 1, 1, "belt-clouds")
        .setOrigin(0, 0)
        .setDepth(-190)
        .setAlpha(0.32);
      this.floorObjs.push(this.beltClouds);
    } else if (
      !skyCarrier &&
      this.textures.exists(`belt-bg:${this.selectedBeltLevel}`)
    ) {
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
      for (let i = near.length - 1; i >= 0; i--)
        gg.lineTo(near[i]!.x, near[i]!.y);
      gg.closePath();
    };
    // §36 the deck is "the ground" — it must sit BELOW ground-level VFX (quake eruptions depth 4-8, splats,
    // zones) and entities (depth = projected worldY, ~2000+), exactly like the top-down floor (groundBed -20).
    // At the old +60 it occluded every low-depth ground VFX in belt (they render "under the map"). Above the
    // sky backdrop (-200) / clouds (-190), below everything on the deck.
    const g = this.add.graphics().setDepth(-20);
    // dark hull/void below the whole thing
    g.fillStyle(0x22262c, 1).fillRect(
      0,
      this.beltY(BELT_Y0 + DEPTH_MAX) - 40,
      w,
      3000,
    );
    // Walkable deck BASE fill — a crisp, collision-accurate trapezoid following the exact floor profile.
    // Stays under the plating bake as the fallback (and covers any hairline the clip might miss).
    g.fillStyle(theme.deck, 1); // §36 dimension-themed deck fill
    deckPoly(g);
    g.fillPath();
    this.floorObjs.push(g);
    // §37 CODEX PLATING: paint the level's authored deck texture INSIDE the trapezoid via a one-time canvas
    // bake (canvas 2D clip + repeating pattern), sidestepping the old Phaser-4 GeometryMask2-on-TileSprite
    // blocker entirely. Sky-carrier uses its original deck.png; themed levels their deck-<id>.png strips.
    const deckKey = skyCarrier
      ? "belt-deck"
      : `belt-deck:${this.selectedBeltLevel}`;
    // §37 the canvas bake uploads big textures — on a low-VRAM GPU that can throw. NEVER let it abort the
    // floor build (that blacked out themed levels); on any failure fall back to the procedural vector deck.
    let plated = false;
    try {
      plated =
        this.textures.exists(deckKey) &&
        this.bakeDeckPlating(deckKey, far, near, w);
    } catch (e) {
      console.warn(
        "[belt] deck plating bake failed — using the vector deck",
        e,
      );
      plated = false;
    }
    // Gameplay markings + telegraphs live ABOVE the plating (its own layer at -18).
    const gl = this.add.graphics().setDepth(-18);
    // centreline marking (mid-depth) + railings on both edges (the collision boundary, drawn)
    gl.lineStyle(6, 0xffd24a, 0.55).beginPath();
    for (let i = 0; i < far.length; i++)
      gl.lineTo(far[i]!.x, (far[i]!.y + near[i]!.y) / 2);
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
      const deckYAt = (i: number, f: number) =>
        far[i]!.y + (near[i]!.y - far[i]!.y) * f;
      gl.lineStyle(2, 0x363c45, 0.55); // subtle darker seam
      for (const f of [0.22, 0.44, 0.66, 0.86]) {
        gl.beginPath();
        gl.moveTo(far[0]!.x, deckYAt(0, f));
        for (let i = 1; i < far.length; i++)
          gl.lineTo(far[i]!.x, deckYAt(i, f));
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
      gl.fillStyle(0x0c1017, 1).fillRect(
        pit.x0,
        top - 4,
        pit.x1 - pit.x0,
        bot - top + 12,
      ); // void
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
    const src = this.textures.get(key).getSourceImage() as
      HTMLImageElement | HTMLCanvasElement;
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
      for (let i = i0; i <= i1; i++)
        ctx.lineTo(far[i]!.x - cx, far[i]!.y - top);
      for (let i = i1; i >= i0; i--)
        ctx.lineTo(near[i]!.x - cx, near[i]!.y - top);
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
      this.floorObjs.push(
        this.add.image(cx, top, texKey).setOrigin(0, 0).setDepth(-19),
      );
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
    const projectLive = (o: {
      x: number;
      y: number;
      setPosition(x: number, y: number): void;
    }) => {
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
        lastScreen !== undefined && c.y === lastScreen
          ? (c.getData("beltWorldY") as number)
          : c.y;
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
    this.blobs.forEach((rig) => projectLive(rig));
    this.enemies.forEach((rig) => projectLive(rig)); // includes the boss rig
    this.projectiles.forEach((c) => projectTracked(c));
    this.pickups.forEach((c) => projectTracked(c));
    this.zones.forEach((c) => projectTracked(c));
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
    const rightLimit =
      lock > 0 ? lock : (this.beltLevel?.length ?? ARENA_WIDTH);
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
      this.beltClouds
        .setPosition(this.camFocus.x, BELT_Y0 - BELT_SKY)
        .setSize(viewW, bandH);
      this.beltClouds.tilePositionX =
        this.camFocus.x * 0.35 + this.beltCloudDrift;
    }
    this.drawBeltGate(lock);
    // §29 room banner on entering a new room + swap to the storm BRIDGE backdrop for the boss room.
    const roomName = this.room?.state.beltRoomName ?? "";
    if (roomName && roomName !== this.lastBeltRoom)
      this.flashBanner(`▶  ${roomName.toUpperCase()}`, "#ffd24a");
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
    if (!this.beltGate)
      this.beltGate = this.add.graphics().setDepth(BELT_Y0 + DEPTH_MAX + 50);
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
    this.centerCam(this.camFocus.x, this.camFocus.y);
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
      view >= world
        ? (world - view) / 2
        : Math.max(0, Math.min(world - view, target));
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
    const invDt = deltaMs > 0 ? 1000 / deltaMs : 0; // px/frame → px/s for the §5 gait blend

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
      blob.setHop(isSelfPred ? this.selfPredHeight : (pl?.height ?? 0));

      // §6 DOWNED look + revive pop. A downed body greys out + fades; a rez (revivedSeq tick) pops it green.
      const alive = pl?.alive ?? true;
      blob.setDowned(!alive);
      const rs = pl?.revivedSeq ?? 0;
      if (this.lastRevived.get(id) !== rs) {
        if (this.lastRevived.has(id) && alive) {
          blob.flash(170, 0x9cff3b);
          this.audio.play("revive", { x: blob.x }); // §19 a warm rising 2-note chord = life
        }
        this.lastRevived.set(id, rs);
      }

      const isSelf = id === selfId;
      const anim = this.playerAnimInput;
      anim.moveX = mx;
      anim.moveY = my;
      anim.speed = speed;
      anim.aimX = isSelf ? aimX : 0;
      anim.aimY = isSelf ? aimY : 0;
      anim.aimDxPx = isSelf ? aimDxPx : undefined; // §37 raw offset → the flip commits at the midpoint
      anim.aimDir = pl?.aimDir ?? 0; // §9 remote gun pose tracks the synced aim
      anim.isSelf = isSelf;
      anim.recoilX = pl?.vx ?? 0; // §20 momentum flinch (gun recoil / hit knockback)
      anim.recoilY = pl?.vy ?? 0;
      blob.animate(this.animClock, anim);
      blob.setDepth(blob.y);
    }
  }

  /** RMB held → fire the equipped weapon toward the cursor (§9). Server gates damage by cooldown;
   *  the client mirrors the cooldown locally to fire the swing animation in sync (cosmetic). */
  private sendAttack(): void {
    if (!this.room) return;
    this.localAtkCd = Math.max(0, this.localAtkCd - this.deltaSec);
    const selfId = this.room.sessionId;
    const self = this.room.state.players.get(selfId);
    if (!self?.alive || self.flexPending > 0) return;
    if (!this.input.activePointer.rightButtonDown() || this.localAtkCd > 0)
      return;
    const weapon = WEAPONS[self.weapon] ?? WEAPONS[DEFAULT_WEAPON];
    // Thrown weapons + guns need ammo — don't animate/fire when empty/reloading (server gates it too).
    if ((weapon?.thrown || weapon?.gun) && self.charges <= 0) return;
    // §10 v0.104 de-clunk: fold in the held weapon's affix cooldown multiplier — the SERVER gates fire on
    // `cooldown × lootCooldownMult`, so if the client's send cadence ignores it, a Heavy/slow weapon sends
    // faster than the server accepts (half the swings become ghosts) and a Swift/fast one can never send at
    // its real rate. Matching it here makes the local swing cadence WYSIWYG with the damage the server deals.
    const cdMul = lootCooldownMult(self.weaponAffix);
    this.localAtkCd =
      (weapon?.gun?.fireRate ?? weapon?.cooldown ?? 0.3) * cdMul;
    // §44 one PREDICTED descriptor/epoch for every local swing consumer. The server constructs the identical
    // effective-cooldown descriptor only on acceptance; buffering/network delay remains until swing-seq sync.
    const swing = weapon
      ? swingDescriptorFor(weapon, weapon.cooldown * cdMul)
      : undefined;
    const rig = this.blobs.get(selfId);
    // §20 WYSIWYG: freeze the aim at swing-start so the blade sweeps the SAME arc the server's swept hitbox
    // uses. Guns don't melee-swing — the shot is the muzzle flash.
    if (!weapon?.gun && swing)
      rig?.triggerSwing(
        this.time.now,
        Math.atan2(this.selfAim.y, this.selfAim.x),
        swing,
      );
    // Cursor world position (for slam-at-cursor weapons).
    const cam = this.cameras.main;
    const px = this.pointerScreen.set
      ? this.pointerScreen.x
      : this.input.activePointer.x;
    const py = this.pointerScreen.set
      ? this.pointerScreen.y
      : this.input.activePointer.y;
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
      this.time.delayedCall(swing.impactSeconds * 1000, () => {
        if (!this.room) return;
        spawnQuake(
          this,
          ep.x,
          this.belt ? this.beltY(ep.y) : ep.y,
          quake,
          weapon,
          this.belt ? BELT_FORESHORTEN : 1,
        );
        // §7 v0.105 de-clunk: only freeze if the quake actually CONNECTED (an enemy inside the AoE) — a
        // real impact is a skill beat → priority (bypasses the freeze budget).
        const qr = quake.radius;
        let connected = false;
        this.room.state.enemies.forEach((en) => {
          if (!connected && (en.x - ep.x) ** 2 + (en.y - ep.y) ** 2 <= qr * qr)
            connected = true;
        });
        if (connected) this.hitStop(130, true);
      });
    } else if (weapon?.gun) {
      // Gun recoil — a per-gun camera kick (heavy slug THUMPS, gatling barely buzzes). The shake duration
      // is capped to the fire-rate so a fast auto's kicks decay before the next shot (no jitter stacking).
      this.shakeCam(
        Math.min(70, weapon.gun.fireRate * 700),
        weapon.gun.recoil ?? 0.0017,
      );
      // §4 v0.107 PREDICTED muzzle flash: fire feedback on the CLICK at the rendered barrel (the old
      // path waited a full round-trip for the synced projectile — ~60-125ms of "did it fire?" online).
      // The authoritative bullet still renders from state; syncProjectiles suppresses its duplicate
      // flash for self for a beat. Cosmetic only — damage is server-side.
      if (rig) {
        const ang = Math.atan2(this.selfAim.y, this.selfAim.x);
        const reach = gunMuzzleReach(weapon); // §29 fixed-size weapon → fixed muzzle reach
        // §35 tint the predicted muzzle flash to the weapon's element too (matches the bullet).
        const el = weapon.tags?.element;
        const fx = gunFx(
          el && el !== "physical"
            ? `${weapon.gun.bulletKind}:${el}`
            : weapon.gun.bulletKind,
        );
        spawnMuzzleFlash(
          this,
          rig.x + Math.cos(ang) * reach,
          rig.y + Math.sin(ang) * reach,
          ang,
          fx.size,
          fx.color,
          fx.style,
        );
        this.audio.play(`shot:${weapon.gun.bulletKind}`, { x: rig.x }); // §19 predicted shot sound
        this.lastSelfMuzzleAt = this.time.now;
      }
    } else if (weapon?.cast) {
      // §38 predicted CAST feedback: a small arcane flash at the staff tip on the click (the real piercing
      // orb renders from state a round-trip later). Tinted to the weapon's element — no gunpowder look.
      if (rig) {
        const ang = Math.atan2(this.selfAim.y, this.selfAim.x);
        const reach = gunMuzzleReach(weapon);
        const el = weapon.tags?.element;
        const fx = gunFx(el && el !== "physical" ? `orb:${el}` : "orb");
        spawnMuzzleFlash(
          this,
          rig.x + Math.cos(ang) * reach,
          rig.y + Math.sin(ang) * reach,
          ang,
          fx.size,
          fx.color,
          fx.style,
        );
        this.lastSelfMuzzleAt = this.time.now;
      }
    } else if (weapon && !weapon.thrown && swing) {
      // Plain melee swing → the weapon's authored swing VFX (§14). If the weapon is authored "spawn at
      // cursor" (Weaponsmith), the VFX erupts at the clamped cursor (greatsword-quake style) instead.
      const rx = rig?.x ?? self.x;
      const ry = rig?.y ?? self.y;
      if (this.vfxPlayer.spawnsAtCursor(weapon.id)) {
        // §37 clamp in WORLD space (selfWy, not the projected rig y — mixed spaces skewed the radius), then
        // belt-project the epicenter for the draw so the eruption sits ON the cursor, not below it.
        const ep = clampQuakeEpicenter(
          { x: rx, y: selfWy },
          { x: cwx, y: cwy },
          QUAKE_REACH,
        );
        this.spawnSlash(
          ep.x,
          this.belt ? this.beltY(ep.y) : ep.y,
          this.selfAim,
          weapon,
          swing,
          true,
        );
      } else {
        this.spawnSlash(rx, ry, this.selfAim, weapon, swing);
      }
      // Chain-lightning on-hit proc (§10) — teal bolt leaps to the nearest enemies (server owns the damage).
      if (weapon.chainLightning) this.spawnChain(rx, ry, this.selfAim, weapon);
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
    this.room.send("attack", { aimX: saX, aimY: saY, tx: cwx, ty: cwy });
  }

  /** LMB → the melee Parry signature (§7/§8). Server grants i-frames + knockback. NO VFX yet — the
   *  parry reads purely as a BLOCK/BRACE stance (weapon raised, hands guarding, slight crouch) until
   *  level-up augments add on-parry effects. Mirrors the server cooldown so the brace fires in sync. */
  private sendParry(): void {
    if (!this.room) return;
    this.localParryCd = Math.max(0, this.localParryCd - this.deltaSec);
    const selfId = this.room.sessionId;
    const self = this.room.state.players.get(selfId);
    if (!self?.alive || self.flexPending > 0 || self.sigPending > 0) return;
    if (!this.input.activePointer.leftButtonDown() || this.localParryCd > 0)
      return;
    this.localParryCd = PARRY_COOLDOWN;
    this.lastParryPress = this.time.now; // H10: open the i-frame-window flash on the parry ring
    this.room.send("parry");
    const rig = this.blobs.get(selfId);
    rig?.triggerBrace(this.animClock);
    // §8 local-player parry-augment VFX (server owns the damage; this reads the owned set + live aim).
    if (rig && self.augments) this.spawnParryFx(rig.x, rig.y, self.augments);
  }

  /** §13 v0.106 (A11) grab highlight: a pulsing amber ring on the nearest reachable pickup — the one an R
   *  tap will GRAB — so the swap is a deliberate choice, not a blind one. Hidden when nothing's in reach. */
  private renderGrabHighlight(): void {
    const g = this.grabGfx;
    g.clear();
    const t = this.grabTarget;
    if (!t) return;
    const pulse = 0.5 + 0.5 * Math.sin(this.time.now * 0.008);
    g.lineStyle(2.5 + pulse, 0xffd479, 0.55 + 0.35 * pulse);
    g.strokeCircle(t.x, t.y, PICKUP_RADIUS * (0.7 + 0.06 * pulse));
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
    if (!self?.alive || !rig || self.flexPending > 0 || self.sigPending > 0)
      return; // hide mid-pick
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
      if (pr.kind !== "spit") return; // friendly gun/cleaver/magma/counter shots aren't a threat to parry
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

  /** One edge-of-screen locator chevron: pinned to the viewport edge along the bearing to (tx,ty), with
   *  a distance readout. Created lazily into `slot`, hidden when the target is on-screen/absent. */
  private updateEdgeArrow(
    slot: "portalArrow" | "riftArrow",
    open: boolean,
    tx: number,
    ty: number,
    color: number,
    colorCss: string,
    word: string,
  ): void {
    const selfId = this.room?.sessionId;
    const self = selfId ? this.room?.state.players.get(selfId) : undefined;
    const cam = this.cameras.main;
    const onScreen =
      open &&
      tx > cam.worldView.x &&
      tx < cam.worldView.right &&
      ty > cam.worldView.y &&
      ty < cam.worldView.bottom;
    if (!open || onScreen || !self?.alive) {
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
      this[slot] = this.add
        .container(0, 0, [tri, label])
        .setDepth(99997)
        .setScrollFactor(0);
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
    const t = Math.min(
      Math.abs((dx >= 0 ? w - pad - cx : pad - cx) / (Math.cos(ang) || 1e-6)),
      Math.abs((dy >= 0 ? h - pad - cy : pad - cy) / (Math.sin(ang) || 1e-6)),
    );
    arrow
      .setVisible(true)
      .setPosition(cx + Math.cos(ang) * t, cy + Math.sin(ang) * t);
    (arrow.list[0] as Phaser.GameObjects.Triangle).setRotation(
      ang + Math.PI / 2,
    );
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
    );
    this.updateEdgeArrow(
      "riftArrow",
      st.riftOpen,
      st.riftX,
      st.riftY,
      0xb478ff,
      "#b478ff",
      "rift",
    );
  }

  /** §8 cosmetic on-parry VFX for the augments that read at the parrier: Bulwark's absorb ring + Emberguard's
   *  fire-wave cone (toward the live cursor aim). Counterblade's blades + the damage are server-spawned. */
  private spawnParryFx(x: number, y: number, owned: string): void {
    if (hasAugment(owned, "bulwark")) {
      const ring = this.add
        .circle(x, y, 30)
        .setStrokeStyle(4, 0x6fe6ff, 0.9)
        .setDepth(99996);
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
        .ellipse(
          x,
          y,
          EMBERGUARD_RANGE,
          EMBERGUARD_RANGE * 0.55,
          0xff5a1e,
          0.18,
        )
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
        const ember = this.add
          .circle(x, y, 7, 0xff7a2a, 0.9)
          .setBlendMode(ADD)
          .setDepth(99995);
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
  private hitStop(ms: number, priority = false): void {
    const now = this.time.now;
    if (!priority) {
      // Refill the bucket at BUDGET/WINDOW per ms since the last spend, then reject if this freeze would
      // overflow it. (Priority freezes bypass the bucket AND don't deplete it — the skill beats are sacred.)
      const refill =
        ((now - this.freezeSpentAt) * ArenaScene.FREEZE_BUDGET_MS) /
        ArenaScene.FREEZE_WINDOW_MS;
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
  shakeCam(duration: number, intensity: number): void {
    const now = this.time.now;
    if (now >= this.shakeUntil || intensity >= this.shakeIntensity) {
      this.cameras.main.shake(duration, intensity, true);
      this.shakeUntil = now + duration;
      this.shakeIntensity = intensity;
    }
  }

  /** Hit feedback driven off authoritative state diffs: enemy hp drops → flash + damage number;
   *  local player hp drops → flash + screen shake (§20 game-feel from day one). */
  private updateCombatFx(): void {
    if (!this.room) return;
    this.hitVfxSpent = 0;
    this.damageNumbersSpent = 0;
    this.damageNumberEnemies.clear();
    const hits: Array<{
      id: string;
      rig: SpriteRig;
      dmg: number;
      crit: boolean;
      visible: boolean;
      radius: number;
    }> = [];
    this.room.state.enemies.forEach((enemy, id) => {
      const prev = this.enemyHp.get(id);
      if (prev !== undefined && enemy.hp < prev) {
        const rig = this.enemies.get(id);
        if (rig) {
          const dmg = prev - enemy.hp;
          // §30 CRIT: the synced critFlash counter ticked this frame → this hit was a critical. Gold number,
          // a gold flash, extra hit-stop + a shock ring — a crit lands with weight even on a small number.
          const crit =
            (this.enemyCrit.get(id) ?? enemy.critFlash) !== enemy.critFlash;
          hits.push({
            id,
            rig,
            dmg,
            crit,
            visible: this.cameras.main.worldView.contains(rig.x, rig.y),
            radius:
              (ENEMY_KINDS[enemy.kind]?.radius ?? ENEMY_RADIUS) *
              (enemy.tough ? TOUGH_SCALE : 1),
          });
        }
      }
      this.enemyHp.set(id, enemy.hp);
      this.enemyCrit.set(id, enemy.critFlash);
    });
    // Only horde-scale frames reorder: on-camera hits spend the finite full-stack + label budgets before
    // invisible enemies. Stable sort preserves authoritative iteration order within each visibility band.
    if (hits.length > HIT_VFX_BUDGET)
      hits.sort((a, b) => Number(b.visible) - Number(a.visible));
    for (const { id, rig, dmg, crit, radius } of hits) {
      const big = dmg >= 40; // top damage band — a crushing blow (visual/audio ONLY, no balance change)
      rig.flash(crit ? 150 : big ? 120 : 80, crit ? 0xffdb63 : 0xffffff); // zero-allocation degraded path
      // `prev - hp` already aggregates every source delivered in this patch; the key is a defensive one-label
      // guard if another hit call site joins this frame. Off-screen labels lose the stable-sort budget first.
      if (
        this.damageNumbersSpent < DAMAGE_NUMBER_BUDGET &&
        !this.damageNumberEnemies.has(id)
      ) {
        this.damageNumberEnemies.add(id);
        this.damageNumbersSpent++;
        spawnDamageNumber(this, rig.x, rig.y - 26, dmg, crit, id);
      }
      const fullFx = this.hitVfxSpent < HIT_VFX_BUDGET;
      if (!fullFx) continue; // flash + optional pooled number only: no painted Images/rects/rings/tweens
      this.hitVfxSpent++;
      this.audio.play(crit || big ? "bighit" : "hit", {
        x: rig.x,
        amt: Math.min(1, dmg / 45),
      });
      // §36 directional contact spark — thrown along the blow vector (nearest live player-rig → enemy,
      // both in the SAME render space so it's correct in belt mode too). Every hit gets steel-bite; the
      // heavier RING/stinger stay gated to the crunch below.
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
      this.spawnHitSpark(
        rig.x,
        rig.y,
        Math.atan2(rig.y - by, rig.x - bx),
        crit,
        tint,
        hitEl,
      );
      // The flipbook belongs to this budget-approved FULL stack only: gun-bullet + melee-equipped hits get
      // the weapon element; thrown/cast deliveries retain every existing layer without a false bloom.
      if (
        hitWeapon?.gun ||
        (hitWeapon && !hitWeapon.thrown && !hitWeapon.cast)
      ) {
        spawnImpactFlipbook(this, rig.x, rig.y, radius, hitEl);
      }
      if (big || crit) this.spawnImpactRing(rig.x, rig.y); // a white shock ring sells the crunch
      if (big || crit) this.spawnSpeedLines(rig.x, rig.y, crit); // §36 heavy-hit stinger: focus streaks
      if (crit) this.hitStop(70); // a touch of extra hit-stop on the spike
    }

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
            now - this.parryChainAt <= PARRY_CHAIN_WINDOW * 1000
              ? this.parryChain + 1
              : 1;
          this.parryChainAt = now;
          if (this.parryChain >= 2)
            this.spawnComboPop(p.x, p.y, this.parryChain);
        }
      }
    });

    const selfId = this.room.sessionId;
    const self = selfId ? this.room.state.players.get(selfId) : undefined;
    if (self) {
      if (
        this.prevSelfHp >= 0 &&
        self.hp < this.prevSelfHp - 0.01 &&
        this.time.now - this.lastHurt > 180
      ) {
        this.blobs.get(selfId)?.flash();
        this.shakeCam(100, 0.005);
        // §19 a muffled "oof" scaled by the damage taken; §20 punch the low-HP vignette on the hit.
        this.audio.play("hurt", {
          amt: Math.min(1, (this.prevSelfHp - self.hp) / self.maxHp / 0.2),
        });
        this.hurtFlash = 1;
        this.lastHurt = this.time.now;
      }
      this.prevSelfHp = self.hp;

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
      if (
        this.prevHeldLoot !== "" &&
        heldKey !== this.prevHeldLoot &&
        (self.weaponRarity > 0 || self.weaponAffix !== "")
      ) {
        const rar = RARITIES[self.weaponRarity];
        const tierName = self.weaponRarity > 0 ? `${rar?.name ?? ""} ` : "";
        const affix = self.weaponAffix
          ? `${affixById(self.weaponAffix).name} `
          : "";
        const name = WEAPONS[self.weapon]?.name ?? self.weapon;
        this.flashBanner(
          `${tierName}${affix}${name}`.toUpperCase(),
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
      .setDepth(99994);
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
      scale: crit ? 0.5 : 0.38,
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
        .setDepth(99997);
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
    const flash = this.add
      .circle(x, y, 22, 0xffffff, 0.5)
      .setBlendMode(ADD)
      .setDepth(99995);
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
    const ring = this.add
      .circle(x, y, 24)
      .setStrokeStyle(5, 0xffd479, 0.95)
      .setDepth(99997);
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
    this.hpBarFill.fillColor =
      ratio > 0.5 ? 0x9cff3b : ratio > 0.25 ? 0xff8a2b : 0xff5d5d;
    this.hpText.setText(`${Math.ceil(hp)} / ${maxHp}`);

    // §19 v0.108 A7: low-HP DANGER vignette + hurt punch. Below 30% HP the screen edges glow red (with a
    // heartbeat pulse under 25%); a fresh hit spikes `hurtFlash` (set in updateCombatFx) for a punch that
    // reads even at full HP. Reads HP only — changes nothing.
    this.hurtFlash = Math.max(
      0,
      this.hurtFlash - (this.deltaSec || 0.016) * 3.5,
    );
    const aliveSelf = !!self && self.alive;
    let vig =
      aliveSelf && ratio < 0.3 ? Math.min(1, (0.3 - ratio) / 0.3) * 0.5 : 0;
    if (aliveSelf && ratio < 0.25)
      vig *= 0.72 + 0.28 * Math.sin(this.time.now / 220);
    vig = Math.max(vig, aliveSelf ? this.hurtFlash * 0.32 : 0);
    this.dangerVignette.setAlpha(
      Phaser.Math.Linear(this.dangerVignette.alpha, vig, 0.18),
    );

    // XP bar + level badge (§12).
    this.xpBarBg.setPosition(barX, xpY);
    this.xpBarFill.setPosition(barX + 2 * s, xpY);
    const xpRatio =
      self && self.xpToNext > 0 ? Math.min(1, self.xp / self.xpToNext) : 0;
    // §19 v0.108 A8: XP fill eases up on a kill (satisfying), but SNAPS on a level reset (ratio drops).
    if (this.xpShown < 0 || xpRatio < this.xpShown - 0.05)
      this.xpShown = xpRatio;
    else this.xpShown = Phaser.Math.Linear(this.xpShown, xpRatio, 0.25);
    this.xpPulse = Math.max(0, this.xpPulse - (this.deltaSec || 0.016) / 0.12);
    this.xpBarFill.width = 236 * s * this.xpShown;
    // Receipt pulse changes thickness/brightness only; the authoritative XP ratio remains the sole width.
    this.xpBarFill.height = (4 + this.xpPulse * 3) * s;
    this.xpBarFill.fillColor = this.xpPulse > 0.05 ? 0xd9fbff : 0x6fd6ff;
    this.xpBarFill.setAlpha(0.92 + this.xpPulse * 0.08);
    this.levelText
      .setPosition(barX, xpY - 9 * s)
      .setText(
        self
          ? `Lv ${self.level}   STR ${self.str} · DEX ${self.dex} · INT ${self.int} · CON ${self.con} · LUK ${self.luk}   ⚡${Math.round(critChanceFor(self.luk, self.dex) * 100)}% crit`
          : "",
      );

    this.restartBtn.setPosition(this.screenW() - 14 * s, 14 * s);
    // Weapon name + an ammo readout: filled/empty pips for small mags (thrown/revolver), a numeric
    // "loaded/mag" for big-magazine guns (gatling/nailgun), or "reloading…" while empty.
    let charges = "";
    if (self && self.maxCharges > 0) {
      if (self.charges <= 0) charges = "   ⟳ reloading…";
      else if (self.maxCharges > 10)
        charges = `   ▮ ${self.charges}/${self.maxCharges}`;
      else
        charges = `   ${"◆".repeat(self.charges)}${"◇".repeat(Math.max(0, self.maxCharges - self.charges))}`;
    }
    // §10 v0.104 the held weapon's LOOT identity rides the readout: "Rare Keen Neon Katana", tinted by
    // its rarity tier (loot-less holds stay plain).
    const heldRar =
      self && self.weaponRarity > 0 ? RARITIES[self.weaponRarity] : undefined;
    const heldAffix = self?.weaponAffix ? affixById(self.weaponAffix).name : "";
    const lootPrefix = [heldRar?.name ?? "", heldAffix]
      .filter(Boolean)
      .join(" ");
    this.weaponText
      .setPosition(barX, xpY - 24 * s)
      .setText(
        self
          ? `⚔ ${lootPrefix ? `${lootPrefix} ` : ""}${WEAPONS[self.weapon]?.name ?? self.weapon}${charges}   ·   Q to cycle`
          : "",
      );
    // Ammo-state colour so you reload proactively: red while reloading, amber on the last ~25%, else
    // green — with a rarity tint when the weapon carries one and ammo is healthy.
    if (
      self &&
      self.maxCharges > 0 &&
      self.charges <= Math.max(1, Math.ceil(self.maxCharges * 0.25))
    ) {
      this.weaponText.setColor(self.charges <= 0 ? "#ff5d5d" : "#ff8a2b");
    } else if (heldRar) {
      this.weaponText.setColor(
        `#${heldRar.color.toString(16).padStart(6, "0")}`,
      );
    } else {
      this.weaponText.setColor("#9cff3b");
    }

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

    const training = this.room?.state.mode === "training";
    const bossrush = this.room?.state.mode === "bossrush";
    // §38 show the worn character's CLASS so the swap reads as a build choice, not just a skin.
    const who = self
      ? ` · C: ${characterName(self.character)} [${classForCharacter(self.character).name}] — grows ${classForCharacter(self.character).classAttr.toUpperCase()}`
      : "";
    const dimName = getDimension(this.room?.state.dimensionId).name;
    // M19 §6 greed loop: surface the time-gated objective from the synced clock — a boss countdown, then the
    // fight, then what stepping into the portal actually DOES (bank + end). H9: the two core verbs (RMB fire,
    // LMB parry) ride on the always-on line so there's a path to learning the controls.
    const st = this.room?.state;
    const elapsed = st?.elapsedSeconds ?? 0;
    const depth = st?.depth ?? 1;
    const bossActive = (st?.bossPhase ?? 0) >= 1;
    let objective: string;
    if (st?.portalOpen) {
      objective = "▼ bank & end · ⇓ rift: push deeper";
    } else if (bossActive) {
      objective = "⚠ BOSS — defeat it to open the gates";
    } else {
      const left = Math.max(0, bossSpawnAt(depth) - elapsed);
      const mmss = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, "0")}`;
      objective = `survive — boss in ${mmss}`;
    }
    // §6 chain HUD: depth + the carried (at-risk) vs banked salvage — the stakes of the greed decision.
    let carried = 0;
    st?.players.forEach((p) => {
      carried += p.salvaged;
    });
    const stakes = `⛏ ${carried} carried · ${st?.bankedSalvage ?? 0} banked`;
    // §4 v0.107 connection-degraded hint (amendment #13): >~1.2s of un-acked input commands = the link
    // is stalling — tell the player WHY their character stopped responding instead of failing silently.
    const lagging =
      this.predictor !== null &&
      (this.predictor.isStalled || this.predictor.stats.pending > 24);
    const lagPrefix = lagging ? "⚠ CONNECTION LAG · " : "";
    // §16 v0.116 BOSS RUSH — a dedicated objective line: which boss of 10 is up, or the breather between.
    const BOSS_RUSH_TOTAL = 10;
    const rushObjective = bossActive
      ? `⚠ BOSS ${Math.min(depth, BOSS_RUSH_TOTAL)}/${BOSS_RUSH_TOTAL} — cut it down`
      : `☠ BOSS RUSH — next boss incoming…`;
    this.modeText
      .setPosition(this.screenW() / 2, 12 * s)
      .setText(
        training
          ? `${lagPrefix}⛶ TESTING GROUNDS — E/R: grab · Q/E: browse showroom pages (when clear) · Tab: summon · Space: jump · T: exit${who}`
          : this.belt
            ? // §29 belt controls hint — surfaces the arsenal (1/2/3 · Q/E), bag (Tab), and shopkeeper (F).
              `${lagPrefix}${this.room?.state.beltRoomName || "SKY CARRIER"} · RMB fire · LMB parry · Space jump · R grab · 1/2/3 swap · Tab bag · F trade${who}`
            : bossrush
              ? `${lagPrefix}${rushObjective} · ${stakes} · RMB fire · LMB parry${who}`
              : `${lagPrefix}${dimName} · depth ${depth} · ${objective} · ${stakes} · RMB fire · LMB parry${who}`,
      )
      .setColor(
        lagging
          ? "#ff8a2b"
          : this.belt
            ? "#7fb0d8"
            : training
              ? "#33e6ff"
              : bossrush
                ? "#ff5d3b"
                : "#5a6472",
      );

    // §6 rez-or-dead: a downed player waits for a rez (no respawn); a full wipe ends the run.
    const downed = !!self && !self.alive;
    this.deathText.setVisible(downed);
    if (downed) {
      const wiped = this.room?.state.outcome === "defeat";
      this.deathText
        .setText(
          wiped
            ? "DEFEATED — the squad is down\n(click Restart Run, top-right)"
            : "DOWNED — a squadmate with a rez weapon\n(Gravedigger's Spade) can revive you",
        )
        .setColor(wiped ? "#ff5d5d" : "#ffd479")
        .setPosition(this.screenW() / 2, this.screenH() / 2);
    }
  }

  /** §9 card carousel: one full infographic card per arsenal weapon (art + stats), fanned at the
   *  bottom; the held card is centered, upright, enlarged + readable. */
  private buildCarousel(): void {
    for (const id of WEAPON_IDS) this.carousel.push(buildCard(this, id));
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
    bar
      .fillStyle(0x000000, 0.55)
      .fillRoundedRect(x - 2, y - 2, w + 4, h + 4, 5);
    bar.fillStyle(0x2a2a2a, 1).fillRoundedRect(x, y, w, h, 4);
    bar
      .fillStyle(done ? 0xff5a4a : 0xffb24a, 1)
      .fillRoundedRect(x, y, w * frac, h, 4);
    bar.setVisible(true);
    label
      .setText(done ? "SALVAGED" : "hold: SALVAGE · release: DROP")
      .setColor(done ? "#ff8a5a" : "#ffe7a8")
      .setPosition(this.screenW() / 2, y - 12)
      .setVisible(true);
  }

  /** Fan the hand at the bottom: held card centered/upright/big with live charges; others smaller,
   *  rotated, fanned to the sides (prev left / next right, §9). */
  private updateCarousel(): void {
    if (!this.room || this.carousel.length === 0) return;
    // §29 belt swaps the roster carousel for the compact 3-slot arsenal HUD — hide the fanned cards.
    if (this.belt) {
      if (this.carousel[0]?.container.visible)
        for (const c of this.carousel) c.container.setVisible(false);
      this.updateArsenalHud();
      return;
    }
    const self = this.room.state.players.get(this.room.sessionId);
    const ids = WEAPON_IDS;
    const n = ids.length;
    const si = Math.max(0, ids.indexOf(self?.weapon ?? ids[0] ?? ""));
    const depthSelectionChanged = si !== this.carouselDepthSelection;
    if (depthSelectionChanged) this.carouselDepthSelection = si;
    const cx = this.screenW() / 2;
    const selY = this.screenH() - 170;
    const arcR = 700;
    const step = 0.26;
    for (const card of this.carousel) {
      let off = ids.indexOf(card.id) - si;
      if (off > n / 2) off -= n;
      if (off < -n / 2) off += n;
      const isSel = off === 0;
      const ang = off * step;
      card.container.setPosition(
        cx + Math.sin(ang) * arcR,
        selY + arcR * (1 - Math.cos(ang)) - (isSel ? 24 : 0),
      );
      card.container.setRotation(isSel ? 0 : ang);
      card.container.setScale(isSel ? 1.0 : 0.62);
      card.container.setAlpha(isSel ? 1 : 0.82);
      if (depthSelectionChanged) {
        card.container.setDepth(100000 + (isSel ? 100 : 30 - Math.abs(off)));
      }

      const def = WEAPONS[card.id];
      const attrs: Record<Attr, number> = {
        str: self?.str ?? 1,
        dex: self?.dex ?? 1,
        int: self?.int ?? 1,
        con: self?.con ?? 1,
        luk: self?.luk ?? 1,
      };
      // Show REAL (sub-integer) damage so every stat point visibly moves the number (§12). Each §14
      // source scales off ITS OWN grades — so pumping INT grows Wyrmtooth's magma but not its blade.
      const fmt = (v: number) =>
        Number.isInteger(v) ? String(v) : v.toFixed(1);
      // §11 unmet requirements PENALISE every source's damage (the enforcement rule) — fold it into the
      // shown total so the card is WYSIWYG, and tint the equation amber when the weapon is under-statted.
      // §10 v0.104: the HELD card also folds in its rolled loot identity (rarity × affix) — the equation
      // always equals the damage the server actually deals.
      const pen = def ? requirementPenalty(def, attrs) : 1;
      const loot =
        isSel && self && card.id === self.weapon
          ? lootDamageMult(self.weaponRarity, self.weaponAffix)
          : 1;
      for (const s of card.sources) {
        const mult = damageMultFromGrades(s.src.grades, attrs) * pen * loot;
        const total = s.src.base * mult;
        s.text.setText(
          `${fmt(s.src.base)} + ${fmt(total - s.src.base)} = ${fmt(total)}`,
        );
        s.text.setColor(pen < 1 ? "#ffb24a" : loot > 1 ? "#b8ff6a" : "#ffd479");
      }
      // Requirements: green when met by the player's live attributes, red when unmet.
      for (const tk of card.reqTokens) {
        tk.text.setColor(
          (attrs[tk.attr] ?? 1) >= tk.need ? "#9cff3b" : "#ff5a4a",
        );
      }
      // Resource value (the icon conveys charges-vs-durability): live charges, or the durability number.
      if (def?.thrown) {
        const cur = isSel && self ? self.charges : def.thrown.charges;
        card.resource.setText(`${cur} / ${def.thrown.charges}`);
      } else if (def?.durability) {
        card.resource.setText(String(def.durability));
      } else {
        card.resource.setText("");
      }
    }
  }

  /** §29 meta-progression bank: the player's SCRIP persisted in localStorage, restored on belt join and
   *  re-saved whenever it changes. MVP persistence (client-local, single-machine) — a server/account bank
   *  can replace it later without touching the earn/sell loop. Clamped to the uint16 sync ceiling. */
  private loadBankedScrip(): number {
    try {
      const v = Number.parseInt(
        localStorage.getItem("dd.beltScrip") ?? "0",
        10,
      );
      return Number.isFinite(v) ? Math.max(0, Math.min(65535, v)) : 0;
    } catch {
      return 0; // storage blocked (private mode / sandbox) → start fresh, no crash
    }
  }
  private saveBankedScrip(scrip: number): void {
    try {
      localStorage.setItem(
        "dd.beltScrip",
        String(Math.max(0, Math.min(65535, Math.floor(scrip)))),
      );
    } catch {
      /* storage blocked — non-fatal, scrip just won't persist this session */
    }
  }

  /** §31 the persisted permanent-upgrade levels (the meta "account"), restored on belt join + re-saved on
   *  purchase. Client-local MVP (matches the scrip bank); a server/account store can replace the transport. */
  private loadUpgrades(): MetaLevels {
    try {
      return sanitizeMetaLevels(
        JSON.parse(localStorage.getItem("dd.beltUpgrades") ?? "{}"),
      );
    } catch {
      return { ...EMPTY_META };
    }
  }
  private saveUpgrades(levels: MetaLevels): void {
    try {
      localStorage.setItem(
        "dd.beltUpgrades",
        JSON.stringify(sanitizeMetaLevels(levels)),
      );
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
        .setDepth(depth);
      pool[i] = t;
    }
    return t;
  }

  /** The (weapon id, rarity) shown for slot `i` — the ACTIVE slot reads the live held weapon (the server only
   *  re-syncs the slot on a swap/grab), the others read their stored slot. */
  private slotView(
    self: PlayerState,
    i: number,
  ): { wid: string; rarity: number } {
    if (i === self.activeSlot)
      return { wid: self.weapon, rarity: self.weaponRarity };
    const sl = self.slots[i];
    return { wid: sl?.weapon ?? "", rarity: sl?.rarity ?? 0 };
  }

  /** §29 belt ARSENAL HUD — 3 slot chips (active raised + bright rarity border, others dim) showing the
   *  weapon name tinted by rarity + the slot key, plus a scrip + bag readout. Click a chip to swap to it (or,
   *  with the bag open, to stash it). Immediate-mode Graphics + pooled Text + persistent click zones. */
  private updateArsenalHud(): void {
    const self = this.room?.state.players.get(this.room?.sessionId ?? "");
    if (!self) return;
    const s = this.uiScale();
    if (!this.arsenalG)
      this.arsenalG = this.add.graphics().setScrollFactor(0).setDepth(100048);
    const g = this.arsenalG;
    g.clear();
    const chipW = 156 * s;
    const chipH = 42 * s;
    const gap = 10 * s;
    const total = 3 * chipW + 2 * gap;
    const x0 = this.screenW() / 2 - total / 2;
    const baseY = this.screenH() - 84 * s;
    for (let i = 0; i < 3; i++) {
      const active = i === self.activeSlot;
      const { wid, rarity } = this.slotView(self, i);
      const empty = !wid || wid === "fists";
      const col = empty ? 0x39424e : (RARITIES[rarity]?.color ?? 0x9aa5b1);
      const x = x0 + i * (chipW + gap);
      const y = baseY - (active ? 8 * s : 0);
      g.fillStyle(0x0c1016, active ? 0.9 : 0.66).fillRoundedRect(
        x,
        y,
        chipW,
        chipH,
        7 * s,
      );
      g.lineStyle(
        active ? 3 * s : 1.5 * s,
        col,
        active ? 1 : 0.6,
      ).strokeRoundedRect(x, y, chipW, chipH, 7 * s);
      // slot key
      const key = this.hudText(this.arsenalTexts, i, 100049)
        .setText(String(i + 1))
        .setColor(active ? "#ffe27a" : "#5c6672")
        .setPosition(x + 8 * s, y + 5 * s);
      key.setFontSize(12 * s).setOrigin(0, 0);
      // weapon name (rarity-tinted)
      const nm = empty ? "—" : (WEAPONS[wid]?.name ?? wid);
      const name = this.hudText(this.arsenalTexts, 3 + i, 100049)
        .setText(nm)
        .setColor(empty ? "#5c6672" : `#${col.toString(16).padStart(6, "0")}`)
        .setPosition(x + chipW / 2, y + chipH / 2 + 3 * s);
      name.setFontSize((nm.length > 16 ? 11 : 13) * s).setOrigin(0.5, 0.5);
      // click zone (swap to this slot, or stash it when the bag is open)
      let z = this.slotZones[i];
      if (!z) {
        z = this.add
          .rectangle(0, 0, 1, 1, 0, 0)
          .setScrollFactor(0)
          .setDepth(100047)
          .setInteractive();
        z.on("pointerdown", () => {
          if (this.shopOpen)
            this.room?.send("sellWeapon", { from: "slot", index: i });
          else if (this.bagOpen) this.room?.send("bagStore", { slot: i });
          else this.room?.send("swapSlot", { slot: i });
        });
        this.slotZones[i] = z;
      }
      z.setPosition(x + chipW / 2, y + chipH / 2).setSize(chipW, chipH);
    }
    // §30 class set-bonus for the current loadout (active slot = live held weapon, others = stored).
    const loadout = [0, 1, 2].map((i) => this.slotView(self, i).wid);
    const setB = weaponSetBonus(loadout, self.weapon);
    const setTxt = setB > 1 ? `   ⚔ SET +${Math.round((setB - 1) * 100)}%` : "";
    // scrip + bag + set-bonus readout above the chips
    const info = this.hudText(this.arsenalTexts, 6, 100049)
      .setText(
        `◈ ${self.scrip} scrip     BAG ${self.bag.length}/${BAG_CAP}  ·  Tab${setTxt}`,
      )
      .setColor("#9fb0c2")
      .setPosition(this.screenW() / 2, baseY - 16 * s);
    info.setFontSize(12 * s).setOrigin(0.5, 1);
    // §29 sale feedback: flash the scrip gained + a pickup blip when the total ticks up, and PERSIST the
    // running scrip bank so it carries to the next run (meta-progression — "send stuff back").
    if (self.scrip !== this.lastScrip) {
      if (this.lastScrip >= 0 && self.scrip > this.lastScrip) {
        this.flashBanner(`+${self.scrip - this.lastScrip} ◈ SCRIP`, "#ffe27a");
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
    if (this.bagOpen || this.shopOpen) this.renderBagPanel(self, s);
    else if (this.bagG?.visible) this.hideBagPanel();
  }

  /** §29 draw the world-space SHOPKEEPER at state.beltShopX (a lit market stall + keeper), a "Press F"
   *  prompt when the local player is in range, and re-tint when the SELL overlay is open. */
  private updateShopkeeper(self: PlayerState, s: number): void {
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
        g.fillStyle(i % 2 ? 0xf2e6c8 : 0xd8b448, 1).fillRect(
          gx - 54 + i * 18,
          gy - 132,
          18,
          12,
        );
      // posts + counter
      g.fillStyle(0x5a4632, 1)
        .fillRect(gx - 52, gy - 130, 6, 130)
        .fillRect(gx + 46, gy - 130, 6, 130);
      g.fillStyle(0x6b503a, 1).fillRect(gx - 56, gy - 44, 112, 16);
      // keeper (head + cloak)
      g.fillStyle(0x2a3550, 1).fillRect(gx - 16, gy - 96, 32, 52);
      g.fillStyle(0xe3b58f, 1).fillCircle(gx, gy - 104, 13);
      g.fillStyle(0x1d2740, 1).fillRect(gx - 15, gy - 118, 30, 10); // hood brim
      // sign
      g.fillStyle(0x101722, 0.9).fillRect(gx - 30, gy - 176, 60, 20);
      this.shopPromptText = this.add
        .text(gx, gy - 166, "SHOP", {
          fontFamily: "monospace",
          color: "#ffd479",
        })
        .setOrigin(0.5, 0.5)
        .setDepth(BELT_Y0 + DEPTH_MAX + 6);
      this.shopPromptText.setFontSize(13);
    }
    this.shopNpcG.setVisible(true);
    // Proximity prompt (screen-pinned would need a second object; reuse the world sign text swapping label).
    const near = Math.abs(self.x - shopX) <= SHOP_RADIUS;
    if (this.shopPromptText) {
      this.shopPromptText
        .setText(this.shopOpen ? "TRADING" : near ? "◈ F: TRADE" : "SHOP")
        .setColor(near ? "#9cff6a" : "#ffd479");
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

  private renderBagPanel(self: PlayerState, s: number): void {
    if (!this.bagG)
      this.bagG = this.add.graphics().setScrollFactor(0).setDepth(100044);
    const g = this.bagG.setVisible(true);
    g.clear();
    const panelW = Math.min(this.screenW() - 80 * s, 720 * s);
    const bandH = this.shopOpen ? 74 * s : 0; // §31 the permanent-upgrade BUY band (shop only)
    const panelH = 210 * s + bandH;
    const px = this.screenW() / 2 - panelW / 2;
    const py = this.screenH() - 84 * s - panelH - 18 * s;
    g.fillStyle(0x070a0f, 0.92).fillRoundedRect(px, py, panelW, panelH, 10 * s);
    this.drawPanelFrame(g, px, py, panelW, panelH, s); // §37 Clean Minimal border
    const title = this.hudText(this.bagTexts, 0, 100046)
      .setText(
        this.shopOpen
          ? "SHOP — buy permanent upgrades (persist across runs) · click a weapon or slot to SELL · F to close"
          : "BAG — click a weapon to equip · click a slot to stash · Tab to close",
      )
      .setColor(this.shopOpen ? "#ffd479" : "#9fb0c2")
      .setPosition(px + 16 * s, py + 12 * s);
    title.setFontSize(12 * s).setOrigin(0, 0);
    if (this.shopOpen) {
      this.renderUpgradeBand(self, s, px, py + 34 * s, panelW);
    } else {
      // Bag mode: make sure the shop's upgrade band (zones + texts) is hidden so it can't intercept clicks.
      for (const z of this.buyZones) z.setVisible(false);
      for (let i = 20; i <= 25; i++) this.bagTexts[i]?.setVisible(false);
    }
    const cols = 4;
    const cellW = (panelW - 32 * s) / cols;
    const cellH = 40 * s;
    const gx = px + 16 * s;
    const gy = py + 40 * s + bandH;
    for (let i = 0; i < BAG_CAP; i++) {
      const item = self.bag[i];
      const zone = (() => {
        let z = this.bagZones[i];
        if (!z) {
          z = this.add
            .rectangle(0, 0, 1, 1, 0, 0)
            .setScrollFactor(0)
            .setDepth(100045)
            .setInteractive();
          z.on("pointerdown", () => {
            if (i >= self.bag.length) return;
            if (this.shopOpen)
              this.room?.send("sellWeapon", { from: "bag", index: i });
            else if (this.bagOpen)
              this.room?.send("bagEquip", { index: i, slot: self.activeSlot });
          });
          this.bagZones[i] = z;
        }
        return z;
      })();
      if (!item || !item.weapon) {
        zone.setVisible(false);
        continue;
      }
      const cx = gx + (i % cols) * cellW;
      const cy = gy + Math.floor(i / cols) * (cellH + 6 * s);
      const col = RARITIES[item.rarity]?.color ?? 0x9aa5b1;
      g.fillStyle(0x121821, 0.95).fillRoundedRect(
        cx,
        cy,
        cellW - 8 * s,
        cellH,
        6 * s,
      );
      g.lineStyle(1.5 * s, col, 0.8).strokeRoundedRect(
        cx,
        cy,
        cellW - 8 * s,
        cellH,
        6 * s,
      );
      const baseName = WEAPONS[item.weapon]?.name ?? item.weapon;
      const price = scripValue(item.rarity, item.earned);
      const nm = this.shopOpen
        ? `${baseName}  ${price > 0 ? `+${price}◈` : "·"}`
        : baseName;
      const t = this.hudText(this.bagTexts, 1 + i, 100046)
        .setText(nm)
        .setColor(`#${col.toString(16).padStart(6, "0")}`)
        .setVisible(true)
        .setPosition(cx + (cellW - 8 * s) / 2, cy + cellH / 2);
      t.setFontSize((nm.length > 14 ? 10 : 12) * s).setOrigin(0.5, 0.5);
      zone
        .setVisible(true)
        .setPosition(cx + (cellW - 8 * s) / 2, cy + cellH / 2)
        .setSize(cellW - 8 * s, cellH);
    }
  }

  /** §31 the shop's permanent-upgrade BUY band: one card per META_UPGRADE with its owned level, effect, and
   *  next-level scrip cost. Click to buy (server-authoritative). Amber = affordable, grey = broke, dim = maxed. */
  private renderUpgradeBand(
    self: PlayerState,
    s: number,
    px: number,
    y: number,
    panelW: number,
  ): void {
    const g = this.bagG;
    if (!g) return;
    const n = META_UPGRADES.length;
    const colW = (panelW - 32 * s) / n;
    const bx = px + 16 * s;
    const h = 62 * s;
    const curOf = (id: string) =>
      id === "vitality"
        ? self.upVitality
        : id === "fortune"
          ? self.upFortune
          : self.upPower;
    for (let i = 0; i < n; i++) {
      const u = META_UPGRADES[i]!;
      const cur = curOf(u.id);
      const cost = nextUpgradeCost(u.id, cur);
      const maxed = cost === null;
      const afford = cost !== null && self.scrip >= cost;
      const cx = bx + i * colW;
      const w = colW - 8 * s;
      g.fillStyle(0x121821, 0.95).fillRoundedRect(cx, y, w, h, 6 * s);
      g.lineStyle(
        1.5 * s,
        maxed ? 0x5a6472 : afford ? 0xffd24a : 0x3a3f47,
        0.95,
      ).strokeRoundedRect(cx, y, w, h, 6 * s);
      const label = this.hudText(this.bagTexts, 20 + i, 100046)
        .setText(`${u.name}  ${cur}/${u.maxLevel}\n${u.desc}`)
        .setColor("#cfe0f0")
        .setVisible(true)
        .setPosition(cx + w / 2, y + 8 * s);
      label
        .setFontSize(10.5 * s)
        .setOrigin(0.5, 0)
        .setAlign("center");
      const costT = this.hudText(this.bagTexts, 23 + i, 100046)
        .setText(maxed ? "MAX" : `${cost} ◈`)
        .setColor(maxed ? "#5a6472" : afford ? "#9cff6a" : "#7a8290")
        .setVisible(true)
        .setPosition(cx + w / 2, y + h - 7 * s);
      costT.setFontSize(11 * s).setOrigin(0.5, 1);
      let z = this.buyZones[i];
      if (!z) {
        z = this.add
          .rectangle(0, 0, 1, 1, 0, 0)
          .setScrollFactor(0)
          .setDepth(100045)
          .setInteractive();
        z.on("pointerdown", () => {
          if (this.shopOpen)
            this.room?.send("buyUpgrade", { id: META_UPGRADES[i]!.id });
        });
        this.buyZones[i] = z;
      }
      z.setVisible(true)
        .setPosition(cx + w / 2, y + h / 2)
        .setSize(w, h);
    }
  }

  /** Hide the bag overlay + its zones/texts (panel closed). */
  private hideBagPanel(): void {
    this.bagG?.setVisible(false);
    for (const z of this.bagZones) z.setVisible(false);
    for (const z of this.buyZones) z.setVisible(false);
    for (let i = 1; i < this.bagTexts.length; i++)
      this.bagTexts[i]?.setVisible(false);
    this.bagTexts[0]?.setVisible(false);
  }

  /** Chain-lightning VFX (§10 on-hit proc, §14 client-predicted): a jagged teal bolt from the weapon
   *  through the struck enemy and on to the nearest unhit enemies — mirroring the server's chain so the
   *  visual matches the damage. Cosmetic only; the server (`weapon.chainLightning`) owns all damage. */
  private spawnChain(
    sx: number,
    sy: number,
    aim: { x: number; y: number },
    weapon: WeaponDef,
  ): void {
    const cl = weapon.chainLightning;
    if (!cl || !this.room) return;
    const vfx = cl.vfx ?? { color: 0.5, jag: 0.3, life: 180 };
    const VR = (
      globalThis as { VFXRENDER?: { lerpHue?: (h: number) => number } }
    ).VFXRENDER;
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
      if (
        inMeleeArc(
          { x: sx, y: sy },
          aim.x,
          aim.y,
          p,
          weapon.range,
          weapon.halfArc,
        )
      ) {
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
    const nodes = [
      { x: sx, y: sy },
      { x: seedX, y: seedY },
      ...links.map((l) => ({ x: l.x, y: l.y })),
    ];
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
  ): void {
    const ang = Math.atan2(aim.y, aim.x);
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
    );
  }

  /** §39 DEV PORTAL: apply a `?dev=` deep-link once the room is live — enter Testing Grounds, then spawn the
   *  boss / equip the weapon / wear the character the portal requested. Messages process server-side in order,
   *  but we delay the target a beat so `mode` is definitely `training` when its guard checks. */
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
      else if (kind === "char" && arg)
        room.send("devEquip", { character: arg });
      else if (kind === "enemy" && arg)
        room.send("debugSpawn", { kind: arg, count: 3 });
      this.flashBanner(`▶  DEV: ${kind} ${arg}`, "#33e6ff");
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
    const fullDeaths = this.paperDeaths.reduce(
      (count, death) => count + (death.full ? 1 : 0),
      0,
    );
    const snapshot = this.paperWorldFold
      ? `${this.paperWorldFold.snapshot.width}x${this.paperWorldFold.snapshot.height}`
      : "off";
    const paper = ` · paper ${fullDeaths}/${this.paperDeaths.length}d ${this.closingPickups.size}p rt:${snapshot} peak:${this.paperPeakObjects}`;
    this.debugEl.textContent = `run ${elapsed}s · fps ${fps} · players ${players} · enemies ${enemies} · mouseMoves ${this.pointerMoves}${net}${paper}`;
  }

  /** §4 v0.107 one PATCH = one completed server tick. Stamp the snapshot timeline + remote rings and
   *  reconcile the self predictor. Data only — rigs are moved by the render step, never from here. */
  private onPatch(state: ArenaState): void {
    const now = this.time.now;
    if (state.tick <= 0) return; // pre-sim state (menu/handshake)
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
      if (prevFell !== undefined && prevFell !== p.fellSeq)
        buf.reset(t, p.x, p.y);
      else buf.push(t, p.x, p.y);
      this.snapFell.set(id, p.fellSeq);
    });
    state.enemies.forEach((e, id) => {
      let buf = this.enemyBufs.get(id);
      if (!buf) {
        buf = new SnapshotBuffer();
        this.enemyBufs.set(id, buf);
      }
      buf.push(t, e.x, e.y);
    });
    // Self: create the predictor on the first patch that carries us, then reconcile every patch.
    if (selfId) {
      const self = state.players.get(selfId);
      if (self) {
        const view = ArenaScene.serverView(self);
        if (this.predictor) {
          this.predictor.reconcile(view);
        } else {
          this.predictor = new SelfPredictor(view);
          if (this.belt) {
            this.predictor.setMap(undefined);
            this.predictor.setBeltLevel(
              this.beltLevel ?? beltLevelFor("sky-carrier"),
            );
          } else {
            this.predictor.setMap(this.arenaMap);
          }
        }
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
      alive: p.alive,
      frozen: p.flexPending > 0 || p.sigPending > 0,
    };
  }

  /** §4 v0.107 the fixed 50ms INPUT-COMMAND loop: sample WASD once per frame, mint + send + predict one
   *  sequence-numbered command per elapsed 50ms (clamped ≤3/frame — a throttled-tab wake must not burst
   *  its whole backlog; the server would drain-to-newest anyway, and the predictor hard-resyncs). */
  private stepNetInput(deltaMs: number): void {
    this.curDx = (this.keys.D.isDown ? 1 : 0) - (this.keys.A.isDown ? 1 : 0);
    this.curDy = (this.keys.S.isDown ? 1 : 0) - (this.keys.W.isDown ? 1 : 0);
    if (!this.room || !this.predictor) return;
    if (deltaMs > 250) {
      // A real frame stall (throttled tab wake / GC pause): drop the input backlog AND hard-resync the
      // predictor on the next patch — its pending window is stale by the whole gap (amendment #12).
      this.inputAccMs = 0;
      this.predictor.forceResync();
    }
    this.inputAccMs = Math.min(this.inputAccMs + deltaMs, TICK_MS * 3);
    while (this.inputAccMs >= TICK_MS) {
      this.inputAccMs -= TICK_MS;
      const cmd = this.predictor.mintCmd(
        this.curDx,
        this.curDy,
        this.jumpQueued,
      );
      this.jumpQueued = false;
      this.room.send("input", cmd);
      this.predictor.tick(cmd);
    }
  }
}
