import { type ChildProcess, spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { type ArenaState, createMetaAccountV5, type MetaAccountV5, ROOM_NAME } from "@dd/shared";
import { afterEach, describe, expect, it } from "vitest";
import { SettlementStore } from "./settlement-store.js";

const requireFromWorkspace = createRequire(
  new URL("../../../node_modules/.pnpm/node_modules/settlement-restart-test.cjs", import.meta.url),
);
const { Client } = requireFromWorkspace(
  "colyseus.js",
) as typeof import("../../../node_modules/.pnpm/node_modules/colyseus.js");

interface WorkerMessage {
  readonly type?: unknown;
  readonly pid?: unknown;
  readonly port?: unknown;
  readonly outcome?: unknown;
  readonly accountRevision?: unknown;
  readonly bankTotal?: unknown;
}

interface LiveWorker {
  readonly child: ChildProcess;
  readonly pid: number;
  readonly endpoint: string;
}

const liveWorkers = new Set<ChildProcess>();
const tempDirectories = new Set<string>();

function waitForMessage(
  child: ChildProcess,
  predicate: (message: WorkerMessage) => boolean,
  label: string,
): Promise<WorkerMessage> {
  return new Promise((resolvePromise, reject) => {
    let stderr = "";
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`${label} timed out\n${stderr}`));
    }, 15_000);
    const onMessage = (message: WorkerMessage) => {
      if (!predicate(message)) return;
      cleanup();
      resolvePromise(message);
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      cleanup();
      reject(new Error(`${label} worker exited (${code ?? signal})\n${stderr}`));
    };
    const onStderr = (chunk: Buffer | string) => {
      stderr += chunk.toString();
    };
    const cleanup = () => {
      clearTimeout(timeout);
      child.off("message", onMessage);
      child.off("error", onError);
      child.off("exit", onExit);
      child.stderr?.off("data", onStderr);
    };
    child.on("message", onMessage);
    child.once("error", onError);
    child.once("exit", onExit);
    child.stderr?.on("data", onStderr);
  });
}

async function startLiveWorker(databasePath: string): Promise<LiveWorker> {
  const workerPath = resolve("packages/server/src/test-fixtures/settlement-live-server.ts");
  const tsxLoader = pathToFileURL(resolve("packages/server/node_modules/tsx/dist/loader.mjs")).href;
  const child = spawn(process.execPath, ["--import", tsxLoader, workerPath], {
    cwd: resolve("."),
    env: {
      ...process.env,
      DD_ACCOUNT_DB_PATH: databasePath,
      DD_DEV_TOOLS: "1",
    },
    stdio: ["ignore", "pipe", "pipe", "ipc"],
    windowsHide: true,
  });
  liveWorkers.add(child);
  child.once("exit", () => liveWorkers.delete(child));
  const ready = await waitForMessage(child, (message) => message.type === "ready", "server start");
  if (!Number.isInteger(ready.pid) || !Number.isInteger(ready.port) || Number(ready.port) <= 0) {
    throw new Error(`invalid live worker readiness: ${JSON.stringify(ready)}`);
  }
  return {
    child,
    pid: Number(ready.pid),
    endpoint: `http://127.0.0.1:${ready.port}`,
  };
}

function waitForValue(predicate: () => boolean, label: string): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const deadline = Date.now() + 10_000;
    const poll = () => {
      if (predicate()) {
        resolvePromise();
        return;
      }
      if (Date.now() >= deadline) {
        reject(new Error(`${label} timed out`));
        return;
      }
      setTimeout(poll, 20);
    };
    poll();
  });
}

function waitForExit(child: ChildProcess): Promise<{ code: number | null; signal: string | null }> {
  return new Promise((resolvePromise) => {
    child.once("exit", (code, signal) => resolvePromise({ code, signal }));
  });
}

afterEach(async () => {
  const exits: Promise<unknown>[] = [];
  for (const worker of liveWorkers) {
    exits.push(waitForExit(worker));
    worker.kill("SIGKILL");
  }
  await Promise.allSettled(exits);
  liveWorkers.clear();
  for (const directory of tempDirectories) {
    rmSync(directory, { recursive: true, force: true });
  }
  tempDirectories.clear();
});

