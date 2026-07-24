import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { bootArena, runArenaSpec } from "../helpers/arena-harness.js";

const CHARACTER_ID = "proto-cowboy-hidden-face";
const RIOTGUN_ID = "x2-dustdevil-riotgun";
const PIKE_IDS = ["x2-nullspike-pike", "x2-cinderbrand-pike"] as const;
const LANTERN_ID = "x2-reliquary-lantern-wand";
const ARCHIVED_IDS = ["x2-glimmerdust-prospector-wand", "x2-tumbleweed-flail"] as const;
const EVIDENCE_DIR = path.resolve(
  import.meta.dirname,
  "../../docs/owner-notes-audit-v11-evidence/notes-quickfix",
);

type Facing = "left" | "right";

interface Point {
  x: number;
  y: number;
}

interface BrowserMatrix {
  a: number;
  b: number;
  c: number;
  d: number;
  tx: number;
  ty: number;
}

interface BrowserDisplay {
  width: number;
  height: number;
  displayOriginX: number;
  displayOriginY: number;
  getWorldTransformMatrix(): BrowserMatrix;
}

interface ProbeFrame {
  timeMs: number;
  weaponId: string;
  facing: number;
  attackSeq: number;
  swingOffX: number;
  secondaryGripDeltaPx: number | null;
  gunHandlingMechanism: string | null;
  gunHandlingForwardPx: number;
  gunHandlingLateralPx: number;
}

interface RapidThrustSample {
  weaponId: string;
  timeMs: number;
  poseProgress: number;
  extension: number;
  facing: number;
  attackBeatSeq: number;
}

interface ParticleProjectileAudit {
  weaponId: string;
  treatment: string;
  pack: string;
  particleCount: number;
  authoritativeX: number;
  authoritativeY: number;
  viewX: number;
  viewY: number;
  angle: number;
}

interface BrowserRig {
  animate(timeMs: number, anim: unknown): unknown;
  __ownerQuickfixOriginalAnimate?: (timeMs: number, anim: unknown) => unknown;
  __ownerQuickfixLastAnim?: unknown;
  swing?: { poseSeconds?: number };
  swingStart: number;
  weaponDef?: {
    id: string;
    gripFrac: number;
    gripPoints?: {
      primary: Point;
      secondary?: Point & { role?: string };
    };
    rapidThrust?: { impacts: number[] };
  };
  weapons: Array<{ img: BrowserDisplay }>;
  hands: Array<{ front: boolean; img: BrowserDisplay }>;
  facing?: number;
  swingOffX: number;
  gunHandlingCycles: Array<{
    mechanism?: string;
    offset?: { forward?: number; lateral?: number };
  }>;
}

interface BrowserArena {
  time: { now: number };
  game: { hasFocus: boolean };
  cameras: { main: { setZoom(zoom: number): void } };
  pointerOverInteractiveUi: boolean;
  blobs: Map<string, BrowserRig>;
  projectiles: Map<
    string,
    {
      x: number;
      y: number;
      name: string;
      list: Array<{ list?: unknown[] }>;
      getData(key: string): unknown;
    }
  >;
  verbs?: {
    isLegendOpen?(): boolean;
    toggleLegend?(timeMs: number): void;
    releaseInputLatchIf?(force: boolean): void;
  };
  room: {
    sessionId: string;
    send(type: string, message?: unknown): void;
    state: {
      players: {
        get(id: string): {
          weapon?: string;
          character?: string;
          attackSeq?: number;
          x?: number;
          y?: number;
        };
      };
      projectiles: {
        get(id: string): { x: number; y: number; sourceWeaponId?: string } | undefined;
      };
    };
  };
}

interface BrowserGlobal {
  ddGame: { scene: { getScene(key: string): BrowserArena } };
  __ownerQuickfixFrames?: ProbeFrame[];
  __ddOwnerQuickfixRapidThrustAudit?: RapidThrustSample[];
  __ddOwnerQuickfixParticleProjectileAudit?: ParticleProjectileAudit[];
}

function evidencePath(file: string): string {
  return path.relative(process.cwd(), file).replaceAll("\\", "/");
}

