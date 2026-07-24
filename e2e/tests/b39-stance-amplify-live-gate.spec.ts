// @ts-nocheck -- live evidence intentionally inspects private rig presentation channels.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import sharp from "sharp";
import { runArenaSpec } from "../helpers/arena-harness.js";

const CHARACTER_ID = "proto-cowboy-hidden-face";
const FORBIDDEN_PORTS = new Set([5180, 2567]);
const FACINGS = ["right", "left"] as const;
const VIEWPORT = { width: 800, height: 450 };
const FIXTURES = [
  {
    id: "x2-barrett-50-cal-sniper",
    label: "Bolt-action rifle",
    weaponClass: "sightedLong",
    dropPx: 18,
    nodRad: 0.11,
  },
  {
    id: "x2-sunbreaker-railgun",
    label: "Railgun",
    weaponClass: "sightedLong",
    dropPx: 18,
    nodRad: 0.11,
  },
  {
    id: "x-gun-revolver-cannon",
    label: "Pistol",
    weaponClass: "short",
    dropPx: 9,
    nodRad: 0.07,
  },
] as const;
const EVIDENCE_DIR = path.resolve(
  import.meta.dirname,
  "../../docs/owner-notes-audit-v11-evidence/b39-stance-amplify",
);

type Facing = (typeof FACINGS)[number];

interface Capture {
  label: string;
  weaponId: string;
  facing: Facing;
  screenshot: string;
  contrastScreenshot?: string;
  snapshot: Record<string, any>;
}

function repoPath(file: string): string {
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
      { message: "B39 private Testing Grounds should become live", timeout: 30_000 },
    )
    .toMatchObject({ mode: "training", character: CHARACTER_ID });

  await page.locator("#game-root canvas").click({ position: { x: 400, y: 225 } });
  await page.evaluate(() => {
    const arena = (globalThis as any).ddGame.scene.getScene("arena");
    if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend?.(arena.time.now);
    arena.verbs?.releaseInputLatchIf?.(true);
    arena.game.hasFocus = true;
    arena.pointerOverInteractiveUi = false;
    arena.cameras.main.setZoom(1.5);
    for (const key of [
      "objectiveHudGfx",
      "objectiveText",
      "objectiveLocationText",
      "objectiveEconomyText",
      "objectiveNoticeText",
    ]) {
      arena[key]?.setAlpha(0);
    }

    (globalThis as any).__ddB39Snapshot = (wanted: string) => {
      const self = arena.room.state.players.get(arena.room.sessionId);
      const rig = arena.blobs.get(arena.room.sessionId);
      if (!self || !rig || rig.weaponDef?.id !== wanted)
        throw new Error(`B39 snapshot lost ${wanted}`);

      const bounds = (image: any) => {
        const matrix = image.getWorldTransformMatrix();
        const left = -image.displayOriginX;
        const top = -image.displayOriginY;
        const right = left + image.width;
        const bottom = top + image.height;
        const points = [
          matrix.transformPoint(left, top),
          matrix.transformPoint(right, top),
          matrix.transformPoint(right, bottom),
          matrix.transformPoint(left, bottom),
        ];
        const xs = points.map((point) => point.x);
        const ys = points.map((point) => point.y);
        const xMin = Math.min(...xs);
        const xMax = Math.max(...xs);
        const yMin = Math.min(...ys);
        const yMax = Math.max(...ys);
        return {
          left: xMin,
          right: xMax,
          top: yMin,
          bottom: yMax,
          width: xMax - xMin,
          height: yMax - yMin,
          centerX: (xMin + xMax) / 2,
          centerY: (yMin + yMax) / 2,
        };
      };
      const normalizeAngle = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));
      const head = rig.boilerplateHead;
      const body = rig.body;
      const weapon = rig.weapons[0]?.img;
      if (!head || !body) throw new Error("B39 rig has no head/body nodes");
      const determinantSign = head.scaleX * head.scaleY < 0 ? -1 : 1;
      const sourceRotation = rig.boilerplateReady
        ? (rig.boilerplateHeadAssembly?.rotation ?? 0)
        : 0;
      const baseHeadRotation = body.rotation + determinantSign * sourceRotation;
      const localDropPx = head.y - rig.floatingHeadSpring.y;
      const localHeadHeightPx = head.height * Math.abs(head.scaleY);
      const headBounds = bounds(head);
      const bodyBounds = bounds(body);
      const weaponBounds = weapon ? bounds(weapon) : null;

      return {
        character: self.character,
        authorityWeapon: self.weapon,
        renderedWeapon: rig.weaponDef.id,
        family: rig.weaponDef.tags.family,
        handling: rig.weaponDef.tags.handling ?? [],
        facingValue: rig.facing,
        facingBlend: rig.facingBlend,
        localDropPx,
        screenDropPx: localDropPx * Math.abs(rig.root.scaleY) * arena.cameras.main.zoom,
        localHeadHeightPx,
        dropAsHeadHeight: localHeadHeightPx > 0 ? localDropPx / localHeadHeightPx : null,
        nodDeltaRad: Math.abs(normalizeAngle(head.rotation - baseHeadRotation)),
        head: {
          x: head.x,
          y: head.y,
          springY: rig.floatingHeadSpring.y,
          rotation: head.rotation,
          baseRotation: baseHeadRotation,
          visible: head.visible,
          bounds: headBounds,
        },
        body: {
          x: body.x,
          y: body.y,
          rotation: body.rotation,
          bounds: bodyBounds,
        },
        weapon: weapon
          ? {
              x: weapon.x,
              y: weapon.y,
              rotation: weapon.rotation,
              bounds: weaponBounds,
              headBottomClearancePx: weaponBounds.top - headBounds.bottom,
              headCenterAboveWeaponCenterPx: weaponBounds.centerY - headBounds.centerY,
            }
          : null,
        flourishActive: rig.flourishChannels?.some((channel: any) => channel.active) === true,
        cameraZoom: arena.cameras.main.zoom,
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
      { message: `B39 should equip ${weaponId}`, timeout: 20_000 },
    )
    .toEqual({
      authority: weaponId,
      rendered: weaponId,
      character: CHARACTER_ID,
      wanted: weaponId,
    });
}

