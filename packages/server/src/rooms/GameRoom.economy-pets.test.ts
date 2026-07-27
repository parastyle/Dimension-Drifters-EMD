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


describe("pet v1 join snapshot, lock, and schema 25", () => {
  it("sanitizes an unowned request, syncs only id/band, and ignores attempted mid-run selection", () => {
    const h = makeRoom();
    const account = enemyComboShared.createMetaAccountV2();
    account.pets["hearth-newt"] = { bondXp: 2700 };
    account.selectedPetId = "hearth-newt";
    const client = { sessionId: "pet-lock" };
    h.room.clients.push(client);
    h.room.onJoin(client, { metaAccount: account, selectedPetId: "brass-crab" });
    const player = h.state().players.get("pet-lock");
    expect([h.state().schemaVersion, enemyComboShared.SCHEMA_VERSION]).toEqual([49, 49]);

    expect([h.state().schemaVersion, enemyComboShared.SCHEMA_VERSION]).toEqual([49, 49]);    expect({ petId: player.petId, petLevelBand: player.petLevelBand }).toEqual({
      petId: "hearth-newt",
      petLevelBand: 3,
    });
    expect(player.petLevel).toBeUndefined();
    expect(player.petBondXp).toBeUndefined();
    h.send("pet-lock", "selectPet", { petId: "verdant-wing" });
    expect(player.petId).toBe("hearth-newt");
    expect(h.room.petRuns.get("pet-lock").level).toBe(9);
  });
});

