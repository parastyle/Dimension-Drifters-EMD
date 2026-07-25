import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { runArenaSpec } from "../helpers/arena-harness.js";

test.use({
  userAgent: "DimensionDrifters-B50-LiveGate Electron",
  launchOptions: {
    args: [
      "--disable-features=CalculateNativeWinOcclusion",
      "--disable-renderer-backgrounding",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
    ],
  },
});

const CHARACTER_ID = "proto-cowboy-hidden-face";
const ORRERY_ID = "x2-hexbinder-s-iron-orrery";
const EMBERLEAF_ID = "x2-emberleaf-chapbook";
const VERDIGRIS_ID = "x2-verdigris-grand-grimoire";
const CINDERQUILL_ID = "x2-cinderquill-almanac";
const FACINGS = ["right", "left"] as const;
const FORBIDDEN_PORTS = new Set([5180, 2567]);
const EVIDENCE_DIR = path.resolve(
  import.meta.dirname,
  "../../docs/owner-notes-audit-v12-evidence/b50-caster-vfx",
);

type Facing = (typeof FACINGS)[number];

function facingSign(facing: Facing): 1 | -1 {
  return facing === "right" ? 1 : -1;
}

function evidencePath(file: string): string {
  return path.relative(process.cwd(), file).replaceAll("\\", "/");
}

async function dataUrlScreenshot(dataUrl: string, fileName: string): Promise<string> {
  const file = path.join(EVIDENCE_DIR, fileName);
  await writeFile(file, Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ""), "base64"));
  return evidencePath(file);
}

