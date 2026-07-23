import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { bootArena, runArenaSpec } from "../helpers/arena-harness.js";

const EVIDENCE_DIR = path.resolve(
  import.meta.dirname,
  "../../docs/owner-notes-audit-v10-evidence/b14-kungfu",
);
const CHARACTER_ID = "proto-cowboy-hidden-face";
const FORBIDDEN_PORTS = new Set([5180, 2567]);
const FACINGS = ["right", "left"] as const;
const FIXTURES = [
  {
    id: "x2-muay-thai-wraps",
    cooldownMs: 750,
    swingStyle: "red-eight-limbs-aura",
    impactStyle: "heavy-dust-cloud",
    motions: ["elbow", "knee-strike", "roundhouse-kick"],
  },
  {
    id: "x2-wing-chun-wraps",
    cooldownMs: 200,
    swingStyle: "white-centerline-flash",
    impactStyle: "precise-white-flash",
    motions: ["chain-punch", "chain-punch", "chain-punch"],
  },
  {
    id: "x2-drunken-fist-wraps",
    cooldownMs: 500,
    swingStyle: "mist-purple-sway-sweep",
    impactStyle: "misty-purple-wide-sweep",
    motions: ["sway-jab", "weave-cross", "gourd-haymaker"],
  },
  {
    id: "x2-iron-palm-wraps",
    cooldownMs: 900,
    swingStyle: "black-iron-drive",
    impactStyle: "iron-sparks-shockwave",
    motions: ["iron-knuckle", "iron-knuckle", "iron-palm"],
  },
] as const;

type Facing = (typeof FACINGS)[number];

interface Point {
  x: number;
  y: number;
}

interface Target extends Point {
  id: string;
  distance: number;
}

interface VfxEvent extends Point {
  kind: "swing" | "impact";
  weaponId: string;
  style: string;
  timeMs: number;
  comboStep?: number;
  motion?: string;
}

interface Contact {
  weaponId: string;
  targetId: string;
  sourcePlayerId: string;
  layer: string;
  damage: number;
}

interface BrowserEnemy extends Point {
  kind: string;
}

interface BrowserPlayer extends Point {
  ackSeq: number;
  attackSeq: number;
  character?: string;
  weapon?: string;
}

interface BrowserArena {
  blobs: Map<string, { facing: number; weaponDef?: { id: string } }>;
  combatFeedback: {
    subscribeContact(listener: (event: Contact) => void): () => void;
  };
  cameras: {
    main: {
      setZoom(value: number): void;
      worldView: { x: number; y: number; width: number; height: number };
    };
  };
  game: { hasFocus: boolean };
  input: { activePointer: { rightButtonDown(): boolean } };
  pointerOverInteractiveUi: boolean;
  room: {
    sessionId: string;
    send(type: string, message?: unknown): void;
    state: {
      enemies: {
        forEach(callback: (enemy: BrowserEnemy, id: string) => void): void;
      };
      players: {
        get(id: string): BrowserPlayer | undefined;
      };
    };
  };
  scene: { pause(): void; resume(): void };
  time: { now: number };
  verbs?: {
    isLegendOpen?(): boolean;
    releaseInputLatchIf?(force: boolean): void;
    toggleLegend?(timeMs: number): void;
  };
}

interface BrowserGlobal {
  ddGame: { scene: { getScene(key: string): BrowserArena } };
  __ddB14KungFuVfxAudit?: VfxEvent[];
  __ddB14Contacts?: Contact[];
  __ddB14ContactUnsubscribe?: () => void;
}

interface Capture {
  weaponId: string;
  facing: Facing;
  target: Target;
  attackSeqBefore: number;
  attackSeqAfter: number;
  steps: number[];
  motions: string[];
  swingStyle: string;
  impactStyle: string;
  intervalsMs: number[];
  contacts: Contact[];
  vfx: VfxEvent[];
  screenshot: string;
}

function relativeEvidencePath(file: string): string {
  return path.relative(process.cwd(), file).replaceAll("\\", "/");
}

