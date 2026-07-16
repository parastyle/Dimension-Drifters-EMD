import {
  CHOP_IMPACT_FRAC,
  INTERP_SNAP_PLAYER,
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
  MELEE_COMBO_SEQUENCES,
  meleeComboSelectionFor,
  meleeComboSequenceFor,
  type MeleeComboFamily,
  type MeleeComboMotion,
  type MeleeComboStep,
  type MeleeComboVariant,
  MOVE_SPEED,
  PROCEDURAL_JIGGLE,
  type SwingDescriptor,
  swingDescriptorFor,
  swingDescriptorWithComboStep,
  type WeaponDef,
} from "@dd/shared";
import Phaser from "phaser";
import { SPRITES, type SpriteManifest } from "../sprites/manifest.js";

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
  const frame = `${spriteId}/${role}`;
  if (
    scene.textures.exists(SPRITE_ATLAS) &&
    scene.textures.get(SPRITE_ATLAS).has(frame)
  ) {
    return { key: SPRITE_ATLAS, frame };
  }
  return { key: `${spriteId}:${role}` };
}

/** On-screen height of the body part, in px. Everything else scales from this. (tuning) */
const TARGET_BODY_H = 76; // §37 slightly smaller characters (was 84) — reads better in the zoomed-out belt
/** §7 v0.112 procedural gait — px travelled per full stride cycle (2 steps). Distance-based, so the step
 *  cadence MATCHES actual speed (no jog-in-place, no fixed loop that runs after you stop). (tuning) */
const STRIDE_LEN = 150;
/** Vertical "look" toward the cursor (local player): how far the torso leans + the held weapon tilts
 *  with the aim's up/down. Subtle by design — "to some degree". (tuning) */
const BODY_LOOK_LEAN = 0.14;
const WEAPON_LOOK_TILT = 0.6;
/** §45 rollback switch for Stage-1 presentation, including empty-hand fist dispatch. No gameplay reads it. */
const CLIENT_VISUAL_COMBOS = true;
/** The authored guard eases to neutral only after accepted-cadence grace lapses. */
const COMBO_HOLD_RELEASE_MS = 120;

type RigComboFamily = MeleeComboFamily | "none";

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

/** PROCEDURAL_JIGGLE ownership envelope: anticipation ramps in, active is exact, follow-through hands off. */
function actionOwnershipAt(
  t: number,
  activeStart: number,
  activeEnd: number,
  followEnd: number,
): number {
  if (t < activeStart)
    return smootherstep01(activeStart > 0 ? t / activeStart : 1);
  if (t <= activeEnd) return 1;
  if (t < followEnd)
    return (
      1 -
      smootherstep01((t - activeEnd) / Math.max(1e-6, followEnd - activeEnd))
    );
  return 0;
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
}

/** Rebase on construction/cuts/swaps/LOD sleep. A cut is not acceleration and must add zero energy. */
function resetJigglePart(
  p: JigglePartState,
  ax: number,
  ay: number,
  own: number,
): void {
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
  if (!Number.isFinite(p.jx + p.jy + p.jvx + p.jvy))
    resetJigglePart(p, ax, ay, own);
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
}

