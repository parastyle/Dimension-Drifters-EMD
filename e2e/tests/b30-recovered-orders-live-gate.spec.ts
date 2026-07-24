import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { WEAPONS } from "@dd/shared";
import { expect, type Page, test } from "@playwright/test";
import { runArenaSpec } from "../helpers/arena-harness.js";

const CHARACTER_ID = "proto-cowboy-hidden-face";
const FORBIDDEN_PORTS = new Set([5180, 2567]);
const FACINGS = ["right", "left"] as const;
const WEAPON_IDS = [
  "x2-quicksilver-streetsweeper",
  "x2-frostgig-harpoon",
  "x2-fool-s-gold-revolver",
  "x2-sunbreaker-railgun",
  "x2-buckshot-briar",
  "x2-cinderfang-derringer",
  "x2-hailshard-resonator",
  "tombstone-greatsword",
  "x2-coyote-trickster-s-sparkmitt",
  "x2-saintspar-lochaber",
  "x2-quarry-splitter-bardiche",
  "x2-choir-iron-greataxe",
  "gravediggers-spade",
  "x2-sanctified-headsman",
  "x2-brimstone-falcata",
  "x2-rimebound-folio",
] as const;
const ARCHIVE_IDS = [
  "x2-hollowmother-spore-totem",
  "x2-codex-of-forked-tongues",
  "x2-voltscript-codicil",
  "x2-bonepicker-coachgun",
] as const;
const LIVE_WEAPON_IDS = process.env.B30_LIVE_WEAPON
  ? WEAPON_IDS.filter((weaponId) => weaponId === process.env.B30_LIVE_WEAPON)
  : [...WEAPON_IDS];
const CAPTURE_DELAY_MS: Readonly<Record<string, number>> = {
  "x2-quicksilver-streetsweeper": 95,
  "x2-frostgig-harpoon": 95,
  "x2-hailshard-resonator": 95,
  "x2-coyote-trickster-s-sparkmitt": 95,
  "x2-saintspar-lochaber": 210,
  "x2-quarry-splitter-bardiche": 510,
  "x2-choir-iron-greataxe": 260,
  "gravediggers-spade": 150,
  "x2-sanctified-headsman": 220,
  "x2-brimstone-falcata": 180,
  "x2-rimebound-folio": 120,
};
const EVIDENCE_DIR = path.resolve(
  import.meta.dirname,
  "../../docs/owner-notes-audit-v11-evidence/b30-recovered-orders",
);

type WeaponId = (typeof WEAPON_IDS)[number];
type Facing = (typeof FACINGS)[number];

interface PoseSample {
  readonly atMs: number;
  readonly rootRotation: number;
  readonly rootX: number;
  readonly rootY: number;
  readonly attackLiftPx: number;
  readonly orbitSpin: boolean;
  readonly orbitT: number;
  readonly motion: string | null;
  readonly supportGripError: number | null;
  readonly weaponPieces: Array<{
    readonly x: number;
    readonly y: number;
    readonly rotation: number;
    readonly scaleX: number;
    readonly scaleY: number;
    readonly visible: boolean;
  }>;
  readonly tomeOpen: boolean;
  readonly proceduralLeavesVisible: number;
  readonly performanceFireHeld: boolean;
  readonly performanceReducedMotion: boolean;
  readonly performanceAction: string | null;
  readonly projectileRows: Array<{
    readonly id: string;
    readonly bornTick: number;
    readonly kind: string;
    readonly vx: number;
    readonly vy: number;
  }>;
}

