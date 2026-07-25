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
  h.room.map.pois.length = 0;
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
  h.room.map.pois.length = 0;
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
  h.room.map.pois.length = 0;
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
  h.room.map.pois.length = 0;
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


describe("GameRoom — melee parry telegraph commitment", () => {
  it("locks one identity-targeted lunge for four ticks and never emits a floor cone", () => {
    const h = makeRoom();
    h.join("p1");
    h.room.map.tiles.fill(TILE_GROUND);
    const p1 = h.state().players.get("p1");
    p1.x = h.room.map.spawnX;
    p1.y = h.room.map.spawnY;

    const enemy = new EnemyState();
    enemy.id = "locked-ronin";
    enemy.kind = "ronin";
    enemy.hp = 999;
    enemy.x = p1.x + 140;
    enemy.y = p1.y;
    h.state().enemies.set(enemy.id, enemy);

    const commitBefore = enemy.commitSeq;
    for (let i = 0; i < 24 && enemy.commitSeq === commitBefore; i++) h.tick(1);
    expect(enemy.commitSeq).toBe(commitBefore + 1);
    expect(h.state().telegraphs.size).toBe(0);
    const st = h.room.comboState.get(enemy.id);
    expect(st.phase).toBe("commit");
    const committed = { ...st.strike };

    // Plain displacement models walking after the pop: it cannot exchange the committed victim or evade.
    p1.x -= 240;
    p1.y += 120;
    h.join("p2");
    const p2 = h.state().players.get("p2");
    p2.x = committed.endX;
    p2.y = committed.endY;
    p2.hp = p2.maxHp;
    const p1Hp = p1.hp;

    const attackBefore = enemy.atkSeq;
    h.tick(3);
    expect(enemy.atkSeq).toBe(attackBefore);
    expect(st.strike).toEqual(committed);
    h.tick(1);
    expect(enemy.atkSeq).toBe(attackBefore + 1);
    expect(p1.hp).toBeLessThan(p1Hp);
    expect(p2.hp).toBe(p2.maxHp);
    expect(h.state().telegraphs.size).toBe(0);
  });

  it("admits only three of six ordinary attackers and death-releases the next posture", () => {
    const h = makeRoom();
    h.join("token-player");
    h.room.map.tiles.fill(TILE_GROUND);
    h.room.map.pois.length = 0;
    h.room.spawnAccum = -1_000_000;
    const player = h.state().players.get("token-player");
    player.x = h.room.map.spawnX;
    player.y = h.room.map.spawnY;
    for (let i = 0; i < 6; i++) {
      const enemy = new EnemyState();
      enemy.id = `token-critter-${i}`;
      enemy.kind = "critter";
      enemy.hp = 999;
      const angle = (i / 6) * Math.PI * 2;
      enemy.x = player.x + Math.cos(angle) * 42;
      enemy.y = player.y + Math.sin(angle) * 42;
      h.state().enemies.set(enemy.id, enemy);
    }

    h.tick(1);
    expect(h.room.meleeAttackTokens.count(player.id)).toBe(3);
    const phases = [...h.room.comboState.values()].map((state: AnyRoom) => state.phase);
    expect(phases.filter((phase: string) => phase === "windup")).toHaveLength(3);
    expect(phases.filter((phase: string) => phase === "idle")).toHaveLength(3);

    h.state().enemies.delete("token-critter-0");
    h.tick(1);
    expect(h.room.meleeAttackTokens.count(player.id)).toBe(3);
    expect(h.room.comboState.get("token-critter-3")?.phase).toBe("windup");
  });

  it("lets a roll opened at the white pop evade the committed impact", () => {
    const h = makeRoom();
    h.join("roll-player");
    h.room.map.tiles.fill(TILE_GROUND);
    const player = h.state().players.get("roll-player");
    player.x = h.room.map.spawnX;
    player.y = h.room.map.spawnY;
    const enemy = new EnemyState();
    enemy.id = "roll-critter";
    enemy.kind = "critter";
    enemy.hp = 999;
    enemy.x = player.x + 40;
    enemy.y = player.y;
    h.state().enemies.set(enemy.id, enemy);
    for (let i = 0; i < 24 && enemy.commitSeq === 0; i++) h.tick(1);
    expect(enemy.commitSeq).toBe(1);

    const combat = h.room.combat.get(player.id);
    combat.stance = enemyComboShared.STANCE_SLIDE;
    combat.slidePhase = enemyComboShared.SLIDE_PHASE_GROUND;
    combat.slidePhaseTick = 0;
    combat.momentumX = 1;
    combat.momentumY = 0;
    const hp = player.hp;
    const dodged = player.dodgedSeq;
    h.tick(enemyComboShared.ENEMY_MELEE_COMMIT_TICKS);
    expect(enemy.atkSeq).toBe(1);
    expect(player.hp).toBe(hp);
    expect(player.dodgedSeq).toBe(dodged + 1);
  });
});

