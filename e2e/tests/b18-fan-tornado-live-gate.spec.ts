import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { bootArena, runArenaSpec } from "../helpers/arena-harness.js";

const EVIDENCE_DIR = path.resolve(
  import.meta.dirname,
  "../../docs/owner-notes-audit-v10-evidence/b18-fan-tornado",
);
const CHARACTER_ID = "proto-cowboy-hidden-face";
const FORBIDDEN_PORTS = new Set([5180, 2567]);
const FACINGS = ["right", "left"] as const;
const FIXTURES = [
  {
    id: "x2-iron-war-fan",
    subject: "vfx-tornado-iron-gale",
    audioCue: "b18:iron-gale-whoosh",
  },
  {
    id: "x2-ember-fan",
    subject: "vfx-tornado-ember-fire",
    audioCue: "b18:ember-fire-roar",
  },
  {
    id: "x2-storm-fan",
    subject: "vfx-tornado-storm-shock",
    audioCue: "b18:storm-thunder-crack",
  },
] as const;

type Facing = (typeof FACINGS)[number];

interface FanTornadoEvent {
  kind: "fan-tornado";
  weaponId: string;
  recipeKind: "fan-tornado";
  subject: string;
  textureKey: string;
  proceduralLayers: string[];
  damageMode: "presentation-only";
  releaseLane: "center" | "lead" | "off";
  releaseProgress: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  travelPx: number;
  meleeEnvelopeReach: number;
  maxVisualRadius: number;
  overlapsMeleeAtSpawn: boolean;
  fanOutStartScale: number;
  fanOutEndScale: number;
}

interface FanMotionFrame {
  weaponId: string;
  comboStep: number;
  poseProgress: number;
  fanOutProgress: number;
  fanOutScale: number;
  weaponLengthScale: number;
}

interface FanOutFrame {
  weaponId: string;
  progress: number;
  widthMultiplier: number;
  bodyWidth: number;
  fanOutStartScale: number;
  fanOutEndScale: number;
}

interface BrowserObject {
  alpha?: number;
  displayHeight?: number;
  displayWidth?: number;
  name?: string;
  visible?: boolean;
  x?: number;
  y?: number;
}

interface BrowserArena {
  blobs: Map<
    string,
    {
      facing: number;
      weaponDef?: { id: string };
    }
  >;
  cameras: { main: { setZoom(value: number): void } };
  children: { list: BrowserObject[] };
  game: { hasFocus: boolean };
  input: { activePointer: { rightButtonDown(): boolean } };
  localAtkCd: number;
  localPredictedAttackAtMs: number;
  localPredictedAttackSeq: number;
  pointerOverInteractiveUi: boolean;
  room: {
    sessionId: string;
    send(type: string, message?: unknown): void;
    state: {
      players: {
        get(
          id: string,
        ):
          | {
              attackSeq: number;
              character?: string;
              weapon?: string;
              x: number;
              y: number;
            }
          | undefined;
      };
    };
  };
  scene: { pause(): void; resume(): void };
  sendAttack(): void;
  time: { now: number };
  verbs?: {
    isLegendOpen?(): boolean;
    releaseInputLatchIf?(force: boolean): void;
    toggleLegend?(timeMs: number): void;
  };
}

interface BrowserGlobal {
  ddGame: { scene: { getScene(key: string): BrowserArena } };
  __ddB18FanMotionAudit?: FanMotionFrame[];
  __ddB18FanOutAudit?: FanOutFrame[];
  __ddB18FanTornadoAudit?: FanTornadoEvent[];
}

interface LiveCapture {
  weaponId: string;
  facing: Facing;
  attackSeqBefore: number;
  attackSeqAfter: number;
  event: FanTornadoEvent;
  motion: {
    minScale: number;
    maxScale: number;
    spreadRatio: number;
    frames: number;
  };
  ribbon: {
    minWidth: number;
    maxWidth: number;
    spreadRatio: number;
    frames: number;
  };
  visibleTornado: {
    x: number;
    y: number;
    alpha: number;
    displayWidth: number;
    displayHeight: number;
  };
  screenshot: string;
}

