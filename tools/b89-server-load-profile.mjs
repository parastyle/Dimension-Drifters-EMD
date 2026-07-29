import inspector from "node:inspector";
import { performance } from "node:perf_hooks";
import process from "node:process";

import {
  AUGMENT_IDS,
  AUGMENTS,
  ENEMY_KIND_IDS,
  ENEMY_KINDS,
  EnemyState,
  ProjectileState,
  TICK_MS,
  TILE_GROUND,
  WEAPON_IDS,
  WEAPONS,
} from "@dd/shared";
import { GameRoom } from "../packages/server/src/rooms/GameRoom.ts";

const WARMUP_TICKS = 60;
const SAMPLE_TICKS = 400;
const PATCH_WARMUP_TICKS = 30;
const PATCH_SAMPLE_TICKS = 200;
const ALLOCATION_TICKS = 1_200;
const TIMER_SAMPLE_MS = TICK_MS / 5;
const TIMER_RUN_MS = 10_000;
const DT_SECONDS = TICK_MS / 1_000;
const ENEMY_SWEEP = [1, 5, 10, 25, 50];
const PROJECTILE_SWEEP = [0, 5, 14, 25, 50, 100];
const REPRESENTATIVE = { enemies: 6, projectiles: 14 };
const WILD_WEST_ROSTER = [
  "critter",
  "mote-swarm",
  "pricklepulp",
  "boothill",
  "ronin",
  "gatlin",
  "vault-ronin",
  "dust-ranger",
];

const phaseOrder = [
  "0 tick/input/grid/traversal",
  "1 player movement",
  "2 player body collision",
  "2.4 belt player collision",
  "2.5 player lava gaps",
  "2.7 money/victory",
  "3 clock/spawn director",
  "4 player combat/resource",
  "4.6 melee swings",
  "4.65 deferred attacks",
  "4.7 ultimates",
  "5 generic enemy AI",
  "5.1 enemy melee/combo AI",
  "5.15 boss AI",
  "5.2 enemy ranged fire",
  "5.3 projectiles",
  "5.4 zones",
  "5.5 enemy body collision",
  "5.55 belt enemy collision",
  "5.6 retired enemy floor falls",
  "6 enemy contact damage",
  "7 regen/death/status cleanup",
];

const phaseSamples = new Map(phaseOrder.map((phase) => [phase, []]));
let phaseCaptureActive = false;
let currentPhase;
let currentPhaseStartedNs = 0n;

globalThis.__b89Phase = (phase) => {
  if (!phaseCaptureActive) return;
  const now = process.hrtime.bigint();
  if (currentPhase !== undefined) {
    phaseSamples.get(currentPhase).push(Number(now - currentPhaseStartedNs) / 1e6);
  }
  currentPhase = phase;
  currentPhaseStartedNs = now;
};

globalThis.__b89PhaseEnd = () => {
  if (!phaseCaptureActive) return;
  const now = process.hrtime.bigint();
  if (currentPhase !== undefined) {
    phaseSamples.get(currentPhase).push(Number(now - currentPhaseStartedNs) / 1e6);
  }
  currentPhase = undefined;
};

function clearPhaseSamples() {
  for (const values of phaseSamples.values()) values.length = 0;
  currentPhase = undefined;
}

function quantile(sorted, probability) {
  if (sorted.length === 0) return 0;
  return sorted[Math.max(0, Math.ceil(sorted.length * probability) - 1)];
}

