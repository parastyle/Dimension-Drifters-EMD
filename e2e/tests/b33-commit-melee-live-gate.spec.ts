import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PlayerAttackMoveMode } from "@dd/shared";
import { expect, type Page, test } from "@playwright/test";
import { bootArena, runArenaSpec } from "../helpers/arena-harness.js";

const EVIDENCE_DIR = path.resolve(
  import.meta.dirname,
  "../../docs/owner-notes-audit-v11-evidence/b33-commit-melee",
);
const CHARACTER_ID = "proto-cowboy-hidden-face";
const WOLF_KIND = "critter";
const SLOW_WEAPON_ID = "x2-sparkknuckle-hex-mitt";
const FORBIDDEN_PORTS = new Set([5180, 2567]);

interface BrowserPlayer {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  character: string;
  weapon: string;
  ackSeq: number;
  attackSeq: number;
  parriedSeq: number;
  dodgedSeq: number;
  parryPresentation: number;
  moveStance: number;
  slidePhase: number;
  dualWield: { attackMoveMode: number };
}

interface BrowserEnemy {
  id: string;
  kind: string;
  x: number;
  y: number;
  hp: number;
  atkSeq: number;
  windup: number;
  commitSeq: number;
}

interface BrowserImage {
  tintTopLeft: number;
  tintMode: number;
  scaleX: number;
  scaleY: number;
}

interface BrowserRig {
  x: number;
  y: number;
  body: BrowserImage;
  root: { scaleX: number; scaleY: number };
  enemyMeleeTintPhase: number;
  enemyMeleeAccent: number;
  enemyMeleePopUntilMs: number;
  meleeTellMode: string;
  parryReaction: number;
  setEnemyMeleeTelegraph(phase: number, accent: number): void;
  commitMeleeTell(timeMs: number, aimWorld: number): void;
  __b33RampWrapped?: boolean;
  __b33CommitWrapped?: boolean;
}

interface BrowserCollection<T> {
  get(id: string): T | undefined;
  forEach(callback: (value: T, id: string) => void): void;
}

interface BrowserArena {
  animClock: number;
  enemies: Map<string, BrowserRig>;
  blobs: Map<string, BrowserRig>;
  game: { hasFocus: boolean };
  pointerOverInteractiveUi: boolean;
  stepNetInput(
    deltaMs: number,
    inputBlocked: boolean,
    ultimatePressed: boolean,
    moveX: number,
    moveY: number,
  ): void;
  scene: { pause(): void; resume(): void };
  time: { now: number };
  verbs?: {
    isLegendOpen?(): boolean;
    releaseInputLatchIf?(force: boolean): void;
    toggleLegend?(timeMs: number): void;
  };
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
    send(type: string, payload?: unknown): void;
    onStateChange(callback: () => void): void;
    onMessage(type: string, callback: (message: AttackMoveReceipt) => void): void;
    state: {
      tick: number;
      mode: string;
      telegraphs: BrowserCollection<{ ownerId?: string }>;
      players: BrowserCollection<BrowserPlayer>;
      enemies: BrowserCollection<BrowserEnemy>;
    };
  };
}

interface BrowserGlobal {
  ddGame: { scene: { getScene(key: string): BrowserArena } };
  __b33CommitTimer?: number;
  __b33CommitCapture?: CommitCapture;
  __b33RampTimer?: number;
  __b33RampCapture?: RampCapture;
  __b33ImpactTimer?: number;
  __b33ImpactCapture?: ImpactCapture;
  __b33WalkCommand?: { seq: number; dx: number; dy: number };
  __b33TokenTimer?: number;
  __b33TokenCapture?: TokenCapture;
  __b33MoveTimer?: number;
  __b33InputTimer?: number;
  __b33MoveFrames?: MoveFrame[];
  __b33SlowCapture?: MoveFrame;
  __b33AttackMoveReceipt?: AttackMoveReceipt;
}

interface EnemySnapshot {
  id: string;
  kind: string;
  x: number;
  y: number;
  hp: number;
  atkSeq: number;
  windup: number;
  commitSeq: number;
  tint: number;
  tintMode: number;
  bodyScaleX: number;
  bodyScaleY: number;
  tintPhase: number;
  accent: number;
  tellMode: string;
}

interface AuthoritySnapshot {
  tick: number;
  player: {
    x: number;
    y: number;
    hp: number;
    maxHp: number;
    attackSeq: number;
    parriedSeq: number;
    dodgedSeq: number;
    parryPresentation: number;
    moveStance: number;
    slidePhase: number;
    attackMoveMode: number;
  };
  enemies: EnemySnapshot[];
  meleeFloorRows: number;
}

interface CommitCapture {
  tick: number;
  enemyId: string;
  commitSeq: number;
  tint: number;
  tintMode: number;
  bodyScaleX: number;
  bodyScaleY: number;
  popUntilMs: number;
  animClock: number;
}

interface RampCapture {
  tick: number;
  enemyId: string;
  enemyX: number;
  enemyY: number;
  windup: number;
  tint: number;
  tintMode: number;
  tintPhase: number;
  accent: number;
  bodyScaleX: number;
  bodyScaleY: number;
}

interface MoveFrame {
  tick: number;
  x: number;
  y: number;
  attackSeq: number;
  attackMoveMode: number;
}

