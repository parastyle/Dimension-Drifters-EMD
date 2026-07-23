import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { bootArena, runArenaSpec, waitForDevWeapon } from "../helpers/arena-harness.js";

const WEAPON_ID = "x2-galvanic-overcasters";
const ROUNDS_PER_BURST = 4;
const REQUIRED_BURSTS = 8;
const REQUIRED_ROUNDS = REQUIRED_BURSTS * ROUNDS_PER_BURST;
const STAGE_MS = 900;
const MIN_CAPTURE_MS = STAGE_MS * 8;
const POST_FIRE_SAMPLE_MS = 1_500;
const MAX_ADMISSION_MUZZLE_DELTA_PX = 2.5;
const MAX_PROJECTILE_PATH_ERROR_PX = 18;
const MAX_CHARACTER_AUTHORITY_DELTA_PX = 80;
const MAX_RENDERED_RIG_STEP_PX = 80;
const MAX_RIG_PREDICTOR_DELTA_PX = 12;
const EVIDENCE_PROFILE = process.env.DD_B4_EVIDENCE_PROFILE ?? "low-latency";
const INDUCED_LATENCY_MS = Math.max(0, Number(process.env.DD_B4_INDUCED_LATENCY_MS) || 0);
const EVIDENCE_DIR = path.resolve(
  "docs/owner-notes-audit-v9-evidence/b4-overcasters",
  EVIDENCE_PROFILE,
);

const DIRECTION_STAGES = [
  { x: 1, y: 0, label: "right-1" },
  { x: 0, y: 1, label: "down-1" },
  { x: -1, y: 0, label: "left-1" },
  { x: 0, y: -1, label: "up-1" },
  { x: 1, y: 0, label: "right-2" },
  { x: -1, y: 0, label: "hard-reverse-left" },
  { x: 0, y: 1, label: "down-2" },
  { x: 0, y: -1, label: "hard-reverse-up" },
] as const;

interface Point {
  x: number;
  y: number;
}

interface BurstAnchorFrame {
  wallMs: number;
  phase: "during-fire" | "post-fire";
  fireHeld: boolean;
  tick: number;
  attackSeq: number;
  rigAttackSeq: number;
  stage: number;
  input: Point;
  authority: Point & { vx: number; vy: number; mvx: number; mvy: number };
  rendered: Point;
  renderedMuzzle: Point | null;
  predictorTarget: Point | null;
  predictorState: (Point & { vx: number; vy: number }) | null;
  predictorError: Point | null;
  predictorPendingOwnerImpulses: number | null;
  attackTick: number;
  renderAuthorityDeltaPx: number;
  rigPredictorDeltaPx: number | null;
}

interface ProjectileTrackPoint extends Point {
  wallMs: number;
  sceneNow: number;
  deltaSec: number;
  serverX: number;
  serverY: number;
}

interface BurstAnchorRound {
  id: string;
  bornTick: number;
  observedTick: number;
  attackSeq: number;
  rigAttackSeq: number;
  vx: number;
  vy: number;
  authorityOrigin: Point;
  visibleSpawnOrigin: Point;
  spriteMuzzleAtSpawn: Point;
  admissionDeltaPx: number;
  authorityMuzzleDeltaPx: number;
  track: ProjectileTrackPoint[];
}

interface BrowserProbe {
  startedAt: number;
  releasedAt: number | null;
  fireHeld: boolean;
  sampling: boolean;
  ready: boolean;
  frames: BurstAnchorFrame[];
  rounds: BurstAnchorRound[];
  roundsById: Map<string, BurstAnchorRound>;
  existing: Set<string>;
}

interface RemoteBurstFrame {
  wallMs: number;
  phase: "during-fire" | "post-fire";
  tick: number;
  attackSeq: number;
  rigAttackSeq: number;
  stage: number;
  input: Point;
  authority: Point & { vx: number; vy: number; mvx: number; mvy: number };
  rendered: Point;
  renderAuthorityDeltaPx: number;
}

interface RemoteBrowserProbe {
  actorId: string;
  startedAt: number;
  releasedAt: number | null;
  fireHeld: boolean;
  sampling: boolean;
  ready: boolean;
  stage: number;
  input: Point;
  frames: RemoteBurstFrame[];
  rounds: BurstAnchorRound[];
  roundsById: Map<string, BurstAnchorRound>;
  existing: Set<string>;
}

declare global {
  // eslint-disable-next-line no-var
  var __ddBurstAnchorProbe: BrowserProbe | undefined;
  // eslint-disable-next-line no-var
  var __ddRemoteBurstProbe: RemoteBrowserProbe | undefined;
}

test.use({ viewport: { width: 640, height: 360 } });

async function installInducedOwnerLatency(page: Page): Promise<void> {
  if (INDUCED_LATENCY_MS <= 0) return;
  await page.evaluate((latencyMs) => {
    const arena = (globalThis as any).ddGame.scene.getScene("arena");
    const room = arena.room;
    const send = room.send.bind(room);
    room.send = (type: string, payload?: unknown) => {
      if (type === "input" || type === "attack") {
        window.setTimeout(() => send(type, payload), latencyMs);
        return;
      }
      send(type, payload);
    };
  }, INDUCED_LATENCY_MS);
}

