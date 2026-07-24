import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { bootArena, runArenaSpec, waitForDevWeapon } from "../helpers/arena-harness.js";

const EVIDENCE_DIR = path.resolve(
  import.meta.dirname,
  "../../docs/owner-notes-audit-v11-evidence/b32-frostbore-breakaction",
);
const WEAPON_ID = "x2-frostbore-scattergun";
const CHARACTER_ID = "proto-cowboy-hidden-face";
const FORBIDDEN_PORTS = new Set([5180, 2567]);
const EXPECTED_OPEN_ANGLE = Math.PI / 6;
const EXPECTED_RELOAD_TICKS = 18;

type Facing = "left" | "right";
type BreakPhase = "closed" | "opening" | "eject" | "closing";
type Viewpoint = "local" | "remote";

interface BrowserPlayer {
  ackSeq: number;
  attackSeq: number;
  attackTick: number;
  character?: string;
  charges: number;
  maxCharges: number;
  weapon?: string;
  x: number;
  y: number;
}

interface BreakEvidence {
  active: boolean;
  angleRad: number;
  barrelRotationRad: number;
  ejectStrength: number;
  muzzleAllowed: boolean;
  phase: BreakPhase;
  shellCount: number;
}

interface BrowserRig {
  breakActionEvidence(): BreakEvidence;
  facing: number;
  writeWeaponMuzzleForShot(
    acceptedSeq: number,
    barrelIndex: number,
    out: { x: number; y: number },
  ): boolean;
  x: number;
  y: number;
}

interface BrowserArena {
  blobs: Map<string, BrowserRig>;
  cameras: {
    main: {
      height: number;
      setScroll(x: number, y: number): void;
      setZoom(value: number): void;
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
      tick: number;
    };
  };
  scene: { pause(): void; resume(): void };
  time: { now: number };
  verbs?: {
    isLegendOpen?(): boolean;
    releaseInputLatchIf?(force: boolean): void;
    toggleLegend?(timeMs: number): void;
  };
}

interface BrowserGlobal {
  __ddB32PhaseWatch?: {
    matched: boolean;
    matchedState?: LivePhaseState;
    samples: Array<Record<string, unknown>>;
  };
  ddGame: { scene: { getScene(key: string): BrowserArena } };
}

interface RawRoom {
  roomId: string;
  sessionId: string;
  leave(): Promise<unknown>;
  send(type: string, message?: unknown): void;
  state: {
    players: {
      get(id: string): BrowserPlayer | undefined;
    };
  };
}

interface LivePhaseState extends BreakEvidence {
  attackSeq: number;
  attackTick: number;
  charges: number;
  clockTick: number;
  elapsedTicks: number;
  facing: number;
  maxCharges: number;
  muzzle: Array<{ acceptedSeq: number; ok: boolean; x: number; y: number }>;
}

interface TargetPhaseCapture {
  before: LivePhaseState;
  firstAcceptedSeq: number;
  phase: LivePhaseState;
  screenshot: string;
  secondAcceptedSeq: number;
}

interface FacingCapture {
  after: LivePhaseState;
  eject: TargetPhaseCapture;
  facing: Facing;
  opening: TargetPhaseCapture;
  snapShut: TargetPhaseCapture;
  sourceId: string;
  viewpoint: Viewpoint;
}

function directionFor(facing: Facing): number {
  return facing === "right" ? 1 : -1;
}

function relativeEvidencePath(file: string): string {
  return path.relative(process.cwd(), file).replaceAll("\\", "/");
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
    arena.cameras.main.setZoom(2.2);
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
          const evidence = arena.blobs.get(arena.room.sessionId)?.breakActionEvidence();
          return {
            character: self?.character ?? null,
            charges: self?.charges ?? -1,
            maxCharges: self?.maxCharges ?? -1,
            phase: evidence?.phase ?? null,
            weapon: self?.weapon ?? null,
          };
        }),
      {
        message: "B32 local Frostbore fixture should settle closed with two shells",
        timeout: 20_000,
      },
    )
    .toEqual({
      character: CHARACTER_ID,
      charges: 2,
      maxCharges: 2,
      phase: "closed",
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
        const player = room.state?.players?.get(room.sessionId);
        return {
          character: player?.character ?? null,
          charges: player?.charges ?? -1,
          maxCharges: player?.maxCharges ?? -1,
          weapon: player?.weapon ?? null,
        };
      },
      { message: "B32 remote fixture should equip on the live server", timeout: 20_000 },
    )
    .toEqual({
      character: CHARACTER_ID,
      charges: 2,
      maxCharges: 2,
      weapon: WEAPON_ID,
    });
  await expect
    .poll(
      () =>
        page.evaluate((sourceId) => {
          const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
          return {
            phase: arena.blobs.get(sourceId)?.breakActionEvidence().phase ?? null,
            weapon: arena.room.state.players.get(sourceId)?.weapon ?? null,
          };
        }, room.sessionId),
      { message: "B32 observer should render the remote registered break rig", timeout: 20_000 },
    )
    .toEqual({ phase: "closed", weapon: WEAPON_ID });
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
      message: "B32 remote clear-position command should be accepted",
      timeout: 10_000,
    })
    .toBe(seq);
}

