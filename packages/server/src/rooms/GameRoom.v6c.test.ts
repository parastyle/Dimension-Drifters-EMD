import {
  FRIENDLY_PROJECTILE_ENTITY_CAP,
  GUN_RECOIL_BASELINE,
  GUN_RECOIL_IMPULSE,
  TILE_GROUND,
  WEAPONS,
} from "@dd/shared";
import { describe, expect, it, vi } from "vitest";

vi.mock("colyseus", () => {
  class Room {
    state: unknown;
    clients: { sessionId: string }[] = [];
    roomId = "v6c-test";
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

// biome-ignore lint/suspicious/noExplicitAny: authority tests deliberately reach private simulation seams.
type AnyRoom = any;

function fixture(id: string) {
  const room = new GameRoom() as AnyRoom;
  room.onMessage = () => {};
  room.clients = [{ sessionId: id }];
  room.onCreate();
  room.onJoin({ sessionId: id });
  room.map.pois.length = 0;
  room.map.tiles.fill(TILE_GROUND);
  const player = room.state.players.get(id);
  const combat = room.combat.get(id);
  player.x = 1_500;
  player.y = 1_500;
  player.vx = 0;
  player.vy = 0;
  combat.targetX = 2_000;
  combat.targetY = 1_500;
  combat.aimX = 1;
  combat.aimY = 0;
  return { room, player, combat };
}

function equip(player: AnyRoom, combat: AnyRoom, id: string) {
  const weapon = WEAPONS[id];
  if (!weapon) throw new Error(`Missing V6C fixture: ${id}`);
  player.weapon = id;
  combat.lastWeapon = id;
  return weapon;
}

describe("GameRoom — V6C caster/ranged authority", () => {
  it("admits Glyphward's ten-feather volleys under the global friendly entity cap", () => {
    const { room, player, combat } = fixture("glyphward-cap");
    const weapon = equip(player, combat, "x2-glyphward-manuscript");
    if (!weapon.scatter) throw new Error("Glyphward scatter fixture is required");

    for (let volley = 0; volley < 20; volley++) room.fireScatter(player, combat, weapon);

    expect(weapon.scatter.count).toBe(10);
    expect(room.state.projectiles.size).toBe(FRIENDLY_PROJECTILE_ENTITY_CAP);
    for (const projectile of room.state.projectiles.values()) {
      expect(projectile.sourceWeaponId).toBe(weapon.id);
      expect(projectile.kind).toBe("magma:holy");
    }
  });

  it("doubles Calamity's server displacement without changing its camera-recoil field", () => {
    const { room, player, combat } = fixture("calamity-recoil");
    const weapon = equip(player, combat, "x2-calamity-howitzer");
    if (!weapon.gun) throw new Error("Calamity gun fixture is required");

    room.fireGun(player, combat, weapon);

    const oldKick =
      GUN_RECOIL_IMPULSE * (weapon.gun.recoil ?? GUN_RECOIL_BASELINE) / GUN_RECOIL_BASELINE;
    expect(weapon.gun.recoil).toBe(0.004);
    expect(weapon.gun.userKnockbackMultiplier).toBe(2);
    expect(player.vx).toBeCloseTo(-oldKick * 2, 8);
    expect(player.vy).toBeCloseTo(0, 8);
  });
});