async function prepare(page: Page): Promise<void> {
  await page.locator("#game-root canvas").click({ position: { x: 640, y: 360 } });
  await page.evaluate(() => {
    const holder = globalThis as unknown as BrowserGlobal;
    const arena = holder.ddGame.scene.getScene("arena");
    if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend?.(arena.time.now);
    arena.verbs?.releaseInputLatchIf?.(true);
    arena.game.hasFocus = true;
    arena.pointerOverInteractiveUi = false;
    arena.cameras.main.setZoom(1.45);
    holder.__ownerQuickfixFrames = [];
  });
}

async function equip(page: Page, weaponId: string): Promise<void> {
  await page.evaluate(
    ({ weapon, character }) => {
      const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
      arena.room.send("devEquip", { weapon, character });
    },
    { weapon: weaponId, character: CHARACTER_ID },
  );
  await expect
    .poll(
      () =>
        page.evaluate((wanted) => {
          const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
          const self = arena.room.state.players.get(arena.room.sessionId);
          const rig = arena.blobs.get(arena.room.sessionId);
          return {
            authorityWeapon: self?.weapon ?? null,
            rigWeapon: rig?.weaponDef?.id ?? null,
            character: self?.character ?? null,
            wanted,
          };
        }, weaponId),
      { message: `quickfix gate should equip ${weaponId}`, timeout: 20_000 },
    )
    .toEqual({
      authorityWeapon: weaponId,
      rigWeapon: weaponId,
      character: CHARACTER_ID,
      wanted: weaponId,
    });
}

async function installProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const holder = globalThis as unknown as BrowserGlobal;
    const arena = holder.ddGame.scene.getScene("arena");
    const rig = arena.blobs.get(arena.room.sessionId);
    if (!rig || rig.__ownerQuickfixOriginalAnimate) return;
    const anchorWorld = (display: BrowserDisplay, point: Point): Point => {
      const matrix = display.getWorldTransformMatrix();
      const localX = point.x * display.width - display.displayOriginX;
      const localY = point.y * display.height - display.displayOriginY;
      return {
        x: matrix.tx + matrix.a * localX + matrix.c * localY,
        y: matrix.ty + matrix.b * localX + matrix.d * localY,
      };
    };
    const worldOrigin = (display: BrowserDisplay): Point => {
      const matrix = display.getWorldTransformMatrix();
      return { x: matrix.tx, y: matrix.ty };
    };
    rig.__ownerQuickfixOriginalAnimate = rig.animate;
    rig.animate = function ownerQuickfixCapture(
      this: BrowserRig,
      timeMs: number,
      anim: unknown,
    ): unknown {
      this.__ownerQuickfixLastAnim = anim;
      const result = this.__ownerQuickfixOriginalAnimate?.call(this, timeMs, anim);
      const weaponId = this.weaponDef?.id;
      const weapon = this.weapons[0]?.img;
      const self = arena.room.state.players.get(arena.room.sessionId);
      if (!weaponId || !weapon || !self) return result;
      const secondary = this.weaponDef?.gripPoints?.secondary;
      const backHand = this.hands.find((hand) => !hand.front)?.img;
      const grip = secondary ? anchorWorld(weapon, secondary) : undefined;
      const hand = backHand ? worldOrigin(backHand) : undefined;
      const cycle = this.gunHandlingCycles[0];
      holder.__ownerQuickfixFrames?.push({
        timeMs,
        weaponId,
        facing: this.facing ?? 1,
        attackSeq: self.attackSeq ?? 0,
        swingOffX: this.swingOffX ?? 0,
        secondaryGripDeltaPx: grip && hand ? Math.hypot(grip.x - hand.x, grip.y - hand.y) : null,
        gunHandlingMechanism: cycle?.mechanism ?? null,
        gunHandlingForwardPx: cycle?.offset?.forward ?? 0,
        gunHandlingLateralPx: cycle?.offset?.lateral ?? 0,
      });
      if ((holder.__ownerQuickfixFrames?.length ?? 0) > 4_000)
        holder.__ownerQuickfixFrames?.shift();
      return result;
    };
  });
}

async function commitFacing(page: Page, facing: Facing): Promise<void> {
  const canvas = page.locator("#game-root canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("quickfix gate cannot locate the Phaser canvas");
  await page.mouse.move(
    box.x + box.width * (facing === "right" ? 0.88 : 0.12),
    box.y + box.height * 0.5,
  );
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
          return arena.blobs.get(arena.room.sessionId)?.facing ?? 0;
        }),
      { message: `quickfix rig should face ${facing}`, timeout: 10_000 },
    )
    .toBe(facing === "right" ? 1 : -1);
}

