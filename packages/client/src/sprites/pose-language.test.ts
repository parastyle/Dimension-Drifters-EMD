import { swingDescriptorFor, WEAPONS, type WeaponDef } from "@dd/shared";
import { describe, expect, it } from "vitest";
import {
  aimRelativePoint,
  classifyHandRole,
  createPoseLanguageInput,
  createPoseLanguageSample,
  createWeaponPerformanceInput,
  createWeaponPerformanceSample,
  DEFAULT_POSE_VARIANTS,
  FACING_SIDE_FLOOR_BODY_FRAC,
  IDLE_FOOT_POSE_SPECS,
  IDLE_HAND_POSE_SPECS,
  idleFootPoseFor,
  idleHandPoseFor,
  idleHandPoseResolutionFor,
  martialIdleHandAngleFor,
  NAMED_WEAPON_STANCES,
  nextPoseShowroomOption,
  type PoseActionPhase,
  type PoseLanguageInput,
  type PoseLanguageSample,
  type PoseVariantSelection,
  poseBlendUnderOwnership,
  poseImpulsePending,
  poseShowroomVariantSetFor,
  resolveFootPoseOffset,
  resolveIdleHandTarget,
  resolveWeaponFootPoseOffset,
  samplePoseLanguage,
  sampleWeaponPerformance,
  twoHandedPoseFor,
  WEAPON_POSE_SPECS,
  type WeaponPoseFamily,
  weaponPerformanceSpecFor,
  weaponPoseFamilyFor,
  weaponPoseResolutionFor,
  weaponPoseSpecFor,
} from "./pose-language.js";

function weapon(id: string): WeaponDef {
  const def = WEAPONS[id];
  if (!def) throw new Error(`Missing pose-language fixture weapon: ${id}`);
  return def;
}

function performance(id: string): NonNullable<WeaponDef["performance"]> {
  const spec = weapon(id).performance;
  if (!spec) throw new Error(`Missing weapon-performance fixture: ${id}`);
  return spec;
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
    const beamGun = weapon("x2-stormcaller-tesla-gatling");
    const withoutBeam = { ...beamGun, beam: undefined };
    expect(weaponPoseFamilyFor(beamGun)).toBe(weaponPoseFamilyFor(withoutBeam));

    const dualBlade = weapon("x2-coyote-s-grin");
    const withoutDual = {
      ...dualBlade,
      dual: false,
      tags: { ...dualBlade.tags, grip: "1H" as const },
    };
    expect(weaponPoseFamilyFor(dualBlade)).toBe(weaponPoseFamilyFor(withoutDual));
  });

  it("makes physical 2H ranged grip metadata authoritative under either art policy", () => {
    const shotgun = weapon("x-gun-coffin-shotgun");
    expect(shotgun.tags.grip).toBe("2H");
    expect(shotgun.twoHanded).not.toBe(true);
    expect(twoHandedPoseFor(shotgun, "metadata")).toBe(true);
    expect(twoHandedPoseFor(shotgun, "art")).toBe(true);
    expect(
      weaponPoseResolutionFor(shotgun, variants({ twoHandAuthority: "metadata" })).hardTwoHanded,
    ).toBe(true);
    expect(
      weaponPoseResolutionFor(shotgun, variants({ twoHandAuthority: "art" })).hardTwoHanded,
    ).toBe(true);
  });
});

