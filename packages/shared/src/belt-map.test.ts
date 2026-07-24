import { describe, expect, it } from "vitest";
import {
  beltCameraBounds,
  beltLevelFor,
  beltPlayableXBounds,
  beltProjectileBlocked,
  beltWaveSideForDepth,
  corporateGridBeltLevelForDepth,
  corporateGridFloorForBelt,
  corporateGridWavePressure,
  resolveBeltNavigation,
  selectCorporateWaveAnchor,
} from "./belt-map.js";
import { BELT_Y0 } from "./constants.js";
import {
  CORPORATE_GRID_FLOOR_LOOP,
  CORPORATE_GRID_VARIANT_SPANS,
  corporateGridFloorIdForDepth,
  corporateGridFloorInstanceForDepth,
  corporateGridVariantForDepth,
} from "./corporate-grid-map.js";

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

  it("loops Red Carpet -> Portrait Hall -> Marble forever by depth", () => {
    expect(
      Array.from({ length: 8 }, (_, index) => corporateGridFloorIdForDepth(index + 1)),
    ).toEqual([
      ...CORPORATE_GRID_FLOOR_LOOP,
      ...CORPORATE_GRID_FLOOR_LOOP,
      CORPORATE_GRID_FLOOR_LOOP[0],
      CORPORATE_GRID_FLOOR_LOOP[1],
    ]);
  });

  it("selects all three length variants deterministically from the shared depth seed", () => {
    expect([1, 2, 3].map((depth) => corporateGridVariantForDepth(depth))).toEqual([
      "standard",
      "short",
      "long",
    ]);
    for (let depth = 1; depth <= 64; depth++) {
      expect(corporateGridVariantForDepth(depth)).toBe(corporateGridVariantForDepth(depth));
      expect(corporateGridBeltLevelForDepth(depth).corporateVariant).toBe(
        corporateGridVariantForDepth(depth),
      );
    }
  });

  it("crops on 60 px modules and relocates exit/endwall/camera while retaining safe anchors", () => {
    for (const [depth, variant] of [
      [2, "short"],
      [1, "standard"],
      [3, "long"],
    ] as const) {
      const floor = corporateGridFloorInstanceForDepth(depth, variant);
      const span = CORPORATE_GRID_VARIANT_SPANS[variant];
      const maxX = floor.playableBounds.minX + span;
      expect(span % floor.gridSize).toBe(0);
      expect(floor.playableBounds.maxX).toBe(maxX);
      expect(floor.cameraBounds).toMatchObject({ minX: 0, maxX: floor.width });
      expect(floor.elevatorMarkers).toHaveLength(3);
      expect(floor.elevatorMarkers[2]?.x).toBe(maxX);
      expect(floor.endWalls[1]?.bounds.minX).toBe(maxX);
      expect(floor.width).toBe(maxX + floor.gridSize * 2);
      expect(floor.cols * floor.gridSize).toBe(floor.width);
      expect(floor.playerSpawns.every((spawn) => spawn.x > floor.playableBounds.minX)).toBe(true);
      expect(floor.playerSpawns.every((spawn) => spawn.x < maxX)).toBe(true);
      expect(floor.waveAnchors.every((anchor) => anchor.x > floor.playableBounds.minX)).toBe(true);
      expect(floor.waveAnchors.every((anchor) => anchor.x < maxX)).toBe(true);
      expect(floor.elevatorMarkers.every((marker) => marker.bounds.minX >= 0)).toBe(true);
      expect(floor.elevatorMarkers.every((marker) => marker.bounds.maxX <= floor.width)).toBe(true);
    }
  });

  it("consumes cropped lane, end-wall, camera, and solid collision bounds", () => {
    const level = beltLevelFor("corporate-grid");
    expect(beltPlayableXBounds(level)).toEqual({ minX: 120, maxX: 4080 });
    expect(beltCameraBounds(level)).toEqual({
      minX: 0,
      minY: 360,
      maxX: 4200,
      maxY: 1020,
    });
    expect(resolveBeltNavigation(level, 40, BELT_Y0 + 200, 26)).toEqual({
      x: 146,
      y: BELT_Y0 + 476,
    });
    expect(resolveBeltNavigation(level, 5100, BELT_Y0 + 1000, 26)).toEqual({
      x: 4054,
      y: BELT_Y0 + 904,
    });
    expect(beltProjectileBlocked(level, 500, BELT_Y0 + 500, 500, BELT_Y0 + 300, 6)).toBe(true);
    expect(beltProjectileBlocked(level, 500, BELT_Y0 + 600, 700, BELT_Y0 + 600, 6)).toBe(false);
    expect(beltProjectileBlocked(level, 4040, BELT_Y0 + 600, 4100, BELT_Y0 + 600, 6)).toBe(true);
  });

  it("escalates wave size/density with belt depth and becomes bilateral", () => {
    expect(corporateGridWavePressure(1, "short")).toEqual({
      roomCount: 2,
      waves: [4, 5],
      depthBonus: 0,
    });
    expect(corporateGridWavePressure(1, "long").waves).toEqual([4, 5, 6, 7]);
    expect(corporateGridWavePressure(5, "long").waves).toEqual([6, 7, 8, 9]);
    expect(beltWaveSideForDepth(0, 0.84)).toBe("right");
    expect(beltWaveSideForDepth(0, 0.86)).toBe("left");
    expect(beltWaveSideForDepth(2, 0.49)).toBe("right");
    expect(beltWaveSideForDepth(2, 0.51)).toBe("left");

    const earlyLevel = beltLevelFor("corporate-grid");
    const earlyFloor = corporateGridFloorForBelt(earlyLevel);
    if (!earlyFloor) throw new Error("corporate-grid floor 1 is missing");
    expect(selectCorporateWaveAnchor(earlyFloor, 420, 0, 0.2, 0, 120, 1440).x).toBeGreaterThan(420);
    const lateLevel = corporateGridBeltLevelForDepth(3, "long");
    const lateFloor = corporateGridFloorForBelt(lateLevel);
    if (!lateFloor) throw new Error("corporate-grid floor 3 is missing");
    expect(selectCorporateWaveAnchor(lateFloor, 2600, 2, 0.2, 0).x).toBeGreaterThan(2600);
    expect(selectCorporateWaveAnchor(lateFloor, 2600, 2, 0.8, 0).x).toBeLessThan(2600);
  });
});