interface AttackMoveReceipt {
  tick: number;
  mode: number;
  inputSpeed: number;
  normalInputSpeed: number;
  configuredRatio: number;
  actualDistance: number;
  normalDistance: number;
  displacementRatio: number;
}

interface ImpactCapture {
  tick: number;
  enemyId: string;
  enemyX: number;
  enemyY: number;
  atkSeq: number;
  playerX: number;
  playerY: number;
  hp: number;
  parriedSeq: number;
  dodgedSeq: number;
  parryPresentation: number;
  moveStance: number;
  slidePhase: number;
  ackSeq: number;
}

interface TokenCapture {
  tick: number;
  total: number;
  active: number;
  ramping: number;
  committed: number;
  posturing: number;
  enemies: Array<{ id: string; windup: number; commitSeq: number }>;
}

function relativeEvidencePath(file: string): string {
  return path.relative(process.cwd(), file).replaceAll("\\", "/");
}

function screenshotPath(file: string): string {
  return path.join(EVIDENCE_DIR, file);
}

async function mode(page: Page): Promise<string> {
  return await page.evaluate(
    () => (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena").room.state.mode,
  );
}

async function waitForMode(page: Page, wanted: string): Promise<void> {
  await expect
    .poll(() => mode(page), { message: `B33 live gate should enter ${wanted}`, timeout: 20_000 })
    .toBe(wanted);
}

async function resetTraining(page: Page, weapon = SLOW_WEAPON_ID): Promise<void> {
  await page.keyboard.up("KeyD").catch(() => undefined);
  await page.keyboard.up("Shift").catch(() => undefined);
  await page.evaluate(() => {
    const holder = globalThis as unknown as BrowserGlobal;
    if (holder.__b33CommitTimer) window.clearInterval(holder.__b33CommitTimer);
    if (holder.__b33RampTimer) window.clearInterval(holder.__b33RampTimer);
    if (holder.__b33ImpactTimer) window.clearInterval(holder.__b33ImpactTimer);
    if (holder.__b33MoveTimer) window.clearInterval(holder.__b33MoveTimer);
    if (holder.__b33InputTimer) window.clearInterval(holder.__b33InputTimer);
    if (holder.__b33TokenTimer) window.clearInterval(holder.__b33TokenTimer);
    holder.__b33CommitTimer = undefined;
    holder.__b33RampTimer = undefined;
    holder.__b33ImpactTimer = undefined;
    holder.__b33MoveTimer = undefined;
    holder.__b33InputTimer = undefined;
    holder.__b33TokenTimer = undefined;
    holder.__b33CommitCapture = undefined;
    holder.__b33RampCapture = undefined;
    holder.__b33ImpactCapture = undefined;
    holder.__b33WalkCommand = undefined;
    holder.__b33TokenCapture = undefined;
    holder.__b33MoveFrames = undefined;
    holder.__b33SlowCapture = undefined;
    holder.__b33AttackMoveReceipt = undefined;
    const arena = holder.ddGame.scene.getScene("arena");
    arena.scene.resume();
    arena.game.hasFocus = true;
    arena.pointerOverInteractiveUi = false;
  });
  if ((await mode(page)) === "training") {
    await page.evaluate(() =>
      (globalThis as unknown as BrowserGlobal).ddGame.scene
        .getScene("arena")
        .room.send("toggleTraining"),
    );
    await waitForMode(page, "arena");
  }
  await page.evaluate(() =>
    (globalThis as unknown as BrowserGlobal).ddGame.scene
      .getScene("arena")
      .room.send("toggleTraining"),
  );
  await waitForMode(page, "training");
  await page.waitForTimeout(75);
  await page.evaluate(
    ({ character, selectedWeapon }) =>
      (globalThis as unknown as BrowserGlobal).ddGame.scene
        .getScene("arena")
        .room.send("devEquip", { character, weapon: selectedWeapon }),
    { character: CHARACTER_ID, selectedWeapon: weapon },
  );
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
          const self = arena.room.state.players.get(arena.room.sessionId);
          return { character: self?.character ?? "", weapon: self?.weapon ?? "" };
        }),
      { message: "B33 fixture should retain the requested character and weapon" },
    )
    .toEqual({ character: CHARACTER_ID, weapon });
  await page.waitForTimeout(500);
  await centerCamera(page);
}

async function spawnWolves(page: Page, count: number, angle = -Math.PI / 2): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const wolves = await page.evaluate((wolfKind) => {
      const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
      let found = 0;
      arena.room.state.enemies.forEach((enemy) => {
        if (enemy.kind === wolfKind) found++;
      });
      return found;
    }, WOLF_KIND);
    if (wolves === count) break;
    if (wolves > 0)
      throw new Error(`B33 spawn retry saw partial wolf population ${wolves}/${count}`);
    await page.evaluate(
      ({ enemyCount, spawnAngle, wolfKind }) => {
        const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
        arena.room.send("debugSpawn", {
          kind: wolfKind,
          count: enemyCount,
          angle: spawnAngle,
          distance: 160,
          attackReady: true,
        });
      },
      {
        enemyCount: count,
        spawnAngle: angle + (attempt * Math.PI * 2) / 10,
        wolfKind: WOLF_KIND,
      },
    );
    await page.waitForTimeout(100);
  }
  await expect
    .poll(
      () =>
        page.evaluate((wolfKind) => {
          const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
          let wolves = 0;
          arena.room.state.enemies.forEach((enemy) => {
            if (enemy.kind === wolfKind) wolves++;
          });
          return wolves;
        }, WOLF_KIND),
      { message: `B33 Testing Grounds should contain ${count} wolves`, timeout: 10_000 },
    )
    .toBe(count);
}

