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


// ── §44 SERVER SAFETY (Sol audit Wave 2) — dev-gated debug RPCs, entity caps, the action-message budget,
// and the parry action gate. These are the "one hostile client DoSes the shared node process /
// farms risk-free damage" holes; each test drives the real handler + tick paths. ──────────────────────
describe("GameRoom — §44 safety gates", () => {
  const asProd = (fn: () => void) => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      fn();
    } finally {
      process.env.NODE_ENV = prev;
    }
  };

  it("action messages beyond the per-tick budget are IGNORED, and the budget refills next tick", () => {
    const h = makeRoom();
    h.join("p1");
    const p = h.state().players.get("p1");
    // Spend the whole budget on right-aimed attacks…
    for (let i = 0; i < ACTION_MSGS_PER_TICK; i++)
      h.send("p1", "attack", { aimX: 1, aimY: 0, tx: p.x + 100, ty: p.y });
    expect(p.aimDir).toBe(0);
    // …then an UP-aimed attack over budget: it must be ignored (aimDir unchanged).
    h.send("p1", "attack", { aimX: 0, aimY: 1, tx: p.x, ty: p.y + 100 });
    expect(p.aimDir).toBe(0);
    // A tick refills the budget — the same message now lands.
    h.tick(1);
    h.send("p1", "attack", { aimX: 0, aimY: 1, tx: p.x, ty: p.y + 100 });
    expect(p.aimDir).toBeCloseTo(Math.PI / 2, 5);
  });

  it("debug summon can NEVER push the room past MAX_ENEMIES (the spawn-director cap now binds it too)", () => {
    const h = makeRoom();
    h.join("p1");
    h.send("p1", "toggleTraining");
    // Flood: five max-count summons across ticks (each send costs one action token).
    for (let i = 0; i < 5; i++) {
      h.send("p1", "debugSpawn", { kind: "ronin", count: 30 });
      h.tick(1);
    }
    expect(h.state().enemies.size).toBeLessThanOrEqual(MAX_ENEMIES);
  });

  it("in PRODUCTION the debug RPCs are unreachable — training/summon/boss-picker/dev-equip all no-op", () => {
    const h = makeRoom();
    h.join("p1");
    asProd(() => {
      h.send("p1", "toggleTraining");
      expect(h.state().mode).toBe("arena"); // the Testing Grounds do not exist on a public deploy
      h.send("p1", "spawnBossDef", { kind: "moss-stone-golem" });
      expect(
        [...h.state().enemies.values()].some(
          (e: { kind: string }) => e.kind === "moss-stone-golem",
        ),
      ).toBe(false);
      const before = h.state().players.get("p1").weapon;
      h.send("p1", "devEquip", { weapon: "x-sword-bone" });
      expect(h.state().players.get("p1").weapon).toBe(before);
    });
    // Back in dev the same client CAN enter training (the gate reads the env per call).
    h.send("p1", "toggleTraining");
    expect(h.state().mode).toBe("training");
  });

  it("in PRODUCTION belt joins ignore client-authored scrip/upgrades (no 65,535-scrip walk-ins)", () => {
    const h = makeRoom({ belt: true });
    asProd(() => {
      h.room.clients.push({ sessionId: "rich" });
      h.room.onJoin(
        { sessionId: "rich" },
        { scrip: 65535, up: { vitality: 9, fortune: 9, power: 9 } },
      );
    });
    const p = h.state().players.get("rich");
    expect(p.scrip).toBe(0);
  });
});

