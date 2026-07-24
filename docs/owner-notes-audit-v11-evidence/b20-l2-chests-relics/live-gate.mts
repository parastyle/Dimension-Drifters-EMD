import { writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import {
  type ArenaMap,
  type ArenaState,
  CHEST_OPEN_RADIUS,
  type ChestState,
  COMMON_RELIC_DEFS,
  commonRelicStacks,
  dodgeProfileFor,
  EMPTY_RELIC_STACKS,
  ENEMY_KINDS,
  generateArena,
  isArenaDiscSafe,
  MAP_ZONE_COMMONS,
  MAP_ZONE_SCAR,
  PLAYER_RADIUS,
  type PlayerState,
  RARE_RELIC_DEFS,
  ROLL_DURATION_TICKS,
  ROOM_NAME,
} from "@dd/shared";

const requireFromWorkspace = createRequire(
  `${process.cwd()}/node_modules/.pnpm/node_modules/b20-l2-live-gate.cjs`,
);
const { Client } = requireFromWorkspace("colyseus.js") as typeof import("colyseus.js");

const endpoint = process.argv[2] ?? "ws://127.0.0.1:55109";
const outputPath =
  process.argv[3] ??
  "docs/owner-notes-audit-v11-evidence/b20-l2-chests-relics/live-observations.json";
const MIN_RUN_MS = 165_000;
const MAX_RUN_MS = 360_000;
const STEP_MS = 50;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const zoneName = (zone: number) =>
  zone === MAP_ZONE_SCAR ? "scar" : zone === MAP_ZONE_COMMONS ? "commons" : "cover";

interface Receipt {
  playerId: string;
  atMs: number;
  payload: {
    chestId: string;
    zone: number;
    kind: number;
    weapon?: { id: string; name: string; tier: string };
    relics: Array<{ id: string; rarity: string; label: string; stacks: number }>;
    money: number;
  };
}

interface LiveRoom {
  sessionId: string;
  roomId: string;
  state: ArenaState;
  send(type: string, payload?: unknown): void;
  leave(): Promise<unknown>;
  onMessage(type: string, callback: (payload: unknown) => void): unknown;
}

const startedAt = Date.now();
const receipts: Receipt[] = [];
const rareTriggers: Array<{ playerId: string; payload: unknown; atMs: number }> = [];
const denials: Array<{ playerId: string; payload: unknown; atMs: number }> = [];
const errors: string[] = [];
const rooms: LiveRoom[] = [];
const inputSeq = new Map<string, number>();

async function waitUntil(
  predicate: () => boolean,
  timeoutMs: number,
  label: string,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await sleep(25);
  }
  throw new Error(`${label} timed out after ${timeoutMs}ms`);
}

for (let index = 0; index < 2; index++) {
  const client = new Client(endpoint);
  const room = (await client.joinOrCreate(ROOM_NAME, {
    belt: false,
    beltLevel: "",
    dimensionId: "wild-west",
    bossRush: false,
    selectedCharacterId: "proto-cowboy-hidden-face",
  })) as unknown as LiveRoom;
  rooms.push(room);
  inputSeq.set(room.sessionId, 0);
  room.onMessage("chestOpened", (payload) => {
    receipts.push({
      playerId: room.sessionId,
      atMs: Date.now() - startedAt,
      payload: payload as Receipt["payload"],
    });
  });
  room.onMessage("relicTriggered", (payload) => {
    rareTriggers.push({ playerId: room.sessionId, payload, atMs: Date.now() - startedAt });
  });
  room.onMessage("chestOpenDenied", (payload) => {
    denials.push({ playerId: room.sessionId, payload, atMs: Date.now() - startedAt });
  });
}

const leader = rooms[0];
if (!leader) throw new Error("live gate requires a leader room");
await waitUntil(
  () =>
    leader.state?.schemaVersion === 35 &&
    leader.state.players?.size === rooms.length &&
    rooms.every((room) => leader.state.players.has(room.sessionId)),
  10_000,
  "two-player schema-35 handshake",
);

const map = generateArena({
  seedTerrain: leader.state.seedTerrain,
  seedHazard: leader.state.seedHazard,
  seedTheme: leader.state.seedTheme,
  seedDecor: leader.state.seedDecor,
});

function safeCell(mapValue: ArenaMap, col: number, row: number): boolean {
  if (col < 0 || row < 0 || col >= mapValue.cols || row >= mapValue.rows) return false;
  return isArenaDiscSafe(
    mapValue,
    (col + 0.5) * mapValue.tileSize,
    (row + 0.5) * mapValue.tileSize,
    PLAYER_RADIUS,
  );
}

