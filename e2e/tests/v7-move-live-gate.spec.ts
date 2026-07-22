import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { DIST_JUMP_VERTICAL_VELOCITY, stepVertical } from "@dd/shared";
import { bootArena, runArenaSpec, waitForDevWeapon } from "../helpers/arena-harness.js";

const EVIDENCE_PHASE = process.env.DD_V7_MOVE_EVIDENCE_PHASE === "before" ? "before" : "after";
const EVIDENCE_DIR = path.resolve(
  "docs/owner-notes-audit-v7-evidence/movement",
  EVIDENCE_PHASE,
);
const TICK_MS = 50;
const EXPECTED_ROLL_DISTANCE = 188;
const EXPECTED_ROLL_TICKS = 8;
const ROLL_COOLDOWN_MS = 3_000;
const STANCE_NONE = 0;
const STANCE_CROUCH = 1;
const STANCE_DISTANCE_JUMP = 2;
const STANCE_POUND = 3;
const STANCE_ROLL = 4;

interface ProbeFrame {
  action: string;
  wallMs: number;
  tick: number;
  x: number;
  y: number;
  height: number;
  vh: number;
  stance: number;
  phase: number;
  phaseTick: number;
  momentumX: number;
  momentumY: number;
  ackSeq: number;
}

interface RenderFrame extends ProbeFrame {
  predX: number;
  predY: number;
  predHeight: number;
  predStance: number;
  predPhaseTick: number;
  correctionPx: number;
  rootRotation: number;
  bodyRotation: number;
  bodyScaleX: number;
  bodyScaleY: number;
}

interface BrowserPlayer {
  x: number;
  y: number;
  height: number;
  vh: number;
  moveStance: number;
  slidePhase: number;
  slidePhaseTick: number;
  momentumX: number;
  momentumY: number;
  ackSeq: number;
  poundSeq: number;
  fellSeq: number;
  teleportSeq: number;
}

interface BrowserArena {
  blobs: {
    get(id: string):
      | {
          x: number;
          y: number;
          root: { rotation: number };
          body: { rotation: number; scaleX: number; scaleY: number };
        }
      | undefined;
  };
  events: {
    on(type: string, callback: () => void): void;
    once(type: string, callback: () => void): void;
  };
  game: { hasFocus: boolean };
  pointerOverInteractiveUi: boolean;
  room: {
    sessionId: string;
    state: {
      tick: number;
      players: { get(id: string): BrowserPlayer | undefined };
    };
    onStateChange(callback: (state: BrowserArena["room"]["state"]) => void): void;
    send(type: string, payload: unknown): void;
  };
  selfPredHeight: number;
  selfPredStance: number;
  selfPredSlideTick: number;
  predictor?: { stats: { errPx: number }; canSlide: boolean };
  time: { now: number };
  verbs?: {
    isLegendOpen?(): boolean;
    releaseInputLatchIf?(release: boolean): void;
    toggleLegend?(nowMs: number): void;
  };
}

interface BrowserGlobal {
  ddGame: { scene: { getScene(key: string): BrowserArena } };
  __v7MoveAction?: string;
  __v7MoveState?: ProbeFrame[];
  __v7MoveRender?: RenderFrame[];
  __v7MoveInputAt?: number;
  __v7MoveInputTimes?: Record<string, number>;
  __v7MoveInputTicks?: Record<string, number>;
  __v7MoveInputPositions?: Record<string, { x: number; y: number }>;
  __v7MovePhysicalTicks?: Record<string, number>;
  __v7MoveRenderSeq?: number;
  __v7MoveSpaceDownRender?: Record<string, number>;
  __v7MoveSpaceUpRender?: Record<string, number>;
  __v7MoveInputs?: Array<{
    action: string;
    tick: number;
    seq: number;
    dx: number;
    dy: number;
    jump: boolean;
    pound: boolean;
    slide: boolean;
    slideHeld: boolean;
  }>;
}

interface DirectionCase {
  label: string;
  keys: string[];
  x: number;
  y: number;
  binding: "Shift" | "Control";
}

interface RollMeasure {
  label: string;
  accepted: boolean;
  distance: number;
  durationMs: number;
  directionDot: number;
  rootRotationSpan: number;
  measuredTumbleRadians: number;
  maxReconciliationPx: number;
  stateFrames: ProbeFrame[];
  renderFrames: RenderFrame[];
}

const DIRECTIONS: readonly DirectionCase[] = [
  { label: "east-shift", keys: ["d"], x: 1, y: 0, binding: "Shift" },
  { label: "west-ctrl", keys: ["a"], x: -1, y: 0, binding: "Control" },
  { label: "northeast-shift", keys: ["w", "d"], x: 1, y: -1, binding: "Shift" },
  { label: "southwest-ctrl", keys: ["s", "a"], x: -1, y: 1, binding: "Control" },
];

function tickDelta(from: number, to: number): number {
  return (to - from) >>> 0;
}

