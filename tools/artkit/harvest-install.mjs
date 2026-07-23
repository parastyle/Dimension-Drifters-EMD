#!/usr/bin/env node
// artkit/harvest-install.mjs — wire sliced sprite parts into the game client (INFRA-4).
//
// artkit out/ is gitignored scratch; the GAME consumes a tracked, sliced subset. This
// step bridges the two: for each subject it (1) slices the keyed identity-ref if not
// already sliced, (2) copies the part PNGs into packages/client/public/sprites/<id>/,
// and (3) regenerates packages/client/src/sprites/manifest.ts — a typed manifest the
// client imports statically (no runtime fetch; body/head/limb offsets drive the procedural rig).
//
//   node harvest-install.mjs --ids=drifter
//   node harvest-install.mjs --ids=drifter,critter,boothill --kind=character
//
// Re-run any time you re-slice or promote a new anchor; it's idempotent.

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import sharp from "sharp";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)));
const CLIENT_PUBLIC = resolve(ROOT, "..", "..", "packages", "client", "public", "sprites");
const CLIENT_SRC = resolve(ROOT, "..", "..", "packages", "client", "src", "sprites");

const args = process.argv.slice(2);
const arg = (k, d) => {
  const hit = args.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.slice(k.length + 3) : d;
};
const ids = (arg("ids", "") || "").split(",").map((s) => s.trim()).filter(Boolean);
const kind = arg("kind", "character");

// --- Pre-size to game-res (best practice) ---------------------------------
// Codex masters are ~1000-1700px; the rig draws them at ~84px (character body) or
// ≤124px (weapon). Shipping the full-res texture and minifying ~8-18x at runtime with
// no mipmaps is what makes HD art shimmer/alias ("janky"). Fix: bake a derived sprite at
// ~2x its on-screen footprint with a Lanczos resample, and scale the manifest geometry by
// the SAME factor so the rig math (scale = TARGET_BODY_H / body.h; positions = ox*scale)
// is byte-for-byte unchanged. The full-res master stays untouched in out/<id>/parts/.
const PRESIZE = arg("presize", "1") !== "0";
const CHAR_BODY_TARGET = Number(arg("char-target", "168")); // source body height after presize (≈2x the 84px draw)
const WEAPON_LONG_TARGET = Number(arg("weapon-target", "256")); // source longest side floor (≈2x the ≤124px draw)

// A weapon's pre-size target scales with its on-screen length (`displayLength` in weapons.ts) — a
// long sword (e.g. displayLength 320) needs a ~640px texture, not the 256 floor, or it upscales soft.
const WEAPONS_TS = resolve(ROOT, "..", "..", "packages", "shared", "src", "weapons.ts");
const DISPLAY_LEN = (() => {
  const map = {};
  try {
    let src = readFileSync(WEAPONS_TS, "utf8");
    src = src.slice(src.indexOf("export const WEAPONS")); // skip the interface (it also has `tags:`)
    // Line-anchored to 2-space (weapon-level) indent so nested keys (tags/quake/thrown) never match.
    const re = /^ {2}"?([a-z0-9-]+)"?:\s*\{[ \t]*\n([\s\S]*?)\n {2}\},/gm;
    for (let m = re.exec(src); m; m = re.exec(src)) {
      const dl = m[2].match(/displayLength:\s*([0-9.]+)/);
      if (dl) map[m[1]] = Number(dl[1]);
    }
  } catch {}
  return map;
})();
const r2 = (n) => Math.round(n * 100) / 100;
if (ids.length === 0) {
  console.error("Usage: node harvest-install.mjs --ids=drifter[,critter,...] [--kind=character|weapon]");
  process.exit(2);
}

const log = (m) => console.log(`[install] ${m}`);

function ensureSliced(id) {
  const partsJson = join(ROOT, "out", id, "parts", "parts.json");
  if (existsSync(partsJson)) return partsJson;
  log(`slicing ${id} (no parts.json yet)`);
  const r = spawnSync(process.execPath, [join(ROOT, "guards", "slice.mjs"), `--id=${id}`, `--kind=${kind}`], {
    cwd: ROOT,
    stdio: "inherit",
  });
  if (r.status !== 0 || !existsSync(partsJson)) throw new Error(`slice failed for ${id}`);
  return partsJson;
}

