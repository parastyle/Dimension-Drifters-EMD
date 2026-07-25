import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { BELT_Y0 } from "@dd/shared";
import { expect, type Page, test } from "@playwright/test";
import { bootArena, runArenaSpec } from "../helpers/arena-harness.js";

const EVIDENCE_DIR = path.resolve(
  import.meta.dirname,
  "../../docs/owner-notes-audit-v12-evidence/b56-belt-parity",
);
const CHARACTER_ID = "proto-cowboy-hidden-face";
const WEAPON_ID = "x2-barrett-50-cal-sniper";

interface FlipSample {
  step: number;
  targetFacing: -1 | 1;
  facing: number;
  facingBlend: number;
  rootScaleX: number;
  rootX: number;
  rootY: number;
  presentedWorldX: number;
  presentedWorldY: number;
  projectionErrorPx: number;
  weaponAimError: number;
}

async function focusGameplay(page: Page): Promise<void> {
  await page.locator("#game-root canvas").click({ position: { x: 640, y: 360 } });
  await page.evaluate(() => {
    const arena = (
      globalThis as unknown as {
        ddGame?: {
          scene: {
            getScene(key: string): {
              time?: { now: number };
              verbs?: {
                closeForCompetingModal(nowMs: number): void;
                releaseInputLatchIf(inputsReleased: boolean): void;
              };
            };
          };
        };
      }
    ).ddGame?.scene.getScene("arena");
    arena?.verbs?.closeForCompetingModal(arena.time?.now ?? 0);
    arena?.verbs?.releaseInputLatchIf(true);
  });
}

async function equipFixture(page: Page): Promise<void> {
  await page.evaluate(
    ({ character, weapon }) => {
      const arena = (
        globalThis as unknown as {
          ddGame?: {
            scene: {
              getScene(key: string): {
                room?: { send(type: string, payload: unknown): void };
              };
            };
          };
        }
      ).ddGame?.scene.getScene("arena");
      arena?.room?.send("devEquip", { character, weapon });
    },
    { character: CHARACTER_ID, weapon: WEAPON_ID },
  );
  await expect
    .poll(
      () =>
        page.evaluate(
          ({ character, weapon }) => {
            const arena = (
              globalThis as unknown as {
                ddGame?: {
                  scene: {
                    getScene(key: string): {
                      room?: {
                        sessionId?: string;
                        state?: {
                          players?: {
                            get(id: string): { character?: string; weapon?: string } | undefined;
                          };
                        };
                      };
                    };
                  };
                };
              }
            ).ddGame?.scene.getScene("arena");
            const id = arena?.room?.sessionId ?? "";
            const self = id ? arena?.room?.state?.players?.get(id) : undefined;
            return {
              character: self?.character ?? "",
              weapon: self?.weapon ?? "",
              expectedCharacter: character,
              expectedWeapon: weapon,
            };
          },
          { character: CHARACTER_ID, weapon: WEAPON_ID },
        ),
      { message: "belt flip fixture should equip the hidden-face gun rig", timeout: 30_000 },
    )
    .toMatchObject({ character: CHARACTER_ID, weapon: WEAPON_ID });
}

async function rigScreenPoint(page: Page): Promise<{ x: number; y: number }> {
  return page.evaluate(() => {
    const arena = (
      globalThis as unknown as {
        ddGame?: {
          scene: {
            getScene(key: string): {
              room?: { sessionId?: string };
              blobs?: Map<string, { x: number; y: number }>;
              cameras: {
                main: { x: number; y: number; scrollX: number; scrollY: number; zoom: number };
              };
            };
          };
        };
      }
    ).ddGame?.scene.getScene("arena");
    const id = arena?.room?.sessionId ?? "";
    const rig = id ? arena?.blobs?.get(id) : undefined;
    if (!arena || !rig) throw new Error("B56 belt flip probe lost its local rig");
    const camera = arena.cameras.main;
    return {
      x: camera.x + (rig.x - camera.scrollX) * camera.zoom,
      y: camera.y + (rig.y - camera.scrollY) * camera.zoom,
    };
  });
}

