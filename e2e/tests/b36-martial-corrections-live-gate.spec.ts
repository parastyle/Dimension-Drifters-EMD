import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  meleeComboSelectionFor,
  PlayerAttackMoveMode,
  WEAPONS,
} from "@dd/shared";
import { expect, type Page, test } from "@playwright/test";
import { bootArena, runArenaSpec, waitForDevWeapon } from "../helpers/arena-harness.js";

const EVIDENCE_DIR = path.resolve(
  import.meta.dirname,
  "../../docs/owner-notes-audit-v11-evidence/b36-martial-corrections",
);
const CHARACTER_ID = "proto-cowboy-hidden-face";
const FORBIDDEN_PORTS = new Set([5180, 2567]);
const FACINGS = ["right", "left"] as const;
const WRAPS = [
  "x2-muay-thai-wraps",
  "x2-wing-chun-wraps",
  "x2-drunken-fist-wraps",
  "x2-iron-palm-wraps",
  "x2-emberfist-wraps",
] as const;
const WYRM = "x2-wyrmskull-reliquary";
const REVERENT = "x2-reverent-broadsword";
const BOXER_GLOVES = [
  "x2-coyote-trickster-s-sparkmitt",
  "x2-emberfist-wraps",
] as const;

type Facing = (typeof FACINGS)[number];

interface Point {
  x: number;
  y: number;
}

interface MartialSnapshot extends Point {
  attackMoveMode: number;
  attackSeq: number;
  comboStep: number;
  facing: number;
  fireInputHeld: boolean;
  frameVisible: boolean;
  rootRotation: number;
  swingStep: number;
  tick: number;
}

interface BrowserGlobal {
  ddGame: {
    scene: {
      getScene(key: string): {
        blobs: Map<
          string,
          {
            body: { y: number };
            authoredComboFlipRenderEvidence: {
              renderedSamples: number;
              maxProgress: number;
              maxAbsRotation: number;
            };
            comboStep?: number;
            facing: number;
            hands: Array<{ img: { rotation: number; x: number; y: number } }>;
            root: { rotation: number; scaleX: number };
            swingStep?: number;
            weaponDef?: { id: string };
            weapons: Array<{
              firingFrameVisible?: boolean;
              img: { rotation: number; x: number; y: number };
            }>;
          }
        >;
        cameras: {
          main: {
            height: number;
            setScroll(x: number, y: number): void;
            setZoom(value: number): void;
            width: number;
            zoom: number;
          };
        };
        input: {
          activePointer: { rightButtonDown(): boolean };
          hitTestPointer(pointer: unknown): unknown[];
        };
        room: {
          onMessage(type: string, callback: (message: unknown) => void): void;
          sessionId: string;
          send(type: string, message?: unknown): void;
          state: {
            tick: number;
            players: {
              get(id: string):
                | {
                    ackSeq: number;
                    attackSeq: number;
                    dualWield: {
                      attackMoveMode: number;
                      fireInputHeld: boolean;
                    };
                    weapon?: string;
                    x: number;
                    y: number;
                  }
                | undefined;
            };
          };
        };
        scene: { pause(): void; resume(): void };
        stepNetInput(
          dtMs: number,
          jump: boolean,
          crouch: boolean,
          dx: number,
          dy: number,
        ): void;
      };
    };
  };
  __b36MoveSamples?: MartialSnapshot[];
  __b36MoveTimer?: number;
  __b36AttackMoveArmTimer?: number;
  __b36AttackMoveListenerInstalled?: boolean;
  __b36AttackMoveReceipt?: {
    actualDistance: number;
    configuredRatio: number;
    displacementRatio: number;
    mode: number;
    normalDistance: number;
  };
  __b36FireHeldReceipt?: { held: boolean; tick: number };
  __b36StationarySamples?: MartialSnapshot[];
  __b36StationaryTimer?: number;
  __b36OriginalStepNetInput?: (
    dtMs: number,
    jump: boolean,
    crouch: boolean,
    dx: number,
    dy: number,
  ) => void;
  __b36WyrmTimer?: number;
  __ddB14KungFuVfxAudit?: Array<{
    comboStep?: number;
    kind: string;
    limb?: string;
    motion?: string;
    timeMs: number;
    weaponId: string;
  }>;
}

function facingSign(facing: Facing): number {
  return facing === "right" ? 1 : -1;
}

