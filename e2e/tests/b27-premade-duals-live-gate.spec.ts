import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { CHEST_KIND_STANDARD, ChestState, MAP_ZONE_SCAR, rollChestReward } from "@dd/shared";
import { expect, type Page, test } from "@playwright/test";
import { matchMaker } from "../../packages/server/node_modules/colyseus/build/index.mjs";
import { bootArena, runArenaSpec } from "../helpers/arena-harness.js";

const EVIDENCE_DIR = path.resolve(
  import.meta.dirname,
  "../../docs/owner-notes-audit-v11-evidence/b27-premade-duals",
);
const CHARACTER_ID = "proto-cowboy-hidden-face";
const AUTHORED_DUAL_ID = "x2-knucklebone-talons";
const ONE_HAND_LEAD_ID = "rattler-sabre";
const ONE_HAND_SECOND_ID = "x2-sandsong-saber";
const FORBIDDEN_PORTS = new Set([5180, 2567]);

interface BrowserRelics {
  energyPool: number;
  energyRegen: number;
  parryReach: number;
  dodgeRecovery: number;
  moveSpeed: number;
  hpRegen: number;
  luck: number;
  crit: number;
  jumpCount: number;
  ownedRare: string;
  activeDodge: string;
  reviveAvailable: boolean;
  deathWardReadyTick: number;
  airJumpsRemaining: number;
}

interface BrowserTail {
  retiredByte0: number;
  retiredUint32: number;
  retiredByte1: number;
  retiredByte2: number;
  gearUpper: string;
  gearLower: string;
  weaponResource: {
    valueQ: number;
    regenMode: number;
    beamLockEndTick: number;
  };
  prestige: number;
  relics: BrowserRelics;
}

interface BrowserSlot {
  weapon: string;
}

interface BrowserPlayer {
  id: string;
  x: number;
  y: number;
  character: string;
  runCharacter: string;
  weapon: string;
  activeSlot: number;
  attackSeq: number;
  slots: BrowserSlot[];
  dualWield: BrowserTail;
}

interface BrowserWeaponPiece {
  def: { id: string };
  spriteId: string;
  partIndex: 0 | 1;
  img: {
    alpha: number;
    visible: boolean;
    active: boolean;
    displayWidth: number;
    displayHeight: number;
    texture: { key: string };
  };
}

interface BrowserRig {
  weapons: BrowserWeaponPiece[];
  attackBeatSeq: number;
  swingHand: 0 | 1 | "both";
  authoredDualBarStep: number;
  authoredDualBarExpiresAtMs: number;
  swingStart: number;
  activeSwing?: { authoredDualStep?: number; hand?: 0 | 1 | "both" };
}

interface BrowserRoom {
  roomId: string;
  sessionId: string;
  send(type: string, payload?: unknown): void;
  onMessage(type: string, callback: (payload: unknown) => void): (() => void) | undefined;
  state: {
    mode: string;
    players: {
      get(id: string): BrowserPlayer | undefined;
    };
  };
}

interface BrowserArena {
  room: BrowserRoom;
  blobs: {
    get(id: string): BrowserRig | undefined;
  };
  game: { hasFocus: boolean };
  pointerOverInteractiveUi: boolean;
  time: { now: number };
  verbs?: {
    isLegendOpen?(): boolean;
    toggleLegend?(nowMs: number): void;
    releaseInputLatchIf?(release: boolean): void;
  };
}

interface BrowserGlobal {
  ddGame: {
    scene: {
      getScene(key: "arena"): BrowserArena;
    };
  };
}

interface ServerSlot {
  weapon: string;
  rarity: number;
  affix: string;
  earned: boolean;
  resourceReady: boolean;
}

interface ServerPlayer {
  id: string;
  x: number;
  y: number;
  weapon: string;
  activeSlot: number;
  slots: ServerSlot[];
  dualWield: BrowserTail;
}

interface LocalGameRoom {
  state: {
    tick: number;
    players: {
      get(id: string): ServerPlayer | undefined;
    };
    chests: {
      set(id: string, chest: ChestState): void;
    };
  };
  chestRoomSeed: number;
  chestRunStartTick: number;
  broadcastPatch?(): void;
}