describe("GameRoom — server-authoritative money drops", () => {
  it("a chest payout outside reach grants nothing before collection", () => {
    const h = makeRoom();
    h.join("p1");
    const player = h.state().players.get("p1");
    player.x = h.room.map.spawnX;
    player.y = h.room.map.spawnY;
    const payout = 9;
    h.room.dropMoney(player.x + MONEY_PANEL.BASE_MONEY_DROP_REACH + 90, player.y, payout, player.id);

    expect(player.scrip).toBe(0);
    expect(h.state().moneyDrops.size).toBe(1);
    const drop = [...h.state().moneyDrops.values()][0];
    expect(drop?.value).toBe(payout);
    expect(drop?.ownerId).toBe(player.id);
    h.tick(30);
    expect(player.scrip).toBe(0);
    expect(h.state().moneyDrops.size).toBe(1);
  });

  it("latches one collector, then credits the existing squad scrip rail on arrival", () => {
    const h = makeRoom();
    h.join("p1");
    h.join("p2");
    const p1 = h.state().players.get("p1");
    const p2 = h.state().players.get("p2");
    p1.x = h.room.map.spawnX;
    p1.y = h.room.map.spawnY;
    p2.x = p1.x + 500;
    p2.y = p1.y;
    p2.alive = false;
    h.room.dropMoney(p1.x + 100, p1.y, 5);
    const drop = [...h.state().moneyDrops.values()][0];
    expect(drop).toBeDefined();

    for (let i = 0; i < 12 && !drop.collectorId; i++) h.tick(1);
    expect(drop.collectorId).toBe("p1");
    expect([p1.scrip, p2.scrip]).toEqual([0, 0]);
    while (h.state().tick < drop.collectTick) h.tick(1);
    expect(drop.delivered).toBe(true);
    expect([p1.scrip, p2.scrip]).toEqual([5, 5]);
    h.tick(1);
    expect(h.state().moneyDrops.has(drop.id)).toBe(false);
  });

  it("chooses the nearest eligible player with a stable session-id tie break", () => {
    const h = makeRoom();
    h.join("p2");
    h.join("p1");
    const p1 = h.state().players.get("p1");
    const p2 = h.state().players.get("p2");
    const x = h.room.map.spawnX;
    const y = h.room.map.spawnY;
    p1.x = x - 60;
    p1.y = y;
    p2.x = x + 60;
    p2.y = y;
    h.room.dropMoney(x, y, 1);
    const drop = [...h.state().moneyDrops.values()][0];

    for (let i = 0; i < 10 && !drop.collectorId; i++) h.tick(1);

    expect(drop.collectorId).toBe("p1");
  });

  it("caps 200 paid sources at 48 synchronized rows while conserving their exact value", () => {
    const h = makeRoom();
    h.join("p1");
    const player = h.state().players.get("p1");
    player.x = 100;
    player.y = 100;
    for (let i = 0; i < 200; i++) {
      h.room.dropMoney(600 + (i % 10) * 100, 600 + Math.floor(i / 10) * 100, 1);
    }

    expect(h.state().moneyDrops.size).toBe(MONEY_PANEL.MAX_MONEY_DROPS);
    expect([...h.state().moneyDrops.values()].reduce((sum, drop) => sum + drop.value, 0)).toBe(200);
  });

  it("retargets a flight when its collector disconnects without duplicating money", () => {
    const h = makeRoom();
    h.join("p1");
    h.join("p2");
    const p1 = h.state().players.get("p1");
    const p2 = h.state().players.get("p2");
    p1.x = h.room.map.spawnX;
    p1.y = h.room.map.spawnY;
    p2.x = p1.x + 160;
    p2.y = p1.y;
    h.room.dropMoney(p1.x + 60, p1.y, 2);
    const drop = [...h.state().moneyDrops.values()][0];
    for (let i = 0; i < 10 && !drop.collectorId; i++) h.tick(1);
    expect(drop.collectorId).toBe("p1");

    h.room.clients = h.room.clients.filter(
      (client: { sessionId: string }) => client.sessionId !== "p1",
    );
    h.room.onLeave({ sessionId: "p1" });
    for (let i = 0; i < 16 && p2.scrip === 0; i++) h.tick(1);

    expect(p2.scrip).toBe(2);
  });
});

