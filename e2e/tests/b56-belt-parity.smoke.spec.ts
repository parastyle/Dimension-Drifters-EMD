import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { BELT_Y0, ChestState } from "@dd/shared";
import { expect, type Page, test } from "@playwright/test";
import { matchMaker } from "../../packages/server/node_modules/colyseus/build/index.mjs";
import { bootArena, runArenaSpec } from "../helpers/arena-harness.js";

const EVIDENCE_DIR = path.resolve(
  import.meta.dirname,
  "../../docs/owner-notes-audit-v12-evidence/b56-belt-parity",
);
const LEVEL_ID = "corporate-grid";
const CHARACTER_ID = "proto-cowboy-hidden-face";
const AIM_WEAPON_ID = "x2-barrett-50-cal-sniper";
const BELT_FORESHORTEN = 0.5;

interface BeltBootSnapshot {
  active: boolean;
  belt: boolean;
  roomId: string;
  sessionId: string;
  character: string;
  corporateFloorId: string;
  corporateFloorDepth: number;
}

interface UiSnapshot {
  weaponDock: boolean;
  backpackAffordance: boolean;
  backpackPanel: boolean;
  money: boolean;
  health: boolean;
  relicRow: boolean;
  floorCounter: boolean;
  prompts: boolean;
  objective: boolean;
  copy: {
    arsenal: string[];
    health: string;
    relics: string;
    floor: string;
    prompt: string;
    objective: string;
  };
}

interface AimSnapshot {
  cursor: { x: number; y: number };
  rig: { x: number; y: number };
  expected: { x: number; y: number };
  selfAim: { x: number; y: number };
  weaponAxis: { x: number; y: number };
  facing: number;
  pointerMoves: number;
}

interface PositionSample {
  wallMs: number;
  rootX: number;
  rootY: number;
  candidateX: number;
  candidateY: number;
  presentedWorldX: number;
  presentedWorldY: number;
  serverX: number;
  serverY: number;
}

interface PositionTrace {
  samples: PositionSample[];
  maxRootStepPx: number;
  maxUnexpectedRootStepPx: number;
  maxProjectionErrorPx: number;
  maxServerProjectionErrorPx: number;
}

interface ActionSnapshot {
  attackSeqBefore: number;
  attackSeqAfter: number;
  parryCooldown: number;
  dodgeStance: number;
  jumpHeight: number;
}

interface AuthorityPlayer {
  hp: number;
  maxHp: number;
  alive: boolean;
  x: number;
  y: number;
  attackSeq: number;
  moveStance: number;
  height: number;
  dualWield: { relics: { moveSpeed: number } };
}

interface AuthorityRoom {
  state: {
    tick: number;
    players: { get(id: string): AuthorityPlayer | undefined };
    enemies: { clear(): void };
    chests: {
      set(id: string, chest: ChestState): void;
      get(id: string): ChestState | undefined;
    };
  };
  broadcastPatch?(): void;
}