describe("B17 semantic hand-role and five-pose laws", () => {
  const idleFrame = {
    phase: "idle" as const,
    phaseT: 0,
  };

  it("classifies every visible catalog hand without an unowned fallback", () => {
    for (const def of Object.values(WEAPONS)) {
      const roles = ([0, 1] as const).map((hand) => classifyHandRole(def, idleFrame, hand));
      expect(roles, def.id).not.toContain("explicit-test-failure");
      expect(roles, def.id).not.toContain("absent-replaced");
    }
  });

  it("pins hard owners, explicit action owners, recovery, idle, and structural replacement", () => {
    const dual = weapon("x2-coyote-s-grin");
    const fists = weapon("x2-sparkknuckle-hex-mitt");
    const rifle = weapon("x2-hollowbarrel-spell-scattergun-staff");
    const caster = weapon("x2-saint-s-knucklebone-censer-orb");
    const thrown = weapon("x2-saloon-tomahawk");
    const blade = weapon("rattler-sabre");

    expect([0, 1].map((hand) => classifyHandRole(dual, idleFrame, hand as 0 | 1))).toEqual([
      "hard-constrained",
      "hard-constrained",
    ]);
    expect([0, 1].map((hand) => classifyHandRole(fists, idleFrame, hand as 0 | 1))).toEqual([
      "hard-constrained",
      "hard-constrained",
    ]);
    expect([0, 1].map((hand) => classifyHandRole(rifle, idleFrame, hand as 0 | 1))).toEqual([
      "hard-constrained",
      "hard-constrained",
    ]);
    expect(
      classifyHandRole(
        caster,
        { phase: "active", phaseT: 0.5, actionOwnedHands: [false, true] },
        1,
      ),
    ).toBe("action-owned");
    expect(classifyHandRole(thrown, { phase: "active", phaseT: 0.5 }, 0)).toBe("action-owned");
    expect(classifyHandRole(thrown, { phase: "recovery", phaseT: 0.5 }, 1)).toBe("recovering");
    expect(classifyHandRole(blade, idleFrame, 0)).toBe("hard-constrained");
    expect(classifyHandRole(blade, idleFrame, 1)).toBe("authored-idle");
    expect(classifyHandRole(blade, { phase: "recovery", phaseT: 0.5 }, 1)).toBe("recovering");
    expect(classifyHandRole(blade, { phase: "recovery", phaseT: 1 }, 1)).toBe("authored-idle");
    expect(classifyHandRole(blade, { ...idleFrame, visibleHands: [true, false] }, 1)).toBe(
      "absent-replaced",
    );
  });

  it("resolves every catalog row to the named vocabulary without the fail-safe", () => {
    const vocabulary = Object.keys(IDLE_HAND_POSE_SPECS);
    expect(vocabulary).toEqual([
      "secondary-grip",
      "mirror-guard",
      "boxer-guard",
      "low-guard",
      "casting-gesture",
      "hip-rest",
      "praying-mantis",
      "crane-guard",
    ]);
    for (const def of Object.values(WEAPONS)) {
      const resolution = idleHandPoseResolutionFor(def);
      expect(vocabulary, def.id).toContain(resolution.pose);
      expect(resolution.usedFallback, def.id).toBe(false);
    }
    expect(idleHandPoseFor(weapon("x2-saint-bough-frost-crozier"))).toBe("hip-rest");
    expect(idleHandPoseFor(weapon("x2-hellmouth-palmcaster"))).toBe("casting-gesture");
    expect(idleHandPoseFor(weapon("x-sword-neon-katana"))).toBe("mirror-guard");
  });

  it("holds recognizable praying-mantis hooks and a two-level crane guard", () => {
    const common = { bodyX: 0, bodyY: 0, bodyHeight: 76, aimLocal: 0 };
    const mantis = weapon("x2-wing-chun-wraps");
    const mantisLead = resolveIdleHandTarget(mantis, { ...common, hand: 0 }, { x: 0, y: 0 });
    const mantisOff = resolveIdleHandTarget(mantis, { ...common, hand: 1 }, { x: 0, y: 0 });
    expect(mantisLead.y).toBeLessThan(mantisOff.y - 10);
    expect(mantisLead.x).toBeGreaterThan(mantisOff.x + 10);
    expect(martialIdleHandAngleFor(mantis, 0)).toBeGreaterThan(0.9);
    expect(martialIdleHandAngleFor(mantis, 1)).toBeLessThan(-0.6);
    const ironMantis = weapon("x2-iron-palm-wraps");
    expect(idleHandPoseFor(ironMantis)).toBe("praying-mantis");
    expect(resolveIdleHandTarget(ironMantis, { ...common, hand: 0 }, { x: 0, y: 0 })).toEqual(
      mantisLead,
    );
    expect(resolveIdleHandTarget(ironMantis, { ...common, hand: 1 }, { x: 0, y: 0 })).toEqual(
      mantisOff,
    );

    const crane = weapon("x2-drunken-fist-wraps");
    const craneLead = resolveIdleHandTarget(crane, { ...common, hand: 0 }, { x: 0, y: 0 });
    const craneOff = resolveIdleHandTarget(crane, { ...common, hand: 1 }, { x: 0, y: 0 });
    expect(craneLead.y).toBeLessThan(craneOff.y);
    expect(martialIdleHandAngleFor(crane, 0)).toBeGreaterThan(0.5);
    expect(martialIdleHandAngleFor(crane, 1)).toBeLessThan(-0.4);
  });

  it.each([
    "x2-coyote-trickster-s-sparkmitt",
    "x2-emberfist-wraps",
  ] as const)("holds both %s fists in a compact chin-height boxer guard", (weaponId) => {
    const def = weapon(weaponId);
    const common = { bodyX: 0, bodyY: 0, bodyHeight: 76, aimLocal: 0 };
    const lead = resolveIdleHandTarget(def, { ...common, hand: 0 }, { x: 0, y: 0 });
    const off = resolveIdleHandTarget(def, { ...common, hand: 1 }, { x: 0, y: 0 });

    expect(idleHandPoseFor(def)).toBe("boxer-guard");
    expect(lead.x).toBeGreaterThan(0);
    expect(off.x).toBeGreaterThan(0);
    expect(lead.y).toBeLessThan(-12);
    expect(off.y).toBeLessThan(-12);
    expect(Math.abs(lead.y - off.y)).toBeLessThan(5);
    expect(Math.abs(martialIdleHandAngleFor(def, 0) ?? Number.POSITIVE_INFINITY)).toBeLessThan(
      0.25,
    );
    expect(Math.abs(martialIdleHandAngleFor(def, 1) ?? Number.POSITIVE_INFINITY)).toBeLessThan(
      0.25,
    );
  });

  it("keeps idle and terminal recovery continuous, finite, bounded, and facing-side after one mirror", () => {
    const aims = [-Math.PI, -Math.PI / 2, 0, Math.PI / 2, Math.PI];
    for (const def of Object.values(WEAPONS)) {
      if (classifyHandRole(def, idleFrame, 1) !== "authored-idle") continue;
      for (const aimLocal of aims) {
        const base = {
          bodyX: 3,
          bodyY: -4,
          bodyHeight: 76,
          aimLocal,
          movementX: -8,
          movementY: 3,
          microX: -5,
          microY: 2,
          manifestSocketX: -62,
        };
        const idle = resolveIdleHandTarget(def, base, { x: 0, y: 0 });
        const terminal = resolveIdleHandTarget(
          def,
          {
            ...base,
            recoveryT: 1,
            recoveryForward: weaponPoseSpecFor(def).recovery.forward,
            recoveryLateral: weaponPoseSpecFor(def).recovery.lateral,
          },
          { x: 0, y: 0 },
        );
        expect(terminal, `${def.id}:${aimLocal}:continuity`).toEqual(idle);
        expect(Number.isFinite(idle.x + idle.y), def.id).toBe(true);
        expect(Math.hypot(idle.x - base.bodyX, idle.y - base.bodyY), def.id).toBeLessThan(40);
        for (const facing of [-1, 1] as const) {
          const worldDeltaX = (idle.x - base.bodyX) * facing;
          expect(
            worldDeltaX * facing,
            `${def.id}:${idleHandPoseFor(def)}:hand=1:idle:facing=${facing}:aim=${aimLocal}`,
          ).toBeGreaterThanOrEqual(FACING_SIDE_FLOOR_BODY_FRAC * base.bodyHeight);
        }
      }
    }
  });

  it("removes only micro-motion under reduced motion, not semantic placement", () => {
    const def = weapon("x2-saint-s-knucklebone-censer-orb");
    const common = { bodyX: 0, bodyY: 0, bodyHeight: 76, aimLocal: 0.4 };
    const animated = resolveIdleHandTarget(
      def,
      { ...common, microX: 1.4, microY: -0.7 },
      { x: 0, y: 0 },
    );
    const reduced = resolveIdleHandTarget(def, common, { x: 0, y: 0 });
    expect(idleHandPoseFor(def)).toBe("casting-gesture");
    expect(animated).not.toEqual(reduced);
    expect(animated.x).toBeGreaterThanOrEqual(76 * FACING_SIDE_FLOOR_BODY_FRAC);
    expect(reduced.x).toBeGreaterThanOrEqual(76 * FACING_SIDE_FLOOR_BODY_FRAC);
  });
});

