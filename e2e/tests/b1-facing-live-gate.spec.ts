import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { bootArena, runArenaSpec, waitForDevWeapon } from "../helpers/arena-harness.js";

const WEAPON_ID = "x2-saintskull-monstrance";
const PROJECTILE_SPRITE_ID = "saintskull-monstrance-holy-skull";
const EVIDENCE_DIR = path.resolve("docs/owner-notes-audit-v9-evidence/b1-facing");

interface ProjectileCapture {
  id: string;
  vx: number;
  vy: number;
  speed: number;
  artRotation: number;
  artScaleX: number;
  artScaleY: number;
  projectileSprite: string;
  textureKey: string;
  flightTravelPx: number;
  forwardDotVelocity: number;
  topScreen: { x: number; y: number };
}

interface DamageTransformCapture {
  text: string;
  camera: {
    scrollX: number;
    scrollY: number;
    zoomX: number;
    zoomY: number;
    rotation: number;
  };
  sourceWorld: { x: number; y: number };
  sourceWorldDeterminant: number;
  screenRoot: {
    parentIsNull: boolean;
    scrollFactorX: number;
    scrollFactorY: number;
  };
  baselineScreen: { x: number; y: number; angle: number };
  screenDeterminant: number;
  glyphScreen: { x: number; y: number };
  sourceScreen: { x: number; y: number };
  presentationOffsetPx: number;
}

async function prepare(page: Page, baseURL: string): Promise<void> {
  await bootArena(page, baseURL, `weapon:${WEAPON_ID}`);
  await waitForDevWeapon(page, WEAPON_ID);
  const canvas = page.locator("#game-root canvas");
  await canvas.click({ position: { x: 400, y: 225 } });
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
}

async function fireAndCapture(
  page: Page,
  direction: 1 | -1,
  freezeOnCapture = false,
): Promise<ProjectileCapture> {
  // Keep the real client input stream's aim on the same side as the explicit attack message. Otherwise
  // its next 50 ms input packet can legitimately supersede a one-off opposite-side test payload.
  await page.mouse.move(direction > 0 ? 760 : 40, 225);
  await page.waitForTimeout(100);
  const before = await page.evaluate(
    ({ weaponId, sign }) => {
      const arena = (
        globalThis as unknown as {
          ddGame: { scene: { getScene(key: string): unknown } };
        }
      ).ddGame.scene.getScene("arena") as {
        room: {
          sessionId: string;
          send(type: string, payload: unknown): void;
          state: {
            players: {
              get(id: string): { attackSeq: number; x: number; y: number } | undefined;
            };
          };
        };
      };
      const self = arena.room.state.players.get(arena.room.sessionId);
      if (!self) throw new Error("B1 live gate has no local player");
      arena.room.send("attack", {
        aimX: sign,
        aimY: 0,
        tx: self.x + sign * 900,
        ty: self.y,
      });
      return { attackSeq: self.attackSeq, weaponId };
    },
    { weaponId: WEAPON_ID, sign: direction },
  );

  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const capture = await page.evaluate(
      ({ weaponId, previousAttackSeq, sign, freeze }) => {
        const arena = (
          globalThis as unknown as {
            ddGame: { scene: { getScene(key: string): unknown } };
          }
        ).ddGame.scene.getScene("arena") as {
          cameras: {
            main: {
              matrixCombined: { a: number; b: number; c: number; d: number };
            };
          };
          scene: { pause(): void };
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
              x: number;
              y: number;
              getData(key: string): unknown;
            }
          >;
        };
        const attackSeq =
          arena.room.state.players.get(arena.room.sessionId)?.attackSeq ?? previousAttackSeq;
        if (attackSeq <= previousAttackSeq) return null;

        let newest:
          | {
              id: string;
              bornTick: number;
              vx: number;
              vy: number;
            }
          | undefined;
        arena.room.state.projectiles.forEach((row, id) => {
          if (
            row.sourcePlayerId !== arena.room.sessionId ||
            row.sourceWeaponId !== weaponId ||
            row.vx * sign <= 0 ||
            !arena.projectiles.has(id) ||
            (newest && row.bornTick < newest.bornTick)
          )
            return;
          newest = { id, bornTick: row.bornTick, vx: row.vx, vy: row.vy };
        });
        if (!newest) return null;

        const rendered = arena.projectiles.get(newest.id);
        const payload = rendered?.getData("arcPayload") as
          | {
              list: Array<{
                type?: string;
                rotation: number;
                scaleX: number;
                scaleY: number;
                texture?: { key?: string };
                getWorldTransformMatrix(): {
                  a: number;
                  b: number;
                  c: number;
                  d: number;
                };
              }>;
            }
          | undefined;
        const image = payload?.list.find(
          (child) => child.type === "Image" && child.texture?.key === `gun-generated:${weaponId}`,
        );
        if (!rendered || !image) return null;
        const spawnX = Number(rendered.getData("spawnOriginX"));
        const spawnY = Number(rendered.getData("spawnOriginY"));
        const flightTravelPx = Math.hypot(rendered.x - spawnX, rendered.y - spawnY);
        if (!Number.isFinite(flightTravelPx) || flightTravelPx < 18) return null;

        const world = image.getWorldTransformMatrix();
        const camera = arena.cameras.main.matrixCombined;
        const forwardWorld = { x: world.a, y: world.b };
        const topWorld = { x: -world.c, y: -world.d };
        const forwardLength = Math.hypot(forwardWorld.x, forwardWorld.y) || 1;
        const velocityLength = Math.hypot(newest.vx, newest.vy) || 1;
        const topScreenRaw = {
          x: camera.a * topWorld.x + camera.c * topWorld.y,
          y: camera.b * topWorld.x + camera.d * topWorld.y,
        };
        const topLength = Math.hypot(topScreenRaw.x, topScreenRaw.y) || 1;
        const capture = {
          id: newest.id,
          vx: newest.vx,
          vy: newest.vy,
          speed: velocityLength,
          artRotation: image.rotation,
          artScaleX: image.scaleX,
          artScaleY: image.scaleY,
          projectileSprite: String(rendered.getData("projectileSprite") ?? ""),
          textureKey: image.texture?.key ?? "",
          flightTravelPx,
          forwardDotVelocity:
            (forwardWorld.x * newest.vx + forwardWorld.y * newest.vy) /
            (forwardLength * velocityLength),
          topScreen: {
            x: topScreenRaw.x / topLength,
            y: topScreenRaw.y / topLength,
          },
        };
        if (freeze) arena.scene.pause();
        return capture;
      },
      {
        weaponId: WEAPON_ID,
        previousAttackSeq: before.attackSeq,
        sign: direction,
        freeze: freezeOnCapture,
      },
    );
    if (capture) return capture;
    await page.waitForTimeout(10);
  }
  throw new Error(`B1 live gate did not retain the ${direction > 0 ? "right" : "left"} skull`);
}

