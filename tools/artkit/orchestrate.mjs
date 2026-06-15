#!/usr/bin/env node
// artkit/orchestrate.mjs — game-agnostic card-art pipeline.
//
// Two phases, both driven by a flat `subjects.json` manifest (see
// subjects.example.json). Per subject it produces, under out/<id>/:
//   sheets/candidate-1..3.png   (Phase 0 — reference candidates)
//   identity-ref.png            (the candidate YOU pick — the "reference")
//   cardart.png                 (Phase 0.5 — the card art)
//
// Flow:
//   1. node orchestrate.mjs           → generates 3 reference candidates for
//                                        every subject missing identity-ref.png
//   2. pick one per subject (copy/rename it to out/<id>/identity-ref.png,
//      or run `node orchestrate.mjs --promote=1` to auto-pick candidate-1)
//   3. node orchestrate.mjs           → generates cardart.png for every
//                                        subject that now has identity-ref.png
//
// Idempotent: re-running only fills what's missing. Parallelism via PARALLEL
// (default 6). Requires the `codex` CLI installed + authenticated (it reads
// your real ~/.codex), and Node 18+.
//
//   PARALLEL=8 node orchestrate.mjs
//   node orchestrate.mjs --promote=1   # auto-promote candidate-1 (skip manual pick)
//   node orchestrate.mjs --only=goblin-king,fire-drake

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { configureCodex, runCodexExec } from "./lib/codex.mjs";
import { buildCardartTicket, buildReferenceTicket } from "./lib/prompts.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, "out");
const TMP = join(ROOT, ".artkit-tmp");
const PARALLEL = Number(process.env.PARALLEL || 6);
const CANDIDATES = Number(process.env.CANDIDATES || 3);

const args = process.argv.slice(2);
const PROMOTE = args.find((a) => a.startsWith("--promote="))?.slice("--promote=".length);
const onlyArg = args.find((a) => a.startsWith("--only="))?.slice("--only=".length);
const ONLY = onlyArg ? new Set(onlyArg.split(",").map((s) => s.trim()).filter(Boolean)) : null;

const ts = () => new Date().toISOString().slice(11, 19);
const log = (m) => console.log(`[${ts()}] ${m}`);

const style = JSON.parse(readFileSync(join(ROOT, "style.json"), "utf8"));
const manifestPath = join(ROOT, process.env.SUBJECTS || "subjects.json");
if (!existsSync(manifestPath)) {
  console.error(`No manifest at ${manifestPath}. Copy subjects.example.json → subjects.json and edit (or set SUBJECTS=<file>).`);
  process.exit(2);
}
const subjects = JSON.parse(readFileSync(manifestPath, "utf8")).filter((s) => !ONLY || ONLY.has(s.id));

configureCodex({ perChatRoot: join(TMP, "codex-homes"), log });
mkdirSync(OUT, { recursive: true });

const dir = (id) => join(OUT, id);
const refPath = (id) => join(dir(id), "identity-ref.png");
const cardartPath = (id) => join(dir(id), "cardart.png");
const sheetsDir = (id) => join(dir(id), "sheets");
const candPath = (id, n) => join(sheetsDir(id), `candidate-${n}.png`);
const tmpFor = (id) => { const d = join(TMP, id); mkdirSync(d, { recursive: true }); return d; };

