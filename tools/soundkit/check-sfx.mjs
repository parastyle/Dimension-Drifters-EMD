#!/usr/bin/env node
// soundkit/check-sfx.mjs — validate that every sfx-manifest.json entry has its installed file(s) under
// packages/client/public/audio/sfx/ (one per variation: <id>.mp3 or <id>-vN.mp3) and that no orphan
// files sit in that directory. Prints a table summary.
// Exit 1 if any PRIORITY-1 sound is missing; 0 otherwise (P2+ gaps and orphans are warnings only).
//
//   node tools/soundkit/check-sfx.mjs [--manifest <path>]
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, "../..");
const DST = resolve(REPO, "packages/client/public/audio/sfx");

let manifestPath = resolve(here, "sfx-manifest.json");
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--manifest") {
    manifestPath = resolve(args[++i] ?? "");
    if (!args[i]) fatal("--manifest requires a path");
  } else fatal(`unknown argument: ${args[i]} (expected --manifest <path>)`);
}

function fatal(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

// Same defensive contract as gen-sfx.mjs: skip malformed entries with a warning.
function validateEntries(rawEntries, warn = (m) => console.warn(`⚠ ${m}`)) {
  // Accept both manifest shapes: a bare array, or the designed { version, categories, sounds: [...] }.
  if (rawEntries && !Array.isArray(rawEntries) && Array.isArray(rawEntries.sounds)) rawEntries = rawEntries.sounds;
  if (!Array.isArray(rawEntries)) return null;
  const good = [];
  const seen = new Set();
  for (let i = 0; i < rawEntries.length; i++) {
    const e = rawEntries[i];
    const where = `manifest entry ${i}${e && typeof e.id === "string" ? ` (${e.id})` : ""}`;
    if (e == null || typeof e !== "object") { warn(`${where}: not an object — skipped`); continue; }
    if (typeof e.id !== "string" || !/^[a-z0-9][a-z0-9._-]*$/i.test(e.id)) { warn(`${where}: bad id — skipped`); continue; }
    if (seen.has(e.id)) { warn(`${where}: duplicate id — skipped`); continue; }
    if (typeof e.prompt !== "string" || e.prompt.trim().length === 0) { warn(`${where}: missing/empty prompt — skipped`); continue; }
    if (!Number.isInteger(e.priority) || e.priority < 1) { warn(`${where}: priority must be a positive integer — skipped`); continue; }
    let dur = e.durationSeconds;
    if (typeof dur !== "number" || !Number.isFinite(dur)) {
      warn(`${where}: durationSeconds must be a number — skipped`); continue;
    }
    // ElevenLabs sound-generation accepts 0.5–22s; authored game durations can be shorter (a 0.35s
    // whoosh) or longer — CLAMP to the API window instead of dropping the sound.
    if (dur < 0.5 || dur > 22) {
      const clamped = Math.min(22, Math.max(0.5, dur));
      warn(`${where}: durationSeconds ${dur} clamped to ${clamped} (API window 0.5–22)`);
      dur = clamped;
    }
    const variations = e.variations == null ? 1 : e.variations;
    if (!Number.isInteger(variations) || variations < 1 || variations > 8) { warn(`${where}: variations must be an integer in [1, 8] — skipped`); continue; }
    if (e.loop != null && typeof e.loop !== "boolean") { warn(`${where}: loop must be boolean — skipped`); continue; }
    seen.add(e.id);
    good.push({ id: e.id, category: e.category ?? "?", priority: e.priority, variations });
  }
  return good;
}

function variationFiles(entry) {
  if (entry.variations <= 1) return [`${entry.id}.mp3`];
  return Array.from({ length: entry.variations }, (_, k) => `${entry.id}-v${k + 1}.mp3`);
}

if (!existsSync(manifestPath)) fatal(`manifest not found: ${manifestPath}`);
let entries;
try {
  entries = validateEntries(JSON.parse(readFileSync(manifestPath, "utf8")));
} catch (err) {
  fatal(`cannot parse ${manifestPath}: ${err.message}`);
}
if (entries == null) fatal(`${manifestPath}: top level must be a JSON array of entries`);

const installedFiles = new Set(
  existsSync(DST)
    ? readdirSync(DST).filter((f) => {
        try { return statSync(resolve(DST, f)).isFile(); } catch { return false; }
      })
    : [],
);

// ---------------------------------------------------------------- table
const rows = [];
let missingP1 = 0;
let missingOther = 0;
const expected = new Set();
for (const entry of entries.slice().sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id))) {
  const files = variationFiles(entry);
  for (const f of files) expected.add(f);
  const present = files.filter((f) => installedFiles.has(f));
  const missing = files.filter((f) => !installedFiles.has(f));
  if (missing.length > 0) {
    if (entry.priority === 1) missingP1 += missing.length;
    else missingOther += missing.length;
  }
  rows.push({
    id: entry.id,
    pri: `P${entry.priority}`,
    cat: String(entry.category),
    files: `${present.length}/${files.length}`,
    status: missing.length === 0 ? "OK" : `MISSING ${missing.join(", ")}`,
  });
}

const w = {
  id: Math.max(2, ...rows.map((r) => r.id.length)),
  pri: Math.max(3, ...rows.map((r) => r.pri.length)),
  cat: Math.max(8, ...rows.map((r) => r.cat.length)),
  files: Math.max(5, ...rows.map((r) => r.files.length)),
};
console.log(`${"id".padEnd(w.id)}  ${"pri".padEnd(w.pri)}  ${"category".padEnd(w.cat)}  ${"files".padEnd(w.files)}  status`);
console.log(`${"-".repeat(w.id)}  ${"-".repeat(w.pri)}  ${"-".repeat(w.cat)}  ${"-".repeat(w.files)}  ------`);
for (const r of rows) {
  console.log(`${r.id.padEnd(w.id)}  ${r.pri.padEnd(w.pri)}  ${r.cat.padEnd(w.cat)}  ${r.files.padEnd(w.files)}  ${r.status}`);
}

const orphans = [...installedFiles].filter((f) => !expected.has(f)).sort();
for (const f of orphans) console.warn(`⚠ orphan installed file (no manifest entry): audio/sfx/${f}`);

const total = expected.size;
const presentCount = [...expected].filter((f) => installedFiles.has(f)).length;
console.log(
  `\n${entries.length} manifest entries → ${total} expected files: ${presentCount} installed, ` +
    `${missingP1} missing P1, ${missingOther} missing P2+, ${orphans.length} orphan(s)`,
);

if (missingP1 > 0) {
  console.error(`✗ sfx check FAILED — ${missingP1} priority-1 file(s) missing (run: node tools/soundkit/gen-sfx.mjs)`);
  process.exitCode = 1;
} else {
  console.log("✓ sfx check passed — all priority-1 sounds installed");
}
