import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { bootArena, runArenaSpec, waitForDevWeapon } from "../helpers/arena-harness.js";

const WEAPON_ID = "x2-coyote-trickster-s-sparkmitt";
const MIN_HAND_TRAVEL_RATIO = 0.4;
const HOLD_MS = 2_500;
const EVIDENCE_DIR = path.resolve(
  import.meta.dirname,
  "../../docs/owner-notes-audit-v7-evidence/glove",
);

interface Point {
  x: number;
  y: number;
}

interface GloveFrame {
  wallMs: number;
  sceneNow: number;
  attackSeq: number;
  rigAttackSeq: number;
  swingStart: number;
  swingStyle?: string;
  swingHand: 0 | 1 | "both";
  comboStep?: number;
  fireHeld: boolean;
  frontWeapon?: Point;
  backWeapon?: Point;
  frontHand?: Point & { visible: boolean };
  backHand?: Point & { visible: boolean };
  bodyRotation: number;
  bodyX: number;
  bodyY: number;
  characterWidth: number;
  selfX: number;
  selfY: number;
}

interface PunchTravel {
  key: string;
  hand: 0 | 1;
  frames: number;
  wallSpanMs: number;
  travelPx: number;
  characterWidth: number;
  travelRatio: number;
}

interface FrameTravel {
  fromWallMs: number;
  toWallMs: number;
  frameMs: number;
  frontPx: number;
  backPx: number;
  frontRatio: number;
  backRatio: number;
}

interface BrowserAnimationState extends Record<string, unknown> {
  fireHeld?: boolean;
}

interface BrowserSwingDescriptor extends Record<string, unknown> {
  style?: string;
  comboStep?: number;
}

interface PhasePunchSample {
  hand: 0 | 1;
  frames: {
    sceneNow: number;
    frontWeapon?: Point;
    backWeapon?: Point;
    frontHand?: Point;
    backHand?: Point;
    bodyRotation: number;
    bodyX: number;
    bodyY: number;
    characterWidth: number;
  }[];
}

interface BrowserRig {
  equipWeapon(...args: unknown[]): unknown;
  animate(timeMs: number, anim: BrowserAnimationState): unknown;
  triggerSwing(
    timeMs: number,
    aimWorld?: number,
    swing?: BrowserSwingDescriptor,
    handOverride?: 0 | 1 | "both",
  ): void;
  __v7GloveOriginalEquipWeapon?: (...args: unknown[]) => unknown;
  __v7GloveOriginalAnimate?: (timeMs: number, anim: BrowserAnimationState) => unknown;
  weapons: { img?: Point }[];
  hands: { front: boolean; img: Point & { visible: boolean } }[];
  body: Point & { rotation: number; displayWidth: number };
  attackBeatSeq: number;
  swingStart: number;
  swing?: BrowserSwingDescriptor;
  swingHand: 0 | 1 | "both";
  swingAimWorld: number;
}

interface BrowserArena {
  verbs?: {
    isLegendOpen?(): boolean;
    toggleLegend?(timeMs: number): void;
    releaseInputLatchIf?(force: boolean): void;
  };
  time: { now: number };
  game: { hasFocus: boolean };
  pointerOverInteractiveUi: boolean;
  blobs: { get(id: string): BrowserRig | undefined };
  room: {
    sessionId: string;
    state: {
      players: {
        get(id: string): { attackSeq: number; x: number; y: number; alive?: boolean } | undefined;
      };
    };
  };
  input: { activePointer: { rightButtonDown: () => boolean } };
  stepNetInput?(elapsedMs: number, up: boolean, down: boolean, x: number, y: number): void;
}

interface GloveBrowserGlobal {
  ddGame: { scene: { getScene(key: string): BrowserArena } };
  __v7GloveFrames?: GloveFrame[];
  __v7GloveEquipCalls?: number;
  __v7GloveInput?: number;
  __v7GloveVisualInput?: number;
  __v7GloveLastAnim?: BrowserAnimationState;
}

function distance(a: Point | undefined, b: Point | undefined): number {
  return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
}

