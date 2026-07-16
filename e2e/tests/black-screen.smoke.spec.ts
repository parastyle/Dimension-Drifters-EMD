import { expect, test } from "@playwright/test";
import { startRealStack } from "../helpers/real-stack.js";

interface BrowserRoom {
  sessionId?: string;
  state?: {
    mode?: string;
    players?: { has(id: string): boolean };
    enemies?: {
      size: number;
      forEach(callback: (enemy: { kind?: string }) => void): void;
    };
  };
}

interface BrowserGame {
  scene: {
    isActive(key: string): boolean;
    getScene(key: string): { room?: BrowserRoom };
  };
}

function formatError(error: unknown): string {
  return error instanceof Error ? (error.stack ?? error.message) : String(error);
}

test("boots the real stack, launches a dimension, connects, and enters training", async ({
  page,
}) => {
  const stack = await startRealStack();
  if (stack.status === "skipped") test.skip(true, stack.reason);

  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(`[console] ${message.text()}`);
  });
  page.on("pageerror", (error) => browserErrors.push(`[pageerror] ${formatError(error)}`));

  let smokeFailure: unknown;
  let teardownFailure: unknown;
  try {
    await page.goto(stack.baseURL, { waitUntil: "domcontentloaded" });

    await expect(
      page.locator("#game-root canvas"),
      "Phaser must mount a visible canvas",
    ).toBeVisible();
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              (globalThis as unknown as { ddGame?: BrowserGame }).ddGame?.scene.isActive("menu") ??
              false,
          ),
        { message: "MenuScene should be active after browser boot" },
      )
      .toBe(true);

    // Exercise MenuScene's real number-key launch handler, including its fade and lazy ArenaScene import.
    await page.keyboard.press("1");

    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              (globalThis as unknown as { ddGame?: BrowserGame }).ddGame?.scene.isActive("arena") ??
              false,
          ),
        { message: "ArenaScene should become active through the menu launch path" },
      )
      .toBe(true);

    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const game = (globalThis as unknown as { ddGame?: BrowserGame }).ddGame;
            const room = game?.scene.getScene("arena").room;
            const sessionId = room?.sessionId;
            return !!sessionId && !!room.state?.players?.has(sessionId);
          }),
        { message: "ArenaScene room state should contain the connected browser session" },
      )
      .toBe(true);

    // Hold T across multiple frames so Phaser observes the physical key edge in its normal update loop.
    await page.keyboard.down("t");
    await page.waitForTimeout(100);
    await page.keyboard.up("t");

    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const game = (globalThis as unknown as { ddGame?: BrowserGame }).ddGame;
            const room = game?.scene.getScene("arena").room;
            let hasDummy = false;
            room?.state?.enemies?.forEach((enemy) => {
              if (enemy.kind === "dummy") hasDummy = true;
            });
            return {
              mode: room?.state?.mode ?? null,
              enemyCount: room?.state?.enemies?.size ?? 0,
              hasDummy,
            };
          }),
        { message: "T should enter training and synchronize at least one training target" },
      )
      .toMatchObject({ mode: "training", hasDummy: true });
  } catch (error) {
    smokeFailure = error;
  } finally {
    await page.close().catch((error: unknown) => {
      teardownFailure = error;
    });
    await stack.close().catch((error: unknown) => {
      teardownFailure = teardownFailure ?? error;
    });
  }

  if (browserErrors.length > 0) {
    const priorFailure = smokeFailure
      ? `\n\nPrior smoke failure:\n${formatError(smokeFailure)}`
      : "";
    throw new Error(`Browser emitted errors:\n${browserErrors.join("\n")}${priorFailure}`);
  }
  if (smokeFailure) throw smokeFailure;
  if (teardownFailure) throw teardownFailure;
});
