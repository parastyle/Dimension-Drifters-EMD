import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { bootArena, runArenaSpec, waitForDevWeapon } from "../helpers/arena-harness.js";

const EVIDENCE_DIR = path.resolve(
  import.meta.dirname,
  "../../docs/owner-notes-audit-v10-evidence/b2-wacky",
);
const FORBIDDEN_PORTS = new Set([5180, 2567]);
const WEAPONS = [
  {
    id: "x2-unicorn-rainbow-beam",
    projectile: "none",
    impact: "none",
    expectedProjectiles: 0,
  },
  {
    id: "x2-fish-launcher",
    projectile: "fish",
    impact: "wet-slap",
    expectedProjectiles: 4,
  },
  {
    id: "x2-squeaky-mallet",
    projectile: "none",
    impact: "squeak-ring",
    expectedProjectiles: 0,
  },
  {
    id: "x2-exploding-present-lobber",
    projectile: "present",
    impact: "confetti-burst",
    expectedProjectiles: 1,
  },
  {
    id: "x2-bubble-wand-swarm-caster",
    projectile: "bubble",
    impact: "bubble-pop",
    expectedProjectiles: 5,
  },
  {
    id: "x2-boomerang-boot",
    projectile: "own-sprite-return",
    impact: "none",
    expectedProjectiles: 1,
  },
  {
    id: "x2-confetti-cannon",
    projectile: "confetti",
    impact: "confetti-burst",
    expectedProjectiles: 7,
  },
] as const;
const FACINGS = ["right", "left"] as const;

type Facing = (typeof FACINGS)[number];

interface Point {
  x: number;
  y: number;
}

interface Target extends Point {
  id: string;
  distance: number;
}

interface VfxAuditEvent extends Point {
  kind: "projectile" | "impact";
  weaponId: string;
  style: string;
}

interface ContactAudit extends Point {
  layer: string;
  targetId: string;
  sourcePlayerId: string;
  weaponId: string;
  damage: number;
}

interface ProjectileSample {
  id: string;
  weaponId: string;
  vx: number;
  vy: number;
  spriteId: string;
  style: string;
}

interface BeamAudit {
  rowWidth: number;
  rowLength: number;
  origin: Point;
  muzzle: Point;
  muzzleDelta: number;
  visualWidth: number;
  strandCount: number;
  strandPalette: number[];
}

interface LiveCapture {
  weaponId: string;
  facing: Facing;
  clientPort: number;
  gamePort: number;
  target: Target;
  attackSeqBefore: number;
  attackSeqAfter: number;
  contacts: ContactAudit[];
  vfx: VfxAuditEvent[];
  projectileSamples: ProjectileSample[];
  distinctProjectileIds: number;
  ownSpriteObserved: boolean;
  returningObserved: boolean;
  beam: BeamAudit | null;
  screenshot: string;
}

interface BrowserEnemy extends Point {
  kind: string;
}

interface BrowserProjectile extends Point {
  sourceWeaponId: string;
  vx: number;
  vy: number;
}

