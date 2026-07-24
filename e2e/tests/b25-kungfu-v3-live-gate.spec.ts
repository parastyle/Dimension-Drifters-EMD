import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { bootArena, runArenaSpec } from "../helpers/arena-harness.js";

const EVIDENCE_DIR = path.resolve(
  import.meta.dirname,
  "../../docs/owner-notes-audit-v11-evidence/b25-kungfu-v3",
);
const CHARACTER_ID = "proto-cowboy-hidden-face";
const FORBIDDEN_PORTS = new Set([5180, 2567]);
const FACINGS = ["right", "left"] as const;
const FIXTURES = [
  {
    id: "x2-muay-thai-wraps",
    cooldownMs: 180,
    b23ObservedMs: 470.8,
    swingStyle: "crimson-roundhouse-arc",
    impactStyle: "heavy-dust-cloud",
    motions: ["teep-kick", "elbow", "spinning-back-elbow", "knee-strike", "roundhouse-kick"],
    limbs: ["foot", "hand", "hand", "foot", "foot"],
    expectedReachPx: [138, 108.56, 112.24, 117.76, 136.16],
    showcaseMotion: "roundhouse-kick",
    finisherPose: "champion-guard",
    displacementPx: 428,
    pathPx: 428,
  },
  {
    id: "x2-wing-chun-wraps",
    cooldownMs: 120,
    b23ObservedMs: 229.2,
    swingStyle: "white-centerline-flash",
    impactStyle: "precise-white-flash",
    motions: ["chain-punch", "chain-punch", "chain-punch", "oblique-kick", "double-palm"],
    limbs: ["hand", "hand", "hand", "foot", "hand"],
    expectedReachPx: [111.8, 115.24, 118.68, 120.4, 129],
    stance: "praying-mantis",
    displacementPx: 0,
    pathPx: 0,
  },
  {
    id: "x2-drunken-fist-wraps",
    cooldownMs: 160,
    b23ObservedMs: 379.1,
    swingStyle: "mist-purple-sway-sweep",
    impactStyle: "misty-purple-wide-sweep",
    motions: ["sway-jab", "weave-cross", "weave-backfist", "sweeping-leg", "frontflip-heel-drop"],
    limbs: ["hand", "hand", "hand", "foot", "foot"],
    expectedReachPx: [113.28, 117.12, 120, 132.48, 144],
    showcaseMotion: "frontflip-heel-drop",
    finisherPose: "crane-one-leg",
    stance: "crane",
    displacementPx: Math.hypot(196, -8),
    pathPx:
      Math.hypot(18, 88) +
      Math.hypot(-12, -112) +
      Math.hypot(24, 104) +
      Math.hypot(10, -128) +
      Math.hypot(156, 40),
  },
  {
    id: "x2-iron-palm-wraps",
    cooldownMs: 240,
    b23ObservedMs: 611.1,
    swingStyle: "black-iron-drive",
    impactStyle: "iron-sparks-shockwave",
    motions: ["crushing-palm", "stomp-kick", "roundhouse-kick", "mantis-double-hook"],
    limbs: ["hand", "foot", "foot", "hand"],
    expectedReachPx: [115.2, 126.72, 144, 144],
    showcaseMotion: "mantis-double-hook",
    finisherPose: "praying-mantis",
    stance: "praying-mantis",
    displacementPx: 332,
    pathPx: 332,
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
  sourceX?: number;
  sourceY?: number;
  authorityReach?: number;
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
  displayWidth: number;
  displayHeight: number;
  x: number;
  y: number;
  rotation: number;
  texture: { key: string };
  frame: { name: string | number };
}

interface BrowserWrapRig {
  facing: number;
  root: { scaleX: number; scaleY: number; rotation: number };
  weaponDef?: { id: string };
  weapons: { img: BrowserImage; partIndex: number }[];
  wrapFootWeapons: { img: BrowserImage; partIndex: number; foot: { front: boolean } }[];
  hands: { img: BrowserImage; front: boolean }[];
  feet: { img: BrowserImage; front: boolean }[];
  auraGlow: { visible: boolean };
  auraRing: { visible: boolean };
  paintedAuraFill: { visible: boolean }[];
  paintedAuraParticles: { visible: boolean }[];
  kungFuWrapPose: {
    flipProgress: number;
    flipDirection: -1 | 0 | 1;
    paperTurnScaleX: number;
    paperTurnProgress: number;
    handStretch: number;
    rearHandStretch: number;
    frontFootStretch: number;
    backFootStretch: number;
    holdPose?: string;
    holdStrength: number;
  };
  kungFuWrapRenderEvidence: TheatricalRenderEvidence;
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
  ddGame: {
    scene: {
      getScene(key: string): BrowserArena;
      resume(key: string): void;
    };
  };
  __ddB14KungFuVfxAudit?: VfxEvent[];
  __ddB14Contacts?: Contact[];
  __ddB14ContactUnsubscribe?: () => void;
  __ddB19PositionAudit?: PositionSample[];
  __ddB19PositionTimer?: number;
  __ddB23AuraAudit?: boolean[];
  __ddB25TheatricalAudit?: TheatricalSample[];
}

interface PositionSample extends Point {
  attackSeq: number;
  timeMs: number;
}

interface TheatricalSample {
  attackSeq: number;
  timeMs: number;
  rootScaleX: number;
  rootRotation: number;
  flipProgress: number;
  flipDirection: -1 | 0 | 1;
  paperTurnScaleX: number;
  paperTurnProgress: number;
  handStretch: number;
  rearHandStretch: number;
  frontFootStretch: number;
  backFootStretch: number;
  holdPose?: string;
  holdStrength: number;
}

interface TheatricalRenderEvidence {
  renderedSamples: number;
  minPaperTurnScaleX: number;
  maxFlipProgress: number;
  maxFlipAbsRotation: number;
  maxHandStretch: number;
  maxRearHandStretch: number;
  maxFrontFootStretch: number;
  maxBackFootStretch: number;
  maxHoldStrength: number;
  holdPoses: string[];
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
  rootScaleY: number;
  handScaleRatios: number[];
  footScaleRatios: number[];
  playerAuraVisible: boolean;
  handPose: Array<{ front: boolean; x: number; y: number; rotation: number }>;
  footPose: Array<{ front: boolean; x: number; y: number; rotation: number }>;
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
  reachPx: number[];
  authorityReachPx: number[];
  expectedReachPx: readonly number[];
  limbs: string[];
  travel: {
    start: Point;
    end: Point;
    distancePx: number;
    pathDistancePx: number;
    expectedPx: number;
    expectedPathPx: number;
    positionSamples: PositionSample[];
    stepTravel: Array<{ x: number; y: number; distancePx: number }>;
  };
  theatricalSamples: TheatricalSample[];
  renderEvidence: TheatricalRenderEvidence;
  rig: RigAudit;
  auraSamples: boolean[];
  contacts: Contact[];
  vfx: VfxEvent[];
  handScreenshot: string;
  footScreenshot: string;
  stanceScreenshot: string;
  showcaseScreenshot?: string;
  finisherScreenshot?: string;
}

function relativeEvidencePath(file: string): string {
  return path.relative(process.cwd(), file).replaceAll("\\", "/");
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length === 0) return Number.POSITIVE_INFINITY;
  if (sorted.length % 2 === 1) return sorted[middle]!;
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
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
    holder.__ddB23AuraAudit = [];
    holder.__ddB25TheatricalAudit = [];
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
      const rig = arena.blobs.get(arena.room.sessionId);
      if (rig) {
        holder.__ddB23AuraAudit?.push(
          rig.auraGlow.visible ||
            rig.auraRing.visible ||
            rig.paintedAuraFill.some((node) => node.visible) ||
            rig.paintedAuraParticles.some((node) => node.visible),
        );
        const pose = rig.kungFuWrapPose;
        holder.__ddB25TheatricalAudit?.push({
          attackSeq: self.attackSeq,
          timeMs: arena.time.now,
          rootScaleX: rig.root.scaleX,
          rootRotation: rig.root.rotation,
          flipProgress: pose.flipProgress,
          flipDirection: pose.flipDirection,
          paperTurnScaleX: pose.paperTurnScaleX,
          paperTurnProgress: pose.paperTurnProgress,
          handStretch: pose.handStretch,
          rearHandStretch: pose.rearHandStretch,
          frontFootStretch: pose.frontFootStretch,
          backFootStretch: pose.backFootStretch,
          holdPose: pose.holdPose,
          holdStrength: pose.holdStrength,
        });
      }
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
      { message: `B25 gate should equip ${weaponId}`, timeout: 20_000 },
    )
    .toEqual({ authority: weaponId, rig: weaponId, wanted: weaponId });
}

