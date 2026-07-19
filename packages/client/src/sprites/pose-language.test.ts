import { WEAPONS, type WeaponDef } from "@dd/shared";
import { describe, expect, it } from "vitest";
import {
  aimRelativePoint,
  createPoseLanguageInput,
  createPoseLanguageSample,
  DEFAULT_POSE_VARIANTS,
  nextPoseShowroomOption,
  type PoseActionPhase,
  type PoseLanguageInput,
  type PoseLanguageSample,
  type PoseVariantSelection,
  poseBlendUnderOwnership,
  poseImpulsePending,
  poseShowroomVariantSetFor,
  samplePoseLanguage,
  twoHandedPoseFor,
  WEAPON_POSE_SPECS,
  type WeaponPoseFamily,
  weaponPoseFamilyFor,
  weaponPoseResolutionFor,
  weaponPoseSpecFor,
} from "./pose-language.js";

function weapon(id: string): WeaponDef {
  const def = WEAPONS[id];
  if (!def) throw new Error(`Missing pose-language fixture weapon: ${id}`);
  return def;
}

function variants(overrides: Partial<PoseVariantSelection> = {}): PoseVariantSelection {
  return { ...DEFAULT_POSE_VARIANTS, ...overrides };
}

function sample(
  family: WeaponPoseFamily,
  overrides: Partial<PoseLanguageInput> = {},
  out: PoseLanguageSample = createPoseLanguageSample(),
): PoseLanguageSample {
  const input = createPoseLanguageInput();
  Object.assign(input, {
    spec: WEAPON_POSE_SPECS[family],
    timeS: 0.37,
    freeHand: 1,
    ...overrides,
  });
  return samplePoseLanguage(input, out);
}

describe("weapon pose-language classifier", () => {
  it("gives every current weapon id an intentional named pose without an accidental fallback", () => {
    for (const def of Object.values(WEAPONS)) {
      const resolution = weaponPoseResolutionFor(def);
      expect(resolution.family, def.id).toBeTypeOf("string");
      expect(WEAPON_POSE_SPECS[resolution.family], def.id).toBeDefined();
      expect(resolution.usedFallback, `${def.id}:${def.tags.family}`).toBe(false);
    }
  });

  it("lets delivery and worn truth beat misleading painted families", () => {
    expect(weaponPoseFamilyFor(weapon("x-sword-railspike"))).toBe("thrown");
    expect(weaponPoseFamilyFor(weapon("x2-hellmouth-palmcaster"))).toBe("fist-gun");
    expect(weaponPoseFamilyFor(weapon("x2-null-grimoire-of-the-hollow-page"))).toBe("tome");
    expect(weaponPoseFamilyFor(weapon("x2-dustdevil-glaive"))).toBe("polearm");
    expect(weaponPoseFamilyFor(weapon("x2-sparkknuckle-hex-mitt"))).toBe("fists");
    expect(weaponPoseFamilyFor(weapon("x2-wyrmscale-hex-talon"))).toBe("close-blade");
  });

  it("keeps beam and dual as overlays over the same base family", () => {
    const beamPistol = weapon("x2-voltcaster-machine-pistol");
    const withoutBeam = { ...beamPistol, beam: undefined };
    expect(weaponPoseFamilyFor(beamPistol)).toBe(weaponPoseFamilyFor(withoutBeam));

    const dualBlade = weapon("x2-coyote-s-grin");
    const withoutDual = {
      ...dualBlade,
      dual: false,
      tags: { ...dualBlade.tags, grip: "1H" as const },
    };
    expect(weaponPoseFamilyFor(dualBlade)).toBe(weaponPoseFamilyFor(withoutDual));
  });

  it("switches disputed 2H geometry between metadata and current-art truth", () => {
    const shotgun = weapon("x-gun-coffin-shotgun");
    expect(shotgun.tags.grip).toBe("2H");
    expect(shotgun.twoHanded).not.toBe(true);
    expect(twoHandedPoseFor(shotgun, "metadata")).toBe(true);
    expect(twoHandedPoseFor(shotgun, "art")).toBe(false);
    expect(
      weaponPoseResolutionFor(shotgun, variants({ twoHandAuthority: "metadata" })).hardTwoHanded,
    ).toBe(true);
    expect(
      weaponPoseResolutionFor(shotgun, variants({ twoHandAuthority: "art" })).hardTwoHanded,
    ).toBe(false);
  });
});