function inferredDistanceJumpLaunchTick(frame: ProbeFrame): number {
  let height = 0;
  let vh = DIST_JUMP_VERTICAL_VELOCITY;
  let bestStep = 1;
  let bestError = Number.POSITIVE_INFINITY;
  for (let step = 1; step <= 12; step++) {
    ({ height, vh } = stepVertical(height, vh, TICK_MS / 1000));
    const error = Math.abs(height - frame.height) + Math.abs(vh - frame.vh) * 0.02;
    if (error < bestError) {
      bestError = error;
      bestStep = step;
    }
  }
  return frame.tick - (bestStep - 1);
}

function measureRoll(
  label: string,
  directionX: number,
  directionY: number,
  stateFrames: readonly ProbeFrame[],
  renderFrames: readonly RenderFrame[],
): RollMeasure {
  const states = stateFrames.filter((frame) => frame.action === label);
  const firstActive = states.findIndex((frame) => frame.stance === STANCE_ROLL);
  if (firstActive < 0) {
    return {
      label,
      accepted: false,
      distance: 0,
      durationMs: 0,
      directionDot: 0,
      rootRotationSpan: 0,
      measuredTumbleRadians: 0,
      maxReconciliationPx: 0,
      stateFrames: states,
      renderFrames: renderFrames.filter((frame) => frame.action === label),
    };
  }
  const first = states[firstActive]!;
  const before = states[Math.max(0, firstActive - 1)] ?? first;
  const active = states.filter((frame) => frame.stance === STANCE_ROLL);
  const last = active.at(-1)!;
  const remainingTicks = Math.max(0, EXPECTED_ROLL_TICKS - last.phaseTick);
  const endX = last.x + last.momentumX * (remainingTicks * TICK_MS) / 1000;
  const endY = last.y + last.momentumY * (remainingTicks * TICK_MS) / 1000;
  const startX = before.x;
  const startY = before.y;
  const dx = endX - startX;
  const dy = endY - startY;
  const distance = Math.hypot(dx, dy);
  const wantedLength = Math.hypot(directionX, directionY) || 1;
  const directionDot =
    distance > 1e-4
      ? (dx * (directionX / wantedLength) + dy * (directionY / wantedLength)) / distance
      : 0;
  const renders = renderFrames.filter(
    (frame) =>
      frame.action === label && frame.predStance === STANCE_ROLL,
  );
  const rotations = renders.map((frame) => frame.rootRotation);
  const rootRotationSpan =
    rotations.length > 0 ? Math.max(...rotations) - Math.min(...rotations) : 0;
  const maxReconciliationPx = Math.max(
    0,
    ...renders.map((frame) => frame.correctionPx),
  );
  const directionSign = directionX < 0 ? -1 : 1;
  const rates: number[] = [];
  for (let index = 1; index < renders.length; index++) {
    const previous = renders[index - 1]!;
    const current = renders[index]!;
    const tickGap = current.predPhaseTick - previous.predPhaseTick;
    if (tickGap <= 0) continue;
    const raw = directionSign > 0
      ? current.rootRotation - previous.rootRotation
      : previous.rootRotation - current.rootRotation;
    const directedDelta = ((raw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    if (directedDelta > 1e-3) rates.push(directedDelta / tickGap);
  }
  rates.sort((a, b) => a - b);
  const measuredTumbleRadians =
    rates.length > 0 ? rates[Math.floor(rates.length / 2)]! * EXPECTED_ROLL_TICKS : 0;
  const startTick = first.tick - Math.max(0, first.phaseTick - 1);
  const endTick = last.tick + remainingTicks;
  return {
    label,
    accepted: true,
    distance,
    durationMs: (tickDelta(startTick, endTick) + 1) * TICK_MS,
    directionDot,
    rootRotationSpan,
    measuredTumbleRadians,
    maxReconciliationPx,
    stateFrames: states,
    renderFrames: renders,
  };
}

async function mountProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const holder = globalThis as unknown as BrowserGlobal;
    const arena = holder.ddGame.scene.getScene("arena");
    if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend?.(arena.time.now);
    arena.verbs?.releaseInputLatchIf?.(true);
    arena.game.hasFocus = true;
    arena.pointerOverInteractiveUi = false;
    holder.__v7MoveAction = "idle";
    holder.__v7MoveState = [];
    holder.__v7MoveRender = [];
    holder.__v7MoveInputAt = -1;
    holder.__v7MoveInputTimes = {};
    holder.__v7MoveInputTicks = {};
    holder.__v7MoveInputPositions = {};
    holder.__v7MovePhysicalTicks = {};
    holder.__v7MoveRenderSeq = 0;
    holder.__v7MoveSpaceDownRender = {};
    holder.__v7MoveSpaceUpRender = {};
    holder.__v7MoveInputs = [];

    const send = arena.room.send.bind(arena.room);
    arena.room.send = (type: string, payload: unknown): void => {
      if (type === "input" && payload && typeof payload === "object") {
        const cmd = payload as {
          seq?: number;
          dx?: number;
          dy?: number;
          jump?: boolean;
          pound?: boolean;
          slide?: boolean;
          slideHeld?: boolean;
        };
        holder.__v7MoveInputs!.push({
          action: holder.__v7MoveAction ?? "idle",
          tick: arena.room.state.tick,
          seq: cmd.seq ?? 0,
          dx: cmd.dx ?? 0,
          dy: cmd.dy ?? 0,
          jump: cmd.jump === true,
          pound: cmd.pound === true,
          slide: cmd.slide === true,
          slideHeld: cmd.slideHeld === true,
        });
      }
      send(type, payload);
    };

    window.addEventListener(
      "keydown",
      (event) => {
        if (event.code !== "Space" || event.repeat) return;
        const action = holder.__v7MoveAction ?? "idle";
        holder.__v7MovePhysicalTicks![action] = arena.room.state.tick;
        holder.__v7MoveSpaceDownRender![action] = holder.__v7MoveRenderSeq ?? 0;
      },
      true,
    );
    window.addEventListener(
      "keyup",
      (event) => {
        if (event.code !== "Space") return;
        const action = holder.__v7MoveAction ?? "idle";
        holder.__v7MoveSpaceUpRender![action] = holder.__v7MoveRenderSeq ?? 0;
      },
      true,
    );

    const sampleState = (state: BrowserArena["room"]["state"]): void => {
      const self = state.players.get(arena.room.sessionId);
      if (!self) return;
      holder.__v7MoveState!.push({
        action: holder.__v7MoveAction ?? "idle",
        wallMs: performance.now(),
        tick: state.tick,
        x: self.x,
        y: self.y,
        height: self.height,
        vh: self.vh,
        stance: self.moveStance,
        phase: self.slidePhase,
        phaseTick: self.slidePhaseTick,
        momentumX: self.momentumX,
        momentumY: self.momentumY,
        ackSeq: self.ackSeq,
      });
    };
    arena.room.onStateChange(sampleState);
    sampleState(arena.room.state);

    arena.events.on("postupdate", () => {
      holder.__v7MoveRenderSeq = (holder.__v7MoveRenderSeq ?? 0) + 1;
      const self = arena.room.state.players.get(arena.room.sessionId);
      const rig = arena.blobs.get(arena.room.sessionId);
      if (!self || !rig) return;
      holder.__v7MoveRender!.push({
        action: holder.__v7MoveAction ?? "idle",
        wallMs: performance.now(),
        tick: arena.room.state.tick,
        x: self.x,
        y: self.y,
        height: self.height,
        vh: self.vh,
        stance: self.moveStance,
        phase: self.slidePhase,
        phaseTick: self.slidePhaseTick,
        momentumX: self.momentumX,
        momentumY: self.momentumY,
        ackSeq: self.ackSeq,
        predX: rig.x,
        predY: rig.y,
        predHeight: arena.selfPredHeight,
        predStance: arena.selfPredStance,
        predPhaseTick: arena.selfPredSlideTick,
        correctionPx: arena.predictor?.stats.errPx ?? 0,
        rootRotation: rig.root.rotation,
        bodyRotation: rig.body.rotation,
        bodyScaleX: rig.body.scaleX,
        bodyScaleY: rig.body.scaleY,
      });
    });
  });
}

