import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  type ArenaMap,
  type ArenaState,
  BELT_Y0,
  type BeltLevel,
  ChestState,
  CORPORATE_ELEVATOR_PHASE,
  corporateGridFloorForBelt,
  EnemyState,
  MovementCorrectionBand,
  type MoveStance,
  meleeComboSelectionFor,
  movementCorrectionBand,
  type PlayerState,
  ROOM_NAME,
  SLIDE_PHASE_OFF,
  STANCE_NONE,
  TICK_MS,
  TILE_GROUND,
  TILE_PIT,
  UltimateFamily,
  ultimateCodeFor,
  WEAPONS,
} from "@dd/shared";
import { Client } from "../packages/client/node_modules/colyseus.js/build/esm/index.mjs";
import {
  type PredCmd,
  SelfPredictor,
  type ServerView,
} from "../packages/client/src/net/prediction.js";
import { matchMaker } from "../packages/server/node_modules/colyseus/build/index.mjs";
import { createGameServer } from "../packages/server/src/index.js";

const evidenceDir = path.resolve(
  import.meta.dirname,
  "../docs/owner-notes-audit-v12-evidence/diag-rb-telemetry",
);
const protectedPorts = new Set([5180, 2567]);
const timeoutMs = 15_000;
const correctionEpsilonPx = 1e-6;

type LiveRoom = Awaited<ReturnType<Client["joinOrCreate"]>>;

interface HeldInput {
  seq: number;
  dx: number;
  dy: number;
  jump: boolean;
  crouchHeld: boolean;
  pound: boolean;
  slide: boolean;
  slideHeld: boolean;
  fireHeld: boolean;
  fireStartSeq: number;
  aimX: number;
  aimY: number;
  targetX: number;
  targetY: number;
}

interface LocalInput {
  queue: unknown[];
  held: HeldInput;
  lastSeq: number;
  mvx: number;
  mvy: number;
  freshMovement?: unknown;
}

interface LocalCombat {
  cd: number;
  reloadCd: number;
  attackBuffer: number;
  drawLock: number;
  lastGroundX: number;
  lastGroundY: number;
  lastWeapon: string;
  aimX: number;
  aimY: number;
  targetX: number;
  targetY: number;
  stance: number;
  slidePhase: number;
  slidePhaseTick: number;
  slideParryLockT: number;
  rollCd: number;
  recoveryT: number;
  pitGrace: number;
  invuln: number;
  parryCd: number;
  parryBuffer: number;
  parryOpenedTick: number;
  jumpCd: number;
  jumpBuffer: number;
  distJumpCd: number;
  poundUsed: boolean;
  poundGatherT: number;
  momentumX: number;
  momentumY: number;
  vh: number;
  gunBurstWeaponId: string;
  gunBurstRemaining: number;
  gunBurstT: number;
  beamPhase: number;
  beamDescriptor?: unknown;
  beamPhaseT: number;
  beamChannelT: number;
  beamInputWasHeld: boolean;
  beamPulseT: number;
  beamQuantumT: number;
  beamHitIds: Set<string>;
  beamPendingDamage: Map<string, number>;
  drive: {
    valueF: number;
    recoveryDebtF: number;
    pressureUntilTick: number;
    beamLockEndTick: number;
    beamRecoveryEndTick: number;
    beamRequireRelease: boolean;
    tickCreditF: number;
    tickDebitF: number;
    tickOpen: boolean;
  };
  ultChargeF: number;
  ultBuffer: number;
  ult?: unknown;
}

interface LocalRoom {
  state: ArenaState;
  map: ArenaMap;
  beltLevel: BeltLevel | null;
  spawnBeltWave(n: number, x0: number, x1: number, depth?: number): void;
  combat: Map<string, LocalCombat>;
  inputs: Map<string, LocalInput>;
  serverMotionSourceByPlayer: Map<string, string>;
  serverMotionUntilTick: Map<string, number>;
  spawnAccum: number;
  shifterCd: number;
  beginServerMotion(player: PlayerState, ticks: number, source: string): void;
  broadcastPatch(): void;
}

interface ServerTickMotion {
  tick: number;
  x: number;
  y: number;
  mvx: number;
  mvy: number;
  vx: number;
  vy: number;
  height: number;
  vh: number;
  alive: boolean;
  stance: number;
  stanceSeq: number;
  momentumX: number;
  momentumY: number;
  slidePhase: number;
  slidePhaseTick: number;
  attackMoveMode: number;
  correctionSeq: number;
  motionEpoch: number;
  motionActive: boolean;
  motionSource: string;
  teleportSeq: number;
  ackSeq: number;
  attackSeq: number;
  parriedSeq: number;
  fellSeq: number;
  poundSeq: number;
  ultSeq: number;
  ultPhase: number;
}

interface TickInput {
  dx?: number;
  dy?: number;
  jump?: boolean;
  pound?: boolean;
  slide?: boolean;
  slideHeld?: boolean;
  fireHeld?: boolean;
  aimX?: number;
  aimY?: number;
  action?: string;
  beforeSend?: () => void;
}

interface CapturedApplication {
  dx: number;
  dy: number;
  magnitudePx: number;
  band: "silent" | "smooth" | "snap";
  remainingMsAfterApply: number;
}

interface CorrectionEvent extends CapturedApplication {
  tick: number;
  elapsedMs: number;
  action: string;
  counterDelta: number;
  causes: string[];
  authority: {
    x: number;
    y: number;
    mvx: number;
    mvy: number;
    vx: number;
    vy: number;
    height: number;
    vh: number;
  };
  motion: {
    active: boolean;
    epoch: number;
    source: string;
    correctionSeq: number;
    teleportSeq: number;
    stance: number;
    slidePhase: number;
    slidePhaseTick: number;
    attackMoveMode: number;
  };
}

interface TickFrame {
  index: number;
  tick: number;
  elapsedMs: number;
  action: string;
  input: {
    dx: number;
    dy: number;
    jump: boolean;
    pound: boolean;
    slide: boolean;
    slideHeld: boolean;
    fireHeld: boolean;
  };
  authority: ServerTickMotion;
  delta: {
    positionPx: number;
    movementEpoch: number;
    correctionSeq: number;
    teleportSeq: number;
  };
  causes: string[];
  b42: {
    counterBefore: number;
    counterAfter: number;
    counterDelta: number;
    pending: number;
  };
  correction: {
    requests: number;
    nonzeroRequests: number;
    maxMagnitudePx: number;
    errorBeforeDecayPx: number;
    remainingBeforeDecayMs: number;
    errorAfterDecayPx: number;
    remainingAfterDecayMs: number;
    renderedBefore: { x: number; y: number };
    renderedAfterReconcile: { x: number; y: number };
    renderedAfterDecay: { x: number; y: number };
  };
}

interface ScenarioResult {
  id: string;
  label: string;
  category: string;
  metadata: Record<string, unknown>;
  assertions: Record<string, boolean>;
  start: ServerTickMotion;
  end: ServerTickMotion;
  summary: {
    b42CounterEdges: number;
    correctionRequests: number;
    nonzeroCorrections: number;
    silentCorrections: number;
    smoothCorrections: number;
    snapCorrections: number;
    totalMagnitudePx: number;
    maxMagnitudePx: number;
    meanMagnitudePx: number;
    correctionDebtDurationMs: number;
    serverMotionDurationMs: number;
    maxCorrectionWindowMs: number;
    scenarioDurationMs: number;
    peakAuthorityStepPx: number;
    sourceCounts: Record<string, number>;
    causeCounts: Record<string, number>;
  };
  corrections: CorrectionEvent[];
  frames: TickFrame[];
}

