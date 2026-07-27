import { MOVE_SPEED, TICK_MS } from "@dd/shared";
import { describe, expect, it } from "vitest";
import { SelfPredictor, type ServerView } from "./prediction.js";

const TICK_SECONDS = TICK_MS / 1000;
const SPEED_TOLERANCE = 1e-9;
const DIRECTIONS = [
  { name: "east", dx: 1, dy: 0 },
  { name: "south-east", dx: 1, dy: 1 },
  { name: "south", dx: 0, dy: 1 },
  { name: "south-west", dx: -1, dy: 1 },
  { name: "west", dx: -1, dy: 0 },
  { name: "north-west", dx: -1, dy: -1 },
  { name: "north", dx: 0, dy: -1 },
  { name: "north-east", dx: 1, dy: -1 },
] as const;

function view(mvx: number, mvy: number): ServerView {
  return {
    x: 3_000,
    y: 3_000,
    mvx,
    mvy,
    vx: 0,
    vy: 0,
    height: 0,
    vh: 0,
    ackSeq: 0,
    teleportSeq: 0,
    alive: true,
  };
}

describe("B74 constant-speed owner prediction", () => {
  for (const direction of DIRECTIONS) {
    for (const backpedalling of [false, true]) {
      const mode = backpedalling ? "backpedalling" : "forward-facing";

      it(`${direction.name} stays constant while ${mode}`, () => {
        const length = Math.hypot(direction.dx, direction.dy);
        const unitX = direction.dx / length;
        const unitY = direction.dy / length;
        // Enter from a full-speed reversal: the retired turn-hitch dipped precisely on this first frame.
        const predictor = new SelfPredictor(view(-unitX * MOVE_SPEED, -unitY * MOVE_SPEED));
        const aimSign = backpedalling ? -1 : 1;
        const speeds: number[] = [];
        const stepSpeeds: number[] = [];
        const initial = predictor.clientMovementReport();
        let previousX = initial.x;
        let previousY = initial.y;

        for (let frame = 0; frame < 24; frame++) {
          const cmd = predictor.mintCmd(
            direction.dx,
            direction.dy,
            false,
            false,
            false,
            unitX * aimSign,
            unitY * aimSign,
          );
          predictor.tick(cmd);
          const current = predictor.clientMovementReport();
          speeds.push(Math.hypot(current.mvx, current.mvy));
          stepSpeeds.push(Math.hypot(current.x - previousX, current.y - previousY) / TICK_SECONDS);
          previousX = current.x;
          previousY = current.y;
        }

        const minVelocity = Math.min(...speeds);
        const maxVelocity = Math.max(...speeds);
        const minStep = Math.min(...stepSpeeds);
        const maxStep = Math.max(...stepSpeeds);
        expect(maxVelocity - minVelocity).toBeLessThanOrEqual(SPEED_TOLERANCE);
        expect(maxStep - minStep).toBeLessThanOrEqual(SPEED_TOLERANCE);
        expect(minVelocity).toBeCloseTo(MOVE_SPEED, 10);
        expect(maxVelocity).toBeCloseTo(MOVE_SPEED, 10);
        expect(minStep).toBeCloseTo(MOVE_SPEED, 10);
        expect(maxStep).toBeCloseTo(MOVE_SPEED, 10);
      });
    }
  }
});
