import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { bootArena, runArenaSpec, waitForDevWeapon } from "../helpers/arena-harness.js";

const OUTPUT_PATH = path.resolve(
  import.meta.dirname,
  "../../docs/perf/v7-coop-latency-client.json",
);
const MAIN_WEAPON = "x2-gravelthroat-repeater";
const RAW_PLAYERS = [
  { weapon: "x2-snakeoil-tincture-scepter", role: "zone" },
  { weapon: "x2-gravewax-seance-globe", role: "zone" },
  { weapon: "x2-stormcaller-tesla-gatling", role: "beam" },
  { weapon: "x2-rimewrit-grave-slab", role: "attack" },
] as const;
const ENEMY_BATCHES = [
  { kind: "critter", count: 8 },
  { kind: "mote-swarm", count: 8 },
  { kind: "pricklepulp", count: 8 },
  { kind: "boothill", count: 8 },
  { kind: "ronin", count: 8 },
  { kind: "gatlin", count: 8 },
] as const;

type WorkloadPhase = "idle" | "nonbeam" | "all";

interface RawControl {
  room: any;
  stop(): void;
}

function percentile(values: number[], fraction: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1));
  return sorted[index] ?? 0;
}

function summarize(values: number[]): Record<string, number> {
  if (values.length === 0) return { samples: 0, mean: 0, p50: 0, p95: 0, p99: 0, max: 0 };
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const round = (value: number) => Number(value.toFixed(4));
  return {
    samples: values.length,
    mean: round(mean),
    p50: round(percentile(values, 0.5)),
    p95: round(percentile(values, 0.95)),
    p99: round(percentile(values, 0.99)),
    max: round(Math.max(...values)),
  };
}

async function waitUntil(
  predicate: () => boolean,
  timeoutMs: number,
  label: string,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`${label} timed out after ${timeoutMs} ms`);
}

function nearestTarget(room: any): { aimX: number; aimY: number; tx: number; ty: number } {
  const self = room.state?.players?.get(room.sessionId);
  let tx = (self?.x ?? 0) + 300;
  let ty = self?.y ?? 0;
  let best = Number.POSITIVE_INFINITY;
  room.state?.enemies?.forEach((enemy: any) => {
    if (enemy.kind === "dummy") return;
    const dx = (enemy.x ?? 0) - (self?.x ?? 0);
    const dy = (enemy.y ?? 0) - (self?.y ?? 0);
    const d2 = dx * dx + dy * dy;
    if (d2 < best) {
      best = d2;
      tx = enemy.x ?? tx;
      ty = enemy.y ?? ty;
    }
  });
  const dx = tx - (self?.x ?? 0);
  const dy = ty - (self?.y ?? 0);
  const length = Math.hypot(dx, dy) || 1;
  return { aimX: dx / length, aimY: dy / length, tx, ty };
}

function startRawControl(
  room: any,
  role: "zone" | "beam" | "attack",
  phaseRef: { value: WorkloadPhase },
): RawControl {
  let seq = Number(room.state?.players?.get(room.sessionId)?.ackSeq ?? 0) >>> 0;
  const motionEpoch = Date.now();
  let beamHold = false;
  let beamReleasedAt = 0;
  const inputTimer = setInterval(() => {
    const target = nearestTarget(room);
    const motionAngle = ((Date.now() - motionEpoch) / 3200) % (Math.PI * 2);
    if (role === "beam") {
      let ownedRows = 0;
      let highestPhase = 0;
      room.state?.beams?.forEach((row: any) => {
        if (row.ownerId !== room.sessionId) return;
        ownedRows++;
        highestPhase = Math.max(highestPhase, row.phase ?? 0);
      });
      if (phaseRef.value !== "all") {
        beamHold = false;
        beamReleasedAt = Date.now();
      } else if (highestPhase >= 3) {
        if (beamHold) beamReleasedAt = Date.now();
        beamHold = false;
      } else if (ownedRows === 0 && Date.now() - beamReleasedAt >= 1800) {
        beamHold = true;
      }
    }
    seq = (seq + 1) >>> 0;
    room.send("input", {
      seq,
      dx: Math.cos(motionAngle),
      dy: Math.sin(motionAngle),
      jump: false,
      crouchHeld: false,
      pound: false,
      slide: false,
      slideHeld: false,
      fireHeld:
        (role === "zone" && phaseRef.value !== "idle") ||
        (role === "beam" && phaseRef.value === "all" && beamHold),
      aimX: target.aimX,
      aimY: target.aimY,
      targetX: target.tx,
      targetY: target.ty,
    });
  }, 50);
  const attackTimer = setInterval(() => {
    if (role !== "attack" || phaseRef.value === "idle") return;
    const target = nearestTarget(room);
    room.send("attack", target);
  }, 100);
  const parryTimer = setInterval(() => {
    if (role !== "beam" || phaseRef.value !== "all") room.send("parry");
  }, 2000);
  return {
    room,
    stop() {
      clearInterval(inputTimer);
      clearInterval(attackTimer);
      clearInterval(parryTimer);
    },
  };
}

