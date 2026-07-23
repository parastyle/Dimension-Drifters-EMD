import {
  EnemyState,
  meleeComboSelectionFor,
  swingDescriptorFor,
  TILE_GROUND,
  WEAPONS,
} from "@dd/shared";
import { describe, expect, it, vi } from "vitest";

vi.mock("colyseus", () => {
  class Room {
    state: unknown;
    clients: { sessionId: string }[] = [];
    roomId = "b5-attackroot-test";
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
  if (!weapon) throw new Error(`Missing B5 fixture: ${id}`);
  player.weapon = id;
  combat.lastWeapon = id;
  return weapon;
}

function addEnemy(room: AnyRoom, id: string, x: number, y: number): EnemyState {
  const enemy = new EnemyState();
  enemy.id = id;
  enemy.kind = "dummy";
  enemy.x = x;
  enemy.y = y;
  enemy.hp = 10_000;
  room.state.enemies.set(id, enemy);
  return enemy;
}

describe("GameRoom — B5 attack-authored root movement", () => {
  it("keeps a stationary full Sparkknuckle combo at its authoritative start position", () => {
    const { room, player, combat } = fixture("sparkknuckle");
    const weapon = equip(player, combat, "x2-sparkknuckle-hex-mitt");
    const combo = meleeComboSelectionFor(weapon);
    if (!combo) throw new Error("Missing Sparkknuckle combo fixture");
    const swing = swingDescriptorFor(weapon, weapon.cooldown);
    const start = { x: player.x, y: player.y };

    expect(weapon.performance?.forwardDrift).toBeUndefined();
    for (const step of combo.sequence) {
      room.resolveSwing(player, combat, weapon, swing, 0, undefined, step);
      room.stepPendingWeaponLunges(weapon.cooldown);
      expect(room.pendingWeaponLunges.has(player.id)).toBe(false);
      expect({ x: player.x, y: player.y }).toEqual(start);
    }

    const control = fixture("sparkknuckle-control");
    equip(control.player, control.combat, weapon.id);
    const movingInput = room.inputs.get(player.id);
    const controlInput = control.room.inputs.get(control.player.id);
    movingInput.held.dx = 1;
    controlInput.held.dx = 1;
    for (let tick = 0; tick < 4; tick++) {
      room.stepSim(0.05);
      control.room.stepSim(0.05);
    }
    expect({ x: player.x, y: player.y, mvx: player.mvx, mvy: player.mvy }).toEqual({
      x: control.player.x,
      y: control.player.y,
      mvx: control.player.mvx,
      mvy: control.player.mvy,
    });
  });

  it("dashes Stormfists at 2x speed, protects transit, and releases one endpoint impact", () => {
    const { room, player, combat } = fixture("stormfists");
    const weapon = equip(player, combat, "x2-thunderhead-stormfists");
    const lunge = weapon.performance?.lunge;
    if (!lunge?.durationSeconds) throw new Error("Missing Stormfists lunge fixture");
    const swing = swingDescriptorFor(weapon, weapon.cooldown);
    const startX = player.x;
    const legalEndX = startX + 360;
    const pathEnemy = addEnemy(room, "path", startX + 100, player.y);
    const endpointEnemy = addEnemy(room, "endpoint", legalEndX + 90, player.y);
    room.rebuildEnemyGrid();
    const pathHp = pathEnemy.hp;
    const endpointHp = endpointEnemy.hp;
    const validate = vi.spyOn(room, "navValidDest").mockReturnValue({ x: legalEndX, y: player.y });
    const detonate = vi.spyOn(room, "detonate").mockImplementation(() => {});

    expect(lunge).toMatchObject({
      distancePx: 480,
      durationSeconds: 0.025,
      invulnerable: true,
      impactAtDestination: true,
    });
    expect(lunge.distancePx / lunge.durationSeconds).toBe((480 / 0.05) * 2);

    room.resolveSwing(player, combat, weapon, swing);
    expect(room.meleeSwings.get(player.id)).toMatchObject({ waitForWeaponLunge: true });
    room.stepMeleeSwings(swing.activeEndSeconds);
    expect(pathEnemy.hp).toBe(pathHp);
    expect(endpointEnemy.hp).toBe(endpointHp);

    room.damagePlayer(player, 7, "enemy");
    expect(player.hp).toBe(player.maxHp - 7);
    player.hp = player.maxHp;

    room.stepPendingWeaponLunges(swing.activeStartSeconds);
    expect(player.x).toBe(startX);
    expect(room.weaponLungeInvulnerable(combat)).toBe(true);
    expect(combat.weaponLungeIFrameUntilTick - room.state.tick).toBe(1);

    room.stepPendingWeaponLunges(lunge.durationSeconds / 2);
    expect(player.x).toBeCloseTo(startX + (legalEndX - startX) / 2, 8);
    room.stepMeleeSwings(swing.activeEndSeconds);
    expect(pathEnemy.hp).toBe(pathHp);
    room.damagePlayer(player, 9, "enemy");
    expect(player.hp).toBe(player.maxHp);

    room.stepPendingWeaponLunges(lunge.durationSeconds / 2);
    expect(validate).toHaveBeenCalledTimes(1);
    expect(player.x).toBe(legalEndX);
    expect(room.pendingWeaponLunges.size).toBe(0);
    expect(detonate).toHaveBeenCalledTimes(1);
    expect(detonate).toHaveBeenCalledWith(
      legalEndX,
      player.y,
      weapon.quake?.radius,
      expect.any(Number),
      expect.any(Number),
      player.id,
      weapon.id,
      expect.any(Number),
    );
    expect(room.meleeSwings.get(player.id)).toMatchObject({
      waitForWeaponLunge: false,
      originX: legalEndX,
      originY: player.y,
    });

    // Even if ordinary locomotion resumes before the next collision step, this accepted punch stays locked
    // to the legal dash endpoint. The along-path target is never sampled.
    player.x = startX;
    room.rebuildEnemyGrid();
    room.stepMeleeSwings(swing.activeEndSeconds - swing.activeStartSeconds + 0.001);
    const endpointHpAfterImpact = endpointEnemy.hp;
    expect(pathEnemy.hp).toBe(pathHp);
    expect(endpointHpAfterImpact).toBeLessThan(endpointHp);
    room.stepMeleeSwings(swing.activeEndSeconds);
    expect(endpointEnemy.hp).toBe(endpointHpAfterImpact);

    room.state.tick++;
    expect(room.weaponLungeInvulnerable(combat)).toBe(false);
    room.damagePlayer(player, 9, "enemy");
    expect(player.hp).toBe(player.maxHp - 9);
  });
});
