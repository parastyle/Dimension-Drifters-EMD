import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { CombatDelivery } from "@dd/shared";
import { expect, type Page, test } from "@playwright/test";
import { bootArena, runArenaSpec } from "../helpers/arena-harness.js";

const EVIDENCE_DIR = path.resolve(
  import.meta.dirname,
  "../../docs/owner-notes-audit-v11-evidence/b22-l1-reconcile",
);
const CHARACTER_ID = "proto-cowboy-hidden-face";
const FORBIDDEN_PORTS = new Set([5180, 2567]);
const FACINGS = ["right", "left"] as const;
const FIXTURES = [
  {
    id: "x2-iron-war-fan",
    subject: "vfx-tornado-iron-gale",
    audioCue: "b18:iron-gale-whoosh",
  },
  {
    id: "x2-ember-fan",
    subject: "vfx-tornado-ember-fire",
    audioCue: "b18:ember-fire-roar",
  },
  {
    id: "x2-storm-fan",
    subject: "vfx-tornado-storm-shock",
    audioCue: "b18:storm-thunder-crack",
  },
] as const;

type Facing = (typeof FACINGS)[number];

interface FanTornadoEvent {
  kind: "fan-tornado-projectile";
  weaponId: string;
  recipeKind: "fan-tornado";
  subject: string;
  textureKey: string;
  proceduralLayers: string[];
  damageMode: "server-projectile";
  displayWidth: number;
  displayHeight: number;
  damageWidth: number;
  damageHeight: number;
  velocityX: number;
  velocityY: number;
  speed: number;
  range: number;
  upright: boolean;
  rotation: number;
  flipX: boolean;
  scalePulseMin: number;
  scalePulseMax: number;
}

interface FanMotionFrame {
  weaponId: string;
  fanOutScale: number;
}

interface Contact {
  delivery: number;
  tick: number;
  weaponId: string;
  x: number;
  y: number;
  targetId: string;
}

interface ProjectileSample {
  id: string;
  weaponId: string;
  kind: string;
  tick: number;
  serverX: number;
  serverY: number;
  spawnX: number;
  spawnY: number;
  renderedX: number;
  renderedY: number;
  vx: number;
  vy: number;
  containerRotation: number;
  imageRotation: number;
  imageFlipX: boolean;
  imageFlipY: boolean;
  imageDisplayWidth: number;
  imageDisplayHeight: number;
}

interface BrowserEnemy {
  kind: string;
  x: number;
  y: number;
}

interface Target {
  id: string;
  x: number;
  y: number;
  distance: number;
}

interface BrowserImage {
  displayHeight: number;
  displayWidth: number;
  flipX: boolean;
  flipY: boolean;
  rotation: number;
}

interface BrowserContainer {
  alpha?: number;
  name?: string;
  rotation: number;
  visible?: boolean;
  x: number;
  y: number;
  getData(key: string): unknown;
}

interface BrowserArena {
  blobs: Map<
    string,
    {
      facing: number;
      weaponDef?: { id: string };
    }
  >;
  cameras: {
    main: {
      setZoom(value: number): void;
      worldView: { x: number; y: number; width: number; height: number };
    };
  };
  children: { list: BrowserContainer[] };
  combatFeedback: {
    subscribeContact(listener: (event: Contact) => void): () => void;
  };
  currentBeamAim(): { aimX: number; aimY: number; targetX: number; targetY: number };
  game: { hasFocus: boolean };
  input: { activePointer: { rightButtonDown(): boolean } };
  localAtkCd: number;
  localPredictedAttackAtMs: number;
  localPredictedAttackSeq: number;
  pointerOverInteractiveUi: boolean;
  projectiles: Map<string, BrowserContainer>;
  room: {
    sessionId: string;
    send(type: string, message?: unknown): void;
    state: {
      tick: number;
      enemies: {
        forEach(callback: (enemy: BrowserEnemy, id: string) => void): void;
      };
      players: {
        get(id: string):
          | {
              ackSeq: number;
              attackSeq: number;
              character?: string;
              weapon?: string;
              x: number;
              y: number;
            }
          | undefined;
      };
      projectiles: {
        forEach(
          callback: (
            projectile: {
              sourceWeaponId: string;
              kind: string;
              x: number;
              y: number;
              vx: number;
              vy: number;
            },
            id: string,
          ) => void,
        ): void;
      };
    };
  };
  scene: { pause(): void; resume(): void };
  sendAttack(): void;
  time: { now: number };
  verbs?: {
    isLegendOpen?(): boolean;
    releaseInputLatchIf?(force: boolean): void;
    toggleLegend?(timeMs: number): void;
  };
}

