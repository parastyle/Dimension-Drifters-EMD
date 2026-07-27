import { createRequire } from "node:module";
import {
  type ArenaState,
  createMetaAccountV5,
  ROOM_NAME,
  type SingleWeaponEntryV1,
} from "@dd/shared";
import { matchMaker } from "colyseus";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { Room } from "../../../node_modules/.pnpm/node_modules/colyseus.js";
import { createGameServer } from "./index.js";

// The browser client owns colyseus.js 0.16.22. Resolve that existing workspace install without adding a
// second SDK copy to the server package solely for this transport test.
const requireFromWorkspace = createRequire(
  new URL("../../../node_modules/.pnpm/node_modules/integration-test.cjs", import.meta.url),
);
const { Client } = requireFromWorkspace(
  "colyseus.js",
) as typeof import("../../../node_modules/.pnpm/node_modules/colyseus.js");

type ClientRoom = Room<ArenaState>;
type GameServer = Awaited<ReturnType<typeof createGameServer>>;

// This file owns real TCP/WebSocket timers while the full Vitest run saturates sibling workers. Five
// seconds was shorter than a valid event-loop stall under that load (the strict test passed 3/3 alone and
// failed about half of full runs). Keep every event/state assertion exact, but give the real transport a
// load-insensitive scheduling budget.
const STATE_TIMEOUT_MS = 15_000;

// Colyseus registers optional PM2 metrics when the real Server starts. In Vitest's fork pool PM2 sees the
// runner IPC channel and emits `axm:*` objects into it, but Vitest's channel only accepts serialized buffers.
// Drop only those optional metric frames; all Vitest worker messages continue through unchanged.
const testWorkerSend = process.send?.bind(process) as ((...args: unknown[]) => boolean) | undefined;
if (testWorkerSend) {
  process.send = ((message: unknown, ...args: unknown[]) => {
    const type =
      typeof message === "object" && message !== null && "type" in message
        ? (message as { type?: unknown }).type
        : undefined;
    if (typeof type === "string" && type.startsWith("axm:")) return true;
    return testWorkerSend(message, ...args);
  }) as typeof process.send;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function waitForState(
  room: ClientRoom,
  predicate: (state: ArenaState) => boolean,
  label: string,
): Promise<void> {
  const deadline = Date.now() + STATE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const state = room.state as ArenaState | undefined;
    if (state && predicate(state)) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`${label} timed out after ${STATE_TIMEOUT_MS}ms`);
}

/** Wait for a decoded state-change event, not the server-side object, so handler + serializer failures surface. */
function waitForPatch(
  room: ClientRoom,
  predicate: (state: ArenaState) => boolean,
  label: string,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const onStateChange = (state: ArenaState) => {
      if (!predicate(state)) return;
      clearTimeout(timer);
      room.onStateChange.remove(onStateChange);
      resolve();
    };
    const timer = setTimeout(() => {
      room.onStateChange.remove(onStateChange);
      reject(new Error(`${label} timed out after ${STATE_TIMEOUT_MS}ms`));
    }, STATE_TIMEOUT_MS);
    room.onStateChange(onStateChange);
  });
}

async function waitForValue(predicate: () => boolean, label: string): Promise<void> {
  const deadline = Date.now() + STATE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`${label} timed out after ${STATE_TIMEOUT_MS}ms`);
}

