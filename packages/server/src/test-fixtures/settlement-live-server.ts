import { matchMaker } from "colyseus";
import { createGameServer } from "../index.js";

interface ExtractCommand {
  readonly type: "extract";
  readonly roomId: string;
  readonly sessionId: string;
  readonly scrip: number;
}

function send(message: object): void {
  if (typeof process.send !== "function") throw new Error("live settlement worker requires IPC");
  process.send(message);
}

const server = await createGameServer(0);
const address = server.transport.server?.address();
if (!address || typeof address === "string") throw new Error("server did not expose a TCP port");
send({ type: "ready", pid: process.pid, port: address.port });

process.on("message", (message: unknown) => {
  if (
    typeof message !== "object" ||
    message === null ||
    (message as { type?: unknown }).type !== "extract"
  ) {
    return;
  }
  const command = message as ExtractCommand;
  // biome-ignore lint/suspicious/noExplicitAny: this fixture drives the real room's private extraction seam.
  const room = matchMaker.getLocalRoomById(command.roomId) as any;
  if (!room) throw new Error(`live settlement room not found: ${command.roomId}`);
  const player = room.state.players.get(command.sessionId);
  if (!player) throw new Error(`live settlement player not found: ${command.sessionId}`);
  player.scrip = command.scrip;
  room.completeRewardBoundary("extract");
  const account = room.metaAccounts.get(command.sessionId);
  send({
    type: "extracted",
    pid: process.pid,
    outcome: room.state.outcome,
    accountRevision: account?.revision,
    bankTotal: account?.scrip,
  });
});