async function acceptAttack(page: Page, facing: Facing): Promise<number> {
  const start = await page.evaluate(() => {
    const holder = globalThis as unknown as BrowserGlobal;
    const arena = holder.ddGame.scene.getScene("arena");
    holder.__ownerQuickfixFrames = [];
    return arena.room.state.players.get(arena.room.sessionId)?.attackSeq ?? 0;
  });
  await expect
    .poll(
      () =>
        page.evaluate(
          ({ initial, direction }) => {
            const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
            const self = arena.room.state.players.get(arena.room.sessionId);
            const current = self?.attackSeq ?? 0;
            if ((current - initial) >>> 0 > 0) return current;
            const aimX = direction === "right" ? 1 : -1;
            arena.room.send("attack", {
              aimX,
              aimY: 0,
              tx: (self?.x ?? 0) + aimX * 500,
              ty: self?.y ?? 0,
            });
            return current;
          },
          { initial: start, direction: facing },
        ),
      { message: "quickfix attack should be accepted", timeout: 8_000, intervals: [60, 80, 100] },
    )
    .toBeGreaterThan(start);
  return await page.evaluate(() => {
    const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
    return arena.room.state.players.get(arena.room.sessionId)?.attackSeq ?? 0;
  });
}

async function probeFrames(page: Page): Promise<ProbeFrame[]> {
  return await page.evaluate(() => [
    ...((globalThis as unknown as BrowserGlobal).__ownerQuickfixFrames ?? []),
  ]);
}

function rapidThrustPeaks(
  samples: RapidThrustSample[],
): Array<{ timeMs: number; extension: number; poseProgress: number }> {
  const groups: RapidThrustSample[][] = [];
  let insidePeak = false;
  for (const sample of samples) {
    if (sample.extension < 0.62) {
      insidePeak = false;
      continue;
    }
    const group = insidePeak ? groups.at(-1) : undefined;
    if (group) group.push(sample);
    else groups.push([sample]);
    insidePeak = true;
  }
  return groups.map((group) => {
    const peak = group.reduce((best, frame) => (frame.extension > best.extension ? frame : best));
    return {
      timeMs: peak.timeMs,
      extension: peak.extension,
      poseProgress: peak.poseProgress,
    };
  });
}

