import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { Room as ClientRoom } from "../packages/client/node_modules/colyseus.js/build/esm/index.mjs";
import { GameRoom } from "../packages/server/src/rooms/GameRoom.ts";
import {
  ACTION_MSGS_PER_TICK,
  BOSS_PROJECTILE_BUDGET,
  ENEMY_KINDS,
  FISTS_WEAPON,
  FRIENDLY_BEAM_ENTITY_CAP,
  FRIENDLY_PROJECTILE_ENTITY_CAP,
  INPUT_MSGS_PER_TICK,
  MAX_ENEMIES,
  MAX_PLAYERS,
  TICK_RATE,
  WEAPONS,
} from "../packages/shared/dist/index.js";
import { Encoder } from "../packages/shared/node_modules/@colyseus/schema/build/esm/index.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..");
const OUTPUT_PATH = path.join(REPO_ROOT, "docs/perf/v7-coop-latency-server-wire.json");
const TICK_SECONDS = 1 / TICK_RATE;
const ZONE_CAP = 48;
const WORM_SEGMENTS = 12;
const WARMUP_TICKS = Number(process.env.DD_PERF_WARMUP_TICKS ?? 600);
const SAMPLE_TICKS = Number(process.env.DD_PERF_SAMPLE_TICKS ?? 2000);
const CAP_SAMPLE_TICKS = Number(process.env.DD_PERF_CAP_SAMPLE_TICKS ?? 1200);
const ATTR_SAMPLE_TICKS = Number(process.env.DD_PERF_ATTR_SAMPLE_TICKS ?? 1200);
// Qualification ("both zones + all six beam rows live after the step") is intermittent BY DESIGN:
// beams overheat, release, and cool on real cadence, so only ~4% of ticks qualify. 8x attempts can
// therefore never reach the 2000-sample target. Raise attempts to reach the sample count — do not
// lower the sample count, and never relax the qualification predicate itself.
const MAX_ATTEMPT_MULTIPLIER = Number(process.env.DD_PERF_MAX_ATTEMPT_MULTIPLIER ?? 8);

// The older audit already identified the installed encoder's 8 KiB overflow/re-encode path. Keep the
// steady-patch timing focused on dirty-state work; full-snapshot size is recorded separately below.
Encoder.BUFFER_SIZE = 64 * 1024;

const PLAYER_SPECS = [
  { id: "zone-poison", weapon: "x2-snakeoil-tincture-scepter", role: "zone" },
  { id: "zone-nether", weapon: "x2-gravewax-seance-globe", role: "zone" },
  { id: "pellet", weapon: "x2-gravelthroat-repeater", role: "attack" },
  { id: "six-beam", weapon: "x2-stormcaller-tesla-gatling", role: "beam" },
  { id: "blade-extension", weapon: "x2-rimewrit-grave-slab", role: "attack" },
];

const MIXED_ENEMY_KINDS = [
  "critter",
  "mote-swarm",
  "pricklepulp",
  "boothill",
  "ronin",
  "gatlin",
  "vault-ronin",
  "dust-ranger",
];

const PHASE_GROUPS = {
  "weapon: zones": ["stepPlayerGroundZone"],
  "weapon: beams": ["stepPlayerBeam", "stepActiveBeam"],
  "weapon: gun/pellet/burst": ["stepGunBurst", "fireGun", "emitScatterVolley"],
  "weapon: melee/hit-envelope": ["stepMeleeSwings", "resolveSwing"],
  "enemy: authored AI": ["stepDuelists", "stepSpitters"],
  "boss/worm": ["stepBoss"],
  projectiles: ["stepProjectiles"],
  "zones: world tick": ["stepZoners", "stepZones"],
  "collision/grid": ["rebuildEnemyGrid", "resolveEnemyCollisions"],
  "XP/receipts": ["stepXpEchoes"],
  ultimates: ["stepUltimates"],
};

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 0x1_0000_0000;
  };
}

function percentile(values, fraction) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(fraction * sorted.length) - 1));
  return sorted[index];
}

