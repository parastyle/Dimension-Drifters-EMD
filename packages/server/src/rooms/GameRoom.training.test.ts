import type { PickupState } from "@dd/shared";
import { describe, expect, it, vi } from "vitest";

vi.mock("colyseus", () => {
  class Room {
    state: unknown;
    clients: { sessionId: string }[] = [];
    roomId = "test";
    setState(state: unknown): void {
      this.state = state;
    }
    onMessage(): void {}
    setSimulationInterval(): void {}
    setPatchRate(): void {}
    broadcast(): void {}
    broadcastPatch(): void {}
  }
  return { Room, Client: class {} };
});

const { GameRoom } = await import("./GameRoom.js");

type TestClient = { sessionId: string };
type Handler = (client: TestClient, message?: unknown) => void;
// biome-ignore lint/suspicious/noExplicitAny: the focused harness replaces Colyseus registration internals.
type AnyRoom = any;

function makeRoom() {
  const room = new GameRoom() as AnyRoom;
  const handlers = new Map<string, Handler>();
  room.onMessage = (type: string, handler: Handler) => {
    handlers.set(type, handler);
  };
  room.clients = [];
  room.roomId = "test";
  room.onCreate();
  return {
    room,
    join(sessionId: string): void {
      const client = { sessionId };
      room.clients.push(client);
      room.onJoin(client);
    },
    send(sessionId: string, type: string, message?: unknown): void {
      handlers.get(type)?.({ sessionId }, message);
    },
  };
}

// v0.118 Testing-Grounds owner regression — focused simulation of the page-rebuild/grab race.
describe("GameRoom — Testing-Grounds gallery grab identity", () => {
  it("equips the exact current gallery pickup named by the client", () => {
    const harness = makeRoom();
    harness.join("gallery-current");
    harness.send("gallery-current", "toggleTraining");

    const player = harness.room.state.players.get("gallery-current");
    const shown = [...harness.room.state.pickups.values()].find((pickup: PickupState) =>
      pickup.id.startsWith("pk:"),
    );
    if (!player || !shown) throw new Error("training gallery did not spawn beside a player");
    player.x = shown.x;
    player.y = shown.y;

    harness.send("gallery-current", "grabWeapon", { pickupId: shown.id });
    expect(player.weapon).toBe(shown.weapon);
  });

  it("rejects a stale gallery pickup id after a page rebuild instead of grabbing its replacement", () => {
    const harness = makeRoom();
    harness.join("gallery-grabber");
    harness.send("gallery-grabber", "toggleTraining");

    const player = harness.room.state.players.get("gallery-grabber");
    const shown = [...harness.room.state.pickups.values()].find((pickup) =>
      pickup.id.startsWith("pk"),
    );
    if (!player || !shown) throw new Error("training gallery did not spawn beside a player");
    const pressed = { pickupId: shown.id };
    const shownWeapon = shown.weapon;
    const heldBefore = player.weapon;
    player.x = shown.x;
    player.y = shown.y;

    harness.send("gallery-grabber", "galleryPage", { dir: 1 });
    const replacement = [...harness.room.state.pickups.values()].find(
      (pickup: PickupState) => pickup.x === shown.x && pickup.y === shown.y,
    );
    if (!replacement) throw new Error("gallery page did not rebuild the pressed cell");
    expect(replacement.weapon).not.toBe(shownWeapon);

    harness.send("gallery-grabber", "grabWeapon", pressed);
    expect(player.weapon).toBe(heldBefore);
    expect(player.weapon).not.toBe(replacement.weapon);
  });
});