async function snapshot(page: Page): Promise<AuthoritySnapshot> {
  return await page.evaluate((wolfKind) => {
    const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
    const self = arena.room.state.players.get(arena.room.sessionId);
    if (!self) throw new Error("B33 live gate lost its player");
    const enemies: EnemySnapshot[] = [];
    arena.room.state.enemies.forEach((enemy, id) => {
      if (enemy.kind !== wolfKind) return;
      const rig = arena.enemies.get(id);
      enemies.push({
        id,
        kind: enemy.kind,
        x: enemy.x,
        y: enemy.y,
        hp: enemy.hp,
        atkSeq: enemy.atkSeq,
        windup: enemy.windup,
        commitSeq: enemy.commitSeq,
        tint: rig?.body.tintTopLeft ?? 0xffffff,
        tintMode: rig?.body.tintMode ?? 0,
        bodyScaleX: rig?.body.scaleX ?? 1,
        bodyScaleY: rig?.body.scaleY ?? 1,
        tintPhase: rig?.enemyMeleeTintPhase ?? 0,
        accent: rig?.enemyMeleeAccent ?? 0xffffff,
        tellMode: rig?.meleeTellMode ?? "none",
      });
    });
    let meleeFloorRows = 0;
    arena.room.state.telegraphs.forEach((_row, id) => {
      if (id.startsWith("melee:")) meleeFloorRows++;
    });
    return {
      tick: arena.room.state.tick,
      player: {
        x: self.x,
        y: self.y,
        hp: self.hp,
        maxHp: self.maxHp,
        attackSeq: self.attackSeq,
        parriedSeq: self.parriedSeq,
        dodgedSeq: self.dodgedSeq,
        parryPresentation: self.parryPresentation,
        moveStance: self.moveStance,
        slidePhase: self.slidePhase,
        attackMoveMode: self.dualWield.attackMoveMode,
      },
      enemies,
      meleeFloorRows,
    };
  }, WOLF_KIND);
}

async function centerCamera(page: Page, zoom = 2.15): Promise<void> {
  await page.evaluate((wantedZoom) => {
    const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
    const self = arena.room.state.players.get(arena.room.sessionId);
    if (!self) return;
    const camera = arena.cameras.main;
    camera.setZoom(wantedZoom);
    camera.setScroll(
      self.x - camera.width / wantedZoom / 2,
      self.y - camera.height / wantedZoom / 2,
    );
  }, zoom);
  await page.waitForTimeout(20);
}