function summarize(values, digits = 6) {
  if (values.length === 0) return { samples: 0, mean: 0, p50: 0, p95: 0, p99: 0, max: 0 };
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const round = (value) => Number(value.toFixed(digits));
  return {
    samples: values.length,
    mean: round(mean),
    p50: round(percentile(values, 0.5)),
    p95: round(percentile(values, 0.95)),
    p99: round(percentile(values, 0.99)),
    max: round(Math.max(...values)),
  };
}

function snapshotEntities(room) {
  let friendlyProjectiles = 0;
  let hostileProjectiles = 0;
  room.state.projectiles.forEach((row) => {
    if (row.hostile) hostileProjectiles++;
    else friendlyProjectiles++;
  });
  return {
    players: room.state.players.size,
    enemyRows: room.state.enemies.size,
    effectiveEnemyBodies: room.effectiveEnemyBodies(),
    friendlyProjectiles,
    hostileProjectiles,
    beams: room.state.beams.size,
    zones: room.state.zones.size,
    telegraphs: room.state.telegraphs.size,
    xpEchoes: room.state.xpEchoes.size,
    wormActiveSegments: room.state.wormBoss?.active
      ? Number(room.state.wormBoss.activeMask ?? 0)
          .toString(2)
          .split("1").length - 1
      : 0,
  };
}

function updatePeaks(peaks, current) {
  for (const [key, value] of Object.entries(current)) peaks[key] = Math.max(peaks[key] ?? 0, value);
}

function encodedMessageBytes(type, payload) {
  const room = new ClientRoom("perf-wire");
  let bytes = 0;
  room.connection = {
    send(data) {
      bytes = data.byteLength;
    },
  };
  room.send(type, payload);
  return bytes;
}

function makeFakeClient(sessionId) {
  return { sessionId, send() {} };
}

function newestAddedKey(before, map) {
  for (const key of map.keys()) if (!before.has(key)) return key;
  return undefined;
}

function configurePlayer(room, spec, index, systemsEnabled, anchor) {
  const player = room.state.players.get(spec.id);
  const combat = room.combat.get(spec.id);
  const input = room.inputs.get(spec.id);
  if (!player || !combat || !input) throw new Error(`missing player runtime for ${spec.id}`);
  const weaponId = systemsEnabled ? spec.weapon : FISTS_WEAPON;
  if (!WEAPONS[weaponId]) throw new Error(`missing benchmark weapon ${weaponId}`);
  player.weapon = weaponId;
  player.weaponRarity = 0;
  player.weaponAffix = "";
  player.x = anchor.x - 120 + index * 58;
  player.y = anchor.y + (index % 2 === 0 ? -45 : 45);
  player.maxHp = 1_000_000;
  player.hp = player.maxHp;
  const slot = player.slots[player.activeSlot];
  if (slot) {
    slot.weapon = weaponId;
    slot.rarity = 0;
    slot.affix = "";
    slot.earned = false;
  }
  combat.lastWeapon = weaponId;
  combat.drawLock = 0;
  combat.cd = 0;
  combat.aimX = 1;
  combat.aimY = 0;
  combat.targetX = anchor.x + 260;
  combat.targetY = anchor.y;
  combat.drive.valueF = 100;
  input.held.aimX = 1;
  input.held.aimY = 0;
  input.held.targetX = combat.targetX;
  input.held.targetY = combat.targetY;
  return { player, combat, input };
}

