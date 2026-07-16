#!/usr/bin/env node
// artkit/gen-weapon-expansion.mjs — codegen the +300 §13 EXPANSION roster from the designed concepts
// (data/weapon-concepts-300.json) into a typed module the game merges into WEAPONS. Each entry is a valid
// WeaponDef flagged `expansion:true` so it's held OUT of the active roster (WEAPON_IDS) until curated in.
//
// §43 STRICT MODE (Sol audit P0s): this generator FAILS — with every error listed — instead of repairing
// bad authoring. Unknown keys, sibling mechanic blocks (the bug that silently erased 11 weapons' kits),
// invalid enums, malformed grades/requirements, and duplicate ids all abort the run with exit 1. The ONE
// permitted repair is numeric CLAMPING to the design-law bands (§14 fixed bounds) — clamps are counted
// and reported, and tests/data-consistency.test.ts re-derives them independently so a drift fails CI.
//
//   node tools/artkit/gen-weapon-expansion.mjs
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { emit, isCheck } from "./lib/emit.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)));
const REPO = resolve(ROOT, "..", "..");
const SRC = join(REPO, "data", "weapon-concepts-300.json");
const OUT = join(REPO, "packages", "shared", "src", "weapons-expansion.generated.ts");

// ── validation state ──────────────────────────────────────────────────────────────────────────────
const errors = [];
let clampCount = 0;
const clampSamples = [];
/** Current weapon id, for error paths. */
let CUR = "?";
const fail = (msg) => errors.push(`${CUR}: ${msg}`);

const GRADES = new Set(["S", "A", "B", "C", "D", "E"]);
const ATTRS = new Set(["str", "dex", "int", "con", "luk"]);
const TYPES = new Set(["melee", "ranged", "caster"]);
const GRIPS = new Set(["1H", "2H", "dual", "mounted"]);
const SIZES = new Set(["S", "M", "L", "XL"]);
const BANDS = new Set(["close", "mid", "long"]);
const KINDS = new Set(["edge", "thrown", "quake", "chainLightning", "scatter", "gun", "beam"]);
const BULLET_KINDS = new Set(["slug", "pellet", "tracer", "nail", "ricochet", "spark"]);
const MUZZLES = new Set(["heavy", "boom", "rapid", "punch", "spark"]);
// The first gun-beam wave is explicit, not inferred from every ranged weapon. V1 still uses heat only;
// these ids differ from caster beams through their ranged class/art/pose, never a hidden magazine resource.
const BEAM_GUN_IDS = new Set([
  "x2-voltcaster-machine-pistol",
  "x2-stormcaller-tesla-gatling",
]);

// Key whitelists — an authored key outside these is a FAILURE, never a silent drop.
const TOP_KEYS = new Set([
  "id", "name", "type", "family", "theme", "element", "finish", "finishNote", "grip", "size",
  "rangeBand", "scaling", "scalingGrades", "requirements", "artPrompt", "palettePrimary",
  "paletteAccent", "cardartAction", "behavior", "stats", "description", "banned",
]);
// The sibling-block bug (§43): mechanic stats authored NEXT TO `behavior` instead of inside it were
// silently ignored, shipping 11 weapons with default kits. Now an instant failure.
const MECH_SIBLINGS = ["thrown", "quake", "chainLightning", "scatter", "gun", "beam"];
const STATS_KEYS = new Set(["damage", "range", "halfArc", "cooldown", "displayLength", "swingArc", "gripFrac"]);
const BEHAVIOR_KEYS = {
  edge: new Set(["kind"]),
  thrown: new Set(["kind", "speed", "range", "damage", "charges", "refillSeconds", "pierce", "scalingGrades"]),
  quake: new Set(["kind", "radius", "damage", "scalingGrades"]),
  chainLightning: new Set(["kind", "jumps", "range", "damage", "falloff", "scalingGrades", "vfx"]),
  scatter: new Set(["kind", "count", "spread", "speed", "range", "damage", "pierce", "scalingGrades", "explode"]),
  gun: new Set(["kind", "damage", "projectileSpeed", "range", "fireRate", "pellets", "spread", "pierce",
    "bounces", "magazine", "reloadSeconds", "bulletKind", "muzzle", "muzzleColor", "recoil",
    "scalingGrades", "explode"]),
  beam: new Set(["kind", "damage", "range", "tickRate", "width", "chargeSeconds", "sweepLagSeconds",
    "scalingGrades"]),
};
const EXPLODE_KEYS = new Set(["radius", "damage", "scalingGrades"]);

