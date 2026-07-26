import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { runArenaSpec } from "../helpers/arena-harness.js";

const EVIDENCE_DIR = path.resolve("docs/sol-reports/b70-evidence");

interface ArenaSnapshot {
  roomId: string;
  sessionId: string;
  runId: string;
  x: number;
  y: number;
  hp: number;
  tick: number;
  mode: string;
  outcome: string;
  enemyCount: number;
  hasSelf: boolean;
}

interface BrowserPlayer {
  x?: number;
  y?: number;
  hp?: number;
}

interface BrowserRoom {
  roomId?: string;
  sessionId: string;
  connection: { close(): void };
  state: {
    tick?: number;
    mode?: string;
    outcome?: string;
    players?: {
      get(sessionId: string): BrowserPlayer | undefined;
      has(sessionId: string): boolean;
    };
    enemies?: {
      size: number;
      forEach(callback: (enemy: { kind?: string }) => void): void;
    };
  };
}

interface BrowserScene {
  menuTab?: string;
  room?: BrowserRoom;
  weaponManifestRunId?: string;
  verbs?: {
    isLegendOpen?(): boolean;
    toggleLegend?(now: number): void;
    releaseInputLatchIf?(release: boolean): void;
  };
  time?: { now: number };
  game?: { hasFocus: boolean };
  pointerOverInteractiveUi?: boolean;
}

interface BrowserGlobal {
  ddGame?: {
    scene: {
      isActive(key: string): boolean;
      getScene(key: string): BrowserScene;
    };
  };
}

async function snapshot(page: Page): Promise<ArenaSnapshot | null> {
  return page.evaluate(() => {
    const game = (globalThis as unknown as BrowserGlobal).ddGame;
    if (!game?.scene.isActive("arena")) return null;
    const arena = game.scene.getScene("arena");
    const room = arena.room;
    const self = room?.state?.players?.get(room.sessionId);
    if (!room || !self) return null;
    return {
      roomId: room.roomId ?? "",
      sessionId: room.sessionId ?? "",
      runId: arena.weaponManifestRunId ?? "",
      x: self.x ?? 0,
      y: self.y ?? 0,
      hp: self.hp ?? 0,
      tick: room.state.tick ?? 0,
      mode: room.state.mode ?? "",
      outcome: room.state.outcome ?? "",
      enemyCount: room.state.enemies?.size ?? 0,
      hasSelf: room.state.players.has(room.sessionId),
    };
  });
}

async function waitForArena(page: Page, label: string): Promise<ArenaSnapshot> {
  await expect
    .poll(() => snapshot(page), { message: label, timeout: 30_000 })
    .toMatchObject({
      roomId: expect.any(String),
      sessionId: expect.any(String),
      runId: expect.stringMatching(/^run_/),
      outcome: "active",
      hasSelf: true,
    });
  const current = await snapshot(page);
  if (!current) throw new Error(`${label}: live arena disappeared after readiness`);
  return current;
}

async function launchFromMenu(page: Page): Promise<ArenaSnapshot> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          return (globalThis as unknown as BrowserGlobal).ddGame?.scene.isActive("menu") ?? false;
        }),
      { message: "lobby should be active before launch" },
    )
    .toBe(true);
  await page.keyboard.press("Escape");
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const game = (globalThis as unknown as BrowserGlobal).ddGame;
          return game?.scene.getScene("menu")?.menuTab ?? null;
        }),
      { message: "Escape should expose the Run tab" },
    )
    .toBe("run");
  await page.keyboard.press("1");
  const current = await waitForArena(page, "menu launch should create a playable arena");
  await normalizeArenaInput(page);
  return current;
}

async function normalizeArenaInput(page: Page): Promise<void> {
  await page.evaluate(() => {
    const arena = (globalThis as unknown as BrowserGlobal).ddGame?.scene.getScene("arena");
    if (!arena) throw new Error("arena scene is unavailable");
    if (arena.verbs?.isLegendOpen?.() && arena.time) arena.verbs.toggleLegend?.(arena.time.now);
    arena.verbs?.releaseInputLatchIf?.(true);
    if (arena.game) arena.game.hasFocus = true;
    arena.pointerOverInteractiveUi = false;
  });
}

async function waitForEnemies(page: Page, label: string): Promise<void> {
  await expect
    .poll(async () => (await snapshot(page))?.enemyCount ?? 0, {
      message: label,
      timeout: 15_000,
    })
    .toBeGreaterThan(0);
}

async function proveMovement(page: Page, beforeX: number, label: string): Promise<void> {
  await normalizeArenaInput(page);
  await page.keyboard.down("d");
  await page.waitForTimeout(350);
  await page.keyboard.up("d");
  await expect
    .poll(async () => (await snapshot(page))?.x ?? beforeX, {
      message: label,
      timeout: 5_000,
    })
    .toBeGreaterThan(beforeX);
}