function tilePath(
  mapValue: ArenaMap,
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
): Array<{ x: number; y: number }> {
  const startCol = Math.max(0, Math.min(mapValue.cols - 1, Math.floor(startX / mapValue.tileSize)));
  const startRow = Math.max(0, Math.min(mapValue.rows - 1, Math.floor(startY / mapValue.tileSize)));
  const targetCol = Math.max(
    0,
    Math.min(mapValue.cols - 1, Math.floor(targetX / mapValue.tileSize)),
  );
  const targetRow = Math.max(
    0,
    Math.min(mapValue.rows - 1, Math.floor(targetY / mapValue.tileSize)),
  );
  const total = mapValue.cols * mapValue.rows;
  const previous = new Int32Array(total);
  previous.fill(-2);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;
  const start = startRow * mapValue.cols + startCol;
  const target = targetRow * mapValue.cols + targetCol;
  previous[start] = -1;
  queue[tail++] = start;
  const directions = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;
  while (head < tail && previous[target] === -2) {
    const current = queue[head++];
    const col = current % mapValue.cols;
    const row = Math.floor(current / mapValue.cols);
    for (const [dc, dr] of directions) {
      const nextCol = col + dc;
      const nextRow = row + dr;
      if (!safeCell(mapValue, nextCol, nextRow)) continue;
      const next = nextRow * mapValue.cols + nextCol;
      if (previous[next] !== -2) continue;
      previous[next] = current;
      queue[tail++] = next;
    }
  }
  if (previous[target] === -2) throw new Error("no safe tile path to synchronized chest");
  const reversed: Array<{ x: number; y: number }> = [];
  for (let cursor = target; cursor >= 0; cursor = previous[cursor]) {
    const col = cursor % mapValue.cols;
    const row = Math.floor(cursor / mapValue.cols);
    reversed.push({
      x: (col + 0.5) * mapValue.tileSize,
      y: (row + 0.5) * mapValue.tileSize,
    });
  }
  return reversed.reverse();
}

function sendInput(room: LiveRoom, dx: number, dy: number, slide = false): number {
  const seq = ((inputSeq.get(room.sessionId) ?? 0) + 1) >>> 0;
  inputSeq.set(room.sessionId, seq);
  room.send("input", {
    seq,
    dx,
    dy,
    jump: false,
    crouchHeld: false,
    pound: false,
    slide,
    slideHeld: slide,
    fireHeld: false,
    aimX: dx || 1,
    aimY: dy,
    targetX: 0,
    targetY: 0,
  });
  return seq;
}

async function driveToChest(room: LiveRoom, chestId: string): Promise<boolean> {
  const deadline = Date.now() + 55_000;
  let path: Array<{ x: number; y: number }> = [];
  let waypoint = 0;
  let lastPathAt = 0;
  while (Date.now() < deadline) {
    const player = room.state.players.get(room.sessionId) as PlayerState | undefined;
    const chest = room.state.chests.get(chestId) as ChestState | undefined;
    if (!player?.alive) return false;
    if (!chest) throw new Error(`${room.sessionId} lost synchronized chest ${chestId}`);
    const remaining = Math.hypot(chest.x - player.x, chest.y - player.y);
    if (remaining <= CHEST_OPEN_RADIUS - 32) {
      sendInput(room, 0, 0);
      return true;
    }
    if (path.length === 0 || Date.now() - lastPathAt >= 1_500) {
      path = tilePath(map, player.x, player.y, chest.x, chest.y);
      waypoint = Math.min(1, path.length - 1);
      lastPathAt = Date.now();
    }
    let currentWaypoint = path[waypoint];
    while (
      currentWaypoint &&
      waypoint < path.length - 1 &&
      Math.hypot(currentWaypoint.x - player.x, currentWaypoint.y - player.y) < 30
    ) {
      waypoint++;
      currentWaypoint = path[waypoint];
    }
    const target = waypoint >= path.length - 1 ? chest : (path[waypoint] ?? chest);
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const length = Math.hypot(dx, dy) || 1;
    sendInput(room, dx / length, dy / length);
    room.send("attack", {
      aimX: dx / length,
      aimY: dy / length,
      targetX: target.x,
      targetY: target.y,
    });
    room.send("parry");
    await sleep(STEP_MS);
  }
  throw new Error(`${room.sessionId} did not reach ${chestId}`);
}

function compactRelicHud(player: PlayerState): string[] {
  const relicState = player.dualWield?.relics ?? EMPTY_RELIC_STACKS;
  const common = COMMON_RELIC_DEFS.flatMap((def) => {
    const count = commonRelicStacks(relicState, def.id);
    return count > 0 ? [`${def.hud}×${count}`] : [];
  });
  const rare = (player.dualWield?.relics?.ownedRare ?? "").split(",").flatMap((id) => {
    const def = RARE_RELIC_DEFS.find((candidate) => candidate.id === id);
    return def ? [def.hud] : [];
  });
  return [...common, ...rare];
}