async function holdFireAcrossReversals(page: Page): Promise<void> {
  await page.locator("#game-root canvas").click({ position: { x: 320, y: 180 } });
  // Stay clear of the right-side weapon dock while holding a stable screen-space aim.
  await page.mouse.move(430, 180);
  await page.evaluate(
    ({ wanted, stages, stageMs, minCaptureMs, requiredRounds }) => {
      window.focus();
      window.dispatchEvent(new Event("focus"));
      const arena = (globalThis as any).ddGame.scene.getScene("arena");
      if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend?.(arena.time.now);
      arena.verbs?.releaseInputLatchIf?.(true);
      arena.game.hasFocus = true;
      arena.pointerOverInteractiveUi = false;
      if (!arena.game.loop.forceSetTimeOut) {
        arena.game.loop.sleep();
        arena.game.loop.forceSetTimeOut = true;
        arena.game.loop.wake(true);
      }
      const ownerId = arena.room.sessionId;
      const self = arena.room.state.players.get(ownerId);
      const rig = arena.blobs.get(ownerId);
      if (!self || !rig) throw new Error("moving burst gate requires the live owner rig");

      const existing = new Set<string>();
      arena.room.state.projectiles.forEach((row: { id?: string }, id: string) => {
        existing.add(String(row.id ?? id));
      });
      const probe: BrowserProbe = {
        startedAt: performance.now(),
        releasedAt: null,
        fireHeld: true,
        sampling: true,
        ready: false,
        frames: [],
        rounds: [],
        roundsById: new Map(),
        existing,
      };
      globalThis.__ddBurstAnchorProbe = probe;
      arena.input.activePointer.rightButtonDown = () => probe.fireHeld;

      const stageAt = (wallMs: number) =>
        Math.min(stages.length - 1, Math.floor((wallMs - probe.startedAt) / stageMs));
      const sample = () => {
        if (!probe.sampling) return;
        const wallMs = performance.now();
        const stageIndex = stageAt(wallMs);
        const player = arena.room.state.players.get(ownerId);
        const liveRig = arena.blobs.get(ownerId);
        if (player && liveRig) {
          const muzzle = { x: 0, y: 0 };
          const wroteMuzzle = liveRig.writeWeaponMuzzleForShot?.(
            liveRig.attackBeatSeq ?? player.attackSeq,
            0,
            muzzle,
          );
          // Read the exact candidate consumed by interpolate(). Re-running renderPos here occurs after
          // sendAttack() and can preview a newly-added recoil impulse that the rig correctly won't draw
          // until the next frame, manufacturing a one-frame discrepancy in the probe itself.
          const candidateX = Number(arena.selfPredictionCandidateX);
          const candidateY = Number(arena.selfPredictionCandidateY);
          const target =
            Number.isFinite(candidateX) && Number.isFinite(candidateY)
              ? { x: candidateX, y: candidateY }
              : null;
          const predictorState = arena.predictor?.pred;
          const rendered = { x: Number(liveRig.x), y: Number(liveRig.y) };
          const authority = {
            x: Number(player.x),
            y: Number(player.y),
            vx: Number(player.vx),
            vy: Number(player.vy),
            mvx: Number(player.mvx),
            mvy: Number(player.mvy),
          };
          probe.frames.push({
            wallMs,
            phase: probe.fireHeld ? "during-fire" : "post-fire",
            fireHeld: probe.fireHeld,
            tick: arena.room.state.tick >>> 0,
            attackSeq: player.attackSeq >>> 0,
            rigAttackSeq: (liveRig.attackBeatSeq ?? 0) >>> 0,
            stage: stageIndex,
            input: { x: Number(arena.curDx), y: Number(arena.curDy) },
            authority,
            rendered,
            renderedMuzzle: wroteMuzzle ? { ...muzzle } : null,
            predictorTarget: target ? { x: Number(target.x), y: Number(target.y) } : null,
            predictorState: predictorState
              ? {
                  x: Number(predictorState.x),
                  y: Number(predictorState.y),
                  vx: Number(predictorState.vx),
                  vy: Number(predictorState.vy),
                }
              : null,
            predictorError: arena.predictor
              ? { x: Number(arena.predictor.errX), y: Number(arena.predictor.errY) }
              : null,
            predictorPendingOwnerImpulses: arena.predictor?.stats?.pendingOwnerImpulses ?? null,
            attackTick: player.attackTick >>> 0,
            renderAuthorityDeltaPx: Math.hypot(rendered.x - authority.x, rendered.y - authority.y),
            rigPredictorDeltaPx: target
              ? Math.hypot(rendered.x - Number(target.x), rendered.y - Number(target.y))
              : null,
          });
        }

        arena.room.state.projectiles.forEach((row: any, key: string) => {
          const id = String(row.id ?? key);
          if (
            probe.existing.has(id) ||
            row.sourcePlayerId !== ownerId ||
            row.sourceWeaponId !== wanted
          )
            return;
          const rendered = arena.projectiles.get(id);
          if (!rendered) return;
          let round = probe.roundsById.get(id);
          if (!round) {
            const visibleSpawnOrigin = {
              x: Number(rendered.getData?.("spawnOriginX")),
              y: Number(rendered.getData?.("spawnOriginY")),
            };
            const spriteMuzzleAtSpawn = {
              x: Number(rendered.getData?.("spawnMuzzleX")),
              y: Number(rendered.getData?.("spawnMuzzleY")),
            };
            if (
              ![
                visibleSpawnOrigin.x,
                visibleSpawnOrigin.y,
                spriteMuzzleAtSpawn.x,
                spriteMuzzleAtSpawn.y,
              ].every(Number.isFinite)
            )
              return;
            const steps =
              row.flightAgeTicks ??
              (((arena.room.state.tick >>> 0) - (row.bornTick >>> 0)) >>> 0) + 1;
            const authorityOrigin = {
              x: Number(row.x) - Number(row.vx) * Number(steps) * 0.05,
              y: Number(row.y) - Number(row.vy) * Number(steps) * 0.05,
            };
            round = {
              id,
              bornTick: row.bornTick >>> 0,
              observedTick: arena.room.state.tick >>> 0,
              attackSeq: player?.attackSeq >>> 0,
              rigAttackSeq: (liveRig?.attackBeatSeq ?? 0) >>> 0,
              vx: Number(row.vx),
              vy: Number(row.vy),
              authorityOrigin,
              visibleSpawnOrigin,
              spriteMuzzleAtSpawn,
              admissionDeltaPx: Math.hypot(
                visibleSpawnOrigin.x - spriteMuzzleAtSpawn.x,
                visibleSpawnOrigin.y - spriteMuzzleAtSpawn.y,
              ),
              authorityMuzzleDeltaPx: Math.hypot(
                authorityOrigin.x - spriteMuzzleAtSpawn.x,
                authorityOrigin.y - spriteMuzzleAtSpawn.y,
              ),
              track: [],
            };
            probe.rounds.push(round);
            probe.roundsById.set(id, round);
          }
          const firstAt = round.track[0]?.wallMs ?? wallMs;
          if (wallMs - firstAt <= 350) {
            round.track.push({
              wallMs,
              sceneNow: Number(arena.time.now),
              deltaSec: Number(arena.deltaSec),
              x: Number(rendered.x),
              y: Number(rendered.y),
              serverX: Number(row.x),
              serverY: Number(row.y),
            });
          }
        });

        if (wallMs - probe.startedAt >= minCaptureMs && probe.rounds.length >= requiredRounds)
          probe.ready = true;
      };
      const moveProjectiles = arena.moveProjectiles.bind(arena);
      arena.moveProjectiles = (dtSec: number) => {
        moveProjectiles(dtSec);
        sample();
      };
    },
    {
      wanted: WEAPON_ID,
      stages: DIRECTION_STAGES,
      stageMs: STAGE_MS,
      minCaptureMs: MIN_CAPTURE_MS,
      requiredRounds: REQUIRED_ROUNDS,
    },
  );
}

