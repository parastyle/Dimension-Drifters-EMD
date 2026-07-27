import {
  ACTION_MSGS_PER_TICK,
  AUGMENTS,
  BELT_LEVEL_IDS,
  BELT_Y0,
  beltLevelFor,
  beltPitAtX,
  ChestState,
  CORPORATE_ELEVATOR_COUNTDOWN_TICKS,
  CORPORATE_ELEVATOR_DEPART_TICKS,
  CORPORATE_ELEVATOR_PHASE,
  corporateGridFloorForBelt,
  CRIT_MULT,
  clampBeltFloorY,
  critChanceFor,
  DEFAULT_WEAPON,
  DEPTH_MAX,
  DIMENSIONS,
  DUMMY_HP,
  draftAugments,
  ENEMY_KINDS,
  EnemyState,
  FISTS_WEAPON,
  getDimension,
  isPitAtPx,
  MAX_ENEMIES,
  META_VITALITY_HP,
  MoneyDropState,
  makeRng,
  PARRY_CHAIN_RIPOSTE_AT,
  PARRY_GUARD_RESET_TICKS,
  PARRY_IFRAMES,
  PARRY_LAUNCH,
  ParryReaction,
  PIT_FALL_DAMAGE_FRAC,
  PickupState,
  PLAYER_MAX_HP,
  PLAYER_REGEN,
  REVIVE_HP_FRAC,
  SET_BONUS_2,
  SET_BONUS_3,
  SHIFTER_KIND_IDS,
  DISASSEMBLY_HOLD_TICKS,
  weaponDisassemblyValue,
  swingDescriptorFor,
  TILE_GROUND,
  TILE_PIT,
  unpackParryGuardPose,
  unpackParryReaction,
  WEAPON_IDS,
  WEAPONS,
  weaponEffectEmitterPoint,
  weaponSetBonus,
  ZONE_RADIUS,
  ZONE_TTL,
  ZoneState,
} from "@dd/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The authoritative 20Hz tick (GameRoom) had ZERO tests (audit cluster ②) — only live co-op exercised the
// boss phases / rez / wipe / melee integration. This harness stubs the Colyseus `Room` base so we can
// `new GameRoom()`, register handlers, join fake clients, drive `update(dt)` ticks, and assert the state.
vi.mock("colyseus", () => {
  class Room {
    state: unknown;
    clients: { sessionId: string }[] = [];
    roomId = "test";
    setState(s: unknown) {
      this.state = s;
    }
    onMessage() {}
    setSimulationInterval() {}
    setPatchRate() {}
    broadcast() {}
    broadcastPatch() {}
  }
  return { Room, Client: class {} };
});

// Imported AFTER the mock so GameRoom extends the stub Room.
const { GameRoom } = await import("./GameRoom.js");

// biome-ignore lint/suspicious/noExplicitAny: the harness reaches private room internals (update/combat) on purpose.
type AnyRoom = any;

// Determinism (audit-qa RNG-parity): pin Math.random per test so cross-file suite ordering cannot shift
// the global stream and flip position-sensitive spatial/combat assertions (this file's map-gen + spawn +
// nav + spread all draw from Math.random). Tests needing a specific roll still override this with their
// own vi.spyOn (installed later, so it wins); tolerant tests are unaffected. afterEach restores the spy.
beforeEach(() => {
  const detRng = makeRng(0x9e3779b9);
  vi.spyOn(Math, "random").mockImplementation(() => detRng.next());
});
afterEach(() => {
  vi.restoreAllMocks();
});

function makeRoom(options?: {
  dimensionId?: string;
  bossRush?: boolean;
  belt?: boolean;
  beltLevel?: string;
}) {
  const room = new GameRoom() as AnyRoom;
  const handlers = new Map<string, (c: { sessionId: string }, m?: unknown) => void>();
  room.onMessage = (type: string, fn: (c: { sessionId: string }, m?: unknown) => void) =>
    handlers.set(type, fn);
  room.clients = [];
  room.roomId = "test";
  room.onCreate(options);
  return {
    room,
    state: () => room.state,
    join(sessionId: string) {
      room.clients.push({ sessionId });
      room.onJoin({ sessionId });
    },
    send(sessionId: string, type: string, msg?: unknown) {
      handlers.get(type)?.({ sessionId }, msg);
    },
    tick(times = 1, dtMs = 50) {
      for (let i = 0; i < times; i++) room.update(dtMs);
    },
  };
}

// Re-seed nothing between files — each makeRoom() is independent.
beforeEach(() => {});

const { BOSS_PROJECTILE_BUDGET: HOSTILE_PROJECTILE_CEILING } = await import("@dd/shared");

// B20 L2: chests reuse L1's bounded money collectible rail; kills no longer produce it.
const MONEY_PANEL = await import("@dd/shared");

// SYNCED ATTACK BEAT — appended-only server/shared contract tests. The constant is loaded here instead of
// editing the established import block so this file's historical tests remain byte-for-byte untouched.
const { ATTACK_HELD_WINDOW: ATTACK_HELD_WINDOW_TICKS } = await import("@dd/shared");

// BEAM PANEL REGRESSIONS — appended-only authoritative channel coverage.
const {
  BEAM_MIN_CHARGE_SECONDS: BEAM_CHARGE_SECONDS,
  BEAM_OVERHEAT_LOCK_SECONDS: BEAM_LOCK_SECONDS,
  DRIVE_BEAM_RESTART_THRESHOLD: BEAM_RESTART_DRIVE,
  BeamPhase: SyncedBeamPhase,
} = await import("@dd/shared");

const TEST_BEAM_WEAPON = "x2-mesa-spine-thunder-stave";

function makeBeamRoom(sessionId: string) {
  const h = makeRoom();
  h.join(sessionId);
  const player = h.state().players.get(sessionId);
  player.x = h.room.map.spawnX;
  player.y = h.room.map.spawnY;
  player.weapon = TEST_BEAM_WEAPON;
  h.tick(1); // settle the swap before the first held edge
  return { h, player, combat: h.room.combat.get(sessionId) };
}