interface WeaponRenderEvidence {
  weapon: string;
  attackSeq: number;
  attackBeatSeq: number;
  swingHand: 0 | 1 | "both";
  authoredDualBarStep: number;
  authoredDualBarExpiresAtMs: number;
  swingStart: number;
  activeSwingStep?: number;
  activeSwingHand?: 0 | 1 | "both";
  pieces: Array<{
    defId: string;
    spriteId: string;
    partIndex: 0 | 1;
    visible: boolean;
    active: boolean;
    alpha: number;
    displayWidth: number;
    displayHeight: number;
    textureKey: string;
  }>;
}

function relicOwnershipCount(relics: BrowserRelics): number {
  return (
    relics.energyPool +
    relics.energyRegen +
    relics.parryReach +
    relics.dodgeRecovery +
    relics.moveSpeed +
    relics.hpRegen +
    relics.luck +
    relics.crit +
    relics.jumpCount +
    (relics.ownedRare ? relics.ownedRare.split(",").filter(Boolean).length : 0)
  );
}

async function arenaIdentity(page: Page): Promise<{ roomId: string; sessionId: string }> {
  const identity = await page.evaluate(() => {
    const room = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena").room;
    return { roomId: room.roomId, sessionId: room.sessionId };
  });
  if (!identity.roomId || !identity.sessionId)
    throw new Error("B27 live room identity unavailable");
  return identity;
}

function localGameRoom(roomId: string): LocalGameRoom {
  const room = matchMaker.getLocalRoomById(roomId) as unknown as LocalGameRoom | undefined;
  if (!room) throw new Error(`B27 local room ${roomId} unavailable`);
  return room;
}

async function prepareArenaInput(page: Page): Promise<void> {
  await page.locator("#game-root canvas").click({ position: { x: 640, y: 360 } });
  await page.evaluate(() => {
    const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
    if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend?.(arena.time.now);
    arena.verbs?.releaseInputLatchIf?.(true);
    arena.game.hasFocus = true;
    arena.pointerOverInteractiveUi = false;
  });
}

async function equipDevWeapon(page: Page, weapon: string): Promise<void> {
  await page.evaluate(
    ({ wantedWeapon, character }) => {
      const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
      arena.room.send("devEquip", { weapon: wantedWeapon, character });
    },
    { wantedWeapon: weapon, character: CHARACTER_ID },
  );
  await expect
    .poll(
      () =>
        page.evaluate((wanted) => {
          const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
          const self = arena.room.state.players.get(arena.room.sessionId);
          return {
            weapon: self?.weapon,
            character: self?.character,
            runCharacter: self?.runCharacter,
            pieces: arena.blobs.get(arena.room.sessionId)?.weapons.length ?? 0,
            wanted,
          };
        }, weapon),
      { message: `B27 dev equip should settle for ${weapon}` },
    )
    .toMatchObject({ weapon, character: CHARACTER_ID, runCharacter: CHARACTER_ID });
}

async function renderEvidence(page: Page): Promise<WeaponRenderEvidence> {
  return page.evaluate(() => {
    const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
    const self = arena.room.state.players.get(arena.room.sessionId);
    const rig = arena.blobs.get(arena.room.sessionId);
    if (!self || !rig) throw new Error("B27 render evidence lost the live self rig");
    return {
      weapon: self.weapon,
      attackSeq: self.attackSeq,
      attackBeatSeq: rig.attackBeatSeq,
      swingHand: rig.swingHand,
      authoredDualBarStep: rig.authoredDualBarStep,
      authoredDualBarExpiresAtMs: rig.authoredDualBarExpiresAtMs,
      swingStart: rig.swingStart,
      activeSwingStep: rig.activeSwing?.authoredDualStep,
      activeSwingHand: rig.activeSwing?.hand,
      pieces: rig.weapons.map((piece) => ({
        defId: piece.def.id,
        spriteId: piece.spriteId,
        partIndex: piece.partIndex,
        visible: piece.img.visible,
        active: piece.img.active,
        alpha: piece.img.alpha,
        displayWidth: piece.img.displayWidth,
        displayHeight: piece.img.displayHeight,
        textureKey: piece.img.texture.key,
      })),
    };
  });
}

