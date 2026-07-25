import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { WEAPONS } from "@dd/shared";
import { expect, type Page, test } from "@playwright/test";
import { bootArena, runArenaSpec, waitForDevWeapon } from "../helpers/arena-harness.js";

const EVIDENCE_DIR = path.resolve("docs/owner-notes-audit-v12-evidence/b49-melee-thrown");
const CHARACTER_ID = "proto-cowboy-hidden-face";
const FORBIDDEN_PORTS = new Set([5180, 2567]);
const FACINGS = ["right", "left"] as const;
const ORDER_IDS = [
  "x2-hailshard-resonator",
  "gravediggers-spade",
  "x2-cinderbrand-cleaver",
  "x2-brimstone-doubleheader",
  "x2-hollowmoon-reaver",
  "x2-frostfang-rakes",
  "x2-gallows-splitter",
  "x2-saloon-tomahawk",
  "x2-reverent-broadsword",
  "x2-emberfist-wraps",
  "x2-void-throwing-star",
  "x2-frostknuckle-rimewrap",
  "x2-cinderpalm-brand-glove",
] as const;
const LIVE_ORDER_IDS = process.env.B49_LIVE_WEAPON
  ? ORDER_IDS.filter((weaponId) => weaponId === process.env.B49_LIVE_WEAPON)
  : [
      // Capture the projectile lane at the untouched training spawn; the later
      // cadence gates deliberately walk beside permanent gallery dummies.
      "x2-void-throwing-star",
      ...ORDER_IDS.filter((weaponId) => weaponId !== "x2-void-throwing-star"),
    ];
const HELD_IDS = new Set<string>(["x2-hailshard-resonator", "x2-brimstone-doubleheader"]);
const CAPTURE_DELAY_MS: Readonly<Record<string, number>> = {
  "x2-hailshard-resonator": 650,
  "gravediggers-spade": 590,
  "x2-cinderbrand-cleaver": 240,
  "x2-brimstone-doubleheader": 650,
  "x2-hollowmoon-reaver": 260,
  "x2-frostfang-rakes": 180,
  "x2-gallows-splitter": 180,
  "x2-saloon-tomahawk": 160,
  "x2-reverent-broadsword": 300,
  "x2-emberfist-wraps": 160,
  "x2-void-throwing-star": 390,
  "x2-frostknuckle-rimewrap": 180,
  "x2-cinderpalm-brand-glove": 180,
};

type Facing = (typeof FACINGS)[number];
type OrderId = (typeof ORDER_IDS)[number];

interface Point {
  x: number;
  y: number;
}

interface LiveSample {
  atMs: number;
  attackSeq: number;
  activeDamageNumbers: number;
  facing: number;
  orbitT: number;
  performance: {
    active: boolean;
    backHandBlend: number;
    backHandX: number;
    backHandY: number;
    handX: number;
    handY: number;
    wholeBodyRotation: number;
  };
  player: Point;
  projectiles: Array<{
    bornTick: number;
    id: string;
    kind: string;
    part: number;
    rendered: Point | null;
    spawnAnchorKind: string;
    spawnOrigin: Point | null;
    state: Point;
    velocity: Point;
  }>;
  rootRotation: number;
  visibleDamageLabels: Array<{ text: string; x: number; y: number }>;
  weaponPieces: Array<{
    displayHeight: number;
    displayWidth: number;
    rotation: number;
    visible: boolean;
    x: number;
    y: number;
  }>;
}

interface CasterAnchorEvent {
  hand0Distance: number;
  hand1Distance: number;
  rootDistance: number;
  weaponId: string;
  x: number;
  y: number;
}

interface LiveCapture {
  attackSeqAfter: number;
  attackSeqBefore: number;
  casterAnchors: CasterAnchorEvent[];
  cadenceScreenshot?: string;
  definition: Record<string, any>;
  facing: Facing;
  finalPlayer: Point;
  maxDisplacementPx: number;
  maxVisibleDamageNumbers: number;
  receiptSeqBefore: number;
  receipts: Array<{
    damage: number;
    seq: number;
    targetId: string;
    weaponId: string;
  }>;
  samples: LiveSample[];
  screenshot: string;
  targetId: string | null;
  weaponId: OrderId;
}

function relative(file: string): string {
  return path.relative(process.cwd(), file).replaceAll("\\", "/");
}

function facingSign(facing: Facing): number {
  return facing === "right" ? 1 : -1;
}

