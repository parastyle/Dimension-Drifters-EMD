import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const phase = process.argv[2] ?? "before";
const weaponId = process.argv[3] ?? "x2-voltcaster-machine-pistol";
const baseURL = process.env.DD_E2E_BASE_URL ?? "http://localhost:5180";
const evidenceRoot = path.resolve("docs/owner-notes-audit-v2-evidence");
const jsonPath = path.join(evidenceRoot, `beam-anchor-${phase}.json`);
const screenshotPath = path.join(evidenceRoot, `beam-anchor-${phase}.png`);
const sampleTarget = 10;

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

  const canvas = page.locator("#game-root canvas");
  await canvas.click({ position: { x: 320, y: 180 } });
  await page.mouse.move(555, 180);
  await page.evaluate(() => {
    window.focus();
    window.dispatchEvent(new Event("focus"));
    const arena = globalThis.ddGame.scene.getScene("arena");
    if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend(arena.time.now);
    arena.verbs?.releaseInputLatchIf?.(true);
    arena.game.hasFocus = true;
    arena.input.activePointer.rightButtonDown = () => true;
    globalThis.__ddBeamInputTimer = window.setInterval(
      () => arena.stepNetInput?.(50, false, false, 1, 0),
      50,
    );
  });
  await page.keyboard.down("d");

  await page.waitForFunction(
    () => {
      const arena = globalThis.ddGame?.scene?.getScene("arena");
      const room = arena?.room;
      const row = room?.sessionId ? room.state?.beams?.get(room.sessionId) : undefined;
      return row?.phase === 2 && row.effectiveLength > 1;
    },
    undefined,
    { timeout: 20_000 },
  );

  await page.evaluate((target) => {
    globalThis.__ddBeamAnchorSamples = [];
    globalThis.__ddBeamAnchorSampling = true;
    const sampleFrame = () => {
      if (!globalThis.__ddBeamAnchorSampling) return;
      const arena = globalThis.ddGame?.scene?.getScene("arena");
      const room = arena?.room;
      const sessionId = room?.sessionId;
      const rig = sessionId ? arena.blobs?.get(sessionId) : undefined;
      const weapon = rig?.weapons?.[0];
      const row = sessionId ? room.state?.beams?.get(sessionId) : undefined;
      const renderer = arena?.beamRenderer;
      const entry = renderer?.entries?.find(
        (candidate) => candidate.key && candidate.ownerId === sessionId && candidate.body?.visible,
      );
      if (rig && weapon && row?.phase === 2 && renderer?.drawPose && entry) {
        const image = weapon.img;
        const localTipDistance = image.width * Math.abs(image.scaleX) * (1 - image.originX);
        const localMuzzleX = image.x + Math.cos(weapon.semanticRotation) * localTipDistance;
        const localMuzzleY = image.y + Math.sin(weapon.semanticRotation) * localTipDistance;
        const muzzle = rig.root
          .getWorldTransformMatrix()
          .transformPoint(localMuzzleX, localMuzzleY);
        const bodyPoint = entry.body.points?.[0];
        const ropeOrigin = bodyPoint
          ? {
              x: entry.body.x + bodyPoint.x * entry.body.scaleX,
              y: entry.body.y + bodyPoint.y * entry.body.scaleY,
            }
          : { x: Number.NaN, y: Number.NaN };
        const poseOrigin = { x: renderer.drawPose.originX, y: renderer.drawPose.originY };
        globalThis.__ddBeamAnchorSamples.push({
          atMs: performance.now(),
          player: { x: rig.root.x, y: rig.root.y },
          muzzle: { x: muzzle.x, y: muzzle.y },
          ropeOrigin,
          poseOrigin,
          authoritativeOrigin: { x: row.originX, y: row.originY },
          ropeMuzzleDelta: Math.hypot(ropeOrigin.x - muzzle.x, ropeOrigin.y - muzzle.y),
          poseMuzzleDelta: Math.hypot(poseOrigin.x - muzzle.x, poseOrigin.y - muzzle.y),
          authorityMuzzleDelta: Math.hypot(row.originX - muzzle.x, row.originY - muzzle.y),
          weapon: {
            x: image.x,
            y: image.y,
            rotation: image.rotation,
            semanticRotation: weapon.semanticRotation,
            scaleX: image.scaleX,
            scaleY: image.scaleY,
            originX: image.originX,
            originY: image.originY,
            width: image.width,
            height: image.height,
          },
        });
      }
      if (globalThis.__ddBeamAnchorSamples.length < target) requestAnimationFrame(sampleFrame);
      else globalThis.__ddBeamAnchorSampling = false;
    };
    requestAnimationFrame(sampleFrame);
  }, sampleTarget);

  await page.waitForFunction(
    (target) => globalThis.__ddBeamAnchorSamples?.length >= target,
    sampleTarget,
    { timeout: 15_000 },
  );
  await page.screenshot({ path: screenshotPath, fullPage: true });
  const frames = await page.evaluate(() => globalThis.__ddBeamAnchorSamples ?? []);
  const values = frames.map((frame) => frame.ropeMuzzleDelta).sort((a, b) => a - b);
  const unexpectedBrowserErrors = browserErrors.filter(
    (message) => !message.includes("Texture key already in use: dd-sprites"),
  );
  const summary = {
    phase,
    weaponId,
    baseURL,
    capturedAt: new Date().toISOString(),
    frameCount: frames.length,
    playerTravel: frames.length
      ? Math.hypot(
          frames.at(-1).player.x - frames[0].player.x,
          frames.at(-1).player.y - frames[0].player.y,
        )
      : 0,
    ropeMuzzleDeltaPx: {
      min: values[0] ?? null,
      median: values[Math.floor(values.length / 2)] ?? null,
      p95: values[Math.min(values.length - 1, Math.floor(values.length * 0.95))] ?? null,
      max: values.at(-1) ?? null,
      mean: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
    },
    browserErrors,
    unexpectedBrowserErrors,
    screenshot: path.relative(process.cwd(), screenshotPath),
  };
  await writeFile(jsonPath, `${JSON.stringify({ summary, frames }, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
  if (unexpectedBrowserErrors.length > 0) process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({ phase, weaponId, browserErrors }, null, 2));
  throw error;
} finally {
  await page.keyboard.up("d").catch(() => undefined);
  await page
    .evaluate(() => {
      globalThis.__ddBeamAnchorSampling = false;
      const arena = globalThis.ddGame?.scene?.getScene("arena");
      if (arena?.input?.activePointer) arena.input.activePointer.rightButtonDown = () => false;
      arena?.stepNetInput?.(50, false, false, 0, 0);
      if (globalThis.__ddBeamInputTimer) window.clearInterval(globalThis.__ddBeamInputTimer);
    })
    .catch(() => undefined);
  await context.close();
  await browser.close();
}