interface BrowserArena {
  beamRenderer: {
    entries: Array<{
      key: string;
      ownerId: string;
      renderOriginX: number;
      renderOriginY: number;
      body: {
        visible: boolean;
        x: number;
        y: number;
        scaleX: number;
        scaleY: number;
        points?: Point[];
      };
      structure?: {
        visualWidth?: number;
        strandCount?: number;
        strandPalette?: number[];
      };
    }>;
  };
  blobs: Map<
    string,
    {
      facing: number;
      weaponDef?: { id: string };
      writeWeaponMuzzle(hand: 0 | 1, out: Point, pointIndex?: number): boolean;
    }
  >;
  combatFeedback: {
    subscribeContact(listener: (event: ContactAudit) => void): () => void;
  };
  cameras: {
    main: {
      worldView: { x: number; y: number; width: number; height: number };
    };
  };
  game: { hasFocus: boolean };
  input: { activePointer: { rightButtonDown: () => boolean } };
  pointerOverInteractiveUi: boolean;
  projectiles: Map<
    string,
    {
      getData(key: string): unknown;
    }
  >;
  room: {
    sessionId: string;
    send(type: string, message?: unknown): void;
    state: {
      beams: {
        get(id: string):
          | {
              phase: number;
              width: number;
              effectiveLength: number;
              originX: number;
              originY: number;
            }
          | undefined;
      };
      enemies: {
        forEach(callback: (enemy: BrowserEnemy, id: string) => void): void;
      };
      players: {
        get(
          id: string,
        ): { ackSeq: number; attackSeq: number; weapon: string; x: number; y: number } | undefined;
      };
      projectiles: {
        forEach(callback: (projectile: BrowserProjectile, id: string) => void): void;
      };
    };
  };
  scene: {
    pause(): void;
    resume(): void;
  };
  stepNetInput?(
    deltaMs: number,
    blocked: boolean,
    ultimate: boolean,
    dx: number,
    dy: number,
  ): void;
  time: { now: number };
  textures: {
    exists(key: string): boolean;
  };
  verbs?: {
    isLegendOpen?(): boolean;
    releaseInputLatchIf?(force: boolean): void;
    toggleLegend?(timeMs: number): void;
  };
}

interface BrowserGlobal {
  ddGame: { scene: { getScene(key: string): BrowserArena } };
  __ddB2WackyVfxAudit?: VfxAuditEvent[];
  __ddB2Contacts?: ContactAudit[];
  __ddB2ProjectileSamples?: ProjectileSample[];
  __ddB2BeamAudits?: BeamAudit[];
  __ddB2ProjectileTimer?: number;
  __ddB2AttackTimer?: number;
  __ddB2ContactUnsubscribe?: () => void;
  __ddB2BeamFrameFrozen?: boolean;
}

function relativeEvidencePath(file: string): string {
  return path.relative(process.cwd(), file).replaceAll("\\", "/");
}

async function prepare(page: Page): Promise<void> {
  await page.locator("#game-root canvas").click({ position: { x: 320, y: 180 } });
  await page.evaluate(() => {
    const current = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
    if (current.verbs?.isLegendOpen?.()) current.verbs.toggleLegend?.(current.time.now);
    current.verbs?.releaseInputLatchIf?.(true);
    current.game.hasFocus = true;
    current.pointerOverInteractiveUi = false;
    const holder = globalThis as unknown as BrowserGlobal;
    holder.__ddB2WackyVfxAudit = [];
    holder.__ddB2Contacts = [];
    holder.__ddB2ProjectileSamples = [];
    holder.__ddB2BeamAudits = [];
    holder.__ddB2BeamFrameFrozen = false;
    holder.__ddB2ContactUnsubscribe?.();
    holder.__ddB2ContactUnsubscribe = current.combatFeedback.subscribeContact((event) => {
      if (
        event.sourcePlayerId === current.room.sessionId &&
        event.damage > 0 &&
        event.layer !== "instant"
      )
        holder.__ddB2Contacts?.push({ ...event });
    });
    if (holder.__ddB2ProjectileTimer) window.clearInterval(holder.__ddB2ProjectileTimer);
    holder.__ddB2ProjectileTimer = window.setInterval(() => {
      current.room.state.projectiles.forEach((row, id) => {
        if (row.sourceWeaponId === "") return;
        const view = current.projectiles.get(id);
        holder.__ddB2ProjectileSamples?.push({
          id,
          weaponId: row.sourceWeaponId,
          vx: row.vx,
          vy: row.vy,
          spriteId: String(view?.getData("spriteId") ?? ""),
          style: String(view?.getData("wackyProjectileStyle") ?? ""),
        });
      });
      const beamRow = current.room.state.beams.get(current.room.sessionId);
      const beamEntry = current.beamRenderer.entries.find(
        (candidate) =>
          candidate.key &&
          candidate.ownerId === current.room.sessionId,
      );
      const beamPoint = beamEntry?.body.points?.[0];
      const beamRig = current.blobs.get(current.room.sessionId);
      const beamMuzzle = { x: 0, y: 0 };
      if (
        beamRow?.phase === 2 &&
        beamEntry &&
        beamRig?.writeWeaponMuzzle(0, beamMuzzle, 0) &&
        beamEntry.structure?.strandCount === 5
      ) {
        const origin = beamPoint
          ? {
              x: beamEntry.body.x + beamPoint.x * beamEntry.body.scaleX,
              y: beamEntry.body.y + beamPoint.y * beamEntry.body.scaleY,
            }
          : { x: beamRow.originX, y: beamRow.originY };
        holder.__ddB2BeamAudits?.push({
          rowWidth: beamRow.width,
          rowLength: beamRow.effectiveLength,
          origin,
          muzzle: { ...beamMuzzle },
          muzzleDelta: Math.hypot(origin.x - beamMuzzle.x, origin.y - beamMuzzle.y),
          visualWidth: beamEntry.structure.visualWidth ?? 0,
          strandCount: beamEntry.structure.strandCount,
          strandPalette: [...(beamEntry.structure.strandPalette ?? [])],
        });
        if (!holder.__ddB2BeamFrameFrozen) {
          holder.__ddB2BeamFrameFrozen = true;
          current.scene.pause();
        }
      }
    }, 16);
  });
}

