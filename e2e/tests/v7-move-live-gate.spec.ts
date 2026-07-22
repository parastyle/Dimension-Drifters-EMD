import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { bootArena, runArenaSpec } from "../helpers/arena-harness.js";

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
  events: { on(type: string, callback: () => void): void };
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
  );
}

async function oneFrameSpace(page: Page, label: string): Promise<void> {
  await page.keyboard.down("Space");
  await page.waitForFunction((action) => {
    const holder = globalThis as unknown as BrowserGlobal;
    const down = holder.__v7MoveSpaceDownRender?.[action];
    return down !== undefined && (holder.__v7MoveRenderSeq ?? 0) > down;
  }, label);
  await page.keyboard.up("Space");
  const releasedAt = await page.evaluate(() => {
    const holder = globalThis as unknown as BrowserGlobal;
    return holder.__v7MoveRenderSeq ?? 0;
  });
  await page.waitForFunction((renderSeq) => {
    const holder = globalThis as unknown as BrowserGlobal;
    return (holder.__v7MoveRenderSeq ?? 0) > renderSeq;
  }, releasedAt);
}

async function oneRenderKey(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
  const afterDown = await page.evaluate(() => {
    const holder = globalThis as unknown as BrowserGlobal;
    return holder.__v7MoveRenderSeq ?? 0;
  });
  await page.waitForFunction((renderSeq) => {
    const holder = globalThis as unknown as BrowserGlobal;
    return (holder.__v7MoveRenderSeq ?? 0) > renderSeq;
  }, afterDown);
  await page.keyboard.up(key);
}

async function keyDownAll(page: Page, keys: readonly string[]): Promise<void> {
  for (const key of keys) await page.keyboard.down(key);
}

async function keyUpAll(page: Page, keys: readonly string[]): Promise<void> {
  for (const key of [...keys].reverse()) await page.keyboard.up(key);
}

async function driveRoll(page: Page, direction: DirectionCase, screenshot = false): Promise<void> {
  await labelAction(page, direction.label);
  await keyDownAll(page, direction.keys);
  await page.keyboard.down(direction.binding);
  await page.waitForFunction((label) => {
    const holder = globalThis as unknown as BrowserGlobal;
    return holder.__v7MoveState?.some(
      (frame) => frame.action === label && frame.stance === 4,
    );
  }, direction.label);
  await page.keyboard.up(direction.binding);
  if (screenshot) {
    await page.waitForFunction(() => {
      const holder = globalThis as unknown as BrowserGlobal;
      return holder.__v7MoveRender?.some(
        (frame) => frame.action === "east-shift" && frame.predPhaseTick >= 3,
      );
    });
    await page.screenshot({ path: path.join(EVIDENCE_DIR, "roll-natural-frame.png") });
  }
  await page.waitForFunction(() => {
    const holder = globalThis as unknown as BrowserGlobal;
    const arena = holder.ddGame.scene.getScene("arena");
    return arena.room.state.players.get(arena.room.sessionId)?.moveStance === 0;
  });
  await keyUpAll(page, direction.keys);
}

