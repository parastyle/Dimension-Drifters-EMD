import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { bootArena, runArenaSpec, waitForDevWeapon } from "../helpers/arena-harness.js";

type Mechanism = "lever" | "pump";
type MotionMode = "stationary" | "strafing";

const WEAPONS: ReadonlyArray<{ id: string; mechanism: Mechanism }> = [
  { id: "x2-thunderhead-lever-gun", mechanism: "lever" },
  { id: "x2-dustline-lever-action", mechanism: "lever" },
  { id: "x2-hollowpoint-repeater", mechanism: "lever" },
  { id: "x2-rustwidow-pump-rifle", mechanism: "pump" },
  { id: "x2-dustdevil-riotgun", mechanism: "pump" },
  { id: "x2-buckshot-avalanche", mechanism: "pump" },
];
const EVIDENCE_PHASE = process.env.DD_V7_HANDS_EVIDENCE_PHASE === "before" ? "before" : "after";
const EVIDENCE_DIR = path.resolve("docs/owner-notes-audit-v7-evidence/hands", EVIDENCE_PHASE);
const MIN_TRAVEL_BODY_RATIO = 0.09;
const MAX_ONSET_MS = 70;
const STATIONARY_MS = 1_050;
const STRAFING_MS = 1_050;
const FINAL_RETURN_MS = 320;

interface Point {
  x: number;
  y: number;
}

interface HandsFrame {
  wallMs: number;
  sceneNow: number;
  attackSeq: number;
  rigAttackSeq: number;
  mode: MotionMode;
  primary: Point;
  support: Point;
  weaponRotation: number;
  bodyWidth: number;
  selfX: number;
  selfY: number;
  supportVisible: boolean;
  supportAboveWeapon: boolean;
  supportOverlapArea: number;
}

interface MuzzleRound {
  id: string;
  attackSeq: number;
  mode: MotionMode;
  delta: number;
}

interface BrowserRig {
  animate(timeMs: number, anim: unknown): unknown;
  __v7HandsOriginalAnimate?: (timeMs: number, anim: unknown) => unknown;
  attackBeatSeq?: number;
  body: { displayWidth: number };
  hands: Array<{
    front: boolean;
    img: Point & {
      alpha: number;
      visible: boolean;
      getBounds(): { x: number; y: number; width: number; height: number };
    };
  }>;
  root: { getIndex(node: unknown): number };
  weapons: Array<{
    img: Point & {
      rotation: number;
      getBounds(): { x: number; y: number; width: number; height: number };
    };
  }>;
}

