import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const phase = process.argv[2] ?? "before";
const weaponId = process.argv[3] ?? "x-gun-ricochet-pistol";
const baseURL = process.env.DD_E2E_BASE_URL ?? "http://localhost:5180";
const evidenceRoot = path.resolve("docs/owner-notes-audit-v4-evidence");
const jsonPath = path.join(evidenceRoot, `pistol-twirl-${phase}.json`);
const frameTimesMs = [450, 650, 850, 1_050];
const framePaths = frameTimesMs.map((atMs) =>
  path.join(evidenceRoot, `pistol-twirl-${phase}-${atMs}ms.png`),
);

function unwrapAngles(values) {
  const unwrapped = [];
  for (const value of values) {
    const prior = unwrapped.at(-1);
    if (prior === undefined) {
      unwrapped.push(value);
      continue;
    }
    let next = value;
    while (next - prior > Math.PI) next -= Math.PI * 2;
    while (next - prior < -Math.PI) next += Math.PI * 2;
    unwrapped.push(next);
  }
  return unwrapped;
}

function rotationSummary(frames, hand) {
  const samples = frames
    .map((frame) => ({ elapsedMs: frame.elapsedMs, rotation: frame.weapons[hand]?.rotation }))
    .filter((sample) => Number.isFinite(sample.rotation));
  const values = unwrapAngles(samples.map((sample) => sample.rotation));
  const baseline = values[0] ?? 0;
  const deltas = values.map((value) => Math.abs(value - baseline));
  const onsetIndex = deltas.findIndex((delta) => delta >= 0.35);
  return {
    sampleCount: values.length,
    rangeRad: values.length ? Math.max(...values) - Math.min(...values) : 0,
    rangeTurns: values.length ? (Math.max(...values) - Math.min(...values)) / (Math.PI * 2) : 0,
    maxDeltaFromBaselineRad: deltas.length ? Math.max(...deltas) : 0,
    onsetMs: onsetIndex >= 0 ? samples[onsetIndex].elapsedMs : null,
  };
}

await mkdir(evidenceRoot, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: [
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
  ],
});
const context = await browser.newContext({ viewport: { width: 640, height: 360 } });
const page = await context.newPage();
const browserErrors = [];
page.on("console", (message) => {
  if (message.type() === "error") browserErrors.push(`[console] ${message.text()}`);
});
page.on("pageerror", (error) => browserErrors.push(`[pageerror] ${error.stack ?? error.message}`));