/** One subject through whichever phase it needs next. Returns a status word. */
async function runSubject(subject) {
  const id = subject.id;
  mkdirSync(sheetsDir(id), { recursive: true });
  const hasRef = existsSync(refPath(id));
  const hasCardart = existsSync(cardartPath(id));
  if (hasRef && hasCardart) return "skip";

  // ── Phase 0: reference candidates (until one is picked) ──
  if (!hasRef) {
    if (existsSync(candPath(id, 1))) {
      if (PROMOTE) {
        copyFileSync(candPath(id, Number(PROMOTE)), refPath(id));
        log(`PROMOTE ${id} (candidate-${PROMOTE} → identity-ref)`);
      } else {
        return "awaiting-pick"; // candidates exist; human chooses
      }
    } else {
      const tmp = tmpFor(id);
      // Optional house-style anchor image (subjects.json `styleRef`) → reference-image gen.
      const styleRef = subject.styleRef ? join(ROOT, subject.styleRef) : null;
      const styleRefOk = styleRef ? existsSync(styleRef) : false;
      if (subject.styleRef && !styleRefOk) log(`WARN ${id} styleRef missing: ${subject.styleRef}`);
      const images = styleRefOk ? [styleRef] : undefined;

      if (subject.kind === "vfx") {
        // VFX: generate ONE image PER exec (each its own fresh Codex chat). This guarantees N
        // SEPARATE candidate files — the batch path let the model tile the N takes into one grid
        // (the "bowie came out as a 2×2 grid" bug). Distinct variant hints keep the takes varied.
        const variants = [
          "Make this take CLEAN and MINIMAL — a single bold confident shape, sparse.",
          "Make this take BIGGER and more ENERGETIC — wider sweep, more motion, more spark.",
          "Make this take SHARP and THIN — a fast, precise, elegant read.",
          "Make this take ROUGH and VIOLENT — chunky, jagged, heavy.",
          "Make this take a DIFFERENT angle/curvature from the others while still facing right.",
          "Make this take WISPY and trailing — long fading streaks.",
        ];
        let made = 0;
        for (let i = 1; i <= CANDIDATES; i++) {
          log(`P0 ${id} — VFX candidate ${i}/${CANDIDATES} (separate exec)`);
          const code = await runCodexExec({
            prompt: buildReferenceTicket(subject, style, 1, styleRefOk, variants[(i - 1) % variants.length]),
            images,
            cwd: ROOT,
            label: `ref-${id}-${i}`,
            reportFile: join(tmp, `p0-${i}-report.txt`),
            stdoutFile: join(tmp, `p0-${i}.log`),
            harvestDir: sheetsDir(id),
            harvestNames: [`candidate-${i}.png`],
          });
          if (code === 0 && existsSync(candPath(id, i))) made++;
        }
        if (made === 0) return "fail-ref";
      } else {
        log(`P0 ${id} — generating ${CANDIDATES} reference candidates${styleRefOk ? " (style-anchored)" : ""}`);
        const code = await runCodexExec({
          prompt: buildReferenceTicket(subject, style, CANDIDATES, styleRefOk),
          images,
          cwd: ROOT,
          label: `ref-${id}`,
          reportFile: join(tmp, "p0-report.txt"),
          stdoutFile: join(tmp, "p0.log"),
          harvestDir: sheetsDir(id),
          harvestNames: Array.from({ length: CANDIDATES }, (_, i) => `candidate-${i + 1}.png`),
        });
        if (code !== 0 || !existsSync(candPath(id, 1))) return "fail-ref";
      }
      if (PROMOTE) {
        copyFileSync(candPath(id, Number(PROMOTE)), refPath(id));
        log(`PROMOTE ${id} (candidate-${PROMOTE} → identity-ref)`);
      } else {
        return "candidates-ready";
      }
    }
  }

  // ── Phase 0.5: card art (needs identity-ref) ──
  if (!existsSync(cardartPath(id))) {
    const tmp = tmpFor(id);
    log(`P0.5 ${id} — generating cardart`);
    const code = await runCodexExec({
      prompt: buildCardartTicket(subject, style),
      images: [refPath(id)],
      cwd: ROOT,
      label: `cardart-${id}`,
      reportFile: join(tmp, "p05-report.txt"),
      stdoutFile: join(tmp, "p05.log"),
      harvestTo: cardartPath(id),
    });
    if (code !== 0 || !existsSync(cardartPath(id))) return "fail-cardart";
  }
  return "done";
}

async function main() {
  log(`artkit start — ${subjects.length} subjects, PARALLEL=${PARALLEL}${PROMOTE ? `, auto-promote candidate-${PROMOTE}` : ""}`);
  const tally = {};
  let idx = 0;
  let inFlight = 0;
  await new Promise((done) => {
    const pump = () => {
      if (idx >= subjects.length && inFlight === 0) return done();
      while (inFlight < PARALLEL && idx < subjects.length) {
        const subject = subjects[idx++];
        inFlight++;
        runSubject(subject)
          .then((r) => { tally[r] = (tally[r] ?? 0) + 1; })
          .catch((e) => { log(`ERROR ${subject.id}: ${e.message}`); tally["error"] = (tally["error"] ?? 0) + 1; })
          .finally(() => { inFlight--; pump(); });
      }
    };
    pump();
  });
  log(`artkit done — ${JSON.stringify(tally)}`);

  // Auto-key generated candidates so the review UI shows charcoal previews immediately —
  // no raw-#00ff00 window after a run. Per-subject so we only touch what this run produced.
  const guard = join(ROOT, "guards", "chroma-key.mjs");
  let keyed = 0;
  for (const s of subjects) {
    if (!existsSync(candPath(s.id, 1))) continue;
    try {
      spawnSync(process.execPath, [guard, `--only=${s.id}`], { cwd: ROOT, stdio: "ignore" });
      keyed++;
    } catch (e) {
      log(`auto-key skipped for ${s.id}: ${e.message} (run guards/chroma-key.mjs manually)`);
    }
  }
  if (keyed) log(`auto-keyed ${keyed} subject(s) → charcoal previews ready.`);

  if (tally["candidates-ready"] || tally["awaiting-pick"]) {
    log(`Reference candidates are in out/<id>/sheets/. Pick one per subject:`);
    log(`  copy your chosen candidate-N.png → out/<id>/identity-ref.png  (or re-run with --promote=1)`);
    log(`then re-run to generate the card art.`);
  }
}

main();
