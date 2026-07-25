import { EnemyState, swingDescriptorFor, TILE_GROUND, WEAPONS } from "@dd/shared";
import { describe, expect, it, vi } from "vitest";

vi.mock("colyseus", () => {
  class Room {
    state: unknown;
    clients: { sessionId: string }[] = [];
    roomId = "b28-weapon-orders-test";
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

// biome-ignore lint/suspicious/noExplicitAny: authority tests deliberately inspect private simulation seams.
type AnyRoom = any;

describe("GameRoom — B28 Venomtongue lunge authority", () => {
  it("nav-validates the full 128 px lunge and releases its hit from the visible endpoint", () => {
    const room = new GameRoom() as AnyRoom;
    room.onMessage = () => {};
    room.clients = [{ sessionId: "b28-venomtongue" }];
    room.onCreate();
    room.onJoin({ sessionId: "b28-venomtongue" });
    room.map.tiles.fill(TILE_GROUND);
    room.state.enemies.clear();

    const player = room.state.players.get("b28-venomtongue");
    const combat = room.combat.get(player.id);
    const weapon = WEAPONS["x2-venomtongue-trident"];
    if (!weapon) throw new Error("Missing Venomtongue fixture");
    player.weapon = weapon.id;
    player.x = 1_500;
    player.y = 1_500;
    combat.lastWeapon = weapon.id;
    combat.targetX = 2_000;
    combat.targetY = player.y;
    combat.aimX = 1;
    combat.aimY = 0;

    const start = { x: player.x, y: player.y };
    const endpointX = player.x + 128;
    const target = new EnemyState();
    target.id = "b28-venomtongue-endpoint";
    target.kind = "dummy";
    target.x = endpointX + 100;
    target.y = player.y;
    target.hp = 10_000;
    room.state.enemies.set(target.id, target);
    room.rebuildEnemyGrid();

    const swing = swingDescriptorFor(weapon, weapon.cooldown);
    room.resolveSwing(player, combat, weapon, swing);
    expect(weapon.range).toBe(323);
    expect({ x: player.x, y: player.y }).toEqual(start);
    room.stepMeleeSwings(swing.activeEndSeconds + 0.001);
    expect(target.hp).toBeLessThan(10_000);
    expect({ x: player.x, y: player.y }).toEqual(start);
  });
});
