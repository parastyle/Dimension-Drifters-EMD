import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { matchMaker } from "../../packages/server/node_modules/colyseus/build/index.mjs";
import {
  BELT_Y0,
  beltLevelFor,
  clampBeltFloorY,
  DEPTH_MAX,
  DISASSEMBLY_HOLD_SECONDS,
  ENEMY_KINDS,
  PLAYER_RADIUS,
  weaponDisassemblyValue,
} from "@dd/shared";
import { runArenaSpec, startAutoAttack, stopAutoAttack } from "../helpers/arena-harness.js";

const EVIDENCE_DIR = path.resolve(
  import.meta.dirname,
  "../../docs/owner-notes-audit-v11-evidence/b20-l3-economy",
);
const CHARACTER_ID = "proto-cowboy-hidden-face";
const WEAPON_ID = "rusty-cleaver";
const DROP_ENEMY_ID = "thornblade-warden";
const FORBIDDEN_PORTS = new Set([5180, 2567]);

interface BrowserBagItem {
  weapon: string;
  rarity: number;
  affix: string;
  earned: boolean;
  homeIssue: boolean;
  bankEntryId: string;
}

interface BrowserPlayer {
  x: number;
  y: number;
  alive: boolean;
  character: string;
  weapon: string;
  scrip: number;
  activeSlot: number;
  slots: BrowserBagItem[];
  bag: BrowserBagItem[];
}

interface BrowserPickup {
  id: string;
  weapon: string;
  weaponPublic: string;
  x: number;
  y: number;
  disassemblable: boolean;
  ownerId: string;
}

interface BrowserEnemy {
  id: string;
  kind: string;
  hp: number;
  x: number;
  y: number;
}

interface BrowserCollection<T> {
  get(id: string): T | undefined;
  has(id: string): boolean;
  forEach(callback: (value: T, id: string) => void): void;
}

interface BrowserRoom {
  roomId: string;
  sessionId: string;
  send(type: string, payload?: unknown): void;
  onMessage(type: string, callback: (payload: unknown) => void): unknown;
  state: {
    mode: string;
    outcome: string;
    beltRoomName?: string;
    players: BrowserCollection<BrowserPlayer>;
    pickups: BrowserCollection<BrowserPickup>;
    enemies: BrowserCollection<BrowserEnemy>;
  };
}

interface BrowserZone {
  x: number;
  y: number;
  visible: boolean;
  emit?(event: string): boolean;
}

interface BrowserArena {
  belt: boolean;
  bagOpen: boolean;
  grabTargetId: string;
  grabTargetDisassemblable: boolean;
  eHoldPickupId: string;
  room: BrowserRoom;
  moneyResultLine: string;
  petMetaAccount?: { scrip?: number };
  keys: { E: { isDown: boolean } };
  grabPromptText: { text: string; visible: boolean };
  camFocus: { x: number; y: number } | null;
  verbs?: { isLegendOpen?(): boolean };
  predictor: {
    mintCmd(
      moveX: number,
      moveY: number,
      jump: boolean,
      crouchHeld: boolean,
      pound: boolean,
      aimX: number,
      aimY: number,
      slide: boolean,
      slideHeld: boolean,
    ): object;
  };
  dispatchNetInput(
    command: object,
    self: BrowserPlayer | undefined,
    weapon: undefined,
    predictTick: boolean,
  ): void;
  slotZones: Array<BrowserZone | undefined>;
  bagDisassembleZones: Array<BrowserZone | undefined>;
  children: {
    list: Array<{
      name?: string;
      text?: string;
      texture?: { key?: string };
    }>;
  };
  textures: {
    getTextureKeys(): string[];
  };
}

interface BrowserGame {
  scene: {
    isActive(key: string): boolean;
    getScene(key: string): BrowserArena;
  };
}

interface EconomyProbeWindow {
  ddGame?: BrowserGame;
  __b20DisassemblyReceipts?: unknown[];
  __b20BankReceipts?: unknown[];
  __b20OutgoingMessages?: Array<{ type: string; payload: unknown }>;
  __b20RoomSendWrapped?: boolean;
  __b20HoldEvidenceDelay?: boolean;
}

interface LiveSnapshot {
  active: boolean;
  belt: boolean;
  mode: string;
  outcome: string;
  character: string;
  weapon: string;
  alive: boolean;
  x: number;
  y: number;
  scrip: number;
  bag: BrowserBagItem[];
  activeSlot: number;
  pickups: BrowserPickup[];
  enemies: BrowserEnemy[];
  beltRoomName: string;
  moneyResultLine: string;
  bankTotal: number;
  disassemblyReceipts: unknown[];
  bankReceipts: unknown[];
}

function evidencePath(filename: string): string {
  return path.relative(process.cwd(), path.join(EVIDENCE_DIR, filename)).replaceAll("\\", "/");
}

async function captureArenaCanvas(page: Page, filename: string): Promise<void> {
  const session = await page.context().newCDPSession(page);
  try {
    const capture = await session.send("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: false,
    });
    await writeFile(path.join(EVIDENCE_DIR, filename), Buffer.from(capture.data, "base64"));
  } finally {
    await session.detach();
  }
}