async function connectRawPlayers(
  page: Page,
  phaseRef: { value: WorkloadPhase },
): Promise<{ controls: RawControl[]; rooms: any[] }> {
  const connection = await page.evaluate(() => {
    const arena = (globalThis as any).ddGame.scene.getScene("arena") as any;
    return { roomId: arena.room.roomId, url: location.href };
  });
  const gamePort = Number(new URL(connection.url).searchParams.get("port"));
  if (!Number.isFinite(gamePort) || gamePort <= 0)
    throw new Error("private game port missing from URL");
  const { Client } = await import(
    "../../packages/client/node_modules/colyseus.js/build/esm/index.mjs"
  );
  const controls: RawControl[] = [];
  const rooms: any[] = [];
  for (const spec of RAW_PLAYERS) {
    const client = new Client(`ws://127.0.0.1:${gamePort}`);
    const room = await client.joinById(connection.roomId);
    rooms.push(room);
    room.send("devEquip", { weapon: spec.weapon });
    await waitUntil(
      () => room.state?.players?.get(room.sessionId)?.weapon === spec.weapon,
      10_000,
      `raw client equip ${spec.weapon}`,
    );
    controls.push(startRawControl(room, spec.role, phaseRef));
  }
  return { controls, rooms };
}

async function populateRoom(page: Page): Promise<void> {
  await page.evaluate(() => {
    const arena = (globalThis as any).ddGame.scene.getScene("arena") as any;
    arena.room.send("spawnBossDef", { kind: "seam-eater" });
  });
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const arena = (globalThis as any).ddGame.scene.getScene("arena") as any;
          return !!arena.room.state.wormBoss?.active;
        }),
      { message: "Seam-Eater should activate for the frame benchmark", timeout: 10_000 },
    )
    .toBe(true);

  for (const batch of ENEMY_BATCHES) {
    await page.evaluate((value) => {
      const arena = (globalThis as any).ddGame.scene.getScene("arena") as any;
      arena.room.send("debugSpawn", value);
    }, batch);
    await page.waitForTimeout(80);
  }
  for (let attempt = 0; attempt < 12; attempt++) {
    const enemyRows = await page.evaluate(() => {
      const arena = (globalThis as any).ddGame.scene.getScene("arena") as any;
      return arena.room.state.enemies?.size ?? 0;
    });
    if (enemyRows >= 49) break;
    await page.evaluate((count) => {
      const arena = (globalThis as any).ddGame.scene.getScene("arena") as any;
      arena.room.send("debugSpawn", { kind: "mote-swarm", count });
    }, Math.min(8, 49 - enemyRows));
    await page.waitForTimeout(120);
  }
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const arena = (globalThis as any).ddGame.scene.getScene("arena") as any;
          return arena.room.state.enemies?.size ?? 0;
        }),
      { message: "heavy room should contain the mixed horde and boss", timeout: 15_000 },
    )
    .toBeGreaterThanOrEqual(45);

  await page.evaluate(() => {
    const root = globalThis as any;
    const arena = root.ddGame.scene.getScene("arena") as any;
    root.__ddPerfPopulationTimer = window.setInterval(() => {
      const enemies = arena.room?.state?.enemies?.size ?? 0;
      if (enemies < 45) {
        arena.room?.send("debugSpawn", { kind: "mote-swarm", count: Math.min(8, 49 - enemies) });
      }
      if (!arena.room?.state?.wormBoss?.active) {
        arena.room?.send("spawnBossDef", { kind: "seam-eater" });
      }
    }, 750);
  });
}

