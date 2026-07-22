import { expect, type Page, test } from "@playwright/test";
import { bootArena, runArenaSpec, waitForDevWeapon } from "../helpers/arena-harness.js";

interface TwirlFrame {
  elapsedMs: number;
  rotations: number[];
}

interface TwirlSummary {
  rangeRad: number;
  onsetMs: number | null;
}

test.use({ viewport: { width: 640, height: 360 } });

async function prepareShot(page: Page): Promise<number> {
  await page.locator("#game-root canvas").click({ position: { x: 320, y: 180 } });
  await page.mouse.move(555, 180);
  return page.evaluate(() => {
    const arena = (
      globalThis as unknown as { ddGame: { scene: { getScene(key: string): unknown } } }
    ).ddGame.scene.getScene("arena") as {
      game: { hasFocus: boolean };
      input: { activePointer: { rightButtonDown(): boolean } };
      room: { sessionId: string; state: { players: { get(id: string): { attackSeq: number } } } };
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
    const state = globalThis as unknown as { __ddTwirlTimer?: number };
    state.__ddTwirlTimer = window.setInterval(
      () => arena.stepNetInput?.(50, false, false, 0, 0),
      50,
    );
    return arena.room.state.players.get(arena.room.sessionId).attackSeq;
  });
}

async function releaseAndSample(page: Page): Promise<TwirlFrame[]> {
  return page.evaluate(
    () =>
      new Promise<TwirlFrame[]>((resolve) => {
        const arena = (
          globalThis as unknown as { ddGame: { scene: { getScene(key: string): unknown } } }
        ).ddGame.scene.getScene("arena") as {
          input: { activePointer: { rightButtonDown(): boolean } };
          room: { sessionId: string };
          blobs: {
            get(id: string): { weapons: Array<{ img: { rotation: number } }> } | undefined;
          };
          stepNetInput?(
            deltaMs: number,
            blocked: boolean,
            ultimate: boolean,
            dx: number,
            dy: number,
          ): void;
        };
        const state = globalThis as unknown as { __ddTwirlTimer?: number };
        arena.input.activePointer.rightButtonDown = () => false;
        arena.stepNetInput?.(50, false, false, 0, 0);
        if (state.__ddTwirlTimer) window.clearInterval(state.__ddTwirlTimer);
        state.__ddTwirlTimer = undefined;
        const frames: TwirlFrame[] = [];
        const startedAt = performance.now();
        const sample = () => {
          const rig = arena.blobs.get(arena.room.sessionId);
          const elapsedMs = performance.now() - startedAt;
          if (rig)
            frames.push({
              elapsedMs,
              rotations: rig.weapons.map((weapon) => weapon.img.rotation),
            });
          if (elapsedMs < 1_500) requestAnimationFrame(sample);
          else resolve(frames);
        };
        requestAnimationFrame(sample);
      }),
  );
}

function summarize(frames: TwirlFrame[], hand: number): TwirlSummary {
  const samples = frames
    .map((frame) => ({ elapsedMs: frame.elapsedMs, value: frame.rotations[hand] }))
    .filter((sample): sample is { elapsedMs: number; value: number } =>
      Number.isFinite(sample.value),
    );
  const values: number[] = [];
  for (const sample of samples) {
    const prior = values.at(-1);
    let next = sample.value;
    if (prior !== undefined) {
      while (next - prior > Math.PI) next -= Math.PI * 2;
      while (next - prior < -Math.PI) next += Math.PI * 2;
    }
    values.push(next);
  }
  const baseline = values[0] ?? 0;
  const onset = values.findIndex((value) => Math.abs(value - baseline) >= 0.35);
  return {
    rangeRad: values.length ? Math.max(...values) - Math.min(...values) : 0,
    onsetMs: onset < 0 ? null : (samples[onset]?.elapsedMs ?? null),
  };
}

async function captureAcceptedShot(page: Page): Promise<TwirlFrame[]> {
  const startSeq = await prepareShot(page);
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const arena = (
            globalThis as unknown as { ddGame: { scene: { getScene(key: string): unknown } } }
          ).ddGame.scene.getScene("arena") as {
            room: {
              sessionId: string;
              state: { players: { get(id: string): { attackSeq: number } } };
            };
          };
          return arena.room.state.players.get(arena.room.sessionId).attackSeq;
        }),
      { message: "pistol shot should be accepted before the idle clock starts", timeout: 10_000 },
    )
    .toBeGreaterThan(startSeq);
  return releaseAndSample(page);
}

function assertVisibleTwirl(summary: TwirlSummary, label: string): void {
  expect(summary.onsetMs, `${label} should start about 0.5s after release`).not.toBeNull();
  expect(summary.onsetMs ?? 0, `${label} should not start during shot recovery`).toBeGreaterThan(
    350,
  );
  // Leave one stressed-browser frame of scheduling headroom above the authored ~1s quiet-window onset.
  expect(summary.onsetMs ?? 9_999, `${label} should start promptly`).toBeLessThan(1_100);
  expect(summary.rangeRad, `${label} should complete a visually dominant turn`).toBeGreaterThan(
    Math.PI * 1.75,
  );
}

test("a fired one-handed pistol visibly twirls after 0.5s quiet", async ({ page }) => {
  await runArenaSpec(page, async (baseURL) => {
    const weaponId = "x-gun-ricochet-pistol";
    await bootArena(page, baseURL, `weapon:${weaponId}`);
    await waitForDevWeapon(page, weaponId);
    const lead = summarize(await captureAcceptedShot(page), 0);
    console.log(`[pistol-twirl] one-hand ${JSON.stringify(lead)}`);
    assertVisibleTwirl(lead, "lead pistol");
  });
});

test("a dual pistol fixture twirls both hands with a slight stagger", async ({ page }) => {
  await runArenaSpec(page, async (baseURL) => {
    const weaponId = "x-gun-ricochet-pistol";
    await bootArena(page, baseURL, `weapon:${weaponId}`);
    await waitForDevWeapon(page, weaponId);
    await page.evaluate(() => {
      const arena = (
        globalThis as unknown as { ddGame: { scene: { getScene(key: string): unknown } } }
      ).ddGame.scene.getScene("arena") as {
        room: { sessionId: string };
        blobs: {
          get(id: string):
            | {
                weapons: Array<{
                  spriteId: string;
                  def: unknown;
                  img: { width: number; height: number };
                }>;
                equipLoadout(lead: unknown, off: unknown): void;
              }
            | undefined;
        };
      };
      const rig = arena.blobs.get(arena.room.sessionId);
      const current = rig?.weapons[0];
      if (!rig || !current) throw new Error("dual pistol live fixture is unavailable");
      const manifest = {
        parts: [
          {
            role: "part-1",
            file: "part-1.png",
            w: current.img.width,
            h: current.img.height,
            ox: 0,
            oy: 0,
          },
        ],
      };
      const piece = {
        spriteId: current.spriteId,
        def: current.def,
        manifest,
        partIndex: 0,
      };
      rig.equipLoadout(piece, piece);
    });
    const frames = await captureAcceptedShot(page);
    const lead = summarize(frames, 0);
    const off = summarize(frames, 1);
    console.log(`[pistol-twirl] dual ${JSON.stringify({ lead, off })}`);
    assertVisibleTwirl(lead, "lead pistol");
    assertVisibleTwirl(off, "off pistol");
    expect(Math.abs((off.onsetMs ?? 0) - (lead.onsetMs ?? 0))).toBeGreaterThanOrEqual(35);
    expect(Math.abs((off.onsetMs ?? 0) - (lead.onsetMs ?? 0))).toBeLessThanOrEqual(200);
  });
});
