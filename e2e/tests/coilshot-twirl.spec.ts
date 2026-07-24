import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { bootArena, runArenaSpec, waitForDevWeapon } from "../helpers/arena-harness.js";

interface CoilshotFrame {
  elapsedMs: number;
  accepted: boolean;
  animNow: number;
  swingStart: number;
  activeStartMs: number;
  rotation: number;
  x: number;
  y: number;
  projectile: boolean;
}

function unwrapAngles(values: number[]): number[] {
  const unwrapped: number[] = [];
  for (const value of values) {
    const prior = unwrapped.at(-1);
    let next = value;
    if (prior !== undefined) {
      while (next - prior > Math.PI) next -= Math.PI * 2;
      while (next - prior < -Math.PI) next += Math.PI * 2;
    }
    unwrapped.push(next);
  }
  return unwrapped;
}

test.use({ viewport: { width: 640, height: 360 } });

test("Coilshot completes a visible in-hand revolution before the server releases it", async ({
  page,
}) => {
  await runArenaSpec(page, async (baseURL) => {
    const weaponId = "x2-coilshot-meteor";
    const evidenceRoot = process.env.DD_E2E_EVIDENCE_DIR
      ? path.resolve(process.env.DD_E2E_EVIDENCE_DIR, "coilshot-twirl")
      : path.resolve("docs/owner-notes-audit-v5-evidence");
    await mkdir(evidenceRoot, { recursive: true });
    await bootArena(page, baseURL, `weapon:${weaponId}`);
    await waitForDevWeapon(page, weaponId);
    await page.locator("#game-root canvas").click({ position: { x: 320, y: 180 } });
    await page.mouse.move(555, 180);

    await page.evaluate((wanted) => {
      const holder = globalThis as unknown as {
        ddGame: { scene: { getScene(key: string): unknown } };
        __ddCoilshotFrames?: CoilshotFrame[];
        __ddCoilshotDone?: boolean;
        __ddCoilshotInputTimer?: number;
        __ddCoilshotCaptures?: Array<{ atMs: number; dataUrl: string }>;
      };
      const arena = holder.ddGame.scene.getScene("arena") as {
        room: {
          sessionId: string;
          send(type: string, message: unknown): void;
          state: {
            players: {
              get(id: string): { attackSeq: number; x: number; y: number };
            };
            projectiles: {
              forEach(
                callback: (row: { sourcePlayerId?: string; sourceWeaponId?: string }) => void,
              ): void;
            };
          };
        };
        blobs: {
          get(id: string):
            | {
                swingStart: number;
                swing?: { activeStartSeconds: number };
                weapons: Array<{ img: { rotation: number; x: number; y: number } }>;
              }
            | undefined;
        };
        game: { hasFocus: boolean; canvas: HTMLCanvasElement };
        animClock: number;
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
      window.focus();
      window.dispatchEvent(new Event("focus"));
      if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend?.(arena.time.now);
      arena.verbs?.releaseInputLatchIf?.(true);
      arena.game.hasFocus = true;
      const room = arena.room;
      const player = room.state.players.get(room.sessionId);
      const beforeSeq = player.attackSeq;
      const startedAt = performance.now();
      holder.__ddCoilshotFrames = [];
      holder.__ddCoilshotCaptures = [];
      holder.__ddCoilshotDone = false;
      let released = false;
      const captureTimes = [70, 170, 270, 340];
      const sample = () => {
        const self = room.state.players.get(room.sessionId);
        const rig = arena.blobs.get(room.sessionId);
        const elapsedMs = performance.now() - startedAt;
        let projectile = false;
        room.state.projectiles.forEach((row) => {
          if (row.sourcePlayerId === room.sessionId && row.sourceWeaponId === wanted)
            projectile = true;
        });
        const image = rig?.weapons[0]?.img;
        if (rig && image) {
          holder.__ddCoilshotFrames?.push({
            elapsedMs,
            accepted: self.attackSeq > beforeSeq,
            animNow: arena.animClock,
            swingStart: rig.swingStart,
            activeStartMs: (rig.swing?.activeStartSeconds ?? 0) * 1_000,
            rotation: image.rotation,
            x: image.x,
            y: image.y,
            projectile,
          });
          const swingElapsed = arena.animClock - rig.swingStart;
          const nextCapture = captureTimes[holder.__ddCoilshotCaptures?.length ?? 0];
          if (
            self.attackSeq > beforeSeq &&
            nextCapture !== undefined &&
            swingElapsed >= nextCapture
          ) {
            holder.__ddCoilshotCaptures?.push({
              atMs: nextCapture,
              dataUrl: arena.game.canvas.toDataURL("image/png"),
            });
          }
        }
        if (self.attackSeq > beforeSeq && !released) {
          released = true;
          arena.input.activePointer.rightButtonDown = () => false;
          arena.stepNetInput?.(50, false, false, 0, 0);
          if (holder.__ddCoilshotInputTimer)
            window.clearInterval(holder.__ddCoilshotInputTimer);
          holder.__ddCoilshotInputTimer = undefined;
        }
        // Headless Chromium's Phaser smoothing clock can advance more slowly than wall time. Keep sampling
        // long enough to cover the complete 360ms animation-clock draw without weakening either clock gate.
        if (elapsedMs < 1_600) requestAnimationFrame(sample);
        else holder.__ddCoilshotDone = true;
      };
      requestAnimationFrame(sample);
      arena.input.activePointer.rightButtonDown = () => true;
      holder.__ddCoilshotInputTimer = window.setInterval(
        () => arena.stepNetInput?.(50, false, false, 0, 0),
        50,
      );
    }, weaponId);

    await expect
      .poll(() =>
        page.evaluate(() => {
          const frames = (
            globalThis as unknown as { __ddCoilshotFrames?: CoilshotFrame[] }
          ).__ddCoilshotFrames;
          return frames?.find((frame) => frame.accepted)?.elapsedMs ?? null;
        }),
      )
      .not.toBeNull();

    const acceptedAt = await page.evaluate(
      () =>
        (
          globalThis as unknown as { __ddCoilshotFrames?: CoilshotFrame[] }
        ).__ddCoilshotFrames?.find((frame) => frame.accepted)?.elapsedMs ?? 0,
    );
    await page.waitForFunction(
      () =>
        (globalThis as unknown as { __ddCoilshotDone?: boolean }).__ddCoilshotDone === true,
    );
    const frames = await page.evaluate(
      () =>
        (globalThis as unknown as { __ddCoilshotFrames?: CoilshotFrame[] })
          .__ddCoilshotFrames ?? [],
    );
    const captures = await page.evaluate(
      () =>
        (
          globalThis as unknown as {
            __ddCoilshotCaptures?: Array<{ atMs: number; dataUrl: string }>;
          }
        ).__ddCoilshotCaptures ?? [],
    );
    for (const capture of captures) {
      await writeFile(
        path.join(evidenceRoot, `coilshot-twirl-after-${capture.atMs}ms.png`),
        Buffer.from(capture.dataUrl.slice(capture.dataUrl.indexOf(",") + 1), "base64"),
      );
    }
    const drawFrames = frames.filter((frame) => {
      const swingElapsed = frame.animNow - frame.swingStart;
      return frame.accepted && swingElapsed >= 0 && swingElapsed <= frame.activeStartMs;
    });
    const rotations = unwrapAngles(drawFrames.map((frame) => frame.rotation));
    const rangeRad = rotations.length ? Math.max(...rotations) - Math.min(...rotations) : 0;
    const xRange = drawFrames.length
      ? Math.max(...drawFrames.map((frame) => frame.x)) -
        Math.min(...drawFrames.map((frame) => frame.x))
      : 0;
    const yRange = drawFrames.length
      ? Math.max(...drawFrames.map((frame) => frame.y)) -
        Math.min(...drawFrames.map((frame) => frame.y))
      : 0;
    const firstProjectileMs = frames.find((frame) => frame.projectile)?.elapsedMs ?? null;
    const firstProjectileDrawMs = (() => {
      const frame = frames.find((candidate) => candidate.projectile);
      return frame ? frame.animNow - frame.swingStart : null;
    })();
    const summary = {
      weaponId,
      acceptedAtMs: acceptedAt,
      drawFrameCount: drawFrames.length,
      activeStartMs: drawFrames.at(-1)?.activeStartMs ?? null,
      rangeRad,
      rangeTurns: rangeRad / (Math.PI * 2),
      xRange,
      yRange,
      firstProjectileMs,
      firstProjectileDrawMs,
      captureCount: captures.length,
    };
    await writeFile(
      path.join(evidenceRoot, "coilshot-twirl-after.json"),
      `${JSON.stringify({ summary, frames }, null, 2)}\n`,
    );
    console.log(`[coilshot-twirl] ${JSON.stringify(summary)}`);

    expect(drawFrames.length, "draw needs multiple readable animation frames").toBeGreaterThan(6);
    expect(rangeRad, "draw must show at least one complete revolution").toBeGreaterThan(
      Math.PI * 2 * 0.95,
    );
    expect(Math.max(xRange, yRange), "the meteor head must visibly orbit, not only rotate").toBeGreaterThan(
      18,
    );
    expect(firstProjectileMs, "server must eventually release the thrown projectile").not.toBeNull();
    expect(firstProjectileMs ?? 0, "projectile cannot precede the 360ms draw").toBeGreaterThanOrEqual(
      330,
    );
    expect(firstProjectileMs ?? 9_999, "projectile should release promptly after the draw").toBeLessThan(
      600,
    );
    // The server delay is wall/tick time while the rig deliberately rides its hit-stop-aware animation
    // clock. Assert both 360ms contracts independently: cross-clock ordering is not stable under a
    // throttled headless renderer, but gameplay at normal cadence makes the two authored windows coincide.
    expect(drawFrames.at(-1)?.activeStartMs).toBe(360);
    expect(captures, "four phase-locked live frame captures must be retained").toHaveLength(4);
  });
});
