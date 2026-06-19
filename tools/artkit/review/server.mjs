#!/usr/bin/env node
// artkit/review/server.mjs — local art-review UI server (dependency-free: node http + fs).
//
// Reads the artkit manifests + out/ and serves a browser UI to browse candidates, promote
// picks (→ identity-ref), edit prompts, and re-roll. Run:  node review/server.mjs  → :8190
//   PORT=8190  HOST=0.0.0.0 (LAN/tunnel-friendly)

import { spawn, spawnSync } from "node:child_process";
import {
  copyFileSync,
  createReadStream,
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(HERE); // tools/artkit
const OUT = join(ROOT, "out");
const PUBLIC = join(HERE, "public");
const PORT = Number(process.env.PORT || 8190);
const HOST = process.env.HOST || "127.0.0.1";
const FLAGS = join(HERE, "flags.json"); // local review state: id → "approved" | "reroll"

/** Triage flags (swipe pass): persist a per-asset approve/re-roll decision so the grid can badge them
 *  and a later batch re-roll can target the rejects. Local-only state (gitignored). */
function loadFlags() {
  try {
    return JSON.parse(readFileSync(FLAGS, "utf8"));
  } catch {
    return {};
  }
}
function setFlag(id, status) {
  const f = loadFlags();
  if (!status || status === "clear") delete f[id];
  else f[id] = status;
  writeFileSync(FLAGS, `${JSON.stringify(f, null, 2)}\n`);
  return { ok: true, flag: f[id] ?? null };
}
const MANIFESTS = [
  "subjects.json",
  "subjects.explore.json",
  "subjects.concepts.json",
  "subjects-dimensions.json", // §17 the 5-dimension enemies/toughs/bosses + 3 shifters (27 subjects)
  "subjects-300.json", // §13 the +300 EXPANSION arsenal (x2-*) — all 297 designed weapons
];

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
};

function categoryOf(tags = []) {
  const t = new Set(tags);
  if (t.has("boss")) return "Bosses";
  if (t.has("weapon") && t.has("sword")) return "Swords";
  if (t.has("weapon") && t.has("gun")) return "Guns";
  if (t.has("weapon") && t.has("launcher")) return "Launchers";
  if (t.has("weapon") && t.has("staff")) return "Staffs";
  if (t.has("weapon")) return "Weapons";
  if (t.has("character") || t.has("player")) return "Characters";
  if (t.has("enemy")) return "Enemies";
  return "Other";
}

/** Load every manifest into a flat id→record map (records carry their source file). */
function loadSubjects() {
  const map = new Map();
  for (const file of MANIFESTS) {
    const p = join(ROOT, file);
    if (!existsSync(p)) continue;
    let arr;
    try {
      arr = JSON.parse(readFileSync(p, "utf8"));
    } catch {
      continue;
    }
    for (const s of arr) if (s?.id) map.set(s.id, { ...s, _manifest: file });
  }
  return map;
}

function candidateNumbers(id) {
  const dir = join(OUT, id, "sheets");
  if (!existsSync(dir)) return [];
  const nums = new Set();
  for (const f of readdirSync(dir)) {
    const m = f.match(/^candidate-(\d+)\.png$/);
    if (m) nums.add(Number(m[1]));
  }
  return [...nums].sort((a, b) => a - b);
}

function assetList() {
  const subjects = loadSubjects();
  const flags = loadFlags();
  const out = [];
  for (const [id, s] of subjects) {
    const cands = candidateNumbers(id);
    const promotedFile = join(OUT, id, "promoted.txt");
    const promoted = existsSync(promotedFile) ? readFileSync(promotedFile, "utf8").trim() : null;
    out.push({
      id,
      name: s.name || id,
      category: categoryOf(s.tags),
      tags: s.tags || [],
      prompt: s.prompt || "",
      styleRef: s.styleRef || null,
      manifest: s._manifest,
      candidates: cands,
      locked: existsSync(join(OUT, id, "identity-ref.png")),
      promoted, // e.g. "3"
      flag: flags[id] ?? null, // "approved" | "reroll" | null (triage state)
    });
  }
  out.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  return out;
}

/** Best image for a candidate: keyed preview (on charcoal) if it exists, else raw. */
function candidateImage(id, n) {
  const sheets = join(OUT, id, "sheets");
  const preview = join(sheets, `candidate-${n}.preview.png`);
  const raw = join(sheets, `candidate-${n}.png`);
  return existsSync(preview) ? preview : existsSync(raw) ? raw : null;
}

// On-demand chroma-keying: when a freshly-generated asset (raw, on green) is first viewed
// and has no preview yet, key its whole set once in the background so charcoal previews
// appear on the next load — no manual guard run needed as the batch lands.
const keying = new Set();
function ensureKeyed(id) {
  const sheets = join(OUT, id, "sheets");
  const hasRaw = existsSync(join(sheets, "candidate-1.png"));
  const hasPreview = existsSync(join(sheets, "candidate-1.preview.png"));
  if (!hasRaw || hasPreview || keying.has(id)) return;
  keying.add(id);
  const child = spawn(process.execPath, [join(ROOT, "guards", "chroma-key.mjs"), `--only=${id}`], { cwd: ROOT });
  child.on("close", () => keying.delete(id));
}

function send(res, code, type, body) {
  res.writeHead(code, { "content-type": type, "cache-control": "no-store" });
  res.end(body);
}
function sendJson(res, code, obj) {
  send(res, code, "application/json", JSON.stringify(obj));
}
function serveFile(res, path) {
  if (!path || !existsSync(path)) return send(res, 404, "text/plain", "not found");
  res.writeHead(200, { "content-type": MIME[extname(path)] || "application/octet-stream", "cache-control": "no-store" });
  createReadStream(path).pipe(res);
}
async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  try {
    return JSON.parse(Buffer.concat(chunks).toString() || "{}");
  } catch {
    return {};
  }
}

