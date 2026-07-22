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
const MAX_ADMISSION_MUZZLE_DELTA_PX = 2.5;
const MAX_PROJECTILE_PATH_ERROR_PX = 18;
const MAX_CHARACTER_AUTHORITY_DELTA_PX = 80;
const MAX_RIG_PREDICTOR_DELTA_PX = 12;
const EVIDENCE_PHASE = process.env.DD_V8_A1_EVIDENCE_PHASE ?? "gate";
const EVIDENCE_DIR = path.resolve(
  "docs/owner-notes-audit-v8-evidence/a1-overcasters",
  EVIDENCE_PHASE,
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
  fireHeld: boolean;
  sampling: boolean;
  ready: boolean;
  frames: BurstAnchorFrame[];
  rounds: BurstAnchorRound[];
  roundsById: Map<string, BurstAnchorRound>;
  existing: Set<string>;
}

declare global {
  // eslint-disable-next-line no-var
  var __ddBurstAnchorProbe: BrowserProbe | undefined;
}

test.use({ viewport: { width: 640, height: 360 } });

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
      const ownerId = arena.room.sessionId;
      const self = arena.room.state.players.get(ownerId);
      const rig = arena.blobs.get(ownerId);
      if (!self || !rig) throw new Error("moving burst gate requires the live owner rig");

      const existing = new Set<string>();
      arena.room.state.projectiles.forEach((row: { id?: string }, id: string) =>
        existing.add(String(row.id ?? id)),
      );
      const probe: BrowserProbe = {
        startedAt: performance.now(),
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
        const stage = stages[stageIndex] ?? stages.at(-1)!;
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
            predictorPendingOwnerImpulses:
              arena.predictor?.stats?.pendingOwnerImpulses ?? null,
            attackTick: player.attackTick >>> 0,
            renderAuthorityDeltaPx: Math.hypot(
              rendered.x - authority.x,
              rendered.y - authority.y,
            ),
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
              ((((arena.room.state.tick >>> 0) - (row.bornTick >>> 0)) >>> 0) + 1);
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
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
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

async function releaseFireAndMovement(page: Page): Promise<void> {
  for (const key of ["w", "a", "s", "d"] as const) await page.keyboard.up(key).catch(() => undefined);
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
      // of both wall time and scene time when a headless frame is contended.
      if (index > 0) elapsed += point.deltaSec;
      const expectedX = round.visibleSpawnOrigin.x + round.vx * elapsed;
      const expectedY = round.visibleSpawnOrigin.y + round.vy * elapsed;
      return Math.hypot(point.x - expectedX, point.y - expectedY);
    }),
  );
}

test("continuous moving Overcasters bursts keep character and projectile presentation coherent", async ({
  page,
}) => {
  test.setTimeout(150_000);
  await runArenaSpec(page, async (baseURL) => {
    await bootArena(page, baseURL, `weapon:${WEAPON_ID}`);
    await waitForDevWeapon(page, WEAPON_ID);
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
      const capture = await page.evaluate(() => {
        const probe = globalThis.__ddBurstAnchorProbe;
        return {
          startedAt: probe?.startedAt ?? 0,
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
      const summary = {
        capturedAt: new Date().toISOString(),
        phase: EVIDENCE_PHASE,
        thresholds: {
          maxAdmissionMuzzleDeltaPx: MAX_ADMISSION_MUZZLE_DELTA_PX,
          maxProjectilePathErrorPx: MAX_PROJECTILE_PATH_ERROR_PX,
          maxCharacterAuthorityDeltaPx: MAX_CHARACTER_AUTHORITY_DELTA_PX,
          maxRigPredictorDeltaPx: MAX_RIG_PREDICTOR_DELTA_PX,
        },
        continuousFireHeld: true,
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
        maxRigPredictorDeltaPx: Math.max(
          0,
          ...capture.frames.flatMap((frame) =>
            frame.rigPredictorDeltaPx === null ? [] : [frame.rigPredictorDeltaPx],
          ),
        ),
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
        path.join(EVIDENCE_DIR, "live-capture.json"),
        `${JSON.stringify(summary, null, 2)}\n`,
        "utf8",
      );

      console.log(
        `[v8-a1-${EVIDENCE_PHASE}] ${JSON.stringify({
          frames: summary.frameCount,
          rounds: summary.roundCount,
          bursts: summary.burstCount,
          maxAdmissionMuzzleDeltaPx: summary.maxAdmissionMuzzleDeltaPx,
          maxAuthorityMuzzleDeltaPx: summary.maxAuthorityMuzzleDeltaPx,
          maxProjectilePathErrorPx: summary.maxProjectilePathErrorPx,
          maxCharacterAuthorityDeltaPx: summary.maxCharacterAuthorityDeltaPx,
          maxRigPredictorDeltaPx: summary.maxRigPredictorDeltaPx,
        })}`,
      );

      expect(stageSet, "all direction stages, including hard reversals, must execute").toEqual(
        new Set(DIRECTION_STAGES.map((_stage, index) => index)),
      );
      for (const direction of ["-1,0", "0,-1", "0,1", "1,0"])
        expect(actualDirections.has(direction), `real keyboard input must include ${direction}`).toBe(
          true,
        );
      expect(capture.rounds.length, "many rounds must render across the held input").toBeGreaterThanOrEqual(
        REQUIRED_ROUNDS,
      );
      expect(burstStarts.length, "continuous fire must cross at least eight bursts").toBeGreaterThanOrEqual(
        REQUIRED_BURSTS,
      );
      expect(
        capture.rounds.filter((round) => round.track.length >= 2).length,
        "at least eight complete bursts must be observed beyond admission",
      ).toBeGreaterThanOrEqual(REQUIRED_ROUNDS);
      expect(summary.maxAdmissionMuzzleDeltaPx, "admission must begin on the rendered muzzle").toBeLessThanOrEqual(
        MAX_ADMISSION_MUZZLE_DELTA_PX,
      );
      expect(
        summary.maxProjectilePathErrorPx,
        "rounds must continue smoothly from that muzzle on following frames",
      ).toBeLessThanOrEqual(MAX_PROJECTILE_PATH_ERROR_PX);
      expect(
        summary.maxCharacterAuthorityDeltaPx,
        "rendered character must remain bounded to authoritative movement during recoil",
      ).toBeLessThanOrEqual(MAX_CHARACTER_AUTHORITY_DELTA_PX);
      expect(
        summary.maxRigPredictorDeltaPx,
        "the final rig must not reject/rotate the predictor's recoil movement",
      ).toBeLessThanOrEqual(MAX_RIG_PREDICTOR_DELTA_PX);
    } finally {
      await releaseFireAndMovement(page);
    }
  });
});
