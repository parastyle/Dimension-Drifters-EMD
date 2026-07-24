import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { bootArena, runArenaSpec, waitForDevWeapon } from "../helpers/arena-harness.js";

const EVIDENCE_DIR = path.resolve(
  import.meta.dirname,
  "../../docs/owner-notes-audit-v10-evidence/b13-wyrmskull",
);
const WEAPON_ID = "x2-wyrmskull-reliquary";
const OPEN_FRAME_ID = "x2-wyrmskull-reliquary-open";
const CHARACTER_ID = "proto-cowboy-hidden-face";
const FORBIDDEN_PORTS = new Set([5180, 2567]);
const FACINGS = ["right", "left"] as const;

type Facing = (typeof FACINGS)[number];
type Viewpoint = "local" | "remote";

interface BrowserPlayer {
  ackSeq: number;
  aimDir: number;
  attackHeld: boolean;
  attackSeq: number;
  character?: string;
  weapon?: string;
  x: number;
  y: number;
}

interface BrowserImage {
  active: boolean;
  displayOriginX: number;
  displayOriginY: number;
  height: number;
  originX: number;
  originY: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  texture: { key: string };
  visible: boolean;
  width: number;
  x: number;
  y: number;
}

interface BrowserWeaponState {
  baseScale: number;
  closedBaseScale: number;
  closedTextureKey: string;
  firingFrame?: {
    originX: number;
    originY: number;
    sourceScale: number;
    spriteId: string;
    textureKey: string;
  };
  firingFrameVisible: boolean;
  img: BrowserImage;
}

interface BrowserRig {
  facing: number;
  root: {
    getWorldTransformMatrix(): {
      a: number;
      b: number;
      c: number;
      d: number;
      tx: number;
      ty: number;
    };
    scaleX: number;
  };
  weapons: BrowserWeaponState[];
  writeWeaponMuzzleForShot(
    acceptedSeq: number,
    barrelIndex: number,
    out: { x: number; y: number },
  ): boolean;
  x: number;
  y: number;
}

interface BrowserArena {
  animClock: number;
  blobs: Map<string, BrowserRig>;
  cameras: {
    main: {
      height: number;
      setZoom(value: number): void;
      setScroll(x: number, y: number): void;
      stopFollow(): void;
      width: number;
      zoom: number;
    };
  };
  game: { hasFocus: boolean };
  pointerOverInteractiveUi: boolean;
  room: {
    roomId: string;
    sessionId: string;
    send(type: string, message?: unknown): void;
    state: {
      players: {
        get(id: string): BrowserPlayer | undefined;
      };
    };
  };
  scene: { pause(): void; resume(): void };
  textures: { exists(key: string): boolean };
  time: { now: number };
  verbs?: {
    isLegendOpen?(): boolean;
    releaseInputLatchIf?(force: boolean): void;
    toggleLegend?(timeMs: number): void;
  };
}

interface BrowserGlobal {
  ddGame: { scene: { getScene(key: string): BrowserArena } };
  __ddB13FrameWatch?: {
    matched: boolean;
    samples: Array<Record<string, unknown>>;
  };
}

interface FrameState {
  acceptedTick: number;
  attackSeq: number;
  baseScale: number;
  character: string | null;
  closedBaseScale: number;
  closedTextureKey: string;
  clockTick: number;
  facing: number;
  firingFrameId: string | null;
  firingFrameVisible: boolean;
  gripWorld: { x: number; y: number };
  image: {
    active: boolean;
    height: number;
    originX: number;
    originY: number;
    rotation: number;
    scaleX: number;
    scaleY: number;
    visible: boolean;
    width: number;
    x: number;
    y: number;
  };
  muzzle: { ok: boolean; x: number; y: number };
  rootScaleX: number;
  sourceScale: number;
  textureKey: string;
  weapon: string | null;
}

interface FacingCapture {
  viewpoint: Viewpoint;
  sourceId: string;
  facing: Facing;
  attackSeqBefore: number;
  idle: FrameState;
  release: FrameState;
  after: FrameState;
  screenshots: {
    idle: string;
    release: string;
    after: string;
  };
}

interface RawPlayer extends BrowserPlayer {}

interface RawRoom {
  roomId: string;
  sessionId: string;
  send(type: string, message?: unknown): void;
  leave(): Promise<unknown>;
  state: {
    players: {
      get(id: string): RawPlayer | undefined;
    };
  };
}

function relativeEvidencePath(file: string): string {
  return path.relative(process.cwd(), file).replaceAll("\\", "/");
}

