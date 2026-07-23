import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { bootArena, runArenaSpec } from "../helpers/arena-harness.js";

const EVIDENCE_DIR = path.resolve(
  import.meta.dirname,
  "../../docs/owner-notes-audit-v10-evidence/b17-idle-hand",
);
const PROTOTYPES = ["proto-sheriff", "proto-samurai", "proto-witch"] as const;
const WEAPONS = [
  { id: "rattler-sabre", pose: "mirror-guard", feet: "combat-plant" },
  { id: "x2-tumbleweed-flail", pose: "low-guard", feet: "combat-plant" },
  { id: "x-gun-ricochet-pistol", pose: "low-guard", feet: "loose-plant" },
  {
    id: "x2-saint-s-knucklebone-censer-orb",
    pose: "casting-gesture",
    feet: "loose-plant",
  },
  { id: "x2-saint-bough-frost-crozier", pose: "hip-rest", feet: "combat-plant" },
  { id: "x2-hellmouth-palmcaster", pose: "casting-gesture", feet: "loose-plant" },
  { id: "x-sword-neon-katana", pose: "mirror-guard", feet: "wide-plant" },
] as const;
const FACINGS = ["right", "left"] as const;
const FACING_MARGIN_PX = 76 * 0.03;

type Facing = (typeof FACINGS)[number];

interface BrowserMatrix {
  a: number;
  b: number;
  c: number;
  d: number;
  tx: number;
  ty: number;
}

interface BrowserDisplay {
  x: number;
  y: number;
  displayWidth: number;
  displayHeight: number;
  visible: boolean;
  getWorldTransformMatrix(): BrowserMatrix;
  setVisible(value: boolean): BrowserDisplay;
}

interface BrowserPart {
  img: BrowserDisplay;
  front: boolean;
  ox: number;
  oy: number;
}

interface BrowserRig {
  facing: number;
  body: BrowserDisplay;
  hands: BrowserPart[];
  feet: BrowserPart[];
  root: {
    getWorldTransformMatrix(): BrowserMatrix;
  };
  weaponDef?: {
    id: string;
    poseLanguage?: { idle?: string; feet?: string };
  };
  weapons: Array<{ img: BrowserDisplay; def: { id: string } }>;
  label?: BrowserDisplay;
}

interface BrowserSelf {
  weapon?: string;
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
    state: { players: { get(id: string): BrowserSelf | undefined } };
  };
  scene: {
    pause(): void;
    resume(): void;
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
  __b17PostHand?: { x: number; y: number };
}

interface LiveCapture {
  characterId: string;
  weaponId: string;
  expectedPose: string;
  expectedFeet: string;
  authoredPose: string | null;
  authoredFeet: string | null;
  facing: Facing;
  committedFacing: number;
  body: { x: number; y: number; width: number; height: number; worldX: number; worldY: number };
  freeHand: {
    x: number;
    y: number;
    authoredX: number;
    authoredY: number;
    width: number;
    height: number;
    worldX: number;
    worldY: number;
    localFacingDeltaPx: number;
    worldFacingMarginPx: number;
    visibleFacingEdgePx: number;
    bodyFacingEdgePx: number;
  };
  legacyProjection: {
    localX: number;
    worldX: number;
    worldFacingMarginPx: number;
  };
  feet: Array<{ front: boolean; x: number; y: number; worldX: number; worldY: number }>;
  footSeparationPx: number;
  footGroundMinPx: number;
  footGroundMaxPx: number;
  primaryGripOriginDeltaPx: number;
  screenshots: { pre: string; post: string };
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
          return {
            authority: self?.weapon ?? null,
            rig: rig?.weaponDef?.id ?? null,
            wanted: id,
          };
        }, weaponId),
      { message: `B17 gate should equip ${weaponId}`, timeout: 20_000 },
    )
    .toEqual({ authority: weaponId, rig: weaponId, wanted: weaponId });
}

async function aim(page: Page, facing: Facing): Promise<void> {
  const canvas = page.locator("#game-root canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("B17 gate cannot find the Phaser canvas bounds");
  await page.mouse.move(
    box.x + box.width * (facing === "right" ? 0.9 : 0.1),
    box.y + box.height * 0.5,
  );
  const expectedFacing = facing === "right" ? 1 : -1;
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
          return arena.blobs.get(arena.room.sessionId)?.facing ?? 0;
        }),
      { message: `B17 rig should commit facing ${facing}`, timeout: 10_000 },
    )
    .toBe(expectedFacing);
  await page.waitForTimeout(240);
}