describe("B17 neutral foot-profile laws", () => {
  it("selects one finite planted profile and brackets the body at every gait sample", () => {
    for (const def of Object.values(WEAPONS)) {
      const pose = idleFootPoseFor(def);
      expect(IDLE_FOOT_POSE_SPECS[pose], def.id).toBeDefined();
      for (const gait of [0, 0.5, 1]) {
        const front = resolveFootPoseOffset(pose, true, gait, 76, { x: 0, y: 0 });
        const back = resolveFootPoseOffset(pose, false, gait, 76, { x: 0, y: 0 });
        expect(Number.isFinite(front.x + front.y + back.x + back.y), def.id).toBe(true);
        expect(front.x, `${def.id}:${gait}:front`).toBeGreaterThan(0);
        expect(back.x, `${def.id}:${gait}:back`).toBeLessThan(0);
        expect(front.x - back.x, `${def.id}:${gait}:width`).toBeGreaterThan(1);
      }
    }
  });

  it("keeps the proven overrides on their named profiles", () => {
    expect(idleFootPoseFor(weapon("x2-hellmouth-palmcaster"))).toBe("loose-plant");
    expect(idleFootPoseFor(weapon("x2-saint-bough-frost-crozier"))).toBe("combat-plant");
    expect(idleFootPoseFor(weapon("x-sword-neon-katana"))).toBe("wide-plant");
  });

  it("keeps planted feet separated, mirrored, and in the ground band across gait phases", () => {
    for (const pose of Object.keys(IDLE_FOOT_POSE_SPECS) as Array<
      keyof typeof IDLE_FOOT_POSE_SPECS
    >) {
      for (const gait of [0, 0.5, 1]) {
        for (const phase of [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2]) {
          const frontBias = resolveFootPoseOffset(pose, true, gait, 76, { x: 0, y: 0 });
          const backBias = resolveFootPoseOffset(pose, false, gait, 76, { x: 0, y: 0 });
          const stride = Math.sin(phase) * 9 * gait;
          const frontX = 24 + frontBias.x + stride;
          const backX = -24 + backBias.x - stride;
          const frontY = 52 + frontBias.y - Math.max(0, Math.sin(phase)) * 10 * gait;
          const backY = 52 + backBias.y - Math.max(0, Math.sin(phase + Math.PI)) * 10 * gait;
          expect(frontX, `${pose}:${gait}:${phase}:uncrossed`).toBeGreaterThan(backX);
          expect(frontX - backX, `${pose}:${gait}:${phase}:width`).toBeGreaterThan(20);
          if (pose === "crane-one-leg") {
            expect(frontY, `${pose}:${gait}:${phase}:raised-front`).toBeLessThan(50);
          } else {
            expect(frontY, `${pose}:${gait}:${phase}:front-ground`).toBeGreaterThan(35);
          }
          expect(backY, `${pose}:${gait}:${phase}:back-ground`).toBeGreaterThan(35);
          for (const facing of [-1, 1] as const) {
            expect(frontX * facing, `${pose}:${facing}:front-mirror`).toBe(
              facing === 1 ? frontX : -frontX,
            );
            expect(backX * facing, `${pose}:${facing}:back-mirror`).toBe(
              facing === 1 ? backX : -backX,
            );
          }
        }
      }
    }
  });

  it("raises exactly one Drunken Fist leg in the crane idle profile", () => {
    const def = weapon("x2-drunken-fist-wraps");
    expect(idleFootPoseFor(def)).toBe("crane-one-leg");
    const front = resolveFootPoseOffset("crane-one-leg", true, 0, 76, { x: 0, y: 0 });
    const back = resolveFootPoseOffset("crane-one-leg", false, 0, 76, { x: 0, y: 0 });
    expect(front.y).toBeLessThan(-35);
    expect(back.y).toBeGreaterThan(0);
  });

  it("replaces the family profile with a named stance and keeps terminal recovery identical", () => {
    const def = weapon("x-sword-neon-katana");
    const stance = NAMED_WEAPON_STANCES["near-ear-blade-up"];
    const named = resolveWeaponFootPoseOffset(def, stance, true, 0, 76, { x: 0, y: 0 });
    const family = resolveFootPoseOffset(idleFootPoseFor(def), true, 0, 76, { x: 0, y: 0 });
    expect(named.x).toBe(stance.frontFootForward * 76);
    expect(named.y).toBe(stance.frontFootLateral * 76);
    expect(named.x).not.toBe(stance.frontFootForward * 76 + family.x);
    const terminalRecovery = resolveWeaponFootPoseOffset(def, stance, true, 0, 76, { x: 0, y: 0 });
    expect(terminalRecovery).toEqual(named);
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

// Owner-ledger W-POSE coverage is append-only: one reusable sampler resolves all nine authored records.
describe("weapon performance pose states", () => {
  const expected = {
    "x2-cairn-of-hollow-names": ["upright", "default-swing"],
    "x2-rotgrove-totem": ["upright", "default-swing"],
    "x2-coffin-nail-rosary-orb": ["hanging-chain", "default-swing"],
    "x2-emberleaf-chapbook": ["steady", "page-flip"],
    "x2-tallowtongue-pyre-stave": ["steady", "shake"],
    "x2-hollowbarrel-spell-scattergun-staff": ["horn-to-face", "recoil"],
    "x2-saint-bough-frost-crozier": ["one-hand-walking-staff", "default-swing"],
    "x2-hexbloom-scattergrimoire": ["steady", "shake"],
    "x2-cinderchoke-brazier-orb": ["steady", "overhead-downswing"],
    "x2-fulgurite-storm-sphere": ["overhead", "shake"],
    "x2-gravesinger-s-hex-wand": ["shoulder-launcher", "recoil"],
    "x2-bogwater-twinbits": ["steady", "throw-release"],
    "x2-boothill-hatchet": ["upright", "default-swing"],
  } as const;

  it("resolves the ledger hold/action state for every named weapon", () => {
    for (const [id, [hold, action]] of Object.entries(expected)) {
      const spec = weaponPerformanceSpecFor(weapon(id));
      expect(spec?.hold, id).toBe(hold);
      expect(spec?.action, id).toBe(action);
    }
  });

  it("raises Cinderchoke only for its strike-start jiggle, then commits the downswing", () => {
    const input = createWeaponPerformanceInput();
    const out = createWeaponPerformanceSample();
    input.spec = performance("x2-cinderchoke-brazier-orb");
    input.aimLocal = 0.2;
    input.timeS = 0.37;

    const idle = { ...sampleWeaponPerformance(input, out) };
    input.phase = "anticipation";
    input.phaseT = 0.8;
    const overhead = { ...sampleWeaponPerformance(input, out) };
    input.phase = "active";
    input.phaseT = 1;
    const strike = { ...sampleWeaponPerformance(input, out) };
    const swing = swingDescriptorFor(weapon("x2-cinderchoke-brazier-orb"), 0.6);

    expect(input.spec.windupSeconds).toBe(0.5);
    expect(swing.activeStartSeconds).toBe(0.5);
    expect(idle.weaponAngle).toBeCloseTo(0.08);
    expect(idle.handY).toBeGreaterThan(-0.2);
    expect(overhead.handY).toBe(-0.4);
    expect(overhead.weaponAngle).not.toBe(-Math.PI / 2);
    expect(strike.handY).toBeGreaterThan(-0.1);
    expect(strike.weaponAngle).toBeCloseTo(0.9);
  });

  it("moves the Cairn forward by its authored clearance while preserving ordinary attacks", () => {
    const input = createWeaponPerformanceInput();
    const out = createWeaponPerformanceSample();
    input.spec = performance("x2-cairn-of-hollow-names");
    const cairn = { ...sampleWeaponPerformance(input, out) };
    input.spec = performance("x2-rotgrove-totem");
    const control = { ...sampleWeaponPerformance(input, out) };

    expect(cairn.handX - control.handX).toBeCloseTo(24 / 76);
    input.spec = performance("x2-cairn-of-hollow-names");
    input.phase = "active";
    expect(sampleWeaponPerformance(input, out).active).toBe(false);
  });

  it("winds both Bogwater hands behind the body and lurches both through release", () => {
    const input = createWeaponPerformanceInput();
    const out = createWeaponPerformanceSample();
    input.spec = performance("x2-bogwater-twinbits");
    input.phase = "anticipation";
    input.phaseT = 1;
    const wound = { ...sampleWeaponPerformance(input, out) };
    input.phase = "active";
    input.phaseT = 1;
    const released = { ...sampleWeaponPerformance(input, out) };

    expect(wound.handX).toBeCloseTo(-0.3);
    expect(wound.backHandX).toBeCloseTo(-0.3);
    expect(wound.backHandBlend).toBe(1);
    expect(released.handX).toBeCloseTo(0.46);
    expect(released.backHandX).toBeCloseTo(0.46);
    expect(released.weaponAngle).toBe(0);
  });

  it.each(["x2-gallows-splitter", "x2-saloon-tomahawk"] as const)(
    "winds %s behind the head in both hands before an over-shoulder release",
    (id) => {
      const input = createWeaponPerformanceInput();
      const out = createWeaponPerformanceSample();
      input.spec = performance(id);
      input.aimLocal = 0;
      input.phase = "anticipation";
      input.phaseT = 1;
      const wound = { ...sampleWeaponPerformance(input, out) };
      input.phase = "active";
      input.phaseT = 1;
      const released = { ...sampleWeaponPerformance(input, out) };

      expect(wound.handX).toBeLessThan(-0.3);
      expect(wound.backHandX).toBeLessThan(-0.25);
      expect(wound.handY).toBeLessThan(-0.5);
      expect(wound.backHandY).toBeLessThan(-0.45);
      expect(wound.backHandBlend).toBe(1);
      expect(released.handX).toBeGreaterThan(0.5);
      expect(released.backHandX).toBeGreaterThan(0.4);
      expect(released.backHandBlend).toBe(1);
    },
  );

  it("holds Gravesinger behind and above the shoulders and Boothill upright at rest", () => {
    const input = createWeaponPerformanceInput();
    const out = createWeaponPerformanceSample();
    input.spec = performance("x2-gravesinger-s-hex-wand");
    const launcher = { ...sampleWeaponPerformance(input, out) };
    input.spec = performance("x2-boothill-hatchet");
    const hatchet = { ...sampleWeaponPerformance(input, out) };

    expect(launcher).toMatchObject({ handX: -0.08, handY: -0.32, weaponAngle: 0 });
    expect(hatchet.weaponAngle).toBe(-Math.PI / 2);
  });

  it("plants Saint-Bough as a one-hand walking staff without claiming the far hand", () => {
    const input = createWeaponPerformanceInput();
    const out = createWeaponPerformanceSample();
    input.spec = performance("x2-saint-bough-frost-crozier");
    input.gait = 0.8;
    input.stridePhase = -0.35;
    const contact = { ...sampleWeaponPerformance(input, out) };
    input.stridePhase = Math.PI - 0.35;
    const lifted = { ...sampleWeaponPerformance(input, out) };

    expect(contact.weaponAngle).toBe(-Math.PI / 2);
    expect(contact.backHandBlend).toBe(0);
    expect(contact.handY).toBeGreaterThan(lifted.handY);
    expect(contact.handY - lifted.handY).toBeCloseTo((10 * 0.8) / 76);
  });

  it("raises Hollowbarrel to the face and keeps its playing hand on the horn", () => {
    const input = createWeaponPerformanceInput();
    const out = createWeaponPerformanceSample();
    input.spec = performance("x2-hollowbarrel-spell-scattergun-staff");
    input.aimLocal = 0;
    const sampled = sampleWeaponPerformance(input, out);

    expect(sampled).toMatchObject({
      active: true,
      weaponAngle: 0,
      handX: 0.06,
      handY: -0.25,
      backHandX: -0.12,
      backHandY: 0.13,
      backHandBlend: 1,
    });
  });

  it("lets upright and hanging-chain rest poses yield to their ordinary attack swings", () => {
    const input = createWeaponPerformanceInput();
    const out = createWeaponPerformanceSample();
    input.phase = "active";
    input.phaseT = 0.5;
    input.spec = performance("x2-cairn-of-hollow-names");
    expect(sampleWeaponPerformance(input, out).active).toBe(false);

    input.spec = performance("x2-coffin-nail-rosary-orb");
    expect(sampleWeaponPerformance(input, out).active).toBe(false);
    input.phase = "idle";
    expect(sampleWeaponPerformance(input, out).active).toBe(true);
    expect(out.weaponAngle).toBe(Math.PI / 2);
  });
});

// NW-MELEE/NW-THROWN append-only pose contracts.
describe("NW melee and thrown pose orders", () => {
  it("resolves both katana hilt grips as hard two-hand poses", () => {
    for (const id of ["drift-nodachi-pale-horizon", "x2-voltfang-tachi"]) {
      const definition = weapon(id);
      expect(twoHandedPoseFor(definition, "metadata"), id).toBe(true);
      expect(weaponPoseResolutionFor(definition).hardTwoHanded, id).toBe(true);
    }
  });

  it("holds Godsbone at the feet and Quicksilver hanging from its chain at rest", () => {
    const input = createWeaponPerformanceInput();
    const out = createWeaponPerformanceSample();
    input.aimLocal = 0;
    input.spec = performance("x2-godsbone-pillar");
    const godsbone = { ...sampleWeaponPerformance(input, out) };
    input.spec = performance("x2-quicksilver-censer");
    const censer = { ...sampleWeaponPerformance(input, out) };

    expect(godsbone).toMatchObject({ active: true, handX: -0.2, handY: 0.3 });
    expect(godsbone.weaponAngle).toBeCloseTo(Math.PI);
    expect(censer).toMatchObject({ active: true, handX: 0.1, handY: -0.05 });
    expect(censer.weaponAngle).toBeCloseTo(Math.PI / 2);
  });

  it("adds exactly one full draw-phase hand twirl to Coilshot", () => {
    const input = createWeaponPerformanceInput();
    const out = createWeaponPerformanceSample();
    const coilshot = performance("x2-coilshot-meteor");
    input.phase = "anticipation";
    input.phaseT = 1;
    input.aimLocal = 0.2;
    input.spec = { ...coilshot, preThrowRevolutions: 0 };
    const untwirled = { ...sampleWeaponPerformance(input, out) };
    input.spec = coilshot;
    const twirled = { ...sampleWeaponPerformance(input, out) };

    expect(coilshot.preThrowRevolutions).toBe(1);
    expect(coilshot.windupSeconds).toBe(0.36);
    expect(twirled.weaponAngle - untwirled.weaponAngle).toBeCloseTo(Math.PI * 2);
    const sampledAngles = [0, 0.25, 0.5, 0.75, 1].map((phaseT) => {
      input.phaseT = phaseT;
      input.spec = coilshot;
      return sampleWeaponPerformance(input, out).weaponAngle;
    });
    expect(Math.max(...sampledAngles) - Math.min(...sampledAngles)).toBeGreaterThanOrEqual(
      Math.PI * 2,
    );
  });
});