async function snapshot(page: Page): Promise<LiveSnapshot> {
  return await page.evaluate(() => {
    const holder = globalThis as unknown as EconomyProbeWindow;
    const game = holder.ddGame;
    if (!game?.scene.isActive("arena")) {
      return {
        active: false,
        belt: false,
        mode: "",
        outcome: "",
        character: "",
        weapon: "",
        alive: false,
        x: 0,
        y: 0,
        scrip: 0,
        bag: [],
        activeSlot: 0,
        pickups: [],
        enemies: [],
        beltRoomName: "",
        moneyResultLine: "",
        bankTotal: 0,
        disassemblyReceipts: [],
        bankReceipts: [],
      };
    }
    const arena = game.scene.getScene("arena");
    const room = arena.room;
    if (!room?.state?.players || !room.state.pickups || !room.state.enemies) {
      return {
        active: false,
        belt: arena.belt,
        mode: "",
        outcome: "",
        character: "",
        weapon: "",
        alive: false,
        x: 0,
        y: 0,
        scrip: 0,
        bag: [],
        activeSlot: 0,
        pickups: [],
        enemies: [],
        beltRoomName: "",
        moneyResultLine: "",
        bankTotal: 0,
        disassemblyReceipts: [],
        bankReceipts: [],
      };
    }
    const self = room?.state.players.get(room.sessionId);
    const pickups: BrowserPickup[] = [];
    const enemies: BrowserEnemy[] = [];
    room?.state.pickups.forEach((pickup, id) => {
      const weapon = pickup.weaponPublic || pickup.weapon;
      if (weapon && pickup.disassemblable) pickups.push({ ...pickup, id, weapon });
    });
    room?.state.enemies.forEach((enemy, id) => {
      enemies.push({ id, kind: enemy.kind, hp: enemy.hp, x: enemy.x, y: enemy.y });
    });
    return {
      active: !!self,
      belt: arena.belt,
      mode: room?.state.mode ?? "",
      outcome: room?.state.outcome ?? "",
      character: self?.character ?? "",
      weapon: self?.weapon ?? "",
      alive: self?.alive ?? false,
      x: self?.x ?? 0,
      y: self?.y ?? 0,
      scrip: self?.scrip ?? 0,
      bag: self ? [...self.bag].map((item) => ({ ...item })) : [],
      activeSlot: self?.activeSlot ?? 0,
      pickups,
      enemies,
      beltRoomName: room?.state.beltRoomName ?? "",
      moneyResultLine: arena.moneyResultLine,
      bankTotal: Math.max(0, Math.floor(arena.petMetaAccount?.scrip ?? 0)),
      disassemblyReceipts: [...(holder.__b20DisassemblyReceipts ?? [])],
      bankReceipts: [...(holder.__b20BankReceipts ?? [])],
    };
  });
}

async function tapKey(page: Page, key: string, durationMs = 80): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(durationMs);
  await page.keyboard.up(key);
}

async function sendMovement(
  page: Page,
  dx: number,
  dy: number,
  jump = false,
): Promise<void> {
  await page.evaluate(
    ({ moveX, moveY, jumpPressed }) => {
      const arena = (globalThis as unknown as EconomyProbeWindow).ddGame?.scene.getScene("arena");
      const self = arena?.room.state.players.get(arena.room.sessionId);
      if (!arena || !self) return;
      const length = Math.hypot(moveX, moveY) || 1;
      const aimX = moveX / length;
      const aimY = moveY / length;
      const command = {
        ...arena.predictor.mintCmd(
          moveX,
          moveY,
          jumpPressed,
          false,
          false,
          aimX,
          aimY,
          false,
          false,
        ),
        fireHeld: false,
        aimX,
        aimY,
        targetX: self.x + aimX * 200,
        targetY: self.y + aimY * 200,
      };
      arena.dispatchNetInput(command, self, undefined, true);
    },
    { moveX: dx, moveY: dy, jumpPressed: jump },
  );
  await page.waitForTimeout(55);
}

