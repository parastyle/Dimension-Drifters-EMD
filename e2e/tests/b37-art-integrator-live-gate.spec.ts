import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { bootArena, runArenaSpec } from "../helpers/arena-harness.js";

const EVIDENCE_DIR = path.resolve(
  import.meta.dirname,
  "../../docs/owner-notes-audit-v11-evidence/b37-integrator",
);
const CHARACTER_ID = "proto-cowboy-hidden-face";
const FORBIDDEN_PORTS = new Set([5180, 2567]);
const FACINGS = ["right", "left"] as const;
const TORNADOES = [
  {
    weaponId: "x2-iron-war-fan",
    subject: "vfx-tornado-iron-gale",
    textureKeys: ["b18:tornado:iron-gale", "b37:tornado:iron-gale:2", "b37:tornado:iron-gale:3"],
  },
  {
    weaponId: "x2-ember-fan",
    subject: "vfx-tornado-ember-fire",
    textureKeys: ["b18:tornado:ember-fire", "b37:tornado:ember-fire:2", "b37:tornado:ember-fire:3"],
  },
  {
    weaponId: "x2-storm-fan",
    subject: "vfx-tornado-storm-shock",
    textureKeys: [
      "b18:tornado:storm-shock",
      "b37:tornado:storm-shock:2",
      "b37:tornado:storm-shock:3",
    ],
  },
] as const;

interface ProjectileObservation {
  id: string;
  tick: number;
  sourceWeaponId: string;
  kind: string;
  bornTick: number;
  flightAgeTicks: number;
  visualVariant: number;
  explodeR: number;
  arcHeight: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  renderedX: number;
  renderedY: number;
  projectileSprite: string;
  projectileTextureKey: string;
  payloadY: number;
  payloadRotation: number;
  tornadoFrameIndex: number;
  tornadoTextureKey: string;
  tornadoRotation: number;
  containerRotation: number;
}

function evidencePath(file: string): string {
  return path.relative(process.cwd(), file).replaceAll("\\", "/");
}

