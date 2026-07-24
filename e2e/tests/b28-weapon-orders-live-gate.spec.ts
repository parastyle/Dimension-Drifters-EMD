import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { runArenaSpec } from "../helpers/arena-harness.js";

const CHARACTER_ID = "proto-cowboy-hidden-face";
const FORBIDDEN_PORTS = new Set([5180, 2567]);
const FACINGS = ["right", "left"] as const;
const WEAPON_IDS = [
  "drift-greatkatana-tempest-regent",
  "drift-nodachi-gatebreaker",
  "twin-bowie-fangs",
  "x2-thunderhead-voulge",
  "x2-sidewinder-spontoon",
  "x2-venomtongue-trident",
  "x2-squeaky-mallet",
  "x2-dustreaper-zweihander",
  "x2-buckshot-bramble-bow",
] as const;
const LIVE_WEAPON_IDS = process.env.B28_LIVE_WEAPON
  ? WEAPON_IDS.filter((weaponId) => weaponId === process.env.B28_LIVE_WEAPON)
  : [...WEAPON_IDS];
const EVIDENCE_DIR = path.resolve(
  import.meta.dirname,
  "../../docs/owner-notes-audit-v11-evidence/b28-weapon-orders",
);

type Facing = (typeof FACINGS)[number];
type WeaponId = (typeof WEAPON_IDS)[number];

interface ThrowSample {
  readonly heading: number;
  readonly rotation: number;
  readonly scaleRatio: number;
  readonly elapsedSeconds: number;
}

interface LiveCapture {
  readonly weaponId: WeaponId;
  readonly facing: Facing;
  readonly attackSeqBefore: number;
  readonly attackSeqAfter: number;
  readonly startX: number;
  readonly endX: number;
  readonly lungeDelta: number;
  readonly facingValue: number;
  readonly displayLength: number;
  readonly collisionLength: number | null;
  readonly renderedLengthPx: number;
  readonly gripPoints: unknown;
  readonly chainLightning: unknown;
  readonly layerIds: string[];
  readonly generatedEvents: Array<Record<string, unknown>>;
  readonly projectileCount: number;
  readonly projectileRows: Array<Record<string, unknown>>;
  readonly throwScaleRatio: number | null;
  readonly dustreaperAttachmentError: number | null;
  readonly dustreaperPhysicalBladeLength: number | null;
  readonly dustreaperOverlayLength: number | null;
  readonly throwSamples: ThrowSample[];
  readonly screenshot: string;
}

type MeasuredCapture = Omit<
  LiveCapture,
  "weaponId" | "facing" | "attackSeqBefore" | "startX" | "lungeDelta" | "throwSamples" | "screenshot"
>;

function evidencePath(file: string): string {
  return path.relative(process.cwd(), file).replaceAll("\\", "/");
}

async function bootPrivateArena(page: Page, baseURL: string, gamePort: number): Promise<void> {
  await page.goto(
    `${baseURL}/?port=${gamePort}&dev=char:${encodeURIComponent(CHARACTER_ID)}`,
    { waitUntil: "domcontentloaded" },
  );
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
            return { mode: arena.room?.state?.mode, character: self?.character };
          })
          .catch(() => null),
      { message: "B28 private arena should become live", timeout: 30_000 },
    )
    .toMatchObject({ mode: "training", character: CHARACTER_ID });

  await page.locator("#game-root canvas").click({ position: { x: 640, y: 360 } });
  await page.evaluate(() => {
    const holder = globalThis as unknown as {
      ddGame: { scene: { getScene(key: string): any } };
      __ddV6GAnchorCapture?: boolean;
      __ddV6GAnchorEvents?: Array<Record<string, unknown>>;
      __ddB11GeneratedImageVfxAudit?: Array<Record<string, unknown>>;
      __ddB28BarrelRollAudit?: Array<ThrowSample & { weaponId: string }>;
    };
    const arena = holder.ddGame.scene.getScene("arena");
    if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend?.(arena.time.now);
    arena.verbs?.releaseInputLatchIf?.(true);
    arena.game.hasFocus = true;
    arena.pointerOverInteractiveUi = false;
    arena.cameras.main.setZoom(1.25);
    holder.__ddV6GAnchorCapture = true;
    holder.__ddV6GAnchorEvents = [];
    holder.__ddB11GeneratedImageVfxAudit = [];
    holder.__ddB28BarrelRollAudit = [];
  });
}

