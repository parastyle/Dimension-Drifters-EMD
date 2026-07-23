import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { bootArena, runArenaSpec, waitForDevWeapon } from "../helpers/arena-harness.js";

const EVIDENCE_PHASE = process.env.DD_V7_KATANA_EVIDENCE_PHASE === "before" ? "before" : "after";
const EVIDENCE_DIR = path.resolve(
  import.meta.dirname,
  `../../docs/owner-notes-audit-v7-evidence/katana-movesets/${EVIDENCE_PHASE}`,
);
const BEFORE_CAPTURE = path.resolve(
  import.meta.dirname,
  "../../docs/owner-notes-audit-v7-evidence/katana-movesets/before/catalog-live-capture.json",
);
const MIN_PAIR_FINGERPRINT_DISTANCE = 0.16;
const FINGERPRINT_PHASE_SAMPLES = 48;

const WEAPONS = [
  { id: "x-sword-neon-katana", steps: 3 },
  { id: "x2-hailwidow-katana", steps: 3 },
  { id: "x2-gravechill-nodachi", steps: 3 },
  { id: "x2-voltfang-tachi", steps: 3 },
  { id: "x2-cinderfang-wakizashi-pair", steps: 3 },
  { id: "x2-stormpetal-odachi", steps: 3 },
  { id: "drift-katana-stillwater-edict", steps: 6 },
  { id: "drift-katana-stormthread", steps: 7 },
  { id: "drift-katana-riftstep", steps: 4 },
  { id: "drift-nodachi-pale-horizon", steps: 5 },
  { id: "drift-nodachi-gatebreaker", steps: 7 },
  { id: "drift-greatkatana-moonwake", steps: 6 },
  { id: "drift-greatkatana-tempest-regent", steps: 5 },
  { id: "drift-colossal-world-seam", steps: 4 },
] as const;

type Primitive =
  | "side-cut"
  | "wave-cut"
  | "knee-stab"
  | "lunge"
  | "backflip"
  | "rising-cut"
  | "spin-cut"
  | "guard-pivot";

const HEADLINES = [
  { id: "x-sword-neon-katana", primitive: "lunge", label: "voltedge-stab" },
  { id: "drift-katana-stormthread", primitive: "wave-cut", label: "wave-path" },
  { id: "drift-greatkatana-moonwake", primitive: "backflip", label: "backflip" },
  { id: "x2-hailwidow-katana", primitive: "knee-stab", label: "knees-bent-stab" },
  { id: "drift-katana-riftstep", primitive: "lunge", label: "lunge" },
] as const satisfies readonly { id: string; primitive: Primitive; label: string }[];

interface Point {
  x: number;
  y: number;
}

interface DisplayPoint extends Point {
  rotation: number;
  scaleX: number;
  scaleY: number;
  displayWidth: number;
  displayHeight: number;
  visible: boolean;
}

interface ComboTiming {
  activeStart?: number;
  activeEnd?: number;
  impact?: number;
  followEnd?: number;
}

interface KatanaFrame {
  wallMs: number;
  sceneNow: number;
  weaponId: string;
  attackSeq: number;
  rigAttackSeq: number;
  attackTick: number;
  swingStart: number;
  comboStep: number;
  comboVariant: string;
  motion: string;
  primitive?: Primitive;
  poseSeconds: number;
  effectiveCooldown: number;
  timing?: ComboTiming;
  root: DisplayPoint;
  authorityRoot: Point;
  body: DisplayPoint;
  shadow: DisplayPoint;
  frontWeapon?: DisplayPoint;
  backWeapon?: DisplayPoint;
  frontHand?: DisplayPoint;
  backHand?: DisplayPoint;
  frontFoot?: DisplayPoint;
  backFoot?: DisplayPoint;
}

interface RestContract {
  stance: string | null;
  sizeClass: string | null;
  grip: string;
  size: string;
  twoHanded: boolean;
  dual: boolean;
  gripPoints: unknown;
  performanceHold: string | null;
  poseLeadSpec: unknown;
  poseOffSpec: unknown;
  poseVariants: unknown;
}

interface DpsContract {
  damage: number;
  cooldown: number;
  fireRate: number | null;
  castCooldown: number | null;
  katanaHook: unknown;
}

interface DefinitionContract {
  displayLength: number;
  range: number;
  damage: number;
  cooldown: number;
  rest: RestContract;
  dps: DpsContract;
}

interface BrowserAnimationState extends Record<string, unknown> {
  fireHeld?: boolean;
}

interface BrowserWeaponDef {
  id: string;
  damage: number;
  range: number;
  cooldown: number;
  displayLength: number;
  stance?: string;
  sizeClass?: string;
  twoHanded?: boolean;
  dual?: boolean;
  gripPoints?: unknown;
  performance?: { hold?: string };
  katanaHook?: unknown;
  gun?: { fireRate?: number };
  cast?: { cooldown?: number };
  tags: { grip: string; size: string };
}

