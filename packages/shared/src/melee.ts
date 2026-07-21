import { CHOP_IMPACT_FRAC, SWING_WINDOW_FRAC } from "./constants.js";
import { clamp } from "./math.js";
import type { Vec2 } from "./movement.js";
import {
  meleeReach,
  type WeaponDef,
  type WeaponEffectEmitter,
  weaponMuzzleReach,
} from "./weapons.js";
import { GENERATED_MELEE_COMBO_BARS } from "./weapons-expansion.generated.js";

/**
 * §20 WYSIWYG melee (playtest #2/#5/#6). A melee swing is not an instant cone — it's a swept BLADE: a line
 * from the wielder out to the weapon's `range` along the aim, that sweeps across the weapon's `swingArc`
 * over a brief active window. Sampled each server tick (super-sampled between ticks so a fast enemy can't
 * slip a gap), ANY enemy the blade line crosses — within `MELEE_BLADE_HALFWIDTH` of it — takes the edge
 * ONCE per swing. So "if any part of the weapon touches a monster, it's a hit", and the hit region is the
 * blade itself (tight) rather than a fat wedge. Pure + deterministic so the server owns it and it's tested.
 */

/** @deprecated Compatibility tuning/API for pre-§44 callers. Accepted swings MUST use `swingDescriptorFor`;
 *  retaining this pure clamp keeps old tooling/tests loadable without reintroducing a second live clock. */
export const MELEE_SWING_ACTIVE = 0.18;
/** @deprecated See {@link MELEE_SWING_ACTIVE}; the authoritative server does not call this helper. */
export function meleeSwingActive(cooldown: number): number {
  return Math.min(MELEE_SWING_ACTIVE, Math.max(0.04, cooldown * 0.9));
}

/** Blade half-thickness (px). §20 v0.114 beefed 16→21 — a graze along the flat connects; fewer "looked like
 *  a hit" whiffs. Generous but still tight off the line. */
export const MELEE_BLADE_HALFWIDTH = 21;
/** Max angular gap (rad) between super-sampled blade tests — keeps the swept band continuous between the
 *  20Hz ticks (a long blade at a wide arc would otherwise leave holes a small enemy could sit in). §20 v0.114
 *  tightened 0.12→0.08 so a fast wide swing can't skip over a small enemy between samples. */
export const MELEE_SAMPLE_STEP = 0.08;

export type SwingStyle = NonNullable<WeaponDef["swingStyle"]>;

/** §45 Stage-1 combo vocabulary. These tables are inert authored DATA: the client consumes pose/timing,
 *  while the server keeps resolving its one legacy centered sweep. `path` is deliberately carried now so a
 *  later accepted descriptor can reuse the exact step table without trusting a client-authored finisher. */
export type MeleeComboFamily = "arc" | "chop" | "rake" | "punch" | "thrust";
export type GeneratedMeleeComboVariant = keyof typeof GENERATED_MELEE_COMBO_BARS;
export type MeleeComboVariant =
  | "default"
  | "dagger"
  | "claw"
  | "quake-mauler"
  | "stinger"
  | "hero-spin"
  | "pommel"
  | "greatsword"
  | "greatsword-momentum"
  | "claymore-breach"
  | "glaive-compass"
  | "bardiche-hookbreak"
  | "nodachi-coldcourt"
  | "nodachi-petalfall"
  | "katana-threehails"
  | "katana-thunderlag"
  | GeneratedMeleeComboVariant;

/** Weapon-authored combo seam. Optional fields let current data use shared shape defaults while future
 * weapon entries opt into an exact family/variant without teaching the renderer weapon ids or names. */
declare module "./weapons.js" {
  interface WeaponDef {
    comboFamily?: MeleeComboFamily;
    comboVariant?: MeleeComboVariant;
  }
}

export type MeleeComboMotion =
  | "slash"
  | "overhead"
  | "shoulder-chop"
  | "rising-chop"
  | "execution-slam"
  | "rake"
  | "scissor"
  | "jab"
  | "cross"
  | "hook"
  | "haymaker"
  | "lunge"
  | "disengage"
  | "impale"
  | "fulcrum-flip"
  | "stinger"
  | "spin-release"
  | "pommel-bash"
  | "true-charged-slam"
  | "falling-gate"
  | "backswing-wheel"
  | "runaway-cleave"
  | "highland-gate"
  | "rising-ward"
  | "bind-break-cast-off"
  | "long-reap"
  | "shaft-switch"
  | "compass-rose"
  | "headsmans-drop"
  | "hook-and-haul"
  | "gallows-turn"
  | "draw-cut"
  | "guard-check"
  | "sentence-fall"
  | "choked-turn"
  | "petalfall"
  | "coil-drag"
  | "thunder-fall"
  | "splinter-fall";
export type MeleeComboHand = "lead" | "off" | "both";
/** Dual-wield's six-beat presentation bar. Crossfall stays presentation-only server-side: its accepted
 * damage event remains one lead-hand sweep, while clients render the authored `both` pose. */
export const DUAL_MELEE_PAIR_BAR = Object.freeze([
  "lead",
  "off",
  "lead",
  "off",
  "lead",
  "both",
] as const satisfies readonly MeleeComboHand[]);
export const DUAL_MELEE_SEQUENCE_LENGTH = DUAL_MELEE_PAIR_BAR.length;
export type MeleeComboPath = "sweep" | "fan" | "dual-sweep" | "capsule";
export type MeleeComboRibbonProfile =
  | "massed-wedge"
  | "hooked-comma"
  | "open-c"
  | "guard-plane"
  | "rising-plane"
  | "broken-cross"
  | "outer-crescent"
  | "reverse-hairpin"
  | "open-annulus"
  | "head-wedge"
  | "inward-hook"
  | "heavy-sickle";
export type MeleeComboRibbonEnd = "clean" | "squared" | "torn" | "hooked" | "open";

/** Stage-1 presentation profile for the painted-edge renderer. It describes one dominant business-edge
 * ribbon plus, where needed, a faint neutral setup echo. It never changes the accepted centered sweep. */
export interface MeleeComboRibbon {
  readonly profile: MeleeComboRibbonProfile;
  readonly radialStart: number;
  readonly radialEnd: number;
  readonly widthMultiplier: number;
  readonly end: MeleeComboRibbonEnd;
  readonly setupEcho?: "neutral-dim";
}

export interface MeleeComboStep {
  readonly name: string;
  readonly motion: MeleeComboMotion;
  /** +1 forehand/lead, −1 reverse/off-side, 0 opposing paths. Cosmetic until signed server paths land. */
  readonly direction: -1 | 0 | 1;
  readonly hand: MeleeComboHand;
  readonly timing: {
    readonly activeStart: number;
    readonly activeEnd: number;
    readonly impact?: number;
    readonly followEnd: number;
    /** Scissor's delayed second hand; absent for every single-path step. */
    readonly secondaryActiveStart?: number;
    readonly secondaryActiveEnd?: number;
  };
  /** Dormant authoritative-path authoring for Stage 3+. Stage 1 never reads damage/range/knockback. */
  readonly path: {
    readonly kind: MeleeComboPath;
    readonly arcMultiplier: number;
    /** Explicit signed angular travel for paths such as the one-revolution hero spin. */
    readonly deltaAngle?: number;
    readonly rangeMultiplier: number;
    readonly damageMultiplier: number;
    readonly knockback: number;
  };
  /** Cosmetic business-edge variation. Geometry/damage consumers must continue to use `path`/descriptor. */
  readonly ribbon?: Readonly<MeleeComboRibbon>;
}

/** §45 section-B authored 3-hit cycles. Arrays/step roots are frozen and fields are readonly; all fractions
 *  are normalized over the effective-cooldown pose so the eventual accepted descriptor can consume them. */
export const MELEE_COMBO_SEQUENCES: Readonly<
  Record<MeleeComboFamily, readonly Readonly<MeleeComboStep>[]>
