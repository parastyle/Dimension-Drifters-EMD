import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";
import { runArenaSpec } from "../helpers/arena-harness.js";

const execFileAsync = promisify(execFile);
const REPO_ROOT = path.resolve(import.meta.dirname, "../..");

test("the V6G1 named live probe keeps every impact off the character anchor", async ({ page }) => {
  test.setTimeout(300_000);
  await runArenaSpec(page, async (baseURL) => {
    const result = await execFileAsync(
      process.execPath,
      ["tools/v6g-impact-anchor-live-probe.mjs"],
      {
        cwd: REPO_ROOT,
        env: { ...process.env, DD_E2E_BASE_URL: baseURL },
        maxBuffer: 4_000_000,
        timeout: 210_000,
      },
    );
    console.log(result.stdout.trim());
    expect(result.stderr.trim(), "V6G impact-anchor probe stderr").toBe("");
  });
});
