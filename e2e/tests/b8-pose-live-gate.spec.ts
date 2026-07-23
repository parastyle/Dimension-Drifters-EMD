import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { bootArena, runArenaSpec, waitForDevWeapon } from "../helpers/arena-harness.js";

const EVIDENCE_DIR = path.resolve(
  import.meta.dirname,
  "../../docs/owner-notes-audit-v9-evidence/b8-pose",
);

const WEAPONS = [
  { id: "gravediggers-spade", action: "attack", beats: 1 },
  { id: "x2-saint-bough-frost-crozier", action: "walk", beats: 0 },
  { id: "x2-nullspike-pike", action: "attack", beats: 3 },
  { id: "x-sword-neon-katana", action: "attack", beats: 3 },
  { id: "x2-sunbreaker-railgun", action: "attack", beats: 1 },
  { id: "x2-fool-s-gold-revolver", action: "attack", beats: 1 },
  { id: "x2-hollowbarrel-spell-scattergun-staff", action: "attack", beats: 1 },
] as const;

type Facing = "left" | "right";

interface Point {
  x: number;
  y: number;
}

interface GripPoint extends Point {
  role?: string;
}

interface BrowserMatrix {
  a: number;
  b: number;
  c: number;
  d: number;
  tx: number;
  ty: number;
}

interface BrowserDisplay {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  width: number;
  height: number;
  displayOriginX: number;
  displayOriginY: number;
  texture?: {
    getSourceImage(): CanvasImageSource;
  };
  frame?: {
    cutX: number;
    cutY: number;
    cutWidth: number;
    cutHeight: number;
  };
  getWorldTransformMatrix(): BrowserMatrix;
}

interface BrowserWeaponDef {
  id: string;
  gripFrac: number;
  gripPoints?: {
    primary: GripPoint;
    secondary?: GripPoint;
  };
  stance?: string;
  performance?: { hold?: string };
}

interface BrowserSwing {
  comboStep?: number;
  comboVariant?: string;
  motion?: string;
  comboPath?: {
    kind?: string;
    arcMultiplier?: number;
    reachMultiplier?: number;
  };
  comboChoreography?: { primitive?: string };
}

interface BrowserGraphics {
  clear(): BrowserGraphics;
  lineStyle(width: number, color: number, alpha?: number): BrowserGraphics;
  strokeCircle(x: number, y: number, radius: number): BrowserGraphics;
  lineBetween(x1: number, y1: number, x2: number, y2: number): BrowserGraphics;
  destroy(): void;
}

interface BrowserRig {
  animate(timeMs: number, anim: { fireHeld?: boolean }): unknown;
  __b8OriginalAnimate?: (timeMs: number, anim: { fireHeld?: boolean }) => unknown;
  attackBeatSeq: number;
  facing?: number;
  root: {
    add(child: BrowserGraphics): void;
    rotation: number;
  };
  body: BrowserDisplay;
  weapons: { img: BrowserDisplay }[];
  hands: { front: boolean; img: BrowserDisplay }[];
  weaponDef?: BrowserWeaponDef;
  swing?: BrowserSwing;
}

interface BrowserSelf {
  weapon?: string;
  attackSeq?: number;
  x?: number;
  y?: number;
}

interface BrowserArena {
  time: { now: number };
  game: { hasFocus: boolean };
  pointerOverInteractiveUi: boolean;
  add: { graphics(): BrowserGraphics };
  verbs?: {
    isLegendOpen?(): boolean;
    toggleLegend?(timeMs: number): void;
    releaseInputLatchIf?(force: boolean): void;
  };
  input: { activePointer: { rightButtonDown: () => boolean } };
  stepNetInput?(elapsedMs: number, up: boolean, down: boolean, x: number, y: number): void;
  spawnSlash(...args: unknown[]): unknown;
  __b8OriginalSpawnSlash?: (...args: unknown[]) => unknown;
  blobs: Map<string, BrowserRig>;
  room: {
    sessionId: string;
    send(type: string, message?: unknown): void;
    state: { players: { get(id: string): BrowserSelf | undefined } };
  };
}

