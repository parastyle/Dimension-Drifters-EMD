import { TICK_MS, WEAPONS } from "@dd/shared";
import { describe, expect, it } from "vitest";
import {
  BRIMSTONE_ROCKET_TUBE_ID,
  type StraightFlightRenderState,
  stepAuthoritativeStraightFlight,
  usesAuthoritativeStraightFlight,
} from "./projectile-trajectory.js";

describe("Brimstone Rocket Tube authoritative straight flight", () => {
  it("keeps the catalog trajectory straight without changing its combat contract", () => {
    const gun = WEAPONS[BRIMSTONE_ROCKET_TUBE_ID]?.gun;

    expect(gun).toMatchObject({
      damage: 14,
      projectileSpeed: 600,
      range: 880,
      fireRate: 0.85,
      magazine: 2,
      reloadSeconds: 2.8,
      explode: { radius: 220, damage: 13 },
    });
    expect(gun?.arcHeight).toBeUndefined();
    expect(usesAuthoritativeStraightFlight(BRIMSTONE_ROCKET_TUBE_ID, gun?.arcHeight)).toBe(true);
    expect(usesAuthoritativeStraightFlight(BRIMSTONE_ROCKET_TUBE_ID, 96)).toBe(false);
    expect(usesAuthoritativeStraightFlight("x-gun-revolver", undefined)).toBe(false);
  });

  it("matches server position after N ticks and never bends a horizontal rendered shot", () => {
    const tickSeconds = TICK_MS / 1000;
    const renderFrameSeconds = tickSeconds / 3;
    const totalTicks = 18;
    const origin = { x: 320, y: 640 };
    const velocity = { vx: 600, vy: 0 };
    let server = { ...origin };
    let rendered: StraightFlightRenderState = {
      x: origin.x - 36,
      y: origin.y - 12,
      observedFlightAgeTicks: undefined,
    };

    for (let tick = 0; tick <= totalTicks; tick++) {
      const snapshot = {
        ...server,
        ...velocity,
        flightAgeTicks: tick,
      };

      rendered = stepAuthoritativeStraightFlight(snapshot, rendered, renderFrameSeconds);
      expect(rendered.x).toBeCloseTo(server.x, 10);
      expect(rendered.y).toBeCloseTo(server.y, 10);

      if (tick === totalTicks) break;
      for (let frame = 1; frame <= 3; frame++) {
        rendered = stepAuthoritativeStraightFlight(snapshot, rendered, renderFrameSeconds);
        const elapsedSeconds = tick * tickSeconds + frame * renderFrameSeconds;
        const authoritativeX = origin.x + velocity.vx * elapsedSeconds;
        const authoritativeY = origin.y + velocity.vy * elapsedSeconds;
        expect(rendered.x).toBeCloseTo(authoritativeX, 10);
        expect(rendered.y).toBeCloseTo(authoritativeY, 10);
        expect(rendered.y).toBe(origin.y);
      }

      server = {
        x: server.x + velocity.vx * tickSeconds,
        y: server.y + velocity.vy * tickSeconds,
      };
    }
  });
});
