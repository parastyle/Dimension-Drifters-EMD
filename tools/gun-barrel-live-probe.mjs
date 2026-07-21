import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const phase = process.argv[2] ?? "after";
const weaponId = process.argv[3] ?? "x2-coyote-stinger";
const baseURL = process.env.DD_E2E_BASE_URL ?? "http://localhost:5180";
const expectedOffsets = {
  "x2-coyote-stinger": { forward: -1, lateral: -7 },
  "x2-hollowpoint-hex": { forward: -1, lateral: -5 },
  "x2-gravedog-auto-rifle": { forward: -2, lateral: -14 },
  "x2-stormspur-coil-carbine": { forward: -2, lateral: -10 },
  "x2-brimstone-gallows-rifle": { forward: -2, lateral: -17 },
  "x2-hellbore-gatling": { forward: -2, lateral: -12 },
};
const expectedOffset = expectedOffsets[weaponId] ?? { forward: 0, lateral: 0 };
const evidenceRoot = path.resolve("docs/owner-notes-audit-v5-evidence");
const jsonPath = path.join(evidenceRoot, `gun-barrel-${phase}-${weaponId}.json`);
const screenshotPath = path.join(evidenceRoot, `gun-barrel-${phase}-${weaponId}.png`);

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
      const arena = globalThis.ddGame?.scene?.getScene("arena");
      const room = arena?.room;
      const self = room?.sessionId ? room.state?.players?.get(room.sessionId) : undefined;
      const rig = room?.sessionId ? arena.blobs?.get(room.sessionId) : undefined;
      return (
        room?.state?.mode === "training" &&
        self?.weapon === wanted &&
        rig?.heldWeaponDef?.(0)?.id === wanted &&
        rig?.weapons?.length > 0
      );
    },
    weaponId,
    { timeout: 30_000 },
  );
  await page.waitForTimeout(800);
  await page.locator("#game-root canvas").click({ position: { x: 320, y: 180 } });
  await page.mouse.move(555, 180);
  const start = await page.evaluate(() => {
    window.focus();
    window.dispatchEvent(new Event("focus"));
    const arena = globalThis.ddGame.scene.getScene("arena");
    if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend(arena.time.now);
    arena.verbs?.releaseInputLatchIf?.(true);
    arena.game.hasFocus = true;
    arena.input.activePointer.rightButtonDown = () => true;
    const room = arena.room;
    const player = room.state.players.get(room.sessionId);
    const rig = arena.blobs.get(room.sessionId);
    const image = rig.weapons[0].img;
    const rawMuzzleReach = image.width * Math.abs(image.scaleX) * (1 - image.originX);
    globalThis.__ddGunBarrelTimer = window.setInterval(
      () => arena.stepNetInput?.(50, false, false, 0, 0),
      50,
    );
    return {
      attackSeq: player.attackSeq,
      tick: room.state.tick,
      player: { x: player.x, y: player.y },
      rawMuzzleReach,
    };
  });
  await page.waitForFunction(
    (before) => {
      const arena = globalThis.ddGame?.scene?.getScene("arena");
      const room = arena?.room;
      const self = room?.sessionId ? room.state?.players?.get(room.sessionId) : undefined;
      return (self?.attackSeq ?? before) > before;
    },
    start.attackSeq,
    { timeout: 10_000 },
  );
  await page.evaluate(() => {
    const arena = globalThis.ddGame.scene.getScene("arena");
    arena.input.activePointer.rightButtonDown = () => false;
    arena.stepNetInput?.(50, false, false, 0, 0);
    if (globalThis.__ddGunBarrelTimer) window.clearInterval(globalThis.__ddGunBarrelTimer);
  });
  await page.waitForFunction(
    (wanted) => {
      const arena = globalThis.ddGame?.scene?.getScene("arena");
      let found = false;
      arena?.room?.state?.projectiles?.forEach?.((row) => {
        if (row.sourcePlayerId === arena.room.sessionId && row.sourceWeaponId === wanted)
          found = true;
      });
      return found;
    },
    weaponId,
    { timeout: 10_000 },
  );
  const live = await page.evaluate(
    ({ wanted, startState, offset }) => {
      const arena = globalThis.ddGame.scene.getScene("arena");
      const room = arena.room;
      const rows = [];
      room.state.projectiles.forEach((row) => {
        if (row.sourcePlayerId === room.sessionId && row.sourceWeaponId === wanted)
          rows.push({
            id: row.id,
            x: row.x,
            y: row.y,
            vx: row.vx,
            vy: row.vy,
            bornTick: row.bornTick,
          });
      });
      rows.sort((a, b) => a.bornTick - b.bornTick || a.id.localeCompare(b.id));
      const row = rows[0];
      if (!row) throw new Error("accepted gun shot has no authoritative projectile row");
      const ageTicks = (room.state.tick - row.bornTick) >>> 0;
      // The server advances a newly inserted row on its born tick, then once for each elapsed tick.
      const integratedSteps = ageTicks + 1;
      const recoveredOrigin = {
        x: row.x - row.vx * integratedSteps * 0.05,
        y: row.y - row.vy * integratedSteps * 0.05,
      };
      const paintedMuzzle = {
        x: startState.player.x + 12 + startState.rawMuzzleReach + offset.forward,
        y: startState.player.y + offset.lateral,
      };
      return {
        currentTick: room.state.tick,
        ageTicks,
        integratedSteps,
        row,
        recoveredOrigin,
        paintedMuzzle,
        originDeltaPx: Math.hypot(
          recoveredOrigin.x - paintedMuzzle.x,
          recoveredOrigin.y - paintedMuzzle.y,
        ),
        shotAngleRad: Math.atan2(row.vy, row.vx),
      };
    },
    { wanted: weaponId, startState: start, offset: expectedOffset },
  );
  await page.screenshot({ path: screenshotPath, fullPage: true });
  const unexpectedBrowserErrors = browserErrors.filter(
    (message) => !message.includes("Texture key already in use: dd-sprites"),
  );
  const summary = {
    phase,
    weaponId,
    baseURL,
    capturedAt: new Date().toISOString(),
    expectedOffset,
    originDeltaPx: live.originDeltaPx,
    shotAngleRad: live.shotAngleRad,
    browserErrors,
    unexpectedBrowserErrors,
    screenshot: path.relative(process.cwd(), screenshotPath),
  };
  await writeFile(jsonPath, `${JSON.stringify({ summary, start, live }, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
  if (unexpectedBrowserErrors.length > 0 || live.originDeltaPx > 3) process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({ phase, weaponId, browserErrors }, null, 2));
  throw error;
} finally {
  await page
    .evaluate(() => {
      const arena = globalThis.ddGame?.scene?.getScene("arena");
      if (arena?.input?.activePointer) arena.input.activePointer.rightButtonDown = () => false;
      if (globalThis.__ddGunBarrelTimer) window.clearInterval(globalThis.__ddGunBarrelTimer);
    })
    .catch(() => undefined);
  await context.close();
  await browser.close();
}
