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
  "../../docs/owner-notes-audit-v12-evidence/b52-part-snap",
);
const WALK_MS = 3_200;
const WALK_WARMUP_MS = 450;
const MIN_RENDERED_FRAMES = 18;
const CHARACTERS = ["proto-cowboy-hidden-face", "drifter", "proto-samurai"] as const;
const CASES = [
  { pose: "walking", weapon: "fists", attack: false },
  { pose: "held-gun", weapon: "x2-barrett-50-cal-sniper", attack: false },
  { pose: "attacking", weapon: "rusty-cleaver", attack: true },
] as const;
const PART_NAMES = ["head", "body", "hand-front", "hand-back", "foot-front", "foot-back"] as const;

type CharacterId = (typeof CHARACTERS)[number];
type PoseName = (typeof CASES)[number]["pose"];
type PartName = (typeof PART_NAMES)[number] | "weapon";

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
  root: PointSample;
  parts: Partial<Record<PartName, PointSample>>;
  debug: {
    facing: number;
    facingBlend: number;
    rootScaleX: number;
    gait: number;
    stridePhase: number;
    loopDeltaMs: number;
    headSpring: Record<string, number | boolean>;
    headInput: Record<string, number | boolean>;
  };
}

interface SnapEvent {
  frame: number;
  sceneMs: number;
  dx: number;
  rootDx: number;
  relativeDx: number;
  relativeStepPx: number;
  cause: "backward-world" | "local-step";
}

interface PartStats {
  samples: number;
  maxBackwardPx: number;
  maxForwardPx: number;
  maxRelativeStepPx: number;
  backwardEvents: SnapEvent[];
  discontinuityEvents: SnapEvent[];
}

interface ClockEvent {
  frame: number;
  sceneMs: number;
  advance: number;
}

interface ClockStats {
  minAdvance: number;
  maxAdvance: number;
  discontinuityEvents: ClockEvent[];
}

interface ScenarioTrace {
  scenario: string;
  character: CharacterId;
  pose: PoseName;
  durationMs: number;
  frames: FrameSample[];
  parts: Partial<Record<PartName, PartStats>>;
  locomotionClock: ClockStats;
  headSnapHz: number;
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
  gait?: number;
  strideT?: number;
  floatingHeadSpring?: Record<string, number | boolean>;
  floatingHeadSpringInput?: Record<string, number | boolean>;
}