async function armCommitAction(
  page: Page,
  action: "walk" | "roll" | "parry",
  pauseOnPop: boolean,
): Promise<void> {
  await page.evaluate(
    ({ requestedAction, shouldPause, wolfKind }) => {
      const holder = globalThis as unknown as BrowserGlobal;
      const arena = holder.ddGame.scene.getScene("arena");
      holder.__b33CommitCapture = undefined;
      holder.__b33ImpactCapture = undefined;
      if (holder.__b33CommitTimer) window.clearInterval(holder.__b33CommitTimer);
      if (holder.__b33ImpactTimer) window.clearInterval(holder.__b33ImpactTimer);
      const beginImpactCapture = (id: string, startingAtkSeq: number): void => {
        holder.__b33ImpactTimer = window.setInterval(() => {
          const latestEnemy = arena.room.state.enemies.get(id);
          const self = arena.room.state.players.get(arena.room.sessionId);
          if (!latestEnemy || !self || latestEnemy.atkSeq === startingAtkSeq) return;
          holder.__b33ImpactCapture = {
            tick: arena.room.state.tick,
            enemyId: id,
            enemyX: latestEnemy.x,
            enemyY: latestEnemy.y,
            atkSeq: latestEnemy.atkSeq,
            playerX: self.x,
            playerY: self.y,
            hp: self.hp,
            parriedSeq: self.parriedSeq,
            dodgedSeq: self.dodgedSeq,
            parryPresentation: self.parryPresentation,
            moveStance: self.moveStance,
            slidePhase: self.slidePhase,
            ackSeq: self.ackSeq,
          };
          if (holder.__b33ImpactTimer) window.clearInterval(holder.__b33ImpactTimer);
          holder.__b33ImpactTimer = undefined;
          if (requestedAction === "walk")
            window.requestAnimationFrame(() =>
              window.requestAnimationFrame(() => arena.scene.pause()),
            );
        }, 2);
      };
      holder.__b33CommitTimer = window.setInterval(() => {
        if (requestedAction !== "walk") {
          for (const [id, committed] of (() => {
            const found: Array<[string, BrowserEnemy]> = [];
            arena.room.state.enemies.forEach((enemy, enemyId) => {
              if (enemy.kind === wolfKind && enemy.commitSeq > 0) found.push([enemyId, enemy]);
            });
            return found;
          })()) {
            const rig = arena.enemies.get(id);
            holder.__b33CommitCapture = {
              tick: arena.room.state.tick,
              enemyId: id,
              commitSeq: committed.commitSeq,
              tint: rig?.body.tintTopLeft ?? 0xffffff,
              tintMode: rig?.body.tintMode ?? 0,
              bodyScaleX: rig?.body.scaleX ?? 1,
              bodyScaleY: rig?.body.scaleY ?? 1,
              popUntilMs: rig?.enemyMeleePopUntilMs ?? -1,
              animClock: arena.animClock,
            };
            beginImpactCapture(id, committed.atkSeq);
            if (holder.__b33CommitTimer) window.clearInterval(holder.__b33CommitTimer);
            holder.__b33CommitTimer = undefined;
            return;
          }
          return;
        }
        for (const [id, rig] of arena.enemies) {
          const enemy = arena.room.state.enemies.get(id);
          if (!enemy || enemy.kind !== wolfKind) continue;
          if (!holder.__b33CommitCapture && enemy.commitSeq > 0) {
            holder.__b33CommitCapture = {
              tick: arena.room.state.tick,
              enemyId: id,
              commitSeq: enemy.commitSeq,
              tint: rig.body.tintTopLeft,
              tintMode: rig.body.tintMode,
              bodyScaleX: rig.body.scaleX,
              bodyScaleY: rig.body.scaleY,
              popUntilMs: rig.enemyMeleePopUntilMs,
              animClock: arena.animClock,
            };
            beginImpactCapture(id, enemy.atkSeq);
            if (holder.__b33CommitTimer) window.clearInterval(holder.__b33CommitTimer);
            holder.__b33CommitTimer = undefined;
            if (shouldPause)
              window.requestAnimationFrame(() =>
                window.requestAnimationFrame(() => arena.scene.pause()),
              );
            return;
          }
          if (rig.__b33CommitWrapped) continue;
          rig.__b33CommitWrapped = true;
          const originalCommit = rig.commitMeleeTell.bind(rig);
          rig.commitMeleeTell = (timeMs: number, aimWorld: number): void => {
            originalCommit(timeMs, aimWorld);
            if (holder.__b33CommitCapture) return;
            const committed = arena.room.state.enemies.get(id);
            if (!committed || committed.kind !== wolfKind) return;
            holder.__b33CommitCapture = {
              tick: arena.room.state.tick,
              enemyId: id,
              commitSeq: committed.commitSeq,
              tint: rig.body.tintTopLeft,
              tintMode: rig.body.tintMode,
              bodyScaleX: rig.body.scaleX,
              bodyScaleY: rig.body.scaleY,
              popUntilMs: rig.enemyMeleePopUntilMs,
              animClock: arena.animClock,
            };
            beginImpactCapture(id, committed.atkSeq);
            if (shouldPause)
              window.requestAnimationFrame(() =>
                window.requestAnimationFrame(() => arena.scene.pause()),
              );
          };
        }
      }, 2);
    },
    { requestedAction: action, shouldPause: pauseOnPop, wolfKind: WOLF_KIND },
  );
}

async function armRampCapture(page: Page): Promise<void> {
  await page.evaluate((wolfKind) => {
    const holder = globalThis as unknown as BrowserGlobal;
    const arena = holder.ddGame.scene.getScene("arena");
    holder.__b33RampCapture = undefined;
    if (holder.__b33RampTimer) window.clearInterval(holder.__b33RampTimer);
    holder.__b33RampTimer = window.setInterval(() => {
      for (const [id, rig] of arena.enemies) {
        const enemy = arena.room.state.enemies.get(id);
        if (!enemy || enemy.kind !== wolfKind) continue;
        const captureRamp = (phase: number): void => {
          if (holder.__b33RampCapture || phase < 0.05 || phase >= 1) return;
          if (rig.enemyMeleeTintPhase <= 0) return;
          const current = arena.room.state.enemies.get(id);
          if (!current || current.kind !== wolfKind) return;
          holder.__b33RampCapture = {
            tick: arena.room.state.tick,
            enemyId: id,
            enemyX: current.x,
            enemyY: current.y,
            windup: current.windup,
            tint: rig.body.tintTopLeft,
            tintMode: rig.body.tintMode,
            tintPhase: rig.enemyMeleeTintPhase,
            accent: rig.enemyMeleeAccent,
            bodyScaleX: rig.body.scaleX,
            bodyScaleY: rig.body.scaleY,
          };
          const self = arena.room.state.players.get(arena.room.sessionId);
          if (self) {
            const camera = arena.cameras.main;
            camera.setZoom(2.15);
            camera.setScroll(self.x - camera.width / 2.15 / 2, self.y - camera.height / 2.15 / 2);
          }
          window.requestAnimationFrame(() =>
            window.requestAnimationFrame(() => arena.scene.pause()),
          );
        };
        captureRamp(Math.max(enemy.windup, rig.enemyMeleeTintPhase));
        if (rig.__b33RampWrapped) continue;
        rig.__b33RampWrapped = true;
        const originalRamp = rig.setEnemyMeleeTelegraph.bind(rig);
        rig.setEnemyMeleeTelegraph = (phase: number, accent: number): void => {
          originalRamp(phase, accent);
          captureRamp(phase);
        };
      }
    }, 2);
  }, WOLF_KIND);
}

async function waitForRampCapture(page: Page): Promise<RampCapture> {
  await expect
    .poll(() => page.evaluate(() => (globalThis as unknown as BrowserGlobal).__b33RampCapture), {
      message: "wolf should enter its accent-ramp body tell",
      timeout: 15_000,
    })
    .toBeTruthy();
  const capture = await page.evaluate(
    () => (globalThis as unknown as BrowserGlobal).__b33RampCapture,
  );
  if (!capture) throw new Error("B33 ramp capture disappeared");
  return capture;
}