export type PaperDeathTreatment =
  "crumple" | "flutter" | "tear" | "lite" | "pit";

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
 * parts (body + detached hands/feet, cut by tools/artkit/guards/slice.mjs) as separate
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
  private readonly scale: number;
  /** Rig-level UNIFORM scale multiplier (tough/boss size-up). Applied to BOTH axes every frame so
   *  the facing flip never stretches the sprite — art keeps its painted aspect ratio (§28.4). */
  private baseScale = 1;
  private readonly body: Phaser.GameObjects.Image;
  private readonly hands: RigHand[] = [];
  private readonly feet: RigFoot[] = [];
  private readonly parts: Phaser.GameObjects.Image[] = [];
  private readonly label?: Phaser.GameObjects.Text;
  private readonly phase: number;
  /** §29 quantized display-list depth last sent to Phaser; unchanged writes force a global re-sort. */
  private lastDepth = Number.NaN;
  private facing = 1;
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
  /** Detached deaths advance only when ArenaScene advances its freeze-aware paper-death list. */
  private paperDeath?: PaperDeathState;
  /** §7 v0.105 de-clunk — landing squash (0..1, decays) fired when the hop returns to the ground. */
  private landSquash = 0;
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
  }[] = [];
  private weaponDef?: WeaponDef;
  private swingStart = -1e9;
  /** §44 immutable predicted/accepted swing clock. The normalized pose branches below are untouched; only
   *  their `tt` time base comes from this effective-cooldown descriptor. */
  private swing?: SwingDescriptor;
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
  private comboWeaponId = "";
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
  private signatureMotion?: MeleeComboMotion;
  /** §20 world-space aim (radians) captured at swing-start, so the blade sweeps the server's swept arc. */
  private swingAimWorld = Number.NaN;
  private braceStart = -1e9;
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

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    isSelf: boolean,
    id: string,
    spriteId: string,
  ) {
    const manifest = SPRITES[spriteId as keyof typeof SPRITES] as
      SpriteManifest | undefined;
    if (!manifest)
      throw new Error(`SpriteRig: no sprite manifest for "${spriteId}"`);
    this.scene = scene;
    this.scale = TARGET_BODY_H / manifest.body.h;

    // Build parts. Draw order (back→front): back hand, feet, body, front hand. The front
    // hand is the one on the side the art faces (right = +x); the other tucks behind.
    const make = (role: string): Phaser.GameObjects.Image | undefined => {
      const part = manifest.parts.find((p) => p.role === role);
      if (!part) return undefined;
      const tx = partTexture(scene, spriteId, role);
      const img = scene.add.image(
        part.ox * this.scale,
        part.oy * this.scale,
        tx.key,
        tx.frame,
      );
      img.setOrigin(0.5).setScale(this.scale);
      this.parts.push(img);
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

    const order: Phaser.GameObjects.GameObject[] = [];
    for (const f of this.feet) order.push(f.img);
    for (const h of this.hands) if (!h.front) order.push(h.img);
    order.push(this.body);
    for (const h of this.hands) if (h.front) order.push(h.img);

    this.label = isSelf
      ? scene.add
          .text(0, -TARGET_BODY_H * 0.62 - 12, "you", {
            fontSize: "12px",
            color: "#E8E4D8",
          })
          .setOrigin(0.5)
      : undefined;
    if (this.label) order.push(this.label);

    // §5/§20 ground shadow at the feet — drawn FIRST (behind everything) so it sits under the rig; it
    // stays put while the art lifts on the hop, so the gap reads as altitude.
    this.shadow = scene.add
      .ellipse(
        0,
        TARGET_BODY_H * 0.42,
        TARGET_BODY_H * 0.6,
        TARGET_BODY_H * 0.22,
        0x000000,
        0.3,
      )
      .setOrigin(0.5);
    order.unshift(this.shadow);

    this.root = scene.add.container(x, y, order);
    this.renderPrevX = x;
    this.renderPrevY = y;
    this.jigglePrevRootX = x;
    this.jigglePrevRootY = y;

    // Per-rig phase offset so a crowd doesn't bob in lockstep. Derived from id (stable).
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 1000;
    this.phase = h / 1000;
  }

  setPosition(x: number, y: number): void {
    this.root.setPosition(x, y);
  }

  /** Allocation-free lifetime reset; the next authored anchors rebase before any excitation is accepted. */
  private resetSecondaryMotion(): void {
    this.jiggleSignalX = 0;
    this.jiggleSignalY = 0;
    this.jiggleRootReady = false;
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

  /** §33 COLOSSUS framing: a PERMANENT upward art-lift (in body-heights) so a giant renders feet-at-the-
   *  ground with its torso towering off the top of the screen — "you only see his lower body". Like the hop,
   *  it moves ONLY the visible art (logical position, depth-sort + the grounded shadow stay put). `frac` = how
   *  many body-heights to lift; 0 = normal. */
  setLowerBodyFrame(frac: number): void {
    this.baseLift = frac * TARGET_BODY_H;
  }

  /** Arrival envelope is evaluated by `animate()` so facing, combo poses, and jiggle keep transform ownership. */
  playSpawnUnfold(timeMs: number, durationMs = 220): void {
    this.spawnDurationMs = Math.max(1, durationMs);
    this.spawnStartMs = timeMs + Math.floor(this.phase * 70);
    this.root.scaleX = this.baseScale * 0.82;
    this.root.scaleY = this.baseScale * -0.04;
    this.root.rotation = 0.045;
  }

  /** §20 detached death: crumple, through-plane flutter, tear, or the cheap overflow/pit fold. */
  deathPop(
    vx: number,
    vy: number,
    treatment: PaperDeathTreatment = "flutter",
  ): void {
    this.resetSwingCombo();
    this.resetSecondaryMotion();
    this.spawnStartMs = -1;
    this.root.rotation = 0;

    let tearOther: Phaser.GameObjects.Image | undefined;
    const tearParts: PaperDeathPartPose[] = [];
    if (treatment === "tear") {
      const frameW = Math.max(2, Math.floor(this.body.frame.width));
      const frameH = Math.max(1, Math.floor(this.body.frame.height));
      const split = Math.floor(frameW / 2);
      tearOther = this.scene.add
        .image(
          this.body.x,
          this.body.y,
          this.body.texture.key,
          this.body.frame.name,
        )
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
        this.root.rotation =
          death.rotation + (death.phase < Math.PI ? -1 : 1) * 0.07 * e;
      } else {
        const e = smoothstep01((death.elapsedMs - 90) / 150);
        this.root.x = death.x0 + death.vx * (0.16 + 0.84 * e);
        this.root.y = death.y0 + death.vy * (0.16 + 0.84 * e) + 12 * e;
        this.root.scaleX = death.scaleX * (1.12 - 0.94 * e);
        this.root.scaleY = death.scaleY * (0.72 - 0.52 * e);
        this.root.rotation =
          death.rotation + (death.phase < Math.PI ? -1 : 1) * 0.07 * (1 - e);
        this.root.alpha = death.alpha * (1 - e);
      }
    } else {
      // P4: signed scale crosses edge-on three times; rotation is only a restrained paper ruffle.
      this.root.x =
        death.x0 +
        death.vx * q +
        10 * (1 - q) * Math.sin(6 * Math.PI * q + death.phase);
      this.root.y =
        death.y0 + death.vy * q - 46 * Math.sin(Math.PI * q) + 18 * q * q;
      this.root.scaleX = death.scaleX * Math.cos(3 * Math.PI * q);
      this.root.scaleY = death.scaleY * (1 - 0.22 * Math.sin(Math.PI * q));
      this.root.rotation =
        death.rotation + 0.07 * Math.sin(4 * Math.PI * q + death.phase);
      this.root.alpha = death.alpha * (1 - q) ** 1.6;

      if (death.treatment === "tear" && death.tearOther) {
        const sep = smoothstep01(Math.min(1, death.elapsedMs / 80));
        const leftX = -9 * sep - 24 * q;
        const rightX = 9 * sep + 24 * q;
        this.body.x = death.bodyX + leftX;
        this.body.y = death.bodyY + 8 * q;
        this.body.scaleX = death.bodyScaleX;
        this.body.scaleY = death.bodyScaleY;
        this.body.rotation =
          death.bodyRotation + 0.07 * Math.sin(4 * Math.PI * q + death.phase);
        death.tearOther.x = death.bodyX + rightX;
        death.tearOther.y = death.bodyY - 6 * q;
        death.tearOther.scaleX = death.bodyScaleX;
        death.tearOther.scaleY = death.bodyScaleY;
        death.tearOther.rotation =
          death.bodyRotation +
          0.07 * Math.sin(4 * Math.PI * q + death.phase + Math.PI);
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
    if (mult !== this.baseScale) this.resetSecondaryMotion();
    this.baseScale = mult;
    this.root.setScale(mult);
  }

  /** Add a pulsing glow behind the body — the §15 "tough = glowier" tell. Lives in the container
   *  so it scales + moves with the rig. */
  addGlow(color: number): void {
    const glow = this.scene.add
      .ellipse(
        0,
        -TARGET_BODY_H * 0.35,
        TARGET_BODY_H * 1.9,
        TARGET_BODY_H * 1.9,
        color,
        0.3,
      )
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
    this.swingAimWorld = Number.NaN;
    this.swingChained = false;
    this.resetComboChain(true);
  }

  /** Undo only the late signature multipliers/offsets when animation will not get another frame (death,
   * down, or weapon lifetime change). Ordinary authored hand positions may remain as the launch pose. */
  private releaseAttackVisuals(): void {
    if (!this.signatureMotion) return;
    const attackDy = this.attackArtOffY - this.attackLiftPx;
    for (const part of this.parts) {
      part.x -= this.attackArtOffX;
      part.y -= attackDy;
      part.scaleY /= Math.abs(this.attackScaleY) > 1e-5 ? this.attackScaleY : 1;
    }
    for (const weapon of this.weapons) {
      weapon.img.x -= this.attackArtOffX;
      weapon.img.y -= attackDy;
      weapon.img.scaleX /=
        Math.abs(this.weaponLengthScale) > 1e-5 ? this.weaponLengthScale : 1;
      weapon.img.scaleY /=
        Math.abs(this.attackScaleY) > 1e-5 ? this.attackScaleY : 1;
    }
    this.body.scaleX = Math.abs(this.body.scaleX);
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
  }

  /** Timeout may preserve the old hold long enough to ease it out; swaps clear it immediately. */
  private resetComboChain(clearHold: boolean): void {
    this.comboFamily = "none";
    this.comboStep = 0;
    this.comboExpiresAtMs = -1e9;
    this.comboWeaponId = "";
    this.swingStep = 0;
    this.swingDirection = 1;
    this.swingFamily = "none";
    this.swingVariant = "default";
    if (clearHold) this.comboHoldPose = undefined;
  }

  /** Equip (or swap) a weapon — one piece per hand (dual-wield uses both hands + both sprite
   *  parts). Each piece is held UPRIGHT in its hand, pivoting at the grip, and is inserted just
   *  BELOW that hand in the container so the hand overlays the hilt. */
  equipWeapon(
    spriteId: string,
    def: WeaponDef,
    manifest: SpriteManifest,
  ): void {
    for (const w of this.weapons) w.img.destroy();
    this.weapons = [];
    this.weaponDef = def;
    // §7 v0.105 de-clunk: reset the swing clock on a swap — otherwise elapsed time from the OLD weapon's
    // swing carries into the NEW weapon's timeline. §45 the combo/hold shares that exact lifetime boundary.
    this.resetSwingCombo();
    this.resetSecondaryMotion();

    const frontHand = this.hands.find((h) => h.front);
    const backHand = this.hands.find((h) => !h.front);
    // §42 WORN gear pivots where the hand sits INSIDE the glove (~40% in from the cuff) instead of at the
    // authored gripFrac (the cuff) — gripFrac-mounting a gauntlet read as holding it by the opening and
    // smacking people with it, duel-challenge style.
    const worn = isWornWeapon(def);
    const attach = (
      part: SpriteManifest["parts"][number] | undefined,
      hand: typeof frontHand,
    ): Phaser.GameObjects.Image | undefined => {
      if (!part || !hand) return undefined;
      const tx = partTexture(this.scene, spriteId, part.role);
      const img = this.scene.add.image(
        hand.img.x,
        hand.img.y,
        tx.key,
        tx.frame,
      );
      const wScale = def.displayLength / part.w;
      img.setOrigin(worn ? 0.4 : def.gripFrac, 0.5).setScale(wScale);
      this.root.add(img);
      this.weapons.push({ img, hand, baseScale: wScale });
      return img;
    };
    const frontWpn = attach(manifest.parts[0], frontHand);
    const backWpn =
      def.dual && manifest.parts.length >= 2
        ? attach(manifest.parts[1], backHand)
        : undefined;

    // Explicit z-stack (bottom→top): each weapon overlays the BODY but tucks UNDER its hand.
    // Single-wield keeps the back hand behind the body; dual brings it forward so both read.
    const stack: Phaser.GameObjects.GameObject[] = [];
    for (const f of this.feet) stack.push(f.img);
    if (def.twoHanded) {
      // 2H: one weapon, BOTH hands gripping it above the body.
      stack.push(this.body);
      if (frontWpn) stack.push(frontWpn);
      if (backHand) stack.push(backHand.img);
      if (frontHand) stack.push(frontHand.img);
    } else if (def.dual) {
      stack.push(this.body);
      // §42 worn dual (twin claws): each glove renders OVER its hand — the hand is inside it.
      if (worn) {
        if (backHand) stack.push(backHand.img);
        if (backWpn) stack.push(backWpn);
        if (frontHand) stack.push(frontHand.img);
        if (frontWpn) stack.push(frontWpn);
      } else {
        if (backWpn) stack.push(backWpn);
        if (backHand) stack.push(backHand.img);
        if (frontWpn) stack.push(frontWpn);
        if (frontHand) stack.push(frontHand.img);
      }
    } else {
      if (backHand) stack.push(backHand.img);
      stack.push(this.body);
      // §42 worn single: the glove covers the hand (hand under, weapon on top); held: hand grips the hilt.
      if (worn) {
        if (frontHand) stack.push(frontHand.img);
        if (frontWpn) stack.push(frontWpn);
      } else {
        if (frontWpn) stack.push(frontWpn);
        if (frontHand) stack.push(frontHand.img);
      }
    }
    if (this.label) stack.push(this.label);
    for (const obj of stack) this.root.bringToTop(obj);
  }

  /** Start a swing animation (damage is server-authoritative). `timeMs` is the scene clock accepted/predicted
   *  epoch, shared locally by rig/VFX/quake; `aimWorld` freezes aim. The optional descriptor is computed once
   *  by ArenaScene from effective cooldown; server acceptance sync is the later protocol reconciliation. */
  triggerSwing(
    timeMs: number,
    aimWorld?: number,
    swing?: SwingDescriptor,
  ): void {
    let nextSwing =
      swing ??
      (this.weaponDef
        ? swingDescriptorFor(this.weaponDef, this.weaponDef.cooldown)
        : undefined);
    // §41 SPIN CHAIN remains byte-for-byte the old pose-window+150ms test. Ordinary styles no longer infer
    // continuity from their short 0.64× visual: they advance below from effective accepted cadence+grace.
    if (nextSwing?.style === "spin" && this.swing) {
      const prevDur = this.swing.poseSeconds * 1000;
      this.swingChained = timeMs - this.swingStart <= prevDur + 150;
    } else {
      this.swingChained = false;
    }

    const selection =
      CLIENT_VISUAL_COMBOS && nextSwing && this.weaponDef
        ? meleeComboSelectionFor(this.weaponDef, nextSwing.style)
        : undefined;
    if (nextSwing && selection && this.weaponDef) {
      const { family, variant, sequence } = selection;
      const continues =
        this.comboFamily === family &&
        this.comboWeaponId === this.weaponDef.id &&
        timeMs <= this.comboExpiresAtMs;
      const step = continues ? (this.comboStep + 1) % sequence.length : 0;
      const authored = sequence[step];
      if (authored) {
        // Continuity is based on the accepted/predicted START: readyAt=start+effective CD, then the authored
        // grace. Early buffered requests only reach this method when locally fired; Stage 2 will reconcile
        // this same `(weapon,family,step)` snapshot from authoritative swingSeq/comboStep.
        const expiresAtMs =
          timeMs +
          nextSwing.effectiveCooldown * 1000 +
          comboGraceMs(nextSwing.effectiveCooldown);
        this.comboFamily = family;
        this.comboStep = step;
        this.comboExpiresAtMs = expiresAtMs;
        this.comboWeaponId = this.weaponDef.id;
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
        // Stage 1 enriches the local immutable clock only. Arena/VFX/server retain the original descriptor,
        // so gameplay remains the legacy centered single sweep and quake still fires on its accepted clock.
        nextSwing = swingDescriptorWithComboStep(
          nextSwing,
          this.weaponDef,
          step,
        );
      }
    } else {
      this.resetComboChain(true);
    }
    this.swingStart = timeMs;
    this.swing = nextSwing;
    this.swingAimWorld = aimWorld ?? Number.NaN;
  }

  /** Start a parry BRACE pose (§8) — raise the weapon to a horizontal block, draw the hands up into
   *  a guard, and dip into a brace, held ~the i-frame window. Purely a STANCE (no VFX yet; on-parry
   *  effects arrive with the level-up parry augments). */
  triggerBrace(timeMs: number): void {
    // §7 v0.105 de-clunk: on a CHAIN parry (a press landing while the guard is still up), don't restart the
    // envelope from 0 — that re-ramps the raise over ~81ms and flickers the guard OFF for a frame right in
    // the Sekiro rhythm. Restart at the PLATEAU time instead so the guard holds continuously.
    this.braceStart =
      timeMs - this.braceStart < SpriteRig.BRACE_DUR
        ? timeMs - 0.18 * SpriteRig.BRACE_DUR
        : timeMs;
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
    this.resetSecondaryMotion();
    if (on) this.resetSwingCombo(); // §45 a down/death boundary cannot bank a held finisher for revival
    this.root.setAlpha(on ? 0.5 : 1);
    this.restTint();
  }

  /** Re-apply the resting tint (downed grey > Brand ember-orange > none). */
  private restTint(): void {
    for (const p of this.parts) {
      if (this.downed)
        p.setTint(0x556070).setTintMode(Phaser.TintModes.MULTIPLY);
      else if (this.branded)
        p.setTint(0xff7a4a).setTintMode(Phaser.TintModes.MULTIPLY);
      else p.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    }
  }

  /** Brief impact flash on every part (§20 hit feedback / §6 revive pop), then back to the resting tint. */
  flash(ms = 80, color = 0xffffff): void {
    for (const p of this.parts)
      p.setTint(color).setTintMode(Phaser.TintModes.FILL);
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
  unequip(def: WeaponDef): void {
    for (const w of this.weapons) w.img.destroy();
    this.weapons = [];
    this.weaponDef = def;
    this.resetSwingCombo();
    this.resetSecondaryMotion();
  }

  destroy(): void {
    // §20 the delayed callback closes over this rig; detach it before destroying the visible hierarchy.
    this.flashTimer?.remove(false);
    this.flashTimer = undefined;
    for (const w of this.weapons) w.img.destroy();
    this.root.destroy();
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
    const activeStart =
      0.18 + ((0.5 - 0.18) * (acceptedImpact - 0.18)) / (0.66 - 0.18);
    const followEnd =
      acceptedImpact + ((1 - acceptedImpact) * (0.82 - 0.66)) / (1 - 0.66);
    const businessLength = Math.max(
      H * 0.52,
      ((1 - (this.weaponDef?.gripFrac ?? 0.1)) *
        (this.weaponDef?.displayLength ?? H)) /
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
      setGripFromHead(
        fx * H * 0.52,
        fy * H * 0.52,
        angle,
        this.weaponLengthScale,
        H * 0.3,
      );
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
      this.body.rotation +=
        0.08 * Math.sin(Math.PI * 2 * e) * Math.cos(aimLocal);
      this.weaponLengthScale = signedClamp(Math.cos(Math.PI * e), 0.16);
      const release = smoothstep01((p - 0.72) / 0.28);
      const headX = fx * H * (0.52 - 0.12 * release);
      const headY = fy * H * (0.52 - 0.12 * release) - H * 0.18 * release;
      const spacing = H * (0.3 - 0.12 * apex);
      setGripFromHead(
        headX,
        headY,
        angle,
        this.weaponLengthScale,
        Math.max(H * 0.18, spacing),
      );
      this.attackGripBlend = 1;
      this.attackWeaponDepth = p <= 0.72 ? -1 : 1;
      const shadowGround = H * (0.05 + 0.17 * e);
      this.attackShadowX = fx * shadowGround;
      this.attackShadowY = fy * shadowGround;
      this.attackShadowScaleX = 1 - 0.42 * apex;
      this.attackShadowScaleY = 1 - 0.42 * apex;
      this.attackShadowAlpha = 1 - 0.45 * apex;
    } else if (tt < acceptedImpact) {
      const p = clamp01(
        (tt - activeStart) / Math.max(1e-6, acceptedImpact - activeStart),
      );
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
      const p = clamp01(
        (tt - acceptedImpact) / Math.max(1e-6, followEnd - acceptedImpact),
      );
      this.attackArtOffX = fx * H * 0.28;
      this.attackArtOffY = fy * H * 0.28;
      this.body.y += H * 0.08 * s;
      this.body.rotation += 0.22 * Math.cos(aimLocal);
      this.body.scaleY *= 0.86 + 0.02 * p;
      const recoil = p < 0.2 ? Math.sin((p / 0.2) * Math.PI) : 0;
      this.weaponLengthScale = 1 - 0.06 * recoil;
      angle += 0.1 + 0.03 * Math.sin(p * Math.PI * 6) * (1 - p);
      setGripFromHead(
        fx * H * 0.54,
        fy * H * 0.54,
        angle,
        this.weaponLengthScale,
        H * 0.3,
      );
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
      const headY =
        fy * H * (0.54 - 0.29 * p) - H * 0.06 * Math.sin(Math.PI * p);
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
      const tremor =
        Math.sin(this.scene.time.now * 0.018 * Math.PI * 2) * this.scale;
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
      this.weaponLengthScale =
        Math.hypot(rx, ry) + (1 - Math.hypot(rx, ry)) * p;
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
      const loadAngle = aimLocal - Math.PI / 2 - 0.62;
      angle =
        aimLocal +
        Math.PI +
        0.18 +
        (loadAngle - (aimLocal + Math.PI + 0.18)) * p;
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
      const tremor =
        Math.sin(this.scene.time.now * 0.013 * Math.PI * 2) * this.scale;
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
      this.attackHandSpacing =
        H * (0.34 + 0.08 * Math.max(0, (p - 0.62) / 0.38));
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

  animate(timeMs: number, anim: RigAnim): void {
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
    const sceneNow = this.scene.time.now;
    const springDtS = Math.min(JIGGLE_MAX_DT_S, dtMs / 1000);
    const rootDx = this.root.x - this.jigglePrevRootX;
    const rootDy = this.root.y - this.jigglePrevRootY;
    const rootCut = Math.hypot(rootDx, rootDy) > INTERP_SNAP_PLAYER;
    const jiggleRebase =
      firstAnim || rawDtMs <= 0 || rawDtMs > JIGGLE_MAX_DT_S * 1000 || rootCut;
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

    // Landing is measured before part integration so the one-shot compression enters this frame's springs;
    // the final art lift/shadow pass remains last. With the rollback flag off the arithmetic/order of writes
    // is unchanged because no earlier target reads hopPx or landSquash.
    const prevHop = this.hopPx;
    this.hopPx +=
      (this.hopTarget - this.hopPx) * (1 - Math.exp((-22 * dtMs) / 1000));
    if (this.hopPx < 0.05 && this.hopTarget < 0.05) this.hopPx = 0;
    const landed = prevHop > 6 && this.hopPx <= 6 && this.hopTarget < 1;
    if (landed) this.landSquash = 1;
    this.landSquash = Math.max(0, this.landSquash - dtMs / 110);
    // The active counter resets as soon as readyAt+grace lapses. Its last authored guard remains only as a
    // 120ms cosmetic release; it cannot make a late trigger continue because family/weapon are already clear.
    if (this.comboFamily !== "none" && sceneNow > this.comboExpiresAtMs)
      this.resetComboChain(false);
    if (
      this.comboHoldPose &&
      sceneNow >= this.comboHoldPose.expiresAtMs + COMBO_HOLD_RELEASE_MS
    )
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
      const dot = nx * this.headingX + ny * this.headingY; // 1 = same way … −1 = reversal
      if (gait > 0.4 && dot < 0.72 && this.turnCommit < 0.06) {
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
    const lagX = Math.max(
      -1.4,
      Math.min(1.4, (this.velX - this.slowVelX) / MOVE_SPEED),
    );
    const lagY = Math.max(
      -1.4,
      Math.min(1.4, (this.velY - this.slowVelY) / MOVE_SPEED),
    );
    let springSignalX = 0;
    let springSignalY = 0;
    if (PROCEDURAL_JIGGLE) {
      if (!this.jiggleRootReady || jiggleRebase || jiggleLodSkip) {
        this.jiggleSignalX = 0;
        this.jiggleSignalY = 0;
        this.jiggleRootReady = true;
      } else {
        // Snapshot rigs get the panel's slower 14/s conditioner; self prediction keeps the current 26/s feel.
        const filterHz = anim.isSelf
          ? JIGGLE_SELF_FILTER_HZ
          : JIGGLE_REMOTE_FILTER_HZ;
        const k = 1 - Math.exp(-filterHz * springDtS);
        this.jiggleSignalX += (lagX - this.jiggleSignalX) * k;
        this.jiggleSignalY += (lagY - this.jiggleSignalY) * k;
        springSignalX =
          Math.abs(this.jiggleSignalX) < JIGGLE_SIGNAL_DEAD_ZONE
            ? 0
            : this.jiggleSignalX;
        springSignalY =
          Math.abs(this.jiggleSignalY) < JIGGLE_SIGNAL_DEAD_ZONE
            ? 0
            : this.jiggleSignalY;
      }
    }
    this.strideT += ((spd * dtS) / STRIDE_LEN) * Math.PI * 2;
    if (this.strideT > Math.PI * 2e6) this.strideT -= Math.PI * 2e6; // keep it bounded over a long session
    const legPh = this.strideT;

    // Facing: toward the cursor for the local player, else toward movement (but a GUN-holder faces their
    // AIM even remotely, so the barrel + body read as pointing where they shoot). Mirror the whole
    // container; per-part offsets/aim are computed in local space so the flip stays coherent.
    const dirX = anim.isSelf
      ? anim.aimX
      : this.weaponDef?.gun
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
    this.facingBlend +=
      (this.facing - this.facingBlend) * (1 - Math.exp((-12 * dtMs) / 1000)); // τ≈83ms
    if (outsidePaperView && this.spawnStartMs >= 0) this.spawnStartMs = -1;
    const spawnElapsedMs =
      this.spawnStartMs >= 0
        ? timeMs - this.spawnStartMs
        : Number.POSITIVE_INFINITY;
    const spawnActive = spawnElapsedMs < this.spawnDurationMs + 38;
    const spawnScaleX = spawnActive
      ? paperPopScaleX(spawnElapsedMs, this.spawnDurationMs)
      : 1;
    const spawnScaleY = spawnActive
      ? paperPopScaleY(spawnElapsedMs, this.spawnDurationMs)
      : 1;
    const spawnRotation = spawnActive
      ? paperPopRotation(spawnElapsedMs, this.spawnDurationMs)
      : 0;
    if (!spawnActive && this.spawnStartMs >= 0) this.spawnStartMs = -1;
    this.root.scaleX = this.facingBlend * this.baseScale * spawnScaleX;
    this.root.scaleY = this.baseScale * spawnScaleY;
    this.root.rotation = spawnRotation;
    // Keep the "you" label a FIXED on-screen size + readable regardless of the character's rig scale: the
    // label is a child of the root (scaled by baseScale), so counter baseScale on both axes — else a bigger
    // character blows the text up (weapons counter the same way, §29). scaleX also counters the facing mirror.
    if (this.label) {
      const inv = 1 / (this.baseScale || 1);
      this.label.scaleX = this.facing * inv;
      this.label.scaleY = inv;
    }

    // Vertical "look" toward the cursor — local player only (others have no synced aim). aimY is screen
    // space (−up / +down) and is NOT touched by the facing mirror, so it leans correctly both ways.
    const lookY = anim.isSelf ? Math.max(-1, Math.min(1, anim.aimY)) : 0;

    // §7 v0.112 Bob + squash/stretch: the bob is STRIDE-synced when moving (two dips per stride = one per
    // footfall) and a slow breathing sway when idle — so it never runs a fixed loop out of step with the feet.
    const bob =
      gait * Math.sin(legPh * 2) + (1 - gait) * Math.sin(t * 2.2) * 0.55;
    // Signed attack pitch is applied late; reset detached-part scale so it never compounds frame-to-frame.
    for (const hand of this.hands) hand.img.setScale(s);
    for (const foot of this.feet) foot.img.setScale(s);
    this.body.x = 0;
    this.body.y = bob * 3 * s * 4; // a touch of vertical bob, proportional to size
    this.body.scaleX = s * (1 + bob * 0.04);
    this.body.scaleY = s * (1 - bob * 0.06);
    // §MADNESS the torso leans HARD into the run + accel — a loose, weighty forward pitch (Madness-Combat
    // flash feel), not a stiff upright. Movement lean 0.16→0.34, accel lean 0.32→0.55.
    this.body.rotation =
      anim.moveX * 0.34 * gait + lagX * 0.55 + lookY * BODY_LOOK_LEAN;

    // §20 momentum FLINCH (Stage A): the torso leans + jolts with the impulse shove (gun recoil / hit
    // knockback). The whole body already slides via the server position; this is the additive flinch on
    // top so the push reads as weight, not a teleport. Same world axes as the movement lean above.
    const rcx = anim.recoilX ?? 0;
    const rcy = anim.recoilY ?? 0;
    const rk = Math.min(1, Math.hypot(rcx, rcy) / 520);
    if (rk > 0.01) {
      this.body.rotation += Math.max(-1, Math.min(1, rcx / 520)) * 0.22;
      this.body.y += Math.max(-1, Math.min(1, rcy / 520)) * 5 * s;
      this.body.scaleX *= 1 + rk * 0.06;
    }

    // §7 v0.111 turn-commit BODY: an exaggerated one-time lean + plant-dip into the new heading (decays), on
    // top of the steady movement lean above — reads as the rider hauling into the turn, then settling.
    if (commit > 0.01) {
      this.body.rotation += this.turnDirX * commit * 0.5; // haul the torso into the new direction
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
      this.body.scaleY = s * (1 - bob * 0.06 - brace * 0.05); // slight squash
    }

    // Weapon angle — guns AIM along the cursor; melee weapons sit upright at rest then wind-up + chop on
    // swing. Computed BEFORE the hands so a two-handed grip can place the back hand on the haft.
    let weaponAngle = 0;
    let backWeaponAngle = Number.NaN;
    let ownFront = 0;
    let ownBack = 0;
    let ownFeet = 0;
    this.orbitT = -1; // §40 re-armed below only while an orbit-style swing window is live
    this.orbitSpin = false;
    this.swingOffX = 0;
    this.swingOffY = 0;
    this.swingBackOffX = 0;
    this.swingBackOffY = 0;
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
    this.attackHandSpacing = TARGET_BODY_H * 0.42;
    this.signatureMotion = undefined;
    if (this.weaponDef?.gun && this.weapons.length > 0) {
      ownFront = 1; // gun grip/barrel truth is load-bearing; the aim hand never receives spring residual
      if (this.weaponDef.twoHanded) ownBack = 1;
      // GUN: point the BARREL along the aim (live cursor for self, synced `aimDir` for others). No swing —
      // the shot is the muzzle flash. Into the rig's LOCAL space (the container mirror flips x), so the
      // barrel tracks the cursor whichever way the body faces.
      const aimAng = anim.isSelf
        ? Math.atan2(anim.aimY, anim.aimX)
        : anim.aimDir;
      weaponAngle = Math.atan2(
        Math.sin(aimAng),
        Math.cos(aimAng) * this.facing,
      );
    } else if (
      this.weaponDef &&
      (this.weapons.length > 0 ||
        (CLIENT_VISUAL_COMBOS && this.weaponDef.id === "fists"))
    ) {
      const def = this.weaponDef;
      // Rest tilt follows the cursor's vertical: blade raises looking up, lowers looking down.
      const restA = -Math.PI / 2 + 0.16 + lookY * WEAPON_LOOK_TILT;
      weaponAngle = restA + Math.sin(t * 2.6) * 0.04; // gentle idle sway
      // §44 use Phaser's scene epoch — the same clock as the VFX tween + quake timer. During local hit-stop
      // the rendered frame holds because animate is skipped, then resumes at the CURRENT swing phase instead
      // of extending authoritative danger. Pose shapes/envelopes below remain byte-for-byte normalized.
      const el = this.scene.time.now - this.swingStart;
      const style = this.swing?.style;
      const dur = (this.swing?.poseSeconds ?? 0) * 1000;
      let tt = -1;
      let poseBlend = 1;
      let comboPose: Readonly<MeleeComboStep> | undefined;
      let poseDirection: -1 | 0 | 1 = 1;
      const hold = this.comboHoldPose;
      const family: RigComboFamily =
        this.swingFamily !== "none"
          ? this.swingFamily
          : (hold?.family ?? "none");
      if (
        CLIENT_VISUAL_COMBOS &&
        family !== "none" &&
        hold?.family === family &&
        el >= 0
      ) {
        const live = this.comboFamily === family;
        const snapshotStep = live ? this.swingStep : hold.step;
        const snapshotVariant = live ? this.swingVariant : hold.variant;
        poseDirection = live ? this.swingDirection : hold.direction;
        comboPose = meleeComboSequenceFor(family, snapshotVariant)[
          snapshotStep
        ];
        if (dur > 0 && el < dur) tt = el / dur;
        else if (sceneNow <= hold.expiresAtMs) tt = 1;
        else if (sceneNow < hold.expiresAtMs + COMBO_HOLD_RELEASE_MS) {
          tt = 1;
          poseBlend = 1 - (sceneNow - hold.expiresAtMs) / COMBO_HOLD_RELEASE_MS;
        }
      } else if (style && el >= 0 && el < dur) {
        tt = el / dur;
      }
      if (style && tt >= 0) {
        // Combo parts follow the procedural-jiggle ownership contract: anticipation ramps in, danger is
        // exact, follow-through releases energy, and the cadence hold owns nothing.
        if (comboPose) {
          let ownActiveStart = comboPose.timing.activeStart;
          let ownActiveEnd = comboPose.timing.activeEnd;
          let ownFollowEnd = comboPose.timing.followEnd;
          if (comboPose.motion === "fulcrum-flip") {
            const acceptedImpact = clamp01(
              (this.swing?.impactSeconds ?? 0) /
                Math.max(1e-6, this.swing?.poseSeconds ?? 1),
            );
            ownActiveEnd = acceptedImpact;
            ownActiveStart =
              0.18 + ((0.5 - 0.18) * (acceptedImpact - 0.18)) / (0.66 - 0.18);
            ownFollowEnd =
              acceptedImpact +
              ((1 - acceptedImpact) * (0.82 - 0.66)) / (1 - 0.66);
          }
          const own = actionOwnershipAt(
            tt,
            ownActiveStart,
            ownActiveEnd,
            ownFollowEnd,
          );
          ownFeet = own;
          if (comboPose.hand === "lead" || comboPose.hand === "both")
            ownFront = own;
          if (comboPose.hand === "off" || comboPose.hand === "both")
            ownBack = own;
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
        const aimLocal = Math.atan2(
          Math.sin(aimW),
          Math.cos(aimW) * this.facing,
        );
        const idleWeaponAngle = weaponAngle;
        const bodyBaseRotation = this.body.rotation;
        const bodyBaseY = this.body.y;
        const bodyBaseScaleX = this.body.scaleX;
        const bodyBaseScaleY = this.body.scaleY;
        const poseStyle = comboPose
          ? family === "rake"
            ? "pivot"
            : family
          : style;
        // KNOWN STAGE-1 RESIDUAL: every signed reverse/dual/overhead comboPose below is presentation-only;
        // server damage still advances once through its untouched centered, positive single-sweep descriptor.
        if (comboPose?.motion === "fulcrum-flip") {
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
          const raiseA = -Math.PI / 2 - 0.85; // up + tilted behind the head
          const slamA = 0.85 + lookY * 0.25; // down-forward (biased a touch by the cursor's vertical)
          const lowGuardA = slamA - 0.18;
          const lift = TARGET_BODY_H * 0.2;
          if (pose?.motion === "rising-chop") {
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
              this.swingOffY =
                TARGET_BODY_H * 0.04 - (lift + TARGET_BODY_H * 0.04) * e;
              this.body.rotation += 0.06 - 0.25 * e; // mirrored unwind: low/right → high/left
              this.body.y += (7 - 10 * e) * s;
              this.body.scaleY *= 0.95 + 0.1 * e;
            } else {
              const carry = Math.min(1, (tt - b) / (pose.timing.followEnd - b));
              weaponAngle = raiseA - 0.08 * Math.sin(Math.PI * carry);
              this.swingOffY = -lift;
              this.body.rotation -= 0.19;
              this.body.y -= 3 * s;
              this.body.scaleY *= 1.05;
            }
          } else {
            const execution = pose?.motion === "execution-slam";
            const a = pose?.timing.activeStart ?? 0.24;
            const b = pose?.timing.activeEnd ?? CHOP_IMPACT_FRAC;
            const follow = pose?.timing.followEnd ?? 0.66;
            const coilA = execution ? raiseA : -Math.PI / 2 - 0.35; // hang overhead vs weapon shoulder
            const fromA = execution ? raiseA : lowGuardA;
            if (tt < a) {
              const p = tt / a;
              const e = p * (2 - p);
              weaponAngle = fromA + (coilA - fromA) * e;
              this.swingOffY = execution
                ? -lift * (1 + 0.08 * Math.sin(Math.PI * p))
                : -lift * 0.55 * p;
              this.body.rotation += execution ? -0.18 : 0.12 - 0.25 * e;
              this.body.y +=
                (execution ? -4 - 1.5 * Math.sin(Math.PI * p) : 5 - 7.5 * e) *
                s;
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
              weaponAngle = slamA + (lowGuardA - slamA) * e; // settle to a chained low guard, not neutral
              this.swingOffY = TARGET_BODY_H * 0.06 * (1 - 0.35 * e);
              this.body.rotation +=
                (execution ? 0.28 : 0.2) - (execution ? 0.16 : 0.08) * e;
              this.body.y +=
                ((execution ? 8 : 6) - (execution ? 3 : 1) * e) * s;
              this.body.scaleY *= (execution ? 0.88 : 0.91) + 0.04 * e;
            }
          }
        } else if (poseStyle === "pivot") {
          // §45 RAKE: the existing diagonal arm-whip alternates lead/off hand, then runs both copies on the
          // authored stagger for a scissor. Dual claws move the actual rear glove; a single claw mirrors its
          // visible arm. Both paths remain cosmetic and share the server's ONE legacy hit application.
          const pose = comboPose ?? MELEE_COMBO_SEQUENCES.rake[0];
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
            const prior =
              direction > 0 ? aimLocal + spin * 0.55 : aimLocal + spin * 0.4;
            let prog = 0;
            let angle: number;
            if (tt < activeStart) {
              const p = tt / activeStart;
              angle = prior + (start - prior) * (p * (2 - p));
            } else if (tt < activeEnd) {
              prog =
                1 - (1 - (tt - activeStart) / (activeEnd - activeStart)) ** 3;
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
            const lat =
              TARGET_BODY_H * 0.26 * direction * (1 - 2 * prog) * wind;
            const out =
              TARGET_BODY_H * (0.12 + 0.2 * Math.sin(Math.PI * prog)) * wind;
            const drive = Math.sin(
              Math.PI *
                Math.min(
                  1,
                  Math.max(0, (tt - activeStart) / (activeEnd - activeStart)),
                ),
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
            const cross = Math.max(
              0,
              1 - Math.abs(tt - (pose.timing.impact ?? 0.43)) / 0.25,
            );
            this.body.scaleX *= 1 - 0.2 * cross;
            this.body.scaleY *= 1 - 0.07 * cross;
            this.body.rotation +=
              0.045 * Math.sin((tt - 0.43) * Math.PI * 4) * cross;
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
              weaponAngle =
                aimLocal +
                spin * 0.4 +
                (restA - aimLocal - spin * 0.4) * settle;
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
            this.body.rotation +=
              direction * 0.11 * rake.drive * Math.cos(aimLocal);
            this.body.y += 2 * s * rake.drive;
          }
        } else if (poseStyle === "punch") {
          // §45 PUNCH reuses the existing chamber/extension/hip-drive vocabulary as jab → rear cross →
          // haymaker. Empty fists enter here behind CLIENT_VISUAL_COMBOS; no sprite is required for hands/body.
          const pose = comboPose ?? MELEE_COMBO_SEQUENCES.punch[0];
          const heavy = def.twoHanded ? 1 : 0;
          const reach =
            TARGET_BODY_H *
            (pose?.motion === "jab" ? 0.48 : 0.55 + 0.25 * heavy);
          const wind = pose?.timing.activeStart ?? 0.1;
          const imp = pose?.timing.activeEnd ?? CHOP_IMPACT_FRAC;
          const follow = pose?.timing.followEnd ?? 0.44;
          const direction = poseDirection < 0 ? -1 : 1;
          let th = aimLocal; // fist direction from the shoulder
          let r = 0; // fist extension
          let drive = 0; // 0..1 body-commitment envelope
          let lateral = 0;
          if (pose?.motion === "jab") {
            if (tt < wind) {
              const p = tt / wind;
              r = reach * (-0.14 - 0.12 * p); // compact outside chamber
              lateral = TARGET_BODY_H * 0.08 * p;
              drive = 0.18 * p;
            } else if (tt < imp) {
              const p = (tt - wind) / (imp - wind);
              const e = 1 - (1 - p) ** 3;
              r = reach * (-0.26 + 1.26 * e);
              lateral = TARGET_BODY_H * 0.08 * (1 - e);
              drive = 0.18 + 0.72 * e;
            } else if (tt < follow) {
              r = reach;
              drive = 0.9;
            } else {
              const p = (tt - follow) / (1 - follow);
              const e = p * (2 - p);
              r = reach * (1 - 1.14 * e); // retract to outside guard, not neutral
              lateral = -TARGET_BODY_H * 0.08 * e;
              drive = 0.9 * (1 - e) + 0.12 * e;
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
              th =
                aimLocal +
                direction * hook * (-1 + (haymaker ? 1.5 : 1.35) * e);
              r = reach * (0.32 + 0.68 * e);
              drive = 0.3 + 0.7 * e;
            } else if (tt < follow) {
              const p = (tt - imp) / (follow - imp);
              th =
                aimLocal +
                direction *
                  hook *
                  (haymaker ? 0.5 + 0.16 * p : 0.35 + 0.12 * p);
              r = reach * (1 - 0.12 * p);
              drive = 1 - 0.12 * p;
            } else {
              const p = (tt - follow) / (1 - follow);
              const e = p * (2 - p);
              const hold = haymaker && heavy ? 0.72 : 0.22;
              th =
                aimLocal +
                direction *
                  hook *
                  ((haymaker ? 0.66 : 0.47) * (1 - e) + hold * e);
              r = reach * (0.88 * (1 - e) + 0.16 * e);
              drive = 0.88 * (1 - e) + (haymaker ? 0.3 : 0.18) * e;
            }
          }
          weaponAngle = th; // the fist leads along its own travel
          const ox = Math.cos(th) * r - Math.sin(aimLocal) * lateral;
          const oy = Math.sin(th) * r + Math.cos(aimLocal) * lateral;
          const offUsesBack =
            pose?.hand === "off" &&
            (this.weapons.length > 1 || def.id === "fists");
          if (offUsesBack) {
            backWeaponAngle = th;
            weaponAngle = restA;
            this.swingBackOffX = ox;
            this.swingBackOffY = oy;
          } else {
            this.swingOffX = ox;
            this.swingOffY = oy;
            if (this.weapons.length > 1) backWeaponAngle = restA;
          }
          // Body: the punch comes from the HIPS — paper-twist (shoulders turning through), lean into the
          // blow, a dug-in crouch. The rear cross mirrors the lean; the finisher commits the whole frame.
          const commitScale =
            pose?.motion === "jab"
              ? 0.55
              : pose?.motion === "haymaker"
                ? 1.2
                : 0.85;
          this.body.scaleX *= 1 - (0.12 + 0.1 * heavy) * drive * commitScale;
          this.body.rotation +=
            direction *
            (0.1 + 0.09 * heavy) *
            drive *
            commitScale *
            Math.cos(aimLocal);
          this.body.y += (2.5 + 2.5 * heavy) * s * drive * commitScale;
          if (heavy || pose?.motion === "haymaker")
            this.body.scaleY *= 1 - 0.06 * drive * commitScale;
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
            if (disengage)
              lateral =
                direction * TARGET_BODY_H * 0.09 * Math.sin(Math.PI * 2 * p);
          } else if (tt < b) {
            const p = (tt - a) / (b - a);
            const e = p * p * (3 - 2 * p);
            env = -(impale ? 0.28 : 0.18) + (impale ? 1.28 : 1.18) * e;
            if (disengage)
              lateral = direction * TARGET_BODY_H * 0.035 * (1 - e);
          } else if (tt < follow) {
            env = 1; // puncture/stick beat at authored full reach
          } else {
            const p = (tt - follow) / (1 - follow);
            const e = p * (2 - p);
            const guard = direction * (impale ? -0.2 : -0.12);
            env = 1 + (guard - 1) * e;
            lateral = disengage ? -direction * TARGET_BODY_H * 0.045 * e : 0;
          }
          this.swingOffX =
            Math.cos(aimLocal) * lunge * env - Math.sin(aimLocal) * lateral;
          this.swingOffY =
            Math.sin(aimLocal) * lunge * env + Math.cos(aimLocal) * lateral;
          if (pose?.hand === "both") {
            this.swingBackOffX = this.swingOffX * 0.35;
            this.swingBackOffY = this.swingOffY * 0.35;
          }
          // §40.1 body: the fencer LUNGES behind the stab — lean into the aim + a paper-stretch of the
          // torso along the thrust (scaleX up, scaleY in), sinking slightly as the front leg plants.
          const e = Math.max(0, env);
          const commitScale = impale ? 1.35 : 1;
          this.body.rotation +=
            direction * 0.15 * e * commitScale * Math.cos(aimLocal);
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
              weaponAngle = plantA - 0.08 * e;
              this.swingOffY = TARGET_BODY_H * 0.05 * (1 - 0.25 * e);
              this.body.rotation += 0.22 - 0.04 * e;
              this.body.y += (6.5 - 1.5 * e) * s;
              this.body.scaleY *= 0.91 + 0.03 * e;
            }
          } else {
            const direction = poseDirection < 0 ? -1 : 1;
            const start =
              direction > 0
                ? aimLocal - def.swingArc * 0.55
                : aimLocal + def.swingArc * 0.5;
            const end =
              direction > 0
                ? aimLocal + def.swingArc * 0.45
                : aimLocal - def.swingArc * 0.5;
            const back = start - direction * 0.3;
            const prior =
              direction < 0
                ? aimLocal + def.swingArc * 0.45
                : aimLocal + def.swingArc * 0.545; // finisher's planted low guard
            if (tt < a) {
              const p = tt / a;
              const e = p * (2 - p);
              weaponAngle = prior + (back - prior) * e;
              const startLean = direction > 0 ? 0.18 : 0.08;
              this.body.rotation +=
                startLean + (-direction * 0.1 - startLean) * e;
            } else if (tt < b) {
              const p = (tt - a) / (b - a);
              const e = 1 - (1 - p) ** 2;
              weaponAngle = back + (end - back) * e;
              this.body.rotation += -direction * 0.1 + direction * 0.18 * e;
            } else if (tt < follow) {
              const p = (tt - b) / (follow - b);
              weaponAngle = end + direction * 0.08 * Math.sin(Math.PI * p);
              this.body.rotation +=
                direction * (0.08 + 0.025 * Math.sin(Math.PI * p));
            } else {
              weaponAngle = end; // crossed/high guard held for the next accepted cadence step
              this.body.rotation += direction * 0.08;
            }
          }
        }

        // Once grace lapses, blend every additive fake-3D contribution back to the exact resting frame.
        // Active/held poses run at 1; orbit/spin never enter comboPose and remain completely unchanged.
        if (comboPose && poseBlend < 1) {
          weaponAngle =
            idleWeaponAngle + (weaponAngle - idleWeaponAngle) * poseBlend;
          if (!Number.isNaN(backWeaponAngle))
            backWeaponAngle =
              idleWeaponAngle + (backWeaponAngle - idleWeaponAngle) * poseBlend;
          this.swingOffX *= poseBlend;
          this.swingOffY *= poseBlend;
          this.swingBackOffX *= poseBlend;
          this.swingBackOffY *= poseBlend;
          this.body.rotation =
            bodyBaseRotation +
            (this.body.rotation - bodyBaseRotation) * poseBlend;
          this.body.y = bodyBaseY + (this.body.y - bodyBaseY) * poseBlend;
          this.body.scaleX =
            bodyBaseScaleX + (this.body.scaleX - bodyBaseScaleX) * poseBlend;
          this.body.scaleY =
            bodyBaseScaleY + (this.body.scaleY - bodyBaseScaleY) * poseBlend;
          this.attackArtOffX *= poseBlend;
          this.attackArtOffY *= poseBlend;
          this.attackLiftPx *= poseBlend;
          this.attackScaleY = 1 + (this.attackScaleY - 1) * poseBlend;
          this.weaponLengthScale = 1 + (this.weaponLengthScale - 1) * poseBlend;
          this.attackShadowX *= poseBlend;
          this.attackShadowY *= poseBlend;
          this.attackShadowRotation *= poseBlend;
          this.attackShadowScaleX =
            1 + (this.attackShadowScaleX - 1) * poseBlend;
          this.attackShadowScaleY =
            1 + (this.attackShadowScaleY - 1) * poseBlend;
          this.attackShadowAlpha = 1 + (this.attackShadowAlpha - 1) * poseBlend;
          this.attackGripBlend *= poseBlend;
          this.attackHandSpacing =
            TARGET_BODY_H * 0.42 +
            (this.attackHandSpacing - TARGET_BODY_H * 0.42) * poseBlend;
          if (poseBlend < 0.5) this.attackWeaponDepth = 0;
        }
      }
    }
    // Brace overrides the swing: raise the weapon toward a near-horizontal block (business end up).
    if (brace > 0) {
      ownFront = 1;
      ownBack = 1;
      ownFeet = 1;
      const guard = -0.2; // near-horizontal, tipped slightly up = a raised guard
      weaponAngle += (guard - weaponAngle) * brace;
    }
    if (this.weaponDef?.twoHanded) {
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
      Math.min(
        JIGGLE_SIZE_FREQ_MAX,
        (this.baseScale || 1) ** JIGGLE_SIZE_FREQ_POWER,
      ),
    );
    const excitationScale =
      (MOVE_SPEED * JIGGLE_SIGNAL_IMPULSE_HZ * springDtS) /
      (this.baseScale || 1);
    for (const hnd of this.hands) {
      const armPh = legPh + (hnd.front ? 0 : Math.PI); // arms out of phase with each other + the legs
      const swingX = Math.cos(armPh) * s * 8 * gait; // §MADNESS bigger fore-aft arm swing with the walk
      const bobY = Math.abs(Math.sin(legPh)) * s * 2 * gait; // a little vertical with each footfall
      const idleY =
        Math.sin(t * 2 + (hnd.front ? 0 : 1.3)) * s * 2.5 * (1 - gait); // breathing when idle
      // §MADNESS loose, dangly arms — a big inertia trail so the hands swing behind + overshoot the body on
      // every speed/direction change (the flash-animation follow-through), then settle.
      const trailX = -lagX * this.facing * s * 36;
      const trailY = -lagY * s * 30;
      let hx = hnd.ox + swingX;
      let hy = hnd.oy + bobY;
      if (!PROCEDURAL_JIGGLE) {
        hx += trailX;
        hy += idleY;
        hy += trailY;
      }
      if (
        hnd.front &&
        anim.isSelf &&
        Math.abs(anim.aimX) + Math.abs(anim.aimY) > 0.01
      ) {
        hx += anim.aimX * this.facing * reach; // aim reach is DIRECT (no spring) so the barrel tracks true
        hy += anim.aimY * reach;
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
      if (PROCEDURAL_JIGGLE) {
        const own = hnd.front ? ownFront : ownBack;
        // Orbit and the rear 2H grip have authoritative late writers; synchronize at those final seams below.
        const deferToConstraint =
          this.orbitT >= 0 || (!hnd.front && !!this.weaponDef?.twoHanded);
        if (!deferToConstraint) {
          const holdsWeapon = hnd.front
            ? this.weapons.length > 0
            : this.weapons.length > 1;
          const inertia = holdsWeapon
            ? JIGGLE_WEAPON_HAND_INERTIA
            : JIGGLE_FREE_HAND_INERTIA;
          const rolePhase = this.phase * Math.PI * 2 + (hnd.front ? 0.7 : 2.9);
          const idleMix = 1 - gait;
          const equilibriumX =
            Math.sin(t * Math.PI * 2 * 0.57 + rolePhase) *
            JIGGLE_HAND_IDLE_X *
            idleMix;
          const equilibriumY =
            Math.sin(t * Math.PI * 2 * 1.13 + rolePhase * 1.7) *
            JIGGLE_HAND_IDLE_Y *
            idleMix;
          let impulseX =
            -springSignalX * this.facing * excitationScale * inertia;
          let impulseY = -springSignalY * excitationScale * inertia;
          if (turnTriggered) {
            impulseX += this.turnDirX * this.facing * JIGGLE_TURN_HAND_KICK;
            impulseY += this.turnDirY * JIGGLE_TURN_HAND_KICK;
          }
          if (landed) impulseY += JIGGLE_LAND_HAND_KICK;
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
      hnd.img.x = hx;
      hnd.img.y = hy;
    }

    // Two-handed grip: place the back hand UP the haft from the front grip (along the weapon).
    // §40: skipped while an ORBIT slash is live — the orbit pass below owns both hands.
    if (this.weaponDef?.twoHanded && this.orbitT < 0) {
      const front = this.hands.find((h) => h.front);
      const back = this.hands.find((h) => !h.front);
      if (front && back) {
        const haft = this.attackHandSpacing;
        back.img.x = front.img.x + Math.cos(weaponAngle) * haft;
        back.img.y = front.img.y + Math.sin(weaponAngle) * haft;
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
      const idle = Math.sin(t * 2.6 + i) * s * 3.5 * (1 - gait);
      const trailX = -lagX * this.facing * s * 20; // §MADNESS looser foot drag on a speed/direction change
      const trailY = -lagY * s * 12;
      let fy = ft.oy - Math.max(0, Math.sin(ph)) * s * 19 * gait;
      let fx = ft.ox + Math.cos(ph) * s * 10 * gait;
      if (!PROCEDURAL_JIGGLE) {
        fy += idle;
        fy += trailY;
        fx += trailX;
      }
      if (PROCEDURAL_JIGGLE) {
        const inertia = planted
          ? JIGGLE_FOOT_PLANT_INERTIA
          : JIGGLE_FOOT_AIR_INERTIA;
        const rolePhase = this.phase * Math.PI * 2 + i * 2.1 + 4.3;
        const idleMix = 1 - gait;
        const equilibriumX =
          Math.sin(t * Math.PI * 2 * 0.73 + rolePhase) *
          JIGGLE_FOOT_IDLE_X *
          idleMix;
        const equilibriumY =
          Math.sin(t * Math.PI * 2 * 1.37 + rolePhase * 1.3) *
          JIGGLE_FOOT_IDLE_Y *
          idleMix;
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
        ? Math.cos(ph) * 0.14 * gait - (ft.jx / JIGGLE_FOOT_MAX_X) * 0.18
        : Math.cos(ph) * 0.14 * gait + lagX * this.facing * 0.18; // pivot + lean into accel
    }

    // Weapon(s): held in hand at the angle computed above (upright at rest → chop on swing).
    for (let i = 0; i < this.weapons.length; i++) {
      const w = this.weapons[i];
      if (!w) continue;
      const base = w.baseScale / (this.baseScale || 1); // fixed on-screen weapon size (§29)
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
          if (behind) this.root.moveBelow(w.img, this.body);
          else this.root.moveAbove(w.img, this.body);
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
        const aimLocal = Math.atan2(
          Math.sin(aimW),
          Math.cos(aimW) * this.facing,
        );
        // The aim's azimuth on the GROUND circle (un-squash the screen direction).
        const azAim = Math.atan2(Math.sin(aimLocal) / SQ, Math.cos(aimLocal));
        const tt = this.orbitT;
        let th: number;
        if (this.orbitSpin) {
          // §40.3 WHIRLWIND: full revolutions matching the weapon's full-circle swingArc (2π per turn) —
          // the visual blade edge sweeps exactly what the server's swept damage does. Starts at the aim.
          // §41 SEAMLESS SPAM: a fresh spin eases in then runs LINEAR (constant whirl, no settle-out); a
          // CHAINED spin (spammed/held trigger) is pure linear — since each spin is integer revolutions, the
          // next one starts exactly where this one ends, angle- AND speed-continuous. One endless whirlwind.
          const a = 0.18; // ease-in fraction (C1-continuous into the linear run)
          const e = this.swingChained
            ? tt
            : tt < a
              ? (tt * tt) / (a * (2 - a))
              : (2 * tt - a) / (2 - a);
          const turns = Math.max(1, Math.round(def.swingArc / (Math.PI * 2)));
          th = azAim + turns * Math.PI * 2 * e;
        } else {
          const e = tt * tt * (3 - 2 * tt); // smoothstep — wind in, whip through, settle out
          const windup = 1.5; // start this far behind the damage arc…
          const follow = 0.9; // …and carry through past it
          th =
            azAim -
            def.swingArc / 2 -
            windup +
            (def.swingArc + windup + follow) * e;
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
          back.img.setPosition(
            gx + ux * haft,
            gy + uy * haft - TARGET_BODY_H * 0.05,
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
        // §40.1/§40.3 the BODY spins the swing (paper-character posing, additive on the frame's base).
        // §41 spins HOLD the whirl to the very end (each revolution set lands facing-normal, so there's no
        // pop) — and a CHAINED spin skips the entry ramp entirely, keeping the body whirling through spam.
        const spinT = this.orbitSpin
          ? this.swingChained
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
            (Math.abs(c) < 0.18 ? 0.18 : Math.abs(c)) *
              (c < 0 ? -1 : 1) *
              spinT +
            (1 - spinT); // blend the whirl in/out so entry/exit don't pop
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
          if (behind) this.root.moveBelow(w.img, this.body);
          else this.root.moveAbove(w.img, this.body);
        }
        continue;
      }
      // Orbit just ended → restore the weapon above the body once.
      if (this.orbitBehind && this.orbitT < 0) {
        this.orbitBehind = false;
        this.root.moveAbove(w.img, this.body);
      }
      const off = i === 1 ? 0.32 : 0; // dual back-knife leans a touch differently
      // §40.1 the FRONT HAND already carries swingOff (it grips the weapon through the motion) — the weapon
      // just rides its hand, so blade + both hands travel together.
      w.img.setPosition(w.hand.img.x, w.hand.img.y);
      w.img.rotation =
        (i === 1 && !Number.isNaN(backWeaponAngle)
          ? backWeaponAngle
          : weaponAngle) + off;
      // Fixed on-screen weapon size: counter the rig's baseScale (characterScale/tough size-up) so the same
      // weapon reads the SAME size in every hand — the root mirror still flips it for facing.
      w.img.setScale(base * this.weaponLengthScale, base * this.attackScaleY);
      if (i === 0 && this.attackWeaponDepth !== 0) {
        const behind = this.attackWeaponDepth < 0;
        if (behind !== this.orbitBehind) {
          this.orbitBehind = behind;
          if (behind) this.root.moveBelow(w.img, this.body);
          else this.root.moveAbove(w.img, this.body);
        }
      }
    }

    // §5 jump hop was integrated at frame start so touchdown could excite springs; final art lift stays last.
    // After every part is positioned, lift the whole rig's ART up the arc. Feet lift most (they leave the
    // ground), so the silhouette reads as "off the ground" rather than just sliding up.
    // §33 the JUMP hop plus the permanent COLOSSUS lower-body lift both raise the art (never the shadow).
    const lift = this.hopPx + this.baseLift + this.attackLiftPx;
    if (
      lift > 0.01 ||
      Math.abs(this.attackArtOffX) > 0.01 ||
      Math.abs(this.attackArtOffY) > 0.01
    ) {
      for (const p of this.parts) {
        p.x += this.attackArtOffX;
        p.y += this.attackArtOffY - lift;
      }
      for (const w of this.weapons) {
        w.img.x += this.attackArtOffX;
        w.img.y += this.attackArtOffY - lift;
      }
      // A touch of squash relief at the apex sells the leap (body stretches up) — from the JUMP only.
      if (this.hopPx > 0.01)
        this.body.scaleY *= 1 + Math.min(0.12, this.hopPx / 300);
    }
    if (this.attackScaleY !== 1) {
      for (const p of this.parts) p.scaleY *= this.attackScaleY;
    }
    if (this.landSquash > 0.01) this.body.scaleY *= 1 - 0.14 * this.landSquash; // squash on touchdown
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
      const weaponRotation = paperPopRotation(
        weaponElapsed,
        this.spawnDurationMs,
      );
      for (const weapon of this.weapons) {
        weapon.img.scaleX *= weaponScaleX;
        weapon.img.scaleY *= weaponScaleY;
        weapon.img.rotation += weaponRotation;
      }
    }
    // §5/§20 the grounded shadow shrinks + fades as the rig rises, so height reads as altitude (the gap
    // between the lifted art and the planted shadow). The shadow itself never lifts.
    const shrink = Math.max(0.42, 1 - this.hopPx / 420);
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
      .setAlpha(shadowAlpha * shrink * this.attackShadowAlpha);
  }
}