interface PoseFrame {
  sceneNow: number;
  weaponId: string;
  facing: number;
  attackSeq: number;
  rigAttackSeq: number;
  comboStep: number;
  comboVariant: string;
  motion: string;
  primitive: string | null;
  hitPath: {
    kind: string | null;
    arcMultiplier: number | null;
    reachMultiplier: number | null;
  };
  weapon: {
    x: number;
    y: number;
    rotation: number;
    rootRotation: number;
    scaleX: number;
    scaleY: number;
  };
  primaryGripDeltaPx: number | null;
  secondaryGripDeltaPx: number | null;
}

interface AnchorAlpha {
  anchor: "primary" | "secondary";
  point: GripPoint;
  maxAlpha: number;
}

interface DirectionCapture {
  facing: Facing;
  startAttackSeq: number;
  endAttackSeq: number;
  acceptedBeats: number;
  authorityConfirmedSteps: number[];
  primaryGripDeltaPx: number | null;
  secondaryGripDeltaPx: number | null;
  hitPaths: PoseFrame["hitPath"][];
  screenshots: { idle: string; action: string };
  frames: PoseFrame[];
}

interface WeaponCapture {
  id: string;
  definition: {
    stance: string | null;
    performanceHold: string | null;
    gripPoints: BrowserWeaponDef["gripPoints"] | null;
  };
  anchorAlpha: AnchorAlpha[];
  directions: DirectionCapture[];
}

interface B8BrowserGlobal {
  ddGame: { scene: { getScene(key: string): BrowserArena } };
  __b8CaptureId?: string;
  __b8Frames?: PoseFrame[];
  __b8Input?: number;
  __b8Marker?: BrowserGraphics;
  __b8SuppressedVfx?: number;
  __b8VfxOverrideInstalled?: boolean;
}

function relativeEvidencePath(file: string): string {
  return path.relative(process.cwd(), file).replaceAll("\\", "/");
}

function authoritySteps(frames: PoseFrame[]): number[] {
  return [
    ...new Set(
      frames
        .filter((frame) => frame.attackSeq === frame.rigAttackSeq)
        .map((frame) => frame.comboStep)
        .filter((step) => step >= 0),
    ),
  ].sort((a, b) => a - b);
}