async function commitFacing(page: Page, facing: Facing): Promise<void> {
  const canvas = page.locator("#game-root canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("B39 could not locate the live Phaser canvas");
  const wanted = facing === "right" ? 1 : -1;
  await page.mouse.move(
    box.x + box.width * (facing === "right" ? 0.9 : 0.1),
    box.y + box.height * 0.5,
  );
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
      { message: `B39 actor should settle ${facing}`, timeout: 10_000 },
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

async function settleAndPause(
  page: Page,
  weaponId: string,
  expectedDropPx: number,
  expectedNodRad: number,
): Promise<Record<string, any>> {
  await expect
    .poll(
      () =>
        page.evaluate(
          ({ wanted, drop, nod }) => {
            const holder = globalThis as any;
            const snapshot = holder.__ddB39Snapshot(wanted);
            return (
              !snapshot.flourishActive &&
              Math.abs(snapshot.localDropPx - drop) < 0.35 &&
              Math.abs(snapshot.nodDeltaRad - nod) < 0.01
            );
          },
          { wanted: weaponId, drop: expectedDropPx, nod: expectedNodRad },
        ),
      { message: `${weaponId} should settle into its cheek-weld pose`, timeout: 12_000 },
    )
    .toBe(true);
  return await page.evaluate((wanted) => {
    const holder = globalThis as any;
    const arena = holder.ddGame.scene.getScene("arena");
    arena.scene.pause();
    return holder.__ddB39Snapshot(wanted);
  }, weaponId);
}

async function capturePose(
  page: Page,
  captures: Capture[],
  label: string,
  weaponId: string,
  facing: Facing,
  expectedDropPx: number,
  expectedNodRad: number,
): Promise<Capture> {
  await equip(page, weaponId);
  await commitFacing(page, facing);
  const snapshot = await settleAndPause(page, weaponId, expectedDropPx, expectedNodRad);
  const screenshotFile = path.join(EVIDENCE_DIR, `${label}.png`);
  await page.locator("#game-root canvas").screenshot({ path: screenshotFile });
  const capture: Capture = {
    label,
    weaponId,
    facing,
    screenshot: repoPath(screenshotFile),
    snapshot,
  };
  captures.push(capture);
  await page.evaluate(() => {
    const arena = (globalThis as any).ddGame.scene.getScene("arena");
    arena.scene.resume();
  });
  await page.waitForTimeout(220);
  return capture;
}

async function writeContrast(idle: Capture, armed: Capture, fixtureLabel: string): Promise<string> {
  const output = path.join(EVIDENCE_DIR, `${armed.label}--vs-unarmed.png`);
  const idleBytes = await readFile(path.resolve(idle.screenshot));
  const armedBytes = await readFile(path.resolve(armed.screenshot));
  const svg = Buffer.from(
    `<svg width="${VIEWPORT.width * 2}" height="${VIEWPORT.height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${VIEWPORT.width}" height="34" fill="#111111" fill-opacity="0.86"/>
      <rect x="${VIEWPORT.width}" y="0" width="${VIEWPORT.width}" height="34" fill="#111111" fill-opacity="0.86"/>
      <text x="16" y="23" fill="#ffffff" font-family="Arial" font-size="17" font-weight="700">UNARMED IDLE</text>
      <text x="${VIEWPORT.width + 16}" y="23" fill="#ffffff" font-family="Arial" font-size="17" font-weight="700">${fixtureLabel.toUpperCase()}</text>
    </svg>`,
  );
  await sharp({
    create: {
      width: VIEWPORT.width * 2,
      height: VIEWPORT.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    },
  })
    .composite([
      { input: idleBytes, left: 0, top: 0 },
      { input: armedBytes, left: VIEWPORT.width, top: 0 },
      { input: svg, left: 0, top: 0 },
    ])
    .png()
    .toFile(output);
  armed.contrastScreenshot = repoPath(output);
  return armed.contrastScreenshot;
}

test("B39 visible cheek weld survives both facings on private ephemeral ports", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await runArenaSpec(page, async (baseURL) => {
    await mkdir(EVIDENCE_DIR, { recursive: true });
    await page.setViewportSize(VIEWPORT);
    await bootPrivateArena(page, baseURL);

    const clientPort = Number(new URL(baseURL).port);
    const gamePort = Number(new URL(page.url()).searchParams.get("port"));
    expect(Number.isInteger(clientPort) && clientPort > 0).toBe(true);
    expect(Number.isInteger(gamePort) && gamePort > 0).toBe(true);
    expect(FORBIDDEN_PORTS.has(clientPort), "client port must be private ephemeral").toBe(false);
    expect(FORBIDDEN_PORTS.has(gamePort), "game port must be private ephemeral").toBe(false);

    const captures: Capture[] = [];
    const idleByFacing = {} as Record<Facing, Capture>;
    for (const facing of FACINGS) {
      const idle = await capturePose(
        page,
        captures,
        `unarmed-idle-${facing}`,
        "fists",
        facing,
        0,
        0,
      );
      expect(Math.abs(idle.snapshot.localDropPx)).toBeLessThan(0.35);
      expect(idle.snapshot.weapon).toBeNull();
      idleByFacing[facing] = idle;
    }

    for (const fixture of FIXTURES) {
      for (const facing of FACINGS) {
        const capture = await capturePose(
          page,
          captures,
          `${fixture.id}-${facing}`,
          fixture.id,
          facing,
          fixture.dropPx,
          fixture.nodRad,
        );
        const snapshot = capture.snapshot;
        expect(snapshot.character).toBe(CHARACTER_ID);
        expect(snapshot.facingValue).toBe(facing === "right" ? 1 : -1);
        expect(Math.abs(snapshot.facingBlend - snapshot.facingValue)).toBeLessThan(0.02);
        expect(snapshot.localDropPx).toBeCloseTo(fixture.dropPx, 1);
        expect(snapshot.nodDeltaRad).toBeCloseTo(fixture.nodRad, 2);
        expect(snapshot.head.visible).toBe(true);
        expect(snapshot.weapon).not.toBeNull();
        expect(snapshot.weapon.headCenterAboveWeaponCenterPx).toBeGreaterThan(10);
        if (fixture.weaponClass === "sightedLong") {
          expect(snapshot.dropAsHeadHeight).toBeGreaterThanOrEqual(0.18);
          expect(snapshot.dropAsHeadHeight).toBeLessThanOrEqual(0.25);
        } else {
          expect(snapshot.dropAsHeadHeight).toBeGreaterThanOrEqual(0.09);
          expect(snapshot.dropAsHeadHeight).toBeLessThanOrEqual(0.13);
        }
        await writeContrast(idleByFacing[facing], capture, fixture.label);
      }
    }

    const evidence = {
      verdict: "pass",
      capturedAt: new Date().toISOString(),
      character: CHARACTER_ID,
      cameraZoom: 1.5,
      privatePorts: {
        client: clientPort,
        game: gamePort,
        forbiddenDefaultPortsAvoided:
          !FORBIDDEN_PORTS.has(clientPort) && !FORBIDDEN_PORTS.has(gamePort),
      },
      mapping: {
        sightedLong:
          "catalog family ends in -rifle, family is railgun, or tags.handling contains bolt",
        short: "all other held guns",
      },
      tuning: {
        sightedLong: { dropPx: 18, nodRad: 0.11 },
        short: { dropPx: 9, nodRad: 0.07 },
      },
      facings: FACINGS,
      fixtures: FIXTURES,
      captures,
    };
    await writeFile(
      path.join(EVIDENCE_DIR, "live-gate.json"),
      `${JSON.stringify(evidence, null, 2)}\n`,
      "utf8",
    );
    await writeFile(
      path.join(EVIDENCE_DIR, "README.md"),
      [
        "# B39 stance-amplify private live gate",
        "",
        "Verdict: PASS — the bolt-action rifle and railgun show a visible 18 px cheek-weld drop",
        "(about 20% of the cowboy head height) plus a 0.11 rad nod in both facings. The pistol",
        "uses the half 9 px / 0.07 rad profile. Head centers stay above the weapon centerline.",
        "",
        `Character: \`${CHARACTER_ID}\``,
        "",
        `Private ephemeral ports: client \`${clientPort}\`, game \`${gamePort}\`; defaults 5180/2567 were not used.`,
        "",
        "Every armed capture has a retained `--vs-unarmed.png` side-by-side with the matching-facing",
        "unarmed idle on the left. Raw captures and exact rig measurements are indexed in `live-gate.json`.",
        "",
      ].join("\n"),
      "utf8",
    );
  });
});