async function prepare(page: Page): Promise<void> {
  await page.locator("#game-root canvas").click({ position: { x: 450, y: 253 } });
  await page.evaluate(() => {
    const holder = globalThis as unknown as BrowserGlobal;
    const arena = holder.ddGame.scene.getScene("arena");
    if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend?.(arena.time.now);
    arena.verbs?.releaseInputLatchIf?.(true);
    arena.game.hasFocus = true;
    arena.pointerOverInteractiveUi = false;
    arena.cameras.main.setZoom(1.85);
    holder.__ddB14KungFuVfxAudit = [];
    holder.__ddB14Contacts = [];
    holder.__ddB14ContactUnsubscribe?.();
    holder.__ddB14ContactUnsubscribe = arena.combatFeedback.subscribeContact((event) => {
      if (event.sourcePlayerId === arena.room.sessionId) holder.__ddB14Contacts?.push({ ...event });
    });
  });
}

async function equip(page: Page, weaponId: string): Promise<void> {
  await page.evaluate((id) => {
    const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
    arena.room.send("devEquip", { weapon: id });
  }, weaponId);
  await expect
    .poll(
      () =>
        page.evaluate((id) => {
          const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
          const self = arena.room.state.players.get(arena.room.sessionId);
          const rig = arena.blobs.get(arena.room.sessionId);
          return { authority: self?.weapon ?? null, rig: rig?.weaponDef?.id ?? null, wanted: id };
        }, weaponId),
      { message: `B14 gate should equip ${weaponId}`, timeout: 20_000 },
    )
    .toEqual({ authority: weaponId, rig: weaponId, wanted: weaponId });
}

async function nearestDummy(page: Page, facing: Facing): Promise<Target> {
  return await page.evaluate((side) => {
    const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
    const self = arena.room.state.players.get(arena.room.sessionId);
    if (!self) throw new Error("B14 live gate lost its player while locating a dummy");
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
    const ordered = rows.sort((left, right) => left.distance - right.distance);
    const target =
      ordered.find((row) => (side === "right" ? row.x > self.x : row.x < self.x)) ?? ordered[0];
    if (!target) throw new Error(`B14 live gate did not receive a dummy for ${side} facing`);
    return target;
  }, facing);
}

