import { describe, expect, it } from "vitest";
import {
  beltCameraBounds,
  beltLevelFor,
  beltPlayableXBounds,
  beltProjectileBlocked,
  beltWaveSideForDepth,
  corporateGridFloorForBelt,
  resolveBeltNavigation,
  selectCorporateWaveAnchor,
} from "./belt-map.js";
import { BELT_Y0 } from "./constants.js";

describe("corporate-grid belt map consumption", () => {
  it("boots corporate-grid on authored floor 1 and exposes all direct floor selections", () => {
    expect(beltLevelFor("corporate-grid").corporateGridFloorId).toBe("office-red-carpet-gallery");
    expect(beltLevelFor("corporate-grid-portrait-hall").corporateGridFloorId).toBe(
      "office-random-dude-portrait-hall",
    );
    expect(beltLevelFor("corporate-grid-marble-gallery").corporateGridFloorId).toBe(
      "office-marble-gallery",
    );
    expect(beltLevelFor("office-red-carpet-gallery")).toBe(beltLevelFor("corporate-grid"));
  });

  it("consumes authored lane, end-wall, camera, and solid collision bounds", () => {
    const level = beltLevelFor("corporate-grid");
    expect(beltPlayableXBounds(level)).toEqual({ minX: 120, maxX: 5040 });
    expect(beltCameraBounds(level)).toEqual({
      minX: 120,
      minY: 360,
      maxX: 5040,
      maxY: 1020,
    });
    expect(resolveBeltNavigation(level, 40, BELT_Y0 + 200, 26)).toEqual({
      x: 146,
      y: BELT_Y0 + 476,
    });
    expect(resolveBeltNavigation(level, 5100, BELT_Y0 + 1000, 26)).toEqual({
      x: 5014,
      y: BELT_Y0 + 904,
    });
    expect(beltProjectileBlocked(level, 500, BELT_Y0 + 500, 500, BELT_Y0 + 300, 6)).toBe(true);
    expect(beltProjectileBlocked(level, 500, BELT_Y0 + 600, 700, BELT_Y0 + 600, 6)).toBe(false);
    expect(beltProjectileBlocked(level, 5000, BELT_Y0 + 600, 5060, BELT_Y0 + 600, 6)).toBe(true);
  });

  it("right-biases early waves and becomes bilateral at later-floor depth", () => {
    expect(beltWaveSideForDepth(0, 0.84)).toBe("right");
    expect(beltWaveSideForDepth(0, 0.86)).toBe("left");
    expect(beltWaveSideForDepth(2, 0.49)).toBe("right");
    expect(beltWaveSideForDepth(2, 0.51)).toBe("left");

    const earlyLevel = beltLevelFor("corporate-grid");
    const earlyFloor = corporateGridFloorForBelt(earlyLevel);
    if (!earlyFloor) throw new Error("corporate-grid floor 1 is missing");
    expect(selectCorporateWaveAnchor(earlyFloor, 420, 0, 0.2, 0, 120, 1440).x).toBeGreaterThan(420);
    const lateLevel = beltLevelFor("corporate-grid-marble-gallery");
    const lateFloor = corporateGridFloorForBelt(lateLevel);
    if (!lateFloor) throw new Error("corporate-grid floor 3 is missing");
    expect(selectCorporateWaveAnchor(lateFloor, 2600, 2, 0.2, 0).x).toBeGreaterThan(2600);
    expect(selectCorporateWaveAnchor(lateFloor, 2600, 2, 0.8, 0).x).toBeLessThan(2600);
  });
});