interface BrowserGlobal {
  ddGame: { scene: { getScene(key: string): BrowserArena } };
  __ddB18FanMotionAudit?: FanMotionFrame[];
  __ddB18FanOutAudit?: unknown[];
  __ddB22FanTornadoAudit?: FanTornadoEvent[];
  __ddB22FanContacts?: Contact[];
  __ddB22FanContactUnsubscribe?: () => void;
  __ddB22FanCaptureReady?: boolean;
  __ddB22FanCaptureWeapon?: string;
  __ddB22FanProjectileSamples?: ProjectileSample[];
  __ddB22FanProjectileTimer?: number;
  __ddB22FanAttackTimer?: number;
  __ddB22OriginalCurrentBeamAim?: BrowserArena["currentBeamAim"];
}

interface LiveCapture {
  weaponId: string;
  facing: Facing;
  attackSeqBefore: number;
  attackSeqAfter: number;
  event: FanTornadoEvent;
  motion: {
    minScale: number;
    maxScale: number;
    spreadRatio: number;
    frames: number;
  };
  travel: {
    projectileId: string;
    samples: number;
    serverDistance: number;
    renderedDistance: number;
    vx: number;
    vy: number;
  };
  render: {
    containerRotation: number;
    imageRotation: number;
    flipX: boolean;
    flipY: boolean;
    displayWidth: number;
    displayHeight: number;
    visibleGeneratedNames: string[];
    proceduralFanFrames: number;
  };
  screenshot: string;
}

function relativeEvidencePath(file: string): string {
  return path.relative(process.cwd(), file).replaceAll("\\", "/");
}

async function prepare(page: Page): Promise<void> {
  await page.locator("#game-root canvas").click({ position: { x: 640, y: 360 } });
  await page.evaluate((hybridDelivery) => {
    const holder = globalThis as unknown as BrowserGlobal;
    const arena = holder.ddGame.scene.getScene("arena");
    if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend?.(arena.time.now);
    arena.verbs?.releaseInputLatchIf?.(true);
    arena.game.hasFocus = true;
    arena.pointerOverInteractiveUi = false;
    arena.cameras.main.setZoom(1.55);
    arena.input.activePointer.rightButtonDown = () => false;
    holder.__ddB18FanMotionAudit = [];
    holder.__ddB18FanOutAudit = [];
    holder.__ddB22FanTornadoAudit = [];
    holder.__ddB22FanContacts = [];
    holder.__ddB22FanCaptureReady = false;
    holder.__ddB22FanCaptureWeapon = undefined;
    holder.__ddB22FanProjectileSamples = [];
    holder.__ddB22FanContactUnsubscribe?.();
    holder.__ddB22FanContactUnsubscribe = arena.combatFeedback.subscribeContact((event) => {
      if (
        event.delivery === hybridDelivery &&
        !(holder.__ddB22FanProjectileSamples ?? []).some(
          (sample) =>
            sample.weaponId === event.weaponId && Math.abs(sample.tick - event.tick) <= 2,
        )
      )
        return;
      holder.__ddB22FanContacts?.push({ ...event });
    });
    if (holder.__ddB22FanProjectileTimer)
      window.cancelAnimationFrame(holder.__ddB22FanProjectileTimer);
    const sampleProjectiles = () => {
      if (!holder.__ddB22FanCaptureReady)
        arena.room.state.projectiles.forEach((projectile, id) => {
          if (projectile.kind !== "fan:tornado") return;
          const rendered = arena.projectiles.get(id);
          const image = rendered?.getData("fanTornadoImage") as BrowserImage | undefined;
          const sample: ProjectileSample = {
            id,
            weaponId: projectile.sourceWeaponId,
            kind: projectile.kind,
            tick: arena.room.state.tick,
            serverX: projectile.x,
            serverY: projectile.y,
            spawnX: (rendered?.getData("spawnOriginX") as number | undefined) ?? projectile.x,
            spawnY: (rendered?.getData("spawnOriginY") as number | undefined) ?? projectile.y,
            renderedX: rendered?.x ?? projectile.x,
            renderedY: rendered?.y ?? projectile.y,
            vx: projectile.vx,
            vy: projectile.vy,
            containerRotation: rendered?.rotation ?? 0,
            imageRotation: image?.rotation ?? 0,
            imageFlipX: image?.flipX ?? false,
            imageFlipY: image?.flipY ?? false,
            imageDisplayWidth: image?.displayWidth ?? 0,
            imageDisplayHeight: image?.displayHeight ?? 0,
          };
          holder.__ddB22FanProjectileSamples?.push(sample);
          if (
            holder.__ddB22FanCaptureWeapon === projectile.sourceWeaponId &&
            !holder.__ddB22FanCaptureReady
          ) {
            if (
              rendered &&
              Math.hypot(sample.serverX - sample.spawnX, sample.serverY - sample.spawnY) >= 48 &&
              Math.hypot(sample.renderedX - sample.spawnX, sample.renderedY - sample.spawnY) >= 16
            ) {
              holder.__ddB22FanCaptureReady = true;
              arena.scene.pause();
            }
          }
        });
      holder.__ddB22FanProjectileTimer = window.requestAnimationFrame(sampleProjectiles);
    };
    holder.__ddB22FanProjectileTimer = window.requestAnimationFrame(sampleProjectiles);
  }, CombatDelivery.HybridProjectile);
}