describe("live settlement crash recovery", () => {
  it("extracts, kills the server process, restarts, and replays one committed bank result", async () => {
    const directory = mkdtempSync(join(tmpdir(), "dd-live-settlement-"));
    tempDirectories.add(directory);
    const databasePath = join(directory, "accounts.sqlite");
    const accountId = "acct_live_crash_recovery_000001";
    const staleAccount = createMetaAccountV5();

    const firstWorker = await startLiveWorker(databasePath);
    const firstClient = new Client(firstWorker.endpoint);
    const firstRoom = await firstClient.joinOrCreate<ArenaState>(ROOM_NAME, {
      accountId,
      metaAccount: staleAccount,
      belt: false,
      beltLevel: "",
      dimensionId: "wild-west",
      bossRush: false,
    });
    const firstManifests: Array<{ runId?: unknown }> = [];
    const firstMoney: unknown[] = [];
    const firstAccounts: MetaAccountV5[] = [];
    firstRoom.onMessage("weaponManifest", (payload: { runId?: unknown }) => {
      firstManifests.push(payload);
    });
    firstRoom.onMessage("moneyBankReceipt", (payload) => firstMoney.push(payload));
    firstRoom.onMessage("metaAccount", (payload) => firstAccounts.push(payload as MetaAccountV5));
    firstRoom.send("requestWeaponManifest");
    await waitForValue(
      () => typeof firstManifests.at(-1)?.runId === "string",
      "first run manifest",
    );
    const completedRunId = String(firstManifests.at(-1)?.runId);

    const extractedMessage = waitForMessage(
      firstWorker.child,
      (message) => message.type === "extracted",
      "live extraction",
    );
    firstWorker.child.send({
      type: "extract",
      roomId: firstRoom.roomId,
      sessionId: firstRoom.sessionId,
      scrip: 177,
    });
    const extracted = await extractedMessage;
    await waitForValue(
      () =>
        firstMoney.some(
          (receipt) =>
            (receipt as { outcome?: unknown }).outcome === "victory" &&
            (receipt as { banked?: unknown }).banked === 177,
        ) && firstAccounts.some((account) => account.scrip === 177),
      "committed extraction receipts",
    );
    expect(extracted).toMatchObject({
      outcome: "victory",
      bankTotal: 177,
    });

    const firstExit = waitForExit(firstWorker.child);
    expect(firstWorker.child.kill("SIGKILL")).toBe(true);
    const killed = await firstExit;
    expect(killed.code).not.toBe(0);

    const secondWorker = await startLiveWorker(databasePath);
    const secondClient = new Client(secondWorker.endpoint);
    const secondRoom = await secondClient.joinOrCreate<ArenaState>(ROOM_NAME, {
      accountId,
      // Deliberately omit the completed run id and committed revision.
      metaAccount: createMetaAccountV5(),
      belt: false,
      beltLevel: "",
      dimensionId: "wild-west",
      bossRush: false,
    });
    const recoveredMoney: unknown[] = [];
    const recoveredAccounts: MetaAccountV5[] = [];
    const recoveredManifests: Array<{ runId?: unknown }> = [];
    secondRoom.onMessage("moneyBankReceipt", (payload) => recoveredMoney.push(payload));
    secondRoom.onMessage("metaAccount", (payload) =>
      recoveredAccounts.push(payload as MetaAccountV5),
    );
    secondRoom.onMessage("weaponManifest", (payload: { runId?: unknown }) => {
      recoveredManifests.push(payload);
    });
    secondRoom.send("requestWeaponManifest");
    secondRoom.send("requestAccountRecovery", { knownRevision: 0 });
    await waitForValue(
      () =>
        recoveredMoney.some(
          (receipt) =>
            (receipt as { outcome?: unknown }).outcome === "victory" &&
            (receipt as { banked?: unknown }).banked === 177 &&
            (receipt as { bankTotal?: unknown }).bankTotal === 177,
        ) &&
        recoveredAccounts.some((account) => account.scrip === 177) &&
        typeof recoveredManifests.at(-1)?.runId === "string",
      "restarted server recovery",
    );

    const recoveredRunId = String(recoveredManifests.at(-1)?.runId);
    expect(recoveredRunId).not.toBe(completedRunId);
    const store = new SettlementStore(databasePath);
    expect(store.settlementCount(accountId, completedRunId)).toBe(1);
    expect(store.getSettlement(accountId, completedRunId)).toMatchObject({
      outcome: "victory",
      money: { banked: 177, bankTotal: 177 },
    });
    expect(store.getAccount(accountId)?.scrip).toBe(177);
    store.close();

    console.log(
      `[live-settlement] killed PID ${firstWorker.pid} with SIGKILL after run ${completedRunId} banked 177; ` +
        `restarted PID ${secondWorker.pid}, recovered victory receipt/balance 177, fresh run ${recoveredRunId}`,
    );
  }, 40_000);
});