> = Object.freeze({
  arc: Object.freeze([
    Object.freeze({
      name: "forehand cut",
      motion: "slash" as const,
      direction: 1 as const,
      hand: "lead" as const,
      timing: { activeStart: 0.16, activeEnd: 0.66, followEnd: 0.8 },
      path: {
        kind: "sweep" as const,
        arcMultiplier: 1,
        rangeMultiplier: 1,
        damageMultiplier: 1,
        knockback: 0,
      },
    }),
    Object.freeze({
      name: "reverse backhand",
      motion: "slash" as const,
      direction: -1 as const,
      hand: "lead" as const,
      timing: { activeStart: 0.1, activeEnd: 0.6, followEnd: 0.78 },
      path: {
        kind: "sweep" as const,
        arcMultiplier: -1,
        rangeMultiplier: 1,
        damageMultiplier: 1,
        knockback: 0,
      },
    }),
    Object.freeze({
      name: "overhead diagonal finisher",
      motion: "overhead" as const,
      direction: 1 as const,
      hand: "lead" as const,
      timing: {
        activeStart: 0.28,
        activeEnd: 0.6,
        impact: 0.52,
        followEnd: 0.74,
      },
      path: {
        kind: "sweep" as const,
        arcMultiplier: 1.25,
        rangeMultiplier: 1.08,
        damageMultiplier: 1.2,
        knockback: 72,
      },
    }),
  ]),
  chop: Object.freeze([
    Object.freeze({
      name: "shoulder chop",
      motion: "shoulder-chop" as const,
      direction: 1 as const,
      hand: "lead" as const,
      timing: {
        activeStart: 0.24,
        activeEnd: 0.52,
        impact: 0.52,
        followEnd: 0.66,
      },
      path: {
        kind: "sweep" as const,
        arcMultiplier: 0.75,
        rangeMultiplier: 1,
        damageMultiplier: 1,
        knockback: 0,
      },
    }),
    Object.freeze({
      name: "reverse rising cut",
      motion: "rising-chop" as const,
      direction: -1 as const,
      hand: "lead" as const,
      timing: {
        activeStart: 0.14,
        activeEnd: 0.5,
        impact: 0.5,
        followEnd: 0.7,
      },
      path: {
        kind: "sweep" as const,
        arcMultiplier: -0.8,
        rangeMultiplier: 1,
        damageMultiplier: 1,
        knockback: 0,
      },
    }),
    Object.freeze({
      name: "execution slam",
      motion: "execution-slam" as const,
      direction: 1 as const,
      hand: "lead" as const,
      timing: {
        activeStart: 0.32,
        activeEnd: 0.56,
        impact: 0.56,
        followEnd: 0.74,
      },
      path: {
        kind: "fan" as const,
        arcMultiplier: 1.15,
        rangeMultiplier: 1.05,
        damageMultiplier: 1.25,
        knockback: 96,
      },
    }),
  ]),
  rake: Object.freeze([
    Object.freeze({
      name: "lead-hand rake",
      motion: "rake" as const,
      direction: 1 as const,
      hand: "lead" as const,
      timing: { activeStart: 0.13, activeEnd: 0.58, followEnd: 0.76 },
      path: {
        kind: "sweep" as const,
        arcMultiplier: 1,
        rangeMultiplier: 1,
        damageMultiplier: 1,
        knockback: 0,
      },
    }),
    Object.freeze({
      name: "off-hand reverse rake",
      motion: "rake" as const,
      direction: -1 as const,
      hand: "off" as const,
      timing: { activeStart: 0.09, activeEnd: 0.54, followEnd: 0.74 },
      path: {
        kind: "sweep" as const,
        arcMultiplier: -1,
        rangeMultiplier: 1,
        damageMultiplier: 1,
        knockback: 0,
      },
    }),
    Object.freeze({
      name: "scissor drag",
      motion: "scissor" as const,
      direction: 0,
      hand: "both" as const,
      timing: {
        activeStart: 0.18,
        activeEnd: 0.52,
        secondaryActiveStart: 0.24,
        secondaryActiveEnd: 0.58,
        impact: 0.43,
        followEnd: 0.76,
      },
      path: {
        kind: "dual-sweep" as const,
        arcMultiplier: 0.85,
        rangeMultiplier: 1.05,
        damageMultiplier: 1.18,
        knockback: 64,
      },
    }),
  ]),
  punch: Object.freeze([
    Object.freeze({
      name: "lead jab",
      motion: "jab" as const,
      direction: 1 as const,
      hand: "lead" as const,
      timing: {
        activeStart: 0.1,
        activeEnd: 0.36,
        impact: 0.36,
        followEnd: 0.44,
      },
      path: {
        kind: "capsule" as const,
        arcMultiplier: 0,
        rangeMultiplier: 0.92,
        damageMultiplier: 0.95,
        knockback: 0,
      },
    }),
    Object.freeze({
      name: "cross / body hook",
      motion: "hook" as const,
      direction: -1 as const,
      hand: "off" as const,
      timing: {
        activeStart: 0.18,
        activeEnd: 0.48,
        impact: 0.48,
        followEnd: 0.68,
      },
      path: {
        kind: "sweep" as const,
        arcMultiplier: 1,
        rangeMultiplier: 1,
        damageMultiplier: 1,
        knockback: 0,
      },
    }),
    Object.freeze({
      name: "haymaker / hammerfist",
      motion: "haymaker" as const,
      direction: 1 as const,
      hand: "lead" as const,
      timing: {
        activeStart: 0.28,
        activeEnd: 0.56,
        impact: 0.56,
        followEnd: 0.72,
      },
      path: {
        kind: "sweep" as const,
        arcMultiplier: 1,
        rangeMultiplier: 1.05,
        damageMultiplier: 1.25,
        knockback: 88,
      },
    }),
  ]),
  thrust: Object.freeze([
    Object.freeze({
      name: "outside-line lunge",
      motion: "lunge" as const,
      direction: 1 as const,
      hand: "lead" as const,
      timing: {
        activeStart: 0.14,
        activeEnd: 0.42,
        impact: 0.42,
        followEnd: 0.5,
      },
      path: {
        kind: "capsule" as const,
        arcMultiplier: 0,
        rangeMultiplier: 1,
        damageMultiplier: 1,
        knockback: 0,
      },
    }),
    Object.freeze({
      name: "disengage thrust",
      motion: "disengage" as const,
      direction: -1 as const,
      hand: "lead" as const,
      timing: {
        activeStart: 0.18,
        activeEnd: 0.44,
        impact: 0.44,
        followEnd: 0.52,
      },
      path: {
        kind: "capsule" as const,
        arcMultiplier: 0,
        rangeMultiplier: 1,
        damageMultiplier: 1,
        knockback: 0,
      },
    }),
    Object.freeze({
      name: "step-through impale",
      motion: "impale" as const,
      direction: 1 as const,
      hand: "both" as const,
      timing: {
        activeStart: 0.24,
        activeEnd: 0.58,
        impact: 0.58,
        followEnd: 0.7,
      },
      path: {
        kind: "capsule" as const,
        arcMultiplier: 0,
        rangeMultiplier: 1.15,
        damageMultiplier: 1.22,
        knockback: 80,
      },
    }),
  ]),
});

/** §44 the immutable clock accepted/predicted for ONE swing. Seconds are relative to that peer's accepted
 *  epoch: the server starts at `canAct`; the client predicts at send until an acceptance sequence exists.
 *  Geometry/damage remain separate so extending a slow edge's wall-clock opportunity cannot multiply hits. */
/** Ranked iconic-move steps. Keep every union-valued literal narrow: the shared declaration build checks
 * these tables directly rather than relying on the client's bundler inference. */
export const FULCRUM_FLIP_COMBO_STEP = Object.freeze({
  name: "fulcrum flip quake",
  motion: "fulcrum-flip" as const,
  direction: 1 as const,
  hand: "both" as const,
  timing: { activeStart: 0.5, activeEnd: 0.66, impact: 0.66, followEnd: 0.82 },
  path: {
    kind: "fan" as const,
    arcMultiplier: 1.15,
    rangeMultiplier: 1.08,
    damageMultiplier: 1.25,
    knockback: 110,
  },
} as const satisfies MeleeComboStep);

export const STINGER_COMBO_STEP = Object.freeze({
  name: "stinger",
  motion: "stinger" as const,
  direction: 1 as const,
  hand: "both" as const,
  timing: { activeStart: 0.24, activeEnd: 0.58, impact: 0.58, followEnd: 0.7 },
  path: {
    kind: "capsule" as const,
    arcMultiplier: 0,
    rangeMultiplier: 1.2,
    damageMultiplier: 1.22,
    knockback: 80,
  },
} as const satisfies MeleeComboStep);

