import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { bootArena, runArenaSpec } from "../helpers/arena-harness.js";

const EVIDENCE_DIR = path.resolve("docs/owner-notes-audit-v8-evidence/head-split");

interface BrowserImage {
  x: number;
  y: number;
  visible: boolean;
  displayWidth: number;
  displayHeight: number;
  texture: { key: string };
  frame: { name: string };
}

interface BrowserRig {
  animate(timeMs: number, anim: unknown): unknown;
  __headSplitOriginalAnimate?: (timeMs: number, anim: unknown) => unknown;
  body: BrowserImage;
  boilerplateHead?: BrowserImage;
  manifestHeadOffset?: Readonly<{ x: number; y: number }>;
  parts: BrowserImage[];
  hands: Array<{ img: BrowserImage }>;
  feet: Array<{ img: BrowserImage }>;
}

interface BrowserArena {
  addBlob(player: unknown, id: string): void;
  blobs: { get(id: string): BrowserRig | undefined };
  cameras: { main: { setZoom(value: number): void } };
  game: { hasFocus: boolean };
  pointerOverInteractiveUi: boolean;
  removeBlob(id: string): void;
  room: {
    sessionId: string;
    send(type: string, payload?: unknown): void;
    state: {
      players: {
        get(id: string):
          | {
              character?: string;
              dualWield?: { gearUpper?: string; gearLower?: string };
            }
          | undefined;
      };
    };
  };
  time: { now: number };
  verbs?: {
    isLegendOpen?(): boolean;
    releaseInputLatchIf?(release: boolean): void;
    toggleLegend?(nowMs: number): void;
  };
}

interface HeadSample {
  timeMs: number;
  bodyX: number;
  bodyY: number;
  headX: number;
  headY: number;
  relativeX: number;
  relativeY: number;
}

interface BrowserGlobal {
  ddGame: { scene: { getScene(key: string): BrowserArena } };
  __headSplitSamples?: HeadSample[];
}