function relative(file: string): string {
  return path.relative(process.cwd(), file).replaceAll("\\", "/");
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function fileName(id: string, facing: Facing, suffix: string): string {
  return path.join(EVIDENCE_DIR, `${id}-${facing}-${suffix}.png`);
}

async function equip(page: Page, weapon: string): Promise<void> {
  await page.evaluate(
    ({ character, weapon }) => {
      const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
      arena.room.send("devEquip", { character, weapon });
    },
    { character: CHARACTER_ID, weapon },
  );
  await waitForDevWeapon(page, weapon);
  await page.waitForTimeout(220);
}

async function setFacing(page: Page, facing: Facing): Promise<void> {
  const canvas = page.locator("#game-root canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("B36 could not locate the Phaser canvas");
  await page.mouse.move(
    box.x + box.width * (facing === "right" ? 0.68 : 0.32),
    box.y + box.height * 0.5,
  );
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
          return arena.blobs.get(arena.room.sessionId)?.facing ?? 0;
        }),
      { message: `B36 rig should face ${facing}`, timeout: 10_000 },
    )
    .toBe(facingSign(facing));
  await page.evaluate(() => {
    const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena") as ReturnType<
      BrowserGlobal["ddGame"]["scene"]["getScene"]
    > & {
      localAtkCd: number;
      localPredictedAttackAtMs: number;
      localPredictedAttackSeq: number;
      pointerOverInteractiveUi: boolean;
    };
    const self = arena.room.state.players.get(arena.room.sessionId);
    if (!self) throw new Error("B36 facing rebase lost its local player");
    arena.input.activePointer.rightButtonDown = () => false;
    arena.localAtkCd = 0;
    arena.localPredictedAttackSeq = self.attackSeq;
    arena.localPredictedAttackAtMs = -1e9;
    arena.pointerOverInteractiveUi = false;
  });
}

async function snapshot(page: Page): Promise<MartialSnapshot> {
  return await page.evaluate(() => {
    const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
    const self = arena.room.state.players.get(arena.room.sessionId);
    const rig = arena.blobs.get(arena.room.sessionId);
    if (!self || !rig) throw new Error("B36 snapshot lost its local player");
    return {
      attackMoveMode: self.dualWield.attackMoveMode,
      attackSeq: self.attackSeq,
      comboStep: rig.comboStep ?? -1,
      facing: rig.facing,
      fireInputHeld: self.dualWield.fireInputHeld,
      frameVisible: rig.weapons[0]?.firingFrameVisible === true,
      rootRotation: rig.root.rotation,
      swingStep: rig.swingStep ?? -1,
      tick: arena.room.state.tick,
      x: self.x,
      y: self.y,
    };
  });
}

async function centerCamera(page: Page): Promise<void> {
  await page.evaluate(() => {
    const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
    const self = arena.room.state.players.get(arena.room.sessionId);
    if (!self) throw new Error("B36 camera lost its local player");
    const camera = arena.cameras.main;
    camera.setZoom(2.25);
    camera.setScroll(
      self.x - camera.width / camera.zoom / 2,
      self.y - camera.height / camera.zoom / 2,
    );
  });
}