interface PredictorInternals {
  seq: number;
  applyMovementCorrection(dx: number, dy: number): void;
}

interface InstrumentedRoom {
  room: LiveRoom;
  local: LocalRoom;
  serverTicks: Map<number, ServerTickMotion>;
}

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
    await sleep(8);
  }
}

function playerRow(room: LiveRoom): PlayerState | undefined {
  return room.state?.players?.get(room.sessionId) as PlayerState | undefined;
}

function requiredPlayer(room: LiveRoom): PlayerState {
  const player = playerRow(room);
  if (!player) throw new Error(`player row unavailable: ${room.sessionId}`);
  return player;
}

function serverView(room: LiveRoom): ServerView {
  const player = requiredPlayer(room);
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

function serverViewFromTick(tick: ServerTickMotion): ServerView {
  return {
    x: tick.x,
    y: tick.y,
    mvx: tick.mvx,
    mvy: tick.mvy,
    vx: tick.vx,
    vy: tick.vy,
    height: tick.height,
    vh: tick.vh,
    ackSeq: tick.ackSeq,
    teleportSeq: tick.teleportSeq,
    moveStance: tick.stance as MoveStance,
    stanceSeq: tick.stanceSeq,
    momentumX: tick.momentumX,
    momentumY: tick.momentumY,
    slidePhase: tick.slidePhase,
    slidePhaseTick: tick.slidePhaseTick,
    attackMoveMode: tick.attackMoveMode,
    movementCorrectionSeq: tick.correctionSeq,
    serverMotionEpoch: tick.motionEpoch,
    serverMotionActive: tick.motionActive,
    alive: tick.alive,
  };
}

function snapshotServerTick(local: LocalRoom, playerId: string): ServerTickMotion | undefined {
  const player = local.state.players.get(playerId);
  if (!player) return undefined;
  return {
    tick: Number(local.state.tick),
    x: player.x,
    y: player.y,
    mvx: player.mvx,
    mvy: player.mvy,
    vx: player.vx,
    vy: player.vy,
    height: player.height,
    vh: player.vh,
    alive: player.alive,
    stance: player.moveStance,
    stanceSeq: player.stanceSeq,
    momentumX: player.momentumX,
    momentumY: player.momentumY,
    slidePhase: player.slidePhase,
    slidePhaseTick: player.slidePhaseTick,
    attackMoveMode: player.dualWield.attackMoveMode,
    correctionSeq: player.dualWield.movementCorrectionSeq,
    motionEpoch: player.dualWield.serverMotionEpoch,
    motionActive: player.dualWield.serverMotionActive,
    motionSource: local.serverMotionSourceByPlayer.get(playerId) ?? "",
    teleportSeq: player.teleportSeq,
    ackSeq: player.ackSeq,
    attackSeq: player.attackSeq,
    parriedSeq: player.parriedSeq,
    fellSeq: player.fellSeq,
    poundSeq: player.poundSeq,
    ultSeq: player.ultSeq,
    ultPhase: player.ultPhase,
  };
}

function snapshotFromWire(room: LiveRoom, source = ""): ServerTickMotion {
  const player = requiredPlayer(room);
  return {
    tick: Number(room.state.tick),
    x: player.x,
    y: player.y,
    mvx: player.mvx,
    mvy: player.mvy,
    vx: player.vx,
    vy: player.vy,
    height: player.height,
    vh: player.vh,
    alive: player.alive,
    stance: player.moveStance,
    stanceSeq: player.stanceSeq,
    momentumX: player.momentumX,
    momentumY: player.momentumY,
    slidePhase: player.slidePhase,
    slidePhaseTick: player.slidePhaseTick,
    attackMoveMode: player.dualWield.attackMoveMode,
    correctionSeq: player.dualWield.movementCorrectionSeq,
    motionEpoch: player.dualWield.serverMotionEpoch,
    motionActive: player.dualWield.serverMotionActive,
    motionSource: source,
    teleportSeq: player.teleportSeq,
    ackSeq: player.ackSeq,
    attackSeq: player.attackSeq,
    parriedSeq: player.parriedSeq,
    fellSeq: player.fellSeq,
    poundSeq: player.poundSeq,
    ultSeq: player.ultSeq,
    ultPhase: player.ultPhase,
  };
}

function installServerTickRecorder(
  room: LiveRoom,
  local: LocalRoom,
): Map<number, ServerTickMotion> {
  const snapshots = new Map<number, ServerTickMotion>();
  const sourceAtTick = new Map<number, string>();
  const annotateSource = (source: string): void => {
    const tick = Number(local.state.tick);
    sourceAtTick.set(tick, source);
    if (!snapshots.has(tick)) return;
    const refreshed = snapshotServerTick(local, room.sessionId);
    if (!refreshed) return;
    refreshed.motionSource = source;
    snapshots.set(tick, refreshed);
  };
  const originalBeginServerMotion = local.beginServerMotion.bind(local);
  local.beginServerMotion = (player: PlayerState, ticks: number, source: string): void => {
    originalBeginServerMotion(player, ticks, source);
    if (player.id === room.sessionId) annotateSource(source);
  };
  const sources = local.serverMotionSourceByPlayer;
  const originalSourceSet = sources.set.bind(sources);
  sources.set = (playerId: string, source: string): typeof sources => {
    originalSourceSet(playerId, source);
    if (playerId === room.sessionId) annotateSource(source);
    return sources;
  };
  const original = local.broadcastPatch.bind(local);
  local.broadcastPatch = (): void => {
    const snapshot = snapshotServerTick(local, room.sessionId);
    if (snapshot) {
      snapshot.motionSource = sourceAtTick.get(snapshot.tick) ?? snapshot.motionSource;
      snapshots.set(snapshot.tick, snapshot);
    }
    original();
  };
  const initial = snapshotServerTick(local, room.sessionId);
  if (initial) snapshots.set(initial.tick, initial);
  return snapshots;
}

function correctionBandName(magnitudePx: number): CapturedApplication["band"] {
  const band = movementCorrectionBand(magnitudePx);
  if (band === MovementCorrectionBand.Silent) return "silent";
  if (band === MovementCorrectionBand.Smooth) return "smooth";
  return "snap";
}

function correctionCauses(previous: ServerTickMotion, current: ServerTickMotion): string[] {
  const causes: string[] = [];
  if (current.correctionSeq !== previous.correctionSeq) causes.push("movement-envelope-rejection");
  if (current.motionEpoch !== previous.motionEpoch) causes.push("server-motion-epoch");
  if (current.teleportSeq !== previous.teleportSeq) causes.push("teleport");
  if (current.motionActive) causes.push("server-motion-active");
  if (current.motionSource) causes.push(`source:${current.motionSource}`);
  return causes.length > 0 ? causes : ["relaxed-authority-reconcile"];
}

class ScenarioProbe {
  readonly corrections: CorrectionEvent[] = [];
  readonly frames: TickFrame[] = [];
  private previous: ServerTickMotion;
  private pendingApplications: CapturedApplication[] = [];
  private correctionDebtDurationMs = 0;
  private motionDurationMs = 0;

  constructor(
    readonly id: string,
    readonly label: string,
    readonly category: string,
    readonly metadata: Record<string, unknown>,
    private readonly instrumented: InstrumentedRoom,
    readonly predictor: SelfPredictor,
  ) {
    const input = instrumented.local.inputs.get(instrumented.room.sessionId);
    if (!input) throw new Error(`${id}: local input unavailable`);
    const internals = predictor as unknown as PredictorInternals;
    internals.seq = input.lastSeq;
    const originalApply = internals.applyMovementCorrection.bind(predictor);
    internals.applyMovementCorrection = (dx: number, dy: number): void => {
      originalApply(dx, dy);
      const magnitudePx = Math.hypot(dx, dy);
      this.pendingApplications.push({
        dx,
        dy,
        magnitudePx,
        band: correctionBandName(magnitudePx),
        remainingMsAfterApply: predictor.stats.correctionRemainingMs,
      });
    };
    this.previous = this.currentServerTick();
  }

  private currentServerTick(): ServerTickMotion {
    const tick = Number(this.instrumented.room.state.tick);
    return (
      this.instrumented.serverTicks.get(tick) ??
      snapshotFromWire(
        this.instrumented.room,
        this.instrumented.local.serverMotionSourceByPlayer.get(this.instrumented.room.sessionId) ??
          "",
      )
    );
  }

  private capture(
    current: ServerTickMotion,
    input: {
      dx: number;
      dy: number;
      jump: boolean;
      pound: boolean;
      slide: boolean;
      slideHeld: boolean;
      fireHeld: boolean;
      action: string;
    },
  ): TickFrame {
    const { dx, dy, jump, pound, slide, slideHeld, fireHeld, action } = input;
    const causes = correctionCauses(this.previous, current);
    const renderedBefore = this.predictor.renderPos(dx, dy, 0);
    const before = this.predictor.stats;
    this.pendingApplications = [];
    this.predictor.reconcile(serverViewFromTick(current));
    const afterReconcile = this.predictor.stats;
    const renderedAfterReconcile = this.predictor.renderPos(dx, dy, 0);
    const counterDelta = afterReconcile.selfCorrections - before.selfCorrections;
    const elapsedMs = this.frames.length * TICK_MS;

    for (const application of this.pendingApplications) {
      this.corrections.push({
        ...application,
        tick: current.tick,
        elapsedMs,
        action,
        counterDelta,
        causes,
        authority: {
          x: current.x,
          y: current.y,
          mvx: current.mvx,
          mvy: current.mvy,
          vx: current.vx,
          vy: current.vy,
          height: current.height,
          vh: current.vh,
        },
        motion: {
          active: current.motionActive,
          epoch: current.motionEpoch,
          source: current.motionSource,
          correctionSeq: current.correctionSeq,
          teleportSeq: current.teleportSeq,
          stance: current.stance,
          slidePhase: current.slidePhase,
          slidePhaseTick: current.slidePhaseTick,
          attackMoveMode: current.attackMoveMode,
        },
      });
    }

    this.correctionDebtDurationMs += Math.min(
      TICK_MS,
      Math.max(0, afterReconcile.correctionRemainingMs),
    );
    if (current.motionActive) this.motionDurationMs += TICK_MS;
    this.predictor.decayError(TICK_MS / 1000, dx, dy);
    const afterDecay = this.predictor.stats;
    const renderedAfterDecay = this.predictor.renderPos(dx, dy, 0);
    const nonzero = this.pendingApplications.filter(
      (event) => event.magnitudePx > correctionEpsilonPx,
    );
    const frame: TickFrame = {
      index: this.frames.length,
      tick: current.tick,
      elapsedMs,
      action,
      input: { dx, dy, jump, pound, slide, slideHeld, fireHeld },
      authority: current,
      delta: {
        positionPx: Math.hypot(current.x - this.previous.x, current.y - this.previous.y),
        movementEpoch: current.motionEpoch - this.previous.motionEpoch,
        correctionSeq: current.correctionSeq - this.previous.correctionSeq,
        teleportSeq: current.teleportSeq - this.previous.teleportSeq,
      },
      causes,
      b42: {
        counterBefore: before.selfCorrections,
        counterAfter: afterReconcile.selfCorrections,
        counterDelta,
        pending: afterReconcile.pending,
      },
      correction: {
        requests: this.pendingApplications.length,
        nonzeroRequests: nonzero.length,
        maxMagnitudePx: Math.max(0, ...nonzero.map((event) => event.magnitudePx)),
        errorBeforeDecayPx: afterReconcile.errPx,
        remainingBeforeDecayMs: afterReconcile.correctionRemainingMs,
        errorAfterDecayPx: afterDecay.errPx,
        remainingAfterDecayMs: afterDecay.correctionRemainingMs,
        renderedBefore: { x: renderedBefore.x, y: renderedBefore.y },
        renderedAfterReconcile: {
          x: renderedAfterReconcile.x,
          y: renderedAfterReconcile.y,
        },
        renderedAfterDecay: { x: renderedAfterDecay.x, y: renderedAfterDecay.y },
      },
    };
    this.frames.push(frame);
    this.previous = current;
    return frame;
  }

  async tick(options: TickInput = {}): Promise<TickFrame> {
    const room = this.instrumented.room;
    const dx = options.dx ?? 0;
    const dy = options.dy ?? 0;
    const jump = options.jump === true;
    const pound = options.pound === true;
    const slide = options.slide === true;
    const slideHeld = options.slideHeld ?? slide;
    const fireHeld = options.fireHeld === true;
    const aimX = options.aimX ?? (Math.hypot(dx, dy) > 1e-6 ? dx : 1);
    const aimY = options.aimY ?? (Math.hypot(dx, dy) > 1e-6 ? dy : 0);
    const action = options.action ?? "idle";
    options.beforeSend?.();

    const priorTick = Number(room.state.tick);
    const cmd: PredCmd & {
      fireHeld: boolean;
      aimX: number;
      aimY: number;
      targetX: number;
      targetY: number;
    } = {
      ...this.predictor.mintCmd(dx, dy, jump, false, pound, aimX, aimY, slide, slideHeld),
      fireHeld,
      aimX,
      aimY,
      targetX: requiredPlayer(room).x + aimX * 900,
      targetY: requiredPlayer(room).y + aimY * 900,
    };
    this.predictor.tick(cmd);
    const report = this.predictor.clientMovementReport();
    room.send("input", {
      ...cmd,
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
      `${this.id} ack ${cmd.seq}`,
      () => requiredPlayer(room).ackSeq === cmd.seq && Number(room.state.tick) > priorTick,
    );

    const latestTick = Number(room.state.tick);
    const snapshots = [...this.instrumented.serverTicks.values()]
      .filter((snapshot) => snapshot.tick > this.previous.tick && snapshot.tick <= latestTick)
      .sort((a, b) => a.tick - b.tick);
    if (snapshots.length === 0) snapshots.push(this.currentServerTick());
    const captureInput = {
      dx,
      dy,
      jump,
      pound,
      slide,
      slideHeld,
      fireHeld,
      action,
    };
    let frame: TickFrame | undefined;
    for (const snapshot of snapshots) frame = this.capture(snapshot, captureInput);
    if (!frame) throw new Error(`${this.id}: no server tick captured`);
    return frame;
  }

  finish(assertions: Record<string, boolean>): ScenarioResult {
    const applications = this.corrections.filter(
      (event) => event.magnitudePx > correctionEpsilonPx,
    );
    const totalMagnitudePx = applications.reduce((sum, event) => sum + event.magnitudePx, 0);
    const sourceCounts: Record<string, number> = {};
    const causeCounts: Record<string, number> = {};
    for (const event of applications) {
      const source = event.motion.source || "(none)";
      sourceCounts[source] = (sourceCounts[source] ?? 0) + 1;
      for (const cause of event.causes) causeCounts[cause] = (causeCounts[cause] ?? 0) + 1;
    }
    const start = this.frames[0]?.authority ?? this.previous;
    const end = this.frames.at(-1)?.authority ?? this.previous;
    return {
      id: this.id,
      label: this.label,
      category: this.category,
      metadata: this.metadata,
      assertions,
      start,
      end,
      summary: {
        b42CounterEdges: this.frames.reduce((sum, frame) => sum + frame.b42.counterDelta, 0),
        correctionRequests: this.corrections.length,
        nonzeroCorrections: applications.length,
        silentCorrections: applications.filter((event) => event.band === "silent").length,
        smoothCorrections: applications.filter((event) => event.band === "smooth").length,
        snapCorrections: applications.filter((event) => event.band === "snap").length,
        totalMagnitudePx,
        maxMagnitudePx: Math.max(0, ...applications.map((event) => event.magnitudePx)),
        meanMagnitudePx: applications.length > 0 ? totalMagnitudePx / applications.length : 0,
        correctionDebtDurationMs: this.correctionDebtDurationMs,
        serverMotionDurationMs: this.motionDurationMs,
        maxCorrectionWindowMs: Math.max(
          0,
          ...this.corrections.map((event) => event.remainingMsAfterApply),
        ),
        scenarioDurationMs: this.frames.length * TICK_MS,
        peakAuthorityStepPx: Math.max(0, ...this.frames.map((frame) => frame.delta.positionPx)),
        sourceCounts,
        causeCounts,
      },
      corrections: this.corrections,
      frames: this.frames,
    };
  }
}

function resetHeldInput(held: HeldInput): void {
  held.dx = 0;
  held.dy = 0;
  held.jump = false;
  held.crouchHeld = false;
  held.pound = false;
  held.slide = false;
  held.slideHeld = false;
  held.fireHeld = false;
  held.fireStartSeq = 0;
  held.aimX = 1;
  held.aimY = 0;
  held.targetX = 0;
  held.targetY = 0;
}

async function normalizeArena(
  instrumented: InstrumentedRoom,
  weaponId = "fists",
  position = { x: 2_200, y: 1_500 },
): Promise<void> {
  const { room, local } = instrumented;
  const player = local.state.players.get(room.sessionId);
  const combat = local.combat.get(room.sessionId);
  const input = local.inputs.get(room.sessionId);
  if (!player || !combat || !input) throw new Error("arena reset fixture unavailable");

  local.map.tiles.fill(TILE_GROUND);
  local.map.pois.length = 0;
  local.state.enemies.clear();
  local.state.projectiles.clear();
  local.state.beams.clear();
  local.state.zones.clear();
  local.state.pickups.clear();
  local.state.chests.clear();
  local.spawnAccum = -1_000_000;
  local.shifterCd = 1_000_000;
  local.serverMotionUntilTick.delete(player.id);
  local.serverMotionSourceByPlayer.delete(player.id);
  player.dualWield.serverMotionActive = false;
  player.x = position.x;
  player.y = position.y;
  player.mvx = 0;
  player.mvy = 0;
  player.vx = 0;
  player.vy = 0;
  player.momentumX = 0;
  player.momentumY = 0;
  player.height = 0;
  player.vh = 0;
  player.moveStance = STANCE_NONE;
  player.slidePhase = SLIDE_PHASE_OFF;
  player.slidePhaseTick = 0;
  player.alive = true;
  player.hp = player.maxHp;
  player.ultPhase = 0;

  combat.cd = 0;
  combat.reloadCd = 0;
  combat.attackBuffer = 0;
  combat.drawLock = 0;
  combat.lastGroundX = player.x;
  combat.lastGroundY = player.y;
  combat.aimX = 1;
  combat.aimY = 0;
  combat.targetX = player.x + 900;
  combat.targetY = player.y;
  combat.stance = STANCE_NONE;
  combat.slidePhase = SLIDE_PHASE_OFF;
  combat.slidePhaseTick = 0;
  combat.slideParryLockT = 0;
  combat.rollCd = 0;
  combat.recoveryT = 0;
  combat.pitGrace = 0;
  combat.invuln = 0;
  combat.parryCd = 0;
  combat.parryBuffer = 0;
  combat.parryOpenedTick = 0xffffffff;
  combat.jumpCd = 0;
  combat.jumpBuffer = 0;
  combat.distJumpCd = 0;
  combat.poundUsed = false;
  combat.poundGatherT = 0;
  combat.momentumX = 0;
  combat.momentumY = 0;
  combat.vh = 0;
  combat.gunBurstWeaponId = "";
  combat.gunBurstRemaining = 0;
  combat.gunBurstT = 0;
  combat.beamPhase = 0;
  combat.beamDescriptor = undefined;
  combat.beamPhaseT = 0;
  combat.beamChannelT = 0;
  combat.beamInputWasHeld = false;
  combat.beamPulseT = 0;
  combat.beamQuantumT = 0;
  combat.beamHitIds.clear();
  combat.beamPendingDamage.clear();
  combat.drive.valueF = 100;
  combat.drive.recoveryDebtF = 0;
  combat.drive.pressureUntilTick = 0;
  combat.drive.beamLockEndTick = 0;
  combat.drive.beamRecoveryEndTick = 0;
  combat.drive.beamRequireRelease = false;
  combat.drive.tickCreditF = 0;
  combat.drive.tickDebitF = 0;
  combat.drive.tickOpen = false;
  player.weaponResource.valueQ = 10_000;
  combat.ultBuffer = 0;
  combat.ult = undefined;

  input.queue.length = 0;
  input.mvx = 0;
  input.mvy = 0;
  input.freshMovement = undefined;
  resetHeldInput(input.held);
  local.broadcastPatch();
  await waitFor(
    `arena normalize ${weaponId}`,
    () =>
      Math.abs(requiredPlayer(room).x - position.x) < 0.01 &&
      Math.abs(requiredPlayer(room).y - position.y) < 0.01,
  );

  if (requiredPlayer(room).weapon !== weaponId) {
    room.send("devEquip", { weapon: weaponId });
    await waitFor(`${weaponId} equip`, () => requiredPlayer(room).weapon === weaponId);
  }
  const weapon = WEAPONS[weaponId];
  combat.lastWeapon = weaponId;
  combat.cd = 0;
  combat.reloadCd = 0;
  player.charges = weapon?.gun?.magazine ?? player.charges;
  local.broadcastPatch();
  await sleep(TICK_MS);
}

function createProbe(
  instrumented: InstrumentedRoom,
  id: string,
  label: string,
  category: string,
  metadata: Record<string, unknown> = {},
): ScenarioProbe {
  const predictor = new SelfPredictor(serverView(instrumented.room));
  predictor.setRelics(requiredPlayer(instrumented.room).dualWield.relics);
  if (instrumented.local.beltLevel) {
    predictor.setMap(undefined);
    predictor.setBeltLevel(instrumented.local.beltLevel);
  } else {
    predictor.setMap(instrumented.local.map);
  }
  return new ScenarioProbe(id, label, category, metadata, instrumented, predictor);
}

function sendAttack(room: LiveRoom, aimX = 1, aimY = 0): void {
  const player = requiredPlayer(room);
  room.send("attack", {
    aimX,
    aimY,
    tx: player.x + aimX * 900,
    ty: player.y + aimY * 900,
  });
}

async function settle(probe: ScenarioProbe, ticks = 16): Promise<void> {
  for (let step = 0; step < ticks; step++)
    await probe.tick({ action: step === 0 ? "settle" : "idle" });
}

function assertionsPass(assertions: Record<string, boolean>): boolean {
  return Object.values(assertions).every(Boolean);
}

async function runWalkStop(instrumented: InstrumentedRoom): Promise<ScenarioResult> {
  await normalizeArena(instrumented);
  const probe = createProbe(instrumented, "walk-stop", "Walk / stop", "baseline");
  for (let step = 0; step < 12; step++) await probe.tick({ dx: 1, action: "walk-right" });
  for (let step = 0; step < 10; step++) await probe.tick({ action: "stop" });
  const result = probe.finish({ completed: true });
  result.assertions.zeroCorrections = result.summary.nonzeroCorrections === 0;
  return result;
}

async function runMeleeAttackMoveStop(instrumented: InstrumentedRoom): Promise<ScenarioResult> {
  const weaponId = "x2-cinderbrand-cleaver";
  await normalizeArena(instrumented, weaponId);
  const before = requiredPlayer(instrumented.room).attackSeq;
  const probe = createProbe(
    instrumented,
    "melee-attack-move-stop",
    "Attack / move / stop — Cinderbrand Cleaver",
    "baseline",
    { weaponId, weaponName: WEAPONS[weaponId]?.name },
  );
  for (let step = 0; step < 28; step++) {
    const moving = step < 16;
    await probe.tick({
      dx: moving ? 1 : 0,
      fireHeld: moving,
      action: moving ? "attack-move" : "stop",
      beforeSend: step < 16 ? () => sendAttack(instrumented.room) : undefined,
    });
  }
  const accepted = (requiredPlayer(instrumented.room).attackSeq - before) >>> 0;
  const result = probe.finish({ acceptedAttack: accepted > 0 });
  result.metadata.acceptedAttacks = accepted;
  return result;
}

function gunFamilyRepresentatives(): Array<{
  family: string;
  weaponId: string;
  weaponName: string;
  recoil: number;
}> {
  const byFamily = new Map<string, (typeof WEAPONS)[string]>();
  for (const weapon of Object.values(WEAPONS)) {
    if (!weapon.gun || weapon.archived === true || !(weapon.recoil && weapon.recoil > 0)) continue;
    const family = weapon.tags.family;
    const previous = byFamily.get(family);
    if (
      !previous ||
      (weapon.recoil ?? 0) > (previous.recoil ?? 0) ||
      ((weapon.recoil ?? 0) === (previous.recoil ?? 0) && weapon.id < previous.id)
    )
      byFamily.set(family, weapon);
  }
  return [...byFamily.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([family, weapon]) => ({
      family,
      weaponId: weapon.id,
      weaponName: weapon.name,
      recoil: weapon.recoil ?? 0,
    }));
}

async function runGunClass(
  instrumented: InstrumentedRoom,
  representative: ReturnType<typeof gunFamilyRepresentatives>[number],
): Promise<ScenarioResult> {
  await normalizeArena(instrumented, representative.weaponId);
  const before = requiredPlayer(instrumented.room).attackSeq;
  const probe = createProbe(
    instrumented,
    `gun-${representative.family}`,
    `Gun class — ${representative.family}`,
    "gun-class",
    representative,
  );
  await probe.tick({
    fireHeld: true,
    action: "fire",
    beforeSend: () => sendAttack(instrumented.room),
  });
  await settle(probe, 18);
  const accepted = (requiredPlayer(instrumented.room).attackSeq - before) >>> 0;
  const result = probe.finish({
    acceptedShot: accepted > 0,
    classified:
      resultSourceSeen(probe, "weapon-fire-recoil") ||
      requiredPlayer(instrumented.room).dualWield.serverMotionEpoch >
        (probe.frames[0]?.authority.motionEpoch ?? Number.POSITIVE_INFINITY),
  });
  result.metadata.acceptedAttacks = accepted;
  return result;
}

function resultSourceSeen(probe: ScenarioProbe, source: string): boolean {
  return probe.frames.some((frame) => frame.authority.motionSource === source);
}

function rangedBeamWeapons(): Array<{
  weaponId: string;
  weaponName: string;
  family: string;
  recoilPerSecond: number;
}> {
  return Object.values(WEAPONS)
    .filter(
      (weapon) =>
        !!weapon.beam &&
        weapon.tags.classPool === "ranged" &&
        weapon.archived !== true &&
        (weapon.recoil ?? 0) > 0,
    )
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((weapon) => ({
      weaponId: weapon.id,
      weaponName: weapon.name,
      family: weapon.tags.family,
      recoilPerSecond: weapon.recoil ?? 0,
    }));
}

async function runBeam(
  instrumented: InstrumentedRoom,
  beam: ReturnType<typeof rangedBeamWeapons>[number],
): Promise<ScenarioResult> {
  await normalizeArena(instrumented, beam.weaponId);
  const probe = createProbe(
    instrumented,
    `beam-${beam.weaponId}`,
    `Ranged beam recoil — ${beam.weaponName}`,
    "gun-beam",
    beam,
  );
  for (let step = 0; step < 26; step++)
    await probe.tick({ fireHeld: true, action: step < 13 ? "beam-charge" : "beam-channel" });
  for (let step = 0; step < 18; step++)
    await probe.tick({ fireHeld: false, action: step === 0 ? "beam-release" : "settle" });
  return probe.finish({
    activeBeamObserved: probe.frames.some((frame) => frame.action === "beam-channel"),
    classified: resultSourceSeen(probe, "weapon-fire-recoil"),
  });
}

async function runSustainedGatling(instrumented: InstrumentedRoom): Promise<ScenarioResult> {
  const weaponId = "x-gun-gatling";
  await normalizeArena(instrumented, weaponId);
  const before = requiredPlayer(instrumented.room).attackSeq;
  const probe = createProbe(
    instrumented,
    "sustained-gatling",
    "Sustained Gatling",
    "gun-sustained",
    {
      weaponId,
      weaponName: WEAPONS[weaponId]?.name,
      recoil: WEAPONS[weaponId]?.recoil,
      fireRate: WEAPONS[weaponId]?.gun?.fireRate,
    },
  );
  for (let step = 0; step < 34; step++)
    await probe.tick({
      fireHeld: true,
      action: "sustained-fire",
      beforeSend: () => sendAttack(instrumented.room),
    });
  await settle(probe, 20);
  const accepted = (requiredPlayer(instrumented.room).attackSeq - before) >>> 0;
  const result = probe.finish({
    acceptedBurst: accepted >= 8,
    classified: resultSourceSeen(probe, "weapon-fire-recoil"),
  });
  result.metadata.acceptedAttacks = accepted;
  return result;
}

async function runDodgeRoll(instrumented: InstrumentedRoom): Promise<ScenarioResult> {
  await normalizeArena(instrumented);
  const probe = createProbe(instrumented, "dodge-roll", "Dodge roll", "traversal");
  await probe.tick({ dx: 1, slide: true, slideHeld: true, action: "roll-edge" });
  for (let step = 0; step < 16; step++) await probe.tick({ dx: 1, action: "roll-tail" });
  return probe.finish({
    enteredRoll: probe.frames.some((frame) => frame.authority.stance !== STANCE_NONE),
    classified: resultSourceSeen(probe, "dodge-roll"),
  });
}

const parryDirections = [
  { id: "right", angle: 0, expectedSource: "parry-slide" },
  { id: "left", angle: Math.PI, expectedSource: "parry-slide" },
  { id: "above", angle: -Math.PI / 2, expectedSource: "" },
  { id: "below", angle: Math.PI / 2, expectedSource: "parry-launch" },
] as const;

async function runParryDirection(
  instrumented: InstrumentedRoom,
  direction: (typeof parryDirections)[number],
): Promise<ScenarioResult> {
  await normalizeArena(instrumented);
  const before = requiredPlayer(instrumented.room).parriedSeq;
  const probe = createProbe(
    instrumented,
    `parry-${direction.id}`,
    `Parry — incoming from ${direction.id}`,
    "parry",
    direction,
  );
  for (let step = 0; step < 50; step++) {
    await probe.tick({
      action: step === 0 ? "arm-and-spawn" : "await-parry",
      beforeSend:
        step === 0
          ? () => {
              instrumented.room.send("debugArmCommitDefense", { kind: "parry" });
              instrumented.room.send("debugSpawn", {
                kind: "critter",
                count: 1,
                angle: direction.angle,
                distance: 160,
                attackReady: true,
              });
            }
          : undefined,
    });
    if (probe.frames.some((frame) => frame.authority.parriedSeq > before)) break;
  }
  const parried = probe.frames.some((frame) => frame.authority.parriedSeq > before);
  await settle(probe, 18);
  return probe.finish({
    successfulParry: parried,
    expectedMotionSource:
      direction.expectedSource === "" || resultSourceSeen(probe, direction.expectedSource),
  });
}

async function runJumpPound(instrumented: InstrumentedRoom): Promise<ScenarioResult> {
  await normalizeArena(instrumented);
  const beforePound = requiredPlayer(instrumented.room).poundSeq;
  const probe = createProbe(instrumented, "jump-pound", "Distance jump / pound", "traversal");
  await probe.tick({ dx: 1, jump: true, action: "distance-jump-edge" });
  for (let step = 0; step < 4; step++) await probe.tick({ dx: 1, action: "jump-flight" });
  await probe.tick({ dx: 1, pound: true, action: "pound-edge" });
  for (let step = 0; step < 22; step++) await probe.tick({ action: "pound-tail" });
  return probe.finish({
    distanceJumpClassified: resultSourceSeen(probe, "distance-jump"),
    poundLanded: requiredPlayer(instrumented.room).poundSeq > beforePound,
  });
}

async function runSlideHop(instrumented: InstrumentedRoom): Promise<ScenarioResult> {
  await normalizeArena(instrumented);
  const probe = createProbe(instrumented, "slide-hop", "Slide-hop input chain", "traversal");
  await probe.tick({ dx: 1, slide: true, slideHeld: true, action: "roll-edge" });
  await probe.tick({ dx: 1, action: "roll-tail" });
  await probe.tick({ dx: 1, jump: true, action: "buffer-hop" });
  for (let step = 0; step < 30; step++) await probe.tick({ dx: 1, action: "slide-hop-tail" });
  return probe.finish({
    rollClassified: resultSourceSeen(probe, "dodge-roll"),
    jumpClassified: resultSourceSeen(probe, "distance-jump"),
    dormantSlideHopSource: !resultSourceSeen(probe, "slide-hop"),
  });
}

async function runChestOpen(instrumented: InstrumentedRoom): Promise<ScenarioResult> {
  await normalizeArena(instrumented);
  const player = instrumented.local.state.players.get(instrumented.room.sessionId);
  if (!player) throw new Error("chest player unavailable");
  const chest = new ChestState();
  chest.id = "chest:4242:0";
  chest.x = player.x;
  chest.y = player.y;
  chest.spawnTick = instrumented.local.state.tick;
  instrumented.local.state.chests.set(chest.id, chest);
  instrumented.local.broadcastPatch();
  await waitFor("diagnostic chest patch", () => instrumented.room.state.chests?.has(chest.id));
  const probe = createProbe(instrumented, "chest-open", "Chest open", "interaction");
  await probe.tick({
    action: "open-chest",
    beforeSend: () => instrumented.room.send("openChest", { chestId: chest.id }),
  });
  await settle(probe, 6);
  return probe.finish({
    opened: chest.openedBy.get(player.id) === true,
  });
}

async function runPitFall(instrumented: InstrumentedRoom): Promise<ScenarioResult> {
  await normalizeArena(instrumented);
  const player = instrumented.local.state.players.get(instrumented.room.sessionId);
  const combat = instrumented.local.combat.get(instrumented.room.sessionId);
  if (!player || !combat) throw new Error("pit fixture unavailable");
  const safe = { x: player.x - 320, y: player.y };
  combat.lastGroundX = safe.x;
  combat.lastGroundY = safe.y;
  const col = Math.floor(player.x / instrumented.local.map.tileSize);
  const row = Math.floor(player.y / instrumented.local.map.tileSize);
  const fellBefore = player.fellSeq;
  const probe = createProbe(instrumented, "pit-fall", "Pit fall / snap-back", "placement", {
    safePoint: safe,
    pitTile: { col, row },
  });
  await probe.tick({
    action: "grounded-over-pit",
    beforeSend: () => {
      instrumented.local.map.tiles[row * instrumented.local.map.cols + col] = TILE_PIT;
    },
  });
  await settle(probe, 18);
  return probe.finish({
    fell: player.fellSeq > fellBefore,
    classified: resultSourceSeen(probe, "pit-snapback"),
  });
}

const wrapIds = [
  "x2-muay-thai-wraps",
  "x2-wing-chun-wraps",
  "x2-drunken-fist-wraps",
  "x2-iron-palm-wraps",
] as const;

async function runFullCombo(
  instrumented: InstrumentedRoom,
  weaponId: string,
  category: string,
  expectedBeats?: number,
): Promise<ScenarioResult> {
  await normalizeArena(instrumented, weaponId);
  const weapon = WEAPONS[weaponId];
  if (!weapon) throw new Error(`missing combo weapon ${weaponId}`);
  const comboLength =
    expectedBeats ?? Math.max(1, meleeComboSelectionFor(weapon)?.sequence.length ?? 1);
  const before = requiredPlayer(instrumented.room).attackSeq;
  const probe = createProbe(
    instrumented,
    `${category}-${weaponId}`,
    `${category === "kung-fu-wrap" ? "Kung-fu wrap" : "Combo"} — ${weapon.name}`,
    category,
    { weaponId, weaponName: weapon.name, comboLength },
  );
  for (let step = 0; step < 100; step++) {
    await probe.tick({
      action: "combo-input",
      beforeSend: () => sendAttack(instrumented.room),
    });
    const accepted = (requiredPlayer(instrumented.room).attackSeq - before) >>> 0;
    if (accepted >= comboLength) break;
  }
  await settle(probe, 14);
  const accepted = (requiredPlayer(instrumented.room).attackSeq - before) >>> 0;
  const result = probe.finish({ fullComboAccepted: accepted >= comboLength });
  result.metadata.acceptedAttacks = accepted;
  return result;
}

async function runSpadeSpin(instrumented: InstrumentedRoom): Promise<ScenarioResult> {
  const weaponId = "gravediggers-spade";
  await normalizeArena(instrumented, weaponId);
  const before = requiredPlayer(instrumented.room).attackSeq;
  const probe = createProbe(
    instrumented,
    "spade-spin",
    "Gravedigger's Spade spin",
    "special-weapon",
    { weaponId, weaponName: WEAPONS[weaponId]?.name },
  );
  await probe.tick({
    fireHeld: true,
    action: "spin-attack",
    beforeSend: () => sendAttack(instrumented.room),
  });
  await settle(probe, 18);
  return probe.finish({
    accepted: requiredPlayer(instrumented.room).attackSeq > before,
  });
}

async function runUltimate(instrumented: InstrumentedRoom): Promise<ScenarioResult> {
  await normalizeArena(instrumented);
  const player = instrumented.local.state.players.get(instrumented.room.sessionId);
  const combat = instrumented.local.combat.get(instrumented.room.sessionId);
  if (!player || !combat) throw new Error("ultimate fixture unavailable");
  player.ultArchetype = ultimateCodeFor(UltimateFamily.AlphaStrike, "str");
  player.ultVariant = "str";
  combat.ultChargeF = 1;
  player.ultCharge = 100;
  for (let index = 0; index < 4; index++) {
    const angle = (index / 4) * Math.PI * 2;
    const enemy = new EnemyState();
    enemy.id = `diag-alpha-${index}`;
    enemy.kind = "dummy";
    enemy.x = player.x + Math.cos(angle) * (180 + index * 70);
    enemy.y = player.y + Math.sin(angle) * (180 + index * 70);
    enemy.hp = 100_000;
    instrumented.local.state.enemies.set(enemy.id, enemy);
  }
  instrumented.local.broadcastPatch();
  await sleep(TICK_MS);
  const before = player.ultSeq;
  const probe = createProbe(
    instrumented,
    "ultimate-alpha-strike",
    "Ultimate — Alpha Strike (4 targets)",
    "ultimate",
    { family: "AlphaStrike", variant: "str", targets: 4 },
  );
  await probe.tick({
    action: "ultimate-input",
    beforeSend: () =>
      instrumented.room.send("ultimate", {
        aimX: 1,
        aimY: 0,
        tx: player.x + 700,
        ty: player.y,
      }),
  });
  for (let step = 0; step < 34; step++) await probe.tick({ action: "ultimate-tail" });
  return probe.finish({
    accepted: player.ultSeq > before,
    classified: resultSourceSeen(probe, "ultimate"),
  });
}

async function joinRoom(
  endpoint: string,
  options: Record<string, unknown>,
  training: boolean,
): Promise<InstrumentedRoom> {
  const client = new Client(endpoint);
  const room = await client.joinOrCreate(ROOM_NAME, options);
  await waitFor("solo player row", () => !!playerRow(room));
  const local = matchMaker.getLocalRoomById(room.roomId) as unknown as LocalRoom | undefined;
  if (!local) throw new Error("local diagnostic room unavailable");
  const serverTicks = installServerTickRecorder(room, local);
  if (training) {
    room.send("toggleTraining");
    await waitFor("training mode", () => room.state.mode === "training");
  }
  return { room, local, serverTicks };
}

async function runElevator(endpoint: string): Promise<ScenarioResult> {
  const instrumented = await joinRoom(
    endpoint,
    { belt: true, beltLevel: "corporate-grid", dimensionId: "wild-west", bossRush: false },
    false,
  );
  try {
    const { room, local } = instrumented;
    const player = local.state.players.get(room.sessionId);
    const combat = local.combat.get(room.sessionId);
    const input = local.inputs.get(room.sessionId);
    const floor = local.beltLevel ? corporateGridFloorForBelt(local.beltLevel) : undefined;
    const exit = floor?.elevatorMarkers[2];
    if (!player || !combat || !input || !exit)
      throw new Error("corporate elevator fixture unavailable");
    local.state.enemies.clear();
    local.spawnBeltWave = (): void => {};
    local.spawnAccum = -1_000_000;
    local.shifterCd = 1_000_000;
    local.state.elevatorPhase = CORPORATE_ELEVATOR_PHASE.ready;
    local.state.beltLockX = 0;
    player.x = exit.x;
    player.y = BELT_Y0 + exit.y;
    player.mvx = 0;
    player.mvy = 0;
    player.vx = 0;
    player.vy = 0;
    combat.lastGroundX = player.x;
    combat.lastGroundY = player.y;
    input.queue.length = 0;
    input.mvx = 0;
    input.mvy = 0;
    resetHeldInput(input.held);
    local.broadcastPatch();
    await waitFor(
      "elevator start placement",
      () => Math.abs(requiredPlayer(room).x - exit.x) < 0.01,
    );
    const startDepth = local.state.corporateFloorDepth;
    const probe = createProbe(
      instrumented,
      "elevator-board",
      "Corporate elevator board / depart / arrive",
      "placement",
      { beltLevel: "corporate-grid", startDepth },
    );
    await probe.tick({
      action: "use-elevator",
      beforeSend: () => room.send("useElevator"),
    });
    for (let step = 0; step < 220; step++) {
      await probe.tick({ action: "elevator-cycle" });
      const advanced = local.state.corporateFloorDepth > startDepth;
      if (advanced && !requiredPlayer(room).dualWield.serverMotionActive && step > 170) break;
    }
    const result = probe.finish({
      advancedFloor: local.state.corporateFloorDepth > startDepth,
      classified: resultSourceSeen(probe, "elevator-boarding"),
    });
    result.metadata.endDepth = local.state.corporateFloorDepth;
    return result;
  } finally {
    await instrumented.room.leave();
  }
}

function compactScenario(result: ScenarioResult): Record<string, unknown> {
  return {
    rank: 0,
    id: result.id,
    label: result.label,
    category: result.category,
    metadata: result.metadata,
    assertions: result.assertions,
    ...result.summary,
  };
}

function traceForScenario(result: ScenarioResult): TickFrame[] {
  const indexes = new Set<number>();
  for (const frame of result.frames) {
    if (frame.correction.nonzeroRequests === 0 && frame.b42.counterDelta === 0) continue;
    for (const index of [frame.index - 1, frame.index, frame.index + 1]) {
      if (index >= 0 && index < result.frames.length) indexes.add(index);
    }
  }
  return [...indexes]
    .sort((left, right) => left - right)
    .map((index) => result.frames[index] as TickFrame);
}

function roundNumbers(value: unknown): unknown {
  if (typeof value === "number") return Number.isInteger(value) ? value : Number(value.toFixed(6));
  if (Array.isArray(value)) return value.map(roundNumbers);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
        key,
        roundNumbers(nested),
      ]),
    );
  }
  return value;
}