describe("pet v1 approved roster bonus enforcement", () => {
  it("Verdant Wing multiplies only HP regen while its retired charge capstone cannot fork Drive", () => {
    const h = makeRoom();
    const { player, combat } = joinPet(h, "verdant-max", "verdant-wing", 3600);
    h.state().mode = "training";
    player.hp = 50;
    h.room.stepSim(0.05);
    expect(player.hp).toBeCloseTo(50 + PLAYER_REGEN * 1.5 * 0.05, 6);

    player.weapon = "x-gun-coffin-shotgun";
    h.room.restoreWeaponResource(player, combat, true, false);
    combat.drive.valueF = 42.25;
    combat.drive.recoveryDebtF = 0.7;
    player.weaponResource.valueQ = 4225;
    combat.cd = 0.4;
    h.room.saveWeaponResource(player, combat);
    player.weapon = "rusty-cleaver";
    h.room.restoreWeaponResource(player, combat, true, false);
    player.weapon = "x-gun-coffin-shotgun";
    h.room.restoreWeaponResource(player, combat, false, false);
    expect({
      charges: player.charges,
      maxCharges: player.maxCharges,
      cooldown: combat.cd,
      reload: combat.reloadCd,
      drive: combat.drive.valueF,
      debt: combat.drive.recoveryDebtF,
    }).toEqual({
      charges: 0,
      maxCharges: 0,
      cooldown: 0.4,
      reload: 0,
      drive: 42.25,
      debt: 0.7,
    });
    const shotgun = combat.weaponLedger.get("x-gun-coffin-shotgun");
    shotgun.cooldown = 0.05;
    player.weapon = "rusty-cleaver";
    h.room.restoreWeaponResource(player, combat, false, false);
    h.room.stepStowedWeaponResources(player, combat, 0.05);
    expect(shotgun).toEqual({ cooldown: 0, reload: 0, charges: 0 });
    expect(combat.drive.valueF).toBe(42.25);
  });

  it("Hearth Newt scales received event heals once and keeps its descent capstone exactly 15%", () => {
    const h = makeRoom();
    const { player } = joinPet(h, "hearth-max", "hearth-newt", 3600);
    player.hp = 50;
    h.room.applyHeal(player, 10);
    expect(player.hp).toBe(62);
    player.hp = 50;
    h.room.transitionDimension();
    expect(player.hp).toBe(65);
  });

  it("Lodestar Moth extends owner-centred money-drop reach", () => {
    const h = makeRoom();
    const { player } = joinPet(h, "moth-max", "lodestar-moth", 3600);
    expect(h.room.moneyDropReach(player)).toBe(360);
    h.room.dropMoney(player.x + 350, player.y, 10);
    const drop = [...h.state().moneyDrops.values()][0];
    h.tick(enemyComboShared.MONEY_DROP_ARM_TICKS);
    expect(drop.collectorId).toBe(player.id);
  });

  it("Copper Snail expands only earned pickup reach and raises only the capstone bag admission", () => {
    const h = makeRoom();
    const { player } = joinPet(h, "copper-max", "copper-snail", 3600);
    expect(h.room.bagCapacity(player)).toBe(13);
    const unearned = new PickupState();
    unearned.id = "drop-pet-unearned";
    unearned.weapon = "x-gun-gatling";
    unearned.weaponPublic = unearned.weapon;
    unearned.x = player.x + 80;
    unearned.y = player.y;
    h.state().pickups.set(unearned.id, unearned);
    const earned = new PickupState();
    earned.id = "drop-pet-earned";
    earned.weapon = "x-gun-coffin-shotgun";
    earned.weaponPublic = earned.weapon;
    earned.x = player.x + 80;
    earned.y = player.y;
    h.state().pickups.set(earned.id, earned);
    h.room.earnedPickups.add(earned.id);
    h.send(player.id, "grabWeapon");
    expect(h.state().pickups.has(earned.id)).toBe(false);
    expect(h.state().pickups.has(unearned.id)).toBe(true);

    const low = makeRoom();
    const lowPet = joinPet(low, "copper-nine", "copper-snail", 2700);
    expect(low.room.bagCapacity(lowPet.player)).toBe(12);
  });

  it("Brass Crab cannot accelerate retired reload debt; stowed cadence still ages once", () => {
    const h = makeRoom();
    const { player, combat } = joinPet(h, "brass-max", "brass-crab", 3600);
    h.state().mode = "training";
    player.weapon = "x-gun-coffin-shotgun";
    h.room.restoreWeaponResource(player, combat, true, false);
    combat.cd = 0.5;
    h.room.saveWeaponResource(player, combat);
    player.weapon = "rusty-cleaver";
    h.room.restoreWeaponResource(player, combat, true, false);
    const shotgun = combat.weaponLedger.get("x-gun-coffin-shotgun");
    h.room.stepStowedWeaponResources(player, combat, 0.2);
    expect(shotgun.cooldown).toBeCloseTo(0.3, 8);
    player.alive = false;
    h.room.stepStowedWeaponResources(player, combat, 0.2);
    expect(shotgun.cooldown).toBeCloseTo(0.1, 8);
    expect([player.charges, player.maxCharges, combat.reloadCd]).toEqual([0, 0, 0]);
  });

  it("Pale Firefly uses the owner's level for 156px reach and exactly 40% revive HP", () => {
    const h = makeRoom();
    const rezzer = joinPet(h, "firefly-max", "pale-firefly", 3600).player;
    const target = joinPet(h, "firefly-target", "slate-tortoise", 0).player;
    target.x = rezzer.x + 150;
    target.y = rezzer.y;
    target.alive = false;
    target.hp = 0;
    h.room.tryRez(rezzer, 96);
    expect(target.alive).toBe(true);
    expect(target.hp).toBe(Math.round(target.maxHp * 0.4));
  });

  it("Slate Tortoise mitigates only typed neutral hazards and refreshes a preserved 3s regen window", () => {
    const h = makeRoom();
    const { player, pet } = joinPet(h, "tortoise-max", "slate-tortoise", 3600);
    h.state().mode = "training";
    player.maxHp = 200;
    player.hp = 200;
    h.room.damagePlayer(player, 20, "pit");
    expect(player.hp).toBe(183);
    player.hp = 200;
    h.room.damagePlayer(player, 20, "enemy");
    expect(player.hp).toBe(180);
    player.hp = 100;
    h.room.damagePitFall(player);
    expect(pet.tortoisePitRegenSeconds).toBe(3);
    h.room.damagePitFall(player);
    expect(pet.tortoisePitRegenSeconds).toBe(3);
    player.hp = 50;
    h.room.stepSim(0.05);
    expect(player.hp).toBeCloseTo(50 + PLAYER_REGEN * 1.5 * 0.05, 6);
    expect(pet.tortoisePitRegenSeconds).toBeCloseTo(2.95, 8);
  });
});