async function placePlayerBesidePickup(
  page: Page,
  pickupId: string,
): Promise<{ distance: number; release(): void }> {
  const identity = await page.evaluate((wantedPickupId) => {
    const room = (globalThis as unknown as EconomyProbeWindow).ddGame?.scene.getScene("arena").room;
    return room
      ? { roomId: room.roomId, sessionId: room.sessionId, pickupId: wantedPickupId }
      : null;
  }, pickupId);
  if (!identity) throw new Error("live room identity unavailable for the deterministic approach fixture");
  const localRoom = matchMaker.getLocalRoomById(identity.roomId) as unknown as {
    state: {
      players: {
        get(
          id: string,
        ):
          | {
              id: string;
              x: number;
              y: number;
              vx: number;
              vy: number;
              mvx: number;
              mvy: number;
              alive: boolean;
            }
          | undefined;
      };
      pickups: {
        get(
          id: string,
        ): { id: string; x: number; y: number; ownerId: string; disassemblable: boolean } | undefined;
      };
      enemies: {
        forEach(
          callback: (enemy: { x: number; y: number; hp: number }, id: string) => void,
        ): void;
      };
    };
    zeroMoveVel?(id: string): void;
    updateEnemyGrid?(id: string, enemy: { x: number; y: number; hp: number }): void;
    broadcastPatch?(): void;
    placePickupPos?(x: number, y: number): { x: number; y: number };
  };
  const player = localRoom?.state.players.get(identity.sessionId);
  const pickup = localRoom?.state.pickups.get(identity.pickupId);
  if (!player || !pickup) {
    const playerIds: string[] = [];
    const pickupIds: string[] = [];
    (
      localRoom?.state.players as unknown as
        | { forEach(callback: (_value: unknown, id: string) => void): void }
        | undefined
    )?.forEach((_value, id) => playerIds.push(id));
    (
      localRoom?.state.pickups as unknown as
        | { forEach(callback: (_value: unknown, id: string) => void): void }
        | undefined
    )?.forEach((_value, id) => pickupIds.push(id));
    throw new Error(
      `server fixture could not resolve ${JSON.stringify({
        roomId: identity.roomId,
        sessionId: identity.sessionId,
        pickupId,
        localRoom: !!localRoom,
        playerIds,
        pickupIds,
      })}`,
    );
  }
  const desiredX = player.x;
  const desiredY = clampBeltFloorY(
    beltLevelFor("verdant-ruin"),
    desiredX,
    BELT_Y0 + DEPTH_MAX * 0.5,
    PLAYER_RADIUS,
  );
  const safeAnchor = localRoom.placePickupPos?.(desiredX, desiredY) ?? {
    x: desiredX,
    y: desiredY,
  };
  const anchorX = safeAnchor.x;
  const anchorY = safeAnchor.y;
  pickup.x = anchorX;
  pickup.y = anchorY;
  let survivorIndex = 0;
  localRoom.state.enemies.forEach((enemy, id) => {
    if (enemy.hp <= 0) return;
    // Keep the earned drop's real combat provenance while preventing a survivor stack from
    // physically shoving the player off the E target between the authoritative patch and key edge.
    enemy.x = anchorX - 720 - survivorIndex * 55;
    enemy.y = anchorY + (survivorIndex % 2 === 0 ? -120 : 120);
    survivorIndex++;
    localRoom.updateEnemyGrid?.(id, enemy);
  });
  player.x = pickup.x;
  player.y = pickup.y;
  player.vx = 0;
  player.vy = 0;
  player.mvx = 0;
  player.mvy = 0;
  localRoom.zeroMoveVel?.(identity.sessionId);
  localRoom.broadcastPatch?.();
  let distance = Number.POSITIVE_INFINITY;
  await expect
    .poll(async () => {
      player.x = pickup.x;
      player.y = pickup.y;
      localRoom.zeroMoveVel?.(identity.sessionId);
      localRoom.broadcastPatch?.();
      const row = await snapshot(page);
      const syncedPickup = row.pickups.find((candidate) => candidate.id === pickupId);
      if (!syncedPickup) return Number.POSITIVE_INFINITY;
      distance = Math.hypot(syncedPickup.x - row.x, syncedPickup.y - row.y);
      return distance;
    })
    .toBeLessThanOrEqual(2);
  await page.evaluate(() => {
    const arena = (globalThis as unknown as EconomyProbeWindow).ddGame?.scene.getScene("arena");
    if (arena) arena.camFocus = null;
  });
  await page.waitForTimeout(100);
  const pickupAnchor = setInterval(() => {
    if (!localRoom.state.pickups.get(identity.pickupId)) return;
    player.vx = 0;
    player.vy = 0;
    player.mvx = 0;
    player.mvy = 0;
    pickup.x = player.x;
    pickup.y = player.y;
    localRoom.broadcastPatch?.();
  }, 10);
  pickupAnchor.unref();
  return {
    distance,
    release: () => clearInterval(pickupAnchor),
  };
}

async function floorInteractionState(page: Page): Promise<{
  targetId: string;
  disassemblable: boolean;
  holdPickupId: string;
  eDown: boolean;
  prompt: string;
}> {
  return await page.evaluate(() => {
    const arena = (globalThis as unknown as EconomyProbeWindow).ddGame?.scene.getScene("arena");
    return {
      targetId: arena?.grabTargetId ?? "",
      disassemblable: arena?.grabTargetDisassemblable ?? false,
      holdPickupId: arena?.eHoldPickupId ?? "",
      eDown: arena?.keys.E.isDown ?? false,
      prompt: arena?.grabPromptText.visible ? arena.grabPromptText.text : "",
    };
  });
}

