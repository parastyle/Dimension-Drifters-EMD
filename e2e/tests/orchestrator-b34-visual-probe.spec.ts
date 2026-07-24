import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { matchMaker } from "../../packages/server/node_modules/colyseus/build/index.mjs";
import { runArenaSpec } from "../helpers/arena-harness.js";

// Orchestrator visual gate: boots each corporate floor headless and retains captures.
const FLOORS = ["corporate-grid", "corporate-grid-portrait-hall", "corporate-grid-marble-gallery"];
const EVIDENCE_DIR = path.resolve(
  import.meta.dirname,
  "../../docs/owner-notes-audit-v11-evidence/b34-l2-elevator-loop",
);

interface ElevatorProbe {
  active: boolean;
  roomId: string;
  sessionId: string;
  character: string;
  x: number;
  corporateFloorId: string;
  corporateFloorDepth: number;
  corporateVariant: number;
  elevatorPhase: number;
  elevatorDeadlineTick: number;
  tick: number;
  enemies: number;
}

async function readElevatorProbe(page: Page): Promise<ElevatorProbe> {
  return page.evaluate(() => {
    const game = (
      globalThis as unknown as {
        ddGame?: {
          scene: {
            isActive(key: string): boolean;
            getScene(key: string): {
              room?: {
                roomId?: string;
                sessionId?: string;
                state?: {
                  players?: {
                    get(id: string):
                      | {
                          x?: number;
                          runCharacter?: string;
                          character?: string;
                        }
                      | undefined;
                  };
                  corporateFloorId?: string;
                  corporateFloorDepth?: number;
                  corporateVariant?: number;
                  elevatorPhase?: number;
                  elevatorDeadlineTick?: number;
                  tick?: number;
                  enemies?: { size: number };
                };
              };
            };
          };
        };
      }
    ).ddGame;
    const active = game?.scene.isActive("arena") ?? false;
    const room = active ? game?.scene.getScene("arena").room : undefined;
    const sessionId = room?.sessionId ?? "";
    const self = sessionId ? room?.state?.players?.get(sessionId) : undefined;
    return {
      active,
      roomId: room?.roomId ?? "",
      sessionId,
      character: self?.runCharacter ?? self?.character ?? "",
      x: self?.x ?? 0,
      corporateFloorId: room?.state?.corporateFloorId ?? "",
      corporateFloorDepth: room?.state?.corporateFloorDepth ?? 0,
      corporateVariant: room?.state?.corporateVariant ?? -1,
      elevatorPhase: room?.state?.elevatorPhase ?? -1,
      elevatorDeadlineTick: room?.state?.elevatorDeadlineTick ?? 0,
      tick: room?.state?.tick ?? 0,
      enemies: room?.state?.enemies?.size ?? 0,
    };
  });
}

