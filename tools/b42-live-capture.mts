import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  type ArenaState,
  BELT_Y0,
  type BeltLevel,
  CORPORATE_ELEVATOR_PHASE,
  corporateGridFloorForBelt,
  MOVEMENT_CORRECTION_LARGE_PX,
  type MoveStance,
  type PlayerState,
  ROOM_NAME,
  TICK_MS,
} from "@dd/shared";
import { Client } from "../packages/client/node_modules/colyseus.js/build/esm/index.mjs";
import { SelfPredictor, type ServerView } from "../packages/client/src/net/prediction.js";
import { SnapshotBuffer } from "../packages/client/src/net/snapshots.js";
import { matchMaker } from "../packages/server/node_modules/colyseus/build/index.mjs";
import { createGameServer } from "../packages/server/src/index.js";

const b44NoWeaponDrift = process.env.DD_B44_LIVE === "1";
const evidenceDir = path.resolve(
  import.meta.dirname,
  b44NoWeaponDrift
    ? "../docs/owner-notes-audit-v11-evidence/b44-no-weapon-drift"
    : "../docs/owner-notes-audit-v11-evidence/b42-relaxed-authority",
);
const protectedPorts = new Set([5180, 2567]);
const stateTimeoutMs = 12_000;
const remoteSnapPx = MOVEMENT_CORRECTION_LARGE_PX;

type LiveRoom = Awaited<ReturnType<Client["joinOrCreate"]>>;

interface MovementFrame {
  step: number;
  tick: number;
  seq: number;
  inputX: number;
  attackMoveMode: number;
  authority: { x: number; y: number };
  predictedBeforePatch: { x: number; y: number };
  predictedAfterPatch: { x: number; y: number };
  observerAuthority: { x: number; y: number };
  observerRender: { x: number; y: number } | null;
  correctionSeq: number;
  selfCorrections: number;
}

interface LocalCorporateRoom {
  state: ArenaState;
  beltLevel: BeltLevel;
  beltRoomIdx: number;
  beltPhase: string;
  broadcastPatch(): void;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(label: string, predicate: () => boolean, timeoutMs = stateTimeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error(`Timed out waiting for ${label}`);
    await sleep(10);
  }
}

function row(room: LiveRoom, id = room.sessionId): PlayerState | undefined {
  return room.state?.players?.get(id) as PlayerState | undefined;
}

function serverView(room: LiveRoom): ServerView {
  const player = row(room);
  if (!player) throw new Error("owner player row unavailable");
  return {
    x: player.x,
    y: player.y,
    mvx: player.mvx,
    mvy: player.mvy,
    vx: player.vx,
    vy: player.vy,
    height: player.height,
    vh: player.vh,
    ackSeq: player.ackSeq,
    teleportSeq: player.teleportSeq,
    moveStance: player.moveStance as MoveStance,
    stanceSeq: player.stanceSeq,
    momentumX: player.momentumX,
    momentumY: player.momentumY,
    slidePhase: player.slidePhase,
    slidePhaseTick: player.slidePhaseTick,
    attackMoveMode: player.dualWield.attackMoveMode,
    movementCorrectionSeq: player.dualWield.movementCorrectionSeq,
    serverMotionEpoch: player.dualWield.serverMotionEpoch,
    serverMotionActive: player.dualWield.serverMotionActive,
    alive: player.alive,
  };
}

async function joinPair(
  endpoint: string,
  options: { belt: boolean; beltLevel: string; dimensionId: string; bossRush: boolean },
): Promise<[LiveRoom, LiveRoom]> {
  const moverClient = new Client(endpoint);
  const observerClient = new Client(endpoint);
  const mover = await moverClient.joinOrCreate(ROOM_NAME, options);
  const observer = await observerClient.joinOrCreate(ROOM_NAME, options);
  if (mover.roomId !== observer.roomId) throw new Error("two clients did not co-op in one room");
  await waitFor(
    "two-client schema rows",
    () =>
      !!row(mover) &&
      !!row(observer) &&
      !!row(mover, observer.sessionId) &&
      !!row(observer, mover.sessionId),
  );
  return [mover, observer];
}