interface BrowserArena {
  blobs: { get(id: string): BrowserRig | undefined };
  events: { on(type: string, callback: () => void): void };
  game: { hasFocus: boolean; loop?: { delta?: number } };
  pointerOverInteractiveUi: boolean;
  room: {
    sessionId: string;
    roomId?: string;
    send(type: string, payload?: unknown): void;
    state: {
      mode?: string;
      players: {
        get(id: string): { character?: string; weapon?: string; attackSeq?: number } | undefined;
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
  __b52ActiveScenario?: string;
  __b52ActiveCharacter?: string;
  __b52ActivePose?: string;
  __b52Frame?: number;
  __b52Frames?: FrameSample[];
  __b52SamplerInstalled?: boolean;
  __b52AttackTimer?: number;
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

interface ClearCorridor {
  x: number;
  y: number;
  length: number;
}

function round(value: number): number {
  return Number(value.toFixed(4));
}

// Clean authored traces stay below these envelopes; the unfixed walking trace crossed them on HEAD,
// both hands, and both feet. Attack-only ceilings preserve the intentional melee arc while HEAD/BODY
// retain the owner's stricter backward-world assertion in every pose.
function localStepLimit(name: PartName, pose: PoseName): number {
  if (name === "head") return pose === "attacking" ? 48 : 24;
  if (name === "body") return 12;
  if (name === "foot-front" || name === "foot-back") return 14;
  if (pose === "attacking" && (name === "hand-front" || name === "hand-back")) return 56;
  if (name === "weapon") return pose === "attacking" ? 24 : 12;
  return 20;
}

function analyzePart(frames: FrameSample[], name: PartName, pose: PoseName): PartStats | undefined {
  const available = frames.filter((frame) => frame.parts[name]);
  if (available.length < 2) return undefined;
  const backwardEvents: SnapEvent[] = [];
  const discontinuityEvents: SnapEvent[] = [];
  let maxBackwardPx = 0;
  let maxForwardPx = 0;
  let maxRelativeStepPx = 0;
  for (let index = 1; index < available.length; index++) {
    const previous = available[index - 1];
    const current = available[index];
    const previousPart = previous.parts[name];
    const currentPart = current.parts[name];
    if (!previousPart || !currentPart) continue;
    const dx = currentPart.x - previousPart.x;
    const rootDx = current.root.x - previous.root.x;
    const relativeDx = currentPart.localX - previousPart.localX;
    const relativeStepPx = Math.hypot(relativeDx, currentPart.localY - previousPart.localY);
    maxBackwardPx = Math.max(maxBackwardPx, -dx);
    maxForwardPx = Math.max(maxForwardPx, dx);
    maxRelativeStepPx = Math.max(maxRelativeStepPx, relativeStepPx);
    const backwardDiscontinuity =
      (name === "head" || name === "body") && dx < -1 && rootDx >= -0.05;
    if (dx < -1 && rootDx >= -0.05) {
      const event: SnapEvent = {
        frame: current.frame,
        sceneMs: round(current.sceneMs),
        dx: round(dx),
        rootDx: round(rootDx),
        relativeDx: round(relativeDx),
        relativeStepPx: round(relativeStepPx),
        cause: "backward-world",
      };
      backwardEvents.push(event);
      if (backwardDiscontinuity) discontinuityEvents.push(event);
    }
    if (!backwardDiscontinuity && relativeStepPx > localStepLimit(name, pose)) {
      discontinuityEvents.push({
        frame: current.frame,
        sceneMs: round(current.sceneMs),
        dx: round(dx),
        rootDx: round(rootDx),
        relativeDx: round(relativeDx),
        relativeStepPx: round(relativeStepPx),
        cause: "local-step",
      });
    }
  }
  return {
    samples: available.length,
    maxBackwardPx: round(maxBackwardPx),
    maxForwardPx: round(maxForwardPx),
    maxRelativeStepPx: round(maxRelativeStepPx),
    backwardEvents,
    discontinuityEvents,
  };
}

function analyzeClock(frames: FrameSample[]): ClockStats {
  const discontinuityEvents: ClockEvent[] = [];
  let minAdvance = Number.POSITIVE_INFINITY;
  let maxAdvance = Number.NEGATIVE_INFINITY;
  for (let index = 1; index < frames.length; index++) {
    const current = frames[index];
    const advance = current.debug.stridePhase - frames[index - 1].debug.stridePhase;
    minAdvance = Math.min(minAdvance, advance);
    maxAdvance = Math.max(maxAdvance, advance);
    if (advance < -0.001 || advance > 1.5) {
      discontinuityEvents.push({
        frame: current.frame,
        sceneMs: round(current.sceneMs),
        advance: round(advance),
      });
    }
  }
  return {
    minAdvance: round(Number.isFinite(minAdvance) ? minAdvance : 0),
    maxAdvance: round(Number.isFinite(maxAdvance) ? maxAdvance : 0),
    discontinuityEvents,
  };
}

function analyzeScenario(
  scenario: string,
  character: CharacterId,
  pose: PoseName,
  frames: FrameSample[],
): ScenarioTrace {
  const parts: Partial<Record<PartName, PartStats>> = {};
  for (const name of [...PART_NAMES, "weapon"] as const) {
    const stats = analyzePart(frames, name, pose);
    if (stats) parts[name] = stats;
  }
  const durationMs = Math.max(0, (frames.at(-1)?.sceneMs ?? 0) - (frames[0]?.sceneMs ?? 0));
  const headEvents = parts.head?.discontinuityEvents.length ?? 0;
  return {
    scenario,
    character,
    pose,
    durationMs: round(durationMs),
    frames,
    parts,
    locomotionClock: analyzeClock(frames),
    headSnapHz: durationMs > 0 ? round(headEvents / (durationMs / 1_000)) : 0,
  };
}

async function prepareProbe(page: Page): Promise<void> {
  await page.locator("#game-root canvas").click({ position: { x: 960, y: 360 } });
  await page.evaluate(() => {
    const holder = globalThis as unknown as BrowserProbeGlobal;
    const arena = holder.ddGame?.scene.getScene("arena");
    if (!arena) throw new Error("B52 probe requires a live arena");
    if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend?.(arena.time.now);
    arena.verbs?.releaseInputLatchIf?.(true);
    arena.game.hasFocus = true;
    arena.pointerOverInteractiveUi = false;
    if (holder.__b52SamplerInstalled) return;
    holder.__b52SamplerInstalled = true;
    holder.__b52Frames = [];
    holder.__b52Frame = 0;

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
      const scenario = holder.__b52ActiveScenario;
      if (!scenario) return;
      const rig = arena.blobs.get(arena.room.sessionId);
      if (!rig?.boilerplateHead || !rig.body) return;
      const frontHand = rig.hands?.find((hand) => hand.front)?.img;
      const backHand = rig.hands?.find((hand) => !hand.front)?.img;
      const frontFoot = rig.feet?.find((foot) => foot.front)?.img;
      const backFoot = rig.feet?.find((foot) => !foot.front)?.img;
      const root = point(rig.root);
      if (!root) return;
      const parts: Partial<Record<PartName, PointSample>> = {};
      const candidates: Array<[PartName, BrowserPoint | undefined]> = [
        ["head", rig.boilerplateHead],
        ["body", rig.body],
        ["hand-front", frontHand],
        ["hand-back", backHand],
        ["foot-front", frontFoot],
        ["foot-back", backFoot],
        ["weapon", rig.weapons?.[0]?.img],
      ];
      for (const [name, node] of candidates) {
        const sample = point(node);
        if (sample) parts[name] = sample;
      }
      holder.__b52Frames?.push({
        frame: holder.__b52Frame ?? 0,
        sceneMs: arena.time.now,
        wallMs: performance.now(),
        scenario,
        character: holder.__b52ActiveCharacter ?? "",
        pose: holder.__b52ActivePose ?? "",
        root,
        parts,
        debug: {
          facing: rig.facing ?? 0,
          facingBlend: rig.facingBlend ?? 0,
          rootScaleX: rig.root.scaleX,
          gait: rig.gait ?? 0,
          stridePhase: rig.strideT ?? 0,
          loopDeltaMs: arena.game.loop?.delta ?? 0,
          headSpring: { ...(rig.floatingHeadSpring ?? {}) },
          headInput: { ...(rig.floatingHeadSpringInput ?? {}) },
        },
      });
      holder.__b52Frame = (holder.__b52Frame ?? 0) + 1;
    });
  });
}

async function equip(page: Page, character: CharacterId, weapon: string): Promise<void> {
  await page.evaluate(
    ({ characterId, weaponId }) => {
      const holder = globalThis as unknown as BrowserProbeGlobal;
      const arena = holder.ddGame?.scene.getScene("arena");
      arena?.room.send("devEquip", { character: characterId, weapon: weaponId });
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
              rigCharacterReady: !!rig?.boilerplateHead && !!rig.body,
              wanted: { character: characterId, weapon: weaponId },
            };
          },
          { characterId: character, weaponId: weapon },
        ),
      { message: `B52 should equip ${character}/${weapon}`, timeout: 30_000 },
    )
    .toMatchObject({ character, weapon, rigCharacterReady: true });
  await page.waitForTimeout(350);
}

