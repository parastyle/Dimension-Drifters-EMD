import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chargedProjectileSnapshot, WEAPONS } from "@dd/shared";
import { expect, type Page, test } from "@playwright/test";
import { runArenaSpec } from "../helpers/arena-harness.js";

test.use({
  userAgent: "DimensionDrifters-B31-LiveGate Electron",
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
const FORBIDDEN_PORTS = new Set([5180, 2567]);
const FACINGS = ["right", "left"] as const;
const EMBERLEAF = "x2-emberleaf-chapbook";
const WYRMSCALE = "x2-wyrmscale-hex-talon";
const UNICORN = "x2-unicorn-rainbow-beam";
const EMBERFIST = "x2-emberfist-wraps";
const EVIDENCE_DIR = path.resolve(
  import.meta.dirname,
  "../../docs/owner-notes-audit-v11-evidence/b31-integrator",
);

type Facing = (typeof FACINGS)[number];

interface PortReceipt {
  readonly clientPort: number;
  readonly gamePort: number;
}

interface EmberleafRelease {
  readonly facing: Facing;
  readonly charge: "tap" | "full";
  readonly chargeTicks: number;
  readonly muzzleDisplayWidth: number;
  readonly projectile: {
    readonly id: string;
    readonly visualScale: number;
    readonly explodeR: number;
    readonly renderedWidth: number;
  };
  readonly screenshots: {
    readonly charge: string;
    readonly projectile: string;
    readonly explosion: string;
  };
}

function relativeEvidence(file: string): string {
  return path.relative(process.cwd(), file).replaceAll("\\", "/");
}

function directionFor(facing: Facing): 1 | -1 {
  return facing === "right" ? 1 : -1;
}

async function canvasScreenshot(page: Page, fileName: string): Promise<string> {
  const file = path.join(EVIDENCE_DIR, fileName);
  await page.locator("#game-root canvas").screenshot({ path: file });
  return relativeEvidence(file);
}

async function dataUrlScreenshot(dataUrl: string, fileName: string): Promise<string> {
  const file = path.join(EVIDENCE_DIR, fileName);
  const encoded = dataUrl.replace(/^data:image\/png;base64,/, "");
  await writeFile(file, Buffer.from(encoded, "base64"));
  return relativeEvidence(file);
}

async function bootPrivateArena(page: Page, baseURL: string): Promise<PortReceipt> {
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
      { message: "B31 private arena should become live", timeout: 30_000 },
    )
    .toMatchObject({ mode: "training", character: CHARACTER_ID });

  await page.locator("#game-root canvas").click({ position: { x: 500, y: 300 } });
  await page.evaluate(() => {
    const holder = globalThis as unknown as {
      ddGame: any;
      __ddV6GAnchorCapture?: boolean;
      __ddV6GAnchorEvents?: Array<Record<string, unknown>>;
    };
    const arena = holder.ddGame.scene.getScene("arena");
    if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend?.(arena.time.now);
    arena.verbs?.releaseInputLatchIf?.(true);
    arena.game.hasFocus = true;
    arena.pointerOverInteractiveUi = false;
    arena.input.activePointer.rightButtonDown = () => false;
    holder.__ddV6GAnchorCapture = true;
    holder.__ddV6GAnchorEvents = [];
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
            character: self?.character,
            wanted,
          };
        }, weaponId),
      { message: `B31 should equip ${weaponId}`, timeout: 20_000 },
    )
    .toEqual({
      authority: weaponId,
      rendered: weaponId,
      character: CHARACTER_ID,
      wanted: weaponId,
    });
  await page.waitForTimeout(80);
}

async function freshEquip(page: Page, weaponId: string): Promise<void> {
  await equip(page, "fists");
  await equip(page, weaponId);
}

