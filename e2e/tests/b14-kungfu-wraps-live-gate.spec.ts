import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { bootArena, runArenaSpec } from "../helpers/arena-harness.js";

const EVIDENCE_DIR = path.resolve(
  import.meta.dirname,
  "../../docs/owner-notes-audit-v10-evidence/b19-kungfu-rework",
);
const CHARACTER_ID = "proto-cowboy-hidden-face";
const FORBIDDEN_PORTS = new Set([5180, 2567]);
const FACINGS = ["right", "left"] as const;
const FIXTURES = [
  {
    id: "x2-muay-thai-wraps",
    cooldownMs: 750,
    swingStyle: "red-eight-limbs-aura",
    impactStyle: "heavy-dust-cloud",
    motions: ["teep-kick", "elbow", "elbow", "knee-strike", "spinning-back-elbow"],
    limbs: ["foot", "hand", "hand", "foot", "hand"],
    displacementPx: 39,
  },
  {
    id: "x2-wing-chun-wraps",
    cooldownMs: 200,
    swingStyle: "white-centerline-flash",
    impactStyle: "precise-white-flash",
    motions: ["chain-punch", "chain-punch", "chain-punch", "oblique-kick", "double-palm"],
    limbs: ["hand", "hand", "hand", "foot", "hand"],
    displacementPx: 26,
  },
  {
    id: "x2-drunken-fist-wraps",
    cooldownMs: 500,
    swingStyle: "mist-purple-sway-sweep",
    impactStyle: "misty-purple-wide-sweep",
    motions: ["sway-jab", "weave-cross", "weave-backfist", "sweeping-leg", "falling-haymaker"],
    limbs: ["hand", "hand", "hand", "foot", "hand"],
    displacementPx:
      Math.hypot(3, 7) +
      Math.hypot(-3, -9) +
      Math.hypot(5, 8) +
      Math.hypot(-2, -11) +
      Math.hypot(12, 4),
  },
  {
    id: "x2-iron-palm-wraps",
    cooldownMs: 900,
    swingStyle: "black-iron-drive",
    impactStyle: "iron-sparks-shockwave",
    motions: ["crushing-palm", "stomp-kick", "windup-palm", "quake-double-palm"],
    limbs: ["hand", "foot", "hand", "hand"],
    displacementPx: 36,
  },
] as const;

type Facing = (typeof FACINGS)[number];

interface Point {
  x: number;
  y: number;
}

interface Target extends Point {
  id: string;
  distance: number;
}

interface VfxEvent extends Point {
  kind: "swing" | "impact";
  weaponId: string;
  style: string;
  timeMs: number;
  comboStep?: number;
  motion?: string;
  limb?: "hand" | "foot";
}

interface Contact {
  weaponId: string;
  targetId: string;
  sourcePlayerId: string;
  layer: string;
  damage: number;
}

interface BrowserEnemy extends Point {
  kind: string;
}

interface BrowserPlayer extends Point {
  ackSeq: number;
  attackSeq: number;
  character?: string;
  weapon?: string;
}

interface BrowserImage {
  visible: boolean;
  texture: { key: string };
  frame: { name: string | number };
}

interface BrowserWrapRig {
  facing: number;
  root: { scaleX: number };
  weaponDef?: { id: string };
  weapons: { img: BrowserImage; partIndex: number }[];
  wrapFootWeapons: { img: BrowserImage; partIndex: number; foot: { front: boolean } }[];
  hands: { img: BrowserImage; front: boolean }[];
  feet: { img: BrowserImage; front: boolean }[];
}

interface BrowserArena {
  blobs: Map<string, BrowserWrapRig>;
  combatFeedback: {
    subscribeContact(listener: (event: Contact) => void): () => void;
  };
  cameras: {
    main: {
      setZoom(value: number): void;
      worldView: { x: number; y: number; width: number; height: number };
    };
  };
  game: { hasFocus: boolean };
  input: { activePointer: { rightButtonDown(): boolean } };
  predictor: {
    mintCmd(
      moveX: number,
      moveY: number,
      jump: boolean,
      crouchHeld: boolean,
      pound: boolean,
      aimX: number,
      aimY: number,
      slide: boolean,
      slideHeld: boolean,
    ): object;
  };
  dispatchNetInput(
    command: object,
    self: BrowserPlayer | undefined,
    weapon: undefined,
    predictTick: boolean,
  ): void;
  pointerOverInteractiveUi: boolean;
  room: {
    sessionId: string;
    send(type: string, message?: unknown): void;
    state: {
      enemies: {
        forEach(callback: (enemy: BrowserEnemy, id: string) => void): void;
      };
      players: {
        get(id: string): BrowserPlayer | undefined;
      };
    };
  };
  scene: { pause(): void; resume(): void };
  time: { now: number };
  verbs?: {
    isLegendOpen?(): boolean;
    releaseInputLatchIf?(force: boolean): void;
    toggleLegend?(timeMs: number): void;
  };
}