const observedSpawns: Array<{
  id: string;
  tick: number;
  kind: number;
  zone: number;
  zoneName: string;
  x: number;
  y: number;
  validGround: boolean;
}> = [];
const processed = new Set<string>();
let dodgeAction:
  | {
      playerId: string;
      relicId: string;
      profile: ReturnType<typeof dodgeProfileFor>;
      start: { x: number; y: number; ackSeq: number };
      end: { x: number; y: number; ackSeq: number };
      sharedRollTicks: number;
    }
  | undefined;
const openContinuity: Array<{
  chestId: string;
  playerId: string;
  ackBefore: number;
  ackAfter: number;
  outcome: string;
}> = [];
let idleCombatBeat = 0;

console.log(
  `[live-gate] room=${leader.roomId} players=${rooms.map((room) => room.sessionId).join(",")}`,
);
for (const room of rooms) {
  for (let index = 0; index < 40; index++) {
    const player = room.state.players.get(room.sessionId) as PlayerState;
    if (player.weapon === "x-sword-bone") break;
    room.send("cycleWeapon", { dir: 1 });
    await sleep(60);
  }
}

try {
  while (Date.now() - startedAt < MAX_RUN_MS) {
    if (leader.state.outcome !== "active") {
      throw new Error(`run became ${leader.state.outcome} before the live-gate contract completed`);
    }
    for (const chest of leader.state.chests.values() as Iterable<ChestState>) {
      if (!observedSpawns.some((row) => row.id === chest.id)) {
        const row = {
          id: chest.id,
          tick: chest.spawnTick,
          kind: chest.kind,
          zone: chest.zone,
          zoneName: zoneName(chest.zone),
          x: chest.x,
          y: chest.y,
          validGround: isArenaDiscSafe(map, chest.x, chest.y, 24),
        };
        observedSpawns.push(row);
        console.log(
          `[live-gate] spawn ${row.id} zone=${row.zoneName} kind=${row.kind} tick=${row.tick}`,
        );
      }
    }

    const nextChest = [...leader.state.chests.values()]
      .filter((chest) => !processed.has(chest.id))
      .sort((a, b) => a.spawnTick - b.spawnTick)[0] as ChestState | undefined;
    if (nextChest) {
      processed.add(nextChest.id);
      const routeResults = await Promise.all(rooms.map((room) => driveToChest(room, nextChest.id)));
      const openers = rooms.filter((_room, index) => routeResults[index]);
      if (openers.length < 2) {
        throw new Error(`fewer than two living co-op openers reached ${nextChest.id}`);
      }
      const before = openers.map((room) => ({
        room,
        player: room.state.players.get(room.sessionId) as PlayerState,
      }));
      for (const row of before) {
        const ackBefore = row.player.ackSeq;
        row.room.send("openChest", { chestId: nextChest.id });
        await waitUntil(
          () =>
            receipts.some(
              (receipt) =>
                receipt.playerId === row.room.sessionId && receipt.payload.chestId === nextChest.id,
            ) || denials.some((denial) => denial.playerId === row.room.sessionId),
          3_000,
          `open receipt for ${row.room.sessionId}`,
        );
        if (denials.some((denial) => denial.playerId === row.room.sessionId)) {
          throw new Error(`${row.room.sessionId} received chestOpenDenied`);
        }
        sendInput(row.room, 1, 0);
        await sleep(100);
        const ackAfter = (row.room.state.players.get(row.room.sessionId) as PlayerState).ackSeq;
        openContinuity.push({
          chestId: nextChest.id,
          playerId: row.room.sessionId,
          ackBefore,
          ackAfter,
          outcome: row.room.state.outcome,
        });
      }
      await waitUntil(
        () =>
          openers.every((room) =>
            receipts.some(
              (receipt) =>
                receipt.playerId === room.sessionId && receipt.payload.chestId === nextChest.id,
            ),
          ),
        5_000,
        `instanced receipts for ${nextChest.id}`,
      );
      console.log(
        `[live-gate] opened ${nextChest.id} receipts=${receipts.filter((row) => row.payload.chestId === nextChest.id).length}`,
      );

      if (!dodgeAction) {
        const owner = openers.find((room) => {
          const player = room.state.players.get(room.sessionId) as PlayerState;
          return dodgeProfileFor(player.dualWield?.relics?.activeDodge).id !== "";
        });
        if (owner) {
          const player = owner.state.players.get(owner.sessionId) as PlayerState;
          const relicState = player.dualWield?.relics ?? EMPTY_RELIC_STACKS;
          const profile = dodgeProfileFor(relicState.activeDodge);
          const start = { x: player.x, y: player.y, ackSeq: player.ackSeq };
          sendInput(owner, 1, 0, true);
          for (let tick = 0; tick < ROLL_DURATION_TICKS + 2; tick++) {
            await sleep(STEP_MS);
            sendInput(owner, 1, 0, false);
          }
          const ended = owner.state.players.get(owner.sessionId) as PlayerState;
          dodgeAction = {
            playerId: owner.sessionId,
            relicId: relicState.activeDodge ?? "",
            profile,
            start,
            end: { x: ended.x, y: ended.y, ackSeq: ended.ackSeq },
            sharedRollTicks: ROLL_DURATION_TICKS,
          };
          console.log(
            `[live-gate] dodge ${profile.label} distance=${Math.hypot(ended.x - start.x, ended.y - start.y).toFixed(1)}`,
          );
        }
      }
    } else {
      for (const room of rooms) {
        const player = room.state.players.get(room.sessionId) as PlayerState | undefined;
        if (!player?.alive) continue;
        let nearest: { x: number; y: number; distance2: number } | undefined;
        for (const enemy of room.state.enemies.values()) {
          if (ENEMY_KINDS[enemy.kind]?.archetype === "boss") continue;
          const dx = enemy.x - player.x;
          const dy = enemy.y - player.y;
          const distance2 = dx * dx + dy * dy;
          if (!nearest || distance2 < nearest.distance2) {
            nearest = { x: enemy.x, y: enemy.y, distance2 };
          }
        }
        const towardX = nearest ? nearest.x - player.x : Math.cos(idleCombatBeat / 20);
        const towardY = nearest ? nearest.y - player.y : Math.sin(idleCombatBeat / 20);
        const length = Math.hypot(towardX, towardY) || 1;
        sendInput(room, 0, 0);
        if (nearest) {
          room.send("attack", {
            aimX: towardX / length,
            aimY: towardY / length,
            targetX: nearest.x,
            targetY: nearest.y,
          });
        }
        room.send("parry");
      }
      idleCombatBeat++;
    }

    const zones = new Set(observedSpawns.map((spawn) => spawn.zone));
    const categories = {
      weapon: receipts.some((receipt) => !!receipt.payload.weapon),
      relic: receipts.some((receipt) => receipt.payload.relics.length > 0),
      money: receipts.some((receipt) => receipt.payload.money > 0),
    };
    if (
      Date.now() - startedAt >= MIN_RUN_MS &&
      zones.has(MAP_ZONE_COMMONS) &&
      zones.has(MAP_ZONE_SCAR) &&
      categories.weapon &&
      categories.relic &&
      categories.money &&
      dodgeAction
    ) {
      break;
    }
    await sleep(100);
  }
} catch (error) {
  errors.push(error instanceof Error ? (error.stack ?? error.message) : String(error));
}

