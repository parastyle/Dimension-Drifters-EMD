import { expect, type Page, test } from "@playwright/test";
import { startSpecStack } from "./spec-stack.js";

/** Minimal browser-side shapes shared by the feature specs (structural — the real classes live in @dd/shared). */
export interface BrowserPlayer {
  weapon?: string;
  x?: number;
  y?: number;
  xp?: number;
  level?: number;
  alive?: boolean;
  flexPending?: number;
  sigPending?: number;
  str?: number;
  dex?: number;
  int?: number;
  con?: number;
  luk?: number;
}

export interface BrowserRoom {
  sessionId?: string;
  send(type: string, message?: unknown): void;
  state?: {
    mode?: string;
    players?: {
      has(id: string): boolean;
      get(id: string): BrowserPlayer | undefined;
    };
    enemies?: {
      size: number;
      forEach(callback: (enemy: { kind?: string; x?: number; y?: number }) => void): void;
    };
    xpEchoes?: {
      size: number;
      forEach(
        callback: (echo: { collectorId?: string; delivered?: boolean; value?: number }) => void,
      ): void;
    };
    beams?: {
      get(id: string): { phase?: number; weaponId?: string; heat?: number } | undefined;
    };
    bossKind?: string;
    wormBoss?: {
      active?: boolean;
      activeMask?: number;
      segments?: {
        length: number;
        forEach(
          callback: (segment: {
            slot?: number;
            chain?: number;
            ordinal?: number;
            x?: number;
            y?: number;
          }) => void,
        ): void;
      };
    };
  };
}

export interface BrowserGame {
  scene: {
    isActive(key: string): boolean;
    getScene(key: string): { room?: BrowserRoom };
  };
}

export function formatError(error: unknown): string {
  return error instanceof Error ? (error.stack ?? error.message) : String(error);
}

/**
 * Run one feature spec against a freshly booted real stack with the smoke suite's console-error gate:
 * ANY browser console error or pageerror fails the spec, even when the state assertions all passed.
 * Mirrors black-screen.smoke.spec.ts teardown ordering (page first, then the stack).
 */
export async function runArenaSpec(
  page: Page,
  body: (baseURL: string) => Promise<void>,
): Promise<void> {
  const stack = await startSpecStack();
  if (stack.status === "skipped") {
    test.skip(true, stack.reason);
    return;
  }

  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(`[console] ${message.text()}`);
  });
  page.on("pageerror", (error) => browserErrors.push(`[pageerror] ${formatError(error)}`));

  let specFailure: unknown;
  let teardownFailure: unknown;
  try {
    await body(stack.baseURL);
  } catch (error) {
    specFailure = error;
  } finally {
    await page.close().catch((error: unknown) => {
      teardownFailure = error;
    });
    await stack.close().catch((error: unknown) => {
      teardownFailure = teardownFailure ?? error;
    });
  }

  if (browserErrors.length > 0) {
    const priorFailure = specFailure ? `\n\nPrior spec failure:\n${formatError(specFailure)}` : "";
    throw new Error(`Browser emitted errors:\n${browserErrors.join("\n")}${priorFailure}`);
  }
  if (specFailure) throw specFailure;
  if (teardownFailure) throw teardownFailure;
}

/**
 * Navigate with an optional §39 dev-portal deep-link (`?dev=weapon:<id>` / `boss:<kind>`) and wait
 * until the arena room is live for this session. The deep-link path skips the menu, enters the
 * Testing Grounds, and applies the requested asset — all through the real MenuScene/ArenaScene flow.
 */
export async function bootArena(page: Page, baseURL: string, devSpec?: string): Promise<void> {
  const url = devSpec ? `${baseURL}/?dev=${devSpec}` : baseURL;
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await expect(
    page.locator("#game-root canvas"),
    "Phaser must mount a visible canvas",
  ).toBeVisible();
  await waitForArenaLive(page);
  // A cold per-spec Vite instance broadcasts ONE full-reload once its first-load dependency optimize
  // pass lands (the arena chunk's deps are discovered at request time). That navigation wipes any
  // page-side probes/monkeypatches a spec installed. Absorb it deterministically: reload once ourselves
  // (the second document runs on the final optimized dep set) and then demand a navigation-quiet window
  // before handing the page to the spec body. This is bounded warm-up, not a semantic sleep.
  let lastNavigationAt = Date.now();
  const onNavigated = (): void => {
    lastNavigationAt = Date.now();
  };
  page.on("framenavigated", onNavigated);
  try {
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForArenaLive(page);
    await expect
      .poll(() => Date.now() - lastNavigationAt > 1_500, {
        message: "the dev server should stop issuing full-reload navigations",
        timeout: 30_000,
      })
      .toBe(true);
    await waitForArenaLive(page);
  } finally {
    page.off("framenavigated", onNavigated);
  }
}

