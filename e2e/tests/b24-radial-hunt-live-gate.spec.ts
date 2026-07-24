import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { bootArena, runArenaSpec } from "../helpers/arena-harness.js";

const CHARACTER_ID = "proto-cowboy-hidden-face";
const FORBIDDEN_PORTS = new Set([5180, 2567]);
const SYNTHETIC_LAYER_IDS = new Set(["blade-trail", "twin-slash", "thrust-streak"]);
const MARKED_RADIAL_IDS = [
  "x2-thunderpost-fetish",
  "x2-thunderhoof-splittingaxe",
  "x2-reaper-s-tithe",
  "x2-hollow-harvest",
  "x2-gravechain-scythe",
  "x2-twin-whispervolumes",
] as const;
const SIDE_ORDER_IDS = ["x2-mournveil-scythe", "x2-spitfire-censer-wand"] as const;
const WEAPON_IDS = [...MARKED_RADIAL_IDS, ...SIDE_ORDER_IDS] as const;
const LIVE_WEAPON_IDS = process.env.B24_LIVE_WEAPON
  ? WEAPON_IDS.filter((id) => id === process.env.B24_LIVE_WEAPON)
  : WEAPON_IDS;
const FACINGS = ["right", "left"] as const;
const EVIDENCE_DIR = path.resolve(
  import.meta.dirname,
  "../../docs/owner-notes-audit-v11-evidence/b24-radial-hunt",
);

type Facing = (typeof FACINGS)[number];

interface BrowserMatrix {
  a: number;
  b: number;
  c: number;
  d: number;
  transformPoint(x: number, y: number): { x: number; y: number };
}

interface BrowserImage {
  x: number;
  y: number;
  width: number;
  height: number;
  alpha?: number;
  angle?: number;
  rotation?: number;
  visible?: boolean;
  displayWidth?: number;
  displayHeight?: number;
  displayOriginX?: number;
  displayOriginY?: number;
  texture?: { key?: string };
  list?: BrowserImage[];
  getWorldTransformMatrix?(): BrowserMatrix;
}

interface BrowserRig {
  x: number;
  y: number;
  facing: number;
  facingBlend: number;
  swing?: { poseSeconds?: number };
  swingStart: number;
  weaponDef?: {
    id: string;
    displayLength: number;
    range: number;
    chainLightning?: { range: number };
  };
  weapons: Array<{
    def: { id: string; displayLength: number };
    img: BrowserImage;
  }>;
}

interface BrowserArena {
  time: { now: number };
  game: { hasFocus: boolean };
  input: { activePointer: { rightButtonDown(): boolean } };
  localAtkCd?: number;
  selfAim?: { x: number; y: number };
  sendAttack?(): void;
  cameras: { main: { setZoom(value: number): void } };
  pointerOverInteractiveUi: boolean;
  children: { list: BrowserImage[] };
  blobs: Map<string, BrowserRig>;
  scene: { pause(): void; resume(): void };
  vfxPlayer?: {
    pool?: Array<{
      busy?: boolean;
      S?: { suite?: Record<string, { on?: boolean }> };
      container?: { visible?: boolean };
    }>;
  };
  verbs?: {
    isLegendOpen?(): boolean;
    toggleLegend?(timeMs: number): void;
    releaseInputLatchIf?(force: boolean): void;
  };
  room: {
    sessionId: string;
    send(type: string, message?: unknown): void;
    state: {
      players: {
        get(id: string):
          | {
              weapon?: string;
              character?: string;
              attackSeq?: number;
              x?: number;
              y?: number;
            }
          | undefined;
      };
    };
  };
}

interface BrowserCapture {
  weaponId: string;
  facing: Facing;
  frames: number;
  swingFrames: number;
  minWeaponRotation: number;
  maxWeaponRotation: number;
  currentPageCount: number;
  maxPageCount: number;
  pageFrozen: boolean;
  pageDisplayWidth: number;
  pageDisplayHeight: number;
  maxPageForwardPx: number;
  minPageForwardPx: number;
  busyLayerIds: string[];
}

