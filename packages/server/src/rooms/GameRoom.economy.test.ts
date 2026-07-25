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


describe("GameRoom — chest-only weapon itemization", () => {
  it("a boss kill opens progression without minting a legacy weapon pickup", () => {
    const h = makeRoom();
    h.join("p1");
    const p = h.state().players.get("p1");
    p.x = h.room.map.spawnX;
    p.y = h.room.map.spawnY;
    p.weapon = "gravediggers-spade";
    h.tick(1);
    h.send("p1", "spawnBoss");
    h.tick(1);
    h.state().enemies.forEach((e: EnemyState) => {
      if (ENEMY_KINDS[e.kind]?.archetype === "boss") {
        e.hp = 1;
        e.x = h.room.map.spawnX + 100;
        e.y = h.room.map.spawnY;
      }
    });
    h.send("p1", "attack", { aimX: 1, aimY: 0 });
    h.tick(4);
    expect(h.state().portalOpen).toBe(true);
    expect(h.state().pickups.size).toBe(0);
  });

  it("grabbing a drop applies its rolled rarity + affix to the held weapon (the reveal)", () => {
    const h = makeRoom();
    h.join("p1");
    const p = h.state().players.get("p1");
    p.x = h.room.map.spawnX;
    p.y = h.room.map.spawnY;
    const pk = new PickupState();
    pk.id = "drop800";
    pk.weapon = "tombstone-greatsword";
    pk.rarity = 4; // Legendary
    pk.affix = "keen";
    pk.known = false;
    pk.x = p.x;
    pk.y = p.y;
    h.state().pickups.set("drop800", pk);
    h.room.earnedPickups.add("drop800");
    h.send("p1", "grabWeapon");
    expect(p.weapon).toBe("tombstone-greatsword");
    expect(p.weaponRarity).toBe(4);
    expect(p.weaponAffix).toBe("keen");
  });

  it("disassembling a floor weapon ignores loot rarity and uses authored damage budget", () => {
    const low = weaponDisassemblyValue("rusty-cleaver");
    const high = weaponDisassemblyValue("tombstone-greatsword");
    expect(high).toBeGreaterThan(low);
    expect(weaponDisassemblyValue("tombstone-greatsword")).toBe(high);
  });

  it("A11: grabbing while holding a weapon SWAPS — the held weapon drops as a pickup, not destroyed", () => {
    const h = makeRoom();
    h.join("p1");
    const p = h.state().players.get("p1");
    p.x = h.room.map.spawnX;
    p.y = h.room.map.spawnY;
    // Holding an EARNED Legendary Keen weapon.
    p.weapon = "tombstone-greatsword";
    p.weaponRarity = 4;
    p.weaponAffix = "keen";
    const c = h.room.combat.get("p1");
    c.heldEarned = true;
    // A plain Common weapon on the floor, in reach.
    const pk = new PickupState();
    pk.id = "drop700";
    pk.weapon = "rusty-cleaver";
    pk.x = p.x;
    pk.y = p.y;
    h.state().pickups.set("drop700", pk);
    h.send("p1", "grabWeapon");
    // Now wielding the grabbed weapon (unearned — the floor pickup carried no provenance)...
    expect(p.weapon).toBe("rusty-cleaver");
    expect(c.heldEarned).toBe(false);
    // ...and the Legendary was NOT destroyed — it's back on the floor as a grabbable pickup with its
    // full identity + earned provenance intact (the data-loss booby trap is closed).
    let dropped: PickupState | undefined;
    h.state().pickups.forEach((x: PickupState) => {
      if (x.weapon === "tombstone-greatsword") dropped = x;
    });
    expect(dropped).toBeDefined();
    expect(dropped?.rarity).toBe(4);
    expect(dropped?.affix).toBe("keen");
    expect(h.room.earnedPickups.has(dropped?.id ?? "")).toBe(true);
  });

  it("a rarity/affix genuinely changes dealt damage (Legendary Keen > plain, WYSIWYG)", () => {
    // §30 suppress the crit roll (base 5%) so the damage assertion is deterministic — random ≥ crit chance.
    const rng = vi.spyOn(Math, "random").mockReturnValue(1);
    const hitFor = (rarity: number, affix: string) => {
      const h = makeRoom();
      h.join("p1");
      const p = h.state().players.get("p1");
      p.x = h.room.map.spawnX;
      p.y = h.room.map.spawnY;
      p.weapon = "gravediggers-spade";
      p.weaponRarity = rarity;
      p.weaponAffix = affix;
      h.tick(1);
      const e = new EnemyState();
      e.id = "victim";
      e.kind = "critter";
      e.hp = 500;
      e.x = h.room.map.spawnX + 50;
      e.y = h.room.map.spawnY;
      h.state().enemies.set("victim", e);
      h.send("p1", "attack", { aimX: 1, aimY: 0 });
      h.tick(4);
      return 500 - (h.state().enemies.get("victim")?.hp ?? 0);
    };
    const plain = hitFor(0, "");
    const legendary = hitFor(4, "keen");
    expect(plain).toBeGreaterThan(0);
    expect(legendary).toBeCloseTo(plain * 1.45 * 1.12, 1); // exactly rarity × affix
    rng.mockRestore();
  });

  it("EXPLOIT GUARD: the Testing Grounds mints NO loot — not from toughs, debug BOSSES, or wielders", () => {
    const h = makeRoom();
    h.join("p1");
    h.send("p1", "toggleTraining");
    const before = h.state().pickups.size;
    // Kill toughs, a BOSS, and a weapon-WIELDER in training — none may mint a drop (the verify-found
    // laundering exploit: reroll boss loot risk-free in the workshop, then carry it into the run).
    for (let i = 0; i < 40; i++) {
      const e = new EnemyState();
      e.id = `t${i}`;
      e.kind = "critter";
      e.hp = 0.0001;
      e.tough = true;
      h.state().enemies.set(e.id, e);
      h.room.damageEnemy(e, e.id, 1, []);
    }
    for (let i = 0; i < 12; i++) {
      const b = new EnemyState();
      b.id = `b${i}`;
      b.kind = "old-rust"; // archetype boss body
      b.hp = 0.0001;
      h.state().enemies.set(b.id, b);
      h.room.damageEnemy(b, b.id, 1, []);
      const r = new EnemyState();
      r.id = `r${i}`;
      r.kind = "ronin"; // weapon-wielding enemy body
      r.hp = 0.0001;
      h.state().enemies.set(r.id, r);
      h.room.damageEnemy(r, r.id, 1, []);
    }
    expect(h.state().pickups.size).toBe(before); // ZERO drops of any kind in the workshop
    // And a loot identity acquired elsewhere is SHED on entering training (no power laundering).
    const p = h.state().players.get("p1");
    p.weaponRarity = 5;
    p.weaponAffix = "frenzied";
    h.send("p1", "toggleTraining"); // back to arena
    h.send("p1", "toggleTraining"); // into training again — sheds the loot identity
    expect(p.weaponRarity).toBe(0);
    expect(p.weaponAffix).toBe("");
  });
});