async function focusCamera(page: Page, sourceId: string): Promise<void> {
  await page.evaluate((id) => {
    const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
    const rig = arena.blobs.get(id);
    if (!rig) throw new Error(`B32 camera lost rig ${id}`);
    const camera = arena.cameras.main;
    camera.setScroll(
      rig.x - camera.width / camera.zoom / 2,
      rig.y - camera.height / camera.zoom / 2,
    );
  }, sourceId);
}

async function commitLocalFacing(page: Page, facing: Facing): Promise<void> {
  const canvas = page.locator("#game-root canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("B32 gate cannot locate the Phaser canvas");
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
      { message: `B32 local rig should face ${facing}`, timeout: 10_000 },
    )
    .toBe(directionFor(facing));
}

async function commitRemoteFacing(room: RawRoom, page: Page, facing: Facing): Promise<void> {
  const player = room.state.players.get(room.sessionId);
  if (!player) throw new Error("B32 remote facing lost its player");
  const direction = directionFor(facing);
  const seq = (player.ackSeq + 1) >>> 0;
  room.send("input", {
    seq,
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
      message: `B32 remote ${facing} command should be accepted`,
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
      { message: `B32 remote rig should face ${facing}`, timeout: 10_000 },
    )
    .toBe(direction);
}

async function phaseState(page: Page, sourceId: string): Promise<LivePhaseState> {
  return await page.evaluate((id) => {
    const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
    const rig = arena.blobs.get(id);
    const player = arena.room.state.players.get(id);
    if (!rig || !player) throw new Error(`B32 phase-state lost ${id}`);
    const evidence = rig.breakActionEvidence();
    const muzzleSeqs = player.attackSeq > 1 ? [player.attackSeq - 1, player.attackSeq] : [1, 2];
    const muzzle = muzzleSeqs.map((acceptedSeq) => {
      const out = { x: 0, y: 0 };
      return {
        acceptedSeq,
        ok: rig.writeWeaponMuzzleForShot(acceptedSeq, 0, out),
        x: out.x,
        y: out.y,
      };
    });
    return {
      ...evidence,
      attackSeq: player.attackSeq,
      attackTick: player.attackTick,
      charges: player.charges,
      clockTick: arena.room.state.tick,
      elapsedTicks: (arena.room.state.tick - player.attackTick) >>> 0,
      facing: rig.facing,
      maxCharges: player.maxCharges,
      muzzle,
    };
  }, sourceId);
}

async function installPhaseWatch(
  page: Page,
  sourceId: string,
  phase: BreakPhase,
  minimumSeq: number,
): Promise<void> {
  await page.evaluate(
    ({ id, minimumSeq, phase }) => {
      const holder = globalThis as unknown as BrowserGlobal;
      holder.__ddB32PhaseWatch = { matched: false, samples: [] };
      const sample = (): void => {
        const arena = holder.ddGame.scene.getScene("arena");
        const rig = arena.blobs.get(id);
        const player = arena.room.state.players.get(id);
        const evidence = rig?.breakActionEvidence();
        const watch = holder.__ddB32PhaseWatch;
        if (!watch || watch.matched) return;
        if (watch.samples.length < 160) {
          watch.samples.push({
            angleRad: evidence?.angleRad,
            attackSeq: player?.attackSeq,
            attackTick: player?.attackTick,
            charges: player?.charges,
            clockTick: arena.room.state.tick,
            ejectStrength: evidence?.ejectStrength,
            maxCharges: player?.maxCharges,
            muzzleAllowed: evidence?.muzzleAllowed,
            phase: evidence?.phase,
            shellCount: evidence?.shellCount,
          });
        }
        const targetPoseMatched =
          phase === "opening"
            ? (evidence?.angleRad ?? 0) >= 0.4
            : phase === "eject"
              ? (evidence?.ejectStrength ?? 0) >= 0.5
              : phase === "closing"
                ? (evidence?.angleRad ?? 0) > 0 && (evidence?.angleRad ?? 0) <= 0.25
                : true;
        if (
          rig &&
          player &&
          player.attackSeq > minimumSeq &&
          player.charges === 0 &&
          evidence?.phase === phase &&
          targetPoseMatched
        ) {
          const muzzleSeqs =
            player.attackSeq > 1 ? [player.attackSeq - 1, player.attackSeq] : [1, 2];
          const muzzle = muzzleSeqs.map((acceptedSeq) => {
            const out = { x: 0, y: 0 };
            return {
              acceptedSeq,
              ok: rig.writeWeaponMuzzleForShot(acceptedSeq, 0, out),
              x: out.x,
              y: out.y,
            };
          });
          watch.matchedState = {
            ...evidence,
            attackSeq: player.attackSeq,
            attackTick: player.attackTick,
            charges: player.charges,
            clockTick: arena.room.state.tick,
            elapsedTicks: (arena.room.state.tick - player.attackTick) >>> 0,
            facing: rig.facing,
            maxCharges: player.maxCharges,
            muzzle,
          };
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
    { id: sourceId, minimumSeq, phase },
  );
}

async function waitForPhaseWatch(page: Page, phase: BreakPhase): Promise<void> {
  try {
    await expect
      .poll(
        () =>
          page.evaluate(
            () => (globalThis as unknown as BrowserGlobal).__ddB32PhaseWatch?.matched === true,
          ),
        {
          intervals: [2, 4, 8, 12],
          message: `B32 rig should reach authoritative ${phase} phase`,
          timeout: 10_000,
        },
      )
      .toBe(true);
  } catch (error) {
    const samples = await page.evaluate(
      () => (globalThis as unknown as BrowserGlobal).__ddB32PhaseWatch?.samples ?? [],
    );
    throw new Error(`B32 never reached ${phase}; samples=${JSON.stringify(samples)}`, {
      cause: error,
    });
  }
}

async function matchedPhaseState(page: Page): Promise<LivePhaseState> {
  return await page.evaluate(() => {
    const matched = (globalThis as unknown as BrowserGlobal).__ddB32PhaseWatch?.matchedState;
    if (!matched) throw new Error("B32 phase watcher did not preserve its authoritative sample");
    return matched;
  });
}

async function resume(page: Page): Promise<void> {
  await page.evaluate(() => {
    (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena").scene.resume();
  });
}

async function localPlayerState(page: Page): Promise<BrowserPlayer> {
  return await page.evaluate(() => {
    const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
    const player = arena.room.state.players.get(arena.room.sessionId);
    if (!player) throw new Error("B32 local state lost its player");
    return {
      ackSeq: player.ackSeq,
      attackSeq: player.attackSeq,
      attackTick: player.attackTick,
      character: player.character,
      charges: player.charges,
      maxCharges: player.maxCharges,
      weapon: player.weapon,
      x: player.x,
      y: player.y,
    };
  });
}

async function fireLocal(page: Page, facing: Facing): Promise<void> {
  await page.evaluate((direction) => {
    const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
    const player = arena.room.state.players.get(arena.room.sessionId);
    if (!player) throw new Error("B32 local fire lost its player");
    arena.room.send("attack", {
      aimX: direction,
      aimY: 0,
      tx: player.x + direction * 300,
      ty: player.y,
    });
  }, directionFor(facing));
}

function fireRemote(room: RawRoom, facing: Facing): void {
  const player = room.state.players.get(room.sessionId);
  if (!player) throw new Error("B32 remote fire lost its player");
  const direction = directionFor(facing);
  room.send("attack", {
    aimX: direction,
    aimY: 0,
    tx: player.x + direction * 300,
    ty: player.y,
  });
}

async function waitForAmmo(
  read: () => Promise<BrowserPlayer | undefined>,
  attackSeq: number,
  charges: number,
  message: string,
): Promise<void> {
  await expect
    .poll(
      async () => {
        const player = await read();
        return {
          attackSeq: player?.attackSeq ?? -1,
          charges: player?.charges ?? -1,
          maxCharges: player?.maxCharges ?? -1,
        };
      },
      { message, timeout: 10_000, intervals: [5, 10, 20] },
    )
    .toEqual({ attackSeq, charges, maxCharges: 2 });
}

async function captureTargetPhase(
  page: Page,
  sourceId: string,
  facing: Facing,
  targetPhase: Exclude<BreakPhase, "closed">,
  screenshotFile: string,
  readPlayer: () => Promise<BrowserPlayer | undefined>,
  fire: () => Promise<void>,
): Promise<TargetPhaseCapture> {
  await focusCamera(page, sourceId);
  const before = await phaseState(page, sourceId);
  expect(before.phase).toBe("closed");
  expect(before.charges).toBe(2);
  expect(before.muzzle.every((entry) => entry.ok)).toBe(true);

  await fire();
  const firstAcceptedSeq = (before.attackSeq + 1) >>> 0;
  await waitForAmmo(
    readPlayer,
    firstAcceptedSeq,
    1,
    `B32 ${facing}/${targetPhase} should spend shell one`,
  );
  await page.waitForTimeout(550);

  await installPhaseWatch(page, sourceId, targetPhase, firstAcceptedSeq);
  await fire();
  const secondAcceptedSeq = (firstAcceptedSeq + 1) >>> 0;
  await waitForAmmo(
    readPlayer,
    secondAcceptedSeq,
    0,
    `B32 ${facing}/${targetPhase} should spend shell two and start reload`,
  );

  await waitForPhaseWatch(page, targetPhase);
  const phase = await matchedPhaseState(page);
  await page.locator("#game-root canvas").screenshot({ path: screenshotFile });
  await resume(page);

  await waitForAmmo(
    readPlayer,
    secondAcceptedSeq,
    2,
    `B32 ${facing}/${targetPhase} should restore both shells after snap-shut`,
  );
  await expect
    .poll(() => phaseState(page, sourceId), {
      message: `B32 ${facing}/${targetPhase} should return to a closed valid muzzle`,
      timeout: 10_000,
    })
    .toMatchObject({
      active: false,
      charges: 2,
      maxCharges: 2,
      muzzleAllowed: true,
      phase: "closed",
    });

  return {
    before,
    firstAcceptedSeq,
    phase,
    screenshot: relativeEvidencePath(screenshotFile),
    secondAcceptedSeq,
  };
}

async function captureFacing(
  page: Page,
  viewpoint: Viewpoint,
  sourceId: string,
  facing: Facing,
  readPlayer: () => Promise<BrowserPlayer | undefined>,
  fire: () => Promise<void>,
): Promise<FacingCapture> {
  const prefix = `${viewpoint}-${facing}`;
  const opening = await captureTargetPhase(
    page,
    sourceId,
    facing,
    "opening",
    path.join(EVIDENCE_DIR, `${prefix}-break-open.png`),
    readPlayer,
    fire,
  );
  const eject = await captureTargetPhase(
    page,
    sourceId,
    facing,
    "eject",
    path.join(EVIDENCE_DIR, `${prefix}-eject-beat.png`),
    readPlayer,
    fire,
  );
  const snapShut = await captureTargetPhase(
    page,
    sourceId,
    facing,
    "closing",
    path.join(EVIDENCE_DIR, `${prefix}-snap-shut.png`),
    readPlayer,
    fire,
  );
  const after = await phaseState(page, sourceId);

  expect(opening.phase).toMatchObject({
    active: true,
    attackSeq: opening.secondAcceptedSeq,
    charges: 0,
    maxCharges: 2,
    muzzleAllowed: false,
    phase: "opening",
  });
  expect(opening.phase.elapsedTicks).toBeGreaterThanOrEqual(2);
  expect(opening.phase.elapsedTicks).toBeLessThanOrEqual(5);
  expect(opening.phase.angleRad).toBeGreaterThanOrEqual(0.4);
  expect(opening.phase.angleRad).toBeLessThanOrEqual(EXPECTED_OPEN_ANGLE);
  expect(opening.phase.muzzle.every((entry) => !entry.ok)).toBe(true);

  expect(eject.phase).toMatchObject({
    active: true,
    attackSeq: eject.secondAcceptedSeq,
    charges: 0,
    maxCharges: 2,
    muzzleAllowed: false,
    phase: "eject",
    shellCount: 2,
  });
  expect(eject.phase.elapsedTicks).toBeGreaterThanOrEqual(6);
  expect(eject.phase.elapsedTicks).toBeLessThanOrEqual(10);
  expect(eject.phase.angleRad).toBeCloseTo(EXPECTED_OPEN_ANGLE, 10);
  expect(eject.phase.ejectStrength).toBeGreaterThan(0);
  expect(eject.phase.muzzle.every((entry) => !entry.ok)).toBe(true);

  expect(snapShut.phase).toMatchObject({
    active: true,
    attackSeq: snapShut.secondAcceptedSeq,
    charges: 0,
    maxCharges: 2,
    muzzleAllowed: false,
    phase: "closing",
  });
  expect(snapShut.phase.elapsedTicks).toBeGreaterThanOrEqual(11);
  expect(snapShut.phase.elapsedTicks).toBeLessThanOrEqual(14);
  expect(snapShut.phase.angleRad).toBeGreaterThan(0);
  expect(snapShut.phase.angleRad).toBeLessThanOrEqual(0.25);
  expect(snapShut.phase.muzzle.every((entry) => !entry.ok)).toBe(true);

  expect(after.angleRad).toBe(0);
  expect(after.facing).toBe(directionFor(facing));
  expect(after.muzzle.every((entry) => entry.ok)).toBe(true);

  return { after, eject, facing, opening, snapShut, sourceId, viewpoint };
}

test("B32 Frostbore spends two shells then replicates break-open, eject, and snap-shut", async ({
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

    const localId = await page.evaluate(
      () => (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena").room.sessionId,
    );
    await commitLocalFacing(page, "right");
    const captures: FacingCapture[] = [
      await captureFacing(
        page,
        "local",
        localId,
        "right",
        () => localPlayerState(page),
        () => fireLocal(page, "right"),
      ),
    ];

    const remoteRoom = await connectRemote(page, gamePort);
    try {
      await moveRemoteClear(remoteRoom);
      await commitRemoteFacing(remoteRoom, page, "left");
      captures.push(
        await captureFacing(
          page,
          "remote",
          remoteRoom.sessionId,
          "left",
          async () => remoteRoom.state.players.get(remoteRoom.sessionId),
          async () => fireRemote(remoteRoom, "left"),
        ),
      );
    } finally {
      await remoteRoom.leave();
    }

    const assertions = {
      bothFacings:
        captures.some((capture) => capture.facing === "right") &&
        captures.some((capture) => capture.facing === "left"),
      closedMuzzlesValid: captures.every(
        (capture) =>
          capture.opening.before.muzzle.every((entry) => entry.ok) &&
          capture.eject.before.muzzle.every((entry) => entry.ok) &&
          capture.snapShut.before.muzzle.every((entry) => entry.ok) &&
          capture.after.muzzle.every((entry) => entry.ok),
      ),
      closedBoresDistinct: captures.every((capture) => {
        const [first, second] = capture.after.muzzle;
        return !!first && !!second && Math.hypot(first.x - second.x, first.y - second.y) > 1;
      }),
      twoShotsThenReload: captures.every((capture) =>
        [capture.opening, capture.eject, capture.snapShut].every(
          (target) =>
            target.firstAcceptedSeq === (target.before.attackSeq + 1) >>> 0 &&
            target.secondAcceptedSeq === (target.before.attackSeq + 2) >>> 0 &&
            target.phase.charges === 0,
        ),
      ),
      openingMuzzlesBlocked: captures.every(
        (capture) =>
          !capture.opening.phase.muzzleAllowed &&
          !capture.eject.phase.muzzleAllowed &&
          !capture.snapShut.phase.muzzleAllowed,
      ),
      privatePorts: !FORBIDDEN_PORTS.has(clientPort) && !FORBIDDEN_PORTS.has(gamePort),
      remoteObserved: captures.some((capture) => capture.viewpoint === "remote"),
      shellEjectObserved: captures.every(
        (capture) => capture.eject.phase.shellCount === 2 && capture.eject.phase.ejectStrength > 0,
      ),
      timingFromClock: captures.every(
        (capture) =>
          capture.opening.phase.elapsedTicks >= 2 &&
          capture.eject.phase.elapsedTicks >= 6 &&
          capture.snapShut.phase.elapsedTicks >= 11 &&
          capture.snapShut.phase.elapsedTicks < EXPECTED_RELOAD_TICKS,
      ),
      wholeArtCharacter: CHARACTER_ID,
    };
    expect(assertions).toEqual({
      bothFacings: true,
      closedBoresDistinct: true,
      closedMuzzlesValid: true,
      openingMuzzlesBlocked: true,
      privatePorts: true,
      remoteObserved: true,
      shellEjectObserved: true,
      timingFromClock: true,
      twoShotsThenReload: true,
      wholeArtCharacter: CHARACTER_ID,
    });

    await writeFile(
      path.join(EVIDENCE_DIR, "live-gate.json"),
      `${JSON.stringify(
        {
          assertions,
          baseURL,
          captures,
          capturedAt: new Date().toISOString(),
          characterId: CHARACTER_ID,
          clientPort,
          expected: {
            ejectWindowTicks: [6, 10],
            openingWindowTicks: [2, 5],
            openAngleDeg: 30,
            reloadSeconds: 0.9,
            reloadTicks: EXPECTED_RELOAD_TICKS,
            snapShutWindowTicks: [11, 14],
          },
          gamePort,
          protectedPorts: [...FORBIDDEN_PORTS],
          weaponId: WEAPON_ID,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  });
});
