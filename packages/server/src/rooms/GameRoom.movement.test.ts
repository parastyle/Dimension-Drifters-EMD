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
  PLAYER_GROUND_CONTACT_OFFSET_Y,
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


describe("GameRoom — §17 pitfall + terrain-death + §9 gun cadence", () => {
  // These run in TRAINING mode: it disables the arena spawn director (§21), so the only entities in play are
  // the ones the test plants — no random horde to chip the player or fall in our test pit. The pitfall /
  // pit-death / reload phases themselves run mode-agnostically, so the rules under test are unchanged.
  function training() {
    const h = makeRoom();
    h.join("p1");
    h.send("p1", "toggleTraining");
    return h;
  }
  // Force the tile under a world-px point to a pit (post-gen override — bypasses the cleared spawn disc).
  function forcePit(h: ReturnType<typeof makeRoom>, px: number, py: number, rad = 0) {
    const m = h.room.map;
    const tx = Math.floor(px / m.tileSize);
    const ty = Math.floor(py / m.tileSize);
    for (let dy = -rad; dy <= rad; dy++)
      for (let dx = -rad; dx <= rad; dx++) m.tiles[(ty + dy) * m.cols + (tx + dx)] = TILE_PIT;
  }

  it("a GROUNDED player over a pit falls: chip damage + snap-back to last ground + fellSeq", () => {
    const h = training();
    const p = h.state().players.get("p1");
    const sx = h.room.map.spawnX;
    const sy = h.room.map.spawnY;
    p.x = sx;
    p.y = sy;
    h.tick(1); // stand on cleared ground → records lastGround at (sx,sy)
    const fellBefore = p.fellSeq;
    // Open a pit 3 tiles south and step onto it, grounded.
    const pitY = sy + 3 * h.room.map.tileSize;
    forcePit(h, sx, pitY);
    p.x = sx;
    p.y = pitY;
    p.height = 0;
    h.room.combat.get("p1").pitGrace = 0;
    h.tick(1);
    expect(p.fellSeq).toBeGreaterThan(fellBefore); // the fall fired
    expect(isPitAtPx(h.room.map, p.x, p.y)).toBe(false); // snapped back onto solid ground
    expect(Math.round(p.x)).toBe(Math.round(sx)); // … specifically the last-ground spot
    expect(Math.round(p.y)).toBe(Math.round(sy));
    expect(p.hp).toBeCloseTo(PLAYER_MAX_HP * (1 - PIT_FALL_DAMAGE_FRAC), 0); // took the chip (± a regen tick)
  });

  it("triggers pit damage at the visible foot contact, not the torso/root centre", () => {
    const h = training();
    const p = h.state().players.get("p1");
    const map = h.room.map;
    const col = Math.floor(map.spawnX / map.tileSize);
    const groundRow = Math.floor(map.spawnY / map.tileSize);
    const boundaryY = groundRow * map.tileSize;
    map.tiles[(groundRow - 1) * map.cols + col] = TILE_PIT;
    map.tiles[groundRow * map.cols + col] = 0;
    p.x = (col + 0.5) * map.tileSize;
    p.y = (groundRow + 0.5) * map.tileSize;
    h.tick(1);

    const fellBefore = p.fellSeq;
    const hpBefore = p.hp;
    const visibleGroundRootY = boundaryY - PLAYER_GROUND_CONTACT_OFFSET_Y + 0.25;
    p.y = visibleGroundRootY;
    h.room.combat.get("p1").pitGrace = 0;
    h.tick(1);
    expect(p.fellSeq).toBe(fellBefore);
    expect(p.hp).toBe(hpBefore);

    p.y = boundaryY - PLAYER_GROUND_CONTACT_OFFSET_Y - 0.25;
    h.tick(1);
    expect(p.fellSeq).toBe((fellBefore + 1) & 0xff);
    expect(p.hp).toBeLessThan(hpBefore);
    // Recovery accepts the last root whose feet were visibly on ground, even though its torso is over void.
    expect(p.y).toBeCloseTo(visibleGroundRootY, 6);
  });

  it("an AIRBORNE player (mid-jump) clears the pit — no fall", () => {
    const h = training();
    const p = h.state().players.get("p1");
    const sx = h.room.map.spawnX;
    const sy = h.room.map.spawnY;
    const pitY = sy + 3 * h.room.map.tileSize;
    forcePit(h, sx, pitY);
    p.x = sx;
    p.y = pitY;
    p.height = 100; // mid-hop, well above GROUND_EPSILON
    const fellBefore = p.fellSeq;
    h.tick(1);
    expect(p.fellSeq).toBe(fellBefore); // the hop carried over the gap
    expect(p.hp).toBe(PLAYER_MAX_HP); // no chip
  });

  it("a non-boss enemy that ends a tick over a pit dies with no money reward", () => {
    const h = training();
    const p = h.state().players.get("p1");
    const sx = h.room.map.spawnX;
    const sy = h.room.map.spawnY;
    p.x = sx;
    p.y = sy;
    const moneyBefore = p.scrip;
    // A 3x3 pit block 3 tiles east; plant a critter dead-centre so one tick of chase can't walk it off.
    const pitX = sx + 3 * h.room.map.tileSize;
    forcePit(h, pitX, sy, 1);
    const e = new EnemyState();
    e.id = "doomed";
    e.kind = "critter";
    e.hp = 999;
    e.x = pitX;
    e.y = sy;
    h.state().enemies.set("doomed", e);
    h.tick(1);
    expect(h.state().enemies.has("doomed")).toBe(false); // fell in → despawned
    expect(p.scrip).toBe(moneyBefore);
    expect(h.state().moneyDrops.size).toBe(0);
  });

  it("a gun fires past its authored magazine through Drive with reload fields retired", () => {
    const h = training();
    const p = h.state().players.get("p1");
    const gunId = "x-gun-coffin-shotgun";
    const gun = WEAPONS[gunId]?.gun;
    if (!gun) throw new Error("fixture weapon is not a gun");
    p.weapon = gunId;
    h.tick(1);
    expect([p.maxCharges, p.charges]).toEqual([0, 0]);
    const c = h.room.combat.get("p1");
    for (let i = 0; i < 240 && p.attackSeq < gun.magazine + 2; i++) {
      h.send("p1", "attack", { aimX: 1, aimY: 0 }); // hold the trigger: the attack buffer re-arms each tick
      h.tick(1);
    }
    expect(p.attackSeq).toBeGreaterThan(gun.magazine);
    expect([p.maxCharges, p.charges, c.reloadCd]).toEqual([0, 0, 0]);
    expect(c.drive.valueF).toBeLessThan(100);
  });

  it("§38 a CASTER weapon conjures a piercing arcane orb on a cooldown (no ammo)", () => {
    const h = training();
    const p = h.state().players.get("p1");
    const staffId = "x-staff-arcane-lance";
    const staff = WEAPONS[staffId];
    if (!staff?.cast) throw new Error("fixture weapon is not a caster");
    p.weapon = staffId;
    h.tick(1);
    let sawOrb = false;
    let orbEl = "";
    for (let i = 0; i < 60 && !sawOrb; i++) {
      h.send("p1", "attack", { aimX: 1, aimY: 0 }); // hold the cast trigger
      h.tick(1);
      h.state().projectiles.forEach((pr: { kind: string }) => {
        if (pr.kind.startsWith("orb")) {
          sawOrb = true;
          orbEl = pr.kind;
        }
      });
    }
    expect(sawOrb).toBe(true); // the cast delivery fired a projectile (not a melee swing)
    expect(orbEl).toBe("orb:arcane"); // element-tinted per the weapon
  });

  it("§41 the HAND MORTAR's shell explodes — AoE damages an enemy NEAR the impact, not just on the line", () => {
    const h = training();
    const p = h.state().players.get("p1");
    p.weapon = "x-gun-hand-mortar";
    h.tick(1);
    const dummy = [...h.state().enemies.values()].find((e: { kind: string }) => e.kind === "dummy");
    if (!dummy) throw new Error("no training dummy");
    const hp0 = dummy.hp;
    // Fire from far enough that the shell EXPIRES level with the dummy (muzzle reach ~90 + range 560),
    // offset 90px to the side — a plain bullet on that line never touches it, but the 130px blast where
    // the shell dies must catch it.
    // Pin both bodies to fixed solid-ground coordinates so the blast path is deterministic.
    h.room.map.tiles.fill(TILE_GROUND); // pits are RNG too — the pinned spots must be solid
    dummy.x = 2400;
    dummy.y = 2400;
    p.x = dummy.x - 650;
    p.y = dummy.y + 90;
    h.send("p1", "attack", { aimX: 1, aimY: 0, tx: p.x + 600, ty: p.y });
    // The dummy REGENERATES, so assert the blast by catching the hp DIP tick-by-tick (a single check after
    // the full flight would see it healed back).
    let dipped = false;
    for (let i = 0; i < 44 && !dipped; i++) {
      h.tick(1);
      if (dummy.hp < hp0) dipped = true;
    }
    expect(dipped).toBe(true);
  });

  it("§43 the HAILSHOT HAND-MAUL's recovered direct cannonball fires without an explosion", () => {
    // This weapon shipped as a default 6-damage slug for months because its authored gun lived beside
    // behavior. V3R keeps the recovered kit but moves the old blast payload into the direct cannonball.
    const h = training();
    const p = h.state().players.get("p1");
    p.weapon = "x2-hailshot-hand-maul";
    h.tick(1);
    const dummy = [...h.state().enemies.values()].find((e: { kind: string }) => e.kind === "dummy");
    if (!dummy) throw new Error("no training dummy");
    const hp0 = dummy.hp;
    // Pin the dummy on the direct line: the owner order explicitly removes the old off-line blast.
    h.room.map.tiles.fill(TILE_GROUND);
    dummy.x = 2400;
    dummy.y = 2400;
    p.x = dummy.x - 300;
    p.y = dummy.y;
    h.send("p1", "attack", { aimX: 1, aimY: 0, tx: dummy.x, ty: dummy.y });
    let dipped = false;
    for (let i = 0; i < 44 && !dipped; i++) {
      h.tick(1);
      if (dummy.hp < hp0) dipped = true;
    }
    expect(dipped).toBe(true);
  });

  it("§40.3 the WHIRLWIND's full-circle sweep hits an enemy BEHIND the aim", () => {
    const h = training();
    const p = h.state().players.get("p1");
    p.weapon = "x-sword-whirlwind";
    h.tick(1);
    const dummy = [...h.state().enemies.values()].find((e: { kind: string }) => e.kind === "dummy");
    if (!dummy) throw new Error("no training dummy");
    // Stand just RIGHT of the dummy and aim FURTHER RIGHT — the dummy sits directly BEHIND the aim.
    p.x = dummy.x + 100;
    p.y = dummy.y;
    const hp0 = dummy.hp;
    h.send("p1", "attack", { aimX: 1, aimY: 0, tx: p.x + 400, ty: p.y });
    h.tick(16); // the 4π swept edge crosses the full circle over the swing's active window
    expect(dummy.hp).toBeLessThan(hp0); // a flat-arc weapon aimed away could never hit this
  });

  it("§40.2 a QUAKE detonates when the chop's blade LANDS, not at click (shared delay)", () => {
    const h = training();
    const p = h.state().players.get("p1");
    p.weapon = "tombstone-greatsword";
    h.tick(1);
    // Park a dummy-adjacent target: use the training dummy itself (it sits in the Testing Grounds).
    const dummy = [...h.state().enemies.values()].find((e: { kind: string }) => e.kind === "dummy");
    if (!dummy) throw new Error("no training dummy");
    const hp0 = dummy.hp;
    // Swing AT the dummy (cursor point on it, within QUAKE_REACH of the player — move the player next to it).
    p.x = dummy.x - 100;
    p.y = dummy.y;
    h.send("p1", "attack", { aimX: 1, aimY: 0, tx: dummy.x, ty: dummy.y });
    h.tick(1); // the swing resolves THIS tick — pre-§40.2 the quake damaged here
    expect(dummy.hp).toBe(hp0); // blade still in the air → no damage yet
    // delay = cooldown 0.78 × SWING_WINDOW_FRAC 0.64 × CHOP_IMPACT_FRAC 0.52 ≈ 0.26s ≈ 5.2 ticks @50ms
    h.tick(7);
    expect(dummy.hp).toBeLessThan(hp0); // the blade landed → the quake erupted
  });

  it("§37 a shot flies at the CURSOR POINT (tx/ty), not the client's aim vector", () => {
    const h = training();
    const p = h.state().players.get("p1");
    p.weapon = "x-gun-revolver-cannon";
    h.tick(1);
    const px = p.x; // wherever the player actually is after equip
    const py = p.y;
    // The aim VECTOR says "straight right" (aimX=1); the cursor POINT is straight UP from the real player.
    // The §37 fix makes the bullet follow the POINT (flies up) — before the fix it followed the vector (right).
    const tx = px;
    const ty = py - 400;
    let vx = 0;
    let vy = 0;
    let got = false;
    for (let i = 0; i < 30 && !got; i++) {
      h.send("p1", "attack", { aimX: 1, aimY: 0, tx, ty });
      h.tick(1);
      h.state().projectiles.forEach((pr: { kind: string; vx: number; vy: number }) => {
        if (pr.kind.startsWith("slug")) {
          vx = pr.vx;
          vy = pr.vy;
          got = true;
        }
      });
    }
    expect(got).toBe(true);
    expect(vy).toBeLessThan(0); // flew UP toward the cursor point
    expect(Math.abs(vx)).toBeLessThan(Math.abs(vy) * 0.2); // mostly vertical — NOT the rightward aim vector
  });
});