function putBeamDummy(
  h: ReturnType<typeof makeRoom>,
  player: { x: number; y: number },
  id = "beam-dummy",
) {
  const enemy = new EnemyState();
  enemy.id = id;
  enemy.kind = "dummy";
  enemy.hp = 100_000;
  enemy.x = player.x + 180;
  enemy.y = player.y;
  h.state().enemies.set(id, enemy);
  return enemy;
}

function sendBeamFrame(
  h: ReturnType<typeof makeRoom>,
  sessionId: string,
  seq: number,
  fireHeld: boolean,
) {
  const player = h.state().players.get(sessionId);
  h.send(sessionId, "input", {
    seq,
    dx: 0,
    dy: 0,
    jump: false,
    fireHeld,
    aimX: 1,
    aimY: 0,
    targetX: player.x + 500,
    targetY: player.y,
  });
  h.tick(1);
}

// Wave 1 append-only coverage: the room owns one compatibility root and routes combat through the
// dedicated, fixed-cap worm collection instead of manufacturing ordinary EnemyState segment rows.
const wormRoomShared = await import("@dd/shared");

function makeSerrakethRoom() {
  const h = makeRoom();
  h.join("worm-host");
  h.send("worm-host", "spawnBossDef", { kind: "seam-eater" });
  const runtime = h.room.bossController?.wormRuntime;
  const root = h.state().enemies.get(h.room.bossId);
  expect(runtime).toBeDefined();
  expect(root).toBeDefined();
  return { h, runtime, root };
}

// §51 WAVE 1 — tough-enemy combo authority. APPENDED ONLY: these drive the same room/tick harness as the
// historical suite and pin the panel's tick edges, geometry promises, physics caps, and duel-token law.
const enemyComboShared = await import("@dd/shared");

function makeEnemyComboRoom(depth = 1) {
  const h = makeRoom();
  h.join("combo-victim");
  h.room.map.tiles.fill(TILE_GROUND); // map-RNG law: every pinned combo position is known solid ground
  h.room.spawnAccum = -1_000_000;
  h.room.shifterCd = 1_000_000;
  h.state().depth = depth;
  const player = h.state().players.get("combo-victim");
  player.x = h.room.map.spawnX;
  player.y = h.room.map.spawnY;
  player.hp = player.maxHp;
  return { h, player, combat: h.room.combat.get(player.id) };
}

function addComboEnemy(
  h: ReturnType<typeof makeRoom>,
  player: { x: number; y: number },
  id: string,
  kind = "ronin",
  dx = 120,
) {
  const enemy = new EnemyState();
  enemy.id = id;
  enemy.kind = kind;
  enemy.tough = true;
  enemy.hp = 100_000;
  enemy.x = player.x + dx;
  enemy.y = player.y;
  h.state().enemies.set(id, enemy);
  return enemy;
}

function forceComboStart(
  h: ReturnType<typeof makeRoom>,
  enemy: InstanceType<typeof EnemyState>,
  player: AnyRoom,
  roll: number,
) {
  const st = { phase: "idle", t: 0, hits: 0, wind: 0 };
  h.room.comboState.set(enemy.id, st);
  const random = vi.spyOn(Math, "random").mockReturnValue(roll);
  try {
    h.room.commitCombo(enemy, enemy.id, ENEMY_KINDS[enemy.kind], st, player, false);
  } finally {
    random.mockRestore();
  }
  return st as AnyRoom;
}

function pinVictimInFront(player: AnyRoom, enemy: AnyRoom) {
  player.x = enemy.x - 60;
  player.y = enemy.y;
  player.vx = 0;
  player.vy = 0;
  player.mvx = 0;
  player.mvy = 0;
}

function pinVictimAbove(player: AnyRoom, enemy: AnyRoom) {
  player.x = enemy.x;
  player.y = enemy.y - 60;
  player.vx = 0;
  player.vy = 0;
  player.mvx = 0;
  player.mvy = 0;
}

function herePlayerJuggledDefault() {
  const h = makeEnemyComboRoom();
  return h.player.juggledSeq;
}

// Jump-feel J1 — appended authoritative fixtures. Every pinned position starts from an all-ground map;
// individual tests then author only the pit geometry they need.
function makeJumpFeelRoom(id = "jump-feel") {
  const h = makeRoom();
  h.join(id);
  h.room.map.tiles.fill(TILE_GROUND);
  h.room.spawnAccum = -1_000_000;
  h.room.shifterCd = 1_000_000;
  const player = h.state().players.get(id);
  player.x = h.room.map.spawnX;
  player.y = h.room.map.spawnY;
  player.hp = player.maxHp;
  const combat = h.room.combat.get(id);
  combat.lastGroundX = player.x;
  combat.lastGroundY = player.y;
  return { h, player, combat };
}

function sendJumpFeelInput(
  h: ReturnType<typeof makeRoom>,
  id: string,
  seq: number,
  fields: {
    dx?: number;
    dy?: number;
    jump?: boolean;
    crouchHeld?: boolean;
    pound?: boolean;
    fireHeld?: boolean;
  } = {},
) {
  h.send(id, "input", {
    seq,
    dx: fields.dx ?? 0,
    dy: fields.dy ?? 0,
    jump: fields.jump ?? false,
    crouchHeld: fields.crouchHeld ?? false,
    pound: fields.pound ?? false,
    fireHeld: fields.fireHeld ?? false,
    aimX: 1,
    aimY: 0,
    targetX: 0,
    targetY: 0,
  });
  h.tick(1);
}

function addJumpDummy(
  h: ReturnType<typeof makeRoom>,
  id: string,
  x: number,
  y: number,
  hp = 1_000,
) {
  const enemy = new EnemyState();
  enemy.id = id;
  enemy.kind = "dummy";
  enemy.hp = hp;
  enemy.x = x;
  enemy.y = y;
  h.state().enemies.set(id, enemy);
  return enemy;
}

