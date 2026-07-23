import {
  CombatDelivery,
  DRIVE_CAPACITY,
  EnemyState,
  TICK_MS,
  TILE_GROUND,
  WEAPONS,
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
  room.map.pois.length = 0;
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
      expect(room.resolveHandAttack(player, combat, 0)).toBe(true);
    },
    tick(times: number) {
      for (let index = 0; index < times; index++) room.update(TICK_MS);
    },
  };
}

function deliveriesFor(
  calls: unknown[][],
  enemyId: string,
  weaponId: string,
): number[] {
  return calls
    .filter((call) => call[1] === enemyId && call[6] === weaponId)
    .map((call) => call[7] as number);
}

describe("GameRoom B3 authoritative fan hybrids", () => {
  it("lands Iron's first two melee cuts, then orders the third melee hit before its finisher gust", () => {
    const h = makeRoom("iron-fan-owner", "x2-iron-war-fan");
    const damage = vi.spyOn(h.room, "damageEnemy");
    const fire = vi.spyOn(h.room, "fireProjectile");
    for (let beat = 0; beat < 3; beat++) {
      const damageStart = damage.mock.calls.length;
      const fireStart = fire.mock.calls.length;
      h.acceptBeat();
      h.tick(16);
      const deliveries = deliveriesFor(
        damage.mock.calls.slice(damageStart),
        h.enemy.id,
        h.player.weapon,
      );
      expect(deliveries, `beat ${beat + 1} melee`).toContain(CombatDelivery.Melee);
      if (beat < 2) {
        expect(deliveries, `beat ${beat + 1} no projectile`).not.toContain(
          CombatDelivery.HybridProjectile,
        );
        expect(fire.mock.calls.slice(fireStart)).toHaveLength(0);
      } else {
        expect(deliveries).toContain(CombatDelivery.HybridProjectile);
        expect(deliveries.indexOf(CombatDelivery.Melee)).toBeLessThan(
          deliveries.indexOf(CombatDelivery.HybridProjectile),
        );
        expect(fire.mock.calls.slice(fireStart)).toHaveLength(1);
        expect(fire.mock.calls.at(-1)?.[5]).toBe("fan:cutting-gust");
      }
    }
  });

  it("lands Ember melee and three separately authoritative cone shards in one accepted sweep", () => {
    const h = makeRoom("ember-fan-owner", "x2-ember-fan");
    const damage = vi.spyOn(h.room, "damageEnemy");
    const fire = vi.spyOn(h.room, "fireProjectile");
    h.acceptBeat();
    h.tick(16);
    const deliveries = deliveriesFor(damage.mock.calls, h.enemy.id, h.player.weapon);
    expect(deliveries).toContain(CombatDelivery.Melee);
    expect(deliveries).toContain(CombatDelivery.HybridProjectile);
    expect(deliveries.indexOf(CombatDelivery.Melee)).toBeLessThan(
      deliveries.indexOf(CombatDelivery.HybridProjectile),
    );
    const shards = fire.mock.calls.filter((call) => call[5] === "fan:cinder-blade-cone");
    expect(shards).toHaveLength(3);
    expect(
      new Set(
        shards.map((call) =>
          Number((call[1] as { y?: number } | undefined)?.y).toFixed(3),
        ),
      ).size,
    ).toBe(3);
    expect(shards.every((call) => call[11] === h.player.id)).toBe(true);
    expect(shards.every((call) => call[13] === CombatDelivery.HybridProjectile)).toBe(true);
  });

  it("lands Storm melee, damages with the arc, reverses at 300ms, and re-arms toward its owner", () => {
    const h = makeRoom("storm-fan-owner", "x2-storm-fan");
    const damage = vi.spyOn(h.room, "damageEnemy");
    const fire = vi.spyOn(h.room, "fireProjectile");
    h.acceptBeat();
    let projectile: { id: string; bornTick: number; vx: number } | undefined;
    for (let tick = 0; tick < 12 && !projectile; tick++) {
      h.tick(1);
      projectile = [...h.room.state.projectiles.values()].find(
        (row: { kind: string }) => row.kind === "fan:returning-arc",
      );
    }
    expect(projectile, "storm projectile row").toBeDefined();
    if (!projectile) throw new Error("Storm returning arc did not spawn");
    expect(fire.mock.calls.at(-1)?.[19]).toBeCloseTo(0.3, 8);
    for (let tick = 0; tick < 8 && projectile.vx >= 0; tick++) h.tick(1);
    expect(projectile.vx).toBeLessThan(0);
    const reversedAfterMs = (h.room.state.tick - projectile.bornTick) * TICK_MS;
    expect(reversedAfterMs).toBeGreaterThanOrEqual(250);
    expect(reversedAfterMs).toBeLessThanOrEqual(350);
    h.tick(8);
    const deliveries = deliveriesFor(damage.mock.calls, h.enemy.id, h.player.weapon);
    expect(deliveries).toContain(CombatDelivery.Melee);
    expect(deliveries).toContain(CombatDelivery.HybridProjectile);
    expect(deliveries.indexOf(CombatDelivery.Melee)).toBeLessThan(
      deliveries.indexOf(CombatDelivery.HybridProjectile),
    );
    expect(h.room.state.projectiles.size).toBe(0);
  });
});
