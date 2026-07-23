import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { bootArena, runArenaSpec, waitForDevWeapon } from "../helpers/arena-harness.js";

const MAX_MUZZLE_ERROR_PX = 2.5;
const MAX_ROTATION_ERROR_RAD = 0.01;
const EVIDENCE_DIR = path.resolve(
  import.meta.dirname,
  "../../docs/owner-notes-audit-v8-evidence/ranged-orders",
);

const CONE_WEAPONS = [
  { weaponId: "x2-gravelthroat-repeater", min: 1, max: 10, halfAngle: 0.48 },
  { weaponId: "x2-plaguespitter-flak-gun", min: 3, max: 7, halfAngle: 0.34 },
] as const;

const PARALLEL_WEAPONS = [
  { weaponId: "x2-sidewinder-spitfire", count: 2 },
  { weaponId: "x2-hailspitter-pepperbox", count: 7 },
] as const;

const GENERATED_WEAPONS = [
  { weaponId: "x2-brimstone-gallows-rifle", spriteId: "brimstone-flaming-cross" },
  { weaponId: "x2-frostfang-speargun", spriteId: "frostfang-pictured-harpoon" },
  { weaponId: "x2-galvanic-coachgun", spriteId: "galvanic-coachgun-electric-slug" },
  { weaponId: "x2-ironhide-buffalo-gun", spriteId: "ironhide-anti-tank-shell" },
  { weaponId: "x2-plaguespitter-flak-gun", spriteId: "plaguespitter-green-shot" },
  { weaponId: "x2-tesla-drumbore", spriteId: "tesla-drumbore-electric-particle" },
  { weaponId: "x2-tesla-faradayer", spriteId: "tesla-faradayer-hand-drawn-bolt" },
  { weaponId: "x2-thunderhead-lever-gun", spriteId: "thunderhead-blue-helix" },
  { weaponId: "x2-thunderhead-repeater-cannon", spriteId: "thunderhead-smoke-ring" },
  { weaponId: "x-gun-ricochet-pistol", spriteId: "ricochet-icicle" },
] as const;

interface LiveProjectile {
  id: string;
  bornTick: number;
  vx: number;
  vy: number;
  spawnOriginX: number;
  spawnOriginY: number;
  spawnMuzzleX: number;
  spawnMuzzleY: number;
  projectileSprite: string;
  textureKey: string;
  artRotation: number;
}

interface VolleyCapture {
  attackSeq: number;
  bornTick: number;
  projectiles: LiveProjectile[];
}

async function prepareWeapon(page: Page, baseURL: string, weaponId: string): Promise<void> {
  await bootArena(page, baseURL, `weapon:${weaponId}`);
  await waitForDevWeapon(page, weaponId);
  const canvas = page.locator("#game-root canvas");
  await canvas.click({ position: { x: 320, y: 180 } });
  await page.mouse.move(610, 180);
  await page.evaluate(() => {
    const arena = (
      globalThis as unknown as {
        ddGame: { scene: { getScene(key: string): unknown } };
      }
    ).ddGame.scene.getScene("arena") as {
      time: { now: number };
      game: { hasFocus: boolean };
      pointerOverInteractiveUi: boolean;
      verbs?: {
        isLegendOpen?(): boolean;
        toggleLegend?(timeMs: number): void;
        releaseInputLatchIf?(force: boolean): void;
      };
    };
    if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend?.(arena.time.now);
    arena.verbs?.releaseInputLatchIf?.(true);
    arena.game.hasFocus = true;
    arena.pointerOverInteractiveUi = false;
  });
  await page.waitForTimeout(250);
}

