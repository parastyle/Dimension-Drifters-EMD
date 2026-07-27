import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { bootArena, runArenaSpec } from "../helpers/arena-harness.js";

const SAMPLE_MS = Number(process.env.B81_SAMPLE_MS ?? 65_000);
const DIMENSION = process.env.B81_DIMENSION ?? "ashlands";
const LABEL = process.env.B81_PROFILE_LABEL ?? "probe";
const DEV_SPEC = process.env.B81_DEV_SPEC;
const ELECTRON_UA = process.env.B81_ELECTRON_UA === "1";
const [VIEWPORT_WIDTH, VIEWPORT_HEIGHT] = (process.env.B81_VIEWPORT ?? "640x360")
  .split("x")
  .map(Number);
const AUTO_ATTACK = process.env.B81_AUTO_ATTACK === "1";
const OUTPUT_PATH = path.resolve(
  process.env.B81_PROFILE_OUTPUT ??
    path.join(import.meta.dirname, `../../.tmp-bin/b81-${LABEL}-${DIMENSION}.json`),
);
const TRACE_PATH = path.resolve(
  process.env.B81_TRACE_OUTPUT ??
    path.join(import.meta.dirname, `../../.tmp-bin/b81-${LABEL}-${DIMENSION}-trace.json`),
);
const ALLOCATION_PATH = path.resolve(
  process.env.B81_ALLOCATION_OUTPUT ??
    path.join(import.meta.dirname, `../../.tmp-bin/b81-${LABEL}-${DIMENSION}-allocations.json`),
);
const SCREENSHOT_PATH = process.env.B81_SCREENSHOT_OUTPUT
  ? path.resolve(process.env.B81_SCREENSHOT_OUTPUT)
  : undefined;

if (ELECTRON_UA) {
  test.use({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/149.0.0.0 Electron/40.0.0 Safari/537.36",
  });
}

interface ProbeResult {
  environment: Record<string, unknown>;
  frames: Array<{
    atMs: number;
    deltaMs: number;
    updateMs: number;
    renderMs: number;
    heapBytes: number;
    serverTick: number;
    enemies: number;
    projectiles: number;
    pickups: number;
  }>;
  longTasks: Array<{ atMs: number; durationMs: number; name: string }>;
  forceResyncAtMs: number[];
  audioSweeps: Array<{ atMs: number; durationMs: number }>;
}

function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;
}

async function bootDimension(page: Page, baseURL: string, dimensionId: string): Promise<void> {
  await page.goto(baseURL, { waitUntil: "domcontentloaded" });
  await expect(
    page.locator("#game-root canvas"),
    "Phaser must mount a visible canvas",
  ).toBeVisible();
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const game = (globalThis as any).ddGame;
          return !!game?.scene?.isActive?.("menu");
        }),
      { message: "menu should become active", timeout: 30_000 },
    )
    .toBe(true);
  await page.evaluate((id) => {
    const menu = (globalThis as any).ddGame.scene.getScene("menu") as any;
    menu.launch(id, false, false, undefined, true);
  }, dimensionId);
  await expect
    .poll(
      () =>
        page
          .evaluate(() => {
            const game = (globalThis as any).ddGame;
            if (!game?.scene?.isActive?.("arena")) return false;
            const arena = game.scene.getScene("arena") as any;
            return !!arena.room?.sessionId && arena.room.state?.players?.has(arena.room.sessionId);
          })
          .catch(() => false),
      { message: `${dimensionId} arena should contain the connected session`, timeout: 30_000 },
    )
    .toBe(true);
}