async function equip(page: Page, weaponId: WeaponId): Promise<void> {
  await page.evaluate(
    ({ weapon, character }) => {
      const arena = (globalThis as unknown as { ddGame: any }).ddGame.scene.getScene("arena");
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
            authorityWeapon: self?.weapon,
            rigWeapon: rig?.weaponDef?.id,
            character: self?.character,
            wanted,
          };
        }, weaponId),
      { message: `B28 should equip ${weaponId}`, timeout: 20_000 },
    )
    .toEqual({
      authorityWeapon: weaponId,
      rigWeapon: weaponId,
      character: CHARACTER_ID,
      wanted: weaponId,
    });
}

async function commitFacing(page: Page, weaponId: WeaponId, facing: Facing): Promise<void> {
  const canvas = page.locator("#game-root canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("B28 could not locate the live Phaser canvas");
  await page.mouse.move(
    box.x + box.width * (facing === "right" ? 0.9 : 0.1),
    box.y + box.height * 0.5,
  );
  const wanted = facing === "right" ? 1 : -1;
  await expect
    .poll(
      () =>
        page.evaluate((expected) => {
          const arena = (globalThis as unknown as { ddGame: any }).ddGame.scene.getScene("arena");
          const rig = arena.blobs.get(arena.room.sessionId);
          return { facing: rig?.facing, blendError: Math.abs((rig?.facingBlend ?? 0) - expected) };
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

async function fire(page: Page, weaponId: WeaponId, facing: Facing) {
  await page.waitForTimeout(250);
  const start = await page.evaluate(
    ({ weapon }) => {
      const holder = globalThis as unknown as {
        ddGame: any;
        __ddV6GAnchorEvents?: Array<Record<string, unknown>>;
        __ddB11GeneratedImageVfxAudit?: Array<Record<string, unknown>>;
        __ddB28BarrelRollAudit?: Array<ThrowSample & { weaponId: string }>;
        __ddB28PauseGeneratedImageWeaponId?: string;
      };
      const arena = holder.ddGame.scene.getScene("arena");
      const self = arena.room.state.players.get(arena.room.sessionId);
      if (!self || self.weapon !== weapon) throw new Error(`B28 lost ${weapon} before firing`);
      holder.__ddV6GAnchorEvents = [];
      holder.__ddB11GeneratedImageVfxAudit = [];
      holder.__ddB28BarrelRollAudit = [];
      holder.__ddB28PauseGeneratedImageWeaponId =
        weapon === "x2-dustreaper-zweihander" ? weapon : undefined;
      return { attackSeq: self.attackSeq, x: self.x };
    },
    { weapon: weaponId },
  );
  await expect
    .poll(
      () =>
        page.evaluate(({ initial, facing }) => {
          const arena = (globalThis as unknown as { ddGame: any }).ddGame.scene.getScene("arena");
          const self = arena.room.state.players.get(arena.room.sessionId);
          const current = self?.attackSeq ?? 0;
          if (((current - initial) >>> 0) > 0) return current;
          const direction = facing === "right" ? 1 : -1;
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
          return current;
        }, { initial: start.attackSeq, facing }),
      { message: `${weaponId}/${facing} should be accepted`, timeout: 12_000 },
    )
    .toBeGreaterThan(start.attackSeq);
  return start;
}

async function liveSnapshot(page: Page, weaponId: WeaponId): Promise<MeasuredCapture> {
  return await page.evaluate((wanted) => {
    const holder = globalThis as unknown as {
      ddGame: any;
      __ddV6GAnchorEvents?: Array<Record<string, unknown>>;
      __ddB11GeneratedImageVfxAudit?: Array<Record<string, unknown>>;
    };
    const arena = holder.ddGame.scene.getScene("arena");
    const self = arena.room.state.players.get(arena.room.sessionId);
    const rig = arena.blobs.get(arena.room.sessionId);
    const held = rig?.weapons.find((candidate: any) => candidate.def.id === wanted);
    if (!self || !rig || !held) throw new Error(`B28 snapshot could not resolve ${wanted}`);

    const image = held.img;
    const matrix = image.getWorldTransformMatrix();
    const left = -image.displayOriginX;
    const top = -image.displayOriginY;
    const right = left + image.width;
    const topLeft = matrix.transformPoint(left, top);
    const topRight = matrix.transformPoint(right, top);

    const projectileRows: Array<Record<string, unknown>> = [];
    let latestBornTick = -1;
    arena.room.state.projectiles.forEach((row: any, id: string) => {
      if (row.sourcePlayerId !== arena.room.sessionId || row.sourceWeaponId !== wanted) return;
      if (row.bornTick > latestBornTick) {
        latestBornTick = row.bornTick;
        projectileRows.length = 0;
      }
      if (row.bornTick === latestBornTick)
        projectileRows.push({
          id,
          bornTick: row.bornTick,
          vx: row.vx,
          vy: row.vy,
          kind: row.kind,
        });
    });

    const firstProjectileId = projectileRows[0]?.id;
    const view = typeof firstProjectileId === "string" ? arena.projectiles.get(firstProjectileId) : undefined;
    const payload = view?.getData?.("arcPayload");
    const blade = payload?.getData?.("barrelRollBlade");
    const baseScaleY = Number(payload?.getData?.("barrelRollBaseScaleY") ?? 0);
    const throwScaleRatio =
      blade && Math.abs(baseScaleY) > 1e-6 ? Number(blade.scaleY) / baseScaleY : null;

    const generated = arena.children.list.find(
      (child: any) =>
        child.name === `generated-image-vfx:${wanted}:fire-dragon` &&
        child.visible !== false &&
        (child.alpha ?? 1) > 0.05,
    );
    const pose = wanted === "x2-dustreaper-zweihander" ? rig.leadWeaponTipPose?.() : undefined;
    const generatedTip =
      generated && Number.isFinite(generated.displayWidth)
        ? {
            x: generated.x + Math.cos(generated.rotation) * generated.displayWidth,
            y: generated.y + Math.sin(generated.rotation) * generated.displayWidth,
          }
        : undefined;

    const layerIds = [
      ...new Set(
        (holder.__ddV6GAnchorEvents ?? [])
          .filter((event) => event.weaponId === wanted && event.kind === "weapon-vfx-suite")
          .flatMap((event) => (Array.isArray(event.layerIds) ? (event.layerIds as string[]) : [])),
      ),
    ];
    const generatedEvents = (holder.__ddB11GeneratedImageVfxAudit ?? []).filter(
      (event) => event.weaponId === wanted,
    );
    const generatedSwing = generatedEvents.find((event) => event.kind === "swing");
    const auditedAttachmentError = Number(generatedSwing?.heldBladeAttachmentError);
    const auditedPhysicalLength = Number(generatedSwing?.heldBladePhysicalLength);
    const auditedOverlayLength = Number(generatedSwing?.visibleForwardExtent);
    return {
      attackSeqAfter: self.attackSeq,
      endX: self.x,
      facingValue: rig.facing,
      displayLength: held.def.displayLength,
      collisionLength: held.def.collisionLength ?? null,
      renderedLengthPx: Math.hypot(topRight.x - topLeft.x, topRight.y - topLeft.y),
      gripPoints: rig.weaponDef?.gripPoints ?? null,
      chainLightning: rig.weaponDef?.chainLightning ?? null,
      layerIds,
      generatedEvents,
      projectileCount: projectileRows.length,
      projectileRows,
      throwScaleRatio,
      dustreaperAttachmentError:
        pose && generatedTip
          ? Math.hypot(generatedTip.x - pose.x, generatedTip.y - pose.y)
          : Number.isFinite(auditedAttachmentError)
            ? auditedAttachmentError
            : null,
      dustreaperPhysicalBladeLength:
        pose?.physicalBladeLength ??
        (Number.isFinite(auditedPhysicalLength) ? auditedPhysicalLength : null),
      dustreaperOverlayLength:
        generated?.displayWidth ??
        (Number.isFinite(auditedOverlayLength) ? auditedOverlayLength : null),
    };
  }, weaponId);
}

async function waitForOrderedFrame(
  page: Page,
  weaponId: WeaponId,
  startX: number,
  facing: Facing,
): Promise<MeasuredCapture | undefined> {
  if (
    weaponId === "x2-sidewinder-spontoon" ||
    weaponId === "x2-buckshot-bramble-bow"
  ) {
    let observed: MeasuredCapture | undefined;
    await expect
      .poll(async () => {
        const sample = await liveSnapshot(page, weaponId);
        if (sample.projectileCount > 0) observed = sample;
        return sample.projectileCount;
      }, {
        message: `${weaponId}/${facing} should show its authoritative projectile volley`,
        timeout: 10_000,
        intervals: [10, 16, 25],
      })
      .toBeGreaterThan(0);
    if (weaponId === "x2-sidewinder-spontoon") {
      await expect
        .poll(
          () =>
            page.evaluate(
              (wanted) =>
                Math.min(
                  1,
                  ...(
                    (
                      globalThis as unknown as {
                        __ddB28BarrelRollAudit?: Array<ThrowSample & { weaponId: string }>;
                      }
                    ).__ddB28BarrelRollAudit ?? []
                  )
                    .filter((sample) => sample.weaponId === wanted)
                    .map((sample) => Math.abs(sample.scaleRatio)),
                ),
              weaponId,
            ),
          {
            message: "Spontoon should reach a paper-flip edge-on frame",
            timeout: 2_000,
            intervals: [5, 10],
          },
        )
        .toBeLessThan(0.25);
    }
    return observed;
  }
  if (weaponId === "x2-venomtongue-trident") {
    const direction = facing === "right" ? 1 : -1;
    await expect
      .poll(
        async () => ((await liveSnapshot(page, weaponId)).endX - startX) * direction,
        { message: "Venomtongue should visibly reach its 128 px endpoint", timeout: 10_000 },
      )
      .toBeGreaterThan(122);
    return undefined;
  }
  if (weaponId === "x2-dustreaper-zweihander") {
    let observed: MeasuredCapture | undefined;
    await expect
      .poll(async () => {
        const sample = await liveSnapshot(page, weaponId);
        if (sample.dustreaperAttachmentError !== null) observed = sample;
        return sample.dustreaperAttachmentError;
      }, {
        message: "Dustreaper fire should attach to the held blade tip",
        timeout: 10_000,
        intervals: [5, 10, 16],
      })
      .not.toBeNull();
    return observed;
  }
  if (
    weaponId === "drift-greatkatana-tempest-regent" ||
    weaponId === "drift-nodachi-gatebreaker"
  ) {
    await expect
      .poll(async () => (await liveSnapshot(page, weaponId)).layerIds.length, {
        message: `${weaponId} should emit its one authored layer`,
        timeout: 10_000,
      })
      .toBe(1);
    return undefined;
  }
  await page.waitForTimeout(90);
  return undefined;
}

async function collectThrowSamples(page: Page, weaponId: WeaponId): Promise<ThrowSample[]> {
  return await page.evaluate(
    (wanted) =>
      (
        (
          globalThis as unknown as {
            __ddB28BarrelRollAudit?: Array<ThrowSample & { weaponId: string }>;
          }
        ).__ddB28BarrelRollAudit ?? []
      )
        .filter((sample) => sample.weaponId === wanted)
        .map(({ heading, rotation, scaleRatio, elapsedSeconds }) => ({
          heading,
          rotation,
          scaleRatio,
          elapsedSeconds,
        })),
    weaponId,
  );
}

function assertOrder(capture: LiveCapture): void {
  expect(capture.attackSeqAfter, `${capture.weaponId}/${capture.facing}: accepted`).toBeGreaterThan(
    capture.attackSeqBefore,
  );
  expect(capture.facingValue).toBe(capture.facing === "right" ? 1 : -1);
  switch (capture.weaponId) {
    case "drift-greatkatana-tempest-regent":
      expect(capture.layerIds).toEqual(["edge-trail"]);
      break;
    case "drift-nodachi-gatebreaker":
      expect(capture.layerIds).toEqual(["slash-arc"]);
      break;
    case "twin-bowie-fangs":
      expect(capture.displayLength).toBe(124);
      expect(capture.collisionLength).toBe(62);
      break;
    case "x2-thunderhead-voulge":
      expect(capture.layerIds).toEqual([]);
      expect(capture.generatedEvents).toEqual([]);
      expect(capture.chainLightning).toMatchObject({ jumps: 4, damage: 6, falloff: 0.8 });
      break;
    case "x2-sidewinder-spontoon": {
      expect(capture.projectileCount).toBeGreaterThan(0);
      expect(capture.throwSamples.length).toBeGreaterThan(6);
      expect(Math.min(...capture.throwSamples.map((sample) => sample.scaleRatio))).toBeLessThan(-0.5);
      expect(Math.max(...capture.throwSamples.map((sample) => sample.scaleRatio))).toBeGreaterThan(0.5);
      for (const sample of capture.throwSamples) {
        const error = Math.atan2(
          Math.sin(sample.rotation - sample.heading),
          Math.cos(sample.rotation - sample.heading),
        );
        expect(Math.abs(error)).toBeLessThan(0.02);
      }
      break;
    }
    case "x2-venomtongue-trident":
      expect(capture.lungeDelta).toBeGreaterThan(122);
      expect(capture.lungeDelta).toBeLessThanOrEqual(129);
      break;
    case "x2-squeaky-mallet":
      expect(capture.displayLength).toBeCloseTo(154.28, 8);
      expect(capture.collisionLength).toBe(90);
      expect(capture.gripPoints).toEqual({
        primary: { x: 0.14, y: 0.55 },
        secondary: { x: 0.38, y: 0.55, role: "handle" },
      });
      break;
    case "x2-dustreaper-zweihander": {
      const event = capture.generatedEvents.find((candidate) => candidate.kind === "swing");
      expect(event).toMatchObject({
        weaponId: capture.weaponId,
        recipeKind: "fire-dragon-sweep",
        proceduralLayers: [],
      });
      expect(capture.dustreaperAttachmentError).not.toBeNull();
      expect(capture.dustreaperAttachmentError ?? 999).toBeLessThan(2);
      expect(capture.dustreaperOverlayLength).toBeCloseTo(
        capture.dustreaperPhysicalBladeLength ?? 0,
        5,
      );
      expect(
        Math.abs(
          Number(event?.visibleForwardExtent) -
            (capture.dustreaperPhysicalBladeLength ?? 0),
        ),
      ).toBeLessThan(1);
      expect(event?.damageForwardExtent).toBeCloseTo(234.4, 5);
      break;
    }
    case "x2-buckshot-bramble-bow":
      expect(capture.projectileCount).toBe(3);
      break;
  }
}

test("B28 nine surviving weapon orders fire both facings on a private stack", async ({ page }) => {
  test.setTimeout(300_000);
  await runArenaSpec(page, async (baseURL) => {
    await mkdir(EVIDENCE_DIR, { recursive: true });
    await page.setViewportSize({ width: 800, height: 450 });
    const clientPort = Number(new URL(baseURL).port);
    const gamePort = Number(process.env.B28_GAME_PORT);
    expect(Number.isInteger(clientPort) && clientPort > 0).toBe(true);
    expect(Number.isInteger(gamePort) && gamePort > 0).toBe(true);
    expect(FORBIDDEN_PORTS.has(clientPort)).toBe(false);
    expect(FORBIDDEN_PORTS.has(gamePort)).toBe(false);
    await bootPrivateArena(page, baseURL, gamePort);

    const captures: LiveCapture[] = [];
    for (const weaponId of LIVE_WEAPON_IDS) {
      await equip(page, weaponId);
      for (const facing of FACINGS) {
        await commitFacing(page, weaponId, facing);
        const start = await fire(page, weaponId, facing);
        const orderedFrame = await waitForOrderedFrame(page, weaponId, start.x, facing);
        const measured = orderedFrame ?? (await liveSnapshot(page, weaponId));
        const screenshotFile = path.join(EVIDENCE_DIR, `${weaponId}-${facing}.png`);
        await page.evaluate(() => {
          const arena = (globalThis as unknown as { ddGame: any }).ddGame.scene.getScene("arena");
          arena.scene.pause();
        });
        await page.locator("#game-root canvas").screenshot({ path: screenshotFile });
        await page.evaluate(() => {
          const holder = globalThis as unknown as {
            ddGame: any;
            __ddB28PauseGeneratedImageWeaponId?: string;
          };
          const arena = holder.ddGame.scene.getScene("arena");
          holder.__ddB28PauseGeneratedImageWeaponId = undefined;
          arena.scene.resume();
        });
        const throwSamples =
          weaponId === "x2-sidewinder-spontoon"
            ? await collectThrowSamples(page, weaponId)
            : [];
        const direction = facing === "right" ? 1 : -1;
        const capture: LiveCapture = {
          weaponId,
          facing,
          attackSeqBefore: start.attackSeq,
          startX: start.x,
          lungeDelta: (measured.endX - start.x) * direction,
          throwSamples,
          screenshot: evidencePath(screenshotFile),
          ...measured,
        };
        assertOrder(capture);
        captures.push(capture);
      }
    }

    const bootArchive = await page.evaluate(async () => {
      const arena = (globalThis as unknown as { ddGame: any }).ddGame.scene.getScene("arena");
      const self = arena.room.state.players.get(arena.room.sessionId);
      const before = self.weapon;
      arena.room.send("devEquip", {
        weapon: "x2-boomerang-boot",
        character: "proto-cowboy-hidden-face",
      });
      await new Promise((resolve) => window.setTimeout(resolve, 350));
      return {
        before,
        after: arena.room.state.players.get(arena.room.sessionId)?.weapon,
        rejected: arena.room.state.players.get(arena.room.sessionId)?.weapon !== "x2-boomerang-boot",
      };
    });
    expect(bootArchive.rejected).toBe(true);

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
      survivingWeaponIds: LIVE_WEAPON_IDS,
      facings: FACINGS,
      captures,
      bootArchive,
    };
    await writeFile(
      path.join(EVIDENCE_DIR, "live-gate.json"),
      `${JSON.stringify(evidence, null, 2)}\n`,
      "utf8",
    );
    await writeFile(
      path.join(EVIDENCE_DIR, "live-gate-summary.md"),
      [
        "# B28 live-gate summary",
        "",
        `Verdict: PASS - ${captures.length} accepted attacks (${LIVE_WEAPON_IDS.length} weapons x 2 facings).`,
        "",
        `Character: \`${CHARACTER_ID}\``,
        "",
        `Private ports: client \`${clientPort}\`, game \`${gamePort}\`; this B28 gate did not use defaults 5180/2567.`,
        "",
        "Machine-readable measurements, attack receipts, VFX layers, projectile counts, affine attachment",
        "errors, archive rejection, and screenshot paths are in `live-gate.json`.",
        "",
      ].join("\n"),
      "utf8",
    );
  });
});
