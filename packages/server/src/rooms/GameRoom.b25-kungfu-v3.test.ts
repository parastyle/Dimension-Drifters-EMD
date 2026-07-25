import {
  meleeComboSelectionFor,
  PlayerAttackMoveMode,
  PoiCollisionIndex,
  swingDescriptorFor,
  TILE_GROUND,
  WEAPONS,
} from "@dd/shared";
import { describe, expect, it, vi } from "vitest";

vi.mock("colyseus", () => {
  class Room {
    state: unknown;
    clients: { sessionId: string }[] = [];
    roomId = "b36-martial-corrections-test";
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

const WRAPS = [
  "x2-muay-thai-wraps",
  "x2-wing-chun-wraps",
  "x2-drunken-fist-wraps",
  "x2-iron-palm-wraps",
  "x2-emberfist-wraps",
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

describe("GameRoom B36 displacement-free martial combos", () => {
  it("keeps every combo beat while removing both root-motion displacement channels", () => {
    const expectedLengths = {
      "x2-muay-thai-wraps": 5,
      "x2-wing-chun-wraps": 5,
      "x2-drunken-fist-wraps": 5,
      "x2-iron-palm-wraps": 4,
      "x2-emberfist-wraps": 8,
    } as const;

    for (const id of WRAPS) {
      const weapon = WEAPONS[id]!;
      const combo = meleeComboSelectionFor(weapon);
      expect(combo?.sequence, id).toHaveLength(expectedLengths[id]);
      expect("forwardDrift" in (weapon.performance ?? {}), id).toBe(false);
      expect(
        combo?.sequence.map((step) => ({
          motion: step.motion,
          hasRootMotion: "rootMotion" in step,
          theatrics: step.theatrics,
        })),
        id,
      ).toEqual(
        combo?.sequence.map((step) => ({
          motion: step.motion,
          hasRootMotion: false,
          theatrics: step.theatrics,
        })),
      );
    }
  });

  it("resolves all five full combos in place in both facings without losing beat damage", () => {
    for (const id of WRAPS) {
      for (const facing of [-1, 1] as const) {
        const { room, player, combat } = fixture(`${id}-${facing}`);
        const weapon = WEAPONS[id]!;
        const combo = meleeComboSelectionFor(weapon);
        if (!combo) throw new Error(`Missing B36 combo ${id}`);
        player.weapon = id;
        combat.lastWeapon = id;
        combat.targetX = player.x + facing * 500;
        combat.aimX = facing;
        const start = { x: player.x, y: player.y };
        const edgePower = room.heldDamageMult(weapon, player, 0);

        for (const step of combo.sequence) {
          const swing = swingDescriptorFor(weapon, weapon.cooldown);
          room.resolveSwing(player, combat, weapon, swing, 0, undefined, step);
          expect(
            room.meleeSwings.get(player.id)?.edgeDamage,
            `${id}:${step.name}:damage`,
          ).toBeCloseTo(weapon.damage * edgePower * step.path.damageMultiplier, 8);
          expect({ x: player.x, y: player.y }, `${id}:${step.name}:position`).toEqual(start);
        }

        expect({ x: player.x, y: player.y }, `${id}:post-combo`).toEqual(start);
      }
    }
  });

  it("selects every beat through the real accepted solo chain without scheduling displacement", () => {
    for (const id of WRAPS) {
      const { room, player, combat } = fixture(`${id}-chain`);
      const weapon = WEAPONS[id]!;
      const combo = meleeComboSelectionFor(weapon);
      const slot = player.slots[player.activeSlot];
      if (!combo || !slot) throw new Error(`Missing B36 solo-chain fixture ${id}`);
      player.weapon = id;
      slot.weapon = id;
      combat.lastWeapon = id;
      const start = { x: player.x, y: player.y };

      for (let index = 0; index < combo.sequence.length; index++) {
        room.state.tick = index * 2;
        expect(room.resolveSingleWeaponAttack(player, combat), `${id}:beat:${index}`).toBe(true);
        expect({ x: player.x, y: player.y }, `${id}:beat:${index}:root`).toEqual(start);
        combat.cd = 0;
      }

      expect(combat.soloComboStep, id).toBe(combo.sequence.length - 1);
      expect({ x: player.x, y: player.y }, `${id}:stable`).toEqual(start);
    }
  });

  it("publishes modest input slow and still lets players walk during punches", () => {
    for (const id of WRAPS) {
      for (const facing of [-1, 1] as const) {
        const { room, player, combat } = fixture(`${id}-walk-${facing}`);
        const weapon = WEAPONS[id]!;
        const step = meleeComboSelectionFor(weapon)?.sequence[0];
        if (!step) throw new Error(`Missing B36 walking fixture ${id}`);
        player.weapon = id;
        combat.lastWeapon = id;
        combat.aimX = facing;
        combat.targetX = player.x + facing * 500;
        const input = room.inputs.get(player.id);
        input.held.dx = facing;
        input.held.dy = 0;
        const startX = player.x;

        room.resolveSwing(
          player,
          combat,
          weapon,
          swingDescriptorFor(weapon, weapon.cooldown),
          0,
          undefined,
          step,
        );
        room.stepSim(0.05);

        expect(player.dualWield.attackMoveMode, id).toBe(PlayerAttackMoveMode.InputSlow);
        expect((player.x - startX) * facing, id).toBeGreaterThan(0);
        expect(player.y, id).toBe(1_500);
      }
    }
  });

  it("retains one B33 input-slow tick when a fast active envelope ages out on acceptance", () => {
    const { room, player, combat } = fixture("wing-sub-tick-slow");
    const weapon = WEAPONS["x2-wing-chun-wraps"]!;
    const step = meleeComboSelectionFor(weapon)?.sequence[0];
    if (!step) throw new Error("Missing Wing Chun sub-tick fixture");
    player.weapon = weapon.id;
    combat.lastWeapon = weapon.id;
    const input = room.inputs.get(player.id);
    input.held.dx = 1;

    room.resolveSwing(
      player,
      combat,
      weapon,
      swingDescriptorFor(weapon, weapon.cooldown),
      0,
      undefined,
      step,
    );
    room.stepMeleeSwings(0.05);
    room.stepSim(0.05);

    expect(player.dualWield.attackMoveMode).toBe(PlayerAttackMoveMode.InputSlow);
  });

  it("publishes watchdog-filtered held fire for Wyrmskull and drops it on release", () => {
    const { room, player } = fixture("wyrmskull-held-frame");
    const input = room.inputs.get(player.id);
    player.weapon = "x2-wyrmskull-reliquary";
    input.held.fireHeld = true;
    input.lastFreshFireTick = room.state.tick;

    room.stepSim(0.05);
    expect(player.dualWield.fireInputHeld).toBe(true);
    room.stepSim(0.05);
    expect(player.dualWield.fireInputHeld).toBe(true);
    room.stepSim(0.05);
    expect(player.dualWield.fireInputHeld).toBe(false);

    input.held.fireHeld = true;
    input.lastFreshFireTick = room.state.tick;
    room.stepSim(0.05);
    expect(player.dualWield.fireInputHeld).toBe(true);
    input.held.fireHeld = false;
    room.stepSim(0.05);
    expect(player.dualWield.fireInputHeld).toBe(false);
  });
});
