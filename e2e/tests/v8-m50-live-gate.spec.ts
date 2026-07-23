import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { bootArena, runArenaSpec, waitForDevWeapon } from "../helpers/arena-harness.js";

type MotionMode = "stationary" | "strafing";

const WEAPON_ID = "x2-m50-anti-materiel-rifle";
const EVIDENCE_DIR = path.resolve("docs/owner-notes-audit-v8-evidence/thrown-and-sniper");
const CYCLE_DURATION_MS = 520;
const MAX_ONSET_MS = 70;
const MAX_ONSET_FRAMES = 1;
const MAX_MUZZLE_ERROR_PX = 2.5;
const MIN_PHASE_BODY_RATIO = 0.06;
const MIN_STRAFE_TRAVEL_PX = 12;

interface Point {
  x: number;
  y: number;
}

interface ArtContact {
  above: boolean;
  overlapArea: number;
  visible: boolean;
}

interface BoltFrame {
  wallMs: number;
  attackSeq: number;
  rigAttackSeq: number;
  mode: MotionMode;
  primary: Point;
  support: Point;
  weaponRotation: number;
  bodyWidth: number;
  selfX: number;
  selfY: number;
  contact: ArtContact;
}

interface MuzzleRound {
  id: string;
  attackSeq: number;
  mode: MotionMode;
  delta: number;
}

interface BoltCycle {
  attackSeq: number;
  mode: MotionMode;
  authorityConfirmed: boolean;
  onsetMs: number;
  onsetFrames: number;
  acceptedOnsetMs: number;
  extremumIndices: [number, number, number, number];
  backBodyRatio: number;
  downBodyRatio: number;
  upBodyRatio: number;
  forwardBodyRatio: number;
  returnErrorPx: number;
  supportVisibleAboveArt: boolean;
  supportOverlapsArt: boolean;
}

interface BrowserImage extends Point {
  alpha: number;
  rotation: number;
  visible: boolean;
  getBounds(): { x: number; y: number; width: number; height: number };
}

interface BrowserHand {
  front: boolean;
  img: BrowserImage;
}

interface BrowserRig {
  animate(timeMs: number, anim: unknown): unknown;
  __v8M50OriginalAnimate?: (timeMs: number, anim: unknown) => unknown;
  attackBeatSeq?: number;
  body: { displayWidth: number };
  hands: BrowserHand[];
  root: { getIndex(node: unknown): number };
  weapons: { img: BrowserImage }[];
}

interface BrowserArena {
  blobs: { get(id: string): BrowserRig | undefined };
  game: { hasFocus: boolean };
  input: { activePointer: { rightButtonDown(): boolean } };
  pointerOverInteractiveUi: boolean;
  projectiles: { get(id: string): { getData(key: string): unknown } | undefined };
  room: {
    sessionId: string;
    state: {
      players: {
        get(id: string): { attackSeq: number; weapon: string; x: number; y: number } | undefined;
      };
      projectiles: {
        forEach(
          callback: (row: { sourcePlayerId: string; sourceWeaponId: string }, id: string) => void,
        ): void;
      };
    };
  };
  stepNetInput?(deltaMs: number, blocked: boolean, ultimate: boolean, dx: number, dy: number): void;
  time: { now: number };
  verbs?: {
    isLegendOpen?(): boolean;
    releaseInputLatchIf?(release: boolean): void;
    toggleLegend?(nowMs: number): void;
  };
}

interface BrowserGlobal {
  ddGame: { scene: { getScene(key: string): BrowserArena } };
  __v8M50Frames?: BoltFrame[];
  __v8M50Rounds?: MuzzleRound[];
  __v8M50Seen?: Set<string>;
  __v8M50Mode?: MotionMode;
  __v8M50Input?: number;
}

function localRelative(hand: Point, pivot: Point, rotation: number): Point {
  const dx = hand.x - pivot.x;
  const dy = hand.y - pivot.y;
  const c = Math.cos(rotation);
  const s = Math.sin(rotation);
  return { x: dx * c + dy * s, y: -dx * s + dy * c };
}

function extremumIndex(values: readonly number[], mode: "max" | "min"): number {
  let found = 0;
  for (let index = 1; index < values.length; index++) {
    if (
      (mode === "max" && (values[index] ?? -Infinity) > (values[found] ?? -Infinity)) ||
      (mode === "min" && (values[index] ?? Infinity) < (values[found] ?? Infinity))
    )
      found = index;
  }
  return found;
}

