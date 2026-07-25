import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type ArenaMap,
  isPitAtPx,
  PLAYER_RADIUS,
  resolvePoiCollision,
} from "@dd/shared";
import { expect, type Page, test } from "@playwright/test";
import { matchMaker } from "../../packages/server/node_modules/colyseus/build/index.mjs";
import { bootArena, runArenaSpec } from "../helpers/arena-harness.js";

const EVIDENCE_DIR = path.resolve(
  import.meta.dirname,
  "../../docs/owner-notes-audit-v12-evidence/b53-flip-warp",
);
const CHARACTERS = ["proto-cowboy-hidden-face", "drifter", "proto-samurai"] as const;
const CASES = [
  { pose: "unarmed", weapon: "fists", attack: false },
  { pose: "one-hand-gun", weapon: "x2-fool-s-gold-revolver", attack: false },
  { pose: "two-hand-melee", weapon: "tombstone-greatsword", attack: false },
  { pose: "mid-combo", weapon: "tombstone-greatsword", attack: true },
] as const;
const PATTERNS = ["single-flip", "rapid-adadad"] as const;
const PART_NAMES = [
  "body",
  "head",
  "hand-front",
  "hand-back",
  "foot-front",
  "foot-back",
  "weapon",
] as const;
const FRAME_60_MS = 1000 / 60;
const MAX_NORMALIZED_ROOT_STEP_PX = 11.5;
const MAX_NORMALIZED_PART_POP_PX = 6;
const MIN_FLIP_FRAMES = 4;

type CharacterId = (typeof CHARACTERS)[number];
type PoseName = (typeof CASES)[number]["pose"];
type PatternName = (typeof PATTERNS)[number];
type PartName = (typeof PART_NAMES)[number];

interface PointSample {
  x: number;
  y: number;
  localX: number;
  localY: number;
}

interface FrameSample {
  frame: number;
  sceneMs: number;
  wallMs: number;
  scenario: string;
  character: string;
  pose: string;
  pattern: string;
  root: PointSample;
  parts: Partial<Record<PartName, PointSample>>;
  facing: number;
  facingBlend: number;
  rootScaleX: number;
  baseScale: number;
  flipProgress: number;
  flipActive: boolean;
}

interface StepEvent {
  frame: number;
  sceneMs: number;
  dtMs: number;
  dx: number;
  dy: number;
  stepPx: number;
  normalizedStepPx: number;
  facing: number;
  facingBlend: number;
  flipProgress: number;
}

interface StepStats {
  samples: number;
  maxStepPx: number;
  maxNormalizedStepPx: number;
  maxEvent?: StepEvent;
  discontinuities: StepEvent[];
}

interface ScenarioTrace {
  scenario: string;
  character: CharacterId;
  pose: PoseName;
  pattern: PatternName;
  frames: FrameSample[];
  root: StepStats;
  parts: Partial<Record<PartName, StepStats>>;
  targetChanges: Array<{
    frame: number;
    facing: number;
    facingBlend: number;
    flipProgress: number;
  }>;
}

interface BrowserPoint {
  x: number;
  y: number;
  scaleX: number;
  getWorldTransformMatrix(): { tx: number; ty: number };
}

interface BrowserRig {
  root: BrowserPoint;
  body?: BrowserPoint;
  boilerplateHead?: BrowserPoint;
  hands?: Array<{ front: boolean; img: BrowserPoint }>;
  feet?: Array<{ front: boolean; img: BrowserPoint }>;
  weapons?: Array<{ img: BrowserPoint }>;
  facing?: number;
  facingBlend?: number;
  baseScale?: number;
}

interface BrowserArena {
  blobs: { get(id: string): BrowserRig | undefined };
  events: { on(type: string, callback: () => void): void };
  game: { hasFocus: boolean };
  pointerOverInteractiveUi: boolean;
  room: {
    sessionId: string;
    roomId?: string;
    send(type: string, payload?: unknown): void;
    state: {
      players: {
        get(id: string): { character?: string; weapon?: string } | undefined;
      };
    };
  };
  time: { now: number };
  verbs?: {
    isLegendOpen?(): boolean;
    toggleLegend?(nowMs: number): void;
    releaseInputLatchIf?(release: boolean): void;
  };
}

