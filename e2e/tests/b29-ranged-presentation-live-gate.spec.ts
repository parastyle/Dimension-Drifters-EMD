// @ts-nocheck -- live evidence intentionally inspects private rig presentation channels.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { runArenaSpec } from "../helpers/arena-harness.js";

const CHARACTER_ID = "proto-cowboy-hidden-face";
const FORBIDDEN_PORTS = new Set([5180, 2567]);
const FACINGS = ["right", "left"] as const;
const THROW_FIXTURES = [
  { id: "x2-iron-throwing-star", displayLength: 76, collisionLength: 56 },
  { id: "x2-iron-chakram", displayLength: 104, collisionLength: 76 },
] as const;
const EVIDENCE_DIR = path.resolve(
  import.meta.dirname,
  "../../docs/owner-notes-audit-v11-evidence/b29-ranged-presentation",
);

type Facing = (typeof FACINGS)[number];
type MotionKind =
  | "throw-release"
  | "throw-projectile"
  | "kunai-twirl"
  | "dual-fire"
  | "revolver-hammer";

interface EvidenceCapture {
  label: string;
  weaponId: string;
  facing: Facing;
  screenshot: string;
  snapshot: Record<string, any>;
}

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
      { message: "B29 private Testing Grounds should become live", timeout: 30_000 },
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

    holder.__ddB29Snapshot = (wanted: string) => {
      const self = arena.room.state.players.get(arena.room.sessionId);
      const rig = arena.blobs.get(arena.room.sessionId);
      if (!self || !rig || rig.weaponDef?.id !== wanted)
        throw new Error(`B29 snapshot lost ${wanted}`);

      const weaponRows = rig.weapons.map((held: any, hand: number) => {
        const image = held.img;
        const matrix = image.getWorldTransformMatrix();
        const left = -image.displayOriginX;
        const top = -image.displayOriginY;
        const right = left + image.width;
        const bottom = top + image.height;
        const a = matrix.transformPoint(left, top);
        const b = matrix.transformPoint(right, top);
        const c = matrix.transformPoint(right, bottom);
        const d = matrix.transformPoint(left, bottom);
        const center = matrix.transformPoint((left + right) / 2, (top + bottom) / 2);
        return {
          hand,
          x: image.x,
          y: image.y,
          rotation: image.rotation,
          semanticRotation: held.semanticRotation,
          originX: image.originX,
          originY: image.originY,
          scaleX: image.scaleX,
          scaleY: image.scaleY,
          renderedLengthPx: Math.hypot(b.x - a.x, b.y - a.y),
          renderedHeightPx: Math.hypot(d.x - a.x, d.y - a.y),
          center,
          handPosition: { x: held.hand.img.x, y: held.hand.img.y },
          handToWeaponDistance: Math.hypot(held.hand.img.x - image.x, held.hand.img.y - image.y),
          corners: [a, b, c, d],
        };
      });

      const muzzles = [0, 1].map((hand) => {
        const out = { x: 0, y: 0 };
        const points = rig.weaponDef?.muzzle?.points ?? [];
        const pointIndex = hand === 0 ? 0 : Math.min(1, Math.max(0, points.length - 1));
        return {
          hand,
          visible: rig.writeWeaponMuzzle(hand, out, pointIndex),
          x: out.x,
          y: out.y,
        };
      });
      const shotMuzzle = { x: 0, y: 0 };
      const shotMuzzleVisible = rig.writeWeaponMuzzleForShot(self.attackSeq, 0, shotMuzzle);

      let projectile: Record<string, any> | null = null;
      for (const view of arena.projectiles.values()) {
        if (view.getData("sourceWeapon") !== wanted) continue;
        const payload = view.getData("arcPayload");
        const blade = payload?.getData?.("barrelRollBlade");
        projectile = {
          x: view.x,
          y: view.y,
          spriteId: view.getData("spriteId"),
          spawnAnchorKind: view.getData("spawnAnchorKind"),
          spawnMuzzleX: view.getData("spawnMuzzleX"),
          spawnMuzzleY: view.getData("spawnMuzzleY"),
          spawnThrowX: view.getData("spawnThrowX"),
          spawnThrowY: view.getData("spawnThrowY"),
          displayWidth: blade ? Math.abs(blade.displayWidth * (payload.scaleX ?? 1)) : null,
          displayHeight: blade ? Math.abs(blade.displayHeight * (payload.scaleY ?? 1)) : null,
        };
      }
      const muzzleAnchorError =
        projectile &&
        Number.isFinite(projectile.spawnMuzzleX) &&
        Number.isFinite(projectile.spawnMuzzleY) &&
        shotMuzzleVisible
          ? Math.hypot(
              projectile.spawnMuzzleX - shotMuzzle.x,
              projectile.spawnMuzzleY - shotMuzzle.y,
            )
          : null;

      return {
        character: self.character,
        authorityWeapon: self.weapon,
        attackSeq: self.attackSeq,
        facingValue: rig.facing,
        facingBlend: rig.facingBlend,
        displayLength: rig.weaponDef.displayLength,
        collisionLength: rig.weaponDef.collisionLength ?? null,
        recoilHand: rig.gunRecoilHand,
        recoilElapsedMs: arena.animClock - rig.gunRecoilAtMs,
        performance: {
          phase: rig.performanceInput?.phase,
          phaseT: rig.performanceInput?.phaseT,
          active: rig.performanceSample?.active,
          weaponAngle: rig.performanceSample?.weaponAngle,
          backHandBlend: rig.performanceSample?.backHandBlend,
          bodyForward: rig.performanceSample?.bodyForward,
          bodyLateral: rig.performanceSample?.bodyLateral,
          bodyTurn: rig.performanceSample?.bodyTurn,
          frontFootForward: rig.performanceSample?.frontFootForward,
          backFootForward: rig.performanceSample?.backFootForward,
          footBlend: rig.performanceSample?.footBlend,
        },
        flourish: {
          active: rig.flourishChannels?.[0]?.active,
          moment: rig.flourishChannels?.[0]?.moment,
          rotationRad: rig.flourishSamples?.[0]?.weaponRotationRad,
          ownership: rig.flourishSamples?.[0]?.ownership,
          arm: { ...rig.flourishArms?.[0] },
          streak: { ...rig.flourishStreaks?.[0] },
          cancelEdge: rig.flourishCancelEdge,
        },
        hammer: { ...rig.revolverHammerBeat },
        weaponRows,
        weaponVerticalGap:
          weaponRows.length > 1 ? Math.abs(weaponRows[1].y - weaponRows[0].y) : null,
        muzzleRows: muzzles,
        muzzleVerticalGap:
          muzzles.every((entry) => entry.visible) ? Math.abs(muzzles[1].y - muzzles[0].y) : null,
        shotMuzzle: { visible: shotMuzzleVisible, ...shotMuzzle },
        muzzleAnchorError,
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
          return {
            authority: self?.weapon,
            rendered: rig?.weaponDef?.id,
            character: self?.character,
            wanted,
          };
        }, weaponId),
      { message: `B29 should equip ${weaponId}`, timeout: 20_000 },
    )
    .toEqual({
      authority: weaponId,
      rendered: weaponId,
      character: CHARACTER_ID,
      wanted: weaponId,
    });
  await page.waitForTimeout(550);
}

