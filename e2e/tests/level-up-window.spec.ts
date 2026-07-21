import { expect, test } from "@playwright/test";
import {
  type BrowserGame,
  bootArena,
  runArenaSpec,
  startAutoAttack,
  stopAutoAttack,
  waitForDevWeapon,
} from "../helpers/arena-harness.js";

const MELEE_WEAPON = "rusty-cleaver";

/** The scene-level level-up hit rects render at this fixed depth (ArenaScene createLevelChoiceCard). */
const LEVEL_CARD_HIT_DEPTH = 100013;

type AttrId = "str" | "dex" | "int" | "con" | "luk";

interface CardPick {
  id: AttrId;
  x: number;
  y: number;
  baseline: number;
  flexPending: number;
  hitRectAtDepth: boolean;
}

// Small buffer: headless software-WebGL frame pacing at 1280×720 is ~6fps; 640×360 holds ~20fps so the
// five-second flex window flow (build cards → click → server round-trip) never races frame stalls.
test.use({ viewport: { width: 640, height: 360 } });

test("level-up window: earned XP opens the flex window; clicking a card's scene-level hit rect allocates the attribute", async ({
  page,
}) => {
  await runArenaSpec(page, async (baseURL) => {
    await bootArena(page, baseURL, `weapon:${MELEE_WEAPON}`);
    await waitForDevWeapon(page, MELEE_WEAPON);

    // Give the real keyboard path focus and dismiss the first-run legend. Without this, the WASD
    // roaming below can be latched off even though the room-level auto-attack is already running.
    await page.locator("#game-root canvas").click({ position: { x: 320, y: 180 } });
    await page.evaluate(() => {
      const game = (
        globalThis as unknown as { ddGame?: { scene: { keys: { arena: unknown } } } }
      ).ddGame;
      const arena = game?.scene.keys.arena as
        | {
            game?: { hasFocus: boolean };
            time?: { now: number };
            verbs?: {
              isLegendOpen?(): boolean;
              toggleLegend?(nowMs: number): void;
              releaseInputLatchIf?(release: boolean): void;
            };
          }
        | undefined;
      if (!arena) throw new Error("level-up test requires the live arena input surface");
      if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend?.(arena.time?.now ?? 0);
      arena.verbs?.releaseInputLatchIf?.(true);
      if (arena.game) arena.game.hasFocus = true;
    });

    // Conjure rushers (training-only dev summon) and cut them down for XP. Level 2 costs 6 XP and a
    // critter pays 1; the cleaver one-shots them at 1/1 attributes even under the requirement penalty
    // (4 x 0.76 > 3 hp), and MELEE kills land inside the 180px Echo auto-latch reach so every kill
    // banks. Waves spawn on the 720px ring and the random map can pit-kill converging critters
    // (terrain deaths pay nothing). A bounded page-side respawner supplies six waves while the flex
    // is pending; it must not wait for every stranded survivor to disappear before replacing losses.
    await page.evaluate(() => {
      const holder = globalThis as unknown as { ddGame?: BrowserGame; __ddWaveTimer?: number };
      let wavesSent = 0;
      const sendWave = (): void => {
        const room = holder.ddGame?.scene.getScene("arena").room;
        room?.send("debugSpawn", { kind: "critter", count: 8 });
        wavesSent++;
      };
      sendWave();
      holder.__ddWaveTimer = window.setInterval(() => {
        const room = holder.ddGame?.scene.getScene("arena").room;
        const state = room?.state;
        const self = room?.sessionId ? state?.players?.get(room.sessionId) : undefined;
        if (!state || !self || (self.flexPending ?? 0) > 0) return;
        if (wavesSent < 6) sendWave();
      }, 1_500);
    });
    // Swing only when the target is inside melee contact range, exactly like a player would.
    await startAutoAttack(page, 140);

    // Poll for the window while ROAMING with real WASD key pulses (the same physical input path the
    // smoke uses). A live player never stands still: movement kites the swarm, walks the catch radius
    // over resting echoes, and un-sticks the rare geometry pathology where a static player and a
    // clustered swarm deadlock against a POI wall.
    const roamKeys = ["w", "a", "s", "d"] as const;
    let roamStep = 0;
    await expect
      .poll(
        async () => {
          const windowOpened = await page.evaluate(() => {
            const game = (globalThis as unknown as { ddGame?: BrowserGame }).ddGame;
            const room = game?.scene.getScene("arena").room;
            const self = room?.sessionId ? room.state?.players?.get(room.sessionId) : undefined;
            return (self?.flexPending ?? 0) > 0;
          });
          if (!windowOpened) {
            const key = roamKeys[roamStep++ % roamKeys.length] ?? "w";
            // The delay is input duration (so Phaser observes movement), not a readiness wait.
            await page.keyboard.press(key, { delay: 220 });
          }
          return windowOpened;
        },
        {
          message: "delivered kill XP should trigger a level-up flex window",
          timeout: 60_000,
          intervals: [120],
        },
      )
      .toBe(true);
    await stopAutoAttack(page);
    await page.evaluate(() => {
      const holder = globalThis as unknown as { __ddWaveTimer?: number };
      if (holder.__ddWaveTimer) window.clearInterval(holder.__ddWaveTimer);
    });

    // The window auto-resolves after 5s, so grab a card fast. Since class dissolution the auto-pick
    // is the WEAPON's best scaling grade (defaultFlexAttr), which can be any attribute — including
    // LUK — and an in-flight echo-paid second level auto-resolving on the same attribute would make
    // a +1 assertion ambiguous. The scene marks the auto card via `levelWinFocus`, so pick any card
    // that is NOT the auto attribute (prefer LUK when it isn't). Also verify the P0 contract this UI
    // relies on: an interactive scene-level hit rect at depth 100013.
    const pick: CardPick | null = await page
      .waitForFunction(
        (depth) => {
          const game = (globalThis as unknown as { ddGame?: BrowserGame }).ddGame;
          const scene = game?.scene.getScene("arena") as unknown as {
            room?: { sessionId?: string; state?: { players?: { get(id: string): unknown } } };
            children?: { list?: { depth?: number; input?: { enabled?: boolean } }[] };
            levelWinChoices?: {
              zone: { x: number; y: number };
              view: { id: string };
            }[];
          };
          const choices = scene?.levelWinChoices;
          if (!choices || choices.length === 0) return null;
          const room = game?.scene.getScene("arena").room;
          const self = room?.sessionId ? room.state?.players?.get(room.sessionId) : undefined;
          if (!self || (self.flexPending ?? 0) <= 0) return null;
          const hitRectAtDepth = (scene?.children?.list ?? []).some(
            (child) => child.depth === depth && child.input?.enabled === true,
          );
          const focusIndex = (scene as unknown as { levelWinFocus?: number }).levelWinFocus ?? -1;
          const autoId = choices[focusIndex]?.view.id;
          const chosen =
            choices.find((choice) => choice.view.id === "luk" && choice.view.id !== autoId) ??
            [...choices].reverse().find((choice) => choice.view.id !== autoId) ??
            choices[choices.length - 1];
          if (!chosen) return null;
          const id = chosen.view.id as AttrId;
          const baseline = (self as Record<AttrId, number | undefined>)[id];
          if (typeof baseline !== "number") return null;
          return {
            id,
            x: chosen.zone.x,
            y: chosen.zone.y,
            baseline,
            flexPending: self.flexPending ?? 0,
            hitRectAtDepth,
          };
        },
        LEVEL_CARD_HIT_DEPTH,
        { timeout: 15_000, polling: 50 },
      )
      .then((handle) => handle.jsonValue() as Promise<CardPick | null>);

    expect(pick, "the flex window should build clickable choice cards").not.toBeNull();
    if (!pick) return;
    expect(
      pick.hitRectAtDepth,
      `an enabled hit rect must exist at depth ${LEVEL_CARD_HIT_DEPTH}`,
    ).toBe(true);

    // Real click on the card's fixed-screen hit rect (RENDER_DPR is 1 headless, so scene screen-space
    // coordinates equal page CSS pixels and the canvas sits at the viewport origin).
    await page.mouse.click(pick.x, pick.y);

    await expect
      .poll(
        () =>
          page.evaluate((attr) => {
            const game = (globalThis as unknown as { ddGame?: BrowserGame }).ddGame;
            const room = game?.scene.getScene("arena").room;
            const self = room?.sessionId ? room.state?.players?.get(room.sessionId) : undefined;
            if (!self) return null;
            return (self as Record<string, unknown>)[attr] as number;
          }, pick.id),
        {
          message: `clicking the ${pick.id.toUpperCase()} card should allocate the flex choice`,
          timeout: 10_000,
        },
      )
      // The allocation economy is +2 to the CHOSEN attribute, then +1 ballast to the post-choice
      // lowest (applyAllocationChoice's law). The clicked attr just rose by 2, so ballast lands on a
      // different attribute in the flat dev spread — the chosen stat moves by exactly +2.
      .toBe(pick.baseline + 2);

    // NOTE deliberately NOT asserted: a flexPending decrement. In-flight echoes can pay another level
    // between the click and the re-read (+1 pending racing our −1), while the chosen-attr increment
    // above is unambiguous — the picked card is never the weapon's defaultFlexAttr, so the server's
    // timeout auto-resolve cannot have produced it.
  });
});