async function bootBelt(
  page: Page,
  baseURL: string,
  levelId = LEVEL_ID,
): Promise<BeltBootSnapshot> {
  await page.goto(`${baseURL}/?belt=${levelId}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#game-root canvas"), "belt boot should mount Phaser").toBeVisible();
  await expect
    .poll(() => readBoot(page), {
      message: "belt deep-link should activate ArenaScene and join its corporate room",
      timeout: 30_000,
    })
    .toMatchObject({ active: true, belt: true, character: CHARACTER_ID });
  const boot = await readBoot(page);
  expect(boot.roomId).not.toBe("");
  expect(boot.sessionId).not.toBe("");
  expect(boot.corporateFloorId).not.toBe("");
  expect(boot.corporateFloorDepth).toBeGreaterThan(0);
  return boot;
}

async function readBoot(page: Page): Promise<BeltBootSnapshot> {
  return page.evaluate(() => {
    const game = (
      globalThis as unknown as {
        ddGame?: {
          scene: {
            isActive(key: string): boolean;
            getScene(key: string): {
              belt?: boolean;
              room?: {
                roomId?: string;
                sessionId?: string;
                state?: {
                  corporateFloorId?: string;
                  corporateFloorDepth?: number;
                  players?: {
                    get(id: string): { runCharacter?: string; character?: string } | undefined;
                  };
                };
              };
            };
          };
        };
      }
    ).ddGame;
    const arena = game?.scene.getScene("arena");
    const sessionId = arena?.room?.sessionId ?? "";
    const self = sessionId ? arena?.room?.state?.players?.get(sessionId) : undefined;
    return {
      active: game?.scene.isActive("arena") ?? false,
      belt: arena?.belt === true,
      roomId: arena?.room?.roomId ?? "",
      sessionId,
      character: self?.runCharacter ?? self?.character ?? "",
      corporateFloorId: arena?.room?.state?.corporateFloorId ?? "",
      corporateFloorDepth: arena?.room?.state?.corporateFloorDepth ?? 0,
    };
  });
}

async function focusGameplay(page: Page): Promise<void> {
  await page.locator("#game-root canvas").click({ position: { x: 640, y: 360 } });
  await page.evaluate(() => {
    const arena = (
      globalThis as unknown as {
        ddGame?: {
          scene: {
            getScene(key: string): {
              time?: { now: number };
              verbs?: {
                closeForCompetingModal(nowMs: number): void;
                releaseInputLatchIf(inputsReleased: boolean): void;
              };
            };
          };
        };
      }
    ).ddGame?.scene.getScene("arena");
    arena?.verbs?.closeForCompetingModal(arena.time?.now ?? 0);
    arena?.verbs?.releaseInputLatchIf(true);
  });
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const arena = (
            globalThis as unknown as {
              ddGame?: {
                scene: {
                  getScene(key: string): {
                    verbs?: { isModalBlocking(): boolean };
                  };
                };
              };
            }
          ).ddGame?.scene.getScene("arena");
          return arena?.verbs?.isModalBlocking() ?? false;
        }),
      { message: "belt gameplay should not be hidden behind onboarding", timeout: 5_000 },
    )
    .toBe(false);
}

async function readUi(page: Page): Promise<UiSnapshot> {
  return page.evaluate(() => {
    type TextLike = { active?: boolean; visible?: boolean; text?: string };
    type VisibleLike = { active?: boolean; visible?: boolean };
    const arena = (
      globalThis as unknown as {
        ddGame?: {
          scene: {
            getScene(key: string): {
              arsenalG?: VisibleLike;
              arsenalTexts?: TextLike[];
              bagG?: VisibleLike;
              bagOpen?: boolean;
              hpBarBg?: VisibleLike;
              hpBarFill?: VisibleLike;
              hpText?: TextLike;
              relicText?: TextLike;
              floorText?: TextLike;
              grabPromptText?: TextLike;
              objectiveHudGfx?: VisibleLike;
              objectiveText?: TextLike;
            };
          };
        };
      }
    ).ddGame?.scene.getScene("arena");
    const visible = (object: VisibleLike | undefined): boolean =>
      object?.active !== false && object?.visible !== false;
    const texts = (arena?.arsenalTexts ?? [])
      .filter((text) => visible(text))
      .map((text) => text.text ?? "")
      .filter(Boolean);
    const joined = texts.join(" ");
    return {
      weaponDock:
        visible(arena?.arsenalG) && texts.some((copy) => /Rusty Cleaver|Empty/.test(copy)),
      backpackAffordance: joined.includes("Backpack") && joined.includes("Pack"),
      backpackPanel: arena?.bagOpen === true && visible(arena?.bagG),
      money: /Money/.test(joined),
      health:
        visible(arena?.hpBarBg) &&
        visible(arena?.hpBarFill) &&
        visible(arena?.hpText) &&
        (arena?.hpText?.text ?? "").includes("/"),
      relicRow:
        visible(arena?.relicText) && (arena?.relicText?.text ?? "").trim().length > "RELICS".length,
      floorCounter: visible(arena?.floorText) && (arena?.floorText?.text ?? "") === "F1",
      prompts:
        visible(arena?.grabPromptText) && (arena?.grabPromptText?.text ?? "").trim().length > 0,
      objective:
        visible(arena?.objectiveHudGfx) &&
        visible(arena?.objectiveText) &&
        (arena?.objectiveText?.text ?? "").length > 0,
      copy: {
        arsenal: texts,
        health: arena?.hpText?.text ?? "",
        relics: arena?.relicText?.text ?? "",
        floor: arena?.floorText?.text ?? "",
        prompt: arena?.grabPromptText?.text ?? "",
        objective: arena?.objectiveText?.text ?? "",
      },
    };
  });
}

function stageHudFixture(room: AuthorityRoom, player: AuthorityPlayer, sessionId: string): string {
  player.dualWield.relics.moveSpeed = 1;
  const chest = new ChestState();
  chest.id = `chest:b56-belt:${room.state.tick}`;
  chest.x = player.x;
  chest.y = player.y;
  chest.spawnTick = room.state.tick;
  chest.openedBy.set(sessionId, false);
  room.state.chests.set(chest.id, chest);
  room.broadcastPatch?.();
  return chest.id;
}

async function waitForChestPrompt(page: Page, chestId: string): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(
          ({ id, beltY0, beltForeshorten }) => {
            const arena = (
              globalThis as unknown as {
                ddGame?: {
                  scene: {
                    getScene(key: string): {
                      room?: {
                        state?: {
                          chests?: {
                            has(id: string): boolean;
                            get(id: string): { x?: number; y?: number } | undefined;
                          };
                        };
                      };
                      chests?: Map<string, { x: number; y: number }>;
                      grabPromptText?: { visible?: boolean; text?: string; x?: number; y?: number };
                      cameras?: {
                        main?: { worldView?: { contains(x: number, y: number): boolean } };
                      };
                    };
                  };
                };
              }
            ).ddGame?.scene.getScene("arena");
            const stateChest = arena?.room?.state?.chests?.get(id);
            const renderChest = arena?.chests?.get(id);
            const expectedY =
              stateChest?.y === undefined
                ? Number.NaN
                : beltY0 + (stateChest.y - beltY0) * beltForeshorten;
            return {
              present: arena?.room?.state?.chests?.has(id) ?? false,
              visible: arena?.grabPromptText?.visible === true,
              copy: arena?.grabPromptText?.text ?? "",
              chestProjected:
                !!renderChest &&
                Number.isFinite(expectedY) &&
                Math.abs(renderChest.y - expectedY) < 1,
              promptAnchored:
                !!renderChest &&
                Math.abs((arena?.grabPromptText?.x ?? Number.NaN) - renderChest.x) < 1 &&
                Math.abs((arena?.grabPromptText?.y ?? Number.NaN) - (renderChest.y - 45)) < 1,
              visibleInCamera:
                !!renderChest &&
                (arena?.cameras?.main?.worldView?.contains(renderChest.x, renderChest.y) ?? false),
            };
          },
          { id: chestId, beltY0: BELT_Y0, beltForeshorten: BELT_FORESHORTEN },
        ),
      { message: "belt chest should expose the ordinary interaction prompt", timeout: 10_000 },
    )
    .toMatchObject({
      present: true,
      visible: true,
      copy: expect.stringMatching(/PICK UP|OPEN/i),
      chestProjected: true,
      promptAnchored: true,
      visibleInCamera: true,
    });
}

async function openChest(
  page: Page,
  room: AuthorityRoom,
  sessionId: string,
  chestId: string,
): Promise<void> {
  await page.evaluate((id) => {
    const arena = (
      globalThis as unknown as {
        ddGame?: {
          scene: {
            getScene(key: string): { room?: { send(type: string, payload: unknown): void } };
          };
        };
      }
    ).ddGame?.scene.getScene("arena");
    arena?.room?.send("openChest", { chestId: id });
  }, chestId);
  await expect
    .poll(() => room.state.chests.get(chestId)?.openedBy.get(sessionId) ?? false, {
      message: "belt chest should open through the normal authority path",
      timeout: 10_000,
    })
    .toBe(true);
  await expect
    .poll(
      () =>
        page.evaluate((id) => {
          const arena = (
            globalThis as unknown as {
              ddGame?: {
                scene: {
                  getScene(key: string): {
                    chests?: Map<string, { getData(key: string): unknown }>;
                  };
                };
              };
            }
          ).ddGame?.scene.getScene("arena");
          return arena?.chests?.get(id)?.getData("opened") === true;
        }, chestId),
      { message: "belt chest-open receipt should reach its projected renderer", timeout: 10_000 },
    )
    .toBe(true);
}

async function exerciseActions(page: Page): Promise<ActionSnapshot> {
  const attackSeqBefore = await page.evaluate(() => {
    const arena = (
      globalThis as unknown as {
        ddGame?: {
          scene: {
            getScene(key: string): {
              room?: {
                sessionId?: string;
                state?: { players?: { get(id: string): { attackSeq?: number } | undefined } };
              };
            };
          };
        };
      }
    ).ddGame?.scene.getScene("arena");
    const id = arena?.room?.sessionId ?? "";
    return (id && arena?.room?.state?.players?.get(id)?.attackSeq) || 0;
  });
  await page.mouse.move(1_050, 360);
  await page.mouse.down({ button: "right" });
  await page.waitForTimeout(80);
  await page.mouse.up({ button: "right" });
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const arena = (
            globalThis as unknown as {
              ddGame?: {
                scene: {
                  getScene(key: string): {
                    room?: {
                      sessionId?: string;
                      state?: {
                        players?: { get(id: string): { attackSeq?: number } | undefined };
                      };
                    };
                  };
                };
              };
            }
          ).ddGame?.scene.getScene("arena");
          const id = arena?.room?.sessionId ?? "";
          return (id && arena?.room?.state?.players?.get(id)?.attackSeq) || 0;
        }),
      { message: "RMB should produce a belt attack receipt", timeout: 10_000 },
    )
    .toBeGreaterThan(attackSeqBefore);
  await page.screenshot({ path: path.join(EVIDENCE_DIR, "belt-action-attack.png") });

  await page.mouse.down({ button: "left" });
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const arena = (
            globalThis as unknown as {
              ddGame?: {
                scene: { getScene(key: string): { localParryCd?: number } };
              };
            }
          ).ddGame?.scene.getScene("arena");
          return arena?.localParryCd ?? 0;
        }),
      { message: "LMB should enter the belt parry/brace window", timeout: 5_000 },
    )
    .toBeGreaterThan(0);
  const parryCooldown = await page.evaluate(() => {
    const arena = (
      globalThis as unknown as {
        ddGame?: { scene: { getScene(key: string): { localParryCd?: number } } };
      }
    ).ddGame?.scene.getScene("arena");
    return arena?.localParryCd ?? 0;
  });
  await page.screenshot({ path: path.join(EVIDENCE_DIR, "belt-action-parry.png") });
  await page.mouse.up({ button: "left" });

  await page.keyboard.down("Shift");
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const holder = globalThis as unknown as { __b56ObservedDodgeStance?: number };
          const arena = (
            globalThis as unknown as {
              ddGame?: {
                scene: {
                  getScene(key: string): {
                    room?: {
                      sessionId?: string;
                      state?: {
                        players?: { get(id: string): { moveStance?: number } | undefined };
                      };
                    };
                  };
                };
              };
            }
          ).ddGame?.scene.getScene("arena");
          const id = arena?.room?.sessionId ?? "";
          const stance = (id && arena?.room?.state?.players?.get(id)?.moveStance) || 0;
          if (stance === 4) {
            holder.__b56ObservedDodgeStance = stance;
          }
          return stance;
        }),
      { message: "Shift should enter the authoritative belt dodge stance", timeout: 10_000 },
    )
    .toBe(4);
  const dodgeStance = await page.evaluate(
    () =>
      (globalThis as unknown as { __b56ObservedDodgeStance?: number }).__b56ObservedDodgeStance ??
      0,
  );
  await page.screenshot({ path: path.join(EVIDENCE_DIR, "belt-action-dodge.png") });
  await page.keyboard.up("Shift");

  await page.waitForTimeout(650);
  await page.keyboard.down("Space");
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const holder = globalThis as unknown as { __b56ObservedJumpHeight?: number };
          const arena = (
            globalThis as unknown as {
              ddGame?: {
                scene: {
                  getScene(key: string): {
                    room?: {
                      sessionId?: string;
                      state?: { players?: { get(id: string): { height?: number } | undefined } };
                    };
                  };
                };
              };
            }
          ).ddGame?.scene.getScene("arena");
          const id = arena?.room?.sessionId ?? "";
          const height = (id && arena?.room?.state?.players?.get(id)?.height) || 0;
          if (height > 1) {
            holder.__b56ObservedJumpHeight = height;
          }
          return height;
        }),
      { message: "Space should lift the authoritative belt player", timeout: 10_000 },
    )
    .toBeGreaterThan(1);
  const jumpHeight = await page.evaluate(
    () =>
      (globalThis as unknown as { __b56ObservedJumpHeight?: number }).__b56ObservedJumpHeight ?? 0,
  );
  await page.screenshot({ path: path.join(EVIDENCE_DIR, "belt-action-jump.png") });
  await page.keyboard.up("Space");
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const arena = (
            globalThis as unknown as {
              ddGame?: {
                scene: {
                  getScene(key: string): {
                    room?: {
                      sessionId?: string;
                      state?: {
                        players?: {
                          get(id: string): { height?: number; moveStance?: number } | undefined;
                        };
                      };
                    };
                  };
                };
              };
            }
          ).ddGame?.scene.getScene("arena");
          const id = arena?.room?.sessionId ?? "";
          const self = id ? arena?.room?.state?.players?.get(id) : undefined;
          return { height: self?.height ?? 0, moveStance: self?.moveStance ?? 0 };
        }),
      { message: "action fixture should settle before the single-position walk", timeout: 10_000 },
    )
    .toEqual({ height: 0, moveStance: 0 });
  await page.waitForTimeout(250);

  const attackSeqAfter = await page.evaluate(() => {
    const arena = (
      globalThis as unknown as {
        ddGame?: {
          scene: {
            getScene(key: string): {
              room?: {
                sessionId?: string;
                state?: { players?: { get(id: string): { attackSeq?: number } | undefined } };
              };
            };
          };
        };
      }
    ).ddGame?.scene.getScene("arena");
    const id = arena?.room?.sessionId ?? "";
    return (id && arena?.room?.state?.players?.get(id)?.attackSeq) || 0;
  });
  return {
    attackSeqBefore,
    attackSeqAfter,
    parryCooldown,
    dodgeStance,
    jumpHeight,
  };
}

async function equipAimWeapon(page: Page): Promise<void> {
  await page.evaluate(() => {
    const arena = (
      globalThis as unknown as {
        ddGame?: {
          scene: {
            getScene(key: string): {
              room?: { state?: { mode?: string }; send(type: string, payload?: unknown): void };
            };
          };
        };
      }
    ).ddGame?.scene.getScene("arena");
    if (arena?.room?.state?.mode !== "training") arena?.room?.send("toggleTraining");
  });
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const arena = (
            globalThis as unknown as {
              ddGame?: {
                scene: {
                  getScene(key: string): { room?: { state?: { mode?: string } } };
                };
              };
            }
          ).ddGame?.scene.getScene("arena");
          return arena?.room?.state?.mode ?? "";
        }),
      { message: "aim fixture should enter the testing grounds", timeout: 30_000 },
    )
    .toBe("training");
  await page.evaluate(
    ({ character, weapon }) => {
      const arena = (
        globalThis as unknown as {
          ddGame?: {
            scene: {
              getScene(key: string): {
                room?: { send(type: string, payload: unknown): void };
              };
            };
          };
        }
      ).ddGame?.scene.getScene("arena");
      arena?.room?.send("devEquip", { character, weapon });
    },
    { character: CHARACTER_ID, weapon: AIM_WEAPON_ID },
  );
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const arena = (
            globalThis as unknown as {
              ddGame?: {
                scene: {
                  getScene(key: string): {
                    room?: {
                      sessionId?: string;
                      state?: {
                        players?: { get(id: string): { weapon?: string } | undefined };
                      };
                    };
                    blobs?: Map<string, { leadWeaponTipPose(): unknown }>;
                  };
                };
              };
            }
          ).ddGame?.scene.getScene("arena");
          const sessionId = arena?.room?.sessionId ?? "";
          return {
            weapon: arena?.room?.state?.players?.get(sessionId)?.weapon ?? "",
            rendered: !!arena?.blobs?.get(sessionId)?.leadWeaponTipPose(),
          };
        }),
      { message: "belt aim fixture should equip and render the test gun", timeout: 30_000 },
    )
    .toEqual({ weapon: AIM_WEAPON_ID, rendered: true });
}

async function aimAt(page: Page, x: number, y: number): Promise<AimSnapshot> {
  await page.mouse.move(x, y);
  await page.waitForTimeout(180);
  return page.evaluate(
    ({ cursorX, cursorY }) => {
      const arena = (
        globalThis as unknown as {
          ddGame?: {
            scene: {
              getScene(key: string): {
                pointerScreen: { x: number; y: number };
                pointerMoves: number;
                selfAim: { x: number; y: number };
                room?: { sessionId?: string };
                blobs?: Map<
                  string,
                  {
                    x: number;
                    y: number;
                    root: { scaleX: number };
                    leadWeaponTipPose(): { axisX: number; axisY: number } | undefined;
                  }
                >;
                cameras: {
                  main: { getWorldPoint(x: number, y: number): { x: number; y: number } };
                };
              };
            };
          };
        }
      ).ddGame?.scene.getScene("arena");
      if (!arena?.room?.sessionId) throw new Error("belt aim scene unavailable");
      const rig = arena.blobs?.get(arena.room.sessionId);
      const tip = rig?.leadWeaponTipPose();
      if (!rig || !tip) throw new Error("belt aim rig/weapon unavailable");
      const cursor = arena.cameras.main.getWorldPoint(arena.pointerScreen.x, arena.pointerScreen.y);
      const dx = cursor.x - rig.x;
      const dy = cursor.y - rig.y;
      const length = Math.hypot(dx, dy) || 1;
      return {
        cursor: { x: cursorX, y: cursorY },
        rig: { x: rig.x, y: rig.y },
        expected: { x: dx / length, y: dy / length },
        selfAim: { x: arena.selfAim.x, y: arena.selfAim.y },
        weaponAxis: { x: tip.axisX, y: tip.axisY },
        facing: Math.sign(rig.root.scaleX),
        pointerMoves: arena.pointerMoves,
      };
    },
    { cursorX: x, cursorY: y },
  );
}

async function aimPointsForRig(
  page: Page,
): Promise<Array<{ label: string; x: number; y: number }>> {
  const screen = await page.evaluate(() => {
    const arena = (
      globalThis as unknown as {
        ddGame?: {
          scene: {
            getScene(key: string): {
              room?: { sessionId?: string };
              blobs?: Map<string, { x: number; y: number }>;
              cameras: {
                main: {
                  scrollX: number;
                  scrollY: number;
                  zoom: number;
                  x: number;
                  y: number;
                };
              };
            };
          };
        };
      }
    ).ddGame?.scene.getScene("arena");
    const sessionId = arena?.room?.sessionId ?? "";
    const rig = sessionId ? arena?.blobs?.get(sessionId) : undefined;
    if (!arena || !rig) throw new Error("belt rig unavailable for aim coordinates");
    const camera = arena.cameras.main;
    return {
      x: camera.x + (rig.x - camera.scrollX) * camera.zoom,
      y: camera.y + (rig.y - camera.scrollY) * camera.zoom,
    };
  });
  const left = Math.max(8, screen.x - 90);
  const right = Math.min(1_272, screen.x + 720);
  return [
    { label: "right-high", x: right, y: Math.max(100, screen.y - 210) },
    { label: "right-low", x: right, y: Math.min(660, screen.y + 120) },
    { label: "left-high", x: left, y: Math.max(100, screen.y - 210) },
    { label: "left-low", x: left, y: Math.min(660, screen.y + 120) },
  ];
}

function vectorError(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

async function walkTrace(page: Page): Promise<PositionTrace> {
  await page.evaluate(() => {
    const holder = globalThis as unknown as {
      __b56PositionSamples?: PositionSample[];
      __b56PositionTimer?: number;
    };
    holder.__b56PositionSamples = [];
    holder.__b56PositionTimer = window.setInterval(() => {
      const arena = (
        globalThis as unknown as {
          ddGame?: {
            scene: {
              getScene(key: string): {
                room?: {
                  sessionId?: string;
                  state?: {
                    players?: {
                      get(id: string): { x?: number; y?: number } | undefined;
                    };
                  };
                };
                blobs?: Map<string, { x: number; y: number }>;
                selfPredictionCandidateX?: number;
                selfPredictionCandidateY?: number;
                selfPresentedWorldX?: number;
                selfPresentedWorldY?: number;
              };
            };
          };
        }
      ).ddGame?.scene.getScene("arena");
      const sessionId = arena?.room?.sessionId ?? "";
      const rig = sessionId ? arena?.blobs?.get(sessionId) : undefined;
      const server = sessionId ? arena?.room?.state?.players?.get(sessionId) : undefined;
      if (!rig || !server) return;
      holder.__b56PositionSamples?.push({
        wallMs: performance.now(),
        rootX: rig.x,
        rootY: rig.y,
        candidateX: arena?.selfPredictionCandidateX ?? Number.NaN,
        candidateY: arena?.selfPredictionCandidateY ?? Number.NaN,
        presentedWorldX: arena?.selfPresentedWorldX ?? Number.NaN,
        presentedWorldY: arena?.selfPresentedWorldY ?? Number.NaN,
        serverX: server.x ?? Number.NaN,
        serverY: server.y ?? Number.NaN,
      });
    }, 16);
  });
  await page.keyboard.down("KeyD");
  await page.waitForTimeout(3_200);
  await page.keyboard.up("KeyD");
  await page.waitForTimeout(250);
  const samples = await page.evaluate(() => {
    const holder = globalThis as unknown as {
      __b56PositionSamples?: PositionSample[];
      __b56PositionTimer?: number;
    };
    if (holder.__b56PositionTimer) window.clearInterval(holder.__b56PositionTimer);
    return holder.__b56PositionSamples ?? [];
  });
  let maxRootStepPx = 0;
  let maxUnexpectedRootStepPx = 0;
  let maxProjectionErrorPx = 0;
  let maxServerProjectionErrorPx = 0;
  for (let index = 0; index < samples.length; index++) {
    const sample = samples[index];
    if (!sample) continue;
    const expectedPresentedY = BELT_Y0 + (sample.presentedWorldY - BELT_Y0) * BELT_FORESHORTEN;
    const expectedServerY = BELT_Y0 + (sample.serverY - BELT_Y0) * BELT_FORESHORTEN;
    maxProjectionErrorPx = Math.max(
      maxProjectionErrorPx,
      Math.hypot(sample.rootX - sample.presentedWorldX, sample.rootY - expectedPresentedY),
    );
    maxServerProjectionErrorPx = Math.max(
      maxServerProjectionErrorPx,
      Math.abs(sample.rootY - expectedServerY),
    );
    if (index === 0) continue;
    const previous = samples[index - 1];
    if (!previous) continue;
    const rootDx = sample.rootX - previous.rootX;
    const rootDy = sample.rootY - previous.rootY;
    const expectedDx = sample.presentedWorldX - previous.presentedWorldX;
    const expectedDy = (sample.presentedWorldY - previous.presentedWorldY) * BELT_FORESHORTEN;
    maxRootStepPx = Math.max(maxRootStepPx, Math.hypot(rootDx, rootDy));
    maxUnexpectedRootStepPx = Math.max(
      maxUnexpectedRootStepPx,
      Math.hypot(rootDx - expectedDx, rootDy - expectedDy),
    );
  }
  return {
    samples,
    maxRootStepPx,
    maxUnexpectedRootStepPx,
    maxProjectionErrorPx,
    maxServerProjectionErrorPx,
  };
}

test("B56 belt smoke: boot, full HUD, cursor aim, and one self position source", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await mkdir(EVIDENCE_DIR, { recursive: true });
  const sharedStack = process.env.DD_E2E_BASE_URL;
  delete process.env.DD_E2E_BASE_URL;
  try {
    await runArenaSpec(page, async (baseURL) => {
      const boot = await bootBelt(page, baseURL);
      const localRoom = matchMaker.getLocalRoomById(boot.roomId) as unknown as
        | AuthorityRoom
        | undefined;
      const authoritySelf = localRoom?.state.players.get(boot.sessionId);
      if (!localRoom || !authoritySelf) throw new Error("B56 authority fixture unavailable");
      localRoom.state.enemies.clear();
      authoritySelf.hp = authoritySelf.maxHp;
      authoritySelf.alive = true;
      const chestId = stageHudFixture(localRoom, authoritySelf, boot.sessionId);
      await page.waitForTimeout(350);
      await focusGameplay(page);
      await waitForChestPrompt(page, chestId);
      const uiClosed = await readUi(page);
      await page.keyboard.press("Tab");
      await page.waitForTimeout(180);
      const uiOpen = await readUi(page);
      const ui = {
        ...uiClosed,
        backpackPanel: uiOpen.backpackPanel,
        copy: { ...uiClosed.copy, openPanel: uiOpen.copy },
      };
      await page.screenshot({ path: path.join(EVIDENCE_DIR, "belt-backpack-open.png") });
      expect(ui, "every belt HUD surface should be constructed and reachable").toMatchObject({
        weaponDock: true,
        backpackAffordance: true,
        backpackPanel: true,
        money: true,
        health: true,
        relicRow: true,
        floorCounter: true,
        prompts: true,
        objective: true,
      });
      await page.keyboard.press("Tab");
      await page.waitForTimeout(120);
      await page.screenshot({ path: path.join(EVIDENCE_DIR, "belt-full-hud.png") });

      await openChest(page, localRoom, boot.sessionId, chestId);
      await page.screenshot({ path: path.join(EVIDENCE_DIR, "belt-chest-opened.png") });
      const actions = await exerciseActions(page);
      const position = await walkTrace(page);

      await equipAimWeapon(page);
      const aimPoints = await aimPointsForRig(page);
      const aims: Array<AimSnapshot & { label: string }> = [];
      for (const point of aimPoints) {
        const aim = await aimAt(page, point.x, point.y);
        aims.push({ label: point.label, ...aim });
        await page.screenshot({
          path: path.join(EVIDENCE_DIR, `belt-aim-${point.label}.png`),
        });
      }

      await writeFile(
        path.join(EVIDENCE_DIR, "belt-smoke.json"),
        `${JSON.stringify({ boot, ui, chestId, actions, aims, position }, null, 2)}\n`,
        "utf8",
      );

      for (const aim of aims) {
        expect(
          vectorError(aim.selfAim, aim.expected),
          `${aim.label}: belt selfAim should use projected cursor/render space`,
        ).toBeLessThan(0.04);
        expect(
          vectorError(aim.weaponAxis, aim.expected),
          `${aim.label}: painted weapon axis should point at the cursor`,
        ).toBeLessThan(0.16);
      }
      expect(new Set(aims.map((aim) => aim.facing))).toEqual(new Set([-1, 1]));
      expect(position.samples.length).toBeGreaterThan(8);
      expect(
        position.maxProjectionErrorPx,
        "belt root should be the projection of one predicted world-space position",
      ).toBeLessThan(3);
      expect(
        position.maxUnexpectedRootStepPx,
        "ordinary belt walking should render only the projected predictor step",
      ).toBeLessThan(3);
    });
  } finally {
    if (sharedStack) process.env.DD_E2E_BASE_URL = sharedStack;
  }
});

test("B56 belt deep-link boots every corporate floor without a fade-event dependency", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await runArenaSpec(page, async (baseURL) => {
    const port = new URL(baseURL).port;
    expect(["5180", "2567"]).not.toContain(port);
    const boots: Array<BeltBootSnapshot & { levelId: string }> = [];
    for (const levelId of [
      "corporate-grid",
      "corporate-grid-portrait-hall",
      "corporate-grid-marble-gallery",
    ]) {
      boots.push({ levelId, ...(await bootBelt(page, baseURL, levelId)) });
    }
    await writeFile(
      path.join(EVIDENCE_DIR, "belt-corporate-floor-boots.json"),
      `${JSON.stringify({ baseURL, boots }, null, 2)}\n`,
      "utf8",
    );
    expect(boots.map((boot) => boot.corporateFloorId)).toEqual([
      "office-red-carpet-gallery",
      "office-random-dude-portrait-hall",
      "office-marble-gallery",
    ]);
  });
});

test("B56 top-down aim baseline: weapon axis follows the same cursor points", async ({ page }) => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await runArenaSpec(page, async (baseURL) => {
    await bootArena(page, baseURL, `char:${CHARACTER_ID}`);
    await focusGameplay(page);
    await equipAimWeapon(page);
    const points = await aimPointsForRig(page);
    const aims: Array<AimSnapshot & { label: string }> = [];
    for (const point of points)
      aims.push({ label: point.label, ...(await aimAt(page, point.x, point.y)) });
    await writeFile(
      path.join(EVIDENCE_DIR, "topdown-aim-baseline.json"),
      `${JSON.stringify(aims, null, 2)}\n`,
      "utf8",
    );
    expect(aims).toHaveLength(4);
    for (const aim of aims) {
      expect(vectorError(aim.selfAim, aim.expected)).toBeLessThan(0.04);
      expect(vectorError(aim.weaponAxis, aim.expected)).toBeLessThan(0.16);
    }
    expect(new Set(aims.map((aim) => aim.facing))).toEqual(new Set([-1, 1]));
  });
});
