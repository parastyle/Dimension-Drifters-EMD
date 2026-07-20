import { expect, type Page, test } from "@playwright/test";
import { bootArena, runArenaSpec, waitForDevWeapon } from "../helpers/arena-harness.js";

const BEAM_WEAPON = "x2-voltcaster-machine-pistol";
const ACTIVE = 2;
const SAMPLE_TARGET = 8;

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

async function runAgainstAvailableStack(
  page: Page,
  body: (baseURL: string) => Promise<void>,
): Promise<void> {
  const liveBaseURL = process.env.DD_E2E_BASE_URL;
  if (liveBaseURL) {
    await body(liveBaseURL);
    return;
  }
  await runArenaSpec(page, body);
}

async function prepareHeldBeam(page: Page): Promise<void> {
  await page.locator("#game-root canvas").click({ position: { x: 320, y: 180 } });
  await page.mouse.move(555, 180);
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
      () => arena.stepNetInput?.(50, false, false, 1, 0),
      50,
    );
  });
  await page.keyboard.down("d");
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

async function waitForActiveBeam(page: Page, ownerId: string): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(
          ({ wantedOwner, active }) => {
            const arena = (
              globalThis as unknown as { ddGame?: { scene: { getScene(key: string): unknown } } }
            ).ddGame?.scene.getScene("arena") as
              | {
                  room?: {
                    state?: {
                      beams?: {
                        get(id: string): { phase?: number; effectiveLength?: number } | undefined;
                      };
                    };
                  };
                }
              | undefined;
            const row = arena?.room?.state?.beams?.get(wantedOwner);
            return row?.phase === active && (row.effectiveLength ?? 0) > 1;
          },
          { wantedOwner: ownerId, active: ACTIVE },
        ),
      { message: `${ownerId} should expose an active rendered beam`, timeout: 20_000 },
    )
    .toBe(true);
}

async function sampleRenderedAnchor(page: Page, ownerId: string): Promise<AnchorFrame[]> {
  return page.evaluate(
    ({ wantedOwner, active, sampleTarget }) =>
      new Promise<AnchorFrame[]>((resolve) => {
        const frames: AnchorFrame[] = [];
        const deadline = performance.now() + 4_000;
        const sample = () => {
          const arena = (
            globalThis as unknown as { ddGame?: { scene: { getScene(key: string): unknown } } }
          ).ddGame?.scene.getScene("arena") as
            | {
                room?: { state?: { beams?: { get(id: string): { phase?: number } | undefined } } };
                blobs?: { get(id: string): unknown };
                beamRenderer?: { entries?: unknown[] };
              }
            | undefined;
          const rig = arena?.blobs?.get(wantedOwner) as
            | {
                root: {
                  x: number;
                  y: number;
                  getWorldTransformMatrix(): {
                    transformPoint(x: number, y: number): { x: number; y: number };
                  };
                };
                weapons?: Array<{
                  img: {
                    x: number;
                    y: number;
                    width: number;
                    originX: number;
                    scaleX: number;
                  };
                  semanticRotation: number;
                }>;
              }
            | undefined;
          const weapon = rig?.weapons?.[0];
          const row = arena?.room?.state?.beams?.get(wantedOwner);
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
          if (rig && weapon && row?.phase === active && entry?.body && point) {
            const image = weapon.img;
            const tip = image.width * Math.abs(image.scaleX) * (1 - image.originX);
            const localX = image.x + Math.cos(weapon.semanticRotation) * tip;
            const localY = image.y + Math.sin(weapon.semanticRotation) * tip;
            const muzzle = rig.root.getWorldTransformMatrix().transformPoint(localX, localY);
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
          if (frames.length >= sampleTarget || performance.now() >= deadline) resolve(frames);
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
  await runAgainstAvailableStack(page, async (baseURL) => {
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
      await waitForActiveBeam(page, ownerId);
      const frames = await sampleRenderedAnchor(page, ownerId);
      assertMovingAnchor("live client", frames);
    } finally {
      await releaseHeldBeam(page);
    }
  });
});
