import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const phaseArg = process.argv.find((arg) => arg.startsWith("--phase="));
const phase = phaseArg?.slice("--phase=".length);
if (phase !== "before" && phase !== "after") {
  throw new Error("Usage: node tools/v63-anchor-correction-live-probe.mjs --phase=before|after");
}

const baseURL = process.env.DD_E2E_BASE_URL ?? "http://localhost:5180";
const evidenceRoot = path.resolve("docs/owner-notes-audit-v6-evidence/v63");
const cases = [
  ["driftblade", "driftblade"],
  ["voltfang", "x2-voltfang-tachi"],
  ["headsman", "x2-sanctified-headsman"],
  ["drowned-anchor", "x-sword-anchor"],
  ["gravechain", "x2-gravechain-scythe"],
  ["cinderbrand-cleaver", "x2-cinderbrand-cleaver"],
];

/** Reconstruct the deleted generic target partition inside only this probe page. The live owner stack and
 * working tree remain on the corrected code; Vite's already-transformed module response is modified in-flight. */
async function installLegacyFallbackRoute(page) {
  await page.route("**/src/vfx/weapon-vfx-suite.ts*", async (route) => {
    const response = await route.fetch();
    let body = await response.text();
    const helper = `
function v63LegacyTargetFallback(element, hue, heavy, energy) {
  let target = {};
  if (heavy) target = { ...target,
    "cleave-flash": { on: true, params: { intensity: 0.85 } },
    "painted-impact": paintedImpact(element, 8, 0.78)
  };
  if (energy) target["impact-flash"] = { on: true, params: { intensity: 0.6 } };
  switch (element) {
    case "fire": return { ...target,
      "ember-rain": { on: true, params: { count: 14, color: hue } },
      "impact-flash": { on: true, params: { intensity: 0.6 } } };
    case "shock": return { ...target,
      "arc-bolt": { on: true, params: { color: hue } },
      "painted-impact": paintedImpact(element, 8, 0.78) };
    case "frost": return { ...target,
      "hit-spark": { on: true, params: { count: 16, color: hue } },
      "impact-flash": { on: true, params: { intensity: 0.5 } } };
    case "holy": return { ...target,
      "painted-impact": paintedImpact(element, 7, 0.78),
      "impact-flash": { on: true, params: { intensity: 0.65 } } };
    case "toxic": return { ...target,
      "ember-rain": { on: true, params: { count: 12, color: hue } },
      "hit-spark": { on: true, params: { count: 10, color: hue } } };
    case "void": return { ...target, "painted-impact": paintedImpact(element, 8, 0.84) };
    case "arcane": return { ...target,
      "painted-impact": paintedImpact(element, 7, 0.8),
      "arc-bolt": { on: true, params: { color: hue } } };
    default: return target;
  }
}
`;
    body = body.replace(
      "function explicitFallbackImpactSuite",
      `${helper}\nfunction explicitFallbackImpactSuite`,
    );
    body = body.replace(
      "return base;\n}",
      "return { ...base, ...v63LegacyTargetFallback(element, hue, heavy, energy) };\n}",
    );
    if (
      !body.includes("return { ...base, ...v63LegacyTargetFallback(element, hue, heavy, energy) };")
    ) {
      throw new Error("V6.3 before-route could not reconstruct the legacy fallback module");
    }
    await route.fulfill({ response, body });
  });
}

await mkdir(evidenceRoot, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 800, height: 450 } });
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
    if (phase === "before") await installLegacyFallbackRoute(page);
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
    await canvas.click({ position: { x: 400, y: 225 } });
    await page.mouse.move(650, 180);
    await page.evaluate(() => {
      window.focus();
      window.dispatchEvent(new Event("focus"));
      const arena = globalThis.ddGame.scene.getScene("arena");
      if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend(arena.time.now);
      arena.verbs?.releaseInputLatchIf?.(true);
      arena.game.hasFocus = true;
      globalThis.__ddV6GAnchorCapture = true;
      globalThis.__ddV6GAnchorEvents = [];
      arena.input.activePointer.rightButtonDown = () => true;
      arena.localAtkCd = 0;
      arena.sendAttack();
      arena.input.activePointer.rightButtonDown = () => false;
    });

    await page.waitForFunction(
      (wanted) =>
        (globalThis.__ddV6GAnchorEvents ?? []).some(
          (event) =>
            event.kind === "weapon-vfx-suite" &&
            event.weaponId === wanted &&
            event.anchor === "source",
        ),
      weaponId,
      { timeout: 20_000 },
    );
    await page.waitForTimeout(180);

    const events = await page.evaluate(
      (wanted) =>
        (globalThis.__ddV6GAnchorEvents ?? []).filter(
          (event) => event.kind === "weapon-vfx-suite" && event.weaponId === wanted,
        ),
      weaponId,
    );
    const sourceEvents = events.filter((event) => event.anchor === "source");
    const targetEvents = events.filter((event) => event.anchor === "target");
    const unexpectedBrowserErrors = browserErrors.filter(
      (message) => !message.includes("Texture key already in use: dd-sprites"),
    );
    const assertions = {
      sourceCompositionRetained: sourceEvents.length > 0,
      targetComposition: phase === "before" ? targetEvents.length > 0 : targetEvents.length === 0,
      browserClean: unexpectedBrowserErrors.length === 0,
    };
    const screenshot = path.join(evidenceRoot, `${phase}-${label}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    const result = {
      phase,
      label,
      weaponId,
      baseURL,
      moduleMode: phase === "before" ? "probe-only legacy fallback partition" : "corrected live",
      capturedAt: new Date().toISOString(),
      sourceLayerIds: sourceEvents.flatMap((event) => event.layerIds ?? []),
      targetLayerIds: targetEvents.flatMap((event) => event.layerIds ?? []),
      events,
      assertions,
      browserErrors,
      unexpectedBrowserErrors,
      screenshot: path.relative(process.cwd(), screenshot),
    };
    await writeFile(
      path.join(evidenceRoot, `${phase}-${label}.json`),
      `${JSON.stringify(result, null, 2)}\n`,
    );
    results.push(result);
    if (Object.values(assertions).includes(false)) process.exitCode = 1;
  } finally {
    await page
      .evaluate(() => {
        globalThis.__ddV6GAnchorCapture = false;
        const arena = globalThis.ddGame?.scene?.getScene("arena");
        if (arena?.input?.activePointer) arena.input.activePointer.rightButtonDown = () => false;
      })
      .catch(() => undefined);
    await page.close();
  }
}

await writeFile(
  path.join(evidenceRoot, `${phase}-summary.json`),
  `${JSON.stringify({ phase, baseURL, capturedAt: new Date().toISOString(), results }, null, 2)}\n`,
);
console.log(
  JSON.stringify(
    results.map(({ label, weaponId, sourceLayerIds, targetLayerIds, assertions, screenshot }) => ({
      label,
      weaponId,
      sourceLayerIds,
      targetLayerIds,
      assertions,
      screenshot,
    })),
    null,
    2,
  ),
);
await context.close();
await browser.close();
