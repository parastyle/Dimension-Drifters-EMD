import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { bootArena, runArenaSpec, waitForDevWeapon } from "../helpers/arena-harness.js";

const EVIDENCE_DIR = path.resolve("docs/owner-notes-audit-v9-evidence/b9-size");
const BEFORE_PATH = path.join(EVIDENCE_DIR, "before-measurements.json");
const PHASE = process.env.B9_CAPTURE_PHASE === "before" ? "before" : "after";

const SIZE_ORDERS = [
  {
    id: "x2-idol-of-the-pale-verdict",
    beforeDisplayLength: 148,
    afterDisplayLength: 207.2,
    multiplier: 1.4,
  },
  {
    id: "x-sword-whirlwind",
    beforeDisplayLength: 118,
    afterDisplayLength: 236,
    multiplier: 2,
  },
  {
    id: "x2-mournveil-scythe",
    beforeDisplayLength: 280,
    afterDisplayLength: 364,
    multiplier: 1.3,
  },
  {
    id: "x2-gravewind-rimfire",
    beforeDisplayLength: 54,
    afterDisplayLength: 108,
    multiplier: 2,
  },
] as const;

const PRISMHEX_ID = "x2-prismhex-diffraction-gauntlet";

interface WeaponMeasurement {
  id: string;
  displayLength: number;
  source: { width: number; height: number };
  origin: { x: number; y: number };
  localScale: { x: number; y: number };
  manifestFacingX: number;
  actorFacing: number;
  facingBlend: number;
  rootScale: { x: number; y: number };
  worldDeterminant: number;
  orientedBoundingBox: { lengthPx: number; thicknessPx: number };
  axisAlignedBoundingBox: { x: number; y: number; width: number; height: number };
}

interface EvidenceRecord {
  phase: "before" | "after";
  capturedAt: string;
  baseURL: string;
  privatePorts: { client: number; forbiddenOwnerPortsAbsent: boolean };
  sizes: WeaponMeasurement[];
  prismhex: {
    right: WeaponMeasurement;
    left: WeaponMeasurement;
  };
  comparisons?: Array<{
    id: string;
    expectedMultiplier: number;
    displayLengthRatio: number;
    renderedLengthRatio: number;
    renderedThicknessRatio: number;
    withinOnePercent: boolean;
  }>;
}

async function prepareWeapon(
  page: Page,
  baseURL: string,
  weaponId: string,
  facing: 1 | -1,
): Promise<void> {
  await bootArena(page, baseURL, `weapon:${weaponId}`);
  await waitForDevWeapon(page, weaponId);
  const canvas = page.locator("#game-root canvas");
  await canvas.click({ position: { x: 400, y: 225 } });
  await page.mouse.move(facing > 0 ? 780 : 20, 225);
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
  await expect
    .poll(
      () =>
        page.evaluate((expectedFacing) => {
          const arena = (
            globalThis as unknown as {
              ddGame: { scene: { getScene(key: string): unknown } };
            }
          ).ddGame.scene.getScene("arena") as {
            blobs: Map<
              string,
              {
                facing: number;
                facingBlend: number;
                weapons: Array<{ img?: { visible: boolean } }>;
              }
            >;
            room: { sessionId: string };
          };
          const rig = arena.blobs.get(arena.room.sessionId);
          return {
            facing: rig?.facing ?? 0,
            facingBlend: rig?.facingBlend ?? 0,
            weaponVisible: rig?.weapons[0]?.img?.visible ?? false,
            expectedFacing,
          };
        }, facing),
      { message: `${weaponId} must settle into facing ${facing}`, timeout: 10_000 },
    )
    .toMatchObject({
      facing,
      weaponVisible: true,
    });
  await expect
    .poll(
      () =>
        page.evaluate((expectedFacing) => {
          const arena = (
            globalThis as unknown as {
              ddGame: { scene: { getScene(key: string): unknown } };
            }
          ).ddGame.scene.getScene("arena") as {
            blobs: Map<string, { facingBlend: number }>;
            room: { sessionId: string };
          };
          const blend = arena.blobs.get(arena.room.sessionId)?.facingBlend ?? 0;
          return Math.abs(blend - expectedFacing);
        }, facing),
      { message: `${weaponId} facing mirror must finish easing`, timeout: 10_000 },
    )
    .toBeLessThan(0.01);
}