// Wave 23 — the Megabonk slide consumes 21b's contact-only dodge budget. Every spatial fixture starts
// on the cleared spawn disc/all-ground map so map generation cannot decide whether an authored hit connects.
// V7-MOVE — fixed tumble roll. Compatibility wire names remain `slide*`; behavior is one roll sentence.
function sendRollInput(
  h: ReturnType<typeof makeRoom>,
  id: string,
  seq: number,
  fields: {
    dx?: number;
    dy?: number;
    roll?: boolean;
    jump?: boolean;
    pound?: boolean;
    fireHeld?: boolean;
  } = {},
) {
  h.send(id, "input", {
    seq,
    dx: fields.dx ?? 0,
    dy: fields.dy ?? 0,
    jump: fields.jump ?? false,
    crouchHeld: false,
    pound: fields.pound ?? false,
    slide: fields.roll ?? false,
    slideHeld: fields.roll ?? false,
    fireHeld: fields.fireHeld ?? false,
    aimX: 1,
    aimY: 0,
    targetX: 0,
    targetY: 0,
  });
  h.tick(1);
}

function makeRollRoom(id = "roll-player") {
  const fixture = makeJumpFeelRoom(id);
  return { ...fixture, combatInput: fixture.h.room.inputs.get(id) };
}

function beginRoll(fixture: ReturnType<typeof makeRollRoom>, seq = 1, dx = 1, dy = 0) {
  sendRollInput(fixture.h, fixture.player.id, seq, { dx, dy, roll: true });
  expect(fixture.combat.stance).toBe(enemyComboShared.STANCE_SLIDE);
  expect(fixture.combat.slidePhase).toBe(enemyComboShared.SLIDE_PHASE_GROUND);
}

function addRollMeleeEnemy(fixture: ReturnType<typeof makeRollRoom>, id: string) {
  const enemy = addJumpDummy(fixture.h, id, fixture.player.x - 40, fixture.player.y, 1_000);
  enemy.kind = "vault-ronin";
  return enemy;
}

// ULT U1 — appended server-core coverage. Positions are pinned on an all-ground arena so map RNG cannot
// change target order, swept-capsule contacts, or nav-valid endpoint assertions.
function makeUltimateRoom(
  family: number,
  variant: "str" | "dex" | "int" | "con" | "luk",
  id = "ult-player",
) {
  const h = makeRoom();
  h.join(id);
  h.room.map.tiles.fill(TILE_GROUND);
  h.room.spawnAccum = -999;
  const player = h.state().players.get(id);
  player.x = 1000;
  player.y = 1000;
  const combat = h.room.combat.get(id);
  player.ultFamily = family;
  player.ultVariant = variant;
  player.ultArchetype = enemyComboShared.ultimateCodeFor(family, variant);
  combat.ultChargeF = 1;
  player.ultCharge = 100;
  return { h, id, player, combat };
}

function addUltimateEnemy(
  h: ReturnType<typeof makeRoom>,
  id: string,
  x: number,
  y: number,
  hp = 1000,
  kind = "boothill",
) {
  const enemy = new EnemyState();
  enemy.id = id;
  enemy.kind = kind;
  enemy.x = x;
  enemy.y = y;
  enemy.hp = hp;
  h.state().enemies.set(id, enemy);
  h.room.insertEnemyGrid(id, enemy);
  return enemy;
}

// Pet P1 — appended server authority, bonus-seam, G-01, lifecycle, and settlement coverage.
function joinPet(
  h: ReturnType<typeof makeRoom>,
  id: string,
  petId: (typeof enemyComboShared.PET_IDS)[number],
  bondXp = 0,
  configure?: (account: ReturnType<typeof enemyComboShared.createMetaAccountV2>) => void,
) {
  const account = enemyComboShared.createMetaAccountV2();
  account.pets[petId] = { bondXp };
  account.selectedPetId = petId;
  configure?.(account);
  const client = { sessionId: id };
  h.room.clients.push(client);
  h.room.onJoin(client, { metaAccount: account, selectedPetId: petId });
  return {
    player: h.state().players.get(id),
    combat: h.room.combat.get(id),
    pet: h.room.petRuns.get(id),
    account: h.room.metaAccounts.get(id),
  };
}

function joinGearAccount(
  h: ReturnType<typeof makeRoom>,
  id: string,
  configure: (account: ReturnType<typeof enemyComboShared.createMetaAccountV4>) => void,
  selectedCharacterId?: unknown,
) {
  const messages: Array<{ type: string; payload: unknown }> = [];
  const account = enemyComboShared.createMetaAccountV4();
  configure(account);
  const client = {
    sessionId: id,
    send: (type: string, payload: unknown) => messages.push({ type, payload }),
  };
  h.room.clients.push(client);
  h.room.onJoin(client, { metaAccount: account, selectedCharacterId });
  return {
    messages,
    player: h.state().players.get(id),
    combat: h.room.combat.get(id),
    gear: h.room.gearRuns.get(id),
    account: h.room.metaAccounts.get(id),
  };
}

function equipGearSet(
  account: ReturnType<typeof enemyComboShared.createMetaAccountV4>,
  setId: string,
) {
  for (const slot of enemyComboShared.GEAR_SLOTS) {
    const suffix = slot === "facialHair" ? "facial-hair" : slot === "torso" ? "shirt" : slot;
    const id = `${setId}-${suffix}`;
    if (!enemyComboShared.isGearId(id)) throw new Error(`missing gear fixture ${id}`);
    account.ownedGear.push(id);
    account.equippedGear[slot] = id;
  }
}

