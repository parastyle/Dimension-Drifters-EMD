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


// HIT-REGISTRATION PANEL regressions - append-only authority coverage for the two field reports.
describe("GameRoom - hit registration regressions", () => {
  function addProjectileTarget(
    h: ReturnType<typeof makeRoom>,
    id: string,
    kind: string,
    x: number,
    y: number,
  ) {
    const enemy = new EnemyState();
    enemy.id = id;
    enemy.kind = kind;
    enemy.hp = 100_000;
    enemy.x = x;
    enemy.y = y;
    h.state().enemies.set(id, enemy);
    h.room.rebuildEnemyGrid();
    return enemy;
  }

  it("registers a belt melee edge-of-arc hit at the maximum rendered weapon reach", () => {
    const h = makeRoom({ belt: true });
    h.join("edge-melee");
    const player = h.state().players.get("edge-melee");
    const weapon = WEAPONS["x2-stormpetal-odachi"];
    if (!weapon) throw new Error("Stormpetal Odachi fixture is required");
    player.weapon = weapon.id;
    h.tick(1); // settle the weapon swap
    player.x = 1_000;
    player.y = BELT_Y0 + DEPTH_MAX / 2;

    // SpriteRig's two-hand orbit carries the grip 76 * 0.30 = 22.8 px from the root before extending the
    // business end. Put the target's near edges on the visual blade capsule at maximum reach and exactly on
    // the player's authored 90 px belt tolerance: both painted/collider edges clip and therefore must hit.
    const renderedGripReach = 76 * 0.3;
    const renderedTip = Math.max(
      weapon.range,
      (1 - weapon.gripFrac) * weapon.displayLength + renderedGripReach,
    );
    const target = new EnemyState();
    target.id = "edge-melee-target";
    target.kind = "dummy";
    target.hp = 100_000;
    const targetRadius = ENEMY_KINDS[target.kind]?.radius ?? 24;
    target.x = player.x + renderedTip + targetRadius + enemyComboShared.MELEE_BLADE_HALFWIDTH;
    target.y = player.y + enemyComboShared.DEPTH_TOL_PLAYER + targetRadius;
    h.state().enemies.set(target.id, target);
    h.room.rebuildEnemyGrid();

    h.send(player.id, "attack", { aimX: 1, aimY: 0, tx: target.x, ty: target.y });
    h.tick(16);

    expect(target.hp).toBeLessThan(100_000);
  });

  it("deals full point-blank gun damage when a long muzzle starts inside a colossus collider", () => {
    const h = makeRoom();
    h.join("point-blank-gun");
    h.room.map.pois.length = 0;
    h.room.map.tiles.fill(TILE_GROUND);
    const player = h.state().players.get("point-blank-gun");
    const weapon = WEAPONS["x2-sunbreaker-railgun"];
    if (!weapon?.gun) throw new Error("Sunbreaker Railgun fixture is required");
    player.weapon = weapon.id;
    h.tick(1);

    const bossX = 2_000;
    const bossY = 2_000;
    const boss = addProjectileTarget(
      h,
      "point-blank-colossus",
      "dimensional-colossus",
      bossX,
      bossY,
    );
    // Muzzle reach is 210 px. From x = boss - 40 it spawns at boss + 170: inside the colossus/projectile
    // overlap (170 + 10), then its 1,400 px/s first step exits to boss + 240.
    player.x = bossX - 40;
    player.y = bossY;
    const combat = h.room.combat.get(player.id);
    combat.aimX = 1;
    combat.aimY = 0;
    combat.targetX = bossX + 500;
    combat.targetY = bossY;
    h.room.fireGun(player, combat, weapon);
    const projectiles = [...h.state().projectiles.values()];
    if (!projectiles.length) throw new Error("point-blank gun did not create a projectile");
    const expectedDamage = projectiles.reduce((sum, projectile) => {
      const projectileMeta = h.room.projectileMeta.get(projectile.id);
      if (projectileMeta) projectileMeta.crit = 0;
      return sum + (projectileMeta?.damage ?? 0);
    }, 0);
    if (!(expectedDamage > 0)) throw new Error("point-blank projectile needs positive damage");

    h.room.stepProjectiles(0.05);

    expect(boss.hp).toBeCloseTo(100_000 - expectedDamage, 8);
  });

  it("counts a friendly projectile that spawns inside a collider as a tick-one hit", () => {
    const h = makeRoom();
    h.join("spawn-inside");
    h.room.map.pois.length = 0;
    h.room.map.tiles.fill(TILE_GROUND);
    const boss = addProjectileTarget(h, "inside-colossus", "dimensional-colossus", 2_000, 2_000);
    const radius = ENEMY_KINDS[boss.kind]?.radius ?? 24;
    const damage = 37;
    h.room.fireProjectile(
      { x: boss.x + radius, y: boss.y },
      { x: boss.x + radius + 1, y: boss.y },
      1_400,
      damage,
      false,
      "slug",
      1,
      2,
    );

    h.room.stepProjectiles(0.05);

    expect(boss.hp).toBe(100_000 - damage);
  });

  it("keeps a from-range projectile as a full-damage control", () => {
    const h = makeRoom();
    h.join("range-control");
    h.room.map.pois.length = 0;
    h.room.map.tiles.fill(TILE_GROUND);
    const boss = addProjectileTarget(h, "range-colossus", "dimensional-colossus", 2_000, 2_000);
    const damage = 37;
    h.room.fireProjectile(
      { x: boss.x - 500, y: boss.y },
      { x: boss.x, y: boss.y },
      1_000,
      damage,
      false,
      "slug",
      1,
      2,
    );
    // Leave two collider-width samples beyond the nominal ten-step center crossing so this control does
    // not hinge on the final floating-point integration landing on exactly x = 2,000 under a full run.
    for (let tick = 0; tick < 12 && boss.hp === 100_000; tick++) h.room.stepProjectiles(0.05);

    expect(boss.hp).toBe(100_000 - damage);
  });

  it("registers spawn-inside contact against a live multi-segment worm collider", () => {
    const { h, runtime, root } = makeSerrakethRoom();
    h.room.map.pois.length = 0;
    h.room.map.tiles.fill(TILE_GROUND);
    h.room.rebuildEnemyGrid();
    const slot = 0;
    const damage = 31;
    const radius = runtime.segmentRadius(slot);
    const hp = root.hp;
    h.room.fireProjectile(
      { x: runtime.x[slot] + radius, y: runtime.y[slot] },
      { x: runtime.x[slot] + radius + 1, y: runtime.y[slot] },
      1_400,
      damage,
      false,
      "slug",
      1,
      2,
    );

    h.room.stepProjectiles(0.05);

    // Segment armor may reduce the authored damage, but range may not turn the contact into zero damage.
    expect(root.hp).toBeLessThan(hp);
  });
});

