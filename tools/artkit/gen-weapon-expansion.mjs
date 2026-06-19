#!/usr/bin/env node
// artkit/gen-weapon-expansion.mjs — codegen the +300 §13 EXPANSION roster from the designed concepts
// (data/weapon-concepts-300.json) into a typed module the game merges into WEAPONS. Each entry is a valid
// WeaponDef flagged `expansion:true` so it's held OUT of the active roster (WEAPON_IDS) until curated in.
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

const clamp = (v, lo, hi, d) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
const GRADES = new Set(["S", "A", "B", "C", "D", "E"]);
const ATTRS = ["str", "dex", "int", "con", "luk"];

/** Keep only valid {attr: GRADE} pairs (lowercase attr key, S–E grade). */
function cleanGrades(g, fallback) {
  const out = {};
  if (g && typeof g === "object") {
    for (const a of ATTRS) {
      const v = typeof g[a] === "string" ? g[a].toUpperCase() : null;
      if (v && GRADES.has(v)) out[a] = v;
    }
  }
  return Object.keys(out).length ? out : fallback;
}
/** Keep only valid {attr: number≥1} requirement pairs. */
function cleanReqs(r) {
  const out = {};
  if (r && typeof r === "object") {
    for (const a of ATTRS) {
      const n = Math.round(Number(r[a]));
      if (Number.isFinite(n) && n > 1) out[a] = Math.min(20, n);
    }
  }
  return Object.keys(out).length ? out : undefined;
}

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

