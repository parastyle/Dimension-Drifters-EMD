import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  beltLevelFor,
  PlayerAttackMoveMode,
  ROOM_NAME,
  TICK_MS,
  type MoveStance,
} from "@dd/shared";
import { SelfPredictor, type ServerView } from "../packages/client/src/net/prediction.js";
import { Client } from "../packages/client/node_modules/colyseus.js/build/esm/index.mjs";

const gamePort = Number(process.argv[2]);
const clientPort = Number(process.argv[3]);
if (!Number.isInteger(gamePort) || gamePort <= 0) throw new Error("game port argument is required");
if (!Number.isInteger(clientPort) || clientPort <= 0)
  throw new Error("client port argument is required");

const evidenceDir = path.resolve(
  import.meta.dirname,
  "../docs/owner-notes-audit-v11-evidence/b41-ice-slide",
);
const STOP_WITHIN_TICKS = 3;
const SLOW_WEAPON = "x2-sparkknuckle-hex-mitt";
const PLANTED_WEAPON = "x2-thunderhead-stormfists";

type LiveRoom = Awaited<ReturnType<Client["create"]>>;

interface LiveFrame {
  scenario: string;
  step: number;
  serverTick: number;
  commandSeq: number;
  inputX: number;
  attackMoveMode: number;
  authority: { x: number; y: number; mvx: number; mvy: number };
  predictedBeforePatch: { x: number; y: number };
  predictedAfterPatch: { x: number; y: number };
  predictionErrorPx: number;
  authorityPredictionDeltaPx: number;
}

