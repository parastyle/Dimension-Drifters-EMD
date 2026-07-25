import { CORPORATE_ELEVATOR_PHASE, TILE_GROUND, TILE_PIT } from "@dd/shared";
import { describe, expect, it, vi } from "vitest";

const handlers = new Map<string, (client: { sessionId: string }, message: unknown) => void>();

vi.mock("colyseus", () => {
  class Room {
    state: unknown;
    clients: { sessionId: string }[] = [];
    roomId = "b42-relaxed-authority-test";
    setState(state: unknown): void {
      this.state = state;
    }
    onMessage(
      type: string,
      handler: (client: { sessionId: string }, message: unknown) => void,
    ): void {
      handlers.set(type, handler);
    }
    setSimulationInterval(): void {}
    setPatchRate(): void {}
    broadcast(): void {}
    broadcastPatch(): void {}
  }
  return { Room, Client: class {} };
});

const { GameRoom } = await import("./GameRoom.js");

// biome-ignore lint/suspicious/noExplicitAny: authority tests deliberately inspect private fixed-step state.
type AnyRoom = any;

function fixture(options?: Record<string, unknown>) {
  handlers.clear();
  const room = new GameRoom() as AnyRoom;
  const client = { sessionId: "mover" };
  room.clients = [client];
  room.onCreate(options);
  room.onJoin(client);
  room.map.pois.length = 0;
  room.map.tiles.fill(TILE_GROUND);
  room.state.enemies.clear();
  const player = room.state.players.get(client.sessionId);
  player.x = 1_500;
  player.y = 1_500;
  const combat = room.combat.get(client.sessionId);
  combat.lastGroundX = player.x;
  combat.lastGroundY = player.y;
  return { room, client, player, combat };
}

function report(player: AnyRoom, seq: number, extra: Record<string, unknown> = {}) {
  return {
    seq,
    dx: 0,
    dy: 0,
    clientX: player.x,
    clientY: player.y,
    clientMvx: 0,
    clientMvy: 0,
    clientVx: 0,
    clientVy: 0,
    clientServerMotionEpoch: player.dualWield.serverMotionEpoch,
    clientCorrectionSeq: player.dualWield.movementCorrectionSeq,
    ...extra,
  };
}

function send(room: AnyRoom, client: { sessionId: string }, payload: unknown): void {
  const handler = handlers.get("input");
  if (!handler) throw new Error("input handler missing");
  handler(client, payload);
  room.stepSim(0.05);
}

describe("GameRoom B42 relaxed self-movement authority", () => {
  it("adopts a plausible client pose and rejects speed, continuity, and pit violations", () => {
    const { room, client, player } = fixture();
    send(room, client, report(player, 1, { clientX: 1_516, clientMvx: 320 }));
    expect(player.x).toBe(1_516);
    expect(player.dualWield.movementCorrectionSeq).toBe(0);

    send(room, client, report(player, 2, { clientX: 1_534, clientMvx: 900 }));
    expect(player.x).not.toBe(1_534);
    expect(player.dualWield.movementCorrectionSeq).toBe(1);

    send(
      room,
      client,
      report(player, 3, {
        clientX: player.x + 60,
        clientMvx: 320,
        clientCorrectionSeq: 1,
      }),
    );
    expect(player.dualWield.movementCorrectionSeq).toBe(2);

    const startX = Math.floor(player.x / room.map.tileSize) * room.map.tileSize + 72;
    player.x = startX;
    player.mvx = 0;
    room.inputs.get(player.id).mvx = 0;
    const targetX = startX + 16;
    const tileX = Math.floor(targetX / room.map.tileSize);
    const tileY = Math.floor(player.y / room.map.tileSize);
    room.map.tiles[tileY * room.map.cols + tileX] = TILE_PIT;
    send(
      room,
      client,
      report(player, 4, {
        clientX: targetX,
        clientMvx: 320,
        clientCorrectionSeq: 2,
      }),
    );
    expect(player.x).toBe(startX);
    expect(player.dualWield.movementCorrectionSeq).toBe(3);
  });

  it("rejects non-finite/out-of-world reports without corrupting schema state", () => {
    const { room, client, player } = fixture();
    send(room, client, report(player, 1, { clientX: Number.NaN }));
    expect(Number.isFinite(player.x)).toBe(true);
    expect(player.dualWield.movementCorrectionSeq).toBe(1);
    send(
      room,
      client,
      report(player, 2, {
        clientX: -100,
        clientCorrectionSeq: 1,
      }),
    );
    expect(player.x).toBeGreaterThanOrEqual(24);
    expect(player.dualWield.movementCorrectionSeq).toBe(2);
  });

  it("server-motion epochs ignore matching and stale client reports until the owner observes release", () => {
    const { room, client, player } = fixture();
    room.beginServerMotion(player, 2);
    const epoch = player.dualWield.serverMotionEpoch;
    const startX = player.x;
    send(
      room,
      client,
      report(player, 1, {
        clientX: startX + 16,
        clientMvx: 320,
        clientServerMotionEpoch: epoch,
      }),
    );
    expect(player.dualWield.serverMotionActive).toBe(true);
    expect(player.x).toBe(startX);

    send(
      room,
      client,
      report(player, 2, {
        clientX: startX + 16,
        clientMvx: 320,
        clientServerMotionEpoch: epoch - 1,
      }),
    );
    expect(player.dualWield.serverMotionActive).toBe(false);
    expect(player.x).toBe(startX);
    expect(player.dualWield.movementCorrectionSeq).toBe(0);

    send(
      room,
      client,
      report(player, 3, {
        clientX: startX + 16,
        clientMvx: 320,
        clientServerMotionEpoch: epoch,
      }),
    );
    expect(player.x).toBe(startX + 16);
  });

  it("flags parry slides as server-owned placement epochs", () => {
    const { room, player, combat } = fixture();
    const before = { x: player.x, epoch: player.dualWield.serverMotionEpoch };
    room.applySideParrySlide(player, combat, 1, 0, 20);
    expect(player.x).toBeGreaterThan(before.x);
    expect(player.dualWield.serverMotionActive).toBe(true);
    expect(player.dualWield.serverMotionEpoch).toBe(before.epoch + 1);
  });

  it("holds elevator departure and arrival inside one server-motion epoch", () => {
    const { room, player } = fixture({ belt: true, beltLevel: "corporate-grid" });
    room.state.elevatorPhase = CORPORATE_ELEVATOR_PHASE.departing;
    room.state.elevatorDeadlineTick = room.state.tick + 4;
    room.positionCorporateParty(true, true);
    const epoch = player.dualWield.serverMotionEpoch;
    const firstTeleport = player.teleportSeq;
    expect(player.dualWield.serverMotionActive).toBe(true);

    room.state.tick++;
    room.positionCorporateParty(true, false);
    expect(player.dualWield.serverMotionEpoch).toBe(epoch);
    expect(player.teleportSeq).toBe(firstTeleport);

    room.transitionCorporateFloor();
    expect(player.dualWield.serverMotionEpoch).toBe(epoch);
    expect(player.teleportSeq).toBe(firstTeleport + 1);
    expect(player.dualWield.serverMotionActive).toBe(true);
  });
});
