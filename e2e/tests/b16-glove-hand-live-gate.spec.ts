import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { bootArena, runArenaSpec } from "../helpers/arena-harness.js";

const EVIDENCE_DIR = path.resolve(
  import.meta.dirname,
  "../../docs/owner-notes-audit-v10-evidence/b16-glove-hand",
);
const CHARACTER_ID = "proto-sheriff";
const WEAPONS = [
  { id: "x2-ironbrand-heatfist", pose: "mirror-guard", authoredPose: "mirror-guard" },
  { id: "x2-hellmouth-palmcaster", pose: "casting-gesture", authoredPose: null },
] as const;
const FACINGS = ["right", "left"] as const;
const FACING_MARGIN_PX = 76 * 0.03;

type Facing = (typeof FACINGS)[number];

interface BrowserDisplay {
  x: number;
  y: number;
  displayWidth: number;
  displayHeight: number;
  getWorldTransformMatrix(): { tx: number; ty: number };
  setVisible(value: boolean): BrowserDisplay;
}

interface BrowserPart {
  img: BrowserDisplay;
  front: boolean;
}

interface BrowserRig {
  facing: number;
  body: BrowserDisplay;
  hands: BrowserPart[];
  weaponDef?: { id: string; poseLanguage?: { idle?: string } };
  weapons: Array<{ img: BrowserDisplay }>;
  label?: BrowserDisplay;
}

interface BrowserArena {
  blobs: Map<string, BrowserRig>;
  cameras: { main: { setZoom(value: number): void } };
  game: { hasFocus: boolean };
  pointerOverInteractiveUi: boolean;
  objectiveEconomyText?: BrowserDisplay;
  objectiveHudGfx?: BrowserDisplay;
  objectiveLocationText?: BrowserDisplay;
  objectiveNoticeText?: BrowserDisplay;
  objectiveText?: BrowserDisplay;
  parryGfx?: BrowserDisplay;
  room: {
    sessionId: string;
    send(type: string, message?: unknown): void;
    state: { players: { get(id: string): { weapon?: string } | undefined } };
  };
  time: { now: number };
  verbs?: {
    isLegendOpen?(): boolean;
    releaseInputLatchIf?(force: boolean): void;
    toggleLegend?(timeMs: number): void;
  };
}

interface BrowserGlobal {
  ddGame: { scene: { getScene(key: string): BrowserArena } };
}

interface LiveCapture {
  characterId: string;
  weaponId: string;
  expectedPose: string;
  authoredPose: string | null;
  facing: Facing;
  committedFacing: number;
  body: { x: number; width: number; worldX: number };
  freeHand: {
    x: number;
    width: number;
    worldX: number;
    localFacingMarginPx: number;
    worldFacingMarginPx: number;
    visibleFacingEdgePx: number;
    bodyFacingEdgePx: number;
  };
  primaryGripOriginDeltaPx: number;
  screenshot: string;
}

function relativeEvidencePath(file: string): string {
  return path.relative(process.cwd(), file).replaceAll("\\", "/");
}

async function equip(page: Page, weaponId: string): Promise<void> {
  await page.evaluate((id) => {
    const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
    arena.room.send("devEquip", { weapon: id });
  }, weaponId);
  await expect
    .poll(
      () =>
        page.evaluate((id) => {
          const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
          const self = arena.room.state.players.get(arena.room.sessionId);
          const rig = arena.blobs.get(arena.room.sessionId);
          return { authority: self?.weapon ?? null, rig: rig?.weaponDef?.id ?? null, wanted: id };
        }, weaponId),
      { message: `B16 gate should equip ${weaponId}`, timeout: 20_000 },
    )
    .toEqual({ authority: weaponId, rig: weaponId, wanted: weaponId });
}

async function aim(page: Page, facing: Facing): Promise<void> {
  const canvas = page.locator("#game-root canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("B16 gate cannot find the Phaser canvas bounds");
  await page.mouse.move(
    box.x + box.width * (facing === "right" ? 0.9 : 0.1),
    box.y + box.height * 0.5,
  );
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
          return arena.blobs.get(arena.room.sessionId)?.facing ?? 0;
        }),
      { message: `B16 rig should commit facing ${facing}`, timeout: 10_000 },
    )
    .toBe(facing === "right" ? 1 : -1);
  await page.waitForTimeout(240);
}