async function installPageProbe(page: Page): Promise<Record<string, unknown>> {
  return await page.evaluate(() => {
    const root = globalThis as any;
    const arena = root.ddGame.scene.getScene("arena") as any;
    const categoryMethods: Record<string, string[]> = {
      "player rigs/equip": ["syncBlobs", "equipWeapons", "animateBlobs"],
      "enemy rigs/telegraphs": ["syncEnemies", "interpolateEnemies", "animateEnemies"],
      projectiles: ["syncProjectiles", "moveProjectiles", "renderProjectileTells"],
      zones: ["syncZones"],
      beams: ["updateBeams"],
      "attack routing/VFX": ["routePlayerAttacks", "drainCombatFeedback", "updateCombatFx"],
      "HUD/UI/debug": [
        "updateHud",
        "updateRunState",
        "updateLevelWindow",
        "updateCarousel",
        "updateDebug",
      ],
    };
    const probe: any = {
      phase: null,
      current: {},
      depths: {},
      updateStart: 0,
      updateMs: 0,
      renderStart: 0,
      priorPostRender: 0,
      longTasks: [],
    };
    for (const [category, methods] of Object.entries(categoryMethods)) {
      for (const method of methods) {
        const original = arena[method];
        if (typeof original !== "function") continue;
        arena[method] = function perfWrappedMethod(...args: unknown[]) {
          probe.depths[category] = (probe.depths[category] ?? 0) + 1;
          const outermost = probe.depths[category] === 1;
          const started = outermost ? performance.now() : 0;
          try {
            return original.apply(this, args);
          } finally {
            if (outermost) {
              probe.current[category] =
                (probe.current[category] ?? 0) + performance.now() - started;
            }
            probe.depths[category]--;
          }
        };
      }
    }
    arena.events.on("preupdate", () => {
      probe.current = {};
      probe.updateStart = performance.now();
    });
    arena.events.on("postupdate", () => {
      probe.updateMs = performance.now() - probe.updateStart;
    });
    arena.game.events.on("prerender", () => {
      probe.renderStart = performance.now();
    });
    arena.game.events.on("postrender", () => {
      const now = performance.now();
      const phase = probe.phase;
      if (!phase) {
        probe.priorPostRender = now;
        return;
      }
      const rows = arena.room?.state?.beams;
      let activeBeams = 0;
      rows?.forEach((row: any) => {
        if (row.phase === 2) activeBeams++;
      });
      let friendlyProjectiles = 0;
      arena.room?.state?.projectiles?.forEach((row: any) => {
        if (!row.hostile) friendlyProjectiles++;
      });
      const qualifies =
        phase.name === "all"
          ? activeBeams >= 6
          : phase.name === "nonbeam"
            ? activeBeams === 0
            : activeBeams === 0;
      if (phase.skip > 0) phase.skip--;
      else if (qualifies && probe.priorPostRender > 0) {
        const categoryTotal = Object.values(probe.current).reduce(
          (sum: number, value: any) => sum + Number(value),
          0,
        );
        phase.frames.push({
          frameIntervalMs: now - probe.priorPostRender,
          updateMs: probe.updateMs,
          renderMs: now - probe.renderStart,
          residualUpdateMs: Math.max(0, probe.updateMs - categoryTotal),
          categories: { ...probe.current },
          entities: {
            players: arena.room?.state?.players?.size ?? 0,
            enemyRows: arena.room?.state?.enemies?.size ?? 0,
            projectiles: arena.room?.state?.projectiles?.size ?? 0,
            friendlyProjectiles,
            zones: arena.room?.state?.zones?.size ?? 0,
            beams: arena.room?.state?.beams?.size ?? 0,
            activeBeams,
            playerRigs: arena.blobs?.size ?? 0,
            enemyRigs: arena.enemies?.size ?? 0,
            projectileVisuals: arena.projectiles?.size ?? 0,
            zoneVisuals: arena.zones?.size ?? 0,
            visibleBeamEntries:
              arena.beamRenderer?.entries?.filter((entry: any) => entry.body?.visible).length ?? 0,
          },
        });
        if (phase.frames.length >= phase.target) {
          const resolve = phase.resolve;
          probe.phase = null;
          resolve(phase.frames);
        }
      }
      probe.priorPostRender = now;
    });
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) probe.longTasks.push(entry.duration);
      });
      observer.observe({ type: "longtask", buffered: false } as PerformanceObserverInit);
      probe.longTaskObserver = observer;
    } catch {
      probe.longTaskObserver = null;
    }
    root.__ddPerfProbe = probe;
    const canvas = arena.game.canvas as HTMLCanvasElement;
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    const debugInfo = gl?.getExtension("WEBGL_debug_renderer_info");
    return {
      userAgent: navigator.userAgent,
      devicePixelRatio,
      hardwareConcurrency: navigator.hardwareConcurrency,
      cssViewport: { width: innerWidth, height: innerHeight },
      backBuffer: {
        width: canvas.width,
        height: canvas.height,
        pixels: canvas.width * canvas.height,
      },
      webglVendor: debugInfo
        ? gl?.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)
        : gl?.getParameter(gl.VENDOR),
      webglRenderer: debugInfo
        ? gl?.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
        : gl?.getParameter(gl.RENDERER),
      feedbackSettings: arena.feedbackSettings,
    };
  });
}