async function measureAndProjectLegacy(
  page: Page,
  capture: Pick<
    LiveCapture,
    "characterId" | "weaponId" | "expectedPose" | "expectedFeet" | "facing"
  >,
): Promise<Omit<LiveCapture, "screenshots">> {
  return await page.evaluate(
    ({ characterId, weaponId, expectedPose, expectedFeet, facing }) => {
      const holder = globalThis as unknown as BrowserGlobal;
      const arena = holder.ddGame.scene.getScene("arena");
      const rig = arena.blobs.get(arena.room.sessionId);
      if (!rig?.weaponDef || rig.weaponDef.id !== weaponId) {
        throw new Error(`B17 live rig missing ${weaponId}`);
      }
      const freeHand = rig.hands.find((hand) => !hand.front);
      const weaponHand = rig.hands.find((hand) => hand.front);
      const weapon = rig.weapons[0]?.img;
      if (!freeHand || !weaponHand || !weapon) throw new Error("B17 live rig is incomplete");
      const world = (display: BrowserDisplay) => {
        const matrix = display.getWorldTransformMatrix();
        return { x: matrix.tx, y: matrix.ty };
      };
      const bodyWorld = world(rig.body);
      const handWorld = world(freeHand.img);
      const weaponWorld = world(weapon);
      const weaponHandWorld = world(weaponHand.img);
      const root = rig.root.getWorldTransformMatrix();
      const legacyWorldX = root.tx + root.a * freeHand.ox + root.c * freeHand.oy;
      const feet = rig.feet.map((foot) => {
        const point = world(foot.img);
        return {
          front: foot.front,
          x: foot.img.x,
          y: foot.img.y,
          worldX: point.x,
          worldY: point.y,
        };
      });
      const footXs = feet.map((foot) => foot.x);
      const footGround = feet.map((foot) => foot.y - rig.body.y);
      const localFacingDeltaPx = freeHand.img.x - rig.body.x;

      rig.label?.setVisible(false);
      arena.objectiveHudGfx?.setVisible(false);
      arena.objectiveText?.setVisible(false);
      arena.objectiveLocationText?.setVisible(false);
      arena.objectiveEconomyText?.setVisible(false);
      arena.objectiveNoticeText?.setVisible(false);
      arena.parryGfx?.setVisible(false);
      holder.__b17PostHand = { x: freeHand.img.x, y: freeHand.img.y };
      arena.scene.pause();
      freeHand.img.x = freeHand.ox;
      freeHand.img.y = freeHand.oy;

      return {
        characterId,
        weaponId,
        expectedPose,
        expectedFeet,
        authoredPose: rig.weaponDef.poseLanguage?.idle ?? null,
        authoredFeet: rig.weaponDef.poseLanguage?.feet ?? null,
        facing,
        committedFacing: rig.facing,
        body: {
          x: rig.body.x,
          y: rig.body.y,
          width: rig.body.displayWidth,
          height: rig.body.displayHeight,
          worldX: bodyWorld.x,
          worldY: bodyWorld.y,
        },
        freeHand: {
          x: holder.__b17PostHand.x,
          y: holder.__b17PostHand.y,
          authoredX: freeHand.ox,
          authoredY: freeHand.oy,
          width: freeHand.img.displayWidth,
          height: freeHand.img.displayHeight,
          worldX: handWorld.x,
          worldY: handWorld.y,
          localFacingDeltaPx,
          worldFacingMarginPx: (handWorld.x - bodyWorld.x) * rig.facing,
          visibleFacingEdgePx: holder.__b17PostHand.x + freeHand.img.displayWidth / 2,
          bodyFacingEdgePx: rig.body.x + rig.body.displayWidth / 2,
        },
        legacyProjection: {
          localX: freeHand.ox,
          worldX: legacyWorldX,
          worldFacingMarginPx: (legacyWorldX - bodyWorld.x) * rig.facing,
        },
        feet,
        footSeparationPx: Math.max(...footXs) - Math.min(...footXs),
        footGroundMinPx: Math.min(...footGround),
        footGroundMaxPx: Math.max(...footGround),
        primaryGripOriginDeltaPx: Math.hypot(
          weaponWorld.x - weaponHandWorld.x,
          weaponWorld.y - weaponHandWorld.y,
        ),
      };
    },
    { ...capture },
  );
}

async function restorePostHand(page: Page): Promise<void> {
  await page.evaluate(() => {
    const holder = globalThis as unknown as BrowserGlobal;
    const arena = holder.ddGame.scene.getScene("arena");
    const rig = arena.blobs.get(arena.room.sessionId);
    const freeHand = rig?.hands.find((hand) => !hand.front);
    if (!freeHand || !holder.__b17PostHand) throw new Error("B17 post-hand restore is unavailable");
    freeHand.img.x = holder.__b17PostHand.x;
    freeHand.img.y = holder.__b17PostHand.y;
  });
}

async function resumeArena(page: Page): Promise<void> {
  await page.evaluate(() => {
    const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
    arena.scene.resume();
  });
}

