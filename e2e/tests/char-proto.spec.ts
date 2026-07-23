import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { bootArena, runArenaSpec } from "../helpers/arena-harness.js";

const EVIDENCE_DIR = path.resolve("docs/owner-notes-audit-v8-evidence/char-proto");
const PROTOTYPES = ["proto-sheriff", "proto-samurai", "proto-witch"] as const;
const PART_ROLES = ["body", "head", "hand-l", "hand-r", "foot-l", "foot-r"] as const;
const HEAD_OY = {
  "proto-sheriff": -177.91,
  "proto-samurai": -158.88,
  "proto-witch": -180.08,
} as const;

interface BrowserImage {
  x: number;
  y: number;
  visible: boolean;
  displayHeight: number;
  displayWidth: number;
  texture: { key: string };
  frame: { name: string };
  setVisible(value: boolean): BrowserImage;
}

interface BrowserContainer {
  getIndex(child: BrowserImage): number;
}

interface BrowserRig {
  animate(timeMs: number, anim: unknown): unknown;
  __charProtoOriginalAnimate?: (timeMs: number, anim: unknown) => unknown;
  body: BrowserImage;
  boilerplateHead?: BrowserImage;
  manifestHeadOffset?: Readonly<{ x: number; y: number }>;
  parts: BrowserImage[];
  hands: Array<{ img: BrowserImage; front: boolean; ox: number; oy: number }>;
  feet: Array<{ img: BrowserImage }>;
  weapons: Array<{ img: BrowserImage; worn: boolean; def: { id: string } }>;
  root: BrowserContainer;
  label?: BrowserImage;
}

interface BrowserPlayer {
  character?: string;
  dualWield?: { gearUpper?: string; gearLower?: string };
  petId?: string;
  petLevelBand?: number;
}

