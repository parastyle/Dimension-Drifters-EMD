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


describe("GameRoom — weapon bank carry projection", () => {
  it("materializes two same-class entries independently and keeps one zero-value starter floor", () => {
    const h = makeRoom({ belt: true });
    const leadWeapon = roomBankInstance(1, "rattler-sabre", "legendary", "brutal");
    const lead: import("@dd/shared").SingleWeaponEntryV1 = {
      kind: "single",
      entryId: leadWeapon.instanceId,
      weapon: leadWeapon,
    };
    const secondWeapon = roomBankInstance(2, "x2-sandsong-saber", "rare", "keen");
    const second: import("@dd/shared").SingleWeaponEntryV1 = {
      kind: "single",
      entryId: secondWeapon.instanceId,
      weapon: secondWeapon,
    };
    const safe = roomBankSingle(3);
    const joined = joinWeaponAccount(
      h,
      "bank-independent-carry",
      [lead, second, safe],
      [
        { entryId: lead.entryId, zone: "active", start: 1 },
        { entryId: second.entryId, zone: "active", start: 2 },
      ],
      lead.entryId,
    );
    expect(joined.player.slots[0]).toMatchObject({
      weapon: DEFAULT_WEAPON,
      homeIssue: true,
      earned: false,
      bankEntryId: "",
    });
    expect(
      joined.player.slots.slice(1, 3).map((slot: import("@dd/shared").ArsenalSlot) => ({
        weapon: slot.weapon,
        instanceId: slot.instanceId,
        entryId: slot.bankEntryId,
      })),
    ).toEqual([
      {
        weapon: lead.weapon.weaponId,
        instanceId: lead.weapon.instanceId,
        entryId: lead.entryId,
      },
      {
        weapon: second.weapon.weaponId,
        instanceId: second.weapon.instanceId,
        entryId: second.entryId,
      },
    ]);
    expect(joined.player.activeSlot).toBe(1);
    expect(joined.account.weaponBank.stash).toEqual([safe]);
    expect(joined.account.weaponBank.expedition?.entries).toHaveLength(2);
    expect(joined.messages.some((message) => message.type === "weaponManifest")).toBe(true);

    h.room.completeExtraction();
    expect(joined.account.weaponBank.expedition).toBeNull();
    expect(joined.account.weaponBank.stash).toEqual([safe, lead, second]);
  });

  it("mints a found instance only on accepted grab and settles carried+found through extraction", () => {
    const h = makeRoom({ belt: true });
    const joined = joinWeaponAccount(h, "bank-found", [], [], "");
    const pickup = new PickupState();
    pickup.id = "drop-bank-found";
    pickup.weapon = "rusty-cleaver";
    pickup.weaponPublic = "rusty-cleaver";
    pickup.rarity = 4;
    pickup.affix = "brutal";
    pickup.affixPublic = "brutal";
    pickup.x = joined.player.x;
    pickup.y = joined.player.y;
    h.state().pickups.set(pickup.id, pickup);
    h.room.earnedPickups.add(pickup.id);
    h.room.pickupWeaponBankMeta.set(pickup.id, {
      provenance: "enemy-drop",
      ownerId: "",
      ownerLockUntil: 0,
    });
    expect(joined.account.weaponBank.expedition?.entries).toHaveLength(0);

    h.send(joined.player.id, "grabWeapon");
    const found = joined.account.weaponBank.expedition?.entries[0];
    expect(found).toMatchObject({ stakeOrigin: "found", location: "active" });
    expect(found?.entry.kind).toBe("single");
    if (found?.entry.kind !== "single") return;
    expect(found.entry.weapon).toMatchObject({
      weaponId: "rusty-cleaver",
      rarity: "legendary",
      affix: "brutal",
      provenance: "enemy-drop",
      sourceWorldTier: 0,
    });
    expect(enemyComboShared.WEAPON_INSTANCE_ID_RE.test(found.entry.weapon.instanceId)).toBe(true);
    expect(joined.player.slots[joined.player.activeSlot].instanceId).toBe(
      found.entry.weapon.instanceId,
    );

    h.room.completeExtraction();
    expect(joined.account.weaponBank.stash).toEqual([found.entry]);
  });
});