test("B17 idle parts stay facing-side and visible on every shipped whole-art prototype", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await runArenaSpec(page, async (baseURL) => {
    await mkdir(path.join(EVIDENCE_DIR, "pre"), { recursive: true });
    await mkdir(path.join(EVIDENCE_DIR, "post"), { recursive: true });
    await page.setViewportSize({ width: 640, height: 360 });
    const captures: LiveCapture[] = [];
    let gamePort = 0;

    for (const characterId of PROTOTYPES) {
      await bootArena(page, baseURL, `char:${characterId}`);
      await expect
        .poll(
          () =>
            page.evaluate((wanted) => {
              const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
              const rig = arena.blobs.get(arena.room.sessionId);
              return rig?.body ? wanted : null;
            }, characterId),
          { timeout: 30_000 },
        )
        .toBe(characterId);
      gamePort = Number(new URL(page.url()).searchParams.get("port") ?? 0);
      await page.locator("#game-root canvas").click({ position: { x: 320, y: 180 } });
      await page.evaluate(() => {
        const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
        if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend?.(arena.time.now);
        arena.verbs?.releaseInputLatchIf?.(true);
        arena.game.hasFocus = true;
        arena.pointerOverInteractiveUi = false;
        arena.cameras.main.setZoom(2.05);
      });

      for (const weapon of WEAPONS) {
        await equip(page, weapon.id);
        await page.waitForTimeout(320);
        for (const facing of FACINGS) {
          await aim(page, facing);
          const slug = `${characterId}-${weapon.id}-${facing}`;
          const preFile = path.join(EVIDENCE_DIR, "pre", `${slug}.png`);
          const postFile = path.join(EVIDENCE_DIR, "post", `${slug}.png`);
          const measured = await measureAndProjectLegacy(page, {
            characterId,
            weaponId: weapon.id,
            expectedPose: weapon.pose,
            expectedFeet: weapon.feet,
            facing,
          });
          await page.waitForTimeout(50);
          await page.locator("#game-root canvas").screenshot({ path: preFile });
          await restorePostHand(page);
          await page.waitForTimeout(50);
          await page.locator("#game-root canvas").screenshot({ path: postFile });
          await resumeArena(page);

          const capture: LiveCapture = {
            ...measured,
            screenshots: {
              pre: relativeEvidencePath(preFile),
              post: relativeEvidencePath(postFile),
            },
          };
          expect(capture.committedFacing, slug).toBe(facing === "right" ? 1 : -1);
          expect(capture.legacyProjection.worldFacingMarginPx, `${slug}:pre`).toBeLessThan(0);
          expect(capture.freeHand.localFacingDeltaPx, `${slug}:local`).toBeGreaterThanOrEqual(
            FACING_MARGIN_PX,
          );
          expect(capture.freeHand.worldFacingMarginPx, `${slug}:world`).toBeGreaterThanOrEqual(
            FACING_MARGIN_PX,
          );
          expect(
            capture.freeHand.visibleFacingEdgePx,
            `${slug}:visible-alpha-bounds`,
          ).toBeGreaterThan(capture.freeHand.bodyFacingEdgePx);
          expect(capture.footSeparationPx, `${slug}:feet-separated`).toBeGreaterThan(28);
          expect(capture.footGroundMinPx, `${slug}:foot-ground-min`).toBeGreaterThan(34);
          expect(capture.footGroundMaxPx, `${slug}:foot-ground-max`).toBeLessThan(70);
          expect(capture.primaryGripOriginDeltaPx, `${slug}:primary-grip`).toBeLessThanOrEqual(
            0.01,
          );
          captures.push(capture);
          await page.waitForTimeout(80);
        }
      }
    }

    expect(new URL(baseURL).port).not.toBe("5180");
    expect(gamePort).not.toBe(0);
    expect(gamePort).not.toBe(2567);
    expect(captures).toHaveLength(PROTOTYPES.length * WEAPONS.length * FACINGS.length);
    const summary = {
      capturedAt: new Date().toISOString(),
      baseURL,
      vitePort: Number(new URL(baseURL).port),
      gamePort,
      protectedPorts: [5180, 2567],
      rows: captures.length,
      prototypes: [...PROTOTYPES],
      weapons: [...WEAPONS],
      facings: [...FACINGS],
      minPostWorldFacingMarginPx: Math.min(
        ...captures.map((capture) => capture.freeHand.worldFacingMarginPx),
      ),
      maxLegacyWorldFacingMarginPx: Math.max(
        ...captures.map((capture) => capture.legacyProjection.worldFacingMarginPx),
      ),
      minVisibleEdgeClearancePx: Math.min(
        ...captures.map(
          (capture) => capture.freeHand.visibleFacingEdgePx - capture.freeHand.bodyFacingEdgePx,
        ),
      ),
      minFootSeparationPx: Math.min(...captures.map((capture) => capture.footSeparationPx)),
      maxPrimaryGripOriginDeltaPx: Math.max(
        ...captures.map((capture) => capture.primaryGripOriginDeltaPx),
      ),
      captures,
    };
    await writeFile(
      path.join(EVIDENCE_DIR, "live-capture.json"),
      `${JSON.stringify(summary, null, 2)}\n`,
      "utf8",
    );
  });
});
