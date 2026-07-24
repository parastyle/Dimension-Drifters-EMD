import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({ default: {} }));

import {
  beamPaintFor,
  beamVisualWidth,
  recoveredBeamTileGeometry,
  rigidBeamRenderAngle,
  seraphBeamCursorPose,
} from "./BeamRenderer.js";
import { BEAM_STRUCTURE_ART, beamStructureWorldBounds } from "./beam-structure-art.js";
import { BEAM_VFX_RECIPES } from "./caster-vfx-recipes.js";

describe("BeamRenderer presentation laws", () => {
  it("takes the current weapon angle directly without a remote interpolation frame", () => {
    expect(rigidBeamRenderAngle(2.7)).toBe(2.7);
    expect(rigidBeamRenderAngle(-2.4)).toBe(-2.4);
  });

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

  it("terminates Seraph at the cursor while retaining the authoritative collision cap", () => {
    expect(seraphBeamCursorPose({ x: 10, y: 20 }, { x: 110, y: 20 }, 640)).toEqual({
      originX: 10,
      originY: 20,
      angle: 0,
      length: 100,
    });
    expect(seraphBeamCursorPose({ x: 10, y: 20 }, { x: 1010, y: 20 }, 640).length).toBe(640);
  });

  it("uses only the recovered Unicorn cel-band tile for its active beam", () => {
    const recipe = BEAM_VFX_RECIPES["x2-unicorn-rainbow-beam"]!;
    expect(recipe.signature).toBe("unicorn-recovered-cel-band-tile");
    expect(recipe.tileArt).toEqual({
      textureKey: "recovered:unicorn-rainbow-beam",
      url: "sprites/vfx-unicorn-rainbow-beam/part-1.png",
      nativeWidth: 1158,
      nativeHeight: 362,
    });
    expect(recipe.structure).toBeUndefined();
    expect(recipe.strandPalette).toBeUndefined();
  });

  it("tiles Unicorn art inside the authoritative beam rectangle under belt projection", () => {
    expect(recoveredBeamTileGeometry(20, 30, 0, 520, 64, 10, 0.4)).toEqual({
      x: 20,
      y: 18,
      angle: 0,
      length: 520,
      width: 25.6,
    });
    const vertical = recoveredBeamTileGeometry(20, 30, Math.PI / 2, 520, 64, 10, 0.4);
    expect(vertical.x).toBe(20);
    expect(vertical.y).toBe(18);
    expect(vertical.angle).toBeCloseTo(Math.PI / 2);
    expect(vertical.length).toBeCloseTo(208);
    expect(vertical.width).toBeCloseTo(64);
  });

  it("fits every generated structure alpha bound inside authoritative width and range", () => {
    for (const art of Object.values(BEAM_STRUCTURE_ART)) {
      expect(art.provenance, art.kind).toBe("codex-generated");
      for (const authoritativeWidth of [8, 18, 48, 64]) {
        const renderedWidth = authoritativeWidth * 0.92;
        const bounds = beamStructureWorldBounds(art, 640, renderedWidth);
        expect(bounds.longitudinalStart, art.kind).toBeGreaterThanOrEqual(0);
        expect(bounds.longitudinalEnd, art.kind).toBeLessThanOrEqual(640);
        expect(bounds.transverseMin, art.kind).toBeGreaterThanOrEqual(-authoritativeWidth * 0.5);
        expect(bounds.transverseMax, art.kind).toBeLessThanOrEqual(authoritativeWidth * 0.5);
      }
    }
  });

  it("ships non-equivalent longitudinal occupancies and ice-only Frostquill material", () => {
    const occupancies = Object.values(BEAM_STRUCTURE_ART).map(
      (art) => art.energeticColumnOccupancy,
    );
    expect(new Set(occupancies.map((value) => value.toFixed(3))).size).toBeGreaterThanOrEqual(4);
    expect(BEAM_STRUCTURE_ART["ice-particles"].material).toBe("ice-particles");
    expect(BEAM_STRUCTURE_ART["ice-particles"].alphaBounds).toEqual({
      minX: 8,
      minY: 27,
      maxX: 247,
      maxY: 68,
    });
  });
});