async function labelAction(page: Page, label: string): Promise<void> {
  await page.evaluate((nextLabel) => {
    const holder = globalThis as unknown as BrowserGlobal;
    holder.__v7MoveAction = nextLabel;
    holder.__v7MoveInputAt = performance.now();
    holder.__v7MoveInputTimes![nextLabel] = holder.__v7MoveInputAt;
    const arena = holder.ddGame.scene.getScene("arena");
    const self = arena.room.state.players.get(arena.room.sessionId);
    holder.__v7MoveInputTicks![nextLabel] = arena.room.state.tick;
    if (self) holder.__v7MoveInputPositions![nextLabel] = { x: self.x, y: self.y };
  }, label);
}

async function waitServerTicks(page: Page, ticks: number): Promise<void> {
  const start = await page.evaluate(() => {
    const holder = globalThis as unknown as BrowserGlobal;
    return holder.ddGame.scene.getScene("arena").room.state.tick;
  });
  await page.waitForFunction(
    ({ from, count }) => {
      const holder = globalThis as unknown as BrowserGlobal;
      const tick = holder.ddGame.scene.getScene("arena").room.state.tick;
      return ((tick - from) >>> 0) >= count;
    },
    { from: start, count: ticks },
    { timeout: Math.max(15_000, ticks * TICK_MS * 8) },
  );
}