const checkKeys = (obj, allowed, path) => {
  for (const k of Object.keys(obj)) if (!allowed.has(k)) fail(`unknown key ${path}.${k}`);
};
const enumOf = (v, set, path) => {
  if (!set.has(v)) fail(`${path} = ${JSON.stringify(v)} is not one of [${[...set].join(", ")}]`);
  return v;
};
/** Numeric with design-law clamping (§14 fixed bands) — the ONE permitted repair, counted + reported.
 *  A missing value takes the default; a NON-numeric value is a failure. */
const num = (v, lo, hi, d, path) => {
  if (v === undefined) return d;
  const n = Number(v);
  if (!Number.isFinite(n)) {
    fail(`${path} = ${JSON.stringify(v)} is not a number`);
    return d;
  }
  const c = Math.min(hi, Math.max(lo, n));
  if (c !== n) {
    clampCount++;
    if (clampSamples.length < 8) clampSamples.push(`${CUR} ${path} ${n}→${c}`);
  }
  return c;
};
const int = (v, lo, hi, d, path) => Math.round(num(v, lo, hi, d, path));
const beamTick = (v, path) => {
  const raw = num(v, 0.05, 0.25, 0.1, path);
  const tick = Number((Math.round(raw / 0.05) * 0.05).toFixed(2));
  if (tick !== raw) {
    clampCount++;
    if (clampSamples.length < 8) clampSamples.push(`${CUR} ${path} ${raw}→${tick}`);
  }
  return tick;
};

/** STRICT scaling grades: `{attr: GRADE}` — malformed entries FAIL (they used to vanish). */
function grades(g, path, fallback) {
  if (g === undefined) return fallback;
  if (!g || typeof g !== "object") {
    fail(`${path} is not an object`);
    return fallback;
  }
  const out = {};
  for (const [a, v] of Object.entries(g)) {
    if (!ATTRS.has(a)) {
      fail(`${path}.${a} is not an attribute (str/dex/int/con/luk)`);
      continue;
    }
    const grade = typeof v === "string" ? v.toUpperCase() : v;
    if (!GRADES.has(grade)) {
      fail(`${path}.${a} = ${JSON.stringify(v)} is not a grade (S–E)`);
      continue;
    }
    out[a] = grade;
  }
  return Object.keys(out).length ? out : fallback;
}
/** STRICT requirements: `{attr: n}`, n numeric (clamped 2..20) — malformed entries FAIL. */
function reqs(r, path) {
  if (r === undefined) return undefined;
  if (!r || typeof r !== "object") {
    fail(`${path} is not an object`);
    return undefined;
  }
  const out = {};
  for (const [a, v] of Object.entries(r)) {
    if (!ATTRS.has(a)) {
      fail(`${path}.${a} is not an attribute`);
      continue;
    }
    const n = int(v, 2, 20, 0, `${path}.${a}`);
    if (n > 1) out[a] = n;
  }
  return Object.keys(out).length ? out : undefined;
}
/** Nested explode block (scatter/gun) — validated + fully emitted (scalingGrades included). */
function explodeOf(e, path, rMax) {
  if (e === undefined) return undefined;
  checkKeys(e, EXPLODE_KEYS, path);
  const out = {
    radius: num(e.radius, 30, rMax, 56, `${path}.radius`),
    damage: num(e.damage, 1, 30, 6, `${path}.damage`),
  };
  const g = grades(e.scalingGrades, `${path}.scalingGrades`, undefined);
  if (g) out.scalingGrades = g;
  return out;
}