async function raiseSchemaEncoderBuffer(): Promise<void> {
  const serverRoot = path.resolve(import.meta.dirname, "../packages/server");
  const requireFromServer = createRequire(pathToFileURL(path.join(serverRoot, "package.json")));
  const colyseusEntry = requireFromServer.resolve("colyseus");
  const requireFromColyseus = createRequire(pathToFileURL(colyseusEntry));
  const schemaCjsEntry = requireFromColyseus.resolve("@colyseus/schema");
  const { Encoder } = requireFromColyseus("@colyseus/schema") as {
    Encoder: { BUFFER_SIZE: number };
  };
  Encoder.BUFFER_SIZE = Math.max(Encoder.BUFFER_SIZE, 64 * 1_024);
  const schemaEsmEntry = path.resolve(path.dirname(schemaCjsEntry), "../esm/index.mjs");
  const { Encoder: EsmEncoder } = (await import(pathToFileURL(schemaEsmEntry).href)) as {
    Encoder: { BUFFER_SIZE: number };
  };
  EsmEncoder.BUFFER_SIZE = Math.max(EsmEncoder.BUFFER_SIZE, 64 * 1_024);
}

const priorDevTools = process.env.DD_DEV_TOOLS;
process.env.DD_DEV_TOOLS = "1";
await raiseSchemaEncoderBuffer();
const server = await createGameServer(0);
const address = server.transport.server?.address();
if (!address || typeof address === "string") throw new Error("ephemeral game port unavailable");
const port = address.port;
if (protectedPorts.has(port)) throw new Error(`ephemeral harness selected protected port ${port}`);
const endpoint = `ws://127.0.0.1:${port}`;
const rooms: LiveRoom[] = [];
const results: ScenarioResult[] = [];
const logLines: string[] = [];