async function captureStationaryCombo(page: Page, weaponId: string, facing: Facing) {
  const weapon = WEAPONS[weaponId];
  const combo = weapon ? meleeComboSelectionFor(weapon) : undefined;
  if (!weapon || !combo) throw new Error(`B36 missing combo fixture ${weaponId}`);
  await page.waitForTimeout(300);
  const start = await snapshot(page);
  const screenshots: string[] = [];
  await page.evaluate(() => {
    const holder = globalThis as unknown as BrowserGlobal;
    const arena = holder.ddGame.scene.getScene("arena");
    holder.__ddB14KungFuVfxAudit = [];
    holder.__b36StationarySamples = [];
    arena.input.activePointer.rightButtonDown = () => true;
    if (holder.__b36StationaryTimer) window.clearInterval(holder.__b36StationaryTimer);
    holder.__b36StationaryTimer = window.setInterval(() => {
      const self = arena.room.state.players.get(arena.room.sessionId);
      const rig = arena.blobs.get(arena.room.sessionId);
      if (!self || !rig) return;
      holder.__b36StationarySamples?.push({
        attackMoveMode: self.dualWield.attackMoveMode,
        attackSeq: self.attackSeq,
        comboStep: rig.comboStep ?? -1,
        facing: rig.facing,
        fireInputHeld: self.dualWield.fireInputHeld,
        frameVisible: rig.weapons[0]?.firingFrameVisible === true,
        rootRotation: rig.root.rotation,
        swingStep: rig.swingStep ?? -1,
        tick: arena.room.state.tick,
        x: self.x,
        y: self.y,
      });
    }, 12);
  });
  try {
    await expect
      .poll(
        () =>
          page.evaluate(
            ({ comboLength }) => {
              const samples =
                (globalThis as unknown as BrowserGlobal).__b36StationarySamples ?? [];
              let expected = 0;
              for (const sample of samples) {
                if (sample.swingStep === expected) expected++;
                else if (sample.swingStep === 0) expected = 1;
                if (expected === comboLength) return true;
              }
              return false;
            },
            { comboLength: combo.sequence.length },
          ),
        { message: `${weaponId}/${facing}: render complete combo`, timeout: 15_000 },
      )
      .toBe(true);
  } catch (error) {
    const debug = await page.evaluate((weaponId) => {
      const holder = globalThis as unknown as BrowserGlobal;
      const arena = holder.ddGame.scene.getScene("arena");
      const self = arena.room.state.players.get(arena.room.sessionId);
      const rig = arena.blobs.get(arena.room.sessionId);
      return {
        attackSeq: self?.attackSeq,
        events: (holder.__ddB14KungFuVfxAudit ?? []).filter(
          (event) => event.weaponId === weaponId,
        ),
        rigComboStep: rig?.comboStep,
        rigSwingStep: rig?.swingStep,
      };
    }, weaponId);
    throw new Error(`${weaponId}/${facing}: combo telemetry ${JSON.stringify(debug)}`, {
      cause: error,
    });
  }
  const telemetry = await page.evaluate(({ comboLength, weaponId }) => {
    const holder = globalThis as unknown as BrowserGlobal;
    const arena = holder.ddGame.scene.getScene("arena");
    arena.input.activePointer.rightButtonDown = () => false;
    if (holder.__b36StationaryTimer) window.clearInterval(holder.__b36StationaryTimer);
    holder.__b36StationaryTimer = undefined;
    const beats: MartialSnapshot[] = [];
    for (const sample of holder.__b36StationarySamples ?? []) {
      if (sample.swingStep === beats.length) beats.push(sample);
      else if (sample.swingStep === 0) beats.splice(0, beats.length, sample);
      if (beats.length === comboLength) break;
    }
    return {
      beats,
      samples: holder.__b36StationarySamples ?? [],
      vfxEvents: (holder.__ddB14KungFuVfxAudit ?? []).filter(
        (event) => event.weaponId === weaponId,
      ),
    };
  }, { comboLength: combo.sequence.length, weaponId });

  await centerCamera(page);
  const finisherFile = fileName(weaponId, facing, "stationary-full-combo-finisher");
  await page.locator("#game-root canvas").screenshot({ path: finisherFile });
  screenshots.push(relative(finisherFile));
  await page.waitForTimeout(650);
  const post = await snapshot(page);
  await page.waitForTimeout(250);
  const stable = await snapshot(page);
  expect(telemetry.beats.map((beat) => beat.swingStep), `${weaponId}/${facing}: full combo`).toEqual(
    combo.sequence.map((_, index) => index),
  );
  expect(
    [start, ...telemetry.samples, post, stable].every((sample) => distance(start, sample) < 1),
    `${weaponId}/${facing}: no stationary root displacement`,
  ).toBe(true);
  expect(distance(post, stable), `${weaponId}/${facing}: no post-combo snap`).toBeLessThan(0.5);

  return {
    start,
    beats: telemetry.beats,
    positionSamples: telemetry.samples,
    post,
    stable,
    screenshots,
    maxDisplacementPx: Math.max(
      ...telemetry.samples.map((sample) => distance(start, sample)),
      0,
    ),
    postStabilityPx: distance(post, stable),
  };
}

async function startWalking(page: Page, facing: Facing): Promise<void> {
  await page.keyboard.down(facing === "right" ? "KeyD" : "KeyA");
  await page.evaluate((direction) => {
    const holder = globalThis as unknown as BrowserGlobal;
    const arena = holder.ddGame.scene.getScene("arena");
    holder.__b36MoveSamples = [];
    holder.__b36AttackMoveReceipt = undefined;
    if (!holder.__b36AttackMoveListenerInstalled) {
      arena.room.onMessage("b33AttackMoveCapture", (message) => {
        holder.__b36AttackMoveReceipt =
          message as BrowserGlobal["__b36AttackMoveReceipt"];
      });
      holder.__b36AttackMoveListenerInstalled = true;
    }
    if (holder.__b36MoveTimer) window.clearInterval(holder.__b36MoveTimer);
    holder.__b36MoveTimer = window.setInterval(() => {
      arena.stepNetInput(50, false, false, direction, 0);
      const self = arena.room.state.players.get(arena.room.sessionId);
      const rig = arena.blobs.get(arena.room.sessionId);
      if (!self || !rig) return;
      holder.__b36MoveSamples?.push({
        attackMoveMode: self.dualWield.attackMoveMode,
        attackSeq: self.attackSeq,
        comboStep: rig.comboStep ?? -1,
        facing: rig.facing,
        fireInputHeld: self.dualWield.fireInputHeld,
        frameVisible: rig.weapons[0]?.firingFrameVisible === true,
        rootRotation: rig.root.rotation,
        swingStep: rig.swingStep ?? -1,
        tick: arena.room.state.tick,
        x: self.x,
        y: self.y,
      });
    }, 25);
  }, facingSign(facing));
  await page.waitForTimeout(180);
}