describe("GameRoom — at-stake ledger across down/rez, wipe, disconnect, and terminal settlement", () => {
  it("down and revive preserve exact escrow; a downed owner still banks with squad extraction", () => {
    const h = makeRoom({ belt: true });
    const carried = roomBankSingle(10);
    const owner = joinWeaponAccount(
      h,
      "bank-downed-owner",
      [carried],
      [{ entryId: carried.entryId, zone: "active", start: 1 }],
      carried.entryId,
    );
    const ally = joinWeaponAccount(h, "bank-downed-ally", [], [], "");
    const exactExpedition = owner.account.weaponBank.expedition;
    owner.player.hp = 0;
    h.tick();
    expect(owner.player.alive).toBe(false);
    expect(owner.account.weaponBank.expedition).toBe(exactExpedition);
    expect(owner.player.slots[1].instanceId).toBe(carried.weapon.instanceId);
    h.room.tryRez(ally.player, 10000);
    expect(owner.player.alive).toBe(true);
    expect(owner.account.weaponBank.expedition).toBe(exactExpedition);

    owner.player.alive = false;
    h.room.completeExtraction();
    expect(owner.account.weaponBank.stash).toEqual([carried]);
  });

  it("a terminal wipe deletes the whole active/pack/found stake and never touches safe Stash", () => {
    const h = makeRoom({ belt: true });
    const doomed = roomBankSingle(20);
    const safe = roomBankSingle(21);
    const joined = joinWeaponAccount(
      h,
      "bank-wipe",
      [doomed, safe],
      [{ entryId: doomed.entryId, zone: "active", start: 1 }],
      doomed.entryId,
    );
    const found = roomBankSingle(22);
    const row = {
      entry: found,
      stakeOrigin: "found" as const,
      location: "field" as const,
      start: 255,
    };
    joined.account.weaponBank.expedition?.entries.push(row);
    h.room.weaponRuns.get(joined.player.id).entries.set(found.entryId, row);
    joined.player.hp = 0;
    h.tick();
    expect(h.state().outcome).toBe("defeat");
    expect(joined.account.weaponBank.expedition).toBeNull();
    expect(joined.account.weaponBank.stash).toEqual([safe]);
    expect(joined.account.weaponBank.lastCarry.activeEntryId).toBe(doomed.entryId);
  });

  it("transport leave neither saves nor loses escrow; rejoin restores debt and the later result decides", () => {
    const h = makeRoom({ belt: true });
    const carried = roomBankSingle(30);
    const joined = joinWeaponAccount(
      h,
      "bank-disconnect",
      [carried],
      [{ entryId: carried.entryId, zone: "active", start: 1 }],
      carried.entryId,
    );
    const samePlayer = joined.player;
    samePlayer.slots[1].cooldown = 0.73;
    samePlayer.slots[1].resourceReady = true;
    h.room.clients = h.room.clients.filter(
      (client: { sessionId: string }) => client.sessionId !== joined.player.id,
    );
    h.room.onLeave(joined.client);
    expect(joined.account.weaponBank.expedition?.entries[0]?.entry).toEqual(carried);
    expect(joined.account.weaponBank.stash).toEqual([]);

    h.room.clients.push(joined.client);
    h.room.onJoin(joined.client, {});
    expect(h.state().players.get(joined.player.id)).toBe(samePlayer);
    expect(samePlayer.slots[1].cooldown).toBe(0.73);
    expect(joined.account.weaponBank.expedition?.entries).toHaveLength(1);

    h.room.clients = h.room.clients.filter(
      (client: { sessionId: string }) => client.sessionId !== joined.player.id,
    );
    h.room.onLeave(joined.client);
    h.room.enterTerminalOutcome("victory");
    expect(joined.account.weaponBank.expedition).toBeNull();
    expect(joined.account.weaponBank.stash).toEqual([carried]);
  });

});