describe("GameRoom — §M14 golden tick snapshot (the hand-numbered phase order is a CONTRACT)", () => {
  // update() sequences ~20 mutating phases by hand-numbered comments; ArenaScene chains order-dependent
  // calls. A reorder compiles + lints clean and silently changes the sim. This drives a FIXED, fully-seeded
  // scenario and digests the final state, so a reorder that shifts any value fails the gate. Math.random is
  // backed by a seeded mulberry32 (map gen + spawn director + spreads all deterministic). The digest rounds
  // FP to integers: a phase reorder moves whole HP/positions; cross-platform libm noise (CI is Linux, dev is
  // Windows) stays sub-pixel and rounds away — so this is robust without a brittle byte-hash.
  function runScript(): Record<string, unknown> {
    const rng = makeRng(0x1234abcd);
    const spy = vi.spyOn(Math, "random").mockImplementation(() => rng.next());
    try {
      const h = makeRoom({ dimensionId: "wild-west" });
      h.join("p1");
      h.join("p2");
      // Manually plant two critters on the clear spawn disc (deterministic ints — no spawn-ring libm in the
      // sensitive path), then run a scripted attack cadence. The spawn director still runs (exercised), but
      // the digest's HP/positions come from this controlled duel.
      for (const [id, dx] of [
        ["c1", 70],
        ["c2", -70],
      ] as const) {
        const e = new EnemyState();
        e.id = id;
        e.kind = "critter";
        e.hp = 12;
        e.x = h.room.map.spawnX + dx;
        e.y = h.room.map.spawnY;
        h.state().enemies.set(id, e);
      }
      for (let t = 0; t < 60; t++) {
        if (t % 6 === 0) h.send("p1", "attack", { aimX: 1, aimY: 0 });
        if (t % 6 === 3) h.send("p2", "attack", { aimX: -1, aimY: 0 });
        h.tick(1);
      }
      const s = h.state();
      const players = [...s.players.values()]
        // biome-ignore lint/suspicious/noExplicitAny: schema rows, read in the test harness.
        .map((p: any) => ({
          id: p.id,
          alive: p.alive,
          hp: Math.round(p.hp),
          x: Math.round(p.x),
          y: Math.round(p.y),
        }))
        .sort((a, b) => a.id.localeCompare(b.id));
      return {
        outcome: s.outcome,
        mode: s.mode,
        dimensionId: s.dimensionId,
        elapsed: Math.round(s.elapsed * 100) / 100,
        players,
        plantedAlive: ["c1", "c2"].filter((id) => s.enemies.has(id)).length,
        portalOpen: s.portalOpen,
        bossSpawned: h.room.bossSpawned,
      };
    } finally {
      spy.mockRestore();
    }
  }

  it("is fully deterministic under a seeded RNG (no un-seeded random source leaks into the tick)", () => {
    expect(runScript()).toEqual(runScript());
  });

  it("matches the golden digest (a phase reorder would shift this)", () => {
    expect(runScript()).toMatchInlineSnapshot(`
      {
        "bossSpawned": false,
        "dimensionId": "wild-west",
        "elapsed": 3,
        "mode": "arena",
        "outcome": "active",
        "plantedAlive": 0,
        "players": [
          {
            "alive": true,
            "hp": 100,
            "id": "p1",
            "x": 2536,
            "y": 2342,
          },
          {
            "alive": true,
            "hp": 99,
            "id": "p2",
            "x": 2364,
            "y": 2380,
          },
        ],
        "portalOpen": false,
      }
    `);
  });
});

