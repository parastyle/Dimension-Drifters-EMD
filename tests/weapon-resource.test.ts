import {
  DRIVE_BEAM_GROSS_DRAIN_PER_SECOND,
  DRIVE_BEAM_IGNITION_COST,
  DRIVE_BEAM_NET_DRAIN_PER_SECOND,
  DRIVE_BEAM_RESTART_THRESHOLD,
  DRIVE_CAPACITY,
  DRIVE_COST_QUANTUM,
  DRIVE_FLOOR_REGEN_PER_SECOND,
  DRIVE_GUN_BURST_RETENTION,
  DRIVE_LOAD_MAX,
  DRIVE_THROWN_BURST_RETENTION,
  driveCostForProfile,
  FISTS_RESOURCE_PROFILE,
  WEAPON_RESOURCE_FROZEN_MEDIANS,
  WEAPON_RESOURCE_IDS,
  WEAPON_RESOURCE_OVERRIDES,
  WEAPON_RESOURCE_PROFILES,
} from "@dd/shared";
import { describe, expect, it } from "vitest";

describe("Drive formula v1", () => {
  it("covers the frozen 357-weapon catalog in deterministic id order", () => {
    expect(WEAPON_RESOURCE_IDS).toHaveLength(357);
    expect(WEAPON_RESOURCE_IDS).toEqual([...WEAPON_RESOURCE_IDS].sort());
    expect(Object.keys(WEAPON_RESOURCE_PROFILES)).toEqual(WEAPON_RESOURCE_IDS);

    const census = { melee: 0, thrown: 0, gun: 0, cast: 0, beam: 0, zone: 0 };
    for (const id of WEAPON_RESOURCE_IDS) {
      const profile = WEAPON_RESOURCE_PROFILES[id]!;
      census[profile.delivery]++;
      expect(Number.isFinite(profile.effectivePower)).toBe(true);
      expect(Number.isFinite(profile.load)).toBe(true);
      if (profile.branch === "tap") {
        expect(profile.neutralCost).toBeGreaterThan(0);
        expect(profile.neutralCost).toBeLessThanOrEqual(DRIVE_CAPACITY);
        expect(profile.neutralCost % DRIVE_COST_QUANTUM).toBe(0);
      }
    }
    expect(census).toEqual({ melee: 179, thrown: 27, gun: 121, cast: 3, beam: 23, zone: 4 });
  });

  it("pins every coefficient, frozen median, and the bounded utility overrides", () => {
    expect({
      capacity: DRIVE_CAPACITY,
      floor: DRIVE_FLOOR_REGEN_PER_SECOND,
      quantum: DRIVE_COST_QUANTUM,
      loadMax: DRIVE_LOAD_MAX,
      gunRetention: DRIVE_GUN_BURST_RETENTION,
      thrownRetention: DRIVE_THROWN_BURST_RETENTION,
    }).toEqual({
      capacity: 100,
      floor: 20,
      quantum: 0.25,
      loadMax: 2.5,
      gunRetention: 0.35,
      thrownRetention: 0.45,
    });
    expect(WEAPON_RESOURCE_FROZEN_MEDIANS).toEqual({
      "melee:melee": 21.4,
      "melee:thrown": 54.4768,
      "caster:thrown": 54.4768,
      "ranged:gun": 58.752,
      "caster:cast": 126.8185,
      "caster:melee": 51.072,
      "caster:gun": 61.0667,
      "ranged:beam": 31.0259,
      "ranged:zone": 20.9549,
      "caster:beam": 20.9549,
      "caster:zone": 20.9549,
    });
    expect(WEAPON_RESOURCE_OVERRIDES).toEqual({
      "gravediggers-spade": {
        multiplier: 1.15,
        reason: "A successful swing can revive; that utility has no damage statistic.",
      },
      "drift-katana-riftstep": {
        multiplier: 1.08,
        reason: "The finisher dash adds mobility that the damage-and-reach formula cannot value.",
      },
      "drift-greatkatana-tempest-regent": {
        multiplier: 1.1,
        reason: "Perfect continuations grant brief invulnerability outside the damage formula.",
      },
    });
    expect(WEAPON_RESOURCE_PROFILES["gravediggers-spade"]?.override).toBe(1.15);
  });

  it("goldens representative melee, thrown, gun, cast, and beam rows", () => {
    expect(FISTS_RESOURCE_PROFILE.neutralCost).toBe(7);
    expect({
      bowie: WEAPON_RESOURCE_PROFILES["twin-bowie-fangs"]?.neutralCost,
      tombstone: WEAPON_RESOURCE_PROFILES["tombstone-greatsword"]?.neutralCost,
      wyrmtooth: WEAPON_RESOURCE_PROFILES["x-sword-bone"]?.neutralCost,
      rustyThrown: WEAPON_RESOURCE_PROFILES["rusty-cleaver"]?.neutralCost,
      railspike: WEAPON_RESOURCE_PROFILES["x-sword-railspike"]?.neutralCost,
      gatling: WEAPON_RESOURCE_PROFILES["x-gun-gatling"]?.neutralCost,
      revolver: WEAPON_RESOURCE_PROFILES["x-gun-revolver-cannon"]?.neutralCost,
      coffin: WEAPON_RESOURCE_PROFILES["x-gun-coffin-shotgun"]?.neutralCost,
      mortar: WEAPON_RESOURCE_PROFILES["x-gun-hand-mortar"]?.neutralCost,
      stormRod: WEAPON_RESOURCE_PROFILES["x-staff-storm-rod"]?.neutralCost,
      arcaneLance: WEAPON_RESOURCE_PROFILES["x-staff-arcane-lance"]?.neutralCost,
    }).toEqual({
      bowie: 4,
      tombstone: 16,
      wyrmtooth: 33.5,
      rustyThrown: 15,
      railspike: 22.5,
      gatling: 1.5,
      revolver: 10,
      coffin: 17.5,
      mortar: 19,
      stormRod: 7,
      arcaneLance: 14.75,
    });

    const beam = WEAPON_RESOURCE_PROFILES["x2-mesa-spine-thunder-stave"]!;
    expect(beam).toMatchObject({
      branch: "beam",
      ignitionCost: DRIVE_BEAM_IGNITION_COST,
      grossDrainPerSecond: DRIVE_BEAM_GROSS_DRAIN_PER_SECOND,
      netDrainPerSecond: DRIVE_BEAM_NET_DRAIN_PER_SECOND,
      restartThreshold: DRIVE_BEAM_RESTART_THRESHOLD,
      holdToEmptySeconds: 1.25,
    });
  });

  it("goldens every Driftblade-line Drive profile", () => {
    expect({
      kagewake: WEAPON_RESOURCE_PROFILES["drift-wakizashi-kagewake"]?.neutralCost,
      hushglass: WEAPON_RESOURCE_PROFILES["drift-wakizashi-hushglass"]?.neutralCost,
      stillwater: WEAPON_RESOURCE_PROFILES["drift-katana-stillwater-edict"]?.neutralCost,
      stormthread: WEAPON_RESOURCE_PROFILES["drift-katana-stormthread"]?.neutralCost,
      riftstep: WEAPON_RESOURCE_PROFILES["drift-katana-riftstep"]?.neutralCost,
      paleHorizon: WEAPON_RESOURCE_PROFILES["drift-nodachi-pale-horizon"]?.neutralCost,
      gatebreaker: WEAPON_RESOURCE_PROFILES["drift-nodachi-gatebreaker"]?.neutralCost,
      moonwake: WEAPON_RESOURCE_PROFILES["drift-greatkatana-moonwake"]?.neutralCost,
      tempestRegent: WEAPON_RESOURCE_PROFILES["drift-greatkatana-tempest-regent"]?.neutralCost,
      worldSeam: WEAPON_RESOURCE_PROFILES["drift-colossal-world-seam"]?.neutralCost,
    }).toEqual({
      kagewake: 4,
      hushglass: 4,
      stillwater: 7.25,
      stormthread: 6,
      riftstep: 7.5,
      paleHorizon: 10,
      gatebreaker: 9,
      moonwake: 16,
      tempestRegent: 16.75,
      worldSeam: 22.5,
    });
  });

  it("pins the documented delivery distributions", () => {
    const bands = (delivery: "melee" | "thrown" | "gun" | "cast") => {
      const values = Object.values(WEAPON_RESOURCE_PROFILES)
        .filter((profile) => profile.delivery === delivery)
        .map((profile) => profile.neutralCost)
        .sort((a, b) => a - b);
      return {
        min: values[0],
        median: values[Math.floor(values.length / 2)],
        max: values.at(-1),
      };
    };
    expect(bands("melee")).toEqual({ min: 3, median: 14, max: 35 });
    expect(bands("thrown")).toEqual({ min: 11.25, median: 15, max: 22.5 });
    expect(bands("gun")).toEqual({ min: 1.25, median: 12, max: 50.75 });
    expect(bands("cast")).toEqual({ min: 7, median: 14.75, max: 18 });
  });

  it("guarantees fists and every load-1 melee can sustain the 20/s floor", () => {
    const baseline = [FISTS_RESOURCE_PROFILE, ...Object.values(WEAPON_RESOURCE_PROFILES)].filter(
      (profile) =>
        profile.delivery === "melee" && Math.abs(profile.load - 1) < 1e-9 && profile.override === 1,
    );
    expect(baseline.length).toBeGreaterThan(0);
    for (const profile of baseline) {
      const cost = driveCostForProfile(profile, profile.neutralAcceptedInterval);
      expect(cost / profile.neutralAcceptedInterval).toBeLessThanOrEqual(
        DRIVE_FLOOR_REGEN_PER_SECOND,
      );
      expect(cost / DRIVE_FLOOR_REGEN_PER_SECOND).toBeLessThanOrEqual(
        profile.neutralAcceptedInterval,
      );
    }
    // The revive-capable Spade remains an audited utility exception, not a naked baseline row.
    expect(WEAPON_RESOURCE_PROFILES["gravediggers-spade"]?.override).toBe(1.15);
  });
});

describe("W-ZONE continuous Drive hooks", () => {
  it("prices both held ground zones through the fixed ignition/drain channel", () => {
    for (const id of ["x2-gravewax-seance-globe", "x2-snakeoil-tincture-scepter"]) {
      const profile = WEAPON_RESOURCE_PROFILES[id];
      expect(profile?.delivery).toBe("zone");
      expect(profile?.branch).toBe("zone");
      expect(profile?.neutralCost).toBe(0);
      expect(profile?.ignitionCost).toBe(DRIVE_BEAM_IGNITION_COST);
      expect(profile?.grossDrainPerSecond).toBe(DRIVE_BEAM_GROSS_DRAIN_PER_SECOND);
      expect(profile?.netDrainPerSecond).toBe(DRIVE_BEAM_NET_DRAIN_PER_SECOND);
      expect(profile?.restartThreshold).toBe(DRIVE_BEAM_RESTART_THRESHOLD);
    }
  });
});