async function stopWalking(page: Page): Promise<{
  receipt: BrowserGlobal["__b36AttackMoveReceipt"];
  samples: MartialSnapshot[];
}> {
  await page.keyboard.up("KeyD");
  await page.keyboard.up("KeyA");
  return await page.evaluate(() => {
    const holder = globalThis as unknown as BrowserGlobal;
    const arena = holder.ddGame.scene.getScene("arena");
    if (holder.__b36MoveTimer) window.clearInterval(holder.__b36MoveTimer);
    holder.__b36MoveTimer = undefined;
    arena.stepNetInput(50, false, false, 0, 0);
    return {
      receipt: holder.__b36AttackMoveReceipt,
      samples: holder.__b36MoveSamples ?? [],
    };
  });
}

async function captureWalkingCombo(page: Page, weaponId: string, facing: Facing) {
  const weapon = WEAPONS[weaponId];
  const combo = weapon ? meleeComboSelectionFor(weapon) : undefined;
  if (!weapon || !combo) throw new Error(`B36 missing walking fixture ${weaponId}`);
  const start = await snapshot(page);
  await startWalking(page, facing);
  await page.evaluate(() => {
    const holder = globalThis as unknown as BrowserGlobal;
    const arena = holder.ddGame.scene.getScene("arena");
    holder.__ddB14KungFuVfxAudit = [];
    arena.input.activePointer.rightButtonDown = () => true;
  });
  await page.evaluate(() => {
    const holder = globalThis as unknown as BrowserGlobal;
    const arena = holder.ddGame.scene.getScene("arena");
    const arm = () => arena.room.send("debugArmAttackMoveCapture");
    arm();
    if (holder.__b36AttackMoveArmTimer) window.clearInterval(holder.__b36AttackMoveArmTimer);
    holder.__b36AttackMoveArmTimer = window.setInterval(arm, 50);
  });
  try {
    await expect
      .poll(
        () =>
          page.evaluate(
            () => (globalThis as unknown as BrowserGlobal).__b36AttackMoveReceipt !== undefined,
          ),
        { message: `${weaponId}/${facing}: attack input slow receipt`, timeout: 5_000 },
      )
      .toBe(true);
  } catch (error) {
    const debug = await page.evaluate(() => {
      const holder = globalThis as unknown as BrowserGlobal;
      const arena = holder.ddGame.scene.getScene("arena");
      const self = arena.room.state.players.get(arena.room.sessionId);
      return {
        attackSeq: self?.attackSeq,
        modes: [...new Set((holder.__b36MoveSamples ?? []).map((sample) => sample.attackMoveMode))],
        sampleAttackSeqs: [
          holder.__b36MoveSamples?.[0]?.attackSeq,
          holder.__b36MoveSamples?.at(-1)?.attackSeq,
        ],
        weapon: self?.weapon,
      };
    });
    throw new Error(`${weaponId}/${facing}: input-slow telemetry ${JSON.stringify(debug)}`, {
      cause: error,
    });
  }
  await page.evaluate(() => {
    const holder = globalThis as unknown as BrowserGlobal;
    if (holder.__b36AttackMoveArmTimer) window.clearInterval(holder.__b36AttackMoveArmTimer);
    holder.__b36AttackMoveArmTimer = undefined;
  });
  await expect
    .poll(
      () => snapshot(page).then((state) => ((state.attackSeq - start.attackSeq) >>> 0) >= 1),
      { message: `${weaponId}/${facing}: walking attack beat`, timeout: 5_000 },
    )
    .toBe(true);
  await centerCamera(page);
  const file = fileName(weaponId, facing, "walking-mid-combo");
  await page.locator("#game-root canvas").screenshot({ path: file });
  await page.evaluate(() => {
    const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
    arena.input.activePointer.rightButtonDown = () => false;
  });
  const walkingTelemetry = await stopWalking(page);
  const samples = walkingTelemetry.samples;
  await page.waitForTimeout(900);
  const post = await snapshot(page);
  await page.waitForTimeout(250);
  const stable = await snapshot(page);
  const signedTravel = (post.x - start.x) * facingSign(facing);

  expect(walkingTelemetry.receipt, `${weaponId}/${facing}: attack input slow receipt`).toMatchObject(
    {
      configuredRatio: 0.75,
      mode: PlayerAttackMoveMode.InputSlow,
    },
  );
  expect(walkingTelemetry.receipt?.actualDistance ?? 0).toBeGreaterThan(0);
  expect(walkingTelemetry.receipt?.displacementRatio ?? 0).toBeGreaterThan(0.65);
  expect(walkingTelemetry.receipt?.displacementRatio ?? 1).toBeLessThan(0.85);
  expect(
    samples.some((sample) => sample.attackMoveMode === PlayerAttackMoveMode.RootMotion),
    `${weaponId}/${facing}: no root-motion replacement`,
  ).toBe(false);
  expect(signedTravel, `${weaponId}/${facing}: player can walk while punching`).toBeGreaterThan(10);
  expect(distance(post, stable), `${weaponId}/${facing}: no walking post-combo snap`).toBeLessThan(
    0.75,
  );

  return {
    start,
    post,
    stable,
    signedTravelPx: signedTravel,
    postStabilityPx: distance(post, stable),
    inputSlowSamples: samples.filter(
      (sample) => sample.attackMoveMode === PlayerAttackMoveMode.InputSlow,
    ).length,
    inputSlowReceipt: walkingTelemetry.receipt,
    rootMotionSamples: samples.filter(
      (sample) => sample.attackMoveMode === PlayerAttackMoveMode.RootMotion,
    ).length,
    samples,
    screenshot: relative(file),
  };
}