async function chooseFacingDummy(page: Page, facing: Facing): Promise<Target> {
  return await page.evaluate((side) => {
    const current = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
    const self = current.room.state.players.get(current.room.sessionId);
    if (!self) throw new Error("B2 live player disappeared while choosing a dummy");
    const dummies: Array<Target> = [];
    current.room.state.enemies.forEach((enemy, id) => {
      if (enemy.kind !== "dummy") return;
      dummies.push({
        id,
        x: enemy.x,
        y: enemy.y,
        distance: Math.hypot(enemy.x - self.x, enemy.y - self.y),
      });
    });
    const candidates = dummies.filter((dummy) =>
      side === "right" ? dummy.x > self.x : dummy.x < self.x,
    );
    const chosen = candidates.sort((left, right) => left.distance - right.distance)[0];
    if (!chosen) throw new Error(`B2 live gate could not find a ${side}-side dummy`);
    return chosen;
  }, facing);
}

async function chooseNearestDummy(page: Page): Promise<Target> {
  return await page.evaluate(() => {
    const current = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
    const self = current.room.state.players.get(current.room.sessionId);
    if (!self) throw new Error("B2 live player disappeared while choosing the nearest dummy");
    const dummies: Target[] = [];
    current.room.state.enemies.forEach((enemy, id) => {
      if (enemy.kind !== "dummy") return;
      dummies.push({
        id,
        x: enemy.x,
        y: enemy.y,
        distance: Math.hypot(enemy.x - self.x, enemy.y - self.y),
      });
    });
    const chosen = dummies.sort((left, right) => left.distance - right.distance)[0];
    if (!chosen) throw new Error("B2 live gate could not find its nearest dummy");
    return chosen;
  });
}

