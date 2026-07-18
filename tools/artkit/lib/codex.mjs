// artkit/lib/codex.mjs — codex-CLI exec wrapper with per-chat isolation,
// image harvest, and child reaping. GAME-AGNOSTIC infra; the proven core
// lifted from the WORLD_TOURNAMENT art orchestrator.
//
// Why per-chat isolation: image-gen models silently carry visual concepts
// across turns in one chat, and codex's sandbox can't always copy its own
// output to a target path. So we give each generation its OWN CODEX_HOME
// (auth/config junctioned in from the real ~/.codex, but a fresh isolated
// generated_images/) and HARVEST the newest PNG out of it afterward.

import { spawn, spawnSync } from "node:child_process";
import {
  closeSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";

const REAL_CODEX_HOME = join(homedir(), ".codex");
// auth/config are COPIED (codex rewrites some on launch); everything else
// (model cache dirs, etc.) is junctioned so we don't duplicate gigabytes.
const COPY_FILES = ["auth.json", "config.toml", "installation_id", "cap_sid", "models_cache.json"];

let PERCHAT_ROOT = join(process.cwd(), ".artkit-codex-homes");
let LOG = (m) => console.log(m);

/** Configure where per-chat homes live + the log sink. Call once at startup. */
export function configureCodex({ perChatRoot, log } = {}) {
  if (perChatRoot) PERCHAT_ROOT = perChatRoot;
  if (log) LOG = log;
  mkdirSync(PERCHAT_ROOT, { recursive: true });
}

function makeJunction(linkPath, targetPath) {
  if (process.platform === "win32") {
    return spawnSync("cmd", ["/c", "mklink", "/J", linkPath, targetPath], { windowsHide: true }).status === 0;
  }
  try {
    require("node:fs").symlinkSync(targetPath, linkPath, "dir");
    return true;
  } catch {
    return false;
  }
}

function setupPerChatHome(label) {
  const stamp = Date.now();
  const suffix = Math.random().toString(36).slice(2, 8);
  const safe = label.replace(/[^a-z0-9_-]/gi, "_");
  const home = join(PERCHAT_ROOT, `${safe}-${stamp}-${suffix}`);
  mkdirSync(join(home, "generated_images"), { recursive: true });
  if (!existsSync(REAL_CODEX_HOME)) {
    LOG(`WARN no ~/.codex at ${REAL_CODEX_HOME} — is the codex CLI installed + authed?`);
    return home;
  }
  for (const entry of readdirSync(REAL_CODEX_HOME)) {
    if (entry === "generated_images") continue; // keep isolated
    const src = join(REAL_CODEX_HOME, entry);
    const dst = join(home, entry);
    if (existsSync(dst)) continue;
    let isDir = false;
    try {
      isDir = statSync(src).isDirectory();
    } catch {
      continue;
    }
    if (COPY_FILES.includes(entry)) {
      if (!isDir) try { copyFileSync(src, dst); } catch {}
    } else if (isDir) {
      makeJunction(dst, src);
    } else {
      try { copyFileSync(src, dst); } catch {}
    }
  }
  return home;
}

function cleanupHome(home) {
  if (!home) return;
  try { rmSync(home, { recursive: true, force: true }); } catch {}
}

// ── child reaping (so a Ctrl-C / kill doesn't orphan codex API calls) ──
const activeChildren = new Set();
let shuttingDown = false;

function killChild(proc) {
  if (!proc || proc.pid == null) return;
  if (process.platform === "win32") {
    spawn("taskkill", ["/PID", String(proc.pid), "/T", "/F"], { windowsHide: true });
  } else {
    try { proc.kill("SIGTERM"); } catch {}
  }
}

export function reapAllChildren(reason) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (activeChildren.size > 0) LOG(`SHUTDOWN ${reason} — reaping ${activeChildren.size} codex child(ren)`);
  for (const c of activeChildren) killChild(c);
  activeChildren.clear();
}
process.on("SIGINT", () => { reapAllChildren("SIGINT"); process.exit(130); });
process.on("SIGTERM", () => { reapAllChildren("SIGTERM"); process.exit(143); });

