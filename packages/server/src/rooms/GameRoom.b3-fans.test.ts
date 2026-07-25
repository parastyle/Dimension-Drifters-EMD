import {
  CombatDelivery,
  DRIVE_CAPACITY,
  ENEMY_KINDS,
  EnemyState,
  TICK_MS,
  TILE_GROUND,
} from "@dd/shared";
import { describe, expect, it, vi } from "vitest";

vi.mock("colyseus", () => {
  class Room {
    state: unknown;
    clients: { sessionId: string }[] = [];
    roomId = "b3-fan-hybrids";
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

// biome-ignore lint/suspicious/noExplicitAny: focused authority proof reaches the accepted-beat seams.
type AnyRoom = any;

function makeRoom(id: string, weaponId: string) {
  const room = new GameRoom() as AnyRoom;
  room.onMessage = () => {};
  room.clients = [{ sessionId: id }];
  room.onCreate();
  room.onJoin({ sessionId: id });
  room.state.mode = "training";
  room.map.tiles.fill(TILE_GROUND);
  room.state.enemies.clear();
  const player = room.state.players.get(id);
  const combat = room.combat.get(id);
  player.weapon = weaponId;
  player.x = 1_500;
  player.y = 1_500;
  player.vx = 0;
  player.vy = 0;
  combat.aimX = 1;
  combat.aimY = 0;
  combat.targetX = 1_900;
  combat.targetY = 1_500;
  const enemy = new EnemyState();
  enemy.id = `${id}-planted`;
  enemy.kind = "dummy";
  enemy.hp = 10_000;
  enemy.x = player.x + 72;
  enemy.y = player.y;
  room.state.enemies.set(enemy.id, enemy);
  room.rebuildEnemyGrid();
  return {
    room,
    player,
    combat,
    enemy,
    acceptBeat() {
      combat.drive.valueF = DRIVE_CAPACITY;
      expect(room.resolveSingleWeaponAttack(player, combat)).toBe(true);
    },
    tick(times: number) {
      for (let index = 0; index < times; index++) room.update(TICK_MS);
    },
  };
}

function deliveriesFor(calls: unknown[][], enemyId: string, weaponId: string): number[] {
  return calls
    .filter((call) => call[1] === enemyId && call[6] === weaponId)
    .map((call) => call[7] as number);
}

const FAN_IDS = ["x2-iron-war-fan", "x2-ember-fan", "x2-storm-fan"] as const;

function launchTornado(h: ReturnType<typeof makeRoom>) {
  h.room.state.enemies.clear();
  h.room.rebuildEnemyGrid();
  h.acceptBeat();
  for (let tick = 0; tick < 12; tick++) {
    h.tick(1);
    const row = [...h.room.state.projectiles.values()].find(
      (projectile: { kind: string }) => projectile.kind === "fan:tornado",
    );
    if (row) return row;
  }
  throw new Error(`${h.player.weapon} did not launch its tornado`);
}

describe("GameRoom B22 authoritative fan tornadoes", () => {
  it.each(
    FAN_IDS,
  )("%s launches one moderate-range upright server projectile on every accepted swing", (weaponId) => {
    const h = makeRoom(`${weaponId}-owner`, weaponId);
    const fire = vi.spyOn(h.room, "fireProjectile");
    const projectile = launchTornado(h) as {
      id: string;
      kind: string;
      sourcePlayerId: string;
      sourceWeaponId: string;
      vx: number;
      vy: number;
    };
    const calls = fire.mock.calls.filter((call) => call[5] === "fan:tornado");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.[2]).toBe(520);
    expect(calls[0]?.[7]).toBeCloseTo(0.5, 8);
    expect(calls[0]?.[11]).toBe(h.player.id);
    expect(calls[0]?.[12]).toBe(weaponId);
    expect(calls[0]?.[13]).toBe(CombatDelivery.HybridProjectile);
    expect(calls[0]?.[19]).toBeUndefined();
    expect(calls[0]?.[20]).toEqual({
      shape: "capsule",
      radius: 24,
      halfLength: 14,
      orientation: "upright",
    });
    expect(projectile.sourcePlayerId).toBe(h.player.id);
    expect(projectile.sourceWeaponId).toBe(weaponId);
    expect(projectile.vx).toBeCloseTo(520, 8);
    expect(projectile.vy).toBeCloseTo(0, 8);
    expect(h.room.projectileMeta.get(projectile.id)?.damageEnvelope).toEqual(calls[0]?.[20]);
  });

  it.each(FAN_IDS)("%s freezes both facing directions into forward-only travel", (weaponId) => {
    const right = makeRoom(`${weaponId}-right`, weaponId);
    const rightProjectile = launchTornado(right) as { vx: number };
    expect(rightProjectile.vx).toBeGreaterThan(0);

    const left = makeRoom(`${weaponId}-left`, weaponId);
    left.combat.aimX = -1;
    left.combat.aimY = 0;
    left.combat.targetX = left.player.x - 400;
    left.combat.targetY = left.player.y;
    const leftProjectile = launchTornado(left) as { vx: number };
    expect(leftProjectile.vx).toBeLessThan(0);
  });

  it("moves damage with the 48x76 funnel and rejects contact beyond its visible vertical bound", () => {
    const run = (offsetFromVisibleBottom: number) => {
      const h = makeRoom(`storm-envelope-${offsetFromVisibleBottom}`, "x2-storm-fan");
      const damage = vi.spyOn(h.room, "damageEnemy");
      const projectile = launchTornado(h) as { x: number; y: number };
      const enemy = new EnemyState();
      enemy.id = `edge-${offsetFromVisibleBottom}`;
      enemy.kind = "dummy";
      enemy.hp = 10_000;
      enemy.x = projectile.x + 104;
      const enemyRadius = ENEMY_KINDS[enemy.kind]?.radius ?? 0;
      enemy.y = projectile.y + 38 + enemyRadius + offsetFromVisibleBottom;
      h.room.state.enemies.set(enemy.id, enemy);
      h.room.rebuildEnemyGrid();
      h.tick(8);
      return deliveriesFor(damage.mock.calls, enemy.id, h.player.weapon);
    };

    expect(run(-1)).toContain(CombatDelivery.HybridProjectile);
    expect(run(2)).not.toContain(CombatDelivery.HybridProjectile);
  });
});