test("V7-MOVE: fixed tumble roll and immediate default long jump", async ({ page }) => {
  test.setTimeout(120_000);
  page.setDefaultTimeout(15_000);
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await runArenaSpec(page, async (baseURL) => {
    await bootArena(page, baseURL, "weapon:rusty-cleaver");
    await page.locator("#game-root canvas").click({ position: { x: 320, y: 180 } });
    await mountProbe(page);
    // The focus click is also a real primary-pointer gameplay edge. Let its short
    // parry lock expire before proving that the first physical roll key is accepted.
    await waitServerTicks(page, 12);

    const rollMeasures: RollMeasure[] = [];
    for (let index = 0; index < DIRECTIONS.length; index++) {
      const direction = DIRECTIONS[index]!;
      if (index > 0) {
        await waitServerTicks(page, ROLL_COOLDOWN_MS / TICK_MS + 2);
        await page.waitForFunction(() => {
          const holder = globalThis as unknown as BrowserGlobal;
          return holder.ddGame.scene.getScene("arena").predictor?.canSlide === true;
        });
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
        await page.keyboard.down("a");
        await oneRenderKey(page, "Control");
        await waitServerTicks(page, 10);
        await page.keyboard.up("a");
      }
    }

    await page.keyboard.down("d");
    await waitServerTicks(page, 2);
    await labelAction(page, "long-jump");
    await oneFrameSpace(page, "long-jump");
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

    // A second real Space flight enters through the public input path. Its airborne authority patch then
    // injects the exact one-shot pound bit, avoiding headless rAF starvation while testing the live room.
    await waitServerTicks(page, 55);
    await page.keyboard.down("d");
    await labelAction(page, "long-jump-pound");
    await page.evaluate(() => {
      const holder = globalThis as unknown as BrowserGlobal;
      const arena = holder.ddGame.scene.getScene("arena");
      let sent = false;
      arena.room.onStateChange((state) => {
        const self = state.players.get(arena.room.sessionId);
        if (sent || !self || self.moveStance !== 2 || self.height <= 24) return;
        sent = true;
        arena.room.send("input", {
          // Stay ahead of the browser input manager's queued sequence numbers while remaining
          // inside the live room's bounded +10,000 forward window.
          seq: (self.ackSeq + 9_000) >>> 0,
          dx: 1,
          dy: 0,
          jump: false,
          crouchHeld: false,
          pound: true,
          slide: false,
          slideHeld: false,
          fireHeld: false,
          aimX: 1,
          aimY: 0,
          targetX: self.x + 500,
          targetY: self.y,
        });
      });
    });
    await oneFrameSpace(page, "long-jump-pound");
    await page.waitForFunction(() => {
      const holder = globalThis as unknown as BrowserGlobal;
      return holder.__v7MoveState?.some(
        (frame) => frame.action === "long-jump-pound" && frame.stance === 3,
      );
    });
    await page.waitForFunction(() => {
      const holder = globalThis as unknown as BrowserGlobal;
      const frames =
        holder.__v7MoveState?.filter((frame) => frame.action === "long-jump-pound") ?? [];
      const pound = frames.findIndex((frame) => frame.stance === 3);
      return frames.some(
        (frame, index) => index > pound && pound >= 0 && frame.stance === 0 && frame.height === 0,
      );
    });
    await page.keyboard.up("d");
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
        state: holder.__v7MoveState ?? [],
        render: holder.__v7MoveRender ?? [],
      };
    });
    const cooldownFrames = capture.state.filter((frame) => frame.action === "cooldown-reject");
    const jumpStates = capture.state.filter((frame) => frame.action === "long-jump");
    const jumpRenders = capture.render.filter((frame) => frame.action === "long-jump");
    const poundStates = capture.state.filter((frame) => frame.action === "long-jump-pound");
    const flightIndex = jumpStates.findIndex((frame) => frame.stance === STANCE_DISTANCE_JUMP);
    const firstAuthorityFlight = flightIndex >= 0 ? jumpStates[flightIndex] : undefined;
    const firstPredictedFlight = jumpRenders.find(
      (frame) => frame.predStance === STANCE_DISTANCE_JUMP,
    );
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
        firstAuthorityFlight
          ? tickDelta(
              capture.physicalTicks["long-jump"] ?? firstAuthorityFlight.tick,
              firstAuthorityFlight.tick,
            ) * TICK_MS
          : Number.POSITIVE_INFINITY,
      predictionOnsetMs:
        firstPredictedFlight
          ? tickDelta(
              capture.physicalTicks["long-jump"] ?? firstPredictedFlight.tick,
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
      poundSeen: poundStates.some((frame) => frame.stance === STANCE_POUND),
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
      cooldownRejected: !cooldownFrames.some((frame) => frame.stance === STANCE_ROLL),
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
      rollMeasures[0]?.measuredTumbleRadians ?? 0,
      "sampled whole-card geometry must project one complete tumble over the measured eight ticks",
    ).toBeGreaterThanOrEqual(5.8);
    expect(rollMeasures[0]?.measuredTumbleRadians ?? 0).toBeLessThanOrEqual(6.8);
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
