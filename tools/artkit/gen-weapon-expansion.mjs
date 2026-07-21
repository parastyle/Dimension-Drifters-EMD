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
const HANDLING_TAGS = new Set(["lever", "pump", "pistol"]);
const SECONDARY_GRIP_ROLES = new Set([
  "under-barrel", "lever", "crank", "pump", "vertical-foregrip", "shoulder-RPG",
  "two-hand-rifle", "shaft", "handle",
]);
const SIZES = new Set(["S", "M", "L", "XL"]);
const BANDS = new Set(["close", "mid", "long"]);
const KINDS = new Set([
  "edge", "thrown", "quake", "chainLightning", "scatter", "gun", "beam", "groundZone",
  "glovePair", "warp",
]);
const SWING_STYLES = new Set(["arc", "orbit", "chop", "pivot", "thrust", "spin", "punch"]);
const BULLET_KINDS = new Set([
  "slug", "pellet", "tracer", "nail", "ricochet", "spark", "orb", "grenade", "fire-plume",
]);
const MUZZLES = new Set(["heavy", "boom", "rapid", "punch", "spark", "artillery"]);
const PROJECTILE_ARTS = new Set(["weapon-crop", "generated", "arrow", "cannonball", "fireball"]);
const MUZZLE_MODES = new Set(["parallel", "cycle"]);
// The first gun-beam wave is explicit, not inferred from every ranged weapon. V1 still uses heat only;
// these ids differ from caster beams through their ranged class/art/pose, never a hidden magazine resource.
const BEAM_GUN_IDS = new Set([
  "x2-voltcaster-machine-pistol",
  "x2-mirage-coilrifle",
  "x2-stormcaller-tesla-gatling",
  "x2-permafrost-siege-lobber",
  "x2-doomsday-drum-cannon",
]);
// Owner-ordered heavy single shots use gun behavior, but deliberately sit outside the catalog's
// common semi-auto damage/cadence bands. Keep the exception declarative so source data, generated
// WeaponDef cadence, and independent codegen validation agree.
const SINGLE_SHOT_GUN_IDS = new Set(["x2-saintskull-monstrance"]);

// Key whitelists — an authored key outside these is a FAILURE, never a silent drop.
const TOP_KEYS = new Set([
  "id", "name", "type", "family", "theme", "element", "finish", "finishNote", "grip", "size",
  "rangeBand", "scaling", "scalingGrades", "requirements", "artPrompt", "palettePrimary",
  "paletteAccent", "cardartAction", "behavior", "stats", "description", "banned", "expansion", "archived",
  "sprite", "sizeClass", "stance", "authoritativeCombo", "comboFamily", "comboVariant", "comboBar", "katanaHook",
  "bespokeVfxSheet", "performance", "swingStyle", "effectRecipe", "effectEmitter", "effectTiming",
  "renderAboveHands", "suppressVfx", "hitStatus", "gripPoints", "handlingTags",
]);
// The sibling-block bug (§43): mechanic stats authored NEXT TO `behavior` instead of inside it were
// silently ignored, shipping 11 weapons with default kits. Now an instant failure.
const MECH_SIBLINGS = [
  "thrown", "quake", "chainLightning", "scatter", "gun", "beam", "groundZone", "glovePair", "warp",
];
const STATS_KEYS = new Set(["damage", "range", "halfArc", "cooldown", "displayLength", "swingArc", "gripFrac"]);
const BEHAVIOR_KEYS = {
  edge: new Set(["kind"]),
  thrown: new Set(["kind", "speed", "range", "damage", "charges", "refillSeconds", "pierce", "arcHeight", "rotation", "ricochetHops", "ricochetRange", "scalingGrades", "zone"]),
  quake: new Set(["kind", "radius", "damage", "scalingGrades", "zone"]),
  chainLightning: new Set(["kind", "jumps", "range", "damage", "falloff", "scalingGrades", "vfx"]),
  scatter: new Set(["kind", "count", "spread", "aim", "speed", "range", "damage", "pierce", "scalingGrades", "explode"]),
  gun: new Set(["kind", "damage", "projectileSpeed", "range", "fireRate", "pellets", "spread", "pierce",
    "bounces", "magazine", "reloadSeconds", "bulletKind", "muzzle", "muzzleColor", "recoil",
    "projectileArt", "projectileVisualScale", "projectileColor", "arcHeight", "scalingGrades", "explode", "burst",
    "userKnockbackMultiplier",
    "randomPellets",
    "muzzleOffsets", "muzzleMode", "dualMuzzleSeparation", "sonicBoomRing", "width"]),
  beam: new Set(["kind", "damage", "range", "tickRate", "width", "chargeSeconds", "sweepLagSeconds",
    "randomRays", "muzzleOffsets", "coneStream", "scalingGrades", "zone"]),
  groundZone: new Set(["kind", "zone"]),
  glovePair: new Set(["kind", "auraColor", "auraRadius"]),
  warp: new Set(["kind", "burstRadius"]),
};
const EXPLODE_KEYS = new Set(["radius", "damage", "scalingGrades"]);
const GUN_BURST_KEYS = new Set(["count", "intervalSeconds"]);
const GRIP_POINTS_KEYS = new Set(["primary", "secondary"]);
const GRIP_ANCHOR_KEYS = new Set(["x", "y"]);
const SECONDARY_GRIP_KEYS = new Set(["x", "y", "role"]);
const ZONE_KEYS = new Set(["trigger", "style", "initialRadius", "maxRadius", "growthPerSecond",
  "lingerSeconds", "damagePerSecond", "tickRate", "placementRange", "scalingGrades",
  "slowMultiplier", "slowSeconds", "grenadeArcHeight"]);