describe("GameRoom — synced authoritative attack beat", () => {
  it("bumps once per accepted melee swing, never per hit or whirlwind revolution", () => {
    const h = makeRoom();
    h.join("melee-beat");
    h.state().mode = "training";
    h.room.map.tiles.fill(TILE_GROUND);
    h.room.map.pois.length = 0;
    const player = h.state().players.get("melee-beat");
    player.weapon = "x-sword-whirlwind";
    h.tick(1); // settle the weapon swap before arming an attack

    const enemy = new EnemyState();
    enemy.id = "beat-target";
    enemy.kind = "ronin";
    enemy.hp = 100000;
    enemy.x = player.x + 80;
    enemy.y = player.y;
    h.state().enemies.set(enemy.id, enemy);

    h.send("melee-beat", "attack", { aimX: 1, aimY: 0 });
    expect(player.attackSeq).toBe(0); // request arrival is not the authoritative edge
    const acceptedTick = h.state().tick + 1;
    h.tick(1);
    expect(player.attackSeq).toBe(1);
    expect(player.attackTick).toBe(acceptedTick);

    for (let i = 0; i < 24; i++) {
      enemy.x = player.x + 80;
      enemy.y = player.y;
      h.tick(1);
    }
    expect(enemy.hp).toBeLessThan(100000); // the swept state machine actually processed hits/revolutions
    expect(player.attackSeq).toBe(1);

    h.send("melee-beat", "attack", { aimX: 1, aimY: 0 });
    h.tick(1);
    expect(player.attackSeq).toBe(2); // the next accepted descriptor is exactly one new edge
  });

  it("bumps once when a gun shot actually fires and stamps that acceptance tick", () => {
    const h = makeRoom();
    h.join("gun-beat");
    const player = h.state().players.get("gun-beat");
    player.weapon = "x-gun-revolver-cannon";
    h.tick(1);

    h.send("gun-beat", "attack", { aimX: 1, aimY: 0 });
    expect(player.attackSeq).toBe(0);
    const acceptedTick = h.state().tick + 1;
    h.tick(1);

    expect(player.attackSeq).toBe(1);
    expect(player.attackTick).toBe(acceptedTick);
    expect(player.attackHeld).toBe(true);
  });

  it("refreshes attackHeld across rapid accepted shots, then clears it at the tick window", () => {
    const h = makeRoom();
    h.join("held-beat");
    const player = h.state().players.get("held-beat");
    player.weapon = "x-gun-gatling";
    h.tick(1);

    let lapsedDuringRapidFire = false;
    for (let i = 0; i < 10 && player.attackSeq < 3; i++) {
      h.send("held-beat", "attack", { aimX: 1, aimY: 0 });
      h.tick(1);
      if (player.attackSeq > 0 && !player.attackHeld) lapsedDuringRapidFire = true;
    }
    expect(player.attackSeq).toBeGreaterThanOrEqual(3);
    expect(lapsedDuringRapidFire).toBe(false);
    expect(player.attackHeld).toBe(true);
    expect(player.attackTick).toBe(h.state().tick); // loop stops on the latest accepted shot

    h.tick(ATTACK_HELD_WINDOW_TICKS - 1);
    expect(player.attackHeld).toBe(true);
    h.tick(1);
    expect(player.attackHeld).toBe(false);
  });

  it("does not treat an accepted parry as an attack beat", () => {
    const h = makeRoom();
    h.join("parry-beat");
    const player = h.state().players.get("parry-beat");
    const combat = h.room.combat.get("parry-beat");

    h.send("parry-beat", "parry");

    expect(combat.invuln).toBeGreaterThan(0); // parry was accepted and executed
    expect(combat.parryCd).toBeGreaterThan(0);
    expect(player.attackSeq).toBe(0);
    expect(player.attackTick).toBe(0);
    expect(player.attackHeld).toBe(false);
  });

  it("does not bump for a cooldown-gated attack whose buffer lapses", () => {
    const h = makeRoom();
    h.join("gated-beat");
    const player = h.state().players.get("gated-beat");
    player.weapon = FISTS_WEAPON;
    h.tick(1);
    const combat = h.room.combat.get("gated-beat");
    combat.cd = 0.5;

    h.send("gated-beat", "attack", { aimX: 1, aimY: 0 });
    h.tick(4); // 0.20s: beyond the 0.15s attack buffer, still inside the forced cooldown

    expect(combat.attackBuffer).toBe(0);
    expect(player.attackSeq).toBe(0);
    expect(player.attackTick).toBe(0);
    expect(player.attackHeld).toBe(false);
  });

  it("stamps an accepted caster cast on the same shared attack beat", () => {
    const h = makeRoom();
    h.join("cast-beat");
    const player = h.state().players.get("cast-beat");
    player.weapon = "x-staff-arcane-lance";
    h.tick(1);

    h.send("cast-beat", "attack", { aimX: 1, aimY: 0 });
    h.tick(1);

    expect(player.attackSeq).toBe(1);
    expect(player.attackTick).toBe(h.state().tick);
    expect(h.state().projectiles.size).toBeGreaterThan(0);
  });
});