async function driveDirectionStages(page: Page): Promise<void> {
  const keys = ["d", "s", "a", "w", "d", "a", "s", "w"] as const;
  for (const key of keys) {
    await page.keyboard.down(key);
    await page.waitForTimeout(STAGE_MS);
    await page.keyboard.up(key);
  }
}

async function releaseFireOnly(page: Page): Promise<void> {
  await page.evaluate(() => {
    const probe = globalThis.__ddBurstAnchorProbe;
    if (!probe) throw new Error("moving burst probe must exist before fire release");
    probe.fireHeld = false;
    probe.releasedAt = performance.now();
    const arena = (globalThis as any).ddGame.scene.getScene("arena");
    arena.input.activePointer.rightButtonDown = () => false;
  });
}

async function releaseFireAndMovement(page: Page): Promise<void> {
  for (const key of ["w", "a", "s", "d"] as const)
    await page.keyboard.up(key).catch(() => undefined);
  await page
    .evaluate(() => {
      const probe = globalThis.__ddBurstAnchorProbe;
      if (!probe) return;
      probe.fireHeld = false;
      probe.sampling = false;
      const arena = (globalThis as any).ddGame?.scene.getScene("arena");
      if (arena?.input?.activePointer) arena.input.activePointer.rightButtonDown = () => false;
      arena?.stepNetInput?.(50, false, false, 0, 0);
    })
    .catch(() => undefined);
}

function projectilePathError(round: BurstAnchorRound): number {
  const first = round.track[0];
  if (!first) return Number.POSITIVE_INFINITY;
  let elapsed = 0;
  return Math.max(
    0,
    ...round.track.map((point, index) => {
      // Grade on the exact delta consumed by moveProjectiles. Phaser may smooth that delta independently
      // of wall time when a headless frame is contended. A forced-timeout game loop can expose the same
      // scene frame to two browser animation callbacks, so count its consumed delta exactly once.
      const previous = round.track[index - 1];
      if (index > 0 && previous && point.sceneNow !== previous.sceneNow) elapsed += point.deltaSec;
      const expectedX = round.visibleSpawnOrigin.x + round.vx * elapsed;
      const expectedY = round.visibleSpawnOrigin.y + round.vy * elapsed;
      return Math.hypot(point.x - expectedX, point.y - expectedY);
    }),
  );
}

interface RigFrameStep {
  phase: BurstAnchorFrame["phase"];
  stepPx: number;
}

function renderedRigSteps(
  frames: Array<{ phase: BurstAnchorFrame["phase"]; rendered: Point }>,
): RigFrameStep[] {
  const steps: RigFrameStep[] = [];
  for (let index = 1; index < frames.length; index++) {
    const frame = frames[index];
    const previous = frames[index - 1];
    if (!frame || !previous) continue;
    steps.push({
      phase: frame.phase,
      stepPx: Math.hypot(
        frame.rendered.x - previous.rendered.x,
        frame.rendered.y - previous.rendered.y,
      ),
    });
  }
  return steps;
}

function sequenceRegressions<T extends { attackSeq: number; rigAttackSeq: number }>(
  frames: T[],
  key: "attackSeq" | "rigAttackSeq",
): number {
  let regressions = 0;
  for (let index = 1; index < frames.length; index++) {
    const frame = frames[index];
    const previous = frames[index - 1];
    if (frame && previous && frame[key] < previous[key]) regressions++;
  }
  return regressions;
}

interface RawRemotePlayer {
  x: number;
  y: number;
  ackSeq: number;
  weapon: string;
}

interface RawRemoteRoom {
  sessionId: string;
  state?: { players?: { get(id: string): RawRemotePlayer | undefined } };
  send(type: string, payload?: unknown): void;
  leave(): Promise<unknown>;
}

interface RawRemoteControl {
  setDirection(dx: number, dy: number): void;
  releaseFire(): void;
  stop(): void;
}

async function connectRawRemote(page: Page): Promise<RawRemoteRoom> {
  const connection = await page.evaluate(() => {
    const arena = (globalThis as any).ddGame.scene.getScene("arena");
    return { roomId: String(arena.room.roomId), url: location.href };
  });
  const gamePort = Number(new URL(connection.url).searchParams.get("port"));
  if (!connection.roomId || !Number.isFinite(gamePort) || gamePort <= 0)
    throw new Error("private room/port missing for remote Overcasters actor");
  const { Client } = await import(
    "../../packages/client/node_modules/colyseus.js/build/esm/index.mjs"
  );
  return (await new Client(`ws://127.0.0.1:${gamePort}`).joinById(
    connection.roomId,
  )) as unknown as RawRemoteRoom;
}

