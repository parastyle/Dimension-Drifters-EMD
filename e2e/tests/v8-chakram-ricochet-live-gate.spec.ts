import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { bootArena, runArenaSpec, waitForDevWeapon } from "../helpers/arena-harness.js";

const CHAKRAM_ID = "x2-iron-chakram";
const EVIDENCE_DIR = path.resolve("docs/owner-notes-audit-v8-evidence/chakram");
const MAX_THROW_ORIGIN_ERROR_PX = 0.25;
const MAX_RICOCHET_RANGE_PX = 360;
const MIN_BOUNCES = 1;
const MIN_FLIGHT_TRAVEL_PX = 18;
const MIN_AUTHORITATIVE_TURN_RADIANS = 0.35;
const MAX_DIRECT_TARGET_DISTANCE_PX = 735;

interface Point {
  x: number;
  y: number;
}

interface EnemyRow extends Point {
  hp: number;
  kind: string;
}

interface EnemySnapshot extends EnemyRow {
  id: string;
}

interface TargetPlan {
  direct: EnemySnapshot;
  second: EnemySnapshot;
  hopDistancePx: number;
  plannedTurnRadians: number;
  initialEnemies: EnemySnapshot[];
}

interface ThrowAnchor extends Point {
  wallMs: number;
}

interface ProjectilePathPoint extends Point {
  wallMs: number;
}

interface VelocityPoint {
  vx: number;
  vy: number;
  wallMs: number;
}

interface HitEvent extends Point {
  enemyId: string;
  hpBefore: number;
  hpAfter: number;
  wallMs: number;
}

interface RicochetCapture {
  projectileIds: string[];
  projectileId: string;
  attackSeq: number;
  kind: string;
  sourcePlayerId: string;
  sourceWeaponId: string;
  anchorKind: string;
  releaseAnchor: Point;
  spawnOrigin: Point;
  spawnThrow: Point;
  releaseErrorPx: number;
  originMetadataErrorPx: number;
  path: ProjectilePathPoint[];
  velocities: VelocityPoint[];
  hitEvents: HitEvent[];
}

interface BrowserProjectileRow {
  kind: string;
  sourcePlayerId: string;
  sourceWeaponId: string;
  vx: number;
  vy: number;
}

interface BrowserProjectileView extends Point {
  getData(key: string): unknown;
}

interface BrowserArena {
  blobs: { get(id: string): unknown };
  game: { hasFocus: boolean };
  arenaMap: {
    pois: Array<{ x: number; y: number; kind: number }>;
  };
  pointerOverInteractiveUi: boolean;
  projectiles: { get(id: string): BrowserProjectileView | undefined };
  room: {
    sessionId: string;
    send(type: string, message: unknown): void;
    state: {
      players: {
        get(id: string): { attackSeq: number; weapon: string; x: number; y: number } | undefined;
      };
      enemies: {
        size: number;
        forEach(callback: (row: EnemyRow, id: string) => void): void;
      };
      projectiles: {
        forEach(callback: (row: BrowserProjectileRow, id: string) => void): void;
      };
    };
  };
  time: { now: number };
  verbs?: {
    isLegendOpen?(): boolean;
    releaseInputLatchIf?(release: boolean): void;
    toggleLegend?(nowMs: number): void;
  };
  writeLiveThrownOrigin(rig: unknown): Point;
}

interface BrowserGlobal {
  ddGame: { scene: { getScene(key: string): BrowserArena } };
  __v8ChakramAnchors?: ThrowAnchor[];
  __v8ChakramCapture?: RicochetCapture;
  __v8ChakramProbe?: number;
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function observedTurnAtTarget(pathPoints: ProjectilePathPoint[], target: Point): number {
  if (pathPoints.length < 5) return 0;
  let closest = 0;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < pathPoints.length; index++) {
    const point = pathPoints[index];
    if (!point) continue;
    const d = distance(point, target);
    if (d < closestDistance) {
      closestDistance = d;
      closest = index;
    }
  }

  let best = 0;
  const from = Math.max(2, closest - 4);
  const to = Math.min(pathPoints.length - 3, closest + 4);
  for (let index = from; index <= to; index++) {
    const before = pathPoints[index - 2];
    const pivot = pathPoints[index];
    const after = pathPoints[index + 2];
    if (!before || !pivot || !after) continue;
    const ax = pivot.x - before.x;
    const ay = pivot.y - before.y;
    const bx = after.x - pivot.x;
    const by = after.y - pivot.y;
    const al = Math.hypot(ax, ay);
    const bl = Math.hypot(bx, by);
    if (al < 3 || bl < 3) continue;
    const cosine = Math.max(-1, Math.min(1, (ax * bx + ay * by) / (al * bl)));
    best = Math.max(best, Math.acos(cosine));
  }
  return best;
}