function expectedFacing(facing: Facing): number {
  return facing === "right" ? 1 : -1;
}

async function prepare(page: Page): Promise<void> {
  await page.setViewportSize({ width: 960, height: 540 });
  await page.locator("#game-root canvas").click({ position: { x: 480, y: 270 } });
  await page.evaluate(() => {
    const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
    if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend?.(arena.time.now);
    arena.verbs?.releaseInputLatchIf?.(true);
    arena.game.hasFocus = true;
    arena.pointerOverInteractiveUi = false;
    arena.cameras.main.stopFollow();
    arena.cameras.main.setZoom(2.35);
  });
}

async function equipLocalFixture(page: Page): Promise<void> {
  await page.evaluate(
    ({ characterId, weaponId }) => {
      const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
      arena.room.send("devEquip", { character: characterId, weapon: weaponId });
    },
    { characterId: CHARACTER_ID, weaponId: WEAPON_ID },
  );
  await waitForDevWeapon(page, WEAPON_ID);
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
          const self = arena.room.state.players.get(arena.room.sessionId);
          const rig = arena.blobs.get(arena.room.sessionId);
          return {
            character: self?.character ?? null,
            frameId: rig?.weapons[0]?.firingFrame?.spriteId ?? null,
            weapon: self?.weapon ?? null,
          };
        }),
      {
        message: "B13 local fixture should load both registered Wyrmskull frames",
        timeout: 20_000,
      },
    )
    .toEqual({
      character: CHARACTER_ID,
      frameId: OPEN_FRAME_ID,
      weapon: WEAPON_ID,
    });
}