describe("improve2 integrity regressions", () => {
  it("G-01 restores identity cooldown/global Drive debt and keeps an immediate quick-swap press buffered", () => {
    const h = makeRoom();
    h.join("swap-ledger");
    const player = h.state().players.get("swap-ledger");
    const combat = h.room.combat.get("swap-ledger");
    const gunId = WEAPON_IDS.find((id) => WEAPONS[id]?.gun);
    if (!gunId) throw new Error("expected a gun fixture");
    player.weapon = gunId;
    h.tick(1);
    combat.cd = 0.6;
    combat.drive.valueF = 80;
    combat.drive.recoveryDebtF = 0.8;
    player.weaponResource.valueQ = 8000;

    h.send("swap-ledger", "cycleWeapon", { dir: 1 });
    const swappedId = player.weapon;
    expect(swappedId).not.toBe(gunId);
    h.send("swap-ledger", "attack", { aimX: 1, aimY: 0 });
    h.tick(2);
    expect(player.attackSeq).toBe(0);
    h.tick(1);
    expect(player.attackSeq).toBe(1);

    player.weapon = gunId; // server-side setup return; the carousel ledger still owns the old debt
    h.tick(1);
    expect(combat.cd).toBeGreaterThan(0.4);
    expect([combat.reloadCd, player.maxCharges, player.charges]).toEqual([0, 0, 0]);
    expect(combat.drive.valueF).toBeLessThanOrEqual(80);
    expect(combat.drive.recoveryDebtF).toBeGreaterThan(0);
  });

  it("G-02 grants parry augments only after a resolved success receipt", () => {
    const h = makeRoom();
    h.join("parry-success");
    const player = h.state().players.get("parry-success");
    const combat = h.room.combat.get("parry-success");
    player.hp = 40;
    player.augments = "second-wind,counterblade,bulwark";

    h.send("parry-success", "parry");
    expect(player.hp).toBe(40);
    expect(h.state().projectiles.size).toBe(0);
    expect(combat.bulwarkShield).toBe(0);

    const attacker = new EnemyState();
    attacker.id = "parry-attacker";
    attacker.kind = "critter";
    attacker.x = player.x + 40;
    attacker.y = player.y;
    h.room.resolveParry(player, combat, attacker, attacker.id);
    expect(player.hp).toBeGreaterThan(40);
    expect(h.state().projectiles.size).toBeGreaterThan(0);
    expect(combat.bulwarkShield).toBeGreaterThan(0);
  });

  it("authored wielders can drop disassemblable floor weapons", () => {
    const h = makeRoom();
    h.join("drop-law");
    const row = Object.entries(ENEMY_KINDS).find(
      ([, kind]) =>
        !!kind.wieldsWeapon && !!kind.dropWeapon && !kind.shifter && kind.archetype !== "boss",
    );
    if (!row) throw new Error("expected a weapon-wielding enemy fixture");
    const rng = vi.spyOn(Math, "random").mockReturnValue(0);
    for (const tough of [false, true]) {
      const enemy = new EnemyState();
      enemy.id = `drop-law-${tough ? "tough" : "trash"}`;
      enemy.kind = row[0];
      enemy.hp = 1;
      enemy.tough = tough;
      enemy.x = h.room.map.spawnX;
      enemy.y = h.room.map.spawnY;
      h.state().enemies.set(enemy.id, enemy);
      h.room.damageEnemy(enemy, enemy.id, 1, []);
    }
    expect(h.state().pickups.size).toBe(2);
    h.state().pickups.forEach((pickup: PickupState) => {
      expect(pickup.disassemblable).toBe(true);
      expect(pickup.weapon).toBe(row[1].wieldsWeapon);
    });
    rng.mockRestore();
  });

  it("instances authored enemy drops only for accounts that unlocked that exact weapon", () => {
    const h = makeRoom();
    h.join("drop-unlocked");
    h.join("drop-locked");
    const row = Object.entries(ENEMY_KINDS).find(
      ([, kind]) =>
        !!kind.wieldsWeapon && !!kind.dropWeapon && !kind.shifter && kind.archetype !== "boss",
    );
    if (!row?.[1].wieldsWeapon) throw new Error("expected a weapon-wielding enemy fixture");
    const weaponId = row[1].wieldsWeapon;
    h.room.metaAccounts.get("drop-unlocked").unlockedWeapons = [weaponId];
    h.room.metaAccounts.get("drop-locked").unlockedWeapons = [];
    const enemy = new EnemyState();
    enemy.id = "drop-account-filter";
    enemy.kind = row[0];
    enemy.x = h.room.map.spawnX;
    enemy.y = h.room.map.spawnY;
    const rng = vi.spyOn(Math, "random").mockReturnValue(0);

    h.room.maybeDropEnemyWeapon(enemy, row[1]);

    expect([...h.state().pickups.values()]).toHaveLength(1);
    expect([...h.state().pickups.values()][0]).toMatchObject({
      weapon: weaponId,
      ownerId: "drop-unlocked",
    });
    rng.mockRestore();
  });

  it("polish #7 writes fixed-ring hit/final-blow ownership from the accepted source, not proximity", async () => {
    const { CombatDelivery, COMBAT_RECEIPT_CAP } = await import("@dd/shared");
    const h = makeRoom();
    h.join("author");
    h.join("nearby");
    const author = h.state().players.get("author");
    const nearby = h.state().players.get("nearby");
    author.x = 100;
    author.y = 100;
    nearby.x = 600;
    nearby.y = 600;
    const victim = new EnemyState();
    victim.id = "receipt-victim";
    victim.kind = "critter";
    victim.x = nearby.x + 1;
    victim.y = nearby.y;
    victim.hp = 1;
    h.state().enemies.set(victim.id, victim);
    const rows = [...h.state().combatReceipts];
    const kills: string[] = [];

    h.room.damageEnemy(
      victim,
      victim.id,
      5,
      kills,
      0,
      author.id,
      "six-shooter",
      CombatDelivery.Gun,
      author.x,
      author.y,
    );
    const receipt = [...h.state().combatReceipts].find((row) => row.seq === 1);
    expect(receipt?.sourcePlayerId).toBe("author");
    expect(receipt?.sourcePlayerId).not.toBe("nearby");
    expect(receipt?.targetId).toBe(victim.id);
    expect(receipt?.finalBlow).toBe(true);
    expect(receipt?.delivery).toBe(CombatDelivery.Gun);
    expect(h.state().combatReceipts.length).toBe(COMBAT_RECEIPT_CAP);
    expect([...h.state().combatReceipts]).toEqual(rows);
    expect(h.state().schemaVersion).toBe(47);
  });
});