const finalPlayers = rooms.map((room) => {
  const player = room.state.players.get(room.sessionId) as PlayerState | undefined;
  return {
    id: room.sessionId,
    character: player?.character,
    alive: player?.alive,
    activeDodge: player?.dualWield?.relics?.activeDodge ?? "",
    ownedRare: player?.dualWield?.relics?.ownedRare ?? "",
    hudRow: player ? compactRelicHud(player) : [],
    scrip: player?.scrip,
  };
});
const observations = {
  endpoint,
  roomId: leader.roomId,
  schemaVersion: leader.state.schemaVersion,
  durationSeconds: Number(((Date.now() - startedAt) / 1_000).toFixed(2)),
  mapSeeds: {
    terrain: leader.state.seedTerrain,
    hazard: leader.state.seedHazard,
    theme: leader.state.seedTheme,
    decor: leader.state.seedDecor,
  },
  characterContract: finalPlayers.map((player) => ({
    id: player.id,
    character: player.character,
  })),
  chestSpawns: observedSpawns,
  receipts,
  perPlayerInstancing: observedSpawns.map((spawn) => ({
    chestId: spawn.id,
    openerIds: receipts
      .filter((receipt) => receipt.payload.chestId === spawn.id)
      .map((receipt) => receipt.playerId),
  })),
  categoriesObserved: {
    weapon: receipts.some((receipt) => !!receipt.payload.weapon),
    relic: receipts.some((receipt) => receipt.payload.relics.length > 0),
    money: receipts.some((receipt) => receipt.payload.money > 0),
  },
  zonesObserved: [...new Set(observedSpawns.map((spawn) => spawn.zoneName))],
  weaponCacheTicks: observedSpawns.filter((spawn) => spawn.kind === 1).map((spawn) => spawn.tick),
  finalPlayers,
  dodgeAction,
  openContinuity,
  rareTriggers,
  denials,
  errors,
};

await writeFile(outputPath, `${JSON.stringify(observations, null, 2)}\n`, "utf8");
console.log(`[live-gate] wrote ${outputPath}`);
await Promise.allSettled(rooms.map((room) => room.leave()));
