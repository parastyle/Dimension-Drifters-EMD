import { WebSocketTransport } from "@colyseus/ws-transport";
import { DEFAULT_PORT, ROOM_NAME } from "@dd/shared";
import { Server } from "colyseus";
import { GameRoom } from "./rooms/GameRoom.js";

const gameServer = new Server({
  transport: new WebSocketTransport(),
});

// §39 MATCHMAKING: joinOrCreate must only match rooms created with the SAME mode/level — without filterBy it
// joined ANY live room, so picking Frost Chasm while another tab held a Sky Carrier (or top-down) room joined
// THAT room: the client drew the picked level, the server simulated a different one (black screen / wrong
// roster), and the non-host's dev/boss messages were dropped. Same-option picks still share a room (co-op).
gameServer.define(ROOM_NAME, GameRoom).filterBy(["belt", "beltLevel", "dimensionId", "bossRush"]);

gameServer
  .listen(DEFAULT_PORT)
  .then(() => console.log(`[dd-server] listening on ws://localhost:${DEFAULT_PORT}`))
  .catch((err: unknown) => {
    console.error("[dd-server] failed to start:", err);
    process.exit(1);
  });