interface BrowserArena {
  blobs: { get(id: string): BrowserRig | undefined };
  game: { hasFocus: boolean };
  input: { activePointer: { rightButtonDown(): boolean } };
  pointerOverInteractiveUi: boolean;
  projectiles: { get(id: string): { getData(key: string): unknown } | undefined };
  room: {
    send(type: string, payload: unknown): void;
    sessionId: string;
    state: {
      players: {
        get(
          id: string,
        ): { attackSeq: number; weapon: string; x: number; y: number; alive?: boolean } | undefined;
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
  __v7HandsFrames?: HandsFrame[];
  __v7HandsInput?: number;
  __v7HandsMode?: MotionMode;
  __v7HandsRounds?: MuzzleRound[];
  __v7HandsSeen?: Set<string>;
}

interface CycleMeasure {
  attackSeq: number;
  acceptedOnsetMs: number;
  authorityConfirmed: boolean;
  confirmationLagMs: number;
  mode: MotionMode;
  onsetMs: number;
  onsetFrames: number;
  travelPx: number;
  travelBodyRatio: number;
  returnErrorPx: number;
  supportVisibleAboveArt: boolean;
  supportOverlapsArt: boolean;
  rigAssociated: boolean;
}

interface WeaponCapture {
  id: string;
  mechanism: Mechanism;
  startSeq: number;
  frames: HandsFrame[];
  rounds: MuzzleRound[];
  cycles: CycleMeasure[];
  worldTravelPx: number;
}

function axisAt(frame: HandsFrame, mechanism: Mechanism): number {
  const dx = frame.support.x - frame.primary.x;
  const dy = frame.support.y - frame.primary.y;
  const c = Math.cos(frame.weaponRotation);
  const s = Math.sin(frame.weaponRotation);
  return mechanism === "pump" ? dx * c + dy * s : -dx * s + dy * c;
}

function measureCycles(
  frames: readonly HandsFrame[],
  startSeq: number,
  mechanism: Mechanism,
): CycleMeasure[] {
  const sequences = [
    ...new Set(frames.map((frame) => frame.rigAttackSeq).filter((seq) => seq > startSeq)),
  ];
  return sequences.flatMap((attackSeq) => {
    const acceptedIndex = frames.findIndex((frame) => frame.rigAttackSeq === attackSeq);
    if (acceptedIndex < 0) return [];
    const nextIndex = frames.findIndex(
      (frame, index) => index > acceptedIndex && frame.rigAttackSeq !== attackSeq,
    );
    const endIndex = nextIndex >= 0 ? nextIndex : frames.length;
    const cycleFrames = frames.slice(acceptedIndex, endIndex);
    const accepted = frames[acceptedIndex];
    const homeFrame = frames[Math.max(0, acceptedIndex - 1)] ?? accepted;
    if (!accepted || !homeFrame || cycleFrames.length < 3) return [];
    const authority = frames.find((frame) => frame.attackSeq === attackSeq);
    const home = axisAt(homeFrame, mechanism);
    const signedTravel = cycleFrames.map((frame) =>
      mechanism === "pump" ? home - axisAt(frame, mechanism) : axisAt(frame, mechanism) - home,
    );
    const peakTravel = Math.max(0, ...signedTravel);
    const peakIndex = signedTravel.indexOf(peakTravel);
    const threshold = Math.max(0.5, accepted.bodyWidth * 0.012);
    const onsetIndex = signedTravel.findIndex((travel) => travel >= threshold);
    const onsetFrame = onsetIndex >= 0 ? cycleFrames[onsetIndex] : undefined;
    const lastCycleFrame = cycleFrames.at(-1);
    const returnError = lastCycleFrame
      ? Math.abs(axisAt(lastCycleFrame, mechanism) - home)
      : Number.POSITIVE_INFINITY;
    const extremumFrames = cycleFrames.slice(Math.max(0, peakIndex - 1), peakIndex + 2);
    return [
      {
        attackSeq,
        acceptedOnsetMs:
          onsetFrame && authority ? onsetFrame.wallMs - authority.wallMs : Number.POSITIVE_INFINITY,
        authorityConfirmed: authority !== undefined,
        confirmationLagMs: authority
          ? authority.wallMs - accepted.wallMs
          : Number.POSITIVE_INFINITY,
        mode: accepted.mode,
        onsetMs: onsetFrame ? onsetFrame.wallMs - accepted.wallMs : Number.POSITIVE_INFINITY,
        onsetFrames: onsetFrame ? onsetIndex : Number.POSITIVE_INFINITY,
        travelPx: peakTravel,
        travelBodyRatio: peakTravel / Math.max(1, accepted.bodyWidth),
        returnErrorPx: returnError,
        supportVisibleAboveArt: extremumFrames.every(
          (frame) => frame.supportVisible && frame.supportAboveWeapon,
        ),
        supportOverlapsArt: extremumFrames.every((frame) => frame.supportOverlapArea > 0),
        rigAssociated: true,
      },
    ];
  });
}

async function mountProbe(page: Page): Promise<number> {
  return page.evaluate(() => {
    const holder = globalThis as unknown as BrowserGlobal;
    const arena = holder.ddGame.scene.getScene("arena");
    if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend?.(arena.time.now);
    arena.verbs?.releaseInputLatchIf?.(true);
    arena.game.hasFocus = true;
    arena.pointerOverInteractiveUi = false;
    const rig = arena.blobs.get(arena.room.sessionId);
    const self = arena.room.state.players.get(arena.room.sessionId);
    if (!rig || !self) throw new Error("live HANDS rig/player was not mounted");
    holder.__v7HandsFrames = [];
    holder.__v7HandsRounds = [];
    holder.__v7HandsSeen = new Set();
    holder.__v7HandsMode = "stationary";

    if (!rig.__v7HandsOriginalAnimate) {
      rig.__v7HandsOriginalAnimate = rig.animate;
      rig.animate = function v7HandsAnimate(this: BrowserRig, timeMs: number, anim: unknown) {
        const result = this.__v7HandsOriginalAnimate?.call(this, timeMs, anim);
        const player = arena.room.state.players.get(arena.room.sessionId);
        const primary = this.hands.find((hand) => hand.front)?.img;
        const support = this.hands.find((hand) => !hand.front)?.img;
        const weapon = this.weapons[0]?.img;
        if (player && primary && support && weapon) {
          const handBounds = support.getBounds();
          const weaponBounds = weapon.getBounds();
          const overlapWidth = Math.max(
            0,
            Math.min(handBounds.x + handBounds.width, weaponBounds.x + weaponBounds.width) -
              Math.max(handBounds.x, weaponBounds.x),
          );
          const overlapHeight = Math.max(
            0,
            Math.min(handBounds.y + handBounds.height, weaponBounds.y + weaponBounds.height) -
              Math.max(handBounds.y, weaponBounds.y),
          );
          holder.__v7HandsFrames?.push({
            wallMs: performance.now(),
            sceneNow: timeMs,
            attackSeq: player.attackSeq,
            rigAttackSeq: this.attackBeatSeq ?? 0,
            mode: holder.__v7HandsMode ?? "stationary",
            primary: { x: primary.x, y: primary.y },
            support: { x: support.x, y: support.y },
            weaponRotation: weapon.rotation,
            bodyWidth: Math.max(1, this.body.displayWidth),
            selfX: player.x,
            selfY: player.y,
            supportVisible: support.visible && support.alpha > 0.5,
            supportAboveWeapon: this.root.getIndex(support) > this.root.getIndex(weapon),
            supportOverlapArea: overlapWidth * overlapHeight,
          });
        }
        arena.room.state.projectiles.forEach((row, id) => {
          if (
            holder.__v7HandsSeen?.has(id) ||
            row.sourcePlayerId !== arena.room.sessionId ||
            row.sourceWeaponId !== player?.weapon
          )
            return;
          const rendered = arena.projectiles.get(id);
          const originX = Number(rendered?.getData("spawnOriginX"));
          const originY = Number(rendered?.getData("spawnOriginY"));
          const muzzleX = Number(rendered?.getData("spawnMuzzleX"));
          const muzzleY = Number(rendered?.getData("spawnMuzzleY"));
          if (![originX, originY, muzzleX, muzzleY].every(Number.isFinite)) return;
          holder.__v7HandsSeen?.add(id);
          holder.__v7HandsRounds?.push({
            id,
            attackSeq: player?.attackSeq ?? 0,
            mode: holder.__v7HandsMode ?? "stationary",
            delta: Math.hypot(originX - muzzleX, originY - muzzleY),
          });
        });
        return result;
      };
    }
    return self.attackSeq;
  });
}

async function setFiring(page: Page, firing: boolean): Promise<void> {
  await page.evaluate((nextFiring) => {
    const holder = globalThis as unknown as BrowserGlobal;
    const arena = holder.ddGame.scene.getScene("arena");
    arena.input.activePointer.rightButtonDown = () => nextFiring;
    if (nextFiring && !holder.__v7HandsInput) {
      holder.__v7HandsInput = window.setInterval(() => {
        const dx = holder.__v7HandsMode === "strafing" ? 1 : 0;
        arena.stepNetInput?.(50, false, false, dx, 0);
      }, 50);
    }
    if (!nextFiring) {
      arena.stepNetInput?.(50, false, false, 0, 0);
      if (holder.__v7HandsInput) window.clearInterval(holder.__v7HandsInput);
      holder.__v7HandsInput = undefined;
    }
  }, firing);
}

async function captureWeapon(
  page: Page,
  baseURL: string,
  weapon: (typeof WEAPONS)[number],
): Promise<WeaponCapture> {
  await bootArena(page, baseURL, `weapon:${weapon.id}`);
  await waitForDevWeapon(page, weapon.id);
  const canvas = page.locator("#game-root canvas");
  await canvas.click({ position: { x: 320, y: 180 } });
  await page.mouse.move(610, 180);
  await page.waitForTimeout(700);
  const startSeq = await mountProbe(page);
  await setFiring(page, true);
  await page.waitForTimeout(STATIONARY_MS);
  await page.evaluate(() => {
    (globalThis as unknown as BrowserGlobal).__v7HandsMode = "strafing";
  });
  await page.waitForTimeout(STRAFING_MS);
  await setFiring(page, false);
  await page.waitForTimeout(FINAL_RETURN_MS);
  const measured = await page.evaluate(() => {
    const holder = globalThis as unknown as BrowserGlobal;
    return {
      frames: [...(holder.__v7HandsFrames ?? [])],
      rounds: [...(holder.__v7HandsRounds ?? [])],
    };
  });

  // A second real accepted shot supplies the retained human-readable phase frame without stalling the
  // measured RAF window above while Chromium encodes the PNG.
  const visualStart = await page.evaluate(() => {
    const holder = globalThis as unknown as BrowserGlobal;
    const arena = holder.ddGame.scene.getScene("arena");
    holder.__v7HandsMode = "stationary";
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
      { message: `${weapon.id} visual shot should be accepted`, timeout: 10_000 },
    )
    .toBeGreaterThan(visualStart);
  await page.waitForTimeout(72);
  await canvas.screenshot({ path: path.join(EVIDENCE_DIR, `${weapon.id}-mechanism.png`) });
  await setFiring(page, false);

  const first = measured.frames[0];
  const last = measured.frames.at(-1);
  return {
    id: weapon.id,
    mechanism: weapon.mechanism,
    startSeq,
    frames: measured.frames,
    rounds: measured.rounds,
    cycles: measureCycles(measured.frames, startSeq, weapon.mechanism),
    worldTravelPx:
      first && last ? Math.hypot(last.selfX - first.selfX, last.selfY - first.selfY) : 0,
  };
}

test("accepted pump and lever shots visibly cycle support hands without moving the muzzle", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await runArenaSpec(page, async (baseURL) => {
    await mkdir(EVIDENCE_DIR, { recursive: true });
    await page.setViewportSize({ width: 640, height: 360 });
    const captures: WeaponCapture[] = [];
    for (const weapon of WEAPONS) captures.push(await captureWeapon(page, baseURL, weapon));

    await writeFile(
      path.join(EVIDENCE_DIR, "live-capture.json"),
      `${JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          phase: EVIDENCE_PHASE,
          thresholds: { maxOnsetMs: MAX_ONSET_MS, minTravelBodyRatio: MIN_TRAVEL_BODY_RATIO },
          captures,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    for (const capture of captures) {
      expect(
        capture.cycles.length,
        `${capture.id} should expose repeated accepted cycles`,
      ).toBeGreaterThanOrEqual(3);
      expect(
        new Set(capture.cycles.map((cycle) => cycle.mode)),
        `${capture.id} should cycle while stationary and strafing`,
      ).toEqual(new Set<MotionMode>(["stationary", "strafing"]));
      for (const cycle of capture.cycles) {
        expect(
          cycle.authorityConfirmed,
          `${capture.id} seq ${cycle.attackSeq} authority confirmation`,
        ).toBe(true);
        expect(cycle.rigAssociated, `${capture.id} seq ${cycle.attackSeq} must reach the rig`).toBe(
          true,
        );
        expect(cycle.onsetMs, `${capture.id} seq ${cycle.attackSeq} onset`).toBeLessThanOrEqual(
          MAX_ONSET_MS,
        );
        expect(
          cycle.onsetFrames,
          `${capture.id} seq ${cycle.attackSeq} rendered onset`,
        ).toBeLessThanOrEqual(1);
        expect(
          cycle.acceptedOnsetMs,
          `${capture.id} seq ${cycle.attackSeq} onset relative to authority`,
        ).toBeLessThanOrEqual(MAX_ONSET_MS);
        expect(
          cycle.travelBodyRatio,
          `${capture.id} seq ${cycle.attackSeq} travel/body`,
        ).toBeGreaterThanOrEqual(MIN_TRAVEL_BODY_RATIO);
        expect(
          cycle.returnErrorPx,
          `${capture.id} seq ${cycle.attackSeq} return error`,
        ).toBeLessThanOrEqual(Math.max(1.25, cycle.travelPx * 0.35));
        expect(
          cycle.supportVisibleAboveArt,
          `${capture.id} seq ${cycle.attackSeq} hand layer`,
        ).toBe(true);
        expect(cycle.supportOverlapsArt, `${capture.id} seq ${cycle.attackSeq} hand contact`).toBe(
          true,
        );
      }
      expect(capture.worldTravelPx, `${capture.id} strafe must move the owner`).toBeGreaterThan(12);
      for (const mode of ["stationary", "strafing"] as const) {
        const rounds = capture.rounds.filter((round) => round.mode === mode);
        expect(rounds.length, `${capture.id} ${mode} muzzle samples`).toBeGreaterThan(0);
        expect(
          Math.max(...rounds.map((round) => round.delta)),
          `${capture.id} ${mode} muzzle error`,
        ).toBeLessThanOrEqual(2.5);
      }
    }
  });
});
