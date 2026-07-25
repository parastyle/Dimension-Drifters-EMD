#!/usr/bin/env node
import { spawn } from "node:child_process";
import {
  createReadStream,
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
// Weaponsmith — per-weapon authoring tool (the §14 WEAPON_AUTHORING orchestrator, as an app).
// MVP scope: VFX pick-and-choose. Click a weapon → see its Codex VFX candidates → pick one →
// assign an engine mechanic + tune params (live preview in the browser) → save. "Reroll" edits
// the prompt and shells out to artkit to generate fresh candidates. Notes persist per weapon.
//
// Dependency-free (Node built-ins only). Generation reuses tools/artkit/orchestrate.mjs.
//   node tools/weaponsmith/server.mjs       → http://localhost:5050
import { createServer } from "node:http";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readAssignment, readAssignments, writeAssignment } from "./assignment-store.mjs";
import {
  poseStudioCatalogSummary,
  readWeaponRow,
  validatePoseStudioRow,
  writeWeaponRow,
} from "./catalog-row-store.mjs";

// assignments/<weapon-id>.json is the authoring source. The tracked assignments.json compatibility
// aggregate is produced only by `pnpm weaponsmith:aggregate`, never by this save server.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)));
const REPO = resolve(ROOT, "..", "..");
const ARTKIT = resolve(REPO, "tools", "artkit");
const ARTKIT_OUT = join(ARTKIT, "out");
const SUBJECTS_VFX = join(ARTKIT, "subjects.vfx.json");
const WEAPONS_TS = join(REPO, "packages", "shared", "src", "weapons.ts");
const GENERATED_WEAPONS_TS = join(
  REPO,
  "packages",
  "shared",
  "src",
  "weapons-expansion.generated.ts",
);
const CLIENT_PUBLIC = join(REPO, "packages", "client", "public");
// §14 fixed VFX size default — read per request with the shared roster so a long-lived smith sees edits
// after browser refresh. Falls back to 74 only when the source is temporarily unavailable.
function readVfxRadiusDefault() {
  try {
    const m = readFileSync(WEAPONS_TS, "utf8").match(/VFX_RADIUS_DEFAULT\s*=\s*(\d+)/);
    return m ? Number(m[1]) : 74;
  } catch {
    return 74;
  }
}
const PUBLIC = join(ROOT, "public");
const PORT = Number(process.env.PORT) || 5050;
const HOST = process.env.HOST;
const poseStudioSnapshots = new Map();
let poseStudioRegen;
let poseStudioRegenState = { status: "idle", ok: undefined, code: undefined, log: "" };

const readJSON = (p, d) => {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return d;
  }
};
const writeJSON = (p, o) => writeFileSync(p, JSON.stringify(o, null, 2));

function numberField(source, key) {
  const match = source.match(new RegExp(`(?:^|\\s)${key}:\\s*([0-9.]+)`));
  return match ? Number(match[1]) : undefined;
}

function stringField(source, key) {
  const match = source.match(new RegExp(`(?:^|\\s)${key}:\\s*["']([^"']+)["']`));
  return match?.[1];
}

/** Read the hand-authored half of the shared catalog. Only scalar/UI fields are needed by the smith;
 * gameplay expressions remain owned by TypeScript and do not need evaluation here. */
