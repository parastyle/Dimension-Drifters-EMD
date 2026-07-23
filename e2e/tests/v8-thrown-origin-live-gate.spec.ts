import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { bootArena, runArenaSpec, waitForDevWeapon } from "../helpers/arena-harness.js";

const THROWN_IDS = [
  "x2-iron-throwing-star",
  "x2-fire-throwing-star",
  "x2-ice-throwing-star",
  "x2-void-throwing-star",
  "x2-kunai",
] as const;
const EVIDENCE_DIR = path.resolve("docs/owner-notes-audit-v8-evidence/thrown-and-sniper");
const MAX_THROW_ORIGIN_ERROR_PX = 0.25;
const MIN_FLIGHT_TRAVEL_PX = 18;

interface Point {
  x: number;
  y: number;
}

interface ThrowAnchor extends Point {
  weaponId: string;
  wallMs: number;
}

interface ThrowCapture {
  id: string;
  projectileId: string;
  attackSeq: number;
  kind: string;
  sourcePlayerId: string;
  sourceWeaponId: string;
  anchorKind: string;
  releaseAnchor: Point;
  spawnOrigin: Point;
  spawnThrow: Point;
  authoritativeFirst: Point;
  releaseErrorPx: number;
  originMetadataErrorPx: number;
  authoritativeLeadPx: number;
  flightTravelPx: number;
}

interface BrowserProjectileRow {
  kind: string;
  sourcePlayerId: string;
  sourceWeaponId: string;
}

interface BrowserProjectileView extends Point {
  getData(key: string): unknown;
}

interface BrowserArena {
  blobs: { get(id: string): unknown };
  game: { hasFocus: boolean };
  pointerOverInteractiveUi: boolean;
  projectiles: { get(id: string): BrowserProjectileView | undefined };
  room: {
    sessionId: string;
    send(type: string, message: unknown): void;
    state: {
      players: {
        get(id: string): { attackSeq: number; weapon: string; x: number; y: number } | undefined;
      };
      projectiles: {
        forEach(callback: (row: BrowserProjectileRow, id: string) => void): void;
      };
    };
  };
  time: { now: number };
  verbs?: {
    isLegendOpen?(): boolean;
    releaseInputLatchIf?(release: boolean): void;
    toggleLegend?(nowMs: number): void;
  };
  writeLiveThrownOrigin(rig: unknown): Point;
}

interface BrowserGlobal {
  ddGame: { scene: { getScene(key: string): BrowserArena } };
  __v8ThrowAnchors?: ThrowAnchor[];
  __v8ThrowCapture?: Omit<ThrowCapture, "id" | "flightTravelPx">;
  __v8ThrowFlightTravel?: number;
  __v8ThrowProbe?: number;
}

async function prepareThrownWeapon(page: Page, baseURL: string, id: string): Promise<void> {
  await bootArena(page, baseURL, `weapon:${id}`);
  await waitForDevWeapon(page, id);
  const canvas = page.locator("#game-root canvas");
  await canvas.click({ position: { x: 320, y: 180 } });
  await page.mouse.move(610, 180);
  await page.waitForTimeout(350);
}

async function mountThrowProbe(page: Page, id: string): Promise<number> {
  return page.evaluate((weaponId) => {
    const holder = globalThis as unknown as BrowserGlobal;
    const arena = holder.ddGame.scene.getScene("arena");
    if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend?.(arena.time.now);
    arena.verbs?.releaseInputLatchIf?.(true);
    arena.game.hasFocus = true;
    arena.pointerOverInteractiveUi = false;
    const self = arena.room.state.players.get(arena.room.sessionId);
    const rig = arena.blobs.get(arena.room.sessionId);
    if (!self || !rig || self.weapon !== weaponId)
      throw new Error(`${weaponId} live throw rig/player was not mounted`);

    holder.__v8ThrowAnchors = [];
    holder.__v8ThrowCapture = undefined;
    holder.__v8ThrowFlightTravel = 0;
    const original = arena.writeLiveThrownOrigin.bind(arena);
    arena.writeLiveThrownOrigin = (sourceRig: unknown) => {
      const point = original(sourceRig);
      holder.__v8ThrowAnchors?.push({
        weaponId,
        x: point.x,
        y: point.y,
        wallMs: performance.now(),
      });
      return point;
    };

    holder.__v8ThrowProbe = window.setInterval(() => {
      const player = arena.room.state.players.get(arena.room.sessionId);
      const captured = holder.__v8ThrowCapture;
      if (captured) {
        const rendered = arena.projectiles.get(captured.projectileId);
        if (rendered)
          holder.__v8ThrowFlightTravel = Math.max(
            holder.__v8ThrowFlightTravel ?? 0,
            Math.hypot(rendered.x - captured.spawnOrigin.x, rendered.y - captured.spawnOrigin.y),
          );
        return;
      }
      if (!player) return;
      arena.room.state.projectiles.forEach((row, projectileId) => {
        if (
          holder.__v8ThrowCapture ||
          row.sourcePlayerId !== arena.room.sessionId ||
          row.sourceWeaponId !== weaponId
        )
          return;
        const rendered = arena.projectiles.get(projectileId);
        const releaseAnchor = holder.__v8ThrowAnchors?.at(-1);
        if (!rendered || !releaseAnchor) return;
        const spawnOrigin = {
          x: Number(rendered.getData("spawnOriginX")),
          y: Number(rendered.getData("spawnOriginY")),
        };
        const spawnThrow = {
          x: Number(rendered.getData("spawnThrowX")),
          y: Number(rendered.getData("spawnThrowY")),
        };
        const authoritativeFirst = {
          x: Number(rendered.getData("authoritativeFirstX")),
          y: Number(rendered.getData("authoritativeFirstY")),
        };
        if (
          ![
            spawnOrigin.x,
            spawnOrigin.y,
            spawnThrow.x,
            spawnThrow.y,
            authoritativeFirst.x,
            authoritativeFirst.y,
          ].every(Number.isFinite)
        )
          return;
        holder.__v8ThrowCapture = {
          projectileId,
          attackSeq: player.attackSeq,
          kind: row.kind,
          sourcePlayerId: row.sourcePlayerId,
          sourceWeaponId: row.sourceWeaponId,
          anchorKind: String(rendered.getData("spawnAnchorKind") ?? ""),
          releaseAnchor: { x: releaseAnchor.x, y: releaseAnchor.y },
          spawnOrigin,
          spawnThrow,
          authoritativeFirst,
          releaseErrorPx: Math.hypot(
            spawnThrow.x - releaseAnchor.x,
            spawnThrow.y - releaseAnchor.y,
          ),
          originMetadataErrorPx: Math.hypot(
            spawnOrigin.x - spawnThrow.x,
            spawnOrigin.y - spawnThrow.y,
          ),
          authoritativeLeadPx: Math.hypot(
            authoritativeFirst.x - spawnOrigin.x,
            authoritativeFirst.y - spawnOrigin.y,
          ),
        };
      });
    }, 5);
    return self.attackSeq;
  }, id);
}