async function connectRemote(page: Page, gamePort: number): Promise<RawRoom> {
  const roomId = await page.evaluate(
    () => (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena").room.roomId,
  );
  const { Client } = await import(
    "../../packages/client/node_modules/colyseus.js/build/esm/index.mjs"
  );
  const client = new Client(`ws://127.0.0.1:${gamePort}`);
  const room = (await client.joinById(roomId)) as unknown as RawRoom;
  room.send("devEquip", { character: CHARACTER_ID, weapon: WEAPON_ID });
  await expect
    .poll(
      () => {
        // joinById resolves after the socket joins, just before the first schema snapshot is
        // guaranteed to have populated `room.state`.
        const player = (
          room as unknown as {
            state?: { players?: RawRoom["state"]["players"] };
          }
        ).state?.players?.get(room.sessionId);
        return {
          character: player?.character ?? null,
          weapon: player?.weapon ?? null,
        };
      },
      { message: "B13 remote fixture should equip on the live server", timeout: 20_000 },
    )
    .toEqual({ character: CHARACTER_ID, weapon: WEAPON_ID });
  await expect
    .poll(
      () =>
        page.evaluate((sourceId) => {
          const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
          const rig = arena.blobs.get(sourceId);
          return {
            frameId: rig?.weapons[0]?.firingFrame?.spriteId ?? null,
            weapon: arena.room.state.players.get(sourceId)?.weapon ?? null,
          };
        }, room.sessionId),
      {
        message: "B13 observer should render the remote Wyrmskull with its registered frame",
        timeout: 20_000,
      },
    )
    .toEqual({ frameId: OPEN_FRAME_ID, weapon: WEAPON_ID });
  return room;
}

async function moveRemoteClear(room: RawRoom): Promise<void> {
  let seq = room.state.players.get(room.sessionId)?.ackSeq ?? 0;
  const deadline = Date.now() + 650;
  while (Date.now() < deadline) {
    seq = (seq + 1) >>> 0;
    room.send("input", {
      seq,
      dx: 1,
      dy: 0,
      fireHeld: false,
      aimX: 1,
      aimY: 0,
    });
    await new Promise((resolve) => setTimeout(resolve, 55));
  }
  seq = (seq + 1) >>> 0;
  room.send("input", { seq, dx: 0, dy: 0, fireHeld: false, aimX: 1, aimY: 0 });
  await expect
    .poll(() => room.state.players.get(room.sessionId)?.ackSeq ?? -1, {
      message: "B13 remote clear-position command should be accepted",
      timeout: 10_000,
    })
    .toBe(seq);
}

async function focusCamera(page: Page, sourceId: string): Promise<void> {
  await page.evaluate((id) => {
    const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
    const rig = arena.blobs.get(id);
    if (!rig) throw new Error(`B13 camera lost rig ${id}`);
    const camera = arena.cameras.main;
    camera.setScroll(
      rig.x - camera.width / camera.zoom / 2,
      rig.y - camera.height / camera.zoom / 2,
    );
  }, sourceId);
}

async function frameState(page: Page, sourceId: string): Promise<FrameState> {
  return await page.evaluate((id) => {
    const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
    const player = arena.room.state.players.get(id);
    const rig = arena.blobs.get(id);
    const held = rig?.weapons[0];
    if (!player || !rig || !held) throw new Error(`B13 frame-state lost ${id}`);
    const muzzle = { x: 0, y: 0 };
    const muzzleOk = rig.writeWeaponMuzzleForShot(player.attackSeq, 0, muzzle);
    const matrix = rig.root.getWorldTransformMatrix();
    const gripWorld = {
      x: matrix.a * held.img.x + matrix.c * held.img.y + matrix.tx,
      y: matrix.b * held.img.x + matrix.d * held.img.y + matrix.ty,
    };
    return {
      acceptedTick:
        (rig as unknown as { authoritativeFiringAttackTick?: number })
          .authoritativeFiringAttackTick ?? -1,
      attackSeq: player.attackSeq,
      baseScale: held.baseScale,
      character: player.character ?? null,
      closedBaseScale: held.closedBaseScale,
      closedTextureKey: held.closedTextureKey,
      clockTick:
        (rig as unknown as { authoritativeFiringClockTick?: number })
          .authoritativeFiringClockTick ?? -1,
      facing: rig.facing,
      firingFrameId: held.firingFrame?.spriteId ?? null,
      firingFrameVisible: held.firingFrameVisible,
      gripWorld,
      image: {
        active: held.img.active,
        height: held.img.height,
        originX: held.img.originX,
        originY: held.img.originY,
        rotation: held.img.rotation,
        scaleX: held.img.scaleX,
        scaleY: held.img.scaleY,
        visible: held.img.visible,
        width: held.img.width,
        x: held.img.x,
        y: held.img.y,
      },
      muzzle: { ok: muzzleOk, x: muzzle.x, y: muzzle.y },
      rootScaleX: rig.root.scaleX,
      sourceScale: held.firingFrame?.sourceScale ?? 1,
      textureKey: held.img.texture.key,
      weapon: player.weapon ?? null,
    };
  }, sourceId);
}

async function installFrameWatch(
  page: Page,
  sourceId: string,
  visible: boolean,
  minimumSeq: number,
  facing: Facing,
): Promise<void> {
  await page.evaluate(
    ({ direction, id, minimumSeq, visible }) => {
      const holder = globalThis as unknown as BrowserGlobal;
      holder.__ddB13FrameWatch = { matched: false, samples: [] };
      const sample = (): void => {
        const arena = holder.ddGame.scene.getScene("arena");
        const rig = arena.blobs.get(id);
        const player = arena.room.state.players.get(id);
        const held = rig?.weapons[0];
        const watch = holder.__ddB13FrameWatch;
        if (!watch || watch.matched) return;
        if (
          watch.samples.length < 160 &&
          (!watch.samples.length || player?.attackSeq !== minimumSeq)
        ) {
          watch.samples.push({
            attackHeld: player?.attackHeld,
            attackSeq: player?.attackSeq,
            authoritativeAttackTick: (
              rig as unknown as {
                authoritativeFiringAttackTick?: number;
              }
            )?.authoritativeFiringAttackTick,
            authoritativeClockTick: (
              rig as unknown as {
                authoritativeFiringClockTick?: number;
              }
            )?.authoritativeFiringClockTick,
            authoritativeWeaponId: (
              rig as unknown as {
                authoritativeFiringWeaponId?: string;
              }
            )?.authoritativeFiringWeaponId,
            animClock: arena.animClock,
            frameVisible: held?.firingFrameVisible,
            sceneNow: arena.time.now,
            textureKey: held?.img.texture.key,
            firingTextureKey: held?.firingFrame?.textureKey,
            firingTextureReady: held?.firingFrame
              ? arena.textures.exists(held.firingFrame.textureKey)
              : false,
          });
        }
        const matches =
          !!rig &&
          !!player &&
          player.attackSeq > minimumSeq &&
          rig.facing === direction &&
          held?.firingFrameVisible === visible;
        if (matches) {
          const camera = arena.cameras.main;
          camera.setScroll(
            rig.x - camera.width / camera.zoom / 2,
            rig.y - camera.height / camera.zoom / 2,
          );
          arena.scene.pause();
          watch.matched = true;
          return;
        }
        window.requestAnimationFrame(sample);
      };
      window.requestAnimationFrame(sample);
    },
    { direction: expectedFacing(facing), id: sourceId, minimumSeq, visible },
  );
}

async function waitForFrameWatch(page: Page, sourceId: string, visible: boolean): Promise<void> {
  try {
    await expect
      .poll(
        () =>
          page.evaluate(
            () => (globalThis as unknown as BrowserGlobal).__ddB13FrameWatch?.matched === true,
          ),
        {
          message: `B13 ${sourceId} should reach firingFrameVisible=${visible}`,
          timeout: 10_000,
          intervals: [2, 4, 8, 12],
        },
      )
      .toBe(true);
  } catch (error) {
    const samples = await page.evaluate(
      () => (globalThis as unknown as BrowserGlobal).__ddB13FrameWatch?.samples ?? [],
    );
    throw new Error(
      `B13 ${sourceId} never reached firingFrameVisible=${visible}; samples=${JSON.stringify(samples)}`,
      { cause: error },
    );
  }
}

async function pauseIdle(page: Page, sourceId: string, facing: Facing): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(
          ({ direction, id }) => {
            const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
            const rig = arena.blobs.get(id);
            if (rig?.weapons[0]?.firingFrameVisible !== false || rig.facing !== direction)
              return false;
            const camera = arena.cameras.main;
            camera.setScroll(
              rig.x - camera.width / camera.zoom / 2,
              rig.y - camera.height / camera.zoom / 2,
            );
            arena.scene.pause();
            return true;
          },
          { direction: expectedFacing(facing), id: sourceId },
        ),
      { message: `B13 ${sourceId} should settle closed at idle`, timeout: 10_000 },
    )
    .toBe(true);
}