function readBaseWeaponDefs() {
  if (!existsSync(WEAPONS_TS)) return [];
  const source = readFileSync(WEAPONS_TS, "utf8");
  const start = source.indexOf("const BASE_WEAPONS");
  if (start < 0) return [];
  const roster = source.slice(start);
  const block = /^ {2}"?([a-z0-9-]+)"?:\s*\{[ \t]*\n([\s\S]*?)\n {2}\},/gm;
  const weapons = [];
  for (let match = block.exec(roster); match; match = block.exec(roster)) {
    const id = match[1];
    const body = match[2];
    if (id === "fists") continue;
    weapons.push({
      id,
      name: stringField(body, "name") ?? id,
      sprite: stringField(body, "sprite"),
      damage: numberField(body, "damage"),
      range: numberField(body, "range"),
      cooldown: numberField(body, "cooldown"),
      displayLength: numberField(body, "displayLength"),
      vfxRadius: numberField(body, "vfxRadius"),
      archived: /(?:^|\s)archived:\s*true/.test(body),
      twoHanded: /(?:^|\s)twoHanded:\s*true/.test(body),
      dual: /(?:^|\s)dual:\s*true/.test(body),
      thrown: /(?:^|\s)thrown:\s*\{/.test(body),
      quake: /(?:^|\s)quake:\s*\{/.test(body),
      tags: {
        classPool: stringField(body, "classPool") ?? "weapon",
        family: stringField(body, "family") ?? "weapon",
        grip: stringField(body, "grip") ?? "1H",
        delivery: stringField(body, "delivery"),
        element: stringField(body, "element"),
        size: stringField(body, "size"),
        rangeBand: stringField(body, "rangeBand"),
      },
      source: "base",
    });
  }
  return weapons;
}

/** The generated shared module deliberately emits its WEAPONS object as JSON, followed by combo data.
 * Parse that exact object from source so refreshes see a regenerated roster without restarting Node. */
function readGeneratedWeaponDefs() {
  if (!existsSync(GENERATED_WEAPONS_TS)) return [];
  const source = readFileSync(GENERATED_WEAPONS_TS, "utf8");
  const marker = source.indexOf("export const GENERATED_WEAPONS");
  const start = source.indexOf("{", marker);
  const end = source.indexOf("\n};", start);
  if (marker < 0 || start < 0 || end < 0) return [];
  const parsed = JSON.parse(source.slice(start, end + 2));
  return Object.values(parsed).map((weapon) => ({ ...weapon, source: "generated" }));
}

function weaponView(weapon) {
  const tags = weapon.tags ?? {};
  return {
    ...weapon,
    cls: tags.classPool ?? "weapon",
    grip: tags.grip ?? (weapon.twoHanded ? "2H" : "1H"),
    family: tags.family ?? "weapon",
    delivery: tags.delivery ?? (weapon.thrown ? "thrown" : weapon.gun ? "projectile" : "melee"),
    element: tags.element ?? "physical",
    tags: Object.values(tags).flat().filter(Boolean),
    coded: true,
  };
}

/** The active authoring roster: canonical rows remain on disk, while archived weapons stay out of the
 * ordinary listing. This function intentionally performs all reads on every API request. */
function readWeapons() {
  const seen = new Set();
  const weapons = [];
  for (const definition of [...readBaseWeaponDefs(), ...readGeneratedWeaponDefs()]) {
    if (!definition?.id || definition.archived === true || seen.has(definition.id)) continue;
    seen.add(definition.id);
    weapons.push(weaponView(definition));
  }
  const order = { melee: 0, ranged: 1, caster: 2, weapon: 3 };
  weapons.sort(
    (a, b) =>
      (order[a.cls] ?? 9) - (order[b.cls] ?? 9) ||
      a.family.localeCompare(b.family) ||
      a.name.localeCompare(b.name),
  );
  return weapons;
}

function generatedAssignmentFor(weapon) {
  if (!weapon?.id) return null;
  return {
    vfxSubject: vfxSubjectFor(weapon.id),
    image: null,
    suite: null,
    rot: 0,
    displayLength: weapon.displayLength ?? 90,
    vfxRadius: weapon.vfxRadius ?? readVfxRadiusDefault(),
    thrown: weapon.thrown ?? false,
    notes: "",
  };
}

function assignmentStatus(weapon, assignment) {
  if (assignment) return { id: "bespoke-file", label: "bespoke file", hasFile: true };
  if (weapon?.source === "generated") {
    return { id: "generated-default", label: "generated default", hasFile: false };
  }
  return { id: "none", label: "none", hasFile: false };
}

/** Keep file-backed authoring separate from the read-only defaults inferred from the shared catalog.
 * `assigned` remains in API responses for the existing editor; this envelope gives the library an
 * explicit, filterable status without pretending an inferred default is a bespoke assignment file. */
function assignmentView(weapon, assigned) {
  const status = assignmentStatus(weapon, assigned);
  return {
    status: status.id,
    label: status.label,
    hasFile: status.hasFile,
    effective:
      assigned ?? (status.id === "generated-default" ? generatedAssignmentFor(weapon) : null),
  };
}

function installedWeaponArt(weapon) {
  const spriteId = weapon.sprite ?? weapon.id;
  const file = join(CLIENT_PUBLIC, "sprites", spriteId, "part-1.png");
  return existsSync(file)
    ? { spriteId, url: `/game-sprite/${encodeURIComponent(weapon.id)}` }
    : null;
}

// ONE naming convention: a weapon's painted-VFX subject is ALWAYS `vfx-<weaponId>` (the dir under
// artkit out/). Whether painted art exists yet is a separate check (candidate count > 0).
function vfxSubjectFor(weaponId) {
  return `vfx-${weaponId}`;
}

function listCandidates(vfxSubject) {
  const dir = join(ARTKIT_OUT, vfxSubject, "sheets");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /candidate-\d+\.keyed\.png$/.test(f))
    .sort((a, b) => (parseInt(a.match(/\d+/), 10) || 0) - (parseInt(b.match(/\d+/), 10) || 0));
}

function subjectPrompt(vfxSubject) {
  const subs = readJSON(SUBJECTS_VFX, []);
  return subs.find((s) => s.id === vfxSubject)?.prompt || "";
}

// --- reroll jobs (async; UI polls) ----------------------------------------------------------
const jobs = new Map();
let jobSeq = 0;

function weaponArtState(weapon, assigned, candidateCount) {
  const engineOnly = weapon.cls === "gun" || weapon.cls === "staff" || weapon.cls === "caster";
  if (engineOnly) return "artless";
  if ([...jobs.values()].some((job) => job.weaponId === weapon.id && job.status === "running"))
    return "rendering";
  if (assigned?.author?.pending) return "rendering";
  if (candidateCount > 0) return "ready";
  if (assigned?.image) return "unavailable";
  return "artless";
}

function startReroll({ weaponId, prompt, candidates = 4 }) {
  const vfxSubject = vfxSubjectFor(weaponId);
  // upsert the subject prompt
  const subs = readJSON(SUBJECTS_VFX, []);
  let sub = subs.find((s) => s.id === vfxSubject);
  if (!sub) {
    sub = {
      id: vfxSubject,
      name: `${weaponId} — VFX`,
      kind: "vfx",
      styleRef: `out/${weaponId}/identity-ref.png`,
      prompt: prompt || "",
    };
    subs.push(sub);
  }
  if (prompt) sub.prompt = prompt;
  writeJSON(SUBJECTS_VFX, subs);
  // persist the mapping
  const assignment = { ...(readAssignment(weaponId) || {}), vfxSubject };
  writeAssignment(weaponId, assignment);

  const id = `job${++jobSeq}`;
  const job = { id, weaponId, vfxSubject, status: "running", log: "", startedAt: Date.now() };
  jobs.set(id, job);
  const child = spawn(process.execPath, ["orchestrate.mjs", `--only=${vfxSubject}`], {
    cwd: ARTKIT,
    env: {
      ...process.env,
      CANDIDATES: String(candidates),
      PARALLEL: "1",
      SUBJECTS: "subjects.vfx.json",
    },
  });
  child.stdout.on("data", (d) => {
    job.log += d;
  });
  child.stderr.on("data", (d) => {
    job.log += d;
  });
  child.on("close", (code) => {
    job.status = code === 0 ? "done" : "error";
    job.candidates = listCandidates(vfxSubject);
  });
  child.on("error", (e) => {
    job.status = "error";
    job.log += `\n${e.message}`;
  });
  return job;
}

// --- tiny static + JSON server --------------------------------------------------------------
const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
};
function serveFile(res, path) {
  if (!existsSync(path) || statSync(path).isDirectory()) {
    res.writeHead(404);
    return res.end("not found");
  }
  res.writeHead(200, {
    "Content-Type": MIME[extname(path)] || "application/octet-stream",
    "Cache-Control": "no-store",
  });
  createReadStream(path).pipe(res);
}
function json(res, obj, code = 200) {
  res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(obj));
}
function body(req) {
  return new Promise((r) => {
    let d = "";
    req.on("data", (c) => (d += c));
    req.on("end", () => {
      try {
        r(JSON.parse(d || "{}"));
      } catch {
        r({});
      }
    });
  });
}