export const HERO_SPIN_COMBO_STEP = Object.freeze({
  name: "charged hero spin",
  motion: "spin-release" as const,
  direction: 1 as const,
  hand: "lead" as const,
  timing: { activeStart: 0.3, activeEnd: 0.66, impact: 0.48, followEnd: 0.78 },
  path: {
    kind: "sweep" as const,
    arcMultiplier: 1,
    deltaAngle: Math.PI * 2,
    rangeMultiplier: 1.03,
    damageMultiplier: 1.18,
    knockback: 64,
  },
} as const satisfies MeleeComboStep);

export const POMMEL_BASH_COMBO_STEP = Object.freeze({
  name: "pommel bash",
  motion: "pommel-bash" as const,
  direction: 1 as const,
  hand: "both" as const,
  timing: { activeStart: 0.12, activeEnd: 0.3, impact: 0.28, followEnd: 0.44 },
  path: {
    kind: "capsule" as const,
    arcMultiplier: 0,
    rangeMultiplier: 0.55,
    damageMultiplier: 0.75,
    knockback: 28,
  },
} as const satisfies MeleeComboStep);

export const TRUE_CHARGED_SLAM_COMBO_STEP = Object.freeze({
  name: "true charged step-slash",
  motion: "true-charged-slam" as const,
  direction: 1 as const,
  hand: "both" as const,
  timing: { activeStart: 0.46, activeEnd: 0.64, impact: 0.61, followEnd: 0.8 },
  path: {
    kind: "fan" as const,
    arcMultiplier: 0.72,
    rangeMultiplier: 1.12,
    damageMultiplier: 1.25,
    knockback: 96,
  },
} as const satisfies MeleeComboStep);

/** Big-sword panel Stage-1 choreography. Every path remains the same single, unit-strength sweep; the
 * named timing/ribbon data is presentation-only until accepted signed paths ship. */
export const FALLING_GATE_COMBO_STEP = Object.freeze({
  name: "falling gate",
  motion: "falling-gate" as const,
  direction: 1 as const,
  hand: "both" as const,
  timing: { activeStart: 0.22, activeEnd: 0.54, impact: 0.5, followEnd: 0.78 },
  path: {
    kind: "sweep" as const,
    arcMultiplier: 1,
    rangeMultiplier: 1,
    damageMultiplier: 1,
    knockback: 0,
  },
  ribbon: {
    profile: "massed-wedge" as const,
    radialStart: 0.3,
    radialEnd: 1,
    widthMultiplier: 1.25,
    end: "squared" as const,
  },
} as const satisfies MeleeComboStep);

export const BACKSWING_WHEEL_COMBO_STEP = Object.freeze({
  name: "backswing wheel",
  motion: "backswing-wheel" as const,
  direction: 1 as const,
  hand: "both" as const,
  timing: { activeStart: 0.1, activeEnd: 0.49, impact: 0.44, followEnd: 0.77 },
  path: {
    kind: "sweep" as const,
    arcMultiplier: 1,
    rangeMultiplier: 1,
    damageMultiplier: 1,
    knockback: 0,
  },
  ribbon: {
    profile: "hooked-comma" as const,
    radialStart: 0.3,
    radialEnd: 1,
    widthMultiplier: 1.08,
    end: "hooked" as const,
    setupEcho: "neutral-dim" as const,
  },
} as const satisfies MeleeComboStep);

export const RUNAWAY_CLEAVE_COMBO_STEP = Object.freeze({
  name: "runaway cleave",
  motion: "runaway-cleave" as const,
  direction: 1 as const,
  hand: "both" as const,
  timing: { activeStart: 0.26, activeEnd: 0.64, impact: 0.54, followEnd: 0.86 },
  path: {
    kind: "sweep" as const,
    arcMultiplier: 1,
    rangeMultiplier: 1,
    damageMultiplier: 1,
    knockback: 0,
  },
  ribbon: {
    profile: "open-c" as const,
    radialStart: 0.28,
    radialEnd: 1,
    widthMultiplier: 1.35,
    end: "torn" as const,
    setupEcho: "neutral-dim" as const,
  },
} as const satisfies MeleeComboStep);

export const HIGHLAND_GATE_COMBO_STEP = Object.freeze({
  name: "highland gate",
  motion: "highland-gate" as const,
  direction: 1 as const,
  hand: "both" as const,
  timing: { activeStart: 0.18, activeEnd: 0.58, impact: 0.49, followEnd: 0.8 },
  path: {
    kind: "sweep" as const,
    arcMultiplier: 1,
    rangeMultiplier: 1,
    damageMultiplier: 1,
    knockback: 0,
  },
  ribbon: {
    profile: "guard-plane" as const,
    radialStart: 0.3,
    radialEnd: 1,
    widthMultiplier: 1.15,
    end: "clean" as const,
  },
} as const satisfies MeleeComboStep);

export const RISING_WARD_COMBO_STEP = Object.freeze({
  name: "rising ward",
  motion: "rising-ward" as const,
  direction: -1 as const,
  hand: "both" as const,
  timing: { activeStart: 0.12, activeEnd: 0.52, impact: 0.46, followEnd: 0.78 },
  path: {
    kind: "sweep" as const,
    arcMultiplier: 1,
    rangeMultiplier: 1,
    damageMultiplier: 1,
    knockback: 0,
  },
  ribbon: {
    profile: "rising-plane" as const,
    radialStart: 0.34,
    radialEnd: 1,
    widthMultiplier: 1.12,
    end: "clean" as const,
    setupEcho: "neutral-dim" as const,
  },
} as const satisfies MeleeComboStep);

export const BIND_BREAK_CAST_OFF_COMBO_STEP = Object.freeze({
  name: "bind, break, cast off",
  motion: "bind-break-cast-off" as const,
  direction: -1 as const,
  hand: "both" as const,
  timing: { activeStart: 0.3, activeEnd: 0.66, impact: 0.54, followEnd: 0.86 },
  path: {
    kind: "sweep" as const,
    arcMultiplier: 1,
    rangeMultiplier: 1,
    damageMultiplier: 1,
    knockback: 0,
  },
  ribbon: {
    profile: "broken-cross" as const,
    radialStart: 0.3,
    radialEnd: 1,
    widthMultiplier: 1.3,
    end: "open" as const,
    setupEcho: "neutral-dim" as const,
  },
} as const satisfies MeleeComboStep);

export const LONG_REAP_COMBO_STEP = Object.freeze({
  name: "long reap",
  motion: "long-reap" as const,
  direction: 1 as const,
  hand: "both" as const,
  timing: { activeStart: 0.16, activeEnd: 0.58, impact: 0.5, followEnd: 0.78 },
  path: {
    kind: "sweep" as const,
    arcMultiplier: 1,
    rangeMultiplier: 1,
    damageMultiplier: 1,
    knockback: 0,
  },
  ribbon: {
    profile: "outer-crescent" as const,
    radialStart: 0.68,
    radialEnd: 1,
    widthMultiplier: 0.62,
    end: "clean" as const,
  },
} as const satisfies MeleeComboStep);

export const SHAFT_SWITCH_COMBO_STEP = Object.freeze({
  name: "shaft switch",
  motion: "shaft-switch" as const,
  direction: -1 as const,
  hand: "both" as const,
  timing: { activeStart: 0.12, activeEnd: 0.48, impact: 0.42, followEnd: 0.74 },
  path: {
    kind: "sweep" as const,
    arcMultiplier: 1,
    rangeMultiplier: 1,
    damageMultiplier: 1,
    knockback: 0,
  },
  ribbon: {
    profile: "reverse-hairpin" as const,
    radialStart: 0.68,
    radialEnd: 1,
    widthMultiplier: 0.58,
    end: "hooked" as const,
    setupEcho: "neutral-dim" as const,
  },
} as const satisfies MeleeComboStep);