describe("pet v1 Bond XP qualification, terminal banking, and lifecycle", () => {
  it("requires 60 seconds plus three accepted outcomes once per epoch", () => {
    const h = makeRoom();
    const { pet } = joinPet(h, "bond-eligibility", "verdant-wing", 0);
    pet.dimensionPresenceSeconds = 59.95;
    pet.acceptedActionsThisDimension = 3;
    h.room.awardPetDimensionClear();
    expect(pet.pendingBondXp).toBe(0);
    h.room.beginNextPetDimension();
    pet.dimensionPresenceSeconds = 60;
    pet.acceptedActionsThisDimension = 2;
    h.room.awardPetDimensionClear();
    expect(pet.pendingBondXp).toBe(0);
    h.room.beginNextPetDimension();
    pet.dimensionPresenceSeconds = 60;
    pet.acceptedActionsThisDimension = 3;
    h.room.awardPetDimensionClear();
    h.room.awardPetDimensionClear();
    expect({ pending: pet.pendingBondXp, clears: pet.clearReceipts }).toEqual({
      pending: 100,
      clears: 1,
    });
  });

  it("training/dummy attacks never qualify a Bond action or clear receipt", () => {
    const h = makeRoom();
    const { player, pet } = joinPet(h, "bond-training", "verdant-wing", 0);
    h.room.toggleTraining();
    h.send(player.id, "attack", { aimX: 1, aimY: 0 });
    h.tick(2);
    expect(pet.acceptedActionsThisDimension).toBe(0);
    pet.dimensionPresenceSeconds = 120;
    pet.acceptedActionsThisDimension = 99;
    h.room.awardPetDimensionClear();
    expect(pet.pendingBondXp).toBe(0);
  });

  it("banks selected-pet-only XP on defeat, victory, and extraction, idempotently", () => {
    const settle = (kind: "defeat" | "victory" | "extract") => {
      const h = makeRoom();
      const joined = joinPet(h, `bond-${kind}`, "hearth-newt", 0, (account) => {
        account.pets["verdant-wing"] = { bondXp: 120 };
        account.pets["slate-tortoise"] = { bondXp: 0 };
      });
      joined.pet.pendingBondXp = 100;
      joined.pet.clearReceipts = 1;
      if (kind === "extract") h.room.completeExtraction();
      else h.room.enterTerminalOutcome(kind);
      h.room.enterTerminalOutcome(kind === "defeat" ? "defeat" : "victory");
      return joined.account;
    };
    const defeat = settle("defeat");
    const victory = settle("victory");
    const extraction = settle("extract");
    expect(defeat.pets["hearth-newt"].bondXp).toBe(100);
    expect(victory.pets["hearth-newt"].bondXp).toBe(180);
    expect(extraction.pets["hearth-newt"].bondXp).toBe(180);
    expect([
      defeat.pets["verdant-wing"].bondXp,
      victory.pets["verdant-wing"].bondXp,
      extraction.pets["verdant-wing"].bondXp,
    ]).toEqual([120, 120, 120]);
  });

  it("preserves the exact pet snapshot, counters, Drive, and debt through down/revive", () => {
    const h = makeRoom();
    const owner = joinPet(h, "pet-downed", "verdant-wing", 3600);
    const ally = joinPet(h, "pet-rezzer", "hearth-newt", 0);
    owner.player.weapon = "x-gun-coffin-shotgun";
    h.room.restoreWeaponResource(owner.player, owner.combat, true, false);
    owner.combat.drive.valueF = 42.25;
    owner.combat.drive.recoveryDebtF = 0.7;
    owner.player.weaponResource.valueQ = 4225;
    owner.pet.pendingBondXp = 240;
    owner.pet.acceptedActionsThisDimension = 7;
    const sameRuntime = owner.pet;
    owner.player.hp = 0;
    h.tick();
    expect(owner.player.alive).toBe(false);
    const downedDrive = owner.combat.drive.valueF;
    const downedDebt = owner.combat.drive.recoveryDebtF;
    h.room.tryRez(ally.player, 10000);
    expect(owner.player.alive).toBe(true);
    expect(h.room.petRuns.get(owner.player.id)).toBe(sameRuntime);
    expect({
      petId: owner.player.petId,
      band: owner.player.petLevelBand,
      pending: owner.pet.pendingBondXp,
      actions: owner.pet.acceptedActionsThisDimension,
      drive: owner.combat.drive.valueF,
      debt: owner.combat.drive.recoveryDebtF,
      mirror: owner.player.weaponResource.valueQ,
      tombstones: [owner.player.maxCharges, owner.player.charges, owner.combat.reloadCd],
    }).toEqual({
      petId: "verdant-wing",
      band: 3,
      pending: 240,
      actions: 7,
      drive: downedDrive,
      debt: downedDebt,
      mirror: Math.floor(downedDrive * 100),
      tombstones: [0, 0, 0],
    });
  });

  it("keeps Slate's terminal-victory pity roll separate from defeat settlement", () => {
    const victory = makeRoom();
    const won = joinPet(victory, "slate-win", "verdant-wing", 0, (account) => {
      account.slateTortoisePityMisses = 7;
    });
    victory.room.enterTerminalOutcome("victory");
    expect(won.account.pets["slate-tortoise"]).toEqual({ bondXp: 0 });

    const defeat = makeRoom();
    const lost = joinPet(defeat, "slate-loss", "verdant-wing", 0, (account) => {
      account.slateTortoisePityMisses = 7;
    });
    defeat.room.enterTerminalOutcome("defeat");
    expect(lost.account.pets["slate-tortoise"]).toBeUndefined();
    expect(lost.account.slateTortoisePityMisses).toBe(7);
  });
});