// ── §29 v0.118 the 3-slot ARSENAL (belt mode): grabs accumulate into slots + bag; swap/cycle/stash move
// weapons between hand, slots, and bag; loot identity + earned provenance ride along. ──
describe("GameRoom — §29 belt arsenal (3 slots + bag)", () => {
  // Drop a fully-identified, earned pickup at the player's feet and grab it.
  function grabAt(
    h: AnyRoom,
    pid: string,
    weapon: string,
    rarity = 2,
    affix = "keen",
    earned = true,
  ) {
    const p = h.state().players.get("p1");
    const pk = new PickupState();
    pk.id = pid;
    pk.weapon = weapon;
    pk.rarity = rarity;
    pk.affix = affix;
    pk.x = p.x;
    pk.y = p.y;
    h.state().pickups.set(pid, pk);
    if (earned) h.room.earnedPickups.add(pid);
    h.send("p1", "grabWeapon");
  }

  it("seeds 3 slots — slot 0 = the starting weapon, 1 & 2 empty, active 0", () => {
    const h = makeRoom({ belt: true });
    h.join("p1");
    const p = h.state().players.get("p1");
    expect(p.slots.length).toBe(3);
    expect(p.slots[0].weapon).toBe(DEFAULT_WEAPON);
    expect(p.slots[1].weapon).toBe("");
    expect(p.slots[2].weapon).toBe("");
    expect(p.activeSlot).toBe(0);
  });

  it("grabs ACCUMULATE into empty slots (no drop) and equip each grabbed weapon", () => {
    const h = makeRoom({ belt: true });
    h.join("p1");
    const p = h.state().players.get("p1");
    const before = h.state().pickups.size;
    grabAt(h, "drop900", "tombstone-greatsword", 4, "keen");
    // Filled slot 1, switched to it, held the new weapon — nothing dropped to the floor.
    expect(p.activeSlot).toBe(1);
    expect(p.weapon).toBe("tombstone-greatsword");
    expect(p.weaponRarity).toBe(4);
    expect(p.slots[0].weapon).toBe(DEFAULT_WEAPON); // starting weapon preserved
    expect(h.state().pickups.size).toBe(before); // consumed the drop, dropped nothing new
    grabAt(h, "drop901", "rusty-cleaver", 1, "");
    expect(p.activeSlot).toBe(2);
    expect(p.slots[2].weapon).toBe("rusty-cleaver");
  });

  it("swapSlot switches the held weapon and remembers each slot's loot identity", () => {
    const h = makeRoom({ belt: true });
    h.join("p1");
    const p = h.state().players.get("p1");
    grabAt(h, "drop902", "tombstone-greatsword", 4, "keen"); // → slot 1, active 1
    h.send("p1", "swapSlot", { slot: 0 });
    expect(p.activeSlot).toBe(0);
    expect(p.weapon).toBe(DEFAULT_WEAPON);
    expect(p.weaponRarity).toBe(0); // the conjured starter carries no loot identity
    h.send("p1", "swapSlot", { slot: 1 });
    expect(p.weapon).toBe("tombstone-greatsword");
    expect(p.weaponRarity).toBe(4);
    expect(p.weaponAffix).toBe("keen");
    expect(h.room.combat.get("p1").heldEarned).toBe(true); // provenance survives the round-trip
  });

  it("cycleSlot skips empty slots", () => {
    const h = makeRoom({ belt: true });
    h.join("p1");
    const p = h.state().players.get("p1");
    grabAt(h, "drop903", "tombstone-greatsword", 4, "keen"); // slot1 filled, active 1; slot2 empty
    h.send("p1", "cycleSlot", { dir: 1 }); // from 1 → skip empty 2 → wrap to filled 0
    expect(p.activeSlot).toBe(0);
    h.send("p1", "cycleSlot", { dir: 1 }); // 0 → 1 (skip empty 2 not reached first)
    expect(p.activeSlot).toBe(1);
  });

  it("a 4th grab (all slots full) overflows the old active weapon to the BAG, never destroyed", () => {
    const h = makeRoom({ belt: true });
    h.join("p1");
    const p = h.state().players.get("p1");
    grabAt(h, "drop904", "tombstone-greatsword", 4, "keen"); // slot1, active1
    grabAt(h, "drop905", "rusty-cleaver", 1, ""); // slot2, active2
    // slots: [starter, tombstone, cleaver], all full, active 2 (cleaver)
    grabAt(h, "drop906", "wyrmtooth-dagger", 3, "swift"); // full → cleaver overflows to bag
    expect(p.bag.length).toBe(1);
    expect(p.bag[0].weapon).toBe("rusty-cleaver");
    expect(p.slots[2].weapon).toBe("wyrmtooth-dagger");
    expect(p.weapon).toBe("wyrmtooth-dagger");
  });

  it("disassembles an earned bag row in place without a vendor", () => {
    const h = makeRoom({ belt: true });
    h.join("p1");
    const p = h.state().players.get("p1");
    const stored = new enemyComboShared.ArsenalSlot();
    stored.weapon = "tombstone-greatsword";
    stored.earned = true;
    p.bag.push(stored);
    h.send("p1", "disassembleBagWeapon", { index: 0 });
    expect(p.scrip).toBe(weaponDisassemblyValue(stored.weapon));
    expect(p.bag).toHaveLength(0);
  });

  it("belt floor-weapon placement lands ON the deck band, nudged clear of pits", () => {
    const h = makeRoom({ belt: true });
    h.join("p1");
    const level = beltLevelFor("sky-carrier");
    // Place at a PIT x (1600 ∈ the 1560–1670 gap) with a y ABOVE the band. The shared floor-placement
    // path used by bag swaps must nudge it onto solid deck and clamp it into the depth band.
    const pos = h.room.placePickupPos(1600, BELT_Y0 - 500);
    expect(beltPitAtX(level, pos.x)).toBe(false); // off the pit
    expect(pos.y).toBeGreaterThanOrEqual(BELT_Y0); // inside the depth band
    expect(pos.y).toBeLessThanOrEqual(BELT_Y0 + DEPTH_MAX);
  });

  it("legacy persisted scrip migrates to the account while run money starts at zero", () => {
    const belt = makeRoom({ belt: true });
    belt.room.clients.push({ sessionId: "pB" });
    belt.room.onJoin({ sessionId: "pB" }, { scrip: 123 });
    expect(belt.state().players.get("pB").scrip).toBe(0);
    expect(belt.room.metaAccounts.get("pB").scrip).toBe(123);
    belt.room.clients.push({ sessionId: "pC" });
    belt.room.onJoin({ sessionId: "pC" }, { scrip: 999999 });
    expect(belt.state().players.get("pC").scrip).toBe(0);
    expect(belt.room.metaAccounts.get("pC").scrip).toBe(65535);
    const arena = makeRoom();
    arena.room.clients.push({ sessionId: "pA" });
    arena.room.onJoin({ sessionId: "pA" }, { scrip: 500 });
    expect(arena.state().players.get("pA").scrip).toBe(0); // non-belt never seeds
  });

  it("bagStore frees a slot into the bag; bagEquip pulls it back", () => {
    const h = makeRoom({ belt: true });
    h.join("p1");
    const p = h.state().players.get("p1");
    grabAt(h, "drop907", "tombstone-greatsword", 4, "keen"); // slot1, active1
    h.send("p1", "bagStore", { slot: 1 }); // stash the active slot → bag
    expect(p.slots[1].weapon).toBe("");
    expect(p.weapon).toBe(FISTS_WEAPON); // active slot emptied → fists
    expect(p.bag.length).toBe(1);
    h.send("p1", "bagEquip", { index: 0, slot: 1 }); // pull it back into the (empty) slot 1
    expect(p.slots[1].weapon).toBe("tombstone-greatsword");
    expect(p.bag.length).toBe(0); // consumed (slot was empty)
    expect(p.weapon).toBe("tombstone-greatsword"); // re-mirrored into the active hand
  });
});

