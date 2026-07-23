import {
  BLADE_EXTENSION_WEAPON_IDS,
  BRUTALIST_GREATSWORD_IDS,
  bladeExtensionPoseAt,
  EnemyState,
  meleeComboSelectionFor,
  meleeDamageEnvelopeFor,
  meleeDamageReachAt,
  swingDescriptorFor,
  TILE_GROUND,
  WEAPONS,
} from "@dd/shared";
import { describe, expect, it, vi } from "vitest";

vi.mock("colyseus", () => {
  class Room {
    state: unknown;
    clients: { sessionId: string }[] = [];
    roomId = "v7-hit-test";
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

// biome-ignore lint/suspicious/noExplicitAny: authority regression intentionally reaches simulation seams.
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
  combat.targetX = 2_500;
  combat.targetY = 1_500;
  combat.aimX = 1;
  combat.aimY = 0;
  return { room, player, combat };
}

describe("GameRoom — V7-HIT blade-extension authority", () => {
  it("uses the visual combo step as the authoritative reveal clock for every brutalist blade", () => {
    for (const weaponId of BRUTALIST_GREATSWORD_IDS) {
      const { room, player, combat } = makeRoom(`v7-hit-combo-${weaponId}`);
      const weapon = WEAPONS[weaponId];
      const step = weapon && meleeComboSelectionFor(weapon)?.sequence[0];
      expect(weapon, weaponId).toBeDefined();
      expect(step, `${weaponId}/combo-step`).toBeDefined();
      if (!weapon || !step) continue;
      player.weapon = weapon.id;
      combat.lastWeapon = weapon.id;

      expect(room.resolveHandAttack(player, combat, 0), `${weaponId}/accepted`).toBe(true);
      const active = room.meleeSwings.get(player.id);
      expect(active, `${weaponId}/active-swing`).toBeDefined();
      if (!active) continue;
      expect(active.swing.activeStartSeconds, `${weaponId}/activeStart`).toBeCloseTo(
        step.timing.activeStart * active.swing.poseSeconds,
        8,
      );
      expect(active.swing.activeEndSeconds, `${weaponId}/activeEnd`).toBeCloseTo(
        step.timing.activeEnd * active.swing.poseSeconds,
        8,
      );
    }
  });

  it("hits along all three shared visual extension paths, including the rearward wheel", () => {
    const sampleFractions = [0.5, 0.75, 0.95] as const;
    for (const weaponId of BRUTALIST_GREATSWORD_IDS) {
      const weapon = WEAPONS[weaponId];
      const sequence = weapon && meleeComboSelectionFor(weapon)?.sequence;
      if (!weapon || !sequence) throw new Error(`Missing momentum fixture: ${weaponId}`);
      for (let stepIndex = 0; stepIndex < sequence.length; stepIndex++) {
        const step = sequence[stepIndex];
        if (!step) continue;
        const { room, player, combat } = makeRoom(`v7-hit-path-${weaponId}-${stepIndex}`);
        player.weapon = weapon.id;
        combat.lastWeapon = weapon.id;
        const base = swingDescriptorFor(weapon, weapon.cooldown);
        const swing = {
          ...base,
          activeStartSeconds: step.timing.activeStart * base.poseSeconds,
          activeEndSeconds: step.timing.activeEnd * base.poseSeconds,
          motion: step.motion,
        };
        const fraction = sampleFractions[stepIndex] ?? 0.5;
        const elapsed =
          swing.activeStartSeconds + (swing.activeEndSeconds - swing.activeStartSeconds) * fraction;
        const pose = bladeExtensionPoseAt(weapon, swing, elapsed, 0);
        if (!pose) throw new Error(`Missing shared extension pose: ${weaponId}/${step.motion}`);
        const reach = meleeDamageReachAt(weapon, swing, elapsed);
        expect(reach, `${weaponId}/${step.motion}/extended`).toBeGreaterThan(
          meleeDamageEnvelopeFor(weapon).baseReach,
        );
        const enemy = new EnemyState();
        enemy.id = `${weaponId}-${step.motion}-target`;
        enemy.kind = "dummy";
        enemy.x = player.x + Math.cos(pose.angle) * (reach - 2);
        enemy.y = player.y + Math.sin(pose.angle) * (reach - 2);
        enemy.hp = 10_000;
        room.state.enemies.set(enemy.id, enemy);
        room.rebuildEnemyGrid();

        room.resolveSwing(player, combat, weapon, base, 0, undefined, step);
        const active = room.meleeSwings.get(player.id);
        expect(active, `${weaponId}/${step.motion}/active`).toBeDefined();
        if (!active) continue;
        active.crit = 0;
        room.stepMeleeSwings(active.swing.activeEndSeconds + 0.001);
        expect(enemy.hp, `${weaponId}/${step.motion}/collision`).toBeLessThan(10_000);
      }
    }
  });

  it("deals unchanged edge damage at the visible 3x tip for all six brutalist blades", () => {
    for (const weaponId of BLADE_EXTENSION_WEAPON_IDS) {
      const { room, player, combat } = makeRoom(`v7-hit-${weaponId}`);
      const weapon = WEAPONS[weaponId];
      expect(weapon, weaponId).toBeDefined();
      if (!weapon) continue;
      player.weapon = weapon.id;
      combat.lastWeapon = weapon.id;
      const envelope = meleeDamageEnvelopeFor(weapon);
      expect(envelope.maxReach, `${weaponId}/extension`).toBeGreaterThan(envelope.baseReach * 2.7);

      const enemy = new EnemyState();
      enemy.id = `${weaponId}-tip-target`;
      enemy.kind = "dummy";
      enemy.x = player.x + envelope.maxReach - 2;
      enemy.y = player.y;
      enemy.hp = 10_000;
      room.state.enemies.set(enemy.id, enemy);
      room.rebuildEnemyGrid();
      const swing = swingDescriptorFor(weapon, weapon.cooldown);

      room.resolveSwing(player, combat, weapon, swing);
      const active = room.meleeSwings.get(player.id);
      expect(active?.range, `${weaponId}/serverReach`).toBeCloseTo(envelope.maxReach, 8);
      expect(active?.halfWidth, `${weaponId}/serverHalfWidth`).toBeCloseTo(
        envelope.maxHalfWidth,
        8,
      );
      active.crit = 0;
      const expectedDamage = active.edgeDamage;
      room.stepMeleeSwings(swing.activeEndSeconds + 0.001);

      expect(10_000 - enemy.hp, `${weaponId}/sameDamage`).toBeCloseTo(expectedDamage, 8);
    }
  });

  it("keeps Sanctified Headsman damage inside its ordinary blade envelope", () => {
    const { room, player, combat } = makeRoom("b10-headsman-normal-envelope");
    const weapon = WEAPONS["x2-sanctified-headsman"];
    if (!weapon) throw new Error("Missing Sanctified Headsman fixture");
    player.weapon = weapon.id;
    combat.lastWeapon = weapon.id;
    const envelope = meleeDamageEnvelopeFor(weapon);
    expect(envelope.maxReach).toBe(envelope.baseReach);

    const inside = new EnemyState();
    inside.id = "b10-headsman-inside";
    inside.kind = "dummy";
    inside.x = player.x + envelope.maxReach - 2;
    inside.y = player.y;
    inside.hp = 10_000;
    room.state.enemies.set(inside.id, inside);

    const oldExtensionOnly = new EnemyState();
    oldExtensionOnly.id = "b10-headsman-old-extension-only";
    oldExtensionOnly.kind = "dummy";
    oldExtensionOnly.x = player.x + envelope.maxReach * 2;
    oldExtensionOnly.y = player.y;
    oldExtensionOnly.hp = 10_000;
    room.state.enemies.set(oldExtensionOnly.id, oldExtensionOnly);
    room.rebuildEnemyGrid();

    const swing = swingDescriptorFor(weapon, weapon.cooldown);
    room.resolveSwing(player, combat, weapon, swing);
    const active = room.meleeSwings.get(player.id);
    expect(active?.range).toBe(envelope.baseReach);
    if (!active) throw new Error("Missing active Headsman swing");
    active.crit = 0;
    room.stepMeleeSwings(swing.activeEndSeconds + 0.001);

    expect(inside.hp).toBeLessThan(10_000);
    expect(oldExtensionOnly.hp).toBe(10_000);
  });
});