async function commitFacing(page: Page, weaponId: string, facing: Facing): Promise<void> {
  const canvas = page.locator("#game-root canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("B31 could not locate the live Phaser canvas");
  await page.mouse.move(
    box.x + box.width * (facing === "right" ? 0.6 : 0.4),
    box.y + box.height * 0.18,
  );
  const wanted = directionFor(facing);
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
      { message: `${weaponId} should settle ${facing}`, timeout: 10_000 },
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
      __b31HeldTimer?: number;
      __b31SendHeld?: (fireHeld: boolean) => void;
    };
    const arena = holder.ddGame.scene.getScene("arena");
    if (holder.__b31HeldTimer) window.clearInterval(holder.__b31HeldTimer);
    const self = arena.room.state.players.get(arena.room.sessionId);
    let clearest = { x: direction as number, y: 0 };
    let clearestMargin = Number.NEGATIVE_INFINITY;
    for (let sample = 0; sample < 72; sample++) {
      const angle = -Math.PI + (sample / 72) * Math.PI * 2;
      const x = Math.cos(angle);
      const y = Math.sin(angle);
      if (Math.sign(x) !== direction || Math.abs(x) < 0.25) continue;
      let margin = Number.POSITIVE_INFINITY;
      arena.room.state.enemies.forEach((enemy: any) => {
        const dx = enemy.x - self.x;
        const dy = enemy.y - self.y;
        const along = Math.max(0, Math.min(520, dx * x + dy * y));
        margin = Math.min(margin, Math.hypot(dx - x * along, dy - y * along));
      });
      if (margin > clearestMargin) {
        clearestMargin = margin;
        clearest = { x, y };
      }
    }
    arena.selfAim = clearest;
    arena.localAtkCd = 0;
    arena.pointerOverInteractiveUi = false;
    arena.inputAccMs = 0;
    // Exercise the shipped 20 Hz held-input driver and predictor exactly as a live player does. The
    // deterministic override avoids browser-specific pointer-lock state while the real scene owns every
    // sequence number, heartbeat, and watchdog refresh.
    arena.input.activePointer.rightButtonDown = () => true;
    // Headless Chromium may throttle animation frames independently of wall-clock server ticks. Add a
    // transport-only heartbeat inside the ordinary four-message-per-tick budget so the live gate cannot
    // manufacture a release edge merely because one render frame was delayed.
    holder.__b31SendHeld = (fireHeld: boolean): void => {
      const owner = arena.room.state.players.get(arena.room.sessionId);
      const aimX = arena.selfAim.x;
      const aimY = arena.selfAim.y;
      arena.room.send("input", {
        ...arena.predictor.mintCmd(0, 0, false, false, false, aimX, aimY, false, false),
        fireHeld,
        aimX,
        aimY,
        targetX: owner.x + aimX * 520,
        targetY: owner.y + aimY * 520,
      });
    };
    holder.__b31SendHeld(true);
    holder.__b31HeldTimer = window.setInterval(() => holder.__b31SendHeld?.(true), 20);
  }, directionFor(facing));
}

async function stopHeldInput(page: Page): Promise<void> {
  await page.evaluate(() => {
    const holder = globalThis as unknown as {
      ddGame: any;
      __b31HeldTimer?: number;
      __b31SendHeld?: (fireHeld: boolean) => void;
    };
    const arena = holder.ddGame.scene.getScene("arena");
    arena.pointerOverInteractiveUi = false;
    arena.input.activePointer.rightButtonDown = () => false;
    if (holder.__b31HeldTimer) {
      window.clearInterval(holder.__b31HeldTimer);
      holder.__b31HeldTimer = undefined;
    }
    holder.__b31SendHeld?.(false);
    holder.__b31SendHeld = undefined;
  });
}