interface ScenarioCapture {
  mode: "arena" | "belt";
  weapon: string;
  attackMode: number;
  releaseTick: number;
  stoppedTick: number;
  stopTicks: number;
  maxPostPatchDeltaPx: number;
  maxReconciliationErrorPx: number;
  maxRecoveryDeltaPx: number;
  postStopTravelPx: number;
  frames: LiveFrame[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(label: string, predicate: () => boolean, timeoutMs = 8_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error(`Timed out waiting for ${label}`);
    await sleep(5);
  }
}

function player(room: LiveRoom): any {
  return room.state?.players?.get(room.sessionId);
}

function serverView(room: LiveRoom): ServerView {
  const row = player(room);
  if (!row) throw new Error("live room lost its owner row");
  return {
    x: row.x,
    y: row.y,
    mvx: row.mvx,
    mvy: row.mvy,
    vx: row.vx,
    vy: row.vy,
    height: row.height,
    vh: row.vh,
    ackSeq: row.ackSeq,
    teleportSeq: row.teleportSeq,
    moveStance: row.moveStance as MoveStance,
    stanceSeq: row.stanceSeq,
    momentumX: row.momentumX,
    momentumY: row.momentumY,
    slidePhase: row.slidePhase,
    slidePhaseTick: row.slidePhaseTick,
    attackMoveMode: row.dualWield.attackMoveMode,
    alive: row.alive,
  };
}

async function createLiveRoom(belt: boolean): Promise<LiveRoom> {
  const client = new Client(`ws://127.0.0.1:${gamePort}`);
  const room = await client.create(ROOM_NAME, {
    belt,
    beltLevel: belt ? "sky-carrier" : undefined,
    dimensionId: "paper-office",
  });
  await waitFor("owner state", () => !!player(room));
  room.send("toggleTraining");
  await waitFor("training mode", () => room.state?.mode === "training");
  return room;
}

function sendInput(room: LiveRoom, predictor: SelfPredictor, dx: number): number {
  const cmd = predictor.mintCmd(dx, 0, false);
  room.send("input", {
    ...cmd,
    crouchHeld: false,
    pound: false,
    slide: false,
    slideHeld: false,
    fireHeld: false,
    aimX: 1,
    aimY: 0,
    targetX: player(room)?.x + 400,
    targetY: player(room)?.y,
  });
  predictor.tick(cmd);
  return cmd.seq;
}

async function captureStep(
  room: LiveRoom,
  predictor: SelfPredictor,
  scenario: string,
  step: number,
  dx: number,
): Promise<LiveFrame> {
  const priorServerTick = Number(room.state?.tick ?? 0);
  const seq = sendInput(room, predictor, dx);
  await waitFor(
    `command ${seq} acknowledgement`,
    () => Number(player(room)?.ackSeq ?? 0) === seq && Number(room.state?.tick ?? 0) > priorServerTick,
  );
  const before = predictor.renderPos(dx, 0, 0);
  const authoritative = serverView(room);
  predictor.reconcile(authoritative);
  predictor.decayError(TICK_MS / 1000, dx, 0);
  const after = predictor.renderPos(dx, 0, 0);
  const delta = Math.hypot(after.x - authoritative.x, after.y - authoritative.y);
  return {
    scenario,
    step,
    serverTick: Number(room.state?.tick ?? 0),
    commandSeq: seq,
    inputX: dx,
    attackMoveMode: authoritative.attackMoveMode ?? PlayerAttackMoveMode.Normal,
    authority: {
      x: authoritative.x,
      y: authoritative.y,
      mvx: authoritative.mvx,
      mvy: authoritative.mvy,
    },
    predictedBeforePatch: { x: before.x, y: before.y },
    predictedAfterPatch: { x: after.x, y: after.y },
    predictionErrorPx: predictor.stats.errPx,
    authorityPredictionDeltaPx: delta,
  };
}

async function equip(room: LiveRoom, weapon: string): Promise<void> {
  room.send("devEquip", { weapon });
  await waitFor(`equip ${weapon}`, () => player(room)?.weapon === weapon);
}

async function captureScenario(
  room: LiveRoom,
  predictor: SelfPredictor,
  mode: "arena" | "belt",
  weapon: string,
  targetMode: number,
): Promise<ScenarioCapture> {
  await equip(room, weapon);
  const scenario = `${mode}:${weapon}:slow`;
  const frames: LiveFrame[] = [];
  let step = 0;
  for (; step < 8; step++) frames.push(await captureStep(room, predictor, scenario, step, 1));

  const owner = player(room);
  room.send("attack", {
    aimX: 1,
    aimY: 0,
    tx: owner.x + 600,
    ty: owner.y,
  });

  let observedAttackMode = false;
  for (; step < 32; step++) {
    const frame = await captureStep(room, predictor, scenario, step, 1);
    frames.push(frame);
    if (frame.attackMoveMode === targetMode) {
      observedAttackMode = true;
      step++;
      break;
    }
  }
  if (!observedAttackMode) throw new Error(`${scenario} never entered attack movement mode ${targetMode}`);

  const releaseTick = Number(room.state?.tick ?? 0);
  const releaseFrames: LiveFrame[] = [];
  for (let releaseStep = 1; releaseStep <= 10; releaseStep++, step++) {
    const frame = await captureStep(room, predictor, scenario, step, 0);
    frames.push(frame);
    releaseFrames.push(frame);
  }
  const finalReleaseFrame = releaseFrames.at(-1);
  if (!finalReleaseFrame) throw new Error(`${scenario} produced no release frames`);
  const stopIndex = releaseFrames.findIndex(
    (frame) =>
      Math.hypot(frame.authority.mvx, frame.authority.mvy) === 0 &&
      frame.predictionErrorPx === 0 &&
      releaseFrames
        .slice(releaseFrames.indexOf(frame))
        .every(
          (later) =>
            Math.hypot(
              later.authority.x - finalReleaseFrame.authority.x,
              later.authority.y - finalReleaseFrame.authority.y,
            ) <= 1e-6,
        ),
  );
  if (stopIndex < 0) throw new Error(`${scenario} did not stop within capture window`);
  const stoppedTick = releaseFrames[stopIndex]!.serverTick;
  const stopTicks = stoppedTick - releaseTick;
  if (stopTicks > STOP_WITHIN_TICKS)
    throw new Error(
      `${scenario} stopped in ${stopTicks} ticks, expected <= ${STOP_WITHIN_TICKS}: ${JSON.stringify(
        releaseFrames.map((frame) => ({
          tick: frame.serverTick,
          mode: frame.attackMoveMode,
          x: frame.authority.x,
          mvx: frame.authority.mvx,
          err: frame.predictionErrorPx,
        })),
      )}`,
    );

  const recovery = frames.slice(-4);
  const final = recovery.at(-1);
  if (!final) throw new Error(`${scenario} capture produced no recovery frames`);
  if (recovery.some((frame) => frame.authorityPredictionDeltaPx > 1e-6))
    throw new Error(`${scenario} retained authority/prediction delta after release`);
  if (recovery.some((frame) => Math.hypot(frame.authority.mvx, frame.authority.mvy) > 0))
    throw new Error(`${scenario} retained movement velocity after release`);
  const stoppedFrame = frames.find((frame) => frame.serverTick === stoppedTick);
  if (!stoppedFrame) throw new Error(`${scenario} lost its stopped frame`);
  const postStopTravelPx = Math.hypot(
    final.authority.x - stoppedFrame.authority.x,
    final.authority.y - stoppedFrame.authority.y,
  );
  if (postStopTravelPx > 1e-6)
    throw new Error(`${scenario} traveled ${postStopTravelPx}px after its stop tick`);

  return {
    mode,
    weapon,
    attackMode: targetMode,
    releaseTick,
    stoppedTick,
    stopTicks,
    maxPostPatchDeltaPx: Math.max(...frames.map((frame) => frame.authorityPredictionDeltaPx)),
    maxReconciliationErrorPx: Math.max(...frames.map((frame) => frame.predictionErrorPx)),
    maxRecoveryDeltaPx: Math.max(...recovery.map((frame) => frame.authorityPredictionDeltaPx)),
    postStopTravelPx,
    frames,
  };
}

async function captureMode(mode: "arena" | "belt"): Promise<ScenarioCapture[]> {
  const belt = mode === "belt";
  const room = await createLiveRoom(belt);
  const predictor = new SelfPredictor(serverView(room));
  if (belt) predictor.setBeltLevel(beltLevelFor("sky-carrier"));
  predictor.setRelics(player(room)?.dualWield?.relics);
  try {
    return [
      await captureScenario(
        room,
        predictor,
        mode,
        SLOW_WEAPON,
        PlayerAttackMoveMode.InputSlow,
      ),
      await captureScenario(
        room,
        predictor,
        mode,
        PLANTED_WEAPON,
        PlayerAttackMoveMode.InputSlow,
      ),
    ];
  } finally {
    await room.leave();
  }
}

const captures = [...(await captureMode("arena")), ...(await captureMode("belt"))];
const summary = {
  capturedAt: new Date().toISOString(),
  privatePorts: {
    client: clientPort,
    game: gamePort,
    protectedDefaultsUntouched: clientPort !== 5180 && gamePort !== 2567,
  },
  stopWithinTicks: STOP_WITHIN_TICKS,
  scenarios: captures.map((capture) => ({
    mode: capture.mode,
    weapon: capture.weapon,
    attackMode: capture.attackMode,
    releaseTick: capture.releaseTick,
    stoppedTick: capture.stoppedTick,
    stopTicks: capture.stopTicks,
    maxPostPatchDeltaPx: capture.maxPostPatchDeltaPx,
    maxReconciliationErrorPx: capture.maxReconciliationErrorPx,
    maxRecoveryDeltaPx: capture.maxRecoveryDeltaPx,
    postStopTravelPx: capture.postStopTravelPx,
  })),
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(path.join(evidenceDir, "live-telemetry.json"), `${JSON.stringify(captures, null, 2)}\n`);
await writeFile(path.join(evidenceDir, "live-summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
