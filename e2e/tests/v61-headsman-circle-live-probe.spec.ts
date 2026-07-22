import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";
import { runArenaSpec } from "../helpers/arena-harness.js";

const execFileAsync = promisify(execFile);
const REPO_ROOT = path.resolve(import.meta.dirname, "../..");

test("V6.1 ships the seamless Headsman and replaces generic cursor rings live", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await runArenaSpec(page, async (baseURL) => {
    const result = await execFileAsync(
      process.execPath,
      ["tools/v61-headsman-circle-live-probe.mjs"],
      {
        cwd: REPO_ROOT,
        env: { ...process.env, DD_E2E_BASE_URL: baseURL, V61_PHASE: "after" },
        maxBuffer: 4_000_000,
        timeout: 180_000,
      },
    );
    console.log(result.stdout.trim());
    expect(result.stderr.trim(), "V6.1 live probe stderr").toBe("");
  });
});
