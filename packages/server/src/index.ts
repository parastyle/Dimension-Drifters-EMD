import { WebSocketTransport } from "@colyseus/ws-transport";
import { DEFAULT_PORT, ROOM_NAME } from "@dd/shared";
import { Server } from "colyseus";
import { GameRoom } from "./rooms/GameRoom.js";

const gameServer = new Server({
  transport: new WebSocketTransport(),
});

gameServer.define(ROOM_NAME, GameRoom);

gameServer
  .listen(DEFAULT_PORT)
  .then(() => console.log(`[dd-server] listening on ws://localhost:${DEFAULT_PORT}`))
  .catch((err: unknown) => {
    console.error("[dd-server] failed to start:", err);
    process.exit(1);
  });