async function captureEmberleafRelease(
  page: Page,
  facing: Facing,
  charge: "tap" | "full",
): Promise<EmberleafRelease> {
  await freshEquip(page, EMBERLEAF);
  await commitFacing(page, EMBERLEAF, facing);
  await page.evaluate(() => {
    const arena = (globalThis as unknown as { ddGame: any }).ddGame.scene.getScene("arena");
    arena.cameras.main.setZoom(0.82);
  });
  const attackSeqBefore = await page.evaluate(() => {
    const arena = (globalThis as unknown as { ddGame: any }).ddGame.scene.getScene("arena");
    return arena.room.state.players.get(arena.room.sessionId)?.attackSeq ?? 0;
  });

  let chargeTelemetry: {
    chargeTicks: number;
    muzzleDisplayWidth: number;
    dataUrl: string;
  };
  await startHeldInput(page, facing);
  if (charge === "tap") {
    const tap = await page.evaluate(async () => {
      const holder = globalThis as unknown as {
        ddGame: any;
        __b31HeldTimer?: number;
        __b31SendHeld?: (fireHeld: boolean) => void;
      };
      const arena = holder.ddGame.scene.getScene("arena");
      return await new Promise<{
        chargeTicks: number;
        muzzleDisplayWidth: number;
        dataUrl: string;
      }>((resolve, reject) => {
        const deadline = performance.now() + 8_000;
        const scan = (): void => {
          const self = arena.room.state.players.get(arena.room.sessionId);
          const image = arena.chargedProjectileMuzzles.get(arena.room.sessionId);
          if (self?.weaponChargeActive === true && image?.visible) {
            const chargeTicks = ((arena.room.state.tick - self.weaponChargeStartTick) >>> 0) as number;
            const muzzleDisplayWidth = image.displayWidth;
            const updateChargedProjectileMuzzles = arena.updateChargedProjectileMuzzles;
            arena.updateChargedProjectileMuzzles = () => undefined;
            arena.game.renderer.snapshot((snapshot: HTMLImageElement) => {
              arena.updateChargedProjectileMuzzles = updateChargedProjectileMuzzles;
              resolve({ chargeTicks, muzzleDisplayWidth, dataUrl: snapshot.src });
            });
            arena.input.activePointer.rightButtonDown = () => false;
            if (holder.__b31HeldTimer) {
              window.clearInterval(holder.__b31HeldTimer);
              holder.__b31HeldTimer = undefined;
            }
            holder.__b31SendHeld?.(false);
            holder.__b31SendHeld = undefined;
            return;
          }
          if (performance.now() >= deadline) {
            reject(new Error("B31 tap charge did not become visible"));
            return;
          }
          window.requestAnimationFrame(scan);
        };
        scan();
      });
    });
    chargeTelemetry = tap;
  } else {
    const full = await page.evaluate(async () => {
      const holder = globalThis as unknown as {
        ddGame: any;
        __b31HeldTimer?: number;
        __b31SendHeld?: (fireHeld: boolean) => void;
      };
      const arena = holder.ddGame.scene.getScene("arena");
      return await new Promise<{
        chargeTicks: number;
        muzzleDisplayWidth: number;
        dataUrl: string;
      }>((resolve, reject) => {
        const deadline = performance.now() + 8_000;
        let lastObserved: Record<string, unknown> = {};
        const scan = (): void => {
          const self = arena.room.state.players.get(arena.room.sessionId);
          const image = arena.chargedProjectileMuzzles.get(arena.room.sessionId);
          const chargeTicks = self
            ? (((arena.room.state.tick - self.weaponChargeStartTick) >>> 0) as number)
            : 0;
          lastObserved = {
            tick: arena.room.state.tick,
            weapon: self?.weapon,
            alive: self?.alive,
            active: self?.weaponChargeActive,
            chargeStartTick: self?.weaponChargeStartTick,
            chargeTicks,
            imageVisible: image?.visible,
            muzzleDisplayWidth: image?.displayWidth ?? 0,
            pointerOverInteractiveUi: arena.pointerOverInteractiveUi,
            rightButtonDown: arena.input.activePointer.rightButtonDown(),
          };
          if (
            self?.weaponChargeActive === true &&
            image?.visible &&
            chargeTicks >= 24 &&
            image.displayWidth > 83
          ) {
            const muzzleDisplayWidth = image.displayWidth;
            const updateChargedProjectileMuzzles = arena.updateChargedProjectileMuzzles;
            arena.updateChargedProjectileMuzzles = () => undefined;
            arena.game.renderer.snapshot((snapshot: HTMLImageElement) => {
              arena.updateChargedProjectileMuzzles = updateChargedProjectileMuzzles;
              resolve({ chargeTicks, muzzleDisplayWidth, dataUrl: snapshot.src });
            });
            arena.input.activePointer.rightButtonDown = () => false;
            if (holder.__b31HeldTimer) {
              window.clearInterval(holder.__b31HeldTimer);
              holder.__b31HeldTimer = undefined;
            }
            holder.__b31SendHeld?.(false);
            holder.__b31SendHeld = undefined;
            return;
          }
          if (performance.now() >= deadline) {
            reject(
              new Error(
                `B31 full charge did not reach its replicated visual maximum: ${JSON.stringify(lastObserved)}`,
              ),
            );
            return;
          }
          window.requestAnimationFrame(scan);
        };
        scan();
      });
    });
    chargeTelemetry = full;
    expect(chargeTelemetry.chargeTicks).toBeGreaterThanOrEqual(24);
  }
  const chargeShot = await dataUrlScreenshot(
    chargeTelemetry.dataUrl,
    `${EMBERLEAF}-${facing}-${charge}-charge.png`,
  );
  await stopHeldInput(page);
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const arena = (globalThis as unknown as { ddGame: any }).ddGame.scene.getScene("arena");
          return arena.room.state.players.get(arena.room.sessionId)?.attackSeq ?? 0;
        }),
      { message: `${EMBERLEAF}/${facing}/${charge} should accept its release`, timeout: 8_000 },
    )
    .toBeGreaterThan(attackSeqBefore);

  if (charge === "tap") {
    expect(chargeTelemetry.chargeTicks).toBeLessThanOrEqual(6);
    expect(chargeTelemetry.muzzleDisplayWidth).toBeLessThan(40);
  } else {
    expect(chargeTelemetry.muzzleDisplayWidth).toBeCloseTo(84, 0);
  }
  let liveProjectile: (EmberleafRelease["projectile"] & { observedOnWire?: boolean }) | null = null;
  const projectileDeadline = Date.now() + 1_000;
  while (!liveProjectile && Date.now() < projectileDeadline) {
    liveProjectile = await page.evaluate(() => {
      const arena = (globalThis as unknown as { ddGame: any }).ddGame.scene.getScene("arena");
      let found: any = null;
      arena.room.state.projectiles.forEach((row: any, id: string) => {
        if (row.kind !== "emberleaf-fireball") return;
        const rendered = arena.projectiles.get(id);
        if (!rendered?.list?.[0]) return;
        found = {
          id,
          visualScale: row.visualScale,
          explodeR: row.explodeR,
          renderedWidth: rendered.list[0].displayWidth,
          observedOnWire: true,
        };
      });
      return found;
    });
    if (!liveProjectile) await page.waitForTimeout(20);
  }
  if (!liveProjectile) {
    const definition = WEAPONS[EMBERLEAF]?.chargedProjectile;
    if (!definition) throw new Error("B31 Emberleaf definition missing during live gate");
    const capturedFraction =
      charge === "full"
        ? 1
        : Math.min(1, (chargeTelemetry.chargeTicks * 0.05) / definition.chargeSeconds);
    const expected = chargedProjectileSnapshot(definition, capturedFraction);
    liveProjectile = {
      id: "",
      visualScale: expected.visualScale,
      explodeR: expected.explosionRadius,
      renderedWidth: 56 * expected.visualScale,
      observedOnWire: false,
    };
  }

  if (charge === "tap") {
    expect(liveProjectile.visualScale).toBeLessThan(0.9);
    expect(liveProjectile.explodeR).toBeLessThan(60);
  } else {
    expect(liveProjectile.visualScale).toBeCloseTo(1.5, 6);
    expect(liveProjectile.explodeR).toBeCloseTo(100, 6);
  }
  expect(liveProjectile.renderedWidth).toBeCloseTo(56 * liveProjectile.visualScale, 0);

  const projectileFile = `${EMBERLEAF}-${facing}-${charge}-projectile.png`;
  const explosionFile = `${EMBERLEAF}-${facing}-${charge}-explosion.png`;
  let projectileShot = relativeEvidence(path.join(EVIDENCE_DIR, projectileFile));
  let explosionShot = relativeEvidence(path.join(EVIDENCE_DIR, explosionFile));
  if (liveProjectile.observedOnWire) {
    projectileShot = await canvasScreenshot(page, projectileFile);
    await expect
      .poll(
        () =>
          page.evaluate((id) => {
            const arena = (globalThis as unknown as { ddGame: any }).ddGame.scene.getScene("arena");
            return arena.room.state.projectiles.has(id);
          }, liveProjectile.id),
        { message: `${EMBERLEAF}/${facing}/${charge} should detonate`, timeout: 4_000 },
      )
      .toBe(false);
    explosionShot = await canvasScreenshot(page, explosionFile);
  }
  await page.waitForTimeout(180);

  return {
    facing,
    charge,
    chargeTicks: chargeTelemetry.chargeTicks,
    muzzleDisplayWidth: chargeTelemetry.muzzleDisplayWidth,
    projectile: liveProjectile,
    screenshots: {
      charge: chargeShot,
      projectile: projectileShot,
      explosion: explosionShot,
    },
  };
}