async function installProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const holder = globalThis as any;
    const arena = holder.ddGame.scene.getScene("arena");
    if (holder.__b49ProbeInstalled) return;
    holder.__b49ProbeInstalled = true;
    holder.__b49CasterAnchors = [];
    const originalCasterSource = arena.spawnCasterSource.bind(arena);
    arena.spawnCasterSource = (weapon: any, x: number, y: number, angle: number) => {
      const rig = arena.blobs.get(arena.room.sessionId);
      const hand0 = rig?.handWorldAnchor(0);
      const hand1 = rig?.handWorldAnchor(1);
      holder.__b49CasterAnchors.push({
        weaponId: weapon.id,
        x,
        y,
        hand0Distance: hand0 ? Math.hypot(x - hand0.x, y - hand0.y) : Number.NaN,
        hand1Distance: hand1 ? Math.hypot(x - hand1.x, y - hand1.y) : Number.NaN,
        rootDistance: rig ? Math.hypot(x - rig.x, y - rig.y) : Number.NaN,
      });
      return originalCasterSource(weapon, x, y, angle);
    };
  });
}

async function prepareArenaInput(page: Page): Promise<void> {
  const canvas = page.locator("#game-root canvas");
  await canvas.click({ position: { x: 480, y: 270 } });
  await page.evaluate(() => {
    const arena = (globalThis as any).ddGame.scene.getScene("arena");
    if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend?.(arena.time.now);
    arena.verbs?.releaseInputLatchIf?.(true);
    arena.scene.resume();
    arena.game.hasFocus = true;
    arena.pointerOverInteractiveUi = false;
    arena.localAtkCd = 0;
    arena.localPredictedAttackAtMs = -1e9;
    arena.input.activePointer.rightButtonDown = () => false;
  });
}

async function equip(page: Page, weaponId: OrderId): Promise<void> {
  await page.evaluate(
    ({ character, weapon }) => {
      const holder = globalThis as any;
      const arena = holder.ddGame.scene.getScene("arena");
      if (holder.__b49HeldTimer) window.clearInterval(holder.__b49HeldTimer);
      holder.__b49HeldTimer = undefined;
      arena.input.activePointer.rightButtonDown = () => false;
      arena.stepNetInput?.(50, false, false, 0, 0);
      arena.room.send("debugSetFireInputHeld", { held: false });
      arena.room.send("devEquip", { character, weapon });
    },
    { character: CHARACTER_ID, weapon: weaponId },
  );
  await waitForDevWeapon(page, weaponId);
  await expect
    .poll(
      () =>
        page.evaluate((wanted) => {
          const arena = (globalThis as any).ddGame.scene.getScene("arena");
          return arena.blobs.get(arena.room.sessionId)?.weaponDef?.id === wanted;
        }, weaponId),
      { message: `${weaponId}: rendered rig should equip`, timeout: 15_000 },
    )
    .toBe(true);
  await page.waitForTimeout(280);
}

async function commitFacing(page: Page, weaponId: OrderId, facing: Facing): Promise<void> {
  const canvas = page.locator("#game-root canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("B49 could not locate the live Phaser canvas");
  await page.mouse.move(
    box.x + box.width * (facing === "right" ? 0.88 : 0.12),
    box.y + box.height * 0.5,
  );
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const arena = (globalThis as any).ddGame.scene.getScene("arena");
          const rig = arena.blobs.get(arena.room.sessionId);
          return { facing: rig?.facing, blend: rig?.facingBlend };
        }),
      { message: `${weaponId}/${facing}: facing should settle`, timeout: 10_000 },
    )
    .toMatchObject({ facing: facingSign(facing), blend: expect.any(Number) });
  await expect
    .poll(
      () =>
        page.evaluate((wanted) => {
          const arena = (globalThis as any).ddGame.scene.getScene("arena");
          return Math.abs((arena.blobs.get(arena.room.sessionId)?.facingBlend ?? 0) - wanted);
        }, facingSign(facing)),
      { timeout: 10_000 },
    )
    .toBeLessThan(0.02);
}