async function captureAuthoredCombo(page: Page): Promise<WeaponRenderEvidence[]> {
  return page.evaluate(
    () =>
      new Promise<WeaponRenderEvidence[]>((resolve, reject) => {
        const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
        const self = arena.room.state.players.get(arena.room.sessionId);
        const rig = arena.blobs.get(arena.room.sessionId);
        if (!self || !rig) {
          reject(new Error("B27 authored combo lost the live self rig"));
          return;
        }
        const captures: WeaponRenderEvidence[] = [];
        const expectedHands: Array<0 | 1 | "both"> = [0, 1, 0, 1, 0, "both"];
        let lastSeq = rig.attackBeatSeq;
        const attack = () => {
          const current = arena.room.state.players.get(arena.room.sessionId);
          if (!current) return;
          arena.room.send("attack", {
            aimX: 1,
            aimY: 0,
            tx: current.x + 120,
            ty: current.y,
          });
        };
        const attackTimer = window.setInterval(attack, 50);
        const timeout = window.setTimeout(() => {
          window.clearInterval(attackTimer);
          reject(
            new Error(
              `B27 authored combo captured ${captures.length}/6 beats: ${JSON.stringify(captures)}`,
            ),
          );
        }, 20_000);
        const sample = () => {
          const current = arena.room.state.players.get(arena.room.sessionId);
          const currentRig = arena.blobs.get(arena.room.sessionId);
          if (!current || !currentRig) return;
          const advance = (currentRig.attackBeatSeq - lastSeq) >>> 0;
          if (advance > 0 && advance < 0x8000_0000) {
            lastSeq = currentRig.attackBeatSeq;
            captures.push({
              weapon: current.weapon,
              attackSeq: current.attackSeq,
              attackBeatSeq: currentRig.attackBeatSeq,
              swingHand: currentRig.swingHand,
              authoredDualBarStep: currentRig.authoredDualBarStep,
              authoredDualBarExpiresAtMs: currentRig.authoredDualBarExpiresAtMs,
              swingStart: currentRig.swingStart,
              activeSwingStep: currentRig.activeSwing?.authoredDualStep,
              activeSwingHand: currentRig.activeSwing?.hand,
              pieces: currentRig.weapons.map((piece) => ({
                defId: piece.def.id,
                spriteId: piece.spriteId,
                partIndex: piece.partIndex,
                visible: piece.img.visible,
                active: piece.img.active,
                alpha: piece.img.alpha,
                displayWidth: piece.img.displayWidth,
                displayHeight: piece.img.displayHeight,
                textureKey: piece.img.texture.key,
              })),
            });
          }
          const candidate = captures.slice(-expectedHands.length);
          if (
            candidate.length === expectedHands.length &&
            candidate.every((capture, index) => capture.swingHand === expectedHands[index])
          ) {
            window.clearInterval(attackTimer);
            window.clearTimeout(timeout);
            resolve(candidate);
            return;
          }
          requestAnimationFrame(sample);
        };
        attack();
        requestAnimationFrame(sample);
      }),
  );
}

async function stageIndependentSecondSlot(page: Page): Promise<void> {
  const identity = await arenaIdentity(page);
  const room = localGameRoom(identity.roomId);
  const player = room.state.players.get(identity.sessionId);
  const slot = player?.slots[1];
  if (!player || !slot) throw new Error("B27 second active slot unavailable");
  slot.weapon = ONE_HAND_SECOND_ID;
  slot.rarity = 0;
  slot.affix = "";
  slot.earned = false;
  slot.resourceReady = false;
  room.broadcastPatch?.();
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
          return arena.room.state.players.get(arena.room.sessionId)?.slots[1]?.weapon ?? "";
        }),
      { message: "B27 staged same-class second slot should reach the real client" },
    )
    .toBe(ONE_HAND_SECOND_ID);
}