describe("GameRoom — §4 v0.107 seq'd input protocol (queue / ack / fixed timestep / hostile payloads)", () => {
  it("consumes one command per tick and mirrors ackSeq + mvx/mvy on synced state", () => {
    const h = makeRoom();
    h.join("p1");
    const p = h.state().players.get("p1");
    h.send("p1", "input", { seq: 1, dx: 1, dy: 0 });
    h.tick(1);
    expect(p.ackSeq).toBe(1); // consumed + acked
    expect(p.mvx).toBeGreaterThan(0); // steering velocity mirrored for the predicting client
    const mv1 = p.mvx;
    h.tick(1); // queue starved → held fallback keeps the same speed (ack unchanged)
    expect(p.ackSeq).toBe(1);
    expect(p.mvx).toBe(mv1);
  });

  it("drains a BURST straight to the newest command (no latency ratchet) and acks its seq", () => {
    const h = makeRoom();
    h.join("p1");
    const p = h.state().players.get("p1");
    // 3 commands in one tick window (within the per-tick message budget — the client's own burst clamp
    // sends at most ~3 after a stall): the tick must jump to the FRESHEST, not chew 1-per-tick.
    for (let s = 1; s <= 3; s++) h.send("p1", "input", { seq: s, dx: 1, dy: 0 });
    h.tick(1);
    expect(p.ackSeq).toBe(3); // the freshest intent, not seq 1 with a +100ms backlog behind it
  });

  it("SURVIVES hostile input payloads (garbage seq/dx, replays, floods) without crashing or moving", () => {
    const h = makeRoom();
    h.join("p1");
    const p = h.state().players.get("p1");
    const x0 = p.x;
    // Garbage seq types + NaN dx — must not throw (a raw assignment into uint32 ackSeq would kill the
    // process) and must not move the player.
    h.send("p1", "input", { seq: "x", dx: "boom", dy: Number.NaN });
    h.send("p1", "input", { seq: Number.NaN, dx: 1, dy: 0 });
    h.send("p1", "input", { seq: -5, dx: 1, dy: 0 });
    h.tick(2);
    expect(p.ackSeq).toBe(0); // nothing legitimate consumed
    expect(Math.abs(p.x - x0)).toBeLessThan(0.001);
    // Replayed / regressed seqs are dropped (monotonicity).
    h.send("p1", "input", { seq: 10, dx: 1, dy: 0 });
    h.tick(1);
    expect(p.ackSeq).toBe(10);
    h.send("p1", "input", { seq: 10, dx: -1, dy: 0 }); // replay — dropped
    h.send("p1", "input", { seq: 9, dx: -1, dy: 0 }); // regression — dropped
    h.tick(1);
    expect(p.ackSeq).toBe(10); // still the original
    // Flood: hundreds of messages in one tick — budget caps acceptance, queue caps memory, no throw.
    for (let i = 0; i < 300; i++) h.send("p1", "input", { seq: 100 + i, dx: 0, dy: 1 });
    const rec = h.room.inputs.get("p1");
    expect(rec.queue.length).toBeLessThanOrEqual(8);
    h.tick(1);
    expect(p.ackSeq).toBeGreaterThan(10); // the freshest accepted command landed
  });

  it("survives the uint32 seq WRAP: 0xFFFFFFFF → 0 continues the stream (channel never bricks)", () => {
    const h = makeRoom();
    h.join("p1");
    const p = h.state().players.get("p1");
    const rec = h.room.inputs.get("p1");
    rec.lastSeq = 0xffffffff; // a marathon session at the counter's edge
    h.send("p1", "input", { seq: 0, dx: 1, dy: 0 }); // the wrapped next seq
    h.tick(1);
    expect(rec.lastSeq).toBe(0); // accepted — wrap-aware delta, not a plain <= compare
    expect(p.mvx).toBeGreaterThan(0); // and it actually steered
    h.send("p1", "input", { seq: 1, dx: 1, dy: 0 }); // stream continues normally past the wrap
    h.tick(1);
    expect(p.ackSeq).toBe(1);
  });

  it("a teleport bumps teleportSeq and drops queued/held intent (the client's hard-resync signal)", () => {
    const h = makeRoom();
    h.join("p1");
    const p = h.state().players.get("p1");
    const ts0 = p.teleportSeq;
    h.send("p1", "input", { seq: 1, dx: 1, dy: 0 });
    h.tick(1);
    expect(p.mvx).toBeGreaterThan(0);
    h.room.zeroMoveVel("p1"); // any teleport site (pit / rift / restart / training / revive)
    expect(p.teleportSeq).toBe(ts0 + 1);
    expect(p.mvx).toBe(0);
    h.tick(1); // the held direction was dropped too — no stale-intent glide after the teleport
    expect(p.mvx).toBe(0);
  });

  it("FIXED TIMESTEP: a 150ms stall integrates as three exact 50ms sub-steps (catch-up, not dt-stretch)", () => {
    const h = makeRoom();
    h.join("p1");
    const p = h.state().players.get("p1");
    const t0 = h.state().tick;
    const e0 = h.state().elapsed;
    h.room.update(150); // one laggy invocation
    expect(h.state().tick).toBe(t0 + 3); // 3 whole sub-steps ran
    expect(h.state().elapsed).toBeCloseTo(e0 + 0.15, 5);
    // And two 25ms invocations accumulate into exactly one sub-step (no drift, no double-step).
    const t1 = h.state().tick;
    h.room.update(25);
    expect(h.state().tick).toBe(t1); // not enough accumulated yet
    h.room.update(25);
    expect(h.state().tick).toBe(t1 + 1);
    void p;
  });
});