async function toggleTraining(page: Page, expectedMode: "arena" | "training"): Promise<void> {
  await normalizeArenaInput(page);
  await page.keyboard.down("t");
  await page.waitForTimeout(120);
  await page.keyboard.up("t");
  await expect
    .poll(
      async () => {
        const gameState = await page.evaluate(() => {
          const arena = (globalThis as unknown as BrowserGlobal).ddGame?.scene.getScene("arena");
          const room = arena?.room;
          let hasDummy = false;
          room?.state?.enemies?.forEach((enemy: { kind?: string }) => {
            if (enemy.kind === "dummy") hasDummy = true;
          });
          return { mode: room?.state?.mode ?? "", hasDummy };
        });
        return gameState;
      },
      { message: `T should enter ${expectedMode}`, timeout: 10_000 },
    )
    .toMatchObject(
      expectedMode === "training" ? { mode: "training", hasDummy: true } : { mode: "arena" },
    );
}

async function closeTransport(page: Page): Promise<void> {
  await page.evaluate(() => {
    const arena = (globalThis as unknown as BrowserGlobal).ddGame?.scene.getScene("arena");
    if (!arena?.room) throw new Error("arena transport is unavailable");
    arena.room.connection.close();
  });
}

test("refresh is fresh, transport loss resumes playably, and every reconnect state can escape", async ({
  page,
}) => {
  await runArenaSpec(page, async (baseURL) => {
    await page.goto(baseURL, { waitUntil: "domcontentloaded" });
    await expect(page.locator("#game-root canvas")).toBeVisible();

    // 1. A deliberate browser reload consumes the old token only as a fresh-playtest marker.
    const beforeRefresh = await launchFromMenu(page);
    await waitForEnemies(page, "the pre-refresh run should have a live spawn director");
    await page.reload({ waitUntil: "domcontentloaded" });
    const afterRefresh = await waitForArena(page, "reload should auto-launch a fresh private room");
    expect(afterRefresh.roomId).not.toBe(beforeRefresh.roomId);
    expect(afterRefresh.sessionId).not.toBe(beforeRefresh.sessionId);
    expect(afterRefresh.runId).not.toBe(beforeRefresh.runId);
    await waitForEnemies(page, "the fresh post-refresh run should spawn enemies");
    await proveMovement(page, afterRefresh.x, "post-refresh player should move");
    await toggleTraining(page, "training");
    await page.screenshot({ path: path.join(EVIDENCE_DIR, "after-refresh.png") });
    await page.locator("#session-escape").click();
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            return (globalThis as unknown as BrowserGlobal).ddGame?.scene.isActive("menu") ?? false;
          }),
        { message: "the permanent escape should reach the lobby" },
      )
      .toBe(true);

    // 2. A real WebSocket close on the same page keeps the exact session/run/body and remains playable.
    await launchFromMenu(page);
    await waitForEnemies(page, "the transport fixture should contain active enemies");
    const beforeLoss = await waitForArena(page, "transport fixture should be live");
    await closeTransport(page);
    await expect(page.locator("#reconnect-overlay")).toBeVisible();
    await expect(page.locator("#reconnect-message")).toContainText("Connection recovered", {
      timeout: 15_000,
    });
    const afterLoss = await waitForArena(page, "transport loss should recover the same room");
    expect(afterLoss).toMatchObject({
      roomId: beforeLoss.roomId,
      sessionId: beforeLoss.sessionId,
      runId: beforeLoss.runId,
      outcome: "active",
      hasSelf: true,
    });
    expect(afterLoss.hp).toBeGreaterThan(0);
    // The live simulation keeps running during the handshake, so nearby enemies may apply ordinary
    // knockback/damage. A respawn would jump back to the center disc; retaining the body stays local.
    expect(Math.hypot(afterLoss.x - beforeLoss.x, afterLoss.y - beforeLoss.y)).toBeLessThan(120);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, "after-transport-loss.png") });
    await proveMovement(page, afterLoss.x, "recovered player should move");
    await toggleTraining(page, "training");
    await page.locator("#session-escape").click();

    // 3. The reconnect surface itself has a DOM-owned abandon action that does not depend on room state.
    const beforeEscape = await launchFromMenu(page);
    await closeTransport(page);
    await expect(page.locator("#reconnect-overlay")).toBeVisible();
    await expect(page.locator("#reconnect-abandon")).toBeVisible();
    await page.screenshot({ path: path.join(EVIDENCE_DIR, "escape-hatch.png") });
    // A full high-DPI canvas capture can outlive the brief recovered toast. Dispatch the already-observed
    // DOM control directly afterward; its handler is deliberately independent of Phaser and room health.
    await page.evaluate(() => document.getElementById("reconnect-abandon")?.click());
    const afterEscape = await waitForArena(page, "reconnect abandon should create a fresh room");
    expect(afterEscape.roomId).not.toBe(beforeEscape.roomId);
    expect(afterEscape.sessionId).not.toBe(beforeEscape.sessionId);
    expect(afterEscape.runId).not.toBe(beforeEscape.runId);
    await proveMovement(page, afterEscape.x, "escape-hatch fresh player should move");
    await toggleTraining(page, "training");
    await page.locator("#session-escape").click();
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            return (globalThis as unknown as BrowserGlobal).ddGame?.scene.isActive("menu") ?? false;
          }),
        { message: "fresh escape-hatch session should still reach the lobby" },
      )
      .toBe(true);
  });
});
