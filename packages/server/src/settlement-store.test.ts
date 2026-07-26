import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";
import { createMetaAccountV5, sanitizeMetaAccountV5 } from "@dd/shared";
import { afterEach, describe, expect, it } from "vitest";
import {
  type DurableSettlementReceipt,
  SETTLEMENT_FAILPOINTS,
  SettlementStore,
} from "./settlement-store.js";

const ACCOUNT_ID = "acct_process_kill_matrix_000001";
const RUN_ID = "run_process_kill_matrix_000001";
const openStores = new Set<SettlementStore>();
const tempDirectories = new Set<string>();

function fixture() {
  const initial = createMetaAccountV5();
  initial.scrip = 10;
  const canonicalInitial = sanitizeMetaAccountV5(initial);
  const next = structuredClone(canonicalInitial);
  next.revision++;
  next.scrip = 110;
  const canonicalNext = sanitizeMetaAccountV5(next);
  const receipt: DurableSettlementReceipt = {
    version: 1,
    accountId: ACCOUNT_ID,
    runId: RUN_ID,
    outcome: "victory",
    accountRevision: canonicalNext.revision,
    account: canonicalNext,
    money: {
      outcome: "victory",
      banked: 100,
      previousBank: 10,
      bankTotal: 110,
    },
  };
  return {
    initial: canonicalInitial,
    next: canonicalNext,
    receipt,
    commit: {
      accountId: ACCOUNT_ID,
      runId: RUN_ID,
      expectedRevision: canonicalInitial.revision,
      account: canonicalNext,
      receipt,
    },
  };
}

function tempDatabase(label: string): string {
  const directory = mkdtempSync(join(tmpdir(), `dd-settlement-${label}-`));
  tempDirectories.add(directory);
  return join(directory, "accounts.sqlite");
}

function storeAt(path: string): SettlementStore {
  const store = new SettlementStore(path);
  openStores.add(store);
  return store;
}

function closeStore(store: SettlementStore): void {
  if (!openStores.delete(store)) return;
  store.close();
}

function runCrashWorker(
  databasePath: string,
  failpoint: string,
): Promise<{ code: number | null; signal: NodeJS.Signals | null; stderr: string }> {
  const workerPath = resolve("packages/server/src/test-fixtures/settlement-crash-worker.ts");
  const tsxLoader = pathToFileURL(resolve("packages/server/node_modules/tsx/dist/loader.mjs")).href;
  return new Promise((resolvePromise, reject) => {
    const child = spawn(
      process.execPath,
      ["--import", tsxLoader, workerPath, databasePath, failpoint],
      {
        cwd: resolve("."),
        stdio: ["ignore", "ignore", "pipe"],
        windowsHide: true,
      },
    );
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`settlement crash worker timed out at ${failpoint}`));
    }, 10_000);
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code, signal) => {
      clearTimeout(timeout);
      resolvePromise({ code, signal, stderr });
    });
  });
}

afterEach(() => {
  for (const store of openStores) store.close();
  openStores.clear();
  for (const directory of tempDirectories) {
    rmSync(directory, { recursive: true, force: true });
  }
  tempDirectories.clear();
});

describe("SQLite settlement durability", () => {
  it("uses WAL and declares the account/run idempotency key in the schema", () => {
    const path = tempDatabase("schema");
    const store = storeAt(path);
    const { initial } = fixture();
    store.loadOrCreateAccount(ACCOUNT_ID, initial);
    expect(store.journalMode().toLowerCase()).toBe("wal");
    closeStore(store);

    const database = new DatabaseSync(path, { readOnly: true });
    const row = database
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'settlements'")
      .get() as { sql?: unknown } | undefined;
    database.close();
    expect(String(row?.sql)).toMatch(/UNIQUE\s*\(\s*account_id\s*,\s*run_id\s*\)/i);
  });

  it("fires the UNIQUE constraint on a repeated run and returns one identical receipt and balance", () => {
    const store = storeAt(tempDatabase("unique"));
    const value = fixture();
    store.loadOrCreateAccount(ACCOUNT_ID, value.initial);

    const first = store.commitSettlement(value.commit);
    const replay = store.commitSettlement(value.commit);

    expect(first.replayedFromUniqueConstraint).toBe(false);
    expect(replay.replayedFromUniqueConstraint).toBe(true);
    expect(replay.receipt).toEqual(first.receipt);
    expect(store.settlementCount(ACCOUNT_ID, RUN_ID)).toBe(1);
    expect(store.getAccount(ACCOUNT_ID)).toEqual(value.next);
  });

  it("rolls back a stale new-run intent instead of poisoning startup recovery", () => {
    const path = tempDatabase("stale-intent");
    const store = storeAt(path);
    const value = fixture();
    store.loadOrCreateAccount(ACCOUNT_ID, value.initial);
    store.commitSettlement(value.commit);
    const staleRunId = "run_stale_intent_000001";

    expect(() =>
      store.commitSettlement({
        ...value.commit,
        runId: staleRunId,
        receipt: { ...value.receipt, runId: staleRunId },
      }),
    ).toThrow(/revision conflict/);
    expect(store.settlementCount(ACCOUNT_ID, staleRunId)).toBe(0);
    closeStore(store);

    const restarted = storeAt(path);
    expect(restarted.getAccount(ACCOUNT_ID)).toEqual(value.next);
    expect(restarted.settlementCount(ACCOUNT_ID, staleRunId)).toBe(0);
  });

  it.each(
    SETTLEMENT_FAILPOINTS,
  )("survives a process kill at %s, recovers on restart, and replays exactly once", async (failpoint) => {
    const path = tempDatabase(failpoint);
    const value = fixture();
    const seed = storeAt(path);
    seed.loadOrCreateAccount(ACCOUNT_ID, value.initial);
    closeStore(seed);

    const killed = await runCrashWorker(path, failpoint);
    expect(killed.code).not.toBe(0);
    expect(killed.stderr).toContain(`[settlement-failpoint] ${failpoint}`);

    // Opening the restarted store must finish the durable pending intent by itself. There is no
    // room/event left to retry a legitimate extraction after SIGKILL.
    const recovered = storeAt(path);
    expect(recovered.settlementCount(ACCOUNT_ID, RUN_ID)).toBe(1);
    expect(recovered.getAccount(ACCOUNT_ID)).toEqual(value.next);
    expect(recovered.getSettlement(ACCOUNT_ID, RUN_ID)).toEqual(value.receipt);

    const retry = recovered.commitSettlement(value.commit);
    expect(retry.replayedFromUniqueConstraint).toBe(true);
    expect(retry.receipt).toEqual(value.receipt);
    expect(recovered.getAccount(ACCOUNT_ID)).toEqual(value.next);
    expect(recovered.settlementCount(ACCOUNT_ID, RUN_ID)).toBe(1);

    const secondRetry = recovered.commitSettlement(value.commit);
    expect(secondRetry.replayedFromUniqueConstraint).toBe(true);
    expect(secondRetry.receipt).toEqual(value.receipt);
    expect(recovered.getAccount(ACCOUNT_ID)?.scrip).toBe(110);
    expect(recovered.settlementCount(ACCOUNT_ID, RUN_ID)).toBe(1);
  }, 20_000);
});
