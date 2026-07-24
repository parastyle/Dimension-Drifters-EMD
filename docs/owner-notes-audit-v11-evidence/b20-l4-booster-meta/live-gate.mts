import { writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import {
  ACTIVE_WEAPON_CATALOG_IDS,
  type ArenaMap,
  type ArenaState,
  CHEST_OPEN_RADIUS,
  type ChestState,
  createMetaAccountV5,
  generateArena,
  isArenaDiscSafe,
  PLAYER_RADIUS,
  type PlayerState,
  ROOM_NAME,
  SCHEMA_VERSION,
  STARTER_UNLOCKED_WEAPON_IDS,
} from "@dd/shared";

const requireFromWorkspace = createRequire(
  `${process.cwd()}/node_modules/.pnpm/node_modules/b20-l4-live-gate.cjs`,
);
const { Client } = requireFromWorkspace("colyseus.js") as typeof import("colyseus.js");

const endpoint = process.argv[2] ?? "ws://127.0.0.1:52248";
const outputPath =
  process.argv[3] ??
  "docs/owner-notes-audit-v11-evidence/b20-l4-booster-meta/live-observations.json";
const gamePort = Number(process.argv[4] ?? 52248);
const clientPort = Number(process.argv[5] ?? 52249);
const STEP_MS = 50;
const MAX_RUN_MS = 210_000;
const lockedTarget =
  ACTIVE_WEAPON_CATALOG_IDS.find((id) => !STARTER_UNLOCKED_WEAPON_IDS.includes(id as never)) ?? "";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface ChestReceipt {
  chestId: string;
  zone: number;
  kind: number;
  weapon?: { id: string; name: string; tier: string };
  relics: Array<{ id: string; rarity: string; label: string; stacks: number }>;
  money: number;
}

interface LiveRoom {
  sessionId: string;
  roomId: string;
  state: ArenaState;
  send(type: string, payload?: unknown): void;
  leave(): Promise<unknown>;
  onMessage(type: string, callback: (payload: unknown) => void): unknown;
}

interface ObservedReceipt {
  playerId: string;
  atMs: number;
  payload: ChestReceipt;
}

const startedAt = Date.now();
const rooms: LiveRoom[] = [];
const receipts: ObservedReceipt[] = [];
const denials: Array<{ playerId: string; atMs: number; payload: unknown }> = [];
const inputSeq = new Map<string, number>();
const account = createMetaAccountV5();
account.scrip = 480;

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
    metaAccount: account,
    selectedCharacterId: "proto-cowboy-hidden-face",
    selectedPetId: account.selectedPetId,
    dimensionId: "wild-west",
    bossRush: false,
    belt: false,
    beltLevel: "",
  })) as unknown as LiveRoom;
  rooms.push(room);
  inputSeq.set(room.sessionId, 0);
  room.onMessage("chestOpened", (payload) => {
    receipts.push({
      playerId: room.sessionId,
      atMs: Date.now() - startedAt,
      payload: payload as ChestReceipt,
    });
  });
  room.onMessage("chestOpenDenied", (payload) => {
    denials.push({ playerId: room.sessionId, atMs: Date.now() - startedAt, payload });
  });
}

const leader = rooms[0];
if (!leader) throw new Error("live gate requires a leader room");
await waitUntil(
  () =>
    leader.state?.schemaVersion === SCHEMA_VERSION &&
    leader.state.players?.size === rooms.length &&
    rooms.every((room) => leader.state.players.has(room.sessionId)),
  10_000,
  `two-player schema-${SCHEMA_VERSION} handshake`,
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
  const previous = new Int32Array(mapValue.cols * mapValue.rows);
  previous.fill(-2);
  const queue = new Int32Array(previous.length);
  const start = startRow * mapValue.cols + startCol;
  const target = targetRow * mapValue.cols + targetCol;
  let head = 0;
  let tail = 0;
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
    reversed.push({
      x: ((cursor % mapValue.cols) + 0.5) * mapValue.tileSize,
      y: (Math.floor(cursor / mapValue.cols) + 0.5) * mapValue.tileSize,
    });
  }
  return reversed.reverse();
}

function sendInput(room: LiveRoom, dx: number, dy: number): void {
  const seq = ((inputSeq.get(room.sessionId) ?? 0) + 1) >>> 0;
  inputSeq.set(room.sessionId, seq);
  room.send("input", {
    seq,
    dx,
    dy,
    jump: false,
    crouchHeld: false,
    pound: false,
    slide: false,
    slideHeld: false,
    fireHeld: false,
    aimX: dx || 1,
    aimY: dy,
    targetX: 0,
    targetY: 0,
  });
  room.send("attack", {
    aimX: dx || 1,
    aimY: dy,
    targetX: 0,
    targetY: 0,
  });
  room.send("parry");
}