try {
  const topdown = await joinRoom(
    endpoint,
    { belt: false, beltLevel: "", dimensionId: "wild-west", bossRush: false },
    true,
  );
  rooms.push(topdown.room);

  const run = async (factory: () => Promise<ScenarioResult>): Promise<void> => {
    const result = await factory();
    if (!assertionsPass(result.assertions))
      throw new Error(`${result.id} assertion failure: ${JSON.stringify(result.assertions)}`);
    results.push(result);
    const line = [
      result.id,
      `applications=${result.summary.nonzeroCorrections}`,
      `b42=${result.summary.b42CounterEdges}`,
      `requests=${result.summary.correctionRequests}`,
      `sumPx=${result.summary.totalMagnitudePx.toFixed(3)}`,
      `maxPx=${result.summary.maxMagnitudePx.toFixed(3)}`,
      `motionMs=${result.summary.serverMotionDurationMs}`,
    ].join(" ");
    logLines.push(line);
    console.log(`[diag-rb] ${line}`);
  };

  await run(() => runWalkStop(topdown));
  await run(() => runMeleeAttackMoveStop(topdown));

  const gunRepresentatives = gunFamilyRepresentatives();
  for (const representative of gunRepresentatives)
    await run(() => runGunClass(topdown, representative));

  const beams = rangedBeamWeapons();
  for (const beam of beams) await run(() => runBeam(topdown, beam));

  await run(() => runSustainedGatling(topdown));
  await run(() => runDodgeRoll(topdown));
  for (const direction of parryDirections) await run(() => runParryDirection(topdown, direction));
  await run(() => runJumpPound(topdown));
  await run(() => runSlideHop(topdown));
  await run(() => runChestOpen(topdown));
  await run(() => runPitFall(topdown));
  for (const weaponId of wrapIds) await run(() => runFullCombo(topdown, weaponId, "kung-fu-wrap"));
  await run(() => runFullCombo(topdown, "x2-coyote-trickster-s-sparkmitt", "sparkmitt", 8));
  await run(() => runSpadeSpin(topdown));
  await run(() => runUltimate(topdown));
  await topdown.room.leave();
  rooms.splice(rooms.indexOf(topdown.room), 1);

  const elevator = await runElevator(endpoint);
  if (!assertionsPass(elevator.assertions))
    throw new Error(`elevator assertion failure: ${JSON.stringify(elevator.assertions)}`);
  results.push(elevator);
  logLines.push(
    [
      elevator.id,
      `applications=${elevator.summary.nonzeroCorrections}`,
      `b42=${elevator.summary.b42CounterEdges}`,
      `requests=${elevator.summary.correctionRequests}`,
      `sumPx=${elevator.summary.totalMagnitudePx.toFixed(3)}`,
      `maxPx=${elevator.summary.maxMagnitudePx.toFixed(3)}`,
      `motionMs=${elevator.summary.serverMotionDurationMs}`,
    ].join(" "),
  );

  const ranked = [...results].sort(
    (left, right) =>
      right.summary.totalMagnitudePx - left.summary.totalMagnitudePx ||
      right.summary.nonzeroCorrections - left.summary.nonzeroCorrections ||
      right.summary.serverMotionDurationMs - left.summary.serverMotionDurationMs ||
      left.id.localeCompare(right.id),
  );
  const compact = ranked.map((result, index) => ({
    ...compactScenario(result),
    rank: index + 1,
  }));
  const topThree = ranked.slice(0, 3);
  const capturedAt = new Date().toISOString();
  const summary = {
    capturedAt,
    transport: {
      endpoint,
      osAssignedEphemeralPort: port,
      protectedPortsUntouched: !protectedPorts.has(port),
      liveColyseusStack: true,
      simultaneousClients: 1,
      solo: true,
    },
    method: {
      client: "colyseus.js node client",
      prediction: "production SelfPredictor",
      correctionInstrumentation:
        "per-instance applyMovementCorrection wrapper; no runtime source edits",
      rankLaw:
        "descending cumulative non-zero requested correction magnitude, then count, then server-motion duration",
      correctionEpsilonPx,
      tickMs: TICK_MS,
    },
    coverage: {
      scenarios: results.length,
      gunTagFamilies: gunRepresentatives.length,
      rangedBeams: beams.length,
      kungFuWraps: wrapIds.length,
      parryDirections: parryDirections.length,
    },
    totals: {
      b42CounterEdges: results.reduce((sum, result) => sum + result.summary.b42CounterEdges, 0),
      correctionRequests: results.reduce(
        (sum, result) => sum + result.summary.correctionRequests,
        0,
      ),
      nonzeroCorrections: results.reduce(
        (sum, result) => sum + result.summary.nonzeroCorrections,
        0,
      ),
      totalMagnitudePx: results.reduce((sum, result) => sum + result.summary.totalMagnitudePx, 0),
    },
    topThree: topThree.map((result) => ({
      id: result.id,
      label: result.label,
      corrections: result.summary.nonzeroCorrections,
      b42CounterEdges: result.summary.b42CounterEdges,
      totalMagnitudePx: result.summary.totalMagnitudePx,
      maxMagnitudePx: result.summary.maxMagnitudePx,
      serverMotionDurationMs: result.summary.serverMotionDurationMs,
    })),
    scenarios: compact,
  };
  const topTraces = Object.fromEntries(
    topThree.map((result) => [
      result.id,
      {
        label: result.label,
        summary: result.summary,
        corrections: result.corrections,
        frames: traceForScenario(result),
      },
    ]),
  );

  await mkdir(evidenceDir, { recursive: true });
  await writeFile(
    path.join(evidenceDir, "run-summary.json"),
    `${JSON.stringify(roundNumbers(summary), null, 2)}\n`,
  );
  await writeFile(
    path.join(evidenceDir, "run-telemetry.json"),
    `${JSON.stringify(roundNumbers({ capturedAt, results }), null, 2)}\n`,
  );
  await writeFile(
    path.join(evidenceDir, "top-offender-traces.json"),
    `${JSON.stringify(roundNumbers(topTraces), null, 2)}\n`,
  );
  await writeFile(
    path.join(evidenceDir, "run.log"),
    `${[
      `capturedAt=${capturedAt}`,
      `endpoint=${endpoint}`,
      `solo=true`,
      ...logLines,
      `verdict=${results.length} scenarios; top3=${topThree
        .map((result) => `${result.id}:${result.summary.nonzeroCorrections}`)
        .join(",")}`,
    ].join("\n")}\n`,
  );
  await writeFile(
    path.join(evidenceDir, "README.md"),
    [
      "# Solo rubberband telemetry evidence",
      "",
      `Captured ${capturedAt} through one real Colyseus client on OS-assigned loopback port ${port}.`,
      "Ports 5180 and 2567 were not used.",
      "",
      "- `run-summary.json` is the ranked scenario table and aggregate count.",
      "- `run-telemetry.json` contains every fixed-tick authority row and every correction request.",
      "- `top-offender-traces.json` retains correction ticks plus adjacent context for the top three.",
      "- `run.log` is the compact scenario-by-scenario console ledger.",
      "- The corporate elevator fixture suppresses belt combat waves to isolate placement motion.",
      "",
      "Reproduce from the repository root:",
      "",
      "```powershell",
      "pnpm --filter @dd/shared build",
      "pnpm --filter @dd/server exec tsx ../../tools/diag-rb-telemetry.mts",
      "```",
      "",
    ].join("\n"),
  );
  console.log(JSON.stringify(roundNumbers(summary), null, 2));
} finally {
  await Promise.allSettled(rooms.map((room) => room.leave()));
  try {
    await server.gracefullyShutdown(false);
  } finally {
    if (server.transport.server?.listening) server.transport.shutdown();
    if (priorDevTools === undefined) delete process.env.DD_DEV_TOOLS;
    else process.env.DD_DEV_TOOLS = priorDevTools;
  }
}