async function prepare(
  page: Page,
  baseURL: string,
): Promise<{ clientPort: number; gamePort: number }> {
  await bootArena(page, baseURL, `char:${CHARACTER_ID}`);
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const arena = (globalThis as any).ddGame.scene.getScene("arena");
          const self = arena.room?.state?.players?.get(arena.room.sessionId);
          return { mode: arena.room?.state?.mode, character: self?.character };
        }),
      { timeout: 30_000, message: "B37 private Testing Grounds should become live" },
    )
    .toEqual({ mode: "training", character: CHARACTER_ID });
  await page.locator("#game-root canvas").click({ position: { x: 640, y: 360 } });
  await page.evaluate(() => {
    const holder = globalThis as any;
    const arena = holder.ddGame.scene.getScene("arena");
    if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend?.(arena.time.now);
    arena.verbs?.releaseInputLatchIf?.(true);
    arena.game.hasFocus = true;
    arena.pointerOverInteractiveUi = false;
    arena.input.activePointer.rightButtonDown = () => false;
    arena.cameras.main.setZoom(1.8);
    holder.__ddB2WackyVfxAudit = [];
    holder.__b37ProjectileSamples = [];
    if (holder.__b37ProjectileTimer) window.clearInterval(holder.__b37ProjectileTimer);
    holder.__b37ProjectileTimer = window.setInterval(() => {
      const liveArena = holder.ddGame.scene.getScene("arena");
      liveArena.room.state.projectiles.forEach((row: any, id: string) => {
        const rendered = liveArena.projectiles.get(id);
        const payload = rendered?.getData("arcPayload");
        const tornado = rendered?.getData("fanTornadoImage");
        const sample = {
          id,
          tick: liveArena.room.state.tick,
          sourceWeaponId: row.sourceWeaponId,
          kind: row.kind,
          bornTick: row.bornTick,
          flightAgeTicks: row.flightAgeTicks,
          visualVariant: row.visualVariant,
          explodeR: row.explodeR,
          arcHeight: row.arcHeight,
          x: row.x,
          y: row.y,
          vx: row.vx,
          vy: row.vy,
          renderedX: rendered?.x ?? row.x,
          renderedY: rendered?.y ?? row.y,
          projectileSprite: rendered?.getData("projectileSprite") ?? "",
          projectileTextureKey: rendered?.getData("projectileTextureKey") ?? "",
          payloadY: payload?.y ?? 0,
          payloadRotation: payload?.rotation ?? 0,
          tornadoFrameIndex: rendered?.getData("fanTornadoFrameIndex") ?? -1,
          tornadoTextureKey: tornado?.texture?.key ?? "",
          tornadoRotation: tornado?.rotation ?? 0,
          containerRotation: rendered?.rotation ?? 0,
        };
        holder.__b37ProjectileSamples.push(sample);
        const target = holder.__b37PauseTarget;
        if (
          target &&
          sample.sourceWeaponId === target.weaponId &&
          sample.bornTick > target.previousBornTick &&
          (target.variant === undefined || sample.visualVariant === target.variant) &&
          (target.tornadoFrame === undefined ||
            (sample.tornadoFrameIndex === target.tornadoFrame && sample.flightAgeTicks > 0)) &&
          (!target.requireArc || sample.payloadY < -1)
        ) {
          holder.__b37PausedObservation = sample;
          holder.__b37PauseTarget = undefined;
          liveArena.scene.pause();
        }
      });
      if (holder.__b37ProjectileSamples.length > 4_000)
        holder.__b37ProjectileSamples.splice(0, holder.__b37ProjectileSamples.length - 4_000);
    }, 16);
  });
  const clientPort = Number(new URL(baseURL).port);
  const gamePort = Number(new URL(page.url()).searchParams.get("port"));
  return { clientPort, gamePort };
}

async function equip(page: Page, weaponId: string): Promise<void> {
  await page.evaluate(
    ({ weapon, character }) => {
      const arena = (globalThis as any).ddGame.scene.getScene("arena");
      arena.room.send("devEquip", { weapon, character });
    },
    { weapon: weaponId, character: CHARACTER_ID },
  );
  await expect
    .poll(
      () =>
        page.evaluate((wanted) => {
          const arena = (globalThis as any).ddGame.scene.getScene("arena");
          const self = arena.room.state.players.get(arena.room.sessionId);
          return {
            authority: self?.weapon ?? "",
            rig: arena.blobs.get(arena.room.sessionId)?.weaponDef?.id ?? "",
            wanted,
          };
        }, weaponId),
      { timeout: 20_000, message: `B37 should equip ${weaponId}` },
    )
    .toEqual({ authority: weaponId, rig: weaponId, wanted: weaponId });
}

async function commitFacing(page: Page, facing: (typeof FACINGS)[number]): Promise<void> {
  const canvas = page.locator("#game-root canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("B37 gate cannot locate the Phaser canvas");
  await page.mouse.move(
    box.x + box.width * (facing === "right" ? 0.86 : 0.14),
    box.y + box.height * 0.5,
  );
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const arena = (globalThis as any).ddGame.scene.getScene("arena");
          return arena.blobs.get(arena.room.sessionId)?.facing ?? 0;
        }),
      { timeout: 10_000, message: `B37 rig should face ${facing}` },
    )
    .toBe(facing === "right" ? 1 : -1);
}

async function refreshPresentDrive(page: Page): Promise<void> {
  await page.evaluate(() => {
    const holder = globalThis as any;
    const arena = holder.ddGame.scene.getScene("arena");
    holder.__b37PauseTarget = undefined;
    holder.__b37PausedObservation = undefined;
    holder.__b37ProjectileSamples = [];
    arena.room.send("restart");
  });
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const arena = (globalThis as any).ddGame.scene.getScene("arena");
          const self = arena.room.state.players.get(arena.room.sessionId);
          return {
            alive: self?.alive ?? false,
            mode: arena.room.state.mode,
          };
        }),
      { timeout: 20_000, message: "B37 drive refresh should preserve the private training room" },
    )
    .toEqual({ alive: true, mode: "training" });
  await equip(page, "x2-exploding-present-lobber");
  await commitFacing(page, "right");
}