function mapWeapon(w) {
  checkKeys(w, TOP_KEYS, "");
  for (const k of MECH_SIBLINGS)
    if (w[k] !== undefined)
      fail(`mechanic block "${k}" is a SIBLING of behavior — its stats would be IGNORED; author them inside behavior`);

  const s = w.stats ?? {};
  checkKeys(s, STATS_KEYS, "stats");
  const b = w.behavior ?? { kind: "edge" };
  const kind = enumOf(b.kind ?? "edge", KINDS, "behavior.kind");
  checkKeys(b, BEHAVIOR_KEYS[kind] ?? BEHAVIOR_KEYS.edge, `behavior(${kind})`);
  const type = enumOf(w.type, TYPES, "type");
  const grip = enumOf(w.grip, GRIPS, "grip");
  const size = enumOf(w.size, SIZES, "size");
  const rangeBand = enumOf(w.rangeBand, BANDS, "rangeBand");
  const isBeam = kind === "beam" || BEAM_GUN_IDS.has(w.id);
  const isGun = !isBeam && (kind === "gun" || type === "ranged");

  // Edge/swing baseline (required even for guns — the held-swing fields).
  const damage = num(s.damage, 1, 40, 8, "stats.damage");
  const def = {
    id: w.id,
    name: w.name,
    expansion: true,
    scalingGrades: grades(w.scalingGrades, "scalingGrades", { str: "B" }),
    damage,
    range: type === "ranged"
      ? num(s.range, 80, 320, 140, "stats.range")
      : num(s.range, 40, 1200, 140, "stats.range"),
    halfArc: num(s.halfArc, 0.3, 1.4, 0.85, "stats.halfArc"),
    cooldown: num(s.cooldown, 0.12, 1.5, 0.4, "stats.cooldown"),
    displayLength: num(s.displayLength, 40, 400, 90, "stats.displayLength"),
    swingArc: num(s.swingArc, 1.8, 3.4, 2.6, "stats.swingArc"),
    gripFrac: num(s.gripFrac, 0.04, 0.5, 0.12, "stats.gripFrac"),
    tags: {
      grip,
      size,
      delivery: isBeam ? "beam" : isGun ? "projectile" : kind === "thrown" ? "thrown" : kind === "quake" ? "melee-slam" : "melee-arc",
      fireMode: isBeam ? "hold" : isGun ? "auto" : "tap-charge",
      element: typeof w.element === "string" ? w.element : "physical",
      classPool: type,
      family: typeof w.family === "string" ? w.family : "exotic",
      rangeBand,
      scaling: Array.isArray(w.scaling) && w.scaling.length ? w.scaling : ["STR"],
    },
  };
  const rq = reqs(w.requirements, "requirements");
  if (rq) def.requirements = rq;
  if (grip === "2H") def.twoHanded = true;
  if (grip === "dual") def.dual = true;
  if (type === "melee") def.durability = grip === "2H" ? 90 : 75;

  // Behavior block — EVERY authored field the WeaponDef schema supports is emitted (§43: dropping a
  // supported field is the bug class that shipped 71 muzzle colors and 38 per-source gradings to /dev/null).
  if (isBeam) {
    const sourceTick = num(b.tickRate ?? b.fireRate, 0.05, 0.25, 0.1, "behavior.tickRate");
    const baseBeamDamage = num(b.damage, 1, 40, damage, "behavior.damage");
    const sizeWidth = { S: 32, M: 48, L: 56, XL: 64 }[size] ?? 48;
    const sizeLag = { S: 0.16, M: 0.22, L: 0.28, XL: 0.35 }[size] ?? 0.22;
    def.beam = {
      damagePerSecond: baseBeamDamage / sourceTick,
      tickRate: beamTick(b.tickRate ?? b.fireRate, "behavior.tickRate"),
      width: num(b.width, 24, 64, sizeWidth, "behavior.width"),
      range: num(b.range ?? s.range, 240, 640, 520, "behavior.range"),
      chargeSeconds: num(b.chargeSeconds, 0.65, 1.25, 0.65, "behavior.chargeSeconds"),
      sweepLagSeconds: num(b.sweepLagSeconds, 0.05, 0.35, sizeLag, "behavior.sweepLagSeconds"),
      overheat: {
        maxChannelSeconds: 1.25,
        heatPerSecond: 0.6,
        coolPerSecond: 0.35,
        ignitionHeat: 0.25,
        lockSeconds: 1.5,
        restartHeat: 0.35,
      },
      movement: { chargeMul: 0.55, channelMul: 0.35 },
    };
    const bg = grades(b.scalingGrades, "behavior.scalingGrades", undefined);
    if (bg) def.beam.scalingGrades = bg;
  } else if (isGun) {
    def.gun = {
      damage: num(b.damage, 1, 40, damage, "behavior.damage"),
      projectileSpeed: num(b.projectileSpeed, 400, 1600, 900, "behavior.projectileSpeed"),
      range: num(b.range ?? s.range, 280, 1100, 620, "behavior.range"),
      fireRate: num(b.fireRate, 0.05, 0.9, 0.3, "behavior.fireRate"),
      magazine: int(b.magazine, 1, 80, 8, "behavior.magazine"),
      reloadSeconds: num(b.reloadSeconds, 0.6, 3, 1.4, "behavior.reloadSeconds"),
      bulletKind: b.bulletKind === undefined ? "slug"
        : enumOf(b.bulletKind, BULLET_KINDS, "behavior.bulletKind"),
      muzzle: b.muzzle === undefined ? "punch"
        : enumOf(b.muzzle, MUZZLES, "behavior.muzzle"),
      recoil: num(b.recoil, 0.0004, 0.005, 0.0016, "behavior.recoil"),
    };
    const pellets = int(b.pellets, 1, 12, 1, "behavior.pellets");
    if (pellets > 1) {
      def.gun.pellets = pellets;
      def.gun.spread = num(b.spread, 0.1, 0.9, 0.4, "behavior.spread");
    }
    const pierce = int(b.pierce, 1, 6, 1, "behavior.pierce");
    if (pierce > 1) def.gun.pierce = pierce;
    const bounces = int(b.bounces, 0, 6, 0, "behavior.bounces");
    if (bounces > 0) def.gun.bounces = bounces;
    const mc = b.muzzleColor === undefined ? undefined : int(b.muzzleColor, 0, 0xffffff, 0, "behavior.muzzleColor");
    if (mc !== undefined) def.gun.muzzleColor = mc;
    const gg = grades(b.scalingGrades, "behavior.scalingGrades", undefined);
    if (gg) def.gun.scalingGrades = gg;
    const ex = explodeOf(b.explode, "behavior.explode", 90);
    if (ex) def.gun.explode = ex;
  } else if (kind === "thrown") {
    def.thrown = {
      speed: num(b.speed, 300, 1200, 680, "behavior.speed"),
      range: num(b.range, 200, 900, 520, "behavior.range"),
      damage: num(b.damage, 1, 40, damage, "behavior.damage"),
      charges: int(b.charges, 1, 6, 3, "behavior.charges"),
      refillSeconds: num(b.refillSeconds, 0.6, 4, 1.5, "behavior.refillSeconds"),
      pierce: int(b.pierce, 1, 5, 1, "behavior.pierce"),
    };
    const g = grades(b.scalingGrades, "behavior.scalingGrades", undefined);
    if (g) def.thrown.scalingGrades = g;
  } else if (kind === "quake") {
    def.quake = {
      radius: num(b.radius, 70, 220, 130, "behavior.radius"),
      damage: num(b.damage, 1, 30, 7, "behavior.damage"),
    };
    const g = grades(b.scalingGrades, "behavior.scalingGrades", undefined);
    if (g) def.quake.scalingGrades = g;
  } else if (kind === "chainLightning") {
    def.chainLightning = {
      jumps: int(b.jumps, 1, 6, 3, "behavior.jumps"),
      range: num(b.range, 100, 240, 180, "behavior.range"),
      damage: num(b.damage, 1, 24, 5, "behavior.damage"),
      falloff: num(b.falloff, 0.5, 1, 0.8, "behavior.falloff"),
    };
    const g = grades(b.scalingGrades, "behavior.scalingGrades", undefined);
    if (g) def.chainLightning.scalingGrades = g;
    if (b.vfx !== undefined) {
      checkKeys(b.vfx, new Set(["color", "jag", "life"]), "behavior.vfx");
      def.chainLightning.vfx = {
        color: num(b.vfx.color, 0, 1, 0.5, "behavior.vfx.color"),
        jag: num(b.vfx.jag, 0, 1, 0.25, "behavior.vfx.jag"),
        life: num(b.vfx.life, 60, 600, 200, "behavior.vfx.life"),
      };
    }
  } else if (kind === "scatter") {
    def.scatter = {
      count: int(b.count, 2, 10, 6, "behavior.count"),
      spread: num(b.spread, 0.2, 0.9, 0.5, "behavior.spread"),
      speed: num(b.speed, 300, 1000, 560, "behavior.speed"),
      range: num(b.range, 150, 700, 360, "behavior.range"),
      damage: num(b.damage, 1, 24, 5, "behavior.damage"),
    };
    const pierce = int(b.pierce, 1, 5, 1, "behavior.pierce");
    if (pierce > 1) def.scatter.pierce = pierce;
    const g = grades(b.scalingGrades, "behavior.scalingGrades", undefined);
    if (g) def.scatter.scalingGrades = g;
    const ex = explodeOf(b.explode, "behavior.explode", 80);
    if (ex) def.scatter.explode = ex;
  }
  // kind "edge" → plain melee (no behavior block).
  return def;
}