async function equip(page: Page, weaponId: string): Promise<void> {
  await page.evaluate(
    ({ weaponId, characterId }) => {
      const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
      arena.room.send("devEquip", { weapon: weaponId, character: characterId });
    },
    { weaponId, characterId: CHARACTER_ID },
  );
  await expect
    .poll(
      () =>
        page.evaluate((wanted) => {
          const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
          const self = arena.room.state.players.get(arena.room.sessionId);
          return {
            authority: self?.weapon ?? null,
            rig: arena.blobs.get(arena.room.sessionId)?.weaponDef?.id ?? null,
            character: self?.character ?? null,
            wanted,
          };
        }, weaponId),
      { message: `B22 should equip ${weaponId} on ${CHARACTER_ID}`, timeout: 20_000 },
    )
    .toEqual({
      authority: weaponId,
      rig: weaponId,
      character: CHARACTER_ID,
      wanted: weaponId,
    });
}

async function commitFacing(page: Page, facing: Facing): Promise<void> {
  const canvas = page.locator("#game-root canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("B22 gate cannot locate the Phaser canvas");
  await page.mouse.move(
    box.x + box.width * (facing === "right" ? 0.86 : 0.14),
    box.y + box.height * 0.5,
  );
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
          return arena.blobs.get(arena.room.sessionId)?.facing ?? 0;
        }),
      { message: `B22 rig should commit ${facing} facing`, timeout: 10_000 },
    )
    .toBe(facing === "right" ? 1 : -1);
}