function relativeEvidencePath(file: string): string {
  return path.relative(process.cwd(), file).replaceAll("\\", "/");
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
    arena.cameras.main.setZoom(1.55);
    arena.input.activePointer.rightButtonDown = () => false;
    holder.__ddB18FanMotionAudit = [];
    holder.__ddB18FanOutAudit = [];
    holder.__ddB18FanTornadoAudit = [];
  });
}

async function equip(page: Page, weaponId: string): Promise<void> {
  await page.evaluate(
    ({ weaponId, characterId }) => {
      const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
      arena.room.send("devEquip", { weapon: weaponId, character: characterId });
    },
    { weaponId, characterId: CHARACTER_ID },
  );
  await expect
    .poll(
      () =>
        page.evaluate((wanted) => {
          const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
          const self = arena.room.state.players.get(arena.room.sessionId);
          return {
            authority: self?.weapon ?? null,
            rig: arena.blobs.get(arena.room.sessionId)?.weaponDef?.id ?? null,
            character: self?.character ?? null,
            wanted,
          };
        }, weaponId),
      { message: `B18 should equip ${weaponId} on ${CHARACTER_ID}`, timeout: 20_000 },
    )
    .toEqual({
      authority: weaponId,
      rig: weaponId,
      character: CHARACTER_ID,
      wanted: weaponId,
    });
}

async function commitFacing(page: Page, facing: Facing): Promise<void> {
  const canvas = page.locator("#game-root canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("B18 gate cannot locate the Phaser canvas");
  await page.mouse.move(
    box.x + box.width * (facing === "right" ? 0.86 : 0.14),
    box.y + box.height * 0.5,
  );
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
          return arena.blobs.get(arena.room.sessionId)?.facing ?? 0;
        }),
      { message: `B18 rig should commit ${facing} facing`, timeout: 10_000 },
    )
    .toBe(facing === "right" ? 1 : -1);
}

async function firePredicted(page: Page, weaponId: string): Promise<number> {
  return await page.evaluate((wanted) => {
    const holder = globalThis as unknown as BrowserGlobal;
    const arena = holder.ddGame.scene.getScene("arena");
    const self = arena.room.state.players.get(arena.room.sessionId);
    if (!self || self.weapon !== wanted) throw new Error(`B18 gate lost ${wanted}`);
    holder.__ddB18FanMotionAudit = [];
    holder.__ddB18FanOutAudit = [];
    holder.__ddB18FanTornadoAudit = [];
    arena.pointerOverInteractiveUi = false;
    arena.localAtkCd = 0;
    arena.localPredictedAttackSeq = self.attackSeq;
    arena.localPredictedAttackAtMs = -1e9;
    arena.input.activePointer.rightButtonDown = () => true;
    const before = self.attackSeq;
    arena.sendAttack();
    return before;
  }, weaponId);
}

async function stopAttack(page: Page): Promise<void> {
  await page.evaluate(() => {
    const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
    arena.input.activePointer.rightButtonDown = () => false;
  });
}

async function waitForCaptureFrame(page: Page, weaponId: string): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate((wanted) => {
          const holder = globalThis as unknown as BrowserGlobal;
          const arena = holder.ddGame.scene.getScene("arena");
          const motion = (holder.__ddB18FanMotionAudit ?? []).filter(
            (frame) => frame.weaponId === wanted,
          );
          const ribbon = (holder.__ddB18FanOutAudit ?? []).filter(
            (frame) => frame.weaponId === wanted,
          );
          const minMotion = Math.min(...motion.map((frame) => frame.fanOutScale));
          const maxMotion = Math.max(...motion.map((frame) => frame.fanOutScale));
          const minRibbon = Math.min(...ribbon.map((frame) => frame.widthMultiplier));
          const maxRibbon = Math.max(...ribbon.map((frame) => frame.widthMultiplier));
          const eventCount = (holder.__ddB18FanTornadoAudit ?? []).filter(
            (event) => event.weaponId === wanted,
          ).length;
          const visible = arena.children.list.some(
            (child) =>
              child.name === `generated-image-vfx:${wanted}:fan-tornado` &&
              child.visible !== false &&
              (child.alpha ?? 0) > 0.58,
          );
          const ready =
            visible &&
            eventCount > 0 &&
            motion.length > 1 &&
            ribbon.length > 1;
          if (ready) arena.scene.pause();
          return {
            ready,
            eventCount,
            visible,
            motionFrames: motion.length,
            minMotion,
            maxMotion,
            ribbonFrames: ribbon.length,
            minRibbon,
            maxRibbon,
          };
        }, weaponId),
      {
        message: `${weaponId} should show its fan-out layers with a live tornado`,
        timeout: 12_000,
        intervals: [5, 10, 16],
      },
    )
    .toMatchObject({
      ready: true,
      visible: true,
    });
}