const data = JSON.parse(readFileSync(SRC, "utf8"));
const out = {};
for (const w of data.weapons) {
  CUR = w.id ?? w.name ?? "<missing id>";
  if (!w.id || !w.name) {
    fail("missing id or name");
    continue;
  }
  // A concept flagged `banned: true` is CUT from the game by design ruling — it stays in the data file as
  // the record, but never codegens into the roster. (2026-07-14: the whips — user ruling, "too sexual".)
  if (w.banned) continue;
  if (out[w.id]) {
    fail("duplicate id");
    continue;
  }
  out[w.id] = mapWeapon(w);
}

if (errors.length) {
  console.error(`gen-weapon-expansion: ${errors.length} authoring error(s) — nothing written:`);
  for (const e of errors) console.error("  ✗ " + e);
  process.exit(1);
}

const banner =
  "// AUTO-GENERATED by tools/artkit/gen-weapon-expansion.mjs — DO NOT EDIT.\n" +
  "// The +300 §13 expansion roster, codegen'd from data/weapon-concepts-300.json. Each WeaponDef is\n" +
  "// flagged `expansion:true` so weapons.ts merges them into WEAPONS but KEEPS them out of WEAPON_IDS\n" +
  "// (the active gallery/cycle/drop pool) until curated in. Re-run the script after editing the concepts.\n";
const body =
  `import type { WeaponDef } from "./weapons.js";\n\n` +
  `export const EXPANSION_WEAPONS: Record<string, WeaponDef> = ${JSON.stringify(out, null, 2)};\n`;
emit(OUT, `${banner}\n${body}`, "weapons-expansion.generated.ts");

if (!isCheck) {
  const byType = { melee: 0, ranged: 0, caster: 0 };
  for (const id of Object.keys(out)) byType[out[id].tags.classPool]++;
  console.log(
    `wrote weapons-expansion.generated.ts — ${Object.keys(out).length} weapons ` +
      `(melee ${byType.melee} / ranged ${byType.ranged} / caster ${byType.caster}); ` +
      `${clampCount} value(s) clamped to design bands` +
      (clampSamples.length ? ` (e.g. ${clampSamples.slice(0, 3).join("; ")})` : ""),
  );
}