/** Poll until the arena scene is active and this session's player row exists — navigation-tolerant. */
async function waitForArenaLive(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page
          .evaluate(() => {
            const game = (globalThis as unknown as { ddGame?: BrowserGame }).ddGame;
            if (!game?.scene.isActive("arena")) return false;
            const room = game.scene.getScene("arena").room;
            const sessionId = room?.sessionId;
            return !!sessionId && !!room?.state?.players?.has(sessionId);
          })
          .catch(() => false),
      { message: "arena room should contain the connected session", timeout: 30_000 },
    )
    .toBe(true);
}

/** Wait for the §39 deep-link's devEquip round-trip: training mode entered AND the weapon in hand. */
export async function waitForDevWeapon(page: Page, weaponId: string): Promise<void> {
  await expect
    .poll(
      () =>
        page
          .evaluate((wanted) => {
            const game = (globalThis as unknown as { ddGame?: BrowserGame }).ddGame;
            const room = game?.scene.getScene("arena").room;
            const self = room?.sessionId ? room.state?.players?.get(room.sessionId) : undefined;
            return { mode: room?.state?.mode ?? null, weapon: self?.weapon ?? null, wanted };
          }, weaponId)
          .catch(() => null),
      { message: `dev deep-link should enter training and equip ${weaponId}`, timeout: 30_000 },
    )
    .toMatchObject({ mode: "training", weapon: weaponId });
}

/**
 * Install a page-side auto-attacker: every 120ms it aims at the nearest non-dummy enemy and sends the
 * real "attack" message (the same wire path RMB uses). The server buffers + cooldown-gates it, so this
 * is spam-safe. `maxRange` optionally holds fire until the target is close (XP Echo auto-latch only
 * reaches 180px, so a spec that must BANK its kills waits for enemies to converge). Returns nothing;
 * call stopAutoAttack to tear it down.
 */
export async function startAutoAttack(
  page: Page,
  maxRange = Number.POSITIVE_INFINITY,
): Promise<void> {
  await page.evaluate((rangeLimit) => {
    const holder = globalThis as unknown as { ddGame?: BrowserGame; __ddAttackTimer?: number };
    if (holder.__ddAttackTimer) return;
    holder.__ddAttackTimer = window.setInterval(() => {
      const room = holder.ddGame?.scene.getScene("arena").room;
      const state = room?.state;
      const self = room?.sessionId ? state?.players?.get(room.sessionId) : undefined;
      if (!room || !state || !self || self.alive === false) return;
      let bestX = 0;
      let bestY = 0;
      let bestD2 = Number.POSITIVE_INFINITY;
      state.enemies?.forEach((enemy) => {
        if (enemy.kind === "dummy") return;
        const dx = (enemy.x ?? 0) - (self.x ?? 0);
        const dy = (enemy.y ?? 0) - (self.y ?? 0);
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD2) {
          bestD2 = d2;
          bestX = enemy.x ?? 0;
          bestY = enemy.y ?? 0;
        }
      });
      if (!Number.isFinite(bestD2) || bestD2 > rangeLimit * rangeLimit) return;
      const dx = bestX - (self.x ?? 0);
      const dy = bestY - (self.y ?? 0);
      const len = Math.hypot(dx, dy) || 1;
      room.send("attack", { aimX: dx / len, aimY: dy / len, tx: bestX, ty: bestY });
    }, 120);
  }, maxRange);
}

export async function stopAutoAttack(page: Page): Promise<void> {
  await page.evaluate(() => {
    const holder = globalThis as unknown as { __ddAttackTimer?: number };
    if (holder.__ddAttackTimer) {
      window.clearInterval(holder.__ddAttackTimer);
      holder.__ddAttackTimer = undefined;
    }
  });
}
