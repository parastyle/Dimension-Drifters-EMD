import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMetaAccountV5, makeRng } from "@dd/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { closeSettlementStore, getSettlementStore } from "../settlement-store.js";

vi.mock("colyseus", () => {
  class Room {
    state: unknown;
    clients: Array<{ sessionId: string; send?: (type: string, payload: unknown) => void }> = [];
    roomId = "durable-settlement-test";
    setState(state: unknown) {
      this.state = state;
    }
    onMessage() {}
    setSimulationInterval() {}
    setPatchRate() {}
    broadcast() {}
    broadcastPatch() {}
  }
  return { Room, Client: class {} };
});

const { GameRoom } = await import("./GameRoom.js");

// biome-ignore lint/suspicious/noExplicitAny: this deliberately inspects server-private settlement state.
type AnyRoom = any;

interface OwnerMessage {
  readonly type: string;
  readonly payload: unknown;
}

let tempDirectory = "";
let priorDatabasePath: string | undefined;

function makeRoom() {
  const room = new GameRoom() as AnyRoom;
  const handlers = new Map<string, (client: { sessionId: string }, message?: unknown) => void>();
  room.onMessage = (
    type: string,
    handler: (client: { sessionId: string }, message?: unknown) => void,
  ) => handlers.set(type, handler);
  room.clients = [];
  room.onCreate({ belt: true });
  return { room, handlers };
}

beforeEach(() => {
  closeSettlementStore();
  priorDatabasePath = process.env.DD_ACCOUNT_DB_PATH;
  tempDirectory = mkdtempSync(join(tmpdir(), "dd-room-settlement-"));
  process.env.DD_ACCOUNT_DB_PATH = join(tempDirectory, "accounts.sqlite");
  const rng = makeRng(0x62_5e77);
  vi.spyOn(Math, "random").mockImplementation(() => rng.next());
});

afterEach(() => {
  vi.restoreAllMocks();
  closeSettlementStore();
  if (priorDatabasePath === undefined) delete process.env.DD_ACCOUNT_DB_PATH;
  else process.env.DD_ACCOUNT_DB_PATH = priorDatabasePath;
  rmSync(tempDirectory, { recursive: true, force: true });
});

describe("GameRoom durable terminal recovery", () => {
  it("replays a committed victory when the stale client cache has no completed run id", () => {
    const accountId = "acct_room_crash_recovery_000001";
    const firstMessages: OwnerMessage[] = [];
    const firstClient = {
      sessionId: "first-session",
      send: (type: string, payload: unknown) => firstMessages.push({ type, payload }),
    };
    const first = makeRoom();
    first.room.clients.push(firstClient);
    first.room.onJoin(firstClient, {
      accountId,
      metaAccount: createMetaAccountV5(),
    });

    const openAccount = structuredClone(first.room.metaAccounts.get(firstClient.sessionId));
    const completedRunId = openAccount.weaponBank.expedition?.runId as string;
    expect(completedRunId).toMatch(/^run_/);
    first.room.state.players.get(firstClient.sessionId).scrip = 125;
    first.room.enterTerminalOutcome("victory");

    const committed = getSettlementStore().getSettlement(accountId, completedRunId);
    expect(committed).toMatchObject({
      outcome: "victory",
      money: { banked: 125, bankTotal: 125 },
      account: { scrip: 125, weaponBank: { expedition: null } },
    });
    expect(first.room.state.outcome).toBe("victory");

    // This is the process boundary: discard every room map and close the SQLite connection.
    closeSettlementStore();

    const secondMessages: OwnerMessage[] = [];
    const secondClient = {
      sessionId: "new-session-after-crash",
      send: (type: string, payload: unknown) => secondMessages.push({ type, payload }),
    };
    const second = makeRoom();
    second.room.clients.push(secondClient);
    second.room.onJoin(secondClient, {
      accountId,
      // Simulate a browser that missed every join-time owner message and therefore has neither
      // the terminal revision nor the completed run id in its stale local cache.
      metaAccount: createMetaAccountV5(),
    });

    const recovered = second.room.metaAccounts.get(secondClient.sessionId);
    expect(recovered.scrip).toBe(125);
    expect(recovered.weaponBank.expedition?.runId).not.toBe(completedRunId);
    expect(secondMessages.some((message) => message.type === "expeditionAbandonReceipt")).toBe(
      false,
    );
    expect(
      secondMessages.find((message) => message.type === "weaponSettlementReceipt")?.payload,
    ).toMatchObject({ ok: true, outcome: "victory" });
    expect(secondMessages.find((message) => message.type === "moneyBankReceipt")?.payload).toEqual({
      outcome: "victory",
      banked: 125,
      previousBank: 0,
      bankTotal: 125,
    });

    const beforeReplay = secondMessages.length;
    second.handlers.get("requestAccountRecovery")?.(secondClient, {
      knownRevision: 0,
    });
    const replay = secondMessages.slice(beforeReplay);
    expect(replay.find((message) => message.type === "moneyBankReceipt")?.payload).toEqual(
      committed?.money,
    );
    expect(
      (replay.at(-1)?.payload as { weaponBank?: { expedition?: { runId?: string } } }).weaponBank
        ?.expedition?.runId,
    ).toBe(recovered.weaponBank.expedition?.runId);
    expect(getSettlementStore().settlementCount(accountId, completedRunId)).toBe(1);
  });
});