async function fireAndCapture(
  page: Page,
  weaponId: string,
  expectedMinimum: number,
): Promise<VolleyCapture> {
  const before = await page.evaluate(() => {
    const arena = (
      globalThis as unknown as {
        ddGame: { scene: { getScene(key: string): unknown } };
      }
    ).ddGame.scene.getScene("arena") as {
      room: {
        sessionId: string;
        state: {
          players: {
            get(id: string): { attackSeq: number; x: number; y: number } | undefined;
          };
        };
        send(type: string, payload: unknown): void;
      };
    };
    const self = arena.room.state.players.get(arena.room.sessionId);
    if (!self) throw new Error("live ranged gate has no local player");
    arena.room.send("attack", {
      aimX: 1,
      aimY: 0,
      tx: self.x + 900,
      ty: self.y,
    });
    return self.attackSeq;
  });

  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const capture = await page.evaluate((wanted) => {
      const arena = (
        globalThis as unknown as {
          ddGame: { scene: { getScene(key: string): unknown } };
        }
      ).ddGame.scene.getScene("arena") as {
        room: {
          sessionId: string;
          state: {
            players: { get(id: string): { attackSeq: number } | undefined };
            projectiles: {
              forEach(
                callback: (
                  row: {
                    sourcePlayerId: string;
                    sourceWeaponId: string;
                    bornTick: number;
                    vx: number;
                    vy: number;
                  },
                  id: string,
                ) => void,
              ): void;
            };
          };
        };
        projectiles: Map<
          string,
          {
            getData(key: string): unknown;
          }
        >;
      };
      let bornTick = -1;
      const rows: Array<{
        id: string;
        bornTick: number;
        vx: number;
        vy: number;
      }> = [];
      arena.room.state.projectiles.forEach((row, id) => {
        if (
          row.sourcePlayerId !== arena.room.sessionId ||
          row.sourceWeaponId !== wanted ||
          !arena.projectiles.has(id)
        )
          return;
        if (row.bornTick > bornTick) {
          bornTick = row.bornTick;
          rows.length = 0;
        }
        if (row.bornTick === bornTick) rows.push({ id, ...row });
      });
      const projectiles = rows.map((row) => {
        const rendered = arena.projectiles.get(row.id);
        if (!rendered) throw new Error(`missing rendered projectile ${row.id}`);
        const payload = rendered.getData("arcPayload") as
          | {
              list: Array<{
                type?: string;
                rotation?: number;
                texture?: { key?: string };
              }>;
            }
          | undefined;
        const painted = payload?.list.find(
          (child) => child.type === "Image" && child.texture?.key === `gun-generated:${wanted}`,
        );
        return {
          ...row,
          spawnOriginX: Number(rendered.getData("spawnOriginX")),
          spawnOriginY: Number(rendered.getData("spawnOriginY")),
          spawnMuzzleX: Number(rendered.getData("spawnMuzzleX")),
          spawnMuzzleY: Number(rendered.getData("spawnMuzzleY")),
          projectileSprite: String(rendered.getData("projectileSprite") ?? ""),
          textureKey: painted?.texture?.key ?? "",
          artRotation: Number(painted?.rotation),
        };
      });
      return {
        attackSeq: arena.room.state.players.get(arena.room.sessionId)?.attackSeq ?? 0,
        bornTick,
        projectiles,
      };
    }, weaponId);
    if (capture.attackSeq > before && capture.projectiles.length >= expectedMinimum) return capture;
    await page.waitForTimeout(16);
  }
  throw new Error(
    `${weaponId} did not retain ${expectedMinimum} simultaneously rendered projectile(s)`,
  );
}

function angleDelta(left: number, right: number): number {
  return Math.abs(Math.atan2(Math.sin(left - right), Math.cos(left - right)));
}

async function freezeAndScreenshot(page: Page, filename: string): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          const arena = (
            globalThis as unknown as {
              ddGame: { scene: { getScene(key: string): unknown } };
            }
          ).ddGame.scene.getScene("arena") as {
            scene: { pause(): void };
          };
          arena.scene.pause();
          resolve();
        });
      }),
  );
  await page.locator("#game-root canvas").screenshot({ path: path.join(EVIDENCE_DIR, filename) });
}