// ── B20 L1 flat crit: 5% base plus additive modifier hooks, rolled per damage source. ──
describe("GameRoom — §30 crit", () => {
  it("critChanceFor starts at 5%, sums additive hooks, and caps", () => {
    expect(critChanceFor()).toBeCloseTo(0.05, 5);
    expect(critChanceFor([0.1, 0.04])).toBeCloseTo(0.19, 5);
    expect(critChanceFor([1])).toBe(0.75);
  });

  it("a landed crit DOUBLES damage and bumps critFlash; a miss does neither", () => {
    const h = makeRoom();
    h.join("p1");
    const enemy = new EnemyState();
    enemy.id = "e";
    enemy.kind = "grunt";
    enemy.hp = 1000; // stays > 0 so damageEnemy returns before the kind/death path
    h.state().enemies.set("e", enemy);
    // Roll 0 < 0.5 → crit.
    const rng = vi.spyOn(Math, "random").mockReturnValue(0);
    let hp = enemy.hp;
    h.room.damageEnemy(enemy, "e", 10, [], 0.5);
    expect(hp - enemy.hp).toBe(10 * CRIT_MULT);
    expect(enemy.critFlash).toBe(1);
    // Roll 0.9 ≥ 0.5 → no crit.
    rng.mockReturnValue(0.9);
    hp = enemy.hp;
    h.room.damageEnemy(enemy, "e", 10, [], 0.5);
    expect(hp - enemy.hp).toBe(10);
    expect(enemy.critFlash).toBe(1); // unchanged
    // crit chance 0 (non-player source) never crits even on a 0 roll.
    rng.mockReturnValue(0);
    hp = enemy.hp;
    h.room.damageEnemy(enemy, "e", 10, [], 0);
    expect(hp - enemy.hp).toBe(10);
    rng.mockRestore();
  });
});

// ── §30 v0.118 weapon class SET-BONUS (Brotato parity #2): N-of-a-class in the loadout escalates that
// class's held damage. ──
describe("GameRoom — §30 weapon set-bonus", () => {
  const melee = WEAPON_IDS.filter((id) => WEAPONS[id]?.tags.classPool === "melee");
  const ranged = WEAPON_IDS.filter((id) => WEAPONS[id]?.tags.classPool === "ranged");

  it("escalates the held weapon's class bonus at 2 and 3 of a class", () => {
    const m0 = melee[0] as string;
    const m1 = melee[1] as string;
    const m2 = melee[2] as string;
    expect(weaponSetBonus([m0, "", ""], m0)).toBe(1); // lone weapon → no bonus
    expect(weaponSetBonus([m0, m1, ""], m0)).toBeCloseTo(1 + SET_BONUS_2, 5); // 2 of a class
    expect(weaponSetBonus([m0, m1, m2], m0)).toBeCloseTo(1 + SET_BONUS_3, 5); // 3 of a class
  });

  it("counts only the HELD weapon's class — a mixed loadout gives no bonus", () => {
    const m0 = melee[0] as string;
    const r0 = ranged[0] as string;
    // held is melee, but only ONE melee in the loadout (+ a ranged + empty) → no melee set-bonus.
    expect(weaponSetBonus([m0, r0, ""], m0)).toBe(1);
    // held is ranged with two ranged → ranged bonus (independent of the melee count).
    if (ranged.length >= 2)
      expect(weaponSetBonus([r0, ranged[1] as string, m0], r0)).toBeCloseTo(1 + SET_BONUS_2, 5);
  });

  it("unknown / empty ids are ignored", () => {
    const m0 = melee[0] as string;
    expect(weaponSetBonus(["", "nope", ""], m0)).toBe(1); // only the held's class counts; none in list
    expect(weaponSetBonus([m0, "nope", ""], m0)).toBe(1); // only 1 real melee
  });
});

// B20 L3: every terminal route banks run money with no tax.
describe("GameRoom — terminal money banking", () => {
  it("emits the bank receipt and clears run money", () => {
    const h = makeRoom();
    const messages: Array<{ type: string; payload: unknown }> = [];
    const client = {
      sessionId: "p1",
      send: (type: string, payload: unknown) => messages.push({ type, payload }),
    };
    h.room.clients.push(client);
    h.room.onJoin(client);
    const p = h.state().players.get("p1");
    p.scrip = 100;
    h.room.enterTerminalOutcome("victory");
    expect(p.scrip).toBe(0);
    expect(h.room.metaAccounts.get("p1").scrip).toBe(100);
    expect(messages.find((message) => message.type === "moneyBankReceipt")?.payload).toMatchObject({
      banked: 100,
      bankTotal: 100,
    });
  });
});

