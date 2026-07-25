import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { DEFAULT_PORT, ROOM_NAME } from "@dd/shared";
import { Server } from "colyseus";
import { serverDevToolsEnabled } from "./dev-tools.js";
import { GameRoom } from "./rooms/GameRoom.js";

/** Build and start the real Colyseus transport so production and integration tests share one setup path. */
export async function createGameServer(port: number): Promise<Server> {
  const gameServer = new Server({
    transport: new WebSocketTransport(),
  });

  // §39 MATCHMAKING: joinOrCreate must only match rooms created with the SAME mode/level — without filterBy it
  // joined ANY live room, so picking Frost Chasm while another tab held a Sky Carrier (or top-down) room joined
  // THAT room: the client drew the picked level, the server simulated a different one (black screen / wrong
  // roster), and the non-host's dev/boss messages were dropped. Same-option picks still share a room (co-op).
  gameServer.define(ROOM_NAME, GameRoom).filterBy(["belt", "beltLevel", "dimensionId", "bossRush"]);

  await gameServer.listen(port);
  const address = gameServer.transport.server?.address();
  const boundPort = typeof address === "object" && address ? address.port : port;
  console.log(`[dd-server] listening on ws://localhost:${boundPort}`);
  console.log(`[dd-server] debug authority: ${serverDevToolsEnabled() ? "enabled" : "disabled"}`);
  return gameServer;
}

export async function startGameServer(): Promise<Server> {
  // DD_PORT lets an interactive session hold a private port while e2e harnesses use DEFAULT_PORT.
  const envPort = Number(process.env.DD_PORT);
  return createGameServer(Number.isInteger(envPort) && envPort > 0 ? envPort : DEFAULT_PORT);
}

const entryPath = process.argv[1];
if (entryPath && resolve(entryPath) === fileURLToPath(import.meta.url)) {
  startGameServer().catch((err: unknown) => {
    console.error("[dd-server] failed to start:", err);
    process.exit(1);
  });
}
