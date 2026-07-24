import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  classifyParryIncidence,
  PARRY_SLIDE_PX_PER_DAMAGE,
  ParryReaction,
  unpackParryGuardPose,
  unpackParryReaction,
} from "@dd/shared";
import { expect, type Page, test } from "@playwright/test";
import { bootArena, runArenaSpec } from "../helpers/arena-harness.js";

const EVIDENCE_DIR = path.resolve(
  import.meta.dirname,
  "../../docs/owner-notes-audit-v11-evidence/b26-parry",
);
const CHARACTER_ID = "proto-cowboy-hidden-face";
const WEAPON_ID = "x-sword-neon-katana";
const SHOOTER_KIND = "boothill";
const BURST_SHOOTER_KIND = "dust-ranger";
const SHOOTER_DAMAGE = 8;
const EXPECTED_SLIDE_PX = SHOOTER_DAMAGE * PARRY_SLIDE_PX_PER_DAMAGE;
const FORBIDDEN_PORTS = new Set([5180, 2567]);

interface BrowserPlayer {
  id: string;
  x: number;
  y: number;
  hp: number;
  height: number;
  vh: number;
  vx: number;
  vy: number;
  mvx: number;
  mvy: number;
  ackSeq: number;
  parriedSeq: number;
  parryPresentation: number;
  character: string;
  weapon: string;
}

interface BrowserEnemy {
  id: string;
  kind: string;
  x: number;
  y: number;
}

interface BrowserImage {
  x: number;
  y: number;
  rotation: number;
  tintFill: boolean;
  visible: boolean;
  texture: { key: string };
  frame: { name: string | number };
}

interface BrowserRig {
  x: number;
  y: number;
  body: BrowserImage & { scaleX: number; scaleY: number };
  root: {
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
  };
  hands: Array<{ front: boolean; img: BrowserImage }>;
  weapons: Array<{ img: BrowserImage; def: { id: string } }>;
  parryGuardPose: number;
  parryReaction: number;
  parrySuccessStart: number;
}

interface BrowserArena {
  blobs: Map<string, BrowserRig>;
  cameras: {
    main: {
      width: number;
      height: number;
      zoom: number;
      setZoom(value: number): void;
      setScroll(x: number, y: number): void;
    };
  };
  room: {
    sessionId: string;
    send(type: string, message?: unknown): void;
    state: {
      tick: number;
      mode: string;
      players: {
        get(id: string): BrowserPlayer | undefined;
      };
      enemies: {
        forEach(callback: (enemy: BrowserEnemy, id: string) => void): void;
      };
    };
  };
  scene: {
    pause(): void;
    resume(): void;
  };
  time: { now: number };
  game: { hasFocus: boolean };
  pointerOverInteractiveUi: boolean;
  animClock: number;
  verbs?: {
    isLegendOpen?(): boolean;
    releaseInputLatchIf?(force: boolean): void;
    toggleLegend?(timeMs: number): void;
  };
}

interface BrowserCaptureState {
  label: string;
  before: AuthoritySnapshot;
  impact: AuthoritySnapshot;
  after: AuthoritySnapshot;
  tick: number;
  presentation: number;
  pose: number;
  reaction: number;
  rigPose: number;
  rigReaction: number;
  bodyY: number;
  bodyScaleY: number;
  rootScaleX: number;
  rootScaleY: number;
  weaponId: string;
  weaponRotation: number;
  weaponTintFill: boolean;
  parrySuccessElapsedMs: number;
  weaponTexture: string;
  weaponFrame: string;
  hands: Array<{ front: boolean; x: number; y: number; rotation: number }>;
}

interface BrowserGlobal {
  ddGame: { scene: { getScene(key: string): BrowserArena } };
  __ddB26Capture?: BrowserCaptureState;
  __ddB26BurstCaptures?: BrowserCaptureState[];
  __ddB26ParryTimer?: number;
  __ddB26WatchTimer?: number;
}

interface AuthoritySnapshot {
  x: number;
  y: number;
  hp: number;
  height: number;
  vh: number;
  parriedSeq: number;
}

interface ShooterPlacement {
  id: string;
  attempt: number;
  incomingX: number;
  incomingY: number;
  distance: number;
}