describe("weapon pose descriptor table", () => {
  it("keeps every authored number finite and inside the paper rig's normalized bounds", () => {
    for (const spec of Object.values(WEAPON_POSE_SPECS)) {
      const anchors = [
        spec.idle,
        spec.moveTighten,
        spec.anticipation,
        spec.active,
        spec.recovery,
        spec.frontFoot,
        spec.backFoot,
      ];
      for (const anchor of anchors) {
        expect(Number.isFinite(anchor.forward + anchor.lateral), spec.family).toBe(true);
        expect(Math.abs(anchor.forward), spec.family).toBeLessThanOrEqual(0.22);
        expect(Math.abs(anchor.lateral), spec.family).toBeLessThanOrEqual(0.22);
      }
      expect(spec.offHandBlend).toBeGreaterThanOrEqual(0);
      expect(spec.offHandBlend).toBeLessThanOrEqual(1);
      expect(spec.microForward).toBeLessThanOrEqual(0.025);
      expect(spec.microLateral).toBeLessThanOrEqual(0.025);
      expect(Math.abs(spec.bodyForward)).toBeLessThanOrEqual(0.08);
      expect(Math.abs(spec.bodyLateral)).toBeLessThanOrEqual(0.08);
      expect(spec.gripSpacing).toBeGreaterThanOrEqual(0.18);
      expect(spec.gripSpacing).toBeLessThanOrEqual(0.55);
    }
  });

  it("returns frozen descriptor references and swaps only the contested variant specs", () => {
    const pistol = weapon("x-gun-ricochet-pistol");
    const saber = weapon("rattler-sabre");
    expect(weaponPoseSpecFor(pistol)).toBe(WEAPON_POSE_SPECS.pistol);
    expect(weaponPoseSpecFor(saber)).toBe(WEAPON_POSE_SPECS["one-hand-blade"]);
    expect(weaponPoseSpecFor(pistol, variants({ pistol: "firing-clasp" }))).not.toBe(
      WEAPON_POSE_SPECS.pistol,
    );
    expect(weaponPoseSpecFor(saber, variants({ oneHandBlade: "chest-guard" }))).not.toBe(
      WEAPON_POSE_SPECS["one-hand-blade"],
    );
  });

  it("refines rapier travel and long-gun weight without inventing new base families", () => {
    const rapier = weaponPoseSpecFor(weapon("x2-hexbloom-rapier"));
    const saber = weaponPoseSpecFor(weapon("rattler-sabre"));
    const scatter = weaponPoseSpecFor(weapon("x-gun-coffin-shotgun"));
    const rapid = weaponPoseSpecFor(weapon("x-gun-nailgun"));
    expect(rapier.family).toBe("one-hand-blade");
    expect(Math.abs(rapier.idle.lateral)).toBeLessThan(Math.abs(saber.idle.lateral));
    expect(scatter.family).toBe("long-gun");
    expect(rapid.family).toBe("long-gun");
    expect(Math.abs(scatter.backFoot.forward)).toBeGreaterThan(Math.abs(rapid.backFoot.forward));
    expect(scatter.microForward).toBeLessThan(rapid.microForward);
  });

  it("exposes the panel defaults and both A/B candidates to the showroom", () => {
    const pistolSet = poseShowroomVariantSetFor(weapon("x-gun-ricochet-pistol"));
    const bladeSet = poseShowroomVariantSetFor(weapon("rattler-sabre"));
    const authoritySet = poseShowroomVariantSetFor(weapon("x-gun-coffin-shotgun"));
    expect(pistolSet?.defaultValue).toBe("sternum-guard");
    expect(pistolSet?.options.map((option) => option.value)).toEqual([
      "sternum-guard",
      "firing-clasp",
    ]);
    expect(bladeSet?.defaultValue).toBe("duelist-wing");
    expect(bladeSet?.options.map((option) => option.value)).toEqual([
      "duelist-wing",
      "chest-guard",
    ]);
    expect(authoritySet?.defaultValue).toBe("art");
    expect(authoritySet?.options.map((option) => option.value)).toEqual(["metadata", "art"]);
    if (!pistolSet || !bladeSet || !authoritySet) throw new Error("missing showroom sets");
    expect(nextPoseShowroomOption(pistolSet, undefined)?.value).toBe("sternum-guard");
    expect(nextPoseShowroomOption(pistolSet, "sternum-guard")?.value).toBe("firing-clasp");
    expect(nextPoseShowroomOption(pistolSet, "firing-clasp")?.value).toBe("sternum-guard");
    expect(nextPoseShowroomOption(bladeSet, undefined)?.value).toBe("duelist-wing");
    expect(nextPoseShowroomOption(authoritySet, undefined)?.value).toBe("art");
    expect(nextPoseShowroomOption(authoritySet, "art")?.value).toBe("metadata");
  });
});