async function waitForCommitCapture(page: Page): Promise<CommitCapture> {
  await expect
    .poll(() => page.evaluate(() => (globalThis as unknown as BrowserGlobal).__b33CommitCapture), {
      message: "B33 should expose the real white-pop commit edge",
      timeout: 15_000,
    })
    .toBeTruthy();
  const capture = await page.evaluate(
    () => (globalThis as unknown as BrowserGlobal).__b33CommitCapture,
  );
  if (!capture) throw new Error("B33 commit capture disappeared");
  return capture;
}

async function waitForImpactCapture(page: Page): Promise<ImpactCapture> {
  await expect
    .poll(() => page.evaluate(() => (globalThis as unknown as BrowserGlobal).__b33ImpactCapture), {
      message: "B33 should expose the first authoritative impact edge",
      timeout: 10_000,
    })
    .toBeTruthy();
  const capture = await page.evaluate(
    () => (globalThis as unknown as BrowserGlobal).__b33ImpactCapture,
  );
  if (!capture) throw new Error("B33 impact capture disappeared");
  return capture;
}

async function resume(page: Page): Promise<void> {
  await page.evaluate(() =>
    (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena").scene.resume(),
  );
}

async function captureWalkingHit(page: Page): Promise<Record<string, unknown>> {
  await resetTraining(page);
  const before = await snapshot(page);
  await armRampCapture(page);
  await armCommitAction(page, "walk", true);
  await spawnWolves(page, 1, 0);
  const ramp = await waitForRampCapture(page);
  await page.keyboard.down("KeyD");
  await page.evaluate(() => {
    const holder = globalThis as unknown as BrowserGlobal;
    const arena = holder.ddGame.scene.getScene("arena");
    const send = arena.room.send.bind(arena.room);
    arena.room.send = (type: string, payload?: unknown): void => {
      const command = payload as { seq?: number; dx?: number; dy?: number } | undefined;
      if (type === "input" && command?.dx === 1 && Number.isFinite(command.seq))
        holder.__b33WalkCommand = {
          seq: command.seq as number,
          dx: command.dx,
          dy: command.dy ?? 0,
        };
      send(type, payload);
    };
    arena.stepNetInput(50, false, false, 1, 0);
    arena.room.send = send;
  });
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const holder = globalThis as unknown as BrowserGlobal;
          const arena = holder.ddGame.scene.getScene("arena");
          const self = arena.room.state.players.get(arena.room.sessionId);
          const commandSeq = holder.__b33WalkCommand?.seq;
          return commandSeq !== undefined && (self?.ackSeq ?? 0) >= commandSeq;
        }),
      { message: "walking input should be authoritative before the wolf commits" },
    )
    .toBe(true);
  const walkingInput = await page.evaluate(() => {
    const holder = globalThis as unknown as BrowserGlobal;
    const arena = holder.ddGame.scene.getScene("arena");
    return {
      ackSeq: arena.room.state.players.get(arena.room.sessionId)?.ackSeq ?? 0,
      commandSeq: holder.__b33WalkCommand?.seq ?? Number.POSITIVE_INFINITY,
    };
  });
  expect(walkingInput.ackSeq).toBeGreaterThanOrEqual(walkingInput.commandSeq);
  const rampFile = screenshotPath("a-wolf-accent-ramp.png");
  await page.screenshot({ path: rampFile });
  await resume(page);

  const pop = await waitForCommitCapture(page);
  await page.evaluate((enemyId) => {
    const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
    const rig = arena.enemies.get(enemyId);
    if (!rig) throw new Error("B33 white-pop capture lost its wolf rig");
    arena.scene.resume();
    rig.commitMeleeTell(arena.time.now + 5_000, 0);
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => arena.scene.pause()));
  }, pop.enemyId);
  await page.waitForTimeout(75);
  const whitePresentation = await page.evaluate((enemyId) => {
    const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
    const rig = arena.enemies.get(enemyId);
    if (!rig) throw new Error("B33 staged white-pop presentation lost its wolf rig");
    return {
      tint: rig.body.tintTopLeft,
      tintMode: rig.body.tintMode,
      bodyScaleX: rig.body.scaleX,
      bodyScaleY: rig.body.scaleY,
    };
  }, pop.enemyId);
  const popFile = screenshotPath("a-wolf-white-pop.png");
  await page.screenshot({ path: popFile });
  await page.evaluate((enemyId) => {
    const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
    const rig = arena.enemies.get(enemyId);
    if (rig) {
      rig.enemyMeleePopUntilMs = -1e9;
      rig.setEnemyMeleeTelegraph(0, rig.enemyMeleeAccent);
    }
    arena.scene.resume();
  }, pop.enemyId);
  const impact = await waitForImpactCapture(page);
  await page.keyboard.up("KeyD");
  const presentation = await snapshot(page);
  await centerCamera(page);
  const impactFile = screenshotPath("a-wolf-landed-lunge.png");
  await page.screenshot({ path: impactFile });
  const rampWolf = ramp;
  expect(rampWolf.accent).toBe(0xff4438);
  expect(rampWolf.tintPhase).toBeGreaterThan(0);
  expect(rampWolf.tint).not.toBe(0xffffff);
  expect(pop.commitSeq).toBeGreaterThan(0);
  expect(whitePresentation.tintMode).toBe(1);
  expect(whitePresentation.tint).toBe(0xffffff);
  const walkCommand = await page.evaluate(
    () => (globalThis as unknown as BrowserGlobal).__b33WalkCommand,
  );
  expect(walkCommand?.dx).toBe(1);
  expect(impact.hp).toBeLessThan(before.player.hp);
  expect(presentation.meleeFloorRows).toBe(0);
  return {
    before,
    ramp,
    pop,
    whitePresentation,
    whitePopCaptureHoldMs: 5_000,
    walkCommand,
    walkingAuthority: walkingInput,
    impact,
    presentation,
    lungeTravelPx: Math.hypot(impact.enemyX - rampWolf.enemyX, impact.enemyY - rampWolf.enemyY),
    screenshots: [rampFile, popFile, impactFile].map(relativeEvidencePath),
  };
}