// Owner-ledger W-POSE authority coverage: append-only channel and shared spout-origin contracts.
describe("GameRoom — authored weapon performances", () => {
  it("releases Emberleaf tap/full charges as immutable server-scaled projectiles", () => {
    const releaseAfterTicks = (heldTicks: number) => {
      const h = makeRoom();
      h.join(`emberleaf-${heldTicks}`);
      const player = h.state().players.get(`emberleaf-${heldTicks}`);
      const combat = h.room.combat.get(player.id);
      const input = h.room.inputs.get(player.id);
      const weapon = WEAPONS["x2-emberleaf-chapbook"];
      if (!weapon?.chargedProjectile) throw new Error("Emberleaf charge fixture is required");
      player.weapon = weapon.id;
      combat.lastWeapon = weapon.id;
      combat.cd = 0;
      combat.drawLock = 0;
      combat.aimX = 1;
      combat.aimY = 0;
      combat.targetX = player.x + weapon.chargedProjectile.range;
      combat.targetY = player.y;

      input.held.fireHeld = true;
      input.lastFreshFireTick = h.state().tick;
      h.room.stepPlayerChargedProjectile(player, player.id, combat, weapon, true);
      expect(player.weaponChargeActive).toBe(true);
      expect(player.weaponChargeStartTick).toBe(h.state().tick);
      expect(h.state().projectiles.size).toBe(0);

      h.state().tick = (h.state().tick + heldTicks) >>> 0;
      input.held.fireHeld = false;
      h.room.stepPlayerChargedProjectile(player, player.id, combat, weapon, true);
      const projectile = [...h.state().projectiles.values()][0];
      if (!projectile) throw new Error("Emberleaf release did not create a projectile");
      const meta = h.room.projectileMeta.get(projectile.id);
      expect(player.weaponChargeActive).toBe(false);
      expect(projectile.kind).toBe("emberleaf-fireball");
      expect(projectile.sourceWeaponId).toBe(weapon.id);
      return { projectile, meta };
    };

    const tap = releaseAfterTicks(0);
    expect(tap.projectile.visualScale).toBe(0.55);
    expect(tap.projectile.explodeR).toBe(34);
    expect(tap.meta?.damage).toBeCloseTo(3, 10);
    expect(tap.meta?.explode?.damage).toBeCloseTo(2, 10);
    expect(tap.meta?.damageEnvelope).toEqual({
      shape: "capsule",
      radius: 28 * 0.55,
      halfLength: 0,
    });

    const full = releaseAfterTicks(24);
    expect(full.projectile.visualScale).toBe(1.5);
    expect(full.projectile.explodeR).toBe(100);
    expect(full.meta?.damage).toBeCloseTo(18, 10);
    expect(full.meta?.explode?.damage).toBeCloseTo(22, 10);
    expect(full.meta?.damageEnvelope).toEqual({
      shape: "capsule",
      radius: 28 * 1.5,
      halfLength: 0,
    });
  });

  it("does not manufacture an Emberleaf release from a stale held heartbeat", () => {
    const h = makeRoom();
    h.join("emberleaf-stale");
    const player = h.state().players.get("emberleaf-stale");
    const combat = h.room.combat.get(player.id);
    const input = h.room.inputs.get(player.id);
    const weapon = WEAPONS["x2-emberleaf-chapbook"];
    if (!weapon?.chargedProjectile) throw new Error("Emberleaf charge fixture is required");
    player.weapon = weapon.id;
    combat.lastWeapon = weapon.id;
    combat.cd = 0;
    combat.drawLock = 0;
    input.held.fireHeld = true;
    input.lastFreshFireTick = h.state().tick;

    h.room.stepPlayerChargedProjectile(player, player.id, combat, weapon, true);
    const startTick = player.weaponChargeStartTick;
    h.state().tick = (h.state().tick + 6) >>> 0;
    h.room.stepPlayerChargedProjectile(player, player.id, combat, weapon, true);

    expect(player.weaponChargeActive).toBe(true);
    expect(player.weaponChargeStartTick).toBe(startTick);
    expect(h.state().projectiles.size).toBe(0);

    input.held.fireHeld = false;
    h.room.stepPlayerChargedProjectile(player, player.id, combat, weapon, true);
    expect(player.weaponChargeActive).toBe(false);
    expect(h.state().projectiles.size).toBe(1);
  });

  it("drains Storm-Sphere Drive per second and stops damage at empty until release", async () => {
    const { CombatDelivery } = await import("@dd/shared");
    const h = makeRoom();
    h.join("storm-aura");
    const player = h.state().players.get("storm-aura");
    const combat = h.room.combat.get("storm-aura");
    const weapon = WEAPONS["x2-fulgurite-storm-sphere"];
    if (!weapon?.performance?.aura) throw new Error("Storm-Sphere aura fixture is required");
    player.weapon = weapon.id;
    combat.lastWeapon = weapon.id;
    h.room.setWeaponResourceRegenOverride(player.id, "paused");
    combat.drive.valueF = 1;
    player.weaponResource.valueQ = 100;
    const input = h.room.inputs.get(player.id);
    input.held.fireHeld = true;
    input.lastFreshFireTick = h.state().tick;
    const detonate = vi.spyOn(h.room, "detonate");

    h.room.beginWeaponResourceTick(player, combat, 0.05);
    h.room.stepPlayerAura(player, player.id, combat, weapon, 0.05, true);
    h.room.commitWeaponResourceTick(player, combat);

    expect(player.weaponResource.valueQ).toBe(0);
    expect(combat.auraActive).toBe(false);
    expect(combat.auraRequireRelease).toBe(true);
    expect(player.attackHeld).toBe(false);
    expect(detonate).toHaveBeenCalledTimes(1);
    expect(detonate.mock.calls[0]?.[7]).toBe(CombatDelivery.Aura);

    h.room.beginWeaponResourceTick(player, combat, 0.05);
    h.room.stepPlayerAura(player, player.id, combat, weapon, 0.05, true);
    h.room.commitWeaponResourceTick(player, combat);
    expect(player.weaponResource.valueQ).toBe(0);
    expect(detonate).toHaveBeenCalledTimes(1);

    input.held.fireHeld = false;
    h.room.stepPlayerAura(player, player.id, combat, weapon, 0.05, true);
    expect(combat.auraRequireRelease).toBe(false);
  });

  it("spawns Hollowbarrel pellets at the shared spout and sweeps from the shooter", async () => {
    const h = makeRoom();
    h.join("scatter-spout");
    const player = h.state().players.get("scatter-spout");
    const combat = h.room.combat.get("scatter-spout");
    const weapon = WEAPONS["x2-hollowbarrel-spell-scattergun-staff"];
    if (!weapon?.scatter) throw new Error("Hollowbarrel scatter fixture is required");
    player.x = 1_500;
    player.y = 1_500;
    combat.targetX = player.x + 500;
    combat.targetY = player.y;
    combat.aimX = 1;
    combat.aimY = 0;
    const origin = weaponEffectEmitterPoint(weapon, player, 0);
    const random = vi.spyOn(Math, "random").mockReturnValue(0.5);

    h.room.fireScatter(player, combat, weapon);

    expect(h.state().projectiles.size).toBe(weapon.scatter.count);
    for (const projectile of h.state().projectiles.values()) {
      const meta = h.room.projectileMeta.get(projectile.id);
      expect(projectile.x).toBeCloseTo(origin.x, 8);
      expect(projectile.y).toBeCloseTo(origin.y, 8);
      expect(meta?.firstCollisionX).toBe(player.x);
      expect(meta?.firstCollisionY).toBe(player.y);
    }
    random.mockRestore();
  });
});