function createScenario({ ordinaryEnemies, systemsEnabled, seed }) {
  const originalRandom = Math.random;
  Math.random = seededRandom(seed);
  try {
    const room = new GameRoom();
    const handlers = new Map();
    room.onMessage = (type, handler) => handlers.set(type, handler);
    room.setSimulationInterval = () => {};
    room.setPatchRate = () => {};
    room.broadcast = () => {};
    room.broadcastPatch = () => {};
    room.clients = [];
    room.roomId = `perf-${seed}`;
    room.onCreate({ dimensionId: "wild-west" });

    const clients = new Map();
    for (const spec of PLAYER_SPECS) {
      const client = makeFakeClient(spec.id);
      clients.set(spec.id, client);
      room.clients.push(client);
      room.onJoin(client);
    }
    room.state.mode = "training";
    room.state.outcome = "active";
    const first = room.state.players.get(PLAYER_SPECS[0].id);
    if (!first) throw new Error("benchmark anchor player missing");
    const anchor = { x: first.x, y: first.y };

    const runtimes = PLAYER_SPECS.map((spec, index) =>
      configurePlayer(room, spec, index, systemsEnabled, anchor),
    );

    room.spawnBoss("seam-eater", false);
    if (!room.state.wormBoss.active) throw new Error("Seam-Eater worm runtime did not activate");

    for (let index = 0; index < ordinaryEnemies; index++) {
      const kind = MIXED_ENEMY_KINDS[index % MIXED_ENEMY_KINDS.length];
      if (!ENEMY_KINDS[kind]) throw new Error(`missing enemy kind ${kind}`);
      const before = new Set(room.state.enemies.keys());
      room.debugSpawnOne(kind, index % 5 === 0, first);
      const id = newestAddedKey(before, room.state.enemies);
      if (!id) break;
      const enemy = room.state.enemies.get(id);
      if (!enemy) continue;
      const col = index % 12;
      const row = Math.floor(index / 12);
      enemy.x = anchor.x + 115 + col * 34;
      enemy.y = anchor.y - 150 + row * 58 + (col % 2) * 12;
      enemy.hp = 1_000_000_000;
    }
    room.rebuildEnemyGrid();

    const seqById = new Map(PLAYER_SPECS.map((spec) => [spec.id, 0]));
    let beamHold = systemsEnabled;
    const inputHandler = handlers.get("input");
    const attackHandler = handlers.get("attack");
    if (!inputHandler || !attackHandler)
      throw new Error("benchmark input handlers were not registered");

    function prepareTick() {
      room.state.outcome = "active";
      room.state.players.forEach((player, id) => {
        player.alive = true;
        player.hp = player.maxHp;
        const combat = room.combat.get(id);
        if (combat) {
          combat.drive.valueF = 100;
          combat.drive.recoveryDebtF = 0;
          combat.targetX = anchor.x + 260;
          combat.targetY = anchor.y;
          combat.aimX = 1;
          combat.aimY = 0;
        }
      });
      room.state.enemies.forEach((enemy) => {
        enemy.hp = Math.max(enemy.hp, 1_000_000_000);
      });

      if (systemsEnabled) {
        const beamCombat = room.combat.get("six-beam");
        if (!beamCombat) throw new Error("beam combat runtime missing");
        const locked = (beamCombat.drive.beamLockEndTick ?? 0) > room.state.tick;
        if (beamCombat.beamPhase >= 3 || beamCombat.drive.beamRequireRelease || locked)
          beamHold = false;
        else if (beamCombat.beamPhase === 0) beamHold = true;
      } else {
        beamHold = false;
      }

      for (const spec of PLAYER_SPECS) {
        const nextSeq = (seqById.get(spec.id) ?? 0) + 1;
        seqById.set(spec.id, nextSeq);
        inputHandler(clients.get(spec.id), {
          seq: nextSeq,
          dx: 0,
          dy: 0,
          jump: false,
          crouchHeld: false,
          pound: false,
          slide: false,
          slideHeld: false,
          fireHeld: systemsEnabled && (spec.role === "zone" || (spec.role === "beam" && beamHold)),
          aimX: 1,
          aimY: 0,
          targetX: anchor.x + 260,
          targetY: anchor.y,
        });
        if (systemsEnabled && spec.role === "attack") {
          attackHandler(clients.get(spec.id), {
            aimX: 1,
            aimY: 0,
            tx: anchor.x + 300,
            ty: anchor.y,
          });
        }
      }
    }

    function qualifies() {
      return !systemsEnabled || (room.state.zones.size >= 2 && room.state.beams.size >= 6);
    }

    const runtimeRandom = seededRandom(seed ^ 0x9e3779b9);
    function step() {
      const priorRandom = Math.random;
      Math.random = runtimeRandom;
      try {
        room.stepSim(TICK_SECONDS);
      } finally {
        Math.random = priorRandom;
      }
    }

    return { room, handlers, clients, runtimes, prepareTick, qualifies, step, anchor };
  } finally {
    Math.random = originalRandom;
  }
}

