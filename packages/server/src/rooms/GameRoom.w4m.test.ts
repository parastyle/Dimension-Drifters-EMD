import {
  CombatDelivery,
  characterScale,
  EnemyState,
  TILE_GROUND,
  thrownProjectileSpriteId,
  WEAPONS,
  weaponMuzzleWorldPoint,
} from "@dd/shared";
import { describe, expect, it, vi } from "vitest";

vi.mock("colyseus", () => {
  class Room {
    state: unknown;
    clients: { sessionId: string }[] = [];
    roomId = "w4m-test";
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
  const weapon = WEAPONS[weaponId];
  if (!weapon) throw new Error(`Missing W4M authority fixture: ${weaponId}`);
  player.weapon = weapon.id;
  combat.lastWeapon = weapon.id;
  return weapon;
}

function fundAuraStep(room: AnyRoom, player: AnyRoom, combat: AnyRoom, weapon: AnyRoom): void {
  const input = room.inputs.get(player.id);
  input.held.fireHeld = true;
  input.lastFreshFireTick = room.state.tick;
  room.beginWeaponResourceTick(player, combat, 0.05);
  room.stepPlayerAura(player, player.id, combat, weapon, 0.05, true);
  room.commitWeaponResourceTick(player, combat);
}

describe("GameRoom — W4M server authority", () => {
  it("releases every V8 star and kunai through the authoritative own-sprite thrown path", () => {
    const ids = [
      "x2-iron-throwing-star",
      "x2-fire-throwing-star",
      "x2-ice-throwing-star",
      "x2-void-throwing-star",
      "x2-kunai",
    ] as const;

    for (const id of ids) {
      const { room, player, combat } = makeRoom(`v8-${id}`);
      const weapon = equip(player, combat, id);
      if (!weapon.thrown || !weapon.performance?.windupSeconds)
        throw new Error(`${id} thrown windup fixture is required`);

      room.throwWeapon(player, combat, weapon);
      expect(room.state.projectiles.size, `${id}: no early release`).toBe(0);
      const expectedRows = id === "x2-void-throwing-star" ? 2 : 1;
      expect(room.pendingWeaponThrows, `${id}: queued release`).toHaveLength(expectedRows);

      for (const pending of room.pendingWeaponThrows)
        room.emitWeaponThrow(pending, player.x, player.y);
      const projectiles = [...room.state.projectiles.values()];
      expect(projectiles).toHaveLength(expectedRows);
      for (const projectile of projectiles) {
        expect(projectile.kind, `${id}: encoded weapon identity`).toBe(`thrown:${id}`);
        expect(thrownProjectileSpriteId(projectile.kind), `${id}: own sprite`).toBe(id);
        expect(room.projectileMeta.get(projectile.id), `${id}: authority meta`).toMatchObject({
          sourcePlayerId: player.id,
          sourceWeaponId: id,
          delivery: CombatDelivery.Thrown,
        });
      }
      if (id === "x2-void-throwing-star") {
        expect(projectiles.map((projectile) => projectile.sourceMuzzlePart)).toEqual([0, 1]);
        const metas = projectiles.map((projectile) => room.projectileMeta.get(projectile.id));
        expect(metas.map((meta) => meta?.waveform?.definition.phaseRad)).toEqual([0, Math.PI]);
        expect(metas.reduce((total, meta) => total + (meta?.damage ?? 0), 0)).toBeCloseTo(
          weapon.thrown.damage,
          10,
        );
      }
    }
  });

  it("damages through Fulgurite's exact 450px server aura", () => {
    const { room, player, combat } = makeRoom("fulgurite-450");
    const weapon = equip(player, combat, "x2-fulgurite-storm-sphere");
    if (!weapon.performance?.aura) throw new Error("Fulgurite aura fixture is required");
    const target = new EnemyState();
    target.id = "inside-450";
    target.kind = "dummy";
    target.x = player.x + 420;
    target.y = player.y;
    target.hp = 10_000;
    room.state.enemies.set(target.id, target);
    room.rebuildEnemyGrid();
    const detonate = vi.spyOn(room, "detonate");

    for (let i = 0; i < 4; i++) fundAuraStep(room, player, combat, weapon);

    expect(target.hp).toBeLessThan(10_000);
    expect(detonate).toHaveBeenCalledWith(
      player.x,
      player.y,
      450,
      expect.any(Number),
      expect.any(Number),
      player.id,
      weapon.id,
      CombatDelivery.Aura,
    );
  });

  it("spawns Saintskull as a server-owned projectile instead of a beam row", () => {
    const { room, player, combat } = makeRoom("saintskull-projectile");
    const weapon = equip(player, combat, "x2-saintskull-monstrance");
    if (!weapon.gun) throw new Error("Saintskull projectile fixture is required");

    room.fireGun(player, combat, weapon);

    const projectile = [...room.state.projectiles.values()][0];
    const meta = projectile && room.projectileMeta.get(projectile.id);
    expect(projectile?.kind).toBe("orb:holy");
    expect(meta).toMatchObject({
      sourcePlayerId: player.id,
      sourceWeaponId: weapon.id,
      delivery: CombatDelivery.Gun,
    });
    expect(meta?.ttl).toBeCloseTo(760 / 560);
  });

  it("spawns Mesa's authoritative .50-cal round six pixels above the ordinary barrel lane", () => {
    const { room, player, combat } = makeRoom("mesa-high-muzzle");
    const weapon = equip(player, combat, "x2-mesa-hand-cannon");
    if (!weapon.gun) throw new Error("Mesa projectile fixture is required");
    const expected = weaponMuzzleWorldPoint(weapon, {
      x: player.x,
      y: player.y,
      aimX: 1,
      aimY: 0,
      renderScale: characterScale(player.character),
    });

    room.fireGun(player, combat, weapon);

    const projectile = [...room.state.projectiles.values()][0];
    expect(projectile?.x).toBeCloseTo(expected.x, 6);
    expect(projectile?.y).toBeCloseTo(expected.y, 6);
    expect(projectile && room.projectileMeta.get(projectile.id)).toMatchObject({
      firstCollisionX: player.x,
      firstCollisionY: player.y,
      sourceWeaponId: weapon.id,
    });
  });

  it("launches Hangman's Gavel through the own-sprite thrown path", () => {
    const { room, player, combat } = makeRoom("hangman-throw");
    const weapon = equip(player, combat, "x2-hangman-s-gavel");
    if (!weapon.thrown) throw new Error("Hangman's thrown fixture is required");

    room.throwWeapon(player, combat, weapon);

    const projectile = [...room.state.projectiles.values()][0];
    expect(projectile?.kind).toBe(`thrown:${weapon.id}`);
    expect(thrownProjectileSpriteId(projectile?.kind ?? "")).toBe(weapon.id);
    expect(projectile && room.projectileMeta.get(projectile.id)).toMatchObject({
      sourceWeaponId: weapon.id,
      delivery: CombatDelivery.Thrown,
    });
  });

  it("registers Thunderhoof's full arc, Verdigris's doubled range, and Wyrmskull's stab opener", () => {
    const thunder = makeRoom("thunder-whirl");
    const thunderWeapon = equip(thunder.player, thunder.combat, "x2-thunderhoof-splittingaxe");
    thunder.room.resolveSingleWeaponAttack(thunder.player, thunder.combat);
    expect(thunderWeapon.swingArc).toBeCloseTo(Math.PI * 2);
    expect(thunder.room.meleeSwings.get(thunder.player.id)?.swingArc).toBeCloseTo(Math.PI * 2);

    const verdigris = makeRoom("verdigris-range");
    const verdigrisWeapon = equip(
      verdigris.player,
      verdigris.combat,
      "x2-verdigris-grand-grimoire",
    );
    verdigris.room.resolveSingleWeaponAttack(verdigris.player, verdigris.combat);
    expect(verdigrisWeapon.range).toBe(400);
    expect(verdigris.room.meleeSwings.get(verdigris.player.id)?.range).toBe(400);

    const wyrmskull = makeRoom("wyrmskull-stab");
    const wyrmskullWeapon = equip(wyrmskull.player, wyrmskull.combat, "x2-wyrmskull-reliquary");
    wyrmskull.room.resolveSingleWeaponAttack(wyrmskull.player, wyrmskull.combat);
    expect(wyrmskullWeapon.authoritativeCombo).toBe(true);
    expect(wyrmskull.room.meleeSwings.get(wyrmskull.player.id)?.swingArc).toBe(0);
  });
});
