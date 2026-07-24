#!/usr/bin/env node
// artkit/build-weapon-vfx.mjs — bake the Weaponsmith-authored VFX (assignments.json) into a typed
// module the GAME imports, and copy the referenced painted/scatter assets into the client (§14 CODE-8).
// This is the "compiled output" bridge: the smith is the authoring source of truth; the game ships a
// generated snapshot (re-run after authoring). Counterpart to harvest-install / install-cards.
//
//   node build-weapon-vfx.mjs
// `--check` skips with a warning when untracked painted/scatter authoring artifacts are unavailable.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";
import { emit, isCheck } from "./lib/emit.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)));
const REPO = resolve(ROOT, "..", "..");
const OUT = join(ROOT, "out");
const ASSIGN = join(REPO, "tools", "weaponsmith", "assignments.json");
// §14 AUDIT-4 fix: intentional hand-overrides for the generated output (e.g. force a layer OFF that the
// smith can't express, or pin a value). Merged AFTER generation so a re-bake can NEVER clobber them — the
// generated file stays a pure function of (assignments.json ⊕ this). Edit THIS, never the .generated.ts.
const OVERRIDES = join(ROOT, "weapon-vfx-overrides.json");
const CLIENT_VFX_PUB = join(REPO, "packages", "client", "public", "vfx");
const GEN_TS = join(REPO, "packages", "client", "src", "vfx", "weapon-vfx.generated.ts");

// Load the canonical layer registry (sets globalThis.VFXLAYERS) for per-param defaults.
await import(pathToFileURL(join(REPO, "packages", "client", "src", "vfx", "vfx-layers.js")).href);
const LAYERS = (globalThis.VFXLAYERS || {}).LAYERS || {};
const defaultsFor = (lid) => Object.fromEntries((LAYERS[lid]?.params || []).map((p) => [p.key, p.def]));

const assignments = JSON.parse(readFileSync(ASSIGN, "utf8"));
if (isCheck && existsSync(GEN_TS)) {
  const committed = readFileSync(GEN_TS, "utf8");
  const requiredArtifacts = [];
  for (const match of committed.matchAll(/hero: "vfx\/([^"/]+)\.png"/g)) {
    const id = match[1];
    const assignment = assignments[id];
    const vfx = assignment?.vfxSubject || `vfx-${id}`;
    requiredArtifacts.push(join(OUT, vfx, "sheets", assignment?.image || "candidate-1.keyed.png"));
  }
  for (const match of committed.matchAll(/url: "vfx\/([^"/]+)-scatter\.png"/g)) {
    const id = match[1];
    const vfx = assignments[id]?.vfxSubject || `vfx-${id}`;
    requiredArtifacts.push(join(OUT, vfx, "scatter", "meta.json"));
    requiredArtifacts.push(join(OUT, vfx, "scatter", "sheet.png"));
  }
  const missingArtifacts = requiredArtifacts.filter((file) => !existsSync(file));
  if (missingArtifacts.length > 0) {
    console.warn(
      `⚠ weapon-vfx.generated.ts check SKIPPED — ${missingArtifacts.length} untracked VFX authoring ` +
        "artifact(s) are unavailable under tools/artkit/out/.",
    );
    process.exit(0);
  }
}
if (!isCheck) mkdirSync(CLIENT_VFX_PUB, { recursive: true });

const hasPaintedCandidates = (vfx) => {
  const dir = join(OUT, vfx, "sheets");
  return existsSync(dir) && readdirSync(dir).some((f) => /candidate-\d+\.keyed\.png$/.test(f));
};