interface LiveCapture {
  readonly weaponId: WeaponId;
  readonly facing: Facing;
  readonly attackSeqBefore: number;
  readonly attackSeqAfter: number;
  readonly facingValue: number;
  readonly definition: {
    readonly displayLength: number;
    readonly family: string;
    readonly fireMode: string;
    readonly grip: string;
    readonly gripPoints: unknown;
    readonly performance: unknown;
    readonly suppressMeleeHitbox: boolean;
    readonly suppressVfx: boolean;
    readonly quake: unknown;
    readonly gun: unknown;
    readonly scatter: unknown;
    readonly swingStyle: string | null;
    readonly swingArc: number;
    readonly dual: boolean;
  };
  readonly samples: PoseSample[];
  readonly layerIds: string[];
  readonly effectEvents: Array<Record<string, unknown>>;
  readonly semiAutoHeldSeq: number | null;
  readonly screenshot: string;
}

function evidencePath(file: string): string {
  return path.relative(process.cwd(), file).replaceAll("\\", "/");
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
      { message: "B30 private arena should become live", timeout: 30_000 },
    )
    .toMatchObject({ mode: "training", character: CHARACTER_ID });

  const canvas = page.locator("#game-root canvas");
  await canvas.click({ position: { x: 640, y: 360 } });
  await page.evaluate(() => {
    const holder = globalThis as unknown as {
      ddGame: any;
      __ddV6GAnchorCapture?: boolean;
      __ddV6GAnchorEvents?: Array<Record<string, unknown>>;
      __b30ReadPose?: (wanted: string, startedAt: number) => PoseSample;
    };
    const arena = holder.ddGame.scene.getScene("arena");
    if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend?.(arena.time.now);
    arena.verbs?.releaseInputLatchIf?.(true);
    arena.game.hasFocus = true;
    arena.pointerOverInteractiveUi = false;
    arena.cameras.main.setZoom(1.35);
    arena.input.activePointer.rightButtonDown = () => false;
    holder.__ddV6GAnchorCapture = true;
    holder.__ddV6GAnchorEvents = [];
    holder.__b30ReadPose = (wanted: string, startedAt: number): PoseSample => {
      const liveArena = holder.ddGame.scene.getScene("arena");
      const rig = liveArena.blobs.get(liveArena.room.sessionId);
      const definition = rig?.weaponDef;
      if (!rig || !definition || definition.id !== wanted)
        throw new Error(`B30 pose sampler could not resolve ${wanted}`);
      const held = rig.weapons.filter((piece: any) => piece.def.id === wanted);
      const grip = definition.gripPoints?.secondary;
      let supportGripError: number | null = null;
      if (grip && held[0]) {
        const image = held[0].img;
        const matrix = image.getLocalTransformMatrix();
        const localX = -image.displayOriginX + image.width * grip.x;
        const localY = -image.displayOriginY + image.height * grip.y;
        const point = matrix.transformPoint(localX, localY);
        supportGripError = Math.min(
          ...rig.hands.map((hand: any) => Math.hypot(hand.img.x - point.x, hand.img.y - point.y)),
        );
      }

      let latestBornTick = -1;
      const projectileRows: PoseSample["projectileRows"] = [];
      liveArena.room.state.projectiles.forEach((row: any, id: string) => {
        if (row.sourcePlayerId !== liveArena.room.sessionId || row.sourceWeaponId !== wanted)
          return;
        if (row.bornTick > latestBornTick) {
          latestBornTick = row.bornTick;
          projectileRows.length = 0;
        }
        if (row.bornTick === latestBornTick)
          projectileRows.push({
            id,
            bornTick: row.bornTick,
            kind: row.kind,
            vx: row.vx,
            vy: row.vy,
          });
      });

      return {
        atMs: performance.now() - startedAt,
        rootRotation: rig.root.rotation,
        rootX: rig.root.x,
        rootY: rig.root.y,
        attackLiftPx: rig.attackLiftPx,
        orbitSpin: rig.orbitSpin,
        orbitT: rig.orbitT,
        motion: rig.activeSwing?.motion ?? null,
        supportGripError,
        weaponPieces: held.map((piece: any) => ({
          x: piece.img.x,
          y: piece.img.y,
          rotation: piece.img.rotation,
          scaleX: piece.img.scaleX,
          scaleY: piece.img.scaleY,
          visible: piece.img.visible !== false,
        })),
        tomeOpen: rig.tome?.openVisible === true,
        proceduralLeavesVisible:
          rig.tome?.proceduralLeaves?.filter((leaf: any) => leaf.visible !== false).length ?? 0,
        performanceFireHeld: rig.performanceInput?.fireHeld === true,
        performanceReducedMotion: rig.performanceInput?.reducedMotion === true,
        performanceAction: rig.performanceInput?.spec?.action ?? null,
        projectileRows,
      };
    };
  });

  const clientPort = Number(new URL(baseURL).port);
  const gamePort = Number(new URL(page.url()).searchParams.get("port"));
  return { clientPort, gamePort };
}