function mapWeapon(w) {
  const s = w.stats || {};
  const b = w.behavior || { kind: "edge" };
  const kind = b.kind || "edge";
  const type = w.type === "ranged" || w.type === "caster" ? w.type : "melee";
  const grip = ["1H", "2H", "dual", "mounted"].includes(w.grip) ? w.grip : "1H";
  const size = ["S", "M", "L", "XL"].includes(w.size) ? w.size : "M";
  const isGun = kind === "gun" || kind === "beam" || type === "ranged";

  // Edge/swing baseline (required even for guns — the held-swing fields).
  const damage = clamp(num(s.damage, 8), 1, 40, 8);
  const range = clamp(num(s.range, type === "ranged" ? 600 : 140), 40, 1200, 140);
  const def = {
    id: w.id,
    name: w.name,
    expansion: true,
    scalingGrades: cleanGrades(w.scalingGrades, { str: "B" }),
    damage,
    range: type === "ranged" ? clamp(num(s.range, 140), 80, 320, 140) : range,
    halfArc: clamp(num(s.halfArc, 0.85), 0.3, 1.4, 0.85),
    cooldown: clamp(num(s.cooldown, 0.4), 0.12, 1.5, 0.4),
    displayLength: clamp(num(s.displayLength, 90), 40, 400, 90),
    swingArc: clamp(num(s.swingArc, 2.6), 1.8, 3.4, 2.6),
    gripFrac: clamp(num(s.gripFrac, 0.12), 0.04, 0.5, 0.12),
    tags: {
      grip,
      size,
      delivery: isGun
        ? "projectile"
        : kind === "thrown"
          ? "thrown"
          : kind === "quake"
            ? "melee-slam"
            : "melee-arc",
      fireMode: isGun ? "auto" : "tap-charge",
      element: typeof w.element === "string" ? w.element : "physical",
      classPool: type,
      family: typeof w.family === "string" ? w.family : "exotic",
      rangeBand: ["close", "mid", "long"].includes(w.rangeBand) ? w.rangeBand : "close",
      scaling: Array.isArray(w.scaling) && w.scaling.length ? w.scaling : ["STR"],
    },
  };
  const reqs = cleanReqs(w.requirements);
  if (reqs) def.requirements = reqs;
  if (grip === "2H") def.twoHanded = true;
  if (grip === "dual") def.dual = true;
  if (type === "melee") def.durability = grip === "2H" ? 90 : 75;

  // Behavior block.
  if (isGun) {
    // `gun` for ranged + the `beam` casters (mapped to a fast tracer stream).
    const beam = kind === "beam";
    def.gun = {
      damage: clamp(num(b.damage, damage), 1, 40, 8),
      projectileSpeed: clamp(num(b.projectileSpeed, beam ? 1200 : 900), 400, 1600, 900),
      range: clamp(num(b.range, num(s.range, 620)), 280, 1100, 620),
      fireRate: clamp(num(b.fireRate, beam ? 0.1 : 0.3), 0.05, 0.9, 0.3),
      magazine: clamp(Math.round(num(b.magazine, beam ? 30 : 8)), 1, 80, 8),
      reloadSeconds: clamp(num(b.reloadSeconds, 1.4), 0.6, 3, 1.4),
      bulletKind: ["slug", "pellet", "tracer", "nail", "ricochet"].includes(b.bulletKind)
        ? b.bulletKind
        : beam
          ? "tracer"
          : "slug",
      muzzle: ["heavy", "boom", "rapid", "punch", "spark"].includes(b.muzzle)
        ? b.muzzle
        : beam
          ? "spark"
          : "punch",
      recoil: clamp(num(b.recoil, 0.0016), 0.0004, 0.005, 0.0016),
    };
    const pellets = Math.round(num(b.pellets, 1));
    if (pellets > 1) {
      def.gun.pellets = Math.min(12, pellets);
      def.gun.spread = clamp(num(b.spread, 0.4), 0.1, 0.9, 0.4);
    }
    const pierce = Math.round(num(b.pierce, 1));
    if (pierce > 1) def.gun.pierce = Math.min(6, pierce);
    if (b.explode && Number.isFinite(num(b.explode.radius, NaN))) {
      def.gun.explode = {
        radius: clamp(num(b.explode.radius, 56), 30, 90, 56),
        damage: clamp(num(b.explode.damage, 6), 1, 30, 6),
      };
    }
  } else if (kind === "thrown") {
    def.thrown = {
      speed: clamp(num(b.speed, 680), 300, 1200, 680),
      range: clamp(num(b.range, 520), 200, 900, 520),
      damage: clamp(num(b.damage, damage), 1, 40, 8),
      charges: clamp(Math.round(num(b.charges, 3)), 1, 6, 3),
      refillSeconds: clamp(num(b.refillSeconds, 1.5), 0.6, 4, 1.5),
      pierce: clamp(Math.round(num(b.pierce, 1)), 1, 5, 1),
    };
  } else if (kind === "quake") {
    def.quake = {
      radius: clamp(num(b.radius, 130), 70, 220, 130),
      damage: clamp(num(b.damage, 7), 1, 30, 7),
    };
  } else if (kind === "chainLightning") {
    def.chainLightning = {
      jumps: clamp(Math.round(num(b.jumps, 3)), 1, 6, 3),
      range: clamp(num(b.range, 180), 100, 240, 180),
      damage: clamp(num(b.damage, 5), 1, 24, 5),
      falloff: clamp(num(b.falloff, 0.8), 0.5, 1, 0.8),
    };
  } else if (kind === "scatter") {
    def.scatter = {
      count: clamp(Math.round(num(b.count, 6)), 2, 10, 6),
      spread: clamp(num(b.spread, 0.5), 0.2, 0.9, 0.5),
      speed: clamp(num(b.speed, 560), 300, 1000, 560),
      range: clamp(num(b.range, 360), 150, 700, 360),
      damage: clamp(num(b.damage, 5), 1, 24, 5),
    };
    if (b.explode && Number.isFinite(num(b.explode.radius, NaN))) {
      def.scatter.explode = {
        radius: clamp(num(b.explode.radius, 56), 30, 80, 56),
        damage: clamp(num(b.explode.damage, 6), 1, 24, 6),
      };
    }
  }
  // kind "edge"/unknown → plain melee (no behavior block).
  return def;
}

const data = JSON.parse(readFileSync(SRC, "utf8"));
const out = {};
let dupes = 0;
for (const w of data.weapons) {
  if (!w.id || !w.name) continue;
  if (out[w.id]) {
    dupes++;
    continue;
  }
  out[w.id] = mapWeapon(w);
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
      `(melee ${byType.melee} / ranged ${byType.ranged} / caster ${byType.caster}); ${dupes} dupe ids skipped`,
  );
}
