import {
  isPitAtPx,
  meleeComboSelectionFor,
  PoiCollisionIndex,
  swingDescriptorFor,
  TILE_GROUND,
  TILE_PIT,
  WEAPONS,
} from "@dd/shared";
import { describe, expect, it, vi } from "vitest";

vi.mock("colyseus", () => {
  class Room {
    state: unknown;
    clients: { sessionId: string }[] = [];
    roomId = "b25-kungfu-test";
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

const { GameRoom, weaponComboForwardDrift, weaponComboRootMotion } = await import("./GameRoom.js");

// biome-ignore lint/suspicious/noExplicitAny: authority tests deliberately reach private simulation seams.
type AnyRoom = any;

const WRAPS = [
  "x2-muay-thai-wraps",
  "x2-wing-chun-wraps",
  "x2-drunken-fist-wraps",
  "x2-iron-palm-wraps",
] as const;

function fixture(id: string) {
  const room = new GameRoom() as AnyRoom;
  room.onMessage = () => {};
  room.clients = [{ sessionId: id }];
  room.onCreate();
  room.onJoin({ sessionId: id });
  room.map.pois.length = 0;
  room.map.poiCollisionIndex = new PoiCollisionIndex(
    [],
    room.map.cols * room.map.tileSize,
    room.map.rows * room.map.tileSize,
  );
  room.map.tiles.fill(TILE_GROUND);
  room.state.enemies.clear();
  const player = room.state.players.get(id);
  const combat = room.combat.get(id);
  player.x = 1_500;
  player.y = 1_500;
  combat.lastGroundX = player.x;
  combat.lastGroundY = player.y;
  combat.targetX = 2_000;
  combat.targetY = 1_500;
  combat.aimX = 1;
  combat.aimY = 0;
  return { room, player, combat };
}

describe("GameRoom B25 theatrical kung-fu displacement authority", () => {
  it("resolves every authored beat from the shared combo bar and retires B14 forward drift", () => {
    const expected = {
      "x2-muay-thai-wraps": [
        [288, 0],
        [28, 0],
        [32, 0],
        [44, 0],
        [36, 0],
      ],
      "x2-wing-chun-wraps": [
        [undefined, undefined],
        [undefined, undefined],
        [undefined, undefined],
        [undefined, undefined],
        [undefined, undefined],
      ],
      "x2-drunken-fist-wraps": [
        [18, 88],
        [-12, -112],
        [24, 104],
        [10, -128],
        [156, 40],
      ],
      "x2-iron-palm-wraps": [
        [52, 0],
        [112, 0],
        [72, 0],
        [96, 0],
      ],
    } as const;

    for (const id of WRAPS) {
      const weapon = WEAPONS[id]!;
      expect(weapon.performance?.forwardDrift, id).toBeUndefined();
      expect(weaponComboForwardDrift(weapon, 0), id).toBeUndefined();
      expect(
        meleeComboSelectionFor(weapon)?.sequence.map((_, index) => {
          const root = weaponComboRootMotion(weapon, index);
          return [root?.forwardPx, root?.lateralPx];
        }),
        id,
      ).toEqual(expected[id]);
    }
  });

  it("moves the authoritative player through every full combo, including signed drunken feints", () => {
    const totals = {
      "x2-muay-thai-wraps": { x: 428, y: 0 },
      "x2-wing-chun-wraps": { x: 0, y: 0 },
      "x2-drunken-fist-wraps": { x: 196, y: -8 },
      "x2-iron-palm-wraps": { x: 332, y: 0 },
    } as const;

    for (const id of WRAPS) {
      for (const facing of [-1, 1] as const) {
        const { room, player, combat } = fixture(`${id}-${facing}`);
        const weapon = WEAPONS[id]!;
        const combo = meleeComboSelectionFor(weapon);
        if (!combo) throw new Error(`Missing B25 combo ${id}`);
        player.weapon = id;
        combat.lastWeapon = id;
        combat.targetX = player.x + facing * 500;
        combat.aimX = facing;
        const start = { x: player.x, y: player.y };
        let expectedX = start.x;
        let expectedY = start.y;
        const validate = vi.spyOn(room, "navValidDest");
        const edgePower = room.heldDamageMult(weapon, player, 0);

        for (const step of combo.sequence) {
          const swing = swingDescriptorFor(weapon, weapon.cooldown);
          room.resolveSwing(player, combat, weapon, swing, 0, undefined, step);
          expect(
            room.meleeSwings.get(player.id)?.edgeDamage,
            `${id}:${step.name}:damage`,
          ).toBeCloseTo(weapon.damage * edgePower * step.path.damageMultiplier, 8);
          const root = step.rootMotion;
          if (root) {
            room.stepPendingWeaponLunges(
              step.timing.activeStart * swing.poseSeconds + root.durationSeconds,
            );
            expectedX += root.forwardPx * facing;
            expectedY += root.lateralPx * facing;
          }
          expect(room.pendingWeaponLunges.has(player.id), `${id}:${step.name}`).toBe(false);
          expect(player.x, `${id}:${step.name}:forward`).toBeCloseTo(expectedX, 8);
          expect(player.y, `${id}:${step.name}:lateral`).toBeCloseTo(expectedY, 8);
        }

        expect(player.x, `${id}:forward`).toBeCloseTo(start.x + totals[id].x * facing, 8);
        expect(player.y, `${id}:lateral`).toBeCloseTo(start.y + totals[id].y * facing, 8);
        expect(validate).toHaveBeenCalledTimes(
          combo.sequence.filter((step) => step.rootMotion !== undefined).length,
        );
      }
    }
  });

  it("advances the 288px dragon rocket over authoritative time slices instead of one teleport", () => {
    const { room, player, combat } = fixture("muay-dragon-rocket");
    const weapon = WEAPONS["x2-muay-thai-wraps"]!;
    const step = meleeComboSelectionFor(weapon)?.sequence[0];
    if (!step?.rootMotion) throw new Error("Missing Muay Thai dragon-rocket fixture");
    player.weapon = weapon.id;
    combat.lastWeapon = weapon.id;
    const startX = player.x;
    const swing = swingDescriptorFor(weapon, weapon.cooldown);

    room.resolveSwing(player, combat, weapon, swing, 0, undefined, step);
    room.stepPendingWeaponLunges(step.timing.activeStart * swing.poseSeconds + 0.05);
    const first = player.x;
    room.stepPendingWeaponLunges(0.05);
    const second = player.x;
    room.stepPendingWeaponLunges(0.04);

    expect(first).toBeGreaterThan(startX);
    expect(first).toBeLessThan(startX + 288);
    expect(second).toBeGreaterThan(first);
    expect(second).toBeLessThan(startX + 288);
    expect(player.x).toBeCloseTo(startX + 288, 8);
    expect(room.state.players.get(player.id)?.x).toBe(player.x);
  });

  it("selects each Muay root through the real accepted solo combo chain", () => {
    const { room, player, combat } = fixture("muay-live-chain");
    const weapon = WEAPONS["x2-muay-thai-wraps"]!;
    const slot = player.slots[player.activeSlot];
    if (!slot) throw new Error("Missing active slot for the B25 live-chain fixture");
    player.weapon = weapon.id;
    slot.weapon = weapon.id;
    combat.lastWeapon = weapon.id;
    const distances: number[] = [];

    for (let index = 0; index < 5; index++) {
      room.state.tick = index * 10;
      expect(room.resolveHandAttack(player, combat, 0), `accepted beat ${index}`).toBe(true);
      distances.push(room.pendingWeaponLunges.get(player.id)?.distancePx ?? 0);
      room.stepPendingWeaponLunges(1);
    }

    expect(distances).toEqual([288, 28, 32, 44, 36]);
    expect(combat.soloComboStep).toBe(4);
  });

  it("nav-clamps a stomp at a pit lip and never writes an invalid intermediate position", () => {
    const { room, player, combat } = fixture("iron-pit");
    const weapon = WEAPONS["x2-iron-palm-wraps"]!;
    const step = meleeComboSelectionFor(weapon)?.sequence[1];
    if (!step?.rootMotion) throw new Error("Missing Iron Palm stomp fixture");
    player.weapon = weapon.id;
    combat.lastWeapon = weapon.id;
    const map = room.map;
    const row = Math.floor(player.y / map.tileSize);
    const col = Math.floor(player.x / map.tileSize);
    const lip = (col + 1) * map.tileSize;
    map.tiles[row * map.cols + col + 1] = TILE_PIT;
    player.x = lip - 5;
    player.y = (row + 0.5) * map.tileSize;
    combat.lastGroundX = player.x;
    combat.lastGroundY = player.y;
    const startX = player.x;
    const swing = swingDescriptorFor(weapon, weapon.cooldown);

    room.resolveSwing(player, combat, weapon, swing, 0, undefined, step);
    room.stepPendingWeaponLunges(step.timing.activeStart * swing.poseSeconds);
    expect(isPitAtPx(map, player.x, player.y)).toBe(false);
    room.stepPendingWeaponLunges(step.rootMotion.durationSeconds / 2);
    expect(isPitAtPx(map, player.x, player.y)).toBe(false);
    room.stepPendingWeaponLunges(step.rootMotion.durationSeconds / 2);
    expect(isPitAtPx(map, player.x, player.y)).toBe(false);
    expect(player.x).toBeLessThanOrEqual(lip);
    expect(player.x).toBeGreaterThanOrEqual(startX);
  });
});
