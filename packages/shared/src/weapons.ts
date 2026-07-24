/**
 * Weapon roster + definitions (§9/§10). A first slice of the proving-ground weapon framework —
 * data-driven stats the server uses for the authoritative swing, and display params the client
 * uses to render + animate the weapon in hand. PURE data (no engine/network types). Replaces
 * the hardcoded "fists" placeholder; fists remain as the empty-handed fallback.
 */
import {
  FISTS_COOLDOWN,
  FISTS_DAMAGE,
  FISTS_HALF_ARC,
  FISTS_RANGE,
  GUN_RECOIL_BASELINE,
  GUN_RECOIL_IMPULSE,
  IMPULSE_MAX,
  MAX_PLAYERS,
  REZ_RADIUS,
} from "./constants.js";
import { makeRng } from "./rng.js";
import {
  transformWeaponArtPoint,
  type WeaponAffineTransform,
  type WeaponArtMuzzleDefinition,
  type WeaponArtMuzzlePoint,
  weaponArtMuzzlePointsForShot,
  weaponSpriteTransform,
} from "./weapon-muzzle.js";
import { WEAPON_ART_MUZZLES } from "./weapon-muzzles.generated.js";
import { GENERATED_WEAPON_TIERS } from "./weapon-tiers.generated.js";
import { GENERATED_WEAPONS } from "./weapons-expansion.generated.js";

/** Driftblade-line silhouette lane consumed by the stance-by-size flourish wave. This is intentionally
 * more expressive than the legacy S/M/L/XL packing tag: two XL blades can now distinguish a great katana
 * from the deliberately absurd colossal outlier without teaching the rig weapon ids. */
export type WeaponSizeClass = "short" | "standard" | "long" | "great" | "colossal";
/** B20's authored, descriptive power band. It never mutates a weapon's combat stats. */
export type WeaponTier = 1 | 2 | 3 | 4 | 5;

/** V3G catalog laws. Authored tags are the only membership source used by presentation code. */
export type GunHandlingTag = "bolt" | "break" | "lever" | "pump" | "pistol" | "revolver";

/** Normalized point in the weapon sprite's own unmirrored 0..1 bounds. */
export interface WeaponGripAnchor {
  x: number;
  y: number;
}

/** The secondary hand's physical job. Mechanism tags remain separate so, for example, a pump-action
 * riotgun can keep its hand on a vertical foregrip while still obeying the pump-after-shot law. */
export type WeaponSecondaryGripRole =
  | "under-barrel"
  | "bolt"
  | "lever"
  | "crank"
  | "pump"
  | "horizontal-foregrip"
  | "vertical-foregrip"
  | "shoulder-RPG"
  | "two-hand-rifle"
  | "shaft"
  | "handle";

export interface WeaponGripPoints {
  primary: WeaponGripAnchor;
  secondary?: WeaponGripAnchor & { role: WeaponSecondaryGripRole };
}

/** Registered two-piece break-action art. The receiver remains on the primary grip while part 2 pivots
 * around this source-pixel-normalized hinge. Timing is supplied by the shared break mechanism sampler. */
export interface WeaponBreakActionDef {
  hinge: WeaponGripAnchor;
  openAngleRad: number;
}

/** Presentation-only neutral hand vocabulary. Hard owners still take precedence per rendered frame. */
export type IdleHandPose =
  | "secondary-grip"
  | "mirror-guard"
  | "low-guard"
  | "casting-gesture"
  | "hip-rest"
  | "praying-mantis"
  | "crane-guard";

/** Planted lower-body profiles are independent from the facing-side hand rule. */
export type IdleFootPose = "loose-plant" | "combat-plant" | "wide-plant" | "crane-one-leg";

export interface WeaponPoseLanguageDef {
  idle?: IdleHandPose;
  feet?: IdleFootPose;
}

/** Shared fallback because render mounting and authoritative muzzle reach must resolve the same pivot. */
export const DEFAULT_TWO_HAND_GUN_GRIPS: Readonly<WeaponGripPoints> = Object.freeze({
  primary: Object.freeze({ x: 0.3, y: 0.66 }),
  secondary: Object.freeze({ x: 0.7, y: 0.68, role: "two-hand-rifle" }),
});

export function resolvedGunGripPoints(
  definition: Pick<WeaponDef, "beam" | "gripPoints" | "gun" | "tags">,
): Readonly<WeaponGripPoints> | undefined {
  if (definition.gripPoints) return definition.gripPoints;
  if (!definition.gun && !definition.beam) return undefined;
  if (definition.tags.grip !== "2H" && definition.tags.grip !== "mounted") return undefined;
  return DEFAULT_TWO_HAND_GUN_GRIPS;
}

export type GunProjectileArt = "weapon-crop" | "generated" | "arrow" | "cannonball" | "fireball";
export const WEAPON_MUZZLE_COUNT_CAP = 7;

/** One declarative Driftblade-line identity hook. The server resolves these fields from the accepted
 * combo beat; the Drive/loot estimators price the same authored multipliers and finisher burst. */
export interface KatanaHookDef {
  kind:
    | "short-flurry"
    | "draw-opener"
    | "perfect-tempo"
    | "storm-tempo"
    | "finisher-dash"
    | "reach-crescendo"
    | "haste-break"
    | "finisher-burst"
    | "perfect-guard"
    | "colossal-release";
  summary: string;
  openerDamageMultiplier?: number;
  perfectWindowFraction?: number;
  perfectDamageMultiplier?: number;
  stackDamagePerBeat?: number;
  maxStacks?: number;
  finisherDamageMultiplier?: number;
  finisherDashImpulse?: number;
  reachPerBeat?: number;
  recoveryMultiplier?: number;
  nonFinisherDamageMultiplier?: number;
  toughFinisherMultiplier?: number;
  finisherBurst?: { radius: number; damage: number };
  perfectInvulnerabilitySeconds?: number;
}

/** First-class held beam delivery. Width is the complete damaging diameter; damage is authored per second
 * so simulation and feedback cadence cannot change throughput. V1 uses heat for staves and guns alike. */
export interface BeamDef {
  damagePerSecond: number;
  /** Readability/damage feedback cadence; a positive multiple of the shared 50ms simulation step. */
  tickRate: number;
  width: number;
  range: number;
  chargeSeconds: number;
  /** Exponential aim-follow time constant; live rotation also has a hard shared turn-rate ceiling. */
  sweepLagSeconds: number;
  overheat: {
    maxChannelSeconds: number;
    heatPerSecond: number;
    coolPerSecond: number;
    ignitionHeat: number;
    lockSeconds: number;
    restartHeat: number;
  };
  movement: {
    chargeMul: number;
    channelMul: number;
  };
  /** Server-authored fan of simultaneous damaging rays. The primary ray is always angle offset zero. */
  randomRays?: {
    count: number;
    spread: number;
  };
  /** Reusable continuous cone-stream specialization. It retains beam charge/heat/tick authority while
   * replacing the ray capsule with a widening cone and flavor-specific presentation. */
  coneStream?: {
    halfAngle: number;
    flavor: "ice" | "magma";
  };
}

export const PRISM_BEAM_MAX_RAYS = 7;
/** Per accepted cast, before Arc Split augments; keeps authored volleys inside the friendly entity budget. */
export const CAST_VOLLEY_PROJECTILE_CAP = 6;
export const FRIENDLY_BEAM_ENTITY_CAP = 32;
/** Friendly bullets share one arena-wide ceiling. A trigger admits only the remaining rows. */
export const FRIENDLY_PROJECTILE_ENTITY_CAP = 192;
/** Owner-authored random pellet fans are capped independently before the arena budget is consulted. */
export const RANDOM_GUN_PELLET_CAP = 10;

export interface ServerSeededGunPelletVolley {
  readonly requestedCount: number;
  readonly angles: readonly number[];
}

export type GunRandomPellets = Readonly<
  { min: number; max: number } & (
    | { directions: "radial" }
    | { directions: "cone"; halfAngle: number }
  )
>;

/**
 * Server-seeded random pellet descriptor. The server owns the seed and only replicates admitted projectile
 * rows; clients never predict the roll. Radial headings are absolute around the full circle; cone headings
 * are offsets about the accepted aim direction and never leave their authored half-angle.
 */
export function serverSeededGunPelletVolley(
  randomPellets: GunRandomPellets,
  seed: number,
  availableRows = RANDOM_GUN_PELLET_CAP,
): ServerSeededGunPelletVolley {
  const min = Math.max(1, Math.min(RANDOM_GUN_PELLET_CAP, Math.trunc(randomPellets.min)));
  const max = Math.max(min, Math.min(RANDOM_GUN_PELLET_CAP, Math.trunc(randomPellets.max)));
  const rng = makeRng(seed);
  const requestedCount = rng.int(min, max);
  const admitted = Math.max(0, Math.min(requestedCount, Math.trunc(availableRows)));
  const extent =
    randomPellets.directions === "cone"
      ? Math.max(0, Math.min(Math.PI, randomPellets.halfAngle))
      : Math.PI;
  return Object.freeze({
    requestedCount,
    angles: Object.freeze(Array.from({ length: admitted }, () => rng.range(-extent, extent))),
  });
}

export function expectedRandomGunPelletCount(
  randomPellets: Readonly<{ min: number; max: number }>,
): number {
  const min = Math.max(1, Math.min(RANDOM_GUN_PELLET_CAP, Math.trunc(randomPellets.min)));
  const max = Math.max(min, Math.min(RANDOM_GUN_PELLET_CAP, Math.trunc(randomPellets.max)));
  return (min + max) / 2;
}

/** Satellite rows use only the budget left after reserving one primary beam row per player. */
export function admittedPrismaticBeamRayCount(
  authoredCount: number,
  currentSatelliteRows: number,
): number {
  const requested = Math.max(1, Math.min(PRISM_BEAM_MAX_RAYS, Math.trunc(authoredCount)));
  const satelliteBudget = Math.max(
    0,
    FRIENDLY_BEAM_ENTITY_CAP - MAX_PLAYERS - currentSatelliteRows,
  );
  return 1 + Math.min(requested - 1, satelliteBudget);
}

/** Deterministic random-looking offsets keyed by a server-owned accepted attack sequence. */
export function prismaticBeamRayOffsets(count: number, spread: number, seed: number): number[] {
  const n = Math.max(1, Math.min(PRISM_BEAM_MAX_RAYS, Math.trunc(count)));
  const width = Math.max(0, spread);
  const out = [0];
  let state = (seed ^ 0x9e3779b9) >>> 0;
  for (let i = 1; i < n; i++) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    const unit = (state >>> 0) / 0xffffffff;
    let offset = (unit * 2 - 1) * width;
    if (Math.abs(offset) < width * 0.12) offset += offset < 0 ? -width * 0.12 : width * 0.12;
    out.push(offset);
  }
  return out;
}

export type WeaponEffectEmitter = "body" | "tip" | "blade";
export type WeaponEffectTiming = "active-start" | "swing-midpoint" | "impact";
export type WeaponEffectRecipeId =
  | "galvanic-blue-burst"
  | "riftglass-rainbow-volley"
  | "whispervolume-page-scatter"
  | "riftcleaver-crystal-shards"
  | "verdict-tip-procession"
  | "tombwarden-dark-slash"
  | "choir-iron-flame-slash"
  | "hangman-blood-spatter"
  | "cinderbrand-fire-slash"
  | "stormfist-blue-lunge"
  | "sermon-musical-notes"
  | "nullspike-impact-circle"
  | "quarry-quad-spatter"
  | "witherleaf-tip-spores"
  | "snakeoil-tip-sparks"
  | "gravechain-dominant-spin"
  | "hollow-harvest-circle"
  | "abyssal-whirlwind-vortex"
  | "void-caster-explosion"
  | "hexbloom-toxic-impact"
  | "cinderbrand-magma-impact"
  | "cinderchoke-fire-impact";