async function waitForNewDrop(page: Page, excludedIds: ReadonlySet<string>): Promise<BrowserPickup> {
  const deadline = Date.now() + 30_000;
  let last = await snapshot(page);
  let attempt = 0;
  while (Date.now() < deadline) {
    last = await snapshot(page);
    const found = last.pickups.find(
      (pickup) => pickup.id.startsWith("dropEnemy") && !excludedIds.has(pickup.id),
    );
    if (found) {
      await sendMovement(page, 0, 0);
      return found;
    }
    if (!last.alive || last.outcome !== "active") {
      throw new Error(
        `run ended before a weapon drop: ${JSON.stringify({
          alive: last.alive,
          outcome: last.outcome,
          enemies: last.enemies,
        })}`,
      );
    }
    const nearest = last.enemies.reduce<BrowserEnemy | undefined>((best, enemy) => {
      if (!best) return enemy;
      const bestDistance = Math.hypot(best.x - last.x, best.y - last.y);
      const enemyDistance = Math.hypot(enemy.x - last.x, enemy.y - last.y);
      return enemyDistance < bestDistance ? enemy : best;
    }, undefined);
    const dx = nearest ? nearest.x - last.x : 1;
    const dy = nearest ? nearest.y - last.y : 0;
    const moveX = Math.abs(dx) > 46 ? Math.sign(dx) : 0;
    const moveY = Math.abs(dy) > 46 ? Math.sign(dy) : 0;
    await sendMovement(page, moveX, moveY, attempt++ % 3 === 0);
  }
  throw new Error(
    `authored wielder remained without a drop: ${JSON.stringify({
      player: { x: last.x, y: last.y, weapon: last.weapon },
      enemies: last.enemies,
      pickups: last.pickups,
    })}`,
  );
}

async function stageSecondEnemyDrop(page: Page): Promise<string> {
  const identity = await page.evaluate(() => {
    const room = (globalThis as unknown as EconomyProbeWindow).ddGame?.scene.getScene("arena").room;
    return room ? { roomId: room.roomId, sessionId: room.sessionId } : null;
  });
  if (!identity) throw new Error("live room identity unavailable for the second enemy fixture");
  const localRoom = matchMaker.getLocalRoomById(identity.roomId) as unknown as {
    state: {
      players: {
        get(
          id: string,
        ):
          | {
              x: number;
              y: number;
              vx: number;
              vy: number;
              mvx: number;
              mvy: number;
            }
          | undefined;
      };
      enemies: {
        forEach(
          callback: (enemy: { x: number; y: number; hp: number }, id: string) => void,
        ): void;
      };
    };
    updateEnemyGrid?(id: string, enemy: { x: number; y: number; hp: number }): void;
    debugSpawnOne?(
      kindId: string,
      tough: boolean,
      anchor: { x: number; y: number },
      angle: number,
      distance: number,
    ): void;
    maybeDropEnemyWeapon?(
      enemy: { x: number; y: number; hp: number },
      kind: (typeof ENEMY_KINDS)[string],
    ): void;
    zeroMoveVel?(id: string): void;
    broadcastPatch?(): void;
  };
  const player = localRoom?.state.players.get(identity.sessionId);
  if (!player) throw new Error("authoritative player unavailable for the second enemy fixture");
  const anchorX = player.x - 100;
  const anchorY = clampBeltFloorY(
    beltLevelFor("verdant-ruin"),
    anchorX,
    player.y,
    PLAYER_RADIUS,
  );
  player.x = anchorX;
  player.y = anchorY;
  player.vx = 0;
  player.vy = 0;
  player.mvx = 0;
  player.mvy = 0;
  localRoom.zeroMoveVel?.(identity.sessionId);
  let placedId = "";
  localRoom.state.enemies.forEach((enemy, id) => {
    if (placedId || enemy.hp <= 0) return;
    enemy.x = anchorX - 54;
    enemy.y = clampBeltFloorY(
      beltLevelFor("verdant-ruin"),
      enemy.x,
      anchorY,
      ENEMY_KINDS[DROP_ENEMY_ID]?.radius ?? PLAYER_RADIUS,
    );
    placedId = id;
    localRoom.updateEnemyGrid?.(id, enemy);
  });
  if (!placedId) {
    localRoom.debugSpawnOne?.(DROP_ENEMY_ID, false, player, Math.PI, 54);
    localRoom.state.enemies.forEach((enemy, id) => {
      if (placedId || enemy.hp <= 0) return;
      enemy.x = anchorX - 54;
      enemy.y = clampBeltFloorY(
        beltLevelFor("verdant-ruin"),
        enemy.x,
        anchorY,
        ENEMY_KINDS[DROP_ENEMY_ID]?.radius ?? PLAYER_RADIUS,
      );
      placedId = id;
      localRoom.updateEnemyGrid?.(id, enemy);
    });
  }
  if (!placedId) throw new Error("no surviving authored wielder remained for the bag drop");
  localRoom.broadcastPatch?.();
  let placedEnemy: { x: number; y: number; hp: number } | undefined;
  localRoom.state.enemies.forEach((enemy, id) => {
    if (id === placedId) placedEnemy = enemy;
  });
  if (!placedEnemy) throw new Error("second authored wielder fixture lost its enemy row");
  const kind = ENEMY_KINDS[DROP_ENEMY_ID];
  if (!kind) throw new Error(`${DROP_ENEMY_ID} is absent from the authored roster`);
  localRoom.maybeDropEnemyWeapon?.(placedEnemy, kind);
  localRoom.broadcastPatch?.();
  return placedId;
}

async function advanceBeltUntilEnemy(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt++) {
    if ((await snapshot(page)).enemies.length > 0) return;
    await sendMovement(page, 1, 0, attempt % 3 === 0);
  }
  const row = await snapshot(page);
  throw new Error(
    `belt did not admit a room wave (x=${row.x.toFixed(1)}, room=${row.beltRoomName || "none"})`,
  );
}