function runPoseStudioRegen() {
  if (poseStudioRegen) return poseStudioRegen;
  poseStudioRegenState = { status: "running", ok: undefined, code: undefined, log: "" };
  poseStudioRegen = new Promise((resolveJob) => {
    const command = process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : "pnpm";
    const args = process.platform === "win32" ? ["/d", "/s", "/c", "pnpm gen"] : ["gen"];
    const child = spawn(command, args, {
      cwd: REPO,
      env: process.env,
      windowsHide: true,
    });
    let log = "";
    child.stdout.on("data", (chunk) => {
      log = `${log}${chunk}`.slice(-24_000);
    });
    child.stderr.on("data", (chunk) => {
      log = `${log}${chunk}`.slice(-24_000);
    });
    child.on("error", (error) =>
      resolveJob({ ok: false, code: -1, log: `${log}\n${error.message}` }),
    );
    child.on("close", (code) => {
      resolveJob({ ok: code === 0, code, log });
    });
  })
    .catch((error) => ({
      ok: false,
      code: -1,
      log: error instanceof Error ? error.message : String(error),
    }))
    .then((result) => {
      poseStudioRegenState = {
        status: result.ok ? "passed" : "failed",
        ...result,
      };
      return result;
    })
    .finally(() => {
      poseStudioRegen = undefined;
    });
  return poseStudioRegen;
}