async function movementStep(
  mover: LiveRoom,
  observer: LiveRoom,
  predictor: SelfPredictor,
  observerBuffer: SnapshotBuffer,
  step: number,
  dx: number,
  slide = false,
): Promise<MovementFrame> {
  const priorTick = Number(mover.state?.tick ?? 0);
  const cmd = predictor.mintCmd(dx, 0, false, false, false, dx || 1, 0, slide, slide);
  predictor.tick(cmd);
  const report = { ...predictor.clientMovementReport() };
  const before = predictor.renderPos(dx, 0, 0);
  mover.send("input", {
    ...cmd,
    fireHeld: false,
    aimX: dx || 1,
    aimY: 0,
    targetX: report.x + 400,
    targetY: report.y,
    clientX: report.x,
    clientY: report.y,
    clientMvx: report.mvx,
    clientMvy: report.mvy,
    clientVx: report.vx,
    clientVy: report.vy,
    clientServerMotionEpoch: report.serverMotionEpoch,
    clientCorrectionSeq: report.movementCorrectionSeq,
  });
  await waitFor(
    `movement ack ${cmd.seq}`,
    () => Number(row(mover)?.ackSeq ?? 0) === cmd.seq && Number(mover.state?.tick ?? 0) > priorTick,
  );
  const tick = Number(mover.state?.tick ?? 0);
  await waitFor(
    `observer patch ${tick}`,
    () => Number(observer.state?.tick ?? 0) >= tick && !!row(observer, mover.sessionId),
  );
  const authority = serverView(mover);
  predictor.reconcile(authority);
  predictor.decayError(TICK_MS / 1000, dx, 0);
  const after = predictor.renderPos(dx, 0, 0);
  const observed = row(observer, mover.sessionId);
  observerBuffer.push(tick * TICK_MS, observed.x, observed.y);
  const rendered = observerBuffer.sample(tick * TICK_MS - TICK_MS / 2, remoteSnapPx);
  return {
    step,
    tick,
    seq: cmd.seq,
    inputX: dx,
    attackMoveMode: authority.attackMoveMode ?? 0,
    authority: { x: authority.x, y: authority.y },
    predictedBeforePatch: before,
    predictedAfterPatch: after,
    observerAuthority: { x: observed.x, y: observed.y },
    observerRender: rendered,
    correctionSeq: authority.movementCorrectionSeq ?? 0,
    selfCorrections: predictor.stats.selfCorrections,
  };
}