// Owner-ledger W-ZONE authority coverage. These append the growth, tick, Drive, and landing contracts.
describe("GameRoom — shared procedural weapon ground zones", () => {
  it("grows Gravewax over held time through the continuous Drive seam and never creates a beam", async () => {
    const { weaponResourceProfile, ZoneKind } = await import("@dd/shared");
    const h = makeRoom();
    h.join("grave-zone");
    h.room.map.pois.length = 0;
    h.room.map.tiles.fill(TILE_GROUND);
    const player = h.state().players.get("grave-zone");
    const combat = h.room.combat.get(player.id);
    const weapon = WEAPONS["x2-gravewax-seance-globe"];
    if (!weapon?.groundZone) throw new Error("Gravewax ground-zone fixture is required");
    player.weapon = weapon.id;
    combat.lastWeapon = weapon.id;
    combat.targetX = player.x + 120;
    combat.targetY = player.y;
    combat.aimX = 1;
    combat.aimY = 0;
    const input = h.room.inputs.get(player.id);
    input.held.fireHeld = true;
    input.lastFreshFireTick = h.state().tick;
    const driveBefore = player.weaponResource.valueQ;

    h.room.stepPlayerGroundZone(player, player.id, combat, weapon, 0.05, true);
    const zone = [...h.state().zones.values()].find((row) => row.ownerId === player.id);
    if (!zone) throw new Error("held Gravewax did not create a zone");
    const firstRadius = zone.radius;
    for (let i = 0; i < 5; i++) {
      input.lastFreshFireTick = h.state().tick;
      h.room.stepPlayerGroundZone(player, player.id, combat, weapon, 0.05, true);
    }

    expect(zone.kind).toBe(ZoneKind.Weapon);
    expect(zone.radius).toBeGreaterThan(firstRadius);
    expect(zone.radius).toBeLessThanOrEqual(weapon.groundZone.maxRadius);
    expect(player.weaponResource.valueQ).toBeLessThan(driveBefore);
    expect(weaponResourceProfile(weapon.id)?.branch).toBe("zone");
    expect(weapon.beam).toBeUndefined();
    expect(h.state().beams.size).toBe(0);
  });

  it("ticks poison damage and applies Frostquill's authored slow on the server", async () => {
    const { ZoneStyle } = await import("@dd/shared");
    const h = makeRoom();
    h.join("zone-ticks");
    h.room.map.pois.length = 0;
    h.room.map.tiles.fill(TILE_GROUND);
    const player = h.state().players.get("zone-ticks");
    const enemy = new EnemyState();
    enemy.id = "zone-target";
    enemy.kind = "critter";
    enemy.x = player.x + 80;
    enemy.y = player.y;
    enemy.hp = 1_000;
    h.state().enemies.set(enemy.id, enemy);
    h.room.rebuildEnemyGrid();
    const poison = WEAPONS["x2-snakeoil-tincture-scepter"];
    const frost = WEAPONS["x2-frostquill-compendium"];
    if (!poison?.groundZone || !frost?.groundZone)
      throw new Error("poison/frost ground-zone fixtures are required");

    const poisonZone = h.room.spawnWeaponGroundZoneAt(
      player,
      poison,
      enemy.x,
      enemy.y,
      poison.groundZone.damagePerSecond,
    );
    const frostZone = h.room.spawnWeaponGroundZoneAt(player, frost, enemy.x, enemy.y, 0);
    h.room.stepZones(0.05);
    h.room.stepZones(0.05);

    expect(poisonZone?.style).toBe(ZoneStyle.Poison);
    expect(frostZone?.style).toBe(ZoneStyle.Ice);
    expect(enemy.hp).toBeLessThan(1_000);
    expect(h.room.enemyGroundZoneSlow(enemy.id)).toBe(frost.groundZone.slowMultiplier);
    expect(h.room.enemyZoneSlow.get(enemy.id)?.untilTick).toBeGreaterThan(h.state().tick);
  });

  it("converts Carrion Effigy to an own-sprite arc grenade that blooms poison only on landing", async () => {
    const { thrownProjectileSpriteId, ZoneStyle } = await import("@dd/shared");
    const h = makeRoom();
    h.join("carrion-grenade");
    h.room.map.pois.length = 0;
    h.room.map.tiles.fill(TILE_GROUND);
    const player = h.state().players.get("carrion-grenade");
    const combat = h.room.combat.get(player.id);
    const weapon = WEAPONS["x2-carrion-effigy"];
    if (!weapon?.thrown || weapon.groundZone?.trigger !== "landing")
      throw new Error("Carrion landing-grenade fixture is required");
    player.weapon = weapon.id;
    combat.lastWeapon = weapon.id;
    combat.targetX = player.x + weapon.thrown.range;
    combat.targetY = player.y;
    combat.aimX = 1;
    combat.aimY = 0;

    h.room.throwWeapon(player, combat, weapon);
    const projectile = [...h.state().projectiles.values()][0];
    if (!projectile) throw new Error("Carrion did not launch its grenade");
    const meta = h.room.projectileMeta.get(projectile.id);
    expect(weapon.scatter).toBeUndefined();
    expect(projectile.kind).toBe(`thrown:${weapon.id}`);
    expect(thrownProjectileSpriteId(projectile.kind)).toBe(weapon.id);
    expect(projectile.bornTick).toBe(h.state().tick);
    expect(meta?.landingZoneDamage).toBeGreaterThan(0);
    expect(h.state().zones.size).toBe(0);

    for (let i = 0; i < 20 && h.state().projectiles.size > 0; i++) h.room.stepProjectiles(0.05);
    const landed = [...h.state().zones.values()].find((row) => row.weaponId === weapon.id);
    expect(h.state().projectiles.size).toBe(0);
    expect(landed?.style).toBe(ZoneStyle.Poison);
    expect(landed?.radius).toBe(weapon.groundZone.initialRadius);
  });
});