describe("GameRoom - weapon-bank explicit abandon boundary", () => {
  it("forfeits the workshop initiator's stake without letting a host destroy an ally's manifest", () => {
    const solo = makeRoom({ belt: true });
    const doomed = roomBankSingle(50);
    const safe = roomBankSingle(51);
    const joined = joinWeaponAccount(
      solo,
      "bank-workshop-solo",
      [doomed, safe],
      [{ entryId: doomed.entryId, zone: "active", start: 1 }],
      doomed.entryId,
    );
    solo.send(joined.player.id, "toggleTraining");
    expect(solo.state().mode).toBe("training");
    expect(joined.account.weaponBank.stash).toEqual([safe]);
    expect(joined.account.weaponBank.expedition?.entries).toEqual([]);
    expect(
      joined.player.slots.some(
        (slot: import("@dd/shared").ArsenalSlot) =>
          slot.weapon === DEFAULT_WEAPON && slot.homeIssue,
      ),
    ).toBe(true);

    const coop = makeRoom({ belt: true });
    const hostStake = roomBankSingle(52);
    const host = joinWeaponAccount(
      coop,
      "bank-workshop-host",
      [hostStake],
      [{ entryId: hostStake.entryId, zone: "active", start: 1 }],
      hostStake.entryId,
    );
    const allyStake = roomBankSingle(53);
    const ally = joinWeaponAccount(
      coop,
      "bank-workshop-ally",
      [allyStake],
      [{ entryId: allyStake.entryId, zone: "active", start: 1 }],
      allyStake.entryId,
    );
    const allyReservation = ally.account.weaponBank.expedition;
    coop.send(host.player.id, "toggleTraining");
    expect(coop.state().mode).toBe("training");
    expect(host.account.weaponBank.expedition?.entries).toEqual([]);
    expect(host.account.weaponBank.stash).toEqual([]);
    expect(ally.account.weaponBank.expedition).toBe(allyReservation);
    expect(ally.account.weaponBank.expedition?.entries[0]?.entry).toEqual(allyStake);
  });
});