async function captureMovementAndParry(endpoint: string) {
  const [mover, observer] = await joinPair(endpoint, {
    belt: false,
    beltLevel: "",
    dimensionId: "wild-west",
    bossRush: false,
  });
  mover.send("toggleTraining");
  await waitFor(
    "shared training mode",
    () => mover.state?.mode === "training" && observer.state?.mode === "training",
  );
  const weaponPlans = b44NoWeaponDrift
    ? [
        {
          weaponId: "x2-coyote-trickster-s-sparkmitt",
          steps: 28,
          attackSteps: new Set([0, 4, 8, 12, 16, 20, 24]),
          minimumAcceptedAttacks: 4,
        },
        {
          weaponId: "x2-venomtongue-trident",
          steps: 18,
          attackSteps: new Set([0]),
          minimumAcceptedAttacks: 1,
        },
        {
          weaponId: "x2-thunderhead-stormfists",
          steps: 18,
          attackSteps: new Set([0]),
          minimumAcceptedAttacks: 1,
        },
      ]
    : [
        {
          weaponId: "x2-sparkknuckle-hex-mitt",
          steps: 32,
          attackSteps: new Set([7, 20]),
          minimumAcceptedAttacks: 1,
        },
      ];
  const weaponRuns: Array<{
    observerBuffer: SnapshotBuffer;
    telemetry: {
      weaponId: string;
      frames: MovementFrame[];
      acceptedAttacks: number;
      correctionSeqBefore: number;
      correctionSeqAfter: number;
      selfCorrections: number;
    };
  }> = [];
  const predictor = new SelfPredictor(serverView(mover));
  predictor.setRelics(row(mover)?.dualWield?.relics);

  // Training setup deliberately teleports the party. Begin the predictor after setup, then retain its
  // command sequence across weapon swaps exactly as the live Arena client does.
  for (const plan of weaponPlans) {
    mover.send("devEquip", { weapon: plan.weaponId });
    await waitFor(`${plan.weaponId} equipped`, () => row(mover)?.weapon === plan.weaponId);
    const observerBuffer = new SnapshotBuffer();
    const initial = row(observer, mover.sessionId);
    observerBuffer.push(Number(observer.state.tick) * TICK_MS, initial.x, initial.y);
    const frames: MovementFrame[] = [];
    const attackSeqBefore = Number(row(mover).attackSeq);
    const correctionSeqBefore = Number(row(mover).dualWield.movementCorrectionSeq);
    const selfCorrectionsBefore = predictor.stats.selfCorrections;
    for (let step = 0; step < plan.steps; step++) {
      if (plan.attackSteps.has(step)) {
        const self = row(mover);
        mover.send("attack", { aimX: 1, aimY: 0, tx: self.x + 700, ty: self.y });
      }
      frames.push(await movementStep(mover, observer, predictor, observerBuffer, step, 1));
    }
    const acceptedAttacks = Number(row(mover).attackSeq) - attackSeqBefore;
    const correctionSeqAfter = Number(row(mover).dualWield.movementCorrectionSeq);
    if (
      predictor.stats.selfCorrections !== selfCorrectionsBefore ||
      correctionSeqAfter !== correctionSeqBefore ||
      frames.some((frame) => frame.attackMoveMode > 1) ||
      acceptedAttacks < plan.minimumAcceptedAttacks
    ) {
      throw new Error(
        `${plan.weaponId} attack-move gate failed: ${JSON.stringify({
          acceptedAttacks,
          minimumAcceptedAttacks: plan.minimumAcceptedAttacks,
          selfCorrectionsBefore,
          selfCorrectionsAfter: predictor.stats.selfCorrections,
          correctionSeqBefore,
          correctionSeqAfter,
          attackMoveModes: [...new Set(frames.map((frame) => frame.attackMoveMode))],
        })}`,
      );
    }
    weaponRuns.push({
      observerBuffer,
      telemetry: {
        weaponId: plan.weaponId,
        frames,
        acceptedAttacks,
        correctionSeqBefore,
        correctionSeqAfter,
        selfCorrections: predictor.stats.selfCorrections - selfCorrectionsBefore,
      },
    });
  }

  const finalRun = weaponRuns.at(-1);
  if (!finalRun) throw new Error("weapon movement plan produced no live run");
  const observerBuffer = finalRun.observerBuffer;
  const frames = weaponRuns.flatMap((run) => run.telemetry.frames);
  const normalCorrections = weaponRuns.reduce((sum, run) => sum + run.telemetry.selfCorrections, 0);
  const normalCorrectionSeq = row(mover).dualWield.movementCorrectionSeq;
  const observerAuthorityMismatch = Math.max(
    ...frames.map((frame) =>
      Math.hypot(
        frame.authority.x - frame.observerAuthority.x,
        frame.authority.y - frame.observerAuthority.y,
      ),
    ),
  );
  const observerSamples = frames
    .map((frame) => frame.observerRender)
    .filter((sample): sample is { x: number; y: number } => sample !== null);
  const observerMaxStep = Math.max(
    ...observerSamples.slice(1).map((sample, index) => {
      const previous = observerSamples[index];
      if (!previous) return 0;
      return Math.hypot(sample.x - previous.x, sample.y - previous.y);
    }),
  );
  const observerIntermediateSamples = frames.filter((frame, index) => {
    if (!frame.observerRender || index === 0) return false;
    const previous = frames[index - 1]?.observerAuthority;
    if (!previous) return false;
    const current = frame.observerAuthority;
    const sample = frame.observerRender;
    return (
      Math.hypot(current.x - previous.x, current.y - previous.y) > 3 &&
      Math.hypot(sample.x - previous.x, sample.y - previous.y) > 1e-6 &&
      Math.hypot(sample.x - current.x, sample.y - current.y) > 1e-6
    );
  }).length;
  if (observerAuthorityMismatch > 0.01 || observerIntermediateSamples === 0)
    throw new Error("observer did not receive and interpolate the adopted mover path");

  // Deliberately move the local predictor by a teleport-sized amount. The wire report is rejected by
  // continuity, correctionSeq advances, and the owner cuts straight back to server truth.
  const predictorInternals = predictor as unknown as {
    pred: { x: number; y: number };
  };
  predictorInternals.pred.x += MOVEMENT_CORRECTION_LARGE_PX + 360;
  const violationBefore = predictor.renderPos(0, 0, 0);
  const correctionSeqBefore = row(mover).dualWield.movementCorrectionSeq;
  const violationFrame = await movementStep(
    mover,
    observer,
    predictor,
    observerBuffer,
    frames.length,
    0,
  );
  const violationTruth = row(mover);
  if (violationTruth.dualWield.movementCorrectionSeq <= correctionSeqBefore)
    throw new Error("forced teleport violation did not advance correctionSeq");
  const violationAfter = predictor.renderPos(0, 0, 0);
  const violationErrorBeforePx = Math.hypot(
    violationBefore.x - violationTruth.x,
    violationBefore.y - violationTruth.y,
  );
  const violationErrorAfterPx = Math.hypot(
    violationAfter.x - violationTruth.x,
    violationAfter.y - violationTruth.y,
  );
  const violationSelfCorrectionsAfter = predictor.stats.selfCorrections;
  if (
    violationErrorBeforePx < MOVEMENT_CORRECTION_LARGE_PX ||
    violationErrorAfterPx > 1e-6 ||
    predictor.stats.correctionRemainingMs !== 0
  )
    throw new Error("large violation did not instant-snap to server truth");

  const beforeParry = {
    x: row(mover).x,
    y: row(mover).y,
    parriedSeq: row(mover).parriedSeq,
    epoch: row(mover).dualWield.serverMotionEpoch,
  };
  // Keep the second transport connected as the observer but remove it from enemy target candidacy so the
  // one armed live-gate commit deterministically pressures the mover.
  const localArena = matchMaker.getLocalRoomById(mover.roomId) as unknown as
    | { state: ArenaState; broadcastPatch(): void }
    | undefined;
  const localObserver = localArena?.state.players.get(observer.sessionId);
  if (!localArena || !localObserver) throw new Error("local observer fixture unavailable");
  localObserver.alive = false;
  localObserver.hp = 0;
  localArena.broadcastPatch();
  await waitFor(
    "observer removed from target candidacy",
    () => row(mover, observer.sessionId)?.alive === false,
  );
  mover.send("debugArmCommitDefense", { kind: "parry" });
  mover.send("debugSpawn", {
    kind: "critter",
    count: 1,
    angle: 0,
    distance: 160,
    attackReady: true,
  });
  await waitFor(
    "committed lunge parry",
    () => Number(row(mover)?.parriedSeq ?? 0) > beforeParry.parriedSeq,
  );
  const parryTick = Number(mover.state.tick);
  await waitFor(
    "observer parry placement",
    () =>
      Number(observer.state?.tick ?? 0) >= parryTick &&
      Number(row(observer, mover.sessionId)?.parriedSeq ?? 0) > beforeParry.parriedSeq,
  );
  const parryAuthority = serverView(mover);
  predictor.reconcile(parryAuthority);
  const parryOwnerInitial = predictor.renderPos(0, 0, 0);
  const parryCorrectionMs = predictor.stats.correctionRemainingMs;
  predictor.decayError(0.14, 0, 0);
  const parryOwnerRender = predictor.renderPos(0, 0, 0);
  const parryObserver = row(observer, mover.sessionId);
  const parryDistancePx = Math.hypot(
    parryAuthority.x - beforeParry.x,
    parryAuthority.y - beforeParry.y,
  );
  if (
    parryDistancePx <= 0 ||
    (parryAuthority.serverMotionEpoch ?? 0) <= beforeParry.epoch ||
    parryCorrectionMs <= 0 ||
    parryCorrectionMs > 140 + 1e-6 ||
    Math.hypot(parryOwnerRender.x - parryAuthority.x, parryOwnerRender.y - parryAuthority.y) >
      1e-6 ||
    Math.hypot(parryObserver.x - parryAuthority.x, parryObserver.y - parryAuthority.y) > 0.01
  )
    throw new Error(
      `parry slide did not converge on both clients through a server-motion epoch: ${JSON.stringify(
        {
          beforeParry,
          parryDistancePx,
          authority: parryAuthority,
          ownerInitial: parryOwnerInitial,
          parryCorrectionMs,
          owner: parryOwnerRender,
          observer: { x: parryObserver.x, y: parryObserver.y },
        },
      )}`,
    );

  return {
    rooms: [mover, observer],
    telemetry: {
      normal: {
        weapons: weaponRuns.map((run) => run.telemetry),
        frames,
        selfCorrections: normalCorrections,
        movementCorrectionSeq: normalCorrectionSeq,
        observerAuthorityMismatch,
        observerMaxStep,
        observerIntermediateSamples,
      },
      violation: {
        frame: violationFrame,
        correctionSeqBefore,
        correctionSeqAfter: violationTruth.dualWield.movementCorrectionSeq,
        errorBeforePx: violationErrorBeforePx,
        errorAfterPx: violationErrorAfterPx,
        correctionRemainingMs: predictor.stats.correctionRemainingMs,
        selfCorrectionsAfter: violationSelfCorrectionsAfter,
      },
      parry: {
        before: beforeParry,
        after: {
          tick: parryTick,
          x: parryAuthority.x,
          y: parryAuthority.y,
          parriedSeq: row(mover).parriedSeq,
          epoch: parryAuthority.serverMotionEpoch,
          active: parryAuthority.serverMotionActive,
        },
        distancePx: parryDistancePx,
        correctionStartMs: parryCorrectionMs,
        ownerInitialErrorPx: Math.hypot(
          parryOwnerInitial.x - parryAuthority.x,
          parryOwnerInitial.y - parryAuthority.y,
        ),
        ownerErrorPx: Math.hypot(
          parryOwnerRender.x - parryAuthority.x,
          parryOwnerRender.y - parryAuthority.y,
        ),
        observerErrorPx: Math.hypot(
          parryObserver.x - parryAuthority.x,
          parryObserver.y - parryAuthority.y,
        ),
      },
    },
  };
}