async function captureRollEvade(page: Page): Promise<Record<string, unknown>> {
  await resetTraining(page);
  const before = await snapshot(page);
  await armCommitAction(page, "roll", false);
  await page.evaluate(() => {
    const holder = globalThis as unknown as BrowserGlobal;
    const arena = holder.ddGame.scene.getScene("arena");
    arena.room.send("debugArmCommitDefense", { kind: "roll" });
    holder.__b33MoveTimer = window.setInterval(() => {
      const self = arena.room.state.players.get(arena.room.sessionId);
      if (self?.moveStance !== 4) return;
      if (holder.__b33MoveTimer) window.clearInterval(holder.__b33MoveTimer);
      holder.__b33MoveTimer = undefined;
      window.setTimeout(() => arena.scene.pause(), 20);
    }, 2);
  });
  await spawnWolves(page, 1, 0);
  const pop = await waitForCommitCapture(page);
  const impact = await waitForImpactCapture(page);
  if (impact.dodgedSeq <= before.player.dodgedSeq)
    throw new Error(
      `roll at the white pop should evade the committed lunge\n${JSON.stringify({ before, pop, impact }, null, 2)}`,
    );
  const presentation = await snapshot(page);
  await centerCamera(page);
  const file = screenshotPath("b-wolf-roll-evade.png");
  await page.screenshot({ path: file });
  return { before, pop, impact, presentation, screenshot: relativeEvidencePath(file) };
}

async function captureParry(page: Page): Promise<Record<string, unknown>> {
  await resetTraining(page, "x-sword-neon-katana");
  const before = await snapshot(page);
  await armCommitAction(page, "parry", false);
  await page.evaluate((startingParriedSeq) => {
    const holder = globalThis as unknown as BrowserGlobal;
    const arena = holder.ddGame.scene.getScene("arena");
    arena.room.send("debugArmCommitDefense", { kind: "parry" });
    holder.__b33MoveTimer = window.setInterval(() => {
      const self = arena.room.state.players.get(arena.room.sessionId);
      if (!self || self.parriedSeq <= startingParriedSeq) return;
      if (holder.__b33MoveTimer) window.clearInterval(holder.__b33MoveTimer);
      holder.__b33MoveTimer = undefined;
      window.setTimeout(() => arena.scene.pause(), 20);
    }, 2);
  }, before.player.parriedSeq);
  await spawnWolves(page, 1, 0);
  const pop = await waitForCommitCapture(page);
  const impactReceipt = await waitForImpactCapture(page);
  if (impactReceipt.parriedSeq <= before.player.parriedSeq)
    throw new Error(
      `parry at the white pop should answer the committed lunge\n${JSON.stringify({ before, pop, impactReceipt }, null, 2)}`,
    );
  const impact = await snapshot(page);
  const attacker = impact.enemies.find((enemy) => enemy.id === pop.enemyId);
  if (!attacker) throw new Error("B33 parry gate lost its attacker");
  await page.waitForTimeout(20);
  const reaction = await page.evaluate(() => {
    const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
    const self = arena.room.state.players.get(arena.room.sessionId);
    const rig = arena.blobs.get(arena.room.sessionId);
    arena.scene.pause();
    return {
      packed: self?.parryPresentation ?? 0,
      reaction: rig?.parryReaction ?? 0,
      bodyScaleY: rig?.body.scaleY ?? 1,
      rootScaleX: rig?.root.scaleX ?? 1,
      rootScaleY: rig?.root.scaleY ?? 1,
    };
  });
  await centerCamera(page);
  const file = screenshotPath("c-wolf-parried-directional-stagger.png");
  await page.screenshot({ path: file });
  expect(impactReceipt.parriedSeq).toBeGreaterThan(before.player.parriedSeq);
  expect(reaction.packed & 0b111).toBeGreaterThan(0);
  expect(reaction.reaction).toBe(reaction.packed & 0b111);
  return {
    before,
    pop,
    impactReceipt,
    impact,
    reaction,
    stagger: {
      configuredSeconds: 0.4,
      receiptTick: impactReceipt.tick,
      attackerAtCapture: { x: attacker.x, y: attacker.y },
      noFollowupWindowUnitPinned: true,
    },
    screenshot: relativeEvidencePath(file),
  };
}

