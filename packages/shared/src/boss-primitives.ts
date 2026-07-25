import { bulletWallAngles } from "./boss.js";
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  ENEMY_RADIUS,
  RING_BAND_HALF,
  TELEGRAPH_DODGE,
  TELEGRAPH_PARRYABLE,
  WORM_ERUPTION_RADIUS,
} from "./constants.js";
import { coneAngles } from "./enemies.js";
import { clamp } from "./math.js";
import type { Vec2 } from "./movement.js";
import type { Rng } from "./rng.js";

/**
 * §16 v0.109 ATTACK-PRIMITIVE LIBRARY — the composable, PURE, deterministic geometry a boss phase fires
 * (fans, rings, spirals, aimed volleys, landing zones, summons, hazards). Each primitive is a pure
 * function `(ctx) => CastPlan`: it computes the WHOLE cast ONCE at trigger time — the telegraph shapes AND
 * the payload that resolves after the windup — so the danger footprint the player reads and the hit that
 * lands share the SAME fixed world coordinates (the design's mandatory rule: never re-derive a landing
 * spot from the ~120ms-stale interpolated body). The server BossController executes the plan; the geometry
 * lives here in the purity-gated shared layer beside `bulletWallAngles`/`coneAngles`. Randomness comes ONLY
 * from the injected `ctx.rng` (a per-trigger seeded stream) — the global entropy source is never touched.
 */

/** Telegraph shape enum — mirrors `TelegraphState.shape`. Plain (non-const) enum so it survives
 *  `isolatedModules` transpilation (Vite/esbuild) and can be read at runtime by the client renderer. */
export enum TgShape {
  Circle = 0, // landing-zone / slam disc
  Ring = 1, // expanding donut (danger = the growing band)
  Cone = 2, // wedge
  Rect = 3, // beam / dash lane
  ArcSweep = 4, // rotating beam
  PointWarn = 5, // bullet-origin / summon-spot marker
}

/** Existing active-hazard values are locked; TitanSweep is the append-only flagship kind. */
export enum ActiveKind {
  Beam = 0,
  Ring = 1,
  Dash = 2,
  TitanSweep = 3,
}

/** Stable renderer tags. Flagship tags append after the Serraketh vocabulary. */
export enum BossTelegraphKindTag {
  Slam = 0,
  Hazard = 1,
  Summon = 2,
  ProjectileFlash = 3,
  Lane = 4,
  Ring = 5,
  Melee = 6,
  Quake = 7,
  Eruption = 8,
  WormSweep = 9,
  TitanSweep = 10,
  TitanCharge = 11,
}

/** One projectile the boss launches. `damage` is BASE (the controller applies the depth scale). `aimX/aimY`
 *  is a direction (need not be unit length). `kind` is the projectile visual — enemy shots are "spit"
 *  (parryable per §8; the client already draws the white parry-tell on incoming spit). */
export interface FireSpec {
  fromX: number;
  fromY: number;
  aimX: number;
  aimY: number;
  speed: number;
  damage: number;
  kind?: string;
}

/** One telegraph row spec (the controller mints the id + drives `t`). */
export interface TgSpec {
  shape: TgShape;
  x: number;
  y: number;
  a?: number;
  b?: number;
  rot?: number;
  danger?: number; // TELEGRAPH_PARRYABLE | TELEGRAPH_DODGE; default DODGE (AoE/zones are dodge-only, §8)
  kindTag?: number;
  ownerId?: string;
  castSeq?: number;
}

/** A corrosive DoT puddle to drop (reuses ZoneState). */
export interface ZoneSpec {
  x: number;
  y: number;
  radius: number;
  ttl: number;
}

/** One add to conjure. */
export interface AddSpec {
  kind: string;
  x: number;
  y: number;
}

/** A radius AoE resolved at telegraph peak: `damage` BASE (depth-scaled by the controller), `knockback` an
 *  impulse magnitude shoved radially outward from (x,y). Unparryable by §8 (landing zones are dodge-only). */
export interface AoeSpec {
  x: number;
  y: number;
  radius: number;
  damage: number;
  knockback: number;
  /** §33 FOOTFALL QUAKE: a ground shockwave you JUMP over (airborne = immune) or PARRY (negates), instead of
   *  the usual instant dodge-circle. Routed to `applyQuake` on resolve. */
  quake?: boolean;
}

