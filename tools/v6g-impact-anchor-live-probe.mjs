import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const baseURL = process.env.DD_E2E_BASE_URL ?? "http://localhost:5180";
const evidenceRoot = path.resolve("docs/owner-notes-audit-v6-evidence");
const cases = [
  ["wendigo", "x2-wendigo-claws"],
  ["revenant", "x2-revenant-knuckle"],
  ["riftcaller", "x2-riftcaller-naginata"],
  ["seraph", "x2-seraph-s-knuckle-reliquary"],
  ["dustreaper", "x2-dustreaper-zweihander"],
];

await mkdir(evidenceRoot, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 640, height: 360 } });
const results = [];

for (const [label, weaponId] of cases) {
  const page = await context.newPage();
  const browserErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(`[console] ${message.text()}`);
  });
  page.on("pageerror", (error) =>
    browserErrors.push(`[pageerror] ${error.stack ?? error.message}`),
  );
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
        return room?.state?.mode === "training" && self?.weapon === wanted;
      },
      weaponId,
      { timeout: 30_000 },
    );
    const canvas = page.locator("#game-root canvas");
    await canvas.click({ position: { x: 320, y: 180 } });
    await page.mouse.move(530, 150);
    const setup = await page.evaluate((wanted) => {
      window.focus();
      window.dispatchEvent(new Event("focus"));
      const arena = globalThis.ddGame.scene.getScene("arena");
      if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend(arena.time.now);
      arena.verbs?.releaseInputLatchIf?.(true);
      arena.game.hasFocus = true;
      globalThis.__ddV6GAnchorCapture = true;
      globalThis.__ddV6GAnchorEvents = [];
      const room = arena.room;
      const self = room.state.players.get(room.sessionId);
      const target = arena.currentBeamAim();
      // `sendAttack` deliberately shares the RMB-held guard used by the real input loop. The probe calls
      // that method directly, so make the held state explicit instead of relying on a synthetic click whose
      // button has already been released by the time this evaluation runs.
      arena.input.activePointer.rightButtonDown = () => true;
      if (wanted === "x2-seraph-s-knuckle-reliquary") {
        globalThis.__ddV6GInputTimer = window.setInterval(
          () => arena.stepNetInput?.(50, false, false, 0, 0),
          50,
        );
      } else {
        arena.localAtkCd = 0;
        arena.sendAttack();
        arena.input.activePointer.rightButtonDown = () => false;
      }
      const beamCoordinates = wanted === "x2-seraph-s-knuckle-reliquary";
      return {
        actor: {
          x: self.x,
          y: !beamCoordinates && arena.belt ? arena.beltY(self.y) : self.y,
        },
        target: {
          x: target.targetX,
          y: !beamCoordinates && arena.belt ? arena.beltY(target.targetY) : target.targetY,
        },
      };
    }, weaponId);

    await page.waitForFunction(
      ({ wanted, probeLabel }) => {
        const events = globalThis.__ddV6GAnchorEvents ?? [];
        if (probeLabel === "seraph")
          return events.some(
            (event) => event.kind === "beam-cursor-endpoint" && event.weaponId === wanted,
          );
        if (probeLabel === "dustreaper")
          return events.some(
            (event) => event.kind === "weapon-effect-recipe" && event.weaponId === wanted,
          );
        return events.some(
          (event) => event.kind === "weapon-vfx-suite" && event.weaponId === wanted,
        );
      },
      { wanted: weaponId, probeLabel: label },
      { timeout: 20_000 },
    );
    await page.waitForTimeout(label === "seraph" ? 350 : 500);
    const events = await page.evaluate(
      (wanted) =>
        (globalThis.__ddV6GAnchorEvents ?? []).filter((event) => event.weaponId === wanted),
      weaponId,
    );
    const screenshot = path.join(evidenceRoot, `v6g1-${label}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });

    const targetEvents = events.filter((event) => event.anchor === "target");
    const latestTarget = targetEvents.at(-1);
    const endpointDelta = latestTarget
      ? Math.hypot(latestTarget.x - latestTarget.targetX, latestTarget.y - latestTarget.targetY)
      : null;
    const actorDelta = latestTarget
      ? Math.hypot(latestTarget.x - setup.actor.x, latestTarget.y - setup.actor.y)
      : null;
    const layerIds = events.flatMap((event) => event.layerIds ?? []);
    const assertions = {
      targetAnchor:
        label === "riftcaller"
          ? !layerIds.includes("shockwave-ring") && !layerIds.includes("sigil-ring")
          : !!latestTarget,
      cursorDeltaOk: label === "riftcaller" ? true : endpointDelta !== null && endpointDelta <= 3,
      awayFromActor: label === "riftcaller" ? true : actorDelta !== null && actorDelta >= 30,
      dustreaperFlame:
        label !== "dustreaper" ||
        events.some((event) => event.pack === "fire-wisp" && event.count === 150),
      riftcallerAuraDeleted:
        label !== "riftcaller" ||
        (!layerIds.includes("shockwave-ring") && !layerIds.includes("sigil-ring")),
    };
    const unexpectedBrowserErrors = browserErrors.filter(
      (message) => !message.includes("Texture key already in use: dd-sprites"),
    );
    const result = {
      label,
      weaponId,
      baseURL,
      capturedAt: new Date().toISOString(),
      setup,
      endpointDelta,
      actorDelta,
      events,
      assertions,
      browserErrors,
      unexpectedBrowserErrors,
      screenshot: path.relative(process.cwd(), screenshot),
    };
    await writeFile(
      path.join(evidenceRoot, `v6g1-${label}.json`),
      `${JSON.stringify(result, null, 2)}\n`,
    );
    results.push(result);
    if (unexpectedBrowserErrors.length || Object.values(assertions).includes(false))
      process.exitCode = 1;
  } finally {
    await page
      .evaluate(() => {
        globalThis.__ddV6GAnchorCapture = false;
        const arena = globalThis.ddGame?.scene?.getScene("arena");
        if (arena?.input?.activePointer) arena.input.activePointer.rightButtonDown = () => false;
        if (globalThis.__ddV6GInputTimer) window.clearInterval(globalThis.__ddV6GInputTimer);
      })
      .catch(() => undefined);
    await page.close();
  }
}

await writeFile(
  path.join(evidenceRoot, "v6g1-live-summary.json"),
  `${JSON.stringify({ baseURL, capturedAt: new Date().toISOString(), results }, null, 2)}\n`,
);
console.log(
  JSON.stringify(
    results.map(({ label, weaponId, endpointDelta, actorDelta, assertions }) => ({
      label,
      weaponId,
      endpointDelta,
      actorDelta,
      assertions,
    })),
    null,
    2,
  ),
);
await context.close();
await browser.close();