async function sampleFlip(
  page: Page,
  step: number,
  targetFacing: -1 | 1,
  belt: boolean,
): Promise<FlipSample> {
  const screen = await rigScreenPoint(page);
  const x = targetFacing > 0 ? Math.min(1_270, screen.x + 600) : Math.max(10, screen.x - 180);
  const y = Math.max(80, Math.min(680, screen.y - 120 + (step % 2) * 220));
  await page.mouse.move(x, y);
  await page.waitForTimeout(180);
  return page.evaluate(
    ({ cursorX, cursorY, index, sign, beltY0, beltMode }) => {
      const arena = (
        globalThis as unknown as {
          ddGame?: {
            scene: {
              getScene(key: string): {
                pointerScreen: { x: number; y: number };
                selfPresentedWorldX?: number;
                selfPresentedWorldY?: number;
                room?: { sessionId?: string };
                blobs?: Map<
                  string,
                  {
                    x: number;
                    y: number;
                    facing?: number;
                    facingBlend?: number;
                    root: { scaleX: number };
                    leadWeaponTipPose(): { axisX: number; axisY: number } | undefined;
                  }
                >;
                cameras: {
                  main: { getWorldPoint(x: number, y: number): { x: number; y: number } };
                };
              };
            };
          };
        }
      ).ddGame?.scene.getScene("arena");
      const id = arena?.room?.sessionId ?? "";
      const rig = id ? arena?.blobs?.get(id) : undefined;
      const tip = rig?.leadWeaponTipPose();
      if (!arena || !rig || !tip) throw new Error("B56 belt flip sample is incomplete");
      const cursor = arena.cameras.main.getWorldPoint(arena.pointerScreen.x, arena.pointerScreen.y);
      const dx = cursor.x - rig.x;
      const dy = cursor.y - rig.y;
      const length = Math.hypot(dx, dy) || 1;
      const expectedX = dx / length;
      const expectedY = dy / length;
      const worldX = arena.selfPresentedWorldX ?? Number.NaN;
      const worldY = arena.selfPresentedWorldY ?? Number.NaN;
      const projectedY = beltMode ? beltY0 + (worldY - beltY0) * 0.5 : worldY;
      return {
        step: index,
        targetFacing: sign,
        facing: rig.facing ?? 0,
        facingBlend: rig.facingBlend ?? 0,
        rootScaleX: rig.root.scaleX,
        rootX: rig.x,
        rootY: rig.y,
        presentedWorldX: worldX,
        presentedWorldY: worldY,
        projectionErrorPx: Math.hypot(rig.x - worldX, rig.y - projectedY),
        weaponAimError: Math.hypot(tip.axisX - expectedX, tip.axisY - expectedY),
        cursor: { x: cursorX, y: cursorY },
      };
    },
    {
      cursorX: x,
      cursorY: y,
      index: step,
      sign: targetFacing,
      beltY0: BELT_Y0,
      beltMode: belt,
    },
  );
}

test("B56 belt counterpart to B53 flip probe keeps one root and cursor aim through rapid facings", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await runArenaSpec(page, async (baseURL) => {
    expect(["5180", "2567"]).not.toContain(new URL(baseURL).port);
    await bootArena(page, baseURL, `char:${CHARACTER_ID}`, "corporate-grid");
    await focusGameplay(page);
    await equipFixture(page);
    const warmScreen = await rigScreenPoint(page);
    await page.mouse.move(Math.min(1_270, warmScreen.x + 600), warmScreen.y);
    await page.waitForTimeout(500);

    const samples: FlipSample[] = [];
    const facings = [-1, 1, -1, 1, -1, 1] as const;
    for (let step = 0; step < facings.length; step++) {
      const facing = facings[step];
      if (facing === undefined) throw new Error(`missing B56 facing at step ${step}`);
      samples.push(await sampleFlip(page, step, facing, true));
      if (step === 0 || step === 1) {
        await page.screenshot({
          path: path.join(EVIDENCE_DIR, `belt-flip-${facing > 0 ? "right" : "left"}.png`),
        });
      }
    }

    await writeFile(
      path.join(EVIDENCE_DIR, "belt-flip-probe.json"),
      `${JSON.stringify({ baseURL, samples }, null, 2)}\n`,
      "utf8",
    );
    for (const sample of samples) {
      expect(sample.facing, `flip ${sample.step}: discrete facing`).toBe(sample.targetFacing);
      expect(Math.sign(sample.facingBlend), `flip ${sample.step}: blended facing`).toBe(
        sample.targetFacing,
      );
      expect(Math.sign(sample.rootScaleX), `flip ${sample.step}: painted root scale`).toBe(
        sample.targetFacing,
      );
      expect(sample.projectionErrorPx, `flip ${sample.step}: one projected root`).toBeLessThan(3);
      expect(sample.weaponAimError, `flip ${sample.step}: weapon remains on cursor`).toBeLessThan(
        0.16,
      );
    }
    const rootXSpan =
      Math.max(...samples.map((sample) => sample.rootX)) -
      Math.min(...samples.map((sample) => sample.rootX));
    const worldXSpan =
      Math.max(...samples.map((sample) => sample.presentedWorldX)) -
      Math.min(...samples.map((sample) => sample.presentedWorldX));
    expect(rootXSpan, "facing changes must not move the rendered player root").toBeLessThan(4);
    expect(worldXSpan, "facing changes must not change the retained position source").toBeLessThan(
      4,
    );
  });
});

test("B56 top-down B53 flip baseline stays paired with the belt counterpart", async ({ page }) => {
  test.setTimeout(120_000);
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await runArenaSpec(page, async (baseURL) => {
    await bootArena(page, baseURL, `char:${CHARACTER_ID}`);
    await focusGameplay(page);
    await equipFixture(page);
    const warmScreen = await rigScreenPoint(page);
    await page.mouse.move(Math.min(1_270, warmScreen.x + 600), warmScreen.y);
    await page.waitForTimeout(500);

    const samples: FlipSample[] = [];
    const facings = [-1, 1, -1, 1] as const;
    for (let step = 0; step < facings.length; step++) {
      const facing = facings[step];
      if (facing === undefined) throw new Error(`missing top-down B56 facing at step ${step}`);
      samples.push(await sampleFlip(page, step, facing, false));
    }
    await writeFile(
      path.join(EVIDENCE_DIR, "topdown-flip-baseline.json"),
      `${JSON.stringify({ baseURL, samples }, null, 2)}\n`,
      "utf8",
    );
    for (const sample of samples) {
      expect(sample.facing).toBe(sample.targetFacing);
      expect(Math.sign(sample.rootScaleX)).toBe(sample.targetFacing);
      expect(sample.projectionErrorPx).toBeLessThan(3);
      expect(sample.weaponAimError).toBeLessThan(0.16);
    }
  });
});