function newestPngUnder(dir) {
  let best = null;
  let bestM = -1;
  const walk = (d) => {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.toLowerCase().endsWith(".png")) {
        const m = statSync(p).mtimeMs;
        if (m > bestM) { bestM = m; best = p; }
      }
    }
  };
  walk(dir);
  return best;
}

function allPngsUnder(dir) {
  const out = [];
  const walk = (d) => {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.toLowerCase().endsWith(".png")) out.push({ p, m: statSync(p).mtimeMs });
    }
  };
  walk(dir);
  return out;
}

/**
 * Run one codex image generation. Resolves to the process exit code.
 * @param {object} o
 * @param {string} o.prompt        the full ticket text (sent on stdin)
 * @param {string[]} [o.images]    reference image paths attached with -i
 * @param {string} o.cwd           working dir codex runs in (-C)
 * @param {string} o.label         names the per-chat home (debugging)
 * @param {string} [o.harvestTo]   single output path; newest PNG is copied here
 * @param {string} [o.harvestDir]  multi-output dir (for candidate-1..N)
 * @param {string[]} [o.harvestNames]  filenames, oldest→newest gen order
 * @param {string} [o.reportFile]  codex -o report path
 * @param {string} [o.stdoutFile]  capture stdout/stderr here
 */
export function runCodexExec(o) {
  return new Promise((resolve) => {
    const label = o.label || `gen-${Math.random().toString(36).slice(2, 8)}`;
    const home = setupPerChatHome(label);
    // DD fix: paths can contain spaces (e.g. "Dimension Drifters v2"). With shell:true the
    // args are concatenated UNESCAPED, so quote every path-bearing arg ourselves or the
    // shell splits the path and codex sees stray arguments.
    const q = (s) => `"${String(s).replace(/"/g, '\\"')}"`;
    const args = ["exec", "--full-auto", "-C", q(o.cwd)];
    if (o.reportFile) args.push("-o", q(o.reportFile));
    for (const img of o.images ?? []) args.push("-i", q(img));
    const proc = spawn("codex", args, {
      shell: true,
      cwd: o.cwd,
      env: { ...process.env, CODEX_HOME: home },
    });
    activeChildren.add(proc);
    const fd = o.stdoutFile ? openSync(o.stdoutFile, "w") : null;
    proc.stdout.on("data", (d) => fd && writeSync(fd, d));
    proc.stderr.on("data", (d) => fd && writeSync(fd, d));
    // A child that fails during Windows DLL/process initialization can close stdin before the prompt
    // write completes. Treat EPIPE as an ordinary failed render; the close handler below resolves the
    // job and lets resumable generators continue instead of crashing on an unhandled stream error.
    proc.stdin.on("error", (e) => LOG(`CODEX STDIN FAIL ${label}: ${e.code ?? e.message}`));
    proc.stdin.write(o.prompt);
    proc.stdin.end();
    proc.on("close", (code) => {
      activeChildren.delete(proc);
      if (fd) closeSync(fd);
      const genDir = join(home, "generated_images");
      if (o.harvestTo && !existsSync(o.harvestTo)) {
        const img = newestPngUnder(genDir);
        if (img) {
          try {
            mkdirSync(dirname(o.harvestTo), { recursive: true });
            copyFileSync(img, o.harvestTo);
            LOG(`HARVEST ${basename(o.harvestTo)} ← generated_images`);
          } catch (e) { LOG(`HARVEST FAIL ${o.harvestTo}: ${e.message}`); }
        }
      }
      if (o.harvestDir && o.harvestNames?.length) {
        const imgs = allPngsUnder(genDir).sort((a, b) => a.m - b.m);
        const chosen = imgs.slice(-o.harvestNames.length);
        for (let k = 0; k < chosen.length; k++) {
          const dst = join(o.harvestDir, o.harvestNames[k]);
          if (existsSync(dst)) continue;
          try {
            mkdirSync(o.harvestDir, { recursive: true });
            copyFileSync(chosen[k].p, dst);
            LOG(`HARVEST ${o.harvestNames[k]} ← generated_images`);
          } catch (e) { LOG(`HARVEST FAIL ${o.harvestNames[k]}: ${e.message}`); }
        }
      }
      if (code === 0) cleanupHome(home);
      resolve(code);
    });
    proc.on("error", () => { activeChildren.delete(proc); resolve(1); });
  });
}
