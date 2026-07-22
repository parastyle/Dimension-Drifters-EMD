import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";
import { runArenaSpec } from "../helpers/arena-harness.js";

const execFileAsync = promisify(execFile);
const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const FULL = process.env.DD_FULL_MUZZLE_SWEEP === "1";
const EXPLICIT_WEAPONS = process.env.DD_MUZZLE_WEAPONS;
const SCREENSHOTS = process.env.DD_MUZZLE_SCREENSHOTS ?? "none";
const OUTPUT = process.env.DD_MUZZLE_OUTPUT ?? path.join(".tmp-bin", `muzzle-e2e-${process.pid}`);

/**
 * Default policy: every base gun, every multi-barrel/burst/dual outlier, one deterministic member of
 * every gun/beam family, plus a UTC-daily 1/24 catalog rotation. Catalog/muzzle changes and release
 * qualification run `DD_FULL_MUZZLE_SWEEP=1 pnpm e2e -- gun-barrel-live-probe.spec.ts`.
 */
test.setTimeout(FULL ? 30 * 60_000 : 10 * 60_000);

test(`${EXPLICIT_WEAPONS ? "explicit" : FULL ? "full" : "sampled"} gun-delivery catalog keeps live spawn origins on painted muzzles`, async ({
  page,
}) => {
  await runArenaSpec(page, async (baseURL) => {
    try {
      const result = await execFileAsync(
        process.execPath,
        [
          "tools/gun-barrel-live-probe.mjs",
          EXPLICIT_WEAPONS ? `--weapon=${EXPLICIT_WEAPONS}` : FULL ? "--full" : "--sample",
          `--screenshots=${SCREENSHOTS}`,
          `--output=${OUTPUT}`,
        ],
        {
          cwd: REPO_ROOT,
          env: { ...process.env, DD_E2E_BASE_URL: baseURL },
          maxBuffer: 8_000_000,
          timeout: FULL ? 29 * 60_000 : 9 * 60_000,
        },
      );
      console.log(result.stdout.trim());
      expect(result.stderr.trim(), "catalog muzzle probe stderr").toBe("");
    } catch (error) {
      const failed = error as Error & { stdout?: string; stderr?: string };
      if (failed.stdout?.trim()) console.log(failed.stdout.trim());
      if (failed.stderr?.trim()) console.error(failed.stderr.trim());
      throw error;
    }
  });
});