async function maxBornTick(page: Page, weaponId: string): Promise<number> {
  return await page.evaluate((wanted) => {
    const samples = ((globalThis as any).__b37ProjectileSamples ?? []) as ProjectileObservation[];
    return Math.max(
      -1,
      ...samples
        .filter((sample) => sample.sourceWeaponId === wanted)
        .map((sample) => sample.bornTick),
    );
  }, weaponId);
}

async function acceptedAttack(
  page: Page,
  weaponId: string,
  facing: "right" | "left" = "right",
  pauseOptions?: { variant?: number; tornadoFrame?: number; requireArc?: boolean },
): Promise<{ before: number; after: number; previousBornTick: number }> {
  const previousBornTick = await maxBornTick(page, weaponId);
  await page.evaluate(
    ({ wanted, prior, variant, tornadoFrame, requireArc }) => {
      const holder = globalThis as any;
      holder.__b37PausedObservation = undefined;
      holder.__b37PauseTarget = {
        weaponId: wanted,
        previousBornTick: prior,
        variant,
        tornadoFrame,
        requireArc,
      };
    },
    {
      wanted: weaponId,
      prior: previousBornTick,
      variant: pauseOptions?.variant,
      tornadoFrame: pauseOptions?.tornadoFrame,
      requireArc: pauseOptions?.requireArc,
    },
  );
  const before = await page.evaluate(() => {
    const arena = (globalThis as any).ddGame.scene.getScene("arena");
    return arena.room.state.players.get(arena.room.sessionId)?.attackSeq ?? 0;
  });
  const deadline = Date.now() + 10_000;
  let after = before;
  while (Date.now() < deadline && after <= before) {
    await page.evaluate((direction) => {
      const arena = (globalThis as any).ddGame.scene.getScene("arena");
      const self = arena.room.state.players.get(arena.room.sessionId);
      if (!self) return;
      const aimX = direction === "right" ? 1 : -1;
      arena.room.send("attack", {
        aimX,
        aimY: 0,
        tx: self.x + aimX * 420,
        ty: self.y,
      });
    }, facing);
    // Stay comfortably below the production action budget while polling across authored cooldowns.
    await page.waitForTimeout(250);
    after = await page.evaluate(() => {
      const arena = (globalThis as any).ddGame.scene.getScene("arena");
      return arena.room.state.players.get(arena.room.sessionId)?.attackSeq ?? 0;
    });
  }
  expect(after, `${weaponId} attack should be accepted`).toBeGreaterThan(before);
  return { before, after, previousBornTick };
}