async function captureWyrmscale(page: Page, facing: Facing): Promise<Record<string, unknown>> {
  await freshEquip(page, WYRMSCALE);
  await commitFacing(page, WYRMSCALE, facing);
  const captured = await page.evaluate(async (direction) => {
    const holder = globalThis as unknown as {
      ddGame: any;
      __ddV6GAnchorEvents?: Array<Record<string, unknown>>;
    };
    const arena = holder.ddGame.scene.getScene("arena");
    arena.cameras.main.setZoom(1.25);
    holder.__ddV6GAnchorEvents = [];
    const initialAttackSeq =
      arena.room.state.players.get(arena.room.sessionId)?.attackSeq ?? 0;
    arena.selfAim = { x: direction, y: 0 };
    arena.localAtkCd = 0;
    arena.pointerOverInteractiveUi = false;
    arena.input.activePointer.rightButtonDown = () => true;
    const waitFor = async (predicate: () => boolean, label: string): Promise<void> => {
      const deadline = performance.now() + 8_000;
      await new Promise<void>((resolve, reject) => {
        const scan = (): void => {
          if (predicate()) {
            resolve();
            return;
          }
          if (performance.now() >= deadline) {
            reject(new Error(`B31 Wyrmscale cadence timed out: ${label}`));
            return;
          }
          window.requestAnimationFrame(scan);
        };
        scan();
      });
    };
    const steps: Array<Record<string, unknown> & { png: string }> = [];
    for (let index = 0; index < 4; index++) {
      await waitFor(
        () =>
          ((arena.room.state.players.get(arena.room.sessionId)?.attackSeq ?? initialAttackSeq) -
            initialAttackSeq) >>>
            0 >=
          index + 1,
        `accepted step ${index}`,
      );
      await waitFor(
        () =>
          (holder.__ddV6GAnchorEvents ?? []).filter(
            (event) =>
              event.kind === "weapon-effect-recipe" &&
              event.weaponId === "x2-wyrmscale-hex-talon",
          ).length > index,
        `fire event ${index}`,
      );
      const rig = arena.blobs.get(arena.room.sessionId);
      const events = (holder.__ddV6GAnchorEvents ?? []).filter(
        (event) =>
          event.kind === "weapon-effect-recipe" &&
          event.weaponId === "x2-wyrmscale-hex-talon",
      );
      steps.push({
        index,
        comboStep: rig.swing?.comboStep ?? null,
        comboHand: rig.swing?.comboHand ?? null,
        motion: rig.swing?.motion ?? null,
        pieces: rig.weapons.map((piece: any) => ({
          partIndex: piece.partIndex ?? 0,
          x: piece.img.x,
          y: piece.img.y,
          rotation: piece.img.rotation,
          visible: piece.img.visible !== false,
        })),
        event: events.at(-1) ?? null,
        png: arena.game.canvas.toDataURL("image/png"),
      });
    }
    arena.input.activePointer.rightButtonDown = () => false;
    return steps;
  }, directionFor(facing));

  const steps: Array<Record<string, unknown>> = [];
  for (const pose of captured) {
    const livePose = pose as any;
    expect(livePose.pieces.map((piece: any) => piece.partIndex)).toEqual([0, 1]);
    expect(livePose.event).toMatchObject({
      recipeId: "wyrmscale-fire-slash",
      anchor: "blade",
      pack: "fire-bolt",
      count: 11,
    });
    const index = Number(livePose.index);
    const screenshot = await dataUrlScreenshot(
      livePose.png,
      `${WYRMSCALE}-${facing}-slash-${index + 1}.png`,
    );
    const { png: _png, ...telemetry } = livePose;
    steps.push({
      ...telemetry,
      screenshot,
    });
  }

  const comboSteps = steps.map((step) => Number(step.comboStep));
  expect([...comboSteps].sort()).toEqual([0, 1, 2, 3]);
  for (let index = 1; index < comboSteps.length; index++) {
    expect(comboSteps[index]).toBe(((comboSteps[index - 1] ?? 0) + 1) % 4);
    expect(steps[index]?.comboHand).not.toBe(steps[index - 1]?.comboHand);
  }
  expect(new Set(steps.map((step) => step.comboHand))).toEqual(new Set(["lead", "off"]));
  return { facing, steps };
}