const server = createServer(async (req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);
  const p = u.pathname;
  try {
    // ---- API ----
    if (p === "/api/pose-studio/catalog" && req.method === "GET") {
      return json(res, {
        weapons: poseStudioCatalogSummary(),
        source: "data/weapon-concepts-300.json",
      });
    }
    if (p.startsWith("/api/pose-studio/row/") && req.method === "GET") {
      const id = decodeURIComponent(p.slice("/api/pose-studio/row/".length));
      const row = readWeaponRow(id);
      if (!row) return json(res, { error: "unknown weapon row" }, 404);
      return json(res, {
        row,
        snapshotAvailable: poseStudioSnapshots.has(id),
      });
    }
    if (p === "/api/pose-studio/validate" && req.method === "POST") {
      const request = await body(req);
      const baseline = readWeaponRow(request.id);
      if (!baseline) return json(res, { error: "unknown weapon row" }, 404);
      const errors = validatePoseStudioRow(request.row, baseline);
      return json(res, { ok: errors.length === 0, errors }, errors.length === 0 ? 200 : 422);
    }
    if (p === "/api/pose-studio/snapshot" && req.method === "POST") {
      const request = await body(req);
      const row = readWeaponRow(request.id);
      if (!row) return json(res, { error: "unknown weapon row" }, 404);
      poseStudioSnapshots.set(request.id, row);
      return json(res, { ok: true, snapshotAvailable: true });
    }
    if (p === "/api/pose-studio/save" && req.method === "POST") {
      const request = await body(req);
      const baseline = readWeaponRow(request.id);
      if (!baseline) return json(res, { error: "unknown weapon row" }, 404);
      if (!poseStudioSnapshots.has(request.id)) {
        poseStudioSnapshots.set(request.id, baseline);
      }
      const errors = validatePoseStudioRow(request.row, baseline);
      if (errors.length > 0) return json(res, { error: errors[0], errors }, 422);
      const row = writeWeaponRow(request.id, request.row);
      return json(res, { ok: true, row, snapshotAvailable: true });
    }
    if (p === "/api/pose-studio/restore" && req.method === "POST") {
      const request = await body(req);
      const snapshot = poseStudioSnapshots.get(request.id);
      if (!snapshot) return json(res, { error: "no snapshot is available for this row" }, 409);
      if (!readWeaponRow(request.id)) return json(res, { error: "unknown weapon row" }, 404);
      const row = writeWeaponRow(request.id, snapshot);
      poseStudioSnapshots.delete(request.id);
      return json(res, { ok: true, row, snapshotAvailable: false });
    }
    if (p === "/api/pose-studio/regen" && req.method === "GET") {
      return json(res, poseStudioRegenState);
    }
    if (p === "/api/pose-studio/regen" && req.method === "POST") {
      void runPoseStudioRegen();
      return json(res, poseStudioRegenState, 202);
    }
    if (p === "/api/weapons") {
      const assignments = readAssignments();
      return json(
        res,
        readWeapons().map((w) => {
          const vfx = vfxSubjectFor(w.id);
          const assigned = assignments[w.id] || null;
          const candidateCount = listCandidates(vfx).length;
          return {
            ...w,
            vfxSubject: vfx,
            candidateCount,
            artStatus: weaponArtState(w, assigned, candidateCount),
            assignment: assignmentView(w, assigned),
            assigned,
          };
        }),
      );
    }
    if (p.startsWith("/api/weapon/")) {
      const id = decodeURIComponent(p.split("/").pop());
      const w = readWeapons().find((x) => x.id === id);
      if (!w) return json(res, { error: "unknown weapon" }, 404);
      const vfx = vfxSubjectFor(id);
      const assignment = readAssignment(id);
      const ownArt = listCandidates(id); // the weapon's OWN sprite candidates (for the showcase)
      const cands = listCandidates(vfx); // painted-VFX candidates (empty until authored)
      const installedArt = installedWeaponArt(w);
      // §14 V2: guns + casters are ENGINE-ONLY for now (no painted Codex VFX). Melee/launchers paint.
      const engineOnly = w.cls === "gun" || w.cls === "staff" || w.cls === "caster";
      const paintedVfx = cands.length > 0; // painted effect art has actually been generated
      return json(res, {
        ...w,
        vfxSubject: vfx,
        candidates: cands,
        prompt: subjectPrompt(vfx),
        weaponArt: ownArt[0] ? `/art/${id}/${ownArt[0]}` : (installedArt?.url ?? null),
        engineOnly,
        paintedVfx,
        artStatus: weaponArtState(w, assignment, cands.length),
        // Effective on-screen size (§10): a tool override wins, else the coded value, else a M default.
        displayLength: assignment?.displayLength ?? w.displayLength ?? 90,
        // Effective fixed VFX size (§14): tool override → coded value → calibrated default (74).
        vfxRadius: assignment?.vfxRadius ?? w.vfxRadius ?? readVfxRadiusDefault(),
        // §10 delivery: thrown (RMB hurls a spinning projectile) vs melee swing. Tool override wins,
        // else the coded value. Lets us mark explore weapons (e.g. Spike Driver) thrown before they're coded.
        thrown: assignment?.thrown ?? w.thrown ?? false,
        // Scatter-shot source (CODE-14): a dissected painted cluster → spritesheet (slice-scatter.mjs).
        // Present only when out/<vfx>/scatter/meta.json exists; the `magma-scatter` layer flings it.
        scatter: (() => {
          const m = readJSON(join(ARTKIT_OUT, vfx, "scatter", "meta.json"), null);
          return m ? { url: `/scatter/${vfx}/sheet.png`, ...m } : null;
        })(),
        assignment: assignmentView(w, assignment),
        assigned: assignment,
      });
    }
    if (p === "/api/reroll" && req.method === "POST") {
      const b = await body(req);
      if (!b.weaponId) return json(res, { error: "weaponId required" }, 400);
      const job = startReroll(b);
      return json(res, { jobId: job.id, vfxSubject: job.vfxSubject });
    }
    if (p.startsWith("/api/job/")) {
      const job = jobs.get(p.split("/").pop());
      if (!job) return json(res, { error: "no job" }, 404);
      return json(res, {
        status: job.status,
        candidates: job.candidates || [],
        log: job.log.slice(-2000),
      });
    }
    if (p === "/api/save" && req.method === "POST") {
      const b = await body(req);
      if (!b.weaponId) return json(res, { error: "weaponId required" }, 400);
      const weapon = readWeapons().find((candidate) => candidate.id === b.weaponId);
      if (!weapon) return json(res, { error: "unknown weapon" }, 404);
      const previous = readAssignment(b.weaponId) || {};
      const assignment = {
        ...previous,
        vfxSubject: vfxSubjectFor(b.weaponId),
        image: b.image ?? previous.image ?? null,
        // The toggleable layer SUITE: { <layerId>: { on, params } }.
        suite: b.suite ?? previous.suite ?? null,
        // VFX rotation in degrees (15° increments), applied to the whole composed effect.
        rot: b.rot ?? previous.rot ?? 0,
        // §10 on-screen size (displayLength px). The canonical value for coded weapons lives in
        // weapons.ts; this is the tool's authored/override value (sync to weapons.ts when settled).
        displayLength: b.displayLength ?? previous.displayLength ?? undefined,
        // §14 fixed VFX size (px). undefined = inherit the coded value / default.
        vfxRadius: b.vfxRadius ?? previous.vfxRadius ?? undefined,
        // §10 delivery override (thrown vs melee). undefined = inherit the coded value.
        thrown: b.thrown ?? previous.thrown ?? undefined,
        // §14 authored VFX ORIGIN — a {x,y} px offset (from the weapon/player anchor) where this weapon's
        // VFX spawns, mouse-placed in the smith. undefined = the default anchor (no offset).
        vfxOrigin: b.vfxOrigin ?? previous.vfxOrigin ?? undefined,
        // §14 when true the VFX spawns at the IN-GAME CURSOR (clamped), like the greatsword quake, instead
        // of at the weapon anchor. undefined/false = anchor-spawn.
        spawnAtCursor: b.spawnAtCursor ?? previous.spawnAtCursor ?? undefined,
        notes: b.notes ?? previous.notes ?? "",
        updatedAt: new Date().toISOString().slice(0, 19),
      };
      writeAssignment(b.weaponId, assignment);
      return json(res, {
        ok: true,
        assignment: assignmentView(weapon, assignment),
        assigned: assignment,
      });
    }
    // ---- V2 authoring: the user's two prompts (painted / engine) + per-panel edit notes. Saved so
    // Claude can read them, audit the painted prompt, generate, and build the engine VFX. ----
    if (p === "/api/author" && req.method === "POST") {
      const b = await body(req);
      if (!b.weaponId) return json(res, { error: "weaponId required" }, 400);
      const previous = readAssignment(b.weaponId) || {};
      const previousAuthor = previous.author || {};
      const assignment = {
        ...previous,
        // Living "what the weapon does" description (§24 abilities). Claude keeps it current as it builds
        // behavior; the user can edit it to refine/request. Top-level (an output doc, not a redo note).
        description: b.description ?? previous.description ?? "",
        author: {
          painted: b.painted ?? previousAuthor.painted ?? "",
          engine: b.engine ?? previousAuthor.engine ?? "",
          // Abilities/mechanics REQUEST in the user's words ("make the meteors explode") — Claude reads
          // this, implements the mechanic (weapons.ts behavior block + server resolve + VFX), updates the
          // description, then clears it. Disjoint from cosmetic `engine` VFX (v0.51 mechanics boundary).
          mechanics: b.mechanics ?? previousAuthor.mechanics ?? "",
          // per-panel redo notes: { painted, engine, combined }
          edits: { ...(previousAuthor.edits || {}), ...(b.edits || {}) },
          // 'pending' = the user hit Save & request and is waiting on Claude to act. Omitting it PRESERVES
          // the prior state (so a plain description-save doesn't clear a pending mechanics request).
          pending: b.pending ?? previousAuthor.pending ?? false,
          updatedAt: new Date().toISOString().slice(0, 19),
        },
      };
      writeAssignment(b.weaponId, assignment);
      return json(res, { ok: true, author: assignment.author });
    }
    // ---- serve a chosen Codex candidate image ----
    if (p.startsWith("/art/")) {
      const [, , subject, file] = p.split("/");
      return serveFile(res, join(ARTKIT_OUT, subject, "sheets", file));
    }
    // Combined previews use tracked character cards so a clean checkout never depends on ignored Artkit output.
    if (p.startsWith("/character-sprite/")) {
      const [, , subject, file] = p.split("/");
      if (!/^[a-z0-9-]+$/.test(subject ?? "") || !/^[a-z0-9.-]+$/.test(file ?? "")) {
        return json(res, { error: "invalid character sprite path" }, 400);
      }
      return serveFile(res, join(CLIENT_PUBLIC, "sprites", subject, file));
    }
    // scatter-shot spritesheet (CODE-14): /scatter/<vfxSubject>/sheet.png → out/<subject>/scatter/
    if (p.startsWith("/scatter/")) {
      const [, , subject, file] = p.split("/");
      return serveFile(res, join(ARTKIT_OUT, subject, "scatter", file));
    }
    // Installed game art is the complete-catalog fallback when no Artkit showcase candidate exists.
    if (p.startsWith("/game-sprite/")) {
      const id = decodeURIComponent(p.split("/").pop());
      const weapon = readWeapons().find((candidate) => candidate.id === id);
      const art = weapon && installedWeaponArt(weapon);
      if (!art) return json(res, { error: "weapon sprite not found" }, 404);
      return serveFile(res, join(CLIENT_PUBLIC, "sprites", art.spriteId, "part-1.png"));
    }
    // ---- serve the CANONICAL VFX core (vfx-render.js + vfx-layers.js) from the client package, so the
    // smith preview and the live game run the EXACT SAME renderer (§14 CODE-8 — one source of truth). ----
    if (p === "/vfx-render.js" || p === "/vfx-layers.js") {
      return serveFile(res, join(REPO, "packages", "client", "src", "vfx", p.replace(/^\//, "")));
    }
    // ---- serve the Phaser UMD build (the WYSIWYG preview uses the SAME engine as the game) ----
    if (p === "/phaser.min.js") {
      const candidates = [
        join(
          REPO,
          "node_modules",
          ".pnpm",
          "phaser@4.1.0",
          "node_modules",
          "phaser",
          "dist",
          "phaser.min.js",
        ),
        join(REPO, "node_modules", "phaser", "dist", "phaser.min.js"),
      ];
      const hit = candidates.find((c) => existsSync(c));
      if (hit) return serveFile(res, hit);
      res.writeHead(404);
      return res.end("phaser not found");
    }
    // ---- static UI ----
    return serveFile(res, join(PUBLIC, p === "/" ? "index.html" : p.replace(/^\//, "")));
  } catch (e) {
    return json(res, { error: String(e.message || e) }, 500);
  }
});
server.listen(PORT, HOST, () =>
  console.log(`weaponsmith → http://${HOST ?? "localhost"}:${PORT}`),
);