function measureCycles(frames: readonly BoltFrame[], startSeq: number): BoltCycle[] {
  const sequences = [
    ...new Set(frames.map((frame) => frame.rigAttackSeq).filter((seq) => seq > startSeq)),
  ];
  return sequences.flatMap((attackSeq) => {
    const acceptedIndex = frames.findIndex((frame) => frame.rigAttackSeq === attackSeq);
    if (acceptedIndex < 1) return [];
    const nextIndex = frames.findIndex(
      (frame, index) => index > acceptedIndex && frame.rigAttackSeq !== attackSeq,
    );
    const cycleFrames = frames.slice(acceptedIndex, nextIndex >= 0 ? nextIndex : frames.length);
    const accepted = frames[acceptedIndex];
    const homeFrame = frames[acceptedIndex - 1];
    const lastFrame = cycleFrames.at(-1);
    if (
      !accepted ||
      !homeFrame ||
      !lastFrame ||
      cycleFrames.length < 6 ||
      lastFrame.wallMs - accepted.wallMs < CYCLE_DURATION_MS
    )
      return [];

    const home = localRelative(homeFrame.support, homeFrame.primary, homeFrame.weaponRotation);
    const locals = cycleFrames.map((frame) =>
      localRelative(frame.support, frame.primary, frame.weaponRotation),
    );
    const forward = locals.map((point) => point.x - home.x);
    const lateral = locals.map((point) => point.y - home.y);
    const backIndex = extremumIndex(forward, "min");
    const downIndex = extremumIndex(lateral, "max");
    const upIndex = extremumIndex(lateral, "min");
    const forwardIndex = extremumIndex(forward, "max");
    const threshold = Math.max(0.5, accepted.bodyWidth * 0.012);
    const onsetIndex = locals.findIndex(
      (point) => Math.hypot(point.x - home.x, point.y - home.y) >= threshold,
    );
    const onsetFrame = onsetIndex >= 0 ? cycleFrames[onsetIndex] : undefined;
    const authority = frames.find((frame) => frame.attackSeq === attackSeq);
    const extremumFrames = [backIndex, downIndex, upIndex, forwardIndex]
      .map((index) => cycleFrames[index])
      .filter((frame): frame is BoltFrame => !!frame);
    return [
      {
        attackSeq,
        mode: accepted.mode,
        authorityConfirmed: authority !== undefined,
        onsetMs: onsetFrame ? onsetFrame.wallMs - accepted.wallMs : Number.POSITIVE_INFINITY,
        onsetFrames: onsetFrame ? onsetIndex : Number.POSITIVE_INFINITY,
        acceptedOnsetMs:
          onsetFrame && authority ? onsetFrame.wallMs - authority.wallMs : Number.POSITIVE_INFINITY,
        extremumIndices: [backIndex, downIndex, upIndex, forwardIndex],
        backBodyRatio: Math.max(0, -(forward[backIndex] ?? 0)) / accepted.bodyWidth,
        downBodyRatio: Math.max(0, lateral[downIndex] ?? 0) / accepted.bodyWidth,
        upBodyRatio: Math.max(0, -(lateral[upIndex] ?? 0)) / accepted.bodyWidth,
        forwardBodyRatio: Math.max(0, forward[forwardIndex] ?? 0) / accepted.bodyWidth,
        returnErrorPx: Math.hypot(
          (locals.at(-1)?.x ?? 0) - home.x,
          (locals.at(-1)?.y ?? 0) - home.y,
        ),
        supportVisibleAboveArt: extremumFrames.every(
          (frame) => frame.contact.visible && frame.contact.above,
        ),
        supportOverlapsArt: extremumFrames.every((frame) => frame.contact.overlapArea > 0),
      },
    ];
  });
}