function observedVelocityTurn(velocities: VelocityPoint[]): number {
  const first = velocities[0];
  if (!first) return 0;
  const firstLength = Math.hypot(first.vx, first.vy);
  if (firstLength < 1) return 0;
  let best = 0;
  for (const velocity of velocities.slice(1)) {
    const length = Math.hypot(velocity.vx, velocity.vy);
    if (length < 1) continue;
    const cosine = Math.max(
      -1,
      Math.min(1, (first.vx * velocity.vx + first.vy * velocity.vy) / (firstLength * length)),
    );
    best = Math.max(best, Math.acos(cosine));
  }
  return best;
}

async function prepareChakram(page: Page, baseURL: string): Promise<void> {
  await bootArena(page, baseURL, `weapon:${CHAKRAM_ID}`);
  await waitForDevWeapon(page, CHAKRAM_ID);
  const canvas = page.locator("#game-root canvas");
  await canvas.click({ position: { x: 320, y: 180 } });
  await page.mouse.move(610, 180);
  await page.waitForTimeout(500);
}

async function spawnTargetPlan(page: Page): Promise<TargetPlan> {
  for (let attempt = 1; attempt <= 4; attempt++) {
    await page.evaluate(() => {
      const holder = globalThis as unknown as BrowserGlobal;
      holder.ddGame.scene
        .getScene("arena")
        .room.send("debugSpawn", { kind: "choirmath", count: 8 });
    });
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const holder = globalThis as unknown as BrowserGlobal;
            const arena = holder.ddGame.scene.getScene("arena");
            let count = 0;
            arena.room.state.enemies.forEach((enemy) => {
              if (enemy.kind === "choirmath") count++;
            });
            return count;
          }),
        { message: `stationary ricochet target batch ${attempt} should spawn`, timeout: 10_000 },
      )
      .toBeGreaterThanOrEqual(attempt * 8);

    const plan = await page.evaluate((maxDirectTargetDistancePx): TargetPlan | null => {
      const holder = globalThis as unknown as BrowserGlobal;
      const arena = holder.ddGame.scene.getScene("arena");
      const self = arena.room.state.players.get(arena.room.sessionId);
      if (!self) throw new Error("chakram player disappeared while selecting targets");

      const all: EnemySnapshot[] = [];
      arena.room.state.enemies.forEach((enemy, id) => {
        all.push({
          id,
          kind: enemy.kind,
          hp: enemy.hp,
          x: enemy.x,
          y: enemy.y,
        });
      });
      const stationary = all.filter((enemy) => enemy.kind === "choirmath");
      const segmentClear = (
        start: Point,
        target: EnemySnapshot,
        ignoredIds: ReadonlySet<string>,
      ): boolean => {
        const sx = start.x;
        const sy = start.y;
        const vx = target.x - start.x;
        const vy = target.y - start.y;
        const lengthSq = vx * vx + vy * vy || 1;
        const blockedByEnemy = all.some((enemy) => {
          if (ignoredIds.has(enemy.id)) return false;
          const rawT = ((enemy.x - sx) * vx + (enemy.y - sy) * vy) / lengthSq;
          if (rawT <= 0.06 || rawT >= 0.88) return false;
          const t = Math.max(0, Math.min(1, rawT));
          const px = sx + vx * t;
          const py = sy + vy * t;
          return Math.hypot(enemy.x - px, enemy.y - py) < 92;
        });
        if (blockedByEnemy) return false;

        return !arena.arenaMap.pois.some((poi) => {
          const sizeClass = ((poi.kind % 7) + 7) % 7;
          const scale = sizeClass === 6 ? 0.8 : sizeClass === 5 ? 1.9 : sizeClass >= 3 ? 1.45 : 1;
          const clearance = 58 * scale + 14;
          const rawT = ((poi.x - sx) * vx + (poi.y - sy) * vy) / lengthSq;
          const t = Math.max(0, Math.min(1, rawT));
          const px = sx + vx * t;
          const py = sy + vy * t;
          return Math.hypot(poi.x - px, poi.y - py) < clearance;
        });
      };

      for (const direct of stationary) {
        const directDistance = Math.hypot(direct.x - self.x, direct.y - self.y);
        if (directDistance > maxDirectTargetDistancePx) continue;
        const neighbours = stationary
          .filter((enemy) => enemy.id !== direct.id)
          .map((enemy) => ({
            enemy,
            distance: Math.hypot(enemy.x - direct.x, enemy.y - direct.y),
          }))
          .sort((a, b) => a.distance - b.distance);
        const nearest = neighbours[0];
        if (!nearest || nearest.distance < 155 || nearest.distance > 300) continue;
        if (!segmentClear(self, direct, new Set([direct.id]))) continue;
        if (!segmentClear(direct, nearest.enemy, new Set([direct.id, nearest.enemy.id]))) continue;

        const incomingX = direct.x - self.x;
        const incomingY = direct.y - self.y;
        const outgoingX = nearest.enemy.x - direct.x;
        const outgoingY = nearest.enemy.y - direct.y;
        const incomingLength = Math.hypot(incomingX, incomingY) || 1;
        const outgoingLength = Math.hypot(outgoingX, outgoingY) || 1;
        const cosine = Math.max(
          -1,
          Math.min(
            1,
            (incomingX * outgoingX + incomingY * outgoingY) / (incomingLength * outgoingLength),
          ),
        );
        const plannedTurnRadians = Math.acos(cosine);
        if (plannedTurnRadians < 0.7) continue;
        return {
          direct,
          second: nearest.enemy,
          hopDistancePx: nearest.distance,
          plannedTurnRadians,
          initialEnemies: stationary,
        };
      }
      return null;
    }, MAX_DIRECT_TARGET_DISTANCE_PX);
    if (plan) return plan;
  }
  throw new Error("could not form a clear stationary target pair inside the 360 px ricochet range");
}