export const COMPASS_ROSE_COMBO_STEP = Object.freeze({
  name: "compass rose",
  motion: "compass-rose" as const,
  direction: 1 as const,
  hand: "both" as const,
  timing: { activeStart: 0.24, activeEnd: 0.68, impact: 0.55, followEnd: 0.88 },
  path: {
    kind: "sweep" as const,
    arcMultiplier: 1,
    rangeMultiplier: 1,
    damageMultiplier: 1,
    knockback: 0,
  },
  ribbon: {
    profile: "open-annulus" as const,
    radialStart: 0.72,
    radialEnd: 1,
    widthMultiplier: 0.55,
    end: "open" as const,
    setupEcho: "neutral-dim" as const,
  },
} as const satisfies MeleeComboStep);

export const HEADSMANS_DROP_COMBO_STEP = Object.freeze({
  name: "headsman's drop",
  motion: "headsmans-drop" as const,
  direction: 1 as const,
  hand: "both" as const,
  timing: { activeStart: 0.26, activeEnd: 0.56, impact: 0.52, followEnd: 0.74 },
  path: {
    kind: "sweep" as const,
    arcMultiplier: 1,
    rangeMultiplier: 1,
    damageMultiplier: 1,
    knockback: 0,
  },
  ribbon: {
    profile: "head-wedge" as const,
    radialStart: 0.68,
    radialEnd: 1,
    widthMultiplier: 1.05,
    end: "squared" as const,
  },
} as const satisfies MeleeComboStep);

export const HOOK_AND_HAUL_COMBO_STEP = Object.freeze({
  name: "hook and haul",
  motion: "hook-and-haul" as const,
  direction: -1 as const,
  hand: "both" as const,
  timing: { activeStart: 0.1, activeEnd: 0.5, impact: 0.42, followEnd: 0.78 },
  path: {
    kind: "sweep" as const,
    arcMultiplier: 1,
    rangeMultiplier: 1,
    damageMultiplier: 1,
    knockback: 0,
  },
  ribbon: {
    profile: "inward-hook" as const,
    radialStart: 0.68,
    radialEnd: 1,
    widthMultiplier: 0.92,
    end: "hooked" as const,
    setupEcho: "neutral-dim" as const,
  },
} as const satisfies MeleeComboStep);

export const GALLOWS_TURN_COMBO_STEP = Object.freeze({
  name: "gallows turn",
  motion: "gallows-turn" as const,
  direction: 1 as const,
  hand: "both" as const,
  timing: { activeStart: 0.3, activeEnd: 0.64, impact: 0.56, followEnd: 0.86 },
  path: {
    kind: "sweep" as const,
    arcMultiplier: 1,
    rangeMultiplier: 1,
    damageMultiplier: 1,
    knockback: 0,
  },
  ribbon: {
    profile: "heavy-sickle" as const,
    radialStart: 0.66,
    radialEnd: 1,
    widthMultiplier: 1.08,
    end: "torn" as const,
    setupEcho: "neutral-dim" as const,
  },
} as const satisfies MeleeComboStep);

/** Driftblade-model panel (§50+): four adopters keep the model's three-role skeleton (DRAW → PUNCTUATE →
 * PAYOFF) in their own words. Every step ships the Stage-1 unit sweep; timing/ribbon are the authored
 * identity. A `widthMultiplier: 0` ribbon is authored SILENCE — the model's compact beat paints nothing. */

// ── Gravechill Nodachi "Cold Court": the executioner deliberates; everything lands 0.02–0.04 late. ──
export const DRAWN_FROST_COMBO_STEP = Object.freeze({
  name: "drawn frost",
  motion: "draw-cut" as const,
  direction: -1 as const,
  hand: "both" as const,
  timing: { activeStart: 0.26, activeEnd: 0.54, impact: 0.54, followEnd: 0.68 },
  path: {
    kind: "sweep" as const,
    arcMultiplier: 1,
    rangeMultiplier: 1,
    damageMultiplier: 1,
    knockback: 0,
  },
  ribbon: {
    profile: "rising-plane" as const,
    radialStart: 0.34,
    radialEnd: 1,
    widthMultiplier: 1,
    end: "clean" as const,
  },
} as const satisfies MeleeComboStep);

export const TSUBA_CHECK_COMBO_STEP = Object.freeze({
  name: "tsuba check",
  motion: "guard-check" as const,
  direction: 1 as const,
  hand: "both" as const,
  timing: { activeStart: 0.14, activeEnd: 0.3, impact: 0.3, followEnd: 0.46 },
  path: {
    kind: "sweep" as const,
    arcMultiplier: 1,
    rangeMultiplier: 1,
    damageMultiplier: 1,
    knockback: 0,
  },
  ribbon: {
    profile: "guard-plane" as const,
    radialStart: 0.5,
    radialEnd: 1,
    widthMultiplier: 0,
    end: "clean" as const,
  },
} as const satisfies MeleeComboStep);

export const SENTENCE_FALL_COMBO_STEP = Object.freeze({
  name: "the sentence",
  motion: "sentence-fall" as const,
  direction: 1 as const,
  hand: "both" as const,
  timing: { activeStart: 0.5, activeEnd: 0.66, impact: 0.63, followEnd: 0.84 },
  path: {
    kind: "sweep" as const,
    arcMultiplier: 1,
    rangeMultiplier: 1,
    damageMultiplier: 1,
    knockback: 0,
  },
  ribbon: {
    profile: "head-wedge" as const,
    radialStart: 0.3,
    radialEnd: 1,
    widthMultiplier: 1.28,
    end: "squared" as const,
    setupEcho: "neutral-dim" as const,
  },
} as const satisfies MeleeComboStep);

// ── Stormpetal Odachi "Petalfall": the longest blade moves like it weighs nothing; slightly early. ──
export const CROSSWIND_COMBO_STEP = Object.freeze({
  name: "crosswind",
  motion: "slash" as const,
  direction: 1 as const,
  hand: "both" as const,
  timing: { activeStart: 0.22, activeEnd: 0.52, impact: 0.5, followEnd: 0.66 },
  path: {
    kind: "sweep" as const,
    arcMultiplier: 1,
    rangeMultiplier: 1,
    damageMultiplier: 1,
    knockback: 0,
  },
  ribbon: {
    profile: "open-c" as const,
    radialStart: 0.3,
    radialEnd: 1,
    widthMultiplier: 0.92,
    end: "clean" as const,
  },
} as const satisfies MeleeComboStep);

export const LEAF_TURN_COMBO_STEP = Object.freeze({
  name: "leaf turn",
  motion: "choked-turn" as const,
  direction: -1 as const,
  hand: "both" as const,
  timing: { activeStart: 0.1, activeEnd: 0.26, impact: 0.26, followEnd: 0.42 },
  path: {
    kind: "sweep" as const,
    arcMultiplier: 1,
    rangeMultiplier: 1,
    damageMultiplier: 1,
    knockback: 0,
  },
  ribbon: {
    profile: "guard-plane" as const,
    radialStart: 0.5,
    radialEnd: 1,
    widthMultiplier: 0,
    end: "clean" as const,
  },
} as const satisfies MeleeComboStep);

export const PETALFALL_COMBO_STEP = Object.freeze({
  name: "petalfall",
  motion: "petalfall" as const,
  direction: 1 as const,
  hand: "both" as const,
  timing: { activeStart: 0.44, activeEnd: 0.62, impact: 0.59, followEnd: 0.82 },
  path: {
    kind: "sweep" as const,
    arcMultiplier: 1,
    rangeMultiplier: 1,
    damageMultiplier: 1,
    knockback: 0,
  },
  ribbon: {
    profile: "heavy-sickle" as const,
    radialStart: 0.28,
    radialEnd: 1,
    widthMultiplier: 1.104,
    end: "torn" as const,
  },
} as const satisfies MeleeComboStep);

// ── Hailwidow Katana "Three Hails": staccato — the model's fractions at half the pose. ──
export const FIRST_HAIL_COMBO_STEP = Object.freeze({
  name: "first hail",
  motion: "shoulder-chop" as const,
  direction: 1 as const,
  hand: "both" as const,
  timing: { activeStart: 0.24, activeEnd: 0.5, impact: 0.48, followEnd: 0.62 },
  path: {
    kind: "sweep" as const,
    arcMultiplier: 1,
    rangeMultiplier: 1,
    damageMultiplier: 1,
    knockback: 0,
  },
  ribbon: {
    profile: "open-c" as const,
    radialStart: 0.32,
    radialEnd: 1,
    widthMultiplier: 1,
    end: "clean" as const,
  },
} as const satisfies MeleeComboStep);