// ── §33 v0.118 FOOTFALL QUAKE — the colossus stomp you JUMP over or PARRY. ──
describe("GameRoom — §33 footfall quake", () => {
  it("hits grounded flat-footed players; airborne (jump) or i-frames (parry) negate it", () => {
    const h = makeRoom();
    h.join("p1");
    const p = h.state().players.get("p1");
    p.x = 1000;
    p.y = 1000;
    p.hp = 100;
    p.height = 0;
    const c = h.room.combat.get("p1");
    c.invuln = 0;
    // grounded + flat-footed inside the radius → takes it.
    h.room.applyBossQuake(1000, 1000, 300, 30, 500);
    expect(p.hp).toBeLessThan(100);
    // AIRBORNE (mid-jump) → immune.
    p.hp = 100;
    p.height = 50;
    h.room.applyBossQuake(1000, 1000, 300, 30, 500);
    expect(p.hp).toBe(100);
    // grounded but PARRYING (i-frame window) → negated + white parry flash.
    p.height = 0;
    c.invuln = 0.2;
    const seq = p.parriedSeq;
    h.room.applyBossQuake(1000, 1000, 300, 30, 500);
    expect(p.hp).toBe(100);
    expect(p.parriedSeq).toBe(seq + 1);
    // outside the radius → nothing.
    p.x = 5000;
    c.invuln = 0;
    h.room.applyBossQuake(1000, 1000, 300, 30, 500);
    expect(p.hp).toBe(100);
  });
});

describe("GameRoom — B26 directional parry reactions", () => {
  it("routes below/side/above and publishes the deterministic three-pose cycle", () => {
    const h = makeRoom();
    h.join("parry-directions");
    h.room.map.pois.length = 0;
    h.room.map.tiles.fill(TILE_GROUND);
    const player = h.state().players.get("parry-directions");
    const combat = h.room.combat.get(player.id);
    const attacker = new EnemyState();
    attacker.id = "parry-source";
    attacker.kind = "ronin";
    attacker.hp = 100_000;
    h.state().enemies.set(attacker.id, attacker);
    player.x = h.room.map.spawnX;
    player.y = h.room.map.spawnY;

    attacker.x = player.x;
    attacker.y = player.y + 100;
    h.room.resolveParry(player, combat, attacker, attacker.id, 10);
    expect(player.vh).toBe(PARRY_LAUNCH);
    expect(unpackParryReaction(player.parryPresentation)).toBe(ParryReaction.FromBelow);
    expect(unpackParryGuardPose(player.parryPresentation)).toBe(0);

    combat.vh = 0;
    player.vh = 0;
    player.vx = 0;
    player.vy = 0;
    const sideStartX = player.x;
    const sideStartY = player.y;
    attacker.x = player.x - 100;
    attacker.y = player.y;
    h.room.resolveParry(player, combat, attacker, attacker.id, 20);
    expect(player.x).toBeCloseTo(sideStartX + 80);
    expect(player.y).toBeCloseTo(sideStartY);
    expect(player.vh).toBe(0);
    expect(unpackParryReaction(player.parryPresentation)).toBe(ParryReaction.FromLeft);
    expect(unpackParryGuardPose(player.parryPresentation)).toBe(1);

    const aboveStart = { x: player.x, y: player.y };
    attacker.x = player.x;
    attacker.y = player.y - 100;
    h.room.resolveParry(player, combat, attacker, attacker.id, 40);
    expect({ x: player.x, y: player.y }).toEqual(aboveStart);
    expect(player.vh).toBe(0);
    expect(unpackParryReaction(player.parryPresentation)).toBe(ParryReaction.FromAbove);
    expect(unpackParryGuardPose(player.parryPresentation)).toBe(2);

    h.state().tick += PARRY_GUARD_RESET_TICKS + 1;
    attacker.x = player.x + 100;
    attacker.y = player.y;
    h.room.resolveParry(player, combat, attacker, attacker.id, 1);
    expect(unpackParryReaction(player.parryPresentation)).toBe(ParryReaction.FromRight);
    expect(unpackParryGuardPose(player.parryPresentation)).toBe(0);
  });
});

