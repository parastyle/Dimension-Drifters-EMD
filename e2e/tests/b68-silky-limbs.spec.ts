import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type ArenaMap,
  type BeltLevel,
  isArenaDiscSafe,
  isPitAtPx,
  PLAYER_RADIUS,
  resolveBeltNavigation,
} from "@dd/shared";
import { expect, type Page, test } from "@playwright/test";
import { matchMaker } from "../../packages/server/node_modules/colyseus/build/index.mjs";
import { bootArena, runArenaSpec } from "../helpers/arena-harness.js";

const EVIDENCE_DIR = path.resolve(
  import.meta.dirname,
  "../../docs/owner-notes-audit-v12-evidence/b68-silky-limbs",
);
const CAPTURE_NAME = process.env.B68_CAPTURE === "before" ? "before" : "after";
const ENFORCE_THRESHOLDS = CAPTURE_NAME === "after";
const FRAME_60_MS = 1000 / 60;
const CHARACTER = "proto-cowboy-hidden-face";
const WEAPON = "x2-cinderbrand-cleaver";
const PART_NAMES = ["body", "head", "hand-l", "hand-r", "foot-l", "foot-r"] as const;
const SCENARIOS = ["walk-straight", "hard-reversal", "walk-attack", "rapid-flip-attack"] as const;

type PartName = (typeof PART_NAMES)[number];
type ScenarioName = (typeof SCENARIOS)[number];

interface PointSample {
  x: number;
  y: number;
}

interface FrameSample {
  frame: number;
  wallMs: number;
  sceneMs: number;
  animMs: number;
  root: PointSample;
  parts: Record<PartName, PointSample>;
  priorities?: Record<string, { owner: string; weight: number }>;
}

interface BrowserPoint {
  getWorldTransformMatrix(): { tx: number; ty: number };
}

interface BrowserRig {
  root: BrowserPoint;
  body?: BrowserPoint;
  boilerplateHead?: BrowserPoint;
  hands?: Array<{ front: boolean; img: BrowserPoint }>;
  feet?: Array<{ front: boolean; img: BrowserPoint }>;
  limbPrioritySnapshot?: () => Record<string, { owner: string; weight: number }>;
}

interface BrowserArena {
  animClock?: number;
  blobs: { get(id: string): BrowserRig | undefined };
  events: { on(type: string, callback: () => void): void };
  game: { hasFocus: boolean };
  pointerOverInteractiveUi: boolean;
  room: {
    roomId?: string;
    sessionId: string;
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
    releaseInputLatchIf?(released: boolean): void;
  };
}

interface ProbeGlobal {
  ddGame?: { scene: { getScene(key: string): BrowserArena } };
  __b68Scenario?: ScenarioName;
  __b68Frames?: Partial<Record<ScenarioName, FrameSample[]>>;
  __b68Frame?: number;
  __b68Installed?: boolean;
  __b68AttackTimer?: number;
}

interface LocalGameRoom {
  map: ArenaMap;
  beltLevel: BeltLevel | null;
  state: {
    beltLockX: number;
    enemies: { clear(): void };
    players: {
      get(id: string): { x: number; y: number } | undefined;
    };
  };
  zeroMoveVel(id: string, bumpTeleport: boolean, source: string): void;
}

interface StepStats {
  samples: number;
  maxStep60Px: number;
  p95Step60Px: number;
  discontinuities: number;
}

interface ScenarioStats {
  frames: number;
  durationMs: number;
  root: StepStats;
  parts: Record<PartName, StepStats>;
  clock: {
    minAdvanceMs: number;
    maxAdvanceMs: number;
    nonMonotonic: number;
  };
  priorityViolations: number;
}

const LIMITS: Readonly<Record<ScenarioName, Readonly<Record<"root" | PartName, number>>>> = {
  "walk-straight": {
    root: 7,
    body: 1,
    head: 2,
    "hand-l": 2,
    "hand-r": 2,
    "foot-l": 2,
    "foot-r": 2,
  },
  "hard-reversal": {
    root: 7,
    body: 1,
    head: 6,
    "hand-l": 3,
    "hand-r": 3,
    "foot-l": 3,
    "foot-r": 3,
  },
  "walk-attack": {
    root: 7,
    body: 1,
    head: 4,
    "hand-l": 4,
    "hand-r": 4,
    "foot-l": 4,
    "foot-r": 4,
  },
  "rapid-flip-attack": {
    root: 7,
    body: 1,
    head: 7,
    "hand-l": 8,
    "hand-r": 4,
    "foot-l": 4,
    "foot-r": 4,
  },
};

function round(value: number): number {
  return Number(value.toFixed(4));
}

function percentile(values: readonly number[], quantile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * quantile) - 1));
  return sorted[index] ?? 0;
}