const entries = [];
for (const id of ids) {
  const partsJson = ensureSliced(id);
  const manifest = JSON.parse(readFileSync(partsJson, "utf8"));
  const srcDir = join(ROOT, "out", id, "parts");
  const dstDir = join(CLIENT_PUBLIC, id);
  rmSync(dstDir, { recursive: true, force: true });
  mkdirSync(dstDir, { recursive: true });

  // Resize factor: shrink the largest dimension down to ~2x its on-screen footprint.
  const isWeapon = manifest.kind === "weapon";
  let scale = 1;
  if (PRESIZE) {
    if (isWeapon) {
      const longest = Math.max(...manifest.parts.map((p) => Math.max(p.w, p.h)));
      // ≈2x the on-screen length, with a 256px floor — long swords keep crisp textures.
      const target = Math.max(WEAPON_LONG_TARGET, Math.round((DISPLAY_LEN[manifest.id] ?? 0) * 2));
      scale = Math.min(1, target / longest);
    } else {
      scale = Math.min(1, CHAR_BODY_TARGET / manifest.body.h);
    }
  }
  const fileToPart = new Map(manifest.parts.map((p) => [p.file, p]));

  for (const f of readdirSync(srcDir)) {
    if (!f.endsWith(".png")) continue;
    const part = fileToPart.get(f);
    if (PRESIZE && scale < 1 && part) {
      // Lanczos downscale of the part (sharp premultiplies alpha → no edge halos), then
      // record the actual output dims back into the manifest part.
      const out = await sharp(join(srcDir, f))
        .resize(Math.max(1, Math.round(part.w * scale)), Math.max(1, Math.round(part.h * scale)), {
          kernel: "lanczos3",
          fit: "fill",
        })
        .png({ compressionLevel: 9 })
        .toBuffer({ resolveWithObject: true });
      writeFileSync(join(dstDir, f), out.data);
      part.w = out.info.width;
      part.h = out.info.height;
    } else {
      cpSync(join(srcDir, f), join(dstDir, f));
    }
  }

  // Scale the rest of the geometry (positions/centroids/bbox/canvas) by the same factor so
  // the rig renders identically — just from a smaller, cleaner texture.
  if (PRESIZE && scale < 1) {
    for (const p of manifest.parts) {
      p.cx = r2(p.cx * scale);
      p.cy = r2(p.cy * scale);
      p.ox = r2(p.ox * scale);
      p.oy = r2(p.oy * scale);
    }
    manifest.canvas.w = Math.round(manifest.canvas.w * scale);
    manifest.canvas.h = Math.round(manifest.canvas.h * scale);
    manifest.body.cx = r2(manifest.body.cx * scale);
    manifest.body.cy = r2(manifest.body.cy * scale);
    // Keep body.{w,h} identical to the resized body part so scale = TARGET_BODY_H/body.h is exact.
    const bodyPart = manifest.parts.find((p) => p.role === "body") ?? manifest.parts[0];
    manifest.body.w = bodyPart.w;
    manifest.body.h = bodyPart.h;
  }

  entries.push(manifest);
  const tag = PRESIZE && scale < 1 ? `presized ×${r2(scale)} (body.h→${manifest.body.h})` : "full-res";
  log(`${id}: ${manifest.parts.length} part(s) → public/sprites/${id}/  [${tag}]`);
}

// Merge with any previously-installed subjects so installing one doesn't drop others.
mkdirSync(CLIENT_SRC, { recursive: true });
const manifestTs = join(CLIENT_SRC, "manifest.ts");
let existing = {};
if (existsSync(manifestTs)) {
  const m = readFileSync(manifestTs, "utf8").match(/export const SPRITES\s*=\s*(\{[\s\S]*\})\s*as const satisfies/);
  if (m) {
    try {
      // The generated manifest is a TS object literal (unquoted keys, trailing commas) — NOT valid JSON.
      // Normalise to JSON before parsing so an incremental install MERGES with (doesn't clobber) the
      // previously-installed subjects. (Bug fix: a bare JSON.parse here silently dropped every prior sprite.)
      const json = m[1]
        .replace(/([{,]\s*)([A-Za-z_][\w-]*)\s*:/g, '$1"$2":') // quote unquoted keys
        .replace(/,(\s*[}\]])/g, "$1"); // strip trailing commas
      existing = JSON.parse(json);
    } catch {
      existing = {};
    }
  }
}
for (const e of entries) existing[e.id] = e;
const sorted = Object.fromEntries(Object.keys(existing).sort().map((k) => [k, existing[k]]));

const header = `// AUTO-GENERATED by tools/artkit/harvest-install.mjs — do not edit by hand.
// Sliced sprite-part geometry for the procedural character/enemy rig (§18, §28.11).
// PNGs are served from /sprites/<id>/<file>; offsets (ox,oy) are source-pixel centroid
// deltas from the body centroid — the rig scales by (targetBodyHeight / body.h).

export interface SpritePart {
  role: string;
  file: string;
  w: number;
  h: number;
  cx: number;
  cy: number;
  ox: number;
  oy: number;
}
export interface SpriteManifest {
  id: string;
  kind: string;
  canvas: { w: number; h: number };
  body: { cx: number; cy: number; w: number; h: number };
  parts: SpritePart[];
}

export const SPRITES = ${JSON.stringify(sorted, null, 2)} as const satisfies Record<string, SpriteManifest>;

export type SpriteId = keyof typeof SPRITES;
`;
writeFileSync(manifestTs, header);
log(`wrote manifest.ts (${Object.keys(sorted).length} subject(s): ${Object.keys(sorted).join(", ")})`);

// §28 re-pack the sprite MULTIATLAS so the client's single `load.multiatlas` matches the new parts/manifest
// (the perf-critical horde-render path). Keeps the review-UI install loop + manual re-slices consistent.
const atlas = spawnSync(process.execPath, [join(ROOT, "pack-atlas.mjs")], { cwd: ROOT, encoding: "utf8" });
if (atlas.status === 0) log((atlas.stdout || "").trim().split("\n").pop() || "re-packed sprite atlas");
else log(`⚠ pack-atlas failed (run it manually): ${(atlas.stderr || "").slice(-200)}`);