function peakTravel<T extends { frontWeapon?: Point; backWeapon?: Point }>(
  frames: readonly T[],
  key: "frontWeapon" | "backWeapon",
): number {
  let peak = 0;
  for (let i = 0; i < frames.length; i++) {
    for (let j = i + 1; j < frames.length; j++) {
      peak = Math.max(peak, distance(frames[i]?.[key], frames[j]?.[key]));
    }
  }
  return peak;
}

function punchTravels(frames: readonly GloveFrame[]): PunchTravel[] {
  const groups = new Map<string, GloveFrame[]>();
  for (const frame of frames) {
    if (frame.swingStyle !== "punch" || frame.swingHand === "both") continue;
    const key = `${frame.swingStart}:${frame.swingHand}`;
    const group = groups.get(key) ?? [];
    group.push(frame);
    groups.set(key, group);
  }

  const result: PunchTravel[] = [];
  for (const [key, group] of groups) {
    const first = group[0];
    const last = group.at(-1);
    if (!first || !last || group.length < 3) continue;
    const wallSpanMs = last.wallMs - first.wallMs;
    if (wallSpanMs < 24) continue;
    const hand = first.swingHand as 0 | 1;
    const travelPx = peakTravel(group, hand === 0 ? "frontWeapon" : "backWeapon");
    const characterWidth = Math.max(...group.map((frame) => frame.characterWidth));
    result.push({
      key,
      hand,
      frames: group.length,
      wallSpanMs,
      travelPx,
      characterWidth,
      travelRatio: travelPx / characterWidth,
    });
  }
  return result;
}

function frameTravels(frames: readonly GloveFrame[]): FrameTravel[] {
  const result: FrameTravel[] = [];
  for (let index = 1; index < frames.length; index++) {
    const previous = frames[index - 1];
    const current = frames[index];
    if (!previous || !current) continue;
    const characterWidth = Math.max(previous.characterWidth, current.characterWidth);
    const frontPx = distance(previous.frontWeapon, current.frontWeapon);
    const backPx = distance(previous.backWeapon, current.backWeapon);
    result.push({
      fromWallMs: previous.wallMs,
      toWallMs: current.wallMs,
      frameMs: current.wallMs - previous.wallMs,
      frontPx,
      backPx,
      frontRatio: frontPx / characterWidth,
      backRatio: backPx / characterWidth,
    });
  }
  return result;
}