/** Walk beside a harmless, permanent training dummy so cadence receipts have a stable target. */
async function moveBesideDummy(
  page: Page,
  facing: Facing,
): Promise<{ id: string; x: number; y: number }> {
  const target = await page.evaluate((direction) => {
    const arena = (globalThis as any).ddGame.scene.getScene("arena");
    const initial = arena.room.state.players.get(arena.room.sessionId);
    if (!initial) throw new Error("B49 dummy approach lost its player");
    const dummies: Array<{ id: string; x: number; y: number; distance: number }> = [];
    arena.room.state.enemies.forEach((enemy: any, id: string) => {
      if (enemy.kind !== "dummy") return;
      dummies.push({
        id,
        x: enemy.x,
        y: enemy.y,
        distance: Math.hypot(enemy.x - initial.x, enemy.y - initial.y),
      });
    });
    const facingSide = dummies.filter((dummy) =>
      direction > 0 ? dummy.x > initial.x : dummy.x < initial.x,
    );
    const chosen = (facingSide.length > 0 ? facingSide : dummies).sort(
      (a, b) => a.distance - b.distance,
    )[0];
    if (!chosen) throw new Error("B49 Testing Grounds did not contain a dummy");
    let seq = initial.ackSeq >>> 0;
    const deadline = performance.now() + 9_000;
    arena.scene.pause();
    return new Promise<{ id: string; x: number; y: number }>((resolve, reject) => {
      const timer = window.setInterval(() => {
        const self = arena.room.state.players.get(arena.room.sessionId);
        if (!self) {
          window.clearInterval(timer);
          arena.scene.resume();
          reject(new Error("B49 dummy approach lost its player"));
          return;
        }
        let enemy = arena.room.state.enemies.get(chosen.id);
        if (!enemy) {
          const replacements: Array<{ id: string; enemy: any; distance: number }> = [];
          arena.room.state.enemies.forEach((candidate: any, id: string) => {
            if (candidate.kind !== "dummy") return;
            const onFacingSide = direction > 0 ? candidate.x > self.x : candidate.x < self.x;
            if (onFacingSide)
              replacements.push({
                id,
                enemy: candidate,
                distance: Math.hypot(candidate.x - self.x, candidate.y - self.y),
              });
          });
          const replacement = replacements.sort((a, b) => a.distance - b.distance)[0];
          if (!replacement) {
            window.clearInterval(timer);
            arena.scene.resume();
            reject(new Error(`B49 dummy approach lost ${chosen.id} and found no replacement`));
            return;
          }
          chosen.id = replacement.id;
          enemy = replacement.enemy;
        }
        const desiredX = enemy.x - direction * 68;
        const desiredY = enemy.y;
        const dx = desiredX - self.x;
        const dy = desiredY - self.y;
        const distance = Math.hypot(dx, dy);
        seq = (seq + 1) >>> 0;
        // Training dummies and the other permanent gallery bodies can block the last
        // few pixels of the path. The Doubleheader envelope plus dummy radius still
        // overlaps safely from this tolerance.
        if (distance <= 52) {
          arena.room.send("input", {
            seq,
            dx: 0,
            dy: 0,
            aimX: direction,
            aimY: 0,
            fireHeld: false,
          });
          window.clearInterval(timer);
          arena.scene.resume();
          resolve({ id: chosen.id, x: enemy.x, y: enemy.y });
          return;
        }
        if (performance.now() >= deadline) {
          window.clearInterval(timer);
          arena.scene.resume();
          reject(new Error(`B49 dummy approach timed out at ${distance.toFixed(1)}px`));
          return;
        }
        arena.room.send("input", {
          seq,
          dx: dx / (distance || 1),
          dy: dy / (distance || 1),
          aimX: direction,
          aimY: 0,
          fireHeld: false,
        });
      }, 50);
    });
  }, facingSign(facing));
  await page.waitForTimeout(320);
  return target;
}

async function nearestDummy(page: Page): Promise<{ id: string; x: number; y: number }> {
  return await page.evaluate(() => {
    const arena = (globalThis as any).ddGame.scene.getScene("arena");
    const self = arena.room.state.players.get(arena.room.sessionId);
    if (!self) throw new Error("B49 target selection lost its player");
    const dummies: Array<{ id: string; x: number; y: number; distance: number }> = [];
    arena.room.state.enemies.forEach((enemy: any, id: string) => {
      if (enemy.kind === "dummy")
        dummies.push({
          id,
          x: enemy.x,
          y: enemy.y,
          distance: Math.hypot(enemy.x - self.x, enemy.y - self.y),
        });
    });
    const chosen = dummies.sort((a, b) => a.distance - b.distance)[0];
    if (!chosen) throw new Error("B49 Testing Grounds did not contain a dummy");
    return { id: chosen.id, x: chosen.x, y: chosen.y };
  });
}