describe("GameRoom — §7 v0.105 de-clunk input buffering (attack / parry / jump)", () => {
  // The bug: a press that lands one tick BEFORE the server cooldown clears used to be silently EATEN —
  // the client had already played the whole swing/brace/hop, so the input felt dropped. These pin the fix:
  // a press is queued for a short window and fires the instant the cooldown drains, WITHOUT re-sending.
  function armedFister() {
    const h = makeRoom();
    h.join("p1");
    const p = h.state().players.get("p1");
    p.weapon = FISTS_WEAPON; // a plain melee weapon (no ammo/charges), cooldown 0.32s
    h.tick(1); // let the weapon (re)initialise so it doesn't reset cd on the tick under test
    return { h, p, c: h.room.combat.get("p1") };
  }

  it("BUFFERS an attack that arrives a tick early and fires it when the cooldown drains", () => {
    const { h, c } = armedFister();
    const fists = WEAPONS[FISTS_WEAPON];
    if (!fists) throw new Error("fists weapon missing from the arsenal");
    const fistsCd = fists.cooldown;
    c.cd = 0.08; // just over one tick out — the message arrives while still on cooldown
    h.send("p1", "attack", { aimX: 1, aimY: 0 });
    expect(c.attackBuffer).toBeGreaterThan(0); // queued, not consumed yet (cd still > 0)
    h.tick(2); // drain the cd over two ticks — NO re-send
    expect(c.cd).toBeCloseTo(fistsCd, 5); // the buffered swing fired → cooldown re-armed to the weapon's
    expect(c.attackBuffer).toBe(0); // and the buffer was consumed
  });

  it("DROPS a buffered attack on a weapon SWAP (no free cooldown-bypassing hit on the new weapon)", () => {
    const { h, c } = armedFister();
    c.cd = 0.5; // the OLD (slow) weapon is mid-cooldown
    h.send("p1", "attack", { aimX: 1, aimY: 0 }); // queue a press for the OLD weapon
    expect(c.attackBuffer).toBeGreaterThan(0);
    h.send("p1", "cycleWeapon", { dir: 1 }); // swap within the buffer window (the swap zeroes cd)
    h.tick(1);
    expect(c.attackBuffer).toBe(0); // the stale buffer was dropped on the swap...
    expect(c.cd).toBeLessThanOrEqual(0); // ...so the new weapon did NOT auto-fire (cd never re-armed)
  });

  it("does NOT fire a STALE attack once the buffer window lapses (no phantom swing after release)", () => {
    const { h, c } = armedFister();
    c.cd = 0.5; // far out — well past the ~0.15s buffer window
    h.send("p1", "attack", { aimX: 1, aimY: 0 }); // a single press, never re-sent
    h.tick(12); // 0.6s: buffer expires (~0.15s) long before the cd (0.5s) drains
    expect(c.attackBuffer).toBe(0); // decayed away
    expect(c.cd).toBeLessThanOrEqual(0); // cd drained and STAYED drained — the stale press never fired
  });

  it("BUFFERS a parry pressed during its cooldown and fires it when the cd clears (chain-parry desync fix)", () => {
    const h = makeRoom();
    h.join("p1");
    const c = h.room.combat.get("p1");
    c.parryCd = 0.08; // a chain press lands while the parry is still cooling down
    h.send("p1", "parry");
    expect(c.parryBuffer).toBeGreaterThan(0); // queued (not dropped)
    h.tick(2); // drain the parry cd — NO re-send
    expect(c.invuln).toBeGreaterThan(PARRY_IFRAMES - 0.11); // the buffered parry fired → i-frames granted
    expect(c.parryBuffer).toBe(0);
  });

  it("BUFFERS a jump pressed on cooldown and hops the instant the player is grounded + ready", () => {
    const h = makeRoom();
    h.join("p1");
    const c = h.room.combat.get("p1");
    const p = h.state().players.get("p1");
    c.jumpCd = 0.08; // pressed during the post-landing dead window
    p.height = 0; // grounded
    h.send("p1", "jump");
    expect(c.jumpBuffer).toBeGreaterThan(0); // queued
    h.tick(2); // drain the jump cd — NO re-send
    expect(p.height).toBeGreaterThan(0); // lifted off → the buffered hop fired
    expect(c.jumpBuffer).toBe(0);
  });
});