// METAGAME WAVE 2 — append-only server escrow/materialization/outcome coverage.
const roomBankId = (n: number) => `wi_${n.toString(36).padStart(22, "0")}`;
const roomBankInstance = (
  n: number,
  weaponId: string,
  rarity: import("@dd/shared").WeaponRarityId = "common",
  affix: import("@dd/shared").WeaponAffixId = "",
): import("@dd/shared").WeaponInstanceV1 => ({
  instanceId: roomBankId(n),
  weaponId,
  rarity,
  affix,
  provenance: "enemy-drop",
  sourceWorldTier: 0,
});
const roomBankSingle = (
  n: number,
  weaponId = "rusty-cleaver",
): import("@dd/shared").SingleWeaponEntryV1 => {
  const weapon = roomBankInstance(n, weaponId);
  return { kind: "single", entryId: weapon.instanceId, weapon };
};
function joinWeaponAccount(
  h: ReturnType<typeof makeRoom>,
  id: string,
  entries: import("@dd/shared").WeaponBankEntryV1[],
  placements: import("@dd/shared").CarryPlacementV1[],
  activeEntryId = "",
) {
  const messages: Array<{ type: string; payload: unknown }> = [];
  const client = {
    sessionId: id,
    send: (type: string, payload: unknown) => messages.push({ type, payload }),
  };
  const account = enemyComboShared.createMetaAccountV4();
  account.weaponBank.stash.push(...entries);
  h.room.clients.push(client);
  h.room.onJoin(client, {
    metaAccount: account,
    carry: {
      requestId: `carry-${id}`,
      expectedRevision: account.revision,
      placements,
      activeEntryId,
      requestedWorldTier: 0,
    },
  });
  return {
    client,
    messages,
    player: h.state().players.get(id),
    account: h.room.metaAccounts.get(id) as import("@dd/shared").MetaAccountV4,
  };
}


describe("GameRoom - Serraketh authoritative integration", () => {
  it("spawns through spawnBossDef and routes a radius hit to the addressed segment only", () => {
    const { h, runtime, root } = makeSerrakethRoom();
    expect(h.state().bossKind).toBe("seam-eater");
    expect(h.state().wormBoss.active).toBe(true);
    expect(h.state().wormBoss.ownerId).toBe(root.id);
    expect(h.state().enemies.size).toBe(1);

    const rootHp = root.hp;
    const neighborHp = runtime.localHp[3];
    h.room.detonate(runtime.x[2], runtime.y[2], 0, 80, 0);

    expect(runtime.active[2]).toBe(0);
    expect(runtime.condition[2]).toBe(wormRoomShared.WormSegmentCondition.Destroyed);
    expect(runtime.localHp[3]).toBe(neighborHp);
    expect(root.hp).toBe(rootHp - 80);
    expect(h.state().enemies.has(root.id)).toBe(true);
    expect(h.state().moneyDrops.size).toBe(0);
  });

  it("holds twelve live parts in twelve fixed wire rows without spending twelve enemy rows", () => {
    const { h, runtime } = makeSerrakethRoom();
    expect(runtime.beginRegrow(1, 1)).toBe(2);
    expect(runtime.effectiveBodyCount).toBe(wormRoomShared.WORM_MAX_SEGMENTS);
    expect(runtime.resolveRegrow(111)).toBe(2);

    const state = h.state();
    expect(state.wormBoss.segments.length).toBe(wormRoomShared.WORM_MAX_SEGMENTS);
    expect(state.wormBoss.activeMask).toBe((1 << wormRoomShared.WORM_MAX_SEGMENTS) - 1);
    expect(state.enemies.size).toBe(1);
    expect(h.room.effectiveEnemyBodies()).toBe(wormRoomShared.WORM_MAX_SEGMENTS);
    expect(state.enemies.size + state.wormBoss.segments.length).toBeLessThanOrEqual(
      wormRoomShared.WORM_MAX_SEGMENTS + 1,
    );
  });

  it("retires anatomy and terminal-core money while preserving the terminal portal", () => {
    const { h, runtime, root } = makeSerrakethRoom();
    h.room.detonate(runtime.x[2], runtime.y[2], 0, 80, 0);
    expect(h.state().moneyDrops.size).toBe(0);

    const kills: string[] = [];
    h.room.damageWormSlots([0], root.hp * 4, "test:finale", kills, 0, false);
    for (const id of kills) h.state().enemies.delete(id);

    expect(h.state().moneyDrops.size).toBe(0);
    expect(h.state().wormBoss.active).toBe(false);
    expect(h.state().portalOpen).toBe(true);
  });
});