async function startSampler(
  page: Page,
  weaponId: OrderId,
): Promise<{
  attackSeq: number;
  player: Point;
  receiptSeq: number;
}> {
  return await page.evaluate((wanted) => {
    const holder = globalThis as any;
    const arena = holder.ddGame.scene.getScene("arena");
    const self = arena.room.state.players.get(arena.room.sessionId);
    if (!self) throw new Error("B49 sampler lost its player");
    holder.__b49Samples = [];
    holder.__b49CasterAnchors = [];
    holder.__b49HelixSeparation = 0;
    if (holder.__b49SampleRaf) window.cancelAnimationFrame(holder.__b49SampleRaf);
    const startedAt = performance.now();
    const scan = (): void => {
      const liveArena = holder.ddGame.scene.getScene("arena");
      const player = liveArena.room.state.players.get(liveArena.room.sessionId);
      const rig = liveArena.blobs.get(liveArena.room.sessionId);
      if (player && rig?.weaponDef?.id === wanted) {
        const projectiles: LiveSample["projectiles"] = [];
        liveArena.room.state.projectiles.forEach((row: any, id: string) => {
          if (row.sourcePlayerId !== liveArena.room.sessionId || row.sourceWeaponId !== wanted)
            return;
          const rendered = liveArena.projectiles.get(id);
          const spawnOriginX = Number(rendered?.getData("spawnOriginX"));
          const spawnOriginY = Number(rendered?.getData("spawnOriginY"));
          projectiles.push({
            id,
            bornTick: row.bornTick,
            kind: row.kind,
            part: row.sourceMuzzlePart,
            state: { x: row.x, y: row.y },
            velocity: { x: row.vx, y: row.vy },
            rendered: rendered ? { x: rendered.x, y: rendered.y } : null,
            spawnAnchorKind: String(rendered?.getData("spawnAnchorKind") ?? ""),
            spawnOrigin:
              Number.isFinite(spawnOriginX) && Number.isFinite(spawnOriginY)
                ? { x: spawnOriginX, y: spawnOriginY }
                : null,
          });
        });
        if (wanted === "x2-void-throwing-star" && holder.__b49HelixSeparation <= 42) {
          const byBornTick = new Map<number, LiveSample["projectiles"]>();
          for (const row of projectiles) {
            const pair = byBornTick.get(row.bornTick) ?? [];
            pair.push(row);
            byBornTick.set(row.bornTick, pair);
          }
          const separation = Math.max(
            0,
            ...[...byBornTick.values()].map((pair) => {
              const rendered = pair.filter((row) => row.rendered).sort((a, b) => a.part - b.part);
              return rendered.length === 2 && new Set(rendered.map((row) => row.part)).size === 2
                ? Math.hypot(
                    rendered[0]!.rendered!.x - rendered[1]!.rendered!.x,
                    rendered[0]!.rendered!.y - rendered[1]!.rendered!.y,
                  )
                : 0;
            }),
          );
          holder.__b49HelixSeparation = Math.max(holder.__b49HelixSeparation, separation);
          if (separation > 42) liveArena.scene.pause();
        }
        const sample = rig.performanceSample;
        const visibleDamageLabels =
          liveArena.damageNumberRenderer?.labels
            ?.filter((label: any) => label.visible && label.alpha > 0)
            .map((label: any) => ({ text: label.text, x: label.x, y: label.y })) ?? [];
        holder.__b49Samples.push({
          atMs: performance.now() - startedAt,
          attackSeq: player.attackSeq,
          activeDamageNumbers: liveArena.damageNumberRenderer?.engine?.activeCount ?? 0,
          facing: rig.facing,
          orbitT: rig.orbitT,
          performance: {
            active: sample?.active === true,
            backHandBlend: sample?.backHandBlend ?? 0,
            backHandX: sample?.backHandX ?? 0,
            backHandY: sample?.backHandY ?? 0,
            handX: sample?.handX ?? 0,
            handY: sample?.handY ?? 0,
            wholeBodyRotation: sample?.wholeBodyRotation ?? 0,
          },
          player: { x: player.x, y: player.y },
          projectiles,
          rootRotation: rig.root.rotation,
          visibleDamageLabels,
          weaponPieces: rig.weapons
            .filter((piece: any) => piece.def.id === wanted)
            .map((piece: any) => ({
              displayHeight: piece.img.displayHeight,
              displayWidth: piece.img.displayWidth,
              rotation: piece.img.rotation,
              visible: piece.img.visible !== false,
              x: piece.img.x,
              y: piece.img.y,
            })),
        } satisfies LiveSample);
      }
      holder.__b49SampleRaf = window.requestAnimationFrame(scan);
    };
    scan();
    let receiptSeq = 0;
    arena.room.state.combatReceipts.forEach((row: any) => {
      receiptSeq = Math.max(receiptSeq, row.seq);
    });
    return {
      attackSeq: self.attackSeq,
      player: { x: self.x, y: self.y },
      receiptSeq,
    };
  }, weaponId);
}

async function fire(
  page: Page,
  weaponId: OrderId,
  facing: Facing,
  held: boolean,
  keepPointerHeld = false,
  helixAim?: Point,
): Promise<void> {
  const before = await page.evaluate(
    ({ aim, direction, hold, keepPointer, wanted }) => {
      const holder = globalThis as any;
      const arena = holder.ddGame.scene.getScene("arena");
      const self = arena.room.state.players.get(arena.room.sessionId);
      if (!self || self.weapon !== wanted) throw new Error(`B49 lost ${wanted} before attack`);
      arena.selfAim = aim ? { x: direction * aim.x, y: aim.y } : { x: direction, y: 0 };
      arena.localAtkCd = 0;
      arena.localPredictedAttackAtMs = -1e9;
      arena.input.activePointer.rightButtonDown = () => true;
      if (hold) {
        arena.room.send("debugSetFireInputHeld", { held: true });
        if (holder.__b49HeldTimer) window.clearInterval(holder.__b49HeldTimer);
        holder.__b49HeldTimer = window.setInterval(
          () => arena.stepNetInput?.(50, false, false, 0, 0),
          45,
        );
      }
      arena.sendAttack();
      if (!hold && !keepPointer) arena.input.activePointer.rightButtonDown = () => false;
      return self.attackSeq;
    },
    {
      aim: helixAim,
      direction: facingSign(facing),
      hold: held,
      keepPointer: keepPointerHeld,
      wanted: weaponId,
    },
  );
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const arena = (globalThis as any).ddGame.scene.getScene("arena");
          return arena.room.state.players.get(arena.room.sessionId)?.attackSeq ?? 0;
        }),
      { message: `${weaponId}/${facing}: accepted attack`, timeout: 12_000 },
    )
    .toBeGreaterThan(before);
}

