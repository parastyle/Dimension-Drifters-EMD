import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { BLADE_EXTENSION_WEAPON_IDS, MIRAGE_HARDLIGHT_SABER_ID } from "@dd/shared";
import { expect, type Page, test } from "@playwright/test";
import { bootArena, runArenaSpec, waitForDevWeapon } from "../helpers/arena-harness.js";

const WEAPON_IDS = BLADE_EXTENSION_WEAPON_IDS;
const CHARACTER_ID = "proto-cowboy-hidden-face";
const FORBIDDEN_PORTS = new Set([5180, 2567]);
const JOIN_TOLERANCE_PX = 0.25;
const WIDTH_TOLERANCE_PX = 0.25;
const ANGLE_TOLERANCE_RAD = 0.002;
const REVEAL_REACH_TOLERANCE = 0.002;
const TIP_EXTENT_TOLERANCE_PX = 0.25;
const EVIDENCE_DIR = path.resolve(
  import.meta.dirname,
  "../../docs/owner-notes-audit-v10-evidence/b12-mirage-extension",
);

interface BladeFrame {
  wallMs: number;
  nowMs: number;
  sourceId: string;
  weaponId: string;
  hand: number;
  comboId: string;
  comboStep: number;
  comboActive: boolean;
  phase: string;
  reveal: number;
  bladeTipX: number;
  bladeTipY: number;
  wielderX: number;
  wielderY: number;
  bladeAngle: number;
  bladeAxisX: number;
  bladeAxisY: number;
  bladeWidth: number;
  physicalBladeLength: number;
  extensionRootX: number;
  extensionRootY: number;
  extensionAngle: number;
  extensionWidth: number;
  extensionLength: number;
  overlapLength: number;
  emergedLength: number;
  rangeMultiplier: number;
  visibleTipReach: number;
  authoritativeTipReach: number;
  reachExtentError: number;
  authoritativeTipFit: boolean;
  axialError: number;
  lateralError: number;
  angleError: number;
}

interface BrowserArena {
  time: { now: number };
  game: { hasFocus: boolean };
  pointerOverInteractiveUi: boolean;
  verbs?: {
    isLegendOpen?(): boolean;
    toggleLegend?(timeMs: number): void;
    releaseInputLatchIf?(force: boolean): void;
  };
  input: { activePointer: { rightButtonDown: () => boolean } };
  stepNetInput?(elapsedMs: number, up: boolean, down: boolean, x: number, y: number): void;
}

interface BladeBrowserGlobal {
  ddGame: { scene: { getScene(key: string): BrowserArena } };
  __ddV7BladeExtensionCapture?: boolean;
  __ddV7BladeExtensionPhase?: string;
  __ddV7BladeExtensionFrames?: BladeFrame[];
  __ddV7BladeExtensionInput?: number;
}

interface RawBladePlayer {
  weapon?: string;
  character?: string;
  x?: number;
  y?: number;
  ackSeq?: number;
}

interface RawBladeRoom {
  sessionId: string;
  state?: { players?: { get(id: string): RawBladePlayer | undefined } };
  send(type: string, message?: unknown): void;
  leave(): Promise<unknown>;
}

interface RawBladeControl {
  setAim(x: number, y: number): void;
  stop(): void;
}

interface RawBladeConnection {
  readonly room: RawBladeRoom;
  readonly gamePort: number;
}

function maxAbs(frames: readonly BladeFrame[], field: keyof BladeFrame): number {
  return Math.max(0, ...frames.map((frame) => Math.abs(Number(frame[field]))));
}

function angleDistance(a: number, b: number): number {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}

function angleSpan(frames: readonly BladeFrame[]): number {
  let span = 0;
  for (let i = 0; i < frames.length; i++) {
    for (let j = i + 1; j < frames.length; j++) {
      span = Math.max(span, angleDistance(frames[i]?.bladeAngle ?? 0, frames[j]?.bladeAngle ?? 0));
    }
  }
  return span;
}

async function beginHeldAttack(page: Page, phase: string, x: number, y: number): Promise<void> {
  await page.mouse.move(x, y);
  await page.evaluate((label) => {
    const holder = globalThis as unknown as BladeBrowserGlobal;
    const arena = holder.ddGame.scene.getScene("arena");
    holder.__ddV7BladeExtensionPhase = label;
    arena.game.hasFocus = true;
    arena.pointerOverInteractiveUi = false;
    arena.input.activePointer.rightButtonDown = () => true;
    if (holder.__ddV7BladeExtensionInput) window.clearInterval(holder.__ddV7BladeExtensionInput);
    holder.__ddV7BladeExtensionInput = window.setInterval(
      () => arena.stepNetInput?.(50, false, false, 0, 0),
      50,
    );
  }, phase);
}