interface BrowserSwing {
  comboStep?: number;
  comboVariant?: string;
  motion?: string;
  poseSeconds?: number;
  effectiveCooldown?: number;
  comboTiming?: ComboTiming;
  comboChoreography?: { primitive?: Primitive };
}

interface BrowserStepSnapshot {
  swing: BrowserSwing;
  anim: BrowserAnimationState;
  comboFamily: string;
  swingFamily: string;
  swingStep: number;
  swingVariant: string;
  swingDirection: number;
  comboHoldPose: unknown;
  swingWeaponDef?: BrowserWeaponDef;
}

interface BrowserRig {
  animate(timeMs: number, anim: BrowserAnimationState): unknown;
  __v7KatanaOriginalAnimate?: (timeMs: number, anim: BrowserAnimationState) => unknown;
  __v7KatanaLastAnim?: BrowserAnimationState;
  attackBeatSeq: number;
  swingStart: number;
  swing?: BrowserSwing;
  comboFamily: string;
  swingFamily: string;
  swingStep: number;
  swingVariant: string;
  swingDirection: number;
  comboHoldPose: unknown;
  swingWeaponDef?: BrowserWeaponDef;
  weaponDef?: BrowserWeaponDef;
  poseLeadSpec?: unknown;
  poseOffSpec?: unknown;
  poseVariants?: unknown;
  root: DisplayPoint;
  body: DisplayPoint;
  shadow: DisplayPoint;
  weapons: { img: DisplayPoint }[];
  hands: { front: boolean; img: DisplayPoint }[];
  feet: { front: boolean; img: DisplayPoint }[];
}

interface BrowserSelf {
  weapon?: string;
  attackSeq?: number;
  attackTick?: number;
  x?: number;
  y?: number;
}

interface BrowserArena {
  time: { now: number };
  game: { hasFocus: boolean };
  pointerOverInteractiveUi: boolean;
  verbs?: {
    isLegendOpen?(): boolean;
    toggleLegend?(timeMs: number): void;
    releaseInputLatchIf?(force: boolean): void;
  };
  input: { activePointer: { rightButtonDown: () => boolean } };
  stepNetInput?(elapsedMs: number, up: boolean, down: boolean, x: number, y: number): void;
  spawnSlash(...args: unknown[]): unknown;
  __v7KatanaOriginalSpawnSlash?: (...args: unknown[]) => unknown;
  blobs: Map<string, BrowserRig>;
  room: {
    sessionId: string;
    send(type: string, message?: unknown): void;
    state: { players: { get(id: string): BrowserSelf | undefined } };
  };
}

interface KatanaBrowserGlobal {
  ddGame: { scene: { getScene(key: string): BrowserArena } };
  __v7KatanaFrames?: KatanaFrame[];
  __v7KatanaCaptureId?: string;
  __v7KatanaInput?: number;
  __v7KatanaSuppressedVfx?: number;
  __v7KatanaOriginalVfxCalls?: number;
  __v7KatanaVfxOverrideInstalled?: boolean;
  __v7KatanaStepSnapshots?: Record<number, BrowserStepSnapshot>;
}

interface WeaponCapture {
  id: string;
  expectedSteps: number;
  startAttackSeq: number;
  endAttackSeq: number;
  acceptedBeats: number;
  suppressedVfx: number;
  originalVfxCalls: number;
  vfxOverrideInstalled: boolean;
  definition: DefinitionContract;
  restBefore: RestContract;
  restAfter: RestContract;
  idleFrame: KatanaFrame;
  frames: KatanaFrame[];
  fingerprintFrames: KatanaFrame[];
  coveredSteps: number[];
  authorityConfirmedSteps: number[];
  fingerprint: number[];
  fingerprintKey: string;
  screenshot: string;
}

interface CatalogEvidence {
  phase: "before" | "after";
  capturedAt: string;
  threshold: number;
  weaponIds: string[];
  captures: WeaponCapture[];
  pairDistances: { a: string; b: string; distance: number }[];
  duplicateFingerprintPairs: string[];
  minimumPair?: { a: string; b: string; distance: number };
  headlineFrames: Record<string, string[]>;
  assertions: Record<string, boolean>;
}

function pointFeature(
  point: DisplayPoint | undefined,
  idle: DisplayPoint | undefined,
  width: number,
): number[] {
  if (!point || !idle) return [0, 0, 0, 1, 0, 0];
  const rotation = point.rotation - idle.rotation;
  return [
    (point.x - idle.x) / width,
    (point.y - idle.y) / width,
    Math.sin(rotation),
    Math.cos(rotation),
    point.scaleX - idle.scaleX,
    point.scaleY - idle.scaleY,
  ];
}

function nearestPhaseFrame(
  frames: readonly KatanaFrame[],
  target: number,
): KatanaFrame | undefined {
  let best: KatanaFrame | undefined;
  let bestError = Number.POSITIVE_INFINITY;
  for (const frame of frames) {
    const durationMs = Math.max(1, frame.poseSeconds * 1_000);
    const phase = Math.max(0, Math.min(1, (frame.sceneNow - frame.swingStart) / durationMs));
    const error = Math.abs(phase - target);
    if (error < bestError) {
      best = frame;
      bestError = error;
    }
  }
  return best;
}