async function release(page: Page): Promise<void> {
  await page.evaluate(() => {
    const holder = globalThis as any;
    const arena = holder.ddGame.scene.getScene("arena");
    arena.input.activePointer.rightButtonDown = () => false;
    if (holder.__b49HeldTimer) window.clearInterval(holder.__b49HeldTimer);
    holder.__b49HeldTimer = undefined;
    arena.room.send("debugSetFireInputHeld", { held: false });
    arena.stepNetInput?.(50, false, false, 0, 0);
  });
}

async function finishSampler(
  page: Page,
  weaponId: OrderId,
  receiptSeqBefore: number,
): Promise<{
  attackSeq: number;
  casterAnchors: CasterAnchorEvent[];
  definition: Record<string, any>;
  player: Point;
  receipts: LiveCapture["receipts"];
  samples: LiveSample[];
}> {
  return await page.evaluate(
    ({ baseline, wanted }) => {
      const holder = globalThis as any;
      const arena = holder.ddGame.scene.getScene("arena");
      const self = arena.room.state.players.get(arena.room.sessionId);
      const rig = arena.blobs.get(arena.room.sessionId);
      if (!self || !rig || rig.weaponDef?.id !== wanted)
        throw new Error(`B49 finish sampler lost ${wanted}`);
      if (holder.__b49SampleRaf) window.cancelAnimationFrame(holder.__b49SampleRaf);
      holder.__b49SampleRaf = undefined;
      const receipts: LiveCapture["receipts"] = [];
      arena.room.state.combatReceipts.forEach((row: any) => {
        if (row.seq > baseline && row.weaponId === wanted)
          receipts.push({
            damage: row.damage,
            seq: row.seq,
            targetId: row.targetId,
            weaponId: row.weaponId,
          });
      });
      const definition = rig.weaponDef;
      return {
        attackSeq: self.attackSeq,
        player: { x: self.x, y: self.y },
        samples: holder.__b49Samples ?? [],
        casterAnchors: (holder.__b49CasterAnchors ?? []).filter(
          (event: CasterAnchorEvent) => event.weaponId === wanted,
        ),
        receipts,
        definition: {
          id: definition.id,
          damage: definition.damage,
          cooldown: definition.cooldown,
          displayLength: definition.displayLength,
          range: definition.range,
          swingArc: definition.swingArc,
          swingStyle: definition.swingStyle ?? null,
          grip: definition.tags.grip,
          performance: definition.performance ?? null,
          scatter: definition.scatter ?? null,
          thrown: definition.thrown ?? null,
          comboFamily: definition.comboFamily ?? null,
          comboVariant: definition.comboVariant ?? null,
          flipEvidence: rig.authoredComboFlipRenderEvidence
            ? { ...rig.authoredComboFlipRenderEvidence }
            : null,
          suppressMeleeHitbox: definition.suppressMeleeHitbox === true,
          suppressVfx: definition.suppressVfx === true,
        },
      };
    },
    { baseline: receiptSeqBefore, wanted: weaponId },
  );
}

function latestPairSamples(samples: LiveSample[]): LiveSample[] {
  return samples.filter((sample) => {
    const latestBorn = Math.max(...sample.projectiles.map((row) => row.bornTick), -1);
    const rows = sample.projectiles.filter((row) => row.bornTick === latestBorn);
    return rows.length === 2 && new Set(rows.map((row) => row.part)).size === 2;
  });
}