async function mountProbe(page: Page): Promise<number> {
  return page.evaluate((weaponId) => {
    const holder = globalThis as unknown as BrowserGlobal;
    const arena = holder.ddGame.scene.getScene("arena");
    if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend?.(arena.time.now);
    arena.verbs?.releaseInputLatchIf?.(true);
    arena.game.hasFocus = true;
    arena.pointerOverInteractiveUi = false;
    const rig = arena.blobs.get(arena.room.sessionId);
    const self = arena.room.state.players.get(arena.room.sessionId);
    if (!rig || !self || self.weapon !== weaponId)
      throw new Error("live M-50 bolt rig/player was not mounted");
    holder.__v8M50Frames = [];
    holder.__v8M50Rounds = [];
    holder.__v8M50Seen = new Set();
    holder.__v8M50Mode = "stationary";

    const boundsOverlap = (
      a: { x: number; y: number; width: number; height: number },
      b: { x: number; y: number; width: number; height: number },
    ) =>
      Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
      Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
    const captureRound = () => {
      const player = arena.room.state.players.get(arena.room.sessionId);
      arena.room.state.projectiles.forEach((row, id) => {
        if (
          holder.__v8M50Seen?.has(id) ||
          row.sourcePlayerId !== arena.room.sessionId ||
          row.sourceWeaponId !== weaponId
        )
          return;
        const rendered = arena.projectiles.get(id);
        const originX = Number(rendered?.getData("spawnOriginX"));
        const originY = Number(rendered?.getData("spawnOriginY"));
        const muzzleX = Number(rendered?.getData("spawnMuzzleX"));
        const muzzleY = Number(rendered?.getData("spawnMuzzleY"));
        if (![originX, originY, muzzleX, muzzleY].every(Number.isFinite)) return;
        holder.__v8M50Seen?.add(id);
        holder.__v8M50Rounds?.push({
          id,
          attackSeq: player?.attackSeq ?? 0,
          mode: holder.__v8M50Mode ?? "stationary",
          delta: Math.hypot(originX - muzzleX, originY - muzzleY),
        });
      });
    };

    rig.__v8M50OriginalAnimate = rig.animate;
    rig.animate = function v8M50Animate(this: BrowserRig, timeMs: number, anim: unknown) {
      const result = this.__v8M50OriginalAnimate?.call(this, timeMs, anim);
      const player = arena.room.state.players.get(arena.room.sessionId);
      const primary = this.hands.find((hand) => hand.front)?.img;
      const support = this.hands.find((hand) => !hand.front)?.img;
      const weapon = this.weapons[0]?.img;
      if (player && primary && support && weapon) {
        holder.__v8M50Frames?.push({
          wallMs: performance.now(),
          attackSeq: player.attackSeq,
          rigAttackSeq: this.attackBeatSeq ?? 0,
          mode: holder.__v8M50Mode ?? "stationary",
          primary: { x: primary.x, y: primary.y },
          support: { x: support.x, y: support.y },
          weaponRotation: weapon.rotation,
          bodyWidth: Math.max(1, this.body.displayWidth),
          selfX: player.x,
          selfY: player.y,
          contact: {
            visible: support.visible && support.alpha > 0.5,
            above: this.root.getIndex(support) > this.root.getIndex(weapon),
            overlapArea: boundsOverlap(support.getBounds(), weapon.getBounds()),
          },
        });
      }
      captureRound();
      return result;
    };
    return self.attackSeq;
  }, WEAPON_ID);
}

async function setFiring(page: Page, firing: boolean): Promise<void> {
  await page.evaluate((nextFiring) => {
    const holder = globalThis as unknown as BrowserGlobal;
    const arena = holder.ddGame.scene.getScene("arena");
    arena.input.activePointer.rightButtonDown = () => nextFiring;
    if (nextFiring && !holder.__v8M50Input) {
      holder.__v8M50Input = window.setInterval(() => {
        const dx = holder.__v8M50Mode === "strafing" ? 1 : 0;
        arena.stepNetInput?.(50, false, false, dx, 0);
      }, 50);
    }
    if (!nextFiring) {
      arena.stepNetInput?.(50, false, false, 0, 0);
      if (holder.__v8M50Input) window.clearInterval(holder.__v8M50Input);
      holder.__v8M50Input = undefined;
    }
  }, firing);
}