export const WIDOWS_KNOCK_COMBO_STEP = Object.freeze({
  name: "widow's knock",
  motion: "guard-check" as const,
  direction: 1 as const,
  hand: "both" as const,
  timing: { activeStart: 0.12, activeEnd: 0.28, impact: 0.26, followEnd: 0.4 },
  path: {
    kind: "sweep" as const,
    arcMultiplier: 1,
    rangeMultiplier: 1,
    damageMultiplier: 1,
    knockback: 0,
  },
  ribbon: {
    profile: "guard-plane" as const,
    radialStart: 0.5,
    radialEnd: 1,
    widthMultiplier: 0,
    end: "clean" as const,
  },
} as const satisfies MeleeComboStep);

export const SPLINTER_COMBO_STEP = Object.freeze({
  name: "splinter",
  motion: "splinter-fall" as const,
  direction: 1 as const,
  hand: "both" as const,
  timing: { activeStart: 0.42, activeEnd: 0.6, impact: 0.56, followEnd: 0.76 },
  path: {
    kind: "sweep" as const,
    arcMultiplier: 1,
    rangeMultiplier: 1,
    damageMultiplier: 1,
    knockback: 0,
  },
  ribbon: {
    profile: "head-wedge" as const,
    radialStart: 0.3,
    radialEnd: 1,
    widthMultiplier: 1.15,
    end: "torn" as const,
  },
} as const satisfies MeleeComboStep);

// ── Voltfang Tachi "Fang, Then Thunder": contact early, paint late; the coil hums into the fall. ──
export const FANG_COMBO_STEP = Object.freeze({
  name: "fang",
  motion: "slash" as const,
  direction: 1 as const,
  hand: "both" as const,
  timing: { activeStart: 0.2, activeEnd: 0.46, impact: 0.44, followEnd: 0.6 },
  path: {
    kind: "sweep" as const,
    arcMultiplier: 1,
    rangeMultiplier: 1,
    damageMultiplier: 1,
    knockback: 0,
  },
  ribbon: {
    profile: "open-c" as const,
    radialStart: 0.32,
    radialEnd: 1,
    widthMultiplier: 1,
    end: "open" as const,
  },
} as const satisfies MeleeComboStep);

export const COIL_DRAG_COMBO_STEP = Object.freeze({
  name: "coil",
  motion: "coil-drag" as const,
  direction: -1 as const,
  hand: "both" as const,
  timing: { activeStart: 0.14, activeEnd: 0.3, impact: 0.3, followEnd: 0.48 },
  path: {
    kind: "sweep" as const,
    arcMultiplier: 1,
    rangeMultiplier: 1,
    damageMultiplier: 1,
    knockback: 0,
  },
  ribbon: {
    profile: "guard-plane" as const,
    radialStart: 0.5,
    radialEnd: 1,
    widthMultiplier: 0,
    end: "clean" as const,
    setupEcho: "neutral-dim" as const,
  },
} as const satisfies MeleeComboStep);

export const THUNDER_FALL_COMBO_STEP = Object.freeze({
  name: "thunder",
  motion: "thunder-fall" as const,
  direction: 1 as const,
  hand: "both" as const,
  timing: { activeStart: 0.48, activeEnd: 0.62, impact: 0.56, followEnd: 0.78 },
  path: {
    kind: "sweep" as const,
    arcMultiplier: 1,
    rangeMultiplier: 1,
    damageMultiplier: 1,
    knockback: 0,
  },
  ribbon: {
    profile: "head-wedge" as const,
    radialStart: 0.3,
    radialEnd: 1,
    widthMultiplier: 1.18,
    end: "open" as const,
  },
} as const satisfies MeleeComboStep);

type CloseBladeComboVariant = Extract<MeleeComboVariant, "dagger" | "claw">;
type SignatureMeleeComboVariant = Exclude<MeleeComboVariant, "default" | CloseBladeComboVariant>;

/** Generated katana bars are frozen at module load to keep the same immutable-data contract as the
 * hand-authored panel sequences. Nested timing/path objects remain readonly through the generated literal. */
const GENERATED_VARIANT_SEQUENCES = Object.freeze(
  Object.fromEntries(
    Object.entries(GENERATED_MELEE_COMBO_BARS).map(([variant, sequence]) => [
      variant,
      Object.freeze(sequence.map((step) => Object.freeze(step))),
    ]),
  ),
) as Readonly<Record<GeneratedMeleeComboVariant, readonly Readonly<MeleeComboStep>[]>>;

function requiredBaseComboStep(family: MeleeComboFamily, index: number): Readonly<MeleeComboStep> {
  const step = MELEE_COMBO_SEQUENCES[family][index];
  if (!step) throw new RangeError(`Missing ${family} combo step ${index}`);
  return step;
}

/** Complete three-step weapon variants. Unchanged beats reuse their frozen family roots. */
export const MELEE_COMBO_VARIANT_SEQUENCES: Readonly<
  Record<SignatureMeleeComboVariant, readonly Readonly<MeleeComboStep>[]>
> = Object.freeze({
  "quake-mauler": Object.freeze([
    requiredBaseComboStep("chop", 0),
    POMMEL_BASH_COMBO_STEP,
    FULCRUM_FLIP_COMBO_STEP,
  ]),
  stinger: Object.freeze([
    requiredBaseComboStep("thrust", 0),
    requiredBaseComboStep("thrust", 1),
    STINGER_COMBO_STEP,
  ]),
  "hero-spin": Object.freeze([
    requiredBaseComboStep("arc", 0),
    requiredBaseComboStep("arc", 1),
    HERO_SPIN_COMBO_STEP,
  ]),
  pommel: Object.freeze([
    requiredBaseComboStep("chop", 0),
    POMMEL_BASH_COMBO_STEP,
    requiredBaseComboStep("chop", 2),
  ]),
  greatsword: Object.freeze([
    requiredBaseComboStep("chop", 0),
    POMMEL_BASH_COMBO_STEP,
    TRUE_CHARGED_SLAM_COMBO_STEP,
  ]),
  "greatsword-momentum": Object.freeze([
    FALLING_GATE_COMBO_STEP,
    BACKSWING_WHEEL_COMBO_STEP,
    RUNAWAY_CLEAVE_COMBO_STEP,
  ]),
  "claymore-breach": Object.freeze([
    HIGHLAND_GATE_COMBO_STEP,
    RISING_WARD_COMBO_STEP,
    BIND_BREAK_CAST_OFF_COMBO_STEP,
  ]),
  "glaive-compass": Object.freeze([
    LONG_REAP_COMBO_STEP,
    SHAFT_SWITCH_COMBO_STEP,
    COMPASS_ROSE_COMBO_STEP,
  ]),
  "bardiche-hookbreak": Object.freeze([
    HEADSMANS_DROP_COMBO_STEP,
    HOOK_AND_HAUL_COMBO_STEP,
    GALLOWS_TURN_COMBO_STEP,
  ]),
  "nodachi-coldcourt": Object.freeze([
    DRAWN_FROST_COMBO_STEP,
    TSUBA_CHECK_COMBO_STEP,
    SENTENCE_FALL_COMBO_STEP,
  ]),
  "nodachi-petalfall": Object.freeze([
    CROSSWIND_COMBO_STEP,
    LEAF_TURN_COMBO_STEP,
    PETALFALL_COMBO_STEP,
  ]),
  "katana-threehails": Object.freeze([
    FIRST_HAIL_COMBO_STEP,
    WIDOWS_KNOCK_COMBO_STEP,
    SPLINTER_COMBO_STEP,
  ]),
  "katana-thunderlag": Object.freeze([
    FANG_COMBO_STEP,
    COIL_DRAG_COMBO_STEP,
    THUNDER_FALL_COMBO_STEP,
  ]),
  ...GENERATED_VARIANT_SEQUENCES,
});

/** Driftblade-model rollout table (panel §50+). Non-generated ids only, same law as
 * `bigSwordPanelVariantFor`: this map is consulted at that one audited seam BEFORE every structural
 * heuristic (order is load-bearing — gravechill is a quake carrier and would otherwise fall through to
 * `quake-mauler`). Driftblade itself stays on `"greatsword"`: it is the model, not an adopter. */