async function resume(page: Page): Promise<void> {
  await page.evaluate(() => {
    (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena").scene.resume();
  });
}

async function commitLocalFacing(page: Page, facing: Facing): Promise<void> {
  const canvas = page.locator("#game-root canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("B13 gate cannot locate the Phaser canvas");
  await page.mouse.move(
    box.x + box.width * (facing === "right" ? 0.9 : 0.1),
    box.y + box.height * 0.5,
  );
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
          return arena.blobs.get(arena.room.sessionId)?.facing ?? 0;
        }),
      { message: `B13 local rig should face ${facing}`, timeout: 10_000 },
    )
    .toBe(expectedFacing(facing));
}

async function commitRemoteFacing(room: RawRoom, page: Page, facing: Facing): Promise<void> {
  const player = room.state.players.get(room.sessionId);
  if (!player) throw new Error("B13 remote facing lost its player");
  const direction = expectedFacing(facing);
  const seq = (player.ackSeq + 1) >>> 0;
  room.send("input", {
    seq,
    // Wyrmskull keeps its established scatter/melee pose contract: remote facing follows
    // authoritative movement, not cursor aim. Hold the requested direction through the triplet.
    dx: direction,
    dy: 0,
    fireHeld: false,
    aimX: direction,
    aimY: 0,
    targetX: player.x + direction * 300,
    targetY: player.y,
  });
  await expect
    .poll(() => room.state.players.get(room.sessionId)?.ackSeq ?? -1, {
      message: `B13 remote ${facing} command should be accepted`,
      timeout: 10_000,
    })
    .toBe(seq);
  await expect
    .poll(
      () =>
        page.evaluate((sourceId) => {
          const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
          return arena.blobs.get(sourceId)?.facing ?? 0;
        }, room.sessionId),
      { message: `B13 remote rig should face ${facing}`, timeout: 10_000 },
    )
    .toBe(direction);
}

async function fireLocal(page: Page, facing: Facing): Promise<number> {
  return await page.evaluate((direction) => {
    const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
    const self = arena.room.state.players.get(arena.room.sessionId);
    if (!self) throw new Error("B13 local fire lost its player");
    arena.room.send("attack", {
      aimX: direction,
      aimY: 0,
      tx: self.x + direction * 300,
      ty: self.y,
    });
    return self.attackSeq;
  }, expectedFacing(facing));
}

function fireRemote(room: RawRoom, facing: Facing): number {
  const player = room.state.players.get(room.sessionId);
  if (!player) throw new Error("B13 remote fire lost its player");
  const direction = expectedFacing(facing);
  room.send("attack", {
    aimX: direction,
    aimY: 0,
    tx: player.x + direction * 300,
    ty: player.y,
  });
  return player.attackSeq;
}