async function setMainGun(page: Page, enabled: boolean): Promise<void> {
  await page.evaluate((nextEnabled) => {
    const root = globalThis as any;
    const arena = root.ddGame.scene.getScene("arena") as any;
    if (!root.__ddPerfMainController) {
      root.__ddPerfMainController = {
        enabled: false,
        motionEpoch: performance.now(),
      };
      root.__ddPerfMainInputTimer = window.setInterval(
        () => {
          arena.game.hasFocus = true;
          arena.pointerOverInteractiveUi = false;
          const motionAngle =
            ((performance.now() - root.__ddPerfMainController.motionEpoch) / 3200) %
            (Math.PI * 2);
          arena.stepNetInput?.(50, false, false, Math.cos(motionAngle), Math.sin(motionAngle));
        },
        50,
      );
      root.__ddPerfParryTimer = window.setInterval(() => arena.room?.send("parry"), 650);
      root.__ddPerfMainAttackTimer = window.setInterval(() => {
        if (!root.__ddPerfMainController.enabled) return;
        const self = arena.room?.state?.players?.get(arena.room.sessionId);
        if (!self?.alive) return;
        let tx = self.x + 300;
        let ty = self.y;
        let best = Number.POSITIVE_INFINITY;
        arena.room.state.enemies?.forEach((enemy: any) => {
          if (enemy.kind === "dummy") return;
          const dx = enemy.x - self.x;
          const dy = enemy.y - self.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < best) {
            best = d2;
            tx = enemy.x;
            ty = enemy.y;
          }
        });
        const dx = tx - self.x;
        const dy = ty - self.y;
        const length = Math.hypot(dx, dy) || 1;
        arena.room.send("attack", { aimX: dx / length, aimY: dy / length, tx, ty });
      }, 100);
    }
    root.__ddPerfMainController.enabled = nextEnabled;
  }, enabled);
}

async function collectPhase(
  page: Page,
  name: WorkloadPhase,
  targetFrames: number,
  timeoutMs: number,
): Promise<any[]> {
  return await page.evaluate(
    ({ phaseName, target, timeout }) => {
      const probe = (globalThis as any).__ddPerfProbe;
      if (!probe || probe.phase)
        throw new Error("page perf probe is unavailable or already collecting");
      return new Promise<any[]>((resolve, reject) => {
        const timer = window.setTimeout(() => {
          const collected = probe.phase?.name === phaseName ? probe.phase.frames.length : 0;
          if (probe.phase?.name === phaseName) probe.phase = null;
          reject(
            new Error(
              `phase ${phaseName} timed out at ${timeout} ms after ${collected}/${target} qualifying frames`,
            ),
          );
        }, timeout);
        probe.phase = {
          name: phaseName,
          target,
          skip: 10,
          frames: [],
          resolve: (frames: any[]) => {
            window.clearTimeout(timer);
            resolve(frames);
          },
        };
      });
    },
    { phaseName: name, target: targetFrames, timeout: timeoutMs },
  );
}

