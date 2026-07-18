import { describe, expect, it } from "vitest";
import { scaleWorldDeterminant, screenTrueScaleX } from "./screen-true-transform.js";

describe("screen-true retained VFX transforms", () => {
  it("counter-reflects either parent axis from the live determinant", () => {
    for (const parentScaleX of [-1, 1]) {
      for (const parentScaleY of [-1, 1]) {
        const childScaleX = screenTrueScaleX(parentScaleX, parentScaleY, 0.75);
        expect(
          scaleWorldDeterminant(parentScaleX, parentScaleY, childScaleX, 1.25),
        ).toBeGreaterThan(0);
      }
    }
  });
});