function uniqueHitPaths(frames: PoseFrame[]): PoseFrame["hitPath"][] {
  const seen = new Set<string>();
  return frames
    .map((frame) => frame.hitPath)
    .filter((hitPath) => hitPath.kind !== null)
    .filter((hitPath) => {
      const key = JSON.stringify(hitPath);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

async function equip(page: Page, weaponId: string): Promise<void> {
  await page.evaluate((id) => {
    const arena = (globalThis as unknown as B8BrowserGlobal).ddGame.scene.getScene("arena");
    arena.room.send("devEquip", { weapon: id });
  }, weaponId);
  await expect
    .poll(
      () =>
        page.evaluate((id) => {
          const arena = (globalThis as unknown as B8BrowserGlobal).ddGame.scene.getScene("arena");
          const self = arena.room.state.players.get(arena.room.sessionId);
          const rig = arena.blobs.get(arena.room.sessionId);
          return { authority: self?.weapon ?? null, rig: rig?.weaponDef?.id ?? null, wanted: id };
        }, weaponId),
      { message: `authority and rig should equip ${weaponId}`, timeout: 15_000 },
    )
    .toEqual({ authority: weaponId, rig: weaponId, wanted: weaponId });
}

async function aim(page: Page, facing: Facing): Promise<void> {
  const canvas = page.locator("#game-root canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Phaser canvas has no bounding box");
  await page.mouse.move(
    box.x + box.width * (facing === "right" ? 0.88 : 0.12),
    box.y + box.height * 0.5,
  );
  await page.waitForTimeout(140);
}

async function setHeldAttack(page: Page, facing: Facing, held: boolean): Promise<void> {
  await page.evaluate(
    ({ direction, down }) => {
      const holder = globalThis as unknown as B8BrowserGlobal;
      const arena = holder.ddGame.scene.getScene("arena");
      const aimX = direction === "right" ? 1 : -1;
      arena.game.hasFocus = true;
      arena.pointerOverInteractiveUi = false;
      arena.input.activePointer.rightButtonDown = () => false;
      arena.stepNetInput?.(50, false, false, 0, 0);
      const sendAttack = (): void => {
        const self = arena.room.state.players.get(arena.room.sessionId);
        arena.room.send("attack", {
          aimX,
          aimY: 0,
          tx: (self?.x ?? 0) + aimX * 300,
          ty: self?.y ?? 0,
        });
      };
      if (down && !holder.__b8Input) {
        sendAttack();
        holder.__b8Input = window.setInterval(sendAttack, 55);
      } else if (!down && holder.__b8Input) {
        window.clearInterval(holder.__b8Input);
        holder.__b8Input = undefined;
      }
    },
    { direction: facing, down: held },
  );
}

async function setContinuousHeld(page: Page, facing: Facing, held: boolean): Promise<void> {
  await page.evaluate(
    ({ direction, down }) => {
      const holder = globalThis as unknown as B8BrowserGlobal;
      const arena = holder.ddGame.scene.getScene("arena");
      if (holder.__b8Input) {
        window.clearInterval(holder.__b8Input);
        holder.__b8Input = undefined;
      }
      arena.game.hasFocus = true;
      arena.pointerOverInteractiveUi = false;
      arena.input.activePointer.rightButtonDown = () => down;
      arena.stepNetInput?.(50, false, false, 0, 0);
      if (down) {
        holder.__b8Input = window.setInterval(
          () => arena.stepNetInput?.(50, false, false, 0, 0),
          50,
        );
      }
      const self = arena.room.state.players.get(arena.room.sessionId);
      const aimX = direction === "right" ? 1 : -1;
      if (down) {
        arena.room.send("attack", {
          aimX,
          aimY: 0,
          tx: (self?.x ?? 0) + aimX * 300,
          ty: self?.y ?? 0,
        });
      }
    },
    { direction: facing, down: held },
  );
}

async function acceptMeasuredBeats(
  page: Page,
  facing: Facing,
  startAttackSeq: number,
  beats: number,
): Promise<void> {
  for (let offset = 1; offset <= beats; offset++) {
    const target = (startAttackSeq + offset) >>> 0;
    await expect
      .poll(
        () =>
          page.evaluate(
            ({ direction, wanted }) => {
              const arena = (globalThis as unknown as B8BrowserGlobal).ddGame.scene.getScene(
                "arena",
              );
              const self = arena.room.state.players.get(arena.room.sessionId);
              const current = self?.attackSeq ?? 0;
              if (((current - wanted) >>> 0) < 0x8000_0000) return current;
              const aimX = direction === "right" ? 1 : -1;
              arena.room.send("attack", {
                aimX,
                aimY: 0,
                tx: (self?.x ?? 0) + aimX * 300,
                ty: self?.y ?? 0,
              });
              return current;
            },
            { direction: facing, wanted: target },
          ),
        {
          message: `${beats}-beat measurement should accept beat ${offset}`,
          timeout: 8_000,
          intervals: [100, 120, 140],
        },
      )
      .toBe(target);
  }
}

async function walk(page: Page, facing: Facing, held: boolean): Promise<void> {
  await page.evaluate(
    ({ direction, down }) => {
      const holder = globalThis as unknown as B8BrowserGlobal;
      const arena = holder.ddGame.scene.getScene("arena");
      if (holder.__b8Input) {
        window.clearInterval(holder.__b8Input);
        holder.__b8Input = undefined;
      }
      arena.game.hasFocus = true;
      arena.pointerOverInteractiveUi = false;
      arena.stepNetInput?.(50, false, false, down ? (direction === "right" ? 1 : -1) : 0, 0);
      if (down) {
        holder.__b8Input = window.setInterval(
          () =>
            arena.stepNetInput?.(50, false, false, direction === "right" ? 1 : -1, 0),
          50,
        );
      }
    },
    { direction: facing, down: held },
  );
}

async function resetFrames(page: Page, weaponId: string): Promise<number> {
  return await page.evaluate((id) => {
    const holder = globalThis as unknown as B8BrowserGlobal;
    const arena = holder.ddGame.scene.getScene("arena");
    const self = arena.room.state.players.get(arena.room.sessionId);
    holder.__b8CaptureId = id;
    holder.__b8Frames = [];
    return self?.attackSeq ?? 0;
  }, weaponId);
}

async function readFrames(page: Page): Promise<PoseFrame[]> {
  return await page.evaluate(
    () => [...((globalThis as unknown as B8BrowserGlobal).__b8Frames ?? [])],
  );
}

async function sourceAnchorAlpha(page: Page): Promise<AnchorAlpha[]> {
  return await page.evaluate(() => {
    const holder = globalThis as unknown as B8BrowserGlobal;
    const arena = holder.ddGame.scene.getScene("arena");
    const rig = arena.blobs.get(arena.room.sessionId);
    const held = rig?.weapons[0]?.img;
    const def = rig?.weaponDef;
    if (!held?.texture || !held.frame || !def) throw new Error("weapon texture is unavailable");
    const source = held.texture.getSourceImage();
    const canvas = document.createElement("canvas");
    const sourceWidth = "naturalWidth" in source ? source.naturalWidth : source.width;
    const sourceHeight = "naturalHeight" in source ? source.naturalHeight : source.height;
    canvas.width = Number(sourceWidth);
    canvas.height = Number(sourceHeight);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("2D texture sampler is unavailable");
    context.drawImage(source, 0, 0);
    const grips = def.gripPoints ?? {
      primary: { x: def.gripFrac, y: 0.5 },
    };
    const points = [
      ["primary", grips.primary],
      ...(grips.secondary ? ([["secondary", grips.secondary]] as const) : []),
    ] as const;
    return points.map(([anchor, point]) => {
      const x =
        held.frame!.cutX + Math.round(point.x * Math.max(0, held.frame!.cutWidth - 1));
      const y =
        held.frame!.cutY + Math.round(point.y * Math.max(0, held.frame!.cutHeight - 1));
      let maxAlpha = 0;
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const sx = Math.max(0, Math.min(canvas.width - 1, x + dx));
          const sy = Math.max(0, Math.min(canvas.height - 1, y + dy));
          maxAlpha = Math.max(maxAlpha, context.getImageData(sx, sy, 1, 1).data[3] ?? 0);
        }
      }
      return { anchor, point, maxAlpha } as AnchorAlpha;
    });
  });
}

async function captureDirection(
  page: Page,
  spec: (typeof WEAPONS)[number],
  facing: Facing,
): Promise<DirectionCapture> {
  await aim(page, facing);
  await resetFrames(page, spec.id);
  await page.waitForTimeout(180);
  const idleFrames = await readFrames(page);
  const idleFrame = idleFrames.at(-1);
  const idleFile = path.join(EVIDENCE_DIR, `${spec.id}-${facing}-idle.png`);
  await page.locator("#game-root canvas").screenshot({ path: idleFile });

  const actionFile = path.join(EVIDENCE_DIR, `${spec.id}-${facing}-action.png`);
  let capturedActionWhileHeld = false;
  const startAttackSeq = await resetFrames(page, spec.id);
  if (spec.action === "walk") {
    await walk(page, facing, true);
    await page.waitForTimeout(460);
    await walk(page, facing, false);
  } else {
    if (spec.id === "gravediggers-spade") {
      await setContinuousHeld(page, facing, true);
      await expect
        .poll(
          () =>
            page.evaluate((start) => {
              const arena = (globalThis as unknown as B8BrowserGlobal).ddGame.scene.getScene(
                "arena",
              );
              const self = arena.room.state.players.get(arena.room.sessionId);
              return ((self?.attackSeq ?? 0) - start) >>> 0;
            }, startAttackSeq),
          {
            message: "Gravewarden held input should accept the live continuous action",
            timeout: 8_000,
            intervals: [50, 75, 100],
          },
        )
        .toBeGreaterThanOrEqual(spec.beats);
      // The visual whirl is time-continuous rather than beat-count driven. Keep the real held-input
      // channel live across multiple 600 ms periods so the trace necessarily crosses two loop seams.
      await page.waitForTimeout(1_400);
      await page.locator("#game-root canvas").screenshot({ path: actionFile });
      capturedActionWhileHeld = true;
      await setContinuousHeld(page, facing, false);
    } else {
      await acceptMeasuredBeats(page, facing, startAttackSeq, spec.beats);
    }
    await page.waitForTimeout(spec.id === "gravediggers-spade" ? 80 : 45);
  }

  if (!capturedActionWhileHeld)
    await page.locator("#game-root canvas").screenshot({ path: actionFile });
  const frames = await readFrames(page);
  const endAttackSeq = await page.evaluate(() => {
    const arena = (globalThis as unknown as B8BrowserGlobal).ddGame.scene.getScene("arena");
    return arena.room.state.players.get(arena.room.sessionId)?.attackSeq ?? 0;
  });
  const gripFrame = frames.at(-1) ?? idleFrame;
  return {
    facing,
    startAttackSeq,
    endAttackSeq,
    acceptedBeats: (endAttackSeq - startAttackSeq) >>> 0,
    authorityConfirmedSteps: authoritySteps(frames),
    primaryGripDeltaPx: gripFrame?.primaryGripDeltaPx ?? null,
    secondaryGripDeltaPx: gripFrame?.secondaryGripDeltaPx ?? null,
    hitPaths: uniqueHitPaths(frames),
    screenshots: {
      idle: relativeEvidencePath(idleFile),
      action: relativeEvidencePath(actionFile),
    },
    frames,
  };
}

test("B8 poses, painted grips, and authoritative combo language survive a VFX-off live gallery", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await runArenaSpec(page, async (baseURL) => {
    await mkdir(EVIDENCE_DIR, { recursive: true });
    await page.setViewportSize({ width: 640, height: 360 });
    await bootArena(page, baseURL, `weapon:${WEAPONS[0].id}`);
    await waitForDevWeapon(page, WEAPONS[0].id);
    await page.locator("#game-root canvas").click({ position: { x: 320, y: 180 } });
    await page.waitForTimeout(850);

    await page.evaluate(() => {
      const holder = globalThis as unknown as B8BrowserGlobal;
      const arena = holder.ddGame.scene.getScene("arena");
      if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend(arena.time.now);
      arena.verbs?.releaseInputLatchIf?.(true);
      arena.game.hasFocus = true;
      arena.pointerOverInteractiveUi = false;
      holder.__b8Frames = [];
      holder.__b8SuppressedVfx = 0;
      if (!arena.__b8OriginalSpawnSlash) {
        arena.__b8OriginalSpawnSlash = arena.spawnSlash;
        arena.spawnSlash = function b8SuppressSlash() {
          holder.__b8SuppressedVfx = (holder.__b8SuppressedVfx ?? 0) + 1;
          return undefined;
        };
      }
      holder.__b8VfxOverrideInstalled = arena.spawnSlash !== arena.__b8OriginalSpawnSlash;

      const rig = arena.blobs.get(arena.room.sessionId);
      if (!rig) throw new Error("live player rig is unavailable");
      holder.__b8Marker?.destroy();
      const marker = arena.add.graphics();
      rig.root.add(marker);
      holder.__b8Marker = marker;

      const anchorWorld = (display: BrowserDisplay, point: Point): Point => {
        const matrix = display.getWorldTransformMatrix();
        const localX = point.x * display.width - display.displayOriginX;
        const localY = point.y * display.height - display.displayOriginY;
        return {
          x: matrix.tx + matrix.a * localX + matrix.c * localY,
          y: matrix.ty + matrix.b * localX + matrix.d * localY,
        };
      };
      const localAnchor = (display: BrowserDisplay, point: Point): Point => {
        const localX = point.x * display.width - display.displayOriginX;
        const localY = point.y * display.height - display.displayOriginY;
        const cos = Math.cos(display.rotation);
        const sin = Math.sin(display.rotation);
        return {
          x:
            display.x +
            cos * display.scaleX * localX -
            sin * display.scaleY * localY,
          y:
            display.y +
            sin * display.scaleX * localX +
            cos * display.scaleY * localY,
        };
      };
      const worldOrigin = (display: BrowserDisplay): Point => {
        const matrix = display.getWorldTransformMatrix();
        return { x: matrix.tx, y: matrix.ty };
      };

      if (!rig.__b8OriginalAnimate) {
        rig.__b8OriginalAnimate = rig.animate;
        rig.animate = function b8PoseCapture(
          this: BrowserRig,
          timeMs: number,
          anim: { fireHeld?: boolean },
        ) {
          const result = this.__b8OriginalAnimate?.call(this, timeMs, anim);
          const id = holder.__b8CaptureId;
          const def = this.weaponDef;
          const weapon = this.weapons[0]?.img;
          if (!id || !def || def.id !== id || !weapon) return result;
          const grips = def.gripPoints ?? {
            primary: { x: def.gripFrac, y: 0.5 },
          };
          const primary = anchorWorld(weapon, grips.primary);
          const secondary = grips.secondary ? anchorWorld(weapon, grips.secondary) : undefined;
          const frontHand = this.hands.find((hand) => hand.front)?.img;
          const backHand = this.hands.find((hand) => !hand.front)?.img;
          const front = frontHand ? worldOrigin(frontHand) : undefined;
          const back = backHand ? worldOrigin(backHand) : undefined;
          const delta = (a: Point | undefined, b: Point | undefined): number | null =>
            a && b ? Math.hypot(a.x - b.x, a.y - b.y) : null;

          marker.clear();
          const primaryLocal = localAnchor(weapon, grips.primary);
          marker
            .lineStyle(2, 0xff3355, 1)
            .strokeCircle(primaryLocal.x, primaryLocal.y, 6)
            .lineBetween(primaryLocal.x - 8, primaryLocal.y, primaryLocal.x + 8, primaryLocal.y)
            .lineBetween(primaryLocal.x, primaryLocal.y - 8, primaryLocal.x, primaryLocal.y + 8);
          if (grips.secondary) {
            const secondaryLocal = localAnchor(weapon, grips.secondary);
            marker
              .lineStyle(2, 0x33e6ff, 1)
              .strokeCircle(secondaryLocal.x, secondaryLocal.y, 6)
              .lineBetween(
                secondaryLocal.x - 8,
                secondaryLocal.y,
                secondaryLocal.x + 8,
                secondaryLocal.y,
              )
              .lineBetween(
                secondaryLocal.x,
                secondaryLocal.y - 8,
                secondaryLocal.x,
                secondaryLocal.y + 8,
              );
          }

          const self = arena.room.state.players.get(arena.room.sessionId);
          const swing = this.swing;
          holder.__b8Frames?.push({
            sceneNow: timeMs,
            weaponId: id,
            facing: this.facing ?? 1,
            attackSeq: self?.attackSeq ?? 0,
            rigAttackSeq: this.attackBeatSeq ?? 0,
            comboStep: swing?.comboStep ?? -1,
            comboVariant: swing?.comboVariant ?? "default",
            motion: swing?.motion ?? "",
            primitive: swing?.comboChoreography?.primitive ?? null,
            hitPath: {
              kind: swing?.comboPath?.kind ?? null,
              arcMultiplier: swing?.comboPath?.arcMultiplier ?? null,
              reachMultiplier: swing?.comboPath?.reachMultiplier ?? null,
            },
            weapon: {
              x: weapon.x,
              y: weapon.y,
              rotation: weapon.rotation,
              rootRotation: this.root.rotation,
              scaleX: weapon.scaleX,
              scaleY: weapon.scaleY,
            },
            primaryGripDeltaPx: delta(primary, front),
            secondaryGripDeltaPx: delta(secondary, back),
          });
          if ((holder.__b8Frames?.length ?? 0) > 3_000) holder.__b8Frames?.shift();
          return result;
        };
      }
    });

    const captures: WeaponCapture[] = [];
    for (const spec of WEAPONS) {
      await equip(page, spec.id);
      await page.waitForTimeout(420);
      const definition = await page.evaluate((id) => {
        const holder = globalThis as unknown as B8BrowserGlobal;
        const arena = holder.ddGame.scene.getScene("arena");
        const rig = arena.blobs.get(arena.room.sessionId);
        if (!rig?.weaponDef || rig.weaponDef.id !== id) throw new Error(`missing rig for ${id}`);
        holder.__b8CaptureId = id;
        return {
          stance: rig.weaponDef.stance ?? null,
          performanceHold: rig.weaponDef.performance?.hold ?? null,
          gripPoints: rig.weaponDef.gripPoints ?? null,
        };
      }, spec.id);
      const anchorAlpha = await sourceAnchorAlpha(page);
      const directions: DirectionCapture[] = [];
      for (const facing of ["right", "left"] as const) {
        directions.push(await captureDirection(page, spec, facing));
        await page.waitForTimeout(180);
      }
      captures.push({ id: spec.id, definition, anchorAlpha, directions });
    }
    await setHeldAttack(page, "right", false);
    await walk(page, "right", false);

    const grave = captures.find((capture) => capture.id === "gravediggers-spade");
    const graveFrames = grave?.directions.flatMap((direction) => direction.frames) ?? [];
    const graveSeams = graveFrames
      .map((frame, index) => {
        const next = graveFrames[index + 1];
        if (!next || next.sceneNow <= frame.sceneNow) return undefined;
        const phase = ((frame.sceneNow / 1_000) / 0.6) % 1;
        const nextPhase = ((next.sceneNow / 1_000) / 0.6) % 1;
        if (nextPhase >= phase) return undefined;
        const axisDelta = Math.abs(
          Math.atan2(
            Math.sin(
              next.weapon.rootRotation +
                next.weapon.rotation -
                frame.weapon.rootRotation -
                frame.weapon.rotation,
            ),
            Math.cos(
              next.weapon.rootRotation +
                next.weapon.rotation -
                frame.weapon.rootRotation -
                frame.weapon.rotation,
            ),
          ),
        );
        return {
          atMs: next.sceneNow,
          frameGapMs: next.sceneNow - frame.sceneNow,
          positionDeltaPx: Math.hypot(
            next.weapon.x - frame.weapon.x,
            next.weapon.y - frame.weapon.y,
          ),
          axisDeltaRad: axisDelta,
          scaleDelta: Math.max(
            Math.abs(next.weapon.scaleX - frame.weapon.scaleX),
            Math.abs(next.weapon.scaleY - frame.weapon.scaleY),
          ),
        };
      })
      .filter((seam): seam is NonNullable<typeof seam> => !!seam);
    const graveActiveSeams = graveSeams.filter((seam) => seam.axisDeltaRad > 0.05);
    const nullspike = captures.find((capture) => capture.id === "x2-nullspike-pike");
    const voltedge = captures.find((capture) => capture.id === "x-sword-neon-katana");

    const assertions = {
      privateEphemeralPorts:
        new URL(baseURL).port !== "5180" &&
        new URL(baseURL).port !== "2567" &&
        new URL(baseURL).hostname === "127.0.0.1",
      exactScope:
        captures.length === WEAPONS.length &&
        captures.every((capture, index) => capture.id === WEAPONS[index]?.id),
      leftRightGalleryComplete: captures.every(
        (capture) =>
          capture.directions.length === 2 &&
          capture.directions.every(
            (direction) => !!direction.screenshots.idle && !!direction.screenshots.action,
          ),
      ),
      vfxDisabled:
        (await page.evaluate(
          () => (globalThis as unknown as B8BrowserGlobal).__b8VfxOverrideInstalled === true,
        )) === true,
      anchorsOnPaint: captures.every((capture) =>
        capture.anchorAlpha.every((anchor) => anchor.maxAlpha > 0),
      ),
      explicitGripsTouchHands: captures
        .filter((capture) => capture.definition.gripPoints)
        .every((capture) =>
          capture.directions.every(
            (direction) =>
              direction.primaryGripDeltaPx !== null &&
              direction.primaryGripDeltaPx <= 5 &&
              (capture.definition.gripPoints?.secondary === undefined ||
                (direction.secondaryGripDeltaPx !== null &&
                  direction.secondaryGripDeltaPx <= 7)),
          ),
        ),
      gravewardenSeamless:
        graveActiveSeams.length >= 2 &&
        graveActiveSeams.every(
          (seam) =>
            seam.frameGapMs <= 150 &&
            seam.positionDeltaPx <= 32 &&
            seam.axisDeltaRad <= 1.6 &&
            seam.scaleDelta <= 0.5,
        ),
      nullspikeExactlyThree:
        !!nullspike &&
        nullspike.directions.every(
          (direction) =>
            direction.acceptedBeats === 3 &&
            JSON.stringify(direction.authorityConfirmedSteps) === JSON.stringify([0, 1, 2]),
        ),
      voltedgeStabEnvelope:
        voltedge?.definition.stance === "near-ear-blade-up" &&
        voltedge.directions.every(
          (direction) =>
            direction.hitPaths.length > 0 &&
            direction.hitPaths.every(
              (hitPath) => hitPath.kind === "capsule" && hitPath.arcMultiplier === 0,
            ),
        ),
    };

    const evidence = {
      capturedAt: new Date().toISOString(),
      baseURL,
      vfx: {
        disabled: assertions.vfxDisabled,
        suppressedCalls: await page.evaluate(
          () => (globalThis as unknown as B8BrowserGlobal).__b8SuppressedVfx ?? 0,
        ),
      },
      captures,
      gravewardenSeams: graveSeams,
      gravewardenActiveSeams: graveActiveSeams,
      assertions,
    };
    const evidenceFile = path.join(EVIDENCE_DIR, "b8-pose-live-capture.json");
    await writeFile(evidenceFile, `${JSON.stringify(evidence, null, 2)}\n`);

    expect(assertions, "every B8 live-gallery gate must pass").toEqual(
      Object.fromEntries(Object.keys(assertions).map((key) => [key, true])),
    );
  });
});