function analyzeSteps(
  frames: readonly FrameSample[],
  point: (frame: FrameSample) => PointSample,
  limit: number,
): StepStats {
  const steps: number[] = [];
  let discontinuities = 0;
  for (let index = 1; index < frames.length; index++) {
    const previous = frames[index - 1];
    const current = frames[index];
    if (!previous || !current) continue;
    const dtMs = current.wallMs - previous.wallMs;
    if (!(dtMs > 0) || dtMs > 250) continue;
    const a = point(previous);
    const b = point(current);
    const step60 = Math.hypot(b.x - a.x, b.y - a.y) * (FRAME_60_MS / dtMs);
    steps.push(step60);
    if (step60 > limit) discontinuities++;
  }
  return {
    samples: steps.length,
    maxStep60Px: round(Math.max(0, ...steps)),
    p95Step60Px: round(percentile(steps, 0.95)),
    discontinuities,
  };
}

function analyzeScenario(name: ScenarioName, frames: readonly FrameSample[]): ScenarioStats {
  const root = analyzeSteps(frames, (frame) => frame.root, LIMITS[name].root);
  const parts = Object.fromEntries(
    PART_NAMES.map((part) => [
      part,
      analyzeSteps(
        frames,
        (frame) => ({
          x: frame.parts[part].x - frame.root.x,
          y: frame.parts[part].y - frame.root.y,
        }),
        LIMITS[name][part],
      ),
    ]),
  ) as Record<PartName, StepStats>;
  let minAdvanceMs = Number.POSITIVE_INFINITY;
  let maxAdvanceMs = 0;
  let nonMonotonic = 0;
  let priorityViolations = 0;
  for (let index = 1; index < frames.length; index++) {
    const previous = frames[index - 1];
    const current = frames[index];
    if (!previous || !current) continue;
    const advance = current.animMs - previous.animMs;
    minAdvanceMs = Math.min(minAdvanceMs, advance);
    maxAdvanceMs = Math.max(maxAdvanceMs, advance);
    if (advance < -1e-6) nonMonotonic++;
    for (const part of PART_NAMES) {
      const priority = current.priorities?.[part === "body" ? "body-lean" : part];
      const priorityWeight = priority?.weight;
      if (
        !priority?.owner ||
        !Number.isFinite(priorityWeight) ||
        (priorityWeight ?? -1) < 0 ||
        (priorityWeight ?? 2) > 1
      )
        priorityViolations++;
    }
  }
  return {
    frames: frames.length,
    durationMs: round((frames.at(-1)?.wallMs ?? 0) - (frames[0]?.wallMs ?? 0)),
    root,
    parts,
    clock: {
      minAdvanceMs: round(Number.isFinite(minAdvanceMs) ? minAdvanceMs : 0),
      maxAdvanceMs: round(maxAdvanceMs),
      nonMonotonic,
    },
    priorityViolations,
  };
}

function findClearPatch(map: ArenaMap): { x: number; y: number } {
  const radius = 760;
  const edge = PLAYER_RADIUS + 48;
  for (let y = edge; y <= ARENA_HEIGHT - edge; y += 48) {
    for (let x = edge + radius; x <= ARENA_WIDTH - edge - radius; x += 48) {
      let clear = true;
      for (let sampleX = x - radius; sampleX <= x + radius; sampleX += PLAYER_RADIUS) {
        if (isPitAtPx(map, sampleX, y) || !isArenaDiscSafe(map, sampleX, y, PLAYER_RADIUS)) {
          clear = false;
          break;
        }
      }
      if (clear) return { x, y };
    }
  }
  throw new Error("B68 could not find a clear horizontal movement patch");
}

async function installSampler(page: Page): Promise<void> {
  await page.locator("#game-root canvas").click({ position: { x: 640, y: 360 } });
  await page.evaluate(() => {
    const holder = globalThis as unknown as ProbeGlobal;
    const arena = holder.ddGame?.scene.getScene("arena");
    if (!arena) throw new Error("B68 sampler requires a live arena");
    if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend?.(arena.time.now);
    arena.verbs?.releaseInputLatchIf?.(true);
    arena.game.hasFocus = true;
    arena.pointerOverInteractiveUi = false;
    if (holder.__b68Installed) return;
    holder.__b68Installed = true;
    holder.__b68Frames = {};
    holder.__b68Frame = 0;
    const point = (node: BrowserPoint | undefined): PointSample | undefined => {
      if (!node) return undefined;
      const matrix = node.getWorldTransformMatrix();
      return { x: matrix.tx, y: matrix.ty };
    };
    arena.events.on("postupdate", () => {
      const scenario = holder.__b68Scenario;
      if (!scenario) return;
      const rig = arena.blobs.get(arena.room.sessionId);
      const root = point(rig?.root);
      const body = point(rig?.body);
      const head = point(rig?.boilerplateHead);
      const handR = point(rig?.hands?.find((hand) => hand.front)?.img);
      const handL = point(rig?.hands?.find((hand) => !hand.front)?.img);
      const footR = point(rig?.feet?.find((foot) => foot.front)?.img);
      const footL = point(rig?.feet?.find((foot) => !foot.front)?.img);
      if (!root || !body || !head || !handL || !handR || !footL || !footR) return;
      const frames = holder.__b68Frames?.[scenario] ?? [];
      frames.push({
        frame: holder.__b68Frame ?? 0,
        wallMs: performance.now(),
        sceneMs: arena.time.now,
        animMs: arena.animClock ?? arena.time.now,
        root,
        parts: {
          body,
          head,
          "hand-l": handL,
          "hand-r": handR,
          "foot-l": footL,
          "foot-r": footR,
        },
        priorities: rig?.limbPrioritySnapshot?.(),
      });
      if (holder.__b68Frames) holder.__b68Frames[scenario] = frames;
      holder.__b68Frame = (holder.__b68Frame ?? 0) + 1;
    });
  });
}