async function installProbe(page: Page): Promise<Record<string, unknown>> {
  return await page.evaluate(() => {
    const root = globalThis as any;
    const arena = root.ddGame.scene.getScene("arena") as any;
    const probe = {
      frames: [] as ProbeResult["frames"],
      longTasks: [] as ProbeResult["longTasks"],
      forceResyncAtMs: [] as number[],
      audioSweeps: [] as ProbeResult["audioSweeps"],
      lastRafMs: 0,
      updateStartMs: 0,
      updateMs: 0,
      renderStartMs: 0,
      renderMs: 0,
      rafId: 0,
      longTaskObserver: null as PerformanceObserver | null,
    };
    root.__b81Probe = probe;

    const originalForceResync = arena.predictor.forceResync.bind(arena.predictor);
    arena.predictor.forceResync = () => {
      probe.forceResyncAtMs.push(performance.now());
      return originalForceResync();
    };

    const audio = arena.audio as any;
    if (audio && typeof audio.sweepStaleLoops === "function") {
      const originalSweep = audio.sweepStaleLoops.bind(audio);
      audio.sweepStaleLoops = () => {
        const started = performance.now();
        try {
          return originalSweep();
        } finally {
          probe.audioSweeps.push({
            atMs: started,
            durationMs: performance.now() - started,
          });
        }
      };
    }

    arena.events.on("preupdate", () => {
      probe.updateStartMs = performance.now();
    });
    arena.events.on("postupdate", () => {
      probe.updateMs = performance.now() - probe.updateStartMs;
    });
    arena.game.events.on("prerender", () => {
      probe.renderStartMs = performance.now();
    });
    arena.game.events.on("postrender", () => {
      probe.renderMs = performance.now() - probe.renderStartMs;
    });

    try {
      probe.longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          probe.longTasks.push({
            atMs: entry.startTime,
            durationMs: entry.duration,
            name: entry.name,
          });
        }
      });
      probe.longTaskObserver.observe({
        type: "longtask",
        buffered: false,
      } as PerformanceObserverInit);
    } catch {
      probe.longTaskObserver = null;
    }

    const sample = (now: number): void => {
      if (probe.lastRafMs > 0) {
        const deltaMs = now - probe.lastRafMs;
        const heapBytes = Number((performance as any).memory?.usedJSHeapSize ?? 0);
        probe.frames.push({
          atMs: now,
          deltaMs,
          updateMs: probe.updateMs,
          renderMs: probe.renderMs,
          heapBytes,
          serverTick: Number(arena.room?.state?.tick ?? 0),
          enemies: Number(arena.room?.state?.enemies?.size ?? 0),
          projectiles: Number(arena.room?.state?.projectiles?.size ?? 0),
          pickups: Number(arena.room?.state?.pickups?.size ?? 0),
        });
        if (deltaMs > 250) {
          performance.mark(`b81-spike-${probe.frames.length}`, { startTime: now });
          console.timeStamp(`b81-spike delta=${deltaMs.toFixed(3)}ms`);
        }
      }
      probe.lastRafMs = now;
      probe.rafId = requestAnimationFrame(sample);
    };
    probe.rafId = requestAnimationFrame(sample);

    const canvas = arena.game.canvas as HTMLCanvasElement;
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    const debugInfo = gl?.getExtension("WEBGL_debug_renderer_info");
    return {
      userAgent: navigator.userAgent,
      hardwareConcurrency: navigator.hardwareConcurrency,
      devicePixelRatio,
      viewport: { width: innerWidth, height: innerHeight },
      canvas: { width: canvas.width, height: canvas.height },
      webglVendor: debugInfo
        ? gl?.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)
        : gl?.getParameter(gl.VENDOR),
      webglRenderer: debugInfo
        ? gl?.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
        : gl?.getParameter(gl.RENDERER),
      dimensionId: arena.room?.state?.dimensionId,
      mode: arena.room?.state?.mode,
    };
  });
}

async function driveNormalPlay(page: Page, durationMs: number): Promise<void> {
  await page.locator("#game-root canvas").click({
    position: { x: Math.floor(VIEWPORT_WIDTH / 2), y: Math.floor(VIEWPORT_HEIGHT / 2) },
  });
  await page.evaluate(() => {
    const arena = (globalThis as any).ddGame.scene.getScene("arena") as any;
    if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend?.(arena.time?.now ?? 0);
    arena.verbs?.releaseInputLatchIf?.(true);
    arena.game.hasFocus = true;
  });
  if (AUTO_ATTACK) {
    await page.evaluate(() => {
      const root = globalThis as any;
      root.__b81AttackTimer = window.setInterval(() => {
        const arena = root.ddGame.scene.getScene("arena") as any;
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
      }, 120);
    });
  }
  const directions = [["d"], ["d", "s"], ["s"], ["s", "a"], ["a"], ["a", "w"], ["w"], ["w", "d"]];
  const held = new Set<string>();
  const deadline = Date.now() + durationMs;
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
    await page.waitForTimeout(Math.min(800, Math.max(0, deadline - Date.now())));
    step++;
  }
  for (const key of held) await page.keyboard.up(key);
  if (AUTO_ATTACK) {
    await page.evaluate(() => {
      const root = globalThis as any;
      window.clearInterval(root.__b81AttackTimer);
      root.__b81AttackTimer = undefined;
    });
  }
}

