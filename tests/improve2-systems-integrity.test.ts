import {
  AUGMENTS,
  augmentGateForWeapon,
  BeamPowerCycle,
  beamCyclePower,
  draftAugments,
  effectivePower,
  WEAPONS,
} from "@dd/shared";
import { describe, expect, it } from "vitest";

describe("improve2 shared systems integrity", () => {
  it("G-04 evaluates every authored beam through both early-vent and full-overheat cycles", () => {
    const beams = Object.values(WEAPONS).filter((weapon) => !!weapon?.beam);
    expect(beams.length).toBe(24);
    for (const beam of beams) {
      const early = beamCyclePower(beam!, BeamPowerCycle.EarlyVent);
      const full = beamCyclePower(beam!, BeamPowerCycle.FullOverheat);
      expect(Number.isFinite(early) && early > 0).toBe(true);
      expect(Number.isFinite(full) && full > 0).toBe(true);
      expect(effectivePower(beam!)).toBeCloseTo(Math.max(early, full), 10);
    }
    const sample = beams[0]!;
    const sluggish = {
      ...sample,
      beam: { ...sample.beam!, sweepLagSeconds: sample.beam!.sweepLagSeconds * 4 },
    };
    expect(effectivePower(sluggish)).toBeLessThan(effectivePower(sample));
  });

  it("G-09 derives beam augment lanes from class plus delivery without a level gate", () => {
    const casterBeam = Object.values(WEAPONS).find(
      (weapon) => weapon?.beam && weapon.tags.classPool === "caster",
    );
    const rangedBeam = Object.values(WEAPONS).find(
      (weapon) => weapon?.beam && weapon.tags.classPool === "ranged",
    );
    if (!casterBeam || !rangedBeam) throw new Error("expected caster and ranged beam fixtures");
    expect(augmentGateForWeapon(casterBeam)).toBe("cast+beam");
    expect(augmentGateForWeapon(rangedBeam)).toBe("beam");

    const casterDraft = draftAugments(() => 0.999999, ["cast", "beam"]);
    expect(casterDraft.some((id) => AUGMENTS[id]?.weapon === "beam")).toBe(true);
    expect(casterDraft.every((id) => AUGMENTS[id]?.weapon !== "gun")).toBe(true);
    const rangedDraft = draftAugments(() => 0.999999, ["beam"]);
    expect(rangedDraft.some((id) => AUGMENTS[id]?.weapon === "beam")).toBe(true);
    expect(rangedDraft.every((id) => AUGMENTS[id]?.weapon !== "gun" && AUGMENTS[id]?.weapon !== "cast"))
      .toBe(true);

  });
});
