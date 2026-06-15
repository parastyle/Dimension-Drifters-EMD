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

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)));
const REPO = resolve(ROOT, "..", "..");
const ARTKIT = resolve(REPO, "tools", "artkit");
const ARTKIT_OUT = join(ARTKIT, "out");
const SUBJECTS_VFX = join(ARTKIT, "subjects.vfx.json");
// The weapon ROSTER lives in the art catalogs (every subject tagged "weapon"), not weapons.ts —
// "weapon" is the whole arsenal: swords, guns, staffs, launchers. weapons.ts only has the few with
// gameplay stats; those get merged in. This is why the smith shows all 30, not just the coded 4.
const SUBJECT_FILES = [join(ARTKIT, "subjects.json"), join(ARTKIT, "subjects.explore.json")];
const WEAPONS_TS = join(REPO, "packages", "shared", "src", "weapons.ts");
const ASSIGN = join(ROOT, "assignments.json");
const PUBLIC = join(ROOT, "public");
const PORT = Number(process.env.PORT) || 5050;

const readJSON = (p, d) => {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return d;
  }
};
const writeJSON = (p, o) => writeFileSync(p, JSON.stringify(o, null, 2));

// Gameplay stats live in weapons.ts (only the coded weapons). Parse id→stats (no TS compile needed).
function readWeaponStats() {
  let src = existsSync(WEAPONS_TS) ? readFileSync(WEAPONS_TS, "utf8") : "";
  src = src.slice(src.indexOf("export const WEAPONS")); // skip the interface (it also has `tags:`)
  const stats = {};
  // each weapon block, line-anchored to 2-space indent (so nested tags/quake/thrown don't match)
  const re = /^ {2}"?([a-z0-9-]+)"?:\s*\{[ \t]*\n([\s\S]*?)\n {2}\},/gm;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    const body = m[2];
    const grab = (k) => {
      const x = body.match(new RegExp(`${k}:\\s*([0-9.]+)`));
      return x ? Number(x[1]) : undefined;
    };
    stats[m[1]] = {
      coded: true,
      damage: grab("damage"),
      range: grab("range"),
      cooldown: grab("cooldown"),
      twoHanded: /twoHanded:\s*true/.test(body),
      dual: /dual:\s*true/.test(body),
      thrown: /thrown:\s*\{/.test(body),
      quake: /quake:\s*\{/.test(body),
    };
  }
  return stats;
}

// The full weapon ROSTER = every art subject tagged "weapon", across both catalogs. Class (sword/
// gun/staff/launcher) + grip come from the subject's tags; gameplay stats merge in from weapons.ts.
const WEAPON_CLASSES = ["sword", "gun", "staff", "launcher"];
function readWeapons() {
  const stats = readWeaponStats();
  const seen = new Set();
  const weapons = [];
  for (const file of SUBJECT_FILES) {
    for (const s of readJSON(file, [])) {
      const tags = Array.isArray(s.tags) ? s.tags : [];
      if (!tags.includes("weapon") || seen.has(s.id)) continue;
      seen.add(s.id);
      const cls = WEAPON_CLASSES.find((c) => tags.includes(c)) || (tags.includes("melee") ? "melee" : "weapon");
      const grip = ["dual", "2H", "1H", "mounted"].find((g) => tags.includes(g)) || "1H";
      const family = tags.find((t) => !["weapon", "melee", "ranged", "caster", "close", "mid", "long", "1H", "2H", "dual", "mounted", "S", "M", "L", "XL", "physical", "fire", "wild-west", "cross-class", "unique", "rez", cls].includes(t)) || cls;
      weapons.push({ id: s.id, name: s.name || s.id, cls, grip, family, tags, ...(stats[s.id] || {}) });
    }
  }
  // Group by class for a tidy sidebar: swords, guns, staffs, launchers, then anything else.
  const order = { sword: 0, gun: 1, launcher: 2, staff: 3, melee: 4, weapon: 5 };
  weapons.sort((a, b) => (order[a.cls] ?? 9) - (order[b.cls] ?? 9) || a.name.localeCompare(b.name));
  return weapons;
}

// Bespoke VFX hero skins authored for the first four weapons (matches vfx-layers.js presets).
const SUBJECT_MAP = {
  "rusty-cleaver": "vfx-cleave-cleaver",
  driftblade: "vfx-slash-driftblade",
  "tombstone-greatsword": "vfx-quake-tombstone",
  "twin-bowie-fangs": "vfx-twinslash-bowie",
};
// Hero candidates come from: a saved override → a bespoke vfx-* skin → the weapon's OWN art. Most of
// the 30 weapons have no bespoke VFX skin yet, so they show their own sprite candidates (which exist).
function vfxSubjectFor(weaponId) {
  const a = readJSON(ASSIGN, {});
  if (a[weaponId]?.vfxSubject) return a[weaponId].vfxSubject;
  if (SUBJECT_MAP[weaponId]) return SUBJECT_MAP[weaponId];
  if (existsSync(join(ARTKIT_OUT, `vfx-${weaponId}`, "sheets"))) return `vfx-${weaponId}`;
  return weaponId; // fall back to the weapon's own sliced art candidates
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
  const a = readJSON(ASSIGN, {});
  a[weaponId] = { ...(a[weaponId] || {}), vfxSubject };
  writeJSON(ASSIGN, a);

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

const server = createServer(async (req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);
  const p = u.pathname;
  try {
    // ---- API ----
    if (p === "/api/weapons") {
      const a = readJSON(ASSIGN, {});
      return json(
        res,
        readWeapons().map((w) => {
          const vfx = vfxSubjectFor(w.id);
          return {
            ...w,
            vfxSubject: vfx,
            candidateCount: listCandidates(vfx).length,
            assigned: a[w.id] || null,
          };
        }),
      );
    }
    if (p.startsWith("/api/weapon/")) {
      const id = decodeURIComponent(p.split("/").pop());
      const w = readWeapons().find((x) => x.id === id);
      if (!w) return json(res, { error: "unknown weapon" }, 404);
      const vfx = vfxSubjectFor(id);
      const a = readJSON(ASSIGN, {});
      return json(res, {
        ...w,
        vfxSubject: vfx,
        candidates: listCandidates(vfx),
        prompt: subjectPrompt(vfx),
        assigned: a[id] || null,
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
      const a = readJSON(ASSIGN, {});
      a[b.weaponId] = {
        ...(a[b.weaponId] || {}),
        vfxSubject: vfxSubjectFor(b.weaponId),
        image: b.image ?? a[b.weaponId]?.image ?? null,
        // The toggleable layer SUITE: { <layerId>: { on, params } }.
        suite: b.suite ?? a[b.weaponId]?.suite ?? null,
        // VFX rotation in degrees (15° increments), applied to the whole composed effect.
        rot: b.rot ?? a[b.weaponId]?.rot ?? 0,
        notes: b.notes ?? a[b.weaponId]?.notes ?? "",
        updatedAt: new Date().toISOString().slice(0, 19),
      };
      writeJSON(ASSIGN, a);
      return json(res, { ok: true, assigned: a[b.weaponId] });
    }
    // ---- serve a chosen Codex candidate image ----
    if (p.startsWith("/art/")) {
      const [, , subject, file] = p.split("/");
      return serveFile(res, join(ARTKIT_OUT, subject, "sheets", file));
    }
    // ---- serve the Phaser UMD build (the WYSIWYG preview uses the SAME engine as the game) ----
    if (p === "/phaser.min.js") {
      const candidates = [
        join(REPO, "node_modules", ".pnpm", "phaser@4.1.0", "node_modules", "phaser", "dist", "phaser.min.js"),
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
server.listen(PORT, () => console.log(`weaponsmith → http://localhost:${PORT}`));