async function captureOrder(page: Page, weaponId: OrderId, facing: Facing): Promise<LiveCapture> {
  await equip(page, weaponId);
  const cadenceTarget =
    weaponId === "gravediggers-spade"
      ? await nearestDummy(page)
      : weaponId === "x2-brimstone-doubleheader"
        ? await moveBesideDummy(page, facing)
        : null;
  await commitFacing(page, weaponId, facing);
  const before = await startSampler(page, weaponId);
  await fire(
    page,
    weaponId,
    facing,
    HELD_IDS.has(weaponId),
    weaponId === "x2-reverent-broadsword",
    weaponId === "x2-void-throwing-star" ? { x: 0.35, y: -1 } : undefined,
  );

  if (weaponId === "x2-reverent-broadsword") {
    await page.waitForTimeout(80);
    await release(page);
    await page.waitForTimeout(80);
    await fire(page, weaponId, facing, false, true);
  }

  let cadenceScreenshot: string | undefined;
  if (weaponId === "gravediggers-spade" || weaponId === "x2-brimstone-doubleheader") {
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const arena = (globalThis as any).ddGame.scene.getScene("arena");
            const visible =
              arena.damageNumberRenderer?.labels?.filter(
                (label: any) => label.visible && label.alpha > 0,
              ).length ?? 0;
            if (visible >= 2) arena.scene.pause();
            return visible;
          }),
        { message: `${weaponId}/${facing}: damage numbers should become visible`, timeout: 6_000 },
      )
      .toBeGreaterThanOrEqual(2);
    const cadenceFile = path.join(EVIDENCE_DIR, `${weaponId}-${facing}-damage-cadence.png`);
    await page.locator("#game-root canvas").screenshot({ path: cadenceFile });
    await page.evaluate(() => (globalThis as any).ddGame.scene.getScene("arena").scene.resume());
    cadenceScreenshot = relative(cadenceFile);
  }

  if (weaponId === "x2-void-throwing-star") {
    const helixAims: Point[] = [
      { x: 0.35, y: -1 },
      { x: 0.35, y: 1 },
      { x: 1, y: -0.35 },
      { x: 1, y: 0.35 },
      { x: 1, y: 0 },
    ];
    let separation = 0;
    for (let attempt = 0; attempt < helixAims.length && separation <= 42; attempt += 1) {
      if (attempt > 0) await fire(page, weaponId, facing, false, false, helixAims[attempt]);
      const deadline = Date.now() + 900;
      while (Date.now() < deadline && separation <= 42) {
        separation = await page.evaluate(() => (globalThis as any).__b49HelixSeparation ?? 0);
        if (separation <= 42) await page.waitForTimeout(16);
      }
    }
    expect(separation, `${weaponId}/${facing}: visible opposite helix separation`).toBeGreaterThan(
      42,
    );
  } else await page.waitForTimeout(CAPTURE_DELAY_MS[weaponId] ?? 220);

  const screenshotFile = path.join(EVIDENCE_DIR, `${weaponId}-${facing}.png`);
  await page.locator("#game-root canvas").screenshot({ path: screenshotFile });
  if (weaponId === "x2-void-throwing-star")
    await page.evaluate(() => (globalThis as any).ddGame.scene.getScene("arena").scene.resume());
  await release(page);
  await page.waitForTimeout(80);
  const measured = await finishSampler(page, weaponId, before.receiptSeq);
  const allPositions = [before.player, ...measured.samples.map((sample) => sample.player)];
  const maxDisplacementPx = Math.max(
    ...allPositions.map((point) =>
      Math.hypot(point.x - before.player.x, point.y - before.player.y),
    ),
  );

  return {
    weaponId,
    facing,
    attackSeqBefore: before.attackSeq,
    attackSeqAfter: measured.attackSeq,
    receiptSeqBefore: before.receiptSeq,
    targetId: cadenceTarget?.id ?? null,
    samples: measured.samples,
    receipts: measured.receipts,
    casterAnchors: measured.casterAnchors,
    cadenceScreenshot,
    definition: measured.definition,
    finalPlayer: measured.player,
    maxDisplacementPx,
    maxVisibleDamageNumbers: Math.max(
      ...measured.samples.map((sample) => sample.visibleDamageLabels.length),
      0,
    ),
    screenshot: relative(screenshotFile),
  };
}