async function nearestDummy(page: Page, facing: Facing): Promise<Target> {
  return await page.evaluate((side) => {
    const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
    const self = arena.room.state.players.get(arena.room.sessionId);
    if (!self) throw new Error("B25 live gate lost its player while locating an open lane");
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
  if (!box) throw new Error("B25 live gate cannot locate the Phaser canvas");
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
      { message: `B25 rig should commit ${facing} facing`, timeout: 10_000 },
    )
    .toBe(facing === "right" ? 1 : -1);
}

async function beginAttacks(page: Page): Promise<number> {
  return await page.evaluate(() => {
    const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
    const self = arena.room.state.players.get(arena.room.sessionId);
    if (!self) throw new Error("B25 live gate lost its player before attacking");
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
    if (!rig) throw new Error("B25 live gate lost the local SpriteRig");
    const handOverlays = rig.weapons.filter((weapon) => weapon.partIndex === 0);
    const footOverlays = rig.wrapFootWeapons.filter((weapon) => weapon.partIndex === 1);
    const screenMax = (image: BrowserImage) =>
      Math.max(
        image.displayWidth * Math.abs(rig.root.scaleX),
        image.displayHeight * Math.abs(rig.root.scaleY),
      );
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
      rootScaleY: rig.root.scaleY,
      handScaleRatios: handOverlays.map(
        (weapon, index) => screenMax(weapon.img) / screenMax(rig.hands[index]!.img),
      ),
      footScaleRatios: footOverlays.map(
        (weapon, index) => screenMax(weapon.img) / screenMax(rig.feet[index]!.img),
      ),
      playerAuraVisible:
        rig.auraGlow.visible ||
        rig.auraRing.visible ||
        rig.paintedAuraFill.some((node) => node.visible) ||
        rig.paintedAuraParticles.some((node) => node.visible),
      handPose: handOverlays.map((weapon, index) => ({
        front: rig.hands[index]!.front,
        x: weapon.img.x,
        y: weapon.img.y,
        rotation: weapon.img.rotation,
      })),
      footPose: footOverlays.map((weapon, index) => ({
        front: rig.feet[index]!.front,
        x: weapon.img.x,
        y: weapon.img.y,
        rotation: weapon.img.rotation,
      })),
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

async function waitForSwingMotion(page: Page, weaponId: string, motion: string): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(
          ({ weaponId, motion }) =>
            ((globalThis as unknown as BrowserGlobal).__ddB14KungFuVfxAudit ?? []).some(
              (event) =>
                event.weaponId === weaponId && event.kind === "swing" && event.motion === motion,
            ),
          { weaponId, motion },
        ),
      { message: `${weaponId} should render showcase motion ${motion}`, timeout: 12_000 },
    )
    .toBe(true);
}

async function clearSwingAudit(page: Page): Promise<void> {
  await page.evaluate(() => {
    (globalThis as unknown as BrowserGlobal).__ddB14KungFuVfxAudit = [];
  });
}

async function readRenderEvidence(page: Page): Promise<TheatricalRenderEvidence> {
  return await page.evaluate(() => {
    const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
    const evidence = arena.blobs.get(arena.room.sessionId)?.kungFuWrapRenderEvidence;
    if (!evidence) throw new Error("B25 live gate lost the rig render evidence");
    return { ...evidence, holdPoses: [...evidence.holdPoses] };
  });
}

async function captureLimbEvidence(
  page: Page,
  weaponId: string,
  limb: "hand" | "foot",
  file: string,
): Promise<void> {
  await clearSwingAudit(page);
  await beginAttacks(page);
  try {
    await waitForSwingLimb(page, weaponId, limb);
    await page.locator("#game-root canvas").screenshot({ path: file });
  } finally {
    await stopAttacks(page);
  }
}

async function captureShowcaseEvidence(
  page: Page,
  weaponId: string,
  motion: string,
  showcaseFile: string,
  finisherFile: string | undefined,
  finisherPose: string | undefined,
): Promise<TheatricalSample[]> {
  await clearSwingAudit(page);
  await beginAttacks(page);
  try {
    await waitForSwingMotion(page, weaponId, motion);
    await page.evaluate(
      (expectedWeapon) =>
        new Promise<void>((resolve, reject) => {
          const holder = globalThis as unknown as BrowserGlobal;
          const arena = holder.ddGame.scene.getScene("arena");
          const deadline = performance.now() + 4_000;
          const inspectRenderedFrame = () => {
            const rig = arena.blobs.get(arena.room.sessionId);
            const pose = rig?.kungFuWrapPose;
            const atShowcaseApex =
              expectedWeapon === "x2-drunken-fist-wraps"
                ? (pose?.flipProgress ?? -1) > 0.2 &&
                  (pose?.flipProgress ?? 1) < 0.9 &&
                  Math.abs(rig?.root.rotation ?? 0) > 1
                : expectedWeapon === "x2-iron-palm-wraps"
                  ? Math.max(pose?.handStretch ?? 1, pose?.rearHandStretch ?? 1) > 1.6
                  : (pose?.paperTurnProgress ?? -1) >= 0 && (pose?.paperTurnScaleX ?? 1) < -0.1;
            if (rig?.weaponDef?.id === expectedWeapon && atShowcaseApex) {
              arena.input.activePointer.rightButtonDown = () => false;
              arena.scene.pause();
              resolve();
              return;
            }
            if (performance.now() >= deadline) {
              reject(new Error(`${expectedWeapon} did not render its showcase apex`));
              return;
            }
            requestAnimationFrame(inspectRenderedFrame);
          };
          requestAnimationFrame(inspectRenderedFrame);
        }),
      weaponId,
    );
    await page.locator("#game-root canvas").screenshot({ path: showcaseFile });
  } finally {
    await page.evaluate(() => {
      const holder = globalThis as unknown as BrowserGlobal;
      const arena = holder.ddGame.scene.getScene("arena");
      arena.input.activePointer.rightButtonDown = () => false;
      holder.ddGame.scene.resume("arena");
    });
  }
  if (finisherFile && finisherPose) {
    await clearSwingAudit(page);
    await page.evaluate(() => {
      const holder = globalThis as unknown as BrowserGlobal;
      holder.__ddB25TheatricalAudit = [];
    });
    await beginAttacks(page);
    try {
      await page.evaluate(
        ({ expectedPose, expectedWeapon }) =>
          new Promise<void>((resolve, reject) => {
            const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
            const deadline = performance.now() + 12_000;
            const inspectRenderedFrame = () => {
              const rig = arena.blobs.get(arena.room.sessionId);
              const pose = rig?.kungFuWrapPose;
              if (
                rig?.weaponDef?.id === expectedWeapon &&
                pose?.holdPose === expectedPose &&
                pose.holdStrength > 0.6
              ) {
                arena.input.activePointer.rightButtonDown = () => false;
                arena.scene.pause();
                resolve();
                return;
              }
              if (performance.now() >= deadline) {
                reject(new Error(`${expectedWeapon} did not render held ${expectedPose}`));
                return;
              }
              requestAnimationFrame(inspectRenderedFrame);
            };
            requestAnimationFrame(inspectRenderedFrame);
          }),
        { expectedPose: finisherPose, expectedWeapon: weaponId },
      );
      await page.locator("#game-root canvas").screenshot({ path: finisherFile });
    } finally {
      await page.evaluate(() => {
        const holder = globalThis as unknown as BrowserGlobal;
        const arena = holder.ddGame.scene.getScene("arena");
        arena.input.activePointer.rightButtonDown = () => false;
        holder.ddGame.scene.resume("arena");
      });
    }
    const finisherEvidence = await readRenderEvidence(page);
    expect(finisherEvidence.holdPoses).toContain(finisherPose);
    expect(finisherEvidence.maxHoldStrength).toBeGreaterThan(0.6);
  }
  return await page.evaluate(() => [
    ...((globalThis as unknown as BrowserGlobal).__ddB25TheatricalAudit ?? []),
  ]);
}

async function waitForMartialStance(page: Page, stance: "praying-mantis" | "crane"): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate((expectedStance) => {
          const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
          const rotations =
            arena.blobs.get(arena.room.sessionId)?.weapons.map((weapon) => weapon.img.rotation) ??
            [];
          return (
            rotations.length === 2 &&
            rotations[0]! > (expectedStance === "praying-mantis" ? 0.8 : 0.4) &&
            rotations[1]! < (expectedStance === "praying-mantis" ? -0.5 : -0.3)
          );
        }, stance),
      { message: `${stance} idle rotations should own both wrapped hands`, timeout: 8_000 },
    )
    .toBe(true);
}