const ZONE_TRIGGERS = new Set(["channel", "attack", "landing", "impact"]);
const ZONE_STYLES = new Set(["nether", "poison", "poison-smoke", "ice"]);
const SIZE_CLASSES = new Set(["short", "standard", "long", "great", "colossal"]);
const COMBO_FAMILIES = new Set(["arc", "chop", "rake", "punch", "thrust"]);
const EFFECT_EMITTERS = new Set(["body", "tip", "blade"]);
const EFFECT_TIMINGS = new Set(["active-start", "swing-midpoint", "impact"]);
const EFFECT_RECIPES = new Set([
  "galvanic-blue-burst", "riftglass-rainbow-volley", "whispervolume-page-scatter",
  "riftcleaver-crystal-shards", "verdict-tip-procession", "tombwarden-dark-slash",
  "choir-iron-flame-slash", "hangman-blood-spatter", "dustreaper-continuous-edge",
  "cinderbrand-fire-slash", "sanctified-holy-slash", "stormfist-blue-lunge",
  "thunderhead-electric-codex", "sermon-musical-notes", "nullspike-impact-circle",
  "quarry-quad-spatter", "witherleaf-tip-spores", "snakeoil-tip-sparks",
  "gravechain-dominant-spin", "void-caster-explosion", "hexbloom-toxic-impact",
  "cinderbrand-magma-impact", "cinderchoke-fire-impact", "hollow-harvest-circle",
  "abyssal-whirlwind-vortex", "drowned-anchor-deluge",
]);
const STANCES = new Set([
  "hasso-no-kamae", "tachi-no-tori", "blade-forward-high-hilt", "two-hands-on-hilt",
  "low-close-hilt",
]);
const RANDOM_RAY_KEYS = new Set(["count", "spread"]);
const RANDOM_PELLET_KEYS = new Set(["min", "max", "directions"]);
const CONE_STREAM_KEYS = new Set(["halfAngle", "flavor"]);
const CONE_STREAM_FLAVORS = new Set(["ice", "magma"]);
const MUZZLE_OFFSET_KEYS = new Set(["forward", "lateral"]);
const WEAPON_MUZZLE_COUNT_CAP = 6;
const COMBO_MOTIONS = new Set([
  "slash", "overhead", "shoulder-chop", "reverse-chop", "rising-chop", "execution-slam", "rake", "scissor",
  "jab", "cross", "hook", "haymaker", "lunge", "disengage", "impale", "fulcrum-flip", "stinger",
  "spin-release", "pommel-bash", "true-charged-slam", "falling-gate", "backswing-wheel",
  "runaway-cleave", "highland-gate", "rising-ward", "bind-break-cast-off", "long-reap",
  "shaft-switch", "compass-rose", "headsmans-drop", "hook-and-haul", "gallows-turn", "draw-cut",
  "guard-check", "sentence-fall", "choked-turn", "petalfall", "coil-drag", "thunder-fall",
  "splinter-fall", "rest-downswing", "waist-orbit",
]);
const COMBO_HANDS = new Set(["lead", "off", "both"]);
const COMBO_PATHS = new Set(["sweep", "fan", "dual-sweep", "capsule"]);
const RIBBON_PROFILES = new Set([
  "massed-wedge", "hooked-comma", "open-c", "guard-plane", "rising-plane", "broken-cross",
  "outer-crescent", "reverse-hairpin", "open-annulus", "head-wedge", "inward-hook", "heavy-sickle",
]);
const RIBBON_ENDS = new Set(["clean", "squared", "torn", "hooked", "open"]);
const COMBO_STEP_KEYS = new Set(["name", "motion", "direction", "hand", "timing", "path", "ribbon"]);
const COMBO_TIMING_KEYS = new Set([
  "activeStart", "activeEnd", "impact", "followEnd", "secondaryActiveStart", "secondaryActiveEnd",
]);
const COMBO_PATH_KEYS = new Set([
  "kind", "arcMultiplier", "deltaAngle", "rangeMultiplier", "damageMultiplier", "knockback",
]);
const COMBO_RIBBON_KEYS = new Set([
  "profile", "radialStart", "radialEnd", "widthMultiplier", "end", "setupEcho",
]);
const KATANA_HOOK_KINDS = new Set([
  "pair-half", "draw-opener", "perfect-tempo", "storm-tempo", "finisher-dash",
  "reach-crescendo", "haste-break", "finisher-burst", "perfect-guard", "colossal-release",
]);
const KATANA_HOOK_KEYS = new Set([
  "kind", "summary", "openerDamageMultiplier", "perfectWindowFraction", "perfectDamageMultiplier",
  "stackDamagePerBeat", "maxStacks", "finisherDamageMultiplier", "finisherDashImpulse",
  "reachPerBeat", "recoveryMultiplier", "nonFinisherDamageMultiplier", "toughFinisherMultiplier",
  "finisherBurst", "perfectInvulnerabilitySeconds",
]);
const KATANA_BURST_KEYS = new Set(["radius", "damage"]);
const PERFORMANCE_KEYS = new Set([
  "hold", "action", "continuous", "suppressSwing", "windupSeconds", "carryForwardPx", "shake",
  "carryAngleRad", "preThrowRevolutions", "lunge", "twirl", "holdScaling", "strideTap",
  "emitter", "vfxAt", "aura", "comboForwardPx", "edgeLeadFlip", "throwHeightPx", "frontflip",
  "vfxForwardPx", "preThrowDamage", "forwardDrift",
]);
const PERFORMANCE_HOLDS = new Set([
  "upright", "hanging-chain", "drag-at-feet", "steady", "aim-forward", "overhead", "shoulder-launcher",
  "walking-staff",
]);
const PERFORMANCE_ACTIONS = new Set([
  "default-swing", "hold", "page-flip", "shake", "spin", "recoil", "lunge-punch", "jab",
  "overhead-downswing", "throw-release",
]);
const PERFORMANCE_SHAKE_KEYS = new Set(["amplitudePx", "rotationRad", "frequencyHz"]);
const PERFORMANCE_LUNGE_KEYS = new Set(["distancePx", "durationSeconds", "invulnerable"]);
const PERFORMANCE_PRE_THROW_DAMAGE_KEYS = new Set(["damage", "range"]);
const PERFORMANCE_FORWARD_DRIFT_KEYS = new Set(["speedPxPerSecond", "durationSeconds"]);
const PERFORMANCE_TWIRL_KEYS = new Set(["plane", "pivot", "direction", "visualRevolutions"]);
const PERFORMANCE_HOLD_SCALING_KEYS = new Set(["cadence"]);
const PERFORMANCE_STRIDE_TAP_KEYS = new Set(["amplitudePx", "phaseOffset"]);
const PERFORMANCE_AURA_KEYS = new Set([
  "radius", "damagePerSecond", "resourcePerSecond", "tickRate", "color", "damageType",
]);
const HIT_STATUS_KEYS = new Set(["kind", "multiplier", "seconds"]);
const HIT_STATUS_KINDS = new Set(["slow"]);
const THROWN_ROTATIONS = new Set(["spin", "point-forward"]);
const SCATTER_AIMS = new Set(["cone", "radial-random"]);

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
function explodeOf(e, path, rMax, damageMax = 30) {
  if (e === undefined) return undefined;
  checkKeys(e, EXPLODE_KEYS, path);
  const out = {
    radius: num(e.radius, 30, rMax, 56, `${path}.radius`),
    damage: num(e.damage, 1, damageMax, 6, `${path}.damage`),
  };
  const g = grades(e.scalingGrades, `${path}.scalingGrades`, undefined);
  if (g) out.scalingGrades = g;
  return out;
}