function findClearCorridor(map: ArenaMap): ClearCorridor {
  const length = 1_700;
  const edge = PLAYER_RADIUS + 48;
  for (let y = edge; y <= ARENA_HEIGHT - edge; y += 48) {
    for (let x = edge; x <= ARENA_WIDTH - edge - length; x += 48) {
      let clear = true;
      for (let sampleX = x; sampleX <= x + length; sampleX += PLAYER_RADIUS) {
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
      if (clear) return { x, y, length };
    }
  }
  throw new Error("B52 probe could not find a 1,700px horizontal ground corridor");
}

async function resetToClearCorridor(page: Page): Promise<ClearCorridor> {
  const identity = await page.evaluate(() => {
    const holder = globalThis as unknown as BrowserProbeGlobal;
    const room = holder.ddGame?.scene.getScene("arena").room;
    return room ? { roomId: room.roomId ?? "", sessionId: room.sessionId } : null;
  });
  if (!identity?.roomId) throw new Error("B52 probe requires a same-process authority room");
  const room = matchMaker.getLocalRoomById(identity.roomId) as unknown as LocalGameRoom | undefined;
  const player = room?.state.players.get(identity.sessionId);
  if (!room || !player) throw new Error("B52 probe could not access its authority player");
  const corridor = findClearCorridor(room.map);
  player.x = corridor.x;
  player.y = corridor.y;
  room.zeroMoveVel(identity.sessionId, true, "teleport-placement");
  await expect
    .poll(
      () =>
        page.evaluate(
          ({ wantedX, wantedY }) => {
            const holder = globalThis as unknown as BrowserProbeGlobal;
            const arena = holder.ddGame?.scene.getScene("arena");
            const rig = arena?.blobs.get(arena.room.sessionId);
            const dx = (rig?.root.x ?? 0) - wantedX;
            const dy = (rig?.root.y ?? 0) - wantedY;
            return (dx * dx + dy * dy) ** 0.5;
          },
          { wantedX: corridor.x, wantedY: corridor.y },
        ),
      { message: "B52 rendered root should settle onto corridor start", timeout: 10_000 },
    )
    .toBeLessThan(4);
  return corridor;
}

async function captureScenario(
  page: Page,
  character: CharacterId,
  pose: PoseName,
  attack: boolean,
): Promise<ScenarioTrace> {
  const scenario = `${character}:${pose}`;
  await page.evaluate(
    ({ characterId, poseName }) => {
      const holder = globalThis as unknown as BrowserProbeGlobal;
      holder.__b52Frames = [];
      holder.__b52Frame = 0;
      holder.__b52ActiveScenario = undefined;
      holder.__b52ActiveCharacter = characterId;
      holder.__b52ActivePose = poseName;
      if (holder.__b52AttackTimer) window.clearInterval(holder.__b52AttackTimer);
      if (poseName === "attacking") {
        const arena = holder.ddGame?.scene.getScene("arena");
        holder.__b52AttackTimer = window.setInterval(() => {
          const self = arena?.room.state.players.get(arena.room.sessionId);
          if (!arena || !self) return;
          arena.room.send("attack", { aimX: 1, aimY: 0, tx: 10_000, ty: self.weapon ? 2_400 : 0 });
        }, 90);
      }
    },
    { characterId: character, poseName: pose },
  );
  await page.keyboard.down("KeyD");
  if (attack) await page.mouse.down({ button: "right" });
  // Exclude input-latch startup and equip-spring settling. Every retained interval is sampled after
  // the live predictor and authority have begun the fixed-speed walk.
  await page.waitForTimeout(WALK_WARMUP_MS);
  await page.evaluate((scenarioId) => {
    const holder = globalThis as unknown as BrowserProbeGlobal;
    holder.__b52Frames = [];
    holder.__b52Frame = 0;
    holder.__b52ActiveScenario = scenarioId;
  }, scenario);
  await page.waitForTimeout(WALK_MS);
  const frames = await page.evaluate(() => {
    const holder = globalThis as unknown as BrowserProbeGlobal;
    holder.__b52ActiveScenario = undefined;
    if (holder.__b52AttackTimer) {
      window.clearInterval(holder.__b52AttackTimer);
      holder.__b52AttackTimer = undefined;
    }
    return holder.__b52Frames ?? [];
  });
  if (attack) await page.mouse.up({ button: "right" });
  await page.keyboard.up("KeyD");
  // The production canvas is deliberately expensive in headless mode (typically 6-9 rendered FPS).
  // Keep the probe tied to every actual Phaser frame while requiring enough coverage for six 2 Hz cycles.
  expect(frames.length, `${scenario} should retain rendered frames`).toBeGreaterThan(
    MIN_RENDERED_FRAMES,
  );
  return analyzeScenario(scenario, character, pose, frames);
}

async function runBaselineProbe(page: Page): Promise<ScenarioTrace[]> {
  const character = (process.env.DD_B52_CHARACTER ?? CHARACTERS[0]) as CharacterId;
  const scenario = CASES[0];
  await equip(page, character, scenario.weapon);
  return [await captureScenario(page, character, scenario.pose, scenario.attack)];
}

async function runSweep(page: Page, baseURL: string): Promise<ScenarioTrace[]> {
  const traces: ScenarioTrace[] = [];
  await bootArena(page, baseURL, `char:${CHARACTERS[0]}`);
  await prepareProbe(page);
  for (const character of CHARACTERS) {
    for (const scenario of CASES) {
      await equip(page, character, scenario.weapon);
      const corridor = await resetToClearCorridor(page);
      traces.push(await captureScenario(page, character, scenario.pose, scenario.attack));
      const distance = traces.at(-1)?.frames;
      const covered = distance ? (distance.at(-1)?.root.x ?? 0) - (distance[0]?.root.x ?? 0) : 0;
      expect(
        covered,
        `${character}:${scenario.pose} should walk the clear corridor`,
      ).toBeGreaterThan(corridor.length * 0.5);
    }
  }
  return traces;
}

async function writeEvidence(label: string, traces: ScenarioTrace[]): Promise<void> {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  const summary = traces.map((trace) => ({
    scenario: trace.scenario,
    durationMs: trace.durationMs,
    frames: trace.frames.length,
    headSnapHz: trace.headSnapHz,
    locomotionClock: trace.locomotionClock,
    parts: Object.fromEntries(
      Object.entries(trace.parts).map(([name, stats]) => [
        name,
        {
          maxBackwardPx: stats.maxBackwardPx,
          maxForwardPx: stats.maxForwardPx,
          maxRelativeStepPx: stats.maxRelativeStepPx,
          backwardEvents: stats.backwardEvents,
          discontinuityEvents: stats.discontinuityEvents,
        },
      ]),
    ),
  }));
  await writeFile(
    path.join(EVIDENCE_DIR, `${label}-trace-chart.json`),
    `${JSON.stringify(
      {
        label,
        capturedAt: new Date().toISOString(),
        assertion: [
          "HEAD/BODY world x must never move backward by more than 1px while root x is monotonic",
          "part-local frame steps must remain below authored pose ceilings",
          "the shared stride clock must advance continuously by 0..1.5 radians per rendered frame",
        ],
        summary,
        traces,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

test.describe.configure({ mode: "serial" });

test("B52 baseline: walking HEAD has no part-level backward snap", async ({ page }) => {
  test.setTimeout(120_000);
  await runArenaSpec(page, async (baseURL) => {
    await bootArena(page, baseURL, `char:${CHARACTERS[0]}`);
    await prepareProbe(page);
    const traces = await runBaselineProbe(page);
    const label = process.env.DD_B52_TRACE_LABEL;
    if (label) await writeEvidence(label, traces);
    const head = traces[0]?.parts.head;
    expect(head?.samples).toBeGreaterThan(MIN_RENDERED_FRAMES);
    expect(
      head?.discontinuityEvents,
      JSON.stringify(head?.discontinuityEvents ?? [], null, 2),
    ).toHaveLength(0);
    expect(
      traces[0]?.locomotionClock.discontinuityEvents,
      JSON.stringify(traces[0]?.locomotionClock.discontinuityEvents ?? [], null, 2),
    ).toHaveLength(0);
  });
});

test("B52 sweep: all parts stay continuous for 3 characters in walk/gun/attack poses", async ({
  page,
}) => {
  test.setTimeout(300_000);
  const sharedStack = process.env.DD_E2E_BASE_URL;
  delete process.env.DD_E2E_BASE_URL;
  try {
    // This sweep owns a same-process authority, matching the orchestrator probe pattern, so each pose
    // can hard-reset to the same collision-free corridor without adding a production debug RPC.
    await runArenaSpec(page, async (baseURL) => {
      const traces = await runSweep(page, baseURL);
      const label = process.env.DD_B52_TRACE_LABEL;
      if (label) await writeEvidence(label, traces);
      expect(traces).toHaveLength(CHARACTERS.length * CASES.length);
      for (const trace of traces) {
        const expectedParts: PartName[] =
          trace.pose === "walking" ? [...PART_NAMES] : [...PART_NAMES, "weapon"];
        expect(
          trace.locomotionClock.discontinuityEvents,
          `${trace.scenario}/stride-clock: ${JSON.stringify(
            trace.locomotionClock.discontinuityEvents,
            null,
            2,
          )}`,
        ).toHaveLength(0);
        for (const name of expectedParts) {
          const stats = trace.parts[name];
          expect(stats, `${trace.scenario}/${name} should be mounted`).toBeDefined();
          if (!stats) continue;
          expect(stats.samples, `${trace.scenario}/${name} frame coverage`).toBeGreaterThan(
            MIN_RENDERED_FRAMES,
          );
          expect(
            stats.discontinuityEvents,
            `${trace.scenario}/${name}: ${JSON.stringify(stats.discontinuityEvents, null, 2)}`,
          ).toHaveLength(0);
        }
      }
    });
  } finally {
    if (sharedStack) process.env.DD_E2E_BASE_URL = sharedStack;
  }
});
