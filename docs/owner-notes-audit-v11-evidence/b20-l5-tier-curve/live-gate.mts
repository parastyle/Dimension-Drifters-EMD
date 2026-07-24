import { writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createServer as createTcpServer } from "node:net";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import {
  ACTIVE_WEAPON_CATALOG_IDS,
  ChestState,
  CHEST_KIND_WEAPON_CACHE,
  chestWeaponTierWeights,
  createMetaAccountV5,
  MAP_ZONE_COMMONS,
  MAP_ZONE_SCAR,
  SCHEMA_VERSION,
  TICK_RATE,
  WEAPONS,
  type ArenaState,
  type MetaAccountV5,
  type PlayerState,
  type WeaponTier,
} from "@dd/shared";
import { GameRoom } from "../../../packages/server/src/rooms/GameRoom.ts";

const requireFromWorkspace = createRequire(
  `${process.cwd()}/node_modules/.pnpm/node_modules/b20-l5-live-gate.cjs`,
);
const { Client } = requireFromWorkspace("colyseus.js") as typeof import("colyseus.js");
const requireFromClient = createRequire(`${process.cwd()}/packages/client/package.json`);
const requireFromServer = createRequire(`${process.cwd()}/packages/server/package.json`);
const { WebSocketTransport } = await import(
  pathToFileURL(requireFromServer.resolve("@colyseus/ws-transport")).href
);
const { Server } = await import(pathToFileURL(requireFromServer.resolve("colyseus")).href);

const outputPath =
  process.argv[2] ??
  "docs/owner-notes-audit-v11-evidence/b20-l5-tier-curve/live-observations.json";
const ROOM_NAME = "b20-l5-tier-gate";
const SAMPLES_PER_POINT = 2_000;
const PROTECTED_PORTS = [5180, 2567] as const;
const TIERS = [1, 2, 3, 4, 5] as const;

interface ChestReceipt {
  chestId: string;
  zone: number;
  kind: number;
  weapon?: { id: string; name: string; tier: WeaponTier };
}

interface TierSample {
  minute: number;
  zone: number;
  samples: number;
  elapsedSecondsObserved: number;
  expectedWeights: number[];
  counts: Record<WeaponTier, number>;
  shares: Record<WeaponTier, number>;
  lowShare: number;
  highShare: number;
  authoredTierMismatches: number;
}

interface TierGateResult {
  schemaVersion: number;
  runStartTick: number;
  points: TierSample[];
}

interface LiveRoom {
  sessionId: string;
  roomId: string;
  state: ArenaState;
  send(type: string, payload?: unknown): void;
  leave(): Promise<unknown>;
  onMessage(type: string, callback: (payload: unknown) => void): unknown;
}

interface GateClient {
  sessionId: string;
  send(type: string, payload?: unknown): void;
}

type GateAuthority = {
  chestRunStartTick: number;
  metaAccounts: Map<string, MetaAccountV5>;
  openChestForPlayer(playerId: string, chestId: string): void;
  clearFloorPickup(pickupId: string): void;
  copySlot(destination: PlayerState["bag"][number], source: null): void;
  sendOwnerMessage(playerId: string, type: string, payload: unknown): void;
};

function round(value: number, digits = 4): number {
  return Number(value.toFixed(digits));
}

function emptyCounts(): Record<WeaponTier, number> {
  return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
}

class TierCurveGateRoom extends GameRoom {
  override onCreate(options?: {
    dimensionId?: string;
    bossRush?: boolean;
    belt?: boolean;
    beltLevel?: string;
  }): void {
    super.onCreate(options);
    this.onMessage("tierGate", (client) => {
      try {
        client.send("tierGateResult", this.runTierGate(client));
      } catch (error) {
        client.send("tierGateError", {
          message: error instanceof Error ? (error.stack ?? error.message) : String(error),
        });
      }
    });
  }