export const DRIFT_MODEL_ADOPTERS = Object.freeze({
  "x2-gravechill-nodachi": "nodachi-coldcourt",
  "x2-stormpetal-odachi": "nodachi-petalfall",
  "x2-hailwidow-katana": "katana-threehails",
} as const satisfies Record<string, SignatureMeleeComboVariant>);

function driftModelAdopterVariantFor(weaponId: string): SignatureMeleeComboVariant | undefined {
  return Object.hasOwn(DRIFT_MODEL_ADOPTERS, weaponId)
    ? DRIFT_MODEL_ADOPTERS[weaponId as keyof typeof DRIFT_MODEL_ADOPTERS]
    : undefined;
}

export interface MeleeComboSelection {
  readonly family: MeleeComboFamily;
  readonly variant: MeleeComboVariant;
  readonly sequence: readonly Readonly<MeleeComboStep>[];
}

export function meleeComboFamilyForStyle(
  style: SwingStyle | undefined,
): MeleeComboFamily | undefined {
  if (style === "pivot") return "rake";
  if (style === "arc" || style === "chop" || style === "punch" || style === "thrust") return style;
  return undefined;
}

function familyForSignatureVariant(variant: SignatureMeleeComboVariant): MeleeComboFamily {
  if (variant === "stinger") return "thrust";
  if (variant === "hero-spin") return "arc";
  // R4-1 (analyst): the default is correct for every chop-family variant, including all four
  // Driftblade-model adopters. A future NON-chop variant must add its mapping here FIRST, or it silently
  // routes to chop and degrades to the base family sequence with no error.
  return "chop";
}

export function meleeComboSequenceFor(
  family: MeleeComboFamily,
  variant: MeleeComboVariant = "default",
): readonly Readonly<MeleeComboStep>[] {
  if (variant === "dagger" || variant === "claw")
    return family === "rake" ? MELEE_COMBO_SEQUENCES.rake : MELEE_COMBO_SEQUENCES[family];
  if (variant !== "default" && Object.hasOwn(GENERATED_MELEE_COMBO_BARS, variant))
    return MELEE_COMBO_VARIANT_SEQUENCES[variant];
  if (variant !== "default" && familyForSignatureVariant(variant) === family)
    return MELEE_COMBO_VARIANT_SEQUENCES[variant];
  return MELEE_COMBO_SEQUENCES[family];
}

/** Mount type and close-blade motion are deliberately independent. This structural fallback covers the
 * held `fist-blade` dagger lane and held rake implements without teaching SpriteRig weapon ids or changing
 * worn origin/z-order. Pivot remains the existing claw/talon lane. Explicit combo metadata still wins. */
function closeBladeComboVariantFor(
  def: WeaponDef,
  style: SwingStyle,
): CloseBladeComboVariant | undefined {
  if (def.comboVariant === "dagger" || def.comboVariant === "claw") return def.comboVariant;
  const family = def.tags.family.toLowerCase();
  if (def.dual && family === "fist-blade") return "dagger";
  if (style === "pivot" || /\brakes?\b/i.test(def.name)) return "claw";
  return undefined;
}

/** Exact Stage-1 roster routing lives in shared combat presentation, never in SpriteRig. Weapon metadata
 * remains the higher-priority seam; these ids are the non-generated rollout table permitted by the panel. */
function bigSwordPanelVariantFor(def: WeaponDef): SignatureMeleeComboVariant | undefined {
  // Driftblade-model adopters resolve FIRST: gravechill left the "greatsword" case below, and without
  // this early match its `twoHanded && quake && XL` data would fall through to the quake-mauler heuristic.
  const adopted = driftModelAdopterVariantFor(def.id);
  if (adopted) return adopted;
  switch (def.id) {
    case "driftblade":
      return "greatsword";
    case "tombstone-greatsword":
    case "x-sword-coffin":
    case "x-sword-bone":
    case "x2-riftcleaver-greatblade":
      return "greatsword-momentum";
    case "x2-tombwarden-claymore":
    case "x2-dustreaper-zweihander":
      return "claymore-breach";
    case "x2-dustdevil-glaive":
    case "x2-thunderhead-voulge":
    case "x2-wickfire-fauchard":
    case "x2-blightfork-glaive":
      return "glaive-compass";
    case "x2-permafrost-bardiche":
    case "x2-quarry-splitter-bardiche":
      return "bardiche-hookbreak";
    default:
      return undefined;
  }
}

/** Resolve one weapon's combo vocabulary. Explicit metadata wins; structural defaults cover only the
 * ship-list homes and keep all classification out of SpriteRig. */
export function meleeComboSelectionFor(
  def: WeaponDef,
  style: SwingStyle = swingStyleFor(def),
): MeleeComboSelection | undefined {
  const closeBladeVariant = closeBladeComboVariantFor(def, style);
  if (def.comboVariant === "dagger" || def.comboVariant === "claw") {
    return {
      family: "rake",
      variant: def.comboVariant,
      sequence: MELEE_COMBO_SEQUENCES.rake,
    };
  }
  if (def.comboVariant && def.comboVariant !== "default") {
    const family = def.comboFamily ?? familyForSignatureVariant(def.comboVariant);
    return {
      family,
      variant: def.comboVariant,
      sequence: meleeComboSequenceFor(family, def.comboVariant),
    };
  }
  if (def.comboFamily) {
    const variant = def.comboFamily === "rake" ? (closeBladeVariant ?? "default") : "default";
    return {
      family: def.comboFamily,
      variant,
      sequence: meleeComboSequenceFor(def.comboFamily, variant),
    };
  }
  if (closeBladeVariant) {
    return {
      family: "rake",
      variant: closeBladeVariant,
      sequence: MELEE_COMBO_SEQUENCES.rake,
    };
  }
  if (style === "punch") {
    return {
      family: "punch",
      variant: "default",
      sequence: MELEE_COMBO_SEQUENCES.punch,
    };
  }

  const familyTag = def.tags.family.toLowerCase();
  const shapeWords = `${familyTag} ${def.name.toLowerCase()}`;
  let variant = bigSwordPanelVariantFor(def);
  if (!variant) {
    if (def.twoHanded && def.quake && (def.tags.size === "L" || def.tags.size === "XL")) {
      variant = "quake-mauler";
    } else if (style === "thrust") {
      variant = "stinger";
    } else if (
      style === "arc" &&
      !def.twoHanded &&
      !def.dual &&
      /(?:^|\b)(?:sword|sabre|saber|katana)(?:\b|$)/i.test(familyTag)
    ) {
      variant = "hero-spin";
    } else if (
      def.twoHanded &&
      style !== "spin" &&
      (/(?:greatsword|greatblade|claymore|zweihander|nodachi)/i.test(shapeWords) ||
        (familyTag === "sword" && def.tags.size === "XL"))
    ) {
      variant = "greatsword";
    } else if (def.twoHanded && style !== "spin" && /(?:warhammer|hammer|maul)/i.test(shapeWords)) {
      variant = "pommel";
    }
  }

  if (variant) {
    const family = familyForSignatureVariant(variant);
    return {
      family,
      variant,
      sequence: MELEE_COMBO_VARIANT_SEQUENCES[variant],
    };
  }
  const family = meleeComboFamilyForStyle(style);
  return family
    ? { family, variant: "default", sequence: MELEE_COMBO_SEQUENCES[family] }
    : undefined;
}

/** Server-authoritative effect of one accepted Driftblade-line beat. Presentation and mechanics share the
 * same generated sequence length/step, while the legacy swing path remains the one damage carrier. */
export interface KatanaBeatEffect {
  readonly step: number;
  readonly sequenceLength: number;
  readonly finisher: boolean;
  readonly perfect: boolean;
  readonly damageMultiplier: number;
  readonly reachMultiplier: number;
  readonly toughDamageMultiplier: number;
  readonly dashImpulse: number;
  readonly burstRadius: number;
  readonly burstDamage: number;
  readonly invulnerabilitySeconds: number;
}