function assertCapture(capture: LiveCapture): void {
  const prefix = `${capture.weaponId}/${capture.facing}`;
  expect(capture.attackSeqAfter, `${prefix}: authoritative acceptance`).toBeGreaterThan(
    capture.attackSeqBefore,
  );
  expect(capture.samples.some((sample) => sample.facing === facingSign(capture.facing))).toBe(true);
  expect(
    capture.samples.some((sample) =>
      sample.weaponPieces.some((piece) => piece.visible && piece.displayWidth > 0),
    ),
    `${prefix}: visible held art`,
  ).toBe(true);
  expect(capture.maxDisplacementPx, `${prefix}: planted attack`).toBeLessThan(1);

  switch (capture.weaponId) {
    case "x2-hailshard-resonator": {
      expect(capture.definition).toMatchObject({
        swingStyle: "spin",
        suppressMeleeHitbox: true,
        scatter: { aim: "radial-random" },
        performance: { action: "spin", continuous: true },
      });
      const directions = capture.samples
        .flatMap((sample) => sample.projectiles)
        .map((row) => Math.atan2(row.velocity.y, row.velocity.x));
      const quadrants = new Set(
        directions.map((angle) =>
          Math.floor((((angle + Math.PI * 2) % (Math.PI * 2)) / Math.PI) * 2),
        ),
      );
      expect(quadrants.size, `${prefix}: ice emitted around the circle`).toBeGreaterThanOrEqual(3);
      break;
    }
    case "gravediggers-spade": {
      expect(capture.definition).toMatchObject({
        swingArc: Math.PI * 6,
        performance: {
          twirl: { cadenceSeconds: 0.6, visualRevolutions: 3 },
        },
      });
      const targetReceipts = capture.receipts.filter(
        (receipt) => receipt.targetId === capture.targetId,
      );
      expect(targetReceipts, `${prefix}: one number receipt per revolution`).toHaveLength(3);
      expect(
        targetReceipts.reduce(
          (sum, receipt) => sum + receipt.damage / (receipt.damage > 3 ? 2 : 1),
          0,
        ),
      ).toBeCloseTo(8, 5);
      expect(
        capture.maxVisibleDamageNumbers,
        `${prefix}: visible damage-number cadence`,
      ).toBeGreaterThanOrEqual(2);
      break;
    }
    case "x2-cinderbrand-cleaver":
      expect(capture.definition.range).toBe(182);
      break;
    case "x2-brimstone-doubleheader": {
      expect(capture.definition).toMatchObject({
        swingArc: Math.PI * 2,
        swingStyle: "spin",
        suppressVfx: true,
        performance: {
          action: "spin",
          continuous: true,
          twirl: { visualRevolutions: 1 },
        },
      });
      const accepted = (capture.attackSeqAfter - capture.attackSeqBefore) >>> 0;
      const targetReceipts = capture.receipts.filter(
        (receipt) => receipt.targetId === capture.targetId,
      );
      expect(accepted, `${prefix}: continuous while held`).toBeGreaterThanOrEqual(2);
      expect(targetReceipts.length, `${prefix}: receipt per accepted revolution`).toBe(accepted);
      expect(
        capture.maxVisibleDamageNumbers,
        `${prefix}: visible damage-number cadence`,
      ).toBeGreaterThanOrEqual(2);
      break;
    }
    case "x2-hollowmoon-reaver":
      expect(capture.definition).toMatchObject({
        comboFamily: "chop",
        comboVariant: "hollowmoon-eclipse",
        performance: { hold: "upright", carryForwardPx: 16, comboForwardPx: 26 },
      });
      break;
    case "x2-frostfang-rakes":
      expect(capture.definition.performance?.comboForwardPx).toBe(64);
      break;
    case "x2-gallows-splitter":
    case "x2-saloon-tomahawk":
      expect(capture.definition.performance).toMatchObject({
        action: "throw-release",
        throwStyle: "two-hand-overhead",
      });
      expect(
        Math.max(...capture.samples.map((sample) => sample.performance.backHandBlend)),
        `${prefix}: support hand engaged`,
      ).toBeGreaterThan(0.9);
      expect(
        Math.min(...capture.samples.map((sample) => sample.performance.handX)),
        `${prefix}: throwing hand winds behind head`,
      ).toBeLessThan(-0.2);
      break;
    case "x2-reverent-broadsword":
      expect(capture.attackSeqAfter - capture.attackSeqBefore).toBeGreaterThanOrEqual(2);
      expect(capture.definition.flipEvidence?.renderedSamples).toBeGreaterThan(0);
      expect(capture.definition.flipEvidence?.maxProgress).toBe(1);
      expect(capture.definition.flipEvidence?.maxAbsRotation).toBeGreaterThan(5.5);
      break;
    case "x2-emberfist-wraps":
      expect(capture.definition).toMatchObject({ displayLength: 40, range: 184 });
      break;
    case "x2-void-throwing-star": {
      expect(capture.definition).toMatchObject({
        grip: "dual",
        thrown: { helix: { amplitudePx: 44, frequencyHz: 2 } },
      });
      const pairs = latestPairSamples(capture.samples);
      expect(pairs.length, `${prefix}: paired helix frames`).toBeGreaterThan(4);
      const separations = pairs.flatMap((sample) => {
        const born = Math.max(...sample.projectiles.map((row) => row.bornTick));
        const rows = sample.projectiles
          .filter((row) => row.bornTick === born && row.rendered)
          .sort((a, b) => a.part - b.part);
        if (!rows[0]?.rendered || !rows[1]?.rendered) return [];
        const velocity = rows[0].velocity;
        const speed = Math.hypot(velocity.x, velocity.y) || 1;
        const deltaX = rows[0].rendered.x - rows[1].rendered.x;
        const deltaY = rows[0].rendered.y - rows[1].rendered.y;
        return [(deltaX * -velocity.y + deltaY * velocity.x) / speed];
      });
      expect(
        Math.max(...separations.map((value) => Math.abs(value))),
        `${prefix}: visible opposite-phase helix separation`,
      ).toBeGreaterThan(42);
      expect(
        Math.max(...separations) - Math.min(...separations),
        `${prefix}: paired curves visibly diverge through flight`,
      ).toBeGreaterThan(35);
      break;
    }
    case "x2-frostknuckle-rimewrap":
      expect(capture.definition.grip).toBe("dual");
      expect(
        Math.max(...capture.samples.map((sample) => sample.weaponPieces.length)),
        `${prefix}: mirrored second glove`,
      ).toBeGreaterThanOrEqual(2);
      expect(
        capture.samples
          .flatMap((sample) => sample.projectiles)
          .some((row) => /frost/.test(row.kind)),
      ).toBe(true);
      expect(capture.casterAnchors.some((event) => event.hand0Distance < 1)).toBe(true);
      break;
    case "x2-cinderpalm-brand-glove": {
      expect(capture.definition.grip).toBe("dual");
      expect(
        Math.max(...capture.samples.map((sample) => sample.weaponPieces.length)),
        `${prefix}: dual glove art`,
      ).toBeGreaterThanOrEqual(2);
      const fistEvent = capture.casterAnchors.find((event) => event.hand0Distance < 1);
      expect(fistEvent, `${prefix}: flame source at fist`).toBeDefined();
      expect(fistEvent?.rootDistance ?? 0, `${prefix}: no body aura anchor`).toBeGreaterThan(8);
      expect(
        capture.samples
          .flatMap((sample) => sample.projectiles)
          .some((row) => row.spawnAnchorKind === "cast"),
        `${prefix}: fire projectile starts at fist`,
      ).toBe(true);
      break;
    }
  }
}