for (const floor of FLOORS) {
  test(`captures ${floor}`, async ({ page }) => {
    await runArenaSpec(page, async (baseURL) => {
      await page.goto(`${baseURL}/?belt=${floor}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(9000);
      await page.keyboard.press("KeyH");
      await page.keyboard.down("KeyD");
      await page.waitForTimeout(2500);
      await page.keyboard.up("KeyD");
      await page.waitForTimeout(400);
      await page.screenshot({
        path: `docs/owner-notes-audit-v11-evidence/b34-l1-ldtk-pipeline/orchestrator-${floor}.png`,
      });
    });
  });
}

test("clears F1 and captures the endless elevator transition into short F2", async ({ page }) => {
  test.setTimeout(180_000);
  await mkdir(EVIDENCE_DIR, { recursive: true });
  // This gate deliberately owns a same-process ephemeral server so its bounded enemy fixture cannot
  // affect the suite's shared stack and the fixture reaches the exact module instance used by authority.
  const sharedStack = process.env.DD_E2E_BASE_URL;
  delete process.env.DD_E2E_BASE_URL;
  let combatFixture: ReturnType<typeof setInterval> | undefined;

  try {
    await runArenaSpec(page, async (baseURL) => {
      await page.goto(`${baseURL}/?belt=corporate-grid`, { waitUntil: "domcontentloaded" });
      await expect(
        page.locator("#game-root canvas"),
        "Phaser should mount the corporate floor",
      ).toBeVisible();
      await expect
        .poll(() => readElevatorProbe(page), {
          message: "F1 should join on the hidden-face cowboy in standard corporate-grid",
          timeout: 30_000,
        })
        .toMatchObject({
          active: true,
          character: "proto-cowboy-hidden-face",
          corporateFloorId: "office-red-carpet-gallery",
          corporateFloorDepth: 1,
          corporateVariant: 1,
          elevatorPhase: 0,
        });
      await page.keyboard.press("KeyH");
      await page.waitForTimeout(100);

      const clientPort = Number(new URL(page.url()).port);
      const gamePort = Number(new URL(page.url()).searchParams.get("port"));
      expect([clientPort, gamePort]).not.toContain(5180);
      expect([clientPort, gamePort]).not.toContain(2567);
      expect(clientPort).toBeGreaterThan(0);
      expect(gamePort).toBeGreaterThan(0);

      const identity = await readElevatorProbe(page);
      const localRoom = matchMaker.getLocalRoomById(identity.roomId) as unknown as
        | {
            state: {
              players: {
                get(id: string): { x: number; y: number; alive: boolean } | undefined;
              };
              enemies: {
                clear(): void;
              };
            };
          }
        | undefined;
      const authorityPlayer = localRoom?.state.players.get(identity.sessionId);
      if (!localRoom || !authorityPlayer)
        throw new Error(
          "dedicated corporate authority was unavailable to the bounded combat fixture",
        );

      // Bound the visual gate at the authority boundary: walk the real server player through each authored
      // gate and exhaust each emitted wave. The production room-clear state machine still owns every lock,
      // room advance, final-wave check, ready phase, countdown, and floor transition captured below.
      combatFixture = setInterval(() => {
        authorityPlayer.x = Math.min(4_056, authorityPlayer.x + 24);
        localRoom.state.enemies.clear();
      }, 50);
      await expect
        .poll(
          async () => {
            const state = await readElevatorProbe(page);
            return state.elevatorPhase === 1 && state.x >= 3_840;
          },
          {
            message: "real room waves should clear and arm the right exit beside the player",
            timeout: 30_000,
          },
        )
        .toBe(true);
      clearInterval(combatFixture);
      combatFixture = undefined;

      const ready = await readElevatorProbe(page);
      expect(ready.enemies).toBe(0);
      await page.waitForTimeout(180);
      await page.screenshot({ path: path.join(EVIDENCE_DIR, "f1-right-elevator-ready.png") });

      await page.evaluate(() => {
        const game = (
          globalThis as unknown as {
            ddGame?: {
              scene: {
                getScene(key: string): { room?: { send(type: string): void } };
              };
            };
          }
        ).ddGame;
        game?.scene.getScene("arena").room?.send("useElevator");
      });
      await expect
        .poll(async () => (await readElevatorProbe(page)).elevatorPhase, {
          message: "the accepted interaction should enter the shared countdown",
        })
        .toBe(2);
      await expect
        .poll(async () => (await readElevatorProbe(page)).elevatorPhase, {
          message: "the shared countdown should commit the party departure",
          timeout: 8_000,
          intervals: [50],
        })
        .toBe(3);
      await page.waitForTimeout(260);
      await page.screenshot({ path: path.join(EVIDENCE_DIR, "f1-elevator-departing-fade.png") });

      await expect
        .poll(() => readElevatorProbe(page), {
          message: "the same room should arrive on deterministic short Portrait F2",
          timeout: 8_000,
          intervals: [50],
        })
        .toMatchObject({
          corporateFloorId: "office-random-dude-portrait-hall",
          corporateFloorDepth: 2,
          corporateVariant: 0,
          elevatorPhase: 4,
        });
      await page.waitForTimeout(80);
      const arrival = await readElevatorProbe(page);
      expect(arrival.x).toBeLessThan(600);
      expect(arrival.elevatorPhase).toBe(4);
      await page.screenshot({ path: path.join(EVIDENCE_DIR, "f2-left-elevator-arrival.png") });

      await page.setViewportSize({ width: 3_840, height: 1_080 });
      await page.waitForTimeout(350);
      await page.screenshot({ path: path.join(EVIDENCE_DIR, "f2-short-full-hall.png") });

      await writeFile(
        path.join(EVIDENCE_DIR, "live-gate.json"),
        `${JSON.stringify(
          {
            verdict: "loop-live",
            ports: { client: clientPort, game: gamePort },
            character: arrival.character,
            ready,
            arrival,
            expectedF2PlayableBand: { minX: 120, maxX: 3_120, variant: "short" },
            captures: [
              "f1-right-elevator-ready.png",
              "f1-elevator-departing-fade.png",
              "f2-left-elevator-arrival.png",
              "f2-short-full-hall.png",
            ],
          },
          null,
          2,
        )}\n`,
        "utf8",
      );
    });
  } finally {
    if (combatFixture) clearInterval(combatFixture);
    if (sharedStack) process.env.DD_E2E_BASE_URL = sharedStack;
  }
});