async function moveMalletIntoRange(
  page: Page,
  targetId: string,
  facing: Facing,
): Promise<Target> {
  return await page.evaluate(
    ({ id, facing }) => {
      const current = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
      const initial = current.room.state.players.get(current.room.sessionId);
      if (!initial) throw new Error("B2 mallet approach lost its player");
      let seq = initial.ackSeq >>> 0;
      const deadline = performance.now() + 8_000;
      current.scene.pause();
      return new Promise<Target>((resolve, reject) => {
        const finish = (error?: Error) => {
          window.clearInterval(timer);
          current.scene.resume();
          if (error) reject(error);
        };
        const timer = window.setInterval(() => {
          const self = current.room.state.players.get(current.room.sessionId);
          let target: BrowserEnemy | undefined;
          current.room.state.enemies.forEach((enemy, enemyId) => {
            if (enemyId === id) target = enemy;
          });
          if (!self || !target) {
            finish(new Error("B2 mallet approach lost its player or dummy"));
            return;
          }
          const desiredX = target.x + (facing === "right" ? -42 : 42);
          const desiredY = target.y;
          const dx = desiredX - self.x;
          const dy = desiredY - self.y;
          const remaining = Math.hypot(dx, dy);
          if (remaining <= 18) {
            seq = (seq + 1) >>> 0;
            current.room.send("input", { seq, dx: 0, dy: 0 });
            window.clearInterval(timer);
            current.scene.resume();
            resolve({
              id,
              x: target.x,
              y: target.y,
              distance: Math.hypot(target.x - self.x, target.y - self.y),
            });
            return;
          }
          if (performance.now() >= deadline) {
            finish(
              new Error(`B2 mallet could not approach its dummy; ${remaining.toFixed(1)} px remain`),
            );
            return;
          }
          const length = remaining || 1;
          seq = (seq + 1) >>> 0;
          current.room.send("input", {
            seq,
            dx: dx / length,
            dy: dy / length,
            fireHeld: false,
          });
        }, 55);
      });
    },
    { id: targetId, facing },
  );
}

async function aimFacing(page: Page, facing: Facing, target: Target): Promise<void> {
  const canvas = page.locator("#game-root canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("B2 live gate cannot find the Phaser canvas bounds");
  const normalized = await page.evaluate(({ x, y }) => {
    const current = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
    const view = current.cameras.main.worldView;
    return {
      x: (x - view.x) / view.width,
      y: (y - view.y) / view.height,
    };
  }, target);
  await page.mouse.move(
    box.x + box.width * Math.max(0.03, Math.min(0.97, normalized.x)),
    box.y + box.height * Math.max(0.03, Math.min(0.97, normalized.y)),
  );
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const current = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
          return current.blobs.get(current.room.sessionId)?.facing ?? 0;
        }),
      { message: `B2 rig should commit ${facing} facing`, timeout: 10_000 },
    )
    .toBe(facing === "right" ? 1 : -1);
}

async function beginAttack(
  page: Page,
  weaponId: string,
  targetId: string,
): Promise<number> {
  return await page.evaluate(
    ({ id, weapon }) => {
      const current = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
      const holder = globalThis as unknown as BrowserGlobal;
      const self = current.room.state.players.get(current.room.sessionId);
      if (!self) throw new Error(`B2 live gate lost player before firing ${weapon}`);
      const before = self.attackSeq;
      const send = () => {
        const player = current.room.state.players.get(current.room.sessionId);
        let target: BrowserEnemy | undefined;
        current.room.state.enemies.forEach((enemy, enemyId) => {
          if (enemyId === id) target = enemy;
        });
        if (!player || !target) return;
        const dx = target.x - player.x;
        const dy = target.y - player.y;
        const length = Math.hypot(dx, dy) || 1;
        if (weapon.includes("rainbow-beam")) current.stepNetInput?.(50, false, false, 0, 0);
        else
          current.room.send("attack", {
            aimX: dx / length,
            aimY: dy / length,
            tx: target.x,
            ty: target.y,
          });
      };
      if (holder.__ddB2AttackTimer) window.clearInterval(holder.__ddB2AttackTimer);
      current.input.activePointer.rightButtonDown = () => true;
      send();
      holder.__ddB2AttackTimer = window.setInterval(send, weapon.includes("rainbow-beam") ? 50 : 120);
      return before;
    },
    { id: targetId, weapon: weaponId },
  );
}

async function stopAttack(page: Page): Promise<void> {
  await page.evaluate(() => {
    const current = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
    const holder = globalThis as unknown as BrowserGlobal;
    if (holder.__ddB2AttackTimer) window.clearInterval(holder.__ddB2AttackTimer);
    holder.__ddB2AttackTimer = undefined;
    current.input.activePointer.rightButtonDown = () => false;
    current.stepNetInput?.(50, false, false, 0, 0);
  });
}