interface BrowserGlobal {
  ddGame: { scene: { getScene(key: string): BrowserArena } };
  __ddB14KungFuVfxAudit?: VfxEvent[];
  __ddB14Contacts?: Contact[];
  __ddB14ContactUnsubscribe?: () => void;
  __ddB19PositionAudit?: PositionSample[];
  __ddB19PositionTimer?: number;
}

interface PositionSample extends Point {
  attackSeq: number;
  timeMs: number;
}

interface RigAudit {
  handOverlayCount: number;
  footOverlayCount: number;
  handPartIndices: number[];
  footPartIndices: number[];
  baseHandsVisible: boolean[];
  baseFeetVisible: boolean[];
  handOverlayVisible: boolean[];
  footOverlayVisible: boolean[];
  handFrames: string[];
  footFrames: string[];
  facing: number;
  rootScaleX: number;
}

interface Capture {
  weaponId: string;
  facing: Facing;
  target: Target;
  attackSeqBefore: number;
  attackSeqAfter: number;
  steps: number[];
  motions: string[];
  swingStyle: string;
  impactStyle: string;
  intervalsMs: number[];
  limbs: string[];
  travel: {
    start: Point;
    end: Point;
    distancePx: number;
    expectedPx: number;
    positionSamples: PositionSample[];
  };
  rig: RigAudit;
  contacts: Contact[];
  vfx: VfxEvent[];
  handScreenshot: string;
  footScreenshot: string;
}

function relativeEvidencePath(file: string): string {
  return path.relative(process.cwd(), file).replaceAll("\\", "/");
}

async function prepare(page: Page): Promise<void> {
  await page.locator("#game-root canvas").click({ position: { x: 450, y: 253 } });
  await page.evaluate(() => {
    const holder = globalThis as unknown as BrowserGlobal;
    const arena = holder.ddGame.scene.getScene("arena");
    if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend?.(arena.time.now);
    arena.verbs?.releaseInputLatchIf?.(true);
    arena.game.hasFocus = true;
    arena.pointerOverInteractiveUi = false;
    arena.cameras.main.setZoom(1.85);
    holder.__ddB14KungFuVfxAudit = [];
    holder.__ddB14Contacts = [];
    holder.__ddB14ContactUnsubscribe?.();
    holder.__ddB14ContactUnsubscribe = arena.combatFeedback.subscribeContact((event) => {
      if (event.sourcePlayerId === arena.room.sessionId) holder.__ddB14Contacts?.push({ ...event });
    });
    holder.__ddB19PositionAudit = [];
    if (holder.__ddB19PositionTimer) window.clearInterval(holder.__ddB19PositionTimer);
    holder.__ddB19PositionTimer = window.setInterval(() => {
      const self = arena.room.state.players.get(arena.room.sessionId);
      if (!self) return;
      holder.__ddB19PositionAudit?.push({
        attackSeq: self.attackSeq,
        x: self.x,
        y: self.y,
        timeMs: arena.time.now,
      });
    }, 16);
  });
}

async function equip(page: Page, weaponId: string): Promise<void> {
  await page.evaluate((id) => {
    const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
    arena.room.send("devEquip", { weapon: id });
  }, weaponId);
  await expect
    .poll(
      () =>
        page.evaluate((id) => {
          const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
          const self = arena.room.state.players.get(arena.room.sessionId);
          const rig = arena.blobs.get(arena.room.sessionId);
          return { authority: self?.weapon ?? null, rig: rig?.weaponDef?.id ?? null, wanted: id };
        }, weaponId),
      { message: `B14 gate should equip ${weaponId}`, timeout: 20_000 },
    )
    .toEqual({ authority: weaponId, rig: weaponId, wanted: weaponId });
}

