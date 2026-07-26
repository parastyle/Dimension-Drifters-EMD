import { PlayerState } from "@dd/shared";
import { describe, expect, it } from "vitest";
import {
  createPresentedActorState,
  limitPresentedRootStep,
  PresentationFrameClock,
  PresentedActorBuffer,
} from "./rig-presentation.js";

describe("presentation frame clock", () => {
  it("is a single monotonic freeze-aware timebase", () => {
    const clock = new PresentationFrameClock();
    const first = { ...clock.advance(100, 16, true) };
    const frozen = { ...clock.advance(116, 16, false) };
    const resumed = { ...clock.advance(132, 16, true) };
    expect(first.nowMs).toBe(16);
    expect(frozen.nowMs).toBe(first.nowMs);
    expect(frozen.deltaMs).toBe(0);
    expect(resumed.nowMs).toBe(32);
    expect(resumed.frame).toBe(3);
  });

  it("marks a render stall as a timing cut without forking the monotonic clock", () => {
    const clock = new PresentationFrameClock();
    clock.advance(0, 16, true);
    const stalled = clock.advance(500, 500, true);
    expect(stalled.nowMs).toBe(516);
    expect(stalled.deltaMs).toBe(500);
    expect(stalled.cut).toBe(true);
  });

  it("keeps correction debt in root space and bounds its rendered derivative", () => {
    const root = limitPresentedRootStep(0, 0, 140, 0, 200, 384, 400);
    expect(root.x).toBeCloseTo(78.8);
    expect(root.y).toBe(0);
  });

  it("samples remote root and discrete pose edges from one coherent timeline row", () => {
    const player = new PlayerState();
    player.id = "remote";
    player.weapon = "first-rifle";
    player.x = 0;
    player.attackSeq = 4;
    player.attackHeld = false;

    const buffer = new PresentedActorBuffer();
    buffer.push(0, player);
    player.x = 10;
    player.attackSeq = 5;
    player.attackHeld = true;
    buffer.push(100, player);

    const frame = new PresentationFrameClock().advance(50, 16, true);
    const actor = createPresentedActorState(frame);
    expect(buffer.sampleInto(50, frame, actor)).toBe(actor);
    expect(actor.rootX).toBeGreaterThan(0);
    expect(actor.rootX).toBeLessThan(10);
    expect(actor.tick).toBe(1);
    expect(actor.attackSeq).toBe(4);
    expect(actor.attackHeld).toBe(false);

    buffer.sampleInto(100, frame, actor);
    expect(actor.rootX).toBe(10);
    expect(actor.attackSeq).toBe(5);
    expect(actor.attackHeld).toBe(true);
  });
});
