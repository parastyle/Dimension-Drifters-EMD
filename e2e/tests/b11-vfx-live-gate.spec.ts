import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { bootArena, runArenaSpec } from "../helpers/arena-harness.js";

const EVIDENCE_DIR = path.resolve(
  import.meta.dirname,
  "../../docs/owner-notes-audit-v10-evidence/b11-vfx",
);
const CHARACTER_ID = "proto-cowboy-hidden-face";
const FORBIDDEN_PORTS = new Set([5180, 2567]);
const FACINGS = ["right", "left"] as const;
const FIXTURES = [
  {
    id: "x2-dustreaper-zweihander",
    eventKind: "swing",
    objectName: "generated-image-vfx:x2-dustreaper-zweihander:fire-dragon",
    subject: "vfx-fire-dragon",
    recipeKind: "fire-dragon-sweep",
  },
  {
    id: "x2-mesa-heart-geodes",
    eventKind: "swing",
    objectName: "generated-image-vfx:x2-mesa-heart-geodes:crystal-pool",
    subject: "vfx-purple-crystal-family",
    recipeKind: "purple-crystal-burst",
  },
  {
    id: "x-staff-arcane-lance",
    eventKind: "projectile",
    objectName: "generated-image-vfx:x-staff-arcane-lance:projectile",
    subject: "vfx-arcanist-lance",
    recipeKind: "arcane-lance-projectile",
  },
] as const;

type Facing = (typeof FACINGS)[number];

interface B11VfxEvent {
  kind: string;
  weaponId: string;
  recipeKind: string;
  subject: string;
  textureKey: string;
  proceduralLayers: string[];
  x: number;
  y: number;
  angle?: number;
  visibleForwardExtent?: number;
  damageForwardExtent?: number;
  visibleHalfWidth?: number;
  damageHalfWidth?: number;
  projectileTipExtent?: number;
  projectileDamageTipExtent?: number;
  poolSize?: number;
}

interface BrowserPlayer {
  attackSeq: number;
  character?: string;
  weapon?: string;
  x: number;
  y: number;
}

interface BrowserObject {
  active?: boolean;
  alpha?: number;
  name?: string;
  visible?: boolean;
  displayWidth?: number;
  displayHeight?: number;
  rotation?: number;
  texture?: { key?: string };
  x?: number;
  y?: number;
  getData?(key: string): unknown;
  list?: BrowserObject[];
}

interface BrowserArena {
  blobs: Map<string, { facing: number; weaponDef?: { id: string } }>;
  cameras: { main: { setZoom(value: number): void } };
  children: { list: BrowserObject[] };
  game: { hasFocus: boolean };
  pointerOverInteractiveUi: boolean;
  projectiles: Map<string, BrowserObject>;
  room: {
    sessionId: string;
    send(type: string, message?: unknown): void;
    state: {
      players: { get(id: string): BrowserPlayer | undefined };
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
  __ddB11GeneratedImageVfxAudit?: B11VfxEvent[];
  __ddV6GAnchorCapture?: boolean;
  __ddV6GAnchorEvents?: Array<{
    kind?: string;
    weaponId?: string;
    layerIds?: string[];
    recipeId?: string;
  }>;
}

interface LiveCapture {
  weaponId: string;
  facing: Facing;
  attackSeqBefore: number;
  attackSeqAfter: number;
  generatedEvents: B11VfxEvent[];
  oldProceduralEvents: BrowserGlobal["__ddV6GAnchorEvents"];
  visibleObjects: Array<{
    name: string;
    alpha: number;
    displayWidth?: number;
    displayHeight?: number;
    textureKey?: string;
  }>;
  projectileRecipe: string | null;
  generatedProjectileWeaponId: string | null;
  screenshot: string;
}

function relativeEvidencePath(file: string): string {
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
    holder.__ddB11GeneratedImageVfxAudit = [];
    holder.__ddV6GAnchorCapture = true;
    holder.__ddV6GAnchorEvents = [];
  });
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
          const rig = arena.blobs.get(arena.room.sessionId);
          return {
            authorityWeapon: self?.weapon ?? null,
            rigWeapon: rig?.weaponDef?.id ?? null,
            character: self?.character ?? null,
            wanted,
          };
        }, weaponId),
      { message: `B11 gate should equip ${weaponId} on ${CHARACTER_ID}`, timeout: 20_000 },
    )
    .toEqual({
      authorityWeapon: weaponId,
      rigWeapon: weaponId,
      character: CHARACTER_ID,
      wanted: weaponId,
    });
}