describe("pet v1 owner-private protocol seams", () => {
  it("sends Copper earned-pickup eligibility only to an eligible owner", () => {
    const h = makeRoom();
    const copperMessages: Array<{ type: string; payload: unknown }> = [];
    const otherMessages: Array<{ type: string; payload: unknown }> = [];
    const copperAccount = enemyComboShared.createMetaAccountV2();
    copperAccount.pets["copper-snail"] = { bondXp: 120 };
    copperAccount.selectedPetId = "copper-snail";
    const copper = {
      sessionId: "copper-private",
      send: (type: string, payload: unknown) => copperMessages.push({ type, payload }),
    };
    const other = {
      sessionId: "non-copper-private",
      send: (type: string, payload: unknown) => otherMessages.push({ type, payload }),
    };
    h.room.clients.push(copper, other);
    h.room.onJoin(copper, { metaAccount: copperAccount });
    h.room.onJoin(other, { metaAccount: enemyComboShared.createMetaAccountV2() });
    copperMessages.length = 0;
    otherMessages.length = 0;

    h.room.earnedPickups.add("drop-earned-private");
    h.room.publishPetPickupEligibility();
    expect(copperMessages).toEqual([
      { type: "petPickupEligibility", payload: { ids: ["drop-earned-private"] } },
    ]);
    expect(otherMessages).toEqual([]);
  });
});

// Server-latency wave — append-only proof that callback-time arrivals feed the next fixed step.
describe("GameRoom — immediate input arrivals between 20Hz steps", () => {
  it("accepts mid-interval commands, drains to newest held state, and preserves skipped edges", () => {
    const { h, player } = makeBeamRoom("latency-mid-interval");
    h.tick(1, 20); // accumulator is partway to the next fixed 50ms step
    h.send(player.id, "input", {
      seq: 1,
      dx: 1,
      dy: 0,
      jump: true,
      fireHeld: true,
      aimX: 1,
      aimY: 0,
      targetX: player.x + 500,
      targetY: player.y,
    });
    h.tick(1, 20); // still no authoritative step; a normal heartbeat arrives after the edge
    h.send(player.id, "input", {
      seq: 2,
      dx: -1,
      dy: 0,
      jump: false,
      fireHeld: true,
      aimX: 1,
      aimY: 0,
      targetX: player.x + 500,
      targetY: player.y,
    });
    expect(h.room.inputs.get(player.id).queue).toHaveLength(2);

    h.tick(1, 10);
    expect(player.ackSeq).toBe(2); // fixed-step consumption remains drain-to-newest
    expect(player.mvx).toBeLessThan(0); // newest held movement owns the step
    expect(player.height).toBeGreaterThan(0); // older one-shot jump survives the drain
    expect(h.state().beams.get(player.id)?.startSeq).toBe(1); // first fire edge owns the epoch
    expect(h.room.inputs.get(player.id).queue).toHaveLength(0);
  });
});

