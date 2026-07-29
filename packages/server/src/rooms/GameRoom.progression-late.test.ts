import {
  ACTION_MSGS_PER_TICK,
  AUGMENTS,
  BELT_LEVEL_IDS,
  BELT_Y0,
  beltLevelFor,
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
  MAX_ENEMIES,
  META_VITALITY_HP,
  MoneyDropState,
  makeRng,
  PARRY_CHAIN_RIPOSTE_AT,
  PARRY_GUARD_RESET_TICKS,
  PARRY_IFRAMES,
  PARRY_LAUNCH,
  ParryReaction,
  LAVA_GAP_FALL_DAMAGE_FRAC,
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
  unpackParryGuardPose,
  unpackParryReaction,
  ULTIMATES_ENABLED,
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
// individual tests then author only the state they need.
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
  const player = h.state().players.get(id);
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
    px: player.x,
    py: player.y,
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
  const player = h.state().players.get(id);
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
    px: player.x,
    py: player.y,
  });
  h.tick(1);
}

function makeRollRoom(id = "roll-player") {
  const fixture = makeJumpFeelRoom(id);
  return { ...fixture, combatInput: fixture.h.room.inputs.get(id) };
}

function presentRollBody(fixture: ReturnType<typeof makeRollRoom>) {
  const body = fixture.h.room.presentedSelfBodies.get(fixture.player.id);
  body.x = fixture.player.x;
  body.y = fixture.player.y;
  body.reported = true;
  body.hittable = true;
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


describe("GameRoom — whole-art join selection authority", () => {
  it("defaults a missing selection to the hidden-face cowboy", () => {
    const h = makeRoom();
    h.join("default-character");
    const player = h.state().players.get("default-character");

    expect([player.character, player.runCharacter]).toEqual([
      enemyComboShared.DEFAULT_CHARACTER,
      enemyComboShared.DEFAULT_CHARACTER,
    ]);
    expect(enemyComboShared.DEFAULT_CHARACTER).toBe("proto-cowboy-hidden-face");
  });

  it.each(
    enemyComboShared.WHOLE_ART_CHARACTERS,
  )("accepts the installed whole-art selection %s", (selectedCharacterId) => {
    const h = makeRoom();
    const client = { sessionId: `selected-${selectedCharacterId}` };
    const metaAccount = enemyComboShared.createMetaAccountV5();
    metaAccount.unlockedCharacters = [...enemyComboShared.WHOLE_ART_CHARACTERS];
    h.room.clients.push(client);
    h.room.onJoin(client, { selectedCharacterId, metaAccount });
    const player = h.state().players.get(client.sessionId);

    expect([player.character, player.runCharacter]).toEqual([
      selectedCharacterId,
      selectedCharacterId,
    ]);
  });

  it("repairs a valid but account-locked character selection to the starter", () => {
    const h = makeRoom();
    const client = { sessionId: "locked-character" };
    h.room.clients.push(client);
    h.room.onJoin(client, {
      selectedCharacterId: "proto-blue-spectral-demon-hunter",
      metaAccount: enemyComboShared.createMetaAccountV5(),
    });
    const player = h.state().players.get(client.sessionId);
    expect([player.character, player.runCharacter]).toEqual([
      enemyComboShared.DEFAULT_CHARACTER,
      enemyComboShared.DEFAULT_CHARACTER,
    ]);
  });

  it.each([
    "drifter",
    "cc-asha-the-ash-walker",
    "unknown-character",
  ])("falls back to the hidden-face cowboy for legacy or unknown selection %s", (selectedCharacterId) => {
    const h = makeRoom();
    const client = { sessionId: `invalid-${selectedCharacterId}` };
    h.room.clients.push(client);
    h.room.onJoin(client, { selectedCharacterId });
    const player = h.state().players.get(client.sessionId);

    expect([player.character, player.runCharacter]).toEqual([
      "proto-cowboy-hidden-face",
      "proto-cowboy-hidden-face",
    ]);
  });

  it("cycles only within the whole-art subset and resets a legacy id to the shared default", () => {
    const h = makeRoom();
    h.join("whole-art-cycle");
    const player = h.state().players.get("whole-art-cycle");
    player.character = "drifter";
    const seen = new Set<string>();

    for (let i = 0; i < enemyComboShared.WHOLE_ART_CHARACTERS.length * 2; i++) {
      h.tick(1);
      h.send("whole-art-cycle", "cycleCharacter");
      seen.add(player.character);
    }

    expect([...seen].every((id) => enemyComboShared.isWholeArtCharacter(id))).toBe(true);
    expect(seen.has("drifter")).toBe(false);
    expect([...seen].some((id) => id.startsWith("cc-"))).toBe(false);
  });
});

// B20 L1 — character identity remains flavor-only; quirks keep their non-stat behavior.
describe("GameRoom — flavor-only character identity", () => {
  it("keeps C cosmetic mid-run, then snapshots the worn identity on restart and rift descent", () => {
    const h = makeRoom();
    h.join("identity");
    const player = h.state().players.get("identity");
    const combat = h.room.combat.get("identity");
    expect(player.runCharacter).toBe("proto-cowboy-hidden-face");
    expect(["str", "dex", "int", "con", "luk"].some((key) => key in player)).toBe(false);

    h.send("identity", "cycleCharacter");
    expect(player.character).toBe("proto-cyberpunk-hacker");
    expect(player.runCharacter).toBe("proto-cowboy-hidden-face");
    expect(combat.identityCharacter).toBe("proto-cowboy-hidden-face");

    h.room.restartRun();
    expect(player.runCharacter).toBe("proto-cyberpunk-hacker");
    expect(combat.identityCharacter).toBe(player.runCharacter);

    h.tick(1); // refill the action budget
    h.send("identity", "cycleCharacter");
    expect(player.character).toBe("proto-desert-nomad");
    h.room.visitedDims.add("lava-foundry");
    h.room.transitionDimension();
    expect(player.runCharacter).toBe("proto-desert-nomad");
  });

  it("re-snapshots every training cycle without installing numeric stats", () => {
    const h = makeRoom();
    h.join("training-kit");
    const player = h.state().players.get("training-kit");
    h.send("training-kit", "toggleTraining");
    h.send("training-kit", "cycleCharacter");

    expect(player.character).toBe("proto-cyberpunk-hacker");
    expect(player.runCharacter).toBe(player.character);
    expect(["str", "dex", "int", "con", "luk"].some((key) => key in player)).toBe(false);
    expect(player.maxHp).toBe(PLAYER_MAX_HP);
    expect(player.hp).toBe(player.maxHp);
  });

  it("applies a cached scalar quirk at the existing parry knockback computation", () => {
    const h = makeRoom();
    h.join("kuro");
    h.send("kuro", "toggleTraining");
    h.send("kuro", "devEquip", { character: "cc-kuro-oni-the-demon-mask" });
    const player = h.state().players.get("kuro");
    const combat = h.room.combat.get("kuro");
    const enemy = new EnemyState();
    enemy.id = "temple-wall-target";
    enemy.kind = "critter";
    enemy.hp = 20;
    enemy.x = player.x + 40;
    enemy.y = player.y;
    h.state().enemies.set(enemy.id, enemy);
    const before = enemy.x;

    h.room.executeParry(player, combat);

    expect(combat.quirk.id).toBe("temple-wall");
    expect(enemy.x - before).toBeCloseTo(enemyComboShared.PARRY_KNOCKBACK * 2, 6);
  });

  it("applies a pure onParrySuccess descriptor through the nearest-ally heal seam", () => {
    const h = makeRoom();
    h.join("asha");
    h.join("ally");
    h.send("asha", "toggleTraining");
    h.send("asha", "devEquip", { character: "cc-asha-the-ash-walker" });
    const player = h.state().players.get("asha");
    const ally = h.state().players.get("ally");
    const combat = h.room.combat.get("asha");
    player.x = h.room.map.spawnX;
    player.y = h.room.map.spawnY;
    ally.x = player.x + 20;
    ally.y = player.y;
    ally.hp = 20;
    const enemy = new EnemyState();
    enemy.id = "mend-target";
    enemy.kind = "critter";
    enemy.hp = 20;
    enemy.x = player.x + 40;
    enemy.y = player.y;
    const before = ally.hp;

    h.room.resolveParry(player, combat, enemy, enemy.id);

    expect(combat.quirk.id).toBe("mend-the-broken");
    expect(ally.hp - before).toBe(enemyComboShared.PARRY_CHAIN_HEAL);
  });

  it("retains schema 21 while defaulting character identity to the shared default", () => {
    const player = new enemyComboShared.PlayerState();
    expect(enemyComboShared.SCHEMA_VERSION).toBe(51);
    expect([player.character, player.runCharacter]).toEqual([
      enemyComboShared.DEFAULT_CHARACTER,
      enemyComboShared.DEFAULT_CHARACTER,
    ]);
    expect(enemyComboShared.DEFAULT_CHARACTER).toBe("proto-cowboy-hidden-face");
  });
});

describe("GameRoom — V7 fixed tumble roll", () => {
  it("reserves one traversal edge after four catch-up heartbeats exhaust the ordinary tick budget", () => {
    const fixture = makeRollRoom("roll-reserved-edge");
    for (let seq = 1; seq <= enemyComboShared.INPUT_MSGS_PER_TICK; seq++) {
      fixture.h.send(fixture.player.id, "input", {
        seq,
        dx: 1,
        dy: 0,
        jump: false,
        crouchHeld: false,
        pound: false,
        slide: false,
        slideHeld: false,
        fireHeld: false,
        aimX: 1,
        aimY: 0,
        targetX: 0,
        targetY: 0,
      });
    }
    const edgeSeq = enemyComboShared.INPUT_MSGS_PER_TICK + 1;
    fixture.h.send(fixture.player.id, "input", {
      seq: edgeSeq,
      dx: -1,
      dy: 0,
      jump: false,
      crouchHeld: false,
      pound: false,
      slide: true,
      slideHeld: true,
      fireHeld: false,
      aimX: -1,
      aimY: 0,
      targetX: 0,
      targetY: 0,
    });

    fixture.h.tick(1);

    expect(fixture.player.ackSeq).toBe(edgeSeq);
    expect(fixture.combat.stance).toBe(enemyComboShared.STANCE_SLIDE);
    expect(fixture.combat.momentumX).toBeLessThan(0);
  });

  it("accepts from rest, freezes cardinal/diagonal direction, and travels 188 px in eight ticks", () => {
    for (const [name, dx, dy] of [
      ["east", 1, 0],
      ["west", -1, 0],
      ["northeast", 1, -1],
      ["southwest", -1, 1],
    ] as const) {
      const fixture = makeRollRoom(`roll-distance-${name}`);
      const startX = fixture.player.x;
      const startY = fixture.player.y;
      beginRoll(fixture, 1, dx, dy);
      for (let seq = 2; seq <= enemyComboShared.ROLL_DURATION_TICKS; seq++)
        sendRollInput(fixture.h, fixture.player.id, seq, { dx: -dy, dy: dx });
      expect(fixture.combat.stance).toBe(enemyComboShared.STANCE_NONE);
      const movedX = fixture.player.x - startX;
      const movedY = fixture.player.y - startY;
      expect(Math.hypot(movedX, movedY)).toBeCloseTo(enemyComboShared.ROLL_DISTANCE, 6);
      const length = Math.hypot(dx, dy);
      expect(movedX / enemyComboShared.ROLL_DISTANCE).toBeCloseTo(dx / length, 6);
      expect(movedY / enemyComboShared.ROLL_DISTANCE).toBeCloseTo(dy / length, 6);
      expect(fixture.combat.rollCd).toBeGreaterThan(2.9);
      expect([fixture.player.momentumX, fixture.player.momentumY]).toEqual([0, 0]);
    }
  });

  it("rejects the immediate repeat for three seconds, then accepts a new edge", () => {
    const fixture = makeRollRoom("roll-cooldown");
    beginRoll(fixture);
    fixture.h.tick(enemyComboShared.ROLL_DURATION_TICKS - 1);
    expect(fixture.combat.stance).toBe(enemyComboShared.STANCE_NONE);
    sendRollInput(fixture.h, fixture.player.id, 2, { dx: 1, roll: true });
    expect(fixture.combat.stance).toBe(enemyComboShared.STANCE_NONE);
    fixture.h.tick(Math.ceil(enemyComboShared.ROLL_COOLDOWN / 0.05));
    beginRoll(fixture, 3);
  });

  it("derives exactly five contact opening ticks before the vulnerable moving tail", () => {
    const fixture = makeRollRoom("roll-defensive-window");
    beginRoll(fixture);
    const hp = fixture.player.hp;
    const parried = fixture.player.parriedSeq;
    for (let tick = 1; tick <= enemyComboShared.ROLL_IFRAME_TICKS; tick++) {
      presentRollBody(fixture);
      fixture.h.room.applyBossMelee(fixture.player.x - 20, fixture.player.y, 1, 0, 80, 1, 7, 0);
      expect(fixture.player.hp).toBe(hp);
      if (tick < enemyComboShared.ROLL_IFRAME_TICKS) fixture.h.tick(1);
    }
    expect(fixture.player.parriedSeq).toBe(parried);
    fixture.h.tick(1);
    presentRollBody(fixture);
    fixture.h.room.applyBossMelee(fixture.player.x - 20, fixture.player.y, 1, 0, 80, 1, 7, 0);
    expect(fixture.player.hp).toBe(hp - 7);
  });

  it("null-whiffs hostile projectiles and locked melee without reflection or parry reward", () => {
    const projectileFixture = makeRollRoom("roll-projectile");
    beginRoll(projectileFixture);
    projectileFixture.h.room.fireProjectile(
      { x: projectileFixture.player.x, y: projectileFixture.player.y },
      { x: projectileFixture.player.x + 1, y: projectileFixture.player.y },
      0,
      13,
    );
    const projectile = [...projectileFixture.h.state().projectiles.values()].at(-1);
    expect(projectile).toBeDefined();
    if (!projectile) throw new Error("expected hostile roll fixture projectile");
    projectileFixture.h.room.stepProjectiles(0.05);
    expect(projectileFixture.player.hp).toBe(projectileFixture.player.maxHp);
    expect(projectileFixture.h.state().projectiles.has(projectile.id)).toBe(true);
    expect(projectile.hostile).toBe(true);

    const locked = makeRollRoom("roll-locked-melee");
    beginRoll(locked);
    const enemy = addRollMeleeEnemy(locked, "roll-duelist");
    locked.combat.parryChain = 2;
    const enemyX = enemy.x;
    const parried = locked.player.parriedSeq;
    locked.h.room.duelistSwing(
      enemy,
      enemy.id,
      locked.player,
      { range: 200, halfArc: 1.2, damage: 20 },
      { aimX: 1, aimY: 0 },
    );
    expect(locked.player.hp).toBe(locked.player.maxHp);
    expect(locked.player.parriedSeq).toBe(parried);
    expect(locked.combat.parryChain).toBe(2);
    expect(enemy.x).toBe(enemyX);
  });

  it("does not broaden the opening to AoE, quake, beam, ring, or puddle damage", () => {
    const cases = [
      [
        "aoe",
        (f: ReturnType<typeof makeRollRoom>) =>
          f.h.room.applyBossAoE(f.player.x, f.player.y, 80, 9, 0),
      ],
      [
        "quake",
        (f: ReturnType<typeof makeRollRoom>) =>
          f.h.room.applyBossQuake(f.player.x, f.player.y, 80, 9, 0),
      ],
      [
        "beam",
        (f: ReturnType<typeof makeRollRoom>) =>
          f.h.room.damageBeamRect(f.player.x - 20, f.player.y, 40, 20, 0, 9, 0),
      ],
      [
        "ring",
        (f: ReturnType<typeof makeRollRoom>) =>
          f.h.room.damageRingBand(f.player.x - 50, f.player.y, 50, 2, 0, 0, 9),
      ],
    ] as const;
    for (const [name, damage] of cases) {
      const fixture = makeRollRoom(`roll-${name}`);
      beginRoll(fixture);
      const hp = fixture.player.hp;
      presentRollBody(fixture);
      damage(fixture);
      expect(fixture.player.hp).toBe(hp - 9);
    }

    const puddle = makeRollRoom("roll-puddle");
    beginRoll(puddle);
    const zone = new ZoneState();
    zone.id = "roll-puddle-zone";
    zone.x = puddle.player.x;
    zone.y = puddle.player.y;
    zone.radius = ZONE_RADIUS;
    puddle.h.state().zones.set(zone.id, zone);
    puddle.h.room.zoneMeta.set(zone.id, ZONE_TTL);
    const hp = puddle.player.hp;
    presentRollBody(puddle);
    puddle.h.room.stepZones(0.05);
    expect(puddle.player.hp).toBeLessThan(hp);
  });

  it("keeps the attack/parry channel split", () => {
    const attack = makeRollRoom("roll-attack");
    beginRoll(attack);
    attack.h.send(attack.player.id, "attack", { aimX: 1, aimY: 0 });
    expect(attack.combat.stance).toBe(enemyComboShared.STANCE_SLIDE);
    attack.h.tick(enemyComboShared.ROLL_ATTACK_CANCEL_TICKS - 1);
    attack.h.send(attack.player.id, "attack", { aimX: 1, aimY: 0 });
    expect(attack.combat.stance).toBe(enemyComboShared.STANCE_NONE);
    expect(attack.combat.attackBuffer).toBeGreaterThan(0);

    const parry = makeRollRoom("roll-parry-lock");
    beginRoll(parry);
    for (let tick = 1; tick < enemyComboShared.ROLL_PARRY_LOCK_TICKS; tick++) {
      parry.h.send(parry.player.id, "parry");
      parry.h.tick(1);
      expect(parry.combat.invuln).toBe(0);
    }
    parry.h.send(parry.player.id, "parry");
    parry.h.tick(1);
    expect(parry.combat.invuln).toBeGreaterThan(0);
  });

  it("buffers Space through the roll tail into the default long jump", () => {
    const fixture = makeRollRoom("roll-to-long-jump");
    beginRoll(fixture);
    sendRollInput(fixture.h, fixture.player.id, 2, { dx: 1, jump: true });
    expect(fixture.combat.jumpBuffer).toBeGreaterThan(0);
    fixture.h.tick(enemyComboShared.ROLL_DURATION_TICKS - 1);
    expect(fixture.combat.stance).toBe(enemyComboShared.STANCE_DASH);
    expect(fixture.player.height).toBeGreaterThan(0);
  });

  it("keeps the append-only predictor wire defaults", () => {
    const player = new enemyComboShared.PlayerState();
    expect([player.momentumX, player.momentumY, player.slidePhase, player.slidePhaseTick]).toEqual([
      0, 0, 0, 0,
    ]);
  });
});

// MAP QOL wave — appended only. These lock the intentional post-schema-23 ordering and the new objective /
// director postconditions without weakening any historical deterministic fixture above.
describe("GameRoom — MAP QOL extraction intent and tick-order fairness", () => {
  it("opens gates with no boss weapon drop, then denies corpse-position carryover until a fresh hold", () => {
    const h = makeRoom();
    h.join("qol-extract");
    h.room.map.tiles.fill(TILE_GROUND);
    h.room.spawnAccum = -1_000_000;
    h.room.shifterCd = 1_000_000;
    const player = h.state().players.get("qol-extract");
    player.x = h.room.map.spawnX;
    player.y = h.room.map.spawnY;
    const boss = new EnemyState();
    boss.id = "qol-boss";
    boss.kind = "old-rust";
    boss.hp = 1;
    boss.x = player.x;
    boss.y = player.y;
    h.state().enemies.set(boss.id, boss);
    h.room.damageEnemy(boss, boss.id, 1, []);
    expect(h.state().pickups.size).toBe(0);
    expect([h.state().portalX, h.state().portalY]).toEqual([player.x, player.y]);

    // More than arm+hold time while pre-held on the corpse must never bank the run.
    h.tick(40);
    expect(h.state().outcome).toBe("active");
    // Leave after arming, freshly enter, and complete the explicit 0.75s hold.
    player.x = h.state().portalX + enemyComboShared.EXTRACT_RADIUS + 30;
    player.y = h.state().portalY;
    h.tick(1);
    player.x = h.state().portalX;
    h.tick(14);
    expect(h.state().outcome).toBe("active");
    h.tick(1);
    expect(h.state().outcome).toBe("victory");
  });

});

describe("GameRoom — MAP QOL final enemy-spawn fairness", () => {
  it("keeps every final clamp/snap-in result outside all living warning circles and camera rectangles across seeds", () => {
    const h = makeRoom();
    h.join("qol-spawn-a");
    h.join("qol-spawn-b");
    const a = h.state().players.get("qol-spawn-a");
    const b = h.state().players.get("qol-spawn-b");
    a.x = 120;
    a.y = 120;
    b.x = 520;
    b.y = 120;
    const rng = enemyComboShared.makeRng(0x51a0f00d);
    const random = vi.spyOn(Math, "random").mockImplementation(() => rng.next());
    let spawned = 0;
    try {
      for (let seed = 0; seed < 40; seed++) {
        h.room.map = enemyComboShared.generateArena({
          seedTerrain: seed * 2654435761,
          seedHazard: seed * 40503 + 7,
          seedTheme: seed + 1,
          seedDecor: seed * 13 + 5,
        });
        h.state().enemies.clear();
        h.room.enemyGrid.clear();
        expect(h.room.spawnEnemy([{ x: a.x, y: a.y }]), `seed ${seed} deferred`).toBe(true);
        const enemy = [...h.state().enemies.values()][0] as EnemyState | undefined;
        expect(enemy).toBeDefined();
        if (!enemy) continue;
        spawned++;
        for (const player of [a, b]) {
          const dx = enemy.x - player.x;
          const dy = enemy.y - player.y;
          expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(
            enemyComboShared.SPAWN_RING * 0.85 - 1e-6,
          );
          expect(
            Math.abs(dx) <= enemyComboShared.SPAWN_RING * 0.8 &&
              Math.abs(dy) <= enemyComboShared.SPAWN_RING * 0.5,
          ).toBe(false);
        }
      }
    } finally {
      random.mockRestore();
    }
    expect(spawned).toBe(40);
  });

});

const describeUltimateImplementation = ULTIMATES_ENABLED ? describe : describe.skip;

describeUltimateImplementation("ULT U1 flat activity charge truth and validation", () => {
  it("credits applied personal damage once, emits the ready edge, and enforces every anti-farm gate", () => {
    const { h, id, player, combat } = makeUltimateRoom(
      enemyComboShared.UltimateFamily.Seismarch,
      "dex",
      "ult-charge",
    );
    const enemy = addUltimateEnemy(h, "charge-target", 1100, 1000, 10000);
    const reset = () => {
      combat.ultChargeF = 0;
      combat.ultAccrualThisTick = 0;
      player.ultCharge = 0;
    };
    reset();
    h.room.damageEnemy(
      enemy,
      enemy.id,
      30,
      [],
      0,
      id,
      "rusty-cleaver",
      enemyComboShared.CombatDelivery.Melee,
    );
    expect(player.ultCharge).toBe(1); // Flat 30-damage activity quantum, independent of character data.

    reset();
    const dummy = addUltimateEnemy(h, "charge-dummy", 1100, 1000, DUMMY_HP, "dummy");
    h.room.damageEnemy(dummy, dummy.id, 30, [], 0, id, "rusty-cleaver", 1);
    expect(player.ultCharge).toBe(0);

    reset();
    h.state().mode = "training";
    h.room.damageEnemy(enemy, enemy.id, 30, [], 0, id, "rusty-cleaver", 1);
    expect(player.ultCharge).toBe(0);
    h.state().mode = "arena";

    reset();
    h.room.damageEnemy(
      enemy,
      enemy.id,
      300,
      [],
      0,
      id,
      "ult:test",
      enemyComboShared.CombatDelivery.Ultimate,
    );
    expect(player.ultCharge).toBe(0); // delayed ultimate payloads never charge their own next cast.

    reset();
    for (let i = 0; i < 8; i++)
      h.room.damageEnemy(enemy, enemy.id, 1000, [], 0, id, "rusty-cleaver", 1);
    expect(combat.ultChargeF).toBeCloseTo(enemyComboShared.ULT_CHARGE_TICK_CAP, 8);

    combat.ultAccrualThisTick = 0;
    combat.ultChargeF = 0.99;
    player.ultCharge = 99;
    const seq = player.ultSeq;
    h.room.damageEnemy(enemy, enemy.id, 30, [], 0, id, "rusty-cleaver", 1);
    expect(player.ultCharge).toBe(100);
    expect(player.ultSeq).toBe((seq + 1) & 0xffff);
  });

  it("rejects uncharged, downed, and juggled activations before spending", () => {
    const { h, id, player, combat } = makeUltimateRoom(
      enemyComboShared.UltimateFamily.DimensionDoor,
      "int",
      "ult-gates",
    );
    combat.ultChargeF = 0.99;
    player.ultCharge = 99;
    h.send(id, "ultimate", { tx: 1200, ty: 1000 });
    h.tick();
    expect(player.ultPhase).toBe(enemyComboShared.UltimatePhase.Idle);
    combat.ultBuffer = 0;

    combat.ultChargeF = 1;
    player.ultCharge = 100;
    combat.juggleArmed = true;
    h.send(id, "ultimate", { tx: 1200, ty: 1000 });
    h.tick();
    expect(player.ultPhase).toBe(enemyComboShared.UltimatePhase.Idle);
    combat.ultBuffer = 0;

    combat.juggleArmed = false;
    player.alive = false;
    h.send(id, "ultimate", { tx: 1200, ty: 1000 });
    expect(combat.ultBuffer).toBe(0);
    player.alive = true;
    h.send(id, "ultimate", { tx: 1200, ty: 1000 });
    h.tick();
    expect(player.ultPhase).toBe(enemyComboShared.UltimatePhase.Windup);
    expect(combat.ultChargeF).toBe(0);
  });
});

describeUltimateImplementation("ULT U1 five authoritative family executions", () => {
  it("Seismarch leaps to the resolved point, damages the inner ring, and opens a stun+ICD window", () => {
    const { h, id, player } = makeUltimateRoom(
      enemyComboShared.UltimateFamily.Seismarch,
      "dex",
      "ult-seis",
    );
    const enemy = addUltimateEnemy(h, "seis-dummy", 1200, 1000, DUMMY_HP, "dummy");
    const teleportSeq = player.teleportSeq;
    h.send(id, "ultimate", { tx: 1200, ty: 1000 });
    h.tick(
      1 + enemyComboShared.ULT_SEISMARCH_WINDUP_TICKS + enemyComboShared.ULT_SEISMARCH_AIR_TICKS,
    );
    expect(player.x).toBeCloseTo(1200, 4);
    expect(player.teleportSeq).toBe(teleportSeq + 2); // scripted-motion start and landing
    expect(enemy.hp).toBeLessThan(DUMMY_HP);
    expect(h.room.poundEnemyEffects.get(enemy.id)?.staggerT).toBeGreaterThan(1);
    expect(h.room.ultimateStunUntil.has(enemy.id)).toBe(true);
  });

  it("Alpha Strike captures only the nearest hard cap and hits on its fixed two-tick cadence", () => {
    const { h, id, player } = makeUltimateRoom(
      enemyComboShared.UltimateFamily.AlphaStrike,
      "int",
      "ult-alpha",
    );
    const enemies: EnemyState[] = [];
    for (let i = 0; i < enemyComboShared.ULT_ALPHA_MAX_TARGETS + 3; i++) {
      const enemy = addUltimateEnemy(h, `alpha-${i}`, 1080 + i * 45, 1000);
      h.room.poundEnemyEffects.set(enemy.id, { vx: 0, vy: 0, staggerT: 10 });
      enemies.push(enemy);
    }
    h.send(id, "ultimate", { tx: 1500, ty: 1000 });
    h.tick();
    const captured = h.room.combat.get(id).ult.targets.map((target: { id: string }) => target.id);
    expect(captured).toEqual(
      enemies.slice(0, enemyComboShared.ULT_ALPHA_MAX_TARGETS).map((e) => e.id),
    );
    h.tick(16);
    expect(enemies.slice(0, 5).every((enemy) => enemy.hp < 1000)).toBe(true);
    expect(enemies.slice(5).every((enemy) => enemy.hp === 1000)).toBe(true);
    const receipts = [...h.state().combatReceipts]
      .filter(
        (row) =>
          row.seq > 0 &&
          row.sourcePlayerId === id &&
          row.delivery === enemyComboShared.CombatDelivery.Ultimate,
      )
      .sort((a, b) => a.tick - b.tick);
    expect(receipts).toHaveLength(5);
    expect(receipts.slice(1).map((row, i) => row.tick - receipts[i].tick)).toEqual([2, 2, 2, 2]);
    expect(player.ultEndTick).toBeGreaterThan(player.ultResolveTick);
  });

  it("Event Horizon sweeps one capsule hit per on-line target and leaves off-line/behind bodies untouched", () => {
    const { h, id, player } = makeUltimateRoom(
      enemyComboShared.UltimateFamily.EventHorizon,
      "luk",
      "ult-event",
    );
    const onLine = addUltimateEnemy(h, "event-line", 1200, 1000);
    const offLine = addUltimateEnemy(h, "event-off", 1200, 1200);
    const behind = addUltimateEnemy(h, "event-behind", 850, 1000);
    for (const enemy of [onLine, offLine, behind])
      h.room.poundEnemyEffects.set(enemy.id, { vx: 0, vy: 0, staggerT: 10 });
    const teleportSeq = player.teleportSeq;
    h.send(id, "ultimate", { aimX: 1, aimY: 0, tx: 1600, ty: 1000 });
    h.tick(12);
    expect(onLine.hp).toBeLessThan(1000);
    expect(offLine.hp).toBe(1000);
    expect(behind.hp).toBe(1000);
    expect(h.room.ultimateBrands.has(onLine.id)).toBe(true);
    expect(player.teleportSeq).toBe(teleportSeq + 2);
    expect(player.mvx).toBe(0);
    expect(player.mvy).toBe(0);
  });

  it("Sunspite launches one WYSIWYG fireball through the existing explode/detonate receipt pipeline", () => {
    const { h, id } = makeUltimateRoom(
      enemyComboShared.UltimateFamily.SunspiteComet,
      "luk",
      "ult-comet",
    );
    const direct = addUltimateEnemy(h, "comet-direct", 1400, 1000);
    const near = addUltimateEnemy(h, "comet-near", 1500, 1000);
    const far = addUltimateEnemy(h, "comet-far", 1700, 1000);
    for (const enemy of [direct, near, far])
      h.room.poundEnemyEffects.set(enemy.id, { vx: 0, vy: 0, staggerT: 10 });
    h.send(id, "ultimate", { aimX: 1, aimY: 0, tx: 2000, ty: 1000 });
    h.tick(1 + enemyComboShared.ULT_FIREBALL_WINDUP_TICKS);
    const projectile = [...h.state().projectiles.values()].find(
      (row) => row.kind === "fireball" && !row.hostile,
    );
    expect(projectile?.explodeR).toBe(enemyComboShared.ULT_NUKE_RADIUS);
    h.tick(20);
    expect(direct.hp).toBeLessThan(1000);
    expect(near.hp).toBeLessThan(1000);
    expect(far.hp).toBe(1000);
    expect(
      [...h.state().combatReceipts].some(
        (row) =>
          row.seq > 0 &&
          row.sourcePlayerId === id &&
          row.weaponId === "ult:sunspite-comet" &&
          row.delivery === enemyComboShared.CombatDelivery.Ultimate,
      ),
    ).toBe(true);
  });

  it("Dimension Door clamps nav range, bumps teleportSeq once, creates a decoy, and honors the return ticket", () => {
    const { h, id, player } = makeUltimateRoom(
      enemyComboShared.UltimateFamily.DimensionDoor,
      "dex",
      "ult-door",
    );
    const origin = { x: player.x, y: player.y };
    const teleportSeq = player.teleportSeq;
    h.send(id, "ultimate", { tx: 9000, ty: 1000 });
    h.tick();
    expect(
      Math.hypot(player.ultTargetX - origin.x, player.ultTargetY - origin.y),
    ).toBeLessThanOrEqual(enemyComboShared.ULT_BLINK_RANGE + 1e-6);
    h.tick(enemyComboShared.ULT_BLINK_WINDUP_TICKS);
    expect(player.teleportSeq).toBe(teleportSeq + 1);
    expect(h.room.ultimateDecoys.has(id)).toBe(true);
    h.tick(enemyComboShared.ULT_BLINK_RECOVERY_TICKS + 1);
    expect(player.ultPhase).toBe(enemyComboShared.UltimatePhase.Idle);
    h.send(id, "ultimate", {});
    h.tick();
    expect(player.x).toBeCloseTo(origin.x, 4);
    expect(player.y).toBeCloseTo(origin.y, 4);
    expect(player.teleportSeq).toBe(teleportSeq + 2);
    expect(h.room.ultimateDecoys.has(id)).toBe(false);
  });

  it("Alpha Strike's STR finisher applies the shared stun ICD exactly once", () => {
    const { h, id } = makeUltimateRoom(
      enemyComboShared.UltimateFamily.AlphaStrike,
      "str",
      "ult-alpha-stun",
    );
    const enemy = addUltimateEnemy(h, "alpha-stun-target", 1120, 1000, 1000, "critter");
    h.room.poundEnemyEffects.set(enemy.id, { vx: 0, vy: 0, staggerT: 10 });
    h.send(id, "ultimate", { tx: enemy.x, ty: enemy.y });
    h.tick(3);
    expect(enemy.hp).toBeLessThan(1000);
    expect(enemy.hp).toBeGreaterThan(0);
    expect(h.state().enemies.has(enemy.id)).toBe(true);
    expect(h.room.combat.get(id).ult?.variant).toBe("str");
    const firstUntil = h.room.ultimateStunUntil.get(enemy.id);
    expect(firstUntil).toBeGreaterThan(h.state().tick);
    expect(h.room.applyUltimateStun(enemy, enemy.id, 0.5)).toBe(false);
    expect(h.room.ultimateStunUntil.get(enemy.id)).toBe(firstUntil);
  });
});

describeUltimateImplementation("ULT U1 lifecycle, co-op, and schema 25", () => {
  it("cancels on an external teleport, preserves charge through downing, and keeps downed owners inert", () => {
    const { h, id, player, combat } = makeUltimateRoom(
      enemyComboShared.UltimateFamily.EventHorizon,
      "str",
      "ult-life",
    );
    h.join("ult-life-ally");
    h.send(id, "ultimate", { aimX: 1, aimY: 0, tx: 1400, ty: 1000 });
    h.tick();
    h.room.zeroMoveVel(id); // lava-gap/rift/revive share this authoritative external teleport signal.
    h.tick();
    expect(player.ultPhase).toBe(enemyComboShared.UltimatePhase.Idle);

    combat.ultChargeF = 0.5;
    player.ultCharge = 50;
    player.hp = 0;
    h.tick();
    expect(player.alive).toBe(false);
    expect(combat.ultChargeF).toBe(0.5);
    expect(player.ultCharge).toBe(50);
  });

  it("ships schema 35 with the stat-free interim ultimate selected and the nested relic wire row", () => {
    const h = makeRoom();
    h.join("ult-schema");
    const player = h.state().players.get("ult-schema");
    expect(h.state().schemaVersion).toBe(51);
    expect(enemyComboShared.SCHEMA_VERSION).toBe(51);
    expect([
      player.ultimate.archetype,
      player.ultimate.charge,
      player.ultimate.phase,
      player.ultimate.seq,
      player.ultimate.startTick,
      player.ultimate.resolveTick,
      player.ultimate.endTick,
      player.ultimate.targetX,
      player.ultimate.targetY,
    ]).toEqual([
      enemyComboShared.ultimateCodeFor(enemyComboShared.UltimateFamily.SunspiteComet, "str"),
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
    ]);
    player.ultCharge = 42;
    expect(player.ultimate.charge).toBe(42);
  });
});