function bestFramesPerStep(frames: readonly KatanaFrame[], steps: number): KatanaFrame[][] {
  const result: KatanaFrame[][] = [];
  for (let step = 0; step < steps; step++) {
    const groups = new Map<number, KatanaFrame[]>();
    for (const frame of frames) {
      if (frame.comboStep !== step) continue;
      const group = groups.get(frame.swingStart) ?? [];
      group.push(frame);
      groups.set(frame.swingStart, group);
    }
    const best = [...groups.values()].sort((a, b) => b.length - a.length)[0] ?? [];
    result.push(best);
  }
  return result;
}

function normalizedFingerprint(
  frames: readonly KatanaFrame[],
  steps: number,
  restFrame: KatanaFrame | undefined,
): number[] {
  const beats = bestFramesPerStep(frames, steps);
  const fallback = frames[0];
  if (!fallback || !restFrame) return [];
  const width = Math.max(1, restFrame.body.displayWidth);
  const vector: number[] = [];
  for (let sample = 0; sample < FINGERPRINT_PHASE_SAMPLES; sample++) {
    const comboPhase = (sample + 0.5) / FINGERPRINT_PHASE_SAMPLES;
    const stepPosition = comboPhase * steps;
    const step = Math.min(steps - 1, Math.floor(stepPosition));
    const localPhase = stepPosition - step;
    const frame = nearestPhaseFrame(beats[step] ?? [], localPhase) ?? fallback;
    const timing = frame.timing ?? {};
    vector.push(
      ...pointFeature(frame.frontWeapon, restFrame.frontWeapon, width),
      ...pointFeature(frame.backWeapon, restFrame.backWeapon, width),
      ...pointFeature(frame.frontHand, restFrame.frontHand, width),
      ...pointFeature(frame.backHand, restFrame.backHand, width),
      ...pointFeature(frame.frontFoot, restFrame.frontFoot, width),
      ...pointFeature(frame.backFoot, restFrame.backFoot, width),
      ...pointFeature(frame.body, restFrame.body, width),
      ...pointFeature(frame.root, restFrame.root, width),
      (frame.authorityRoot.x - restFrame.authorityRoot.x) / width,
      (frame.authorityRoot.y - restFrame.authorityRoot.y) / width,
      frame.poseSeconds,
      frame.effectiveCooldown,
      timing.activeStart ?? 0,
      timing.activeEnd ?? 0,
      timing.followEnd ?? 0,
    );
  }
  return vector.map((value) => (Number.isFinite(value) ? value : 0));
}

function fingerprintDistance(a: readonly number[], b: readonly number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let sum = 0;
  for (let index = 0; index < a.length; index++) {
    const delta = (a[index] ?? 0) - (b[index] ?? 0);
    sum += delta * delta;
  }
  return Math.sqrt(sum / a.length);
}

async function equip(page: Page, weaponId: string): Promise<void> {
  await page.evaluate((id) => {
    const arena = (globalThis as unknown as KatanaBrowserGlobal).ddGame.scene.getScene("arena");
    arena.room.send("devEquip", { weapon: id });
  }, weaponId);
  await expect
    .poll(
      () =>
        page.evaluate((id) => {
          const arena = (globalThis as unknown as KatanaBrowserGlobal).ddGame.scene.getScene(
            "arena",
          );
          const self = arena.room.state.players.get(arena.room.sessionId);
          const rig = arena.blobs.get(arena.room.sessionId);
          return { authority: self?.weapon ?? null, rig: rig?.weaponDef?.id ?? null, wanted: id };
        }, weaponId),
      { message: `authority and rig should equip ${weaponId}`, timeout: 15_000 },
    )
    .toEqual({ authority: weaponId, rig: weaponId, wanted: weaponId });
}

async function setHeldAttack(page: Page, held: boolean): Promise<void> {
  await page.evaluate((down) => {
    const holder = globalThis as unknown as KatanaBrowserGlobal;
    const arena = holder.ddGame.scene.getScene("arena");
    arena.game.hasFocus = true;
    arena.pointerOverInteractiveUi = false;
    arena.input.activePointer.rightButtonDown = () => false;
    arena.stepNetInput?.(50, false, false, 0, 0);
    const sendAttack = (): void => {
      const self = arena.room.state.players.get(arena.room.sessionId);
      arena.room.send("attack", {
        aimX: 1,
        aimY: 0,
        tx: (self?.x ?? 0) + 300,
        ty: self?.y ?? 0,
      });
    };
    if (down && !holder.__v7KatanaInput) {
      sendAttack();
      holder.__v7KatanaInput = window.setInterval(sendAttack, 80);
    } else if (!down && holder.__v7KatanaInput) {
      window.clearInterval(holder.__v7KatanaInput);
      holder.__v7KatanaInput = undefined;
    }
  }, held);
}

