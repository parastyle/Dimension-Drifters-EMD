import { expect, test } from "@playwright/test";
import { runArenaSpec } from "../helpers/arena-harness.js";

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

test("boots the real stack, launches a dimension, connects, and enters training", async ({
  page,
}) => {
  await runArenaSpec(page, async (baseURL) => {
    await page.goto(baseURL, { waitUntil: "domcontentloaded" });

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

    // Exercise MenuScene's real launch grammar (§63 metagame tabs): the menu opens on the Wardrobe
    // tab where digits apply gear presets; Escape closes to the Run tab, whose number keys launch a
    // dimension — including its fade and lazy ArenaScene import.
    await page.keyboard.press("Escape");
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const game = (globalThis as unknown as { ddGame?: BrowserGame }).ddGame;
            const menu = game?.scene.getScene("menu") as unknown as { menuTab?: string } | undefined;
            return menu?.menuTab ?? null;
          }),
        { message: "Escape should close Wardrobe to the Run destinations tab" },
      )
      .toBe("run");
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

    // A fresh profile auto-opens the first-run verb legend as a BLOCKING modal on arena entry (§62
    // onboarding) — dismiss it exactly as a player would (H), then wait out the input-release latch
    // before the next keystroke can land.
    await page.keyboard.press("h");
    await page.waitForTimeout(250);

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
  });
});