function groundZoneOf(z, path = "behavior.zone") {
  if (z === undefined) return undefined;
  if (!z || typeof z !== "object") {
    fail(`${path} is not an object`);
    return undefined;
  }
  checkKeys(z, ZONE_KEYS, path);
  const out = {
    trigger: enumOf(z.trigger, ZONE_TRIGGERS, `${path}.trigger`),
    style: enumOf(z.style, ZONE_STYLES, `${path}.style`),
    initialRadius: num(z.initialRadius, 12, 240, 32, `${path}.initialRadius`),
    maxRadius: num(z.maxRadius, 12, 320, 96, `${path}.maxRadius`),
    growthPerSecond: num(z.growthPerSecond, 0, 240, 0, `${path}.growthPerSecond`),
    lingerSeconds: num(z.lingerSeconds, 0.25, 8, 2, `${path}.lingerSeconds`),
    damagePerSecond: num(z.damagePerSecond, 0, 120, 0, `${path}.damagePerSecond`),
    tickRate: beamTick(z.tickRate, `${path}.tickRate`),
    placementRange: num(z.placementRange, 40, 900, 240, `${path}.placementRange`),
  };
  if (out.maxRadius < out.initialRadius) fail(`${path}.maxRadius must be >= initialRadius`);
  const g = grades(z.scalingGrades, `${path}.scalingGrades`, undefined);
  if (g) out.scalingGrades = g;
  if (z.slowMultiplier !== undefined)
    out.slowMultiplier = num(z.slowMultiplier, 0.1, 1, 1, `${path}.slowMultiplier`);
  if (z.slowSeconds !== undefined)
    out.slowSeconds = num(z.slowSeconds, 0.05, 4, 0.5, `${path}.slowSeconds`);
  if (z.grenadeArcHeight !== undefined)
    out.grenadeArcHeight = num(z.grenadeArcHeight, 24, 240, 100, `${path}.grenadeArcHeight`);
  return out;
}

function comboBarOf(w) {
  if (w.comboBar === undefined) return undefined;
  if (!Array.isArray(w.comboBar)) {
    fail("comboBar is not an array");
    return undefined;
  }
  if (w.comboBar.length < 1 || w.comboBar.length > 8)
    fail(`comboBar has ${w.comboBar.length} beats; authored bars require 1..8`);
  const out = [];
  for (let i = 0; i < w.comboBar.length; i++) {
    const step = w.comboBar[i];
    const path = `comboBar[${i}]`;
    if (!step || typeof step !== "object" || Array.isArray(step)) {
      fail(`${path} is not an object`);
      continue;
    }
    checkKeys(step, COMBO_STEP_KEYS, path);
    const timing = step.timing;
    const movePath = step.path;
    if (!timing || typeof timing !== "object" || Array.isArray(timing)) {
      fail(`${path}.timing is not an object`);
      continue;
    }
    if (!movePath || typeof movePath !== "object" || Array.isArray(movePath)) {
      fail(`${path}.path is not an object`);
      continue;
    }
    checkKeys(timing, COMBO_TIMING_KEYS, `${path}.timing`);
    checkKeys(movePath, COMBO_PATH_KEYS, `${path}.path`);
    const activeStart = num(timing.activeStart, 0, 1, 0.2, `${path}.timing.activeStart`);
    const activeEnd = num(timing.activeEnd, 0, 1, 0.55, `${path}.timing.activeEnd`);
    const impact = num(timing.impact, 0, 1, activeEnd, `${path}.timing.impact`);
    const followEnd = num(timing.followEnd, 0, 1, 0.8, `${path}.timing.followEnd`);
    if (!(activeStart < activeEnd && impact >= activeStart && impact <= activeEnd && activeEnd <= followEnd))
      fail(`${path}.timing must satisfy activeStart < activeEnd, impact inside active, activeEnd <= followEnd`);
    const mapped = {
      name: typeof step.name === "string" ? step.name : `${path} unnamed beat`,
      motion: enumOf(step.motion, COMBO_MOTIONS, `${path}.motion`),
      direction: int(step.direction, -1, 1, 1, `${path}.direction`),
      hand: enumOf(step.hand, COMBO_HANDS, `${path}.hand`),
      timing: { activeStart, activeEnd, impact, followEnd },
      path: {
        kind: enumOf(movePath.kind, COMBO_PATHS, `${path}.path.kind`),
        arcMultiplier: num(movePath.arcMultiplier, -2, 2, 1, `${path}.path.arcMultiplier`),
        rangeMultiplier: num(movePath.rangeMultiplier, 0.5, 1.5, 1, `${path}.path.rangeMultiplier`),
        damageMultiplier: num(movePath.damageMultiplier, 0.5, 2, 1, `${path}.path.damageMultiplier`),
        knockback: num(movePath.knockback, 0, 160, 0, `${path}.path.knockback`),
      },
    };
    if (timing.secondaryActiveStart !== undefined)
      mapped.timing.secondaryActiveStart = num(
        timing.secondaryActiveStart, 0, 1, activeStart, `${path}.timing.secondaryActiveStart`,
      );
    if (timing.secondaryActiveEnd !== undefined)
      mapped.timing.secondaryActiveEnd = num(
        timing.secondaryActiveEnd, 0, 1, activeEnd, `${path}.timing.secondaryActiveEnd`,
      );
    if (movePath.deltaAngle !== undefined)
      mapped.path.deltaAngle = num(movePath.deltaAngle, -Math.PI * 4, Math.PI * 4, 0, `${path}.path.deltaAngle`);
    if (step.ribbon !== undefined) {
      const ribbon = step.ribbon;
      if (!ribbon || typeof ribbon !== "object" || Array.isArray(ribbon)) {
        fail(`${path}.ribbon is not an object`);
      } else {
        checkKeys(ribbon, COMBO_RIBBON_KEYS, `${path}.ribbon`);
        mapped.ribbon = {
          profile: enumOf(ribbon.profile, RIBBON_PROFILES, `${path}.ribbon.profile`),
          radialStart: num(ribbon.radialStart, 0, 0.95, 0.3, `${path}.ribbon.radialStart`),
          radialEnd: num(ribbon.radialEnd, 0.05, 1, 1, `${path}.ribbon.radialEnd`),
          widthMultiplier: num(ribbon.widthMultiplier, 0, 2, 1, `${path}.ribbon.widthMultiplier`),
          end: enumOf(ribbon.end, RIBBON_ENDS, `${path}.ribbon.end`),
        };
        if (ribbon.setupEcho !== undefined) {
          if (ribbon.setupEcho !== "neutral-dim") fail(`${path}.ribbon.setupEcho must be neutral-dim`);
          mapped.ribbon.setupEcho = ribbon.setupEcho;
        }
      }
    }
    out.push(mapped);
  }
  return out;
}

