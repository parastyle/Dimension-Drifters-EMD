import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { bootArena, runArenaSpec } from "../helpers/arena-harness.js";

const EVIDENCE_DIR = path.resolve("docs/owner-notes-audit-v8-evidence/drifter-head-v2");

interface AlphaProfile {
  width: number;
  height: number;
  top: number[];
  bottom: number[];
}

interface BrowserImage {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  visible: boolean;
  displayWidth: number;
  displayHeight: number;
  texture: { key: string };
  frame: { name: string };
}

interface HeadSample {
  timeMs: number;
  localRelativeX: number;
  localRelativeY: number;
  envelopeOverlapPx: number;
  alphaOverlapPx: number;
  bodyScaleX: number;
  bodyScaleY: number;
  headScaleX: number;
  headScaleY: number;
}

interface BrowserRig {
  animate(timeMs: number, anim: unknown): unknown;
  __drifterHeadV2OriginalAnimate?: (timeMs: number, anim: unknown) => unknown;
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

interface BrowserGlobal {
  ddGame: { scene: { getScene(key: string): BrowserArena } };
  __drifterHeadV2Profiles?: { body: AlphaProfile; head: AlphaProfile };
  __drifterHeadV2Samples?: HeadSample[];
}

test("Drifter v2 has a taller concealed head that overlaps the body through both bob extremes", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await runArenaSpec(page, async (baseURL) => {
    await mkdir(EVIDENCE_DIR, { recursive: true });
    await page.setViewportSize({ width: 1280, height: 720 });
    await bootArena(page, baseURL, "char:drifter");
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
            return arena.room.state.players.get(arena.room.sessionId)?.character ?? null;
          }),
        { message: "the private dev room should apply the Drifter identity", timeout: 30_000 },
      )
      .toBe("drifter");