function summarize(values) {
  if (values.length === 0) return { meanMs: 0, p99Ms: 0, maxMs: 0, samples: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  return {
    meanMs: values.reduce((sum, value) => sum + value, 0) / values.length,
    p99Ms: quantile(sorted, 0.99),
    maxMs: sorted[sorted.length - 1],
    samples: values.length,
  };
}

function round(value, digits = 6) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function roundedSummary(values) {
  const result = summarize(values);
  return {
    meanMs: round(result.meanMs),
    p99Ms: round(result.p99Ms),
    maxMs: round(result.maxMs),
    samples: result.samples,
  };
}

function makeFakeClient(sessionId, patchBytes) {
  return {
    sessionId,
    state: 1,
    send() {},
    error() {},
    leave() {},
    raw(bytes) {
      patchBytes.push(bytes.length);
    },
  };
}

function withMutedConsole(callback) {
  const originalLog = console.log;
  console.log = () => {};
  try {
    return callback();
  } finally {
    console.log = originalLog;
  }
}

function createRoom(enemyCount, projectileCount) {
  const room = new GameRoom();
  room.__init();
  room.roomId = `b89-${enemyCount}-${projectileCount}`;
  room.setSimulationInterval = () => {};
  room.setPatchRate = () => {};
  room.broadcast = () => {};

  withMutedConsole(() => room.onCreate({ dimensionId: "wild-west" }));

  const patchBytes = [];
  const client = makeFakeClient("profile-player", patchBytes);
  room.clients.push(client);
  withMutedConsole(() => room.onJoin(client));
  room.state.mode = "training";
  room.state.outcome = "active";
  room.state.paused = false;
  room.map.tiles.fill(TILE_GROUND);

  const player = room.state.players.get(client.sessionId);
  player.x = room.map.spawnX;
  player.y = room.map.spawnY;
  player.hp = 1_000_000_000;
  player.maxHp = 1_000_000_000;

  const enemyOrigins = [];
  for (let index = 0; index < enemyCount; index++) {
    const enemy = new EnemyState();
    enemy.id = `bench-enemy-${index}`;
    enemy.kind = WILD_WEST_ROSTER[index % WILD_WEST_ROSTER.length];
    enemy.hp = 1_000_000_000;
    const column = index % 10;
    const row = Math.floor(index / 10);
    enemy.x = player.x + 700 + column * 46;
    enemy.y = player.y - 110 + row * 46;
    room.state.enemies.set(enemy.id, enemy);
    room.enemyFireCd.set(enemy.id, 1_000_000_000);
    room.zonerDropCd.set(enemy.id, 1_000_000_000);
    enemyOrigins.push(enemy.x, enemy.y);
  }

  const projectileOrigins = [];
  for (let index = 0; index < projectileCount; index++) {
    const projectile = new ProjectileState();
    projectile.id = `bench-projectile-${index}`;
    projectile.kind = index % 2 === 0 ? "spit" : "bench-friendly";
    projectile.hostile = index % 2 === 0;
    projectile.x = player.x - 900 + (index % 20) * 31;
    projectile.y = player.y + 700 + Math.floor(index / 20) * 31;
    projectile.vx = index % 3 === 0 ? 20 : -20;
    projectile.vy = index % 2 === 0 ? 15 : -15;
    projectile.flightTicks = 0xffff;
    room.state.projectiles.set(projectile.id, projectile);
    room.projectileMeta.set(projectile.id, {
      ttl: 1_000_000_000,
      damage: 1,
      hostile: projectile.hostile,
      pierce: 1_000_000,
      pierceMax: 1_000_000,
      hit: new Set(),
      firstStep: false,
      sourcePlayerId: client.sessionId,
      sourceWeaponId: player.weapon,
      sourceX: player.x,
      sourceY: player.y,
    });
    if (projectile.hostile) room.hostileProjectileCount++;
    projectileOrigins.push(projectile.x, projectile.y);
  }

  function restoreEntities() {
    let offset = 0;
    room.state.enemies.forEach((enemy) => {
      enemy.x = enemyOrigins[offset++];
      enemy.y = enemyOrigins[offset++];
      enemy.hp = 1_000_000_000;
    });
    offset = 0;
    room.state.projectiles.forEach((projectile) => {
      projectile.x = projectileOrigins[offset++];
      projectile.y = projectileOrigins[offset++];
    });
    player.x = room.map.spawnX;
    player.y = room.map.spawnY;
    player.hp = 1_000_000_000;
    player.alive = true;
    room.state.outcome = "active";
  }

  return { room, client, patchBytes, restoreEntities };
}

function runStep(roomFixture, broadcast = false) {
  roomFixture.room.stepSim(DT_SECONDS);
  if (broadcast) roomFixture.room.broadcastPatch();
  roomFixture.restoreEntities();
}

function profilePreparedFixture(fixture) {
  phaseCaptureActive = false;
  for (let tick = 0; tick < WARMUP_TICKS; tick++) runStep(fixture);

  clearPhaseSamples();
  const totalSamples = [];
  phaseCaptureActive = true;
  for (let tick = 0; tick < SAMPLE_TICKS; tick++) {
    const started = process.hrtime.bigint();
    fixture.room.stepSim(DT_SECONDS);
    totalSamples.push(Number(process.hrtime.bigint() - started) / 1e6);
    fixture.restoreEntities();
  }
  phaseCaptureActive = false;

  return {
    total: roundedSummary(totalSamples),
    phases: Object.fromEntries(
      phaseOrder.map((phase) => [phase, roundedSummary(phaseSamples.get(phase))]),
    ),
  };
}

function profileScenario(enemyCount, projectileCount) {
  return {
    enemies: enemyCount,
    projectiles: projectileCount,
    ...profilePreparedFixture(createRoom(enemyCount, projectileCount)),
  };
}

function profileFixVariants() {
  function sortBypass(enemies) {
    const fixture = createRoom(enemies, REPRESENTATIVE.projectiles);
    fixture.room.enemyCandidates.sort = function bypassCandidateSort() {
      return this;
    };
    return {
      enemies,
      projectiles: REPRESENTATIVE.projectiles,
      ...profilePreparedFixture(fixture),
    };
  }

  function nearestPlayerBypass(enemies) {
    const fixture = createRoom(enemies, REPRESENTATIVE.projectiles);
    const player = fixture.room.state.players.get("profile-player");
    fixture.room.nearestLivingPlayer = () => player;
    return {
      enemies,
      projectiles: REPRESENTATIVE.projectiles,
      ...profilePreparedFixture(fixture),
    };
  }

  function allHostileProjectiles() {
    const fixture = createRoom(REPRESENTATIVE.enemies, REPRESENTATIVE.projectiles);
    fixture.room.hostileProjectileCount = fixture.room.state.projectiles.size;
    fixture.room.state.projectiles.forEach((projectile, id) => {
      projectile.hostile = true;
      fixture.room.projectileMeta.get(id).hostile = true;
    });
    return {
      enemies: REPRESENTATIVE.enemies,
      projectiles: REPRESENTATIVE.projectiles,
      ...profilePreparedFixture(fixture),
    };
  }

  return {
    sortBypassRepresentative: sortBypass(REPRESENTATIVE.enemies),
    sortBypass50Enemies: sortBypass(50),
    nearestPlayerBypassRepresentative: nearestPlayerBypass(REPRESENTATIVE.enemies),
    nearestPlayerBypass50Enemies: nearestPlayerBypass(50),
    allHostileProjectiles: allHostileProjectiles(),
  };
}

function profileBroadcast(enemyCount, projectileCount) {
  const fixture = createRoom(enemyCount, projectileCount);
  phaseCaptureActive = false;
  fixture.room.broadcastPatch();
  fixture.patchBytes.length = 0;
  for (let tick = 0; tick < PATCH_WARMUP_TICKS; tick++) runStep(fixture, true);

  fixture.patchBytes.length = 0;
  const timings = [];
  for (let tick = 0; tick < PATCH_SAMPLE_TICKS; tick++) {
    fixture.room.stepSim(DT_SECONDS);
    const started = process.hrtime.bigint();
    fixture.room.broadcastPatch();
    timings.push(Number(process.hrtime.bigint() - started) / 1e6);
    fixture.restoreEntities();
  }
  return {
    enemies: enemyCount,
    projectiles: projectileCount,
    timing: roundedSummary(timings),
    bytes: roundedSummary(fixture.patchBytes),
  };
}

function inspectorPost(session, method, params = {}) {
  return new Promise((resolve, reject) => {
    session.post(method, params, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}

function flattenAllocationProfile(node, output) {
  if (node.selfSize > 0) {
    const frame = node.callFrame;
    const key = `${frame.functionName || "(anonymous)"}|${frame.url}|${frame.lineNumber + 1}`;
    output.set(key, (output.get(key) ?? 0) + node.selfSize);
  }
  for (const child of node.children ?? []) flattenAllocationProfile(child, output);
}

async function profileAllocations(enemyCount, projectileCount, broadcast) {
  const fixture = createRoom(enemyCount, projectileCount);
  phaseCaptureActive = false;
  const allocationStep = () => {
    fixture.room.stepSim(DT_SECONDS);
    if (broadcast) fixture.room.broadcastPatch();
  };
  for (let tick = 0; tick < WARMUP_TICKS; tick++) allocationStep();
  globalThis.gc?.();
  const heapUsedBefore = process.memoryUsage().heapUsed;

  const session = new inspector.Session();
  session.connect();
  await inspectorPost(session, "HeapProfiler.enable");
  await inspectorPost(session, "HeapProfiler.startSampling", {
    samplingInterval: 2_048,
    includeObjectsCollectedByMajorGC: true,
    includeObjectsCollectedByMinorGC: true,
  });
  for (let tick = 0; tick < ALLOCATION_TICKS; tick++) allocationStep();
  const { profile } = await inspectorPost(session, "HeapProfiler.stopSampling");
  session.disconnect();
  globalThis.gc?.();
  const heapUsedAfter = process.memoryUsage().heapUsed;

  const entries = new Map();
  flattenAllocationProfile(profile.head, entries);
  const top = [...entries.entries()]
    .map(([key, bytes]) => {
      const [functionName, url, line] = key.split("|");
      return { functionName, url, line: Number(line), bytes };
    })
    .sort((left, right) => right.bytes - left.bytes);
  const sampledBytes = top.reduce((sum, entry) => sum + entry.bytes, 0);
  return {
    enemies: enemyCount,
    projectiles: projectileCount,
    broadcast,
    ticks: ALLOCATION_TICKS,
    sampledBytes,
    bytesPerTick: round(sampledBytes / ALLOCATION_TICKS, 3),
    mbPerSecondAt20Hz: round(((sampledBytes / ALLOCATION_TICKS) * 20) / 1_000_000, 6),
    retainedHeapDeltaBytes: heapUsedAfter - heapUsedBefore,
    retainedBytesPerTick: round((heapUsedAfter - heapUsedBefore) / ALLOCATION_TICKS, 3),
    top: top.slice(0, 12).map((entry) => ({ ...entry, bytes: Math.round(entry.bytes) })),
  };
}

function profileCatalogTouches() {
  const fixture = createRoom(REPRESENTATIVE.enemies, REPRESENTATIVE.projectiles);
  const counts = {
    objectKeys: { weapons: 0, enemies: 0, augments: 0 },
    objectValues: { weapons: 0, enemies: 0, augments: 0 },
    objectEntries: { weapons: 0, enemies: 0, augments: 0 },
    arrayIterations: { weapons: 0, enemies: 0, augments: 0 },
    arrayIndexOf: { weapons: 0, enemies: 0, augments: 0 },
  };
  const catalogs = new Map([
    [WEAPONS, "weapons"],
    [ENEMY_KINDS, "enemies"],
    [AUGMENTS, "augments"],
  ]);
  const catalogIds = new Map([
    [WEAPON_IDS, "weapons"],
    [ENEMY_KIND_IDS, "enemies"],
    [AUGMENT_IDS, "augments"],
  ]);
  const originalKeys = Object.keys;
  const originalValues = Object.values;
  const originalEntries = Object.entries;
  const originalIterator = Array.prototype[Symbol.iterator];
  const originalIndexOf = Array.prototype.indexOf;
  Object.keys = function profiledKeys(value) {
    const name = catalogs.get(value);
    if (name) counts.objectKeys[name]++;
    return originalKeys(value);
  };
  Object.values = function profiledValues(value) {
    const name = catalogs.get(value);
    if (name) counts.objectValues[name]++;
    return originalValues(value);
  };
  Object.entries = function profiledEntries(value) {
    const name = catalogs.get(value);
    if (name) counts.objectEntries[name]++;
    return originalEntries(value);
  };
  Array.prototype[Symbol.iterator] = function profiledIterator() {
    const name = catalogIds.get(this);
    if (name) counts.arrayIterations[name]++;
    return originalIterator.call(this);
  };
  Array.prototype.indexOf = function profiledIndexOf(...args) {
    const name = catalogIds.get(this);
    if (name) counts.arrayIndexOf[name]++;
    return originalIndexOf.apply(this, args);
  };

  try {
    for (let tick = 0; tick < 1_000; tick++) runStep(fixture);
  } finally {
    Object.keys = originalKeys;
    Object.values = originalValues;
    Object.entries = originalEntries;
    Array.prototype[Symbol.iterator] = originalIterator;
    Array.prototype.indexOf = originalIndexOf;
  }
  return { ticks: 1_000, counts };
}

async function profileTimerScheduler() {
  const fixture = createRoom(REPRESENTATIVE.enemies, REPRESENTATIVE.projectiles);
  phaseCaptureActive = false;
  const originalStepSim = fixture.room.stepSim.bind(fixture.room);
  let stepsThisInvocation = 0;
  fixture.room.stepSim = (dt) => {
    stepsThisInvocation++;
    return originalStepSim(dt);
  };

  const histogram = {};
  const callbackDurations = [];
  const callbackIntervals = [];
  const startedAt = performance.now();
  let previousAt = startedAt;
  let invocations = 0;
  await new Promise((resolve) => {
    const interval = setInterval(() => {
      const now = performance.now();
      const deltaMs = now - previousAt;
      previousAt = now;
      stepsThisInvocation = 0;
      const callbackStarted = performance.now();
      fixture.room.update(deltaMs);
      callbackDurations.push(performance.now() - callbackStarted);
      callbackIntervals.push(deltaMs);
      histogram[stepsThisInvocation] = (histogram[stepsThisInvocation] ?? 0) + 1;
      invocations++;
      fixture.restoreEntities();
      if (now - startedAt >= TIMER_RUN_MS) {
        clearInterval(interval);
        resolve();
      }
    }, TIMER_SAMPLE_MS);
  });

  const multiStepInvocations = Object.entries(histogram).reduce(
    (sum, [steps, count]) => sum + (Number(steps) > 1 ? count : 0),
    0,
  );
  return {
    durationMs: round(performance.now() - startedAt, 3),
    sampleIntervalMs: TIMER_SAMPLE_MS,
    invocations,
    histogram,
    multiStepInvocations,
    multiStepPercent: round((multiStepInvocations / invocations) * 100, 6),
    callback: roundedSummary(callbackDurations),
    interval: roundedSummary(callbackIntervals),
  };
}

function instrumentationOverhead() {
  const iterations = 20_000;
  clearPhaseSamples();
  phaseCaptureActive = true;
  const started = process.hrtime.bigint();
  for (let iteration = 0; iteration < iterations; iteration++) {
    for (const phase of phaseOrder) globalThis.__b89Phase(phase);
    globalThis.__b89PhaseEnd();
  }
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
  phaseCaptureActive = false;
  clearPhaseSamples();
  return {
    markerCallsPerTick: phaseOrder.length + 1,
    meanMsPerSyntheticTick: round(elapsedMs / iterations),
  };
}

async function main() {
  const environment = {
    node: process.version,
    platform: `${process.platform} ${process.arch}`,
    cpu: process.env.PROCESSOR_IDENTIFIER ?? "unknown",
    phaseWarmupTicks: WARMUP_TICKS,
    phaseSampleTicks: SAMPLE_TICKS,
    patchWarmupTicks: PATCH_WARMUP_TICKS,
    patchSampleTicks: PATCH_SAMPLE_TICKS,
    allocationTicks: ALLOCATION_TICKS,
  };
  const overhead = instrumentationOverhead();
  console.error("b89 profile: representative phase sample");
  const representative = profileScenario(REPRESENTATIVE.enemies, REPRESENTATIVE.projectiles);
  console.error("b89 profile: enemy scaling sweep");
  const enemySweep = ENEMY_SWEEP.map((enemies) =>
    profileScenario(enemies, REPRESENTATIVE.projectiles),
  );
  console.error("b89 profile: projectile scaling sweep");
  const projectileSweep = PROJECTILE_SWEEP.map((projectiles) =>
    profileScenario(REPRESENTATIVE.enemies, projectiles),
  );
  console.error("b89 profile: diagnostic fix variants");
  const fixVariants = profileFixVariants();
  console.error("b89 profile: broadcast samples");
  const broadcastRepresentative = profileBroadcast(
    REPRESENTATIVE.enemies,
    REPRESENTATIVE.projectiles,
  );
  const broadcastEnemySweep = ENEMY_SWEEP.map((enemies) =>
    profileBroadcast(enemies, REPRESENTATIVE.projectiles),
  );
  const broadcastProjectileSweep = PROJECTILE_SWEEP.map((projectiles) =>
    profileBroadcast(REPRESENTATIVE.enemies, projectiles),
  );
  console.error("b89 profile: catalog counters");
  const catalogTouches = profileCatalogTouches();
  console.error("b89 profile: real 10ms timer sample");
  const scheduler = await profileTimerScheduler();
  console.error("b89 profile: allocation samples");
  const allocations = {
    idleSim: await profileAllocations(0, 0, false),
    representativeSim: await profileAllocations(
      REPRESENTATIVE.enemies,
      REPRESENTATIVE.projectiles,
      false,
    ),
    representativeSimAndBroadcast: await profileAllocations(
      REPRESENTATIVE.enemies,
      REPRESENTATIVE.projectiles,
      true,
    ),
  };

  const result = {
    environment,
    contract: phaseOrder,
    overhead,
    representative,
    enemySweep,
    projectileSweep,
    fixVariants,
    broadcastRepresentative,
    broadcastEnemySweep,
    broadcastProjectileSweep,
    catalogTouches,
    allocations,
    scheduler,
  };
  await new Promise((resolve) =>
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`, resolve),
  );
}

await main();
process.exit(0);
