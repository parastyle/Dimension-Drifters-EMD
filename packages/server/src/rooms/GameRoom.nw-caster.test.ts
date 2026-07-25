import {
  CombatDelivery,
  EnemyState,
  swingDescriptorFor,
  TILE_GROUND,
  WEAPONS,
  weaponEffectEmitterPoint,
} from "@dd/shared";
import { describe, expect, it, vi } from "vitest";

vi.mock("colyseus", () => {
  class Room {
    state: unknown;
    clients: { sessionId: string }[] = [];
    roomId = "nw-caster-test";
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

function equip(room: AnyRoom, player: AnyRoom, combat: AnyRoom, weaponId: string) {
  const weapon = WEAPONS[weaponId];
  if (!weapon) throw new Error(`Missing NW-CASTER fixture: ${weaponId}`);
  player.weapon = weapon.id;
  combat.lastWeapon = weapon.id;
  return weapon;
}

function addTarget(room: AnyRoom, x: number, y: number): EnemyState {
  const enemy = new EnemyState();
  enemy.id = `nw-target-${room.state.enemies.size}`;
  enemy.kind = "critter";
  enemy.x = x;
  enemy.y = y;
  enemy.hp = 10_000;
  room.state.enemies.set(enemy.id, enemy);
  room.rebuildEnemyGrid();
  return enemy;
}

function fundAuraStep(room: AnyRoom, player: AnyRoom, combat: AnyRoom, weapon: AnyRoom): void {
  const input = room.inputs.get(player.id);
  input.held.fireHeld = true;
  input.lastFreshFireTick = room.state.tick;
  room.beginWeaponResourceTick(player, combat, 0.05);
  room.stepPlayerAura(player, player.id, combat, weapon, 0.05, true);
  room.commitWeaponResourceTick(player, combat);
}

describe("GameRoom — NW-CASTER authority contracts", () => {
  it("spawns Frostknuckle's tighter, longer scatter from the weapon tip", () => {
    const { room, player, combat } = makeRoom("rime-tip");
    const weapon = equip(room, player, combat, "x2-frostknuckle-rimewrap");
    if (!weapon.scatter) throw new Error("Frostknuckle scatter fixture is required");
    const random = vi.spyOn(Math, "random").mockReturnValue(0.5);
    const expected = weaponEffectEmitterPoint(weapon, player, 0);

    room.fireScatter(player, combat, weapon);

    expect(weapon.scatter).toMatchObject({ spread: 0.28, range: 320 });
    expect(room.state.projectiles.size).toBe(weapon.scatter.count);
    for (const projectile of room.state.projectiles.values()) {
      const meta = room.projectileMeta.get(projectile.id);
      expect(projectile.x).toBeCloseTo(expected.x, 8);
      expect(projectile.y).toBeCloseTo(expected.y, 8);
      expect(meta?.firstCollisionX).toBe(player.x);
      expect(meta?.firstCollisionY).toBe(player.y);
    }
    random.mockRestore();
  });

  it("launches one authoritative Voidwell bomb with cosmetic arc truth and a fixed blast radius", () => {
    const { room, player, combat } = makeRoom("void-bomb");
    const weapon = equip(room, player, combat, "x2-voidwell-idol");
    if (!weapon.gun?.explode) throw new Error("Voidwell bomb fixture is required");

    room.fireGun(player, combat, weapon);

    const projectile = [...room.state.projectiles.values()][0];
    if (!projectile) throw new Error("Voidwell did not emit a bomb row");
    const meta = room.projectileMeta.get(projectile.id);
    expect(weapon.beam).toBeUndefined();
    expect(weapon.gun).toMatchObject({ bulletKind: "grenade", arcHeight: 112 });
    expect(projectile.kind).toBe("grenade:void");
    expect(projectile.explodeR).toBe(96);
    expect(meta?.explode?.radius).toBe(96);
    expect((weapon.gun.damage + weapon.gun.explode.damage) / weapon.gun.fireRate).toBe(100);
  });

  it("ticks Galvanic Liber's orbiting lightning cloud as a centered server aura", () => {
    const { room, player, combat } = makeRoom("liber-orbit");
    const weapon = equip(room, player, combat, "x2-galvanic-liber-of-storms");
    if (!weapon.performance?.aura) throw new Error("Galvanic orbit aura fixture is required");
    const target = addTarget(room, player.x + 40, player.y);
    const hp = target.hp;
    const detonate = vi.spyOn(room, "detonate");

    for (let i = 0; i < 4; i++) fundAuraStep(room, player, combat, weapon);

    expect(target.hp).toBeLessThan(hp);
    expect(detonate).toHaveBeenCalledWith(
      player.x,
      player.y,
      weapon.performance.aura.radius,
      expect.any(Number),
      expect.any(Number),
      player.id,
      weapon.id,
      CombatDelivery.Aura,
    );
    expect(room.state.zones.size).toBe(0);
  });

  it("plants Stormfists and preserves its former dash endpoint as remote quake reach", () => {
    const { room, player, combat } = makeRoom("storm-lunge");
    const weapon = equip(room, player, combat, "x2-thunderhead-stormfists");
    const swing = swingDescriptorFor(weapon, weapon.cooldown);
    const start = { x: player.x, y: player.y };
    const epoch = player.dualWield.serverMotionEpoch;

    room.resolveSwing(player, combat, weapon, swing);
    expect({ x: player.x, y: player.y }).toEqual(start);
    expect(player.dualWield.serverMotionEpoch).toBe(epoch);
    expect(weapon.range).toBe(680);
    expect(weapon.quake?.placementRange).toBe(480);
    expect(room.pendingQuakes[0]).toMatchObject({ x: start.x + 480, y: start.y });
  });

  it("records Sporebound aura damage as BIO while retaining toxic weapon/VFX identity", () => {
    const { room, player, combat } = makeRoom("spore-bio");
    const weapon = equip(room, player, combat, "x2-sporebound-witchglobe");
    if (!weapon.performance?.aura) throw new Error("Sporebound BIO aura fixture is required");
    const target = addTarget(room, player.x + 35, player.y);

    for (let i = 0; i < 4; i++) fundAuraStep(room, player, combat, weapon);

    const receipt = [...room.state.combatReceipts]
      .filter((row) => row.seq > 0 && row.targetId === target.id)
      .sort((a, b) => b.seq - a.seq)[0];
    expect(weapon.tags.element).toBe("toxic");
    expect(weapon.performance.aura.damageType).toBe("bio");
    expect(receipt?.delivery).toBe(CombatDelivery.Aura);
    expect(receipt?.element).toBe("bio");
  });
});