async function measure(
  page: Page,
  fixture: (typeof WEAPONS)[number],
  facing: Facing,
): Promise<Omit<LiveCapture, "screenshot">> {
  return await page.evaluate(
    ({ characterId, weaponId, expectedPose, facing }) => {
      const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
      const rig = arena.blobs.get(arena.room.sessionId);
      if (!rig?.weaponDef || rig.weaponDef.id !== weaponId) {
        throw new Error(`B16 live rig missing ${weaponId}`);
      }
      const freeHand = rig.hands.find((hand) => !hand.front);
      const weaponHand = rig.hands.find((hand) => hand.front);
      const weapon = rig.weapons[0]?.img;
      if (!freeHand || !weaponHand || !weapon) throw new Error("B16 live rig is incomplete");
      const world = (display: BrowserDisplay) => {
        const matrix = display.getWorldTransformMatrix();
        return { x: matrix.tx, y: matrix.ty };
      };
      const bodyWorld = world(rig.body);
      const handWorld = world(freeHand.img);
      const weaponWorld = world(weapon);
      const weaponHandWorld = world(weaponHand.img);

      rig.label?.setVisible(false);
      arena.objectiveHudGfx?.setVisible(false);
      arena.objectiveText?.setVisible(false);
      arena.objectiveLocationText?.setVisible(false);
      arena.objectiveEconomyText?.setVisible(false);
      arena.objectiveNoticeText?.setVisible(false);
      arena.parryGfx?.setVisible(false);

      return {
        characterId,
        weaponId,
        expectedPose,
        authoredPose: rig.weaponDef.poseLanguage?.idle ?? null,
        facing,
        committedFacing: rig.facing,
        body: {
          x: rig.body.x,
          width: rig.body.displayWidth,
          worldX: bodyWorld.x,
        },
        freeHand: {
          x: freeHand.img.x,
          width: freeHand.img.displayWidth,
          worldX: handWorld.x,
          localFacingMarginPx: freeHand.img.x - rig.body.x,
          worldFacingMarginPx: (handWorld.x - bodyWorld.x) * rig.facing,
          visibleFacingEdgePx: freeHand.img.x + freeHand.img.displayWidth / 2,
          bodyFacingEdgePx: rig.body.x + rig.body.displayWidth / 2,
        },
        primaryGripOriginDeltaPx: Math.hypot(
          weaponWorld.x - weaponHandWorld.x,
          weaponWorld.y - weaponHandWorld.y,
        ),
      };
    },
    {
      characterId: CHARACTER_ID,
      weaponId: fixture.id,
      expectedPose: fixture.pose,
      facing,
    },
  );
}

test("B16 Ironbrand and Hellmouth idle hands stay facing-side on proto-sheriff", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await runArenaSpec(page, async (baseURL) => {
    await mkdir(EVIDENCE_DIR, { recursive: true });
    await page.setViewportSize({ width: 640, height: 360 });
    await bootArena(page, baseURL, `char:${CHARACTER_ID}`);
    await page.locator("#game-root canvas").click({ position: { x: 320, y: 180 } });
    await page.evaluate(() => {
      const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
      if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend?.(arena.time.now);
      arena.verbs?.releaseInputLatchIf?.(true);
      arena.game.hasFocus = true;
      arena.pointerOverInteractiveUi = false;
      arena.cameras.main.setZoom(2.05);
    });

    const captures: LiveCapture[] = [];
    for (const weapon of WEAPONS) {
      await equip(page, weapon.id);
      await page.waitForTimeout(320);
      for (const facing of FACINGS) {
        await aim(page, facing);
        const slug = `${CHARACTER_ID}-${weapon.id}-${facing}`;
        const screenshotFile = path.join(EVIDENCE_DIR, `${slug}.png`);
        const measured = await measure(page, weapon, facing);
        await page.locator("#game-root canvas").screenshot({ path: screenshotFile });
        const capture: LiveCapture = {
          ...measured,
          screenshot: relativeEvidencePath(screenshotFile),
        };

        expect(capture.authoredPose, `${slug}:authored-pose`).toBe(weapon.authoredPose);
        expect(capture.committedFacing, `${slug}:facing`).toBe(facing === "right" ? 1 : -1);
        expect(capture.freeHand.localFacingMarginPx, `${slug}:local`).toBeGreaterThanOrEqual(
          FACING_MARGIN_PX,
        );
        expect(capture.freeHand.worldFacingMarginPx, `${slug}:world`).toBeGreaterThanOrEqual(
          FACING_MARGIN_PX,
        );
        expect(
          capture.freeHand.visibleFacingEdgePx,
          `${slug}:visible-facing-alpha`,
        ).toBeGreaterThan(capture.freeHand.bodyFacingEdgePx);
        expect(capture.primaryGripOriginDeltaPx, `${slug}:primary-grip`).toBeLessThanOrEqual(0.01);
        captures.push(capture);
      }
    }

    const vitePort = Number(new URL(baseURL).port);
    const gamePort = Number(new URL(page.url()).searchParams.get("port") ?? 0);
    expect(vitePort).not.toBe(5180);
    expect(gamePort).not.toBe(0);
    expect(gamePort).not.toBe(2567);
    expect(captures).toHaveLength(WEAPONS.length * FACINGS.length);

    const summary = {
      capturedAt: new Date().toISOString(),
      vitePort,
      gamePort,
      protectedPorts: [5180, 2567],
      rows: captures.length,
      characterId: CHARACTER_ID,
      weapons: [...WEAPONS],
      facings: [...FACINGS],
      minWorldFacingMarginPx: Math.min(
        ...captures.map((capture) => capture.freeHand.worldFacingMarginPx),
      ),
      minVisibleEdgeClearancePx: Math.min(
        ...captures.map(
          (capture) => capture.freeHand.visibleFacingEdgePx - capture.freeHand.bodyFacingEdgePx,
        ),
      ),
      maxPrimaryGripOriginDeltaPx: Math.max(
        ...captures.map((capture) => capture.primaryGripOriginDeltaPx),
      ),
      captures,
    };
    await writeFile(
      path.join(EVIDENCE_DIR, "live-idle-parts.json"),
      `${JSON.stringify(summary, null, 2)}\n`,
      "utf8",
    );
  });
});