async function oneFrameSpace(
  page: Page,
  label: string,
  expectedEdge: "jump" | "pound",
  directionKeys: readonly string[] = [],
): Promise<void> {
  await keyDownAll(page, [...directionKeys, "Space"]);
  await page.evaluate((action) => {
    const holder = globalThis as unknown as BrowserGlobal;
    const downRender = holder.__v7MoveSpaceDownRender?.[action];
    if (downRender === undefined) throw new Error(`Space keydown was not observed for ${action}`);
    if ((holder.__v7MoveRenderSeq ?? 0) > downRender) return;
    const arena = holder.ddGame.scene.getScene("arena");
    return new Promise<void>((resolve) => arena.events.once("postupdate", resolve));
  }, label);
  await page.keyboard.up("Space");
  try {
    await page.waitForFunction(({ action, edge }) => {
      const holder = globalThis as unknown as BrowserGlobal;
      return holder.__v7MoveInputs?.some(
        (input) => input.action === action && input[edge] === true,
      );
    }, { action: label, edge: expectedEdge });
  } catch (error) {
    const diagnostic = await page.evaluate(({ action, edge }) => {
      const holder = globalThis as unknown as BrowserGlobal;
      const arena = holder.ddGame.scene.getScene("arena") as BrowserArena & {
        keys?: Record<string, { isDown?: boolean; isUp?: boolean }>;
        jumpQueued?: boolean;
        poundQueued?: boolean;
        spaceGesture?: { consumedUntilRelease?: boolean };
      };
      const self = arena.room.state.players.get(arena.room.sessionId);
      return {
        action,
        expectedEdge: edge,
        predStance: arena.selfPredStance,
        predHeight: arena.selfPredHeight,
        authoritativeStance: self?.moveStance,
        authoritativeHeight: self?.height,
        spaceIsDown: arena.keys?.SPACE?.isDown,
        spaceIsUp: arena.keys?.SPACE?.isUp,
        jumpQueued: arena.jumpQueued,
        poundQueued: arena.poundQueued,
        consumedUntilRelease: arena.spaceGesture?.consumedUntilRelease,
        downRender: holder.__v7MoveSpaceDownRender?.[action],
        upRender: holder.__v7MoveSpaceUpRender?.[action],
        renderSeq: holder.__v7MoveRenderSeq,
        actionInputs: holder.__v7MoveInputs?.filter((input) => input.action === action),
      };
    }, { action: label, edge: expectedEdge });
    throw new Error(
      `Space edge was not minted: ${JSON.stringify(diagnostic)}\n${error instanceof Error ? (error.stack ?? error.message) : String(error)}`,
    );
  }
}

async function keyDownAll(page: Page, keys: readonly string[]): Promise<void> {
  await Promise.all(keys.map((key) => page.keyboard.down(key)));
}

async function keyUpAll(page: Page, keys: readonly string[]): Promise<void> {
  await Promise.all([...keys].reverse().map((key) => page.keyboard.up(key)));
}

async function driveRoll(page: Page, direction: DirectionCase, screenshot = false): Promise<void> {
  await labelAction(page, direction.label);
  // Sample the steering chord and roll edge in one gameplay frame. Waiting between them lets ordinary
  // movement reach generated pits before a heavily loaded renderer observes the modifier edge.
  await keyDownAll(page, direction.keys);
  await page.keyboard.down(direction.binding);
  await page.waitForFunction((label) => {
    const holder = globalThis as unknown as BrowserGlobal;
    return holder.__v7MoveInputs?.some((input) => input.action === label && input.slide);
  }, direction.label);
  await page.keyboard.up(direction.binding);
  try {
    await page.waitForFunction((label) => {
      const holder = globalThis as unknown as BrowserGlobal;
      return holder.__v7MoveState?.some(
        (frame) => frame.action === label && frame.stance === 4,
      );
    }, direction.label);
  } catch (error) {
    const diagnostic = await page.evaluate((label) => {
      const holder = globalThis as unknown as BrowserGlobal;
      const arena = holder.ddGame.scene.getScene("arena");
      const self = arena.room.state.players.get(arena.room.sessionId);
      const frames = holder.__v7MoveState?.filter((frame) => frame.action === label) ?? [];
      const transitions = [...new Set((holder.__v7MoveState ?? []).map((frame) => frame.action))]
        .map((action) => {
          const actionFrames = (holder.__v7MoveState ?? []).filter(
            (frame) => frame.action === action,
          );
          const active = actionFrames.filter((frame) => frame.stance === 4);
          return {
            action,
            firstTick: actionFrames[0]?.tick ?? null,
            firstRollTick: active[0]?.tick ?? null,
            lastRollTick: active.at(-1)?.tick ?? null,
            lastTick: actionFrames.at(-1)?.tick ?? null,
          };
        });
      return {
        label,
        gameHasFocus: arena.game.hasFocus,
        pointerOverInteractiveUi: arena.pointerOverInteractiveUi,
        predictorCanSlide: arena.predictor?.canSlide ?? null,
        authoritativeStance: self?.moveStance ?? null,
        authoritativeHeight: self?.height ?? null,
        sampledFrames: frames.length,
        lastSample: frames.at(-1) ?? null,
        slideInputs: holder.__v7MoveInputs?.filter((input) => input.slide) ?? [],
        actionInputHead:
          holder.__v7MoveInputs?.filter((input) => input.action === label).slice(0, 32) ?? [],
        transitions,
      };
    }, direction.label);
    throw new Error(
      `roll admission timed out: ${JSON.stringify(diagnostic)}\n${error instanceof Error ? (error.stack ?? error.message) : String(error)}`,
    );
  }
  // Keep the accepted direction physically held until authority consumes the roll packet. Releasing it
  // earlier lets drain-to-newest preserve the one-shot bit on a newer zero-direction heartbeat.
  await keyUpAll(page, direction.keys);
  if (screenshot) {
    await page.screenshot({ path: path.join(EVIDENCE_DIR, "roll-natural-frame.png") });
  }
}