/** Named, reusable neutral guards. These are authored as pose-language vocabulary rather than id checks. */
export type WeaponStanceId =
  | "hasso-no-kamae"
  | "tachi-no-tori"
  | "blade-forward-high-hilt"
  | "near-ear-blade-up"
  | "two-hands-on-hilt"
  | "low-close-hilt";

/** Parameterized enemy movement status shared by direct hits and Frostquill-style ground zones. */
export interface EnemyHitStatusDef {
  kind: "slow";
  /** Multiplicative enemy movement speed while active (0.1 reads as a near-total freeze). */
  multiplier: number;
  /** Server-owned refresh duration in seconds. */
  seconds: number;
}

/** Deterministic lateral sine path shared by authoritative projectile motion and client rendering. */
export interface ProjectileWaveformDef {
  /** Peak perpendicular displacement from the straight launch ray, in world pixels. */
  amplitudePx: number;
  /** Complete twizzle cycles per second. */
  frequencyHz: number;
  /** Optional stable launch phase; zero keeps the projectile exactly on its muzzle at t=0. */
  phaseRad?: number;
}

export interface ProjectileWaveformSample {
  readonly x: number;
  readonly y: number;
}

/** Beam-ripple sine math applied to a projectile's world path. Pure so server and client cannot drift. */
export function projectileWaveformPositionAt(
  originX: number,
  originY: number,
  velocityX: number,
  velocityY: number,
  elapsedSeconds: number,
  waveform: ProjectileWaveformDef,
): ProjectileWaveformSample {
  const speed = Math.hypot(velocityX, velocityY) || 1;
  const dirX = velocityX / speed;
  const dirY = velocityY / speed;
  const phase = elapsedSeconds * Math.PI * 2 * waveform.frequencyHz + (waveform.phaseRad ?? 0);
  const launchOffset = Math.sin(waveform.phaseRad ?? 0);
  const offset = waveform.amplitudePx * (Math.sin(phase) - launchOffset);
  return {
    x: originX + velocityX * elapsedSeconds - dirY * offset,
    y: originY + velocityY * elapsedSeconds + dirX * offset,
  };
}

/** Shared server-owned ground patch. The client renders the footprint from small authored texture chunks;
 * radius is gameplay truth and never inferred from renderer geometry. */
export interface GroundZoneDef {
  trigger: "channel" | "attack" | "landing" | "impact";
  style: "nether" | "poison" | "poison-smoke" | "ice";
  initialRadius: number;
  maxRadius: number;
  growthPerSecond: number;
  lingerSeconds: number;
  damagePerSecond: number;
  /** Positive multiple of the shared 50ms room step. */
  tickRate: number;
  /** Cursor/landing placement clamp in world pixels. */
  placementRange: number;
  /** Multiplicative move speed while inside; 1 means no slow. */
  slowMultiplier?: number;
  /** Slow refresh duration applied by each authoritative zone tick. */
  slowSeconds?: number;
  /** Cosmetic ballistic lift for landing-trigger throws; server travel remains authoritative. */
  grenadeArcHeight?: number;
}

/** Reusable held-performance vocabulary. These fields describe presentation and explicitly named
 * continuous mechanics; ordinary damage geometry remains in the weapon's existing source blocks. */
export type WeaponPerformanceHold =
  | "upright"
  | "hanging-chain"
  | "drag-at-feet"
  | "steady"
  | "aim-forward"
  | "overhead"
  | "shoulder-launcher"
  | "walking-staff"
  | "one-hand-walking-staff"
  | "horn-to-face";

export type WeaponPerformanceAction =
  | "default-swing"
  | "hold"
  | "page-flip"
  | "shake"
  | "spin"
  | "recoil"
  | "lunge-punch"
  | "jab"
  | "overhead-downswing"
  | "throw-release";

export interface WeaponPerformanceDef {
  /** Stable held equilibrium resolved by the client pose-language sampler. */
  hold: WeaponPerformanceHold;
  /** Attack-time pose layered on the held equilibrium. */
  action: WeaponPerformanceAction;
  /** The pointer's held edge is meaningful between accepted discrete beats. */
  continuous?: boolean;
  /** Prevent the generic swing vocabulary from competing with this authored performance. */
  suppressSwing?: boolean;
  /** Fixed pre-contact read for a performance that must outlive the generic style anticipation. */
  windupSeconds?: number;
  /** Extra local carry clearance for oversized upright props, in final rendered pixels. */
  carryForwardPx?: number;
  /** Presentation-only forward drive layered onto accepted melee combo ownership. */
  comboForwardPx?: number;
  /** Presentation origin shift for authored weapon-motion VFX, measured along accepted aim. */
  vfxForwardPx?: number;
  /** Optional neutral carry angle in local screen radians (zero points forward). */
  carryAngleRad?: number;
  /** Sprite-art correction for a blade painted with its cutting edge trailing the semantic motion. */
  edgeLeadFlip?: boolean;
  /** Presentation-only hand lift for an over-shoulder throw, in final rendered pixels. */
  throwHeightPx?: number;
  /** Full-character forward somersault layered over the ordinary accepted melee swing. */
  frontflip?: boolean;
  /** Full hand revolutions during a thrown weapon's anticipation/draw phase. */
  preThrowRevolutions?: number;
  /** Presentation-only whole-art throwing treatment; authoritative delivery remains unchanged. */
  throwStyle?: "engaged";
  /** Reuse a shipped flourish vocabulary while retaining this weapon's ordinary pose family. */
  flourishStyle?: "pistol-end-hook";
  /** Authoritative one-hit sweep performed during a thrown weapon's accepted draw twirl. */
  preThrowDamage?: {
    damage: number;
    range: number;
  };
  /** Server-owned forward walking displacement advanced during each accepted held melee beat. */
  forwardDrift?: {
    speedPxPerSecond: number;
    durationSeconds: number;
    /** Optional authored multiplier per combo beat. Omitted keeps one identical displacement per swing. */
    comboStepMultipliers?: readonly number[];
  };
  /** Parameterized in-place motion; shared by every shake-capable hold state. */
  shake?: {
    amplitudePx: number;
    rotationRad: number;
    frequencyHz: number;
  };
  /** Authored forward displacement resolved from the accepted aim by the server at active start. */
  lunge?: {
    distancePx: number;
    /** Server-owned travel time; the displacement is advanced over this exact fixed-step window. */
    durationSeconds?: number;
    /** Damage immunity is active only while the authored lunge clock is live; it never counts as a parry. */
    invulnerable?: boolean;
    /** Defer the accepted melee/secondary impact until the collision-clamped server dash has arrived. */
    impactAtDestination?: boolean;
  };
  /** Full-circle attack geometry shared by overhead twirls, ground-plane yaw, and vertical frontflips. */
  twirl?: {
    plane: "screen-circle" | "ground-whirlwind" | "continuous-frontflip";
    pivot: "shaft-midpoint" | "grip";
    direction: "forward" | "alternate";
    /** Presentation turns per accepted beat; authoritative damage remains the authored swing arc. */
    visualRevolutions?: number;
  };
  /** Hold cadence remains server-owned; total accepted swings are `1 + floor(held/cadence)`. */
  holdScaling?: {
    cadence: "weapon-cooldown";
  };
  /** Walking-staff tip contact driven by the locomotion sampler's distance-based stride phase. */
  strideTap?: {
    amplitudePx: number;
    phaseOffset: number;
  };
  /** Held-implement source point. `spout` is the painted +X business end. */
  emitter?: "spout";
  /** Delay projectile/source punctuation until the accepted swing's impact epoch. */
  vfxAt?: "impact";
  /** Garlic-style authoritative channel centered on the wielder. */
  aura?: {
    radius: number;
    damagePerSecond: number;
    resourcePerSecond: number;
    tickRate: number;
    color: number;
    /** Optional receipt typing for an aura whose gameplay identity is narrower than the weapon element. */
    damageType?: "bio";
  };
}

/** Fan hybrid contract: an accepted melee beat keeps its normal swept-edge authority and schedules this
 * additional server-owned projectile at that beat's authored impact epoch. `damage` is the complete
 * launch payload, split evenly across `count`. */
export interface HybridProjectileDef {
  style: "cutting-gust" | "cinder-blade-cone" | "returning-arc" | "tornado";
  trigger: "each-swing" | "combo-finisher";
  /** Authored combo length used to price a finisher-only payload without presentation inference. */
  comboLength: number;
  speed: number;
  range: number;
  damage: number;
  count: number;
  spread: number;
  pierce: number;
  /** Reverse toward the living owner after this many seconds and re-arm one hit ledger. */
  returnAfterSeconds?: number;
}

/**
 * Multiple authoritative forward contacts inside one accepted melee attack. Fractions are normalized
 * against the shared swing pose, and each pulse deals `damageMultiplier` of the weapon's headline edge
 * damage. The client consumes the same impact list for its repeated extension/retraction pose.
 */
export interface RapidThrustDef {
  readonly impacts: readonly number[];
  readonly damageMultiplier: number;
}