async function warmScenario(scenario, encoder, ticks) {
  for (let tick = 0; tick < ticks; tick++) {
    scenario.prepareTick();
    scenario.step();
    encoder.encode();
    encoder.discardChanges();
    if ((tick & 127) === 0) await new Promise((resolve) => setImmediate(resolve));
  }
}

async function runCleanBenchmark(config) {
  const scenario = createScenario(config);
  const encoder = new Encoder(scenario.room.state);
  const initialBytes = encoder.encodeAll().byteLength + 1;
  encoder.discardChanges();
  await warmScenario(scenario, encoder, WARMUP_TICKS);

  const tickMs = [];
  const encodeMs = [];
  const patchBytes = [];
  const entityPeaks = {};
  let attempted = 0;
  while (tickMs.length < config.samples && attempted < config.samples * MAX_ATTEMPT_MULTIPLIER) {
    attempted++;
    scenario.prepareTick();
    const tickStart = performance.now();
    scenario.step();
    const tickEnd = performance.now();
    const encodeStart = performance.now();
    const bytes = encoder.encode().byteLength + 1;
    const encodeEnd = performance.now();
    const qualifies = scenario.qualifies();
    if (qualifies) {
      tickMs.push(tickEnd - tickStart);
      encodeMs.push(encodeEnd - encodeStart);
      patchBytes.push(bytes);
      updatePeaks(entityPeaks, snapshotEntities(scenario.room));
    }
    encoder.discardChanges();
    if ((attempted & 127) === 0) await new Promise((resolve) => setImmediate(resolve));
  }
  if (tickMs.length < config.samples) {
    throw new Error(`collected ${tickMs.length}/${config.samples} qualifying ${config.name} ticks`);
  }
  const fullStateStart = performance.now();
  const fullStateBytes = encoder.encodeAll().byteLength + 1;
  const fullStateEncodeMs = performance.now() - fullStateStart;
  const patchSummary = summarize(patchBytes, 3);
  return {
    name: config.name,
    schemaVersion: scenario.room.state.schemaVersion,
    systemsEnabled: config.systemsEnabled,
    ordinaryEnemyTarget: config.ordinaryEnemies,
    attemptedTicks: attempted,
    qualifyingTicks: tickMs.length,
    warmupTicks: WARMUP_TICKS,
    tickMs: summarize(tickMs),
    patchEncodeMs: summarize(encodeMs),
    patchBytes: patchSummary,
    applicationBytesPerSecondPerClient: Number((patchSummary.mean * TICK_RATE).toFixed(1)),
    applicationMbitPerSecondRoom: Number(
      ((patchSummary.mean * TICK_RATE * PLAYER_SPECS.length * 8) / 1_000_000).toFixed(4),
    ),
    initialStateBytesBeforeWarmup: initialBytes,
    fullStateBytesAtMeasuredLoad: fullStateBytes,
    fullStateEncodeMs: Number(fullStateEncodeMs.toFixed(6)),
    entityPeaks,
  };
}

function installAttribution(room) {
  let current = {};
  const depth = {};
  const restore = [];
  for (const [category, methods] of Object.entries(PHASE_GROUPS)) {
    for (const method of methods) {
      const original = room[method];
      if (typeof original !== "function") continue;
      room[method] = function attributedMethod(...args) {
        depth[category] = (depth[category] ?? 0) + 1;
        const outermost = depth[category] === 1;
        const start = outermost ? performance.now() : 0;
        try {
          return original.apply(this, args);
        } finally {
          if (outermost) current[category] = (current[category] ?? 0) + performance.now() - start;
          depth[category]--;
        }
      };
      restore.push(() => {
        room[method] = original;
      });
    }
  }
  return {
    beginTick() {
      current = {};
    },
    endTick() {
      return { ...current };
    },
    restore() {
      for (const fn of restore.reverse()) fn();
    },
  };
}