function summarizePhase(name: WorkloadPhase, frames: any[]): Record<string, unknown> {
  const categories = new Set<string>();
  for (const frame of frames)
    for (const key of Object.keys(frame.categories ?? {})) categories.add(key);
  const categorySummary = Object.fromEntries(
    [...categories]
      .map((category) => [
        category,
        summarize(frames.map((frame) => Number(frame.categories?.[category] ?? 0))),
      ])
      .sort((left, right) => Number((right[1] as any).mean) - Number((left[1] as any).mean)),
  );
  const intervals = frames.map((frame) => Number(frame.frameIntervalMs));
  const entityPeaks: Record<string, number> = {};
  for (const frame of frames) {
    for (const [key, value] of Object.entries(frame.entities ?? {})) {
      entityPeaks[key] = Math.max(entityPeaks[key] ?? 0, Number(value));
    }
  }
  return {
    name,
    frames: frames.length,
    frameIntervalMs: summarize(intervals),
    sceneUpdateMs: summarize(frames.map((frame) => Number(frame.updateMs))),
    phaserRenderMs: summarize(frames.map((frame) => Number(frame.renderMs))),
    residualUpdateMs: summarize(frames.map((frame) => Number(frame.residualUpdateMs))),
    missedFramePercent: Number(
      ((intervals.filter((value) => value > 20).length / intervals.length) * 100).toFixed(2),
    ),
    over33msPercent: Number(
      ((intervals.filter((value) => value > 33.34).length / intervals.length) * 100).toFixed(2),
    ),
    subsystemUpdateMs: categorySummary,
    entityPeaks,
  };
}

async function teardownPageProbe(page: Page): Promise<number[]> {
  return await page.evaluate(() => {
    const root = globalThis as any;
    if (root.__ddPerfPopulationTimer) window.clearInterval(root.__ddPerfPopulationTimer);
    if (root.__ddPerfMainInputTimer) window.clearInterval(root.__ddPerfMainInputTimer);
    if (root.__ddPerfMainAttackTimer) window.clearInterval(root.__ddPerfMainAttackTimer);
    if (root.__ddPerfParryTimer) window.clearInterval(root.__ddPerfParryTimer);
    root.__ddPerfProbe?.longTaskObserver?.disconnect?.();
    return [...(root.__ddPerfProbe?.longTasks ?? [])];
  });
}