try {
  await page.goto(`${baseURL}/?dev=weapon:${encodeURIComponent(weaponId)}`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await page.waitForFunction(
    (wanted) => {
      const game = globalThis.ddGame;
      if (!game?.scene?.isActive("arena")) return false;
      const arena = game.scene.getScene("arena");
      const room = arena.room;
      const self = room?.sessionId ? room.state?.players?.get(room.sessionId) : undefined;
      const rig = room?.sessionId ? arena.blobs?.get(room.sessionId) : undefined;
      return (
        room?.state?.mode === "training" &&
        self?.weapon === wanted &&
        rig?.heldWeaponDef?.(0)?.id === wanted
      );
    },
    weaponId,
    { timeout: 30_000 },
  );

  await page.evaluate(() => {
    const arena = globalThis.ddGame.scene.getScene("arena");
    const rig = arena.blobs.get(arena.room.sessionId);
    if (!rig || rig.__ddOriginalAnimate) return;
    rig.__ddOriginalAnimate = rig.animate;
    rig.animate = function debugAnimate(timeMs, anim) {
      this.__ddLastAnim = {
        isSelf: anim.isSelf,
        fireHeld: anim.fireHeld,
        reducedMotion: anim.reducedMotion,
        desiredMoveX: anim.desiredMoveX,
        desiredMoveY: anim.desiredMoveY,
        moveX: anim.moveX,
        moveY: anim.moveY,
        speed: anim.speed,
      };
      return this.__ddOriginalAnimate.call(this, timeMs, anim);
    };
  });

  const canvas = page.locator("#game-root canvas");
  await canvas.click({ position: { x: 320, y: 180 } });
  await page.mouse.move(555, 180);
  const startSeq = await page.evaluate(() => {
    window.focus();
    window.dispatchEvent(new Event("focus"));
    const arena = globalThis.ddGame.scene.getScene("arena");
    if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend(arena.time.now);
    arena.verbs?.releaseInputLatchIf?.(true);
    arena.game.hasFocus = true;
    arena.input.activePointer.rightButtonDown = () => true;
    const room = arena.room;
    const player = room.state.players.get(room.sessionId);
    globalThis.__ddPistolInputTicks = 0;
    globalThis.__ddPistolInputTimer = window.setInterval(() => {
      arena.stepNetInput?.(50, false, false, 0, 0);
      globalThis.__ddPistolInputTicks += 1;
    }, 50);
    return player.attackSeq;
  });
  await page.waitForFunction(
    (before) => {
      const arena = globalThis.ddGame?.scene?.getScene("arena");
      const room = arena?.room;
      const self = room?.sessionId ? room.state?.players?.get(room.sessionId) : undefined;
      return (self?.attackSeq ?? before) > before;
    },
    startSeq,
    { timeout: 10_000 },
  );
  await page.waitForTimeout(650);
  const attackWindow = await page.evaluate((before) => {
    const arena = globalThis.ddGame.scene.getScene("arena");
    const room = arena.room;
    arena.input.activePointer.rightButtonDown = () => false;
    arena.stepNetInput?.(50, false, false, 0, 0);
    if (globalThis.__ddPistolInputTimer) window.clearInterval(globalThis.__ddPistolInputTimer);
    const self = room.state.players.get(room.sessionId);
    return { startSeq: before, stopSeq: self.attackSeq, sends: globalThis.__ddPistolInputTicks };
  }, startSeq);

  await page.evaluate(() => {
    globalThis.__ddPistolTwirlFrames = [];
    globalThis.__ddPistolTwirlDone = false;
    const startedAt = performance.now();
    const sample = () => {
      const arena = globalThis.ddGame?.scene?.getScene("arena");
      const room = arena?.room;
      const player = room?.sessionId ? room.state?.players?.get(room.sessionId) : undefined;
      const rig = room?.sessionId ? arena.blobs?.get(room.sessionId) : undefined;
      const elapsedMs = performance.now() - startedAt;
      if (rig && player) {
        globalThis.__ddPistolTwirlFrames.push({
          elapsedMs,
          attackSeq: player.attackSeq,
          sceneNow: arena.time.now,
          rigState: {
            idleFlourishEligibleAtMs: rig.idleFlourishEligibleAtMs,
            idleFlourishLastPlayedMs: rig.idleFlourishLastPlayedMs,
            flourishAttackIntent: rig.flourishAttackIntent,
            moveStance: rig.moveStance,
            downed: rig.downed,
            reducedMotion: rig.flourishReducedMotion,
            gait: rig.gait,
            comboHoldPose: rig.comboHoldPose,
            ultimatePhase: rig.ultimatePhase,
            leadIdleSettle: !!rig.flourishLeadSpec?.idleSettle,
            offIdleSettle: !!rig.flourishOffSpec?.idleSettle,
            rangedAimRaiseAtMs: rig.rangedAimRaiseAtMs,
            rangedAimActiveUntilMs: rig.rangedAimActiveUntilMs,
            gunRecoilAtMs: rig.gunRecoilAtMs,
            swingStart: rig.swingStart,
            swingPoseSeconds: rig.swing?.poseSeconds,
            stowActive: rig.stowProxies.some((proxy) => !!proxy.img),
            lastAnim: rig.__ddLastAnim,
            channels: rig.flourishChannels.map((channel) => ({
              active: channel.active,
              moment: channel.moment,
              startMs: channel.startMs,
            })),
            arms: rig.flourishArms.map((arm) => ({
              armed: arm.armed,
              earliestStartMs: arm.earliestStartMs,
              weaponId: arm.weaponId,
            })),
          },
          weapons: rig.weapons.map((weapon) => ({
            id: weapon.def.id,
            rotation: weapon.img.rotation,
            semanticRotation: weapon.semanticRotation,
            x: weapon.img.x,
            y: weapon.img.y,
          })),
        });
      }
      if (elapsedMs < 1_500) requestAnimationFrame(sample);
      else globalThis.__ddPistolTwirlDone = true;
    };
    requestAnimationFrame(sample);
  });

  for (let i = 0; i < frameTimesMs.length; i += 1) {
    await page.evaluate((wantedMs) => {
      const frames = globalThis.__ddPistolTwirlFrames ?? [];
      const sampledMs = frames.at(-1)?.elapsedMs ?? 0;
      return new Promise((resolve) =>
        window.setTimeout(resolve, Math.max(0, wantedMs - sampledMs)),
      );
    }, frameTimesMs[i]);
    await page.screenshot({ path: framePaths[i] });
  }

  await page.waitForFunction(() => globalThis.__ddPistolTwirlDone === true, undefined, {
    timeout: 5_000,
  });

  const frames = await page.evaluate(() => globalThis.__ddPistolTwirlFrames ?? []);
  const unexpectedBrowserErrors = browserErrors.filter(
    (message) => !message.includes("Texture key already in use: dd-sprites"),
  );
  const summary = {
    phase,
    weaponId,
    baseURL,
    capturedAt: new Date().toISOString(),
    attackWindow,
    frameCount: frames.length,
    hands: Array.from(
      { length: Math.max(0, ...frames.map((frame) => frame.weapons.length)) },
      (_, hand) => rotationSummary(frames, hand),
    ),
    browserErrors,
    unexpectedBrowserErrors,
    screenshots: framePaths.map((framePath) => path.relative(process.cwd(), framePath)),
  };
  await writeFile(jsonPath, `${JSON.stringify({ summary, frames }, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
  if (unexpectedBrowserErrors.length > 0) process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({ phase, weaponId, browserErrors }, null, 2));
  throw error;
} finally {
  await page
    .evaluate(() => {
      const arena = globalThis.ddGame?.scene?.getScene("arena");
      if (arena?.input?.activePointer) arena.input.activePointer.rightButtonDown = () => false;
      if (globalThis.__ddPistolInputTimer) window.clearInterval(globalThis.__ddPistolInputTimer);
    })
    .catch(() => undefined);
  await context.close();
  await browser.close();
}
