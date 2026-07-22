import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import {
  bootArena,
  runArenaSpec,
  waitForDevWeapon,
} from "../../../e2e/helpers/arena-harness.js";

const WEAPON_ID = "x2-galvanic-overcasters";
const EVIDENCE_DIR = import.meta.dirname;
const DIRECTION_STAGES = [
  { dx: 1, dy: 0, durationMs: 900, label: "right-1" },
  { dx: 0, dy: 1, durationMs: 900, label: "down-1" },
  { dx: -1, dy: 0, durationMs: 900, label: "left-1" },
  { dx: 0, dy: -1, durationMs: 900, label: "up-1" },
  { dx: 1, dy: 0, durationMs: 900, label: "right-2" },
  { dx: -1, dy: 0, durationMs: 900, label: "hard-reverse-left" },
  { dx: 0, dy: 1, durationMs: 900, label: "down-2" },
  { dx: 0, dy: -1, durationMs: 900, label: "hard-reverse-up" },
] as const;

interface Point {
  x: number;
  y: number;
}

interface FrameRow {
  wallMs: number;
  sceneNow: number;
  tick: number;
  attackSeq: number;
  rigAttackSeq: number;
  input: Point;
  authority: Point & { vx: number | null; vy: number | null; ackSeq: number | null };
  rendered: Point;
  renderedMuzzle: Point | null;
}

interface RoundRow {
  id: string;
  wallMs: number;
  observedTick: number;
  bornTick: number;
  attackSeq: number;
  rigAttackSeq: number;
  playerAuthority: Point;
  renderedPlayer: Point;
  authorityOrigin: Point;
  visibleSpawnOrigin: Point;
  spriteMuzzleAtSpawn: Point;
  currentRenderedMuzzle: Point | null;
  spawnToRenderedMuzzlePx: number;
  authorityToRenderedMuzzlePx: number | null;
}