interface LiveCapture extends BrowserCaptureState {
  screenshot: string;
  shooter: ShooterPlacement;
  impactDisplacementPx: number;
  displacementPx: number;
  heightGainPx: number;
}

function relativeEvidencePath(file: string): string {
  return path.relative(process.cwd(), file).replaceAll("\\", "/");
}

function requireDirectionalCapture(
  captures: readonly LiveCapture[],
  reaction: number,
): LiveCapture {
  const capture = captures.find((candidate) => candidate.reaction === reaction);
  if (!capture) throw new Error(`B26 live gate did not retain reaction ${reaction}`);
  return capture;
}

async function currentMode(page: Page): Promise<string> {
  return await page.evaluate(
    () => (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena").room.state.mode,
  );
}

async function waitForMode(page: Page, wanted: string): Promise<void> {
  await expect
    .poll(() => currentMode(page), {
      message: `B26 live gate should enter ${wanted}`,
      timeout: 20_000,
    })
    .toBe(wanted);
}

async function resetTraining(page: Page): Promise<void> {
  if ((await currentMode(page)) === "training") {
    await page.evaluate(() => {
      (globalThis as unknown as BrowserGlobal).ddGame.scene
        .getScene("arena")
        .room.send("toggleTraining");
    });
    await waitForMode(page, "arena");
  }
  await page.evaluate(() => {
    (globalThis as unknown as BrowserGlobal).ddGame.scene
      .getScene("arena")
      .room.send("toggleTraining");
  });
  await waitForMode(page, "training");
  const needsEquip = await page.evaluate(
    ({ character, weapon }) => {
      const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
      const self = arena.room.state.players.get(arena.room.sessionId);
      return self?.character !== character || self?.weapon !== weapon;
    },
    { character: CHARACTER_ID, weapon: WEAPON_ID },
  );
  if (needsEquip) {
    await page.evaluate(
      ({ character, weapon }) => {
        (globalThis as unknown as BrowserGlobal).ddGame.scene
          .getScene("arena")
          .room.send("devEquip", { character, weapon });
      },
      { character: CHARACTER_ID, weapon: WEAPON_ID },
    );
  }
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
          const self = arena.room.state.players.get(arena.room.sessionId);
          return {
            character: self?.character ?? null,
            weapon: self?.weapon ?? null,
          };
        }),
      { message: "B26 live gate should use the owner-requested character and held guard weapon" },
    )
    .toEqual({ character: CHARACTER_ID, weapon: WEAPON_ID });
  // Keep the dev-equip/toggle action and the spawn request in separate 20 Hz server budgets.
  await page.waitForTimeout(75);
}

async function findOnlyShooter(
  page: Page,
  shooterKind = SHOOTER_KIND,
): Promise<ShooterPlacement | null> {
  return await page.evaluate((wantedKind) => {
    const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
    const self = arena.room.state.players.get(arena.room.sessionId);
    if (!self) return null;
    let found: ShooterPlacement | null = null;
    arena.room.state.enemies.forEach((enemy, id) => {
      if (enemy.kind !== wantedKind) return;
      const incomingX = self.x - enemy.x;
      const incomingY = self.y - enemy.y;
      found = {
        id,
        attempt: 0,
        incomingX,
        incomingY,
        distance: Math.hypot(incomingX, incomingY),
      };
    });
    return found;
  }, shooterKind);
}

async function waitForPlayerRest(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
          const self = arena.room.state.players.get(arena.room.sessionId);
          return self
            ? Math.max(Math.abs(self.vx), Math.abs(self.vy), Math.abs(self.mvx), Math.abs(self.mvy))
            : Number.POSITIVE_INFINITY;
        }),
      {
        message: "B26 live fixture should settle inherited movement before measuring a reaction",
        timeout: 10_000,
      },
    )
    .toBeLessThan(0.5);
}