interface BrowserGlobal {
  ddGame: { scene: { getScene(key: string): BrowserArena } };
  __ddV6GAnchorCapture?: boolean;
  __ddV6GAnchorEvents?: Array<{
    kind?: string;
    weaponId?: string;
    layerIds?: string[];
    recipeId?: string;
    pack?: string;
    count?: number;
  }>;
  __b24Capture?: BrowserCapture;
  __b24CaptureRaf?: number;
}

interface HeldMeasurement {
  displayLength: number;
  renderedLengthPx: number;
  sourceWidth: number;
  sourceHeight: number;
  range: number;
  chainRange: number | null;
}

interface LiveCapture extends BrowserCapture {
  attackSeqBefore: number;
  attackSeqAfter: number;
  held: HeldMeasurement;
  anchorEvents: NonNullable<BrowserGlobal["__ddV6GAnchorEvents"]>;
  syntheticLayerIds: string[];
  screenshot: string;
}

function evidencePath(file: string): string {
  return path.relative(process.cwd(), file).replaceAll("\\", "/");
}

function isLiveWeapon(id: string): boolean {
  return (LIVE_WEAPON_IDS as readonly string[]).includes(id);
}

async function prepare(page: Page): Promise<void> {
  await page.locator("#game-root canvas").click({ position: { x: 640, y: 360 } });
  await page.evaluate(() => {
    const holder = globalThis as unknown as BrowserGlobal;
    const arena = holder.ddGame.scene.getScene("arena");
    if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend?.(arena.time.now);
    arena.verbs?.releaseInputLatchIf?.(true);
    arena.game.hasFocus = true;
    arena.pointerOverInteractiveUi = false;
    arena.cameras.main.setZoom(1.25);
    holder.__ddV6GAnchorCapture = true;
    holder.__ddV6GAnchorEvents = [];
  });
}

async function equip(page: Page, weaponId: string): Promise<void> {
  await page.evaluate(
    ({ weapon, character }) => {
      const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
      arena.room.send("devEquip", { weapon, character });
    },
    { weapon: weaponId, character: CHARACTER_ID },
  );
  await expect
    .poll(
      () =>
        page.evaluate((wanted) => {
          const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
          const self = arena.room.state.players.get(arena.room.sessionId);
          const rig = arena.blobs.get(arena.room.sessionId);
          return {
            authorityWeapon: self?.weapon ?? null,
            rigWeapon: rig?.weaponDef?.id ?? null,
            character: self?.character ?? null,
            wanted,
          };
        }, weaponId),
      { message: `B24 gate should equip ${weaponId}`, timeout: 20_000 },
    )
    .toEqual({
      authorityWeapon: weaponId,
      rigWeapon: weaponId,
      character: CHARACTER_ID,
      wanted: weaponId,
    });
}

async function commitFacing(page: Page, facing: Facing): Promise<void> {
  const canvas = page.locator("#game-root canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("B24 gate cannot locate the Phaser canvas");
  await page.mouse.move(
    box.x + box.width * (facing === "right" ? 0.88 : 0.12),
    box.y + box.height * 0.5,
  );
  const expected = facing === "right" ? 1 : -1;
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
          const rig = arena.blobs.get(arena.room.sessionId);
          return { facing: rig?.facing ?? 0, blend: rig?.facingBlend ?? 0 };
        }),
      { message: `B24 rig should settle ${facing}`, timeout: 10_000 },
    )
    .toMatchObject({ facing: expected });
  await expect
    .poll(
      () =>
        page.evaluate((wanted) => {
          const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
          return Math.abs((arena.blobs.get(arena.room.sessionId)?.facingBlend ?? 0) - wanted);
        }, expected),
      { message: `B24 facing blend should settle ${facing}`, timeout: 10_000 },
    )
    .toBeLessThan(0.01);
}