function katanaHookOf(h) {
  if (h === undefined) return undefined;
  if (!h || typeof h !== "object" || Array.isArray(h)) {
    fail("katanaHook is not an object");
    return undefined;
  }
  checkKeys(h, KATANA_HOOK_KEYS, "katanaHook");
  const out = {
    kind: enumOf(h.kind, KATANA_HOOK_KINDS, "katanaHook.kind"),
    summary: typeof h.summary === "string" ? h.summary : "",
  };
  if (!out.summary) fail("katanaHook.summary must be a non-empty string");
  const nums = {
    openerDamageMultiplier: [0.5, 2],
    perfectWindowFraction: [0.02, 0.5],
    perfectDamageMultiplier: [0.5, 2],
    stackDamagePerBeat: [0, 0.25],
    finisherDamageMultiplier: [0.5, 2.5],
    finisherDashImpulse: [0, 500],
    reachPerBeat: [0, 0.2],
    recoveryMultiplier: [0.7, 1.3],
    nonFinisherDamageMultiplier: [0.5, 1.5],
    toughFinisherMultiplier: [1, 3],
    perfectInvulnerabilitySeconds: [0, 0.2],
  };
  for (const [key, [lo, hi]] of Object.entries(nums))
    if (h[key] !== undefined) out[key] = num(h[key], lo, hi, 1, `katanaHook.${key}`);
  if (h.maxStacks !== undefined) out.maxStacks = int(h.maxStacks, 1, 7, 1, "katanaHook.maxStacks");
  if (h.finisherBurst !== undefined) {
    const burst = h.finisherBurst;
    if (!burst || typeof burst !== "object" || Array.isArray(burst)) {
      fail("katanaHook.finisherBurst is not an object");
    } else {
      checkKeys(burst, KATANA_BURST_KEYS, "katanaHook.finisherBurst");
      out.finisherBurst = {
        radius: num(burst.radius, 40, 240, 100, "katanaHook.finisherBurst.radius"),
        damage: num(burst.damage, 1, 30, 6, "katanaHook.finisherBurst.damage"),
      };
    }
  }
  return out;
}

