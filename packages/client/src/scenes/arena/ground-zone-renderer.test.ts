import { ZoneStyle } from "@dd/shared";
import { describe, expect, it } from "vitest";
import { GROUND_ZONE_CHUNK_CAP, groundZoneChunkPlan } from "./ground-zone-renderer.js";

describe("procedural painted ground-zone chunks", () => {
  it("is deterministic, bounded, and reveals small authored bits from core to perimeter", () => {
    const plan = groundZoneChunkPlan(417, 220, ZoneStyle.Nether);
    expect(plan).toEqual(groundZoneChunkPlan(417, 220, ZoneStyle.Nether));
    expect(plan).toHaveLength(GROUND_ZONE_CHUNK_CAP);
    expect(plan.every((chunk, index) => index === 0 || chunk.revealRadius >= plan[index - 1]!.revealRadius)).toBe(true);
    expect(Math.max(...plan.map((chunk) => Math.hypot(chunk.x, chunk.y / 0.62)))).toBeLessThanOrEqual(220);
  });

  it("gives nether, poison, and ice independent seeded compositions", () => {
    const nether = groundZoneChunkPlan(23, 96, ZoneStyle.Nether);
    const poison = groundZoneChunkPlan(23, 96, ZoneStyle.Poison);
    const ice = groundZoneChunkPlan(23, 96, ZoneStyle.Ice);
    expect(nether).not.toEqual(poison);
    expect(poison).not.toEqual(ice);
    expect([...nether, ...poison, ...ice].every((chunk) => chunk.frame >= 0 && chunk.frame < 12)).toBe(true);
  });
});