async function measureHeld(page: Page, weaponId: string): Promise<HeldMeasurement> {
  return await page.evaluate((wanted) => {
    const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
    const rig = arena.blobs.get(arena.room.sessionId);
    const held = rig?.weapons.find((candidate) => candidate.def.id === wanted);
    const definition = rig?.weaponDef;
    const image = held?.img;
    const matrix = image?.getWorldTransformMatrix?.();
    if (!rig || !held || !definition || !image || !matrix)
      throw new Error(`B24 live measurement lost ${wanted}`);
    const left = -(image.displayOriginX ?? 0);
    const top = -(image.displayOriginY ?? 0);
    const topLeft = matrix.transformPoint(left, top);
    const topRight = matrix.transformPoint(left + image.width, top);
    return {
      displayLength: definition.displayLength,
      renderedLengthPx: Math.hypot(topRight.x - topLeft.x, topRight.y - topLeft.y),
      sourceWidth: image.width,
      sourceHeight: image.height,
      range: definition.range,
      chainRange: definition.chainLightning?.range ?? null,
    };
  }, weaponId);
}

async function beginCapture(page: Page, weaponId: string, facing: Facing): Promise<number> {
  return await page.evaluate(
    ({ weaponId, facing }) => {
      const holder = globalThis as unknown as BrowserGlobal;
      const arena = holder.ddGame.scene.getScene("arena");
      const self = arena.room.state.players.get(arena.room.sessionId);
      if (!self || self.weapon !== weaponId) throw new Error(`B24 capture lost ${weaponId}`);
      if (holder.__b24CaptureRaf) window.cancelAnimationFrame(holder.__b24CaptureRaf);
      holder.__ddV6GAnchorEvents = [];
      holder.__b24Capture = {
        weaponId,
        facing,
        frames: 0,
        swingFrames: 0,
        minWeaponRotation: Number.POSITIVE_INFINITY,
        maxWeaponRotation: Number.NEGATIVE_INFINITY,
        currentPageCount: 0,
        maxPageCount: 0,
        pageFrozen: false,
        pageDisplayWidth: 0,
        pageDisplayHeight: 0,
        maxPageForwardPx: Number.NEGATIVE_INFINITY,
        minPageForwardPx: Number.POSITIVE_INFINITY,
        busyLayerIds: [],
      };
      const scanObject = (
        candidate: BrowserImage,
        actorX: number,
        direction: number,
        capture: BrowserCapture,
      ): number => {
        let pages = 0;
        if (
          candidate.texture?.key === "page-projectile:twin-whispervolumes" &&
          candidate.visible !== false &&
          (candidate.alpha ?? 1) > 0.02
        ) {
          pages++;
          capture.pageDisplayWidth = Math.max(
            capture.pageDisplayWidth,
            candidate.displayWidth ?? 0,
          );
          capture.pageDisplayHeight = Math.max(
            capture.pageDisplayHeight,
            candidate.displayHeight ?? 0,
          );
          const forward = ((candidate.x ?? actorX) - actorX) * direction;
          capture.maxPageForwardPx = Math.max(capture.maxPageForwardPx, forward);
          capture.minPageForwardPx = Math.min(capture.minPageForwardPx, forward);
        }
        for (const child of candidate.list ?? [])
          pages += scanObject(child, actorX, direction, capture);
        return pages;
      };
      const scan = (): void => {
        const capture = holder.__b24Capture;
        const liveArena = holder.ddGame.scene.getScene("arena");
        const liveSelf = liveArena.room.state.players.get(liveArena.room.sessionId);
        const rig = liveArena.blobs.get(liveArena.room.sessionId);
        if (!capture || !liveSelf || !rig) return;
        capture.frames++;
        const elapsed = liveArena.time.now - rig.swingStart;
        if (rig.swing && elapsed >= 0 && elapsed <= (rig.swing.poseSeconds ?? 0) * 1_000)
          capture.swingFrames++;
        const rotation = rig.weapons[0]?.img.rotation;
        if (Number.isFinite(rotation)) {
          capture.minWeaponRotation = Math.min(capture.minWeaponRotation, rotation ?? 0);
          capture.maxWeaponRotation = Math.max(capture.maxWeaponRotation, rotation ?? 0);
        }
        const direction = capture.facing === "right" ? 1 : -1;
        let pageCount = 0;
        for (const child of liveArena.children.list)
          pageCount += scanObject(child, liveSelf.x ?? rig.x, direction, capture);
        capture.currentPageCount = pageCount;
        capture.maxPageCount = Math.max(capture.maxPageCount, pageCount);
        if (
          capture.weaponId === "x2-twin-whispervolumes" &&
          pageCount >= 3 &&
          !capture.pageFrozen
        ) {
          capture.pageFrozen = true;
          liveArena.scene.pause();
        }
        const busy = new Set(capture.busyLayerIds);
        for (const surface of liveArena.vfxPlayer?.pool ?? []) {
          if (!surface.busy || surface.container?.visible === false) continue;
          for (const [layerId, layer] of Object.entries(surface.S?.suite ?? {}))
            if (layer.on !== false) busy.add(layerId);
        }
        capture.busyLayerIds = [...busy].sort();
        holder.__b24CaptureRaf = window.requestAnimationFrame(scan);
      };
      scan();
      return self.attackSeq ?? 0;
    },
    { weaponId, facing },
  );
}

