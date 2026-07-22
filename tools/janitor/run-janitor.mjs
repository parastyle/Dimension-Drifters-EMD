#!/usr/bin/env node
// DDv2 nightly janitor — cheap-model / unattended maintenance.
//
// Two jobs, both machine-checkable, neither requiring judgment:
//   1. FLAKE CHARACTERIZATION — run the unit suite N times, record which tests fail
//      non-deterministically and at what rate.
//   2. DERIVED-ARTIFACT DRIFT — regenerate every generated artifact and report what moved.
//
// SAFETY CONTRACT: this script never commits, never pushes, never touches game logic, and never
// stops the owner's dev stack. It writes a report and leaves any regenerated files in the worktree
// for a human/orchestrator to review. Exit code is always 0 unless the janitor itself broke.
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT_DIR = path.join(ROOT, "docs/janitor");
const RUNS = Number(process.env.JANITOR_RUNS ?? 10);

function sh(cmd, timeoutMs = 900_000) {
  try {
    const stdout = execSync(cmd, {
      cwd: ROOT,
      encoding: "utf8",
      timeout: timeoutMs,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ok: true, stdout };
  } catch (error) {
    return {
      ok: false,
      stdout: `${error.stdout ?? ""}${error.stderr ?? ""}`,
      timedOut: error.signal === "SIGTERM",
    };
  }
}

/** Vitest prints failing test names as "× suite > case". Collect them per run. */
function failingTests(output) {
  const names = new Set();
  for (const line of output.split("\n")) {
    const match = /^\s*[×✕]\s+(.+?)(?:\s+\d+ms)?\s*$/.exec(line.replace(/\[[0-9;]*m/g, ""));
    if (match?.[1]) names.add(match[1].trim());
  }
  return names;
}

// ---- Preflight: refuse to run unless the repo is QUIET -----------------------------------------
// Both jobs are meaningless-to-harmful against in-flight work. Job 1 reports a Sol's half-finished
// edits as "flakes"; job 2 regenerates artifacts INTO the worktree, mutating files underneath a
// running agent. Neither is worth a nightly false alarm, so a busy repo defers instead of guessing.
const dirtyFiles = sh("git status --porcelain").stdout.trim().split("\n").filter(Boolean);
// Windows: execSync runs through cmd.exe, which has no `ps`/`grep` — use tasklist. An unreadable
// process table means we do NOT know whether the fleet is working, so it counts as "not quiet".
// Failing closed costs one skipped night; failing open corrupts a Sol's worktree.
const taskList = sh('tasklist /FI "IMAGENAME eq codex.exe" /NH', 60_000);
const activeAgents = taskList.ok
  ? taskList.stdout.split("\n").filter((line) => /codex\.exe/i.test(line)).length
  : null;

const quietBlockers = [];
if (dirtyFiles.length > 0) quietBlockers.push(`${dirtyFiles.length} uncommitted files`);
if (activeAgents === null) quietBlockers.push("could not read the process table");
else if (activeAgents > 0) quietBlockers.push(`${activeAgents} codex agents running`);

if (quietBlockers.length > 0 && process.env.JANITOR_FORCE !== "1") {
  const deferred = `# Janitor report — ${new Date().toISOString()}

**DEFERRED — repo was not quiet.** ${quietBlockers.join("; ")}.

Nothing was run and nothing was written. Both jobs require a quiet repo to say anything true:
flake characterization would report in-flight edits as nondeterminism, and the drift job would
regenerate artifacts into a worktree another agent is actively editing.

This is the expected outcome on any night the fleet is working. It is not a failure.
Re-runs automatically on the next scheduled pass. Override with \`JANITOR_FORCE=1\` only against a
tree you are willing to have regenerated.
`;
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(path.join(OUT_DIR, "latest.md"), deferred);
  console.log(`janitor: DEFERRED — ${quietBlockers.join("; ")}`);
  process.exit(0);
}

// ---- Job 1: flake characterization -------------------------------------------------------------
const flakeCounts = new Map();
let cleanRuns = 0;
const runSummaries = [];
for (let run = 1; run <= RUNS; run++) {
  // NOT --reporter=dot: it suppresses per-test failure names, so flakes could be counted but
  // never identified. The default reporter prints "× suite > case" lines we can attribute.
  const result = sh("npx vitest run");
  const totals = /Tests\s+(?:(\d+) failed[^\n]*?\|\s*)?(\d+) passed/.exec(
    result.stdout.replace(/\[[0-9;]*m/g, ""),
  );
  const failed = Number(totals?.[1] ?? 0);
  const passed = Number(totals?.[2] ?? 0);
  if (failed === 0 && result.ok) cleanRuns++;
  for (const name of failingTests(result.stdout)) {
    flakeCounts.set(name, (flakeCounts.get(name) ?? 0) + 1);
  }
  runSummaries.push({ run, failed, passed, timedOut: !!result.timedOut });
}

// ---- Job 2: derived-artifact drift -------------------------------------------------------------
const beforeDirty = sh("git status --porcelain").stdout.trim().split("\n").filter(Boolean).length;
const generators = [
  { name: "weapon codegen check", cmd: "node tools/artkit/gen-weapon-expansion.mjs --check" },
  { name: "asset manifest check", cmd: "node tools/artkit/check-assets.mjs" },
  { name: "vfx reference sheet", cmd: "node tools/portal/gen-vfx-reference.mjs" },
  { name: "dev portal", cmd: "node tools/portal/gen-portal.mjs" },
];
const generatorResults = generators.map((g) => ({ ...g, ...sh(g.cmd, 600_000) }));
const afterStatus = sh("git status --porcelain").stdout.trim().split("\n").filter(Boolean);
const drifted = afterStatus.length - beforeDirty;

// Capture WHAT drifted, then put the tree back. The preflight guarantees it was clean, so reverting
// tracked modifications restores exactly the committed state — the janitor must not leave the owner
// with a pile of regenerated files to untangle in the morning. Untracked output is reported, never
// deleted: removing files we did not author is not a risk worth taking unattended.
const driftDiff = drifted > 0 ? sh("git diff --stat").stdout.trim() : "";
const untracked = afterStatus.filter((line) => line.startsWith("??")).map((l) => l.slice(3));
if (drifted > 0) sh("git checkout -- .");
const restored = sh("git status --porcelain").stdout.trim().split("\n").filter(Boolean);
const cleanAfterRestore = restored.length === untracked.length;

// ---- Report ------------------------------------------------------------------------------------
const stamp = new Date().toISOString();
const flakes = [...flakeCounts.entries()].sort((a, b) => b[1] - a[1]);
const head = sh("git log --oneline -1").stdout.trim();
// A dirty worktree means these results describe UNCOMMITTED in-flight work, not the baseline —
// a Sol mid-implementation will look like a pile of flakes. Say so loudly rather than mislead.
const dirtyWarning =
  beforeDirty > 0
    ? `\n> **Worktree was DIRTY (${beforeDirty} files) when this ran.** These results characterize uncommitted in-flight work, not the committed baseline. Re-run on a clean tree before trusting the flake table.\n`
    : "";
const report = `# Janitor report — ${stamp}

HEAD: \`${head}\`
Runs: ${RUNS} · fully clean runs: ${cleanRuns}/${RUNS}
Never commits, never pushes, never edits game logic.
${dirtyWarning}

## 1. Flake characterization

${
  flakes.length === 0
    ? `No test failed in any of the ${RUNS} runs. No flakes observed at this sample size.`
    : `| Test | Failed runs | Rate |\n|---|---:|---:|\n${flakes
        .map(([name, n]) => `| ${name} | ${n}/${RUNS} | ${((n / RUNS) * 100).toFixed(0)}% |`)
        .join("\n")}\n\nA test failing in SOME but not all runs is nondeterministic. 100% means a real, stable failure — escalate that, do not treat it as a flake.`
}

<details><summary>Per-run totals</summary>

${runSummaries.map((r) => `- run ${r.run}: ${r.passed} passed, ${r.failed} failed${r.timedOut ? " (TIMED OUT)" : ""}`).join("\n")}

</details>

## 2. Derived-artifact drift

${generatorResults.map((g) => `- ${g.ok ? "OK  " : "FAIL"} — ${g.name}${g.ok ? "" : `\n  \`\`\`\n  ${g.stdout.split("\n").slice(-6).join("\n  ")}\n  \`\`\``}`).join("\n")}

Worktree files changed by regeneration: **${drifted}**.
${
  drifted > 0
    ? `Regenerated output differs from what is committed — a generated artifact is stale in git:\n\n\`\`\`\n${driftDiff}\n\`\`\`\n\n${untracked.length > 0 ? `Untracked files produced (left in place, NOT deleted):\n${untracked.map((f) => `- \`${f}\``).join("\n")}\n` : ""}`
    : "No drift: every generated artifact matches what is committed."
}
Tree restored after measuring: **${cleanAfterRestore ? "yes — tracked files reverted to HEAD" : "NO — review manually"}**.

## Escalate to a real Sol if

- any test shows a 100% failure rate (that is a break, not a flake)
- a generator FAILED rather than merely drifted
- drift appears in \`packages/shared/src/*.generated.ts\` (catalog/codegen desync has taken the game down before)
`;

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(path.join(OUT_DIR, "latest.md"), report);
writeFileSync(path.join(OUT_DIR, `${stamp.replace(/[:.]/g, "-")}.md`), report);
console.log(`janitor: ${cleanRuns}/${RUNS} clean runs, ${flakes.length} flaky tests, ${drifted} drifted files`);
console.log(`report: docs/janitor/latest.md`);