describe("GameRoom — beam channel authority", () => {
  it("keeps charge non-damaging and opens authority only after the 0.65s gate", () => {
    const { h, player, combat } = makeBeamRoom("beam-charge");
    const enemy = putBeamDummy(h, player);
    const hp = enemy.hp;
    const chargeTicks = Math.round(BEAM_CHARGE_SECONDS / 0.05);

    for (let seq = 1; seq < chargeTicks; seq++) sendBeamFrame(h, player.id, seq, true);
    expect(enemy.hp).toBe(hp);
    expect(combat.beamPhase).toBe(1);
    expect(h.state().beams.get(player.id)?.phase).toBe(SyncedBeamPhase.Charging);

    sendBeamFrame(h, player.id, chargeTicks, true);
    expect(combat.beamPhase).toBe(2);
    expect(h.state().beams.get(player.id)?.phase).toBe(SyncedBeamPhase.Active);
    expect(enemy.hp).toBe(hp); // the first live slice is still held for the 0.25s crit quantum
  });

  it("deals actual-dt DPS through one swept-grid query per live server tick", () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(1);
    try {
      const { h, player, combat } = makeBeamRoom("beam-dps");
      const enemy = putBeamDummy(h, player);
      const hp = enemy.hp;
      const chargeTicks = Math.round(BEAM_CHARGE_SECONDS / 0.05);
      for (let seq = 1; seq < chargeTicks; seq++) sendBeamFrame(h, player.id, seq, true);

      const query = vi.spyOn(h.room.enemyGrid, "queryAabb");
      const queryCounts: number[] = [];
      const originalSweep = h.room.damageBeamSweep.bind(h.room);
      vi.spyOn(h.room, "damageBeamSweep").mockImplementation((...args: unknown[]) => {
        const before = query.mock.calls.length;
        const result = originalSweep(...args);
        queryCounts.push(query.mock.calls.length - before);
        return result;
      });
      sendBeamFrame(h, player.id, chargeTicks, true);
      expect(enemy.hp).toBe(hp);
      sendBeamFrame(h, player.id, chargeTicks + 1, true);
      expect(hp - enemy.hp).toBeCloseTo(combat.beamDescriptor.damagePerSecond * 0.1, 6);
      for (let i = 2; i < 20; i++) sendBeamFrame(h, player.id, chargeTicks + i, true);

      expect(queryCounts).toHaveLength(20);
      expect(queryCounts.every((count) => count === 1)).toBe(true);
      expect(hp - enemy.hp).toBeCloseTo(combat.beamDescriptor.damagePerSecond, 6);
      expect(combat.beamChannelT).toBeCloseTo(1, 8);
    } finally {
      random.mockRestore();
    }
  });

  it("empties Drive after the old channel cap and restarts on the same 68-tick cycle", () => {
    const { h, player, combat } = makeBeamRoom("beam-heat");
    const chargeTicks = Math.round(BEAM_CHARGE_SECONDS / 0.05);
    for (let seq = 1; seq < chargeTicks; seq++) sendBeamFrame(h, player.id, seq, true);
    for (let i = 0; i < 25; i++) sendBeamFrame(h, player.id, chargeTicks + i, true);

    expect(combat.beamPhase).toBe(0);
    expect(combat.drive.valueF).toBe(0);
    expect(player.weaponResource.valueQ).toBe(0);
    expect(combat.drive.beamLockEndTick - h.state().tick).toBe(
      Math.round(BEAM_LOCK_SECONDS / 0.05),
    );
    expect(combat.drive.beamRequireRelease).toBe(true);
    expect(h.state().beams.get(player.id)?.phase).toBe(SyncedBeamPhase.Overheated);

    let recoveryTicks = 0;
    let seq = chargeTicks + 25;
    for (let i = 0; i < 35; i++) {
      sendBeamFrame(h, player.id, seq++, true);
      recoveryTicks++;
    }
    expect(combat.beamPhase).toBe(0);
    expect(combat.drive.valueF).toBeCloseTo(35, 8);
    expect(combat.drive.beamRequireRelease).toBe(true); // recovery cannot queue a held restart

    while (combat.drive.valueF + 1e-9 < BEAM_RESTART_DRIVE) {
      sendBeamFrame(h, player.id, seq++, false);
      recoveryTicks++;
    }
    expect(recoveryTicks).toBe(68); // old heat: 30 lock + 38 cool; Drive: 68 / (20/s @ 20Hz)
    sendBeamFrame(h, player.id, seq, true);
    expect(combat.drive.beamRequireRelease).toBe(false);
    expect(combat.beamPhase).toBe(1);
    expect(h.state().beams.get(player.id)?.phase).toBe(SyncedBeamPhase.Charging);
  });

  it("starts and stops through input state without spending ACTION_MSGS_PER_TICK", () => {
    const { h, player, combat } = makeBeamRoom("beam-budget");
    const input = h.room.inputs.get(player.id);
    expect(input.actionBudget).toBe(ACTION_MSGS_PER_TICK);

    for (let i = 0; i < ACTION_MSGS_PER_TICK * 2; i++) {
      h.send(player.id, "attack", { aimX: 1, aimY: 0 });
    }
    expect(input.actionBudget).toBe(ACTION_MSGS_PER_TICK);

    sendBeamFrame(h, player.id, 1, true);
    expect(combat.beamPhase).toBe(1);
    sendBeamFrame(h, player.id, 2, false);
    expect(combat.beamPhase).toBe(0);
    expect(input.actionBudget).toBe(ACTION_MSGS_PER_TICK);
  });

  it("keeps the authoritative muzzle origin attached while the shooter moves during fire", () => {
    const { h, player } = makeBeamRoom("beam-moving-origin");
    const chargeTicks = Math.round(BEAM_CHARGE_SECONDS / 0.05);
    for (let seq = 1; seq <= chargeTicks; seq++) sendBeamFrame(h, player.id, seq, true);

    const beforePlayerX = player.x;
    const beforePlayerY = player.y;
    const beforeRow = h.state().beams.get(player.id);
    expect(beforeRow?.phase).toBe(SyncedBeamPhase.Active);
    const beforeOriginX = beforeRow.originX;
    const beforeOriginY = beforeRow.originY;
    const muzzleOffsetX = beforeOriginX - beforePlayerX;
    const muzzleOffsetY = beforeOriginY - beforePlayerY;

    h.send(player.id, "input", {
      seq: chargeTicks + 1,
      dx: 0,
      dy: 1,
      jump: false,
      fireHeld: true,
      aimX: 1,
      aimY: 0,
      targetX: player.x + 500,
      targetY: player.y,
    });
    h.tick(1);

    const movedRow = h.state().beams.get(player.id);
    expect(player.y).toBeGreaterThan(beforePlayerY);
    expect(movedRow.phase).toBe(SyncedBeamPhase.Active);
    expect(movedRow.previousOriginX).toBeCloseTo(beforeOriginX, 8);
    expect(movedRow.previousOriginY).toBeCloseTo(beforeOriginY, 8);
    expect(movedRow.originX - player.x).toBeCloseTo(muzzleOffsetX, 8);
    expect(movedRow.originY - player.y).toBeCloseTo(muzzleOffsetY, 8);
    expect(movedRow.originY - beforeOriginY).toBeCloseTo(player.y - beforePlayerY, 8);
  });
});