  private runTierGate(client: GateClient): TierGateResult {
    const authority = this as unknown as GateAuthority;
    const player = this.state.players.get(client.sessionId) as PlayerState | undefined;
    const account = authority.metaAccounts.get(client.sessionId);
    if (!player || !account) throw new Error("joined player/account was not initialized");
    account.unlockedWeapons = [...ACTIVE_WEAPON_CATALOG_IDS];

    authority.chestRunStartTick = 0;
    const runStartTick = authority.chestRunStartTick;
    const points: TierSample[] = [];
    const originalSendOwnerMessage = authority.sendOwnerMessage.bind(this);
    let capturedReceipt: ChestReceipt | undefined;
    authority.sendOwnerMessage = (_playerId, type, payload) => {
      if (type === "chestOpened") capturedReceipt = payload as ChestReceipt;
    };

    try {
      for (const point of [
        { minute: 0, zone: MAP_ZONE_COMMONS },
        { minute: 15, zone: MAP_ZONE_COMMONS },
        { minute: 15, zone: MAP_ZONE_SCAR },
      ] as const) {
        const counts = emptyCounts();
        let authoredTierMismatches = 0;
        this.state.tick = point.minute * 60 * TICK_RATE;
        player.x = 640;
        player.y = 640;
        player.alive = true;
        const chestKey = `tier-gate-${point.minute}-${point.zone}`;
        const chest = new ChestState();
        chest.x = player.x;
        chest.y = player.y;
        chest.zone = point.zone;
        chest.kind = CHEST_KIND_WEAPON_CACHE;
        chest.spawnTick = 0;
        this.state.chests.set(chestKey, chest);

        for (let sequence = 1; sequence <= SAMPLES_PER_POINT; sequence++) {
          player.relics.luck = 0;
          capturedReceipt = undefined;
          chest.id = `chest:${sequence}:0`;
          chest.opened = false;
          chest.openedBy.delete(client.sessionId);

          authority.openChestForPlayer(client.sessionId, chestKey);
          const receipt = capturedReceipt;
          const weapon = receipt?.weapon;
          if (!weapon) {
            throw new Error(
              `weapon cache ${chest.id} produced no weapon at minute ${point.minute}`,
            );
          }
          const authoredTier = WEAPONS[weapon.id]?.tier;
          if (authoredTier !== weapon.tier) authoredTierMismatches++;
          counts[weapon.tier]++;

          for (const pickupId of [...this.state.pickups.keys()]) {
            authority.clearFloorPickup(pickupId);
          }
          const bagSlot = player.bag.find((slot) => !!slot.weapon);
          if (bagSlot) authority.copySlot(bagSlot, null);
          this.state.moneyDrops.clear();
        }
        this.state.chests.delete(chestKey);

        const shares = emptyCounts();
        for (const tier of TIERS) shares[tier] = round(counts[tier] / SAMPLES_PER_POINT);
        points.push({
          ...point,
          samples: SAMPLES_PER_POINT,
          elapsedSecondsObserved:
            ((this.state.tick - authority.chestRunStartTick) / TICK_RATE),
          expectedWeights: chestWeaponTierWeights(point.minute * 60, point.zone, 0).map((value) =>
            round(value),
          ),
          counts,
          shares,
          lowShare: round(shares[1] + shares[2]),
          highShare: round(shares[4] + shares[5]),
          authoredTierMismatches,
        });
      }
    } finally {
      authority.sendOwnerMessage = originalSendOwnerMessage;
    }

    const [early, late, scar] = points;
    if (!early || !late || !scar) throw new Error("tier sample points were not produced");
    if (early.counts[4] !== 0 || early.counts[5] !== 0 || early.lowShare < 0.88) {
      throw new Error("minute-0 weapon distribution did not remain concentrated in T1-T2");
    }
    if (late.lowShare <= 0 || late.highShare < 0.35 || late.highShare <= early.highShare) {
      throw new Error("minute-15 weapon distribution did not widen toward T4-T5");
    }
    if (scar.highShare <= late.highShare) {
      throw new Error("Scar multiplier did not raise the minute-15 T4-T5 share");
    }
    if (points.some((point) => point.authoredTierMismatches !== 0)) {
      throw new Error("a chest receipt tier disagreed with the authored weapon tier");
    }

    return {
      schemaVersion: this.state.schemaVersion,
      runStartTick,
      points,
    };
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolvePromise, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolvePromise(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function waitForState(room: LiveRoom): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (
      room.state?.schemaVersion === SCHEMA_VERSION &&
      room.state.players?.has(room.sessionId)
    ) {
      return;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 20));
  }
  throw new Error(`schema-${SCHEMA_VERSION} transport handshake timed out`);
}

async function requestTierGate(room: LiveRoom): Promise<TierGateResult> {
  const result = new Promise<TierGateResult>((resolvePromise, reject) => {
    room.onMessage("tierGateResult", (payload) => resolvePromise(payload as TierGateResult));
    room.onMessage("tierGateError", (payload) => {
      reject(new Error(`live authority failed: ${JSON.stringify(payload)}`));
    });
  });
  room.send("tierGate");
  return withTimeout(result, 60_000, "tier-gate transport response");
}