// ── §36 belt bosses (bespoke arena fights now run belt finales) must stay ON the deck when they reposition. ──
describe("GameRoom — B34 corporate-grid LDtk belt consumption", () => {
  it("places the first player at PlayerSpawn and clamps movement to lane/end bounds", () => {
    const h = makeRoom({ belt: true, beltLevel: "corporate-grid" });
    h.join("corporate-player");
    const player = h.state().players.get("corporate-player");
    expect({ x: player.x, y: player.y }).toEqual({ x: 420, y: BELT_Y0 + 780 });

    player.x = 20;
    player.y = BELT_Y0 + 300;
    h.tick();
    expect(player.x).toBe(144);
    expect(player.y).toBe(BELT_Y0 + 474);

    h.state().beltLockX = 0;
    player.x = 5140;
    player.y = BELT_Y0 + 1000;
    h.tick();
    expect(player.x).toBe(4056);
    expect(player.y).toBe(BELT_Y0 + 906);
  });

  it("spawns an early room wave from generated anchors ahead of the player", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);
    const h = makeRoom({ belt: true, beltLevel: "corporate-grid" });
    h.join("corporate-wave-player");
    const player = h.state().players.get("corporate-wave-player");
    h.room.spawnBeltWave(4, 120, 1440, 0);
    expect(h.state().enemies.size).toBe(4);
    expect(
      [...h.state().enemies.values()].every(
        (enemy: { x: number }) => enemy.x > player.x && [780, 1380].includes(enemy.x),
      ),
    ).toBe(true);
  });

  it("absorbs a projectile swept into a Collision_IntGrid solid-1 cell", () => {
    const h = makeRoom({ belt: true, beltLevel: "corporate-grid" });
    h.join("corporate-projectile-player");
    h.room.fireProjectile(
      { x: 600, y: BELT_Y0 + 500 },
      { x: 600, y: BELT_Y0 + 200 },
      800,
      10,
      false,
    );
    expect(h.state().projectiles.size).toBe(1);
    h.room.stepProjectiles(0.5);
    expect(h.state().projectiles.size).toBe(0);
  });

  it("arms only after the final required room wave clears", () => {
    const h = makeRoom({ belt: true, beltLevel: "corporate-grid" });
    h.join("corporate-clear-player");
    h.room.beltRoomIdx = h.room.beltLevel.rooms.length - 1;
    h.room.beltPhase = "fight";
    h.state().beltLockX = h.room.beltLevel.rooms.at(-1).gateX;
    h.state().enemies.clear();
    h.tick();
    expect(h.state().elevatorPhase).toBe(CORPORATE_ELEVATOR_PHASE.ready);
    expect(h.state().beltLockX).toBe(0);
    expect(h.state().outcome).toBe("active");
  });

  it("runs the shipped chest cadence on safe authored corporate-floor anchors", () => {
    const h = makeRoom({ belt: true, beltLevel: "corporate-grid" });
    h.join("corporate-chest-runner");
    h.state().tick = h.room.chestCadence.nextSpawnTick;
    h.room.stepChestDirector();

    expect(h.state().chests.size).toBe(1);
    const chest = [...h.state().chests.values()][0];
    const floor = corporateGridFloorForBelt(h.room.beltLevel);
    if (!floor) throw new Error("corporate floor fixture is required");
    expect(chest.x).toBeGreaterThanOrEqual(floor.playableBounds.minX);
    expect(chest.x).toBeLessThanOrEqual(floor.playableBounds.maxX);
    expect(chest.y).toBeGreaterThanOrEqual(BELT_Y0);
    expect(chest.y).toBeLessThanOrEqual(BELT_Y0 + DEPTH_MAX);
  });

  it("moves the entire co-op party, teleports a straggler, and preserves B20 run state", () => {
    const h = makeRoom({ belt: true, beltLevel: "corporate-grid" });
    h.join("elevator-trigger");
    h.join("elevator-straggler");
    const trigger = h.state().players.get("elevator-trigger");
    const straggler = h.state().players.get("elevator-straggler");
    const exitX = h.room.beltLevel.corporateGridFloorId
      ? h.room.beltLevel.length
      : Number.NaN;
    trigger.x = exitX - 24;
    straggler.x = 420;
    trigger.scrip = 77;
    trigger.dualWield.relics.moveSpeed = 2;
    const money = new MoneyDropState();
    money.id = "elevator-money";
    money.x = exitX - 30;
    money.y = trigger.y;
    money.value = 19;
    money.bornTick = 1_000;
    h.state().moneyDrops.set(money.id, money);
    const chest = new ChestState();
    chest.id = "elevator-chest";
    chest.x = exitX - 60;
    chest.y = trigger.y;
    h.state().chests.set(chest.id, chest);
    h.state().elevatorPhase = CORPORATE_ELEVATOR_PHASE.ready;
    const triggerTeleportBefore = trigger.teleportSeq;
    const stragglerTeleportBefore = straggler.teleportSeq;

    h.send("elevator-trigger", "useElevator");
    expect(h.state().elevatorPhase).toBe(CORPORATE_ELEVATOR_PHASE.countdown);
    h.tick(CORPORATE_ELEVATOR_COUNTDOWN_TICKS + CORPORATE_ELEVATOR_DEPART_TICKS);

    expect(h.state().corporateFloorDepth).toBe(2);
    expect(h.state().corporateFloorId).toBe("office-random-dude-portrait-hall");
    expect(h.state().corporateVariant).toBe(0);
    expect(h.state().elevatorPhase).toBe(CORPORATE_ELEVATOR_PHASE.arriving);
    expect(trigger.x).toBeLessThan(600);
    expect(straggler.x).toBeLessThan(600);
    expect(trigger.teleportSeq).toBeGreaterThan(triggerTeleportBefore);
    expect(straggler.teleportSeq).toBeGreaterThan(stragglerTeleportBefore);
    expect(trigger.scrip).toBe(77);
    expect(trigger.dualWield.relics.moveSpeed).toBe(2);
    expect(h.state().moneyDrops.get(money.id)?.value).toBe(19);
    const nextFloor = corporateGridFloorForBelt(h.room.beltLevel);
    if (!nextFloor) throw new Error("next corporate floor fixture is required");
    expect(h.state().moneyDrops.get(money.id)?.x).toBeLessThanOrEqual(
      nextFloor.playableBounds.maxX,
    );
    expect(h.state().chests.has(chest.id)).toBe(true);
    expect(h.state().chests.get(chest.id)?.x).toBeLessThanOrEqual(nextFloor.playableBounds.maxX);
    expect(h.state().elapsed).toBeGreaterThan(0);
  });
});

describe("GameRoom — §36 belt boss stays on the deck", () => {
  it("moveBoss clamps a repositioning boss to the level length + floor band", () => {
    const h = makeRoom({ belt: true });
    h.join("p1");
    h.room.spawnBoss(); // belt path lands it on the deck
    const boss = h.room.bossId ? h.state().enemies.get(h.room.bossId) : undefined;
    expect(boss).toBeTruthy();
    const level = h.room.beltLevel;
    const r = ENEMY_KINDS[boss.kind]?.radius ?? 40;
    // A blink/charge primitive drives moveBoss WAY off the deck: past the level, far below the depth band.
    h.room.bossSink.moveBoss(9_999_999, -9_999_999);
    expect(boss.x).toBeGreaterThanOrEqual(r);
    expect(boss.x).toBeLessThanOrEqual(level.length - r);
    expect(boss.y).toBe(clampBeltFloorY(level, boss.x, -9_999_999, r)); // pulled onto the floor band
    expect(boss.y).toBeGreaterThanOrEqual(BELT_Y0);
    expect(boss.y).toBeLessThanOrEqual(BELT_Y0 + DEPTH_MAX);
  });
  it("in the top-down arena moveBoss is unclamped (exact passthrough)", () => {
    const h = makeRoom(); // non-belt
    h.join("p1");
    h.room.spawnBoss();
    const boss = h.room.bossId ? h.state().enemies.get(h.room.bossId) : undefined;
    expect(boss).toBeTruthy();
    h.room.bossSink.moveBoss(1234, 5678);
    expect(boss.x).toBe(1234);
    expect(boss.y).toBe(5678);
  });
  it("summoned boss ADDS land on the deck band (a telegraphed spot off the band is pulled in)", () => {
    const h = makeRoom({ belt: true });
    h.join("p1");
    const level = h.room.beltLevel;
    const kindId = getDimension(h.state().dimensionId).roster[0]; // a real trash kind for this dimension
    if (!kindId) throw new Error("dimension roster is empty");
    h.room.spawnBossAddAt(kindId, 3000, -50_000); // telegraphed WAY above the deck
    const add = [...h.state().enemies.values()].find((e: EnemyState) => e.kind === kindId);
    expect(add, `${kindId} add spawned`).toBeTruthy();
    const r = ENEMY_KINDS[kindId]?.radius ?? 40;
    expect(add.y).toBe(clampBeltFloorY(level, add.x, -50_000, r));
    expect(add.y).toBeGreaterThanOrEqual(BELT_Y0);
    expect(add.y).toBeLessThanOrEqual(BELT_Y0 + DEPTH_MAX);
    expect(add.x).toBeLessThanOrEqual(level.length - r);
  });
});

