import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll } from "vitest";

const priorDatabasePath = process.env.DD_ACCOUNT_DB_PATH;
const workerId = process.env.VITEST_WORKER_ID ?? String(process.pid);
const databaseDirectory = mkdtempSync(join(tmpdir(), `dd-vitest-${workerId}-`));
const databasePath = join(databaseDirectory, "accounts.sqlite");

// setupFiles run before each test file, so every file gets a private on-disk database even when
// Vitest reuses a worker. Cross-process durability tests continue to pass their own explicit paths.
process.env.DD_ACCOUNT_DB_PATH = databasePath;

afterAll(async () => {
  if (existsSync(databasePath)) {
    const { closeSettlementStore } = await import("./packages/server/src/settlement-store.js");
    closeSettlementStore();
  }
  if (priorDatabasePath === undefined) delete process.env.DD_ACCOUNT_DB_PATH;
  else process.env.DD_ACCOUNT_DB_PATH = priorDatabasePath;
  rmSync(databaseDirectory, { recursive: true, force: true });
});
