#!/usr/bin/env node
// tools/sol/merge-weapon-branch.mjs — merge ONE weapon/gun Sol branch into the current branch.
//
//   node tools/sol/merge-weapon-branch.mjs sol/b63-gun-02
//
// Every weapon Sol appends exactly one entry to data/weapon-concepts-300.json (and sometimes
// data/weapon-tiers.json), so N parallel branches all conflict on the same append site. Textual
// merge is fragile there — the conflict lands INSIDE an object literal. This resolves the data
// files SEMANTICALLY with a JSON parser (union by id, ours wins on collision) and then simply
// REGENERATES every generated artefact, which removes those conflicts entirely rather than
// resolving them by hand.
//
// Generated files are never merged: they are rebuilt from the merged sources by `pnpm gen`.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const branch = process.argv[2];
if (!branch) {
  console.error("usage: merge-weapon-branch.mjs <branch>");
  process.exit(2);
}

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const gitQuiet = (...args) => {
  try {
    execFileSync("git", args, { encoding: "utf8", stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
};

/** Data files that are hand-appended by Sols and must be unioned rather than text-merged. */
const DATA_FILES = ["data/weapon-concepts-300.json", "data/weapon-tiers.json"];

/** Union `incoming` into `base` by identity, preserving base order and appending what is new. */
function unionEntries(baseArr, incomingArr, keyOf) {
  const seen = new Set(baseArr.map(keyOf));
  const added = [];
  for (const entry of incomingArr) {
    const k = keyOf(entry);
    if (!seen.has(k)) {
      seen.add(k);
      baseArr.push(entry);
      added.push(k);
    }
  }
  return added;
}

const keyOf = (w) => w?.id ?? w?.name ?? JSON.stringify(w);

if (gitQuiet("merge", "--no-edit", branch)) {
  console.log(`${branch}: clean merge`);
  process.exit(0);
}

// Conflicted. Resolve data files semantically, regenerate the rest.
const conflicted = git("diff", "--diff-filter=U", "--name-only").split("\n").filter(Boolean);
const added = [];

for (const file of DATA_FILES) {
  if (!conflicted.includes(file)) continue;
  const ours = JSON.parse(git("show", `HEAD:${file}`));
  const theirs = JSON.parse(git("show", `${branch}:${file}`));

  if (Array.isArray(ours.weapons) && Array.isArray(theirs.weapons)) {
    added.push(...unionEntries(ours.weapons, theirs.weapons, keyOf));
    if (typeof ours.count === "number") ours.count = ours.weapons.length;
  } else if (Array.isArray(ours) && Array.isArray(theirs)) {
    added.push(...unionEntries(ours, theirs, keyOf));
  } else {
    // Nested id-keyed maps (weapon-tiers.json is `{version, formula, tiers:{id:n}}`), plus any
    // top-level id-keyed shape. Union every plain-object map we find one level deep, then the
    // top level itself. Codegen is STRICT: a concept with no authored tier aborts `pnpm gen`,
    // so missing a nested map here fails loudly rather than silently.
    for (const [k, v] of Object.entries(theirs)) {
      if (v && typeof v === "object" && !Array.isArray(v) && ours[k] && typeof ours[k] === "object") {
        for (const [ik, iv] of Object.entries(v)) {
          if (!(ik in ours[k])) {
            ours[k][ik] = iv;
            added.push(`${k}.${ik}`);
          }
        }
      } else if (!(k in ours)) {
        ours[k] = v;
        added.push(k);
      }
    }
  }
  writeFileSync(file, `${JSON.stringify(ours, null, 2)}\n`, "utf8");
  gitQuiet("add", file);
}

// Anything still conflicted that is generated: rebuild it rather than merge it.
const stillConflicted = git("diff", "--diff-filter=U", "--name-only").split("\n").filter(Boolean);
for (const file of stillConflicted) {
  // Take ours as a placeholder; `pnpm gen` overwrites generated artefacts below.
  gitQuiet("checkout", "--ours", "--", file);
  gitQuiet("add", file);
}

// `--defer-gen` batches many branches before regenerating once. Codegen pins the catalog size
// (`weapon-resource.ts` throws on an unexpected weapon count), so adding N weapons one merge at a
// time would trip that guard on every single merge. Merge them all, bump the pin deliberately, gen once.
if (!process.argv.includes("--defer-gen")) {
  execFileSync("pnpm", ["gen"], { stdio: "inherit", shell: true });
}
gitQuiet("add", "-A");
// `--no-edit` only works while MERGE_HEAD exists; resolving every path can end the merge state,
// so pass an explicit message and fall back rather than dying with a bare "command failed".
if (!gitQuiet("commit", "--no-edit")) {
  if (!gitQuiet("commit", "-m", `Merge branch '${branch}' (semantic weapon-data union)`)) {
    console.error(`${branch}: nothing to commit — inspect \`git status\` before continuing`);
    process.exit(1);
  }
}

console.log(`${branch}: resolved (added ${added.length}: ${added.join(", ") || "none"})`);
console.log(`  regenerated after union; still-conflicted-at-entry: ${stillConflicted.join(", ")}`);