describe("GameRoom — independent weapon slots and compatibility row", () => {
  it("keeps same-class weapons in separate slots and equips only the selected slot", () => {
    const h = makeRoom({ belt: true });
    h.join("independent-same-class-slots");
    const player = h.state().players.get("independent-same-class-slots");
    expect(player).toBeDefined();
    if (!player) return;

    player.activeSlot = 0;
    player.weapon = "rattler-sabre";
    player.slots[0]!.weapon = "rattler-sabre";
    player.slots[1]!.weapon = "x2-sandsong-saber";
    h.send(player.id, "swapSlot", { slot: 1 });

    expect(player.activeSlot).toBe(1);
    expect(player.weapon).toBe("x2-sandsong-saber");
    expect([player.slots[0]!.weapon, player.slots[1]!.weapon]).toEqual([
      "rattler-sabre",
      "x2-sandsong-saber",
    ]);
  });

  it("keeps schema 38 and the unrelated compatibility-container tenants intact", () => {
    const fresh = new enemyComboShared.PlayerState();
    expect(enemyComboShared.SCHEMA_VERSION).toBe(49);
    expect(new enemyComboShared.ArenaState().schemaVersion).toBe(49);
    expect(fresh.dualWield).toMatchObject({
      retiredByte0: 255,
      retiredUint32: 0,
      retiredByte1: 0,
      retiredByte2: 0,
      gearUpper: "",
      gearLower: "",
      prestige: 0,
      weaponResource: {
        valueQ: 10000,
        regenMode: 1,
        beamLockEndTick: 0,
      },
    });
    expect(fresh.dualWield.relics).toMatchObject({
      energyPool: 0,
      ownedRare: "",
      activeDodge: "",
      reviveAvailable: false,
    });
  });
});