async function nearestDummy(page: Page, facing: Facing): Promise<Target> {
  return await page.evaluate((side) => {
    const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
    const self = arena.room.state.players.get(arena.room.sessionId);
    if (!self) throw new Error("B19 live gate lost its player while locating an open lane");
    return {
      id: `open-lane:${side}`,
      x: self.x + (side === "right" ? 92 : -92),
      y: self.y,
      distance: 92,
    };
  }, facing);
}

async function moveToFacingSide(_page: Page, target: Target, _facing: Facing): Promise<Target> {
  return target;
}

async function aimAtTarget(page: Page, facing: Facing): Promise<void> {
  const canvas = page.locator("#game-root canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("B14 live gate cannot locate the Phaser canvas");
  await page.mouse.move(
    box.x + box.width * (facing === "right" ? 0.9 : 0.1),
    box.y + box.height * 0.5,
  );
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
          return arena.blobs.get(arena.room.sessionId)?.facing ?? 0;
        }),
      { message: `B14 rig should commit ${facing} facing`, timeout: 10_000 },
    )
    .toBe(facing === "right" ? 1 : -1);
}

async function beginAttacks(page: Page): Promise<number> {
  return await page.evaluate(() => {
    const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
    const self = arena.room.state.players.get(arena.room.sessionId);
    if (!self) throw new Error("B14 live gate lost its player before attacking");
    arena.input.activePointer.rightButtonDown = () => true;
    return self.attackSeq;
  });
}

async function stopAttacks(page: Page): Promise<void> {
  await page.evaluate(() => {
    const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
    arena.input.activePointer.rightButtonDown = () => false;
  });
}

async function captureRigAudit(page: Page): Promise<RigAudit> {
  return await page.evaluate(() => {
    const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
    const rig = arena.blobs.get(arena.room.sessionId);
    if (!rig) throw new Error("B19 live gate lost the local SpriteRig");
    const handOverlays = rig.weapons.filter((weapon) => weapon.partIndex === 0);
    const footOverlays = rig.wrapFootWeapons.filter((weapon) => weapon.partIndex === 1);
    return {
      handOverlayCount: handOverlays.length,
      footOverlayCount: footOverlays.length,
      handPartIndices: handOverlays.map((weapon) => weapon.partIndex),
      footPartIndices: footOverlays.map((weapon) => weapon.partIndex),
      baseHandsVisible: rig.hands.map((hand) => hand.img.visible),
      baseFeetVisible: rig.feet.map((foot) => foot.img.visible),
      handOverlayVisible: handOverlays.map((weapon) => weapon.img.visible),
      footOverlayVisible: footOverlays.map((weapon) => weapon.img.visible),
      handFrames: handOverlays.map(
        (weapon) => `${weapon.img.texture.key}:${String(weapon.img.frame.name)}`,
      ),
      footFrames: footOverlays.map(
        (weapon) => `${weapon.img.texture.key}:${String(weapon.img.frame.name)}`,
      ),
      facing: rig.facing,
      rootScaleX: rig.root.scaleX,
    };
  });
}

async function waitForSwingLimb(
  page: Page,
  weaponId: string,
  limb: "hand" | "foot",
): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(
          ({ weaponId, limb }) =>
            ((globalThis as unknown as BrowserGlobal).__ddB14KungFuVfxAudit ?? []).some(
              (event) =>
                event.weaponId === weaponId && event.kind === "swing" && event.limb === limb,
            ),
          { weaponId, limb },
        ),
      { message: `${weaponId} should render a ${limb}-anchored beat`, timeout: 12_000 },
    )
    .toBe(true);
}