async function waitForAccepted(page: Page, before: number, weaponId: string): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
          return arena.room.state.players.get(arena.room.sessionId)?.attackSeq ?? 0;
        }),
      { message: `${weaponId} should be accepted on the private server`, timeout: 10_000 },
    )
    .toBeGreaterThan(before);
}

test("B18 fans open outward and release elemental tornadoes on both facings", async ({ page }) => {
  test.setTimeout(180_000);
  await runArenaSpec(page, async (baseURL) => {
    await mkdir(EVIDENCE_DIR, { recursive: true });
    const clientPort = Number(new URL(baseURL).port);
    expect(FORBIDDEN_PORTS.has(clientPort), "client port must be private ephemeral").toBe(false);
    await bootArena(page, baseURL, `char:${CHARACTER_ID}`);
    const gamePort = Number(new URL(page.url()).searchParams.get("port"));
    expect(Number.isInteger(gamePort) && gamePort > 0).toBe(true);
    expect(FORBIDDEN_PORTS.has(gamePort), "game port must be private ephemeral").toBe(false);
    await prepare(page);

    const captures: LiveCapture[] = [];
    for (const fixture of FIXTURES) {
      await equip(page, fixture.id);
      for (const facing of FACINGS) {
        await commitFacing(page, facing);
        const attackSeqBefore = await firePredicted(page, fixture.id);
        await waitForAccepted(page, attackSeqBefore, fixture.id);
        await waitForCaptureFrame(page, fixture.id);
        await stopAttack(page);
        const screenshotFile = path.join(EVIDENCE_DIR, `${fixture.id}-${facing}.png`);
        await page.locator("#game-root canvas").screenshot({ path: screenshotFile });
        const measured = await page.evaluate((weaponId) => {
          const holder = globalThis as unknown as BrowserGlobal;
          const arena = holder.ddGame.scene.getScene("arena");
          const self = arena.room.state.players.get(arena.room.sessionId);
          if (!self) throw new Error(`B18 capture lost ${weaponId}`);
          const event = (holder.__ddB18FanTornadoAudit ?? []).find(
            (candidate) => candidate.weaponId === weaponId,
          );
          const motionFrames = (holder.__ddB18FanMotionAudit ?? []).filter(
            (frame) => frame.weaponId === weaponId,
          );
          const ribbonFrames = (holder.__ddB18FanOutAudit ?? []).filter(
            (frame) => frame.weaponId === weaponId,
          );
          const tornado = arena.children.list.find(
            (child) =>
              child.name === `generated-image-vfx:${weaponId}:fan-tornado` &&
              child.visible !== false &&
              (child.alpha ?? 0) > 0.05,
          );
          if (!event || !tornado) throw new Error(`B18 capture missed ${weaponId} tornado`);
          const motionScales = motionFrames.map((frame) => frame.fanOutScale);
          const ribbonWidths = ribbonFrames.map((frame) => frame.widthMultiplier);
          const minMotion = Math.min(...motionScales);
          const maxMotion = Math.max(...motionScales);
          const minRibbon = Math.min(...ribbonWidths);
          const maxRibbon = Math.max(...ribbonWidths);
          return {
            attackSeqAfter: self.attackSeq,
            event,
            motion: {
              minScale: minMotion,
              maxScale: maxMotion,
              spreadRatio: maxMotion / minMotion,
              frames: motionFrames.length,
            },
            ribbon: {
              minWidth: minRibbon,
              maxWidth: maxRibbon,
              spreadRatio: maxRibbon / minRibbon,
              frames: ribbonFrames.length,
            },
            visibleTornado: {
              x: tornado.x ?? 0,
              y: tornado.y ?? 0,
              alpha: tornado.alpha ?? 0,
              displayWidth: tornado.displayWidth ?? 0,
              displayHeight: tornado.displayHeight ?? 0,
            },
          };
        }, fixture.id);
        const capture: LiveCapture = {
          weaponId: fixture.id,
          facing,
          attackSeqBefore,
          ...measured,
          screenshot: relativeEvidencePath(screenshotFile),
        };
        expect(capture.event).toMatchObject({
          kind: "fan-tornado",
          weaponId: fixture.id,
          recipeKind: "fan-tornado",
          subject: fixture.subject,
          damageMode: "presentation-only",
          overlapsMeleeAtSpawn: true,
          proceduralLayers: ["fan-out-ribbon", "hybrid-projectile"],
        });
        expect(capture.motion.minScale).toBeLessThan(0.3);
        expect(capture.motion.maxScale).toBeGreaterThan(0.82);
        expect(capture.motion.spreadRatio).toBeGreaterThan(3);
        expect(capture.ribbon.spreadRatio).toBeGreaterThan(1.05);
        expect(capture.event.travelPx).toBeGreaterThanOrEqual(40);
        expect(capture.event.travelPx).toBeLessThanOrEqual(50);
        expect(
          Math.sign(capture.event.endX - capture.event.startX),
          `${fixture.id}/${facing}/outward travel`,
        ).toBe(facing === "right" ? 1 : -1);
        expect(capture.visibleTornado.alpha).toBeGreaterThan(0.58);
        expect(capture.visibleTornado.displayWidth).toBeGreaterThan(35);
        expect(capture.visibleTornado.displayHeight).toBeGreaterThan(60);
        captures.push(capture);
        await page.evaluate(() => {
          const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
          arena.scene.resume();
        });
        await page.waitForTimeout(520);
      }
    }

    const stormLanes = captures
      .filter((capture) => capture.weaponId === "x2-storm-fan")
      .map((capture) => capture.event.releaseLane);
    const assertions = {
      sixFacingCaptures: captures.length === FIXTURES.length * FACINGS.length,
      privatePorts: !FORBIDDEN_PORTS.has(clientPort) && !FORBIDDEN_PORTS.has(gamePort),
      wholeArtCharacter: CHARACTER_ID,
      allFanOutward: captures.every(
        (capture) =>
          capture.motion.spreadRatio > 3 && capture.ribbon.spreadRatio > 1.05,
      ),
      threeElementalSubjects:
        new Set(captures.map((capture) => capture.event.subject)).size === 3,
      presentationOnly: captures.every(
        (capture) =>
          capture.event.damageMode === "presentation-only" &&
          capture.event.overlapsMeleeAtSpawn,
      ),
      bothFacingsTravelOutward: captures.every(
        (capture) =>
          Math.sign(capture.event.endX - capture.event.startX) ===
          (capture.facing === "right" ? 1 : -1),
      ),
      stormPairedReleaseLanes:
        stormLanes.length === 2 &&
        stormLanes.every((lane) => lane === "lead" || lane === "off"),
    };
    expect(assertions).toEqual({
      sixFacingCaptures: true,
      privatePorts: true,
      wholeArtCharacter: CHARACTER_ID,
      allFanOutward: true,
      threeElementalSubjects: true,
      presentationOnly: true,
      bothFacingsTravelOutward: true,
      stormPairedReleaseLanes: true,
    });
    await writeFile(
      path.join(EVIDENCE_DIR, "live-gate.json"),
      `${JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          baseURL,
          clientPort,
          gamePort,
          protectedPorts: [...FORBIDDEN_PORTS],
          characterId: CHARACTER_ID,
          audioCues: Object.fromEntries(
            FIXTURES.map((fixture) => [fixture.id, fixture.audioCue]),
          ),
          assertions,
          captures,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  });
});