async function driveToChest(room: LiveRoom, chestId: string): Promise<void> {
  const deadline = Date.now() + 55_000;
  let path: Array<{ x: number; y: number }> = [];
  let waypoint = 0;
  let lastPathAt = 0;
  while (Date.now() < deadline) {
    const player = room.state.players.get(room.sessionId) as PlayerState | undefined;
    const chest = room.state.chests.get(chestId) as ChestState | undefined;
    if (!player?.alive) throw new Error(`${room.sessionId} died before reaching ${chestId}`);
    if (!chest) throw new Error(`${room.sessionId} lost synchronized chest ${chestId}`);
    if (Math.hypot(chest.x - player.x, chest.y - player.y) <= CHEST_OPEN_RADIUS - 32) {
      sendInput(room, 0, 0);
      return;
    }
    if (path.length === 0 || Date.now() - lastPathAt >= 1_500) {
      path = tilePath(map, player.x, player.y, chest.x, chest.y);
      waypoint = Math.min(1, path.length - 1);
      lastPathAt = Date.now();
    }
    let target = path[waypoint] ?? chest;
    while (
      waypoint < path.length - 1 &&
      Math.hypot(target.x - player.x, target.y - player.y) < 30
    ) {
      target = path[++waypoint] ?? chest;
    }
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const length = Math.hypot(dx, dy) || 1;
    sendInput(room, dx / length, dy / length);
    await sleep(STEP_MS);
  }
  throw new Error(`${room.sessionId} did not reach ${chestId}`);
}

const processed = new Set<string>();
const chestSpawns: Array<{
  id: string;
  tick: number;
  kind: number;
  zone: number;
  x: number;
  y: number;
  validGround: boolean;
}> = [];
let weaponReceipt: ObservedReceipt | undefined;

while (Date.now() - startedAt < MAX_RUN_MS && !weaponReceipt) {
  for (const chest of leader.state.chests.values() as Iterable<ChestState>) {
    if (!chestSpawns.some((row) => row.id === chest.id)) {
      chestSpawns.push({
        id: chest.id,
        tick: chest.spawnTick,
        kind: chest.kind,
        zone: chest.zone,
        x: chest.x,
        y: chest.y,
        validGround: isArenaDiscSafe(map, chest.x, chest.y, 24),
      });
    }
  }
  const nextChest = [...leader.state.chests.values()].find((chest) => !processed.has(chest.id)) as
    | ChestState
    | undefined;
  if (!nextChest) {
    for (const room of rooms) sendInput(room, 0, 0);
    await sleep(200);
    continue;
  }
  processed.add(nextChest.id);
  for (const room of rooms) {
    await driveToChest(room, nextChest.id);
    const before = receipts.length;
    room.send("openChest", { chestId: nextChest.id });
    await waitUntil(
      () =>
        receipts.length > before &&
        receipts.some(
          (receipt) =>
            receipt.playerId === room.sessionId && receipt.payload.chestId === nextChest.id,
        ),
      5_000,
      `${room.sessionId} chest receipt ${nextChest.id}`,
    );
  }
  weaponReceipt = receipts.find((receipt) => receipt.payload.weapon);
  process.stdout.write(
    `[b20-l4-live] opened ${nextChest.id}; receipts=${receipts.length}; weapon=${weaponReceipt?.payload.weapon?.id ?? "none"}\n`,
  );
}

if (!weaponReceipt)
  throw new Error("no live weapon-cache receipt arrived before the gate deadline");
if (denials.length > 0) throw new Error(`live gate observed ${denials.length} chest denial(s)`);

const unlockedSet = new Set(account.unlockedWeapons);
const weaponReceipts = receipts.filter(
  (
    receipt,
  ): receipt is ObservedReceipt & {
    payload: ChestReceipt & { weapon: NonNullable<ChestReceipt["weapon"]> };
  } => !!receipt.payload.weapon,
);
const pickupWeapons = [...leader.state.pickups.values()].map((pickup) => ({
  id: pickup.id,
  ownerId: pickup.ownerId,
  weapon: pickup.weapon,
  weaponPublic: pickup.weaponPublic,
}));
const allWeaponRewardsUnlocked = weaponReceipts.every((receipt) =>
  unlockedSet.has(receipt.payload.weapon.id),
);
const lockedTargetObserved =
  weaponReceipts.some((receipt) => receipt.payload.weapon.id === lockedTarget) ||
  pickupWeapons.some(
    (pickup) => pickup.weapon === lockedTarget || pickup.weaponPublic === lockedTarget,
  );
if (!allWeaponRewardsUnlocked || lockedTargetObserved) {
  throw new Error("locked-pool invariant failed during the private live run");
}

const observations = {
  verdict: "pass",
  privatePorts: {
    client: clientPort,
    game: gamePort,
    protectedPorts: [5180, 2567],
    protectedPortsUsed: [clientPort, gamePort].some((port) => port === 5180 || port === 2567),
  },
  browserSurface: {
    available: false,
    discovery: [],
    screenshotCaptured: false,
    reason: "Browser runtime discovery returned no connected browser surfaces.",
  },
  transport: {
    endpoint,
    roomId: leader.roomId,
    schemaVersion: leader.state.schemaVersion,
    accountVersion: account.version,
    elapsedMs: Date.now() - startedAt,
    playerIds: rooms.map((room) => room.sessionId),
    outcome: leader.state.outcome,
  },
  unlockPool: {
    starterUnlockedCount: account.unlockedWeapons.length,
    lockedTarget,
    lockedTargetObserved,
    allWeaponRewardsUnlocked,
  },
  chestSpawns,
  receipts,
  pickupWeapons,
  denials,
};

await writeFile(outputPath, `${JSON.stringify(observations, null, 2)}\n`, "utf8");
for (const room of rooms) await room.leave();
process.stdout.write(
  `[b20-l4-live] PASS locked=${lockedTarget} observed=${lockedTargetObserved} output=${outputPath}\n`,
);