test("Drifter renders a native separated head and bobs it through the existing floating-part rig", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await runArenaSpec(page, async (baseURL) => {
    await mkdir(EVIDENCE_DIR, { recursive: true });
    await page.setViewportSize({ width: 1280, height: 720 });
    await bootArena(page, baseURL, "char:drifter");
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
            const player = arena.room.state.players.get(arena.room.sessionId);
            return {
              character: player?.character ?? null,
              gearUpper: player?.dualWield?.gearUpper ?? "",
              gearLower: player?.dualWield?.gearLower ?? "",
            };
          }),
        { message: "the private dev room should apply the Drifter identity", timeout: 30_000 },
      )
      .toMatchObject({ character: "drifter" });
    // Current v4 metagame joins intentionally mount the wardrobe bake over every identity. For this
    // character-art proof, remount the same decoded Drifter row through ArenaScene's real legacy
    // compatibility branch (the branch used when a room has no appended gear tail). This changes only
    // the private browser's decoded row; the private server and production wardrobe behavior stay intact.
    await page.evaluate(() => {
      const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
      const id = arena.room.sessionId;
      const player = arena.room.state.players.get(id);
      if (!player?.dualWield) throw new Error("private Drifter row has no dual-wield schema tail");
      player.dualWield.gearUpper = "";
      player.dualWield.gearLower = "";
      arena.removeBlob(id);
      arena.addBlob(player, id);
    });
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
            const player = arena.room.state.players.get(arena.room.sessionId);
            const rig = arena.blobs.get(arena.room.sessionId);
            const head = rig?.boilerplateHead;
            return {
              character: player?.character ?? null,
              headIdentity: head ? `${head.texture.key}/${head.frame.name}` : null,
            };
          }),
        { message: "Drifter compatibility rig should mount drifter/head", timeout: 30_000 },
      )
      .toMatchObject({
        character: "drifter",
        headIdentity: expect.stringMatching(/drifter(?::|\/)head/),
      });
    const canvas = page.locator("#game-root canvas");
    await canvas.click({ position: { x: 640, y: 360 } });

    const mounted = await page.evaluate(() => {
      const holder = globalThis as unknown as BrowserGlobal;
      const arena = holder.ddGame.scene.getScene("arena");
      if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend?.(arena.time.now);
      arena.verbs?.releaseInputLatchIf?.(true);
      arena.game.hasFocus = true;
      arena.pointerOverInteractiveUi = false;
      arena.cameras.main.setZoom(3);
      const rig = arena.blobs.get(arena.room.sessionId);
      const player = arena.room.state.players.get(arena.room.sessionId);
      const head = rig?.boilerplateHead;
      if (!rig || !head) throw new Error("live Drifter rig did not mount a floating head");
      holder.__headSplitSamples = [];
      if (!rig.__headSplitOriginalAnimate) {
        rig.__headSplitOriginalAnimate = rig.animate;
        rig.animate = function headSplitProbe(this: BrowserRig, timeMs: number, anim: unknown) {
          const result = this.__headSplitOriginalAnimate?.call(this, timeMs, anim);
          const liveHead = this.boilerplateHead;
          if (liveHead) {
            holder.__headSplitSamples?.push({
              timeMs,
              bodyX: this.body.x,
              bodyY: this.body.y,
              headX: liveHead.x,
              headY: liveHead.y,
              relativeX: liveHead.x - this.body.x,
              relativeY: liveHead.y - this.body.y,
            });
          }
          return result;
        };
      }
      return {
        character: player?.character ?? null,
        gearUpper: player?.dualWield?.gearUpper ?? "",
        gearLower: player?.dualWield?.gearLower ?? "",
        bodyTexture: rig.body.texture.key,
        bodyFrame: rig.body.frame.name,
        headTexture: head.texture.key,
        headFrame: head.frame.name,
        manifestHeadOffset: rig.manifestHeadOffset ?? null,
        genericPartCount: rig.parts.length,
        handCount: rig.hands.length,
        footCount: rig.feet.length,
        headInGenericParts: rig.parts.includes(head),
        headVisible: head.visible,
        headAboveBody: head.y < rig.body.y,
        headDisplay: { width: head.displayWidth, height: head.displayHeight },
        bodyDisplay: { width: rig.body.displayWidth, height: rig.body.displayHeight },
      };
    });

    expect(mounted.character).toBe("drifter");
    expect(`${mounted.bodyTexture}/${mounted.bodyFrame}`).toMatch(/drifter(?::|\/)body/);
    expect(`${mounted.headTexture}/${mounted.headFrame}`).toMatch(/drifter(?::|\/)head/);
    expect(mounted.manifestHeadOffset).not.toBeNull();
    expect(mounted.genericPartCount).toBe(5);
    expect(mounted.handCount).toBe(2);
    expect(mounted.footCount).toBe(2);
    expect(mounted.headInGenericParts).toBe(false);
    expect(mounted.headVisible).toBe(true);
    expect(mounted.headAboveBody).toBe(true);

    await canvas.screenshot({ path: path.join(EVIDENCE_DIR, "runtime-drifter-head-rest.png") });
    for (let frame = 1; frame <= 6; frame++) {
      await page.waitForTimeout(180);
      await canvas.screenshot({
        path: path.join(
          EVIDENCE_DIR,
          `runtime-drifter-head-bob-${String(frame).padStart(2, "0")}.png`,
        ),
      });
    }

    const samples = await page.evaluate(() => [
      ...((globalThis as unknown as BrowserGlobal).__headSplitSamples ?? []),
    ]);
    const relativeY = samples.map((sample) => sample.relativeY);
    const bobRangePx = Math.max(...relativeY) - Math.min(...relativeY);
    expect(samples.length).toBeGreaterThan(20);
    expect(bobRangePx).toBeGreaterThan(0.35);
    expect(bobRangePx).toBeLessThanOrEqual(8.5);

    await writeFile(
      path.join(EVIDENCE_DIR, "runtime-drifter-head-capture.json"),
      `${JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          baseURL,
          mounted,
          sampleCount: samples.length,
          bobRangePx,
          minRelativeY: Math.min(...relativeY),
          maxRelativeY: Math.max(...relativeY),
          samples,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  });
});
