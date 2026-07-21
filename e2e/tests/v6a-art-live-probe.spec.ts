import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { bootArena, runArenaSpec, waitForDevWeapon } from "../helpers/arena-harness.js";

const EVIDENCE_DIR = path.resolve(
  import.meta.dirname,
  "../../docs/owner-notes-audit-v6-evidence/v6a",
);

interface LiveArena {
  game: { hasFocus: boolean };
  input: { activePointer: { rightButtonDown(): boolean } };
  localAtkCd?: number;
  pointerOverInteractiveUi?: boolean;
  selfAim?: { x: number; y: number };
  sendAttack?(): void;
  time?: { now: number };
  verbs?: {
    isLegendOpen?(): boolean;
    toggleLegend?(nowMs: number): void;
    releaseInputLatchIf?(release: boolean): void;
  };
  room: {
    sessionId: string;
    send(type: string, payload?: unknown): void;
    state: {
      players: { get(id: string): { x: number; y: number; weapon?: string } | undefined };
    };
  };
  scene: { pause(): void };
  children: { list: unknown[] };
  projectiles: Map<string, LiveGameObject>;
}

interface LiveGameObject {
  visible?: boolean;
  alpha?: number;
  displayWidth?: number;
  displayHeight?: number;
  texture?: { key?: string };
  frame?: { name?: string };
  list?: LiveGameObject[];
  getData?(key: string): unknown;
}

interface LiveHolder {
  ddGame: { scene: { getScene(key: string): LiveArena } };
  __ddV6GAnchorCapture?: boolean;
  __ddV6GAnchorEvents?: Array<Record<string, unknown>>;
  __v6aAttackTimer?: number;
  __v6aVisualRaf?: number;
  __v6aVisual?: {
    seen: boolean;
    width: number;
    height: number;
    currentSeen: boolean;
    currentWidth: number;
  };
}

async function bootWeapon(
  page: Page,
  baseURL: string,
  weaponId: string,
  suffix = "",
): Promise<void> {
  await bootArena(page, baseURL, `weapon:${weaponId}${suffix}`);
  await waitForDevWeapon(page, weaponId);
  await page.locator("#game-root canvas").click({ position: { x: 320, y: 180 } });
  await page.mouse.move(555, 180);
  await page.evaluate(() => {
    const arena = (globalThis as unknown as LiveHolder).ddGame.scene.getScene("arena");
    if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend?.(arena.time?.now ?? 0);
    arena.verbs?.releaseInputLatchIf?.(true);
    arena.game.hasFocus = true;
    arena.pointerOverInteractiveUi = false;
  });
}

async function watchAcceptedAttackTexture(
  page: Page,
  textureKey: string,
  minLiveWidth = 0,
): Promise<{ seen: boolean; width: number; height: number }> {
  await page.evaluate(
    ({ wantedTexture, freezeWidth }) => {
      const holder = globalThis as unknown as LiveHolder;
      holder.__ddV6GAnchorCapture = true;
      holder.__ddV6GAnchorEvents = [];
      holder.__v6aVisual = {
        seen: false,
        width: 0,
        height: 0,
        currentSeen: false,
        currentWidth: 0,
      };
      const findTexture = (candidate: LiveGameObject): void => {
        if (
          candidate.texture?.key === wantedTexture &&
          candidate.visible !== false &&
          (candidate.alpha ?? 1) > 0
        ) {
          holder.__v6aVisual = {
            seen: true,
            width: Math.max(holder.__v6aVisual?.width ?? 0, candidate.displayWidth ?? 0),
            height: Math.max(holder.__v6aVisual?.height ?? 0, candidate.displayHeight ?? 0),
            currentSeen: true,
            currentWidth: candidate.displayWidth ?? 0,
          };
        }
        for (const child of candidate.list ?? []) findTexture(child);
      };
      const scan = (): void => {
        const arena = holder.ddGame.scene.getScene("arena");
        if (holder.__v6aVisual) {
          holder.__v6aVisual.currentSeen = false;
          holder.__v6aVisual.currentWidth = 0;
        }
        for (const child of arena.children.list as LiveGameObject[]) findTexture(child);
        if (
          holder.__v6aVisual?.currentSeen &&
          (freezeWidth <= 0 || holder.__v6aVisual.currentWidth > freezeWidth)
        ) {
          arena.scene.pause();
          return;
        }
        holder.__v6aVisualRaf = window.requestAnimationFrame(scan);
      };
      scan();

      const fire = (): void => {
        const arena = holder.ddGame.scene.getScene("arena");
        const room = arena.room;
        const self = room.state.players.get(room.sessionId);
        if (!self) return;
        const tx = self.x + 200;
        const ty = self.y;
        const dx = tx - self.x;
        const dy = ty - self.y;
        const length = Math.hypot(dx, dy) || 1;
        arena.selfAim = { x: dx / length, y: dy / length };
        arena.localAtkCd = 0;
        arena.input.activePointer.rightButtonDown = () => true;
        arena.sendAttack?.();
      };
      fire();
      holder.__v6aAttackTimer = window.setInterval(fire, 900);
    },
    { wantedTexture: textureKey, freezeWidth: minLiveWidth },
  );

  try {
    await expect
      .poll(
        () =>
          page.evaluate((minimumWidth) => {
            const visual = (globalThis as unknown as LiveHolder).__v6aVisual;
            return minimumWidth > 0
              ? (visual?.currentWidth ?? 0) > minimumWidth
              : (visual?.currentSeen ?? false);
          }, minLiveWidth),
        {
          message: `${textureKey} should become visible during an accepted attack`,
          timeout: 8_000,
        },
      )
      .toBe(true);
  } catch (error) {
    const diagnostic = await page.evaluate((wantedTexture) => {
      const holder = globalThis as unknown as LiveHolder;
      const arena = holder.ddGame.scene.getScene("arena") as LiveArena & {
        vfxPlayer?: { pool?: Array<{ headsmanExtension?: LiveGameObject; busy?: boolean }> };
      };
      return {
        wantedTexture,
        textureLoaded: Boolean(
          (arena as unknown as { textures?: { exists(key: string): boolean } }).textures?.exists(
            wantedTexture,
          ),
        ),
        anchorEvents: holder.__ddV6GAnchorEvents,
        pool: arena.vfxPlayer?.pool?.map((surface) => ({
          busy: surface.busy,
          extension: {
            texture: surface.headsmanExtension?.texture?.key,
            visible: surface.headsmanExtension?.visible,
            width: surface.headsmanExtension?.displayWidth,
          },
        })),
      };
    }, textureKey);
    throw new Error(`${String(error)}\nV6A live diagnostic: ${JSON.stringify(diagnostic)}`);
  }
  return page.evaluate(
    () =>
      (globalThis as unknown as LiveHolder).__v6aVisual ?? {
        seen: false,
        width: 0,
        height: 0,
      },
  );
}

