import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import {
  type BrowserGame,
  bootArena,
  runArenaSpec,
  waitForDevWeapon,
} from "../helpers/arena-harness.js";

const EVIDENCE_DIR = path.resolve("docs/owner-notes-audit-v9-evidence/b10-vfx");

interface B10Event {
  kind: string;
  weaponId: string;
  textureKey: string;
  subjects: string[];
  removedSubjects?: string[];
  displayDiameter?: number;
  damageDiameter?: number;
  displayWidth?: number;
  forwardExtent?: number;
  damageExtent?: number;
  tint?: number;
}

interface ArenaProbe {
  room: {
    sessionId: string;
    send(type: string, message?: unknown): void;
    state: {
      players: {
        get(id: string): {
          attackSeq: number;
          attackHeld?: boolean;
          weapon?: string;
          x: number;
          y: number;
        };
      };
    };
  };
  blobs: Map<
    string,
    {
      root: { scaleX: number; scaleY: number };
      paintedAuraFill: Array<{
        visible: boolean;
        texture: { key: string };
        displayWidth: number;
        displayHeight: number;
        x: number;
        y: number;
        alpha: number;
      }>;
      activeSwing?: { style?: string; elapsed?: number };
    }
  >;
  children: {
    list: Array<{
      name?: string;
      visible?: boolean;
      displayWidth?: number;
      displayHeight?: number;
      alpha?: number;
      texture?: { key?: string };
    }>;
  };
  input?: { activePointer?: { rightButtonDown: () => boolean } };
  stepNetInput?(
    deltaMs: number,
    levelWindowOpen: boolean,
    ultimatePressed: boolean,
    nextDx: number,
    nextDy: number,
  ): void;
  verbs?: {
    isLegendOpen?(): boolean;
    toggleLegend?(nowMs: number): void;
    releaseInputLatchIf?(release: boolean): void;
  };
  time?: { now: number };
  game?: { hasFocus: boolean };
  vfxPlayer: {
    bladeExtensions: Map<string, { weaponId: string }>;
  };
}

declare global {
  // eslint-disable-next-line no-var
  var __ddB10VfxCapture: boolean | undefined;
  // eslint-disable-next-line no-var
  var __ddB10VfxEvents: B10Event[] | undefined;
  // eslint-disable-next-line no-var
  var __ddB10InputTimer: number | undefined;
}

async function prepareWeapon(page: Page, baseURL: string, weaponId: string): Promise<void> {
  await bootArena(page, baseURL, `weapon:${weaponId}`);
  await waitForDevWeapon(page, weaponId);
  await page.locator("#game-root canvas").click({ position: { x: 640, y: 360 } });
  await page.evaluate(() => {
    globalThis.__ddB10VfxCapture = true;
    globalThis.__ddB10VfxEvents = [];
    const game = (globalThis as unknown as { ddGame: BrowserGame }).ddGame;
    const arena = game.scene.getScene("arena") as unknown as ArenaProbe;
    if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend?.(arena.time?.now ?? 0);
    arena.verbs?.releaseInputLatchIf?.(true);
    if (arena.game) arena.game.hasFocus = true;
  });
}

async function sendAttack(page: Page): Promise<number> {
  return await page.evaluate(() => {
    const game = (globalThis as unknown as { ddGame: BrowserGame }).ddGame;
    const arena = game.scene.getScene("arena") as unknown as ArenaProbe;
    const self = arena.room.state.players.get(arena.room.sessionId);
    arena.room.send("attack", {
      aimX: 1,
      aimY: 0,
      tx: self.x + 300,
      ty: self.y,
    });
    return self.attackSeq;
  });
}

async function waitForAcceptedAttack(page: Page, before: number): Promise<number> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const game = (globalThis as unknown as { ddGame: BrowserGame }).ddGame;
          const arena = game.scene.getScene("arena") as unknown as ArenaProbe;
          return arena.room.state.players.get(arena.room.sessionId).attackSeq;
        }),
      { message: "live server should accept the B10 attack", timeout: 10_000 },
    )
    .toBeGreaterThan(before);
  return before + 1;
}

async function acceptedAttack(page: Page): Promise<number> {
  const before = await sendAttack(page);
  return await waitForAcceptedAttack(page, before);
}