test("B49 all thirteen melee/thrown corrections pass both facings on private ports", async ({
  page,
}) => {
  test.setTimeout(420_000);
  await runArenaSpec(page, async (baseURL) => {
    await mkdir(EVIDENCE_DIR, { recursive: true });
    await page.setViewportSize({ width: 960, height: 540 });
    await bootArena(page, baseURL, `char:${CHARACTER_ID}`);
    await prepareArenaInput(page);
    await installProbe(page);
    const clientPort = Number(new URL(baseURL).port);
    const gamePort = Number(new URL(page.url()).searchParams.get("port"));
    expect(clientPort).toBeGreaterThan(0);
    expect(gamePort).toBeGreaterThan(0);
    expect(FORBIDDEN_PORTS.has(clientPort)).toBe(false);
    expect(FORBIDDEN_PORTS.has(gamePort)).toBe(false);
    expect(clientPort).not.toBe(gamePort);

    const captures: LiveCapture[] = [];
    for (const weaponId of LIVE_ORDER_IDS) {
      expect(WEAPONS[weaponId], `${weaponId}: shared fixture`).toBeDefined();
      for (const facing of FACINGS) {
        const capture = await captureOrder(page, weaponId, facing);
        assertCapture(capture);
        captures.push(capture);
      }
    }

    expect(captures).toHaveLength(LIVE_ORDER_IDS.length * FACINGS.length);
    const filteredId = process.env.B49_LIVE_WEAPON;
    const receiptFile = path.join(
      EVIDENCE_DIR,
      filteredId ? `live-gate-${filteredId}.json` : "live-gate.json",
    );
    await writeFile(
      receiptFile,
      `${JSON.stringify(
        {
          verdict: "PASS",
          ports: { clientPort, gamePort },
          orders: [...LIVE_ORDER_IDS],
          facings: [...FACINGS],
          captureCount: captures.length,
          hailshardCulprit: "B30 commit 2a577c7 (merge 12986aa)",
          captures,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    const markdownFile = path.join(
      EVIDENCE_DIR,
      filteredId ? `README-${filteredId}.md` : "README.md",
    );
    await writeFile(
      markdownFile,
      [
        "# B49 melee/thrown live gate",
        "",
        `- Verdict: PASS — ${captures.length} captures (${LIVE_ORDER_IDS.length} orders × 2 facings).`,
        `- Private client/game ports: ${clientPort} / ${gamePort}.`,
        "- Gravedigger and Doubleheader captures include authoritative per-revolution receipts and visible damage-number counts.",
        "- Void Throwing Star captures include two rendered source parts crossing on opposite helix phases.",
        "- Hailshard regression culprit: B30 commit `2a577c7` (merge `12986aa`).",
        `- Machine receipt: [live-gate.json](./${path.basename(receiptFile)})`,
        "",
        ...captures.map(
          (capture) =>
            `- ${capture.weaponId} / ${capture.facing}: [screenshot](./${path.basename(
              capture.screenshot,
            )})${
              capture.cadenceScreenshot
                ? ` · [damage cadence](./${path.basename(capture.cadenceScreenshot)})`
                : ""
            }`,
        ),
        "",
      ].join("\n"),
      "utf8",
    );
  });
});
