import { bulletWallAngles } from "./boss.js";
import { ARENA_HEIGHT, ARENA_WIDTH, ENEMY_RADIUS, TELEGRAPH_DODGE } from "./constants.js";
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
}

/** The payload a cast applies when its windup resolves. All optional; a bullet primitive uses `projectiles`,
 *  a landing zone uses `aoe`, a hazard uses `zones`, a summon uses `adds`, a dash uses `moveBoss`. */
export interface Emits {
  projectiles?: FireSpec[];
  zones?: ZoneSpec[];
  adds?: AddSpec[];
  aoe?: AoeSpec[];
  moveBoss?: Vec2;
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

/** The Slice-1 primitive registry (emit-based casts). Slice 2 adds the stateful/new-sim primitives
 *  (meleeCombo, expandingRing, beamSweep, dashCharge). */
export const BOSS_PRIMITIVES: Record<string, BossPrimitive> = {
  bulletFan,
  radialBurst,
  spiral,
  aimedVolley,
  landingZone,
  corrosivePool,
  summonAdds,
};

/** Which telegraph danger a shape defaults to when a spec omits it (AoE/zones dodge; parryable only when
 *  a primitive explicitly says so). Kept here so the controller and tests agree. */
export function telegraphDanger(spec: TgSpec): number {
  return spec.danger ?? TELEGRAPH_DODGE;
}