async function equipRawRemote(page: Page, room: RawRemoteRoom): Promise<void> {
  room.send("devEquip", { weapon: WEAPON_ID });
  await expect
    .poll(() => room.state?.players?.get(room.sessionId)?.weapon ?? null, {
      message: "remote authority should equip Galvanic Overcasters",
    })
    .toBe(WEAPON_ID);
  await expect
    .poll(
      () =>
        page.evaluate(
          (actorId) =>
            (globalThis as any).ddGame.scene.getScene("arena").blobs.get(actorId)?.weaponDef?.id ??
            null,
          room.sessionId,
        ),
      { message: "observer should render the remote Overcasters rig" },
    )
    .toBe(WEAPON_ID);
}

function startRawRemoteControl(room: RawRemoteRoom): RawRemoteControl {
  let dx = 1;
  let dy = 0;
  let fireHeld = true;
  let seq = Number(room.state?.players?.get(room.sessionId)?.ackSeq ?? 0) >>> 0;
  const delayedTimers = new Set<ReturnType<typeof setTimeout>>();
  const dispatch = (type: string, payload: unknown): void => {
    if (INDUCED_LATENCY_MS <= 0) {
      room.send(type, payload);
      return;
    }
    const timer = setTimeout(() => {
      delayedTimers.delete(timer);
      room.send(type, payload);
    }, INDUCED_LATENCY_MS);
    delayedTimers.add(timer);
  };
  const target = () => {
    const player = room.state?.players?.get(room.sessionId);
    return {
      aimX: 1,
      aimY: 0,
      tx: (player?.x ?? 0) + 500,
      ty: player?.y ?? 0,
    };
  };
  const sendInput = (): void => {
    seq = (seq + 1) >>> 0;
    const aim = target();
    dispatch("input", {
      seq,
      dx,
      dy,
      jump: false,
      crouchHeld: false,
      pound: false,
      slide: false,
      slideHeld: false,
      fireHeld,
      aimX: aim.aimX,
      aimY: aim.aimY,
      targetX: aim.tx,
      targetY: aim.ty,
    });
  };
  const sendAttack = (): void => {
    if (fireHeld) dispatch("attack", target());
  };
  sendInput();
  sendAttack();
  const inputTimer = setInterval(sendInput, 50);
  const attackTimer = setInterval(sendAttack, 80);
  return {
    setDirection(nextX, nextY) {
      dx = nextX;
      dy = nextY;
    },
    releaseFire() {
      fireHeld = false;
      sendInput();
    },
    stop() {
      clearInterval(inputTimer);
      clearInterval(attackTimer);
      for (const timer of delayedTimers) clearTimeout(timer);
      delayedTimers.clear();
      room.send("input", {
        seq: (seq + 1) >>> 0,
        dx: 0,
        dy: 0,
        jump: false,
        crouchHeld: false,
        pound: false,
        slide: false,
        slideHeld: false,
        fireHeld: false,
        aimX: 1,
        aimY: 0,
      });
    },
  };
}

async function mountRemoteProbe(page: Page, actorId: string): Promise<void> {
  await page.evaluate(
    ({ actorId: wantedActor, wantedWeapon, minCaptureMs, requiredRounds }) => {
      const arena = (globalThis as any).ddGame.scene.getScene("arena");
      if (!arena.game.loop.forceSetTimeOut) {
        arena.game.loop.sleep();
        arena.game.loop.forceSetTimeOut = true;
        arena.game.loop.wake(true);
      }
      const existing = new Set<string>();
      arena.room.state.projectiles.forEach((row: { id?: string }, id: string) => {
        existing.add(String(row.id ?? id));
      });
      const probe: RemoteBrowserProbe = {
        actorId: wantedActor,
        startedAt: performance.now(),
        releasedAt: null,
        fireHeld: true,
        sampling: true,
        ready: false,
        stage: 0,
        input: { x: 1, y: 0 },
        frames: [],
        rounds: [],
        roundsById: new Map(),
        existing,
      };
      globalThis.__ddRemoteBurstProbe = probe;

      const sample = () => {
        if (!probe.sampling) return;
        const wallMs = performance.now();
        const player = arena.room.state.players.get(wantedActor);
        const rig = arena.blobs.get(wantedActor);
        if (player && rig) {
          const authority = {
            x: Number(player.x),
            y: Number(player.y),
            vx: Number(player.vx),
            vy: Number(player.vy),
            mvx: Number(player.mvx),
            mvy: Number(player.mvy),
          };
          const rendered = { x: Number(rig.x), y: Number(rig.y) };
          probe.frames.push({
            wallMs,
            phase: probe.fireHeld ? "during-fire" : "post-fire",
            tick: arena.room.state.tick >>> 0,
            attackSeq: player.attackSeq >>> 0,
            rigAttackSeq: (rig.attackBeatSeq ?? 0) >>> 0,
            stage: probe.stage,
            input: { ...probe.input },
            authority,
            rendered,
            renderAuthorityDeltaPx: Math.hypot(rendered.x - authority.x, rendered.y - authority.y),
          });
        }

        arena.room.state.projectiles.forEach((row: any, key: string) => {
          const id = String(row.id ?? key);
          if (
            probe.existing.has(id) ||
            row.sourcePlayerId !== wantedActor ||
            row.sourceWeaponId !== wantedWeapon
          )
            return;
          const rendered = arena.projectiles.get(id);
          if (!rendered || !player || !rig) return;
          let round = probe.roundsById.get(id);
          if (!round) {
            const visibleSpawnOrigin = {
              x: Number(rendered.getData?.("spawnOriginX")),
              y: Number(rendered.getData?.("spawnOriginY")),
            };
            const spriteMuzzleAtSpawn = {
              x: Number(rendered.getData?.("spawnMuzzleX")),
              y: Number(rendered.getData?.("spawnMuzzleY")),
            };
            if (
              ![
                visibleSpawnOrigin.x,
                visibleSpawnOrigin.y,
                spriteMuzzleAtSpawn.x,
                spriteMuzzleAtSpawn.y,
              ].every(Number.isFinite)
            )
              return;
            const steps =
              row.flightAgeTicks ??
              (((arena.room.state.tick >>> 0) - (row.bornTick >>> 0)) >>> 0) + 1;
            const authorityOrigin = {
              x: Number(row.x) - Number(row.vx) * Number(steps) * 0.05,
              y: Number(row.y) - Number(row.vy) * Number(steps) * 0.05,
            };
            round = {
              id,
              bornTick: row.bornTick >>> 0,
              observedTick: arena.room.state.tick >>> 0,
              attackSeq: player.attackSeq >>> 0,
              rigAttackSeq: (rig.attackBeatSeq ?? 0) >>> 0,
              vx: Number(row.vx),
              vy: Number(row.vy),
              authorityOrigin,
              visibleSpawnOrigin,
              spriteMuzzleAtSpawn,
              admissionDeltaPx: Math.hypot(
                visibleSpawnOrigin.x - spriteMuzzleAtSpawn.x,
                visibleSpawnOrigin.y - spriteMuzzleAtSpawn.y,
              ),
              authorityMuzzleDeltaPx: Math.hypot(
                authorityOrigin.x - spriteMuzzleAtSpawn.x,
                authorityOrigin.y - spriteMuzzleAtSpawn.y,
              ),
              track: [],
            };
            probe.rounds.push(round);
            probe.roundsById.set(id, round);
          }
          const firstAt = round.track[0]?.wallMs ?? wallMs;
          if (wallMs - firstAt <= 350) {
            round.track.push({
              wallMs,
              sceneNow: Number(arena.time.now),
              deltaSec: Number(arena.deltaSec),
              x: Number(rendered.x),
              y: Number(rendered.y),
              serverX: Number(row.x),
              serverY: Number(row.y),
            });
          }
        });

        if (wallMs - probe.startedAt >= minCaptureMs && probe.rounds.length >= requiredRounds)
          probe.ready = true;
      };
      const moveProjectiles = arena.moveProjectiles.bind(arena);
      arena.moveProjectiles = (dtSec: number) => {
        moveProjectiles(dtSec);
        sample();
      };
    },
    {
      actorId,
      wantedWeapon: WEAPON_ID,
      minCaptureMs: MIN_CAPTURE_MS,
      requiredRounds: REQUIRED_ROUNDS,
    },
  );
}