async function mountNestedDamageTransform(page: Page): Promise<DamageTransformCapture> {
  await page.evaluate(() => {
    const arena = (
      globalThis as unknown as {
        ddGame: { scene: { getScene(key: string): unknown } };
      }
    ).ddGame.scene.getScene("arena") as {
      add: {
        container(
          x: number,
          y: number,
        ): {
          add(child: unknown): void;
          setRotation(value: number): unknown;
          setScale(x: number, y: number): unknown;
          setVisible(value: boolean): unknown;
        };
        rectangle(
          x: number,
          y: number,
          width: number,
          height: number,
          color: number,
          alpha: number,
        ): {
          getWorldTransformMatrix(): {
            a: number;
            b: number;
            c: number;
            d: number;
            transformPoint(x: number, y: number): { x: number; y: number };
          };
        };
      };
      cameras: {
        main: {
          setRotation(value: number): unknown;
          setZoom(value: number): unknown;
        };
      };
      damageNumberRenderer: {
        add(event: unknown, nowMs: number): void;
        clear(): void;
      };
      room: {
        sessionId: string;
        state: {
          players: { get(id: string): { x: number; y: number } | undefined };
        };
      };
      time: { now: number };
    };
    const self = arena.room.state.players.get(arena.room.sessionId);
    if (!self) throw new Error("B1 nested transform gate has no local player");

    arena.cameras.main.setZoom(1.35);
    arena.cameras.main.setRotation(0.22);
    const outer = arena.add.container(self.x + 182, self.y + 60);
    outer.setRotation(0.31);
    outer.setScale(-1.15, 0.88);
    outer.setVisible(false);
    const inner = arena.add.container(37, -18);
    inner.setRotation(-0.27);
    inner.setScale(0.82, 1.19);
    const socket = arena.add.rectangle(21, -26, 2, 2, 0xffffff, 0);
    outer.add(inner);
    inner.add(socket);
    const matrix = socket.getWorldTransformMatrix();
    const sourceWorld = matrix.transformPoint(0, 0);
    (
      globalThis as unknown as {
        __b1DamageSource?: {
          sourceWorld: { x: number; y: number };
          sourceWorldDeterminant: number;
        };
      }
    ).__b1DamageSource = {
      sourceWorld,
      sourceWorldDeterminant: matrix.a * matrix.d - matrix.b * matrix.c,
    };

    arena.damageNumberRenderer.clear();
    arena.damageNumberRenderer.add(
      {
        targetId: "b1-nested-hit",
        damage: 42,
        x: sourceWorld.x,
        y: sourceWorld.y,
        visible: true,
        attribution: "self",
        crit: true,
        finalBlow: false,
        selfDamage: false,
      },
      arena.time.now,
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
            damageNumberRenderer: {
              labels: Array<{ visible: boolean }>;
            };
          };
          return arena.damageNumberRenderer.labels.some((label) => label.visible);
        }),
      { message: "nested damage glyph should become visible through the real renderer" },
    )
    .toBe(true);

  // The visibility edge is set during Scene.update; wait through a render turn so the screenshot and
  // matrix capture prove a submitted BitmapText draw, not merely a mutated pooled object.
  await page.waitForTimeout(100);

  return await page.evaluate(() => {
    const holder = globalThis as unknown as {
      __b1DamageSource: {
        sourceWorld: { x: number; y: number };
        sourceWorldDeterminant: number;
      };
      ddGame: { scene: { getScene(key: string): unknown } };
    };
    const arena = holder.ddGame.scene.getScene("arena") as {
      cameras: {
        main: {
          scrollX: number;
          scrollY: number;
          zoomX: number;
          zoomY: number;
          rotation: number;
          matrixCombined: {
            a: number;
            b: number;
            c: number;
            d: number;
            transformPoint(x: number, y: number): { x: number; y: number };
          };
        };
      };
      damageNumberRenderer: {
        labels: Array<{
          visible: boolean;
          text: string;
          getWorldTransformMatrix(): {
            a: number;
            b: number;
            c: number;
            d: number;
            transformPoint(x: number, y: number): { x: number; y: number };
          };
        }>;
        screenRoot: {
          parentContainer: unknown;
          scrollFactorX: number;
          scrollFactorY: number;
        };
      };
    };
    const camera = arena.cameras.main;
    const renderer = arena.damageNumberRenderer;
    const glyph = renderer.labels.find((label) => label.visible);
    if (!glyph) throw new Error("B1 visible damage glyph disappeared before matrix capture");
    const glyphWorld = glyph.getWorldTransformMatrix();
    const baselineScreenRaw = {
      x: camera.matrixCombined.a * glyphWorld.a + camera.matrixCombined.c * glyphWorld.b,
      y: camera.matrixCombined.b * glyphWorld.a + camera.matrixCombined.d * glyphWorld.b,
    };
    const baselineLength = Math.hypot(baselineScreenRaw.x, baselineScreenRaw.y) || 1;
    const baselineScreen = {
      x: baselineScreenRaw.x / baselineLength,
      y: baselineScreenRaw.y / baselineLength,
      angle: Math.atan2(baselineScreenRaw.y, baselineScreenRaw.x),
    };
    const glyphOverlayPoint = glyphWorld.transformPoint(0, 0);
    // A scroll-factor-zero object at (world - scroll) reaches the same screen point as a world object.
    const glyphScreen = camera.matrixCombined.transformPoint(
      glyphOverlayPoint.x + camera.scrollX,
      glyphOverlayPoint.y + camera.scrollY,
    );
    const sourceScreen = camera.matrixCombined.transformPoint(
      holder.__b1DamageSource.sourceWorld.x,
      holder.__b1DamageSource.sourceWorld.y,
    );
    return {
      text: glyph.text,
      camera: {
        scrollX: camera.scrollX,
        scrollY: camera.scrollY,
        zoomX: camera.zoomX,
        zoomY: camera.zoomY,
        rotation: camera.rotation,
      },
      sourceWorld: holder.__b1DamageSource.sourceWorld,
      sourceWorldDeterminant: holder.__b1DamageSource.sourceWorldDeterminant,
      screenRoot: {
        parentIsNull: renderer.screenRoot.parentContainer == null,
        scrollFactorX: renderer.screenRoot.scrollFactorX,
        scrollFactorY: renderer.screenRoot.scrollFactorY,
      },
      baselineScreen,
      screenDeterminant:
        (camera.matrixCombined.a * camera.matrixCombined.d -
          camera.matrixCombined.b * camera.matrixCombined.c) *
        (glyphWorld.a * glyphWorld.d - glyphWorld.b * glyphWorld.c),
      glyphScreen,
      sourceScreen,
      presentationOffsetPx: Math.hypot(
        glyphScreen.x - sourceScreen.x,
        glyphScreen.y - sourceScreen.y,
      ),
    };
  });
}