export interface WeaponDef {
  /** Matches the installed sprite id (texture key base = `${id}:part-1`). */
  id: string;
  name: string;
  /** Authored B20 power band consumed by run-clock sampling, pack rarity, and disassembly. */
  tier: WeaponTier;
  /** Optional authored catalog lore; generated concepts retain it instead of marooning it in JSON. */
  description?: string;
  /** Driftblade-line silhouette class for stance-by-size consumers. */
  sizeClass?: WeaponSizeClass;
  /** Reusable named neutral stance resolved by the client pose-language registry. */
  stance?: WeaponStanceId;
  /** Optional presentation overrides; family defaults remain client-owned and action owners win. */
  poseLanguage?: WeaponPoseLanguageDef;
  /** Promote this authored combo's signed arc/range/timing path into server hit geometry. */
  authoritativeCombo?: boolean;
  /** Fast repeated forward contacts owned by one accepted attack rather than successive combo inputs. */
  rapidThrust?: RapidThrustDef;
  /** Server-consumed accepted-beat identity hook for the katana line. */
  katanaHook?: KatanaHookDef;
  /** Authored held/attack performance and its optional continuous mechanic. */
  performance?: WeaponPerformanceDef;
  /** Stable client recipe id plus the shared server/client origin policy for its authored effect. */
  effectRecipe?: WeaponEffectRecipeId;
  effectEmitter?: WeaponEffectEmitter;
  /** Authored cue point shared by visual accents and real secondary projectiles. */
  effectTiming?: WeaponEffectTiming;
  /** Explicitly suppress every swing/quake visual while retaining authoritative damage. */
  suppressVfx?: boolean;
  /** Status applied by each authoritative direct melee hit. */
  hitStatus?: EnemyHitStatusDef;
  /** A real projectile layered onto the accepted melee combo; never a replacement for the swept edge. */
  hybridProjectile?: HybridProjectileDef;
  /** Non-worn props that intentionally sit in front of visible hands (for example, hand-held idols). */
  renderAboveHands?: boolean;
  /** A single two-hand slot occupied by a matched worn glove on each hand. Weapon VFX may never add a
   * character-wrapping aura; accepted melee beats remain the authoritative damage source. */
  glovePair?: {
    /** Part 1 replaces both hands and part 2 replaces both feet. */
    wrapsFeet?: boolean;
  };
  /** Cursor warp replaces the ordinary attack. The server validates and originates the move, then applies
   * one arrival burst using the weapon's normal damage/scaling. */
  warp?: {
    burstRadius: number;
  };
  /** Follow-up render-fleet marker; metadata only and never a substitute for an installed sheet. */
  bespokeVfxSheet?: boolean;
  /** Damage per swing (hp). */
  damage: number;
  /** Reach of the swing arc (px). */
  range: number;
  /** Half-angle of the hit cone, each side of aim (radians). */
  halfArc: number;
  /** Seconds between swings. */
  cooldown: number;
  /** On-screen length of the weapon sprite, px (drives scale). */
  displayLength: number;
  /** Optional pre-presentation-order length used by authoritative reach and muzzle geometry. Omitted keeps
   * the ordinary WYSIWYG contract where collision follows displayLength. */
  collisionLength?: number;
  /**
   * FIXED in-world VFX size — the swing effect's radius (px). Static per weapon, authored in the
   * Weaponsmith; it is the one scalar (`S.R`) the renderer scales every layer from. §14 ruling: attack/
   * VFX size is authored directly and never follows runtime damage modifiers.
   * Omitted → {@link VFX_RADIUS_DEFAULT}. (Quake/AoE *hero* sizing is separate — see `quake.vfx.radius`.)
   */
  vfxRadius?: number;
  /** Visual sweep of the swing animation (radians). */
  swingArc: number;
  /** Optional legacy presentation-clock arc when authoritative damage is intentionally widened. */
  timingSwingArc?: number;
  /**
   * §40 which SWING ANIMATION STYLE this weapon plays (cosmetic — damage geometry is unchanged). One weapon,
   * one animation; omitted → derived from the weapon's shape: quake→chop (overhead slam), worn claws/
   * talons→pivot (the arm RAKE), other worn gauntlets/knuckles→punch (§42 the fist DRIVES — a roundhouse
   * haymaker on 2H maulers), rapier/spear→thrust (lunge along aim), two-handed→orbit (fake-3D waist orbit),
   * else→arc (the classic flat sweep). "spin" (authored-only) is the Garen-style whirlwind: the BODY whirls
   * through full revolutions (paper mirror-turns) with the blade extended — pair it with a full-circle
   * `swingArc` (2π per revolution) so the swept damage matches.
   */
  swingStyle?: "arc" | "orbit" | "chop" | "pivot" | "thrust" | "spin" | "punch";
  /** Where the grip sits along the sprite length (0 = left tip) — the in-hand pivot. */
  gripFrac: number;
  /** V3G normalized painted grip truth. Omitted preserves the legacy gripFrac/centreline rig behavior. */
  gripPoints?: WeaponGripPoints;
  /** Two-piece break-action presentation/resource contract. Requires handling:break and a two-shot gun. */
  breakAction?: WeaponBreakActionDef;
  /** Dual-wield: render a piece in EACH hand (uses sprite parts 1 & 2). */
  dual?: boolean;
  /** Two-handed: both hands grip the haft (heavy 2H swords). */
  twoHanded?: boolean;
  /** Held-render sprite override — the manifest id whose sliced parts to draw in-hand, when it differs
   *  from this weapon's `id` (e.g. a not-yet-arted weapon borrowing an existing sprite as placeholder). */
  sprite?: string;
  /** Optional same-registration held-sprite variant shown only during the authoritative firing latch. */
  firingFrame?: string;
  /** Source-PNG muzzle truth. Every launch/beam/flash consumer transforms these exact art pixels. */
  muzzle?: WeaponArtMuzzleDefinition;
  /** Melee-only source point: `muzzle` is the striking-hand centroid at the authored impact frame. */
  impactMuzzle?: true;
  /** §6 REZ effect — a swing within `radius` of a DOWNED ally REVIVES them (at REVIVE_HP_FRAC of max HP).
   *  Revival is loot: the Gravedigger's Spade is the M0 rez carrier. The weapon still does its edge damage. */
  rez?: { radius: number };
  /**
   * Thrown weapon (§10 delivery `thrown`, three-layer use-model): RMB hurls a spinning projectile
   * toward the cursor instead of a melee swing. Each throw spends a CHARGE; when charges deplete the
   * weapon goes on `refillSeconds` cooldown, then refills (no durability/break yet — POC).
   */
  thrown?: {
    /** Projectile speed, px/sec. */
    speed: number;
    /** Max travel distance before it expires, px. */
    range: number;
    /** Damage per enemy hit. */
    damage: number;
    /** Uses before the refill cooldown. */
    charges: number;
    /** Seconds to refill all charges once depleted. */
    refillSeconds: number;
    /** Enemies a single throw can cut through before vanishing. */
    pierce: number;
    /** Cosmetic ballistic lift of the own-sprite projectile; server travel remains authoritative. */
    arcHeight?: number;
    /** In-flight orientation policy for the own-sprite projectile. */
    rotation?: "spin" | "point-forward" | "barrel-roll";
    /** Enemy-to-enemy redirects remaining after the initial impact. */
    ricochetHops?: number;
    /** Maximum acquisition distance for each enemy ricochet. */
    ricochetRange?: number;
    /** Reverse course after the outbound leg, re-arm once, and fly back to the owning player. */
    returning?: true;
  };
  /** Procedural ground-AoE payload shared by channel, attack, and grenade-landing weapons. */
  groundZone?: GroundZoneDef;
  /**
   * Earthquake on swing: AoE damage to every enemy within `radius` px of the player. `vfx` is the
   * client cosmetic (§14 hero Codex skin + engine overlays) — authored in the Weaponsmith tool and
   * baked here. `image` keys a preloaded client texture; the rest are the quake-erupt mechanic params.
   */
  quake?: {
    radius: number;
    damage: number;
    vfx?: {
      image: string;
      /** §14 WYSIWYG: the painted hero's on-screen size relative to the damage hitbox. **1.0 = the visual
       *  edge EXACTLY matches the AoE radius (the default — what you see is what hits).** >1 overhangs the
       *  hitbox, <1 sits inside it; only deviate to account for transparent padding baked into the art. */
      radius: number;
      flash: number;
      dust: number;
      debris: number;
      shake: number;
    };
  };
  /**
   * §10 on-hit behavior block — CHAIN LIGHTNING. When the forward arc connects, a bolt leaps from the
   * struck enemy to the nearest not-yet-hit enemies, up to `jumps` times; link n does
   * `damage × falloff^n`. `range` caps each hop (px, center-to-center),
   * itself clamped by the global {@link CHAIN_MAX_RANGE}. Gameplay params are server-authoritative; the
   * nested `vfx` is the client cosmetic (teal jagged bolt). Per the §14 ruling, damage,
   * `jumps`, `range`, and the VFX are fixed authored values.
   */
  chainLightning?: {
    /** Extra enemies the bolt leaps to after the struck enemy. */
    jumps: number;
    /** Max distance per hop, px (center-to-center). A hop fails if no unhit enemy is within range. */
    range: number;
    /** Base damage of the first link, before falloff. */
    damage: number;
    /** Per-link damage multiplier; link n does `damage × falloff^n`. 1 = no falloff. */
    falloff: number;
    vfx?: {
      /** lerpHue index 0..1 → bolt tint (0.5 ≈ teal/cyan, the sword accent). */
      color: number;
      /** Jag amplitude (perpendicular jitter as a fraction of segment length). */
      jag: number;
      /** Bolt lifetime, ms (flicker + fade). */
      life: number;
    };
  };
  /**
   * §10/§14 on-swing SCATTER SHOT — flings `count` REAL server projectiles in a cone toward aim, each
   * a WYSIWYG damage source (the magma you see is the magma that hits). Each projectile deals `damage`
   * on a direct hit and, on death (impact / `range` / arena edge), detonates an `explode` AoE. Promotes
   * the old cosmetic-only `magma-scatter` VFX into a real mechanic (Wyrmtooth). Per §14 the cone, size,
   * radius, and per-source damage are fixed authored values.
   */
  scatter?: {
    /** Projectiles flung per swing. */
    count: number;
    /** Cone half-angle (radians) the projectiles spread across, centred on aim. */
    spread: number;
    /** Server-owned heading policy. Radial random samples every shard independently across 360 degrees. */
    aim?: "cone" | "radial-random";
    /** Projectile speed, px/sec. */
    speed: number;
    /** Travel distance before a projectile expires (and explodes), px. */
    range: number;
    /** Direct-hit damage per projectile. */
    damage: number;
    /** Enemies a single projectile damages before it dies + explodes (default 1 → one direct hit). */
    pierce?: number;
    /** AoE detonation when a projectile dies (the "explosion"). Omitted → projectiles don't blast. */
    explode?: {
      /** Blast radius, px (FIXED — §14; the client renders an explosion of exactly this size). */
      radius: number;
      /** AoE damage. */
      damage: number;
    };
  };
  /**
   * §38 CASTER delivery — the caster-class signature mechanic. RMB conjures a piercing ARCANE BOLT down aim
   * on a flat COOLDOWN (no magazine/reload, unlike a gun; ranged, unlike melee). The bolt tears through the
   * whole line of enemies (`pierce`). Its size, speed, and damage are fixed authored values.
   */
  cast?: {
    /** Damage per accepted cast. Authored volleys split this total across their bolts. */
    damage: number;
    /** Bolt speed, px/sec (slower + bigger than a bullet, so it reads "arcane", not "gunfire"). */
    speed: number;
    /** Travel distance before the bolt expires, px. */
    range: number;
    /** Flat cooldown between casts, sec (the pacing lever — there is no ammo). */
    cooldown: number;
    /** Enemies a single bolt tears through before dying (default 99 = pierces the whole line). */
    pierce?: number;
    /** The client bullet-kind for the bolt's look (e.g. "orb"). */
    bulletKind: string;
    /** Bounded simultaneous fan; `spread` is its half-angle around the accepted server aim. */
    volley?: {
      count: number;
      spread: number;
    };
    /** Server/client shared sine path. The server moves and collides on this curve; the client samples it. */
    projectileWaveform?: ProjectileWaveformDef;
    /** Small AoE payload applied when each authored bolt expires or makes its final contact. */
    explode?: {
      radius: number;
      damage: number;
    };
  };
  /** Charge, ignite once, then sustain one server-authoritative swept capsule until release/overheat. */
  beam?: BeamDef;
  /**
   * §9/§10/§15 GUN delivery — RMB fires bullets down-barrel on a fire-rate cadence, spending AMMO from a
   * magazine that RELOADS when empty (the charges/maxCharges readout doubles as the ammo counter). Each
   * gun has its own bullet feel + muzzle flash (`bulletKind`/`muzzle`). Server-authoritative projectiles
   * (WYSIWYG): the bullet you see is the bullet that hits. Per §14 size, spread, blast, and damage
   * are fixed authored values.
   */
  gun?: {
    /** Damage per bullet (per pellet for spread guns). */
    damage: number;
    /** Bullet speed, px/sec. */
    projectileSpeed: number;
    /** Travel distance before a bullet expires, px. */
    range: number;
    /** Seconds between shots (the fire-rate cooldown). */
    fireRate: number;
    /** Ordered rounds emitted by one accepted trigger, separated by a server-authoritative interval. */
    burst?: {
      count: number;
      intervalSeconds: number;
    };
    /** Bullets per trigger pull — >1 = a shotgun SPREAD volley (one ammo spends all pellets). Default 1. */
    pellets?: number;
    /** Server-seeded pellet count/headings. Mutually exclusive with fixed `pellets`. */
    randomPellets?: GunRandomPellets;
    /** Cone half-angle (radians): pellet spread for shotguns, or muzzle inaccuracy for autos. Default 0. */
    spread?: number;
    /** Enemies a single bullet cuts through before dying (default 1). */
    pierce?: number;
    /** Wall RICOCHETS before the bullet expires (reflects off arena edges). Default 0. */
    bounces?: number;
    /** Magazine size — shots (trigger pulls) before a reload. Mirrors `maxCharges`. */
    magazine: number;
    /** Reload time, sec, when the magazine empties. */
    reloadSeconds: number;
    /** Client bullet visual: "slug" | "pellet" | "tracer" | "nail" | "ricochet". */
    bulletKind: string;
    /** Authored in-flight identity; own-sprite crops resolve through the checked-in client registry. */
    projectileArt?: GunProjectileArt;
    /** Client-only in-flight projectile scale. Never enters the fixed server hit radius. */
    projectileVisualScale?: number;
    /** Server-authored ballistic lift descriptor and flight clock; clients render this exact arc. */
    arcHeight?: number;
    /** Client muzzle-flash style: "heavy" | "boom" | "rapid" | "punch" | "spark". */
    muzzle: string;
    /** Muzzle/bullet tint (hex). Omitted → a default hot orange. */
    muzzleColor?: number;
    /** Explicit in-flight projectile tint. The server serializes it into the generic projectile kind. */
    projectileColor?: number;
    /** Recoil camera-kick intensity per shot (heavy slugs punch, the gatling barely buzzes). ~0.0006–0.004. */
    recoil?: number;
    /** Server-only body displacement multiplier. Does not amplify camera or held-pose shake. */
    userKnockbackMultiplier?: number;
    /** Presentation recipe: an expanding sonic ring at every authoritative launch origin. */
    sonicBoomRing?: boolean;
    /** AoE on bullet death (explosive rounds). Omitted → bullets don't blast. */
    explode?: {
      radius: number;
      damage: number;
    };
  };
  /** §10 structured tag taxonomy (metadata, kept from creation; drives art/VFX reuse + filters). */
  tags: {
    grip: "1H" | "2H" | "dual" | "mounted";
    size: "S" | "M" | "L" | "XL";
    delivery: string;
    fireMode: string;
    element: string;
    classPool: "melee" | "ranged" | "caster";
    family: string;
    rangeBand: "close" | "mid" | "long";
    scaling: string[];
    /** Authored V3G law membership; consumers must not maintain weapon-id allowlists. */
    handling?: GunHandlingTag[];
  };
  /**
   * §10 max DURABILITY — melee weapons wear with use (vs `thrown` weapons, which spend charges). The
   * card shows it; the depletion/break/repair MECHANIC is not built yet (display scaffolding). Omitted
   * → the weapon doesn't track durability (e.g. casters/thrown).
   */
  durability?: number;
  /** §13 EXPANSION weapon — defined + arted but held OUT of the active roster (`WEAPON_IDS`): not in the
   *  Testing-Grounds gallery, the Q/E cycle, or the drop pool, so the +300 batch doesn't flood the game
   *  until it's curated in. Promote one by clearing this flag (or moving it to the base roster). */
  expansion?: boolean;
  /**
   * Retired content identity. Archived definitions stay in the canonical catalog so persisted instance
   * ids, receipts, art, and codegen references never dangle, but every acquisition/presentation roster
   * must treat them as inactive. Owned instances are converted to money by the join migration.
   */
  archived?: boolean;
}