async function endHeldAttack(page: Page): Promise<void> {
  await page.evaluate(() => {
    const holder = globalThis as unknown as BladeBrowserGlobal;
    const arena = holder.ddGame.scene.getScene("arena");
    arena.input.activePointer.rightButtonDown = () => false;
    arena.stepNetInput?.(50, false, false, 0, 0);
    if (holder.__ddV7BladeExtensionInput) window.clearInterval(holder.__ddV7BladeExtensionInput);
    holder.__ddV7BladeExtensionInput = undefined;
  });
}

async function waitUntil(
  predicate: () => boolean,
  timeoutMs: number,
  label: string,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`${label} timed out after ${timeoutMs} ms`);
}

async function connectRawBladePlayer(page: Page, weaponId: string): Promise<RawBladeConnection> {
  const connection = await page.evaluate(() => {
    const arena = (globalThis as unknown as BladeBrowserGlobal).ddGame.scene.getScene("arena") as
      | BrowserArena
      | (BrowserArena & { room: { roomId: string } });
    return { roomId: "room" in arena ? arena.room.roomId : "", url: location.href };
  });
  const gamePort = Number(new URL(connection.url).searchParams.get("port"));
  if (!connection.roomId) throw new Error("live arena room id missing");
  if (!Number.isFinite(gamePort) || gamePort <= 0)
    throw new Error("private game port missing from URL");
  expect(FORBIDDEN_PORTS.has(gamePort), "game port must be private ephemeral").toBe(false);
  const { Client } = await import(
    "../../packages/client/node_modules/colyseus.js/build/esm/index.mjs"
  );
  const client = new Client(`ws://127.0.0.1:${gamePort}`);
  const room = (await client.joinById(connection.roomId)) as unknown as RawBladeRoom;
  room.send("devEquip", { weapon: weaponId, character: CHARACTER_ID });
  await waitUntil(
    () => {
      const player = room.state?.players?.get(room.sessionId);
      return player?.weapon === weaponId && player.character === CHARACTER_ID;
    },
    10_000,
    `raw blade player equip ${weaponId} on ${CHARACTER_ID}`,
  );
  await expect
    .poll(
      () =>
        page.evaluate(
          ({ id }) => {
            const arena = (globalThis as unknown as BladeBrowserGlobal).ddGame.scene.getScene(
              "arena",
            ) as BrowserArena & {
              blobs: Map<string, { heldWeaponDef(hand: 0 | 1): { id: string } | undefined }>;
            };
            return arena.blobs.get(id)?.heldWeaponDef(0)?.id ?? null;
          },
          { id: room.sessionId },
        ),
      { message: `observer should render raw blade player ${weaponId}`, timeout: 10_000 },
    )
    .toBe(weaponId);
  return { room, gamePort };
}

async function equipBladeFixture(page: Page, weaponId: string): Promise<void> {
  await page.evaluate(
    ({ characterId, wantedWeapon }) => {
      const arena = (globalThis as unknown as BladeBrowserGlobal).ddGame.scene.getScene(
        "arena",
      ) as BrowserArena & {
        room: {
          sessionId: string;
          state: {
            players: {
              get(id: string): { character?: string; weapon?: string } | undefined;
            };
          };
          send(type: string, message?: unknown): void;
        };
      };
      arena.room.send("devEquip", { weapon: wantedWeapon, character: characterId });
    },
    { characterId: CHARACTER_ID, wantedWeapon: weaponId },
  );
  await waitForDevWeapon(page, weaponId);
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const arena = (globalThis as unknown as BladeBrowserGlobal).ddGame.scene.getScene(
            "arena",
          ) as BrowserArena & {
            room: {
              sessionId: string;
              state: {
                players: {
                  get(id: string): { character?: string } | undefined;
                };
              };
            };
          };
          return arena.room.state.players.get(arena.room.sessionId)?.character ?? null;
        }),
      { message: `blade gate should use ${CHARACTER_ID}`, timeout: 20_000 },
    )
    .toBe(CHARACTER_ID);
}