test("the plain M-50 cycles its bolt and preserves its live muzzle while stationary and strafing", async ({
  page,
}) => {
  test.setTimeout(45_000);
  await runArenaSpec(page, async (baseURL) => {
    await mkdir(EVIDENCE_DIR, { recursive: true });
    await page.setViewportSize({ width: 640, height: 360 });
    await bootArena(page, baseURL, `weapon:${WEAPON_ID}`);
    await waitForDevWeapon(page, WEAPON_ID);
    const canvas = page.locator("#game-root canvas");
    await canvas.click({ position: { x: 320, y: 180 } });
    await page.mouse.move(610, 180);
    await page.waitForTimeout(700);
    const startSeq = await mountProbe(page);

    await setFiring(page, true);
    await page.waitForTimeout(850);
    await page.evaluate(() => {
      (globalThis as unknown as BrowserGlobal).__v8M50Mode = "strafing";
    });
    await page.waitForTimeout(1_450);
    await setFiring(page, false);
    await page.waitForTimeout(360);

    const measured = await page.evaluate(() => {
      const holder = globalThis as unknown as BrowserGlobal;
      return {
        frames: [...(holder.__v8M50Frames ?? [])],
        rounds: [...(holder.__v8M50Rounds ?? [])],
      };
    });
    const first = measured.frames[0];
    const last = measured.frames.at(-1);
    const worldTravelPx =
      first && last ? Math.hypot(last.selfX - first.selfX, last.selfY - first.selfY) : 0;
    const cycles = measureCycles(measured.frames, startSeq);

    const screenshotStart = await page.evaluate(() => {
      const holder = globalThis as unknown as BrowserGlobal;
      holder.__v8M50Mode = "stationary";
      const arena = holder.ddGame.scene.getScene("arena");
      return arena.room.state.players.get(arena.room.sessionId)?.attackSeq ?? 0;
    });
    await setFiring(page, true);
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const holder = globalThis as unknown as BrowserGlobal;
            const arena = holder.ddGame.scene.getScene("arena");
            return arena.room.state.players.get(arena.room.sessionId)?.attackSeq ?? 0;
          }),
        { message: "M-50 evidence shot should be accepted", timeout: 10_000 },
      )
      .toBeGreaterThan(screenshotStart);
    await page.waitForTimeout(72);
    await canvas.screenshot({ path: path.join(EVIDENCE_DIR, `${WEAPON_ID}-bolt.png`) });
    await setFiring(page, false);

    await writeFile(
      path.join(EVIDENCE_DIR, "m50-live-capture.json"),
      `${JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          thresholds: {
            maxOnsetMs: MAX_ONSET_MS,
            maxOnsetFrames: MAX_ONSET_FRAMES,
            maxMuzzleErrorPx: MAX_MUZZLE_ERROR_PX,
            minPhaseBodyRatio: MIN_PHASE_BODY_RATIO,
            minStrafeTravelPx: MIN_STRAFE_TRAVEL_PX,
          },
          weaponId: WEAPON_ID,
          startSeq,
          worldTravelPx,
          rounds: measured.rounds,
          cycles,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    expect(cycles.length, "M-50 complete accepted bolt cycles").toBeGreaterThanOrEqual(2);
    expect(new Set(cycles.map((cycle) => cycle.mode)), "M-50 motion modes").toEqual(
      new Set<MotionMode>(["stationary", "strafing"]),
    );
    const fullySampled = cycles.filter(
      (cycle) =>
        cycle.extremumIndices.every(
          (index, phase) => phase === 0 || index > (cycle.extremumIndices[phase - 1] ?? -1),
        ) &&
        cycle.backBodyRatio >= MIN_PHASE_BODY_RATIO &&
        cycle.downBodyRatio >= MIN_PHASE_BODY_RATIO &&
        cycle.upBodyRatio >= MIN_PHASE_BODY_RATIO &&
        cycle.forwardBodyRatio >= MIN_PHASE_BODY_RATIO,
    );
    expect(fullySampled.length, "M-50 strict BACK->DOWN->UP->FORWARD cycle").toBeGreaterThanOrEqual(
      1,
    );
    for (const cycle of cycles) {
      expect(cycle.authorityConfirmed, `M-50 seq ${cycle.attackSeq} authority`).toBe(true);
      expect(cycle.onsetMs, `M-50 seq ${cycle.attackSeq} onset`).toBeLessThanOrEqual(MAX_ONSET_MS);
      expect(cycle.onsetFrames, `M-50 seq ${cycle.attackSeq} onset frames`).toBeLessThanOrEqual(
        MAX_ONSET_FRAMES,
      );
      expect(
        cycle.acceptedOnsetMs,
        `M-50 seq ${cycle.attackSeq} authority-relative onset`,
      ).toBeLessThanOrEqual(MAX_ONSET_MS);
      expect(cycle.returnErrorPx, `M-50 seq ${cycle.attackSeq} hand return`).toBeLessThanOrEqual(
        1.25,
      );
      expect(cycle.supportVisibleAboveArt, `M-50 seq ${cycle.attackSeq} hand layer`).toBe(true);
      expect(cycle.supportOverlapsArt, `M-50 seq ${cycle.attackSeq} hand contact`).toBe(true);
    }
    expect(worldTravelPx, "M-50 strafe must move the owner").toBeGreaterThan(MIN_STRAFE_TRAVEL_PX);
    for (const mode of ["stationary", "strafing"] as const) {
      const rounds = measured.rounds.filter((round) => round.mode === mode);
      expect(rounds.length, `M-50 ${mode} muzzle samples`).toBeGreaterThan(0);
      expect(
        Math.max(...rounds.map((round) => round.delta)),
        `M-50 ${mode} muzzle-to-origin error`,
      ).toBeLessThanOrEqual(MAX_MUZZLE_ERROR_PX);
    }
  });
});
