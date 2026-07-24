import {
  CombatDelivery,
  EnemyState,
  swingDescriptorFor,
  TILE_GROUND,
  WEAPONS,
  ZoneStyle,
} from "@dd/shared";
import { describe, expect, it, vi } from "vitest";

vi.mock("colyseus", () => {
  class Room {
    state: unknown;
    clients: { sessionId: string }[] = [];
    roomId = "v3c-caster-test";
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

function equip(room: AnyRoom, player: AnyRoom, combat: AnyRoom, weaponId: string) {
  const definition = WEAPONS[weaponId];
  if (!definition) throw new Error(`Missing V3C authority fixture: ${weaponId}`);
  player.weapon = definition.id;
  combat.lastWeapon = definition.id;
  return definition;
}

function fundAuraStep(room: AnyRoom, player: AnyRoom, combat: AnyRoom, weapon: AnyRoom): void {
  const input = room.inputs.get(player.id);
  input.held.fireHeld = true;
  input.lastFreshFireTick = room.state.tick;
  room.beginWeaponResourceTick(player, combat, 0.05);
  room.stepPlayerAura(player, player.id, combat, weapon, 0.05, true);
  room.commitWeaponResourceTick(player, combat);
}

describe("GameRoom — V3C caster authority", () => {
  it("emits one three-row Arcanist volley whose combined server damage equals the old bolt", () => {
    const { room, player, combat } = makeRoom("lance-volley");
    const definition = equip(room, player, combat, "x-staff-arcane-lance");
    if (!definition.cast?.volley) throw new Error("Arcanist volley fixture is required");

    room.fireCast(player, combat, definition);

    const projectiles = [...room.state.projectiles.values()];
    const damages = projectiles.map((row) => room.projectileMeta.get(row.id)?.damage ?? 0);
    const expectedTotal =
      definition.cast.damage *
      room.heldCastDamageMult(definition, player, 0);
    expect(projectiles).toHaveLength(3);
    expect(new Set(damages.map((damage) => damage.toFixed(8))).size).toBe(1);
    expect(damages.reduce((sum, damage) => sum + damage, 0)).toBeCloseTo(expectedTotal, 8);
  });

  it("keeps Hailshard projectiles inside its aimed ice cone with no inherited melee swing", () => {
    const { room, player, combat } = makeRoom("hail-cone");
    const definition = equip(room, player, combat, "x2-hailshard-resonator");
    if (!definition.scatter) throw new Error("Hailshard scatter fixture is required");
    const random = vi.spyOn(Math, "random").mockReturnValue(0.5);
    room.resolveSwing(
      player,
      combat,
      definition,
      swingDescriptorFor(definition, definition.cooldown),
    );

    const headings = [...room.state.projectiles.values()].map((row) =>
      Math.atan2(row.vy, row.vx),
    );
    expect(headings).toHaveLength(definition.scatter.count);
    expect(Math.max(...headings)).toBeLessThanOrEqual(definition.scatter.spread + 1e-8);
    expect(Math.min(...headings)).toBeGreaterThanOrEqual(-definition.scatter.spread - 1e-8);
    expect(room.meleeSwings.has(player.id)).toBe(false);
    random.mockRestore();
  });

  it("damages through Sporebound's widened authoritative radius", () => {
    const { room, player, combat } = makeRoom("spore-wide");
    const definition = equip(room, player, combat, "x2-sporebound-witchglobe");
    const aura = definition.performance?.aura;
    if (!aura) throw new Error("Sporebound aura fixture is required");
    const target = new EnemyState();
    target.id = "spore-wide-target";
    target.kind = "critter";
    target.x = player.x + 190;
    target.y = player.y;
    target.hp = 10_000;
    room.state.enemies.set(target.id, target);
    room.rebuildEnemyGrid();
    const detonate = vi.spyOn(room, "detonate");

    for (let i = 0; i < 4; i++) fundAuraStep(room, player, combat, definition);

    expect(aura.radius).toBe(252);
    expect(target.hp).toBeLessThan(10_000);
    expect(detonate).toHaveBeenCalledWith(
      player.x,
      player.y,
      252,
      expect.any(Number),
      expect.any(Number),
      player.id,
      definition.id,
      CombatDelivery.Aura,
    );
  });

  it("lands Carrion Effigy's poison zone at the enlarged server-owned radius", () => {
    const { room, player, combat } = makeRoom("carrion-wide");
    const definition = equip(room, player, combat, "x2-carrion-effigy");
    if (!definition.thrown || definition.groundZone?.trigger !== "landing")
      throw new Error("Carrion landing-zone fixture is required");

    room.throwWeapon(player, combat, definition);
    for (let i = 0; i < 20 && room.state.projectiles.size > 0; i++)
      room.stepProjectiles(0.05);

    const zone = [...room.state.zones.values()].find(
      (row) => row.ownerId === player.id && row.weaponId === definition.id,
    );
    expect(zone?.style).toBe(ZoneStyle.Poison);
    expect(zone?.radius).toBe(84);
  });
});