function performanceOf(p) {
  if (p === undefined) return undefined;
  if (!p || typeof p !== "object" || Array.isArray(p)) {
    fail("performance is not an object");
    return undefined;
  }
  checkKeys(p, PERFORMANCE_KEYS, "performance");
  const out = {
    hold: enumOf(p.hold, PERFORMANCE_HOLDS, "performance.hold"),
    action: enumOf(p.action, PERFORMANCE_ACTIONS, "performance.action"),
  };
  if (p.continuous !== undefined) {
    if (typeof p.continuous !== "boolean") fail("performance.continuous is not a boolean");
    else out.continuous = p.continuous;
  }
  if (p.suppressSwing !== undefined) {
    if (typeof p.suppressSwing !== "boolean") fail("performance.suppressSwing is not a boolean");
    else out.suppressSwing = p.suppressSwing;
  }
  if (p.windupSeconds !== undefined)
    out.windupSeconds = num(p.windupSeconds, 0.1, 0.75, 0.5, "performance.windupSeconds");
  if (p.carryForwardPx !== undefined)
    out.carryForwardPx = num(p.carryForwardPx, 0, 80, 0, "performance.carryForwardPx");
  if (p.comboForwardPx !== undefined)
    out.comboForwardPx = num(p.comboForwardPx, 0, 120, 0, "performance.comboForwardPx");
  if (p.vfxForwardPx !== undefined)
    out.vfxForwardPx = num(p.vfxForwardPx, 0, 120, 0, "performance.vfxForwardPx");
  if (p.carryAngleRad !== undefined)
    out.carryAngleRad = num(p.carryAngleRad, -Math.PI, Math.PI, 0, "performance.carryAngleRad");
  if (p.preThrowRevolutions !== undefined)
    out.preThrowRevolutions = num(
      p.preThrowRevolutions, 0, 3, 0, "performance.preThrowRevolutions",
    );
  if (p.preThrowDamage !== undefined) {
    if (!p.preThrowDamage || typeof p.preThrowDamage !== "object" || Array.isArray(p.preThrowDamage)) {
      fail("performance.preThrowDamage is not an object");
    } else {
      checkKeys(p.preThrowDamage, PERFORMANCE_PRE_THROW_DAMAGE_KEYS, "performance.preThrowDamage");
      out.preThrowDamage = {
        damage: num(p.preThrowDamage.damage, 0.1, 60, 1, "performance.preThrowDamage.damage"),
        range: num(p.preThrowDamage.range, 20, 360, 100, "performance.preThrowDamage.range"),
      };
    }
  }
  if (p.forwardDrift !== undefined) {
    if (!p.forwardDrift || typeof p.forwardDrift !== "object" || Array.isArray(p.forwardDrift)) {
      fail("performance.forwardDrift is not an object");
    } else {
      checkKeys(p.forwardDrift, PERFORMANCE_FORWARD_DRIFT_KEYS, "performance.forwardDrift");
      out.forwardDrift = {
        speedPxPerSecond: num(p.forwardDrift.speedPxPerSecond, 8, 240, 60, "performance.forwardDrift.speedPxPerSecond"),
        durationSeconds: num(p.forwardDrift.durationSeconds, 0.05, 0.75, 0.3, "performance.forwardDrift.durationSeconds"),
      };
    }
  }
  if (p.edgeLeadFlip !== undefined) {
    if (typeof p.edgeLeadFlip !== "boolean") fail("performance.edgeLeadFlip is not a boolean");
    else out.edgeLeadFlip = p.edgeLeadFlip;
  }
  if (p.throwHeightPx !== undefined)
    out.throwHeightPx = num(p.throwHeightPx, 0, 80, 0, "performance.throwHeightPx");
  if (p.frontflip !== undefined) {
    if (typeof p.frontflip !== "boolean") fail("performance.frontflip is not a boolean");
    else out.frontflip = p.frontflip;
  }
  if (p.shake !== undefined) {
    if (!p.shake || typeof p.shake !== "object" || Array.isArray(p.shake)) {
      fail("performance.shake is not an object");
    } else {
      checkKeys(p.shake, PERFORMANCE_SHAKE_KEYS, "performance.shake");
      out.shake = {
        amplitudePx: num(p.shake.amplitudePx, 0, 12, 3, "performance.shake.amplitudePx"),
        rotationRad: num(p.shake.rotationRad, 0, 0.25, 0.05, "performance.shake.rotationRad"),
        frequencyHz: num(p.shake.frequencyHz, 1, 24, 11, "performance.shake.frequencyHz"),
      };
    }
  }
  if (p.lunge !== undefined) {
    if (!p.lunge || typeof p.lunge !== "object" || Array.isArray(p.lunge)) {
      fail("performance.lunge is not an object");
    } else {
      checkKeys(p.lunge, PERFORMANCE_LUNGE_KEYS, "performance.lunge");
      out.lunge = {
        distancePx: num(p.lunge.distancePx, 48, 720, 120, "performance.lunge.distancePx"),
      };
      if (p.lunge.durationSeconds !== undefined)
        out.lunge.durationSeconds = num(
          p.lunge.durationSeconds,
          0.05,
          0.6,
          0.2,
          "performance.lunge.durationSeconds",
        );
      if (p.lunge.invulnerable !== undefined) {
        if (typeof p.lunge.invulnerable !== "boolean")
          fail("performance.lunge.invulnerable is not a boolean");
        else out.lunge.invulnerable = p.lunge.invulnerable;
      }
    }
  }
  if (p.twirl !== undefined) {
    if (!p.twirl || typeof p.twirl !== "object" || Array.isArray(p.twirl)) {
      fail("performance.twirl is not an object");
    } else {
      checkKeys(p.twirl, PERFORMANCE_TWIRL_KEYS, "performance.twirl");
      out.twirl = {
        plane: enumOf(p.twirl.plane, new Set(["screen-circle", "ground-whirlwind"]), "performance.twirl.plane"),
        pivot: enumOf(p.twirl.pivot, new Set(["shaft-midpoint", "grip"]), "performance.twirl.pivot"),
        direction: enumOf(p.twirl.direction, new Set(["forward", "alternate"]), "performance.twirl.direction"),
      };
      if (p.twirl.visualRevolutions !== undefined)
        out.twirl.visualRevolutions = num(
          p.twirl.visualRevolutions, 1, 4, 1, "performance.twirl.visualRevolutions",
        );
    }
  }
  if (p.holdScaling !== undefined) {
    if (!p.holdScaling || typeof p.holdScaling !== "object" || Array.isArray(p.holdScaling)) {
      fail("performance.holdScaling is not an object");
    } else {
      checkKeys(p.holdScaling, PERFORMANCE_HOLD_SCALING_KEYS, "performance.holdScaling");
      out.holdScaling = {
        cadence: enumOf(
          p.holdScaling.cadence,
          new Set(["weapon-cooldown"]),
          "performance.holdScaling.cadence",
        ),
      };
    }
  }
  if (p.strideTap !== undefined) {
    if (!p.strideTap || typeof p.strideTap !== "object" || Array.isArray(p.strideTap)) {
      fail("performance.strideTap is not an object");
    } else {
      checkKeys(p.strideTap, PERFORMANCE_STRIDE_TAP_KEYS, "performance.strideTap");
      out.strideTap = {
        amplitudePx: num(p.strideTap.amplitudePx, 0, 24, 8, "performance.strideTap.amplitudePx"),
        phaseOffset: num(p.strideTap.phaseOffset, -Math.PI * 2, Math.PI * 2, 0, "performance.strideTap.phaseOffset"),
      };
    }
  }
  if (p.emitter !== undefined) out.emitter = enumOf(p.emitter, new Set(["spout"]), "performance.emitter");
  if (p.vfxAt !== undefined) out.vfxAt = enumOf(p.vfxAt, new Set(["impact"]), "performance.vfxAt");
  if (p.aura !== undefined) {
    if (!p.aura || typeof p.aura !== "object" || Array.isArray(p.aura)) {
      fail("performance.aura is not an object");
    } else {
      checkKeys(p.aura, PERFORMANCE_AURA_KEYS, "performance.aura");
      out.aura = {
        radius: num(p.aura.radius, 60, 450, 150, "performance.aura.radius"),
        damagePerSecond: num(p.aura.damagePerSecond, 1, 80, 18, "performance.aura.damagePerSecond"),
        resourcePerSecond: num(p.aura.resourcePerSecond, 1, 80, 20, "performance.aura.resourcePerSecond"),
        tickRate: num(p.aura.tickRate, 0.05, 0.5, 0.2, "performance.aura.tickRate"),
        color: int(p.aura.color, 0, 0xffffff, 0xffe24a, "performance.aura.color"),
      };
      if (p.aura.damageType !== undefined) {
        out.aura.damageType = enumOf(p.aura.damageType, new Set(["bio"]), "performance.aura.damageType");
      }
    }
  }
  return out;
}

function hitStatusOf(status) {
  if (status === undefined) return undefined;
  if (!status || typeof status !== "object" || Array.isArray(status)) {
    fail("hitStatus is not an object");
    return undefined;
  }
  checkKeys(status, HIT_STATUS_KEYS, "hitStatus");
  return {
    kind: enumOf(status.kind, HIT_STATUS_KINDS, "hitStatus.kind"),
    multiplier: num(status.multiplier, 0.1, 1, 0.5, "hitStatus.multiplier"),
    seconds: num(status.seconds, 0.05, 4, 0.5, "hitStatus.seconds"),
  };
}

function gripAnchorOf(anchor, path, allowedKeys = GRIP_ANCHOR_KEYS) {
  if (!anchor || typeof anchor !== "object" || Array.isArray(anchor)) {
    fail(`${path} is not an object`);
    return undefined;
  }
  checkKeys(anchor, allowedKeys, path);
  if (anchor.x === undefined) fail(`${path}.x is required`);
  if (anchor.y === undefined) fail(`${path}.y is required`);
  return {
    x: num(anchor.x, 0, 1, 0.5, `${path}.x`),
    y: num(anchor.y, 0, 1, 0.5, `${path}.y`),
  };
}

function gripPointsOf(points) {
  if (points === undefined) return undefined;
  if (!points || typeof points !== "object" || Array.isArray(points)) {
    fail("gripPoints is not an object");
    return undefined;
  }
  checkKeys(points, GRIP_POINTS_KEYS, "gripPoints");
  const primary = gripAnchorOf(points.primary, "gripPoints.primary");
  if (!primary) return undefined;
  const out = { primary };
  if (points.secondary !== undefined) {
    const secondary = gripAnchorOf(
      points.secondary,
      "gripPoints.secondary",
      SECONDARY_GRIP_KEYS,
    );
    if (secondary) {
      out.secondary = {
        ...secondary,
        role: enumOf(
          points.secondary.role,
          SECONDARY_GRIP_ROLES,
          "gripPoints.secondary.role",
        ),
      };
    }
  }
  return out;
}