test("before fix: continuously held Overcasters fire across bursts while direction changes", async ({
  page,
}) => {
  await runArenaSpec(page, async (baseURL) => {
    await mkdir(EVIDENCE_DIR, { recursive: true });
    await bootArena(page, baseURL, `weapon:${WEAPON_ID}`);
    await waitForDevWeapon(page, WEAPON_ID);
    const canvas = page.locator("#game-root canvas");
    await canvas.click({ position: { x: 320, y: 180 } });
    await page.mouse.move(430, 180);
    await page.waitForTimeout(500);

    const runtimeShape = await page.evaluate(() => {
      const arena = (globalThis as any).ddGame.scene.getScene("arena");
      const self = arena.room.state.players.get(arena.room.sessionId);
      const rig = arena.blobs.get(arena.room.sessionId);
      return {
        playerKeys: Object.keys(self ?? {}).sort(),
        predictorKeys: Object.keys(arena.predictor ?? {}).sort(),
        rigKeys: Object.keys(rig ?? {}).sort(),
      };
    });

    const start = await page.evaluate(() => {
      const holder = globalThis as any;
      const arena = holder.ddGame.scene.getScene("arena");
      if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend?.(arena.time.now);
      arena.verbs?.releaseInputLatchIf?.(true);
      arena.game.hasFocus = true;
      arena.pointerOverInteractiveUi = false;
      const self = arena.room.state.players.get(arena.room.sessionId);
      const rig = arena.blobs.get(arena.room.sessionId);
      if (!self || !rig) throw new Error("Overcasters live rig/player is unavailable");

      holder.__v8A1 = {
        frames: [] as FrameRow[],
        rounds: [] as RoundRow[],
        seen: new Set<string>(),
        fireHeld: true,
        input: { x: 1, y: 0 },
        originalAnimate: rig.animate,
      };
      arena.input.activePointer.rightButtonDown = () => holder.__v8A1.fireHeld;

      rig.animate = function (timeMs: number, anim: unknown) {
        const result = holder.__v8A1.originalAnimate.call(this, timeMs, anim);
        const current = arena.room.state.players.get(arena.room.sessionId);
        if (!current) return result;
        const muzzle = { x: 0, y: 0 };
        const wroteMuzzle = this.writeWeaponMuzzleForShot?.(
          this.attackBeatSeq ?? current.attackSeq,
          0,
          muzzle,
        );
        const rendered = { x: Number(this.root.x), y: Number(this.root.y) };
        const frame: FrameRow = {
          wallMs: performance.now(),
          sceneNow: timeMs,
          tick: arena.room.state.tick >>> 0,
          attackSeq: current.attackSeq >>> 0,
          rigAttackSeq: (this.attackBeatSeq ?? 0) >>> 0,
          input: { ...holder.__v8A1.input },
          authority: {
            x: Number(current.x),
            y: Number(current.y),
            vx: Number.isFinite(current.vx) ? Number(current.vx) : null,
            vy: Number.isFinite(current.vy) ? Number(current.vy) : null,
            ackSeq: Number.isFinite(current.ackSeq) ? Number(current.ackSeq) : null,
          },
          rendered,
          renderedMuzzle: wroteMuzzle ? { x: muzzle.x, y: muzzle.y } : null,
        };
        holder.__v8A1.frames.push(frame);

        arena.room.state.projectiles.forEach((row: any, key: string) => {
          const id = String(row.id ?? key);
          if (
            holder.__v8A1.seen.has(id) ||
            row.sourcePlayerId !== arena.room.sessionId ||
            row.sourceWeaponId !== current.weapon
          )
            return;
          const projectile = arena.projectiles.get(id);
          const visibleSpawnOrigin = {
            x: Number(projectile?.getData?.("spawnOriginX")),
            y: Number(projectile?.getData?.("spawnOriginY")),
          };
          const spriteMuzzleAtSpawn = {
            x: Number(projectile?.getData?.("spawnMuzzleX")),
            y: Number(projectile?.getData?.("spawnMuzzleY")),
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
            row.flightAgeTicks ?? (((arena.room.state.tick >>> 0) - (row.bornTick >>> 0)) >>> 0) + 1;
          const authorityOrigin = {
            x: Number(row.x) - Number(row.vx) * Number(steps) * 0.05,
            y: Number(row.y) - Number(row.vy) * Number(steps) * 0.05,
          };
          holder.__v8A1.seen.add(id);
          holder.__v8A1.rounds.push({
            id,
            wallMs: performance.now(),
            observedTick: arena.room.state.tick >>> 0,
            bornTick: row.bornTick >>> 0,
            attackSeq: current.attackSeq >>> 0,
            rigAttackSeq: (this.attackBeatSeq ?? 0) >>> 0,
            playerAuthority: { x: Number(current.x), y: Number(current.y) },
            renderedPlayer: rendered,
            authorityOrigin,
            visibleSpawnOrigin,
            spriteMuzzleAtSpawn,
            currentRenderedMuzzle: wroteMuzzle ? { x: muzzle.x, y: muzzle.y } : null,
            spawnToRenderedMuzzlePx: Math.hypot(
              visibleSpawnOrigin.x - spriteMuzzleAtSpawn.x,
              visibleSpawnOrigin.y - spriteMuzzleAtSpawn.y,
            ),
            authorityToRenderedMuzzlePx: wroteMuzzle
              ? Math.hypot(authorityOrigin.x - muzzle.x, authorityOrigin.y - muzzle.y)
              : null,
          });
        });
        return result;
      };

      holder.__v8A1.timer = window.setInterval(() => {
        const probe = holder.__v8A1;
        arena.stepNetInput?.(50, false, false, probe.input.x, probe.input.y);
      }, 50);
      return {
        attackSeq: self.attackSeq >>> 0,
        x: Number(self.x),
        y: Number(self.y),
      };
    });

    for (let index = 0; index < DIRECTION_STAGES.length; index++) {
      const stage = DIRECTION_STAGES[index];
      await page.evaluate(({ dx, dy }) => {
        (globalThis as any).__v8A1.input = { x: dx, y: dy };
      }, stage);
      await page.waitForTimeout(stage.durationMs);
      if (index === 2 || index === 6) {
        await canvas.screenshot({ path: path.join(EVIDENCE_DIR, `before-stage-${index + 1}.png`) });
      }
    }

    const captured = await page.evaluate(() => {
      const holder = globalThis as any;
      const arena = holder.ddGame.scene.getScene("arena");
      const self = arena.room.state.players.get(arena.room.sessionId);
      holder.__v8A1.fireHeld = false;
      holder.__v8A1.input = { x: 0, y: 0 };
      arena.stepNetInput?.(50, false, false, 0, 0);
      window.clearInterval(holder.__v8A1.timer);
      const rig = arena.blobs.get(arena.room.sessionId);
      if (rig && holder.__v8A1.originalAnimate) rig.animate = holder.__v8A1.originalAnimate;
      return {
        end: {
          attackSeq: self?.attackSeq >>> 0,
          x: Number(self?.x),
          y: Number(self?.y),
        },
        frames: holder.__v8A1.frames as FrameRow[],
        rounds: holder.__v8A1.rounds as RoundRow[],
      };
    });

    const frames = captured.frames.map((frame, index, rows) => {
      const prior = rows[index - 1];
      const dt = prior ? Math.max(0.001, (frame.wallMs - prior.wallMs) / 1000) : null;
      return {
        ...frame,
        derivedVelocity: prior
          ? {
              authorityX: (frame.authority.x - prior.authority.x) / (dt as number),
              authorityY: (frame.authority.y - prior.authority.y) / (dt as number),
              renderedX: (frame.rendered.x - prior.rendered.x) / (dt as number),
              renderedY: (frame.rendered.y - prior.rendered.y) / (dt as number),
            }
          : null,
        renderedAuthorityDeltaPx: Math.hypot(
          frame.rendered.x - frame.authority.x,
          frame.rendered.y - frame.authority.y,
        ),
      };
    });
    const roundDeltas = captured.rounds.map((round) => round.spawnToRenderedMuzzlePx);
    const renderAuthorityDeltas = frames.map((frame) => frame.renderedAuthorityDeltaPx);
    const summary = {
      capturedAt: new Date().toISOString(),
      weaponId: WEAPON_ID,
      continuousFireHeld: true,
      stages: DIRECTION_STAGES,
      runtimeShape,
      start,
      end: captured.end,
      frameCount: frames.length,
      roundCount: captured.rounds.length,
      burstBornTicks: [...new Set(captured.rounds.map((round) => round.bornTick))],
      attackSeqAdvance: captured.end.attackSeq - start.attackSeq,
      maxSpawnToRenderedMuzzlePx: Math.max(0, ...roundDeltas),
      maxRenderedAuthorityDeltaPx: Math.max(0, ...renderAuthorityDeltas),
      frames,
      rounds: captured.rounds,
    };
    await writeFile(path.join(EVIDENCE_DIR, "before-live-capture.json"), `${JSON.stringify(summary, null, 2)}\n`);

    console.log(
      `[v8-a1-before] ${JSON.stringify({
        frames: summary.frameCount,
        rounds: summary.roundCount,
        attackSeqAdvance: summary.attackSeqAdvance,
        bornTicks: summary.burstBornTicks.length,
        maxSpawnToRenderedMuzzlePx: summary.maxSpawnToRenderedMuzzlePx,
        maxRenderedAuthorityDeltaPx: summary.maxRenderedAuthorityDeltaPx,
      })}`,
    );
    expect(summary.frameCount).toBeGreaterThan(250);
    expect(summary.roundCount).toBeGreaterThanOrEqual(16);
    expect(summary.attackSeqAdvance).toBeGreaterThanOrEqual(4);
  });
});
