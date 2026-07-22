import { bladeExtensionGeometryFor, WEAPONS } from "@dd/shared";
import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({
  default: {
    BlendModes: { ADD: 1 },
    TintModes: { FILL: 1, MULTIPLY: 2 },
  },
}));

import { bladeExtensionDrawTransform } from "./VfxPlayer.js";

describe("VfxPlayer blade-extension one-transform composition", () => {
  const weapon = WEAPONS["x2-rimewrit-grave-slab"];
  if (!weapon) throw new Error("missing Rimewrit blade-extension fixture");
  const geometry = bladeExtensionGeometryFor(weapon);
  if (!geometry) throw new Error("missing Rimewrit blade-extension geometry");

  for (const sample of [
    { name: "right/up", angle: 0.63, normalSign: 1 as const },
    { name: "left/down mirrored", angle: -2.42, normalSign: -1 as const },
  ]) {
    it(`keeps the hidden join exact at ${sample.name}`, () => {
      const axisX = Math.cos(sample.angle);
      const axisY = Math.sin(sample.angle);
      const pose = {
        x: 418.25,
        y: 231.75,
        axisX,
        axisY,
        normalX: -axisY * sample.normalSign,
        normalY: axisX * sample.normalSign,
        physicalBladeLength: 207,
        bladeWidth: 43,
      };
      const draw = bladeExtensionDrawTransform(pose, geometry, 0.37);
      const joinX = draw.rootX + axisX * draw.overlapLength;
      const joinY = draw.rootY + axisY * draw.overlapLength;
      expect(joinX).toBeCloseTo(pose.x, 10);
      expect(joinY).toBeCloseTo(pose.y, 10);
      expect(draw.bladeWidth).toBe(pose.bladeWidth);
      expect(draw.normalSign).toBe(sample.normalSign);
      expect(draw.emergedLength).toBeCloseTo(pose.physicalBladeLength * 2 * 0.37, 8);
      expect(draw.drawLength).toBeCloseTo(pose.physicalBladeLength * (0.3 + 2 * 0.37), 8);
    });
  }

  it("starts entirely inside the physical blade and reaches the exact 3x tip at full reveal", () => {
    const pose = {
      x: 100,
      y: 200,
      axisX: 1,
      axisY: 0,
      normalX: 0,
      normalY: 1,
      physicalBladeLength: 180,
      bladeWidth: 36,
    };
    const hidden = bladeExtensionDrawTransform(pose, geometry, 0);
    const full = bladeExtensionDrawTransform(pose, geometry, 1);
    expect(hidden.drawLength).toBeCloseTo(hidden.overlapLength, 8);
    expect(full.emergedLength).toBeCloseTo(360, 8);
    expect(full.drawLength - full.overlapLength).toBeCloseTo(360, 8);
  });
});