async function measureWeapon(page: Page, weaponId: string): Promise<WeaponMeasurement> {
  return await page.evaluate((wanted) => {
    interface Point {
      x: number;
      y: number;
    }
    interface Matrix {
      a: number;
      b: number;
      c: number;
      d: number;
      transformPoint(x: number, y: number): Point;
    }
    interface BrowserImage {
      width: number;
      height: number;
      originX: number;
      originY: number;
      displayOriginX: number;
      displayOriginY: number;
      scaleX: number;
      scaleY: number;
      getWorldTransformMatrix(): Matrix;
    }
    const arena = (
      globalThis as unknown as {
        ddGame: { scene: { getScene(key: string): unknown } };
      }
    ).ddGame.scene.getScene("arena") as {
      blobs: Map<
        string,
        {
          facing: number;
          facingBlend: number;
          root: { scaleX: number; scaleY: number };
          weapons: Array<{
            img: BrowserImage;
            def: { id: string; displayLength: number };
            imageFacingX?: number;
          }>;
        }
      >;
      room: { sessionId: string };
    };
    const rig = arena.blobs.get(arena.room.sessionId);
    const held = rig?.weapons.find((candidate) => candidate.def.id === wanted);
    if (!rig || !held) throw new Error(`B9 live gate could not find held ${wanted}`);
    const image = held.img;
    const matrix = image.getWorldTransformMatrix();
    const left = -image.displayOriginX;
    const top = -image.displayOriginY;
    const right = left + image.width;
    const bottom = top + image.height;
    const topLeft = matrix.transformPoint(left, top);
    const topRight = matrix.transformPoint(right, top);
    const bottomLeft = matrix.transformPoint(left, bottom);
    const bottomRight = matrix.transformPoint(right, bottom);
    const points = [topLeft, topRight, bottomLeft, bottomRight];
    const minX = Math.min(...points.map((point) => point.x));
    const maxX = Math.max(...points.map((point) => point.x));
    const minY = Math.min(...points.map((point) => point.y));
    const maxY = Math.max(...points.map((point) => point.y));
    return {
      id: wanted,
      displayLength: held.def.displayLength,
      source: { width: image.width, height: image.height },
      origin: { x: image.originX, y: image.originY },
      localScale: { x: image.scaleX, y: image.scaleY },
      manifestFacingX: held.imageFacingX ?? 1,
      actorFacing: rig.facing,
      facingBlend: rig.facingBlend,
      rootScale: { x: rig.root.scaleX, y: rig.root.scaleY },
      worldDeterminant: matrix.a * matrix.d - matrix.b * matrix.c,
      orientedBoundingBox: {
        lengthPx: Math.hypot(topRight.x - topLeft.x, topRight.y - topLeft.y),
        thicknessPx: Math.hypot(bottomLeft.x - topLeft.x, bottomLeft.y - topLeft.y),
      },
      axisAlignedBoundingBox: {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      },
    };
  }, weaponId);
}