// METAGAME WAVE 3 — append-only Drive authority, economy, and equivalence coverage.
describe("GameRoom — schema-31 Drive authority", () => {
  it("ships the nested quantized mirror while affordability remains on the private float", () => {
    const h = makeRoom();
    h.join("drive-float");
    const player = h.state().players.get("drive-float");
    const combat = h.room.combat.get(player.id);
    const weapon = WEAPONS["x-gun-revolver-cannon"]!;
    const profile = enemyComboShared.weaponResourceProfile(weapon.id)!;
    const interval = enemyComboShared.effectiveAcceptedWeaponInterval(
      weapon,
      enemyComboShared.weaponAttackCooldown(weapon),
    );
    const cost = enemyComboShared.driveCostForProfile(profile, interval);

    expect(enemyComboShared.SCHEMA_VERSION).toBe(47);
    expect(h.state().schemaVersion).toBe(47);
    expect(player.weaponResource).toBe(player.dualWield.weaponResource);
    expect(player.weaponResource).toMatchObject({
      valueQ: 10_000,
      regenMode: 1,
      beamLockEndTick: 0,
    });

    combat.drive.valueF = cost - 0.001;
    player.weaponResource.valueQ = Math.floor(cost * 100); // deliberately optimistic mirror
    expect(
      h.room.trySpendWeaponResource(
        player,
        combat,
        weapon,
        weapon.id,
        enemyComboShared.CombatDelivery.Gun,
        0,
        interval,
        1,
        0,
        "tap",
      ).accepted,
    ).toBe(false);

    combat.drive.valueF = cost;
    expect(
      h.room.trySpendWeaponResource(
        player,
        combat,
        weapon,
        weapon.id,
        enemyComboShared.CombatDelivery.Gun,
        0,
        interval,
        1,
        0,
        "tap",
      ).accepted,
    ).toBe(true);
    expect(combat.drive.valueF).toBe(0);
    expect(player.weaponResource.valueQ).toBe(0);

    combat.drive.valueF = 42.259;
    h.room.commitWeaponResourceTick(player, combat);
    expect(player.weaponResource.valueQ).toBe(4225);
  });

  it("implements the anti-turtle modes, debt edge, 640px threat boundary, and pause law", () => {
    const h = makeRoom();
    h.join("drive-regen");
    const player = h.state().players.get("drive-regen");
    const combat = h.room.combat.get(player.id);
    const step = () => {
      h.room.beginWeaponResourceTick(player, combat, 0.05);
      h.room.commitWeaponResourceTick(player, combat);
    };

    combat.drive.valueF = 0;
    combat.drive.recoveryDebtF = 0;
    step();
    expect([combat.drive.valueF, combat.drive.regenMode]).toEqual([
      1,
      enemyComboShared.DriveRegenMode.Floor,
    ]);

    const threat = new EnemyState();
    threat.id = "drive-threat";
    threat.kind = "critter";
    threat.hp = 999;
    threat.x = player.x + enemyComboShared.DRIVE_THREAT_RADIUS;
    threat.y = player.y;
    h.state().enemies.set(threat.id, threat);
    h.room.enemyGrid.insert(threat.id, threat.x, threat.y);
    combat.drive.valueF = 0;
    step();
    expect([combat.drive.valueF, combat.drive.regenMode]).toEqual([
      1.75,
      enemyComboShared.DriveRegenMode.Engaged,
    ]);

    threat.x = player.x + enemyComboShared.DRIVE_THREAT_RADIUS + 0.01;
    h.room.enemyGrid.update(threat.id, threat.x, threat.y);
    combat.drive.valueF = 0;
    step();
    expect([combat.drive.valueF, combat.drive.regenMode]).toEqual([
      1,
      enemyComboShared.DriveRegenMode.Floor,
    ]);

    h.room.setWeaponResourceRegenOverride(player.id, "forceEngaged");
    combat.drive.valueF = 0;
    combat.drive.recoveryDebtF = 0.1;
    step();
    expect([combat.drive.valueF, combat.drive.regenMode]).toEqual([
      1,
      enemyComboShared.DriveRegenMode.Floor,
    ]);
    step(); // debt is sampled before aging: its final tick is still floor-only
    expect([combat.drive.valueF, combat.drive.regenMode]).toEqual([
      2,
      enemyComboShared.DriveRegenMode.Floor,
    ]);
    step();
    expect([combat.drive.valueF, combat.drive.regenMode]).toEqual([
      3.75,
      enemyComboShared.DriveRegenMode.Engaged,
    ]);

    combat.drive.engagedRecoveryMult = 99;
    combat.drive.valueF = 0;
    step();
    expect(combat.drive.valueF).toBeCloseTo(2.065, 8); // 35/s × the one +18% generic cap
    combat.drive.engagedRecoveryMult = 1;

    player.ultPhase = enemyComboShared.UltimatePhase.Active;
    combat.drive.valueF = 0;
    step();
    expect([combat.drive.valueF, combat.drive.regenMode]).toEqual([
      1,
      enemyComboShared.DriveRegenMode.Floor,
    ]);
    player.ultPhase = enemyComboShared.UltimatePhase.Idle;

    h.room.setWeaponResourceRegenOverride(player.id, "paused");
    combat.drive.valueF = 0;
    step();
    expect([combat.drive.valueF, combat.drive.regenMode]).toEqual([
      0,
      enemyComboShared.DriveRegenMode.Paused,
    ]);
  });

  it("sustains baseline fists for 60 seconds without leaking engaged bonus through debt", () => {
    const h = makeRoom();
    h.join("drive-melee-baseline");
    h.state().mode = "training";
    const player = h.state().players.get("drive-melee-baseline");
    const combat = h.room.combat.get(player.id);
    player.weapon = FISTS_WEAPON;
    h.tick(1);
    combat.drive.valueF = 100;
    combat.drive.recoveryDebtF = 0;
    player.weaponResource.valueQ = 10_000;
    h.room.setWeaponResourceRegenOverride(player.id, "forceEngaged");

    const postAttackValues: number[] = [];
    let lastSeq = player.attackSeq;
    for (let tick = 0; tick < 1_200; tick++) {
      h.send(player.id, "attack", { aimX: 1, aimY: 0 });
      h.tick(1);
      if (player.attackSeq !== lastSeq) {
        postAttackValues.push(combat.drive.valueF);
        lastSeq = player.attackSeq;
      }
    }

    expect(postAttackValues.length).toBeGreaterThan(160);
    // The first accepted tick legitimately receives the already-cleared engaged credit. Once its debit
    // stamps recovery debt, every later accepted baseline beat is flat on the guaranteed floor.
    const plateau = postAttackValues[1]!;
    for (const value of postAttackValues.slice(2)) {
      expect(Math.abs(value - plateau)).toBeLessThanOrEqual(enemyComboShared.DRIVE_COST_QUANTUM);
    }
    expect(combat.drive.regenMode).toBe(enemyComboShared.DriveRegenMode.Floor);
    expect(combat.drive.recoveryDebtF).toBeGreaterThan(0);
  });

  it("routes every solo tap delivery through the one spend seam before its attack beat", () => {
    const cases = [
      [FISTS_WEAPON, enemyComboShared.CombatDelivery.Melee],
      ["twin-bowie-fangs", enemyComboShared.CombatDelivery.Melee],
      ["rusty-cleaver", enemyComboShared.CombatDelivery.Thrown],
      ["x-gun-revolver-cannon", enemyComboShared.CombatDelivery.Gun],
      ["x-staff-arcane-lance", enemyComboShared.CombatDelivery.Cast],
    ] as const;

    for (const [weaponId, delivery] of cases) {
      const h = makeRoom();
      h.join(`drive-seam-${weaponId}`);
      h.state().mode = "training";
      const player = h.state().players.values().next().value;
      player.weapon = weaponId;
      h.tick(1);
      const spend = vi.spyOn(h.room, "trySpendWeaponResource");
      h.send(player.id, "attack", { aimX: 1, aimY: 0 });
      h.tick(1);

      expect(player.attackSeq).toBe(1);
      expect(spend).toHaveBeenCalledTimes(1);
      expect(spend.mock.calls[0]?.[4]).toBe(delivery);
      expect(spend.mock.calls[0]?.[9]).toBe("tap");
      spend.mockRestore();
    }
  });

  it("keeps Drive and global debt outside the carousel identity ledger", () => {
    const h = makeRoom();
    h.join("drive-carousel");
    const player = h.state().players.get("drive-carousel");
    const combat = h.room.combat.get(player.id);
    player.weapon = "x-sword-bone";
    h.tick(1);
    h.send(player.id, "attack", { aimX: 1, aimY: 0 });
    h.tick(1);
    const value = combat.drive.valueF;
    const debt = combat.drive.recoveryDebtF;
    const firstWeapon = player.weapon;

    for (let i = 0; i < ACTION_MSGS_PER_TICK; i++) {
      h.send(player.id, "cycleWeapon", { dir: i % 2 === 0 ? 1 : -1 });
    }
    expect(player.weapon).toBe(firstWeapon);
    expect(combat.drive.valueF).toBe(value);
    expect(combat.drive.recoveryDebtF).toBe(debt);

    h.tick(1);
    expect(combat.drive.valueF).toBeCloseTo(value + 1, 8);
    expect(combat.drive.recoveryDebtF).toBeCloseTo(debt - 0.05, 8);
  });
});

