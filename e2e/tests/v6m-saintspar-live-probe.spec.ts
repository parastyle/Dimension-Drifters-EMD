import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { bootArena, runArenaSpec, waitForDevWeapon } from "../helpers/arena-harness.js";

const WEAPON_ID = "x2-saintspar-lochaber";
const EVIDENCE_DIR = path.resolve(
  import.meta.dirname,
  "../../docs/owner-notes-audit-v6-evidence/v6m",
);

interface SaintsparFrame {
  attackSeq: number;
  rigAttackSeq: number;
  sceneNow: number;
  phase: number;
  motion?: string;
  comboStep?: number;
  direction?: number;
  rotation: number;
  tipYProjection: number;
}

test("Saintspar's second live hit rises upward", async ({ page }) => {
  test.setTimeout(120_000);
  await runArenaSpec(page, async (baseURL) => {
    await mkdir(EVIDENCE_DIR, { recursive: true });
    await bootArena(page, baseURL, `weapon:${WEAPON_ID}`);
    await waitForDevWeapon(page, WEAPON_ID);
    await page.locator("#game-root canvas").click({ position: { x: 640, y: 360 } });
    await page.mouse.move(1_050, 360);

    await page.evaluate(() => {
      const holder = globalThis as unknown as {
        ddGame: { scene: { getScene(key: string): any } };
        __v6mSaintsparFrames?: SaintsparFrame[];
        __v6mSaintsparCapturedSeq?: number;
      };
      const arena = holder.ddGame.scene.getScene("arena");
      if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend(arena.time.now);
      arena.verbs?.releaseInputLatchIf?.(true);
      arena.game.hasFocus = true;
      arena.pointerOverInteractiveUi = false;
      const rig = arena.blobs.get(arena.room.sessionId);
      holder.__v6mSaintsparFrames = [];
      if (rig.__v6mSaintsparOriginalAnimate) return;
      rig.__v6mSaintsparOriginalAnimate = rig.animate;
      rig.animate = function v6mSaintsparAnimate(timeMs: number, anim: unknown) {
        const result = this.__v6mSaintsparOriginalAnimate.call(this, timeMs, anim);
        const self = arena.room.state.players.get(arena.room.sessionId);
        const held = this.weapons[0];
        const poseSeconds = Math.max(1e-6, this.swing?.poseSeconds ?? 1);
        const phase = (timeMs - this.swingStart) / (poseSeconds * 1_000);
        const rotation = held?.semanticRotation ?? held?.img?.rotation ?? 0;
        const frame = {
          attackSeq: self?.attackSeq ?? 0,
          rigAttackSeq: this.attackBeatSeq ?? 0,
          sceneNow: timeMs,
          phase,
          motion: this.swing?.motion,
          comboStep: this.swing?.comboStep,
          direction: this.swing?.comboDirection,
          rotation,
          tipYProjection: Math.sin(rotation),
        } satisfies SaintsparFrame;
        holder.__v6mSaintsparFrames?.push(frame);
        if (
          holder.__v6mSaintsparCapturedSeq === undefined &&
          frame.rigAttackSeq >= 2 &&
          frame.comboStep === 1 &&
          frame.motion === "rising-chop" &&
          frame.direction === -1 &&
          frame.tipYProjection < -0.5
        ) {
          holder.__v6mSaintsparCapturedSeq = frame.rigAttackSeq;
          arena.frozenUntil = Math.max(arena.frozenUntil, arena.time.now + 10_000);
        }
        if ((holder.__v6mSaintsparFrames?.length ?? 0) > 600)
          holder.__v6mSaintsparFrames?.splice(0, 100);
        return result;
      };
    });

    const startPath = path.join(EVIDENCE_DIR, "saintspar-second-hit-start.png");
    await page.screenshot({ path: startPath, fullPage: true });

    const startSeq = await page.evaluate(() => {
      const holder = globalThis as unknown as {
        ddGame: { scene: { getScene(key: string): any } };
        __v6mSaintsparInput?: number;
      };
      const arena = holder.ddGame.scene.getScene("arena");
      const self = arena.room.state.players.get(arena.room.sessionId);
      arena.game.hasFocus = true;
      arena.pointerOverInteractiveUi = false;
      arena.verbs?.releaseInputLatchIf?.(true);
      arena.input.activePointer.rightButtonDown = () => true;
      holder.__v6mSaintsparInput = window.setInterval(
        () => arena.stepNetInput?.(50, false, false, 0, 0),
        50,
      );
      return self.attackSeq;
    });
    const nominalSecondSeq = startSeq + 2;
    try {
      await page.waitForFunction(
        () =>
          (globalThis as unknown as { __v6mSaintsparCapturedSeq?: number })
            .__v6mSaintsparCapturedSeq !== undefined,
        undefined,
        { timeout: 10_000 },
      );
    } catch (error) {
      const debug = await page.evaluate(() => {
        const frames =
          (globalThis as unknown as { __v6mSaintsparFrames?: SaintsparFrame[] })
            .__v6mSaintsparFrames ?? [];
        return {
          count: frames.length,
          attacks: [...new Set(frames.map((frame) => frame.attackSeq))],
          rigAttacks: [...new Set(frames.map((frame) => frame.rigAttackSeq))],
          swings: [...new Set(frames.map((frame) => `${frame.comboStep}:${frame.motion}`))],
          tail: frames.slice(-20),
        };
      });
      console.log(JSON.stringify({ nominalSecondSeq, debug }, null, 2));
      throw error;
    }
    const secondSeq = await page.evaluate(
      () =>
        (globalThis as unknown as { __v6mSaintsparCapturedSeq?: number }).__v6mSaintsparCapturedSeq,
    );
    expect(secondSeq, "live probe should observe the authored second combo step").toBeDefined();
    if (secondSeq === undefined) throw new Error("missing Saintspar second-step sequence");
    await page.evaluate(() => {
      const holder = globalThis as unknown as {
        ddGame: { scene: { getScene(key: string): any } };
        __v6mSaintsparInput?: number;
      };
      const arena = holder.ddGame.scene.getScene("arena");
      arena.input.activePointer.rightButtonDown = () => false;
      arena.stepNetInput?.(50, false, false, 0, 0);
      if (holder.__v6mSaintsparInput) window.clearInterval(holder.__v6mSaintsparInput);
    });

    const peakPath = path.join(EVIDENCE_DIR, "saintspar-second-hit-upward.png");
    await page.screenshot({ path: peakPath, fullPage: true });

    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const arena = (
              globalThis as unknown as { ddGame: { scene: { getScene(key: string): any } } }
            ).ddGame.scene.getScene("arena");
            return arena.room.state.players.get(arena.room.sessionId)?.attackSeq ?? 0;
          }),
        { message: "Saintspar hit two must be server-accepted", timeout: 10_000 },
      )
      .toBeGreaterThanOrEqual(secondSeq);
    const authoritativeAttackSeq = await page.evaluate(() => {
      const arena = (
        globalThis as unknown as { ddGame: { scene: { getScene(key: string): any } } }
      ).ddGame.scene.getScene("arena");
      return arena.room.state.players.get(arena.room.sessionId)?.attackSeq ?? 0;
    });

    const frames = await page.evaluate(
      ({ wantedSeq }) =>
        (
          (globalThis as unknown as { __v6mSaintsparFrames?: SaintsparFrame[] })
            .__v6mSaintsparFrames ?? []
        ).filter((frame) => frame.rigAttackSeq === wantedSeq && frame.motion === "rising-chop"),
      { wantedSeq: secondSeq },
    );
    const peakTipY = Math.min(...frames.map((frame) => frame.tipYProjection));
    const assertions = {
      authoritativeBeat: authoritativeAttackSeq >= secondSeq,
      secondComboStep: frames.some((frame) => frame.comboStep === 1),
      secondMotion: frames.some((frame) => frame.motion === "rising-chop"),
      reverseDirection: frames.some((frame) => frame.direction === -1),
      upwardFrame: peakTipY < -0.5,
    };
    const evidence = {
      weaponId: WEAPON_ID,
      baseURL,
      capturedAt: new Date().toISOString(),
      secondAttackSeq: secondSeq,
      authoritativeAttackSeq,
      peakTipY,
      assertions,
      screenshots: [
        path.relative(process.cwd(), startPath),
        path.relative(process.cwd(), peakPath),
      ],
      frames,
    };
    await writeFile(
      path.join(EVIDENCE_DIR, "saintspar-second-hit.json"),
      `${JSON.stringify(evidence, null, 2)}\n`,
    );

    expect(assertions).toEqual({
      authoritativeBeat: true,
      secondComboStep: true,
      secondMotion: true,
      reverseDirection: true,
      upwardFrame: true,
    });
  });
});
