import {
  mixSeeds,
  presentPayloadExplosion,
  serverSeededPresentPayloadRoll,
  TILE_GROUND,
  WEAPONS,
} from "@dd/shared";
import { describe, expect, it, vi } from "vitest";

vi.mock("colyseus", () => {
  class Room {
    state: unknown;
    clients: { sessionId: string }[] = [];
    roomId = "b37-art-integrator";
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

// biome-ignore lint/suspicious/noExplicitAny: focused authority coverage reaches private launch metadata.
type AnyRoom = any;

function makeRoom(id: string, weaponId: string) {
  const room = new GameRoom() as AnyRoom;
  room.onMessage = () => {};
  room.clients = [{ sessionId: id }];
  room.onCreate();
  room.onJoin({ sessionId: id });
  room.map.pois.length = 0;
  room.map.tiles.fill(TILE_GROUND);
  room.state.seedHazard = 0x4567abcd;
  const player = room.state.players.get(id);
  const combat = room.combat.get(id);
  const weapon = WEAPONS[weaponId];
  if (!player || !combat || !weapon?.gun) throw new Error(`Missing B37 fixture ${weaponId}`);
  player.weapon = weaponId;
  player.x = 1_500;
  player.y = 1_500;
  combat.lastWeapon = weaponId;
  combat.targetX = 2_000;
  combat.targetY = 1_500;
  combat.aimX = 1;
  combat.aimY = 0;
  return { room, player, combat, weapon };
}

describe("GameRoom B37 projectile art authority", () => {
  it.each([false, true])("syncs the seeded present variant and its %s payload", (wantedBig) => {
    const h = makeRoom(`present-${wantedBig ? "big" : "regular"}`, "x2-exploding-present-lobber");
    let expected: ReturnType<typeof serverSeededPresentPayloadRoll> | undefined;
    for (let attackSeq = 1; attackSeq < 1_000; attackSeq++) {
      const roll = serverSeededPresentPayloadRoll(
        mixSeeds(h.room.state.seedHazard, attackSeq, h.room.projectileSeq, 0x70726573),
      );
      if (roll.big !== wantedBig) continue;
      h.player.attackSeq = attackSeq;
      expected = roll;
      break;
    }
    expect(expected).toBeDefined();

    h.room.fireGun(h.player, h.combat, h.weapon);

    const rows = [...h.room.state.projectiles.values()];
    expect(rows).toHaveLength(1);
    const gun = h.weapon.gun;
    const explosion = gun?.explode;
    if (!gun || !explosion) throw new Error("Present fixture must retain gun explosion authority");
    const projectile = rows[0];
    const meta = h.room.projectileMeta.get(projectile.id);
    const multiplier = h.room.heldDamageMult(h.weapon, h.player, 0);
    const payload = presentPayloadExplosion(
      {
        radius: explosion.radius,
        damage: explosion.damage * multiplier,
      },
      wantedBig,
    );
    expect(projectile.visualVariant).toBe(expected?.variant);
    expect(projectile.visualVariant === 5).toBe(wantedBig);
    expect(projectile.explodeR).toBeCloseTo(payload.radius, 10);
    expect(meta?.explode).toEqual(payload);
    expect(meta?.damage).toBeCloseTo(gun.damage * multiplier, 10);
  });

  it("keeps the Streetsweeper arc and blast envelope on its authoritative row", () => {
    const h = makeRoom("streetsweeper", "x2-quicksilver-streetsweeper");
    h.room.fireGun(h.player, h.combat, h.weapon);
    const projectile = [...h.room.state.projectiles.values()][0];
    const meta = h.room.projectileMeta.get(projectile.id);
    expect(projectile).toMatchObject({
      kind: "grenade",
      sourceWeaponId: h.weapon.id,
      arcHeight: 112,
      explodeR: 62,
      visualVariant: 0,
    });
    expect(meta?.explode?.radius).toBe(62);
    expect(meta?.explode?.damage).toBeCloseTo(9 * h.room.heldDamageMult(h.weapon, h.player, 0), 10);
  });
});