async function spawnShooterForIncidence(
  page: Page,
  wanted: number,
  shooterKind = SHOOTER_KIND,
): Promise<ShooterPlacement> {
  const baseAngle =
    wanted === ParryReaction.FromBelow
      ? Math.PI / 2
      : wanted === ParryReaction.FromLeft
        ? Math.PI
        : wanted === ParryReaction.FromRight
          ? 0
          : -Math.PI / 2;
  const angleOffsets = [0, 0.12, -0.12, 0.24, -0.24] as const;
  for (let attempt = 1; attempt <= angleOffsets.length; attempt++) {
    await resetTraining(page);
    await waitForPlayerRest(page);
    let shooter: ShooterPlacement | null = null;
    for (let sendAttempt = 0; sendAttempt < 8 && !shooter; sendAttempt++) {
      await page.evaluate(
        ({ shooterKind, angle }) => {
          (globalThis as unknown as BrowserGlobal).ddGame.scene
            .getScene("arena")
            .room.send("debugSpawn", {
              kind: shooterKind,
              count: 1,
              angle,
              distance: 420,
              attackReady: true,
            });
        },
        {
          shooterKind,
          angle: baseAngle + (angleOffsets[attempt - 1] ?? 0),
        },
      );
      await page.waitForTimeout(100);
      shooter = await findOnlyShooter(page, shooterKind);
    }
    expect(shooter, `B26 Testing Grounds should spawn one real ${shooterKind}`).not.toBeNull();
    if (!shooter) continue;
    const dominant =
      wanted === ParryReaction.FromLeft || wanted === ParryReaction.FromRight
        ? Math.abs(shooter.incomingX) >= Math.abs(shooter.incomingY) * 1.55
        : Math.abs(shooter.incomingY) >= Math.abs(shooter.incomingX) * 1.55;
    if (classifyParryIncidence(shooter.incomingX, shooter.incomingY) === wanted && dominant) {
      return { ...shooter, attempt };
    }
  }
  throw new Error(
    `B26 could not place a clean incidence ${wanted} with its deterministic training ring`,
  );
}

async function armCapture(page: Page, label: string, pauseOnCapture: boolean): Promise<void> {
  await page.evaluate(
    ({ captureLabel, shouldPause }) => {
      const holder = globalThis as unknown as BrowserGlobal;
      const arena = holder.ddGame.scene.getScene("arena");
      const self = arena.room.state.players.get(arena.room.sessionId);
      const armedRig = arena.blobs.get(arena.room.sessionId);
      if (!self) throw new Error("B26 live gate lost its player before arming the parry");
      if (!armedRig) throw new Error("B26 live gate lost its rig before arming the parry");
      const armedParrySuccessStart = armedRig.parrySuccessStart;
      holder.__ddB26Capture = undefined;
      if (holder.__ddB26ParryTimer) window.clearInterval(holder.__ddB26ParryTimer);
      if (holder.__ddB26WatchTimer) window.clearInterval(holder.__ddB26WatchTimer);
      const armedParriedSeq = self.parriedSeq;
      let before = {
        x: self.x,
        y: self.y,
        hp: self.hp,
        height: self.height,
        vh: self.vh,
        parriedSeq: self.parriedSeq,
      };
      const parry = (): void => arena.room.send("parry");
      parry();
      holder.__ddB26ParryTimer = window.setInterval(parry, 280);
      holder.__ddB26WatchTimer = window.setInterval(() => {
        const latest = arena.room.state.players.get(arena.room.sessionId);
        if (!latest) return;
        if (latest.parriedSeq === armedParriedSeq) {
          before = {
            x: latest.x,
            y: latest.y,
            hp: latest.hp,
            height: latest.height,
            vh: latest.vh,
            parriedSeq: latest.parriedSeq,
          };
          return;
        }
        const impact = {
          x: latest.x,
          y: latest.y,
          hp: latest.hp,
          height: latest.height,
          vh: latest.vh,
          parriedSeq: latest.parriedSeq,
        };
        if (holder.__ddB26ParryTimer) window.clearInterval(holder.__ddB26ParryTimer);
        if (holder.__ddB26WatchTimer) window.clearInterval(holder.__ddB26WatchTimer);
        holder.__ddB26ParryTimer = undefined;
        holder.__ddB26WatchTimer = undefined;
        // Hitstop intentionally holds the pre-impact affine. Follow rendered frames until the existing white
        // weapon-fill hook proves the first authored success pose has actually been applied, then freeze it.
        const waitForGuardFrame = (): void => {
          const current = arena.room.state.players.get(arena.room.sessionId);
          const rig = arena.blobs.get(arena.room.sessionId);
          const held = rig?.weapons[0];
          if (!current || !rig || !held)
            throw new Error("B26 live gate lost the authoritative player or held weapon");
          const parrySuccessElapsedMs = arena.animClock - rig.parrySuccessStart;
          if (rig.parrySuccessStart <= armedParrySuccessStart || parrySuccessElapsedMs <= 0) {
            window.requestAnimationFrame(waitForGuardFrame);
            return;
          }
          const camera = arena.cameras.main;
          camera.setZoom(2.25);
          camera.setScroll(
            rig.x - (camera.width * 0.28) / camera.zoom,
            rig.y - camera.height / camera.zoom / 2,
          );
          holder.__ddB26Capture = {
            label: captureLabel,
            before,
            impact,
            after: {
              x: current.x,
              y: current.y,
              hp: current.hp,
              height: current.height,
              vh: current.vh,
              parriedSeq: current.parriedSeq,
            },
            tick: arena.room.state.tick,
            presentation: current.parryPresentation,
            pose: (current.parryPresentation >> 3) & 0b11,
            reaction: current.parryPresentation & 0b111,
            rigPose: rig.parryGuardPose,
            rigReaction: rig.parryReaction,
            bodyY: rig.body.y,
            bodyScaleY: rig.body.scaleY,
            rootScaleX: rig.root.scaleX,
            rootScaleY: rig.root.scaleY,
            weaponId: held.def.id,
            weaponRotation: held.img.rotation,
            weaponTintFill: held.img.tintFill,
            parrySuccessElapsedMs,
            weaponTexture: held.img.texture.key,
            weaponFrame: String(held.img.frame.name),
            hands: rig.hands.map((hand) => ({
              front: hand.front,
              x: hand.img.x,
              y: hand.img.y,
              rotation: hand.img.rotation,
            })),
          };
          if (shouldPause) arena.scene.pause();
        };
        window.requestAnimationFrame(waitForGuardFrame);
      }, 5);
    },
    { captureLabel: label, shouldPause: pauseOnCapture },
  );
}

