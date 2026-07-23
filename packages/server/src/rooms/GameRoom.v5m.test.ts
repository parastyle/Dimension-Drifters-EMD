import { EnemyState, swingDescriptorFor, TILE_GROUND, WEAPONS } from "@dd/shared";
import { describe, expect, it, vi } from "vitest";

vi.mock("colyseus", () => {
  class Room {
    state: unknown;
    clients: { sessionId: string }[] = [];
    roomId = "v5m-test";
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

// biome-ignore lint/suspicious/noExplicitAny: authority tests deliberately reach simulation seams.
type AnyRoom = any;

function makeRoom(id: string) {
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
  combat.targetX = 2_000;
  combat.targetY = 1_500;
  combat.aimX = 1;
  combat.aimY = 0;
  return { room, player, combat };
}

function equip(room: AnyRoom, player: AnyRoom, combat: AnyRoom, weaponId: string) {
  const weapon = WEAPONS[weaponId];
  if (!weapon) throw new Error(`Missing V5M fixture: ${weaponId}`);
  player.weapon = weapon.id;
  combat.lastWeapon = weapon.id;
  return weapon;
}

describe("GameRoom — V5M melee authority", () => {
  it("moves Frostfang only through its delayed server-validated authored lunge", () => {
    const { room, player, combat } = makeRoom("frostfang-lunge");
    const weapon = equip(room, player, combat, "x2-frostfang-rakes");
    const distance = weapon.performance?.lunge?.distancePx;
    if (!distance) throw new Error("Frostfang lunge fixture is required");
    const swing = swingDescriptorFor(weapon, weapon.cooldown);
    const startX = player.x;
    const startY = player.y;
    const validate = vi.spyOn(room, "navValidDest");

    room.resolveSwing(player, combat, weapon, swing);
    expect(player.x).toBe(startX);
    expect(room.pendingWeaponLunges.get(player.id)?.distancePx).toBe(64);

    room.stepPendingWeaponLunges(swing.activeStartSeconds + 0.01);

    expect(validate).toHaveBeenCalled();
    expect(Math.hypot(player.x - startX, player.y - startY)).toBeGreaterThan(0);
    expect(Math.hypot(player.x - startX, player.y - startY)).toBeLessThanOrEqual(distance + 1e-8);
  });

  it("damages targets around the complete Gravewarden whirlwind circle exactly once", () => {
    const { room, player, combat } = makeRoom("spade-circle");
    const weapon = equip(room, player, combat, "gravediggers-spade");
    const targets = [
      [100, 0],
      [0, 100],
      [-100, 0],
      [0, -100],
    ].map(([dx, dy], index) => {
      const enemy = new EnemyState();
      enemy.id = `spade-target-${index}`;
      enemy.kind = "critter";
      enemy.x = player.x + (dx ?? 0);
      enemy.y = player.y + (dy ?? 0);
      enemy.hp = 10_000;
      room.state.enemies.set(enemy.id, enemy);
      return enemy;
    });
    room.rebuildEnemyGrid();
    const swing = swingDescriptorFor(weapon, weapon.cooldown);
    const damageEnemy = vi.spyOn(room, "damageEnemy");

    room.resolveSwing(player, combat, weapon, swing);
    for (let elapsed = 0; elapsed < swing.poseSeconds + 0.1; elapsed += 0.05)
      room.stepMeleeSwings(0.05);

    for (const target of targets) {
      expect(target.hp).toBeLessThan(10_000);
      expect(damageEnemy.mock.calls.filter((call) => call[1] === target.id)).toHaveLength(1);
    }
    expect(weapon.swingArc).toBeCloseTo(Math.PI * 2, 10);
  });
});
