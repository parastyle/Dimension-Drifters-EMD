import {
  EnemyState,
  meleeComboSelectionFor,
  swingDescriptorFor,
  TILE_GROUND,
  WEAPONS,
} from "@dd/shared";
import { describe, expect, it, vi } from "vitest";

vi.mock("colyseus", () => {
  class Room {
    state: unknown;
    clients: { sessionId: string }[] = [];
    roomId = "b8-pose-test";
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

// biome-ignore lint/suspicious/noExplicitAny: authority tests deliberately reach fixed-step seams.
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

function enemyAt(room: AnyRoom, id: string, x: number, y: number) {
  const enemy = new EnemyState();
  enemy.id = id;
  enemy.kind = "critter";
  enemy.x = x;
  enemy.y = y;
  enemy.hp = 10_000;
  room.state.enemies.set(id, enemy);
  return enemy;
}

function finishSwing(room: AnyRoom, seconds: number): void {
  for (let elapsed = 0; elapsed < seconds + 0.1; elapsed += 0.025)
    room.stepMeleeSwings(0.025);
}

describe("GameRoom B8 pose/combo authority", () => {
  it("applies exactly one Nullspike hit for each of its exactly three authoritative thrusts", () => {
    const { room, player, combat } = makeRoom("nullspike-three");
    const weapon = WEAPONS["x2-nullspike-pike"];
    if (!weapon) throw new Error("Missing Nullspike B8 fixture");
    const selection = meleeComboSelectionFor(weapon);
    if (!selection) throw new Error("Missing Nullspike B8 combo");
    const target = enemyAt(room, "nullspike-axis", player.x + 180, player.y);
    room.rebuildEnemyGrid();
    const damageEnemy = vi.spyOn(room, "damageEnemy");

    expect(weapon.authoritativeCombo).toBe(true);
    expect(selection.sequence).toHaveLength(3);
    for (const step of selection.sequence) {
      const swing = swingDescriptorFor(weapon, weapon.cooldown);
      room.resolveSwing(player, combat, weapon, swing, 0, undefined, step);
      finishSwing(room, swing.poseSeconds);
    }

    expect(damageEnemy.mock.calls.filter((call) => call[1] === target.id)).toHaveLength(3);
    expect(target.hp).toBeLessThan(10_000);
  });

  it("uses Voltedge's forward capsule instead of damaging through the old side-cut envelope", () => {
    const { room, player, combat } = makeRoom("voltedge-stab");
    const weapon = WEAPONS["x-sword-neon-katana"];
    if (!weapon) throw new Error("Missing Voltedge B8 fixture");
    const step = meleeComboSelectionFor(weapon)?.sequence[0];
    if (!step) throw new Error("Missing Voltedge B8 opening stab");
    const axis = enemyAt(room, "voltedge-axis", player.x + 100, player.y);
    const flank = enemyAt(room, "voltedge-flank", player.x + 65, player.y + 100);
    room.rebuildEnemyGrid();
    const damageEnemy = vi.spyOn(room, "damageEnemy");
    const swing = swingDescriptorFor(weapon, weapon.cooldown);

    expect(step.path).toMatchObject({ kind: "capsule", arcMultiplier: 0 });
    room.resolveSwing(player, combat, weapon, swing, 0, undefined, step);
    finishSwing(room, swing.poseSeconds);

    expect(damageEnemy.mock.calls.filter((call) => call[1] === axis.id)).toHaveLength(1);
    expect(damageEnemy.mock.calls.filter((call) => call[1] === flank.id)).toHaveLength(0);
  });
});