// Server-tuning wave — appended regression laws for shared movement, melee goldens, and grid separation.
describe("server-tuning wave — momentum, melee pressure, and enemy separation", () => {
  it("retains exactly one movement speed on a full reversal", () => {
    const reversed = enemyComboShared.steerVelocity(
      { vx: enemyComboShared.MOVE_SPEED, vy: 0 },
      { dx: -1, dy: 0 },
      0.05,
    );
    const retention = Math.hypot(reversed.vx, reversed.vy) / enemyComboShared.MOVE_SPEED;
    expect(retention).toBe(1);
  });

  it("pins the faster melee roster and preserves legacy reach metadata without floor sectors", () => {
    expect(ENEMY_KINDS.critter?.speed).toBe(210); // 168 → 210
    expect(ENEMY_KINDS["mote-swarm"]?.speed).toBe(281.25); // 225 → 281.25
    expect(ENEMY_KINDS.pricklepulp?.speed).toBe(77.5); // 62 → 77.5
    expect(ENEMY_KINDS.ronin?.speed).toBe(195); // 156 → 195
    expect(ENEMY_KINDS["vault-ronin"]?.speed).toBe(180); // 150 → 180 (leap rail)
    expect(ENEMY_KINDS["frozen-knight"]?.speed).toBe(187.5); // 150 → 187.5
    expect(ENEMY_KINDS["shifter-cinder-marshal"]?.speed).toBeCloseTo(158.4, 10); // 132 → 158.4

    const critterMelee = enemyComboShared.effectiveMelee(ENEMY_KINDS.critter);
    if (!critterMelee) throw new Error("critter must retain its derived melee definition");
    expect(critterMelee.range).toBeCloseTo(62.4, 10); // (18 + 30) × 1.30
    expect(critterMelee.halfArc).toBeCloseTo(1.235, 10); // compatibility data; B33 does not hit-test it
    expect(ENEMY_KINDS.ronin?.melee?.range).toBeCloseTo(179.4, 10);
    expect(ENEMY_KINDS.ronin?.melee?.halfArc).toBeCloseTo(1.17, 10);
    expect(ENEMY_KINDS["vault-ronin"]?.melee?.range).toBeCloseTo(182, 10);
    expect(ENEMY_KINDS["vault-ronin"]?.melee?.halfArc).toBeCloseTo(1.235, 10);
    expect(ENEMY_KINDS["frozen-knight"]?.melee?.range).toBeCloseTo(187.2, 10);
    expect(ENEMY_KINDS["frozen-knight"]?.melee?.halfArc).toBeCloseTo(1.196, 10);

    const sanren = enemyComboShared.TOUGH_COMBOS["k1-sanren"];
    if (!sanren) throw new Error("K1 Sanren tuning fixture is required");
    expect(sanren.frontOffset).toBe(143); // 110 → 143; preserves negotiated 0.8× opener geometry
    expect(sanren.steps[0]?.range).toBeCloseTo(179.4, 10);
    expect(sanren.steps[0]?.halfArc).toBeCloseTo(1.17, 10);
    expect(sanren.steps.map((step) => step.windupTicks)).toEqual([8, 6, 15]);
    expect(enemyComboShared.TOUGH_COMBOS["h1-sweep-overhead"]?.steps[0]?.halfArc).toBeCloseTo(
      2.951,
      10,
    ); // 2.27 → 2.951
  });

  function addStackedEnemy(
    h: ReturnType<typeof makeRoom>,
    id: string,
    x: number,
    y: number,
  ): EnemyState {
    const enemy = new EnemyState();
    enemy.id = id;
    enemy.kind = "critter";
    enemy.hp = 100;
    enemy.x = x;
    enemy.y = y;
    h.state().enemies.set(id, enemy);
    return enemy;
  }

  it("de-overlaps two exactly stacked living enemies within eight 20Hz separation ticks", () => {
    const h = makeRoom();
    const a = addStackedEnemy(h, "separate-a", 2000, 1800);
    const b = addStackedEnemy(h, "separate-b", 2000, 1800);
    for (let tick = 0; tick < 8; tick++) {
      h.room.rebuildEnemyGrid();
      h.room.resolveEnemyCollisions();
    }
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(35.5);
  });

  it("settles a crowd of 20 coincident enemies to a non-overlap equilibrium without full scans", () => {
    const h = makeRoom();
    const crowd: EnemyState[] = [];
    for (let i = 0; i < 20; i++) crowd.push(addStackedEnemy(h, `crowd-${i}`, 2400, 1800));
    for (let tick = 0; tick < 80; tick++) {
      h.room.rebuildEnemyGrid();
      h.room.resolveEnemyCollisions();
    }
    let minimumGap = Number.POSITIVE_INFINITY;
    for (let i = 0; i < crowd.length; i++) {
      for (let j = i + 1; j < crowd.length; j++) {
        const a = crowd[i];
        const b = crowd[j];
        if (!a || !b) throw new Error("crowd fixture index escaped its fixed bounds");
        minimumGap = Math.min(minimumGap, Math.hypot(a.x - b.x, a.y - b.y));
      }
    }
    expect(minimumGap).toBeGreaterThanOrEqual(35.5);
  });

  it("never displaces a player while separating enemies from the same occupied point", () => {
    const h = makeRoom();
    h.join("separation-player");
    const player = h.state().players.get("separation-player");
    const before = { x: player.x, y: player.y };
    addStackedEnemy(h, "player-stack-a", player.x, player.y);
    addStackedEnemy(h, "player-stack-b", player.x, player.y);
    h.room.rebuildEnemyGrid();
    h.room.resolveEnemyCollisions();
    expect({ x: player.x, y: player.y }).toEqual(before);
  });
});

