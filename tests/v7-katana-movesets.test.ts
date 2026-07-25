import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { MELEE_COMBO_SEQUENCES, meleeComboSelectionFor, meleeReach, WEAPONS } from "@dd/shared";
import { describe, expect, it } from "vitest";

const ACTIVE_KATANAS = [
  "x-sword-neon-katana",
  "x2-hailwidow-katana",
  "x2-gravechill-nodachi",
  "x2-voltfang-tachi",
  "x2-cinderfang-wakizashi-pair",
  "x2-stormpetal-odachi",
  "drift-katana-stillwater-edict",
  "drift-katana-stormthread",
  "drift-katana-riftstep",
  "drift-nodachi-pale-horizon",
  "drift-nodachi-gatebreaker",
  "drift-greatkatana-moonwake",
  "drift-greatkatana-tempest-regent",
  "drift-colossal-world-seam",
] as const;

const EXPECTED_BARS = {
  "x-sword-neon-katana": ["lunge", "knee-stab", "lunge"],
  "x2-hailwidow-katana": ["side-cut", "knee-stab", "rising-cut"],
  "x2-gravechill-nodachi": ["guard-pivot", "knee-stab", "side-cut"],
  "x2-voltfang-tachi": ["rising-cut", "wave-cut", "backflip"],
  "x2-cinderfang-wakizashi-pair": ["side-cut", "wave-cut", "spin-cut"],
  "x2-stormpetal-odachi": ["wave-cut", "guard-pivot", "backflip"],
  "drift-katana-stillwater-edict": [
    "guard-pivot",
    "side-cut",
    "guard-pivot",
    "knee-stab",
    "rising-cut",
    "lunge",
  ],
  "drift-katana-stormthread": [
    "wave-cut",
    "side-cut",
    "wave-cut",
    "guard-pivot",
    "knee-stab",
    "rising-cut",
    "spin-cut",
  ],
  "drift-katana-riftstep": ["knee-stab", "guard-pivot", "backflip", "lunge"],
  "drift-nodachi-pale-horizon": ["side-cut", "wave-cut", "side-cut", "rising-cut", "lunge"],
  "drift-nodachi-gatebreaker": [
    "knee-stab",
    "side-cut",
    "spin-cut",
    "knee-stab",
    "spin-cut",
    "rising-cut",
    "lunge",
  ],
  "drift-greatkatana-moonwake": [
    "wave-cut",
    "side-cut",
    "backflip",
    "rising-cut",
    "spin-cut",
    "lunge",
  ],
  "drift-greatkatana-tempest-regent": [
    "side-cut",
    "wave-cut",
    "guard-pivot",
    "backflip",
    "spin-cut",
  ],
  "drift-colossal-world-seam": ["knee-stab", "rising-cut", "guard-pivot", "side-cut"],
} as const;

interface BaselineCapture {
  id: string;
  expectedSteps: number;
  definition: {
    displayLength: number;
    dps: unknown;
    rest: {
      stance: string | null;
      sizeClass: string | null;
      grip: string;
      size: string;
      twoHanded: boolean;
      dual: boolean;
      gripPoints: unknown;
      performanceHold: string | null;
    };
  };
}

const baseline = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL(
        "../docs/owner-notes-audit-v7-evidence/katana-movesets/before/catalog-live-capture.json",
        import.meta.url,
      ),
    ),
    "utf8",
  ),
) as { weaponIds: string[]; captures: BaselineCapture[] };

function weapon(id: (typeof ACTIVE_KATANAS)[number]) {
  const definition = WEAPONS[id];
  if (!definition) throw new Error(`missing active katana ${id}`);
  return definition;
}

function sequence(id: (typeof ACTIVE_KATANAS)[number]) {
  const selected = meleeComboSelectionFor(weapon(id));
  if (!selected) throw new Error(`missing combo selection for ${id}`);
  return selected.sequence;
}

