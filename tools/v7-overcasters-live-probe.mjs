import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const phase = process.argv[2] ?? "before";
const weaponId = process.argv[3] ?? "x2-galvanic-overcasters";
const baseURL = process.env.DD_E2E_BASE_URL ?? "http://localhost:5180";
const evidenceRoot = path.resolve("docs/owner-notes-audit-v7-evidence/overcasters");
const jsonPath = path.join(evidenceRoot, `burst-origin-${phase}.json`);
const screenshotPath = path.join(evidenceRoot, `burst-origin-${phase}.png`);

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
  await page.waitForTimeout(500);
  const canvas = page.locator("#game-root canvas");
  await canvas.click({ position: { x: 320, y: 180 } });
  await page.mouse.move(555, 90);

  await page.evaluate((wanted) => {
    window.focus();
    window.dispatchEvent(new Event("focus"));
    const arena = globalThis.ddGame.scene.getScene("arena");
    if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend(arena.time.now);
    arena.verbs?.releaseInputLatchIf?.(true);
    arena.game.hasFocus = true;
    globalThis.__ddBurstOriginCapture = {
      wanted,
      frames: [],
      rounds: [],
      seen: new Set(),
      sampling: true,
    };
    const sample = () => {
      const capture = globalThis.__ddBurstOriginCapture;
      if (!capture?.sampling) return;
      const liveArena = globalThis.ddGame?.scene?.getScene("arena");
      const room = liveArena?.room;
      const ownerId = room?.sessionId;
      const player = ownerId ? room.state?.players?.get(ownerId) : undefined;
      const rig = ownerId ? liveArena.blobs?.get(ownerId) : undefined;
      if (room && player && rig) {
        const muzzle = { x: rig.x, y: rig.y };
        rig.writeWeaponMuzzle?.(0, muzzle);
        const frame = {
          atMs: performance.now(),
          tick: room.state.tick,
          character: { x: rig.x, y: rig.y },
          authoritativeCharacter: { x: player.x, y: player.y },
          muzzle: { x: muzzle.x, y: muzzle.y },
          attackSeq: player.attackSeq,
        };
        capture.frames.push(frame);
        room.state.projectiles.forEach((row, id) => {
          if (
            capture.seen.has(id) ||
            row.sourcePlayerId !== ownerId ||
            row.sourceWeaponId !== capture.wanted
          )
            return;
          capture.seen.add(id);
          const ageTicks = (room.state.tick - row.bornTick) >>> 0;
          const integratedSteps = ageTicks + 1;
          const origin = {
            x: row.x - row.vx * integratedSteps * 0.05,
            y: row.y - row.vy * integratedSteps * 0.05,
          };
          const rendered = liveArena.projectiles?.get(id);
          const renderedSpawnOrigin = rendered
            ? {
                x: rendered.getData?.("spawnOriginX"),
                y: rendered.getData?.("spawnOriginY"),
              }
            : null;
          const renderedSpawnMuzzle = rendered
            ? {
                x: rendered.getData?.("spawnMuzzleX"),
                y: rendered.getData?.("spawnMuzzleY"),
              }
            : null;
          capture.rounds.push({
            id,
            detectedAtMs: performance.now(),
            detectedTick: room.state.tick,
            bornTick: row.bornTick,
            attackSeq: player.attackSeq,
            ageTicks,
            integratedSteps,
            character: { x: rig.x, y: rig.y },
            authoritativeCharacter: { x: player.x, y: player.y },
            muzzle: { x: muzzle.x, y: muzzle.y },
            projectile: { x: row.x, y: row.y, vx: row.vx, vy: row.vy },
            renderedProjectile: rendered ? { x: rendered.x, y: rendered.y } : null,
            renderedSpawnOrigin,
            renderedSpawnMuzzle,
            renderedSpawnOriginMuzzleDelta:
              renderedSpawnOrigin &&
              renderedSpawnMuzzle &&
              Number.isFinite(renderedSpawnOrigin.x) &&
              Number.isFinite(renderedSpawnOrigin.y) &&
              Number.isFinite(renderedSpawnMuzzle.x) &&
              Number.isFinite(renderedSpawnMuzzle.y)
                ? Math.hypot(
                    renderedSpawnOrigin.x - renderedSpawnMuzzle.x,
                    renderedSpawnOrigin.y - renderedSpawnMuzzle.y,
                  )
                : null,
            origin,
            originMuzzleDelta: Math.hypot(origin.x - muzzle.x, origin.y - muzzle.y),
          });
        });
      }
      if ((capture?.rounds?.length ?? 0) < 12) requestAnimationFrame(sample);
      else capture.sampling = false;
    };
    requestAnimationFrame(sample);
    arena.input.activePointer.rightButtonDown = () => true;
    globalThis.__ddBurstOriginInputTimer = window.setInterval(
      () => arena.stepNetInput?.(50, false, false, 1, 0),
      50,
    );
  }, weaponId);
  await page.keyboard.down("d");

  await page.waitForFunction(
    () => globalThis.__ddBurstOriginCapture?.rounds?.length >= 12,
    undefined,
    { timeout: 20_000 },
  );
  await page.keyboard.up("d");
  await page.evaluate(() => {
    const arena = globalThis.ddGame?.scene?.getScene("arena");
    if (arena?.input?.activePointer) arena.input.activePointer.rightButtonDown = () => false;
    arena?.stepNetInput?.(50, false, false, 0, 0);
    if (globalThis.__ddBurstOriginInputTimer)
      window.clearInterval(globalThis.__ddBurstOriginInputTimer);
    globalThis.__ddBurstOriginInputTimer = undefined;
    if (globalThis.__ddBurstOriginCapture) globalThis.__ddBurstOriginCapture.sampling = false;
  });
  await page.screenshot({ path: screenshotPath, fullPage: true });
  const capture = await page.evaluate(() => {
    const source = globalThis.__ddBurstOriginCapture;
    return { frames: source?.frames ?? [], rounds: source?.rounds ?? [] };
  });

  const rounds = [...capture.rounds].sort(
    (a, b) => a.bornTick - b.bornTick || a.id.localeCompare(b.id),
  );
  let burstIndex = -1;
  let roundIndex = 0;
  let previousBornTick;
  for (const round of rounds) {
    if (previousBornTick === undefined || round.bornTick - previousBornTick > 1) {
      burstIndex++;
      roundIndex = 0;
    }
    round.burstIndex = burstIndex;
    round.roundIndex = roundIndex++;
    const bornFrames = capture.frames.filter((frame) => frame.tick === round.bornTick);
    const bornFrame = bornFrames.at(-1);
    round.bornFrame = bornFrame ?? null;
    round.bornFrameOriginMuzzleDelta = bornFrame
      ? Math.hypot(round.origin.x - bornFrame.muzzle.x, round.origin.y - bornFrame.muzzle.y)
      : null;
    previousBornTick = round.bornTick;
  }
  const deltas = rounds
    .map((round) => round.bornFrameOriginMuzzleDelta ?? round.originMuzzleDelta)
    .sort((a, b) => a - b);
  const renderedDeltas = rounds
    .map((round) => round.renderedSpawnOriginMuzzleDelta)
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
  const characterTravel = capture.frames.length
    ? Math.hypot(
        capture.frames.at(-1).character.x - capture.frames[0].character.x,
        capture.frames.at(-1).character.y - capture.frames[0].character.y,
      )
    : 0;
  const unexpectedBrowserErrors = browserErrors.filter(
    (message) => !message.includes("Texture key already in use: dd-sprites"),
  );
  const summary = {
    phase,
    weaponId,
    baseURL,
    capturedAt: new Date().toISOString(),
    frameCount: capture.frames.length,
    roundCount: rounds.length,
    burstCount: burstIndex + 1,
    characterTravel,
    originMuzzleDeltaPx: {
      min: deltas[0] ?? null,
      median: deltas[Math.floor(deltas.length / 2)] ?? null,
      p95: deltas[Math.min(deltas.length - 1, Math.floor(deltas.length * 0.95))] ?? null,
      max: deltas.at(-1) ?? null,
      perRound: rounds.map((round) => ({
        burstIndex: round.burstIndex,
        roundIndex: round.roundIndex,
        bornTick: round.bornTick,
        delta: round.bornFrameOriginMuzzleDelta ?? round.originMuzzleDelta,
      })),
    },
    renderedSpawnOriginMuzzleDeltaPx: {
      count: renderedDeltas.length,
      max: renderedDeltas.at(-1) ?? null,
      perRound: rounds.map((round) => ({
        burstIndex: round.burstIndex,
        roundIndex: round.roundIndex,
        bornTick: round.bornTick,
        delta: round.renderedSpawnOriginMuzzleDelta,
      })),
    },
    browserErrors,
    unexpectedBrowserErrors,
    screenshot: path.relative(process.cwd(), screenshotPath),
  };
  await writeFile(
    jsonPath,
    `${JSON.stringify({ summary, rounds, frames: capture.frames }, null, 2)}\n`,
  );
  console.log(JSON.stringify(summary, null, 2));
  if (unexpectedBrowserErrors.length > 0 || rounds.length < 12 || characterTravel < 20)
    process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({ phase, weaponId, browserErrors }, null, 2));
  throw error;
} finally {
  await page.keyboard.up("d").catch(() => undefined);
  await page
    .evaluate(() => {
      const arena = globalThis.ddGame?.scene?.getScene("arena");
      if (arena?.input?.activePointer) arena.input.activePointer.rightButtonDown = () => false;
      if (globalThis.__ddBurstOriginInputTimer)
        window.clearInterval(globalThis.__ddBurstOriginInputTimer);
      if (globalThis.__ddBurstOriginCapture) globalThis.__ddBurstOriginCapture.sampling = false;
    })
    .catch(() => undefined);
  await context.close();
  await browser.close();
}
