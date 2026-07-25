import { createServer } from "node:http";
import {
  CHEST_CONTENT_HP_POTION,
  CHEST_CONTENT_MONEY,
  CHEST_CONTENT_PET,
  CHEST_CONTENT_TRINKET,
  CHEST_CONTENT_WEAPON,
  CHEST_KIND_STANDARD,
  ChestState,
  EnemyState,
  isRareRelicId,
  MAP_ZONE_SCAR,
  ROOM_NAME,
  rollChestReward,
  unlockedWeaponDropPool,
} from "@dd/shared";
import { matchMaker } from "../../../packages/server/node_modules/colyseus/build/index.mjs";
import { createGameServer } from "../../../packages/server/src/index.js";

const gamePort = Number(process.env.DD_LIVE_GAME_PORT ?? 2591);
const controlPort = Number(process.env.DD_LIVE_CONTROL_PORT ?? 2592);

type LocalRoom = {
  state: {
    tick: number;
    players: Map<string, any>;
    chests: Map<string, ChestState>;
    enemies: Map<string, EnemyState>;
    projectiles: Map<string, unknown>;
  };
  chestRoomSeed: number;
  chestRunStartTick: number;
  metaAccounts: Map<string, any>;
  broadcastPatch?(): void;
};

function json(response: import("node:http").ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body, null, 2));
}

async function currentRoom(): Promise<LocalRoom> {
  const listings = await matchMaker.query({ name: ROOM_NAME });
  const roomId = listings.at(-1)?.roomId;
  const room = roomId
    ? (matchMaker.getLocalRoomById(roomId) as unknown as LocalRoom | undefined)
    : undefined;
  if (!room) throw new Error("no local B55 arena room");
  return room;
}

function firstPlayer(room: LocalRoom): any {
  const player = [...room.state.players.values()][0];
  if (!player) throw new Error("no connected B55 player");
  return player;
}

function matchesReward(
  kind: string,
  augmentId: string,
  reward: ReturnType<typeof rollChestReward>,
) {
  if (kind === "augment") return reward.trinket?.augmentId === augmentId;
  if (kind === "trinket")
    return reward.content === CHEST_CONTENT_TRINKET && !reward.trinket?.augmentId;
  if (kind === "weapon") return reward.content === CHEST_CONTENT_WEAPON;
  if (kind === "pet") return reward.content === CHEST_CONTENT_PET;
  if (kind === "potion") return reward.content === CHEST_CONTENT_HP_POTION;
  return reward.content === CHEST_CONTENT_MONEY;
}

async function stageChest(kind: string, augmentId: string) {
  const room = await currentRoom();
  const player = firstPlayer(room);
  const account = room.metaAccounts.get(player.id);
  const spawnTick = room.state.tick;
  const sequence = 5_500 + (spawnTick % 1_000);
  const input = {
    chestSequence: sequence,
    spawnTick,
    elapsedSeconds: 180,
    zone: MAP_ZONE_SCAR,
    kind: CHEST_KIND_STANDARD,
    playerKey: player.id,
    luckStacks: player.relics.luck,
    ownedRareIds: player.relics.ownedRare.split(",").filter(isRareRelicId),
    ownedAugments: player.augments,
    activePetId: player.petId,
    weaponIds: account ? unlockedWeaponDropPool(account) : [],
  } as const;
  let roomSeed = 1;
  let reward = rollChestReward({ ...input, roomSeed });
  while (!matchesReward(kind, augmentId, reward) && roomSeed < 200_000) {
    roomSeed++;
    reward = rollChestReward({ ...input, roomSeed });
  }
  if (!matchesReward(kind, augmentId, reward))
    throw new Error(`unable to stage ${kind}/${augmentId}`);

  if (kind === "potion") player.hp = Math.max(1, player.maxHp * 0.45);
  room.state.chests.clear();
  room.chestRoomSeed = roomSeed;
  room.chestRunStartTick = spawnTick;
  const chest = new ChestState();
  chest.id = `chest:${sequence}:${spawnTick}`;
  chest.x = player.x + 36;
  chest.y = player.y;
  chest.zone = MAP_ZONE_SCAR;
  chest.kind = CHEST_KIND_STANDARD;
  chest.spawnTick = spawnTick;
  chest.openedBy.set(player.id, false);
  room.state.chests.set(chest.id, chest);
  room.broadcastPatch?.();
  return {
    kind,
    augmentId: reward.trinket?.augmentId ?? "",
    roomSeed,
    chestId: chest.id,
    expected: reward,
    hpBefore: player.hp,
    maxHp: player.maxHp,
    playerId: player.id,
  };
}

async function stagePierceTargets() {
  const room = await currentRoom();
  const player = firstPlayer(room);
  room.state.enemies.clear();
  room.state.projectiles.clear();
  player.x = 640;
  player.y = 480;
  const targets = [
    { id: "b55-pierce-a", x: player.x + 170 },
    { id: "b55-pierce-b", x: player.x + 310 },
  ];
  for (const target of targets) {
    const enemy = new EnemyState();
    enemy.id = target.id;
    enemy.kind = "dummy";
    enemy.x = target.x;
    enemy.y = player.y;
    enemy.hp = 999;
    room.state.enemies.set(enemy.id, enemy);
  }
  room.broadcastPatch?.();
  return {
    playerId: player.id,
    augments: player.augments,
    weapon: player.weapon,
    targets,
  };
}

await createGameServer(gamePort);
const control = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://127.0.0.1:${controlPort}`);
    if (url.pathname === "/stage") {
      json(
        response,
        200,
        await stageChest(
          url.searchParams.get("kind") ?? "money",
          url.searchParams.get("augment") ?? "",
        ),
      );
      return;
    }
    if (url.pathname === "/combat") {
      json(response, 200, await stagePierceTargets());
      return;
    }
    const room = await currentRoom();
    const player = firstPlayer(room);
    json(response, 200, {
      gamePort,
      controlPort,
      player: {
        id: player.id,
        character: player.character,
        weapon: player.weapon,
        hp: player.hp,
        maxHp: player.maxHp,
        petId: player.petId,
        augments: player.augments,
        ultArchetype: player.ultArchetype,
        ultCharge: player.ultCharge,
      },
    });
  } catch (error) {
    json(response, 503, { error: error instanceof Error ? error.message : String(error) });
  }
});
control.listen(controlPort, "127.0.0.1", () => {
  console.log(`[b55-live] control http://127.0.0.1:${controlPort}`);
});
