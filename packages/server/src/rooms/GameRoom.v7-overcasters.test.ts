import {
  characterScale,
  TICK_MS,
  TILE_GROUND,
  WEAPONS,
  type WeaponDef,
  weaponMuzzleWorldPointsForShot,
} from "@dd/shared";
import { describe, expect, it, vi } from "vitest";

vi.mock("colyseus", () => {
  class Room {
    state: unknown;
    clients: { sessionId: string }[] = [];
    roomId = "v7-overcasters";
    setState(state: unknown) {
      this.state = state;
    }
    onMessage() {}
    setSimulationInterval() {}
    setPatchRate() {}
    broadcast() {}
    broadcastPatch() {}
  }
  return { Room, Client: class {} };
});

const { GameRoom } = await import("./GameRoom.js");

// biome-ignore lint/suspicious/noExplicitAny: focused authority harness intentionally reaches fire internals.
type AnyRoom = any;

function makeRoom(id = "moving-burst") {
  const room = new GameRoom() as AnyRoom;
  const handlers = new Map<string, (client: { sessionId: string }, message?: unknown) => void>();
  room.onMessage = (
    type: string,
    handler: (client: { sessionId: string }, message?: unknown) => void,
  ) => handlers.set(type, handler);
  room.clients = [];
  room.roomId = "v7-overcasters";
  room.onCreate();
  room.clients.push({ sessionId: id });
  room.onJoin({ sessionId: id });
  room.state.mode = "training";
  room.map.tiles.fill(TILE_GROUND);
  room.state.enemies.clear();
  return {
    room,
    player: room.state.players.get(id),
    combat: room.combat.get(id),
    send(type: string, message?: unknown) {
      handlers.get(type)?.({ sessionId: id }, message);
    },
    tick(times = 1) {
      for (let index = 0; index < times; index++) room.update(TICK_MS);
    },
  };
}

function recoveredOrigin(
  row: { x: number; y: number; vx: number; vy: number; bornTick: number },
  currentTick: number,
): { x: number; y: number } {
  const integratedSteps = ((currentTick - row.bornTick) >>> 0) + 1;
  return {
    x: row.x - row.vx * integratedSteps * (TICK_MS / 1000),
    y: row.y - row.vy * integratedSteps * (TICK_MS / 1000),
  };
}