async function switchSlot(page: Page, slot: number, weapon: string): Promise<WeaponRenderEvidence> {
  await page.evaluate((wantedSlot) => {
    const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
    arena.room.send("swapSlot", { slot: wantedSlot });
  }, slot);
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
          const self = arena.room.state.players.get(arena.room.sessionId);
          const rig = arena.blobs.get(arena.room.sessionId);
          return {
            activeSlot: self?.activeSlot,
            weapon: self?.weapon,
            rigPieces: rig?.weapons.length ?? 0,
          };
        }),
      { message: `B27 slot ${slot} should equip independently` },
    )
    .toEqual({ activeSlot: slot, weapon, rigPieces: 1 });
  return renderEvidence(page);
}

async function compatSnapshot(page: Page): Promise<{
  tombstones: [number, number, number, number];
  unrelated: {
    gearUpper: string;
    gearLower: string;
    weaponResource: BrowserTail["weaponResource"];
    prestige: number;
  };
  relics: BrowserRelics;
  oldPairPropertiesPresent: string[];
}> {
  return page.evaluate(() => {
    const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
    const tail = arena.room.state.players.get(arena.room.sessionId)?.dualWield;
    if (!tail) throw new Error("B27 compatibility row unavailable");
    const oldNames = ["offhandSlot", "pairBaseSeq", "offCharges", "offMaxCharges"];
    return {
      tombstones: [tail.retiredByte0, tail.retiredUint32, tail.retiredByte1, tail.retiredByte2],
      unrelated: {
        gearUpper: tail.gearUpper,
        gearLower: tail.gearLower,
        weaponResource: {
          valueQ: tail.weaponResource.valueQ,
          regenMode: tail.weaponResource.regenMode,
          beamLockEndTick: tail.weaponResource.beamLockEndTick,
        },
        prestige: tail.prestige,
      },
      relics: {
        energyPool: tail.relics.energyPool,
        energyRegen: tail.relics.energyRegen,
        parryReach: tail.relics.parryReach,
        dodgeRecovery: tail.relics.dodgeRecovery,
        moveSpeed: tail.relics.moveSpeed,
        hpRegen: tail.relics.hpRegen,
        luck: tail.relics.luck,
        crit: tail.relics.crit,
        jumpCount: tail.relics.jumpCount,
        ownedRare: tail.relics.ownedRare,
        activeDodge: tail.relics.activeDodge,
        reviveAvailable: tail.relics.reviveAvailable,
        deathWardReadyTick: tail.relics.deathWardReadyTick,
        airJumpsRemaining: tail.relics.airJumpsRemaining,
      },
      oldPairPropertiesPresent: oldNames.filter((name) => name in tail),
    };
  });
}

async function stageDeterministicRelicChest(page: Page): Promise<{
  chestId: string;
  roomSeed: number;
  expectedRelics: ReturnType<typeof rollChestReward>["relics"];
}> {
  const identity = await arenaIdentity(page);
  const room = localGameRoom(identity.roomId);
  const player = room.state.players.get(identity.sessionId);
  if (!player) throw new Error("B27 authoritative player unavailable for relic chest");
  const chestSequence = 27;
  const spawnTick = room.state.tick;
  let roomSeed = 1;
  let expected = rollChestReward({
    roomSeed,
    chestSequence,
    spawnTick,
    elapsedSeconds: 0,
    zone: MAP_ZONE_SCAR,
    kind: CHEST_KIND_STANDARD,
    playerKey: identity.sessionId,
    luckStacks: player.dualWield.relics.luck,
    ownedRareIds: [],
    weaponIds: [],
  });
  while (expected.relics.length === 0 && roomSeed < 10_000) {
    roomSeed++;
    expected = rollChestReward({
      roomSeed,
      chestSequence,
      spawnTick,
      elapsedSeconds: 0,
      zone: MAP_ZONE_SCAR,
      kind: CHEST_KIND_STANDARD,
      playerKey: identity.sessionId,
      luckStacks: player.dualWield.relics.luck,
      ownedRareIds: [],
      weaponIds: [],
    });
  }
  if (expected.relics.length === 0)
    throw new Error("B27 could not select a deterministic relic seed");

  room.chestRoomSeed = roomSeed;
  room.chestRunStartTick = spawnTick;
  const chest = new ChestState();
  chest.id = `chest:${chestSequence}:${spawnTick}`;
  chest.x = player.x;
  chest.y = player.y;
  chest.zone = MAP_ZONE_SCAR;
  chest.kind = CHEST_KIND_STANDARD;
  chest.spawnTick = spawnTick;
  chest.openedBy.set(player.id, false);
  room.state.chests.set(chest.id, chest);
  room.broadcastPatch?.();
  return { chestId: chest.id, roomSeed, expectedRelics: expected.relics };
}