async function waitForDamage(page: Page, weaponId: string): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate((id) => {
          const holder = globalThis as unknown as BrowserGlobal;
          return (
            holder.__ddB2Contacts?.some(
              (event) => event.weaponId === id && event.damage > 0,
            ) ?? false
          );
        }, weaponId),
      { message: `${weaponId} should produce an authoritative damage receipt`, timeout: 12_000 },
    )
    .toBe(true);
}

async function waitForVfx(
  page: Page,
  fixture: (typeof WEAPONS)[number],
  targetId: string,
): Promise<void> {
  if (fixture.id === "x2-unicorn-rainbow-beam") {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await expect
          .poll(
            () =>
              page.evaluate(
                () => (globalThis as unknown as BrowserGlobal).__ddB2BeamAudits?.length ?? 0,
              ),
            {
              message: `rainbow beam attempt ${attempt} should render its authoritative active phase`,
              timeout: 4_000,
            },
          )
          .toBeGreaterThan(0);
        return;
      } catch (error) {
        if (attempt === 3) throw error;
        await stopAttack(page);
        await expect
          .poll(
            () =>
              page.evaluate(() => {
                const current = (
                  globalThis as unknown as BrowserGlobal
                ).ddGame.scene.getScene("arena");
                return !current.room.state.beams.get(current.room.sessionId);
              }),
            { message: "missed rainbow cycle should release and fully recover", timeout: 20_000 },
          )
          .toBe(true);
        await page.evaluate(() => {
          const holder = globalThis as unknown as BrowserGlobal;
          const current = holder.ddGame.scene.getScene("arena");
          current.scene.resume();
          holder.__ddB2BeamAudits = [];
          holder.__ddB2BeamFrameFrozen = false;
        });
        await beginAttack(page, fixture.id, targetId);
      }
    }
    throw new Error("rainbow beam exhausted its retry budget");
  }
  if (fixture.projectile !== "none" && fixture.projectile !== "own-sprite-return") {
    await expect
      .poll(
        () =>
          page.evaluate(
            ({ id, style }) => {
              const holder = globalThis as unknown as BrowserGlobal;
              return (
                holder.__ddB2WackyVfxAudit?.some(
                  (event) =>
                    event.kind === "projectile" &&
                    event.weaponId === id &&
                    event.style === style,
                ) ?? false
              );
            },
            { id: fixture.id, style: fixture.projectile },
          ),
        { message: `${fixture.id} should render its authored projectile identity`, timeout: 8_000 },
      )
      .toBe(true);
  }
  if (fixture.impact !== "none") {
    await expect
      .poll(
        () =>
          page.evaluate(
            ({ id, style }) => {
              const holder = globalThis as unknown as BrowserGlobal;
              return (
                holder.__ddB2WackyVfxAudit?.some(
                  (event) =>
                    event.kind === "impact" && event.weaponId === id && event.style === style,
                ) ?? false
              );
            },
            { id: fixture.id, style: fixture.impact },
          ),
        { message: `${fixture.id} should render its authored impact identity`, timeout: 12_000 },
      )
      .toBe(true);
  }
  if (fixture.id === "x2-boomerang-boot") {
    await expect
      .poll(
        () =>
          page.evaluate((id) => {
            const holder = globalThis as unknown as BrowserGlobal;
            const rows = holder.__ddB2ProjectileSamples?.filter(
              (sample) => sample.weaponId === id,
            );
            return rows?.some((sample) => sample.spriteId === id) ?? false;
          }, fixture.id),
        { message: "boomerang boot should use its own held sprite in flight", timeout: 8_000 },
      )
      .toBe(true);
    await expect
      .poll(
        () =>
          page.evaluate((id) => {
            const holder = globalThis as unknown as BrowserGlobal;
            const byProjectile = new Map<string, ProjectileSample[]>();
            for (const sample of holder.__ddB2ProjectileSamples ?? []) {
              if (sample.weaponId !== id) continue;
              const rows = byProjectile.get(sample.id) ?? [];
              rows.push(sample);
              byProjectile.set(sample.id, rows);
            }
            for (const rows of byProjectile.values()) {
              const first = rows[0];
              if (!first) continue;
              if (rows.some((sample) => first.vx * sample.vx + first.vy * sample.vy < 0)) return true;
            }
            return false;
          }, fixture.id),
        { message: "boomerang boot should reverse into its return leg", timeout: 8_000 },
      )
      .toBe(true);
  }
}