// METAGAME WAVE 6 — append-only public prestige, clear eligibility, and receipt coverage.
describe("GameRoom — schema-31 public prestige ceremony", () => {
  it("publishes join prestige, requires and consumes one game-clear receipt, then refreshes the wire row", () => {
    const h = makeRoom();
    const messages: Array<{ type: string; payload: unknown }> = [];
    const client = {
      sessionId: "prestige-public",
      send: (type: string, payload: unknown) => messages.push({ type, payload }),
    };
    const supplied = enemyComboShared.createMetaAccountV4();
    supplied.prestige = 4;
    supplied.scrip = 777;
    supplied.weaponBank.stash.push(roomBankSingle(88, "rattler-sabre"));
    h.room.clients.push(client);
    h.room.onJoin(client, { metaAccount: supplied });
    const player = h.state().players.get(client.sessionId);
    const account = h.room.metaAccounts.get(client.sessionId) as import("@dd/shared").MetaAccountV4;
    expect([player.prestige, player.dualWield.prestige]).toEqual([4, 4]);

    h.send(client.sessionId, "prestigeReset", {
      requestId: "before-clear",
      expectedRevision: account.revision,
    });
    expect(account.prestige).toBe(4);
    expect(messages.some((message) => message.type === "prestigeReceipt")).toBe(false);

    h.room.enterTerminalOutcome("victory");
    messages.length = 0;
    h.tick(1);
    h.send(client.sessionId, "prestigeReset", {
      requestId: "earned-clear",
      expectedRevision: account.revision,
    });
    expect(account).toMatchObject({ prestige: 5, scrip: 777 });
    expect(account.weaponBank.stash).toEqual([]);
    expect([player.prestige, player.dualWield.prestige]).toEqual([5, 5]);
    expect(messages.find((message) => message.type === "prestigeReceipt")?.payload).toMatchObject({
      ok: true,
      prestige: 5,
      removedEntries: 1,
      removedPhysical: 1,
      scripPaid: 0,
      revision: account.revision,
    });
    expect(messages.at(-1)).toMatchObject({ type: "metaAccount", payload: account });

    messages.length = 0;
    h.tick(1);
    h.send(client.sessionId, "prestigeReset", {
      requestId: "same-clear-again",
      expectedRevision: account.revision,
    });
    expect(account.prestige).toBe(5);
    expect(messages.some((message) => message.type === "prestigeReceipt")).toBe(false);
  });

  it("keeps the compatibility row indexes stable through relics", () => {
    const tailSymbols = Object.getOwnPropertySymbols(enemyComboShared.DualWieldState);
    const metadata = (
      enemyComboShared.DualWieldState as unknown as Record<
        symbol,
        Record<number, { name: string; type: string }>
      >
    )[tailSymbols[0]!];
    if (!metadata) throw new Error("DualWieldState schema metadata is required");
    expect(Object.values(metadata).map(({ name }) => name)).toEqual([
      "retiredByte0",
      "retiredUint32",
      "retiredByte1",
      "retiredByte2",
      "gearUpper",
      "gearLower",
      "weaponResource",
      "prestige",
      "relics",
      "attackMoveMode",
      "fireInputHeld",
      "movementCorrectionSeq",
      "serverMotionEpoch",
      "serverMotionActive",
    ]);
    expect(metadata[0]).toMatchObject({ name: "retiredByte0", type: "uint8" });
    expect(metadata[1]).toMatchObject({ name: "retiredUint32", type: "uint32" });
    expect(metadata[2]).toMatchObject({ name: "retiredByte1", type: "uint8" });
    expect(metadata[3]).toMatchObject({ name: "retiredByte2", type: "uint8" });
    expect(metadata[7]).toMatchObject({ name: "prestige", type: "uint8" });
    expect(metadata[9]).toMatchObject({ name: "attackMoveMode", type: "uint8" });
    expect(metadata[10]).toMatchObject({ name: "fireInputHeld", type: "boolean" });
    expect(metadata[11]).toMatchObject({ name: "movementCorrectionSeq", type: "uint32" });
    expect(metadata[12]).toMatchObject({ name: "serverMotionEpoch", type: "uint32" });
    expect(metadata[13]).toMatchObject({ name: "serverMotionActive", type: "boolean" });
    expect(enemyComboShared.SCHEMA_VERSION).toBe(47);
  });
});

