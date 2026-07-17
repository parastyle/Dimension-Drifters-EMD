#!/usr/bin/env node
// soundkit/gen-sfx.mjs — weapon/impact SFX via the ElevenLabs sound-generation API (§audio panel).
// Reads tools/soundkit/sfx-manifest.json (entries: { id, category, priority, prompt, durationSeconds,
// loop, variations, replaces }), validates defensively, and generates each requested sound serially.
// RESUMABLE (skips existing raws in tools/soundkit/out/). Installs to
// packages/client/public/audio/sfx/<id>[-vN].mp3
//
//   node tools/soundkit/gen-sfx.mjs                    # priority 1 only (default)
//   node tools/soundkit/gen-sfx.mjs --priority 2       # a different priority tier
//   node tools/soundkit/gen-sfx.mjs --only <id>        # one entry, any priority
//   node tools/soundkit/gen-sfx.mjs --dry-run          # print the request plan; no key, no API calls
//   node tools/soundkit/gen-sfx.mjs --manifest <path>  # alternate manifest (testing escape hatch)
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, "../..");
const OUT = resolve(here, "out");
const DST = resolve(REPO, "packages/client/public/audio/sfx");

const API_URL = "https://api.elevenlabs.io/v1/sound-generation";
const PROMPT_INFLUENCE = 0.4;
const DELAY_MS = 800; // serial + polite: small gap between API calls
const MAX_ATTEMPTS = 5; // exponential backoff on 429/5xx

// ---------------------------------------------------------------- args
const args = process.argv.slice(2);
let priority = 1;
let only = null;
let dryRun = false;
let manifestPath = resolve(here, "sfx-manifest.json");
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--dry-run") dryRun = true;
  else if (a === "--priority") {
    priority = Number(args[++i]);
    if (!Number.isInteger(priority) || priority < 1) fatal(`--priority must be a positive integer, got: ${args[i]}`);
  } else if (a === "--only") {
    only = args[++i];
    if (!only) fatal("--only requires an id");
  } else if (a === "--manifest") {
    manifestPath = resolve(args[++i] ?? "");
    if (!args[i]) fatal("--manifest requires a path");
  } else fatal(`unknown argument: ${a} (expected --priority N | --only <id> | --dry-run | --manifest <path>)`);
}

function fatal(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

// ---------------------------------------------------------------- .env (tiny hand-rolled parser, no deps)
function loadApiKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY;
  const envPath = resolve(REPO, ".env");
  if (!existsSync(envPath)) return undefined;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m || m[1] !== "ELEVENLABS_API_KEY") continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    return v || undefined;
  }
  return undefined;
}

// ---------------------------------------------------------------- manifest (defensive: skip malformed with a warning)
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
    if (typeof e.category !== "string" || e.category.length === 0) warn(`${where}: missing category (kept anyway)`);
    seen.add(e.id);
    good.push({ id: e.id, category: e.category ?? "?", priority: e.priority, prompt: e.prompt.trim(), durationSeconds: dur, loop: e.loop === true, variations, replaces: e.replaces });
  }
  return good;
}

function variationFiles(entry) {
  // <id>.mp3 for single-take sounds; <id>-v1.mp3.. for multi-take sounds.
  if (entry.variations <= 1) return [{ n: 1, file: `${entry.id}.mp3` }];
  return Array.from({ length: entry.variations }, (_, k) => ({ n: k + 1, file: `${entry.id}-v${k + 1}.mp3` }));
}

function requestText(entry, n) {
  if (entry.variations <= 1) return entry.prompt;
  // Vary the request per take so ElevenLabs doesn't hand back near-identical audio.
  return `${entry.prompt} (alternate take ${n} of ${entry.variations}, subtly different timbre and envelope; seed ${entry.id}-v${n})`;
}

// ---------------------------------------------------------------- API call with backoff
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function generateSound(apiKey, text, durationSeconds, label) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "xi-api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify({ text, duration_seconds: durationSeconds, prompt_influence: PROMPT_INFLUENCE }),
    });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    const body = (await res.text().catch(() => "")).slice(0, 300);
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt === MAX_ATTEMPTS) throw new Error(`HTTP ${res.status} for ${label}: ${body}`);
    const retryAfter = Number(res.headers.get("retry-after"));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2000 * 2 ** (attempt - 1);
    console.log(`  … ${res.status} on ${label}, retry ${attempt}/${MAX_ATTEMPTS - 1} in ${Math.round(waitMs / 1000)}s`);
    await sleep(waitMs);
  }
  throw new Error(`unreachable`);
}