// ── §46 terminal-room quiescence + arena-wide hostile-projectile admission (audit follow-up). ────────────
describe("GameRoom — §46 terminal quiescence + hostile projectile ceiling", () => {
  // Restore any per-test Math.random seed so a deterministic stub cannot leak into later tests.
  afterEach(() => vi.restoreAllMocks());
  it("a WIPE clears every combat transient, idles enemy AI, and restart revives the full simulation", () => {
    const h = makeRoom();
    h.join("p1");
    const p = h.state().players.get("p1");
    const rangedEntry = Object.entries(ENEMY_KINDS).find(([, kind]) => Boolean(kind.ranged));
    if (!rangedEntry) throw new Error("test roster needs a ranged enemy");
    const [kindId, kind] = rangedEntry;

    const enemy = new EnemyState();
    enemy.id = "terminal-spitter";
    enemy.kind = kindId;
    enemy.hp = kind.hp;
    enemy.x = h.room.map.spawnX + 120;
    enemy.y = h.room.map.spawnY;
    h.state().enemies.set(enemy.id, enemy);
    h.room.fireProjectile(enemy, p, 0, 1);

    const zone = new ZoneState();
    zone.id = "terminal-zone";
    zone.x = p.x;
    zone.y = p.y;
    zone.radius = ZONE_RADIUS;
    h.state().zones.set(zone.id, zone);
    h.room.zoneMeta.set(zone.id, ZONE_TTL);
    h.room.addTelegraphRow(0, p.x, p.y, 100, 1, 0);
    h.room.pendingQuakes.push({ t: 10, x: p.x, y: p.y, radius: 100, damage: 10, crit: 0 });

    const enemyAi = vi.spyOn(h.room, "stepSpitters");
    p.hp = 0;
    h.tick(1); // phase 7 detects the wipe and enters the shared terminal teardown
    expect(h.state().outcome).toBe("defeat");

    enemyAi.mockClear();
    h.tick(8);
    expect(h.state().enemies.size).toBe(0);
    expect(h.state().projectiles.size).toBe(0);
    expect(h.state().zones.size).toBe(0);
    expect(h.state().telegraphs.size).toBe(0);
    expect(h.room.pendingQuakes).toHaveLength(0);
    expect(enemyAi).not.toHaveBeenCalled(); // terminal ticks never enter phase 5 AI

    h.send("p1", "restart");
    expect(h.state().outcome).toBe("active");
    expect(p.alive).toBe(true);
    enemyAi.mockClear();
    h.tick(1);
    expect(h.state().elapsed).toBeGreaterThan(0);
    expect(enemyAi).toHaveBeenCalledOnce(); // restart restored the ordinary phase pipeline
  });

  it("spitter volleys obey the hostile ceiling, and a parry-reflection frees exactly one slot", () => {
    const h = makeRoom();
    h.join("p1");
    // Seed Math.random so this ceiling/parry accounting is independent of the global RNG stream
    // position (full-suite ordering shifts it and flaked the parry-frees-one-slot assertion).
    const rng = makeRng(0x46ce11a1);
    vi.spyOn(Math, "random").mockImplementation(() => rng.next());
    const p = h.state().players.get("p1");
    // Map-RNG law: this test pins a volley path near spawn — random pits under it (likelier since
    // the QOL-03 gate-disc solver reshapes spawn-adjacent terrain) would annihilate the volley mid-step.
    h.room.map.tiles.fill(TILE_GROUND);
    const safe = { x: h.room.map.spawnX + 120, y: h.room.map.spawnY };

    // Saturate through the central primitive: excess hostile shots are rejected before ids/state are minted.
    for (let i = 0; i < HOSTILE_PROJECTILE_CEILING + 20; i++)
      h.room.fireProjectile(safe, { x: safe.x + 1, y: safe.y }, 0, 1);
    expect(h.room.bossSink.hostileProjectiles()).toBe(HOSTILE_PROJECTILE_CEILING);
    expect(h.state().projectiles.size).toBe(HOSTILE_PROJECTILE_CEILING);

    const rangedEntry =
      Object.entries(ENEMY_KINDS).find(([, kind]) => (kind.ranged?.spread?.count ?? 0) > 1) ??
      Object.entries(ENEMY_KINDS).find(([, kind]) => Boolean(kind.ranged));
    if (!rangedEntry) throw new Error("test roster needs a ranged enemy");
    const [kindId, kind] = rangedEntry;
    const spitter = new EnemyState();
    spitter.id = "budget-spitter";
    spitter.kind = kindId;
    spitter.hp = kind.hp;
    spitter.x = p.x + 100;
    spitter.y = p.y;
    h.state().enemies.set(spitter.id, spitter);
    h.room.enemyFireCd.set(spitter.id, 0);
    h.room.stepSpitters(0.05, [{ x: p.x, y: p.y }]);
    expect(h.state().projectiles.size).toBe(HOSTILE_PROJECTILE_CEILING); // full volley rejected

    const reflected = [...h.state().projectiles.values()][0];
    if (!reflected) throw new Error("expected a projectile to reflect");
    reflected.x = p.x;
    reflected.y = p.y;
    reflected.vx = 0;
    reflected.vy = 0;
    h.room.combat.get("p1").invuln = 1;
    h.room.stepProjectiles(0.05);
    expect(reflected.hostile).toBe(false);
    expect(h.room.bossSink.hostileProjectiles()).toBe(HOSTILE_PROJECTILE_CEILING - 1);

    h.room.enemyFireCd.set(spitter.id, 0);
    h.room.stepSpitters(0.05, [{ x: p.x, y: p.y }]);
    expect(h.room.bossSink.hostileProjectiles()).toBe(HOSTILE_PROJECTILE_CEILING);
    expect(h.state().projectiles.size).toBe(HOSTILE_PROJECTILE_CEILING + 1); // one friendly + ceiling hostile

    h.room.enemyFireCd.set(spitter.id, 0);
    h.room.stepSpitters(0.05, [{ x: p.x, y: p.y }]);
    expect(h.state().projectiles.size).toBe(HOSTILE_PROJECTILE_CEILING + 1);
    h.room.fireProjectile(safe, { x: safe.x + 1, y: safe.y }, 0, 1, false, "friendly");
    expect(h.state().projectiles.size).toBe(HOSTILE_PROJECTILE_CEILING + 2); // friendlies are never capped
  });
});

