// @ts-nocheck -- evidence intentionally reads private retained rig presentation channels.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { runArenaSpec } from "../helpers/arena-harness.js";

const CHARACTER_ID = "proto-cowboy-hidden-face";
const FORBIDDEN_PORTS = new Set([5180, 2567]);
const FACINGS = ["right", "left"] as const;
const FIXTURES = [
  { id: "x2-hallowbore-coachgun", mode: "hammer", movingHand: "secondary" },
  { id: "x2-boomstick-saddlegun", mode: "mechanism", movingHand: "secondary" },
  { id: "x2-dustline-lever-action", mode: "mechanism", movingHand: "secondary" },
  { id: "x2-gravedog-auto-rifle", mode: "projectile" },
  { id: "x2-widowmaker-arbalest", mode: "static" },
  { id: "x2-whisperbarb-hand-crossbow", mode: "static" },
  { id: "x2-powderkeg-mortar", mode: "static" },
  { id: "x2-thunderhead-repeater-cannon", mode: "mechanism", movingHand: "primary" },
] as const;
const EVIDENCE_DIR = path.resolve(
  import.meta.dirname,
  "../../docs/owner-notes-audit-v12-evidence/b48-gun-holds",
);

type Facing = (typeof FACINGS)[number];

function evidencePath(file: string): string {
  return path.relative(process.cwd(), file).replaceAll("\\", "/");
}

