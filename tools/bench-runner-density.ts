import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  ENEMY_KINDS,
  EnemyState,
  PlayerState,
  TICK_MS,
} from "@dd/shared";
import { GameRoom } from "../packages/server/src/rooms/GameRoom.js";

const WARMUP_TICKS = 20;
const SAMPLE_TICKS = 40;
const COUNTS = [
  50,
  100,
  200,
  400,
  800,
  1_600,
  3_200,
  6_400,
  12_800,
  25_600,
  32_000,
  38_400,
  44_800,
  48_000,
  51_200,
  102_400,
] as const;

function percentile(sorted: readonly number[], fraction: number): number {
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1));
  return sorted[index] ?? 0;
}

function roomWithRunners(count: number): GameRoom {
  const room = new GameRoom();
  room.setSimulationInterval = (() => undefined) as typeof room.setSimulationInterval;
  room.roomId = `runner-density-${count}`;
  room.onCreate({ dimensionId: "wild-west" });
  const internals = room as unknown as {
    map: { spawnX: number; spawnY: number };
    updateEnemyGrid(id: string, enemy: EnemyState): void;
  };
  const player = new PlayerState();
  player.id = "benchmark-target";
  player.alive = true;
  player.maxHp = 1_000_000;
  player.hp = player.maxHp;
  player.x = internals.map.spawnX;
  player.y = internals.map.spawnY;
  room.state.players.set(player.id, player);

  const columns = Math.max(1, Math.ceil(Math.sqrt(count)));
  for (let index = 0; index < count; index++) {
    const enemy = new EnemyState();
    enemy.id = `runner-${index}`;
    enemy.kind = "critter";
    enemy.appearanceId = "proto-frost-rune-guardian";
    enemy.hp = ENEMY_KINDS.critter?.hp ?? 3;
    const column = index % columns;
    const row = Math.floor(index / columns);
    enemy.x = Math.min(ARENA_WIDTH - 20, 1_000 + column * 22);
    enemy.y = Math.min(ARENA_HEIGHT - 20, 1_000 + row * 22);
    room.state.enemies.set(enemy.id, enemy);
    internals.updateEnemyGrid(enemy.id, enemy);
  }
  return room;
}

const results: Array<{
  count: number;
  meanMs: number;
  p50Ms: number;
  p95Ms: number;
  microsecondsPerRunner: number;
  rawMs: number[];
}> = [];

for (const count of COUNTS) {
  const room = roomWithRunners(count);
  const internals = room as unknown as {
    stepDuelists(dt: number, bodies: Array<{ x: number; y: number }>): void;
  };
  const target = room.state.players.get("benchmark-target");
  if (!target) throw new Error("benchmark target missing");
  const bodies = [target];
  for (let tick = 0; tick < WARMUP_TICKS; tick++) internals.stepDuelists(TICK_MS / 1_000, bodies);
  const rawMs: number[] = [];
  for (let tick = 0; tick < SAMPLE_TICKS; tick++) {
    const started = performance.now();
    internals.stepDuelists(TICK_MS / 1_000, bodies);
    rawMs.push(performance.now() - started);
  }
  const sorted = [...rawMs].sort((a, b) => a - b);
  const meanMs = rawMs.reduce((sum, value) => sum + value, 0) / rawMs.length;
  results.push({
    count,
    meanMs,
    p50Ms: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
    microsecondsPerRunner: (meanMs * 1_000) / count,
    rawMs,
  });
  if (percentile(sorted, 0.95) > TICK_MS) break;
}

const firstBreak = results.find((row) => row.p95Ms > TICK_MS);
const lastSustainable = [...results].reverse().find((row) => row.p95Ms <= TICK_MS);
console.log(
  JSON.stringify(
    {
      benchmark: "GameRoom.stepDuelists Runner AI",
      tickBudgetMs: TICK_MS,
      warmupTicks: WARMUP_TICKS,
      sampleTicks: SAMPLE_TICKS,
      lastSustainableCount: lastSustainable?.count ?? 0,
      firstBreakCount: firstBreak?.count ?? null,
      results,
    },
    null,
    2,
  ),
);
process.exit(0);