test("B81 rendered normal-play frame cadence probe", async ({ page }) => {
  test.setTimeout(Math.max(180_000, SAMPLE_MS + 90_000));
  await runArenaSpec(page, async (baseURL) => {
    await page.setViewportSize({ width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT });
    if (DEV_SPEC) await bootArena(page, baseURL, DEV_SPEC);
    else await bootDimension(page, baseURL, DIMENSION);

    const cdp =
      process.env.B81_CHROME_TRACE === "1" || process.env.B81_HEAP_PROFILE === "1"
        ? await page.context().newCDPSession(page)
        : undefined;
    if (cdp && process.env.B81_CHROME_TRACE === "1") {
      await cdp.send("Tracing.start", {
        categories: [
          "-*",
          "blink.user_timing",
          "devtools.timeline",
          "v8",
          "disabled-by-default-devtools.timeline",
          "disabled-by-default-v8.gc",
          "disabled-by-default-v8.cpu_profiler",
          "disabled-by-default-v8.cpu_profiler.hires",
        ].join(","),
        options: "sampling-frequency=1000",
        transferMode: "ReturnAsStream",
      });
    }
    if (cdp && process.env.B81_HEAP_PROFILE === "1") {
      await cdp.send("HeapProfiler.enable");
      await cdp.send("HeapProfiler.startSampling", {
        samplingInterval: 16_384,
        includeObjectsCollectedByMajorGC: true,
        includeObjectsCollectedByMinorGC: true,
      });
    }

    // Start the frame clock only after profiler setup: CDP startup itself can consume a long frame and is
    // not part of normal play. Conversely, stop the frame clock before serializing the profiler payload.
    const environment = await installProbe(page);
    await driveNormalPlay(page, SAMPLE_MS);

    const result = await page.evaluate((capturedEnvironment) => {
      const probe = (globalThis as any).__b81Probe as ProbeResult & {
        rafId: number;
        longTaskObserver: PerformanceObserver | null;
      };
      cancelAnimationFrame(probe.rafId);
      probe.longTaskObserver?.disconnect();
      return {
        environment: capturedEnvironment,
        frames: [...probe.frames],
        longTasks: [...probe.longTasks],
        forceResyncAtMs: [...probe.forceResyncAtMs],
        audioSweeps: [...probe.audioSweeps],
      };
    }, environment);

    let traceText = "";
    if (cdp && process.env.B81_CHROME_TRACE === "1") {
      const traceComplete = new Promise<string>((resolve) => {
        cdp.once("Tracing.tracingComplete", (event) => resolve(event.stream as string));
      });
      await cdp.send("Tracing.end");
      const stream = await traceComplete;
      while (true) {
        const chunk = await cdp.send("IO.read", { handle: stream });
        traceText += chunk.data;
        if (chunk.eof) break;
      }
      await cdp.send("IO.close", { handle: stream });
    }
    const allocationProfile =
      cdp && process.env.B81_HEAP_PROFILE === "1"
        ? await cdp.send("HeapProfiler.stopSampling")
        : undefined;

    const graphics = await page.evaluate(() => {
      const arena = (globalThis as any).ddGame.scene.getScene("arena") as any;
      const parameterCounts: Record<number, number> = {
        0: 7,
        1: 0,
        2: 0,
        3: 4,
        4: 2,
        5: 2,
        6: 3,
        7: 2,
        8: 0,
        9: 0,
        10: 6,
        11: 6,
        14: 0,
        15: 0,
        16: 2,
        17: 2,
        18: 1,
        21: 8,
        22: 6,
      };
      const ownLabels = new Map<unknown, string>();
      for (const key of Object.keys(arena)) {
        const value = arena[key];
        if (value && typeof value === "object") ownLabels.set(value, `arena.${key}`);
      }
      return arena.children.list
        .filter((child: any) => Array.isArray(child.commandBuffer))
        .map((child: any, index: number) => {
          const counts: Record<string, number> = {};
          const commands = child.commandBuffer as number[];
          for (let cursor = 0; cursor < commands.length; ) {
            const command = commands[cursor++] as number;
            counts[command] = (counts[command] ?? 0) + 1;
            cursor += parameterCounts[command] ?? 0;
          }
          return {
            index,
            label: ownLabels.get(child) ?? "",
            name: child.name ?? "",
            depth: child.depth,
            visible: child.visible,
            alpha: child.alpha,
            commandWords: commands.length,
            arcs: counts[0] ?? 0,
            lineTos: counts[4] ?? 0,
            moveTos: counts[5] ?? 0,
            fillRects: counts[3] ?? 0,
            fillTriangles: counts[10] ?? 0,
            strokeTriangles: counts[11] ?? 0,
          };
        })
        .sort(
          (left: any, right: any) =>
            right.arcs * 102 +
            right.lineTos +
            right.commandWords -
            (left.arcs * 102 + left.lineTos + left.commandWords),
        );
    });

    const deltas = result.frames.map((frame) => frame.deltaMs);
    const spikes = result.frames.filter((frame) => frame.deltaMs > 250);
    const spikeGaps = spikes.slice(1).map((frame, index) => frame.atMs - spikes[index].atMs);
    const summary = {
      label: LABEL,
      dimension: DIMENSION,
      sampleMs: SAMPLE_MS,
      autoAttack: AUTO_ATTACK,
      devSpec: DEV_SPEC ?? null,
      electronUa: ELECTRON_UA,
      frames: deltas.length,
      p50: percentile(deltas, 0.5),
      p95: percentile(deltas, 0.95),
      p99: percentile(deltas, 0.99),
      max: Math.max(0, ...deltas),
      over250: spikes.length,
      spikes: spikes.map((frame) => ({
        atMs: frame.atMs,
        deltaMs: frame.deltaMs,
        updateMs: frame.updateMs,
        renderMs: frame.renderMs,
        heapBytes: frame.heapBytes,
        serverTick: frame.serverTick,
        enemies: frame.enemies,
        projectiles: frame.projectiles,
        pickups: frame.pickups,
      })),
      spikeGaps,
      longTasks: result.longTasks,
      forceResyncAtMs: result.forceResyncAtMs,
      audioSweepCount: result.audioSweeps.length,
      audioSweepMaxMs: Math.max(0, ...result.audioSweeps.map((row) => row.durationMs)),
      environment,
      graphics,
    };
    await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
    await writeFile(OUTPUT_PATH, `${JSON.stringify({ summary, raw: result }, null, 2)}\n`, "utf8");
    if (traceText) {
      await mkdir(path.dirname(TRACE_PATH), { recursive: true });
      await writeFile(TRACE_PATH, traceText, "utf8");
    }
    if (allocationProfile) {
      await mkdir(path.dirname(ALLOCATION_PATH), { recursive: true });
      await writeFile(ALLOCATION_PATH, `${JSON.stringify(allocationProfile, null, 2)}\n`, "utf8");
    }
    if (SCREENSHOT_PATH) {
      await mkdir(path.dirname(SCREENSHOT_PATH), { recursive: true });
      await page.screenshot({ path: SCREENSHOT_PATH });
    }
    console.log(`[b81-frame-probe] ${JSON.stringify(summary)}`);

    expect(deltas.length, "the rendered browser must produce animation frames").toBeGreaterThan(
      Math.min(600, Math.floor(SAMPLE_MS / 50)),
    );
    if (!DEV_SPEC) expect(result.environment.dimensionId).toBe(DIMENSION);
    expect(result.environment.mode).toBe(DEV_SPEC ? "training" : "arena");
    expect(
      spikes,
      "normal rendered play must not stall beyond the predictor resync threshold",
    ).toEqual([]);
    expect(
      graphics
        .filter((row) => row.visible)
        .reduce((max, row) => Math.max(max, row.commandWords), 0),
      "static scene art must not remain as an oversized per-frame Graphics replay",
    ).toBeLessThan(4_096);
  });
});