describe("V7 moving multi-round gun origin authority", () => {
  it("keeps Overcasters body recoil out of authority while retaining authored presentation recoil", () => {
    for (const aimX of [-1, 1]) {
      const h = makeRoom(`overcasters-recoil-${aimX}`);
      const weapon = WEAPONS["x2-galvanic-overcasters"];
      if (!weapon?.gun?.burst) throw new Error("Galvanic Overcasters gun fixture is required");
      h.player.weapon = weapon.id;
      h.player.x = 2_200;
      h.player.y = 2_300;
      h.player.vx = 0;
      h.player.vy = 0;
      h.combat.aimX = aimX;
      h.combat.aimY = 0;
      h.combat.targetX = h.player.x + aimX * weapon.gun.range;
      h.combat.targetY = h.player.y;

      expect(weapon.gun.recoil).toBeGreaterThan(0);

      for (let round = 0; round < weapon.gun.burst.count; round++) {
        h.room.fireGun(
          h.player,
          h.combat,
          weapon,
          0,
          round * weapon.gun.burst.intervalSeconds * 1_000,
        );
        expect(h.player.vx, `round ${round + 1} aim ${aimX} vx`).toBe(0);
        expect(h.player.vy, `round ${round + 1} aim ${aimX} vy`).toBe(0);
      }
    }
  });

  it("resolves every delayed Overcasters round from the live player transform on that fire tick", () => {
    const weapon = WEAPONS["x2-galvanic-overcasters"];
    if (!weapon?.gun?.burst) throw new Error("Overcasters burst fixture is required");
    const h = makeRoom();
    const { player, combat } = h;
    player.weapon = weapon.id;
    h.tick(); // transition the authoritative combat identity before accepting the trigger

    const base = { x: 2_400, y: 2_400 };
    const liveOffsets = [
      { x: 0, y: 0 },
      { x: 80, y: 35 },
      { x: -25, y: 90 },
      { x: 120, y: -60 },
    ];
    const origins: { x: number; y: number }[] = [];
    const expectedOrigins: { x: number; y: number }[] = [];
    let seenProjectileSeq = h.room.projectileSeq;

    for (let round = 0; round < liveOffsets.length; round++) {
      const offset = liveOffsets[round];
      if (!offset) throw new Error(`missing live offset for round ${round + 1}`);
      player.x = base.x + offset.x;
      player.y = base.y + offset.y;
      player.vx = 0;
      player.vy = 0;
      combat.aimX = 1;
      combat.aimY = 0;
      combat.targetX = player.x + weapon.gun.range;
      combat.targetY = player.y;
      if (round === 0) {
        h.send("attack", {
          aimX: 1,
          aimY: 0,
          tx: combat.targetX,
          ty: combat.targetY,
        });
      }
      const expected = weaponMuzzleWorldPointsForShot(
        weapon,
        {
          x: player.x,
          y: player.y,
          aimX: 1,
          aimY: 0,
          renderScale: characterScale(player.character),
          hand: 0,
          recoilElapsedMs: round === 0 ? 0 : weapon.gun.burst.intervalSeconds * 1_000,
          recoilHand: 0,
        },
        player.attackSeq,
      )[0];
      if (!expected) throw new Error(`round ${round + 1} did not resolve a shared muzzle`);
      expectedOrigins.push(expected);
      h.tick();
      const rows = [...h.room.state.projectiles.values()].filter(
        (row: { id: string; sourceWeaponId: string }) =>
          row.sourceWeaponId === weapon.id && Number(row.id.slice(1)) >= seenProjectileSeq,
      );
      expect(rows, `round ${round + 1} should create exactly one authoritative row`).toHaveLength(
        1,
      );
      const row = rows[0];
      if (!row) throw new Error(`round ${round + 1} did not expose its projectile row`);
      origins.push(recoveredOrigin(row, h.room.state.tick));
      seenProjectileSeq = h.room.projectileSeq;
    }

    expect(origins).toHaveLength(weapon.gun.burst.count);
    expect(expectedOrigins).toHaveLength(weapon.gun.burst.count);
    for (let round = 0; round < origins.length; round++) {
      const origin = origins[round];
      const expected = expectedOrigins[round];
      if (!origin || !expected) throw new Error(`missing comparison data for round ${round + 1}`);
      expect(origin.x).toBeCloseTo(expected.x, 6);
      expect(origin.y).toBeCloseTo(expected.y, 6);
    }
  });

  it("keeps every catalog gun volley translation-invariant across live fire transforms", () => {
    const h = makeRoom("catalog-multi-round");
    const from = { x: 2_200, y: 2_300 };
    const translation = { x: 137, y: -83 };
    const guns = Object.values(WEAPONS).filter(
      (weapon): weapon is WeaponDef & { gun: NonNullable<WeaponDef["gun"]> } => !!weapon.gun,
    );

    const fireOrigins = (
      weapon: WeaponDef & { gun: NonNullable<WeaponDef["gun"]> },
      x: number,
      y: number,
    ) => {
      h.room.state.projectiles.clear();
      h.room.projectileMeta.clear();
      h.room.hostileProjectileCount = 0;
      h.room.projectileSeq = 1_000;
      h.player.weapon = weapon.id;
      h.player.attackSeq = 17;
      h.player.x = x;
      h.player.y = y;
      h.player.vx = 0;
      h.player.vy = 0;
      h.combat.aimX = 1;
      h.combat.aimY = 0;
      h.combat.targetX = x + weapon.gun.range;
      h.combat.targetY = y;
      h.room.fireGun(h.player, h.combat, weapon, 0);
      return [...h.room.state.projectiles.values()].map((row: { x: number; y: number }) => ({
        x: row.x,
        y: row.y,
      }));
    };

    for (const weapon of guns) {
      const first = fireOrigins(weapon, from.x, from.y);
      const moved = fireOrigins(weapon, from.x + translation.x, from.y + translation.y);
      expect(moved.length, `${weapon.id} row count`).toBe(first.length);
      expect(first.length, `${weapon.id} must emit at least one row`).toBeGreaterThan(0);
      for (let row = 0; row < first.length; row++) {
        const firstOrigin = first[row];
        const movedOrigin = moved[row];
        if (!firstOrigin || !movedOrigin)
          throw new Error(`${weapon.id} row ${row} missing from translation comparison`);
        expect(movedOrigin.x - firstOrigin.x, `${weapon.id} row ${row} x`).toBeCloseTo(
          translation.x,
          6,
        );
        expect(movedOrigin.y - firstOrigin.y, `${weapon.id} row ${row} y`).toBeCloseTo(
          translation.y,
          6,
        );
      }
    }
  });
});