async function captureElevator(endpoint: string) {
  const [rider, observer] = await joinPair(endpoint, {
    belt: true,
    beltLevel: "corporate-grid",
    dimensionId: "paper-office",
    bossRush: false,
  });
  const localRoom = matchMaker.getLocalRoomById(rider.roomId) as unknown as
    | LocalCorporateRoom
    | undefined;
  if (!localRoom) throw new Error("local corporate room unavailable");
  const floor = corporateGridFloorForBelt(localRoom.beltLevel);
  const exit = floor?.elevatorMarkers[2];
  const spawn = floor?.playerSpawns[0];
  if (!floor || !exit || !spawn) throw new Error("corporate elevator markers unavailable");

  // Prime only the preceding combat outcome. Boarding and floor transition remain the real live room path.
  localRoom.state.enemies.clear();
  localRoom.beltRoomIdx = localRoom.beltLevel.rooms.length - 1;
  localRoom.beltPhase = "cleared";
  localRoom.state.elevatorPhase = CORPORATE_ELEVATOR_PHASE.ready;
  localRoom.state.elevatorDeadlineTick = 0;
  localRoom.state.players.forEach((player) => {
    player.x = exit.x - 40;
    player.y = BELT_Y0 + spawn.y;
  });
  localRoom.broadcastPatch();
  await waitFor(
    "both clients see ready elevator",
    () =>
      rider.state?.elevatorPhase === CORPORATE_ELEVATOR_PHASE.ready &&
      observer.state?.elevatorPhase === CORPORATE_ELEVATOR_PHASE.ready,
  );
  const depthBefore = Number(rider.state.corporateFloorDepth);
  const before = [...rider.state.players.entries()].map(([id, player]: [string, PlayerState]) => ({
    id,
    x: player.x,
    y: player.y,
    teleportSeq: player.teleportSeq,
    epoch: player.dualWield.serverMotionEpoch,
  }));
  rider.send("useElevator");
  await waitFor(
    "elevator countdown on both clients",
    () =>
      rider.state?.elevatorPhase === CORPORATE_ELEVATOR_PHASE.countdown &&
      observer.state?.elevatorPhase === CORPORATE_ELEVATOR_PHASE.countdown,
  );
  await waitFor(
    "next corporate floor on both clients",
    () =>
      Number(rider.state?.corporateFloorDepth ?? 0) > depthBefore &&
      Number(observer.state?.corporateFloorDepth ?? 0) > depthBefore,
  );
  const nextDepth = Number(rider.state.corporateFloorDepth);
  const placements = before.map((prior) => {
    const riderView = row(rider, prior.id);
    const observerView = row(observer, prior.id);
    return {
      id: prior.id,
      before: prior,
      rider: {
        x: riderView.x,
        y: riderView.y,
        teleportSeq: riderView.teleportSeq,
        epoch: riderView.dualWield.serverMotionEpoch,
      },
      observer: {
        x: observerView.x,
        y: observerView.y,
        teleportSeq: observerView.teleportSeq,
        epoch: observerView.dualWield.serverMotionEpoch,
      },
      crossClientErrorPx: Math.hypot(riderView.x - observerView.x, riderView.y - observerView.y),
    };
  });
  if (
    placements.some(
      (placement) =>
        placement.rider.teleportSeq <= placement.before.teleportSeq ||
        placement.rider.epoch <= placement.before.epoch ||
        placement.rider.x >= 600 ||
        placement.crossClientErrorPx > 0.01,
    )
  )
    throw new Error("elevator boarding did not place the full party identically on both clients");
  return {
    rooms: [rider, observer],
    telemetry: {
      roomId: rider.roomId,
      depthBefore,
      depthAfter: nextDepth,
      phaseAfter: rider.state.elevatorPhase,
      placements,
    },
  };
}