async function driveRemoteDirectionStages(page: Page, control: RawRemoteControl): Promise<void> {
  const directions = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
    { x: -1, y: 0 },
  ] as const;
  for (let stage = 0; stage < directions.length; stage++) {
    const direction = directions[stage]!;
    control.setDirection(direction.x, direction.y);
    await page.evaluate(
      ({ stage: nextStage, input }) => {
        const probe = globalThis.__ddRemoteBurstProbe;
        if (!probe) throw new Error("remote Overcasters probe is missing");
        probe.stage = nextStage;
        probe.input = input;
      },
      { stage, input: direction },
    );
    await page.waitForTimeout(STAGE_MS);
  }
}

test("continuous moving Overcasters bursts keep character and projectile presentation coherent", async ({
  page,
}) => {
  test.setTimeout(150_000);
  await runArenaSpec(page, async (baseURL) => {
    await bootArena(page, baseURL, `weapon:${WEAPON_ID}`);
    await waitForDevWeapon(page, WEAPON_ID);
    await installInducedOwnerLatency(page);
    try {
      await holdFireAcrossReversals(page);
      await driveDirectionStages(page);
      await expect
        .poll(() => page.evaluate(() => globalThis.__ddBurstAnchorProbe?.ready === true), {
          message: "eight continuous bursts plus every direction stage should render",
          timeout: 45_000,
        })
        .toBe(true);
      // Keep sampling after the last required round so its real next-frame trajectory is graded.
      await page.waitForTimeout(420);
      // Release only fire, then keep a real strafe input active through the recovery window. This is the
      // state in which the reverted impulse-receipt implementation visibly oscillated after shooting.
      await page.keyboard.down("d");
      await releaseFireOnly(page);
      await page.waitForTimeout(POST_FIRE_SAMPLE_MS);
      await page.keyboard.up("d");
      await page.waitForTimeout(100);
      const capture = await page.evaluate(() => {
        const probe = globalThis.__ddBurstAnchorProbe;
        return {
          startedAt: probe?.startedAt ?? 0,
          releasedAt: probe?.releasedAt ?? null,
          frames: probe?.frames ?? [],
          rounds: probe?.rounds ?? [],
        };
      });
      await releaseFireAndMovement(page);

      const bornTicks = [...new Set(capture.rounds.map((round) => round.bornTick))].sort(
        (a, b) => a - b,
      );
      const burstStarts = bornTicks.filter((tick, index) => {
        const previous = bornTicks[index - 1];
        return index === 0 || (previous !== undefined && tick - previous > 1);
      });
      const stageSet = new Set(capture.frames.map((frame) => frame.stage));
      const actualDirections = new Set(
        capture.frames.map((frame) => `${frame.input.x},${frame.input.y}`),
      );
      const pathErrors = capture.rounds.map(projectilePathError);
      const rigSteps = renderedRigSteps(capture.frames);
      const duringFrames = capture.frames.filter((frame) => frame.phase === "during-fire");
      const postFrames = capture.frames.filter((frame) => frame.phase === "post-fire");
      const duringRigSteps = rigSteps.filter((step) => step.phase === "during-fire");
      const postRigSteps = rigSteps.filter((step) => step.phase === "post-fire");
      const finalFrame = capture.frames.at(-1);
      const summary = {
        capturedAt: new Date().toISOString(),
        profile: EVIDENCE_PROFILE,
        inducedLatencyMs: INDUCED_LATENCY_MS,
        thresholds: {
          maxAdmissionMuzzleDeltaPx: MAX_ADMISSION_MUZZLE_DELTA_PX,
          maxProjectilePathErrorPx: MAX_PROJECTILE_PATH_ERROR_PX,
          maxCharacterAuthorityDeltaPx: MAX_CHARACTER_AUTHORITY_DELTA_PX,
          maxRenderedRigStepPx: MAX_RENDERED_RIG_STEP_PX,
          maxRigPredictorDeltaPx: MAX_RIG_PREDICTOR_DELTA_PX,
          postFireSampleMs: POST_FIRE_SAMPLE_MS,
        },
        continuousFireHeldUntil: capture.releasedAt,
        directionStages: DIRECTION_STAGES,
        frameCount: capture.frames.length,
        roundCount: capture.rounds.length,
        burstCount: burstStarts.length,
        visitedStages: [...stageSet].sort((a, b) => a - b),
        actualDirections: [...actualDirections].sort(),
        maxAdmissionMuzzleDeltaPx: Math.max(
          0,
          ...capture.rounds.map((round) => round.admissionDeltaPx),
        ),
        maxAuthorityMuzzleDeltaPx: Math.max(
          0,
          ...capture.rounds.map((round) => round.authorityMuzzleDeltaPx),
        ),
        maxProjectilePathErrorPx: Math.max(0, ...pathErrors),
        maxCharacterAuthorityDeltaPx: Math.max(
          0,
          ...capture.frames.map((frame) => frame.renderAuthorityDeltaPx),
        ),
        maxDuringFireCharacterAuthorityDeltaPx: Math.max(
          0,
          ...duringFrames.map((frame) => frame.renderAuthorityDeltaPx),
        ),
        maxPostFireCharacterAuthorityDeltaPx: Math.max(
          0,
          ...postFrames.map((frame) => frame.renderAuthorityDeltaPx),
        ),
        maxRenderedRigStepPx: Math.max(0, ...rigSteps.map((step) => step.stepPx)),
        maxDuringFireRenderedRigStepPx: Math.max(0, ...duringRigSteps.map((step) => step.stepPx)),
        maxPostFireRenderedRigStepPx: Math.max(0, ...postRigSteps.map((step) => step.stepPx)),
        maxRigPredictorDeltaPx: Math.max(
          0,
          ...capture.frames.flatMap((frame) =>
            frame.rigPredictorDeltaPx === null ? [] : [frame.rigPredictorDeltaPx],
          ),
        ),
        authorityAttackSeqRegressions: sequenceRegressions(capture.frames, "attackSeq"),
        rigAttackSeqRegressions: sequenceRegressions(capture.frames, "rigAttackSeq"),
        maxRigAttackSeqLead: Math.max(
          0,
          ...capture.frames.map((frame) => frame.rigAttackSeq - frame.attackSeq),
        ),
        finalAuthorityAttackSeq: finalFrame?.attackSeq ?? 0,
        finalRigAttackSeq: finalFrame?.rigAttackSeq ?? 0,
        frames: capture.frames,
        rounds: capture.rounds.map((round, index) => ({
          ...round,
          roundIndex: index,
          burstOrdinal: Math.floor(index / ROUNDS_PER_BURST) + 1,
          roundOrdinal: (index % ROUNDS_PER_BURST) + 1,
          pathErrorPx: pathErrors[index],
        })),
      };
      await mkdir(EVIDENCE_DIR, { recursive: true });
      await writeFile(
        path.join(EVIDENCE_DIR, "local-live-capture.json"),
        `${JSON.stringify(summary, null, 2)}\n`,
        "utf8",
      );

      console.log(
        `[b4-local-${EVIDENCE_PROFILE}] ${JSON.stringify({
          frames: summary.frameCount,
          rounds: summary.roundCount,
          bursts: summary.burstCount,
          maxAdmissionMuzzleDeltaPx: summary.maxAdmissionMuzzleDeltaPx,
          maxAuthorityMuzzleDeltaPx: summary.maxAuthorityMuzzleDeltaPx,
          maxProjectilePathErrorPx: summary.maxProjectilePathErrorPx,
          maxCharacterAuthorityDeltaPx: summary.maxCharacterAuthorityDeltaPx,
          maxDuringFireRenderedRigStepPx: summary.maxDuringFireRenderedRigStepPx,
          maxPostFireRenderedRigStepPx: summary.maxPostFireRenderedRigStepPx,
          maxPostFireCharacterAuthorityDeltaPx: summary.maxPostFireCharacterAuthorityDeltaPx,
          maxRigPredictorDeltaPx: summary.maxRigPredictorDeltaPx,
          finalAuthorityAttackSeq: summary.finalAuthorityAttackSeq,
          finalRigAttackSeq: summary.finalRigAttackSeq,
        })}`,
      );

      expect(stageSet, "all direction stages, including hard reversals, must execute").toEqual(
        new Set(DIRECTION_STAGES.map((_stage, index) => index)),
      );
      for (const direction of ["-1,0", "0,-1", "0,1", "1,0"])
        expect(
          actualDirections.has(direction),
          `real keyboard input must include ${direction}`,
        ).toBe(true);
      expect(
        capture.rounds.length,
        "many rounds must render across the held input",
      ).toBeGreaterThanOrEqual(REQUIRED_ROUNDS);
      expect(
        burstStarts.length,
        "continuous fire must cross at least eight bursts",
      ).toBeGreaterThanOrEqual(REQUIRED_BURSTS);
      expect(
        capture.rounds.filter((round) => round.track.length >= 2).length,
        "at least eight complete bursts must be observed beyond admission",
      ).toBeGreaterThanOrEqual(REQUIRED_ROUNDS);
      expect(
        summary.maxAdmissionMuzzleDeltaPx,
        "admission must begin on the rendered muzzle",
      ).toBeLessThanOrEqual(MAX_ADMISSION_MUZZLE_DELTA_PX);
      expect(
        summary.maxProjectilePathErrorPx,
        "rounds must continue smoothly from that muzzle on following frames",
      ).toBeLessThanOrEqual(MAX_PROJECTILE_PATH_ERROR_PX);
      expect(
        summary.maxCharacterAuthorityDeltaPx,
        "rendered character must remain bounded to authority across fire and recovery",
      ).toBeLessThanOrEqual(MAX_CHARACTER_AUTHORITY_DELTA_PX);
      expect(duringFrames.length, "the gate must retain a during-fire rig window").toBeGreaterThan(
        0,
      );
      expect(postFrames.length, "the gate must retain a post-fire rig window").toBeGreaterThan(0);
      expect(
        (postFrames.at(-1)?.wallMs ?? 0) - (postFrames[0]?.wallMs ?? Number.POSITIVE_INFINITY),
        "post-fire recovery must remain under observation while strafing",
      ).toBeGreaterThanOrEqual(POST_FIRE_SAMPLE_MS * 0.8);
      expect(
        summary.maxDuringFireRenderedRigStepPx,
        "the rendered rig must not vibrate between frames during continuous fire",
      ).toBeLessThanOrEqual(MAX_RENDERED_RIG_STEP_PX);
      expect(
        summary.maxPostFireRenderedRigStepPx,
        "the rendered rig must not vibrate between frames after fire is released",
      ).toBeLessThanOrEqual(MAX_RENDERED_RIG_STEP_PX);
      expect(
        summary.maxPostFireCharacterAuthorityDeltaPx,
        "post-fire rendered rig recovery must stay bounded to authority",
      ).toBeLessThanOrEqual(MAX_CHARACTER_AUTHORITY_DELTA_PX);
      expect(
        summary.maxRigPredictorDeltaPx,
        "the final rig must not reject/rotate the predictor's recoil movement",
      ).toBeLessThanOrEqual(MAX_RIG_PREDICTOR_DELTA_PX);
      expect(summary.authorityAttackSeqRegressions, "authority attackSeq must be monotonic").toBe(
        0,
      );
      expect(summary.rigAttackSeqRegressions, "rig attack sequence must be monotonic").toBe(0);
      expect(
        summary.maxRigAttackSeqLead,
        "predicted rig sequence may lead authority by at most one",
      ).toBeLessThanOrEqual(1);
      expect(
        summary.finalRigAttackSeq,
        "authority must confirm the final predicted rig attack sequence",
      ).toBe(summary.finalAuthorityAttackSeq);
    } finally {
      await releaseFireAndMovement(page);
    }
  });
});