async function commitFacing(page: Page, facing: Facing): Promise<void> {
  const canvas = page.locator("#game-root canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("B11 gate cannot locate the Phaser canvas");
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
      { message: `B11 rig should commit ${facing} facing`, timeout: 10_000 },
    )
    .toBe(facing === "right" ? 1 : -1);
}

async function fire(page: Page, weaponId: string, facing: Facing): Promise<number> {
  return await page.evaluate(
    ({ weaponId, facing }) => {
      const holder = globalThis as unknown as BrowserGlobal;
      const arena = holder.ddGame.scene.getScene("arena");
      const self = arena.room.state.players.get(arena.room.sessionId);
      if (!self || self.weapon !== weaponId) throw new Error(`B11 gate lost ${weaponId}`);
      holder.__ddB11GeneratedImageVfxAudit = [];
      holder.__ddV6GAnchorEvents = [];
      const direction = facing === "right" ? 1 : -1;
      arena.room.send("attack", {
        aimX: direction,
        aimY: 0,
        tx: self.x + direction * 360,
        ty: self.y,
      });
      return self.attackSeq;
    },
    { weaponId, facing },
  );
}

async function waitForAccepted(page: Page, before: number, weaponId: string): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
          return arena.room.state.players.get(arena.room.sessionId)?.attackSeq ?? 0;
        }),
      {
        message: `${weaponId} should be accepted by the private live server`,
        timeout: 10_000,
        intervals: [10, 16, 25],
      },
    )
    .toBeGreaterThan(before);
}

async function waitForVisibleSubject(
  page: Page,
  fixture: (typeof FIXTURES)[number],
): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(
          ({ eventKind, weaponId, objectName }) => {
            const holder = globalThis as unknown as BrowserGlobal;
            const arena = holder.ddGame.scene.getScene("arena");
            const eventSeen = (holder.__ddB11GeneratedImageVfxAudit ?? []).some(
              (event) => event.weaponId === weaponId && event.kind === eventKind,
            );
            if (!eventSeen) return false;
            if (eventKind === "projectile") {
              const self = arena.room.state.players.get(arena.room.sessionId);
              const visible = [...arena.projectiles.values()].some((projectile) => {
                if (
                  !self ||
                  projectile.getData?.("generatedImageWeaponId") !== weaponId ||
                  projectile.x === undefined ||
                  projectile.y === undefined
                )
                  return false;
                const distance = Math.hypot(projectile.x - self.x, projectile.y - self.y);
                return distance >= 130 && distance <= 300;
              });
              if (visible) arena.scene.pause();
              return visible;
            }
            const visible = arena.children.list.some(
              (child) =>
                child.name === objectName && child.visible !== false && (child.alpha ?? 1) > 0.72,
            );
            if (visible) arena.scene.pause();
            return visible;
          },
          {
            eventKind: fixture.eventKind,
            weaponId: fixture.id,
            objectName: fixture.objectName,
          },
        ),
      {
        message: `${fixture.id} generated subject should be visible at combat scale`,
        timeout: 10_000,
        intervals: [5, 10, 16],
      },
    )
    .toBe(true);
}