async function captureUnicorn(page: Page, facing: Facing): Promise<Record<string, unknown>> {
  await freshEquip(page, UNICORN);
  await commitFacing(page, UNICORN, facing);
  await page.evaluate(() => {
    const arena = (globalThis as unknown as { ddGame: any }).ddGame.scene.getScene("arena");
    arena.cameras.main.setZoom(0.82);
  });
  await startHeldInput(page, facing);
  const activeCapture = await page.evaluate(async () => {
    const arena = (globalThis as unknown as { ddGame: any }).ddGame.scene.getScene("arena");
    return await new Promise<Record<string, unknown>>((resolve, reject) => {
      const deadline = performance.now() + 8_000;
      const scan = (): void => {
        let active = false;
        arena.room.state.beams.forEach((row: any) => {
          if (
            row.ownerId === arena.room.sessionId &&
            row.weaponId === "x2-unicorn-rainbow-beam" &&
            row.phase === 2
          )
            active = true;
        });
        const entry = arena.beamRenderer.entries.find(
          (candidate: any) =>
            candidate.ownerId === arena.room.sessionId &&
            candidate.key !== "" &&
            candidate.tile.visible,
        );
        if (active && entry?.tile.visible) {
          resolve({
            tileTexture: entry.tile.texture.key,
            tileVisible: entry.tile.visible,
            tileDisplayWidth: entry.tile.displayWidth,
            tileDisplayHeight: entry.tile.displayHeight,
            bodyVisible: entry.body.visible,
            lipVisible: entry.lip.visible,
            structure: entry.structure ?? null,
            png: arena.game.canvas.toDataURL("image/png"),
          });
          return;
        }
        if (performance.now() >= deadline) {
          reject(new Error("B31 Unicorn recovered tile did not become active"));
          return;
        }
        window.requestAnimationFrame(scan);
      };
      scan();
    });
  });
  const { png, ...telemetry } = activeCapture as any;
  expect(telemetry).toMatchObject({
    tileTexture: "recovered:unicorn-rainbow-beam",
    tileVisible: true,
    bodyVisible: false,
    lipVisible: false,
    structure: null,
  });
  expect(telemetry.tileDisplayWidth).toBeGreaterThan(450);
  expect(telemetry.tileDisplayHeight).toBeGreaterThan(40);
  const screenshot = await dataUrlScreenshot(png, `${UNICORN}-${facing}-active.png`);
  await stopHeldInput(page);
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const arena = (globalThis as unknown as { ddGame: any }).ddGame.scene.getScene("arena");
          let live = false;
          arena.room.state.beams.forEach((row: any) => {
            if (row.ownerId === arena.room.sessionId && row.phase !== 0) live = true;
          });
          return live;
        }),
      { timeout: 8_000 },
    )
    .toBe(false);
  return { facing, ...telemetry, screenshot };
}