interface BrowserArena {
  addBlob(player: unknown, id: string): void;
  blobs: { get(id: string): BrowserRig | undefined };
  cameras: { main: { setZoom(value: number): void } };
  game: { hasFocus: boolean };
  objectiveEconomyText?: BrowserImage;
  objectiveHudGfx?: BrowserImage;
  objectiveLocationText?: BrowserImage;
  objectiveNoticeText?: BrowserImage;
  objectiveText?: BrowserImage;
  parryGfx?: BrowserImage;
  pointerOverInteractiveUi: boolean;
  removeBlob(id: string): void;
  room: {
    sessionId: string;
    state: { players: { get(id: string): BrowserPlayer | undefined } };
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
  bodyHeight: number;
  headX: number;
  headY: number;
  headHeight: number;
  relativeX: number;
  relativeY: number;
  gapPx: number;
}

interface BrowserGlobal {
  ddGame: { scene: { getScene(key: string): BrowserArena } };
  __charProtoSamples?: HeadSample[];
}

for (const characterId of PROTOTYPES) {
  test(`${characterId} mounts all six authored parts and bobs its floating head`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await runArenaSpec(page, async (baseURL) => {
      await mkdir(EVIDENCE_DIR, { recursive: true });
      await page.setViewportSize({ width: 1280, height: 720 });
      await bootArena(page, baseURL, `char:${characterId}`);
      await expect
        .poll(
          () =>
            page.evaluate(() => {
              const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
              return arena.room.state.players.get(arena.room.sessionId)?.character ?? null;
            }),
          { message: `the private dev room should apply ${characterId}`, timeout: 30_000 },
        )
        .toBe(characterId);

      // The v4 account mounts wardrobe art over character identities. Remount the same decoded row through
      // ArenaScene's real legacy-character branch so this private visual proof exercises the authored sprite.
      await page.evaluate(() => {
        const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
        const id = arena.room.sessionId;
        const player = arena.room.state.players.get(id);
        if (!player?.dualWield)
          throw new Error("private prototype row has no dual-wield schema tail");
        player.dualWield.gearUpper = "";
        player.dualWield.gearLower = "";
        player.petId = "";
        player.petLevelBand = 0;
        arena.removeBlob(id);
        arena.addBlob(player, id);
      });

      const canvas = page.locator("#game-root canvas");
      await canvas.click({ position: { x: 1100, y: 620 } });
      const mounted = await page.evaluate(() => {
        const holder = globalThis as unknown as BrowserGlobal;
        const arena = holder.ddGame.scene.getScene("arena");
        if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend?.(arena.time.now);
        arena.verbs?.releaseInputLatchIf?.(true);
        arena.game.hasFocus = true;
        arena.pointerOverInteractiveUi = false;
        arena.cameras.main.setZoom(2.25);
        arena.objectiveHudGfx?.setVisible(false);
        arena.objectiveText?.setVisible(false);
        arena.objectiveLocationText?.setVisible(false);
        arena.objectiveEconomyText?.setVisible(false);
        arena.objectiveNoticeText?.setVisible(false);
        arena.parryGfx?.setVisible(false);
        const rig = arena.blobs.get(arena.room.sessionId);
        const player = arena.room.state.players.get(arena.room.sessionId);
        const head = rig?.boilerplateHead;
        if (!rig || !head) throw new Error("live prototype rig did not mount a floating head");
        rig.label?.setVisible(false);
        for (const weapon of rig.weapons) weapon.img.setVisible(false);
        holder.__charProtoSamples = [];
        if (!rig.__charProtoOriginalAnimate) {
          rig.__charProtoOriginalAnimate = rig.animate;
          rig.animate = function charProtoProbe(this: BrowserRig, timeMs: number, anim: unknown) {
            const result = this.__charProtoOriginalAnimate?.call(this, timeMs, anim);
            this.label?.setVisible(false);
            for (const weapon of this.weapons) weapon.img.setVisible(false);
            const liveHead = this.boilerplateHead;
            if (liveHead) {
              const bodyTop = this.body.y - this.body.displayHeight / 2;
              const headBottom = liveHead.y + liveHead.displayHeight / 2;
              holder.__charProtoSamples?.push({
                timeMs,
                bodyX: this.body.x,
                bodyY: this.body.y,
                bodyHeight: this.body.displayHeight,
                headX: liveHead.x,
                headY: liveHead.y,
                headHeight: liveHead.displayHeight,
                relativeX: liveHead.x - this.body.x,
                relativeY: liveHead.y - this.body.y,
                gapPx: bodyTop - headBottom,
              });
            }
            return result;
          };
        }
        const partFrames = [
          rig.body,
          head,
          ...rig.hands.map((part) => part.img),
          ...rig.feet.map((part) => part.img),
        ].map((part) => part.frame.name);
        return {
          character: player?.character ?? null,
          gearUpper: player?.dualWield?.gearUpper ?? "",
          gearLower: player?.dualWield?.gearLower ?? "",
          bodyIdentity: `${rig.body.texture.key}/${rig.body.frame.name}`,
          headIdentity: `${head.texture.key}/${head.frame.name}`,
          partFrames,
          manifestHeadOffset: rig.manifestHeadOffset ?? null,
          genericPartCount: rig.parts.length,
          handCount: rig.hands.length,
          bodyX: rig.body.x,
          hands: rig.hands.map((hand) => ({
            role: hand.front ? "hand-r" : "hand-l",
            frame: hand.img.frame.name,
            visible: hand.img.visible,
            rootIndex: rig.root.getIndex(hand.img),
            x: hand.img.x,
            y: hand.img.y,
            authoredX: hand.ox,
            authoredY: hand.oy,
            displayWidth: hand.img.displayWidth,
            displayHeight: hand.img.displayHeight,
          })),
          weapons: rig.weapons.map((weapon) => ({
            id: weapon.def.id,
            worn: weapon.worn,
            visible: weapon.img.visible,
          })),
          footCount: rig.feet.length,
          headInGenericParts: rig.parts.includes(head),
          headVisible: head.visible,
          headAboveBody: head.y < rig.body.y,
          restGapPx: rig.body.y - rig.body.displayHeight / 2 - (head.y + head.displayHeight / 2),
          bodyDisplay: { width: rig.body.displayWidth, height: rig.body.displayHeight },
          headDisplay: { width: head.displayWidth, height: head.displayHeight },
        };
      });

      expect(mounted.character).toBe(characterId);
      expect(mounted.bodyIdentity).toMatch(new RegExp(`${characterId}(?::|/)body`));
      expect(mounted.headIdentity).toMatch(new RegExp(`${characterId}(?::|/)head`));
      expect(mounted.partFrames.slice().sort()).toEqual(
        PART_ROLES.map((role) => `${characterId}/${role}`).sort(),
      );
      expect(mounted.manifestHeadOffset).not.toBeNull();
      expect(mounted.manifestHeadOffset?.y).toBe(HEAD_OY[characterId]);
      expect(mounted.genericPartCount).toBe(5);
      expect(mounted.handCount).toBe(2);
      expect(mounted.hands.map((hand) => hand.role).sort()).toEqual(["hand-l", "hand-r"]);
      for (const hand of mounted.hands) {
        expect(hand.frame).toBe(`${characterId}/${hand.role}`);
        expect(hand.visible, `${characterId}/${hand.role} should render at rest`).toBe(true);
        expect(
          hand.rootIndex,
          `${characterId}/${hand.role} should remain in the rig display list`,
        ).toBeGreaterThanOrEqual(0);
      }
      const leftHand = mounted.hands.find((hand) => hand.role === "hand-l");
      const rightHand = mounted.hands.find((hand) => hand.role === "hand-r");
      expect(
        leftHand?.x,
        `${characterId}/hand-l should remain visibly left of the torso`,
      ).toBeLessThan(mounted.bodyX - mounted.bodyDisplay.width / 2);
      expect(
        rightHand?.x,
        `${characterId}/hand-r should remain visibly right of the torso`,
      ).toBeGreaterThan(mounted.bodyX + mounted.bodyDisplay.width / 2);
      expect(mounted.footCount).toBe(2);
      expect(mounted.headInGenericParts).toBe(false);
      expect(mounted.headVisible).toBe(true);
      expect(mounted.headAboveBody).toBe(true);
      expect(mounted.restGapPx).toBeLessThan(2);
      // SpriteRig targets a 76 px body; the narrow range allows its authored idle squash only.
      expect(mounted.bodyDisplay.height).toBeGreaterThan(70);
      expect(mounted.bodyDisplay.height).toBeLessThan(80);

      await page.waitForTimeout(500);
      await canvas.screenshot({ path: path.join(EVIDENCE_DIR, `${characterId}-rest.png`) });
      await page.waitForTimeout(700);
      await canvas.screenshot({ path: path.join(EVIDENCE_DIR, `${characterId}-bob.png`) });
      await page.waitForTimeout(500);

      const samples = await page.evaluate(() => [
        ...((globalThis as unknown as BrowserGlobal).__charProtoSamples ?? []),
      ]);
      const relativeY = samples.map((sample) => sample.relativeY);
      const gaps = samples.map((sample) => sample.gapPx);
      const bobRangePx = Math.max(...relativeY) - Math.min(...relativeY);
      expect(samples.length).toBeGreaterThan(30);
      expect(bobRangePx).toBeGreaterThan(0.35);
      expect(bobRangePx).toBeLessThanOrEqual(14);
      expect(Math.max(...gaps)).toBeLessThan(4);

      await writeFile(
        path.join(EVIDENCE_DIR, `${characterId}-capture.json`),
        `${JSON.stringify(
          {
            capturedAt: new Date().toISOString(),
            baseURL,
            mounted,
            sampleCount: samples.length,
            bobRangePx,
            minRelativeY: Math.min(...relativeY),
            maxRelativeY: Math.max(...relativeY),
            minGapPx: Math.min(...gaps),
            maxGapPx: Math.max(...gaps),
            samples,
          },
          null,
          2,
        )}\n`,
        "utf8",
      );
    });
  });
}