function promote(id, n) {
  const src = join(OUT, id, "sheets", `candidate-${n}.png`);
  if (!existsSync(src)) return { ok: false, error: "candidate not found" };
  copyFileSync(src, join(OUT, id, "identity-ref.png"));
  writeFileSync(join(OUT, id, "promoted.txt"), String(n));
  return { ok: true };
}

function editPrompt(id, prompt) {
  const subjects = loadSubjects();
  const s = subjects.get(id);
  if (!s) return { ok: false, error: "unknown id" };
  const p = join(ROOT, s._manifest);
  const arr = JSON.parse(readFileSync(p, "utf8"));
  const entry = arr.find((x) => x.id === id);
  if (!entry) return { ok: false, error: "not in manifest" };
  entry.prompt = prompt;
  writeFileSync(p, `${JSON.stringify(arr, null, 2)}\n`);
  return { ok: true };
}

const jobs = new Map(); // id → {status, log}
function reroll(id) {
  const subjects = loadSubjects();
  const s = subjects.get(id);
  if (!s) return { ok: false, error: "unknown id" };
  if (jobs.get(id)?.status === "running") return { ok: true, status: "already running" };
  // wipe this asset's output so orchestrate regenerates from scratch
  const dir = join(OUT, id);
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {}
  const env = { ...process.env, SUBJECTS: s._manifest, CANDIDATES: "5" };
  jobs.set(id, { status: "running", log: "" });
  const child = spawn(process.execPath, [join(ROOT, "orchestrate.mjs"), `--only=${id}`], { cwd: ROOT, env });
  const append = (d) => {
    const j = jobs.get(id);
    if (j) j.log = (j.log + d.toString()).slice(-4000);
  };
  child.stdout.on("data", append);
  child.stderr.on("data", append);
  child.on("close", (code) => {
    // key the new candidates so previews exist for the UI
    const key = spawn(process.execPath, [join(ROOT, "guards", "chroma-key.mjs"), `--only=${id}`], { cwd: ROOT });
    key.on("close", () => jobs.set(id, { status: code === 0 ? "done" : "failed", log: jobs.get(id)?.log || "" }));
  });
  return { ok: true, status: "started" };
}

/** Push the CURRENT pick (identity-ref) into the actual game: re-key the ref (so a freshly-promoted
 *  candidate is what gets sliced), drop any stale parts so it re-slices, then harvest-install → updates
 *  `packages/client/public/sprites/<id>/` + the client sprite manifest. Closes the review→game loop so a
 *  phone re-pick/re-roll lands in the build (the dev server hot-reloads). Synchronous (a few seconds). */
function install(id) {
  const subjects = loadSubjects();
  const s = subjects.get(id);
  if (!s) return { ok: false, error: "unknown id" };
  if (!existsSync(join(OUT, id, "identity-ref.png")))
    return { ok: false, error: "no identity-ref yet — pick a candidate first" };
  const kind = (s.tags || []).includes("weapon") ? "weapon" : "character";
  // 1. re-key the (possibly re-picked) identity-ref so identity-ref.keyed.png matches the current pick.
  spawnSync(process.execPath, [join(ROOT, "guards", "chroma-key.mjs"), `--only=${id}`], { cwd: ROOT });
  // 2. drop stale slices so harvest re-slices the new art (ensureSliced skips when parts.json exists).
  try {
    rmSync(join(OUT, id, "parts"), { recursive: true, force: true });
  } catch {}
  // 3. slice + presize + copy into the client + regenerate manifest.ts.
  const r = spawnSync(
    process.execPath,
    [join(ROOT, "harvest-install.mjs"), `--ids=${id}`, `--kind=${kind}`],
    { cwd: ROOT, encoding: "utf8" },
  );
  const log = `${r.stdout || ""}${r.stderr || ""}`.slice(-2500);
  return { ok: r.status === 0, log };
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  if (path === "/api/assets") return sendJson(res, 200, { assets: assetList() });
  if (path === "/api/jobs") return sendJson(res, 200, Object.fromEntries(jobs));

  if (path.startsWith("/img/")) {
    const [, , id, n] = path.split("/"); // /img/<id>/<n>
    ensureKeyed(id); // background-key the set on first view if needed
    return serveFile(res, candidateImage(id, n));
  }
  if (path.startsWith("/ref/")) {
    const id = path.split("/")[2];
    return serveFile(res, join(OUT, id, "identity-ref.png"));
  }

  if (req.method === "POST") {
    const body = await readBody(req);
    if (path === "/api/promote") return sendJson(res, 200, promote(body.id, body.candidate));
    if (path === "/api/prompt") return sendJson(res, 200, editPrompt(body.id, body.prompt));
    if (path === "/api/reroll") return sendJson(res, 200, reroll(body.id));
    if (path === "/api/install") return sendJson(res, 200, install(body.id));
    if (path === "/api/flag") return sendJson(res, 200, setFlag(body.id, body.status));
    return sendJson(res, 404, { ok: false });
  }

  // static
  const file = path === "/" ? "index.html" : path.slice(1);
  return serveFile(res, join(PUBLIC, file));
});

server.listen(PORT, HOST, () => {
  console.log(`[art-review] http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}`);
  // Proactively key everything once on startup so previews are ready — no raw-green flash
  // before an asset is first opened. New assets are still keyed on-demand via ensureKeyed.
  spawn(process.execPath, [join(ROOT, "guards", "chroma-key.mjs"), "--all"], { cwd: ROOT, stdio: "ignore" });
});