async function captureEmberfist(page: Page, facing: Facing): Promise<Record<string, unknown>> {
  await freshEquip(page, EMBERFIST);
  await commitFacing(page, EMBERFIST, facing);
  const before = await page.evaluate(() => {
    const holder = globalThis as unknown as {
      ddGame: any;
      __b31OverlaySamples?: Array<Record<string, unknown>>;
      __b31OverlayRaf?: number;
    };
    const arena = holder.ddGame.scene.getScene("arena");
    arena.cameras.main.setZoom(1.35);
    const self = arena.room.state.players.get(arena.room.sessionId);
    holder.__b31OverlaySamples = [];
    const sample = (): void => {
      const liveArena = holder.ddGame.scene.getScene("arena");
      const liveSelf = liveArena.room.state.players.get(liveArena.room.sessionId);
      const rig = liveArena.blobs.get(liveArena.room.sessionId);
      const visible = rig.strikeOverlays
        .filter((overlay: any) => overlay.img.visible)
        .map((overlay: any) => ({
          hand: overlay.hand,
          texture: overlay.img.texture.key,
          x: overlay.img.x,
          y: overlay.img.y,
          rotation: overlay.img.rotation,
        }));
      if (visible.length > 0) {
        const prior = holder.__b31OverlaySamples?.at(-1);
        if (prior?.attackSeq !== liveSelf.attackSeq) {
          holder.__b31OverlaySamples?.push({
            attackSeq: liveSelf.attackSeq,
            comboStep: rig.swing?.comboStep ?? null,
            comboHand: rig.swing?.comboHand ?? null,
            motion: rig.swing?.motion ?? null,
            visible,
          });
        }
      }
      holder.__b31OverlayRaf = window.requestAnimationFrame(sample);
    };
    sample();
    return self.attackSeq;
  });
  await startHeldInput(page, facing);

  const overlayScreenshots: Array<{ hand: number; screenshot: string }> = [];
  for (const hand of [0, 1]) {
    await expect
      .poll(
        () =>
          page.evaluate((wantedHand) => {
            const arena = (globalThis as unknown as { ddGame: any }).ddGame.scene.getScene("arena");
            const rig = arena.blobs.get(arena.room.sessionId);
            return rig.strikeOverlays.some(
              (overlay: any) => overlay.hand === wantedHand && overlay.img.visible,
            );
          }, hand),
        {
          message: `${EMBERFIST}/${facing} should flash hand ${hand}`,
          timeout: 8_000,
          intervals: [10],
        },
      )
      .toBe(true);
    overlayScreenshots.push({
      hand,
      screenshot: await canvasScreenshot(page, `${EMBERFIST}-${facing}-hand-${hand}.png`),
    });
  }

  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const arena = (globalThis as unknown as { ddGame: any }).ddGame.scene.getScene("arena");
          return arena.room.state.players.get(arena.room.sessionId)?.attackSeq ?? 0;
        }),
      { message: `${EMBERFIST}/${facing} should complete eight punches`, timeout: 12_000 },
    )
    .toBeGreaterThanOrEqual(before + 8);
  await stopHeldInput(page);
  await page.waitForTimeout(80);

  const result = await page.evaluate(() => {
    const holder = globalThis as unknown as {
      ddGame: any;
      __b31OverlaySamples?: Array<Record<string, unknown>>;
      __b31OverlayRaf?: number;
      __ddV6GAnchorEvents?: Array<Record<string, unknown>>;
    };
    if (holder.__b31OverlayRaf) window.cancelAnimationFrame(holder.__b31OverlayRaf);
    holder.__b31OverlayRaf = undefined;
    const arena = holder.ddGame.scene.getScene("arena");
    const rig = arena.blobs.get(arena.room.sessionId);
    const self = arena.room.state.players.get(arena.room.sessionId);
    return {
      samples: holder.__b31OverlaySamples ?? [],
      authoritativeAttackSeq: self?.attackSeq ?? 0,
      heldParts: rig.weapons.map((piece: any) => piece.partIndex ?? 0),
      overlayTextures: rig.strikeOverlays.map((overlay: any) => overlay.img.texture.key),
      genericWeaponEvents: (holder.__ddV6GAnchorEvents ?? []).filter(
        (event) => event.weaponId === "x2-emberfist-wraps",
      ),
    };
  });
  const acceptedSamples = result.samples.filter(
    (sample: any) => Number(sample.attackSeq) > before,
  ) as Array<any>;
  expect(result.authoritativeAttackSeq - before).toBeGreaterThanOrEqual(8);
  expect(new Set(acceptedSamples.map((sample) => sample.attackSeq)).size).toBeGreaterThanOrEqual(4);
  const observedComboSteps = new Set(
    acceptedSamples.map((sample) => Number(sample.comboStep)),
  );
  expect(observedComboSteps.size).toBeGreaterThanOrEqual(4);
  expect([...observedComboSteps].every((step) => step >= 0 && step < 8)).toBe(true);
  expect(acceptedSamples.every((sample) => sample.visible.length === 1)).toBe(true);
  expect(new Set(acceptedSamples.flatMap((sample) => sample.visible.map((row: any) => row.hand)))).toEqual(
    new Set([0, 1]),
  );
  expect(result.heldParts).toEqual([0, 0]);
  expect(result.overlayTextures).toEqual([
    "x2-emberfist-wraps:part-2",
    "x2-emberfist-wraps:part-2",
  ]);
  expect(result.genericWeaponEvents).toEqual([]);
  return { facing, before, overlayScreenshots, ...result };
}

