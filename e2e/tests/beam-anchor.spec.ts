import { expect, type Page, test } from "@playwright/test";
import { bootArena, runArenaSpec, waitForDevWeapon } from "../helpers/arena-harness.js";

const BEAM_WEAPON = "x2-voltcaster-machine-pistol";
const ACTIVE = 2;
// Four distinct rendered frames are enough to prove a moving attachment. Loaded serial e2e runs can
// render only 5-6 frames during Voltcaster's short active window even though simulation stays healthy.
const SAMPLE_TARGET = 4;

interface AnchorFrame {
  playerX: number;
  playerY: number;
  muzzleX: number;
  muzzleY: number;
  beamX: number;
  beamY: number;
  delta: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __ddBeamAnchorInputTimer: number | undefined;
}

test.use({ viewport: { width: 640, height: 360 } });

async function prepareHeldBeam(page: Page): Promise<void> {
  await page.locator("#game-root canvas").click({ position: { x: 320, y: 180 } });
  await page.evaluate(() => {
    window.focus();
    window.dispatchEvent(new Event("focus"));
    const arena = (
      globalThis as unknown as { ddGame: { scene: { getScene(key: string): unknown } } }
    ).ddGame.scene.getScene("arena") as {
      game: { hasFocus: boolean };
      input: { activePointer: { rightButtonDown(): boolean } };
      stepNetInput?(
        deltaMs: number,
        blocked: boolean,
        ultimate: boolean,
        dx: number,
        dy: number,
      ): void;
      time: { now: number };
      verbs?: {
        isLegendOpen?(): boolean;
        toggleLegend?(nowMs: number): void;
        releaseInputLatchIf?(release: boolean): void;
      };
    };
    if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend?.(arena.time.now);
    arena.verbs?.releaseInputLatchIf?.(true);
    arena.game.hasFocus = true;
    arena.input.activePointer.rightButtonDown = () => true;
    globalThis.__ddBeamAnchorInputTimer = window.setInterval(
      () => arena.stepNetInput?.(50, false, false, 0, 0),
      50,
    );
  });
}

async function releaseHeldBeam(page: Page): Promise<void> {
  await page.keyboard.up("d").catch(() => undefined);
  await page
    .evaluate(() => {
      const arena = (
        globalThis as unknown as { ddGame?: { scene: { getScene(key: string): unknown } } }
      ).ddGame?.scene.getScene("arena") as
        | {
            input?: { activePointer?: { rightButtonDown(): boolean } };
            stepNetInput?(
              deltaMs: number,
              blocked: boolean,
              ultimate: boolean,
              dx: number,
              dy: number,
            ): void;
          }
        | undefined;
      if (arena?.input?.activePointer) arena.input.activePointer.rightButtonDown = () => false;
      arena?.stepNetInput?.(50, false, false, 0, 0);
      if (globalThis.__ddBeamAnchorInputTimer) {
        window.clearInterval(globalThis.__ddBeamAnchorInputTimer);
        globalThis.__ddBeamAnchorInputTimer = undefined;
      }
    })
    .catch(() => undefined);
}