/** §16 v0.109 Slice 2 — an ACTIVE HAZARD that persists after the windup, dealing continuous damage over a
 *  LIVE window while its geometry evolves (a beam sweeps, a ring expands, the boss dashes). The controller
 *  spawns one on resolve, KEEPS the telegraph row as the live danger indicator (updating its geometry each
 *  tick), hit-tests players each tick, and expires it after `duration`. Unparryable by §8 (dodge-only).
 *  Fields are interpreted per `kind` (see the primitives) — all lengths in px, angles in radians. */
export interface ActiveSpec {
  kind: number; // 0 beam · 1 ring · 2 dash
  duration: number; // seconds LIVE (after the windup)
  dps: number; // BASE damage per second (beam/ring) or one-time contact damage (dash); controller depth-scales
  x: number; // origin: beam pivot / ring centre / dash START
  y: number;
  a: number; // beam+dash length · ring maxR
  b: number; // beam+dash HALF-WIDTH · ring band half-thickness
  rot0: number; // beam start angle · dash direction · (ring: unused)
  rotEnd: number; // beam END angle (== rot0 for a static lane); ring/dash unused
  gapCenter: number; // ring safe-gap centre angle
  gapHalf: number; // ring safe-gap half-width (rad); 0 = no safe gap
  knockback: number; // dash knockback impulse
}

/** §16 v0.109 Slice 3 — a PARRYABLE melee arc (the boss duelist swing). A wedge from (x,y) toward `aim`, out
 *  to `range`, ±`halfArc`. Routed through the SAME §8 parry path as the horde duelists: i-frames NEGATE it
 *  (bump parriedSeq, feed the v0.114 parry-chain), else it deals `damage` (BASE, depth-scaled) + a shove.
 *  This is the one boss attack you PARRY rather than dodge — the marquee of the melee trio. */
/** Frozen sampled limb descriptor used by Heel Reap and the two-revolution Worldwheel. */
export interface TitanSweepSpec {
  startTick: number;
  activeStartTick: number;
  activeEndTick: number;
  endTick: number;
  originX: number;
  originY: number;
  startAngle: number;
  deltaAngle: number;
  innerRange: number;
  outerRange: number;
  halfWidth: number;
  damage: number;
  knockback: number;
  revolutions: number;
}

/** Mutable caller-owned result slot; server sinks fill it without allocating in the 20 Hz loop. */
export interface BossCounterSummary {
  threatened: number;
  answered: number;
  parried: number;
  airborne: number;
  hit: number;
  lastParrierId: string;
}

export interface MeleeArcSpec {
  x: number;
  y: number;
  aimX: number;
  aimY: number;
  range: number;
  halfArc: number;
  damage: number;
  knockback: number;
}

/** §16 v0.109 Slice 3 — a boss BLINK: on resolve the controller teleports the boss body to (x,y) before the
 *  rest of the payload lands (a slam at the same spot). Reuses no schema — it just sets boss.x/y. */
export interface TeleportSpec {
  x: number;
  y: number;
}

/** The payload a cast applies when its windup resolves. All optional; a bullet primitive uses `projectiles`,
 *  a landing zone uses `aoe`, a hazard uses `zones`, a summon uses `adds`, a beam/ring/dash uses `active`, a
 *  duelist swing uses `melee`, a blink uses `teleport` (applied FIRST, so a co-emitted aoe lands at the
 *  destination). */
export interface Emits {
  projectiles?: FireSpec[];
  zones?: ZoneSpec[];
  adds?: AddSpec[];
  aoe?: AoeSpec[];
  active?: ActiveSpec;
  melee?: MeleeArcSpec[];
  teleport?: TeleportSpec;
}

/** A single cast: the telegraphs shown DURING the windup + the payload applied WHEN it resolves. Both are
 *  computed together at trigger time so they reference identical coordinates. */
export interface CastPlan {
  telegraphs: TgSpec[];
  emits: Emits;
}

/** Everything a primitive needs, injected by the controller. `phaseTick` is a per-boss monotonic counter used
 *  by rotation primitives (spiral) so the pattern advances deterministically without hidden state. */
