import { ULTIMATES_ENABLED, UltimatePhase } from "@dd/shared";
import { describe, expect, it } from "vitest";
import {
  canReleaseUltimateReveal,
  ultimateInputAffordance,
  ultimateSeqEdge,
} from "./ultimate-reveal.js";

describe("ultimateSeqEdge", () => {
  it("suppresses ready and cast edges while the reversible feature flag is off", () => {
    expect(ULTIMATES_ENABLED).toBe(false);
    expect(ultimateSeqEdge(7, 8, 100, UltimatePhase.Idle)).toBe("none");
    expect(ultimateSeqEdge(8, 9, 0, UltimatePhase.Windup)).toBe("none");
  });

  it("keeps wrapped and stale sequence changes silent", () => {
    expect(ultimateSeqEdge(0xffff, 0, 100, UltimatePhase.Idle)).toBe("none");
    expect(ultimateSeqEdge(8, 7, 100, UltimatePhase.Idle)).toBe("none");
  });
});

describe("ultimateInputAffordance", () => {
  const ready = {
    alive: true,
    modal: false,
    unlocked: true,
    charge: 100,
    phase: UltimatePhase.Idle,
    pending: false,
    doorReturn: false,
  };

  it("blocks ready, dry, and Door-return input while ultimates are disabled", () => {
    expect(ultimateInputAffordance(ready)).toBe("blocked");
    expect(ultimateInputAffordance({ ...ready, charge: 0 })).toBe("blocked");
    expect(ultimateInputAffordance({ ...ready, charge: 0, doorReturn: true })).toBe("blocked");
  });

  it("keeps death, modal, and pending gates silent", () => {
    expect(ultimateInputAffordance({ ...ready, alive: false })).toBe("blocked");
    expect(ultimateInputAffordance({ ...ready, modal: true })).toBe("blocked");
    expect(ultimateInputAffordance({ ...ready, pending: true })).toBe("blocked");
  });
});

describe("ultimate reveal release latch", () => {
  it("never releases a reveal while ultimates are disabled", () => {
    expect(canReleaseUltimateReveal(true, true, true)).toBe(false);
    expect(canReleaseUltimateReveal(true, false, true)).toBe(false);
    expect(canReleaseUltimateReveal(true, false, false)).toBe(false);
  });
});