function startRawBladeAttack(
  room: RawBladeRoom,
  initialX: number,
  initialY: number,
): RawBladeControl {
  let aimX = initialX;
  let aimY = initialY;
  let seq = Number(room.state?.players?.get(room.sessionId)?.ackSeq ?? 0) >>> 0;
  const target = (): { aimX: number; aimY: number; tx: number; ty: number } => {
    const player = room.state?.players?.get(room.sessionId);
    const length = Math.hypot(aimX, aimY) || 1;
    const x = aimX / length;
    const y = aimY / length;
    return {
      aimX: x,
      aimY: y,
      tx: (player?.x ?? 0) + x * 300,
      ty: (player?.y ?? 0) + y * 300,
    };
  };
  const sendInput = (): void => {
    const next = target();
    seq = (seq + 1) >>> 0;
    room.send("input", {
      seq,
      dx: 0,
      dy: 0,
      jump: false,
      crouchHeld: false,
      pound: false,
      slide: false,
      slideHeld: false,
      fireHeld: false,
      aimX: next.aimX,
      aimY: next.aimY,
      targetX: next.tx,
      targetY: next.ty,
    });
  };
  const sendAttack = (): void => room.send("attack", target());
  sendInput();
  sendAttack();
  const inputTimer = setInterval(sendInput, 50);
  const attackTimer = setInterval(sendAttack, 100);
  return {
    setAim(x, y) {
      aimX = x;
      aimY = y;
    },
    stop() {
      clearInterval(inputTimer);
      clearInterval(attackTimer);
    },
  };
}