async function captureTriplet(
  page: Page,
  viewpoint: Viewpoint,
  sourceId: string,
  facing: Facing,
  fire: () => Promise<number>,
): Promise<FacingCapture> {
  const prefix = `${viewpoint}-${facing}`;
  const idleFile = path.join(EVIDENCE_DIR, `${prefix}-closed-idle.png`);
  const releaseFile = path.join(EVIDENCE_DIR, `${prefix}-open-release.png`);
  const afterFile = path.join(EVIDENCE_DIR, `${prefix}-closed-after.png`);

  await focusCamera(page, sourceId);
  await pauseIdle(page, sourceId, facing);
  await page.waitForTimeout(100);
  const idle = await frameState(page, sourceId);
  await page.locator("#game-root canvas").screenshot({ path: idleFile });
  await resume(page);
  // Let the resumed arena consume one ordinary frame before requesting the real server beat.
  await page.waitForTimeout(120);

  await installFrameWatch(page, sourceId, true, idle.attackSeq, facing);
  const attackSeqBefore = await fire();
  expect(attackSeqBefore).toBe(idle.attackSeq);
  await waitForFrameWatch(page, sourceId, true);
  await page.waitForTimeout(100);
  const release = await frameState(page, sourceId);
  await page.locator("#game-root canvas").screenshot({ path: releaseFile });
  await installFrameWatch(page, sourceId, false, attackSeqBefore, facing);
  await resume(page);

  await waitForFrameWatch(page, sourceId, false);
  await page.waitForTimeout(100);
  const after = await frameState(page, sourceId);
  await page.locator("#game-root canvas").screenshot({ path: afterFile });
  await resume(page);

  const capture: FacingCapture = {
    viewpoint,
    sourceId,
    facing,
    attackSeqBefore,
    idle,
    release,
    after,
    screenshots: {
      idle: relativeEvidencePath(idleFile),
      release: relativeEvidencePath(releaseFile),
      after: relativeEvidencePath(afterFile),
    },
  };

  expect(idle.weapon).toBe(WEAPON_ID);
  expect(idle.character).toBe(CHARACTER_ID);
  expect(idle.firingFrameVisible).toBe(false);
  expect(idle.textureKey).toBe(idle.closedTextureKey);
  expect(idle.facing).toBe(expectedFacing(facing));
  expect(idle.muzzle.ok).toBe(true);

  expect(release.attackSeq).toBeGreaterThan(attackSeqBefore);
  expect(release.firingFrameId).toBe(OPEN_FRAME_ID);
  expect(release.firingFrameVisible).toBe(true);
  expect(release.textureKey).not.toBe(release.closedTextureKey);
  expect(release.sourceScale).toBe(3);
  expect(release.image.originX).toBeCloseTo(0.1, 10);
  expect(release.image.originY).toBeCloseTo(118.5 / 270, 10);
  expect(release.baseScale * release.sourceScale).toBeCloseTo(release.closedBaseScale, 10);
  expect(Math.abs(release.image.scaleX) * release.image.width).toBeCloseTo(
    Math.abs(idle.image.scaleX) * idle.image.width,
    8,
  );
  expect(release.facing).toBe(expectedFacing(facing));
  expect(release.muzzle.ok).toBe(true);

  expect(after.attackSeq).toBe(release.attackSeq);
  expect(after.firingFrameVisible).toBe(false);
  expect(after.textureKey).toBe(after.closedTextureKey);
  expect(after.baseScale).toBeCloseTo(after.closedBaseScale, 10);
  expect(Math.abs(after.image.scaleX) * after.image.width).toBeCloseTo(
    Math.abs(idle.image.scaleX) * idle.image.width,
    8,
  );
  expect(after.image.originX).toBeCloseTo(0.1, 10);
  expect(after.image.originY).toBeCloseTo(0.5, 10);
  expect(after.facing).toBe(expectedFacing(facing));
  expect(after.muzzle.ok).toBe(true);

  return capture;
}

