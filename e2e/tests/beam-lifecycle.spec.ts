import { expect, test } from "@playwright/test";
import {
  type BrowserGame,
  bootArena,
  runArenaSpec,
  waitForDevWeapon,
} from "../helpers/arena-harness.js";

const BEAM_WEAPON = "x2-voltcaster-machine-pistol";

/** BeamPhase wire values (shared/src/combat.ts): 1 Charging · 2 Active · 3 Cooling · 4 Overheated. */
const CHARGING = 1;
const ACTIVE = 2;

interface BeamProbe {
  phases: number[];
  sawRow: boolean;
  rowGoneAfterRow: boolean;
}

declare global {
  // eslint-disable-next-line no-var
  var __ddBeamProbe: BeamProbe | undefined;
  // eslint-disable-next-line no-var
  var __ddBeamTimer: number | undefined;
  // eslint-disable-next-line no-var
  var __ddBeamInputTimer: number | undefined;
}

// Headless software-WebGL cannot hold 1280×720 above the server's 150ms stale-input window (a real
// beam-cancel rule: a starving input stream drops the trigger). A smaller buffer keeps honest ~20fps
// frame pacing so the held trigger stays fresh, exactly like a playable client.
test.use({ viewport: { width: 640, height: 360 } });

test("beam lifecycle: fireHeld drives an authoritative beams row through charge, active, cooldown, and clear", async ({
  page,
}) => {
  await runArenaSpec(page, async (baseURL) => {
    await bootArena(page, baseURL, `weapon:${BEAM_WEAPON}`);
    await waitForDevWeapon(page, BEAM_WEAPON);

    // Sample the synced beams row every 25ms, recording each distinct phase in observation order plus
    // whether the row was removed again after having existed (release + heat fully vented).
    await page.evaluate(() => {
      const probe: BeamProbe = { phases: [], sawRow: false, rowGoneAfterRow: false };
      globalThis.__ddBeamProbe = probe;
      globalThis.__ddBeamTimer = window.setInterval(() => {
        const game = (globalThis as unknown as { ddGame?: BrowserGame }).ddGame;
        const room = game?.scene.getScene("arena").room;
        const row = room?.sessionId ? room.state?.beams?.get(room.sessionId) : undefined;
        if (row && typeof row.phase === "number") {
          probe.sawRow = true;
          if (probe.phases[probe.phases.length - 1] !== row.phase) probe.phases.push(row.phase);
        } else if (probe.sawRow) {
          probe.rowGoneAfterRow = true;
        }
      }, 25);
    });

    // Drive fireHeld through the REAL input path: stepNetInput reads scene.input.activePointer.
    // Software-WebGL can occasionally leave more than the server's three-tick watchdog between rendered
    // frames, so pump that same client method on its authored 50ms cadence while held. It still mints normal
    // predictor commands and sends them through the room; no beam state or server authority is bypassed.
    await page.locator("#game-root canvas").click({ position: { x: 320, y: 180 } });
    await page.evaluate(() => {
      const game = (globalThis as unknown as { ddGame?: BrowserGame }).ddGame;
      const scene = game?.scene.getScene("arena") as unknown as {
        game?: { hasFocus: boolean };
        input?: { activePointer?: { rightButtonDown: () => boolean } };
        time?: { now: number };
        verbs?: {
          isLegendOpen?(): boolean;
          toggleLegend?(nowMs: number): void;
          releaseInputLatchIf?(release: boolean): void;
        };
        stepNetInput?(
          deltaMs: number,
          levelWindowOpen: boolean,
          ultimatePressed: boolean,
          nextDx: number,
          nextDy: number,
        ): void;
      };
      if (!scene?.input?.activePointer || !scene.stepNetInput) return;
      if (scene.verbs?.isLegendOpen?.()) scene.verbs.toggleLegend?.(scene.time?.now ?? 0);
      scene.verbs?.releaseInputLatchIf?.(true);
      if (scene.game) scene.game.hasFocus = true;
      scene.input.activePointer.rightButtonDown = () => true;
      globalThis.__ddBeamInputTimer = window.setInterval(
        () => scene.stepNetInput?.(50, false, false, 0, 0),
        50,
      );
    });

    // The server ignites through Charging (0.65s for this weapon) into Active.
    await expect
      .poll(() => page.evaluate(() => globalThis.__ddBeamProbe?.phases ?? []), {
        message: "holding fire should produce a Charging beams row",
        timeout: 15_000,
      })
      .toContain(CHARGING);
    await expect
      .poll(() => page.evaluate(() => globalThis.__ddBeamProbe?.phases ?? []), {
        message: "the charge should complete into an Active beam",
        timeout: 15_000,
      })
      .toContain(ACTIVE);

    // Release. The row must transition into a venting phase (Cooling — or Overheated if the channel
    // ran long under CI scheduling jitter) and then clear entirely once the heat debt is repaid.
    await page.evaluate(() => {
      const game = (globalThis as unknown as { ddGame?: BrowserGame }).ddGame;
      const scene = game?.scene.getScene("arena") as unknown as {
        input?: { activePointer?: { rightButtonDown: () => boolean } };
        stepNetInput?(
          deltaMs: number,
          levelWindowOpen: boolean,
          ultimatePressed: boolean,
          nextDx: number,
          nextDy: number,
        ): void;
      };
      if (scene?.input?.activePointer) scene.input.activePointer.rightButtonDown = () => false;
      scene?.stepNetInput?.(50, false, false, 0, 0);
      if (globalThis.__ddBeamInputTimer) {
        window.clearInterval(globalThis.__ddBeamInputTimer);
        globalThis.__ddBeamInputTimer = undefined;
      }
    });

    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const probe = globalThis.__ddBeamProbe;
            const game = (globalThis as unknown as { ddGame?: BrowserGame }).ddGame;
            const room = game?.scene.getScene("arena").room;
            const row = room?.sessionId ? room.state?.beams?.get(room.sessionId) : undefined;
            return {
              ventPhaseSeen: (probe?.phases ?? []).some((phase) => phase === 3 || phase === 4),
              rowCleared: !row && probe?.rowGoneAfterRow === true,
            };
          }),
        {
          message: "release should vent (Cooling/Overheated) and then clear the beams row",
          timeout: 20_000,
        },
      )
      .toMatchObject({ ventPhaseSeen: true, rowCleared: true });

    // The full arc must have run in order: a charge preceding the active phase, and a vent phase after
    // it. (A frame stall can legitimately cancel an early charge into Cooling and retry — the server's
    // stale-input rule — so earlier 1→3 pairs are allowed; the COMPLETED cycle is what must exist.)
    const phases = await page.evaluate(() => globalThis.__ddBeamProbe?.phases ?? []);
    const activeAt = phases.indexOf(ACTIVE);
    expect(activeAt, `phase order was [${phases.join(", ")}]`).toBeGreaterThan(0);
    expect(
      phases.slice(0, activeAt).includes(CHARGING),
      `a charge must precede the active phase — saw [${phases.join(", ")}]`,
    ).toBe(true);
    expect(
      phases.slice(activeAt + 1).some((phase) => phase === 3 || phase === 4),
      `a vent phase must follow the active phase — saw [${phases.join(", ")}]`,
    ).toBe(true);

    await page.evaluate(() => {
      if (globalThis.__ddBeamTimer) window.clearInterval(globalThis.__ddBeamTimer);
      if (globalThis.__ddBeamInputTimer) window.clearInterval(globalThis.__ddBeamInputTimer);
    });
  });
});