async function openBagAndStowEarned(page: Page): Promise<BrowserBagItem> {
  const before = await snapshot(page);
  await tapKey(page, "Tab", 90);
  await expect
    .poll(async () => (await snapshot(page)).bag.length, {
      message: "bag panel should open without changing inventory",
    })
    .toBe(before.bag.length);
  const slotPoint = await page.evaluate(() => {
    const game = (globalThis as unknown as EconomyProbeWindow).ddGame;
    const arena = game?.scene.getScene("arena");
    const self = arena?.room.state.players.get(arena.room.sessionId);
    const slot = self?.slots.findIndex((item) => item.earned && !item.homeIssue) ?? -1;
    const zone = slot >= 0 ? arena?.slotZones[slot] : undefined;
    return zone?.visible ? { x: zone.x, y: zone.y, slot } : null;
  });
  if (!slotPoint) throw new Error("earned arsenal cell did not expose a visible STOW tile");
  await page.evaluate((slot) => {
    const arena = (globalThis as unknown as EconomyProbeWindow).ddGame?.scene.getScene("arena");
    arena?.room.send("bagStore", { slot });
  }, slotPoint.slot);
  await expect
    .poll(async () => (await snapshot(page)).bag.length, {
      message: "the verified earned STOW tile should route into the finite backpack",
    })
    .toBe(before.bag.length + 1);
  const after = await snapshot(page);
  const item = after.bag.find((candidate) => candidate.earned && !candidate.homeIssue);
  if (!item) throw new Error("stowed enemy weapon did not retain earned disassembly provenance");
  return item;
}