    await page.evaluate(() => {
      const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
      const id = arena.room.sessionId;
      const player = arena.room.state.players.get(id);
      if (!player?.dualWield) throw new Error("private Drifter row has no compatibility schema tail");
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
            const head = arena.blobs.get(arena.room.sessionId)?.boilerplateHead;
            return head ? `${head.texture.key}/${head.frame.name}` : null;
          }),
        { message: "the compatibility rig should mount drifter/head", timeout: 30_000 },
      )
      .toMatch(/drifter(?::|\/)head/);

    const canvas = page.locator("#game-root canvas");
    await canvas.click({ position: { x: 640, y: 360 } });
    const mounted = await page.evaluate(async () => {
      const holder = globalThis as unknown as BrowserGlobal;
      const arena = holder.ddGame.scene.getScene("arena");
      if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend?.(arena.time.now);
      arena.verbs?.releaseInputLatchIf?.(true);
      arena.game.hasFocus = true;
      arena.pointerOverInteractiveUi = false;
      arena.cameras.main.setZoom(3);

      const loadAlphaProfile = async (url: string): Promise<AlphaProfile> => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`failed to fetch ${url}: ${response.status}`);
        const bitmap = await createImageBitmap(await response.blob());
        const scratch = document.createElement("canvas");
        scratch.width = bitmap.width;
        scratch.height = bitmap.height;
        const context = scratch.getContext("2d", { willReadFrequently: true });
        if (!context) throw new Error("2D canvas unavailable for alpha measurement");
        context.drawImage(bitmap, 0, 0);
        const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
        const top = Array.from({ length: bitmap.width }, () => Number.POSITIVE_INFINITY);
        const bottom = Array.from({ length: bitmap.width }, () => Number.NEGATIVE_INFINITY);
        for (let y = 0; y < bitmap.height; y++) {
          for (let x = 0; x < bitmap.width; x++) {
            if (pixels[(y * bitmap.width + x) * 4 + 3] < 128) continue;
            top[x] = Math.min(top[x], y);
            bottom[x] = Math.max(bottom[x], y);
          }
        }
        bitmap.close();
        return { width: scratch.width, height: scratch.height, top, bottom };
      };

      holder.__drifterHeadV2Profiles = {
        body: await loadAlphaProfile("/sprites/drifter/body.png"),
        head: await loadAlphaProfile("/sprites/drifter/head.png"),
      };
      holder.__drifterHeadV2Samples = [];
      const rig = arena.blobs.get(arena.room.sessionId);
      const head = rig?.boilerplateHead;
      if (!rig || !head || !rig.manifestHeadOffset) {
        throw new Error("live Drifter rig did not mount its sliced floating head");
      }

      if (!rig.__drifterHeadV2OriginalAnimate) {
        rig.__drifterHeadV2OriginalAnimate = rig.animate;
        rig.animate = function drifterHeadV2Probe(this: BrowserRig, timeMs: number, anim: unknown) {
          const result = this.__drifterHeadV2OriginalAnimate?.call(this, timeMs, anim);
          const liveHead = this.boilerplateHead;
          const profiles = holder.__drifterHeadV2Profiles;
          if (!liveHead || !profiles) return result;

          const dx = liveHead.x - this.body.x;
          const dy = liveHead.y - this.body.y;
          const cosine = Math.cos(this.body.rotation);
          const sine = Math.sin(this.body.rotation);
          const localRelativeX = cosine * dx + sine * dy;
          const localRelativeY = -sine * dx + cosine * dy;
          let alphaOverlapPx = Number.NEGATIVE_INFINITY;
          for (let headX = 0; headX < profiles.head.width; headX++) {
            const headBottom = profiles.head.bottom[headX];
            if (!Number.isFinite(headBottom)) continue;
            const localX =
              localRelativeX + (headX + 0.5 - profiles.head.width / 2) * liveHead.scaleX;
            const bodyX = Math.round(localX / this.body.scaleX + profiles.body.width / 2 - 0.5);
            if (bodyX < 0 || bodyX >= profiles.body.width) continue;
            const bodyTop = profiles.body.top[bodyX];
            if (!Number.isFinite(bodyTop)) continue;
            const headBottomY =
              localRelativeY + (headBottom + 1 - profiles.head.height / 2) * liveHead.scaleY;
            const bodyTopY = (bodyTop - profiles.body.height / 2) * this.body.scaleY;
            alphaOverlapPx = Math.max(alphaOverlapPx, headBottomY - bodyTopY);
          }
          holder.__drifterHeadV2Samples?.push({
            timeMs,
            localRelativeX,
            localRelativeY,
            envelopeOverlapPx:
              localRelativeY +
              Math.abs(liveHead.displayHeight) / 2 +
              Math.abs(this.body.displayHeight) / 2,
            alphaOverlapPx,
            bodyScaleX: this.body.scaleX,
            bodyScaleY: this.body.scaleY,
            headScaleX: liveHead.scaleX,
            headScaleY: liveHead.scaleY,
          });
          return result;
        };
      }

      return {
        character: arena.room.state.players.get(arena.room.sessionId)?.character ?? null,
        bodyTexture: rig.body.texture.key,
        bodyFrame: rig.body.frame.name,
        headTexture: head.texture.key,
        headFrame: head.frame.name,
        manifestHeadOffset: rig.manifestHeadOffset,
        genericPartCount: rig.parts.length,
        handCount: rig.hands.length,
        footCount: rig.feet.length,
        headInGenericParts: rig.parts.includes(head),
        headVisible: head.visible,
        headSource: {
          width: holder.__drifterHeadV2Profiles.head.width,
          height: holder.__drifterHeadV2Profiles.head.height,
        },
        bodySource: {
          width: holder.__drifterHeadV2Profiles.body.width,
          height: holder.__drifterHeadV2Profiles.body.height,
        },
      };
    });

    expect(mounted.character).toBe("drifter");
    expect(`${mounted.bodyTexture}/${mounted.bodyFrame}`).toMatch(/drifter(?::|\/)body/);
    expect(`${mounted.headTexture}/${mounted.headFrame}`).toMatch(/drifter(?::|\/)head/);
    expect(mounted.headSource.height).toBeGreaterThan(82);
    expect(mounted.bodySource).toEqual({ width: 141, height: 168 });
    expect(mounted.genericPartCount).toBe(5);
    expect(mounted.handCount).toBe(2);
    expect(mounted.footCount).toBe(2);
    expect(mounted.headInGenericParts).toBe(false);
    expect(mounted.headVisible).toBe(true);

    await page.waitForTimeout(1_200);
    await page.evaluate(() => {
      (globalThis as unknown as BrowserGlobal).__drifterHeadV2Samples = [];
    });
    await canvas.screenshot({ path: path.join(EVIDENCE_DIR, "v2-runtime-rest.png") });

    const extremes = await page.evaluate(async () => {
      const holder = globalThis as unknown as BrowserGlobal;
      const renderCanvas = document.querySelector<HTMLCanvasElement>("#game-root canvas");
      if (!renderCanvas) throw new Error("game canvas unavailable");
      let min: { sample: HeadSample; dataUrl: string } | undefined;
      let max: { sample: HeadSample; dataUrl: string } | undefined;
      let observed = 0;
      const started = performance.now();
      await new Promise<void>((resolve) => {
        const sampleFrame = () => {
          const samples = holder.__drifterHeadV2Samples ?? [];
          const latest = samples.at(-1);
          if (latest && samples.length !== observed) {
            observed = samples.length;
            if (!min || latest.alphaOverlapPx < min.sample.alphaOverlapPx) {
              min = { sample: latest, dataUrl: renderCanvas.toDataURL("image/png") };
            }
            if (!max || latest.alphaOverlapPx > max.sample.alphaOverlapPx) {
              max = { sample: latest, dataUrl: renderCanvas.toDataURL("image/png") };
            }
          }
          if (performance.now() - started >= 6_000) resolve();
          else requestAnimationFrame(sampleFrame);
        };
        requestAnimationFrame(sampleFrame);
      });
      if (!min || !max) throw new Error("no floating-head extrema were captured");
      return { min, max };
    });

    const decodeCanvasPng = (dataUrl: string): Buffer =>
      Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ""), "base64");
    await writeFile(
      path.join(EVIDENCE_DIR, "v2-runtime-bob-top.png"),
      decodeCanvasPng(extremes.min.dataUrl),
    );
    await writeFile(
      path.join(EVIDENCE_DIR, "v2-runtime-bob-bottom.png"),
      decodeCanvasPng(extremes.max.dataUrl),
    );

    const samples = await page.evaluate(() => [
      ...((globalThis as unknown as BrowserGlobal).__drifterHeadV2Samples ?? []),
    ]);
    const localRelativeY = samples.map((sample) => sample.localRelativeY);
    const alphaOverlap = samples.map((sample) => sample.alphaOverlapPx);
    const envelopeOverlap = samples.map((sample) => sample.envelopeOverlapPx);
    const bobRangePx = Math.max(...localRelativeY) - Math.min(...localRelativeY);
    const minAlphaSilhouetteOverlapPx = Math.min(...alphaOverlap);
    const minEnvelopeOverlapPx = Math.min(...envelopeOverlap);

    // Software WebGL can settle around 10 fps at this viewport; six seconds still spans the
    // complete idle cycle, so require enough distinct rendered poses rather than a 60 fps count.
    expect(samples.length).toBeGreaterThan(40);
    expect(bobRangePx).toBeGreaterThan(0.15);
    expect(bobRangePx).toBeLessThanOrEqual(4);
    expect(minAlphaSilhouetteOverlapPx).toBeGreaterThan(0);
    expect(minEnvelopeOverlapPx).toBeGreaterThan(0);

    await writeFile(
      path.join(EVIDENCE_DIR, "v2-runtime-capture.json"),
      `${JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          baseURL,
          mounted,
          sampleCount: samples.length,
          bobRangePx,
          minAlphaSilhouetteOverlapPx,
          minEnvelopeOverlapPx,
          topExtreme: extremes.min.sample,
          bottomExtreme: extremes.max.sample,
          samples,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  });
});