export function katanaBeatEffectFor(
  def: WeaponDef,
  stepIndex: number,
  sequenceLength: number,
  continued: boolean,
  acceptedGapRatio = Number.POSITIVE_INFINITY,
): KatanaBeatEffect {
  const length = Math.max(1, Math.trunc(sequenceLength));
  const step = ((Math.trunc(stepIndex) % length) + length) % length;
  const finisher = step === length - 1;
  const hook = def.katanaHook;
  if (!hook) {
    return Object.freeze({
      step,
      sequenceLength: length,
      finisher,
      perfect: false,
      damageMultiplier: 1,
      reachMultiplier: 1,
      toughDamageMultiplier: 1,
      dashImpulse: 0,
      burstRadius: 0,
      burstDamage: 0,
      invulnerabilitySeconds: 0,
    });
  }
  const perfect =
    continued &&
    step > 0 &&
    hook.perfectWindowFraction !== undefined &&
    acceptedGapRatio <= 1 + hook.perfectWindowFraction;
  let damageMultiplier = step === 0 ? (hook.openerDamageMultiplier ?? 1) : 1;
  if (hook.stackDamagePerBeat) {
    const stacks = Math.min(hook.maxStacks ?? length, step + 1);
    damageMultiplier *= 1 + hook.stackDamagePerBeat * stacks;
  }
  if (!finisher) damageMultiplier *= hook.nonFinisherDamageMultiplier ?? 1;
  if (finisher) damageMultiplier *= hook.finisherDamageMultiplier ?? 1;
  if (perfect) damageMultiplier *= hook.perfectDamageMultiplier ?? 1;
  return Object.freeze({
    step,
    sequenceLength: length,
    finisher,
    perfect,
    damageMultiplier,
    reachMultiplier: 1 + (hook.reachPerBeat ?? 0) * step,
    toughDamageMultiplier: finisher ? (hook.toughFinisherMultiplier ?? 1) : 1,
    dashImpulse: finisher ? (hook.finisherDashImpulse ?? 0) : 0,
    burstRadius: finisher ? (hook.finisherBurst?.radius ?? 0) : 0,
    burstDamage: finisher ? (hook.finisherBurst?.damage ?? 0) : 0,
    invulnerabilitySeconds: perfect ? (hook.perfectInvulnerabilitySeconds ?? 0) : 0,
  });
}

/** Formula-v1 review inputs for a complete ideal-cadence sentence. Perfect-timing rewards are priced at
 * full mastery; the tough-only premium uses the loot estimator's 25% encounter share instead of pretending
 * every target is armoured. */
export function katanaExpectedMechanic(def: WeaponDef): {
  readonly averageDamageMultiplier: number;
  readonly averageBurstDamage: number;
  readonly maxReachMultiplier: number;
} {
  const sequenceLength = meleeComboSelectionFor(def)?.sequence.length ?? 1;
  let damage = 0;
  let burst = 0;
  let maxReachMultiplier = 1;
  for (let step = 0; step < sequenceLength; step++) {
    const effect = katanaBeatEffectFor(def, step, sequenceLength, step > 0, 1);
    damage += effect.damageMultiplier * (1 + (effect.toughDamageMultiplier - 1) * 0.25);
    burst += effect.burstDamage;
    maxReachMultiplier = Math.max(maxReachMultiplier, effect.reachMultiplier);
  }
  return Object.freeze({
    averageDamageMultiplier: damage / sequenceLength,
    averageBurstDamage: burst / sequenceLength,
    maxReachMultiplier,
  });
}

export interface SwingDescriptor {
  readonly effectiveCooldown: number;
  readonly style: SwingStyle;
  readonly poseSeconds: number;
  readonly activeStartSeconds: number;
  readonly activeEndSeconds: number;
  readonly impactSeconds: number;
  /** Optional accepted/predicted combo snapshot. Stage 1 enriches this client-side while the server keeps
   * its centered single sweep; a later accepted-action protocol can populate the same fields. */
  readonly comboFamily?: MeleeComboFamily;
  readonly comboVariant?: MeleeComboVariant;
  readonly comboStep?: number;
  readonly motion?: MeleeComboMotion;
  readonly comboDirection?: -1 | 0 | 1;
  readonly comboHand?: MeleeComboHand;
  readonly comboTiming?: Readonly<MeleeComboStep["timing"]>;
  readonly comboPath?: Readonly<MeleeComboStep["path"]>;
  readonly comboRibbon?: Readonly<MeleeComboRibbon>;
}

/** Worn gear is animated around the hand, not mounted by the authored hilt pivot. Shared because this same
 *  classification also selects the authoritative swing clock's existing normalized pose envelope. */
export function isWornWeapon(def: WeaponDef): boolean {
  if (/^(gauntlet|fist)$/i.test(def.tags?.family ?? "")) return true;
  return /\b(claws?|talons?|mitts?|gloves?|vambraces?|gauntlets?|knuckles?|cestus|fists?)\b/i.test(
    def.name,
  );
}

/** One style resolver for rig + accepted server descriptor. Authored style wins; the fallbacks exactly match
 *  the pre-§44 client vocabulary, so this clock change cannot silently change a pose shape. */
export function swingStyleFor(def: WeaponDef): SwingStyle {
  if (def.swingStyle) return def.swingStyle;
  if (isWornWeapon(def)) return /claws?|talons?/i.test(def.name) ? "pivot" : "punch";
  if (def.quake) return "chop";
  if (/rapier|lance|spear|pike|estoc|needle/i.test(def.tags?.family ?? "")) return "thrust";
  if (def.twoHanded) return "orbit";
  return "arc";
}

/** Inverse of `p*p*(3-2*p)`, used only to locate where the EXISTING orbit envelope enters/leaves its
 *  authored damage arc amid the unchanged 1.5rad wind-up + 0.9rad follow-through. */
function inverseSmoothstep(value: number): number {
  return 0.5 - Math.sin(Math.asin(1 - 2 * clamp(value, 0, 1)) / 3);
}

/** Build the one swing clock from EFFECTIVE cooldown (base × loot affix). Active fractions mirror today's
 *  normalized pose branches; the server still sweeps the legacy arc linearly inside that interval — exact
 *  per-style path/easing sync is the later accepted-epoch/path protocol, not a hidden geometry rewrite here. */
export function swingDescriptorFor(def: WeaponDef, effectiveCooldown: number): SwingDescriptor {
  const style = swingStyleFor(def);
  const cooldown = Math.max(0, effectiveCooldown);
  const authoredWindup = def.performance?.windupSeconds;
  if (authoredWindup !== undefined && authoredWindup > 0) {
    const poseSeconds = cooldown;
    const activeStartSeconds = Math.min(authoredWindup, Math.max(0, poseSeconds - 0.06));
    const activeDuration = Math.min(0.12, Math.max(0.06, poseSeconds * 0.12));
    const activeEndSeconds = Math.min(poseSeconds, activeStartSeconds + activeDuration);
    return Object.freeze({
      effectiveCooldown: cooldown,
      style,
      poseSeconds,
      activeStartSeconds,
      activeEndSeconds,
      impactSeconds: activeStartSeconds + (activeEndSeconds - activeStartSeconds) * 0.85,
    });
  }
  const poseSeconds = cooldown * (style === "spin" ? 1 : SWING_WINDOW_FRAC);
  let activeStartFrac: number;
  let activeEndFrac: number;
  switch (style) {
    case "chop":
      [activeStartFrac, activeEndFrac] = [0.3, CHOP_IMPACT_FRAC];
      break;
    case "pivot":
      [activeStartFrac, activeEndFrac] = [0.1, 0.62];
      break;
    case "punch":
      [activeStartFrac, activeEndFrac] = [def.twoHanded ? 0.24 : 0.16, CHOP_IMPACT_FRAC];
      break;
    case "thrust":
      [activeStartFrac, activeEndFrac] = [0.14, 0.38];
      break;
    case "orbit": {
      const timingArc = Math.max(0, def.timingSwingArc ?? def.swingArc);
      const travel = timingArc + 2.4;
      activeStartFrac = inverseSmoothstep(1.5 / travel);
      activeEndFrac = inverseSmoothstep((1.5 + timingArc) / travel);
      break;
    }
    case "spin":
      [activeStartFrac, activeEndFrac] = [0, 1];
      break;
    default:
      [activeStartFrac, activeEndFrac] = [0.16, 0.74];
      break;
  }
  return Object.freeze({
    effectiveCooldown: cooldown,
    style,
    poseSeconds,
    activeStartSeconds: poseSeconds * activeStartFrac,
    activeEndSeconds: poseSeconds * activeEndFrac,
    impactSeconds: poseSeconds * CHOP_IMPACT_FRAC,
  });
}