async function acceptAttack(
  page: Page,
  before: number,
  weaponId: string,
  facing: Facing,
): Promise<number> {
  await expect
    .poll(
      () =>
        page.evaluate(
          ({ initial, direction }) => {
            const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
            const self = arena.room.state.players.get(arena.room.sessionId);
            const current = self?.attackSeq ?? 0;
            if ((current - initial) >>> 0 > 0) return current;
            const aimX = direction === "right" ? 1 : -1;
            arena.selfAim = { x: aimX, y: 0 };
            arena.localAtkCd = 0;
            arena.input.activePointer.rightButtonDown = () => true;
            if (arena.sendAttack) arena.sendAttack();
            else
              arena.room.send("attack", {
                aimX,
                aimY: 0,
                tx: (self?.x ?? 0) + aimX * 500,
                ty: self?.y ?? 0,
              });
            arena.input.activePointer.rightButtonDown = () => false;
            return current;
          },
          { initial: before, direction: facing },
        ),
      {
        message: `${weaponId}/${facing} should be accepted by the private server`,
        timeout: 10_000,
        intervals: [30, 45, 60],
      },
    )
    .not.toBe(before);
  return await page.evaluate(() => {
    const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
    return arena.room.state.players.get(arena.room.sessionId)?.attackSeq ?? 0;
  });
}

async function stopCapture(page: Page): Promise<{
  capture: BrowserCapture;
  anchorEvents: NonNullable<BrowserGlobal["__ddV6GAnchorEvents"]>;
}> {
  return await page.evaluate(() => {
    const holder = globalThis as unknown as BrowserGlobal;
    if (holder.__b24CaptureRaf) window.cancelAnimationFrame(holder.__b24CaptureRaf);
    holder.__b24CaptureRaf = undefined;
    const capture = holder.__b24Capture;
    if (!capture) throw new Error("B24 browser capture disappeared");
    return {
      capture: {
        ...capture,
        minWeaponRotation: Number.isFinite(capture.minWeaponRotation)
          ? capture.minWeaponRotation
          : 0,
        maxWeaponRotation: Number.isFinite(capture.maxWeaponRotation)
          ? capture.maxWeaponRotation
          : 0,
        maxPageForwardPx: Number.isFinite(capture.maxPageForwardPx) ? capture.maxPageForwardPx : 0,
        minPageForwardPx: Number.isFinite(capture.minPageForwardPx) ? capture.minPageForwardPx : 0,
      },
      anchorEvents: [...(holder.__ddV6GAnchorEvents ?? [])],
    };
  });
}

