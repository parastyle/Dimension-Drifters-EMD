import { expect, type Page, test } from "@playwright/test";
import { bootArena, runArenaSpec, waitForDevWeapon } from "../helpers/arena-harness.js";

const WEAPON_ID = "x2-galvanic-overcasters";
const REQUIRED_ROUNDS = 12;

interface BurstAnchorFrame {
  x: number;
  y: number;
}

interface BurstAnchorRound {
  id: string;
  bornTick: number;
  originX: number;
  originY: number;
  muzzleX: number;
  muzzleY: number;
  delta: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __ddBurstAnchorInputTimer: number | undefined;
  // eslint-disable-next-line no-var
  var __ddBurstAnchorSampling: boolean | undefined;
  // eslint-disable-next-line no-var
  var __ddBurstAnchorFrames: BurstAnchorFrame[] | undefined;
  // eslint-disable-next-line no-var
  var __ddBurstAnchorRounds: BurstAnchorRound[] | undefined;
  // eslint-disable-next-line no-var
  var __ddBurstAnchorSeen: Set<string> | undefined;
}

test.use({ viewport: { width: 640, height: 360 } });

async function holdFireWhileStrafing(page: Page): Promise<void> {
  await page.locator("#game-root canvas").click({ position: { x: 320, y: 180 } });
  await page.mouse.move(555, 90);
  await page.evaluate(
    ({ wanted, required }) => {
      window.focus();
      window.dispatchEvent(new Event("focus"));
      const arena = (
        globalThis as unknown as { ddGame: { scene: { getScene(key: string): unknown } } }
      ).ddGame.scene.getScene("arena") as {
        blobs: {
          get(id: string):
            | {
                x: number;
                y: number;
              }
            | undefined;
        };
        game: { hasFocus: boolean };
        input: { activePointer: { rightButtonDown(): boolean } };
        projectiles: {
          get(id: string):
            | {
                getData(key: string): unknown;
              }
            | undefined;
        };
        room: {
          sessionId: string;
          state: {
            projectiles: {
              forEach(
                callback: (
                  row: { sourcePlayerId: string; sourceWeaponId: string; bornTick: number },
                  id: string,
                ) => void,
              ): void;
            };
          };
        };
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
      globalThis.__ddBurstAnchorFrames = [];
      globalThis.__ddBurstAnchorRounds = [];
      globalThis.__ddBurstAnchorSeen = new Set();
      globalThis.__ddBurstAnchorSampling = true;
      const sample = () => {
        if (!globalThis.__ddBurstAnchorSampling) return;
        const ownerId = arena.room.sessionId;
        const rig = arena.blobs.get(ownerId);
        if (rig) globalThis.__ddBurstAnchorFrames?.push({ x: rig.x, y: rig.y });
        arena.room.state.projectiles.forEach((row, id) => {
          if (
            globalThis.__ddBurstAnchorSeen?.has(id) ||
            row.sourcePlayerId !== ownerId ||
            row.sourceWeaponId !== wanted
          )
            return;
          const rendered = arena.projectiles.get(id);
          const originX = Number(rendered?.getData("spawnOriginX"));
          const originY = Number(rendered?.getData("spawnOriginY"));
          const muzzleX = Number(rendered?.getData("spawnMuzzleX"));
          const muzzleY = Number(rendered?.getData("spawnMuzzleY"));
          if (![originX, originY, muzzleX, muzzleY].every(Number.isFinite)) return;
          globalThis.__ddBurstAnchorSeen?.add(id);
          globalThis.__ddBurstAnchorRounds?.push({
            id,
            bornTick: row.bornTick,
            originX,
            originY,
            muzzleX,
            muzzleY,
            delta: Math.hypot(originX - muzzleX, originY - muzzleY),
          });
        });
        if ((globalThis.__ddBurstAnchorRounds?.length ?? 0) < required)
          requestAnimationFrame(sample);
        else globalThis.__ddBurstAnchorSampling = false;
      };
      requestAnimationFrame(sample);
      arena.input.activePointer.rightButtonDown = () => true;
      globalThis.__ddBurstAnchorInputTimer = window.setInterval(
        () => arena.stepNetInput?.(50, false, false, 1, 0),
        50,
      );
    },
    { wanted: WEAPON_ID, required: REQUIRED_ROUNDS },
  );
  await page.keyboard.down("d");
}

async function releaseFireAndStrafe(page: Page): Promise<void> {
  await page.keyboard.up("d").catch(() => undefined);
  await page
    .evaluate(() => {
      globalThis.__ddBurstAnchorSampling = false;
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
      if (globalThis.__ddBurstAnchorInputTimer)
        window.clearInterval(globalThis.__ddBurstAnchorInputTimer);
      globalThis.__ddBurstAnchorInputTimer = undefined;
    })
    .catch(() => undefined);
}

test("every moving Overcasters burst round originates at its live rendered muzzle", async ({
  page,
}) => {
  await runArenaSpec(page, async (baseURL) => {
    await bootArena(page, baseURL, `weapon:${WEAPON_ID}`);
    await waitForDevWeapon(page, WEAPON_ID);
    try {
      await holdFireWhileStrafing(page);
      await expect
        .poll(() => page.evaluate(() => globalThis.__ddBurstAnchorRounds?.length ?? 0), {
          message: "three complete four-round bursts should render",
          timeout: 20_000,
        })
        .toBeGreaterThanOrEqual(REQUIRED_ROUNDS);
      const capture = await page.evaluate(() => ({
        frames: globalThis.__ddBurstAnchorFrames ?? [],
        rounds: globalThis.__ddBurstAnchorRounds ?? [],
      }));
      const first = capture.frames[0];
      const last = capture.frames.at(-1);
      if (!first || !last) throw new Error("moving burst capture has no character frames");
      expect(
        Math.hypot(last.x - first.x, last.y - first.y),
        "owner must move throughout",
      ).toBeGreaterThan(20);
      expect(capture.rounds).toHaveLength(REQUIRED_ROUNDS);
      const bornTicks = [...new Set(capture.rounds.map((round) => round.bornTick))].sort(
        (a, b) => a - b,
      );
      const burstStarts = bornTicks.filter((tick, index) => {
        const previous = bornTicks[index - 1];
        return index === 0 || (previous !== undefined && tick - previous > 1);
      });
      expect(burstStarts, "capture should contain three distinct accepted bursts").toHaveLength(3);
      expect(Math.max(...capture.rounds.map((round) => round.delta))).toBeLessThanOrEqual(2.5);
    } finally {
      await releaseFireAndStrafe(page);
    }
  });
});