interface BrowserProbeGlobal {
  ddGame?: { scene: { getScene(key: string): BrowserArena } };
  __b53ActiveScenario?: string;
  __b53ActiveCharacter?: string;
  __b53ActivePose?: string;
  __b53ActivePattern?: string;
  __b53Frames?: FrameSample[];
  __b53Frame?: number;
  __b53SamplerInstalled?: boolean;
}

interface AuthorityPlayer {
  x: number;
  y: number;
}

interface LocalGameRoom {
  map: ArenaMap;
  state: {
    players: {
      get(id: string): AuthorityPlayer | undefined;
    };
  };
  zeroMoveVel(id: string, bumpTeleport: boolean, source: string): void;
}

function round(value: number): number {
  return Number(value.toFixed(4));
}

function normalizedStep(stepPx: number, dtMs: number): number {
  return stepPx * Math.min(1, FRAME_60_MS / Math.max(FRAME_60_MS, dtMs));
}

function analyzeSteps(
  frames: FrameSample[],
  pointAt: (frame: FrameSample) => { x: number; y: number } | undefined,
  thresholdPx: number,
): StepStats {
  const events: StepEvent[] = [];
  let samples = 0;
  let maxStepPx = 0;
  let maxNormalizedStepPx = 0;
  let maxEvent: StepEvent | undefined;
  for (let index = 1; index < frames.length; index++) {
    const previous = frames[index - 1];
    const current = frames[index];
    if (!previous.flipActive && !current.flipActive && previous.facing === current.facing) continue;
    const a = pointAt(previous);
    const b = pointAt(current);
    if (!a || !b) continue;
    samples += 1;
    const dtMs = Math.max(0.001, current.sceneMs - previous.sceneMs);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const stepPx = Math.hypot(dx, dy);
    const normalizedStepPx = normalizedStep(stepPx, dtMs);
    const event: StepEvent = {
      frame: current.frame,
      sceneMs: round(current.sceneMs),
      dtMs: round(dtMs),
      dx: round(dx),
      dy: round(dy),
      stepPx: round(stepPx),
      normalizedStepPx: round(normalizedStepPx),
      facing: current.facing,
      facingBlend: round(current.facingBlend),
      flipProgress: round(current.flipProgress),
    };
    maxStepPx = Math.max(maxStepPx, stepPx);
    if (normalizedStepPx > maxNormalizedStepPx) {
      maxNormalizedStepPx = normalizedStepPx;
      maxEvent = event;
    }
    if (normalizedStepPx > thresholdPx) events.push(event);
  }
  return {
    samples,
    maxStepPx: round(maxStepPx),
    maxNormalizedStepPx: round(maxNormalizedStepPx),
    maxEvent,
    discontinuities: events,
  };
}

function analyzeScenario(
  scenario: string,
  character: CharacterId,
  pose: PoseName,
  pattern: PatternName,
  frames: FrameSample[],
): ScenarioTrace {
  const parts: Partial<Record<PartName, StepStats>> = {};
  for (const name of PART_NAMES) {
    const stats = analyzeSteps(
      frames,
      (frame) => {
        const part = frame.parts[name];
        if (!part) return undefined;
        // World-space part motion with the logical root translation removed. This preserves every parent
        // scale/rotation and child-layout contribution while excluding legitimate walking displacement.
        return { x: part.x - frame.root.x, y: part.y - frame.root.y };
      },
      MAX_NORMALIZED_PART_POP_PX,
    );
    if (stats.samples > 0) parts[name] = stats;
  }
  const targetChanges = frames.flatMap((frame, index) =>
    index > 0 && frame.facing !== frames[index - 1].facing
      ? [
          {
            frame: frame.frame,
            facing: frame.facing,
            facingBlend: round(frame.facingBlend),
            flipProgress: round(frame.flipProgress),
          },
        ]
      : [],
  );
  return {
    scenario,
    character,
    pose,
    pattern,
    frames,
    root: analyzeSteps(
      frames,
      (frame) => ({ x: frame.root.x, y: frame.root.y }),
      MAX_NORMALIZED_ROOT_STEP_PX,
    ),
    parts,
    targetChanges,
  };
}