// ---------------------------------------------------------------- main
async function main() {
  if (!existsSync(manifestPath)) fatal(`manifest not found: ${manifestPath}`);
  let entries;
  try {
    entries = validateEntries(JSON.parse(readFileSync(manifestPath, "utf8")));
  } catch (err) {
    fatal(`cannot parse ${manifestPath}: ${err.message}`);
  }
  if (entries == null) fatal(`${manifestPath}: top level must be a JSON array of entries`);

  const selected = only ? entries.filter((e) => e.id === only) : entries.filter((e) => e.priority === priority);
  if (selected.length === 0) {
    fatal(only ? `no valid manifest entry with id "${only}"` : `no valid entries with priority ${priority} (use --priority N or --only <id>)`);
  }

  const apiKey = dryRun ? null : loadApiKey();
  if (!dryRun && !apiKey) {
    fatal(
      `ELEVENLABS_API_KEY is not set. Create ${resolve(REPO, ".env")} containing\n` +
        "  ELEVENLABS_API_KEY=<your key>\n" +
        "  (or set the environment variable). Use --dry-run to preview the request plan without a key.",
    );
  }

  mkdirSync(OUT, { recursive: true });
  if (!dryRun) mkdirSync(DST, { recursive: true });

  console.log(
    `${dryRun ? "DRY-RUN plan" : "Generating"}: ${selected.length} entr${selected.length === 1 ? "y" : "ies"} ` +
      `(${only ? `--only ${only}` : `priority ${priority}`}) from ${manifestPath}`,
  );

  let generated = 0, skipped = 0, installed = 0, failed = 0;
  for (const entry of selected) {
    for (const { n, file } of variationFiles(entry)) {
      const raw = resolve(OUT, file);
      const dst = resolve(DST, file);
      const label = `${entry.id}${entry.variations > 1 ? ` v${n}` : ""}`;
      const text = requestText(entry, n);

      if (dryRun) {
        const state = existsSync(raw) ? "SKIP (raw exists)" : "GENERATE";
        console.log(`\n[${state}] ${label}  (${entry.category}, P${entry.priority}, ${entry.durationSeconds}s${entry.loop ? ", loop" : ""})`);
        console.log(`  POST ${API_URL}  { duration_seconds: ${entry.durationSeconds}, prompt_influence: ${PROMPT_INFLUENCE} }`);
        console.log(`  text: ${text}`);
        console.log(`  raw:  ${raw}`);
        console.log(`  →     ${dst}`);
        continue;
      }

      if (existsSync(raw)) {
        console.log(`SKIP ${label}: raw exists`);
        skipped++;
      } else {
        try {
          console.log(`GEN  ${label} (${entry.durationSeconds}s${entry.loop ? ", loop" : ""}) …`);
          const audio = await generateSound(apiKey, text, entry.durationSeconds, label);
          if (audio.length < 512) throw new Error(`response too small (${audio.length} bytes) — not audio?`);
          writeFileSync(raw, audio);
          console.log(`  raw ${raw} (${(audio.length / 1024).toFixed(1)} KB)`);
          generated++;
        } catch (err) {
          console.error(`FAIL ${label}: ${err.message}`);
          failed++;
          await sleep(DELAY_MS);
          continue;
        }
        await sleep(DELAY_MS); // rate-limit friendly: serial with a small gap
      }

      copyFileSync(raw, dst);
      console.log(`INSTALLED ${dst}`);
      installed++;
    }
  }

  if (dryRun) {
    console.log(`\nDRY-RUN done — ${selected.length} entries planned, no API calls made.`);
    return;
  }

  // Publish the runtime manifest the client's sample-bank probes (public/audio/sfx/manifest.json).
  // Only entries whose EVERY variation file is installed are listed — the bank treats presence in this
  // file as a promise the mp3 exists (its 404-avoidance law). Re-derived from disk on every run, over
  // the FULL manifest (not just this run's priority slice), so partial batches stay honest.
  const live = entries.filter((e) => variationFiles(e).every(({ file }) => existsSync(resolve(DST, file))));
  if (live.length > 0) {
    const publicManifest = resolve(DST, "manifest.json");
    writeFileSync(
      publicManifest,
      JSON.stringify({ version: 1, sounds: live.map(({ id, category, priority, durationSeconds, loop, variations, replaces }) => ({ id, category, priority, durationSeconds, loop, variations, replaces })) }, null, 1),
    );
    console.log(`PUBLISHED ${publicManifest} (${live.length}/${entries.length} entries live)`);
  } else {
    console.log("no fully-installed entries yet — public manifest not written (sample bank stays no-op)");
  }

  console.log(`\nSUMMARY: ${generated} generated, ${skipped} skipped (resumable), ${installed} installed, ${failed} failed`);
  if (failed > 0) {
    console.error(`DONE with ${failed} failure(s) — re-run to resume (existing raws are skipped).`);
    process.exitCode = 1;
  } else {
    console.log("DONE all installed");
  }
}

main().catch((err) => fatal(err.stack ?? String(err)));