describe("GameRoom — Drive beam equivalence and seam", () => {
  it("spends 25 ignition plus exactly 25 net-three active ticks even under engaged recovery", () => {
    const { h, player, combat } = makeBeamRoom("drive-beam-equivalence");
    h.room.setWeaponResourceRegenOverride(player.id, "forceEngaged");
    const spend = vi.spyOn(h.room, "trySpendWeaponResource");
    const chargeTicks = Math.round(BEAM_CHARGE_SECONDS / 0.05);
    for (let seq = 1; seq <= chargeTicks; seq++) sendBeamFrame(h, player.id, seq, true);

    expect(combat.beamPhase).toBe(2);
    expect(combat.drive.valueF).toBeCloseTo(72, 8);
    expect(player.weaponResource.valueQ).toBe(7200);
    for (let i = 1; i < 24; i++) {
      sendBeamFrame(h, player.id, chargeTicks + i, true);
    }
    expect(combat.beamPhase).toBe(2);
    expect(combat.drive.valueF).toBeCloseTo(3, 8);
    expect(player.weaponResource.valueQ).toBe(300);
    sendBeamFrame(h, player.id, chargeTicks + 24, true);
    expect(combat.beamPhase).toBe(0);
    expect(combat.drive.valueF).toBe(0);

    const reasons = spend.mock.calls.map((call) => call[9]);
    expect(reasons.filter((reason) => reason === "beam-ignite")).toHaveLength(1);
    expect(reasons.filter((reason) => reason === "beam-active")).toHaveLength(25);
    expect(combat.drive.recoveryDebtF).toBeCloseTo(3.4, 8);
    spend.mockRestore();
  });

  it("bills pre-ignition cancel once and never invents an empty lock", () => {
    const { h, player, combat } = makeBeamRoom("drive-beam-cancel");
    const spend = vi.spyOn(h.room, "trySpendWeaponResource");
    sendBeamFrame(h, player.id, 1, true);
    sendBeamFrame(h, player.id, 2, false);

    expect(combat.beamPhase).toBe(0);
    expect(combat.drive.valueF).toBeCloseTo(81, 8); // first full-bar credit caps; release tick adds one
    expect(combat.drive.beamLockEndTick).toBe(0);
    expect(spend.mock.calls.map((call) => call[9])).toEqual(["beam-cancel"]);
    spend.mockRestore();
  });

  it("maps Pressurized's approved vent and half-lock to its old 45-tick restart row", () => {
    const { h, player, combat } = makeBeamRoom("drive-beam-pressurized");
    combat.mods = {
      ...combat.mods,
      beamVentMult: 1.25,
      beamOverheatLockMult: 0.5,
    };
    const chargeTicks = Math.round(BEAM_CHARGE_SECONDS / 0.05);
    for (let seq = 1; seq < chargeTicks; seq++) sendBeamFrame(h, player.id, seq, true);
    for (let i = 0; i < 25; i++) sendBeamFrame(h, player.id, chargeTicks + i, true);

    expect(combat.drive.valueF).toBe(0);
    expect(combat.drive.beamLockEndTick - h.state().tick).toBe(15);
    let seq = chargeTicks + 25;
    let recoveryTicks = 0;
    while (combat.drive.valueF + 1e-9 < BEAM_RESTART_DRIVE) {
      sendBeamFrame(h, player.id, seq++, false);
      recoveryTicks++;
    }
    expect(recoveryTicks).toBe(45); // old: 15 lock + ceil(0.65 / (0.35 × 1.25) × 20) = 30
    sendBeamFrame(h, player.id, seq, true);
    expect(combat.beamPhase).toBe(1);
  });

  it("makes beam empty global: baseline fists can resume but cannot rebuild the 68-point reactor", () => {
    const { h, player, combat } = makeBeamRoom("drive-beam-global-empty");
    const chargeTicks = Math.round(BEAM_CHARGE_SECONDS / 0.05);
    for (let seq = 1; seq < chargeTicks; seq++) sendBeamFrame(h, player.id, seq, true);
    for (let i = 0; i < 25; i++) sendBeamFrame(h, player.id, chargeTicks + i, true);
    expect(combat.drive.valueF).toBe(0);

    sendBeamFrame(h, player.id, chargeTicks + 25, false); // required release edge
    player.weapon = FISTS_WEAPON;
    h.tick(1);
    const beforeFists = player.attackSeq;
    for (let tick = 0; tick < 100; tick++) {
      h.send(player.id, "attack", { aimX: 1, aimY: 0 });
      h.tick(1);
    }

    expect(player.attackSeq).toBeGreaterThan(beforeFists);
    expect(combat.drive.valueF).toBeLessThan(7);
    expect(combat.drive.valueF).toBeLessThan(BEAM_RESTART_DRIVE);
  });
});