// §44 P0 — appended clock regressions. These deliberately inspect the room's private accepted-swing rail;
// the harness is already `AnyRoom`, and asserting the descriptor avoids coupling timing to enemy AI/mapgen.
describe("GameRoom — §44 one effective-cooldown swing clock", () => {
  function acceptedSwing(weaponId: string, affix = "") {
    const h = makeRoom();
    h.join("clock-player");
    const player = h.state().players.get("clock-player");
    player.weapon = weaponId;
    player.weaponAffix = affix;
    h.tick(1); // settle swap; the next attack establishes the authoritative accepted epoch
    h.send("clock-player", "attack", { aimX: 1, aimY: 0 });
    h.tick(1);
    const active = h.room.meleeSwings.get("clock-player");
    if (!active) throw new Error(`expected accepted swing for ${weaponId}`);
    return { h, active };
  }

  it("keeps a slow 0.9s weapon's edge active at the pose midpoint", () => {
    const { h, active } = acceptedSwing("x-sword-coffin");
    expect(WEAPONS["x-sword-coffin"]?.cooldown).toBe(0.9);
    const toMidPose = active.swing.poseSeconds / 2 - active.elapsed;
    h.room.stepMeleeSwings(toMidPose);
    const atMidPose = h.room.meleeSwings.get("clock-player");
    expect(atMidPose).toBeDefined();
    expect(atMidPose.elapsed).toBeCloseTo(atMidPose.swing.poseSeconds / 2);
    expect(atMidPose.elapsed).toBeGreaterThanOrEqual(atMidPose.swing.activeStartSeconds);
    expect(atMidPose.elapsed).toBeLessThan(atMidPose.swing.activeEndSeconds);
  });

  it("has no active edge after a fast 0.22s weapon's pose ends", () => {
    const { h, active } = acceptedSwing("x-sword-buzzsaw");
    expect(WEAPONS["x-sword-buzzsaw"]?.cooldown).toBe(0.22);
    h.room.stepMeleeSwings(active.swing.poseSeconds - active.elapsed + 0.001);
    expect(h.room.meleeSwings.has("clock-player")).toBe(false);
  });

  it("shortens a Swift-affixed weapon's pose window with its effective cooldown", () => {
    const plain = acceptedSwing("x-sword-coffin").active.swing;
    const swift = acceptedSwing("x-sword-coffin", "swift").active.swing;
    expect(swift.effectiveCooldown).toBeCloseTo(plain.effectiveCooldown * 0.82);
    expect(swift.poseSeconds).toBeCloseTo(plain.poseSeconds * 0.82);
    expect(swift.poseSeconds).toBeLessThan(plain.poseSeconds);
  });
});