/** Resolve Stage-1 presentation directly from the synced uint32 accepted/predicted attack count. Sequence
 * zero is the documented wrap value after 0xffffffff, so `(seq - 1)` uses normalized rather than JS `%`. */
export function comboStepForAttackSeq(attackSeq: number, sequenceLength: number): number {
  const length = Math.max(0, Math.trunc(sequenceLength));
  if (length === 0) return 0;
  const ordinal = (attackSeq >>> 0) - 1;
  return ((ordinal % length) + length) % length;
}

/** Resolve one accepted visual combo beat from the current `(weapon, family)` chain rather than from the
 * player's global attack count. Every input is either immutable weapon data or synced accepted-beat data;
 * callers retain the previous scalar snapshot, so owner prediction and remote observation make the same
 * decision without allocating a chain object in the attack path.
 *
 * A duplicate beat keeps its already-selected step. Only the next contiguous uint32 beat may advance, and
 * only while the same weapon/family remains inside the previously-authored cadence window. Snapshot gaps,
 * weapon changes, family changes, clock reversal, and cadence expiry all restart at the opener. */
export function comboStepForChain(
  attackSeq: number,
  acceptedAtMs: number,
  weaponId: string,
  family: MeleeComboFamily,
  sequenceLength: number,
  previousAttackSeq: number | undefined,
  previousAcceptedAtMs: number,
  previousWeaponId: string,
  previousFamily: MeleeComboFamily | undefined,
  previousStep: number,
  previousExpiresAtMs: number,
): number {
  const length = Math.max(0, Math.trunc(sequenceLength));
  if (length === 0) return 0;
  const normalizedPrevious = ((Math.trunc(previousStep) % length) + length) % length;
  if (previousAttackSeq === undefined) return 0;

  const advance = ((attackSeq >>> 0) - (previousAttackSeq >>> 0)) >>> 0;
  const sameIdentity = previousWeaponId === weaponId && previousFamily === family;
  if (advance === 0 && sameIdentity) return normalizedPrevious;

  const continues =
    advance === 1 &&
    sameIdentity &&
    Number.isFinite(acceptedAtMs) &&
    acceptedAtMs >= previousAcceptedAtMs &&
    acceptedAtMs <= previousExpiresAtMs;
  return continues ? (normalizedPrevious + 1) % length : 0;
}

/** Snapshot the selected predicted/accepted combo step onto an immutable swing without changing its legacy
 * active, impact, geometry, or damage clock. The server may call the same seam once accepted combo state is
 * authoritative; Stage 1 uses it only for client presentation. */
export function swingDescriptorWithComboStep(
  swing: SwingDescriptor,
  def: WeaponDef,
  stepIndex: number,
): SwingDescriptor {
  const selection = meleeComboSelectionFor(def, swing.style);
  if (!selection || selection.sequence.length === 0) return swing;
  const index =
    ((Math.trunc(stepIndex) % selection.sequence.length) + selection.sequence.length) %
    selection.sequence.length;
  const step = selection.sequence[index];
  if (!step) return swing;
  return Object.freeze({
    ...swing,
    comboFamily: selection.family,
    comboVariant: selection.variant,
    comboStep: index,
    motion: step.motion,
    comboDirection: step.direction,
    comboHand: step.hand,
    comboTiming: step.timing,
    comboPath: step.path,
    comboRibbon: step.ribbon,
  });
}

/** @deprecated Compatibility helper for old tooling. Live rigs must use {@link comboStepForChain}; a global
 * attack count cannot identify the current weapon/family chain after a swap or authored cadence timeout. */
export function swingDescriptorForAttackSeq(
  swing: SwingDescriptor,
  def: WeaponDef,
  attackSeq: number,
): SwingDescriptor {
  const selection = meleeComboSelectionFor(def, swing.style);
  if (!selection || selection.sequence.length === 0) return swing;
  return swingDescriptorWithComboStep(
    swing,
    def,
    comboStepForAttackSeq(attackSeq, selection.sequence.length),
  );
}

/** Normalized authoritative edge progress on the descriptor clock. Clamping lets a 20Hz tick that crosses
 *  an entire very-fast active interval still supersample the full arc instead of dropping the swing. */
export function swingEdgeProgress(swing: SwingDescriptor, elapsedSeconds: number): number {
  const activeSeconds = swing.activeEndSeconds - swing.activeStartSeconds;
  if (activeSeconds <= 0) return elapsedSeconds >= swing.activeEndSeconds ? 1 : 0;
  return clamp((elapsedSeconds - swing.activeStartSeconds) / activeSeconds, 0, 1);
}

export function swingEdgeActive(swing: SwingDescriptor, elapsedSeconds: number): boolean {
  return elapsedSeconds >= swing.activeStartSeconds && elapsedSeconds < swing.activeEndSeconds;
}

/** The blade's aim angle at sweep progress `p` ∈ [0,1]: from `aim − swingArc/2` to `aim + swingArc/2`. */
export function bladeAngleAt(aimAngle: number, swingArc: number, p: number): number {
  return aimAngle - swingArc / 2 + swingArc * clamp(p, 0, 1);
}

export interface WeaponEffectEmitterPoint {
  x: number;
  y: number;
  angle: number;
}

export function weaponEffectEmitterFor(def: WeaponDef | undefined): WeaponEffectEmitter {
  return def?.effectEmitter ?? "body";
}

/** One authored cue clock shared by client accents and server-owned secondary projectiles. */
export function weaponEffectCueSeconds(def: WeaponDef | undefined, swing: SwingDescriptor): number {
  if (def?.effectTiming === "impact") return swing.impactSeconds;
  if (def?.effectTiming === "swing-midpoint")
    return (swing.activeStartSeconds + swing.activeEndSeconds) * 0.5;
  return swing.activeStartSeconds;
}

/** Shared origin seam. Blade emitters sample the same swept edge angle as authoritative melee collision. */
export function weaponEffectEmitterPoint(
  def: WeaponDef | undefined,
  actor: Vec2,
  aimAngle: number,
  swing?: SwingDescriptor,
  elapsedSeconds = 0,
): WeaponEffectEmitterPoint {
  const emitter = weaponEffectEmitterFor(def);
  if (!def || emitter === "body") return { x: actor.x, y: actor.y, angle: aimAngle };
  if (emitter === "tip") {
    const reach = weaponMuzzleReach(def);
    return {
      x: actor.x + Math.cos(aimAngle) * reach,
      y: actor.y + Math.sin(aimAngle) * reach,
      angle: aimAngle,
    };
  }
  const progress = swing ? swingEdgeProgress(swing, elapsedSeconds) : 0.5;
  const angle = bladeAngleAt(aimAngle, def.swingArc, progress);
  const reach = meleeReach(def) * 0.78;
  return {
    x: actor.x + Math.cos(angle) * reach,
    y: actor.y + Math.sin(angle) * reach,
    angle,
  };
}

/** Squared distance from point (px,py) to the segment A(ax,ay)→B(bx,by). Pure. */
export function pointSegmentDist2(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1) : 0;
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  const ex = px - cx;
  const ey = py - cy;
  return ex * ex + ey * ey;
}

/** Does the blade (segment from `wielder` out to `wielder + dir(angle)×range`) touch a circle (an enemy of
 *  radius `targetR`) within `halfWidth`? Point-blank (target on the wielder) always counts. Pure. */
export function bladeHitsCircle(
  wielder: Vec2,
  angle: number,
  range: number,
  target: Vec2,
  targetR: number,
  halfWidth: number,
): boolean {
  const bx = wielder.x + Math.cos(angle) * range;
  const by = wielder.y + Math.sin(angle) * range;
  const d2 = pointSegmentDist2(target.x, target.y, wielder.x, wielder.y, bx, by);
  const rr = targetR + halfWidth;
  return d2 <= rr * rr;
}
