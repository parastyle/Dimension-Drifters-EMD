import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { bootArena, runArenaSpec, waitForDevWeapon } from "../helpers/arena-harness.js";

const ACTIVE = 2;
const MIN_SERVER_SPAN_PX = 5;
const BASELINE = process.env.DD_V7_BEAM_BASELINE === "1";
const EVIDENCE_DIR = path.resolve(
  import.meta.dirname,
  "../../docs/owner-notes-audit-v7-evidence/beams",
);
const REPRESENTATIVES = [
  { family: "segmented-arcs", weaponId: "x2-voltcaster-machine-pistol" },
  { family: "converging-strands", weaponId: "x2-mirage-coilrifle" },
  { family: "pulse-train", weaponId: "x2-quartzlight-wayfinder" },
  { family: "flame-tongues", weaponId: "x2-sunmote-reliquary-staff" },
  { family: "ice-particles", weaponId: "x2-frostquill-compendium" },
] as const;

interface BeamSnapshot {
  family: string;
  weaponId: string;
  phase: number;
  rowWidth: number;
  rowLength: number;
  textureKey: string;
  lipTextureKey: string;
  lipVisible: boolean;
  bodyVisible: boolean;
  bodyScaleX: number;
  bodyScaleY: number;
  beamOrigin: { x: number; y: number };
  beamEndpoint: { x: number; y: number };
  renderedRopeLength: number;
  muzzle: { x: number; y: number };
  muzzleDelta: number;
  actualMaxTransverseExtent: number;
  structure?: {
    family: string;
    textureKey: string;
    textureReady: boolean;
    generatedSheetVisible: boolean;
    coneStream: boolean;
    iceOnly: boolean;
    authoritativeWidth: number;
    authoritativeLength: number;
    renderLength: number;
    artRenderedWidth: number;
    proceduralCoreWidth: number;
    normalWobble: number;
    maxTransverseExtent: number;
    longitudinalStart: number;
    longitudinalEnd: number;
  };
  textureMeasurement: {
    width: number;
    height: number;
    visiblePixels: number;
    alphaBounds: { minX: number; minY: number; maxX: number; maxY: number };
    energeticColumnOccupancy: number;
    gridSignature: string;
  };
  screenshot: string;
}

interface MovingAnchorFrame {
  playerX: number;
  playerY: number;
  serverX: number;
  serverY: number;
  muzzleX: number;
  muzzleY: number;
  beamX: number;
  beamY: number;
  delta: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __ddV7BeamInput: number | undefined;
  // eslint-disable-next-line no-var
  var __ddV7BeamPhaseTimer: number | undefined;
  // eslint-disable-next-line no-var
  var __ddV7BeamPhases: number[] | undefined;
}