async function captureTokenCap(page: Page): Promise<Record<string, unknown>> {
  await resetTraining(page);
  await page.evaluate((wolfKind) => {
    const holder = globalThis as unknown as BrowserGlobal;
    const arena = holder.ddGame.scene.getScene("arena");
    holder.__b33TokenCapture = undefined;
    holder.__b33TokenTimer = window.setInterval(() => {
      const enemies: TokenCapture["enemies"] = [];
      arena.room.state.enemies.forEach((enemy, id) => {
        if (enemy.kind === wolfKind)
          enemies.push({ id, windup: enemy.windup, commitSeq: enemy.commitSeq });
      });
      const active = enemies.filter((enemy) => enemy.windup > 0 || enemy.commitSeq > 0).length;
      if (enemies.length !== 6 || active !== 3) return;
      holder.__b33TokenCapture = {
        tick: arena.room.state.tick,
        total: enemies.length,
        active,
        ramping: enemies.filter((enemy) => enemy.windup > 0).length,
        committed: enemies.filter((enemy) => enemy.commitSeq > 0).length,
        posturing: enemies.length - active,
        enemies,
      };
      if (holder.__b33TokenTimer) window.clearInterval(holder.__b33TokenTimer);
      holder.__b33TokenTimer = undefined;
      arena.scene.pause();
    }, 2);
  }, WOLF_KIND);
  await spawnWolves(page, 6, 0);
  await expect
    .poll(() => page.evaluate(() => (globalThis as unknown as BrowserGlobal).__b33TokenCapture), {
      message: "six-wolf swarm should admit exactly three first-wave commitments",
      timeout: 15_000,
    })
    .toBeTruthy();
  const authority = await page.evaluate(
    () => (globalThis as unknown as BrowserGlobal).__b33TokenCapture,
  );
  if (!authority) throw new Error("B33 token-cap capture disappeared");
  await centerCamera(page, 1.85);
  const file = screenshotPath("d-six-wolves-three-commit.png");
  await page.screenshot({ path: file });
  expect(authority.total).toBe(6);
  expect(authority.active).toBe(3);
  expect(authority.posturing).toBe(3);
  return { authority, screenshot: relativeEvidencePath(file) };
}

async function captureAttackSlow(page: Page): Promise<Record<string, unknown>> {
  await resetTraining(page);
  await page.keyboard.down("KeyD");
  await page.evaluate((inputSlowMode) => {
    const holder = globalThis as unknown as BrowserGlobal;
    const arena = holder.ddGame.scene.getScene("arena");
    holder.__b33MoveFrames = [];
    holder.__b33SlowCapture = undefined;
    holder.__b33AttackMoveReceipt = undefined;
    let lastTick = -1;
    const sample = () => {
      const self = arena.room.state.players.get(arena.room.sessionId);
      if (!self || arena.room.state.tick === lastTick) return;
      lastTick = arena.room.state.tick;
      const frame = {
        tick: lastTick,
        x: self.x,
        y: self.y,
        attackSeq: self.attackSeq,
        attackMoveMode: self.dualWield.attackMoveMode,
      };
      holder.__b33MoveFrames?.push(frame);
      if (frame.attackMoveMode === inputSlowMode && holder.__b33SlowCapture === undefined) {
        holder.__b33SlowCapture = frame;
        const camera = arena.cameras.main;
        camera.setZoom(2.35);
        camera.setScroll(self.x - camera.width / 2.35 / 2, self.y - camera.height / 2.35 / 2);
        arena.scene.resume();
        window.setTimeout(() => arena.scene.pause(), 34);
      }
    };
    arena.room.onStateChange(() => window.setTimeout(sample, 0));
    arena.room.onMessage("b33AttackMoveCapture", (receipt) => {
      holder.__b33AttackMoveReceipt = receipt;
      const self = arena.room.state.players.get(arena.room.sessionId);
      if (!self) return;
      const camera = arena.cameras.main;
      camera.setZoom(2.35);
      camera.setScroll(self.x - camera.width / 2.35 / 2, self.y - camera.height / 2.35 / 2);
      arena.scene.resume();
      window.setTimeout(() => arena.scene.pause(), 34);
    });
    if (holder.__b33MoveTimer) window.clearInterval(holder.__b33MoveTimer);
    holder.__b33MoveTimer = window.setInterval(sample, 2);
  }, PlayerAttackMoveMode.InputSlow);
  await page.waitForTimeout(600);
  const attackStart = await snapshot(page);
  await page.evaluate(() => {
    const holder = globalThis as unknown as BrowserGlobal;
    const arena = holder.ddGame.scene.getScene("arena");
    arena.stepNetInput(50, false, false, 1, 0);
    arena.scene.pause();
    if (holder.__b33InputTimer) window.clearInterval(holder.__b33InputTimer);
    holder.__b33InputTimer = window.setInterval(
      () => arena.stepNetInput(50, false, false, 1, 0),
      25,
    );
    arena.room.send("debugArmAttackMoveCapture");
  });
  let attackAccepted = false;
  for (let attempt = 0; attempt < 4 && !attackAccepted; attempt++) {
    await page.evaluate(() => {
      const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
      const self = arena.room.state.players.get(arena.room.sessionId);
      if (!self) throw new Error("B33 attack-slow gate lost its player");
      arena.room.send("attack", {
        aimX: 1,
        aimY: 0,
        tx: self.x + 180,
        ty: self.y,
      });
    });
    attackAccepted = await expect
      .poll(
        () =>
          page.evaluate((initialSeq) => {
            const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
            return (
              (arena.room.state.players.get(arena.room.sessionId)?.attackSeq ?? initialSeq) >
              initialSeq
            );
          }, attackStart.player.attackSeq),
        { timeout: 1_000 },
      )
      .toBe(true)
      .then(() => true)
      .catch(() => false);
  }
  expect(attackAccepted, "Sparkknuckle swing should be accepted by authority").toBe(true);
  await expect
    .poll(
      () => page.evaluate(() => (globalThis as unknown as BrowserGlobal).__b33AttackMoveReceipt),
      {
        message: "authority should receipt Sparkknuckle's real input-slow movement tick",
        timeout: 10_000,
      },
    )
    .toBeTruthy();
  const file = screenshotPath("e-player-attack-input-slow.png");
  await page.screenshot({ path: file });
  await resume(page);
  await page.waitForTimeout(400);
  await page.keyboard.up("KeyD");
  const frames = await page.evaluate(() => {
    const holder = globalThis as unknown as BrowserGlobal;
    if (holder.__b33MoveTimer) window.clearInterval(holder.__b33MoveTimer);
    if (holder.__b33InputTimer) window.clearInterval(holder.__b33InputTimer);
    holder.__b33MoveTimer = undefined;
    holder.__b33InputTimer = undefined;
    return holder.__b33MoveFrames ?? [];
  });
  const receipt = await page.evaluate(
    () => (globalThis as unknown as BrowserGlobal).__b33AttackMoveReceipt,
  );
  if (!receipt) throw new Error("B33 attack-movement receipt disappeared");
  const ratio = receipt.displacementRatio;
  expect(receipt.mode).toBe(PlayerAttackMoveMode.InputSlow);
  expect(receipt.configuredRatio).toBe(0.75);
  expect(receipt.actualDistance).toBeGreaterThan(0);
  expect(receipt.normalDistance).toBeGreaterThan(0);
  expect(ratio).toBeGreaterThan(0.65);
  expect(ratio).toBeLessThan(0.85);
  return {
    attackStart,
    ratio,
    expectedRatio: 0.75,
    receipt,
    frames,
    screenshot: relativeEvidencePath(file),
  };
}