describe("V7 bespoke katana move catalog", () => {
  it("pins the exact 14-ID census and a unique complete choreography sentence per weapon", () => {
    expect(baseline.weaponIds).toEqual(ACTIVE_KATANAS);
    const signatures = new Set<string>();
    for (const id of ACTIVE_KATANAS) {
      const primitives = sequence(id).map((step) => step.choreography?.primitive);
      expect(primitives, id).toEqual(EXPECTED_BARS[id]);
      expect(sequence(id).every((step) => step.choreography)).toBe(true);
      signatures.add(JSON.stringify(primitives));
    }
    expect(signatures).toHaveLength(ACTIVE_KATANAS.length);
  });

  it("preserves every pre-order beat count and every damage/cadence/hook contract", () => {
    for (const capture of baseline.captures) {
      const id = capture.id as (typeof ACTIVE_KATANAS)[number];
      const definition = weapon(id);
      expect(sequence(id), `${id} beat count`).toHaveLength(capture.expectedSteps);
      const dpsContract = {
        damage: definition.damage,
        cooldown: definition.cooldown,
        fireRate: definition.gun?.fireRate ?? null,
        castCooldown: definition.cast?.cooldown ?? null,
        katanaHook: definition.katanaHook ?? null,
      };
      if (id === "drift-katana-riftstep") {
        expect(dpsContract, `${id} no-drift reach contract`).toMatchObject({
          damage: 6.5,
          cooldown: 0.35,
          fireRate: null,
          castCooldown: null,
          katanaHook: {
            kind: "finisher-reach",
            finisherDamageMultiplier: 1.14,
          },
        });
        expect(dpsContract.katanaHook).not.toHaveProperty("finisherDashImpulse");
      } else {
        expect(dpsContract, `${id} DPS contract`).toEqual(capture.definition.dps);
      }
    }
  });

  it("keeps rest-source bytes unchanged apart from the explicit Hailwidow and Voltedge overrides", () => {
    for (const capture of baseline.captures) {
      const id = capture.id as (typeof ACTIVE_KATANAS)[number];
      const definition = weapon(id);
      if (id === "x-sword-neon-katana") {
        expect(definition.stance).toBe("near-ear-blade-up");
        continue;
      }
      expect(
        {
          stance: definition.stance ?? null,
          sizeClass: definition.sizeClass ?? null,
          grip: definition.tags.grip,
          size: definition.tags.size,
          twoHanded: definition.twoHanded === true,
          dual: definition.dual === true,
          gripPoints: definition.gripPoints ?? null,
          performanceHold: definition.performance?.hold ?? null,
        },
        `${id} rest-source contract`,
      ).toEqual({
        stance: capture.definition.rest.stance,
        sizeClass: capture.definition.rest.sizeClass,
        grip: capture.definition.rest.grip,
        size: capture.definition.rest.size,
        twoHanded: capture.definition.rest.twoHanded,
        dual: capture.definition.rest.dual,
        gripPoints: capture.definition.rest.gripPoints,
        performanceHold: capture.definition.rest.performanceHold,
      });
      if (id !== "x2-hailwidow-katana")
        expect(definition.displayLength, `${id} display length`).toBe(
          capture.definition.displayLength,
        );
    }
  });

  it("applies Hailwidow's exact one-time 1.5x size while leaving DPS and stance identity intact", () => {
    const capture = baseline.captures.find(({ id }) => id === "x2-hailwidow-katana");
    if (!capture) throw new Error("missing Hailwidow baseline");
    const hailwidow = weapon("x2-hailwidow-katana");
    expect(capture.definition.displayLength).toBe(128);
    expect(hailwidow.displayLength).toBe(capture.definition.displayLength * 1.5);
    expect(meleeReach({ ...hailwidow, displayLength: capture.definition.displayLength })).toBe(140);
    expect(meleeReach(hailwidow)).toBeCloseTo(193.68, 10);
    expect(hailwidow.stance).toBe("tachi-no-tori");
  });

  it("moves Voltedge to authoritative stab capsules while retaining Cinderfang's arc mechanics", () => {
    const arc = MELEE_COMBO_SEQUENCES.arc;
    const voltedge = weapon("x-sword-neon-katana");
    const voltedgeSelection = meleeComboSelectionFor(voltedge);
    expect(voltedge.authoritativeCombo).toBe(true);
    expect(voltedgeSelection?.variant).toBe("voltedge-stab");
    expect(voltedgeSelection?.sequence).toHaveLength(3);
    expect(
      voltedgeSelection?.sequence.every(
        (step) =>
          step.path.kind === "capsule" &&
          step.path.arcMultiplier === 0 &&
          step.path.damageMultiplier === 1,
      ),
    ).toBe(true);
    expect(meleeComboSelectionFor(weapon("x2-cinderfang-wakizashi-pair"))?.variant).toBe("default");
    const bar = sequence("x2-cinderfang-wakizashi-pair");
    for (let index = 0; index < arc.length; index++) {
      const base = arc[index];
      const step = bar[index];
      expect(step?.motion, `Cinderfang/${index} motion`).toBe(base?.motion);
      expect(step?.direction, `Cinderfang/${index} direction`).toBe(base?.direction);
      expect(step?.path, `Cinderfang/${index} path`).toEqual(base?.path);
      expect(step?.timing, `Cinderfang/${index} timing`).toEqual(base?.timing);
    }
  });

  it("does not fund unreachable choreography for the two archived wakizashi entries", () => {
    for (const id of ["drift-wakizashi-kagewake", "drift-wakizashi-hushglass"] as const) {
      const definition = WEAPONS[id];
      expect(definition?.archived, id).toBe(true);
      if (!definition) throw new Error(`missing archived katana ${id}`);
      expect(
        meleeComboSelectionFor(definition)?.sequence.every((step) => !step.choreography),
        id,
      ).toBe(true);
    }
  });
});