async function bootPrivateArena(
  page: Page,
  baseURL: string,
): Promise<{ clientPort: number; gamePort: number }> {
  await page.goto(`${baseURL}/?dev=char:${encodeURIComponent(CHARACTER_ID)}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.locator("#game-root canvas")).toBeVisible();
  await expect
    .poll(
      () =>
        page
          .evaluate(() => {
            const game = (globalThis as unknown as { ddGame?: any }).ddGame;
            if (!game?.scene.isActive("arena")) return null;
            const arena = game.scene.getScene("arena");
            const self = arena.room?.state?.players?.get(arena.room.sessionId);
            return {
              mode: arena.room?.state?.mode,
              character: self?.character,
            };
          })
          .catch(() => null),
      { message: "B50 private arena should become live", timeout: 30_000 },
    )
    .toMatchObject({ mode: "training", character: CHARACTER_ID });
  await page.locator("#game-root canvas").click({ position: { x: 500, y: 300 } });
  await page.evaluate(() => {
    const arena = (globalThis as unknown as { ddGame: any }).ddGame.scene.getScene("arena");
    if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend?.(arena.time.now);
    arena.verbs?.releaseInputLatchIf?.(true);
    arena.game.hasFocus = true;
    arena.pointerOverInteractiveUi = false;
    arena.input.activePointer.rightButtonDown = () => false;
    arena.cameras.main.setZoom(1.1);
  });
  return {
    clientPort: Number(new URL(baseURL).port),
    gamePort: Number(new URL(page.url()).searchParams.get("port")),
  };
}

async function equip(page: Page, weaponId: string): Promise<void> {
  await page.evaluate(
    ({ weapon, character }) => {
      const arena = (globalThis as unknown as { ddGame: any }).ddGame.scene.getScene("arena");
      arena.input.activePointer.rightButtonDown = () => false;
      arena.room.send("devEquip", { weapon, character });
    },
    { weapon: weaponId, character: CHARACTER_ID },
  );
  await expect
    .poll(
      () =>
        page.evaluate((wanted) => {
          const arena = (globalThis as unknown as { ddGame: any }).ddGame.scene.getScene("arena");
          const self = arena.room.state.players.get(arena.room.sessionId);
          const rig = arena.blobs.get(arena.room.sessionId);
          return {
            authority: self?.weapon,
            rendered: rig?.weaponDef?.id,
            wanted,
          };
        }, weaponId),
      { message: `B50 should equip ${weaponId}`, timeout: 20_000 },
    )
    .toEqual({ authority: weaponId, rendered: weaponId, wanted: weaponId });
  await page.waitForTimeout(80);
}

async function freshEquip(page: Page, weaponId: string): Promise<void> {
  await equip(page, "fists");
  await equip(page, weaponId);
}

async function commitFacing(page: Page, facing: Facing): Promise<void> {
  const canvas = page.locator("#game-root canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("B50 could not locate the Phaser canvas");
  await page.mouse.move(
    box.x + box.width * (facing === "right" ? 0.62 : 0.38),
    box.y + box.height * 0.22,
  );
  const wanted = facingSign(facing);
  await expect
    .poll(
      () =>
        page.evaluate((expected) => {
          const arena = (globalThis as unknown as { ddGame: any }).ddGame.scene.getScene("arena");
          const rig = arena.blobs.get(arena.room.sessionId);
          return {
            facing: rig?.facing,
            blendError: Math.abs((rig?.facingBlend ?? 0) - expected),
          };
        }, wanted),
      { message: `B50 should settle ${facing}`, timeout: 10_000 },
    )
    .toMatchObject({ facing: wanted, blendError: expect.any(Number) });
  await expect
    .poll(
      () =>
        page.evaluate((expected) => {
          const arena = (globalThis as unknown as { ddGame: any }).ddGame.scene.getScene("arena");
          return Math.abs((arena.blobs.get(arena.room.sessionId)?.facingBlend ?? 0) - expected);
        }, wanted),
      { timeout: 10_000 },
    )
    .toBeLessThan(0.02);
}

async function startHeldInput(page: Page, facing: Facing): Promise<void> {
  await page.evaluate((direction) => {
    const holder = globalThis as unknown as {
      ddGame: any;
      __b50HeldTimer?: number;
      __b50SendHeld?: (fireHeld: boolean) => void;
    };
    const arena = holder.ddGame.scene.getScene("arena");
    if (holder.__b50HeldTimer) window.clearInterval(holder.__b50HeldTimer);
    arena.selfAim = { x: direction, y: 0 };
    arena.localAtkCd = 0;
    arena.pointerOverInteractiveUi = false;
    arena.inputAccMs = 0;
    arena.input.activePointer.rightButtonDown = () => true;
    holder.__b50SendHeld = (fireHeld: boolean): void => {
      const owner = arena.room.state.players.get(arena.room.sessionId);
      const aimX = direction as number;
      arena.room.send("input", {
        ...arena.predictor.mintCmd(0, 0, false, false, false, aimX, 0, false, false),
        fireHeld,
        aimX,
        aimY: 0,
        targetX: owner.x + aimX * 520,
        targetY: owner.y,
      });
    };
    holder.__b50SendHeld(true);
    holder.__b50HeldTimer = window.setInterval(() => holder.__b50SendHeld?.(true), 20);
  }, facingSign(facing));
}

async function stopHeldInput(page: Page): Promise<void> {
  await page.evaluate(() => {
    const holder = globalThis as unknown as {
      ddGame: any;
      __b50HeldTimer?: number;
      __b50SendHeld?: (fireHeld: boolean) => void;
    };
    const arena = holder.ddGame.scene.getScene("arena");
    arena.input.activePointer.rightButtonDown = () => false;
    if (holder.__b50HeldTimer) {
      window.clearInterval(holder.__b50HeldTimer);
      holder.__b50HeldTimer = undefined;
    }
    holder.__b50SendHeld?.(false);
    holder.__b50SendHeld = undefined;
  });
}

async function captureOrrery(page: Page, facing: Facing): Promise<Record<string, unknown>> {
  await freshEquip(page, ORRERY_ID);
  await commitFacing(page, facing);
  await startHeldInput(page, facing);
  const telemetry = await page.evaluate(async () => {
    const arena = (globalThis as unknown as { ddGame: any }).ddGame.scene.getScene("arena");
    return await new Promise<Record<string, unknown>>((resolve, reject) => {
      const deadline = performance.now() + 8_000;
      const scan = (): void => {
        let activeRow: any;
        arena.room.state.beams.forEach((row: any) => {
          if (
            row.ownerId === arena.room.sessionId &&
            row.weaponId === "x2-hexbinder-s-iron-orrery" &&
            row.phase === 2
          )
            activeRow = row;
        });
        const entry = arena.beamRenderer.entries.find(
          (candidate: any) =>
            candidate.ownerId === arena.room.sessionId &&
            candidate.structure?.family === "converging-strands",
        );
        if (activeRow && entry?.structure?.generatedSheetVisible) {
          resolve({
            phase: activeRow.phase,
            weaponId: activeRow.weaponId,
            effectiveLength: activeRow.effectiveLength,
            authoritativeWidth: activeRow.width,
            renderFacing: Math.sign(Math.cos(activeRow.angle)),
            structure: { ...entry.structure },
            bodyTexture: entry.body.texture?.key ?? null,
            bodyVisible: entry.body.visible,
            lipVisible: entry.lip.visible,
            png: arena.game.canvas.toDataURL("image/png"),
          });
          return;
        }
        if (performance.now() >= deadline) {
          reject(new Error("B50 Orrery purple beam did not reach its active structured pass"));
          return;
        }
        window.requestAnimationFrame(scan);
      };
      scan();
    });
  });
  const { png, ...receipt } = telemetry;
  expect(receipt).toMatchObject({
    phase: 2,
    weaponId: ORRERY_ID,
    renderFacing: facingSign(facing),
    bodyVisible: true,
    lipVisible: false,
    structure: {
      family: "converging-strands",
      textureReady: true,
      generatedSheetVisible: true,
      authoritativeWidth: 56,
      coneStream: false,
      iceOnly: false,
    },
  });
  expect(Number(receipt.effectiveLength)).toBeGreaterThan(120);
  const image = await dataUrlScreenshot(String(png), `${ORRERY_ID}-${facing}-purple-beam.png`);
  await stopHeldInput(page);
  return { facing, ...receipt, screenshot: image };
}

async function captureEmberleaf(page: Page, facing: Facing): Promise<Record<string, unknown>> {
  await freshEquip(page, EMBERLEAF_ID);
  await commitFacing(page, facing);
  await startHeldInput(page, facing);
  const telemetry = await page.evaluate(async () => {
    const arena = (globalThis as unknown as { ddGame: any }).ddGame.scene.getScene("arena");
    return await new Promise<Record<string, unknown>>((resolve, reject) => {
      const deadline = performance.now() + 8_000;
      let lastObserved: Record<string, unknown> = {};
      const scan = (): void => {
        const self = arena.room.state.players.get(arena.room.sessionId);
        const rig = arena.blobs.get(arena.room.sessionId);
        const charge = arena.chargedProjectileMuzzles.get(arena.room.sessionId);
        const center = { x: 0, y: 0 };
        const hasCenter = rig?.writeTomeCenter(center) === true;
        lastObserved = {
          weapon: self?.weapon,
          chargeActive: self?.weaponChargeActive,
          openVisible: rig?.tome?.openVisible,
          chargeOpenActive: rig?.tome?.chargeOpenActive,
          heldTexture: rig?.weapons[0]?.img.texture.key,
          weaponVisible: rig?.weapons[0]?.img.visible,
          chargeVisible: charge?.visible,
          fireballWidth: charge?.displayWidth,
          hasCenter,
        };
        if (
          self?.weaponChargeActive === true &&
          rig?.tome?.openVisible &&
          charge?.visible &&
          hasCenter &&
          charge.displayWidth > 32
        ) {
          resolve({
            chargeActive: self.weaponChargeActive,
            chargeTicks: (arena.room.state.tick - self.weaponChargeStartTick) >>> 0,
            openVisible: rig.tome.openVisible,
            chargeOpenActive: rig.tome.chargeOpenActive,
            heldTexture: rig.weapons[0]?.img.texture.key,
            fireballWidth: charge.displayWidth,
            fireballHeight: charge.displayHeight,
            bookCenter: center,
            fireballCenter: { x: charge.x, y: charge.y },
            centerError: Math.hypot(center.x - charge.x, center.y - charge.y),
            png: arena.game.canvas.toDataURL("image/png"),
          });
          return;
        }
        if (performance.now() >= deadline) {
          reject(
            new Error(
              `B50 Emberleaf did not show its centered charge over the open book: ${JSON.stringify(lastObserved)}`,
            ),
          );
          return;
        }
        window.requestAnimationFrame(scan);
      };
      scan();
    });
  });
  const { png, ...receipt } = telemetry;
  expect(receipt).toMatchObject({
    chargeActive: true,
    openVisible: true,
    chargeOpenActive: true,
    heldTexture: `tome-open:${EMBERLEAF_ID}`,
  });
  expect(Number(receipt.centerError)).toBeLessThan(1);
  expect(Number(receipt.fireballWidth)).toBeGreaterThan(32);
  const image = await dataUrlScreenshot(String(png), `${EMBERLEAF_ID}-${facing}-open-charge.png`);
  await stopHeldInput(page);
  return { facing, ...receipt, screenshot: image };
}

async function captureVerdigris(page: Page, facing: Facing): Promise<Record<string, unknown>> {
  await freshEquip(page, VERDIGRIS_ID);
  await commitFacing(page, facing);
  const canvas = page.locator("#game-root canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("B50 could not aim the Verdigris cone");
  await page.mouse.move(
    box.x + box.width * (facing === "right" ? 0.78 : 0.22),
    box.y + box.height * 0.45,
  );
  await page.waitForTimeout(60);
  await page.evaluate(() => {
    const holder = globalThis as unknown as {
      __ddB50VerdigrisConeCapture?: boolean;
      __ddB50VerdigrisConeEvents?: unknown[];
    };
    holder.__ddB50VerdigrisConeCapture = true;
    holder.__ddB50VerdigrisConeEvents = [];
  });
  await startHeldInput(page, facing);
  const telemetry = await page.evaluate(async () => {
    const holder = globalThis as unknown as {
      ddGame: any;
      __ddB50VerdigrisConeEvents?: any[];
    };
    const arena = holder.ddGame.scene.getScene("arena");
    return await new Promise<Record<string, unknown>>((resolve, reject) => {
      const deadline = performance.now() + 8_000;
      let captured = false;
      const scan = (): void => {
        const event = holder.__ddB50VerdigrisConeEvents?.[0];
        const rig = arena.blobs.get(arena.room.sessionId);
        if (event && rig?.tome?.openVisible && !captured) {
          captured = true;
          window.setTimeout(() => {
            resolve({
              weaponId: event.weaponId,
              sourceX: event.sourceX,
              sourceY: event.sourceY,
              aimAngle: event.aimAngle,
              shots: event.shots,
              heldTexture: rig.weapons[0]?.img.texture.key,
              openVisible: rig.tome.openVisible,
              brownPageShapesVisible: rig.tome.pages.filter((page: any) => page.quad.visible)
                .length,
              brownScrapsVisible: rig.tome.scraps.filter((scrap: any) => scrap.piece.visible)
                .length,
              png: arena.game.canvas.toDataURL("image/png"),
            });
          }, 120);
          return;
        }
        if (performance.now() >= deadline) {
          reject(new Error("B50 Verdigris did not emit its book-origin page cone"));
          return;
        }
        window.requestAnimationFrame(scan);
      };
      scan();
    });
  });
  const { png, ...receipt } = telemetry;
  const shots = receipt.shots as Array<{
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    angleOffsetRad: number;
  }>;
  expect(receipt).toMatchObject({
    weaponId: VERDIGRIS_ID,
    heldTexture: `tome-open:${VERDIGRIS_ID}`,
    openVisible: true,
    brownPageShapesVisible: 0,
    brownScrapsVisible: 0,
  });
  expect(shots).toHaveLength(9);
  for (const shot of shots) {
    expect(
      Math.hypot(shot.startX - Number(receipt.sourceX), shot.startY - Number(receipt.sourceY)),
    ).toBeLessThan(16);
    expect(Math.abs(shot.angleOffsetRad)).toBeLessThanOrEqual(0.42);
    const forward =
      (shot.endX - shot.startX) * Math.cos(Number(receipt.aimAngle)) +
      (shot.endY - shot.startY) * Math.sin(Number(receipt.aimAngle));
    expect(forward).toBeGreaterThan(150);
  }
  const image = await dataUrlScreenshot(
    String(png),
    `${VERDIGRIS_ID}-${facing}-clean-page-cone.png`,
  );
  await stopHeldInput(page);
  return { facing, ...receipt, screenshot: image };
}

test("B50 caster corrections pass the private-port live gate in both facings", async ({ page }) => {
  test.setTimeout(180_000);
  await runArenaSpec(page, async (baseURL) => {
    await mkdir(EVIDENCE_DIR, { recursive: true });
    await page.setViewportSize({ width: 1000, height: 600 });
    const ports = await bootPrivateArena(page, baseURL);
    expect(Number.isInteger(ports.clientPort) && ports.clientPort > 0).toBe(true);
    expect(Number.isInteger(ports.gamePort) && ports.gamePort > 0).toBe(true);
    expect(FORBIDDEN_PORTS.has(ports.clientPort)).toBe(false);
    expect(FORBIDDEN_PORTS.has(ports.gamePort)).toBe(false);

    const orrery = [];
    const emberleaf = [];
    const verdigris = [];
    for (const facing of FACINGS) orrery.push(await captureOrrery(page, facing));
    for (const facing of FACINGS) emberleaf.push(await captureEmberleaf(page, facing));
    for (const facing of FACINGS) verdigris.push(await captureVerdigris(page, facing));

    await freshEquip(page, ORRERY_ID);
    const almanac = await page.evaluate(
      async ({ archived, character }) => {
        const arena = (globalThis as unknown as { ddGame: any }).ddGame.scene.getScene("arena");
        const before = arena.room.state.players.get(arena.room.sessionId)?.weapon;
        arena.room.send("devEquip", { weapon: archived, character });
        await new Promise((resolve) => window.setTimeout(resolve, 320));
        const after = arena.room.state.players.get(arena.room.sessionId)?.weapon;
        return {
          id: archived,
          rejected: after !== archived,
          retainedWeapon: after ?? before ?? "",
        };
      },
      { archived: CINDERQUILL_ID, character: CHARACTER_ID },
    );
    expect(almanac).toMatchObject({
      id: CINDERQUILL_ID,
      rejected: true,
      retainedWeapon: ORRERY_ID,
    });

    const evidence = {
      verdict: "pass",
      capturedAt: new Date().toISOString(),
      character: CHARACTER_ID,
      privatePorts: {
        ...ports,
        forbiddenDefaultPortsAvoided:
          !FORBIDDEN_PORTS.has(ports.clientPort) && !FORBIDDEN_PORTS.has(ports.gamePort),
      },
      facings: FACINGS,
      orrery,
      emberleaf,
      verdigris,
      almanac,
    };
    await writeFile(
      path.join(EVIDENCE_DIR, "live-gate.json"),
      `${JSON.stringify(evidence, null, 2)}\n`,
    );
    await writeFile(
      path.join(EVIDENCE_DIR, "README.md"),
      [
        "# B50 caster/VFX live evidence",
        "",
        `- Captured: ${evidence.capturedAt}`,
        `- Private client/game ports: ${ports.clientPort} / ${ports.gamePort}`,
        "- Both facings: Orrery purple structured beam, Emberleaf open-book centered charge, Verdigris clean book-origin page cone.",
        "- Cinderquill Almanac: archived devEquip rejected; active Orrery retained.",
        "- Machine-readable geometry and state: `live-gate.json`.",
        "",
      ].join("\n"),
    );
  });
});
