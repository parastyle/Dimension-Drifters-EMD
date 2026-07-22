import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const baseURL = process.env.DD_E2E_BASE_URL ?? "http://localhost:5180";
const phase = process.env.V61_PHASE === "before" ? "before" : "after";
const scope = process.env.V61_SCOPE === "headsman" ? "headsman" : "all";
const evidenceRoot = path.resolve("docs/owner-notes-audit-v6-evidence/v61");
const genericRingLayers = ["shockwave-ring", "sigil-ring"];
const circleCases = [
  ["revenant-void", "x2-revenant-knuckle", "void"],
  ["voltfang-shock", "x2-voltfang-tachi", "shock"],
  ["headsman-holy", "x2-sanctified-headsman", "holy"],
];

await mkdir(evidenceRoot, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 960, height: 540 } });
const results = [];

async function waitForWeapon(page, weaponId, suffix = "") {
  await page.goto(`${baseURL}/?dev=weapon:${encodeURIComponent(weaponId)}${suffix}`, {
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
  await page.locator("#game-root canvas").click({ position: { x: 480, y: 270 } });
  await page.mouse.move(760, 230);
}

function unexpectedErrors(messages) {
  return messages.filter((message) => !message.includes("Texture key already in use: dd-sprites"));
}

for (const [label, weaponId, element] of scope === "headsman" ? [] : circleCases) {
  const explicitPaintedImpact = weaponId === "x2-revenant-knuckle";
  const page = await context.newPage();
  const browserErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(`[console] ${message.text()}`);
  });
  page.on("pageerror", (error) =>
    browserErrors.push(`[pageerror] ${error.stack ?? error.message}`),
  );
  try {
    await waitForWeapon(page, weaponId);
    const setup = await page.evaluate(
      ({ probePhase, ringLayers, expectedElement, expectsPaintedImpact, wanted }) => {
        window.focus();
        window.dispatchEvent(new Event("focus"));
        const arena = globalThis.ddGame.scene.getScene("arena");
        if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend(arena.time.now);
        arena.verbs?.releaseInputLatchIf?.(true);
        arena.game.hasFocus = true;
        arena.pointerOverInteractiveUi = false;
        globalThis.__ddV6GAnchorCapture = true;
        globalThis.__ddV6GAnchorEvents = [];
        globalThis.__ddV61Visual = {
          frozen: false,
          ringVisible: false,
          paintedVisible: false,
          sourceEventSeen: false,
          targetEventSeen: false,
          sourceFrames: 0,
          textureKeys: [],
        };

        const scan = () => {
          const state = globalThis.__ddV61Visual;
          if (!state || state.frozen) return;
          const ringSurface = arena.vfxPlayer?.pool?.find((surface) => {
            const ids = Object.keys(surface.S?.suite ?? {});
            const commandCount = surface.S?.gfxAdd?.commandBuffer?.length ?? 0;
            return ids.some((id) => ringLayers.includes(id)) && commandCount > 0;
          });
          const painted = arena.children.list.filter((child) => {
            const key = child.texture?.key;
            return (
              child.visible !== false &&
              (child.alpha ?? 1) > 0 &&
              typeof key === "string" &&
              key === `ptcl:${expectedElement}-splat`
            );
          });
          state.ringVisible ||= !!ringSurface;
          state.paintedVisible ||= painted.length > 0;
          state.textureKeys = painted.map((child) => child.texture.key);
          const events = (globalThis.__ddV6GAnchorEvents ?? []).filter(
            (event) => event.weaponId === wanted,
          );
          state.sourceEventSeen ||= events.some(
            (event) => event.kind === "weapon-vfx-suite" && event.anchor === "source",
          );
          state.targetEventSeen ||= events.some(
            (event) => event.kind === "weapon-vfx-suite" && event.anchor === "target",
          );
          if (state.sourceEventSeen) state.sourceFrames += 1;
          const found =
            probePhase === "before"
              ? state.ringVisible
              : expectsPaintedImpact
                ? state.paintedVisible
                : state.sourceFrames >= 6;
          if (found) {
            state.frozen = true;
            arena.scene.pause();
            return;
          }
          globalThis.__ddV61VisualRaf = window.requestAnimationFrame(scan);
        };
        scan();

        const room = arena.room;
        const self = room.state.players.get(room.sessionId);
        const target = arena.currentBeamAim();
        arena.input.activePointer.rightButtonDown = () => true;
        arena.localAtkCd = 0;
        arena.sendAttack();
        arena.input.activePointer.rightButtonDown = () => false;
        return {
          actor: { x: self.x, y: arena.belt ? arena.beltY(self.y) : self.y },
          target: {
            x: target.targetX,
            y: arena.belt ? arena.beltY(target.targetY) : target.targetY,
          },
        };
      },
      {
        probePhase: phase,
        ringLayers: genericRingLayers,
        expectedElement: element,
        expectsPaintedImpact: explicitPaintedImpact,
        wanted: weaponId,
      },
    );

    await page.waitForFunction(() => globalThis.__ddV61Visual?.frozen === true, undefined, {
      timeout: 15_000,
    });
    const screenshot = path.join(evidenceRoot, `cursor-circle-${phase}-${label}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    const captured = await page.evaluate(
      ({ wanted, ringLayers }) => {
        const events = (globalThis.__ddV6GAnchorEvents ?? []).filter(
          (event) => event.weaponId === wanted,
        );
        const layerIds = events.flatMap((event) => event.layerIds ?? []);
        return {
          visual: globalThis.__ddV61Visual,
          events,
          layerIds,
          genericLayers: layerIds.filter((id) => ringLayers.includes(id)),
        };
      },
      { wanted: weaponId, ringLayers: genericRingLayers },
    );
    const assertions =
      phase === "before"
        ? {
            genericRingRecipeReproduced: captured.genericLayers.length > 0,
            genericRingVisible: captured.visual?.ringVisible === true,
          }
        : {
            genericRingRecipeRemoved: captured.genericLayers.length === 0,
            genericRingInvisible: captured.visual?.ringVisible === false,
            sourceCompositionRetained: captured.visual?.sourceEventSeen === true,
            targetCompositionCorrect: explicitPaintedImpact
              ? captured.visual?.targetEventSeen === true &&
                captured.visual?.paintedVisible === true
              : captured.visual?.targetEventSeen === false &&
                captured.visual?.paintedVisible === false,
          };
    const result = {
      phase,
      label,
      weaponId,
      element,
      baseURL,
      capturedAt: new Date().toISOString(),
      setup,
      ...captured,
      assertions,
      browserErrors,
      unexpectedBrowserErrors: unexpectedErrors(browserErrors),
      screenshot: path.relative(process.cwd(), screenshot),
    };
    await writeFile(
      path.join(evidenceRoot, `cursor-circle-${phase}-${label}.json`),
      `${JSON.stringify(result, null, 2)}\n`,
    );
    results.push(result);
    if (result.unexpectedBrowserErrors.length || Object.values(assertions).includes(false))
      process.exitCode = 1;
  } finally {
    await page
      .evaluate(() => {
        globalThis.__ddV6GAnchorCapture = false;
        if (globalThis.__ddV61VisualRaf) window.cancelAnimationFrame(globalThis.__ddV61VisualRaf);
        const arena = globalThis.ddGame?.scene?.getScene("arena");
        if (arena?.input?.activePointer) arena.input.activePointer.rightButtonDown = () => false;
      })
      .catch(() => undefined);
    await page.close();
  }
}

{
  const page = await context.newPage();
  const browserErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(`[console] ${message.text()}`);
  });
  page.on("pageerror", (error) =>
    browserErrors.push(`[pageerror] ${error.stack ?? error.message}`),
  );
  try {
    await waitForWeapon(page, "x2-sanctified-headsman", "&proto=2");
    await page.evaluate(() => {
      const arena = globalThis.ddGame.scene.getScene("arena");
      if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend(arena.time.now);
      arena.verbs?.releaseInputLatchIf?.(true);
      arena.game.hasFocus = true;
      arena.pointerOverInteractiveUi = false;
      globalThis.__ddV61Headsman = { frozen: false, samples: [] };

      const scan = () => {
        const state = globalThis.__ddV61Headsman;
        if (!state || state.frozen) return;
        const room = arena.room;
        const rig = arena.blobs.get(room.sessionId);
        const tip = rig?.leadWeaponTipPose?.();
        const extension = arena.vfxPlayer?.pool
          ?.map((surface) => surface.headsmanExtension)
          .find(
            (candidate) =>
              candidate?.visible &&
              candidate.texture?.key === "headsman-proto:2" &&
              (candidate.alpha ?? 1) > 0,
          );
        if (tip && extension && tip.physicalBladeLength >= 80 && extension.displayWidth >= 200) {
          const ux = Math.cos(tip.angle);
          const uy = Math.sin(tip.angle);
          const dx = tip.x - extension.x;
          const dy = tip.y - extension.y;
          const signedRootOverlap = dx * ux + dy * uy;
          const lateralError = Math.abs(dx * uy - dy * ux);
          // Pale Procession's installed alpha begins at x=8 of 528. Count that transparent leading
          // margin when measuring the actual visible join, not merely the image object's origin.
          const opaqueInset = extension.displayWidth * (8 / 528);
          state.samples.push({
            angle: tip.angle,
            physicalBladeLength: tip.physicalBladeLength,
            extensionWidth: extension.displayWidth,
            signedRootOverlap,
            opaqueInset,
            visibleJoinOverlap: signedRootOverlap - opaqueInset,
            visibleGap: Math.max(0, opaqueInset - signedRootOverlap),
            lateralError,
            extensionDepth: extension.depth,
            weaponDepth: rig.root?.depth,
            layeredBelowWeapon: extension.depth < (rig.root?.depth ?? Number.NEGATIVE_INFINITY),
          });
          if (state.samples.length >= 3) {
            state.frozen = true;
            arena.scene.pause();
            return;
          }
        }
        globalThis.__ddV61HeadsmanRaf = window.requestAnimationFrame(scan);
      };
      scan();

      const fire = () => {
        arena.input.activePointer.rightButtonDown = () => true;
        arena.localAtkCd = 0;
        arena.sendAttack();
        arena.input.activePointer.rightButtonDown = () => false;
      };
      fire();
      globalThis.__ddV61HeadsmanAttackTimer = window.setInterval(fire, 900);
    });
    await page.waitForFunction(() => globalThis.__ddV61Headsman?.frozen === true, undefined, {
      timeout: 15_000,
    });
    const screenshot = path.join(evidenceRoot, `headsman-seam-${phase}-mid-swing.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    const capture = await page.evaluate(() => globalThis.__ddV61Headsman);
    const samples = capture?.samples ?? [];
    const minAngle = Math.min(...samples.map((sample) => sample.angle));
    const maxAngle = Math.max(...samples.map((sample) => sample.angle));
    const assertions =
      phase === "before"
        ? {
            physicalTipRootReproduced: samples.every(
              (sample) => Math.abs(sample.signedRootOverlap) <= 0.75,
            ),
            visibleJoinGapReproduced: samples.some((sample) => sample.visibleGap > 0.75),
          }
        : {
            paleProcessionVisible: samples.length >= 3,
            zeroVisibleJoinGap: samples.every((sample) => sample.visibleGap <= 0.5),
            outerBladeOverlap: samples.every((sample) => sample.visibleJoinOverlap > 4),
            alignedAcrossSwing: samples.every(
              (sample) => sample.lateralError <= sample.physicalBladeLength * 0.05,
            ),
            layeredBelowPhysicalWeapon: samples.every((sample) => sample.layeredBelowWeapon),
            sampledArc: maxAngle - minAngle > 0.02,
          };
    const result = {
      label: "headsman-seam",
      phase,
      weaponId: "x2-sanctified-headsman",
      treatment: "Pale Procession",
      baseURL,
      capturedAt: new Date().toISOString(),
      samples,
      angleSpan: maxAngle - minAngle,
      assertions,
      browserErrors,
      unexpectedBrowserErrors: unexpectedErrors(browserErrors),
      screenshot: path.relative(process.cwd(), screenshot),
    };
    await writeFile(
      path.join(evidenceRoot, `headsman-seam-${phase}.json`),
      `${JSON.stringify(result, null, 2)}\n`,
    );
    results.push(result);
    if (result.unexpectedBrowserErrors.length || Object.values(assertions).includes(false))
      process.exitCode = 1;
  } finally {
    await page
      .evaluate(() => {
        if (globalThis.__ddV61HeadsmanRaf)
          window.cancelAnimationFrame(globalThis.__ddV61HeadsmanRaf);
        if (globalThis.__ddV61HeadsmanAttackTimer)
          window.clearInterval(globalThis.__ddV61HeadsmanAttackTimer);
        const arena = globalThis.ddGame?.scene?.getScene("arena");
        if (arena?.input?.activePointer) arena.input.activePointer.rightButtonDown = () => false;
      })
      .catch(() => undefined);
    await page.close();
  }
}

await writeFile(
  path.join(evidenceRoot, `v61-live-${phase}-summary.json`),
  `${JSON.stringify({ phase, baseURL, capturedAt: new Date().toISOString(), results }, null, 2)}\n`,
);
console.log(
  JSON.stringify(
    results.map(({ label, weaponId, assertions, screenshot }) => ({
      label,
      weaponId,
      assertions,
      screenshot,
    })),
    null,
    2,
  ),
);
await context.close();
await browser.close();