describe("gear G2 archived account compatibility and inert runtime", () => {
  it("round-trips a full V4 gear account while the chosen whole-art kit owns combat", () => {
    const h = makeRoom();
    let sanitizedEquipped:
      | Record<
          (typeof enemyComboShared.GEAR_SLOTS)[number],
          (typeof enemyComboShared.GEAR_IDS)[number]
        >
      | undefined;
    const geared = joinGearAccount(
      h,
      "gear-neon",
      (account) => {
        account.ownedGear = [...enemyComboShared.GEAR_IDS];
        equipGearSet(account, "neon-mirage");
        sanitizedEquipped = {
          ...enemyComboShared.sanitizeMetaAccountV4(account).equippedGear,
        };
      },
      "proto-wizard",
    );
    if (!sanitizedEquipped) throw new Error("sanitized gear fixture was not captured");
    const archivedRuntime = enemyComboShared.resolveGearLoadout(sanitizedEquipped);

    expect("baseStats" in archivedRuntime).toBe(false);
    expect(archivedRuntime.quirk.id).toBe("package-deal");
    expect(archivedRuntime.mods.drawLockMult).toBe(0);
    expect(geared.account.ownedGear).toEqual(enemyComboShared.GEAR_IDS);
    expect(geared.account.equippedGear).toEqual(sanitizedEquipped);

    expect(geared.gear).toBeUndefined();
    expect(h.room.gearRuns.has("gear-neon")).toBe(false);
    expect(geared.player.gearSeeded).toBe(false);
    expect([geared.player.gearUpper, geared.player.gearLower]).toEqual(["", ""]);
    expect([geared.player.character, geared.player.runCharacter]).toEqual([
      "proto-wizard",
      "proto-wizard",
    ]);
    expect(["str", "dex", "int", "con", "luk"].some((key) => key in geared.player)).toBe(false);
    expect(geared.combat.identityCharacter).toBe("proto-wizard");
    expect(geared.combat.quirk.id).toBe("unwritten");
    expect(geared.combat.mods.drawLockMult).toBe(1);

    const accountResponse = [...geared.messages]
      .reverse()
      .find((message) => message.type === "metaAccount")?.payload as
      | import("@dd/shared").MetaAccountV4
      | undefined;
    expect(accountResponse?.ownedGear).toEqual(enemyComboShared.GEAR_IDS);
    expect(accountResponse?.equippedGear).toEqual(sanitizedEquipped);
  });

  it("keeps the archived gear snapshot helper available only through an explicit compatibility call", () => {
    const gearRoom = makeRoom();
    const geared = joinGearAccount(gearRoom, "gear-asha", (account) => {
      account.ownedGear.push("ash-walker-hat");
      account.equippedGear.hat = "ash-walker-hat";
    });
    expect(geared.combat.quirk.id).toBe("unwritten");
    const archivedRuntime = enemyComboShared.resolveGearLoadout(geared.account.equippedGear);
    gearRoom.room.snapshotGearRun(geared.player, geared.combat, archivedRuntime, false);
    gearRoom.join("gear-ally");
    const gearAlly = gearRoom.state().players.get("gear-ally");
    geared.player.x = gearAlly.x = 500;
    geared.player.y = gearAlly.y = 500;
    gearAlly.hp = 40;
    gearRoom.room.applyParryQuirk(geared.player, geared.combat, 7);
    const gearHeal = gearAlly.hp - 40;

    const legacyRoom = makeRoom();
    legacyRoom.join("legacy-asha");
    legacyRoom.join("legacy-ally");
    const legacyPlayer = legacyRoom.state().players.get("legacy-asha");
    const legacyCombat = legacyRoom.room.combat.get("legacy-asha");
    const legacyAlly = legacyRoom.state().players.get("legacy-ally");
    legacyPlayer.character = "cc-asha-the-ash-walker";
    legacyRoom.room.snapshotRunCharacter(legacyPlayer, legacyCombat, true);
    legacyPlayer.x = legacyAlly.x = 500;
    legacyPlayer.y = legacyAlly.y = 500;
    legacyAlly.hp = 40;
    legacyRoom.room.applyParryQuirk(legacyPlayer, legacyCombat, 7);
    expect([gearHeal, legacyAlly.hp - 40]).toEqual([7, 7]);
  });

  it("retains migrated gear and pet state but does not apply upgrade tombstones as run power", () => {
    const old = enemyComboShared.createMetaAccountV2();
    old.upgrades = { vitality: 3, fortune: 2, power: 1 };
    const migrated = enemyComboShared.sanitizeMetaAccountV3(old);
    const h = makeRoom();
    const client = { sessionId: "gear-upgrade-migration" };
    h.room.clients.push(client);
    h.room.onJoin(client, { metaAccount: migrated });
    const player = h.state().players.get(client.sessionId);
    const account = h.room.metaAccounts.get(client.sessionId);

    expect(account.ownedGear).toEqual(migrated.ownedGear);
    expect(account.equippedGear).toEqual(migrated.equippedGear);
    expect(h.room.gearRuns.has(client.sessionId)).toBe(false);
    expect([player.character, player.runCharacter]).toEqual([
      "proto-cowboy-hidden-face",
      "proto-cowboy-hidden-face",
    ]);
    expect(["str", "dex", "int", "con", "luk"].some((key) => key in player)).toBe(false);
    expect(player.maxHp).toBe(PLAYER_MAX_HP);
    expect(player.hp).toBe(player.maxHp);
    expect([player.gearSeeded, player.gearUpper, player.gearLower]).toEqual([false, "", ""]);
    expect(player.petId).toBe(old.selectedPetId);
  });
});
