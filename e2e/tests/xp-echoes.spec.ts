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

interface EchoProbe {
  /** Monotonic sample counter — orders the three observations without wall-clock flake. */
  sample: number;
  echoSeenAt: number;
  latchSeenAt: number;
  xpGainedAt: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __ddEchoProbe: EchoProbe | undefined;
  // eslint-disable-next-line no-var
  var __ddEchoTimer: number | undefined;
}

// Small buffer keeps headless software-WebGL frame pacing honest (~20fps vs ~6fps at 1280×720).
test.use({ viewport: { width: 640, height: 360 } });

test("xp echoes: an arena kill drops a resting echo that latches into flight before any XP is granted", async ({
  page,
}) => {
  await runArenaSpec(page, async (baseURL) => {
    // The dev deep-link enters the Testing Grounds and devEquips the weapon (the message is
    // training-gated); the equipped weapon survives the toggle back OUT of training. Melee on purpose:
    // its kills land at contact range, inside the 180px Echo auto-latch reach, so every kill BANKS —
    // a gun kill at 300px leaves the packet resting out of reach of a stationary collector.
    await bootArena(page, baseURL, `weapon:${MELEE_WEAPON}`);
    await waitForDevWeapon(page, MELEE_WEAPON);

    // Leave training: real survival arena, real spawn director, real XP economy.
    await page.evaluate(() => {
      const game = (globalThis as unknown as { ddGame?: BrowserGame }).ddGame;
      game?.scene.getScene("arena").room?.send("toggleTraining");
    });
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const game = (globalThis as unknown as { ddGame?: BrowserGame }).ddGame;
            return game?.scene.getScene("arena").room?.state?.mode ?? null;
          }),
        { message: "toggleTraining should return the run to arena mode", timeout: 15_000 },
      )
      .toBe("arena");

    // Sample authoritative state every 25ms and record the ORDER of the three edges:
    // resting echo row appears → an echo latches a collector (or lands, `delivered`) → squad XP moves.
    await page.evaluate(() => {
      const probe: EchoProbe = { sample: 0, echoSeenAt: -1, latchSeenAt: -1, xpGainedAt: -1 };
      globalThis.__ddEchoProbe = probe;
      globalThis.__ddEchoTimer = window.setInterval(() => {
        const game = (globalThis as unknown as { ddGame?: BrowserGame }).ddGame;
        const room = game?.scene.getScene("arena").room;
        const state = room?.state;
        if (!room || !state) return;
        probe.sample++;
        if (probe.echoSeenAt < 0 && (state.xpEchoes?.size ?? 0) > 0) {
          probe.echoSeenAt = probe.sample;
        }
        if (probe.latchSeenAt >= 0 && probe.xpGainedAt >= 0) return;
        state.xpEchoes?.forEach((echo) => {
          if (probe.latchSeenAt < 0 && (echo.collectorId || echo.delivered)) {
            probe.latchSeenAt = probe.sample;
          }
        });
        const self = room.sessionId ? state.players?.get(room.sessionId) : undefined;
        if (probe.xpGainedAt < 0 && self && ((self.xp ?? 0) > 0 || (self.level ?? 1) > 1)) {
          probe.xpGainedAt = probe.sample;
        }
      }, 25);
    });

    // Kill via real attack sends at the nearest spawned enemy (the map is random — aim is computed
    // from live state each shot, never from pinned coordinates), swinging only at contact range.
    await startAutoAttack(page, 140);

    // Solo survival with a stationary player eventually wipes; a defeat clears pending echoes by
    // design. Self-heal: the host restart resets the run and the kill loop simply tries again.
    await page.evaluate(() => {
      const holder = globalThis as unknown as { ddGame?: BrowserGame; __ddRestartTimer?: number };
      holder.__ddRestartTimer = window.setInterval(() => {
        const room = holder.ddGame?.scene.getScene("arena").room;
        const state = room?.state as { outcome?: string } | undefined;
        if (state?.outcome === "defeat") room?.send("restart");
      }, 1_000);
    });

    // Poll for all three edges while ROAMING with real WASD pulses — a live player never stands
    // still; movement kites the horde (survival) and sweeps the catch radius over resting echoes.
    const roamKeys = ["w", "a", "s", "d"] as const;
    let roamStep = 0;
    await expect
      .poll(
        async () => {
          const edges = await page.evaluate(() => {
            const probe = globalThis.__ddEchoProbe;
            return {
              echoSeen: (probe?.echoSeenAt ?? -1) > 0,
              latchSeen: (probe?.latchSeenAt ?? -1) > 0,
              xpGained: (probe?.xpGainedAt ?? -1) > 0,
            };
          });
          if (!edges.echoSeen || !edges.latchSeen || !edges.xpGained) {
            const key = roamKeys[roamStep++ % roamKeys.length] ?? "w";
            // The delay is input duration (so Phaser observes movement), not a readiness wait.
            await page.keyboard.press(key, { delay: 220 });
          }
          return edges;
        },
        {
          message:
            "a kill should mint an xpEchoes row, latch it into flight, and only then grant XP",
          timeout: 75_000,
          intervals: [120],
        },
      )
      .toMatchObject({ echoSeen: true, latchSeen: true, xpGained: true });

    await stopAutoAttack(page);
    const probe = await page.evaluate(() => globalThis.__ddEchoProbe ?? null);
    expect(probe).not.toBeNull();
    if (!probe) return;
    expect(probe.echoSeenAt, "an echo row must have been observed").toBeGreaterThan(0);
    expect(probe.latchSeenAt, "the latch must not precede the resting echo").toBeGreaterThanOrEqual(
      probe.echoSeenAt,
    );
    expect(probe.xpGainedAt, "XP must arrive only after the latch/flight").toBeGreaterThanOrEqual(
      probe.latchSeenAt,
    );

    await page.evaluate(() => {
      if (globalThis.__ddEchoTimer) window.clearInterval(globalThis.__ddEchoTimer);
      const holder = globalThis as unknown as { __ddRestartTimer?: number };
      if (holder.__ddRestartTimer) window.clearInterval(holder.__ddRestartTimer);
    });
  });
});
