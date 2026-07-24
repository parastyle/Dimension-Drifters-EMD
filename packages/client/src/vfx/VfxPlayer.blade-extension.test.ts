import { bladeExtensionGeometryFor, WEAPONS } from "@dd/shared";
import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({
  default: {
    BlendModes: { ADD: 1 },
    TintModes: { FILL: 1, MULTIPLY: 2 },
  },
}));

import { bladeExtensionDrawTransform, fitBladeExtensionDrawLengthToReach } from "./VfxPlayer.js";

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

  it("keeps Mirage's narrow 1H hardlight sample blade-owned on both facings", () => {
    const mirage = WEAPONS["x2-mirage-hardlight-saber"];
    const mirageGeometry = mirage && bladeExtensionGeometryFor(mirage);
    if (!mirage || !mirageGeometry) throw new Error("missing Mirage blade-extension fixture");
    for (const facing of [1, -1] as const) {
      const pose = {
        x: facing > 0 ? 412 : 228,
        y: 184,
        axisX: facing,
        axisY: 0,
        normalX: 0,
        normalY: facing,
        physicalBladeLength: 95.7,
        bladeWidth: 16,
      };
      const draw = bladeExtensionDrawTransform(pose, mirageGeometry, 1);
      expect(draw.rootX + pose.axisX * draw.overlapLength).toBeCloseTo(pose.x, 10);
      expect(draw.rootY + pose.axisY * draw.overlapLength).toBeCloseTo(pose.y, 10);
      expect(draw.emergedLength).toBeCloseTo(191.4, 8);
      expect(draw.drawLength).toBeCloseTo(220.11, 8);
      expect(draw.bladeWidth).toBe(16);
      expect(draw.normalSign).toBe(1);
    }
  });

  it("fits only local-axis length to Mirage's authoritative radius without breaking ignition origin", () => {
    const mirage = WEAPONS["x2-mirage-hardlight-saber"];
    const mirageGeometry = mirage && bladeExtensionGeometryFor(mirage);
    if (!mirage || !mirageGeometry) throw new Error("missing Mirage blade-extension fixture");
    for (const facing of [1, -1] as const) {
      const pose = {
        wielderX: 320,
        wielderY: 180,
        x: 320 + facing * 128,
        y: 162,
        axisX: facing,
        axisY: 0,
        normalX: 0,
        normalY: facing,
        physicalBladeLength: 95.7,
        bladeWidth: 16,
      };
      const hidden = bladeExtensionDrawTransform(pose, mirageGeometry, 0);
      const hiddenFit = fitBladeExtensionDrawLengthToReach(pose, hidden, 136, 0);
      expect(hiddenFit.drawLength).toBe(hidden.drawLength);

      const full = bladeExtensionDrawTransform(pose, mirageGeometry, 1);
      const fullFit = fitBladeExtensionDrawLengthToReach(pose, full, 287.1, 1);
      const tipX = fullFit.rootX + pose.axisX * fullFit.drawLength;
      const tipY = fullFit.rootY + pose.axisY * fullFit.drawLength;
      expect(Math.hypot(tipX - pose.wielderX, tipY - pose.wielderY)).toBeCloseTo(287.1, 8);
      expect(fullFit.rootX + pose.axisX * fullFit.overlapLength).toBeCloseTo(pose.x, 10);
      expect(fullFit.rootY + pose.axisY * fullFit.overlapLength).toBeCloseTo(pose.y, 10);
      expect(fullFit.bladeWidth).toBe(pose.bladeWidth);
    }
  });
});