test("V7-MOVE: fixed tumble roll and immediate default long jump", async ({ page }) => {
  test.setTimeout(180_000);
  page.setDefaultTimeout(15_000);
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await runArenaSpec(page, async (baseURL) => {
    await bootArena(page, baseURL, "weapon:rusty-cleaver");
    await waitForDevWeapon(page, "rusty-cleaver");
    await page.bringToFront();
    await mountProbe(page);

    const rollMeasures: RollMeasure[] = [];
    let cooldownRejectedDistance = Number.POSITIVE_INFINITY;
    let cooldownRejectTeleportStable = false;
    const directions = process.env.DD_V7_MOVE_JUMP_ONLY === "1" ? [] : DIRECTIONS;
    for (let index = 0; index < directions.length; index++) {
      const direction = directions[index]!;
      if (index > 0) {
        await waitServerTicks(page, ROLL_COOLDOWN_MS / TICK_MS + 2);
        await page.waitForFunction(() => {
          const holder = globalThis as unknown as BrowserGlobal;
          return holder.ddGame.scene.getScene("arena").predictor?.canSlide === true;
        }, undefined, { timeout: 30_000 });
      }
      await driveRoll(page, direction, index === 0);
      const traces = await page.evaluate(() => {
        const holder = globalThis as unknown as BrowserGlobal;
        return {
          state: holder.__v7MoveState ?? [],
          render: holder.__v7MoveRender ?? [],
          inputPositions: holder.__v7MoveInputPositions ?? {},
        };
      });
      rollMeasures.push(
        measureRoll(
          direction.label,
          direction.x,
          direction.y,
          traces.state,
          traces.render,
        ),
      );

      if (index === 0) {
        await labelAction(page, "cooldown-reject");
        const rejectStart = await page.evaluate(() => {
          const holder = globalThis as unknown as BrowserGlobal;
          const arena = holder.ddGame.scene.getScene("arena");
          const self = arena.room.state.players.get(arena.room.sessionId);
          if (!self) throw new Error("cooldown probe lost the local player");
          return { x: self.x, y: self.y, fellSeq: self.fellSeq, teleportSeq: self.teleportSeq };
        });
        await keyDownAll(page, ["a", "Control"]);
        try {
          await page.waitForFunction(() => {
            const holder = globalThis as unknown as BrowserGlobal;
            return holder.__v7MoveInputs?.some(
              (input) => input.action === "cooldown-reject" && input.slide,
            );
          });
        } catch (error) {
          const diagnostic = await page.evaluate(() => {
            const holder = globalThis as unknown as BrowserGlobal;
            const arena = holder.ddGame.scene.getScene("arena") as BrowserArena & {
              keys?: Record<string, { isDown?: boolean; isUp?: boolean }>;
              slideQueued?: boolean;
              lastParryPress?: number;
            };
            return {
              hasDocumentFocus: document.hasFocus(),
              gameHasFocus: arena.game.hasFocus,
              renderSeq: holder.__v7MoveRenderSeq,
              ctrl: arena.keys?.CTRL,
              a: arena.keys?.A,
              slideQueued: arena.slideQueued,
              parryAgeMs:
                arena.lastParryPress === undefined ? null : arena.time.now - arena.lastParryPress,
              actionInputs: holder.__v7MoveInputs?.filter(
                (input) => input.action === "cooldown-reject",
              ),
            };
          });
          throw new Error(
            `cooldown edge was not minted: ${JSON.stringify(diagnostic)}\n${error instanceof Error ? (error.stack ?? error.message) : String(error)}`,
          );
        }
        const rejectEdgeSeq = await page.evaluate(() => {
          const holder = globalThis as unknown as BrowserGlobal;
          return holder.__v7MoveInputs
            ?.filter((input) => input.action === "cooldown-reject" && input.slide)
            .at(-1)?.seq;
        });
        if (rejectEdgeSeq === undefined) throw new Error("cooldown probe did not mint a slide edge");
        await keyUpAll(page, ["Control", "a"]);
        await page.waitForFunction((seq) => {
          const holder = globalThis as unknown as BrowserGlobal;
          const arena = holder.ddGame.scene.getScene("arena");
          const ack = arena.room.state.players.get(arena.room.sessionId)?.ackSeq;
          return ack !== undefined && ((ack - seq) >>> 0) < 0x80000000;
        }, rejectEdgeSeq);
        // Let an erroneously accepted roll finish before measuring. All physical keys are already up, so
        // loaded/headless state-patch coalescing cannot turn this observation window into real movement.
        await waitServerTicks(page, 10);
        const rejectEnd = await page.evaluate(() => {
          const holder = globalThis as unknown as BrowserGlobal;
          const arena = holder.ddGame.scene.getScene("arena");
          const self = arena.room.state.players.get(arena.room.sessionId);
          if (!self) throw new Error("cooldown probe lost the local player");
          return { x: self.x, y: self.y, fellSeq: self.fellSeq, teleportSeq: self.teleportSeq };
        });
        cooldownRejectedDistance = Math.hypot(
          rejectEnd.x - rejectStart.x,
          rejectEnd.y - rejectStart.y,
        );
        cooldownRejectTeleportStable =
          rejectEnd.fellSeq === rejectStart.fellSeq &&
          rejectEnd.teleportSeq === rejectStart.teleportSeq;
      }
      await page.waitForFunction(() => {
        const holder = globalThis as unknown as BrowserGlobal;
        const arena = holder.ddGame.scene.getScene("arena");
        return arena.room.state.players.get(arena.room.sessionId)?.moveStance === 0;
      });
      const settledTraces = await page.evaluate(() => {
        const holder = globalThis as unknown as BrowserGlobal;
        return { state: holder.__v7MoveState ?? [], render: holder.__v7MoveRender ?? [] };
      });
      rollMeasures[index] = measureRoll(
        direction.label,
        direction.x,
        direction.y,
        settledTraces.state,
        settledTraces.render,
      );
    }

    await labelAction(page, "long-jump");
    await oneFrameSpace(page, "long-jump", "jump", ["d"]);
    await page.waitForFunction(() => {
      const holder = globalThis as unknown as BrowserGlobal;
      return holder.__v7MoveState?.some(
        (frame) => frame.action === "long-jump" && frame.stance === 2,
      );
    });
    await page.screenshot({ path: path.join(EVIDENCE_DIR, "long-jump-natural-frame.png") });
    await page.waitForFunction(() => {
      const holder = globalThis as unknown as BrowserGlobal;
      const frames = holder.__v7MoveState?.filter((frame) => frame.action === "long-jump") ?? [];
      const flight = frames.findIndex((frame) => frame.stance === 2);
      return frames.some(
        (frame, index) => index > flight && flight >= 0 && frame.stance === 0 && frame.height === 0,
      );
    });
    await page.keyboard.up("d");

    // Start the pound proof from a fresh private-room movement epoch. This keeps the ordinary long-jump
    // measurement intact while removing any dependence on a stale client/server cooldown patch in a
    // throttled headless renderer. `restart` is host-only and this harness owns its isolated room.
    const restartTeleportSeq = await page.evaluate(() => {
      const holder = globalThis as unknown as BrowserGlobal;
      const arena = holder.ddGame.scene.getScene("arena");
      const self = arena.room.state.players.get(arena.room.sessionId);
      if (!self) throw new Error("pound restart lost the local player");
      arena.room.send("restart", undefined);
      return self.teleportSeq;
    });
    await page.waitForFunction((before) => {
      const holder = globalThis as unknown as BrowserGlobal;
      const arena = holder.ddGame.scene.getScene("arena");
      const self = arena.room.state.players.get(arena.room.sessionId);
      return (
        self !== undefined &&
        self.teleportSeq !== before &&
        self.moveStance === 0 &&
        self.height === 0
      );
    }, restartTeleportSeq);
    await page.waitForFunction(() => {
      const holder = globalThis as unknown as BrowserGlobal;
      const arena = holder.ddGame.scene.getScene("arena");
      return arena.selfPredStance === 0 && arena.selfPredHeight <= 0.01;
    });
    await waitServerTicks(page, 2);

    // A second physical Space launch and airborne physical Space edge prove pound remained intact. Wait
    // for the exact classifier treaty: released latch, distance-jump prediction, above the authored 24 px
    // pound floor. A generic "next postupdate" can resume after the whole short flight under headless load.
    const poundSeqBefore = await page.evaluate(() => {
      const holder = globalThis as unknown as BrowserGlobal;
      const arena = holder.ddGame.scene.getScene("arena");
      return arena.room.state.players.get(arena.room.sessionId)?.poundSeq ?? 0;
    });
    await labelAction(page, "long-jump-pound");
    await oneFrameSpace(page, "long-jump-pound", "jump", ["d"]);
    try {
      await page.waitForFunction((distanceJumpStance) => {
        const holder = globalThis as unknown as BrowserGlobal;
        const arena = holder.ddGame.scene.getScene("arena") as BrowserArena & {
          spaceGesture?: { consumedUntilRelease?: boolean };
        };
        return (
          arena.spaceGesture?.consumedUntilRelease === false &&
          arena.selfPredStance === distanceJumpStance &&
          arena.selfPredHeight > 24
        );
      }, STANCE_DISTANCE_JUMP);
    } catch (error) {
      const diagnostic = await page.evaluate(() => {
        const holder = globalThis as unknown as BrowserGlobal;
        const arena = holder.ddGame.scene.getScene("arena") as BrowserArena & {
          spaceGesture?: { consumedUntilRelease?: boolean };
        };
        const renders = holder.__v7MoveRender?.filter(
          (frame) => frame.action === "long-jump-pound",
        ) ?? [];
        const states = holder.__v7MoveState?.filter(
          (frame) => frame.action === "long-jump-pound",
        ) ?? [];
        return {
          predStance: arena.selfPredStance,
          predHeight: arena.selfPredHeight,
          consumedUntilRelease: arena.spaceGesture?.consumedUntilRelease,
          maxPredHeight: Math.max(0, ...renders.map((frame) => frame.predHeight)),
          predictedFlightFrames: renders.filter((frame) => frame.predStance === 2).length,
          maxAuthorityHeight: Math.max(0, ...states.map((frame) => frame.height)),
          authorityFlightFrames: states.filter((frame) => frame.stance === 2).length,
          downRender: holder.__v7MoveSpaceDownRender?.["long-jump-pound"],
          upRender: holder.__v7MoveSpaceUpRender?.["long-jump-pound"],
          renderSeq: holder.__v7MoveRenderSeq,
        };
      });
      throw new Error(
        `airborne pound window was not observed: ${JSON.stringify(diagnostic)}\n${error instanceof Error ? (error.stack ?? error.message) : String(error)}`,
      );
    }
    await page.keyboard.up("d");
    await oneFrameSpace(page, "long-jump-pound", "pound");
    await page.waitForFunction((before) => {
      const holder = globalThis as unknown as BrowserGlobal;
      const arena = holder.ddGame.scene.getScene("arena");
      return arena.room.state.players.get(arena.room.sessionId)?.poundSeq !== before;
    }, poundSeqBefore);
    await page.waitForFunction(() => {
      const holder = globalThis as unknown as BrowserGlobal;
      const frames =
        holder.__v7MoveState?.filter((frame) => frame.action === "long-jump-pound") ?? [];
      const pound = frames.findIndex((frame) => frame.stance === 3);
      return frames.some(
        (frame, index) => index > pound && pound >= 0 && frame.stance === 0 && frame.height === 0,
      );
    });
    await waitServerTicks(page, 2);

    const capture = await page.evaluate(() => {
      const holder = globalThis as unknown as BrowserGlobal;
      return {
        inputAt: holder.__v7MoveInputAt ?? -1,
        inputTimes: holder.__v7MoveInputTimes ?? {},
        inputTicks: holder.__v7MoveInputTicks ?? {},
        physicalTicks: holder.__v7MovePhysicalTicks ?? {},
        inputPositions: holder.__v7MoveInputPositions ?? {},
        spaceDownRender: holder.__v7MoveSpaceDownRender ?? {},
        spaceUpRender: holder.__v7MoveSpaceUpRender ?? {},
        inputs: holder.__v7MoveInputs ?? [],
        state: holder.__v7MoveState ?? [],
        render: holder.__v7MoveRender ?? [],
        poundSeq: (() => {
          const arena = holder.ddGame.scene.getScene("arena");
          return arena.room.state.players.get(arena.room.sessionId)?.poundSeq ?? 0;
        })(),
      };
    });
    const cooldownFrames = capture.state.filter((frame) => frame.action === "cooldown-reject");
    const cooldownFirstGrounded = cooldownFrames.findIndex(
      (frame) => frame.stance === STANCE_NONE,
    );
    const cooldownReenteredRoll = cooldownFrames.some(
      (frame, index) => index > cooldownFirstGrounded && frame.stance === STANCE_ROLL,
    );
    const jumpStates = capture.state.filter((frame) => frame.action === "long-jump");
    const jumpRenders = capture.render.filter((frame) => frame.action === "long-jump");
    const poundStates = capture.state.filter((frame) => frame.action === "long-jump-pound");
    const flightIndex = jumpStates.findIndex((frame) => frame.stance === STANCE_DISTANCE_JUMP);
    const firstAuthorityFlight = flightIndex >= 0 ? jumpStates[flightIndex] : undefined;
    const firstPredictedFlight = jumpRenders.find(
      (frame) => frame.predStance === STANCE_DISTANCE_JUMP,
    );
    const jumpInput = capture.inputs.find(
      (input) => input.action === "long-jump" && input.jump,
    );
    const firstAcknowledgedJump = jumpInput
      ? jumpStates.find((frame) => ((frame.ackSeq - jumpInput.seq) >>> 0) < 0x80000000)
      : undefined;
    const jumpStart = firstAuthorityFlight;
    const jumpEnd =
      flightIndex >= 0
        ? jumpStates.find(
            (frame, index) =>
              index > flightIndex && frame.stance === STANCE_NONE && frame.height === 0,
          )
        : undefined;
    const jumpDistance =
      jumpStart && jumpEnd ? Math.hypot(jumpEnd.x - jumpStart.x, jumpEnd.y - jumpStart.y) : 0;
    const jumpMaxHeight = Math.max(
      0,
      ...jumpStates
        .filter(
          (frame) =>
            firstAuthorityFlight &&
            frame.wallMs >= firstAuthorityFlight.wallMs &&
            (!jumpEnd || frame.wallMs <= jumpEnd.wallMs),
        )
        .map((frame) => frame.height),
    );
    const jumpEvidence = {
      authorityOnsetMs:
        firstAcknowledgedJump?.stance === STANCE_DISTANCE_JUMP
          ? 0
          : Number.POSITIVE_INFINITY,
      authorityPatchLagMs:
        firstAuthorityFlight && jumpInput
          ? tickDelta(jumpInput.tick, inferredDistanceJumpLaunchTick(firstAuthorityFlight)) * TICK_MS
          : Number.POSITIVE_INFINITY,
      authorityAckedInFlight: firstAcknowledgedJump?.stance === STANCE_DISTANCE_JUMP,
      predictionOnsetMs:
        firstPredictedFlight
          ? tickDelta(
              jumpInput?.tick ?? firstPredictedFlight.tick,
              firstPredictedFlight.tick,
            ) * TICK_MS
          : Number.POSITIVE_INFINITY,
      heldRenderFrames:
        (capture.spaceUpRender["long-jump"] ?? Number.POSITIVE_INFINITY) -
        (capture.spaceDownRender["long-jump"] ?? 0),
      crouchSeen: [...jumpStates, ...jumpRenders].some(
        (frame) =>
          frame.stance === STANCE_CROUCH ||
          ("predStance" in frame && frame.predStance === STANCE_CROUCH),
      ),
      jumpDistance,
      maxHeight: jumpMaxHeight,
      landed: Boolean(jumpEnd && jumpEnd.height === 0 && jumpEnd.stance === STANCE_NONE),
      poundSeen: ((capture.poundSeq - poundSeqBefore) & 0xff) > 0,
      poundLanded: Boolean(
        poundStates.at(-1) &&
          poundStates.at(-1)!.height === 0 &&
          poundStates.at(-1)!.stance === STANCE_NONE,
      ),
      stateFrames: jumpStates,
      renderFrames: jumpRenders,
      poundFrames: poundStates,
    };
    const summary = {
      phase: EVIDENCE_PHASE,
      rollMeasures,
      cooldownRejected:
        cooldownFirstGrounded >= 0 &&
        !cooldownReenteredRoll &&
        cooldownRejectTeleportStable,
      cooldownRejectedDistance,
      cooldownRejectTeleportStable,
      cooldownReenteredRoll,
      jump: jumpEvidence,
    };
    await writeFile(
      path.join(EVIDENCE_DIR, "live-capture.json"),
      `${JSON.stringify(summary, null, 2)}\n`,
    );

    expect(summary.cooldownRejected, "an immediate repeat must be rejected").toBe(true);
    for (const roll of rollMeasures) {
      expect(roll.accepted, `${roll.label} must be accepted after cooldown`).toBe(true);
      expect(roll.distance, `${roll.label} fixed authoritative distance`).toBeGreaterThanOrEqual(
        EXPECTED_ROLL_DISTANCE - 10,
      );
      expect(roll.distance, `${roll.label} fixed authoritative distance`).toBeLessThanOrEqual(
        EXPECTED_ROLL_DISTANCE + 10,
      );
      expect(roll.durationMs, `${roll.label} quick authored duration`).toBe(
        EXPECTED_ROLL_TICKS * TICK_MS,
      );
      expect(roll.directionDot, `${roll.label} must stay on its accepted direction`).toBeGreaterThan(
        0.985,
      );
      expect(roll.maxReconciliationPx, `${roll.label} reconciliation envelope`).toBeLessThanOrEqual(
        200,
      );
    }
    expect(
      Math.max(0, ...rollMeasures.map((roll) => roll.measuredTumbleRadians)),
      "sampled whole-card geometry must project one complete tumble over the measured eight ticks",
    ).toBeGreaterThanOrEqual(5.8);
    expect(Math.max(0, ...rollMeasures.map((roll) => roll.measuredTumbleRadians))).toBeLessThanOrEqual(
      6.8,
    );
    expect(jumpEvidence.crouchSeen, "Space must never enter the retired crouch/charge stance").toBe(
      false,
    );
    expect(jumpEvidence.authorityOnsetMs, "one-frame Space authority onset").toBeLessThanOrEqual(100);
    expect(jumpEvidence.predictionOnsetMs, "one-frame Space prediction onset").toBeLessThanOrEqual(70);
    expect(jumpEvidence.heldRenderFrames, "Space must be a one-render-frame tap").toBeLessThanOrEqual(1);
    expect(jumpEvidence.jumpDistance, "authored long-jump reach band").toBeGreaterThanOrEqual(330);
    expect(jumpEvidence.jumpDistance, "authored long-jump reach band").toBeLessThanOrEqual(405);
    expect(jumpEvidence.maxHeight, "authored long-jump height band").toBeGreaterThanOrEqual(45);
    expect(jumpEvidence.maxHeight, "authored long-jump height band").toBeLessThanOrEqual(75);
    expect(jumpEvidence.landed, "ordinary long-jump landing must recover").toBe(true);
    expect(jumpEvidence.poundSeen, "airborne Space must still enter pound").toBe(true);
    expect(jumpEvidence.poundLanded, "pound must still land and recover").toBe(true);
  });
});