async function captureStormcaller(page: Page): Promise<{
  authoritativeCount: number;
  visibleCount: number;
  muzzleDeltas: number[];
}> {
  await page.evaluate(() => {
    const holder = globalThis as unknown as {
      ddGame: { scene: { getScene(key: string): unknown } };
      __rangedBeamInput?: number;
    };
    const arena = holder.ddGame.scene.getScene("arena") as {
      input: { activePointer: { rightButtonDown(): boolean } };
      stepNetInput?(
        deltaMs: number,
        blocked: boolean,
        ultimate: boolean,
        dx: number,
        dy: number,
      ): void;
    };
    arena.input.activePointer.rightButtonDown = () => true;
    holder.__rangedBeamInput = window.setInterval(
      () => arena.stepNetInput?.(50, false, false, 0, 0),
      50,
    );
  });
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const arena = (
            globalThis as unknown as {
              ddGame: { scene: { getScene(key: string): unknown } };
            }
          ).ddGame.scene.getScene("arena") as {
            room: {
              sessionId: string;
              state: {
                beams: {
                  forEach(callback: (row: { ownerId: string; phase: number }) => void): void;
                };
              };
            };
          };
          let active = 0;
          arena.room.state.beams.forEach((row) => {
            if (row.ownerId === arena.room.sessionId && row.phase === 2) active++;
          });
          return active;
        }),
      { message: "Stormcaller should expose six active authoritative beams", timeout: 15_000 },
    )
    .toBe(6);

  return await page.evaluate(() => {
    const arena = (
      globalThis as unknown as {
        ddGame: { scene: { getScene(key: string): unknown } };
      }
    ).ddGame.scene.getScene("arena") as {
      room: {
        sessionId: string;
        state: {
          beams: {
            forEach(callback: (row: { ownerId: string; phase: number }) => void): void;
          };
        };
      };
      blobs: {
        get(id: string):
          | {
              writeWeaponMuzzle(
                hand: 0 | 1,
                out: { x: number; y: number },
                pointIndex?: number,
              ): boolean;
            }
          | undefined;
      };
      beamRenderer: {
        entries: Array<{
          key: string;
          ownerId: string;
          body: {
            visible: boolean;
            x: number;
            y: number;
            scaleX: number;
            scaleY: number;
            points?: Array<{ x: number; y: number }>;
          };
        }>;
      };
    };
    let authoritativeCount = 0;
    arena.room.state.beams.forEach((row) => {
      if (row.ownerId === arena.room.sessionId && row.phase === 2) authoritativeCount++;
    });
    const entries = arena.beamRenderer.entries.filter(
      (entry) =>
        entry.key &&
        entry.ownerId === arena.room.sessionId &&
        entry.body.visible &&
        entry.body.points?.[0],
    );
    const rig = arena.blobs.get(arena.room.sessionId);
    if (!rig) throw new Error("missing Stormcaller live rig");
    const muzzleDeltas = entries.map((entry) => {
      const match = /:barrel:(\d+):/.exec(entry.key);
      const barrelIndex = match ? Number(match[1]) : 0;
      const muzzle = { x: 0, y: 0 };
      if (!rig.writeWeaponMuzzle(0, muzzle, barrelIndex))
        throw new Error(`missing Stormcaller muzzle ${barrelIndex}`);
      const point = entry.body.points?.[0];
      if (!point) throw new Error(`missing Stormcaller beam point ${barrelIndex}`);
      const origin = {
        x: entry.body.x + point.x * entry.body.scaleX,
        y: entry.body.y + point.y * entry.body.scaleY,
      };
      return Math.hypot(origin.x - muzzle.x, origin.y - muzzle.y);
    });
    return {
      authoritativeCount,
      visibleCount: entries.length,
      muzzleDeltas,
    };
  });
}