/** Generator/base authoring shape before the one catalog tier registry is joined. */
export type WeaponDefSource = Omit<WeaponDef, "tier">;

/** Damage-scaling letter grade (§10). */
export function weaponHasHandlingTag(weapon: WeaponDef | undefined, tag: GunHandlingTag): boolean {
  return weapon?.tags.handling?.includes(tag) === true;
}

/** Complete deterministic held-sprite pose inputs shared by authority and the live rig. */
export interface WeaponMuzzlePose {
  x: number;
  y: number;
  aimX: number;
  aimY: number;
  /** Complete rig/root scale. */
  renderScale?: number;
  /** Optional selected held-copy index for an authored multi-part weapon. */
  salvoIndex?: number;
  /** Physical hand whose final held-sprite pose is being transformed. */
  hand?: 0 | 1;
  /** Milliseconds since the previous round's visual kick; zero is the instantaneous shot edge. */
  recoilElapsedMs?: number;
  /** Hand that received that kick. */
  recoilHand?: 0 | 1;
  /** Paper-card facing. When omitted, authority derives it from horizontal aim. */
  facing?: -1 | 1;
}

export const WEAPON_MUZZLE_RECOIL_MS = 140;
export const AUTHORED_DUAL_GUN_VERTICAL_SPLIT_BODY_FRAC = 0.085;
export const AUTHORED_DUAL_GUN_VERTICAL_SPLIT_MS = 220;
const WEAPON_POSE_BODY_HEIGHT = 76;

export interface WeaponMuzzleGripOffset {
  x: number;
  y: number;
}

interface WeaponMuzzleHandAnchor {
  x: number;
  y: number;
  aimReach: number;
}

const MUZZLE_HAND_ANCHORS = {
  pistol: {
    lead: { x: 0.22, y: -0.08, aimReach: 0.025 },
    off: { x: 0.15, y: -0.06, aimReach: 0.02 },
  },
  "long-gun": {
    lead: { x: 0.15, y: -0.12, aimReach: 0.02 },
    off: { x: 0.1, y: -0.105, aimReach: 0.015 },
  },
  scattergun: {
    lead: { x: 0.15, y: -0.085, aimReach: 0.018 },
    off: { x: 0.1, y: -0.065, aimReach: 0.014 },
  },
  "rapid-gun": {
    lead: { x: 0.2, y: -0.085, aimReach: 0.022 },
    off: { x: 0.14, y: -0.07, aimReach: 0.018 },
  },
  launcher: {
    lead: { x: 0.14, y: -0.12, aimReach: 0.015 },
    off: { x: 0.09, y: -0.105, aimReach: 0.012 },
  },
  "shoulder-launcher": {
    lead: { x: -0.08, y: -0.32, aimReach: 0.008 },
    off: { x: 0.04, y: -0.23, aimReach: 0.006 },
  },
  "fist-gun": {
    lead: { x: 0.28, y: -0.04, aimReach: 0.02 },
    off: { x: 0.22, y: -0.035, aimReach: 0.018 },
  },
  wand: {
    lead: { x: 0.2, y: -0.055, aimReach: 0.018 },
    off: { x: 0.14, y: -0.045, aimReach: 0.015 },
  },
  staff: {
    lead: { x: 0.13, y: 0, aimReach: 0.015 },
    off: { x: 0.08, y: 0.01, aimReach: 0.012 },
  },
  tome: {
    lead: { x: 0.14, y: -0.02, aimReach: 0 },
    off: { x: 0.1, y: -0.015, aimReach: 0 },
  },
} as const;

type WeaponMuzzleStance = keyof typeof MUZZLE_HAND_ANCHORS;

function weaponMuzzleStance(weapon: WeaponDef): WeaponMuzzleStance {
  const family = weapon.tags.family ?? "";
  const grip = weapon.tags.grip;
  const identity = `${weapon.id} ${weapon.name}`;
  const worn =
    /^(gauntlet|fist)$/i.test(family) ||
    /\b(claws?|talons?|mitts?|gloves?|vambraces?|gauntlets?|knuckles?|cestus|fists?)\b/i.test(
      weapon.name,
    );
  if (worn) return "fist-gun";
  if (
    weapon.gripPoints?.secondary?.role === "shoulder-RPG" ||
    weapon.performance?.hold === "shoulder-launcher"
  )
    return "shoulder-launcher";
  if (weapon.tags.classPool === "caster") {
    if (
      /^(?:almanac|bestiary|chapbook|codex|compendium|grimoire|ledger|manuscript|psalter|spellbook|tome)$/i.test(
        family,
      )
    )
      return "tome";
    if (/^staff$/i.test(family)) return "staff";
    return "wand";
  }
  if (weapon.gun) {
    if (
      weapon.tags.delivery === "spread" ||
      (weapon.gun.pellets ?? 1) > 1 ||
      /^(?:blunderbuss|shotgun)$/i.test(family) ||
      weaponHasHandlingTag(weapon, "pump")
    )
      return "scattergun";
    if (
      weapon.gun.explode ||
      /grenade|rocket|mortar/i.test(weapon.gun.bulletKind) ||
      /concussion-cannon/i.test(family) ||
      /\b(?:bombard|howitzer|launcher|mortar)\b/i.test(identity)
    )
      return "launcher";
    if (/^(?:lever-rifle|marksman-rifle|railgun|scrap-cannon)$/i.test(family)) return "long-gun";
    if (
      /^(?:gun|machine-pistol|nailgun)$/i.test(family) ||
      /nail/i.test(weapon.gun.bulletKind) ||
      ((grip === "1H" || grip === "dual") &&
        (/tracer/i.test(weapon.gun.bulletKind) ||
          weapon.tags.fireMode === "auto" ||
          weapon.gun.fireRate <= 0.2))
    )
      return "rapid-gun";
  }
  return grip === "1H" || grip === "dual" ? "pistol" : "long-gun";
}

/** B29 authored-pair scope. Gun-delivery crossbows, idols, and conductors intentionally lack a firearm
 * handling tag and therefore never inherit the two-gun firing silhouette. */
export function isAuthoredDualFirearm(weapon: WeaponDef | undefined): boolean {
  return (
    weapon?.dual === true &&
    weapon.tags.grip === "dual" &&
    !!weapon.gun &&
    (weaponHasHandlingTag(weapon, "pistol") ||
      weaponHasHandlingTag(weapon, "lever") ||
      weaponHasHandlingTag(weapon, "pump") ||
      weaponHasHandlingTag(weapon, "revolver"))
  );
}

/** Screen-vertical firing split shared by canonical authority and the retained client mount. An omitted
 * elapsed value is an authoritative shot-edge query; a client keeps the split through its short recovery. */
export function authoredDualGunVerticalOffset(
  weapon: WeaponDef | undefined,
  hand: 0 | 1,
  recoilElapsedMs: number | undefined,
): number {
  if (!isAuthoredDualFirearm(weapon)) return 0;
  if (
    recoilElapsedMs !== undefined &&
    (recoilElapsedMs < 0 || recoilElapsedMs >= AUTHORED_DUAL_GUN_VERTICAL_SPLIT_MS)
  )
    return 0;
  const direction = hand === 0 ? -1 : 1;
  return direction * AUTHORED_DUAL_GUN_VERTICAL_SPLIT_BODY_FRAC * WEAPON_POSE_BODY_HEIGHT;
}

/**
 * Shared deterministic grip/recoil pose. Authority evaluates it at each round's fire tick; the rig uses
 * the same result to mount the actual PNG before its art point is transformed.
 */