async function sampleRenderedAnchor(page: Page, ownerId: string): Promise<AnchorFrame[]> {
  return page.evaluate(
    ({ wantedOwner, active, sampleTarget }) =>
      new Promise<AnchorFrame[]>((resolve) => {
        const frames: AnchorFrame[] = [];
        const deadline = performance.now() + 20_000;
        let strafing = false;
        const sample = () => {
          const arena = (
            globalThis as unknown as { ddGame?: { scene: { getScene(key: string): unknown } } }
          ).ddGame?.scene.getScene("arena") as
            | {
                room?: { state?: { beams?: { get(id: string): { phase?: number } | undefined } } };
                blobs?: { get(id: string): unknown };
                beamRenderer?: { entries?: unknown[] };
                stepNetInput?(
                  deltaMs: number,
                  blocked: boolean,
                  ultimate: boolean,
                  dx: number,
                  dy: number,
                ): void;
              }
            | undefined;
          const rig = arena?.blobs?.get(wantedOwner) as
            | {
                root: {
                  x: number;
                  y: number;
                };
                writeWeaponMuzzle(
                  hand: 0 | 1,
                  out: { x: number; y: number },
                  pointIndex?: number,
                ): boolean;
              }
            | undefined;
          const row = arena?.room?.state?.beams?.get(wantedOwner);
          if (!strafing && row?.phase === active) {
            if (globalThis.__ddBeamAnchorInputTimer)
              window.clearInterval(globalThis.__ddBeamAnchorInputTimer);
            globalThis.__ddBeamAnchorInputTimer = window.setInterval(
              () => arena?.stepNetInput?.(50, false, false, 1, 0),
              50,
            );
            strafing = true;
          }
          const entry = (
            arena?.beamRenderer?.entries as
              | Array<{
                  key: string;
                  ownerId: string;
                  body?: {
                    visible: boolean;
                    x: number;
                    y: number;
                    scaleX: number;
                    scaleY: number;
                    points?: Array<{ x: number; y: number }>;
                  };
                }>
              | undefined
          )?.find(
            (candidate) =>
              candidate.key && candidate.ownerId === wantedOwner && candidate.body?.visible,
          );
          const point = entry?.body?.points?.[0];
          const muzzle = { x: 0, y: 0 };
          if (
            rig &&
            row?.phase === active &&
            entry?.body &&
            point &&
            rig.writeWeaponMuzzle(0, muzzle, 0)
          ) {
            const beamX = entry.body.x + point.x * entry.body.scaleX;
            const beamY = entry.body.y + point.y * entry.body.scaleY;
            frames.push({
              playerX: rig.root.x,
              playerY: rig.root.y,
              muzzleX: muzzle.x,
              muzzleY: muzzle.y,
              beamX,
              beamY,
              delta: Math.hypot(beamX - muzzle.x, beamY - muzzle.y),
            });
          }
          const first = frames[0];
          const last = frames.at(-1);
          const travel =
            first && last
              ? Math.hypot(last.playerX - first.playerX, last.playerY - first.playerY)
              : 0;
          if ((frames.length >= sampleTarget && travel > 20) || performance.now() >= deadline)
            resolve(frames);
          else requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      }),
    { wantedOwner: ownerId, active: ACTIVE, sampleTarget: SAMPLE_TARGET },
  );
}

function assertMovingAnchor(label: string, frames: AnchorFrame[]): void {
  expect(
    frames.length,
    `${label} should capture multiple active rendered frames`,
  ).toBeGreaterThanOrEqual(SAMPLE_TARGET);
  const first = frames[0];
  const last = frames.at(-1);
  if (!first || !last) throw new Error(`${label} did not capture anchor frames`);
  const travel = Math.hypot(last.playerX - first.playerX, last.playerY - first.playerY);
  const maxDelta = Math.max(...frames.map((frame) => frame.delta));
  expect(travel, `${label} owner must actually walk during the burst`).toBeGreaterThan(20);
  expect(maxDelta, `${label} beam origin must stay glued to the live muzzle`).toBeLessThanOrEqual(
    2.5,
  );
}

test("moving beam origins follow the final rendered weapon muzzle", async ({ page }) => {
  await runArenaSpec(page, async (baseURL) => {
    await bootArena(page, baseURL, `weapon:${BEAM_WEAPON}`);
    await waitForDevWeapon(page, BEAM_WEAPON);
    const ownerId = await page.evaluate(() => {
      const arena = (
        globalThis as unknown as { ddGame: { scene: { getScene(key: string): unknown } } }
      ).ddGame.scene.getScene("arena") as { room: { sessionId: string } };
      return arena.room.sessionId;
    });

    try {
      await prepareHeldBeam(page);
      const frames = await sampleRenderedAnchor(page, ownerId);
      assertMovingAnchor("live client", frames);
    } finally {
      await releaseHeldBeam(page);
    }
  });
});