function reserveEphemeralPort(): Promise<number> {
  return new Promise<number>((resolvePromise, reject) => {
    const server = createTcpServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("ephemeral port reservation did not expose a TCP port"));
        return;
      }
      const port = address.port;
      server.close((error) => {
        if (error) reject(error);
        else resolvePromise(port);
      });
    });
  });
}

const startedAt = Date.now();
const viteEntry = requireFromClient.resolve("vite");
const { createServer: createViteServer } = await import(pathToFileURL(viteEntry).href);
const requestedClientPort = await reserveEphemeralPort();
const viteServer = await createViteServer({
  root: resolve("packages/client"),
  logLevel: "error",
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { host: "127.0.0.1", port: requestedClientPort, strictPort: true },
});
const gameServer = new Server({ transport: new WebSocketTransport() });
let room: LiveRoom | undefined;

try {
  await viteServer.listen();
  const clientAddress = viteServer.httpServer?.address();
  if (!clientAddress || typeof clientAddress === "string") {
    throw new Error("Vite did not expose its ephemeral TCP port");
  }
  const clientPort = clientAddress.port;
  const clientResponse = await fetch(`http://127.0.0.1:${clientPort}/`);
  const clientHtml = await clientResponse.text();

  gameServer.define(ROOM_NAME, TierCurveGateRoom);
  await gameServer.listen(0);
  const gameAddress = gameServer.transport.server?.address();
  if (!gameAddress || typeof gameAddress === "string") {
    throw new Error("Colyseus did not expose its ephemeral TCP port");
  }
  const gamePort = gameAddress.port;
  const protectedPortsUsed = [clientPort, gamePort].filter((port) =>
    PROTECTED_PORTS.includes(port as (typeof PROTECTED_PORTS)[number]),
  );
  if (protectedPortsUsed.length > 0) {
    throw new Error(`protected port(s) selected: ${protectedPortsUsed.join(",")}`);
  }

  const account = createMetaAccountV5();
  account.unlockedWeapons = [...ACTIVE_WEAPON_CATALOG_IDS];
  const client = new Client(`http://127.0.0.1:${gamePort}`);
  room = (await client.joinOrCreate(ROOM_NAME, {
    metaAccount: account,
    selectedCharacterId: "proto-cowboy-hidden-face",
    selectedPetId: "",
    dimensionId: "wild-west",
    bossRush: false,
    belt: false,
    beltLevel: "",
  })) as unknown as LiveRoom;
  await waitForState(room);
  const tierGate = await requestTierGate(room);

  const activeTierCensus = emptyCounts();
  for (const id of ACTIVE_WEAPON_CATALOG_IDS) activeTierCensus[WEAPONS[id]!.tier]++;
  const observations = {
    verdict: "pass",
    privatePorts: {
      client: clientPort,
      game: gamePort,
      protectedPorts: PROTECTED_PORTS,
      protectedPortsUsed,
    },
    clientSurface: {
      status: clientResponse.status,
      contentType: clientResponse.headers.get("content-type"),
      hasHtmlShell: clientHtml.includes("<!doctype html>"),
    },
    transport: {
      endpoint: `ws://127.0.0.1:${gamePort}`,
      roomId: room.roomId,
      sessionId: room.sessionId,
      schemaVersion: room.state.schemaVersion,
      elapsedMs: Date.now() - startedAt,
    },
    authoredCatalog: {
      activeWeapons: ACTIVE_WEAPON_CATALOG_IDS.length,
      tierCensus: activeTierCensus,
    },
    tierGate,
  };
  await writeFile(outputPath, `${JSON.stringify(observations, null, 2)}\n`, "utf8");
  process.stdout.write(
    `[b20-l5-live] PASS client=${clientPort} game=${gamePort} room=${room.roomId} output=${outputPath}\n`,
  );
  for (const point of tierGate.points) {
    process.stdout.write(
      `[b20-l5-live] minute=${point.minute} zone=${point.zone} counts=${JSON.stringify(point.counts)} low=${point.lowShare} high=${point.highShare}\n`,
    );
  }
} finally {
  if (room) await Promise.allSettled([room.leave()]);
  try {
    await withTimeout(gameServer.gracefullyShutdown(false), 5_000, "game server shutdown");
  } finally {
    if (gameServer.transport.server?.listening) gameServer.transport.shutdown();
  }
  await viteServer.close();
}