// ── §36 every dimension's finale boss must be a REGISTERED kind AND run its (bespoke) fight in belt mode
// without throwing — the primitives (dashes/fans/telegraphs) were authored for the arena, so this pins that
// they survive on the deck. ──
describe("GameRoom — §36 dimension finale bosses run in belt mode", () => {
  for (const dim of Object.values(DIMENSIONS)) {
    it(`${dim.id}: boss "${dim.boss}" spawns + survives 60 belt ticks`, () => {
      const h = makeRoom({ belt: true });
      h.join("p1");
      h.join("p2");
      h.room.spawnBoss(dim.boss);
      const boss = h.room.bossId ? h.state().enemies.get(h.room.bossId) : undefined;
      expect(boss, `${dim.boss} is a registered boss kind`).toBeTruthy();
      expect(boss.kind).toBe(dim.boss); // the override was accepted (not silently defaulted)
      expect(() => h.tick(60, 50)).not.toThrow(); // 3s of the fight's primitives, on the deck
    });
  }
});

// ── §36 every belt level must resolve to a REAL dimension whose finale boss is a registered kind (a typo'd
// dimensionId silently falls back to wild-west; an unregistered boss kind spawns nothing). ──
describe("GameRoom — §36 belt levels are well-formed", () => {
  for (const id of BELT_LEVEL_IDS) {
    it(`${id}: real dimension + a valid authored progression`, () => {
      const level = beltLevelFor(id);
      expect(level.id).toBe(id);
      const dim = getDimension(level.dimensionId);
      expect(
        dim.id,
        `${id} dimensionId "${level.dimensionId}" resolves (not the wild-west fallback)`,
      ).toBe(level.dimensionId);
      expect(ENEMY_KINDS[dim.boss]?.archetype, `${dim.boss} is a registered boss`).toBe("boss");
      if (level.corporateGridFloorId) {
        expect(level.rooms.every((room) => !room.boss)).toBe(true); // elevator, never a boss finale
      } else {
        expect(level.rooms.some((room) => room.boss)).toBe(true);
      }
      expect(level.rooms.length).toBeGreaterThanOrEqual(2);
    });
  }
});

// §38 the signature draft is WEAPON-GATED: parry augments are universal, gun/cast augments only offered to
// the matching delivery (so ranged/caster get a signature, and melee never draws a dead gun/cast pick).
describe("GameRoom — §38 weapon-gated signature draft", () => {
  const GUN_AUGS = Object.values(AUGMENTS)
    .filter((a) => a.weapon === "gun")
    .map((a) => a.id);
  const CAST_AUGS = Object.values(AUGMENTS)
    .filter((a) => a.weapon === "cast")
    .map((a) => a.id);
  /** All ids that can EVER appear across many draws for a given weapon kind. */
  const seen = (weaponKind?: "gun" | "cast") => {
    const s = new Set<string>();
    for (let i = 0; i < 400; i++)
      for (const id of draftAugments(Math.random, weaponKind)) s.add(id);
    return s;
  };
  it("melee (no weapon kind) never offers gun OR cast augments", () => {
    const s = seen(undefined);
    for (const id of [...GUN_AUGS, ...CAST_AUGS]) expect(s.has(id)).toBe(false);
    expect(s.size).toBeGreaterThan(0); // still offers the parry pool
  });
  it("a gun draft can offer gunslinger augments but never caster ones", () => {
    const s = seen("gun");
    expect(GUN_AUGS.some((id) => s.has(id))).toBe(true);
    for (const id of CAST_AUGS) expect(s.has(id)).toBe(false);
  });
  it("a cast draft can offer caster augments but never gunslinger ones", () => {
    const s = seen("cast");
    expect(CAST_AUGS.some((id) => s.has(id))).toBe(true);
    for (const id of GUN_AUGS) expect(s.has(id)).toBe(false);
  });
});