async function captureSuccessfulParry(
  page: Page,
  label: string,
  shooter: ShooterPlacement,
  pauseOnCapture = true,
): Promise<LiveCapture> {
  await armCapture(page, label, pauseOnCapture);
  await expect
    .poll(
      () => page.evaluate(() => (globalThis as unknown as BrowserGlobal).__ddB26Capture ?? null),
      {
        message: `B26 ${label} should catch a real hostile round in the parry window`,
        timeout: 20_000,
      },
    )
    .not.toBeNull();
  const captured = await page.evaluate(
    () => (globalThis as unknown as BrowserGlobal).__ddB26Capture ?? null,
  );
  if (!captured) throw new Error(`B26 ${label} capture disappeared after its ready edge`);
  const screenshotFile = path.join(EVIDENCE_DIR, `${label}.png`);
  await page.screenshot({ path: screenshotFile });
  if (pauseOnCapture) {
    await page.evaluate(() => {
      (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena").scene.resume();
    });
  }
  return {
    ...captured,
    shooter,
    screenshot: relativeEvidencePath(screenshotFile),
    impactDisplacementPx: Math.hypot(
      captured.impact.x - captured.before.x,
      captured.impact.y - captured.before.y,
    ),
    displacementPx: Math.hypot(
      captured.after.x - captured.before.x,
      captured.after.y - captured.before.y,
    ),
    heightGainPx: captured.after.height - captured.before.height,
  };
}

async function captureBurstParries(page: Page, shooter: ShooterPlacement): Promise<LiveCapture[]> {
  await page.evaluate(() => {
    const holder = globalThis as unknown as BrowserGlobal;
    const arena = holder.ddGame.scene.getScene("arena");
    const self = arena.room.state.players.get(arena.room.sessionId);
    const rig = arena.blobs.get(arena.room.sessionId);
    if (!self || !rig) throw new Error("B26 burst gate lost its player or rig while arming");
    if (holder.__ddB26ParryTimer) window.clearInterval(holder.__ddB26ParryTimer);
    if (holder.__ddB26WatchTimer) window.clearInterval(holder.__ddB26WatchTimer);
    holder.__ddB26BurstCaptures = [];
    let observedSeq = self.parriedSeq;
    let lastSuccessStart = rig.parrySuccessStart;
    let captureQueued = false;
    let before: AuthoritySnapshot = {
      x: self.x,
      y: self.y,
      hp: self.hp,
      height: self.height,
      vh: self.vh,
      parriedSeq: self.parriedSeq,
    };
    const parry = (): void => arena.room.send("parry");
    parry();
    holder.__ddB26ParryTimer = window.setInterval(parry, 280);
    holder.__ddB26WatchTimer = window.setInterval(() => {
      const latest = arena.room.state.players.get(arena.room.sessionId);
      if (!latest || captureQueued) return;
      if (latest.parriedSeq === observedSeq) {
        before = {
          x: latest.x,
          y: latest.y,
          hp: latest.hp,
          height: latest.height,
          vh: latest.vh,
          parriedSeq: latest.parriedSeq,
        };
        return;
      }
      observedSeq = latest.parriedSeq;
      captureQueued = true;
      const impact: AuthoritySnapshot = {
        x: latest.x,
        y: latest.y,
        hp: latest.hp,
        height: latest.height,
        vh: latest.vh,
        parriedSeq: latest.parriedSeq,
      };
      const waitForGuardFrame = (): void => {
        const current = arena.room.state.players.get(arena.room.sessionId);
        const currentRig = arena.blobs.get(arena.room.sessionId);
        const held = currentRig?.weapons[0];
        if (!current || !currentRig || !held)
          throw new Error("B26 burst gate lost its authoritative player or held weapon");
        const elapsed = arena.animClock - currentRig.parrySuccessStart;
        if (currentRig.parrySuccessStart <= lastSuccessStart || elapsed <= 0) {
          window.requestAnimationFrame(waitForGuardFrame);
          return;
        }
        lastSuccessStart = currentRig.parrySuccessStart;
        const captureIndex = holder.__ddB26BurstCaptures?.length ?? 0;
        const camera = arena.cameras.main;
        camera.setZoom(2.25);
        camera.setScroll(
          currentRig.x - (camera.width * 0.28) / camera.zoom,
          currentRig.y - camera.height / camera.zoom / 2,
        );
        holder.__ddB26BurstCaptures?.push({
          label: `burst-${captureIndex + 1}-${["high", "mid", "low"][captureIndex] ?? "guard"}`,
          before,
          impact,
          after: {
            x: current.x,
            y: current.y,
            hp: current.hp,
            height: current.height,
            vh: current.vh,
            parriedSeq: current.parriedSeq,
          },
          tick: arena.room.state.tick,
          presentation: current.parryPresentation,
          pose: (current.parryPresentation >> 3) & 0b11,
          reaction: current.parryPresentation & 0b111,
          rigPose: currentRig.parryGuardPose,
          rigReaction: currentRig.parryReaction,
          bodyY: currentRig.body.y,
          bodyScaleY: currentRig.body.scaleY,
          rootScaleX: currentRig.root.scaleX,
          rootScaleY: currentRig.root.scaleY,
          weaponId: held.def.id,
          weaponRotation: held.img.rotation,
          weaponTintFill: held.img.tintFill,
          parrySuccessElapsedMs: elapsed,
          weaponTexture: held.img.texture.key,
          weaponFrame: String(held.img.frame.name),
          hands: currentRig.hands.map((hand) => ({
            front: hand.front,
            x: hand.img.x,
            y: hand.img.y,
            rotation: hand.img.rotation,
          })),
        });
        before = {
          x: current.x,
          y: current.y,
          hp: current.hp,
          height: current.height,
          vh: current.vh,
          parriedSeq: current.parriedSeq,
        };
        captureQueued = false;
      };
      window.requestAnimationFrame(waitForGuardFrame);
    }, 5);
  });

  const captures: LiveCapture[] = [];
  for (let index = 0; index < 3; index++) {
    await expect
      .poll(
        () =>
          page.evaluate(
            () => (globalThis as unknown as BrowserGlobal).__ddB26BurstCaptures?.length ?? 0,
          ),
        {
          message: `B26 burst should retain guard pose ${index}`,
          timeout: 20_000,
        },
      )
      .toBeGreaterThan(index);
    const captured = await page.evaluate(
      (captureIndex) =>
        (globalThis as unknown as BrowserGlobal).__ddB26BurstCaptures?.[captureIndex] ?? null,
      index,
    );
    if (!captured) throw new Error(`B26 burst capture ${index} disappeared after its ready edge`);
    const screenshotFile = path.join(EVIDENCE_DIR, `${captured.label}.png`);
    await page.screenshot({ path: screenshotFile });
    captures.push({
      ...captured,
      shooter,
      screenshot: relativeEvidencePath(screenshotFile),
      impactDisplacementPx: Math.hypot(
        captured.impact.x - captured.before.x,
        captured.impact.y - captured.before.y,
      ),
      displacementPx: Math.hypot(
        captured.after.x - captured.before.x,
        captured.after.y - captured.before.y,
      ),
      heightGainPx: captured.after.height - captured.before.height,
    });
  }
  await page.evaluate(() => {
    const holder = globalThis as unknown as BrowserGlobal;
    if (holder.__ddB26ParryTimer) window.clearInterval(holder.__ddB26ParryTimer);
    if (holder.__ddB26WatchTimer) window.clearInterval(holder.__ddB26WatchTimer);
    holder.__ddB26ParryTimer = undefined;
    holder.__ddB26WatchTimer = undefined;
  });
  return captures;
}

test("B26 directional parry reactions and three-pose subtype cycle survive the real private stack", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await mkdir(EVIDENCE_DIR, { recursive: true });

  await runArenaSpec(page, async (baseURL) => {
    const clientPort = Number(new URL(baseURL).port);
    expect(FORBIDDEN_PORTS.has(clientPort)).toBe(false);
    await bootArena(page, baseURL, `char:${CHARACTER_ID}`);
    await waitForMode(page, "training");
    await page.locator("#game-root canvas").click({ position: { x: 640, y: 360 } });
    await page.evaluate(() => {
      const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
      if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend?.(arena.time.now);
      arena.verbs?.releaseInputLatchIf?.(true);
      arena.game.hasFocus = true;
      arena.pointerOverInteractiveUi = false;
    });

    const directionFixtures = [
      { label: "from-below-air-lift", reaction: ParryReaction.FromBelow },
      { label: "from-left-slide", reaction: ParryReaction.FromLeft },
      { label: "from-right-slide", reaction: ParryReaction.FromRight },
      { label: "from-above-brace", reaction: ParryReaction.FromAbove },
    ] as const;
    const directional: LiveCapture[] = [];
    for (const fixture of directionFixtures) {
      const shooter = await spawnShooterForIncidence(page, fixture.reaction);
      const capture = await captureSuccessfulParry(page, fixture.label, shooter);
      expect(unpackParryReaction(capture.presentation)).toBe(fixture.reaction);
      expect(capture.reaction).toBe(fixture.reaction);
      expect(capture.rigReaction).toBe(fixture.reaction);
      expect(unpackParryGuardPose(capture.presentation)).toBe(0);
      expect(capture.pose).toBe(0);
      expect(capture.rigPose).toBe(0);
      expect(capture.weaponId).toBe(WEAPON_ID);
      expect(capture.hands).toHaveLength(2);
      expect(capture.after.hp).toBeGreaterThanOrEqual(capture.before.hp);
      directional.push(capture);
    }

    const below = requireDirectionalCapture(directional, ParryReaction.FromBelow);
    const left = requireDirectionalCapture(directional, ParryReaction.FromLeft);
    const right = requireDirectionalCapture(directional, ParryReaction.FromRight);
    const above = requireDirectionalCapture(directional, ParryReaction.FromAbove);
    expect(below.impact.height).toBeGreaterThan(below.before.height);
    expect(left.impactDisplacementPx).toBeCloseTo(EXPECTED_SLIDE_PX, 0);
    expect(left.impact.x).toBeGreaterThan(left.before.x);
    expect(right.impactDisplacementPx).toBeCloseTo(EXPECTED_SLIDE_PX, 0);
    expect(right.impact.x).toBeLessThan(right.before.x);
    expect(above.impactDisplacementPx).toBeLessThan(1);
    expect(above.heightGainPx).toBeCloseTo(0, 5);
    const meanSideBodyScaleY = (left.bodyScaleY + right.bodyScaleY) / 2;
    expect(above.bodyScaleY).toBeLessThan(meanSideBodyScaleY * 0.92);

    const burstShooter = await spawnShooterForIncidence(
      page,
      ParryReaction.FromLeft,
      BURST_SHOOTER_KIND,
    );
    const burst = await captureBurstParries(page, burstShooter);
    for (const [index, capture] of burst.entries()) {
      expect(capture.pose).toBe(index);
      expect(capture.rigPose).toBe(index);
      expect(capture.weaponId).toBe(WEAPON_ID);
      expect(capture.parrySuccessElapsedMs).toBeGreaterThan(0);
      expect(capture.parrySuccessElapsedMs).toBeLessThan(245);
    }
    expect(burst.map((capture) => capture.pose)).toEqual([0, 1, 2]);
    expect(new Set(burst.map((capture) => capture.weaponRotation.toFixed(2))).size).toBe(3);
    const [high, mid, low] = burst;
    if (!high || !mid || !low)
      throw new Error("B26 live gate did not retain all three burst poses");
    expect(mid.tick - high.tick).toBeLessThanOrEqual(60);
    expect(low.tick - mid.tick).toBeLessThanOrEqual(60);

    const gamePort = Number(new URL(page.url()).searchParams.get("port"));
    expect(Number.isFinite(gamePort)).toBe(true);
    expect(FORBIDDEN_PORTS.has(gamePort)).toBe(false);
    const evidence = {
      generatedAt: new Date().toISOString(),
      characterId: CHARACTER_ID,
      weaponId: WEAPON_ID,
      subtype: "melee:sword",
      shooterKind: SHOOTER_KIND,
      burstShooterKind: BURST_SHOOTER_KIND,
      preventedDamage: SHOOTER_DAMAGE,
      slideCurve: {
        pxPerDamage: PARRY_SLIDE_PX_PER_DAMAGE,
        expectedDistancePx: EXPECTED_SLIDE_PX,
      },
      ports: { client: clientPort, game: gamePort },
      forbiddenPorts: [...FORBIDDEN_PORTS],
      directional,
      burst,
      assertions: {
        belowRoutedToLegacyLift: below.impact.height > below.before.height,
        leftSlidePx: left.impactDisplacementPx,
        rightSlidePx: right.impactDisplacementPx,
        aboveNoDisplacementPx: above.impactDisplacementPx,
        aboveCompressed: above.bodyScaleY < meanSideBodyScaleY * 0.92,
        poses: burst.map((capture) => capture.pose),
        uniqueWeaponRotations: new Set(burst.map((capture) => capture.weaponRotation.toFixed(2)))
          .size,
        allGuardPlateauFrames: burst.every(
          (capture) => capture.parrySuccessElapsedMs > 0 && capture.parrySuccessElapsedMs < 245,
        ),
      },
    };
    await writeFile(
      path.join(EVIDENCE_DIR, "live-gate.json"),
      `${JSON.stringify(evidence, null, 2)}\n`,
      "utf8",
    );
    await writeFile(
      path.join(EVIDENCE_DIR, "README.md"),
      [
        "# B26 directional parry live gate",
        "",
        `Real Testing Grounds gate on private ephemeral client/game ports ${clientPort}/${gamePort}.`,
        `Character: \`${CHARACTER_ID}\`. Guard weapon: \`${WEAPON_ID}\` (\`melee:sword\`).`,
        `A real \`${SHOOTER_KIND}\` supplied ${SHOOTER_DAMAGE}-damage hostile rounds.`,
        `The three-shot cycle used a real \`${BURST_SHOOTER_KIND}\` at its production cadence.`,
        "",
        "- `from-below-air-lift.png`: existing authoritative lift route.",
        `- \`from-left-slide.png\`: ${left.impactDisplacementPx.toFixed(2)} px away from the shot.`,
        `- \`from-right-slide.png\`: ${right.impactDisplacementPx.toFixed(2)} px away from the shot.`,
        "- `from-above-brace.png`: compressed brace, no authoritative displacement.",
        "- `burst-1-high.png`, `burst-2-mid.png`, `burst-3-low.png`: deterministic 0→1→2 guard cycle.",
        "- `live-gate.json`: ports, incidence vectors, authoritative before/after state, rig pose geometry, and assertions.",
        "",
        "The harness used `startSpecStack`, so ports 5180 and 2567 were neither bound nor touched.",
        "",
      ].join("\n"),
      "utf8",
    );
  });
});
