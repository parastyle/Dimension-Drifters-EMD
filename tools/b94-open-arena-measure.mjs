import { performance } from "node:perf_hooks";

import { generateArena, getDimension, TICK_MS } from "@dd/shared";
import { buildArenaFloor, drawArena } from "../packages/client/src/scenes/arena/floor-renderer.ts";
import { GameRoom } from "../packages/server/src/rooms/GameRoom.ts";

const OLD_SIZE = 4_800;
const OPEN_SIZE = 38_400;
const SEEDS = {
  seedTerrain: 0x9e3779b9,
  seedHazard: 0x85ebca6b,
  seedTheme: 0xc2b2ae35,
  seedDecor: 0x27d4eb2f,
};
const MAPGEN_SAMPLES = 30;
const FLOOR_SAMPLES = 30;
const SPAWN_TRIALS = 20;
const SPAWN_SECONDS = 60;
const VIEW_HALF_WIDTH = 640;
const VIEW_HALF_HEIGHT = 360;

function round(value, digits = 6) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function summary(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const quantile = (fraction) => sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] ?? 0;
  return {
    minMs: round(sorted[0] ?? 0),
    medianMs: round(quantile(0.5)),
    p95Ms: round(quantile(0.95)),
    maxMs: round(sorted.at(-1) ?? 0),
    samples: values.length,
  };
}

function measureMapgen(size) {
  for (let warmup = 0; warmup < 5; warmup++) generateArena(SEEDS, size, size);
  const samples = [];
  for (let index = 0; index < MAPGEN_SAMPLES; index++) {
    const started = performance.now();
    const map = generateArena(
      {
        seedTerrain: (SEEDS.seedTerrain + index) >>> 0,
        seedHazard: (SEEDS.seedHazard + index * 17) >>> 0,
        seedTheme: (SEEDS.seedTheme + index * 31) >>> 0,
        seedDecor: (SEEDS.seedDecor + index * 47) >>> 0,
      },
      size,
      size,
    );
    samples.push(performance.now() - started);
    if (map.tiles.length !== (size / map.tileSize) ** 2)
      throw new Error(`unexpected ${size}px map allocation`);
  }
  return summary(samples);
}

function makeFloorScene() {
  const calls = [];
  const generatedTextures = [];
  const gameObject = {
    setDepth() {
      return this;
    },
    setStrokeStyle() {
      return this;
    },
    setDisplaySize() {
      return this;
    },
    setScale() {
      return this;
    },
    setRotation() {
      return this;
    },
    setAlpha() {
      return this;
    },
    lineStyle() {
      return this;
    },
    strokeCircle() {
      return this;
    },
    once() {
      return this;
    },
    tileScaleX: 1,
    tileScaleY: 1,
  };
  const addCall = (kind, width, height, key) => {
    calls.push({ kind, width, height, key });
    return { ...gameObject };
  };
  return {
    calls,
    generatedTextures,
    scene: {
      add: {
        rectangle(_x, _y, width, height) {
          return addCall("rectangle", width, height);
        },
        tileSprite(_x, _y, width, height, key) {
          return addCall("tileSprite", width, height, key);
        },
        grid(_x, _y, width, height) {
          return addCall("grid", width, height);
        },
        image(_x, _y, key) {
          return addCall("image", undefined, undefined, key);
        },
        graphics() {
          return addCall("graphics");
        },
      },
      textures: {
        exists() {
          return true;
        },
        remove() {},
        createCanvas(key, width, height) {
          generatedTextures.push({ key, width, height });
          return {
            getContext() {
              return {
                clearRect() {},
                fillStyle: "",
                globalAlpha: 1,
                beginPath() {},
                arc() {},
                fill() {},
              };
            },
            refresh() {},
          };
        },
      },
    },
  };
}

function measureFloor(size) {
  const map = generateArena(SEEDS, size, size);
  const palette = getDimension("wild-west").palette;
  const drawSamples = [];
  const buildSamples = [];
  let evidence;
  for (let index = 0; index < FLOOR_SAMPLES; index++) {
    const mock = makeFloorScene();
    let started = performance.now();
    const drawn = drawArena(mock.scene, map, () => true, palette);
    drawSamples.push(performance.now() - started);
    started = performance.now();
    const built = buildArenaFloor(mock.scene, map, "wild-west", palette);
    buildSamples.push(performance.now() - started);
    evidence = {
      drawObjects: drawn.length,
      buildObjects: built.length,
      objectKinds: Object.fromEntries(
        [...new Set(mock.calls.map((call) => call.kind))].map((kind) => [
          kind,
          mock.calls.filter((call) => call.kind === kind).length,
        ]),
      ),
      repeatedTileSprites: mock.calls.filter((call) => call.kind === "tileSprite").length,
      generatedTextures: mock.generatedTextures,
      peakGeneratedTexturePixels: Math.max(
        0,
        ...mock.generatedTextures.map((texture) => texture.width * texture.height),
      ),
    };
  }
  return {
    draw: summary(drawSamples),
    build: summary(buildSamples),
    ...evidence,
  };
}

function makeRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function makeFakeClient(sessionId) {
  return {
    sessionId,
    state: 1,
    send() {},
    error() {},
    leave() {},
    raw() {},
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

function spawnTrial(size, seed) {
  const originalRandom = Math.random;
  Math.random = makeRandom(seed);
  try {
    const room = new GameRoom();
    room.__init();
    room.roomId = `b94-spawn-${size}-${seed}`;
    room.setSimulationInterval = () => {};
    room.setPatchRate = () => {};
    room.broadcast = () => {};
    withMutedConsole(() => room.onCreate({ dimensionId: "wild-west" }));

    room.map = generateArena(SEEDS, size, size);
    const client = makeFakeClient("spawn-sample-player");
    room.clients.push(client);
    withMutedConsole(() => room.onJoin(client));
    room.state.mode = "arena";
    room.state.outcome = "active";
    room.state.paused = false;
    room.shifterCd = Number.POSITIVE_INFINITY;
    room.bossSpawned = true;
    room.spawnAccum = 0;

    const player = room.state.players.get(client.sessionId);
    const centre = size / 2;
    player.x = centre;
    player.y = centre;
    player.hp = 1_000_000_000;
    player.maxHp = 1_000_000_000;

    let visibleTotal = 0;
    let visibleMax = 0;
    const ticks = Math.round((SPAWN_SECONDS * 1_000) / TICK_MS);
    for (let tick = 0; tick < ticks; tick++) {
      room.stepSim(TICK_MS / 1_000);
      player.x = centre;
      player.y = centre;
      player.hp = 1_000_000_000;
      player.alive = true;
      room.state.outcome = "active";
      let visible = 0;
      room.state.enemies.forEach((enemy) => {
        if (
          Math.abs(enemy.x - centre) <= VIEW_HALF_WIDTH &&
          Math.abs(enemy.y - centre) <= VIEW_HALF_HEIGHT
        )
          visible++;
      });
      visibleTotal += visible;
      visibleMax = Math.max(visibleMax, visible);
    }
    return {
      meanVisible: visibleTotal / ticks,
      maxVisible: visibleMax,
      finalEnemies: room.state.enemies.size,
    };
  } finally {
    Math.random = originalRandom;
  }
}

function measureSpawnDensity(size) {
  const trials = [];
  for (let trial = 0; trial < SPAWN_TRIALS; trial++)
    trials.push(spawnTrial(size, (0xb94_0000 + trial * 0x9e37) >>> 0));
  const meanVisible = trials.map((trial) => trial.meanVisible);
  const finalEnemies = trials.map((trial) => trial.finalEnemies);
  return {
    seconds: SPAWN_SECONDS,
    trials: SPAWN_TRIALS,
    viewportPx: [VIEW_HALF_WIDTH * 2, VIEW_HALF_HEIGHT * 2],
    meanVisible: round(meanVisible.reduce((sum, value) => sum + value, 0) / trials.length),
    minTrialMeanVisible: round(Math.min(...meanVisible)),
    maxTrialMeanVisible: round(Math.max(...meanVisible)),
    maxVisible: Math.max(...trials.map((trial) => trial.maxVisible)),
    meanFinalEnemies: round(finalEnemies.reduce((sum, value) => sum + value, 0) / trials.length),
  };
}

console.error("b94: measuring map generation");
const mapgen = {
  [OLD_SIZE]: measureMapgen(OLD_SIZE),
  [OPEN_SIZE]: measureMapgen(OPEN_SIZE),
};
console.error("b94: measuring floor construction");
const floor = {
  [OLD_SIZE]: measureFloor(OLD_SIZE),
  [OPEN_SIZE]: measureFloor(OPEN_SIZE),
};
console.error("b94: measuring 4,800px spawn density");
const oldSpawnDensity = measureSpawnDensity(OLD_SIZE);
console.error("b94: measuring 38,400px spawn density");
const openSpawnDensity = measureSpawnDensity(OPEN_SIZE);

const result = {
  methodology: {
    mapgen: `${MAPGEN_SAMPLES} seeded generations after 5 warmups`,
    floor: `${FLOOR_SAMPLES} mock Phaser object-factory builds; shared textures reported separately`,
    spawn:
      `${SPAWN_TRIALS} deterministic 60s stationary-player authoritative simulations at 20Hz; ` +
      "player pinned to map centre, 1280x720 world viewport",
  },
  mapgen,
  floor,
  spawnDensity: {
    [OLD_SIZE]: oldSpawnDensity,
    [OPEN_SIZE]: openSpawnDensity,
  },
};

const oldDensity = result.spawnDensity[OLD_SIZE].meanVisible;
const openDensity = result.spawnDensity[OPEN_SIZE].meanVisible;
result.spawnDensity.percentChange = round(((openDensity - oldDensity) / oldDensity) * 100);

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`, () => process.exit(0));