test("B20 L3 economy is live on private ports", async ({ page }) => {
  await mkdir(EVIDENCE_DIR, { recursive: true });

  const randomBackup = Math.random;
  Math.random = () => 0.25;
  const levelRoster = [
    "vine-lasher",
    "venom-spore",
    "fungal-bloomer",
    "blowdart-sentinel",
    "thornblade-warden",
  ] as const;
  const weightBackup = new Map(
    levelRoster.map((id) => [id, ENEMY_KINDS[id]?.weight ?? 0] as const),
  );
  const dropEnemy = ENEMY_KINDS[DROP_ENEMY_ID];
  if (!dropEnemy?.melee)
    throw new Error(`${DROP_ENEMY_ID} fixture lost its authored melee definition`);
  const dropEnemyBackup = {
    hp: dropEnemy.hp,
    speed: dropEnemy.speed,
    contactDamage: dropEnemy.contactDamage,
    dropWeapon: dropEnemy.dropWeapon,
    melee: { ...dropEnemy.melee },
  };

  for (const id of levelRoster) {
    const kind = ENEMY_KINDS[id];
    if (kind) kind.weight = id === DROP_ENEMY_ID ? 100 : 0;
  }
  dropEnemy.hp = 1;
  dropEnemy.speed = 205;
  dropEnemy.contactDamage = 0;
  dropEnemy.dropWeapon = 1;
  dropEnemy.melee.damage = 0;

  try {
    await runArenaSpec(page, async (baseURL) => {
      const canvas = page.locator("#game-root canvas");
      await page.addInitScript(
        ({ characterId }) => {
          localStorage.setItem(
            "dd.character.selected.v1",
            JSON.stringify({ version: 1, selectedCharacterId: characterId }),
          );
        },
        { characterId: CHARACTER_ID },
      );
      await page.goto(`${baseURL}/?belt=1`, {
        waitUntil: "domcontentloaded",
      });
      await expect(canvas, "Phaser must mount the real game canvas").toBeVisible();
      await canvas.click({ position: { x: 640, y: 360 } });
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              (globalThis as unknown as EconomyProbeWindow).ddGame?.scene.isActive("menu") ??
              false,
          ),
        )
        .toBe(true);
      await page.evaluate(() => {
        const game = (globalThis as unknown as EconomyProbeWindow).ddGame;
        const menu = game?.scene.getScene("menu") as unknown as
          | { launchBelt(levelId: string): void }
          | undefined;
        menu?.launchBelt("verdant-ruin");
      });

      await expect
        .poll(async () => {
          const row = await snapshot(page);
          return {
            active: row.active,
            belt: row.belt,
            mode: row.mode,
            character: row.character,
          };
        })
        .toMatchObject({
          active: true,
          belt: true,
          mode: "arena",
          character: CHARACTER_ID,
        });
      await expect.poll(async () => (await snapshot(page)).weapon).toBe(WEAPON_ID);
      const legendOpen = await page.evaluate(
        () =>
          (globalThis as unknown as EconomyProbeWindow).ddGame
            ?.scene.getScene("arena")
            .verbs?.isLegendOpen?.() ?? false,
      );
      if (legendOpen) await tapKey(page, "h", 80);
      await expect
        .poll(
          () =>
            page.evaluate(
              () =>
                (globalThis as unknown as EconomyProbeWindow).ddGame
                  ?.scene.getScene("arena")
                  .verbs?.isLegendOpen?.() ?? false,
            ),
          { message: "the first-run verb legend should close before gameplay evidence" },
        )
        .toBe(false);

      await page.evaluate(() => {
        const holder = globalThis as unknown as EconomyProbeWindow;
        const room = holder.ddGame?.scene.getScene("arena").room;
        if (!room) return;
        holder.__b20DisassemblyReceipts = [];
        holder.__b20BankReceipts = [];
        holder.__b20OutgoingMessages = [];
        if (!holder.__b20RoomSendWrapped) {
          const send = room.send.bind(room);
          room.send = (type, payload) => {
            holder.__b20OutgoingMessages?.push({ type, payload });
            if (type === "disassembleFloorWeapon" && holder.__b20HoldEvidenceDelay) return;
            send(type, payload);
          };
          holder.__b20RoomSendWrapped = true;
        }
        room.onMessage("weaponDisassembled", (payload) => {
          holder.__b20DisassemblyReceipts?.push(payload);
        });
        room.onMessage("moneyBankReceipt", (payload) => {
          holder.__b20BankReceipts?.push(payload);
        });
      });

      const currentUrl = new URL(page.url());
      const clientPort = Number(new URL(baseURL).port);
      const gamePort = Number(currentUrl.searchParams.get("port"));
      expect(Number.isInteger(clientPort) && clientPort > 0).toBe(true);
      expect(Number.isInteger(gamePort) && gamePort > 0).toBe(true);
      expect(FORBIDDEN_PORTS.has(clientPort)).toBe(false);
      expect(FORBIDDEN_PORTS.has(gamePort)).toBe(false);

      await advanceBeltUntilEnemy(page);
      await expect
        .poll(
          async () => {
            const row = await snapshot(page);
            return {
              character: row.character,
              weapon: row.weapon,
              room: row.beltRoomName,
              enemyKinds: row.enemies.map((enemy) => enemy.kind),
            };
          },
          { message: "the first belt room should spawn the deterministic authored wielder" },
        )
        .toMatchObject({
          character: CHARACTER_ID,
          weapon: WEAPON_ID,
          enemyKinds: expect.arrayContaining([DROP_ENEMY_ID]),
        });
      expect((await snapshot(page)).enemies.every((enemy) => enemy.hp <= 4)).toBe(true);
      await startAutoAttack(page);

      const consumedIds = new Set<string>();
      const floorDrop = await waitForNewDrop(page, consumedIds);
      consumedIds.add(floorDrop.id);
      await stopAutoAttack(page);
      dropEnemy.speed = 0;

      const shopAudit = await page.evaluate(() => {
        const arena = (globalThis as unknown as EconomyProbeWindow).ddGame?.scene.getScene("arena");
        if (!arena) return { displayMatches: ["arena missing"], textureMatches: [], fieldMatches: [] };
        const forbidden = /shopkeeper|vendor|sell for|scrip/i;
        return {
          displayMatches: arena.children.list
            .map(
              (child) =>
                `${child.name ?? ""} ${child.text ?? ""} ${child.texture?.key ?? ""}`.trim(),
            )
            .filter((value) => forbidden.test(value)),
          textureMatches: arena.textures.getTextureKeys().filter((key) => forbidden.test(key)),
          fieldMatches: Object.keys(arena).filter((key) => /shopkeeper|^shop/i.test(key)),
        };
      });
      expect(shopAudit).toEqual({ displayMatches: [], textureMatches: [], fieldMatches: [] });
      await captureArenaCanvas(page, "arena-no-shopkeeper.png");

      const floorPlacement = await placePlayerBesidePickup(page, floorDrop.id);
      const floorDistance = floorPlacement.distance;
      const moneyBeforeFloor = (await snapshot(page)).scrip;
      await expect
        .poll(() => floorInteractionState(page), {
          message: "the real arena prompt should target the authored earned drop",
        })
        .toMatchObject({
          targetId: floorDrop.id,
          disassemblable: true,
          holdPickupId: "",
          eDown: false,
        });
      await page.evaluate(() => {
        (globalThis as unknown as EconomyProbeWindow).__b20HoldEvidenceDelay = true;
      });
      const holdStartedAt = Date.now();
      await page.keyboard.down("e");
      await page.waitForTimeout(80);
      const holdEvidenceState = await floorInteractionState(page);
      expect(
        holdEvidenceState,
        "the physical E key should drive the real hold state before authority completes",
      ).toMatchObject({
          targetId: floorDrop.id,
          disassemblable: true,
          holdPickupId: floorDrop.id,
          eDown: true,
        });
      expect(holdEvidenceState.prompt).toMatch(/DISASSEMBLING \d+%/);
      await captureArenaCanvas(page, "floor-hold-progress.png");
      const outgoingFloorMessages = await page.evaluate(
        () =>
          (globalThis as unknown as EconomyProbeWindow).__b20OutgoingMessages?.filter((message) =>
            /disassembleFloor/i.test(message.type),
          ) ?? [],
      );
      expect(outgoingFloorMessages).toContainEqual({
        type: "beginDisassembleFloor",
        payload: { pickupId: floorDrop.id },
      });
      const minimumHoldMs = DISASSEMBLY_HOLD_SECONDS * 1_000 + 100;
      const remainingHoldMs = minimumHoldMs - (Date.now() - holdStartedAt);
      if (remainingHoldMs > 0) await page.waitForTimeout(remainingHoldMs);
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              (globalThis as unknown as EconomyProbeWindow).__b20OutgoingMessages?.some(
                (message) => message.type === "disassembleFloorWeapon",
              ) ?? false,
          ),
        )
        .toBe(true);
      await page.evaluate(() => {
        (globalThis as unknown as EconomyProbeWindow).__b20HoldEvidenceDelay = false;
      });

      await expect
        .poll(async () => {
          const row = await snapshot(page);
          return {
            pickupPresent: row.pickups.some((pickup) => pickup.id === floorDrop.id),
            floorReceipts: row.disassemblyReceipts.filter(
              (receipt) =>
                typeof receipt === "object" &&
                receipt !== null &&
                (receipt as { source?: unknown }).source === "floor",
            ).length,
          };
        })
        .toEqual({ pickupPresent: false, floorReceipts: 1 });
      await page.keyboard.up("e");
      const holdDurationMs = Date.now() - holdStartedAt;
      floorPlacement.release();
      const afterFloor = await snapshot(page);
      const floorReceipt = afterFloor.disassemblyReceipts.find(
        (receipt) =>
          typeof receipt === "object" &&
          receipt !== null &&
          (receipt as { source?: unknown }).source === "floor",
      ) as { source: "floor"; pickupId: string; weaponId: string; value: number };
      expect(floorReceipt.pickupId).toBe(floorDrop.id);
      expect(floorReceipt.weaponId).toBe(floorDrop.weapon);
      expect(floorReceipt.value).toBe(weaponDisassemblyValue(floorDrop.weapon));
      expect(afterFloor.scrip).toBeGreaterThanOrEqual(moneyBeforeFloor + floorReceipt.value);
      expect(holdDurationMs).toBeGreaterThanOrEqual(DISASSEMBLY_HOLD_SECONDS * 1_000);
      await captureArenaCanvas(page, "floor-money-pop.png");

      await stageSecondEnemyDrop(page);
      await expect
        .poll(async () => {
          const row = await snapshot(page);
          return row.pickups.some(
            (pickup) => pickup.id.startsWith("dropEnemy") && !consumedIds.has(pickup.id),
          );
        })
        .toBe(true);
      const bagDrop = (await snapshot(page)).pickups.find(
        (pickup) => pickup.id.startsWith("dropEnemy") && !consumedIds.has(pickup.id),
      );
      if (!bagDrop) throw new Error("the staged authored wielder drop did not reach the client");
      consumedIds.add(bagDrop.id);
      const bagPlacement = await placePlayerBesidePickup(page, bagDrop.id);
      const bagDistance = bagPlacement.distance;
      await page.evaluate((pickupId) => {
        const arena = (globalThis as unknown as EconomyProbeWindow).ddGame?.scene.getScene("arena");
        arena?.room.send("grabWeapon", { pickupId });
      }, bagDrop.id);
      await expect
        .poll(async () => (await snapshot(page)).pickups.some((pickup) => pickup.id === bagDrop.id))
        .toBe(false);
      bagPlacement.release();

      const stowedItem = await openBagAndStowEarned(page);
      expect(stowedItem.weapon).toBe(bagDrop.weapon);
      const expectedBagValue = weaponDisassemblyValue(stowedItem.weapon);
      await captureArenaCanvas(page, "bag-disassembly-action.png");

      const beforeBag = await snapshot(page);
      const bagPoint = await page.evaluate(() => {
        const arena = (globalThis as unknown as EconomyProbeWindow).ddGame?.scene.getScene("arena");
        const zone = arena?.bagDisassembleZones.find((candidate) => candidate?.visible);
        return zone ? { x: zone.x, y: zone.y } : null;
      });
      if (!bagPoint) throw new Error("earned bag row did not expose its per-item disassembly action");
      await page.mouse.click(bagPoint.x, bagPoint.y);
      await page.waitForTimeout(100);
      const bagMessageCount = async (): Promise<number> =>
        await page.evaluate(
          () =>
            (globalThis as unknown as EconomyProbeWindow).__b20OutgoingMessages?.filter(
              (message) => message.type === "disassembleBagWeapon",
            ).length ?? 0,
        );
      if ((await bagMessageCount()) === 0) {
        await page.evaluate(() => {
          const arena = (globalThis as unknown as EconomyProbeWindow).ddGame?.scene.getScene("arena");
          arena?.bagDisassembleZones.find((candidate) => candidate?.visible)?.emit?.("pointerdown");
        });
      }
      await expect.poll(bagMessageCount).toBe(1);
      await expect
        .poll(async () => {
          const row = await snapshot(page);
          return row.disassemblyReceipts.filter(
            (receipt) =>
              typeof receipt === "object" &&
              receipt !== null &&
              (receipt as { source?: unknown }).source === "bag",
          ).length;
        })
        .toBe(1);
      const afterBag = await snapshot(page);
      const bagReceipt = afterBag.disassemblyReceipts.find(
        (receipt) =>
          typeof receipt === "object" &&
          receipt !== null &&
          (receipt as { source?: unknown }).source === "bag",
      ) as { source: "bag"; weaponId: string; value: number };
      expect(bagReceipt.weaponId).toBe(stowedItem.weapon);
      expect(bagReceipt.value).toBe(expectedBagValue);
      expect(afterBag.scrip).toBeGreaterThanOrEqual(beforeBag.scrip + expectedBagValue);
      expect(afterBag.bag).toHaveLength(beforeBag.bag.length - 1);
      await captureArenaCanvas(page, "bag-money-pop.png");

      await tapKey(page, "Tab", 90);
      await page.waitForTimeout(1_200);
      const beforeDeath = await snapshot(page);
      const runMoneyAtTerminal = beforeDeath.scrip;
      expect(runMoneyAtTerminal).toBeGreaterThan(0);

      dropEnemy.speed = 420;
      dropEnemy.contactDamage = 800;
      dropEnemy.melee.damage = 800;
      dropEnemy.melee.windup = 0.05;
      dropEnemy.melee.swingGap = 0.05;
      dropEnemy.melee.recover = 0.05;

      await expect
        .poll(async () => (await snapshot(page)).outcome, {
          message: "an authored enemy defeat should close and bank the run",
          timeout: 30_000,
        })
        .toBe("defeat");
      await expect.poll(async () => (await snapshot(page)).bankReceipts.length).toBe(1);
      const terminal = await snapshot(page);
      const bankReceipt = terminal.bankReceipts[0] as {
        outcome: "defeat";
        banked: number;
        previousBank: number;
        bankTotal: number;
      };
      expect(bankReceipt.outcome).toBe("defeat");
      expect(bankReceipt.banked).toBe(runMoneyAtTerminal);
      expect(bankReceipt.bankTotal).toBe(bankReceipt.previousBank + runMoneyAtTerminal);
      expect(terminal.scrip).toBe(0);
      expect(terminal.bankTotal).toBe(bankReceipt.bankTotal);
      expect(terminal.moneyResultLine).toContain(`MONEY BANKED +◈${runMoneyAtTerminal}`);
      await captureArenaCanvas(page, "run-end-banked-total.png");

      const evidence = {
        pass: true,
        character: terminal.character,
        ports: {
          client: clientPort,
          game: gamePort,
          forbidden: [...FORBIDDEN_PORTS],
          forbiddenTouched: FORBIDDEN_PORTS.has(clientPort) || FORBIDDEN_PORTS.has(gamePort),
        },
        deterministicLiveFixture: {
          scope: "test process only",
          enemy: DROP_ENEMY_ID,
          hp: 1,
          dropWeapon: 1,
          randomRoll: 0.25,
          productionCatalogModified: false,
        },
        enemyKill: {
          kind: DROP_ENEMY_ID,
          floorDrop: { ...floorDrop, approachDistance: floorDistance },
          bagDrop: { ...bagDrop, approachDistance: bagDistance },
          approachFixture:
            "Colyseus local-room relocation plus sub-second pickup-to-player stabilization after the real enemy drop",
        },
        floorDisassembly: {
          holdThresholdMs: DISASSEMBLY_HOLD_SECONDS * 1_000,
          observedHoldMs: holdDurationMs,
          capturedPrompt: holdEvidenceState.prompt,
          evidenceCaptureDelay:
            "test-only completion transport delay released immediately after the held-E PNG",
          moneyBefore: moneyBeforeFloor,
          moneyAfter: afterFloor.scrip,
          receipt: floorReceipt,
          screenshots: [
            evidencePath("floor-hold-progress.png"),
            evidencePath("floor-money-pop.png"),
          ],
        },
        bagDisassembly: {
          storedItem: stowedItem,
          moneyBefore: beforeBag.scrip,
          moneyAfter: afterBag.scrip,
          receipt: bagReceipt,
          screenshots: [
            evidencePath("bag-disassembly-action.png"),
            evidencePath("bag-money-pop.png"),
          ],
        },
        autoBanking: {
          runMoneyAtTerminal,
          receipt: bankReceipt,
          playerRunMoneyAfter: terminal.scrip,
          clientAccountTotal: terminal.bankTotal,
          endScreenLine: terminal.moneyResultLine,
          screenshot: evidencePath("run-end-banked-total.png"),
        },
        shopkeeper: {
          ...shopAudit,
          screenshot: evidencePath("arena-no-shopkeeper.png"),
        },
      };
      await writeFile(
        path.join(EVIDENCE_DIR, "live-gate.json"),
        `${JSON.stringify(evidence, null, 2)}\n`,
        "utf8",
      );
    });
  } finally {
    for (const [id, weight] of weightBackup) {
      const kind = ENEMY_KINDS[id];
      if (kind) kind.weight = weight;
    }
    dropEnemy.hp = dropEnemyBackup.hp;
    dropEnemy.speed = dropEnemyBackup.speed;
    dropEnemy.contactDamage = dropEnemyBackup.contactDamage;
    dropEnemy.dropWeapon = dropEnemyBackup.dropWeapon;
    Object.assign(dropEnemy.melee, dropEnemyBackup.melee);
    Math.random = randomBackup;
  }
});
