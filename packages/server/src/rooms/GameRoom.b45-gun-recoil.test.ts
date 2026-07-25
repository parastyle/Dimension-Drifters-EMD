import {
  BEAM_MIN_CHARGE_SECONDS,
  beltPlayableXBounds,
  PLAYER_RADIUS,
  TILE_GROUND,
  TILE_PIT,
  WEAPONS,
} from "@dd/shared";
import { describe, expect, it, vi } from "vitest";

const handlers = new Map<string, (client: { sessionId: string }, message: unknown) => void>();

vi.mock("colyseus", () => {
  class Room {
    state: unknown;
    clients: { sessionId: string }[] = [];
    roomId = "b45-gun-recoil-test";
    setState(state: unknown): void {
      this.state = state;
    }
    onMessage(
      type: string,
      handler: (client: { sessionId: string }, message: unknown) => void,
    ): void {
      handlers.set(type, handler);
    }
    setSimulationInterval(): void {}
    setPatchRate(): void {}
    broadcast(): void {}
    broadcastPatch(): void {}
  }
  return { Room, Client: class {} };
});

const { GameRoom } = await import("./GameRoom.js");

// biome-ignore lint/suspicious/noExplicitAny: focused authority tests inspect private fixed-step seams.
type AnyRoom = any;

function fixture(weaponId = "x-gun-revolver-cannon", belt = false) {
  handlers.clear();
  const room = new GameRoom() as AnyRoom;
  const client = { sessionId: "shooter" };
  room.clients = [client];
  room.onCreate(belt ? { belt: true, beltLevel: "corporate-grid" } : undefined);
  room.onJoin(client);
  room.map.pois.length = 0;
  room.map.tiles.fill(TILE_GROUND);
  room.spawnAccum = -1_000_000;
  room.shifterCd = 1_000_000;
  room.state.enemies.clear();
  const player = room.state.players.get(client.sessionId);
  const combat = room.combat.get(client.sessionId);
  player.x = 1_500;
  player.y = belt ? 1_320 : 1_500;
  player.weapon = weaponId;
  player.slots[player.activeSlot].weapon = weaponId;
  combat.lastGroundX = player.x;
  combat.lastGroundY = player.y;
  combat.aimX = 1;
  combat.aimY = 0;
  combat.targetX = player.x + 700;
  combat.targetY = player.y;
  return { room, client, player, combat };
}

function sendInput(
  room: AnyRoom,
  client: { sessionId: string },
  player: AnyRoom,
  seq: number,
  fireHeld: boolean,
  dx = 0,
) {
  const handler = handlers.get("input");
  if (!handler) throw new Error("input handler missing");
  handler(client, {
    seq,
    dx,
    dy: 0,
    jump: false,
    fireHeld,
    aimX: 1,
    aimY: 0,
    targetX: player.x + 700,
    targetY: player.y,
    clientX: player.x,
    clientY: player.y,
    clientMvx: 0,
    clientMvy: 0,
    clientVx: 0,
    clientVy: 0,
    clientServerMotionEpoch: player.dualWield.serverMotionEpoch,
    clientCorrectionSeq: player.dualWield.movementCorrectionSeq,
  });
  room.stepSim(0.05);
}

