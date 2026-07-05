import { INTERP_DELAY_MS, INTERP_EXTRAP_MAX_MS, TICK_MS } from "@dd/shared";
import { describe, expect, it } from "vitest";
import { SnapshotBuffer, TimelineSync } from "./snapshots.js";

/** §4 v0.107 snapshot-buffer interpolation — remote entities on the server-tick timeline. */

describe("SnapshotBuffer", () => {
  it("linearly interpolates between bracketing snapshots", () => {
    const b = new SnapshotBuffer();
    b.push(100, 0, 0);
    b.push(150, 100, 50);
    const s = b.sample(125, 260);
    expect(s?.x).toBeCloseTo(50, 6);
    expect(s?.y).toBeCloseTo(25, 6);
  });

  it("treats a bracket gap wider than the snap threshold as a TELEPORT (jumps, never tweens across)", () => {
    const b = new SnapshotBuffer();
    b.push(100, 0, 0);
    b.push(150, 3000, 3000); // a rift/reposition between two patches
    const s = b.sample(125, 260);
    expect(s?.x).toBe(3000); // cut to the far side — no glide across the map
  });

  it("extrapolates PAST the newest snapshot along the last velocity, clamped, then holds", () => {
    const b = new SnapshotBuffer();
    b.push(100, 0, 0);
    b.push(150, 10, 0); // 10px / 50ms rightward
    const nearAhead = b.sample(175, 260); // 25ms past the newest (inside the clamp)
    expect(nearAhead?.x).toBeCloseTo(15, 6);
    const farAhead = b.sample(1000, 260); // way past — clamped at INTERP_EXTRAP_MAX_MS then held
    expect(farAhead?.x).toBeCloseTo(10 + (10 * INTERP_EXTRAP_MAX_MS) / 50, 6);
  });

  it("holds the oldest snapshot before the buffer starts, and null when empty", () => {
    const b = new SnapshotBuffer();
    expect(b.sample(100, 260)).toBeNull();
    b.push(200, 42, 7);
    const s = b.sample(50, 260);
    expect(s?.x).toBe(42);
  });

  it("reset() drops history (a remote teleport holds at the authoritative point, no re-walk)", () => {
    const b = new SnapshotBuffer();
    b.push(100, 0, 0);
    b.push(150, 20, 0);
    b.reset(200, 500, 500); // fellSeq bump → purge + reseed
    const s = b.sample(160, 260); // sampling into what used to be the old path
    expect(s?.x).toBe(500); // held at the post-teleport truth
  });

  it("ignores duplicate/out-of-order stamps and caps the ring depth", () => {
    const b = new SnapshotBuffer();
    for (let i = 0; i < 30; i++) b.push(i * TICK_MS, i, 0);
    b.push(100, -999, 0); // stale re-observation — ignored
    const s = b.sample(29 * TICK_MS, 260);
    expect(s?.x).toBe(29);
  });
});

describe("TimelineSync", () => {
  it("maps client time onto the server-tick timeline via the least-delayed arrival", () => {
    const ts = new TimelineSync();
    // Ticks arrive with 80ms base delay + jitter; the min-offset should learn ~80ms.
    ts.onPatch(10, 10 * TICK_MS + 80);
    ts.onPatch(11, 11 * TICK_MS + 95); // jittery arrival
    ts.onPatch(12, 12 * TICK_MS + 80);
    const now = 13 * TICK_MS + 80;
    // renderTime = now − minOffset − INTERP_DELAY = tick 13's stamp − the interp delay.
    expect(ts.renderTime(now)).toBeCloseTo(13 * TICK_MS - INTERP_DELAY_MS, 6);
  });

  it("is immune to a TCP burst: three late patches arriving at once do not warp the timeline", () => {
    const ts = new TimelineSync();
    ts.onPatch(10, 10 * TICK_MS + 80); // one clean arrival established the offset
    const burstAt = 14 * TICK_MS + 300; // a stall, then everything at once
    ts.onPatch(11, burstAt);
    ts.onPatch(12, burstAt);
    ts.onPatch(13, burstAt);
    // The min-offset is still the clean 80ms one — burst arrivals (bigger offsets) don't shift it.
    expect(ts.renderTime(burstAt)).toBeCloseTo(burstAt - 80 - INTERP_DELAY_MS, 6);
  });
});
