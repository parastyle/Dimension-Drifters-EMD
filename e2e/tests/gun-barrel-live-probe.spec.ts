import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";
import { runArenaSpec } from "../helpers/arena-harness.js";

const execFileAsync = promisify(execFile);
const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const RIFLES = [
  "x2-gravedog-auto-rifle",
  "x2-stormspur-coil-carbine",
  "x2-brimstone-gallows-rifle",
  "x2-hellbore-gatling",
] as const;

test("the V5G rifle barrel live probe recovers every server origin at the painted muzzle", async ({
  page,
}) => {
  await runArenaSpec(page, async (baseURL) => {
    for (const weaponId of RIFLES) {
      const result = await execFileAsync(
        process.execPath,
        ["tools/gun-barrel-live-probe.mjs", "after", weaponId],
        {
          cwd: REPO_ROOT,
          env: { ...process.env, DD_E2E_BASE_URL: baseURL },
          maxBuffer: 2_000_000,
        },
      );
      console.log(result.stdout.trim());
      expect(result.stderr.trim(), `${weaponId} probe stderr`).toBe("");
    }
  });
});
