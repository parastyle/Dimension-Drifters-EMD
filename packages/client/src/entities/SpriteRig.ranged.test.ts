import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({ default: {} }));

import {
  RANGED_AIM_LINGER_MS,
  RANGED_AIM_RAISE_MS,
  RANGED_AIM_SETTLE_MS,
  sampleRangedAimBlend,
} from "./SpriteRig.js";

describe("SpriteRig ranged aimed-pose envelope", () => {
  it("raises quickly, holds through linger, and settles back to rest", () => {
    const raiseAt = 1_000;
    const activeUntil = raiseAt + RANGED_AIM_LINGER_MS;
    expect(sampleRangedAimBlend(raiseAt - 1, raiseAt, activeUntil)).toBe(0);
    expect(sampleRangedAimBlend(raiseAt + RANGED_AIM_RAISE_MS, raiseAt, activeUntil)).toBe(1);
    expect(sampleRangedAimBlend(activeUntil, raiseAt, activeUntil)).toBe(1);
    expect(sampleRangedAimBlend(activeUntil + RANGED_AIM_SETTLE_MS, raiseAt, activeUntil)).toBe(0);
  });
});