export function weaponMuzzleGripOffset(
  weapon: WeaponDef,
  part: number,
  pose: Pick<
    WeaponMuzzlePose,
    "aimX" | "aimY" | "facing" | "hand" | "recoilElapsedMs" | "recoilHand"
  >,
): WeaponMuzzleGripOffset {
  const hand = weapon.breakAction
    ? 0
    : weapon.dual && (weapon.muzzle?.parts.length ?? 0) > 1
      ? part === 1
        ? 1
        : 0
      : (pose.hand ?? (part === 1 ? 1 : 0));
  const aimLength = Math.hypot(pose.aimX, pose.aimY) || 1;
  const aimX = pose.aimX / aimLength;
  const aimY = pose.aimY / aimLength;
  const facing = pose.facing ?? (aimX < 0 ? -1 : 1);
  const stance = weaponMuzzleStance(weapon);
  const anchor: WeaponMuzzleHandAnchor = MUZZLE_HAND_ANCHORS[stance][hand === 0 ? "lead" : "off"];
  const elapsed = pose.recoilElapsedMs ?? 0;
  let recoilForward = 0;
  if (weapon.gun && pose.recoilHand === hand && elapsed > 0 && elapsed < WEAPON_MUZZLE_RECOIL_MS) {
    const envelope = Math.sin(Math.PI * (elapsed / WEAPON_MUZZLE_RECOIL_MS));
    const strength = Math.min(1.35, (weapon.gun.recoil ?? 0.0017) / 0.004);
    recoilForward = -WEAPON_POSE_BODY_HEIGHT * 0.045 * envelope * strength;
  }
  const anchorY =
    stance === "fist-gun"
      ? Math.max(anchor.y + aimY * anchor.aimReach, -0.06)
      : anchor.y + aimY * anchor.aimReach;
  const directAimReach = hand === 0 ? 0.1 : 0;
  return {
    x:
      facing * anchor.x * WEAPON_POSE_BODY_HEIGHT +
      aimX * (anchor.aimReach + directAimReach) * WEAPON_POSE_BODY_HEIGHT +
      aimX * recoilForward,
    y:
      anchorY * WEAPON_POSE_BODY_HEIGHT +
      aimY * directAimReach * WEAPON_POSE_BODY_HEIGHT +
      aimY * recoilForward +
      authoredDualGunVerticalOffset(weapon, hand, pose.recoilElapsedMs),
  };
}

const muzzleTransformScratch: WeaponAffineTransform = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };

/** Build the server/canonical sprite affine for one installed PNG part. */
export function weaponMuzzleTransform(
  weapon: WeaponDef,
  part: number,
  pose: Readonly<WeaponMuzzlePose>,
  out: WeaponAffineTransform = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
): WeaponAffineTransform {
  const art = weapon.muzzle;
  const dimensions = art?.parts[part] ?? art?.parts[0];
  if (!dimensions) throw new Error(`Weapon ${weapon.id} has no muzzle sprite part ${part}`);
  const renderScale = pose.renderScale ?? 1;
  const aimLength = Math.hypot(pose.aimX, pose.aimY) || 1;
  const aimX = pose.aimX / aimLength;
  const aimY = pose.aimY / aimLength;
  const grip = resolvedGunGripPoints(weapon)?.primary;
  // Worn/glove guns are drawn as fixed hand replacements with a 0.4 horizontal
  // origin. Keep that pivot in the canonical affine too; using gripFrac here
  // would shift the server muzzle by exactly 0.25 * weaponCollisionLength.
  const gripOriginX =
    grip?.x ?? (weaponMuzzleStance(weapon) === "fist-gun" ? 0.4 : weapon.gripFrac);
  const spriteScale = weaponCollisionLength(weapon) / dimensions.width;
  const gripPose = weaponMuzzleGripOffset(weapon, part, pose);
  return weaponSpriteTransform(
    {
      x: pose.x + gripPose.x * renderScale,
      y: pose.y + gripPose.y * renderScale,
      originX: gripOriginX * dimensions.width,
      originY: (grip?.y ?? 0.5) * dimensions.height,
      rotation: Math.atan2(aimY, aimX),
      scaleX: spriteScale,
      scaleY: spriteScale,
    },
    out,
  );
}

/** Authoritative art-space launch points for one accepted beat. */
export function weaponMuzzleWorldPointsForShot(
  weapon: WeaponDef,
  pose: Readonly<WeaponMuzzlePose>,
  acceptedSeq: number,
): Array<{ x: number; y: number; point: WeaponArtMuzzlePoint }> {
  if (!weapon.muzzle) throw new Error(`Weapon ${weapon.id} has no art-space muzzle`);
  const points = weaponArtMuzzlePointsForShot(weapon.muzzle, acceptedSeq, pose.salvoIndex);
  return points.map((point) => {
    const transform = weaponMuzzleTransform(weapon, point.part, pose, muzzleTransformScratch);
    const world = transformWeaponArtPoint(point, transform);
    return { x: world.x, y: world.y, point };
  });
}

/** First canonical art-space muzzle, used by single-source performance punctuation. */
export function weaponMuzzleWorldPoint(
  weapon: WeaponDef,
  pose: Readonly<WeaponMuzzlePose>,
  acceptedSeq = 1,
): { x: number; y: number } {
  const point = weaponMuzzleWorldPointsForShot(weapon, pose, acceptedSeq)[0];
  if (!point) throw new Error(`Weapon ${weapon.id} resolved an empty muzzle salvo`);
  return { x: point.x, y: point.y };
}

/** One accepted gun round's authored body-recoil magnitude. Most guns apply this to authoritative
 * locomotion and mirror it in owner prediction; presentation-only exceptions retain the same authored
 * magnitude for camera/weapon response without feeding it into the player root. */
export function gunUserRecoilFor(
  weapon: Pick<WeaponDef, "gun"> | undefined,
): Readonly<{ impulse: number; maxImpulse: number }> {
  const gun = weapon?.gun;
  if (!gun) return { impulse: 0, maxImpulse: IMPULSE_MAX };
  const displacementMultiplier = gun.userKnockbackMultiplier ?? 1;
  return {
    impulse:
      GUN_RECOIL_IMPULSE *
      ((gun.recoil ?? GUN_RECOIL_BASELINE) / GUN_RECOIL_BASELINE) *
      displacementMultiplier,
    maxImpulse: IMPULSE_MAX * Math.max(1, displacementMultiplier),
  };
}

const NO_GUN_LOCOMOTION_RECOIL = Object.freeze({ impulse: 0, maxImpulse: IMPULSE_MAX });
const PRESENTATION_ONLY_GUN_RECOIL_IDS = new Set(["x2-galvanic-overcasters"]);

/**
 * Body-motion policy for gun recoil. Galvanic Overcasters already has a complete cosmetic recoil
 * sentence (rig kick, muzzle flash, sound, and camera response); feeding each of its four 50 ms rounds
 * into locomotion made the body and its later muzzle samples chase speculative/authoritative impulses.
 * Keep the weapon response, but leave local prediction and server/remote position channels locomotion-only.
 *
 * This is deliberately a shared code policy rather than a generated catalog datum: the authored recoil
 * magnitude is still correct, and no content value changes. Both authority and prediction consume this
 * helper so the exception cannot become a client-only divergence again.
 */
export function gunLocomotionRecoilFor(
  weapon: Pick<WeaponDef, "id" | "gun"> | undefined,
): Readonly<{ impulse: number; maxImpulse: number }> {
  if (weapon && PRESENTATION_ONLY_GUN_RECOIL_IDS.has(weapon.id)) return NO_GUN_LOCOMOTION_RECOIL;
  return gunUserRecoilFor(weapon);
}

/** Two-hand orbit carries the grip this far from the authoritative player root before extending the blade.
 * SpriteRig uses `TARGET_BODY_H * 0.3` (76 * 0.3); sharing the world-space result prevents the rendered
 * business end from outrunning server reach. */
export const MELEE_TWO_HAND_GRIP_REACH = 22.8;

/** Authoritative held-art length. A presentation-only size order can preserve the prior collision datum. */
export function weaponCollisionLength(
  weapon: Pick<WeaponDef, "displayLength" | "collisionLength">,
): number {
  return weapon.collisionLength ?? weapon.displayLength;
}

/** §20 held-art melee reach: the effective hit `range` of a swept blade, in world px from the player centre.
 *  The gun bug's melee twin (playtest: "the tips of some melee weapons don't hit"): ordinary blade sprites
 *  use `displayLength`, while explicit presentation-only orders retain their prior authority in
 *  `collisionLength`. Both are scaled by the holder's rig (`characterScale`, §7), so on every character (all
 *  sit at 1.06–1.25×) the held-art edge can reach further than the FLAT authored `range` the hit test used —
 *  the point whiffs. Two corrections:
 *    1. floor the reach at the authoritative art TIP (`(1−gripFrac)×weaponCollisionLength` forward of the
 *       grip), so a weapon whose ordinary art overhangs its authored range (driftblade 320>300, coffin
 *       200>166) still hits on the tip instead of just short of it — never SHRINKS a weapon whose range
 *       already exceeds its sprite;
 *    2. scale the whole reach by the holder's `renderScale`, so a big character's longer-drawn blade hits as
 *       far as it looks. Pure + shared so the server hit test and any client preview can't drift. */
export function meleeReach(weapon: WeaponDef, renderScale = 1): number {
  const spriteTip =
    (1 - weapon.gripFrac) * weaponCollisionLength(weapon) +
    (weapon.twoHanded ? MELEE_TWO_HAND_GRIP_REACH : 0);
  return renderScale * Math.max(weapon.range, spriteTip);
}

/** One attack-beat cooldown before loot speed. An authored dual uses this one definition and affix. */
export function weaponAttackCooldown(weapon: WeaponDef): number {
  const base = weapon.gun?.fireRate ?? weapon.cast?.cooldown ?? weapon.cooldown;
  return Math.max(0.001, base * (weapon.katanaHook?.recoveryMultiplier ?? 1));
}

/** Expected single-target hybrid contribution per accepted melee beat. Returning arcs re-arm once. */
export function hybridProjectileDamagePerAcceptedBeat(weapon: WeaponDef): number {
  const hybrid = weapon.hybridProjectile;
  if (!hybrid) return 0;
  const triggerRate = hybrid.trigger === "combo-finisher" ? 1 / Math.max(1, hybrid.comboLength) : 1;
  const contactCount = hybrid.returnAfterSeconds === undefined ? 1 : 2;
  return Math.max(0, hybrid.damage) * triggerRate * contactCount;
}

/** Inclusive swing count for a continuous hold: the press itself is beat one, then one per cadence. */
export function holdScaledSwingCount(heldSeconds: number, cadenceSeconds: number): number {
  const held = Math.max(0, heldSeconds);
  const cadence = Math.max(0.001, cadenceSeconds);
  const completedCadences = Math.floor((held + cadence * 1e-9) / cadence);
  return 1 + completedCadences;
}

/** §30 v0.118 WEAPON CLASS SET-BONUS (Brotato parity #2): carrying multiple weapons of the same class
 *  (melee/ranged/caster) in your loadout escalates that class's damage — turning a 3-slot loadout into a
 *  build. Scaled to DD's small arsenal: 2-of-a-class and 3-of-a-class thresholds (vs Brotato's 2–6). */
export const SET_BONUS_2 = 0.08; // +8% class damage at 2 of a class
export const SET_BONUS_3 = 0.18; // +18% at 3 of a class

/** How many equipped weapons share `cls`. Empty/unknown ids are ignored. PURE. */
export function classCount(
  loadout: readonly string[],
  cls: WeaponDef["tags"]["classPool"],
): number {
  let n = 0;
  for (const id of loadout) if (id && WEAPONS[id]?.tags.classPool === cls) n++;
  return n;
}

/** The damage MULTIPLIER the held weapon earns from its class set-bonus, given the full equipped `loadout`
 *  (the slot weapon ids). 1 = no bonus. PURE — server folds it into held damage, client shows it. */
export function weaponSetBonus(loadout: readonly string[], heldWeaponId: string): number {
  const held = WEAPONS[heldWeaponId];
  if (!held) return 1;
  const n = classCount(loadout, held.tags.classPool);
  if (n >= 3) return 1 + SET_BONUS_3;
  if (n >= 2) return 1 + SET_BONUS_2;
  return 1;
}