async function openRelicChest(page: Page, chestId: string): Promise<unknown> {
  return page.evaluate(
    (wantedChestId) =>
      new Promise<unknown>((resolve, reject) => {
        const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
        const timeout = window.setTimeout(
          () => reject(new Error(`B27 chest ${wantedChestId} did not return a receipt`)),
          10_000,
        );
        const unsubscribe = arena.room.onMessage("chestOpened", (payload) => {
          window.clearTimeout(timeout);
          unsubscribe?.();
          resolve(payload);
        });
        arena.room.send("openChest", { chestId: wantedChestId });
      }),
    chestId,
  );
}

test("B27 keeps authored duals and relics while independent 1H slots never compose", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await mkdir(EVIDENCE_DIR, { recursive: true });

  await runArenaSpec(page, async (baseURL) => {
    const clientPort = Number(new URL(baseURL).port);
    expect(FORBIDDEN_PORTS.has(clientPort), "client port must be private ephemeral").toBe(false);
    await bootArena(page, baseURL, `char:${CHARACTER_ID}`);
    await prepareArenaInput(page);
    await equipDevWeapon(page, AUTHORED_DUAL_ID);

    await expect
      .poll(() => renderEvidence(page), {
        message: "B27 authored dual should resolve both visible sprite parts",
      })
      .toMatchObject({
        weapon: AUTHORED_DUAL_ID,
        pieces: [
          {
            defId: AUTHORED_DUAL_ID,
            spriteId: AUTHORED_DUAL_ID,
            partIndex: 0,
            visible: true,
            active: true,
          },
          {
            defId: AUTHORED_DUAL_ID,
            spriteId: AUTHORED_DUAL_ID,
            partIndex: 1,
            visible: true,
            active: true,
          },
        ],
      });
    const authoredIdle = await renderEvidence(page);
    expect(authoredIdle.pieces.every((piece) => piece.alpha > 0)).toBe(true);
    expect(
      authoredIdle.pieces.every((piece) => piece.displayWidth > 0 && piece.displayHeight > 0),
    ).toBe(true);
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, "authored-dual-two-sprites.png"),
      fullPage: true,
    });

    // Page-side held cadence keeps Playwright RPC latency out of the combat clock. Every request still
    // crosses the real room transport and is accepted only by the server's authored cooldown.
    const combo = await captureAuthoredCombo(page);
    expect(combo.map((sample) => sample.swingHand)).toEqual([0, 1, 0, 1, 0, "both"]);
    expect(combo.every((sample) => sample.pieces.length === 2)).toBe(true);

    await equipDevWeapon(page, ONE_HAND_LEAD_ID);
    await expect
      .poll(() => renderEvidence(page))
      .toMatchObject({ weapon: ONE_HAND_LEAD_ID, pieces: [{ defId: ONE_HAND_LEAD_ID }] });
    expect((await renderEvidence(page)).pieces).toHaveLength(1);
    await stageIndependentSecondSlot(page);
    const leadSlot = await switchSlot(page, 0, ONE_HAND_LEAD_ID);
    const secondSlot = await switchSlot(page, 1, ONE_HAND_SECOND_ID);
    const leadAgain = await switchSlot(page, 0, ONE_HAND_LEAD_ID);
    expect([leadSlot, secondSlot, leadAgain].every((sample) => sample.pieces.length === 1)).toBe(
      true,
    );
    const independentState = await page.evaluate(() => {
      const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
      const self = arena.room.state.players.get(arena.room.sessionId);
      const tail = self?.dualWield as unknown as Record<string, unknown> | undefined;
      return {
        activeSlot: self?.activeSlot,
        weapon: self?.weapon,
        slots: self?.slots.slice(0, 2).map((slot) => slot.weapon),
        oldPairPropertiesPresent: tail
          ? ["offhandSlot", "pairBaseSeq", "offCharges", "offMaxCharges"].filter(
              (name) => name in tail,
            )
          : ["missing-tail"],
      };
    });
    expect(independentState).toMatchObject({
      activeSlot: 0,
      weapon: ONE_HAND_LEAD_ID,
      slots: [ONE_HAND_LEAD_ID, ONE_HAND_SECOND_ID],
      oldPairPropertiesPresent: [],
    });
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, "independent-one-hand-slots.png"),
      fullPage: true,
    });

    await page.evaluate(() => {
      const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
      arena.room.send("toggleTraining");
    });
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena").room.state
                .mode,
          ),
        { message: "B27 relic check should return to the real arena run" },
      )
      .toBe("arena");
    const compatBefore = await compatSnapshot(page);
    expect(compatBefore.tombstones).toEqual([255, 0, 0, 0]);
    expect(compatBefore.oldPairPropertiesPresent).toEqual([]);
    const stagedChest = await stageDeterministicRelicChest(page);
    const receipt = (await openRelicChest(page, stagedChest.chestId)) as {
      chestId?: string;
      relics?: Array<{ id?: string; rarity?: string; stacks?: number }>;
    };
    expect(receipt.chestId).toBe(stagedChest.chestId);
    expect(receipt.relics?.length ?? 0).toBeGreaterThan(0);
    await expect
      .poll(async () => relicOwnershipCount((await compatSnapshot(page)).relics), {
        message: "B27 relic pickup should update the nested compatibility tenant",
      })
      .toBeGreaterThan(relicOwnershipCount(compatBefore.relics));
    const compatAfter = await compatSnapshot(page);
    expect(compatAfter.tombstones).toEqual(compatBefore.tombstones);
    expect({
      gearUpper: compatAfter.unrelated.gearUpper,
      gearLower: compatAfter.unrelated.gearLower,
      prestige: compatAfter.unrelated.prestige,
      weaponResourceValueQ: compatAfter.unrelated.weaponResource.valueQ,
      weaponResourceBeamLockEndTick: compatAfter.unrelated.weaponResource.beamLockEndTick,
    }).toEqual({
      gearUpper: compatBefore.unrelated.gearUpper,
      gearLower: compatBefore.unrelated.gearLower,
      prestige: compatBefore.unrelated.prestige,
      weaponResourceValueQ: compatBefore.unrelated.weaponResource.valueQ,
      weaponResourceBeamLockEndTick: compatBefore.unrelated.weaponResource.beamLockEndTick,
    });
    expect([0, 1, 2]).toContain(compatAfter.unrelated.weaponResource.regenMode);
    expect(compatAfter.oldPairPropertiesPresent).toEqual([]);
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, "relic-pickup-compat-container.png"),
      fullPage: true,
    });

    const gamePort = Number(new URL(page.url()).searchParams.get("port"));
    expect(Number.isFinite(gamePort), "private game port should be injected").toBe(true);
    expect(FORBIDDEN_PORTS.has(gamePort), "game port must be private ephemeral").toBe(false);
    const evidence = {
      generatedAt: new Date().toISOString(),
      ports: { client: clientPort, game: gamePort },
      forbiddenPorts: [...FORBIDDEN_PORTS],
      characterId: CHARACTER_ID,
      authoredDual: {
        weaponId: AUTHORED_DUAL_ID,
        idle: authoredIdle,
        combo: combo.map((sample) => ({
          attackSeq: sample.attackSeq,
          attackBeatSeq: sample.attackBeatSeq,
          swingHand: sample.swingHand,
          pieceCount: sample.pieces.length,
        })),
        expectedHands: [0, 1, 0, 1, 0, "both"],
        screenshot:
          "docs/owner-notes-audit-v11-evidence/b27-premade-duals/authored-dual-two-sprites.png",
      },
      independentSlots: {
        leadWeaponId: ONE_HAND_LEAD_ID,
        secondWeaponId: ONE_HAND_SECOND_ID,
        state: independentState,
        samples: [leadSlot, secondSlot, leadAgain],
        screenshot:
          "docs/owner-notes-audit-v11-evidence/b27-premade-duals/independent-one-hand-slots.png",
      },
      compatibilityContainer: {
        before: compatBefore,
        after: compatAfter,
        relicReceipt: receipt,
        deterministicChest: stagedChest,
        relicOwnershipBefore: relicOwnershipCount(compatBefore.relics),
        relicOwnershipAfter: relicOwnershipCount(compatAfter.relics),
        screenshot:
          "docs/owner-notes-audit-v11-evidence/b27-premade-duals/relic-pickup-compat-container.png",
      },
      assertions: {
        authoredDualBothSpritesVisible:
          authoredIdle.pieces.length === 2 &&
          authoredIdle.pieces.every((piece) => piece.visible && piece.active && piece.alpha > 0),
        authoredDualComboHands:
          JSON.stringify(combo.map((sample) => sample.swingHand)) ===
          JSON.stringify([0, 1, 0, 1, 0, "both"]),
        independentSlotsNeverCompose:
          independentState.oldPairPropertiesPresent.length === 0 &&
          [leadSlot, secondSlot, leadAgain].every((sample) => sample.pieces.length === 1),
        relicPickupApplied:
          relicOwnershipCount(compatAfter.relics) > relicOwnershipCount(compatBefore.relics),
        unrelatedCompatTenantsPreserved:
          compatAfter.unrelated.gearUpper === compatBefore.unrelated.gearUpper &&
          compatAfter.unrelated.gearLower === compatBefore.unrelated.gearLower &&
          compatAfter.unrelated.prestige === compatBefore.unrelated.prestige &&
          compatAfter.unrelated.weaponResource.valueQ ===
            compatBefore.unrelated.weaponResource.valueQ &&
          compatAfter.unrelated.weaponResource.beamLockEndTick ===
            compatBefore.unrelated.weaponResource.beamLockEndTick &&
          [0, 1, 2].includes(compatAfter.unrelated.weaponResource.regenMode),
      },
    };
    await writeFile(
      path.join(EVIDENCE_DIR, "live-gate.json"),
      `${JSON.stringify(evidence, null, 2)}\n`,
      "utf8",
    );
    await writeFile(
      path.join(EVIDENCE_DIR, "README.md"),
      [
        "# B27 pre-made duals private live gate",
        "",
        `Real Testing Grounds + arena gate on private ephemeral client/game ports ${clientPort}/${gamePort}.`,
        `Character: \`${CHARACTER_ID}\`. Authored dual: \`${AUTHORED_DUAL_ID}\`.`,
        `Independent same-class 1H slots: \`${ONE_HAND_LEAD_ID}\` and \`${ONE_HAND_SECOND_ID}\`.`,
        "",
        "- `authored-dual-two-sprites.png`: both parts from the one authored definition are live.",
        "- Six accepted melee beats routed `lead/off/lead/off/lead/both` with two render pieces throughout.",
        "- `independent-one-hand-slots.png`: each selected 1H slot renders exactly one weapon; no pairing fields exist.",
        "- `relic-pickup-compat-container.png`: a real `openChest` message applied the deterministic relic receipt.",
        "- `live-gate.json`: ports, render pieces, accepted combo beats, independent slot state, tombstones, unrelated tenants, and relic before/after state.",
        "",
        "The harness used `startSpecStack`, so ports 5180 and 2567 were neither bound nor touched.",
        "",
      ].join("\n"),
      "utf8",
    );
  });
});
