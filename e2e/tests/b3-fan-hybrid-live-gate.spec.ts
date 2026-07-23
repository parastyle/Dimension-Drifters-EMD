import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { CombatDelivery } from "@dd/shared";
import { expect, type Page, test } from "@playwright/test";
import { bootArena, runArenaSpec, waitForDevWeapon } from "../helpers/arena-harness.js";

const EVIDENCE_DIR = path.resolve(
  import.meta.dirname,
  "../../docs/owner-notes-audit-v10-evidence/b3-fan-hybrids",
);
const FORBIDDEN_PORTS = new Set([5180, 2567]);
const FIXTURES = [
  {
    id: "x2-iron-war-fan",
    acceptedBeats: 3,
    projectileStyle: "iron-gust",
    impactStyle: "iron-gust-fray",
    signature: "third accepted close cut -> narrow cutting gust",
  },
  {
    id: "x2-ember-fan",
    acceptedBeats: 1,
    projectileStyle: "ember-shard-trail",
    impactStyle: "ember-chip-burst",
    signature: "accepted close sweep -> three-shard cinder cone",
  },
  {
    id: "x2-storm-fan",
    acceptedBeats: 1,
    projectileStyle: "storm-returning-arc",
    impactStyle: "storm-arc-fold",
    signature: "accepted crossed-fan strike -> returning storm arc",
  },
] as const;

interface Point {
  x: number;
  y: number;
}

interface Target extends Point {
  id: string;
  distance: number;
}

interface Contact extends Point {
  layer: string;
  targetId: string;
  sourcePlayerId: string;
  weaponId: string;
  delivery: number;
  damage: number;
  tick: number;
  finalBlow: boolean;
}

interface VfxEvent extends Point {
  kind: "projectile" | "impact";
  weaponId: string;
  style: string;
}

interface ProjectileSample extends Point {
  id: string;
  weaponId: string;
  kind: string;
  vx: number;
  vy: number;
  tick: number;
}

interface BrowserEnemy extends Point {
  kind: string;
}