async function prepareProbe(page: Page): Promise<void> {
  await page.locator("#game-root canvas").click({ position: { x: 960, y: 360 } });
  await page.evaluate(() => {
    const holder = globalThis as unknown as BrowserProbeGlobal;
    const arena = holder.ddGame?.scene.getScene("arena");
    if (!arena) throw new Error("B53 probe requires a live arena");
    if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend?.(arena.time.now);
    arena.verbs?.releaseInputLatchIf?.(true);
    arena.game.hasFocus = true;
    arena.pointerOverInteractiveUi = false;
    if (holder.__b53SamplerInstalled) return;
    holder.__b53SamplerInstalled = true;
    holder.__b53Frames = [];
    holder.__b53Frame = 0;

    const point = (node: BrowserPoint | undefined): PointSample | undefined => {
      if (!node) return undefined;
      const matrix = node.getWorldTransformMatrix();
      return {
        x: matrix.tx,
        y: matrix.ty,
        localX: node.x,
        localY: node.y,
      };
    };

    arena.events.on("postupdate", () => {
      const scenario = holder.__b53ActiveScenario;
      if (!scenario) return;
      const rig = arena.blobs.get(arena.room.sessionId);
      if (!rig?.body) return;
      const root = point(rig.root);
      if (!root) return;
      const parts: Partial<Record<PartName, PointSample>> = {};
      const candidates: Array<[PartName, BrowserPoint | undefined]> = [
        ["body", rig.body],
        ["head", rig.boilerplateHead],
        ["hand-front", rig.hands?.find((hand) => hand.front)?.img],
        ["hand-back", rig.hands?.find((hand) => !hand.front)?.img],
        ["foot-front", rig.feet?.find((foot) => foot.front)?.img],
        ["foot-back", rig.feet?.find((foot) => !foot.front)?.img],
        ["weapon", rig.weapons?.[0]?.img],
      ];
      for (const [name, node] of candidates) {
        const sample = point(node);
        if (sample) parts[name] = sample;
      }
      const facing = rig.facing ?? 1;
      const baseScale = rig.baseScale || 1;
      const facingBlend = rig.facingBlend ?? rig.root.scaleX / baseScale;
      holder.__b53Frames?.push({
        frame: holder.__b53Frame ?? 0,
        sceneMs: arena.time.now,
        wallMs: performance.now(),
        scenario,
        character: holder.__b53ActiveCharacter ?? "",
        pose: holder.__b53ActivePose ?? "",
        pattern: holder.__b53ActivePattern ?? "",
        root,
        parts,
        facing,
        facingBlend,
        rootScaleX: rig.root.scaleX,
        baseScale,
        // A signed visual-state progress is continuous in both directions and across interrupted flips.
        flipProgress: (facingBlend + 1) * 0.5,
        flipActive: Math.abs(facing - facingBlend) > 0.01,
      });
      holder.__b53Frame = (holder.__b53Frame ?? 0) + 1;
    });
  });
}

async function equip(page: Page, character: CharacterId, weapon: string): Promise<void> {
  await page.evaluate(
    ({ characterId, weaponId }) => {
      const holder = globalThis as unknown as BrowserProbeGlobal;
      holder.ddGame?.scene
        .getScene("arena")
        .room.send("devEquip", { character: characterId, weapon: weaponId });
    },
    { characterId: character, weaponId: weapon },
  );
  await expect
    .poll(
      () =>
        page.evaluate(
          ({ characterId, weaponId }) => {
            const holder = globalThis as unknown as BrowserProbeGlobal;
            const arena = holder.ddGame?.scene.getScene("arena");
            const self = arena?.room.state.players.get(arena.room.sessionId);
            const rig = arena?.blobs.get(arena.room.sessionId);
            return {
              character: self?.character,
              weapon: self?.weapon,
              rigReady: !!rig?.body,
              wanted: { character: characterId, weapon: weaponId },
            };
          },
          { characterId: character, weaponId: weapon },
        ),
      { message: `B53 should equip ${character}/${weapon}`, timeout: 30_000 },
    )
    .toMatchObject({ character, weapon, rigReady: true });
  await page.waitForTimeout(250);
}