async function pauseOnProjectile(
  page: Page,
  weaponId: string,
  previousBornTick: number,
  options?: {
    variant?: number;
    tornadoFrame?: number;
    requireArc?: boolean;
    timeoutMs?: number;
  },
): Promise<ProjectileObservation> {
  try {
    await page.waitForFunction(() => !!(globalThis as any).__b37PausedObservation, undefined, {
      timeout: options?.timeoutMs ?? 5_000,
      polling: 8,
    });
  } catch (error) {
    const diagnostics = await page.evaluate(
      ({ wanted, prior }) => {
        const holder = globalThis as any;
        const arena = holder.ddGame.scene.getScene("arena");
        const current: unknown[] = [];
        arena.room.state.projectiles.forEach((row: any, id: string) => {
          current.push({
            id,
            sourceWeaponId: row.sourceWeaponId,
            bornTick: row.bornTick,
            visualVariant: row.visualVariant,
          });
        });
        return {
          current,
          renderedIds: [...arena.projectiles.keys()],
          samples: ((holder.__b37ProjectileSamples ?? []) as ProjectileObservation[])
            .filter((sample) => sample.sourceWeaponId === wanted && sample.bornTick > prior)
            .slice(-20),
        };
      },
      { wanted: weaponId, prior: previousBornTick },
    );
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}\nB37 projectile diagnostics: ${JSON.stringify(diagnostics)}`,
    );
  }
  const observation = await page.evaluate(() => (globalThis as any).__b37PausedObservation);
  if (options?.variant !== undefined) expect(observation.visualVariant).toBe(options.variant);
  if (options?.tornadoFrame !== undefined)
    expect(observation.tornadoFrameIndex).toBe(options.tornadoFrame);
  if (options?.requireArc) expect(observation.payloadY).toBeLessThan(-1);
  return observation;
}

async function resume(page: Page): Promise<void> {
  await page.evaluate(() => {
    (globalThis as any).ddGame.scene.getScene("arena").scene.resume();
  });
}

async function screenshot(page: Page, fileName: string): Promise<string> {
  const file = path.join(EVIDENCE_DIR, fileName);
  await page.screenshot({ path: file });
  return evidencePath(file);
}

test("B37 four harvested art sets render through private authoritative projectiles", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await runArenaSpec(page, async (baseURL) => {
    await mkdir(EVIDENCE_DIR, { recursive: true });
    await page.setViewportSize({ width: 900, height: 520 });
    const ports = await prepare(page, baseURL);
    expect(FORBIDDEN_PORTS.has(ports.clientPort)).toBe(false);
    expect(FORBIDDEN_PORTS.has(ports.gamePort)).toBe(false);

    const buffalo: Array<Record<string, unknown>> = [];
    await equip(page, "x2-ironhide-buffalo-gun");
    for (const facing of FACINGS) {
      await commitFacing(page, facing);
      const attack = await acceptedAttack(page, "x2-ironhide-buffalo-gun", facing);
      const observation = await pauseOnProjectile(
        page,
        "x2-ironhide-buffalo-gun",
        attack.previousBornTick,
      );
      expect(observation.projectileSprite).toBe("ironhide-anti-tank-shell");
      expect(Math.sign(observation.vx)).toBe(facing === "right" ? 1 : -1);
      const held = await page.evaluate(() => {
        const arena = (globalThis as any).ddGame.scene.getScene("arena");
        const rig = arena.blobs.get(arena.room.sessionId);
        return {
          facing: rig.facing,
          weaponParts: rig.weapons
            .filter((piece: any) => piece.def.id === "x2-ironhide-buffalo-gun")
            .map((piece: any) => ({
              width: piece.img.displayWidth,
              height: piece.img.displayHeight,
              textureKey: piece.img.texture?.key,
              visible: piece.img.visible,
            })),
        };
      });
      expect(held.weaponParts).toHaveLength(1);
      expect(held.weaponParts[0]).toMatchObject({ visible: true });
      buffalo.push({
        facing,
        attackSeqBefore: attack.before,
        attackSeqAfter: attack.after,
        held,
        projectile: observation,
        screenshot: await screenshot(page, `buffalo-${facing}.png`),
      });
      await resume(page);
    }

    const presents: Array<Record<string, unknown>> = [];
    const presentVariants = new Set<number>();
    await equip(page, "x2-exploding-present-lobber");
    await commitFacing(page, "right");
    for (
      let shot = 0;
      shot < 64 && !(presentVariants.size >= 3 && presentVariants.has(5));
      shot++
    ) {
      if (shot > 0 && shot % 16 === 0) await refreshPresentDrive(page);
      const attack = await acceptedAttack(page, "x2-exploding-present-lobber");
      const observation = await pauseOnProjectile(
        page,
        "x2-exploding-present-lobber",
        attack.previousBornTick,
      );
      expect(observation.visualVariant).toBeGreaterThanOrEqual(1);
      expect(observation.visualVariant).toBeLessThanOrEqual(5);
      expect(observation.projectileTextureKey).toBe(`wacky:present:${observation.visualVariant}`);
      const isNew = !presentVariants.has(observation.visualVariant);
      presentVariants.add(observation.visualVariant);
      const capture: Record<string, unknown> = {
        shot: shot + 1,
        attackSeqBefore: attack.before,
        attackSeqAfter: attack.after,
        projectile: observation,
      };
      if (isNew)
        capture.screenshot = await screenshot(
          page,
          `present-variant-${observation.visualVariant}.png`,
        );
      presents.push(capture);
      await resume(page);
    }
    expect(presentVariants.size).toBeGreaterThanOrEqual(3);
    expect(presentVariants.has(5), "live seeded rolls should include rare part-5").toBe(true);
    const liveBig = presents.find(
      (capture) => (capture.projectile as ProjectileObservation).visualVariant === 5,
    );
    expect((liveBig?.projectile as ProjectileObservation | undefined)?.explodeR).toBeCloseTo(
      101.5,
      4,
    );

    await equip(page, "x2-quicksilver-streetsweeper");
    await commitFacing(page, "right");
    const streetsweeperAttack = await acceptedAttack(
      page,
      "x2-quicksilver-streetsweeper",
      "right",
      { requireArc: true },
    );
    const streetsweeperArc = await pauseOnProjectile(
      page,
      "x2-quicksilver-streetsweeper",
      streetsweeperAttack.previousBornTick,
      { requireArc: true },
    );
    expect(streetsweeperArc.projectileSprite).toBe("streetsweeper-grenade-shell");
    expect(streetsweeperArc.arcHeight).toBe(112);
    expect(streetsweeperArc.payloadY).toBeLessThan(-1);
    const streetsweeperArcScreenshot = await screenshot(page, "streetsweeper-arc.png");
    await resume(page);
    await page.waitForFunction(
      () => {
        const arena = (globalThis as any).ddGame.scene.getScene("arena");
        const explosion = arena.children.list.find(
          (child: any) =>
            child.name === "projectile-explosion:x2-quicksilver-streetsweeper" &&
            child.visible !== false,
        );
        if (!explosion) return false;
        arena.scene.pause();
        return true;
      },
      undefined,
      { timeout: 5_000, polling: 8 },
    );
    const streetsweeperExplosion = await page.evaluate(() => {
      const arena = (globalThis as any).ddGame.scene.getScene("arena");
      const explosion = arena.children.list.find(
        (child: any) =>
          child.name === "projectile-explosion:x2-quicksilver-streetsweeper" &&
          child.visible !== false,
      );
      if (!explosion) throw new Error("B37 lost the paused Streetsweeper explosion");
      return {
        textureKey: explosion.texture?.key,
        damageDiameter: explosion.getData("damageDiameter"),
        displayDiameter: explosion.getData("displayDiameter"),
        currentDisplayWidth: explosion.displayWidth,
        rotation: explosion.rotation,
      };
    });
    expect(streetsweeperExplosion).toMatchObject({
      textureKey: "projectile-explosion:quicksilver-streetsweeper",
      damageDiameter: 124,
      displayDiameter: 124,
      rotation: 0,
    });
    const streetsweeperExplosionScreenshot = await screenshot(page, "streetsweeper-explosion.png");
    await resume(page);

    const tornadoes: Array<Record<string, unknown>> = [];
    await page.evaluate(() => {
      (globalThis as any).ddGame.scene.getScene("arena").cameras.main.setZoom(1);
    });
    for (const fixture of TORNADOES) {
      await equip(page, fixture.weaponId);
      await commitFacing(page, "right");
      const observed = new Set<number>();
      for (let frame = 0; frame < 3; frame++) {
        let attack: Awaited<ReturnType<typeof acceptedAttack>> | undefined;
        let observation: ProjectileObservation | undefined;
        for (let attempt = 1; attempt <= 8 && !observation; attempt++) {
          attack = await acceptedAttack(page, fixture.weaponId, "right", {
            tornadoFrame: frame,
          });
          try {
            observation = await pauseOnProjectile(page, fixture.weaponId, attack.previousBornTick, {
              tornadoFrame: frame,
              timeoutMs: 1_200,
            });
          } catch (error) {
            if (attempt === 8) throw error;
            await page.evaluate(() => {
              const holder = globalThis as any;
              holder.__b37PauseTarget = undefined;
              const arena = holder.ddGame.scene.getScene("arena");
              if (arena.scene.isPaused()) arena.scene.resume();
            });
          }
        }
        if (!attack || !observation)
          throw new Error(`B37 did not capture ${fixture.subject} frame ${frame + 1}`);
        expect(observation.tornadoFrameIndex).toBe(frame);
        expect(observation.tornadoTextureKey).toBe(fixture.textureKeys[frame]);
        expect(observation.tornadoRotation).toBe(0);
        expect(observation.containerRotation).toBe(0);
        expect(observation.flightAgeTicks).toBeGreaterThan(0);
        expect(Math.hypot(observation.vx, observation.vy)).toBeGreaterThan(0);
        observed.add(frame);
        tornadoes.push({
          weaponId: fixture.weaponId,
          subject: fixture.subject,
          frame,
          attackSeqBefore: attack.before,
          attackSeqAfter: attack.after,
          projectile: observation,
          screenshot: await screenshot(page, `${fixture.subject}-frame-${frame + 1}.png`),
        });
        await resume(page);
      }
      expect(observed).toEqual(new Set([0, 1, 2]));
    }

    await page.evaluate(() => {
      const holder = globalThis as any;
      if (holder.__b37ProjectileTimer) {
        window.clearInterval(holder.__b37ProjectileTimer);
        holder.__b37ProjectileTimer = undefined;
      }
    });
    const evidence = {
      verdict: "pass",
      capturedAt: new Date().toISOString(),
      character: CHARACTER_ID,
      privatePorts: {
        ...ports,
        forbiddenDefaultPortsAvoided:
          !FORBIDDEN_PORTS.has(ports.clientPort) && !FORBIDDEN_PORTS.has(ports.gamePort),
      },
      presentPayloadOdds: "1 in 8",
      tornadoFrameRate: 10,
      buffalo,
      presents: {
        shots: presents,
        variantsObserved: [...presentVariants].sort((a, b) => a - b),
        bigPayloadObserved: presentVariants.has(5),
      },
      streetsweeper: {
        attackSeqBefore: streetsweeperAttack.before,
        attackSeqAfter: streetsweeperAttack.after,
        arc: streetsweeperArc,
        explosion: streetsweeperExplosion,
        screenshots: [streetsweeperArcScreenshot, streetsweeperExplosionScreenshot],
      },
      tornadoes,
    };
    await writeFile(
      path.join(EVIDENCE_DIR, "live-gate.json"),
      `${JSON.stringify(evidence, null, 2)}\n`,
      "utf8",
    );
    await writeFile(
      path.join(EVIDENCE_DIR, "README.md"),
      [
        "# B37 art integrator live evidence",
        "",
        "PASS: Buffalo held/fired in both facings; seeded present variants included the rare big payload;",
        "the Streetsweeper used its painted arcing shell and 124 px authority-matched explosion;",
        "all three tornadoes rendered installed frames 1/2/3 at the tick-derived 10 fps phase.",
        "",
        `Private ports: client ${ports.clientPort}, game ${ports.gamePort}; 5180/2567 were not used.`,
        "",
        "See `live-gate.json` for authoritative rows, render texture keys, radii, frame phases, and screenshot paths.",
        "",
      ].join("\n"),
      "utf8",
    );
  });
});