async function runAttributionBenchmark() {
  const scenario = createScenario({
    name: "v7-heavy-attribution",
    ordinaryEnemies: 48,
    systemsEnabled: true,
    seed: 0x71d1e,
  });
  const encoder = new Encoder(scenario.room.state);
  encoder.encodeAll();
  encoder.discardChanges();
  await warmScenario(scenario, encoder, WARMUP_TICKS);
  const probe = installAttribution(scenario.room);
  const perCategory = Object.fromEntries(Object.keys(PHASE_GROUPS).map((key) => [key, []]));
  perCategory["inline movement/AI/contact/tail"] = [];
  const totals = [];
  let attempted = 0;
  // Same ~4% qualification rate as the clean heavy run, so this needs the same attempt headroom.
  while (
    totals.length < ATTR_SAMPLE_TICKS &&
    attempted < ATTR_SAMPLE_TICKS * Math.max(20, MAX_ATTEMPT_MULTIPLIER)
  ) {
    attempted++;
    scenario.prepareTick();
    probe.beginTick();
    const start = performance.now();
    scenario.step();
    const total = performance.now() - start;
    const phases = probe.endTick();
    encoder.encode();
    encoder.discardChanges();
    if (scenario.qualifies()) {
      totals.push(total);
      let attributed = 0;
      for (const category of Object.keys(PHASE_GROUPS)) {
        const value = phases[category] ?? 0;
        perCategory[category].push(value);
        attributed += value;
      }
      perCategory["inline movement/AI/contact/tail"].push(Math.max(0, total - attributed));
    }
    if ((attempted & 127) === 0) await new Promise((resolve) => setImmediate(resolve));
  }
  probe.restore();
  if (totals.length < ATTR_SAMPLE_TICKS) {
    const beam = scenario.room.combat.get("six-beam");
    throw new Error(
      `collected ${totals.length}/${ATTR_SAMPLE_TICKS} attribution ticks; ` +
        `entities=${JSON.stringify(snapshotEntities(scenario.room))}; ` +
        `beam=${JSON.stringify({ phase: beam?.beamPhase, requireRelease: beam?.drive?.beamRequireRelease, lockEndTick: beam?.drive?.beamLockEndTick, tick: scenario.room.state.tick })}`,
    );
  }
  const totalMean = summarize(totals).mean;
  const categories = Object.entries(perCategory)
    .map(([category, values]) => {
      const timing = summarize(values);
      return {
        category,
        ...timing,
        shareOfInstrumentedTickPercent: Number(((timing.mean / totalMean) * 100).toFixed(2)),
      };
    })
    .sort((a, b) => b.mean - a.mean);
  return {
    attemptedTicks: attempted,
    qualifyingTicks: totals.length,
    instrumentedTickMs: summarize(totals),
    categories,
    note: "Attribution uses instance-local performance.now wrappers; clean tick percentiles come from the unwrapped run.",
  };
}

function messageMeasurements() {
  const inputPayload = {
    seq: 1,
    dx: 0,
    dy: 0,
    jump: false,
    crouchHeld: false,
    pound: false,
    slide: false,
    slideHeld: false,
    fireHeld: true,
    aimX: 1,
    aimY: 0,
    targetX: 2600,
    targetY: 2400,
  };
  const attackPayload = { aimX: 1, aimY: 0, tx: 2700, ty: 2400 };
  const inputBytes = encodedMessageBytes("input", inputPayload);
  const attackBytes = encodedMessageBytes("attack", attackPayload);
  return {
    measuredPayloadBytesIncludingColyseusProtocol: { input: inputBytes, attack: attackBytes },
    workloadMessagesPerSecond: {
      totalInput: PLAYER_SPECS.length * TICK_RATE,
      totalAttackRequests: 2 * TICK_RATE,
      perPlayerInput: TICK_RATE,
      gunOrBladeOwnerTotal: TICK_RATE * 2,
    },
    perTickBudgetsPerPlayer: { input: INPUT_MSGS_PER_TICK, action: ACTION_MSGS_PER_TICK },
    budgetUtilizationPercent: {
      ordinaryPlayerInput: Number(((1 / INPUT_MSGS_PER_TICK) * 100).toFixed(1)),
      gunOrBladeOwnerAction: Number(((1 / ACTION_MSGS_PER_TICK) * 100).toFixed(1)),
    },
    estimatedInboundApplicationBytesPerSecond: {
      zoneOrBeamPlayer: inputBytes * TICK_RATE,
      gunOrBladePlayer: (inputBytes + attackBytes) * TICK_RATE,
      fivePlayerRoom: inputBytes * TICK_RATE * PLAYER_SPECS.length + attackBytes * TICK_RATE * 2,
    },
  };
}