test("B25 theatrical kung-fu v3 is live on all four wraps and both facings", async ({ page }) => {
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
        { message: `B25 gate should use ${CHARACTER_ID}`, timeout: 20_000 },
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
        if ("stance" in fixture) await waitForMartialStance(page, fixture.stance);
        await page.evaluate(() => {
          const holder = globalThis as unknown as BrowserGlobal;
          const arena = holder.ddGame.scene.getScene("arena");
          holder.__ddB14KungFuVfxAudit = [];
          holder.__ddB14Contacts = [];
          holder.__ddB19PositionAudit = [];
          holder.__ddB23AuraAudit = [];
          holder.__ddB25TheatricalAudit = [];
          const evidence = arena.blobs.get(arena.room.sessionId)?.kungFuWrapRenderEvidence;
          if (evidence) {
            evidence.renderedSamples = 0;
            evidence.minPaperTurnScaleX = 1;
            evidence.maxFlipProgress = -1;
            evidence.maxFlipAbsRotation = 0;
            evidence.maxHandStretch = 1;
            evidence.maxRearHandStretch = 1;
            evidence.maxFrontFootStretch = 1;
            evidence.maxBackFootStretch = 1;
            evidence.maxHoldStrength = 0;
            evidence.holdPoses.length = 0;
          }
        });

        const rig = await captureRigAudit(page);
        const stanceScreenshotFile = path.join(EVIDENCE_DIR, `${fixture.id}-${facing}-stance.png`);
        await page.locator("#game-root canvas").screenshot({ path: stanceScreenshotFile });
        const start = await page.evaluate(() => {
          const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
          const self = arena.room.state.players.get(arena.room.sessionId);
          if (!self) throw new Error("B25 live gate lost the player before root-motion capture");
          return { x: self.x, y: self.y };
        });
        const handScreenshotFile = path.join(EVIDENCE_DIR, `${fixture.id}-${facing}-hand.png`);
        const footScreenshotFile = path.join(EVIDENCE_DIR, `${fixture.id}-${facing}-foot.png`);
        const showcaseScreenshotFile =
          "showcaseMotion" in fixture
            ? path.join(EVIDENCE_DIR, `${fixture.id}-${facing}-${fixture.showcaseMotion}.png`)
            : undefined;
        const finisherScreenshotFile =
          "finisherPose" in fixture
            ? path.join(
                EVIDENCE_DIR,
                `${fixture.id}-${facing}-${fixture.finisherPose}-finisher.png`,
              )
            : undefined;
        const attackSeqBefore = await beginAttacks(page);
        try {
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
                message: `${fixture.id}/${facing} should render its full canonical B25 combo`,
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
            if (!self) throw new Error(`B25 live capture lost ${weaponId}`);
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
            const stepTravel = Array.from({ length: comboLength }, () => ({
              x: 0,
              y: 0,
              distancePx: 0,
            }));
            let pathDistancePx = 0;
            for (let index = 1; index < comboSamples.length; index++) {
              const previous = comboSamples[index - 1]!;
              const current = comboSamples[index]!;
              const dx = current.x - previous.x;
              const dy = current.y - previous.y;
              const distance = Math.hypot(dx, dy);
              pathDistancePx += distance;
              const stepIndex = ((current.attackSeq - attackSeqBefore) >>> 0) - 1;
              const step = stepTravel[stepIndex];
              if (step) {
                step.x += dx;
                step.y += dy;
                step.distancePx += distance;
              }
            }
            const theatricalSamples = (holder.__ddB25TheatricalAudit ?? []).filter((sample) => {
              const accepted = (sample.attackSeq - attackSeqBefore) >>> 0;
              return accepted > 0 && accepted <= comboLength;
            });
            const reachPx = swings.map((event) => {
              if (event.sourceX !== undefined && event.sourceY !== undefined) {
                return Math.hypot(event.x - event.sourceX, event.y - event.sourceY);
              }
              const source = samples.findLast((sample) => sample.timeMs <= event.timeMs) ??
                samples.reduce<PositionSample | undefined>(
                  (closest, sample) =>
                    !closest ||
                    Math.abs(sample.timeMs - event.timeMs) < Math.abs(closest.timeMs - event.timeMs)
                      ? sample
                      : closest,
                  undefined,
                ) ?? { x: self.x, y: self.y, attackSeq: self.attackSeq, timeMs: arena.time.now };
              return Math.hypot(event.x - source.x, event.y - source.y);
            });
            const authorityReachPx = swings.map(
              (event, index) => event.authorityReach ?? reachPx[index] ?? 0,
            );
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
              reachPx,
              authorityReachPx,
              travel: {
                start: { x: travelStart.x, y: travelStart.y },
                end: { x: travelEnd.x, y: travelEnd.y },
                distancePx: Math.hypot(travelEnd.x - travelStart.x, travelEnd.y - travelStart.y),
                pathDistancePx,
                expectedPx: 0,
                expectedPathPx: 0,
                positionSamples: comboSamples,
                stepTravel,
              },
              theatricalSamples,
              contacts,
              vfx,
              auraSamples: [...(holder.__ddB23AuraAudit ?? [])],
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
        const limbOrder: ("hand" | "foot")[] =
          fixture.limbs[0] === "foot" ? ["foot", "hand"] : ["hand", "foot"];
        for (const limb of limbOrder) {
          await captureLimbEvidence(
            page,
            fixture.id,
            limb,
            limb === "hand" ? handScreenshotFile : footScreenshotFile,
          );
        }
        let showcaseTheatricalSamples: TheatricalSample[] = [];
        if ("showcaseMotion" in fixture && showcaseScreenshotFile) {
          showcaseTheatricalSamples = await captureShowcaseEvidence(
            page,
            fixture.id,
            fixture.showcaseMotion,
            showcaseScreenshotFile,
            finisherScreenshotFile,
            "finisherPose" in fixture ? fixture.finisherPose : undefined,
          );
        }
        const renderEvidence = await readRenderEvidence(page);
        const capture: Capture = {
          ...measured,
          theatricalSamples: [...measured.theatricalSamples, ...showcaseTheatricalSamples],
          renderEvidence,
          travel: {
            ...measured.travel,
            expectedPx: fixture.displacementPx,
            expectedPathPx: fixture.pathPx,
          },
          expectedReachPx: fixture.expectedReachPx,
          rig,
          handScreenshot: relativeEvidencePath(handScreenshotFile),
          footScreenshot: relativeEvidencePath(footScreenshotFile),
          stanceScreenshot: relativeEvidencePath(stanceScreenshotFile),
          showcaseScreenshot: showcaseScreenshotFile
            ? relativeEvidencePath(showcaseScreenshotFile)
            : undefined,
          finisherScreenshot: finisherScreenshotFile
            ? relativeEvidencePath(finisherScreenshotFile)
            : undefined,
        };
        await writeFile(
          path.join(EVIDENCE_DIR, "live-gate-progress.json"),
          `${JSON.stringify({ captures: [...captures, capture] }, null, 2)}\n`,
          "utf8",
        );
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
          expect(interval, `${fixture.id}/${facing}: cooldown floor`).toBeGreaterThanOrEqual(
            fixture.cooldownMs - 20,
          );
          expect(
            interval,
            `${fixture.id}/${facing}: render heartbeat ceiling ${interval}ms`,
          ).toBeLessThan(650);
        }
        expect(capture.reachPx).toHaveLength(fixture.expectedReachPx.length);
        expect(capture.authorityReachPx).toHaveLength(fixture.expectedReachPx.length);
        for (const [index, visibleReach] of capture.reachPx.entries()) {
          expect(
            visibleReach,
            `${fixture.id}/${facing}:step ${index} visible trail`,
          ).toBeGreaterThan(60);
          expect(
            Math.abs(capture.authorityReachPx[index]! - fixture.expectedReachPx[index]!),
            `${fixture.id}/${facing}:step ${index} authority reach`,
          ).toBeLessThanOrEqual(0.25);
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
        expect(Math.max(...capture.rig.handScaleRatios)).toBeLessThanOrEqual(1.2);
        expect(Math.max(...capture.rig.footScaleRatios)).toBeLessThanOrEqual(1.15);
        expect(capture.rig.playerAuraVisible).toBe(false);
        expect(capture.auraSamples.length).toBeGreaterThan(10);
        expect(capture.auraSamples).not.toContain(true);
        expect(capture.rig.facing).toBe(facing === "right" ? 1 : -1);
        expect(Math.sign(capture.rig.rootScaleX)).toBe(facing === "right" ? 1 : -1);
        if ("stance" in fixture && fixture.stance === "praying-mantis") {
          expect(capture.rig.handPose[0]!.y).toBeLessThan(capture.rig.handPose[1]!.y - 5);
          expect(capture.rig.handPose[0]!.rotation).toBeGreaterThan(0.8);
          expect(capture.rig.handPose[1]!.rotation).toBeLessThan(-0.5);
        }
        if ("stance" in fixture && fixture.stance === "crane") {
          expect(capture.rig.handPose[0]!.y).toBeLessThan(capture.rig.handPose[1]!.y);
          expect(capture.rig.handPose[0]!.rotation).toBeGreaterThan(0.4);
          expect(capture.rig.handPose[1]!.rotation).toBeLessThan(-0.3);
          expect(
            Math.max(...capture.rig.footPose.map((foot) => foot.y)) -
              Math.min(...capture.rig.footPose.map((foot) => foot.y)),
          ).toBeGreaterThan(20);
        }
        expect(capture.travel.positionSamples.length).toBeGreaterThanOrEqual(5);
        expect(capture.theatricalSamples.length).toBeGreaterThanOrEqual(5);
        if (fixture.id === "x2-wing-chun-wraps") {
          expect(capture.travel.distancePx, `${fixture.id}/${facing}: zero net drift`).toBeLessThan(
            1,
          );
          expect(
            capture.travel.pathDistancePx,
            `${fixture.id}/${facing}: zero path drift`,
          ).toBeLessThan(1);
          expect(capture.travel.stepTravel.every((step) => step.distancePx < 1)).toBe(true);
          expect(
            capture.theatricalSamples.every(
              (sample) =>
                sample.flipProgress === -1 &&
                sample.paperTurnProgress === -1 &&
                sample.handStretch === 1 &&
                sample.frontFootStretch === 1,
            ),
          ).toBe(true);
          expect(capture.renderEvidence.minPaperTurnScaleX).toBe(1);
          expect(capture.renderEvidence.maxFlipProgress).toBe(-1);
          expect(capture.renderEvidence.maxHandStretch).toBe(1);
          expect(capture.renderEvidence.maxFrontFootStretch).toBe(1);
          expect(capture.renderEvidence.holdPoses).toEqual([]);
        } else {
          expect(capture.travel.distancePx).toBeGreaterThan(fixture.displacementPx * 0.3);
          expect(capture.travel.distancePx).toBeLessThanOrEqual(
            (fixture.id === "x2-drunken-fist-wraps" ? fixture.pathPx : fixture.displacementPx) + 18,
          );
          expect(capture.travel.pathDistancePx).toBeGreaterThan(fixture.pathPx * 0.3);
          expect(capture.travel.pathDistancePx).toBeLessThanOrEqual(fixture.pathPx + 24);
          expect(Math.sign(capture.travel.end.x - capture.travel.start.x)).toBe(
            facing === "right" ? 1 : -1,
          );
          expect(capture.finisherScreenshot?.endsWith("-finisher.png")).toBe(true);
          expect(capture.renderEvidence.maxHoldStrength).toBeGreaterThan(0.6);
        }
        if (fixture.id === "x2-muay-thai-wraps") {
          const rocketWindowPx =
            (capture.travel.stepTravel[0]?.distancePx ?? 0) +
            (capture.travel.stepTravel[1]?.distancePx ?? 0);
          expect(rocketWindowPx).toBeGreaterThan(270);
          expect(rocketWindowPx).toBeLessThanOrEqual(330);
          expect(capture.renderEvidence.minPaperTurnScaleX).toBeLessThan(-0.1);
          expect(capture.renderEvidence.maxFrontFootStretch).toBeGreaterThan(1.7);
          expect(capture.renderEvidence.holdPoses).toContain("champion-guard");
        }
        if (fixture.id === "x2-drunken-fist-wraps") {
          expect(
            Math.max(...capture.travel.stepTravel.map((step) => Math.abs(step.y))),
          ).toBeGreaterThan(80);
          expect(capture.renderEvidence.maxFlipAbsRotation).toBeGreaterThan(1);
          expect(capture.renderEvidence.maxFlipProgress).toBeGreaterThan(0.2);
          expect(capture.renderEvidence.maxFrontFootStretch).toBeGreaterThan(1.8);
          expect(capture.renderEvidence.holdPoses).toContain("crane-one-leg");
        }
        if (fixture.id === "x2-iron-palm-wraps") {
          expect(capture.travel.stepTravel[1]?.distancePx).toBeGreaterThan(90);
          expect(capture.renderEvidence.minPaperTurnScaleX).toBeLessThan(-0.1);
          expect(capture.renderEvidence.maxHandStretch).toBeGreaterThan(1.7);
          expect(capture.renderEvidence.holdPoses).toContain("praying-mantis");
        }
        captures.push(capture);
      }
    }

    const observedCadenceMs = Object.fromEntries(
      FIXTURES.map((fixture) => {
        const intervals = captures
          .filter((capture) => capture.weaponId === fixture.id)
          .flatMap((capture) => capture.intervalsMs);
        return [fixture.id, median(intervals)];
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
      zeroPlayerAuras: captures.every(
        (capture) =>
          !capture.rig.playerAuraVisible && !capture.auraSamples.some((visible) => visible),
      ),
      receiverScaleWraps: captures.every(
        (capture) =>
          Math.max(...capture.rig.handScaleRatios) <= 1.2 &&
          Math.max(...capture.rig.footScaleRatios) <= 1.15,
      ),
      extendedVisibleAuthorityReach: captures.every(
        (capture) =>
          capture.reachPx.length === capture.expectedReachPx.length &&
          capture.authorityReachPx.length === capture.expectedReachPx.length &&
          capture.reachPx.every((reach) => reach > 60) &&
          capture.authorityReachPx.every(
            (reach, index) => Math.abs(reach - capture.expectedReachPx[index]!) <= 0.25,
          ),
      ),
      roundhouseShowcase: captures
        .filter((capture) => capture.weaponId === "x2-muay-thai-wraps")
        .every(
          (capture) =>
            capture.motions.includes("roundhouse-kick") &&
            capture.showcaseScreenshot?.endsWith("-roundhouse-kick.png"),
        ),
      frontflipHeelDropShowcase: captures
        .filter((capture) => capture.weaponId === "x2-drunken-fist-wraps")
        .every(
          (capture) =>
            capture.motions.includes("frontflip-heel-drop") &&
            capture.showcaseScreenshot?.endsWith("-frontflip-heel-drop.png"),
        ),
      mantisHookShowcase: captures
        .filter((capture) => capture.weaponId === "x2-iron-palm-wraps")
        .every(
          (capture) =>
            capture.motions.includes("mantis-double-hook") &&
            capture.showcaseScreenshot?.endsWith("-mantis-double-hook.png"),
        ),
      prayingMantisStance: captures
        .filter(
          (capture) =>
            capture.weaponId === "x2-wing-chun-wraps" || capture.weaponId === "x2-iron-palm-wraps",
        )
        .every(
          (capture) =>
            capture.stanceScreenshot.endsWith("-stance.png") &&
            capture.rig.handPose[0]!.y < capture.rig.handPose[1]!.y - 5 &&
            capture.rig.handPose[0]!.rotation > 0.8 &&
            capture.rig.handPose[1]!.rotation < -0.5,
        ),
      craneStance: captures
        .filter((capture) => capture.weaponId === "x2-drunken-fist-wraps")
        .every(
          (capture) =>
            capture.stanceScreenshot.endsWith("-stance.png") &&
            Math.max(...capture.rig.footPose.map((foot) => foot.y)) -
              Math.min(...capture.rig.footPose.map((foot) => foot.y)) >
              20,
        ),
      wingChunZeroDisplacement: captures
        .filter((capture) => capture.weaponId === "x2-wing-chun-wraps")
        .every(
          (capture) =>
            capture.travel.distancePx < 1 &&
            capture.travel.pathDistancePx < 1 &&
            capture.travel.stepTravel.every((step) => step.distancePx < 1),
        ),
      theatricalAuthoritativeTravel: captures
        .filter((capture) => capture.weaponId !== "x2-wing-chun-wraps")
        .every(
          (capture) =>
            capture.travel.distancePx >= capture.travel.expectedPx * 0.3 &&
            capture.travel.pathDistancePx >= capture.travel.expectedPathPx * 0.3 &&
            capture.travel.positionSamples.length >= 5,
        ),
      dragonRocket: captures
        .filter((capture) => capture.weaponId === "x2-muay-thai-wraps")
        .every((capture) => {
          const rocketWindowPx =
            (capture.travel.stepTravel[0]?.distancePx ?? 0) +
            (capture.travel.stepTravel[1]?.distancePx ?? 0);
          return rocketWindowPx > 270 && rocketWindowPx <= 330;
        }),
      fullBodyPaperRotate: captures
        .filter(
          (capture) =>
            capture.weaponId === "x2-muay-thai-wraps" || capture.weaponId === "x2-iron-palm-wraps",
        )
        .every((capture) => capture.renderEvidence.minPaperTurnScaleX < -0.1),
      forwardFlip: captures
        .filter((capture) => capture.weaponId === "x2-drunken-fist-wraps")
        .every(
          (capture) =>
            capture.renderEvidence.maxFlipProgress > 0.2 &&
            capture.renderEvidence.maxFlipAbsRotation > 1,
        ),
      wildStretchAttacks: captures
        .filter((capture) => capture.weaponId !== "x2-wing-chun-wraps")
        .every(
          (capture) =>
            Math.max(
              capture.renderEvidence.maxHandStretch,
              capture.renderEvidence.maxRearHandStretch,
              capture.renderEvidence.maxFrontFootStretch,
              capture.renderEvidence.maxBackFootStretch,
            ) > 1.6,
        ),
      heldFinisherPoses: captures
        .filter((capture) => capture.weaponId !== "x2-wing-chun-wraps")
        .every(
          (capture) =>
            capture.renderEvidence.holdPoses.length > 0 &&
            capture.renderEvidence.maxHoldStrength > 0.6 &&
            capture.finisherScreenshot?.endsWith("-finisher.png"),
        ),
      everyCaptureHasTelemetry: captures.every(
        (capture) =>
          capture.travel.positionSamples.length >= 5 && capture.theatricalSamples.length >= 5,
      ),
      cadenceOrder:
        observedCadenceMs["x2-wing-chun-wraps"] < observedCadenceMs["x2-drunken-fist-wraps"] &&
        observedCadenceMs["x2-drunken-fist-wraps"] < observedCadenceMs["x2-muay-thai-wraps"] &&
        observedCadenceMs["x2-muay-thai-wraps"] < observedCadenceMs["x2-iron-palm-wraps"],
      rebuiltStylesFasterThanB23: FIXTURES.filter(
        (fixture) => fixture.id !== "x2-wing-chun-wraps",
      ).every(
        (fixture) =>
          (observedCadenceMs[fixture.id] ?? Number.POSITIVE_INFINITY) < fixture.b23ObservedMs * 0.8,
      ),
      wingChunCadencePinned:
        (observedCadenceMs["x2-wing-chun-wraps"] ?? Number.POSITIVE_INFINITY) <
        FIXTURES[1].b23ObservedMs + 35,
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
      zeroPlayerAuras: true,
      receiverScaleWraps: true,
      extendedVisibleAuthorityReach: true,
      roundhouseShowcase: true,
      frontflipHeelDropShowcase: true,
      mantisHookShowcase: true,
      prayingMantisStance: true,
      craneStance: true,
      wingChunZeroDisplacement: true,
      theatricalAuthoritativeTravel: true,
      dragonRocket: true,
      fullBodyPaperRotate: true,
      forwardFlip: true,
      wildStretchAttacks: true,
      heldFinisherPoses: true,
      everyCaptureHasTelemetry: true,
      cadenceOrder: true,
      rebuiltStylesFasterThanB23: true,
      wingChunCadencePinned: true,
      privatePorts: true,
      wholeArtCharacter: CHARACTER_ID,
    });
  });
});