// W-CONVERT — append-only server proof for Cogwright's full-distance authoritative cursor warp.
describe("GameRoom — Cogwright Tesla-Rod warp", () => {
  it("lands at the server-validated cursor with no weapon-range cap and bursts on arrival", () => {
    const h = makeRoom();
    h.join("tesla-warp");
    h.room.map.pois.length = 0;
    h.room.map.tiles.fill(TILE_GROUND);
    const player = h.state().players.get("tesla-warp");
    const combat = h.room.combat.get(player.id);
    const weapon = WEAPONS["x2-cogwright-s-tesla-rod"];
    if (!weapon?.warp) throw new Error("Cogwright warp fixture is required");

    player.x = 320;
    player.y = 360;
    player.weapon = weapon.id;
    combat.lastWeapon = weapon.id;
    combat.cd = 0;
    const target = { x: 1_520, y: 960 };
    const expected = h.room.navValidDest(
      player,
      combat,
      target.x,
      target.y,
      Number.POSITIVE_INFINITY,
    );
    expect(Math.hypot(expected.x - player.x, expected.y - player.y)).toBeGreaterThan(weapon.range);

    const enemy = new EnemyState();
    enemy.id = "warp-arrival-dummy";
    enemy.kind = "dummy";
    enemy.hp = 1_000;
    enemy.x = expected.x;
    enemy.y = expected.y;
    h.state().enemies.set(enemy.id, enemy);
    h.room.enemyGrid.insert(enemy.id, enemy.x, enemy.y);
    const teleportSeq = player.teleportSeq;

    combat.targetX = target.x;
    combat.targetY = target.y;
    h.room.warpWeaponToCursor(player, combat, weapon);

    expect(player.x).toBeCloseTo(expected.x, 6);
    expect(player.y).toBeCloseTo(expected.y, 6);
    expect(player.teleportSeq).toBe(teleportSeq + 1);
    expect(enemy.hp).toBeLessThan(1_000);
    expect(h.room.meleeSwings.has(player.id)).toBe(false);
    expect(
      [...h.state().combatReceipts.values()].some(
        (receipt) =>
          receipt.weaponId === weapon.id &&
          receipt.delivery === enemyComboShared.CombatDelivery.Warp,
      ),
    ).toBe(true);
  });
});