async function equipFixture(page: Page): Promise<void> {
  await page.evaluate(
    ({ character, weapon }) => {
      const arena = (globalThis as unknown as ProbeGlobal).ddGame?.scene.getScene("arena");
      arena?.room.send("devEquip", { character, weapon });
    },
    { character: CHARACTER, weapon: WEAPON },
  );
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const arena = (globalThis as unknown as ProbeGlobal).ddGame?.scene.getScene("arena");
          const player = arena?.room.state.players.get(arena.room.sessionId);
          return { character: player?.character, weapon: player?.weapon };
        }),
      { message: "B68 fixture should equip the owner repro character and weapon", timeout: 30_000 },
    )
    .toEqual({ character: CHARACTER, weapon: WEAPON });
  await page.waitForTimeout(350);
}

async function resetPlayer(page: Page): Promise<void> {
  await page.keyboard.up("KeyA");
  await page.keyboard.up("KeyD");
  const identity = await page.evaluate(() => {
    const arena = (globalThis as unknown as ProbeGlobal).ddGame?.scene.getScene("arena");
    return arena ? { roomId: arena.room.roomId ?? "", sessionId: arena.room.sessionId } : undefined;
  });
  if (!identity?.roomId) throw new Error("B68 requires a same-process authority room");
  const room = matchMaker.getLocalRoomById(identity.roomId) as unknown as LocalGameRoom | undefined;
  const player = room?.state.players.get(identity.sessionId);
  if (!room || !player) throw new Error("B68 could not resolve its authority player");
  const patch = room.beltLevel
    ? resolveBeltNavigation(room.beltLevel, player.x, player.y, PLAYER_RADIUS)
    : findClearPatch(room.map);
  room.state.enemies.clear();
  room.state.beltLockX = 0;
  player.x = patch.x;
  player.y = patch.y;
  room.zeroMoveVel(identity.sessionId, true, "teleport-placement");
  await page.waitForTimeout(250);
}

async function setScenario(page: Page, scenario: ScenarioName | undefined): Promise<void> {
  await page.evaluate((next) => {
    const holder = globalThis as unknown as ProbeGlobal;
    holder.__b68Scenario = next;
    if (next && holder.__b68Frames) holder.__b68Frames[next] = [];
  }, scenario);
}

async function startAttack(page: Page): Promise<void> {
  await page.evaluate(() => {
    const holder = globalThis as unknown as ProbeGlobal;
    const arena = holder.ddGame?.scene.getScene("arena");
    if (!arena || holder.__b68AttackTimer) return;
    const attack = () => {
      const self = arena.room.state.players.get(arena.room.sessionId) as
        | ({ x?: number; y?: number } & Record<string, unknown>)
        | undefined;
      arena.room.send("attack", {
        aimX: 1,
        aimY: 0,
        tx: Number(self?.x ?? 0) + 900,
        ty: Number(self?.y ?? 0),
      });
    };
    attack();
    holder.__b68AttackTimer = window.setInterval(attack, 120);
  });
}

async function stopAttack(page: Page): Promise<void> {
  await page.evaluate(() => {
    const holder = globalThis as unknown as ProbeGlobal;
    if (holder.__b68AttackTimer) window.clearInterval(holder.__b68AttackTimer);
    holder.__b68AttackTimer = undefined;
  });
}