async function waitForEvent(page: Page, kind: string, weaponId: string): Promise<B10Event> {
  await expect
    .poll(
      () =>
        page.evaluate(
          ({ wantedKind, wantedWeapon }) =>
            globalThis.__ddB10VfxEvents?.find(
              (event) => event.kind === wantedKind && event.weaponId === wantedWeapon,
            ) ?? null,
          { wantedKind: kind, wantedWeapon: weaponId },
        ),
      { message: `${weaponId} should emit ${kind}`, timeout: 10_000 },
    )
    .not.toBeNull();
  const event = await page.evaluate(
    ({ wantedKind, wantedWeapon }) =>
      globalThis.__ddB10VfxEvents?.find(
        (candidate) => candidate.kind === wantedKind && candidate.weaponId === wantedWeapon,
      ) ?? null,
    { wantedKind: kind, wantedWeapon: weaponId },
  );
  if (!event) throw new Error(`Missing ${kind} event for ${weaponId}`);
  return event;
}

test.use({ viewport: { width: 1280, height: 720 } });

test("B10 live weapon VFX acceptance", async ({ page }) => {
  test.setTimeout(120_000);
  await runArenaSpec(page, async (baseURL) => {
    await mkdir(EVIDENCE_DIR, { recursive: true });
    const evidence: Record<string, unknown> = {
      capturedAt: new Date().toISOString(),
      privateClientBaseURL: baseURL,
    };

    const fulguriteId = "x2-fulgurite-storm-sphere";
    await prepareWeapon(page, baseURL, fulguriteId);
    await page.evaluate(() => {
      const game = (globalThis as unknown as { ddGame: BrowserGame }).ddGame;
      const arena = game.scene.getScene("arena") as unknown as ArenaProbe;
      if (!arena.input?.activePointer || !arena.stepNetInput) return;
      arena.input.activePointer.rightButtonDown = () => true;
      globalThis.__ddB10InputTimer = window.setInterval(
        () => arena.stepNetInput?.(50, false, false, 0, 0),
        50,
      );
    });
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const game = (globalThis as unknown as { ddGame: BrowserGame }).ddGame;
            const arena = game.scene.getScene("arena") as unknown as ArenaProbe;
            return arena.room.state.players.get(arena.room.sessionId).attackHeld === true;
          }),
        { message: "Fulgurite aura should be held live", timeout: 10_000 },
      )
      .toBe(true);
    await page.waitForTimeout(250);
    const fulgurite = await page.evaluate(() => {
      const game = (globalThis as unknown as { ddGame: BrowserGame }).ddGame;
      const arena = game.scene.getScene("arena") as unknown as ArenaProbe;
      const rig = arena.blobs.get(arena.room.sessionId);
      if (!rig) throw new Error("Missing local Fulgurite rig");
      return {
        pageURL: location.href,
        fills: rig.paintedAuraFill.map((fill) => ({
          visible: fill.visible,
          textureKey: fill.texture.key,
          worldWidth: fill.displayWidth * Math.abs(rig.root.scaleX),
          worldHeight: fill.displayHeight * Math.abs(rig.root.scaleY),
          localCenter: { x: fill.x, y: fill.y },
          alpha: fill.alpha,
        })),
      };
    });
    expect(fulgurite.fills[0]).toMatchObject({
      visible: true,
      textureKey: "b10:fulgurite-blue-fill",
    });
    expect(fulgurite.fills[0]?.worldWidth).toBeCloseTo(900, 1);
    expect(fulgurite.fills[1]?.worldWidth).toBeCloseTo(558, 1);
    await page
      .locator("#game-root canvas")
      .screenshot({ path: path.join(EVIDENCE_DIR, "fulgurite-continuous-blue-aura.png") });
    evidence.fulgurite = fulgurite;
    await page.evaluate(() => {
      const game = (globalThis as unknown as { ddGame: BrowserGame }).ddGame;
      const arena = game.scene.getScene("arena") as unknown as ArenaProbe;
      if (arena.input?.activePointer) arena.input.activePointer.rightButtonDown = () => false;
      arena.stepNetInput?.(50, false, false, 0, 0);
      if (globalThis.__ddB10InputTimer) window.clearInterval(globalThis.__ddB10InputTimer);
      globalThis.__ddB10InputTimer = undefined;
    });

    const voulgeId = "x2-thunderhead-voulge";
    await prepareWeapon(page, baseURL, voulgeId);
    const liveVoulgeReady = page.waitForFunction(
      () => {
        const game = (globalThis as unknown as { ddGame: BrowserGame }).ddGame;
        const arena = game.scene.getScene("arena") as unknown as ArenaProbe;
        return arena.children.list.some(
          (child) => child.name === "weapon-painted-swing:x2-thunderhead-voulge",
        );
      },
      undefined,
      { polling: "raf", timeout: 10_000 },
    );
    const voulgeBefore = await sendAttack(page);
    await liveVoulgeReady;
    const liveVoulge = await page.evaluate(() => {
      const game = (globalThis as unknown as { ddGame: BrowserGame }).ddGame;
      const arena = game.scene.getScene("arena") as unknown as ArenaProbe;
      return arena.children.list
        .filter((child) => child.name === "weapon-painted-swing:x2-thunderhead-voulge")
        .map((child) => ({
          visible: child.visible,
          textureKey: child.texture?.key,
          displayWidth: child.displayWidth,
          displayHeight: child.displayHeight,
          alpha: child.alpha,
        }));
    });
    expect(liveVoulge.length).toBeGreaterThan(0);
    await page
      .locator("#game-root canvas")
      .screenshot({ path: path.join(EVIDENCE_DIR, "thunderhead-large-blue-swing.png") });
    await waitForAcceptedAttack(page, voulgeBefore);
    const voulge = await waitForEvent(page, "painted-swing", voulgeId);
    expect(voulge).toMatchObject({
      textureKey: "b10:thunderhead-voulge-blue",
      subjects: ["blue-electric-arc"],
      tint: 0x33e6ff,
    });
    expect(voulge.forwardExtent).toBe(voulge.damageExtent);
    expect(voulge.displayWidth).toBeGreaterThan(230);
    evidence.thunderheadVoulge = { event: voulge, liveObjects: liveVoulge };

    const tombstoneId = "tombstone-greatsword";
    await prepareWeapon(page, baseURL, tombstoneId);
    await acceptedAttack(page);
    const tombstone = await waitForEvent(page, "painted-quake", tombstoneId);
    expect(tombstone.subjects).toEqual(["stone", "smoke"]);
    expect(tombstone.removedSubjects).toEqual(["bone"]);
    expect(tombstone.subjects).not.toContain("bone");
    expect(tombstone.displayDiameter).toBe(tombstone.damageDiameter);
    await page
      .locator("#game-root canvas")
      .screenshot({ path: path.join(EVIDENCE_DIR, "tombstone-stone-smoke-zero-bone.png") });
    evidence.tombstone = tombstone;

    const headsmanId = "x2-sanctified-headsman";
    await prepareWeapon(page, baseURL, headsmanId);
    const headsmanAttackSeq = await acceptedAttack(page);
    await page.waitForTimeout(180);
    const headsman = await page.evaluate((weaponId) => {
      const game = (globalThis as unknown as { ddGame: BrowserGame }).ddGame;
      const arena = game.scene.getScene("arena") as unknown as ArenaProbe;
      const rig = arena.blobs.get(arena.room.sessionId);
      const specialNames = arena.children.list
        .map((child) => child.name ?? "")
        .filter((name) => name.includes("headsman") || name.includes("weapon-painted"));
      return {
        pageURL: location.href,
        attackSeq: arena.room.state.players.get(arena.room.sessionId).attackSeq,
        activeSwing: rig?.activeSwing ?? null,
        b10Events: (globalThis.__ddB10VfxEvents ?? []).filter(
          (event) => event.weaponId === weaponId,
        ),
        extensionRows: [...arena.vfxPlayer.bladeExtensions.values()].filter(
          (extension) => extension.weaponId === weaponId,
        ),
        specialNames,
      };
    }, headsmanId);
    expect(headsman.attackSeq).toBeGreaterThanOrEqual(headsmanAttackSeq);
    expect(headsman.activeSwing).not.toBeNull();
    expect(headsman.b10Events).toEqual([]);
    expect(headsman.extensionRows).toEqual([]);
    expect(headsman.specialNames).toEqual([]);
    await page
      .locator("#game-root canvas")
      .screenshot({ path: path.join(EVIDENCE_DIR, "headsman-normal-sword-zero-special-vfx.png") });
    evidence.sanctifiedHeadsman = headsman;

    evidence.privateRuntimeURL = page.url();
    await writeFile(
      path.join(EVIDENCE_DIR, "live-capture.json"),
      `${JSON.stringify(evidence, null, 2)}\n`,
      "utf8",
    );
  });
});