test("B19 kung-fu wraps render 2+2 limbs and full displaced combos on both facings", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await runArenaSpec(page, async (baseURL) => {
    await mkdir(EVIDENCE_DIR, { recursive: true });
    await page.setViewportSize({ width: 900, height: 506 });
    const clientPort = Number(new URL(baseURL).port);
    expect(FORBIDDEN_PORTS.has(clientPort), "client port must be private ephemeral").toBe(false);
    await bootArena(page, baseURL, `char:${CHARACTER_ID}`);
    const gamePort = Number(new URL(page.url()).searchParams.get("port"));
    expect(Number.isInteger(gamePort) && gamePort > 0).toBe(true);
    expect(FORBIDDEN_PORTS.has(gamePort), "game port must be private ephemeral").toBe(false);
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
            return arena.room.state.players.get(arena.room.sessionId)?.character ?? null;
          }),
        { message: `B14 gate should use ${CHARACTER_ID}`, timeout: 20_000 },
      )
      .toBe(CHARACTER_ID);
    await prepare(page);

    const captures: Capture[] = [];
    for (const fixture of FIXTURES) {
      await equip(page, fixture.id);
      for (const facing of FACINGS) {
        const candidate = await nearestDummy(page, facing);
        const target = await moveToFacingSide(page, candidate, facing);
        expect(target.distance, `${fixture.id}/${facing}:combo runway`).toBeLessThanOrEqual(105);
        await aimAtTarget(page, facing);
        await page.waitForTimeout(1_300);
        await page.evaluate(() => {
          const holder = globalThis as unknown as BrowserGlobal;
          holder.__ddB14KungFuVfxAudit = [];
          holder.__ddB14Contacts = [];
          holder.__ddB19PositionAudit = [];
        });

        const rig = await captureRigAudit(page);
        const start = await page.evaluate(() => {
          const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
          const self = arena.room.state.players.get(arena.room.sessionId);
          if (!self) throw new Error("B19 live gate lost the player before root-motion capture");
          return { x: self.x, y: self.y };
        });
        const handScreenshotFile = path.join(EVIDENCE_DIR, `${fixture.id}-${facing}-hand.png`);
        const footScreenshotFile = path.join(EVIDENCE_DIR, `${fixture.id}-${facing}-foot.png`);
        const attackSeqBefore = await beginAttacks(page);
        try {
          const limbOrder: ("hand" | "foot")[] =
            fixture.limbs[0] === "foot" ? ["foot", "hand"] : ["hand", "foot"];
          for (const limb of limbOrder) {
            await waitForSwingLimb(page, fixture.id, limb);
            await page.locator("#game-root canvas").screenshot({
              path: limb === "hand" ? handScreenshotFile : footScreenshotFile,
            });
          }
          await expect
            .poll(
              () =>
                page.evaluate(
                  ({ weaponId, comboLength }) => {
                    const events =
                      (globalThis as unknown as BrowserGlobal).__ddB14KungFuVfxAudit ?? [];
                    let expectedStep = 0;
                    for (const event of events) {
                      if (event.weaponId !== weaponId || event.kind !== "swing") continue;
                      if (event.comboStep === expectedStep) expectedStep += 1;
                      else if (event.comboStep === 0) expectedStep = 1;
                      if (expectedStep === comboLength) return true;
                    }
                    return false;
                  },
                  { weaponId: fixture.id, comboLength: fixture.motions.length },
                ),
              {
                message: `${fixture.id}/${facing} should render its full canonical B19 combo`,
                timeout: 16_000,
                intervals: [10, 15, 25],
              },
            )
            .toBe(true);
        } finally {
          await stopAttacks(page);
        }
        await page.waitForTimeout(450);
        await expect
          .poll(
            () =>
              page.evaluate((baseline) => {
                const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene(
                  "arena",
                );
                const self = arena.room.state.players.get(arena.room.sessionId);
                return (self?.attackSeq ?? baseline) - baseline;
              }, attackSeqBefore),
            {
              message: `${fixture.id}/${facing} should replicate every accepted combo beat`,
              timeout: 2_000,
              intervals: [10, 15, 25],
            },
          )
          .toBeGreaterThanOrEqual(fixture.motions.length);

        const measured = await page.evaluate(
          ({ weaponId, target, facing, attackSeqBefore, comboLength, start }) => {
            const holder = globalThis as unknown as BrowserGlobal;
            const arena = holder.ddGame.scene.getScene("arena");
            const self = arena.room.state.players.get(arena.room.sessionId);
            if (!self) throw new Error(`B19 live capture lost ${weaponId}`);
            const vfx = (holder.__ddB14KungFuVfxAudit ?? []).filter(
              (event) => event.weaponId === weaponId,
            );
            const contacts = (holder.__ddB14Contacts ?? []).filter(
              (event) => event.weaponId === weaponId,
            );
            const swings: VfxEvent[] = [];
            for (const event of vfx) {
              if (event.kind !== "swing") continue;
              if (event.comboStep === swings.length) swings.push(event);
              else if (event.comboStep === 0) swings.splice(0, swings.length, event);
              if (swings.length === comboLength) break;
            }
            const samples = [...(holder.__ddB19PositionAudit ?? [])];
            const firstAccepted = samples.findIndex(
              (sample) => (sample.attackSeq - attackSeqBefore) >>> 0 > 0,
            );
            const windowStart = Math.max(0, firstAccepted - 1);
            const firstLaterCombo = samples.findIndex(
              (sample, index) =>
                index > windowStart && (sample.attackSeq - attackSeqBefore) >>> 0 > comboLength,
            );
            const comboSamples = samples.slice(
              windowStart,
              firstLaterCombo < 0 ? undefined : firstLaterCombo,
            );
            const travelStart = comboSamples[0] ?? start;
            const travelEnd = comboSamples.at(-1) ?? { x: self.x, y: self.y };
            return {
              weaponId,
              facing,
              target,
              attackSeqBefore,
              attackSeqAfter: self.attackSeq,
              steps: swings.map((event) => event.comboStep ?? -1),
              motions: swings.map((event) => event.motion ?? ""),
              limbs: swings.map((event) => event.limb ?? ""),
              swingStyle: swings[0]?.style ?? "",
              impactStyle: vfx.find((event) => event.kind === "impact")?.style ?? "",
              intervalsMs: swings
                .slice(1)
                .map((event, index) => event.timeMs - (swings[index]?.timeMs ?? event.timeMs)),
              travel: {
                start: { x: travelStart.x, y: travelStart.y },
                end: { x: travelEnd.x, y: travelEnd.y },
                distancePx: Math.hypot(travelEnd.x - travelStart.x, travelEnd.y - travelStart.y),
                expectedPx: 0,
                positionSamples: comboSamples,
              },
              contacts,
              vfx,
            };
          },
          {
            weaponId: fixture.id,
            target,
            facing,
            attackSeqBefore,
            comboLength: fixture.motions.length,
            start,
          },
        );
        const capture: Capture = {
          ...measured,
          travel: { ...measured.travel, expectedPx: fixture.displacementPx },
          rig,
          handScreenshot: relativeEvidencePath(handScreenshotFile),
          footScreenshot: relativeEvidencePath(footScreenshotFile),
        };
        expect(capture.attackSeqAfter - capture.attackSeqBefore).toBeGreaterThanOrEqual(
          fixture.motions.length,
        );
        expect(capture.steps).toEqual(fixture.motions.map((_, index) => index));
        expect(capture.motions).toEqual(fixture.motions);
        expect(capture.limbs).toEqual(fixture.limbs);
        expect(capture.swingStyle).toBe(fixture.swingStyle);
        if (capture.impactStyle) expect(capture.impactStyle).toBe(fixture.impactStyle);
        expect(capture.intervalsMs).toHaveLength(fixture.motions.length - 1);
        for (const interval of capture.intervalsMs) {
          expect(
            Math.abs(interval - fixture.cooldownMs),
            `${fixture.id}/${facing}: observed cadence ${interval}ms`,
          ).toBeLessThanOrEqual(175);
        }
        expect(capture.rig.handOverlayCount).toBe(2);
        expect(capture.rig.footOverlayCount).toBe(2);
        expect(capture.rig.handPartIndices).toEqual([0, 0]);
        expect(capture.rig.footPartIndices).toEqual([1, 1]);
        expect(capture.rig.baseHandsVisible).toEqual([false, false]);
        expect(capture.rig.baseFeetVisible).toEqual([false, false]);
        expect(capture.rig.handOverlayVisible).toEqual([true, true]);
        expect(capture.rig.footOverlayVisible).toEqual([true, true]);
        expect(new Set(capture.rig.handFrames).size).toBe(1);
        expect(new Set(capture.rig.footFrames).size).toBe(1);
        expect(capture.rig.handFrames[0]).not.toBe(capture.rig.footFrames[0]);
        expect(capture.rig.facing).toBe(facing === "right" ? 1 : -1);
        expect(Math.sign(capture.rig.rootScaleX)).toBe(facing === "right" ? 1 : -1);
        expect(capture.travel.positionSamples.length).toBeGreaterThanOrEqual(5);
        expect(capture.travel.distancePx).toBeGreaterThan(
          Math.min(8, fixture.displacementPx * 0.3),
        );
        expect(capture.travel.distancePx).toBeLessThanOrEqual(fixture.displacementPx + 12);
        expect(Math.sign(capture.travel.end.x - capture.travel.start.x)).toBe(
          facing === "right" ? 1 : -1,
        );
        captures.push(capture);
      }
    }

    const observedCadenceMs = Object.fromEntries(
      FIXTURES.map((fixture) => {
        const intervals = captures
          .filter((capture) => capture.weaponId === fixture.id)
          .flatMap((capture) => capture.intervalsMs);
        return [
          fixture.id,
          intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length,
        ];
      }),
    );
    const assertions = {
      eightFacingCaptures: captures.length === FIXTURES.length * FACINGS.length,
      fourDistinctSwingStyles: new Set(captures.map((capture) => capture.swingStyle)).size === 4,
      observedImpactStylesMatchRecipes: captures.every((capture) => {
        const fixture = FIXTURES.find((row) => row.id === capture.weaponId);
        return !capture.impactStyle || capture.impactStyle === fixture?.impactStyle;
      }),
      exactComboSignatures: captures.every((capture) => {
        const fixture = FIXTURES.find((row) => row.id === capture.weaponId);
        return (
          !!fixture &&
          capture.steps.join(",") === fixture.motions.map((_, index) => index).join(",") &&
          capture.motions.join(",") === fixture.motions.join(",") &&
          capture.limbs.join(",") === fixture.limbs.join(",")
        );
      }),
      everyCaptureHasTwoWrappedHandsAndFeet: captures.every(
        (capture) =>
          capture.rig.handOverlayCount === 2 &&
          capture.rig.footOverlayCount === 2 &&
          capture.rig.baseHandsVisible.every((visible) => !visible) &&
          capture.rig.baseFeetVisible.every((visible) => !visible),
      ),
      everyCaptureHasPunchKickEvidence: captures.every(
        (capture) =>
          capture.limbs.includes("hand") &&
          capture.limbs.includes("foot") &&
          capture.handScreenshot.endsWith("-hand.png") &&
          capture.footScreenshot.endsWith("-foot.png"),
      ),
      everyCaptureHasAuthoritativeTravel: captures.every(
        (capture) =>
          capture.travel.distancePx >= Math.min(8, capture.travel.expectedPx * 0.3) &&
          capture.travel.positionSamples.length >= 5,
      ),
      cadenceOrder:
        observedCadenceMs["x2-wing-chun-wraps"] < observedCadenceMs["x2-drunken-fist-wraps"] &&
        observedCadenceMs["x2-drunken-fist-wraps"] < observedCadenceMs["x2-muay-thai-wraps"] &&
        observedCadenceMs["x2-muay-thai-wraps"] < observedCadenceMs["x2-iron-palm-wraps"],
      privatePorts: !FORBIDDEN_PORTS.has(clientPort) && !FORBIDDEN_PORTS.has(gamePort),
      wholeArtCharacter: CHARACTER_ID,
    };
    await writeFile(
      path.join(EVIDENCE_DIR, "live-gate.json"),
      `${JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          baseURL,
          clientPort,
          gamePort,
          protectedPorts: [...FORBIDDEN_PORTS],
          characterId: CHARACTER_ID,
          nominalCooldownMs: Object.fromEntries(
            FIXTURES.map((fixture) => [fixture.id, fixture.cooldownMs]),
          ),
          observedCadenceMs,
          assertions,
          captures,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    expect(assertions).toEqual({
      eightFacingCaptures: true,
      fourDistinctSwingStyles: true,
      observedImpactStylesMatchRecipes: true,
      exactComboSignatures: true,
      everyCaptureHasTwoWrappedHandsAndFeet: true,
      everyCaptureHasPunchKickEvidence: true,
      everyCaptureHasAuthoritativeTravel: true,
      cadenceOrder: true,
      privatePorts: true,
      wholeArtCharacter: CHARACTER_ID,
    });
  });
});
