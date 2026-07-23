import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { bootArena, runArenaSpec, waitForDevWeapon } from "../helpers/arena-harness.js";

type MotionMode = "stationary" | "strafing";
type HandIndex = 0 | 1;

const BOLT_WEAPONS = [
  { id: "x2-tracer-saint-carbine", cycleDurationMs: 156 },
  { id: "x2-barrett-50-cal-sniper", cycleDurationMs: 520 },
  { id: "x2-pale-horse-longgun", cycleDurationMs: 520 },
] as const;
const SIDEWINDER_ID = "x2-sidewinder-twin-rifles";
const EVIDENCE_DIR = path.resolve("docs/owner-notes-audit-v8-evidence/bolt-action");
const MAX_ONSET_MS = 70;
const MAX_ONSET_FRAMES = 1;
const MAX_MUZZLE_ERROR_PX = 2.5;
const MIN_PHASE_BODY_RATIO = 0.06;
const MIN_DUAL_TRAVEL_BODY_RATIO = 0.06;
const MIN_STRAFE_TRAVEL_PX = 12;
const STATIONARY_MS = 850;
const STRAFING_MS = 1_450;
const FINAL_RETURN_MS = 360;

interface Point {
  x: number;
  y: number;
}

interface ArtContact {
  above: boolean;
  overlapArea: number;
  visible: boolean;
}

interface MuzzleRound {
  id: string;
  attackSeq: number;
  mode: MotionMode;
  delta: number;
}

interface BoltFrame {
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
  contact: ArtContact;
}