/** One of a weapon's authored flat damage instances. */
export interface DamageSource {
  /** Short label, e.g. "hit" / "throw" / "quake" / "chain" / "magma" / "blast". */
  label: string;
  /** Authored flat damage. */
  base: number;
  /** How many times the source lands per use (e.g. scatter fires `count` projectiles). 1 = single. */
  count: number;
}

/**
 * Enumerate a weapon's distinct flat damage sources (§14 WYSIWYG) so the card can show each line
 * independently — the blade, the magma, the quake, etc. PURE. The primary line is the throw (thrown
 * weapons) or the melee hit (everyone else); behavior blocks add their own lines.
 */
export function weaponDamageSources(def: WeaponDef): DamageSource[] {
  const out: DamageSource[] = [];
  if (def.beam) {
    out.push({
      label: "beam DPS",
      base: def.beam.damagePerSecond,
      count: 1,
    });
  } else if (def.gun) {
    const pelletCount = def.gun.randomPellets ? 1 : Math.max(1, def.gun.pellets ?? 1);
    out.push({
      label: "shot",
      base: def.gun.damage,
      count: pelletCount * (def.gun.burst?.count ?? 1),
    });
    if (def.gun.explode) {
      out.push({
        label: "blast",
        base: def.gun.explode.damage,
        count: pelletCount * (def.gun.burst?.count ?? 1),
      });
    }
  } else if (def.thrown) {
    out.push({
      label: "throw",
      base: def.thrown.damage,
      count: 1,
    });
    if (def.performance?.preThrowDamage) {
      out.push({
        label: "draw twirl",
        base: def.performance.preThrowDamage.damage,
        count: 1,
      });
    }
  } else {
    out.push({ label: "hit", base: def.damage, count: 1 });
  }
  if (def.quake) {
    out.push({
      label: "quake",
      base: def.quake.damage,
      count: 1,
    });
  }
  if (def.chainLightning) {
    out.push({
      label: "chain",
      base: def.chainLightning.damage,
      count: 1,
    });
  }
  if (def.scatter) {
    const sc = def.scatter;
    out.push({
      label: "magma",
      base: sc.damage,
      count: sc.count,
    });
    if (sc.explode) {
      out.push({
        label: "blast",
        base: sc.explode.damage,
        count: sc.count,
      });
    }
  }
  return out;
}

/**
 * Default fixed VFX radius (px) when a weapon omits `vfxRadius`. Calibrated for WYSIWYG with the
 * Weaponsmith preview: 74 = TARGET_BODY_H(84) × the smith's S.R/charH ratio (0.30/0.34 ≈ 0.882), so an
 * un-authored swing reads the same on-screen size in the smith and in-world. (Holds while the arena
 * camera stays at zoom 1.0 — world px == screen px.)
 */
export const VFX_RADIUS_DEFAULT = 74;

