import { describe, expect, it } from "vitest";
import {
  elementAssistPattern,
  meleeTellUsesDoublePulse,
  parryDoublePulseStrength,
} from "./colorblind-assist.js";

describe("colorblind telegraph redundancy", () => {
  it("keeps ordinary tells single-pulse by default and gives Shapes the empowered double rhythm", () => {
    expect(meleeTellUsesDoublePulse("off", false)).toBe(false);
    expect(meleeTellUsesDoublePulse("shapes", false)).toBe(true);
    expect(meleeTellUsesDoublePulse("off", true)).toBe(true);
  });

  it("produces two separated generic parry crests", () => {
    expect(parryDoublePulseStrength(0.72)).toBe(1);
    expect(parryDoublePulseStrength(0.81)).toBe(0);
    expect(parryDoublePulseStrength(0.9)).toBe(1);
  });

  it("assigns non-hue beam marks across element aliases", () => {
    expect(elementAssistPattern("fire")).toBe("triangles");
    expect(elementAssistPattern("water")).toBe("diamonds");
    expect(elementAssistPattern("shock")).toBe("zigzag");
    expect(elementAssistPattern("nature")).toBe("dots");
    expect(elementAssistPattern("shadow")).toBe("squares");
    expect(elementAssistPattern("physical")).toBe("bars");
  });
});
