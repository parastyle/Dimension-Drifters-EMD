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
  it("keeps Frostfang planted while preserving its former lunge reach", () => {
    const { room, player, combat } = makeRoom("frostfang-lunge");
    const weapon = equip(room, player, combat, "x2-frostfang-rakes");
    const swing = swingDescriptorFor(weapon, weapon.cooldown);
    const start = { x: player.x, y: player.y };
    const target = new EnemyState();
    target.id = "frostfang-reach";
    target.kind = "critter";
    target.x = player.x + 160;
    target.y = player.y;
    target.hp = 10_000;
    room.state.enemies.set(target.id, target);
    room.rebuildEnemyGrid();

    room.resolveSwing(player, combat, weapon, swing);
    room.stepMeleeSwings(swing.activeEndSeconds + 0.001);

    expect(weapon.range).toBe(172);
    expect({ x: player.x, y: player.y }).toEqual(start);
    expect(target.hp).toBeLessThan(10_000);
  });

  it("damages every target once per visible Gravewarden revolution", () => {
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
      const calls = damageEnemy.mock.calls.filter((call) => call[1] === target.id);
      expect(calls).toHaveLength(3);
      expect(calls.reduce((total, call) => total + Number(call[2]), 0)).toBeCloseTo(8, 10);
    }
    const receipts = [...room.state.combatReceipts].filter(
      (row) => row.seq > 0 && row.weaponId === weapon.id,
    );
    expect(receipts).toHaveLength(targets.length * 3);
    expect(receipts.every((row) => row.damage > 0)).toBe(true);
    expect(weapon.swingArc).toBeCloseTo(Math.PI * 6, 10);
    expect(weapon.performance?.twirl?.visualRevolutions).toBe(3);
    expect(weapon.performance?.twirl?.cadenceSeconds).toBeCloseTo(0.6, 10);
  });

  it("keeps Doubleheader's held whirlwind planted with one receipt per visual revolution", () => {
    const { room, player, combat } = makeRoom("doubleheader-whirlwind");
    const weapon = equip(room, player, combat, "x2-brimstone-doubleheader");
    const start = { x: player.x, y: player.y };
    const target = new EnemyState();
    target.id = "doubleheader-target";
    target.kind = "critter";
    target.x = player.x + 72;
    target.y = player.y;
    target.hp = 10_000;
    room.state.enemies.set(target.id, target);
    room.rebuildEnemyGrid();
    const swing = swingDescriptorFor(weapon, weapon.cooldown);
    const damageEnemy = vi.spyOn(room, "damageEnemy");

    room.resolveSwing(player, combat, weapon, swing);
    for (let elapsed = 0; elapsed < swing.poseSeconds + 0.1; elapsed += 0.05)
      room.stepMeleeSwings(0.05);

    const calls = damageEnemy.mock.calls.filter((call) => call[1] === target.id);
    const receipts = [...room.state.combatReceipts].filter(
      (row) => row.seq > 0 && row.weaponId === weapon.id && row.targetId === target.id,
    );
    expect(calls).toHaveLength(1);
    expect(receipts).toHaveLength(1);
    expect(receipts[0]?.damage).toBeCloseTo(weapon.damage, 10);
    expect({ x: player.x, y: player.y }).toEqual(start);
    expect(weapon.swingArc).toBeCloseTo(Math.PI * 2, 10);
    expect(weapon.performance?.twirl?.visualRevolutions).toBe(1);
  });
});