async function main() {
  const startedAt = new Date().toISOString();
  const cpus = os.cpus();
  const idle = await runCleanBenchmark({
    name: "same-population-idle-ablation",
    ordinaryEnemies: 48,
    systemsEnabled: false,
    seed: 0x71d1e,
    samples: SAMPLE_TICKS,
  });
  const heavy = await runCleanBenchmark({
    name: "v7-simultaneous-heavy",
    ordinaryEnemies: 48,
    systemsEnabled: true,
    seed: 0x71d1e,
    samples: SAMPLE_TICKS,
  });
  const capPressure = await runCleanBenchmark({
    name: "v7-wave2-enemy-cap-pressure",
    ordinaryEnemies: 80,
    systemsEnabled: true,
    seed: 0x71c4f,
    samples: CAP_SAMPLE_TICKS,
  });
  const attribution = await runAttributionBenchmark();

  const result = {
    schemaVersion: heavy.schemaVersion,
    measuredAt: startedAt,
    runtime: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      cpuModel: cpus[0]?.model ?? "unknown",
      logicalCpus: cpus.length,
      totalMemoryGiB: Number((os.totalmem() / 1024 ** 3).toFixed(2)),
      gitHead: execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: REPO_ROOT,
        encoding: "utf8",
      }).trim(),
      tickRateHz: TICK_RATE,
      tickBudgetMs: 1000 / TICK_RATE,
    },
    methodology: {
      workloadPlayers: PLAYER_SPECS,
      ordinaryEnemyKinds: MIXED_ENEMY_KINDS,
      wormBoss: "seam-eater",
      warmupTicks: WARMUP_TICKS,
      sampleTicks: SAMPLE_TICKS,
      activeSampleLaw:
        "V7 samples require >=2 zones and >=6 authoritative beam rows after the exact logical step.",
      patchLaw:
        "Installed Colyseus Encoder; one protocol byte added; dirty changes discarded after every patch.",
    },
    caps: {
      players: MAX_PLAYERS,
      effectiveEnemyBodies: MAX_ENEMIES,
      hostileProjectiles: BOSS_PROJECTILE_BUDGET,
      friendlyProjectiles: FRIENDLY_PROJECTILE_ENTITY_CAP,
      friendlyBeams: FRIENDLY_BEAM_ENTITY_CAP,
      zones: ZONE_CAP,
      wormSegments: WORM_SEGMENTS,
    },
    messages: messageMeasurements(),
    scenarios: { idle, heavy, capPressure },
    attribution,
    deltas: {
      heavyMinusIdleTickMeanMs: Number((heavy.tickMs.mean - idle.tickMs.mean).toFixed(6)),
      heavyMinusIdleTickP95Ms: Number((heavy.tickMs.p95 - idle.tickMs.p95).toFixed(6)),
      heavyMinusIdlePatchMeanBytes: Number(
        (heavy.patchBytes.mean - idle.patchBytes.mean).toFixed(3),
      ),
      heavyMinusIdleBytesPerSecondPerClient: Number(
        (
          heavy.applicationBytesPerSecondPerClient - idle.applicationBytesPerSecondPerClient
        ).toFixed(1),
      ),
    },
  };
  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

await main();
