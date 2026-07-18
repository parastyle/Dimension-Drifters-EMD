import { describe, expect, it } from "vitest";
import { driveCostView, driveHudView } from "./drive-hud.js";

describe("Drive HUD model", () => {
  it("turns the retired per-weapon ammo clocks into one debit preview and recovery read", () => {
    const view = driveHudView({
      valueQ: 7_525,
      regenMode: 2,
      beamLockEndTick: 0,
      tick: 100,
      weaponId: "rusty-cleaver",
    });
    expect(view.value).toBe(75.25);
    expect(view.fraction).toBe(0.7525);
    expect(view.chevrons).toBe(2);
    expect(view.cost.pipText).toHaveLength(5);
    expect(view.debitFraction).toBeGreaterThan(0);
  });

  it("uses the beam's 25 + 80/s card debit and exposes empty as LOCKED · RELEASE", () => {
    const beam = driveCostView("x2-voltcaster-machine-pistol");
    expect(beam.copy).toBe("25 + 80/s");
    const view = driveHudView({
      valueQ: 0,
      regenMode: 1,
      beamLockEndTick: 130,
      tick: 100,
      weaponId: "x2-voltcaster-machine-pistol",
    });
    expect(view).toMatchObject({ locked: true, affordable: false, overlay: "LOCKED · RELEASE" });
  });

  it("never overstates the floored authoritative mirror", () => {
    const view = driveHudView({
      valueQ: 24,
      regenMode: 0,
      beamLockEndTick: 0,
      tick: 1,
      weaponId: "rusty-cleaver",
    });
    expect(view.value).toBe(0.24);
    expect(view.affordable).toBe(false);
    expect(view.overlay).toBe("EMPTY · WAIT");
  });
});
