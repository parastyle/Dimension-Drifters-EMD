import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  type ArenaState,
  type MoveStance,
  type PlayerState,
  ROOM_NAME,
  TICK_MS,
  TILE_GROUND,
  WEAPONS,
} from "@dd/shared";
import { Client } from "../packages/client/node_modules/colyseus.js/build/esm/index.mjs";
import { SelfPredictor, type ServerView } from "../packages/client/src/net/prediction.js";
import { matchMaker } from "../packages/server/node_modules/colyseus/build/index.mjs";
import { createGameServer } from "../packages/server/src/index.js";

const evidenceDir = path.resolve(
  import.meta.dirname,
  "../docs/owner-notes-audit-v11-evidence/b45-gun-recoil",
);
const protectedPorts = new Set([5180, 2567]);
const timeoutMs = 12_000;

type LiveRoom = Awaited<ReturnType<Client["joinOrCreate"]>>;

interface LocalRoom {
  state: ArenaState;
  map: { tiles: Uint8Array; pois: unknown[] };
  combat: Map<
    string,
    { cd: number; attackBuffer: number; lastGroundX: number; lastGroundY: number }
  >;
  inputs: Map<
    string,
    {
      mvx: number;
      mvy: number;
      held: { dx: number; dy: number; fireHeld: boolean };
    }
  >;
  serverMotionSourceByPlayer: Map<string, string>;
  spawnAccum: number;
  shifterCd: number;
  broadcastPatch(): void;
}

interface Plan {
  weaponId: string;
  label: string;
  fireTicks: number;
  settleTicks: number;
}

const plans: readonly Plan[] = [
  {
    weaponId: "x-gun-revolver-cannon",
    label: "pistol-nudge",
    fireTicks: 1,
    settleTicks: 14,
  },
  {
    weaponId: "x-gun-coffin-shotgun",
    label: "shotgun-shove",
    fireTicks: 1,
    settleTicks: 14,
  },
  {
    weaponId: "x2-calamity-howitzer",
    label: "heavy-cannon-push",
    fireTicks: 1,
    settleTicks: 14,
  },
  {
    weaponId: "x-gun-gatling",
    label: "sustained-gatling-creep",
    fireTicks: 24,
    settleTicks: 14,
  },
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(
  label: string,
  predicate: () => boolean,
  limitMs = timeoutMs,
): Promise<void> {
  const deadline = Date.now() + limitMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error(`Timed out waiting for ${label}`);
    await sleep(10);
  }
}

function row(room: LiveRoom, id = room.sessionId): PlayerState | undefined {
  return room.state?.players?.get(id) as PlayerState | undefined;
}

function requiredRow(room: LiveRoom, id = room.sessionId): PlayerState {
  const player = row(room, id);
  if (!player) throw new Error(`player row unavailable: ${id}`);
  return player;
}