function muzzleOffsetsOf(offsets, path = "behavior.muzzleOffsets") {
  if (offsets === undefined) return undefined;
  if (!Array.isArray(offsets) || offsets.length === 0 || offsets.length > WEAPON_MUZZLE_COUNT_CAP) {
    fail(`${path} must contain 1..${WEAPON_MUZZLE_COUNT_CAP} offsets`);
    return undefined;
  }
  return offsets.map((offset, index) => {
    const entryPath = `${path}[${index}]`;
    if (!offset || typeof offset !== "object" || Array.isArray(offset)) {
      fail(`${entryPath} is not an object`);
      return { forward: 0, lateral: 0 };
    }
    checkKeys(offset, MUZZLE_OFFSET_KEYS, entryPath);
    return {
      forward: num(offset.forward, -64, 64, 0, `${entryPath}.forward`),
      lateral: num(offset.lateral, -64, 64, 0, `${entryPath}.lateral`),
    };
  });
}

function handlingTagsOf(tags) {
  if (tags === undefined) return undefined;
  if (!Array.isArray(tags) || tags.length === 0) {
    fail("handlingTags must be a non-empty array");
    return undefined;
  }
  const out = [];
  for (const [index, tag] of tags.entries()) {
    const value = enumOf(tag, HANDLING_TAGS, `handlingTags[${index}]`);
    if (out.includes(value)) fail(`handlingTags contains duplicate ${JSON.stringify(value)}`);
    else out.push(value);
  }
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
  const isSingleShotGun = SINGLE_SHOT_GUN_IDS.has(w.id);
  const isCalamityHowitzer = w.id === "x2-calamity-howitzer";
  const explosionRadiusMax =
    w.id === "x2-brimstone-rocket-tube" || w.id === "x2-tidehook-bombarpoon"
      ? 220
      : isCalamityHowitzer
        ? 220
        : 140;
  const isGroundZone = kind === "groundZone";

  // Edge/swing baseline (required even for guns — the held-swing fields).
  const damage = num(s.damage, 1, 40, 8, "stats.damage");
  const gripPoints = gripPointsOf(w.gripPoints);
  const handlingTags = handlingTagsOf(w.handlingTags);
  const def = {
    id: w.id,
    name: w.name,
    expansion: w.expansion !== false,
    scalingGrades: grades(w.scalingGrades, "scalingGrades", { str: "B" }),
    damage,
    range: type === "ranged"
      ? num(s.range, 80, 320, 140, "stats.range")
      : num(s.range, 40, 1200, 140, "stats.range"),
    halfArc: num(s.halfArc, 0.3, 1.4, 0.85, "stats.halfArc"),
    cooldown: num(s.cooldown, 0.12, 1.5, 0.4, "stats.cooldown"),
    displayLength: num(s.displayLength, 40, 400, 90, "stats.displayLength"),
    swingArc: num(
      s.swingArc,
      w.swingStyle === "spin" ? Math.PI * 2 : 1.8,
      w.swingStyle === "spin" ? Math.PI * 6 : 3.4,
      w.swingStyle === "spin" ? Math.PI * 4 : 2.6,
      "stats.swingArc",
    ),
    gripFrac: num(s.gripFrac, 0.04, 0.5, 0.12, "stats.gripFrac"),
    tags: {
      grip,
      size,
      delivery: isGroundZone
        ? "ground-zone"
        : isBeam
          ? "beam"
          : isGun
            ? "projectile"
            : kind === "thrown"
              ? "thrown"
              : kind === "quake"
                ? "melee-slam"
                : kind === "glovePair"
                  ? "glove-pair"
                  : kind === "warp"
                    ? "warp"
                    : "melee-arc",
      fireMode: isGroundZone || isBeam || kind === "glovePair" ||
        (type === "melee" && w.performance?.continuous === true)
        ? "hold"
        : isGun && !isSingleShotGun
          ? "auto"
          : "tap-charge",
      element: typeof w.element === "string" ? w.element : "physical",
      classPool: type,
      family: typeof w.family === "string" ? w.family : "exotic",
      rangeBand,
      scaling: Array.isArray(w.scaling) && w.scaling.length ? w.scaling : ["STR"],
    },
  };
  if (w.archived === true) def.archived = true;
  if (gripPoints) def.gripPoints = gripPoints;
  if (handlingTags) def.tags.handling = handlingTags;
  if (w.description !== undefined) {
    if (typeof w.description !== "string") fail("description is not a string");
    else def.description = w.description;
  }
  if (w.sprite !== undefined) {
    if (typeof w.sprite !== "string" || !w.sprite) fail("sprite is not a non-empty string");
    else def.sprite = w.sprite;
  }
  if (w.sizeClass !== undefined) def.sizeClass = enumOf(w.sizeClass, SIZE_CLASSES, "sizeClass");
  if (w.stance !== undefined) def.stance = enumOf(w.stance, STANCES, "stance");
  if (w.authoritativeCombo !== undefined) {
    if (typeof w.authoritativeCombo !== "boolean") fail("authoritativeCombo is not a boolean");
    else def.authoritativeCombo = w.authoritativeCombo;
  }
  if (w.swingStyle !== undefined)
    def.swingStyle = enumOf(w.swingStyle, SWING_STYLES, "swingStyle");
  if (w.comboFamily !== undefined)
    def.comboFamily = enumOf(w.comboFamily, COMBO_FAMILIES, "comboFamily");
  if (w.comboVariant !== undefined) {
    if (typeof w.comboVariant !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(w.comboVariant))
      fail(`comboVariant = ${JSON.stringify(w.comboVariant)} must be a stable kebab-case id`);
    else def.comboVariant = w.comboVariant;
  }
  if (w.effectRecipe !== undefined)
    def.effectRecipe = enumOf(w.effectRecipe, EFFECT_RECIPES, "effectRecipe");
  if (w.effectEmitter !== undefined)
    def.effectEmitter = enumOf(w.effectEmitter, EFFECT_EMITTERS, "effectEmitter");
  if (w.effectTiming !== undefined)
    def.effectTiming = enumOf(w.effectTiming, EFFECT_TIMINGS, "effectTiming");
  if (w.renderAboveHands !== undefined) {
    if (typeof w.renderAboveHands !== "boolean") fail("renderAboveHands is not a boolean");
    else def.renderAboveHands = w.renderAboveHands;
  }
  if (w.suppressVfx !== undefined) {
    if (typeof w.suppressVfx !== "boolean") fail("suppressVfx is not a boolean");
    else def.suppressVfx = w.suppressVfx;
  }
  const hitStatus = hitStatusOf(w.hitStatus);
  if (hitStatus) def.hitStatus = hitStatus;
  const hook = katanaHookOf(w.katanaHook);
  if (hook) def.katanaHook = hook;
  const performance = performanceOf(w.performance);
  if (performance) def.performance = performance;
  if (w.bespokeVfxSheet !== undefined) {
    if (typeof w.bespokeVfxSheet !== "boolean") fail("bespokeVfxSheet is not a boolean");
    else def.bespokeVfxSheet = w.bespokeVfxSheet;
  }
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
      width: num(b.width, 4, 64, sizeWidth, "behavior.width"),
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
    if (b.randomRays !== undefined) {
      if (!b.randomRays || typeof b.randomRays !== "object" || Array.isArray(b.randomRays)) {
        fail("behavior.randomRays is not an object");
      } else {
        checkKeys(b.randomRays, RANDOM_RAY_KEYS, "behavior.randomRays");
        def.beam.randomRays = {
          count: int(b.randomRays.count, 2, 7, 5, "behavior.randomRays.count"),
          spread: num(b.randomRays.spread, 0.15, 1.25, 0.7, "behavior.randomRays.spread"),
        };
      }
    }
    const muzzleOffsets = muzzleOffsetsOf(b.muzzleOffsets);
    if (muzzleOffsets) def.beam.muzzleOffsets = muzzleOffsets;
    if (b.coneStream !== undefined) {
      if (!b.coneStream || typeof b.coneStream !== "object" || Array.isArray(b.coneStream)) {
        fail("behavior.coneStream is not an object");
      } else {
        checkKeys(b.coneStream, CONE_STREAM_KEYS, "behavior.coneStream");
        def.beam.coneStream = {
          halfAngle: num(
            b.coneStream.halfAngle,
            0.08,
            0.9,
            0.42,
            "behavior.coneStream.halfAngle",
          ),
          flavor: enumOf(
            b.coneStream.flavor,
            CONE_STREAM_FLAVORS,
            "behavior.coneStream.flavor",
          ),
        };
      }
    }
  } else if (isGun) {
    def.gun = {
      damage: num(b.damage, 1, isSingleShotGun ? 120 : 40, damage, "behavior.damage"),
      projectileSpeed: num(b.projectileSpeed, 400, 4000, 900, "behavior.projectileSpeed"),
      range: num(b.range ?? s.range, 280, 1100, 620, "behavior.range"),
      fireRate: num(
        b.fireRate,
        0.05,
        isCalamityHowitzer ? 3 : isSingleShotGun ? 1.5 : 0.9,
        0.3,
        "behavior.fireRate",
      ),
      magazine: int(b.magazine, 1, 80, 8, "behavior.magazine"),
      reloadSeconds: num(
        b.reloadSeconds,
        0.6,
        isCalamityHowitzer ? 5 : 3,
        1.4,
        "behavior.reloadSeconds",
      ),
      bulletKind: b.bulletKind === undefined ? "slug"
        : enumOf(b.bulletKind, BULLET_KINDS, "behavior.bulletKind"),
      muzzle: b.muzzle === undefined ? "punch"
        : enumOf(b.muzzle, MUZZLES, "behavior.muzzle"),
      recoil: num(b.recoil, 0.0004, 0.005, 0.0016, "behavior.recoil"),
    };
    if (b.projectileArt !== undefined)
      def.gun.projectileArt = enumOf(b.projectileArt, PROJECTILE_ARTS, "behavior.projectileArt");
    const muzzleOffsets = muzzleOffsetsOf(b.muzzleOffsets);
    if (muzzleOffsets) def.gun.muzzleOffsets = muzzleOffsets;
    if (b.muzzleMode !== undefined)
      def.gun.muzzleMode = enumOf(b.muzzleMode, MUZZLE_MODES, "behavior.muzzleMode");
    if (b.dualMuzzleSeparation !== undefined)
      def.gun.dualMuzzleSeparation = num(
        b.dualMuzzleSeparation, 0, 64, 0, "behavior.dualMuzzleSeparation",
      );
    if (b.sonicBoomRing !== undefined) {
      if (typeof b.sonicBoomRing !== "boolean") fail("behavior.sonicBoomRing is not a boolean");
      else def.gun.sonicBoomRing = b.sonicBoomRing;
    }
    if (b.projectileVisualScale !== undefined)
      def.gun.projectileVisualScale = num(
        b.projectileVisualScale, 0.5, 12, 1, "behavior.projectileVisualScale",
      );
    if (b.projectileColor !== undefined)
      def.gun.projectileColor = int(
        b.projectileColor, 0, 0xffffff, 0, "behavior.projectileColor",
      );
    if (b.userKnockbackMultiplier !== undefined)
      def.gun.userKnockbackMultiplier = num(
        b.userKnockbackMultiplier,
        0.25,
        4,
        1,
        "behavior.userKnockbackMultiplier",
      );
    if (b.arcHeight !== undefined)
      def.gun.arcHeight = num(b.arcHeight, 24, 180, 96, "behavior.arcHeight");
    if (b.burst !== undefined) {
      if (!b.burst || typeof b.burst !== "object" || Array.isArray(b.burst)) {
        fail("behavior.burst is not an object");
      } else {
        checkKeys(b.burst, GUN_BURST_KEYS, "behavior.burst");
        def.gun.burst = {
          count: int(b.burst.count, 2, 8, 2, "behavior.burst.count"),
          intervalSeconds: num(
            b.burst.intervalSeconds, 0.05, 0.3, 0.08, "behavior.burst.intervalSeconds",
          ),
        };
      }
    }
    const pellets = int(b.pellets, 1, 12, 1, "behavior.pellets");
    if (pellets > 1) def.gun.pellets = pellets;
    if (b.randomPellets !== undefined) {
      if (!b.randomPellets || typeof b.randomPellets !== "object" || Array.isArray(b.randomPellets)) {
        fail("behavior.randomPellets is not an object");
      } else {
        checkKeys(b.randomPellets, RANDOM_PELLET_KEYS, "behavior.randomPellets");
        if (b.pellets !== undefined) fail("behavior.randomPellets cannot be combined with behavior.pellets");
        const min = int(b.randomPellets.min, 1, 10, 1, "behavior.randomPellets.min");
        const max = int(b.randomPellets.max, min, 10, 10, "behavior.randomPellets.max");
        def.gun.randomPellets = {
          min,
          max,
          directions: enumOf(
            b.randomPellets.directions,
            new Set(["radial"]),
            "behavior.randomPellets.directions",
          ),
        };
      }
    }
    // Accuracy is independent of pellet count. The old conditional silently erased every authored
    // one-projectile spread (including Coyote Stinger), making those guns laser-accurate at runtime.
    if (b.spread !== undefined)
      def.gun.spread = num(b.spread, 0, 0.9, 0, "behavior.spread");
    const pierce = int(b.pierce, 1, 6, 1, "behavior.pierce");
    if (pierce > 1) def.gun.pierce = pierce;
    const bounces = int(b.bounces, 0, 6, 0, "behavior.bounces");
    if (bounces > 0) def.gun.bounces = bounces;
    const mc = b.muzzleColor === undefined ? undefined : int(b.muzzleColor, 0, 0xffffff, 0, "behavior.muzzleColor");
    if (mc !== undefined) def.gun.muzzleColor = mc;
    const gg = grades(b.scalingGrades, "behavior.scalingGrades", undefined);
    if (gg) def.gun.scalingGrades = gg;
    const ex = explodeOf(
      b.explode,
      "behavior.explode",
      explosionRadiusMax,
      isCalamityHowitzer ? 60 : 30,
    );
    if (ex) def.gun.explode = ex;
  } else if (kind === "glovePair") {
    def.glovePair = {
      auraColor: int(b.auraColor, 0, 0xffffff, 0x33e6ff, "behavior.auraColor"),
      auraRadius: num(b.auraRadius, 24, 90, 52, "behavior.auraRadius"),
    };
  } else if (kind === "warp") {
    def.warp = {
      burstRadius: num(b.burstRadius, 24, 100, 48, "behavior.burstRadius"),
    };
  } else if (kind === "thrown") {
    def.thrown = {
      speed: num(b.speed, 300, 1200, 680, "behavior.speed"),
      range: num(b.range, 200, 900, 520, "behavior.range"),
      damage: num(b.damage, 1, 40, damage, "behavior.damage"),
      charges: int(b.charges, 1, 6, 3, "behavior.charges"),
      refillSeconds: num(b.refillSeconds, 0.6, 4, 1.5, "behavior.refillSeconds"),
      pierce: int(b.pierce, 1, 5, 1, "behavior.pierce"),
    };
    if (b.arcHeight !== undefined)
      def.thrown.arcHeight = num(b.arcHeight, 24, 180, 88, "behavior.arcHeight");
    if (b.rotation !== undefined)
      def.thrown.rotation = enumOf(b.rotation, THROWN_ROTATIONS, "behavior.rotation");
    if (b.ricochetHops !== undefined)
      def.thrown.ricochetHops = int(b.ricochetHops, 0, 4, 0, "behavior.ricochetHops");
    if (b.ricochetRange !== undefined)
      def.thrown.ricochetRange = num(b.ricochetRange, 80, 900, 260, "behavior.ricochetRange");
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
    if (b.aim !== undefined) def.scatter.aim = enumOf(b.aim, SCATTER_AIMS, "behavior.aim");
    const pierce = int(b.pierce, 1, 5, 1, "behavior.pierce");
    if (pierce > 1) def.scatter.pierce = pierce;
    const g = grades(b.scalingGrades, "behavior.scalingGrades", undefined);
    if (g) def.scatter.scalingGrades = g;
    const ex = explodeOf(b.explode, "behavior.explode", 80);
    if (ex) def.scatter.explode = ex;
  }
  const groundZone = groundZoneOf(b.zone);
  if (groundZone) def.groundZone = groundZone;
  if (isGroundZone && groundZone?.trigger !== "channel")
    fail("behavior(groundZone).zone.trigger must be channel");
  // kind "edge" → plain melee (no behavior block).
  return def;
}