describe("pose-language sampler and transition law", () => {
  it("reuses the caller's output and clamps every blend", () => {
    const out = createPoseLanguageSample();
    const returned = sample("one-hand-blunt", { gait: 5, moveAmount: -3, phaseT: 4 }, out);
    expect(returned).toBe(out);
    expect(out.offBlend).toBeGreaterThanOrEqual(0);
    expect(out.offBlend).toBeLessThanOrEqual(1);
    expect(out.offOwn).toBeGreaterThanOrEqual(0);
    expect(out.offOwn).toBeLessThanOrEqual(1);
    expect(out.footBlend).toBeGreaterThanOrEqual(0);
    expect(out.footBlend).toBeLessThanOrEqual(1);
  });

  it("preserves the family job while movement tightens without crossing center", () => {
    for (const family of Object.keys(WEAPON_POSE_SPECS) as WeaponPoseFamily[]) {
      const idle = sample(family, { moveAmount: 0, gait: 0 });
      const moving = sample(family, { moveAmount: 1, gait: 1 });
      if (WEAPON_POSE_SPECS[family].offHandVerb === "hard-grip") continue;
      expect(Math.sign(moving.offLateral), family).toBe(Math.sign(idle.offLateral));
      expect(Math.abs(moving.offLateral), family).toBeLessThanOrEqual(
        Math.abs(idle.offLateral) + 0.01,
      );
    }
  });

  it("retracts action placement before recovery releases exact ownership", () => {
    for (const family of Object.keys(WEAPON_POSE_SPECS) as WeaponPoseFamily[]) {
      const verb = WEAPON_POSE_SPECS[family].offHandVerb;
      if (verb === "hard-grip" || family === "close-blade") continue;
      const active = sample(family, { phase: "active", phaseT: 1 });
      const earlyRecovery = sample(family, { phase: "recovery", phaseT: 0.25 });
      const recovered = sample(family, { phase: "recovery", phaseT: 1 });
      const idle = sample(family, { phase: "idle", phaseT: 0 });
      expect(earlyRecovery.offOwn, family).toBeLessThanOrEqual(active.offOwn);
      expect(recovered.offOwn, family).toBe(0);
      expect(recovered.offForward, family).toBeCloseTo(idle.offForward, 10);
      expect(recovered.offLateral, family).toBeCloseTo(idle.offLateral, 10);
    }
  });

  it.each([
    "idle",
    "anticipation",
    "active",
    "recovery",
  ] as PoseActionPhase[])("keeps static hand, body, and feet under reduced motion during %s", (phase) => {
    const animated = sample("focus", { phase, phaseT: 0.45, reducedMotion: false });
    const reduced = sample("focus", { phase, phaseT: 0.45, reducedMotion: true });
    expect(reduced.offBlend).toBe(animated.offBlend);
    expect(reduced.offOwn).toBe(animated.offOwn);
    expect(reduced.bodyForward).toBe(animated.bodyForward);
    expect(reduced.bodyLateral).toBe(animated.bodyLateral);
    expect(reduced.bodyTurn).toBe(animated.bodyTurn);
    expect(reduced.frontFootForward).toBe(animated.frontFootForward);
    expect(reduced.backFootLateral).toBe(animated.backFootLateral);
    expect(
      Math.hypot(
        animated.offForward - reduced.offForward,
        animated.offLateral - reduced.offLateral,
      ),
    ).toBeGreaterThan(0);
  });

  it("keeps authored forward/lateral meaning determinant-safe across mirrored aims", () => {
    const right = aimRelativePoint(0.12, -0.08, 0, { x: 0, y: 0 });
    const left = aimRelativePoint(0.12, -0.08, Math.PI, { x: 0, y: 0 });
    expect(left.x).toBeCloseTo(-right.x, 10);
    expect(left.y).toBeCloseTo(-right.y, 10);
    expect(Math.hypot(left.x, left.y)).toBeCloseTo(Math.hypot(right.x, right.y), 10);
  });

  it("suppresses generic targets under hard owners and consumes recoil only at a new edge", () => {
    expect(poseBlendUnderOwnership(0.9, 0)).toBe(0.9);
    expect(poseBlendUnderOwnership(0.9, 1)).toBe(0);
    expect(poseBlendUnderOwnership(0.9, 0, true)).toBe(0);
    expect(poseImpulsePending(1_000, 1_000, -1e9)).toBe(true);
    expect(poseImpulsePending(1_001, 1_000, 1_000)).toBe(false);
  });
});

// FLOURISH IMPLEMENTATION WAVE — append-only live-catalog and forward-compatible size truth.
describe("flourish live-catalog coverage", () => {
  it("resolves every current weapon to the same frozen family grammar as pose language", async () => {
    const { weaponFlourishSpecFor } = await import("./pose-language.js");
    for (const def of Object.values(WEAPONS)) {
      const family = weaponPoseFamilyFor(def);
      const spec = weaponFlourishSpecFor(def);
      expect(spec.family, def.id).toBe(family);
      expect(Object.isFrozen(spec), def.id).toBe(true);
      expect(Object.isFrozen(spec.draw), `${def.id}:draw`).toBe(true);
      expect(Object.isFrozen(spec.draw.timing), `${def.id}:timing`).toBe(true);
    }
  });

  it("accepts the parallel sizeClass emission and keeps Driftblade great", async () => {
    const { bladeSizeClassFor } = await import("./pose-language.js");
    const staged = Object.values(WEAPONS).filter(
      (def) => (def as WeaponDef & { sizeClass?: string }).sizeClass !== undefined,
    );
    expect(staged.length).toBeGreaterThanOrEqual(10);
    for (const def of staged) {
      expect(["short", "standard", "long", "great", "colossal"]).toContain(bladeSizeClassFor(def));
    }
    expect(bladeSizeClassFor(weapon("driftblade"))).toBe("great");
  });
});
