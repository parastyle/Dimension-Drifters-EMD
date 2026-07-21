import { ZoneStyle } from "@dd/shared";
import { describe, expect, it } from "vitest";
import { GROUND_ZONE_CHUNK_CAP, groundZoneChunkPlan } from "./ground-zone-renderer.js";

describe("V3R poison smoke ring rendering", () => {
  it("places every bounded smoke wisp in a deterministic perimeter annulus", () => {
    const radius = 150;
    const plan = groundZoneChunkPlan(73, radius, ZoneStyle.PoisonSmoke);
    const radialFractions = plan.map((chunk) => Math.hypot(chunk.x, chunk.y / 0.62) / radius);
    expect(plan).toEqual(groundZoneChunkPlan(73, radius, ZoneStyle.PoisonSmoke));
    expect(plan).toHaveLength(GROUND_ZONE_CHUNK_CAP);
    expect(Math.min(...radialFractions)).toBeGreaterThanOrEqual(0.66);
    expect(Math.max(...radialFractions)).toBeLessThanOrEqual(0.87);
  });
});