describe("B55 chest content authority and run boundaries", () => {
  function joinWithReceipts(id: string) {
    const h = makeRoom();
    const messages: Array<{ type: string; payload: AnyRoom }> = [];
    const client = {
      sessionId: id,
      send: (type: string, payload: unknown) => messages.push({ type, payload }),
    };
    h.room.clients.push(client);
    h.room.onJoin(client);
    return {
      h,
      player: h.state().players.get(id),
      messages,
      account: h.room.metaAccounts.get(id),
    };
  }

  function seededStandardChest(
    h: ReturnType<typeof makeRoom>,
    player: AnyRoom,
    sequence: number,
    spawnTick = 500,
  ) {
    const chest = new ChestState();
    chest.id = `chest:${sequence}:${spawnTick}`;
    chest.x = player.x;
    chest.y = player.y;
    chest.zone = enemyComboShared.MAP_ZONE_SCAR;
    chest.kind = enemyComboShared.CHEST_KIND_STANDARD;
    chest.spawnTick = spawnTick;
    chest.openedBy.set(player.id, false);
    h.state().chests.set(chest.id, chest);
    return chest;
  }

  function findSequence(
    fixture: ReturnType<typeof joinWithReceipts>,
    matches: (reward: ReturnType<typeof enemyComboShared.rollChestReward>) => boolean,
  ) {
    fixture.h.room.chestRoomSeed = 0xb55c0de;
    fixture.h.room.chestRunStartTick = 0;
    fixture.h.state().tick = 1_000;
    for (let sequence = 0; sequence < 20_000; sequence++) {
      const reward = enemyComboShared.rollChestReward({
        roomSeed: fixture.h.room.chestRoomSeed,
        chestSequence: sequence,
        spawnTick: 500,
        elapsedSeconds: 50,
        zone: enemyComboShared.MAP_ZONE_SCAR,
        kind: enemyComboShared.CHEST_KIND_STANDARD,
        playerKey: fixture.player.id,
        luckStacks: fixture.player.relics.luck,
        ownedRareIds: [],
        ownedAugments: fixture.player.augments,
        activePetId: fixture.player.petId,
        weaponIds: enemyComboShared.unlockedWeaponDropPool(fixture.account),
      });
      if (matches(reward)) return sequence;
    }
    throw new Error("deterministic B55 chest fixture not found");
  }

  it("writes an augment-bearing trinket grant and sends its full player-facing explanation", () => {
    const fixture = joinWithReceipts("chest-augment");
    const sequence = findSequence(fixture, (reward) => !!reward.trinket?.augmentId);
    const chest = seededStandardChest(fixture.h, fixture.player, sequence);
    fixture.h.room.openChestForPlayer(fixture.player.id, chest.id);

    const receipt = fixture.messages.find((message) => message.type === "chestOpened")?.payload;
    expect(receipt?.trinket?.augment?.id).toBeTruthy();
    expect(receipt?.trinket?.augment?.desc.length).toBeGreaterThan(8);
    expect(
      enemyComboShared.countAugment(fixture.player.augments, receipt.trinket.augment.id),
    ).toBe(1);
    expect(chest.openedBy.get(fixture.player.id)).toBe(true);
  });

  it("applies a chest HP potion instantly at 35% max HP and clamps overheal", () => {
    const fixture = joinWithReceipts("chest-potion");
    const sequence = findSequence(
      fixture,
      (reward) => reward.content === enemyComboShared.CHEST_CONTENT_HP_POTION,
    );
    fixture.player.hp = 80;
    const chest = seededStandardChest(fixture.h, fixture.player, sequence);
    fixture.h.room.openChestForPlayer(fixture.player.id, chest.id);

    const receipt = fixture.messages.find((message) => message.type === "chestOpened")?.payload;
    expect(fixture.player.hp).toBe(fixture.player.maxHp);
    expect(receipt?.potion).toMatchObject({
      healFraction: enemyComboShared.CHEST_HP_POTION_HEAL_FRACTION,
      healed: 20,
      hp: fixture.player.maxHp,
      maxHp: fixture.player.maxHp,
    });
  });

  it("swaps to one run-only chest pet without adding a permanent account unlock", () => {
    const fixture = joinWithReceipts("chest-pet");
    const original = fixture.player.petId;
    expect(original).toBe("verdant-wing");
    expect(fixture.account.pets["hearth-newt"]).toBeUndefined();

    const sequence = findSequence(
      fixture,
      (reward) =>
        reward.content === enemyComboShared.CHEST_CONTENT_PET &&
        reward.pet?.id === "hearth-newt",
    );
    const chest = seededStandardChest(fixture.h, fixture.player, sequence);
    fixture.h.room.openChestForPlayer(fixture.player.id, chest.id);

    const receipt = fixture.messages.find((message) => message.type === "chestOpened")?.payload;
    expect(receipt?.pet).toMatchObject({
      id: "hearth-newt",
      replacedPet: { id: original },
    });
    expect(fixture.player.petId).toBe("hearth-newt");
    expect(fixture.h.room.petRuns.get(fixture.player.id)).toMatchObject({
      petId: "hearth-newt",
      runOnly: true,
      level: 1,
    });
    fixture.h.room.enterTerminalOutcome("defeat");
    expect(fixture.account.pets["hearth-newt"]).toBeUndefined();
    expect(fixture.player.petId).toBe("");
  });

  it("clears chest augments on restart and terminal run end", () => {
    const h = makeRoom();
    h.join("augment-boundary");
    const player = h.state().players.get("augment-boundary");
    player.augments = "hollowpoints,ricochet-rounds,arc-split";
    h.room.restartRun();
    expect(player.augments).toBe("");

    player.augments = "counterblade";
    h.room.enterTerminalOutcome("defeat");
    expect(player.augments).toBe("");
  });

  it("keeps ultimate grants, meter, input, and activation inert behind ULTIMATES_ENABLED", () => {
    expect(enemyComboShared.ULTIMATES_ENABLED).toBe(false);
    const h = makeRoom();
    h.join("ultimate-disabled");
    const player = h.state().players.get("ultimate-disabled");
    const combat = h.room.combat.get(player.id);
    expect(player.ultArchetype).toBe(0);
    expect(player.ultCharge).toBe(0);

    player.ultArchetype = enemyComboShared.ultimateCodeFor(
      enemyComboShared.UltimateFamily.SunspiteComet,
      "str",
    );
    player.ultCharge = 100;
    combat.ultChargeF = 1;
    h.send(player.id, "ultimate", { aimX: 1, aimY: 0 });
    expect(combat.ultBuffer).toBe(0);
    expect(h.room.acceptUltimate(player, combat)).toBe(false);
    h.tick(1);
    expect(player.ultArchetype).toBe(0);
    expect(player.ultCharge).toBe(0);
    expect(combat.ultChargeF).toBe(0);
  });
});