async function commitFacing(page: Page, facing: Facing): Promise<void> {
  const canvas = page.locator("#game-root canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("B29 could not locate the live Phaser canvas");
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
          return {
            facing: rig?.facing,
            blendError: Math.abs((rig?.facingBlend ?? 0) - expected),
          };
        }, wanted),
      { message: `B29 actor should settle ${facing}`, timeout: 10_000 },
    )
    .toMatchObject({ facing: wanted, blendError: expect.any(Number) });
  await expect
    .poll(
      () =>
        page.evaluate((expected) => {
          const arena = (globalThis as any).ddGame.scene.getScene("arena");
          return Math.abs((arena.blobs.get(arena.room.sessionId)?.facingBlend ?? 0) - expected);
        }, wanted),
      { timeout: 10_000 },
    )
    .toBeLessThan(0.02);
}

async function pauseIdle(page: Page, weaponId: string): Promise<Record<string, any>> {
  await expect
    .poll(
      () =>
        page.evaluate((wanted) => {
          const arena = (globalThis as any).ddGame.scene.getScene("arena");
          const rig = arena.blobs.get(arena.room.sessionId);
          return (
            rig?.weaponDef?.id === wanted &&
            rig?.performanceInput?.phase === "idle" &&
            !rig?.flourishChannels?.some((channel: any) => channel.active)
          );
        }, weaponId),
      { message: `${weaponId} should settle into its authored idle`, timeout: 10_000 },
    )
    .toBe(true);
  return await page.evaluate((wanted) => {
    const holder = globalThis as any;
    const arena = holder.ddGame.scene.getScene("arena");
    arena.scene.pause();
    return holder.__ddB29Snapshot(wanted);
  }, weaponId);
}

