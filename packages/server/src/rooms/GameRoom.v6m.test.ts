import {
  CombatDelivery,
  EnemyState,
  makeRng,
  swingDescriptorFor,
  TILE_GROUND,
  WEAPONS,
} from "@dd/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("colyseus", () => {
  class Room {
    state: unknown;
    clients: { sessionId: string }[] = [];
    roomId = "v6m-test";
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

function equip(player: AnyRoom, combat: AnyRoom, id: string) {
  const weapon = WEAPONS[id];
  if (!weapon) throw new Error(`Missing V6M server fixture: ${id}`);
  player.weapon = weapon.id;
  combat.lastWeapon = weapon.id;
  return weapon;
}

describe("GameRoom — V6M melee authority", () => {
  // Restore any per-test Math.random seed so it cannot leak into sibling tests.
  afterEach(() => vi.restoreAllMocks());
  it("advances Cinderbrand's accepted held beat through server navigation at 72 px/s", () => {
    const { room, player, combat } = makeRoom("cinderbrand-drift");
    // Seed Math.random: the lunge/nav accounting is otherwise sensitive to the global RNG stream
    // position, which full-suite ordering shifts (a catalog change flipped this px-window assertion).
    const rng = makeRng(0xc17de701);
    vi.spyOn(Math, "random").mockImplementation(() => rng.next());
    const weapon = equip(player, combat, "x2-cinderbrand-cleaver");
    const swing = swingDescriptorFor(weapon, weapon.cooldown);
    const startX = player.x;
    const validate = vi.spyOn(room, "navValidDest");

    room.resolveSwing(player, combat, weapon, swing);
    expect(room.pendingWeaponLunges.get(player.id)).toMatchObject({
      t: 0,
      distancePx: 24,
      durationSeconds: 1 / 3,
      invulnerable: false,
    });
    room.stepPendingWeaponLunges(1 / 3);

    expect(validate).toHaveBeenCalled();
    expect(player.x - startX).toBeGreaterThan(23);
    expect(player.x - startX).toBeLessThanOrEqual(24);
  });

  it("damages once inside Coilshot's server draw arc before releasing its projectile", () => {
    const { room, player, combat } = makeRoom("coilshot-draw-damage");
    const weapon = equip(player, combat, "x2-coilshot-meteor");
    const enemy = new EnemyState();
    enemy.id = "coilshot-draw-target";
    enemy.kind = "dummy";
    enemy.x = player.x + 80;
    enemy.y = player.y;
    enemy.hp = 10_000;
    room.state.enemies.set(enemy.id, enemy);
    room.rebuildEnemyGrid();

    room.throwWeapon(player, combat, weapon);
    const draw = room.meleeSwings.get(`${player.id}:prethrow:0`);
    expect(draw).toMatchObject({ range: 150, swingArc: Math.PI * 2 });
    expect(draw?.edgeDamage).toBeGreaterThan(0);
    expect(draw?.edgeDamage / room.pendingWeaponThrows[0].damage).toBeCloseTo(4 / 8, 10);
    expect(room.state.projectiles.size).toBe(0);
    expect(room.pendingWeaponThrows).toHaveLength(1);
    for (let i = 0; i < 8; i++) room.stepMeleeSwings(0.05);

    expect(enemy.hp).toBeLessThan(10_000);
    expect(room.state.projectiles.size).toBe(0);
  });

  it("writes Galvanic poison direct receipts and electric chain receipts", () => {
    const { room, player, combat } = makeRoom("galvanic-types");
    const weapon = equip(player, combat, "x2-galvanic-lancepole");
    const enemy = new EnemyState();
    enemy.id = "galvanic-target";
    enemy.kind = "dummy";
    enemy.x = player.x + 40;
    enemy.y = player.y;
    enemy.hp = 10_000;
    room.state.enemies.set(enemy.id, enemy);

    room.writeCombatReceipt(
      enemy.id,
      enemy.x,
      enemy.y,
      player.id,
      weapon.id,
      CombatDelivery.Melee,
      player.x,
      player.y,
      8,
      false,
      false,
    );
    room.writeCombatReceipt(
      enemy.id,
      enemy.x,
      enemy.y,
      player.id,
      weapon.id,
      CombatDelivery.Chain,
      player.x,
      player.y,
      5,
      false,
      false,
    );

    const receipts = [...room.state.combatReceipts]
      .filter((row: { seq: number }) => row.seq > 0)
      .sort((a: { seq: number }, b: { seq: number }) => a.seq - b.seq);
    expect(receipts.at(-2)?.element).toBe("toxic");
    expect(receipts.at(-1)?.element).toBe("shock");
  });
});