function findClearPatch(map: ArenaMap): { x: number; y: number } {
  const radius = 520;
  const edge = PLAYER_RADIUS + 48;
  const yCandidates: number[] = [];
  const xCandidates: number[] = [];
  for (let y = edge; y <= ARENA_HEIGHT - edge; y += 48) yCandidates.push(y);
  for (let x = edge + radius; x <= ARENA_WIDTH - edge - radius; x += 48) xCandidates.push(x);
  yCandidates.sort((a, b) => Math.abs(a - ARENA_HEIGHT * 0.5) - Math.abs(b - ARENA_HEIGHT * 0.5));
  xCandidates.sort((a, b) => Math.abs(a - ARENA_WIDTH * 0.5) - Math.abs(b - ARENA_WIDTH * 0.5));
  for (const y of yCandidates) {
    for (const x of xCandidates) {
      let clear = true;
      for (let sampleX = x - radius; sampleX <= x + radius; sampleX += PLAYER_RADIUS) {
        const resolved = resolvePoiCollision(map, sampleX, y, PLAYER_RADIUS);
        if (
          isPitAtPx(map, sampleX, y) ||
          Math.abs(resolved.x - sampleX) > 0.01 ||
          Math.abs(resolved.y - y) > 0.01
        ) {
          clear = false;
          break;
        }
      }
      if (clear) return { x, y };
    }
  }
  throw new Error("B53 probe could not find a clear horizontal turn patch");
}

async function resetToClearPatch(page: Page): Promise<void> {
  await page.keyboard.up("KeyA");
  await page.keyboard.up("KeyD");
  const identity = await page.evaluate(() => {
    const holder = globalThis as unknown as BrowserProbeGlobal;
    const arena = holder.ddGame?.scene.getScene("arena");
    arena?.verbs?.releaseInputLatchIf?.(true);
    const room = arena?.room;
    return room ? { roomId: room.roomId ?? "", sessionId: room.sessionId } : null;
  });
  await page.waitForTimeout(50);
  if (!identity?.roomId) throw new Error("B53 probe requires a same-process authority room");
  const room = matchMaker.getLocalRoomById(identity.roomId) as unknown as LocalGameRoom | undefined;
  const player = room?.state.players.get(identity.sessionId);
  if (!room || !player) throw new Error("B53 probe could not access its authority player");
  const patch = findClearPatch(room.map);
  player.x = patch.x;
  player.y = patch.y;
  room.zeroMoveVel(identity.sessionId, true, "teleport-placement");
  await expect
    .poll(
      () =>
        page.evaluate(
          ({ wantedX, wantedY }) => {
            const holder = globalThis as unknown as BrowserProbeGlobal;
            const arena = holder.ddGame?.scene.getScene("arena");
            const rig = arena?.blobs.get(arena.room.sessionId);
            return Math.hypot((rig?.root.x ?? 0) - wantedX, (rig?.root.y ?? 0) - wantedY);
          },
          { wantedX: patch.x, wantedY: patch.y },
        ),
      { message: "B53 rendered root should settle onto the turn patch", timeout: 10_000 },
    )
    .toBeLessThan(4);
}

async function pointFacing(page: Page, direction: -1 | 1): Promise<void> {
  await page.mouse.move(direction > 0 ? 1050 : 230, 360);
}

async function setMoveDirection(page: Page, direction: -1 | 1): Promise<void> {
  if (direction > 0) {
    await page.keyboard.up("KeyA");
    await page.keyboard.down("KeyD");
  } else {
    await page.keyboard.up("KeyD");
    await page.keyboard.down("KeyA");
  }
  await pointFacing(page, direction);
}

async function currentProbeFrame(page: Page): Promise<number> {
  return await page.evaluate(() => {
    const holder = globalThis as unknown as BrowserProbeGlobal;
    return holder.__b53Frames?.at(-1)?.frame ?? -1;
  });
}

async function waitForProbeFrame(page: Page, wantedFrame: number): Promise<void> {
  await expect
    .poll(() => currentProbeFrame(page), {
      message: `B53 probe should render frame ${wantedFrame}`,
      timeout: 15_000,
    })
    .toBeGreaterThanOrEqual(wantedFrame);
}

async function waitForFacingFrame(
  page: Page,
  direction: -1 | 1,
  afterFrame: number,
): Promise<number> {
  await expect
    .poll(
      () =>
        page.evaluate(
          ({ wantedFacing, priorFrame }) => {
            const holder = globalThis as unknown as BrowserProbeGlobal;
            const frame = holder.__b53Frames?.at(-1);
            if (!frame || frame.frame <= priorFrame || frame.facing !== wantedFacing) return -1;
            return frame.frame;
          },
          { wantedFacing: direction, priorFrame: afterFrame },
        ),
      { message: `B53 probe should present facing ${direction}`, timeout: 15_000 },
    )
    .toBeGreaterThan(afterFrame);
  return await currentProbeFrame(page);
}