async function equip(page: Page, weaponId: WeaponId): Promise<void> {
  await page.evaluate(
    ({ weapon, character }) => {
      const arena = (globalThis as unknown as { ddGame: any }).ddGame.scene.getScene("arena");
      arena.input.activePointer.rightButtonDown = () => false;
      arena.sendAttack?.();
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
      { message: `B30 should equip ${weaponId}`, timeout: 20_000 },
    )
    .toEqual({
      authority: weaponId,
      rendered: weaponId,
      character: CHARACTER_ID,
      wanted: weaponId,
    });
}

async function commitFacing(page: Page, weaponId: WeaponId, facing: Facing): Promise<void> {
  const canvas = page.locator("#game-root canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("B30 could not locate the live Phaser canvas");
  await page.mouse.move(
    box.x + box.width * (facing === "right" ? 0.88 : 0.12),
    box.y + box.height * 0.5,
  );
  const wanted = facing === "right" ? 1 : -1;
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

async function beginAttack(page: Page, weaponId: WeaponId, facing: Facing): Promise<number> {
  const before = await page.evaluate(
    ({ wanted, direction }) => {
      const holder = globalThis as unknown as {
        ddGame: any;
        __ddV6GAnchorEvents?: Array<Record<string, unknown>>;
        __b30HeldInput?: number;
        __b30ReadPose?: (wanted: string, startedAt: number) => PoseSample;
        __b30Samples?: PoseSample[];
        __b30CaptureRaf?: number;
      };
      const arena = holder.ddGame.scene.getScene("arena");
      const self = arena.room.state.players.get(arena.room.sessionId);
      if (!self || self.weapon !== wanted) throw new Error(`B30 lost ${wanted} before firing`);
      holder.__ddV6GAnchorEvents = [];
      if (holder.__b30CaptureRaf) window.cancelAnimationFrame(holder.__b30CaptureRaf);
      holder.__b30Samples = [];
      const startedAt = performance.now();
      const scan = (): void => {
        const sample = holder.__b30ReadPose?.(wanted, startedAt);
        if (sample) holder.__b30Samples?.push(sample);
        holder.__b30CaptureRaf = window.requestAnimationFrame(scan);
      };
      scan();
      arena.selfAim = { x: direction, y: 0 };
      arena.localAtkCd = 0;
      arena.input.activePointer.rightButtonDown = () => true;
      if (arena.blobs.get(arena.room.sessionId)?.weaponDef?.performance?.continuous) {
        if (holder.__b30HeldInput) window.clearInterval(holder.__b30HeldInput);
        arena.stepNetInput?.(50, false, false, 0, 0);
        holder.__b30HeldInput = window.setInterval(
          () => arena.stepNetInput?.(50, false, false, 0, 0),
          50,
        );
      }
      arena.sendAttack();
      return self.attackSeq;
    },
    { wanted: weaponId, direction: facing === "right" ? 1 : -1 },
  );
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const arena = (globalThis as unknown as { ddGame: any }).ddGame.scene.getScene("arena");
          return arena.room.state.players.get(arena.room.sessionId)?.attackSeq ?? 0;
        }),
      { message: `${weaponId}/${facing} should be accepted`, timeout: 12_000 },
    )
    .toBeGreaterThan(before);
  return before;
}