const out = {};
for (const [id, a] of Object.entries(assignments)) {
  const vfx = a.vfxSubject || `vfx-${id}`;
  const authored = a.suite || {};
  const scatterMeta = (() => {
    const m = join(OUT, vfx, "scatter", "meta.json");
    return existsSync(m) ? JSON.parse(readFileSync(m, "utf8")) : null;
  })();
  const painted = hasPaintedCandidates(vfx) && !scatterMeta; // scatter weapons consume the cluster, no static hero

  // Only the ENABLED layers ship (registry defaults ⊕ authored params), plus hero-skin when the weapon
  // has painted art. Off layers are noise — the renderer skips them anyway.
  const suite = {};
  for (const [lid, s] of Object.entries(authored)) {
    if (lid === "hero-skin" || !s.on) continue;
    suite[lid] = { on: true, params: { ...defaultsFor(lid), ...(s.params || {}) } };
  }
  if (painted) suite["hero-skin"] = { on: true, params: { ...defaultsFor("hero-skin") } };

  // §14 authored VFX origin + spawn-at-cursor (mouse-placed in the smith).
  const vfxOrigin =
    a.vfxOrigin && (a.vfxOrigin.x || a.vfxOrigin.y)
      ? { x: a.vfxOrigin.x | 0, y: a.vfxOrigin.y | 0 }
      : null;
  const spawnAtCursor = !!a.spawnAtCursor;

  // Emit an entry when there's anything to render OR an authored value to carry (a melee weapon may have
  // no layers but a tuned vfxRadius / placed origin / cursor-spawn — those must still reach the game).
  const hasAny = Object.keys(suite).length > 0 || scatterMeta;
  if (!hasAny && a.vfxRadius == null && !vfxOrigin && !spawnAtCursor) continue;

  const entry = { suite, rot: a.rot || 0 };
  if (a.vfxRadius != null) entry.vfxRadius = a.vfxRadius; // §14 fixed per-weapon VFX size (px)
  if (vfxOrigin) entry.vfxOrigin = vfxOrigin; // §14 authored spawn offset (game px) from the anchor
  if (spawnAtCursor) entry.spawnAtCursor = true; // §14 spawn at the in-game cursor (quake-style)

  // Copy the painted hero candidate → public/vfx/<id>.png
  if (painted) {
    const img = a.image || "candidate-1.keyed.png";
    const src = join(OUT, vfx, "sheets", img);
    if (existsSync(src)) {
      if (!isCheck) copyFileSync(src, join(CLIENT_VFX_PUB, `${id}.png`));
      entry.hero = `vfx/${id}.png`;
    }
  }
  // Copy the scatter spritesheet → public/vfx/<id>-scatter.png
  if (scatterMeta) {
    const src = join(OUT, vfx, "scatter", "sheet.png");
    if (existsSync(src)) {
      if (!isCheck) copyFileSync(src, join(CLIENT_VFX_PUB, `${id}-scatter.png`));
      entry.scatter = { url: `vfx/${id}-scatter.png`, frameWidth: scatterMeta.frameWidth, frameHeight: scatterMeta.frameHeight, count: scatterMeta.count };
    }
  }
  out[id] = entry;
}

// §14 AUDIT-4: apply hand-overrides AFTER generation (deep-merged) so re-baking preserves them. Each
// override is a partial WeaponVfx; nested `suite.<layer>` and `params` merge key-by-key. `null` for a
// suite layer DELETES it from the output (the way to force a generated-on layer off).
const deepMerge = (base, ov) => {
  const out = { ...base };
  for (const [k, v] of Object.entries(ov)) {
    if (v === null) delete out[k];
    else if (v && typeof v === "object" && !Array.isArray(v) && out[k] && typeof out[k] === "object") {
      out[k] = deepMerge(out[k], v);
    } else out[k] = v;
  }
  return out;
};
const overrides = existsSync(OVERRIDES) ? JSON.parse(readFileSync(OVERRIDES, "utf8")) : {};
let overrideCount = 0;
for (const [id, ov] of Object.entries(overrides)) {
  if (id.startsWith("//")) continue; // allow "//comment" keys in the overrides file
  out[id] = deepMerge(out[id] || { suite: {}, rot: 0 }, ov);
  overrideCount++;
}

const banner = "// AUTO-GENERATED by tools/artkit/build-weapon-vfx.mjs — DO NOT EDIT.\n" +
  "// Bakes the Weaponsmith-authored VFX suites (assignments.json) ⊕ weapon-vfx-overrides.json (hand-edits\n" +
  "// that survive re-bakes — §14 AUDIT-4) for the live game (§14 CODE-8). To change output, edit those\n" +
  "// SOURCES then re-run `node tools/artkit/build-weapon-vfx.mjs` — never hand-edit this file.\n";