test("remote Overcasters rigs stay authority-bounded through sustained bidirectional bursts", async ({
  page,
}) => {
  test.setTimeout(150_000);
  await runArenaSpec(page, async (baseURL) => {
    await bootArena(page, baseURL, `weapon:${WEAPON_ID}`);
    await waitForDevWeapon(page, WEAPON_ID);
    const remote = await connectRawRemote(page);
    let control: RawRemoteControl | undefined;
    try {
      await equipRawRemote(page, remote);
      await mountRemoteProbe(page, remote.sessionId);
      control = startRawRemoteControl(remote);
      await driveRemoteDirectionStages(page, control);
      await expect
        .poll(() => page.evaluate(() => globalThis.__ddRemoteBurstProbe?.ready === true), {
          message: "remote actor should render eight sustained bursts across both walk directions",
          timeout: 45_000,
        })
        .toBe(true);
      await page.waitForTimeout(420);
      control.setDirection(1, 0);
      control.releaseFire();
      await page.evaluate(() => {
        const probe = globalThis.__ddRemoteBurstProbe;
        if (!probe) throw new Error("remote Overcasters probe is missing at release");
        probe.fireHeld = false;
        probe.releasedAt = performance.now();
        probe.input = { x: 1, y: 0 };
      });
      await page.waitForTimeout(POST_FIRE_SAMPLE_MS);
      const capture = await page.evaluate(() => {
        const probe = globalThis.__ddRemoteBurstProbe;
        if (probe) probe.sampling = false;
        return {
          actorId: probe?.actorId ?? "",
          startedAt: probe?.startedAt ?? 0,
          releasedAt: probe?.releasedAt ?? null,
          frames: probe?.frames ?? [],
          rounds: probe?.rounds ?? [],
        };
      });

      const bornTicks = [...new Set(capture.rounds.map((round) => round.bornTick))].sort(
        (a, b) => a - b,
      );
      const burstStarts = bornTicks.filter((tick, index) => {
        const previous = bornTicks[index - 1];
        return index === 0 || (previous !== undefined && tick - previous > 1);
      });
      const pathErrors = capture.rounds.map(projectilePathError);
      const rigSteps = renderedRigSteps(capture.frames);
      const duringFrames = capture.frames.filter((frame) => frame.phase === "during-fire");
      const postFrames = capture.frames.filter((frame) => frame.phase === "post-fire");
      const duringSteps = rigSteps.filter((step) => step.phase === "during-fire");
      const postSteps = rigSteps.filter((step) => step.phase === "post-fire");
      const finalFrame = capture.frames.at(-1);
      const summary = {
        capturedAt: new Date().toISOString(),
        profile: EVIDENCE_PROFILE,
        inducedLatencyMs: INDUCED_LATENCY_MS,
        actor: "remote",
        actorId: capture.actorId,
        thresholds: {
          maxAdmissionMuzzleDeltaPx: MAX_ADMISSION_MUZZLE_DELTA_PX,
          maxProjectilePathErrorPx: MAX_PROJECTILE_PATH_ERROR_PX,
          maxCharacterAuthorityDeltaPx: MAX_CHARACTER_AUTHORITY_DELTA_PX,
          maxRenderedRigStepPx: MAX_RENDERED_RIG_STEP_PX,
          postFireSampleMs: POST_FIRE_SAMPLE_MS,
        },
        frameCount: capture.frames.length,
        roundCount: capture.rounds.length,
        burstCount: burstStarts.length,
        visitedStages: [...new Set(capture.frames.map((frame) => frame.stage))].sort(
          (a, b) => a - b,
        ),
        maxAdmissionMuzzleDeltaPx: Math.max(
          0,
          ...capture.rounds.map((round) => round.admissionDeltaPx),
        ),
        maxAuthorityMuzzleDeltaPx: Math.max(
          0,
          ...capture.rounds.map((round) => round.authorityMuzzleDeltaPx),
        ),
        maxProjectilePathErrorPx: Math.max(0, ...pathErrors),
        maxCharacterAuthorityDeltaPx: Math.max(
          0,
          ...capture.frames.map((frame) => frame.renderAuthorityDeltaPx),
        ),
        maxDuringFireRenderedRigStepPx: Math.max(0, ...duringSteps.map((step) => step.stepPx)),
        maxPostFireRenderedRigStepPx: Math.max(0, ...postSteps.map((step) => step.stepPx)),
        maxPostFireCharacterAuthorityDeltaPx: Math.max(
          0,
          ...postFrames.map((frame) => frame.renderAuthorityDeltaPx),
        ),
        authorityAttackSeqRegressions: sequenceRegressions(capture.frames, "attackSeq"),
        rigAttackSeqRegressions: sequenceRegressions(capture.frames, "rigAttackSeq"),
        maxRigAttackSeqLead: Math.max(
          0,
          ...capture.frames.map((frame) => frame.rigAttackSeq - frame.attackSeq),
        ),
        finalAuthorityAttackSeq: finalFrame?.attackSeq ?? 0,
        finalRigAttackSeq: finalFrame?.rigAttackSeq ?? 0,
        frames: capture.frames,
        rounds: capture.rounds.map((round, index) => ({
          ...round,
          roundIndex: index,
          burstOrdinal: Math.floor(index / ROUNDS_PER_BURST) + 1,
          roundOrdinal: (index % ROUNDS_PER_BURST) + 1,
          pathErrorPx: pathErrors[index],
        })),
      };
      await mkdir(EVIDENCE_DIR, { recursive: true });
      await writeFile(
        path.join(EVIDENCE_DIR, "remote-live-capture.json"),
        `${JSON.stringify(summary, null, 2)}\n`,
        "utf8",
      );

      console.log(
        `[b4-remote-${EVIDENCE_PROFILE}] ${JSON.stringify({
          frames: summary.frameCount,
          rounds: summary.roundCount,
          bursts: summary.burstCount,
          maxAdmissionMuzzleDeltaPx: summary.maxAdmissionMuzzleDeltaPx,
          maxProjectilePathErrorPx: summary.maxProjectilePathErrorPx,
          maxCharacterAuthorityDeltaPx: summary.maxCharacterAuthorityDeltaPx,
          maxDuringFireRenderedRigStepPx: summary.maxDuringFireRenderedRigStepPx,
          maxPostFireRenderedRigStepPx: summary.maxPostFireRenderedRigStepPx,
          maxPostFireCharacterAuthorityDeltaPx: summary.maxPostFireCharacterAuthorityDeltaPx,
          finalAuthorityAttackSeq: summary.finalAuthorityAttackSeq,
          finalRigAttackSeq: summary.finalRigAttackSeq,
        })}`,
      );

      expect(summary.visitedStages).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
      expect(
        capture.frames.some((frame) => frame.authority.mvx > 50),
        "remote authority must walk right during the burst sequence",
      ).toBe(true);
      expect(
        capture.frames.some((frame) => frame.authority.mvx < -50),
        "remote authority must walk left during the burst sequence",
      ).toBe(true);
      expect(capture.rounds.length).toBeGreaterThanOrEqual(REQUIRED_ROUNDS);
      expect(burstStarts.length).toBeGreaterThanOrEqual(REQUIRED_BURSTS);
      expect(
        capture.rounds.filter((round) => round.track.length >= 2).length,
      ).toBeGreaterThanOrEqual(REQUIRED_ROUNDS);
      expect(summary.maxAdmissionMuzzleDeltaPx).toBeLessThanOrEqual(MAX_ADMISSION_MUZZLE_DELTA_PX);
      expect(summary.maxProjectilePathErrorPx).toBeLessThanOrEqual(MAX_PROJECTILE_PATH_ERROR_PX);
      expect(summary.maxCharacterAuthorityDeltaPx).toBeLessThanOrEqual(
        MAX_CHARACTER_AUTHORITY_DELTA_PX,
      );
      expect(duringFrames.length).toBeGreaterThan(0);
      expect(postFrames.length).toBeGreaterThan(0);
      expect(
        (postFrames.at(-1)?.wallMs ?? 0) - (postFrames[0]?.wallMs ?? Number.POSITIVE_INFINITY),
      ).toBeGreaterThanOrEqual(POST_FIRE_SAMPLE_MS * 0.8);
      expect(summary.maxDuringFireRenderedRigStepPx).toBeLessThanOrEqual(MAX_RENDERED_RIG_STEP_PX);
      expect(summary.maxPostFireRenderedRigStepPx).toBeLessThanOrEqual(MAX_RENDERED_RIG_STEP_PX);
      expect(summary.maxPostFireCharacterAuthorityDeltaPx).toBeLessThanOrEqual(
        MAX_CHARACTER_AUTHORITY_DELTA_PX,
      );
      expect(summary.authorityAttackSeqRegressions).toBe(0);
      expect(summary.rigAttackSeqRegressions).toBe(0);
      expect(summary.maxRigAttackSeqLead).toBeLessThanOrEqual(1);
      expect(summary.finalRigAttackSeq).toBe(summary.finalAuthorityAttackSeq);
    } finally {
      control?.stop();
      await page
        .evaluate(() => {
          const probe = globalThis.__ddRemoteBurstProbe;
          if (probe) probe.sampling = false;
        })
        .catch(() => undefined);
      await remote.leave().catch(() => undefined);
    }
  });
});