async function stopVisualProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const holder = globalThis as unknown as LiveHolder;
    if (holder.__v6aAttackTimer) window.clearInterval(holder.__v6aAttackTimer);
    if (holder.__v6aVisualRaf) window.cancelAnimationFrame(holder.__v6aVisualRaf);
    holder.ddGame.scene.getScene("arena").input.activePointer.rightButtonDown = () => false;
    holder.__v6aAttackTimer = undefined;
    holder.__v6aVisualRaf = undefined;
  });
}

test("V6A Twin Whispervolumes renders a generated page on its live chain path", async ({
  page,
}) => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await runArenaSpec(page, async (baseURL) => {
    await bootWeapon(page, baseURL, "x2-twin-whispervolumes");
    const twin = await watchAcceptedAttackTexture(page, "page-projectile:twin-whispervolumes");
    expect(twin).toMatchObject({ width: 30, height: 22 });
    await page.screenshot({ path: path.join(EVIDENCE_DIR, "twin-whisper-page.png") });
    await stopVisualProbe(page);
  });
});

test("V6A Coyote's Grin renders its registered blade without a circle overlay", async ({
  page,
}) => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await runArenaSpec(page, async (baseURL) => {
    await bootWeapon(page, baseURL, "x2-coyote-s-grin");
    await page.evaluate(() => {
      const holder = globalThis as unknown as LiveHolder;
      const fire = (): void => {
        const arena = holder.ddGame.scene.getScene("arena");
        const room = arena.room;
        const self = room.state.players.get(room.sessionId);
        if (self) room.send("attack", { aimX: 1, aimY: 0, tx: self.x + 500, ty: self.y });
      };
      fire();
      holder.__v6aAttackTimer = window.setInterval(fire, 250);
    });
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const arena = (globalThis as unknown as LiveHolder).ddGame.scene.getScene("arena");
            for (const projectile of arena.projectiles.values()) {
              if (projectile.getData?.("projectileSprite") !== "coyotes-grin-throwing-blade")
                continue;
              const payload = projectile.getData?.("arcPayload") as LiveGameObject | undefined;
              return {
                found: true,
                payloadChildren: payload?.list?.length ?? 0,
                containsPrimitiveCircle: (payload?.list ?? []).some((child) =>
                  /Ellipse|Arc/.test(
                    String((child as LiveGameObject & { type?: string }).type ?? ""),
                  ),
                ),
              };
            }
            return { found: false, payloadChildren: 0, containsPrimitiveCircle: false };
          }),
        { timeout: 8_000 },
      )
      .toMatchObject({ found: true, payloadChildren: 1, containsPrimitiveCircle: false });
    await page.screenshot({ path: path.join(EVIDENCE_DIR, "coyotes-grin-projectile.png") });
    await stopVisualProbe(page);
  });
});

test("V6A deep links render Headsman options, the buster, and Verdigris pages", async ({
  page,
}) => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await runArenaSpec(page, async (baseURL) => {
    for (let proto = 1; proto <= 4; proto++) {
      await bootWeapon(page, baseURL, "x2-sanctified-headsman", `&proto=${proto}`);
      const visual = await watchAcceptedAttackTexture(page, `headsman-proto:${proto}`, 200);
      expect(visual.width).toBeGreaterThan(200);
      await page.screenshot({ path: path.join(EVIDENCE_DIR, `headsman-proto-${proto}.png`) });
      await stopVisualProbe(page);
    }
    await bootWeapon(page, baseURL, "gravediggers-spade");
    await expect
      .poll(() =>
        page.evaluate(() => {
          const arena = (globalThis as unknown as LiveHolder).ddGame.scene.getScene("arena");
          const findFrame = (candidate: LiveGameObject): boolean =>
            candidate.frame?.name === "gravewarden-buster/part-1" ||
            (candidate.list ?? []).some(findFrame);
          return (arena.children.list as LiveGameObject[]).some(findFrame);
        }),
      )
      .toBe(true);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, "gravewarden-buster.png") });

    await bootWeapon(page, baseURL, "x2-verdigris-grand-grimoire");
    const verdigris = await watchAcceptedAttackTexture(
      page,
      "page-projectile:verdigris-grand-grimoire",
    );
    expect(verdigris).toMatchObject({ width: 98, height: 70 });
    await page.screenshot({ path: path.join(EVIDENCE_DIR, "verdigris-grand-page.png") });
    await stopVisualProbe(page);
  });
});