const types =
  "export interface WeaponVfxLayer { on: boolean; params: Record<string, number>; }\n" +
  "export interface WeaponVfxPaintedAura {\n" +
  "  textureKey: string;\n" +
  "  url: string;\n" +
  "  /** Final width relative to the exact authoritative aura diameter. */\n" +
  "  diameterMultiplier: number;\n" +
  "  verticalScale: number;\n" +
  "  layers: number[];\n" +
  "  alpha: number;\n" +
  "  subjects: string[];\n" +
  "}\n" +
  "export interface WeaponVfxPaintedSwing {\n" +
  "  textureKey: string;\n" +
  "  url: string;\n" +
  "  /** Final forward width relative to the exact authoritative melee extent. */\n" +
  "  extentMultiplier: number;\n" +
  "  originX: number;\n" +
  "  tint: number;\n" +
  "  lifeMs: number;\n" +
  "  subjects: string[];\n" +
  "}\n" +
  "export interface WeaponVfxPaintedQuake {\n" +
  "  textureKey: string;\n" +
  "  url: string;\n" +
  "  /** Final width relative to the exact authoritative quake diameter. */\n" +
  "  diameterMultiplier: number;\n" +
  "  lifeMs: number;\n" +
  "  subjects: string[];\n" +
  "  removedSubjects: string[];\n" +
  "}\n" +
  "export type WeaponVfxGeneratedImageKind =\n" +
  "  | \"fire-dragon-sweep\"\n" +
  "  | \"purple-crystal-burst\"\n" +
  "  | \"arcane-lance-projectile\"\n" +
  "  | \"fan-tornado\";\n" +
  "export interface WeaponVfxGeneratedImageBase {\n" +
  "  textureKey: string;\n" +
  "  url: string;\n" +
  "  subject: string;\n" +
  "  signature: string;\n" +
  "  audioCue: string;\n" +
  "  lifeMs: number;\n" +
  "  poolSize: number;\n" +
  "  /** Optional held-blade affine registration; length 1 overlays the physical blade without extending reach. */\n" +
  "  bladeOverlay?: { lengthMultiplier: number; widthMultiplier: number };\n" +
  "}\n" +
  "export interface WeaponVfxGeneratedImageReplacement extends WeaponVfxGeneratedImageBase {\n" +
  "  kind: Exclude<WeaponVfxGeneratedImageKind, \"fan-tornado\">;\n" +
  "}\n" +
  "export interface WeaponVfxGeneratedImageFanTornado extends WeaponVfxGeneratedImageBase {\n" +
  "  kind: \"fan-tornado\";\n" +
  "  /** Uniform growth above the shared damage envelope; never shrinks below it. */\n" +
  "  scalePulse: number;\n" +
  "}\n" +
  "export type WeaponVfxGeneratedImage =\n" +
  "  | WeaponVfxGeneratedImageReplacement\n" +
  "  | WeaponVfxGeneratedImageFanTornado;\n" +
  "export interface WeaponVfx {\n" +
  "  suite: Record<string, WeaponVfxLayer>;\n" +
  "  rot: number;\n" +
  "  /** Fixed authored VFX radius (px); falls back to VFX_RADIUS_DEFAULT (74) when absent. */\n" +
  "  vfxRadius?: number;\n" +
  "  /** Authored VFX spawn offset (game px) from the weapon anchor, applied rotated by aim (§14). */\n" +
  "  vfxOrigin?: { x: number; y: number };\n" +
  "  /** When true the VFX spawns at the in-game cursor (clamped, greatsword-quake style) (§14). */\n" +
  "  spawnAtCursor?: boolean;\n" +
  "  /** Texture path under public/ for the painted hero skin (e.g. \"vfx/rattler-sabre.png\"). */\n" +
  "  hero?: string;\n" +
  "  scatter?: { url: string; frameWidth: number; frameHeight: number; count: number };\n" +
  "  /** Suppress the synthesized suite when an explicit painted treatment owns the full silhouette. */\n" +
  "  suppressFallback?: boolean;\n" +
  "  paintedAura?: WeaponVfxPaintedAura;\n" +
  "  paintedSwing?: WeaponVfxPaintedSwing;\n" +
  "  paintedQuake?: WeaponVfxPaintedQuake;\n" +
  "  /** Generated-image subject that authoritatively replaces this weapon's procedural treatment. */\n" +
  "  generatedImage?: WeaponVfxGeneratedImage;\n" +
  "}\n";
emit(
  GEN_TS,
  `${banner}\n${types}\nexport const WEAPON_VFX: Record<string, WeaponVfx> = ${JSON.stringify(out, null, 2)};\n`,
  "weapon-vfx.generated.ts",
);

const ids = Object.keys(out);
if (!isCheck) {
  console.log(
    `wrote weapon-vfx.generated.ts — ${ids.length} weapon(s), ${overrideCount} override(s) applied: ${ids.join(", ")}`,
  );
  for (const id of ids) {
    console.log(
      `  ${id}: ${Object.keys(out[id].suite).filter((k) => out[id].suite[k].on).join("+") || "(no layers)"}${out[id].hero ? " +hero" : ""}${out[id].scatter ? " +scatter" : ""}`,
    );
  }
}