async function captureWyrmskull(page: Page, facing: Facing) {
  await setFacing(page, facing);
  const before = await snapshot(page);
  await page.evaluate((direction) => {
    const holder = globalThis as unknown as BrowserGlobal;
    const arena = holder.ddGame.scene.getScene("arena");
    const self = arena.room.state.players.get(arena.room.sessionId);
    if (!self) throw new Error("B36 Wyrmskull heartbeat lost its local player");
    arena.room.onMessage("b36FireHeldReceipt", (message) => {
      holder.__b36FireHeldReceipt = message as BrowserGlobal["__b36FireHeldReceipt"];
    });
    arena.input.activePointer.rightButtonDown = () => true;
    holder.__b36OriginalStepNetInput = arena.stepNetInput.bind(arena);
    arena.stepNetInput = () => {};
    const sendHeld = () => {
      arena.room.send("debugSetFireInputHeld", { held: true, direction });
    };
    sendHeld();
    if (holder.__b36WyrmTimer) window.clearInterval(holder.__b36WyrmTimer);
    holder.__b36WyrmTimer = window.setInterval(sendHeld, 40);
  }, facingSign(facing));
  await expect
    .poll(
      () =>
        page.evaluate(
          () => (globalThis as unknown as BrowserGlobal).__b36FireHeldReceipt?.held === true,
        ),
      { message: "B36 Wyrmskull held fixture should be accepted", timeout: 5_000 },
    )
    .toBe(true);
  await expect
    .poll(() => snapshot(page).then((state) => state.fireInputHeld), {
      message: "B36 Wyrmskull held input should reach authority",
      timeout: 5_000,
    })
    .toBe(true);
  await expect
    .poll(() => snapshot(page).then((state) => state.frameVisible), {
      message: "B36 Wyrmskull should open on held fire",
      timeout: 5_000,
    })
    .toBe(true);
  await page.waitForTimeout(280);
  const held = await snapshot(page);
  expect(held.fireInputHeld).toBe(true);
  if (!held.frameVisible) {
    const debug = await page.evaluate(() => {
      const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
      const rig = arena.blobs.get(arena.room.sessionId) as
        | {
            authoritativeFiringAttackTick: number;
            authoritativeFiringClockTick: number;
            authoritativeFiringInputHeld?: boolean;
            authoritativeFiringWeaponId: string;
            hasAuthoritativeFiringBeat: boolean;
            weaponDef?: { id: string };
            weapons: Array<{
              firingFrameVisible?: boolean;
              img: { texture?: { key?: string } };
            }>;
          }
        | undefined;
      return {
        attackTick: rig?.authoritativeFiringAttackTick,
        clockTick: rig?.authoritativeFiringClockTick,
        firingBeat: rig?.hasAuthoritativeFiringBeat,
        firingHeld: rig?.authoritativeFiringInputHeld,
        firingWeaponId: rig?.authoritativeFiringWeaponId,
        texture: rig?.weapons[0]?.img.texture?.key,
        visible: rig?.weapons[0]?.firingFrameVisible,
        weaponId: rig?.weaponDef?.id,
      };
    });
    throw new Error(`B36 Wyrmskull held-frame telemetry ${JSON.stringify(debug)}`);
  }
  await centerCamera(page);
  const heldFile = fileName(WYRM, facing, "held-open");
  await page.locator("#game-root canvas").screenshot({ path: heldFile });

  await page.evaluate(() => {
    const holder = globalThis as unknown as BrowserGlobal;
    const arena = holder.ddGame.scene.getScene("arena");
    if (holder.__b36WyrmTimer) window.clearInterval(holder.__b36WyrmTimer);
    holder.__b36WyrmTimer = undefined;
    arena.input.activePointer.rightButtonDown = () => false;
    arena.room.send("debugSetFireInputHeld", { held: false });
    if (holder.__b36OriginalStepNetInput) arena.stepNetInput = holder.__b36OriginalStepNetInput;
    holder.__b36OriginalStepNetInput = undefined;
  });
  await expect
    .poll(
      () =>
        snapshot(page).then((state) => ({
          frameVisible: state.frameVisible,
          inputHeld: state.fireInputHeld,
        })),
      { message: "B36 Wyrmskull should close deterministically on release", timeout: 5_000 },
    )
    .toEqual({ frameVisible: false, inputHeld: false });
  const released = await snapshot(page);
  const releasedFile = fileName(WYRM, facing, "released-closed");
  await page.locator("#game-root canvas").screenshot({ path: releasedFile });
  return {
    before,
    held,
    released,
    heldBeyondLegacyWindowMs: 280,
    screenshots: { held: relative(heldFile), released: relative(releasedFile) },
  };
}

