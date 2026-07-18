import { UltimatePhase } from "@dd/shared";
import { describe, expect, it } from "vitest";
import {
  canReleaseUltimateReveal,
  ultimateInputAffordance,
  ultimateSeqEdge,
} from "./ultimate-reveal.js";

describe("ultimateSeqEdge", () => {
  it("classifies the server's ready edge from authoritative charge and phase", () => {
    expect(ultimateSeqEdge(7, 8, 100, UltimatePhase.Idle)).toBe("ready");
    expect(ultimateSeqEdge(8, 9, 0, UltimatePhase.Windup)).toBe("cast");
  });

  it("accepts uint16 wrap and rejects stale/backward patches", () => {
    expect(ultimateSeqEdge(0xffff, 0, 100, UltimatePhase.Idle)).toBe("ready");
    expect(ultimateSeqEdge(8, 7, 100, UltimatePhase.Idle)).toBe("none");
  });
});

describe("ultimateInputAffordance", () => {
  const ready = {
    alive: true,
    modal: false,
    nearShop: false,
    unlocked: true,
    charge: 100,
    phase: UltimatePhase.Idle,
    pending: false,
    doorReturn: false,
  };

  it("sends only a ready cast or live Door return", () => {
    expect(ultimateInputAffordance(ready)).toBe("send");
    expect(ultimateInputAffordance({ ...ready, charge: 0 })).toBe("dry");
    expect(ultimateInputAffordance({ ...ready, charge: 0, doorReturn: true })).toBe("send");
  });

  it("keeps death, modal, shop, and pending gates silent", () => {
    expect(ultimateInputAffordance({ ...ready, alive: false })).toBe("blocked");
    expect(ultimateInputAffordance({ ...ready, modal: true })).toBe("blocked");
    expect(ultimateInputAffordance({ ...ready, nearShop: true })).toBe("blocked");
    expect(ultimateInputAffordance({ ...ready, pending: true })).toBe("blocked");
  });
});

describe("ultimate reveal release latch", () => {
  it("waits for both the level window and its release latch", () => {
    expect(canReleaseUltimateReveal(true, true, true, true)).toBe(false);
    expect(canReleaseUltimateReveal(true, false, true, true)).toBe(false);
    expect(canReleaseUltimateReveal(true, false, false, true)).toBe(true);
    expect(canReleaseUltimateReveal(true, false, false, false)).toBe(false);
  });
});