test("owner-notes quickfix batch passes the private live gate", async ({ page }) => {
  await runArenaSpec(page, async (baseURL) => {
    await mkdir(EVIDENCE_DIR, { recursive: true });
    await bootArena(page, baseURL, `char:${CHARACTER_ID}`);
    await prepare(page);

    const pageUrl = new URL(page.url());
    const ports = {
      client: Number(new URL(baseURL).port),
      game: Number(pageUrl.searchParams.get("port")),
    };
    expect(ports.client).not.toBe(5180);
    expect(ports.game).not.toBe(2567);
    expect(ports.client).toBeGreaterThan(0);
    expect(ports.game).toBeGreaterThan(0);

    await equip(page, RIOTGUN_ID);
    await installProbe(page);
    const riotgun: Record<Facing, unknown> = { left: null, right: null };
    for (const facing of ["right", "left"] as const) {
      await commitFacing(page, facing);
      const attackSeq = await acceptAttack(page, facing);
      await page.waitForTimeout(90);
      const screenshot = path.join(EVIDENCE_DIR, `${RIOTGUN_ID}-${facing}-fire.png`);
      await page.locator("#game-root canvas").screenshot({ path: screenshot });
      await page.waitForTimeout(520);
      const allFrames = await probeFrames(page);
      const frames = allFrames.filter(
        (frame) => frame.weaponId === RIOTGUN_ID && frame.facing === (facing === "right" ? 1 : -1),
      );
      const gripDeltas = frames
        .map((frame) => frame.secondaryGripDeltaPx)
        .filter((delta): delta is number => delta !== null);
      expect(frames.length, `${facing} Riotgun fire cycle should be sampled`).toBeGreaterThan(12);
      expect(
        Math.max(...gripDeltas),
        `${facing} support hand must stay on the foregrip`,
      ).toBeLessThanOrEqual(7);
      expect(new Set(frames.map((frame) => frame.gunHandlingMechanism))).toEqual(new Set([null]));
      expect(Math.max(...frames.map((frame) => Math.abs(frame.gunHandlingForwardPx)))).toBe(0);
      expect(Math.max(...frames.map((frame) => Math.abs(frame.gunHandlingLateralPx)))).toBe(0);
      const grip = await page.evaluate(() => {
        const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
        return arena.blobs.get(arena.room.sessionId)?.weaponDef?.gripPoints?.secondary ?? null;
      });
      expect(grip).toMatchObject({ x: 0.8, y: 0.78, role: "vertical-foregrip" });
      riotgun[facing] = {
        attackSeq,
        frames: frames.length,
        maxSecondaryGripDeltaPx: Math.max(...gripDeltas),
        mechanisms: [...new Set(frames.map((frame) => frame.gunHandlingMechanism))],
        maxHandlingOffsetPx: Math.max(
          ...frames.map((frame) =>
            Math.hypot(frame.gunHandlingForwardPx, frame.gunHandlingLateralPx),
          ),
        ),
        screenshot: evidencePath(screenshot),
      };
    }

    const archived: Array<{ id: string; before: string | null; after: string | null }> = [];
    for (const id of ARCHIVED_IDS) {
      const row = await page.evaluate(
        async ({ archivedId, characterId }) => {
          const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
          const self = arena.room.state.players.get(arena.room.sessionId);
          const before = self?.weapon ?? null;
          arena.room.send("devEquip", { weapon: archivedId, character: characterId });
          await new Promise((resolve) => window.setTimeout(resolve, 300));
          return {
            id: archivedId,
            before,
            after: arena.room.state.players.get(arena.room.sessionId)?.weapon ?? null,
          };
        },
        { archivedId: id, characterId: CHARACTER_ID },
      );
      expect(row.after, `${id} must be rejected by the active-pool dev equip`).toBe(row.before);
      archived.push(row);
    }

    const pikes: Array<{
      id: string;
      attackSeq: number;
      peaks: Array<{ timeMs: number; extension: number; poseProgress: number }>;
      peakSpanMs: number;
      screenshot: string;
    }> = [];
    for (const id of PIKE_IDS) {
      await equip(page, id);
      await installProbe(page);
      await commitFacing(page, "right");
      await page.evaluate(() => {
        (globalThis as unknown as BrowserGlobal).__ddOwnerQuickfixRapidThrustAudit = [];
      });
      const attackSeq = await acceptAttack(page, "right");
      await page.waitForTimeout(260);
      const screenshot = path.join(EVIDENCE_DIR, `${id}-fast-triple.png`);
      await page.locator("#game-root canvas").screenshot({ path: screenshot });
      await page.waitForTimeout(620);
      const samples = await page.evaluate(() => {
        const holder = globalThis as unknown as BrowserGlobal;
        const arena = holder.ddGame.scene.getScene("arena");
        const rig = arena.blobs.get(arena.room.sessionId);
        if (!rig?.swing || !rig.__ownerQuickfixOriginalAnimate || !rig.__ownerQuickfixLastAnim)
          throw new Error("accepted rapid-thrust descriptor is unavailable for phase evidence");
        holder.__ddOwnerQuickfixRapidThrustAudit = [];
        const durationMs = Math.max(1, (rig.swing.poseSeconds ?? 0) * 1_000);
        for (let sample = 0; sample <= 80; sample++) {
          rig.__ownerQuickfixOriginalAnimate.call(
            rig,
            rig.swingStart + durationMs * (sample / 80),
            rig.__ownerQuickfixLastAnim,
          );
        }
        return [...holder.__ddOwnerQuickfixRapidThrustAudit];
      });
      const weaponSamples = samples.filter((sample) => sample.weaponId === id);
      const peaks = rapidThrustPeaks(weaponSamples);
      expect(
        peaks,
        `${id} should visibly extend three distinct times (samples=${weaponSamples.length})`,
      ).toHaveLength(3);
      const firstPeak = peaks[0];
      const lastPeak = peaks.at(-1);
      if (!firstPeak || !lastPeak) throw new Error(`${id} rapid-thrust peaks disappeared`);
      const peakSpanMs = lastPeak.timeMs - firstPeak.timeMs;
      expect(peakSpanMs, `${id} triple should land inside one fast attack window`).toBeLessThan(
        420,
      );
      for (let index = 1; index < peaks.length; index++) {
        const peak = peaks[index];
        const priorPeak = peaks[index - 1];
        if (!peak || !priorPeak) throw new Error(`${id} rapid-thrust interval disappeared`);
        expect(peak.timeMs - priorPeak.timeMs).toBeLessThan(220);
      }
      pikes.push({
        id,
        attackSeq,
        peaks,
        peakSpanMs,
        screenshot: evidencePath(screenshot),
      });
    }

    await equip(page, LANTERN_ID);
    await commitFacing(page, "right");
    await page.evaluate(() => {
      (globalThis as unknown as BrowserGlobal).__ddOwnerQuickfixParticleProjectileAudit = [];
    });
    const lanternAttackSeq = await acceptAttack(page, "right");
    const lanternProjectile = await expect
      .poll(
        () =>
          page.evaluate(
            (weaponId) =>
              (
                globalThis as unknown as BrowserGlobal
              ).__ddOwnerQuickfixParticleProjectileAudit?.find(
                (event) => event.weaponId === weaponId,
              ) ?? null,
            LANTERN_ID,
          ),
        {
          message: "Reliquary Lantern should create an authoritative particle-stream projectile",
          timeout: 8_000,
          intervals: [16, 20, 24],
        },
      )
      .not.toBeNull()
      .then(async () =>
        page.evaluate(
          (weaponId) =>
            (globalThis as unknown as BrowserGlobal).__ddOwnerQuickfixParticleProjectileAudit?.find(
              (event) => event.weaponId === weaponId,
            ) ?? null,
          LANTERN_ID,
        ),
      );
    expect(lanternProjectile).toMatchObject({
      treatment: "particle-stream",
      pack: "holy-spark",
      particleCount: 4,
    });
    expect(
      Math.hypot(
        (lanternProjectile?.viewX ?? 0) - (lanternProjectile?.authoritativeX ?? 0),
        (lanternProjectile?.viewY ?? 0) - (lanternProjectile?.authoritativeY ?? 0),
      ),
    ).toBe(0);
    const lanternScreenshot = path.join(EVIDENCE_DIR, `${LANTERN_ID}-particle-projectile.png`);
    await page.locator("#game-root canvas").screenshot({ path: lanternScreenshot });

    const evidence = {
      verdict: {
        archivedWeaponsRejectedByActivePool: archived.every((row) => row.after === row.before),
        riotgunForegripPlantedBothFacings: true,
        pikeVisibleThrustsPerAttack: Object.fromEntries(
          pikes.map((pike) => [pike.id, pike.peaks.length]),
        ),
        lanternParticleProjectile: true,
      },
      character: CHARACTER_ID,
      privateEphemeralPorts: ports,
      riotgun,
      archived,
      pikes,
      lantern: {
        attackSeq: lanternAttackSeq,
        ...lanternProjectile,
        screenshot: evidencePath(lanternScreenshot),
      },
    };
    await writeFile(
      path.join(EVIDENCE_DIR, "live-gate.json"),
      `${JSON.stringify(evidence, null, 2)}\n`,
      "utf8",
    );
    await writeFile(
      path.join(EVIDENCE_DIR, "README.md"),
      [
        "# Owner-notes quickfix live gate",
        "",
        `- Character: \`${CHARACTER_ID}\``,
        `- Private ports: client \`${ports.client}\`, game \`${ports.game}\` (neither reserved port used)`,
        "- Archived weapons: both rejected by the live active-pool equip path",
        "- Riotgun: support-hand/vertical-foregrip delta stayed within 7 px through firing, both facings; mechanism and handling offset remained null/zero",
        "- Nullspike and Cinderbrand: three separate high-extension groups inside one accepted attack each",
        "- Reliquary Lantern: four `holy-spark` particle-pack frames tracked the authoritative projectile row",
        "",
        "Machine-readable timings, deltas, attack sequence receipts, port receipts, and screenshot paths are in `live-gate.json`.",
        "",
      ].join("\n"),
      "utf8",
    );
  });
});