describe("GameRoom — §6 dimension chain (v0.103: extract-vs-descend, bank-or-lose, depth scaling)", () => {
  // Open both gates ON the clear spawn disc so a planted player can deterministically step into either.
  function openGatesAtSpawn(h: ReturnType<typeof makeRoom>) {
    const st = h.state();
    st.portalOpen = true;
    st.portalX = h.room.map.spawnX;
    st.portalY = h.room.map.spawnY;
    st.riftOpen = true;
    st.riftX = h.room.map.spawnX;
    st.riftY = h.room.map.spawnY;
  }

  it("killing the boss opens BOTH gates: the extract portal AND the deeper rift", () => {
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
    expect(h.state().riftOpen).toBe(true); // the greed decision has two doors
    expect(h.state().riftX).not.toBe(0); // rift placed somewhere real
  });

  it("a rift descent: depth+1, NEW dimension + seeds, field cleared, squad carried, run still active", () => {
    const h = makeRoom({ dimensionId: "wild-west" });
    h.join("p1");
    const p = h.state().players.get("p1");
    p.scrip = 5;
    p.weapon = "gravediggers-spade";
    p.hp = 61;
    const e = new EnemyState(); // some horde that must NOT follow through the rift
    e.id = "left-behind";
    e.kind = "critter";
    e.hp = 99;
    e.x = h.room.map.spawnX + 2000; // far away — can't reach + shove the channeler mid-hold
    e.y = h.room.map.spawnY;
    h.state().enemies.set("left-behind", e);
    const seedBefore = h.state().seedTerrain;
    // HOLD the rift — it's a channel (RIFT_CHANNEL_SECONDS), not a tripwire.
    p.x = h.room.map.spawnX;
    p.y = h.room.map.spawnY;
    openGatesAtSpawn(h);
    h.state().portalOpen = false; // isolate the rift path (both gates share the spawn point here)
    h.tick(10); // ~0.5s — mid-channel: charged but NOT committed
    expect(h.state().depth).toBe(1);
    expect(h.state().riftCharge).toBeGreaterThan(0);
    h.tick(30); // past the 1.6s channel → the squad commits
    const st = h.state();
    expect(st.depth).toBe(2);
    expect(st.dimensionId).not.toBe("wild-west"); // moved to a FRESH dimension
    expect(st.seedTerrain).not.toBe(seedBefore); // new map minted
    expect(st.enemies.size).toBe(0); // the old horde stayed behind
    expect(st.outcome).toBe("active"); // the run continues
    expect(st.portalOpen).toBe(false);
    expect(st.riftOpen).toBe(false);
    // The squad carried through intact — arsenal, run money, and chip damage survive.
    expect(p.scrip).toBe(5);
    expect(p.weapon).toBe("gravediggers-spade");
    expect(p.hp).toBeGreaterThanOrEqual(61); // chip damage carried (+ ~2s of always-on regen while channeling)…
    expect(p.hp).toBeLessThan(80); // …NOT healed back to full by the descent
    // Repositioned onto the NEW map's clear spawn disc.
    const d = Math.hypot(p.x - h.room.map.spawnX, p.y - h.room.map.spawnY);
    expect(d).toBeLessThanOrEqual(150);
  });

  it("extraction banks 100% of run money into the persistent meta account", () => {
    const h = makeRoom();
    h.join("p1");
    const p = h.state().players.get("p1");
    p.scrip = 7;
    p.x = h.room.map.spawnX;
    p.y = h.room.map.spawnY;
    openGatesAtSpawn(h);
    h.state().riftOpen = false;
    h.tick(1);
    expect(h.state().outcome).toBe("victory");
    expect(h.room.metaAccounts.get("p1").scrip).toBe(7);
    expect(p.scrip).toBe(0);
  });

  it("a wipe also banks 100% of run money", () => {
    const h = makeRoom();
    h.join("p1");
    const p = h.state().players.get("p1");
    h.room.metaAccounts.get("p1").scrip = 12;
    p.scrip = 9;
    p.hp = 0;
    h.tick(1);
    expect(h.state().outcome).toBe("defeat");
    expect(p.scrip).toBe(0);
    expect(h.room.metaAccounts.get("p1").scrip).toBe(21);
  });

  it("stepping OUT of the rift drains the channel — no accidental commit", () => {
    const h = makeRoom();
    h.join("p1");
    const p = h.state().players.get("p1");
    p.x = h.room.map.spawnX;
    p.y = h.room.map.spawnY;
    openGatesAtSpawn(h);
    h.state().portalOpen = false;
    h.tick(10); // build some charge…
    expect(h.state().riftCharge).toBeGreaterThan(0);
    // …then step OUT — beyond the 90px rift ring but INSIDE the 240px guaranteed-clear spawn disc
    // (any further and a random pit could snap the player straight back into the rift → flaky).
    p.x = h.room.map.spawnX + 150;
    h.tick(30);
    expect(h.state().depth).toBe(1); // never committed
    expect(h.state().riftCharge).toBe(0); // charge drained
  });

  it("floor disassembly requires an exact server-timed hold and pays the damage-budget curve", () => {
    const h = makeRoom();
    h.join("p1");
    const p = h.state().players.get("p1");
    p.x = h.room.map.spawnX;
    p.y = h.room.map.spawnY;
    const pk = new PickupState();
    pk.id = "drop900";
    pk.weapon = "gravediggers-spade";
    pk.weaponPublic = pk.weapon;
    pk.x = p.x;
    pk.y = p.y;
    pk.disassemblable = true;
    h.state().pickups.set(pk.id, pk);
    h.room.earnedPickups.add(pk.id);
    h.send("p1", "beginDisassembleFloor", { pickupId: pk.id });
    h.send("p1", "disassembleFloorWeapon", { pickupId: pk.id });
    expect(p.scrip).toBe(0);
    expect(h.state().pickups.has(pk.id)).toBe(true);
    h.tick(DISASSEMBLY_HOLD_TICKS - 1);
    h.send("p1", "disassembleFloorWeapon", { pickupId: pk.id });
    expect(p.scrip).toBe(0);
    h.tick(1);
    h.send("p1", "disassembleFloorWeapon", { pickupId: pk.id });
    expect(p.scrip).toBe(weaponDisassemblyValue(pk.weapon));
    expect(h.state().pickups.has(pk.id)).toBe(false);
  });

  it("deeper spawns are spongier: a depth-3 spawn carries more HP than depth-1", () => {
    const h = makeRoom();
    h.join("p1");
    // Compare the same kind's spawn HP at depth 1 vs 3 via the live spawn path.
    const hpAt = (depth: number) => {
      h.state().depth = depth;
      h.state().enemies.clear();
      // Spawn many so at least one lands regardless of tough rolls; take a non-tough one's hp.
      for (let i = 0; i < 12; i++)
        h.room.spawnEnemy([{ x: h.room.map.spawnX, y: h.room.map.spawnY }]);
      let hp = 0;
      h.state().enemies.forEach((e: EnemyState) => {
        if (!e.tough && e.kind === "critter") hp = Math.max(hp, e.hp);
      });
      return hp;
    };
    const shallow = hpAt(1);
    const deep = hpAt(3);
    if (shallow > 0 && deep > 0) expect(deep).toBeGreaterThan(shallow); // ×1.5 at depth 3
  });
});