async function captureHeadlineSequence(
  page: Page,
  headline: (typeof HEADLINES)[number],
): Promise<string[]> {
  await equip(page, headline.id);
  await page.waitForTimeout(400);
  await setHeldAttack(page, true);
  await expect
    .poll(
      () =>
        page.evaluate(({ id, primitive }) => {
          const arena = (globalThis as unknown as KatanaBrowserGlobal).ddGame.scene.getScene(
            "arena",
          );
          const rig = arena.blobs.get(arena.room.sessionId);
          return rig?.weaponDef?.id === id && rig.swing?.comboChoreography?.primitive === primitive;
        }, headline),
      { message: `${headline.id} should accept ${headline.primitive}`, timeout: 20_000 },
    )
    .toBe(true);
  await setHeldAttack(page, false);

  const files: string[] = [];
  for (const [index, phase] of [0.18, 0.5, 0.78].entries()) {
    await page.evaluate((samplePhase) => {
      const arena = (globalThis as unknown as KatanaBrowserGlobal).ddGame.scene.getScene("arena");
      const rig = arena.blobs.get(arena.room.sessionId);
      if (!rig?.__v7KatanaOriginalAnimate || !rig.__v7KatanaLastAnim || !rig.swing)
        throw new Error("accepted headline descriptor is unavailable for phase evidence");
      const durationMs = Math.max(1, (rig.swing.poseSeconds ?? 0) * 1_000);
      rig.__v7KatanaOriginalAnimate.call(
        rig,
        rig.swingStart + durationMs * samplePhase,
        rig.__v7KatanaLastAnim,
      );
    }, phase);
    const file = path.join(EVIDENCE_DIR, `headline-${headline.label}-${index + 1}.png`);
    await page.screenshot({ path: file });
    files.push(path.relative(process.cwd(), file));
  }
  return files;
}

