import {
  makeRng,
  projectileWaveformPositionAt,
  swingDescriptorFor,
  TILE_GROUND,
  WEAPONS,
  ZoneStyle,
} from "@dd/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Determinism (audit-qa RNG-parity, same as GameRoom.test.ts): pin Math.random per test so cross-file
// suite ordering cannot shift the global stream and flip position-sensitive spatial/combat assertions.
beforeEach(() => {
  const detRng = makeRng(0x9e3779b9);
  vi.spyOn(Math, "random").mockImplementation(() => detRng.next());
});
afterEach(() => {
  vi.restoreAllMocks();
});

vi.mock("colyseus", () => {
  class Room {
    state: unknown;
    clients: { sessionId: string }[] = [];
    roomId = "v5r-test";
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

function fixture(id: string) {
  const room = new GameRoom() as AnyRoom;
  room.onMessage = () => {};
  room.clients = [{ sessionId: id }];
  room.onCreate();
  room.onJoin({ sessionId: id });
  room.map.pois.length = 0;
  room.map.tiles.fill(TILE_GROUND);
  room.state.enemies.clear();
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
  if (!weapon) throw new Error(`Missing V5R fixture: ${id}`);
  player.weapon = id;
  combat.lastWeapon = id;
  return weapon;
}

describe("GameRoom — V5R ranged/caster authority", () => {
  it("bounds Stormfists immunity to one server tick and validates its 25ms 480px endpoint", () => {
    const { room, player, combat } = fixture("stormfists");
    const weapon = equip(player, combat, "x2-thunderhead-stormfists");
    const swing = swingDescriptorFor(weapon, weapon.cooldown);
    const validate = vi.spyOn(room, "navValidDest");
    const startX = player.x;
    const startY = player.y;

    room.resolveSwing(player, combat, weapon, swing);
    room.damagePlayer(player, 7, "enemy");
    expect(player.hp).toBe(player.maxHp - 7);
    player.hp = player.maxHp;

    while (combat.weaponLungeIFrameUntilTick <= room.state.tick) {
      room.state.tick++;
      room.stepPendingWeaponLunges(0.05);
    }
    const activeStartTick = room.state.tick;
    expect(combat.weaponLungeIFrameUntilTick - activeStartTick).toBe(1);
    expect(weapon.performance?.lunge?.durationSeconds).toBe(0.025);
    room.stepPendingWeaponLunges(weapon.performance?.lunge?.durationSeconds ?? 0);

    for (let index = 0; index < 1; index++) {
      expect(room.weaponLungeInvulnerable(combat), `active tick ${index}`).toBe(true);
      room.damagePlayer(player, 9, "enemy");
      expect(player.hp).toBe(player.maxHp);
    }

    expect(room.pendingWeaponLunges.size).toBe(0);
    expect(validate).toHaveBeenCalledTimes(1);
    expect(Math.hypot(player.x - startX, player.y - startY)).toBeCloseTo(480, 8);
    room.state.tick++;
    expect(room.weaponLungeInvulnerable(combat)).toBe(false);
    room.damagePlayer(player, 9, "enemy");
    expect(player.hp).toBe(player.maxHp - 9);
  });

  it("converts Gilded channeling and Snowglobe impact into server-owned ice slow zones", () => {
    const gilded = fixture("gilded-zone");
    const gildedWeapon = equip(gilded.player, gilded.combat, "x2-gilded-hourglass-frost-scepter");
    const gildedInput = gilded.room.inputs.get(gilded.player.id);
    gildedInput.held.fireHeld = true;
    gildedInput.lastFreshFireTick = gilded.room.state.tick;
    gilded.room.beginWeaponResourceTick(gilded.player, gilded.combat, 0.05);
    gilded.room.stepPlayerGroundZone(
      gilded.player,
      gilded.player.id,
      gilded.combat,
      gildedWeapon,
      0.05,
      true,
    );
    gilded.room.commitWeaponResourceTick(gilded.player, gilded.combat);
    const gildedZone = [...gilded.room.state.zones.values()][0];
    expect(gildedZone?.style).toBe(ZoneStyle.Ice);
    expect(gilded.room.zoneMeta.get(gildedZone?.id)).toMatchObject({
      slowMultiplier: 0.5,
      slowSeconds: 0.3,
    });

    const snow = fixture("snow-zone");
    const snowWeapon = equip(snow.player, snow.combat, "x2-frostbite-snowglobe");
    snow.room.resolveSwing(
      snow.player,
      snow.combat,
      snowWeapon,
      swingDescriptorFor(snowWeapon, snowWeapon.cooldown),
    );
    for (let tick = 0; tick < 20 && snow.room.state.zones.size === 0; tick++)
      snow.room.stepSim(0.05);
    const snowZone = [...snow.room.state.zones.values()][0];
    expect(snowZone).toMatchObject({
      style: ZoneStyle.Ice,
      radius: 140,
      weaponId: snowWeapon.id,
    });
    expect(snow.room.zoneMeta.get(snowZone?.id)).toMatchObject({
      damagePerSecond: 0,
      slowMultiplier: 0.55,
      slowSeconds: 0.3,
    });
  });

  it("serializes Graveshot's M203 arc clock and keeps its blast authoritative", () => {
    const { room, player, combat } = fixture("graveshot");
    const weapon = equip(player, combat, "x2-graveshot-grenade-gun");
    room.fireGun(player, combat, weapon);
    const projectile = [...room.state.projectiles.values()][0];
    if (!projectile) throw new Error("Graveshot did not launch");

    expect(projectile.arcHeight).toBe(112);
    expect(projectile.flightTicks).toBe(Math.round(600 / 580 / 0.05));
    expect(room.projectileMeta.get(projectile.id)?.explode).toEqual({
      radius: 62,
      damage: 9 * room.heldDamageMult(weapon, player, 0),
    });
    room.stepProjectiles(0.05);
    expect(projectile.flightAgeTicks).toBe(1);
  });

  it("advances Stormcaller's authoritative projectile on the shared waveform", () => {
    const { room, player, combat } = fixture("stormcaller");
    const weapon = equip(player, combat, "x-staff-storm-rod");
    if (!weapon.cast?.projectileWaveform) throw new Error("Stormcaller waveform is required");
    room.fireCast(player, combat, weapon);
    const projectile = [...room.state.projectiles.values()][0];
    if (!projectile) throw new Error("Stormcaller did not launch");
    const meta = room.projectileMeta.get(projectile.id);
    const waveform = meta?.waveform;
    if (!waveform) throw new Error("Server waveform metadata is required");

    for (let tick = 1; tick <= 4; tick++) {
      room.stepProjectiles(0.05);
      const expected = projectileWaveformPositionAt(
        waveform.originX,
        waveform.originY,
        projectile.vx,
        projectile.vy,
        tick * 0.05,
        weapon.cast.projectileWaveform,
      );
      expect(projectile.x).toBeCloseTo(expected.x, 8);
      expect(projectile.y).toBeCloseTo(expected.y, 8);
      expect(projectile.flightAgeTicks).toBe(tick);
    }
  });
});