async function beginHeldBeam(
  page: import("@playwright/test").Page,
  moveDuringCharge = false,
): Promise<void> {
  const canvas = page.locator("#game-root canvas");
  await canvas.click({ position: { x: 320, y: 180 } });
  await page.mouse.move(600, 175);
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.evaluate((move) => {
      const arena = (
        globalThis as unknown as { ddGame: { scene: { getScene(key: string): unknown } } }
      ).ddGame.scene.getScene("arena") as {
        time: { now: number };
        game: { hasFocus: boolean };
        pointerOverInteractiveUi: boolean;
        verbs?: {
          isLegendOpen?(): boolean;
          toggleLegend?(timeMs: number): void;
          releaseInputLatchIf?(force: boolean): void;
        };
        input: { activePointer: { rightButtonDown: () => boolean } };
        stepNetInput?(
          deltaMs: number,
          blocked: boolean,
          ultimate: boolean,
          dx: number,
          dy: number,
        ): void;
      };
      if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend?.(arena.time.now);
      arena.verbs?.releaseInputLatchIf?.(true);
      arena.game.hasFocus = true;
      arena.pointerOverInteractiveUi = false;
      arena.input.activePointer.rightButtonDown = () => true;
      globalThis.__ddV7BeamPhases = [];
      globalThis.__ddV7BeamPhaseTimer = window.setInterval(() => {
        const room = (
          arena as unknown as {
            room?: {
              sessionId: string;
              state: { beams: { get(id: string): { phase?: number } | undefined } };
            };
          }
        ).room;
        const phase = room?.state.beams.get(room.sessionId)?.phase;
        if (typeof phase === "number" && globalThis.__ddV7BeamPhases?.at(-1) !== phase)
          globalThis.__ddV7BeamPhases?.push(phase);
      }, 25);
      globalThis.__ddV7BeamInput = window.setInterval(
        () => arena.stepNetInput?.(50, false, false, move ? 1 : 0, 0),
        50,
      );
    }, moveDuringCharge);
    try {
      await expect
        .poll(
          () =>
            page.evaluate(() => {
              const arena = (
                globalThis as unknown as { ddGame: { scene: { getScene(key: string): unknown } } }
              ).ddGame.scene.getScene("arena") as {
                room: {
                  sessionId: string;
                  state: { beams: { get(id: string): { phase?: number } | undefined } };
                };
              };
              return arena.room.state.beams.get(arena.room.sessionId)?.phase;
            }),
          {
            message: "accepted held input should create an active authoritative beam",
            timeout: 5_000,
          },
        )
        .toBe(ACTIVE);
      return;
    } catch (error) {
      await releaseHeldBeam(page);
      await expect
        .poll(
          () =>
            page.evaluate(() => {
              const arena = (
                globalThis as unknown as { ddGame: { scene: { getScene(key: string): unknown } } }
              ).ddGame.scene.getScene("arena") as {
                room: { sessionId: string; state: { beams: { get(id: string): unknown } } };
              };
              return !arena.room.state.beams.get(arena.room.sessionId);
            }),
          { message: "missed active cycle should fully vent before retry", timeout: 20_000 },
        )
        .toBe(true);
      await page.evaluate(() => {
        if (globalThis.__ddV7BeamPhaseTimer) window.clearInterval(globalThis.__ddV7BeamPhaseTimer);
        globalThis.__ddV7BeamPhaseTimer = undefined;
      });
      if (attempt === 2) throw error;
    }
  }
}

