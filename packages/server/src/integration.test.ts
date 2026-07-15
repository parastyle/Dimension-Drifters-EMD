import { createRequire } from "node:module";
import { type ArenaState, ROOM_NAME } from "@dd/shared";
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

const STATE_TIMEOUT_MS = 5_000;

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
});
