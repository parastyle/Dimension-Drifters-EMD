import {
  FRIENDLY_PROJECTILE_ENTITY_CAP,
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

  it("gives Calamity a classified heavy push without changing its camera-recoil field", () => {
    const { room, player, combat } = fixture("calamity-recoil");
    const weapon = equip(player, combat, "x2-calamity-howitzer");
    if (!weapon.gun) throw new Error("Calamity gun fixture is required");

    const epochBefore = player.dualWield.serverMotionEpoch;
    room.fireGun(player, combat, weapon);

    expect(weapon.recoil).toBe(233);
    expect(weapon.gun.recoil).toBe(0.004);
    expect("userKnockbackMultiplier" in weapon.gun).toBe(false);
    expect({ vx: player.vx, vy: player.vy }).toEqual({ vx: -233, vy: 0 });
    expect(player.dualWield.serverMotionEpoch).toBe(epochBefore + 1);
    expect(player.dualWield.serverMotionActive).toBe(true);
    expect(room.serverMotionSourceByPlayer.get(player.id)).toBe("weapon-fire-recoil");
  });
});