async function screenshotFlipFrame(page: Page, fileName: string): Promise<void> {
  await page.locator("#game-root canvas").screenshot({ path: path.join(EVIDENCE_DIR, fileName) });
}

async function enterAttackPose(page: Page): Promise<void> {
  const beforeAttackFrame = await currentProbeFrame(page);
  await page.evaluate(() => {
    const holder = globalThis as unknown as BrowserProbeGlobal;
    const arena = holder.ddGame?.scene.getScene("arena");
    if (!arena) throw new Error("B53 probe requires a live arena");
    arena.room.send("attack", { aimX: 1, aimY: 0, tx: 10_000, ty: 2_400 });
  });
  await waitForProbeFrame(page, beforeAttackFrame + 1);
}

async function captureScenario(
  page: Page,
  character: CharacterId,
  pose: PoseName,
  pattern: PatternName,
  attack: boolean,
  screenshotLabel?: string,
): Promise<ScenarioTrace> {
  const scenario = `${character}:${pose}:${pattern}`;
  await page.evaluate(
    ({ scenarioId, characterId, poseName, patternName }) => {
      const holder = globalThis as unknown as BrowserProbeGlobal;
      holder.__b53Frames = [];
      holder.__b53Frame = 0;
      holder.__b53ActiveScenario = scenarioId;
      holder.__b53ActiveCharacter = characterId;
      holder.__b53ActivePose = poseName;
      holder.__b53ActivePattern = patternName;
    },
    {
      scenarioId: scenario,
      characterId: character,
      poseName: pose,
      patternName: pattern,
    },
  );
  await pointFacing(page, 1);
  await page.keyboard.down("KeyD");
  await waitForProbeFrame(page, 2);

  if (pattern === "single-flip") {
    if (attack) await enterAttackPose(page);
    const beforeFlipFrame = await currentProbeFrame(page);
    await setMoveDirection(page, -1);
    const flipFrame = await waitForFacingFrame(page, -1, beforeFlipFrame);
    if (screenshotLabel) {
      // Release authority input before PNG encoding so the evidence capture cannot walk into a boundary.
      await page.keyboard.up("KeyA");
      await page.keyboard.up("KeyD");
      await screenshotFlipFrame(page, `${screenshotLabel}-single-flip.png`);
    }
    await waitForProbeFrame(page, flipFrame + 3);
  } else {
    for (let index = 0; index < 6; index++) {
      const direction = index % 2 === 0 ? -1 : 1;
      if (attack) await enterAttackPose(page);
      const beforeFlipFrame = await currentProbeFrame(page);
      await setMoveDirection(page, direction);
      const flipFrame = await waitForFacingFrame(page, direction, beforeFlipFrame);
      if (index === 2 && screenshotLabel) {
        await page.keyboard.up("KeyA");
        await page.keyboard.up("KeyD");
        await screenshotFlipFrame(page, `${screenshotLabel}-rapid-adadad.png`);
      }
      await waitForProbeFrame(page, flipFrame + 1);
    }
  }

  const frames = await page.evaluate(() => {
    const holder = globalThis as unknown as BrowserProbeGlobal;
    holder.__b53ActiveScenario = undefined;
    return holder.__b53Frames ?? [];
  });
  await page.keyboard.up("KeyA");
  await page.keyboard.up("KeyD");
  expect(frames.length, `${scenario} should retain rendered flip frames`).toBeGreaterThanOrEqual(
    MIN_FLIP_FRAMES,
  );
  return analyzeScenario(scenario, character, pose, pattern, frames);
}