async function bootPrivateArena(page: Page, baseURL: string): Promise<void> {
  await page.goto(`${baseURL}/?dev=char:${encodeURIComponent(CHARACTER_ID)}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.locator("#game-root canvas")).toBeVisible();
  await expect
    .poll(
      () =>
        page
          .evaluate(() => {
            const game = (globalThis as any).ddGame;
            if (!game?.scene.isActive("arena")) return null;
            const arena = game.scene.getScene("arena");
            const self = arena.room?.state?.players?.get(arena.room.sessionId);
            return { mode: arena.room?.state?.mode, character: self?.character };
          })
          .catch(() => null),
      { message: "B48 private Testing Grounds should become live", timeout: 30_000 },
    )
    .toMatchObject({ mode: "training", character: CHARACTER_ID });

  await page.locator("#game-root canvas").click({ position: { x: 400, y: 225 } });
  await page.evaluate(() => {
    const holder = globalThis as any;
    const arena = holder.ddGame.scene.getScene("arena");
    if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend?.(arena.time.now);
    arena.verbs?.releaseInputLatchIf?.(true);
    arena.game.hasFocus = true;
    arena.pointerOverInteractiveUi = false;
    arena.cameras.main.setZoom(1.35);

    holder.__ddB48Snapshot = (wanted: string) => {
      const self = arena.room.state.players.get(arena.room.sessionId);
      const rig = arena.blobs.get(arena.room.sessionId);
      if (!self || !rig || rig.weaponDef?.id !== wanted)
        throw new Error(`B48 snapshot lost ${wanted}`);
      const front = rig.hands.find((hand: any) => hand.front);
      const back = rig.hands.find((hand: any) => !hand.front);
      const held = rig.weapons[0];
      const image = held?.img;
      const grips = rig.weaponDef.gripPoints;
      let secondaryContactError: number | null = null;
      let secondaryTarget: { x: number; y: number } | null = null;
      if (front && back && image && grips?.secondary) {
        const localX = (grips.secondary.x - grips.primary.x) * image.width * image.scaleX;
        const localY = (grips.secondary.y - grips.primary.y) * image.height * image.scaleY;
        const c = Math.cos(image.rotation);
        const s = Math.sin(image.rotation);
        secondaryTarget = {
          x: image.x + c * localX - s * localY,
          y: image.y + s * localX + c * localY,
        };
        secondaryContactError = Math.hypot(
          back.img.x - secondaryTarget.x,
          back.img.y - secondaryTarget.y,
        );
      }

      let projectile: Record<string, any> | null = null;
      for (const view of arena.projectiles.values()) {
        if (view.getData("sourceWeapon") !== wanted) continue;
        const payload = view.getData("arcPayload");
        projectile = {
          projectileArt: view.getData("projectileArt"),
          ballisticCore:
            payload?.list?.some?.((child: any) => child.getData?.("ballisticCore") === true) ??
            false,
          x: view.x,
          y: view.y,
          spawnAnchorKind: view.getData("spawnAnchorKind"),
          spawnMuzzleX: view.getData("spawnMuzzleX"),
          spawnMuzzleY: view.getData("spawnMuzzleY"),
        };
      }

      const cycle = rig.gunHandlingCycles?.[0];
      const sceneNow = arena.animClock ?? arena.time.now;
      const weaponRows = rig.weapons.map((entry: any, hand: number) => ({
        hand,
        x: entry.img.x,
        y: entry.img.y,
        rotation: entry.img.rotation,
        originX: entry.img.originX,
        originY: entry.img.originY,
        displayWidth: Math.abs(entry.img.displayWidth),
        displayHeight: Math.abs(entry.img.displayHeight),
      }));
      return {
        character: self.character,
        authorityWeapon: self.weapon,
        attackSeq: self.attackSeq,
        facingValue: rig.facing,
        facingBlend: rig.facingBlend,
        handling: rig.weaponDef.tags.handling ?? [],
        gripPoints: rig.weaponDef.gripPoints ?? null,
        dualVerticalSplit: rig.weaponDef.dualVerticalSplit ?? null,
        projectileArt: rig.weaponDef.gun?.projectileArt ?? null,
        bulletKind: rig.weaponDef.gun?.bulletKind ?? null,
        rangedAimActive: sceneNow <= (rig.rangedAimActiveUntilMs ?? Number.NEGATIVE_INFINITY),
        front: front ? { x: front.img.x, y: front.img.y, rotation: front.img.rotation } : null,
        back: back ? { x: back.img.x, y: back.img.y, rotation: back.img.rotation } : null,
        primaryContactError:
          front && image ? Math.hypot(front.img.x - image.x, front.img.y - image.y) : null,
        secondaryContactError,
        secondaryTarget,
        weaponRows,
        weaponVerticalGap:
          weaponRows.length > 1 ? Math.abs(weaponRows[1].y - weaponRows[0].y) : null,
        stockBehindTriggerPx:
          image && grips ? grips.primary.x * Math.abs(image.displayWidth) : null,
        hammer: { ...rig.revolverHammerBeat },
        hammerLayerHand: rig.revolverHammerLayerHand,
        cycle: cycle
          ? {
              active: cycle.active,
              mechanism: cycle.mechanism,
              acceptedSeq: cycle.acceptedSeq,
              elapsedMs: sceneNow - cycle.startMs,
            }
          : null,
        projectile,
      };
    };
  });
}

async function equip(page: Page, weaponId: string): Promise<void> {
  await page.evaluate(
    ({ weapon, character }) => {
      const arena = (globalThis as any).ddGame.scene.getScene("arena");
      if (arena.scene.isPaused()) arena.scene.resume();
      arena.room.send("devEquip", { weapon, character });
    },
    { weapon: weaponId, character: CHARACTER_ID },
  );
  await expect
    .poll(
      () =>
        page.evaluate((wanted) => {
          const arena = (globalThis as any).ddGame.scene.getScene("arena");
          const self = arena.room.state.players.get(arena.room.sessionId);
          const rig = arena.blobs.get(arena.room.sessionId);
          return [self?.weapon, rig?.weaponDef?.id, wanted];
        }, weaponId),
      { message: `B48 should equip ${weaponId}`, timeout: 20_000 },
    )
    .toEqual([weaponId, weaponId, weaponId]);
  await page.waitForTimeout(420);
}

async function commitFacing(page: Page, facing: Facing): Promise<void> {
  const canvas = page.locator("#game-root canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("B48 could not locate the live Phaser canvas");
  await page.mouse.move(
    box.x + box.width * (facing === "right" ? 0.9 : 0.1),
    box.y + box.height * 0.5,
  );
  const wanted = facing === "right" ? 1 : -1;
  await expect
    .poll(
      () =>
        page.evaluate((expected) => {
          const arena = (globalThis as any).ddGame.scene.getScene("arena");
          arena.selfAim = { x: expected, y: 0 };
          const rig = arena.blobs.get(arena.room.sessionId);
          return Math.abs((rig?.facingBlend ?? 0) - expected);
        }, wanted),
      { message: `B48 actor should settle ${facing}`, timeout: 10_000 },
    )
    .toBeLessThan(0.02);
}

async function captureCorrectedBeat(
  page: Page,
  fixture: (typeof FIXTURES)[number],
  facing: Facing,
): Promise<Record<string, any>> {
  return page.evaluate(
    ({ wanted, direction, mode, movingHand }) =>
      new Promise<Record<string, any>>((resolve, reject) => {
        const holder = globalThis as any;
        const arena = holder.ddGame.scene.getScene("arena");
        const self = arena.room.state.players.get(arena.room.sessionId);
        const initialSeq = self?.attackSeq ?? 0;
        const startedAt = performance.now();
        let acceptedAt: number | undefined;
        let lastAttemptAt = -1e9;
        let freezing = false;

        const attempt = (now: number) => {
          lastAttemptAt = now;
          arena.selfAim = { x: direction, y: 0 };
          arena.localAtkCd = 0;
          arena.input.activePointer.rightButtonDown = () => true;
          if (arena.sendAttack) arena.sendAttack();
          else
            arena.room.send("attack", {
              aimX: direction,
              aimY: 0,
              tx: (self?.x ?? 0) + direction * 360,
              ty: self?.y ?? 0,
            });
          arena.input.activePointer.rightButtonDown = () => false;
          arena.verbs?.releaseInputLatchIf?.(true);
          arena.stepNetInput?.(50, false, false, 0, 0);
        };

        const sample = (now: number) => {
          const current = arena.room.state.players.get(arena.room.sessionId);
          const accepted = ((current?.attackSeq ?? initialSeq) - initialSeq) >>> 0 > 0;
          if (accepted && acceptedAt === undefined) acceptedAt = now;
          if (!accepted && now - lastAttemptAt > 180) attempt(now);
          const snapshot = holder.__ddB48Snapshot(wanted);
          const acceptedElapsed = acceptedAt === undefined ? 0 : now - acceptedAt;
          const movingError =
            movingHand === "primary"
              ? Number(snapshot.primaryContactError)
              : Number(snapshot.secondaryContactError);
          const condition =
            mode === "hammer"
              ? snapshot.hammer.active &&
                snapshot.hammerLayerHand === 1 &&
                snapshot.secondaryContactError > 8
              : mode === "mechanism"
                ? snapshot.cycle?.active &&
                  snapshot.cycle.elapsedMs > 58 &&
                  snapshot.cycle.elapsedMs < 170 &&
                  movingError > 4
                : mode === "projectile"
                  ? snapshot.projectile?.projectileArt === "bullet" &&
                    snapshot.projectile?.ballisticCore === true
                  : accepted && snapshot.rangedAimActive && acceptedElapsed > 145;
          if (condition) {
            freezing = true;
            arena.scene.pause();
            const frozen = holder.__ddB48Snapshot(wanted);
            const waitForAuthority = () => {
              const authority = arena.room.state.players.get(arena.room.sessionId);
              const authorityAccepted =
                (((authority?.attackSeq ?? initialSeq) - initialSeq) >>> 0) > 0;
              if (authorityAccepted) {
                frozen.authorityAcceptedAtCapture = true;
                frozen.authorityAttackSeqAfter = authority.attackSeq;
                resolve(frozen);
                return;
              }
              if (performance.now() - startedAt > 10_000) {
                reject(new Error(`B48 presentation fired but authority rejected ${wanted}`));
                return;
              }
              window.setTimeout(waitForAuthority, 5);
            };
            waitForAuthority();
            return;
          }
          if (freezing) return;
          if (now - startedAt > 10_000) {
            reject(
              new Error(
                `B48 timed out ${wanted}/${mode}: ${JSON.stringify({
                  accepted,
                  acceptedElapsed,
                  movingError,
                  snapshot,
                })}`,
              ),
            );
            return;
          }
          requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      }),
    {
      wanted: fixture.id,
      direction: facing === "right" ? 1 : -1,
      mode: fixture.mode,
      movingHand: "movingHand" in fixture ? fixture.movingHand : undefined,
    },
  );
}

function assertFacing(snapshot: Record<string, any>, facing: Facing): void {
  expect(snapshot.character).toBe(CHARACTER_ID);
  expect(snapshot.facingValue).toBe(facing === "right" ? 1 : -1);
  expect(Math.abs(snapshot.facingBlend - (facing === "right" ? 1 : -1))).toBeLessThan(0.02);
}

test("B48 corrected gun holds and mechanisms render in both facings on private ports", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await runArenaSpec(page, async (baseURL) => {
    await mkdir(EVIDENCE_DIR, { recursive: true });
    await page.setViewportSize({ width: 800, height: 450 });
    await bootPrivateArena(page, baseURL);

    const clientPort = Number(new URL(baseURL).port);
    const gamePort = Number(new URL(page.url()).searchParams.get("port"));
    expect(Number.isInteger(clientPort) && clientPort > 0).toBe(true);
    expect(Number.isInteger(gamePort) && gamePort > 0).toBe(true);
    expect(FORBIDDEN_PORTS.has(clientPort)).toBe(false);
    expect(FORBIDDEN_PORTS.has(gamePort)).toBe(false);

    const captures: Array<Record<string, any>> = [];
    for (const fixture of FIXTURES) {
      await equip(page, fixture.id);
      for (const facing of FACINGS) {
        await commitFacing(page, facing);
        const snapshot = await captureCorrectedBeat(page, fixture, facing);
        assertFacing(snapshot, facing);

        if (fixture.id === "x2-hallowbore-coachgun") {
          expect(snapshot.handling).toContain("revolver");
          expect(snapshot.handling).not.toContain("pump");
          expect(snapshot.gripPoints.secondary.role).toBe("hammer");
          expect(snapshot.hammer.active).toBe(true);
          expect(snapshot.hammerLayerHand).toBe(1);
          expect(snapshot.secondaryContactError).toBeGreaterThan(8);
        } else if (fixture.id === "x2-boomstick-saddlegun") {
          expect(snapshot.handling).toContain("lever");
          expect(snapshot.handling).not.toContain("pump");
          expect(snapshot.cycle.mechanism).toBe("lever");
          expect(snapshot.secondaryContactError).toBeGreaterThan(4);
        } else if (fixture.id === "x2-dustline-lever-action") {
          expect(snapshot.gripPoints.secondary.angleRad).toBeCloseTo(0.72, 8);
          expect(snapshot.back.rotation - snapshot.weaponRows[0].rotation).toBeCloseTo(0.72, 2);
          expect(snapshot.secondaryContactError).toBeGreaterThan(4);
        } else if (fixture.id === "x2-gravedog-auto-rifle") {
          expect(snapshot.bulletKind).toBe("tracer");
          expect(snapshot.projectileArt).toBe("bullet");
          expect(snapshot.projectile).toMatchObject({
            projectileArt: "bullet",
            ballisticCore: true,
            spawnAnchorKind: "muzzle",
          });
        } else if (fixture.id === "x2-widowmaker-arbalest") {
          expect(snapshot.gripPoints.secondary.role).toBe("crank");
          expect(snapshot.stockBehindTriggerPx).toBeGreaterThan(60);
          expect(snapshot.secondaryContactError).toBeLessThan(2.5);
        } else if (fixture.id === "x2-whisperbarb-hand-crossbow") {
          expect(snapshot.dualVerticalSplit).toBe(0.1);
          expect(snapshot.weaponRows).toHaveLength(2);
          expect(snapshot.weaponVerticalGap).toBeGreaterThan(14);
        } else if (fixture.id === "x2-powderkeg-mortar") {
          expect(snapshot.gripPoints.primary).toEqual({ x: 0.08, y: 0.64 });
          expect(snapshot.gripPoints.secondary).toMatchObject({
            x: 0.7,
            y: 0.68,
            role: "two-hand-rifle",
          });
          expect(snapshot.secondaryContactError).toBeLessThan(2.5);
        } else {
          expect(snapshot.gripPoints.secondary.role).toBe("horizontal-foregrip");
          expect(snapshot.cycle.mechanism).toBe("lever");
          expect(snapshot.primaryContactError).toBeGreaterThan(4);
          expect(snapshot.secondaryContactError).toBeLessThan(2.5);
        }

        const screenshotFile = path.join(EVIDENCE_DIR, `${fixture.id}-${facing}.png`);
        await page.locator("#game-root canvas").screenshot({ path: screenshotFile });
        captures.push({
          weaponId: fixture.id,
          facing,
          screenshot: evidencePath(screenshotFile),
          snapshot,
        });
        await page.evaluate(() => {
          (globalThis as any).ddGame.scene.getScene("arena").scene.resume();
        });
        await page.waitForTimeout(260);
      }
    }

    const evidence = {
      verdict: "pass",
      capturedAt: new Date().toISOString(),
      character: CHARACTER_ID,
      privatePorts: {
        client: clientPort,
        game: gamePort,
        forbiddenDefaultPortsAvoided:
          !FORBIDDEN_PORTS.has(clientPort) && !FORBIDDEN_PORTS.has(gamePort),
      },
      facings: FACINGS,
      weaponIds: FIXTURES.map((fixture) => fixture.id),
      captures,
    };
    await writeFile(
      path.join(EVIDENCE_DIR, "live-gate.json"),
      `${JSON.stringify(evidence, null, 2)}\n`,
      "utf8",
    );
    await writeFile(
      path.join(EVIDENCE_DIR, "live-gate-summary.md"),
      [
        "# B48 gun holds private live gate",
        "",
        `Verdict: PASS - ${captures.length} combat-scale captures; all eight weapons shown in both facings.`,
        "",
        `Private ports: client \`${clientPort}\`, game \`${gamePort}\`; defaults 5180/2567 were not used.`,
        "",
        "The machine-readable receipt records catalog grips, mechanism ownership/travel, hand contact,",
        "fan-hammer routing, dual vertical separation, and Gravedog's tracer-plus-ballistic projectile.",
        "",
      ].join("\n"),
      "utf8",
    );
  });
});