async function captureMotion(
  page: Page,
  weaponId: string,
  facing: Facing,
  kind: MotionKind,
  avoidHand?: number,
): Promise<Record<string, any>> {
  return await page.evaluate(
    ({ wanted, direction, motionKind, priorHand }) =>
      new Promise<Record<string, any>>((resolve, reject) => {
        const holder = globalThis as any;
        const arena = holder.ddGame.scene.getScene("arena");
        const self = arena.room.state.players.get(arena.room.sessionId);
        const initialSeq = self.attackSeq;
        const startedAt = performance.now();
        let accepted = false;
        let lastAttemptAt = -1e9;
        let freezing = false;
        const observed = {
          phases: new Set<string>(),
          maxBodyForward: Number.NEGATIVE_INFINITY,
          maxFrontFootForward: Number.NEGATIVE_INFINITY,
          projectileWidths: [] as number[],
          activeFrames: [] as Array<Record<string, number>>,
          flourishMoments: new Set<string>(),
          maxFlourishRotation: 0,
          maxWeaponVerticalGap: 0,
          minRecoilElapsedMs: Number.POSITIVE_INFINITY,
          recoilHands: new Set<number>(),
          last: null as Record<string, any> | null,
        };

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
          accepted = accepted || ((current?.attackSeq ?? initialSeq) - initialSeq >>> 0) > 0;
          if (!accepted && now - lastAttemptAt > 180) attempt(now);
          if (accepted || motionKind === "revolver-hammer") {
            const snapshot = holder.__ddB29Snapshot(wanted);
            observed.last = snapshot;
            observed.phases.add(String(snapshot.performance.phase));
            observed.maxBodyForward = Math.max(
              observed.maxBodyForward,
              Number(snapshot.performance.bodyForward),
            );
            observed.maxFrontFootForward = Math.max(
              observed.maxFrontFootForward,
              Number(snapshot.performance.frontFootForward),
            );
            if (Number.isFinite(snapshot.projectile?.displayWidth))
              observed.projectileWidths.push(snapshot.projectile.displayWidth);
            if (snapshot.flourish.active) {
              observed.flourishMoments.add(String(snapshot.flourish.moment));
              observed.maxFlourishRotation = Math.max(
                observed.maxFlourishRotation,
                Math.abs(Number(snapshot.flourish.rotationRad)),
              );
            }
            if (Number.isFinite(snapshot.weaponVerticalGap))
              observed.maxWeaponVerticalGap = Math.max(
                observed.maxWeaponVerticalGap,
                snapshot.weaponVerticalGap,
              );
            if (Number.isFinite(snapshot.recoilElapsedMs))
              observed.minRecoilElapsedMs = Math.min(
                observed.minRecoilElapsedMs,
                snapshot.recoilElapsedMs,
              );
            observed.recoilHands.add(Number(snapshot.recoilHand));
            if (
              snapshot.performance.phase === "active" &&
              observed.activeFrames.length < 24
            )
              observed.activeFrames.push({
                phaseT: snapshot.performance.phaseT,
                bodyForward: snapshot.performance.bodyForward,
                frontFootForward: snapshot.performance.frontFootForward,
                backFootForward: snapshot.performance.backFootForward,
                footBlend: snapshot.performance.footBlend,
              });
            const condition =
              motionKind === "throw-release"
                ? snapshot.performance.phase !== "idle" &&
                  snapshot.performance.bodyForward > 0.03 &&
                  snapshot.performance.frontFootForward > 0.09 &&
                  snapshot.performance.footBlend > 0.8
                : motionKind === "throw-projectile"
                  ? snapshot.projectile?.spawnAnchorKind === "throw" &&
                    Number.isFinite(snapshot.projectile?.displayWidth)
                  : motionKind === "kunai-twirl"
                  ? snapshot.flourish.active &&
                    snapshot.flourish.moment === "after-attack" &&
                    Math.abs(snapshot.flourish.rotationRad) > 1
                  : motionKind === "dual-fire"
                    ? snapshot.recoilElapsedMs >= 0 &&
                      snapshot.recoilElapsedMs < 180 &&
                      snapshot.weaponVerticalGap > 12
                    : snapshot.hammer.active &&
                      Math.abs(snapshot.hammer.weaponRotationRad) > 0.12 &&
                      (priorHand === undefined || snapshot.recoilHand !== priorHand);
            if (condition) {
              freezing = true;
              arena.scene.pause();
              const frozen = holder.__ddB29Snapshot(wanted);
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
                if (performance.now() - startedAt > 8_000) {
                  reject(new Error(`B29 presentation fired but authority rejected ${wanted}`));
                  return;
                }
                window.setTimeout(waitForAuthority, 5);
              };
              waitForAuthority();
              return;
            }
          }
          if (freezing) return;
          if (now - startedAt > 8_000) {
            reject(
              new Error(
                `B29 timed out capturing ${motionKind} for ${wanted}; ${JSON.stringify({
                  accepted,
                  phases: [...observed.phases],
                  maxBodyForward: observed.maxBodyForward,
                  maxFrontFootForward: observed.maxFrontFootForward,
                  projectileWidths: observed.projectileWidths,
                  activeFrames: observed.activeFrames,
                  flourishMoments: [...observed.flourishMoments],
                  maxFlourishRotation: observed.maxFlourishRotation,
                  maxWeaponVerticalGap: observed.maxWeaponVerticalGap,
                  minRecoilElapsedMs: observed.minRecoilElapsedMs,
                  recoilHands: [...observed.recoilHands],
                  last: observed.last
                    ? {
                        performance: observed.last.performance,
                        flourish: observed.last.flourish,
                        projectile: observed.last.projectile,
                        attackSeq: observed.last.attackSeq,
                      }
                    : null,
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
      wanted: weaponId,
      direction: facing === "right" ? 1 : -1,
      motionKind: kind,
      priorHand: avoidHand,
    },
  );
}

async function savePausedCapture(
  page: Page,
  captures: EvidenceCapture[],
  label: string,
  weaponId: string,
  facing: Facing,
  snapshot: Record<string, any>,
  resumeDelayMs = 320,
): Promise<void> {
  const screenshotFile = path.join(EVIDENCE_DIR, `${label}.png`);
  await page.locator("#game-root canvas").screenshot({ path: screenshotFile });
  captures.push({
    label,
    weaponId,
    facing,
    screenshot: evidencePath(screenshotFile),
    snapshot,
  });
  await page.evaluate(() => {
    const arena = (globalThis as any).ddGame.scene.getScene("arena");
    arena.scene.resume();
  });
  if (resumeDelayMs > 0) await page.waitForTimeout(resumeDelayMs);
}

function assertFacing(snapshot: Record<string, any>, facing: Facing): void {
  expect(snapshot.character).toBe(CHARACTER_ID);
  expect(snapshot.facingValue).toBe(facing === "right" ? 1 : -1);
  expect(Math.abs(snapshot.facingBlend - (facing === "right" ? 1 : -1))).toBeLessThan(0.02);
}

test("B29 ranged presentation survives both facings on private ephemeral ports", async ({ page }) => {
  test.setTimeout(240_000);
  await runArenaSpec(page, async (baseURL) => {
    await mkdir(EVIDENCE_DIR, { recursive: true });
    await page.setViewportSize({ width: 800, height: 450 });
    await bootPrivateArena(page, baseURL);

    const clientPort = Number(new URL(baseURL).port);
    const gamePort = Number(new URL(page.url()).searchParams.get("port"));
    expect(Number.isInteger(clientPort) && clientPort > 0).toBe(true);
    expect(Number.isInteger(gamePort) && gamePort > 0).toBe(true);
    expect(FORBIDDEN_PORTS.has(clientPort), "client port must be private ephemeral").toBe(false);
    expect(FORBIDDEN_PORTS.has(gamePort), "game port must be private ephemeral").toBe(false);

    const captures: EvidenceCapture[] = [];

    for (const fixture of THROW_FIXTURES) {
      await equip(page, fixture.id);
      for (const facing of FACINGS) {
        await commitFacing(page, facing);
        const idle = await pauseIdle(page, fixture.id);
        assertFacing(idle, facing);
        expect(idle.displayLength).toBe(fixture.displayLength);
        expect(idle.collisionLength).toBe(fixture.collisionLength);
        expect(idle.weaponRows[0].renderedLengthPx).toBeCloseTo(fixture.displayLength, 0);
        expect(idle.performance.phase).toBe("idle");
        expect(idle.performance.backHandBlend).toBeGreaterThan(0.9);
        expect(idle.performance.footBlend).toBeGreaterThan(0.7);
        await savePausedCapture(
          page,
          captures,
          `${fixture.id}-${facing}-ready-idle`,
          fixture.id,
          facing,
          idle,
        );

        const release = await captureMotion(page, fixture.id, facing, "throw-release");
        assertFacing(release, facing);
        expect(release.performance.phase).not.toBe("idle");
        expect(release.performance.bodyForward).toBeGreaterThan(0.03);
        expect(release.performance.frontFootForward).toBeGreaterThan(0.09);
        expect(release.performance.backFootForward).toBeLessThan(-0.08);
        expect(release.performance.footBlend).toBeGreaterThan(0.8);
        await savePausedCapture(
          page,
          captures,
          `${fixture.id}-${facing}-engaged-release`,
          fixture.id,
          facing,
          release,
          0,
        );

        const projectile = await captureMotion(
          page,
          fixture.id,
          facing,
          "throw-projectile",
        );
        assertFacing(projectile, facing);
        expect(projectile.projectile?.displayWidth).toBeCloseTo(fixture.displayLength, 0);
        expect(projectile.projectile?.spawnAnchorKind).toBe("throw");
        await savePausedCapture(
          page,
          captures,
          `${fixture.id}-${facing}-resized-projectile`,
          fixture.id,
          facing,
          projectile,
        );
      }
    }

    await equip(page, "x2-kunai");
    for (const facing of FACINGS) {
      await commitFacing(page, facing);
      const twirl = await captureMotion(page, "x2-kunai", facing, "kunai-twirl");
      assertFacing(twirl, facing);
      expect(twirl.displayLength).toBe(72);
      expect(twirl.flourish.moment).toBe("after-attack");
      expect(Math.abs(twirl.flourish.rotationRad)).toBeGreaterThan(1);
      expect(twirl.weaponRows[0].originX).toBeCloseTo(0.073, 3);
      expect(twirl.weaponRows[0].originY).toBeCloseTo(0.5, 3);
      await savePausedCapture(
        page,
        captures,
        `x2-kunai-${facing}-end-hook-twirl`,
        "x2-kunai",
        facing,
        twirl,
      );
    }

    await equip(page, "x2-coyote-stinger");
    for (const facing of FACINGS) {
      await commitFacing(page, facing);
      const firing = await captureMotion(page, "x2-coyote-stinger", facing, "dual-fire");
      assertFacing(firing, facing);
      expect(firing.weaponRows).toHaveLength(2);
      expect(firing.weaponVerticalGap).toBeGreaterThan(12);
      expect(firing.muzzleRows.every((entry: any) => entry.visible)).toBe(true);
      expect(firing.muzzleVerticalGap).toBeGreaterThan(8);
      expect(firing.shotMuzzle.visible).toBe(true);
      expect(firing.muzzleAnchorError).not.toBeNull();
      expect(firing.muzzleAnchorError).toBeLessThan(18);
      await savePausedCapture(
        page,
        captures,
        `x2-coyote-stinger-${facing}-vertical-fire`,
        "x2-coyote-stinger",
        facing,
        firing,
      );
    }

    await equip(page, "x-gun-revolver-cannon");
    for (const facing of FACINGS) {
      await commitFacing(page, facing);
      const hammer = await captureMotion(
        page,
        "x-gun-revolver-cannon",
        facing,
        "revolver-hammer",
      );
      assertFacing(hammer, facing);
      expect(hammer.authorityAcceptedAtCapture).toBe(true);
      expect(hammer.hammer.active).toBe(true);
      expect(Math.abs(hammer.hammer.weaponRotationRad)).toBeGreaterThan(0.12);
      expect(hammer.weaponRows[0].handToWeaponDistance).toBeGreaterThan(3);
      await savePausedCapture(
        page,
        captures,
        `x-gun-revolver-cannon-${facing}-hammer-pull`,
        "x-gun-revolver-cannon",
        facing,
        hammer,
      );
    }

    await equip(page, "x2-twin-maw-greenerbore");
    const twinMawHands: Record<Facing, number[]> = { right: [], left: [] };
    for (const facing of FACINGS) {
      await commitFacing(page, facing);
      const first = await captureMotion(
        page,
        "x2-twin-maw-greenerbore",
        facing,
        "revolver-hammer",
      );
      assertFacing(first, facing);
      expect(first.authorityAcceptedAtCapture).toBe(true);
      expect(first.weaponRows).toHaveLength(2);
      expect(first.hammer.active).toBe(true);
      expect(first.weaponRows[first.recoilHand].handToWeaponDistance).toBeGreaterThan(8);
      twinMawHands[facing].push(first.recoilHand);
      await savePausedCapture(
        page,
        captures,
        `x2-twin-maw-greenerbore-${facing}-hand-${first.recoilHand}-fan`,
        "x2-twin-maw-greenerbore",
        facing,
        first,
      );

      const second = await captureMotion(
        page,
        "x2-twin-maw-greenerbore",
        facing,
        "revolver-hammer",
        first.recoilHand,
      );
      assertFacing(second, facing);
      expect(second.authorityAcceptedAtCapture).toBe(true);
      expect(second.recoilHand).not.toBe(first.recoilHand);
      expect(second.hammer.active).toBe(true);
      expect(second.weaponRows[second.recoilHand].handToWeaponDistance).toBeGreaterThan(8);
      twinMawHands[facing].push(second.recoilHand);
      await savePausedCapture(
        page,
        captures,
        `x2-twin-maw-greenerbore-${facing}-hand-${second.recoilHand}-fan`,
        "x2-twin-maw-greenerbore",
        facing,
        second,
      );
    }
    expect([...twinMawHands.right].sort()).toEqual([0, 1]);
    expect([...twinMawHands.left].sort()).toEqual([0, 1]);

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
      representativeFixtures: {
        shuriken: "x2-iron-throwing-star",
        chakram: "x2-iron-chakram",
        kunai: "x2-kunai",
        authoredDualGun: "x2-coyote-stinger",
        oneHandedRevolver: "x-gun-revolver-cannon",
        pairedFanHammer: "x2-twin-maw-greenerbore",
      },
      twinMawHands,
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
        "# B29 ranged presentation private live gate",
        "",
        `Verdict: PASS - ${captures.length} combat-scale captures across both facings.`,
        "",
        `Character: \`${CHARACTER_ID}\``,
        "",
        `Private ephemeral ports: client \`${clientPort}\`, game \`${gamePort}\`; defaults 5180/2567 were not used.`,
        "",
        "Captured: ready and engaged shuriken/chakram poses with own-sprite projectiles, kunai",
        "end-hook twirl, separated authored dual guns with live muzzle anchoring, one-handed",
        "revolver hammer pull, and alternating per-hand Twin-Maw fan-hammer beats.",
        "",
        "Machine-readable rig channels, world transforms, muzzle/projectile receipts, and screenshot",
        "paths are in `live-gate.json`.",
        "",
      ].join("\n"),
      "utf8",
    );
  });
});