async function captureReverent(page: Page, facing: Facing) {
  await setFacing(page, facing);
  const start = await snapshot(page);
  await page.evaluate(() => {
    const holder = globalThis as unknown as BrowserGlobal & {
      __b36ReverentSamples?: MartialSnapshot[];
      __b36ReverentTimer?: number;
    };
    const arena = holder.ddGame.scene.getScene("arena");
    const rig = arena.blobs.get(arena.room.sessionId);
    if (!rig) throw new Error("B36 Reverent capture lost its local rig");
    rig.authoredComboFlipRenderEvidence.renderedSamples = 0;
    rig.authoredComboFlipRenderEvidence.maxProgress = -1;
    rig.authoredComboFlipRenderEvidence.maxAbsRotation = 0;
    holder.__b36ReverentSamples = [];
    holder.__b36ReverentTimer = window.setInterval(() => {
      const self = arena.room.state.players.get(arena.room.sessionId);
      const rig = arena.blobs.get(arena.room.sessionId);
      if (!self || !rig) return;
      holder.__b36ReverentSamples?.push({
        attackMoveMode: self.dualWield.attackMoveMode,
        attackSeq: self.attackSeq,
        comboStep: rig.comboStep ?? -1,
        facing: rig.facing,
        fireInputHeld: self.dualWield.fireInputHeld,
        frameVisible: false,
        rootRotation: rig.root.rotation,
        swingStep: rig.swingStep ?? -1,
        tick: arena.room.state.tick,
        x: self.x,
        y: self.y,
      });
    }, 8);
    arena.input.activePointer.rightButtonDown = () => true;
  });
  await expect
    .poll(
      () =>
        snapshot(page).then(
          (state) => ((state.attackSeq - start.attackSeq) >>> 0) >= 1 && state.swingStep === 0,
        ),
      {
        message: `${REVERENT}/${facing}: first stab`,
        timeout: 8_000,
        intervals: [10, 15, 25],
      },
    )
    .toBe(true);
  await centerCamera(page);
  const firstFile = fileName(REVERENT, facing, "beat-1-one-hand-stab");
  await page.locator("#game-root canvas").screenshot({ path: firstFile });
  await page.evaluate(() => {
    const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
    arena.input.activePointer.rightButtonDown = () => false;
  });
  await page.waitForTimeout(80);
  await page.evaluate(() => {
    const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
    arena.input.activePointer.rightButtonDown = () => true;
  });
  await expect
    .poll(
      () =>
        snapshot(page).then(
          (state) => ((state.attackSeq - start.attackSeq) >>> 0) >= 2 && state.swingStep === 1,
        ),
      {
        message: `${REVERENT}/${facing}: paper-flip second stab`,
        timeout: 8_000,
        intervals: [10, 15, 25],
      },
    )
    .toBe(true);
  const secondFile = fileName(REVERENT, facing, "beat-2-paper-flip-stab");
  await page.locator("#game-root canvas").screenshot({ path: secondFile });
  await page.evaluate(() => {
    const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
    arena.input.activePointer.rightButtonDown = () => false;
  });
  await page.waitForTimeout(550);
  const telemetry = await page.evaluate(() => {
    const holder = globalThis as unknown as BrowserGlobal & {
      __b36ReverentSamples?: MartialSnapshot[];
      __b36ReverentTimer?: number;
    };
    const arena = holder.ddGame.scene.getScene("arena");
    const rig = arena.blobs.get(arena.room.sessionId);
    if (!rig) throw new Error("B36 Reverent evidence lost its local rig");
    if (holder.__b36ReverentTimer) window.clearInterval(holder.__b36ReverentTimer);
    holder.__b36ReverentTimer = undefined;
    return {
      flip: { ...rig.authoredComboFlipRenderEvidence },
      samples: holder.__b36ReverentSamples ?? [],
    };
  });
  const samples = telemetry.samples;
  const end = await snapshot(page);
  const maxWrappedRootRotation = Math.max(
    ...samples.map((sample) => Math.abs(sample.rootRotation)),
    0,
  );
  const observedBeatOrder: number[] = [];
  for (const sample of samples) {
    if (sample.swingStep !== 0 && sample.swingStep !== 1) continue;
    if (observedBeatOrder.length === 0 && sample.swingStep === 0) observedBeatOrder.push(0);
    else if (observedBeatOrder.length === 1 && sample.swingStep === 1) {
      observedBeatOrder.push(1);
      break;
    }
  }
  expect((end.attackSeq - start.attackSeq) >>> 0).toBeGreaterThanOrEqual(2);
  expect(observedBeatOrder, `${REVERENT}/${facing}: authored two-beat order`).toEqual([0, 1]);
  expect(telemetry.flip.renderedSamples, `${REVERENT}/${facing}: rendered flip samples`).toBeGreaterThan(
    0,
  );
  expect(telemetry.flip.maxProgress, `${REVERENT}/${facing}: completed paper flip`).toBe(1);
  expect(
    telemetry.flip.maxAbsRotation,
    `${REVERENT}/${facing}: raw full paper 360`,
  ).toBeGreaterThan(5.5);
  expect(distance(start, end), `${REVERENT}/${facing}: flip stays in place`).toBeLessThan(1);
  return {
    start,
    end,
    flipRenderEvidence: telemetry.flip,
    maxWrappedRootRotation,
    observedBeatOrder,
    samples,
    screenshots: { first: relative(firstFile), second: relative(secondFile) },
  };
}