test("Batch R cone, parallel-lane, generated-art, and six-beam orders hold live", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await runArenaSpec(page, async (baseURL) => {
    await mkdir(EVIDENCE_DIR, { recursive: true });
    await page.setViewportSize({ width: 640, height: 360 });
    const coneCaptures: Array<Record<string, unknown>> = [];
    const parallelCaptures: Array<Record<string, unknown>> = [];
    const generatedCaptures: Array<Record<string, unknown>> = [];

    for (const expected of CONE_WEAPONS) {
      await prepareWeapon(page, baseURL, expected.weaponId);
      const capture = await fireAndCapture(page, expected.weaponId, expected.min);
      await freezeAndScreenshot(page, `cone-${expected.weaponId}.png`);
      const angles = capture.projectiles.map((projectile) =>
        Math.atan2(projectile.vy, projectile.vx),
      );
      const maxAbsoluteAngle = Math.max(...angles.map(Math.abs));
      coneCaptures.push({ ...expected, ...capture, maxAbsoluteAngle });
      expect(capture.projectiles.length, `${expected.weaponId} count floor`).toBeGreaterThanOrEqual(
        expected.min,
      );
      expect(capture.projectiles.length, `${expected.weaponId} count cap`).toBeLessThanOrEqual(
        expected.max,
      );
      expect(maxAbsoluteAngle, `${expected.weaponId} cone half-angle`).toBeLessThanOrEqual(
        expected.halfAngle,
      );
      expect(
        capture.projectiles.every((projectile) => projectile.vx > 0),
        `${expected.weaponId} forward-only`,
      ).toBe(true);
    }

    for (const expected of PARALLEL_WEAPONS) {
      await prepareWeapon(page, baseURL, expected.weaponId);
      const capture = await fireAndCapture(page, expected.weaponId, expected.count);
      await freezeAndScreenshot(page, `parallel-${expected.weaponId}.png`);
      const headings = capture.projectiles.map((projectile) =>
        Math.atan2(projectile.vy, projectile.vx),
      );
      const origins = new Set(
        capture.projectiles.map(
          (projectile) =>
            `${projectile.spawnMuzzleX.toFixed(3)},${projectile.spawnMuzzleY.toFixed(3)}`,
        ),
      );
      const maxHeadingDelta = Math.max(
        ...headings.map((heading) => angleDelta(heading, headings[0] ?? heading)),
      );
      parallelCaptures.push({ ...expected, ...capture, maxHeadingDelta });
      expect(capture.projectiles, `${expected.weaponId} lane count`).toHaveLength(expected.count);
      expect(origins.size, `${expected.weaponId} distinct art-space origins`).toBe(expected.count);
      expect(maxHeadingDelta, `${expected.weaponId} parallel headings`).toBeLessThanOrEqual(1e-6);
    }

    for (const expected of GENERATED_WEAPONS) {
      await prepareWeapon(page, baseURL, expected.weaponId);
      const capture = await fireAndCapture(page, expected.weaponId, 1);
      await freezeAndScreenshot(page, `projectile-${expected.weaponId}.png`);
      const projectile = capture.projectiles[0];
      if (!projectile) throw new Error(`${expected.weaponId} produced no live projectile`);
      const velocityAngle = Math.atan2(projectile.vy, projectile.vx);
      const muzzleDelta = Math.hypot(
        projectile.spawnOriginX - projectile.spawnMuzzleX,
        projectile.spawnOriginY - projectile.spawnMuzzleY,
      );
      const rotationDelta = angleDelta(projectile.artRotation, velocityAngle);
      generatedCaptures.push({
        ...expected,
        attackSeq: capture.attackSeq,
        bornTick: capture.bornTick,
        projectile,
        muzzleDelta,
        rotationDelta,
      });
      expect(projectile.projectileSprite, `${expected.weaponId} sprite identity`).toBe(
        expected.spriteId,
      );
      expect(projectile.textureKey, `${expected.weaponId} painted texture`).toBe(
        `gun-generated:${expected.weaponId}`,
      );
      expect(muzzleDelta, `${expected.weaponId} muzzle origin`).toBeLessThanOrEqual(
        MAX_MUZZLE_ERROR_PX,
      );
      expect(rotationDelta, `${expected.weaponId} art rotation`).toBeLessThanOrEqual(
        MAX_ROTATION_ERROR_RAD,
      );
    }

    await prepareWeapon(page, baseURL, "x2-stormcaller-tesla-gatling");
    const stormcaller = await captureStormcaller(page);
    await freezeAndScreenshot(page, "stormcaller-six-beams.png");
    expect(stormcaller.authoritativeCount).toBe(6);
    expect(stormcaller.visibleCount).toBe(6);
    expect(Math.max(...stormcaller.muzzleDeltas)).toBeLessThanOrEqual(MAX_MUZZLE_ERROR_PX);

    await writeFile(
      path.join(EVIDENCE_DIR, "ranged-orders-live-capture.json"),
      `${JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          privateBaseURL: baseURL,
          thresholds: {
            maxMuzzleErrorPx: MAX_MUZZLE_ERROR_PX,
            maxRotationErrorRad: MAX_ROTATION_ERROR_RAD,
          },
          coneCaptures,
          parallelCaptures,
          generatedCaptures,
          stormcaller,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  });
});