test("V7 co-op VFX frame cost is measured under the matched heavy room", async ({ page }) => {
  test.setTimeout(420_000);
  await runArenaSpec(page, async (baseURL) => {
    await page.setViewportSize({ width: 640, height: 360 });
    await bootArena(page, baseURL, `weapon:${MAIN_WEAPON}`);
    await waitForDevWeapon(page, MAIN_WEAPON);
    const phaseRef: { value: WorkloadPhase } = { value: "idle" };
    const raw = await connectRawPlayers(page, phaseRef);
    let longTasks: number[] = [];
    let populationTimer: ReturnType<typeof setInterval> | undefined;
    try {
      // Keep movement/parry alive during setup, but do not let the benchmark weapons
      // erase the horde faster than the training summon budget can populate it.
      phaseRef.value = "idle";
      await setMainGun(page, false);
      await populateRoom(page);
      await page.waitForTimeout(1500);
      const environment = await installPageProbe(page);
      const populationRoom = raw.rooms[0];
      populationTimer = setInterval(() => {
        const enemies = populationRoom.state?.enemies?.size ?? 0;
        if (enemies < 45) {
          populationRoom.send("debugSpawn", {
            kind: "mote-swarm",
            count: Math.min(8, 49 - enemies),
          });
        }
      }, 150);

      const idleFrames = await collectPhase(page, "idle", 60, 60_000);

      phaseRef.value = "nonbeam";
      await setMainGun(page, true);
      const nonBeamFrames = await collectPhase(page, "nonbeam", 60, 60_000);

      phaseRef.value = "all";
      await expect
        .poll(
          () =>
            page.evaluate(() => {
              const arena = (globalThis as any).ddGame.scene.getScene("arena") as any;
              let active = 0;
              const beamPhases: number[] = [];
              arena.room.state.beams?.forEach((row: any) => {
                if (row.phase === 2) active++;
                beamPhases.push(row.phase);
              });
              const self = arena.room.state.players?.get(arena.room.sessionId);
              let beamOwnerAlive = false;
              let beamOwnerPresent = false;
              arena.room.state.players?.forEach((player: any) => {
                if (player.weapon === "x2-stormcaller-tesla-gatling") {
                  beamOwnerPresent = true;
                  beamOwnerAlive = !!player.alive;
                }
              });
              return {
                active,
                alive: !!self?.alive,
                weapon: self?.weapon ?? null,
                beamOwnerAlive,
                beamOwnerPresent,
                beamRows: beamPhases.length,
                beamPhases,
              };
            }),
          { message: "six-tip Stormcaller should reach its active phase", timeout: 15_000 },
        )
        .toMatchObject({
          active: 6,
          alive: true,
          weapon: MAIN_WEAPON,
          beamOwnerAlive: true,
          beamOwnerPresent: true,
          beamRows: 6,
        });
      const allFrames = await collectPhase(page, "all", 30, 120_000);
      await setMainGun(page, false);
      phaseRef.value = "idle";
      longTasks = await teardownPageProbe(page);

      const idle = summarizePhase("idle", idleFrames);
      const nonbeam = summarizePhase("nonbeam", nonBeamFrames);
      const all = summarizePhase("all", allFrames);
      const result = {
        measuredAt: new Date().toISOString(),
        environment,
        methodology: {
          viewportCss: "640x360",
          players: 5,
          ordinaryEnemyTarget: 48,
          boss: "seam-eater (twelve-slot worm)",
          phases: {
            idle: "Same population, no player weapon deliveries.",
            nonbeam:
              "Two channel zones + Gravelthroat pellets/muzzle flashes + Rimewrit blade extension.",
            all: "Nonbeam phase plus six simultaneously active Stormcaller beam structures.",
          },
          qualifyingLaw:
            "All-system frames require six authoritative phase-2 beam rows; idle/nonbeam frames require zero active beams.",
        },
        phases: { idle, nonbeam, all },
        deltas: {
          nonbeamMinusIdleFrameP95Ms: Number(
            ((nonbeam.frameIntervalMs as any).p95 - (idle.frameIntervalMs as any).p95).toFixed(4),
          ),
          allMinusNonbeamFrameP95Ms: Number(
            ((all.frameIntervalMs as any).p95 - (nonbeam.frameIntervalMs as any).p95).toFixed(4),
          ),
          allMinusIdleUpdateMeanMs: Number(
            ((all.sceneUpdateMs as any).mean - (idle.sceneUpdateMs as any).mean).toFixed(4),
          ),
          allMinusIdleRenderMeanMs: Number(
            ((all.phaserRenderMs as any).mean - (idle.phaserRenderMs as any).mean).toFixed(4),
          ),
        },
        longTasksMs: summarize(longTasks),
      };
      await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
      await writeFile(OUTPUT_PATH, `${JSON.stringify(result, null, 2)}\n`, "utf8");

      expect((all.entityPeaks as any).players).toBeGreaterThanOrEqual(5);
      expect((all.entityPeaks as any).enemyRows).toBeGreaterThanOrEqual(40);
      expect((all.entityPeaks as any).activeBeams).toBeGreaterThanOrEqual(6);
      expect((all.entityPeaks as any).zones).toBeGreaterThanOrEqual(2);
      expect(allFrames).toHaveLength(30);
    } finally {
      if (populationTimer) clearInterval(populationTimer);
      for (const control of raw.controls) control.stop();
      for (const room of raw.rooms) await room.leave().catch(() => undefined);
      if (longTasks.length === 0) await teardownPageProbe(page).catch(() => []);
    }
  });
});