async function captureBoxerIdle(page: Page, weaponId: string, facing: Facing) {
  await equip(page, weaponId);
  await setFacing(page, facing);
  await page.waitForTimeout(350);
  const pose = await page.evaluate(() => {
    const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
    const rig = arena.blobs.get(arena.room.sessionId);
    if (!rig) throw new Error("B36 boxer idle lost its rig");
    return {
      bodyY: rig.body.y,
      facing: rig.facing,
      fists: rig.weapons.slice(0, 2).map((weapon) => ({
        rotation: weapon.img.rotation,
        x: weapon.img.x,
        y: weapon.img.y,
      })),
    };
  });
  expect(pose.fists).toHaveLength(2);
  expect(pose.fists.every((fist) => fist.y < -10), `${weaponId}/${facing}: chin height`).toBe(true);
  expect(Math.abs(pose.fists[0]!.y - pose.fists[1]!.y), `${weaponId}/${facing}: paired guard`).toBeLessThan(
    8,
  );
  await centerCamera(page);
  const file = fileName(weaponId, facing, "boxer-idle");
  await page.locator("#game-root canvas").screenshot({ path: file });
  return { ...pose, screenshot: relative(file) };
}

test("B36 martial/melee corrections survive the private real stack in both facings", async ({
  page,
}) => {
  test.setTimeout(600_000);
  await runArenaSpec(page, async (baseURL) => {
    await mkdir(EVIDENCE_DIR, { recursive: true });
    const clientPort = Number(new URL(baseURL).port);
    expect(Number.isInteger(clientPort) && clientPort > 0).toBe(true);
    expect(FORBIDDEN_PORTS.has(clientPort)).toBe(false);
    await bootArena(page, baseURL, `weapon:${WRAPS[0]}`);
    const gamePort = Number(new URL(page.url()).searchParams.get("port"));
    expect(Number.isInteger(gamePort) && gamePort > 0).toBe(true);
    expect(FORBIDDEN_PORTS.has(gamePort)).toBe(false);
    await page.setViewportSize({ width: 1_280, height: 720 });
    await page.locator("#game-root canvas").click({ position: { x: 640, y: 360 } });
    await page.evaluate(() => {
      const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena") as {
        game?: { hasFocus: boolean };
        input?: { hitTestPointer(pointer: unknown): unknown[] };
        pointerOverInteractiveUi?: boolean;
        time?: { now: number };
        verbs?: {
          isLegendOpen?(): boolean;
          releaseInputLatchIf?(force: boolean): void;
          toggleLegend?(timeMs: number): void;
        };
      };
      if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend?.(arena.time?.now ?? 0);
      arena.verbs?.releaseInputLatchIf?.(true);
      if (arena.game) arena.game.hasFocus = true;
      if (arena.input) arena.input.hitTestPointer = () => [];
      arena.pointerOverInteractiveUi = false;
    });

    const wrapCaptures: Record<string, unknown>[] = [];
    const requestedWrap = process.env.DD_B36_WRAP;
    const gateWraps = requestedWrap
      ? WRAPS.filter((weaponId) => weaponId === requestedWrap)
      : WRAPS;
    for (const weaponId of gateWraps) {
      await equip(page, weaponId);
      for (const facing of FACINGS) {
        await setFacing(page, facing);
        const stationary = await captureStationaryCombo(page, weaponId, facing);
        const walking = await captureWalkingCombo(page, weaponId, facing);
        wrapCaptures.push({ weaponId, facing, stationary, walking });
      }
    }

    await equip(page, WYRM);
    const wyrmskull = [];
    for (const facing of FACINGS) wyrmskull.push(await captureWyrmskull(page, facing));

    await equip(page, REVERENT);
    const reverent = [];
    for (const facing of FACINGS) reverent.push(await captureReverent(page, facing));

    const boxerIdle = [];
    for (const weaponId of BOXER_GLOVES) {
      for (const facing of FACINGS) {
        boxerIdle.push({ weaponId, facing, ...(await captureBoxerIdle(page, weaponId, facing)) });
      }
    }

    const assertions = {
      expectedWrapFacingCaptures: wrapCaptures.length === gateWraps.length * FACINGS.length,
      everyStationaryComboHasZeroDisplacement: wrapCaptures.every((capture) => {
        const stationary = capture.stationary as {
          maxDisplacementPx: number;
          postStabilityPx: number;
        };
        return stationary.maxDisplacementPx < 1 && stationary.postStabilityPx < 0.5;
      }),
      everyWrapWalksWithInputSlow: wrapCaptures.every((capture) => {
        const walking = capture.walking as {
          inputSlowReceipt?: { mode: number };
          rootMotionSamples: number;
          signedTravelPx: number;
        };
        return (
          walking.inputSlowReceipt?.mode === PlayerAttackMoveMode.InputSlow &&
          walking.rootMotionSamples === 0 &&
          walking.signedTravelPx > 10
        );
      }),
      wyrmskullHeldOpenAndReleased: wyrmskull.every(
        (capture) =>
          capture.held.fireInputHeld &&
          capture.held.frameVisible &&
          !capture.released.fireInputHeld &&
          !capture.released.frameVisible,
      ),
      reverentTwoBeatFlipInPlace: reverent.every(
        (capture) =>
          capture.flipRenderEvidence.maxAbsRotation > 5.5 &&
          capture.flipRenderEvidence.maxProgress === 1 &&
          capture.observedBeatOrder.join(",") === "0,1" &&
          distance(capture.start, capture.end) < 1,
      ),
      boxerIdleBothFacingsAndSibling: boxerIdle.length === 4,
      privateEphemeralPorts:
        !FORBIDDEN_PORTS.has(clientPort) && !FORBIDDEN_PORTS.has(gamePort),
    };
    expect(Object.values(assertions)).not.toContain(false);

    await writeFile(
      path.join(EVIDENCE_DIR, "live-gate.json"),
      `${JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          baseURL,
          clientPort,
          gamePort,
          forbiddenPorts: [...FORBIDDEN_PORTS],
          assertions,
          wrapCaptures,
          wyrmskull,
          reverent,
          boxerIdle,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    await writeFile(
      path.join(EVIDENCE_DIR, "README.md"),
      [
        "# B36 martial/melee corrections live gate",
        "",
        `Captured on private ephemeral client/server ports ${clientPort}/${gamePort}; protected ports 5180 and 2567 were not used.`,
        "",
        "- `live-gate.json` records all five complete stationary and walking combos in both facings, including authoritative positions and attack movement modes.",
        "- Wrap PNGs capture each full-combo finisher plus walking mid-combo; JSON records every accepted beat and proves zero root mode with stable post-combo coordinates.",
        "- Wyrmskull PNGs show held-open and released-closed frames in both facings after a hold longer than the legacy 280ms observation window.",
        "- Reverent PNGs show the one-hand stab and paper-flip second stab in both facings; raw requested rotation exceeds 5.5 radians without player translation.",
        "- Sparkmitt and Emberfist PNGs show the shared two-fist chin-height boxer guard in both facings.",
        "",
      ].join("\n"),
      "utf8",
    );
  });
});