test("B9 live weapon sizes and Prismhex facing datum", async ({ page }) => {
  test.setTimeout(120_000);
  await runArenaSpec(page, async (baseURL) => {
    await mkdir(EVIDENCE_DIR, { recursive: true });
    await page.setViewportSize({ width: 800, height: 450 });
    const clientPort = Number(new URL(baseURL).port);
    expect(clientPort).toBeGreaterThan(0);
    expect(clientPort).not.toBe(5180);
    expect(clientPort).not.toBe(2567);

    const sizes: WeaponMeasurement[] = [];
    for (const order of SIZE_ORDERS) {
      await prepareWeapon(page, baseURL, order.id, 1);
      sizes.push(await measureWeapon(page, order.id));
      await page
        .locator("#game-root canvas")
        .screenshot({ path: path.join(EVIDENCE_DIR, `${PHASE}-${order.id}.png`) });
    }

    await prepareWeapon(page, baseURL, PRISMHEX_ID, 1);
    const prismhexRight = await measureWeapon(page, PRISMHEX_ID);
    await page
      .locator("#game-root canvas")
      .screenshot({ path: path.join(EVIDENCE_DIR, `${PHASE}-${PRISMHEX_ID}-right.png`) });
    await prepareWeapon(page, baseURL, PRISMHEX_ID, -1);
    const prismhexLeft = await measureWeapon(page, PRISMHEX_ID);
    await page
      .locator("#game-root canvas")
      .screenshot({ path: path.join(EVIDENCE_DIR, `${PHASE}-${PRISMHEX_ID}-left.png`) });

    const evidence: EvidenceRecord = {
      phase: PHASE,
      capturedAt: new Date().toISOString(),
      baseURL,
      privatePorts: {
        client: clientPort,
        forbiddenOwnerPortsAbsent: clientPort !== 5180 && clientPort !== 2567,
      },
      sizes,
      prismhex: {
        right: prismhexRight,
        left: prismhexLeft,
      },
    };

    if (PHASE === "before") {
      for (const order of SIZE_ORDERS) {
        expect(sizes.find(({ id }) => id === order.id)?.displayLength, order.id).toBe(
          order.beforeDisplayLength,
        );
      }
      expect(prismhexRight.localScale.x).toBeGreaterThan(0);
      expect(prismhexLeft.localScale.x).toBeGreaterThan(0);
      await writeFile(BEFORE_PATH, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
      return;
    }

    const before = JSON.parse(await readFile(BEFORE_PATH, "utf8")) as EvidenceRecord;
    expect(before.phase).toBe("before");
    const comparisons = SIZE_ORDERS.map((order) => {
      const prior = before.sizes.find(({ id }) => id === order.id);
      const current = sizes.find(({ id }) => id === order.id);
      if (!prior || !current) throw new Error(`B9 evidence is missing ${order.id}`);
      expect(current.source, `${order.id} source asset dimensions`).toEqual(prior.source);
      expect(current.displayLength, `${order.id} exact catalog length`).toBe(
        order.afterDisplayLength,
      );
      const displayLengthRatio = current.displayLength / prior.displayLength;
      const renderedLengthRatio =
        current.orientedBoundingBox.lengthPx / prior.orientedBoundingBox.lengthPx;
      const renderedThicknessRatio =
        current.orientedBoundingBox.thicknessPx / prior.orientedBoundingBox.thicknessPx;
      const withinOnePercent =
        Math.abs(renderedLengthRatio / order.multiplier - 1) <= 0.01 &&
        Math.abs(renderedThicknessRatio / order.multiplier - 1) <= 0.01;
      expect(displayLengthRatio, `${order.id} displayLength multiplier`).toBeCloseTo(
        order.multiplier,
        10,
      );
      expect(renderedLengthRatio, `${order.id} rendered length multiplier`).toBeCloseTo(
        order.multiplier,
        2,
      );
      expect(renderedThicknessRatio, `${order.id} rendered thickness multiplier`).toBeCloseTo(
        order.multiplier,
        2,
      );
      expect(withinOnePercent, `${order.id} rendered ratio within 1%`).toBe(true);
      return {
        id: order.id,
        expectedMultiplier: order.multiplier,
        displayLengthRatio,
        renderedLengthRatio,
        renderedThicknessRatio,
        withinOnePercent,
      };
    });
    evidence.comparisons = comparisons;

    for (const [label, capture] of [
      ["right", prismhexRight],
      ["left", prismhexLeft],
    ] as const) {
      expect(capture.manifestFacingX, `${label} stable image-facing datum`).toBe(-1);
      expect(capture.localScale.x, `${label} horizontal image mirror`).toBeLessThan(0);
      expect(capture.localScale.y, `${label} artwork remains upright`).toBeGreaterThan(0);
      expect(
        Math.sign(capture.worldDeterminant),
        `${label} one horizontal mirror composed with actor facing`,
      ).toBe(-capture.actorFacing);
    }
    expect(prismhexRight.actorFacing).toBe(1);
    expect(prismhexLeft.actorFacing).toBe(-1);
    expect(prismhexRight.source).toEqual(before.prismhex.right.source);
    expect(prismhexLeft.source).toEqual(before.prismhex.left.source);

    await writeFile(
      path.join(EVIDENCE_DIR, "after-measurements.json"),
      `${JSON.stringify(evidence, null, 2)}\n`,
      "utf8",
    );
  });
});