// NB BUG SQUAD: append-only authoritative projectile attribution and cadence regressions.
describe("GameRoom - NB projectile contracts", () => {
  function projectileRoom(id: string, weaponId: string) {
    const h = makeRoom();
    h.join(id);
    h.state().mode = "training";
    h.room.map.pois.length = 0;
    h.room.map.tiles.fill(TILE_GROUND);
    h.state().enemies.clear();
    const player = h.state().players.get(id);
    player.x = 2_400;
    player.y = 2_400;
    player.weapon = weaponId;
    h.tick(1);
    return { h, player };
  }

  it("emits Galvanic's accepted trigger as four ordered, authoritatively attributed rounds", () => {
    const weaponId = "x2-galvanic-overcasters";
    const weapon = WEAPONS[weaponId];
    if (!weapon?.gun?.burst) throw new Error("Galvanic burst fixture is required");
    const { h, player } = projectileRoom("galvanic", weaponId);
    const firstProjectileSeq = h.room.projectileSeq;

    h.send(player.id, "attack", {
      aimX: 1,
      aimY: 0,
      tx: player.x + weapon.gun.range,
      ty: player.y,
    });
    h.tick(4);

    const rounds = [...h.state().projectiles.values()].filter(
      (row) => row.sourceWeaponId === weaponId,
    );
    expect(weapon.gun.burst).toEqual({ count: 4, intervalSeconds: 0.05 });
    expect(h.room.projectileSeq - firstProjectileSeq).toBe(4);
    expect(rounds).toHaveLength(4);
    const firstBornTick = rounds[0]?.bornTick;
    expect(firstBornTick).toBeDefined();
    expect(rounds.map((row) => row.bornTick)).toEqual([
      firstBornTick,
      firstBornTick! + 1,
      firstBornTick! + 2,
      firstBornTick! + 3,
    ]);
    expect(rounds.every((row) => row.sourcePlayerId === player.id)).toBe(true);
    h.tick(6);
    expect(h.room.projectileSeq - firstProjectileSeq).toBe(4);
  });

  it("emits one Quicksilver press as six sequential rows for one resource spend", () => {
    const weaponId = "x2-quicksilver-fanner";
    const weapon = WEAPONS[weaponId];
    if (!weapon?.gun?.burst) throw new Error("Fanner burst fixture is required");
    const { h, player } = projectileRoom("fanner", weaponId);
    const combat = h.room.combat.get(player.id);
    h.room.setWeaponResourceRegenOverride(player.id, "paused");
    combat.drive.valueF = 100;
    player.weaponResource.valueQ = 10_000;

    h.send(player.id, "attack", {
      aimX: 1,
      aimY: 0,
      tx: player.x + weapon.gun.range,
      ty: player.y,
    });
    h.tick(1);
    const afterTriggerCost = combat.drive.valueF;
    h.tick(5);

    const rounds = [...h.state().projectiles.values()].filter(
      (row) => row.sourceWeaponId === weaponId,
    );
    expect(weapon.gun).toMatchObject({
      damage: 1,
      burst: { count: 6, intervalSeconds: 0.05 },
    });
    expect(weapon.gun.pellets).toBeUndefined();
    expect(rounds).toHaveLength(6);
    expect(rounds.map((row) => row.sourceBurstIndex)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(new Set(rounds.map((row) => row.bornTick)).size).toBe(6);
    expect(combat.drive.valueF).toBe(afterTriggerCost);
  });

  it("stamps Coyote rounds with the exact alternating barrel part", () => {
    const weaponId = "x2-coyote-stinger";
    const weapon = WEAPONS[weaponId];
    if (!weapon?.gun || weapon.muzzle?.salvoMode !== "cycle")
      throw new Error("Coyote alternating muzzle fixture is required");
    const { h, player } = projectileRoom("coyote-muzzle", weaponId);
    const combat = h.room.combat.get(player.id);
    combat.aimX = 1;
    combat.aimY = 0;
    combat.targetX = player.x + weapon.gun.range;
    combat.targetY = player.y;

    player.attackSeq = 1;
    h.room.fireGun(player, combat, weapon);
    player.attackSeq = 2;
    h.room.fireGun(player, combat, weapon);

    const rounds = [...h.state().projectiles.values()].filter(
      (row) => row.sourceWeaponId === weaponId,
    );
    expect(rounds.map((row) => row.sourceMuzzlePart)).toEqual([0, 1]);
    expect(rounds.every((row) => Math.abs(row.x - player.x) > 20)).toBe(true);
  });

  it("makes every Arcanist held-fire cadence request an accepted projectile beat", () => {
    const weaponId = "x-staff-arcane-lance";
    const weapon = WEAPONS[weaponId];
    if (!weapon?.cast) throw new Error("Arcanist cast fixture is required");
    const { h, player } = projectileRoom("arcanist", weaponId);
    const cadence = enemyComboShared.weaponAttackCooldown(weapon);
    const projectileCount = weapon.cast.volley?.count ?? 1;

    expect(cadence).toBe(weapon.cast.cooldown);
    for (let shot = 0; shot < 4; shot++) {
      const attackSeq = player.attackSeq;
      const projectileSeq = h.room.projectileSeq;
      h.send(player.id, "attack", {
        aimX: 1,
        aimY: 0,
        tx: player.x + weapon.cast.range,
        ty: player.y,
      });
      h.tick(1);
      expect(player.attackSeq, `accepted shot ${shot + 1}`).toBe(attackSeq + 1);
      expect(h.room.projectileSeq, `volley for shot ${shot + 1}`).toBe(
        projectileSeq + projectileCount,
      );
      h.tick(Math.ceil(cadence / 0.05));
    }
  });
});

// NW-MELEE/NW-THROWN append-only server-authority contracts.
describe("GameRoom - NW melee and thrown mechanics", () => {
  it("applies Glacier Headtaker's authored freeze through the shared enemy slow status map", () => {
    const h = makeRoom();
    h.join("glacier");
    h.state().enemies.clear();
    const player = h.state().players.get("glacier");
    player.x = 2_400;
    player.y = 2_400;
    const enemy = new EnemyState();
    enemy.id = "freeze-target";
    enemy.kind = "critter";
    enemy.hp = 100;
    enemy.x = player.x + 80;
    enemy.y = player.y;
    h.state().enemies.set(enemy.id, enemy);
    h.room.rebuildEnemyGrid();
    const combat = h.room.combat.get(player.id);
    combat.aimX = 1;
    combat.aimY = 0;
    const definition = WEAPONS["x2-glacier-headtaker"];
    if (!definition?.hitStatus) throw new Error("Glacier freeze fixture is required");
    const swing = swingDescriptorFor(definition, definition.cooldown);

    h.room.resolveSwing(player, combat, definition, swing);
    h.room.stepMeleeSwings(swing.activeEndSeconds + 0.001);

    expect(enemy.hp).toBeLessThan(100);
    expect(h.room.enemyZoneSlow.get(enemy.id)).toEqual({
      multiplier: 0.1,
      untilTick: 16,
    });
  });

  it("selects Carrion Cudgel's nearest fresh ricochet target and consumes one hop", () => {
    const h = makeRoom();
    h.state().enemies.clear();
    const near = new EnemyState();
    near.id = "near";
    near.kind = "critter";
    near.hp = 10;
    near.x = 30;
    near.y = 0;
    const far = new EnemyState();
    far.id = "far";
    far.kind = "critter";
    far.hp = 10;
    far.x = 0;
    far.y = 80;
    h.state().enemies.set(near.id, near);
    h.state().enemies.set(far.id, far);
    const projectile = { x: 0, y: 0, vx: -120, vy: 0 };
    const meta = {
      ttl: 0.01,
      hit: new Set(["spent"]),
      pierce: 0,
      pierceMax: 1,
      ricochetHops: 1,
      ricochetRange: 260,
    };

    expect(h.room.redirectThrownRicochet(projectile, meta)).toBe(true);
    expect(projectile.vx).toBeCloseTo(120);
    expect(projectile.vy).toBeCloseTo(0);
    expect(meta).toMatchObject({ pierce: 1, ricochetHops: 0 });
    expect(meta.ttl).toBeCloseTo(260 / 120);
  });

  it("registers Mournveil's held fan-spin as one full authoritative damage arc", () => {
    const h = makeRoom();
    h.join("mournveil");
    const player = h.state().players.get("mournveil");
    const combat = h.room.combat.get(player.id);
    combat.aimX = 1;
    combat.aimY = 0;
    const definition = WEAPONS["x2-mournveil-scythe"];
    if (!definition) throw new Error("Mournveil fan-spin fixture is required");

    h.room.resolveSwing(
      player,
      combat,
      definition,
      swingDescriptorFor(definition, definition.cooldown),
    );
    const active = h.room.meleeSwings.get(player.id);

    expect(definition.performance).toMatchObject({ continuous: true, action: "default-swing" });
    expect(active?.swingArc).toBeCloseTo(Math.PI * 2);
    expect(active?.swing.style).toBe("spin");
  });
});

describe("GameRoom - B20 L2 authoritative chests", () => {
  it("spawns the first chest on valid map ground from the isolated cadence stream", () => {
    const h = makeRoom();
    h.join("chest-runner");
    h.state().tick = h.room.chestCadence.nextSpawnTick;
    h.room.stepChestDirector();

    expect(h.state().chests.size).toBe(1);
    const chest = [...h.state().chests.values()][0];
    expect(chest).toBeDefined();
    expect(
      enemyComboShared.isArenaDiscSafe(
        h.room.map,
        chest.x,
        chest.y,
        enemyComboShared.CHEST_PLACEMENT_RADIUS,
      ),
    ).toBe(true);
    expect(enemyComboShared.isInsidePoi(h.room.map, chest.x, chest.y)).toBe(false);
    expect(enemyComboShared.isPitAtPx(h.room.map, chest.x, chest.y)).toBe(false);
  });

  it("consumes one shared chest independently for each co-op player", () => {
    const h = makeRoom();
    h.join("chest-a");
    h.join("chest-b");
    const receipts = new Map<string, unknown>();
    for (const client of h.room.clients) {
      client.send = (type: string, payload: unknown) => {
        if (type === "chestOpened") receipts.set(client.sessionId, payload);
      };
    }
    const a = h.state().players.get("chest-a");
    const b = h.state().players.get("chest-b");
    const chest = new enemyComboShared.ChestState();
    chest.id = "chest:77:500";
    chest.x = a.x;
    chest.y = a.y;
    chest.zone = enemyComboShared.MAP_ZONE_SCAR;
    chest.kind = enemyComboShared.CHEST_KIND_WEAPON_CACHE;
    chest.spawnTick = 500;
    chest.openedBy.set(a.id, false);
    chest.openedBy.set(b.id, false);
    h.state().chests.set(chest.id, chest);
    b.x = chest.x;
    b.y = chest.y;
    h.room.chestRoomSeed = 0x5eed20;
    h.room.chestRunStartTick = 0;

    h.room.openChestForPlayer(a.id, chest.id);
    expect(chest.openedBy.get(a.id)).toBe(true);
    expect(chest.openedBy.get(b.id)).toBe(false);
    expect(chest.opened).toBe(false);
    expect(receipts.has(a.id)).toBe(true);

    const firstReceipt = receipts.get(a.id);
    h.room.openChestForPlayer(a.id, chest.id);
    expect(receipts.get(a.id)).toBe(firstReceipt);

    h.room.openChestForPlayer(b.id, chest.id);
    expect(chest.openedBy.get(b.id)).toBe(true);
    expect(chest.opened).toBe(true);
    expect(receipts.has(b.id)).toBe(true);
  });

  it("rolls each co-op chest weapon from only that opener's unlocked pool", () => {
    const h = makeRoom();
    h.join("pool-a");
    h.join("pool-b");
    const weaponA = "rusty-cleaver";
    const weaponB = "x-gun-gatling";
    h.room.metaAccounts.get("pool-a").unlockedWeapons = [weaponA];
    h.room.metaAccounts.get("pool-b").unlockedWeapons = [weaponB];
    const receipts = new Map<string, { weapon?: { id: string } }>();
    for (const client of h.room.clients) {
      client.send = (type: string, payload: unknown) => {
        if (type === "chestOpened") {
          receipts.set(client.sessionId, payload as { weapon?: { id: string } });
        }
      };
    }
    const a = h.state().players.get("pool-a");
    const b = h.state().players.get("pool-b");
    const chest = new enemyComboShared.ChestState();
    chest.id = "chest:177:500";
    chest.x = a.x;
    chest.y = a.y;
    chest.zone = enemyComboShared.MAP_ZONE_SCAR;
    chest.kind = enemyComboShared.CHEST_KIND_WEAPON_CACHE;
    chest.spawnTick = 500;
    chest.openedBy.set(a.id, false);
    chest.openedBy.set(b.id, false);
    h.state().chests.set(chest.id, chest);
    b.x = chest.x;
    b.y = chest.y;

    h.room.openChestForPlayer(a.id, chest.id);
    h.room.openChestForPlayer(b.id, chest.id);

    expect(receipts.get(a.id)?.weapon?.id).toBe(weaponA);
    expect(receipts.get(b.id)?.weapon?.id).toBe(weaponB);
  });

  it("applies dodge overrides through authoritative movement while preserving the shared roll window", () => {
    const fixture = makeRollRoom("relic-dodge");
    fixture.player.relics.activeDodge = "dodge-bloodhound-step";

    beginRoll(fixture);

    expect(Math.hypot(fixture.combat.momentumX, fixture.combat.momentumY)).toBeCloseTo(
      enemyComboShared.relicRollSpeedAtTick(
        fixture.player.relics,
        fixture.combat.slidePhaseTick,
      ),
      6,
    );
    for (let i = 0; i < enemyComboShared.ROLL_DURATION_TICKS + 4; i++) fixture.h.tick(1);
    expect(fixture.combat.stance).toBe(enemyComboShared.STANCE_NONE);
    expect(fixture.combat.rollCd).toBeGreaterThan(
      enemyComboShared.relicDodgeCooldown(enemyComboShared.EMPTY_RELIC_STACKS),
    );
    expect(fixture.combat.rollCd).toBeLessThanOrEqual(
      enemyComboShared.relicDodgeCooldown(fixture.player.relics),
    );
  });

  it("feeds common crit/regen and rare survival edges into server authority", () => {
    const h = makeRoom();
    h.join("relic-survivor");
    const player = h.state().players.get("relic-survivor");
    player.relics.crit = 2;
    player.relics.hpRegen = 2;
    player.hp = 50;
    expect(h.room.flatCritChance(player)).toBeCloseTo(
      enemyComboShared.CRIT_BASE + enemyComboShared.RELIC_CRIT_PER_STACK * 2,
    );
    h.tick(1);
    expect(player.hp).toBeGreaterThan(50);

    player.relics.ownedRare = "one-shot-protection,revive";
    player.relics.reviveAvailable = true;
    player.hp = player.maxHp;
    h.room.damagePlayer(player, player.maxHp * 2, "enemy");
    expect(player.hp).toBe(1);
    expect(player.relics.deathWardReadyTick).toBeGreaterThan(h.state().tick);

    player.hp = 0;
    h.tick(1);
    expect(player.alive).toBe(true);
    expect(player.hp).toBe(Math.round(player.maxHp * REVIVE_HP_FRAC));
    expect(player.relics.reviveAvailable).toBe(false);
  });
});