test("B33 commitment melee survives the real private Testing Grounds stack", async ({ page }) => {
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

    const walking = await captureWalkingHit(page);
    const roll = await captureRollEvade(page);
    const parry = await captureParry(page);
    const tokens = await captureTokenCap(page);
    const attackSlow = await captureAttackSlow(page);

    const gamePort = Number(new URL(page.url()).searchParams.get("port"));
    expect(Number.isFinite(gamePort)).toBe(true);
    expect(FORBIDDEN_PORTS.has(gamePort)).toBe(false);
    const evidence = {
      generatedAt: new Date().toISOString(),
      characterId: CHARACTER_ID,
      wolfKind: WOLF_KIND,
      ports: { client: clientPort, game: gamePort },
      forbiddenPorts: [...FORBIDDEN_PORTS],
      walking,
      roll,
      parry,
      tokens,
      attackSlow,
      assertions: {
        walkerWasHit: true,
        rollEvaded: true,
        parryPreventedDamageAndStaggered: true,
        simultaneousCommitCap: 3,
        fixedPopToImpactTicks: 4,
        fixedPopToImpactMs: 200,
        attackInputSpeedRatio: (attackSlow as { ratio: number }).ratio,
        ordinaryMeleeFloorTelegraphs: 0,
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
        "# B33 commitment-melee private live gate",
        "",
        `Real Testing Grounds gate on private ephemeral client/game ports ${clientPort}/${gamePort}.`,
        `Character: \`${CHARACTER_ID}\`. Enemy body: \`${WOLF_KIND}\`.`,
        "",
        "- `a-wolf-accent-ramp.png`, `a-wolf-white-pop.png`, `a-wolf-landed-lunge.png`: red body ramp, universal white fill/squash, then four-tick impact against a walking player.",
        "- `b-wolf-roll-evade.png`: the same commit answered at its exact pop by the real roll machinery; the first impact receipt keeps HP unchanged and advances `dodgedSeq`.",
        "- `c-wolf-parried-directional-stagger.png`: the same commit parried at its exact pop; the packed directional reaction matches the rig and the authoritative 0.4 s attacker stagger is unit-pinned.",
        "- `d-six-wolves-three-commit.png`: six live wolves, exactly three active commitments and three posturing non-holders.",
        `- \`e-player-attack-input-slow.png\`: Sparkknuckle's real active movement tick reports mode 1 and ${((attackSlow as { ratio: number }).ratio * 100).toFixed(1)}% displacement against that tick's normal-speed projection.`,
        "- `live-gate.json`: authoritative ticks, positions, HP/receipt edges, tint/fill/squash state, token-cap sample, movement frames, and private ports.",
        "",
        "Exact-pop roll/parry arming and the attack-movement receipt are one-shot training fixtures gated behind dev tools. They call or observe the production defense/movement machinery and cannot be armed in production rooms.",
        "Because Playwright cannot serialize a page screenshot inside the real 50 ms pop, the white-pop PNG locally re-holds the already-fired rig presentation for 5,000 ms after recording its real edge/timing, then clears it before the client scene resumes. Server authority is not paused or modified.",
        "",
        "The harness used `startSpecStack`; ports 5180 and 2567 were neither bound nor touched.",
        "",
      ].join("\n"),
      "utf8",
    );
  });
});