describe("GameRoom — bank §2.3 stale-expedition abandonment at join", () => {
  // The account blob lives in localStorage while settlement lives in room memory: kill the client
  // mid-run and the next join arrives with the old expedition still open. The law (bank-systems
  // §2.3, no reservation machinery) settles it as DEFEAT before the new carry — the stake is lost,
  // the bank un-bricks, and the fresh carry commits at the revision the client actually built
  // against (the abandonment settlement must not advance it).
  it("settles an open expedition as defeat, then commits the new carry at the client's revision", () => {
    const h = makeRoom({ belt: true });
    const doomed = roomBankSingle(41, "rattler-sabre");
    const kept = roomBankSingle(42);
    const messages: Array<{ type: string; payload: unknown }> = [];
    const client = {
      sessionId: "bank-stale-expedition",
      send: (type: string, payload: unknown) => messages.push({ type, payload }),
    };
    const account = enemyComboShared.createMetaAccountV4();
    account.weaponBank.stash.push(kept);
    account.weaponBank.expedition = {
      runId: "run_dead-room",
      commitRevision: account.revision,
      status: "committed",
      entries: [{ entry: doomed, stakeOrigin: "committed", location: "active", start: 0 }],
    };
    h.room.clients.push(client);
    h.room.onJoin(client, {
      metaAccount: account,
      carry: {
        requestId: "carry-after-abandon",
        expectedRevision: account.revision,
        placements: [{ entryId: kept.entryId, zone: "active", start: 0 }],
        activeEntryId: kept.entryId,
        requestedWorldTier: 0,
      },
    });
    const joined = h.room.metaAccounts.get(
      "bank-stale-expedition",
    ) as import("@dd/shared").MetaAccountV4;
    // The stale stake is gone forever — never banked, never carried forward.
    expect(joined.weaponBank.stash).toEqual([]);
    expect(joined.weaponBank.expedition?.entries.map((row) => row.entry.entryId)).toEqual([
      kept.entryId,
    ]);
    expect(joined.weaponBank.expedition?.runId).not.toBe("run_dead-room");
    // The player is in the room with the NEW carry materialized — the join was not rejected.
    expect(h.state().players.get("bank-stale-expedition")).toBeTruthy();
    // The honest ledger: the owner is told exactly what abandoning cost.
    const receipt = messages.find((m) => m.type === "expeditionAbandonReceipt");
    expect(receipt?.payload).toMatchObject({ ok: true, outcome: "defeat", lostEntries: 1 });
  });
});

