import { describe, expect, it } from "vitest";
import { LIMB_BLEND_OUT_MS, LimbPriorityResolver, resolveLimbOwner } from "./rig-limb-priority.js";

describe("limb priority arbitration", () => {
  it("uses a declared total order independent of writer order", () => {
    const candidates = [
      { owner: "spring", active: true, weight: 1 },
      { owner: "attack", active: true, weight: 0.6 },
      { owner: "flourish", active: true, weight: 1 },
      { owner: "gun-mechanism", active: true, weight: 1 },
      { owner: "locomotion", active: true, weight: 1 },
    ] as const;
    expect(resolveLimbOwner("hand-l", candidates).owner).toBe("attack");
    expect(resolveLimbOwner("hand-l", [...candidates].reverse()).owner).toBe("attack");
  });

  it("blends a losing attack to locomotion without a transform discontinuity", () => {
    const resolver = new LimbPriorityResolver();
    const attackPose = { x: 80, y: -20, rotation: 1, scaleX: 1, scaleY: 1 };
    resolver.apply("hand-r", attackPose, [{ owner: "attack", active: true, weight: 1 }], 0);

    const releasePose = { x: 0, y: 10, rotation: 0, scaleX: 1, scaleY: 1 };
    const edge = { ...releasePose };
    const resolution = resolver.apply(
      "hand-r",
      edge,
      [{ owner: "locomotion", active: true, weight: 1 }],
      16,
    );
    expect(resolution.owner).toBe("locomotion");
    expect(edge.x).toBeCloseTo(80);
    expect(edge.y).toBeCloseTo(-20);

    const settled = { ...releasePose };
    resolver.apply(
      "hand-r",
      settled,
      [{ owner: "locomotion", active: true, weight: 1 }],
      16 + LIMB_BLEND_OUT_MS,
    );
    expect(settled).toMatchObject(releasePose);
  });
});