async function moveToFacingSide(page: Page, target: Target, facing: Facing): Promise<Target> {
  return await page.evaluate(
    ({ target, facing }) => {
      const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
      const initial = arena.room.state.players.get(arena.room.sessionId);
      if (!initial) throw new Error("B14 close-range approach lost its player");
      let seq = initial.ackSeq >>> 0;
      const deadline = performance.now() + 8_000;
      arena.scene.pause();
      return new Promise<Target>((resolve, reject) => {
        const finish = (error?: Error) => {
          window.clearInterval(timer);
          arena.scene.resume();
          if (error) reject(error);
        };
        const timer = window.setInterval(() => {
          const self = arena.room.state.players.get(arena.room.sessionId);
          if (!self) {
            finish(new Error("B14 approach lost its player"));
            return;
          }
          // Hold just outside body-separation distance so collision resolution cannot push the attacker
          // through the dummy and invert a straight-line style's intended facing before the first beat.
          const desiredX = target.x + (facing === "right" ? -52 : 52);
          const desiredY = target.y;
          const dx = desiredX - self.x;
          const dy = desiredY - self.y;
          const remaining = Math.hypot(dx, dy);
          if (remaining <= 8) {
            seq = (seq + 1) >>> 0;
            arena.room.send("input", { seq, dx: 0, dy: 0, fireHeld: false });
            window.clearInterval(timer);
            arena.scene.resume();
            resolve({
              id: target.id,
              x: target.x,
              y: target.y,
              distance: Math.hypot(target.x - self.x, target.y - self.y),
            });
            return;
          }
          if (performance.now() >= deadline) {
            finish(new Error(`B14 approach timed out with ${remaining.toFixed(1)} px remaining`));
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
    },
    { target, facing },
  );
}

async function aimAtTarget(page: Page, facing: Facing): Promise<void> {
  const canvas = page.locator("#game-root canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("B14 live gate cannot locate the Phaser canvas");
  await page.mouse.move(
    box.x + box.width * (facing === "right" ? 0.9 : 0.1),
    box.y + box.height * 0.5,
  );
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
          return arena.blobs.get(arena.room.sessionId)?.facing ?? 0;
        }),
      { message: `B14 rig should commit ${facing} facing`, timeout: 10_000 },
    )
    .toBe(facing === "right" ? 1 : -1);
}

async function beginAttacks(page: Page): Promise<number> {
  return await page.evaluate(() => {
    const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
    const self = arena.room.state.players.get(arena.room.sessionId);
    if (!self) throw new Error("B14 live gate lost its player before attacking");
    arena.input.activePointer.rightButtonDown = () => true;
    return self.attackSeq;
  });
}

async function stopAttacks(page: Page): Promise<void> {
  await page.evaluate(() => {
    const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
    arena.input.activePointer.rightButtonDown = () => false;
  });
}

async function scheduleAttackStop(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.setTimeout(() => {
      const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
      arena.input.activePointer.rightButtonDown = () => false;
    }, 350);
  });
}

test("B14 kung-fu wraps render four distinct three-beat styles on both facings", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await runArenaSpec(page, async (baseURL) => {
    await mkdir(EVIDENCE_DIR, { recursive: true });
    await page.setViewportSize({ width: 900, height: 506 });
    const clientPort = Number(new URL(baseURL).port);
    expect(FORBIDDEN_PORTS.has(clientPort), "client port must be private ephemeral").toBe(false);
    await bootArena(page, baseURL, `char:${CHARACTER_ID}`);
    const gamePort = Number(new URL(page.url()).searchParams.get("port"));
    expect(Number.isInteger(gamePort) && gamePort > 0).toBe(true);
    expect(FORBIDDEN_PORTS.has(gamePort), "game port must be private ephemeral").toBe(false);
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
            return arena.room.state.players.get(arena.room.sessionId)?.character ?? null;
          }),
        { message: `B14 gate should use ${CHARACTER_ID}`, timeout: 20_000 },
      )
      .toBe(CHARACTER_ID);
    await prepare(page);

    const captures: Capture[] = [];
    for (const fixture of FIXTURES) {
      await equip(page, fixture.id);
      for (const facing of FACINGS) {
        const candidate = await nearestDummy(page, facing);
        const target = await moveToFacingSide(page, candidate, facing);
        expect(target.distance, `${fixture.id}/${facing}:close range`).toBeLessThanOrEqual(70);
        await aimAtTarget(page, facing);
        await page.waitForTimeout(1_300);
        await page.evaluate(() => {
          const holder = globalThis as unknown as BrowserGlobal;
          holder.__ddB14KungFuVfxAudit = [];
          holder.__ddB14Contacts = [];
        });

        const screenshotFile = path.join(EVIDENCE_DIR, `${fixture.id}-${facing}.png`);
        const attackSeqBefore = await beginAttacks(page);
        try {
          await expect
            .poll(
              () =>
                page.evaluate((weaponId) => {
                  const events =
                    (globalThis as unknown as BrowserGlobal).__ddB14KungFuVfxAudit ?? [];
                  let expectedStep = 0;
                  for (const event of events) {
                    if (event.weaponId !== weaponId || event.kind !== "swing") continue;
                    if (event.comboStep === expectedStep) expectedStep += 1;
                    else if (event.comboStep === 0) expectedStep = 1;
                    if (expectedStep === 3) return true;
                  }
                  return false;
                }, fixture.id),
              {
                message: `${fixture.id}/${facing} should render canonical combo steps 0/1/2`,
                timeout: 12_000,
                intervals: [10, 15, 25],
              },
            )
            .toBe(true);
          await scheduleAttackStop(page);
          await page.locator("#game-root canvas").screenshot({ path: screenshotFile });
        } finally {
          await stopAttacks(page);
        }
        await expect
          .poll(
            () =>
              page.evaluate((baseline) => {
                const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene(
                  "arena",
                );
                const self = arena.room.state.players.get(arena.room.sessionId);
                return (self?.attackSeq ?? baseline) - baseline;
              }, attackSeqBefore),
            {
              message: `${fixture.id}/${facing} should replicate three accepted attacks`,
              timeout: 2_000,
              intervals: [10, 15, 25],
            },
          )
          .toBeGreaterThanOrEqual(3);

        const measured = await page.evaluate(
          ({ weaponId, target, facing, attackSeqBefore }) => {
            const holder = globalThis as unknown as BrowserGlobal;
            const arena = holder.ddGame.scene.getScene("arena");
            const self = arena.room.state.players.get(arena.room.sessionId);
            if (!self) throw new Error(`B14 live capture lost ${weaponId}`);
            const vfx = (holder.__ddB14KungFuVfxAudit ?? []).filter(
              (event) => event.weaponId === weaponId,
            );
            const contacts = (holder.__ddB14Contacts ?? []).filter(
              (event) => event.weaponId === weaponId,
            );
            const swings: VfxEvent[] = [];
            for (const event of vfx) {
              if (event.kind !== "swing") continue;
              if (event.comboStep === swings.length) swings.push(event);
              else if (event.comboStep === 0) swings.splice(0, swings.length, event);
              if (swings.length === 3) break;
            }
            return {
              weaponId,
              facing,
              target,
              attackSeqBefore,
              attackSeqAfter: self.attackSeq,
              steps: swings.map((event) => event.comboStep ?? -1),
              motions: swings.map((event) => event.motion ?? ""),
              swingStyle: swings[0]?.style ?? "",
              impactStyle: vfx.find((event) => event.kind === "impact")?.style ?? "",
              intervalsMs: swings
                .slice(1)
                .map((event, index) => event.timeMs - (swings[index]?.timeMs ?? event.timeMs)),
              contacts,
              vfx,
            };
          },
          { weaponId: fixture.id, target, facing, attackSeqBefore },
        );
        const capture: Capture = {
          ...measured,
          screenshot: relativeEvidencePath(screenshotFile),
        };
        expect(capture.attackSeqAfter - capture.attackSeqBefore).toBeGreaterThanOrEqual(3);
        expect(capture.steps).toEqual([0, 1, 2]);
        expect(capture.motions).toEqual(fixture.motions);
        expect(capture.swingStyle).toBe(fixture.swingStyle);
        if (capture.impactStyle) expect(capture.impactStyle).toBe(fixture.impactStyle);
        expect(capture.intervalsMs).toHaveLength(2);
        for (const interval of capture.intervalsMs) {
          expect(
            Math.abs(interval - fixture.cooldownMs),
            `${fixture.id}/${facing}: observed cadence ${interval}ms`,
          ).toBeLessThanOrEqual(175);
        }
        captures.push(capture);
      }
    }

    const observedCadenceMs = Object.fromEntries(
      FIXTURES.map((fixture) => {
        const intervals = captures
          .filter((capture) => capture.weaponId === fixture.id)
          .flatMap((capture) => capture.intervalsMs);
        return [
          fixture.id,
          intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length,
        ];
      }),
    );
    const assertions = {
      eightFacingCaptures: captures.length === FIXTURES.length * FACINGS.length,
      fourDistinctSwingStyles: new Set(captures.map((capture) => capture.swingStyle)).size === 4,
      fourDistinctImpactStyles:
        new Set(
          captures
            .map((capture) => capture.impactStyle)
            .filter((style): style is string => style.length > 0),
        ).size === 4,
      allWeaponsConfirmedContact: FIXTURES.every((fixture) =>
        captures.some((capture) => capture.weaponId === fixture.id && capture.contacts.length > 0),
      ),
      exactComboSignatures: captures.every((capture) => {
        const fixture = FIXTURES.find((row) => row.id === capture.weaponId);
        return (
          !!fixture &&
          capture.steps.join(",") === "0,1,2" &&
          capture.motions.join(",") === fixture.motions.join(",")
        );
      }),
      cadenceOrder:
        observedCadenceMs["x2-wing-chun-wraps"] < observedCadenceMs["x2-drunken-fist-wraps"] &&
        observedCadenceMs["x2-drunken-fist-wraps"] < observedCadenceMs["x2-muay-thai-wraps"] &&
        observedCadenceMs["x2-muay-thai-wraps"] < observedCadenceMs["x2-iron-palm-wraps"],
      privatePorts: !FORBIDDEN_PORTS.has(clientPort) && !FORBIDDEN_PORTS.has(gamePort),
      wholeArtCharacter: CHARACTER_ID,
    };
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
          nominalCooldownMs: Object.fromEntries(
            FIXTURES.map((fixture) => [fixture.id, fixture.cooldownMs]),
          ),
          observedCadenceMs,
          assertions,
          captures,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    expect(assertions).toEqual({
      eightFacingCaptures: true,
      fourDistinctSwingStyles: true,
      fourDistinctImpactStyles: true,
      allWeaponsConfirmedContact: true,
      exactComboSignatures: true,
      cadenceOrder: true,
      privatePorts: true,
      wholeArtCharacter: CHARACTER_ID,
    });
  });
});
