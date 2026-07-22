import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({
  default: {
    BlendModes: { ADD: 1 },
    TintModes: { FILL: 1, MULTIPLY: 2 },
  },
}));

import { measureBladeWidthAtExtensionJoin } from "./SpriteRig.js";

function alphaBlade(width: number, height: number, bladeTop: number, bladeBottom: number) {
  return (x: number, y: number): number =>
    x >= 60 && x < width && y >= bladeTop && y <= bladeBottom && y < height ? 255 : 0;
}

describe("SpriteRig blade-extension attachment", () => {
  it("derives join width from opaque blade pixels instead of a weapon-authored ratio", () => {
    const width = measureBladeWidthAtExtensionJoin(100, 40, 0.1, alphaBlade(100, 40, 11, 27));
    expect(width).toBe(17);
  });

  it("uses the median axial sample so a one-column chip cannot widen the extension", () => {
    const alpha = (x: number, y: number): number => {
      if (x === 73 && y >= 2 && y <= 36) return 255;
      return alphaBlade(100, 40, 13, 23)(x, y);
    };
    expect(measureBladeWidthAtExtensionJoin(100, 40, 0.1, alpha)).toBe(11);
  });

  it("tracks sprite resizing because both narrow and broad blades are measured live", () => {
    const narrow = measureBladeWidthAtExtensionJoin(120, 48, 0.08, alphaBlade(120, 48, 20, 28));
    const broad = measureBladeWidthAtExtensionJoin(120, 48, 0.08, alphaBlade(120, 48, 8, 38));
    expect(narrow).toBe(9);
    expect(broad).toBe(31);
  });
});