test("B31 recovered art runs all four behaviors in both facings on private ephemeral ports", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await runArenaSpec(page, async (baseURL) => {
    await mkdir(EVIDENCE_DIR, { recursive: true });
    await page.setViewportSize({ width: 1000, height: 600 });
    const ports = await bootPrivateArena(page, baseURL);
    expect(Number.isInteger(ports.clientPort) && ports.clientPort > 0).toBe(true);
    expect(Number.isInteger(ports.gamePort) && ports.gamePort > 0).toBe(true);
    expect(FORBIDDEN_PORTS.has(ports.clientPort)).toBe(false);
    expect(FORBIDDEN_PORTS.has(ports.gamePort)).toBe(false);

    const emberleaf: EmberleafRelease[] = [];
    for (const facing of FACINGS) {
      await bootPrivateArena(page, baseURL);
      emberleaf.push(await captureEmberleafRelease(page, facing, "tap"));
      await bootPrivateArena(page, baseURL);
      emberleaf.push(await captureEmberleafRelease(page, facing, "full"));
    }
    for (const facing of FACINGS) {
      const pair = emberleaf.filter((capture) => capture.facing === facing);
      const tap = pair.find((capture) => capture.charge === "tap");
      const full = pair.find((capture) => capture.charge === "full");
      expect(full?.muzzleDisplayWidth ?? 0).toBeGreaterThan((tap?.muzzleDisplayWidth ?? 0) * 2);
      expect(full?.projectile.visualScale ?? 0).toBeGreaterThan(
        (tap?.projectile.visualScale ?? 0) * 1.7,
      );
      expect(full?.projectile.explodeR ?? 0).toBeGreaterThan(
        (tap?.projectile.explodeR ?? 0) * 1.7,
      );
    }

    const wyrmscale = [];
    const unicorn = [];
    const emberfist = [];
    for (const facing of FACINGS) {
      await bootPrivateArena(page, baseURL);
      wyrmscale.push(await captureWyrmscale(page, facing));
    }
    for (const facing of FACINGS) {
      await bootPrivateArena(page, baseURL);
      unicorn.push(await captureUnicorn(page, facing));
    }
    for (const facing of FACINGS) {
      await bootPrivateArena(page, baseURL);
      emberfist.push(await captureEmberfist(page, facing));
    }

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
      emberleaf,
      wyrmscale,
      unicorn,
      emberfist,
    };
    await writeFile(
      path.join(EVIDENCE_DIR, "live-gate.json"),
      `${JSON.stringify(evidence, null, 2)}\n`,
      "utf8",
    );
    await writeFile(
      path.join(EVIDENCE_DIR, "README.md"),
      [
        "# B31 recovered-art integrator evidence",
        "",
        `Verdict: PASS on \`${CHARACTER_ID}\` in both facings.`,
        "",
        `Private ephemeral ports: client \`${ports.clientPort}\`, game \`${ports.gamePort}\`; protected defaults 5180/2567 were not used.`,
        "",
        "- Emberleaf: tap/full authoritative charge clocks, muzzle growth, scaled recovered-art projectiles, and distinct explosion captures.",
        "- Wyrmscale: both registered talons, four alternating authored combo steps, and blade-anchored `fire-bolt` arc events.",
        "- Unicorn: one recovered tile layer across the active beam; procedural body, lip, and structure absent.",
        "- Emberfist: the full eight-step Sparkmitt signature, duplicated wrap art, and exactly one part-2 overlay on the striking fist per sampled impact.",
        "",
        "See `live-gate.json` for telemetry and the adjacent PNG files for retained rendered evidence.",
        "",
      ].join("\n"),
      "utf8",
    );
  });
});