async function releaseAttack(page: Page): Promise<void> {
  await page.evaluate(() => {
    const holder = globalThis as unknown as { ddGame: any; __b30HeldInput?: number };
    const arena = holder.ddGame.scene.getScene("arena");
    arena.input.activePointer.rightButtonDown = () => false;
    if (holder.__b30HeldInput) {
      window.clearInterval(holder.__b30HeldInput);
      holder.__b30HeldInput = undefined;
    }
    arena.stepNetInput?.(50, false, false, 0, 0);
    arena.sendAttack?.();
  });
}

async function captureOrder(page: Page, weaponId: WeaponId, facing: Facing): Promise<LiveCapture> {
  const attackSeqBefore = await beginAttack(page, weaponId, facing);
  const delayMs = CAPTURE_DELAY_MS[weaponId] ?? 150;
  await page.waitForTimeout(delayMs);
  const samples = await page.evaluate(() => {
    const holder = globalThis as unknown as {
      __b30Samples?: PoseSample[];
      __b30CaptureRaf?: number;
    };
    if (holder.__b30CaptureRaf) window.cancelAnimationFrame(holder.__b30CaptureRaf);
    holder.__b30CaptureRaf = undefined;
    return holder.__b30Samples ?? [];
  });

  const screenshotFile = path.join(EVIDENCE_DIR, `${weaponId}-${facing}.png`);
  await page.locator("#game-root canvas").screenshot({ path: screenshotFile });

  let semiAutoHeldSeq: number | null = null;
  if (weaponId === "x2-quicksilver-streetsweeper") {
    const accepted = await page.evaluate(() => {
      const arena = (globalThis as unknown as { ddGame: any }).ddGame.scene.getScene("arena");
      return arena.room.state.players.get(arena.room.sessionId)?.attackSeq ?? 0;
    });
    await page.waitForTimeout(380);
    await page.evaluate(() => {
      const arena = (globalThis as unknown as { ddGame: any }).ddGame.scene.getScene("arena");
      arena.localAtkCd = 0;
      arena.sendAttack();
    });
    await page.waitForTimeout(90);
    semiAutoHeldSeq = await page.evaluate(() => {
      const arena = (globalThis as unknown as { ddGame: any }).ddGame.scene.getScene("arena");
      return arena.room.state.players.get(arena.room.sessionId)?.attackSeq ?? 0;
    });
    expect(semiAutoHeldSeq, `${weaponId}/${facing}: held trigger must not repeat`).toBe(accepted);
  }

  const measured = await page.evaluate((wanted) => {
    const holder = globalThis as unknown as {
      ddGame: any;
      __ddV6GAnchorEvents?: Array<Record<string, unknown>>;
    };
    const arena = holder.ddGame.scene.getScene("arena");
    const self = arena.room.state.players.get(arena.room.sessionId);
    const rig = arena.blobs.get(arena.room.sessionId);
    const definition = rig.weaponDef;
    const events = (holder.__ddV6GAnchorEvents ?? []).filter((event) => event.weaponId === wanted);
    return {
      attackSeqAfter: self.attackSeq,
      facingValue: rig.facing,
      definition: {
        displayLength: definition.displayLength,
        family: definition.tags.family,
        fireMode: definition.tags.fireMode,
        grip: definition.tags.grip,
        gripPoints: definition.gripPoints ?? null,
        performance: definition.performance ?? null,
        suppressMeleeHitbox: definition.suppressMeleeHitbox === true,
        suppressVfx: definition.suppressVfx === true,
        quake: definition.quake ?? null,
        gun: definition.gun ?? null,
        scatter: definition.scatter ?? null,
        swingStyle: definition.swingStyle ?? null,
        swingArc: definition.swingArc,
        dual: definition.dual === true,
      },
      layerIds: [
        ...new Set(
          events
            .filter((event) => event.kind === "weapon-vfx-suite")
            .flatMap((event) => (Array.isArray(event.layerIds) ? event.layerIds : [])),
        ),
      ] as string[],
      effectEvents: events.filter((event) => event.kind === "weapon-effect-recipe"),
    };
  }, weaponId);

  await releaseAttack(page);

  return {
    weaponId,
    facing,
    attackSeqBefore,
    samples,
    semiAutoHeldSeq,
    screenshot: evidencePath(screenshotFile),
    ...measured,
  };
}