test("B13 Wyrmskull uses its authoritative open-mouth release frame locally and remotely", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await runArenaSpec(page, async (baseURL) => {
    await mkdir(EVIDENCE_DIR, { recursive: true });
    const clientPort = Number(new URL(baseURL).port);
    expect(Number.isInteger(clientPort) && clientPort > 0).toBe(true);
    expect(FORBIDDEN_PORTS.has(clientPort), "client port must be private ephemeral").toBe(false);

    await bootArena(page, baseURL, `weapon:${WEAPON_ID}`);
    const gamePort = Number(new URL(page.url()).searchParams.get("port"));
    expect(Number.isInteger(gamePort) && gamePort > 0).toBe(true);
    expect(FORBIDDEN_PORTS.has(gamePort), "game port must be private ephemeral").toBe(false);
    await prepare(page);
    await equipLocalFixture(page);

    const captures: FacingCapture[] = [];
    const localId = await page.evaluate(
      () => (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena").room.sessionId,
    );
    for (const facing of FACINGS) {
      await commitLocalFacing(page, facing);
      captures.push(
        await captureTriplet(page, "local", localId, facing, () => fireLocal(page, facing)),
      );
      await page.waitForTimeout(550);
    }

    const remoteRoom = await connectRemote(page, gamePort);
    try {
      await moveRemoteClear(remoteRoom);
      for (const facing of FACINGS) {
        await commitRemoteFacing(remoteRoom, page, facing);
        captures.push(
          await captureTriplet(page, "remote", remoteRoom.sessionId, facing, async () =>
            fireRemote(remoteRoom, facing),
          ),
        );
        await page.waitForTimeout(550);
      }
    } finally {
      await remoteRoom.leave();
    }

    const registration = {
      closedGripSource: { x: 256 * 0.1, y: 79 * 0.5 },
      openGripSourceNormalized: { x: (768 * 0.1) / 3, y: (270 * (118.5 / 270)) / 3 },
      closedMuzzleSource: { x: 200, y: 56 },
      openMuzzleSourceNormalized: { x: 600 / 3, y: 168 / 3 },
    };
    const gripError = Math.hypot(
      registration.closedGripSource.x - registration.openGripSourceNormalized.x,
      registration.closedGripSource.y - registration.openGripSourceNormalized.y,
    );
    const muzzleError = Math.hypot(
      registration.closedMuzzleSource.x - registration.openMuzzleSourceNormalized.x,
      registration.closedMuzzleSource.y - registration.openMuzzleSourceNormalized.y,
    );
    expect(gripError).toBeCloseTo(0, 10);
    expect(muzzleError).toBeCloseTo(0, 10);

    const assertions = {
      fourAuthoritativeCycles: captures.length === 4,
      localBothFacings: FACINGS.every((facing) =>
        captures.some((capture) => capture.viewpoint === "local" && capture.facing === facing),
      ),
      remoteBothFacings: FACINGS.every((facing) =>
        captures.some((capture) => capture.viewpoint === "remote" && capture.facing === facing),
      ),
      allIdleClosed: captures.every(
        (capture) =>
          !capture.idle.firingFrameVisible &&
          capture.idle.textureKey === capture.idle.closedTextureKey,
      ),
      allReleasesOpen: captures.every(
        (capture) =>
          capture.release.firingFrameVisible &&
          capture.release.firingFrameId === OPEN_FRAME_ID &&
          capture.release.textureKey !== capture.release.closedTextureKey,
      ),
      allReturnsClosed: captures.every(
        (capture) =>
          !capture.after.firingFrameVisible &&
          capture.after.textureKey === capture.after.closedTextureKey,
      ),
      authoritativeSeqAdvanced: captures.every(
        (capture) => capture.release.attackSeq > capture.attackSeqBefore,
      ),
      muzzleValidEveryPhase: captures.every(
        (capture) => capture.idle.muzzle.ok && capture.release.muzzle.ok && capture.after.muzzle.ok,
      ),
      registrationGripErrorPx: gripError,
      registrationMuzzleErrorPx: muzzleError,
      privatePorts: !FORBIDDEN_PORTS.has(clientPort) && !FORBIDDEN_PORTS.has(gamePort),
      wholeArtCharacter: CHARACTER_ID,
    };
    expect(assertions).toMatchObject({
      fourAuthoritativeCycles: true,
      localBothFacings: true,
      remoteBothFacings: true,
      allIdleClosed: true,
      allReleasesOpen: true,
      allReturnsClosed: true,
      authoritativeSeqAdvanced: true,
      muzzleValidEveryPhase: true,
      privatePorts: true,
      wholeArtCharacter: CHARACTER_ID,
    });

    await writeFile(
      path.join(EVIDENCE_DIR, "live-gate.json"),
      `${JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          baseURL,
          clientPort,
          gamePort,
          protectedPorts: [...FORBIDDEN_PORTS],
          characterId: CHARACTER_ID,
          weaponId: WEAPON_ID,
          firingFrameId: OPEN_FRAME_ID,
          releaseWindowMs: 150,
          registration,
          assertions,
          captures,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  });
});