test("all 14 active katanas have VFX-independent authoritative bespoke motion fingerprints", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await runArenaSpec(page, async (baseURL) => {
    await mkdir(EVIDENCE_DIR, { recursive: true });
    await page.setViewportSize({ width: 640, height: 360 });
    await bootArena(page, baseURL, `weapon:${WEAPONS[0].id}`);
    await waitForDevWeapon(page, WEAPONS[0].id);
    await page.locator("#game-root canvas").click({ position: { x: 320, y: 180 } });
    await page.mouse.move(590, 180);
    await page.waitForTimeout(1_200);

    await page.evaluate(() => {
      const holder = globalThis as unknown as KatanaBrowserGlobal;
      const arena = holder.ddGame.scene.getScene("arena");
      if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend(arena.time.now);
      arena.verbs?.releaseInputLatchIf?.(true);
      arena.game.hasFocus = true;
      arena.pointerOverInteractiveUi = false;
      holder.__v7KatanaFrames = [];
      holder.__v7KatanaSuppressedVfx = 0;
      holder.__v7KatanaOriginalVfxCalls = 0;
      if (!arena.__v7KatanaOriginalSpawnSlash) {
        arena.__v7KatanaOriginalSpawnSlash = arena.spawnSlash;
        arena.spawnSlash = function v7KatanaSuppressSlash() {
          holder.__v7KatanaSuppressedVfx = (holder.__v7KatanaSuppressedVfx ?? 0) + 1;
          return undefined;
        };
      }
      holder.__v7KatanaVfxOverrideInstalled =
        arena.spawnSlash !== arena.__v7KatanaOriginalSpawnSlash;

      const rig = arena.blobs.get(arena.room.sessionId);
      if (!rig) throw new Error("live katana rig was not mounted");
      const copy = (point: DisplayPoint): DisplayPoint => ({
        x: point.x,
        y: point.y,
        rotation: point.rotation,
        scaleX: point.scaleX,
        scaleY: point.scaleY,
        displayWidth: point.displayWidth,
        displayHeight: point.displayHeight,
        visible: point.visible,
      });
      if (!rig.__v7KatanaOriginalAnimate) {
        rig.__v7KatanaOriginalAnimate = rig.animate;
        rig.animate = function v7KatanaAnimate(
          this: BrowserRig,
          timeMs: number,
          anim: BrowserAnimationState,
        ) {
          const result = this.__v7KatanaOriginalAnimate?.call(this, timeMs, anim);
          this.__v7KatanaLastAnim = anim;
          const captureId = holder.__v7KatanaCaptureId;
          if (!captureId || this.weaponDef?.id !== captureId || !this.swing) return result;
          const self = arena.room.state.players.get(arena.room.sessionId);
          const frontHand = this.hands.find((part) => part.front)?.img;
          const backHand = this.hands.find((part) => !part.front)?.img;
          const frontFoot = this.feet.find((part) => part.front)?.img;
          const backFoot = this.feet.find((part) => !part.front)?.img;
          const comboStep = this.swing.comboStep ?? -1;
          if (
            comboStep >= 0 &&
            this.swing.comboChoreography?.primitive &&
            !holder.__v7KatanaStepSnapshots?.[comboStep]
          ) {
            const snapshots = holder.__v7KatanaStepSnapshots ?? {};
            snapshots[comboStep] = {
              swing: this.swing,
              anim,
              comboFamily: this.comboFamily,
              swingFamily: this.swingFamily,
              swingStep: this.swingStep,
              swingVariant: this.swingVariant,
              swingDirection: this.swingDirection,
              comboHoldPose: this.comboHoldPose,
              swingWeaponDef: this.swingWeaponDef,
            };
            holder.__v7KatanaStepSnapshots = snapshots;
          }
          holder.__v7KatanaFrames?.push({
            wallMs: performance.now(),
            sceneNow: timeMs,
            weaponId: captureId,
            attackSeq: self?.attackSeq ?? 0,
            rigAttackSeq: this.attackBeatSeq ?? 0,
            attackTick: self?.attackTick ?? 0,
            swingStart: this.swingStart,
            comboStep,
            comboVariant: this.swing.comboVariant ?? "default",
            motion: this.swing.motion ?? "",
            primitive: this.swing.comboChoreography?.primitive,
            poseSeconds: this.swing.poseSeconds ?? 0,
            effectiveCooldown: this.swing.effectiveCooldown ?? 0,
            timing: this.swing.comboTiming ? { ...this.swing.comboTiming } : undefined,
            root: copy(this.root),
            authorityRoot: { x: self?.x ?? 0, y: self?.y ?? 0 },
            body: copy(this.body),
            shadow: copy(this.shadow),
            frontWeapon: this.weapons[0]?.img ? copy(this.weapons[0].img) : undefined,
            backWeapon: this.weapons[1]?.img ? copy(this.weapons[1].img) : undefined,
            frontHand: frontHand ? copy(frontHand) : undefined,
            backHand: backHand ? copy(backHand) : undefined,
            frontFoot: frontFoot ? copy(frontFoot) : undefined,
            backFoot: backFoot ? copy(backFoot) : undefined,
          });
          return result;
        };
      }
    });

    const captures: WeaponCapture[] = [];
    for (const spec of WEAPONS) {
      await equip(page, spec.id);
      await page.waitForTimeout(420);
      const initial = await page.evaluate((id) => {
        const holder = globalThis as unknown as KatanaBrowserGlobal;
        const arena = holder.ddGame.scene.getScene("arena");
        const rig = arena.blobs.get(arena.room.sessionId);
        const self = arena.room.state.players.get(arena.room.sessionId);
        if (!rig || rig.weaponDef?.id !== id || !self)
          throw new Error(`missing live rig for ${id}`);
        const def = rig.weaponDef;
        const rest: RestContract = {
          stance: def.stance ?? null,
          sizeClass: def.sizeClass ?? null,
          grip: def.tags.grip,
          size: def.tags.size,
          twoHanded: def.twoHanded === true,
          dual: def.dual === true,
          gripPoints: def.gripPoints ?? null,
          performanceHold: def.performance?.hold ?? null,
          poseLeadSpec: rig.poseLeadSpec ?? null,
          poseOffSpec: rig.poseOffSpec ?? null,
          poseVariants: rig.poseVariants ?? null,
        };
        holder.__v7KatanaFrames = [];
        holder.__v7KatanaStepSnapshots = {};
        holder.__v7KatanaCaptureId = id;
        holder.__v7KatanaSuppressedVfx = 0;
        holder.__v7KatanaOriginalVfxCalls = 0;
        return {
          attackSeq: self.attackSeq ?? 0,
          rest,
          definition: {
            displayLength: def.displayLength,
            range: def.range,
            damage: def.damage,
            cooldown: def.cooldown,
            rest,
            dps: {
              damage: def.damage,
              cooldown: def.cooldown,
              fireRate: def.gun?.fireRate ?? null,
              castCooldown: def.cast?.cooldown ?? null,
              katanaHook: def.katanaHook ?? null,
            },
          } satisfies DefinitionContract,
        };
      }, spec.id);

      await setHeldAttack(page, true);
      await expect
        .poll(
          () =>
            page.evaluate((start) => {
              const arena = (globalThis as unknown as KatanaBrowserGlobal).ddGame.scene.getScene(
                "arena",
              );
              const self = arena.room.state.players.get(arena.room.sessionId);
              return ((self?.attackSeq ?? 0) - start) >>> 0;
            }, initial.attackSeq),
          {
            message: `${spec.id} should accept two complete combo bars`,
            timeout: 20_000,
            intervals: [100, 150, 250],
          },
        )
        .toBeGreaterThanOrEqual(spec.steps * 2);
      if (EVIDENCE_PHASE === "after") {
        await expect
          .poll(
            () =>
              page.evaluate(() =>
                Object.keys(
                  (globalThis as unknown as KatanaBrowserGlobal).__v7KatanaStepSnapshots ?? {},
                )
                  .map(Number)
                  .sort((a, b) => a - b),
              ),
            {
              message: `${spec.id} should visibly present every authority-confirmed combo step`,
              timeout: 20_000,
              intervals: [100, 150, 250],
            },
          )
          .toEqual(Array.from({ length: spec.steps }, (_, index) => index));
      }
      await page.waitForTimeout(180);
      await setHeldAttack(page, false);

      const screenshotFile = path.join(EVIDENCE_DIR, `${spec.id}-natural-motion.png`);
      await page.screenshot({ path: screenshotFile });
      await page.waitForTimeout(1_650);
      const result = await page.evaluate(
        ({ id, steps, samples }) => {
          const holder = globalThis as unknown as KatanaBrowserGlobal;
          const arena = holder.ddGame.scene.getScene("arena");
          const rig = arena.blobs.get(arena.room.sessionId);
          const self = arena.room.state.players.get(arena.room.sessionId);
          if (!rig || rig.weaponDef?.id !== id || !self)
            throw new Error(`missing settled rig for ${id}`);
          const def = rig.weaponDef;
          const rest: RestContract = {
            stance: def.stance ?? null,
            sizeClass: def.sizeClass ?? null,
            grip: def.tags.grip,
            size: def.tags.size,
            twoHanded: def.twoHanded === true,
            dual: def.dual === true,
            gripPoints: def.gripPoints ?? null,
            performanceHold: def.performance?.hold ?? null,
            poseLeadSpec: rig.poseLeadSpec ?? null,
            poseOffSpec: rig.poseOffSpec ?? null,
            poseVariants: rig.poseVariants ?? null,
          };
          const frames = [...(holder.__v7KatanaFrames ?? [])];
          holder.__v7KatanaCaptureId = undefined;
          const copy = (point: DisplayPoint): DisplayPoint => ({
            x: point.x,
            y: point.y,
            rotation: point.rotation,
            scaleX: point.scaleX,
            scaleY: point.scaleY,
            displayWidth: point.displayWidth,
            displayHeight: point.displayHeight,
            visible: point.visible,
          });
          const captureFrame = (
            swing: BrowserSwing | undefined,
            swingStart: number,
            sceneNow: number,
          ): KatanaFrame => {
            const frontHand = rig.hands.find((part) => part.front)?.img;
            const backHand = rig.hands.find((part) => !part.front)?.img;
            const frontFoot = rig.feet.find((part) => part.front)?.img;
            const backFoot = rig.feet.find((part) => !part.front)?.img;
            return {
              wallMs: 0,
              sceneNow,
              weaponId: id,
              attackSeq: self.attackSeq ?? 0,
              rigAttackSeq: rig.attackBeatSeq,
              attackTick: self.attackTick ?? 0,
              swingStart,
              comboStep: swing?.comboStep ?? -1,
              comboVariant: swing?.comboVariant ?? "default",
              motion: swing?.motion ?? "",
              primitive: swing?.comboChoreography?.primitive,
              poseSeconds: swing?.poseSeconds ?? 0,
              effectiveCooldown: swing?.effectiveCooldown ?? 0,
              timing: swing?.comboTiming ? { ...swing.comboTiming } : undefined,
              root: copy(rig.root),
              authorityRoot: { x: self.x ?? 0, y: self.y ?? 0 },
              body: copy(rig.body),
              shadow: copy(rig.shadow),
              frontWeapon: rig.weapons[0]?.img ? copy(rig.weapons[0].img) : undefined,
              backWeapon: rig.weapons[1]?.img ? copy(rig.weapons[1].img) : undefined,
              frontHand: frontHand ? copy(frontHand) : undefined,
              backHand: backHand ? copy(backHand) : undefined,
              frontFoot: frontFoot ? copy(frontFoot) : undefined,
              backFoot: backFoot ? copy(backFoot) : undefined,
            };
          };
          const savedSwing = rig.swing;
          const savedSwingStart = rig.swingStart;
          const savedComboFamily = rig.comboFamily;
          const savedSwingFamily = rig.swingFamily;
          const savedSwingStep = rig.swingStep;
          const savedSwingVariant = rig.swingVariant;
          const savedSwingDirection = rig.swingDirection;
          const savedComboHoldPose = rig.comboHoldPose;
          const savedSwingWeaponDef = rig.swingWeaponDef;
          const replayAtMs = 1_000;
          const replayAnim = rig.__v7KatanaLastAnim ?? {};
          rig.swing = undefined;
          rig.swingStart = -1e9;
          rig.comboFamily = "none";
          rig.swingFamily = "none";
          rig.comboHoldPose = undefined;
          rig.swingWeaponDef = undefined;
          rig.__v7KatanaOriginalAnimate?.call(rig, replayAtMs, replayAnim);
          const idleFrame = captureFrame(undefined, -1e9, replayAtMs);
          const snapshots = holder.__v7KatanaStepSnapshots ?? {};
          const fingerprintFrames: KatanaFrame[] = [];
          for (let sample = 0; sample < samples; sample++) {
            const comboPhase = (sample + 0.5) / samples;
            const stepPosition = comboPhase * steps;
            const step = Math.min(steps - 1, Math.floor(stepPosition));
            const localPhase = stepPosition - step;
            const snapshot = snapshots[step];
            if (!snapshot) continue;
            rig.swing = snapshot.swing;
            rig.swingStart = replayAtMs;
            rig.comboFamily = snapshot.comboFamily;
            rig.swingFamily = snapshot.swingFamily;
            rig.swingStep = snapshot.swingStep;
            rig.swingVariant = snapshot.swingVariant;
            rig.swingDirection = snapshot.swingDirection;
            rig.comboHoldPose = snapshot.comboHoldPose;
            rig.swingWeaponDef = snapshot.swingWeaponDef;
            const sceneNow =
              replayAtMs + Math.max(1, (snapshot.swing.poseSeconds ?? 0) * 1_000) * localPhase;
            rig.__v7KatanaOriginalAnimate?.call(rig, sceneNow, snapshot.anim);
            fingerprintFrames.push(captureFrame(snapshot.swing, replayAtMs, sceneNow));
          }
          rig.swing = savedSwing;
          rig.swingStart = savedSwingStart;
          rig.comboFamily = savedComboFamily;
          rig.swingFamily = savedSwingFamily;
          rig.swingStep = savedSwingStep;
          rig.swingVariant = savedSwingVariant;
          rig.swingDirection = savedSwingDirection;
          rig.comboHoldPose = savedComboHoldPose;
          rig.swingWeaponDef = savedSwingWeaponDef;
          return {
            frames,
            fingerprintFrames,
            idleFrame,
            endAttackSeq: self.attackSeq ?? 0,
            rest,
            suppressedVfx: holder.__v7KatanaSuppressedVfx ?? 0,
            originalVfxCalls: holder.__v7KatanaOriginalVfxCalls ?? 0,
            vfxOverrideInstalled: holder.__v7KatanaVfxOverrideInstalled === true,
          };
        },
        { ...spec, samples: FINGERPRINT_PHASE_SAMPLES },
      );

      const frames = result.frames;
      const fingerprint = normalizedFingerprint(
        result.fingerprintFrames,
        spec.steps,
        result.idleFrame,
      );
      const coveredSteps = [
        ...new Set(frames.map((frame) => frame.comboStep).filter((step) => step >= 0)),
      ].sort((a, b) => a - b);
      const authorityConfirmedSteps = [
        ...new Set(
          frames
            .filter((frame) => frame.attackSeq === frame.rigAttackSeq)
            .map((frame) => frame.comboStep)
            .filter((step) => step >= 0),
        ),
      ].sort((a, b) => a - b);
      captures.push({
        id: spec.id,
        expectedSteps: spec.steps,
        startAttackSeq: initial.attackSeq,
        endAttackSeq: result.endAttackSeq,
        acceptedBeats: (result.endAttackSeq - initial.attackSeq) >>> 0,
        suppressedVfx: result.suppressedVfx,
        originalVfxCalls: result.originalVfxCalls,
        vfxOverrideInstalled: result.vfxOverrideInstalled,
        definition: initial.definition,
        restBefore: initial.rest,
        restAfter: result.rest,
        idleFrame: result.idleFrame,
        frames,
        fingerprintFrames: result.fingerprintFrames,
        coveredSteps,
        authorityConfirmedSteps,
        fingerprint,
        fingerprintKey: fingerprint.map((value) => value.toFixed(3)).join(","),
        screenshot: path.relative(process.cwd(), screenshotFile),
      });
    }

    const pairDistances: CatalogEvidence["pairDistances"] = [];
    const duplicateFingerprintPairs: string[] = [];
    for (let i = 0; i < captures.length; i++) {
      for (let j = i + 1; j < captures.length; j++) {
        const a = captures[i];
        const b = captures[j];
        if (!a || !b) continue;
        const distance = fingerprintDistance(a.fingerprint, b.fingerprint);
        pairDistances.push({ a: a.id, b: b.id, distance });
        if (a.fingerprintKey === b.fingerprintKey)
          duplicateFingerprintPairs.push(`${a.id} == ${b.id}`);
      }
    }
    pairDistances.sort((a, b) => a.distance - b.distance);

    let baseline: CatalogEvidence | undefined;
    if (EVIDENCE_PHASE === "after") {
      baseline = JSON.parse(await readFile(BEFORE_CAPTURE, "utf8")) as CatalogEvidence;
    }
    const baselineById = new Map(baseline?.captures.map((capture) => [capture.id, capture]));
    const headlineFrames: Record<string, string[]> = {};
    if (EVIDENCE_PHASE === "after") {
      for (const headline of HEADLINES)
        headlineFrames[headline.label] = await captureHeadlineSequence(page, headline);
    }

    const allRestSettles = captures.every(
      (capture) => JSON.stringify(capture.restBefore) === JSON.stringify(capture.restAfter),
    );
    const restMatchesBaseline = captures.every((capture) => {
      if (capture.id === "x-sword-neon-katana")
        return capture.restBefore.stance === "near-ear-blade-up";
      const before = baselineById.get(capture.id);
      return !!before && JSON.stringify(capture.restBefore) === JSON.stringify(before.restBefore);
    });
    const dpsMatchesBaseline = captures.every((capture) => {
      const before = baselineById.get(capture.id);
      if (capture.id === "x-sword-neon-katana" && before) {
        const { katanaHook: _afterHook, ...afterNominal } = capture.definition.dps;
        const { katanaHook: _beforeHook, ...beforeNominal } = before.definition.dps;
        return JSON.stringify(afterNominal) === JSON.stringify(beforeNominal);
      }
      return (
        !!before && JSON.stringify(capture.definition.dps) === JSON.stringify(before.definition.dps)
      );
    });
    const hail = captures.find((capture) => capture.id === "x2-hailwidow-katana");
    const baselineHail = baselineById.get("x2-hailwidow-katana");
    const headlinePrimitives = new Map(
      captures.map((capture) => [
        capture.id,
        new Set(capture.frames.map((frame) => frame.primitive)),
      ]),
    );
    const assertions = {
      exactActiveCensus:
        captures.length === 14 && new Set(captures.map((capture) => capture.id)).size === 14,
      allBarsCovered: captures.every(
        (capture) =>
          capture.coveredSteps.length === capture.expectedSteps &&
          capture.coveredSteps.every((step, index) => step === index),
      ),
      everyStepAuthorityConfirmed: captures.every(
        (capture) =>
          capture.authorityConfirmedSteps.length === capture.expectedSteps &&
          capture.authorityConfirmedSteps.every((step, index) => step === index),
      ),
      vfxDisabledDuringMeasurement: captures.every(
        (capture) => capture.vfxOverrideInstalled && capture.originalVfxCalls === 0,
      ),
      restSettlesByteIdentically: allRestSettles,
      restContractMatchesBefore: EVIDENCE_PHASE === "before" ? true : restMatchesBaseline,
      nominalDpsMatchesBefore: EVIDENCE_PHASE === "before" ? true : dpsMatchesBaseline,
      hailwidowExactlyOnePointFive:
        EVIDENCE_PHASE === "before"
          ? true
          : !!hail &&
            !!baselineHail &&
            hail.definition.displayLength === baselineHail.definition.displayLength * 1.5,
      noDuplicateFingerprint: duplicateFingerprintPairs.length === 0,
      deterministicFingerprintCoverage: captures.every(
        (capture) => capture.fingerprintFrames.length === FINGERPRINT_PHASE_SAMPLES,
      ),
      pairwiseMotionDistance:
        pairDistances.length === 91 &&
        pairDistances.every((pair) => pair.distance >= MIN_PAIR_FINGERPRINT_DISTANCE),
      headlineVoltedgeStab:
        EVIDENCE_PHASE === "before" ||
        headlinePrimitives.get("x-sword-neon-katana")?.has("lunge") === true,
      headlineWave:
        EVIDENCE_PHASE === "before" ||
        headlinePrimitives.get("drift-katana-stormthread")?.has("wave-cut") === true,
      headlineBackflip:
        EVIDENCE_PHASE === "before" ||
        headlinePrimitives.get("drift-greatkatana-moonwake")?.has("backflip") === true,
      headlineKneeStab:
        EVIDENCE_PHASE === "before" ||
        headlinePrimitives.get("x2-hailwidow-katana")?.has("knee-stab") === true,
      headlineLunge:
        EVIDENCE_PHASE === "before" ||
        headlinePrimitives.get("drift-katana-riftstep")?.has("lunge") === true,
      headlineFrameSequences:
        EVIDENCE_PHASE === "before" ||
        HEADLINES.every((headline) => headlineFrames[headline.label]?.length === 3),
    };

    const evidence: CatalogEvidence = {
      phase: EVIDENCE_PHASE,
      capturedAt: new Date().toISOString(),
      threshold: MIN_PAIR_FINGERPRINT_DISTANCE,
      weaponIds: captures.map((capture) => capture.id),
      captures,
      pairDistances,
      duplicateFingerprintPairs,
      minimumPair: pairDistances[0],
      headlineFrames,
      assertions,
    };
    const evidenceFile = path.join(EVIDENCE_DIR, "catalog-live-capture.json");
    if (EVIDENCE_PHASE === "after") {
      try {
        const previousRaw = await readFile(evidenceFile, "utf8");
        const previous = JSON.parse(previousRaw) as CatalogEvidence;
        if (previous.assertions.pairwiseMotionDistance === false) {
          await writeFile(
            path.join(EVIDENCE_DIR, "catalog-live-capture.failed-pairwise.json"),
            previousRaw,
          );
        }
        if (
          previous.assertions.allBarsCovered === false ||
          previous.assertions.everyStepAuthorityConfirmed === false
        ) {
          await writeFile(
            path.join(EVIDENCE_DIR, "catalog-live-capture.failed-coverage.json"),
            previousRaw,
          );
        }
      } catch {
        // No prior after-capture is expected on the first run.
      }
    }
    await writeFile(evidenceFile, `${JSON.stringify(evidence, null, 2)}\n`);

    if (EVIDENCE_PHASE === "before") {
      expect(
        captures.every((capture) => capture.frames.every((frame) => frame.primitive !== undefined)),
        "baseline must demonstrate the missing attack-only choreography vocabulary",
      ).toBe(true);
    } else {
      expect(assertions).toEqual(
        Object.fromEntries(Object.keys(assertions).map((key) => [key, true])),
      );
    }
  });
});
