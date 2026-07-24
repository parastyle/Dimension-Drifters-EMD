import { PlayerAttackMoveMode } from "@dd/shared";
import { describe, expect, it } from "vitest";
import { SelfPredictor, type ServerView } from "./prediction.js";

function baseline(attackMoveMode: number): ServerView {
  return {
    x: 1_000,
    y: 1_000,
    mvx: 0,
    mvy: 0,
    vx: 0,
    vy: 0,
    height: 0,
    vh: 0,
    ackSeq: 0,
    teleportSeq: 0,
    attackMoveMode,
    alive: true,
  };
}

describe("SelfPredictor B33 attack movement modes", () => {
  it("mirrors normal, slowed active-frame, and root-motion replacement inputs", () => {
    const normal = new SelfPredictor(baseline(PlayerAttackMoveMode.Normal));
    const slowed = new SelfPredictor(baseline(PlayerAttackMoveMode.InputSlow));
    const rooted = new SelfPredictor(baseline(PlayerAttackMoveMode.RootMotion));
    for (let tick = 0; tick < 4; tick++) {
      normal.tick(normal.mintCmd(1, 0, false));
      slowed.tick(slowed.mintCmd(1, 0, false));
      rooted.tick(rooted.mintCmd(1, 0, false));
    }
    const normalX = normal.renderPos(0, 0, 0).x;
    const slowedX = slowed.renderPos(0, 0, 0).x;
    const rootedX = rooted.renderPos(0, 0, 0).x;
    expect(rootedX).toBe(1_000);
    expect(slowedX).toBeGreaterThan(rootedX);
    expect(slowedX).toBeLessThan(normalX);
  });
});