test("held glove combo visibly alternates both moving fists", async ({ page }) => {
  test.setTimeout(120_000);
  await runArenaSpec(page, async (baseURL) => {
    await mkdir(EVIDENCE_DIR, { recursive: true });
    // Keep the mounted live rig inexpensive enough to sample under software-rendered CI.
    await page.setViewportSize({ width: 640, height: 360 });
    await bootArena(page, baseURL, `weapon:${WEAPON_ID}`);
    await waitForDevWeapon(page, WEAPON_ID);
    const canvas = page.locator("#game-root canvas");
    await canvas.click({ position: { x: 320, y: 180 } });
    // Training enemies spawn below the player. Aim into the open right lane so hit-stop cannot hide frames.
    await page.mouse.move(600, 175);
    // The shared developer stack may still finish its first dependency crawl after arena entry.
    await page.waitForTimeout(1_500);

    await page.evaluate(() => {
      const holder = globalThis as unknown as GloveBrowserGlobal;
      const arena = holder.ddGame.scene.getScene("arena");
      if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend(arena.time.now);
      arena.verbs?.releaseInputLatchIf?.(true);
      arena.game.hasFocus = true;
      arena.pointerOverInteractiveUi = false;
      const rig = arena.blobs.get(arena.room.sessionId);
      if (!rig) throw new Error("live glove rig was not mounted");
      holder.__v7GloveFrames = [];
      holder.__v7GloveEquipCalls = 0;

      if (!rig.__v7GloveOriginalEquipWeapon) {
        rig.__v7GloveOriginalEquipWeapon = rig.equipWeapon;
        rig.equipWeapon = function v7GloveEquipWeapon(this: BrowserRig, ...args: unknown[]) {
          holder.__v7GloveEquipCalls = (holder.__v7GloveEquipCalls ?? 0) + 1;
          return this.__v7GloveOriginalEquipWeapon?.apply(this, args);
        };
      }
      if (!rig.__v7GloveOriginalAnimate) {
        rig.__v7GloveOriginalAnimate = rig.animate;
        rig.animate = function v7GloveAnimate(
          this: BrowserRig,
          timeMs: number,
          anim: BrowserAnimationState,
        ) {
          const result = this.__v7GloveOriginalAnimate?.call(this, timeMs, anim);
          holder.__v7GloveLastAnim = anim;
          const self = arena.room.state.players.get(arena.room.sessionId);
          const frontWeapon = this.weapons[0]?.img;
          const backWeapon = this.weapons[1]?.img;
          const frontHand = this.hands.find((hand) => hand.front)?.img;
          const backHand = this.hands.find((hand) => !hand.front)?.img;
          holder.__v7GloveFrames?.push({
            wallMs: performance.now(),
            sceneNow: timeMs,
            attackSeq: self?.attackSeq ?? 0,
            rigAttackSeq: this.attackBeatSeq ?? 0,
            swingStart: this.swingStart,
            swingStyle: this.swing?.style,
            swingHand: this.swingHand,
            comboStep: this.swing?.comboStep,
            fireHeld: anim.fireHeld === true,
            frontWeapon: frontWeapon ? { x: frontWeapon.x, y: frontWeapon.y } : undefined,
            backWeapon: backWeapon ? { x: backWeapon.x, y: backWeapon.y } : undefined,
            frontHand: frontHand
              ? { x: frontHand.x, y: frontHand.y, visible: frontHand.visible }
              : undefined,
            backHand: backHand
              ? { x: backHand.x, y: backHand.y, visible: backHand.visible }
              : undefined,
            bodyRotation: this.body.rotation,
            bodyX: this.body.x,
            bodyY: this.body.y,
            characterWidth: Math.max(1, this.body.displayWidth),
            selfX: self?.x ?? 0,
            selfY: self?.y ?? 0,
          });
          return result;
        };
      }
    });

    const idlePath = path.join(EVIDENCE_DIR, "after-idle.png");
    await page.screenshot({ path: idlePath, fullPage: true });
    const startSeq = await page.evaluate(() => {
      const holder = globalThis as unknown as GloveBrowserGlobal;
      const arena = holder.ddGame.scene.getScene("arena");
      const self = arena.room.state.players.get(arena.room.sessionId);
      holder.__v7GloveFrames = [];
      arena.input.activePointer.rightButtonDown = () => true;
      holder.__v7GloveInput = window.setInterval(
        () => arena.stepNetInput?.(50, false, false, 0, 0),
        50,
      );
      return self.attackSeq as number;
    });

    // Keep screenshots out of the measured window: software-rendered CI can stall RAF while encoding a
    // frame, which would corrupt the natural held-cadence and body-drive record.
    await page.waitForTimeout(HOLD_MS);

    const captured = await page.evaluate(() => {
      const holder = globalThis as unknown as GloveBrowserGlobal;
      const arena = holder.ddGame.scene.getScene("arena");
      arena.input.activePointer.rightButtonDown = () => false;
      arena.stepNetInput?.(50, false, false, 0, 0);
      if (holder.__v7GloveInput) window.clearInterval(holder.__v7GloveInput);
      const frames = [...(holder.__v7GloveFrames ?? [])];
      return {
        frames,
        equipCalls: holder.__v7GloveEquipCalls ?? 0,
      };
    });

    // Replay the same live held input for the human-readable after frames. These do not participate in
    // the displacement gate above, so image encoding cannot alter the measured punch samples.
    await page.evaluate(() => {
      const holder = globalThis as unknown as GloveBrowserGlobal;
      const arena = holder.ddGame.scene.getScene("arena");
      arena.input.activePointer.rightButtonDown = () => true;
      holder.__v7GloveVisualInput = window.setInterval(
        () => arena.stepNetInput?.(50, false, false, 0, 0),
        50,
      );
    });
    await page.waitForTimeout(420);
    const earlyPath = path.join(EVIDENCE_DIR, "after-held-0420ms.png");
    await page.screenshot({ path: earlyPath, fullPage: true });
    await page.waitForTimeout(HOLD_MS - 420);
    const heldPath = path.join(EVIDENCE_DIR, "after-held-2500ms.png");
    await page.screenshot({ path: heldPath, fullPage: true });
    await page.evaluate(() => {
      const holder = globalThis as unknown as GloveBrowserGlobal;
      const arena = holder.ddGame.scene.getScene("arena");
      arena.input.activePointer.rightButtonDown = () => false;
      arena.stepNetInput?.(50, false, false, 0, 0);
      if (holder.__v7GloveVisualInput) window.clearInterval(holder.__v7GloveVisualInput);
    });

    const phaseSamples = await page.evaluate(() => {
      const holder = globalThis as unknown as GloveBrowserGlobal;
      const arena = holder.ddGame.scene.getScene("arena");
      const rig = arena.blobs.get(arena.room.sessionId);
      const descriptor = rig?.swing ? { ...rig.swing } : undefined;
      const lastAnim = holder.__v7GloveLastAnim;
      const samples: PhasePunchSample[] = [];
      if (!rig || !descriptor || !lastAnim || !rig.__v7GloveOriginalAnimate) return samples;
      const sampleTimes = [0, 24, 48, 72, 96, 120, 144, 168, 192, 216, 239];
      for (const hand of [0, 1] as const) {
        rig.triggerSwing(arena.time.now, rig.swingAimWorld, descriptor, hand);
        const swingStart = rig.swingStart;
        const sample: PhasePunchSample = { hand, frames: [] };
        for (const deltaMs of sampleTimes) {
          const sceneNow = swingStart + deltaMs;
          rig.__v7GloveOriginalAnimate.call(rig, sceneNow, lastAnim);
          const frontWeapon = rig.weapons[0]?.img;
          const backWeapon = rig.weapons[1]?.img;
          const frontHand = rig.hands.find((candidate) => candidate.front)?.img;
          const backHand = rig.hands.find((candidate) => !candidate.front)?.img;
          sample.frames.push({
            sceneNow,
            frontWeapon: frontWeapon ? { x: frontWeapon.x, y: frontWeapon.y } : undefined,
            backWeapon: backWeapon ? { x: backWeapon.x, y: backWeapon.y } : undefined,
            frontHand: frontHand ? { x: frontHand.x, y: frontHand.y } : undefined,
            backHand: backHand ? { x: backHand.x, y: backHand.y } : undefined,
            bodyRotation: rig.body.rotation,
            bodyX: rig.body.x,
            bodyY: rig.body.y,
            characterWidth: Math.max(1, rig.body.displayWidth),
          });
        }
        samples.push(sample);
      }
      return samples;
    });

    const frames = captured.frames;
    const first = frames[0];
    const last = frames.at(-1);
    expect(first, "held capture must contain rendered frames").toBeDefined();
    expect(last, "held capture must contain a final rendered frame").toBeDefined();
    if (!first || !last) throw new Error("held glove capture was empty");

    const naturalPunches = punchTravels(frames);
    const perFrameTravel = frameTravels(frames);
    const acceptedHandOrder: (0 | 1)[] = [];
    let previousBeatKey = "";
    for (const frame of frames) {
      if (frame.swingStyle !== "punch" || frame.swingHand === "both") continue;
      const beatKey = `${frame.swingStart}:${frame.swingHand}`;
      if (beatKey === previousBeatKey) continue;
      previousBeatKey = beatKey;
      acceptedHandOrder.push(frame.swingHand);
    }
    const phasePunches = phaseSamples.map((sample) => {
      const weaponKey = sample.hand === 0 ? "frontWeapon" : "backWeapon";
      const travelPx = peakTravel(sample.frames, weaponKey);
      const characterWidth = Math.max(...sample.frames.map((frame) => frame.characterWidth));
      return {
        hand: sample.hand,
        travelPx,
        characterWidth,
        travelRatio: travelPx / characterWidth,
      };
    });
    const leadPeakRatio = phasePunches.find((punch) => punch.hand === 0)?.travelRatio ?? 0;
    const rearPeakRatio = phasePunches.find((punch) => punch.hand === 1)?.travelRatio ?? 0;
    const peakTravelRatio = Math.max(leadPeakRatio, rearPeakRatio);
    const bodyRotationSpan =
      Math.max(...frames.map((frame) => frame.bodyRotation)) -
      Math.min(...frames.map((frame) => frame.bodyRotation));
    const worldDrift = Math.hypot(last.selfX - first.selfX, last.selfY - first.selfY);
    let visibleForwardStep = 0;
    for (let i = 0; i < frames.length; i++) {
      for (let j = i + 1; j < frames.length; j++) {
        const a = frames[i];
        const b = frames[j];
        if (!a || !b) continue;
        visibleForwardStep = Math.max(
          visibleForwardStep,
          Math.hypot(a.bodyX - b.bodyX, a.bodyY - b.bodyY),
        );
      }
    }
    const frontAnchorDelta = Math.max(
      ...frames.map((frame) => distance(frame.frontWeapon, frame.frontHand)),
    );
    const backAnchorDelta = Math.max(
      ...frames.map((frame) => distance(frame.backWeapon, frame.backHand)),
    );
    const acceptedBeats = last.attackSeq - startSeq;
    const wallCaptureMs = last.wallMs - first.wallMs;
    const assertions = {
      capturedTwoSeconds: wallCaptureMs >= 2_000,
      continuousCadence: acceptedBeats >= 8,
      acceptedHandAlternation:
        acceptedHandOrder.length >= 8 &&
        acceptedHandOrder.every(
          (hand, index) => index === 0 || hand !== acceptedHandOrder[index - 1],
        ),
      noReequipReset: captured.equipCalls === 0,
      receiverHandsHidden:
        frames.every((frame) => frame.frontHand?.visible === false) &&
        frames.every((frame) => frame.backHand?.visible === false),
      glovesFollowDrivenHands: frontAnchorDelta <= 0.01 && backAnchorDelta <= 0.01,
      leadTravel: leadPeakRatio >= MIN_HAND_TRAVEL_RATIO,
      rearTravel: rearPeakRatio >= MIN_HAND_TRAVEL_RATIO,
      everySampledPunchTravels:
        phasePunches.length === 2 &&
        phasePunches.every((punch) => punch.travelRatio >= MIN_HAND_TRAVEL_RATIO),
      bodyRotation: bodyRotationSpan >= 0.12,
      forwardDrift: visibleForwardStep >= 3,
    };
    const evidence = {
      weaponId: WEAPON_ID,
      baseURL,
      capturedAt: new Date().toISOString(),
      threshold: MIN_HAND_TRAVEL_RATIO,
      wallCaptureMs,
      acceptedBeats,
      equipCallsDuringHold: captured.equipCalls,
      peakTravelRatio,
      leadPeakRatio,
      rearPeakRatio,
      bodyRotationSpan,
      worldDrift,
      visibleForwardStep,
      frontAnchorDelta,
      backAnchorDelta,
      assertions,
      acceptedHandOrder,
      phasePunches,
      phaseSamples,
      naturalPunches,
      maxPerFrameTravel: {
        frontPx: Math.max(0, ...perFrameTravel.map((frame) => frame.frontPx)),
        backPx: Math.max(0, ...perFrameTravel.map((frame) => frame.backPx)),
        frontRatio: Math.max(0, ...perFrameTravel.map((frame) => frame.frontRatio)),
        backRatio: Math.max(0, ...perFrameTravel.map((frame) => frame.backRatio)),
      },
      perFrameTravel,
      screenshots: [idlePath, earlyPath, heldPath].map((file) =>
        path.relative(process.cwd(), file),
      ),
      frames,
    };
    await writeFile(
      path.join(EVIDENCE_DIR, "after-live-capture.json"),
      `${JSON.stringify(evidence, null, 2)}\n`,
    );

    expect(
      assertions,
      `live glove gate: peak ${peakTravelRatio.toFixed(3)} vs ${MIN_HAND_TRAVEL_RATIO}`,
    ).toEqual({
      capturedTwoSeconds: true,
      continuousCadence: true,
      acceptedHandAlternation: true,
      noReequipReset: true,
      receiverHandsHidden: true,
      glovesFollowDrivenHands: true,
      leadTravel: true,
      rearTravel: true,
      everySampledPunchTravels: true,
      bodyRotation: true,
      forwardDrift: true,
    });
  });
});