describe("real Colyseus transport", () => {
  let server: GameServer;
  let endpoint: string;
  const openRooms = new Set<ClientRoom>();

  beforeAll(async () => {
    server = await withTimeout(createGameServer(0), 10_000, "server startup");
    const address = server.transport.server?.address();
    if (!address || typeof address === "string")
      throw new Error("server did not expose a TCP port");
    endpoint = `http://127.0.0.1:${address.port}`;
  }, 12_000);

  afterEach(async () => {
    const rooms = [...openRooms];
    openRooms.clear();
    const results = await Promise.allSettled(
      rooms.map((room) => withTimeout(room.leave(), 3_000, `leave ${room.sessionId}`)),
    );
    const failed = results.find((result) => result.status === "rejected");
    if (failed?.status === "rejected") throw failed.reason;
  }, 8_000);

  afterAll(async () => {
    if (!server) return;
    try {
      await withTimeout(server.gracefullyShutdown(false), 5_000, "server shutdown");
    } finally {
      // A failed graceful shutdown must not leave the HTTP/WebSocket listener holding Vitest open.
      if (server.transport.server?.listening) server.transport.shutdown();
    }
  }, 8_000);

  it("partitions matchmaking, syncs schema/input patches, and removes a leaving player before rejoin", async () => {
    const firstClient = new Client(endpoint);
    const secondClient = new Client(endpoint);
    const otherDimensionClient = new Client(endpoint);
    const sameDimension = {
      belt: false,
      beltLevel: "",
      dimensionId: "wild-west",
      bossRush: false,
    };
    const join = async (client: InstanceType<typeof Client>, options: typeof sameDimension) => {
      const room = await withTimeout(
        client.joinOrCreate<ArenaState>(ROOM_NAME, options),
        STATE_TIMEOUT_MS,
        `joinOrCreate ${options.dimensionId}`,
      );
      openRooms.add(room);
      return room;
    };

    const firstRoom = await join(firstClient, sameDimension);
    const secondRoom = await join(secondClient, sameDimension);
    const otherRoom = await join(otherDimensionClient, {
      ...sameDimension,
      dimensionId: "frostfell",
    });

    // §39 regression guard: identical filter values co-op; a different dimension cannot match that room.
    expect(secondRoom.roomId).toBe(firstRoom.roomId);
    expect(otherRoom.roomId).not.toBe(firstRoom.roomId);

    await waitForState(
      firstRoom,
      (state) => state.schemaVersion > 0 && state.players.has(firstRoom.sessionId),
      "initial schema handshake",
    );
    expect(firstRoom.state.schemaVersion).toBeGreaterThan(0);
    expect(firstRoom.state.players.has(firstRoom.sessionId)).toBe(true);

    // A real input handler must consume the command and serialize its acknowledgement in a later patch.
    const inputSeq = 37;
    const inputAck = waitForPatch(
      firstRoom,
      (state) => (state.players.get(firstRoom.sessionId)?.ackSeq ?? 0) >= inputSeq,
      "input acknowledgement patch",
    );
    firstRoom.send("input", { seq: inputSeq, dx: 1, dy: 0, jump: false });
    await inputAck;
    expect(firstRoom.state.players.get(firstRoom.sessionId)?.ackSeq).toBe(inputSeq);

    // Keep a peer in the room to observe the authoritative deletion, then join the same partition again.
    await waitForState(
      secondRoom,
      (state) => state.players.has(firstRoom.sessionId),
      "peer player visibility",
    );
    const departedSessionId = firstRoom.sessionId;
    const playerRemoved = waitForPatch(
      secondRoom,
      (state) => !state.players.has(departedSessionId),
      "departed player removal patch",
    );
    await withTimeout(firstRoom.leave(), 3_000, "first client leave");
    openRooms.delete(firstRoom);
    await playerRemoved;
    expect(secondRoom.state.players.has(departedSessionId)).toBe(false);

    const rejoinedRoom = await join(firstClient, sameDimension);
    expect(rejoinedRoom.roomId).toBe(secondRoom.roomId);
    expect(rejoinedRoom.sessionId).not.toBe(departedSessionId);
    await waitForState(
      rejoinedRoom,
      (state) =>
        !!state.players?.has(rejoinedRoom.sessionId) && !state.players.has(departedSessionId),
      "clean rejoin state",
    );
  }, 20_000);

  it("terminates the socket and reconnects the same run without state or settlement duplication", async () => {
    const client = new Client(endpoint);
    const account = createMetaAccountV5();
    const carried: SingleWeaponEntryV1 = {
      kind: "single",
      entryId: "wi_reconnecttransport0001",
      weapon: {
        instanceId: "wi_reconnecttransport0001",
        weaponId: "rusty-cleaver",
        rarity: "common",
        affix: "",
        provenance: "enemy-drop",
        sourceWorldTier: 0,
      },
    };
    account.weaponBank.stash.push(carried);
    const room = await withTimeout(
      client.joinOrCreate<ArenaState>(ROOM_NAME, {
        belt: false,
        beltLevel: "",
        dimensionId: "wild-west",
        bossRush: false,
        metaAccount: account,
        carry: {
          requestId: "reconnect-transport-carry",
          expectedRevision: account.revision,
          placements: [{ entryId: carried.entryId, zone: "active", start: 1 }],
          activeEntryId: carried.entryId,
          requestedWorldTier: 0,
        },
      }),
      STATE_TIMEOUT_MS,
      "reconnection fixture join",
    );
    openRooms.add(room);
    await waitForState(
      room,
      (state) => !!state.players?.has(room.sessionId),
      "reconnection fixture state",
    );
    const initialManifests: Array<{ runId?: unknown }> = [];
    room.onMessage("weaponManifest", (payload: { runId?: unknown }) => {
      initialManifests.push(payload);
    });
    room.send("requestWeaponManifest");
    await waitForValue(
      () => typeof initialManifests.at(-1)?.runId === "string",
      "post-handler weapon manifest",
    );

    // Reach the authoritative room only to pin exact state and inspect private escrow. The disconnect and
    // recovery themselves cross the real WebSocket transport and public reconnection handshake.
    // biome-ignore lint/suspicious/noExplicitAny: the public test server API intentionally hides local room internals.
    const authoritative = matchMaker.getLocalRoomById(room.roomId) as any;
    const serverPlayer = authoritative.state.players.get(room.sessionId);
    const preservedX = authoritative.map.spawnX;
    const preservedY = authoritative.map.spawnY;
    serverPlayer.x = preservedX;
    serverPlayer.y = preservedY;
    serverPlayer.maxHp = 73;
    serverPlayer.hp = 73;
    authoritative.combat.get(room.sessionId).invuln = 999;
    authoritative.broadcastPatch();
    await waitForPatch(
      room,
      (state) => {
        const player = state.players?.get(room.sessionId);
        return player?.x === preservedX && player?.y === preservedY && player?.hp === 73;
      },
      "pinned player state patch",
    );

    const departedSessionId = room.sessionId;
    const reconnectionToken = room.reconnectionToken;
    const beforeAccount = authoritative.metaAccounts.get(departedSessionId);
    const beforeEscrow = structuredClone(beforeAccount.weaponBank.expedition);
    const beforeRunId = beforeEscrow?.runId;
    expect(beforeRunId).toMatch(/^run_/);
    expect(initialManifests.at(-1)?.runId).toBe(beforeRunId);

    let markReconnectWindowReady: () => void = () => {};
    const reconnectWindowReady = new Promise<void>((resolve) => {
      markReconnectWindowReady = resolve;
    });
    const allowReconnection = authoritative.allowReconnection.bind(authoritative);
    authoritative.allowReconnection = (...args: unknown[]) => {
      const reconnection = allowReconnection(...args);
      // Colyseus registers the token synchronously inside allowReconnection(). Waiting for this
      // boundary avoids racing the client's socket-close event against the server's onLeave hook.
      markReconnectWindowReady();
      return reconnection;
    };

    const transportLeave = new Promise<void>((resolve) => room.onLeave.once(() => resolve()));
    const socket = authoritative.clients.find(
      (candidate: { sessionId: string }) => candidate.sessionId === departedSessionId,
    )?.ref as { terminate?: () => void } | undefined;
    if (typeof socket?.terminate !== "function") {
      throw new Error("server transport did not expose a terminable WebSocket");
    }
    openRooms.delete(room);
    socket.terminate();
    await withTimeout(transportLeave, STATE_TIMEOUT_MS, "terminated socket close");
    await withTimeout(reconnectWindowReady, STATE_TIMEOUT_MS, "server reconnection window");

    // While the only player is seat-reserved, joinOrCreate must not admit a fresh session beside that
    // disconnected ghost. This is the exact refresh trap: the newcomer would be a non-host in the old run.
    const freshClient = new Client(endpoint);
    const freshRoom = await withTimeout(
      freshClient.joinOrCreate<ArenaState>(ROOM_NAME, {
        belt: false,
        beltLevel: "",
        dimensionId: "wild-west",
        bossRush: false,
      }),
      STATE_TIMEOUT_MS,
      "fresh matchmaking while old seat is reserved",
    );
    openRooms.add(freshRoom);
    expect(freshRoom.roomId).not.toBe(room.roomId);

    const recovered = await client.reconnect<ArenaState>(reconnectionToken);
    openRooms.add(recovered);

    expect(recovered.roomId).toBe(room.roomId);
    expect(recovered.sessionId).toBe(departedSessionId);
    const reconnectProbes: Array<{
      requestId?: unknown;
      ok?: unknown;
      reason?: unknown;
      roomId?: unknown;
      sessionId?: unknown;
      runId?: unknown;
      isHost?: unknown;
    }> = [];
    recovered.onMessage("reconnectProbeResult", (payload) => {
      reconnectProbes.push(payload);
    });
    recovered.send("reconnectProbe", { requestId: "integration-reconnect-probe" });
    await waitForValue(() => reconnectProbes.length === 1, "reconnect resumability probe");
    expect(reconnectProbes[0]).toEqual({
      requestId: "integration-reconnect-probe",
      ok: true,
      reason: "",
      roomId: room.roomId,
      sessionId: departedSessionId,
      runId: beforeRunId,
      isHost: true,
    });
    const recoveredManifests: Array<{ runId?: unknown }> = [];
    recovered.onMessage("weaponManifest", (payload: { runId?: unknown }) => {
      recoveredManifests.push(payload);
    });
    recovered.send("requestWeaponManifest");
    await waitForValue(
      () => typeof recoveredManifests.at(-1)?.runId === "string",
      "recovered weapon manifest",
    );
    await waitForState(
      recovered,
      (state) => {
        const player = state.players?.get(departedSessionId);
        return player?.x === preservedX && player?.y === preservedY && player?.hp === 73;
      },
      "recovered full state",
    );
    const afterAccount = authoritative.metaAccounts.get(departedSessionId);
    expect(afterAccount.weaponBank.expedition?.runId).toBe(beforeRunId);
    expect(recoveredManifests.at(-1)?.runId).toBe(beforeRunId);
    expect(afterAccount.weaponBank.expedition).toEqual(beforeEscrow);
    expect(authoritative.state.players.get(departedSessionId)).toMatchObject({
      hp: 73,
      x: preservedX,
      y: preservedY,
    });

    // Playability is part of recovery, not merely identity: the retained input runtime must acknowledge a
    // new command and advance the same authoritative body after the socket replacement.
    const resumedInputSeq = 91;
    const resumedMovement = waitForPatch(
      recovered,
      (state) => {
        const player = state.players?.get(departedSessionId);
        return (player?.ackSeq ?? 0) >= resumedInputSeq && (player?.x ?? 0) > preservedX;
      },
      "recovered movement acknowledgement",
    );
    recovered.send("input", { seq: resumedInputSeq, dx: 1, dy: 0, jump: false });
    await resumedMovement;

    const settlementReceipts: unknown[] = [];
    recovered.onMessage("weaponSettlementReceipt", (receipt) => {
      settlementReceipts.push(receipt);
    });
    authoritative.enterTerminalOutcome("victory");
    await waitForValue(() => settlementReceipts.length === 1, "single settlement receipt");
    authoritative.enterTerminalOutcome("victory");
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(settlementReceipts).toHaveLength(1);
    expect(afterAccount.weaponBank.expedition).toBeNull();
    expect(afterAccount.weaponBank.stash).toContainEqual(carried);

    const terminalProbes: typeof reconnectProbes = [];
    recovered.onMessage("reconnectProbeResult", (payload) => {
      if (payload.requestId === "integration-terminal-probe") terminalProbes.push(payload);
    });
    recovered.send("reconnectProbe", { requestId: "integration-terminal-probe" });
    await waitForValue(() => terminalProbes.length === 1, "terminal reconnect refusal probe");
    expect(terminalProbes[0]).toMatchObject({
      requestId: "integration-terminal-probe",
      ok: false,
      reason: "run-not-active",
      roomId: room.roomId,
      sessionId: departedSessionId,
      isHost: true,
    });

    // The solo host identity must survive too. Exercise the real host-gated T command after recovery and
    // terminal settlement; it must reactivate the room and install actual training targets.
    const trainingReady = waitForPatch(
      recovered,
      (state) => {
        let hasDummy = false;
        state.enemies?.forEach((enemy) => {
          if (enemy.kind === "dummy") hasDummy = true;
        });
        return state.mode === "training" && state.outcome === "active" && hasDummy;
      },
      "recovered host training toggle",
    );
    recovered.send("toggleTraining");
    await trainingReady;
  }, 45_000);
});
