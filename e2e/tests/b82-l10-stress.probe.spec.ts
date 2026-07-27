import { expect, type Page, test } from "@playwright/test";
import { bootArena, runArenaSpec, waitForDevWeapon } from "../helpers/arena-harness.js";

const SAMPLE_MS = Number(process.env.B82_STRESS_MS ?? 30_000);
const WEAPON_ID = "x2-gravelthroat-repeater";
const ENEMY_BATCHES = [
  { kind: "critter", count: 8 },
  { kind: "mote-swarm", count: 8 },
  { kind: "pricklepulp", count: 8 },
  { kind: "boothill", count: 8 },
  { kind: "ronin", count: 8 },
  { kind: "gatlin", count: 8 },
] as const;

async function populateStressRoom(page: Page): Promise<void> {
  await page.evaluate(() => {
    const arena = (globalThis as any).ddGame.scene.getScene("arena") as any;
    arena.room.send("spawnBossDef", { kind: "seam-eater" });
  });
  for (const batch of ENEMY_BATCHES) {
    await page.evaluate((row) => {
      const arena = (globalThis as any).ddGame.scene.getScene("arena") as any;
      arena.room.send("debugSpawn", { ...row, distance: 420 });
    }, batch);
    await page.waitForTimeout(100);
  }
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const arena = (globalThis as any).ddGame.scene.getScene("arena") as any;
          return {
            boss: !!arena.room.state.wormBoss?.active,
            enemies: arena.room.state.enemies?.size ?? 0,
          };
        }),
      { message: "B82 stress room should contain its boss and mixed horde", timeout: 15_000 },
    )
    .toMatchObject({ boss: true, enemies: 49 });
}

test("B82 30-second SELF correction and long-frame stress trap", async ({ page }) => {
  test.setTimeout(Math.max(120_000, SAMPLE_MS + 60_000));
  await runArenaSpec(page, async (baseURL) => {
    await page.setViewportSize({ width: 640, height: 360 });
    await bootArena(page, baseURL, `weapon:${WEAPON_ID}`);
    await waitForDevWeapon(page, WEAPON_ID);
    await populateStressRoom(page);

    await page.evaluate(() => {
      const root = globalThis as any;
      const arena = root.ddGame.scene.getScene("arena") as any;
      const probe = {
        deltas: [] as number[],
        selfSteps: [] as number[],
        lastFrameAt: 0,
        lastSelfX: Number.NaN,
        lastSelfY: Number.NaN,
        raf: 0,
      };
      root.__b82StressProbe = probe;
      root.__b82StressAttack = window.setInterval(() => {
        const room = arena.room;
        const self = room?.state?.players?.get(room.sessionId);
        if (!self?.alive) return;
        let tx = self.x + 300;
        let ty = self.y;
        let best = Number.POSITIVE_INFINITY;
        room.state.enemies?.forEach((enemy: any) => {
          const dx = enemy.x - self.x;
          const dy = enemy.y - self.y;
          const distance = dx * dx + dy * dy;
          if (distance < best) {
            best = distance;
            tx = enemy.x;
            ty = enemy.y;
          }
        });
        const dx = tx - self.x;
        const dy = ty - self.y;
        const length = Math.hypot(dx, dy) || 1;
        room.send("attack", { aimX: dx / length, aimY: dy / length, tx, ty });
      }, 90);
      root.__b82StressParry = window.setInterval(() => arena.room?.send("parry"), 420);
      root.__b82StressRefill = window.setInterval(() => {
        const count = arena.room?.state?.enemies?.size ?? 0;
        if (count < 45)
          arena.room?.send("debugSpawn", {
            kind: "mote-swarm",
            count: Math.min(8, 49 - count),
            distance: 420,
          });
      }, 180);
      const sample = (now: number): void => {
        if (probe.lastFrameAt > 0) probe.deltas.push(now - probe.lastFrameAt);
        const x = Number(arena.selfPresentedWorldX);
        const y = Number(arena.selfPresentedWorldY);
        if (Number.isFinite(x) && Number.isFinite(y)) {
          if (Number.isFinite(probe.lastSelfX))
            probe.selfSteps.push(Math.hypot(x - probe.lastSelfX, y - probe.lastSelfY));
          probe.lastSelfX = x;
          probe.lastSelfY = y;
        }
        probe.lastFrameAt = now;
        probe.raf = requestAnimationFrame(sample);
      };
      probe.raf = requestAnimationFrame(sample);
    });

    const directions = [["d"], ["d", "s"], ["s"], ["s", "a"], ["a"], ["a", "w"], ["w"], ["w", "d"]];
    const held = new Set<string>();
    const deadline = Date.now() + SAMPLE_MS;
    let step = 0;
    while (Date.now() < deadline) {
      const wanted = directions[step % directions.length] ?? [];
      for (const key of held) {
        if (!wanted.includes(key)) {
          await page.keyboard.up(key);
          held.delete(key);
        }
      }
      for (const key of wanted) {
        if (!held.has(key)) {
          await page.keyboard.down(key);
          held.add(key);
        }
      }
      await page.waitForTimeout(Math.min(750, Math.max(0, deadline - Date.now())));
      step++;
    }
    for (const key of held) await page.keyboard.up(key);

    const result = await page.evaluate(() => {
      const root = globalThis as any;
      const arena = root.ddGame.scene.getScene("arena") as any;
      const probe = root.__b82StressProbe;
      cancelAnimationFrame(probe.raf);
      clearInterval(root.__b82StressAttack);
      clearInterval(root.__b82StressParry);
      clearInterval(root.__b82StressRefill);
      const over250 = probe.deltas.filter((delta: number) => delta > 250);
      return {
        frames: probe.deltas.length,
        maxFrameMs: Math.max(0, ...probe.deltas),
        over250,
        maxSelfStepPx: Math.max(0, ...probe.selfSteps),
        corrections: { ...(arena.selfCorrectionTelemetry?.snapshot?.() ?? {}) },
        readout:
          document.querySelector('[data-instrument="l10-self-corrections"]')?.textContent ?? "",
        enemies: arena.room?.state?.enemies?.size ?? 0,
        projectiles: arena.room?.state?.projectiles?.size ?? 0,
      };
    });
    console.log(`[b82-l10-stress] ${JSON.stringify(result)}`);

    expect(result.frames).toBeGreaterThan(300);
    expect(result.readout).toContain("L10 SELF");
    expect(result.enemies).toBeGreaterThanOrEqual(35);
  });
});