interface DualFrame {
  wallMs: number;
  sceneNow: number;
  attackSeq: number;
  rigAttackSeq: number;
  mode: MotionMode;
  hands: [Point, Point];
  weapons: [Point, Point];
  weaponRotations: [number, number];
  bodyWidth: number;
  selfX: number;
  selfY: number;
  contacts: [ArtContact, ArtContact];
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

interface BrowserWeapon {
  hand: BrowserHand;
  img: BrowserImage;
}

interface BrowserRig {
  animate(timeMs: number, anim: unknown): unknown;
  __v8BoltOriginalAnimate?: (timeMs: number, anim: unknown) => unknown;
  attackBeatSeq?: number;
  body: { displayWidth: number };
  hands: BrowserHand[];
  root: { getIndex(node: unknown): number };
  weapons: BrowserWeapon[];
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
  __v8BoltFrames?: BoltFrame[];
  __v8DualFrames?: DualFrame[];
  __v8MechanismInput?: number;
  __v8MechanismMode?: MotionMode;
  __v8MechanismRounds?: MuzzleRound[];
  __v8MechanismSeen?: Set<string>;
}

interface BoltCycleMeasure {
  attackSeq: number;
  mode: MotionMode;
  authorityConfirmed: boolean;
  rigAssociated: boolean;
  onsetMs: number;
  onsetFrames: number;
  acceptedOnsetMs: number;
  order: ["BACK", "DOWN", "UP", "FORWARD"];
  extremumIndices: [number, number, number, number];
  backBodyRatio: number;
  downBodyRatio: number;
  upBodyRatio: number;
  forwardBodyRatio: number;
  returnErrorPx: number;
  supportVisibleAboveArt: boolean;
  supportOverlapsArt: boolean;
}

interface DualCycleMeasure {
  attackSeq: number;
  mode: MotionMode;
  authorityConfirmed: boolean;
  movingHand: HandIndex;
  onsetMs: number;
  onsetFrames: number;
  acceptedOnsetMs: number;
  movingTravelBodyRatio: number;
  otherTravelPx: number;
  returnErrorPx: number;
  handVisibleAboveArt: boolean;
  handOverlapsArt: boolean;
}

interface BoltCapture {
  id: string;
  startSeq: number;
  frames: BoltFrame[];
  rounds: MuzzleRound[];
  cycles: BoltCycleMeasure[];
  worldTravelPx: number;
}

interface DualCapture {
  id: string;
  startSeq: number;
  frames: DualFrame[];
  rounds: MuzzleRound[];
  cycles: DualCycleMeasure[];
  worldTravelPx: number;
}

function localRelative(hand: Point, weapon: Point, rotation: number): Point {
  const dx = hand.x - weapon.x;
  const dy = hand.y - weapon.y;
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

function boltLocal(frame: BoltFrame): Point {
  return localRelative(frame.support, frame.primary, frame.weaponRotation);
}

function measureBoltCycles(
  frames: readonly BoltFrame[],
  startSeq: number,
  cycleDurationMs: number,
): BoltCycleMeasure[] {
  const sequences = [
    ...new Set(frames.map((frame) => frame.rigAttackSeq).filter((seq) => seq > startSeq)),
  ];
  return sequences.flatMap((attackSeq) => {
    const acceptedIndex = frames.findIndex((frame) => frame.rigAttackSeq === attackSeq);
    if (acceptedIndex < 1) return [];
    const nextIndex = frames.findIndex(
      (frame, index) => index > acceptedIndex && frame.rigAttackSeq !== attackSeq,
    );
    const endIndex = nextIndex >= 0 ? nextIndex : frames.length;
    const cycleFrames = frames.slice(acceptedIndex, endIndex);
    const accepted = frames[acceptedIndex];
    const homeFrame = frames[acceptedIndex - 1];
    const lastFrame = cycleFrames.at(-1);
    if (
      !accepted ||
      !homeFrame ||
      !lastFrame ||
      cycleFrames.length < 6 ||
      lastFrame.wallMs - accepted.wallMs < cycleDurationMs
    )
      return [];

    const home = boltLocal(homeFrame);
    const locals = cycleFrames.map(boltLocal);
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
        rigAssociated: true,
        onsetMs: onsetFrame ? onsetFrame.wallMs - accepted.wallMs : Number.POSITIVE_INFINITY,
        onsetFrames: onsetFrame ? onsetIndex : Number.POSITIVE_INFINITY,
        acceptedOnsetMs:
          onsetFrame && authority ? onsetFrame.wallMs - authority.wallMs : Number.POSITIVE_INFINITY,
        order: ["BACK", "DOWN", "UP", "FORWARD"],
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

function dualRelative(frame: DualFrame, hand: HandIndex): Point {
  return localRelative(frame.hands[hand], frame.weapons[hand], frame.weaponRotations[hand]);
}

function measureDualCycles(frames: readonly DualFrame[], startSeq: number): DualCycleMeasure[] {
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
    if (!accepted || !homeFrame || cycleFrames.length < 4) return [];
    const homes: [Point, Point] = [dualRelative(homeFrame, 0), dualRelative(homeFrame, 1)];
    const distances = ([0, 1] as const).map((hand) =>
      cycleFrames.map((frame) => {
        const point = dualRelative(frame, hand);
        return Math.hypot(point.x - homes[hand].x, point.y - homes[hand].y);
      }),
    );
    const peaks = distances.map((values) => Math.max(0, ...values)) as [number, number];
    const movingHand: HandIndex = peaks[1] > peaks[0] ? 1 : 0;
    const otherHand: HandIndex = movingHand === 0 ? 1 : 0;
    const peakIndex = extremumIndex(distances[movingHand], "max");
    const threshold = Math.max(0.5, accepted.bodyWidth * 0.012);
    const onsetIndex = distances[movingHand].findIndex((distance) => distance >= threshold);
    const onsetFrame = onsetIndex >= 0 ? cycleFrames[onsetIndex] : undefined;
    const authority = frames.find((frame) => frame.attackSeq === attackSeq);
    const finalPoint = dualRelative(cycleFrames.at(-1) ?? accepted, movingHand);
    const peakFrame = cycleFrames[peakIndex] ?? accepted;
    return [
      {
        attackSeq,
        mode: accepted.mode,
        authorityConfirmed: authority !== undefined,
        movingHand,
        onsetMs: onsetFrame ? onsetFrame.wallMs - accepted.wallMs : Number.POSITIVE_INFINITY,
        onsetFrames: onsetFrame ? onsetIndex : Number.POSITIVE_INFINITY,
        acceptedOnsetMs:
          onsetFrame && authority ? onsetFrame.wallMs - authority.wallMs : Number.POSITIVE_INFINITY,
        movingTravelBodyRatio: peaks[movingHand] / accepted.bodyWidth,
        otherTravelPx: peaks[otherHand],
        returnErrorPx: Math.hypot(
          finalPoint.x - homes[movingHand].x,
          finalPoint.y - homes[movingHand].y,
        ),
        handVisibleAboveArt:
          peakFrame.contacts[movingHand].visible && peakFrame.contacts[movingHand].above,
        handOverlapsArt: peakFrame.contacts[movingHand].overlapArea > 0,
      },
    ];
  });
}

async function mountBoltProbe(page: Page): Promise<number> {
  return page.evaluate(() => {
    const holder = globalThis as unknown as BrowserGlobal;
    const arena = holder.ddGame.scene.getScene("arena");
    if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend?.(arena.time.now);
    arena.verbs?.releaseInputLatchIf?.(true);
    arena.game.hasFocus = true;
    arena.pointerOverInteractiveUi = false;
    const rig = arena.blobs.get(arena.room.sessionId);
    const self = arena.room.state.players.get(arena.room.sessionId);
    if (!rig || !self) throw new Error("live V8 bolt rig/player was not mounted");
    holder.__v8BoltFrames = [];
    holder.__v8MechanismRounds = [];
    holder.__v8MechanismSeen = new Set();
    holder.__v8MechanismMode = "stationary";
    const boundsOverlap = (
      a: { x: number; y: number; width: number; height: number },
      b: { x: number; y: number; width: number; height: number },
    ) =>
      Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
      Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
    const captureLiveRound = () => {
      const player = arena.room.state.players.get(arena.room.sessionId);
      arena.room.state.projectiles.forEach((row, id) => {
        if (
          holder.__v8MechanismSeen?.has(id) ||
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
        holder.__v8MechanismSeen?.add(id);
        holder.__v8MechanismRounds?.push({
          id,
          attackSeq: player?.attackSeq ?? 0,
          mode: holder.__v8MechanismMode ?? "stationary",
          delta: Math.hypot(originX - muzzleX, originY - muzzleY),
        });
      });
    };
    if (!rig.__v8BoltOriginalAnimate) {
      rig.__v8BoltOriginalAnimate = rig.animate;
      rig.animate = function v8BoltAnimate(this: BrowserRig, timeMs: number, anim: unknown) {
        const result = this.__v8BoltOriginalAnimate?.call(this, timeMs, anim);
        const player = arena.room.state.players.get(arena.room.sessionId);
        const primary = this.hands.find((hand) => hand.front)?.img;
        const support = this.hands.find((hand) => !hand.front)?.img;
        const weapon = this.weapons[0]?.img;
        if (player && primary && support && weapon) {
          holder.__v8BoltFrames?.push({
            wallMs: performance.now(),
            sceneNow: timeMs,
            attackSeq: player.attackSeq,
            rigAttackSeq: this.attackBeatSeq ?? 0,
            mode: holder.__v8MechanismMode ?? "stationary",
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
        captureLiveRound();
        return result;
      };
    }
    return self.attackSeq;
  });
}

async function mountDualProbe(page: Page): Promise<number> {
  return page.evaluate(() => {
    const holder = globalThis as unknown as BrowserGlobal;
    const arena = holder.ddGame.scene.getScene("arena");
    if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend?.(arena.time.now);
    arena.verbs?.releaseInputLatchIf?.(true);
    arena.game.hasFocus = true;
    arena.pointerOverInteractiveUi = false;
    const rig = arena.blobs.get(arena.room.sessionId);
    const self = arena.room.state.players.get(arena.room.sessionId);
    if (!rig || !self) throw new Error("live V8 dual-lever rig/player was not mounted");
    holder.__v8DualFrames = [];
    holder.__v8MechanismRounds = [];
    holder.__v8MechanismSeen = new Set();
    holder.__v8MechanismMode = "stationary";
    const boundsOverlap = (
      a: { x: number; y: number; width: number; height: number },
      b: { x: number; y: number; width: number; height: number },
    ) =>
      Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
      Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
    const captureLiveRound = () => {
      const player = arena.room.state.players.get(arena.room.sessionId);
      arena.room.state.projectiles.forEach((row, id) => {
        if (
          holder.__v8MechanismSeen?.has(id) ||
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
        holder.__v8MechanismSeen?.add(id);
        holder.__v8MechanismRounds?.push({
          id,
          attackSeq: player?.attackSeq ?? 0,
          mode: holder.__v8MechanismMode ?? "stationary",
          delta: Math.hypot(originX - muzzleX, originY - muzzleY),
        });
      });
    };
    if (!rig.__v8BoltOriginalAnimate) {
      rig.__v8BoltOriginalAnimate = rig.animate;
      rig.animate = function v8DualAnimate(this: BrowserRig, timeMs: number, anim: unknown) {
        const result = this.__v8BoltOriginalAnimate?.call(this, timeMs, anim);
        const player = arena.room.state.players.get(arena.room.sessionId);
        const lead = this.weapons[0];
        const off = this.weapons[1];
        if (player && lead && off) {
          const hands: [BrowserImage, BrowserImage] = [lead.hand.img, off.hand.img];
          const weapons: [BrowserImage, BrowserImage] = [lead.img, off.img];
          holder.__v8DualFrames?.push({
            wallMs: performance.now(),
            sceneNow: timeMs,
            attackSeq: player.attackSeq,
            rigAttackSeq: this.attackBeatSeq ?? 0,
            mode: holder.__v8MechanismMode ?? "stationary",
            hands: hands.map((hand) => ({ x: hand.x, y: hand.y })) as [Point, Point],
            weapons: weapons.map((weapon) => ({ x: weapon.x, y: weapon.y })) as [Point, Point],
            weaponRotations: [weapons[0].rotation, weapons[1].rotation],
            bodyWidth: Math.max(1, this.body.displayWidth),
            selfX: player.x,
            selfY: player.y,
            contacts: hands.map((hand, index) => ({
              visible: hand.visible && hand.alpha > 0.5,
              above: this.root.getIndex(hand) > this.root.getIndex(weapons[index]),
              overlapArea: boundsOverlap(hand.getBounds(), weapons[index].getBounds()),
            })) as [ArtContact, ArtContact],
          });
        }
        captureLiveRound();
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
    if (nextFiring && !holder.__v8MechanismInput) {
      holder.__v8MechanismInput = window.setInterval(() => {
        const dx = holder.__v8MechanismMode === "strafing" ? 1 : 0;
        arena.stepNetInput?.(50, false, false, dx, 0);
      }, 50);
    }
    if (!nextFiring) {
      arena.stepNetInput?.(50, false, false, 0, 0);
      if (holder.__v8MechanismInput) window.clearInterval(holder.__v8MechanismInput);
      holder.__v8MechanismInput = undefined;
    }
  }, firing);
}

async function runMotionWindow(page: Page): Promise<void> {
  await setFiring(page, true);
  await page.waitForTimeout(STATIONARY_MS);
  await page.evaluate(() => {
    (globalThis as unknown as BrowserGlobal).__v8MechanismMode = "strafing";
  });
  await page.waitForTimeout(STRAFING_MS);
  await setFiring(page, false);
  await page.waitForTimeout(FINAL_RETURN_MS);
}

async function acceptedPhaseScreenshot(
  page: Page,
  id: string,
  filename: string,
  phaseDelayMs: number,
): Promise<void> {
  const canvas = page.locator("#game-root canvas");
  const startSeq = await page.evaluate(() => {
    const holder = globalThis as unknown as BrowserGlobal;
    const arena = holder.ddGame.scene.getScene("arena");
    holder.__v8MechanismMode = "stationary";
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
      { message: `${id} visual shot should be accepted`, timeout: 10_000 },
    )
    .toBeGreaterThan(startSeq);
  await page.waitForTimeout(phaseDelayMs);
  await canvas.screenshot({ path: path.join(EVIDENCE_DIR, filename) });
  await setFiring(page, false);
}

async function prepareWeapon(page: Page, baseURL: string, id: string): Promise<void> {
  await bootArena(page, baseURL, `weapon:${id}`);
  await waitForDevWeapon(page, id);
  const canvas = page.locator("#game-root canvas");
  await canvas.click({ position: { x: 320, y: 180 } });
  await page.mouse.move(610, 180);
  await page.waitForTimeout(700);
}

async function captureBoltWeapon(
  page: Page,
  baseURL: string,
  weapon: (typeof BOLT_WEAPONS)[number],
): Promise<BoltCapture> {
  await prepareWeapon(page, baseURL, weapon.id);
  const startSeq = await mountBoltProbe(page);
  await runMotionWindow(page);
  const measured = await page.evaluate(() => {
    const holder = globalThis as unknown as BrowserGlobal;
    return {
      frames: [...(holder.__v8BoltFrames ?? [])],
      rounds: [...(holder.__v8MechanismRounds ?? [])],
    };
  });
  await acceptedPhaseScreenshot(page, weapon.id, `${weapon.id}-bolt.png`, 72);
  const first = measured.frames[0];
  const last = measured.frames.at(-1);
  return {
    id: weapon.id,
    startSeq,
    frames: measured.frames,
    rounds: measured.rounds,
    cycles: measureBoltCycles(measured.frames, startSeq, weapon.cycleDurationMs),
    worldTravelPx:
      first && last ? Math.hypot(last.selfX - first.selfX, last.selfY - first.selfY) : 0,
  };
}

async function captureSidewinder(page: Page, baseURL: string): Promise<DualCapture> {
  await prepareWeapon(page, baseURL, SIDEWINDER_ID);
  const startSeq = await mountDualProbe(page);
  await runMotionWindow(page);
  const measured = await page.evaluate(() => {
    const holder = globalThis as unknown as BrowserGlobal;
    return {
      frames: [...(holder.__v8DualFrames ?? [])],
      rounds: [...(holder.__v8MechanismRounds ?? [])],
    };
  });
  await acceptedPhaseScreenshot(page, SIDEWINDER_ID, `${SIDEWINDER_ID}-dual-lever.png`, 55);
  const first = measured.frames[0];
  const last = measured.frames.at(-1);
  return {
    id: SIDEWINDER_ID,
    startSeq,
    frames: measured.frames,
    rounds: measured.rounds,
    cycles: measureDualCycles(measured.frames, startSeq),
    worldTravelPx:
      first && last ? Math.hypot(last.selfX - first.selfX, last.selfY - first.selfY) : 0,
  };
}

function assertMuzzleAndMotion(capture: BoltCapture | DualCapture): void {
  expect(capture.worldTravelPx, `${capture.id} strafe must move the owner`).toBeGreaterThan(
    MIN_STRAFE_TRAVEL_PX,
  );
  for (const mode of ["stationary", "strafing"] as const) {
    const rounds = capture.rounds.filter((round) => round.mode === mode);
    expect(rounds.length, `${capture.id} ${mode} muzzle samples`).toBeGreaterThan(0);
    expect(
      Math.max(...rounds.map((round) => round.delta)),
      `${capture.id} ${mode} muzzle-to-authority error`,
    ).toBeLessThanOrEqual(MAX_MUZZLE_ERROR_PX);
  }
}

test("accepted bolt and dual-lever shots animate the correct hands without moving authority muzzles", async ({
  page,
}) => {
  test.setTimeout(150_000);
  await runArenaSpec(page, async (baseURL) => {
    await mkdir(EVIDENCE_DIR, { recursive: true });
    await page.setViewportSize({ width: 640, height: 360 });
    const boltCaptures: BoltCapture[] = [];
    for (const weapon of BOLT_WEAPONS)
      boltCaptures.push(await captureBoltWeapon(page, baseURL, weapon));
    const sidewinder = await captureSidewinder(page, baseURL);

    await writeFile(
      path.join(EVIDENCE_DIR, "live-capture.json"),
      `${JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          thresholds: {
            maxOnsetMs: MAX_ONSET_MS,
            maxOnsetFrames: MAX_ONSET_FRAMES,
            maxMuzzleErrorPx: MAX_MUZZLE_ERROR_PX,
            minPhaseBodyRatio: MIN_PHASE_BODY_RATIO,
            minDualTravelBodyRatio: MIN_DUAL_TRAVEL_BODY_RATIO,
            minStrafeTravelPx: MIN_STRAFE_TRAVEL_PX,
          },
          boltCaptures,
          sidewinder,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    for (const capture of boltCaptures) {
      expect(
        capture.cycles.length,
        `${capture.id} complete accepted bolt cycles`,
      ).toBeGreaterThanOrEqual(2);
      expect(
        new Set(capture.cycles.map((cycle) => cycle.mode)),
        `${capture.id} motion modes`,
      ).toEqual(new Set<MotionMode>(["stationary", "strafing"]));
      const fullySampled = capture.cycles.filter(
        (cycle) =>
          cycle.extremumIndices.every(
            (index, phase) => phase === 0 || index > (cycle.extremumIndices[phase - 1] ?? -1),
          ) &&
          cycle.backBodyRatio >= MIN_PHASE_BODY_RATIO &&
          cycle.downBodyRatio >= MIN_PHASE_BODY_RATIO &&
          cycle.upBodyRatio >= MIN_PHASE_BODY_RATIO &&
          cycle.forwardBodyRatio >= MIN_PHASE_BODY_RATIO,
      );
      expect(
        fullySampled.length,
        `${capture.id} must retain a strict fully rendered BACK->DOWN->UP->FORWARD cycle`,
      ).toBeGreaterThanOrEqual(1);
      for (const cycle of capture.cycles) {
        expect(cycle.authorityConfirmed, `${capture.id} seq ${cycle.attackSeq} authority`).toBe(
          true,
        );
        expect(cycle.rigAssociated, `${capture.id} seq ${cycle.attackSeq} rig association`).toBe(
          true,
        );
        expect(cycle.onsetMs, `${capture.id} seq ${cycle.attackSeq} onset`).toBeLessThanOrEqual(
          MAX_ONSET_MS,
        );
        expect(
          cycle.onsetFrames,
          `${capture.id} seq ${cycle.attackSeq} rendered onset`,
        ).toBeLessThanOrEqual(MAX_ONSET_FRAMES);
        expect(
          cycle.acceptedOnsetMs,
          `${capture.id} seq ${cycle.attackSeq} authority-relative onset`,
        ).toBeLessThanOrEqual(MAX_ONSET_MS);
        expect(
          cycle.returnErrorPx,
          `${capture.id} seq ${cycle.attackSeq} hand return`,
        ).toBeLessThanOrEqual(1.25);
        expect(
          cycle.supportVisibleAboveArt,
          `${capture.id} seq ${cycle.attackSeq} hand layer`,
        ).toBe(true);
        expect(cycle.supportOverlapsArt, `${capture.id} seq ${cycle.attackSeq} hand contact`).toBe(
          true,
        );
      }
      for (const cycle of fullySampled) {
        for (let phase = 1; phase < cycle.extremumIndices.length; phase++)
          expect(
            cycle.extremumIndices[phase],
            `${capture.id} seq ${cycle.attackSeq} strict BACK->DOWN->UP->FORWARD`,
          ).toBeGreaterThan(cycle.extremumIndices[phase - 1] ?? -1);
        for (const [phase, ratio] of [
          ["BACK", cycle.backBodyRatio],
          ["DOWN", cycle.downBodyRatio],
          ["UP", cycle.upBodyRatio],
          ["FORWARD", cycle.forwardBodyRatio],
        ] as const)
          expect(
            ratio,
            `${capture.id} seq ${cycle.attackSeq} ${phase} extremum`,
          ).toBeGreaterThanOrEqual(MIN_PHASE_BODY_RATIO);
      }
      assertMuzzleAndMotion(capture);
    }

    expect(sidewinder.cycles.length, "Sidewinder complete accepted cycles").toBeGreaterThanOrEqual(
      6,
    );
    expect(
      new Set(sidewinder.cycles.map((cycle) => cycle.mode)),
      "Sidewinder motion modes",
    ).toEqual(new Set<MotionMode>(["stationary", "strafing"]));
    expect(
      new Set(sidewinder.cycles.map((cycle) => cycle.movingHand)),
      "both Sidewinder hands",
    ).toEqual(new Set<HandIndex>([0, 1]));
    for (const cycle of sidewinder.cycles) {
      expect(cycle.authorityConfirmed, `Sidewinder seq ${cycle.attackSeq} authority`).toBe(true);
      expect(cycle.onsetMs, `Sidewinder seq ${cycle.attackSeq} onset`).toBeLessThanOrEqual(
        MAX_ONSET_MS,
      );
      expect(
        cycle.onsetFrames,
        `Sidewinder seq ${cycle.attackSeq} rendered onset`,
      ).toBeLessThanOrEqual(MAX_ONSET_FRAMES);
      expect(
        cycle.acceptedOnsetMs,
        `Sidewinder seq ${cycle.attackSeq} authority-relative onset`,
      ).toBeLessThanOrEqual(MAX_ONSET_MS);
      expect(
        cycle.movingTravelBodyRatio,
        `Sidewinder seq ${cycle.attackSeq} selected hand travel`,
      ).toBeGreaterThanOrEqual(MIN_DUAL_TRAVEL_BODY_RATIO);
      expect(
        cycle.otherTravelPx,
        `Sidewinder seq ${cycle.attackSeq} non-selected hand`,
      ).toBeLessThanOrEqual(0.5);
      expect(
        cycle.returnErrorPx,
        `Sidewinder seq ${cycle.attackSeq} hand return`,
      ).toBeLessThanOrEqual(1.25);
      expect(cycle.handVisibleAboveArt, `Sidewinder seq ${cycle.attackSeq} hand layer`).toBe(true);
      expect(cycle.handOverlapsArt, `Sidewinder seq ${cycle.attackSeq} hand contact`).toBe(true);
    }
    const orderedDual = [...sidewinder.cycles].sort((a, b) => a.attackSeq - b.attackSeq);
    for (let index = 1; index < orderedDual.length; index++) {
      const previous = orderedDual[index - 1];
      const current = orderedDual[index];
      if (previous && current && current.attackSeq === previous.attackSeq + 1)
        expect(
          current.movingHand,
          `Sidewinder seq ${current.attackSeq} alternates physical hand`,
        ).not.toBe(previous.movingHand);
    }
    assertMuzzleAndMotion(sidewinder);
  });
});
