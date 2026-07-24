import { DRIVE_CAPACITY, sampleBreakActionClock, TICK_MS, TILE_GROUND, WEAPONS } from "@dd/shared";
import { describe, expect, it, vi } from "vitest";

vi.mock("colyseus", () => {
  class Room {
    state: unknown;
    clients: { sessionId: string }[] = [];
    roomId = "b32-frostbore";
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

// biome-ignore lint/suspicious/noExplicitAny: focused authority proof reaches the fixed-step harness.
type AnyRoom = any;

function makeRoom(id = "frostbore-owner") {
  const room = new GameRoom() as AnyRoom;
  const handlers = new Map<string, (client: { sessionId: string }, message?: unknown) => void>();
  room.onMessage = (
    type: string,
    handler: (client: { sessionId: string }, message?: unknown) => void,
  ) => handlers.set(type, handler);
  room.clients = [];
  room.onCreate();
  room.clients.push({ sessionId: id });
  room.onJoin({ sessionId: id });
  room.state.mode = "training";
  room.map.pois.length = 0;
  room.map.tiles.fill(TILE_GROUND);
  room.state.enemies.clear();
  const player = room.state.players.get(id);
  const combat = room.combat.get(id);
  const weapon = WEAPONS["x2-frostbore-scattergun"];
  if (!weapon?.gun?.magazine) throw new Error("missing Frostbore authority fixture");
  player.weapon = weapon.id;
  player.x = 1_500;
  player.y = 1_500;
  combat.aimX = 1;
  combat.aimY = 0;
  combat.targetX = 2_000;
  combat.targetY = 1_500;
  combat.drive.valueF = DRIVE_CAPACITY;
  const sendAttack = () =>
    handlers.get("attack")?.(
      { sessionId: id },
      { aimX: 1, aimY: 0, tx: combat.targetX, ty: combat.targetY },
    );
  const tick = (times = 1) => {
    for (let index = 0; index < times; index++) room.update(TICK_MS);
  };
  tick(); // restore the Frostbore's fresh two-shell resource row
  return { combat, player, room, sendAttack, tick, weapon };
}

describe("GameRoom B32 Frostbore two-shell authority", () => {
  it("accepts two shells, rejects fire during break reload, then refills on the fixed clock", () => {
    const h = makeRoom();
    expect([h.player.charges, h.player.maxCharges]).toEqual([2, 2]);

    h.sendAttack();
    h.tick();
    expect(h.player.attackSeq).toBe(1);
    expect(h.player.charges).toBe(1);

    for (let index = 0; h.player.attackSeq < 2 && index < 12; index++) {
      h.sendAttack();
      h.tick();
    }
    expect(h.player.attackSeq).toBe(2);
    expect(h.player.charges).toBe(0);
    expect(h.combat.reloadCd).toBeCloseTo(0.9, 6);
    const reloadAttackTick = h.player.attackTick;

    h.sendAttack();
    h.tick(7);
    expect(h.player.attackSeq).toBe(2);
    const eject = sampleBreakActionClock(
      h.weapon,
      reloadAttackTick,
      h.room.state.tick,
      h.player.charges,
      h.player.maxCharges,
    );
    expect(eject.phase).toBe("eject");
    expect(eject.muzzleAllowed).toBe(false);

    while ((h.room.state.tick - reloadAttackTick) >>> 0 < 17) h.tick();
    expect(h.player.charges).toBe(0);
    expect(h.player.attackSeq).toBe(2);
    h.tick();
    expect(h.player.charges).toBe(2);
    expect(h.combat.reloadCd).toBe(0);

    h.sendAttack();
    h.tick();
    expect(h.player.attackSeq).toBe(3);
    expect(h.player.charges).toBe(1);
  });
});