async function mountRicochetProbe(page: Page, plan: TargetPlan): Promise<number> {
  return page.evaluate(
    ({ weaponId, targetPlan }) => {
      const holder = globalThis as unknown as BrowserGlobal;
      const arena = holder.ddGame.scene.getScene("arena");
      if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend?.(arena.time.now);
      arena.verbs?.releaseInputLatchIf?.(true);
      arena.game.hasFocus = true;
      arena.pointerOverInteractiveUi = false;
      const self = arena.room.state.players.get(arena.room.sessionId);
      const rig = arena.blobs.get(arena.room.sessionId);
      if (!self || !rig || self.weapon !== weaponId)
        throw new Error(`${weaponId} live throw rig/player was not mounted`);

      holder.__v8ChakramAnchors = [];
      holder.__v8ChakramCapture = undefined;
      const original = arena.writeLiveThrownOrigin.bind(arena);
      arena.writeLiveThrownOrigin = (sourceRig: unknown) => {
        const point = original(sourceRig);
        holder.__v8ChakramAnchors?.push({
          x: point.x,
          y: point.y,
          wallMs: performance.now(),
        });
        return point;
      };

      const initialHp = new Map(targetPlan.initialEnemies.map((enemy) => [enemy.id, enemy.hp]));
      const latestHp = new Map(initialHp);
      const projectileIds = new Set<string>();
      holder.__v8ChakramProbe = window.setInterval(() => {
        const player = arena.room.state.players.get(arena.room.sessionId);
        if (!player) return;

        arena.room.state.projectiles.forEach((row, projectileId) => {
          if (row.sourcePlayerId !== arena.room.sessionId || row.sourceWeaponId !== weaponId)
            return;
          projectileIds.add(projectileId);
          const rendered = arena.projectiles.get(projectileId);
          const releaseAnchor = holder.__v8ChakramAnchors?.at(-1);
          if (!rendered || !releaseAnchor) return;

          if (!holder.__v8ChakramCapture) {
            const spawnOrigin = {
              x: Number(rendered.getData("spawnOriginX")),
              y: Number(rendered.getData("spawnOriginY")),
            };
            const spawnThrow = {
              x: Number(rendered.getData("spawnThrowX")),
              y: Number(rendered.getData("spawnThrowY")),
            };
            if (![spawnOrigin.x, spawnOrigin.y, spawnThrow.x, spawnThrow.y].every(Number.isFinite))
              return;
            holder.__v8ChakramCapture = {
              projectileIds: [...projectileIds],
              projectileId,
              attackSeq: player.attackSeq,
              kind: row.kind,
              sourcePlayerId: row.sourcePlayerId,
              sourceWeaponId: row.sourceWeaponId,
              anchorKind: String(rendered.getData("spawnAnchorKind") ?? ""),
              releaseAnchor: { x: releaseAnchor.x, y: releaseAnchor.y },
              spawnOrigin,
              spawnThrow,
              releaseErrorPx: Math.hypot(
                spawnThrow.x - releaseAnchor.x,
                spawnThrow.y - releaseAnchor.y,
              ),
              originMetadataErrorPx: Math.hypot(
                spawnOrigin.x - spawnThrow.x,
                spawnOrigin.y - spawnThrow.y,
              ),
              path: [],
              velocities: [],
              hitEvents: [],
            };
          }

          const capture = holder.__v8ChakramCapture;
          if (!capture || capture.projectileId !== projectileId) return;
          capture.projectileIds = [...projectileIds];
          const lastVelocity = capture.velocities.at(-1);
          if (
            Number.isFinite(row.vx) &&
            Number.isFinite(row.vy) &&
            (!lastVelocity || Math.hypot(row.vx - lastVelocity.vx, row.vy - lastVelocity.vy) >= 1)
          ) {
            capture.velocities.push({ vx: row.vx, vy: row.vy, wallMs: performance.now() });
          }
          const last = capture.path.at(-1);
          if (!last || Math.hypot(rendered.x - last.x, rendered.y - last.y) >= 1.5) {
            capture.path.push({ x: rendered.x, y: rendered.y, wallMs: performance.now() });
          }
        });

        const capture = holder.__v8ChakramCapture;
        if (!capture) return;
        arena.room.state.enemies.forEach((enemy, enemyId) => {
          const before = latestHp.get(enemyId);
          if (before === undefined || enemy.hp >= before) return;
          latestHp.set(enemyId, enemy.hp);
          const last = capture.path.at(-1) ?? capture.spawnOrigin;
          capture.hitEvents.push({
            enemyId,
            hpBefore: before,
            hpAfter: enemy.hp,
            x: last.x,
            y: last.y,
            wallMs: performance.now(),
          });
        });
      }, 5);
      return self.attackSeq;
    },
    { weaponId: CHAKRAM_ID, targetPlan: plan },
  );
}

