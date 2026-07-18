import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({ default: {} }));

import { beamPaintFor, beamVisualWidth } from "./BeamRenderer.js";

describe("BeamRenderer presentation laws", () => {
  it("breathes strictly within the authoritative swept-band width at every heat state", () => {
    for (const width of [1, 48, 64]) {
      for (const heat of [0, 0.68, 0.85, 1]) {
        for (let nowMs = 0; nowMs <= 2_000; nowMs += 17) {
          const visual = beamVisualWidth(width, nowMs, 0.731, heat);
          expect(visual).toBeGreaterThan(0);
          expect(visual).toBeLessThanOrEqual(width);
        }
      }
    }
  });

  it("routes beam families through their shipped element wisp and bolt sheets", () => {
    expect(beamPaintFor("water").id).toBe("water");
    expect(beamPaintFor("nature").id).toBe("nature");
    expect(beamPaintFor("solar").id).toBe("fire");
    expect(beamPaintFor("shadow").id).toBe("void");
  });
});