function latestProjectileRows(capture: LiveCapture): PoseSample["projectileRows"] {
  const withProjectiles = capture.samples.filter((sample) => sample.projectileRows.length > 0);
  return withProjectiles.reduce<PoseSample["projectileRows"]>(
    (largest, sample) =>
      sample.projectileRows.length > largest.length ? sample.projectileRows : largest,
    [],
  );
}

function assertOrder(capture: LiveCapture): void {
  const prefix = `${capture.weaponId}/${capture.facing}`;
  expect(capture.attackSeqAfter, `${prefix}: authoritative acceptance`).toBeGreaterThan(
    capture.attackSeqBefore,
  );
  expect(capture.facingValue, `${prefix}: facing`).toBe(capture.facing === "right" ? 1 : -1);
  expect(
    capture.samples.some((sample) => sample.weaponPieces.length > 0),
    `${prefix}: held art`,
  ).toBe(true);

  switch (capture.weaponId) {
    case "x2-quicksilver-streetsweeper": {
      expect(capture.definition).toMatchObject({
        family: "grenade-launcher",
        fireMode: "semi-auto",
        gripPoints: {
          secondary: { x: 0.63, y: 0.7, role: "horizontal-foregrip" },
        },
        gun: {
          bulletKind: "grenade",
          arcHeight: 112,
          explode: { radius: 62, damage: 9 },
        },
      });
      expect(latestProjectileRows(capture)).toHaveLength(1);
      expect(
        capture.samples
          .map((sample) => sample.supportGripError)
          .filter((error): error is number => error !== null)
          .every((error) => error < 34),
        `${prefix}: planted support hand`,
      ).toBe(true);
      expect(capture.semiAutoHeldSeq).not.toBeNull();
      break;
    }
    case "x2-frostgig-harpoon":
      expect(capture.definition.performance).toMatchObject({ hold: "overhead" });
      expect(latestProjectileRows(capture)).toHaveLength(1);
      break;
    case "x2-fool-s-gold-revolver":
      expect(capture.definition.gripPoints).toEqual({ primary: { x: 0.38, y: 0.64 } });
      break;
    case "x2-sunbreaker-railgun":
      expect(capture.definition.gripPoints).toEqual({
        primary: { x: 0.36, y: 0.67 },
        secondary: { x: 0.5, y: 0.64, role: "horizontal-foregrip" },
      });
      break;
    case "x2-buckshot-briar":
      expect(capture.definition.displayLength).toBe(120);
      break;
    case "x2-cinderfang-derringer":
      expect(capture.definition.displayLength).toBeCloseTo(55.2, 8);
      break;
    case "x2-hailshard-resonator":
      expect(capture.definition).toMatchObject({
        suppressMeleeHitbox: true,
        suppressVfx: true,
        scatter: { count: 5, aim: "cone" },
      });
      expect(latestProjectileRows(capture).length).toBeGreaterThan(0);
      expect(latestProjectileRows(capture).length).toBeLessThanOrEqual(5);
      expect(latestProjectileRows(capture).every((row) => row.kind === "magma:frost")).toBe(true);
      expect(capture.layerIds).toEqual([]);
      break;
    case "tombstone-greatsword":
      expect(capture.definition.quake).toBeNull();
      expect(capture.layerIds).toEqual([]);
      break;
    case "x2-coyote-trickster-s-sparkmitt":
      expect(capture.definition.suppressVfx).toBe(true);
      expect(capture.layerIds).toEqual([]);
      expect(capture.samples.some((sample) => sample.motion !== null)).toBe(true);
      break;
    case "x2-saintspar-lochaber":
      expect(
        capture.samples.some(
          (sample) => sample.motion === "overhead" || sample.motion === "rising-chop",
        ),
      ).toBe(true);
      break;
    case "x2-quarry-splitter-bardiche":
      expect(capture.definition.displayLength).toBe(256);
      expect(capture.samples.some((sample) => sample.motion === "execution-slam")).toBe(true);
      break;
    case "x2-choir-iron-greataxe":
      expect(capture.effectEvents.some((event) => event.pack === "fire-bolt")).toBe(true);
      expect(capture.effectEvents.some((event) => String(event.pack).includes("holy"))).toBe(false);
      break;
    case "gravediggers-spade": {
      expect(capture.definition).toMatchObject({
        swingArc: Math.PI * 2,
        performance: {
          lunge: { distancePx: 144, durationSeconds: 0.2 },
          twirl: {
            plane: "continuous-frontflip",
            visualRevolutions: 6,
            cadenceSeconds: 0.2,
          },
        },
      });
      const rotations = capture.samples.map((sample) => sample.rootRotation);
      expect(
        Math.max(...rotations) - Math.min(...rotations),
        `${prefix}: wrapped live rotation span`,
      ).toBeGreaterThan(2);
      expect(capture.samples.some((sample) => sample.performanceFireHeld)).toBe(true);
      const xs = capture.samples.map((sample) => sample.rootX);
      expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(20);
      break;
    }
    case "x2-sanctified-headsman":
      expect(capture.definition.swingStyle).toBe("chop");
      expect(
        capture.samples.some((sample) => sample.motion === "overhead" || sample.motion === "slash"),
      ).toBe(true);
      break;
    case "x2-brimstone-falcata": {
      expect(capture.definition).toMatchObject({
        grip: "dual",
        dual: true,
        swingStyle: "spin",
        swingArc: Math.PI * 2,
      });
      const opposed = capture.samples.filter(
        (sample) => sample.orbitSpin && sample.weaponPieces.length === 2,
      );
      expect(opposed.length, `${prefix}: live dual whirlwind samples`).toBeGreaterThan(2);
      expect(
        opposed.some(
          (sample) =>
            Math.sign(sample.weaponPieces[0]!.x) === -Math.sign(sample.weaponPieces[1]!.x),
        ),
      ).toBe(true);
      break;
    }
    case "x2-rimebound-folio":
      expect(capture.definition.suppressMeleeHitbox).toBe(true);
      expect(latestProjectileRows(capture).length).toBeGreaterThan(0);
      expect(latestProjectileRows(capture).length).toBeLessThanOrEqual(7);
      expect(latestProjectileRows(capture).every((row) => row.kind === "magma:frost")).toBe(true);
      expect(
        capture.samples.some((sample) => sample.tomeOpen && sample.proceduralLeavesVisible === 2),
      ).toBe(true);
      break;
  }
}