describe("GameRoom B45 physical gun recoil", () => {
  it.each([
    ["x-gun-revolver-cannon", 65],
    ["x-gun-coffin-shotgun", 161],
    ["x2-calamity-howitzer", 233],
  ] as const)("%s pushes exactly opposite aim by its authored impulse", (weaponId, recoil) => {
    const { room, player, combat } = fixture(weaponId);
    const weapon = WEAPONS[weaponId];
    if (!weapon?.gun) throw new Error(`missing gun fixture ${weaponId}`);
    combat.aimX = 3;
    combat.aimY = 4;
    combat.targetX = player.x + 300;
    combat.targetY = player.y + 400;

    room.fireGun(player, combat, weapon);

    expect(player.vx).toBeCloseTo((-3 / 5) * recoil, 8);
    expect(player.vy).toBeCloseTo((-4 / 5) * recoil, 8);
    expect(room.serverMotionSourceByPlayer.get(player.id)).toBe("weapon-fire-recoil");
    expect(player.dualWield.serverMotionActive).toBe(true);
  });

  it("classifies an airborne shot before B42 can reject the owner report", () => {
    const { room, client, player, combat } = fixture();
    const weapon = WEAPONS[player.weapon];
    if (!weapon?.gun) throw new Error("missing pistol fixture");
    player.height = 32;
    const before = {
      x: player.x,
      height: player.height,
      epoch: player.dualWield.serverMotionEpoch,
      correctionSeq: player.dualWield.movementCorrectionSeq,
    };

    room.fireGun(player, combat, weapon);
    expect(player.dualWield.serverMotionEpoch).toBe(before.epoch + 1);
    sendInput(room, client, player, 1, false);

    expect(player.x).toBeLessThan(before.x);
    expect(player.height).toBeGreaterThan(0);
    expect(player.dualWield.movementCorrectionSeq).toBe(before.correctionSeq);
    expect(room.serverMotionSourceByPlayer.get(player.id)).toBe("weapon-fire-recoil");
  });

  it("composes forward steering with recoil instead of replacing player input", () => {
    const passive = fixture();
    passive.room.applyWeaponFireRecoil(passive.player, 1, 0, 65);
    const passiveStart = passive.player.x;
    sendInput(passive.room, passive.client, passive.player, 1, false, 0);

    const leaning = fixture();
    leaning.room.applyWeaponFireRecoil(leaning.player, 1, 0, 65);
    const leaningStart = leaning.player.x;
    sendInput(leaning.room, leaning.client, leaning.player, 1, false, 1);

    expect(passive.player.x).toBeLessThan(passiveStart);
    expect(leaning.player.x).toBeGreaterThan(leaningStart);
    expect(leaning.player.x).toBeGreaterThan(passive.player.x);
  });

  it("alternates dual-gun muzzle hands but adds one small body impulse per shot", () => {
    const { room, player, combat } = fixture("x2-sidewinder-twin-rifles");
    const weapon = WEAPONS[player.weapon];
    if (!weapon?.gun) throw new Error("missing dual-gun fixture");
    player.attackSeq = 1;
    room.fireGun(player, combat, weapon);
    expect(player.vx).toBe(-25);
    player.attackSeq = 2;
    room.fireGun(player, combat, weapon);
    expect(player.vx).toBe(-50);

    const muzzleParts = [...room.state.projectiles.values()]
      .filter((projectile: AnyRoom) => projectile.sourceWeaponId === weapon.id)
      .map((projectile: AnyRoom) => projectile.sourceMuzzlePart);
    expect(muzzleParts).toEqual([0, 1]);
    expect(player.dualWield.serverMotionEpoch).toBe(1);
  });

  it("respects belt X bounds through the ordinary movement/nav clamp", () => {
    const { room, player } = fixture("x2-calamity-howitzer", true);
    const bounds = beltPlayableXBounds(room.beltLevel);
    const minX = bounds.minX + PLAYER_RADIUS;
    player.x = minX + 1;
    room.applyWeaponFireRecoil(player, 1, 0, 780);
    room.stepSim(0.05);
    expect(player.x).toBeGreaterThanOrEqual(minX);
  });

  it("can push a grounded shooter into a pit while the same airborne shot clears it", () => {
    const run = (airborne: boolean) => {
      const state = fixture("x2-calamity-howitzer");
      const tileSize = state.room.map.tileSize;
      const tileY = Math.floor(state.player.y / tileSize);
      const groundTileX = Math.floor(state.player.x / tileSize);
      const boundaryX = (groundTileX + 1) * tileSize;
      state.player.x = boundaryX - 5;
      state.combat.lastGroundX = state.player.x;
      state.combat.lastGroundY = state.player.y;
      state.room.map.tiles[tileY * state.room.map.cols + groundTileX + 1] = TILE_PIT;
      state.combat.aimX = -1;
      state.combat.aimY = 0;
      state.combat.targetX = state.player.x - 700;
      state.combat.targetY = state.player.y;
      if (airborne) state.player.height = 32;
      const fellBefore = state.player.fellSeq;
      const weapon = WEAPONS[state.player.weapon];
      if (!weapon?.gun) throw new Error("missing pit recoil fixture");
      state.room.fireGun(state.player, state.combat, weapon);
      state.room.stepSim(0.05);
      return { ...state, fellBefore, boundaryX };
    };

    const grounded = run(false);
    expect(grounded.player.fellSeq).toBe(grounded.fellBefore + 1);
    const airborne = run(true);
    expect(airborne.player.fellSeq).toBe(airborne.fellBefore);
    expect(airborne.player.x).toBeGreaterThan(airborne.boundaryX);
  });
});

describe("GameRoom B45 beam/caster boundary", () => {
  it("applies subtle classified pressure only after a ranged beam ignites", () => {
    const { room, client, player, combat } = fixture("x2-mirage-coilrifle");
    room.stepSim(0.05);
    const chargeTicks = Math.round(BEAM_MIN_CHARGE_SECONDS / 0.05);
    for (let seq = 1; seq <= chargeTicks; seq++) sendInput(room, client, player, seq, true);

    expect(combat.beamPhase).toBe(2);
    expect(player.vx).toBeLessThan(0);
    expect(Math.abs(player.vx)).toBeLessThan(10);
    expect(room.serverMotionSourceByPlayer.get(player.id)).toBe("weapon-fire-recoil");
  });

  it("keeps a caster beam planted under the B44 law", () => {
    const { room, client, player, combat } = fixture("x2-mesa-spine-thunder-stave");
    room.stepSim(0.05);
    const chargeTicks = Math.round(BEAM_MIN_CHARGE_SECONDS / 0.05);
    for (let seq = 1; seq <= chargeTicks; seq++) sendInput(room, client, player, seq, true);

    expect(combat.beamPhase).toBe(2);
    expect(player.vx).toBe(0);
    expect(player.vy).toBe(0);
    expect(player.dualWield.serverMotionEpoch).toBe(0);
  });
});