async function fireSingleAttack(page: Page, weaponId: string, facing: Facing): Promise<number> {
  return await page.evaluate(
    ({ wanted, facing }) => {
      const holder = globalThis as unknown as BrowserGlobal;
      const arena = holder.ddGame.scene.getScene("arena");
      const self = arena.room.state.players.get(arena.room.sessionId);
      if (!self || self.weapon !== wanted) throw new Error(`B22 gate lost ${wanted}`);
      holder.__ddB18FanMotionAudit = [];
      holder.__ddB18FanOutAudit = [];
      holder.__ddB22FanTornadoAudit = [];
      holder.__ddB22FanProjectileSamples = [];
      holder.__ddB22FanCaptureWeapon = wanted;
      holder.__ddB22FanCaptureReady = false;
      arena.pointerOverInteractiveUi = false;
      arena.input.activePointer.rightButtonDown = () => false;
      const facingSign = facing === "right" ? 1 : -1;
      const candidates = [-0.72, -0.48, -0.24, 0, 0.24, 0.48, 0.72].map((aimY) => ({
        aimX: facingSign * Math.sqrt(1 - aimY * aimY),
        aimY,
      }));
      const enemies: BrowserEnemy[] = [];
      arena.room.state.enemies.forEach((enemy) => {
        enemies.push(enemy);
      });
      const selected = candidates
        .map((aim) => {
          let clearance = Number.POSITIVE_INFINITY;
          for (const enemy of enemies) {
            const dx = enemy.x - self.x;
            const dy = enemy.y - self.y;
            const projection = dx * aim.aimX + dy * aim.aimY;
            if (projection <= 0 || projection >= 360) continue;
            clearance = Math.min(clearance, Math.abs(dx * -aim.aimY + dy * aim.aimX));
          }
          return { ...aim, clearance };
        })
        .sort((left, right) => right.clearance - left.clearance)[0];
      if (!selected) throw new Error("B22 gate has no forward aim candidate");
      const before = self.attackSeq;
      arena.room.send("attack", {
        aimX: selected.aimX,
        aimY: selected.aimY,
        tx: self.x + selected.aimX * 400,
        ty: self.y + selected.aimY * 400,
      });
      return before;
    },
    { wanted: weaponId, facing },
  );
}

async function stopAttack(page: Page): Promise<void> {
  await page.evaluate(() => {
    const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
    arena.input.activePointer.rightButtonDown = () => false;
  });
}

async function waitForAccepted(page: Page, before: number, weaponId: string): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
          return arena.room.state.players.get(arena.room.sessionId)?.attackSeq ?? 0;
        }),
      { message: `${weaponId} should be accepted on the private server`, timeout: 10_000 },
    )
    .toBeGreaterThan(before);
}

