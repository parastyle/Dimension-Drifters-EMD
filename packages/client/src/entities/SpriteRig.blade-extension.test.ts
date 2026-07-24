import { bladeExtensionGeometryFor, meleeDamageEnvelopeFor, WEAPONS } from "@dd/shared";
import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({
  default: {
    BlendModes: { ADD: 1 },
    TintModes: { FILL: 1, MULTIPLY: 2 },
  },
}));

import {
  ALL_BLADE_EXTENSION_TREATMENTS,
  bladeExtensionTreatmentFor,
  MIRAGE_HARDLIGHT_EXTENSION_TREATMENT,
  weaponSupportsBladeExtension,
} from "../vfx/blade-extension-treatments.js";
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

  it("routes Mirage's 1H blade sample through the bespoke hardlight treatment", () => {
    const mirage = WEAPONS["x2-mirage-hardlight-saber"];
    if (!mirage) throw new Error("Missing Mirage Hardlight Saber fixture");
    const sourceWidth = 256;
    const sourceHeight = 34;
    const measuredWidth = measureBladeWidthAtExtensionJoin(
      sourceWidth,
      sourceHeight,
      mirage.gripFrac,
      alphaBlade(sourceWidth, sourceHeight, 9, 24),
    );
    const geometry = bladeExtensionGeometryFor(mirage);
    expect(mirage.tags).toMatchObject({ grip: "1H", size: "M" });
    expect(measuredWidth).toBe(16);
    expect(geometry?.physicalBladeLength).toBeCloseTo(95.7, 8);
    expect(geometry?.fullTipReach).toBeCloseTo(287.1, 8);
    expect(weaponSupportsBladeExtension(mirage.id)).toBe(true);
    expect(bladeExtensionTreatmentFor(mirage.id)).toBe(MIRAGE_HARDLIGHT_EXTENSION_TREATMENT);
    expect(MIRAGE_HARDLIGHT_EXTENSION_TREATMENT).toMatchObject({
      kind: "procedural-hardlight",
      element: "hardlight",
      textureKey: "blade-extension:mirage-hardlight",
    });
    expect(ALL_BLADE_EXTENSION_TREATMENTS).toHaveLength(7);
  });

  it("does not attach, measure, or extend Sanctified Headsman's ordinary blade", () => {
    const headsman = WEAPONS["x2-sanctified-headsman"];
    if (!headsman) throw new Error("Missing Sanctified Headsman fixture");
    const envelope = meleeDamageEnvelopeFor(headsman);
    expect(weaponSupportsBladeExtension(headsman.id)).toBe(false);
    expect(bladeExtensionGeometryFor(headsman)).toBeUndefined();
    expect(envelope.bladeExtension).toBeUndefined();
    expect(envelope.maxReach).toBe(envelope.baseReach);
  });
});