test("B1 keeps holy skull tops and damage baselines screen-upright through the live stack", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await runArenaSpec(page, async (baseURL) => {
    await mkdir(EVIDENCE_DIR, { recursive: true });
    await page.setViewportSize({ width: 800, height: 450 });
    await prepare(page, baseURL);

    const right = await fireAndCapture(page, 1, true);
    await page
      .locator("#game-root canvas")
      .screenshot({ path: path.join(EVIDENCE_DIR, "holy-skull-right.png") });
    // Re-enter through the real dev-equip flow so the one-round Saintskull has a fresh authoritative
    // magazine for the opposite direction without mutating server weapon state from the browser.
    await prepare(page, baseURL);
    const left = await fireAndCapture(page, -1, true);
    await page
      .locator("#game-root canvas")
      .screenshot({ path: path.join(EVIDENCE_DIR, "holy-skull-left.png") });
    await prepare(page, baseURL);
    const damage = await mountNestedDamageTransform(page);
    await page
      .locator("#game-root canvas")
      .screenshot({ path: path.join(EVIDENCE_DIR, "damage-number-transform.png") });

    expect(right.projectileSprite).toBe(PROJECTILE_SPRITE_ID);
    expect(left.projectileSprite).toBe(PROJECTILE_SPRITE_ID);
    expect(right.textureKey).toBe(`gun-generated:${WEAPON_ID}`);
    expect(left.textureKey).toBe(`gun-generated:${WEAPON_ID}`);
    expect(right.vx).toBeGreaterThan(0);
    expect(left.vx).toBeLessThan(0);
    expect(Math.abs(right.vy)).toBeLessThan(right.speed * 0.01);
    expect(Math.abs(left.vy)).toBeLessThan(left.speed * 0.01);
    expect(right.forwardDotVelocity).toBeGreaterThan(0.9999);
    expect(left.forwardDotVelocity).toBeGreaterThan(0.9999);
    expect(right.flightTravelPx).toBeGreaterThanOrEqual(18);
    expect(left.flightTravelPx).toBeGreaterThanOrEqual(18);
    expect(right.artScaleX).toBeGreaterThan(0);
    expect(left.artScaleX).toBeLessThan(0);
    expect(Math.abs(right.artRotation)).toBeLessThan(0.01);
    expect(Math.abs(left.artRotation)).toBeLessThan(0.01);
    expect(right.topScreen.y).toBeLessThan(-0.999);
    expect(left.topScreen.y).toBeLessThan(-0.999);
    expect(
      right.topScreen.x * left.topScreen.x + right.topScreen.y * left.topScreen.y,
    ).toBeGreaterThan(0.9999);

    expect(damage.sourceWorldDeterminant).toBeLessThan(0);
    expect(damage.camera.zoomX).toBeCloseTo(1.35, 2);
    expect(damage.camera.zoomY).toBeCloseTo(1.35, 2);
    expect(damage.camera.rotation).toBeCloseTo(0.22, 2);
    expect(Math.abs(damage.camera.scrollX) + Math.abs(damage.camera.scrollY)).toBeGreaterThan(0);
    expect(damage.screenRoot).toEqual({
      parentIsNull: true,
      scrollFactorX: 0,
      scrollFactorY: 0,
    });
    expect(Math.abs(damage.baselineScreen.angle)).toBeLessThan(0.01);
    expect(damage.baselineScreen.x).toBeGreaterThan(0.999);
    expect(damage.screenDeterminant).toBeGreaterThan(0);
    expect(damage.presentationOffsetPx).toBeLessThan(20);

    await writeFile(
      path.join(EVIDENCE_DIR, "b1-facing-live-capture.json"),
      `${JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          privateBaseURL: baseURL,
          right,
          left,
          damage,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  });
});
