import {
  EnemyState,
  meleeComboSelectionFor,
  PlayerAttackMoveMode,
  swingDescriptorFor,
  TILE_GROUND,
  WEAPONS,
} from "@dd/shared";
import { describe, expect, it, vi } from "vitest";

vi.mock("colyseus", () => {
  class Room {
    state: unknown;
    clients: { sessionId: string }[] = [];
    roomId = "b5-attackroot-test";
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
  room.state.enemies.clear();
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

function equip(player: AnyRoom, combat: AnyRoom, id: string) {
  const weapon = WEAPONS[id];
  if (!weapon) throw new Error(`Missing B5 fixture: ${id}`);
  player.weapon = id;
  combat.lastWeapon = id;
  return weapon;
}

function addEnemy(room: AnyRoom, id: string, x: number, y: number): EnemyState {
  const enemy = new EnemyState();
  enemy.id = id;
  enemy.kind = "dummy";
  enemy.x = x;
  enemy.y = y;
  enemy.hp = 10_000;
  room.state.enemies.set(id, enemy);
  return enemy;
}

describe("GameRoom — B5 attack-authored root movement", () => {
  it("keeps stationary attacks rooted, then applies the 25% active-frame input slow", () => {
    const { room, player, combat } = fixture("sparkknuckle");
    const weapon = equip(player, combat, "x2-sparkknuckle-hex-mitt");
    const combo = meleeComboSelectionFor(weapon);
    if (!combo) throw new Error("Missing Sparkknuckle combo fixture");
    const swing = swingDescriptorFor(weapon, weapon.cooldown);
    const start = { x: player.x, y: player.y };

    expect("forwardDrift" in (weapon.performance ?? {})).toBe(false);
    for (const step of combo.sequence) {
      room.resolveSwing(player, combat, weapon, swing, 0, undefined, step);
      expect({ x: player.x, y: player.y }).toEqual(start);
    }

    const control = fixture("sparkknuckle-control");
    equip(control.player, control.combat, weapon.id);
    const movingInput = room.inputs.get(player.id);
    const controlInput = control.room.inputs.get(control.player.id);
    movingInput.held.dx = 1;
    controlInput.held.dx = 1;
    room.stepSim(0.05);
    control.room.stepSim(0.05);
    expect(player.dualWield.attackMoveMode).toBe(PlayerAttackMoveMode.InputSlow);
    for (let tick = 1; tick < 4; tick++) {
      room.stepSim(0.05);
      control.room.stepSim(0.05);
    }
    expect(player.x).toBeGreaterThan(start.x);
    expect(player.x).toBeLessThan(control.player.x);
    expect(player.y).toBe(control.player.y);

    movingInput.held.dx = 0;
    movingInput.held.dy = 0;
    let stopTicks = 0;
    while (Math.hypot(player.mvx, player.mvy) > 0 && stopTicks < 4) {
      room.stepSim(0.05);
      stopTicks++;
    }
    expect(stopTicks).toBeLessThanOrEqual(3);
    expect({ mvx: player.mvx, mvy: player.mvy }).toEqual({ mvx: 0, mvy: 0 });
    const stopped = { x: player.x, y: player.y };

    let recoveryTicks = 0;
    while (
      player.dualWield.attackMoveMode !== PlayerAttackMoveMode.Normal &&
      recoveryTicks < 20
    ) {
      room.stepSim(0.05);
      recoveryTicks++;
    }
    expect(player.dualWield.attackMoveMode).toBe(PlayerAttackMoveMode.Normal);
    room.stepSim(0.05);
    expect({ x: player.x, y: player.y, mvx: player.mvx, mvy: player.mvy }).toEqual({
      ...stopped,
      mvx: 0,
      mvy: 0,
    });
  });

  it("plants Stormfists while preserving its former endpoint reach and quake", () => {
    const { room, player, combat } = fixture("stormfists");
    const weapon = equip(player, combat, "x2-thunderhead-stormfists");
    const swing = swingDescriptorFor(weapon, weapon.cooldown);
    const start = { x: player.x, y: player.y };
    const pathEnemy = addEnemy(room, "path", player.x + 100, player.y);
    const endpointEnemy = addEnemy(room, "endpoint", player.x + 560, player.y);
    room.rebuildEnemyGrid();
    const pathHp = pathEnemy.hp;
    const endpointHp = endpointEnemy.hp;
    const epoch = player.dualWield.serverMotionEpoch;

    room.resolveSwing(player, combat, weapon, swing);
    expect({ x: player.x, y: player.y }).toEqual(start);
    expect(player.dualWield.serverMotionEpoch).toBe(epoch);
    expect(weapon.range).toBe(680);
    expect(weapon.quake?.placementRange).toBe(480);
    expect(room.pendingQuakes[0]).toMatchObject({
      x: start.x + 480,
      y: start.y,
      radius: weapon.quake?.radius,
    });
    expect(room.meleeSwings.get(player.id)).toMatchObject({
      range: expect.any(Number),
      weaponId: weapon.id,
    });

    room.stepMeleeSwings(swing.activeEndSeconds + 0.001);
    expect(pathEnemy.hp).toBeLessThan(pathHp);
    expect(endpointEnemy.hp).toBeLessThan(endpointHp);
    expect({ x: player.x, y: player.y }).toEqual(start);
    room.damagePlayer(player, 9, "enemy");
    expect(player.hp).toBe(player.maxHp - 9);
  });
});