const BASE_WEAPONS: Record<string, WeaponDefSource> = {
  // §9 unarmed fallback — what you hold after DROPPING/SALVAGING a weapon, or when everything's broken.
  // No sprite (empty hands), weak short arc. Excluded from WEAPON_IDS (never in the
  // Q-cycle or the Testing-Grounds gallery).
  fists: {
    id: "fists",
    name: "Fists",
    damage: FISTS_DAMAGE,
    range: FISTS_RANGE,
    halfArc: FISTS_HALF_ARC,
    cooldown: FISTS_COOLDOWN,
    displayLength: 1,
    swingArc: 1.8,
    gripFrac: 0.5,
    vfxRadius: 40,
    tags: {
      grip: "1H",
      size: "S",
      delivery: "melee-arc",
      fireMode: "auto",
      element: "physical",
      classPool: "melee",
      family: "fist",
      rangeBand: "close",
      scaling: ["STR"],
    },
  },
  // §6/§15 #10 GRAVEWARDEN BUSTER — the stable M0 rez-carrier id presents an original heroic
  // greatblade. B8's amended action is one fixed-rate held frontflip around the pitch axis. The attack
  // still resolves the same complete-circle damage, active timing, base damage, and cadence.
  "gravediggers-spade": {
    id: "gravediggers-spade",
    name: "Gravewarden Buster",
    sprite: "gravewarden-buster",
    damage: 8,
    range: 210,
    halfArc: 0.95,
    cooldown: 0.6, // a heavy, deliberate dig
    displayLength: 164,
    swingArc: Math.PI * 2,
    timingSwingArc: 2.7,
    gripFrac: 0.1,
    twoHanded: true,
    performance: {
      hold: "steady",
      action: "spin",
      continuous: true,
      suppressSwing: true,
      twirl: {
        plane: "continuous-frontflip",
        pivot: "grip",
        direction: "forward",
        visualRevolutions: 1,
      },
      holdScaling: { cadence: "weapon-cooldown" },
    },
    durability: 90,
    rez: { radius: REZ_RADIUS }, // §6 the swing revives a downed ally in range
    tags: {
      grip: "2H",
      size: "L",
      delivery: "melee-arc",
      fireMode: "tap-charge",
      element: "physical",
      classPool: "melee",
      family: "spade",
      rangeBand: "close",
      scaling: ["STR"],
    },
  },
  "rusty-cleaver": {
    id: "rusty-cleaver",
    name: "Rusty Cleaver",
    damage: 4,
    range: 118,
    halfArc: 0.85,
    cooldown: 0.26, // inter-throw cadence
    displayLength: 76,
    swingArc: 2.6,
    gripFrac: 0.12,
    suppressVfx: true,
    // Thrown: hurl a spinning cleaver at the cursor; 3 charges, then a short refill (§10).
    thrown: {
      speed: 660,
      range: 520,
      damage: 7,
      charges: 3,
      refillSeconds: 1.5,
      pierce: 2,
      arcHeight: 124,
    },
    tags: {
      grip: "1H",
      size: "M",
      delivery: "thrown",
      fireMode: "tap-charge",
      element: "physical",
      classPool: "melee",
      family: "thrown",
      rangeBand: "mid",
      scaling: ["STR"],
    },
  },
  "tombstone-greatsword": {
    id: "tombstone-greatsword",
    name: "Tombstone Greatsword",
    durability: 90,
    damage: 11,
    range: 156,
    halfArc: 1.0,
    cooldown: 0.78,
    displayLength: 124,
    swingArc: 3.0,
    gripFrac: 0.1,
    twoHanded: true,
    suppressVfx: true,
    // The authoritative quake remains even though the owner removed its bespoke presentation.
    quake: {
      radius: 270,
      damage: 8,
    },
    tags: {
      grip: "2H",
      size: "L",
      delivery: "melee-slam",
      fireMode: "tap-charge",
      element: "physical",
      classPool: "melee",
      family: "sword",
      rangeBand: "close",
      scaling: ["STR"],
    },
  },
  // §40.3 the WHIRLWIND (Garen-spin) demonstration: swingStyle "spin" whirls the whole BODY through two
  // full revolutions with the blade extended, and the swept-edge damage matches — swingArc 4π = TWO real
  // 360° damage sweeps (the hit-set still caps each enemy at one hit per swing). Everything around you,
  // no aim required; slower cooldown pays for the coverage. Borrows the tombstone haft art for now.
  "x-sword-whirlwind": {
    id: "x-sword-whirlwind",
    name: "Dervish Greatblade",
    durability: 85,
    damage: 9, // per enemy, once per spin — the value is hitting EVERYTHING in the circle
    range: 150,
    halfArc: Math.PI, // full-circle contact fallback
    cooldown: 1.0, // a long committed spin
    displayLength: 236,
    collisionLength: 118,
    swingArc: Math.PI * 4, // TWO full revolutions of swept edge — WYSIWYG with the two-turn spin animation
    gripFrac: 0.12,
    twoHanded: true,
    swingStyle: "spin",
    tags: {
      grip: "2H",
      size: "L",
      delivery: "melee-arc",
      fireMode: "tap-charge",
      element: "physical",
      classPool: "melee",
      family: "greatsword",
      rangeBand: "close",
      scaling: ["STR", "DEX"],
    },
  },
  // The "really long sword" demonstration (§10): a Masamune-homage nodachi — an absurdly LONG, THIN
  // blade. Length comes from displayLength (320 vs the cleaver's 76), NOT from the art box; the art
  // is drawn long-and-thin so it reads as reach. Held near the base (gripFrac) so the blade extends.
  driftblade: {
    id: "driftblade",
    name: "Driftblade",
    durability: 80,
    damage: 9,
    // §14 WYSIWYG: the long nodachi visually sweeps a WIDE arc, so the hitbox matches the swing — the
    // blade and its slash VFX are ONE damage source (no 2nd part like Wyrmtooth's magma). The cone was a
    // narrow ±0.6 rad / 280px and missed dummies the blade visibly crossed; widened to ±1.0 rad and the
    // blade's reach (~300), and `vfxRadius` grown to 150 so the slash effect spans the hitbox (= what hits).
    range: 300,
    halfArc: 1.0,
    vfxRadius: 150,
    cooldown: 0.62,
    displayLength: 320,
    swingArc: 2.3,
    gripFrac: 0.05,
    // A nodachi this long is gripped with BOTH hands (back hand up the haft, §28 2H stance).
    twoHanded: true,
    tags: {
      grip: "2H",
      size: "XL",
      delivery: "melee-arc",
      fireMode: "tap-charge",
      element: "physical",
      classPool: "melee",
      family: "sword",
      rangeBand: "mid",
      scaling: ["DEX", "STR"],
    },
  },
  "twin-bowie-fangs": {
    id: "twin-bowie-fangs",
    name: "Twin Bowie Fangs",
    damage: 2.5,
    // §53 dagger-anim-panel: one-body-length lunge law — the authoritative arc must reach the full
    // visual strike point (92 left the last 8px of the lunge a lie).
    range: 100,
    halfArc: 0.7,
    cooldown: 0.18,
    // B28 owner order: double the painted pair without changing its collision/reach authority.
    displayLength: 124,
    collisionLength: 62,
    swingArc: 2.2,
    gripFrac: 0.16,
    dual: true,
    tags: {
      grip: "dual",
      size: "S",
      delivery: "melee-arc",
      fireMode: "auto",
      element: "physical",
      classPool: "melee",
      family: "fist-blade",
      rangeBand: "close",
      scaling: ["DEX", "STR"],
    },
  },
  // ── Explore swords wired into the Testing Grounds (CODE-9, 2026-06-15). Stats are first-pass by
  // archetype (tunable); displayLength matches the value authored in the Weaponsmith. VFX in-world is
  // the generic slash for now (the bespoke painted/engine VFX live in the forge until CODE-8 unifies). ──
  "x-sword-buzzsaw": {
    id: "x-sword-buzzsaw",
    name: "Buzzcutter",
    damage: 3.5,
    range: 122,
    halfArc: 1.1, // wide, grinding arc
    cooldown: 0.22, // fast, multi-hit saw
    displayLength: 100,
    swingArc: 2.8,
    gripFrac: 0.14,
    twoHanded: true,
    tags: {
      grip: "2H",
      size: "M",
      delivery: "melee-arc",
      fireMode: "auto",
      element: "physical",
      classPool: "melee",
      family: "sword",
      rangeBand: "close",
      scaling: ["STR", "DEX"],
    },
  },
  "x-sword-anchor": {
    id: "x-sword-anchor",
    name: "Drowned Anchor",
    damage: 14, // heavy, slow haymaker
    range: 172,
    halfArc: 1.1,
    cooldown: 0.95,
    displayLength: 247.5,
    swingArc: 3.1,
    gripFrac: 0.1,
    twoHanded: true,
    tags: {
      grip: "2H",
      size: "L",
      delivery: "melee-slam",
      fireMode: "tap-charge",
      element: "physical",
      classPool: "melee",
      family: "sword",
      rangeBand: "close",
      scaling: ["STR"],
    },
  },
  "rattler-sabre": {
    id: "rattler-sabre",
    name: "Rattler Sabre",
    damage: 5,
    range: 132,
    halfArc: 0.7,
    cooldown: 0.3,
    displayLength: 100,
    swingArc: 2.4,
    gripFrac: 0.12,
    tags: {
      grip: "1H",
      size: "M",
      delivery: "melee-arc",
      fireMode: "tap-charge",
      element: "physical",
      classPool: "melee",
      family: "sword",
      rangeBand: "close",
      scaling: ["DEX", "STR"],
    },
  },
  "x-sword-coffin": {
    id: "x-sword-coffin",
    name: "Reaper's Lid",
    damage: 13,
    range: 166,
    halfArc: 1.05,
    cooldown: 0.9,
    displayLength: 200,
    swingArc: 3.0,
    gripFrac: 0.1,
    twoHanded: true,
    tags: {
      grip: "2H",
      size: "L",
      delivery: "melee-slam",
      fireMode: "tap-charge",
      element: "physical",
      classPool: "melee",
      family: "sword",
      rangeBand: "close",
      scaling: ["STR"],
    },
  },
  "x-sword-railspike": {
    id: "x-sword-railspike",
    name: "Spike Driver",
    damage: 6,
    range: 112,
    halfArc: 0.8,
    cooldown: 0.34, // inter-throw cadence
    displayLength: 65,
    swingArc: 2.4,
    gripFrac: 0.12,
    // Thrown (§10): hurl a heavy piercing spike — fewer charges, harder hit than the cleaver.
    thrown: { speed: 720, range: 560, damage: 12, charges: 2, refillSeconds: 2, pierce: 3 },
    tags: {
      grip: "2H",
      size: "M",
      delivery: "thrown",
      fireMode: "tap-charge",
      element: "physical",
      classPool: "melee",
      family: "thrown",
      rangeBand: "mid",
      scaling: ["STR", "DEX"],
    },
  },
  "x-sword-neon-katana": {
    id: "x-sword-neon-katana",
    name: "Voltedge",
    durability: 70,
    damage: 5.5,
    range: 138,
    halfArc: 0.62, // tight, precise cut
    cooldown: 0.28,
    displayLength: 125,
    swingArc: 2.3,
    swingStyle: "thrust",
    gripFrac: 0.12,
    stance: "near-ear-blade-up",
    poseLanguage: { idle: "mirror-guard", feet: "wide-plant" },
    comboFamily: "thrust",
    comboVariant: "voltedge-stab",
    authoritativeCombo: true,
    comboChoreography: Object.freeze([
      Object.freeze({ primitive: "lunge" as const, intensity: 1.02 }),
      Object.freeze({ primitive: "knee-stab" as const, intensity: 1.1 }),
      Object.freeze({ primitive: "lunge" as const, intensity: 1.2 }),
    ]),
    // §10 on-hit proc (forge note): "jagged lightning on target, chain to 3 nearest, teal". The arc hit
    // seeds a bolt that leaps to 3 other nearby enemies for decaying damage. (Damage scales with DEX
    // authored flat power; jumps/range/VFX are fixed per §14.)
    chainLightning: {
      jumps: 3,
      range: 240, // ~1.7× the melee range — electric reach, not infinite (clamped by CHAIN_MAX_RANGE)
      damage: 4, // a touch under the 5.5 arc — the chain is bonus spread, not the main hit
      falloff: 0.7, // link dmg 4 / 2.8 / 1.96 — visibly decaying, still meaningful
      vfx: { color: 0.5, jag: 0.3, life: 180 }, // teal (sword accent), moderate jag, quick flicker
    },
    tags: {
      grip: "1H",
      size: "M",
      delivery: "melee-arc",
      fireMode: "tap-charge",
      element: "physical",
      classPool: "melee",
      family: "sword",
      rangeBand: "mid",
      scaling: ["DEX"],
    },
  },
  "x-sword-bone": {
    id: "x-sword-bone",
    name: "Wyrmtooth",
    // §14 WYSIWYG multi-source: the BLADE (edge) is a physical STR/DEX cut; the magma it flings + their
    // explosions are an INT-scaled caster source (so an INT build leans on the meteors, a STR/DEX build
    // on the blade). The blade scales STR C / DEX C.
    durability: 85,
    damage: 10,
    range: 150,
    halfArc: 1.0,
    cooldown: 0.72,
    displayLength: 120,
    swingArc: 3.0,
    gripFrac: 0.1,
    twoHanded: true,
    // Scatter shot (forge note: "magma balls shot out in a cluster on swing, each its own entity"):
    // 6 real magma projectiles fan out toward aim, each dealing an INT-scaled direct hit and then
    // exploding into an INT-scaled fiery AoE on impact/expiry. Cone/speed/range/blast radius are FIXED
    // (§14) — only the damage scales (off INT, independent of the STR/DEX blade).
    scatter: {
      count: 6,
      spread: 0.5, // ~±29° fan
      speed: 360,
      range: 230,
      damage: 5, // per-ball direct hit (× INT B)
      explode: {
        radius: 56, // FIXED blast size (§14); the client renders an explosion of exactly this px radius
        damage: 6, // Flat AoE per blast.
      },
    },
    tags: {
      grip: "2H",
      size: "L",
      delivery: "melee-arc",
      fireMode: "tap-charge",
      element: "physical",
      classPool: "melee",
      family: "sword",
      rangeBand: "close",
      scaling: ["STR", "DEX", "INT"],
    },
  },

  // ── GUNS (§9/§15 ranged) — RMB fires bullets on a fire-rate cadence, spending ammo from a magazine
  // that reloads when empty. Each has its own bullet feel + muzzle flash. ─────────────────────────────
  "x-gun-revolver-cannon": {
    id: "x-gun-revolver-cannon",
    name: "Revolver Cannon",
    durability: 70,
    damage: 5, // pistol-whip fallback (point-blank); the gun block does the work
    range: 72,
    halfArc: 0.5,
    cooldown: 0.5,
    displayLength: 94,
    swingArc: 1.1,
    gripFrac: 0.16,
    vfxRadius: 64,
    gun: {
      damage: 18, // a heavy slug — the decisive single-target hitter (its whole identity vs the autos)
      projectileSpeed: 900,
      range: 640,
      fireRate: 0.5, // slow, deliberate
      pierce: 1,
      magazine: 6, // six-shooter
      reloadSeconds: 1.4,
      bulletKind: "slug",
      muzzle: "heavy",
      muzzleColor: 0xffb24a,
      recoil: 0.004, // a meaty THUMP
    },
    tags: {
      grip: "1H",
      size: "M",
      delivery: "projectile",
      fireMode: "tap-charge",
      element: "physical",
      classPool: "ranged",
      family: "pistol",
      rangeBand: "long",
      scaling: ["DEX", "STR"],
      handling: ["pistol", "revolver"],
    },
  },
  // ── CASTERS (§38) — the caster class's signature weapons. RMB conjures a piercing arcane BOLT on a flat
  // cooldown (no ammo), INT-scaled, so a Caster character's auto-grown INT (§38) finally has a payoff. Art
  // borrows the 2H haft placeholder until bespoke staff/tome sprites land. ────────────────────────────────
  "x-staff-arcane-lance": {
    id: "x-staff-arcane-lance",
    name: "Arcanist's Lance",
    durability: 80,
    damage: 5, // staff-bonk fallback; the cast block is the identity
    range: 96,
    halfArc: 0.5,
    cooldown: 0.5,
    displayLength: 128,
    swingArc: 1.1,
    gripFrac: 0.12,
    gripPoints: {
      primary: { x: 0.12, y: 0.5 },
      secondary: { x: 0.4, y: 0.5, role: "shaft" },
    },
    twoHanded: true,
    vfxRadius: 60,
    cast: {
      damage: 16, // total volley payload; split three ways below so cadence DPS stays unchanged
      speed: 620,
      range: 720,
      cooldown: 0.62,
      pierce: 99, // tears through the whole line
      bulletKind: "orb",
      volley: { count: 3, spread: 0.16 },
    },
    tags: {
      grip: "2H",
      size: "L",
      delivery: "projectile",
      fireMode: "tap-charge",
      element: "arcane",
      classPool: "caster",
      family: "staff",
      rangeBand: "long",
      scaling: ["INT"],
    },
  },
  "x-staff-storm-rod": {
    id: "x-staff-storm-rod",
    name: "Stormcaller Rod",
    durability: 70,
    damage: 4,
    range: 88,
    halfArc: 0.5,
    cooldown: 0.4,
    displayLength: 116,
    swingArc: 1.0,
    gripFrac: 0.14,
    gripPoints: {
      primary: { x: 0.14, y: 0.5 },
      secondary: { x: 0.42, y: 0.5, role: "shaft" },
    },
    twoHanded: true,
    vfxRadius: 56,
    cast: {
      damage: 10, // faster, lighter bolts than the Lance
      speed: 760,
      range: 640,
      cooldown: 0.32,
      pierce: 3,
      bulletKind: "orb",
      projectileWaveform: { amplitudePx: 34, frequencyHz: 4 },
    },
    tags: {
      grip: "2H",
      size: "L",
      delivery: "projectile",
      fireMode: "auto",
      element: "shock",
      classPool: "caster",
      family: "rod",
      rangeBand: "long",
      scaling: ["INT"],
    },
  },
  "x-gun-coffin-shotgun": {
    id: "x-gun-coffin-shotgun",
    name: "Coffin Shotgun",
    durability: 60,
    damage: 6,
    range: 80,
    halfArc: 0.6,
    cooldown: 0.7,
    displayLength: 120,
    swingArc: 1.2,
    gripFrac: 0.14,
    gripPoints: {
      primary: { x: 0.24, y: 0.6 },
      secondary: { x: 0.55, y: 0.64, role: "pump" },
    },
    vfxRadius: 72,
    gun: {
      damage: 5, // per pellet — devastating up close, falls off with the spread
      projectileSpeed: 720,
      range: 360, // short-ranged
      fireRate: 0.7,
      pellets: 7, // a cone of buckshot
      spread: 0.34, // ~±19°
      pierce: 1,
      magazine: 2, // double-barrel
      reloadSeconds: 1.6,
      bulletKind: "pellet",
      muzzle: "boom",
      muzzleColor: 0xff6a2a,
      recoil: 0.0035, // BOOM
    },
    tags: {
      grip: "2H",
      size: "L",
      delivery: "spread",
      fireMode: "tap-charge",
      element: "physical",
      classPool: "ranged",
      family: "shotgun",
      rangeBand: "close",
      scaling: ["STR", "DEX"],
      handling: ["pump"],
    },
  },
  // §41 the EXPLOSIVE-round demonstration: a stubby break-action grenade gun. Slow, fat, tumbling shell;
  // weak on a direct hit — the payload is the AoE ERUPTION where it lands (gun.explode → the server's
  // detonate + the §41 element explosion composite, quake-family visuals). Fire element → fiery blast.
  "x-gun-hand-mortar": {
    id: "x-gun-hand-mortar",
    name: "Hand Mortar",
    durability: 65,
    damage: 5, // stock-whack fallback
    range: 78,
    halfArc: 0.55,
    cooldown: 0.65,
    displayLength: 104,
    swingArc: 1.1,
    gripFrac: 0.15,
    vfxRadius: 70,
    gun: {
      damage: 6, // the direct plink — the blast below is the weapon
      projectileSpeed: 470, // slow lobbed shell (readable, dodgeable)
      range: 560,
      fireRate: 0.95, // one heavy THOOMP at a time
      pierce: 1,
      magazine: 3,
      reloadSeconds: 1.8,
      bulletKind: "grenade",
      projectileArt: "generated",
      projectileVisualScale: 5,
      muzzle: "boom",
      muzzleColor: 0xffb24a,
      recoil: 0.005, // the heaviest kick in the rack
      explode: { radius: 130, damage: 15 },
    },
    tags: {
      grip: "2H",
      size: "L",
      delivery: "projectile",
      fireMode: "tap-charge",
      element: "fire",
      classPool: "ranged",
      family: "hand-cannon",
      rangeBand: "mid",
      scaling: ["STR"],
    },
  },
  "x-gun-gatling": {
    id: "x-gun-gatling",
    name: "Gatling",
    durability: 90,
    damage: 4,
    range: 76,
    halfArc: 0.5,
    cooldown: 0.4,
    displayLength: 140,
    swingArc: 1.0,
    gripFrac: 0.12,
    vfxRadius: 58,
    gun: {
      damage: 3, // tiny per-shot, but a torrent
      projectileSpeed: 780,
      range: 560,
      fireRate: 0.08, // rapid auto
      spread: 0.11, // sprays a bit — walk it onto the target
      pierce: 1,
      magazine: 50,
      reloadSeconds: 2.4, // long reload is the cost of the torrent
      bulletKind: "tracer",
      muzzle: "rapid",
      muzzleColor: 0xfff0a0,
      recoil: 0.0006, // a faint buzz — held steady so you can walk the stream onto targets
    },
    tags: {
      grip: "2H",
      size: "XL",
      delivery: "projectile",
      fireMode: "auto",
      element: "physical",
      classPool: "ranged",
      family: "gun",
      rangeBand: "mid",
      scaling: ["DEX"],
    },
  },
  "x-gun-nailgun": {
    id: "x-gun-nailgun",
    name: "Nailgun",
    durability: 80,
    damage: 4,
    range: 74,
    halfArc: 0.5,
    cooldown: 0.3,
    displayLength: 104,
    swingArc: 1.1,
    gripFrac: 0.14,
    vfxRadius: 50,
    gun: {
      damage: 5,
      projectileSpeed: 1000,
      range: 600,
      fireRate: 0.16, // brisk
      pierce: 3, // nails skewer a line of enemies
      magazine: 16,
      reloadSeconds: 1.3,
      bulletKind: "nail",
      muzzle: "punch",
      muzzleColor: 0xd6dde6,
      recoil: 0.0012,
    },
    tags: {
      grip: "1H",
      size: "M",
      delivery: "projectile",
      fireMode: "auto",
      element: "physical",
      classPool: "ranged",
      family: "nailgun",
      rangeBand: "mid",
      scaling: ["DEX", "STR"],
    },
  },
  "x-gun-ricochet-pistol": {
    id: "x-gun-ricochet-pistol",
    name: "Ricochet Pistol",
    durability: 75,
    damage: 4,
    range: 70,
    halfArc: 0.5,
    cooldown: 0.34,
    displayLength: 88,
    swingArc: 1.1,
    gripFrac: 0.16,
    vfxRadius: 56,
    gun: {
      damage: 8,
      projectileSpeed: 840,
      range: 1000, // long-lived so it can bounce and keep hunting
      fireRate: 0.34,
      pierce: 2, // tags a couple targets as it caroms
      bounces: 3, // caroms off the arena walls
      magazine: 8,
      reloadSeconds: 1.2,
      bulletKind: "spark",
      projectileArt: "generated",
      muzzle: "spark",
      muzzleColor: 0x5dd6ff,
      projectileColor: 0x3f9dff,
      recoil: 0.002,
    },
    // W4R: Venomtongue's three-hop idiom, recolored/effect-typed through this weapon's shock identity.
    // Direct single-target DPS remains the original 8 / .34; the chain is documented multi-target utility.
    chainLightning: {
      jumps: 3,
      range: 190,
      damage: 3,
      falloff: 0.75,
      vfx: { color: 0.58, jag: 0.3, life: 210 },
    },
    tags: {
      grip: "1H",
      size: "S",
      delivery: "projectile",
      fireMode: "tap-charge",
      element: "shock",
      classPool: "ranged",
      family: "pistol",
      rangeBand: "long",
      scaling: ["DEX", "LUK"],
      handling: ["pistol", "revolver"],
    },
  },
};

