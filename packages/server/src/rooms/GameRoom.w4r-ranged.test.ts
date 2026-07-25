import {
  CombatDelivery,
  EnemyState,
  FRIENDLY_PROJECTILE_ENTITY_CAP,
  mixSeeds,
  ProjectileState,
  serverSeededGunPelletVolley,
  TILE_GROUND,
  WEAPONS,
} from "@dd/shared";
import { describe, expect, it, vi } from "vitest";

vi.mock("colyseus", () => {
  class Room {
    state: unknown;
    clients: { sessionId: string }[] = [];
    roomId = "w4r-ranged-test";
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
  room.map.tiles.fill(TILE_GROUND);
  room.state.seedHazard = 0x4567abcd;
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
  const weapon = WEAPONS[weaponId];
  if (!weapon) throw new Error(`Missing W4R authority fixture: ${weaponId}`);
  player.weapon = weapon.id;
  combat.lastWeapon = weapon.id;
  return weapon;
}

function enemy(id: string, x: number, y: number): EnemyState {
  const row = new EnemyState();
  row.id = id;
  row.kind = "dummy";
  row.hp = 10_000;
  row.x = x;
  row.y = y;
  return row;
}

describe("GameRoom — W4R ranged authority", () => {
  it("uses the room seed for Gravelthroat count/headings and splits one damage pool across the roll", () => {
    const first = makeRoom("gravel-first");
    const second = makeRoom("gravel-second");
    const weapon = equip(first.player, first.combat, "x2-gravelthroat-repeater");
    equip(second.player, second.combat, weapon.id);
    if (!weapon.gun?.randomPellets) throw new Error("Gravelthroat random-pellet rule is required");
    if (weapon.gun.randomPellets.directions !== "cone")
      throw new Error("Gravelthroat cone rule is required");
    const halfAngle = weapon.gun.randomPellets.halfAngle;
    first.player.attackSeq = 17;
    second.player.attackSeq = 17;
    const expected = serverSeededGunPelletVolley(
      weapon.gun.randomPellets,
      mixSeeds(first.room.state.seedHazard, first.player.attackSeq, first.room.projectileSeq),
    );

    first.room.fireGun(first.player, first.combat, weapon);
    second.room.fireGun(second.player, second.combat, weapon);

    const firstRows = [...first.room.state.projectiles.values()];
    const secondRows = [...second.room.state.projectiles.values()];
    expect(firstRows).toHaveLength(expected.requestedCount);
    expect(firstRows.map((row) => [row.vx, row.vy])).toEqual(
      secondRows.map((row) => [row.vx, row.vy]),
    );
    firstRows.forEach((row, index) => {
      expect(Math.atan2(row.vy, row.vx)).toBeCloseTo(expected.angles[index] ?? 0, 10);
    });
    expect(firstRows.every((row) => Math.abs(Math.atan2(row.vy, row.vx)) <= halfAngle)).toBe(true);
    expect(
      firstRows.reduce((sum, row) => sum + (first.room.projectileMeta.get(row.id)?.damage ?? 0), 0),
    ).toBeCloseTo(
      weapon.gun.damage *
        first.room.heldDamageMult(weapon, first.player, 0),
      8,
    );
  });

  it("fires Plaguespitter's larger random green volley only inside its forward cone", () => {
    const { room, player, combat } = makeRoom("plaguespitter-cone");
    const weapon = equip(player, combat, "x2-plaguespitter-flak-gun");
    if (!weapon.gun?.randomPellets || !weapon.gun.explode)
      throw new Error("Plaguespitter cone/explosion fixtures are required");
    if (weapon.gun.randomPellets.directions !== "cone")
      throw new Error("Plaguespitter cone rule is required");
    const halfAngle = weapon.gun.randomPellets.halfAngle;

    room.fireGun(player, combat, weapon);

    const rows = [...room.state.projectiles.values()];
    expect(rows.length).toBeGreaterThanOrEqual(3);
    expect(rows.length).toBeLessThanOrEqual(7);
    expect(rows.every((row) => Math.abs(Math.atan2(row.vy, row.vx)) <= halfAngle)).toBe(true);
    const multiplier = room.heldDamageMult(weapon, player, 0);
    expect(
      rows.reduce((sum, row) => sum + (room.projectileMeta.get(row.id)?.damage ?? 0), 0),
    ).toBeCloseTo(weapon.gun.damage * multiplier, 8);
    expect(
      rows.reduce((sum, row) => sum + (room.projectileMeta.get(row.id)?.explode?.damage ?? 0), 0),
    ).toBeCloseTo(weapon.gun.explode.damage * multiplier, 8);
  });

  it.each([
    ["x2-sidewinder-spitfire", 2],
    ["x2-hailspitter-pepperbox", 7],
  ] as const)("fires %s as %i parallel barrel lanes sharing one damage pool", (weaponId, laneCount) => {
    const { room, player, combat } = makeRoom(`parallel-${weaponId}`);
    const weapon = equip(player, combat, weaponId);
    if (!weapon.gun) throw new Error(`${weaponId} gun fixture is required`);

    room.fireGun(player, combat, weapon);

    const rows = [...room.state.projectiles.values()];
    expect(rows).toHaveLength(laneCount);
    expect(new Set(rows.map((row) => `${row.vx},${row.vy}`)).size).toBe(1);
    expect(new Set(rows.map((row) => `${row.x},${row.y}`)).size).toBe(laneCount);
    expect(
      rows.reduce((sum, row) => sum + (room.projectileMeta.get(row.id)?.damage ?? 0), 0),
    ).toBeCloseTo(
      weapon.gun.damage * room.heldDamageMult(weapon, player, 0),
      8,
    );
  });

  it("admits Gravelthroat before allocation and never exceeds the friendly entity cap", () => {
    const { room, player, combat } = makeRoom("gravel-cap");
    const weapon = equip(player, combat, "x2-gravelthroat-repeater");
    if (!weapon.gun?.randomPellets) throw new Error("Gravelthroat random-pellet rule is required");
    for (let index = 0; index < FRIENDLY_PROJECTILE_ENTITY_CAP - 1; index++) {
      const row = new ProjectileState();
      row.id = `existing-${index}`;
      row.hostile = false;
      room.state.projectiles.set(row.id, row);
    }
    for (let seq = 1; seq < 100; seq++) {
      player.attackSeq = seq;
      const roll = serverSeededGunPelletVolley(
        weapon.gun.randomPellets,
        mixSeeds(room.state.seedHazard, player.attackSeq, room.projectileSeq),
      );
      if (roll.requestedCount > 1) break;
    }
    const requested = serverSeededGunPelletVolley(
      weapon.gun.randomPellets,
      mixSeeds(room.state.seedHazard, player.attackSeq, room.projectileSeq),
    ).requestedCount;
    expect(requested).toBeGreaterThan(1);

    room.fireGun(player, combat, weapon);

    expect(room.state.projectiles.size).toBe(FRIENDLY_PROJECTILE_ENTITY_CAP);
    const admitted = [...room.state.projectiles.values()].find((row) => row.id.startsWith("p"));
    expect(admitted).toBeDefined();
    expect(room.projectileMeta.get(admitted?.id)?.damage).toBeCloseTo(
      (weapon.gun.damage * room.heldDamageMult(weapon, player, 0)) /
        requested,
      8,
    );
  });

  it.each([
    ["x2-permafrost-siege-lobber", 70],
    ["x2-doomsday-drum-cannon", 90],
  ] as const)("ticks %s through its server-owned widening cone", (weaponId, lateral) => {
    const random = vi.spyOn(Math, "random").mockReturnValue(1);
    try {
      const { room, player, combat } = makeRoom(`cone-${weaponId}`);
      const weapon = equip(player, combat, weaponId);
      if (!weapon.beam?.coneStream) throw new Error(`${weaponId} cone stream is required`);
      const inside = enemy("inside", player.x + 380, player.y + lateral);
      const outside = enemy("outside", player.x + 380, player.y + 220);
      room.state.enemies.set(inside.id, inside);
      room.state.enemies.set(outside.id, outside);
      room.insertEnemyGrid(inside.id, inside);
      room.insertEnemyGrid(outside.id, outside);
      const input = room.inputs.get(player.id);
      input.held.fireHeld = true;
      input.held.fireStartSeq = 1;
      input.held.seq = 1;
      const beforeInside = inside.hp;
      const beforeOutside = outside.hp;

      for (let tick = 0; tick < 15; tick++) {
        input.lastFreshFireTick = room.state.tick;
        room.beginWeaponResourceTick(player, combat, 0.05);
        room.stepPlayerBeam(player, player.id, combat, weapon, 0.05, true);
        room.commitWeaponResourceTick(player, combat);
        room.state.tick++;
      }

      expect(combat.beamPhase).toBe(2);
      expect(beforeInside - inside.hp).toBeCloseTo(combat.beamDescriptor.damagePerSecond * 0.1, 6);
      expect(outside.hp).toBe(beforeOutside);
      const row = room.state.beams.get(player.id);
      expect(row.width).toBeCloseTo(
        Math.max(
          combat.beamDescriptor.width,
          2 * row.effectiveLength * Math.tan(weapon.beam.coneStream.halfAngle),
        ),
        6,
      );
    } finally {
      random.mockRestore();
    }
  });

  it("applies Ricochet Pistol chain links as authoritative shock delivery", () => {
    const { room, player, combat } = makeRoom("ricochet-chain");
    const weapon = equip(player, combat, "x-gun-ricochet-pistol");
    const seed = enemy("seed", player.x + 100, player.y);
    const hopA = enemy("hop-a", player.x + 170, player.y + 5);
    const hopB = enemy("hop-b", player.x + 235, player.y + 10);
    for (const row of [seed, hopA, hopB]) room.state.enemies.set(row.id, row);
    const beforeA = hopA.hp;
    const beforeB = hopB.hp;
    const directHitSet = new Set<string>([seed.id]);

    room.applyProjectileChain(
      seed,
      seed.id,
      {
        hit: directHitSet,
        sourcePlayerId: player.id,
        sourceWeaponId: weapon.id,
        crit: 0,
      },
      [],
    );

    expect(seed.hp).toBe(10_000);
    expect(hopA.hp).toBeLessThan(beforeA);
    expect(hopB.hp).toBeLessThan(beforeB);
    const receipts = [...room.state.combatReceipts].filter((row) => row.seq > 0);
    expect(receipts).toHaveLength(2);
    expect(receipts.every((row) => row.delivery === CombatDelivery.Chain)).toBe(true);
    expect(receipts.every((row) => row.element === "shock")).toBe(true);
  });
});