// Audit findings #15/#14 — appended only: private chest contents and transition-only Brand sync.
describe("GameRoom — audit sync privacy and churn regressions", () => {
  it("keeps unopened chest contents off synchronized state and rolls only for its opener", () => {
    const h = makeRoom();
    h.join("loot-player");
    const player = h.state().players.get("loot-player");
    const receipts: unknown[] = [];
    h.room.clients[0].send = (type: string, payload: unknown) => {
      if (type === "chestOpened") receipts.push(payload);
    };
    const chest = new enemyComboShared.ChestState();
    chest.id = "chest:15:320";
    chest.x = player.x;
    chest.y = player.y;
    chest.zone = enemyComboShared.MAP_ZONE_SCAR;
    chest.kind = enemyComboShared.CHEST_KIND_WEAPON_CACHE;
    chest.spawnTick = 320;
    chest.openedBy.set(player.id, false);
    h.state().chests.set(chest.id, chest);
    const syncedChest = chest as unknown as Record<string, unknown>;

    expect(Object.hasOwn(syncedChest, "weapon")).toBe(false);
    expect(Object.hasOwn(syncedChest, "relics")).toBe(false);
    expect(Object.hasOwn(syncedChest, "money")).toBe(false);

    h.room.openChestForPlayer(player.id, chest.id);

    expect(receipts).toHaveLength(1);
    expect(chest.openedBy.get(player.id)).toBe(true);
    expect(Object.hasOwn(syncedChest, "weapon")).toBe(false);
    expect(Object.hasOwn(syncedChest, "relics")).toBe(false);
    expect(Object.hasOwn(syncedChest, "money")).toBe(false);
  });

  it("keeps the synced branded flag stable between apply and precise expiry", () => {
    const h = makeRoom();
    h.join("brand-player");
    const player = h.state().players.get("brand-player");
    player.augments = "brand";

    const enemy = new EnemyState();
    enemy.id = "brand-target";
    enemy.kind = "dummy";
    enemy.hp = DUMMY_HP;
    enemy.x = player.x + 10;
    enemy.y = player.y;
    h.state().enemies.set(enemy.id, enemy);

    h.room.applyParryAugments(player, h.room.combat.get(player.id));
    expect(enemy.branded).toBe(1);
    const initialPrecise = h.room.brandedTimers.get(enemy.id) as number;
    h.tick(1);
    expect(enemy.branded).toBe(1);
    expect(h.room.brandedTimers.get(enemy.id)).toBeLessThan(initialPrecise);

    const remaining = h.room.brandedTimers.get(enemy.id) as number;
    h.tick(Math.ceil(remaining / 0.05) + 1);
    expect(h.room.brandedTimers.has(enemy.id)).toBe(false);
    expect(enemy.branded).toBe(0);
  });
});