const server = await createGameServer(0);
const address = server.transport.server?.address();
if (!address || typeof address === "string") throw new Error("ephemeral game port unavailable");
const port = address.port;
if (protectedPorts.has(port)) throw new Error(`ephemeral gate selected protected port ${port}`);
const endpoint = `ws://127.0.0.1:${port}`;
const openRooms: LiveRoom[] = [];

try {
  const movement = await captureMovementAndParry(endpoint);
  openRooms.push(...movement.rooms);
  const elevator = await captureElevator(endpoint);
  openRooms.push(...elevator.rooms);
  const summary = {
    capturedAt: new Date().toISOString(),
    transport: {
      endpoint,
      osAssignedEphemeralPort: port,
      protectedDefaultsUntouched: !protectedPorts.has(port),
      clients: 4,
      simultaneousClientsPerScenario: 2,
      liveStackBooted: true,
    },
    assertions: {
      normalSelfCorrectionsZero: movement.telemetry.normal.selfCorrections === 0,
      normalCorrectionSeqZero: movement.telemetry.normal.movementCorrectionSeq === 0,
      weaponRootMotionModeAbsent: movement.telemetry.normal.weapons.every((run) =>
        run.frames.every((frame) => frame.attackMoveMode <= 1),
      ),
      weaponAttackCorrectionsZero: movement.telemetry.normal.weapons.every(
        (run) => run.selfCorrections === 0 && run.correctionSeqAfter === run.correctionSeqBefore,
      ),
      observerInterpolated: movement.telemetry.normal.observerIntermediateSamples > 0,
      forcedViolationInstantSnap: movement.telemetry.violation.errorAfterPx <= 1e-6,
      correctionCapMs: 140,
      parryBothClients:
        movement.telemetry.parry.ownerErrorPx <= 1e-6 &&
        movement.telemetry.parry.observerErrorPx <= 0.01,
      elevatorBothClients: elevator.telemetry.placements.every(
        (placement) => placement.crossClientErrorPx <= 0.01,
      ),
    },
    normal: {
      frameCount: movement.telemetry.normal.frames.length,
      selfCorrections: movement.telemetry.normal.selfCorrections,
      movementCorrectionSeq: movement.telemetry.normal.movementCorrectionSeq,
      observerMaxStep: movement.telemetry.normal.observerMaxStep,
      observerIntermediateSamples: movement.telemetry.normal.observerIntermediateSamples,
      weapons: movement.telemetry.normal.weapons.map((run) => ({
        weaponId: run.weaponId,
        frameCount: run.frames.length,
        acceptedAttacks: run.acceptedAttacks,
        attackMoveModes: [...new Set(run.frames.map((frame) => frame.attackMoveMode))],
        selfCorrections: run.selfCorrections,
        correctionSeqBefore: run.correctionSeqBefore,
        correctionSeqAfter: run.correctionSeqAfter,
      })),
    },
    violation: movement.telemetry.violation,
    parry: movement.telemetry.parry,
    elevator: elevator.telemetry,
  };
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(
    path.join(evidenceDir, "live-telemetry.json"),
    `${JSON.stringify({ movement: movement.telemetry, elevator: elevator.telemetry }, null, 2)}\n`,
  );
  await writeFile(
    path.join(evidenceDir, "live-summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
  );
  await writeFile(
    path.join(evidenceDir, "README.md"),
    [
      b44NoWeaponDrift
        ? "# B44 no-weapon-drift — private live gate"
        : "# B42 relaxed movement authority — private live gate",
      "",
      `Real Colyseus transport on OS-assigned loopback port ${port}; protected ports 5180/2567 were untouched.`,
      "",
      "- `live-summary.json`: pass/fail assertions and compact telemetry.",
      "- `live-telemetry.json`: every mover/observer frame, forced violation, parry epoch, and elevator placement.",
      b44NoWeaponDrift
        ? "- Sparkmitt, Venomtongue, and Stormfists attack-while-moving runs never entered a displacement mode and produced zero owner corrections."
        : "- Normal attack–move–stop reports produced zero owner corrections.",
      "- The observer sampled intermediate positions from the adopted server path.",
      "- A teleport-sized client violation advanced the correction epoch and snapped instantly.",
      "- A real committed-lunge parry and real corporate elevator transition converged on both clients.",
      "",
    ].join("\n"),
  );
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await Promise.allSettled(openRooms.map((room) => room.leave()));
  try {
    await server.gracefullyShutdown(false);
  } finally {
    if (server.transport.server?.listening) server.transport.shutdown();
  }
}