for (const weaponId of WEAPON_IDS) {
  test(`${weaponId} extension stays on the blade affine through a live combo`, async ({ page }) => {
    test.setTimeout(120_000);
    await runArenaSpec(page, async (baseURL) => {
      const clientPort = Number(new URL(baseURL).port);
      expect(Number.isFinite(clientPort) && clientPort > 0, "private client port").toBe(true);
      expect(FORBIDDEN_PORTS.has(clientPort), "client port must be private ephemeral").toBe(false);
      const weaponEvidenceDir = path.join(EVIDENCE_DIR, weaponId);
      await mkdir(weaponEvidenceDir, { recursive: true });
      await page.setViewportSize({ width: 640, height: 360 });
      await bootArena(page, baseURL, `weapon:${weaponId}`);
      await equipBladeFixture(page, weaponId);
      const canvas = page.locator("#game-root canvas");
      await canvas.click({ position: { x: 320, y: 180 } });
      await page.waitForTimeout(1_200);

      await page.evaluate(() => {
        const holder = globalThis as unknown as BladeBrowserGlobal;
        const arena = holder.ddGame.scene.getScene("arena");
        if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend(arena.time.now);
        arena.verbs?.releaseInputLatchIf?.(true);
        holder.__ddV7BladeExtensionFrames = [];
        holder.__ddV7BladeExtensionCapture = true;
      });
      await page.screenshot({ path: path.join(weaponEvidenceDir, "after-idle-retracted.png") });

      await beginHeldAttack(page, "right-up", 590, 65);
      await page.waitForTimeout(60);
      await page.screenshot({ path: path.join(weaponEvidenceDir, "after-right-up-rise.png") });
      await page.waitForTimeout(2_340);
      await page.screenshot({ path: path.join(weaponEvidenceDir, "after-right-up-combo.png") });
      await endHeldAttack(page);

      // The slowest blade has a 1.02 s cadence plus the bounded combo grace; 1.6 s proves the retained
      // surface retracts only after that real chain lifetime lapses.
      await page.waitForTimeout(1_600);
      await page.screenshot({ path: path.join(weaponEvidenceDir, "after-combo-retracted.png") });

      await beginHeldAttack(page, "left-up", 50, 95);
      await page.waitForTimeout(1_250);
      await page.screenshot({ path: path.join(weaponEvidenceDir, "after-left-up-swing.png") });
      await endHeldAttack(page);
      await page.waitForTimeout(250);

      const { room: rawRoom, gamePort } = await connectRawBladePlayer(page, weaponId);
      await page.evaluate(() => {
        (globalThis as unknown as BladeBrowserGlobal).__ddV7BladeExtensionPhase = "remote-right-up";
      });
      const rawControl = startRawBladeAttack(rawRoom, 1, -0.78);
      await page.waitForTimeout(180);
      await page.screenshot({
        path: path.join(weaponEvidenceDir, "after-remote-right-up-rise.png"),
      });
      await page.waitForTimeout(2_220);
      await page.screenshot({
        path: path.join(weaponEvidenceDir, "after-remote-right-up-combo.png"),
      });
      await page.evaluate(() => {
        (globalThis as unknown as BladeBrowserGlobal).__ddV7BladeExtensionPhase = "remote-left-up";
      });
      rawControl.setAim(-1, -0.62);
      await page.waitForTimeout(1_250);
      await page.screenshot({
        path: path.join(weaponEvidenceDir, "after-remote-left-up-swing.png"),
      });
      rawControl.stop();
      await page.waitForTimeout(250);

      const frames = await page.evaluate(() => {
        const holder = globalThis as unknown as BladeBrowserGlobal;
        holder.__ddV7BladeExtensionCapture = false;
        return [...(holder.__ddV7BladeExtensionFrames ?? [])];
      });
      await rawRoom.leave();
      const diagnostic = await page.evaluate((id) => {
        const holder = globalThis as unknown as BladeBrowserGlobal;
        const arena = holder.ddGame.scene.getScene("arena") as BrowserArena & {
          room: { sessionId: string };
          blobs: Map<
            string,
            {
              activeSwing?: Record<string, unknown>;
              leadWeaponTipPose(hand?: 0 | 1): Record<string, unknown> | undefined;
            }
          >;
          vfxPlayer: {
            bladeExtensions: Map<string, { weaponId: string; comboId: string; reveal: number }>;
            spawnsAtCursor(weaponId: string): boolean;
          };
        };
        const rig = arena.blobs.get(arena.room.sessionId);
        return {
          weaponId: id,
          activeSwing: rig?.activeSwing,
          attachment: rig?.leadWeaponTipPose(0),
          spawnsAtCursor: arena.vfxPlayer.spawnsAtCursor(id),
          retainedExtensions: [...arena.vfxPlayer.bladeExtensions.values()].map((state) => ({
            weaponId: state.weaponId,
            comboId: state.comboId,
            reveal: state.reveal,
          })),
        };
      }, weaponId);
      const weaponFrames = frames.filter((frame) => frame.weaponId === weaponId);
      const rightFrames = weaponFrames.filter((frame) => frame.phase === "right-up");
      const leftFrames = weaponFrames.filter((frame) => frame.phase === "left-up");
      const remoteFrames = weaponFrames.filter((frame) => frame.sourceId === rawRoom.sessionId);
      const remoteRightFrames = remoteFrames.filter((frame) => frame.phase === "remote-right-up");
      const remoteLeftFrames = remoteFrames.filter((frame) => frame.phase === "remote-left-up");
      const activeRight = rightFrames.filter((frame) => frame.comboActive);
      const rightComboId = activeRight[0]?.comboId;
      const firstCombo = activeRight.filter((frame) => frame.comboId === rightComboId);
      const laterHits = firstCombo.filter((frame) => frame.comboStep > 0);
      const retracting = rightFrames.filter(
        (frame) => frame.comboId === rightComboId && !frame.comboActive,
      );
      const partialRise = firstCombo.filter((frame) => frame.reveal < 0.999);
      const fullRise = firstCombo.filter((frame) => frame.reveal >= 0.999);
      const fullAuthoritativeTipFrames = weaponFrames.filter(
        (frame) => frame.authoritativeTipFit && frame.comboActive && frame.reveal >= 0.999,
      );
      const activeRemote = remoteFrames.filter((frame) => frame.comboActive);
      const remoteComboId = activeRemote[0]?.comboId;
      const firstRemoteCombo = activeRemote.filter((frame) => frame.comboId === remoteComboId);
      const remoteLaterHits = firstRemoteCombo.filter((frame) => frame.comboStep > 0);
      const observedSteps = [...new Set(firstCombo.map((frame) => frame.comboStep))].sort();
      const reachRevealError = Math.max(
        0,
        ...weaponFrames.map((frame) =>
          Math.abs(frame.emergedLength / Math.max(1, frame.physicalBladeLength * 2) - frame.reveal),
        ),
      );
      const widthError = Math.max(
        0,
        ...weaponFrames.map((frame) => Math.abs(frame.extensionWidth - frame.bladeWidth)),
      );
      let ignitionTransitions = 0;
      for (let index = 1; index < firstCombo.length; index++) {
        if (
          (firstCombo[index - 1]?.reveal ?? 0) < 0.999 &&
          (firstCombo[index]?.reveal ?? 0) >= 0.999
        )
          ignitionTransitions++;
      }
      let remoteIgnitionTransitions = 0;
      let remoteRelightDrops = 0;
      let remoteReachedFull = (firstRemoteCombo[0]?.reveal ?? 0) >= 0.999;
      for (let index = 1; index < firstRemoteCombo.length; index++) {
        const reveal = firstRemoteCombo[index]?.reveal ?? 0;
        if ((firstRemoteCombo[index - 1]?.reveal ?? 0) < 0.999 && reveal >= 0.999)
          remoteIgnitionTransitions++;
        if (remoteReachedFull && reveal < 0.999) remoteRelightDrops++;
        if (reveal >= 0.999) remoteReachedFull = true;
      }
      const summary = {
        weaponId,
        characterId: CHARACTER_ID,
        privateClientPort: clientPort,
        privateGamePort: gamePort,
        thresholds: {
          joinPx: JOIN_TOLERANCE_PX,
          widthPx: WIDTH_TOLERANCE_PX,
          angleRad: ANGLE_TOLERANCE_RAD,
          revealReach: REVEAL_REACH_TOLERANCE,
          tipExtentPx: TIP_EXTENT_TOLERANCE_PX,
        },
        frames: weaponFrames.length,
        rightFrames: rightFrames.length,
        leftFrames: leftFrames.length,
        remoteFrames: remoteFrames.length,
        remoteRightFrames: remoteRightFrames.length,
        remoteLeftFrames: remoteLeftFrames.length,
        rightAngleSpanRad: angleSpan(activeRight),
        leftAngleSpanRad: angleSpan(leftFrames.filter((frame) => frame.comboActive)),
        remoteRightAngleSpanRad: angleSpan(remoteRightFrames.filter((frame) => frame.comboActive)),
        remoteLeftAngleSpanRad: angleSpan(remoteLeftFrames.filter((frame) => frame.comboActive)),
        observedSteps,
        comboIds: [...new Set(weaponFrames.map((frame) => frame.comboId))],
        partialRiseFrames: partialRise.length,
        fullRiseFrames: fullRise.length,
        laterHitFrames: laterHits.length,
        retractingFrames: retracting.length,
        ignitionTransitions,
        remoteIgnitionTransitions,
        remoteRelightDrops,
        maxAxialErrorPx: maxAbs(weaponFrames, "axialError"),
        maxLateralErrorPx: maxAbs(weaponFrames, "lateralError"),
        maxAngleErrorRad: maxAbs(weaponFrames, "angleError"),
        maxWidthErrorPx: widthError,
        maxRevealReachError: reachRevealError,
        maxFullTipExtentErrorPx:
          fullAuthoritativeTipFrames.length > 0
            ? maxAbs(fullAuthoritativeTipFrames, "reachExtentError")
            : undefined,
        fullTipExtentByStep: [
          ...new Set(fullAuthoritativeTipFrames.map((frame) => frame.comboStep)),
        ].map((comboStep) => ({
          comboStep,
          rangeMultiplier:
            fullAuthoritativeTipFrames.find((frame) => frame.comboStep === comboStep)
              ?.rangeMultiplier ?? 1,
          maxErrorPx: maxAbs(
            fullAuthoritativeTipFrames.filter((frame) => frame.comboStep === comboStep),
            "reachExtentError",
          ),
        })),
      };
      await writeFile(
        path.join(weaponEvidenceDir, "after-summary.json"),
        `${JSON.stringify({ summary, diagnostic, frames: weaponFrames }, null, 2)}\n`,
      );

      expect(weaponFrames.length, `${weaponId}/whole-swing frames`).toBeGreaterThan(45);
      expect(rightFrames.length, `${weaponId}/right-up frames`).toBeGreaterThan(25);
      expect(leftFrames.length, `${weaponId}/left-up frames`).toBeGreaterThan(12);
      expect(remoteRightFrames.length, `${weaponId}/remote right-up frames`).toBeGreaterThan(25);
      expect(remoteLeftFrames.length, `${weaponId}/remote left-up frames`).toBeGreaterThan(12);
      expect(
        Math.max(...rightFrames.map((frame) => frame.bladeAxisX)),
        `${weaponId}/right facing`,
      ).toBeGreaterThan(0.2);
      expect(
        Math.min(...leftFrames.map((frame) => frame.bladeAxisX)),
        `${weaponId}/left facing`,
      ).toBeLessThan(-0.2);
      expect(angleSpan(activeRight), `${weaponId}/right whole swing angle span`).toBeGreaterThan(
        0.35,
      );
      expect(
        angleSpan(leftFrames.filter((frame) => frame.comboActive)),
        `${weaponId}/left whole swing angle span`,
      ).toBeGreaterThan(0.35);
      expect(
        Math.max(...remoteRightFrames.map((frame) => frame.bladeAxisX)),
        `${weaponId}/remote right facing`,
      ).toBeGreaterThan(0.2);
      expect(
        Math.min(...remoteLeftFrames.map((frame) => frame.bladeAxisX)),
        `${weaponId}/remote left facing`,
      ).toBeLessThan(-0.2);
      expect(
        angleSpan(remoteRightFrames.filter((frame) => frame.comboActive)),
        `${weaponId}/remote right whole swing angle span`,
      ).toBeGreaterThan(0.35);
      expect(
        angleSpan(remoteLeftFrames.filter((frame) => frame.comboActive)),
        `${weaponId}/remote left whole swing angle span`,
      ).toBeGreaterThan(0.35);
      expect(maxAbs(weaponFrames, "axialError"), `${weaponId}/axial error`).toBeLessThanOrEqual(
        JOIN_TOLERANCE_PX,
      );
      expect(maxAbs(weaponFrames, "lateralError"), `${weaponId}/lateral error`).toBeLessThanOrEqual(
        JOIN_TOLERANCE_PX,
      );
      expect(maxAbs(weaponFrames, "angleError"), `${weaponId}/angle error`).toBeLessThanOrEqual(
        ANGLE_TOLERANCE_RAD,
      );
      expect(widthError, `${weaponId}/measured width`).toBeLessThanOrEqual(WIDTH_TOLERANCE_PX);
      expect(reachRevealError, `${weaponId}/reveal-scaled reach`).toBeLessThanOrEqual(
        REVEAL_REACH_TOLERANCE,
      );
      if (weaponId === MIRAGE_HARDLIGHT_SABER_ID) {
        expect(
          fullAuthoritativeTipFrames.length,
          `${weaponId}/authoritative full-tip frames`,
        ).toBeGreaterThan(45);
        expect(
          maxAbs(fullAuthoritativeTipFrames, "reachExtentError"),
          `${weaponId}/visible tip equals authoritative damage extent`,
        ).toBeLessThanOrEqual(TIP_EXTENT_TOLERANCE_PX);
      }
      expect(partialRise.length, `${weaponId}/visible ignition`).toBeGreaterThan(1);
      expect(fullRise.length, `${weaponId}/full ignition`).toBeGreaterThan(1);
      expect(ignitionTransitions, `${weaponId}/one ignition`).toBe(1);
      // A remote accepted swing may arrive after the 100 ms ignition has already completed. Whether the
      // observer samples that one transition or joins at full length, it must never see a second ignition.
      expect(
        remoteIgnitionTransitions,
        `${weaponId}/remote ignition upper bound`,
      ).toBeLessThanOrEqual(1);
      expect(remoteRelightDrops, `${weaponId}/remote no re-ignition`).toBe(0);
      expect(observedSteps.slice(0, 3), `${weaponId}/first three combo hits`).toEqual([0, 1, 2]);
      expect(
        observedSteps.every((step, index) => step === index),
        `${weaponId}/continuous combo steps`,
      ).toBe(true);
      expect(
        Math.min(...laterHits.map((frame) => frame.reveal)),
        `${weaponId}/hold across hits`,
      ).toBeGreaterThanOrEqual(0.999);
      expect(
        Math.min(...remoteLaterHits.map((frame) => frame.reveal)),
        `${weaponId}/remote hold across hits`,
      ).toBeGreaterThanOrEqual(0.999);
      expect(retracting.length, `${weaponId}/combo-end retraction`).toBeGreaterThan(1);
      expect(
        Math.min(...retracting.map((frame) => frame.reveal)),
        `${weaponId}/retracted`,
      ).toBeLessThan(0.5);
    });
  });
}