// §50 WHIRLWIND per-revolution damage (playtest: a held spin "blink hit" enemies once per press despite
// the blade sweeping 4π). Each completed 2π re-arms the swing's hit-once set server-side.
describe("GameRoom — §50 spin re-hits per revolution", () => {
  it("ONE whirlwind press (4π sweep) dips a pinned enemy at least twice", () => {
    const h = makeRoom();
    h.join("p1");
    // Determinism: flatten the map to ground so a randomly-placed pit tile can't
    // swallow the sweep in a full-suite RNG stream (matches the sibling parry test at ~L2570).
    h.room.map.tiles.fill(TILE_GROUND);
    h.send("p1", "toggleTraining");
    h.tick(1);
    const p = h.state().players.get("p1");
    p.weapon = "x-sword-whirlwind";
    h.tick(1);
    h.send("p1", "debugSpawn", { kind: "ronin", count: 1 });
    h.tick(1);
    const found = [...h.state().enemies.entries()].find(
      ([, e]: [string, { kind: string }]) => e.kind === "ronin",
    ) as [string, { x: number; y: number; hp: number }];
    const [rid, r] = found;
    r.hp = 100000;
    let dips = 0;
    let lastHp = r.hp;
    h.send("p1", "attack", { aimX: 1, aimY: 0, tx: p.x + 100, ty: p.y });
    for (let t = 0; t < 24; t++) {
      h.tick(1);
      const e = h.state().enemies.get(rid);
      if (!e) break;
      e.x = p.x + 80;
      e.y = p.y;
      if (e.hp < lastHp) {
        dips++;
        lastHp = e.hp;
      }
    }
    expect(dips).toBeGreaterThanOrEqual(2);
  });
});