async function sampleMovingAnchor(
  page: import("@playwright/test").Page,
): Promise<MovingAnchorFrame[]> {
  return await page.evaluate((minServerSpan) => {
    const arena = (
      globalThis as unknown as { ddGame: { scene: { getScene(key: string): unknown } } }
    ).ddGame.scene.getScene("arena") as {
      room: {
        sessionId: string;
        state: {
          players: { get(id: string): { x: number; y: number } | undefined };
        };
      };
      blobs: {
        get(id: string):
          | {
              root: { x: number; y: number };
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
      stepNetInput?(
        deltaMs: number,
        blocked: boolean,
        ultimate: boolean,
        dx: number,
        dy: number,
      ): void;
    };
    if (globalThis.__ddV7BeamInput) window.clearInterval(globalThis.__ddV7BeamInput);
    globalThis.__ddV7BeamInput = window.setInterval(
      () => arena.stepNetInput?.(50, false, false, 1, 0),
      50,
    );
    const frames: MovingAnchorFrame[] = [];
    const deadline = performance.now() + 4_000;
    return new Promise<MovingAnchorFrame[]>((resolve) => {
      const sample = () => {
        const ownerId = arena.room.sessionId;
        const rig = arena.blobs.get(ownerId);
        const player = arena.room.state.players.get(ownerId);
        const entry = arena.beamRenderer.entries.find(
          (candidate) => candidate.key && candidate.ownerId === ownerId && candidate.body.visible,
        );
        const point = entry?.body.points?.[0];
        const muzzle = { x: 0, y: 0 };
        if (rig && player && entry && point && rig.writeWeaponMuzzle(0, muzzle, 0)) {
          const beamX = entry.body.x + point.x * entry.body.scaleX;
          const beamY = entry.body.y + point.y * entry.body.scaleY;
          frames.push({
            playerX: rig.root.x,
            playerY: rig.root.y,
            serverX: player.x,
            serverY: player.y,
            muzzleX: muzzle.x,
            muzzleY: muzzle.y,
            beamX,
            beamY,
            delta: Math.hypot(beamX - muzzle.x, beamY - muzzle.y),
          });
        }
        const first = frames[0];
        const last = frames.at(-1);
        const travel =
          first && last
            ? Math.hypot(last.serverX - first.serverX, last.serverY - first.serverY)
            : 0;
        if ((frames.length >= 8 && travel >= minServerSpan) || performance.now() >= deadline)
          resolve(frames);
        else requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
  }, MIN_SERVER_SPAN_PX);
}

async function captureLifecycle(page: import("@playwright/test").Page): Promise<{
  phases: number[];
  sawVenting: boolean;
  rowCleared: boolean;
}> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const arena = (
            globalThis as unknown as { ddGame: { scene: { getScene(key: string): unknown } } }
          ).ddGame.scene.getScene("arena") as {
            room: {
              sessionId: string;
              state: { beams: { get(id: string): unknown } };
            };
          };
          return !arena.room.state.beams.get(arena.room.sessionId);
        }),
      { message: "released beam should vent and clear its authoritative row", timeout: 20_000 },
    )
    .toBe(true);
  return await page.evaluate(() => {
    const phases = [...(globalThis.__ddV7BeamPhases ?? [])];
    if (globalThis.__ddV7BeamPhaseTimer) window.clearInterval(globalThis.__ddV7BeamPhaseTimer);
    globalThis.__ddV7BeamPhaseTimer = undefined;
    return {
      phases,
      sawVenting: phases.some((phase) => phase === 3 || phase === 4),
      rowCleared: true,
    };
  });
}

function signatureDistance(left: string, right: string): number {
  if (left.length !== right.length || left.length === 0) return 1;
  let different = 0;
  for (let index = 0; index < left.length; index++) if (left[index] !== right[index]) different++;
  return different / left.length;
}

async function releaseHeldBeam(page: import("@playwright/test").Page): Promise<void> {
  await page.evaluate(() => {
    const arena = (
      globalThis as unknown as { ddGame: { scene: { getScene(key: string): unknown } } }
    ).ddGame.scene.getScene("arena") as {
      input: { activePointer: { rightButtonDown: () => boolean } };
      stepNetInput?(
        deltaMs: number,
        blocked: boolean,
        ultimate: boolean,
        dx: number,
        dy: number,
      ): void;
    };
    arena.input.activePointer.rightButtonDown = () => false;
    arena.stepNetInput?.(50, false, false, 0, 0);
    if (globalThis.__ddV7BeamInput) window.clearInterval(globalThis.__ddV7BeamInput);
    globalThis.__ddV7BeamInput = undefined;
  });
}

test("beam families have live structural silhouettes and Frostquill is ice-only", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await runArenaSpec(page, async (baseURL) => {
    await mkdir(EVIDENCE_DIR, { recursive: true });
    await page.setViewportSize({ width: 640, height: 360 });
    const snapshots: BeamSnapshot[] = [];
    let movingFrames: MovingAnchorFrame[] = [];
    let lifecycle: Awaited<ReturnType<typeof captureLifecycle>> | undefined;

    for (const [representativeIndex, representative] of REPRESENTATIVES.entries()) {
      await bootArena(page, baseURL, `weapon:${representative.weaponId}`);
      await waitForDevWeapon(page, representative.weaponId);
      await page.waitForTimeout(500);
      try {
        await beginHeldBeam(page, representativeIndex === 0);
        if (!BASELINE) {
          await expect
            .poll(
              () =>
                page.evaluate(() => {
                  const arena = (
                    globalThis as unknown as {
                      ddGame: { scene: { getScene(key: string): unknown } };
                    }
                  ).ddGame.scene.getScene("arena") as {
                    room: { sessionId: string };
                    beamRenderer: {
                      entries: Array<{
                        key: string;
                        ownerId: string;
                        structure?: { textureReady?: boolean; generatedSheetVisible?: boolean };
                      }>;
                    };
                  };
                  const entry = arena.beamRenderer.entries.find(
                    (candidate) => candidate.key && candidate.ownerId === arena.room.sessionId,
                  );
                  return entry?.structure?.textureReady && entry.structure.generatedSheetVisible;
                }),
              {
                message: `${representative.family} generated structure should load live`,
                timeout: 10_000,
              },
            )
            .toBe(true);
        }
        const screenshot = path.join(
          EVIDENCE_DIR,
          `${BASELINE ? "before" : "after"}-${representative.family}-${representative.weaponId}.png`,
        );
        const snapshot = await page.evaluate(
          ({ family, weaponId, active }) => {
            const arena = (
              globalThis as unknown as { ddGame: { scene: { getScene(key: string): unknown } } }
            ).ddGame.scene.getScene("arena") as {
              room: {
                sessionId: string;
                state: {
                  beams: {
                    get(id: string):
                      | {
                          phase: number;
                          width: number;
                          effectiveLength: number;
                        }
                      | undefined;
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
                    texture: { key: string };
                    points?: Array<{ x: number; y: number }>;
                  };
                  lip: { visible: boolean; texture: { key: string } };
                  structure?: BeamSnapshot["structure"];
                }>;
              };
              textures: {
                get(key: string): {
                  getSourceImage(): CanvasImageSource & { width: number; height: number };
                };
              };
            };
            const ownerId = arena.room.sessionId;
            const row = arena.room.state.beams.get(ownerId);
            const rig = arena.blobs.get(ownerId);
            const entry = arena.beamRenderer.entries.find(
              (candidate) =>
                candidate.key && candidate.ownerId === ownerId && candidate.body.visible,
            );
            const point = entry?.body.points?.[0];
            const endpoint = entry?.body.points?.at(-1);
            const muzzle = { x: 0, y: 0 };
            if (!row || row.phase !== active || !rig || !entry || !point || !endpoint) {
              throw new Error(`missing active rendered beam for ${weaponId}`);
            }
            if (!rig.writeWeaponMuzzle(0, muzzle, 0))
              throw new Error(`missing live muzzle for ${weaponId}`);
            const beamOrigin = {
              x: entry.body.x + point.x * entry.body.scaleX,
              y: entry.body.y + point.y * entry.body.scaleY,
            };
            const beamEndpoint = {
              x: entry.body.x + endpoint.x * entry.body.scaleX,
              y: entry.body.y + endpoint.y * entry.body.scaleY,
            };
            const source = arena.textures.get(entry.body.texture.key).getSourceImage();
            const measureCanvas = document.createElement("canvas");
            measureCanvas.width = source.width;
            measureCanvas.height = source.height;
            const context = measureCanvas.getContext("2d", { willReadFrequently: true });
            if (!context) throw new Error(`missing texture measurement context for ${weaponId}`);
            context.drawImage(source, 0, 0);
            const pixels = context.getImageData(0, 0, source.width, source.height).data;
            let visiblePixels = 0;
            let minX = source.width;
            let minY = source.height;
            let maxX = -1;
            let maxY = -1;
            const columnAlphaMass = new Uint32Array(source.width);
            for (let y = 0; y < source.height; y++) {
              for (let x = 0; x < source.width; x++) {
                const alpha = pixels[(y * source.width + x) * 4 + 3] ?? 0;
                if (alpha <= 48) continue;
                visiblePixels++;
                columnAlphaMass[x] = (columnAlphaMass[x] ?? 0) + alpha;
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
              }
            }
            const energeticColumns = Array.from(columnAlphaMass).filter(
              (mass) => mass >= 3 * 255,
            ).length;
            let gridSignature = "";
            for (let gridY = 0; gridY < 12; gridY++) {
              for (let gridX = 0; gridX < 32; gridX++) {
                const startX = Math.floor((gridX * source.width) / 32);
                const endX = Math.floor(((gridX + 1) * source.width) / 32);
                const startY = Math.floor((gridY * source.height) / 12);
                const endY = Math.floor(((gridY + 1) * source.height) / 12);
                let alphaMass = 0;
                let cellPixels = 0;
                for (let y = startY; y < endY; y++) {
                  for (let x = startX; x < endX; x++) {
                    alphaMass += pixels[(y * source.width + x) * 4 + 3] ?? 0;
                    cellPixels++;
                  }
                }
                gridSignature += alphaMass >= cellPixels * 255 * 0.08 ? "1" : "0";
              }
            }
            const sourceCenterY = (source.height - 1) * 0.5;
            const alphaHalfPixels = Math.max(
              Math.abs(minY - sourceCenterY),
              Math.abs(maxY - sourceCenterY),
            );
            const actualMaxTransverseExtent =
              alphaHalfPixels * Math.abs(entry.body.scaleY) + (entry.structure?.normalWobble ?? 0);
            return {
              family,
              weaponId,
              phase: row.phase,
              rowWidth: row.width,
              rowLength: row.effectiveLength,
              textureKey: entry.body.texture.key,
              lipTextureKey: entry.lip.texture.key,
              lipVisible: entry.lip.visible,
              bodyVisible: entry.body.visible,
              bodyScaleX: entry.body.scaleX,
              bodyScaleY: entry.body.scaleY,
              beamOrigin,
              beamEndpoint,
              renderedRopeLength: Math.hypot(
                beamEndpoint.x - beamOrigin.x,
                beamEndpoint.y - beamOrigin.y,
              ),
              muzzle,
              muzzleDelta: Math.hypot(beamOrigin.x - muzzle.x, beamOrigin.y - muzzle.y),
              actualMaxTransverseExtent,
              structure: entry.structure,
              textureMeasurement: {
                width: source.width,
                height: source.height,
                visiblePixels,
                alphaBounds: { minX, minY, maxX, maxY },
                energeticColumnOccupancy: energeticColumns / Math.max(1, source.width),
                gridSignature,
              },
            };
          },
          { ...representative, active: ACTIVE },
        );
        await page.screenshot({ path: screenshot, fullPage: true });
        snapshots.push({
          ...snapshot,
          screenshot: path.relative(process.cwd(), screenshot),
        });
      } finally {
        await releaseHeldBeam(page);
      }
      if (representativeIndex === 0) lifecycle = await captureLifecycle(page);
      else {
        await page.evaluate(() => {
          if (globalThis.__ddV7BeamPhaseTimer)
            window.clearInterval(globalThis.__ddV7BeamPhaseTimer);
          globalThis.__ddV7BeamPhaseTimer = undefined;
        });
      }
    }

    // Screenshots can stall software WebGL long enough to spend a short beam's heat window. Use a fresh,
    // screenshot-free accepted cycle for the moving attachment witness.
    await bootArena(page, baseURL, `weapon:${REPRESENTATIVES[0].weaponId}`);
    await waitForDevWeapon(page, REPRESENTATIVES[0].weaponId);
    try {
      await beginHeldBeam(page, true);
      movingFrames = await sampleMovingAnchor(page);
    } finally {
      await releaseHeldBeam(page);
      await page.evaluate(() => {
        if (globalThis.__ddV7BeamPhaseTimer) window.clearInterval(globalThis.__ddV7BeamPhaseTimer);
        globalThis.__ddV7BeamPhaseTimer = undefined;
      });
    }

    const signatureDistances: Array<{ left: string; right: string; distance: number }> = [];
    for (let left = 0; left < snapshots.length; left++) {
      for (let right = left + 1; right < snapshots.length; right++) {
        const leftSnapshot = snapshots[left];
        const rightSnapshot = snapshots[right];
        if (!leftSnapshot || !rightSnapshot) continue;
        signatureDistances.push({
          left: leftSnapshot.family,
          right: rightSnapshot.family,
          distance: signatureDistance(
            leftSnapshot.textureMeasurement.gridSignature,
            rightSnapshot.textureMeasurement.gridSignature,
          ),
        });
      }
    }
    const movingFirst = movingFrames[0];
    const movingLast = movingFrames.at(-1);
    const movingTravel =
      movingFirst && movingLast
        ? Math.hypot(
            movingLast.serverX - movingFirst.serverX,
            movingLast.serverY - movingFirst.serverY,
          )
        : 0;
    const visibleMovingTravel =
      movingFirst && movingLast
        ? Math.hypot(
            movingLast.playerX - movingFirst.playerX,
            movingLast.playerY - movingFirst.playerY,
          )
        : 0;
    const serverXs = movingFrames.map((frame) => frame.serverX);
    const serverYs = movingFrames.map((frame) => frame.serverY);
    const movingServerSpan =
      serverXs.length > 0
        ? Math.hypot(
            Math.max(...serverXs) - Math.min(...serverXs),
            Math.max(...serverYs) - Math.min(...serverYs),
          )
        : 0;
    const maxMovingMuzzleDelta = Math.max(0, ...movingFrames.map((frame) => frame.delta));
    const frostquill = snapshots.find((snapshot) => snapshot.family === "ice-particles");
    const assertions = {
      allFamiliesCaptured: snapshots.length === REPRESENTATIVES.length,
      generatedSheetsVisible: snapshots.every(
        (snapshot) =>
          snapshot.textureKey === `beam-v7-structure:${snapshot.family}` &&
          snapshot.structure?.textureReady === true &&
          snapshot.structure.generatedSheetVisible === true,
      ),
      measuredSilhouettesDiffer:
        signatureDistances.length === 10 &&
        signatureDistances.every(({ distance }) => distance >= 0.1),
      energeticPixelsInsideWidth: snapshots.every(
        (snapshot) =>
          snapshot.actualMaxTransverseExtent <= snapshot.rowWidth * 0.5 + 0.01 &&
          (snapshot.structure?.maxTransverseExtent ?? Infinity) <= snapshot.rowWidth * 0.5 + 0.01,
      ),
      energeticPixelsInsideRange: snapshots.every(
        (snapshot) =>
          snapshot.renderedRopeLength <= snapshot.rowLength + 0.01 &&
          (snapshot.structure?.longitudinalStart ?? -1) >= 0 &&
          (snapshot.structure?.longitudinalEnd ?? Infinity) <=
            (snapshot.structure?.renderLength ?? -1) + 0.01,
      ),
      stationaryMuzzleAttached: snapshots.every((snapshot) => snapshot.muzzleDelta <= 2.5),
      movingMuzzleAttached:
        movingFrames.length >= 8 &&
        movingServerSpan >= MIN_SERVER_SPAN_PX &&
        maxMovingMuzzleDelta <= 2.5,
      lifecycle:
        lifecycle?.phases.includes(ACTIVE) === true &&
        lifecycle.sawVenting === true &&
        lifecycle.rowCleared === true,
      frostquillIceOnly:
        frostquill?.textureKey === "beam-v7-structure:ice-particles" &&
        (!frostquill.lipVisible ||
          frostquill.lipTextureKey === "beam-v7-structure:ice-particles") &&
        frostquill.structure?.iceOnly === true &&
        frostquill.structure.proceduralCoreWidth === 0,
    };

    const evidencePath = path.join(
      EVIDENCE_DIR,
      `${BASELINE ? "before" : "after"}-live-capture.json`,
    );
    await writeFile(
      evidencePath,
      `${JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          baseURL,
          thresholds: {
            muzzlePx: 2.5,
            pairwiseGridDistance: 0.1,
            serverSpanPx: MIN_SERVER_SPAN_PX,
          },
          assertions,
          signatureDistances,
          movingTravel,
          visibleMovingTravel,
          movingServerSpan,
          maxMovingMuzzleDelta,
          movingFrames,
          lifecycle,
          snapshots,
        },
        null,
        2,
      )}\n`,
    );

    if (!BASELINE)
      expect(assertions, "measured live beam structure gate").toEqual({
        allFamiliesCaptured: true,
        generatedSheetsVisible: true,
        measuredSilhouettesDiffer: true,
        energeticPixelsInsideWidth: true,
        energeticPixelsInsideRange: true,
        stationaryMuzzleAttached: true,
        movingMuzzleAttached: true,
        lifecycle: true,
        frostquillIceOnly: true,
      });
  });
});