async function captureThrow(page: Page, baseURL: string, id: string): Promise<ThrowCapture> {
  await prepareThrownWeapon(page, baseURL, id);
  const startSeq = await mountThrowProbe(page, id);
  await page.evaluate(() => {
    const holder = globalThis as unknown as BrowserGlobal;
    const arena = holder.ddGame.scene.getScene("arena");
    const self = arena.room.state.players.get(arena.room.sessionId);
    if (!self) throw new Error("live throw player disappeared before attack");
    arena.room.send("attack", {
      aimX: 1,
      aimY: 0,
      tx: self.x + 900,
      ty: self.y,
    });
  });
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const holder = globalThis as unknown as BrowserGlobal;
          return holder.__v8ThrowCapture ?? null;
        }),
      { message: `${id} should emit and render its accepted throw`, timeout: 10_000 },
    )
    .not.toBeNull();

  const capture = await page.evaluate(() => {
    const holder = globalThis as unknown as BrowserGlobal;
    if (!holder.__v8ThrowCapture) throw new Error("throw probe completed without a capture");
    return holder.__v8ThrowCapture;
  });
  expect(capture.attackSeq, `${id}: accepted attack sequence`).toBeGreaterThan(startSeq);
  await page.locator("#game-root canvas").screenshot({
    path: path.join(EVIDENCE_DIR, `${id}-release.png`),
  });
  const flightTravelPx = await page.evaluate(() => {
    const holder = globalThis as unknown as BrowserGlobal;
    if (holder.__v8ThrowProbe) window.clearInterval(holder.__v8ThrowProbe);
    holder.__v8ThrowProbe = undefined;
    return holder.__v8ThrowFlightTravel ?? 0;
  });
  expect(flightTravelPx, `${id}: visible outbound flight`).toBeGreaterThanOrEqual(
    MIN_FLIGHT_TRAVEL_PX,
  );

  return { id, ...capture, flightTravelPx };
}

test("all four stars and the kunai launch from the rendered throw hand and fly", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await runArenaSpec(page, async (baseURL) => {
    await mkdir(EVIDENCE_DIR, { recursive: true });
    await page.setViewportSize({ width: 640, height: 360 });
    const captures: ThrowCapture[] = [];
    for (const id of THROWN_IDS) captures.push(await captureThrow(page, baseURL, id));

    for (const capture of captures) {
      expect(capture.kind, `${capture.id}: wire identity`).toBe(`thrown:${capture.id}`);
      expect(capture.sourceWeaponId, `${capture.id}: server source`).toBe(capture.id);
      expect(capture.sourcePlayerId, `${capture.id}: server owner`).not.toBe("");
      expect(capture.anchorKind, `${capture.id}: presentation seam`).toBe("throw");
      expect(capture.releaseErrorPx, `${capture.id}: live hand release`).toBeLessThanOrEqual(
        MAX_THROW_ORIGIN_ERROR_PX,
      );
      expect(
        capture.originMetadataErrorPx,
        `${capture.id}: recorded launch origin`,
      ).toBeLessThanOrEqual(MAX_THROW_ORIGIN_ERROR_PX);
      expect(
        capture.flightTravelPx,
        `${capture.id}: visible outbound flight`,
      ).toBeGreaterThanOrEqual(MIN_FLIGHT_TRAVEL_PX);
    }

    await writeFile(
      path.join(EVIDENCE_DIR, "thrown-live-capture.json"),
      `${JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          thresholds: {
            maxThrowOriginErrorPx: MAX_THROW_ORIGIN_ERROR_PX,
            minFlightTravelPx: MIN_FLIGHT_TRAVEL_PX,
          },
          captures,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  });
});
