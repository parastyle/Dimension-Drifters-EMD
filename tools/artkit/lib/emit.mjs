// artkit/lib/emit.mjs — write-or-check sink for the code generators (audit H15).
//
// A generator builds its output string then hands it here instead of calling writeFileSync directly:
//   - normal run        → writes the file (unchanged behaviour).
//   - run with --check   → diffs the string against the COMMITTED file and flags drift (process exit ≠ 0)
//                          WITHOUT writing, so "edited the source data, forgot to re-run codegen" becomes a
//                          CI failure (pnpm gen:check, between lint and build) instead of a stale-stats bug
//                          discovered mid-playtest. Only the standalone, dependency-free generators
//                          (weapons-expansion, dimensions) are gated — they emit committed *.generated.ts the
//                          build consumes; the sharp/codex art generators are out-of-band on purpose.
import { readFileSync, writeFileSync } from "node:fs";

/** True when the process was invoked with `--check` (diff-only, no write). */
export const isCheck = process.argv.includes("--check");

// Compare LF-normalized so a CRLF checkout (autocrlf) never reads as drift.
const norm = (s) => s.replace(/\r\n/g, "\n");

/**
 * Persist `content` to `outPath`, or — under `--check` — verify the committed file already matches it.
 * Returns true on success; on drift it prints the offending file and sets `process.exitCode = 1` (so a
 * caller chaining several emits still surfaces EVERY stale file before exiting non-zero).
 */
export function emit(outPath, content, label = outPath) {
  if (!isCheck) {
    writeFileSync(outPath, content);
    return true;
  }
  let existing = null;
  try {
    existing = readFileSync(outPath, "utf8");
  } catch {
    existing = null; // never generated / deleted
  }
  if (existing != null && norm(existing) === norm(content)) {
    console.log(`✓ ${label} is in sync`);
    return true;
  }
  console.error(
    `✗ ${label} is STALE — its committed file does not match what the source data now generates.\n` +
      "  Re-run its generator (drop the --check flag) and commit the regenerated file.",
  );
  process.exitCode = 1;
  return false;
}
