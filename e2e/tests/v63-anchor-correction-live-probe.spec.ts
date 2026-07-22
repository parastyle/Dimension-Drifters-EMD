import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";
import { runArenaSpec } from "../helpers/arena-harness.js";

const execFileAsync = promisify(execFile);
const REPO_ROOT = path.resolve(import.meta.dirname, "../..");

test("V6.3 removes synthesized target punctuation while retaining source composition live", async ({
  page,
}) => {
  test.setTimeout(360_000);
  await runArenaSpec(page, async (baseURL) => {
    for (const phase of ["before", "after"] as const) {
      const result = await execFileAsync(
        process.execPath,
        ["tools/v63-anchor-correction-live-probe.mjs", `--phase=${phase}`],
        {
          cwd: REPO_ROOT,
          env: { ...process.env, DD_E2E_BASE_URL: baseURL },
          maxBuffer: 4_000_000,
          timeout: 300_000,
        },
      );
      console.log(result.stdout.trim());
      expect(result.stderr.trim(), `V6.3 ${phase} probe stderr`).toBe("");
    }
  });
});