export interface PrimitiveCtx {
  boss: Vec2 & { kind: string; radius: number };
  targets: readonly Vec2[];
  rng: Rng;
  phaseTick: number;
  params: Record<string, number>;
}

export type BossPrimitive = (ctx: PrimitiveCtx) => CastPlan;

/** Read a numeric param with a fallback. */
function p(ctx: PrimitiveCtx, key: string, dflt: number): number {
  const v = ctx.params[key];
  return typeof v === "number" && Number.isFinite(v) ? v : dflt;
}

/** Nearest living target to the boss (falls back to "straight right" if the squad is empty). */
function aimTarget(ctx: PrimitiveCtx): Vec2 {
  let best: Vec2 | null = null;
  let bestD = Number.POSITIVE_INFINITY;
  for (const t of ctx.targets) {
    const d = (t.x - ctx.boss.x) ** 2 + (t.y - ctx.boss.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  return best ?? { x: ctx.boss.x + 1, y: ctx.boss.y };
}

const arenaClampX = (x: number): number => clamp(x, ENEMY_RADIUS, ARENA_WIDTH - ENEMY_RADIUS);
const arenaClampY = (y: number): number => clamp(y, ENEMY_RADIUS, ARENA_HEIGHT - ENEMY_RADIUS);

// ── The library ──────────────────────────────────────────────────────────────────────────────────────

/** §16 P1 fan of parryable slugs toward the nearest target, with a walking 2-wide weave-gap (reuses
 *  `bulletWallAngles` — the exact OLD RUST wall). Params: count, arc, speed, damage, gap (the walking index). */
export const bulletFan: BossPrimitive = (ctx) => {
  const t = aimTarget(ctx);
  const base = Math.atan2(t.y - ctx.boss.y, t.x - ctx.boss.x);
  const count = Math.max(4, Math.floor(p(ctx, "count", 11)));
  const arc = p(ctx, "arc", 1.9);
  const speed = p(ctx, "speed", 360);
  const dmg = p(ctx, "damage", 8);
  const gapIdx = Math.floor(p(ctx, "gap", ctx.phaseTick));
  const projectiles: FireSpec[] = bulletWallAngles(base, count, arc, gapIdx).map((ang) => ({
    fromX: ctx.boss.x,
    fromY: ctx.boss.y,
    aimX: Math.cos(ang),
    aimY: Math.sin(ang),
    speed,
    damage: dmg,
  }));
  return { telegraphs: [], emits: { projectiles } };
};

/** Full-circle ring of parryable slugs, evenly spaced, with an optional pre-flash ring telegraph. Params:
 *  count, speed, damage, spin (radians offset base), warn (1 = show the pre-flash ring). */
export const radialBurst: BossPrimitive = (ctx) => {
  const count = Math.max(3, Math.floor(p(ctx, "count", 12)));
  const speed = p(ctx, "speed", 300);
  const dmg = p(ctx, "damage", 8);
  const spin = p(ctx, "spin", 0);
  const projectiles: FireSpec[] = [];
  for (let i = 0; i < count; i++) {
    const ang = spin + (i / count) * Math.PI * 2;
    projectiles.push({
      fromX: ctx.boss.x,
      fromY: ctx.boss.y,
      aimX: Math.cos(ang),
      aimY: Math.sin(ang),
      speed,
      damage: dmg,
    });
  }
  const telegraphs: TgSpec[] =
    p(ctx, "warn", 1) >= 1
      ? [
          {
            shape: TgShape.Ring,
            x: ctx.boss.x,
            y: ctx.boss.y,
            a: ctx.boss.radius + 40,
            b: ctx.boss.radius,
            danger: TELEGRAPH_DODGE,
            kindTag: 3, // bullet-burst pre-flash — the client shows a flash, NOT a slam impact
          },
        ]
      : [];
  return { telegraphs, emits: { projectiles } };
};

/** Rotating spiral — a radial ring whose base angle advances a fixed step every trigger (derived from
 *  `phaseTick`, so it spins deterministically with no hidden accumulator). Params: count, speed, damage,
 *  spinPerVolley (radians/trigger). */
export const spiral: BossPrimitive = (ctx) => {
  const spinPerVolley = p(ctx, "spinPerVolley", 0.4);
  const spin = ctx.phaseTick * spinPerVolley;
  return radialBurst({ ...ctx, params: { ...ctx.params, spin, warn: 0 } });
};

/** Aimed cone volley at the nearest target (the Gatlin scatter). Params: pellets, arc, speed, damage. */
export const aimedVolley: BossPrimitive = (ctx) => {
  const t = aimTarget(ctx);
  const base = Math.atan2(t.y - ctx.boss.y, t.x - ctx.boss.x);
  const pellets = Math.max(1, Math.floor(p(ctx, "pellets", 3)));
  const arc = p(ctx, "arc", 0.5);
  const speed = p(ctx, "speed", 340);
  const dmg = p(ctx, "damage", 7);
  const projectiles: FireSpec[] = coneAngles(base, pellets, arc).map((ang) => ({
    fromX: ctx.boss.x,
    fromY: ctx.boss.y,
    aimX: Math.cos(ang),
    aimY: Math.sin(ang),
    speed,
    damage: dmg,
  }));
  return { telegraphs: [], emits: { projectiles } };
};

/** §16 the generalised SLAM — one or more telegraphed landing-zone discs (unparryable, dodge). The first
 *  drops on the nearest target (lead), the rest at rng-jittered spots so the squad can't all stack in one
 *  safe pocket. Params: count, radius, damage, knockback, spread (jitter px). */
export const landingZone: BossPrimitive = (ctx) => {
  const count = Math.max(1, Math.floor(p(ctx, "count", 1)));
  const radius = p(ctx, "radius", 150);
  const dmg = p(ctx, "damage", 22);
  const knock = p(ctx, "knockback", 660);
  const spread = p(ctx, "spread", 340);
  const telegraphs: TgSpec[] = [];
  const aoe: AoeSpec[] = [];
  const first = aimTarget(ctx);
  for (let i = 0; i < count; i++) {
    const x = i === 0 ? first.x : arenaClampX(first.x + ctx.rng.range(-spread, spread));
    const y = i === 0 ? first.y : arenaClampY(first.y + ctx.rng.range(-spread, spread));
    telegraphs.push({ shape: TgShape.Circle, x, y, a: radius, danger: TELEGRAPH_DODGE });
    aoe.push({ x, y, radius, damage: dmg, knockback: knock });
  }
  return { telegraphs, emits: { aoe } };
};

/** §33 FOOTFALL QUAKE — the colossus's marquee: each thunderous footstep drops a ground shockwave you must
 *  JUMP over (airborne = immune) or PARRY (negates, feeds the parry chain). The stomp lands at the giant's
 *  foot (the boss body) with big-radius jittered aftershocks so a standing squad can't ignore it. White
 *  parry-cue telegraph (kindTag 7 = quake). Params: count, radius, damage, knockback, spread. */
export const footfallQuake: BossPrimitive = (ctx) => {
  const count = Math.max(1, Math.floor(p(ctx, "count", 1)));
  const radius = p(ctx, "radius", 300);
  const dmg = p(ctx, "damage", 24);
  const knock = p(ctx, "knockback", 900);
  const spread = p(ctx, "spread", 320);
  const telegraphs: TgSpec[] = [];
  const aoe: AoeSpec[] = [];
  for (let i = 0; i < count; i++) {
    // The first shock lands under the giant's foot (the boss body); the rest are jittered aftershocks.
    const x = i === 0 ? ctx.boss.x : arenaClampX(ctx.boss.x + ctx.rng.range(-spread, spread));
    const y = i === 0 ? ctx.boss.y : arenaClampY(ctx.boss.y + ctx.rng.range(-spread, spread));
    telegraphs.push({ shape: TgShape.Circle, x, y, a: radius, danger: TELEGRAPH_PARRYABLE, kindTag: 7 });
    aoe.push({ x, y, radius, damage: dmg, knockback: knock, quake: true });
  }
  return { telegraphs, emits: { aoe } };
};

/** Drop corrosive DoT puddles (reuses ZoneState) at telegraphed spots near the squad — persistent floor
 *  denial, unparryable by §8. Params: count, radius, ttl, spread (jitter px). */
export const corrosivePool: BossPrimitive = (ctx) => {
  const count = Math.max(1, Math.floor(p(ctx, "count", 2)));
  const radius = p(ctx, "radius", 96);
  const ttl = p(ctx, "ttl", 8);
  const spread = p(ctx, "spread", 420);
  const anchor = aimTarget(ctx);
  const telegraphs: TgSpec[] = [];
  const zones: ZoneSpec[] = [];
  for (let i = 0; i < count; i++) {
    const x = arenaClampX(anchor.x + ctx.rng.range(-spread, spread));
    const y = arenaClampY(anchor.y + ctx.rng.range(-spread, spread));
    telegraphs.push({
      shape: TgShape.Circle,
      x,
      y,
      a: radius,
      danger: TELEGRAPH_DODGE,
      kindTag: 1, // hazard tint (vs slam)
    });
    zones.push({ x, y, radius, ttl });
  }
  return { telegraphs, emits: { zones } };
};

/** Conjure adds in a ring around the boss, each pre-warned by a point marker (dodge). Params: count,
 *  ringRadius, ringJitter. `kind` is read from a string param slot the controller injects via params.addKind
 *  (a numeric-only params map can't carry it), so the controller passes the kind id separately — here we
 *  emit spots + markers and leave `kind` for the controller to stamp. */
export const summonAdds: BossPrimitive = (ctx) => {
  const count = Math.max(1, Math.floor(p(ctx, "count", 3)));
  const ring = p(ctx, "ringRadius", ctx.boss.radius + 70);
  const jitter = p(ctx, "ringJitter", 60);
  const telegraphs: TgSpec[] = [];
  const adds: AddSpec[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + ctx.rng.range(-0.3, 0.3);
    const r = ring + ctx.rng.range(-jitter, jitter);
    const x = arenaClampX(ctx.boss.x + Math.cos(a) * r);
    const y = arenaClampY(ctx.boss.y + Math.sin(a) * r);
    telegraphs.push({
      shape: TgShape.PointWarn,
      x,
      y,
      a: 26,
      danger: TELEGRAPH_DODGE,
      kindTag: 2, // summon marker
    });
    adds.push({ kind: "", x, y }); // controller stamps the add kind
  }
  return { telegraphs, emits: { adds } };
};

// ── §16 v0.109 Slice 2: ACTIVE-HAZARD geometry + primitives (beams / rings / dashes) ──────────────────

/** Is (px,py) inside an oriented rectangle rooted at (ox,oy), extending `len` along `rot`, `halfW` to each
 *  side? PURE — the beam + dash hit test (server-authoritative). Point-blank along the axis counts. */
export function pointInOrientedRect(
  px: number,
  py: number,
  ox: number,
  oy: number,
  len: number,
  halfW: number,
  rot: number,
): boolean {
  const dx = px - ox;
  const dy = py - oy;
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const along = dx * c + dy * s; // projection onto the beam axis
  const perp = -dx * s + dy * c; // perpendicular offset
  return along >= 0 && along <= len && Math.abs(perp) <= halfW;
}

/** Is (px,py) in the DANGER band of an expanding ring — within `bandHalf` of radius `bandR` AND OUTSIDE the
 *  safe gap wedge (centred `gapCenter`, half-width `gapHalf`)? PURE — the ring hit test. */
export function pointInAnnulusGap(
  px: number,
  py: number,
  cx: number,
  cy: number,
  bandR: number,
  bandHalf: number,
  gapCenter: number,
  gapHalf: number,
): boolean {
  const dx = px - cx;
  const dy = py - cy;
  const dist = Math.hypot(dx, dy);
  if (dist < bandR - bandHalf || dist > bandR + bandHalf) return false;
  if (gapHalf <= 0) return true;
  let da = Math.atan2(dy, dx) - gapCenter;
  da = Math.atan2(Math.sin(da), Math.cos(da)); // wrap to [-π, π]
  return Math.abs(da) > gapHalf; // outside the safe wedge → in danger
}

/** §16 a hitscan BEAM that charges (windup) then SWEEPS across the arena. A rect lane telegraphs at the
 *  start angle; during the live window the beam rotates from rot0→rot0+sweepArc (0 = a static lane),
 *  damaging anyone inside each tick. Params: length, halfWidth, sweepArc, duration, dps. Dodge (unparryable). */
const POSITIVE_TAU = Math.PI * 2;

/** Exact swept annular-capsule contact used by the titan heel. The angular pad accounts for both the
 * authored heel half-width and the target body radius, preventing 20 Hz angular tunneling. */
export function pointInSweptAnnularArc(
  px: number,
  py: number,
  cx: number,
  cy: number,
  innerRange: number,
  outerRange: number,
  halfWidth: number,
  fromAngle: number,
  toAngle: number,
  targetRadius = 0,
): boolean {
  const dx = px - cx;
  const dy = py - cy;
  const distance = Math.hypot(dx, dy);
  const pad = Math.max(0, halfWidth + targetRadius);
  if (distance < Math.max(0, innerRange - pad) || distance > outerRange + pad) return false;
  if (distance <= 1e-9) return innerRange <= pad;
  const span = toAngle - fromAngle;
  if (Math.abs(span) >= POSITIVE_TAU - 1e-9) return true;
  const angularPad = Math.asin(clamp(pad / distance, 0, 1));
  const angle = Math.atan2(dy, dx);
  if (span >= 0) {
    const delta = ((angle - fromAngle) % POSITIVE_TAU + POSITIVE_TAU) % POSITIVE_TAU;
    return delta <= span + angularPad || delta >= POSITIVE_TAU - angularPad;
  }
  const delta = ((fromAngle - angle) % POSITIVE_TAU + POSITIVE_TAU) % POSITIVE_TAU;
  return delta <= -span + angularPad || delta >= POSITIVE_TAU - angularPad;
}

export const beamSweep: BossPrimitive = (ctx) => {
  const t = aimTarget(ctx);
  const aim = Math.atan2(t.y - ctx.boss.y, t.x - ctx.boss.x);
  const length = p(ctx, "length", 900);
  const halfW = p(ctx, "halfWidth", 40);
  const sweepArc = p(ctx, "sweepArc", 0);
  const duration = p(ctx, "duration", 0.5);
  const dps = p(ctx, "dps", 34);
  const rot0 = aim - sweepArc / 2; // sweep passes THROUGH the target
  return {
    telegraphs: [
      {
        shape: TgShape.Rect,
        x: ctx.boss.x,
        y: ctx.boss.y,
        a: length,
        b: halfW,
        rot: rot0,
        danger: TELEGRAPH_DODGE,
        kindTag: 4,
      },
    ],
    emits: {
      active: {
        kind: 0,
        duration,
        dps,
        x: ctx.boss.x,
        y: ctx.boss.y,
        a: length,
        b: halfW,
        rot0,
        rotEnd: rot0 + sweepArc,
        gapCenter: 0,
        gapHalf: 0,
        knockback: 0,
      },
    },
  };
};

/** §16 an EXPANDING RING — a growing donut of damage with a safe gap wedge you dash through. A ring
 *  telegraphs at the boss; during the live window the damage band expands 0→maxR, hitting anyone in the band
 *  outside the gap. Params: maxR, bandHalf, gapAngle (safe half-width), duration, dps. Dodge (unparryable). */
export const expandingRing: BossPrimitive = (ctx) => {
  const maxR = p(ctx, "maxR", 520);
  const bandHalf = RING_BAND_HALF; // SHARED so the client's drawn band == the server's hit band (WYSIWYG)
  const gapAngle = p(ctx, "gapAngle", 0.5);
  const duration = p(ctx, "duration", 1.1);
  const dps = p(ctx, "dps", 28);
  const gapCenter = ctx.rng.range(-Math.PI, Math.PI); // the safe wedge points a fresh way each ring
  return {
    // The telegraph row's `b` carries the safe-gap half-width (so the client can draw the gap); `rot` is the
    // gap centre. The true band thickness (bandHalf) rides in the ActiveSpec for the server hit test only.
    telegraphs: [
      {
        shape: TgShape.Ring,
        x: ctx.boss.x,
        y: ctx.boss.y,
        a: maxR,
        b: gapAngle,
        rot: gapCenter,
        danger: TELEGRAPH_DODGE,
        kindTag: 5,
      },
    ],
    emits: {
      active: {
        kind: 1,
        duration,
        dps,
        x: ctx.boss.x,
        y: ctx.boss.y,
        a: maxR,
        b: bandHalf,
        rot0: 0,
        rotEnd: 0,
        gapCenter,
        gapHalf: gapAngle,
        knockback: 0,
      },
    },
  };
};

/** §16 a DASH-CHARGE — the boss telegraphs a lane toward the target, then hurtles along it, contact-damaging
 *  + shoving anyone in the lane. Params: reach, halfWidth, duration, damage, knockback. Dodge (unparryable). */
export const dashCharge: BossPrimitive = (ctx) => {
  const t = aimTarget(ctx);
  const rot0 = Math.atan2(t.y - ctx.boss.y, t.x - ctx.boss.x);
  const reach = p(ctx, "reach", 600);
  const halfW = p(ctx, "halfWidth", 60);
  const duration = p(ctx, "duration", 0.36);
  const damage = p(ctx, "damage", 60); // applied as dps over the short window → grazing takes less
  const knockback = p(ctx, "knockback", 700);
  return {
    telegraphs: [
      {
        shape: TgShape.Rect,
        x: ctx.boss.x,
        y: ctx.boss.y,
        a: reach,
        b: halfW,
        rot: rot0,
        danger: TELEGRAPH_DODGE,
        kindTag: 4,
      },
    ],
    emits: {
      active: {
        kind: 2,
        duration,
        dps: damage,
        x: ctx.boss.x,
        y: ctx.boss.y,
        a: reach,
        b: halfW,
        rot0,
        rotEnd: rot0,
        gapCenter: 0,
        gapHalf: 0,
        knockback,
      },
    },
  };
};

/** §16 Slice 3 — a PARRYABLE melee swing toward the nearest target: a white wedge telegraph the player can
 *  PARRY (feeds the v0.114 parry-chain) instead of dodge. Fired on a fast cadence it reads as a flurry — the
 *  duelist boss's signature. Params: range, halfArc, damage, knockback. The `t` fill is the white parry-tell.
 *  The wedge is anchored at trigger time; the controller freezes the boss's feet while a melee cast is
 *  pending (it plants to swing), so the drawn arc and the hit stay co-located (WYSIWYG). */
export const meleeCombo: BossPrimitive = (ctx) => {
  const t = aimTarget(ctx);
  const aimX = t.x - ctx.boss.x;
  const aimY = t.y - ctx.boss.y;
  const aim = Math.atan2(aimY, aimX);
  const range = p(ctx, "range", 190);
  const halfArc = p(ctx, "halfArc", 0.7);
  const damage = p(ctx, "damage", 16);
  const knockback = p(ctx, "knockback", 420);
  return {
    telegraphs: [
      {
        shape: TgShape.Cone,
        x: ctx.boss.x,
        y: ctx.boss.y,
        a: range,
        b: halfArc,
        rot: aim,
        danger: TELEGRAPH_PARRYABLE, // WHITE — this one you PARRY
        kindTag: 6, // parryable melee arc
      },
    ],
    emits: {
      melee: [{ x: ctx.boss.x, y: ctx.boss.y, aimX, aimY, range, halfArc, damage, knockback }],
    },
  };
};

/** §16 Slice 3 — a BLINK-STRIKE: the boss telegraphs a spot right beside the nearest target, then on resolve
 *  TELEPORTS there and slams (a dodge landing-zone at the destination). The whole fight is watching where the
 *  poof marker lands and vacating it. Params: offset (px from the target), radius, damage, knockback. */
export const blinkStrike: BossPrimitive = (ctx) => {
  const t = aimTarget(ctx);
  const offset = p(ctx, "offset", 70);
  const radius = p(ctx, "radius", 130);
  const damage = p(ctx, "damage", 20);
  const knockback = p(ctx, "knockback", 640);
  const a = ctx.rng.range(-Math.PI, Math.PI); // a fresh approach angle each blink
  const x = arenaClampX(t.x + Math.cos(a) * offset);
  const y = arenaClampY(t.y + Math.sin(a) * offset);
  return {
    telegraphs: [
      // The destination poof marker (summon-style dot) + the slam disc share the SAME spot.
      { shape: TgShape.PointWarn, x, y, a: 30, danger: TELEGRAPH_DODGE, kindTag: 2 },
      { shape: TgShape.Circle, x, y, a: radius, danger: TELEGRAPH_DODGE },
    ],
    emits: {
      teleport: { x, y },
      aoe: [{ x, y, radius, damage, knockback }],
    },
  };
};

/** Serraketh's fixed red eruption claim. Coverage is complete on the first patch; only `t` animates. */
export const seamEaterEruption: BossPrimitive = (ctx) => {
  const target = aimTarget(ctx);
  const radius = p(ctx, "radius", WORM_ERUPTION_RADIUS);
  const damage = p(ctx, "damage", 24);
  const knockback = p(ctx, "knockback", 760);
  return {
    telegraphs: [
      {
        shape: TgShape.Circle,
        x: target.x,
        y: target.y,
        a: radius,
        danger: TELEGRAPH_DODGE,
        kindTag: 8,
      },
    ],
    emits: { aoe: [{ x: target.x, y: target.y, radius, damage, knockback }] },
  };
};

/** White, ground-only Spinner counter lesson. */
export const seamEaterRibQuake: BossPrimitive = (ctx) => {
  const radius = p(ctx, "radius", 250);
  return {
    telegraphs: [
      {
        shape: TgShape.Circle,
        x: ctx.boss.x,
        y: ctx.boss.y,
        a: radius,
        danger: TELEGRAPH_PARRYABLE,
        kindTag: 7,
      },
    ],
    emits: {
      aoe: [
        {
          x: ctx.boss.x,
          y: ctx.boss.y,
          radius,
          damage: p(ctx, "damage", 22),
          knockback: p(ctx, "knockback", 850),
          quake: true,
        },
      ],
    },
  };
};

/** White vertical tail sweep: parryable/dodgeable, never jump-immune by quake semantics. */
export const seamEaterStitchReap: BossPrimitive = (ctx) => {
  const target = aimTarget(ctx);
  const aimX = target.x - ctx.boss.x;
  const aimY = target.y - ctx.boss.y;
  const range = p(ctx, "range", 230);
  const halfArc = p(ctx, "halfArc", 0.8);
  const rot = Math.atan2(aimY, aimX);
  return {
    telegraphs: [
      {
        shape: TgShape.Cone,
        x: ctx.boss.x,
        y: ctx.boss.y,
        a: range,
        b: halfArc,
        rot,
        danger: TELEGRAPH_PARRYABLE,
        kindTag: 9,
      },
    ],
    emits: {
      melee: [
        {
          x: ctx.boss.x,
          y: ctx.boss.y,
          aimX,
          aimY,
          range,
          halfArc,
          damage: p(ctx, "damage", 18),
          knockback: p(ctx, "knockback", 520),
        },
      ],
    },
  };
};

/** The primitive registry. Slice 1 = emit casts; Slice 2 = the active-hazard casts (beam/ring/dash); Slice 3
 *  = the melee trio's `meleeCombo` (parryable wedge) + `blinkStrike` (teleport slam). */
export const BOSS_PRIMITIVES: Record<string, BossPrimitive> = {
  bulletFan,
  radialBurst,
  spiral,
  aimedVolley,
  landingZone,
  footfallQuake,
  corrosivePool,
  summonAdds,
  beamSweep,
  expandingRing,
  dashCharge,
  meleeCombo,
  blinkStrike,
};

// The generic registry's enumerable key set is a frozen compatibility surface. Worm-only helpers remain
// addressable by module id without changing that surface; Serraketh's dedicated director is their owner.
Object.defineProperties(BOSS_PRIMITIVES, {
  seamEaterEruption: { value: seamEaterEruption, enumerable: false },
  seamEaterRibQuake: { value: seamEaterRibQuake, enumerable: false },
  seamEaterStitchReap: { value: seamEaterStitchReap, enumerable: false },
});

/** Which telegraph danger a shape defaults to when a spec omits it (AoE/zones dodge; parryable only when
 *  a primitive explicitly says so). Kept here so the controller and tests agree. */
export function telegraphDanger(spec: TgSpec): number {
  return spec.danger ?? TELEGRAPH_DODGE;
}