async function captureScenario(page: Page, scenario: ScenarioName): Promise<void> {
  await resetPlayer(page);
  if (scenario === "walk-straight") {
    await page.keyboard.down("KeyD");
    await page.waitForTimeout(420);
    await setScenario(page, scenario);
    await page.waitForTimeout(1_550);
  } else if (scenario === "hard-reversal") {
    await page.keyboard.down("KeyD");
    await page.waitForTimeout(420);
    await setScenario(page, scenario);
    await page.waitForTimeout(520);
    await page.keyboard.up("KeyD");
    await page.keyboard.down("KeyA");
    await page.waitForTimeout(900);
  } else if (scenario === "walk-attack") {
    await page.keyboard.down("KeyD");
    await startAttack(page);
    await page.waitForTimeout(420);
    await setScenario(page, scenario);
    await page.waitForTimeout(1_550);
  } else {
    await startAttack(page);
    await page.keyboard.down("KeyD");
    await page.waitForTimeout(420);
    await setScenario(page, scenario);
    for (let flip = 0; flip < 16; flip++) {
      const right = flip % 2 === 0;
      await page.keyboard.up(right ? "KeyA" : "KeyD");
      await page.keyboard.down(right ? "KeyD" : "KeyA");
      await page.waitForTimeout(90);
    }
  }
  await setScenario(page, undefined);
  await page.keyboard.up("KeyA");
  await page.keyboard.up("KeyD");
  await stopAttack(page);
  await page.waitForTimeout(180);
}

test("B68 presented root and all six limbs stay continuous through owner repro movement", async ({
  page,
}) => {
  await runArenaSpec(page, async (baseURL) => {
    await bootArena(page, baseURL, `char:${CHARACTER}`);
    await installSampler(page);
    await equipFixture(page);
    for (const scenario of SCENARIOS) await captureScenario(page, scenario);
    const frames = await page.evaluate(
      () => (globalThis as unknown as ProbeGlobal).__b68Frames ?? {},
    );
    const stats = Object.fromEntries(
      SCENARIOS.map((scenario) => [scenario, analyzeScenario(scenario, frames[scenario] ?? [])]),
    ) as Record<ScenarioName, ScenarioStats>;
    await mkdir(EVIDENCE_DIR, { recursive: true });
    await writeFile(
      path.join(EVIDENCE_DIR, `${CAPTURE_NAME}-frame-deltas.json`),
      `${JSON.stringify({ capturedAt: new Date().toISOString(), limits: LIMITS, stats, frames }, null, 2)}\n`,
    );

    for (const scenario of SCENARIOS) {
      const result = stats[scenario];
      expect(result.frames, `${scenario} rendered frame coverage`).toBeGreaterThanOrEqual(10);
      expect(result.clock.nonMonotonic, `${scenario} monotonic rig clock`).toBe(0);
      if (!ENFORCE_THRESHOLDS) continue;
      expect(result.root.discontinuities, `${scenario} rendered root discontinuities`).toBe(0);
      for (const part of PART_NAMES) {
        expect(
          result.parts[part].discontinuities,
          `${scenario}/${part} discontinuities above ${LIMITS[scenario][part]}px @ 60Hz`,
        ).toBe(0);
      }
      expect(result.priorityViolations, `${scenario} limb owner/weight contract`).toBe(0);
    }
  });
});

test("B68 belt ADAD repro keeps the presented root and all six limbs continuous", async ({ page }) => {
  test.setTimeout(120_000);
  await runArenaSpec(page, async (baseURL) => {
    await bootArena(page, baseURL, `char:${CHARACTER}`, "corporate-grid");
    await installSampler(page);
    await equipFixture(page);
    await captureScenario(page, "rapid-flip-attack");
    const frames = await page.evaluate(
      () => (globalThis as unknown as ProbeGlobal).__b68Frames?.["rapid-flip-attack"] ?? [],
    );
    const stats = analyzeScenario("rapid-flip-attack", frames);
    await mkdir(EVIDENCE_DIR, { recursive: true });
    await writeFile(
      path.join(EVIDENCE_DIR, `${CAPTURE_NAME}-belt-frame-deltas.json`),
      `${JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          limits: LIMITS["rapid-flip-attack"],
          stats,
          frames,
        },
        null,
        2,
      )}\n`,
    );

    expect(stats.frames, "belt rapid-flip-attack rendered frame coverage").toBeGreaterThanOrEqual(
      10,
    );
    expect(stats.clock.nonMonotonic, "belt rapid-flip-attack monotonic rig clock").toBe(0);
    if (!ENFORCE_THRESHOLDS) return;
    expect(stats.root.discontinuities, "belt rapid-flip-attack rendered root discontinuities").toBe(
      0,
    );
    for (const part of PART_NAMES) {
      expect(
        stats.parts[part].discontinuities,
        `belt rapid-flip-attack/${part} discontinuities above ${
          LIMITS["rapid-flip-attack"][part]
        }px @ 60Hz`,
      ).toBe(0);
    }
    expect(stats.priorityViolations, "belt rapid-flip-attack limb owner/weight contract").toBe(0);
  });
});