interface BrowserArena {
  combatFeedback: {
    subscribeContact(listener: (event: Contact) => void): () => void;
  };
  cameras: {
    main: {
      worldView: { x: number; y: number; width: number; height: number };
    };
  };
  game: { hasFocus: boolean };
  pointerOverInteractiveUi: boolean;
  room: {
    sessionId: string;
    send(type: string, message?: unknown): void;
    state: {
      tick: number;
      enemies: {
        forEach(callback: (enemy: BrowserEnemy, id: string) => void): void;
      };
      players: {
        get(
          id: string,
        ):
          | {
              ackSeq: number;
              attackSeq: number;
              weapon: string;
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
  time: { now: number };
  verbs?: {
    isLegendOpen?(): boolean;
    releaseInputLatchIf?(force: boolean): void;
    toggleLegend?(timeMs: number): void;
  };
}

interface BrowserGlobal {
  ddGame: { scene: { getScene(key: string): BrowserArena } };
  __ddB3FanHybridVfxAudit?: VfxEvent[];
  __ddB3FanContacts?: Contact[];
  __ddB3FanProjectileSamples?: ProjectileSample[];
  __ddB3FanContactUnsubscribe?: () => void;
  __ddB3FanProjectileTimer?: number;
  __ddB3FanAttackTimer?: number;
}

interface LiveCapture {
  weaponId: string;
  signature: string;
  clientPort: number;
  gamePort: number;
  target: Target;
  attackSeqBefore: number;
  attackSeqAfter: number;
  acceptedBeats: number;
  contacts: Contact[];
  meleeContacts: Contact[];
  projectileContacts: Contact[];
  meleeDamage: number;
  projectileDamage: number;
  meleeBeforeProjectile: boolean;
  sameTarget: boolean;
  pairedTickGap: number;
  projectileSamples: ProjectileSample[];
  returningObserved: boolean;
  vfx: VfxEvent[];
  screenshot: string;
}

function relativeEvidencePath(file: string): string {
  return path.relative(process.cwd(), file).replaceAll("\\", "/");
}

async function prepare(page: Page): Promise<void> {
  await page.locator("#game-root canvas").click({ position: { x: 320, y: 180 } });
  await page.evaluate(() => {
    const holder = globalThis as unknown as BrowserGlobal;
    const arena = holder.ddGame.scene.getScene("arena");
    if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend?.(arena.time.now);
    arena.verbs?.releaseInputLatchIf?.(true);
    arena.game.hasFocus = true;
    arena.pointerOverInteractiveUi = false;
    holder.__ddB3FanHybridVfxAudit = [];
    holder.__ddB3FanContacts = [];
    holder.__ddB3FanProjectileSamples = [];
    holder.__ddB3FanContactUnsubscribe?.();
    holder.__ddB3FanContactUnsubscribe = arena.combatFeedback.subscribeContact((event) => {
      if (
        event.sourcePlayerId === arena.room.sessionId &&
        event.damage > 0 &&
        event.layer !== "instant"
      )
        holder.__ddB3FanContacts?.push({ ...event });
    });
    if (holder.__ddB3FanProjectileTimer)
      window.clearInterval(holder.__ddB3FanProjectileTimer);
    holder.__ddB3FanProjectileTimer = window.setInterval(() => {
      arena.room.state.projectiles.forEach((projectile, id) => {
        if (!projectile.sourceWeaponId.startsWith("x2-")) return;
        holder.__ddB3FanProjectileSamples?.push({
          id,
          weaponId: projectile.sourceWeaponId,
          kind: projectile.kind,
          x: projectile.x,
          y: projectile.y,
          vx: projectile.vx,
          vy: projectile.vy,
          tick: arena.room.state.tick,
        });
      });
    }, 10);
  });
}

async function nearestDummy(page: Page): Promise<Target> {
  return await page.evaluate(() => {
    const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
    const self = arena.room.state.players.get(arena.room.sessionId);
    if (!self) throw new Error("B3 live gate lost its player while locating a dummy");
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
    const target = rows.sort((left, right) => left.distance - right.distance)[0];
    if (!target) throw new Error("B3 live gate did not receive a planted training dummy");
    return target;
  });
}

async function moveIntoCloseRange(page: Page, targetId: string): Promise<Target> {
  return await page.evaluate((id) => {
    const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
    const initial = arena.room.state.players.get(arena.room.sessionId);
    if (!initial) throw new Error("B3 close-range approach lost its player");
    let seq = initial.ackSeq >>> 0;
    const deadline = performance.now() + 8_000;
    return new Promise<Target>((resolve, reject) => {
      const timer = window.setInterval(() => {
        const self = arena.room.state.players.get(arena.room.sessionId);
        let target: BrowserEnemy | undefined;
        arena.room.state.enemies.forEach((enemy, enemyId) => {
          if (enemyId === id) target = enemy;
        });
        if (!self || !target) {
          window.clearInterval(timer);
          reject(new Error("B3 close-range approach lost its player or dummy"));
          return;
        }
        const fromTargetX = self.x - target.x;
        const fromTargetY = self.y - target.y;
        const fromTargetLength = Math.hypot(fromTargetX, fromTargetY) || 1;
        const desiredX = target.x + (fromTargetX / fromTargetLength) * 72;
        const desiredY = target.y + (fromTargetY / fromTargetLength) * 72;
        const dx = desiredX - self.x;
        const dy = desiredY - self.y;
        const remaining = Math.hypot(dx, dy);
        const targetDistance = Math.hypot(target.x - self.x, target.y - self.y);
        if (remaining <= 6 || targetDistance <= 110) {
          seq = (seq + 1) >>> 0;
          arena.room.send("input", { seq, dx: 0, dy: 0, fireHeld: false });
          window.clearInterval(timer);
          resolve({
            id,
            x: target.x,
            y: target.y,
            distance: targetDistance,
          });
          return;
        }
        if (performance.now() >= deadline) {
          window.clearInterval(timer);
          reject(new Error(`B3 approach timed out with ${remaining.toFixed(1)} px remaining`));
          return;
        }
        const length = remaining || 1;
        seq = (seq + 1) >>> 0;
        arena.room.send("input", {
          seq,
          dx: dx / length,
          dy: dy / length,
          fireHeld: false,
        });
      }, 55);
    });
  }, targetId);
}

async function aimAtTarget(page: Page, target: Target): Promise<void> {
  const canvas = page.locator("#game-root canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("B3 live gate cannot locate the Phaser canvas");
  const normalized = await page.evaluate(({ x, y }) => {
    const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
    const view = arena.cameras.main.worldView;
    return { x: (x - view.x) / view.width, y: (y - view.y) / view.height };
  }, target);
  await page.mouse.move(
    box.x + box.width * Math.max(0.03, Math.min(0.97, normalized.x)),
    box.y + box.height * Math.max(0.03, Math.min(0.97, normalized.y)),
  );
}

async function beginAttacks(page: Page, targetId: string): Promise<number> {
  return await page.evaluate((id) => {
    const holder = globalThis as unknown as BrowserGlobal;
    const arena = holder.ddGame.scene.getScene("arena");
    const self = arena.room.state.players.get(arena.room.sessionId);
    if (!self) throw new Error("B3 live gate lost its player before attacking");
    const send = () => {
      const player = arena.room.state.players.get(arena.room.sessionId);
      let target: BrowserEnemy | undefined;
      arena.room.state.enemies.forEach((enemy, enemyId) => {
        if (enemyId === id) target = enemy;
      });
      if (!player || !target) return;
      const dx = target.x - player.x;
      const dy = target.y - player.y;
      const length = Math.hypot(dx, dy) || 1;
      arena.room.send("attack", {
        aimX: dx / length,
        aimY: dy / length,
        tx: target.x,
        ty: target.y,
      });
    };
    if (holder.__ddB3FanAttackTimer) window.clearInterval(holder.__ddB3FanAttackTimer);
    send();
    holder.__ddB3FanAttackTimer = window.setInterval(send, 100);
    return self.attackSeq;
  }, targetId);
}

async function stopAttacks(page: Page): Promise<void> {
  await page.evaluate(() => {
    const holder = globalThis as unknown as BrowserGlobal;
    if (holder.__ddB3FanAttackTimer) window.clearInterval(holder.__ddB3FanAttackTimer);
    holder.__ddB3FanAttackTimer = undefined;
  });
}

async function returningObserved(page: Page, weaponId: string): Promise<boolean> {
  return await page.evaluate((id) => {
    const samples = (globalThis as unknown as BrowserGlobal).__ddB3FanProjectileSamples ?? [];
    const grouped = new Map<string, ProjectileSample[]>();
    for (const sample of samples) {
      if (sample.weaponId !== id) continue;
      const rows = grouped.get(sample.id) ?? [];
      rows.push(sample);
      grouped.set(sample.id, rows);
    }
    return [...grouped.values()].some((rows) => {
      const first = rows[0];
      return !!first && rows.some((sample) => first.vx * sample.vx + first.vy * sample.vy < 0);
    });
  }, weaponId);
}

test("B3 fans prove close melee and a separate authoritative projectile on one accepted beat", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await runArenaSpec(page, async (baseURL) => {
    await mkdir(EVIDENCE_DIR, { recursive: true });
    await page.setViewportSize({ width: 900, height: 506 });
    const clientPort = Number(new URL(baseURL).port);
    expect(FORBIDDEN_PORTS.has(clientPort), "client port must be private ephemeral").toBe(false);
    const captures: LiveCapture[] = [];

    for (const fixture of FIXTURES) {
      await bootArena(page, baseURL, `weapon:${fixture.id}`);
      await waitForDevWeapon(page, fixture.id);
      const gamePort = Number(new URL(page.url()).searchParams.get("port"));
      expect(Number.isInteger(gamePort) && gamePort > 0, "redirect should expose game port").toBe(
        true,
      );
      expect(FORBIDDEN_PORTS.has(gamePort), "game port must be private ephemeral").toBe(false);
      await prepare(page);
      const initialTarget = await nearestDummy(page);
      const target = await moveIntoCloseRange(page, initialTarget.id);
      expect(target.distance).toBeGreaterThanOrEqual(35);
      expect(target.distance).toBeLessThanOrEqual(110);
      await aimAtTarget(page, target);

      const attackSeqBefore = await beginAttacks(page, target.id);
      try {
        await expect
          .poll(
            () =>
              page.evaluate(() => {
                const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
                return (
                  arena.room.state.players.get(arena.room.sessionId)?.attackSeq ??
                  Number.NEGATIVE_INFINITY
                );
              }),
            {
              message: `${fixture.id} should accept ${fixture.acceptedBeats} authored beat(s)`,
              timeout: 15_000,
            },
          )
          .toBeGreaterThanOrEqual(attackSeqBefore + fixture.acceptedBeats);
      } finally {
        await stopAttacks(page);
      }

      await expect
        .poll(
          () =>
            page.evaluate(
              ({ weaponId, targetId, meleeDelivery, projectileDelivery }) => {
                const contacts = (globalThis as unknown as BrowserGlobal).__ddB3FanContacts ?? [];
                return {
                  melee: contacts.some(
                    (event) =>
                      event.weaponId === weaponId &&
                      event.targetId === targetId &&
                      event.delivery === meleeDelivery,
                  ),
                  projectile: contacts.some(
                    (event) =>
                      event.weaponId === weaponId &&
                      event.targetId === targetId &&
                      event.delivery === projectileDelivery,
                  ),
                };
              },
              {
                weaponId: fixture.id,
                targetId: target.id,
                meleeDelivery: CombatDelivery.Melee,
                projectileDelivery: CombatDelivery.HybridProjectile,
              },
            ),
          {
            message: `${fixture.id} should damage one dummy through melee and hybrid authority`,
            timeout: 12_000,
          },
        )
        .toEqual({ melee: true, projectile: true });

      await expect
        .poll(
          () =>
            page.evaluate(
              ({ weaponId, projectileStyle, impactStyle }) => {
                const events =
                  (globalThis as unknown as BrowserGlobal).__ddB3FanHybridVfxAudit ?? [];
                return {
                  projectile: events.some(
                    (event) =>
                      event.weaponId === weaponId && event.style === projectileStyle,
                  ),
                  impact: events.some(
                    (event) => event.weaponId === weaponId && event.style === impactStyle,
                  ),
                };
              },
              {
                weaponId: fixture.id,
                projectileStyle: fixture.projectileStyle,
                impactStyle: fixture.impactStyle,
              },
            ),
          { message: `${fixture.id} should render its distinct projectile and impact`, timeout: 8_000 },
        )
        .toEqual({ projectile: true, impact: true });

      if (fixture.id === "x2-storm-fan")
        await expect
          .poll(() => returningObserved(page, fixture.id), {
            message: "Storm Fan should reverse its authoritative arc toward the player",
            timeout: 8_000,
          })
          .toBe(true);

      const screenshot = path.join(EVIDENCE_DIR, `${fixture.id}-hybrid-proof.png`);
      await page.locator("#game-root canvas").screenshot({ path: screenshot });
      const capture = await page.evaluate(
        ({
          fixture,
          target,
          clientPort,
          gamePort,
          screenshot,
          attackSeqBefore,
          meleeDelivery,
          projectileDelivery,
        }) => {
          const holder = globalThis as unknown as BrowserGlobal;
          const arena = holder.ddGame.scene.getScene("arena");
          const self = arena.room.state.players.get(arena.room.sessionId);
          if (!self) throw new Error(`B3 live capture lost ${fixture.id}`);
          const contacts = (holder.__ddB3FanContacts ?? []).filter(
            (event) => event.weaponId === fixture.id,
          );
          const meleeContacts = contacts.filter(
            (event) =>
              event.targetId === target.id && event.delivery === meleeDelivery,
          );
          const projectileContacts = contacts.filter(
            (event) =>
              event.targetId === target.id &&
              event.delivery === projectileDelivery,
          );
          const firstProjectileIndex = contacts.findIndex(
            (event) =>
              event.targetId === target.id &&
              event.delivery === projectileDelivery,
          );
          let pairedMeleeIndex = -1;
          for (let index = 0; index < firstProjectileIndex; index++) {
            const event = contacts[index];
            if (
              event?.targetId === target.id &&
              event.delivery === meleeDelivery
            )
              pairedMeleeIndex = index;
          }
          const pairedMelee =
            pairedMeleeIndex >= 0 ? contacts[pairedMeleeIndex] : undefined;
          const pairedProjectile =
            firstProjectileIndex >= 0 ? contacts[firstProjectileIndex] : undefined;
          const projectileSamples = (holder.__ddB3FanProjectileSamples ?? []).filter(
            (sample) => sample.weaponId === fixture.id,
          );
          const grouped = new Map<string, ProjectileSample[]>();
          for (const sample of projectileSamples) {
            const rows = grouped.get(sample.id) ?? [];
            rows.push(sample);
            grouped.set(sample.id, rows);
          }
          const returning = [...grouped.values()].some((rows) => {
            const first = rows[0];
            return (
              !!first &&
              rows.some((sample) => first.vx * sample.vx + first.vy * sample.vy < 0)
            );
          });
          return {
            weaponId: fixture.id,
            signature: fixture.signature,
            clientPort,
            gamePort,
            target,
            attackSeqBefore,
            attackSeqAfter: self.attackSeq,
            acceptedBeats: self.attackSeq - attackSeqBefore,
            contacts,
            meleeContacts,
            projectileContacts,
            meleeDamage: meleeContacts.reduce((sum, event) => sum + event.damage, 0),
            projectileDamage: projectileContacts.reduce(
              (sum, event) => sum + event.damage,
              0,
            ),
            meleeBeforeProjectile:
              pairedMeleeIndex >= 0 && pairedMeleeIndex < firstProjectileIndex,
            sameTarget:
              !!pairedMelee &&
              !!pairedProjectile &&
              pairedMelee.targetId === pairedProjectile.targetId,
            pairedTickGap:
              pairedMelee && pairedProjectile
                ? pairedProjectile.tick - pairedMelee.tick
                : Number.POSITIVE_INFINITY,
            projectileSamples,
            returningObserved: returning,
            vfx: (holder.__ddB3FanHybridVfxAudit ?? []).filter(
              (event) => event.weaponId === fixture.id,
            ),
            screenshot,
          };
        },
        {
          fixture,
          target,
          clientPort,
          gamePort,
          screenshot: relativeEvidencePath(screenshot),
          attackSeqBefore,
          meleeDelivery: CombatDelivery.Melee,
          projectileDelivery: CombatDelivery.HybridProjectile,
        },
      );
      expect(capture.acceptedBeats).toBeGreaterThanOrEqual(fixture.acceptedBeats);
      expect(capture.meleeContacts.length).toBeGreaterThanOrEqual(fixture.acceptedBeats);
      expect(capture.projectileContacts.length).toBeGreaterThan(0);
      expect(capture.meleeDamage).toBeGreaterThan(0);
      expect(capture.projectileDamage).toBeGreaterThan(0);
      expect(capture.meleeBeforeProjectile).toBe(true);
      expect(capture.sameTarget).toBe(true);
      expect(capture.pairedTickGap).toBeGreaterThanOrEqual(0);
      expect(capture.pairedTickGap).toBeLessThanOrEqual(8);
      captures.push(capture);
    }

    const signatures = new Set(captures.map((capture) => capture.signature));
    const assertions = {
      threeFansCaptured: captures.length === 3,
      allPortsPrivate: captures.every(
        (capture) =>
          !FORBIDDEN_PORTS.has(capture.clientPort) &&
          !FORBIDDEN_PORTS.has(capture.gamePort),
      ),
      threeDistinctSignatures: signatures.size === 3,
      eachHasMeleeAndProjectile: captures.every(
        (capture) =>
          capture.meleeDamage > 0 &&
          capture.projectileDamage > 0 &&
          capture.meleeBeforeProjectile,
      ),
      sameEnemySameBeat: captures.every(
        (capture) => capture.sameTarget && capture.pairedTickGap >= 0 && capture.pairedTickGap <= 8,
      ),
      stormReturned:
        captures.find((capture) => capture.weaponId === "x2-storm-fan")
          ?.returningObserved === true,
    };
    await writeFile(
      path.join(EVIDENCE_DIR, "live-gate.json"),
      `${JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          baseURL,
          deliveryCodes: {
            melee: CombatDelivery.Melee,
            authoritativeHybridProjectile: CombatDelivery.HybridProjectile,
          },
          assertions,
          captures,
        },
        null,
        2,
      )}\n`,
    );
    expect(assertions).toEqual({
      threeFansCaptured: true,
      allPortsPrivate: true,
      threeDistinctSignatures: true,
      eachHasMeleeAndProjectile: true,
      sameEnemySameBeat: true,
      stormReturned: true,
    });
  });
});