describe("GameRoom — §51 tough-enemy melee combos (Wave 1 authority)", () => {
  it("negotiates 143px ahead of the slow facing anchor, then never moves the marker or landing", () => {
    const { h, player } = makeEnemyComboRoom(1);
    const enemy = addComboEnemy(h, player, "combo-leaper", "vault-ronin", 300);
    player.aimDir = Math.PI; // live mouse aim points LEFT; approach bearing/facing is RIGHT by law

    h.tick(1); // idle → leapwind: marker exists from the decision tick
    const st = h.room.comboState.get(enemy.id);
    const row = h.state().telegraphs.get(st.tg);
    expect(st.phase).toBe("leapwind");
    expect(row.danger).toBe(0); // white duel offer, never the legacy red assault marker
    expect(row.x - player.x).toBeCloseTo(143, 6);
    expect(row.y).toBeCloseTo(player.y, 6);
    expect(enemy.comboSeq).toBe(0); // marker decision is not a documented wire edge
    const promisedX = row.x;
    const promisedY = row.y;

    player.aimDir = 0;
    player.x += 5; // legal post-marker movement inside the footprint cannot renegotiate the promise
    h.tick(6); // exact 0.30s offer → liftoff
    expect(enemy.comboSeq).toBe(1);
    expect(enemy.comboFlags & enemyComboShared.COMBO_FLAG_AIRBORNE).toBeTruthy();
    expect(h.state().telegraphs.get(st.tg).x).toBe(promisedX);
    expect(h.state().telegraphs.get(st.tg).y).toBe(promisedY);

    h.tick(7); // exact fixed 0.35s arc
    expect(enemy.x).toBeCloseTo(promisedX, 6);
    expect(enemy.y).toBeCloseTo(promisedY, 6);
    expect(enemy.comboFlags & enemyComboShared.COMBO_FLAG_AIRBORNE).toBe(0);
    expect(h.state().telegraphs.has(st.tg ?? "")).toBe(false);
    expect(enemy.comboSeq).toBe(1); // no strike Lock has happened yet
  });

  it("gives every tough-combo beat the same four-tick locked commit window", () => {
    const { h, player } = makeEnemyComboRoom(1);
    const enemy = addComboEnemy(h, player, "combo-lock", "ronin", 140);
    h.tick(1); // grounded K1 begins

    const commitBefore = enemy.commitSeq;
    for (let i = 0; i < 16 && enemy.commitSeq === commitBefore; i++) h.tick(1);
    expect(enemy.commitSeq).toBe(commitBefore + 1);
    expect(enemy.comboSeq).toBe(1);
    const st = h.room.comboState.get(enemy.id);
    expect(st.phase).toBe("commit");
    const frozen = { ...st.strike };
    const hp = player.hp;
    player.x -= 260;
    player.y += 110;

    h.tick(1);
    expect(st.strike).toEqual(frozen);
    expect(h.state().telegraphs.size).toBe(0);
    const attack = enemy.atkSeq;
    h.tick(2);
    expect(enemy.atkSeq).toBe(attack);
    h.tick(1);
    expect(enemy.atkSeq).toBe(attack + 1);
    expect(player.hp).toBeLessThan(hp);
    expect(enemy.x).toBeCloseTo(frozen.endX, 6);
    expect(enemy.y).toBeCloseTo(frozen.endY, 6);
    expect(enemy.comboSeq).toBe(1);
  });

  it("holds a parried bait at its displaced point for 8 ticks, returns bounded, and loses to parry two", () => {
    const { h, player, combat } = makeEnemyComboRoom(3);
    const enemy = addComboEnemy(h, player, "combo-bait", "ronin", 120);
    const random = vi.spyOn(Math, "random").mockReturnValue(0.9); // K3 advanced 40% partition
    try {
      h.tick(1);
    } finally {
      random.mockRestore();
    }
    const st = h.room.comboState.get(enemy.id);
    expect(st.comboId).toBe("k3-gale-cross");
    combat.invuln = 1;
    for (let i = 0; i < 20 && st.phase !== "return"; i++) h.tick(1);
    expect(st.phase).toBe("return");
    expect(st.returnsLeft).toBe(0);
    expect(enemy.comboSeq).toBe(2); // bait pop + directional return-start reaction
    expect(enemy.comboFlags & enemyComboShared.COMBO_FLAG_EMPOWERED).toBeTruthy();

    const recoil0 = enemy.x;
    h.tick(1);
    const recoil1 = enemy.x;
    h.tick(1);
    const displaced = enemy.x;
    expect(Math.abs(recoil1 - recoil0)).toBeLessThanOrEqual(90.000001);
    expect(Math.abs(displaced - recoil1)).toBeLessThanOrEqual(90.000001);
    expect(Math.abs(displaced - recoil0)).toBeGreaterThan(100);
    expect(st.displacedX).toBeCloseTo(displaced, 6);
    const returnStart = st.stepStartTick;

    h.tick(7);
    expect(enemy.x).toBeCloseTo(displaced, 6);
    expect(h.state().telegraphs.size).toBe(0);
    h.tick(1);
    expect((h.state().tick - returnStart) >>> 0).toBeGreaterThanOrEqual(8);
    expect(enemy.x).toBeCloseTo(displaced, 6);

    const returnCommit = enemy.commitSeq;
    for (let i = 0; i < 24 && enemy.commitSeq === returnCommit; i++) h.tick(1);
    expect(enemy.commitSeq).toBe(returnCommit + 1);
    expect(st.phase).toBe("commit");
    expect(enemy.x).toBeCloseTo(displaced, 6); // path-plan origin is the post-knockback position
    player.vx = 0;
    player.vy = 0;
    combat.invuln = 1;
    const attack = enemy.atkSeq;
    for (let i = 0; i < 20 && enemy.atkSeq === attack; i++) {
      h.tick(1);
    }
    expect(enemy.atkSeq).toBe(attack + 1);
    expect(player.parriedSeq).toBe(2);
    expect(st.phase).toBe("recover");
    expect(enemy.comboFlags).toBe(0);
    expect(enemy.comboSeq).toBe(3); // bait pop, return-start reaction, and return pop
  });

  it("launches and air-keeps at most twice, caps damage/control, and grants touchdown mercy", () => {
    const { h, player, combat } = makeEnemyComboRoom(5);
    const enemy = addComboEnemy(h, player, "combo-juggle", "vault-ronin", 120);
    const st = forceComboStart(h, enemy, player, 0.9); // K4 Sky Hook, without re-testing its leap opener
    expect(st.comboId).toBe("k4-sky-hook");
    const hp = player.hp;

    for (let i = 0; i < 20 && player.juggledSeq === 0; i++) {
      pinVictimInFront(player, enemy);
      h.tick(1);
    }
    expect(player.juggledSeq).toBe(1);
    expect(player.vh).toBe(enemyComboShared.JUGGLE_LAUNCH_VH);
    expect(combat.vh).toBe(enemyComboShared.JUGGLE_LAUNCH_VH);
    const launchTick = st.launchTick;

    for (let i = 0; i < 40 && player.juggledSeq < 3; i++) {
      pinVictimInFront(player, enemy);
      h.tick(1);
    }
    expect(player.juggledSeq).toBe(3); // launcher + exactly two air hits
    expect(st.juggleHits).toBe(enemyComboShared.JUGGLE_MAX_AIR_HITS);
    expect(enemy.comboSeq).toBe(3); // each of the three strike Locks, no extra churn
    expect(st.phase).toBe("recover");
    expect(enemy.comboFlags).toBe(0);
    expect(hp - player.hp).toBeLessThanOrEqual(
      player.maxHp * enemyComboShared.COMBO_DAMAGE_CAP_FRAC,
    );

    for (let i = 0; i < 40 && player.height > 0; i++) h.tick(1);
    expect(player.height).toBe(0);
    expect(((h.state().tick - launchTick) >>> 0) * 0.05).toBeLessThanOrEqual(
      enemyComboShared.JUGGLE_MAX_CONTROL_SECONDS,
    );
    expect(combat.juggleMercy).toBeGreaterThan(0);
  });

  it("lets an airborne parry ride upward and immediately breaks the remaining juggle string", () => {
    const { h, player, combat } = makeEnemyComboRoom(5);
    const enemy = addComboEnemy(h, player, "combo-air-parry", "vault-ronin", 120);
    enemy.x = player.x;
    enemy.y = player.y + 120;
    const st = forceComboStart(h, enemy, player, 0.9);
    for (let i = 0; i < 20 && player.juggledSeq === 0; i++) {
      pinVictimAbove(player, enemy);
      h.tick(1);
    }
    expect(player.height).toBeGreaterThanOrEqual(0);
    combat.invuln = 1;
    for (let i = 0; i < 20 && st.phase !== "recover"; i++) {
      pinVictimAbove(player, enemy);
      h.tick(1);
    }
    expect(player.parriedSeq).toBe(1);
    expect(player.juggledSeq).toBe(1); // the air-keep was negated, so no second juggle edge
    expect(player.vh).toBeGreaterThan(0); // existing PARRY_LAUNCH converts their string into the player's ride
    expect(st.phase).toBe("recover");
    expect(h.room.duelTokens.has(player.id)).toBe(false);
    expect(enemy.comboFlags).toBe(0);
  });

  it("serializes two tough attackers through one victim duel/aerial token", () => {
    const { h, player } = makeEnemyComboRoom(1);
    const first = addComboEnemy(h, player, "combo-token-a", "ronin", 120);
    const second = addComboEnemy(h, player, "combo-token-b", "ronin", -120);
    h.tick(1);
    const a = h.room.comboState.get(first.id);
    const b = h.room.comboState.get(second.id);
    expect(h.room.duelTokens.size).toBe(1);
    expect(h.room.duelTokens.get(player.id)).toBe(first.id);
    expect(a.comboId).toBe("k1-sanren");
    expect(b.comboId ?? "").toBe("");
    expect(b.phase).toBe("idle");
  });

  it("ships schema 19, named depth decks, and guardrail-safe authored literals", () => {
    expect(enemyComboShared.SCHEMA_VERSION).toBe(49);
    expect(new EnemyState().comboSeq).toBe(0);
    expect(new EnemyState().comboFlags).toBe(0);
    expect(herePlayerJuggledDefault()).toBe(0);
    expect(ENEMY_KINDS.ronin?.combos).toContainEqual({ combo: "k3-gale-cross", minDepth: 3 });
    expect(ENEMY_KINDS["vault-ronin"]?.combos).toContainEqual({
      combo: "k4-sky-hook",
      minDepth: 5,
    });
    expect(ENEMY_KINDS["shifter-cinder-marshal"]?.combos).toEqual([
      { combo: "k1-sanren", minDepth: 1 },
    ]);
    expect(ENEMY_KINDS["shifter-grave-warden"]?.combos).toContainEqual({
      combo: "h4-coffin-lid",
      minDepth: 6,
    });
    for (const def of Object.values(enemyComboShared.TOUGH_COMBOS)) {
      expect(def.frontOffset).toBeGreaterThanOrEqual(143);
      expect(def.frontOffset).toBeLessThanOrEqual(156);
      expect(def.steps.filter((step) => step.kind === "airkeep").length).toBeLessThanOrEqual(2);
      for (const step of def.steps) {
        expect(step.windupTicks).toBeGreaterThanOrEqual(6);
        expect(step.step).toBeLessThanOrEqual(enemyComboShared.COMBO_STEP_MAX);
      }
    }
  });
});