// W4A — append-only archive migration and Testing-Grounds exclusion coverage.
describe("GameRoom — W4A archived weapon retirement", () => {
  it("auto-salvages archived single entries across every bank location", () => {
    const h = makeRoom({ belt: true });
    const archivedLead = roomBankInstance(91, "x2-mistral-kusarigama", "rare", "keen");
    const survivingOffhand = roomBankInstance(92, "rattler-sabre", "rare", "swift");
    const archivedEntry: import("@dd/shared").SingleWeaponEntryV1 = {
      kind: "single",
      entryId: archivedLead.instanceId,
      weapon: archivedLead,
    };
    const survivingEntry: import("@dd/shared").SingleWeaponEntryV1 = {
      kind: "single",
      entryId: survivingOffhand.instanceId,
      weapon: survivingOffhand,
    };
    const intakeWeapon = roomBankInstance(93, "x2-ferrous-serpent", "legendary", "brutal");
    const intake: import("@dd/shared").SingleWeaponEntryV1 = {
      kind: "single",
      entryId: intakeWeapon.instanceId,
      weapon: intakeWeapon,
    };
    const expeditionWeapon = roomBankInstance(94, "x2-locust-flail");
    const expeditionEntry: import("@dd/shared").SingleWeaponEntryV1 = {
      kind: "single",
      entryId: expeditionWeapon.instanceId,
      weapon: expeditionWeapon,
    };
    const account = enemyComboShared.createMetaAccountV4();
    account.scrip = 7;
    account.weaponBank.stash.push(archivedEntry, survivingEntry);
    account.weaponBank.intake.push(intake);
    account.weaponBank.lastCarry = {
      placements: [{ entryId: survivingEntry.entryId, zone: "active", start: 0 }],
      activeEntryId: survivingEntry.entryId,
    };
    account.weaponBank.expedition = {
      runId: "run_archive-old",
      commitRevision: account.revision,
      status: "committed",
      entries: [{ entry: expeditionEntry, stakeOrigin: "found", location: "field", start: 255 }],
    };
    const messages: Array<{ type: string; payload: unknown }> = [];
    const client = {
      sessionId: "archive-join",
      send: (type: string, payload: unknown) => messages.push({ type, payload }),
    };
    h.room.clients.push(client);
    h.room.onJoin(client, {
      metaAccount: account,
      carry: {
        requestId: "carry-after-archive",
        expectedRevision: account.revision,
        placements: [{ entryId: survivingEntry.entryId, zone: "active", start: 0 }],
        activeEntryId: survivingEntry.entryId,
        requestedWorldTier: 0,
      },
    });

    const joined = h.room.metaAccounts.get("archive-join") as import("@dd/shared").MetaAccountV4;
    const expectedPayout =
      weaponDisassemblyValue(archivedLead.weaponId) +
      weaponDisassemblyValue(intakeWeapon.weaponId) +
      weaponDisassemblyValue(expeditionWeapon.weaponId);
    expect(joined.scrip).toBe(7 + expectedPayout);
    expect(joined.weaponBank.stash).toEqual([]);
    expect(joined.weaponBank.intake).toEqual([]);
    expect(joined.weaponBank.expedition?.entries).toHaveLength(1);
    expect(joined.weaponBank.expedition?.entries[0]?.entry).toEqual({
      kind: "single",
      entryId: survivingOffhand.instanceId,
      weapon: survivingOffhand,
    });
    expect(joined.weaponBank.lastCarry).toEqual({
      placements: [{ entryId: survivingOffhand.instanceId, zone: "active", start: 0 }],
      activeEntryId: survivingOffhand.instanceId,
    });
    expect(h.state().players.get("archive-join")?.weapon).toBe("rattler-sabre");
    expect(
      messages.find((message) => message.type === "weaponArchiveSalvageReceipt")?.payload,
    ).toMatchObject({
      payout: expectedPayout,
      salvagedInstances: 3,
      affectedEntries: 3,
    });
  });

  it("omits archived ids from every Testing-Grounds page and rejects direct dev-equip", () => {
    const h = makeRoom();
    h.join("archive-gallery");
    h.send("archive-gallery", "toggleTraining");
    const roster = h.room.constructor.GALLERY_ROSTER as string[];
    // The catalog additions add twenty-one active rows to every Testing Grounds page.
    expect(roster).toHaveLength(360);
    for (const id of enemyComboShared.ARCHIVED_WEAPON_IDS) expect(roster).not.toContain(id);
    const before = h.state().players.get("archive-gallery").weapon;
    h.send("archive-gallery", "devEquip", { weapon: "x2-mistral-kusarigama" });
    expect(h.state().players.get("archive-gallery").weapon).toBe(before);
  });
});