async function waitForTravelFrame(page: Page, weaponId: string): Promise<void> {
  let lastObservation: unknown;
  try {
    await expect
      .poll(
        () =>
          page.evaluate((wanted) => {
            const holder = globalThis as unknown as BrowserGlobal;
            const arena = holder.ddGame.scene.getScene("arena");
            const samples = (holder.__ddB22FanProjectileSamples ?? []).filter(
              (sample) => sample.weaponId === wanted,
            );
            const latest = samples.at(-1);
            const serverDistance = latest
              ? Math.hypot(latest.serverX - latest.spawnX, latest.serverY - latest.spawnY)
              : 0;
            const rendered = latest ? arena.projectiles.get(latest.id) : undefined;
            const event = (holder.__ddB22FanTornadoAudit ?? []).some(
              (candidate) => candidate.weaponId === wanted,
            );
            const ready =
              holder.__ddB22FanCaptureReady === true &&
              !!rendered &&
              event &&
              samples.length >= 1 &&
              serverDistance >= 48;
            const observation = {
              ready,
              event,
              samples: samples.length,
              serverDistance,
              rendered: !!rendered,
            };
            return observation;
          }, weaponId),
        {
          message: `${weaponId} should visibly follow its moving server tornado`,
          timeout: 4_000,
          intervals: [5, 8, 12],
        },
      )
      .toMatchObject({ ready: true, event: true, rendered: true });
  } catch (error) {
    lastObservation = await page.evaluate((wanted) => {
      const holder = globalThis as unknown as BrowserGlobal;
      const samples = (holder.__ddB22FanProjectileSamples ?? []).filter(
        (sample) => sample.weaponId === wanted,
      );
      const grouped = new Map<string, ProjectileSample[]>();
      for (const sample of samples) {
        const rows = grouped.get(sample.id) ?? [];
        rows.push(sample);
        grouped.set(sample.id, rows);
      }
      return {
        events: (holder.__ddB22FanTornadoAudit ?? []).filter((event) => event.weaponId === wanted),
        groups: [...grouped.entries()].map(([id, rows]) => {
          const first = rows[0];
          if (!first) throw new Error(`B22 diagnostics lost projectile ${id}`);
          return {
            id,
            samples: rows.length,
            serverMaxDistance: Math.max(
              ...rows.map((row) => Math.hypot(row.serverX - row.spawnX, row.serverY - row.spawnY)),
            ),
            renderedMaxDistance: Math.max(
              ...rows.map((row) =>
                Math.hypot(row.renderedX - row.spawnX, row.renderedY - row.spawnY),
              ),
            ),
            first,
            last: rows.at(-1),
          };
        }),
      };
    }, weaponId);
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}\nB22 travel diagnostics: ${JSON.stringify(lastObservation)}`,
    );
  }
}

async function captureTravelAttack(
  page: Page,
  weaponId: string,
  facing: Facing,
): Promise<number> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    const attackSeqBefore = await fireSingleAttack(page, weaponId, facing);
    await waitForAccepted(page, attackSeqBefore, weaponId);
    try {
      await waitForTravelFrame(page, weaponId);
      return attackSeqBefore;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(600);
    }
  }
  throw lastError;
}

async function damageDummy(page: Page): Promise<Target> {
  return await page.evaluate(() => {
    const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
    const self = arena.room.state.players.get(arena.room.sessionId);
    if (!self) throw new Error("B22 live gate lost its player while locating a dummy");
    const rows: Target[] = [];
    arena.room.state.enemies.forEach((enemy, id) => {
      if (enemy.kind !== "dummy") return;
      rows.push({
        id,
        x: enemy.x,
        y: enemy.y,
        distance: Math.hypot(enemy.x - self.x, enemy.y - self.y),
      });
    });
    const target = rows.sort(
      (left, right) =>
        Math.abs(left.distance - 250) - Math.abs(right.distance - 250) ||
        left.id.localeCompare(right.id),
    )[0];
    if (!target) throw new Error("B22 live gate did not receive a training dummy");
    if (target.distance < 200 || target.distance > 300)
      throw new Error(`B22 live gate has no pinned mid-range dummy (${target.distance.toFixed(1)} px)`);
    return target;
  });
}

async function beginAttacks(page: Page, targetId: string, weaponId: string): Promise<void> {
  await page.evaluate(
    ({ targetId, weaponId }) => {
      const holder = globalThis as unknown as BrowserGlobal;
      const arena = holder.ddGame.scene.getScene("arena");
      holder.__ddB22FanContacts = [];
      holder.__ddB22FanProjectileSamples = [];
      holder.__ddB22FanTornadoAudit = [];
      const originalAim = arena.currentBeamAim;
      holder.__ddB22OriginalCurrentBeamAim = originalAim;
      const targetAim = () => {
        const player = arena.room.state.players.get(arena.room.sessionId);
        let target: BrowserEnemy | undefined;
        arena.room.state.enemies.forEach((enemy, enemyId) => {
          if (enemyId === targetId) target = enemy;
        });
        if (!player || !target || player.weapon !== weaponId) return originalAim.call(arena);
        const dx = target.x - player.x;
        const dy = target.y - player.y;
        const length = Math.hypot(dx, dy) || 1;
        return {
          aimX: dx / length,
          aimY: dy / length,
          targetX: target.x,
          targetY: target.y,
        };
      };
      // The production input heartbeat updates the same authoritative aim as discrete attack messages.
      // Lock both paths to this live dummy for one isolated epoch so camera settling cannot overwrite the
      // buffered attack with a stale pointer direction.
      arena.currentBeamAim = targetAim;
      const send = () => {
        const nextAim = targetAim();
        arena.room.send("attack", {
          aimX: nextAim.aimX,
          aimY: nextAim.aimY,
          tx: nextAim.targetX,
          ty: nextAim.targetY,
        });
      };
      if (holder.__ddB22FanAttackTimer) window.clearInterval(holder.__ddB22FanAttackTimer);
      send();
      holder.__ddB22FanAttackTimer = window.setInterval(send, 100);
    },
    { targetId, weaponId },
  );
}

async function stopAttacks(page: Page): Promise<void> {
  await page.evaluate(() => {
    const holder = globalThis as unknown as BrowserGlobal;
    const arena = holder.ddGame.scene.getScene("arena");
    if (holder.__ddB22FanAttackTimer) window.clearInterval(holder.__ddB22FanAttackTimer);
    holder.__ddB22FanAttackTimer = undefined;
    if (holder.__ddB22OriginalCurrentBeamAim) {
      arena.currentBeamAim = holder.__ddB22OriginalCurrentBeamAim;
      holder.__ddB22OriginalCurrentBeamAim = undefined;
    }
  });
}

async function waitForFanDrain(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
          let fanRows = 0;
          arena.room.state.projectiles.forEach((projectile) => {
            if (projectile.kind === "fan:tornado") fanRows++;
          });
          return fanRows;
        }),
      { message: "B22 damage proof should start from a drained fan projectile epoch", timeout: 5_000 },
    )
    .toBe(0);
}

test("B22 fan tornadoes are player-height upright traveling sole VFX with moving damage", async ({
  page,
}) => {
  test.setTimeout(210_000);
  await runArenaSpec(page, async (baseURL) => {
    await mkdir(EVIDENCE_DIR, { recursive: true });
    const clientPort = Number(new URL(baseURL).port);
    expect(FORBIDDEN_PORTS.has(clientPort), "client port must be private ephemeral").toBe(false);
    await bootArena(page, baseURL, `char:${CHARACTER_ID}`);
    const gamePort = Number(new URL(page.url()).searchParams.get("port"));
    expect(Number.isInteger(gamePort) && gamePort > 0).toBe(true);
    expect(FORBIDDEN_PORTS.has(gamePort), "game port must be private ephemeral").toBe(false);
    await prepare(page);

    const captures: LiveCapture[] = [];
    for (const fixture of FIXTURES) {
      await equip(page, fixture.id);
      for (const facing of FACINGS) {
        await commitFacing(page, facing);
        const attackSeqBefore = await captureTravelAttack(page, fixture.id, facing);
        await stopAttack(page);
        const screenshotFile = path.join(EVIDENCE_DIR, `${fixture.id}-${facing}.png`);
        await page.locator("#game-root canvas").screenshot({ path: screenshotFile });
        const measured = await page.evaluate((weaponId) => {
          const holder = globalThis as unknown as BrowserGlobal;
          const arena = holder.ddGame.scene.getScene("arena");
          const self = arena.room.state.players.get(arena.room.sessionId);
          if (!self) throw new Error(`B22 capture lost ${weaponId}`);
          const event = (holder.__ddB22FanTornadoAudit ?? []).find(
            (candidate) => candidate.weaponId === weaponId,
          );
          const samples = (holder.__ddB22FanProjectileSamples ?? []).filter(
            (sample) => sample.weaponId === weaponId,
          );
          const motionFrames = (holder.__ddB18FanMotionAudit ?? []).filter(
            (frame) => frame.weaponId === weaponId,
          );
          const latest = samples.at(-1);
          if (!event || !latest) throw new Error(`B22 capture missed ${weaponId} tornado evidence`);
          const motionScales = motionFrames.map((frame) => frame.fanOutScale);
          const minScale = Math.min(...motionScales);
          const maxScale = Math.max(...motionScales);
          return {
            attackSeqAfter: self.attackSeq,
            event,
            motion: {
              minScale,
              maxScale,
              spreadRatio: maxScale / minScale,
              frames: motionFrames.length,
            },
            travel: {
              projectileId: latest.id,
              samples: samples.length,
              serverDistance: Math.hypot(
                latest.serverX - latest.spawnX,
                latest.serverY - latest.spawnY,
              ),
              renderedDistance: Math.hypot(
                latest.renderedX - latest.spawnX,
                latest.renderedY - latest.spawnY,
              ),
              vx: latest.vx,
              vy: latest.vy,
            },
            render: {
              containerRotation: latest.containerRotation,
              imageRotation: latest.imageRotation,
              flipX: latest.imageFlipX,
              flipY: latest.imageFlipY,
              displayWidth: latest.imageDisplayWidth,
              displayHeight: latest.imageDisplayHeight,
              visibleGeneratedNames: arena.children.list
                .filter(
                  (child) =>
                    child.name?.startsWith(`generated-image-vfx:${weaponId}`) &&
                    child.visible !== false &&
                    (child.alpha ?? 1) > 0.05,
                )
                .map((child) => child.name ?? ""),
              proceduralFanFrames: holder.__ddB18FanOutAudit?.length ?? 0,
            },
          };
        }, fixture.id);
        const capture: LiveCapture = {
          weaponId: fixture.id,
          facing,
          attackSeqBefore,
          ...measured,
          screenshot: relativeEvidencePath(screenshotFile),
        };
        expect(capture.event).toMatchObject({
          kind: "fan-tornado-projectile",
          weaponId: fixture.id,
          recipeKind: "fan-tornado",
          subject: fixture.subject,
          damageMode: "server-projectile",
          proceduralLayers: [],
          displayWidth: 48,
          displayHeight: 76,
          damageWidth: 48,
          damageHeight: 76,
          speed: 520,
          range: 260,
          upright: true,
          rotation: 0,
          scalePulseMin: 1,
          scalePulseMax: 1.06,
        });
        expect(capture.travel.samples).toBeGreaterThanOrEqual(1);
        expect(capture.travel.serverDistance).toBeGreaterThanOrEqual(48);
        expect(capture.travel.renderedDistance).toBeGreaterThanOrEqual(16);
        expect(Math.sign(capture.travel.vx), `${fixture.id}/${facing}/forward`).toBe(
          facing === "right" ? 1 : -1,
        );
        expect(Math.abs(capture.render.containerRotation)).toBeLessThan(1e-9);
        expect(Math.abs(capture.render.imageRotation)).toBeLessThan(1e-9);
        expect(capture.render.flipX).toBe(facing === "left");
        expect(capture.render.flipY).toBe(false);
        expect(capture.render.displayWidth).toBeGreaterThanOrEqual(48);
        expect(capture.render.displayWidth).toBeLessThanOrEqual(48 * 1.061);
        expect(capture.render.displayHeight).toBeGreaterThanOrEqual(76);
        expect(capture.render.displayHeight).toBeLessThanOrEqual(76 * 1.061);
        expect(capture.render.proceduralFanFrames).toBe(0);
        expect(capture.render.visibleGeneratedNames).toEqual([
          `generated-image-vfx:${fixture.id}:fan-tornado-projectile`,
        ]);
        captures.push(capture);
        await page.evaluate(() => {
          const holder = globalThis as unknown as BrowserGlobal;
          const arena = holder.ddGame.scene.getScene("arena");
          holder.__ddB22FanCaptureWeapon = undefined;
          holder.__ddB22FanCaptureReady = false;
          arena.scene.resume();
        });
        await page.waitForTimeout(650);
      }
    }

    const target = await damageDummy(page);
    const damageProofs: Array<{
      weaponId: string;
      contact: Contact;
      closestSample: ProjectileSample;
      pathForwardDistanceToTarget: number;
      pathLateralDistanceToTarget: number;
      tickDelta: number;
      event: FanTornadoEvent;
    }> = [];
    for (const fixture of FIXTURES) {
      await equip(page, fixture.id);
      await waitForFanDrain(page);
      await beginAttacks(page, target.id, fixture.id);
      await expect
        .poll(
          () =>
            page.evaluate(
              ({ weaponId, delivery }) =>
                (globalThis as unknown as BrowserGlobal).__ddB22FanContacts?.some(
                  (contact) => contact.weaponId === weaponId && contact.delivery === delivery,
                ) ?? false,
              { weaponId: fixture.id, delivery: CombatDelivery.HybridProjectile },
            ),
          {
            message: `${fixture.id} tornado should damage from its moving server row`,
            timeout: 15_000,
          },
        )
        .toBe(true);
      await stopAttacks(page);
      const proof = await page.evaluate(
        ({ weaponId, delivery, targetX, targetY }) => {
          const holder = globalThis as unknown as BrowserGlobal;
          const contact = (holder.__ddB22FanContacts ?? []).find(
            (candidate) => candidate.weaponId === weaponId && candidate.delivery === delivery,
          );
          const event = (holder.__ddB22FanTornadoAudit ?? []).find(
            (candidate) => candidate.weaponId === weaponId,
          );
          const samples = (holder.__ddB22FanProjectileSamples ?? []).filter(
            (sample) => sample.weaponId === weaponId,
          );
          if (!contact || !event || samples.length === 0)
            throw new Error(`B22 damage proof missed ${weaponId}`);
          const closestSample = samples
            .map((sample) => ({
              sample,
              tickDelta: Math.abs(sample.tick - contact.tick),
              ...(() => {
                const speed = Math.hypot(sample.vx, sample.vy) || 1;
                const dirX = sample.vx / speed;
                const dirY = sample.vy / speed;
                const dx = targetX - sample.serverX;
                const dy = targetY - sample.serverY;
                return {
                  forward: dx * dirX + dy * dirY,
                  lateral: Math.abs(dx * -dirY + dy * dirX),
                };
              })(),
            }))
            .sort(
              (left, right) =>
                left.tickDelta - right.tickDelta ||
                left.lateral - right.lateral ||
                Math.abs(left.forward) - Math.abs(right.forward),
            )[0];
          if (!closestSample) throw new Error(`B22 damage proof lost ${weaponId} samples`);
          return {
            weaponId,
            contact,
            closestSample: closestSample.sample,
            pathForwardDistanceToTarget: closestSample.forward,
            pathLateralDistanceToTarget: closestSample.lateral,
            tickDelta: closestSample.tickDelta,
            event,
          };
        },
        {
          weaponId: fixture.id,
          delivery: CombatDelivery.HybridProjectile,
          targetX: target.x,
          targetY: target.y,
        },
      );
      expect(proof.contact.targetId).toBe(target.id);
      expect(proof.closestSample.kind).toBe("fan:tornado");
      expect(proof.pathLateralDistanceToTarget).toBeLessThanOrEqual(72);
      expect(proof.pathForwardDistanceToTarget).toBeGreaterThanOrEqual(-72);
      expect(proof.pathForwardDistanceToTarget).toBeLessThanOrEqual(proof.event.range);
      expect(proof.tickDelta).toBeLessThanOrEqual(2);
      expect(proof.event.damageWidth).toBe(proof.event.displayWidth);
      expect(proof.event.damageHeight).toBe(proof.event.displayHeight);
      damageProofs.push(proof);
      await page.waitForTimeout(850);
    }

    const assertions = {
      sixFacingCaptures: captures.length === FIXTURES.length * FACINGS.length,
      privatePorts: !FORBIDDEN_PORTS.has(clientPort) && !FORBIDDEN_PORTS.has(gamePort),
      wholeArtCharacter: CHARACTER_ID,
      allPlayerHeight: captures.every(
        (capture) =>
          capture.event.displayHeight === 76 &&
          capture.event.damageHeight === capture.event.displayHeight,
      ),
      allUprightNonSpinning: captures.every(
        (capture) =>
          capture.event.upright &&
          capture.render.containerRotation === 0 &&
          capture.render.imageRotation === 0 &&
          !capture.render.flipY,
      ),
      bothFacingsTravelForward: captures.every(
        (capture) =>
          Math.sign(capture.travel.vx) === (capture.facing === "right" ? 1 : -1) &&
          capture.travel.serverDistance >= 48 &&
          capture.travel.renderedDistance >= 16,
      ),
      tornadoIsSoleFanVfx: captures.every(
        (capture) =>
          capture.event.proceduralLayers.length === 0 &&
          capture.render.proceduralFanFrames === 0 &&
          capture.render.visibleGeneratedNames.length === 1,
      ),
      movingDamageMatchesFunnel:
        damageProofs.length === FIXTURES.length &&
        damageProofs.every(
          (proof) =>
            proof.contact.delivery === CombatDelivery.HybridProjectile &&
            proof.pathLateralDistanceToTarget <= 72 &&
            proof.pathForwardDistanceToTarget >= -72 &&
            proof.pathForwardDistanceToTarget <= proof.event.range &&
            proof.tickDelta <= 2 &&
            proof.event.damageWidth === proof.event.displayWidth &&
            proof.event.damageHeight === proof.event.displayHeight,
        ),
    };
    expect(assertions).toEqual({
      sixFacingCaptures: true,
      privatePorts: true,
      wholeArtCharacter: CHARACTER_ID,
      allPlayerHeight: true,
      allUprightNonSpinning: true,
      bothFacingsTravelForward: true,
      tornadoIsSoleFanVfx: true,
      movingDamageMatchesFunnel: true,
    });
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
          audioCues: Object.fromEntries(FIXTURES.map((fixture) => [fixture.id, fixture.audioCue])),
          assertions,
          captures,
          damageProofs,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  });
});