test("B30 sixteen surviving orders render and fire in both facings on ephemeral private ports", async ({
  page,
}) => {
  test.setTimeout(420_000);
  await runArenaSpec(page, async (baseURL) => {
    await mkdir(EVIDENCE_DIR, { recursive: true });
    await page.setViewportSize({ width: 800, height: 450 });
    const ports = await bootPrivateArena(page, baseURL);
    expect(Number.isInteger(ports.clientPort) && ports.clientPort > 0).toBe(true);
    expect(Number.isInteger(ports.gamePort) && ports.gamePort > 0).toBe(true);
    expect(FORBIDDEN_PORTS.has(ports.clientPort)).toBe(false);
    expect(FORBIDDEN_PORTS.has(ports.gamePort)).toBe(false);

    const captures: LiveCapture[] = [];
    for (const weaponId of LIVE_WEAPON_IDS) {
      await equip(page, weaponId);
      for (const facing of FACINGS) {
        await commitFacing(page, weaponId, facing);
        const capture = await captureOrder(page, weaponId, facing);
        assertOrder(capture);
        captures.push(capture);
        await page.waitForTimeout(120);
      }
    }

    const liveMotions = (weaponId: WeaponId) => [
      ...new Set(
        captures
          .filter((capture) => capture.weaponId === weaponId)
          .flatMap((capture) => capture.samples.map((sample) => sample.motion))
          .filter((motion): motion is string => motion !== null),
      ),
    ];
    if (LIVE_WEAPON_IDS.length === WEAPON_IDS.length) {
      expect(liveMotions("x2-saintspar-lochaber")).toEqual(["overhead", "rising-chop"]);
      expect(liveMotions("x2-sanctified-headsman")).toEqual(["overhead", "slash"]);
      expect(
        Math.max(
          ...captures
            .filter((capture) => capture.weaponId === "x2-quarry-splitter-bardiche")
            .flatMap((capture) => capture.samples.map((sample) => Math.abs(sample.rootRotation))),
        ),
      ).toBeGreaterThan(1);
    }

    const archiveRejections: Array<{ id: string; rejected: boolean; retainedWeapon: string }> = [];
    for (const id of ARCHIVE_IDS) {
      const result = await page.evaluate(
        async ({ archived, character }) => {
          const arena = (globalThis as unknown as { ddGame: any }).ddGame.scene.getScene("arena");
          const before = arena.room.state.players.get(arena.room.sessionId)?.weapon;
          arena.room.send("devEquip", { weapon: archived, character });
          await new Promise((resolve) => window.setTimeout(resolve, 280));
          const after = arena.room.state.players.get(arena.room.sessionId)?.weapon;
          return {
            id: archived,
            rejected: after !== archived,
            retainedWeapon: after ?? before ?? "",
          };
        },
        { archived: id, character: CHARACTER_ID },
      );
      expect(result.rejected, `${id}: archived devEquip rejection`).toBe(true);
      archiveRejections.push(result);
    }

    for (const id of ARCHIVE_IDS) {
      expect(WEAPONS[id]?.archived, `${id}: shared archive truth`).toBe(true);
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
      survivingWeaponIds: LIVE_WEAPON_IDS,
      facings: FACINGS,
      captures,
      archiveRejections,
    };
    await writeFile(
      path.join(EVIDENCE_DIR, "live-gate.json"),
      `${JSON.stringify(evidence, null, 2)}\n`,
      "utf8",
    );
    await writeFile(
      path.join(EVIDENCE_DIR, "live-gate-summary.md"),
      [
        "# B30 recovered-orders live gate",
        "",
        `Verdict: PASS - ${captures.length} accepted captures (${LIVE_WEAPON_IDS.length} surviving weapons x 2 facings).`,
        "",
        `Character: \`${CHARACTER_ID}\``,
        "",
        `Private ephemeral ports: client \`${ports.clientPort}\`, game \`${ports.gamePort}\`; defaults 5180/2567 were not used.`,
        "",
        "The machine-readable receipt includes planted-grip error, projectiles, pose/orbit samples,",
        "procedural folio leaves, VFX layers, archive rejections, and all screenshot paths.",
        "",
      ].join("\n"),
      "utf8",
    );
    await writeFile(
      path.join(EVIDENCE_DIR, "README.md"),
      [
        "# B30 recovered skipped-window orders evidence",
        "",
        `Character: \`${CHARACTER_ID}\`.`,
        "",
        `Captured ${LIVE_WEAPON_IDS.length} surviving weapons in both facings on private ephemeral client/game ports.`,
        "See `live-gate.json` for measurements and `live-gate-summary.md` for the concise verdict.",
        "The four archived weapon IDs were rejected by the live dev-equip authority.",
        "",
      ].join("\n"),
      "utf8",
    );
  });
});
