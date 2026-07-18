import { DUAL_MELEE_PAIR_BAR, WEAPONS } from "@dd/shared";
import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({ default: {} }));

import { poseSupportHandFor, weaponPoseFamilyFor } from "../sprites/pose-language.js";
import { routeSwingChannels, samplePairCeremony } from "./SpriteRig.js";

describe("dual-wield rig presentation", () => {
  it("routes an off beat onto only the rear weapon and hand channels", () => {
    const routed = routeSwingChannels(
      {
        weaponAngle: 1.2,
        backWeaponAngle: Number.NaN,
        swingOffX: 18,
        swingOffY: -7,
        swingBackOffX: 0,
        swingBackOffY: 0,
        ownFront: 0.85,
        ownBack: 0.1,
      },
      1,
      -0.2,
      0.32,
    );

    expect(routed.backWeaponAngle).toBeCloseTo(0.88, 8);
    expect(routed).toMatchObject({
      weaponAngle: -0.2,
      swingOffX: 0,
      swingOffY: 0,
      swingBackOffX: 18,
      swingBackOffY: -7,
      ownFront: 0,
      ownBack: 0.85,
    });
  });

  it("leaves lead and Crossfall samples on their authored channels", () => {
    const sample = {
      weaponAngle: 0.4,
      backWeaponAngle: -0.4,
      swingOffX: 4,
      swingOffY: 5,
      swingBackOffX: -4,
      swingBackOffY: -5,
      ownFront: 1,
      ownBack: 1,
    };

    expect(routeSwingChannels(sample, 0, 0, 0.32)).toBe(sample);
    expect(routeSwingChannels(sample, "both", 0, 0.32)).toBe(sample);
  });

  it("samples the accepted bind as a 460ms sequential paper flip and held X", () => {
    const leadFlip = samplePairCeremony(140);
    const crossed = samplePairCeremony(250);
    const release = samplePairCeremony(410);

    expect(leadFlip.active).toBe(true);
    expect(Math.abs(leadFlip.leadScaleX)).toBeLessThan(0.1);
    expect(leadFlip.offScaleX).toBeGreaterThan(0);
    expect(crossed.crossBlend).toBe(1);
    expect(crossed.leadScaleX).toBe(-1);
    expect(crossed.offScaleX).toBe(-1);
    expect(crossed.glintAlpha).toBeGreaterThan(0.9);
    expect(release.crossBlend).toBeCloseTo(0.5, 5);
    expect(release.ruffle).toBeCloseTo(1, 5);
    expect(samplePairCeremony(460).active).toBe(false);
  });
});

// POSE IMPLEMENTATION WAVE — append-only per-hand family jobs under accepted dual parity.
describe("dual-wield pose-language roles", () => {
  it("passes the guard/counterweight job to the non-striking hand on every alternating beat", () => {
    const firstFour = DUAL_MELEE_PAIR_BAR.slice(0, 4);
    expect(firstFour).toEqual(["lead", "off", "lead", "off"]);
    expect(
      firstFour.map((hand) =>
        poseSupportHandFor(hand === "off" ? 1 : 0, true, false, false, false),
      ),
    ).toEqual([1, 0, 1, 0]);
  });

  it("resolves a mixed pair from each hand's concrete weapon family", () => {
    const blade = WEAPONS["rattler-sabre"];
    const blunt = WEAPONS["x2-brimstone-doubleheader"];
    if (!blade || !blunt) throw new Error("missing mixed pose fixtures");
    expect(weaponPoseFamilyFor(blade)).toBe("one-hand-blade");
    expect(weaponPoseFamilyFor(blunt)).toBe("one-hand-blunt");
  });

  it("gives Crossfall both hands to the authored attack channels", () => {
    expect(poseSupportHandFor(0, true, false, true, false)).toBe(-1);
    expect(poseSupportHandFor(1, true, false, true, false)).toBe(-1);
  });
});
