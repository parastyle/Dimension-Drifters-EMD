import {
  IMPULSE_MAX,
  SERVER_MOTION_IMPULSE_TICKS,
  TILE_GROUND,
  TILE_PIT,
  UltimateFamily,
  ultimateCodeFor,
} from "@dd/shared";
import { describe, expect, it, vi } from "vitest";
import type { ServerMotionSource } from "./room/room-progression.js";

const handlers = new Map<string, (client: { sessionId: string }, message: unknown) => void>();

vi.mock("colyseus", () => {
  class Room {
    state: unknown;
    clients: { sessionId: string }[] = [];
    roomId = "diag-rb-authority-test";
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

// biome-ignore lint/suspicious/noExplicitAny: diagnostic authority tests inspect private fixed-step seams.
type AnyRoom = any;

function fixture(belt = false) {
  handlers.clear();
  const room = new GameRoom() as AnyRoom;
  const client = { sessionId: "audit-player" };
  room.clients = [client];
  room.onCreate(belt ? { belt: true, beltLevel: "corporate-grid" } : undefined);
  room.onJoin(client);
  room.map.tiles.fill(TILE_GROUND);
  room.spawnAccum = -1_000_000;
  room.shifterCd = 1_000_000;
  room.state.enemies.clear();
  const player = room.state.players.get(client.sessionId);
  const combat = room.combat.get(client.sessionId);
  player.x = 1_500;
  player.y = belt ? 1_320 : 1_500;
  player.mvx = 0;
  player.mvy = 0;
  player.vx = 0;
  player.vy = 0;
  combat.lastGroundX = player.x;
  combat.lastGroundY = player.y;
  return { room, client, player, combat };
}

function captureFirstRegistration(
  room: AnyRoom,
  wanted: ServerMotionSource,
): () => { x: number; y: number } | undefined {
  let captured: { x: number; y: number } | undefined;
  const original = room.beginServerMotion.bind(room);
  room.beginServerMotion = (player: AnyRoom, ticks: number, source: ServerMotionSource): void => {
    if (source === wanted && !captured) captured = { x: player.x, y: player.y };
    original(player, ticks, source);
  };
  return () => captured;
}

function unownedImpulseDisplacement(source: ServerMotionSource): number {
  const { room, player } = fixture();
  player.vx = IMPULSE_MAX;
  room.beginServerMotion(player, SERVER_MOTION_IMPULSE_TICKS, source);
  let displacement = 0;
  for (let tick = 0; tick < SERVER_MOTION_IMPULSE_TICKS; tick++) {
    const beforeX = player.x;
    room.stepSim(0.05);
    if (!player.dualWield.serverMotionActive) displacement += Math.abs(player.x - beforeX);
  }
  return displacement;
}

describe("B51 server-motion impulse ownership", () => {
  it.each([
    "enemy-contact-hit",
    "enemy-commit-hit",
    "hostile-projectile-hit",
    "weapon-fire-recoil",
  ] as const)("%s owns every displacement tick of a capped composite impulse", (source) => {
    expect(unownedImpulseDisplacement(source)).toBe(0);
  });
});

describe("B51 placement registers authority before position mutation", () => {
  it("pit-snapback registers before the safe-ground assignment", () => {
    const { room, player, combat } = fixture();
    const tileSize = room.map.tileSize;
    const pitTileX = Math.floor(player.x / tileSize);
    const tileY = Math.floor(player.y / tileSize);
    player.x = pitTileX * tileSize + tileSize / 2;
    player.y = tileY * tileSize + tileSize / 2;
    const overPit = { x: player.x, y: player.y };
    combat.lastGroundX = player.x - tileSize;
    combat.lastGroundY = player.y;
    room.map.tiles[tileY * room.map.cols + pitTileX] = TILE_PIT;
    const captured = captureFirstRegistration(room, "pit-snapback");

    room.stepSim(0.05);

    expect(captured()).toEqual(overPit);
  });

  it("elevator-boarding registers before the car-position assignment", () => {
    const { room, player } = fixture(true);
    const before = { x: player.x, y: player.y };
    room.state.elevatorDeadlineTick = room.state.tick + 4;
    const captured = captureFirstRegistration(room, "elevator-boarding");

    room.positionCorporateParty(true, true);

    expect(captured()).toEqual(before);
  });

  it("teleport-placement registers before the Testing Grounds assignment", () => {
    const { room, player } = fixture();
    const before = { x: player.x, y: player.y };
    const captured = captureFirstRegistration(room, "teleport-placement");

    room.toggleTraining();

    expect(captured()).toEqual(before);
  });

  it("Dimension Door registers ultimate authority before its blink assignment", () => {
    const { room, player, combat } = fixture();
    const before = { x: player.x, y: player.y };
    const target = { x: player.x + 400, y: player.y + 100 };
    player.ultArchetype = ultimateCodeFor(UltimateFamily.DimensionDoor, "dex");
    player.ultVariant = "dex";
    player.ultTargetX = target.x;
    player.ultTargetY = target.y;
    const captured = captureFirstRegistration(room, "ultimate");

    room.beginUltimate(player, combat, {
      family: UltimateFamily.DimensionDoor,
      variant: "dex",
      startX: before.x,
      startY: before.y,
      dirX: 1,
      dirY: 0,
      activeEndTick: room.state.tick + 1,
      teleportSeqAtAccept: player.teleportSeq,
      targets: [],
      hitIndex: 0,
      nextHitTick: room.state.tick,
      hit: new Set<string>(),
      impactDone: false,
      sourceKey: "diag:dimension-door",
    });

    expect(captured()).toEqual(before);
  });
});

describe("B51 interaction controls", () => {
  it("rapid recoil extends one epoch instead of minting an epoch per shot", () => {
    const { room, player } = fixture();
    room.applyWeaponFireRecoil(player, 1, 0, 13);
    const epoch = player.dualWield.serverMotionEpoch;
    const firstUntil = room.serverMotionUntilTick.get(player.id);
    room.stepSim(0.05);

    room.applyWeaponFireRecoil(player, 1, 0, 13);

    expect(player.dualWield.serverMotionEpoch).toBe(epoch);
    expect(room.serverMotionUntilTick.get(player.id)).toBeGreaterThan(firstUntil);
  });

  it("recoil during a dodge keeps one epoch and extends ownership to the recoil tail", () => {
    const { room, player, combat } = fixture();
    const input = room.inputs.get(player.id);
    room.consumeMoveStanceInput(player, input, combat, {
      ...input.held,
      seq: 1,
      dx: 1,
      slide: true,
    });
    const epoch = player.dualWield.serverMotionEpoch;

    room.applyWeaponFireRecoil(player, 1, 0, 233);

    expect(player.dualWield.serverMotionEpoch).toBe(epoch);
    expect(room.serverMotionSourceByPlayer.get(player.id)).toBe("weapon-fire-recoil");
    expect(room.serverMotionUntilTick.get(player.id)).toBe(
      room.state.tick + SERVER_MOTION_IMPULSE_TICKS,
    );
  });

  it("a parry slide during recoil cannot shorten the recoil ownership window", () => {
    const { room, player, combat } = fixture();
    room.applyWeaponFireRecoil(player, 1, 0, 233);
    const epoch = player.dualWield.serverMotionEpoch;
    const recoilUntil = room.serverMotionUntilTick.get(player.id);

    room.applySideParrySlide(player, combat, 1, 0, 30);

    expect(player.dualWield.serverMotionEpoch).toBe(epoch);
    expect(room.serverMotionSourceByPlayer.get(player.id)).toBe("parry-slide");
    expect(room.serverMotionUntilTick.get(player.id)).toBe(recoilUntil);
  });
});