async function writeEvidence(label: string, traces: ScenarioTrace[]): Promise<void> {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  const summary = traces.map((trace) => ({
    scenario: trace.scenario,
    frames: trace.frames.length,
    targetChanges: trace.targetChanges,
    root: {
      maxStepPx: trace.root.maxStepPx,
      maxNormalizedStepPx: trace.root.maxNormalizedStepPx,
      discontinuities: trace.root.discontinuities,
    },
    parts: Object.fromEntries(
      Object.entries(trace.parts).map(([name, stats]) => [
        name,
        {
          maxStepPx: stats.maxStepPx,
          maxNormalizedStepPx: stats.maxNormalizedStepPx,
          maxEvent: stats.maxEvent,
          discontinuities: stats.discontinuities,
        },
      ]),
    ),
  }));
  await writeFile(
    path.join(EVIDENCE_DIR, `${label}-per-frame-trace.json`),
    `${JSON.stringify(
      {
        label,
        capturedAt: new Date().toISOString(),
        measurement:
          "World-space part pivot motion relative to the rendered root, normalized to a 60 Hz frame; raw world positions and raw steps are retained.",
        thresholds: {
          normalizedRootStepPx: MAX_NORMALIZED_ROOT_STEP_PX,
          normalizedPartPopPx: MAX_NORMALIZED_PART_POP_PX,
        },
        summary,
        traces,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

function assertContinuous(trace: ScenarioTrace): void {
  expect(
    trace.root.discontinuities,
    `${trace.scenario}/root: ${JSON.stringify(trace.root.discontinuities, null, 2)}`,
  ).toHaveLength(0);
  expect(
    trace.targetChanges.length,
    `${trace.scenario} should exercise facing changes`,
  ).toBeGreaterThan(0);
  const expectedParts: PartName[] =
    trace.pose === "unarmed" ? PART_NAMES.filter((name) => name !== "weapon") : [...PART_NAMES];
  for (const name of expectedParts) {
    const stats = trace.parts[name];
    expect(stats, `${trace.scenario}/${name} should be mounted`).toBeDefined();
    if (!stats) continue;
    expect(stats.samples, `${trace.scenario}/${name} frame coverage`).toBeGreaterThanOrEqual(
      MIN_FLIP_FRAMES - 1,
    );
    expect(
      stats.discontinuities,
      `${trace.scenario}/${name}: ${JSON.stringify(stats.discontinuities, null, 2)}`,
    ).toHaveLength(0);
  }
}

test.describe.configure({ mode: "serial" });

test("B53 baseline: a right-to-left turn keeps every rendered part continuous", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await runArenaSpec(page, async (baseURL) => {
    await bootArena(page, baseURL, `char:${CHARACTERS[0]}`);
    await prepareProbe(page);
    await equip(page, CHARACTERS[0], CASES[0].weapon);
    await resetToClearPatch(page);
    const label = process.env.DD_B53_TRACE_LABEL;
    if (label) await mkdir(EVIDENCE_DIR, { recursive: true });
    const trace = await captureScenario(
      page,
      CHARACTERS[0],
      CASES[0].pose,
      "single-flip",
      false,
      label,
    );
    if (label) await writeEvidence(label, [trace]);
    if (process.env.DD_B53_ALLOW_FAILURE !== "1") assertContinuous(trace);
  });
});

test("B53 sweep: 3 characters x 4 loadouts/actions x single/ADADAD stay continuous", async ({
  page,
}) => {
  test.setTimeout(900_000);
  const sharedStack = process.env.DD_E2E_BASE_URL;
  delete process.env.DD_E2E_BASE_URL;
  try {
    await runArenaSpec(page, async (baseURL) => {
      const traces: ScenarioTrace[] = [];
      await bootArena(page, baseURL, `char:${CHARACTERS[0]}`);
      await prepareProbe(page);
      const label = process.env.DD_B53_TRACE_LABEL;
      if (label) await mkdir(EVIDENCE_DIR, { recursive: true });
      for (const character of CHARACTERS) {
        for (const scenario of CASES) {
          await equip(page, character, scenario.weapon);
          for (const pattern of PATTERNS) {
            await resetToClearPatch(page);
            const screenshotLabel =
              label &&
              character === CHARACTERS[0] &&
              scenario.pose === (pattern === "single-flip" ? "one-hand-gun" : "mid-combo")
                ? label
                : undefined;
            const trace = await captureScenario(
              page,
              character,
              scenario.pose,
              pattern,
              scenario.attack,
              screenshotLabel,
            );
            traces.push(trace);
            const maxPartPop = Math.max(
              ...Object.values(trace.parts).map((stats) => stats.maxNormalizedStepPx),
            );
            console.log(
              `[B53] ${trace.scenario}: ${trace.frames.length} frames, max part pop ${round(
                maxPartPop,
              )}px @60Hz`,
            );
          }
        }
      }
      if (label) await writeEvidence(label, traces);
      expect(traces).toHaveLength(CHARACTERS.length * CASES.length * PATTERNS.length);
      if (process.env.DD_B53_ALLOW_FAILURE !== "1") {
        for (const trace of traces) assertContinuous(trace);
      }
    });
  } finally {
    if (sharedStack) process.env.DD_E2E_BASE_URL = sharedStack;
  }
});