test("B11 generated-image VFX replace procedural treatments on both facings", async ({ page }) => {
  test.setTimeout(180_000);
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
        await page.waitForTimeout(700);
        const attackSeqBefore = await fire(page, fixture.id, facing);
        await waitForVisibleSubject(page, fixture);
        await waitForAccepted(page, attackSeqBefore, fixture.id);
        const screenshotFile = path.join(EVIDENCE_DIR, `${fixture.id}-${facing}.png`);
        await page.locator("#game-root canvas").screenshot({ path: screenshotFile });

        const measured = await page.evaluate(
          ({ weaponId, objectName }) => {
            const holder = globalThis as unknown as BrowserGlobal;
            const arena = holder.ddGame.scene.getScene("arena");
            const self = arena.room.state.players.get(arena.room.sessionId);
            if (!self) throw new Error(`B11 capture lost ${weaponId}`);
            const generatedEvents = (holder.__ddB11GeneratedImageVfxAudit ?? []).filter(
              (event) => event.weaponId === weaponId,
            );
            const oldProceduralEvents = (holder.__ddV6GAnchorEvents ?? []).filter(
              (event) => event.weaponId === weaponId,
            );
            const visibleObjects = arena.children.list
              .filter(
                (child) =>
                  child.name === objectName && child.visible !== false && (child.alpha ?? 1) > 0.05,
              )
              .map((child) => ({
                name: child.name ?? "",
                alpha: child.alpha ?? 1,
                displayWidth: child.displayWidth,
                displayHeight: child.displayHeight,
                textureKey: child.texture?.key,
              }));
            const projectile = [...arena.projectiles.values()].find(
              (candidate) => candidate.getData?.("generatedImageWeaponId") === weaponId,
            );
            const casterRecipe = projectile?.getData?.("casterRecipe") as
              | { key?: string }
              | undefined;
            return {
              attackSeqAfter: self.attackSeq,
              generatedEvents,
              oldProceduralEvents,
              visibleObjects,
              projectileRecipe: casterRecipe?.key ?? null,
              generatedProjectileWeaponId:
                (projectile?.getData?.("generatedImageWeaponId") as string | undefined) ?? null,
            };
          },
          { weaponId: fixture.id, objectName: fixture.objectName },
        );
        const capture: LiveCapture = {
          weaponId: fixture.id,
          facing,
          attackSeqBefore,
          ...measured,
          screenshot: relativeEvidencePath(screenshotFile),
        };
        await page.evaluate(() => {
          const arena = (globalThis as unknown as BrowserGlobal).ddGame.scene.getScene("arena");
          arena.scene.resume();
        });
        const primary = capture.generatedEvents.find((event) => event.kind === fixture.eventKind);
        expect(primary, `${fixture.id}/${facing}:generated event`).toMatchObject({
          weaponId: fixture.id,
          recipeKind: fixture.recipeKind,
          subject: fixture.subject,
          proceduralLayers: [],
        });
        expect(capture.oldProceduralEvents, `${fixture.id}/${facing}:old recipe events`).toEqual(
          [],
        );
        if (fixture.recipeKind === "fire-dragon-sweep") {
          expect(primary).toMatchObject({
            visibleForwardExtent: 300,
            damageForwardExtent: 300,
            visibleHalfWidth: 54,
            damageHalfWidth: 54,
            poolSize: 1,
          });
          expect(capture.visibleObjects.length).toBeGreaterThan(0);
        } else if (fixture.recipeKind === "purple-crystal-burst") {
          expect(primary).toMatchObject({
            visibleForwardExtent: 360,
            damageForwardExtent: 360,
            visibleHalfWidth: 58,
            damageHalfWidth: 58,
            poolSize: 6,
          });
          expect(capture.visibleObjects.length).toBeGreaterThan(0);
        } else {
          expect(primary).toMatchObject({
            projectileTipExtent: 72,
            projectileDamageTipExtent: 72,
            visibleHalfWidth: 17,
            damageHalfWidth: 17,
            poolSize: 1,
          });
          expect(capture.projectileRecipe).toBeNull();
          expect(capture.generatedProjectileWeaponId).toBe(fixture.id);
        }
        captures.push(capture);
      }
    }

    const assertions = {
      sixFacingCaptures: captures.length === FIXTURES.length * FACINGS.length,
      allSubjectsVisible: captures.every((capture) => capture.generatedEvents.length > 0),
      oldProceduralAbsent: captures.every(
        (capture) =>
          (capture.oldProceduralEvents?.length ?? 0) === 0 &&
          capture.generatedEvents.every((event) => event.proceduralLayers.length === 0),
      ),
      envelopesAligned: captures.every((capture) =>
        capture.generatedEvents
          .filter((event) => event.kind === "swing" || event.kind === "projectile")
          .every(
            (event) =>
              (event.visibleForwardExtent === undefined ||
                event.visibleForwardExtent === event.damageForwardExtent) &&
              (event.visibleHalfWidth === undefined ||
                event.visibleHalfWidth === event.damageHalfWidth) &&
              (event.projectileTipExtent === undefined ||
                event.projectileTipExtent === event.projectileDamageTipExtent),
          ),
      ),
      privatePorts: !FORBIDDEN_PORTS.has(clientPort) && !FORBIDDEN_PORTS.has(gamePort),
      wholeArtCharacter: CHARACTER_ID,
    };
    expect(assertions).toEqual({
      sixFacingCaptures: true,
      allSubjectsVisible: true,
      oldProceduralAbsent: true,
      envelopesAligned: true,
      privatePorts: true,
      wholeArtCharacter: CHARACTER_ID,
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
          assertions,
          captures,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  });
});
