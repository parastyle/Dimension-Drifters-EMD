import { gunMuzzleReach, TILE_GROUND, WEAPONS, ZoneStyle } from "@dd/shared";
import { describe, expect, it, vi } from "vitest";

vi.mock("colyseus", () => {
  class Room {
    state: unknown;
    clients: { sessionId: string }[] = [];
    roomId = "v3r-ranged-test";
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

function equip(player: AnyRoom, combat: AnyRoom, weaponId: string) {
  const definition = WEAPONS[weaponId];
  if (!definition) throw new Error(`Missing V3R authority fixture: ${weaponId}`);
  player.weapon = definition.id;
  combat.lastWeapon = definition.id;
  return definition;
}

describe("GameRoom — V3R ranged authority", () => {
  it("cycles Reliquary Nailcaster origins through tips 1-2-3 on accepted attack sequence", () => {
    const { room, player, combat } = makeRoom("nail-cycle");
    const weapon = equip(player, combat, "x2-reliquary-nailcaster");
    const reach = gunMuzzleReach(weapon);
    const expected = [
      { x: player.x + reach - 3, y: player.y - 9 },
      { x: player.x + reach, y: player.y },
      { x: player.x + reach - 3, y: player.y + 9 },
    ];

    for (let seq = 1; seq <= 3; seq++) {
      player.attackSeq = seq;
      room.fireGun(player, combat, weapon);
      const projectile = [...room.state.projectiles.values()].at(-1);
      const expectedOrigin = expected[seq - 1];
      if (!expectedOrigin) throw new Error(`Missing Nailcaster origin ${seq}`);
      expect(projectile?.x).toBeCloseTo(expectedOrigin.x, 6);
      expect(projectile?.y).toBeCloseTo(expectedOrigin.y, 6);
      const meta = projectile ? room.projectileMeta.get(projectile.id) : undefined;
      expect(meta?.firstCollisionX).toBe(player.x);
      expect(meta?.firstCollisionY).toBe(player.y);
    }
  });

  it.each([
    ["x2-brimstone-bull", 2],
    ["x2-hallowbore-coachgun", 2],
    ["x2-sunbreaker-railgun", 2],
    ["x2-scattershell-duster", 4],
  ] as const)("spawns %s parallel lanes with DPS-neutral split damage", (weaponId, count) => {
    const { room, player, combat } = makeRoom(`parallel-${weaponId}`);
    const weapon = equip(player, combat, weaponId);
    if (!weapon.gun) throw new Error("parallel fixture must be a gun");
    player.attackSeq = 1;

    room.fireGun(player, combat, weapon);

    const projectiles = [...room.state.projectiles.values()];
    const meta = projectiles.map((projectile) => room.projectileMeta.get(projectile.id));
    const expectedDamage =
      weapon.gun.damage * room.heldDamageMult(weapon, weapon.gun.scalingGrades, player, 0);
    expect(projectiles).toHaveLength(count);
    expect(new Set(projectiles.map((projectile) => projectile.vy.toFixed(8)))).toEqual(
      new Set(["0.00000000"]),
    );
    expect(meta.reduce((sum, row) => sum + (row?.damage ?? 0), 0)).toBeCloseTo(expectedDamage, 8);
    if (weapon.gun.explode) {
      const expectedExplosion =
        weapon.gun.explode.damage *
        room.heldDamageMult(
          weapon,
          weapon.gun.explode.scalingGrades ?? weapon.gun.scalingGrades,
          player,
          0,
        );
      expect(meta.reduce((sum, row) => sum + (row?.explode?.damage ?? 0), 0)).toBeCloseTo(
        expectedExplosion,
        8,
      );
    }
  });

  it("fires the base Gatling from its top barrel and the Railgun at authored velocity", () => {
    const gatlingFixture = makeRoom("gatling-top");
    const gatling = equip(gatlingFixture.player, gatlingFixture.combat, "x-gun-gatling");
    gatlingFixture.player.attackSeq = 1;
    gatlingFixture.room.fireGun(gatlingFixture.player, gatlingFixture.combat, gatling);
    const gatlingShot = [...gatlingFixture.room.state.projectiles.values()][0];
    expect(gatlingShot?.y).toBeCloseTo(gatlingFixture.player.y - 13, 6);

    const railFixture = makeRoom("rail-speed");
    const rail = equip(railFixture.player, railFixture.combat, "x2-sunbreaker-railgun");
    railFixture.player.attackSeq = 1;
    railFixture.room.fireGun(railFixture.player, railFixture.combat, rail);
    for (const projectile of railFixture.room.state.projectiles.values())
      expect(Math.hypot(projectile.vx, projectile.vy)).toBeCloseTo(3_200, 6);
  });

  it("replicates six Stormcaller barrel rows under the friendly beam cap", () => {
    const { room, player, combat } = makeRoom("storm-six");
    const weapon = equip(player, combat, "x2-stormcaller-tesla-gatling");
    if (!weapon.beam?.muzzleOffsets) throw new Error("Stormcaller barrel fixture is required");
    const input = room.inputs.get(player.id);
    input.held.fireHeld = true;

    for (let i = 0; i < 20 && room.state.beams.size < 6; i++) {
      input.lastFreshFireTick = room.state.tick;
      room.beginWeaponResourceTick(player, combat, 0.05);
      room.stepPlayerBeam(player, player.id, combat, weapon, 0.05, true);
      room.commitWeaponResourceTick(player, combat);
      room.state.tick++;
    }

    const rows = [...room.state.beams.entries()];
    expect(rows).toHaveLength(6);
    expect(rows.map(([key]) => key)).toEqual([
      player.id,
      `${player.id}:barrel:1`,
      `${player.id}:barrel:2`,
      `${player.id}:barrel:3`,
      `${player.id}:barrel:4`,
      `${player.id}:barrel:5`,
    ]);
    expect(
      new Set(rows.map(([, row]) => `${row.originX.toFixed(4)},${row.originY.toFixed(4)}`)).size,
    ).toBe(6);
  });

  it("grows Spore-Spitter as a server-owned poison smoke zone", () => {
    const { room, player, combat } = makeRoom("spore-ring");
    const weapon = equip(player, combat, "x2-spore-spitter-blunderbuss");
    if (weapon.groundZone?.trigger !== "channel") throw new Error("Spore zone fixture is required");
    const input = room.inputs.get(player.id);
    input.held.fireHeld = true;
    input.lastFreshFireTick = room.state.tick;
    room.beginWeaponResourceTick(player, combat, 0.05);
    room.stepPlayerGroundZone(player, player.id, combat, weapon, 0.05, true);
    room.commitWeaponResourceTick(player, combat);

    const zone = [...room.state.zones.values()][0];
    expect(zone?.style).toBe(ZoneStyle.PoisonSmoke);
    expect(zone?.radius).toBeCloseTo(37, 6);
    expect(room.zoneMeta.get(zone?.id)?.damagePerSecond).toBeGreaterThan(0);
  });
});