test("the iron chakram leaves the throw hand and ricochets into a second target", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await runArenaSpec(page, async (baseURL) => {
    await mkdir(EVIDENCE_DIR, { recursive: true });
    await page.setViewportSize({ width: 960, height: 540 });
    await prepareChakram(page, baseURL);
    const plan = await spawnTargetPlan(page);
    const aimDirection = await page.evaluate((target) => {
      const holder = globalThis as unknown as BrowserGlobal;
      const arena = holder.ddGame.scene.getScene("arena");
      const self = arena.room.state.players.get(arena.room.sessionId);
      if (!self) throw new Error("chakram player disappeared while aligning the live throw");
      const dx = target.x - self.x;
      const dy = target.y - self.y;
      const length = Math.hypot(dx, dy) || 1;
      return { x: dx / length, y: dy / length };
    }, plan.direct);
    const canvasBox = await page.locator("#game-root canvas").boundingBox();
    if (!canvasBox) throw new Error("chakram canvas lost its live bounds");
    const pointerRadius = Math.min(canvasBox.width, canvasBox.height) * 0.35;
    await page.mouse.move(
      canvasBox.x + canvasBox.width / 2 + aimDirection.x * pointerRadius,
      canvasBox.y + canvasBox.height / 2 + aimDirection.y * pointerRadius,
    );
    await page.waitForTimeout(350);
    const startSeq = await mountRicochetProbe(page, plan);

    await page.evaluate((target) => {
      const holder = globalThis as unknown as BrowserGlobal;
      const arena = holder.ddGame.scene.getScene("arena");
      const self = arena.room.state.players.get(arena.room.sessionId);
      if (!self) throw new Error("chakram player disappeared before the accepted throw");
      const dx = target.x - self.x;
      const dy = target.y - self.y;
      const length = Math.hypot(dx, dy) || 1;
      arena.room.send("attack", {
        aimX: dx / length,
        aimY: dy / length,
        tx: target.x,
        ty: target.y,
      });
    }, plan.direct);

    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const holder = globalThis as unknown as BrowserGlobal;
            const arena = holder.ddGame.scene.getScene("arena");
            return arena.room.state.players.get(arena.room.sessionId)?.attackSeq ?? -1;
          }),
        { message: "the server should accept exactly one chakram throw", timeout: 5_000 },
      )
      .toBe(startSeq + 1);

    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const holder = globalThis as unknown as BrowserGlobal;
            return new Set(holder.__v8ChakramCapture?.hitEvents.map((event) => event.enemyId) ?? [])
              .size;
          }),
        {
          message: "one accepted chakram projectile should damage at least two distinct targets",
          timeout: 10_000,
        },
      )
      .toBeGreaterThanOrEqual(2);

    const capture = await page.evaluate(() => {
      const holder = globalThis as unknown as BrowserGlobal;
      if (holder.__v8ChakramProbe) window.clearInterval(holder.__v8ChakramProbe);
      holder.__v8ChakramProbe = undefined;
      if (!holder.__v8ChakramCapture)
        throw new Error("chakram probe completed without a projectile capture");
      return holder.__v8ChakramCapture;
    });
    const damagedEnemyIds = [...new Set(capture.hitEvents.map((event) => event.enemyId))];
    const bounceCount = Math.max(0, damagedEnemyIds.length - 1);
    const flightTravelPx = capture.path.reduce(
      (best, point) => Math.max(best, distance(point, capture.spawnOrigin)),
      0,
    );
    const observedTurnRadians = observedTurnAtTarget(capture.path, plan.direct);
    const authoritativeTurnRadians = observedVelocityTurn(capture.velocities);

    expect(capture.attackSeq, "server accepted exactly this throw").toBe(startSeq + 1);
    expect(capture.kind, "wire identity").toBe(`thrown:${CHAKRAM_ID}`);
    expect(capture.sourceWeaponId, "server source").toBe(CHAKRAM_ID);
    expect(capture.sourcePlayerId, "server owner").not.toBe("");
    expect(capture.projectileIds, "one accepted throw emitted one projectile").toHaveLength(1);
    expect(capture.anchorKind, "presentation seam").toBe("throw");
    expect(capture.releaseErrorPx, "live release hand").toBeLessThanOrEqual(
      MAX_THROW_ORIGIN_ERROR_PX,
    );
    expect(capture.originMetadataErrorPx, "recorded throw origin").toBeLessThanOrEqual(
      MAX_THROW_ORIGIN_ERROR_PX,
    );
    expect(flightTravelPx, "visible projectile travel").toBeGreaterThanOrEqual(
      MIN_FLIGHT_TRAVEL_PX,
    );
    expect(
      plan.hopDistancePx,
      "selected second target is inside authored range",
    ).toBeLessThanOrEqual(MAX_RICOCHET_RANGE_PX);
    expect(damagedEnemyIds, "direct target was damaged").toContain(plan.direct.id);
    expect(damagedEnemyIds, "nearest fresh target was damaged after redirect").toContain(
      plan.second.id,
    );
    expect(bounceCount, "observed target-to-target bounces").toBeGreaterThanOrEqual(MIN_BOUNCES);
    expect(
      authoritativeTurnRadians,
      "the same authoritative projectile changed direction after its direct hit",
    ).toBeGreaterThanOrEqual(MIN_AUTHORITATIVE_TURN_RADIANS);

    await page.locator("#game-root canvas").screenshot({
      path: path.join(EVIDENCE_DIR, "iron-chakram-live-ricochet.png"),
    });
    await writeFile(
      path.join(EVIDENCE_DIR, "live-capture.json"),
      `${JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          weaponId: CHAKRAM_ID,
          thresholds: {
            maxThrowOriginErrorPx: MAX_THROW_ORIGIN_ERROR_PX,
            maxRicochetRangePx: MAX_RICOCHET_RANGE_PX,
            minBounces: MIN_BOUNCES,
            minFlightTravelPx: MIN_FLIGHT_TRAVEL_PX,
            minAuthoritativeTurnRadians: MIN_AUTHORITATIVE_TURN_RADIANS,
          },
          result: {
            startAttackSeq: startSeq,
            acceptedAttackSeq: capture.attackSeq,
            bounceCount,
            damagedEnemyIds,
            flightTravelPx,
            observedTurnRadians,
            authoritativeTurnRadians,
            targetPlan: plan,
            projectile: capture,
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  });
});