function serverView(room: LiveRoom): ServerView {
  const player = requiredRow(room);
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

async function joinPair(endpoint: string): Promise<[LiveRoom, LiveRoom]> {
  const ownerClient = new Client(endpoint);
  const observerClient = new Client(endpoint);
  const options = {
    belt: false,
    beltLevel: "",
    dimensionId: "wild-west",
    bossRush: false,
  };
  const owner = await ownerClient.joinOrCreate(ROOM_NAME, options);
  const observer = await observerClient.joinOrCreate(ROOM_NAME, options);
  if (owner.roomId !== observer.roomId) throw new Error("two clients did not join one co-op room");
  await waitFor(
    "two-client schema rows",
    () =>
      !!row(owner) &&
      !!row(observer) &&
      !!row(owner, observer.sessionId) &&
      !!row(observer, owner.sessionId),
  );
  return [owner, observer];
}

async function runPlan(
  owner: LiveRoom,
  observer: LiveRoom,
  local: LocalRoom,
  plan: Plan,
  predictor: SelfPredictor,
): Promise<Record<string, unknown>> {
  owner.send("devEquip", { weapon: plan.weaponId });
  await waitFor(`${plan.weaponId} equip`, () => row(owner)?.weapon === plan.weaponId);
  await waitFor(
    `${plan.weaponId} prior epoch release`,
    () => !row(owner)?.dualWield.serverMotionActive,
  );

  const localOwner = local.state.players.get(owner.sessionId);
  const localObserver = local.state.players.get(observer.sessionId);
  const combat = local.combat.get(owner.sessionId);
  const input = local.inputs.get(owner.sessionId);
  if (!localOwner || !localObserver || !combat || !input)
    throw new Error("local two-client recoil fixture unavailable");
  local.map.tiles.fill(TILE_GROUND);
  local.map.pois.length = 0;
  local.state.enemies.clear();
  local.spawnAccum = -1_000_000;
  local.shifterCd = 1_000_000;
  localOwner.x = 2_200;
  localOwner.y = 1_500;
  localOwner.vx = 0;
  localOwner.vy = 0;
  localOwner.mvx = 0;
  localOwner.mvy = 0;
  localObserver.x = 600;
  localObserver.y = 600;
  combat.cd = 0;
  combat.attackBuffer = 0;
  combat.lastGroundX = localOwner.x;
  combat.lastGroundY = localOwner.y;
  input.mvx = 0;
  input.mvy = 0;
  input.held.dx = 0;
  input.held.dy = 0;
  input.held.fireHeld = false;
  local.broadcastPatch();
  await waitFor(
    `${plan.weaponId} setup patch`,
    () =>
      Math.abs((row(owner)?.x ?? 0) - localOwner.x) < 0.01 &&
      Math.abs((row(observer, owner.sessionId)?.x ?? 0) - localOwner.x) < 0.01,
  );

  const startPlayer = requiredRow(owner);
  const start = {
    x: startPlayer.x,
    y: startPlayer.y,
    attackSeq: startPlayer.attackSeq,
    correctionSeq: startPlayer.dualWield.movementCorrectionSeq,
    epoch: startPlayer.dualWield.serverMotionEpoch,
  };
  predictor.reconcile(serverView(owner));
  const selfCorrectionsBefore = predictor.stats.selfCorrections;
  const frames: Array<Record<string, unknown>> = [];
  let observedAcceptedShots = 0;
  let lastAttackSeq = start.attackSeq;

  for (let step = 0; step < plan.fireTicks + plan.settleTicks; step++) {
    const firing = step < plan.fireTicks;
    if (firing) {
      const self = requiredRow(owner);
      owner.send("attack", { aimX: 1, aimY: 0, tx: self.x + 800, ty: self.y });
    }
    const priorTick = Number(owner.state.tick);
    const cmd = predictor.mintCmd(0, 0, false, false, false, 1, 0, false, false);
    predictor.tick(cmd);
    const report = predictor.clientMovementReport();
    owner.send("input", {
      ...cmd,
      fireHeld: firing,
      aimX: 1,
      aimY: 0,
      targetX: report.x + 800,
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
      `${plan.weaponId} ack ${cmd.seq}`,
      () => row(owner)?.ackSeq === cmd.seq && Number(owner.state.tick) > priorTick,
    );
    const tick = Number(owner.state.tick);
    await waitFor(
      `${plan.weaponId} observer tick ${tick}`,
      () => Number(observer.state.tick) >= tick && !!row(observer, owner.sessionId),
    );
    const authority = serverView(owner);
    predictor.reconcile(authority);
    predictor.decayError(TICK_MS / 1000, 0, 0);
    const ownerRender = predictor.renderPos(0, 0, 0);
    const observerView = requiredRow(observer, owner.sessionId);
    const attackSeq = requiredRow(owner).attackSeq;
    if ((attackSeq - lastAttackSeq) >>> 0 > 0) observedAcceptedShots++;
    lastAttackSeq = attackSeq;
    frames.push({
      step,
      tick,
      firing,
      attackSeq,
      x: authority.x,
      y: authority.y,
      vx: authority.vx,
      vy: authority.vy,
      epoch: authority.serverMotionEpoch,
      active: authority.serverMotionActive,
      source: local.serverMotionSourceByPlayer.get(owner.sessionId) ?? "",
      correctionSeq: authority.movementCorrectionSeq,
      ownerRenderErrorPx: Math.hypot(ownerRender.x - authority.x, ownerRender.y - authority.y),
      observerErrorPx: Math.hypot(observerView.x - authority.x, observerView.y - authority.y),
    });
  }

  const end = requiredRow(owner);
  const displacement = start.x - Math.min(...frames.map((frame) => Number(frame.x)));
  const maxObserverErrorPx = Math.max(...frames.map((frame) => Number(frame.observerErrorPx)));
  const classifiedFrames = frames.filter((frame) => frame.source === "weapon-fire-recoil").length;
  const weapon = WEAPONS[plan.weaponId];
  const result = {
    ...plan,
    recoil: weapon?.recoil ?? 0,
    cameraKick: weapon?.gun?.recoil ?? 0,
    acceptedShots: observedAcceptedShots,
    displacementPx: displacement,
    correctionSeqBefore: start.correctionSeq,
    correctionSeqAfter: end.dualWield.movementCorrectionSeq,
    epochBefore: start.epoch,
    epochAfter: end.dualWield.serverMotionEpoch,
    classifiedFrames,
    maxObserverErrorPx,
    ownerSelfCorrections: predictor.stats.selfCorrections - selfCorrectionsBefore,
    frames,
  };
  if (
    observedAcceptedShots < (plan.fireTicks === 1 ? 1 : 8) ||
    displacement <= 0 ||
    end.dualWield.movementCorrectionSeq !== start.correctionSeq ||
    end.dualWield.serverMotionEpoch <= start.epoch ||
    classifiedFrames === 0 ||
    maxObserverErrorPx > 0.01
  )
    throw new Error(`${plan.weaponId} live recoil gate failed: ${JSON.stringify(result)}`);
  return result;
}

const server = await createGameServer(0);
const address = server.transport.server?.address();
if (!address || typeof address === "string") throw new Error("ephemeral game port unavailable");
const port = address.port;
if (protectedPorts.has(port)) throw new Error(`ephemeral gate selected protected port ${port}`);
const endpoint = `ws://127.0.0.1:${port}`;
const openRooms: LiveRoom[] = [];

try {
  const [owner, observer] = await joinPair(endpoint);
  openRooms.push(owner, observer);
  owner.send("toggleTraining");
  await waitFor(
    "shared training room",
    () => owner.state.mode === "training" && observer.state.mode === "training",
  );
  const local = matchMaker.getLocalRoomById(owner.roomId) as unknown as LocalRoom | undefined;
  if (!local) throw new Error("local room unavailable");
  const predictor = new SelfPredictor(serverView(owner));
  predictor.setRelics(row(owner)?.dualWield?.relics);
  const runs: Record<string, unknown>[] = [];
  for (const plan of plans) runs.push(await runPlan(owner, observer, local, plan, predictor));

  const compact = runs.map((run) => {
    const { frames: _frames, ...summary } = run as Record<string, unknown>;
    return summary;
  });
  const displacementByLabel = Object.fromEntries(
    compact.map((run) => [String(run.label), Number(run.displacementPx)]),
  );
  const assertions = {
    privateEphemeralPort: !protectedPorts.has(port),
    fourWeaponClassesCovered: runs.length === 4,
    zeroEnvelopeRejections: compact.every(
      (run) => run.correctionSeqAfter === run.correctionSeqBefore,
    ),
    observerSawSameMotion: compact.every((run) => Number(run.maxObserverErrorPx) <= 0.01),
    allMotionClassified: compact.every((run) => Number(run.classifiedFrames) > 0),
    pistolNudge:
      displacementByLabel["pistol-nudge"] > 3 && displacementByLabel["pistol-nudge"] < 15,
    shotgunShove: displacementByLabel["shotgun-shove"] > displacementByLabel["pistol-nudge"] + 7,
    heavyPush: displacementByLabel["heavy-cannon-push"] > displacementByLabel["shotgun-shove"] + 5,
    gatlingCreep:
      displacementByLabel["sustained-gatling-creep"] > displacementByLabel["pistol-nudge"],
  };
  if (Object.values(assertions).some((value) => value !== true))
    throw new Error(`B45 live assertions failed: ${JSON.stringify({ assertions, compact })}`);

  const summary = {
    capturedAt: new Date().toISOString(),
    transport: {
      endpoint,
      osAssignedEphemeralPort: port,
      protectedDefaultsUntouched: !protectedPorts.has(port),
      simultaneousClients: 2,
      liveColyseusStack: true,
    },
    assertions,
    runs: compact,
  };
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(
    path.join(evidenceDir, "live-telemetry.json"),
    `${JSON.stringify({ ...summary, runs }, null, 2)}\n`,
  );
  await writeFile(
    path.join(evidenceDir, "live-summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
  );
  await writeFile(
    path.join(evidenceDir, "README.md"),
    [
      "# B45 real gun recoil — private two-client live gate",
      "",
      `A real Colyseus server used OS-assigned loopback port ${port}; protected ports 5180 and 2567 were untouched.`,
      "",
      "- `live-summary.json` contains the compact assertion matrix and per-weapon displacement.",
      "- `live-telemetry.json` contains every owner/observer tick, impulse velocity, motion epoch/source, and B42 correction counter.",
      "- The owner fired a pistol, shotgun, heavy howitzer, and sustained gatling through the real input/attack transport.",
      "- Every recoil run entered `weapon-fire-recoil`, the observer matched authority within 0.01 px, and the movement-correction counter never advanced.",
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