const data = JSON.parse(readFileSync(SRC, "utf8"));
const out = {};
const comboBars = {};
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
  if (w.expansion !== undefined && typeof w.expansion !== "boolean")
    fail("expansion is not a boolean");
  if (w.archived !== undefined && typeof w.archived !== "boolean")
    fail("archived is not a boolean");
  out[w.id] = mapWeapon(w);
  const comboBar = comboBarOf(w);
  if (comboBar) {
    if (!w.comboFamily || !w.comboVariant)
      fail("comboBar requires comboFamily + comboVariant");
    else if (comboBars[w.comboVariant]) fail(`duplicate comboVariant ${w.comboVariant}`);
    else comboBars[w.comboVariant] = comboBar;
  } else if (w.comboFamily !== undefined || w.comboVariant !== undefined) {
    fail("comboFamily/comboVariant require comboBar");
  }
}

if (errors.length) {
  console.error(`gen-weapon-expansion: ${errors.length} authoring error(s) — nothing written:`);
  for (const e of errors) console.error("  ✗ " + e);
  process.exit(1);
}

const banner =
  "// AUTO-GENERATED by tools/artkit/gen-weapon-expansion.mjs — DO NOT EDIT.\n" +
  "// Designed weapons codegen'd from data/weapon-concepts-300.json. Legacy rows default to expansion;\n" +
  "// explicit `expansion:false` rows are curated live. Generated combo bars feed shared melee presentation.\n" +
  "// Re-run the generator after editing concepts; never hand-edit the emitted TypeScript.\n";
const body =
  `import type { WeaponDef } from "./weapons.js";\n\n` +
  `export const GENERATED_WEAPONS: Record<string, WeaponDef> = ${JSON.stringify(out, null, 2)};\n\n` +
  `export const GENERATED_MELEE_COMBO_BARS = ${JSON.stringify(comboBars, null, 2)} as const;\n`;
emit(OUT, `${banner}\n${body}`, "weapons-expansion.generated.ts");

if (!isCheck) {
  const byType = { melee: 0, ranged: 0, caster: 0 };
  for (const id of Object.keys(out)) byType[out[id].tags.classPool]++;
  console.log(
    `wrote weapons-expansion.generated.ts — ${Object.keys(out).length} weapons / ` +
      `${Object.keys(comboBars).length} generated combo bars ` +
      `(melee ${byType.melee} / ranged ${byType.ranged} / caster ${byType.caster}); ` +
      `${clampCount} value(s) clamped to design bands` +
      (clampSamples.length ? ` (e.g. ${clampSamples.slice(0, 3).join("; ")})` : ""),
  );
}