async function captureActiveBeam(page: Page): Promise<BeamAudit> {
  const beam = await page.evaluate(
    () => (globalThis as unknown as BrowserGlobal).__ddB2BeamAudits?.at(-1) ?? null,
  );
  if (!beam) throw new Error("rainbow beam disappeared between active telemetry samples");
  return beam;
}

async function captureLive(
  page: Page,
  fixture: (typeof WEAPONS)[number],
  facing: Facing,
  target: Target,
  attackSeqBefore: number,
  clientPort: number,
  gamePort: number,
  screenshot: string,
  frozenBeam: BeamAudit | null,
): Promise<LiveCapture> {
  return await page.evaluate(
    ({
      fixture,
      facing,
      target,
      attackSeqBefore,
      clientPort,
      gamePort,
      screenshot,
      frozenBeam,
    }) => {
      const current = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
      const holder = globalThis as unknown as BrowserGlobal;
      const self = current.room.state.players.get(current.room.sessionId);
      if (!self) throw new Error(`B2 live capture lost ${fixture.id}`);
      const contacts = (holder.__ddB2Contacts ?? []).filter(
        (event) => event.weaponId === fixture.id,
      );
      const vfx = (holder.__ddB2WackyVfxAudit ?? []).filter(
        (event) => event.weaponId === fixture.id,
      );
      const projectileSamples = (holder.__ddB2ProjectileSamples ?? []).filter(
        (sample) => sample.weaponId === fixture.id,
      );
      const byProjectile = new Map<string, ProjectileSample[]>();
      for (const sample of projectileSamples) {
        const rows = byProjectile.get(sample.id) ?? [];
        rows.push(sample);
        byProjectile.set(sample.id, rows);
      }
      const returningObserved = [...byProjectile.values()].some((rows) => {
        const first = rows[0];
        return !!first && rows.some((sample) => first.vx * sample.vx + first.vy * sample.vy < 0);
      });

      let beam: BeamAudit | null = frozenBeam;
      const row = current.room.state.beams.get(current.room.sessionId);
      const entry = current.beamRenderer.entries.find(
        (candidate) =>
          candidate.key &&
          candidate.ownerId === current.room.sessionId &&
          candidate.body.visible,
      );
      const point = entry?.body.points?.[0];
      const rig = current.blobs.get(current.room.sessionId);
      const muzzle = { x: 0, y: 0 };
      if (!beam && row?.phase === 2 && entry && point && rig?.writeWeaponMuzzle(0, muzzle, 0)) {
        const origin = {
          x: entry.body.x + point.x * entry.body.scaleX,
          y: entry.body.y + point.y * entry.body.scaleY,
        };
        beam = {
          rowWidth: row.width,
          rowLength: row.effectiveLength,
          origin,
          muzzle,
          muzzleDelta: Math.hypot(origin.x - muzzle.x, origin.y - muzzle.y),
          visualWidth: entry.structure?.visualWidth ?? 0,
          strandCount: entry.structure?.strandCount ?? 0,
          strandPalette: [...(entry.structure?.strandPalette ?? [])],
        };
      }

      return {
        weaponId: fixture.id,
        facing,
        clientPort,
        gamePort,
        target,
        attackSeqBefore,
        attackSeqAfter: self.attackSeq,
        contacts,
        vfx,
        projectileSamples,
        distinctProjectileIds: byProjectile.size,
        ownSpriteObserved: projectileSamples.some((sample) => sample.spriteId === fixture.id),
        returningObserved,
        beam,
        screenshot,
      };
    },
    {
      fixture,
      facing,
      target,
      attackSeqBefore,
      clientPort,
      gamePort,
      screenshot: relativeEvidencePath(screenshot),
      frozenBeam,
    },
  );
}