/** Every weapon: the hand-authored BASE roster + the codegen'd §13 EXPANSION batch (the +300, art-backed
 *  but held out of the active roster via `expansion`). Both are `WeaponDef`s, so anything keyed by id
 *  (held sprite, card art, VFX) resolves for either. */
const WEAPON_SOURCES: Record<string, WeaponDefSource> = { ...BASE_WEAPONS, ...GENERATED_WEAPONS };
export const WEAPONS: Record<string, WeaponDef> = Object.fromEntries(
  Object.entries(WEAPON_SOURCES).map(([id, weapon]) => {
    const tier = (GENERATED_WEAPON_TIERS as Readonly<Record<string, WeaponTier>>)[id];
    if (!tier) throw new Error(`Weapon ${id} has no authored tier in data/weapon-tiers.json`);
    return [id, { ...weapon, tier }];
  }),
);
for (const id of Object.keys(GENERATED_WEAPON_TIERS)) {
  if (!WEAPON_SOURCES[id]) {
    throw new Error(`Authored weapon tier references unknown catalog id ${id}`);
  }
}

// Muzzle authoring is generated from installed PNG alpha and merged into the weapon definitions once.
// Consumers receive one data object; no client/server registry join or parallel offset table exists.
for (const [weaponId, muzzle] of Object.entries(WEAPON_ART_MUZZLES)) {
  const weapon = WEAPONS[weaponId];
  if (!weapon) throw new Error(`Art-space muzzle references unknown weapon ${weaponId}`);
  weapon.muzzle = muzzle;
}
const derivingWeaponMuzzles = (
  globalThis as typeof globalThis & { __DD_GENERATING_WEAPON_MUZZLES__?: boolean }
).__DD_GENERATING_WEAPON_MUZZLES__;
for (const weapon of Object.values(WEAPONS)) {
  if (
    !derivingWeaponMuzzles &&
    (weapon.gun ||
      weapon.beam ||
      weapon.cast ||
      weapon.hybridProjectile ||
      weapon.impactMuzzle ||
      weapon.firingFrame) &&
    !weapon.muzzle
  ) {
    throw new Error(`Projectile/beam weapon ${weapon.id} has no art-space muzzle`);
  }
}

// Off-hand charge presentation is uint8. Fail authoring loudly instead of wrapping a future magazine.
for (const weapon of Object.values(WEAPONS)) {
  const charges = weapon.gun?.magazine ?? weapon.thrown?.charges ?? 0;
  if (!Number.isInteger(charges) || charges < 0 || charges > 255) {
    throw new Error(`Weapon ${weapon.id} has invalid uint8 magazine/charges: ${charges}`);
  }
}

/** The §9 unarmed-fallback weapon id (empty hands). Not part of the arsenal cycle/gallery. */
export const FISTS_WEAPON = "fists";
/** Every persisted/catalog weapon id. Runtime-only fists are intentionally not a catalog row. */
export const WEAPON_CATALOG_IDS = Object.keys(WEAPONS).filter((id) => id !== FISTS_WEAPON);
/** Retired rows remain addressable forever, but never enter acquisition or ordinary presentation pools. */
export const ARCHIVED_WEAPON_IDS = WEAPON_CATALOG_IDS.filter((id) => WEAPONS[id]?.archived);
/** The ordinary catalog surface: base + expansion, excluding archived rows. */
export const ACTIVE_WEAPON_CATALOG_IDS = WEAPON_CATALOG_IDS.filter((id) => !WEAPONS[id]?.archived);
/** ACTIVE curated arsenal (Q/E cycle) — excludes fists, expansion, and archived definitions. */
export const WEAPON_IDS = Object.keys(WEAPONS).filter(
  (id) => id !== FISTS_WEAPON && !WEAPONS[id]?.expansion && !WEAPONS[id]?.archived,
);
/** The +300 §13 expansion ids, including archived historical rows. Use ACTIVE_EXPANSION_WEAPON_IDS for UI. */
export const EXPANSION_WEAPON_IDS = Object.keys(WEAPONS).filter((id) => WEAPONS[id]?.expansion);
export const ACTIVE_EXPANSION_WEAPON_IDS = EXPANSION_WEAPON_IDS.filter(
  (id) => !WEAPONS[id]?.archived,
);
export function isActiveWeaponId(id: string): boolean {
  return id !== FISTS_WEAPON && !!WEAPONS[id] && WEAPONS[id]?.archived !== true;
}
export const DEFAULT_WEAPON = "rusty-cleaver";

/** G4 thrown-weapon wire identity. The kind carries the authored WEAPON id; clients resolve its display
 * sprite through the same `sprite ?? id` seam as the held rig. Encoding the weapon rather than today's
 * sprite keeps future placeholder-art swaps truthful without adding a projectile schema field. */
export const THROWN_PROJECTILE_KIND_PREFIX = "thrown:";

/** One resolution root for every place that displays a weapon, including borrowed §6 placeholder art. */
export function weaponDisplaySpriteId(weapon: Pick<WeaponDef, "id" | "sprite">): string {
  return weapon.sprite ?? weapon.id;
}

/** Server-side launch kind for a thrown weapon. */
export function thrownProjectileKindFor(weapon: Pick<WeaponDef, "id">): string {
  return `${THROWN_PROJECTILE_KIND_PREFIX}${weapon.id}`;
}

/** Decode current thrown kinds plus the pre-G4 cleaver kind for rolling-client/replay compatibility. */
export function thrownProjectileWeaponId(kind: string): string | undefined {
  if (kind === "cleaver") return DEFAULT_WEAPON;
  if (!kind.startsWith(THROWN_PROJECTILE_KIND_PREFIX)) return undefined;
  const weaponId = kind.slice(THROWN_PROJECTILE_KIND_PREFIX.length);
  return weaponId || undefined;
}

export function isThrownProjectileKind(kind: string): boolean {
  return thrownProjectileWeaponId(kind) !== undefined;
}

/** Client-side projectile art resolution. This is deliberately the exact held-sprite rule. */
export function thrownProjectileSpriteId(kind: string): string | undefined {
  const weaponId = thrownProjectileWeaponId(kind);
  const weapon = weaponId ? WEAPONS[weaponId] : undefined;
  return weapon ? weaponDisplaySpriteId(weapon) : undefined;
}

/** Per-weapon in-flight orientation; legacy and unspecified throws retain their authored spin. */
export function thrownProjectileRotationPolicy(
  source: string | Pick<WeaponDef, "thrown"> | undefined,
): "spin" | "point-forward" | "barrel-roll" | undefined {
  const weapon =
    typeof source === "string" ? WEAPONS[thrownProjectileWeaponId(source) ?? ""] : source;
  return weapon?.thrown ? (weapon.thrown.rotation ?? "spin") : undefined;
}

/** Next weapon in the roster (RMB/cycle), wrapping around. */
export function nextWeapon(current: string): string {
  const i = WEAPON_IDS.indexOf(current);
  return WEAPON_IDS[(i + 1) % WEAPON_IDS.length] ?? DEFAULT_WEAPON;
}

/** Previous weapon in the roster (E / back-cycle), wrapping around. */
export function prevWeapon(current: string): string {
  const i = WEAPON_IDS.indexOf(current);
  const n = WEAPON_IDS.length;
  return WEAPON_IDS[(((i < 0 ? 0 : i) - 1 + n) % n) as number] ?? DEFAULT_WEAPON;
}