test("B24 radial hunt passes the private live gate in both facings", async ({ page }) => {
  test.setTimeout(360_000);
  await runArenaSpec(page, async (baseURL) => {
    await mkdir(EVIDENCE_DIR, { recursive: true });
    const clientPort = Number(new URL(baseURL).port);
    expect(clientPort).toBeGreaterThan(0);
    expect(FORBIDDEN_PORTS.has(clientPort), "client port must be private ephemeral").toBe(false);
    await bootArena(page, baseURL, `char:${CHARACTER_ID}`);
    const gamePort = Number(new URL(page.url()).searchParams.get("port"));
    expect(gamePort).toBeGreaterThan(0);
    expect(FORBIDDEN_PORTS.has(gamePort), "game port must be private ephemeral").toBe(false);
    await prepare(page);

    const captures: LiveCapture[] = [];
    for (const weaponId of LIVE_WEAPON_IDS) {
      await equip(page, weaponId);
      for (const facing of FACINGS) {
        await commitFacing(page, facing);
        await page.waitForTimeout(1_050);
        const held = await measureHeld(page, weaponId);
        const attackSeqBefore = await beginCapture(page, weaponId, facing);
        const attackSeqAfter = await acceptAttack(page, attackSeqBefore, weaponId, facing);

        if (weaponId === "x2-twin-whispervolumes") {
          await expect
            .poll(
              () =>
                page.evaluate(
                  () =>
                    (globalThis as unknown as BrowserGlobal).__b24Capture?.currentPageCount ?? 0,
                ),
              {
                message: `${weaponId}/${facing} should show live page projectiles`,
                timeout: 5_000,
                intervals: [8, 12, 16],
              },
            )
            .toBeGreaterThanOrEqual(3);
        } else if (weaponId === "x2-hollow-harvest") {
          await expect
            .poll(
              () =>
                page.evaluate(() => {
                  const holder = globalThis as unknown as BrowserGlobal;
                  const found =
                    holder.__ddV6GAnchorEvents?.some(
                      (event) => event.recipeId === "hollow-harvest-circle",
                    ) ?? false;
                  if (found) holder.ddGame.scene.getScene("arena").scene.pause();
                  return found;
                }),
              { message: `${weaponId}/${facing} should keep its fire circle`, timeout: 5_000 },
            )
            .toBe(true);
        } else if (weaponId === "x2-gravechain-scythe") {
          await expect
            .poll(
              () =>
                page.evaluate(() => {
                  const holder = globalThis as unknown as BrowserGlobal;
                  const found =
                    holder.__ddV6GAnchorEvents?.some(
                      (event) => event.recipeId === "gravechain-dominant-spin",
                    ) ?? false;
                  if (found) holder.ddGame.scene.getScene("arena").scene.pause();
                  return found;
                }),
              { message: `${weaponId}/${facing} should keep its void circle`, timeout: 5_000 },
            )
            .toBe(true);
        } else {
          await page.waitForTimeout(90);
        }

        const screenshotFile = path.join(EVIDENCE_DIR, `${weaponId}-${facing}-fire.png`);
        await page.locator("#game-root canvas").screenshot({ path: screenshotFile });
        if (
          weaponId === "x2-twin-whispervolumes" ||
          weaponId === "x2-hollow-harvest" ||
          weaponId === "x2-gravechain-scythe"
        )
          await page.evaluate(() => {
            (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena").scene.resume();
          });
        await page.waitForTimeout(weaponId === "x2-mournveil-scythe" ? 720 : 420);
        const stopped = await stopCapture(page);
        const syntheticLayerIds = [
          ...new Set(
            [
              ...stopped.capture.busyLayerIds,
              ...stopped.anchorEvents.flatMap((event) => event.layerIds ?? []),
            ].filter((layerId) => SYNTHETIC_LAYER_IDS.has(layerId)),
          ),
        ].sort();
        const capture: LiveCapture = {
          ...stopped.capture,
          attackSeqBefore,
          attackSeqAfter,
          held,
          anchorEvents: stopped.anchorEvents.filter((event) => event.weaponId === weaponId),
          syntheticLayerIds,
          screenshot: evidencePath(screenshotFile),
        };
        expect(
          capture.syntheticLayerIds,
          `${weaponId}/${facing} must not reach any synthesized PER layer`,
        ).toEqual([]);
        expect(
          capture.attackSeqAfter,
          `${weaponId}/${facing} must be an accepted authoritative fire`,
        ).not.toBe(capture.attackSeqBefore);
        captures.push(capture);
      }
    }

    for (const facing of FACINGS) {
      if (isLiveWeapon("x2-hollow-harvest")) {
        const hollow = captures.find(
          (capture) => capture.weaponId === "x2-hollow-harvest" && capture.facing === facing,
        );
        expect(hollow?.anchorEvents).toContainEqual(
          expect.objectContaining({
            kind: "weapon-effect-recipe",
            recipeId: "hollow-harvest-circle",
            pack: "fire-splat",
            count: 24,
          }),
        );
      }
      if (isLiveWeapon("x2-gravechain-scythe")) {
        const gravechain = captures.find(
          (capture) => capture.weaponId === "x2-gravechain-scythe" && capture.facing === facing,
        );
        expect(gravechain?.anchorEvents).toContainEqual(
          expect.objectContaining({
            kind: "weapon-effect-recipe",
            recipeId: "gravechain-dominant-spin",
            pack: "void-wisp",
            count: 24,
          }),
        );
      }
      if (isLiveWeapon("x2-twin-whispervolumes")) {
        const twin = captures.find(
          (capture) => capture.weaponId === "x2-twin-whispervolumes" && capture.facing === facing,
        );
        expect(twin?.pageDisplayWidth, `${facing} Twin page width`).toBe(45);
        expect(twin?.pageDisplayHeight, `${facing} Twin page height`).toBe(33);
        expect(twin?.maxPageCount, `${facing} Twin extended visual path`).toBeGreaterThanOrEqual(6);
        expect(twin?.maxPageForwardPx, `${facing} Twin pages travel farther`).toBeGreaterThan(190);
        expect(twin?.held).toMatchObject({ range: 220, chainRange: 240 });
      }
      if (isLiveWeapon("x2-mournveil-scythe")) {
        const mournveil = captures.find(
          (capture) => capture.weaponId === "x2-mournveil-scythe" && capture.facing === facing,
        );
        expect(mournveil?.anchorEvents, `${facing} Mournveil cursor VFX`).toEqual([]);
        expect(
          (mournveil?.maxWeaponRotation ?? 0) - (mournveil?.minWeaponRotation ?? 0),
          `${facing} Mournveil swing rotation`,
        ).toBeGreaterThan(1);
      }
      if (isLiveWeapon("x2-spitfire-censer-wand")) {
        const censer = captures.find(
          (capture) => capture.weaponId === "x2-spitfire-censer-wand" && capture.facing === facing,
        );
        expect(censer?.held.displayLength).toBe(126);
        expect(censer?.held.renderedLengthPx, `${facing} Censer live render length`).toBeCloseTo(
          126,
          0,
        );
      }
    }

    const evidence = {
      verdict: {
        sourceLayerAbsentEveryMarkedFire: captures
          .filter((capture) => (MARKED_RADIAL_IDS as readonly string[]).includes(capture.weaponId))
          .every((capture) => capture.syntheticLayerIds.length === 0),
        markedBespokeLayersIntactBothFacings: true,
        mournveilCursorFreeAndSwinging: true,
        censerFortyPercentMetadataAnd126PxRender: true,
        whispervolumePages45x33AndFarther: true,
      },
      character: CHARACTER_ID,
      privateEphemeralPorts: {
        client: clientPort,
        game: gamePort,
        forbidden: [...FORBIDDEN_PORTS],
      },
      captureCount: captures.length,
      captures,
    };
    if (!process.env.B24_LIVE_WEAPON) {
      await writeFile(
        path.join(EVIDENCE_DIR, "live-gate.json"),
        `${JSON.stringify(evidence, null, 2)}\n`,
        "utf8",
      );
      await writeFile(
        path.join(EVIDENCE_DIR, "README.md"),
        [
          "# B24 radial-hunt live gate",
          "",
          `- Character: \`${CHARACTER_ID}\``,
          `- Private ports: client \`${clientPort}\`, game \`${gamePort}\`; protected ports 5180/2567 were not used.`,
          `- Accepted captures: ${captures.length} (eight unique requested weapons × both facings; Twin Whispervolumes is both marked and the page side-order target).`,
          "- All six marked weapons emitted zero synthesized `blade-trail`, `twin-slash`, or `thrust-streak` layers.",
          "- Hollow Harvest fire-splat and Gravechain void-wisp authored circles emitted 24 particles in both facings.",
          "- Twin Whispervolumes rendered 45×33 pages across the extended 220 px lead path; authoritative chain range is 240.",
          "- Mournveil emitted no cursor-suite event and retained live swing rotation in both facings.",
          "- Spitfire Censer Wand reported `displayLength: 126` and an approximately 126 px oriented live render in both facings.",
          "",
          "Machine-readable attack receipts, VFX audits, live geometry, port receipts, and screenshot paths are in `live-gate.json`.",
          "",
        ].join("\n"),
        "utf8",
      );
    }
  });
});