describe("GameRoom — jump-feel J1 authoritative stance/physics", () => {
  it("runs the 1250/900/2200 profile at ≈47px/0.55s and clears the required 160px gap", () => {
    let height = 0;
    let vh = enemyComboShared.JUMP_VELOCITY;
    let peak = 0;
    let ticks = 0;
    do {
      const next = enemyComboShared.stepVertical(height, vh, 0.05);
      height = next.height;
      vh = next.vh;
      peak = Math.max(peak, height);
      ticks++;
    } while (height > 0 && ticks < 30);
    expect(peak).toBeGreaterThan(45);
    expect(peak).toBeLessThan(48);
    expect(ticks * 0.05).toBeCloseTo(0.55, 8);
    expect(enemyComboShared.verticalPhase(0, 0)).toBe("grounded");
    expect(enemyComboShared.verticalPhase(10, 100)).toBe("rising");
    expect(enemyComboShared.verticalPhase(10, 0)).toBe("apex");
    expect(enemyComboShared.verticalPhase(10, -100)).toBe("falling");
    expect(
      enemyComboShared.verticalTimeToGround(0, enemyComboShared.JUMP_VELOCITY) *
        enemyComboShared.MOVE_SPEED,
    ).toBeGreaterThan(160);

    const { h, player } = makeJumpFeelRoom("hop-gap");
    const { cols, tileSize } = h.room.map;
    const row = Math.floor(player.y / tileSize);
    const col = Math.floor(player.x / tileSize);
    h.room.map.tiles[row * cols + col + 1] = TILE_PIT;
    h.room.map.tiles[row * cols + col + 2] = TILE_PIT;
    const farEdge = (col + 3) * tileSize;
    player.x = (col + 1) * tileSize - 1;
    player.y = (row + 0.5) * tileSize;
    const fell = player.fellSeq;
    sendJumpFeelInput(h, player.id, 1, { jump: true });
    let seq = 2;
    while (player.height > 0 && seq < 30) {
      sendJumpFeelInput(h, player.id, seq++, { dx: 1 });
    }
    sendJumpFeelInput(h, player.id, seq, { dx: 1 });
    expect(player.x).toBeGreaterThan(farEdge);
    expect(player.fellSeq).toBe(fell);
  });

  it("keeps wire fields transition-only and distinguishes organic aborts from forced cancels", () => {
    const { h, player, combat } = makeJumpFeelRoom("stance-edges");
    expect([player.moveStance, player.poundSeq, player.stanceSeq]).toEqual([0, 0, 0]);
    sendJumpFeelInput(h, player.id, 1, { jump: true, dx: 1 });
    expect(player.moveStance).toBe(enemyComboShared.STANCE_DASH);
    h.tick(3);
    expect([player.moveStance, player.poundSeq, player.stanceSeq]).toEqual([
      enemyComboShared.STANCE_DASH,
      0,
      0,
    ]);
    h.room.damagePlayer(player, 1);
    expect(combat.stance).toBe(enemyComboShared.STANCE_NONE);
    expect([player.moveStance, player.stanceSeq]).toEqual([0, 1]);
    h.room.damagePlayer(player, 1);
    expect(player.stanceSeq).toBe(1); // no transition, no wire churn
  });

  it("launches on the first Space edge, samples live WASD, and honors cooldown", () => {
    const locked = makeJumpFeelRoom("long-jump-immediate");
    sendJumpFeelInput(locked.h, locked.player.id, 1, { jump: true, dy: 1 });
    expect(locked.combat.stance).toBe(enemyComboShared.STANCE_DASH);
    expect(locked.combat.dashBaseDirX).toBeCloseTo(0, 6);
    expect(locked.combat.dashBaseDirY).toBeCloseTo(1, 6);
    expect(locked.player.height).toBeGreaterThan(0);

    const cooldown = makeJumpFeelRoom("long-jump-cooldown");
    cooldown.combat.distJumpCd = 1;
    sendJumpFeelInput(cooldown.h, cooldown.player.id, 1, { jump: true, dx: 1 });
    expect(cooldown.combat.stance).toBe(enemyComboShared.STANCE_NONE);
    expect(cooldown.player.height).toBe(0);
  });

  it("soft-steers at <=45°/s within ±27° and reaches the authored 372px", () => {
    const reach = makeJumpFeelRoom("dash-reach");
    const startX = reach.player.x;
    sendJumpFeelInput(reach.h, reach.player.id, 1, { jump: true, dx: 1 });
    expect(reach.combat.stance).toBe(enemyComboShared.STANCE_DASH);
    for (let i = 0; i < 20 && reach.combat.stance === enemyComboShared.STANCE_DASH; i++)
      reach.h.tick(1);
    expect(reach.player.x - startX).toBeCloseTo(enemyComboShared.DIST_JUMP_REACH, 5);
    expect(reach.player.x - startX).toBeGreaterThan(320);
    expect(reach.combat.lastLandingTier).toBe(enemyComboShared.LANDING_TIER_HEAVY);
    expect(enemyComboShared.DIST_JUMP_CYCLE_SPEED).toBe(enemyComboShared.DIST_JUMP_SPEED);
    expect(reach.combat.distJumpCd).toBeGreaterThan(0);

    const steer = makeJumpFeelRoom("dash-steer");
    sendJumpFeelInput(steer.h, steer.player.id, 1, { jump: true, dy: 1 });
    let maxTurn = 0;
    let seq = 2;
    while (steer.combat.stance === enemyComboShared.STANCE_DASH && seq < 30) {
      const before = steer.combat.dashSteer;
      sendJumpFeelInput(steer.h, steer.player.id, seq++, { dx: 1 });
      if (steer.combat.stance === enemyComboShared.STANCE_DASH) {
        expect(Math.abs(steer.combat.dashSteer - before)).toBeLessThanOrEqual(
          enemyComboShared.DIST_JUMP_STEER_RADIANS_PER_SECOND * 0.05 + 1e-9,
        );
        maxTurn = Math.max(maxTurn, Math.abs(steer.combat.dashSteer));
      }
    }
    expect(maxTurn).toBeGreaterThan(0);
    expect(maxTurn).toBeLessThanOrEqual(enemyComboShared.DIST_JUMP_MAX_STEER_RADIANS + 1e-9);
  });

  it("routes the raw distance-jump landing through safeSpawnPos before freezing its direction", () => {
    const { h, player, combat } = makeJumpFeelRoom("dash-clamp");
    const rawX = player.x + enemyComboShared.DIST_JUMP_REACH;
    const rawY = player.y;
    const tx = Math.floor(rawX / h.room.map.tileSize);
    const ty = Math.floor(rawY / h.room.map.tileSize);
    h.room.map.tiles[ty * h.room.map.cols + tx] = TILE_PIT;
    const expected = enemyComboShared.safeSpawnPos(
      h.room.map,
      rawX,
      rawY,
    );
    const dx = expected.x - player.x;
    const dy = expected.y - player.y;
    const d = Math.hypot(dx, dy);
    sendJumpFeelInput(h, player.id, 1, { jump: true, dx: 1 });
    expect(combat.dashDirX).toBeCloseTo(dx / d, 6);
    expect(combat.dashDirY).toBeCloseTo(dy / d, 6);
    expect(combat.dashSpeed).toBeCloseTo(
      Math.min(enemyComboShared.DIST_JUMP_SPEED, d / enemyComboShared.DIST_JUMP_AIRTIME),
      6,
    );
  });

  it("gates pound above 24px, honors the 90px truth radius/cap, and lands into no-parry recovery", () => {
    const { h, player, combat } = makeJumpFeelRoom("pound-truth");
    player.height = enemyComboShared.POUND_MIN_HEIGHT;
    sendJumpFeelInput(h, player.id, 1, { pound: true });
    expect(combat.stance).toBe(enemyComboShared.STANCE_NONE);
    expect(combat.jumpBuffer).toBeGreaterThan(0); // late-air press keeps the landing-hop buffer

    player.height = 200;
    player.vh = 0;
    combat.vh = 0;
    combat.jumpBuffer = 0;
    combat.invuln = 1; // landing must surrender even a pre-existing parry window
    const inside = addJumpDummy(
      h,
      "pound-inside",
      player.x + enemyComboShared.POUND_RADIUS,
      player.y,
    );
    const outside = addJumpDummy(
      h,
      "pound-outside",
      player.x - enemyComboShared.POUND_RADIUS - 0.01,
      player.y,
    );
    const insideHp = inside.hp;
    const outsideHp = outside.hp;
    sendJumpFeelInput(h, player.id, 2, { pound: true });
    expect(combat.stance).toBe(enemyComboShared.STANCE_POUND);
    expect(combat.vh).toBe(0); // first gather tick
    const poundSeq = player.poundSeq;
    for (let i = 0; i < 10 && player.poundSeq === poundSeq; i++) h.tick(1);
    expect(insideHp - inside.hp).toBe(enemyComboShared.POUND_DAMAGE_CAP);
    expect(outside.hp).toBe(outsideHp);
    expect(player.poundSeq).toBe((poundSeq + 1) & 0xff);
    expect(combat.lastLandingTier).toBe(enemyComboShared.LANDING_TIER_HEAVY);
    expect(combat.jumpCd).toBeCloseTo(enemyComboShared.POUND_JUMP_COOLDOWN, 8);
    expect(combat.recoveryT).toBeCloseTo(enemyComboShared.POUND_RECOVERY_SECONDS, 8);
    expect(combat.invuln).toBe(0);

    const hp = player.hp;
    const parried = player.parriedSeq;
    h.room.applyBossQuake(player.x, player.y, 100, 7, 0);
    expect(player.hp).toBe(hp - 7);
    expect(player.parriedSeq).toBe(parried);
    h.send(player.id, "parry");
    expect(combat.invuln).toBe(0);
  });

  it("caps the decaying pound shove below one bodywidth and never pushes a pack across a pit lip", () => {
    const { h, player, combat } = makeJumpFeelRoom("pound-pit");
    const { cols, tileSize } = h.room.map;
    const row = Math.floor(player.y / tileSize);
    const col = Math.floor(player.x / tileSize);
    const pitX = (col + 1) * tileSize;
    for (let y = row - 1; y <= row + 1; y++) h.room.map.tiles[y * cols + col + 1] = TILE_PIT;
    player.x = pitX - 61;
    player.y = (row + 0.5) * tileSize;
    player.height = 25;
    combat.vh = 0;
    const pack = [-60, 0, 60].map((dy, i) =>
      addJumpDummy(h, `pound-pack-${i}`, pitX - 1, player.y + dy, 1_000),
    );
    const before = pack.map((enemy) => enemy.x);
    sendJumpFeelInput(h, player.id, 1, { pound: true });
    for (let i = 0; i < 12; i++) h.tick(1);
    for (let i = 0; i < pack.length; i++) {
      const enemy = pack[i]!;
      expect(h.state().enemies.has(enemy.id)).toBe(true);
      expect(isPitAtPx(h.room.map, enemy.x, enemy.y)).toBe(false);
      expect(Math.hypot(enemy.x - before[i]!, 0)).toBeLessThanOrEqual(40);
    }
  });

  it("keeps pit grace on a separate null-immunity channel so quakes cannot auto-parry", () => {
    const { h, player, combat } = makeJumpFeelRoom("pit-mercy");
    const { cols, tileSize } = h.room.map;
    const row = Math.floor(player.y / tileSize);
    const col = Math.floor(player.x / tileSize);
    combat.lastGroundX = player.x - tileSize;
    combat.lastGroundY = player.y;
    h.room.map.tiles[row * cols + col] = TILE_PIT;
    player.x = (col + 0.5) * tileSize;
    player.y = (row + 0.5) * tileSize;
    h.tick(1);
    expect(combat.pitGrace).toBeGreaterThan(0);
    expect(combat.invuln).toBe(0);
    const hp = player.hp;
    const parried = player.parriedSeq;
    const parryCd = combat.parryCd;
    h.room.applyBossQuake(player.x, player.y, 100, 20, 0);
    expect(player.hp).toBe(hp);
    expect(player.parriedSeq).toBe(parried);
    expect(combat.parryCd).toBe(parryCd);
  });

  it("classifies landing tiers at the exact 300/520 boundaries", () => {
    expect(enemyComboShared.landingThumpTier(299.999)).toBe(enemyComboShared.LANDING_TIER_SOFT);
    expect(enemyComboShared.landingThumpTier(300)).toBe(enemyComboShared.LANDING_TIER_SOLID);
    expect(enemyComboShared.landingThumpTier(520)).toBe(enemyComboShared.LANDING_TIER_SOLID);
    expect(enemyComboShared.landingThumpTier(520.001)).toBe(enemyComboShared.LANDING_TIER_HEAVY);
    expect(enemyComboShared.landingThumpTier(200, 620, true)).toBe(
      enemyComboShared.LANDING_TIER_HEAVY,
    );
  });

  it("gives a committed pound descent priority over enemy launcher/air-keep vh writes", () => {
    const { h, player, combat } = makeJumpFeelRoom("pound-priority");
    player.height = 100;
    combat.vh = 0;
    sendJumpFeelInput(h, player.id, 1, { pound: true });
    h.tick(1); // gather completes; the committed descent now owns vh
    expect(combat.vh).toBe(-enemyComboShared.POUND_SPEED);
    const enemy = addJumpDummy(h, "pound-launcher", player.x - 40, player.y);
    enemy.kind = "vault-ronin";
    const juggled = player.juggledSeq;
    h.room.comboSwing(
      enemy,
      enemy.id,
      { targetId: player.id, juggleCombo: true, comboDamage: 0 },
      { kind: "launcher", windupTicks: 6, step: 0, damageMult: 0, launch: { vh: 480, push: 0 } },
      { range: 200, halfArc: 1.2, damageMult: 0, knockbackMult: 0 },
      { x: enemy.x, y: enemy.y, aimX: 1, aimY: 0 },
    );
    expect(combat.stance).toBe(enemyComboShared.STANCE_POUND);
    expect(combat.vh).toBe(-enemyComboShared.POUND_SPEED);
    expect(player.vh).toBe(-enemyComboShared.POUND_SPEED);
    expect(player.juggledSeq).toBe(juggled);
  });

  it("ships schema 21 with the three appended uint8 stance/VFX defaults", () => {
    const player = new enemyComboShared.PlayerState();
    expect(enemyComboShared.SCHEMA_VERSION).toBe(49);
    expect([player.moveStance, player.poundSeq, player.stanceSeq]).toEqual([0, 0, 0]);
  });
});