test("B2 wacky catalog fires, damages, and renders distinctly on both facings", async ({ page }) => {
  test.setTimeout(300_000);
  await runArenaSpec(page, async (baseURL) => {
    await mkdir(EVIDENCE_DIR, { recursive: true });
    await page.setViewportSize({ width: 800, height: 450 });
    const clientPort = Number(new URL(baseURL).port);
    expect(FORBIDDEN_PORTS.has(clientPort), "client port must be private ephemeral").toBe(false);
    const captures: LiveCapture[] = [];

    for (const fixture of WEAPONS) {
      for (const facing of FACINGS) {
        await bootArena(page, baseURL, `weapon:${fixture.id}`);
        await waitForDevWeapon(page, fixture.id);
        const gamePort = Number(new URL(page.url()).searchParams.get("port"));
        expect(Number.isInteger(gamePort) && gamePort > 0, "redirect should expose game port").toBe(
          true,
        );
        expect(FORBIDDEN_PORTS.has(gamePort), "game port must be private ephemeral").toBe(false);
        await prepare(page);
        if (fixture.id === "x2-unicorn-rainbow-beam")
          await expect
            .poll(
              () =>
                page.evaluate(() => {
                  const current = (
                    globalThis as unknown as BrowserGlobal
                  ).ddGame.scene.getScene("arena");
                  return current.textures.exists("beam-v7-structure:converging-strands");
                }),
              {
                message: "rainbow ribbon structure art should preload before its short live window",
                timeout: 10_000,
              },
            )
            .toBe(true);
        let target =
          fixture.id === "x2-squeaky-mallet"
            ? await chooseNearestDummy(page)
            : await chooseFacingDummy(page, facing);
        if (fixture.id === "x2-squeaky-mallet")
          target = await moveMalletIntoRange(page, target.id, facing);
        await aimFacing(page, facing, target);
        const attackSeqBefore = await beginAttack(page, fixture.id, target.id);
        try {
          await waitForVfx(page, fixture, target.id);
          const frozenBeam =
            fixture.id === "x2-unicorn-rainbow-beam" ? await captureActiveBeam(page) : null;
          const screenshot = path.join(EVIDENCE_DIR, `${fixture.id}-${facing}.png`);
          if (frozenBeam)
            await page.locator("#game-root canvas").screenshot({ path: screenshot });
          if (frozenBeam)
            await page.evaluate(() => {
              const current = (
                globalThis as unknown as BrowserGlobal
              ).ddGame.scene.getScene("arena");
              current.scene.resume();
            });
          if (fixture.id !== "x2-unicorn-rainbow-beam")
            await expect
              .poll(
                () =>
                  page.evaluate(() => {
                    const current = (
                      globalThis as unknown as BrowserGlobal
                    ).ddGame.scene.getScene("arena");
                    return current.room.state.players.get(current.room.sessionId)?.attackSeq ?? -1;
                  }),
                { message: `${fixture.id} ${facing} attack should be accepted`, timeout: 8_000 },
              )
              .toBeGreaterThan(attackSeqBefore);
          await waitForDamage(page, fixture.id);
          const capture = await captureLive(
            page,
            fixture,
            facing,
            target,
            attackSeqBefore,
            clientPort,
            gamePort,
            screenshot,
            frozenBeam,
          );
          if (!frozenBeam)
            await page.locator("#game-root canvas").screenshot({ path: screenshot });
          if (fixture.id !== "x2-unicorn-rainbow-beam")
            expect(
              capture.attackSeqAfter,
              `${fixture.id} ${facing}: attack sequence`,
            ).toBeGreaterThan(capture.attackSeqBefore);
          expect(capture.contacts.some((event) => event.damage > 0)).toBe(true);
          if (fixture.id === "x2-unicorn-rainbow-beam") {
            expect(capture.beam?.rowWidth).toBe(64);
            expect(capture.beam?.visualWidth).toBeGreaterThanOrEqual(60);
            expect(capture.beam?.strandCount).toBe(5);
            expect(new Set(capture.beam?.strandPalette).size).toBe(5);
            expect(capture.beam?.muzzleDelta).toBeLessThanOrEqual(10);
          } else if (fixture.id === "x2-boomerang-boot") {
            expect(capture.ownSpriteObserved).toBe(true);
            expect(capture.returningObserved).toBe(true);
          } else {
            expect(
              capture.vfx.some(
                (event) =>
                  (fixture.projectile === "none" || event.style === fixture.projectile) &&
                  (fixture.impact === "none" || event.style === fixture.impact),
              ) || capture.vfx.length >= (fixture.impact === "none" ? 1 : 2),
            ).toBe(true);
          }
          captures.push(capture);
        } finally {
          await stopAttack(page);
        }
      }
    }

    const byWeapon = new Map<string, LiveCapture[]>();
    for (const capture of captures) {
      const rows = byWeapon.get(capture.weaponId) ?? [];
      rows.push(capture);
      byWeapon.set(capture.weaponId, rows);
    }
    const assertions = {
      capturedFourteenFacings: captures.length === WEAPONS.length * FACINGS.length,
      allPortsPrivate: captures.every(
        (capture) =>
          !FORBIDDEN_PORTS.has(capture.clientPort) &&
          !FORBIDDEN_PORTS.has(capture.gamePort),
      ),
      bothFacingsPerWeapon: WEAPONS.every((weapon) => {
        const facings = new Set(byWeapon.get(weapon.id)?.map((capture) => capture.facing));
        return FACINGS.every((facing) => facings.has(facing));
      }),
      everyFacingDamages: captures.every((capture) =>
        capture.contacts.some((contact) => contact.damage > 0),
      ),
      rainbowAnchoredBroadFiveStrand: captures
        .filter((capture) => capture.weaponId === "x2-unicorn-rainbow-beam")
        .every(
          (capture) =>
            capture.beam?.rowWidth === 64 &&
            (capture.beam.visualWidth ?? 0) >= 60 &&
            capture.beam?.strandCount === 5 &&
            new Set(capture.beam?.strandPalette).size === 5 &&
            (capture.beam?.muzzleDelta ?? Infinity) <= 10,
        ),
      authoredProjectileCounts: WEAPONS.every((fixture) => {
        if (fixture.expectedProjectiles === 0) return true;
        return (byWeapon.get(fixture.id) ?? []).every(
          (capture) =>
            capture.distinctProjectileIds >= fixture.expectedProjectiles ||
            capture.vfx.filter(
              (event) =>
                event.kind === "projectile" && event.style === fixture.projectile,
            ).length >= fixture.expectedProjectiles,
        );
      }),
      authoredImpactsObserved: WEAPONS.filter((fixture) => fixture.impact !== "none").every(
        (fixture) =>
          (byWeapon.get(fixture.id) ?? []).every((capture) =>
            capture.vfx.some(
              (event) => event.kind === "impact" && event.style === fixture.impact,
            ),
          ),
      ),
      boomerangOwnSpriteReturns: (byWeapon.get("x2-boomerang-boot") ?? []).every(
        (capture) => capture.ownSpriteObserved && capture.returningObserved,
      ),
    };
    await writeFile(
      path.join(EVIDENCE_DIR, "live-gate.json"),
      `${JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          baseURL,
          assertions,
          captures,
        },
        null,
        2,
      )}\n`,
    );
    expect(assertions).toEqual({
      capturedFourteenFacings: true,
      allPortsPrivate: true,
      bothFacingsPerWeapon: true,
      everyFacingDamages: true,
      rainbowAnchoredBroadFiveStrand: true,
      authoredProjectileCounts: true,
      authoredImpactsObserved: true,
      boomerangOwnSpriteReturns: true,
    });
  });
});
